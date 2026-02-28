import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import PlayerCompareCard from './PlayerCompareCard';
import RankingResults from './RankingResults';
import ComparisonMatrixDrawer from './ComparisonMatrixDrawer';
import { RankingSetup } from './RankingSetup';
import { AnchorComparison } from './AnchorComparison';
import {
  generateRankingFromComparisons,
  suggestNextPair,
  estimateRemainingComparisons,
  buildAnchorComparisons,
  createClosureCache,
} from '@/features/ranker/utils/rankingEngine';

const RankingSession = ({
  playerPool = [],
  sessionId = null,
  resumedSessionData = null,
  autosave = null,
  saveNow = null,
  saveAdjustments = null,
  markFinished = null,
}) => {
  const players = useMemo(
    () => playerPool.map((p) => p.original || p),
    [playerPool]
  );

  // Core state — initialized from resumed session or fresh
  const [currentPair, setCurrentPair] = useState([]);
  const [results, setResults] = useState(
    () => resumedSessionData?.results || []
  );
  const [isFinished, setIsFinished] = useState(
    () => resumedSessionData?.isFinished || false
  );
  const [setupData, setSetupData] = useState(
    () => resumedSessionData?.setupData || null
  );
  const [anchorDone, setAnchorDone] = useState(
    () => resumedSessionData?.anchorDone || false
  );
  const [skippedPairs, setSkippedPairs] = useState(
    () => resumedSessionData?.skippedPairs || new Set()
  );
  const [adjustments, setAdjustments] = useState(
    () => resumedSessionData?.adjustments || null
  );

  // Incremental closure cache — survives re-renders, rebuilt on undo or resume
  const closureCacheRef = useRef(() => {
    const cache = createClosureCache();
    // If resuming, rebuild closure from stored results
    if (resumedSessionData?.results?.length > 0) {
      cache.rebuild(resumedSessionData.results);
    }
    return cache;
  });

  // Initialize closure cache on first render (or when resumedSessionData changes)
  useEffect(() => {
    if (resumedSessionData?.closureCache) {
      closureCacheRef.current = resumedSessionData.closureCache;
    } else if (resumedSessionData?.results?.length > 0) {
      closureCacheRef.current = createClosureCache();
      closureCacheRef.current.rebuild(resumedSessionData.results);
    } else {
      closureCacheRef.current = createClosureCache();
    }
  }, [resumedSessionData]);

  const groupedPlayers = useMemo(() => {
    if (!setupData || (setupData.anchor && !anchorDone)) return players;
    const { topTier = [], bottomTier = [], anchor } = setupData;
    const better = new Set();
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
    (winner, loser) => {
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
    if (currentPair.length < 2) return;
    const key =
      currentPair[0].id < currentPair[1].id
        ? `${currentPair[0].id}<>${currentPair[1].id}`
        : `${currentPair[1].id}<>${currentPair[0].id}`;
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
    (adjustedRanking) => {
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
      setupData
    );

    // If adjustments exist (persisted), use them as canonical ranking
    if (adjustments && Array.isArray(adjustments) && adjustments.length > 0) {
      // Reconstruct player objects from adjustment IDs
      const playerById = {};
      groupedPlayers.forEach((p) => {
        playerById[p.id] = p;
      });
      const adjustedRanking = adjustments
        .map((id) => playerById[id])
        .filter(Boolean);
      if (adjustedRanking.length > 0) {
        ranking = adjustedRanking;
      }
    }

    return (
      <>
        <RankingResults
          ranking={ranking}
          onRankingAdjusted={handleRankingAdjusted}
        />
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
    const handleComplete = (data) => {
      setSetupData(data);
      setAnchorDone(!data.anchor);

      const initial = [];
      if (data.firstPlace) {
        players.forEach((p) => {
          if (p.id !== data.firstPlace)
            initial.push({ winner: data.firstPlace, loser: p.id });
        });
      }
      if (data.lastPlace) {
        players.forEach((p) => {
          if (p.id !== data.lastPlace)
            initial.push({ winner: p.id, loser: data.lastPlace });
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
    const anchorPlayer = players.find((p) => p.id === setupData.anchor);
    const tagged = new Set(
      [
        ...setupData.topTier,
        ...setupData.bottomTier,
        setupData.firstPlace,
        setupData.lastPlace,
      ].filter(Boolean)
    );
    const untagged = players.filter(
      (p) => p.id !== setupData.anchor && !tagged.has(p.id)
    );
    const handleAnchorComplete = (betterIds) => {
      const newResults = buildAnchorComparisons(
        setupData.anchor,
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

  return (
    <>
      <div className="flex flex-col items-center pt-12">
        <PlayerCompareCard
          left={currentPair[0]}
          right={currentPair[1]}
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

export default RankingSession;
