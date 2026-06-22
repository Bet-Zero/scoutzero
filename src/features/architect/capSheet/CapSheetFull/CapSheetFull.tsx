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
import React, {
  useCallback,
  useState,
  useMemo,
  useRef,
  useLayoutEffect,
} from 'react';
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
import {
  resolveFreeAgentRights,
  type FreeAgentRights,
} from '@/features/architect/utils/freeAgentRights';

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
  teamName?: string | null;
  name?: string | null;
  abbreviation?: string | null;
  id?: string | null;
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
type ResolvedCapHoldEntry = {
  hold: CapHoldLike;
  rights: FreeAgentRights;
  player: CapSheetFullPlayerLike | null;
  isOnRoster: boolean;
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
  onOpenPlayerContractModal?: ((player: CapSheetFullPlayerLike) => void) | null;
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
  /**
   * League-wide player lookup (by id/name). Lets own free agents that live only
   * as cap holds (not roster rows) resolve their full player record — so they
   * can render as first-class, re-signable rows in the main cap table.
   */
  playersMap?: Record<string, unknown>;
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

// Minimum visible year span. The table otherwise hugs the team's actual
// commitments (the latest contract / cap-hold / dead-cap year), so it doesn't
// pad out dead, all-$0 future columns. Kept small so a normal roster (4+ years
// of deals) shows no empty trailing columns; only a barely-committed team would
// hit this floor. Reclaims horizontal room for the docked posture panel.
const MIN_VISIBLE_YEARS = 4;

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

const toStartYear = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  const seasonMatch = trimmed.match(/^(\d{4})-\d{2}$/);
  if (seasonMatch) return Number(seasonMatch[1]);

  const numericYear = Number.parseInt(trimmed, 10);
  return /^\d{4}$/.test(trimmed) && Number.isFinite(numericYear)
    ? numericYear
    : null;
};

const normalizeLookupKey = (value: unknown): string | null => {
  if (value == null) return null;
  const normalized = String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || null;
};

const addLookupKey = (keys: Set<string>, value: unknown) => {
  if (value == null) return;
  const raw = String(value).trim();
  if (!raw) return;
  keys.add(raw);
  const normalized = normalizeLookupKey(raw);
  if (normalized) keys.add(normalized);
};

const getPlayerLookupKeys = (player: CapSheetFullPlayerLike | null) => {
  const keys = new Set<string>();
  if (!player) return keys;
  const anyPlayer = player as {
    id?: unknown;
    player_id?: unknown;
    playerId?: unknown;
    name?: unknown;
    displayName?: unknown;
    bio?: { playerId?: unknown; displayName?: unknown };
  };
  addLookupKey(keys, anyPlayer.id);
  addLookupKey(keys, anyPlayer.player_id);
  addLookupKey(keys, anyPlayer.playerId);
  addLookupKey(keys, anyPlayer.bio?.playerId);
  addLookupKey(keys, anyPlayer.name);
  addLookupKey(keys, anyPlayer.displayName);
  addLookupKey(keys, anyPlayer.bio?.displayName);
  return keys;
};

const getHoldLookupKeys = (hold: CapHoldLike) => {
  const keys = new Set<string>();
  addLookupKey(keys, hold.playerId);
  addLookupKey(keys, hold.playerName);
  return keys;
};

const resolveCapHoldPlayer = (
  hold: CapHoldLike,
  playersMap: Record<string, unknown>
): CapSheetFullPlayerLike | null => {
  for (const key of getHoldLookupKeys(hold)) {
    const player = playersMap[key];
    if (player && typeof player === 'object') {
      return player as CapSheetFullPlayerLike;
    }
  }
  return null;
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
    return (
      <span className={primaryClassName}>{formatCapSheetMoney(capHit)}</span>
    );
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
  playersMap = {},
}: CapSheetFullProps) => {
  // The three bottom detail surfaces (Dead Money / Cap Holds / Exceptions) share
  // one segmented bar: at most one panel is open at a time, and it pops up ABOVE
  // the bar so it never pushes the Full Cap Table into scroll.
  const [activeDetailTab, setActiveDetailTab] = useState<
    'dead' | 'holds' | 'exceptions' | 'legend' | null
  >(null);
  // The detail popover opens upward out of the bottom bar. On a short roster the
  // bar sits high, so we measure the room between the surface top and the bar and
  // cap the popover height to it — it then scrolls internally instead of growing
  // up into the table header / posture band above the surface.
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const detailBarRef = useRef<HTMLDivElement | null>(null);
  const [detailPopoverMaxH, setDetailPopoverMaxH] = useState<number | null>(
    null
  );
  useLayoutEffect(() => {
    if (!activeDetailTab) return;
    const measure = () => {
      const surface = surfaceRef.current;
      const bar = detailBarRef.current;
      if (!surface || !bar) return;
      const surfaceTop = surface.getBoundingClientRect().top;
      const barTop = bar.getBoundingClientRect().top;
      // Leave a small gap below the surface top and above the bar.
      const room = Math.max(96, Math.floor(barTop - surfaceTop - 16));
      setDetailPopoverMaxH(room);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeDetailTab]);
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
    ((
      player: CapSheetFullPlayerLike,
      action: CapSheetModalActionType,
      year: number
    ) => onActionClick?.(player, action, year));
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
      focusedPlayerIds.some((playerId) => playerMatchesFocus(player, playerId)),
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
          Number(currentYearSlice?.salary ?? currentYearSlice?.capHit ?? 0) ||
          0;

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

  // "Do we hold this player's rights?" — built from the RAW roster, which still
  // lists own free agents whose contracts have expired (LeBron) but excludes
  // departed players (Carmelo). Drives the resolver's placement (own FA → main,
  // departed → dead). NOT a dedup signal.
  const rosterLookupKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const player of teamCapSheet.players || []) {
      for (const key of getPlayerLookupKeys(player)) {
        keys.add(key);
      }
    }
    return keys;
  }, [teamCapSheet.players]);

  // "Does this player already render as a visible roster ROW?" — built from
  // sortedPlayers (expired-contract FAs are filtered out). The ONLY dedup
  // signal: a player with a visible row must not also get a cap-hold row.
  const visibleRosterKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const player of sortedPlayers) {
      for (const key of getPlayerLookupKeys(player)) {
        keys.add(key);
      }
    }
    return keys;
  }, [sortedPlayers]);

  const displayedCapHolds = useMemo(
    () =>
      ((teamCapSheet.capHolds || []) as CapHoldLike[]).filter(
        (h: CapHoldLike) => !h.isSigned
      ),
    [teamCapSheet.capHolds]
  );

  const resolvedCapHolds = useMemo<ResolvedCapHoldEntry[]>(
    () =>
      displayedCapHolds.map((hold) => {
        const player = resolveCapHoldPlayer(hold, playersMap);
        const holdKeys = getHoldLookupKeys(hold);
        const playerKeys = getPlayerLookupKeys(player);
        const isOnRoster =
          Array.from(holdKeys).some((key) => rosterLookupKeys.has(key)) ||
          Array.from(playerKeys).some((key) => rosterLookupKeys.has(key));
        const rights = resolveFreeAgentRights(
          player as unknown as Parameters<typeof resolveFreeAgentRights>[0], // eslint-disable-next-line no-restricted-syntax -- LEDGER:CAST-172
          {
            // `currentYear` is the END year of the active column (e.g. 2027 for
            // the "2026-27" season). Free-agency years are START years (LeBron's
            // 2026 free agency), so convert to the season START year here — else
            // the resolver promotes NEXT season's free agents and drops this
            // year's. See [[one_screen_principle]].
            activeSeasonStartYear: currentYear - 1,
            holdType: hold.type,
            holdSeasonStartYear: toStartYear(hold.season),
            isOnRoster,
          }
        );

        return { hold, rights, player, isOnRoster };
      }),
    [currentYear, displayedCapHolds, playersMap, rosterLookupKeys]
  );

  const { mainFaHolds, sectionHolds } = useMemo(() => {
    // Dedup on VISIBLE rows only: a player who already renders as a roster row
    // shows their FA tag inline there, so their cap hold is redundant and is
    // dropped entirely. Own free agents whose contracts expired have no visible
    // row, so their holds DO render. See [[one_screen_principle]].
    const hasVisibleRow = (entry: ResolvedCapHoldEntry) => {
      for (const key of getHoldLookupKeys(entry.hold)) {
        if (visibleRosterKeys.has(key)) return true;
      }
      for (const key of getPlayerLookupKeys(entry.player)) {
        if (visibleRosterKeys.has(key)) return true;
      }
      return false;
    };
    const renderable = resolvedCapHolds.filter(
      (entry) => !hasVisibleRow(entry)
    );
    const main = renderable
      .filter((entry) => entry.rights.placement === 'main')
      .sort(
        (a, b) =>
          Number(b.rights.capHoldAmount || b.hold.amount || 0) -
          Number(a.rights.capHoldAmount || a.hold.amount || 0)
      );
    const section = renderable.filter((entry) => !main.includes(entry));

    return { mainFaHolds: main, sectionHolds: section };
  }, [resolvedCapHolds, visibleRosterKeys]);

  // Option B — interleave own free agents INTO the roster list, sorted on the
  // same key the roster uses (current-year dollar figure, current-year rows
  // first). A cap hold counts against the books at its full amount, so it earns
  // its place in money order rather than being bunched at the bottom.
  type OrderedCapRow = (
    | { kind: 'player'; player: CapSheetFullPlayerLike }
    | { kind: 'hold'; entry: ResolvedCapHoldEntry }
  ) & {
    isTwoWay: boolean;
    hasCurrent: boolean;
    currentAmount: number;
    firstVisibleYear: number;
    firstVisibleAmount: number;
    order: number;
  };
  const orderedRows = useMemo<OrderedCapRow[]>(() => {
    const entries: OrderedCapRow[] = [];
    let order = 0;

    for (const player of sortedPlayers) {
      const currentYearSlice = getContractYearSlice(player, currentYear);
      const currentAmount =
        Number(currentYearSlice?.salary ?? currentYearSlice?.capHit ?? 0) || 0;
      let firstVisibleYear = Number.MAX_SAFE_INTEGER;
      let firstVisibleAmount = 0;
      for (const year of allYears) {
        const slice = getContractYearSlice(player, year);
        if (!slice) continue;
        firstVisibleYear = year;
        firstVisibleAmount = Number(slice.salary ?? slice.capHit ?? 0) || 0;
        break;
      }
      entries.push({
        kind: 'player',
        player,
        isTwoWay: isTwoWayContract(player),
        hasCurrent: Boolean(currentYearSlice),
        currentAmount,
        firstVisibleYear,
        firstVisibleAmount,
        order: order++,
      });
    }

    for (const entry of mainFaHolds) {
      const { hold, rights } = entry;
      const holdEnd = toEndYear(hold.season) ?? Number.MAX_SAFE_INTEGER;
      const amount = Number(rights.capHoldAmount || hold.amount || 0);
      entries.push({
        kind: 'hold',
        entry,
        isTwoWay: isTwoWayContract(entry.player),
        hasCurrent: holdEnd === currentYear,
        currentAmount: holdEnd === currentYear ? amount : 0,
        firstVisibleYear: holdEnd,
        firstVisibleAmount: amount,
        order: order++,
      });
    }

    entries.sort((a, b) => {
      // Two-way contracts (and two-way cap holds) always sink to the very
      // bottom — they aren't real roster spots, regardless of dollar order.
      if (a.isTwoWay !== b.isTwoWay) return a.isTwoWay ? 1 : -1;
      if (a.hasCurrent !== b.hasCurrent) return a.hasCurrent ? -1 : 1;
      if (a.hasCurrent && b.hasCurrent) {
        const delta = b.currentAmount - a.currentAmount;
        return delta !== 0 ? delta : a.order - b.order;
      }
      const yearDelta = a.firstVisibleYear - b.firstVisibleYear;
      if (yearDelta !== 0) return yearDelta;
      const amountDelta = b.firstVisibleAmount - a.firstVisibleAmount;
      return amountDelta !== 0 ? amountDelta : a.order - b.order;
    });

    return entries;
  }, [sortedPlayers, mainFaHolds, allYears, currentYear]);

  // Own free agents render as real cap-table rows (headshot, name, re-sign cell,
  // hover-Absolve) — same shape as a roster row, just sourced from a cap hold.
  const renderFaHoldRow = (entry: ResolvedCapHoldEntry, idx: number) => {
    const { hold, rights } = entry;
    // An off-roster free agent often has no full player record in the local
    // map (their record isn't on the roster, and hold names are "Last, First"
    // while player keys are "First Last"). Render straight from the hold and
    // fall back to a minimal player so a free agent is NEVER hidden just because
    // the lookup missed — the cap hold IS the source of truth here.
    const player =
      entry.player ??
      ({
        playerId: hold.playerId,
        displayName: hold.playerName,
      } as unknown as CapSheetFullPlayerLike); // eslint-disable-next-line no-restricted-syntax -- LEDGER:CAST-173

    const tag = normalizeFAType(rights.freeAgentType || hold.type) || 'UFA';
    const amount = Number(rights.capHoldAmount || hold.amount || 0);
    const holdEndYear = toEndYear(hold.season);
    return (
      <div
        key={`fa-${hold.playerId ?? hold.playerName}-${idx}`}
        data-testid="cap-sheet-full-fa-decision-row"
        data-cap-fit-row
        className="group grid items-center transition-colors hover:bg-white/[0.02]"
        style={{ gridTemplateColumns: playerGridTemplate }}
      >
        <div className="sticky left-0 z-10 flex h-[var(--cap-row-h,24px)] items-center gap-2 border-r border-white/10 bg-[#0b0e14] px-3 shadow-[4px_0_24px_rgba(0,0,0,0.5)] transition-colors group-hover:bg-[#11151d]">
          <PlayerAvatar
            player={player}
            name={hold.playerName || String(hold.playerId || '?')}
          />
          <button
            onClick={() => openPlayerContractModal?.(player)}
            className="flex-1 truncate text-left text-[13px] font-bold tracking-tight text-white transition-colors hover:text-[color:var(--team-secondary,#FDB927)]"
            title={hold.playerName || String(hold.playerId || '')}
          >
            {hold.playerName || hold.playerId}
          </button>
          <div className="absolute inset-0 z-20 flex items-center justify-end bg-[#0b0e14] px-3 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="mr-auto truncate text-[13px] font-bold tracking-tight text-white">
              {hold.playerName || hold.playerId}
            </span>
            <button
              data-testid="cap-sheet-full-fa-absolve-button"
              data-action-exposure-classification="V1 supported"
              onClick={(e) => {
                e.stopPropagation();
                renounceCapHold?.(hold);
              }}
              className="rounded border border-red-500/20 bg-red-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-300 hover:bg-red-500/30"
            >
              Absolve
            </button>
          </div>
        </div>
        {allYears.map((year) => {
          const seasonStr = `${year - 1}-${String(year % 100).padStart(2, '0')}`;
          if (hold.season !== seasonStr) {
            return (
              <div
                key={year}
                className="h-[var(--cap-row-h,24px)] border-l border-white/[0.02] opacity-30"
              />
            );
          }
          // A cap hold is PLACEHOLDER money: same number style as a salary, but
          // dimmed + italic so it reads as "tentative / not locked in." No
          // tag chip — the cell tint already encodes the type (blue=UFA,
          // rose=RFA) and the tooltip spells it out. Bird icon sits bottom-right.
          return (
            <div
              key={year}
              data-testid="cap-sheet-full-fa-resign-cell"
              data-action-exposure-classification="V1 supported"
              onClick={() =>
                launchContractAction?.(
                  player,
                  tag === 'RFA' ? 'rfa' : 'ufa',
                  holdEndYear ?? year
                )
              }
              className={`relative flex h-[var(--cap-row-h,24px)] cursor-pointer items-center justify-center border-l border-white/[0.02] px-2 transition-all hover:ring-2 hover:ring-inset hover:ring-white/20 ${getFaCellTint(tag)}`}
              title={`Re-sign ${hold.playerName || ''} (${tag}) · ${formatCapSheetMoney(amount)} cap hold`}
            >
              <span className="text-xs font-semibold italic tabular-nums tracking-tight text-white/45">
                {formatCapSheetMoney(amount)}
              </span>
              {rights.birdType && rights.birdType !== 'None' ? (
                <span
                  className="absolute bottom-[2px] right-[2px] flex items-center justify-center rounded-sm bg-black/45 p-[1px] ring-1 ring-white/10"
                  data-testid="fa-bird-rights"
                  title={`${rights.birdType} rights`}
                >
                  <BirdRightsIcon type={rights.birdType} size={12} />
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

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
          ? {
              ...teamCapSheet,
              players: teamCapSheet.players?.map((p) => ({ ...p })),
            }
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

  // One tab in the unified bottom detail bar. Toggling re-opens/closes the
  // shared popover; only one detail surface is ever open at a time.
  const renderDetailTab = (
    id: 'dead' | 'holds' | 'exceptions' | 'legend',
    testId: string,
    label: string,
    count?: number
  ) => {
    const active = activeDetailTab === id;
    return (
      <button
        type="button"
        data-testid={testId}
        aria-expanded={active}
        onClick={() => setActiveDetailTab(active ? null : id)}
        className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
          active
            ? 'bg-white/10 text-cockpit-text-primary'
            : 'text-cockpit-text-secondary hover:bg-white/5 hover:text-cockpit-text-primary'
        }`}
      >
        <span
          className={`text-[10px] transition-transform duration-200 ${active ? 'rotate-90' : ''}`}
        >
          ▶
        </span>
        {label}
        {count != null ? (
          <span className="rounded bg-cockpit-raised px-1.5 text-[10px] text-cockpit-text-secondary">
            {count}
          </span>
        ) : null}
      </button>
    );
  };

  // ADAPTIVE ROW HEIGHT — the Full Cap Table is the workspace and must NEVER be
  // forced into a scroll, no matter the roster size or how much chrome sits
  // above it (e.g. the cockpit posture band). Rows read their height from the
  // `--cap-row-h` CSS variable; this effect measures the scroll viewport and,
  // when the natural 24px rows would overflow, shrinks every row by exactly the
  // overflow ÷ row-count (down to a readable floor) so the content fits in one
  // deterministic pass. The floor is generous enough that a real NBA roster
  // (≤18 + a few cap-hold rows) always fits on any normal screen.
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const DEFAULT_ROW_H = 24;
  const MIN_ROW_H = 18;
  useLayoutEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const fit = () => {
      // Measure the natural layout at the default row height first.
      el.style.setProperty('--cap-row-h', `${DEFAULT_ROW_H}px`);
      const rows = el.querySelectorAll('[data-cap-fit-row]');
      const rowCount = rows.length;
      const available = el.clientHeight;
      const content = el.scrollHeight;
      if (rowCount === 0 || content <= available) {
        el.style.setProperty('--cap-row-h', `${DEFAULT_ROW_H}px`);
        return;
      }
      const overflowPerRow = Math.ceil((content - available) / rowCount);
      const nextRowH = Math.max(MIN_ROW_H, DEFAULT_ROW_H - overflowPerRow);
      el.style.setProperty('--cap-row-h', `${nextRowH}px`);
    };
    fit();
    // ResizeObserver is unavailable in jsdom/non-browser envs — guard so the
    // initial fit still runs there without crashing.
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
    // Re-fit whenever the row population changes (players, year span, or the
    // free-agent / cap-hold rows that share the scroll area).
  }, [orderedRows.length, allYears.length]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col font-sans text-cockpit-text-primary">
      <section
        aria-label={CAP_SHEET_FULL_SURFACE_LABELS.primary}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div
          ref={surfaceRef}
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
                Full Cap Table
              </span>
            </div>
            {(hasManualCapSheetMutationAuthority ||
              onLaunchFreeAgentSearch) && (
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
                    data-action-exposure-classification="preview-only"
                    type="button"
                    title="Standard free-agent signing preview"
                    onClick={() => onLaunchFreeAgentSearch()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-black/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition-transform hover:scale-[1.03]"
                    style={{ background: 'var(--team-secondary,#FDB927)' }}
                  >
                    + Sign Free Agent
                    <span className="rounded bg-black/20 px-1 text-[9px]">
                      Preview
                    </span>
                  </button>
                ) : null}
              </div>
            )}
          </div>

          {/* Cap posture + roster status are NOT shown here — they live in the
              single canonical CURRENT POSTURE drawer (cockpit). Duplicating them
              per-feature is forbidden, and this surface owes its vertical space
              to the Full Cap Table (must fit ~18 rows with no scroll). */}

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
            <div ref={tableScrollRef} className="min-h-0 flex-1 overflow-auto">
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
                  {orderedRows.map((row, idx) => {
                    if (row.kind === 'hold') {
                      return renderFaHoldRow(row.entry, idx);
                    }
                    const player = row.player;
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
                      ? (allYears.find((year) => {
                          const amounts = getPlayerCapSheetAmountsForYear(
                            player,
                            year
                          );
                          return (
                            Boolean(amounts.contractSlice) ||
                            amounts.capHit > 0 ||
                            amounts.baseSalary > 0
                          );
                        }) ?? null)
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
                        data-cap-fit-row
                        data-testid={
                          isRowHighlighted
                            ? 'cap-sheet-full-player-row-highlighted'
                            : undefined
                        }
                      >
                        {/* Player Name (Sticky) */}
                        <div className="sticky left-0 z-10 flex h-[var(--cap-row-h,24px)] items-center gap-2 border-r border-white/10 bg-[#0b0e14] px-3 shadow-[4px_0_24px_rgba(0,0,0,0.5)] transition-colors group-hover:bg-[#11151d]">
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
                                    ['extend', 'Extend (Preview)'],
                                    ['waive', 'Waive (Preview)'],
                                    ['stretch', 'Stretch (Preview)'],
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
                            typeof freeAgency === 'object' &&
                            freeAgency !== null
                              ? freeAgency.year
                              : undefined;
                          const fallbackFaType = normalizeFAType(
                            typeof freeAgency === 'object' &&
                              freeAgency !== null
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
                            rulesProfileForYear?.contractSummary
                              ?.freeAgencyYear ?? fallbackFaYear;
                          const derivedFaTypeRaw =
                            rulesProfileForYear?.contractSummary
                              ?.freeAgencyType || fallbackFaType;
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
                                  className={`relative flex items-center justify-center px-2 border-l border-white/[0.02] h-[var(--cap-row-h,24px)] cursor-pointer hover:ring-2 hover:ring-inset hover:ring-white/20 transition-all ${getFaCellTint(faLabel)}`}
                                  title={`Preview: ${
                                    rfaInfo?.reason ||
                                    rulesProfileForYear?.contractSummary
                                      ?.freeAgencyType ||
                                    'free-agent action'
                                  }`}
                                >
                                  <span
                                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getTagColor(faLabel)} transition-transform hover:scale-105`}
                                  >
                                    {faLabel}
                                  </span>
                                  {birdRightsTypeForYear && (
                                    <span
                                      className="absolute bottom-[2px] right-[2px] flex items-center justify-center rounded-sm bg-black/45 p-[1px] ring-1 ring-white/10"
                                      data-testid="fa-bird-rights"
                                      title={`${birdRightsTypeForYear} rights`}
                                    >
                                      <BirdRightsIcon
                                        type={birdRightsTypeForYear}
                                        size={12}
                                      />
                                    </span>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <div
                                key={year}
                                className="border-l border-white/[0.02] h-[var(--cap-row-h,24px)]"
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
                                className={`relative flex items-center justify-center px-2 py-2 border-l border-white/[0.02] h-[var(--cap-row-h,24px)] transition-all cursor-pointer hover:ring-2 hover:ring-inset hover:ring-white/20 ${optionStyle}`}
                                title={`Preview: manage ${isPO ? 'Player' : 'Team'} Option`}
                                data-action-exposure-classification="preview-only"
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
                              className={`relative flex items-center justify-center px-2 py-2 border-l border-white/[0.02] h-[var(--cap-row-h,24px)] ${
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
                    to the bottom of the scroll area so it is always visible.
                    Incomplete Roster Charges render as a contributor row
                    *inside* this same block, directly above Total Cap, so the
                    sum and its components read together (and a thin future year
                    no longer shows a total with no visible contributors). */}
                <div
                  className="sticky bottom-0 z-20 border-t-2"
                  style={{
                    borderTopColor: 'var(--team-secondary,#FDB927)',
                    background:
                      'color-mix(in srgb, var(--team-primary,#4F46E5) 22%, #0B0E14)',
                  }}
                >
                  {hasIncompleteCharges ? (
                    <div
                      data-testid="cap-sheet-full-incomplete-roster-charges"
                      aria-label="Multi-year incomplete roster charges surface"
                      className="grid items-stretch border-b border-white/10"
                      style={{ gridTemplateColumns: playerGridTemplate }}
                    >
                      <div
                        className="sticky left-0 z-30 flex items-center border-r border-white/10 px-3 py-1 shadow-[4px_0_24px_rgba(0,0,0,0.5)]"
                        style={{
                          background:
                            'color-mix(in srgb, var(--team-primary,#4F46E5) 34%, #0B0E14)',
                        }}
                        title="Incomplete Roster Charges — minimum-salary charges for empty roster spots below the 12-player minimum. Included in the Total Cap below."
                      >
                        <span className="whitespace-normal break-words text-[9px] font-semibold uppercase leading-[1.15] text-amber-200/80">
                          Incomplete roster charges
                        </span>
                      </div>
                      {allYears.map((year) => {
                        const { incompleteChargesTotal } =
                          yearTotalBreakdowns[year];
                        return (
                          <div
                            key={year}
                            className="flex items-center justify-center border-l border-white/10 px-2 py-1 text-[10px] tabular-nums text-amber-200/80"
                          >
                            {incompleteChargesTotal > 0
                              ? formatCapSheetMoney(incompleteChargesTotal)
                              : ''}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  <div
                    role="region"
                    aria-label={
                      CAP_SHEET_FULL_SURFACE_LABELS.canonicalYearlyTotals
                    }
                    className="grid font-bold"
                    style={{ gridTemplateColumns: playerGridTemplate }}
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
                      <span className="sr-only">
                        {'Canonical Yearly Totals'}
                      </span>
                      <span className="sr-only">
                        {'Canonical yearly total'}
                      </span>
                      <span className="sr-only">
                        {
                          'Player rows above and cap hold details below support the same future-year cap story.'
                        }
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
                          $
                          {yearTotalBreakdowns[
                            year
                          ].totalCapAllocations.toLocaleString()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SUPPORTING DETAIL SURFACE: Cap holds remain separate from player rows
            and explain part of the same canonical Total Cap story. The bar
            always renders so the compact Key (legend) is reachable even when a
            team has no holds / dead money / exceptions to show. */}
          {(() => {
              // 1. Create a map of player ID/Name to index from the main sortedPlayers list
              // This allows us to replicate the main table's sort order.
              const playerSortMap = new Map<string, number>();
              sortedPlayers.forEach((p, idx) => {
                for (const key of getPlayerLookupKeys(p)) {
                  playerSortMap.set(key, idx);
                }
              });

              // 2. Split holds into "Roster Players" (Group A) and "Legacy/Other" (Group B).
              //    This drawer holds only future-season and dead holds; this
              //    offseason's own free agents already render in the cap table above.
              const rosterHolds: ResolvedCapHoldEntry[] = [];
              const otherHolds: ResolvedCapHoldEntry[] = [];

              sectionHolds.forEach((entry) => {
                const keys = new Set([
                  ...getHoldLookupKeys(entry.hold),
                  ...getPlayerLookupKeys(entry.player),
                ]);
                if (Array.from(keys).some((key) => playerSortMap.has(key))) {
                  rosterHolds.push(entry);
                } else {
                  otherHolds.push(entry);
                }
              });

              // 3. Sort Group A to match main table
              rosterHolds.sort((a, b) => {
                const aKeys = new Set([
                  ...getHoldLookupKeys(a.hold),
                  ...getPlayerLookupKeys(a.player),
                ]);
                const bKeys = new Set([
                  ...getHoldLookupKeys(b.hold),
                  ...getPlayerLookupKeys(b.player),
                ]);
                const idxA =
                  Array.from(aKeys)
                    .map((key) => playerSortMap.get(key))
                    .find((index) => index != null) ?? 9999;
                const idxB =
                  Array.from(bKeys)
                    .map((key) => playerSortMap.get(key))
                    .find((index) => index != null) ?? 9999;
                return idxA - idxB;
              });

              const renderHoldRow = (
                entry: ResolvedCapHoldEntry,
                idx: number,
                isLegacy = false
              ) => {
                const h = entry.hold;
                const amount = Number(
                  entry.rights.capHoldAmount || h.amount || 0
                );
                const tag = normalizeFAType(
                  entry.rights.freeAgentType || h.type
                );
                return (
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
                          data-action-exposure-classification="V1 supported"
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

                    {/* Tag Column — dead/zombie holds (departed players never
                  renounced, or past seasons) are marked DEAD so they read as
                  renounce-able clutter, not live decisions. */}
                    <div className="px-1 py-1 flex items-center justify-center border-r border-cockpit-edge h-[24px]">
                      {entry.rights.isDeadHold ? (
                        <span
                          className="px-1 py-px rounded-[2px] text-[8px] font-bold uppercase tracking-wider truncate max-w-full border border-zinc-500/30 bg-zinc-600/20 text-zinc-300"
                          title="Renounce-able hold for a departed player — not a live decision"
                        >
                          DEAD
                        </span>
                      ) : (
                        <span
                          className={`${getTagColor(h.type || null)} px-1 py-px rounded-[2px] text-[8px] font-bold uppercase tracking-wider truncate max-w-full`}
                        >
                          {h.type === 'FA Cap Hold'
                            ? 'HOLD'
                            : tag || h.type || 'HOLD'}
                        </span>
                      )}
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
                              ${amount.toLocaleString()}
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
              };

              // The bar always renders so the compact Key (legend) is reachable,
              // but the `cap-sheet-full-cap-tools` identity only applies when
              // there are real cap tools (dead money / holds / exceptions) — a
              // legend-only bar is not the Cap Tools surface.
              const hasCapTools =
                displayedDeadMoney.length > 0 ||
                sectionHolds.length > 0 ||
                Boolean(exceptionsReadout);
              return (
                <section
                  ref={detailBarRef}
                  aria-label={
                    hasCapTools ? 'Cap detail tabs' : 'Cap table legend'
                  }
                  data-testid={
                    hasCapTools ? 'cap-sheet-full-cap-tools' : undefined
                  }
                  className="relative shrink-0 border-t border-cockpit-edge px-4 py-1"
                >
                  {/* The active panel pops up ABOVE the bar (absolute) so opening
                      a detail never pushes the Full Cap Table into scroll. Its
                      height is capped to the room above the bar (measured into
                      detailPopoverMaxH) so on a short roster it scrolls
                      internally instead of overrunning the table / top chrome. */}
                  {activeDetailTab ? (
                    <div
                      className="absolute bottom-full left-2 right-2 z-30 mb-1 overflow-auto rounded-lg border border-cockpit-edge bg-cockpit-inlay shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150"
                      style={
                        detailPopoverMaxH
                          ? { maxHeight: detailPopoverMaxH }
                          : undefined
                      }
                    >
                      {activeDetailTab === 'dead' &&
                      displayedDeadMoney.length > 0 ? (
                        <div>
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
                                style={{
                                  gridTemplateColumns: playerGridTemplate,
                                }}
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
                                      {amount > 0
                                        ? formatCapSheetMoney(amount)
                                        : ''}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {activeDetailTab === 'holds' &&
                      sectionHolds.length > 0 ? (
                        <div>
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
                            {rosterHolds.map((h, i) =>
                              renderHoldRow(h, i, false)
                            )}
                            {rosterHolds.length > 0 &&
                              otherHolds.length > 0 && (
                                <div className="h-[2px] bg-white/10 w-full col-span-full relative">
                                  <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-white/20"></div>
                                </div>
                              )}
                            {otherHolds.map((h, i) =>
                              renderHoldRow(h, i, true)
                            )}
                          </div>
                        </div>
                      ) : null}
                      {activeDetailTab === 'exceptions' && exceptionsReadout ? (
                        <div
                          data-testid="cap-sheet-full-exceptions-readout"
                          className="space-y-2 p-3"
                        >
                          {exceptionsReadout}
                        </div>
                      ) : null}
                      {activeDetailTab === 'legend' ? (
                        <div
                          data-testid="cap-sheet-full-legend"
                          className="p-3 text-[11px] text-cockpit-text-secondary"
                        >
                          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
                            Key
                          </div>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getTagColor('UFA')}`}
                              >
                                UFA
                              </span>
                              <span>Unrestricted free agent</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getTagColor('RFA')}`}
                              >
                                RFA
                              </span>
                              <span>Restricted free agent</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getTagColor('PO')}`}
                              >
                                PO
                              </span>
                              <span>Player option</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getTagColor('TO')}`}
                              >
                                TO
                              </span>
                              <span>Team option</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getTagColor('TWO-WAY')}`}
                              >
                                2W
                              </span>
                              <span>Two-way contract</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="relative flex h-5 w-7 items-center justify-center rounded-sm bg-black/45 p-[1px] ring-1 ring-white/10">
                                <BirdRightsIcon type="Full Bird" size={14} />
                              </span>
                              <span>Bird rights (re-sign exception)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="relative inline-block h-5 w-7">
                                <span
                                  aria-hidden
                                  className="block h-0 w-0 border-r-[13px] border-t-[13px] border-r-transparent border-t-cyan-400/90"
                                />
                                <span
                                  aria-hidden
                                  className="absolute left-[1px] top-0 text-[7px] font-bold uppercase leading-none text-[#06222b]"
                                >
                                  E
                                </span>
                              </span>
                              <span>Extension-eligible season</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-5 w-7 rounded ${EXTENSION_CELL_STYLE}`}
                              />
                              <span>Active extension years</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-5 w-7 rounded ${getFaCellTint('UFA')}`}
                              />
                              <span>UFA / RFA cap-hold cell</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="h-5 w-7 rounded bg-amber-400/[0.12] ring-1 ring-amber-400/20" />
                              <span>Incl. roster charges</span>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {displayedDeadMoney.length > 0
                        ? renderDetailTab(
                            'dead',
                            'cap-sheet-full-dead-money-toggle',
                            'Dead Money',
                            displayedDeadMoney.length
                          )
                        : null}
                      {sectionHolds.length > 0
                        ? renderDetailTab(
                            'holds',
                            'cap-sheet-full-cap-holds-toggle',
                            'Cap Holds',
                            sectionHolds.length
                          )
                        : null}
                      {exceptionsReadout
                        ? renderDetailTab(
                            'exceptions',
                            'cap-sheet-full-exceptions-toggle',
                            'Exceptions & Hard Cap'
                          )
                        : null}
                    </div>
                    {renderDetailTab(
                      'legend',
                      'cap-sheet-full-legend-toggle',
                      'Key'
                    )}
                  </div>
                </section>
              );
            })()}
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
