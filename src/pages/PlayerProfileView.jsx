/**
 * FILE: src/pages/PlayerProfileView.jsx
 * PURPOSE: Scouting Player Profile route view with player selection, state, and autosave.
 * OWNERSHIP: Feature: profile/scouting
 */

import React, { useState } from 'react';
import usePlayerNavigation from '@/features/profile/hooks/usePlayerNavigation';
import usePlayerProfileState from '@/features/profile/hooks/usePlayerProfileState';
import useAutoSavePlayer from '@/features/profile/hooks/useAutoSavePlayer';
import SaveStatusIndicator from '@/features/profile/SaveStatusIndicator';
import TeamPlayerDropdowns from '@/features/profile/TeamPlayerDropdowns';
import PlayerNavigation from '@/features/profile/PlayerNavigation';
import PlayerDetails from '@/features/profile/PlayerDetails';
import BreakdownModal from '@/features/profile/BreakdownModal';
import PlayerSearchBar from '@/features/profile/PlayerSearchBar';

const PlayerProfileView = () => {
  const [openModal, setOpenModal] = useState(null);

  const nav = usePlayerNavigation(openModal);
  const evalState = usePlayerProfileState(
    nav.detailedPlayer,
    nav.selectedPlayer,
    openModal
  );

  const { saveError, saveState, saveNow } = useAutoSavePlayer({
    playerId: nav.selectedPlayer,
    player: evalState.player,
    traits: evalState.traits,
    roles: evalState.roles,
    twoWay: evalState.twoWay,
    subRoles: evalState.subRoles,
    badges: evalState.badges,
    shootingProfile: evalState.shootingProfile,
    overallGrade: evalState.overallGrade,
    blurbs: evalState.editedBlurbs,
    videoExamples: evalState.videoExamples,
    hasChanges: evalState.hasChanges,
    setHasChanges: evalState.setHasChanges,
  });

  if (nav.isLoading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading HoopZero...</div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-neutral-900 flex flex-col items-center gap-6 py-20 relative">
        <div className="absolute top-2 left-4 flex flex-col gap-1 mt-1">
          <PlayerSearchBar
            playersData={nav.playersData}
            onSelect={nav.handleSearchSelect}
          />

          <TeamPlayerDropdowns
            teams={nav.teams}
            playersData={nav.playersData}
            selectedTeam={nav.selectedTeam}
            setSelectedTeam={nav.setSelectedTeam}
            selectedPlayer={nav.selectedPlayer}
            setSelectedPlayer={nav.setSelectedPlayer}
            filteredKeys={nav.filteredKeys}
            setFilteredKeys={nav.setFilteredKeys}
          />
        </div>

        {(!evalState.player || nav.detailLoading) && nav.selectedPlayer && (
          <div className="text-white/40 mt-10">Loading player data...</div>
        )}

        {!nav.selectedPlayer && (
          <div className="text-white/40 mt-10">
            Select a player to view their profile.
          </div>
        )}

        <PlayerNavigation onPrev={nav.handlePrevPlayer} onNext={nav.handleNextPlayer} />

        {evalState.player && !nav.detailLoading && (
          <>
            <SaveStatusIndicator saveState={saveState} saveError={saveError} />
            <PlayerDetails
              player={evalState.player}
              selectedPlayer={nav.selectedPlayer}
              traits={evalState.traits}
              onTraitChange={evalState.handleTraitChange}
              roles={evalState.roles}
              onRoleChange={evalState.handleRoleChange}
              twoWay={evalState.twoWay}
              onTwoWayChange={evalState.handleTwoWayChange}
              subRoles={evalState.subRoles}
              setSubRoles={evalState.handleSetSubRoles}
              shootingProfile={evalState.shootingProfile}
              setShootingProfile={evalState.handleSetShootingProfile}
              badges={evalState.badges}
              setBadges={evalState.handleSetBadges}
              editedBlurbs={evalState.editedBlurbs}
              onBlurbChange={evalState.handleBlurbChange}
              overallGrade={evalState.overallGrade}
              setOverallGrade={evalState.handleSetOverallGrade}
              setOpenModal={setOpenModal}
            />
          </>
        )}

        {openModal && (
          <BreakdownModal
            modalKey={openModal}
            blurbs={evalState.editedBlurbs}
            onChange={evalState.handleBlurbChange}
            videoExamples={evalState.videoExamples}
            onVideoExamplesChange={evalState.handleVideoExamplesChange}
            onClose={() => setOpenModal(null)}
            onSaveNow={saveNow}
            saveState={saveState}
            saveError={saveError}
          />
        )}
      </div>
    </>
  );
};

export default PlayerProfileView;
