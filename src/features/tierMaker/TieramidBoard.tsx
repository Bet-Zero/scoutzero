import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useTieramidRowOps } from './useTieramidRowOps';
import { TieramidPlayerTile } from '@/features/tierMaker/TieramidPlayerTile';
import {
  fetchTierList,
  saveTierList,
  type PlayerList,
  type TierList,
} from '@/firebase/listHelpers';
import { useSimplePlayerData } from '@/shared/hooks/useSimplePlayerData';
import { useFirebaseQuery } from '@/shared/hooks/useFirebaseQuery';
import { useAuth } from '@/shared/hooks/useAuth';
import { where } from 'firebase/firestore';
import { CreateTierListModal } from '@/features/tierMaker/CreateTierListModal';
import { TeamListFull } from '@/constants/teamList';
import { POSITION_MAP } from '@/shared/utils/roles';
import { DrawerShell } from '@/shared/components/ui/drawers/DrawerShell';
import { OpenDrawerButton } from '@/shared/components/ui/drawers/OpenDrawerButton';
import { AddPlayerDrawer } from '@/features/roster/AddPlayerDrawer';
import { toast } from 'react-hot-toast';
import {
  saveTierAsList,
  generateDefaultListName,
} from '@/features/tierMaker/utils/saveAsListBridge';
import type { RosterDrawerPlayer } from '@/features/roster/utils';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';
import type { DraftTieramid } from '@/features/tierMaker/hooks/useTierDraft';
import {
  INITIAL_ROWS,
  MAX_ROWS,
  getInitialRows,
  getSpotsInRow,
  getTieramidPlayerId,
  normalizeRows,
  normalizeRowsForCapacity,
  type TieramidBoardPlayer,
  type TieramidRows,
  type TieramidMoveDirection,
  type NormalizedRows,
} from './utils/tieramidHelpers';
import { TieramidPool } from './TieramidPool';

type TeamOption = (typeof TeamListFull)[number];

type TieramidBoardProps = {
  onScreenshotChange?: (isScreenshotMode: boolean) => void;
  initialTierListId?: string;
  onTierListChange?: (tierListId: string) => void;
  isDraftMode?: boolean;
  draftData?: DraftTieramid | null;
  onDraftChange?: ((data: DraftTieramid) => void) | null;
  draftRestored?: boolean;
};

export const TieramidBoard = ({
  onScreenshotChange,
  initialTierListId = '',
  onTierListChange,
  isDraftMode = false,
  draftData = null,
  onDraftChange = null,
  draftRestored = true,
}: TieramidBoardProps) => {
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
      allPlayers.filter(Boolean).map((rawPlayer) => {
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

  const processedPlayersMap = useMemo(() => {
    const map: Record<string, RosterDrawerPlayer<RosterManagerPlayer>> = {};
    processedPlayers.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [processedPlayers]);

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
  const playersMap = useMemo(() => {
    const map: Record<string, RosterManagerPlayer> = {};
    allPlayers.filter(Boolean).forEach((rawPlayer) => {
      const player = rawPlayer as RosterManagerPlayer;
      map[player.id] = player;
    });
    return map;
  }, [allPlayers]);
  const tierLists = useMemo(
    () => (tierListsData || []).map((l) => ({ id: l.id, name: l.name })),
    [tierListsData]
  );

  const initialState = useMemo(() => getInitialRows(), []);
  const [rows, setRows] = useState<TieramidRows>(initialState.rows);
  const [rowOrder, setRowOrder] = useState<string[]>(initialState.rowOrder);
  const [selectedTierList, setSelectedTierList] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<TeamOption | null>(null);
  const [selectedList, setSelectedList] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAsList, setIsSavingAsList] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [screenshotMode, setScreenshotMode] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  // ── Draft mode: initialization from draftData ──────────────────────────
  const draftInitRef = useRef(false);
  const draftReportRef = useRef(false); // skip initial echo

  useEffect(() => {
    if (!isDraftMode || !draftRestored || draftInitRef.current) return;
    if (!draftData || !draftData.rows) {
      draftInitRef.current = true;
      return;
    }
    // Wait for players to be available for rehydration
    if (!processedPlayers.length) return;

    const rehydrated: TieramidRows = {};
    Object.entries(draftData.rows).forEach(([row, ids]) => {
      rehydrated[row] = (Array.isArray(ids) ? ids : [])
        .map((pid) => processedPlayersMap[pid])
        .filter(Boolean)
        .map((p) => ({ ...p, player_id: p.id }));
    });
    const order =
      Array.isArray(draftData.rowOrder) && draftData.rowOrder.length > 0
        ? draftData.rowOrder
        : Object.keys(rehydrated);
    const normalized = normalizeRows(rehydrated, order);

    // Ensure all rows in order have arrays
    normalized.rowOrder.forEach((rowKey) => {
      if (!normalized.rows[rowKey]) normalized.rows[rowKey] = [];
    });

    // Apply capacity normalization
    const capacityNormalized = normalizeRowsForCapacity(
      normalized.rows,
      normalized.rowOrder
    );

    setRows(capacityNormalized.rows);
    setRowOrder(normalized.rowOrder);
    draftInitRef.current = true;
    draftReportRef.current = true; // skip the echo from this set
  }, [
    isDraftMode,
    draftRestored,
    draftData,
    processedPlayers.length,
    processedPlayersMap,
    normalizeRowsForCapacity,
  ]);

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
      rowOrder.forEach((row) => {
        serialized[row] = (rows[row] || []).map((p) => p.player_id || p.id);
      });
      onDraftChange({ rows: serialized, rowOrder });
    }, 300);

    return () => clearTimeout(timer);
  }, [isDraftMode, onDraftChange, rows, rowOrder]);

  // Persistence
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
    rowOrder.forEach((row) => {
      dataToSave[row] = (rows[row] || []).map((p) => p.player_id || p.id);
    });
    try {
      setIsSaving(true);
      await saveTierList(
        listId,
        {
          tiers: dataToSave,
          tierOrder: rowOrder,
          mode: 'pyramid',
        },
        userId
      );
      toast.success('Pyramid saved!');
    } catch (saveError) {
      console.error('Failed to save tier list:', saveError);
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Save as List (owner-only) ────────────────────────────────────────────
  const handleSaveAsList = async () => {
    if (!userId) {
      toast.error('Save as list requires a session');
      return;
    }

    // Prompt for list name with default
    const defaultName = generateDefaultListName('pyramid');
    const name = prompt('Save as List — enter a name:', defaultName);
    if (!name) return; // User cancelled

    try {
      setIsSavingAsList(true);
      const { listId } = await saveTierAsList({
        mode: 'pyramid',
        name,
        userId,
        data: { rows, rowOrder },
      });
      toast.success(`Saved as "${name}"`);
      console.log('[TieramidBoard] Saved as list:', listId);
    } catch (err) {
      console.error('Failed to save as list:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save as list');
    } finally {
      setIsSavingAsList(false);
    }
  };

  const handleLoadTierList = useCallback(
    async (id: string) => {
      if (!id) return;
      try {
        const data = await fetchTierList(id, userId);
        if (data) {
          const newRows: TieramidRows = {};
          if (data.tiers && typeof data.tiers === 'object') {
            Object.entries(data.tiers).forEach(([row, ids]) => {
              newRows[row] = (Array.isArray(ids) ? ids : [])
                .map((pid) => processedPlayersMap[pid])
                .filter(Boolean)
                .map((player) => ({ ...player, player_id: player.id }));
            });
          }

          // First normalize to ensure Pool exists and is last
          const incomingOrder =
            Array.isArray(data.tierOrder) && data.tierOrder.length > 0
              ? data.tierOrder
              : Object.keys(newRows);
          const normalized = normalizeRows(newRows, incomingOrder);

          // Ensure all rows in order have arrays
          normalized.rowOrder.forEach((rowKey) => {
            if (!normalized.rows[rowKey]) normalized.rows[rowKey] = [];
          });

          // Then apply capacity normalization
          const capacityNormalized = normalizeRowsForCapacity(
            normalized.rows,
            normalized.rowOrder
          );

          setRows(capacityNormalized.rows);
          setRowOrder(normalized.rowOrder);
          setSelectedTierList(id);
          // Update URL with the loaded tier list
          onTierListChange?.(id);
          if (capacityNormalized.overflowCount > 0) {
            toast('Overflow players moved to Pool to avoid hidden slots.');
          }
          toast.success('Pyramid loaded!');
        }
      } catch (loadError) {
        console.error('Failed to load tier list:', loadError);
        toast.error('Failed to load');
      }
    },
    [processedPlayersMap, normalizeRowsForCapacity, onTierListChange, userId]
  );

  const {
    addPlayerToPool,
    addPlayersToPool,
    handleAddTeamRoster,
    handleAddList,
    addRow,
    deleteLastRow,
    renameRow,
    moveRowUp,
    moveRowDown,
    movePlayer,
    removePlayerToPool,
    addFromPool,
  } = useTieramidRowOps({
    rows,
    rowOrder,
    setRows,
    setRowOrder,
    allPlayers,
    lists,
    playersMap,
    selectedTeam,
    setSelectedTeam,
    selectedList,
    setSelectedList,
  });

  // NOTE: Removed auto-hydrate pool effect - Tieramid should start empty by design.
  // Players are added via: drawer, add team, add list, or loading a saved tier list.

  // Firestore auto-load: only in saved mode (not draft mode)
  useEffect(() => {
    if (isDraftMode) return; // Draft mode loads from props, not Firestore
    if (
      !initialLoaded &&
      initialTierListId &&
      tierListsData &&
      processedPlayers.length
    ) {
      handleLoadTierList(initialTierListId);
      setInitialLoaded(true);
    }
  }, [
    isDraftMode,
    initialLoaded,
    initialTierListId,
    tierListsData,
    processedPlayers.length,
    handleLoadTierList,
  ]);

  if (loading || !Array.isArray(allPlayers) || !allPlayers.length) {
    return (
      <div className="flex justify-center items-center py-10 text-white">
        Loading players...
      </div>
    );
  }

  // Style pyramid: margin each row so it is visually centered and layered
  const totalMax = getSpotsInRow(rowOrder.length - 2); // widest row
  const ROW_WIDTH = 88; // px per tile (80px width + 8px gap)
  const PYRAMID_MAX_PX = ROW_WIDTH * totalMax;
  const LABEL_GUTTER = 84; // tight left gutter for labels

  return (
    <div className="flex relative">
      {!drawerOpen && !screenshotMode && (
        <OpenDrawerButton onClick={() => setDrawerOpen(true)} />
      )}
      <DrawerShell isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <AddPlayerDrawer
          onClose={() => setDrawerOpen(false)}
          allPlayers={processedPlayers.filter(Boolean)}
          onSelect={addPlayerToPool}
        />
      </DrawerShell>
      <div
        className={`flex-1 transition-[margin] duration-300 ease-in-out ${drawerOpen ? 'ml-[300px]' : 'ml-0'}`}
      >
        <div className="flex flex-col gap-1.5 w-full max-w-[1000px] mx-auto pt-6 pb-12">
          {/* Pyramid center wrapper with backdrop and spotlight */}
          <div
            className="relative mx-auto mt-6 mb-6"
            style={{ width: `${PYRAMID_MAX_PX + LABEL_GUTTER + 80}px` }}
          >
            <div
              className={`relative rounded-xl border border-white/10 bg-[#0b0b0b]/40 shadow-[0_12px_36px_rgba(0,0,0,0.35)]`}
              style={{ width: `${PYRAMID_MAX_PX + LABEL_GUTTER + 24}px` }}
            >
              <div
                className="pointer-events-none absolute inset-0 rounded-xl"
                style={{
                  background:
                    'radial-gradient(ellipse at 50% 35%, rgba(255,255,255,0.07), rgba(255,255,255,0.02) 45%, rgba(255,255,255,0) 70%)',
                }}
              />
              <div
                className={`py-3`}
                style={{
                  paddingLeft: `${LABEL_GUTTER}px`,
                  paddingRight: '12px',
                }}
              >
                {/* Pyramid center wrapper with fixed max width so rows center visually */}
                <div
                  className="mx-auto"
                  style={{ width: `${PYRAMID_MAX_PX}px` }}
                >
                  {(rowOrder.filter((r) => r !== 'Pool').length > 0
                    ? rowOrder
                    : [
                        ...Array.from(
                          { length: INITIAL_ROWS },
                          (_, i) => `Row${i + 1}`
                        ),
                        'Pool',
                      ]
                  )
                    .filter((r) => r !== 'Pool')
                    .map((row, i) => {
                      const spots = getSpotsInRow(i);
                      const nonPoolCount = rowOrder.filter((r) => r !== 'Pool').length;
                      const occupiedCount = (rows[row] || []).filter(Boolean).length;
                      return (
                        <div
                          key={row}
                          className="relative mx-auto flex justify-center items-center mb-1"
                          style={{ width: `${ROW_WIDTH * spots}px` }}
                        >
                          {/* Absolute left label so it doesn't affect centering */}
                          <div
                            className="absolute flex flex-col items-center gap-0.5"
                            style={{
                              left: `-${LABEL_GUTTER - 6}px`,
                              width: `${LABEL_GUTTER - 10}px`,
                              top: '50%',
                              transform: 'translateY(-50%)',
                            }}
                          >
                            <div className="flex items-center gap-1">
                              {!screenshotMode && (
                                <button
                                  onClick={() => renameRow(row)}
                                  className="text-[10px] text-white bg-black/40 px-[4px] rounded hover:bg-white/10 flex-shrink-0"
                                  title="Rename Row"
                                >
                                  ✎
                                </button>
                              )}
                              <span className="text-white text-sm font-semibold whitespace-nowrap">
                                {row}
                              </span>
                            </div>
                            {!screenshotMode && (
                              <div className="flex gap-0.5">
                                <button
                                  onClick={() => moveRowUp(row)}
                                  disabled={i === 0}
                                  className="text-[10px] text-white bg-black/40 px-[3px] rounded hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed"
                                  title="Move row up"
                                >
                                  ▲
                                </button>
                                <button
                                  onClick={() => moveRowDown(row)}
                                  disabled={
                                    i >=
                                    rowOrder.filter((r) => r !== 'Pool')
                                      .length -
                                      1
                                  }
                                  className="text-[10px] text-white bg-black/40 px-[3px] rounded hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed"
                                  title="Move row down"
                                >
                                  ▼
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2 justify-center">
                            {Array.from({ length: spots }).map((_, j) => {
                              const player = rows[row][j];
                              if (!player) {
                                return (
                                  <div
                                    key={j}
                                    className="w-[80px] h-[80px] bg-slate-800/30 border border-dashed border-white/20 rounded-md flex items-center justify-center text-white/30 text-[10px]"
                                  >
                                    Empty
                                  </div>
                                );
                              }
                              return (
                                <div key={j} className="relative">
                                  <TieramidPlayerTile player={player} />
                                  {!screenshotMode && (
                                    <div className="absolute top-1 right-1 flex flex-col gap-1 bg-transparent z-10">
                                      <button
                                        onClick={() => movePlayer(i, j, 'up')}
                                        title="Move Up"
                                        disabled={i === 0}
                                        className="text-xs text-white bg-black/40 px-[4px] rounded disabled:opacity-20 disabled:cursor-not-allowed"
                                      >
                                        ↑
                                      </button>
                                      <button
                                        onClick={() => movePlayer(i, j, 'down')}
                                        title="Move Down"
                                        disabled={i >= nonPoolCount - 1}
                                        className="text-xs text-white bg-black/40 px-[4px] rounded disabled:opacity-20 disabled:cursor-not-allowed"
                                      >
                                        ↓
                                      </button>
                                      <button
                                        onClick={() => movePlayer(i, j, 'left')}
                                        title="Move Left"
                                        disabled={j === 0}
                                        className="text-xs text-white bg-black/40 px-[4px] rounded disabled:opacity-20 disabled:cursor-not-allowed"
                                      >
                                        ←
                                      </button>
                                      <button
                                        onClick={() =>
                                          movePlayer(i, j, 'right')
                                        }
                                        title="Move Right"
                                        disabled={j >= occupiedCount - 1}
                                        className="text-xs text-white bg-black/40 px-[4px] rounded disabled:opacity-20 disabled:cursor-not-allowed"
                                      >
                                        →
                                      </button>
                                      <button
                                        onClick={() =>
                                          removePlayerToPool(
                                            row,
                                            getTieramidPlayerId(player)
                                          )
                                        }
                                        title="Remove to Pool"
                                        className="text-xs text-white bg-black/40 px-[4px] rounded"
                                      >
                                        ↩
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
            {/* Add/Remove row buttons outside backdrop */}
            {!screenshotMode && (
              <div className="absolute right-0 bottom-0 flex flex-col gap-2">
                <button
                  onClick={addRow}
                  className="w-8 h-8 rounded bg-white/10 text-white hover:bg-white/20 transition-all flex items-center justify-center text-lg leading-none disabled:opacity-30 disabled:cursor-not-allowed"
                  disabled={
                    rowOrder.filter((r) => r !== 'Pool').length >= MAX_ROWS
                  }
                  title="Add Row"
                >
                  +
                </button>
                <button
                  onClick={deleteLastRow}
                  className="w-8 h-8 rounded bg-white/10 text-white hover:bg-white/20 transition-all flex items-center justify-center text-lg leading-none disabled:opacity-30 disabled:cursor-not-allowed"
                  disabled={rowOrder.filter((r) => r !== 'Pool').length <= 1}
                  title="Delete Last Row"
                >
                  −
                </button>
              </div>
            )}
          </div>

          {/* Pool row (directly under pyramid) */}
          {!screenshotMode && (
            <TieramidPool
              players={rows['Pool'] ?? []}
              onPlace={addFromPool}
            />
          )}

          {/* Controls under Pool */}
          {!screenshotMode && (
            <div className="flex items-center flex-wrap gap-2 mt-4 justify-center">
              <button
                onClick={() => handleSaveTierList()}
                className="h-8 px-3 rounded text-sm bg-white/10 text-white hover:bg-white/20 disabled:opacity-50"
                disabled={!canPersist || isSaving}
                title={canPersist ? 'Save tier list' : 'Session required to save'}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleSaveAsList}
                className="h-8 px-3 rounded text-sm bg-white/10 text-white hover:bg-white/20 disabled:opacity-50"
                disabled={!canPersist || isSavingAsList}
                title={
                  canPersist ? 'Save board as a list' : 'Session required to save'
                }
              >
                {isSavingAsList ? 'Saving...' : 'Save as List'}
              </button>
              <select
                value={selectedTierList}
                onChange={(e) => handleLoadTierList(e.target.value)}
                className="h-8 bg-[#1a1a1a] text-white text-sm px-3 rounded border border-white/10"
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
                className="h-8 px-3 rounded text-sm bg-white/10 text-white hover:bg-white/20"
              >
                New
              </button>
              <select
                value={selectedTeam?.id || ''}
                onChange={(e) =>
                  setSelectedTeam(
                    TeamListFull.find((t) => t.id === e.target.value) || null
                  )
                }
                className="h-8 bg-[#1a1a1a] text-white text-sm px-3 rounded border border-white/10"
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
                className="h-8 px-3 text-sm rounded bg-white/10 hover:bg-white/20 text-white"
              >
                Add Team
              </button>
              <select
                value={selectedList}
                onChange={(e) => setSelectedList(e.target.value)}
                className="h-8 bg-[#1a1a1a] text-white text-sm px-3 rounded border border-white/10"
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
                className="h-8 px-3 text-sm rounded bg-white/10 hover:bg-white/20 text-white"
              >
                Add List
              </button>
            </div>
          )}
          <CreateTierListModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onCreated={async (newId) => {
              setShowCreateModal(false);
              setSelectedTierList(newId);
              // Mark as loaded to prevent useEffect from re-fetching the empty doc
              setInitialLoaded(true);
              // Save current board state BEFORE navigating URL
              await handleSaveTierList(newId);
              onTierListChange?.(newId);
            }}
            mode="pyramid"
          />
        </div>
      </div>
      {!screenshotMode && (
        <div className="fixed bottom-6 left-6 z-50">
          <button
            onClick={() => {
              setScreenshotMode(true);
              if (onScreenshotChange) onScreenshotChange(true);
            }}
            className="px-4 py-2 rounded bg-black/20 text-white hover:bg-white/20"
          >
            Screenshot View
          </button>
        </div>
      )}
      {screenshotMode && (
        <div className="fixed bottom-6 left-6 z-50 group w-[160px] h-9">
          <button
            onClick={() => {
              setScreenshotMode(false);
              if (onScreenshotChange) onScreenshotChange(false);
            }}
            className="w-full h-full rounded bg-black/20 text-white opacity-0 group-hover:opacity-90 transition-opacity"
          >
            Exit Screenshot View
          </button>
        </div>
      )}
      {screenshotMode && (
        <div className="fixed top-4 right-4 z-50 opacity-0 hover:opacity-90 transition-opacity bg-black/60 text-white/80 px-3 py-1.5 rounded text-xs">
          Use your device screenshot to capture this view
        </div>
      )}
    </div>
  );
};

