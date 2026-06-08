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
import React, { useCallback, useState, useMemo } from 'react';
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
import { PlayerActionMenu } from '@/features/architect/cockpit/PlayerActionMenu';
import {
  buildPlayerActionContext,
  type PlayerAction,
  type PlayerActionContext,
} from '@/features/architect/cockpit/playerActionContext';
import { ManageDeadMoneyModal } from '@/features/architect/capSheet/modals/ManageDeadMoneyModal';
import { ManageExceptionsModal } from '@/features/architect/capSheet/modals/ManageExceptionsModal';
import type { ManualCapSheetMutationAuthority } from '@/features/architect/capSheet/CapSheet/CapSheet';
import type { FreeAgentSurfaceEntry } from '@/features/architect/freeAgency/FreeAgentPool/types';

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
  /**
   * Unified player-action intents (Trade + cross-room navigation) routed by
   * GMDashboard via `routePlayerAction`. Open and Pin/Unpin intentionally stay
   * on the existing `onOpenPlayerContractModal` (name click) and `onTogglePin`
   * plumbing so this refactor changes no committed behavior — the shared menu
   * only adds the navigation/trade vocabulary on top.
   */
  onPlayerAction?:
    | ((action: PlayerAction, context: PlayerActionContext) => void)
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
  highlightPlayerIds?: string[];
  /**
   * Pin board: ids currently pinned (so the action menu can show Pin vs Unpin)
   * and the toggle handler. Pinning is an intentional menu action — never a
   * side effect of selecting/opening a player.
   */
  pinnedPlayerIds?: string[];
  onTogglePin?: ((player: CapSheetFullPlayerLike) => void) | null;
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
  freeAgentOptions?: FreeAgentSurfaceEntry[];
  onOpenFreeAgentOption?: ((selectionKey: string) => void) | null;
  onRemoveFreeAgentOption?: ((selectionKey: string) => void) | null;
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

// Glossy 2K-style contract chips: gradient fill, hairline border, soft glow.
const getTagColor = (type: string | null) => {
  const base =
    'border shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] bg-gradient-to-b';
  if (type === 'UFA')
    return `${base} from-blue-400/40 to-blue-600/40 border-blue-300/40 text-blue-50`;
  if (type === 'RFA')
    return `${base} from-rose-400/40 to-rose-600/40 border-rose-300/40 text-rose-50`;
  if (type === 'PO')
    return `${base} from-emerald-400/40 to-emerald-600/40 border-emerald-300/40 text-emerald-50`;
  if (type === 'TO')
    return `${base} from-amber-400/40 to-amber-600/40 border-amber-300/40 text-amber-50`;
  if (type === 'TWO-WAY')
    return `${base} from-white/15 to-white/5 border-white/20 text-white/70`;
  return `${base} from-slate-500/40 to-slate-700/40 border-slate-400/30 text-slate-50`;
};

// Soft full-cell tints that echo each tag's hue so a year cell reads as a
// free-agency / option / extension season at a glance. A top-down gradient
// plus a colored inset accent bar on the left keeps all three special cell
// types visually consistent with the glossy chip palette, without competing
// with the salary number sitting on top.
const FA_CELL_TINT: Record<string, string> = {
  UFA: 'bg-gradient-to-b from-blue-500/[0.16] to-blue-500/[0.04]',
  RFA: 'bg-gradient-to-b from-rose-500/[0.16] to-rose-500/[0.04]',
};
const getFaCellTint = (type: string | null): string =>
  (type ? FA_CELL_TINT[type] : undefined) ??
  'bg-gradient-to-b from-slate-400/[0.08] to-transparent';

const OPTION_CELL_STYLE = {
  PO: 'bg-gradient-to-b from-emerald-500/[0.16] to-emerald-500/[0.04] hover:from-emerald-500/30 hover:to-emerald-500/10 shadow-[inset_2px_0_0_rgba(16,185,129,0.6)]',
  TO: 'bg-gradient-to-b from-amber-500/[0.16] to-amber-500/[0.04] hover:from-amber-500/30 hover:to-amber-500/10 shadow-[inset_2px_0_0_rgba(245,158,11,0.6)]',
} as const;

const EXTENSION_CELL_STYLE =
  'bg-gradient-to-b from-cyan-500/[0.14] to-cyan-500/[0.03] shadow-[inset_2px_0_0_rgba(34,211,238,0.5)]';

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

// 2K-style team-gradient identity disc. Real headshots are not available as
// assets, so initials on a team-colored chip stand in — reads as a roster
// entry rather than a spreadsheet row.
const getPlayerInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

// Resolve the local headshot slug from the player's id (roster ids are slugs
// like "lebron_james" that match /assets/headshots/<slug>.png).
const resolveHeadshotSlug = (player: CapSheetFullPlayerLike): string => {
  const anyP = player as {
    id?: unknown;
    player_id?: unknown;
    name?: unknown;
    bio?: { playerId?: unknown };
  };
  const raw =
    (anyP.bio?.playerId as string) ||
    (anyP.id as string) ||
    (anyP.player_id as string) ||
    (anyP.name as string) ||
    '';
  return String(raw)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

// Circular player headshot with a team-color ring. There is no default.png
// asset, so a 404 gracefully degrades to a team-gradient initials disc.
const PlayerAvatar = ({
  player,
  name,
}: {
  player: CapSheetFullPlayerLike;
  name: string;
}) => {
  const [failed, setFailed] = useState(false);
  const slug = resolveHeadshotSlug(player);

  if (failed || !slug) {
    return (
      <span
        aria-hidden
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold tracking-wide text-[color:var(--team-on-primary,#fff)]"
        style={{
          background:
            'linear-gradient(135deg, var(--team-primary,#4F46E5), #0b0e14)',
          boxShadow:
            'inset 0 0 0 1.5px color-mix(in srgb, var(--team-secondary,#FDB927) 60%, transparent), 0 1px 4px rgba(0,0,0,0.5)',
        }}
      >
        {getPlayerInitials(name) || '—'}
      </span>
    );
  }

  return (
    <span
      className="flex h-5 w-5 shrink-0 overflow-hidden rounded-full"
      style={{
        boxShadow:
          'inset 0 0 0 1.5px color-mix(in srgb, var(--team-secondary,#FDB927) 70%, transparent), 0 1px 4px rgba(0,0,0,0.5)',
      }}
    >
      <img
        src={`/assets/headshots/${slug}.png`}
        alt=""
        aria-hidden
        loading="lazy"
        className="h-full w-full object-cover object-top"
        style={{ background: '#0b0e14' }}
        onError={() => setFailed(true)}
      />
    </span>
  );
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

  // Cap hit differs from base salary (e.g. adjusted/stretched). Show only the
  // cap hit — the number that counts against the cap — with the base available
  // in the tooltip, instead of a cramped second line.
  return (
    <span
      className={primaryClassName}
      title={`Cap hit ${formatCapSheetMoney(capHit)} · Base salary ${formatCapSheetMoney(baseSalary)}`}
    >
      {formatCapSheetMoney(capHit)}
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
  onPlayerAction = null,
  onSelectPlayer,
  onActionClick,
  getRulesProfileForYear = null,
  highlightPlayerId = null,
  highlightPlayerIds = [],
  pinnedPlayerIds = [],
  onTogglePin = null,
  manualCapSheetMutationAuthority = null,
  exceptionsReadout = null,
  onLaunchFreeAgentSearch = null,
  freeAgentOptions = [],
  onOpenFreeAgentOption = null,
  onRemoveFreeAgentOption = null,
}: CapSheetFullProps) => {
  const [showCapHolds, setShowCapHolds] = useState(false);
  const [showDeadMoneyDetails, setShowDeadMoneyDetails] = useState(false);
  const [showExceptionsReadout, setShowExceptionsReadout] = useState(false);
  const [showDeadMoneyModal, setShowDeadMoneyModal] = useState(false);
  const [showExceptionsModal, setShowExceptionsModal] = useState(false);
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
  const focusedPlayerIds = useMemo(
    () =>
      Array.from(
        new Set(
          [...highlightPlayerIds, highlightPlayerId].filter(
            (playerId): playerId is string => Boolean(playerId)
          )
        )
      ),
    [highlightPlayerId, highlightPlayerIds]
  );
  const playerMatchesAnyFocus = useCallback(
    (player: CapSheetFullPlayerLike) =>
      focusedPlayerIds.some((playerId) =>
        playerMatchesFocus(player, playerId)
      ),
    [focusedPlayerIds]
  );
  const playerIsPinned = useCallback(
    (player: CapSheetFullPlayerLike) =>
      pinnedPlayerIds.some((playerId) => playerMatchesFocus(player, playerId)),
    [pinnedPlayerIds]
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
  const affectedTotalYears = useMemo(() => {
    const years = new Set<number>();
    for (const player of sortedPlayers) {
      if (!playerMatchesAnyFocus(player)) continue;
      for (const year of allYears) {
        const rowAmounts = getPlayerCapSheetAmountsForYear(player, year);
        if (
          rowAmounts.contractSlice ||
          rowAmounts.capHit > 0 ||
          rowAmounts.baseSalary > 0
        ) {
          years.add(year);
        }
      }
    }
    return years;
  }, [allYears, playerMatchesAnyFocus, sortedPlayers]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col font-sans text-cockpit-text-primary">
      <section
        aria-label={CAP_SHEET_FULL_SURFACE_LABELS.primary}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div
          className="relative flex min-h-0 max-h-full flex-col overflow-hidden rounded-lg border border-white/10 shadow-cockpit-slab"
          style={{
            background:
              'radial-gradient(120% 80% at 0% 0%, color-mix(in srgb, var(--team-primary,#4F46E5) 22%, #0B0E14), #07090D 70%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px color-mix(in srgb, var(--team-primary,#4F46E5) 40%, transparent), 0 18px 50px -20px rgba(0,0,0,0.8)',
          }}
        >
          {freeAgentOptions.length > 0 ? (
            <section
              data-testid="cap-sheet-full-fa-options"
              aria-label="Free-agent options"
              className="shrink-0 border-b border-cockpit-edge bg-cockpit-slab px-3 py-1.5"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
                  FA Options
                </span>
                {freeAgentOptions.map((entry) => {
                  const playerName =
                    entry.surfacePlayer.displayName ||
                    entry.surfacePlayer.name ||
                    entry.freeAgent.name ||
                    entry.selectionKey;
                  return (
                    <div
                      key={entry.selectionKey}
                      className="flex items-center gap-1 rounded border border-cockpit-edge bg-cockpit-inlay px-2 py-1"
                    >
                      <span className="max-w-[180px] truncate text-[11px] text-cockpit-text-primary">
                        {playerName}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenFreeAgentOption?.(entry.selectionKey)
                        }
                        className="rounded px-1 text-[10px] font-medium text-cockpit-safe hover:bg-cockpit-safe/10"
                      >
                        Open offer
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${playerName}`}
                        onClick={() =>
                          onRemoveFreeAgentOption?.(entry.selectionKey)
                        }
                        className="flex h-4 w-4 items-center justify-center rounded text-xs text-cockpit-text-muted hover:bg-cockpit-raised hover:text-cockpit-text-primary"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* COMPACT TOOLBAR: a single dense row — the room header already names
              the surface, so we don't repeat a title. Reclaims vertical space so
              the table itself owns the screen. */}
          <div
            className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5"
            style={{
              background:
                'linear-gradient(90deg, color-mix(in srgb, var(--team-primary,#4F46E5) 30%, #0B0E14), #0B0E14 60%)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="h-5 w-1 rounded-full"
                style={{ background: 'var(--team-secondary,#FDB927)' }}
              />
              <span className="text-[13px] font-extrabold uppercase italic tracking-wide text-white">
                Cap Table
              </span>
              <span className="rounded border border-white/15 bg-black/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/60">
                {formatSeasonLabel(currentYear)}
              </span>
            </div>
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
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all ${
                    hasManualCapSheetMutationAuthority
                      ? 'border-white/15 bg-white/5 text-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-white/10 hover:text-white'
                      : 'cursor-not-allowed border-white/5 text-white/20'
                  }`}
                >
                  Dead Money
                </button>
                <button
                  data-testid="cap-sheet-full-manage-exceptions-button"
                  type="button"
                  disabled={!hasManualCapSheetMutationAuthority}
                  onClick={() => {
                    if (!hasManualCapSheetMutationAuthority) return;
                    setShowExceptionsModal(true);
                  }}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all ${
                    hasManualCapSheetMutationAuthority
                      ? 'border-white/15 bg-white/5 text-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-white/10 hover:text-white'
                      : 'cursor-not-allowed border-white/5 text-white/20'
                  }`}
                >
                  Exceptions
                </button>
                {onLaunchFreeAgentSearch ? (
                  <button
                    data-testid="cap-sheet-full-sign-free-agent-button"
                    type="button"
                    onClick={() => onLaunchFreeAgentSearch()}
                    className="rounded-md border border-black/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition-transform hover:scale-[1.03]"
                    style={{ background: 'var(--team-secondary,#FDB927)' }}
                  >
                    + Sign Free Agent
                  </button>
                ) : null}
              </div>
            )}
          </div>

          {/* PLAYER DETAIL: hugs its content so the Total Cap footer sits
              directly above the cap-hold / exception bars (no underflow gap),
              but keeps min-h-0 so it shrinks and scrolls internally — with the
              sticky header/footer — when a full roster is taller than the
              window. */}
          <section
            aria-label={CAP_SHEET_FULL_SURFACE_LABELS.playerDetail}
            className="flex min-h-0 flex-col"
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
                  <div className="sticky left-0 z-30 bg-cockpit-slab px-3 py-1 text-[10px] uppercase tracking-wider font-semibold text-cockpit-text-muted border-r border-cockpit-edge shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
                    Player
                  </div>
                  {allYears.map((year) => (
                    <div
                      key={year}
                      className="px-2 py-1 text-center text-[10px] uppercase tracking-wider font-semibold text-cockpit-text-muted"
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
                    const isRowHighlighted = playerMatchesAnyFocus(player);
                    // Two-way marker lives in the player's first salary cell
                    // (not the name column) so it never squeezes the name into
                    // truncation. The small two-way amount has room to spare.
                    const firstSalaryYear = isTwoWay
                      ? allYears.find((year) => {
                          const amounts = getPlayerCapSheetAmountsForYear(
                            player,
                            year
                          );
                          return (
                            Boolean(amounts.contractSlice) ||
                            amounts.capHit > 0 ||
                            amounts.baseSalary > 0
                          );
                        }) ?? null
                      : null;
                    return (
                      <div
                        key={idx}
                        className={`grid transition-colors group ${
                          isRowHighlighted
                            ? 'ring-1 ring-inset ring-[color:var(--team-secondary,#FDB927)]/50 bg-[color:var(--team-primary,#4F46E5)]/[0.08]'
                            : 'hover:bg-[color:var(--team-primary,#4F46E5)]/[0.06]'
                        } ${isTwoWay ? 'opacity-70' : ''}`}
                        style={{ gridTemplateColumns: playerGridTemplate }}
                        data-testid={
                          isRowHighlighted
                            ? 'cap-sheet-full-player-row-highlighted'
                            : undefined
                        }
                      >
                        {/* Player Name (Sticky) */}
                        <div className="sticky left-0 z-10 flex h-[24px] items-center gap-2 border-r border-white/10 bg-[#0b0e14] px-3 shadow-[4px_0_24px_rgba(0,0,0,0.5)] transition-colors group-hover:bg-[#11151d]">
                          <PlayerAvatar
                            player={player}
                            name={
                              player.displayName ||
                              player.bio?.displayName ||
                              player.name ||
                              '?'
                            }
                          />
                          <button
                            data-testid="cap-sheet-full-player-row-button"
                            onClick={() => openPlayerContractModal?.(player)}
                            className="flex-1 truncate text-left text-[13px] font-bold tracking-tight text-white transition-colors hover:text-[color:var(--team-secondary,#FDB927)]"
                          >
                            {player.displayName ||
                              player.bio?.displayName ||
                              player.name}
                          </button>
                          {(() => {
                            if (
                              !onLaunchPlayerAction &&
                              !onTogglePin &&
                              !onPlayerAction
                            ) {
                              return null;
                            }
                            const menuContext = buildPlayerActionContext({
                              player,
                              sourceRoom: 'capfull',
                              targetYear: currentYear,
                            });
                            if (!menuContext) return null;
                            // Open stays the name-click; the menu is overflow-only
                            // so the dense 24px row keeps its compact hover-kebab.
                            const overflowActions: PlayerAction[] = [];
                            if (onTogglePin) overflowActions.push('pin');
                            if (onPlayerAction) {
                              overflowActions.push(
                                'trade',
                                'view-on-roster',
                                'view-on-cap',
                                'find-in-history',
                                'compare-impact',
                                'guide-next-move'
                              );
                            }
                            const extraItems = onLaunchPlayerAction
                              ? (
                                  [
                                    ['extend', 'Extend'],
                                    ['waive', 'Waive'],
                                    ['stretch', 'Stretch'],
                                  ] as const
                                ).map(([action, label]) => ({
                                  id: action,
                                  label,
                                  onSelect: () =>
                                    onLaunchPlayerAction?.(player, action),
                                  testId: `cap-sheet-full-player-row-action-${action}`,
                                }))
                              : [];
                            return (
                              <PlayerActionMenu
                                context={menuContext}
                                visibleActions={[]}
                                overflowActions={overflowActions}
                                extraItems={extraItems}
                                isPinned={playerIsPinned(player)}
                                menuAlign="left"
                                testIdPrefix="cap-sheet-full-player-row"
                                className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
                                onAction={(action, ctx) => {
                                  // Open/Pin reuse the surface's existing
                                  // plumbing; everything else routes outward.
                                  if (action === 'pin' || action === 'unpin') {
                                    onTogglePin?.(player);
                                    return;
                                  }
                                  onPlayerAction?.(action, ctx);
                                }}
                              />
                            );
                          })()}
                        </div>

                        {/* Years */}
                        {allYears.map((year) => {
                          const rowAmounts = getPlayerCapSheetAmountsForYear(
                            player,
                            year
                          );
                          const twoWayMarker =
                            isTwoWay && year === firstSalaryYear ? (
                              <span
                                className={`absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded px-1 py-px text-[8px] font-bold uppercase tracking-wider ${getTagColor('TWO-WAY')}`}
                                title="Two-way contract"
                              >
                                2W
                              </span>
                            ) : null;
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
                                  className={`relative flex items-center justify-center px-2 border-l border-white/[0.02] h-[24px] cursor-pointer hover:ring-2 hover:ring-inset hover:ring-white/20 transition-all ${getFaCellTint(faLabel)}`}
                                  title={
                                    rfaInfo?.reason ||
                                    rulesProfileForYear?.contractSummary
                                      ?.freeAgencyType
                                  }
                                >
                                  <span
                                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getTagColor(faLabel)} transition-transform hover:scale-105`}
                                  >
                                    {faLabel}
                                  </span>
                                  {birdRightsTypeForYear && (
                                    <span
                                      className="absolute bottom-0 right-0.5 flex items-center justify-center"
                                      data-testid="fa-bird-rights"
                                    >
                                      <BirdRightsIcon
                                        type={birdRightsTypeForYear}
                                        size={16}
                                      />
                                    </span>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <div
                                key={year}
                                className="border-l border-white/[0.02] h-[24px]"
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
                              ? OPTION_CELL_STYLE.PO
                              : OPTION_CELL_STYLE.TO;

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
                                className={`relative flex items-center justify-center px-2 py-2 border-l border-white/[0.02] h-[24px] transition-all cursor-pointer hover:ring-2 hover:ring-inset hover:ring-white/20 ${optionStyle}`}
                                title={`Click to manage ${isPO ? 'Player' : 'Team'} Option`}
                              >
                                {twoWayMarker}
                                <ContractAmountDisplay
                                  capHit={rowAmounts.capHit}
                                  baseSalary={rowAmounts.baseSalary}
                                  hasCapHitAdjustment={
                                    rowAmounts.hasCapHitAdjustment
                                  }
                                  primaryClassName={`text-xs font-semibold tabular-nums tracking-tight ${
                                    isExtension
                                      ? 'text-cyan-200'
                                      : 'text-white/90'
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
                              className={`relative flex items-center justify-center px-2 py-2 border-l border-white/[0.02] h-[24px] ${
                                isExtension ? EXTENSION_CELL_STYLE : ''
                              }`}
                            >
                              {isExtensionEligibleYear && (
                                <span
                                  className="absolute left-0 top-0 z-10 leading-none"
                                  data-testid="extension-eligibility-badge"
                                  title={`Extension eligible starting ${formatSeasonLabel(year)} offseason — ${formatExtLabel(year)}`}
                                >
                                  <span
                                    aria-hidden
                                    className="block h-0 w-0 border-r-[13px] border-t-[13px] border-r-transparent border-t-cyan-400/90"
                                  />
                                  <span
                                    aria-hidden
                                    className="absolute left-[1px] top-[0px] text-[7px] font-bold uppercase leading-none text-[#06222b]"
                                  >
                                    E
                                  </span>
                                  <span className="sr-only">
                                    {formatExtLabel(year)}
                                  </span>
                                </span>
                              )}
                              {twoWayMarker}
                              <ContractAmountDisplay
                                capHit={rowAmounts.capHit}
                                baseSalary={rowAmounts.baseSalary}
                                hasCapHitAdjustment={
                                  rowAmounts.hasCapHitAdjustment
                                }
                                primaryClassName={`text-xs font-semibold tabular-nums tracking-tight ${
                                  isExtension
                                    ? 'text-cyan-200'
                                    : 'text-white/85'
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
                  role="region"
                  aria-label={CAP_SHEET_FULL_SURFACE_LABELS.canonicalYearlyTotals}
                  className="sticky bottom-0 z-20 grid border-t-2 font-bold"
                  style={{
                    gridTemplateColumns: playerGridTemplate,
                    borderTopColor: 'var(--team-secondary,#FDB927)',
                    background:
                      'color-mix(in srgb, var(--team-primary,#4F46E5) 22%, #0B0E14)',
                  }}
                >
                  <div
                    className="sticky left-0 z-30 flex items-center gap-2 px-3 border-r border-white/10 shadow-[4px_0_24px_rgba(0,0,0,0.5)]"
                    style={{
                      background:
                        'color-mix(in srgb, var(--team-primary,#4F46E5) 34%, #0B0E14)',
                    }}
                  >
                    <span
                      aria-hidden
                      className="h-4 w-1 rounded-full"
                      style={{ background: 'var(--team-secondary,#FDB927)' }}
                    />
                    <span className="block text-[11px] font-extrabold uppercase italic tracking-wide text-white">
                      Total Cap
                    </span>
                    <span className="sr-only">{'Canonical Yearly Totals'}</span>
                    <span className="sr-only">{'Canonical yearly total'}</span>
                    <span className="sr-only">
                      {'Player rows above and cap hold details below support the same future-year cap story.'}
                    </span>
                  </div>
                  {allYears.map((year) => {
                    const isTotalHighlighted = affectedTotalYears.has(year);
                    return (
                      <div
                        key={year}
                        data-testid={
                          isTotalHighlighted
                            ? 'cap-sheet-full-total-cell-highlighted'
                            : 'cap-sheet-full-total-cell'
                        }
                        className={`flex items-center justify-center px-2 py-1 text-center text-[13px] font-bold tabular-nums tracking-tight border-l border-white/10 ${
                          isTotalHighlighted
                            ? 'text-[color:var(--team-secondary,#FDB927)] ring-1 ring-inset ring-[color:var(--team-secondary,#FDB927)]/40'
                            : 'text-white'
                        }`}
                      >
                        ${yearTotalBreakdowns[year].totalCapAllocations.toLocaleString()}
                      </div>
                    );
                  })}
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
                      <div className="h-[24px] truncate border-r border-cockpit-edge px-4 py-2 text-xs font-medium text-cockpit-text-primary">
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
                            className="flex h-[24px] items-center justify-center border-l border-white/[0.02] px-2 py-2 text-xs tabular-nums text-red-200/80"
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
              <div className="h-[24px] truncate border-r border-cockpit-edge px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-amber-200/80">
                Incomplete roster charges
              </div>
              {allYears.map((year) => {
                const { incompleteChargesTotal } = yearTotalBreakdowns[year];
                return (
                  <div
                    key={year}
                    className="flex h-[24px] items-center justify-center border-l border-white/[0.02] px-2 py-2 text-[10px] tabular-nums text-amber-200/70"
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
              <div className="px-4 py-2 flex items-center border-r border-cockpit-edge h-[24px] relative overflow-hidden">
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
              <div className="px-1 py-1 flex items-center justify-center border-r border-cockpit-edge h-[24px]">
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
                      className="flex items-center justify-center px-2 py-2 border-l border-white/[0.02] h-[24px] bg-cyan-900/10"
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
                    className="border-l border-white/[0.02] h-[24px] opacity-30"
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
