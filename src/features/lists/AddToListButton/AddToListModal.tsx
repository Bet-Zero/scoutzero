// AddToListModal.tsx
// E4: All writes routed through listHelpers with ownership (ownerUid) scoping
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { getPlayerId } from '@/shared/utils/getPlayerId';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  fetchAllLists,
  createListWithPlayer,
  addPlayerToList,
  type PlayerList,
} from '@/firebase/listHelpers';
import type { SimplePlayer } from '@/shared/hooks/useSimplePlayerData';

type AddToListModalProps = {
  player: SimplePlayer;
  onClose: () => void;
};

export const AddToListModal = ({ player, onClose }: AddToListModalProps) => {
  const [lists, setLists] = useState<PlayerList[]>([]);
  const [selectedList, setSelectedList] = useState('');
  const [newListName, setNewListName] = useState('');
  const { userId } = useAuth();

  useEffect(() => {
    const loadLists = async () => {
      const result = await fetchAllLists(userId);
      setLists(result);
    };
    if (userId) loadLists();
  }, [userId]);

  const toastStyle = {
    background: '#111111',
    color: '#ffffff',
    border: '1px solid #333',
  };

  const handleAdd = async () => {
    try {
      const trimmedNewName = newListName.trim();
      const playerId = getPlayerId(player);
      if (!playerId) {
        toast.error('Player ID unavailable', { style: toastStyle });
        return;
      }
      if (!userId) {
        toast.error('Sign in to save lists', { style: toastStyle });
        return;
      }

      // Helper: check if player is already in a given list
      const isAlreadyInList = (listId: string) => {
        const target = lists.find((l) => l.id === listId);
        return target?.playerIds?.includes(playerId);
      };

      if (!selectedList && trimmedNewName) {
        // E4: Check for existing list with same name (case-insensitive) — auto-select if found
        const existingMatch = lists.find(
          (l) => l.name.toLowerCase() === trimmedNewName.toLowerCase()
        );

        if (existingMatch) {
          if (isAlreadyInList(existingMatch.id)) {
            toast('Player is already in this list.', { style: toastStyle });
            return;
          }
          // Duplicate name detected — treat as "add to existing list"
          await addPlayerToList(existingMatch.id, playerId, userId);
          toast.success(
            `Player added to existing list "${existingMatch.name}"!`,
            { style: toastStyle }
          );
        } else {
          // E4: Create list with player via helper (includes ownerUid)
          await createListWithPlayer(trimmedNewName, playerId, userId);
          toast.success(`List "${trimmedNewName}" created and player added!`, {
            style: toastStyle,
          });
        }
      } else if (selectedList) {
        if (isAlreadyInList(selectedList)) {
          toast('Player is already in this list.', { style: toastStyle });
          return;
        }
        await addPlayerToList(selectedList, playerId, userId);
        toast.success('Player added to list!', { style: toastStyle });
      } else {
        toast.error('Please select or create a list name', {
          style: toastStyle,
        });
        return;
      }

      onClose();
    } catch (err) {
      console.error('Failed to save to list:', err);
      toast.error('Failed to save list', { style: toastStyle });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-neutral-900 p-6 rounded-lg w-full max-w-md">
        <h2 className="text-white text-lg font-bold mb-4">Add to List</h2>

        {lists.length > 0 && (
          <div className="mb-4">
            <label className="text-white/60 text-sm mb-1 block">
              Select Existing List
            </label>
            <select
              value={selectedList}
              onChange={(e) => setSelectedList(e.target.value)}
              className="w-full bg-neutral-800 text-white p-2 rounded border border-white/10"
            >
              <option value="">-- Choose a list --</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-4">
          <label className="text-white/60 text-sm mb-1 block">
            Or Create New List
          </label>
          <input
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="e.g. Free Agent Rankings"
            className="w-full bg-neutral-800 text-white p-2 rounded border border-white/10"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 bg-white/10 text-white rounded hover:bg-white/20"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!userId}
            className="text-sm px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

