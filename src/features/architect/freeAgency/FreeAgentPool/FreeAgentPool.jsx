import React, { useState } from 'react';
import { formatName } from '@/shared/utils/formatting';
import { canSignFreeAgent } from '@/features/architect/utils/freeAgentLogic';
import {
  generateDefaultFreeAgentContract,
} from '@/features/architect/utils/contractUtils';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import FreeAgentCard from './FreeAgentCard';
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

  const handleRemove = (player) => {
      setSelectedPlayers((prev) => prev.filter((p) => p.name !== player.name));
  };
  
  // existing handleSign logic is mainly for direct signing which we are replacing with modal for the cards
  // but we might keep it if needed for other paths, but for cards we use setContractPlayer
  const handleSign = async (player) => {
    // ... existing logic if still used elsewhere ...
    // For now, minimizing changes to old functions unless dead code clearly defined
    // But since the user wants the card button to open the modal, we won't use this function for the card button.
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
      // ...
    } finally {
      setIsSigning(false);
    }
  };

  const handleSaveFromModal = async (playerObj, values) => {
    // Build salariesByYear array with exact values from form (new schema format)
    const salariesByYear = [];
    for (let i = 0; i < values.years; i++) {
        // ... (lines 80-95 same as before)
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
    
    // Also remove from selected players once signed
    setSelectedPlayers(prev => prev.filter(p => p.name !== playerObj.name));
  };


  const handleSignAndTrade = async (playerObj) => {
    // ... same as before
    const contract = generateDefaultFreeAgentContract(
        playerObj.askingSalary ?? playerObj.previousSalary ?? 0,
        currentYear,
        playerObj.yearsOfService || playerObj.yearsPro || 0
      );
      contract.signAndTrade = true;
      await onSign(playerObj, contract);
      setSelectedPlayers(prev => prev.filter(p => p.name !== playerObj.name));
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
        <div className="bg-[#1a1a1a] p-4 rounded border border-white/10 mb-3 flex flex-wrap gap-4">
          {selectedPlayers.map((sp) => (
             <FreeAgentCard 
                key={sp.name} 
                player={sp} 
                onSign={() => setContractPlayer(sp)}
                onRemove={handleRemove}
             />
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
