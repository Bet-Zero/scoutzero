import React, { useState } from 'react';
import { createRosterProject } from '@/firebase/rosterHelpers';
import type { CreatedRosterProject } from '@/firebase/rosterHelpers';
import { useAuth } from '@/shared/hooks/useAuth';
import { Dialog, DialogContent } from '@/shared/components/ui/Dialog';

type CreateRosterModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (created: CreatedRosterProject) => void;
};

export const CreateRosterModal = ({
  isOpen,
  onClose,
  onCreated,
}: CreateRosterModalProps) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const { userId } = useAuth();

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!userId) return;
    try {
      const created = await createRosterProject(trimmed, userId);
      setName('');
      setError('');
      onCreated?.(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create roster');
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
        {!userId && (
          <p className="text-yellow-400/80 text-xs mb-2">
            Session unavailable — roster creation disabled.
          </p>
        )}
        <button
          className="bg-neutral-600 hover:bg-neutral-700 text-white px-4 py-2 rounded w-full disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={handleCreate}
          disabled={!userId}
        >
          Create Roster
        </button>
      </DialogContent>
    </Dialog>
  );
};

