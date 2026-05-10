type PlayerLike = {
  id?: string | null;
  bio?: { playerId?: string | null } | null;
};

export function getPlayerId(player: PlayerLike | null | undefined): string | null {
  if (!player) return null;
  return player.id || player.bio?.playerId || null;
}

