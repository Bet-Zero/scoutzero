import React from 'react';
import { formatMillions } from '@/shared/utils/formatting';
import { getSalaryForYear } from '@/features/architect/utils/tradeHelpers';
import {
  computeTeamCapTotals,
  warnOnTotalsDivergence,
} from '@/features/architect/utils/capTotals';

const CapImpactTiles = ({
  team,
  sends = [],
  incomingPlayers = [],
  yearKey,
  snapshot = null, // Phase 1.6: Validator snapshot (golden source of truth)
}) => {
  if (!team) return null;

  // =========================================================================
  // SINGLE SOURCE OF TRUTH: Use computeTeamCapTotals for baseline
  // See docs/ARCHITECT_CAP_TOTAL_SINGLE_SOURCE.md for details
  // =========================================================================
  const baselineTotals = computeTeamCapTotals(team, yearKey);

  const {
    salaryCap,
    firstApron,
    secondApron,
    capHoldsTotal: baselineCapHolds,
    totalCapAllocations: baselineTotalAllocations,
  } = baselineTotals;

  // Phase 1.6: Use validator projectedSalary for POST-TRADE totals
  // Definition: players + dead money (NO cap holds, NO likely incentives)
  const hasValidatorResult = snapshot !== null;
  const validatorProjectedSalary = snapshot?.projectedSalary ?? null;

  // For display, use validator's post-trade projectedSalary when available
  // Otherwise, fall back to baseline totalCapAllocations
  // Note: projectedSalary from validator = players + dead money (NO cap holds)
  //       baselineTotalAllocations = players + dead money + cap holds
  const projectedSalary = hasValidatorResult
    ? validatorProjectedSalary
    : baselineTotalAllocations;

  // Derive cap/apron space from the appropriate total
  const capSpace = projectedSalary !== null ? salaryCap - projectedSalary : null;
  const firstApronSpace =
    projectedSalary !== null ? firstApron - projectedSalary : null;
  const secondApronSpace =
    projectedSalary !== null ? secondApron - projectedSalary : null;

  // Cap holds are included in baseline but NOT in validator's projectedSalary
  // Show them separately for clarity when there's a trade in progress
  const capHoldsTotal = baselineCapHolds;

  // DEV-ONLY: Divergence check for baseline totals (Phase 1.8)
  // Verify that local computation matches canonical totals
  if (import.meta.env.DEV && !hasValidatorResult) {
    warnOnTotalsDivergence(
      'CapImpactTiles',
      'baselineTotalAllocations',
      baselineTotalAllocations,
      baselineTotals.totalCapAllocations
    );
  }

  // DEV-ONLY: Divergence check for validator projectedSalary (Phase 1.8)
  // Note: Validator uses players + dead money (NO cap holds)
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
