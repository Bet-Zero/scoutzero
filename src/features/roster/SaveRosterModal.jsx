import React from 'react';

const SaveRosterModal = ({ name, onNameChange, onCancel, onSave }) => (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
    <div className="bg-[#1a1a1a] p-6 rounded-lg w-full max-w-sm text-white">
      <h3 className="text-xl font-bold mb-4">Save New Roster</h3>
      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Roster name"
        className="w-full px-3 py-2 mb-4 rounded bg-neutral-800 placeholder:text-white/40"
      />
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-3 py-1 rounded bg-neutral-700 hover:bg-neutral-600"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500"
        >
          Save
        </button>
      </div>
    </div>
  </div>
);

export default SaveRosterModal;
