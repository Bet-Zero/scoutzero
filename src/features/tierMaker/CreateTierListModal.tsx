// src/features/tierMaker/CreateTierListModal.tsx
// E4: Passes userId to createTierList for ownership
import React, { useState } from 'react';
import { createTierList, type TierListMode } from '@/firebase/listHelpers';
import { useAuth } from '@/shared/hooks/useAuth';
import { Dialog, DialogContent } from '@/shared/components/ui/Dialog';

type CreateTierListModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
  mode?: TierListMode;
};

const CreateTierListModal = ({
  isOpen,
  onClose,
  onCreated,
  mode = 'standard',
}: CreateTierListModalProps) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const { userId } = useAuth();

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const id = await createTierList(trimmed, mode, userId);
      setName('');
      setError('');
      onCreated?.(id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
          className="w-full p-2 bg-neutral-800 text-white border border-white/10 rounded mb-2 placeholder:text-neutral-400"
        />

        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        {!userId && (
          <p className="text-yellow-400/80 text-xs mb-2">
            Session unavailable — tier list creation disabled.
          </p>
        )}
        <button
          className="bg-neutral-600 hover:bg-neutral-700 text-white px-4 py-2 rounded w-full disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={handleCreate}
          disabled={!userId}
        >
          Create Tier List
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTierListModal;
