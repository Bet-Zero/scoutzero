import React, { useState } from 'react';
import { createRosterProject } from '@/firebase/rosterHelpers';
import { Dialog, DialogContent } from '@/components/shared/ui/Dialog';

const CreateRosterModal = ({ isOpen, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const created = await createRosterProject(trimmed);
      setName('');
      setError('');
      onCreated?.(created);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="p-6 max-w-md">
        <h2 className="text-xl font-bold mb-4">Create New Roster</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter roster name"
          className="w-full p-2 border border-gray-300 rounded mb-2"
        />
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <button
          className="bg-neutral-600 hover:bg-neutral-700 text-white px-4 py-2 rounded w-full"
          onClick={handleCreate}
        >
          Create Roster
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRosterModal;
