// ListsHome.jsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  collection,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '@/firebaseConfig';
import CreateListModal from '@/features/lists/CreateListModal';
import ListSearchBar from '@/features/lists/ListSearchBar';
import usePlayerData from '@/hooks/usePlayerData.js';

const ListsHome = () => {
  const [lists, setLists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [renamingListId, setRenamingListId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingListId, setDeletingListId] = useState(null);
  const navigate = useNavigate();

  const { players, loading: playersLoading } = usePlayerData();

  const playersMap = useMemo(() => {
    const map = {};
    players.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [players]);

  const listsMap = useMemo(() => {
    const map = {};
    lists.forEach((l) => {
      map[l.id] = l;
    });
    return map;
  }, [lists]);

  const fetchLists = async () => {
    const snapshot = await getDocs(collection(db, 'lists'));
    const results = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setLists(results);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLists();
  }, []);

  const handleRename = async () => {
    if (!renameValue.trim()) return;
    await updateDoc(doc(db, 'lists', renamingListId), {
      name: renameValue.trim(),
    });
    setRenamingListId(null);
    setRenameValue('');
    fetchLists();
  };

  const handleDelete = async () => {
    await deleteDoc(doc(db, 'lists', deletingListId));
    setDeletingListId(null);
    fetchLists();
  };

  return (
    <>
      <div className="max-w-[800px] py-4 mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">Lists</h1>
          <div className="flex items-center gap-3">
            <ListSearchBar
              listsData={listsMap}
              playersData={playersMap}
              onSelect={(id) => navigate(`/lists/${id}`)}
            />
            <button
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              onClick={() => setShowCreateModal(true)}
            >
              + New List
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-white/60">Loading lists...</div>
        ) : lists.length === 0 ? (
          <div className="text-white/40">
            You haven't created any lists yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lists.map((list) => (
              <div
                key={list.id}
                className="p-4 bg-[#1a1a1a] hover:bg-[#232323] border border-white/10 rounded transition relative"
              >
                <Link to={`/lists/${list.id}`} className="block group">
                  <h2 className="text-lg font-bold text-white mb-1 group-hover:underline">
                    {list.name}
                  </h2>
                  {list.description && (
                    <p className="text-sm text-white/50 mb-2">
                      {list.description}
                    </p>
                  )}
                  <div className="text-xs text-white/30">
                    {list.playerIds?.length || 0} players • Last updated{' '}
                    {list.updatedAt?.toDate?.().toLocaleDateString?.() || '—'}
                  </div>
                </Link>

                <div className="absolute top-4 right-4 flex gap-2">
                  <button
                    onClick={() => {
                      setRenamingListId(list.id);
                      setRenameValue(list.name);
                    }}
                    className="text-white/40 hover:text-white text-xs"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => setDeletingListId(list.id)}
                    className="text-red-500 hover:text-red-600 text-xs"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create List Modal */}
      <CreateListModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          fetchLists();
        }}
        onListCreated={fetchLists}
      />

      {/* Rename Modal */}
      {renamingListId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#111] p-6 rounded border border-white/10 w-full max-w-sm">
            <h2 className="text-white font-bold text-lg mb-4">Rename List</h2>
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full p-2 rounded bg-black border border-white/20 text-white mb-4"
              placeholder="New name"
            />
            <div className="flex justify-end gap-2">
              <button
                className="text-white/50 hover:text-white text-sm"
                onClick={() => setRenamingListId(null)}
              >
                Cancel
              </button>
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                onClick={handleRename}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingListId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#111] p-6 rounded border border-white/10 w-full max-w-sm">
            <h2 className="text-white font-bold text-lg mb-4">
              Delete this list?
            </h2>
            <p className="text-white/60 text-sm mb-6">
              This action cannot be undone. Are you sure?
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="text-white/50 hover:text-white text-sm"
                onClick={() => setDeletingListId(null)}
              >
                Cancel
              </button>
              <button
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ListsHome;
