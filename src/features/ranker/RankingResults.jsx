import React from 'react';
import PlayerHeadshot from '@/components/shared/PlayerHeadshot';
import PlayerNameMini from '@/features/table/PlayerTable/PlayerRow/PlayerNameMini';

const RankingResults = ({ ranking = [] }) => {
  return (
    <div className="mt-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-center">Your Rankings</h2>
      <ol className="space-y-3">
        {ranking.map((p, idx) => (
          <li key={p.id} className="flex items-center gap-4 text-white">
            <span className="w-6 text-right font-bold">{idx + 1}</span>
            <PlayerHeadshot playerId={p.id} className="w-12 h-12" />
            <PlayerNameMini name={p.display_name || p.name} width={120} />
          </li>
        ))}
      </ol>
    </div>
  );
};

export default RankingResults;
