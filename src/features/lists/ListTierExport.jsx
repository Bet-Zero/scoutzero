// src/features/lists/ListTierExport.jsx
import React from 'react';
import TierPlayerTile from '@/features/lists/TierPlayerTile';

const ListTierExport = ({ tiers }) => {
  return (
    <div className="flex flex-col items-center w-full pt-2">
      <div className="w-full max-w-[950px] flex flex-col gap-[4px]">
        {tiers.map((tier, idx) => (
          <div
            key={tier.label || `tier-${idx}`}
            className="relative clear-both w-full"
          >
            <h2 className="text-white text-[12px] font-semibold mb-[2px]">
              {tier.label || `Tier ${idx + 1}`}
            </h2>

            <div className="flex flex-wrap items-start gap-[2px]">
              {tier.players.map((player) => (
                <TierPlayerTile key={player.player_id} player={player} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ListTierExport;
