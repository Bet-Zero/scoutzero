import React, { useState, useMemo } from 'react';
import TieramidPlayerTile from '@/features/tierMaker/TieramidPlayerTile';
import { fetchTierList, saveTierList } from '@/firebase/listHelpers';
import useSimplePlayerData from '@/hooks/useSimplePlayerData';
import useFirebaseQuery from '@/hooks/useFirebaseQuery';
import CreateTierListModal from '@/features/tierMaker/CreateTierListModal';
import { TeamListFull } from '@/constants/teamList';
import { POSITION_MAP } from '@/utils/roles';
import DrawerShell from '@/components/shared/ui/drawers/DrawerShell';
import OpenDrawerButton from '@/components/shared/ui/drawers/OpenDrawerButton';
import AddPlayerDrawer from '@/features/roster/AddPlayerDrawer/index.jsx';
import { toast } from 'react-hot-toast';

const INITIAL_ROWS = 5;
const MAX_ROWS = 10;

function getInitialRows(players = []) {
  const rows = {};
  for (let i = 1; i <= INITIAL_ROWS; i++) {
    rows[`Row${i}`] = [];
  }
  rows['Pool'] = [...players.filter(Boolean)];
  return rows;
}

const getSpotsInRow = (rowIndex) => rowIndex + 1;

const TieramidBoard = ({ onScreenshotChange }) => {
  const { players: allPlayers, loading } = useSimplePlayerData();
  const { data: listsData } = useFirebaseQuery('lists');
  const { data: tierListsData } = useFirebaseQuery('tierLists');

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

  const [rows, setRows] = useState(getInitialRows(processedPlayers));
  const [rowOrder, setRowOrder] = useState(
    Array.from({ length: INITIAL_ROWS }, (_, i) => `Row${i + 1}`).concat('Pool')
  );
  const [selectedTierList, setSelectedTierList] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedList, setSelectedList] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [screenshotMode, setScreenshotMode] = useState(false);

  if (loading || !Array.isArray(allPlayers) || !allPlayers.length) {
    return (
      <div className="flex justify-center items-center py-10 text-white">
        Loading players...
      </div>
    );
  }

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
      await saveTierList(listId, {
        tiers: dataToSave,
        tierOrder: rowOrder,
      });
      toast.success('Pyramid saved!');
    } catch (err) {
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadTierList = async (id) => {
    if (!id) return;
    try {
      const data = await fetchTierList(id);
      if (data?.tiers) {
        const newRows = {};
        Object.entries(data.tiers).forEach(([row, ids]) => {
          newRows[row] = ids
            .map((pid) => processedPlayers.find((p) => p.id === pid))
            .filter(Boolean);
        });
        setRows(newRows);
        setRowOrder(data.tierOrder || Object.keys(newRows));
        setSelectedTierList(id);
        toast.success('Pyramid loaded!');
      }
    } catch (err) {
      toast.error('Failed to load');
    }
  };

  // Add to pool helpers
  const addPlayerToPool = (player) => {
    if (!player) return;
    const formatted = { ...player, player_id: player.id };
    setRows((prev) => ({
      ...prev,
      Pool: [...prev.Pool, formatted].filter(Boolean),
    }));
  };

  const addPlayersToPool = (playersArray) => {
    setRows((prev) => {
      const existingIds = new Set((prev.Pool || []).map((p) => p.player_id));
      const additions = playersArray
        .filter(Boolean)
        .filter((p) => !existingIds.has(p.id))
        .map((p) => ({ ...p, player_id: p.id }));
      return { ...prev, Pool: [...prev.Pool, ...additions].filter(Boolean) };
    });
  };

  const handleAddTeamRoster = () => {
    if (!selectedTeam) return;
    const teamPlayers = allPlayers
      .filter(Boolean)
      .filter(
        (p) => (p.bio?.display?.team || '').toLowerCase() === selectedTeam.id
      );
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
      return { ...rest, Pool: [...prev.Pool, ...(toRemove || [])] };
    });
    setRowOrder((prev) => prev.filter((r) => r !== lastRow));
  };

  const renameRow = (oldName) => {
    const name = prompt('Rename row', oldName);
    if (!name || name === oldName) return;
    setRows((prev) => {
      const { [oldName]: items, ...rest } = prev;
      return { ...rest, [name]: items };
    });
    setRowOrder((prev) => prev.map((r) => (r === oldName ? name : r)));
  };

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

  const addFromPool = (player) => {
    let placed = false;
    rowOrder.slice(0, -1).forEach((rowKey, rowIdx) => {
      if (!placed) {
        const spots = getSpotsInRow(rowIdx);
        if (rows[rowKey].length < spots) {
          setRows((prev) => ({
            ...prev,
            Pool: prev.Pool.filter((p) => p.player_id !== player.player_id),
            [rowKey]: [...prev[rowKey], player].filter(Boolean),
          }));
          placed = true;
        }
      }
    });
    if (!placed) {
      setRows((prev) => {
        const rowKey = rowOrder[0];
        const spots = getSpotsInRow(0);
        const rowPlayers = prev[rowKey];
        const removed = rowPlayers[spots - 1];
        return {
          ...prev,
          Pool: prev.Pool.filter(
            (p) => p.player_id !== player.player_id
          ).concat(removed),
          [rowKey]: [...rowPlayers.slice(0, spots - 1), player].filter(Boolean),
        };
      });
    }
  };

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
        <div className="flex flex-col gap-1.5 w-full max-w-[1000px] mx-auto pt-6 pb-12x">
          {/* Pyramid center wrapper with backdrop and spotlight */}
          <div className="relative mx-auto mt-6 mb-6" style={{ width: `${PYRAMID_MAX_PX + LABEL_GUTTER + 80}px` }}>
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
              style={{ paddingLeft: `${LABEL_GUTTER}px`, paddingRight: '12px' }}
            >
              {/* Pyramid center wrapper with fixed max width so rows center visually */}
              <div className="mx-auto" style={{ width: `${PYRAMID_MAX_PX}px` }}>
                {rowOrder
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
                          className="absolute flex items-center gap-1"
                          style={{
                            left: `-${LABEL_GUTTER - 6}px`,
                            width: `${LABEL_GUTTER - 10}px`,
                            top: '50%',
                            transform: 'translateY(-50%)',
                          }}
                        >
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
                                    onClick={() => movePlayer(i, j, 'right')}
                                    title="Move Right"
                                    className="text-xs text-white bg-black/40 px-[4px] rounded"
                                  >
                                    →
                                  </button>
                                </div>
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
                  disabled={rowOrder.filter((r) => r !== 'Pool').length >= MAX_ROWS}
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
              <button
                onClick={() => handleSaveTierList()}
                className="h-8 px-3 rounded text-sm bg-white/10 text-white hover:bg-white/20"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
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
            onCreated={(newId) => {
              setShowCreateModal(false);
              setSelectedTierList(newId);
              handleSaveTierList(newId);
            }}
          />
        </div>
      </div>
      {!screenshotMode && (
        <div className="fixed bottom-6 left-6 z-50">
          <button
            onClick={() => {
              setScreenshotMode(true);
              onScreenshotChange && onScreenshotChange(true);
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
              onScreenshotChange && onScreenshotChange(false);
            }}
            className="w-full h-full rounded bg-black/20 text-white opacity-0 group-hover:opacity-90 transition-opacity"
          >
            Exit Screenshot View
          </button>
        </div>
      )}
    </div>
  );
};

export default TieramidBoard;
