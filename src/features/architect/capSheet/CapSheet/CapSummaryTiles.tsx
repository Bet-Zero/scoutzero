/**
 * FILE: src/features/architect/capSheet/CapSheet/CapSummaryTiles.tsx
 * PURPOSE: Current-year canonical totals summary surface for the Cap Sheet.
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * NOTE:
 * - This surface is a direct consumer of canonicalTotals passed down from CapSheet.
 * - Canonical totals ownership stays in the cap totals authority.
 * - Hard-cap badge/reason ownership stays in hardCapUtils as adjacent presentation.
 *
 * HISTORY:
 *  - 2026-03-14: Migrated authoritative implementation to TypeScript for E88.
 */
import React from 'react';
import {
  isHardCappedAtFirstApron,
  isHardCappedAtSecondApron,
  getFirstApronHardCapReason,
} from '@/features/architect/utils/hardCapUtils';
import { Lock } from 'lucide-react';
import type { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';

type CapSummaryTilesProps = {
  teamCapSheet: Parameters<typeof isHardCappedAtFirstApron>[0];
  selectedYear: Parameters<typeof isHardCappedAtFirstApron>[1];
  canonicalTotals: ReturnType<typeof computeTeamCapTotals>;
};

const CapSummaryTiles = ({
  teamCapSheet,
  selectedYear,
  canonicalTotals,
}: CapSummaryTilesProps) => {
  // =========================================================================
  // CANONICAL TOTALS CONSUMER SURFACE:
  // CapSheet computes canonicalTotals once, then this summary surface renders
  // threshold-space outputs from those totals. Hard-cap badges stay adjacent
  // presentation layered on the tiles, not a competing totals owner.
  // =========================================================================

  const {
    totalCapAllocations,
    playersTotal,
    capHoldsTotal,
    deadMoneyTotal,
    salaryCap,
    luxuryTax,
    firstApron,
    secondApron,
    deltas,
  } = canonicalTotals;

  // Determine if hard capped
  const isFirstApronHardCapped = isHardCappedAtFirstApron(
    teamCapSheet,
    selectedYear
  );
  const isSecondApronHardCapped = isHardCappedAtSecondApron(teamCapSheet);

  const firstApronReason = isFirstApronHardCapped
    ? getFirstApronHardCapReason(teamCapSheet)
    : '';

  // Calculate space from canonical totals
  // Note: deltas are (total - threshold), so space = -delta
  const capSpace = -deltas.vsCap;
  const luxuryTaxSpace = -(deltas.vsLuxuryTax || 0);
  const firstApronSpace = -deltas.vsFirstApron;
  const secondApronSpace = -deltas.vsSecondApron;

  const formatMoney = (amount: number) =>
    `${amount < 0 ? '-' : ''}$${Math.abs(amount).toLocaleString()}`;

  return (
    <section
      aria-label="Current-year canonical totals summary surface"
      className="grid grid-cols-2 sm:grid-cols-5 gap-4 my-4"
    >
      <div className="bg-[#1c1c1c] rounded p-4 text-center border border-white/10">
        <div className="text-sm text-white/70 mb-1">TOTAL CAP ALLOCATIONS</div>
        <div className="text-lg font-bold text-white">
          {formatMoney(totalCapAllocations)}
        </div>
      </div>

      <div className="bg-[#1c1c1c] rounded p-4 text-center border border-white/10">
        <div className="text-sm text-white/70 mb-1">CAP SPACE</div>
        <div
          className={`text-lg font-bold ${
            capSpace < 0 ? 'text-red-400' : 'text-green-400'
          }`}
        >
          {formatMoney(capSpace)}
        </div>
      </div>

      <div className="bg-[#1c1c1c] rounded p-4 text-center border border-white/10">
        <div className="text-sm text-white/70 mb-1">LUXURY TAX SPACE</div>
        <div
          className={`text-lg font-bold ${
            luxuryTaxSpace < 0 ? 'text-red-400' : 'text-green-400'
          }`}
        >
          {formatMoney(luxuryTaxSpace)}
        </div>
      </div>

      <div className="bg-[#1c1c1c] rounded p-4 text-center border border-white/10 relative">
        <div className="text-sm text-white/70 mb-1">1ST APRON SPACE</div>
        <div
          className={`text-lg font-bold ${
            firstApronSpace < 0 ? 'text-red-400' : 'text-green-400'
          }`}
        >
          {formatMoney(firstApronSpace)}
        </div>
        {isFirstApronHardCapped && (
          <div className="absolute bottom-2 left-2 group">
            <div className="bg-white/10 border border-white/20 rounded p-1 shadow-md backdrop-blur-md">
              <Lock size={14} className="text-white/90" />
            </div>
            {/* Tooltip */}
            <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-48 p-3 bg-[#151515] border border-white/10 shadow-xl rounded-md z-50 pointer-events-none text-center">
              <div className="text-xs font-bold text-white mb-0.5">
                Hard Capped at 1st Apron
              </div>
              <div className="text-[10px] text-white/50 leading-tight">
                {firstApronReason}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#1c1c1c] rounded p-4 text-center border border-white/10 relative">
        <div className="text-sm text-white/70 mb-1">2ND APRON SPACE</div>
        <div
          className={`text-lg font-bold ${
            secondApronSpace < 0 ? 'text-red-400' : 'text-green-400'
          }`}
        >
          {formatMoney(secondApronSpace)}
        </div>
        {isSecondApronHardCapped && (
          <div className="absolute bottom-2 left-2 bg-white/10 border border-white/20 rounded p-1 shadow-md backdrop-blur-md">
            <Lock size={14} className="text-white/90" />
          </div>
        )}
      </div>
    </section>
  );
};

export default CapSummaryTiles;
