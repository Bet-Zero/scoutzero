/**
 * FILE: src/tests/architect/cockpit/followThroughContext.test.ts
 * PURPOSE: Pure-logic coverage for the Compare/Guide follow-through context
 *          (interconnectivity Slice 5a): normalization, Guide objective strings
 *          per origin, and Compare focus/authority resolution (incl. deferred
 *          player deltas + multi-season). Runs in the node test:architect gate.
 * OWNERSHIP: Feature: architect/cockpit
 */
import { describe, expect, it } from 'vitest';
import {
  buildFollowThroughContext,
  describeGuideObjective,
  describeCompareFocus,
} from '@/features/architect/cockpit/followThroughContext';

describe('buildFollowThroughContext', () => {
  it('filters empty player ids and flags multi-season for season-advance', () => {
    const ctx = buildFollowThroughContext({
      origin: 'season-advance',
      playerIds: ['p1', '', ' '],
    });
    expect(ctx.playerIds).toEqual(['p1']);
    expect(ctx.multiSeason).toBe(true);
  });
});

describe('describeGuideObjective', () => {
  it('maps warnings to concrete objectives', () => {
    expect(
      describeGuideObjective(
        buildFollowThroughContext({
          origin: 'warning',
          warningType: 'clear-second-apron',
        })
      )
    ).toBe('Solve second-apron restrictions.');
    expect(
      describeGuideObjective(
        buildFollowThroughContext({
          origin: 'warning',
          warningType: 'season-mismatch',
        })
      )
    ).toBe('Align viewing season with world season.');
  });

  it('maps player / receipt / trade origins', () => {
    expect(
      describeGuideObjective(
        buildFollowThroughContext({ origin: 'pinned-player', playerIds: ['p1'] })
      )
    ).toBe('Explore moves involving this player.');
    expect(
      describeGuideObjective(
        buildFollowThroughContext({ origin: 'receipt', receiptKind: 'trade' })
      )
    ).toBe('Decide the next move after this trade.');
    expect(
      describeGuideObjective(buildFollowThroughContext({ origin: 'trade' }))
    ).toBe('Find a legal trade.');
  });

  it('returns an empty objective for manual/no context (Guide empty state)', () => {
    expect(
      describeGuideObjective(buildFollowThroughContext({ origin: 'manual' }))
    ).toBe('');
    expect(describeGuideObjective(null)).toBe('');
  });
});

describe('describeCompareFocus', () => {
  it('labels receipt as committed world and history as event-derived', () => {
    expect(
      describeCompareFocus(buildFollowThroughContext({ origin: 'receipt' }))
        ?.authority
    ).toBe('committed-world');
    expect(
      describeCompareFocus(
        buildFollowThroughContext({ origin: 'history-event', eventId: 'e1' })
      )?.authority
    ).toBe('event-derived');
  });

  it('marks player-focused compare as unavailable (deltas deferred)', () => {
    const focus = describeCompareFocus(
      buildFollowThroughContext({ origin: 'pinned-player', playerIds: ['p1'] })
    );
    expect(focus?.authority).toBe('unavailable');
    expect(focus?.authorityLabel).toBe('Unavailable');
  });

  it('labels season-advance compare as multi-season', () => {
    expect(
      describeCompareFocus(
        buildFollowThroughContext({ origin: 'season-advance' })
      )?.authority
    ).toBe('multi-season');
  });

  it('returns null for a manual context', () => {
    expect(
      describeCompareFocus(buildFollowThroughContext({ origin: 'manual' }))
    ).toBeNull();
  });
});
