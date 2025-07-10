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
    <div className="trade-editor">
      <h2>Trade Machine</h2>
      
      <div className="trade-boxes">
        {/* Team A */}
        <div>
          <h3>{teamA.teamName}</h3>
          <strong>Players:</strong>
          <ul>
            {teamA.activeContracts.map((p) => (
              <li key={p.name}>
                <label>
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
          <ul>
            {teamA.picks?.map((pick) => (
              <li key={`${pick.year}-${pick.round}`}>
                <label>
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
          
          <p><strong>Total Salary:</strong> ${getSalary(teamASends).toLocaleString()}</p>
        </div>
        
        {/* Team B */}
        <div>
          <h3>{teamB.teamName}</h3>
          <strong>Players:</strong>
          <ul>
            {teamB.activeContracts.map((p) => (
              <li key={p.name}>
                <label>
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
          <ul>
            {teamB.picks?.map((pick) => (
              <li key={`${pick.year}-${pick.round}`}>
                <label>
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
          
          <p><strong>Total Salary:</strong> ${getSalary(teamBSends).toLocaleString()}</p>
        </div>
      </div>
      
      <button onClick={handleValidate}>Validate Trade</button>
      
      {result && (
        <div className="trade-result" style={{ marginTop: '15px' }}>
          <strong>{result.legal ? '✅ Trade Approved' : '❌ Trade Rejected'}</strong>
          <p>{result.reason || 'Trade complies with all rules.'}</p>
        </div>
      )}
    </div>
  );
};

export default TradeEditor;