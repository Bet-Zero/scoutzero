// ListManager.tsx
// E4: Routes reads/writes through listHelpers with ownership scoping

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import useSimplePlayerData from '@/shared/hooks/useSimplePlayerData';
import { useAuth } from '@/shared/hooks/useAuth';
import { toast } from 'react-hot-toast';
import {
  fetchList,
  fetchAllLists,
  saveList,
  type PlayerList,
  type PlayerListReadResult,
  type PlayerNotes,
} from '@/firebase/listHelpers';

import RankedListTier from '@/features/lists/ListTierHeader';
import type { RankedTierPlayer } from '@/features/lists/ListTierHeader';
import RankedListControls from '@/features/lists/ListControls';
import ListRankToggle from '@/features/lists/ListRankToggle';
import ListExportWrapper from '@/features/lists/ListPreviewModal/ListExportWrapper';
import type {
  ListDisplayPlayer,
  ListExportTier,
  ListExportType,
} from '@/features/lists/ListPreviewModal/ListExportWrapper';
import ListPlayerRow from '@/features/lists/ListTierHeader/ListPlayerRow';
import ExportOptionsModal from '@/features/lists/ExportOptionsModal';
import ListRowStyleToggle from '@/features/lists/ListRowStyleToggle';
import ListColumnToggle from '@/features/lists/ListColumnToggle';
import ListPreviewModal from '@/features/lists/ListPreviewModal';
import ListSearchBar from '@/features/lists/ListSearchBar';
import type { SimplePlayer } from '@/shared/hooks/useSimplePlayerData';

type RankedTier = {
  label: string;
  headerIndex: number | null;
  players: RankedTierPlayer[];
};

const isListDisplayPlayer = (
  player: ListDisplayPlayer | undefined
): player is ListDisplayPlayer => Boolean(player);

const isPlayerNotes = (value: unknown): value is PlayerNotes =>
  Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.values(value).every((item) => typeof item === 'string')
  );

const asDisplayString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

type TimestampWithToDate = {
  toDate: () => Date;
};

const hasToDate = (value: unknown): value is TimestampWithToDate =>
  Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as { toDate?: unknown }).toDate === 'function'
  );

const ListManager = () => {
  const { listId } = useParams<{ listId?: string }>();
  const [listData, setListData] = useState<PlayerListReadResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [playersMap, setPlayersMap] = useState<Record<string, SimplePlayer>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [notes, setNotes] = useState<PlayerNotes>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showReorder, setShowReorder] = useState(true);
  const [isExport, setIsExport] = useState(false);
  const [isRanked, setIsRanked] = useState(true); // Default to ranked
  const [exportType, setExportType] = useState<ListExportType>('list');
  const [compact, setCompact] = useState(false);
  const [twoColumn, setTwoColumn] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [allLists, setAllLists] = useState<PlayerList[]>([]);
  const navigate = useNavigate();
  const { userId } = useAuth();
  const listsMap = useMemo(() => {
    const map: Record<string, PlayerList> = {};
    allLists.forEach((l) => {
      map[l.id] = l;
    });
    return map;
  }, [allLists]);

  const { players, loading: playersLoading } = useSimplePlayerData();

  // E4: Load sidebar list scoped to ownerUid
  useEffect(() => {
    const loadLists = async () => {
      const results = await fetchAllLists(userId);
      setAllLists(results);
    };
    if (userId) loadLists();
  }, [userId]);

  // E4: Fetch single list with ownership check + auto-claim
  useEffect(() => {
    const loadList = async () => {
      if (!listId) {
        setNotFound(true);
        return;
      }

      try {
        const result = await fetchList(listId, userId);
        if (!result) {
          setNotFound(true);
          return;
        }

        setNotFound(false);
        setIsOwner(result.ownershipValid);
        const orderIds = Array.isArray(result.playerOrder)
          ? result.playerOrder.filter((id): id is string => typeof id === 'string')
          : [];
        const allIds = Array.isArray(result.playerIds)
          ? result.playerIds.filter((id): id is string => typeof id === 'string')
          : [];
        const merged = [...orderIds];
        allIds.forEach((id) => {
          if (!merged.includes(id)) merged.push(id);
        });
        setListData(result);
        setOrder(merged);
        setNotes(isPlayerNotes(result.playerNotes) ? result.playerNotes : {});
      } catch (err) {
        console.error('Failed to load list:', err);
        setNotFound(true);
      }
    };

    loadList();
  }, [listId, userId]);

  useEffect(() => {
    const map: Record<string, SimplePlayer> = {};
    players.forEach((p) => {
      map[p.id] = p;
    });
    setPlayersMap(map);
  }, [players]);

  const handleNoteChange = (id: string, text: string) => {
    setNotes((prev) => ({ ...prev, [id]: text }));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...order];
    [newOrder[index - 1], newOrder[index]] = [
      newOrder[index],
      newOrder[index - 1],
    ];
    setOrder(newOrder);
  };

  const handleMoveDown = (index: number) => {
    if (index === order.length - 1) return;
    const newOrder = [...order];
    [newOrder[index + 1], newOrder[index]] = [
      newOrder[index],
      newOrder[index + 1],
    ];
    setOrder(newOrder);
  };

  const handleRemove = (index: number) => {
    const newOrder = [...order];
    const removedId = newOrder.splice(index, 1)[0];
    setOrder(newOrder);

    if (removedId && !removedId.startsWith('divider::')) {
      const updatedNotes = { ...notes };
      delete updatedNotes[removedId];
      setNotes(updatedNotes);
    }
  };

  // E4: Save via helper with ownership guard
  const handleSave = async () => {
    if (!listId) {
      toast.error('List unavailable');
      return;
    }

    if (!userId) {
      toast.error('Sign in to save this list');
      return;
    }

    try {
      setIsSaving(true);
      const currentPlayerIds = order.filter(
        (id) => !id.startsWith('divider::')
      );
      await saveList(
        listId,
        {
          playerOrder: order,
          playerIds: currentPlayerIds,
          playerNotes: notes,
        },
        userId
      );
      toast.success('List saved!');
    } catch (saveError) {
      console.error('Failed to save list:', saveError);
      toast.error('Failed to save list');
    } finally {
      setIsSaving(false);
    }
  };

  const insertDividerAtBottom = () => {
    if (!isRanked) return;
    setOrder((prev) => [...prev, `divider::New Tier`]);
  };

  const handleLabelChange = (index: number, newLabel: string) => {
    const newOrder = [...order];
    newOrder[index] = `divider::${newLabel}`;
    setOrder(newOrder);
  };

  const tiers = useMemo(() => {
    if (!isRanked) return [];

    const result: RankedTier[] = [];
    let current: RankedTier = { label: '', headerIndex: null, players: [] };
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

  const flatExportPlayers = useMemo(
    () => flatPlayers.map((id) => playersMap[id]).filter(isListDisplayPlayer),
    [flatPlayers, playersMap]
  );

  const exportTiers = useMemo<ListExportTier[]>(
    () =>
      tiers.map((tier) => ({
        label: tier.label,
        players: tier.players
          .map((p) => playersMap[p.id])
          .filter(isListDisplayPlayer),
      })),
    [playersMap, tiers]
  );

  if (notFound) {
    return (
      <div className="text-white text-center mt-12">
        <p className="text-lg mb-4">List not found.</p>
        <Link to="/lists" className="text-blue-400 hover:text-blue-300 text-sm">
          Back to Lists
        </Link>
      </div>
    );
  }

  if (!listData || playersLoading) {
    return <div className="text-white text-center mt-12">Loading List...</div>;
  }

  const listTitle = asDisplayString(listData.name, 'Untitled List');
  const listDescription = asDisplayString(listData.description);
  const lastUpdatedDate = hasToDate(listData.updatedAt)
    ? listData.updatedAt.toDate()
    : null;

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
              value={listId ?? ''}
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
            {listTitle}
          </h1>
          {listDescription && (
            <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-md px-4 py-3 max-w-[800px]">
              <p className="text-white/70 text-sm leading-relaxed italic">
                {listDescription}
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
              players={flatExportPlayers}
              tiers={exportTiers}
              playersMap={playersMap}
              isExport={isExport}
              isRanked={isRanked}
              exportType={exportType}
              compact={compact}
              twoColumn={twoColumn}
              title={listTitle}
              subtitle={listDescription}
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
              players={flatExportPlayers}
              tiers={exportTiers}
              playersMap={playersMap}
              isRanked={isRanked}
              exportType={exportType}
              compact={compact}
              twoColumn={twoColumn}
              title={listTitle}
              subtitle={listDescription}
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
              : flatPlayers.map((id, idx) => {
                  const realIndex = order.indexOf(id);
                  return (
                    <ListPlayerRow
                      key={`flat-${id}`}
                      index={realIndex}
                      player={playersMap[id]}
                      note={notes[id]}
                      onNoteChange={handleNoteChange}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                      onRemove={handleRemove}
                      showReorder={showReorder}
                      showRank={false}
                    />
                  );
                })}
          </div>

          <RankedListControls
            showReorder={showReorder && isOwner}
            onToggleReorder={() => setShowReorder(!showReorder)}
            onAddDivider={insertDividerAtBottom}
            onSave={handleSave}
            isSaving={isSaving || !isOwner}
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
              {lastUpdatedDate?.toLocaleDateString() || 'N/A'}
            </p>
          </div>
        </>
      )}
    </>
  );
};

export default ListManager;
