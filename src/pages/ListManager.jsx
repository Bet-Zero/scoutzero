// ListManager.jsx
// Full-page route for building and editing player lists (flat, ranked, or tiered)

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '@/firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import usePlayerData from '@/hooks/usePlayerData.js';
import { toast } from 'react-hot-toast';

import RankedListTier from '@/features/lists/ListTierHeader';
import RankedListControls from '@/features/lists/ListControls';
import ListRankToggle from '@/features/lists/ListRankToggle';
import ListExportWrapper from '@/features/lists/ListPreviewModal/ListExportWrapper';
import ListPlayerRow from '@/features/lists/ListTierHeader/ListPlayerRow';
import ExportOptionsModal from '@/features/lists/ExportOptionsModal';
import ListRowStyleToggle from '@/features/lists/ListRowStyleToggle';
import ListColumnToggle from '@/features/lists/ListColumnToggle';
import ListPreviewModal from '@/features/lists/ListPreviewModal';
import ListSearchBar from '@/features/lists/ListSearchBar';
import { fetchAllLists } from '@/firebase/listHelpers';

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
  const [compact, setCompact] = useState(false);
  const [twoColumn, setTwoColumn] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [allLists, setAllLists] = useState([]);
  const navigate = useNavigate();
  const listsMap = useMemo(() => {
    const map = {};
    allLists.forEach((l) => {
      map[l.id] = l;
    });
    return map;
  }, [allLists]);

  const { players, loading: playersLoading } = usePlayerData();

  useEffect(() => {
    const loadLists = async () => {
      const results = await fetchAllLists();
      setAllLists(results);
    };
    loadLists();
  }, []);

  useEffect(() => {
    const fetchList = async () => {
      try {
        const listRef = doc(db, 'lists', listId);
        const listSnap = await getDoc(listRef);
        if (!listSnap.exists()) throw new Error('List not found');

        const data = listSnap.data();
        const orderIds = data.playerOrder || [];
        const allIds = data.playerIds || [];
        const merged = [...orderIds];
        allIds.forEach((id) => {
          if (!merged.includes(id)) merged.push(id);
        });
        setListData(data);
        setOrder(merged);
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
      const currentPlayerIds = order.filter(
        (id) => !id.startsWith('divider::')
      );
      await updateDoc(doc(db, 'lists', listId), {
        playerOrder: order,
        playerIds: currentPlayerIds,
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
    let rankIndex = 0;
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
        current.players.push({ id: item, index: idx, rankIndex });
        rankIndex += 1;
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
      {!isExport && (
        <div className="w-full max-w-[1100px] mx-auto px-4 mt-10 mb-6 relative z-10">
          <div className="absolute top-0 right-0 flex flex-col items-end gap-2 z-20">
            <ListSearchBar
              listsData={listsMap}
              playersData={playersMap}
              onSelect={(id) => navigate(`/lists/${id}`)}
            />
            <select
              value={listId}
              onChange={(e) => navigate(`/lists/${e.target.value}`)}
              className="bg-neutral-800 text-white text-xs px-2 py-1 rounded border border-white/20"
            >
              {allLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
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
      )}

      <ExportOptionsModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        onSelect={(type) => {
          setExportType(type);
          setCompact(false);
          setIsExport(true);
        }}
      />

      {/* Export Layout */}
      {isExport ? (
        <>
          <div className="w-full max-w-[1100px] mx-auto px-4 mt-10 mb-4 flex justify-end items-center gap-4 z-20">
            <div className="flex items-center gap-4">
              <ListRankToggle isRanked={isRanked} onChange={setIsRanked} />
              {exportType === 'list' && (
                <>
                  <div className="h-6 border-l border-white/20"></div>
                  <ListColumnToggle
                    twoColumn={twoColumn}
                    onChange={setTwoColumn}
                  />
                  <div className="h-6 border-l border-white/20"></div>
                  <ListRowStyleToggle compact={compact} onChange={setCompact} />
                </>
              )}
            </div>
          </div>

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
              compact={compact}
              twoColumn={twoColumn}
              title={listData.name}
              subtitle={listData.description}
            />
          </div>

          <div className="w-full max-w-[1100px] mx-auto px-4 mt-8 mb-12 flex justify-between">
            <button
              onClick={() => setIsExport(false)}
              className="px-3 py-1 text-sm rounded bg-white/10 text-white hover:bg-white/20"
            >
              Back to Edit
            </button>
            <button
              onClick={() => setPreviewOpen(true)}
              className="px-3 py-1 text-sm rounded bg-white/10 text-white hover:bg-white/20"
            >
              Preview
            </button>
          </div>

          {previewOpen && (
            <ListPreviewModal
              open={previewOpen}
              onClose={() => setPreviewOpen(false)}
              players={flatPlayers.map((id) => playersMap[id]).filter(Boolean)}
              tiers={tiers.map((tier) => ({
                label: tier.label,
                players: tier.players
                  .map((p) => playersMap[p.id])
                  .filter(Boolean),
              }))}
              playersMap={playersMap}
              isRanked={isRanked}
              exportType={exportType}
              compact={compact}
              twoColumn={twoColumn}
              title={listData.name}
              subtitle={listData.description}
            />
          )}
        </>
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

          <div className="fixed bottom-6 left-6 z-50">
            <button
              onClick={() => setShowExportModal(true)}
              className="bg-black/20 text-white px-4 py-2 rounded hover:bg-neutral-600"
            >
              Export
            </button>
          </div>

          <div className="fixed top-[72px] right-[1px] z-50 scale-75">
            <ListRankToggle isRanked={isRanked} onChange={setIsRanked} />
          </div>

          <div className="w-full max-w-[1100px] mx-auto px-4 mb-6 text-center">
            <p className="text-xs text-white/30 italic">
              Last updated{' '}
              {listData.updatedAt?.toDate?.().toLocaleDateString() || 'N/A'}
            </p>
          </div>
        </>
      )}
    </>
  );
};

export default ListManager;
