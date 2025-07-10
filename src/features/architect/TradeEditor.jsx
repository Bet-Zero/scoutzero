import React, { useState } from 'react';
import { validateTrade } from '../utils/tradeValidator';

const TradeEditor = ({ teamA, teamB, capSettings, currentYear }) => {
  const [teamASends, setTeamASends] = useState([]);
  const [teamBSends, setTeamBSends] = useState([]);
  const [teamAPicksOut, setTeamAPicksOut] = useState([]);
  const [teamBPicksOut, setTeamBPicksOut] = useState([]);
  const [result, setResult] = useState(null);

  const toggleItem = (item, list, setter) => {
    const exists = list.includes(item);
    const updated = exists ? 
      list.filter(i => i !== item) : 
      [...list, item];
    setter(updated);
  };

  const getSalary = (players) => 
    players.reduce((sum, p) => sum + (p.salaryByYear[currentYear] || 0), 0);

  const handleValidate = () => {
    const result = validateTrade({
      teamASends,
      teamBSends,
      teamAPicksOut,
      teamBPicksOut,
      capSettings,
      currentYear,
      teamAHardCapped: teamA.hardCapped,
      teamBHardCapped: teamB.hardCapped,
      teamA,
      teamB
    });
    setResult(result);
  };

  return (
    <div className="text-white">
      <h2 className="text-xl font-semibold mb-4">Trade Machine</h2>
      
      <div className="flex flex-col md:flex-row gap-6">
        {/* Team A */}
        <div className="flex-1">
          <h3 className="font-semibold mb-1">{teamA.teamName}</h3>
          <strong>Players:</strong>
          <ul className="mb-2">
            {teamA.activeContracts.map((p) => (
              <li key={p.name} className="text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={teamASends.includes(p)}
                    onChange={() => toggleItem(p, teamASends, setTeamASends)}
                  />
                  {p.name} – ${p.salaryByYear[currentYear]?.toLocaleString() || 0}
                  {p.signAndTrade && ' (Sign & Trade)'}
                </label>
              </li>
            ))}
          </ul>
          
          <strong>Picks:</strong>
          <ul className="mb-2">
            {teamA.picks?.map((pick) => (
              <li key={`${pick.year}-${pick.round}`} className="text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={teamAPicksOut.includes(pick)}
                    onChange={() => toggleItem(pick, teamAPicksOut, setTeamAPicksOut)}
                  />
                  {pick.year} {pick.round} Round {pick.via ? `(via ${pick.via})` : ''}
                </label>
              </li>
            ))}
          </ul>
          
          <p className="text-sm"><strong>Total Salary:</strong> ${getSalary(teamASends).toLocaleString()}</p>
        </div>
        
        {/* Team B */}
        <div className="flex-1">
          <h3 className="font-semibold mb-1">{teamB.teamName}</h3>
          <strong>Players:</strong>
          <ul className="mb-2">
            {teamB.activeContracts.map((p) => (
              <li key={p.name} className="text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={teamBSends.includes(p)}
                    onChange={() => toggleItem(p, teamBSends, setTeamBSends)}
                  />
                  {p.name} – ${p.salaryByYear[currentYear]?.toLocaleString() || 0}
                </label>
              </li>
            ))}
          </ul>
          
          <strong>Picks:</strong>
          <ul className="mb-2">
            {teamB.picks?.map((pick) => (
              <li key={`${pick.year}-${pick.round}`} className="text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={teamBPicksOut.includes(pick)}
                    onChange={() => toggleItem(pick, teamBPicksOut, setTeamBPicksOut)}
                  />
                  {pick.year} {pick.round} Round {pick.via ? `(via ${pick.via})` : ''}
                </label>
              </li>
            ))}
          </ul>
          
          <p className="text-sm"><strong>Total Salary:</strong> ${getSalary(teamBSends).toLocaleString()}</p>
        </div>
      </div>

      <button
        onClick={handleValidate}
        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
      >
        Validate Trade
      </button>

      {result && (
        <div className="mt-4 text-sm">
          <strong>{result.legal ? '✅ Trade Approved' : '❌ Trade Rejected'}</strong>
          <p>{result.reason || 'Trade complies with all rules.'}</p>
        </div>
      )}
    </div>
  );
};

export default TradeEditor;