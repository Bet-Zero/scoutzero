/**
 * FILE: src/features/architect/capSheet/CapSheet/CapSummaryTiles.tsx
 * PURPOSE: Selected-year canonical totals summary surface for the Cap Sheet.
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * NOTE:
 * - This surface is a direct consumer of canonicalTotals passed down from CapSheet.
 * - Canonical totals ownership stays in the cap totals authority.
 * - Hard-cap badge/reason display is handed in as adjacent current-season
 *   presentation, not a competing totals owner.
 *
 * HISTORY:
 *  - 2026-03-14: Migrated authoritative implementation to TypeScript for E88.
 */
import {
  HARD_CAP_TYPES,
} from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import { Lock } from 'lucide-react';
import type { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';

type SummaryHardCapStatus = {
  isHardCapped: boolean;
  hardCapCeilingType: string | null;
  hardCapCeilingLabel: string | null;
  reason: string | null;
};

type CapSummaryTilesProps = {
  currentYear: number;
  selectedYear: number;
  canonicalTotals: ReturnType<typeof computeTeamCapTotals>;
  hardCapStatus?: SummaryHardCapStatus | null;
  surfaceLabel?: string;
};

const formatSeasonLabel = (endYear: number) =>
  `${endYear - 1}-${String(endYear % 100).padStart(2, '0')}`;

export const CapSummaryTiles = ({
  currentYear,
  selectedYear,
  canonicalTotals,
  hardCapStatus = null,
  surfaceLabel = 'Selected-year canonical totals summary surface',
}: CapSummaryTilesProps) => {
  // =========================================================================
  // CANONICAL TOTALS CONSUMER SURFACE:
  // CapSheet computes canonicalTotals once, then this summary surface renders
  // threshold-space outputs from those totals. Any hard-cap badge state is
  // adjacent current-season presentation handed in by CapSheet, not a
  // competing totals owner.
  // =========================================================================

  const {
    totalCapAllocations,
    deltas,
  } = canonicalTotals;
  const showCurrentYearHardCapTruth =
    selectedYear === currentYear && Boolean(hardCapStatus);
  const isFirstApronHardCapped =
    showCurrentYearHardCapTruth &&
    hardCapStatus?.isHardCapped &&
    hardCapStatus?.hardCapCeilingType === HARD_CAP_TYPES.FIRST_APRON;
  const isSecondApronHardCapped =
    showCurrentYearHardCapTruth &&
    hardCapStatus?.isHardCapped &&
    hardCapStatus?.hardCapCeilingType === HARD_CAP_TYPES.SECOND_APRON;
  const hardCapHeading = hardCapStatus?.hardCapCeilingLabel
    ? `Hard Capped at ${hardCapStatus.hardCapCeilingLabel}`
    : 'Hard Capped';
  const hardCapReason = hardCapStatus?.reason || '';
  const selectedSeasonLabel = formatSeasonLabel(selectedYear);
  const currentSeasonLabel = formatSeasonLabel(currentYear);
  const summaryToneClasses =
    selectedYear === currentYear
      ? 'border-sky-400/15 bg-sky-500/[0.05] text-sky-100'
      : 'border-amber-400/15 bg-amber-500/[0.05] text-amber-100';
  const summaryEyebrowClass =
    selectedYear === currentYear ? 'text-sky-300/80' : 'text-amber-300/80';
  const summaryChipClass =
    selectedYear === currentYear
      ? 'border-sky-300/20 bg-sky-500/10 text-sky-100/90'
      : 'border-amber-300/20 bg-amber-500/10 text-amber-100/90';

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
      aria-label={surfaceLabel}
      className="my-4 space-y-3"
    >
      <div
        data-testid="cap-summary-surface-truth-banner"
        className={`rounded-lg border px-4 py-3 ${summaryToneClasses}`}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div
              className={`text-[10px] uppercase tracking-[0.25em] ${summaryEyebrowClass}`}
            >
              Selected-Year Canonical Totals
            </div>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-white/80">
              {selectedYear === currentYear
                ? `These tiles consume the canonical ${selectedSeasonLabel} cap-table totals. Any hard-cap badge shown on the apron tiles is current-season-only adjacent authority, not a competing totals owner.`
                : `These tiles consume the canonical ${selectedSeasonLabel} cap-table totals only. Hard-cap badges are hidden here because live hard-cap authority stays on the adjacent ${currentSeasonLabel} surface.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] font-medium">
            <span
              className={`rounded-full border px-2.5 py-1 ${summaryChipClass}`}
            >
              Canonical totals: {selectedSeasonLabel}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 ${summaryChipClass}`}
            >
              Hard-cap badge authority:{' '}
              {selectedYear === currentYear
                ? currentSeasonLabel
                : `${currentSeasonLabel} only`}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
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
              <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-48 p-3 bg-[#151515] border border-white/10 shadow-xl rounded-md z-50 pointer-events-none text-center">
                <div className="text-xs font-bold text-white mb-0.5">
                  {hardCapHeading}
                </div>
                <div className="text-[10px] text-white/50 leading-tight">
                  {hardCapReason}
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
            <div className="absolute bottom-2 left-2 group">
              <div className="bg-white/10 border border-white/20 rounded p-1 shadow-md backdrop-blur-md">
                <Lock size={14} className="text-white/90" />
              </div>
              <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-48 p-3 bg-[#151515] border border-white/10 shadow-xl rounded-md z-50 pointer-events-none text-center">
                <div className="text-xs font-bold text-white mb-0.5">
                  {hardCapHeading}
                </div>
                <div className="text-[10px] text-white/50 leading-tight">
                  {hardCapReason}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

