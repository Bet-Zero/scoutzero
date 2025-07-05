// PlayerProfileView.jsx

import React, { useState, useEffect, useCallback } from 'react';
import usePlayerData from '@/hooks/usePlayerData.js';
import useAutoSavePlayer from '@/hooks/useAutoSavePlayer';

import TeamPlayerDropdowns from '@/features/profile/TeamPlayerDropdowns';
import PlayerNavigation from '@/features/profile/PlayerNavigation';
import PlayerDetails from '@/features/profile/PlayerDetails';
import BreakdownModal from '@/features/profile/BreakdownModal';
import { getPlayersForTeam } from '@/utils/profileHelpers';
import PlayerSearchBar from '@/features/profile/PlayerSearchBar';

const defaultTraits = {
  Shooting: 0,
  Passing: 0,
  Playmaking: 0,
  Rebounding: 0,
  Defense: 0,
  IQ: 0,
  Feel: 0,
  Energy: 0,
};

const defaultRoles = {
  offense1: '',
  offense2: '',
  defense1: '',
  defense2: '',
  twoWay: 50,
};

const defaultBlurbs = {
  traits: {},
  roles: {},
  subroles: {},
  shootingProfile: '',
  twoWayMeter: '',
  overall: '',
};

const PlayerProfileView = () => {
  const { players: fetchedPlayers, loading: isLoading } = usePlayerData();
  const [playersData, setPlayersData] = useState({});
  const [teams, setTeams] = useState([]);
  const [filteredKeys, setFilteredKeys] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [player, setPlayer] = useState(null);
  const [traits, setTraits] = useState(defaultTraits);
  const [roles, setRoles] = useState(defaultRoles);
  const [shootingProfile, setShootingProfile] = useState('');
  const [subRoles, setSubRoles] = useState({ offense: [], defense: [] });
  const [badges, setBadges] = useState([]);
  const [openModal, setOpenModal] = useState(null);
  const [editedBlurbs, setEditedBlurbs] = useState(defaultBlurbs);
  const [overallGrade, setOverallGrade] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const data = {};
    const teamSet = new Set();
    fetchedPlayers.forEach((p) => {
      data[p.id] = p;
      if (p.bio?.Team) teamSet.add(p.bio.Team);
    });
    setPlayersData(data);
    setTeams(Array.from(teamSet).sort());
  }, [fetchedPlayers]);

  useEffect(() => {
    if (!selectedPlayer || !playersData[selectedPlayer]) {
      setPlayer(null);
      return;
    }

    const data = playersData[selectedPlayer];
    setPlayer(data);
    setTraits(data.traits || { ...defaultTraits });
    setRoles({ ...defaultRoles, ...(data.roles || {}) });
    setSubRoles(data.subRoles || { offense: [], defense: [] });
    setBadges(data.badges || []);
    setShootingProfile(data.shootingProfile || '');
    setEditedBlurbs(data.blurbs || { ...defaultBlurbs });
    setOverallGrade(data.overall_grade || null);
    setHasChanges(false);
  }, [selectedPlayer, playersData]);

  useAutoSavePlayer({
    playerId: selectedPlayer,
    player,
    traits,
    roles,
    subRoles,
    badges,
    shootingProfile,
    overallGrade,
    blurbs: editedBlurbs,
    hasChanges,
    setHasChanges,
  });

  const handlePrevPlayer = useCallback(() => {
    if (!selectedTeam || !selectedPlayer) return;
    const currentIndex = filteredKeys.indexOf(selectedPlayer);
    if (currentIndex > 0) setSelectedPlayer(filteredKeys[currentIndex - 1]);
  }, [selectedTeam, selectedPlayer, filteredKeys]);

  const handleNextPlayer = useCallback(() => {
    if (!selectedTeam || !selectedPlayer) return;
    const currentIndex = filteredKeys.indexOf(selectedPlayer);
    if (currentIndex < filteredKeys.length - 1)
      setSelectedPlayer(filteredKeys[currentIndex + 1]);
  }, [selectedTeam, selectedPlayer, filteredKeys]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') handlePrevPlayer();
      else if (e.key === 'ArrowRight') handleNextPlayer();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevPlayer, handleNextPlayer]);

  const handleTraitChange = (e, trait) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.round((clickX / rect.width) * 100);
    setTraits((prev) => ({ ...prev, [trait]: percentage }));
    setHasChanges(true);
  };

  const handleRoleChange = (key, value) => {
    setRoles((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleBlurbChange = (key, value) => {
    setEditedBlurbs((prev) => {
      const updated = { ...prev };
      if (key.startsWith('trait_'))
        updated.traits = { ...prev.traits, [key.slice(6)]: value };
      else if (key.startsWith('role_'))
        updated.roles = { ...prev.roles, [key.slice(5)]: value };
      else if (key.startsWith('subrole_'))
        updated.subroles = { ...prev.subroles, [key.slice(8)]: value };
      else if (key === 'shooting_profile') updated.shootingProfile = value;
      else if (key === 'two_way_meter') updated.twoWayMeter = value;
      else if (key === 'overall') updated.overall = value;
      return updated;
    });
    setHasChanges(true);
  };

  const handleSearchSelect = (id, team) => {
    if (!id) return;
    setSelectedTeam(team);
    setSelectedPlayer(id);
    const filtered = getPlayersForTeam(playersData, team);
    setFilteredKeys(filtered);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading HoopZero...</div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-neutral-900 flex flex-col items-center gap-6 py-20 relative">
        <TeamPlayerDropdowns
          teams={teams}
          playersData={playersData}
          selectedTeam={selectedTeam}
          setSelectedTeam={setSelectedTeam}
          selectedPlayer={selectedPlayer}
          setSelectedPlayer={setSelectedPlayer}
          filteredKeys={filteredKeys}
          setFilteredKeys={setFilteredKeys}
        />

        <PlayerSearchBar
          playersData={playersData}
          onSelect={handleSearchSelect}
        />

        <PlayerNavigation onPrev={handlePrevPlayer} onNext={handleNextPlayer} />

        {player && (
          <PlayerDetails
            player={player}
            selectedPlayer={selectedPlayer}
            traits={traits}
            onTraitChange={handleTraitChange}
            roles={roles}
            onRoleChange={handleRoleChange}
            subRoles={subRoles}
            setSubRoles={setSubRoles}
            shootingProfile={shootingProfile}
            setShootingProfile={setShootingProfile}
            badges={badges}
            setBadges={setBadges}
            editedBlurbs={editedBlurbs}
            onBlurbChange={handleBlurbChange}
            overallGrade={overallGrade}
            setOverallGrade={(val) => {
              setOverallGrade(val);
              setHasChanges(true);
            }}
            setOpenModal={setOpenModal}
          />
        )}

        {openModal && (
          <BreakdownModal
            modalKey={openModal}
            blurbs={editedBlurbs}
            onChange={handleBlurbChange}
            onClose={() => setOpenModal(null)}
          />
        )}
      </div>
    </>
  );
};

export default PlayerProfileView;
