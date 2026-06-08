/**
 * FILE: src/tests/architect/cockpit/tradeOpenRequest.test.ts
 * PURPOSE: Pure-logic coverage for the Trade Machine open-request payload
 *          (interconnectivity Slice 3a): default authority resolution, player-id
 *          normalization, label helpers, and banner-context detection. Runs in
 *          the node test:architect gate.
 * OWNERSHIP: Feature: architect/cockpit
 */
import { describe, expect, it } from 'vitest';
import {
  buildTradeOpenRequest,
  describeTradeObjective,
  describeTradeOpenAuthority,
  tradeRequestHasBannerContext,
} from '@/features/architect/cockpit/tradeOpenRequest';

describe('buildTradeOpenRequest', () => {
  it('treats bare player staging as a local draft', () => {
    const req = buildTradeOpenRequest({
      source: 'pinned',
      playerIds: ['p1', '', '  ', 'p2'],
    });
    expect(req.authority).toBe('local-draft');
    expect(req.playerIds).toEqual(['p1', 'p2']);
    expect(req.objective).toBeUndefined();
  });

  it('treats an objective/warning as planning context', () => {
    expect(
      buildTradeOpenRequest({ source: 'warning', objective: 'reduce-tax' })
        .authority
    ).toBe('planning-context');
    expect(
      buildTradeOpenRequest({
        source: 'exception',
        exceptionRef: { kind: 'tpe', id: 'tpe_1' },
      }).authority
    ).toBe('planning-context');
  });

  it('treats a History event reference as a committed-event reference', () => {
    const req = buildTradeOpenRequest({
      source: 'history',
      relatedEventId: 'evt_9',
    });
    expect(req.authority).toBe('committed-event-reference');
    expect(req.relatedEventId).toBe('evt_9');
  });

  it('honors an explicit authority override', () => {
    expect(
      buildTradeOpenRequest({
        source: 'guide',
        objective: 'solve-cap',
        authority: 'local-draft',
      }).authority
    ).toBe('local-draft');
  });

  it('omits an empty playerIds array', () => {
    const req = buildTradeOpenRequest({ source: 'nav', playerIds: ['', ' '] });
    expect(req.playerIds).toBeUndefined();
  });
});

describe('label helpers', () => {
  it('describes objectives and authorities', () => {
    expect(describeTradeObjective('clear-second-apron')).toBe(
      'Clear second apron'
    );
    expect(describeTradeOpenAuthority('committed-event-reference')).toEqual({
      label: 'Committed event reference',
      tone: 'committed',
    });
  });
});

describe('tradeRequestHasBannerContext', () => {
  it('is true for objective / exception / event references, false for bare staging', () => {
    expect(
      tradeRequestHasBannerContext(
        buildTradeOpenRequest({ source: 'warning', objective: 'reduce-tax' })
      )
    ).toBe(true);
    expect(
      tradeRequestHasBannerContext(
        buildTradeOpenRequest({ source: 'history', relatedEventId: 'e1' })
      )
    ).toBe(true);
    expect(
      tradeRequestHasBannerContext(
        buildTradeOpenRequest({ source: 'pinned', playerIds: ['p1'] })
      )
    ).toBe(false);
    expect(tradeRequestHasBannerContext(null)).toBe(false);
  });
});
