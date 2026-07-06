/**
 * FILE: src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.tsx
 * PURPOSE: Adjacent exception/TPE/hard-cap presentation surface for the Architect cap sheet.
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * NOTE:
 * - Owns exception, TPE, and hard-cap presentation for the Cap Sheet surface.
 * - This surface is adjacent to the current-year canonical totals display.
 * - Does not compute or redefine canonical cap totals; that remains owned by
 *   the cap totals authority.
 *
 * HISTORY:
 *  - 2026-03-14: Migrated authoritative implementation to TypeScript for E88.
 */
import React from 'react';
import { BadgeAlert, ShieldAlert } from 'lucide-react';
import { getCapSettingsForYear } from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';
import {
  getHardCapStatus,
  HARD_CAP_TYPES,
} from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import { canUseRoomException } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { getCanonicalExceptionAvailability } from '@/features/architect/utils/exceptions/exceptionOwnership';
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts/normalizeTeamTpe';

type UnknownRecord = Record<string, unknown>;
type TeamCapSheetLike = NonNullable<Parameters<typeof canUseRoomException>[0]> &
  NonNullable<Parameters<typeof getHardCapStatus>[0]> & {
    exceptions?: (UnknownRecord & { tpe?: unknown }) | null;
  };
type TeamTpeLike = ReturnType<typeof getTeamTpeList>[number];

const formatSeasonLabel = (endYear: number) =>
  `${endYear - 1}-${String(endYear % 100).padStart(2, '0')}`;
type ExceptionTrackerProps = {
  teamCapSheet: TeamCapSheetLike;
  currentYear: number;
  selectedYear?: number | null;
  surfaceLabel?: string;
};

type ExceptionCardProps = {
  label: string;
  amount: number;
  subtext?: string;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'gray';
  statusLabel?: string | null;
};

const ExceptionCard = ({
  label,
  amount,
  subtext,
  color = 'blue',
  statusLabel,
}: ExceptionCardProps) => {
  const colorStyles = {
    blue: 'bg-blue-500/5 border-blue-500/20 text-blue-400 hover:bg-blue-500/10',
    green:
      'bg-green-500/5 border-green-500/20 text-green-400 hover:bg-green-500/10',
    orange:
      'bg-orange-500/5 border-orange-500/20 text-orange-400 hover:bg-orange-500/10',
    red: 'bg-red-500/5 border-red-500/20 text-red-500 hover:bg-red-500/10',
    gray: 'bg-white/[0.02] border-white/5 text-zinc-500',
  };

  return (
    <div
      className={`relative flex items-center justify-between gap-1.5 rounded-md border px-2 py-1 transition-all group ${colorStyles[color]}`}
      title={subtext}
    >
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate text-[9px] uppercase tracking-wide font-bold opacity-70">
          {label}
        </span>
        {statusLabel && (
          <span className="shrink-0 text-[8px] uppercase tracking-wider font-bold opacity-50 border border-current px-1 rounded-sm">
            {statusLabel}
          </span>
        )}
      </span>
      <span className="whitespace-nowrap text-[11px] font-bold tracking-tight text-white/90 tabular-nums">
        ${amount.toLocaleString()}
      </span>
    </div>
  );
};

type HardCapCardProps = {
  hardCapStatus: ReturnType<typeof getHardCapStatus>;
  hasApronData: boolean;
};

const HardCapCard = ({ hardCapStatus, hasApronData }: HardCapCardProps) => {
  const isActive = hardCapStatus.isHardCapped;

  if (!isActive && !hasApronData) return null;

  const limitAmount = hardCapStatus.hardCapCeiling;
  const ceilingLabel = hardCapStatus.hardCapCeilingLabel;
  const description = hardCapStatus.reason || 'Hard cap active.';

  if (!isActive)
    return (
      <div className="flex items-center gap-2 rounded-md border border-white/5 bg-white/[0.02] px-3 py-1 text-white/40">
        <ShieldAlert size={13} />
        <span className="text-[10px] uppercase tracking-wider font-semibold">
          No Hard Cap Active
        </span>
      </div>
    );

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-1 text-red-400">
      <ShieldAlert size={13} className="shrink-0 text-red-500" />
      <span className="text-[10px] uppercase tracking-widest font-bold text-red-100">
        Hard Capped
      </span>
      {ceilingLabel && (
        <span className="text-[9px] uppercase tracking-widest text-red-300/70">
          {ceilingLabel}
        </span>
      )}
      <span className="text-xs font-bold tabular-nums text-red-100">
        {limitAmount !== null ? `$${limitAmount.toLocaleString()}` : '—'}
      </span>
      <span
        className="min-w-0 flex-1 truncate text-right text-[9px] leading-tight text-red-400/70"
        title={description}
      >
        {description}
      </span>
    </div>
  );
};

type CompactTradeExceptionRowProps = {
  tpe: TeamTpeLike;
};

const CompactTradeExceptionRow = ({ tpe }: CompactTradeExceptionRowProps) => {
  const expiryDisplay =
    tpe.expiresOn || tpe.expirationDate || tpe.expires || '—';

  return (
    <div className="grid grid-cols-[80px_1fr_auto] gap-3 items-center py-1 px-2 border-b border-white/5 last:border-0 hover:bg-white/[0.04] transition-all group relative overflow-hidden">
      {/* "Spice" - left accent */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-purple-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex flex-col">
        <span className="text-xs font-bold text-white/90 tabular-nums group-hover:text-purple-200 transition-colors">
          ${(tpe.amount || 0).toLocaleString()}
        </span>
      </div>

      <div className="flex items-center text-[10px] text-white/40 group-hover:text-white/60 transition-colors truncate">
        {Boolean(tpe.createdFrom) && <span>from {String(tpe.createdFrom)}</span>}
      </div>

      <div className="text-right whitespace-nowrap">
        <span className="text-[10px] text-white/30 font-medium group-hover:text-white/50 transition-colors">
          {String(expiryDisplay)}
        </span>
      </div>
    </div>
  );
};

export const ExceptionTracker = ({
  teamCapSheet,
  currentYear,
  selectedYear = currentYear,
  surfaceLabel = 'Cap sheet current-season exception authority surface',
}: ExceptionTrackerProps) => {
  const isViewingCurrentYear = selectedYear === currentYear;
  const currentSeasonLabel = formatSeasonLabel(currentYear);
  const resolvedSelectedYear = selectedYear ?? currentYear;
  const selectedSeasonLabel = formatSeasonLabel(resolvedSelectedYear);
  // BZE-216 hierarchy rework: exception cards and the TPE list are secondary
  // detail — collapsed by default behind the banner's details toggle so the
  // cap table keeps the default-view space.
  const [showExceptionDetails, setShowExceptionDetails] = React.useState(false);
  const roomExceptionEligibility = React.useMemo(() => {
    if (!teamCapSheet || !currentYear) {
      return { eligible: false, reason: 'Missing team data' };
    }
    return canUseRoomException(teamCapSheet, currentYear);
  }, [teamCapSheet, currentYear]);

  if (!isViewingCurrentYear) {
    return (
      <section
        aria-label={surfaceLabel}
      >
        <div
          data-testid="cap-sheet-future-year-boundary-panel"
          className="rounded-md border border-amber-400/20 bg-amber-500/5 px-3 py-2 text-amber-100"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-amber-300/80">
              Exceptions & Hard Cap
            </span>
            <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-100/90">
              Viewing: {selectedSeasonLabel}
            </span>
            <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-100/90">
              Applies to {currentSeasonLabel} only
            </span>
          </div>
          <h3 className="mt-1.5 text-xs font-semibold text-amber-100">
            Hard-cap and exception details aren't shown for future seasons.
          </h3>
          <p className="mt-1 text-[11px] leading-snug text-amber-100/70">
            These numbers always reflect the {currentSeasonLabel} season. The
            cap table can show {selectedSeasonLabel} totals, but hard-cap,
            exception, and trade-exception details only apply to{' '}
            {currentSeasonLabel}. Switch back to the current season to see them.
          </p>
        </div>
      </section>
    );
  }

  const tradeExceptions = getTeamTpeList(teamCapSheet);

  // Use centralized cap settings provider for consistent cap/apron values
  // currentYear is the END year (e.g., 2025 for "2024-25" season)
  const capData = getCapSettingsForYear(currentYear);
  const hardCapStatus = getHardCapStatus(teamCapSheet, {
    capSettings: capData,
  });

  const mleException = getCanonicalExceptionAvailability(teamCapSheet, 'mle');
  const tpMleException = getCanonicalExceptionAvailability(teamCapSheet, 'tpmle');
  const baeException = getCanonicalExceptionAvailability(teamCapSheet, 'bae');
  const roomException = getCanonicalExceptionAvailability(teamCapSheet, 'room');

  // --- Logic for Availability & Hard Cap ---

  const tpMleUsedAmount = tpMleException.usedAmount;

  let mleRemaining = mleException.enabled ? mleException.remainingAmount : 0;
  let tpRemaining = tpMleException.enabled ? tpMleException.remainingAmount : 0;
  let baeRemaining = baeException.enabled ? baeException.remainingAmount : 0;
  let roomRemaining =
    roomException.enabled && roomExceptionEligibility.eligible
      ? roomException.remainingAmount
      : 0;

  let mleStatus = mleException.enabled ? null : 'N/A';
  let tpStatus = tpMleException.enabled ? null : 'N/A';
  let baeStatus = baeException.enabled ? null : 'N/A';
  let roomStatus =
    roomException.enabled && roomExceptionEligibility.eligible ? null : 'N/A';
  const usedTPMLE = tpMleUsedAmount > 0;
  const isFirstApronHardCap =
    hardCapStatus.hardCapCeilingType === HARD_CAP_TYPES.FIRST_APRON;
  const isSecondApronHardCap =
    hardCapStatus.hardCapCeilingType === HARD_CAP_TYPES.SECOND_APRON;

  if (isFirstApronHardCap) {
    tpRemaining = 0;
    tpStatus = 'N/A';
  } else if (usedTPMLE || isSecondApronHardCap) {
    mleRemaining = 0;
    baeRemaining = 0;
    mleStatus = 'N/A';
    baeStatus = 'N/A';
  }

  return (
    <section
      aria-label={surfaceLabel}
      className="space-y-1.5"
    >
      {/* Exception cards, TPEs, and hard-cap state explain roster-building
          tools for the current season. They do not recompute the cap table's
          selected-year totals. The banner is the whole default-view surface
          (BZE-216 hierarchy rework): hard-cap truth and the TPE count stay
          visible, and the card/TPE detail opens from the details toggle. */}
      <div
        data-testid="cap-sheet-current-season-authority-banner"
        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-sky-400/15 bg-sky-500/[0.05] px-3 py-1 text-sky-100"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300/80">
          Exceptions & Hard Cap
        </span>
        <span className="sr-only">
          Always reflect the {currentSeasonLabel} season, whatever season the
          cap table shows.
        </span>
        <HardCapCard
          hardCapStatus={hardCapStatus}
          hasApronData={Boolean(capData.firstApron || capData.secondApron)}
        />
        <span className="flex items-center gap-1.5 text-[10px] text-white/60">
          <span>Trade Exceptions</span>
          <span className="rounded bg-white/5 px-1.5 text-[9px] text-white/40 tabular-nums">
            {tradeExceptions.length}
          </span>
        </span>
        <span className="ml-auto flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] font-medium">
          <span className="rounded-full border border-sky-300/20 bg-sky-500/10 px-2 py-0.5 text-sky-100/90">
            Viewing: {selectedSeasonLabel}
          </span>
          <span className="rounded-full border border-sky-300/20 bg-sky-500/10 px-2 py-0.5 text-sky-100/90">
            Current season: {currentSeasonLabel}
          </span>
          <button
            data-testid="cap-sheet-exceptions-details-toggle"
            type="button"
            aria-expanded={showExceptionDetails}
            onClick={() => setShowExceptionDetails(!showExceptionDetails)}
            className="rounded border border-sky-300/25 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-100 transition-colors hover:bg-sky-500/20"
          >
            {showExceptionDetails ? 'Hide' : 'Show'} details
          </button>
        </span>
      </div>

      {showExceptionDetails && (
        <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-[repeat(4,minmax(118px,1fr))_minmax(200px,1.3fr)]">
          <ExceptionCard
            label="NT-MLE"
            amount={mleRemaining}
            subtext="Non-Taxpayer"
            color={mleRemaining > 0 ? 'blue' : 'gray'}
            statusLabel={mleStatus}
          />
          <ExceptionCard
            label="TP-MLE"
            amount={tpRemaining}
            subtext="Taxpayer"
            color={tpRemaining > 0 ? 'green' : 'gray'}
            statusLabel={tpStatus}
          />
          <ExceptionCard
            label="BAE"
            amount={baeRemaining}
            subtext="Bi-Annual"
            color={baeRemaining > 0 ? 'orange' : 'gray'}
            statusLabel={baeStatus}
          />
          <ExceptionCard
            label="ROOM"
            amount={roomRemaining}
            subtext="Under-Cap"
            color={roomRemaining > 0 ? 'blue' : 'gray'}
            statusLabel={roomStatus}
          />

          {/* Trade Exceptions compact list shares the row with the cards. */}
          <div className="col-span-2 flex flex-col rounded-md border border-white/5 bg-[#0f0f0f] px-3 py-1.5 lg:col-span-1">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/50">
                <BadgeAlert size={12} className="text-purple-400" />
                Trade Exception Detail
              </h3>
              <span className="rounded bg-white/5 px-1.5 text-[9px] text-white/30">
                {tradeExceptions.length}
              </span>
            </div>

            <div className="max-h-16 flex-1 overflow-auto">
              {tradeExceptions.length === 0 ? (
                <div className="py-2 text-center text-[10px] text-white/20">
                  No Active TPEs
                </div>
              ) : (
                <div className="flex flex-col">
                  {tradeExceptions.map((tpe, idx) => (
                    <CompactTradeExceptionRow key={idx} tpe={tpe} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

