// SCSP™ BLOCK: headshots helper (React + Vite)
// Purpose: build stable Blob CDN URLs and provide a graceful fallback

// IMPORTANT: this is the user's actual Blob base
const BLOB_BASE = 'https://ofbebc3ljlmaq3bj.public.blob.vercel-storage.com/headshots';
export const DEFAULT_HEADSHOT = `${BLOB_BASE}/default.png`;

const encode = (s) => encodeURIComponent(s);

// Normalize a candidate value to a usable key (string) or empty string
const toKey = (raw) => {
  if (raw == null) return '';
  const s = String(raw).trim();
  return s;
};

/**
 * Build a direct Blob URL for a player's headshot.
 * Priority:
 *  1) player.headshot (full URL)
 *  2) player.headshotUrl (full URL)
 *  3) Blob CDN path using player.id or player.player_id
 */
export function buildHeadshotUrl(player) {
  if (player?.headshot && typeof player.headshot === 'string') return player.headshot;
  if (player?.headshotUrl && typeof player.headshotUrl === 'string') return player.headshotUrl;

  const key = toKey(player?.id ?? player?.player_id);
  return key ? `${BLOB_BASE}/${encode(key)}.png` : DEFAULT_HEADSHOT;
}