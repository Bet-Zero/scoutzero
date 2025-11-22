import React from 'react';
import capProjections from '@/utils/architect/capProjections';
import { formatSalary } from '@/utils/formatting';
import { toSeasonKey } from '@/utils/architect/seasonUtils';
import { getCapHitForSeason } from '@/utils/architect/tradeMachine/utils/seasonUtils.js';

const CapImpactTiles = ({
  team,
  sends = [],
  incomingPlayers = [],
  yearKey,
}) => {
  if (!team) return null;

  // yearKey is the end-year (e.g., 2025), convert to season format: "2024-25"
  const key = toSeasonKey(yearKey);
  const capData = capProjections[key] || {};
  const salaryCap = capData.cap || 0;
  const firstApron = capData.firstApron || 0;
  const secondApron = capData.secondApron || 0;

  // 💥 Defensive fallback if team.players is undefined
  const existingPlayers = Array.isArray(team.players) ? team.players : [];

  const playersAfterTrade = [
    ...existingPlayers.filter(
      (p) => !sends.some((s) => (s.id || s.player_id) === (p.id || p.player_id))
    ),
    ...incomingPlayers,
  ];

  const totalCapAllocations = playersAfterTrade.reduce((sum, player) => {
    // Get from new schema with season key ("2024-25")
    const salary = getCapHitForSeason(player, key) || 0;
    const holdAmount =
      typeof player.cap_hold === 'number'
        ? player.cap_hold
        : player.cap_hold?.amount || 0;
    const isActive =
      typeof player.cap_hold === 'object'
        ? player.cap_hold?.active
        : holdAmount > 0;
    const capHold = !salary && isActive ? holdAmount : 0;
    return sum + salary + capHold;
  }, 0);

  const projectedTotal = totalCapAllocations;
  const capSpace = salaryCap - projectedTotal;
  const firstApronSpace = firstApron - projectedTotal;
  const secondApronSpace = secondApron - projectedTotal;

  const formatMoney = (amount) => formatSalary(amount);

  return (
    <div className="grid grid-cols-4 gap-2 text-[11px]">
      <div className="bg-[#1c1c1c] rounded p-2 text-center border border-white/10">
        <div className="text-white/70">Total Cap</div>
        <div className="text-white font-bold text-sm">
          {formatMoney(projectedTotal)}
        </div>
      </div>
      <div className="bg-[#1c1c1c] rounded p-2 text-center border border-white/10">
        <div className="text-white/70">CAP SPACE</div>
        <div
          className={`font-bold text-sm ${capSpace < 0 ? 'text-red-400' : 'text-green-400'}`}
        >
          {formatMoney(capSpace)}
        </div>
      </div>
      <div className="bg-[#1c1c1c] rounded p-2 text-center border border-white/10">
        <div className="text-white/70">1ST APRON</div>
        <div
          className={`font-bold text-sm ${firstApronSpace < 0 ? 'text-red-400' : 'text-green-400'}`}
        >
          {formatMoney(firstApronSpace)}
        </div>
      </div>
      <div className="bg-[#1c1c1c] rounded p-2 text-center border border-white/10">
        <div className="text-white/70">2ND APRON</div>
        <div
          className={`font-bold text-sm ${secondApronSpace < 0 ? 'text-red-400' : 'text-green-400'}`}
        >
          {formatMoney(secondApronSpace)}
        </div>
      </div>
    </div>
  );
};

export default CapImpactTiles;
