import { useState, useMemo } from 'react';
import { validateTrade } from '@/utils/architect/tradeValidator';
import { loadTeamCapSheet } from '@/utils/architect/firebaseHelpers';

const getSalaryForYear = (players, year) =>
  players.reduce(
    (sum, p) => sum + (p.contract_clean?.salaries_by_year?.[year]?.salary || 0),
    0
  );

const areSamePick = (a, b) =>
  a.year === b.year && a.round === b.round && (a.via || '') === (b.via || '');

export const useTradeMachine = ({ primaryTeam, capProjections, currentYear }) => {
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

  const loadTradeFromJSON = async (json) => {
    if (!Array.isArray(json)) return;
    const loaded = [];
    for (const entry of json) {
      const data = await loadTeamCapSheet(entry.teamId);
      if (!data) continue;

      const players = (entry.sends || [])
        .map((pid) =>
          (data.players || []).find(
            (p) => p.player_id === pid || p.id === pid || p.name === pid
          )
        )
        .filter(Boolean);

      const picks = (entry.picksOut || []).map((pick) => {
        const base =
          (data.picks || []).find(
            (p) =>
              p.year === pick.year &&
              p.round === pick.round &&
              (!pick.via || p.via === pick.via)
          ) || { year: pick.year, round: pick.round, via: pick.via };
        return { ...base, ...pick };
      });

      loaded.push({ team: data, sends: players, picksOut: picks });
    }

    while (loaded.length < 2) {
      loaded.push({ team: null, sends: [], picksOut: [] });
    }

    setTeams(loaded);
  };

  if (typeof window !== 'undefined') {
    window.loadTradeFromJSON = loadTradeFromJSON;
  }

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
        .map((t, idx) => {
          const receives = incoming[idx] || { players: [], picks: [] };
          const salaryIn =
            result?.teamResults?.[idx]?.salaryIn ??
            getSalaryForYear(receives.players, yearKey);
          const salaryOut =
            result?.teamResults?.[idx]?.salaryOut ??
            getSalaryForYear(t.sends, yearKey);
          return {
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
            receives: receives.players.map((p) => p.player_id || p.id || p.name),
            salaryIn,
            salaryOut,
          };
        }),
      overallLegal: result?.overallLegal ?? null,
      reason: result?.reason ?? '',
      teamSummaries: result?.summaryByTeamIndex ?? null,
    };

    console.log(JSON.stringify(exportObj, null, 2));
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

    const formatPick = (p) => {
      let str = `${p.year} ${p.round} Round`;
      if (p.via) str += ` (via ${p.via})`;
      if (p.protection) str += ` - ${p.protection}`;
      if (p.isSwap) str += ' (Swap)';
      if (p.note) str += ` - ${p.note}`;
      return str;
    };

    const summaryByTeamIndex = teams.map((t, idx) => {
      if (!t.team) return null;
      const incomingPlayers = [];
      const incomingPicks = [];
      teams.forEach((ot, j) => {
        if (j !== idx) {
          incomingPlayers.push(...ot.sends);
          incomingPicks.push(...ot.picksOut);
        }
      });
      const salaryOut = getSalary(t.sends);
      const salaryIn = getSalary(incomingPlayers);
      return {
        teamName: t.team.teamName,
        playersOut: t.sends.map((p) => p.name),
        playersIn: incomingPlayers.map((p) => p.name),
        picksOut: t.picksOut.map(formatPick),
        picksIn: incomingPicks.map(formatPick),
        rosterDelta: incomingPlayers.length - t.sends.length,
        capDelta: salaryIn - salaryOut,
      };
    });

    const finalResult = {
      ...validation,
      summary,
      summaryByTeamIndex,
      teamResults: validation.teamResults.map((r, idx) => ({
        ...r,
        teamName: r.teamName || teams[idx]?.team?.teamName,
      })),
    };
    finalResult.legal = forceTrade ? true : validation.overallLegal;
    setResult(finalResult);
  };

  const incomingAssets = useMemo(
    () =>
      teams.reduce((acc, _, idx) => {
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
      }, {}),
    [teams]
  );

  const capData = capProjections[currentYear] || {};

  const capImpactByTeamIndex = useMemo(
    () =>
      teams.reduce((acc, t, idx) => {
        if (!t.team) {
          acc[idx] = null;
          return acc;
        }
        const salaryOut = getSalaryForYear(t.sends, yearKey);
        const salaryIn = getSalaryForYear(incomingAssets[idx]?.players || [], yearKey);
        const currentSalary = getSalaryForYear(t.team.players || [], yearKey);
        const projected = currentSalary - salaryOut + salaryIn;

        const capStatus = projected > (capData.cap || 0) ? 'Over Cap' : 'Under Cap';
        let apronStatus = 'Under 1st Apron';
        if (projected > (capData.secondApron || 0)) {
          apronStatus = 'Over 2nd Apron';
        } else if (projected > (capData.firstApron || 0)) {
          apronStatus = 'Over 1st Apron';
        }

        acc[idx] = {
          in: salaryIn,
          out: salaryOut,
          current: currentSalary,
          projected,
          capStatus,
          apronStatus,
        };
        return acc;
      }, {}),
    [teams, capData, yearKey, incomingAssets]
  );

  const addLabels = {
    2: 'Add 3rd Team',
    3: 'Add 4th Team',
    4: 'Add 5th Team',
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
    incomingAssets,
    capImpactByTeamIndex,
    addLabels,
    yearKey,
  };
};

export default useTradeMachine;
