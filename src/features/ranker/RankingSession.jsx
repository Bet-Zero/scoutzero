import React, { useEffect, useMemo, useState } from 'react';
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
} from '@/utils/ranker/rankingEngine';

const RankingSession = ({ playerPool = [] }) => {
  const players = useMemo(
    () => playerPool.map((p) => p.original || p),
    [playerPool]
  );
  const [currentPair, setCurrentPair] = useState([]);
  const [results, setResults] = useState([]);
  const [isFinished, setIsFinished] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [anchorDone, setAnchorDone] = useState(false);

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

  const [comparisonTotal, setComparisonTotal] = useState(0);

  useEffect(() => {
    if (
      comparisonTotal === 0 &&
      setupData &&
      (!setupData.anchor || anchorDone)
    ) {
      setComparisonTotal(remaining);
    }
  }, [comparisonTotal, setupData, anchorDone, remaining]);

  const comparisonsDone = comparisonTotal ? comparisonTotal - remaining : 0;
  const progressPercent = comparisonTotal
    ? (comparisonsDone / comparisonTotal) * 100
    : 0;

  // Evaluate next pair every time results change
  useEffect(() => {
    if (!setupData) return;
    if (setupData.anchor && !anchorDone) return;
    if (groupedPlayers.length < 2) return;

    const next = suggestNextPair(results, groupedPlayers);
    if (next.length === 0) {
      setIsFinished(true);
      setCurrentPair([]);
    } else {
      setCurrentPair(next);
    }
  }, [results, groupedPlayers, setupData, anchorDone]);

  const handleSelect = (winner, loser) => {
    setResults((prev) => [...prev, { winner: winner.id, loser: loser.id }]);
  };

  const handleSkip = () => {
    const next = suggestNextPair(results, groupedPlayers);
    setCurrentPair(next);
  };

  const handleUndo = () => {
    if (results.length === 0) return;
    const newResults = results.slice(0, -1);
    setResults(newResults);
    setIsFinished(false);
  };

  if (isFinished) {
    const ranking = generateRankingFromComparisons(
      results,
      groupedPlayers,
      setupData
    );
    return (
      <>
        <RankingResults ranking={ranking} />
        <div className="text-green-400 mt-4 text-center">
          ✅ All comparisons complete!
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
      if (initial.length) setResults(initial);
    };

    return <RankingSetup playerPool={players} onComplete={handleComplete} />;
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
      if (newResults.length) setResults((prev) => [...prev, ...newResults]);
      setAnchorDone(true);
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
              className="bg-green-500 h-3 rounded-full"
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
