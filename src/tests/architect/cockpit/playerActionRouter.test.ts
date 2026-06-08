/**
 * FILE: src/tests/architect/cockpit/playerActionRouter.test.ts
 * PURPOSE: Pure-logic coverage for the player-action dispatcher
 *          (interconnectivity Slice 2b). Runs in the node `test:architect`
 *          gate. Asserts every PlayerAction routes to exactly its owner and
 *          forwards the context unchanged.
 * OWNERSHIP: Feature: architect/cockpit
 */
import { describe, expect, it, vi } from 'vitest';
import {
  routePlayerAction,
  type PlayerActionRouterDeps,
} from '@/features/architect/cockpit/playerActionRouter';
import type {
  PlayerAction,
  PlayerActionContext,
} from '@/features/architect/cockpit/playerActionContext';

const CONTEXT: PlayerActionContext = {
  playerId: 'p1',
  playerLabel: 'LeBron James',
  sourceRoom: 'roster',
};

function makeDeps() {
  return {
    openInspect: vi.fn(),
    pinPlayer: vi.fn(),
    unpinPlayer: vi.fn(),
    openTradeWithPlayer: vi.fn(),
    viewOnRoster: vi.fn(),
    viewOnCap: vi.fn(),
    viewInFullCap: vi.fn(),
    findInHistory: vi.fn(),
    compareImpact: vi.fn(),
    guideNextMove: vi.fn(),
  } satisfies PlayerActionRouterDeps;
}

const CASES: Array<[PlayerAction, keyof PlayerActionRouterDeps]> = [
  ['open', 'openInspect'],
  ['pin', 'pinPlayer'],
  ['unpin', 'unpinPlayer'],
  ['trade', 'openTradeWithPlayer'],
  ['view-on-roster', 'viewOnRoster'],
  ['view-on-cap', 'viewOnCap'],
  ['view-in-full-cap', 'viewInFullCap'],
  ['find-in-history', 'findInHistory'],
  ['compare-impact', 'compareImpact'],
  ['guide-next-move', 'guideNextMove'],
];

describe('routePlayerAction', () => {
  it.each(CASES)(
    'routes "%s" to its owner with the context',
    (action, expectedDep) => {
      const deps = makeDeps();
      routePlayerAction(action, CONTEXT, deps);

      expect(deps[expectedDep]).toHaveBeenCalledTimes(1);
      expect(deps[expectedDep]).toHaveBeenCalledWith(CONTEXT);

      // No other owner should fire for a single intent.
      for (const [, dep] of CASES) {
        if (dep !== expectedDep) {
          expect(deps[dep]).not.toHaveBeenCalled();
        }
      }
    }
  );

  it('forwards the FA-target subtype flag intact on pin', () => {
    const deps = makeDeps();
    const faContext: PlayerActionContext = {
      ...CONTEXT,
      sourceRoom: 'fa',
      isFreeAgentTarget: true,
    };
    routePlayerAction('pin', faContext, deps);
    expect(deps.pinPlayer).toHaveBeenCalledWith(faContext);
    expect(deps.pinPlayer.mock.calls[0][0].isFreeAgentTarget).toBe(true);
  });
});
