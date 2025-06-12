// src/components/roster/RosterViewer.jsx
import React, { useEffect, useState, useMemo } from 'react';
import usePlayerData from '@/hooks/usePlayerData.js';
import AddPlayerDrawer from './AddPlayerDrawer';
import DrawerShell from '@/components/shared/ui/drawers/DrawerShell';
import OpenDrawerButton from '@/components/shared/ui/drawers/OpenDrawerButton';
import RosterControls from './RosterControls';
import RosterSection from './RosterSection';
import { isTwoWayContract, normalizePlayer, buildInitialRoster } from '@/utils/roster';
import { POSITION_MAP } from '@/utils/roles';

const RosterViewer = () => {
  const { players: allPlayers, loading: isLoading } = usePlayerData();
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

    setRoster(buildInitialRoster(teamPlayers));
  }, [selectedTeam, loadMethod, allPlayers, isLoading]);

  const addPlayerToSlot = (player, section, index) => {
    const updated = [...roster[section]];
    updated[index] = normalizePlayer(player);
    setRoster({ ...roster, [section]: updated });
  };

  const addPlayerToNextSlot = (player) => {
    const normalized = normalizePlayer(player);
    for (const section of ['starters', 'rotation', 'bench']) {
      const index = roster[section].findIndex((p) => p === null);
      if (index !== -1) {
        const updated = [...roster[section]];
        updated[index] = normalized;
        setRoster({ ...roster, [section]: updated });
        return;
      }
    }
  };

  const handleRemovePlayer = (section, index, e) => {
    e?.stopPropagation(); // Prevent event bubbling if called from a click
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
      {!drawerOpen && <OpenDrawerButton onClick={() => setDrawerOpen(true)} />}

      <DrawerShell isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <AddPlayerDrawer
          onClose={() => setDrawerOpen(false)}
          allPlayers={processedPlayers}
          onSelect={(player) => {
            const isManualTarget =
              slotTarget.section && slotTarget.index !== -1;
            if (isManualTarget) {
              addPlayerToSlot(
                player, // Use player directly instead of player.original
                slotTarget.section,
                slotTarget.index
              );
              setSlotTarget({ section: '', index: -1 });
              setDrawerOpen(false);
            } else {
              addPlayerToNextSlot(player); // Use player directly instead of player.original
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

          <RosterControls
            selectedTeam={selectedTeam}
            onTeamChange={setSelectedTeam}
            loadMethod={loadMethod}
            onLoadMethodChange={setLoadMethod}
          />

          <RosterSection
            players={roster.starters}
            section="starters"
            onRemove={handleRemovePlayer}
            onAdd={handleOpenDrawer}
          />

          <RosterSection
            players={roster.rotation}
            section="rotation"
            onRemove={handleRemovePlayer}
            onAdd={handleOpenDrawer}
          />

          <RosterSection
            players={roster.bench}
            section="bench"
            onRemove={handleRemovePlayer}
            onAdd={handleOpenDrawer}
          />
        </div>
      </div>
    </div>
  );
};

export default RosterViewer;
