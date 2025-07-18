import React, { useState } from 'react';
import { formatName } from '@/utils/formatting';
import { canSignFreeAgent } from '@/utils/architect/freeAgentLogic';
import { generateContract } from '@/utils/architect/contractUtils';

const FreeAgentPool = ({
  freeAgents,
  teamCapSheet,
  capProjections,
  currentYear,
  onSign,
  playersMap = {},
}) => {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [signResult, setSignResult] = useState(null);
  const [isSigning, setIsSigning] = useState(false);

  const handleSelect = (player) => {
    setSelectedPlayer(player);
    setSignResult(null);
  };

  const handleSign = async () => {
    const result = canSignFreeAgent(
      selectedPlayer,
      teamCapSheet,
      capProjections,
      currentYear
    );
    if (!result.allowed) {
      setSignResult(result);
      return;
    }

    const contract = generateContract({
      baseSalary: selectedPlayer.askingSalary,
      years: 3,
      raisePct: 0.05,
      options: {},
      startYear: currentYear,
    });
    setIsSigning(true);
    try {
      await onSign(selectedPlayer.name, contract);
      setSignResult({ allowed: true, message: 'Signed successfully!' });
    } catch (err) {
      console.error('Failed to sign player', err);
      setSignResult({ allowed: false, reason: 'Failed to sign player' });
    } finally {
      setIsSigning(false);
    }
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
              {playersMap[p.name]?.display_name || formatName(p.name)} – Asking:
              ${p.askingSalary.toLocaleString()} – Rights: {p.birdRights}
            </button>
          </li>
        ))}
      </ul>

      {selectedPlayer && (
        <div className="bg-[#1a1a1a] p-4 rounded border border-white/10 mb-3">
          <h3 className="font-semibold mb-1">
            {playersMap[selectedPlayer.name]?.display_name ||
              formatName(selectedPlayer.name)}
          </h3>
          <p className="text-sm mb-1">
            Asking: ${selectedPlayer.askingSalary.toLocaleString()}
          </p>
          <p className="text-sm mb-3">
            Bird Rights: {selectedPlayer.birdRights}
          </p>
          <button
            onClick={handleSign}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
          >
            Sign Player
          </button>
          {isSigning && (
            <p className="text-sm mt-1">Signing...</p>
          )}
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
