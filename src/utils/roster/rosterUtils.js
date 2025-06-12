import { POSITION_MAP } from '../roles/positionMap.js';

export function normalizePlayer(player) {
  if (!player) return null;
  return {
    ...player,
    display_name: player.display_name || player.name || 'Unknown Player',
    headshot: player.headshot || `/assets/headshots/${player.id}.png`,
    bio: {
      ...player.bio,
      Position: player.bio?.Position || 'Unknown',
    },
  };
}

export function buildInitialRoster(teamPlayers) {
  const getPosition = (p) => (p.bio?.Position || '').toUpperCase();
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
