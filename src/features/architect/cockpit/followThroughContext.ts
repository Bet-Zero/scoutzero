/**
 * FILE: src/features/architect/cockpit/followThroughContext.ts
 * PURPOSE: Shared "follow-through" context payload (interconnectivity Slice 5)
 *          carried into the Compare and Guide rooms so they focus on the
 *          receipt / warning / pinned player / History event / season the user
 *          came from — instead of opening blank. Plus helpers that turn a
 *          context into a Guide objective string and a Compare focus label.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Pure types + builders. No React, no mutation authority — both rooms route to
 * existing owners only. Session-only (open-question #11): GMDashboard holds the
 * active context in state, never persisted. Reuses Slice 3 TradeObjective.
 */
import type { TradeObjective } from './tradeOpenRequest';

export type FollowThroughOrigin =
  | 'receipt'
  | 'warning'
  | 'pinned-player'
  | 'history-event'
  | 'fa-target'
  | 'season-advance'
  | 'trade'
  | 'manual';

export type FollowThroughWarning =
  | TradeObjective
  | 'season-mismatch'
  | 'offer-sheet-action'
  | 'roster-count'
  | 'no-exceptions';

export interface FollowThroughContext {
  origin: FollowThroughOrigin;
  teamCode?: string;
  worldId?: string | null;
  viewingSeason?: string;
  worldSeason?: string;
  playerIds?: string[];
  eventId?: string | null;
  /** ArchitectPostActionReceipt['kind'] when origin is a receipt. */
  receiptKind?: string;
  warningType?: FollowThroughWarning;
  localDraft?: boolean;
  multiSeason?: boolean;
  unavailableReason?: string;
}

export type CompareFocusAuthority =
  | 'committed-world'
  | 'event-derived'
  | 'current-snapshot'
  | 'local-preview'
  | 'multi-season'
  | 'unavailable';

export interface CompareFocusPresentation {
  heading: string;
  authority: CompareFocusAuthority;
  authorityLabel: string;
}

const COMPARE_AUTHORITY_LABEL: Record<CompareFocusAuthority, string> = {
  'committed-world': 'Committed world',
  'event-derived': 'Event-derived',
  'current-snapshot': 'Current snapshot',
  'local-preview': 'Local preview',
  'multi-season': 'Multi-season',
  unavailable: 'Unavailable',
};

const WARNING_OBJECTIVE: Record<FollowThroughWarning, string> = {
  'clear-second-apron': 'Solve second-apron restrictions.',
  'clear-first-apron': 'Solve first-apron restrictions.',
  'reduce-tax': 'Reduce luxury tax.',
  'solve-cap': 'Get under the salary cap.',
  'avoid-hard-cap': 'Resolve the hard-cap restriction.',
  'use-exception': 'Use an available exception.',
  'season-mismatch': 'Align viewing season with world season.',
  'offer-sheet-action': 'Resolve the pending offer sheet.',
  'roster-count': 'Fix the roster count.',
  'no-exceptions': 'Find a legal signing path.',
};

/** Build a normalized FollowThroughContext (filters empty player ids). */
export function buildFollowThroughContext(
  input: FollowThroughContext
): FollowThroughContext {
  const playerIds = (input.playerIds ?? []).filter(
    (id): id is string => Boolean(id && id.trim())
  );
  const context: FollowThroughContext = { origin: input.origin };
  if (input.teamCode) context.teamCode = input.teamCode;
  if (input.worldId !== undefined) context.worldId = input.worldId;
  if (input.viewingSeason) context.viewingSeason = input.viewingSeason;
  if (input.worldSeason) context.worldSeason = input.worldSeason;
  if (playerIds.length > 0) context.playerIds = playerIds;
  if (input.eventId !== undefined) context.eventId = input.eventId;
  if (input.receiptKind) context.receiptKind = input.receiptKind;
  if (input.warningType) context.warningType = input.warningType;
  if (input.localDraft) context.localDraft = true;
  if (input.multiSeason || input.origin === 'season-advance') {
    context.multiSeason = true;
  }
  if (input.unavailableReason) context.unavailableReason = input.unavailableReason;
  return context;
}

/**
 * Concrete Guide objective for a context (empty string ⇒ Guide shows its
 * "choose a context" empty state).
 */
export function describeGuideObjective(
  context: FollowThroughContext | null | undefined
): string {
  if (!context) return '';
  switch (context.origin) {
    case 'warning':
      return context.warningType
        ? WARNING_OBJECTIVE[context.warningType]
        : 'Resolve the flagged warning.';
    case 'pinned-player':
    case 'fa-target':
      return 'Explore moves involving this player.';
    case 'history-event':
      return 'Plan a follow-up to this committed event.';
    case 'season-advance':
      return 'Plan moves for the new season.';
    case 'trade':
      return 'Find a legal trade.';
    case 'receipt':
      if (context.receiptKind === 'trade') {
        return 'Decide the next move after this trade.';
      }
      if (context.receiptKind === 'signing') {
        return 'Plan next steps after this signing.';
      }
      return 'Decide the next move after this action.';
    case 'manual':
    default:
      return '';
  }
}

/** Compare focus heading + authority label for a context. */
export function describeCompareFocus(
  context: FollowThroughContext | null | undefined
): CompareFocusPresentation | null {
  if (!context) return null;
  let heading = 'Comparison';
  let authority: CompareFocusAuthority = 'committed-world';

  switch (context.origin) {
    case 'receipt':
      heading = 'Comparing the latest committed move';
      authority = context.localDraft ? 'local-preview' : 'committed-world';
      break;
    case 'history-event':
      heading = 'Comparing a committed event';
      authority = 'event-derived';
      break;
    case 'pinned-player':
    case 'fa-target':
      heading = 'Player-focused comparison';
      // Player-level deltas are deferred (open-question #13).
      authority = 'unavailable';
      break;
    case 'warning':
      heading = 'Cap-posture comparison';
      authority = 'current-snapshot';
      break;
    case 'season-advance':
      heading = 'Season-advance comparison';
      authority = 'multi-season';
      break;
    case 'trade':
      heading = 'Trade comparison';
      authority = context.localDraft ? 'local-preview' : 'committed-world';
      break;
    case 'manual':
    default:
      return null;
  }

  if (context.multiSeason && authority !== 'unavailable') {
    authority = 'multi-season';
  }

  return {
    heading,
    authority,
    authorityLabel: COMPARE_AUTHORITY_LABEL[authority],
  };
}
