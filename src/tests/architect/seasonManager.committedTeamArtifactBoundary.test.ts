import { describe, expect, it } from 'vitest';
import {
  buildSeasonAdvanceCommittedState,
  buildSeasonAdvanceFocusTeamSnapshot,
} from '@/features/architect/utils/seasonManager.helpers';
import { removeUndefinedDeep } from '@/features/architect/utils/seasonManager.teamTransition';

describe('seasonManager committed team artifact boundary', () => {
  const committedTeam = {
    teamCode: 'LAL',
    teamName: 'Los Angeles Lakers',
    season: '2026-27',
    roster: ['keeper'],
    players: [{ playerId: 'keeper' }],
    capHolds: [],
    totals: { yearKey: 2027 },
    exceptionHistory: [{ id: 'exception-history-1' }],
    historyTimeline: [{ id: 'timeline-1', type: 'seasonAdvance' }],
    city: 'Los Angeles',
    source: { layer: 'world' },
    entitlementIds: ['entitlement-1'],
    _meta: { totalsSource: 'fixture' },
  };

  it('projects only reload-safe focus-team fields from the committed artifact', () => {
    const snapshot = buildSeasonAdvanceFocusTeamSnapshot(committedTeam);

    expect(snapshot).toEqual(
      expect.objectContaining({
        teamCode: 'LAL',
        season: '2026-27',
        roster: ['keeper'],
        players: [{ playerId: 'keeper' }],
        totals: { yearKey: 2027 },
        exceptionHistory: [{ id: 'exception-history-1' }],
        historyTimeline: [{ id: 'timeline-1', type: 'seasonAdvance' }],
      })
    );
    expect(snapshot).not.toHaveProperty('city');
    expect(snapshot).not.toHaveProperty('source');
    expect(snapshot).not.toHaveProperty('entitlementIds');
    expect(snapshot).not.toHaveProperty('_meta');
  });

  it('returns exact committed metadata, event identity, and focus projection', () => {
    const focusTeamSnapshot =
      buildSeasonAdvanceFocusTeamSnapshot(committedTeam);
    const state = buildSeasonAdvanceCommittedState({
      metadata: {
        currentSeason: '2026-27',
        currentYear: 2027,
        asOfDate: '2026-07-01',
        lastModifiedTeams: ['LAL'],
      },
      event: {
        eventId: 'seasonAdvance__2025-26__2026-27',
        occurredAt: '2026-07-01T00:00:00Z',
      },
      focusTeamCode: 'LAL',
      focusTeamSnapshot,
    });

    expect(state.focusTeamSnapshot).toBe(focusTeamSnapshot);
    expect(state.metadata.currentSeason).toBe('2026-27');
    expect(state.event.eventId).toBe('seasonAdvance__2025-26__2026-27');
  });

  it('removes undefined values recursively before persistence', () => {
    expect(
      removeUndefinedDeep({
        teamCode: 'LAL',
        omitted: undefined,
        nested: { retained: true, omitted: undefined },
        values: [1, undefined, { retained: 2, omitted: undefined }],
      })
    ).toEqual({
      teamCode: 'LAL',
      nested: { retained: true },
      values: [1, { retained: 2 }],
    });
  });
});
