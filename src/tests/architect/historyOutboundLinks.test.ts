/**
 * FILE: src/tests/architect/historyOutboundLinks.test.ts
 * PURPOSE: Pure-logic coverage for the History outbound-link resolver
 *          (interconnectivity Slice 4a): event classification, per-event link
 *          sets, related-event trade context (no clone), unavailable/deferred
 *          messaging, and the DEV/local committed-link suppression rule.
 * OWNERSHIP: Feature: architect/history
 */
import { describe, expect, it } from 'vitest';
import {
  resolveHistoryEventKind,
  resolveHistoryOutboundLinks,
} from '@/features/architect/history/TeamHistoryTab/historyOutboundLinks';
import type { TeamHistoryLooseTimelineEntry } from '@/features/architect/history/TeamHistoryTab/types';

const entry = (
  over: Partial<TeamHistoryLooseTimelineEntry>
): TeamHistoryLooseTimelineEntry => ({ id: 'e1', ...over });

const ids = (links: { id: string }[]) => links.map((l) => l.id);

describe('resolveHistoryEventKind', () => {
  it('classifies by mutationType', () => {
    expect(resolveHistoryEventKind(entry({ mutationType: 'executeTrade' }))).toBe(
      'trade'
    );
    expect(
      resolveHistoryEventKind(entry({ mutationType: 'waivePlayer' }))
    ).toBe('waive');
    expect(
      resolveHistoryEventKind(entry({ mutationType: 'storeOfferSheet' }))
    ).toBe('offerSheet');
    expect(
      resolveHistoryEventKind(entry({ mutationType: 'seasonAdvance' }))
    ).toBe('seasonAdvance');
  });

  it('falls back to fuzzy matching on type/category', () => {
    expect(resolveHistoryEventKind(entry({ type: 'Contract Extension' }))).toBe(
      'extension'
    );
    expect(resolveHistoryEventKind(entry({ type: 'unknown thing' }))).toBe(
      'other'
    );
  });
});

describe('resolveHistoryOutboundLinks', () => {
  it('trade events route to roster/cap/full-cap/compare/guide + a no-clone trade context', () => {
    const links = resolveHistoryOutboundLinks(
      entry({ mutationType: 'executeTrade', eventId: 'evt_42' })
    );
    expect(ids(links)).toEqual([
      'roster',
      'cap',
      'capfull',
      'trade-context',
      'compare',
      'guide',
    ]);
    const tradeCtx = links.find((l) => l.id === 'trade-context');
    expect(tradeCtx?.kind).toBe('trade-context');
    expect(tradeCtx?.tradeRequest?.source).toBe('history');
    expect(tradeCtx?.tradeRequest?.relatedEventId).toBe('evt_42');
    expect(tradeCtx?.tradeRequest?.authority).toBe('committed-event-reference');
    expect(tradeCtx?.tradeRequest?.playerIds).toBeUndefined(); // no clone
  });

  it('extension prefers Full Cap first', () => {
    const links = resolveHistoryOutboundLinks(
      entry({ mutationType: 'extendContract' })
    );
    expect(links[0]?.room).toBe('capfull');
  });

  it('offer-sheet events route to Free Agency first', () => {
    const links = resolveHistoryOutboundLinks(
      entry({ mutationType: 'matchOfferSheet' })
    );
    expect(links[0]?.room).toBe('fa');
  });

  it('season-advance routes to Offseason', () => {
    const links = resolveHistoryOutboundLinks(
      entry({ mutationType: 'seasonAdvance' })
    );
    expect(links.some((l) => l.room === 'offseason')).toBe(true);
  });

  it('draft/asset events surface an unavailable summary, never a fake link', () => {
    const links = resolveHistoryOutboundLinks(
      entry({ mutationType: 'draftPick' })
    );
    const unavailable = links.find((l) => l.kind === 'unavailable');
    expect(unavailable?.unavailableReason).toMatch(/not available yet/i);
    expect(unavailable?.authority).toBe('deferred');
  });

  it('suppresses the committed-event trade context for non-committed (DEV/local) entries', () => {
    const links = resolveHistoryOutboundLinks(
      entry({ mutationType: 'executeTrade' }),
      { isCommitted: false }
    );
    expect(links.some((l) => l.kind === 'trade-context')).toBe(false);
  });
});
