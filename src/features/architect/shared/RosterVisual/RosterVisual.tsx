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

const SPARSE_ROSTER_CARD_COUNT = 5;

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

    // Build initial roster (up to 15 standard players)
    const roster: LegacyRosterShape = normalizeRosterShape(
      buildInitialRoster(sorted)
    );

    // Ensure we always have 15 players total by filling with two-way contracts if needed
    const totalPlayers = roster.starters.filter(Boolean).length +
                        roster.rotation.filter(Boolean).length +
                        roster.bench.filter(Boolean).length;

    if (totalPlayers < 15 && twoWayPlayers.length > 0) {
      // Fill remaining slots with two-way players
      const needed = 15 - totalPlayers;
      const twoWayToAdd = twoWayPlayers.slice(0, needed);

      // Add two-way players to bench slots
      const emptyBenchSlots = roster.bench
        .map((player, index) => (player === null ? index : null))
        .filter((index): index is number => index !== null);

      twoWayToAdd.forEach((player, index) => {
        const benchIndex = emptyBenchSlots[index];
        if (benchIndex !== undefined) {
          const normalizedTwoWay = normalizePlayer(player);
          if (normalizedTwoWay) {
            roster.bench[benchIndex] = normalizedTwoWay;
          }
        }
      });
    }

    const sectionCounts = {
      starters: countRosterSection(roster.starters),
      rotation: countRosterSection(roster.rotation),
      bench: countRosterSection(roster.bench),
    };

    return {
      roster,
      activeYear,
      standardCount: standardPlayers.length,
      twoWayCount: twoWayPlayers.length,
      displayedCount:
        sectionCounts.starters + sectionCounts.rotation + sectionCounts.bench,
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

  if (!roster || !rosterState) return null;

  const displayName = String(
    teamInfo.nickname || teamInfo.teamName || teamCapSheet?.teamName || id);
  const teamKey = getTeamLogoFilename(id || displayName);
  const { primary, secondary } = getTeamColors(teamKey);
  const isSparseRoster =
    rosterState.displayedCount > 0 &&
    rosterState.displayedCount <= SPARSE_ROSTER_CARD_COUNT;

  return (
    <div
      className={`relative mx-auto flex max-w-[1100px] flex-col items-center overflow-hidden text-white ${
        isSparseRoster ? 'px-6 pb-6 pt-3' : 'p-6'
      }`}
    >
      {displayName && (
        <img
          src={`/assets/logos/${teamKey}.png`}
          alt=""
          className={`absolute inset-0 h-full w-full object-contain pointer-events-none select-none ${
            isSparseRoster
              ? '-translate-y-8 scale-75 opacity-10 blur-[1px]'
              : 'mt-4 opacity-20 blur-sm'
          }`}
          style={{ zIndex: 0 }}
        />
      )}

      {displayName && (
        <div
          className={`relative z-10 flex w-full justify-center ${
            isSparseRoster ? 'mb-0' : 'mb-2'
          }`}
        >
          <h2
            className={`relative font-black uppercase tracking-wide ${
              isSparseRoster ? 'text-4xl' : 'text-5xl'
            }`}
            style={{
              color: '#1e1e1e',
              textShadow: `0 0 10px ${primary}, 0 0 18px ${secondary}`,
              transform: 'translateX(3px)',
            }}
          >
            {displayName}
          </h2>
        </div>
      )}

      <h3
        className={`z-10 text-xl font-semibold tracking-wide text-neutral-500 opacity-90 ${
          isSparseRoster ? 'mb-4' : 'mb-8'
        }`}
      >
        Team Roster
      </h3>

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

      <RosterSection
        players={roster.starters}
        section="starters"
        {...LEGACY_ROSTER_DISPLAY_ONLY_PROPS}
        onSelectPlayer={handleSectionSelect}
        isPlayerHighlighted={sectionHighlightMatcher}
        renderPlayerMenu={renderPlayerMenu}
      />
      <RosterSection
        players={roster.rotation}
        section="rotation"
        {...LEGACY_ROSTER_DISPLAY_ONLY_PROPS}
        onSelectPlayer={handleSectionSelect}
        isPlayerHighlighted={sectionHighlightMatcher}
        renderPlayerMenu={renderPlayerMenu}
      />
      <RosterSection
        players={roster.bench}
        section="bench"
        {...LEGACY_ROSTER_DISPLAY_ONLY_PROPS}
        onSelectPlayer={handleSectionSelect}
        isPlayerHighlighted={sectionHighlightMatcher}
        renderPlayerMenu={renderPlayerMenu}
      />
    </div>
  );
};
