/**
 * PURPOSE: Selected-year cap sheet grid for Architect teams, now annotated with player rules profiles.
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2025-12-10: Added PlayerRulesProfile-driven annotations (chunk_01).
 *  - 2025-12-14: Refactored to use shared cap holds utility functions.
 *  - 2026-03-14: Migrated authoritative implementation to TypeScript for E88.
 *
 * LINKS:
 *  - Plan: plans/player-rules-architect/plan.md
 *  - Latest Chunk: plans/player-rules-architect/chunks/chunk_01.md
 */
import React, { useEffect, useState } from 'react';
import type {
  PlayerRulesProfile,
  PlayerRulesProfileInput,
  PlayerRulesProfileTeamCapSheet,
} from '@/features/architect/types';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import {
  getContractYearSlice,
  getPlayerCapHitForYear,
  isTwoWayContract,
} from '@/features/architect/utils/contractUtils';
import { getActiveUnsignedCapHoldsByEndYear, type CapHold } from '@/features/architect/utils/capHolds';
import CapSummaryTiles from './CapSummaryTiles';
import { POSITION_MAP } from '@/shared/utils/roles';
import getCapPercentage from '@/features/architect/utils/basicArchitectUtils';
import { usePlayerRulesProfiles } from '@/features/architect/hooks/usePlayerRulesProfiles';
import ManageDeadMoneyModal from '@/features/architect/capSheet/modals/ManageDeadMoneyModal';
import ManageExceptionsModal from '@/features/architect/capSheet/modals/ManageExceptionsModal';

type NumericLike = number | string | null | undefined;
type RulesProfileLike = PlayerRulesProfile | null;
type CapSheetPlayerLike = PlayerRulesProfileInput;
type CapHoldLike = {
  playerId?: string | number | null;
  season?: string | null;
  type?: string | null;
  amount?: NumericLike;
  reason?: string | null;
  playerName?: string | null;
};
type DeadCapAmountByYearArrayEntry = {
  season?: string | null;
  amount?: NumericLike;
  isStretched?: boolean;
};
type DeadCapAmountByYearObjectValue =
  | NumericLike
  | { amount?: NumericLike };
type DeadCapSourceEntry = {
  playerId?: string | null;
  playerName?: string | null;
  label?: string | null;
  amountByYear?:
    | DeadCapAmountByYearArrayEntry[]
    | Record<string, DeadCapAmountByYearObjectValue>
    | null;
  stretched?: boolean;
};
type TeamCapSheetLike = PlayerRulesProfileTeamCapSheet & {
  players?: CapSheetPlayerLike[] | null;
  deadCap?: DeadCapSourceEntry[] | null;
};
type ManualDeadCapSavePayloadEntry = {
  id?: string | null;
  playerId?: string | number | null;
  playerName?: string | null;
  label?: string | null;
  originalSalary?: NumericLike;
  amountByYear?: Array<{
    season: string;
    amount: number;
    isStretched?: boolean;
  }> | null;
  waiveDate?: string | null;
  notes?: string | null;
  stretched?: boolean | null;
};
type ManualDeadCapSavePayload = ManualDeadCapSavePayloadEntry[];
type ManualExceptionEntry = {
  type?: string | null;
  enabled?: boolean | null;
  available?: boolean | null;
  totalAmount?: number | null;
  maxAmount?: number | null;
  amount?: number | null;
  usedAmount?: number | null;
  remainingAmount?: number | null;
  createdFrom?: string | null;
  createdOn?: string | null;
  expiresOn?: string | null;
  notes?: string | null;
  seasonKey?: string | null;
  lastUsedAt?: string | null;
};
type ManualTradeExceptionEntry = {
  id: string;
  totalAmount?: number | null;
  usedAmount?: number | null;
  remainingAmount?: number | null;
  createdFrom?: string | null;
  createdOn?: string | null;
  expiresOn?: string | null;
  notes?: string | null;
};
type ManualExceptionsSavePayload = {
  mle?: ManualExceptionEntry | null;
  taxpayerMle?: ManualExceptionEntry | null;
  tpmle?: ManualExceptionEntry | null;
  room?: ManualExceptionEntry | null;
  bae?: ManualExceptionEntry | null;
  dpe?: ManualExceptionEntry | null;
  tpe?: ManualTradeExceptionEntry[];
} & Record<string, unknown>;
export type ManualCapSheetMutationAuthority = {
  handleSetDeadCap: (deadCap: ManualDeadCapSavePayload) => Promise<boolean>;
  handleSetExceptions: (
    exceptions: ManualExceptionsSavePayload
  ) => Promise<boolean>;
};
type CapSheetProps = {
  teamCapSheet?: TeamCapSheetLike | null;
  currentYear: number;
  selectedYear?: number | null;
  onSelectedYearChange?: ((year: number) => void) | null;
  onOpenPlayerContractModal?: ((player: CapSheetPlayerLike) => void) | null;
  // Legacy alias kept temporarily so older tests/helpers do not silently break.
  onSelectPlayer?: ((player: CapSheetPlayerLike) => void) | null;
  manualCapSheetMutationAuthority?: ManualCapSheetMutationAuthority | null;
};

const CAP_SHEET_SURFACE_LABELS = {
  canonicalTotalsSummary: 'Selected-year canonical totals summary surface',
  rosterDetail: 'Selected-year roster detail surface',
  capHoldsDetail: 'Selected-year cap holds detail surface',
  canonicalTotalsBreakdown: 'Selected-year canonical totals breakdown surface',
} as const;

const CapSheet = ({
  teamCapSheet,
  currentYear,
  selectedYear: controlledSelectedYear = null,
  onSelectedYearChange = null,
  onOpenPlayerContractModal,
  onSelectPlayer,
  manualCapSheetMutationAuthority,
}: CapSheetProps) => {
  const [internalSelectedYear, setInternalSelectedYear] = useState(currentYear);
  const [showCapHolds, setShowCapHolds] = useState(false);
  const [showDeadMoneyModal, setShowDeadMoneyModal] = useState(false);
  const [showExceptionsModal, setShowExceptionsModal] = useState(false);
  const hasManualCapSheetMutationAuthority =
    !!manualCapSheetMutationAuthority;
  const openPlayerContractModal =
    onOpenPlayerContractModal ?? onSelectPlayer ?? null;
  const hasControlledSelectedYear = Number.isFinite(controlledSelectedYear);
  const selectedYear = hasControlledSelectedYear
    ? Number(controlledSelectedYear)
    : internalSelectedYear;
  const isViewingCurrentYear = selectedYear === currentYear;
  const canManageExceptions =
    hasManualCapSheetMutationAuthority && isViewingCurrentYear;

  useEffect(() => {
    if (!hasControlledSelectedYear) {
      setInternalSelectedYear(currentYear);
    }
  }, [currentYear, hasControlledSelectedYear]);

  useEffect(() => {
    if (showExceptionsModal && !isViewingCurrentYear) {
      setShowExceptionsModal(false);
    }
  }, [isViewingCurrentYear, showExceptionsModal]);

  const handleSelectYear = React.useCallback(
    (year: number) => {
      if (!hasControlledSelectedYear) {
        setInternalSelectedYear(year);
      }
      onSelectedYearChange?.(year);
    },
    [hasControlledSelectedYear, onSelectedYearChange]
  );

  const { getProfile } = usePlayerRulesProfiles({
    players: teamCapSheet?.players || [],
    teamCapSheet,
    currentYear: selectedYear,
    teamCode: teamCapSheet?.teamCode,
  });

  // SINGLE SOURCE OF TRUTH: Compute canonical totals once for the entire surface
  const canonicalTotals = React.useMemo(
    () => computeTeamCapTotals(
      teamCapSheet ? { ...teamCapSheet, players: teamCapSheet.players?.map(p => ({ ...p })) } : null,
      selectedYear
    ),
    [teamCapSheet, selectedYear]
  );

  if (!teamCapSheet) {
    return <div className="text-white/60 p-4">Loading cap sheet...</div>;
  }

  if (!teamCapSheet.players) {
    return <div className="text-white/60 p-4">Loading players...</div>;
  }

  const generateYears = (startYear: number, count: number) =>
    Array.from({ length: count }, (_, i) => startYear + i);

  const allYears = generateYears(currentYear, 7);

  const formatYearLabel = (year: number) =>
    `${year - 1}-${String(year % 100).padStart(2, '0')}`;

  const renderNotes = (
    player: CapSheetPlayerLike,
    yearKey: number,
    rulesProfile: RulesProfileLike
  ) => {
    const slice = getContractYearSlice(player, yearKey);
    const option = slice?.option || null;
    const isPO = option === 'Player Option' || option === 'PO';
    const isTO = option === 'Team Option' || option === 'TO';
    const isNG = slice && slice.guaranteed === false;
    const isTwoWay = isTwoWayContract(player);

    const notes: Array<{
      label: string;
      className?: string;
      title?: string;
    }> = [];
    if (isTwoWay)
      notes.push({
        label: '2W',
        className: 'bg-white/5 border-white/20 text-white/50',
      });
    if (isPO)
      notes.push({
        label: 'PO',
        className: 'bg-green-500/10 border-green-500/30 text-green-300',
      });
    if (isTO)
      notes.push({
        label: 'TO',
        className: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
      });
    if (player.isMinimum && Number(player.yearsOfService) >= 3)
      notes.push({ label: 'Vet Min' });
    if (isNG) notes.push({ label: 'NG' });
    if (rulesProfile?.extensionEligibility) {
      const { isEligible, reason, eligibleDate } =
        rulesProfile.extensionEligibility;
      const eligibleYear = eligibleDate
        ? new Date(eligibleDate).getFullYear()
        : null;
      const extLabel = eligibleYear
        ? `EXT '${String(eligibleYear % 100).padStart(2, '0')}`
        : 'EXT';
      notes.push({
        label: extLabel,
        className: isEligible
          ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200'
          : 'bg-amber-500/10 border-amber-500/30 text-amber-200',
        title:
          (isEligible
            ? 'Extension eligible'
            : reason || 'Not extension eligible') +
          (eligibleYear
            ? ` (eligible ${eligibleYear - 1}-${String(eligibleYear % 100).padStart(2, '0')})`
            : ''),
      });
    }

    return (
      <span className="flex flex-wrap gap-1.5 justify-end">
        {notes.map((note, i) => (
          <span
            key={i}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/5 text-white/50 border border-white/10 ${
              note.className || ''
            }`}
            title={note.title}
          >
            {note.label}
          </span>
        ))}
      </span>
    );
  };

  const filteredPlayers = teamCapSheet.players
    .filter((p) => getContractYearSlice(p, selectedYear))
    .sort((a, b) => {
      const aSlice = getContractYearSlice(a, selectedYear);
      const bSlice = getContractYearSlice(b, selectedYear);
      const aSalary = aSlice?.salary ?? aSlice?.capHit ?? 0;
      const bSalary = bSlice?.salary ?? bSlice?.capHit ?? 0;
      return bSalary - aSalary;
    });

  // Get cap holds from teamCapSheet.capHolds (canonical source), filter by selected year
  // Using shared utility - selectedYear is the END year (e.g., 2025 for "2024-25")
  const displayedCapHolds = getActiveUnsignedCapHoldsByEndYear(
    (teamCapSheet.capHolds || []) as CapHold[],
    selectedYear
  ).sort((a, b) => (Number(b.amount || 0) || 0) - (Number(a.amount || 0) || 0));

  const confidenceLabel = React.useMemo(() => {
    const summary = canonicalTotals?._meta?.rulesSourcesSummary;
    if (!summary) return null; // Fallback or loading state

    // Detailed mapping for display
    switch (summary) {
      case 'real':
        return {
          text: 'Official',
          className: 'text-green-400 bg-green-400/10 border-green-400/20',
        };
      case 'reported':
        return {
          text: 'Reported',
          className: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
        };
      case 'projected':
        return {
          text: 'Projected',
          className: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
        };
      case 'unknown':
        return {
          text: 'Unknown',
          className: 'text-red-400 bg-red-400/10 border-red-400/20',
        };
      default:
        return {
          text: String(summary),
          className: 'text-white/40 bg-white/5 border-white/10',
        };
    }
  }, [canonicalTotals]);

  const handleSaveDeadCapEdit = React.useCallback(
    (deadCap: ManualDeadCapSavePayload) => {
      if (!manualCapSheetMutationAuthority) {
        return Promise.resolve(false);
      }
      return manualCapSheetMutationAuthority.handleSetDeadCap(deadCap);
    },
    [manualCapSheetMutationAuthority]
  );

  const handleSaveExceptionsEdit = React.useCallback(
    (exceptions: ManualExceptionsSavePayload) => {
      if (!manualCapSheetMutationAuthority) {
        return Promise.resolve(false);
      }
      return manualCapSheetMutationAuthority.handleSetExceptions(exceptions);
    },
    [manualCapSheetMutationAuthority]
  );

  return (
    <div className="text-white font-sans">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold tracking-tight text-white/90 flex items-center gap-2">
          <span>
            Cap Sheet <span className="text-white/40 font-light">|</span>{' '}
            {formatYearLabel(selectedYear)}
          </span>
          {confidenceLabel && (
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${confidenceLabel.className}`}
            >
              {confidenceLabel.text}
            </span>
          )}
        </h3>

        {/* Year Selector */}
        <div className="flex bg-[#0f0f0f] p-0.5 rounded-md border border-white/5">
          {allYears.map((year) => (
            <button
              key={year}
              onClick={() => handleSelectYear(year)}
              className={`px-3 py-1 rounded text-[10px] font-medium transition-all duration-200 ${
                year === selectedYear
                  ? 'bg-white text-black shadow-sm'
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              {formatYearLabel(year)}
            </button>
          ))}
        </div>
      </div>

      {/* CANONICAL TOTALS CONSUMER SURFACE: Summary tiles read canonicalTotals directly. */}
      <div data-surface-role="canonical-totals-summary">
        <CapSummaryTiles
          teamCapSheet={teamCapSheet}
          currentYear={currentYear}
          selectedYear={selectedYear}
          canonicalTotals={canonicalTotals}
          surfaceLabel={CAP_SHEET_SURFACE_LABELS.canonicalTotalsSummary}
        />
      </div>

      <section
        aria-label={CAP_SHEET_SURFACE_LABELS.rosterDetail}
        className="mt-4 bg-[#0f0f0f] border border-white/5 rounded-lg overflow-hidden shadow-2xl shadow-black/50"
      >
        {/* SUPPORTING DETAIL SURFACE: Player rows explain year-by-year contract detail.
            They may borrow canonical thresholds for display, but they do not own totals truth. */}
        <div className="px-4 py-2 border-b border-white/5 bg-white/[0.03]">
          <p className="text-[10px] text-white/40 leading-relaxed">
            Player rows show player salaries only. Total Cap Hit also includes
            dead money, cap holds, and incomplete roster charges when present.
          </p>
        </div>

        {/* Roster detail table header */}
        <div className="grid grid-cols-[2fr,0.8fr,0.6fr,1.2fr,0.8fr,1.2fr,1.5fr] gap-2 px-4 py-2 bg-white/5 border-b border-white/5 text-[10px] uppercase tracking-wider font-semibold text-white/40">
          <div>Player</div>
          <div>Pos</div>
          <div>Age</div>
          <div className="text-right">Cap Hit</div>
          <div className="text-right">Cap %</div>
          <div className="text-right">Base Salary</div>
          <div>Notes</div>
        </div>

        {/* Supporting detail rows */}
        <div className="divide-y divide-white/5">
          {filteredPlayers.map((player, idx) => {
            const slice = getContractYearSlice(player, selectedYear);
            const salary = slice?.salary ?? slice?.capHit ?? 0;
            const capHit = getPlayerCapHitForYear(player, selectedYear);
            const isExtensionSeason = slice?.isExtensionSeason;
            const rulesProfile = getProfile(player);

            const age = player.age ?? '-';
            const position = player.position ?? '-';
            // Use canonicalTotals.salaryCap (SSOT) for cap % to match totals display
            const capPct = getCapPercentage(capHit, canonicalTotals.salaryCap || 1);
            const capPctDisplay = capPct ? `${capPct}%` : '—';

            return (
              <div
                key={`${player.name}-${idx}`}
                className="grid grid-cols-[2fr,0.8fr,0.6fr,1.2fr,0.8fr,1.2fr,1.5fr] gap-2 px-4 py-2 items-center hover:bg-white/[0.02] transition-colors group"
              >
                <div className="font-medium text-xs text-white/90 truncate">
                  <button
                    data-testid="cap-sheet-player-row-button"
                    onClick={() => openPlayerContractModal?.(player)}
                    className="hover:text-blue-400 transition-colors text-left truncate w-full"
                  >
                    {player.displayName ||
                      player.bio?.displayName ||
                      player.name}
                  </button>
                </div>
                <div className="text-[10px] text-white/50">
                  {POSITION_MAP[position as keyof typeof POSITION_MAP] ||
                    position ||
                    '—'}
                </div>
                <div className="text-[10px] text-white/50">{age}</div>
                <div className="text-xs font-medium text-right tabular-nums tracking-tight">
                  <span
                    className={`inline-flex items-center justify-end tabular-nums ${
                      isExtensionSeason
                        ? 'text-cyan-100 bg-cyan-500/10 border border-cyan-500/30 rounded px-2 py-1'
                        : 'text-white/90'
                    }`}
                  >
                    ${Number(capHit).toLocaleString()}
                  </span>
                </div>
                <div className="text-[10px] text-white/50 text-right tabular-nums">
                  {capPctDisplay}
                </div>
                <div className="text-[10px] text-right tabular-nums">
                  <span
                    className={`inline-flex items-center justify-end ${
                      isExtensionSeason ? 'text-cyan-100' : 'text-white/50'
                    }`}
                  >
                    ${Number(salary).toLocaleString()}
                  </span>
                </div>
                <div className="text-[10px]">
                  {renderNotes(player, selectedYear, rulesProfile)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Supporting detail, control rows, and canonical totals breakdown stay
            in one frame visually, but remain separated by ownership below. */}
        <div className="bg-white/[0.02] border-t border-white/5">
          {/* CANONICAL TOTALS CONSUMER SURFACE: These breakdown rows and the
              footer consume canonicalTotals directly and define the totals view. */}
          <section
            aria-label={CAP_SHEET_SURFACE_LABELS.canonicalTotalsBreakdown}
            className="border-b border-white/5"
          >
            <div className="px-4 py-3 border-b border-white/5 bg-white/[0.03] space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
                Total Cap Hit Breakdown
              </p>
              <p className="text-[10px] text-white/40 leading-relaxed">
                Player salaries from the table above plus non-player cap
                allocations roll into the total below.
              </p>
            </div>

            <div className="border-b border-white/5 bg-white/[0.01] px-4 py-2 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-white/50">
                <span>Player Salaries</span>
                <span className="tabular-nums">
                  ${canonicalTotals.playersTotal.toLocaleString()}
                </span>
              </div>
              {canonicalTotals.deadMoneyTotal > 0 && (
                <div className="flex items-center justify-between text-[10px] text-white/50">
                  <span>Dead Money</span>
                  <span className="tabular-nums">
                    ${canonicalTotals.deadMoneyTotal.toLocaleString()}
                  </span>
                </div>
              )}
              {canonicalTotals.capHoldsTotal > 0 && (
                <div className="flex items-center justify-between text-[10px] text-white/50">
                  <span>Cap Holds</span>
                  <span className="tabular-nums">
                    ${canonicalTotals.capHoldsTotal.toLocaleString()}
                  </span>
                </div>
              )}
              {canonicalTotals.incompleteChargesTotal > 0 && (
                <div
                  data-testid="incomplete-roster-charge-row"
                  className="flex items-center justify-between text-[10px] text-amber-400/80"
                >
                  <span>
                    Incomplete Roster Charge
                    {canonicalTotals._meta?.incompleteRosterCharge?.missingSlots && (
                      <span className="text-white/40 ml-1">
                        ({canonicalTotals._meta.incompleteRosterCharge.missingSlots}{' '}
                        open{' '}
                        {canonicalTotals._meta.incompleteRosterCharge.missingSlots ===
                        1
                          ? 'slot'
                          : 'slots'}
                        )
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums">
                    ${canonicalTotals.incompleteChargesTotal.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            <div className="px-4 py-3 flex items-center justify-between bg-white/[0.02]">
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                Total Cap Hit
              </span>
              <span className="text-lg font-bold text-white tabular-nums tracking-tight">
                ${canonicalTotals.totalCapAllocations.toLocaleString()}
              </span>
            </div>
          </section>

          {/* SUPPORTING DETAIL SURFACE: Cap holds detail explains the
              canonical capHoldsTotal without becoming a totals owner. */}
          {displayedCapHolds.length > 0 && (
            <section
              aria-label={CAP_SHEET_SURFACE_LABELS.capHoldsDetail}
              className="border-b border-white/5"
            >
              <button
                onClick={() => setShowCapHolds(!showCapHolds)}
                className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-medium text-white/40 hover:text-white hover:bg-white/5 transition-all"
              >
                <div className="flex flex-col items-start gap-1 text-left">
                  <div className="flex items-center gap-2">
                    <span>
                      {showCapHolds ? 'Hide' : 'Show'} Cap Hold Details
                    </span>
                    <span className="bg-white/10 px-1.5 py-0.5 rounded text-white/60">
                      {displayedCapHolds.length}
                    </span>
                  </div>
                  <span className="text-[9px] text-white/30">
                    Active cap holds are included in Total Cap Hit.
                  </span>
                </div>
                <span className="text-xs opacity-50">
                  {showCapHolds ? '−' : '+'}
                </span>
              </button>

              {showCapHolds && (
                <div className="bg-black/20 border-t border-white/5">
                  <div className="grid grid-cols-[2fr,1.2fr,3fr] gap-2 px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-white/30">
                    <div>Player</div>
                    <div>Amount</div>
                    <div>Reason</div>
                  </div>
                  <div className="divide-y divide-white/5">
                    {displayedCapHolds.map((h) => (
                      <div
                        key={`${h.playerId}-${h.season}-${h.type}`}
                        className="grid grid-cols-[2fr,1.2fr,3fr] gap-2 px-4 py-2 items-center hover:bg-white/[0.02]"
                      >
                        <div className="text-xs text-white/60">
                          {h.playerName || h.playerId}
                        </div>
                        <div className="text-xs text-white/40 tabular-nums">
                          ${Number(h.amount || 0).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-white/30">
                          {h.reason || h.type || ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* CONTROL SURFACE: These actions mutate canonical inputs, but do not
              own or redefine current-year totals display. */}
          <div
            data-testid="cap-sheet-control-surface"
            className="bg-white/[0.015] px-4 py-2 flex items-center justify-between gap-4"
          >
            <div className="min-h-[1rem]">
              {!isViewingCurrentYear && hasManualCapSheetMutationAuthority && (
                <span
                  data-testid="cap-sheet-future-year-exception-edit-boundary"
                  className="text-[10px] text-amber-300/80"
                >
                  Exception editing is only available for the current season.
                </span>
              )}
            </div>
            <div className="flex items-center justify-end gap-4">
              <button
                data-testid="cap-sheet-manage-exceptions-button"
                type="button"
                disabled={!canManageExceptions}
                title={
                  !hasManualCapSheetMutationAuthority
                    ? undefined
                    : !isViewingCurrentYear
                      ? 'Exception editing is only available for the current season.'
                      : undefined
                }
                onClick={() => {
                  if (!canManageExceptions) return;
                  setShowExceptionsModal(true);
                }}
                className={`text-[10px] font-medium transition-colors flex items-center gap-1 ${
                  canManageExceptions
                    ? 'text-white/40 hover:text-white'
                    : 'text-white/20 cursor-not-allowed'
                }`}
              >
                <span className="opacity-50">📋</span> Manage Exceptions
              </button>
              <button
                data-testid="cap-sheet-manage-dead-money-button"
                type="button"
                disabled={!hasManualCapSheetMutationAuthority}
                onClick={() => {
                  if (!hasManualCapSheetMutationAuthority) return;
                  setShowDeadMoneyModal(true);
                }}
                className={`text-[10px] font-medium transition-colors flex items-center gap-1 ${
                  hasManualCapSheetMutationAuthority
                    ? 'text-white/40 hover:text-white'
                    : 'text-white/20 cursor-not-allowed'
                }`}
              >
                <span className="opacity-50">⚙️</span> Manage Dead Money
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* Modals */}
      {showDeadMoneyModal && (
        <ManageDeadMoneyModal
          isOpen={showDeadMoneyModal}
          onClose={() => setShowDeadMoneyModal(false)}
          teamCapSheet={teamCapSheet}
          currentYear={selectedYear}
          onSave={handleSaveDeadCapEdit}
        />
      )}
      {showExceptionsModal && (
        <ManageExceptionsModal
          isOpen={showExceptionsModal}
          onClose={() => setShowExceptionsModal(false)}
          teamCapSheet={teamCapSheet}
          currentYear={currentYear}
          onSave={handleSaveExceptionsEdit}
        />
      )}
    </div>
  );
};

export default CapSheet;
