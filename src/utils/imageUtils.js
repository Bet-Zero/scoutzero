export function generateHeadshotUrl(nbaId) {
  if (!nbaId) return null;
  return `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/${nbaId}.png`;
}

export function getPlayerImageUrl(player) {
  return (
    player.headshot_url ||
    `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/${player.nba_id}.png`
  );
}
