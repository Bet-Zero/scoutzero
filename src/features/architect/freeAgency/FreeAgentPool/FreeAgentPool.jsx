import React, { useMemo, useState } from 'react';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import FreeAgentRow from './FreeAgentRow';
import { FreeAgentPoolHeader } from './FreeAgentPoolHeader';
import { SelectedFreeAgentCards } from './SelectedFreeAgentCards';
import { FreeAgencyFilterBar } from './FreeAgencyFilterBar';
import EditContractModal from '@/shared/components/EditContractModal';
import { applyFreeAgencyFilters } from '@/shared/utils/filtering/freeAgencyFilterUtils';
import { useFreeAgencyFilterPersistence } from '@/features/architect/freeAgency/useFreeAgencyFilterPersistence';
const normalizeLookupKey = (name) => {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
};

const resolvePlayerData = (freeAgent, playersMap, playersById) => {
  const playerId = freeAgent.id || freeAgent.player_id;

  let playerData = (playerId && playersById?.[playerId]) ||
    playersMap?.[freeAgent.name] ||
    playersMap?.[normalizeLookupKey(freeAgent.name)] || {
      name: freeAgent.name,
    };

  if (freeAgent.name && freeAgent.name !== 'Player Not Found') {
    playerData = {
      ...playerData,
      name: freeAgent.name,
      bio: {
        ...playerData.bio,
        displayName: freeAgent.name,
      },
    };
  }

  return playerData;
};

const FreeAgentPool = ({
  freeAgents,
  currentYear,
  onSign,
  onSignAndTrade,
  onStoreOfferSheet = null,
  playersMap = {},
  playersById = {},
  worldId = null,
}) => {
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [, setSignResults] = useState({});
  const [openMenu, setOpenMenu] = useState(null);
  const [contractPlayer, setContractPlayer] = useState(null);
  const { filterState, updateFilterState, clearFilters } =
    useFreeAgencyFilterPersistence();

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

  const handleSaveFromModal = async (playerObj, values) => {
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

    const totalValue = salariesByYear.reduce(
      (sum, y) => sum + (y.salary || 0),
      0
    );

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

    const result = await onSign(playerObj, contract);
    if (result?.success === false) {
      return result;
    }

    setSelectedPlayers((prev) => prev.filter((p) => p.name !== playerObj.name));
    return { success: true };
  };

  const allAgents = freeAgents || [];

  const filteredAgents = useMemo(
    () => applyFreeAgencyFilters(allAgents, filterState),
    [allAgents, filterState]
  );

  const selectedNames = useMemo(
    () => new Set(selectedPlayers.map((player) => player.name)),
    [selectedPlayers]
  );

  return (
    <div className="text-white">
      <h2 className="text-xl font-semibold mb-2">Free Agent Pool</h2>
      <FreeAgencyFilterBar
        filters={filterState}
        onChange={updateFilterState}
        onClear={clearFilters}
        filteredCount={filteredAgents.length}
        totalCount={allAgents.length}
      />

      <FreeAgentPoolHeader />

      <SelectedFreeAgentCards
        selectedPlayers={selectedPlayers}
        onSign={setContractPlayer}
        onRemove={handleRemove}
      />

      <ul className="space-y-[3px] mb-4 px-6">
        {filteredAgents.length === 0 ? (
          <li className="text-center text-sm text-white/60 py-4">No matches</li>
        ) : (
          filteredAgents.map((freeAgent) => {
            const playerData = resolvePlayerData(
              freeAgent,
              playersMap,
              playersById
            );

            return (
              <li key={freeAgent.id || freeAgent.player_id || freeAgent.name}>
                <FreeAgentRow
                  player={playerData}
                  askInfo={freeAgent}
                  onSelect={() => handleSelect(freeAgent)}
                  isSelected={selectedNames.has(freeAgent.name)}
                  openMenu={openMenu}
                  setOpenMenu={setOpenMenu}
                  onSign={() => setContractPlayer(freeAgent)}
                />
              </li>
            );
          })
        )}
      </ul>

      {contractPlayer && (
        <EditContractModal
          player={
            playersMap[contractPlayer.name] ||
            playersMap[normalizeLookupKey(contractPlayer.name)] || {
              name: contractPlayer.name,
            }
          }
          isOpen={!!contractPlayer}
          onClose={() => setContractPlayer(null)}
          onSave={handleSaveFromModal}
          onSignAndTrade={onSignAndTrade}
          onStoreOfferSheet={worldId ? onStoreOfferSheet : null}
          actionsOverride={worldId ? ['signNew', 'signAndTrade'] : ['signNew']}
          actionLabelsOverride={{ signNew: 'Sign Free Agent' }}
        />
      )}
    </div>
  );
};

export default FreeAgentPool;
