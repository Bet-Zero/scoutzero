import React, { useState } from 'react';
import { canSignFreeAgent, generateContract } from '../utils/freeAgentLogic';

const FreeAgentPool = ({ freeAgents, teamCapSheet, capSettings, currentYear, onSign }) => {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [signResult, setSignResult] = useState(null);

  const handleSelect = (player) => {
    setSelectedPlayer(player);
    setSignResult(null);
  };

  const handleSign = () => {
    const result = canSignFreeAgent(selectedPlayer, teamCapSheet, capSettings);
    if (!result.allowed) {
      setSignResult(result);
      return;
    }

    const contract = generateContract({
      baseSalary: selectedPlayer.askingSalary,
      years: 3,
      raisePct: 0.05,
      options: {},
      startYear: currentYear
    });

    onSign(selectedPlayer.name, contract);
    setSignResult({ allowed: true, message: 'Signed successfully!' });
  };

  return (
    <div className="free-agent-pool">
      <h2>Free Agent Pool</h2>
      <ul>
        {freeAgents.map((p) => (
          <li key={p.name}>
            <button onClick={() => handleSelect(p)}>
              {p.name} – Asking: ${p.askingSalary.toLocaleString()} – Rights: {p.birdRights}
            </button>
          </li>
        ))}
      </ul>

      {selectedPlayer && (
        <div className="fa-details">
          <h3>{selectedPlayer.name}</h3>
          <p>Asking: ${selectedPlayer.askingSalary.toLocaleString()}</p>
          <p>Bird Rights: {selectedPlayer.birdRights}</p>
          <button onClick={handleSign}>Sign Player</button>
        </div>
      )}

      {signResult && (
        <div style={{ marginTop: '10px' }}>
          {signResult.allowed ? (
            <span style={{ color: 'green' }}>{signResult.message}</span>
          ) : (
            <span style={{ color: 'red' }}>{signResult.reason}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default FreeAgentPool;