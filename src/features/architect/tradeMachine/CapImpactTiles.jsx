import React, { useMemo } from 'react';
import { formatMillions } from '@/shared/utils/formatting';
import { getSalaryForYear } from '@/features/architect/utils/tradeHelpers';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';
import { Lock } from 'lucide-react';
import {
  isHardCappedAtFirstApron,
  isHardCappedAtSecondApron,
  getFirstApronHardCapReason,
} from '@/features/architect/utils/hardCapUtils';

const CapImpactTiles = ({
  team,
  sends = [],
  incomingPlayers = [],
  yearKey,
  snapshot = null, // Phase 1.6: Validator snapshot (golden source of truth)
  compact = false,
  isValidating = false,
}) => {
  if (!team) return null;

  // =========================================================================
  // SINGLE SOURCE OF TRUTH: Use computeTeamCapTotals for baseline
  // See docs/ARCHITECT_CAP_TOTAL_SINGLE_SOURCE.md for details
  // Phase 73: Memoized to prevent recalculation on every render
  // =========================================================================
  const baselineTotals = useMemo(
    () => computeTeamCapTotals(team, yearKey),
    [team, yearKey]
  );

  const {
    salaryCap,
    firstApron,
    secondApron,
    capHoldsTotal: baselineCapHolds,
    totalCapAllocations: baselineTotalAllocations,
  } = baselineTotals;

  // Determine if hard capped (current status)
  // Phase 73: Memoized hard cap status checks
  const hardCapStatus = useMemo(
    () => ({
      isFirstApronHardCapped: isHardCappedAtFirstApron(team, yearKey),
      isSecondApronHardCapped: isHardCappedAtSecondApron(team),
      firstApronReason: isHardCappedAtFirstApron(team, yearKey)
        ? getFirstApronHardCapReason(team)
        : '',
    }),
    [team, yearKey]
  );
  const { isFirstApronHardCapped, isSecondApronHardCapped, firstApronReason } =
    hardCapStatus;

  // Phase 1.6: Use validator projectedSalary for POST-TRADE totals
  // Definition: players + dead money (NO cap holds, NO likely incentives)
  const hasValidatorResult = snapshot !== null;
  const validatorProjectedSalary = snapshot?.projectedSalary ?? null;

  // For display, use validator's post-trade projectedSalary when available
  // Otherwise, fall back to baseline totalCapAllocations + trade net impact
  // Note: projectedSalary from validator = players + dead money (NO cap holds)
  //       baselineTotalAllocations = players + dead money + cap holds
  // Phase 73: Memoized salary in/out calculations
  const { salaryOut, salaryIn } = useMemo(
    () => ({
      salaryOut: getSalaryForYear(sends, yearKey),
      salaryIn: getSalaryForYear(incomingPlayers, yearKey),
    }),
    [sends, incomingPlayers, yearKey]
  );

  const projectedSalary = hasValidatorResult
    ? validatorProjectedSalary
    : baselineTotalAllocations - salaryOut + salaryIn;

  // Derive cap/apron space from the appropriate total
  // Note: deltas are (total - threshold), so space = -delta
  const capSpace =
    projectedSalary !== null ? salaryCap - projectedSalary : null;
  const firstApronSpace =
    projectedSalary !== null ? firstApron - projectedSalary : null;
  const secondApronSpace =
    projectedSalary !== null ? secondApron - projectedSalary : null;

  // Cap holds are included in baseline but NOT in validator's projectedSalary
  // Show them separately for clarity when there's a trade in progress
  const capHoldsTotal = baselineCapHolds;

  // DEV-ONLY: Divergence check for validator projectedSalary (Phase 1.8)
  // Note: Validator uses players + dead money (NO cap holds)
  // Phase 73: Uses memoized salaryIn/Out values
  if (import.meta.env.DEV && snapshot) {
    const teamTotalSalary = team?.teamTotalSalary ?? team?.totalSalary ?? 0;
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
      <div
        className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-4'} gap-2 text-[11px] transition-opacity ${isValidating ? 'opacity-60' : 'opacity-100'}`}
      >
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
        <div className="bg-[#1c1c1c] rounded p-2 text-center border border-white/10 relative">
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
          {isFirstApronHardCapped && (
            <div className="absolute bottom-1 left-1 group">
              <div className="bg-white/10 border border-white/20 rounded p-0.5 shadow-md backdrop-blur-md">
                <Lock size={10} className="text-white/90" />
              </div>
              {/* Tooltip */}
              <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-48 p-2 bg-[#151515] border border-white/10 shadow-xl rounded-md z-50 pointer-events-none text-center">
                <div className="text-[10px] font-bold text-white mb-0.5">
                  Hard Capped at 1st Apron
                </div>
                <div className="text-[9px] text-white/50 leading-tight">
                  {firstApronReason}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="bg-[#1c1c1c] rounded p-2 text-center border border-white/10 relative">
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
          {isSecondApronHardCapped && (
            <div className="absolute bottom-1 left-1 group">
              <div className="bg-white/10 border border-white/20 rounded p-0.5 shadow-md backdrop-blur-md">
                <Lock size={10} className="text-white/90" />
              </div>
              <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-48 p-2 bg-[#151515] border border-white/10 shadow-xl rounded-md z-50 pointer-events-none text-center">
                <div className="text-[10px] font-bold text-white mb-0.5">
                  Hard Capped at 2nd Apron
                </div>
                <div className="text-[9px] text-white/50 leading-tight">
                  Team salary exceeds 2nd apron threshold
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Validation in-progress indicator */}
      {isValidating && (
        <div className="text-[10px] text-blue-400 italic text-center mt-1 flex items-center justify-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Validating...
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
