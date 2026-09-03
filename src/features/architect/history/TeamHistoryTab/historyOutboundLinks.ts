/**
 * FILE: src/features/architect/history/TeamHistoryTab/historyOutboundLinks.ts
 * PURPOSE: Pure resolver mapping a committed History event to its event-type-
 *          aware outbound links (interconnectivity Slice 4). Turns the
 *          read-only HistoryDetailModal into a navigable hub — routing to
 *          existing rooms, a related-event trade context (never a clone), and
 *          honest "unavailable/deferred" messages instead of fake links.
 * OWNERSHIP: Feature: architect/history
 *
 * Pure function over the existing TeamHistoryLooseTimelineEntry fields — no
 * React, no mutation authority, no synthesized asset/draft truth. The modal
 * (Slice 4b) renders these and wires the actual navigation / openTradeWithRequest
 * / PlayerActionMenu callbacks.
 */
import type { ActiveTab } from '@/features/architect/GMDashboard/hooks/useArchitectState.types';
import {
  buildTradeOpenRequest,
  type TradeOpenRequest,
} from '@/features/architect/cockpit/tradeOpenRequest';
import type { TeamHistoryLooseTimelineEntry } from './types';

export type HistoryEventKind =
  | 'trade'
  | 'signing'
  | 'signAndTrade'
  | 'waive'
  | 'stretch'
  | 'extension'
  | 'option'
  | 'renounce'
  | 'offerSheet'
  | 'seasonAdvance'
  | 'draftAsset'
  | 'other';

export type HistoryLinkKind = 'nav' | 'trade-context' | 'unavailable';

export type HistoryLinkAuthority =
  | 'committed-event'
  | 'current-result'
  | 'unavailable'
  | 'deferred';

export interface HistoryOutboundLink {
  id: string;
  label: string;
  kind: HistoryLinkKind;
  /** Destination room for `nav` links. */
  room?: ActiveTab;
  /** Related-event trade context for `trade-context` links (never auto-cloned). */
  tradeRequest?: TradeOpenRequest;
  /** Contract message for `unavailable` links. */
  unavailableReason?: string;
  authority: HistoryLinkAuthority;
}

export interface ResolveHistoryOutboundLinksOptions {
  /**
   * Whether the event is committed world truth. DEV/local entries are not, so
   * committed-event references (the trade context) are suppressed for them.
   */
  isCommitted?: boolean;
}

const MUTATION_KIND: Record<string, HistoryEventKind> = {
  executeTrade: 'trade',
  trade: 'trade',
  signFreeAgent: 'signing',
  signing: 'signing',
  resign: 'signing',
  reSign: 'signing',
  signAndTrade: 'signAndTrade',
  waivePlayer: 'waive',
  waive: 'waive',
  stretch: 'stretch',
  stretchWaive: 'stretch',
  extendContract: 'extension',
  extension: 'extension',
  optionDecision: 'option',
  option: 'option',
  renounce: 'renounce',
  renounceRights: 'renounce',
  capHold: 'renounce',
  storeOfferSheet: 'offerSheet',
  matchOfferSheet: 'offerSheet',
  declineOfferSheet: 'offerSheet',
  finalizeMatchedOfferSheet: 'offerSheet',
  finalizeDeclinedOfferSheet: 'offerSheet',
  offerSheet: 'offerSheet',
  seasonAdvance: 'seasonAdvance',
  advanceSeason: 'seasonAdvance',
  draftPick: 'draftAsset',
  assetMovement: 'draftAsset',
};

/** Classify an event from its `mutationType` (preferred) or `type`/`category`. */
export function resolveHistoryEventKind(
  entry: TeamHistoryLooseTimelineEntry
): HistoryEventKind {
  const candidates = [entry.mutationType, entry.type, entry.category];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      const key = candidate.trim();
      if (MUTATION_KIND[key]) return MUTATION_KIND[key];
      const lower = key.toLowerCase();
      if (lower.includes('trade') && lower.includes('sign')) {
        return 'signAndTrade';
      }
      if (lower.includes('trade')) return 'trade';
      if (lower.includes('waive')) return 'waive';
      if (lower.includes('stretch')) return 'stretch';
      if (lower.includes('exten')) return 'extension';
      if (lower.includes('option')) return 'option';
      if (lower.includes('renounce') || lower.includes('caphold')) {
        return 'renounce';
      }
      if (lower.includes('offer')) return 'offerSheet';
      if (lower.includes('season')) return 'seasonAdvance';
      if (lower.includes('draft') || lower.includes('pick')) {
        return 'draftAsset';
      }
      if (lower.includes('sign')) return 'signing';
    }
  }
  return 'other';
}

const nav = (
  id: string,
  label: string,
  room: ActiveTab,
  authority: HistoryLinkAuthority = 'current-result'
): HistoryOutboundLink => ({ id, label, kind: 'nav', room, authority });

const VIEW_ROSTER = () => nav('roster', 'View on Roster', 'roster');
const VIEW_CAP = () => nav('cap', 'View on Cap Sheet', 'cap');
const VIEW_FULL_CAP = () => nav('capfull', 'View in Full Cap', 'capfull');
const VIEW_FA = () => nav('fa', 'View Free Agency', 'fa');
const COMPARE = () => nav('compare', 'Compare', 'compare');
const GUIDE = () => nav('guide', 'Guide next move', 'guide');

/**
 * Resolve the ordered outbound links for an event. The first few are the modal's
 * primary buttons; the rest belong in an overflow (modal caps the primary set).
 */
export function resolveHistoryOutboundLinks(
  entry: TeamHistoryLooseTimelineEntry,
  options: ResolveHistoryOutboundLinksOptions = {}
): HistoryOutboundLink[] {
  const isCommitted = options.isCommitted ?? true;
  const kind = resolveHistoryEventKind(entry);
  const relatedEventId =
    (typeof entry.eventId === 'string' && entry.eventId) ||
    (entry.id != null ? String(entry.id) : null);

  const tradeContextLink = (): HistoryOutboundLink | null => {
    // Trade context is a committed-event reference — never offered for
    // non-committed (DEV/local) entries, and never clones the old trade.
    if (!isCommitted) return null;
    return {
      id: 'trade-context',
      label: 'Review this trade',
      kind: 'trade-context',
      tradeRequest: buildTradeOpenRequest({
        source: 'history',
        relatedEventId,
      }),
      authority: 'committed-event',
    };
  };

  const links: Array<HistoryOutboundLink | null> = [];

  switch (kind) {
    case 'trade':
      links.push(
        VIEW_ROSTER(),
        VIEW_CAP(),
        VIEW_FULL_CAP(),
        tradeContextLink(),
        COMPARE(),
        GUIDE()
      );
      break;
    case 'signing':
      links.push(
        VIEW_ROSTER(),
        VIEW_CAP(),
        VIEW_FULL_CAP(),
        VIEW_FA(),
        COMPARE(),
        GUIDE()
      );
      break;
    case 'signAndTrade':
      links.push(
        VIEW_CAP(),
        VIEW_ROSTER(),
        tradeContextLink(),
        COMPARE(),
        GUIDE()
      );
      break;
    case 'waive':
    case 'stretch':
      links.push(VIEW_CAP(), VIEW_FULL_CAP(), COMPARE(), GUIDE());
      break;
    case 'extension':
      // Full Cap preferred first for extensions.
      links.push(VIEW_FULL_CAP(), VIEW_CAP(), COMPARE(), GUIDE());
      break;
    case 'option':
      links.push(VIEW_CAP(), VIEW_FULL_CAP(), COMPARE(), GUIDE());
      break;
    case 'renounce':
      links.push(VIEW_CAP(), VIEW_FULL_CAP(), COMPARE(), GUIDE());
      break;
    case 'offerSheet':
      links.push(VIEW_FA(), VIEW_CAP(), VIEW_ROSTER(), COMPARE(), GUIDE());
      break;
    case 'seasonAdvance':
      links.push(
        nav('offseason', 'Go to Offseason', 'offseason'),
        VIEW_CAP(),
        VIEW_ROSTER(),
        COMPARE(),
        GUIDE()
      );
      break;
    case 'draftAsset':
      links.push(
        tradeContextLink(),
        {
          id: 'asset-unavailable',
          label: 'Draft asset summary',
          kind: 'unavailable',
          unavailableReason: 'Draft asset summary is not available yet.',
          authority: 'deferred',
        },
        COMPARE(),
        GUIDE()
      );
      break;
    default:
      links.push(VIEW_CAP(), COMPARE(), GUIDE());
      break;
  }

  return links.filter((link): link is HistoryOutboundLink => link !== null);
}
