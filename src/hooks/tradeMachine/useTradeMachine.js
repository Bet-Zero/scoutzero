// useTradeMachine.js

import { useState, useEffect } from 'react';
import { validateTrade } from '@/utils/architect/tradeMachine/tradeValidator';
import { loadTeamCapSheet } from '@/utils/architect/firebaseTeamPlanHelpers';
import { getSalaryForYear, areSamePick } from '@/utils/architect/tradeHelpers';
import { TeamMap } from '@/constants/teamList';

export const useTradeMachine = (primaryTeam, capProjections, currentYear) => {
  const [teams, setTeams] = useState([]);
  const [result, setResult] = useState(null);
  const [forceTrade, setForceTrade] = useState(false);
  const yearKey = currentYear;

  useEffect(() => {
    const init = async () => {
      if (!primaryTeam || typeof primaryTeam !== 'string') return;

      const baseTeam = TeamMap[primaryTeam];
      const data = await loadTeamCapSheet(primaryTeam);

      if (baseTeam && data) {
        setTeams([
          { team: { ...baseTeam, ...data }, sends: [], picksOut: [] },
          { team: null, sends: [], picksOut: [] },
        ]);
      }
    };
    init();
  }, [primaryTeam]);

  const setPlayerTrade = (index, player, action, flag = false) => {
    setTeams((prev) => {
      const copy = [...prev];
      const list = copy[index].sends;
      const exists = list.includes(player);
      if (action === 'trade' && !exists) {
        player.signAndTrade = false;
        copy[index].sends = [...list, player];
      } else if (action === 'keep' && exists) {
        player.signAndTrade = false;
        copy[index].sends = list.filter((i) => i !== player);
      } else if (action === 'signAndTrade' && exists) {
        player.signAndTrade = flag;
      }
      return copy;
    });
  };

  const togglePick = (index, pick) => {
    setTeams((prev) => {
      const copy = [...prev];
      const list = copy[index].picksOut;
      const exists = list.some((p) => areSamePick(p, pick));
      copy[index].picksOut = exists
        ? list.filter((i) => !areSamePick(i, pick))
        : [...list, { ...pick }];
      return copy;
    });
  };

  const updatePickField = (index, pick, field, value) => {
    setTeams((prev) => {
      const copy = [...prev];
      const pickObj = copy[index].picksOut.find((p) => areSamePick(p, pick));
      if (pickObj) {
        pickObj[field] = value;
      }
      return copy;
    });
  };

  const selectTeam = async (index, teamId) => {
    if (!teamId) {
      setTeams((prev) => {
        const copy = [...prev];
        copy[index] = { team: null, sends: [], picksOut: [] };
        return copy;
      });
      return;
    }

    const baseTeam = TeamMap[teamId];
    const data = await loadTeamCapSheet(teamId);

    if (baseTeam && data) {
      setTeams((prev) => {
        const copy = [...prev];
        copy[index] = {
          team: { ...baseTeam, ...data },
          sends: [],
          picksOut: [],
        };
        return copy;
      });
    }
  };

  const addTeam = () => {
    if (teams.length >= 5) return;
    setTeams([...teams, { team: null, sends: [], picksOut: [] }]);
  };

  const removeTeam = (index) => {
    setTeams((prev) => prev.filter((_, i) => i !== index));
  };

  const handleValidate = () => {
    if (teams.length < 2 || !teams[0].team || !teams[1].team) return;

    const preparedTeams = teams
      .map((t) =>
        t.team
          ? {
              team: t.team,
              sends: t.sends.map((p) => ({
                ...p,
                signAndTrade: !!p.signAndTrade,
              })),
              picksOut: t.picksOut,
              hardCapped: t.team.hardCapped,
            }
          : null
      )
      .filter(Boolean);

    const validation = validateTrade({
      teams: preparedTeams,
      capProjections,
      currentYear,
    });

    const getSalary = (players) => getSalaryForYear(players, yearKey);

    let summary = null;
    if (preparedTeams.length === 2) {
      const a = preparedTeams[0];
      const b = preparedTeams[1];
      summary = {
        teamAOut: a.sends.map((p) => p.name),
        teamBOut: b.sends.map((p) => p.name),
        teamASalaryOut: getSalary(a.sends),
        teamBSalaryOut: getSalary(b.sends),
        teamASalaryIn: getSalary(b.sends),
        teamBSalaryIn: getSalary(a.sends),
      };
    }

    const finalResult = {
      ...validation,
      summary,
      legal: forceTrade ? true : validation.overallLegal,
    };

    setResult(finalResult);
  };

  const exportCurrentTrade = () => {
    if (teams.length < 2) return null;

    const result = teams.map((t, idx) => {
      if (!t.team) return null;

      const incomingPlayers = [];
      const incomingPicks = [];

      teams.forEach((other, j) => {
        if (j !== idx && other.team) {
          incomingPlayers.push(...other.sends);
          other.picksOut.forEach((p) => {
            if (
              !p.toTeamId ||
              p.toTeamId === t.team.id ||
              p.toTeamId === t.team.teamId
            ) {
              incomingPicks.push(p);
            }
          });
        }
      });

      return {
        teamId: t.team.teamId || t.team.id,
        incoming: incomingPlayers,
        outgoing: t.sends,
        picksIn: incomingPicks,
        picksOut: t.picksOut,
      };
    });

    return result.filter(Boolean);
  };

  const resetTrade = () => {
    setTeams([
      { team: primaryTeam, sends: [], picksOut: [] },
      { team: null, sends: [], picksOut: [] },
    ]);
    setResult(null);
    setForceTrade(false);
  };

  return {
    teams,
    result,
    forceTrade,
    setForceTrade,
    setPlayerTrade,
    togglePick,
    updatePickField,
    selectTeam,
    addTeam,
    removeTeam,
    handleValidate,
    exportCurrentTrade,
    resetTrade,
    yearKey,
  };
};
