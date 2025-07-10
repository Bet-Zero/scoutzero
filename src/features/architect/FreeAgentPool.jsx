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
    <div className="text-white">
      <h2 className="text-xl font-semibold mb-2">Free Agent Pool</h2>
      <ul className="space-y-1 mb-4">
        {freeAgents.map((p) => (
          <li key={p.name}>
            <button
              onClick={() => handleSelect(p)}
              className="text-blue-400 hover:underline text-sm"
            >
              {p.name} – Asking: ${p.askingSalary.toLocaleString()} – Rights: {p.birdRights}
            </button>
          </li>
        ))}
      </ul>

      {selectedPlayer && (
        <div className="bg-[#1a1a1a] p-4 rounded border border-white/10 mb-3">
          <h3 className="font-semibold mb-1">{selectedPlayer.name}</h3>
          <p className="text-sm mb-1">Asking: ${selectedPlayer.askingSalary.toLocaleString()}</p>
          <p className="text-sm mb-3">Bird Rights: {selectedPlayer.birdRights}</p>
          <button
            onClick={handleSign}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
          >
            Sign Player
          </button>
        </div>
      )}

      {signResult && (
        <div className="mt-2 text-sm">
          {signResult.allowed ? (
            <span className="text-green-500">{signResult.message}</span>
          ) : (
            <span className="text-red-500">{signResult.reason}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default FreeAgentPool;