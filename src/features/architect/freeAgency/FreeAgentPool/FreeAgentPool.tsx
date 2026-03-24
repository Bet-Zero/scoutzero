/**
 * FILE: src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.tsx
 * PURPOSE: Authoritative Architect Free Agent Pool surface with selection and contract modal wiring.
 * OWNERSHIP: Feature: architect/freeAgency
 *
 * HISTORY:
 *  - 2026-03-14: Migrated from JSX during TM_VALIDATOR_TS_FREE_AGENT_POOL_SURFACE_E86 execution.
 *
 * LINKS:
 *  - Return Package: return_packages/trade_machine/TM_VALIDATOR_TS_FREE_AGENT_POOL_SURFACE_E86_RETURN_PACKAGE.md
 *  - Master Doc: docs/architect/TRADE_MACHINE_MASTER.md
 */
import React, { useMemo, useState } from 'react';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import EditContractModal from '@/shared/components/EditContractModal';
import { applyFreeAgencyFilters } from '@/shared/utils/filtering/freeAgencyFilterUtils';
import { useFreeAgencyFilterPersistence } from '@/features/architect/freeAgency/useFreeAgencyFilterPersistence';
import FreeAgentRow from './FreeAgentRow';
import { FreeAgentPoolHeader } from './FreeAgentPoolHeader';
import { SelectedFreeAgentCards } from './SelectedFreeAgentCards';
import { FreeAgencyFilterBar } from './FreeAgencyFilterBar';
import type {
  FreeAgentActionResult,
  FreeAgentContractFormValues,
  FreeAgentListItem,
  FreeAgentLookupPlayer,
  FreeAgentPoolProps,
  ResolvedFreeAgentPlayer,
} from './types';

type EditContractModalProps = Parameters<typeof EditContractModal>[0];

const normalizeLookupKey = (name?: string) => {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
};

const resolvePlayerData = (
  freeAgent: FreeAgentListItem,
  playersMap: Record<string, FreeAgentLookupPlayer>,
  playersById: Record<string, FreeAgentLookupPlayer>
): ResolvedFreeAgentPlayer => {
  const playerId = freeAgent.id || freeAgent.player_id;

  let playerData =
    (playerId && playersById?.[playerId as string]) ||
    playersMap?.[freeAgent.name as string] ||
    playersMap?.[normalizeLookupKey(freeAgent.name)] || {
      name: freeAgent.name,
    };

  if (freeAgent.name && freeAgent.name !== 'Player Not Found') {
    playerData = {
      ...playerData,
      name: freeAgent.name,
      bio: {
        ...(playerData.bio || {}),
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
  getSignAndTradePreflight = null,
  getOfferSheetPreflight = null,
  onStoreOfferSheet = null,
  playersMap = {},
  playersById = {},
  worldId = null,
}: FreeAgentPoolProps) => {
  const [selectedPlayers, setSelectedPlayers] = useState<FreeAgentListItem[]>(
    []
  );
  const [, setSignResults] = useState<
    Record<string, FreeAgentActionResult | null>
  >({});
  const [openMenu, setOpenMenu] = useState<string | null | undefined>(null);
  const [contractPlayer, setContractPlayer] = useState<FreeAgentListItem | null>(
    null
  );
  const { filterState, updateFilterState, clearFilters } =
    useFreeAgencyFilterPersistence();

  const handleSelect = (player: FreeAgentListItem) => {
    setSelectedPlayers((prev) => {
      const exists = prev.some((p) => p.name === player.name);
      if (exists) {
        return prev.filter((p) => p.name !== player.name);
      }
      return [...prev, player];
    });
    setSignResults((prev) => ({ ...prev, [player.name as string]: null }));
  };

  const handleRemove = (player: FreeAgentListItem) => {
    setSelectedPlayers((prev) => prev.filter((p) => p.name !== player.name));
  };

  const handleSaveFromModal = async (
    playerObj: FreeAgentListItem,
    values: FreeAgentContractFormValues
  ) => {
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
        option: null as any,
        optionUsed: null as any,
        tradeBonus: null as any,
      });
    }

    const totalValue = salariesByYear.reduce(
      (sum, y) => sum + (y.salary || 0),
      0
    );
    const selectedException = String(values.exceptionType || '').trim();
    const signedUsing =
      typeof values.signedUsing === 'string' && values.signedUsing.trim()
        ? values.signedUsing.trim()
        : selectedException && selectedException.toLowerCase() !== 'none'
          ? selectedException
          : null;

    const contract = {
      ...values,
      salariesByYear,
      totalValue,
      yearsLeft: values.years,
      options: values.options || {},
      signAndTrade: false,
      guaranteed: true,
      isMinimum: (values.salaries[0] || 0) <= 2200000,
      yearsOfService: playerObj.yearsOfService || playerObj.yearsPro || 0,
      signedUsing,
      exceptionType: selectedException || values.exceptionType,
    };

    const result = (await onSign(
      playerObj,
      contract
    )) as FreeAgentActionResult | undefined;
    if (result?.success === false) {
      return result;
    }

    setSelectedPlayers((prev) => prev.filter((p) => p.name !== playerObj.name));
    return { success: true };
  };

  const allAgents = freeAgents || [];

  const filteredAgents = useMemo(
    () =>
      applyFreeAgencyFilters(
        allAgents as Parameters<typeof applyFreeAgencyFilters>[0],
        filterState as Parameters<typeof applyFreeAgencyFilters>[1]
      ),
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
                  isSelected={selectedNames.has(freeAgent.name || '')}
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
            playersMap[contractPlayer.name as string] ||
            playersMap[normalizeLookupKey(contractPlayer.name)] || {
              name: contractPlayer.name,
            }
          }
          isOpen={!!contractPlayer}
          onClose={() => setContractPlayer(null)}
          onSave={handleSaveFromModal as EditContractModalProps['onSave']}
          onSignAndTrade={
            onSignAndTrade as EditContractModalProps['onSignAndTrade']
          }
          getSignAndTradePreflight={
            (worldId
              ? getSignAndTradePreflight
              : undefined) as EditContractModalProps['getSignAndTradePreflight']
          }
          getOfferSheetPreflight={
            (worldId
              ? getOfferSheetPreflight
              : undefined) as EditContractModalProps['getOfferSheetPreflight']
          }
          onStoreOfferSheet={
            (worldId ? onStoreOfferSheet : undefined) as EditContractModalProps['onStoreOfferSheet']
          }
          actionsOverride={worldId ? ['signNew', 'signAndTrade'] : ['signNew']}
          actionLabelsOverride={{ signNew: 'Sign Free Agent' }}
        />
      )}
    </div>
  );
};

export default FreeAgentPool;
