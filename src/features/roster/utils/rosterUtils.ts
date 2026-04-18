type PlayerId = string | number;

type RosterPlayerBio = {
  playerId?: PlayerId | null;
  displayName?: string | null;
  position?: string | null;
};

export type RosterPlayerInput = {
  id?: PlayerId | null;
  name?: string | null;
  displayName?: string | null;
  headshot?: string | null;
  headshotUrl?: string | null;
  formattedPosition?: string | null;
  isMissing?: false | null;
  bio?: RosterPlayerBio | null;
};

export type MissingRosterPlayer = {
  id: PlayerId | null | undefined;
  name: 'Missing Player';
  displayName: 'Missing Player';
  headshot: '/assets/headshots/default.png';
  isMissing: true;
  missingPlayerId: PlayerId | null | undefined;
  bio: {
    displayName: 'Missing Player';
    position: '—';
    playerId: PlayerId | null | undefined;
  };
};

export type NormalizedRosterPlayer = RosterPlayerInput & {
  displayName: string;
  headshot: string;
  bio: RosterPlayerBio & {
    position: string;
  };
};

export type RosterShape<T = NormalizedRosterPlayer | MissingRosterPlayer> = {
  starters: Array<T | null>;
  rotation: Array<T | null>;
  bench: Array<T | null>;
};

type RosterInput<T> = Partial<{
  starters: T[] | null;
  rotation: T[] | null;
  bench: T[] | null;
}>;

const isMissingRosterPlayer = (
  player: RosterPlayerInput | MissingRosterPlayer
): player is MissingRosterPlayer => player.isMissing === true;

/**
 * Normalize playerId for headshot path lookup.
 * Handles special characters (e.g., kristaps_porzingis -> kristaps_porzingis).
 */
export function normalizeHeadshotId(
  playerId: PlayerId | null | undefined
): string {
  if (!playerId) return 'default';
  return String(playerId)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const ROSTER_SIZES = {
  starters: 5,
  rotation: 4,
  bench: 6,
} as const;

const normalizeSection = <T>(
  section: T[] | null | undefined,
  size: number
): Array<T | null> => {
  const safeSection: Array<T | null> = Array.isArray(section)
    ? section.slice(0, size)
    : [];
  while (safeSection.length < size) safeSection.push(null);
  return safeSection;
};

export const createEmptyRoster = (): RosterShape => ({
  starters: Array(ROSTER_SIZES.starters).fill(null),
  rotation: Array(ROSTER_SIZES.rotation).fill(null),
  bench: Array(ROSTER_SIZES.bench).fill(null),
});

export const normalizeRosterShape = <T = NormalizedRosterPlayer | MissingRosterPlayer>(
  roster: RosterInput<T> = {}
): RosterShape<T> => ({
  starters: normalizeSection(roster.starters, ROSTER_SIZES.starters),
  rotation: normalizeSection(roster.rotation, ROSTER_SIZES.rotation),
  bench: normalizeSection(roster.bench, ROSTER_SIZES.bench),
});

export function normalizePlayer(
  player: RosterPlayerInput | MissingRosterPlayer | null | undefined
): NormalizedRosterPlayer | MissingRosterPlayer | null {
  if (!player) return null;
  if (isMissingRosterPlayer(player)) {
    return createMissingRosterPlayer(player.id);
  }
  const playerId = player.bio?.playerId || player.id;
  const normalizedId = normalizeHeadshotId(playerId);
  return {
    ...player,
    displayName: player.bio?.displayName || player.name || 'Unknown Player',
    headshot:
      player.headshot ||
      player.headshotUrl ||
      `/assets/headshots/${normalizedId}.png`,
    bio: {
      ...player.bio,
      position: player.bio?.position || player.formattedPosition || 'Unknown',
    },
  };
}

export function createMissingRosterPlayer(
  playerId: PlayerId | null | undefined
): MissingRosterPlayer {
  return {
    id: playerId,
    name: 'Missing Player',
    displayName: 'Missing Player',
    headshot: '/assets/headshots/default.png',
    isMissing: true,
    missingPlayerId: playerId,
    bio: {
      displayName: 'Missing Player',
      position: '—',
      playerId,
    },
  };
}

export function isRosterFull(roster: RosterInput<unknown> = {}): boolean {
  const normalizedRoster = normalizeRosterShape(roster);
  return [
    ...normalizedRoster.starters,
    ...normalizedRoster.rotation,
    ...normalizedRoster.bench,
  ].filter(Boolean).length >=
    ROSTER_SIZES.starters + ROSTER_SIZES.rotation + ROSTER_SIZES.bench;
}

export function buildInitialRoster(
  teamPlayers: RosterPlayerInput[] = []
): RosterShape<NormalizedRosterPlayer | MissingRosterPlayer> {
  const getPosition = (p: RosterPlayerInput): string =>
    (p.bio?.position || p.formattedPosition || '').toUpperCase();
  const starterSlots: Array<RosterPlayerInput | null> = [
    null,
    null,
    null,
    null,
    null,
  ];
  const positionPriorities = [
    { test: (pos: string) => pos.includes('G') && !pos.includes('F'), slots: [0, 1] },
    { test: (pos: string) => pos.includes('G/F'), slots: [2] },
    { test: (pos: string) => pos.includes('F') && !pos.includes('C'), slots: [3] },
    { test: (pos: string) => pos.includes('F/C') || pos.includes('C'), slots: [4] },
  ];

  for (const player of teamPlayers.slice(0, 5)) {
    const pos = getPosition(player);
    let assigned = false;
    for (const { test, slots } of positionPriorities) {
      if (test(pos)) {
        for (const slot of slots) {
          if (starterSlots[slot] === null) {
            starterSlots[slot] = player;
            assigned = true;
            break;
          }
        }
        if (assigned) break;
      }
    }
    if (!assigned) {
      const nextEmpty = starterSlots.findIndex((s) => s === null);
      if (nextEmpty !== -1) starterSlots[nextEmpty] = player;
    }
  }

  const starterIds = new Set(
    starterSlots.map((p) => p?.id).filter((id) => id !== null && id !== undefined)
  );
  const remaining = teamPlayers.filter((p) => !starterIds.has(p.id));
  return {
    starters: starterSlots.map((p) => (p ? normalizePlayer(p) : null)),
    rotation: remaining.slice(0, 4).map((p) => normalizePlayer(p)),
    bench: remaining.slice(4, 10).map((p) => normalizePlayer(p)),
  };
}
