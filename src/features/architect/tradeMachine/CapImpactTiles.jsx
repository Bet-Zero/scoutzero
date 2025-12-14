import React from 'react';
import capProjections from '@/features/architect/utils/capProjections';
import { formatSalary } from '@/shared/utils/formatting';
import { getSalaryForYear } from '@/features/architect/utils/tradeHelpers';

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

  // Calculate salary total from players
  const salaryTotal = playersAfterTrade.reduce((sum, player) => {
    const salary = getSalaryForYear(player, yearKey);
    return sum + salary;
  }, 0);

  // Calculate cap holds total from team.capHolds (canonical source) if present
  // with defensive fallback to player-level cap_hold for backwards compatibility
  const capHoldsTotal = (() => {
    // Prefer team.capHolds (canonical source)
    if (Array.isArray(team.capHolds) && team.capHolds.length > 0) {
      return team.capHolds
        .filter((h) => {
          if (!h.active || h.isSigned) return false;
          // Match season to yearKey: "2024-25" matches yearKey 2025
          if (!h.season || !String(h.season).includes('-')) return false;
          const seasonStart = parseInt(String(h.season).split('-')[0], 10);
          if (!Number.isFinite(seasonStart)) return false;
          return seasonStart + 1 === yearKey;
        })
        .reduce((sum, h) => sum + (h.amount || 0), 0);
    }
    // Fallback to player-level cap_hold for backwards compatibility
    return playersAfterTrade.reduce((sum, player) => {
      const salary = getSalaryForYear(player, yearKey);
      if (salary > 0) return sum; // Only count holds for players without salary
      const holdAmount =
        typeof player.cap_hold === 'number'
          ? player.cap_hold
          : player.cap_hold?.amount || 0;
      const isActive =
        typeof player.cap_hold === 'object'
          ? player.cap_hold?.active
          : holdAmount > 0;
      return isActive ? sum + holdAmount : sum;
    }, 0);
  })();

  const totalCapAllocations = salaryTotal + capHoldsTotal;
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
