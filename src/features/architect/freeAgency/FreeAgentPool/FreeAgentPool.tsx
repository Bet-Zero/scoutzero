/**
 * FILE: src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.tsx
 * PURPOSE: Architect Free Agent Pool interaction surface with selection, staging, and contract modal dispatch wiring.
 * OWNERSHIP: Feature: architect/freeAgency
 *
 * ARCHITECT OWNERSHIP:
 * - Visual/rendering surface for free-agent discovery, selection, and modal launch.
 * - Treats modal action availability as upstream truth from the dashboard action layer.
 * - Does not own offer-sheet lifecycle routing or world-only disabled messaging.
 *
 * HISTORY:
 *  - 2026-03-14: Migrated from JSX during TM_VALIDATOR_TS_FREE_AGENT_POOL_SURFACE_E86 execution.
 *
 * LINKS:
 *  - Return Package: return_packages/trade_machine/TM_VALIDATOR_TS_FREE_AGENT_POOL_SURFACE_E86_RETURN_PACKAGE.md
 *  - Master Doc: docs/architect/TRADE_MACHINE_MASTER.md
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { EditContractModal } from '@/shared/components/EditContractModal';
import { applyFreeAgencyFilters } from '@/shared/utils/filtering/freeAgencyFilterUtils';
import { useFreeAgencyFilterPersistence } from '@/features/architect/freeAgency/useFreeAgencyFilterPersistence';
import { FreeAgentRow } from './FreeAgentRow';
import { FreeAgentPoolHeader } from './FreeAgentPoolHeader';
import { SelectedFreeAgentCards } from './SelectedFreeAgentCards';
import { FreeAgencyFilterBar } from './FreeAgencyFilterBar';
import type {
  FreeAgentActionResult,
  FreeAgentListItem,
  FreeAgentLookupPlayer,
  FreeAgentModalLaunchTarget,
  FreeAgentPoolProps,
  FreeAgentSurfaceEntry,
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

const getStablePlayerId = (
  player?: Partial<FreeAgentListItem | FreeAgentLookupPlayer> | null
) => {
  const playerId = player?.id || player?.player_id || player?.bio?.playerId;
  if (typeof playerId !== 'string') return null;
  const normalizedPlayerId = playerId.trim();
  return normalizedPlayerId || null;
};

const resolveLookupPlayer = (
  freeAgent: FreeAgentListItem,
  playersMap: Record<string, FreeAgentLookupPlayer>
) => {
  const playerId = getStablePlayerId(freeAgent);
  const freeAgentName = freeAgent.name?.trim() || '';
  const normalizedFreeAgentName = normalizeLookupKey(freeAgentName);

  return (
    (playerId ? playersMap?.[playerId] : null) ||
    (freeAgentName ? playersMap?.[freeAgentName] : null) ||
    (normalizedFreeAgentName ? playersMap?.[normalizedFreeAgentName] : null) ||
    null
  );
};

export const buildFreeAgentSurfaceEntry = (
  freeAgent: FreeAgentListItem,
  playersMap: Record<string, FreeAgentLookupPlayer>
): FreeAgentSurfaceEntry => {
  const matchedPlayer = resolveLookupPlayer(freeAgent, playersMap) || {};
  const playerId = getStablePlayerId(freeAgent) || getStablePlayerId(matchedPlayer);
  const preferredDisplayName =
    (freeAgent.name && freeAgent.name !== 'Player Not Found'
      ? freeAgent.name
      : freeAgent.displayName) ||
    matchedPlayer.bio?.displayName ||
    matchedPlayer.displayName ||
    matchedPlayer.name ||
    '';
  const fallbackSelectionLabel =
    preferredDisplayName ||
    freeAgent.name ||
    freeAgent.displayName ||
    matchedPlayer.name ||
    'unknown-free-agent';

  const surfacePlayer: ResolvedFreeAgentPlayer = {
    ...matchedPlayer,
    ...freeAgent,
    id: playerId || matchedPlayer.id || freeAgent.id || undefined,
    player_id: playerId || matchedPlayer.player_id || freeAgent.player_id || undefined,
    name: preferredDisplayName || matchedPlayer.name || freeAgent.name || '',
    displayName:
      freeAgent.displayName ||
      matchedPlayer.displayName ||
      preferredDisplayName ||
      matchedPlayer.name ||
      '',
    bio: {
      ...(matchedPlayer.bio || {}),
      ...(freeAgent.bio || {}),
      playerId:
        playerId ||
        matchedPlayer.bio?.playerId ||
        freeAgent.bio?.playerId ||
        undefined,
      displayName:
        preferredDisplayName ||
        matchedPlayer.bio?.displayName ||
        freeAgent.bio?.displayName ||
        '',
    },
  };

  return {
    freeAgent,
    surfacePlayer,
    playerId,
    selectionKey:
      playerId || normalizeLookupKey(fallbackSelectionLabel) || 'unknown-free-agent',
  };
};

const buildFreeAgentModalLaunchTarget = (
  entry: FreeAgentSurfaceEntry
): FreeAgentModalLaunchTarget => entry;

export const FreeAgentPool = ({
  freeAgents,
  actionOwner,
  playersMap = {},
  selectedPlayerKeys: controlledSelectedPlayerKeys,
  onSelectedPlayerKeysChange,
  requestedOpenSelectionKey = null,
  onRequestedOpenSelectionHandled,
  onSelectedEntriesChange,
  onPlayerAction,
  pinnedPlayerIds,
}: FreeAgentPoolProps) => {
  const [uncontrolledSelectedPlayerKeys, setUncontrolledSelectedPlayerKeys] =
    useState<string[]>([]);
  const [, setSignResults] = useState<
    Record<string, FreeAgentActionResult | null>
  >({});
  const [openMenuSelectionKey, setOpenMenuSelectionKey] = useState<
    string | null | undefined
  >(null);
  const [contractModalTarget, setContractModalTarget] =
    useState<FreeAgentModalLaunchTarget | null>(null);
  const { filterState, updateFilterState, clearFilters } =
    useFreeAgencyFilterPersistence();
  const selectedPlayerKeys =
    controlledSelectedPlayerKeys ?? uncontrolledSelectedPlayerKeys;
  const updateSelectedPlayerKeys = useCallback(
    (updater: (selectionKeys: string[]) => string[]) => {
      const nextSelectionKeys = updater(selectedPlayerKeys);
      if (nextSelectionKeys === selectedPlayerKeys) return;
      if (onSelectedPlayerKeysChange) {
        onSelectedPlayerKeysChange(nextSelectionKeys);
      } else {
        setUncontrolledSelectedPlayerKeys(nextSelectionKeys);
      }
    },
    [onSelectedPlayerKeysChange, selectedPlayerKeys]
  );

  const allAgents = freeAgents || [];

  const allEntries = useMemo(
    () =>
      allAgents.map((freeAgent) =>
        buildFreeAgentSurfaceEntry(freeAgent, playersMap)
      ),
    [allAgents, playersMap]
  );

  const entriesBySelectionKey = useMemo(() => {
    const entryMap = new Map<string, FreeAgentSurfaceEntry>();
    allEntries.forEach((entry) => {
      entryMap.set(entry.selectionKey, entry);
    });
    return entryMap;
  }, [allEntries]);

  const entriesByFreeAgent = useMemo(() => {
    const entryMap = new Map<FreeAgentListItem, FreeAgentSurfaceEntry>();
    allEntries.forEach((entry) => {
      entryMap.set(entry.freeAgent, entry);
    });
    return entryMap;
  }, [allEntries]);

  useEffect(() => {
    const availableSelectionKeys = new Set(allEntries.map((entry) => entry.selectionKey));

    updateSelectedPlayerKeys((prev) => {
      const next = prev.filter((selectionKey) =>
        availableSelectionKeys.has(selectionKey)
      );
      return next.length === prev.length ? prev : next;
    });
    setOpenMenuSelectionKey((prev) =>
      prev && availableSelectionKeys.has(prev) ? prev : null
    );
  }, [allEntries, updateSelectedPlayerKeys]);

  const handleSelect = useCallback((entry: FreeAgentSurfaceEntry) => {
    updateSelectedPlayerKeys((prev) => {
      const exists = prev.includes(entry.selectionKey);
      if (exists) {
        return prev.filter((selectionKey) => selectionKey !== entry.selectionKey);
      }
      return [...prev, entry.selectionKey];
    });
    setSignResults((prev) => ({ ...prev, [entry.selectionKey]: null }));
  }, [updateSelectedPlayerKeys]);

  const handleRemove = useCallback((selectionKey: string) => {
    updateSelectedPlayerKeys((prev) =>
      prev.filter((currentSelectionKey) => currentSelectionKey !== selectionKey)
    );
  }, [updateSelectedPlayerKeys]);

  const closeContractModal = useCallback(() => {
    setContractModalTarget(null);
  }, []);

  const openContractModal = useCallback(
    (entry: FreeAgentSurfaceEntry) => {
      setOpenMenuSelectionKey(null);
      setContractModalTarget(buildFreeAgentModalLaunchTarget(entry));
    },
    []
  );

  const filteredAgents = useMemo(
    () =>
      applyFreeAgencyFilters(
        allAgents as Parameters<typeof applyFreeAgencyFilters>[0],
        filterState as Parameters<typeof applyFreeAgencyFilters>[1]
      ),
    [allAgents, filterState]
  );

  const filteredEntries = useMemo(
    () =>
      filteredAgents.map(
        (freeAgent) =>
          entriesByFreeAgent.get(freeAgent) ||
          buildFreeAgentSurfaceEntry(freeAgent, playersMap)
      ),
    [entriesByFreeAgent, filteredAgents, playersMap]
  );

  const selectedEntries = useMemo(
    () =>
      selectedPlayerKeys
        .map((selectionKey) => entriesBySelectionKey.get(selectionKey))
        .filter(
          (entry): entry is FreeAgentSurfaceEntry => entry != null
        ),
    [entriesBySelectionKey, selectedPlayerKeys]
  );

  const selectedPlayerKeysSet = useMemo(
    () => new Set(selectedPlayerKeys),
    [selectedPlayerKeys]
  );

  const activeContractModalTarget = useMemo(
    () =>
      contractModalTarget
        ? entriesBySelectionKey.get(contractModalTarget.selectionKey) ||
          contractModalTarget
        : null,
    [contractModalTarget, entriesBySelectionKey]
  );
  useEffect(() => {
    onSelectedEntriesChange?.(selectedEntries);
  }, [onSelectedEntriesChange, selectedEntries]);

  useEffect(() => {
    if (!requestedOpenSelectionKey) return;
    const entry = entriesBySelectionKey.get(requestedOpenSelectionKey);
    if (!entry) return;
    openContractModal(entry);
    onRequestedOpenSelectionHandled?.();
  }, [
    entriesBySelectionKey,
    onRequestedOpenSelectionHandled,
    openContractModal,
    requestedOpenSelectionKey,
  ]);

  const freeAgentModalAvailability = actionOwner.freeAgentModalAvailability;
  const dualPathSigningOwner = actionOwner.dualPathSigning;
  const signAndTradeInitiation = freeAgentModalAvailability.signAndTradeInitiation;
  const offerSheetInitiation = freeAgentModalAvailability.offerSheetInitiation;

  // MODAL RENDERING CONTRACT: the pool receives only the standard-signing lane
  // plus the published modal-availability slice. Lifecycle routing stays out of
  // this surface on purpose.
  const editContractModalProps = useMemo(() => {
    if (!activeContractModalTarget) return null;
    const signFreeAgent: EditContractModalProps['onSignFreeAgent'] = async (
      ...args
    ) => {
      const result = await (
        dualPathSigningOwner
          .signFreeAgent as NonNullable<
          EditContractModalProps['onSignFreeAgent']
        >
      )(...args);
      if (typeof result === 'object' && result?.success) {
        handleRemove(activeContractModalTarget.selectionKey);
      }
      return result;
    };

    return {
      player: activeContractModalTarget.surfacePlayer,
      isOpen: true,
      onClose: closeContractModal,
      onSignFreeAgent: signFreeAgent,
      signAndTradeInitiation:
        signAndTradeInitiation as EditContractModalProps['signAndTradeInitiation'],
      getOfferSheetPreflight: (offerSheetInitiation
        ? offerSheetInitiation.getOfferSheetPreflight
        : undefined) as EditContractModalProps['getOfferSheetPreflight'],
      onStoreOfferSheet: (offerSheetInitiation
        ? offerSheetInitiation.storeOfferSheet
        : undefined) as EditContractModalProps['onStoreOfferSheet'],
      actionsOverride: freeAgentModalAvailability.visibleActions,
      actionLabelsOverride: freeAgentModalAvailability.actionLabelsOverride,
      showOfferSheetToggle: freeAgentModalAvailability.showOfferSheetToggle,
    } satisfies EditContractModalProps;
  }, [
    activeContractModalTarget,
    closeContractModal,
    dualPathSigningOwner,
    freeAgentModalAvailability,
    handleRemove,
    offerSheetInitiation,
    signAndTradeInitiation,
  ]);

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
        selectedEntries={selectedEntries}
        onOpenContractModal={openContractModal}
        onRemove={handleRemove}
      />

      <ul className="space-y-[3px] mb-4 px-6">
        {filteredEntries.length === 0 ? (
          <li className="text-center text-sm text-white/60 py-4">No matches</li>
        ) : (
          filteredEntries.map((entry) => {
            return (
              <li key={entry.selectionKey}>
                <FreeAgentRow
                  entry={entry}
                  onSelect={handleSelect}
                  isSelected={selectedPlayerKeysSet.has(entry.selectionKey)}
                  openMenuSelectionKey={openMenuSelectionKey}
                  setOpenMenuSelectionKey={setOpenMenuSelectionKey}
                  onOpenContractModal={openContractModal}
                  onPlayerAction={onPlayerAction}
                  pinnedPlayerIds={pinnedPlayerIds}
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
