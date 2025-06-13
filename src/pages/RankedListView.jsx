// RankedListView.jsx

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '@/firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import usePlayerData from '@/hooks/usePlayerData.js';
import { toast } from 'react-hot-toast';

import ListPlayerRow from '@/features/lists/ListPlayerRow';
import { ChevronUp, ChevronDown, Plus, Trash2 } from 'lucide-react';

const RankedListView = () => {
  const { listId } = useParams();
  const [listData, setListData] = useState(null);
  const [playersMap, setPlayersMap] = useState({});
  const [order, setOrder] = useState([]);
  const [notes, setNotes] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [showReorder, setShowReorder] = useState(true);
  const { players, loading: playersLoading } = usePlayerData();

  useEffect(() => {
    const fetchList = async () => {
      try {
        const listRef = doc(db, 'lists', listId);
        const listSnap = await getDoc(listRef);
        if (!listSnap.exists()) throw new Error('List not found');

        const data = listSnap.data();
        const ids = data.playerOrder || data.playerIds || [];
        setListData(data);
        setOrder(ids);
        setNotes(data.playerNotes || {});
      } catch (err) {
        console.error('Failed to load list:', err);
      }
    };

    fetchList();
  }, [listId]);

  useEffect(() => {
    const map = {};
    players.forEach((p) => {
      map[p.id] = p;
    });
    setPlayersMap(map);
  }, [players]);

  const handleNoteChange = (id, text) => {
    setNotes((prev) => ({ ...prev, [id]: text }));
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newOrder = [...order];
    [newOrder[index - 1], newOrder[index]] = [
      newOrder[index],
      newOrder[index - 1],
    ];
    setOrder(newOrder);
  };

  const handleMoveDown = (index) => {
    if (index === order.length - 1) return;
    const newOrder = [...order];
    [newOrder[index + 1], newOrder[index]] = [
      newOrder[index],
      newOrder[index + 1],
    ];
    setOrder(newOrder);
  };

  const handleRemove = (index) => {
    const newOrder = [...order];
    const removedId = newOrder.splice(index, 1)[0];
    setOrder(newOrder);

    // Also remove associated notes
    if (!removedId.startsWith('divider::')) {
      const updatedNotes = { ...notes };
      delete updatedNotes[removedId];
      setNotes(updatedNotes);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateDoc(doc(db, 'lists', listId), {
        playerOrder: order,
        playerNotes: notes,
        updatedAt: new Date(),
      });
      toast.success('List saved!');
    } catch (err) {
      toast.error('Failed to save list');
    } finally {
      setIsSaving(false);
    }
  };

  const insertDividerAtBottom = () => {
    setOrder((prev) => [...prev, `divider::New Tier`]);
  };

  if (!listData || playersLoading) {
    return <div className="text-white text-center mt-12">Loading List...</div>;
  }

  return (
    <>
      {/* Header */}
      <div className="w-full max-w-[1100px] mx-auto px-4 mt-10 mb-6 relative z-10">
        <div className="h-[5px] w-24 bg-gradient-to-r from-neutral-500 to-neutral-900 rounded-full mb-4 shadow-lg"></div>
        <h1 className="text-5xl font-extrabold tracking-tight text-neutral-100 mb-3">
          {listData.name}
        </h1>
        {listData.description && (
          <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-md px-4 py-3 max-w-[800px]">
            <p className="text-white/70 text-sm leading-relaxed italic">
              {listData.description}
            </p>
          </div>
        )}
      </div>

      {/* Ranked List */}
      <div className="w-full">
        {order.map((item, index) => {
          const isDivider =
            typeof item === 'string' && item.startsWith('divider::');

          if (isDivider) {
            const label = item.replace('divider::', '');

            return (
              <div
                key={`divider-${index}`}
                className="relative w-full max-w-[1100px] mx-auto mb-6"
              >
                {showReorder && (
                  <div className="absolute -left-6 top-[22px] flex flex-col items-center z-10">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="text-white/30 hover:text-white disabled:opacity-20"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <div className="text-xs font-bold text-white/40">—</div>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === order.length - 1}
                      className="text-white/30 hover:text-white disabled:opacity-20"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                )}

                {/* Tier Label Input */}
                <div className="flex items-center gap-3 text-left px-4 py-2 bg-white/5 border border-white/10 rounded">
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => {
                      const newLabel = e.target.value;
                      const newOrder = [...order];
                      newOrder[index] = `divider::${newLabel}`;
                      setOrder(newOrder);
                    }}
                    className="text-xl font-bold tracking-wide bg-transparent text-white w-full focus:outline-none"
                  />
                  <button
                    onClick={() => handleRemove(index)}
                    title="Delete Tier"
                    className="text-neutral-800 hover:text-white/70"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          }

          const player = playersMap[item];
          if (!player) return null;

          return (
            <ListPlayerRow
              key={item}
              player={player}
              index={index}
              note={notes[item] || ''}
              onNoteChange={handleNoteChange}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onRemove={handleRemove}
              showReorder={showReorder}
            />
          );
        })}
      </div>

      {/* Bottom Controls: Add Divider + Toggle Reorder */}
      <div className="w-full max-w-[1100px] mx-auto px-4 mt-4 flex justify-end gap-2">
        <button
          onClick={() => setShowReorder(!showReorder)}
          className="text-xs text-white/40 hover:text-white px-2 py-1 rounded border border-white/10"
        >
          {showReorder ? 'Hide Arrows' : 'Show Arrows'}
        </button>

        <button
          onClick={insertDividerAtBottom}
          title="Add Divider"
          className="text-white/40 hover:text-white transition p-2 rounded-full hover:bg-white/10"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Save Button */}
      <div className="w-full max-w-[1100px] mx-auto px-4 text-right mt-6">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-md transition disabled:opacity-40"
        >
          {isSaving ? 'Saving...' : 'Save List'}
        </button>
      </div>

      {/* Last Updated Footer */}
      <div className="w-full max-w-[1100px] mx-auto px-4 mt-12 mb-6 text-right">
        <p className="text-xs text-white/30 italic">
          Last updated:{' '}
          {listData.updatedAt?.toDate?.().toLocaleDateString() || 'N/A'}
        </p>
      </div>
    </>
  );
};

export default RankedListView;
