import React, { useState, useMemo } from 'react';
import useSimplePlayerData from '@/shared/hooks/useSimplePlayerData';
import useFirebaseQuery from '@/shared/hooks/useFirebaseQuery';
import { useAuth } from '@/shared/hooks/useAuth';
import { where } from 'firebase/firestore';
import { POSITION_MAP } from '@/shared/utils/roles';
import { TeamListFull } from '@/constants/teamList';
import DrawerShell from '@/shared/components/ui/drawers/DrawerShell';
import OpenDrawerButton from '@/shared/components/ui/drawers/OpenDrawerButton';
import AddPlayerDrawer from '@/features/roster/AddPlayerDrawer';
import RankingSession from './RankingSession';
import TierPlayerTile from '@/features/lists/TierPlayerTile';

// ─── Pool Card ────────────────────────────────────────────────────────────────

const PoolCard = ({ player, onRemove }) => (
  <div className="relative group">
    <TierPlayerTile player={{ ...player, player_id: player.id }} />
    <button
      onClick={() => onRemove(player.id)}
      title="Remove player"
      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-neutral-700 border border-white/20 text-white/50 hover:bg-red-600 hover:text-white hover:border-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 text-[10px] font-bold leading-none"
    >
      ✕
    </button>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const RankingBuilder = () => {
  const { players: allPlayers, loading } = useSimplePlayerData();
  const { userId } = useAuth();

  const ownerConstraints = useMemo(
    () => (userId ? [where('ownerUid', '==', userId)] : []),
    [userId]
  );
  const { data: listsData } = useFirebaseQuery('lists', ownerConstraints);

  const processedPlayers = useMemo(
    () =>
      allPlayers.map((player) => {
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

  const playersMap = useMemo(() => {
    const map = {};
    allPlayers.forEach((p) => { map[p.id] = p; });
    return map;
  }, [allPlayers]);

  const lists = useMemo(
    () =>
      (listsData || []).map((l) => {
        const orderIds = l.playerOrder || [];
        const allIds = l.playerIds || [];
        const merged = [...orderIds];
        allIds.forEach((id) => { if (!merged.includes(id)) merged.push(id); });
        return { id: l.id, name: l.name, playerIds: merged };
      }),
    [listsData]
  );

  const [pool, setPool] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('');
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
      return [...prev, ...playersArr.filter((p) => !existingIds.has(p.id))];
    });
  };

  const handleAddTeam = () => {
    if (!selectedTeamId) return;
    const team = TeamListFull.find((t) => t.id === selectedTeamId);
    if (!team) return;
    const teamCode = (team.code || team.teamId || '').toUpperCase();
    const teamPlayers = allPlayers.filter(
      (p) => (p.bio?.display?.teamId || '').toUpperCase() === teamCode
    );
    addPlayersToPool(teamPlayers);
    setSelectedTeamId('');
  };

  const handleAddList = () => {
    if (!selectedList) return;
    const list = lists.find((l) => l.id === selectedList);
    if (!list) return;
    addPlayersToPool(list.playerIds.map((id) => playersMap[id]).filter(Boolean));
    setSelectedList('');
  };

  const removePlayer = (id) => setPool((prev) => prev.filter((p) => p.id !== id));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-white/30 text-sm">
        Loading players…
      </div>
    );
  }

  if (started) {
    return <RankingSession playerPool={pool} />;
  }

  const canStart = pool.length >= 2;

  return (
    <div className="flex relative">
      {!drawerOpen && <OpenDrawerButton onClick={() => setDrawerOpen(true)} />}

      <DrawerShell isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <AddPlayerDrawer
          onClose={() => setDrawerOpen(false)}
          allPlayers={processedPlayers}
          onSelect={addPlayerToPool}
          onSelectAll={addPlayersToPool}
        />
      </DrawerShell>

      <div
        className={`flex-1 transition-[margin] duration-300 ease-in-out ${
          drawerOpen ? 'ml-[300px]' : 'ml-0'
        }`}
      >
        <div className="px-6 py-8 text-white max-w-[900px] mx-auto">

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-1.5">Player Ranker</h1>
              <p className="text-white/40 text-sm">
                Build a pool, then rank players head-to-head.
              </p>
            </div>
            {pool.length > 0 && (
              <span className="mt-1 px-3 py-1 rounded-full bg-white/[0.07] border border-white/[0.1] text-white/45 text-sm font-medium flex-shrink-0">
                {pool.length} player{pool.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* ── Add to Pool ─────────────────────────────────────────────────── */}
          <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.07] mb-5">
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/35 block mb-4">
              Add to Pool
            </span>
            <div className="flex flex-col sm:flex-row gap-3">

              {/* By Team */}
              <div className="flex gap-2 flex-1 min-w-0">
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="flex-1 min-w-0 appearance-none bg-white/[0.05] text-white text-sm px-3 py-2 rounded-lg border border-white/[0.1] focus:outline-none focus:border-white/25 transition-all cursor-pointer"
                >
                  <option value="" className="bg-[#1a1a1a] text-white/50">Team…</option>
                  {TeamListFull.map((team) => (
                    <option key={team.id} value={team.id} className="bg-[#1a1a1a] text-white">
                      {team.teamName}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddTeam}
                  disabled={!selectedTeamId}
                  className="px-3 py-2 text-sm rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all font-medium"
                >
                  Add
                </button>
              </div>

              {/* By List */}
              <div className="flex gap-2 flex-1 min-w-0">
                <select
                  value={selectedList}
                  onChange={(e) => setSelectedList(e.target.value)}
                  className="flex-1 min-w-0 appearance-none bg-white/[0.05] text-white text-sm px-3 py-2 rounded-lg border border-white/[0.1] focus:outline-none focus:border-white/25 transition-all cursor-pointer"
                >
                  <option value="" className="bg-[#1a1a1a] text-white/50">List…</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id} className="bg-[#1a1a1a] text-white">
                      {l.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddList}
                  disabled={!selectedList}
                  className="px-3 py-2 text-sm rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all font-medium"
                >
                  Import
                </button>
              </div>

            </div>
          </div>

          {/* ── Player Pool ─────────────────────────────────────────────────── */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/35">
                Pool
              </span>
              {pool.length > 0 && (
                <button
                  onClick={() => setPool([])}
                  className="text-xs text-white/25 hover:text-red-400 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {pool.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-white/[0.08]">
                <p className="text-white/20 text-sm mb-1">No players in the pool</p>
                <p className="text-white/12 text-xs">
                  Add a team, import a list, or use the drawer on the left
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {pool.map((p) => (
                  <PoolCard key={p.id} player={p} onRemove={removePlayer} />
                ))}
              </div>
            )}
          </div>

          {/* ── CTA ─────────────────────────────────────────────────────────── */}
          <div className="flex flex-col items-center gap-2.5">
            <button
              onClick={() => setStarted(true)}
              disabled={!canStart}
              className="px-10 py-3.5 rounded-xl bg-white text-black font-bold text-sm tracking-tight hover:bg-white/90 active:scale-[0.98] transition-all shadow-xl disabled:opacity-25 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              Start Ranking →
            </button>
            {!canStart && (
              <p className="text-white/20 text-xs">Add at least 2 players to begin</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default RankingBuilder;
