import React from 'react';
import capProjections from '@/utils/architect/capProjections';
import { formatSalary } from '@/utils/formatting';

const CapImpactTiles = ({
  team,
  sends = [],
  incomingPlayers = [],
  yearKey,
}) => {
  if (!team) return null;

  const key = `${yearKey}-${String((yearKey + 1) % 100).padStart(2, '0')}`;
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
    const salary =
      player.contract_clean?.salaries_by_year?.[yearKey]?.salary || 0;
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
