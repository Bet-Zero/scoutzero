// useTradeMachine.js

import { useState, useMemo } from 'react';
import { validateTrade } from '@/utils/architect/tradeMachine/tradeValidator';
import { loadTeamCapSheet } from '@/utils/architect/firebaseHelpers';
import {
  getSalaryForYear,
  areSamePick,
  formatPick,
} from '@/utils/architect/tradeHelpers';

export const useTradeMachine = (primaryTeam, capProjections, currentYear) => {
  const [teams, setTeams] = useState([
    { team: primaryTeam, sends: [], picksOut: [] },
    { team: null, sends: [], picksOut: [] },
  ]);
  const [result, setResult] = useState(null);
  const [forceTrade, setForceTrade] = useState(false);

  const yearKey = currentYear;

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
    const data = await loadTeamCapSheet(teamId);
    if (data) {
      setTeams((prev) => {
        const copy = [...prev];
        copy[index] = { team: data, sends: [], picksOut: [] };
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
    const incoming = teams.reduce((acc, _, idx) => {
      const players = [];
      const picks = [];
      teams.forEach((t, j) => {
        if (j !== idx) {
          players.push(...t.sends);
          picks.push(...t.picksOut);
        }
      });
      acc[idx] = { players, picks };
      return acc;
    }, {});

    const exportObj = {
      teams: teams
        .filter((t) => t.team)
        .map((t, idx) => ({
          teamId: t.team.teamId || t.team.id,
          sends: t.sends.map((p) => p.player_id || p.id || p.name),
          picksOut: t.picksOut.map((p) => ({
            year: p.year,
            round: p.round,
            protection: p.protection,
            isSwap: p.isSwap,
            note: p.note,
            via: p.via,
          })),
          receives: incoming[idx]?.players.map(
            (p) => p.player_id || p.id || p.name
          ),
        })),
      overallLegal: result?.overallLegal ?? null,
      reason: result?.reason ?? '',
    };

    console.log(JSON.stringify(exportObj, null, 2));
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
