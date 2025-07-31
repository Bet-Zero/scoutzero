import React, { useEffect, useState } from 'react';
import PlayerCompareCard from './PlayerCompareCard';
import RankingResults from './RankingResults';
import {
  generateRankingFromComparisons,
  suggestNextPair,
} from '@/utils/ranker/rankingEngine';

const RankingSession = ({ playerPool = [] }) => {
  const [currentPair, setCurrentPair] = useState([]);
  const [results, setResults] = useState([]);
  const [comparisonCount, setComparisonCount] = useState(0);
  const totalNeeded = Math.max(playerPool.length * 2, 10);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (playerPool.length >= 2) {
      setCurrentPair(suggestNextPair([], playerPool));
    }
  }, [playerPool]);

  const handleSelect = (winner, loser) => {
    const newResults = [...results, { winner: winner.id, loser: loser.id }];
    const newCount = comparisonCount + 1;
    setResults(newResults);
    setComparisonCount(newCount);
    if (newCount >= totalNeeded) {
      setIsFinished(true);
    } else {
      setCurrentPair(suggestNextPair(newResults, playerPool));
    }
  };

  const handleSkip = () => {
    setCurrentPair(suggestNextPair(results, playerPool));
  };

  const handleUndo = () => {
    if (results.length === 0) return;
    const newResults = results.slice(0, -1);
    setResults(newResults);
    setComparisonCount((c) => c - 1);
    setIsFinished(false);
    setCurrentPair(suggestNextPair(newResults, playerPool));
  };

  if (isFinished) {
    const ranking = generateRankingFromComparisons(results, playerPool);
    return <RankingResults ranking={ranking} />;
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
      <div className="mt-2 text-white/60 text-sm">
        {comparisonCount} / {totalNeeded} comparisons
      </div>
    </div>
  );
};

export default RankingSession;
