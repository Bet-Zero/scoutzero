import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSimplePlayerData } from '@/shared/hooks/useSimplePlayerData';
import { useFirebaseQuery } from '@/shared/hooks/useFirebaseQuery';
import { where } from 'firebase/firestore';
import { LISTS_COLLECTION } from '@/constants/collections';
import { POSITION_MAP } from '@/shared/utils/roles';
import { TeamListFull } from '@/constants/teamList';
import { DrawerShell } from '@/shared/components/ui/drawers/DrawerShell';
import { OpenDrawerButton } from '@/shared/components/ui/drawers/OpenDrawerButton';
import { AddPlayerDrawer } from '@/features/roster/AddPlayerDrawer';
import { RankingSession } from './RankingSession';
import { PoolCard } from './PoolCard';
import { LocalDraftBanner } from './LocalDraftBanner';
import { SavedSessionsPanel } from './SavedSessionsPanel';
import { useRankerSession } from './hooks/useRankerSession';
import type { PlayerList } from '@/firebase/listHelpers';
import type { RosterDrawerPlayer } from '@/features/roster/utils';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';
import type { HydratedRankerDraft } from './hooks/useRankerSession';

type RankerPoolPlayer = RosterManagerPlayer;

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

  // Lists query (owner-scoped; skipped while signed out)
  const ownerConstraints = useMemo(
    () => (userId ? [where('ownerUid', '==', userId)] : []),
    [userId]
  );
  const { data: listsData } = useFirebaseQuery<PlayerList>(
    LISTS_COLLECTION,
    ownerConstraints,
    { enabled: Boolean(userId) }
  );

  // Owner-only: sessions saved to Firestore
  useEffect(() => {
    if (isOwner) void fetchFirestoreSessions();
  }, [isOwner, fetchFirestoreSessions]);

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

