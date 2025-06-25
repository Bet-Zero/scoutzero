// src/components/roster/RosterViewer.jsx
import React, { useState } from 'react';
import usePlayerData from '@/hooks/usePlayerData.js';
import AddPlayerDrawer from './AddPlayerDrawer';
import DrawerShell from '@/components/shared/ui/drawers/DrawerShell';
import OpenDrawerButton from '@/components/shared/ui/drawers/OpenDrawerButton';
import RosterControls from './RosterControls';
import RosterSection from './RosterSection';
import SaveRosterModal from './SaveRosterModal';
import RosterPreviewModal from './RosterPreviewModal';
import { getTeamColors } from '@/utils/formatting/teamColors';
import { useRosterManager } from '@/hooks/useRosterManager';

const RosterViewer = ({ isExport = false }) => {
  const { players: allPlayers, loading: isLoading } = usePlayerData();
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
  } = useRosterManager(allPlayers, isLoading);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [slotTarget, setSlotTarget] = useState({ section: '', index: -1 });
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRoster, setPreviewRoster] = useState(null);

  const handleRemovePlayer = (section, index, e) => {
    e?.stopPropagation();
    removePlayer(section, index);
  };

  const handleOpenDrawer = (section, index) => {
    setSlotTarget({ section, index });
    setDrawerOpen(true);
  };

  const handleSaveFromModal = async () => {
    await saveNewRoster();
    setSaveModalOpen(false);
  };

  const handlePreview = () => {
    setPreviewRoster(JSON.parse(JSON.stringify(roster)));
    setPreviewOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-white">Loading players...</div>
      </div>
    );
  }

  const { primary, secondary } = getTeamColors(selectedTeam);

  return (
    <div className="flex relative">
      {!drawerOpen && !isExport && (
        <OpenDrawerButton onClick={() => setDrawerOpen(true)} />
      )}

      {!isExport && (
        <DrawerShell isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
          <AddPlayerDrawer
            onClose={() => setDrawerOpen(false)}
            allPlayers={processedPlayers}
            onSelect={(player) => {
              const isManualTarget =
                slotTarget.section && slotTarget.index !== -1;
              if (isManualTarget) {
                addPlayerToSlot(player, slotTarget.section, slotTarget.index);
                setSlotTarget({ section: '', index: -1 });
                setDrawerOpen(false);
              } else {
                addPlayerToNextSlot(player);
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
          {/* Team Branding Background */}
          {selectedTeam && (
            <img
              src={`/assets/logos/${selectedTeam.toLowerCase()}.png`}
              alt=""
              className="absolute inset-0 w-full h-full object-contain opacity-20 blur-sm mt-4 pointer-events-none select-none"
              style={{ zIndex: 0 }}
            />
          )}

          {/* Controls */}
          {!isExport && (
            <div className="z-10 -mt-2 mb-6 w-full">
              <div className="flex justify-center mb-6 z-10">
                <RosterControls
                  selectedTeam={selectedTeam}
                  onTeamChange={setSelectedTeam}
                  loadMethod={loadMethod}
                  onLoadMethodChange={setLoadMethod}
                  savedRosters={savedRosters}
                />
              </div>
            </div>
          )}

          {/* Team Name */}
          {selectedTeam && (
            <div className="w-full flex justify-center relative z-10 mb-2">
              <h2
                className="text-5xl font-black tracking-wide uppercase relative"
                style={{
                  color: '#1e1e1e',
                  textShadow: `0 0 10px ${primary}, 0 0 18px ${secondary}`,
                  transform: 'translateX(3px)', // tweak this!
                }}
              >
                {selectedTeam}
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
          {/* Preview Button */}
          {!isExport && (
            <div className="fixed bottom-6 left-6 z-50">
              <button
                onClick={handlePreview}
                className="bg-white/10 text-white px-4 py-2 rounded hover:bg-white/20"
              >
                Preview
              </button>
            </div>
          )}
          {/* Save Roster Button */}
          {!isExport && (
            <div className="fixed bottom-6 right-6 z-50">
              <button
                onClick={() => setSaveModalOpen(true)}
                className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Save Roster
              </button>
            </div>
          )}

          {/* Save Modal */}
          {saveModalOpen && (
            <SaveRosterModal
              name={rosterName}
              onNameChange={setRosterName}
              onCancel={() => setSaveModalOpen(false)}
              onSave={handleSaveFromModal}
            />
          )}
          {previewOpen && (
            <RosterPreviewModal
              open={previewOpen}
              onClose={() => setPreviewOpen(false)}
              roster={previewRoster}
              team={selectedTeam}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default RosterViewer;
