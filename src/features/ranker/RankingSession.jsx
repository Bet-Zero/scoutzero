import React, { useEffect, useMemo, useState } from 'react';
import PlayerCompareCard from './PlayerCompareCard';
import RankingResults from './RankingResults';
import ComparisonMatrix from './ComparisonMatrix';
import {
  generateRankingFromComparisons,
  suggestNextPair,
  estimateRemainingComparisons,
} from '@/utils/ranker/rankingEngine';

const RankingSession = ({ playerPool = [] }) => {
  const [currentPair, setCurrentPair] = useState([]);
  const [results, setResults] = useState([]);
  const [isFinished, setIsFinished] = useState(false);

  const totalPairs = useMemo(() => {
    return (playerPool.length * (playerPool.length - 1)) / 2;
  }, [playerPool]);

  const remaining = useMemo(
    () => estimateRemainingComparisons(results, playerPool),
    [results, playerPool]
  );

  const progressPercent = totalPairs
    ? ((totalPairs - remaining) / totalPairs) * 100
    : 0;

  // Evaluate next pair every time results change
  useEffect(() => {
    if (playerPool.length < 2) return;

    const next = suggestNextPair(results, playerPool);
    if (next.length === 0) {
      setIsFinished(true);
      setCurrentPair([]);
    } else {
      setCurrentPair(next);
    }
  }, [results, playerPool]);

  const handleSelect = (winner, loser) => {
    setResults((prev) => [...prev, { winner: winner.id, loser: loser.id }]);
  };

  const handleSkip = () => {
    const next = suggestNextPair(results, playerPool);
    setCurrentPair(next);
  };

  const handleUndo = () => {
    if (results.length === 0) return;
    const newResults = results.slice(0, -1);
    setResults(newResults);
    setIsFinished(false);
  };

  if (isFinished) {
    const ranking = generateRankingFromComparisons(results, playerPool);
    return (
      <>
        <RankingResults ranking={ranking} />
        <div className="text-green-400 mt-4 text-center">
          ✅ All comparisons complete!
        </div>
        <ComparisonMatrix players={playerPool} comparisons={results} />
      </>
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
        {results.length} / {totalPairs} comparisons
      </div>
      <ComparisonMatrix players={playerPool} comparisons={results} />
    </div>
  );
};

export default RankingSession;
