import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import TieramidPlayerTile from '@/features/tierMaker/TieramidPlayerTile';
import { fetchTierList, saveTierList } from '@/firebase/listHelpers';
import useSimplePlayerData from '@/shared/hooks/useSimplePlayerData';
import useFirebaseQuery from '@/shared/hooks/useFirebaseQuery';
import { useAuth } from '@/shared/hooks/useAuth';
import { where } from 'firebase/firestore';
import CreateTierListModal from '@/features/tierMaker/CreateTierListModal';
import { TeamListFull } from '@/constants/teamList';
import { POSITION_MAP } from '@/shared/utils/roles';
import DrawerShell from '@/shared/components/ui/drawers/DrawerShell';
import OpenDrawerButton from '@/shared/components/ui/drawers/OpenDrawerButton';
import AddPlayerDrawer from '@/features/roster/AddPlayerDrawer/index.jsx';
import { toast } from 'react-hot-toast';
import { isOwnerUid } from '@/config/ownerConfig';
import {
  saveTierAsList,
  generateDefaultListName,
} from '@/features/tierMaker/utils/saveAsListBridge';

const INITIAL_ROWS = 5;
const MAX_ROWS = 10;

function getInitialRows() {
  const rows = {};
  for (let i = 1; i <= INITIAL_ROWS; i++) {
    rows[`Row${i}`] = [];
  }
  rows['Pool'] = [];
  const rowOrder = Array.from(
    { length: INITIAL_ROWS },
    (_, i) => `Row${i + 1}`
  ).concat('Pool');
  // Always normalize initial state to ensure Pool exists and is last
  return normalizeRows(rows, rowOrder);
}

const getSpotsInRow = (rowIndex) => rowIndex + 1;

/**
 * Ensures rows state always includes Pool and rowOrder always includes Pool last.
 * This prevents crashes when Pool is missing from loaded data.
 * @param {Object} rows - The rows object
 * @param {Array} rowOrder - The row order array
 * @returns {Object} - Normalized { rows, rowOrder }
 */
const normalizeRows = (rows, rowOrder) => {
  const normalizedRows = { ...rows };
  let normalizedOrder = Array.isArray(rowOrder) ? [...rowOrder] : [];

  // If no non-Pool rows exist, inject default rows (Row1..Row5)
  const nonPoolOrder = normalizedOrder.filter((r) => r !== 'Pool');
  if (nonPoolOrder.length === 0) {
    for (let i = 1; i <= INITIAL_ROWS; i++) {
      const rowKey = `Row${i}`;
      if (!normalizedOrder.includes(rowKey)) {
        normalizedOrder.push(rowKey);
      }
    }
  }

  // Ensure every row in the order has an array in rows
  normalizedOrder.forEach((row) => {
    if (!normalizedRows[row]) {
      normalizedRows[row] = [];
    }
  });

  // Ensure Pool exists in rows
  if (!normalizedRows.Pool) {
    normalizedRows.Pool = [];
  }

  // Ensure Pool is in rowOrder and is last
  normalizedOrder = normalizedOrder.filter((r) => r !== 'Pool');
  normalizedOrder.push('Pool');

  return { rows: normalizedRows, rowOrder: normalizedOrder };
};

const TieramidBoard = ({
  onScreenshotChange,
  initialTierListId = '',
  onTierListChange,
  isDraftMode = false,
  draftData = null,
  onDraftChange = null,
  draftRestored = true,
}) => {
  const { players: allPlayers, loading } = useSimplePlayerData();
  const { userId } = useAuth();
  const isOwner = isOwnerUid(userId);
  // E4: Scope list/tierList queries to ownerUid
  const ownerConstraints = useMemo(
    () => (userId ? [where('ownerUid', '==', userId)] : []),
    [userId]
  );
  const { data: listsData } = useFirebaseQuery('lists', ownerConstraints);
  const { data: tierListsData } = useFirebaseQuery(
    'tierLists',
    ownerConstraints
  );

  const processedPlayers = useMemo(
    () =>
      allPlayers.filter(Boolean).map((player) => {
        const contractData =
          player.primaryContract ||
          (player.contracts ? Object.values(player.contracts)[0] : null);
        return {
          id: player.id,
          player_id: player.id,
          name: (player.bio?.displayName || player.name || '').toLowerCase(),
          team: (player.bio?.display?.team || '').toLowerCase(),
          position:
            player.formattedPosition ||
            POSITION_MAP[player.bio?.position] ||
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
            (s) => s.year === 2025 || s.season?.startsWith('2025')
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
          extension: (player.contracts
            ? Object.values(player.contracts)
            : []
          ).find((c) => c.isExtension),
          options: contractData?.options || [],
          original: player,
        };
      }),
    [allPlayers]
  );

  const processedPlayersMap = useMemo(() => {
    const map = {};
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
    const map = {};
    allPlayers.filter(Boolean).forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [allPlayers]);
  const tierLists = useMemo(
    () => (tierListsData || []).map((l) => ({ id: l.id, name: l.name })),
    [tierListsData]
  );

  const initialState = useMemo(() => getInitialRows(), []);
  const [rows, setRows] = useState(initialState.rows);
  const [rowOrder, setRowOrder] = useState(initialState.rowOrder);
  const [selectedTierList, setSelectedTierList] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);
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

    const rehydrated = {};
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
      const serialized = {};
      rowOrder.forEach((row) => {
        serialized[row] = (rows[row] || []).map((p) => p.player_id);
      });
      onDraftChange({ rows: serialized, rowOrder });
    }, 300);

    return () => clearTimeout(timer);
  }, [isDraftMode, onDraftChange, rows, rowOrder]);

  // Persistence
  const handleSaveTierList = async (idOverride) => {
    const listId = idOverride || selectedTierList;
    if (!listId) {
      setShowCreateModal(true);
      return;
    }
    const dataToSave = {};
    rowOrder.forEach((row) => {
      dataToSave[row] = (rows[row] || []).map((p) => p.player_id);
    });
    try {
      setIsSaving(true);
      await saveTierList(
        listId,
        {
          tiers: dataToSave,
          tierOrder: rowOrder,
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
    // Defense in depth: refuse if not owner
    if (!isOwner) {
      toast.error('Only owners can save as list');
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
      toast.error(err.message || 'Failed to save as list');
    } finally {
      setIsSavingAsList(false);
    }
  };

  const normalizeRowsForCapacity = useCallback((currentRows, currentOrder) => {
    const normalized = {
      ...currentRows,
      Pool: [...(currentRows.Pool || [])],
    };
    const poolIds = new Set(
      (normalized.Pool || []).map((p) => p.player_id || p.id)
    );
    let overflowCount = 0;
    currentOrder.forEach((rowKey, rowIdx) => {
      if (rowKey === 'Pool') return;
      const spots = getSpotsInRow(rowIdx);
      const rowPlayers = (normalized[rowKey] || []).filter(Boolean);
      if (rowPlayers.length > spots) {
        const overflow = rowPlayers.slice(spots);
        normalized[rowKey] = rowPlayers.slice(0, spots);
        overflow.forEach((player) => {
          const pid = player.player_id || player.id;
          if (!poolIds.has(pid)) {
            poolIds.add(pid);
            normalized.Pool.push(player);
          }
        });
        overflowCount += overflow.length;
      } else {
        normalized[rowKey] = rowPlayers;
      }
    });
    return { rows: normalized, overflowCount };
  }, []);

  const handleLoadTierList = useCallback(
    async (id) => {
      if (!id) return;
      try {
        const data = await fetchTierList(id, userId);
        if (data) {
          const newRows = {};
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

  // Add to pool helpers
  const addPlayerToPool = (player) => {
    if (!player) return;
    const formatted = { ...player, player_id: player.id };
    setRows((prev) => {
      // Check ALL rows for duplicate
      const allIds = new Set();
      Object.values(prev).forEach((arr) =>
        (arr || [])
          .filter(Boolean)
          .forEach((p) => allIds.add(p.player_id || p.id))
      );
      if (allIds.has(player.id)) return prev;
      return {
        ...prev,
        Pool: [...(prev.Pool || []), formatted].filter(Boolean),
      };
    });
  };

  const addPlayersToPool = (playersArray) => {
    setRows((prev) => {
      // Collect IDs from ALL rows
      const allIds = new Set();
      Object.values(prev).forEach((arr) =>
        (arr || [])
          .filter(Boolean)
          .forEach((p) => allIds.add(p.player_id || p.id))
      );
      const additions = playersArray
        .filter(Boolean)
        .filter((p) => !allIds.has(p.id || p.player_id))
        .map((p) => ({ ...p, player_id: p.id || p.player_id }));
      if (additions.length === 0) return prev;
      return {
        ...prev,
        Pool: [...(prev.Pool || []), ...additions].filter(Boolean),
      };
    });
  };

  const handleAddTeamRoster = () => {
    if (!selectedTeam) return;
    const selectedTeamId = (selectedTeam.teamId || '').toUpperCase();
    const selectedTeamCode = (selectedTeam.code || '').toUpperCase();
    const teamPlayers = allPlayers.filter((player) => {
      if (!player) return false;
      const playerTeamId = (player.bio?.display?.teamId || '').toUpperCase();
      const playerTeamCode = (player.bio?.display?.team || '').toUpperCase();
      return (
        (selectedTeamId && playerTeamId === selectedTeamId) ||
        (selectedTeamCode && playerTeamCode === selectedTeamCode)
      );
    });
    addPlayersToPool(teamPlayers);
    setSelectedTeam(null);
  };

  const handleAddList = () => {
    if (!selectedList) return;
    const list = lists.find((l) => l.id === selectedList);
    if (!list) return;
    const listPlayers = (
      list.playerOrder.length ? list.playerOrder : list.playerIds
    )
      .map((id) => playersMap[id])
      .filter(Boolean);
    addPlayersToPool(listPlayers);
    setSelectedList('');
  };

  const addRow = () => {
    const currentRows = rowOrder.filter((r) => r !== 'Pool');
    if (currentRows.length >= MAX_ROWS) return;
    const newRow = `Row${currentRows.length + 1}`;
    setRows((prev) => ({ ...prev, [newRow]: [] }));
    setRowOrder((prev) => [...prev.slice(0, -1), newRow, 'Pool']);
  };

  const deleteLastRow = () => {
    const currentRows = rowOrder.filter((r) => r !== 'Pool');
    if (currentRows.length <= 1) return; // Keep at least one row
    const lastRow = currentRows[currentRows.length - 1];
    setRows((prev) => {
      const { [lastRow]: toRemove, ...rest } = prev;
      const pool = prev.Pool || [];
      return { ...rest, Pool: [...pool, ...(toRemove || [])] };
    });
    setRowOrder((prev) => prev.filter((r) => r !== lastRow));
  };

  const renameRow = (oldName) => {
    const name = prompt('Rename row', oldName);
    if (!name || name === oldName) return;
    setRows((prev) => {
      const { [oldName]: items, ...rest } = prev;
      // Ensure Pool is preserved even if somehow missing
      const newRows = { ...rest, [name]: items };
      if (!newRows.Pool) {
        newRows.Pool = [];
      }
      return newRows;
    });
    setRowOrder((prev) => prev.map((r) => (r === oldName ? name : r)));
  };

  const moveRowUp = useCallback(
    (rowKey) => {
      setRowOrder((prevOrder) => {
        const withoutPool = prevOrder.filter((r) => r !== 'Pool');
        const idx = withoutPool.indexOf(rowKey);
        if (idx <= 0) return prevOrder;
        const next = [...withoutPool];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        const newOrder = [...next, 'Pool'];
        // Re-normalize capacity after reorder
        setRows((prevRows) => {
          const result = normalizeRowsForCapacity(prevRows, newOrder);
          return result.rows;
        });
        return newOrder;
      });
    },
    [normalizeRowsForCapacity]
  );

  const moveRowDown = useCallback(
    (rowKey) => {
      setRowOrder((prevOrder) => {
        const withoutPool = prevOrder.filter((r) => r !== 'Pool');
        const idx = withoutPool.indexOf(rowKey);
        if (idx < 0 || idx >= withoutPool.length - 1) return prevOrder;
        const next = [...withoutPool];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        const newOrder = [...next, 'Pool'];
        // Re-normalize capacity after reorder
        setRows((prevRows) => {
          const result = normalizeRowsForCapacity(prevRows, newOrder);
          return result.rows;
        });
        return newOrder;
      });
    },
    [normalizeRowsForCapacity]
  );

  const movePlayer = (rowIdx, spotIdx, dir) => {
    setRows((prev) => {
      const newRows = { ...prev };
      const rowKey = rowOrder[rowIdx];
      const rowPlayers = [...prev[rowKey]];
      if (!rowPlayers[spotIdx]) return prev;
      if (dir === 'left' && spotIdx > 0) {
        [rowPlayers[spotIdx - 1], rowPlayers[spotIdx]] = [
          rowPlayers[spotIdx],
          rowPlayers[spotIdx - 1],
        ];
        newRows[rowKey] = rowPlayers;
        return newRows;
      }
      if (dir === 'right' && spotIdx < rowPlayers.length - 1) {
        [rowPlayers[spotIdx + 1], rowPlayers[spotIdx]] = [
          rowPlayers[spotIdx],
          rowPlayers[spotIdx + 1],
        ];
        newRows[rowKey] = rowPlayers;
        return newRows;
      }
      if (dir === 'up' && rowIdx > 0) {
        const spotsInPrev = getSpotsInRow(rowIdx - 1);
        const prevRowKey = rowOrder[rowIdx - 1];
        const prevRowPlayers = [...prev[prevRowKey]];
        if (prevRowPlayers.length < spotsInPrev) {
          rowPlayers.splice(spotIdx, 1);
          prevRowPlayers.push(prev[rowKey][spotIdx]);
          newRows[rowKey] = rowPlayers;
          newRows[prevRowKey] = prevRowPlayers;
          return newRows;
        } else {
          const removed = prevRowPlayers[spotsInPrev - 1];
          prevRowPlayers[spotsInPrev - 1] = rowPlayers[spotIdx];
          rowPlayers[spotIdx] = removed;
          newRows[rowKey] = rowPlayers;
          newRows[prevRowKey] = prevRowPlayers;
          return newRows;
        }
      }
      if (dir === 'down' && rowIdx < rowOrder.length - 2) {
        const spotsInNext = getSpotsInRow(rowIdx + 1);
        const nextRowKey = rowOrder[rowIdx + 1];
        const nextRowPlayers = [...prev[nextRowKey]];
        if (nextRowPlayers.length < spotsInNext) {
          rowPlayers.splice(spotIdx, 1);
          nextRowPlayers.push(prev[rowKey][spotIdx]);
          newRows[rowKey] = rowPlayers;
          newRows[nextRowKey] = nextRowPlayers;
          return newRows;
        } else {
          const removed = nextRowPlayers[spotsInNext - 1];
          nextRowPlayers[spotsInNext - 1] = rowPlayers[spotIdx];
          rowPlayers[spotIdx] = removed;
          newRows[rowKey] = rowPlayers;
          newRows[nextRowKey] = nextRowPlayers;
          return newRows;
        }
      }
      return prev;
    });
  };

  const removePlayerToPool = (rowKey, playerId) => {
    setRows((prev) => {
      const rowPlayers = prev[rowKey] || [];
      const player = rowPlayers.find((p) => p.player_id === playerId);
      if (!player) return prev;
      const pool = prev.Pool || [];
      const poolIds = new Set(pool.map((p) => p.player_id || p.id));
      return {
        ...prev,
        [rowKey]: rowPlayers.filter((p) => p.player_id !== playerId),
        Pool: poolIds.has(playerId) ? pool : [...pool, player],
      };
    });
  };

  const addFromPool = (player) => {
    // Try to place in the lowest available row (bottom-most first, pyramid-style)
    // First, check all rows from bottom to top for an open slot
    const pyramidRows = rowOrder.slice(0, -1); // exclude Pool
    let placed = false;

    // Iterate from bottom row to top row
    for (
      let rowIdx = pyramidRows.length - 1;
      rowIdx >= 0 && !placed;
      rowIdx--
    ) {
      const rowKey = pyramidRows[rowIdx];
      const spots = getSpotsInRow(rowIdx);
      if (rows[rowKey].length < spots) {
        setRows((prev) => {
          const pool = prev.Pool || [];
          return {
            ...prev,
            Pool: pool.filter((p) => p.player_id !== player.player_id),
            [rowKey]: [...prev[rowKey], player].filter(Boolean),
          };
        });
        placed = true;
      }
    }

    // If pyramid is full, evict the bottom/last player (last slot of last row)
    if (!placed) {
      setRows((prev) => {
        const lastRowIdx = pyramidRows.length - 1;
        const rowKey = pyramidRows[lastRowIdx];
        const spots = getSpotsInRow(lastRowIdx);
        const rowPlayers = prev[rowKey] || [];
        // Evict the last player in the bottom row
        const removed = rowPlayers[rowPlayers.length - 1];
        const poolIds = new Set(
          (prev.Pool || []).map((p) => p.player_id || p.id)
        );
        // Replace the last slot with the new player
        const newRowPlayers = [
          ...rowPlayers.slice(0, rowPlayers.length - 1),
          player,
        ].filter(Boolean);
        const pool = prev.Pool || [];
        return {
          ...prev,
          Pool: pool
            .filter((p) => p.player_id !== player.player_id)
            .concat(removed && !poolIds.has(removed.player_id) ? removed : []),
          [rowKey]: newRowPlayers.slice(0, spots),
        };
      });
    }
  };

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
                                        className="text-xs text-white bg-black/40 px-[4px] rounded"
                                      >
                                        ↑
                                      </button>
                                      <button
                                        onClick={() => movePlayer(i, j, 'down')}
                                        title="Move Down"
                                        className="text-xs text-white bg-black/40 px-[4px] rounded"
                                      >
                                        ↓
                                      </button>
                                      <button
                                        onClick={() => movePlayer(i, j, 'left')}
                                        title="Move Left"
                                        className="text-xs text-white bg-black/40 px-[4px] rounded"
                                      >
                                        ←
                                      </button>
                                      <button
                                        onClick={() =>
                                          movePlayer(i, j, 'right')
                                        }
                                        title="Move Right"
                                        className="text-xs text-white bg-black/40 px-[4px] rounded"
                                      >
                                        →
                                      </button>
                                      <button
                                        onClick={() =>
                                          removePlayerToPool(
                                            row,
                                            player.player_id
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
            <div className="mt-6">
              <div className="flex flex-wrap gap-2 bg-neutral-900 p-4 rounded-lg border border-white/10 min-h-[100px]">
                <span className="text-white/60 font-bold mr-4 self-start">
                  Pool
                </span>
                {rows['Pool'] && rows['Pool'].filter(Boolean).length > 0 ? (
                  rows['Pool'].filter(Boolean).map((p, idx) => (
                    <div key={p.player_id || p.id || idx} className="relative">
                      <TieramidPlayerTile player={p} />
                      <button
                        onClick={() => addFromPool(p)}
                        className="absolute top-1 left-1 px-1 py-0.5 bg-blue-700 text-xs rounded text-white"
                      >
                        Place
                      </button>
                    </div>
                  ))
                ) : (
                  <span className="text-white/40">No players</span>
                )}
              </div>
            </div>
          )}

          {/* Controls under Pool */}
          {!screenshotMode && (
            <div className="flex items-center flex-wrap gap-2 mt-4 justify-center">
              {isOwner && (
                <button
                  onClick={() => handleSaveTierList()}
                  className="h-8 px-3 rounded text-sm bg-white/10 text-white hover:bg-white/20"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              )}
              {isOwner && (
                <button
                  onClick={handleSaveAsList}
                  className="h-8 px-3 rounded text-sm bg-white/10 text-white hover:bg-white/20"
                  disabled={isSavingAsList}
                >
                  {isSavingAsList ? 'Saving...' : 'Save as List'}
                </button>
              )}
              <select
                value={selectedTierList}
                onChange={(e) => handleLoadTierList(e.target.value)}
                className="h-8 bg-[#1a1a1a] text-white text-sm px-3 rounded border border-white/10"
              >
                <option value="">Load Tier List...</option>
                {tierLists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
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

export default TieramidBoard;
