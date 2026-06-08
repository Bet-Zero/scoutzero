/**
 * FILE: src/features/architect/cockpit/tradeOpenRequest.ts
 * PURPOSE: Context-carrying payload for opening the Trade Machine overlay
 *          (interconnectivity Slice 3). Lets every entry point (player menu,
 *          cap/tax/apron warning, exception/TPE, History event, receipt, Guide)
 *          open the overlay with player ids AND an objective/context + an
 *          authority label — without the overlay becoming a mutation shortcut.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Pure types + builders/label helpers. No React, no mutation authority: opening
 * the overlay is navigation/UI state only; applying a trade still flows through
 * useArchitectActions → mutationPipeline. Reused by Slice 4 (History trade
 * event → trade context) and Slice 5 (Guide → trade).
 */

/** Where the overlay was opened from. */
export type TradeOpenSource =
  | 'nav'
  | 'pinned'
  | 'pinned-all'
  | 'roster'
  | 'cap'
  | 'warning'
  | 'exception'
  | 'history'
  | 'receipt'
  | 'guide';

/** A planning objective the user is trying to achieve with the trade. */
export type TradeObjective =
  | 'solve-cap'
  | 'reduce-tax'
  | 'clear-first-apron'
  | 'clear-second-apron'
  | 'avoid-hard-cap'
  | 'use-exception';

export type TradeExceptionKind =
  | 'mle'
  | 'room'
  | 'bae'
  | 'dpe'
  | 'tpe'
  | 'tpmle';

/**
 * How truthful the opening context is. Drives the in-overlay banner tone and
 * label — never implies the draft is validated or applied.
 */
export type TradeOpenAuthority =
  | 'local-draft'
  | 'planning-context'
  | 'committed-event-reference';

export interface TradeExceptionRef {
  kind: TradeExceptionKind;
  id?: string;
}

export interface TradeOpenRequest {
  source: TradeOpenSource;
  /** Players to stage/request into the editor (existing staging behavior). */
  playerIds?: string[];
  objective?: TradeObjective;
  exceptionRef?: TradeExceptionRef;
  /** History trade-event reference — related context only, never auto-cloned. */
  relatedEventId?: string | null;
  authority: TradeOpenAuthority;
}

const OBJECTIVE_LABELS: Record<TradeObjective, string> = {
  'solve-cap': 'Solve cap issue',
  'reduce-tax': 'Reduce luxury tax',
  'clear-first-apron': 'Clear first apron',
  'clear-second-apron': 'Clear second apron',
  'avoid-hard-cap': 'Resolve hard cap',
  'use-exception': 'Use exception / TPE',
};

const EXCEPTION_LABELS: Record<TradeExceptionKind, string> = {
  mle: 'MLE',
  room: 'Room exception',
  bae: 'BAE',
  dpe: 'DPE',
  tpe: 'Trade exception (TPE)',
  tpmle: 'Taxpayer MLE',
};

export interface TradeOpenAuthorityPresentation {
  label: string;
  tone: 'local' | 'planning' | 'committed';
}

const AUTHORITY_PRESENTATION: Record<
  TradeOpenAuthority,
  TradeOpenAuthorityPresentation
> = {
  'local-draft': { label: 'Local draft', tone: 'local' },
  'planning-context': { label: 'Planning context', tone: 'planning' },
  'committed-event-reference': {
    label: 'Committed event reference',
    tone: 'committed',
  },
};

export function describeTradeObjective(objective: TradeObjective): string {
  return OBJECTIVE_LABELS[objective];
}

export function describeTradeException(kind: TradeExceptionKind): string {
  return EXCEPTION_LABELS[kind];
}

export function describeTradeOpenAuthority(
  authority: TradeOpenAuthority
): TradeOpenAuthorityPresentation {
  return AUTHORITY_PRESENTATION[authority];
}

/**
 * Resolve the default authority for a request when one isn't given:
 * - a History/event reference is a committed-event reference,
 * - an objective / exception / warning / guide is planning context,
 * - bare player staging is a local draft.
 */
function defaultAuthority(
  input: Omit<TradeOpenRequest, 'authority'>
): TradeOpenAuthority {
  if (input.relatedEventId || input.source === 'history') {
    return 'committed-event-reference';
  }
  if (
    input.objective ||
    input.exceptionRef ||
    input.source === 'warning' ||
    input.source === 'exception' ||
    input.source === 'guide'
  ) {
    return 'planning-context';
  }
  return 'local-draft';
}

/**
 * Build a normalized TradeOpenRequest. Filters empty player ids and fills a
 * sensible default authority when not explicitly provided.
 */
export function buildTradeOpenRequest(
  input: Omit<TradeOpenRequest, 'authority'> & {
    authority?: TradeOpenAuthority;
  }
): TradeOpenRequest {
  const playerIds = (input.playerIds ?? []).filter(
    (id): id is string => Boolean(id && id.trim())
  );
  const request: TradeOpenRequest = {
    source: input.source,
    authority: input.authority ?? defaultAuthority(input),
  };
  if (playerIds.length > 0) request.playerIds = playerIds;
  if (input.objective) request.objective = input.objective;
  if (input.exceptionRef) request.exceptionRef = input.exceptionRef;
  if (input.relatedEventId !== undefined) {
    request.relatedEventId = input.relatedEventId;
  }
  return request;
}

/**
 * Whether a request carries any context worth showing the in-overlay banner
 * (objective / exception / committed-event reference). Bare player staging
 * (local draft, no objective) shows no banner.
 */
export function tradeRequestHasBannerContext(
  request: TradeOpenRequest | null | undefined
): boolean {
  if (!request) return false;
  return Boolean(
    request.objective ||
      request.exceptionRef ||
      request.relatedEventId ||
      request.authority === 'committed-event-reference' ||
      request.authority === 'planning-context'
  );
}
