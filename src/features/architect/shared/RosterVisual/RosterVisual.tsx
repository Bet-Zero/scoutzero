import React, { useMemo } from 'react';
import RosterSection from '@/features/roster/RosterSection';
import {
  buildInitialRoster,
  normalizePlayer,
  normalizeRosterShape,
  isTwoWayContract,
} from '@/features/roster/utils';
import { getTeamColors } from '@/shared/utils/formatting/teamColors';
import { getTeamLogoFilename } from '@/shared/utils/formatting/teamLogos';
import { TeamMap } from '@/constants/teamList';
import { useParams } from 'react-router-dom';

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

type LegacyRosterShape = {
  starters: Array<RosterDisplayMember | null>;
  rotation: Array<RosterDisplayMember | null>;
  bench: Array<RosterDisplayMember | null>;
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

const RosterVisual = ({
  teamCapSheet,
  playersMap = {},
  teamId: propTeamId,
}: RosterVisualProps) => {
  const { teamId: routeTeamId } = useParams();
  const id = String(
    propTeamId || teamCapSheet?.teamId || teamCapSheet?.id || routeTeamId || '');
  const teamInfo = (TeamMap as Record<string, Record<string, unknown>>)[id] || {};
  const roster = useMemo(() => {
    if (!teamCapSheet?.players || !Array.isArray(teamCapSheet.players)) return null;
    // Membership comes from the hydrated team cap sheet. playersMap only fills
    // missing display/detail fields from the world-aware dashboard player index.
    const enriched = teamCapSheet.players.map((member) =>
      mergeRosterMemberDetails(member, findRosterDetails(member, playersMap))
    );

    // Separate standard and two-way contracts
    const standardPlayers = enriched.filter((p) => !isTwoWayContract(p));
    const twoWayPlayers = enriched.filter((p) => isTwoWayContract(p));

    // Sort standard players by minutes
    const sorted = [...standardPlayers].sort(
      (a, b) => getMinutes(b) - getMinutes(a)
    );

    // Build initial roster (up to 15 standard players)
    const roster = normalizeRosterShape(
      buildInitialRoster(sorted)
    ) as LegacyRosterShape;

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
          roster.bench[benchIndex] = normalizePlayer(player);
        }
      });
    }

    return roster;
  }, [teamCapSheet, playersMap]);

  if (!roster) return null;

  const displayName = String(
    teamInfo.nickname || teamInfo.teamName || teamCapSheet?.teamName || id);
  const teamKey = getTeamLogoFilename(id || displayName);
  const { primary, secondary } = getTeamColors(teamKey);

  return (
    <div className="relative max-w-[1100px] mx-auto text-white p-6 flex flex-col items-center overflow-hidden">
      {displayName && (
        <img
          src={`/assets/logos/${teamKey}.png`}
          alt=""
          className="absolute inset-0 w-full h-full object-contain opacity-20 blur-sm mt-4 pointer-events-none select-none"
          style={{ zIndex: 0 }}
        />
      )}

      {displayName && (
        <div className="w-full flex justify-center relative z-10 mb-2">
          <h2
            className="text-5xl font-black tracking-wide uppercase relative"
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

      <h3 className="text-xl text-neutral-500 font-semibold z-10 mb-8 opacity-90 tracking-wide">
        Team Roster
      </h3>

      <RosterSection
        players={roster.starters}
        section="starters"
        {...LEGACY_ROSTER_DISPLAY_ONLY_PROPS}
      />
      <RosterSection
        players={roster.rotation}
        section="rotation"
        {...LEGACY_ROSTER_DISPLAY_ONLY_PROPS}
      />
      <RosterSection
        players={roster.bench}
        section="bench"
        {...LEGACY_ROSTER_DISPLAY_ONLY_PROPS}
      />
    </div>
  );
};

export default RosterVisual;
