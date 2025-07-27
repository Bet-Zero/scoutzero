import { useState, useEffect, useMemo, useCallback } from 'react';
import { validateTrade } from '@/utils/architect/tradeMachine/tradeValidator';
import { loadTeamCapSheet } from '@/utils/architect/firebaseTeamPlanHelpers';
import { getSalaryForYear, areSamePick } from '@/utils/architect/tradeHelpers';
import { TeamMap } from '@/constants/teamList';

export const useTradeMachine = (
  primaryTeam,
  capProjections,
  currentYear,
  primaryTeamData = null
) => {
  // Main state
  const [teams, setTeams] = useState([]);
  const [result, setResult] = useState(null);
  const [forceTrade, setForceTrade] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
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
      return { players, picks };
    });
  }, [teams]);

  const salaryOut = useMemo(
    () => teams.map((t) => getSalaryForYear(t.sends, yearKey)),
    [teams, yearKey]
  );

  // Initialize teams
  useEffect(() => {
    const init = async () => {
      if (!primaryTeam) return;

      const baseTeam = TeamMap[primaryTeam];
      const data = primaryTeamData || (await loadTeamCapSheet(primaryTeam));

      if (baseTeam && data) {
        setTeams([
          {
            team: {
              ...baseTeam,
              ...data,
              tradeExceptions: data.tradeExceptions || [],
            },
            sends: [],
            picksOut: [],
          },
          { team: null, sends: [], picksOut: [] },
        ]);
      }
    };
    init();
  }, [primaryTeam, primaryTeamData]);

  // Core trade actions
  const setPlayerTrade = useCallback(
    (index, player, action, destTeamId = null) => {
      setTeams((prev) => {
        const newTeams = [...prev];
        const team = newTeams[index];
        const playerIndex = team.sends.findIndex((p) => p.id === player.id);

        switch (action) {
          case 'trade':
            if (playerIndex === -1) {
              newTeams[index].sends = [
                ...team.sends,
                { ...player, tradeTo: destTeamId, signAndTrade: false },
              ];
            } else {
              newTeams[index].sends[playerIndex].tradeTo = destTeamId;
            }
            break;

          case 'signAndTrade':
            if (playerIndex === -1) {
              newTeams[index].sends = [
                ...team.sends,
                { ...player, tradeTo: destTeamId, signAndTrade: true },
              ];
            } else {
              newTeams[index].sends[playerIndex].signAndTrade = true;
            }
            break;

          case 'keep':
            newTeams[index].sends = team.sends.filter(
              (p) => p.id !== player.id
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
  const selectTeam = useCallback(async (index, teamId) => {
    if (!teamId) {
      setTeams((prev) => {
        const newTeams = [...prev];
        newTeams[index] = { team: null, sends: [], picksOut: [] };
        return newTeams;
      });
      return;
    }

    const baseTeam = TeamMap[teamId];
    const data = await loadTeamCapSheet(teamId);

    if (baseTeam && data) {
      setTeams((prev) => {
        const newTeams = [...prev];
        newTeams[index] = {
          team: {
            ...baseTeam,
            ...data,
            tradeExceptions: data.tradeExceptions || [],
          },
          sends: [],
          picksOut: [],
        };
        return newTeams;
      });
    }
  }, []);

  const addTeam = useCallback(() => {
    if (teams.length >= 5) return;
    setTeams((prev) => [...prev, { team: null, sends: [], picksOut: [] }]);
  }, [teams.length]);

  const removeTeam = useCallback((index) => {
    setTeams((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Trade validation and execution
  const handleValidate = useCallback(() => {
    if (teams.filter((t) => t.team).length < 2) return;

    const validation = validateTrade({
      teams: teams
        .filter((t) => t.team)
        .map((t) => ({
          team: t.team,
          sends: t.sends,
          picksOut: t.picksOut,
          hardCapped: t.team.hardCapped,
        })),
      capProjections,
      currentYear,
    });

    setResult({
      ...validation,
      legal: forceTrade ? true : validation.overallLegal,
    });
    setPreviewOpen(true);
  }, [teams, capProjections, currentYear, forceTrade]);

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
        sends: t.sends.filter((p) => p.id !== player.id),
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
