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
import {
  getPlayersForTeam,
  getModalTitle,
  getBlurbValue,
} from '@/utils/profileHelpers';

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

const TeamPlayerDropdowns = ({
  teams,
  playersData,
  selectedTeam,
  setSelectedTeam,
  selectedPlayer,
  setSelectedPlayer,
  filteredKeys,
  setFilteredKeys,
}) => {
  useEffect(() => {
    if (!selectedTeam) {
      setFilteredKeys([]);
      setSelectedPlayer('');
      return;
    }
    const filtered = getPlayersForTeam(playersData, selectedTeam);
    setFilteredKeys(filtered);
    setSelectedPlayer(filtered[0] || '');
  }, [selectedTeam, playersData, setFilteredKeys, setSelectedPlayer]);

  return (
    <div className="absolute top-6 left-6">
      <label className="text-white text-sm block mb-1">Select Team</label>
      <select
        className="bg-neutral-800 text-white px-4 py-1 rounded-lg text-sm border border-black shadow mb-2"
        value={selectedTeam}
        onChange={(e) => setSelectedTeam(e.target.value)}
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
            {playersData[key]?.display_name || playersData[key]?.name || key}
          </option>
        ))}
      </select>
    </div>
  );
};

const PlayerNavigation = ({ onPrev, onNext }) => (
  <div className="absolute top-6 right-6 flex gap-4">
    <button
      className="px-4 py-2 text-black rounded-lg border border-black shadow"
      onClick={onPrev}
    >
      ◀
    </button>
    <button
      className="px-4 py-2 text-black rounded-lg border border-black shadow"
      onClick={onNext}
    >
      ▶
    </button>
  </div>
);

const BreakdownModal = ({ modalKey, blurbs, onChange, onClose }) => (
  <Modal title={getModalTitle(modalKey)} onClose={onClose}>
    <textarea
      className="w-full h-40 bg-neutral-900 text-white p-3 rounded-lg text-sm resize-none outline-none border border-neutral-700"
      placeholder="Write your breakdown here..."
      value={getBlurbValue(blurbs, modalKey)}
      onChange={(e) => onChange(modalKey, e.target.value)}
    />
    <div className="w-full h-40 bg-neutral-700 rounded-xl flex items-center justify-center text-sm text-neutral-400 mt-4">
      [Video examples coming soon]
    </div>
  </Modal>
);

const PlayerDetails = ({
  player,
  selectedPlayer,
  traits,
  onTraitChange,
  roles,
  onRoleChange,
  subRoles,
  setSubRoles,
  shootingProfile,
  setShootingProfile,
  badges,
  setBadges,
  editedBlurbs,
  onBlurbChange,
  overallGrade,
  setOverallGrade,
  setOpenModal,
}) => (
  <>
    <PlayerHeader player={player} selectedPlayer={selectedPlayer} />
    <PlayerStatsTable player={player} />
    <div className="flex gap-[1.25rem] w-full max-w-[750px]">
      <PlayerTraitsGrid
        traits={traits}
        onTraitClick={onTraitChange}
        setOpenModal={setOpenModal}
      />
      <PlayerRolesSection
        roles={roles}
        onRoleChange={onRoleChange}
        subRoles={subRoles}
        setSubRoles={setSubRoles}
        shootingProfile={shootingProfile}
        setShootingProfile={setShootingProfile}
        onTwoWayChange={(value) => onRoleChange('twoWay', value)}
        setOpenModal={setOpenModal}
      />
    </div>
    <BadgeSelector badges={badges} setBadges={setBadges} />
    <OverallBlurbBox
      overallBlurb={editedBlurbs.overall || ''}
      setOverallBlurb={(val) => onBlurbChange('overall', val)}
      overallGrade={overallGrade}
      setOverallGrade={(val) => setOverallGrade(val)}
    />
  </>
);

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
    </SiteLayout>
  );
};

export default PlayerProfileView;
