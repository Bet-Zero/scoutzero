import React, { useState } from 'react';
import { formatName } from '@/utils/formatting';
import { canSignFreeAgent } from '@/utils/architect/freeAgentLogic';
import { generateDefaultFreeAgentContract } from '@/utils/architect/contractUtils';
import FreeAgentRow from './FreeAgentRow';
import EditContractModal from '@/components/shared/EditContractModal';

const FreeAgentPool = ({
  freeAgents,
  teamCapSheet,
  capProjections,
  currentYear,
  onSign,
  playersMap = {},
}) => {
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [signResults, setSignResults] = useState({});
  const [isSigning, setIsSigning] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [contractPlayer, setContractPlayer] = useState(null);

  const handleSelect = (player) => {
    setSelectedPlayers((prev) => {
      const exists = prev.some((p) => p.name === player.name);
      if (exists) {
        return prev.filter((p) => p.name !== player.name);
      }
      return [...prev, player];
    });
    setSignResults((prev) => ({ ...prev, [player.name]: null }));
  };

  const handleSign = async (player) => {
    const result = canSignFreeAgent(
      player,
      teamCapSheet,
      capProjections,
      currentYear
    );
    if (!result.allowed) {
      setSignResults((prev) => ({ ...prev, [player.name]: result }));
      return;
    }

    const contract = generateDefaultFreeAgentContract(
      player.askingSalary ?? 0,
      currentYear,
      player.yearsOfService || player.yearsPro || 0
    );

    setIsSigning(true);
    try {
      await onSign(player, contract);
      setSignResults((prev) => ({
        ...prev,
        [player.name]: {
          allowed: true,
          message: `Signed ${formatName(player.name)} to 1-year deal`,
        },
      }));
      setSelectedPlayers((prev) => prev.filter((p) => p.name !== player.name));
    } catch (err) {
      console.error('Failed to sign player', err);
      setSignResults((prev) => ({
        ...prev,
        [player.name]: { allowed: false, reason: 'Failed to sign player' },
      }));
    } finally {
      setIsSigning(false);
    }
  };

  const handleSaveFromModal = async (playerObj, values) => {
    const salaryByYear = {};
    for (let i = 0; i < values.years; i++) {
      salaryByYear[currentYear + i] = values.salaries[i] || 0;
    }
    const contract = {
      salaryByYear,
      options: {},
      signAndTrade: false,
      guaranteed: true,
      isMinimum: values.salaries[0] <= 2200000,
      yearsOfService: playerObj.yearsOfService || playerObj.yearsPro || 0,
    };
    await onSign(playerObj, contract);
  };

  const handleSignAndTrade = async (playerObj) => {
    const contract = generateDefaultFreeAgentContract(
      playerObj.askingSalary ?? playerObj.previousSalary ?? 0,
      currentYear,
      playerObj.yearsOfService || playerObj.yearsPro || 0
    );
    contract.signAndTrade = true;
    await onSign(playerObj, contract);
  };

  return (
    <div className="text-white">
      <h2 className="text-xl font-semibold mb-2">Free Agent Pool</h2>
      <ul className="space-y-[3px] mb-4 px-6">
        {freeAgents.map((p) => {
          const playerData = playersMap[p.name] || { name: p.name };
          return (
            <li key={p.name}>
              <FreeAgentRow
                player={playerData}
                askInfo={p}
                onSelect={() => handleSelect(p)}
                isSelected={selectedPlayers.some((sp) => sp.name === p.name)}
                openMenu={openMenu}
                setOpenMenu={setOpenMenu}
                onSign={() => {
                  setContractPlayer(p);
                }}
              />
            </li>
          );
        })}
      </ul>

      {selectedPlayers.length > 0 && (
        <div className="bg-[#1a1a1a] p-4 rounded border border-white/10 mb-3 flex flex-wrap gap-3">
          {selectedPlayers.map((sp) => (
            <div key={sp.name} className="w-64">
              <h3 className="font-semibold mb-1">
                {playersMap[sp.name]?.display_name || formatName(sp.name)}
              </h3>
              <p className="text-sm mb-1">
                Asking:{' '}
                {sp.previousSalary != null
                  ? `$${sp.previousSalary.toLocaleString()}`
                  : 'N/A'}
              </p>
              <p className="text-sm mb-3">Bird Rights: {sp.birdRights}</p>
              <button
                onClick={() => handleSign(sp)}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                disabled={isSigning}
              >
                {isSigning ? 'Signing...' : 'Sign Player'}
              </button>
              {signResults[sp.name] && (
                <div className="mt-1 text-sm">
                  {signResults[sp.name].allowed ? (
                    <span className="text-green-500">
                      {signResults[sp.name].message}
                    </span>
                  ) : (
                    <span className="text-red-500">
                      {signResults[sp.name].reason}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {contractPlayer && (
        <EditContractModal
          player={
            playersMap[contractPlayer.name] || { name: contractPlayer.name }
          }
          isOpen={!!contractPlayer}
          onClose={() => setContractPlayer(null)}
          onSave={handleSaveFromModal}
          onSignAndTrade={() => handleSignAndTrade(contractPlayer)}
          actionsOverride={['resign', 'signAndTrade']}
          actionLabelsOverride={{ resign: 'Sign Free Agent' }}
        />
      )}
    </div>
  );
};

export default FreeAgentPool;
