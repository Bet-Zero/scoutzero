// src/features/tierMaker/CreateTierListModal.jsx
import React, { useState } from 'react';
import { createTierList } from '@/firebase/listHelpers';
import { Dialog, DialogContent } from '@/components/shared/ui/Dialog';

const CreateTierListModal = ({ isOpen, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const id = await createTierList(trimmed);
      setName('');
      setError('');
      onCreated?.(id);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="p-6 max-w-md">
        <h2 className="text-xl font-bold mb-4">Create New Tier List</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter tier list name"
          className="w-full p-2 bg-neutral-800 text-black border border-black rounded mb-2 placeholder:text-neutral-700"
        />

        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <button
          className="bg-neutral-600 hover:bg-neutral-700 text-white px-04 py-2 rounded w-full"
          onClick={handleCreate}
        >
          Create Tier List
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTierListModal;
