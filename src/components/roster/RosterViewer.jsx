// src/components/roster/RosterViewer.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import PlayerCard from './PlayerCard';
import EmptySlot from './EmptySlot';
import AddPlayerDrawer from './AddPlayerDrawer';
import DrawerShell from './DrawerShell';
import { isTwoWayContract } from '../../utils/contractUtils.js';

// Position mapping
const POSITION_MAP = {
  Guard: 'G',
  'Point Guard': 'PG',
  'Shooting Guard': 'SG',
  Forward: 'F',
  'Small Forward': 'SF',
  'Power Forward': 'PF',
  Center: 'C',
  'Forward-Center': 'F/C',
  'Guard-Forward': 'G/F',
};

const RosterViewer = () => {
  const [allPlayers, setAllPlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roster, setRoster] = useState({
    starters: [null, null, null, null, null],
    rotation: [null, null, null, null],
    bench: [null, null, null, null, null, null],
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [slotTarget, setSlotTarget] = useState({ section: '', index: -1 });
  const [selectedTeam, setSelectedTeam] = useState('');
  const [loadMethod, setLoadMethod] = useState('current');

  // Pre-process all players data once when loaded
  const processedPlayers = useMemo(() => {
    return allPlayers.map((player) => ({
      id: player.id,
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
    }));
  }, [allPlayers]);

  useEffect(() => {
    const fetchAllPlayers = async () => {
      try {
        setIsLoading(true);
        const snapshot = await getDocs(collection(db, 'players'));
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAllPlayers(data);
      } catch (error) {
        console.error('Error fetching players:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllPlayers();
  }, []);

  useEffect(() => {
    if (!selectedTeam || isLoading || allPlayers.length === 0) return;

    const rawTeamPlayers = allPlayers.filter(
      (p) => p.bio?.Team?.toLowerCase() === selectedTeam.toLowerCase()
    );

    const teamPlayers = rawTeamPlayers
      .filter((p) => !isTwoWayContract(p))
      .sort(
        (a, b) =>
          parseFloat(b.system?.stats?.MP || 0) -
          parseFloat(a.system?.stats?.MP || 0)
      );

    if (loadMethod === 'blank') {
      setRoster({
        starters: [null, null, null, null, null],
        rotation: [null, null, null, null],
        bench: [null, null, null, null, null, null],
      });
      return;
    }

    const normalizePlayer = (p) => ({
      ...p,
      display_name: p.display_name || p.name || 'Unknown Player',
      headshot: p.headshot || `/assets/headshots/${p.id}.png`,
      bio: {
        ...p.bio,
        Position: p.bio?.Position || 'Unknown',
      },
    });

    const getPosition = (p) => (p.bio?.Position || '').toUpperCase();

    const starterSlots = [null, null, null, null, null];
    const positionPriorities = [
      { test: (pos) => pos.includes('G') && !pos.includes('F'), slots: [0, 1] },
      { test: (pos) => pos.includes('G/F'), slots: [2] },
      { test: (pos) => pos.includes('F') && !pos.includes('C'), slots: [3] },
      { test: (pos) => pos.includes('F/C') || pos.includes('C'), slots: [4] },
    ];

    for (const player of teamPlayers.slice(0, 5)) {
      const pos = getPosition(player);
      let assigned = false;

      for (const { test, slots } of positionPriorities) {
        if (test(pos)) {
          for (const slot of slots) {
            if (starterSlots[slot] === null) {
              starterSlots[slot] = player;
              assigned = true;
              break;
            }
          }
          if (assigned) break;
        }
      }

      if (!assigned) {
        const nextEmpty = starterSlots.findIndex((s) => s === null);
        if (nextEmpty !== -1) starterSlots[nextEmpty] = player;
      }
    }

    const starterIds = new Set(starterSlots.map((p) => p?.id).filter(Boolean));
    const remainingPlayers = teamPlayers.filter((p) => !starterIds.has(p.id));

    setRoster({
      starters: starterSlots.map((p) => (p ? normalizePlayer(p) : null)),
      rotation: remainingPlayers.slice(0, 4).map(normalizePlayer),
      bench: remainingPlayers.slice(4, 10).map(normalizePlayer),
    });
  }, [selectedTeam, loadMethod, allPlayers, isLoading]);

  const addPlayerToSlot = (player, section, index) => {
    const updated = [...roster[section]];
    updated[index] = {
      ...player,
      display_name: player.display_name || player.name || 'Unknown Player',
      headshot: player.headshot || `/assets/headshots/${player.id}.png`,
      bio: {
        ...player.bio,
        Position: player.bio?.Position || 'Unknown',
      },
    };
    setRoster({ ...roster, [section]: updated });
  };

  const addPlayerToNextSlot = (player) => {
    const enriched = {
      ...player,
      display_name: player.display_name || player.name || 'Unknown Player',
      headshot: player.headshot || `/assets/headshots/${player.id}.png`,
      bio: {
        ...player.bio,
        Position: player.bio?.Position || 'Unknown',
      },
    };

    for (const section of ['starters', 'rotation', 'bench']) {
      const index = roster[section].findIndex((p) => p === null);
      if (index !== -1) {
        const updated = [...roster[section]];
        updated[index] = enriched;
        setRoster({ ...roster, [section]: updated });
        return;
      }
    }
  };

  const handleRemovePlayer = (section, index) => {
    const updated = [...roster[section]];
    updated[index] = null;
    setRoster({ ...roster, [section]: updated });
  };

  const handleOpenDrawer = (section, index) => {
    setSlotTarget({ section, index });
    setDrawerOpen(true);
  };

  const handleOpenDrawerGeneral = () => {
    setSlotTarget({ section: '', index: -1 });
    setDrawerOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-white">Loading players...</div>
      </div>
    );
  }

  return (
    <div className="flex relative">
      {!drawerOpen && (
        <button
          onClick={() => setDrawerOpen(true)}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-30 bg-blue-600 hover:bg-blue-500 text-white shadow-lg transition-all duration-200 hover:translate-x-1 group rounded-r-lg"
          style={{ transition: 'all 0.3s ease-in-out' }}
          title="Open player drawer"
        >
          <div className="flex flex-col items-center py-3 px-1.5 gap-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="opacity-80"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </button>
      )}

      <DrawerShell isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <AddPlayerDrawer
          onClose={() => setDrawerOpen(false)}
          allPlayers={processedPlayers}
          onSelect={(player) => {
            const isManualTarget =
              slotTarget.section && slotTarget.index !== -1;
            if (isManualTarget) {
              addPlayerToSlot(
                player.original,
                slotTarget.section,
                slotTarget.index
              );
              setSlotTarget({ section: '', index: -1 });
              setDrawerOpen(false);
            } else {
              addPlayerToNextSlot(player.original);
            }
          }}
        />
      </DrawerShell>

      <div
        className={`flex-1 transition-[margin] duration-300 ease-in-out ${
          drawerOpen ? 'ml-[300px]' : 'ml-0'
        }`}
      >
        <div className="max-w-[1300px] mx-auto text-white p-6 flex flex-col items-center">
          <h2 className="text-3xl font-bold mb-8 tracking-wide">Team Roster</h2>

          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex gap-2 items-center">
              <label className="text-sm text-white/60">Team:</label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="bg-[#1a1a1a] text-white text-sm px-3 py-1 rounded border border-white/10"
              >
                <option value="">— Select Team —</option>
                {[
                  'Lakers',
                  'Warriors',
                  'Celtics',
                  'Nuggets',
                  'Heat',
                  'Bucks',
                  'Knicks',
                  'Suns',
                  '76ers',
                  'Clippers',
                  'Kings',
                  'Mavericks',
                  'Grizzlies',
                  'Pelicans',
                  'Timberwolves',
                  'Thunder',
                  'Cavaliers',
                  'Raptors',
                  'Spurs',
                  'Bulls',
                  'Magic',
                  'Hawks',
                  'Wizards',
                  'Hornets',
                  'Jazz',
                  'Blazers',
                  'Pistons',
                  'Pacers',
                  'Rockets',
                  'Nets',
                ]
                  .sort()
                  .map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex gap-2 items-center">
              <label className="text-sm text-white/60">Load Roster From:</label>
              <select
                value={loadMethod}
                onChange={(e) => setLoadMethod(e.target.value)}
                className="bg-[#1a1a1a] text-white text-sm px-3 py-1 rounded border border-white/10"
              >
                <option value="current">Current NBA Roster</option>
                <option value="blank">Blank Roster</option>
              </select>
            </div>
          </div>

          <div className="flex justify-center gap-4 mb-10">
            {roster.starters.map((player, idx) =>
              player ? (
                <PlayerCard
                  key={player.id}
                  player={player}
                  size="starter"
                  onRemove={() => handleRemovePlayer('starters', idx)}
                />
              ) : (
                <EmptySlot
                  key={`starters-${idx}`}
                  size="starter"
                  onAdd={() => handleOpenDrawer('starters', idx)}
                />
              )
            )}
          </div>

          <div className="flex justify-center gap-1 mb-8">
            {roster.rotation.map((player, idx) =>
              player ? (
                <PlayerCard
                  key={player.id}
                  player={player}
                  size="rotation"
                  onRemove={() => handleRemovePlayer('rotation', idx)}
                />
              ) : (
                <EmptySlot
                  key={`rotation-${idx}`}
                  size="rotation"
                  onAdd={() => handleOpenDrawer('rotation', idx)}
                />
              )
            )}
          </div>

          <div className="flex justify-center gap-0.5">
            {roster.bench.map((player, idx) =>
              player ? (
                <PlayerCard
                  key={player.id}
                  player={player}
                  size="bench"
                  onRemove={() => handleRemovePlayer('bench', idx)}
                />
              ) : (
                <EmptySlot
                  key={`bench-${idx}`}
                  size="bench"
                  onAdd={() => handleOpenDrawer('bench', idx)}
                />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RosterViewer;
