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
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { capConfidenceLabel } from '../CapConfidenceBadge';
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
import { POSITION_MAP } from '@/shared/utils/roles';
import { getCapPercentage } from '@/features/architect/utils/basicArchitectUtils';
import { usePlayerRulesProfiles } from '@/features/architect/hooks/usePlayerRulesProfiles';
import { ManageDeadMoneyModal } from '@/features/architect/capSheet/modals/ManageDeadMoneyModal';
import { ManageExceptionsModal } from '@/features/architect/capSheet/modals/ManageExceptionsModal';
import { playerMatchesFocus } from '@/features/architect/GMDashboard/postActionHandoff/playerFocus';
import { PlayerActionMenu } from '@/features/architect/cockpit/PlayerActionMenu';
import {
  buildPlayerActionContext,
  type PlayerAction,
  type PlayerActionContext,
} from '@/features/architect/cockpit/playerActionContext';

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
  playerId?: string | number | null;
  playerName?: string | null;
  label?: string | null;
  originalSalary?: NumericLike;
  amountByYear?:
    | DeadCapAmountByYearArrayEntry[]
    | Record<string, DeadCapAmountByYearObjectValue>
    | null;
  waiveDate?: string | null;
  notes?: string | null;
  stretched?: boolean | null;
};
type TeamCapSheetLike = Omit<
  PlayerRulesProfileTeamCapSheet,
  'players' | 'deadCap'
> & {
  players?: CapSheetPlayerLike[] | null;
  deadCap?: DeadCapSourceEntry[] | null;
  teamName?: string | null;
  name?: string | null;
  abbreviation?: string | null;
  id?: string | null;
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
export type ManualExceptionEntry = {
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
export type ManualTradeExceptionEntry = {
  id: string;
  totalAmount?: number | null;
  usedAmount?: number | null;
  remainingAmount?: number | null;
  createdFrom?: string | null;
  createdOn?: string | null;
  expiresOn?: string | null;
  notes?: string | null;
};
export type ManualExceptionsSavePayload = {
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
  /**
   * Stage 2C: receipt-derived focused player id. The matching player
   * row renders a non-mutating "just changed" outline. Visual only —
   * no cap totals impact, no row reordering, no action behavior change.
   */
  highlightPlayerId?: string | null;
  /** Multi-focus highlight (pinned players). Unioned with highlightPlayerId. */
  highlightPlayerIds?: string[];
  /**
   * Unified player-action intents (Pin/Unpin, Trade, cross-room navigation)
   * routed by GMDashboard via routePlayerAction. Open stays the name click.
   * When omitted, no row menu renders (other call sites unaffected).
   */
  onPlayerAction?:
    | ((action: PlayerAction, context: PlayerActionContext) => void)
    | null;
  /** Pinned ids so the row menu can show Pin vs Unpin. */
  pinnedPlayerIds?: string[];
};

const CAP_SHEET_SURFACE_LABELS = {
  canonicalTotalsSummary: 'Selected-year canonical totals summary surface',
  rosterDetail: 'Selected-year roster detail surface',
  capHoldsDetail: 'Selected-year cap holds detail surface',
  canonicalTotalsBreakdown: 'Selected-year canonical totals breakdown surface',
} as const;

const resolveTeamPlanLabel = (teamCapSheet: TeamCapSheetLike) =>
  teamCapSheet.teamName ||
  teamCapSheet.name ||
  teamCapSheet.teamCode ||
  teamCapSheet.abbreviation ||
  (teamCapSheet.id != null ? String(teamCapSheet.id) : 'Active team');

const formatCapSheetMoney = (amount: NumericLike) =>
  `$${Number(amount ?? 0).toLocaleString()}`;

const getPlayerDisplayName = (player: CapSheetPlayerLike) =>
  player.displayName || player.bio?.displayName || player.name || 'Unknown';

const getPlayerInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

const resolveHeadshotSlug = (player: CapSheetPlayerLike): string => {
  const anyPlayer = player as {
    id?: unknown;
    player_id?: unknown;
    playerId?: unknown;
    name?: unknown;
    bio?: { playerId?: unknown };
  };
  const raw =
    anyPlayer.bio?.playerId ??
    anyPlayer.playerId ??
    anyPlayer.id ??
    anyPlayer.player_id ??
    anyPlayer.name ??
    '';
  return String(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const PlayerAvatar = ({
  player,
  name,
}: {
  player: CapSheetPlayerLike;
  name: string;
}) => {
  const [failed, setFailed] = useState(false);
  const slug = resolveHeadshotSlug(player);

  if (failed || !slug) {
    return (
      <span
        aria-hidden
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-extrabold tracking-wide text-[color:var(--team-on-primary,#fff)]"
        style={{
          background:
            'linear-gradient(135deg, var(--team-primary,#4F46E5), #0b0e14)',
          boxShadow:
            'inset 0 0 0 1.5px color-mix(in srgb, var(--team-secondary,#FDB927) 60%, transparent), 0 1px 4px rgba(0,0,0,0.5)',
        }}
      >
        {getPlayerInitials(name) || '-'}
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

export const CapSheet = ({
  teamCapSheet,
  currentYear,
  selectedYear: controlledSelectedYear = null,
  onSelectedYearChange = null,
  onOpenPlayerContractModal,
  onSelectPlayer,
  manualCapSheetMutationAuthority,
  highlightPlayerId = null,
  highlightPlayerIds = [],
  onPlayerAction = null,
  pinnedPlayerIds = [],
}: CapSheetProps) => {
  const [internalSelectedYear, setInternalSelectedYear] = useState(currentYear);
  const [showCapHolds, setShowCapHolds] = useState(false);
  const [showCapTools, setShowCapTools] = useState(false);
  const [showDeadMoneyModal, setShowDeadMoneyModal] = useState(false);
  const [showExceptionsModal, setShowExceptionsModal] = useState(false);
  const hasManualCapSheetMutationAuthority =
    !!manualCapSheetMutationAuthority;
  const openPlayerContractModal =
    onOpenPlayerContractModal ?? onSelectPlayer ?? null;
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const hasControlledSelectedYear = Number.isFinite(controlledSelectedYear);
  const selectedYear = hasControlledSelectedYear
    ? Number(controlledSelectedYear)
    : internalSelectedYear;
  const isViewingCurrentYear = selectedYear === currentYear;
  const canManageExceptions =
    hasManualCapSheetMutationAuthority && isViewingCurrentYear;
  const focusedCapSheetPlayerIds = useMemo(
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

  useLayoutEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;

    const DEFAULT_ROW_H = 36;
    const MIN_ROW_H = 20;

    const fitRows = () => {
      el.style.setProperty('--cap-sheet-row-h', `${DEFAULT_ROW_H}px`);
      const rows = el.querySelectorAll('[data-cap-sheet-fit-row]');
      const rowCount = rows.length;
      if (rowCount === 0 || el.scrollHeight <= el.clientHeight) return;

      const overflowPerRow = Math.ceil(
        (el.scrollHeight - el.clientHeight) / rowCount
      );
      el.style.setProperty(
        '--cap-sheet-row-h',
        `${Math.max(MIN_ROW_H, DEFAULT_ROW_H - overflowPerRow)}px`
      );
    };

    fitRows();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fitRows);
    observer.observe(el);
    return () => observer.disconnect();
  }, [
    selectedYear,
    showCapHolds,
    showCapTools,
    teamCapSheet?.players?.length,
    teamCapSheet?.capHolds?.length,
  ]);

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
    return (
      <div className="p-4 text-sm text-cockpit-text-secondary">
        Loading cap sheet…
      </div>
    );
  }

  if (!teamCapSheet.players) {
    return (
      <div className="p-4 text-sm text-cockpit-text-secondary">
        Loading players…
      </div>
    );
  }

  const generateYears = (startYear: number, count: number) =>
    Array.from({ length: count }, (_, i) => startYear + i);

  const allYears = generateYears(currentYear, 7);

  const formatYearLabel = (year: number) =>
    `${year - 1}-${String(year % 100).padStart(2, '0')}`;
  const currentSeasonLabel = formatYearLabel(currentYear);
  const selectedSeasonLabel = formatYearLabel(selectedYear);
  const teamPlanLabel = resolveTeamPlanLabel(teamCapSheet);

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
        className: 'bg-cockpit-raised border-cockpit-edge text-cockpit-text-muted',
      });
    if (isPO)
      notes.push({
        label: 'PO',
        className: 'bg-cockpit-safe/10 border-cockpit-safe/30 text-cockpit-safe',
      });
    if (isTO)
      notes.push({
        label: 'TO',
        className: 'bg-cockpit-watch/10 border-cockpit-watch/30 text-cockpit-watch',
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
          ? 'bg-cockpit-info/10 border-cockpit-info/30 text-cockpit-info'
          : 'bg-cockpit-watch/10 border-cockpit-watch/30 text-cockpit-watch',
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
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cockpit-raised text-cockpit-text-muted border border-cockpit-edge ${
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

  const confidenceLabel = React.useMemo(
    () =>
      capConfidenceLabel(
        canonicalTotals?._meta?.rulesSourcesSummary as string | undefined
      ),
    [canonicalTotals]
  );

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
    <div className="flex h-full min-h-0 w-full flex-col font-sans text-cockpit-text-primary">
      {/*
        Phase 2A cockpit migration: the 5-tile canonical totals summary
        (Total Cap, Cap Space, Luxury Tax Space, 1st/2nd Apron Space) moved
        to the persistent TeamStatusStrip below the cockpit TopBar so the
        team's financial posture is visible from every room — not only when
        the user is on the Cap Sheet. The legacy CapSummaryTiles component
        is intentionally left in the codebase (it is still referenced by
        tests and may be reused). Phase 2C will retire it.
      */}

      <section
        aria-label={CAP_SHEET_SURFACE_LABELS.rosterDetail}
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-cockpit-edge bg-cockpit-slab shadow-cockpit-slab"
      >
        {/* SUPPORTING DETAIL SURFACE: Player rows explain year-by-year contract detail.
            They may borrow canonical thresholds for display, but they do not own totals truth. */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-cockpit-edge bg-cockpit-bar px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              className="h-5 w-1 rounded-full"
              style={{ background: 'var(--team-secondary,#FDB927)' }}
            />
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold uppercase italic tracking-wide text-cockpit-text-primary">
                Salary Detail
                <span className="sr-only">
                  Selected-Year Supporting Detail
                </span>
              </span>
              <span className="rounded border border-cockpit-edge bg-cockpit-raised px-2 py-0.5 text-[10px] font-semibold text-cockpit-text-secondary">
                {selectedSeasonLabel}
              </span>
              <span className="rounded border border-cockpit-edge bg-cockpit-raised px-2 py-0.5 text-[10px] font-semibold text-cockpit-text-secondary tabular-nums">
                {filteredPlayers.length}{' '}
                {filteredPlayers.length === 1 ? 'contract' : 'contracts'}
              </span>
              {confidenceLabel ? (
                <span
                  className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${confidenceLabel.className}`}
                >
                  {confidenceLabel.text}
                </span>
              ) : null}
              <span className="sr-only">
                Contract-by-contract detail for {teamPlanLabel} in{' '}
                {selectedSeasonLabel}.
              </span>
              <span className="sr-only">
                Player rows show player salaries only. Total Cap Hit also
                includes dead money, cap holds, and incomplete roster charges
                when present.
              </span>
            </div>
          </div>

          <div className="flex max-w-full overflow-x-auto rounded-md border border-cockpit-edge bg-cockpit-inlay p-0.5">
            {allYears.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => handleSelectYear(year)}
                className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                  year === selectedYear
                    ? 'bg-cockpit-raised text-cockpit-text-primary shadow-sm'
                    : 'text-cockpit-text-muted hover:bg-cockpit-slab hover:text-cockpit-text-primary'
                }`}
              >
                {formatYearLabel(year)}
              </button>
            ))}
          </div>
        </div>

        <div ref={tableScrollRef} className="min-h-0 flex-1 overflow-auto">
          <div className="min-w-[920px]">
            {/* Roster detail table header */}
            <div className="sticky top-0 z-20 grid grid-cols-[2.25fr,0.55fr,0.45fr,1fr,0.6fr,1fr,1.45fr] gap-2 border-b border-cockpit-edge bg-cockpit-bar px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
              <div>Player</div>
              <div>Pos</div>
              <div>Age</div>
              <div className="text-right">Cap Hit</div>
              <div className="text-right">Cap %</div>
              <div className="text-right">Base Salary</div>
              <div className="text-right">Notes</div>
            </div>

            {/* Supporting detail rows */}
            <div className="divide-y divide-cockpit-edge">
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
                const isHighlighted = focusedCapSheetPlayerIds.some((focusId) =>
                  playerMatchesFocus(player, focusId)
                );
                const rowHighlightClass = isHighlighted
                  ? 'ring-1 ring-inset ring-[color:var(--team-secondary,#FDB927)]/50 bg-[color:var(--team-primary,#4F46E5)]/[0.08]'
                  : 'hover:bg-[color:var(--team-primary,#4F46E5)]/[0.06]';
                const displayName = getPlayerDisplayName(player);

                return (
                  <div
                    key={`${player.name}-${idx}`}
                    className={`group grid min-h-[var(--cap-sheet-row-h,36px)] grid-cols-[2.25fr,0.55fr,0.45fr,1fr,0.6fr,1fr,1.45fr] items-center gap-2 px-3 py-0.5 transition-colors ${rowHighlightClass}`}
                    data-cap-sheet-fit-row
                    data-testid={
                      isHighlighted
                        ? 'cap-sheet-player-row-highlighted'
                        : undefined
                    }
                  >
                    <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-cockpit-text-primary">
                      <PlayerAvatar player={player} name={displayName} />
                      <button
                        data-testid="cap-sheet-player-row-button"
                        onClick={() => openPlayerContractModal?.(player)}
                        className="min-w-0 flex-1 truncate text-left text-xs font-bold tracking-tight text-cockpit-text-primary transition-colors hover:text-[color:var(--team-secondary,#FDB927)]"
                        title={displayName}
                      >
                        {displayName}
                      </button>
                      {(() => {
                        if (!onPlayerAction) return null;
                        const menuContext = buildPlayerActionContext({
                          player,
                          sourceRoom: 'cap',
                          targetYear: selectedYear,
                        });
                        if (!menuContext) return null;
                        const isPinned = pinnedPlayerIds.some((focusId) =>
                          playerMatchesFocus(player, focusId)
                        );
                        return (
                          <PlayerActionMenu
                            context={menuContext}
                            visibleActions={[]}
                            overflowActions={[
                              'pin',
                              'trade',
                              'view-on-roster',
                              'view-in-full-cap',
                              'find-in-history',
                              'compare-impact',
                              'guide-next-move',
                            ]}
                            isPinned={isPinned}
                            menuAlign="left"
                            testIdPrefix="cap-sheet-player-row"
                            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
                            onAction={onPlayerAction}
                          />
                        );
                      })()}
                    </div>
                    <div className="text-[10px] font-semibold text-cockpit-text-muted">
                      {POSITION_MAP[position as keyof typeof POSITION_MAP] ||
                        position ||
                        '—'}
                    </div>
                    <div className="text-[10px] text-cockpit-text-muted">{age}</div>
                    <div className="text-right text-xs font-medium tabular-nums tracking-tight">
                      <span
                        className={`inline-flex items-center justify-end rounded px-1.5 py-0.5 tabular-nums ${
                          isExtensionSeason
                            ? 'border border-cockpit-info/30 bg-cockpit-info/10 text-cockpit-info'
                            : 'bg-cockpit-raised text-cockpit-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                        }`}
                      >
                        {formatCapSheetMoney(capHit)}
                      </span>
                    </div>
                    <div className="text-right text-[10px] tabular-nums text-cockpit-text-muted">
                      {capPctDisplay}
                    </div>
                    <div className="text-right text-[10px] tabular-nums">
                      <span
                        className={`inline-flex items-center justify-end ${
                          isExtensionSeason ? 'text-cockpit-info' : 'text-cockpit-text-muted'
                        }`}
                      >
                        {formatCapSheetMoney(salary)}
                      </span>
                    </div>
                    <div className="text-[10px]">
                      {renderNotes(player, selectedYear, rulesProfile)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Supporting detail, control rows, and canonical totals breakdown stay
            in one frame visually, but remain separated by ownership below.
            BZE-216 hierarchy rework: the default view keeps only the one-line
            canonical totals bar and one slim strip; cap-hold rows and the
            dead-money/exception tools open on demand instead of stacking
            under the table. */}
        <div className="shrink-0 border-t border-cockpit-edge bg-cockpit-slab">
          {/* CANONICAL TOTALS CONSUMER SURFACE: This breakdown bar consumes
              canonicalTotals directly and defines the totals view. */}
          <section
            aria-label={CAP_SHEET_SURFACE_LABELS.canonicalTotalsBreakdown}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1"
          >
            <p className="sr-only">
              Total Cap Hit Breakdown
              <span className="sr-only">Team Plan Total Breakdown</span>
            </p>
            <p className="sr-only">
              This breakdown matches the summary tiles above. Player salaries
              from the table above plus non-player cap allocations roll into
              the total below.
            </p>
            <div className="flex min-w-0 items-baseline gap-1.5">
              <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
                Player Salaries
              </p>
              <span className="text-xs font-bold text-cockpit-text-primary tabular-nums">
                {formatCapSheetMoney(canonicalTotals.playersTotal)}
              </span>
            </div>

            {canonicalTotals.deadMoneyTotal > 0 && (
              <div className="flex min-w-0 items-baseline gap-1.5">
                <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
                  Dead Money
                </p>
                <span className="text-xs font-bold text-cockpit-text-primary tabular-nums">
                  {formatCapSheetMoney(canonicalTotals.deadMoneyTotal)}
                </span>
              </div>
            )}

            {canonicalTotals.capHoldsTotal > 0 && (
              <div className="flex min-w-0 items-baseline gap-1.5">
                <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
                  Cap Holds
                </p>
                <span className="text-xs font-bold text-cockpit-text-primary tabular-nums">
                  {formatCapSheetMoney(canonicalTotals.capHoldsTotal)}
                </span>
              </div>
            )}

            {canonicalTotals.incompleteChargesTotal > 0 && (
              <div
                data-testid="incomplete-roster-charge-row"
                className="flex min-w-0 items-baseline gap-1.5"
              >
                <p
                  className="truncate text-[10px] font-semibold uppercase tracking-wider text-cockpit-watch"
                  title={
                    canonicalTotals._meta?.incompleteRosterCharge?.missingSlots
                      ? `Incomplete Roster Charge — ${canonicalTotals._meta.incompleteRosterCharge.missingSlots} open ${
                          canonicalTotals._meta.incompleteRosterCharge
                            .missingSlots === 1
                            ? 'slot'
                            : 'slots'
                        }`
                      : 'Incomplete Roster Charge'
                  }
                >
                  Incomplete Roster Charge
                  {canonicalTotals._meta?.incompleteRosterCharge
                    ?.missingSlots ? (
                    <span className="sr-only">
                      {' '}
                      {
                        canonicalTotals._meta.incompleteRosterCharge
                          .missingSlots
                      }{' '}
                      open{' '}
                      {canonicalTotals._meta.incompleteRosterCharge
                        .missingSlots === 1
                        ? 'slot'
                        : 'slots'}
                    </span>
                  ) : null}
                </p>
                <span className="text-xs font-bold tabular-nums text-cockpit-watch">
                  {formatCapSheetMoney(canonicalTotals.incompleteChargesTotal)}
                </span>
              </div>
            )}

            <div className="ml-auto flex shrink-0 items-baseline gap-2 rounded-md border border-cockpit-edge bg-cockpit-raised px-2.5 py-0.5">
              <p className="whitespace-nowrap text-[10px] font-extrabold uppercase tracking-wider text-cockpit-text-primary">
                Total Cap Hit
                <span className="sr-only">Canonical Totals Consumer</span>
              </p>
              <span className="whitespace-nowrap text-sm font-extrabold tracking-tight text-cockpit-text-primary tabular-nums">
                {formatCapSheetMoney(canonicalTotals.totalCapAllocations)}
              </span>
            </div>
          </section>

          {/* Slim secondary strip: cap-hold detail and the dead-money /
              exception tools live behind toggles so the salary table keeps
              the default-view space. */}
          <div className="flex flex-wrap items-stretch border-t border-cockpit-edge">
            {/* SUPPORTING DETAIL SURFACE: Cap holds detail explains the
                canonical capHoldsTotal without becoming a totals owner. */}
            {displayedCapHolds.length > 0 ? (
              <section
                aria-label={CAP_SHEET_SURFACE_LABELS.capHoldsDetail}
                className="min-w-0 flex-1 bg-cockpit-inlay"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1">
                  <p className="min-w-0 truncate text-[10px] text-cockpit-text-muted">
                    <span className="font-semibold uppercase tracking-wider text-cockpit-text-muted">
                      Cap Holds ({displayedCapHolds.length})
                    </span>
                    <span className="sr-only">
                      {' '}
                      — Active cap holds are included in Total Cap Hit.
                    </span>
                  </p>
                  <button
                    type="button"
                    aria-expanded={showCapHolds}
                    onClick={() => setShowCapHolds(!showCapHolds)}
                    className="shrink-0 rounded border border-cockpit-edge bg-cockpit-raised px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cockpit-text-secondary transition-colors hover:bg-cockpit-edge hover:text-cockpit-text-primary"
                  >
                    {showCapHolds ? 'Hide' : 'Show'} cap hold details
                  </button>
                </div>
                {showCapHolds && (
                  <div className="max-h-28 overflow-auto border-t border-cockpit-edge">
                    <div className="divide-y divide-cockpit-edge">
                      {displayedCapHolds.map((h) => (
                        <div
                          key={`${h.playerId}-${h.season}-${h.type}`}
                          className="grid grid-cols-[2fr,1.2fr,3fr] items-center gap-2 px-3 py-1 hover:bg-cockpit-raised"
                        >
                          <div className="truncate text-xs text-cockpit-text-secondary">
                            {h.playerName || h.playerId}
                          </div>
                          <div className="text-xs text-cockpit-text-muted tabular-nums">
                            {formatCapSheetMoney(h.amount)}
                          </div>
                          <div className="truncate text-[10px] text-cockpit-text-muted">
                            {h.reason || h.type || ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            ) : (
              <p className="min-w-0 flex-1 px-3 py-1 text-[10px] text-cockpit-text-muted">
                No active cap holds in {selectedSeasonLabel}.
              </p>
            )}

            <div className="flex shrink-0 items-center gap-2 border-l border-cockpit-edge px-3 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
                Cap Tools
              </span>
              <button
                data-testid="cap-sheet-tools-toggle"
                type="button"
                aria-expanded={showCapTools}
                aria-label={`${showCapTools ? 'Close' : 'Open'} dead money and exception tools`}
                onClick={() => setShowCapTools(!showCapTools)}
                className="rounded border border-cockpit-edge bg-cockpit-raised px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cockpit-text-secondary transition-colors hover:bg-cockpit-edge hover:text-cockpit-text-primary"
              >
                {showCapTools ? 'Close' : 'Open'}
              </button>
            </div>
          </div>

          {/* CONTROL SURFACE: These actions mutate canonical inputs, but do not
              own or redefine current-year totals display. Opens from the Cap
              Tools toggle so it never competes for default-view space. */}
          {showCapTools && (
            <div
              data-testid="cap-sheet-control-surface"
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-cockpit-edge px-3 py-1"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2 text-[10px] text-cockpit-text-secondary">
                <span className="font-semibold uppercase tracking-wider text-cockpit-text-muted">
                  Dead Money Input
                  <span className="sr-only">
                    Selected-Year Mutation Entry Point
                  </span>
                </span>
                <span className="rounded-full border border-cockpit-edge bg-cockpit-raised px-2 py-0.5 font-medium text-cockpit-text-secondary">
                  Input season: {selectedSeasonLabel}
                </span>
                <button
                  data-testid="cap-sheet-manage-dead-money-button"
                  type="button"
                  disabled={!hasManualCapSheetMutationAuthority}
                  onClick={() => {
                    if (!hasManualCapSheetMutationAuthority) return;
                    setShowDeadMoneyModal(true);
                  }}
                  className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-all ${
                    hasManualCapSheetMutationAuthority
                      ? 'border-cockpit-edge bg-cockpit-raised text-cockpit-text-secondary hover:bg-cockpit-edge hover:text-cockpit-text-primary'
                      : 'cursor-not-allowed border-cockpit-edge text-cockpit-text-ghost'
                  }`}
                >
                  Manage Dead Money
                </button>
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-2 text-[10px] text-cockpit-text-secondary">
                <span className="font-semibold uppercase tracking-wider text-cockpit-watch">
                  Current-Season Tools
                  <span className="sr-only">
                    Current-Season-Only Adjacent Authority
                  </span>
                </span>
                <span className="rounded-full border border-cockpit-watch/25 bg-cockpit-watch/10 px-2 py-0.5 font-medium text-cockpit-watch">
                  {isViewingCurrentYear
                    ? currentSeasonLabel
                    : `${currentSeasonLabel} only`}
                </span>
                <span className="rounded-full border border-cockpit-edge bg-cockpit-raised px-2 py-0.5 font-medium text-cockpit-text-secondary">
                  Selected-year view: {selectedSeasonLabel}
                </span>
                {!isViewingCurrentYear &&
                  hasManualCapSheetMutationAuthority && (
                    <span
                      data-testid="cap-sheet-future-year-exception-edit-boundary"
                      className="text-cockpit-watch"
                    >
                      Exception editing is only available for the current season.{' '}
                      Viewing {selectedSeasonLabel} does not create{' '}
                      future-year exception authority.
                    </span>
                  )}
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
                  className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-all ${
                    canManageExceptions
                      ? 'border-cockpit-edge bg-cockpit-raised text-cockpit-text-secondary hover:bg-cockpit-edge hover:text-cockpit-text-primary'
                      : 'cursor-not-allowed border-cockpit-edge text-cockpit-text-ghost'
                  }`}
                >
                  Manage Exceptions
                </button>
              </div>
            </div>
          )}
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
