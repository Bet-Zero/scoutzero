import React, { useState, useEffect, useCallback } from 'react';
import { useSimplePlayerData } from '@/shared/hooks/useSimplePlayerData';
import { RankingSession } from './RankingSession';
import { PoolWorkbench } from './PoolWorkbench';
import { PoolPanel } from './PoolPanel';
import { effectiveListSize } from './ListSizePicker';
import { PoolSourceMenus } from './PoolSourceMenus';
import { useRankerCandidates } from './hooks/useRankerCandidates';
import { useOwnerPlayerLists } from './hooks/useOwnerPlayerLists';
import { useRankerPool } from './hooks/useRankerPool';
import { LocalDraftBanner } from './LocalDraftBanner';
import { useRankerSession } from './hooks/useRankerSession';
import { storedRankerScore } from './hooks/useImpactScores';
import { poolBestFirst } from './utils/fieldBuilder';
import { resolveLinkedList } from './utils/saveAsListBridge';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';
import type { HydratedRankerDraft } from './hooks/useRankerSession';

// The pool column; on phones it sits below the results, so a bar jumps to it
const POOL_PANEL_ID = 'ranker-pool';

// ─── Main Component ───────────────────────────────────────────────────────────

export const RankingBuilder = () => {
  const { players: allPlayers, loading } = useSimplePlayerData();

  // Session hook - now local-first with optional Firestore for owners
  const {
    userId,
    isOwner,
    localDraft,
    hasLocalSession,
    loadingFirestore,
    firestoreSessions,
    error: sessionError,
    saveStatus,
    listSaveStatus,
    savedListMeta,
    createLocalDraft,
    updateLocalDraft,
    loadAndHydrateLocalDraft,
    deleteLocalDraft,
    markFinished,
    saveAdjustments,
    saveToFirestore,
    saveAsList,
    loadFromFirestore,
    fetchFirestoreSessions,
    deleteFirestoreSession,
  } = useRankerSession();

  // Owner-only: sessions saved to Firestore
  useEffect(() => {
    if (isOwner) void fetchFirestoreSessions();
  }, [isOwner, fetchFirestoreSessions]);

  const { processedPlayers, playersMap } = useRankerCandidates(allPlayers);
  const lists = useOwnerPlayerLists(userId);

  const {
    pool,
    poolIds,
    scores: pullScores,
    addPlayersToPool,
    addTeamToPool,
    addListToPool,
    removePlayer,
    clearPool,
    undoRemoval,
    lastRemoval,
    replacePool,
  } = useRankerPool(playersMap, lists);
  const [started, setStarted] = useState(false);
  // Top-N length for a new ranking (null ranks everyone); a Top-N pull pre-fills it
  const [listSize, setListSize] = useState<number | null>(null);
  // A new ranking's pool by stats, best first, fixed at Start
  const [poolOrder, setPoolOrder] = useState<string[] | null>(null);

  // Session persistence state - now local-first
  const [resumedSessionData, setResumedSessionData] =
    useState<HydratedRankerDraft | null>(null);
  const [showLocalDraftBanner, setShowLocalDraftBanner] = useState(true);
  const [resumeError, setResumeError] = useState<string | null>(null);

  // Open a hydrated draft (from this tab or from Firestore) as the session
  const startFromDraft = useCallback(
    (hydratedDraft: HydratedRankerDraft | null) => {
      if (!hydratedDraft) {
        setResumeError('This ranking could not be loaded.');
        return;
      }

      // Reconstruct pool from playerPoolIds using playersMap
      const resumedPool = hydratedDraft.playerPoolIds
        .map((id) => playersMap[id])
        .filter((player): player is RosterManagerPlayer => Boolean(player));

      if (resumedPool.length < 2) {
        setResumeError(
          'This ranking could not be loaded: fewer than 2 of its players are still available.'
        );
        return;
      }

      setResumeError(null);
      replacePool(resumedPool);
      setResumedSessionData(hydratedDraft);
      setStarted(true);
    },
    // replacePool only sets state
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playersMap]
  );

  const handleResumeLocalDraft = useCallback(() => {
    startFromDraft(loadAndHydrateLocalDraft());
  }, [loadAndHydrateLocalDraft, startFromDraft]);

  // Anything that replaces the tab's draft asks first
  const confirmReplaceDraft = useCallback(
    () =>
      !hasLocalSession ||
      !localDraft ||
      window.confirm(
        `This will replace your current ranking "${localDraft.name || 'Untitled'}" and its progress. Continue?`
      ),
    [hasLocalSession, localDraft]
  );

  const handleOpenSavedSession = useCallback(
    async (sessionId: string) => {
      if (!confirmReplaceDraft()) return;
      startFromDraft(await loadFromFirestore(sessionId));
    },
    [confirmReplaceDraft, loadFromFirestore, startFromDraft]
  );

  const handleDeleteSavedSession = useCallback(
    (sessionId: string) => {
      deleteFirestoreSession(sessionId).catch(() => {
        // Error is surfaced through the hook's error state
      });
    },
    [deleteFirestoreSession]
  );

  // Handle starting a new session (creates local draft, NO Firestore)
  const handleStartNew = useCallback(() => {
    if (pool.length < 2) return;
    if (!confirmReplaceDraft()) return;

    const playerPoolIds = pool.map((p) => p.id);
    const size = effectiveListSize(listSize, pool.length);
    // Scored for the season each player was pulled for; anyone added another
    // way uses the stored current-season score
    const byId = new Map(pool.map((p) => [p.id, p]));
    setPoolOrder(
      poolBestFirst(
        playerPoolIds,
        (id) => pullScores.get(id) ?? storedRankerScore(byId.get(id)) ?? -Infinity
      )
    );
    createLocalDraft({ playerPoolIds, name: size ? `My Top ${size}` : 'My Rankings' });
    setResumedSessionData(null);
    setStarted(true);
  }, [pool, listSize, pullScores, createLocalDraft, confirmReplaceDraft]);

  // Discard the tab's draft (the banner confirms first)
  const handleDiscardDraft = useCallback(() => {
    deleteLocalDraft();
    setShowLocalDraftBanner(false);
  }, [deleteLocalDraft]);

  // Leave the session; the draft stays available to resume from the banner
  const handleExitSession = useCallback(() => {
    setStarted(false);
    setResumedSessionData(null);
    setShowLocalDraftBanner(true);
    if (isOwner) void fetchFirestoreSessions();
  }, [isOwner, fetchFirestoreSessions]);

  // "Update List" and the saved list's name, also after a reload
  const linkedList = resolveLinkedList(savedListMeta, localDraft?.savedListId, lists);

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
        listSize={effectiveListSize(listSize, pool.length)}
        poolOrder={poolOrder}
        resumedSessionData={resumedSessionData}
        autosave={updateLocalDraft}
        saveAdjustments={saveAdjustments}
        markFinished={markFinished}
        onExit={handleExitSession}
        isOwner={isOwner}
        saveToFirestore={saveToFirestore}
        saveStatus={saveStatus}
        saveAsList={saveAsList}
        listSaveStatus={listSaveStatus}
        savedListMeta={linkedList}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 sm:px-5 pt-4 pb-5 text-white lg:flex-1 lg:min-h-0">
      {/* ── Title ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-xl font-bold tracking-tight">Player Ranker</h1>
        <p className="text-white/40 text-sm">
          Build a pool, then rank players head-to-head.
        </p>
      </div>

      {/* ── Local draft (refresh/crash recovery) ───────────────────────────── */}
      {showLocalDraftBanner && hasLocalSession && localDraft && (
        <LocalDraftBanner
          draft={localDraft}
          onResume={handleResumeLocalDraft}
          onDiscard={handleDiscardDraft}
          loading={loadingFirestore}
        />
      )}

      {(resumeError || sessionError) && (
        <p className="flex-shrink-0 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {resumeError || sessionError}
        </p>
      )}

      {/* ── Workbench: toolbar, then filters | results | pool ─────────────── */}
      <PoolWorkbench
        candidates={processedPlayers}
        poolIds={poolIds}
        onAdd={addPlayersToPool}
        onTopNChange={setListSize}
        menus={
          <PoolSourceMenus
            lists={lists}
            signedIn={Boolean(userId)}
            onAddTeam={addTeamToPool}
            onAddList={addListToPool}
            saved={
              isOwner
                ? {
                    sessions: firestoreSessions,
                    loading: loadingFirestore,
                    onOpen: handleOpenSavedSession,
                    onDelete: handleDeleteSavedSession,
                  }
                : undefined
            }
          />
        }
        pool={
          <PoolPanel
            id={POOL_PANEL_ID}
            pool={pool}
            onRemove={removePlayer}
            onClear={clearPool}
            onStart={handleStartNew}
            listSize={listSize}
            onListSizeChange={setListSize}
            lastRemoval={lastRemoval}
            onUndoRemoval={undoRemoval}
          />
        }
      />

      {/* Phones: the pool and Start Ranking are below the results */}
      {pool.length > 0 && (
        <div className="lg:hidden sticky bottom-0 z-20 -mx-4 sm:-mx-5 -mb-5 px-4 sm:px-5 py-3 flex items-center justify-between gap-3 bg-neutral-900/95 backdrop-blur border-t border-white/10">
          <p className="text-sm text-white/65">
            <span className="text-white font-semibold">{pool.length}</span>{' '}
            {pool.length === 1 ? 'player' : 'players'} in your pool
          </p>
          <button
            onClick={() =>
              document
                .getElementById(POOL_PANEL_ID)
                ?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
            }
            className="h-9 px-4 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90"
          >
            Review &amp; start ↓
          </button>
        </div>
      )}
    </div>
  );
};
