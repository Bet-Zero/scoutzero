/**
 * FILE: src/features/architect/cockpit/playerActionRouter.ts
 * PURPOSE: Pure dispatch layer that maps a unified PlayerAction + its context
 *          to the cockpit's existing navigation/pin/trade/inspect owners
 *          (interconnectivity Slice 2). Centralizing the mapping here keeps
 *          GMDashboard's wiring thin and makes the routing unit-testable
 *          without React.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * No mutation authority: every dep is an existing GMDashboard navigation/UI
 * callback. World writes still flow through useArchitectActions → the deps
 * here only *route* (e.g. `openInspect` opens EditContractModal; it does not
 * itself mutate). This module imports nothing from the mutation pipeline.
 */
import type { PlayerAction, PlayerActionContext } from './playerActionContext';

/**
 * The owners a PlayerAction can route to. Each is supplied by GMDashboard and
 * reuses plumbing that already exists there (addPin/removePin, openTrade,
 * setActiveTab + focus, handleEditContract, openHistoryRoot).
 */
export interface PlayerActionRouterDeps {
  /** Open = inspect in EditContractModal (open-question #2). Never pins. */
  openInspect: (context: PlayerActionContext) => void;
  /** Explicit pin (carries the FA-target subtype flag via context). */
  pinPlayer: (context: PlayerActionContext) => void;
  /** Remove from the pinned board only — no world/cap/roster change. */
  unpinPlayer: (context: PlayerActionContext) => void;
  /** Open the Trade overlay with this player staged/requested. */
  openTradeWithPlayer: (context: PlayerActionContext) => void;
  /** Switch to Roster and highlight the player when present. */
  viewOnRoster: (context: PlayerActionContext) => void;
  /** Switch to current-season Cap Sheet and highlight when present. */
  viewOnCap: (context: PlayerActionContext) => void;
  /** Switch to Full Cap Table and highlight (preserve target year). */
  viewInFullCap: (context: PlayerActionContext) => void;
  /** Route to History (Slice 4 deepens to player-focused events). */
  findInHistory: (context: PlayerActionContext) => void;
  /** Route to Compare (Slice 5 deepens with player context). */
  compareImpact: (context: PlayerActionContext) => void;
  /** Route to Guide (Slice 5 deepens with player context). */
  guideNextMove: (context: PlayerActionContext) => void;
}

/**
 * Dispatch a single player-menu intent to the matching owner. Exhaustive over
 * the PlayerAction union (the `never` default makes a missed case a compile
 * error if the vocabulary grows).
 */
export function routePlayerAction(
  action: PlayerAction,
  context: PlayerActionContext,
  deps: PlayerActionRouterDeps
): void {
  switch (action) {
    case 'open':
      deps.openInspect(context);
      return;
    case 'pin':
      deps.pinPlayer(context);
      return;
    case 'unpin':
      deps.unpinPlayer(context);
      return;
    case 'trade':
      deps.openTradeWithPlayer(context);
      return;
    case 'view-on-roster':
      deps.viewOnRoster(context);
      return;
    case 'view-on-cap':
      deps.viewOnCap(context);
      return;
    case 'view-in-full-cap':
      deps.viewInFullCap(context);
      return;
    case 'find-in-history':
      deps.findInHistory(context);
      return;
    case 'compare-impact':
      deps.compareImpact(context);
      return;
    case 'guide-next-move':
      deps.guideNextMove(context);
      return;
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
