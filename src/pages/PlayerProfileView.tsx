/**
 * FILE: src/pages/PlayerProfileView.tsx
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

  if (nav.listError) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center px-6">
        <div className="text-center text-white">
          <div className="text-lg font-semibold">Unable to load players</div>
          <div className="mt-2 text-sm text-white/60">{nav.listError}</div>
        </div>
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

        {nav.isEmpty && (
          <div className="text-white/40 mt-10">No players available.</div>
        )}

        {!nav.isEmpty &&
          !nav.detailError &&
          (!evalState.player || nav.detailLoading) &&
          nav.selectedPlayer && (
          <div className="text-white/40 mt-10">Loading player data...</div>
        )}

        {nav.detailError && nav.selectedPlayer && (
          <div className="text-center text-red-300 mt-10 px-4">
            <div className="font-semibold">Unable to load player profile</div>
            <div className="text-sm text-red-200/80 mt-1">{nav.detailError}</div>
          </div>
        )}

        {!nav.isEmpty && !nav.detailError && !nav.selectedPlayer && (
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
            videoExamples={evalState.videoExamples}
            onClose={() => setOpenModal(null)}
            onBuildSavePayload={evalState.buildModalSavePayload}
            onCommitSavedDraft={evalState.commitSavedModalDraft}
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
