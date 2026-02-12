/**
 * FILE: src/features/roster/RosterViewerActions.tsx
 * PURPOSE: Render roster builder action buttons and modals (save/preview/export).
 * OWNERSHIP: Feature: roster (Roster Builder)
 *
 * HISTORY:
 *  - 2026-02-05: Created for roster builder v1 closure.
 *
 * LINKS:
 *  - Plan: N/A (Roster Builder v1 closure execution)
 *  - Latest Chunk: N/A
 */

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Download, FileJson } from 'lucide-react';
import SaveRosterModal from './SaveRosterModal';
import RosterPreviewModal from './RosterPreviewModal';
import RosterExportModal from './RosterExportModal';

type SaveMode = 'new' | 'overwrite' | 'copy';
type RosterPlayer = {
  id: string;
  displayName?: string;
  name?: string;
};
type RosterSlot = RosterPlayer | null;
type RosterState = {
  starters: RosterSlot[];
  rotation: RosterSlot[];
  bench: RosterSlot[];
};
type RosterTeam = {
  id?: string;
  nickname?: string;
  teamName?: string;
} | null;

interface RosterViewerActionsProps {
  rosterName: string;
  setRosterName: (name: string) => void;
  roster: RosterState;
  team: RosterTeam;
  isEditingExisting: boolean;
  onSaveNew: () => Promise<void>;
  onOverwrite: () => Promise<void>;
}

export const RosterViewerActions = ({
  rosterName,
  setRosterName,
  roster,
  team,
  isEditingExisting,
  onSaveNew,
  onOverwrite,
}: RosterViewerActionsProps) => {
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [saveMode, setSaveMode] = useState<SaveMode>(
    isEditingExisting ? 'overwrite' : 'new'
  );
  const overwriteNameRef = useRef(rosterName);

  useEffect(() => {
    if (!saveModalOpen) return;
    setSaveMode(isEditingExisting ? 'overwrite' : 'new');
    overwriteNameRef.current = rosterName;
  }, [saveModalOpen, isEditingExisting, rosterName]);

  useEffect(() => {
    if (saveMode === 'overwrite') {
      overwriteNameRef.current = rosterName;
    }
  }, [saveMode, rosterName]);

  const handleSaveModeChange = (mode: SaveMode) => {
    setSaveMode(mode);
    if (mode === 'copy') {
      const baseName = overwriteNameRef.current?.trim() || 'Roster';
      const copyName = baseName.endsWith('(Copy)')
        ? baseName
        : `${baseName} (Copy)`;
      setRosterName(copyName);
    }
    if (mode === 'overwrite') {
      setRosterName(overwriteNameRef.current || rosterName);
    }
  };

  const handleSave = async () => {
    const trimmedName = rosterName.trim();
    if (!trimmedName) {
      toast.error('Roster name is required');
      return;
    }
    try {
      if (isEditingExisting && saveMode === 'overwrite') {
        await onOverwrite();
      } else {
        await onSaveNew();
      }
      setSaveModalOpen(false);
    } catch (err) {
      toast.error('Failed to save roster');
      console.error(err);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        <button
          onClick={() => setPreviewOpen(true)}
          className="bg-black/20 text-white px-4 py-2 rounded hover:bg-white/20 flex items-center gap-2"
        >
          <Download size={16} />
          Download Image
        </button>
        <button
          onClick={() => setExportOpen(true)}
          className="bg-black/20 text-white px-4 py-2 rounded hover:bg-white/20 flex items-center gap-2"
        >
          <FileJson size={16} />
          Export JSON
        </button>
        <button
          onClick={() => setSaveModalOpen(true)}
          className="bg-black/20 text-white px-4 py-2 rounded hover:bg-white/20"
        >
          Save Roster
        </button>
      </div>

      {saveModalOpen && (
        <SaveRosterModal
          name={rosterName}
          onNameChange={setRosterName}
          onCancel={() => setSaveModalOpen(false)}
          onSave={handleSave}
          isEditingExisting={isEditingExisting}
          saveMode={saveMode}
          onSaveModeChange={handleSaveModeChange}
        />
      )}

      {previewOpen && (
        <RosterPreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          roster={roster}
          team={team}
        />
      )}

      {exportOpen && (
        <RosterExportModal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          roster={roster}
          team={team}
        />
      )}
    </>
  );
};
