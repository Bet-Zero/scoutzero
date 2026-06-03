/**
 * FILE: src/tests/architect/cockpit/playerActionContext.test.ts
 * PURPOSE: Pure-logic coverage for the shared player-action context builder
 *          (interconnectivity Slice 2a). Lives as `.ts` so it runs in the fast
 *          node-scoped `test:architect` gate (the `.tsx` config skips it).
 * OWNERSHIP: Feature: architect/cockpit
 */
import { describe, expect, it } from 'vitest';
import { buildPlayerActionContext } from '@/features/architect/cockpit/playerActionContext';

describe('buildPlayerActionContext', () => {
  it('resolves id and label from a raw player object', () => {
    const ctx = buildPlayerActionContext({
      player: { id: 'p1', displayName: 'LeBron James' },
      sourceRoom: 'roster',
    });
    expect(ctx).not.toBeNull();
    expect(ctx?.playerId).toBe('p1');
    expect(ctx?.playerLabel).toBe('LeBron James');
    expect(ctx?.sourceRoom).toBe('roster');
  });

  it('honors explicit id/label overrides', () => {
    const ctx = buildPlayerActionContext({
      player: { id: 'p1', displayName: 'LeBron James' },
      sourceRoom: 'cap',
      playerId: 'override-id',
      playerLabel: 'Override Label',
    });
    expect(ctx?.playerId).toBe('override-id');
    expect(ctx?.playerLabel).toBe('Override Label');
  });

  it('returns null when no stable id can be resolved', () => {
    expect(
      buildPlayerActionContext({ player: {}, sourceRoom: 'roster' })
    ).toBeNull();
  });

  it('falls back to a conservative label when the player has no name', () => {
    const ctx = buildPlayerActionContext({
      player: { id: 'p1' },
      sourceRoom: 'roster',
    });
    expect(ctx?.playerLabel).toBe('Unknown player');
  });

  it('carries FA-target, target year, and event id when provided', () => {
    const ctx = buildPlayerActionContext({
      player: { id: 'fa1', name: 'Free Agent' },
      sourceRoom: 'fa',
      isFreeAgentTarget: true,
      targetYear: 2027,
      eventId: 'evt_9',
    });
    expect(ctx?.isFreeAgentTarget).toBe(true);
    expect(ctx?.targetYear).toBe(2027);
    expect(ctx?.eventId).toBe('evt_9');
  });
});
