import { useState, useEffect, useMemo, useCallback } from 'react';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import { loadWorldTeamData } from '@/features/architect/utils/worldTeamData';
import {
  getSalaryForYear,
  areSamePick,
} from '@/features/architect/utils/tradeHelpers';
import { TeamMap } from '@/constants/teamList';

/* ============================
   Helpers: numeric + payroll + season keys
   ============================ */

const num = (v) => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// Map season end-year (e.g., 2025) -> "2024-25"
const toSeasonKey = (endYear) => `${endYear - 1}-${String(endYear).slice(-2)}`;

// Baseline payroll from your cap sheet: prefer activeContracts, fallback to players.contract
// Uses Architect contract.salariesByYear schema
const payrollForYearFromCapSheet = (capSheet, endYear) => {
  if (!capSheet) return 0;

  // Convert end-year to season start-year format: 2025 -> "2024-25"
  const season = toSeasonKey(endYear);
  const y = String(endYear);

  // Preferred source: activeContracts
  const fromActive = (capSheet.activeContracts || []).reduce((sum, c) => {
    // Use Architect schema: contract.salariesByYear array
    if (c?.contract?.salariesByYear) {
      const yearEntry = c.contract.salariesByYear.find(
        (entry) => entry.season === season
      );
      if (yearEntry) {
        return sum + num(yearEntry.capHit || yearEntry.salary || 0);
      }
    }

    // Fallback to salaryByYear map (temporary format during trade creation)
    const s = c?.salaryByYear?.[endYear] ?? c?.salaryByYear?.[y] ?? 0;
    return sum + num(s);
  }, 0);
  if (fromActive > 0) return fromActive;

  // Fallback: players array
  const fromPlayers = (capSheet.players || []).reduce((sum, p) => {
    // Use Architect schema: contract.salariesByYear array
    if (p?.contract?.salariesByYear) {
      const yearEntry = p.contract.salariesByYear.find(
        (entry) => entry.season === season
      );
      if (yearEntry) {
        return sum + num(yearEntry.capHit || yearEntry.salary || 0);
      }
    }

    return sum;
  }, 0);

  return fromPlayers;
};

// Optional dead money (best-effort scan of common shapes)
const deadMoneyForYear = (capSheet, endYear) => {
  const y = String(endYear);

  const arrs = []
    .concat(capSheet?.waivedContracts || [])
    .concat(capSheet?.stretchHistory || []);

  const fromArrays = arrs.reduce((sum, w) => {
    const amt =
      w?.deadMoneyByYear?.[endYear] ??
      w?.deadMoneyByYear?.[y] ??
      w?.amountByYear?.[endYear] ??
      w?.amountByYear?.[y] ??
      0;
    return sum + num(amt);
  }, 0);

  const fromFlat =
    num(capSheet?.deadMoney?.[endYear]) + num(capSheet?.deadMoney?.[y]);

  return fromArrays + fromFlat;
};

/* ============================
   Helpers: FA buckets & test TPE seeding
   ============================ */

/**
 * Pull MLE/Room MLE/BAE values from capProjections using the **season end-year**.
 */
function getMLEBAEForYear(endYear, capProjections) {
  if (!capProjections) return { fullMLE: 0, roomMLE: 0, bae: 0 };

  const key = toSeasonKey(endYear); // e.g., 2025 -> "2024-25"
  const fromComposite = capProjections?.[key] || {};
  const fromNumeric = capProjections?.[endYear] || {};
  const src = Object.keys(fromComposite).length ? fromComposite : fromNumeric;

  return {
    fullMLE: src.fullMLE ?? src.mle ?? 0,
    roomMLE: src.roomMLE ?? src.rmle ?? 0,
    bae: src.bae ?? 0,
  };
}

/**
 * Mutates team to add FA exception buckets and (optionally) seed test TPEs if missing.
 */
function augmentTeamWithExceptions(team, endYear, capProjections) {
  if (!team) return team;

  // Seed FA buckets if not present
  if (!Array.isArray(team.faExceptionBuckets)) {
    const { fullMLE, roomMLE, bae } = getMLEBAEForYear(endYear, capProjections);
    const buckets = [];
    if (fullMLE > 0)
      buckets.push({ type: 'NTMLE', remaining: fullMLE, expiresAt: null });
    if (roomMLE > 0)
      buckets.push({ type: 'RMLE', remaining: roomMLE, expiresAt: null });
    if (bae > 0) buckets.push({ type: 'BAE', remaining: bae, expiresAt: null });
    if (buckets.length) team.faExceptionBuckets = buckets;
  }

  // Seed a couple of test TPEs for sandboxing if none exist
  if (
    !Array.isArray(team.tradeExceptions) ||
    team.tradeExceptions.length === 0
  ) {
    team.tradeExceptions = [
      {
        id: `${team.id}-tpe-a`,
        name: 'Test TPE A',
        amount: 6_500_000,
        expiryDate: null,
      },
      {
        id: `${team.id}-tpe-b`,
        name: 'Test TPE B',
        amount: 2_800_000,
        expiryDate: new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 30
        ).toISOString(),
      },
    ];
  }

  return team;
}

export const useTradeMachine = (
  primaryTeam,
  capProjections,
  currentYear, // ← season **end-year**, e.g. 2025 for 2024-25
  primaryTeamData = null,
  worldId = null // ← optional worldId for world-aware loading
) => {
  // Main state
  const [teams, setTeams] = useState([]);
  const [result, setResult] = useState(null);
  const [forceTrade, setForceTrade] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Use the selected season end-year everywhere (no hardcoding)
  const yearKey = currentYear;

  // Memoized calculations
  const incomingAssets = useMemo(() => {
    return teams.map((tm, idx) => {
      const players = [];
      const picks = [];
      teams.forEach((t, j) => {
        if (j !== idx && t.team) {
          t.sends.forEach((p) => {
            if (!p.tradeTo || p.tradeTo === tm.team?.id) {
              players.push({ ...p, fromTeamId: t.team.id });
            }
          });
          t.picksOut.forEach((p) => {
            if (!p.toTeamId || p.toTeamId === tm.team?.id) {
              picks.push({ ...p, fromTeamId: t.team.id });
            }
          });
        }
      });
      return { teamId: tm.team?.id, players, picks };
    });
  }, [teams]);

  const salaryOut = useMemo(
    () => teams.map((t) => getSalaryForYear(t.sends, yearKey)),
    [teams, yearKey]
  );

  // Initialize teams (slot 0 = primary team, slot 1 = empty)
  useEffect(() => {
    const init = async () => {
      if (!primaryTeam) return;

      const baseTeam = TeamMap[primaryTeam];
      // Use primaryTeamData if provided (already world-aware from GMDashboard)
      // Otherwise load with world-awareness via loadWorldTeamData
      const data = primaryTeamData || (await loadWorldTeamData(worldId, primaryTeam));

      if (baseTeam && data) {
        // Build team object, augment exceptions/tpes
        const teamObj = {
          ...baseTeam,
          ...data,
          tradeExceptions: data.tradeExceptions || [],
          // Map draftPicks to picks for trade machine compatibility
          picks: data.draftPicks || data.picks || [],
        };
        augmentTeamWithExceptions(teamObj, yearKey, capProjections);

        // === Baseline payroll wiring ===
        const baseline = payrollForYearFromCapSheet(teamObj, yearKey);
        const dead = deadMoneyForYear(teamObj, yearKey);
        teamObj.teamTotalSalary = baseline + dead;
        teamObj.projectedSalary = baseline + dead;

        // LOG A) After computing teamObj.teamTotalSalary in init()
        console.log(
          '[init payroll]',
          teamObj.nickname || teamObj.name || teamObj.id,
          {
            year: yearKey,
            baseline,
            dead,
            teamTotalSalary: teamObj.teamTotalSalary,
            projectedSalary: teamObj.projectedSalary,
          }
        );

        setTeams([
          {
            team: teamObj,
            sends: [],
            picksOut: [],
          },
          { team: null, sends: [], picksOut: [] },
        ]);
      }
    };
    init();
  }, [primaryTeam, primaryTeamData, capProjections, yearKey, worldId]);

  // Core trade actions
  const setPlayerTrade = useCallback(
    (index, player, action, destTeamId = null) => {
      setTeams((prev) => {
        const newTeams = [...prev];
        const team = newTeams[index];
        const playerId = player.id || player.player_id;
        const playerIndex = team.sends.findIndex(
          (p) => (p.id || p.player_id) === playerId
        );

        switch (action) {
          case 'trade':
            if (playerIndex === -1) {
              newTeams[index].sends = [
                ...team.sends,
                { ...player, tradeTo: destTeamId, signAndTrade: false },
              ];
            } else {
              newTeams[index].sends[playerIndex] = {
                ...newTeams[index].sends[playerIndex],
                tradeTo: destTeamId,
                signAndTrade: false,
              };
            }
            break;

          case 'signAndTrade':
            if (playerIndex === -1) {
              newTeams[index].sends = [
                ...team.sends,
                { ...player, tradeTo: destTeamId, signAndTrade: true },
              ];
            } else {
              newTeams[index].sends[playerIndex] = {
                ...newTeams[index].sends[playerIndex],
                tradeTo: destTeamId,
                signAndTrade: true,
              };
            }
            break;

          case 'keep':
            newTeams[index].sends = team.sends.filter(
              (p) => (p.id || p.player_id) !== playerId
            );
            break;
        }

        return newTeams;
      });
    },
    []
  );

  const togglePick = useCallback((index, pick) => {
    setTeams((prev) => {
      const newTeams = [...prev];
      const existingIndex = newTeams[index].picksOut.findIndex((p) =>
        areSamePick(p, pick)
      );

      if (existingIndex >= 0) {
        newTeams[index].picksOut.splice(existingIndex, 1);
      } else {
        newTeams[index].picksOut = [
          ...newTeams[index].picksOut,
          { ...pick, fromTeamId: newTeams[index].team?.id },
        ];
      }

      return newTeams;
    });
  }, []);

  const updatePickField = useCallback((index, pick, field, value) => {
    setTeams((prev) => {
      const newTeams = [...prev];
      const pickIndex = newTeams[index].picksOut.findIndex((p) =>
        areSamePick(p, pick)
      );

      if (pickIndex >= 0) {
        newTeams[index].picksOut[pickIndex][field] = value;
      }

      return newTeams;
    });
  }, []);

  // Team management
  const selectTeam = useCallback(
    async (index, teamId) => {
      if (!teamId) {
        setTeams((prev) => {
          const newTeams = [...prev];
          newTeams[index] = { team: null, sends: [], picksOut: [] };
          return newTeams;
        });
        return;
      }

      const baseTeam = TeamMap[teamId];
      // World-aware loading for secondary teams in trade machine
      const data = await loadWorldTeamData(worldId, teamId);

      if (baseTeam && data) {
        const teamObj = {
          ...baseTeam,
          ...data,
          tradeExceptions: data.tradeExceptions || [],
          // Map draftPicks to picks for trade machine compatibility
          picks: data.draftPicks || data.picks || [],
        };
        augmentTeamWithExceptions(teamObj, yearKey, capProjections);

        // === Baseline payroll wiring on select ===
        const baseline = payrollForYearFromCapSheet(teamObj, yearKey);
        const dead = deadMoneyForYear(teamObj, yearKey);
        teamObj.teamTotalSalary = baseline + dead;
        teamObj.projectedSalary = baseline + dead;

        // LOG B) After computing payroll in selectTeam()
        console.log(
          '[select payroll]',
          teamObj.nickname || teamObj.name || teamObj.id,
          {
            year: yearKey,
            baseline,
            dead,
            teamTotalSalary: teamObj.teamTotalSalary,
            projectedSalary: teamObj.projectedSalary,
          }
        );

        setTeams((prev) => {
          const newTeams = [...prev];
          newTeams[index] = { team: teamObj, sends: [], picksOut: [] };
          return newTeams;
        });
      }
    },
    [capProjections, yearKey, worldId]
  );

  const addTeam = useCallback(() => {
    if (teams.length >= 5) return;
    setTeams((prev) => [...prev, { team: null, sends: [], picksOut: [] }]);
  }, [teams.length]);

  const removeTeam = useCallback((index) => {
    setTeams((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Core validation function - extracted for reuse
  const validateCurrentTrade = useCallback(() => {
    if (teams.filter((t) => t.team).length < 2) {
      setResult(null);
      return null;
    }

    // (Optional) last-second safety net: if any team is missing payroll, patch it
    const patchedTeams = teams.map((t) => {
      if (!t.team) return t;
      if (
        !Number.isFinite(t.team.teamTotalSalary) ||
        t.team.teamTotalSalary === 0
      ) {
        const baseline = payrollForYearFromCapSheet(t.team, yearKey);
        const dead = deadMoneyForYear(t.team, yearKey);
        return {
          ...t,
          team: {
            ...t.team,
            teamTotalSalary: baseline + dead,
            projectedSalary: baseline + dead,
          },
        };
      }
      return t;
    });

    // LOG C) Right before validateTrade(...) in validateCurrentTrade()
    console.log(
      '[validate -> teams payroll]',
      teams.map(
        (t) =>
          t.team && {
            team: t.team.nickname || t.team.name || t.team.id,
            teamTotalSalary: t.team.teamTotalSalary,
            projectedSalary: t.team.projectedSalary,
          }
      )
    );
    const validation = validateTrade({
      teams: patchedTeams
        .filter((t) => t.team)
        .map((t) => ({
          team: t.team,
          sends: t.sends,
          picksOut: t.picksOut,
          hardCapped: t.team.hardCapped,
        })),
      capProjections,
      currentYear: yearKey,
    });

    // Environment flag to enable force trade bypass
    // In production (canOverride=false), forceTrade has no effect
    const canOverride = import.meta.env.VITE_ENABLE_CBA_OVERRIDE === 'true';

    const result = {
      ...validation,
      legal: (canOverride && forceTrade) ? true : validation.legal,
    };

    setResult(result);
    console.log(
      '[after validate]',
      validation.teamResults.map((tr) => ({
        team: tr.team?.nickname || tr.team?.name || tr.team?.id,
        pre: tr.preTradeStatus?.projectedSalary,
        post: tr.postTradeStatus?.projectedSalary,
        apron: tr.postTradeStatus?.isAtOrAboveSecondApron,
      }))
    );

    return result;
  }, [teams, capProjections, yearKey, forceTrade]);

  // Auto-validation effect - triggers validation whenever trade state changes
  useEffect(() => {
    validateCurrentTrade();
  }, [validateCurrentTrade]);

  // Manual validation trigger (for UI components that need explicit validation)
  const handleValidate = useCallback(() => {
    const result = validateCurrentTrade();
    if (result) {
      setPreviewOpen(true);
    }
  }, [validateCurrentTrade]);

  const exportCurrentTrade = useCallback(() => {
    return teams
      .filter((t) => t.team)
      .map((t) => ({
        teamId: t.team.id,
        outgoingPlayers: t.sends,
        outgoingPicks: t.picksOut,
        incomingPlayers:
          incomingAssets.find((a) => a.teamId === t.team.id)?.players || [],
        incomingPicks:
          incomingAssets.find((a) => a.teamId === t.team.id)?.picks || [],
        usedTradeExceptions: t.sends
          .filter((p) => p.acquiredViaTPE)
          .map((p) => p.tpeId),
      }));
  }, [teams, incomingAssets]);

  const resetTrade = useCallback(() => {
    setTeams((prev) => prev.map((t) => ({ ...t, sends: [], picksOut: [] })));
    setResult(null);
    setForceTrade(false);
  }, []);

  const undoPlayerTrade = useCallback((player) => {
    setTeams((prev) =>
      prev.map((t) => ({
        ...t,
        sends: t.sends.filter(
          (p) => (p.id || p.player_id) !== (player.id || player.player_id)
        ),
      }))
    );
  }, []);

  const applyTradeException = useCallback((teamIndex, player, tpe) => {
    setTeams((prev) =>
      prev.map((t, i) => {
        if (i !== teamIndex) return t;

        return {
          ...t,
          sends: [
            ...t.sends,
            {
              ...player,
              acquiredViaTPE: true,
              tpeId: tpe.id,
              tradeTo: t.team.id,
            },
          ],
          team: {
            ...t.team,
            tradeExceptions:
              t.team.tradeExceptions?.map((te) =>
                te.id === tpe.id ? { ...te, isUsed: true } : te
              ) || [],
          },
        };
      })
    );
  }, []);

  return {
    teams,
    result,
    forceTrade,
    previewOpen,
    setPreviewOpen,
    setForceTrade,
    setPlayerTrade,
    togglePick,
    updatePickField,
    selectTeam,
    addTeam,
    removeTeam,
    handleValidate,
    exportCurrentTrade,
    undoPlayerTrade,
    resetTrade,
    applyTradeException,
    yearKey,
    incomingAssets,
    salaryOut,
  };
};
