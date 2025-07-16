import React, { useState } from 'react';
import { validateTrade } from '@/utils/architect/tradeValidator';
import { loadTeamCapSheet } from '@/utils/architect/firebaseHelpers';
import TradeTeamBlock from './TradeTeamBlock';

const TradeEditor = ({ primaryTeam, capProjections, currentYear }) => {
  const [teams, setTeams] = useState([
    { team: primaryTeam, sends: [], picksOut: [] },
    { team: null, sends: [], picksOut: [] },
  ]);
  const [result, setResult] = useState(null);
  const yearKey = currentYear;

  const togglePlayer = (index, player) => {
    setTeams((prev) => {
      const copy = [...prev];
      const list = copy[index].sends;
      const exists = list.includes(player);
      copy[index].sends = exists
        ? list.filter((i) => i !== player)
        : [...list, player];
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
    const result = validateTrade({
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
    setResult(result);
  };

  const addLabels = {
    2: 'Add 3rd Team',
    3: 'Add 4th Team',
    4: 'Add 5th Team',
  };

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
            yearKey={yearKey}
            onTogglePlayer={(p) => togglePlayer(idx, p)}
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
        </div>
      )}
    </div>
  );
};

export default TradeEditor;
