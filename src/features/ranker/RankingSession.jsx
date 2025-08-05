import React, { useEffect, useMemo, useState } from 'react';
import PlayerCompareCard from './PlayerCompareCard';
import RankingResults from './RankingResults';
import ComparisonMatrix from './ComparisonMatrix';
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

  const remaining = useMemo(
    () => estimateRemainingComparisons(results, players),
    [results, players]
  );

  const estimatedTotal = results.length + remaining;
  const progressPercent = estimatedTotal
    ? (results.length / estimatedTotal) * 100
    : 0;

  // Evaluate next pair every time results change
  useEffect(() => {
    if (!setupData) return;
    if (setupData.anchor && !anchorDone) return;
    if (players.length < 2) return;

    const next = suggestNextPair(results, players);
    if (next.length === 0) {
      setIsFinished(true);
      setCurrentPair([]);
    } else {
      setCurrentPair(next);
    }
  }, [results, players, setupData, anchorDone]);

  const handleSelect = (winner, loser) => {
    setResults((prev) => [...prev, { winner: winner.id, loser: loser.id }]);
  };

  const handleSkip = () => {
    const next = suggestNextPair(results, players);
    setCurrentPair(next);
  };

  const handleUndo = () => {
    if (results.length === 0) return;
    const newResults = results.slice(0, -1);
    setResults(newResults);
    setIsFinished(false);
  };

  if (isFinished) {
    const ranking = generateRankingFromComparisons(results, players, setupData);
    return (
      <>
        <RankingResults ranking={ranking} />
        <div className="text-green-400 mt-4 text-center">
          ✅ All comparisons complete!
        </div>
        <ComparisonMatrix players={players} comparisons={results} />
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
    const tagged = new Set([
      ...setupData.topTier,
      ...setupData.bottomTier,
      setupData.firstPlace,
      setupData.lastPlace,
    ].filter(Boolean));
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
    <div className="flex flex-col items-center">
      <PlayerCompareCard
        left={currentPair[0]}
        right={currentPair[1]}
        onSelect={handleSelect}
        onSkip={handleSkip}
        onUndo={handleUndo}
      />
      <div className="w-full max-w-xs mt-4">
        <div className="w-full bg-white/20 h-2 rounded-full">
          <div
            className="bg-green-500 h-2 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
      <div className="mt-2 text-white/60 text-sm">
        {results.length} / {estimatedTotal} comparisons
      </div>
      <ComparisonMatrix players={players} comparisons={results} />
    </div>
  );
};

export default RankingSession;
