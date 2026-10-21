// src/features/ranker/utils/playerDisplay.ts
// Display helpers shared by the ranker screens.
import { getTeamLogoFilename } from '@/shared/utils/formatting/teamLogos';
import type { RankerPlayer } from '@/features/ranker/utils/rankingEngine';

export const getPlayerName = (player: RankerPlayer): string =>
  player.bio?.displayName || player.display_name || player.name || '—';

export const getHeadshotSrc = (player: RankerPlayer): string =>
  player.headshot ||
  player.headshotUrl ||
  `/assets/headshots/${player.player_id || player.id}.png`;

// Player docs keep the team under bio.display; `team` is only set on some
// legacy/processed shapes.
const getTeamKey = (player: RankerPlayer): string | null => {
  const team =
    player.bio?.display?.teamId ?? player.team ?? player.bio?.display?.team;
  return team ? String(team) : null;
};

export const getTeamLabel = (player: RankerPlayer): string | null => {
  const team = getTeamKey(player);
  return team ? team.toUpperCase() : null;
};

export const getLogoSrc = (player: RankerPlayer): string | null => {
  const team = getTeamKey(player);
  return team ? `/assets/logos/${getTeamLogoFilename(team)}.png` : null;
};
