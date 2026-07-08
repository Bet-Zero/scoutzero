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

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const isRfaType = (value: unknown) => {
  if (typeof value !== 'string') return false;
  const normalizedValue = value.trim().toLowerCase();
  return normalizedValue === 'rfa' || normalizedValue === 'restricted';
};

const isRfaOfferSheetTarget = (entry: FreeAgentModalLaunchTarget) => {
  const freeAgent = entry.freeAgent || {};
  const surfacePlayer = entry.surfacePlayer || {};
  const surfaceContract = toRecord(surfacePlayer.contract);
  const surfaceFreeAgency = toRecord(surfaceContract?.freeAgency);
  const surfaceBio = toRecord(surfacePlayer.bio);
  const surfaceBioDisplay = toRecord(surfaceBio?.display);

  return [
    freeAgent.freeAgentType,
    freeAgent.fa_type,
    surfacePlayer.freeAgentType,
    surfacePlayer.fa_type,
    surfaceFreeAgency?.type,
    surfaceBioDisplay?.freeAgentType,
  ].some(isRfaType);
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
  poolManagement = null,
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
  const [poolManagementBusy, setPoolManagementBusy] = useState<
    'save' | 'load' | 'reset' | null
  >(null);
  const [poolManagementMessage, setPoolManagementMessage] = useState<
    string | null
  >(null);
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
  const availableSelectionKeys = useMemo(
    () => new Set(allEntries.map((entry) => entry.selectionKey)),
    [allEntries]
  );

  const generateVisiblePool = useCallback(() => {
    updateSelectedPlayerKeys(() =>
      filteredEntries.map((entry) => entry.selectionKey)
    );
    setPoolManagementMessage('Pool generated');
  }, [filteredEntries, updateSelectedPlayerKeys]);

  const clearManagedPool = useCallback(() => {
    updateSelectedPlayerKeys(() => []);
    setPoolManagementMessage('Pool cleared');
  }, [updateSelectedPlayerKeys]);

  const saveManagedPool = useCallback(async () => {
    if (!poolManagement?.onSave || poolManagement.disabledReason) return;
    setPoolManagementBusy('save');
    setPoolManagementMessage(null);
    try {
      await poolManagement.onSave(selectedPlayerKeys);
      setPoolManagementMessage('Pool saved');
    } catch (error) {
      setPoolManagementMessage(
        error instanceof Error ? error.message : 'Pool save failed'
      );
    } finally {
      setPoolManagementBusy(null);
    }
  }, [poolManagement, selectedPlayerKeys]);

  const loadManagedPool = useCallback(async () => {
    if (!poolManagement?.onLoad || poolManagement.disabledReason) return;
    setPoolManagementBusy('load');
    setPoolManagementMessage(null);
    try {
      const loadedSelectionKeys = (await poolManagement.onLoad()) ?? [];
      updateSelectedPlayerKeys(() =>
        loadedSelectionKeys.filter((selectionKey) =>
          availableSelectionKeys.has(selectionKey)
        )
      );
      setPoolManagementMessage('Pool loaded');
    } catch (error) {
      setPoolManagementMessage(
        error instanceof Error ? error.message : 'Pool load failed'
      );
    } finally {
      setPoolManagementBusy(null);
    }
  }, [availableSelectionKeys, poolManagement, updateSelectedPlayerKeys]);

  const resetManagedPool = useCallback(async () => {
    if (!poolManagement?.onReset || poolManagement.disabledReason) return;
    setPoolManagementBusy('reset');
    setPoolManagementMessage(null);
    try {
      await poolManagement.onReset();
      updateSelectedPlayerKeys(() => []);
      setPoolManagementMessage('Saved pool reset');
    } catch (error) {
      setPoolManagementMessage(
        error instanceof Error ? error.message : 'Pool reset failed'
      );
    } finally {
      setPoolManagementBusy(null);
    }
  }, [poolManagement, updateSelectedPlayerKeys]);

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
  const standardSigningActionLabel =
    freeAgentModalAvailability.actionLabelsOverride.signNew ||
    'Sign Free Agent';
  const standardSigningExposureClassification =
    freeAgentModalAvailability.standardSigningExposureClassification;

  // MODAL RENDERING CONTRACT: the pool receives only the standard-signing lane
  // plus the published modal-availability slice. Lifecycle routing stays out of
  // this surface on purpose.
  const editContractModalProps = useMemo(() => {
    if (!activeContractModalTarget) return null;
    const targetAllowsOfferSheet = isRfaOfferSheetTarget(
      activeContractModalTarget
    );
    const targetOfferSheetInitiation =
      targetAllowsOfferSheet && offerSheetInitiation
        ? offerSheetInitiation
        : null;
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
      getOfferSheetPreflight: (targetOfferSheetInitiation
        ? targetOfferSheetInitiation.getOfferSheetPreflight
        : undefined) as EditContractModalProps['getOfferSheetPreflight'],
      onStoreOfferSheet: (targetOfferSheetInitiation
        ? targetOfferSheetInitiation.storeOfferSheet
        : undefined) as EditContractModalProps['onStoreOfferSheet'],
      actionsOverride: freeAgentModalAvailability.visibleActions,
      actionLabelsOverride: freeAgentModalAvailability.actionLabelsOverride,
      // Free Agency signing context: keep the modal copy about signing a pool
      // free agent to a new contract. Without this the modal infers the intro
      // paragraph from the player's fixture contract and can show expiring /
      // extend / waive language, which is wrong for a free-agent signing.
      actionContextCopy:
        'is a free agent. Set the salary and term below, then confirm to sign him to a new contract.',
      actionDescriptionsOverride: {
        signNew: 'Sign him to a new contract at the salary and term you set below.',
      },
      showOfferSheetToggle:
        freeAgentModalAvailability.showOfferSheetToggle &&
        targetAllowsOfferSheet,
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
    <div className="flex h-full min-h-0 flex-1 flex-col text-white">
      <section
        data-testid="free-agent-pool-management"
        aria-label="Free-agent pool management"
        className="mb-2 shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
              Free Agent Pool
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/65">
              <span className="rounded border border-white/10 bg-black/20 px-1.5 py-0.5">
                {selectedEntries.length} selected
              </span>
              {poolManagement ? (
                <>
                  <span className="rounded border border-white/10 bg-black/20 px-1.5 py-0.5">
                    {poolManagement.scopeLabel}
                  </span>
                  <span className="rounded border border-white/10 bg-black/20 px-1.5 py-0.5">
                    {poolManagement.persistenceLabel}
                  </span>
                </>
              ) : null}
              {poolManagement?.savedAtLabel ? (
                <span className="rounded border border-white/10 bg-black/20 px-1.5 py-0.5">
                  {poolManagement.savedAtLabel}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={generateVisiblePool}
              disabled={filteredEntries.length === 0}
              className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/75 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:border-white/5 disabled:text-white/25"
            >
              Generate Visible
            </button>
            <button
              type="button"
              onClick={saveManagedPool}
              disabled={
                !poolManagement?.onSave ||
                Boolean(poolManagement.disabledReason) ||
                selectedPlayerKeys.length === 0 ||
                poolManagementBusy != null
              }
              title={poolManagement?.disabledReason || 'Save pool'}
              className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/75 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:border-white/5 disabled:text-white/25"
            >
              {poolManagementBusy === 'save' ? 'Saving' : 'Save'}
            </button>
            <button
              type="button"
              onClick={loadManagedPool}
              disabled={
                !poolManagement?.onLoad ||
                Boolean(poolManagement.disabledReason) ||
                poolManagementBusy != null
              }
              title={poolManagement?.disabledReason || 'Load saved pool'}
              className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/75 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:border-white/5 disabled:text-white/25"
            >
              {poolManagementBusy === 'load' ? 'Loading' : 'Load'}
            </button>
            <button
              type="button"
              onClick={resetManagedPool}
              disabled={
                !poolManagement?.onReset ||
                Boolean(poolManagement.disabledReason) ||
                poolManagementBusy != null
              }
              title={poolManagement?.disabledReason || 'Reset saved pool'}
              className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/75 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:border-white/5 disabled:text-white/25"
            >
              {poolManagementBusy === 'reset' ? 'Resetting' : 'Reset Saved'}
            </button>
            <button
              type="button"
              onClick={clearManagedPool}
              disabled={selectedPlayerKeys.length === 0}
              className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/75 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:border-white/5 disabled:text-white/25"
            >
              Clear
            </button>
          </div>
        </div>
        {poolManagement?.disabledReason || poolManagementMessage ? (
          <p className="mt-1 text-[11px] text-white/45">
            {poolManagementMessage || poolManagement?.disabledReason}
          </p>
        ) : null}
      </section>
      <FreeAgencyFilterBar
        filters={filterState}
        onChange={updateFilterState}
        onClear={clearFilters}
        filteredCount={filteredAgents.length}
        totalCount={allAgents.length}
      />

      <SelectedFreeAgentCards
        selectedEntries={selectedEntries}
        onOpenContractModal={openContractModal}
        onRemove={handleRemove}
        isPreviewSigning={/\(Preview\)/i.test(standardSigningActionLabel)}
        exposureClassification={standardSigningExposureClassification}
      />

      <FreeAgentPoolHeader />

      <ul className="min-h-0 flex-1 space-y-[3px] overflow-y-auto pb-2">
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
                  standardSigningActionLabel={standardSigningActionLabel}
                  standardSigningExposureClassification={
                    standardSigningExposureClassification
                  }
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
