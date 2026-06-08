/**
 * FILE: src/features/architect/cockpit/playerActionContext.ts
 * PURPOSE: Shared player-context payload + action vocabulary for the unified
 *          PlayerActionMenu (interconnectivity Slice 2). Every player surface
 *          in the cockpit (Roster, Cap Sheet, Full Cap, pinned rail rows,
 *          receipt rows, Free Agency, History) builds one of these and the
 *          menu emits intents carrying it, so destinations can highlight and
 *          return correctly.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * No mutation authority, no React: pure types + a small builder. The menu
 * emits intents only; GMDashboard routes them to existing owners (Slice 2b).
 *
 * Reused by Slice 3 (player → trade), Slice 4 (History player names), and
 * Slice 5 (player → compare/guide).
 */
import type { ActiveTab } from '@/features/architect/GMDashboard/hooks/useArchitectState.types';
import { resolvePrimaryPlayerFocusId } from '@/features/architect/GMDashboard/postActionHandoff/playerFocus';

/**
 * Where a player-action invocation originated. Rooms reuse the existing
 * `ActiveTab` union; the non-room surfaces (rail / receipt / history / fa)
 * are added so a destination can decide how to return focus.
 */
export type PlayerActionSourceRoom =
  | ActiveTab
  | 'rail'
  | 'receipt'
  | 'history'
  | 'fa';

/**
 * The universal player-action vocabulary (master spec / Player Action Menu
 * contract). Surfaces choose a visible subset + overflow subset, but the
 * vocabulary itself is identical everywhere. Mutation-bearing, source-specific
 * actions (waive/extend/sign/offer-sheet/…) are NOT in this list — they stay
 * with their existing owners and, on Full Cap, are passed as `extraItems`.
 */
export type PlayerAction =
  | 'open'
  | 'pin'
  | 'unpin'
  | 'trade'
  | 'view-on-roster'
  | 'view-on-cap'
  | 'view-in-full-cap'
  | 'find-in-history'
  | 'compare-impact'
  | 'guide-next-move';

export interface PlayerActionContext {
  playerId: string;
  playerLabel: string;
  sourceRoom: PlayerActionSourceRoom;
  teamCode?: string;
  worldId?: string | null;
  /** Target year for Full Cap future-year navigation/highlight. */
  targetYear?: number;
  /** Set when the player comes from a receipt / History event. */
  eventId?: string | null;
  /** FA pin subtype (open-question #1): a pin flagged as a "Target". */
  isFreeAgentTarget?: boolean;
}

/** Minimal structural player shape the builder can resolve an id/label from. */
export interface PlayerActionContextPlayerLike {
  id?: string | number | null;
  player_id?: string | number | null;
  playerId?: string | number | null;
  name?: string | null;
  displayName?: string | null;
  bio?: { playerId?: string | number | null; displayName?: string | null } | null;
}

export interface BuildPlayerActionContextInput {
  player: PlayerActionContextPlayerLike;
  sourceRoom: PlayerActionSourceRoom;
  /** Explicit label override; otherwise resolved from the player's name fields. */
  playerLabel?: string | null;
  /** Explicit id override; otherwise resolved via `resolvePrimaryPlayerFocusId`. */
  playerId?: string | null;
  teamCode?: string;
  worldId?: string | null;
  targetYear?: number;
  eventId?: string | null;
  isFreeAgentTarget?: boolean;
}

const resolveLabel = (
  player: PlayerActionContextPlayerLike,
  override?: string | null
): string => {
  if (override && override.trim()) return override.trim();
  const candidate =
    player.displayName ?? player.bio?.displayName ?? player.name ?? null;
  if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  return 'Unknown player';
};

/**
 * Build a `PlayerActionContext` from a raw player object. Reuses the existing
 * `resolvePrimaryPlayerFocusId` identity helper so id resolution stays
 * consistent with the receipt/highlight system — no duplicate identity logic.
 * Returns null when no stable id can be resolved (caller should not render a
 * menu for an unidentifiable player rather than invent one).
 */
export function buildPlayerActionContext(
  input: BuildPlayerActionContextInput
): PlayerActionContext | null {
  const resolvedId =
    (input.playerId && input.playerId.trim()) ||
    resolvePrimaryPlayerFocusId(input.player);
  if (!resolvedId) return null;

  const context: PlayerActionContext = {
    playerId: resolvedId,
    playerLabel: resolveLabel(input.player, input.playerLabel),
    sourceRoom: input.sourceRoom,
  };
  if (input.teamCode) context.teamCode = input.teamCode;
  if (input.worldId !== undefined) context.worldId = input.worldId;
  if (typeof input.targetYear === 'number') context.targetYear = input.targetYear;
  if (input.eventId !== undefined) context.eventId = input.eventId;
  if (input.isFreeAgentTarget) context.isFreeAgentTarget = true;
  return context;
}
