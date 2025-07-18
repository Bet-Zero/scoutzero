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
  const yearKey = currentYear;

  const setPlayerTrade = (index, player, action) => {
    setTeams((prev) => {
      const copy = [...prev];
      const list = copy[index].sends;
      const exists = list.includes(player);
      if (action === 'trade' && !exists) {
        copy[index].sends = [...list, player];
      } else if (action === 'keep' && exists) {
        copy[index].sends = list.filter((i) => i !== player);
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
    const a = teams[0];
    const b = teams[1];
    const validation = validateTrade({
      teamASends: a.sends,
      teamBSends: b.sends,
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

    setResult({ ...validation, summary });
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
      {result && (
        <div className="mt-4 text-sm">
          <strong>
            {result.legal ? '✅ Trade Approved' : '❌ Trade Rejected'}
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
