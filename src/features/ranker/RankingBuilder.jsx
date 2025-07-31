import React, { useState, useMemo } from 'react';
import usePlayerData from '@/hooks/usePlayerData.js';
import useFirebaseQuery from '@/hooks/useFirebaseQuery';
import { POSITION_MAP } from '@/utils/roles';
import { TeamListFull } from '@/constants/teamList';
import DrawerShell from '@/components/shared/ui/drawers/DrawerShell';
import OpenDrawerButton from '@/components/shared/ui/drawers/OpenDrawerButton';
import AddPlayerDrawer from '@/features/roster/AddPlayerDrawer';
import RankingSession from './RankingSession';
import TierPlayerTile from '@/features/lists/TierPlayerTile';

const RankingBuilder = () => {
  const { players: allPlayers, loading } = usePlayerData();
  const { data: listsData } = useFirebaseQuery('lists');

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

  const [pool, setPool] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedList, setSelectedList] = useState('');
  const [started, setStarted] = useState(false);

  const addPlayerToPool = (player) => {
    setPool((prev) => {
      if (prev.some((p) => p.id === player.id)) return prev;
      return [...prev, player];
    });
  };

  const addPlayersToPool = (playersArr) => {
    setPool((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const additions = playersArr.filter((p) => !existingIds.has(p.id));
      return [...prev, ...additions];
    });
  };

  const handleAddTeam = () => {
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

  const removePlayer = (id) => {
    setPool((prev) => prev.filter((p) => p.id !== id));
  };

  if (loading) {
    return <div className="p-4 text-white">Loading players...</div>;
  }

  if (started) {
    return <RankingSession playerPool={pool} />;
  }

  return (
    <div className="flex relative">
      {!drawerOpen && <OpenDrawerButton onClick={() => setDrawerOpen(true)} />}

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
        <div className="p-4 text-white max-w-[900px] mx-auto">
          <h1 className="text-3xl font-bold mb-4">Player Ranker</h1>
          <h2 className="text-xl font-semibold mb-2">Player Pool</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {pool.map((p) => (
              <div key={p.id} className="relative">
                <TierPlayerTile player={{ ...p, player_id: p.id }} />
                <button
                  onClick={() => removePlayer(p.id)}
                  className="absolute top-1 right-1 text-xs text-red-300 bg-black/40 px-[4px] rounded hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-4">
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
                onClick={handleAddTeam}
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
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setPool([])}
              className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white"
            >
              Clear Pool
            </button>
            <button
              onClick={() => setStarted(true)}
              disabled={pool.length < 2}
              className="px-4 py-2 rounded bg-black/20 hover:bg-white/20 text-white disabled:opacity-50"
            >
              Go
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RankingBuilder;
