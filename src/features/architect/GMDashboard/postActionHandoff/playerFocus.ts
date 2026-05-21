/**
 * FILE: src/features/architect/GMDashboard/postActionHandoff/playerFocus.ts
 * PURPOSE: Stage 2C player-focus identity matching helpers (visual-only).
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * `focusedPlayerId` is the optional id of the player that the dashboard
 * wants the active section surfaces (Roster, Cap Sheet, Full Cap Table)
 * to render as "just changed". It is derived from a Stage 2B post-action
 * receipt and is purely a visual highlight signal — no mutation, no
 * Firestore reads/writes, no derivation of cap/roster truth.
 */

type FocusablePlayerIdentity = {
  id?: string | number | null;
  player_id?: string | number | null;
  playerId?: string | number | null;
  name?: string | null;
  displayName?: string | null;
  bio?:
    | {
        playerId?: string | number | null;
        displayName?: string | null;
      }
    | null;
};

const COMBINING_MARKS = /[̀-ͯ]/g;
const NON_ALPHANUMERIC = /[^a-zA-Z0-9]/g;

const toStringKey = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const normalizeNameKey = (value: unknown): string | null => {
  const key = toStringKey(value);
  if (!key) return null;
  const normalized = key
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(NON_ALPHANUMERIC, '')
    .toLowerCase();
  return normalized || null;
};

export const collectPlayerFocusKeys = (
  player: FocusablePlayerIdentity | null | undefined
): string[] => {
  if (!player) return [];
  const direct = [
    player.id,
    player.player_id,
    player.playerId,
    player.bio?.playerId,
    player.name,
    player.displayName,
    player.bio?.displayName,
  ]
    .map(toStringKey)
    .filter((k): k is string => Boolean(k));

  const normalized = [
    player.name,
    player.displayName,
    player.bio?.displayName,
  ]
    .map(normalizeNameKey)
    .filter((k): k is string => Boolean(k));

  return Array.from(new Set([...direct, ...normalized]));
};

/**
 * Returns true when the candidate player identity matches the focus id
 * derived from a Stage 2B post-action receipt. Matching is intentionally
 * permissive across `id` / `player_id` / `bio.playerId` and a normalized
 * name fallback because committed receipts only carry a single
 * `playerId` token per change.
 *
 * Matching is **exact-equality only** on either a direct key or a
 * normalized-name key — never a substring match. Empty / whitespace
 * focus ids are treated as no-match (early return).
 *
 * Caveat: if the focus token happens to be a player name and two
 * roster members share the exact same normalized full name, both will
 * be highlighted. This is acceptable for a visual signal and is by
 * design — the receipt is the authority, not the highlight.
 */
export const playerMatchesFocus = (
  player: FocusablePlayerIdentity | null | undefined,
  focusedPlayerId: string | null | undefined
): boolean => {
  if (!focusedPlayerId || !player) return false;
  const focusKey = toStringKey(focusedPlayerId);
  if (!focusKey) return false;
  const focusKeys = new Set<string>();
  focusKeys.add(focusKey);
  const normalizedFocusKey = normalizeNameKey(focusedPlayerId);
  if (normalizedFocusKey) focusKeys.add(normalizedFocusKey);

  const candidateKeys = collectPlayerFocusKeys(player);
  for (const key of candidateKeys) {
    if (focusKeys.has(key)) return true;
  }
  return false;
};
