/**
 * FILE: src/features/architect/utils/ownFreeAgents.ts
 * PURPOSE: Resolve a team's own free agents (unsigned cap holds whose rights the
 *          team holds, for the season being planned) into a compact, surface-
 *          agnostic list. This is the single source shared by the Full Cap Table
 *          own-FA decision rows and the Free Agency room's Sign & Trade start
 *          point (BZE-249), so both surfaces show the identical set.
 * OWNERSHIP: Feature: architect/utils (free-agency resolution)
 *
 * The placement logic lives in `resolveFreeAgentRights` — an own free agent for
 * the active season resolves to placement 'main'. We reuse it verbatim so this
 * list never drifts from the Full Cap Table's FA decision rows.
 */

import { resolveFreeAgentRights } from '@/features/architect/utils/freeAgentRights';
import type { FreeAgentRights } from '@/features/architect/utils/freeAgentRights';

export interface OwnFreeAgentCapHoldLike {
  playerId?: string | number | null;
  playerName?: string | null;
  amount?: number | null;
  type?: string | null;
  season?: string | number | null;
  isSigned?: boolean | null;
}

export interface OwnFreeAgentEntry {
  /** Stable id for React keys and the Sign & Trade handoff. */
  key: string;
  playerId: string | null;
  playerName: string;
  /** Normalized free-agent tag (UFA / RFA / …). */
  faType: string;
  capHoldAmount: number;
  /** Full player record when the lookup resolved one; null falls back to the hold. */
  player: Record<string, unknown> | null;
  rights: FreeAgentRights;
  hold: OwnFreeAgentCapHoldLike;
}

const normalizeFAType = (type: string | null | undefined): string => {
  if (!type) return 'UFA';
  const t = type.toLowerCase();
  if (t === 'unrestricted' || t === 'ufa') return 'UFA';
  if (t === 'restricted' || t === 'rfa') return 'RFA';
  return type.toUpperCase();
};

const toStartYear = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const seasonMatch = trimmed.match(/^(\d{4})-\d{2}$/);
  if (seasonMatch) return Number(seasonMatch[1]);
  const numericYear = Number.parseInt(trimmed, 10);
  return /^\d{4}$/.test(trimmed) && Number.isFinite(numericYear)
    ? numericYear
    : null;
};

const normalizeLookupKey = (value: unknown): string | null => {
  if (value == null) return null;
  const normalized = String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || null;
};

const addLookupKey = (keys: Set<string>, value: unknown) => {
  if (value == null) return;
  const raw = String(value).trim();
  if (!raw) return;
  keys.add(raw);
  const normalized = normalizeLookupKey(raw);
  if (normalized) keys.add(normalized);
};

const getPlayerLookupKeys = (player: Record<string, unknown> | null) => {
  const keys = new Set<string>();
  if (!player) return keys;
  const anyPlayer = player as {
    id?: unknown;
    player_id?: unknown;
    playerId?: unknown;
    name?: unknown;
    displayName?: unknown;
    bio?: { playerId?: unknown; displayName?: unknown };
  };
  addLookupKey(keys, anyPlayer.id);
  addLookupKey(keys, anyPlayer.player_id);
  addLookupKey(keys, anyPlayer.playerId);
  addLookupKey(keys, anyPlayer.bio?.playerId);
  addLookupKey(keys, anyPlayer.name);
  addLookupKey(keys, anyPlayer.displayName);
  addLookupKey(keys, anyPlayer.bio?.displayName);
  return keys;
};

const getHoldLookupKeys = (hold: OwnFreeAgentCapHoldLike) => {
  const keys = new Set<string>();
  addLookupKey(keys, hold.playerId);
  addLookupKey(keys, hold.playerName);
  return keys;
};

const resolveCapHoldPlayer = (
  hold: OwnFreeAgentCapHoldLike,
  playersMap: Record<string, unknown>
): Record<string, unknown> | null => {
  for (const key of getHoldLookupKeys(hold)) {
    const player = playersMap[key];
    if (player && typeof player === 'object') {
      return player as Record<string, unknown>;
    }
  }
  return null;
};

export interface TeamCapSheetForOwnFreeAgents {
  players?: Array<Record<string, unknown>> | null;
  capHolds?: OwnFreeAgentCapHoldLike[] | null;
}

/**
 * Resolve the team's own free agents for the active season — the same set the
 * Full Cap Table renders as FA decision rows (placement 'main').
 *
 * @param currentYear END year of the active column (e.g. 2027 for "2026-27").
 *        Free-agency years are START years, so we plan against `currentYear - 1`
 *        exactly as the Full Cap Table does.
 */
export const resolveOwnFreeAgents = (
  teamCapSheet: TeamCapSheetForOwnFreeAgents | null | undefined,
  playersMap: Record<string, unknown>,
  currentYear: number
): OwnFreeAgentEntry[] => {
  if (!teamCapSheet) return [];

  // "Do we hold this player's rights?" — built from the RAW roster, which still
  // lists own free agents whose contracts expired. Mirrors CapSheetFull.
  const rosterLookupKeys = new Set<string>();
  for (const player of teamCapSheet.players || []) {
    for (const key of getPlayerLookupKeys(player)) {
      rosterLookupKeys.add(key);
    }
  }

  const unsignedHolds = (teamCapSheet.capHolds || []).filter(
    (hold) => !hold?.isSigned
  );

  const entries: OwnFreeAgentEntry[] = [];
  unsignedHolds.forEach((hold, index) => {
    const player = resolveCapHoldPlayer(hold, playersMap);
    const holdKeys = getHoldLookupKeys(hold);
    const playerKeys = getPlayerLookupKeys(player);
    const isOnRoster =
      Array.from(holdKeys).some((key) => rosterLookupKeys.has(key)) ||
      Array.from(playerKeys).some((key) => rosterLookupKeys.has(key));

    const rights = resolveFreeAgentRights(
      player as Parameters<typeof resolveFreeAgentRights>[0],
      {
        activeSeasonStartYear: currentYear - 1,
        holdType: hold.type ?? undefined,
        holdSeasonStartYear: toStartYear(hold.season) ?? undefined,
        isOnRoster,
      }
    );

    // Only this-season own free agents the team holds rights to — the exact set
    // the Full Cap Table surfaces as FA decision rows.
    if (rights.placement !== 'main') return;

    const playerName = String(
      hold.playerName || hold.playerId || 'Free agent'
    );
    entries.push({
      key: `own-fa-${hold.playerId ?? playerName}-${index}`,
      playerId: hold.playerId == null ? null : String(hold.playerId),
      playerName,
      faType: normalizeFAType(rights.freeAgentType || hold.type),
      capHoldAmount: Number(rights.capHoldAmount || hold.amount || 0),
      player,
      rights,
      hold,
    });
  });

  return entries;
};
