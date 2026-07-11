import React, { useMemo } from 'react';
import { RosterSection } from '@/features/roster/RosterSection';
import {
  buildInitialRoster,
  normalizePlayer,
  normalizeRosterShape,
  isTwoWayContract,
  type MissingRosterPlayer,
  type NormalizedRosterPlayer,
  type RosterShape,
} from '@/features/roster/utils';
import { getTeamColors } from '@/shared/utils/formatting/teamColors';
import { getTeamLogoFilename } from '@/shared/utils/formatting/teamLogos';
import { TeamMap } from '@/constants/teamList';
import { useParams } from 'react-router-dom';
import { playerMatchesFocus } from '@/features/architect/GMDashboard/postActionHandoff/playerFocus';
import { PlayerActionMenu } from '@/features/architect/cockpit/PlayerActionMenu';
import { getContractYearSlice } from '@/features/architect/utils/contractUtils';
import {
  buildPlayerActionContext,
  type PlayerAction,
  type PlayerActionContext,
} from '@/features/architect/cockpit/playerActionContext';

type RosterBio = Record<string, unknown> & {
  displayName?: string | null;
  playerId?: string | number | null;
  position?: string | null;
};

type RosterDisplayMember = {
  id?: string | number | null;
  player_id?: string | number | null;
  playerId?: string | number | null;
  name?: string | null;
  displayName?: string | null;
  bio?: RosterBio | null;
  contract?: {
    contractType?: string | null;
    signedUsing?: string | null;
    [key: string]: unknown;
  } | null;
  primaryContract?: Record<string, unknown> | null;
  contracts?: Record<string, Record<string, unknown>> | null;
  contractView?: Record<string, unknown> | null;
  headshot?: string | null;
  headshotUrl?: string | null;
  MIN?: string | number | null;
  latestSeasonStats?: {
    MIN?: string | number | null;
    [key: string]: unknown;
  } | null;
  formattedPosition?: string | null;
  [key: string]: unknown;
};

type LegacyRosterShape = RosterShape<
  NormalizedRosterPlayer | MissingRosterPlayer
>;

type RosterSectionCounts = {
  starters: number;
  rotation: number;
  bench: number;
};

type RosterVisualState = {
  roster: LegacyRosterShape;
  /** All two-way players, carded in their own dedicated group (BZE-241). */
  twoWay: Array<NormalizedRosterPlayer | MissingRosterPlayer>;
  activeYear: number | null;
  standardCount: number;
  twoWayCount: number;
  displayedCount: number;
  sectionCounts: RosterSectionCounts;
};

export type RosterVisualCapSheetInput = {
  teamId?: string | number | null;
  id?: string | number | null;
  teamName?: string | null;
  players?: RosterDisplayMember[] | null;
};

export type RosterVisualDetailsMap = Record<
  string,
  RosterDisplayMember | undefined
>;

type RosterVisualProps = {
  teamCapSheet: RosterVisualCapSheetInput | null | undefined;
  playersMap?: RosterVisualDetailsMap;
  teamId?: string | null;
  /** Selected viewing season end-year. Matches Roster to FCT's active contract slice. */
  currentYear?: number | null;
  /**
   * Stage 2C navigation-only seam. When provided, clicking a roster
   * card invokes this callback with the resolved (merged) roster
   * member. The legacy `isExport: true` constant still suppresses the
   * legacy add/remove mutation controls — this seam is additive and
   * does not re-enable them.
   */
  onSelectPlayer?: ((player: RosterDisplayMember) => void) | null;
  /**
   * Stage 2C focus highlight. When this id matches one of the member's
   * canonical identity keys, the matching card renders a non-mutating
   * "just changed" outline. Visual only.
   */
  highlightPlayerId?: string | null;
  /**
   * Multi-focus highlight (e.g. pinned players). Any card matching one of these
   * ids renders the "just changed" outline. Unioned with `highlightPlayerId`.
   */
  highlightPlayerIds?: string[];
  /**
   * Unified player-action intents (Pin/Unpin, Trade, cross-room navigation)
   * routed by GMDashboard. When provided, each roster card gets the shared
   * overflow PlayerActionMenu in its corner (card click still = Open).
   */
  onPlayerAction?:
    | ((action: PlayerAction, context: PlayerActionContext) => void)
    | null;
  /** Pinned ids so each card menu can show Pin vs Unpin. */
  pinnedPlayerIds?: string[];
};

const LEGACY_ROSTER_DISPLAY_ONLY_PROPS = {
  isExport: true,
} as const;

const asLookupValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return null;
};

const normalizeLookupKey = (value: unknown): string | null => {
  const lookupValue = asLookupValue(value);
  if (!lookupValue) return null;

  const normalized = lookupValue
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

  return normalized || null;
};

const getDetailLookupKeys = (member: RosterDisplayMember): string[] => {
  const directKeys = [
    member.name,
    member.displayName,
    member.id,
    member.player_id,
    member.playerId,
    member.bio?.displayName,
    member.bio?.playerId,
  ]
    .map(asLookupValue)
    .filter((key): key is string => Boolean(key));

  const normalizedNameKeys = [
    member.name,
    member.displayName,
    member.bio?.displayName,
  ]
    .map(normalizeLookupKey)
    .filter((key): key is string => Boolean(key));

  return Array.from(new Set([...directKeys, ...normalizedNameKeys]));
};

const findRosterDetails = (
  member: RosterDisplayMember,
  playersMap: RosterVisualDetailsMap
): RosterDisplayMember => {
  const detailKey = getDetailLookupKeys(member).find(
    (key) => playersMap[key]
  );

  return detailKey ? playersMap[detailKey] || {} : {};
};

const resolveHeadshot = (
  member: RosterDisplayMember,
  details: RosterDisplayMember
) => {
  const explicitHeadshot =
    asLookupValue(details.headshotUrl) ||
    asLookupValue(member.headshot) ||
    asLookupValue(member.headshotUrl) ||
    asLookupValue(details.headshot);

  if (explicitHeadshot) return explicitHeadshot;

  const playerId =
    asLookupValue(member.bio?.playerId) ||
    asLookupValue(member.id) ||
    asLookupValue(member.player_id) ||
    asLookupValue(details.bio?.playerId) ||
    asLookupValue(details.id) ||
    asLookupValue(details.player_id) ||
    'default';

  const normalizedId =
    playerId === 'default'
      ? 'default'
      : playerId
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();

  return `/assets/headshots/${normalizedId}.png`;
};

const mergeRosterMemberDetails = (
  member: RosterDisplayMember,
  details: RosterDisplayMember
): RosterDisplayMember => {
  const detailsBio = details.bio || {};
  const memberBio = member.bio || {};
  const mergedBio = {
    ...detailsBio,
    ...memberBio,
  };
  const fallbackId =
    asLookupValue(member.id) ||
    asLookupValue(member.player_id) ||
    asLookupValue(member.bio?.playerId) ||
    asLookupValue(details.id) ||
    asLookupValue(details.player_id) ||
    asLookupValue(details.bio?.playerId) ||
    'unknown-player';
  const name =
    asLookupValue(member.displayName) ||
    asLookupValue(member.name) ||
    asLookupValue(details.name) ||
    asLookupValue(details.displayName) ||
    asLookupValue(details.bio?.displayName) ||
    fallbackId;
  const displayName =
    asLookupValue(member.displayName) ||
    asLookupValue(member.bio?.displayName) ||
    asLookupValue(details.displayName) ||
    asLookupValue(details.bio?.displayName) ||
    asLookupValue(member.name) ||
    asLookupValue(details.name) ||
    fallbackId;

  return {
    ...details,
    ...member,
    bio: mergedBio,
    name,
    displayName,
    headshot: resolveHeadshot(member, details),
  };
};

const getMinutes = (member: RosterDisplayMember) => {
  const minutes = Number.parseFloat(
    String(member.MIN ?? member.latestSeasonStats?.MIN ?? 0)
  );

  return Number.isFinite(minutes) ? minutes : 0;
};

const countRosterSection = (
  section: LegacyRosterShape[keyof LegacyRosterShape]
): number => section.filter(Boolean).length;

const STANDARD_ROSTER_LIMIT = 15;
const TWO_WAY_ROSTER_LIMIT = 3;

const formatSeasonLabel = (seasonEndYear: number | null) => {
  if (!seasonEndYear) return 'Current season';
  return `${seasonEndYear - 1}-${String(seasonEndYear).slice(-2)}`;
};

const rosterBands = [
  {
    key: 'starters',
    label: 'Starting Five',
    detail: 'Opening group',
  },
  {
    key: 'rotation',
    label: 'Rotation',
    detail: 'Main bench minutes',
  },
  {
    key: 'bench',
    label: 'Bench',
    detail: 'Depth',
  },
] as const;

export const RosterVisual = ({
  teamCapSheet,
  playersMap = {},
  teamId: propTeamId,
  currentYear = null,
  onSelectPlayer = null,
  highlightPlayerId = null,
  highlightPlayerIds = [],
  onPlayerAction = null,
  pinnedPlayerIds = [],
}: RosterVisualProps) => {
  const { teamId: routeTeamId } = useParams();
  const id = String(
    propTeamId || teamCapSheet?.teamId || teamCapSheet?.id || routeTeamId || '');
  const teamInfo = (TeamMap as Record<string, Record<string, unknown>>)[id] || {};
  const rosterState = useMemo<RosterVisualState | null>(() => {
    if (!teamCapSheet?.players || !Array.isArray(teamCapSheet.players)) return null;
    const activeYear =
      typeof currentYear === 'number' && Number.isFinite(currentYear)
        ? currentYear
        : null;
    // Membership comes from the hydrated team cap sheet. playersMap only fills
    // missing display/detail fields from the world-aware dashboard player index.
    const enriched = teamCapSheet.players.map((member) =>
      mergeRosterMemberDetails(member, findRosterDetails(member, playersMap))
    );
    const activeMembers = activeYear !== null
      ? enriched.filter((member) => getContractYearSlice(member, activeYear))
      : enriched;

    // Separate standard and two-way contracts
    const standardPlayers = activeMembers.filter((p) => !isTwoWayContract(p));
    const twoWayPlayers = activeMembers.filter((p) => isTwoWayContract(p));

    // Sort standard players by minutes
    const sorted = [...standardPlayers].sort(
      (a, b) => getMinutes(b) - getMinutes(a)
    );

    // Standard bands (Starting Five / Rotation / Bench) card the standard
    // players only. Two-way players are NOT folded into the bench — they get
    // their own dedicated group below, so every two-way player on the roster is
    // carded and reachable even at a full 15+3 (BZE-241). Previously two-way
    // players were only appended to the bench when a team had < 15 standard,
    // so a 15+3 team (e.g. Denver) surfaced none of them.
    const roster: LegacyRosterShape = normalizeRosterShape(
      buildInitialRoster(sorted)
    );

    // Card every two-way player (no cap — the roster only ever holds up to 3,
    // and the header already reports the y/3 slot usage).
    const twoWay = twoWayPlayers
      .map((player) => normalizePlayer(player))
      .filter(
        (player): player is NormalizedRosterPlayer | MissingRosterPlayer =>
          Boolean(player)
      );

    const sectionCounts = {
      starters: countRosterSection(roster.starters),
      rotation: countRosterSection(roster.rotation),
      bench: countRosterSection(roster.bench),
    };

    return {
      roster,
      twoWay,
      activeYear,
      standardCount: standardPlayers.length,
      twoWayCount: twoWayPlayers.length,
      // Total cards rendered across the standard bands + the two-way group.
      displayedCount:
        sectionCounts.starters +
        sectionCounts.rotation +
        sectionCounts.bench +
        twoWay.length,
      sectionCounts,
    };
  }, [currentYear, teamCapSheet, playersMap]);

  const roster = rosterState?.roster ?? null;

  const handleSectionSelect = useMemo(() => {
    if (!onSelectPlayer) return undefined;
    return (player: unknown) =>
      onSelectPlayer((player ?? {}) as RosterDisplayMember);
  }, [onSelectPlayer]);

  const sectionHighlightMatcher = useMemo(() => {
    const ids = [
      ...(highlightPlayerId ? [highlightPlayerId] : []),
      ...highlightPlayerIds,
    ];
    if (ids.length === 0) return undefined;
    return (player: unknown) =>
      ids.some((focusId) =>
        playerMatchesFocus(
          player as Parameters<typeof playerMatchesFocus>[0],
          focusId
        )
      );
  }, [highlightPlayerId, highlightPlayerIds]);

  const renderPlayerMenu = useMemo(() => {
    if (!onPlayerAction) return undefined;
    return (cardPlayer: unknown) => {
      const menuContext = buildPlayerActionContext({
        player: (cardPlayer ?? {}) as RosterDisplayMember,
        sourceRoom: 'roster',
      });
      if (!menuContext) return null;
      const isPinned = pinnedPlayerIds.some((focusId) =>
        playerMatchesFocus(
          cardPlayer as Parameters<typeof playerMatchesFocus>[0],
          focusId
        )
      );
      return (
        <PlayerActionMenu
          context={menuContext}
          visibleActions={[]}
          overflowActions={[
            'pin',
            'trade',
            'view-on-cap',
            'view-in-full-cap',
            'find-in-history',
            'compare-impact',
            'guide-next-move',
          ]}
          isPinned={isPinned}
          menuAlign="right"
          testIdPrefix="roster-card-player"
          className="rounded bg-black/40 backdrop-blur-sm"
          onAction={onPlayerAction}
        />
      );
    };
  }, [onPlayerAction, pinnedPlayerIds]);

  const displayName = String(
    teamInfo.nickname || teamInfo.teamName || teamCapSheet?.teamName || id);
  const teamKey = getTeamLogoFilename(id || displayName);
  const { primary, secondary } = getTeamColors(teamKey);

  if (!roster || !rosterState) {
    return (
      <div
        className="flex h-full min-h-0 w-full flex-col items-center justify-center bg-cockpit-void p-3 text-cockpit-text-primary"
        data-testid="architect-roster-empty"
      >
        <div className="w-full max-w-sm rounded-lg border border-cockpit-edge bg-cockpit-slab px-5 py-6 text-center shadow-cockpit-slab">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-cockpit-text-secondary">
            {displayName ? `${displayName} Roster` : 'Team Roster'}
          </h2>
          <p className="mt-2 text-xs text-cockpit-text-muted">
            No roster loaded yet. Choose a team plan to see its starting five,
            rotation, and bench here.
          </p>
        </div>
      </div>
    );
  }

  const seasonLabel = formatSeasonLabel(rosterState.activeYear);
  const openStandardSlots = Math.max(
    0,
    STANDARD_ROSTER_LIMIT - rosterState.standardCount
  );
  const openTwoWaySlots = Math.max(
    0,
    TWO_WAY_ROSTER_LIMIT - rosterState.twoWayCount
  );
  const rosterSurfaceStyle = {
    '--team-primary': primary,
    '--team-secondary': secondary,
  } as React.CSSProperties;
  const metricTiles = [
    {
      label: 'Active Players',
      value: rosterState.displayedCount,
      detail: `${rosterState.sectionCounts.starters} starters · ${rosterState.sectionCounts.rotation} rotation · ${rosterState.sectionCounts.bench} bench${
        rosterState.twoWay.length > 0
          ? ` · ${rosterState.twoWay.length} two-way`
          : ''
      }`,
    },
    {
      label: 'Standard',
      value: `${rosterState.standardCount}/${STANDARD_ROSTER_LIMIT}`,
      detail:
        openStandardSlots === 1
          ? '1 open roster spot'
          : `${openStandardSlots} open roster spots`,
    },
    {
      label: 'Two-Way',
      value: `${rosterState.twoWayCount}/${TWO_WAY_ROSTER_LIMIT}`,
      detail:
        openTwoWaySlots === 1
          ? '1 open two-way slot'
          : `${openTwoWaySlots} open two-way slots`,
    },
  ];

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-cockpit-void p-3 text-cockpit-text-primary"
      style={rosterSurfaceStyle}
    >
      <section
        className="relative shrink-0 overflow-hidden rounded-lg border border-cockpit-edge bg-cockpit-slab shadow-cockpit-slab"
        aria-label="Roster overview"
      >
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-0.5"
          style={{
            background: `linear-gradient(90deg, ${primary}, ${secondary})`,
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {displayName ? (
              <img
                src={`/assets/logos/${teamKey}.png`}
                alt=""
                className="h-9 w-9 shrink-0 rounded-md border border-cockpit-edge bg-cockpit-inlay object-contain p-1"
              />
            ) : null}
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5">
              <h2 className="truncate text-lg font-black uppercase leading-tight tracking-wide text-cockpit-text-primary">
                {displayName}
              </h2>
              <p className="whitespace-nowrap text-[11px] text-cockpit-text-secondary">
                <span>Team Roster</span> · {seasonLabel}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {metricTiles.map((tile) => (
              <div
                key={tile.label}
                title={tile.detail}
                className="flex items-baseline gap-1.5 rounded-md border border-cockpit-edge bg-cockpit-inlay px-2.5 py-1.5"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
                  {tile.label}
                </span>
                <span className="text-sm font-extrabold leading-none text-cockpit-text-primary tabular-nums">
                  {tile.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Machine-readable roster verification data for tests/e2e only. The
          old visible count chip read like an internal audit on a product
          surface (BZE-209), so this element carries the data attributes but
          never renders. */}
      <div
        hidden
        data-testid="architect-roster-truth-panel"
        data-roster-displayed-count={rosterState.displayedCount}
        data-roster-standard-count={rosterState.standardCount}
        data-roster-two-way-count={rosterState.twoWayCount}
        data-roster-section-counts={`${rosterState.sectionCounts.starters} starters / ${rosterState.sectionCounts.rotation} rotation / ${rosterState.sectionCounts.bench} bench`}
        data-roster-active-year={rosterState.activeYear ?? ''}
        data-roster-unsupported-categories="fa,expired,waived,options"
      />

      <div className="mt-2.5 flex min-h-0 flex-1 flex-col justify-start gap-2 overflow-auto rounded-lg border border-cockpit-edge bg-cockpit-inlay px-2.5 py-2.5">
        {rosterBands.map((band) => {
          const count = rosterState.sectionCounts[band.key];
          return (
            <section
              key={band.key}
              aria-label={`${band.label} roster group`}
              className="shrink-0 rounded-lg border border-cockpit-edge bg-cockpit-slab px-2.5 pb-1.5 pt-1.5"
            >
              <div className="mb-1 flex flex-wrap items-baseline gap-x-2 px-1">
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-cockpit-text-primary">
                  {band.label}
                </h3>
                <p className="text-[10px] text-cockpit-text-muted">
                  {band.detail} · {count} {count === 1 ? 'player' : 'players'}
                </p>
              </div>

              {count === 0 ? (
                <div
                  data-roster-empty-band={band.key}
                  data-testid={`roster-empty-band-${band.key}`}
                  className="flex items-center justify-center rounded-md border border-dashed border-cockpit-edge px-3 py-3 text-[11px] text-cockpit-text-ghost"
                >
                  No {band.label.toLowerCase()} players yet — open slots
                </div>
              ) : (
                <RosterSection
                  players={roster[band.key]}
                  section={band.key}
                  {...LEGACY_ROSTER_DISPLAY_ONLY_PROPS}
                  previewSpacing
                  variant="architect"
                  onSelectPlayer={handleSectionSelect}
                  isPlayerHighlighted={sectionHighlightMatcher}
                  renderPlayerMenu={renderPlayerMenu}
                />
              )}
            </section>
          );
        })}

        {/* Dedicated Two-Way group (BZE-241): every two-way player on the
            roster gets a card here, using the same Bench card family as the
            standard bands. Only rendered when the team carries two-way players
            — the header's Two-Way y/3 tile stays the slot-usage source of
            truth. Denver (15+3) surfaces all three here; previously none. */}
        {rosterState.twoWay.length > 0 ? (
          <section
            aria-label="Two-Way roster group"
            data-testid="roster-two-way-group"
            className="shrink-0 rounded-lg border border-cockpit-edge bg-cockpit-slab px-2.5 pb-1.5 pt-1.5"
          >
            <div className="mb-1 flex flex-wrap items-baseline gap-x-2 px-1">
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-cockpit-text-primary">
                Two-Way
              </h3>
              <p className="text-[10px] text-cockpit-text-muted">
                Two-way contracts ({TWO_WAY_ROSTER_LIMIT} slots) ·{' '}
                {rosterState.twoWay.length}{' '}
                {rosterState.twoWay.length === 1 ? 'player' : 'players'}
              </p>
            </div>

            <RosterSection
              players={rosterState.twoWay}
              section="bench"
              {...LEGACY_ROSTER_DISPLAY_ONLY_PROPS}
              previewSpacing
              variant="architect"
              onSelectPlayer={handleSectionSelect}
              isPlayerHighlighted={sectionHighlightMatcher}
              renderPlayerMenu={renderPlayerMenu}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
};
