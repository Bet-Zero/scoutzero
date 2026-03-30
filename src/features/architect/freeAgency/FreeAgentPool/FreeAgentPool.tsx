/**
 * FILE: src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.tsx
 * PURPOSE: Architect Free Agent Pool interaction surface with selection, staging, and contract modal dispatch wiring.
 * OWNERSHIP: Feature: architect/freeAgency
 *
 * HISTORY:
 *  - 2026-03-14: Migrated from JSX during TM_VALIDATOR_TS_FREE_AGENT_POOL_SURFACE_E86 execution.
 *
 * LINKS:
 *  - Return Package: return_packages/trade_machine/TM_VALIDATOR_TS_FREE_AGENT_POOL_SURFACE_E86_RETURN_PACKAGE.md
 *  - Master Doc: docs/architect/TRADE_MACHINE_MASTER.md
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import EditContractModal from '@/shared/components/EditContractModal';
import { applyFreeAgencyFilters } from '@/shared/utils/filtering/freeAgencyFilterUtils';
import { useFreeAgencyFilterPersistence } from '@/features/architect/freeAgency/useFreeAgencyFilterPersistence';
import FreeAgentRow from './FreeAgentRow';
import { FreeAgentPoolHeader } from './FreeAgentPoolHeader';
import { SelectedFreeAgentCards } from './SelectedFreeAgentCards';
import { FreeAgencyFilterBar } from './FreeAgencyFilterBar';
import type {
  FreeAgentActionResult,
  FreeAgentListItem,
  FreeAgentLookupPlayer,
  FreeAgentModalLaunchTarget,
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

const getFreeAgentSelectionKey = (player: FreeAgentListItem) =>
  String(player.id || player.player_id || player.name || '');

const buildFreeAgentModalLaunchTarget = (
  freeAgent: FreeAgentListItem,
  playersMap: Record<string, FreeAgentLookupPlayer>,
  playersById: Record<string, FreeAgentLookupPlayer>
): FreeAgentModalLaunchTarget => ({
  freeAgent,
  resolvedPlayer: resolvePlayerData(freeAgent, playersMap, playersById),
});

const FreeAgentPool = ({
  freeAgents,
  actionOwner,
  playersMap = {},
  playersById = {},
}: FreeAgentPoolProps) => {
  const [selectedPlayers, setSelectedPlayers] = useState<FreeAgentListItem[]>(
    []
  );
  const [, setSignResults] = useState<
    Record<string, FreeAgentActionResult | null>
  >({});
  const [openMenu, setOpenMenu] = useState<string | null | undefined>(null);
  const [contractModalTarget, setContractModalTarget] =
    useState<FreeAgentModalLaunchTarget | null>(null);
  const { filterState, updateFilterState, clearFilters } =
    useFreeAgencyFilterPersistence();

  useEffect(() => {
    const availableSelectionKeys = new Set(
      (freeAgents || []).map((player) => getFreeAgentSelectionKey(player))
    );

    setSelectedPlayers((prev) =>
      prev.filter((player) =>
        availableSelectionKeys.has(getFreeAgentSelectionKey(player))
      )
    );
  }, [freeAgents]);

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

  const closeContractModal = useCallback(() => {
    setContractModalTarget(null);
  }, []);

  const openContractModal = useCallback(
    (freeAgent: FreeAgentListItem) => {
      setOpenMenu(null);
      setContractModalTarget(
        buildFreeAgentModalLaunchTarget(freeAgent, playersMap, playersById)
      );
    },
    [playersMap, playersById]
  );

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
  const dualPathSigningOwner = actionOwner.dualPathSigning;
  const worldOnlyActionOwner = actionOwner.worldOnly;

  const freeAgencyModalDispatch = useMemo(
    () => ({
      onSignFreeAgent:
        dualPathSigningOwner
          .signFreeAgent as EditContractModalProps['onSignFreeAgent'],
      onSignAndTrade: (worldOnlyActionOwner
        ? worldOnlyActionOwner.signAndTrade
        : undefined) as EditContractModalProps['onSignAndTrade'],
      getSignAndTradePreflight: (worldOnlyActionOwner
        ? worldOnlyActionOwner.getSignAndTradePreflight
        : undefined) as EditContractModalProps['getSignAndTradePreflight'],
      getOfferSheetPreflight: (worldOnlyActionOwner
        ? worldOnlyActionOwner.getOfferSheetPreflight
        : undefined) as EditContractModalProps['getOfferSheetPreflight'],
      onStoreOfferSheet: (worldOnlyActionOwner
        ? worldOnlyActionOwner.storeOfferSheet
        : undefined) as EditContractModalProps['onStoreOfferSheet'],
      actionsOverride: worldOnlyActionOwner ? ['signNew', 'signAndTrade'] : ['signNew'],
    }),
    [dualPathSigningOwner, worldOnlyActionOwner]
  );

  const editContractModalProps = useMemo(() => {
    if (!contractModalTarget) return null;

    return {
      player: contractModalTarget.resolvedPlayer,
      isOpen: true,
      onClose: closeContractModal,
      onSignFreeAgent: freeAgencyModalDispatch.onSignFreeAgent,
      onSignAndTrade: freeAgencyModalDispatch.onSignAndTrade,
      getSignAndTradePreflight:
        freeAgencyModalDispatch.getSignAndTradePreflight,
      getOfferSheetPreflight: freeAgencyModalDispatch.getOfferSheetPreflight,
      onStoreOfferSheet: freeAgencyModalDispatch.onStoreOfferSheet,
      actionsOverride: freeAgencyModalDispatch.actionsOverride,
      actionLabelsOverride: { signNew: 'Sign Free Agent' },
    } satisfies EditContractModalProps;
  }, [closeContractModal, contractModalTarget, freeAgencyModalDispatch]);

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
        onOpenContractModal={openContractModal}
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
                  onOpenContractModal={openContractModal}
                />
              </li>
            );
          })
        )}
      </ul>

      {editContractModalProps ? (
        <EditContractModal {...editContractModalProps} />
      ) : null}
    </div>
  );
};

export default FreeAgentPool;
