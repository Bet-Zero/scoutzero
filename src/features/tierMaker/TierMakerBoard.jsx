// src/features/tierMaker/TierMakerBoard.jsx

import React, { useState, useMemo, useEffect } from 'react';
import TierRow from '@/features/tierMaker/TierRow';
import usePlayerData from '@/hooks/usePlayerData.js';
import useFirebaseQuery from '@/hooks/useFirebaseQuery';
import { POSITION_MAP } from '@/utils/roles';
import { TeamListFull } from '@/constants/teamList';
import DrawerShell from '@/components/shared/ui/drawers/DrawerShell';
import OpenDrawerButton from '@/components/shared/ui/drawers/OpenDrawerButton';
import AddPlayerDrawer from '@/features/roster/AddPlayerDrawer';
import CreateTierListModal from '@/features/tierMaker/CreateTierListModal';
import { fetchTierList, saveTierList } from '@/firebase/listHelpers';
import { toast } from 'react-hot-toast';

const DEFAULT_TIERS = ['S', 'A', 'B', 'C', 'D'];

const TierMakerBoard = ({ players = [], initialTierListId = '' }) => {
  const { players: allPlayers, loading } = usePlayerData();
  const { data: listsData } = useFirebaseQuery('lists');
  const { data: tierListsData } = useFirebaseQuery('tierLists');

  const processedPlayers = useMemo(
    () =>
      allPlayers.map((player) => ({
        id: player.id,
        player_id: player.id,
        name: (player.display_name || player.name || '').toLowerCase(),
        team: (player.bio?.Team || '').toLowerCase(),
        position:
          POSITION_MAP[player.bio?.Position] || player.bio?.Position || '',
        offenseRoles: [
          player.roles?.offense1?.toLowerCase() || '',
          player.roles?.offense2?.toLowerCase() || '',
        ],
        defenseRoles: [
          player.roles?.defense1?.toLowerCase() || '',
          player.roles?.defense2?.toLowerCase() || '',
        ],
        offenseSubroles: player.subRoles?.offense || [],
        defenseSubroles: player.subRoles?.defense || [],
        shootingProfile: (player.shootingProfile || '').toLowerCase(),
        badges: player.badges || [],
        salary: player.contract?.annual_salaries?.find((s) => s.year === 2025)
          ?.salary,
        freeAgentYear: player.free_agency_year?.toString(),
        freeAgentType: player.free_agent_type?.toLowerCase(),
        contractType: player.contract?.type?.toLowerCase(),
        extension: player.contract?.extension,
        options: player.contract?.options || [],
        original: player,
      })),
    [allPlayers]
  );

  const playersMap = useMemo(() => {
    const map = {};
    allPlayers.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [allPlayers]);

  const lists = useMemo(
    () =>
      (listsData || []).map((l) => {
        const orderIds = l.playerOrder || [];
        const allIds = l.playerIds || [];
        const merged = [...orderIds];
        allIds.forEach((id) => {
          if (!merged.includes(id)) merged.push(id);
        });
        return {
          id: l.id,
          name: l.name,
          playerIds: merged,
        };
      }),
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

  const getInitialTiers = () =>
    [...DEFAULT_TIERS, 'Pool'].reduce((acc, tier) => {
      acc[tier] = tier === 'Pool' ? [...players] : [];
      return acc;
    }, {});

  const [tiers, setTiers] = useState(getInitialTiers);
  const [tierOrder, setTierOrder] = useState([...DEFAULT_TIERS, 'Pool']);
  const [screenshotMode, setScreenshotMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedList, setSelectedList] = useState('');
  const [selectedTierList, setSelectedTierList] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const addPlayerToPool = (player) => {
    const formatted = { ...player, player_id: player.id };
    setTiers((prev) => ({
      ...prev,
      Pool: [...prev.Pool, formatted],
    }));
  };

  const addPlayersToPool = (playersArray) => {
    setTiers((prev) => {
      const existingIds = new Set(prev.Pool.map((p) => p.player_id));
      const additions = playersArray
        .filter((p) => !existingIds.has(p.id))
        .map((p) => ({ ...p, player_id: p.id }));
      return { ...prev, Pool: [...prev.Pool, ...additions] };
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
    setTiers((prev) => ({
      ...prev,
      [fromTier]: prev[fromTier].filter((p) => p.player_id !== playerId),
    }));
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
      return { ...rest, Pool: [...prev.Pool, ...(removed || [])] };
    });
    setTierOrder((prev) => prev.filter((t) => t !== tier));
  };

  const renameTier = (tier) => {
    const name = prompt('Rename tier', tier);
    if (!name || name === tier) return;
    setTiers((prev) => {
      const { [tier]: items, ...rest } = prev;
      return { ...rest, [name]: items };
    });
    setTierOrder((prev) => prev.map((t) => (t === tier ? name : t)));
  };

  const resetBoard = () => {
    setTiers(getInitialTiers());
    setTierOrder([...DEFAULT_TIERS, 'Pool']);
  };

  const handleAddTeamRoster = () => {
    if (!selectedTeam) return;
    const teamPlayers = allPlayers.filter(
      (p) => (p.bio?.Team || '').toLowerCase() === selectedTeam.id
    );
    addPlayersToPool(teamPlayers);
    setSelectedTeam(null);
  };

  const handleAddList = () => {
    if (!selectedList) return;
    const list = lists.find((l) => l.id === selectedList);
    if (!list) return;
    const listPlayers = list.playerIds
      .map((id) => playersMap[id])
      .filter(Boolean);
    addPlayersToPool(listPlayers);
    setSelectedList('');
  };

  const handleLoadTierList = async (id) => {
    if (!id) return;
    try {
      const data = await fetchTierList(id);
      if (data?.tiers) {
        const newTiers = {};
        Object.entries(data.tiers).forEach(([tier, ids]) => {
          newTiers[tier] = ids
            .map((pid) => playersMap[pid])
            .filter(Boolean)
            .map((p) => ({ ...p, player_id: p.id }));
        });
        setTiers(newTiers);
        setTierOrder(data.tierOrder || Object.keys(newTiers));
        setSelectedTierList(id);
        toast.success('Tier list loaded!');
      }
    } catch (err) {
      console.error('Failed to load tier list', err);
      toast.error('Failed to load tier list');
    }
  };

  const handleSaveTierList = async (idOverride) => {
    const listId = idOverride || selectedTierList;
    if (!listId) {
      setShowCreateModal(true);
      return;
    }
    const dataToSave = {};
    Object.keys(tiers).forEach((t) => {
      dataToSave[t] = tiers[t].map((p) => p.player_id);
    });
    try {
      setIsSaving(true);
      await saveTierList(listId, {
        tiers: dataToSave,
        tierOrder,
      });
      toast.success('Tier list saved!');
    } catch (err) {
      console.error('Failed to save tier list', err);
      toast.error('Failed to save tier list');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateAndSave = async (newId) => {
    if (!newId) return;
    setSelectedTierList(newId);
    setShowCreateModal(false);
    await handleSaveTierList(newId);
  };

  useEffect(() => {
    if (
      !initialLoaded &&
      initialTierListId &&
      tierListsData &&
      allPlayers.length
    ) {
      handleLoadTierList(initialTierListId);
      setInitialLoaded(true);
    }
  }, [initialLoaded, initialTierListId, tierListsData, allPlayers.length]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10 text-white">
        Loading players...
      </div>
    );
  }

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
        <div className="flex flex-col gap-2 w-full max-w-[1000px] mx-auto pt-6 pb-12x">
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

          {tierOrder.map((tier) => (
            <TierRow
              key={tier}
              tier={tier}
              players={tiers[tier]}
              screenshotMode={screenshotMode}
              movePlayer={movePlayer}
              removePlayer={removePlayer}
              renameTier={renameTier}
              deleteTier={deleteTier}
            />
          ))}

          {!screenshotMode && (
            <div className="flex items-center gap-2 flex-wrap mt-4 justify-center">
              <div className="flex items-center gap-1">
                <select
                  value={selectedTeam?.id || ''}
                  onChange={(e) => setSelectedTeam(TeamListFull.find((t) => t.id === e.target.value) || null)}
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
                      {l.name}
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
            onClick={() => setScreenshotMode(!screenshotMode)}
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

      {!screenshotMode && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => handleSaveTierList()}
            className="bg-black/20 text-white px-4 py-2 rounded hover:bg-white/20"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}

      <CreateTierListModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleCreateAndSave}
      />
    </div>
  );
};

export default TierMakerBoard;
