import React from 'react';
import usePlayerData from '@/hooks/usePlayerData.js';
import RankingSession from '@/features/ranker/RankingSession';
import '@/features/ranker/ranker.css';

const PlayerRankerPage = () => {
  const { players, loading } = usePlayerData();

  if (loading) {
    return <div className="p-4 text-white">Loading players...</div>;
  }

  return (
    <div className="bg-neutral-900 min-h-screen text-white p-4">
      <h1 className="text-3xl font-bold mb-4">Player Ranker</h1>
      <RankingSession playerPool={players} />
    </div>
  );
};

export default PlayerRankerPage;
