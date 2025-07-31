import React from 'react';
import RankingBuilder from '@/features/ranker/RankingBuilder';
import '@/features/ranker/ranker.css';

const PlayerRankerPage = () => (
  <div className="bg-neutral-900 min-h-screen text-white">
    <RankingBuilder />
  </div>
);

export default PlayerRankerPage;
