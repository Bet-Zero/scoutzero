/**
 * Normalize playerId for headshot path lookup
 * Handles special characters (e.g., kristaps_porzingis -> kristaps_porziņģis)
 */
export function normalizeHeadshotId(playerId) {
  if (!playerId) return 'default';
  return playerId
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const ROSTER_SIZES = {
  starters: 5,
  rotation: 4,
  bench: 6,
};

const normalizeSection = (section, size) => {
  const safeSection = Array.isArray(section) ? section.slice(0, size) : [];
  while (safeSection.length < size) safeSection.push(null);
  return safeSection;
};

export const createEmptyRoster = () => ({
  starters: Array(ROSTER_SIZES.starters).fill(null),
  rotation: Array(ROSTER_SIZES.rotation).fill(null),
  bench: Array(ROSTER_SIZES.bench).fill(null),
});

export const normalizeRosterShape = (roster = {}) => ({
  starters: normalizeSection(roster.starters, ROSTER_SIZES.starters),
  rotation: normalizeSection(roster.rotation, ROSTER_SIZES.rotation),
  bench: normalizeSection(roster.bench, ROSTER_SIZES.bench),
});

export function normalizePlayer(player) {
  if (!player) return null;
  if (player.isMissing) {
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

export function createMissingRosterPlayer(playerId) {
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

export function isRosterFull(roster = {}) {
  const normalizedRoster = normalizeRosterShape(roster);
  return [...normalizedRoster.starters, ...normalizedRoster.rotation, ...normalizedRoster.bench]
    .filter(Boolean).length >= ROSTER_SIZES.starters + ROSTER_SIZES.rotation + ROSTER_SIZES.bench;
}

export function buildInitialRoster(teamPlayers) {
  const getPosition = (p) =>
    (p.bio?.position || p.formattedPosition || '').toUpperCase();
  const starterSlots = [null, null, null, null, null];
  const positionPriorities = [
    { test: (pos) => pos.includes('G') && !pos.includes('F'), slots: [0, 1] },
    { test: (pos) => pos.includes('G/F'), slots: [2] },
    { test: (pos) => pos.includes('F') && !pos.includes('C'), slots: [3] },
    { test: (pos) => pos.includes('F/C') || pos.includes('C'), slots: [4] },
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

  const starterIds = new Set(starterSlots.map((p) => p?.id).filter(Boolean));
  const remaining = teamPlayers.filter((p) => !starterIds.has(p.id));
  return {
    starters: starterSlots.map((p) => (p ? normalizePlayer(p) : null)),
    rotation: remaining.slice(0, 4).map(normalizePlayer),
    bench: remaining.slice(4, 10).map(normalizePlayer),
  };
}
