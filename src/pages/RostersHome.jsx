// RostersHome.jsx
import React, { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '@/firebaseConfig';
import CreateRosterModal from '@/features/roster/CreateRosterModal';

const RostersHome = () => {
  const [rosters, setRosters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const fetchRosters = async () => {
    const snapshot = await getDocs(collection(db, 'rosterProjects'));
    const results = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setRosters(results);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRosters();
  }, []);

  const handleRename = async () => {
    if (!renameValue.trim()) return;
    await updateDoc(doc(db, 'rosterProjects', renamingId), {
      name: renameValue.trim(),
    });
    setRenamingId(null);
    setRenameValue('');
    fetchRosters();
  };

  const handleDelete = async () => {
    await deleteDoc(doc(db, 'rosterProjects', deletingId));
    setDeletingId(null);
    fetchRosters();
  };

  return (
    <>
      <div className="max-w-[800px] py-4 mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">Rosters</h1>
          <button
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            onClick={() => setShowCreateModal(true)}
          >
            + New Roster
          </button>
        </div>

        {isLoading ? (
          <div className="text-white/60">Loading rosters...</div>
        ) : rosters.length === 0 ? (
          <div className="text-white/40">
            You haven't created any rosters yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rosters.map((r) => (
              <div
                key={r.id}
                className="p-4 bg-[#1a1a1a] hover:bg-[#232323] border border-white/10 rounded transition relative"
              >
                <Link to="/roster" className="block group">
                  <h2 className="text-lg font-bold text-white mb-1 group-hover:underline">
                    {r.name}
                  </h2>
                  {r.team && (
                    <p className="text-sm text-white/50 mb-2">{r.team}</p>
                  )}
                  <div className="text-xs text-white/30">
                    Last updated{' '}
                    {r.updatedAt?.toDate?.().toLocaleDateString?.() || '—'}
                  </div>
                </Link>

                <div className="absolute top-4 right-4 flex gap-2">
                  <button
                    onClick={() => {
                      setRenamingId(r.id);
                      setRenameValue(r.name);
                    }}
                    className="text-white/40 hover:text-white text-xs"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => setDeletingId(r.id)}
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

      <CreateRosterModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          fetchRosters();
        }}
        onCreated={fetchRosters}
      />

      {renamingId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#111] p-6 rounded border border-white/10 w-full max-w-sm">
            <h2 className="text-white font-bold text-lg mb-4">Rename Roster</h2>
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full p-2 rounded bg-black border border-white/20 text-white mb-4"
              placeholder="New name"
            />
            <div className="flex justify-end gap-2">
              <button
                className="text-white/50 hover:text-white text-sm"
                onClick={() => setRenamingId(null)}
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

      {deletingId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#111] p-6 rounded border border-white/10 w-full max-w-sm">
            <h2 className="text-white font-bold text-lg mb-4">
              Delete this roster?
            </h2>
            <p className="text-white/60 text-sm mb-6">
              This action cannot be undone. Are you sure?
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="text-white/50 hover:text-white text-sm"
                onClick={() => setDeletingId(null)}
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

export default RostersHome;
