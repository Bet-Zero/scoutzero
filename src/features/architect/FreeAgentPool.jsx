import React, { useState } from 'react';
import { formatName } from '@/shared/utils/formatting';
import { canSignFreeAgent } from '@/features/architect/utils/freeAgentLogic';
import {
  generateDefaultFreeAgentContract,
} from '@/features/architect/utils/contractUtils';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import FreeAgentRow from './FreeAgentRow';
import EditContractModal from '@/shared/components/EditContractModal';

const FreeAgentPool = ({
  freeAgents,
  teamCapSheet,
  capProjections,
  currentYear,
  onSign,
  playersMap = {},
  playersById = {},
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
    // Build salariesByYear array with exact values from form (new schema format)
    const salariesByYear = [];
    for (let i = 0; i < values.years; i++) {
      const endYear = currentYear + i;
      const season = toSeasonCode(endYear);
      const salary = values.salaries[i] || 0;
      
      salariesByYear.push({
        season,
        salary,
        capHit: salary,
        guaranteed: true,
        guaranteedAmount: salary,
        option: null,
        optionUsed: null,
        tradeBonus: null,
      });
    }
    
    const totalValue = salariesByYear.reduce((sum, y) => sum + (y.salary || 0), 0);
    
    // Create contract with new salariesByYear array format
    const contract = {
      salariesByYear,
      totalValue,
      yearsLeft: values.years,
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
  const sortedAgents = [...freeAgents].sort(
    (a, b) => (b.previousSalary || 0) - (a.previousSalary || 0)
  );

  const normalizeLookupKey = (name) => {
    if (!name) return '';
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  };

  return (
    <div className="text-white">
      <h2 className="text-xl font-semibold mb-2">Free Agent Pool</h2>

      {/* Column Headers */}
      <div className="px-6 mb-1">
        <div className="flex items-center text-white/60 text-[11px] font-semibold h-5 mr-2">
          <div className="w-[45px] text-center">POS</div>
          <div className="w-[50px] text-center ml-1">TEAM</div>
          <div className="w-[50px]" />
          <div className="flex items-center ml-3 flex-1 justify-between mr-2">
            <span>PLAYER</span>
            <span className="pr-1">RIGHTS</span>
          </div>
          <div className="flex items-center justify-end w-[290px] mr-3 whitespace-nowrap">
            <span className="w-[44px] text-center">FA</span>
            <div className="ml-6 flex items-center gap-[8px]">
              <span className="w-[32px] text-right">HT</span>
              <span className="text-white/30">|</span>
              <span className="w-[56px] text-left">WT</span>
            </div>
            <span className="ml-10 w-[78px] text-right">PREV SAL</span>
          </div>
          <div className="w-[20px]" />
        </div>
      </div>

      {selectedPlayers.length > 0 && (
        <div className="bg-[#1a1a1a] p-4 rounded border border-white/10 mb-3 flex flex-wrap gap-3">
          {selectedPlayers.map((sp) => (
            <div key={sp.name} className="w-64">
              <h3 className="font-semibold mb-1">
                {sp.displayName || sp.bio?.displayName || sp.name}
              </h3>
              <p className="text-sm mb-1">
                Asking{' '}
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

      <ul className="space-y-[3px] mb-4 px-6">
        {sortedAgents.map((p) => {
          // Try to find full player data
          let playerData = null;
          
          // 1. Try ID lookup
          // Assuming playersById is passed as a prop or available in scope
          if (playersById && (p.id || p.player_id)) {
             playerData = playersById[p.id || p.player_id];
          }
          
          // 2. Fallback to name lookup
          if (!playerData) {
             playerData = playersMap[normalizeLookupKey(p.name)];
          }
          
          // 3. Fallback to basic object
          if (!playerData) {
             playerData = { name: p.name };
          }

          // Ensure we use the "fixed" name from p if the looked-up player has "Player Not Found"
          // or just always prefer p.name since we fixed it in GMDashboard
          if (p.name && p.name !== 'Player Not Found' && p.name !== 'Unknown') {
              // Create a shallow copy to avoid mutating the original ref
              playerData = { 
                  ...playerData, 
                  name: p.name,
                  bio: {
                      ...playerData.bio,
                      displayName: p.name
                  }
              };
          }

          return (
            <li key={p.id || p.player_id || p.name}>
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
