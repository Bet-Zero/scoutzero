// src/components/roster/RosterViewer.jsx
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import useSimplePlayerData from '@/shared/hooks/useSimplePlayerData';
import AddPlayerDrawer from './AddPlayerDrawer';
import DrawerShell from '@/shared/components/ui/drawers/DrawerShell';
import OpenDrawerButton from '@/shared/components/ui/drawers/OpenDrawerButton';
import RosterControls from './RosterControls';
import RosterSection from './RosterSection';
import { getTeamColors } from '@/shared/utils/formatting/teamColors';
import { getTeamLogoFilename } from '@/shared/utils/formatting/teamLogos';
import { useRosterManager } from '@/features/roster/hooks/useRosterManager';
import { RosterViewerActions } from './RosterViewerActions';

const RosterViewer = ({ isExport = false, initialRosterId }) => {
  const { players: allPlayers, loading: isLoading } = useSimplePlayerData();
  const {
    roster,
    processedPlayers,
    selectedTeam,
    setSelectedTeam,
    loadMethod,
    setLoadMethod,
    addPlayerToSlot,
    addPlayerToNextSlot,
    removePlayer,
    savedRosters,
    rosterName,
    setRosterName,
    saveNewRoster,
    updateRoster,
    rosterId,
    rosterHasPlayer,
    isRosterFull,
    hasMissingPlayers,
    missingPlayerCount,
    missingPlayerIds,
    isSavedRosterSelection,
  } = useRosterManager(allPlayers, isLoading);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [slotTarget, setSlotTarget] = useState({ section: '', index: -1 });
  const [screenshotMode, setScreenshotMode] = useState(false);

  useEffect(() => {
    if (!initialRosterId) return;
    setLoadMethod(initialRosterId);
  }, [initialRosterId, setLoadMethod]);
  const handleRemovePlayer = (section, index, e) => {
    e?.stopPropagation();
    removePlayer(section, index);
  };

  const handleOpenDrawer = (section, index) => {
    setSlotTarget({ section, index });
    setDrawerOpen(true);
  };

  const isEditingExisting = Boolean(rosterId);
  const openDrawerLabel = isRosterFull
    ? 'Roster is full. Remove a player to add another.'
    : 'Open player drawer';

  const { primary, secondary } = getTeamColors(selectedTeam?.id);

  return (
    <div className="flex relative">
      {!drawerOpen && !isExport && !screenshotMode && (
        <OpenDrawerButton
          onClick={() => setDrawerOpen(true)}
          disabled={isRosterFull}
          title={openDrawerLabel}
          ariaLabel={openDrawerLabel}
        />
      )}

      {!isExport && !screenshotMode && (
        <DrawerShell isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
          <AddPlayerDrawer
            onClose={() => setDrawerOpen(false)}
            allPlayers={processedPlayers}
            onSelect={(player) => {
              if (rosterHasPlayer(player.id)) {
                toast.error('Player already in roster');
                return;
              }
              const isManualTarget =
                slotTarget.section && slotTarget.index !== -1;
              if (isManualTarget) {
                addPlayerToSlot(player, slotTarget.section, slotTarget.index);
                setSlotTarget({ section: '', index: -1 });
                setDrawerOpen(false);
              } else {
                if (!addPlayerToNextSlot(player)) {
                  toast.error(openDrawerLabel);
                }
              }
            }}
          />
        </DrawerShell>
      )}

      <div
        className={`flex-1 transition-[margin] duration-300 ease-in-out ${
          drawerOpen ? 'ml-[300px]' : 'ml-0'
        }`}
      >
        <div
          className={`relative max-w-[1300px] mx-auto text-white p-6 pb-20 flex flex-col items-center overflow-hidden ${
            isExport ? 'scale-[0.9]' : ''
          }`}
        >
          {selectedTeam && (
            <img
              src={`/assets/logos/${getTeamLogoFilename(selectedTeam.id)}.png`}
              alt=""
              className="absolute inset-0 w-full h-full object-contain opacity-20 blur-sm mt-4 pointer-events-none select-none"
              style={{ zIndex: 0 }}
            />
          )}

          {!isExport && !screenshotMode && (
            <div className="z-10 -mt-2 mb-2 w-full">
              <div className="flex justify-center mb-0 z-10">
                <RosterControls
                  selectedTeam={selectedTeam}
                  onTeamChange={setSelectedTeam}
                  loadMethod={loadMethod}
                  onLoadMethodChange={setLoadMethod}
                  savedRosters={savedRosters}
                  teamSelectionDisabled={isSavedRosterSelection}
                />
              </div>
            </div>
          )}

          {hasMissingPlayers && (
            <div className="w-full max-w-3xl z-10 mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {missingPlayerCount} saved player
              {missingPlayerCount === 1 ? '' : 's'} could not be loaded and
              {` `}
              {missingPlayerCount === 1 ? 'is' : 'are'} being preserved as
              {` `}
              {missingPlayerCount === 1 ? 'a placeholder' : 'placeholders'}.
              Remove or replace {missingPlayerCount === 1 ? 'it' : 'them'}
              {` `}
              manually if needed.
              {missingPlayerIds.length > 0 && (
                <div className="mt-1 text-xs text-amber-200/80">
                  Missing IDs: {missingPlayerIds.join(', ')}
                </div>
              )}
            </div>
          )}

          {selectedTeam && (
            <div className="w-full flex justify-center relative z-10 mb-2">
              <h2
                className="text-5xl font-black tracking-wide uppercase relative"
                style={{
                  color: '#1e1e1e',
                  textShadow: `0 0 10px ${primary}, 0 0 18px ${secondary}`,
                  transform: 'translateX(3px)',
                }}
              >
                {selectedTeam.nickname}
              </h2>
            </div>
          )}

          <h3 className="text-xl text-neutral-500 font-semibold z-10 mb-8 opacity-90 tracking-wide">
            Team Roster
          </h3>
          <RosterSection
            players={roster.starters}
            section="starters"
            onRemove={handleRemovePlayer}
            onAdd={handleOpenDrawer}
            isExport={isExport}
          />
          <RosterSection
            players={roster.rotation}
            section="rotation"
            onRemove={handleRemovePlayer}
            onAdd={handleOpenDrawer}
            isExport={isExport}
          />
          <RosterSection
            players={roster.bench}
            section="bench"
            onRemove={handleRemovePlayer}
            onAdd={handleOpenDrawer}
            isExport={isExport}
          />
          {!isExport && !drawerOpen && (
            <div className="fixed bottom-6 left-6 z-50">
              <button
                onClick={() => setScreenshotMode(!screenshotMode)}
                className={`
                px-4 py-2 rounded transition-all duration-300
                ${
                  screenshotMode
                    ? 'opacity-0 hover:opacity-80 bg-red-700 text-white'
                    : 'bg-black/20 text-white hover:bg-white/20'
                }
              `}
                style={{ pointerEvents: screenshotMode ? 'auto' : 'auto' }}
              >
                {screenshotMode ? 'Exit Screenshot Mode' : 'Screenshot Mode'}
              </button>
            </div>
          )}
          {!isExport && !screenshotMode && (
            <RosterViewerActions
              rosterName={rosterName}
              setRosterName={setRosterName}
              roster={roster}
              team={selectedTeam}
              isEditingExisting={isEditingExisting}
              onSaveNew={saveNewRoster}
              onOverwrite={updateRoster}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default RosterViewer;
