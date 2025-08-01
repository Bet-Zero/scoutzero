import React, { useEffect, useState } from 'react';
import PlayerCompareCard from './PlayerCompareCard';
import RankingResults from './RankingResults';
import ComparisonMatrix from './ComparisonMatrix';
import {
  generateRankingFromComparisons,
  suggestNextPair,
} from '@/utils/ranker/rankingEngine';

const RankingSession = ({ playerPool = [] }) => {
  const [currentPair, setCurrentPair] = useState([]);
  const [results, setResults] = useState([]);
  const [isFinished, setIsFinished] = useState(false);

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
      <div className="mt-2 text-white/60 text-sm">
        {results.length} total comparisons
      </div>
      <ComparisonMatrix players={playerPool} comparisons={results} />
    </div>
  );
};

export default RankingSession;
