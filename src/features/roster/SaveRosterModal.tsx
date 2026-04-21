import React from 'react';

type SaveMode = 'new' | 'overwrite' | 'copy';

type SaveRosterModalProps = {
  name: string;
  onNameChange: (name: string) => void;
  onCancel: () => void;
  onSave: () => void;
  isEditingExisting?: boolean;
  saveMode?: SaveMode;
  onSaveModeChange?: (mode: SaveMode) => void;
  canSave?: boolean;
};

const SaveRosterModal = ({
  name,
  onNameChange,
  onCancel,
  onSave,
  isEditingExisting = false,
  saveMode = 'new',
  onSaveModeChange,
  canSave = true,
}: SaveRosterModalProps) => (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
    <div className="bg-[#1a1a1a] p-6 rounded-lg w-full max-w-sm text-white">
      <h3 className="text-xl font-bold mb-4">
        {isEditingExisting ? 'Save Roster' : 'Save New Roster'}
      </h3>

      {isEditingExisting && (
        <div className="space-y-2 mb-4 text-sm">
          <label className="flex items-center gap-2 text-white/80">
            <input
              type="radio"
              name="saveMode"
              value="overwrite"
              checked={saveMode === 'overwrite'}
              onChange={() => onSaveModeChange?.('overwrite')}
            />
            Overwrite existing roster
          </label>
          <label className="flex items-center gap-2 text-white/80">
            <input
              type="radio"
              name="saveMode"
              value="copy"
              checked={saveMode === 'copy'}
              onChange={() => onSaveModeChange?.('copy')}
            />
            Save as new copy
          </label>
        </div>
      )}

      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Roster name"
        className="w-full px-3 py-2 mb-4 rounded bg-neutral-800 placeholder:text-white/40"
      />

      {!canSave && (
        <p className="text-yellow-400/80 text-xs mb-4">
          Session unavailable — roster saving disabled.
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-3 py-1 rounded bg-neutral-700 hover:bg-neutral-600"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!canSave}
        >
          {isEditingExisting && saveMode === 'overwrite'
            ? 'Overwrite'
            : 'Save'}
        </button>
      </div>
    </div>
  </div>
);

export default SaveRosterModal;
