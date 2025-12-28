import React from 'react';
import { formatMillions } from '@/shared/utils/formatting';
import { getSalaryForYear } from '@/features/architect/utils/tradeHelpers';
import { getActiveUnsignedCapHoldsTotalByEndYear } from '@/features/architect/utils/capHolds';
import { getCapSettingsForYear } from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';

const CapImpactTiles = ({
  team,
  sends = [],
  incomingPlayers = [],
  yearKey,
}) => {
  if (!team) return null;

  // yearKey is the END year (e.g., 2025 for "2024-25" season)
  // Use centralized cap settings provider for consistent cap/apron values
  const capSettings = getCapSettingsForYear(yearKey);
  const salaryCap = capSettings.salaryCap || 0;
  const firstApron = capSettings.firstApron || 0;
  const secondApron = capSettings.secondApron || 0;

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

  // Calculate cap holds total using shared utility
  // yearKey is the END year (e.g., 2025 for "2024-25" season)
  const capHoldsTotal = (() => {
    // Prefer team.capHolds (canonical source)
    if (Array.isArray(team.capHolds) && team.capHolds.length > 0) {
      // yearKey is END year; use end-year-aware helper for accuracy
      return getActiveUnsignedCapHoldsTotalByEndYear(team.capHolds, yearKey);
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

  return (
    <div className="grid grid-cols-4 gap-2 text-[11px]">
      <div className="bg-[#1c1c1c] rounded p-2 text-center border border-white/10">
        <div className="text-white/70">Total Cap</div>
        <div className="text-white font-bold text-sm">
          {formatMillions(projectedTotal, 1)}
        </div>
      </div>
      <div className="bg-[#1c1c1c] rounded p-2 text-center border border-white/10">
        <div className="text-white/70">CAP SPACE</div>
        <div
          className={`font-bold text-sm ${capSpace < 0 ? 'text-red-400' : 'text-green-400'}`}
        >
          {formatMillions(capSpace, 1)}
        </div>
      </div>
      <div className="bg-[#1c1c1c] rounded p-2 text-center border border-white/10">
        <div className="text-white/70">1ST APRON</div>
        <div
          className={`font-bold text-sm ${firstApronSpace < 0 ? 'text-red-400' : 'text-green-400'}`}
        >
          {formatMillions(firstApronSpace, 1)}
        </div>
      </div>
      <div className="bg-[#1c1c1c] rounded p-2 text-center border border-white/10">
        <div className="text-white/70">2ND APRON</div>
        <div
          className={`font-bold text-sm ${secondApronSpace < 0 ? 'text-red-400' : 'text-green-400'}`}
        >
          {formatMillions(secondApronSpace, 1)}
        </div>
      </div>
    </div>
  );
};

export default CapImpactTiles;
