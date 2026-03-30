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
      className={`relative rounded-md border px-3 py-2 flex flex-col justify-between transition-all group ${colorStyles[color]}`}
    >
      <div className="flex justify-between items-start mb-0.5">
        <span className="text-[9px] uppercase tracking-widest font-bold opacity-70">
          {label}
        </span>
        {statusLabel && (
          <span className="text-[8px] uppercase tracking-wider font-bold opacity-50 border border-current px-1 rounded-sm">
            {statusLabel}
          </span>
        )}
      </div>
      <div className="text-sm font-bold tracking-tight text-white/90 tabular-nums">
        ${amount.toLocaleString()}
      </div>
      {subtext && (
        <div className="text-[9px] opacity-50 group-hover:opacity-80 transition-opacity">
          {subtext}
        </div>
      )}
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
      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-white/5 bg-white/[0.02] text-white/40">
        <ShieldAlert size={14} />
        <span className="text-[10px] uppercase tracking-wider font-semibold">
          No Hard Cap Active
        </span>
      </div>
    );

  return (
    <div className="flex flex-col gap-1 px-3 py-2 rounded-md border border-red-500/20 bg-red-500/5 text-red-400">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} className="text-red-500" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest font-bold text-red-100">
              Hard Capped
            </span>
            {ceilingLabel && (
              <span className="text-[8px] uppercase tracking-widest text-red-300/70">
                {ceilingLabel}
              </span>
            )}
          </div>
        </div>
        <span className="text-xs font-bold tabular-nums text-red-100">
          {limitAmount !== null ? `$${limitAmount.toLocaleString()}` : '—'}
        </span>
      </div>
      <div className="text-[9px] text-red-400/70 pl-6 leading-tight max-w-[200px]">
        {description}
      </div>
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
    <div className="grid grid-cols-[80px_1fr_auto] gap-3 items-center py-2 px-3 border-b border-white/5 last:border-0 hover:bg-white/[0.04] transition-all group relative overflow-hidden">
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

const ExceptionTracker = ({
  teamCapSheet,
  currentYear,
  selectedYear = currentYear,
}: ExceptionTrackerProps) => {
  const isViewingCurrentYear = selectedYear === currentYear;

  if (!isViewingCurrentYear) {
    return (
      <section
        aria-label="Cap sheet adjacent exception presentation surface"
        className="mt-4"
      >
        <div
          data-testid="cap-sheet-future-year-boundary-panel"
          className="rounded-md border border-amber-400/20 bg-amber-500/5 px-4 py-4 text-amber-100"
        >
          <div className="text-[10px] uppercase tracking-[0.25em] text-amber-300/80">
            Current-Season Only
          </div>
          <h3 className="mt-2 text-sm font-semibold text-amber-100">
            Hard-cap, exception, and trade-exception truth stays on the
            current season.
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-amber-100/70">
            This tab can show {formatSeasonLabel(selectedYear)} totals, but
            hard-cap, exception, and TPE state is only authoritative for{' '}
            {formatSeasonLabel(currentYear)}. Switch back to the current season
            to view the live hard-cap and exception surface.
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
  const roomExceptionEligibility = React.useMemo(() => {
    if (!teamCapSheet || !currentYear) {
      return { eligible: false, reason: 'Missing team data' };
    }
    return canUseRoomException(teamCapSheet, currentYear);
  }, [teamCapSheet, currentYear]);

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
      aria-label="Cap sheet adjacent exception presentation surface"
      className="mt-4 grid grid-cols-1 lg:grid-cols-[1.2fr,1fr] gap-4"
    >
      {/* ADJACENT PRESENTATION SURFACE: Exception cards, TPEs, and hard-cap
          state may explain roster-building tools, but they do not own or
          recompute canonical current-year cap totals. */}
      {/* Left Column: Exceptions & Hard Cap Info */}
      <div className="flex flex-col gap-3">
        {/* Hard Cap Section */}
        <HardCapCard
          hardCapStatus={hardCapStatus}
          hasApronData={Boolean(capData.firstApron || capData.secondApron)}
        />

        {/* Exception Stats Grid */}
        <div className="grid grid-cols-4 gap-2">
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
        </div>
      </div>

      {/* Right Column: Trade Exceptions Compact List */}
      <div className="bg-[#0f0f0f] border border-white/5 rounded-md p-3 flex flex-col h-full min-h-[140px]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-bold text-white/50 tracking-widest uppercase flex items-center gap-1.5">
            <BadgeAlert size={12} className="text-purple-400" />
            Trade Exceptions
          </h3>
          <span className="bg-white/5 text-white/30 px-1.5 rounded text-[9px]">
            {tradeExceptions.length}
          </span>
        </div>

        <div className="flex-1 overflow-visible">
          {tradeExceptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/20 py-4">
              <span className="text-[10px]">No Active TPEs</span>
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
    </section>
  );
};

export default ExceptionTracker;
