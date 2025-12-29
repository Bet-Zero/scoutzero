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
  snapshot = null, // Phase 1.6: Validator snapshot (golden source of truth)
}) => {
  if (!team) return null;

  // yearKey is the END year (e.g., 2025 for "2024-25" season)
  // Use centralized cap settings provider for consistent cap/apron values
  const capSettings = getCapSettingsForYear(yearKey);
  const salaryCap = capSettings.salaryCap || 0;
  const firstApron = capSettings.firstApron || 0;
  const secondApron = capSettings.secondApron || 0;

  // Phase 1.6: Use validator projectedSalary as sole source of truth
  // Definition: players + dead money (NO cap holds, NO likely incentives)
  const hasValidatorResult = snapshot !== null;
  const validatorProjectedSalary = snapshot?.projectedSalary ?? null;

  // Calculate cap holds total using shared utility (separate from projected salary)
  // yearKey is the END year (e.g., 2025 for "2024-25" season)
  const capHoldsTotal = (() => {
    // 💥 Defensive fallback if team.players is undefined
    const existingPlayers = Array.isArray(team.players) ? team.players : [];
    const playersAfterTrade = [
      ...existingPlayers.filter(
        (p) =>
          !sends.some((s) => (s.id || s.player_id) === (p.id || p.player_id))
      ),
      ...incomingPlayers,
    ];

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

  // Phase 1.6: Use validator projectedSalary when available, otherwise show "—"
  const projectedSalary = validatorProjectedSalary ?? null;

  // Derive cap/apron space from validator value when available
  const capSpace =
    projectedSalary !== null ? salaryCap - projectedSalary : null;
  const firstApronSpace =
    projectedSalary !== null ? firstApron - projectedSalary : null;
  const secondApronSpace =
    projectedSalary !== null ? secondApron - projectedSalary : null;

  // DEV-ONLY: Divergence check for projectedSalary (Phase 1.8)
  // Local calc uses SAME definition as validator: players + dead money (NO cap holds)
  if (import.meta.env.DEV && snapshot) {
    const teamTotalSalary = team?.teamTotalSalary ?? team?.totalSalary ?? 0;
    const salaryOut = getSalaryForYear(sends, yearKey);
    const salaryIn = getSalaryForYear(incomingPlayers, yearKey);
    const localProjected = teamTotalSalary - salaryOut + salaryIn;
    const validatorProjected = snapshot.projectedSalary;
    const diff = Math.abs(localProjected - validatorProjected);
    if (diff > 1) {
      console.warn('[CapImpactTiles] projectedSalary DIVERGENCE', {
        teamId: team?.id || team?.teamId,
        localProjected,
        validatorProjected,
        diff,
      });
    }
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 text-[11px]">
        <div className="bg-[#1c1c1c] rounded p-2 text-center border border-white/10">
          <div className="text-white/70">TOTAL CAP</div>
          <div className="text-white font-bold text-sm">
            {projectedSalary !== null
              ? formatMillions(projectedSalary, 1)
              : '—'}
          </div>
        </div>
        <div className="bg-[#1c1c1c] rounded p-2 text-center border border-white/10">
          <div className="text-white/70">CAP SPACE</div>
          <div
            className={`font-bold text-sm ${
              capSpace !== null
                ? capSpace < 0
                  ? 'text-red-400'
                  : 'text-green-400'
                : 'text-white/40'
            }`}
          >
            {capSpace !== null ? formatMillions(capSpace, 1) : '—'}
          </div>
        </div>
        <div className="bg-[#1c1c1c] rounded p-2 text-center border border-white/10">
          <div className="text-white/70">1ST APRON</div>
          <div
            className={`font-bold text-sm ${
              firstApronSpace !== null
                ? firstApronSpace < 0
                  ? 'text-red-400'
                  : 'text-green-400'
                : 'text-white/40'
            }`}
          >
            {firstApronSpace !== null
              ? formatMillions(firstApronSpace, 1)
              : '—'}
          </div>
        </div>
        <div className="bg-[#1c1c1c] rounded p-2 text-center border border-white/10">
          <div className="text-white/70">2ND APRON</div>
          <div
            className={`font-bold text-sm ${
              secondApronSpace !== null
                ? secondApronSpace < 0
                  ? 'text-red-400'
                  : 'text-green-400'
                : 'text-white/40'
            }`}
          >
            {secondApronSpace !== null
              ? formatMillions(secondApronSpace, 1)
              : '—'}
          </div>
        </div>
      </div>
      {/* Phase 1.6: Pre-validation indicator */}
      {!hasValidatorResult && (
        <div className="text-[10px] text-white/40 italic text-center mt-1">
          Pending validation
        </div>
      )}
      {/* Cap holds displayed separately (not in projected salary) */}
      {capHoldsTotal > 0 && (
        <div className="text-[10px] text-white/50 text-center mt-1">
          Cap Holds (not in projected): {formatMillions(capHoldsTotal, 1)}
        </div>
      )}
    </div>
  );
};

export default CapImpactTiles;
