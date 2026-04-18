type RouteId = string | number | null | undefined;

type PlayerRoutable = {
  id?: RouteId;
  bio?: {
    playerId?: RouteId;
    displayName?: string | null;
    name?: string | null;
  } | null;
  player_id?: RouteId;
  name?: string | null;
  playerName?: string | null;
};

type ProfileSource = 'pid' | 'legacyPlayer' | 'slug' | null;
type ProfileStatus = 'matched' | 'ambiguous' | 'missing' | 'none';

export type ResolveProfileResult = {
  player: PlayerRoutable | null;
  source: ProfileSource;
  status: ProfileStatus;
};

export function toPlayerSlug(displayName: string | null | undefined): string {
  if (!displayName || typeof displayName !== 'string') {
    return '';
  }

  return displayName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '-');
}

export function getPlayerRouteId(player: PlayerRoutable | null | undefined): string {
  const routeId = player?.id ?? player?.bio?.playerId ?? player?.player_id;
  return routeId === null || routeId === undefined ? '' : String(routeId);
}

export function getPlayerDisplayName(player: PlayerRoutable | null | undefined): string {
  return (
    player?.bio?.displayName ||
    player?.bio?.name ||
    player?.name ||
    player?.playerName ||
    ''
  );
}

const matchesRouteIdentifier = (
  player: PlayerRoutable,
  identifier: string
): boolean => {
  return [player?.id, player?.bio?.playerId, player?.player_id].some(
    (value) => value !== null && value !== undefined && String(value) === identifier
  );
};

export function resolvePlayerProfileTarget(
  players: unknown,
  { pid = '', legacyPlayer = '', slug = '' }: { pid?: string; legacyPlayer?: string; slug?: string } = {}
): ResolveProfileResult {
  const playerList: PlayerRoutable[] = Array.isArray(players) ? players : [];

  if (pid) {
    const match = playerList.find((player) => matchesRouteIdentifier(player, pid));
    if (match) {
      return { player: match, source: 'pid', status: 'matched' };
    }
  }

  if (legacyPlayer) {
    const match = playerList.find((player) =>
      matchesRouteIdentifier(player, legacyPlayer)
    );
    if (match) {
      return { player: match, source: 'legacyPlayer', status: 'matched' };
    }
  }

  if (slug) {
    const matches = playerList.filter(
      (player) => toPlayerSlug(getPlayerDisplayName(player)) === slug
    );

    if (matches.length === 1) {
      return { player: matches[0], source: 'slug', status: 'matched' };
    }

    if (matches.length > 1) {
      return { player: null, source: 'slug', status: 'ambiguous' };
    }

    return { player: null, source: 'slug', status: 'missing' };
  }

  return { player: null, source: null, status: 'none' };
}

export function getPlayerProfileUrl(player: PlayerRoutable | null | undefined): string {
  if (!player) {
    return '/profiles';
  }

  const playerId = getPlayerRouteId(player);
  const displayName = getPlayerDisplayName(player);
  const slug = toPlayerSlug(displayName);

  if (slug && playerId) {
    return `/profiles/${slug}?pid=${encodeURIComponent(playerId)}`;
  }

  if (slug) {
    return `/profiles/${slug}`;
  }

  if (playerId) {
    return `/profiles?pid=${encodeURIComponent(playerId)}`;
  }

  return '/profiles';
}
