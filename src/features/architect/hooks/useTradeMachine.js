import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import { loadWorldTeamData } from '@/features/architect/utils/worldTeamData';
import {
  getSalaryForYear,
  areSamePick,
} from '@/features/architect/utils/tradeHelpers';
import { ensurePickId } from '@/features/architect/utils/tradeMachine/utils/pickIdUtils';
import { TeamMap } from '@/constants/teamList';
import { toSeasonKey } from '@/features/architect/utils/seasonFormat';
import {
  computeTradeDraftKey,
  isValidationCurrent,
} from '@/features/architect/tradeMachine/utils/computeTradeDraftKey';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { resolveEntitlementsForTeam } from '@/features/architect/utils/entitlements/entitlementResolver';

/* ============================
   DEBUG FLAG & TEAM CODE RESOLUTION
   ============================ */

/**
 * Enable debug logging for entitlements resolution.
 * Set VITE_DEBUG_ENTITLEMENTS=true in environment to enable.
 */
const DEBUG_ENT = Boolean(import.meta?.env?.VITE_DEBUG_ENTITLEMENTS);

/**
 * Resolve a valid 3-letter team code from various team object shapes.
 * Returns the code (e.g., "LAL") or null if unable to resolve.
 */
function resolveTeamCodeLike(teamObjOrId, teamDataMaybe = null) {
  // Prefer teamData.teamCode if present
  if (teamDataMaybe?.teamCode) {
    return teamDataMaybe.teamCode;
  }
  // Else if teamData.id is exactly length 3, use that
  if (typeof teamDataMaybe?.id === 'string' && teamDataMaybe.id.length === 3) {
    return teamDataMaybe.id;
  }
  // Else if teamObjOrId is exactly length 3, use that (string id passed directly)
  if (typeof teamObjOrId === 'string' && teamObjOrId.length === 3) {
    return teamObjOrId;
  }
  // Else attempt teamObjOrId.code if 3 chars (from TeamMap entry)
  if (typeof teamObjOrId?.code === 'string' && teamObjOrId.code.length === 3) {
    return teamObjOrId.code;
  }
  // Else attempt teamObjOrId.abbreviation if 3 chars
  if (
    typeof teamObjOrId?.abbreviation === 'string' &&
    teamObjOrId.abbreviation.length === 3
  ) {
    return teamObjOrId.abbreviation;
  }
  // Else attempt teamObjOrId.id if 3 chars
  if (typeof teamObjOrId?.id === 'string' && teamObjOrId.id.length === 3) {
    return teamObjOrId.id;
  }
  // Else attempt teamData.team?.id if 3 chars
  if (
    typeof teamDataMaybe?.team?.id === 'string' &&
    teamDataMaybe.team.id.length === 3
  ) {
    return teamDataMaybe.team.id;
  }
  // Could not resolve
  if (DEBUG_ENT) {
    console.warn(
      '[DEBUG_ENT] resolveTeamCodeLike: could not resolve team code',
      { teamObjOrId, teamDataMaybe }
    );
  }
  return null;
}

/* ============================
   SSOT WIRING
   ============================ */

/**
 * Convenience wrapper to get baseline payroll + dead money from SSOT.
 * Returns { playersTotal, deadMoneyTotal, totalWithDead } from computeTeamCapTotals.
 */
const getCapTotalsForYear = (teamCapSheet, yearKey) => {
  if (!teamCapSheet)
    return { playersTotal: 0, deadMoneyTotal: 0, totalWithDead: 0 };
  const totals = computeTeamCapTotals(teamCapSheet, yearKey);
  return {
    playersTotal: totals.playersTotal,
    deadMoneyTotal: totals.deadMoneyTotal,
    totalWithDead: totals.playersTotal + totals.deadMoneyTotal,
  };
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
        expiresOn: null,
      },
      {
        id: `${team.id}-tpe-b`,
        name: 'Test TPE B',
        amount: 2_800_000,
        expiresOn: new Date(
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
  // P0-3: Track validation in-flight state for UI loading indicators
  const [isValidating, setIsValidating] = useState(false);

  // Stale validation fix: Track which draft configuration was validated
  const lastValidatedDraftKeyRef = useRef(null);
  const validatedAtRef = useRef(null);

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

  // Stale validation fix: Compute current draft key whenever trade config changes
  const currentDraftKey = useMemo(() => {
    return computeTradeDraftKey({ yearKey, teams });
  }, [yearKey, teams]);

  // Stale validation fix: Check if validation result is current for this draft
  const hasCurrentValidation = useMemo(() => {
    return (
      result?.teamResults?.length > 0 &&
      isValidationCurrent(currentDraftKey, lastValidatedDraftKeyRef.current)
    );
  }, [result, currentDraftKey]);

  // Initialize teams (slot 0 = primary team, slot 1 = empty)
  useEffect(() => {
    const init = async () => {
      if (!primaryTeam) return;

      const baseTeam = TeamMap[primaryTeam];
      // Use primaryTeamData if provided (already world-aware from GMDashboard)
      // Otherwise load with world-awareness via loadWorldTeamData
      const data =
        primaryTeamData || (await loadWorldTeamData(worldId, primaryTeam));

      if (baseTeam && data) {
        // Build team object, augment exceptions/tpes
        // Map draftAssets/draftPicks to picks for trade machine compatibility
        // Priority: draftAssets.picks (canonical) > draftPicks > picks
        // Ensure all picks have canonical IDs (Phase 1 - SSOT)
        const rawPicks =
          data.draftAssets?.picks || data.draftPicks || data.picks || [];
        const picksWithIds = rawPicks.map((p) => ensurePickId(p));

        const teamObj = {
          ...baseTeam,
          ...data,
          tradeExceptions: data.tradeExceptions || [],
          picks: picksWithIds,
        };

        if (worldId || (data.entitlementIds && data.entitlementIds.length)) {
          try {
            const resolvedTeamCode = resolveTeamCodeLike(baseTeam, data);
            if (DEBUG_ENT) {
              console.log('[DEBUG_ENT] init slot 0:', {
                slotIndex: 0,
                teamCode: resolvedTeamCode,
                worldId,
                hasEntitlementIds: Boolean(data.entitlementIds?.length),
              });
            }
            if (resolvedTeamCode) {
              const entitlements = await resolveEntitlementsForTeam(
                worldId,
                resolvedTeamCode
              );
              teamObj.entitlements = entitlements;
              if (DEBUG_ENT) {
                console.log('[DEBUG_ENT] init slot 0 resolved:', {
                  teamCode: resolvedTeamCode,
                  entitlementsCount: entitlements?.length ?? 0,
                  usingLegacyFallback: false,
                });
              }
            } else {
              console.warn('[init] Could not resolve team code for slot 0');
              teamObj.entitlements = [];
            }
          } catch (err) {
            console.warn('Failed to resolve team entitlements:', err);
            teamObj.entitlements = [];
          }
        }
        augmentTeamWithExceptions(teamObj, yearKey, capProjections);

        // === Baseline payroll wiring (SSOT) ===
        const {
          playersTotal: baseline,
          deadMoneyTotal: dead,
          totalWithDead,
        } = getCapTotalsForYear(teamObj, yearKey);
        teamObj.teamTotalSalary = totalWithDead;
        teamObj.projectedSalary = totalWithDead;

        // LOG A) After computing teamObj.teamTotalSalary in init()
        console.log(
          '[init payroll SSOT]',
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
            entitlementsOut: [],
          },
          { team: null, sends: [], picksOut: [], entitlementsOut: [] },
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

          case 'setAbsorptionMode':
            // destTeamId is actually the absorptionMode value ('MATCH', 'TPE', 'FA_EXCEPTION')
            // For incoming players, find the sending team and update the player there
            {
              const absorptionMode = destTeamId;
              // First check if player is in this team's sends
              if (playerIndex !== -1) {
                newTeams[index].sends[playerIndex] = {
                  ...newTeams[index].sends[playerIndex],
                  absorptionMode,
                };
              } else {
                // Player is incoming - find which team is sending them and update there
                for (let i = 0; i < newTeams.length; i++) {
                  const otherTeam = newTeams[i];
                  const otherPlayerIdx = otherTeam.sends.findIndex(
                    (p) => (p.id || p.player_id) === playerId
                  );
                  if (otherPlayerIdx !== -1) {
                    newTeams[i].sends[otherPlayerIdx] = {
                      ...newTeams[i].sends[otherPlayerIdx],
                      absorptionMode,
                    };
                    break;
                  }
                }
              }
            }
            break;

          case 'setFaBucket':
            // Similar to setAbsorptionMode - destTeamId is the bucket type value
            {
              const bucketType = destTeamId;
              if (playerIndex !== -1) {
                newTeams[index].sends[playerIndex] = {
                  ...newTeams[index].sends[playerIndex],
                  bucketType,
                };
              } else {
                for (let i = 0; i < newTeams.length; i++) {
                  const otherTeam = newTeams[i];
                  const otherPlayerIdx = otherTeam.sends.findIndex(
                    (p) => (p.id || p.player_id) === playerId
                  );
                  if (otherPlayerIdx !== -1) {
                    newTeams[i].sends[otherPlayerIdx] = {
                      ...newTeams[i].sends[otherPlayerIdx],
                      bucketType,
                    };
                    break;
                  }
                }
              }
            }
            break;

          case 'setTpeId':
            // Set specific TPE ID on player (destTeamId is actually the tpeId)
            {
              const tpeId = destTeamId;
              if (playerIndex !== -1) {
                const current = newTeams[index].sends[playerIndex];
                newTeams[index].sends[playerIndex] = {
                  ...current,
                  tpeId,
                  // Only force into TPE mode if a TPE is explicitly selected.
                  // If clearing TPE (tpeId=''), leave mode as-is (likely already 'TPE')
                  absorptionMode: tpeId ? 'TPE' : current.absorptionMode,
                };
              } else {
                for (let i = 0; i < newTeams.length; i++) {
                  const otherTeam = newTeams[i];
                  const otherPlayerIdx = otherTeam.sends.findIndex(
                    (p) => (p.id || p.player_id) === playerId
                  );
                  if (otherPlayerIdx !== -1) {
                    const current = newTeams[i].sends[otherPlayerIdx];
                    newTeams[i].sends[otherPlayerIdx] = {
                      ...current,
                      tpeId,
                      absorptionMode: tpeId ? 'TPE' : current.absorptionMode,
                    };
                    break;
                  }
                }
              }
            }
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
      // Ensure pick has ID before comparison (Phase 1 - SSOT)
      const pickWithId = ensurePickId(pick);
      const existingIndex = newTeams[index].picksOut.findIndex((p) =>
        areSamePick(p, pickWithId)
      );

      if (existingIndex >= 0) {
        newTeams[index].picksOut.splice(existingIndex, 1);
      } else {
        // Ensure pick added to picksOut has canonical ID (Phase 1 - SSOT)
        newTeams[index].picksOut = [
          ...newTeams[index].picksOut,
          { ...pickWithId, fromTeamId: newTeams[index].team?.id },
        ];
      }

      return newTeams;
    });
  }, []);

  // Phase 11.1: Toggle entitlement selection for trading
  const toggleEntitlement = useCallback((index, entitlement) => {
    setTeams((prev) => {
      const newTeams = [...prev];
      const entitlementId = entitlement.id || entitlement.entitlementId;
      const existingIndex = (newTeams[index].entitlementsOut || []).findIndex(
        (e) => (e.id || e.entitlementId) === entitlementId
      );

      if (existingIndex >= 0) {
        // Remove from selection
        newTeams[index].entitlementsOut = newTeams[
          index
        ].entitlementsOut.filter((_, i) => i !== existingIndex);
      } else {
        // Add to selection with required metadata
        newTeams[index].entitlementsOut = [
          ...(newTeams[index].entitlementsOut || []),
          {
            ...entitlement,
            entitlementId,
            fromTeamId: newTeams[index].team?.id,
          },
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
          newTeams[index] = {
            team: null,
            sends: [],
            picksOut: [],
            entitlementsOut: [],
          };
          return newTeams;
        });
        return;
      }

      const baseTeam = TeamMap[teamId];
      // World-aware loading for secondary teams in trade machine
      const data = await loadWorldTeamData(worldId, teamId);

      if (baseTeam && data) {
        // Map draftAssets/draftPicks to picks for trade machine compatibility
        // Priority: draftAssets.picks (canonical) > draftPicks > picks
        // Ensure all picks have canonical IDs (Phase 1 - SSOT)
        const rawPicks =
          data.draftAssets?.picks || data.draftPicks || data.picks || [];
        const picksWithIds = rawPicks.map((p) => ensurePickId(p));

        const teamObj = {
          ...baseTeam,
          ...data,
          tradeExceptions: data.tradeExceptions || [],
          picks: picksWithIds,
        };

        // Phase 11.4: Load entitlements for secondary teams (slots 1+)
        // Same logic as primary team init, but for any slot
        if (worldId || (data.entitlementIds && data.entitlementIds.length)) {
          try {
            const resolvedTeamCode = resolveTeamCodeLike(baseTeam, data);
            if (DEBUG_ENT) {
              console.log('[DEBUG_ENT] selectTeam slot:', {
                slotIndex: index,
                teamId,
                teamCode: resolvedTeamCode,
                worldId,
                hasEntitlementIds: Boolean(data.entitlementIds?.length),
              });
            }
            if (resolvedTeamCode) {
              const entitlements = await resolveEntitlementsForTeam(
                worldId,
                resolvedTeamCode
              );
              teamObj.entitlements = entitlements;
              if (DEBUG_ENT) {
                console.log('[DEBUG_ENT] selectTeam resolved:', {
                  slotIndex: index,
                  teamCode: resolvedTeamCode,
                  entitlementsCount: entitlements?.length ?? 0,
                  usingLegacyFallback: false,
                });
              }
            } else {
              console.warn(
                `[selectTeam] Could not resolve team code for slot ${index}`
              );
              teamObj.entitlements = [];
            }
          } catch (err) {
            console.warn(
              `[selectTeam] Failed to resolve entitlements for slot ${index}:`,
              err
            );
            teamObj.entitlements = [];
          }
        } else {
          // No worldId and no entitlementIds - use legacy picks fallback
          if (DEBUG_ENT) {
            console.log('[DEBUG_ENT] selectTeam legacy fallback:', {
              slotIndex: index,
              teamId,
              reason: 'no worldId and no entitlementIds',
              usingLegacyFallback: true,
            });
          }
          teamObj.entitlements = [];
        }

        augmentTeamWithExceptions(teamObj, yearKey, capProjections);

        // === Baseline payroll wiring on select (SSOT) ===
        const {
          playersTotal: baseline,
          deadMoneyTotal: dead,
          totalWithDead,
        } = getCapTotalsForYear(teamObj, yearKey);
        teamObj.teamTotalSalary = totalWithDead;
        teamObj.projectedSalary = totalWithDead;

        // LOG B) After computing payroll in selectTeam()
        console.log(
          '[select payroll SSOT]',
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
          newTeams[index] = {
            team: teamObj,
            sends: [],
            picksOut: [],
            entitlementsOut: [],
          };
          return newTeams;
        });
      }
    },
    [capProjections, yearKey, worldId]
  );

  const addTeam = useCallback(() => {
    if (teams.length >= 5) return;
    setTeams((prev) => [
      ...prev,
      { team: null, sends: [], picksOut: [], entitlementsOut: [] },
    ]);
  }, [teams.length]);

  const removeTeam = useCallback((index) => {
    setTeams((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Core validation function - extracted for reuse
  // P0-3: Wraps validation with isValidating state for UI loading indicators
  const validateCurrentTrade = useCallback(() => {
    if (teams.filter((t) => t.team).length < 2) {
      setResult(null);
      // P0-3: Clear isValidating since no validation will run (not enough teams)
      // This is intentional - if we don't have enough teams, there's nothing to validate
      setIsValidating(false);
      return null;
    }

    // P0-3: Set validating state before validation runs
    setIsValidating(true);

    // (Optional) last-second safety net: if any team is missing payroll, patch it (SSOT)
    const patchedTeams = teams.map((t) => {
      if (!t.team) return t;
      if (
        !Number.isFinite(t.team.teamTotalSalary) ||
        t.team.teamTotalSalary === 0
      ) {
        const { totalWithDead } = getCapTotalsForYear(t.team, yearKey);
        return {
          ...t,
          team: {
            ...t.team,
            teamTotalSalary: totalWithDead,
            projectedSalary: totalWithDead,
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
      legal: (canOverride && forceTrade) || validation.legal,
    };

    setResult(result);
    // P0-3: Clear validating state after validation completes
    setIsValidating(false);

    // Stale validation fix: Record the draft key that was validated
    // This is only set on explicit validation, not auto-validation
    // (Note: Auto-validation has been removed to fix the stale state bug)

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

  // REMOVED: Auto-validation effect was causing stale "Validated" state
  // Validation now ONLY happens when user clicks "Validate Trade" (explicit action)
  // See: docs/tradeMachine/return-packages/RP_validation_state_stale_fix_*.md

  // Manual validation trigger - the ONLY way validation should happen
  const handleValidate = useCallback(() => {
    const result = validateCurrentTrade();
    if (result) {
      // Stale validation fix: Record the draft key that was validated
      lastValidatedDraftKeyRef.current = currentDraftKey;
      validatedAtRef.current = Date.now();
      setPreviewOpen(true);
    }
  }, [validateCurrentTrade, currentDraftKey]);

  const exportCurrentTrade = useCallback(() => {
    const tradeData = teams
      .filter((t) => t.team)
      .map((t) => ({
        teamId: t.team.id,
        outgoingPlayers: t.sends,
        outgoingPicks: t.picksOut,
        // Phase 11.1: Include outgoing entitlements in trade export
        outgoingEntitlements: t.entitlementsOut || [],
        incomingPlayers:
          incomingAssets.find((a) => a.teamId === t.team.id)?.players || [],
        incomingPicks:
          incomingAssets.find((a) => a.teamId === t.team.id)?.picks || [],
        usedTradeExceptions: t.sends
          .filter((p) => p.acquiredViaTPE)
          .map((p) => p.tpeId),
      }));

    return tradeData;
  }, [teams, incomingAssets]);

  const resetTrade = useCallback(() => {
    setTeams((prev) =>
      prev.map((t) => ({ ...t, sends: [], picksOut: [], entitlementsOut: [] }))
    );
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
    // Phase 11.1: Expose entitlement toggle for trading
    toggleEntitlement,
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
    // P0-3: Expose validation in-flight state for UI loading indicators
    isValidating,
    // Stale validation fix: Expose current draft key state
    currentDraftKey,
    hasCurrentValidation,
    validatedAt: validatedAtRef.current,
    // Expose ref getter for validatedAt (needed since ref doesn't trigger re-render)
    getValidatedAt: () => validatedAtRef.current,
  };
};
