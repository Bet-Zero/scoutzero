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
  type RankerGraph,
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
import { getPlayerName as getDisplayName } from '@/features/ranker/utils/playerDisplay';
import {
  createFieldState,
  poolBestFirst,
  isLegacyField,
  normalizeField,
  undoFloor,
  type FieldAnswer,
  type FieldState,
  type StoredFieldState,
} from './utils/fieldBuilder';
import { storedRankerScore } from './hooks/useImpactScores';
import { FieldBuilder } from './FieldBuilder';
import type { HydratedRankerDraft } from './hooks/useRankerSession';
import type {
  RankerDraftPatch,
  RankerSessionStep,
  RankerSetupData,
} from './utils/rankerLocalDraft';

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
  // New sessions: the list size picked with the pool (a Top-N list builds its field first)
  listSize?: number | null;
  // New sessions: pool ids by stats for the pulled season, best first (orders the field)
  poolOrder?: string[] | null;
};

type RankingHints = Pick<
  RankerSetupData,
  'topTier' | 'bottomTier' | 'anchor' | 'firstPlace' | 'lastPlace'
>;

const withoutSteps = (
  data: RankerSetupData | null
): RankerSessionStep['setupData'] => {
  if (!data) return null;
  const rest = { ...data };
  delete rest.steps;
  return rest;
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
  listSize = null,
  poolOrder = null,
}: RankingSessionProps) => {
  const poolPlayers = useMemo<RankerPlayer[]>(
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
  const [setupData, setSetupData] = useState<RankerSetupData | null>(() => {
    if (resumedSessionData) return resumedSessionData.setupData || null;
    // A list shorter than the pool builds its field first
    // A one-player list has nothing to rank, so a field needs 2 or more
    return listSize && listSize >= 2 && listSize < poolPlayers.length
      ? { field: createFieldState(listSize, poolOrder ?? undefined) }
      : null;
  });
  // As saved; a field from before 2026-10-31 may be in the old cut-line rounds
  const savedField = (setupData?.field as StoredFieldState | undefined) ?? null;
  const steps = useMemo(
    () => (setupData?.steps as RankerSessionStep[] | undefined) ?? [],
    [setupData]
  );
  // Ranking hints are set (older sessions have no field step)
  const configured = Boolean(setupData) && (!savedField || setupData?.configured === true);
  // Once the field is settled, only its players are ranked
  const players = useMemo<RankerPlayer[]>(() => {
    if (!savedField?.fieldIds) return poolPlayers;
    const inField = new Set(savedField.fieldIds);
    return poolPlayers.filter((p) => inField.has(p.id));
  }, [poolPlayers, savedField]);
  const playersById = useMemo(() => new Map(poolPlayers.map((p) => [p.id, p])), [poolPlayers]);
  // Pool by stats, best first: the order saved when the list was started
  // (older sessions: the stored current-season score); pool order breaks ties
  const savedOrder = savedField?.order;
  const bestFirst = useMemo(
    () =>
      poolBestFirst(
        poolPlayers.map((p) => p.id),
        (id) => storedRankerScore(playersById.get(id)) ?? -Infinity,
        savedOrder
      ),
    [poolPlayers, playersById, savedOrder]
  );
  // The field in today's shape (an old cut-line field moves on to setting the line)
  const field = useMemo(
    () => (savedField ? normalizeField(savedField, bestFirst, results.length) : null),
    [savedField, bestFirst, results.length]
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
  // Choices to show again after undo returns to the setup or anchor screen
  const [setupPrefill, setSetupPrefill] = useState<RankingHints | null>(null);
  const [anchorPrefill, setAnchorPrefill] = useState<string[] | null>(null);

  // Save a field created for a new session
  const savedInitialField = useRef(false);
  // Save an old cut-line field moved on to the new steps, so its step start
  // (and undo floor) stay put from here
  useEffect(() => {
    if (!savedField || !field || !isLegacyField(savedField)) return;
    const nextSetup = { ...(setupData ?? {}), field };
    setSetupData(nextSetup);
    if (autosave) autosave({ setupData: nextSetup });
  }, [savedField, field, setupData, autosave]);
  useEffect(() => {
    if (savedInitialField.current || resumedSessionData || !field || !autosave) return;
    savedInitialField.current = true;
    autosave({ setupData });
  }, [resumedSessionData, field, autosave, setupData]);

  // Incremental closure cache — lives for the session, rebuilt on undo
  const closureCacheRef = useRef<ClosureCache | null>(null);
  if (!closureCacheRef.current) {
    closureCacheRef.current = createInitialClosureCache(resumedSessionData);
  }
  const closureCache = closureCacheRef.current;

  // Top-N field: setup hints and the anchor are for the locks only. The
  // players who won the open spots are already ranked from building the
  // field, so they stay a section of their own below the locks; the ranking
  // checks the boundary (worst lock vs best of them) and merges from there.
  const fieldBubble = useMemo(() => {
    if (!field?.fieldIds) return [];
    const locks = new Set(field.locks);
    return field.fieldIds.filter((id) => !locks.has(id));
  }, [field]);
  const setupPlayers = useMemo(() => {
    if (!field?.fieldIds) return players;
    const locks = new Set(field.locks);
    return players.filter((p) => locks.has(p.id));
  }, [players, field]);
  const rankOptions = useMemo(
    () => ({ ...(setupData ?? {}), bubble: fieldBubble }),
    [setupData, fieldBubble]
  );
  const groupedPlayers = useMemo(() => {
    if (!setupData || (setupData.anchor && !anchorDone)) return players;
    return assignRankerGroups(players, results, rankOptions);
  }, [players, setupData, rankOptions, results, anchorDone]);

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
    if (!setupData || !configured) return;
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
    configured,
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
  const onAnchorStep = configured && Boolean(setupData?.anchor) && !anchorDone;
  // Answers below this belong to earlier steps; undo reaches them by first
  // taking back the step buttons pressed since (see `steps`)
  const undoMin = (() => {
    if (configured && !onAnchorStep) return seedCount;
    if (!configured && field && field.stage !== 'done') {
      const floor = undoFloor(field);
      return Number.isFinite(floor) ? floor : results.length;
    }
    // The setup and anchor screens have no answers of their own
    return results.length;
  })();
  const canUndoAnswer = results.length > undoMin;
  const canUndo = canUndoAnswer || undoesCut || steps.length > 0;

  // The state just before a step button is pressed, so undo can return to it
  const stepFrom = (): RankerSessionStep => ({
    setupData: withoutSteps(setupData),
    results: results.length,
    seedCount,
    anchorDone,
  });

  const handleUndo = useCallback(() => {
    if (undoesCut && setupData) {
      const nextSetup = { ...setupData, cuts: cuts.slice(0, -1) };
      setSetupData(nextSetup);
      setIsFinished(false);
      setSkippedPairs(new Set());
      setAdjustments(null);
      if (autosave) {
        autosave({
          setupData: nextSetup,
          isFinished: false,
          skippedPairs: new Set(),
          adjustments: null,
        });
      }
      return;
    }
    if (results.length > undoMin) {
      const newResults = results.slice(0, -1);
      // Rebuild closure cache from scratch after undo (one edge removed = full rebuild needed)
      closureCache.rebuild(newResults);
      setResults(newResults);
      setIsFinished(false);
      setSkippedPairs(new Set());
      // A hand-adjusted order no longer matches once the results change
      setAdjustments(null);
      if (autosave) {
        autosave({
          results: newResults,
          isFinished: false,
          skippedPairs: new Set(),
          adjustments: null,
        });
      }
      return;
    }

    // No answers left in this step: take back the last step button
    const last = steps[steps.length - 1];
    if (!last) return;
    const removed = results.slice(last.results);
    const newResults = results.slice(0, last.results);
    // Going back to the setup or anchor screen shows the earlier choices again
    if (setupData && 'topTier' in setupData) {
      const { topTier, bottomTier, anchor, firstPlace, lastPlace } = setupData;
      setSetupPrefill({ topTier, bottomTier, anchor, firstPlace, lastPlace });
    }
    const anchorId = setupData?.anchor;
    if (anchorId && anchorDone && !last.anchorDone) {
      setAnchorPrefill(removed.filter((c) => c.loser === anchorId).map((c) => c.winner));
    }
    const restored: RankerSetupData | null = last.setupData
      ? { ...last.setupData, ...(steps.length > 1 ? { steps: steps.slice(0, -1) } : {}) }
      : null;
    if (removed.length) closureCache.rebuild(newResults);
    setSetupData(restored);
    setResults(newResults);
    setSeedCount(last.seedCount);
    setAnchorDone(last.anchorDone);
    setIsFinished(false);
    setCurrentPair([]);
    setSkippedPairs(new Set());
    setAdjustments(null);
    if (autosave) {
      autosave({
        setupData: restored,
        results: newResults,
        seedCount: last.seedCount,
        anchorDone: last.anchorDone,
        isFinished: false,
        skippedPairs: new Set(),
        adjustments: null,
      });
    }
  }, [results, undoMin, autosave, closureCache, undoesCut, setupData, cuts, steps, anchorDone]);

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

  // Field mode: players cut while building the field, closest to making it
  // first (fewest players known to be better), then by stats
  const fieldCutPlayers = useMemo(() => {
    if (!field || !isFinished) return [];
    const statsAt = new Map(bestFirst.map((id, i) => [id, i]));
    const above = (id: string) =>
      poolPlayers.filter((q) => closureCache.closure[q.id]?.has(id)).length;
    return field.cutIds
      .map((id) => playersById.get(id))
      .filter((p): p is RankerPlayer => Boolean(p))
      .map((p) => ({ p, above: above(p.id), at: statsAt.get(p.id) ?? Infinity }))
      .sort((a, b) => a.above - b.above || a.at - b.at)
      .map(({ p }) => p);
    // results drive the closure cache's contents
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field, isFinished, playersById, bestFirst, poolPlayers, closureCache, results]);

  // Lock-ins answers already rule out (building a Top-N field): anyone known
  // to be worse than another player here can't be #1, anyone known to be
  // better can't be last. Only the setup screen needs it.
  const lockInConflicts = useMemo(() => {
    const notFirst = new Set<string>();
    const notLast = new Set<string>();
    if (configured) return { notFirst, notLast };
    const here = new Set(players.map((p) => p.id));
    players.forEach((p) => {
      closureCache.closure[p.id]?.forEach((loser) => {
        if (loser === p.id || !here.has(loser)) return;
        notFirst.add(loser);
        notLast.add(p.id);
      });
    });
    return { notFirst, notLast };
    // results drive the closure cache's contents
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, players, closureCache, results]);

  const ranking = useMemo(() => {
    if (!isFinished) return [];
    const byId = new Map(players.map((p) => [p.id, p]));
    const generated = topNResolution
      ? topNResolution.ranked.map((p) => byId.get(p.id) ?? p)
      : generateRankingFromComparisons(results, players, rankOptions);
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

  // Owners can save an unfinished ranking too (the finished screen has its own button)
  const saveInProgress = isOwner && saveToFirestore && !isFinished;
  const exitBar =
    onExit || saveInProgress ? (
      <div className="max-w-5xl mx-auto px-4 pt-4 flex items-center justify-between gap-3">
        {onExit ? (
          <button
            onClick={onExit}
            className="text-sm text-white/50 hover:text-white transition-colors"
          >
            ← Back to pool
          </button>
        ) : (
          <span />
        )}
        {saveInProgress && (
          <SaveSessionButton onSave={saveToFirestore} saveStatus={saveStatus} compact />
        )}
      </div>
    ) : null;
  const undoLabel = canUndoAnswer ? 'Undo last answer' : 'Go back a step';

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
          topN={field ? field.topN : topN}
          cutPlayers={field ? fieldCutPlayers : cutPlayers}
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

  if (field && field.stage !== 'done') {
    const handleFieldChange = (next: FieldState) => {
      // Moving to another step is recorded so undo can take it back; locks
      // and cut-line choices are changed back by hand
      const isStep =
        next.stage !== 'locks' &&
        (next.stage !== field.stage || next.round !== field.round);
      const nextSetup = {
        ...(setupData ?? {}),
        field: next,
        ...(isStep ? { steps: [...steps, stepFrom()] } : {}),
      };
      setSetupData(nextSetup);
      if (autosave) autosave({ setupData: nextSetup });
    };
    // A screen of answers (the selection) is one step: one undo takes all of
    // them back. An answer that clashes with earlier ones is already settled
    // the other way by them, so it's skipped.
    const handleFieldAnswers = (
      answers: FieldAnswer[],
      next: (closure: RankerGraph, comparisonCount: number) => FieldState
    ) => {
      const accepted = answers.filter(
        ({ winner, loser }) =>
          !closureCache.closure[loser]?.has(winner) &&
          !closureCache.closure[winner]?.has(loser) &&
          closureCache.addEdge(winner, loser)
      );
      const newResults = [...results, ...accepted];
      const nextSetup = {
        ...(setupData ?? {}),
        field: next(closureCache.closure, newResults.length),
        steps: [...steps, stepFrom()],
      };
      setSetupData(nextSetup);
      setResults(newResults);
      setSkippedPairs(new Set());
      if (autosave)
        autosave({ setupData: nextSetup, results: newResults, skippedPairs: new Set() });
    };
    return (
      <>
        {exitBar}
        <FieldBuilder
          playersById={playersById}
          bestFirst={bestFirst}
          state={field}
          closure={closureCache.closure}
          comparisonCount={results.length}
          onChange={handleFieldChange}
          onAnswer={handleSelect}
          onAnswers={handleFieldAnswers}
          onUndo={canUndo ? handleUndo : undefined}
          undoLabel={undoLabel}
        />
      </>
    );
  }

  if (!setupData || !configured) {
    const handleComplete = (data: RankerSetupData) => {
      // Lock-ins become seed comparisons; only ones the engine accepts are kept
      const seeds = buildLockInComparisons(players, data).filter(
        ({ winner, loser }) => closureCache.addEdge(winner, loser)
      );
      // Field answers stay: the ranking reuses them. Undo can take this step
      // back (dropping only the lock-in seeds) to return to setup.
      const nextSetup: RankerSetupData = {
        ...(field ? { ...data, field, configured: true } : data),
        steps: [...steps, stepFrom()],
      };
      const allResults = [...results, ...seeds];
      setSetupData(nextSetup);
      setAnchorDone(!data.anchor);
      setResults(allResults);
      setSeedCount(allResults.length);

      if (autosave) {
        autosave({
          setupData: nextSetup,
          anchorDone: !data.anchor,
          results: allResults,
          seedCount: allResults.length,
        });
      }
    };

    return (
      <>
        {exitBar}
        <RankingSetup
          playerPool={setupPlayers}
          onComplete={handleComplete}
          listTitle={field ? `your Top ${field.topN}` : null}
          initial={setupPrefill}
          onBack={steps.length > 0 ? handleUndo : undefined}
          backLabel={field ? '← Back to building the field' : '← Back'}
          notFirst={lockInConflicts.notFirst}
          notLast={lockInConflicts.notLast}
          allowLastPlace={!field}
          note={
            field
              ? `Hints here are for your ${setupPlayers.length} ${
                  setupPlayers.length === 1 ? 'lock' : 'locks'
                } only. Your other ${fieldBubble.length} players are already ranked by your answers while building the field; once your locks are ranked, they're checked against your lowest locks and move up past any they beat.`
              : null
          }
        />
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
    // Players already settled against the anchor (e.g. while building the field) aren't asked
    const settled = (id: string) =>
      Boolean(closureCache.closure[id]?.has(anchorId) || closureCache.closure[anchorId]?.has(id));
    const untagged = setupPlayers.filter(
      (p) => p.id !== anchorId && !tagged.has(p.id) && !settled(p.id)
    );
    const handleAnchorComplete = (betterIds: string[]) => {
      // Already-settled players get their result recorded directly, so the
      // upper/lower split (which reads direct results) places them correctly
      const settledSeeds = anchorPlayer
        ? setupPlayers
            .filter((p) => p.id !== anchorId && !tagged.has(p.id) && settled(p.id))
            .map((p) =>
              closureCache.closure[p.id]?.has(anchorId)
                ? { winner: p.id, loser: anchorId }
                : { winner: anchorId, loser: p.id }
            )
        : [];
      const accepted = anchorPlayer
        ? [...settledSeeds, ...buildAnchorComparisons(anchorId, untagged, betterIds)].filter(
            ({ winner, loser }) => closureCache.addEdge(winner, loser)
          )
        : [];
      const allResults = [...results, ...accepted];
      const nextSetup = { ...setupData, steps: [...steps, stepFrom()] };
      setSetupData(nextSetup);
      setResults(allResults);
      setSeedCount(allResults.length);
      setAnchorDone(true);

      if (autosave) {
        autosave({
          setupData: nextSetup,
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
            initialBetter={anchorPrefill}
            onBack={canUndo ? handleUndo : undefined}
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
      <div className="flex flex-col items-center pt-6 sm:pt-12">
        <PlayerCompareCard
          left={leftPlayer}
          right={rightPlayer}
          onSelect={handleSelect}
          onSkip={handleSkip}
          onUndo={canUndo ? handleUndo : undefined}
        />
        {topN !== null && (
          <div className="flex flex-wrap justify-center gap-2 mt-4 px-4 text-xs">
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
