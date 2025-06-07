// AddToListModal.jsx
import React, { useEffect, useState } from 'react';
import { db } from '@/firebaseConfig';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';

const AddToListModal = ({ player, onClose }) => {
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState('');
  const [newListName, setNewListName] = useState('');

  useEffect(() => {
    const fetchLists = async () => {
      const snapshot = await getDocs(collection(db, 'lists'));
      const result = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setLists(result);
    };
    fetchLists();
  }, []);

  const handleAdd = async () => {
    try {
      let listId = selectedList;
      const trimmedNewName = newListName.trim();

      if (!selectedList && trimmedNewName) {
        listId = trimmedNewName.toLowerCase().replace(/\s+/g, '_');
        await setDoc(doc(db, 'lists', listId), {
          name: trimmedNewName,
          playerIds: [player.id],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        toast.success(`List "${trimmedNewName}" created and player added!`, {
          style: {
            background: '#111111',
            color: '#ffffff',
            border: '1px solid #333',
          },
        });
      } else if (selectedList) {
        const listRef = doc(db, 'lists', selectedList);
        await updateDoc(listRef, {
          playerIds: arrayUnion(player.id),
          updatedAt: new Date(),
        });
        toast.success('Player added to list!', {
          style: {
            background: '#111111',
            color: '#ffffff',
            border: '1px solid #333',
          },
        });
      } else {
        toast.error('Please select or create a list name', {
          style: {
            background: '#111111',
            color: '#ffffff',
            border: '1px solid #333',
          },
        });
        return;
      }

      onClose();
    } catch (err) {
      console.error('Failed to save to list:', err);
      toast.error('Failed to save list', {
        style: {
          background: '#111111',
          color: '#ffffff',
          border: '1px solid #333',
        },
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <Toaster position="bottom-center" />
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
            className="text-sm px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddToListModal;
