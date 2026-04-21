// src/features/tierMaker/TierMakerBoard.tsx

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import TierRow from '@/features/tierMaker/TierRow';
import useSimplePlayerData from '@/shared/hooks/useSimplePlayerData';
import useFirebaseQuery from '@/shared/hooks/useFirebaseQuery';
import { useAuth } from '@/shared/hooks/useAuth';
import { where } from 'firebase/firestore';
import { POSITION_MAP } from '@/shared/utils/roles';
import { TeamListFull } from '@/constants/teamList';
import DrawerShell from '@/shared/components/ui/drawers/DrawerShell';
import OpenDrawerButton from '@/shared/components/ui/drawers/OpenDrawerButton';
import AddPlayerDrawer from '@/features/roster/AddPlayerDrawer';
import CreateTierListModal from '@/features/tierMaker/CreateTierListModal';
import {
  fetchTierList,
  saveTierList,
  type PlayerList,
  type TierList,
} from '@/firebase/listHelpers';
import { toast } from 'react-hot-toast';
import {
  saveTierAsList,
  generateDefaultListName,
} from '@/features/tierMaker/utils/saveAsListBridge';
import type { RosterDrawerPlayer } from '@/features/roster/utils';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';
import type { DraftStandard } from '@/features/tierMaker/hooks/useTierDraft';

const DEFAULT_TIERS = ['S', 'A', 'B', 'C', 'D'];

type TierBoardPlayer = RosterManagerPlayer & {
  player_id?: string;
};

type TierBoardBuckets = Record<string, TierBoardPlayer[]>;

type NormalizedTierBoard = {
  tiers: TierBoardBuckets;
  tierOrder: string[];
};

type TeamOption = (typeof TeamListFull)[number];

type TierMakerBoardProps = {
  players?: TierBoardPlayer[];
  initialTierListId?: string;
  onTierListChange?: (tierListId: string) => void;
  onScreenshotChange?: (isScreenshotMode: boolean) => void;
  isDraftMode?: boolean;
  draftData?: DraftStandard | null;
  onDraftChange?: (data: DraftStandard) => void;
  draftRestored?: boolean;
};

/**
 * Ensures tiers state always includes Pool and tierOrder always includes Pool last.
 * This prevents crashes when Pool is missing from loaded data.
 * @param {Object} tiers - The tiers object
 * @param {Array} tierOrder - The tier order array
 * @returns {Object} - Normalized { tiers, tierOrder }
 */
const normalizeTiers = (
  tiers: TierBoardBuckets = {},
  tierOrder: string[] = []
): NormalizedTierBoard => {
  const normalizedTiers: TierBoardBuckets = { ...tiers };
  let normalizedOrder = Array.isArray(tierOrder) ? [...tierOrder] : [];

  // If no non-Pool tiers exist, inject DEFAULT_TIERS
  const nonPoolOrder = normalizedOrder.filter((t) => t !== 'Pool');
  if (nonPoolOrder.length === 0) {
    DEFAULT_TIERS.forEach((tier) => {
      if (!normalizedOrder.includes(tier)) {
        normalizedOrder.push(tier);
      }
    });
  }

  // Ensure every tier in the order has an array in tiers
  normalizedOrder.forEach((tier) => {
    if (!normalizedTiers[tier]) {
      normalizedTiers[tier] = [];
    }
  });

  // Ensure Pool exists in tiers
  if (!normalizedTiers.Pool) {
    normalizedTiers.Pool = [];
  }

  // Ensure Pool is in tierOrder and is last
  normalizedOrder = normalizedOrder.filter((t) => t !== 'Pool');
  normalizedOrder.push('Pool');

  return { tiers: normalizedTiers, tierOrder: normalizedOrder };
};

const TierMakerBoard = ({
  players = [],
  initialTierListId = '',
  onTierListChange,
  onScreenshotChange,
  isDraftMode = false,
  draftData = null,
  onDraftChange = null,
  draftRestored = true,
}: TierMakerBoardProps) => {
  const { players: allPlayers, loading } = useSimplePlayerData();
  const { userId } = useAuth();
  const canPersist = Boolean(userId);
  // E4: Scope list/tierList queries to ownerUid
  const ownerConstraints = useMemo(
    () => (userId ? [where('ownerUid', '==', userId)] : []),
    [userId]
  );
  const { data: listsData } = useFirebaseQuery<PlayerList>('lists', ownerConstraints, {
    enabled: canPersist,
  });
  const { data: tierListsData } = useFirebaseQuery<TierList>(
    'tierLists',
    ownerConstraints,
    { enabled: canPersist }
  );

  const processedPlayers = useMemo<Array<RosterDrawerPlayer<RosterManagerPlayer>>>(
    () =>
      allPlayers.map((rawPlayer) => {
        const player = rawPlayer as RosterManagerPlayer;
        const contractValues = player.contracts
          ? Object.values(player.contracts).filter(Boolean)
          : [];
        const contractData =
          player.primaryContract ||
          contractValues[0] ||
          null;

        return {
          id: player.id,
          player_id: player.id,
          name: (player.bio?.displayName || player.name || '').toLowerCase(),
          team: String(player.bio?.display?.team || '').toLowerCase(),
          position:
            player.formattedPosition ||
            POSITION_MAP[player.bio?.position || ''] ||
            player.bio?.position ||
            '',
          offenseRoles: [
            player.offenseRole?.toLowerCase() || '',
            player.primaryEvaluation?.roles?.offense2?.toLowerCase() || '',
          ],
          defenseRoles: [
            player.defenseRole?.toLowerCase() || '',
            player.primaryEvaluation?.roles?.defense2?.toLowerCase() || '',
          ],
          offenseSubroles: player.subRoles?.offense || [],
          defenseSubroles: player.subRoles?.defense || [],
          shootingProfile: (player.shootingProfile || '').toLowerCase(),
          badges: player.badges || [],
          salary: contractData?.salariesByYear?.find(
            (s) => s.year === 2025 || String(s.season ?? '').startsWith('2025')
          )?.salary,
          freeAgentYear:
            player.bio?.display?.freeAgentYear?.toString() ||
            contractData?.freeAgency?.freeAgentYear?.toString() ||
            null,
          freeAgentType: (
            player.bio?.display?.freeAgentType ||
            contractData?.freeAgency?.freeAgentType ||
            ''
          ).toLowerCase(),
          contractType: (contractData?.contractType || '').toLowerCase(),
          extension: (() => {
            const extensionContract = contractValues.find(
              (contract) => contract?.isExtension
            );
            return extensionContract
              ? {
                  freeAgentYear:
                    extensionContract.freeAgency?.freeAgentYear ?? null,
                }
              : null;
          })(),
          options: contractData?.options || [],
          original: player,
        };
      }),
    [allPlayers]
  );

  const playersMap = useMemo(() => {
    const map: Record<string, RosterManagerPlayer> = {};
    allPlayers.forEach((rawPlayer) => {
      const player = rawPlayer as RosterManagerPlayer;
      map[player.id] = player;
    });
    return map;
  }, [allPlayers]);

  const lists = useMemo(
    () =>
      (listsData || []).map((l) => ({
        id: l.id,
        name: l.name,
        playerIds: l.playerIds || [],
        playerOrder: l.playerOrder || [],
      })),
    [listsData]
  );

  const tierLists = useMemo(
    () =>
      (tierListsData || []).map((l) => ({
        id: l.id,
        name: l.name,
        tiers: l.tiers || {},
        tierOrder: l.tierOrder || [],
      })),
    [tierListsData]
  );

  const getInitialTiers = () => {
    const tiers = [...DEFAULT_TIERS, 'Pool'].reduce<TierBoardBuckets>((acc, tier) => {
      acc[tier] = tier === 'Pool' ? [...players] : [];
      return acc;
    }, {});
    const tierOrder = [...DEFAULT_TIERS, 'Pool'];
    // Always normalize initial state to ensure Pool exists and is last
    return normalizeTiers(tiers, tierOrder);
  };

  const initialState = useMemo(() => getInitialTiers(), [players]);
  const [tiers, setTiers] = useState<TierBoardBuckets>(initialState.tiers);
  const [tierOrder, setTierOrder] = useState<string[]>(initialState.tierOrder);
  const [screenshotMode, setScreenshotMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamOption | null>(null);
  const [selectedList, setSelectedList] = useState('');
  const [selectedTierList, setSelectedTierList] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAsList, setIsSavingAsList] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  // ── Draft mode: initialization from draftData ──────────────────────────
  const draftInitRef = useRef(false);
  const draftReportRef = useRef(false); // skip initial echo

  useEffect(() => {
    if (!isDraftMode || !draftRestored || draftInitRef.current) return;
    if (!draftData || !draftData.tiers) {
      draftInitRef.current = true;
      return;
    }
    // Wait for players to be available for rehydration
    if (!allPlayers.length) return;

    const rehydrated: TierBoardBuckets = {};
    Object.entries(draftData.tiers).forEach(([tier, ids]) => {
      rehydrated[tier] = (Array.isArray(ids) ? ids : [])
        .map((pid) => playersMap[pid])
        .filter(Boolean)
        .map((p) => ({ ...p, player_id: p.id }));
    });
    const order =
      Array.isArray(draftData.tierOrder) && draftData.tierOrder.length > 0
        ? draftData.tierOrder
        : Object.keys(rehydrated);
    const normalized = normalizeTiers(rehydrated, order);
    setTiers(normalized.tiers);
    setTierOrder(normalized.tierOrder);
    draftInitRef.current = true;
    draftReportRef.current = true; // skip the echo from this set
  }, [isDraftMode, draftRestored, draftData, allPlayers.length, playersMap]);

  // ── Draft mode: report changes back to parent (debounced) ──────────────
  useEffect(() => {
    if (!isDraftMode || !onDraftChange) return;
    // Skip the initial echo after draft initialization
    if (draftReportRef.current) {
      draftReportRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const serialized: Record<string, string[]> = {};
      Object.keys(tiers).forEach((t) => {
        serialized[t] = (tiers[t] || []).map((p) => p.player_id || p.id);
      });
      onDraftChange({ tiers: serialized, tierOrder });
    }, 300);

    return () => clearTimeout(timer);
  }, [isDraftMode, onDraftChange, tiers, tierOrder]);

  const addPlayerToPool = (player: RosterManagerPlayer) => {
    const formatted = { ...player, player_id: player.id };
    setTiers((prev) => {
      // Check ALL tiers for duplicate
      const allIds = new Set<string>();
      Object.values(prev).forEach((arr) =>
        (arr || []).forEach((p) => allIds.add(p.player_id))
      );
      if (allIds.has(player.id)) return prev;
      return {
        ...prev,
        Pool: [...(prev.Pool || []), formatted],
      };
    });
  };

  const addPlayersToPool = (playersArray: RosterManagerPlayer[]) => {
    setTiers((prev) => {
      // Collect IDs from ALL tiers
      const allIds = new Set<string>();
      Object.values(prev).forEach((arr) =>
        (arr || []).forEach((p) => allIds.add(p.player_id))
      );
      const additions = playersArray
        .filter((p) => !allIds.has(p.id))
        .map((p) => ({ ...p, player_id: p.id }));
      if (additions.length === 0) return prev;
      return { ...prev, Pool: [...(prev.Pool || []), ...additions] };
    });
  };

  const movePlayer = (playerId, fromTier, direction) => {
    const tierKeys = [...tierOrder];
    const currentIndex = tierKeys.indexOf(fromTier);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= tierKeys.length) return;

    const sourceItems = [...tiers[fromTier]];
    const player = sourceItems.find((p) => p.player_id === playerId);
    if (!player) return;

    setTiers((prev) => ({
      ...prev,
      [fromTier]: sourceItems.filter((p) => p.player_id !== playerId),
      [tierKeys[newIndex]]: [...prev[tierKeys[newIndex]], player],
    }));
  };

  const removePlayer = (playerId, fromTier) => {
    if (fromTier === 'Pool') return;
    setTiers((prev) => {
      const player = prev[fromTier].find((p) => p.player_id === playerId);
      if (!player) return prev;
      const pool = prev.Pool || [];
      const poolIds = new Set(pool.map((p) => p.player_id));
      return {
        ...prev,
        [fromTier]: prev[fromTier].filter((p) => p.player_id !== playerId),
        Pool: poolIds.has(playerId) ? pool : [...pool, player],
      };
    });
  };

  const addTier = () => {
    const name = prompt('New tier name?');
    if (!name) return;
    setTiers((prev) => ({ ...prev, [name]: [] }));
    setTierOrder((prev) => [...prev.slice(0, -1), name, 'Pool']);
  };

  const deleteTier = (tier) => {
    if (tier === 'Pool') return;
    setTiers((prev) => {
      const { [tier]: removed, ...rest } = prev;
      const pool = prev.Pool || [];
      return { ...rest, Pool: [...pool, ...(removed || [])] };
    });
    setTierOrder((prev) => prev.filter((t) => t !== tier));
  };

  const renameTier = (tier) => {
    const name = prompt('Rename tier', tier);
    if (!name || name === tier) return;
    setTiers((prev) => {
      const { [tier]: items, ...rest } = prev;
      // Ensure Pool is preserved even if somehow missing
      const newTiers = { ...rest, [name]: items };
      if (!newTiers.Pool) {
        newTiers.Pool = [];
      }
      return newTiers;
    });
    setTierOrder((prev) => prev.map((t) => (t === tier ? name : t)));
  };

  const moveTierUp = (tier) => {
    setTierOrder((prev) => {
      const withoutPool = prev.filter((t) => t !== 'Pool');
      const idx = withoutPool.indexOf(tier);
      if (idx <= 0) return prev;
      const next = [...withoutPool];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return [...next, 'Pool'];
    });
  };

  const moveTierDown = (tier) => {
    setTierOrder((prev) => {
      const withoutPool = prev.filter((t) => t !== 'Pool');
      const idx = withoutPool.indexOf(tier);
      if (idx < 0 || idx >= withoutPool.length - 1) return prev;
      const next = [...withoutPool];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return [...next, 'Pool'];
    });
  };

  const resetBoard = () => {
    const normalized = getInitialTiers();
    setTiers(normalized.tiers);
    setTierOrder(normalized.tierOrder);
  };

  const handleAddTeamRoster = () => {
    if (!selectedTeam) return;
    const teamCode = (
      selectedTeam.code ||
      selectedTeam.teamId ||
      ''
    ).toUpperCase();
    const teamPlayers = allPlayers
      .filter((p) => String(p.bio?.display?.teamId || '').toUpperCase() === teamCode)
      .map((player) => player as RosterManagerPlayer);
    addPlayersToPool(teamPlayers);
    setSelectedTeam(null);
  };

  const handleAddList = () => {
    if (!selectedList) return;
    const list = lists.find((l) => l.id === selectedList);
    if (!list) return;
    // Merge playerOrder + playerIds so no players are silently dropped
    const merged = [...list.playerOrder];
    list.playerIds.forEach((id) => {
      if (!merged.includes(id)) merged.push(id);
    });
    const listPlayers = merged
      .map((id) => playersMap[id])
      .filter((player): player is RosterManagerPlayer => Boolean(player));
    addPlayersToPool(listPlayers);
    setSelectedList('');
  };

  const handleLoadTierList = useCallback(
    async (id: string) => {
      if (!id) return;
      try {
        const data = await fetchTierList(id, userId);
        if (data) {
          const newTiers: TierBoardBuckets = {};
          if (data.tiers && typeof data.tiers === 'object') {
            Object.entries(data.tiers).forEach(([tier, ids]) => {
              newTiers[tier] = (Array.isArray(ids) ? ids : [])
                .map((pid) => playersMap[pid])
                .filter(Boolean)
                .map((p) => ({ ...p, player_id: p.id }));
            });
          }
          const newTierOrder =
            Array.isArray(data.tierOrder) && data.tierOrder.length > 0
              ? data.tierOrder
              : Object.keys(newTiers);
          const normalized = normalizeTiers(newTiers, newTierOrder);
          setTiers(normalized.tiers);
          setTierOrder(normalized.tierOrder);
          setSelectedTierList(id);
          // Update URL with the loaded tier list
          onTierListChange?.(id);
          toast.success('Tier list loaded!');
        }
      } catch (err) {
        console.error('Failed to load tier list', err);
        toast.error('Failed to load tier list');
      }
    },
    [playersMap, onTierListChange, userId]
  );

  const handleSaveTierList = async (idOverride?: string) => {
    if (!userId) {
      toast.error('Save requires a session');
      return;
    }
    const listId = idOverride || selectedTierList;
    if (!listId) {
      setShowCreateModal(true);
      return;
    }
    const dataToSave: Record<string, string[]> = {};
    Object.keys(tiers).forEach((t) => {
      dataToSave[t] = tiers[t].map((p) => p.player_id || p.id);
    });
    try {
      setIsSaving(true);
      await saveTierList(
        listId,
        {
          tiers: dataToSave,
          tierOrder,
          mode: 'standard',
        },
        userId
      );
      toast.success('Tier list saved!');
    } catch (err) {
      console.error('Failed to save tier list', err);
      toast.error('Failed to save tier list');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateAndSave = async (newId: string) => {
    if (!newId) return;
    setSelectedTierList(newId);
    setShowCreateModal(false);
    // Mark as loaded to prevent useEffect from re-fetching the empty doc
    setInitialLoaded(true);
    // Save current board state BEFORE navigating URL
    await handleSaveTierList(newId);
    onTierListChange?.(newId);
  };

  // ── Save as List (owner-only) ────────────────────────────────────────────
  const handleSaveAsList = async () => {
    if (!userId) {
      toast.error('Save as list requires a session');
      return;
    }

    // Prompt for list name with default
    const defaultName = generateDefaultListName('standard');
    const name = prompt('Save as List — enter a name:', defaultName);
    if (!name) return; // User cancelled

    try {
      setIsSavingAsList(true);
      const { listId } = await saveTierAsList({
        mode: 'standard',
        name,
        userId,
        data: { tiers, tierOrder },
      });
      toast.success(`Saved as "${name}"`);
      console.log('[TierMakerBoard] Saved as list:', listId);
    } catch (err) {
      console.error('Failed to save as list:', err);
      toast.error(err.message || 'Failed to save as list');
    } finally {
      setIsSavingAsList(false);
    }
  };

  // Firestore auto-load: only in saved mode (not draft mode)
  useEffect(() => {
    if (isDraftMode) return; // Draft mode loads from props, not Firestore
    if (
      !initialLoaded &&
      initialTierListId &&
      tierListsData &&
      allPlayers.length
    ) {
      handleLoadTierList(initialTierListId);
      setInitialLoaded(true);
    }
  }, [
    isDraftMode,
    initialLoaded,
    initialTierListId,
    tierListsData,
    allPlayers.length,
    handleLoadTierList,
  ]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10 text-white">
        Loading players...
      </div>
    );
  }

  const displayOrder =
    tierOrder.length > 1 ? tierOrder : [...DEFAULT_TIERS, 'Pool'];
  const visibleOrder = screenshotMode
    ? displayOrder.filter((tier) => tier !== 'Pool')
    : displayOrder;
  const nonPoolOrder = displayOrder.filter((tier) => tier !== 'Pool');

  return (
    <div className="flex relative">
      {!drawerOpen && !screenshotMode && (
        <OpenDrawerButton onClick={() => setDrawerOpen(true)} />
      )}

      <DrawerShell isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <AddPlayerDrawer
          onClose={() => setDrawerOpen(false)}
          allPlayers={processedPlayers}
          onSelect={(player) => {
            addPlayerToPool(player);
          }}
        />
      </DrawerShell>

      <div
        className={`flex-1 transition-[margin] duration-300 ease-in-out ${
          drawerOpen ? 'ml-[300px]' : 'ml-0'
        }`}
      >
        <div className="flex flex-col gap-2 w-full max-w-[1000px] mx-auto pt-6 pb-12">
          {!screenshotMode && (
            <div className="flex justify-between items-center mb-1">
              <button
                onClick={addTier}
                className="px-3 py-1 text-sm rounded bg-white/10 hover:bg-white/20 transition-all text-white"
              >
                Add Tier
              </button>
              <button
                onClick={resetBoard}
                className="px-3 py-1 text-sm rounded bg-white/10 hover:bg-red-500 transition-all text-white"
              >
                Reset
              </button>
            </div>
          )}

          {visibleOrder.map((tier) => {
            const tierIdx = displayOrder.indexOf(tier);
            const nonPoolIdx = nonPoolOrder.indexOf(tier);
            return (
              <TierRow
                key={tier}
                tier={tier}
                players={tiers[tier] || []}
                screenshotMode={screenshotMode}
                movePlayer={movePlayer}
                removePlayer={removePlayer}
                renameTier={renameTier}
                deleteTier={deleteTier}
                canMoveUp={tier !== 'Pool' && nonPoolIdx > 0}
                canMoveDown={
                  tier !== 'Pool' && nonPoolIdx < nonPoolOrder.length - 1
                }
                onMoveTierUp={moveTierUp}
                onMoveTierDown={moveTierDown}
                canPlayerMoveUp={tierIdx > 0}
                canPlayerMoveDown={tierIdx < displayOrder.length - 1}
                canRemovePlayer={tier !== 'Pool'}
              />
            );
          })}

          {!screenshotMode && (
            <div className="flex items-center gap-2 flex-wrap mt-4 justify-center">
              <div className="flex items-center gap-1">
                <select
                  value={selectedTeam?.id || ''}
                  onChange={(e) =>
                    setSelectedTeam(
                      TeamListFull.find((t) => t.id === e.target.value) || null
                    )
                  }
                  className="bg-[#1a1a1a] text-white text-sm px-2 py-1 rounded border border-white/10"
                >
                  <option value="">Add Team...</option>
                  {TeamListFull.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.teamName}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddTeamRoster}
                  className="px-2 py-1 text-sm rounded bg-white/10 hover:bg-white/20 text-white"
                >
                  Add Team
                </button>
              </div>

              <div className="flex items-center gap-1">
                <select
                  value={selectedList}
                  onChange={(e) => setSelectedList(e.target.value)}
                  className="bg-[#1a1a1a] text-white text-sm px-2 py-1 rounded border border-white/10"
                >
                  <option value="">Add List...</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddList}
                  className="px-2 py-1 text-sm rounded bg-white/10 hover:bg-white/20 text-white"
                >
                  Add List
                </button>
              </div>

              <div className="flex items-center gap-1">
                <select
                  value={selectedTierList}
                  onChange={(e) => handleLoadTierList(e.target.value)}
                  className="bg-[#1a1a1a] text-white text-sm px-2 py-1 rounded border border-white/10"
                >
                  <option value="">Load Tier List...</option>
                  {tierLists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {String(l.name)}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-2 py-1 text-sm rounded bg-white/10 hover:bg-white/20 text-white"
                >
                  New
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {!drawerOpen && (
        <div className="fixed bottom-6 left-6 z-50">
          <button
            onClick={() => {
              const next = !screenshotMode;
              setScreenshotMode(next);
              onScreenshotChange?.(next);
            }}
            className={`px-4 py-2 rounded transition-all duration-300 ${
              screenshotMode
                ? 'opacity-0 hover:opacity-80 bg-red-700 text-white'
                : 'bg-black/20 text-white hover:bg-white/20'
            }`}
          >
            {screenshotMode ? 'Exit Screenshot View' : 'Screenshot View'}
          </button>
        </div>
      )}

      {screenshotMode && (
        <div className="fixed top-4 right-4 z-50 opacity-0 hover:opacity-90 transition-opacity bg-black/60 text-white/80 px-3 py-1.5 rounded text-xs">
          Use your device screenshot to capture this view
        </div>
      )}

      {!screenshotMode && (
        <div className="fixed bottom-6 right-6 z-50 flex gap-2">
          <button
            onClick={handleSaveAsList}
            disabled={!canPersist || isSavingAsList}
            className="bg-black/20 text-white px-4 py-2 rounded hover:bg-white/20 disabled:opacity-50"
            title={canPersist ? 'Save board as a list' : 'Session required to save'}
          >
            {isSavingAsList ? 'Saving...' : 'Save as List'}
          </button>
          <button
            onClick={() => handleSaveTierList()}
            disabled={!canPersist || isSaving}
            className="bg-black/20 text-white px-4 py-2 rounded hover:bg-white/20 disabled:opacity-50"
            title={canPersist ? 'Save tier list' : 'Session required to save'}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}

      <CreateTierListModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleCreateAndSave}
        mode="standard"
      />
    </div>
  );
};

export default TierMakerBoard;
