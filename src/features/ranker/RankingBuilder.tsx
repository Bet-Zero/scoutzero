import React, { useState, useEffect, useCallback } from 'react';
import { useSimplePlayerData } from '@/shared/hooks/useSimplePlayerData';
import { DrawerShell } from '@/shared/components/ui/drawers/DrawerShell';
import { OpenDrawerButton } from '@/shared/components/ui/drawers/OpenDrawerButton';
import { AddPlayerDrawer } from '@/features/roster/AddPlayerDrawer';
import { RankingSession } from './RankingSession';
import { PoolSourceControls } from './PoolSourceControls';
import { PoolGrid } from './PoolGrid';
import { FilterPoolPanel } from './FilterPoolPanel';
import { useRankerCandidates } from './hooks/useRankerCandidates';
import { useOwnerPlayerLists } from './hooks/useOwnerPlayerLists';
import { useRankerPool } from './hooks/useRankerPool';
import { LocalDraftBanner } from './LocalDraftBanner';
import { SavedSessionsPanel } from './SavedSessionsPanel';
import { useRankerSession } from './hooks/useRankerSession';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';
import type { HydratedRankerDraft } from './hooks/useRankerSession';

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
    setPool,
    poolIds,
    addPlayerToPool,
    addPlayersToPool,
    addTeamToPool,
    addListToPool,
    removePlayer,
  } = useRankerPool(playersMap, lists);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [started, setStarted] = useState(false);

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
      setPool(resumedPool);
      setResumedSessionData(hydratedDraft);
      setStarted(true);
    },
    [playersMap, setPool]
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
    createLocalDraft({ playerPoolIds });
    setResumedSessionData(null);
    setStarted(true);
  }, [pool, createLocalDraft, confirmReplaceDraft]);

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
        saveAdjustments={saveAdjustments}
        markFinished={markFinished}
        onExit={handleExitSession}
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
              onDiscard={handleDiscardDraft}
              loading={loadingFirestore}
            />
          )}

          {(resumeError || sessionError) && (
            <p className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
              {resumeError || sessionError}
            </p>
          )}

          {isOwner && (
            <SavedSessionsPanel
              sessions={firestoreSessions}
              loading={loadingFirestore}
              onOpen={handleOpenSavedSession}
              onDelete={handleDeleteSavedSession}
            />
          )}

          {/* ── Add to Pool ─────────────────────────────────────────────────── */}
          <PoolSourceControls
            lists={lists}
            onAddTeam={addTeamToPool}
            onAddList={addListToPool}
          />

          <FilterPoolPanel
            candidates={processedPlayers}
            poolIds={poolIds}
            onAdd={addPlayersToPool}
          />

          {/* ── Player Pool ─────────────────────────────────────────────────── */}
          <PoolGrid
            pool={pool}
            onRemove={removePlayer}
            onClear={() => setPool([])}
          />

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

