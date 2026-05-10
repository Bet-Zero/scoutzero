import React, { useState, useMemo, useEffect, useCallback } from 'react';
import useSimplePlayerData from '@/shared/hooks/useSimplePlayerData';
import useFirebaseQuery from '@/shared/hooks/useFirebaseQuery';
import { useAuth } from '@/shared/hooks/useAuth';
import { where } from 'firebase/firestore';
import { POSITION_MAP } from '@/shared/utils/roles';
import { TeamListFull } from '@/constants/teamList';
import DrawerShell from '@/shared/components/ui/drawers/DrawerShell';
import OpenDrawerButton from '@/shared/components/ui/drawers/OpenDrawerButton';
import AddPlayerDrawer from '@/features/roster/AddPlayerDrawer';
import { RankingSession } from './RankingSession';
import TierPlayerTile from '@/features/lists/TierPlayerTile';
import { useRankerSession } from './hooks/useRankerSession';
import { hasLocalDraft } from './utils/rankerLocalDraft';
import { Clock, Play, Trash2, X, RotateCcw } from 'lucide-react';
import type { PlayerList } from '@/firebase/listHelpers';
import type { ListDisplayPlayer } from '@/features/lists/ListPreviewModal/ListExportWrapper';
import type { RosterDrawerPlayer } from '@/features/roster/utils';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';
import type { HydratedRankerDraft } from './hooks/useRankerSession';

type RankerPoolPlayer = RosterManagerPlayer;
type RankerDraftBannerData = {
  name?: string | null;
  results?: unknown[] | null;
  playerPoolIds?: string[] | null;
  isFinished?: boolean | null;
  draftUpdatedAt?: number | null;
};

// ─── Pool Card ────────────────────────────────────────────────────────────────

export const PoolCard = ({
  player,
  onRemove,
}: {
  player: RankerPoolPlayer;
  onRemove: (id: string) => void;
}) => (
  <div className="relative group">
    <TierPlayerTile
      player={
        {
          ...player,
          team: String(player.team ?? player.bio?.display?.team ?? ''),
          player_id: player.id,
        } as ListDisplayPlayer
      }
    />
    <button
      onClick={() => onRemove(player.id)}
      title="Remove player"
      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-neutral-700 border border-white/20 text-white/50 hover:bg-red-600 hover:text-white hover:border-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 text-[10px] font-bold leading-none"
    >
      ✕
    </button>
  </div>
);

// ─── Local Draft Resume Banner ────────────────────────────────────────────────

export const LocalDraftBanner = ({
  draft,
  onResume,
  onStartNew,
  onClear,
  loading,
}: {
  draft: RankerDraftBannerData | null;
  onResume: () => void;
  onStartNew: () => void;
  onClear: () => void;
  loading: boolean;
}) => {
  if (!draft) return null;

  const resultsCount = draft.results?.length || 0;
  const playerCount = draft.playerPoolIds?.length || 0;
  const isFinished = draft.isFinished || false;
  const lastUpdated = draft.draftUpdatedAt
    ? new Date(draft.draftUpdatedAt)
    : null;

  const formatDate = (date: Date | null) => {
    if (!date) return 'unknown';
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <RotateCcw className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-white font-medium text-sm mb-0.5">
              {isFinished
                ? 'You have a completed ranking'
                : 'You have an in-progress session'}
            </p>
            <p className="text-white/50 text-xs">
              "{draft.name || 'Untitled'}" — {resultsCount} comparisons,{' '}
              {playerCount} players
            </p>
            <p className="text-white/30 text-xs mt-0.5">
              Last updated: {formatDate(lastUpdated)}
            </p>
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3 ml-13">
        <button
          onClick={onResume}
          disabled={loading}
          className="px-4 py-2 text-sm rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          <Play className="w-3.5 h-3.5" />
          Resume
        </button>
        <button
          onClick={onStartNew}
          disabled={loading}
          className="px-4 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          Start New
        </button>
        <button
          onClick={() => {
            if (
              window.confirm(
                'Clear this draft? You will lose all progress. This cannot be undone.'
              )
            ) {
              onClear();
            }
          }}
          disabled={loading}
          className="px-4 py-2 text-sm rounded-lg bg-white/10 hover:bg-red-500/30 text-white/70 hover:text-red-300 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const RankingBuilder = () => {
  const { players: allPlayers, loading } = useSimplePlayerData();
  const { userId } = useAuth();
  console.log('OWNER UID (from useAuth):', userId);

  // Lists query (owner-scoped)
  const ownerConstraints = useMemo(
    () => (userId ? [where('ownerUid', '==', userId)] : []),
    [userId]
  );
  const { data: listsData } = useFirebaseQuery<PlayerList>(
    'lists',
    ownerConstraints
  );

  // Session hook - now local-first with optional Firestore for owners
  const {
    isOwner,
    localDraft,
    hasLocalSession,
    loadingFirestore,
    saveStatus,
    listSaveStatus,
    savedListMeta,
    createLocalDraft,
    updateLocalDraft,
    updateLocalDraftNow,
    loadAndHydrateLocalDraft,
    deleteLocalDraft,
    markFinished,
    saveAdjustments,
    clearSession,
    saveToFirestore,
    saveAsList,
  } = useRankerSession();

  const processedPlayers = useMemo<Array<RosterDrawerPlayer<RosterManagerPlayer>>>(
    () =>
      allPlayers.map((rawPlayer) => {
        const player = rawPlayer as RosterManagerPlayer;
        const contractValues = player.contracts
          ? Object.values(player.contracts).filter(Boolean)
          : [];
        const contractData =
          player.primaryContract ||
          contractValues[0] ||
          null;

        return {
          id: player.id,
          player_id: player.id,
          name: (player.bio?.displayName || player.name || '').toLowerCase(),
          team: String(player.bio?.display?.team || '').toLowerCase(),
          position:
            player.formattedPosition ||
            POSITION_MAP[player.bio?.position || ''] ||
            player.bio?.position ||
            '',
          offenseRoles: [
            player.offenseRole?.toLowerCase() || '',
            player.primaryEvaluation?.roles?.offense2?.toLowerCase() || '',
          ],
          defenseRoles: [
            player.defenseRole?.toLowerCase() || '',
            player.primaryEvaluation?.roles?.defense2?.toLowerCase() || '',
          ],
          offenseSubroles: player.subRoles?.offense || [],
          defenseSubroles: player.subRoles?.defense || [],
          shootingProfile: (player.shootingProfile || '').toLowerCase(),
          badges: player.badges || [],
          salary: contractData?.salariesByYear?.find(
            (s) => s.year === 2025 || String(s.season ?? '').startsWith('2025')
          )?.salary,
          freeAgentYear:
            player.bio?.display?.freeAgentYear?.toString() ||
            contractData?.freeAgency?.freeAgentYear?.toString() ||
            null,
          freeAgentType: (
            player.bio?.display?.freeAgentType ||
            contractData?.freeAgency?.freeAgentType ||
            ''
          ).toLowerCase(),
          contractType: (contractData?.contractType || '').toLowerCase(),
          extension: (() => {
            const extensionContract = contractValues.find(
              (contract) => contract?.isExtension
            );
            return extensionContract
              ? {
                  freeAgentYear:
                    extensionContract.freeAgency?.freeAgentYear ?? null,
                }
              : null;
          })(),
          options: contractData?.options || [],
          original: player,
        };
      }),
    [allPlayers]
  );

  const playersMap = useMemo(() => {
    const map: Record<string, RosterManagerPlayer> = {};
    allPlayers.forEach((rawPlayer) => {
      const player = rawPlayer as RosterManagerPlayer;
      map[player.id] = player;
    });
    return map;
  }, [allPlayers]);

  const lists = useMemo(
    () =>
      (listsData || []).map((l) => {
        const orderIds = Array.isArray(l.playerOrder)
          ? l.playerOrder.filter((id): id is string => typeof id === 'string')
          : [];
        const allIds = Array.isArray(l.playerIds)
          ? l.playerIds.filter((id): id is string => typeof id === 'string')
          : [];
        const merged = [...orderIds];
        allIds.forEach((id) => {
          if (!merged.includes(id)) merged.push(id);
        });
        return { id: l.id, name: l.name, playerIds: merged };
      }),
    [listsData]
  );

  const [pool, setPool] = useState<RankerPoolPlayer[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedList, setSelectedList] = useState('');
  const [started, setStarted] = useState(false);

  // Session persistence state - now local-first
  const [resumedSessionData, setResumedSessionData] =
    useState<HydratedRankerDraft | null>(null);
  const [showLocalDraftBanner, setShowLocalDraftBanner] = useState(true);

  // Handle resuming from local draft
  const handleResumeLocalDraft = useCallback(() => {
    const hydratedDraft = loadAndHydrateLocalDraft();
    if (!hydratedDraft) {
      console.error('[RankingBuilder] Cannot resume: no valid local draft');
      return;
    }

    // Reconstruct pool from playerPoolIds using playersMap
    const resumedPool = hydratedDraft.playerPoolIds
      .map((id) => playersMap[id])
      .filter((player): player is RosterManagerPlayer => Boolean(player));

    if (resumedPool.length < 2) {
      console.error('[RankingBuilder] Cannot resume: not enough players found');
      return;
    }

    setPool(resumedPool);
    setResumedSessionData(hydratedDraft);
    setStarted(true);
  }, [loadAndHydrateLocalDraft, playersMap]);

  // Handle starting a new session (creates local draft, NO Firestore)
  const handleStartNew = useCallback(() => {
    if (pool.length < 2) return;

    const playerPoolIds = pool.map((p) => p.id);
    createLocalDraft({ playerPoolIds });
    setResumedSessionData(null);
    setStarted(true);
  }, [pool, createLocalDraft]);

  // Handle clearing local draft and starting fresh
  const handleClearAndStartNew = useCallback(() => {
    deleteLocalDraft();
    setShowLocalDraftBanner(false);
  }, [deleteLocalDraft]);

  // Handle just clearing the draft
  const handleClearDraft = useCallback(() => {
    deleteLocalDraft();
    setShowLocalDraftBanner(false);
  }, [deleteLocalDraft]);

  const addPlayerToPool = (player: RosterManagerPlayer) => {
    setPool((prev) => {
      if (prev.some((p) => p.id === player.id)) return prev;
      return [...prev, player];
    });
  };

  const addPlayersToPool = (playersArr: RosterManagerPlayer[]) => {
    setPool((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      return [...prev, ...playersArr.filter((p) => !existingIds.has(p.id))];
    });
  };

  const handleAddTeam = () => {
    if (!selectedTeamId) return;
    const team = TeamListFull.find((t) => t.id === selectedTeamId);
    if (!team) return;
    const teamCode = team.code.toUpperCase();
    const teamPlayers = allPlayers
      .filter((p) => String(p.bio?.display?.teamId || '').toUpperCase() === teamCode)
      .map((player) => player as RosterManagerPlayer);
    addPlayersToPool(teamPlayers);
    setSelectedTeamId('');
  };

  const handleAddList = () => {
    if (!selectedList) return;
    const list = lists.find((l) => l.id === selectedList);
    if (!list) return;
    addPlayersToPool(
      list.playerIds
        .map((id) => playersMap[id])
        .filter((player): player is RosterManagerPlayer => Boolean(player))
    );
    setSelectedList('');
  };

  const removePlayer = (id: string) =>
    setPool((prev) => prev.filter((p) => p.id !== id));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-white/30 text-sm">
        Loading players…
      </div>
    );
  }

  if (started) {
    return (
      <RankingSession
        playerPool={pool}
        resumedSessionData={resumedSessionData}
        autosave={updateLocalDraft}
        saveNow={updateLocalDraftNow}
        saveAdjustments={saveAdjustments}
        markFinished={markFinished}
        isOwner={isOwner}
        saveToFirestore={saveToFirestore}
        saveStatus={saveStatus}
        saveAsList={saveAsList}
        listSaveStatus={listSaveStatus}
        savedListMeta={savedListMeta}
      />
    );
  }

  const canStart = pool.length >= 2;

  return (
    <div className="flex relative">
      {!drawerOpen && <OpenDrawerButton onClick={() => setDrawerOpen(true)} />}

      <DrawerShell isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <AddPlayerDrawer
          onClose={() => setDrawerOpen(false)}
          allPlayers={processedPlayers}
          onSelect={addPlayerToPool}
          onSelectAll={addPlayersToPool}
        />
      </DrawerShell>

      <div
        className={`flex-1 transition-[margin] duration-300 ease-in-out ${
          drawerOpen ? 'ml-[300px]' : 'ml-0'
        }`}
      >
        <div className="px-6 py-8 text-white max-w-[900px] mx-auto">
          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-1.5">
                Player Ranker
              </h1>
              <p className="text-white/40 text-sm">
                Build a pool, then rank players head-to-head.
              </p>
            </div>
            {pool.length > 0 && (
              <span className="mt-1 px-3 py-1 rounded-full bg-white/[0.07] border border-white/[0.1] text-white/45 text-sm font-medium flex-shrink-0">
                {pool.length} player{pool.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* ── Local Draft Banner (refresh/crash recovery) ───────────────── */}
          {showLocalDraftBanner && hasLocalSession && localDraft && (
            <LocalDraftBanner
              draft={localDraft}
              onResume={handleResumeLocalDraft}
              onStartNew={handleClearAndStartNew}
              onClear={handleClearDraft}
              loading={loadingFirestore}
            />
          )}

          {/* ── Add to Pool ─────────────────────────────────────────────────── */}
          <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.07] mb-5">
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/35 block mb-4">
              Add to Pool
            </span>
            <div className="flex flex-col sm:flex-row gap-3">
              {/* By Team */}
              <div className="flex gap-2 flex-1 min-w-0">
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="flex-1 min-w-0 appearance-none bg-white/[0.05] text-white text-sm px-3 py-2 rounded-lg border border-white/[0.1] focus:outline-none focus:border-white/25 transition-all cursor-pointer"
                >
                  <option value="" className="bg-[#1a1a1a] text-white/50">
                    Team…
                  </option>
                  {TeamListFull.map((team) => (
                    <option
                      key={team.id}
                      value={team.id}
                      className="bg-[#1a1a1a] text-white"
                    >
                      {team.teamName}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddTeam}
                  disabled={!selectedTeamId}
                  className="px-3 py-2 text-sm rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all font-medium"
                >
                  Add
                </button>
              </div>

              {/* By List */}
              <div className="flex gap-2 flex-1 min-w-0">
                <select
                  value={selectedList}
                  onChange={(e) => setSelectedList(e.target.value)}
                  className="flex-1 min-w-0 appearance-none bg-white/[0.05] text-white text-sm px-3 py-2 rounded-lg border border-white/[0.1] focus:outline-none focus:border-white/25 transition-all cursor-pointer"
                >
                  <option value="" className="bg-[#1a1a1a] text-white/50">
                    List…
                  </option>
                  {lists.map((l) => (
                    <option
                      key={l.id}
                      value={l.id}
                      className="bg-[#1a1a1a] text-white"
                    >
                      {l.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddList}
                  disabled={!selectedList}
                  className="px-3 py-2 text-sm rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all font-medium"
                >
                  Import
                </button>
              </div>
            </div>
          </div>

          {/* ── Player Pool ─────────────────────────────────────────────────── */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/35">
                Pool
              </span>
              {pool.length > 0 && (
                <button
                  onClick={() => setPool([])}
                  className="text-xs text-white/25 hover:text-red-400 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {pool.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-white/[0.08]">
                <p className="text-white/20 text-sm mb-1">
                  No players in the pool
                </p>
                <p className="text-white/12 text-xs">
                  Add a team, import a list, or use the drawer on the left
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {pool.map((p) => (
                  <PoolCard key={p.id} player={p} onRemove={removePlayer} />
                ))}
              </div>
            )}
          </div>

          {/* ── CTA ─────────────────────────────────────────────────────────── */}
          <div className="flex flex-col items-center gap-2.5">
            <button
              onClick={handleStartNew}
              disabled={!canStart}
              className="px-10 py-3.5 rounded-xl bg-white text-black font-bold text-sm tracking-tight hover:bg-white/90 active:scale-[0.98] transition-all shadow-xl disabled:opacity-25 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              Start Ranking →
            </button>
            {!canStart && (
              <p className="text-white/20 text-xs">
                Add at least 2 players to begin
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

