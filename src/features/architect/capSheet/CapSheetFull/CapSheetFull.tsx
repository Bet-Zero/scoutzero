/**
 * FILE: src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx
 * PURPOSE: Multi-year cap table view with option/FA actions and rules profile annotations.
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2025-12-10: Added PlayerRulesProfile indicators for multi-year cap view (chunk_02).
 *  - 2025-12-11: Updated bird rights display to use icons instead of text labels.
 *  - 2026-03-14: Migrated authoritative implementation to TypeScript for E88.
 *  - 2026-03-29: Clarified multi-year surface hierarchy between player rows, cap holds, and canonical yearly totals.
 */
import React, { useState, useMemo } from 'react';
import type {
  PlayerRulesProfile,
  PlayerRulesProfileInput,
  PlayerRulesProfileTeamCapSheet,
} from '@/features/architect/types';
import {
  getContractYearSlice,
  getPlayerCapSheetAmountsForYear,
  isTwoWayContract,
} from '@/features/architect/utils/contractUtils';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { computeDeadMoneyForYear } from '@/features/architect/utils/capTotals/deadMoneyForYear';
import { BirdRightsIcon } from '@/shared/components/BirdRightsIcon';
import { playerMatchesFocus } from '@/features/architect/GMDashboard/postActionHandoff/playerFocus';
import { ManageDeadMoneyModal } from '@/features/architect/capSheet/modals/ManageDeadMoneyModal';
import { ManageExceptionsModal } from '@/features/architect/capSheet/modals/ManageExceptionsModal';
import type { ManualCapSheetMutationAuthority } from '@/features/architect/capSheet/CapSheet/CapSheet';

type DeadCapSavePayload = Parameters<
  ManualCapSheetMutationAuthority['handleSetDeadCap']
>[0];
type ExceptionsSavePayload = Parameters<
  ManualCapSheetMutationAuthority['handleSetExceptions']
>[0];

type NumericLike = number | string | null | undefined;
type RulesProfileLike = PlayerRulesProfile | null;
type CapSheetFullPlayerLike = PlayerRulesProfileInput;
type CapHoldLike = {
  playerId?: string | number | null;
  playerName?: string | null;
  season?: string | null;
  amount?: NumericLike;
  type?: string | null;
  isSigned?: boolean | null;
};
type DeadCapEntryLike = {
  playerId?: string | number | null;
  playerName?: string | null;
  label?: string | null;
  notes?: string | null;
  amountByYear?: unknown;
};
type TeamCapSheetLike = PlayerRulesProfileTeamCapSheet & {
  players?: CapSheetFullPlayerLike[] | null;
};
type ContractYearSliceLike = ReturnType<typeof getContractYearSlice>;
type VisiblePlayerEntry = {
  player: CapSheetFullPlayerLike;
  currentYearSlice: ContractYearSliceLike;
  currentYearAmount: number;
  firstVisibleYear: number;
  firstVisibleAmount: number;
  originalIndex: number;
};

export type CapSheetActionType = 'rfa' | 'ufa' | 'po' | 'to' | 'renounce';
export type CapSheetModalActionType = Exclude<CapSheetActionType, 'renounce'>;
export type CapSheetImmediateActionType = Extract<
  CapSheetActionType,
  'renounce'
>;

type CapSheetFullProps = {
  teamCapSheet?: TeamCapSheetLike | null;
  currentYear: number;
  onOpenPlayerContractModal?:
    | ((player: CapSheetFullPlayerLike) => void)
    | null;
  onLaunchContractAction?:
    | ((
        player: CapSheetFullPlayerLike,
        action: CapSheetModalActionType,
        year: number
      ) => void)
    | null;
  onRenounceCapHold?: ((capHold: CapHoldLike) => void) | null;
  /**
   * Home-base enrichment: row-level launcher for waive/extend/stretch. Opens the
   * existing contract modal pre-seeded to the chosen action. Optional — when
   * omitted, no kebab renders (other call sites are unaffected).
   */
  onLaunchPlayerAction?:
    | ((
        player: CapSheetFullPlayerLike,
        action: 'waive' | 'extend' | 'stretch'
      ) => void)
    | null;
  // Legacy aliases kept temporarily while the live dashboard route migrates.
  onSelectPlayer?: ((player: CapSheetFullPlayerLike) => void) | null;
  onActionClick?:
    | ((
        item: CapSheetFullPlayerLike | CapHoldLike,
        action: CapSheetActionType,
        year?: number
      ) => void)
    | null;
  getRulesProfileForYear?:
    | ((player: CapSheetFullPlayerLike, year: number) => RulesProfileLike)
    | null;
  /**
   * Stage 2C: receipt-derived focused player id. The matching player
   * row (sticky name column + year cells) renders a non-mutating
   * "just changed" outline. Visual only.
   */
  highlightPlayerId?: string | null;
  /**
   * Home-base enrichment: when provided, the Full Cap Table surfaces the
   * existing current-season dead-money and exceptions controls. CapSheetFull
   * stays dumb — it only LAUNCHES the existing modals; all committed writes
   * still flow through this authority (useArchitectActions → mutationPipeline).
   */
  manualCapSheetMutationAuthority?: ManualCapSheetMutationAuthority | null;
  /**
   * Pre-rendered exceptions readout (e.g. ExceptionTracker). Passed as a node so
   * CapSheetFull never imports rules/cap-settings logic and the SSOT parity
   * guardrails stay intact.
   */
  exceptionsReadout?: React.ReactNode;
  /**
   * Home-base enrichment: launches the existing Free Agency desk so a user can
   * pull from the FA pool without leaving their cap workspace first. Navigation
   * only — the FA signing flow itself is unchanged.
   */
  onLaunchFreeAgentSearch?: (() => void) | null;
};

const CAP_SHEET_FULL_SURFACE_LABELS = {
  primary: 'Primary multi-year cap sheet surface',
  playerDetail: 'Multi-year player detail surface',
  canonicalYearlyTotals: 'Multi-year canonical yearly totals surface',
  capHoldsDetail: 'Multi-year cap holds detail surface',
} as const;

// Helper to normalize free agent type to display format
const normalizeFAType = (type: string | null | undefined): string | null => {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t === 'unrestricted' || t === 'ufa') return 'UFA';
  if (t === 'restricted' || t === 'rfa') return 'RFA';
  return type.toUpperCase();
};

// Color scheme for tags - matching chart style
const getTagColor = (type: string | null) => {
  if (type === 'UFA') return 'bg-blue-500/30 text-white/70';
  if (type === 'RFA') return 'bg-red-600/30 text-white/70';
  if (type === 'PO') return 'bg-green-600/30 text-white/70';
  if (type === 'TO') return 'bg-orange-500/30 text-white/70';
  if (type === 'TWO-WAY') return 'bg-white/10 text-white/60';
  return 'bg-gray-600 text-white/70';
};

const formatQOText = (amount: NumericLike) => {
  if (amount == null) return null;
  return `QO $${(Number(amount) / 1_000_000).toFixed(1)}M`;
};

const formatCapSheetMoney = (amount: NumericLike) =>
  `$${Number(amount ?? 0).toLocaleString()}`;

const formatSeasonLabel = (year: number) =>
  `${year - 1}-${String(year % 100).padStart(2, '0')}`;

const formatExtLabel = (year: number) =>
  `EXT '${String(year % 100).padStart(2, '0')}`;

const MIN_VISIBLE_YEARS = 7;

const toEndYear = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  const seasonMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (seasonMatch) return 2000 + Number(seasonMatch[2]);

  const numericYear = Number.parseInt(trimmed, 10);
  return /^\d{4}$/.test(trimmed) && Number.isFinite(numericYear)
    ? numericYear
    : null;
};

const collectDeadCapEndYears = (deadCapEntry: DeadCapEntryLike) => {
  const endYears: number[] = [];

  if (Array.isArray(deadCapEntry.amountByYear)) {
    for (const value of deadCapEntry.amountByYear) {
      if (!value || typeof value !== 'object') continue;
      const endYear = toEndYear((value as { season?: unknown }).season);
      if (endYear) endYears.push(endYear);
    }
  } else if (
    deadCapEntry.amountByYear &&
    typeof deadCapEntry.amountByYear === 'object'
  ) {
    for (const season of Object.keys(deadCapEntry.amountByYear)) {
      const endYear = toEndYear(season);
      if (endYear) endYears.push(endYear);
    }
  }

  return endYears;
};

const getDeadCapLabel = (deadCapEntry: DeadCapEntryLike) =>
  deadCapEntry.playerName ||
  deadCapEntry.label ||
  deadCapEntry.notes ||
  deadCapEntry.playerId ||
  'Dead money adjustment';

const getLatestVisibleEndYear = (
  teamCapSheet: TeamCapSheetLike,
  currentYear: number
) => {
  const candidateYears = [currentYear + MIN_VISIBLE_YEARS - 1];

  for (const player of teamCapSheet.players || []) {
    const contract = player.contract as
      | {
          endSeason?: unknown;
          salariesByYear?: unknown;
        }
      | null
      | undefined;
    const contractEndYear = toEndYear(contract?.endSeason);
    if (contractEndYear) candidateYears.push(contractEndYear);

    if (Array.isArray(contract?.salariesByYear)) {
      for (const salaryRow of contract.salariesByYear) {
        if (!salaryRow || typeof salaryRow !== 'object') continue;
        const row = salaryRow as { year?: unknown; season?: unknown };
        const salaryEndYear = toEndYear(row.year) ?? toEndYear(row.season);
        if (salaryEndYear) candidateYears.push(salaryEndYear);
      }
    }
  }

  for (const hold of (teamCapSheet.capHolds || []) as CapHoldLike[]) {
    const holdEndYear = toEndYear(hold.season);
    if (holdEndYear) candidateYears.push(holdEndYear);
  }

  if (Array.isArray(teamCapSheet.deadCap)) {
    for (const deadCapEntry of teamCapSheet.deadCap) {
      if (!deadCapEntry || typeof deadCapEntry !== 'object') continue;
      const entry = deadCapEntry as DeadCapEntryLike & {
        year?: unknown;
        yearKey?: unknown;
        season?: unknown;
      };
      const deadCapEndYear =
        toEndYear(entry.year) ??
        toEndYear(entry.yearKey) ??
        toEndYear(entry.season);
      if (deadCapEndYear) candidateYears.push(deadCapEndYear);
      candidateYears.push(...collectDeadCapEndYears(entry));
    }
  }

  return Math.max(...candidateYears);
};

const getExtensionEligibleYear = (rulesProfile: RulesProfileLike) => {
  const eligibleDate = rulesProfile?.extensionEligibility?.eligibleDate;
  if (!eligibleDate) return null;
  const d = new Date(eligibleDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.getFullYear();
};

type ContractAmountDisplayProps = {
  capHit: number;
  baseSalary: number;
  hasCapHitAdjustment: boolean;
  primaryClassName: string;
  secondaryClassName: string;
};

const ContractAmountDisplay = ({
  capHit,
  baseSalary,
  hasCapHitAdjustment,
  primaryClassName,
  secondaryClassName,
}: ContractAmountDisplayProps) => {
  if (!hasCapHitAdjustment) {
    return <span className={primaryClassName}>{formatCapSheetMoney(capHit)}</span>;
  }

  return (
    <span
      className="flex flex-col items-center leading-tight"
      title={`Cap hit counts as ${formatCapSheetMoney(capHit)}; base salary is ${formatCapSheetMoney(baseSalary)}.`}
    >
      <span className={primaryClassName}>{formatCapSheetMoney(capHit)}</span>
      <span className={secondaryClassName}>
        Base {formatCapSheetMoney(baseSalary)}
      </span>
    </span>
  );
};

export const CapSheetFull = ({
  teamCapSheet,
  currentYear,
  onOpenPlayerContractModal,
  onLaunchContractAction,
  onRenounceCapHold,
  onLaunchPlayerAction = null,
  onSelectPlayer,
  onActionClick,
  getRulesProfileForYear = null,
  highlightPlayerId = null,
  manualCapSheetMutationAuthority = null,
  exceptionsReadout = null,
  onLaunchFreeAgentSearch = null,
}: CapSheetFullProps) => {
  const [showCapHolds, setShowCapHolds] = useState(false);
  const [showDeadMoneyDetails, setShowDeadMoneyDetails] = useState(false);
  const [showExceptionsReadout, setShowExceptionsReadout] = useState(false);
  const [showDeadMoneyModal, setShowDeadMoneyModal] = useState(false);
  const [showExceptionsModal, setShowExceptionsModal] = useState(false);
  const [actionMenuIndex, setActionMenuIndex] = useState<number | null>(null);
  const hasManualCapSheetMutationAuthority = !!manualCapSheetMutationAuthority;
  const handleSaveDeadCapEdit = React.useCallback(
    (deadCap: DeadCapSavePayload) =>
      manualCapSheetMutationAuthority
        ? manualCapSheetMutationAuthority.handleSetDeadCap(deadCap)
        : Promise.resolve(false),
    [manualCapSheetMutationAuthority]
  );
  const handleSaveExceptionsEdit = React.useCallback(
    (exceptions: ExceptionsSavePayload) =>
      manualCapSheetMutationAuthority
        ? manualCapSheetMutationAuthority.handleSetExceptions(exceptions)
        : Promise.resolve(false),
    [manualCapSheetMutationAuthority]
  );
  const openPlayerContractModal =
    onOpenPlayerContractModal ?? onSelectPlayer ?? null;
  const launchContractAction =
    onLaunchContractAction ??
    ((player: CapSheetFullPlayerLike, action: CapSheetModalActionType, year: number) =>
      onActionClick?.(player, action, year));
  const renounceCapHold =
    onRenounceCapHold ??
    ((capHold: CapHoldLike) => onActionClick?.(capHold, 'renounce'));

  if (!teamCapSheet || !teamCapSheet.players) return null;

  const allYears = useMemo(() => {
    const latestVisibleEndYear = getLatestVisibleEndYear(
      teamCapSheet,
      currentYear
    );
    return Array.from(
      { length: latestVisibleEndYear - currentYear + 1 },
      (_, index) => currentYear + index
    );
  }, [currentYear, teamCapSheet]);
  const playerGridTemplate = useMemo(
    () => `200px repeat(${allYears.length}, minmax(100px, 1fr))`,
    [allYears.length]
  );
  const capHoldGridTemplate = useMemo(
    () => `140px 60px repeat(${allYears.length}, minmax(100px, 1fr))`,
    [allYears.length]
  );

  const sortedPlayers = useMemo(() => {
    const visiblePlayers = (teamCapSheet.players || [])
      .map((player, originalIndex): VisiblePlayerEntry | null => {
        const currentYearSlice = getContractYearSlice(player, currentYear);
        const currentYearAmount =
          Number(currentYearSlice?.salary ?? currentYearSlice?.capHit ?? 0) || 0;

        let firstVisibleYear: number | null = null;
        let firstVisibleAmount = 0;

        for (const year of allYears) {
          const yearSlice = getContractYearSlice(player, year);
          if (!yearSlice) continue;

          firstVisibleYear = year;
          firstVisibleAmount =
            Number(yearSlice.salary ?? yearSlice.capHit ?? 0) || 0;
          break;
        }

        if (firstVisibleYear == null) {
          return null;
        }

        return {
          player,
          currentYearSlice,
          currentYearAmount,
          firstVisibleYear,
          firstVisibleAmount,
          originalIndex,
        };
      })
      .filter((entry): entry is VisiblePlayerEntry => entry !== null);

    visiblePlayers.sort((a, b) => {
      const aHasCurrentYearSlice = Boolean(a.currentYearSlice);
      const bHasCurrentYearSlice = Boolean(b.currentYearSlice);

      if (aHasCurrentYearSlice !== bHasCurrentYearSlice) {
        return aHasCurrentYearSlice ? -1 : 1;
      }

      if (aHasCurrentYearSlice && bHasCurrentYearSlice) {
        const currentYearDelta = b.currentYearAmount - a.currentYearAmount;
        if (currentYearDelta !== 0) {
          return currentYearDelta;
        }

        return a.originalIndex - b.originalIndex;
      }

      const firstVisibleYearDelta = a.firstVisibleYear - b.firstVisibleYear;
      if (firstVisibleYearDelta !== 0) {
        return firstVisibleYearDelta;
      }

      const firstVisibleAmountDelta =
        b.firstVisibleAmount - a.firstVisibleAmount;
      if (firstVisibleAmountDelta !== 0) {
        return firstVisibleAmountDelta;
      }

      return a.originalIndex - b.originalIndex;
    });

    return visiblePlayers.map((entry) => entry.player);
  }, [teamCapSheet.players, currentYear, allYears]);

  // For the separate table below, likely show all active holds or just imminent ones?
  // Let's show all valid holds.
  const displayedCapHolds = ((teamCapSheet.capHolds || []) as CapHoldLike[]).filter(
    (h: CapHoldLike) => !h.isSigned
  );
  const displayedDeadMoney = (
    Array.isArray(teamCapSheet.deadCap) ? teamCapSheet.deadCap : []
  ) as DeadCapEntryLike[];

  // SSOT: Use computeTeamCapTotals for each year to include
  // players + dead money + cap holds + incomplete roster charges.
  // Replaces local reduce that missed dead money and incomplete charges.
  const yearTotalBreakdowns = useMemo(() => {
    const totals: Record<number, ReturnType<typeof computeTeamCapTotals>> = {};
    for (const year of allYears) {
      totals[year] = computeTeamCapTotals(
        teamCapSheet
          ? { ...teamCapSheet, players: teamCapSheet.players?.map(p => ({ ...p })) }
          : null,
        year
      );
    }
    return totals;
  }, [teamCapSheet, allYears]);
  const hasIncompleteCharges = allYears.some(
    (year) => yearTotalBreakdowns[year].incompleteChargesTotal > 0
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col font-sans text-cockpit-text-primary">
      <section
        aria-label={CAP_SHEET_FULL_SURFACE_LABELS.primary}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-cockpit-edge bg-cockpit-inlay shadow-cockpit-slab">
          {/* COMPACT TOOLBAR: a single dense row — the room header already names
              the surface, so we don't repeat a title. Reclaims vertical space so
              the table itself owns the screen. */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-cockpit-edge bg-cockpit-bar px-3 py-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-cockpit-text-muted">
              Multi-Year · current season {formatSeasonLabel(currentYear)}
            </span>
            {(hasManualCapSheetMutationAuthority || onLaunchFreeAgentSearch) && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  data-testid="cap-sheet-full-manage-dead-money-button"
                  type="button"
                  disabled={!hasManualCapSheetMutationAuthority}
                  onClick={() => {
                    if (!hasManualCapSheetMutationAuthority) return;
                    setShowDeadMoneyModal(true);
                  }}
                  className={`rounded border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    hasManualCapSheetMutationAuthority
                      ? 'border-cockpit-edge bg-cockpit-slab text-cockpit-text-secondary hover:bg-cockpit-raised hover:text-cockpit-text-primary'
                      : 'cursor-not-allowed border-cockpit-edge text-cockpit-text-ghost'
                  }`}
                >
                  Manage Dead Money
                </button>
                <button
                  data-testid="cap-sheet-full-manage-exceptions-button"
                  type="button"
                  disabled={!hasManualCapSheetMutationAuthority}
                  onClick={() => {
                    if (!hasManualCapSheetMutationAuthority) return;
                    setShowExceptionsModal(true);
                  }}
                  className={`rounded border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    hasManualCapSheetMutationAuthority
                      ? 'border-cockpit-edge bg-cockpit-slab text-cockpit-text-secondary hover:bg-cockpit-raised hover:text-cockpit-text-primary'
                      : 'cursor-not-allowed border-cockpit-edge text-cockpit-text-ghost'
                  }`}
                >
                  Manage Exceptions
                </button>
                {onLaunchFreeAgentSearch ? (
                  <button
                    data-testid="cap-sheet-full-sign-free-agent-button"
                    type="button"
                    onClick={() => onLaunchFreeAgentSearch()}
                    className="rounded border border-cockpit-safe/30 bg-cockpit-safe/10 px-2.5 py-1 text-[11px] font-medium text-cockpit-safe transition-colors hover:bg-cockpit-safe/20"
                  >
                    Sign Free Agent
                  </button>
                ) : null}
              </div>
            )}
          </div>

          {/* PLAYER DETAIL: fills the remaining height and scrolls internally
              with a sticky column header (top) and a sticky canonical Total Cap
              footer (bottom), so the totals are always visible. */}
          <section
            aria-label={CAP_SHEET_FULL_SURFACE_LABELS.playerDetail}
            className="flex min-h-0 flex-1 flex-col"
          >
            <p className="sr-only">
              Player rows show season-by-season contract detail only. Total Cap
              is the canonical yearly cap total and can also include cap holds,
              dead money, and incomplete roster charges.
            </p>
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="min-w-full">
                {/* Header (sticky top) */}
                <div
                  className="sticky top-0 z-20 grid border-b border-cockpit-edge bg-cockpit-bar"
                  style={{ gridTemplateColumns: playerGridTemplate }}
                >
                  <div className="sticky left-0 z-30 bg-cockpit-slab px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-cockpit-text-muted border-r border-cockpit-edge shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
                    Player
                  </div>
                  {allYears.map((year) => (
                    <div
                      key={year}
                      className="px-2 py-2 text-center text-[10px] uppercase tracking-wider font-semibold text-cockpit-text-muted"
                    >
                      {year - 1}-{String(year % 100).padStart(2, '0')}
                    </div>
                  ))}
                </div>

                {/* Rows */}
                <div className="divide-y divide-white/5">
                  {sortedPlayers.map((player, idx) => {
                    const isTwoWay = isTwoWayContract(player);
                    const profileForCurrentYear =
                      getRulesProfileForYear?.(player, currentYear) || null;
                    const extensionEligibleYear = getExtensionEligibleYear(
                      profileForCurrentYear
                    );
                    const isRowHighlighted = playerMatchesFocus(
                      player,
                      highlightPlayerId
                    );
                    return (
                      <div
                        key={idx}
                        className={`grid transition-colors group ${
                          isRowHighlighted
                            ? 'ring-1 ring-inset ring-green-400/40 bg-green-500/[0.04]'
                            : 'hover:bg-white/[0.02]'
                        } ${isTwoWay ? 'opacity-70' : ''}`}
                        style={{ gridTemplateColumns: playerGridTemplate }}
                        data-testid={
                          isRowHighlighted
                            ? 'cap-sheet-full-player-row-highlighted'
                            : undefined
                        }
                      >
                        {/* Player Name (Sticky) */}
                        <div className="sticky left-0 z-10 flex h-[26px] items-center gap-2 border-r border-cockpit-edge bg-cockpit-inlay px-4 py-2 shadow-[4px_0_24px_rgba(0,0,0,0.4)] transition-colors group-hover:bg-cockpit-slab">
                          <button
                            data-testid="cap-sheet-full-player-row-button"
                            onClick={() => openPlayerContractModal?.(player)}
                            className="text-xs font-medium text-cockpit-text-primary hover:text-blue-400 transition-colors text-left truncate flex-1"
                          >
                            {player.displayName ||
                              player.bio?.displayName ||
                              player.name}
                          </button>
                          {isTwoWay && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shrink-0 ${getTagColor('TWO-WAY')}`}
                            >
                              2W
                            </span>
                          )}
                          {onLaunchPlayerAction ? (
                            <div
                              className="relative shrink-0"
                              onBlur={(e) => {
                                if (
                                  !e.currentTarget.contains(
                                    e.relatedTarget as Node | null
                                  )
                                ) {
                                  setActionMenuIndex((current) =>
                                    current === idx ? null : current
                                  );
                                }
                              }}
                            >
                              <button
                                type="button"
                                data-testid="cap-sheet-full-player-row-kebab"
                                aria-label={`Contract actions for ${
                                  player.displayName ||
                                  player.bio?.displayName ||
                                  player.name
                                }`}
                                aria-haspopup="menu"
                                aria-expanded={actionMenuIndex === idx}
                                onClick={() =>
                                  setActionMenuIndex((current) =>
                                    current === idx ? null : idx
                                  )
                                }
                                className="flex h-5 w-5 items-center justify-center rounded text-white/30 opacity-0 transition-opacity hover:bg-white/10 hover:text-white/80 group-hover:opacity-100 focus-visible:opacity-100"
                              >
                                <span aria-hidden className="text-sm leading-none">
                                  ⋯
                                </span>
                              </button>
                              {actionMenuIndex === idx ? (
                                <div
                                  role="menu"
                                  data-testid="cap-sheet-full-player-row-action-menu"
                                  className="absolute left-0 top-6 z-20 min-w-[120px] overflow-hidden rounded-md border border-cockpit-edge bg-cockpit-slab py-1 shadow-xl"
                                >
                                  {(
                                    [
                                      ['extend', 'Extend'],
                                      ['waive', 'Waive'],
                                      ['stretch', 'Stretch'],
                                    ] as const
                                  ).map(([action, label]) => (
                                    <button
                                      key={action}
                                      type="button"
                                      role="menuitem"
                                      data-testid={`cap-sheet-full-player-row-action-${action}`}
                                      onClick={() => {
                                        setActionMenuIndex(null);
                                        onLaunchPlayerAction?.(player, action);
                                      }}
                                      className="block w-full px-3 py-1.5 text-left text-[11px] text-white/70 hover:bg-white/10 hover:text-white"
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        {/* Years */}
                        {allYears.map((year) => {
                          const rowAmounts = getPlayerCapSheetAmountsForYear(
                            player,
                            year
                          );
                          const entry = rowAmounts.contractSlice;
                          const freeAgency =
                            player.futureContract?.freeAgency ||
                            player.contract?.freeAgency ||
                            {};
                          const fallbackFaYear =
                            typeof freeAgency === 'object' && freeAgency !== null
                              ? freeAgency.year
                              : undefined;
                          const fallbackFaType = normalizeFAType(
                            typeof freeAgency === 'object' && freeAgency !== null
                              ? freeAgency.type
                              : undefined
                          );
                          const rulesProfileForYear =
                            getRulesProfileForYear?.(player, year) || null;
                          const rfaInfo =
                            rulesProfileForYear?.restrictedFreeAgency;
                          const birdRightsTypeForYear =
                            rulesProfileForYear?.birdRights?.type;
                          const derivedFaYear =
                            rulesProfileForYear?.contractSummary?.freeAgencyYear ??
                            fallbackFaYear;
                          const derivedFaTypeRaw =
                            rulesProfileForYear?.contractSummary?.freeAgencyType ||
                            fallbackFaType;
                          const derivedFaType =
                            normalizeFAType(derivedFaTypeRaw);
                          const isExtension = entry?.isExtensionSeason;
                          const faLabel = derivedFaType || 'FA';
                          const isExtensionEligibleYear =
                            extensionEligibleYear &&
                            extensionEligibleYear === year;

                          // Free agency year: faYear of 2027 means they become FA in 2027, for the 2027-28 season
                          // The column showing "2027-28" has year === 2028, so check faYear + 1 === year
                          const isFreeAgentYear =
                            derivedFaYear &&
                            derivedFaType &&
                            Number(derivedFaYear) + 1 === year;

                          // Handle free agency years (no salary)
                          if (
                            !entry ||
                            (entry?.salary == null && entry?.capHit == null)
                          ) {
                            if (isFreeAgentYear) {
                              return (
                                <div
                                  key={year}
                                  onClick={() =>
                                    launchContractAction?.(
                                      player,
                                      faLabel === 'RFA' ? 'rfa' : 'ufa',
                                      year
                                    )
                                  }
                                  className="relative flex items-center justify-center px-2 py-2 border-l border-white/[0.02] h-[26px] cursor-pointer hover:ring-2 hover:ring-inset hover:ring-white/20 transition-all"
                                  title={
                                    rfaInfo?.reason ||
                                    rulesProfileForYear?.contractSummary
                                      ?.freeAgencyType
                                  }
                                >
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getTagColor(faLabel)} hover:scale-105 transition-transform`}
                                  >
                                    {faLabel}
                                  </span>
                                  {(birdRightsTypeForYear ||
                                    rfaInfo?.qualifyingOfferAmount != null) && (
                                    <span className="absolute bottom-1 right-1 text-[10px] text-white/60 leading-tight text-right">
                                      {birdRightsTypeForYear && (
                                        <div
                                          className="flex items-center justify-center"
                                          data-testid="fa-bird-rights"
                                        >
                                          <BirdRightsIcon
                                            type={birdRightsTypeForYear}
                                            size={20}
                                          />
                                        </div>
                                      )}
                                      {rfaInfo?.qualifyingOfferAmount != null && (
                                        <span className="block">
                                          {formatQOText(
                                            rfaInfo.qualifyingOfferAmount
                                          )}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <div
                                key={year}
                                className="border-l border-white/[0.02] h-[26px]"
                              />
                            );
                          }

                          // Handle contract years with options
                          const isPO =
                            entry.option === 'Player Option' ||
                            entry.option === 'PO';
                          const isTO =
                            entry.option === 'Team Option' ||
                            entry.option === 'TO';

                          if (isPO || isTO) {
                            const optionStyle = isPO
                              ? 'bg-green-600/10 hover:bg-green-600/20 border-b border-green-600/30'
                              : 'bg-orange-500/10 hover:bg-orange-500/20 border-b border-orange-500/30';

                            return (
                              <div
                                key={year}
                                onClick={() =>
                                  launchContractAction?.(
                                    player,
                                    isPO ? 'po' : 'to',
                                    year
                                  )
                                }
                                className={`relative flex items-center justify-center px-2 py-2 border-l border-white/[0.02] h-[26px] transition-colors cursor-pointer hover:ring-2 hover:ring-inset hover:ring-white/20 ${optionStyle}`}
                                title={`Click to manage ${isPO ? 'Player' : 'Team'} Option`}
                              >
                                <ContractAmountDisplay
                                  capHit={rowAmounts.capHit}
                                  baseSalary={rowAmounts.baseSalary}
                                  hasCapHitAdjustment={
                                    rowAmounts.hasCapHitAdjustment
                                  }
                                  primaryClassName={`text-xs font-medium tabular-nums tracking-tight ${
                                    isExtension
                                      ? 'text-cyan-200/90'
                                      : 'text-white/70'
                                  }`}
                                  secondaryClassName={`text-[8px] uppercase tracking-wider tabular-nums ${
                                    isExtension
                                      ? 'text-cyan-100/60'
                                      : 'text-white/45'
                                  }`}
                                />
                              </div>
                            );
                          }

                          // Regular contract year
                          return (
                            <div
                              key={year}
                              className={`relative flex items-center justify-center px-2 py-2 border-l border-white/[0.02] h-[26px] ${
                                isExtension
                                  ? 'bg-cyan-500/5 border-cyan-500/20'
                                  : ''
                              }`}
                            >
                              {isExtensionEligibleYear && (
                                <span
                                  className="absolute top-0.5 left-1 text-[9px] font-bold uppercase px-1 rounded bg-cyan-500/20 text-cyan-50 border border-cyan-500/30"
                                  data-testid="extension-eligibility-badge"
                                  title={`Extension eligible starting ${formatSeasonLabel(year)} offseason`}
                                >
                                  {formatExtLabel(year)}
                                </span>
                              )}
                              <ContractAmountDisplay
                                capHit={rowAmounts.capHit}
                                baseSalary={rowAmounts.baseSalary}
                                hasCapHitAdjustment={
                                  rowAmounts.hasCapHitAdjustment
                                }
                                primaryClassName={`text-xs font-medium tabular-nums tracking-tight ${
                                  isExtension
                                    ? 'text-cyan-200/90'
                                    : 'text-white/60'
                                }`}
                                secondaryClassName={`text-[8px] uppercase tracking-wider tabular-nums ${
                                  isExtension
                                    ? 'text-cyan-100/60'
                                    : 'text-cockpit-text-muted'
                                }`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* CANONICAL TOTALS (sticky footer): the Total Cap row reads
                    computeTeamCapTotals(...) outputs directly and stays pinned
                    to the bottom of the scroll area so it is always visible. */}
                <div
                  aria-label={CAP_SHEET_FULL_SURFACE_LABELS.canonicalYearlyTotals}
                  className="sticky bottom-0 z-20 grid border-t border-cockpit-edge bg-cockpit-bar font-semibold"
                  style={{ gridTemplateColumns: playerGridTemplate }}
                >
                  <div className="sticky left-0 z-30 bg-cockpit-slab px-4 py-2 border-r border-cockpit-edge shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
                    <span className="block text-[10px] uppercase tracking-wider text-cockpit-text-secondary">
                      Total Cap
                    </span>
                    <span className="sr-only">
                      {'Canonical Yearly Totals. Canonical yearly total. '}
                      {'Player rows above and cap hold details below support the same future-year cap story.'}
                    </span>
                  </div>
                  {allYears.map((year) => (
                    <div
                      key={year}
                      className="px-2 py-2 text-center text-xs text-cockpit-text-primary tabular-nums tracking-tight border-l border-cockpit-edge"
                    >
                      ${yearTotalBreakdowns[year].totalCapAllocations.toLocaleString()}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

        {displayedDeadMoney.length > 0 ? (
          <section
            aria-label="Multi-year dead money detail surface"
            className="shrink-0 border-t border-cockpit-edge px-4 py-1.5"
          >
            <button
              type="button"
              data-testid="cap-sheet-full-dead-money-toggle"
              onClick={() => setShowDeadMoneyDetails((value) => !value)}
              aria-expanded={showDeadMoneyDetails}
              className="flex w-full items-center gap-2 text-left group"
            >
              <span
                className={`text-sm text-cockpit-text-secondary transition-transform duration-200 ${showDeadMoneyDetails ? 'rotate-90' : ''}`}
              >
                ▶
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-cockpit-text-secondary group-hover:text-cockpit-text-primary">
                Dead Money Details
              </span>
              <span className="rounded bg-cockpit-raised px-1.5 text-[10px] text-cockpit-text-secondary">
                {displayedDeadMoney.length}
              </span>
              <span className="sr-only">
                Separate from player rows. Matching-season dead money feeds the
                canonical Total Cap row.
              </span>
            </button>
            {showDeadMoneyDetails ? (
              <div className="max-h-[32vh] overflow-auto rounded-lg border border-cockpit-edge bg-cockpit-inlay shadow-lg">
                <div
                  className="grid border-b border-cockpit-edge bg-cockpit-bar"
                  style={{ gridTemplateColumns: playerGridTemplate }}
                >
                  <div className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-cockpit-text-muted border-r border-cockpit-edge truncate">
                    Entry
                  </div>
                  {allYears.map((year) => (
                    <div
                      key={year}
                      className="px-2 py-3 text-center text-[10px] uppercase tracking-wider font-semibold text-cockpit-text-muted"
                    >
                      {formatSeasonLabel(year)}
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-white/5">
                  {displayedDeadMoney.map((deadCapEntry, index) => (
                    <div
                      key={`${String(deadCapEntry.playerId || getDeadCapLabel(deadCapEntry))}-${index}`}
                      className="grid items-center hover:bg-white/[0.02] transition-colors"
                      style={{ gridTemplateColumns: playerGridTemplate }}
                    >
                      <div className="h-[26px] truncate border-r border-cockpit-edge px-4 py-2 text-xs font-medium text-cockpit-text-primary">
                        {getDeadCapLabel(deadCapEntry)}
                      </div>
                      {allYears.map((year) => {
                        const amount = computeDeadMoneyForYear(
                          { deadCap: [deadCapEntry] },
                          year
                        );
                        return (
                          <div
                            key={year}
                            className="flex h-[26px] items-center justify-center border-l border-white/[0.02] px-2 py-2 text-xs tabular-nums text-red-200/80"
                          >
                            {amount > 0 ? formatCapSheetMoney(amount) : ''}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {hasIncompleteCharges ? (
          <section
            data-testid="cap-sheet-full-incomplete-roster-charges"
            aria-label="Multi-year incomplete roster charges surface"
            className="shrink-0 border-t border-cockpit-edge px-4 py-1.5"
          >
            <div
              className="grid items-center rounded border border-amber-400/10 bg-amber-400/[0.03]"
              style={{ gridTemplateColumns: playerGridTemplate }}
            >
              <div className="h-[26px] truncate border-r border-cockpit-edge px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-amber-200/80">
                Incomplete roster charges
              </div>
              {allYears.map((year) => {
                const { incompleteChargesTotal } = yearTotalBreakdowns[year];
                return (
                  <div
                    key={year}
                    className="flex h-[26px] items-center justify-center border-l border-white/[0.02] px-2 py-2 text-[10px] tabular-nums text-amber-200/70"
                  >
                    {incompleteChargesTotal > 0
                      ? formatCapSheetMoney(incompleteChargesTotal)
                      : ''}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* SUPPORTING DETAIL SURFACE: Cap holds remain separate from player rows
            and explain part of the same canonical Total Cap story. */}
        {displayedCapHolds.length > 0 &&
          (() => {
          // 1. Create a map of player ID/Name to index from the main sortedPlayers list
          // This allows us to replicate the main table's sort order.
          const playerSortMap = new Map<string | number, number>();
          sortedPlayers.forEach((p, idx) => {
            if (p.id) playerSortMap.set(p.id, idx);
            if (p.player_id) playerSortMap.set(p.player_id, idx);
            if (p.name) playerSortMap.set(p.name, idx);
          });

          // 2. Split holds into "Roster Players" (Group A) and "Legacy/Other" (Group B)
          const rosterHolds: CapHoldLike[] = [];
          const otherHolds: CapHoldLike[] = [];

          displayedCapHolds.forEach((h) => {
            const id = h.playerId || h.playerName;
            if (playerSortMap.has(id || '') || playerSortMap.has(h.playerName || '')) {
              rosterHolds.push(h);
            } else {
              otherHolds.push(h);
            }
          });

          // 3. Sort Group A to match main table
          rosterHolds.sort((a, b) => {
            const idxA =
              playerSortMap.get(a.playerId || '') ??
              playerSortMap.get(a.playerName || '') ??
              9999;
            const idxB =
              playerSortMap.get(b.playerId || '') ??
              playerSortMap.get(b.playerName || '') ??
              9999;
            return idxA - idxB;
          });

          const renderHoldRow = (h: CapHoldLike, idx: number, isLegacy = false) => (
            <div
              key={`${h.playerId}-${idx}`}
              className={`grid items-center hover:bg-white/[0.02] transition-colors group ${isLegacy ? 'bg-white/[0.01]' : ''}`}
              style={{ gridTemplateColumns: capHoldGridTemplate }}
            >
              {/* Name Column */}
              <div className="px-4 py-2 flex items-center border-r border-cockpit-edge h-[26px] relative overflow-hidden">
                <span
                  className="text-xs font-medium text-cockpit-text-primary truncate w-full"
                  title={h.playerName || String(h.playerId || '')}
                >
                  {h.playerName || h.playerId}
                </span>

                {/* Renounce Button - Absolute Positioned on Hover */}
                <div className="absolute inset-0 bg-cockpit-slab flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    data-testid="cap-sheet-full-absolve-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      renounceCapHold?.(h);
                    }}
                    className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded border border-red-500/20"
                  >
                    Absolve
                  </button>
                </div>
              </div>

              {/* Tag Column */}
              <div className="px-1 py-1 flex items-center justify-center border-r border-cockpit-edge h-[26px]">
                <span
                  className={`${getTagColor(h.type || null)} px-1 py-px rounded-[2px] text-[8px] font-bold uppercase tracking-wider truncate max-w-full`}
                >
                  {h.type === 'FA Cap Hold' ? 'HOLD' : h.type || 'HOLD'}
                </span>
              </div>

              {/* Year Columns */}
              {allYears.map((year) => {
                const seasonStr = `${year - 1}-${String(year % 100).padStart(2, '0')}`;
                const matchSeason = h.season === seasonStr;

                if (matchSeason) {
                  return (
                    <div
                      key={year}
                      className="flex items-center justify-center px-2 py-2 border-l border-white/[0.02] h-[26px] bg-cyan-900/10"
                    >
                      <span className="text-xs font-mono text-cyan-200 tabular-nums">
                        ${Number(h.amount || 0).toLocaleString()}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={year}
                    className="border-l border-white/[0.02] h-[26px] opacity-30"
                  />
                );
              })}
            </div>
          );

            return (
              <section
                aria-label={CAP_SHEET_FULL_SURFACE_LABELS.capHoldsDetail}
                className="shrink-0 border-t border-cockpit-edge px-4 py-1.5"
              >
              <button
                data-testid="cap-sheet-full-cap-holds-toggle"
                onClick={() => setShowCapHolds(!showCapHolds)}
                aria-expanded={showCapHolds}
                className="flex w-full items-center gap-2 text-left group"
              >
                <span
                  className={`text-sm text-cockpit-text-secondary transition-transform duration-200 ${showCapHolds ? 'rotate-90' : ''}`}
                >
                  ▶
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-cockpit-text-secondary group-hover:text-cockpit-text-primary">
                  Cap Hold Details
                </span>
                <span className="rounded bg-cockpit-raised px-1.5 text-[10px] text-cockpit-text-secondary">
                  {displayedCapHolds.length}
                </span>
                <span className="sr-only">
                  Separate from player rows. Matching-season holds feed the
                  canonical Total Cap row.
                </span>
              </button>

              {showCapHolds && (
                <div className="max-h-[38vh] overflow-auto rounded-lg border border-cockpit-edge bg-cockpit-inlay shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Header */}
                  <div
                    className="grid border-b border-cockpit-edge bg-cockpit-bar"
                    style={{ gridTemplateColumns: capHoldGridTemplate }}
                  >
                    <div className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-cockpit-text-muted border-r border-cockpit-edge truncate">
                      Player
                    </div>
                    <div className="px-1 py-3 text-center text-[9px] uppercase tracking-wider font-semibold text-cockpit-text-muted border-r border-cockpit-edge">
                      Type
                    </div>
                    {allYears.map((year) => (
                      <div
                        key={year}
                        className="px-2 py-3 text-center text-[10px] uppercase tracking-wider font-semibold text-cockpit-text-muted"
                      >
                        {year - 1}-{String(year % 100).padStart(2, '0')}
                      </div>
                    ))}
                  </div>

                  <div className="divide-y divide-white/5">
                    {rosterHolds.map((h, i) => renderHoldRow(h, i, false))}

                    {rosterHolds.length > 0 && otherHolds.length > 0 && (
                      <div className="h-[2px] bg-white/10 w-full col-span-full relative">
                        <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-white/20"></div>
                      </div>
                    )}

                    {otherHolds.map((h, i) => renderHoldRow(h, i, true))}
                  </div>
                </div>
              )}
              </section>
            );
          })()}

        {/* HOME-BASE READOUT: the current-season exceptions / hard-cap readout,
            collapsed by default so the table owns the screen. The headline cap
            posture already lives in the cockpit TeamStatusStrip above. */}
        {exceptionsReadout ? (
          <section
            data-testid="cap-sheet-full-cap-tools"
            aria-label="Multi-year cap tools surface"
            className="shrink-0 border-t border-cockpit-edge px-4 py-1.5"
          >
            <button
              type="button"
              data-testid="cap-sheet-full-exceptions-toggle"
              onClick={() => setShowExceptionsReadout((value) => !value)}
              aria-expanded={showExceptionsReadout}
              className="flex w-full items-center gap-2 text-left group"
            >
              <span
                className={`text-sm text-cockpit-text-secondary transition-transform duration-200 ${showExceptionsReadout ? 'rotate-90' : ''}`}
              >
                ▶
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-cockpit-text-secondary group-hover:text-cockpit-text-primary">
                Exceptions &amp; Hard Cap
              </span>
            </button>
            {showExceptionsReadout ? (
              <div
                data-testid="cap-sheet-full-exceptions-readout"
                className="mt-2 max-h-[40vh] space-y-2 overflow-auto"
              >
                {exceptionsReadout}
              </div>
            ) : null}
          </section>
        ) : null}
        </div>
      </section>

      {/* Modals — reuse the existing current-season authorities. */}
      {showDeadMoneyModal && (
        <ManageDeadMoneyModal
          isOpen={showDeadMoneyModal}
          onClose={() => setShowDeadMoneyModal(false)}
          teamCapSheet={
            teamCapSheet as Parameters<
              typeof ManageDeadMoneyModal
            >[0]['teamCapSheet']
          }
          currentYear={currentYear}
          onSave={handleSaveDeadCapEdit}
        />
      )}
      {showExceptionsModal && (
        <ManageExceptionsModal
          isOpen={showExceptionsModal}
          onClose={() => setShowExceptionsModal(false)}
          teamCapSheet={
            teamCapSheet as Parameters<
              typeof ManageExceptionsModal
            >[0]['teamCapSheet']
          }
          currentYear={currentYear}
          onSave={handleSaveExceptionsEdit}
        />
      )}
    </div>
  );
};
