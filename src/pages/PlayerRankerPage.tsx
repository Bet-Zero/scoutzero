import React from 'react';
import { RankingBuilder } from '@/features/ranker/RankingBuilder';
import '@/features/ranker/ranker.css';

const PlayerRankerPage = () => (
  <div className="bg-neutral-900 flex-1 min-h-0 overflow-y-auto flex flex-col text-white">
    <RankingBuilder />
  </div>
);

export default PlayerRankerPage;
