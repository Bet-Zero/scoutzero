// PlayerProfileView.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { savePlayerData } from '@/firebaseHelpers';

import SiteLayout from '@/components/layout/SiteLayout';
import PlayerHeader from '@/components/profile/PlayerHeader';
import PlayerStatsTable from '@/components/profile/PlayerStatsTable';
import PlayerTraitsGrid from '@/components/profile/PlayerTraitsGrid';
import PlayerRolesSection from '@/components/profile/PlayerRolesSection';
import BadgeSelector from '@/components/profile/BadgeSelector';
import Modal from '@/components/profile/Modal';
import OverallBlurbBox from '@/components/profile/OverallBlurbBox';

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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'players'));
        const data = {};
        const teamSet = new Set();

        snapshot.forEach((doc) => {
          const docData = doc.data();
          data[doc.id] = docData;
          if (docData?.bio?.Team) teamSet.add(docData.bio.Team);
        });

        setPlayersData(data);
        setTeams(Array.from(teamSet).sort());
      } catch (error) {
        console.error('Error loading players:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayers();
  }, []);

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

  useEffect(() => {
    if (!selectedPlayer || !player || !hasChanges) return;

    const saveData = async () => {
      await savePlayerData(selectedPlayer, {
        ...player,
        traits,
        roles,
        subRoles,
        badges,
        shootingProfile,
        overall_grade: overallGrade,
        blurbs: editedBlurbs,
      });
      setHasChanges(false);
    };

    saveData();
  }, [
    traits,
    roles,
    subRoles,
    badges,
    shootingProfile,
    overallGrade,
    editedBlurbs,
    hasChanges,
    selectedPlayer,
    player,
  ]);

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

  if (isLoading) {
    return (
      <SiteLayout>
        <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
          <div className="text-white text-lg">Loading HoopZero...</div>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="min-h-screen bg-neutral-900 flex flex-col items-center gap-6 py-20 relative">
        <div className="absolute top-6 left-6">
          <label className="text-white text-sm block mb-1">Select Team</label>
          <select
            className="bg-neutral-800 text-white px-4 py-1 rounded-lg text-sm border border-black shadow mb-2"
            value={selectedTeam}
            onChange={(e) => {
              const team = e.target.value;
              setSelectedTeam(team);
              const filtered = Object.keys(playersData)
                .filter((key) => playersData[key]?.bio?.Team === team)
                .sort((a, b) => {
                  const aName =
                    playersData[a]?.display_name || playersData[a]?.name || '';
                  const bName =
                    playersData[b]?.display_name || playersData[b]?.name || '';
                  return aName
                    .split(' ')
                    .slice(-1)[0]
                    .localeCompare(bName.split(' ').slice(-1)[0]);
                });
              setFilteredKeys(filtered);
              setSelectedPlayer(filtered[0] || '');
            }}
          >
            <option value="">Select Team</option>
            {teams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>

          <label className="text-white text-sm block mb-1 mt-2">
            Select Player
          </label>
          <select
            className="bg-neutral-800 text-white px-4 py-1 rounded-lg text-sm border border-black shadow"
            value={selectedPlayer}
            onChange={(e) => setSelectedPlayer(e.target.value)}
          >
            <option value="">Select Player</option>
            {filteredKeys.map((key) => (
              <option key={key} value={key}>
                {playersData[key]?.display_name ||
                  playersData[key]?.name ||
                  key}
              </option>
            ))}
          </select>
        </div>

        <div className="absolute top-6 right-6 flex gap-4">
          <button
            className="px-4 py-2 text-black rounded-lg border border-black shadow"
            onClick={handlePrevPlayer}
          >
            ◀
          </button>
          <button
            className="px-4 py-2 text-black rounded-lg border border-black shadow"
            onClick={handleNextPlayer}
          >
            ▶
          </button>
        </div>

        {player && (
          <>
            <PlayerHeader player={player} selectedPlayer={selectedPlayer} />
            <PlayerStatsTable player={player} />
            <div className="flex gap-[1.25rem] w-full max-w-[750px]">
              <PlayerTraitsGrid
                traits={traits}
                onTraitClick={handleTraitChange}
                setOpenModal={setOpenModal}
              />
              <PlayerRolesSection
                roles={roles}
                onRoleChange={handleRoleChange}
                subRoles={subRoles}
                setSubRoles={setSubRoles}
                shootingProfile={shootingProfile}
                setShootingProfile={setShootingProfile}
                onTwoWayChange={(value) => handleRoleChange('twoWay', value)}
                setOpenModal={setOpenModal}
              />
            </div>
            <BadgeSelector badges={badges} setBadges={setBadges} />
            <OverallBlurbBox
              overallBlurb={editedBlurbs.overall || ''}
              setOverallBlurb={(val) => handleBlurbChange('overall', val)}
              overallGrade={overallGrade}
              setOverallGrade={(val) => {
                setOverallGrade(val);
                setHasChanges(true);
              }}
            />
          </>
        )}

        {openModal && (
          <Modal
            title={
              openModal.startsWith('trait_')
                ? `Trait Breakdown: ${openModal.slice(6)}`
                : openModal.startsWith('role_')
                  ? `Role Breakdown: ${openModal.slice(5)}`
                  : openModal.startsWith('subrole_')
                    ? `Sub-Role Breakdown: ${openModal.slice(8)}`
                    : openModal === 'shooting_profile'
                      ? 'Shooting Profile Breakdown'
                      : openModal === 'two_way_meter'
                        ? 'Two-Way Meter Breakdown'
                        : 'Breakdown'
            }
            onClose={() => setOpenModal(null)}
          >
            <textarea
              className="w-full h-40 bg-neutral-900 text-white p-3 rounded-lg text-sm resize-none outline-none border border-neutral-700"
              placeholder="Write your breakdown here..."
              value={
                openModal.startsWith('trait_')
                  ? editedBlurbs.traits?.[openModal.slice(6)] || ''
                  : openModal.startsWith('role_')
                    ? editedBlurbs.roles?.[openModal.slice(5)] || ''
                    : openModal.startsWith('subrole_')
                      ? editedBlurbs.subroles?.[openModal.slice(8)] || ''
                      : openModal === 'shooting_profile'
                        ? editedBlurbs.shootingProfile || ''
                        : openModal === 'two_way_meter'
                          ? editedBlurbs.twoWayMeter || ''
                          : ''
              }
              onChange={(e) => handleBlurbChange(openModal, e.target.value)}
            />
            <div className="w-full h-40 bg-neutral-700 rounded-xl flex items-center justify-center text-sm text-neutral-400 mt-4">
              [Video examples coming soon]
            </div>
          </Modal>
        )}
      </div>
    </SiteLayout>
  );
};

export default PlayerProfileView;
