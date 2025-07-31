// src/components/lists/CreateListModal.jsx
import React, { useState } from 'react';
import { createList } from '@/firebase/listHelpers';
import { Dialog, DialogContent } from '@/components/shared/ui/Dialog';

const CreateListModal = ({ isOpen, onClose, onListCreated }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      await createList(trimmed);
      setName('');
      setError('');
      onListCreated?.(); // optional callback to trigger refresh
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="p-6 max-w-md">
        <h2 className="text-xl font-bold mb-4">Create New List</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter list name"
          className="w-full p-2 border border-gray-300 rounded mb-2"
        />
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <button
          className="bg-neutral-600 hover:bg-neutral-700 text-white px-4 py-2 rounded w-full"
          onClick={handleCreate}
        >
          Create List
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default CreateListModal;
