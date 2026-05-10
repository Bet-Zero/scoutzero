import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PlayerCompareCard } from './PlayerCompareCard';
import { RankingResults } from './RankingResults';
import { ComparisonMatrixDrawer } from './ComparisonMatrixDrawer';
import { RankingSetup } from './RankingSetup';
import { AnchorComparison } from './AnchorComparison';
import {
  generateRankingFromComparisons,
  suggestNextPair,
  estimateRemainingComparisons,
  buildAnchorComparisons,
  createClosureCache,
  type ClosureCache,
  type RankerComparison,
  type RankerPair,
  type RankerPlayer,
} from '@/features/ranker/utils/rankingEngine';
import type { HydratedRankerDraft } from './hooks/useRankerSession';
import type { RankerDraftPatch, RankerSetupData } from './utils/rankerLocalDraft';
import { Save, CheckCircle, AlertCircle } from 'lucide-react';

type RankingSessionPlayer = RankerPlayer & {
  original?: RankerPlayer;
};

type SaveStatus = 'saving' | 'saved' | 'error' | null;
type SavedListMeta = {
  listId: string;
  listName: string;
};
type RankingSessionProps = {
  playerPool?: RankingSessionPlayer[];
  resumedSessionData?: HydratedRankerDraft | null;
  autosave?: ((patch: RankerDraftPatch) => void) | null;
  saveNow?: ((patch: RankerDraftPatch) => void) | null;
  saveAdjustments?: ((ranking: RankerPlayer[]) => void) | null;
  markFinished?: (() => void) | null;
  isOwner?: boolean;
  saveToFirestore?: (() => void) | null;
  saveStatus?: SaveStatus;
  saveAsList?: ((ranking: RankerPlayer[]) => void | Promise<unknown>) | null;
  listSaveStatus?: SaveStatus;
  savedListMeta?: SavedListMeta | null;
};

export const RankingSession = ({
  playerPool = [],
  resumedSessionData = null,
  autosave = null,
  saveNow = null,
  saveAdjustments = null,
  markFinished = null,
  // P3: Owner-only Firestore save
  isOwner = false,
  saveToFirestore = null,
  saveStatus = null,
  saveAsList = null,
  listSaveStatus = null,
  savedListMeta = null,
}: RankingSessionProps) => {
  const players = useMemo<RankerPlayer[]>(
    () => playerPool.map((p) => p.original || p),
    [playerPool]
  );

  // Core state — initialized from resumed session or fresh
  const [currentPair, setCurrentPair] = useState<RankerPair>([]);
  const [results, setResults] = useState<RankerComparison[]>(
    () => resumedSessionData?.results || []
  );
  const [isFinished, setIsFinished] = useState(
    () => resumedSessionData?.isFinished || false
  );
  const [setupData, setSetupData] = useState<RankerSetupData | null>(
    () => resumedSessionData?.setupData || null
  );
  const [anchorDone, setAnchorDone] = useState(
    () => resumedSessionData?.anchorDone || false
  );
  const [skippedPairs, setSkippedPairs] = useState<Set<string>>(() => {
    const skipped = resumedSessionData?.skippedPairs;
    if (skipped instanceof Set) {
      return new Set(
        Array.from(skipped).filter((key): key is string => typeof key === 'string')
      );
    }
    return new Set();
  });
  const [adjustments, setAdjustments] = useState<string[] | null>(
    () => resumedSessionData?.adjustments || null
  );

  // Incremental closure cache — survives re-renders, rebuilt on undo or resume
  const closureCacheRef = useRef<ClosureCache>(createClosureCache());

  // Initialize closure cache on first render (or when resumedSessionData changes)
  useEffect(() => {
    if (resumedSessionData?.closureCache) {
      closureCacheRef.current = resumedSessionData.closureCache;
    } else if ((resumedSessionData?.results?.length ?? 0) > 0) {
      closureCacheRef.current = createClosureCache();
      closureCacheRef.current.rebuild(resumedSessionData?.results ?? []);
    } else {
      closureCacheRef.current = createClosureCache();
    }
  }, [resumedSessionData]);

  const groupedPlayers = useMemo(() => {
    if (!setupData || (setupData.anchor && !anchorDone)) return players;
    const { topTier = [], bottomTier = [], anchor } = setupData;
    const better = new Set<string>();
    if (anchor) {
      results.forEach(({ winner, loser }) => {
        if (loser === anchor) better.add(winner);
      });
    }
    return players.map((p) => {
      let group;
      if (p.id === anchor) group = 'anchor';
      else if (topTier.includes(p.id)) group = 'top';
      else if (bottomTier.includes(p.id)) group = 'bottom';
      else if (anchor) group = better.has(p.id) ? 'upper' : 'lower';
      else group = 'upper';
      return { ...p, group };
    });
  }, [players, setupData, results, anchorDone]);

  const remaining = useMemo(
    () => estimateRemainingComparisons(results, groupedPlayers),
    [results, groupedPlayers]
  );

  // Dynamic progress: always derived, handles undo correctly
  const comparisonsDone = results.length;
  const comparisonTotal = comparisonsDone + remaining;
  const progressPercent = comparisonTotal
    ? (comparisonsDone / comparisonTotal) * 100
    : 0;

  // Evaluate next pair every time results change
  useEffect(() => {
    if (!setupData) return;
    if (setupData.anchor && !anchorDone) return;
    if (groupedPlayers.length < 2) return;

    const next = suggestNextPair(results, groupedPlayers, {
      skippedPairs,
      closureCache: closureCacheRef.current,
    });
    if (next.length === 0 && !isFinished) {
      setIsFinished(true);
      setCurrentPair([]);
      // Autosave finished state
      if (markFinished) markFinished();
    } else if (next.length > 0) {
      setCurrentPair(next);
    }
  }, [
    results,
    groupedPlayers,
    setupData,
    anchorDone,
    isFinished,
    skippedPairs,
    markFinished,
  ]);

  const handleSelect = useCallback(
    (winner: RankerPlayer, loser: RankerPlayer) => {
      // Incrementally update closure cache with the new edge
      const added = closureCacheRef.current.addEdge(winner.id, loser.id);
      if (!added) {
        console.warn(
          '[RankingSession] Edge not added (cycle/duplicate/invalid)'
        );
        return;
      }
      const newResults = [...results, { winner: winner.id, loser: loser.id }];
      setResults(newResults);
      // Clear skipped pairs — new info may make previously skipped pairs relevant
      setSkippedPairs(new Set());
      // Autosave
      if (autosave) {
        autosave({ results: newResults, skippedPairs: new Set() });
      }
    },
    [results, autosave]
  );

  const handleSkip = useCallback(() => {
    const [first, second] = currentPair;
    if (!first || !second) return;
    const key =
      first.id < second.id
        ? `${first.id}<>${second.id}`
        : `${second.id}<>${first.id}`;
    const newSkipped = new Set(skippedPairs);
    newSkipped.add(key);

    const next = suggestNextPair(results, groupedPlayers, {
      skippedPairs: newSkipped,
      closureCache: closureCacheRef.current,
    });
    if (next.length === 0) {
      // All remaining pairs have been skipped — cycle back by clearing skips
      setSkippedPairs(new Set());
      const reset = suggestNextPair(results, groupedPlayers, {
        closureCache: closureCacheRef.current,
      });
      if (reset.length > 0) setCurrentPair(reset);
      // Autosave cleared skips
      if (autosave) autosave({ skippedPairs: new Set() });
    } else {
      setSkippedPairs(newSkipped);
      setCurrentPair(next);
      // Autosave new skipped pairs
      if (autosave) autosave({ skippedPairs: newSkipped });
    }
  }, [currentPair, skippedPairs, results, groupedPlayers, autosave]);

  const handleUndo = useCallback(() => {
    if (results.length === 0) return;
    const newResults = results.slice(0, -1);
    // Rebuild closure cache from scratch after undo (one edge removed = full rebuild needed)
    closureCacheRef.current.rebuild(newResults);
    setResults(newResults);
    setIsFinished(false);
    setSkippedPairs(new Set());
    // Autosave
    if (autosave) {
      autosave({
        results: newResults,
        isFinished: false,
        skippedPairs: new Set(),
      });
    }
  }, [results, autosave]);

  // Handler for saving adjustments from RankingResults
  const handleRankingAdjusted = useCallback(
    (adjustedRanking: RankerPlayer[]) => {
      // Extract IDs for storage
      const adjustedIds = adjustedRanking.map((p) => p.id);
      setAdjustments(adjustedIds);
      // Persist adjustments
      if (saveAdjustments) {
        saveAdjustments(adjustedRanking);
      }
    },
    [saveAdjustments]
  );

  if (isFinished) {
    // Generate ranking from comparisons
    let ranking = generateRankingFromComparisons(
      results,
      groupedPlayers,
      {
        topTier: setupData?.topTier ?? [],
        bottomTier: setupData?.bottomTier ?? [],
        anchor: setupData?.anchor ?? null,
      }
    );

    // If adjustments exist (persisted), use them as canonical ranking
    if (adjustments && Array.isArray(adjustments) && adjustments.length > 0) {
      // Reconstruct player objects from adjustment IDs
      const playerById: Record<string, RankerPlayer> = {};
      groupedPlayers.forEach((p) => {
        playerById[p.id] = p;
      });
      const adjustedRanking = adjustments
        .map((id) => playerById[id])
        .filter((player): player is RankerPlayer => Boolean(player));
      if (adjustedRanking.length > 0) {
        ranking = adjustedRanking;
      }
    }

    return (
      <>
        <RankingResults
          ranking={ranking}
          onRankingAdjusted={handleRankingAdjusted}
          isOwner={isOwner}
          onSaveAsList={saveAsList}
          saveAsListStatus={listSaveStatus}
          savedListMeta={savedListMeta}
        />

        {/* Owner-only: Save to Firestore button */}
        {isOwner && saveToFirestore && (
          <div className="flex justify-center mt-6 mb-4">
            <button
              onClick={saveToFirestore}
              disabled={saveStatus === 'saving'}
              className={`
                px-6 py-3 rounded-xl font-medium text-sm flex items-center gap-2 transition-all
                ${
                  saveStatus === 'saved'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : saveStatus === 'error'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {saveStatus === 'saving' ? (
                <>
                  <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                  Saving...
                </>
              ) : saveStatus === 'saved' ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Saved to Firestore
                </>
              ) : saveStatus === 'error' ? (
                <>
                  <AlertCircle className="w-4 h-4" />
                  Save Failed (Retry)
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save to Firestore
                </>
              )}
            </button>
          </div>
        )}

        <div className="text-white/30 mt-8 text-center text-sm italic px-4">
          Ranking created on{' '}
          {new Date().toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
        <ComparisonMatrixDrawer
          players={groupedPlayers}
          comparisons={results}
        />
      </>
    );
  }

  if (!setupData) {
    const handleComplete = (data: RankerSetupData) => {
      setSetupData(data);
      setAnchorDone(!data.anchor);

      const initial: RankerComparison[] = [];
      const firstPlaceId = data.firstPlace;
      if (firstPlaceId) {
        players.forEach((p) => {
          if (p.id !== firstPlaceId)
            initial.push({ winner: firstPlaceId, loser: p.id });
        });
      }
      const lastPlaceId = data.lastPlace;
      if (lastPlaceId) {
        players.forEach((p) => {
          if (p.id !== lastPlaceId)
            initial.push({ winner: p.id, loser: lastPlaceId });
        });
      }
      if (initial.length) {
        // Seed closure cache with lock-in comparisons
        initial.forEach(({ winner, loser }) =>
          closureCacheRef.current.addEdge(winner, loser)
        );
        setResults(initial);
      }

      // Autosave setup data and initial results
      if (autosave) {
        autosave({
          setupData: data,
          anchorDone: !data.anchor,
          results: initial.length ? initial : [],
        });
      }
    };

    return (
      <RankingSetup
        playerPool={players}
        onComplete={handleComplete}
        existingSetupData={resumedSessionData?.setupData || null}
      />
    );
  }

  if (setupData?.anchor && !anchorDone) {
    const anchorId = setupData.anchor;
    const anchorPlayer = players.find((p) => p.id === anchorId);
    const tagged = new Set<string>(
      [
        ...(setupData.topTier || []),
        ...(setupData.bottomTier || []),
        setupData.firstPlace,
        setupData.lastPlace,
      ].filter((id): id is string => typeof id === 'string' && id.length > 0)
    );
    const untagged = players.filter(
      (p) => p.id !== anchorId && !tagged.has(p.id)
    );
    const handleAnchorComplete = (betterIds: string[]) => {
      const newResults = buildAnchorComparisons(
        anchorId,
        untagged,
        betterIds
      );
      let allResults = results;
      if (newResults.length) {
        // Seed closure cache with anchor comparisons
        newResults.forEach(({ winner, loser }) =>
          closureCacheRef.current.addEdge(winner, loser)
        );
        allResults = [...results, ...newResults];
        setResults(allResults);
      }
      setAnchorDone(true);

      // Autosave anchor completion
      if (autosave) {
        autosave({ results: allResults, anchorDone: true });
      }
    };
    return (
      <AnchorComparison
        anchor={anchorPlayer}
        players={untagged}
        onComplete={handleAnchorComplete}
      />
    );
  }

  if (!currentPair.length) {
    return <div className="text-white">Loading...</div>;
  }

  const [leftPlayer, rightPlayer] = currentPair;
  if (!leftPlayer || !rightPlayer) {
    return <div className="text-white">Loading...</div>;
  }

  return (
    <>
      <div className="flex flex-col items-center pt-12">
        <PlayerCompareCard
          left={leftPlayer}
          right={rightPlayer}
          onSelect={handleSelect}
          onSkip={handleSkip}
          onUndo={handleUndo}
        />
        <div className="w-full max-w-xs mt-4">
          <div className="w-full bg-white/20 h-3 rounded-full">
            <div
              className="bg-green-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <div className="mt-2 text-white/60 text-sm">
          {comparisonsDone} / {comparisonTotal} comparisons
        </div>
      </div>
      <ComparisonMatrixDrawer players={groupedPlayers} comparisons={results} />
    </>
  );
};

