/**
 * FILE: src/tests/architect/architectActivityRail.stage1d.test.ts
 * PURPOSE: Unit tests for Stage 1D ScenarioMoveRail derivation logic.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Tests cover deriveActivityRailState directly (pure function, no Firestore).
 * Component-level rendering is not tested here — useWorldTeamEvents requires
 * Firestore and the repo does not have a stable component test pattern for that.
 */

import { describe, expect, it } from 'vitest';
import {
  deriveActivityRailState,
} from '@/features/architect/GMDashboard/hooks/useScenarioActivityRail';
import type { TeamHistoryWorldEventRow } from '@/features/architect/history/utils/normalizeWorldEventsForTeamHistory';
import type { DisplaySection } from '@/features/architect/history/utils/normalizeWorldEventsForTeamHistory.utils';

const makeEvent = (
  overrides: Partial<TeamHistoryWorldEventRow> = {}
): TeamHistoryWorldEventRow => ({
  id: 'evt_1',
  category: 'Contract',
  type: 'Sign',
  timestamp: '2026-01-15T00:00:00.000Z',
  occurredAt: '2026-01-15T00:00:00.000Z',
  teamCodes: ['LAL'],
  teamsInvolved: ['LAL'],
  playerIds: ['player_1'],
  primaryDeltas: 'Sign: Player One',
  capDelta: null,
  summary: 'Signed Player One to a standard contract',
  detailSections: [] as DisplaySection[],
  eventId: 'evt_1',
  operationId: null,
  mutationType: 'signFreeAgent',
  beforeTotalsByTeam: {},
  afterTotalsByTeam: {},
  raw: {},
  ...overrides,
});

describe('Stage 1D activity rail state derivation', () => {
  describe('sandbox / no-world mode', () => {
    it('returns sandbox status when worldId is null', () => {
      const state = deriveActivityRailState({
        worldId: null,
        normalizedEvents: [],
        loading: false,
        error: null,
        hasMore: false,
      });

      expect(state.status).toBe('sandbox');
    });

    it('returns sandbox status when worldId is undefined', () => {
      const state = deriveActivityRailState({
        worldId: undefined,
        normalizedEvents: [],
        loading: false,
        error: null,
        hasMore: false,
      });

      expect(state.status).toBe('sandbox');
    });

    it('sandbox status overrides events if somehow events are passed without a world', () => {
      const state = deriveActivityRailState({
        worldId: null,
        normalizedEvents: [makeEvent()],
        loading: false,
        error: null,
        hasMore: false,
      });

      expect(state.status).toBe('sandbox');
    });
  });

  describe('world active — loading and error states', () => {
    it('returns loading when world is active and no events have loaded yet', () => {
      const state = deriveActivityRailState({
        worldId: 'world_deadline',
        normalizedEvents: [],
        loading: true,
        error: null,
        hasMore: false,
      });

      expect(state.status).toBe('loading');
    });

    it('returns error when world is active, fetch failed, and no stale events', () => {
      const state = deriveActivityRailState({
        worldId: 'world_deadline',
        normalizedEvents: [],
        loading: false,
        error: 'Permission denied',
        hasMore: false,
      });

      expect(state.status).toBe('error');
      if (state.status === 'error') {
        expect(state.message).toBe('Permission denied');
      }
    });

    it('falls through to available when error occurs alongside stale events', () => {
      const state = deriveActivityRailState({
        worldId: 'world_deadline',
        normalizedEvents: [makeEvent()],
        loading: false,
        error: 'Reload failed but stale events remain',
        hasMore: false,
      });

      expect(state.status).toBe('available');
      if (state.status === 'available') {
        expect(state.entries).toHaveLength(1);
        expect(state.entries[0].authority).toBe('committed-world');
      }
    });

    it('keeps stale committed entries visible while a refresh is loading', () => {
      const state = deriveActivityRailState({
        worldId: 'world_deadline',
        normalizedEvents: [makeEvent({ summary: 'Previously loaded event' })],
        loading: true,
        error: null,
        hasMore: false,
      });

      expect(state.status).toBe('available');
      if (state.status === 'available') {
        expect(state.entries[0].summary).toBe('Previously loaded event');
      }
    });
  });

  describe('world active — empty events', () => {
    it('returns empty when world is active but no committed events found', () => {
      const state = deriveActivityRailState({
        worldId: 'world_deadline',
        normalizedEvents: [],
        loading: false,
        error: null,
        hasMore: false,
      });

      expect(state.status).toBe('empty');
    });
  });

  describe('world active — committed events available', () => {
    it('returns available state with entries when committed events exist', () => {
      const events = [
        makeEvent({ id: 'evt_1', summary: 'Signed Player One' }),
        makeEvent({ id: 'evt_2', summary: 'Traded Player Two', category: 'Trade' }),
      ];

      const state = deriveActivityRailState({
        worldId: 'world_deadline',
        normalizedEvents: events,
        loading: false,
        error: null,
        hasMore: false,
      });

      expect(state.status).toBe('available');
      if (state.status === 'available') {
        expect(state.entries).toHaveLength(2);
        expect(state.entries[0].id).toBe('evt_1');
        expect(state.entries[0].summary).toBe('Signed Player One');
        expect(state.entries[1].id).toBe('evt_2');
        expect(state.entries[1].typeLabel).toBe('Trade');
      }
    });

    it('all entries carry committed-world authority label', () => {
      const events = [makeEvent(), makeEvent({ id: 'evt_2' })];

      const state = deriveActivityRailState({
        worldId: 'world_deadline',
        normalizedEvents: events,
        loading: false,
        error: null,
        hasMore: false,
      });

      expect(state.status).toBe('available');
      if (state.status === 'available') {
        for (const entry of state.entries) {
          expect(entry.authority).toBe('committed-world');
        }
      }
    });

    it('caps entries at 5 regardless of events array length', () => {
      const events = Array.from({ length: 10 }, (_, i) =>
        makeEvent({ id: `evt_${i}`, summary: `Event ${i}` })
      );

      const state = deriveActivityRailState({
        worldId: 'world_deadline',
        normalizedEvents: events,
        loading: false,
        error: null,
        hasMore: true,
      });

      expect(state.status).toBe('available');
      if (state.status === 'available') {
        expect(state.entries).toHaveLength(5);
        expect(state.hasMore).toBe(true);
      }
    });

    it('preserves hasMore:false when no further events', () => {
      const state = deriveActivityRailState({
        worldId: 'world_deadline',
        normalizedEvents: [makeEvent()],
        loading: false,
        error: null,
        hasMore: false,
      });

      expect(state.status).toBe('available');
      if (state.status === 'available') {
        expect(state.hasMore).toBe(false);
      }
    });

    it('uses category as typeLabel when available', () => {
      const state = deriveActivityRailState({
        worldId: 'world_deadline',
        normalizedEvents: [makeEvent({ id: 'evt_1', category: 'Trade' })],
        loading: false,
        error: null,
        hasMore: false,
      });

      expect(state.status).toBe('available');
      if (state.status === 'available') {
        expect(state.entries[0].typeLabel).toBe('Trade');
      }
    });

    it('falls back to type when category is empty', () => {
      const state = deriveActivityRailState({
        worldId: 'world_deadline',
        normalizedEvents: [makeEvent({ id: 'evt_1', category: '', type: 'Waive' })],
        loading: false,
        error: null,
        hasMore: false,
      });

      expect(state.status).toBe('available');
      if (state.status === 'available') {
        expect(state.entries[0].typeLabel).toBe('Waive');
      }
    });

    it('uses timestamp as fallback when occurredAt is null', () => {
      const state = deriveActivityRailState({
        worldId: 'world_deadline',
        normalizedEvents: [
          makeEvent({
            id: 'evt_1',
            occurredAt: null,
            timestamp: '2026-01-20T00:00:00.000Z',
          }),
        ],
        loading: false,
        error: null,
        hasMore: false,
      });

      expect(state.status).toBe('available');
      if (state.status === 'available') {
        expect(state.entries[0].occurredAt).toBe('2026-01-20T00:00:00.000Z');
      }
    });

    it('falls back to World Event label when both category and type are empty', () => {
      const state = deriveActivityRailState({
        worldId: 'world_deadline',
        normalizedEvents: [makeEvent({ id: 'evt_1', category: '', type: '' })],
        loading: false,
        error: null,
        hasMore: false,
      });

      expect(state.status).toBe('available');
      if (state.status === 'available') {
        expect(state.entries[0].typeLabel).toBe('World Event');
      }
    });

    it('preserves occurredAt on entries for date display', () => {
      const state = deriveActivityRailState({
        worldId: 'world_deadline',
        normalizedEvents: [
          makeEvent({ id: 'evt_1', occurredAt: '2026-02-15T00:00:00.000Z' }),
        ],
        loading: false,
        error: null,
        hasMore: false,
      });

      expect(state.status).toBe('available');
      if (state.status === 'available') {
        expect(state.entries[0].occurredAt).toBe('2026-02-15T00:00:00.000Z');
      }
    });
  });

  describe('local / pending activity deferral', () => {
    it('does not include local or pending entries — no such entries in the derivation input', () => {
      const state = deriveActivityRailState({
        worldId: 'world_deadline',
        normalizedEvents: [makeEvent()],
        loading: false,
        error: null,
        hasMore: false,
      });

      expect(state.status).toBe('available');
      if (state.status === 'available') {
        for (const entry of state.entries) {
          expect(entry.authority).toBe('committed-world');
        }
      }
    });
  });
});
