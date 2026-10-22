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
import { SaveSessionButton } from './SaveSessionButton';
import {
  assignRankerGroups,
  buildAnchorComparisons,
  buildLockInComparisons,
  createClosureCache,
  estimateRemainingComparisons,
  generateRankingFromComparisons,
  getSkipKey,
  suggestNextPair,
  type ClosureCache,
  type RankerComparison,
  type RankerPair,
  type RankerPlayer,
} from '@/features/ranker/utils/rankingEngine';
import {
  effectiveTopN,
  estimateTopNRemaining,
  manualCutIds,
  resolveTopN,
  suggestTopNPair,
} from '@/features/ranker/utils/topNSelection';
import { getPlayerName as getDisplayName } from './utils/playerDisplay';
import type { HydratedRankerDraft } from './hooks/useRankerSession';
import type { RankerDraftPatch, RankerSetupData } from './utils/rankerLocalDraft';

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
  saveAdjustments?: ((ranking: RankerPlayer[]) => void) | null;
  markFinished?: ((finishedAt: number) => void) | null;
  onExit?: (() => void) | null;
  isOwner?: boolean;
  saveToFirestore?: (() => void) | null;
  saveStatus?: SaveStatus;
  saveAsList?: ((ranking: RankerPlayer[]) => void | Promise<unknown>) | null;
  listSaveStatus?: SaveStatus;
  savedListMeta?: SavedListMeta | null;
};

const createInitialClosureCache = (
  resumed: HydratedRankerDraft | null
): ClosureCache => {
  if (resumed?.closureCache) return resumed.closureCache;
  const cache = createClosureCache();
  if (resumed?.results?.length) cache.rebuild(resumed.results);
  return cache;
};

export const RankingSession = ({
  playerPool = [],
  resumedSessionData = null,
  autosave = null,
  saveAdjustments = null,
  markFinished = null,
  onExit = null,
  // Owner-only Firestore save
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
  // Leading results that came from setup (lock-ins / anchor), not picks
  const [seedCount, setSeedCount] = useState(
    () => resumedSessionData?.seedCount ?? 0
  );
  const [isFinished, setIsFinished] = useState(
    () => resumedSessionData?.isFinished || false
  );
  const [finishedAt, setFinishedAt] = useState<number | null>(
    () => resumedSessionData?.finishedAt ?? null
  );
  const [setupData, setSetupData] = useState<RankerSetupData | null>(
    () => resumedSessionData?.setupData || null
  );
  const [anchorDone, setAnchorDone] = useState(
    () => resumedSessionData?.anchorDone || false
  );
  const [skippedPairs, setSkippedPairs] = useState<Set<string>>(() => {
    const skipped = resumedSessionData?.skippedPairs;
    return new Set(skipped instanceof Set ? skipped : []);
  });
  const [adjustments, setAdjustments] = useState<string[] | null>(
    () => resumedSessionData?.adjustments || null
  );

  // Incremental closure cache — lives for the session, rebuilt on undo
  const closureCacheRef = useRef<ClosureCache | null>(null);
  if (!closureCacheRef.current) {
    closureCacheRef.current = createInitialClosureCache(resumedSessionData);
  }
  const closureCache = closureCacheRef.current;

  const groupedPlayers = useMemo(() => {
    if (!setupData || (setupData.anchor && !anchorDone)) return players;
    return assignRankerGroups(players, results, setupData);
  }, [players, setupData, results, anchorDone]);

  // Top-N mode: only the best N are found and ordered
  const topN = effectiveTopN(setupData?.topN, players.length);
  const cuts = useMemo(() => (topN === null ? [] : setupData?.cuts ?? []), [topN, setupData]);
  const cutIds = useMemo(() => manualCutIds(cuts), [cuts]);
  const topNResolution = useMemo(
    () =>
      topN === null
        ? null
        : resolveTopN(groupedPlayers, topN, closureCache.closure, new Set(), cutIds),
    // results drive the closure cache's contents
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topN, groupedPlayers, closureCache, results, cutIds]
  );

  // Comparisons involving players no longer in the pool (e.g. removed from
  // the database since the session was saved) are left out of the matrix
  const matrixResults = useMemo(() => {
    const ids = new Set(players.map((p) => p.id));
    return results.filter((c) => ids.has(c.winner) && ids.has(c.loser));
  }, [players, results]);

  const remaining = useMemo(
    () =>
      topN !== null && topNResolution
        ? estimateTopNRemaining(topNResolution, topN)
        : estimateRemainingComparisons(results, groupedPlayers, { closureCache }),
    [results, groupedPlayers, closureCache, topN, topNResolution]
  );
  const picksDone = Math.max(0, results.length - seedCount);
  const progressPercent =
    picksDone + remaining > 0 ? (picksDone / (picksDone + remaining)) * 100 : 0;

  // Evaluate next pair every time results change
  useEffect(() => {
    if (!setupData) return;
    if (setupData.anchor && !anchorDone) return;
    if (groupedPlayers.length < 2) return;

    const next =
      topN !== null
        ? suggestTopNPair(groupedPlayers, topN, closureCache.closure, skippedPairs, cutIds)
        : suggestNextPair(results, groupedPlayers, {
            skippedPairs,
            closureCache,
          });
    if (next.length === 0 && !isFinished) {
      const now = Date.now();
      setIsFinished(true);
      setFinishedAt(now);
      setCurrentPair([]);
      if (markFinished) markFinished(now);
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
    closureCache,
    topN,
    cutIds,
  ]);

  const handleSelect = useCallback(
    (winner: RankerPlayer, loser: RankerPlayer) => {
      // Incrementally update closure cache with the new edge
      const added = closureCache.addEdge(winner.id, loser.id);
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
      if (autosave) {
        autosave({ results: newResults, skippedPairs: new Set() });
      }
    },
    [results, autosave, closureCache]
  );

  const handleSkip = useCallback(() => {
    const [first, second] = currentPair;
    if (!first || !second) return;
    const newSkipped = new Set(skippedPairs);
    newSkipped.add(getSkipKey(first.id, second.id));
    // The next-pair effect picks a new matchup (or re-offers this one if only
    // skipped matchups remain)
    setSkippedPairs(newSkipped);
    if (autosave) autosave({ skippedPairs: newSkipped });
  }, [currentPair, skippedPairs, autosave]);

  // Players still in the running; a cut may never leave fewer than N
  const stillIn = topNResolution ? players.length - topNResolution.cut.length : players.length;
  const canCut = (count: number) => topN !== null && stillIn - count >= topN;

  // Top-N mode: rule players out by hand (undoable, newest first)
  const handleCut = useCallback(
    (ids: string[]) => {
      if (!setupData || ids.length === 0 || topN === null || stillIn - ids.length < topN) return;
      const nextSetup = { ...setupData, cuts: [...cuts, { ids, at: results.length }] };
      setSetupData(nextSetup);
      setSkippedPairs(new Set());
      if (autosave) autosave({ setupData: nextSetup, skippedPairs: new Set() });
    },
    [setupData, topN, cuts, results.length, autosave, stillIn]
  );

  const lastCut = cuts.length ? cuts[cuts.length - 1] : null;
  // A cut made after the latest pick is undone before that pick
  const undoesCut = Boolean(lastCut && lastCut.at >= 0 && lastCut.at === results.length);
  const canUndo = results.length > seedCount || undoesCut;

  const handleUndo = useCallback(() => {
    if (undoesCut && setupData) {
      const nextSetup = { ...setupData, cuts: cuts.slice(0, -1) };
      setSetupData(nextSetup);
      setIsFinished(false);
      setSkippedPairs(new Set());
      if (autosave) {
        autosave({ setupData: nextSetup, isFinished: false, skippedPairs: new Set() });
      }
      return;
    }
    // Only head-to-head picks can be undone, never the setup seeds
    if (results.length <= seedCount) return;
    const newResults = results.slice(0, -1);
    // Rebuild closure cache from scratch after undo (one edge removed = full rebuild needed)
    closureCache.rebuild(newResults);
    setResults(newResults);
    setIsFinished(false);
    setSkippedPairs(new Set());
    if (autosave) {
      autosave({
        results: newResults,
        isFinished: false,
        skippedPairs: new Set(),
      });
    }
  }, [results, seedCount, autosave, closureCache, undoesCut, setupData, cuts]);

  // Handler for saving adjustments from RankingResults
  const handleRankingAdjusted = useCallback(
    (adjustedRanking: RankerPlayer[]) => {
      setAdjustments(adjustedRanking.map((p) => p.id));
      if (saveAdjustments) {
        saveAdjustments(adjustedRanking);
      }
    },
    [saveAdjustments]
  );

  // Top-N mode: players who can't make the list, best-known first
  const cutPlayers = useMemo(() => {
    if (!isFinished || !topNResolution) return [];
    const above = new Map<string, number>();
    topNResolution.cut.forEach((p) => {
      above.set(
        p.id,
        players.filter((q) => closureCache.closure[q.id]?.has(p.id)).length
      );
    });
    const byId = new Map(players.map((p) => [p.id, p]));
    // Cut by the matchups (closest to making it first), then cut by hand
    return [...topNResolution.cut]
      .sort(
        (a, b) =>
          Number(cutIds.has(a.id)) - Number(cutIds.has(b.id)) ||
          (above.get(a.id) ?? 0) - (above.get(b.id) ?? 0)
      )
      .map((p) => byId.get(p.id) ?? p);
  }, [isFinished, topNResolution, players, closureCache, cutIds]);

  const ranking = useMemo(() => {
    if (!isFinished) return [];
    const byId = new Map(players.map((p) => [p.id, p]));
    const generated = topNResolution
      ? topNResolution.ranked.map((p) => byId.get(p.id) ?? p)
      : generateRankingFromComparisons(results, players, setupData ?? {});
    if (!adjustments?.length) return generated;

    // Persisted manual adjustments are the canonical order
    const playerById = new Map(players.map((p) => [p.id, p]));
    const adjusted = adjustments
      .map((id) => playerById.get(id))
      .filter((player): player is RankerPlayer => Boolean(player));
    if (adjusted.length === 0) return generated;
    const adjustedIds = new Set(adjusted.map((p) => p.id));
    const generatedIds = new Set(generated.map((p) => p.id));
    // In Top-N mode only the listed players can be adjusted
    return [
      ...adjusted.filter((p) => !topNResolution || generatedIds.has(p.id)),
      ...generated.filter((p) => !adjustedIds.has(p.id)),
    ];
  }, [isFinished, results, players, setupData, adjustments, topNResolution]);

  const exitBar = onExit ? (
    <div className="max-w-5xl mx-auto px-4 pt-4">
      <button
        onClick={onExit}
        className="text-sm text-white/50 hover:text-white transition-colors"
      >
        ← Back to pool
      </button>
    </div>
  ) : null;

  if (isFinished) {
    return (
      <>
        {exitBar}
        {/* The last pick or cut finishes the session; it can still be taken back */}
        {canUndo && (
          <div className="max-w-5xl mx-auto px-4 pt-2">
            <button
              onClick={handleUndo}
              className="text-sm text-white/50 hover:text-white transition-colors"
            >
              ↶ Undo last step
            </button>
          </div>
        )}
        <RankingResults
          ranking={ranking}
          topN={topN}
          cutPlayers={cutPlayers}
          onRankingAdjusted={handleRankingAdjusted}
          isOwner={isOwner}
          onSaveAsList={saveAsList}
          saveAsListStatus={listSaveStatus}
          savedListMeta={savedListMeta}
        />

        {isOwner && saveToFirestore && (
          <SaveSessionButton onSave={saveToFirestore} saveStatus={saveStatus} />
        )}

        {finishedAt && (
          <div className="text-white/30 mt-8 text-center text-sm italic px-4">
            Ranking completed on{' '}
            {new Date(finishedAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        )}
        <ComparisonMatrixDrawer
          players={groupedPlayers}
          comparisons={matrixResults}
        />
      </>
    );
  }

  if (!setupData) {
    const handleComplete = (data: RankerSetupData) => {
      // Lock-ins become seed comparisons; only ones the engine accepts are kept
      const seeds = buildLockInComparisons(players, data).filter(
        ({ winner, loser }) => closureCache.addEdge(winner, loser)
      );
      setSetupData(data);
      setAnchorDone(!data.anchor);
      setResults(seeds);
      setSeedCount(seeds.length);

      if (autosave) {
        autosave({
          setupData: data,
          anchorDone: !data.anchor,
          results: seeds,
          seedCount: seeds.length,
        });
      }
    };

    return (
      <>
        {exitBar}
        <RankingSetup playerPool={players} onComplete={handleComplete} />
      </>
    );
  }

  if (setupData.anchor && !anchorDone) {
    const anchorId = setupData.anchor;
    const anchorPlayer = players.find((p) => p.id === anchorId);
    const tagged = new Set<string>(
      [
        ...(setupData.topTier || []),
        ...(setupData.bottomTier || []),
        setupData.firstPlace,
        setupData.lastPlace,
        ...cutIds,
      ].filter((id): id is string => typeof id === 'string' && id.length > 0)
    );
    const untagged = players.filter(
      (p) => p.id !== anchorId && !tagged.has(p.id)
    );
    const handleAnchorComplete = (betterIds: string[]) => {
      const accepted = anchorPlayer
        ? buildAnchorComparisons(anchorId, untagged, betterIds).filter(
            ({ winner, loser }) => closureCache.addEdge(winner, loser)
          )
        : [];
      const allResults = [...results, ...accepted];
      setResults(allResults);
      setSeedCount(allResults.length);
      setAnchorDone(true);

      if (autosave) {
        autosave({
          results: allResults,
          anchorDone: true,
          seedCount: allResults.length,
        });
      }
    };

    return (
      <>
        {exitBar}
        {anchorPlayer ? (
          <AnchorComparison
            anchor={anchorPlayer}
            players={untagged}
            onComplete={handleAnchorComplete}
          />
        ) : (
          <div className="text-white text-center p-8">
            <p className="mb-4 text-white/70">
              The anchor player is no longer available.
            </p>
            <button
              onClick={() => handleAnchorComplete([])}
              className="px-4 py-2 rounded bg-green-600 hover:bg-green-700"
            >
              Continue without an anchor
            </button>
          </div>
        )}
      </>
    );
  }

  const [leftPlayer, rightPlayer] = currentPair;
  if (!leftPlayer || !rightPlayer) {
    return <div className="text-white">Loading...</div>;
  }

  return (
    <>
      {exitBar}
      <div className="flex flex-col items-center pt-12">
        <PlayerCompareCard
          left={leftPlayer}
          right={rightPlayer}
          onSelect={handleSelect}
          onSkip={handleSkip}
          onUndo={canUndo ? handleUndo : undefined}
        />
        {topN !== null && (
          <div className="flex flex-wrap justify-center gap-2 mt-4 text-xs">
            <button
              onClick={() => handleCut([leftPlayer.id])}
              disabled={!canCut(1)}
              className="px-3 py-1.5 rounded-lg border border-white/15 text-white/60 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Cut {getDisplayName(leftPlayer)}
            </button>
            <button
              onClick={() => handleCut([leftPlayer.id, rightPlayer.id])}
              disabled={!canCut(2)}
              className="px-3 py-1.5 rounded-lg border border-red-400/30 text-red-200/80 hover:text-red-100 hover:border-red-400/60 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Neither makes my Top {topN}
            </button>
            <button
              onClick={() => handleCut([rightPlayer.id])}
              disabled={!canCut(1)}
              className="px-3 py-1.5 rounded-lg border border-white/15 text-white/60 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Cut {getDisplayName(rightPlayer)}
            </button>
          </div>
        )}
        <div className="w-full max-w-xs mt-4">
          <div className="w-full bg-white/20 h-3 rounded-full">
            <div
              className="bg-green-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <div className="mt-2 text-white/60 text-sm">
          {picksDone} done · about {remaining} left
        </div>
      </div>
      <ComparisonMatrixDrawer
        players={groupedPlayers}
        comparisons={matrixResults}
      />
    </>
  );
};
