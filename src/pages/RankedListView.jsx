// RankedListView.jsx

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '@/firebaseConfig';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';

import SiteLayout from '@/components/layout/SiteLayout';
import ListPlayerRow from '@/components/lists/ListPlayerRow';

const RankedListView = () => {
  const { listId } = useParams();
  const [listData, setListData] = useState(null);
  const [playersMap, setPlayersMap] = useState({});
  const [order, setOrder] = useState([]);
  const [notes, setNotes] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchListAndPlayers = async () => {
      try {
        const listRef = doc(db, 'lists', listId);
        const listSnap = await getDoc(listRef);
        if (!listSnap.exists()) throw new Error('List not found');

        const data = listSnap.data();
        const ids = data.playerOrder || data.playerIds || [];
        setListData(data);
        setOrder(ids);
        setNotes(data.playerNotes || {});

        const playersSnap = await getDocs(collection(db, 'players'));
        const playersObj = {};
        playersSnap.forEach((doc) => {
          playersObj[doc.id] = { id: doc.id, ...doc.data() };
        });
        setPlayersMap(playersObj);
      } catch (err) {
        console.error('Failed to load list or players:', err);
      }
    };

    fetchListAndPlayers();
  }, [listId]);

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

  if (!listData) {
    return (
      <SiteLayout>
        <div className="text-white text-center mt-12">Loading List...</div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      {/* Header */}
      {/* Enhanced Stylized List Header */}
      <div className="w-full max-w-[1100px] mx-auto px-4 mt-10 mb-6 relative z-10">
        {/* Soft Glow Accent Bar */}
        <div className="h-[5px] w-24 bg-gradient-to-r from-neutral-500 to-neutral-900 rounded-full mb-4 shadow-lg"></div>

        {/* Main Title with glow */}
        <h1 className="text-5xl font-extrabold tracking-tight text-neutral-100 mb-3">
          {listData.name}
        </h1>

        {/* Description in blur box if present */}
        {listData.description && (
          <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-md px-4 py-3 max-w-[800px]">
            <p className="text-white/70 text-sm leading-relaxed italic">
              {listData.description}
            </p>
          </div>
        )}
      </div>

      {/* Manual Rank List */}
      <div className="w-full">
        {order.map((id, index) => {
          const player = playersMap[id];
          if (!player) return null;

          return (
            <ListPlayerRow
              key={id}
              player={player}
              index={index}
              note={notes[id] || ''}
              onNoteChange={handleNoteChange}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
            />
          );
        })}
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
    </SiteLayout>
  );
};

export default RankedListView;
