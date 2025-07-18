import React, { useState } from 'react';
import { validateTrade } from '@/utils/architect/tradeValidator';
import { loadTeamCapSheet } from '@/utils/architect/firebaseHelpers';
import TradeTeamBlock from './TradeTeamBlock';

// Helper to sum salaries for a given year
const getSalaryForYear = (players, year) =>
  players.reduce(
    (sum, p) => sum + (p.contract_clean?.salaries_by_year?.[year]?.salary || 0),
    0
  );

const TradeEditor = ({ primaryTeam, capProjections, currentYear }) => {
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
      const exists = list.includes(pick);
      copy[index].picksOut = exists
        ? list.filter((i) => i !== pick)
        : [...list, pick];
      return copy;
    });
  };

  const updatePickField = (index, pick, field, value) => {
    setTeams((prev) => {
      const copy = [...prev];
      const pickObj = copy[index].picksOut.find((p) => p === pick);
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
        const base = (data.picks || []).find(
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

  // Expose for development testing
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
            receives: receives.players.map(
              (p) => p.player_id || p.id || p.name
            ),
            salaryIn,
            salaryOut,
          };
        }),
      overallLegal: result?.overallLegal ?? null,
      reason: result?.reason ?? '',
    };

    console.log(JSON.stringify(exportObj, null, 2));
  };

  const handleValidate = () => {
    if (teams.length < 2 || !teams[0].team || !teams[1].team) return;
    const a = teams[0];
    const b = teams[1];
    const validation = validateTrade({
      teamASends: a.sends.map((p) => ({
        ...p,
        signAndTrade: !!p.signAndTrade,
      })),
      teamBSends: b.sends.map((p) => ({
        ...p,
        signAndTrade: !!p.signAndTrade,
      })),
      teamAPicksOut: a.picksOut,
      teamBPicksOut: b.picksOut,
      capProjections,
      currentYear,
      teamAHardCapped: a.team.hardCapped,
      teamBHardCapped: b.team.hardCapped,
      teamA: a.team,
      teamB: b.team,
    });

    const getSalary = (players) => getSalaryForYear(players, yearKey);

    const summary = {
      teamAOut: a.sends.map((p) => p.name),
      teamBOut: b.sends.map((p) => p.name),
      teamASalaryOut: getSalary(a.sends),
      teamBSalaryOut: getSalary(b.sends),
      teamASalaryIn: getSalary(b.sends),
      teamBSalaryIn: getSalary(a.sends),
    };

    const finalResult = { ...validation, summary };
    finalResult.legal = forceTrade ? true : validation.overallLegal;
    setResult(finalResult);
  };

  const addLabels = {
    2: 'Add 3rd Team',
    3: 'Add 4th Team',
    4: 'Add 5th Team',
  };

  const incomingAssets = teams.reduce((acc, _, idx) => {
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

  const capData = capProjections[currentYear] || {};

  const capImpactByTeamIndex = teams.reduce((acc, t, idx) => {
    if (!t.team) {
      acc[idx] = null;
      return acc;
    }
    const salaryOut = getSalaryForYear(t.sends, yearKey);
    const salaryIn = getSalaryForYear(
      incomingAssets[idx]?.players || [],
      yearKey
    );
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
  }, {});

  return (
    <div className="text-white">
      <h2 className="text-xl font-semibold mb-4">Trade Machine</h2>
      <div className="flex flex-col md:flex-row gap-6">
        {teams.map((t, idx) => (
          <TradeTeamBlock
            key={idx}
            team={t.team}
            sends={t.sends}
            picks={t.picksOut}
            incomingPlayers={incomingAssets[idx]?.players || []}
            incomingPicks={incomingAssets[idx]?.picks || []}
            yearKey={yearKey}
            capImpact={capImpactByTeamIndex[idx]}
            tradePartnerName={
              teams.length > 1 ? teams[idx === 0 ? 1 : 0]?.team?.teamName : ''
            }
            onSetPlayerTrade={(p, action) => setPlayerTrade(idx, p, action)}
            onTogglePick={(p) => togglePick(idx, p)}
            onEditPick={(p, field, value) =>
              updatePickField(idx, p, field, value)
            }
            onSelectTeam={(teamId) => selectTeam(idx, teamId)}
            onRemove={() => removeTeam(idx)}
          />
        ))}
      </div>
      {teams.length < 5 && (
        <button
          onClick={addTeam}
          className="mt-2 bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-sm"
        >
          {addLabels[teams.length] || 'Add Team'}
        </button>
      )}
      <button
        onClick={handleValidate}
        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
      >
        Validate Trade
      </button>
      <label className="flex items-center gap-2 mt-2 text-sm">
        <input
          type="checkbox"
          checked={forceTrade}
          onChange={() => setForceTrade(!forceTrade)}
        />
        Force Trade (ignore validation)
      </label>
      <button
        onClick={exportCurrentTrade}
        className="mt-2 bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-sm"
      >
        Export Trade JSON
      </button>
      {result && (
        <div className="mt-4 text-sm">
          <strong>
            {forceTrade
              ? '⚠️ Trade Forced – Not CBA Legal'
              : result.legal
                ? '✅ Trade Approved'
                : '❌ Trade Rejected'}
          </strong>
          <p>{result.reason || 'Trade complies with all rules.'}</p>
          {result.summary && (
            <div className="mt-2 space-y-1">
              <p>
                <strong>{teams[0].team.teamName} send:</strong>{' '}
                {result.summary.teamAOut.join(', ') || 'None'}
              </p>
              <p>
                <strong>{teams[1].team.teamName} send:</strong>{' '}
                {result.summary.teamBOut.join(', ') || 'None'}
              </p>
              <p>
                {teams[0].team.teamName} - Salary Out: $
                {result.summary.teamASalaryOut.toLocaleString()} | Salary In: $
                {result.summary.teamASalaryIn.toLocaleString()}
              </p>
              <p>
                {teams[1].team.teamName} - Salary Out: $
                {result.summary.teamBSalaryOut.toLocaleString()} | Salary In: $
                {result.summary.teamBSalaryIn.toLocaleString()}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TradeEditor;
