// TierListsHome.tsx
// E4: Routes all CRUD through listHelpers with ownership scoping
import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  fetchAllTierLists,
  renameTierList,
  deleteTierList,
} from '@/firebase/listHelpers';
import type { TierList } from '@/firebase/listHelpers';
import { CreateTierListModal } from '@/features/tierMaker/CreateTierListModal';
import ListSearchBar from '@/features/lists/ListSearchBar';
import useSimplePlayerData from '@/shared/hooks/useSimplePlayerData';
import type { SimplePlayer } from '@/shared/hooks/useSimplePlayerData';

const toTierListRoute = (list: TierList) =>
  `/tier-maker/${list.id}?mode=${list.mode === 'pyramid' ? 'tieramid' : 'standard'}`;

const TierListsHome = () => {
  const [lists, setLists] = useState<TierList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { userId, loading: authLoading } = useAuth();
  const { players } = useSimplePlayerData();

  const playersMap = useMemo(() => {
    const map: Record<string, SimplePlayer> = {};
    players.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [players]);

  const listsMap = useMemo(() => {
    const map: Record<string, { name: string; playerIds: string[] }> = {};
    lists.forEach((l) => {
      const ids: string[] = [];
      Object.values(l.tiers || {}).forEach((arr) => {
        if (Array.isArray(arr)) {
          ids.push(...arr.filter((id): id is string => typeof id === 'string'));
        }
      });
      map[l.id] = { name: String(l.name ?? 'Untitled tier list'), playerIds: ids };
    });
    return map;
  }, [lists]);

  const handleSelectTierList = (id: string) => {
    const selectedList = lists.find((list) => list.id === id);
    if (!selectedList) return;
    navigate(toTierListRoute(selectedList));
  };

  // E4: Fetch tier lists scoped to ownerUid
  const fetchLists = async () => {
    if (!userId) {
      setLists([]);
      setIsLoading(false);
      return;
    }
    try {
      const results = await fetchAllTierLists(userId);
      setLists(results);
    } catch (error) {
      console.error('Failed to fetch tier lists:', error);
      setLists([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) fetchLists();
  }, [userId, authLoading]);

  // E4: Rename via helper with ownership guard
  const handleRename = async () => {
    if (!renameValue.trim()) return;
    if (!renamingId) return;
    if (!userId) return;
    try {
      await renameTierList(renamingId, renameValue.trim(), userId);
    } catch (err) {
      console.error('Rename failed:', err);
    }
    setRenamingId(null);
    setRenameValue('');
    fetchLists();
  };

  // E4: Delete via helper with ownership guard
  const handleDelete = async () => {
    try {
      if (!deletingId) return;
      if (!userId) return;
      await deleteTierList(deletingId, userId);
    } catch (err) {
      console.error('Delete failed:', err);
    }
    setDeletingId(null);
    fetchLists();
  };

  return (
    <>
      <div className="max-w-[800px] py-4 mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">Tier Lists</h1>
          <div className="flex items-center gap-3">
            <ListSearchBar
              listsData={listsMap}
              playersData={playersMap}
              onSelect={handleSelectTierList}
              placeholder="Search tier lists..."
            />
            <button
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              onClick={() => setShowCreateModal(true)}
            >
              + New Tier List
            </button>
          </div>
        </div>

        {isLoading || authLoading ? (
          <div className="text-white/60">Loading lists...</div>
        ) : !userId ? (
          <div className="text-white/40">
            Unable to initialize session. Tier lists are unavailable.
          </div>
        ) : lists.length === 0 ? (
          <div className="text-white/40">
            You haven&apos;t created any tier lists yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lists.map((list) => (
              <div
                key={list.id}
                className="p-4 bg-[#1a1a1a] hover:bg-[#232323] border border-white/10 rounded transition relative"
              >
                <Link to={toTierListRoute(list)} className="block group">
                  <h2 className="text-lg font-bold text-white mb-1 group-hover:underline">
                    {String(list.name ?? 'Untitled tier list')}
                  </h2>
                </Link>

                <div className="absolute top-4 right-4 flex gap-2">
                  <button
                    onClick={() => {
                      setRenamingId(list.id);
                      setRenameValue(String(list.name ?? 'Untitled tier list'));
                    }}
                    className="text-white/40 hover:text-white text-xs"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => setDeletingId(list.id)}
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

      <CreateTierListModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          fetchLists();
        }}
        onCreated={fetchLists}
      />

      {renamingId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#111] p-6 rounded border border-white/10 w-full max-w-sm">
            <h2 className="text-white font-bold text-lg mb-4">
              Rename Tier List
            </h2>
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
              Delete this tier list?
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

export default TierListsHome;
