// ListManager.jsx
// Full-page route for building and editing player lists (flat, ranked, or tiered)

import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '@/firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import usePlayerData from '@/hooks/usePlayerData.js';
import { toast } from 'react-hot-toast';

import RankedListTier from '@/features/lists/ListTierHeader';
import RankedListControls from '@/features/lists/ListControls';
import ListRankToggle from '@/features/lists/ListRankToggle';
import ListExportWrapper from '@/features/lists/ListExportWrapper';
import ListPlayerRow from '@/features/lists/ListPlayerRow';
import ExportOptionsModal from '@/features/lists/ExportOptionsModal';

const ListManager = () => {
  const { listId } = useParams();
  const [listData, setListData] = useState(null);
  const [playersMap, setPlayersMap] = useState({});
  const [order, setOrder] = useState([]);
  const [notes, setNotes] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [showReorder, setShowReorder] = useState(true);
  const [isExport, setIsExport] = useState(false);
  const [isRanked, setIsRanked] = useState(true); // Default to ranked
  const [exportType, setExportType] = useState('list');
  const [showExportModal, setShowExportModal] = useState(false);

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
    if (!isRanked) return;
    setOrder((prev) => [...prev, `divider::New Tier`]);
  };

  const handleLabelChange = (index, newLabel) => {
    const newOrder = [...order];
    newOrder[index] = `divider::${newLabel}`;
    setOrder(newOrder);
  };

  const tiers = useMemo(() => {
    if (!isRanked) return [];

    const result = [];
    let current = { label: '', headerIndex: null, players: [] };
    order.forEach((item, idx) => {
      if (typeof item === 'string' && item.startsWith('divider::')) {
        if (current.headerIndex !== null || current.players.length > 0) {
          result.push(current);
        }
        current = {
          label: item.replace('divider::', ''),
          headerIndex: idx,
          players: [],
        };
      } else {
        current.players.push({ id: item, index: idx });
      }
    });
    result.push(current);
    return result.filter((t) => t.headerIndex !== null || t.players.length > 0);
  }, [order, isRanked]);

  const flatPlayers = useMemo(() => {
    return order.filter((id) => !id.startsWith('divider::'));
  }, [order]);

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

      {/* Toggles */}
      <div className="w-full max-w-[1100px] mx-auto px-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <ListRankToggle isRanked={isRanked} onChange={setIsRanked} />
          {!isExport && (
            <button
              onClick={() => setShowExportModal(true)}
              className="px-3 py-1 text-sm rounded bg-white/10 text-white hover:bg-white/20"
            >
              Export
            </button>
          )}
          {isExport && (
            <button
              onClick={() => setIsExport(false)}
              className="px-3 py-1 text-sm rounded bg-white/10 text-white hover:bg-white/20"
            >
              Back to Edit
            </button>
          )}
        </div>
      </div>

      <ExportOptionsModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        onSelect={(type) => {
          setExportType(type);
          setIsExport(true);
        }}
      />

      {/* Export Layout */}
      {isExport ? (
        <div className="w-full max-w-[1100px] mx-auto px-4">
          <ListExportWrapper
            players={flatPlayers.map((id) => playersMap[id]).filter(Boolean)}
            tiers={tiers.map((tier) => ({
              label: tier.label,
              players: tier.players
                .map((p) => playersMap[p.id])
                .filter(Boolean),
            }))}
            playersMap={playersMap}
            isExport={isExport}
            isRanked={isRanked}
            exportType={exportType}
          />
        </div>
      ) : (
        <>
          <div className="w-full">
            {isRanked
              ? tiers.map((tier, idx) => (
                  <RankedListTier
                    key={`tier-${idx}`}
                    label={tier.label || `Tier ${idx + 1}`}
                    headerIndex={tier.headerIndex}
                    players={tier.players}
                    playersMap={playersMap}
                    notes={notes}
                    showReorder={showReorder}
                    onLabelChange={handleLabelChange}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                    onRemove={handleRemove}
                    onNoteChange={handleNoteChange}
                    orderLength={order.length}
                  />
                ))
              : flatPlayers.map((id, idx) => (
                  <ListPlayerRow
                    key={`flat-${id}`}
                    index={idx}
                    player={playersMap[id]}
                    note={notes[id]}
                    onNoteChange={handleNoteChange}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                    onRemove={handleRemove}
                    showReorder={showReorder}
                    showRank={false}
                  />
                ))}
          </div>

          <RankedListControls
            showReorder={showReorder}
            onToggleReorder={() => setShowReorder(!showReorder)}
            onAddDivider={insertDividerAtBottom}
            onSave={handleSave}
            isSaving={isSaving}
            isRanked={isRanked}
          />

          <div className="w-full max-w-[1100px] mx-auto px-4 mt-12 mb-6 text-right">
            <p className="text-xs text-white/30 italic">
              Last updated:{' '}
              {listData.updatedAt?.toDate?.().toLocaleDateString() || 'N/A'}
            </p>
          </div>
        </>
      )}
    </>
  );
};

export default ListManager;
