/**
 * FILE: src/tests/architect/stage3.comparisonFoundation.test.ts
 * PURPOSE: Targeted tests for Stage 3B scenario comparison pure helpers.
 * OWNERSHIP: Feature: architect/comparison
 *
 * Covers:
 * - deriveRosterDelta: classification by mutation type and current-roster presence
 * - deriveCapDelta: cap/apron delta from before/after totals
 * - detectSeasonMismatch: season-advance event detection
 * - deriveComparisonViewModel: full aggregation with authority labels
 */

import { describe, expect, it } from 'vitest';
import { deriveRosterDelta } from '@/features/architect/comparison/rosterDelta';
import { deriveCapDelta } from '@/features/architect/comparison/capDelta';
import { detectSeasonMismatch } from '@/features/architect/comparison/seasonMismatch';
import { deriveComparisonViewModel } from '@/features/architect/comparison/deriveComparisonViewModel';
import type { ComparisonEventRow } from '@/features/architect/comparison/deriveComparisonViewModel';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEvent(
  overrides: Partial<ComparisonEventRow> = {}
): ComparisonEventRow {
  return {
    id: 'evt_default',
    eventId: 'evt_default',
    occurredAt: '2026-01-15T00:00:00.000Z',
    mutationType: 'signFreeAgent',
    category: 'free-agency',
    playerIds: ['player_1'],
    teamCodes: ['LAL'],
    teamsInvolved: ['LAL'],
    beforeTotalsByTeam: {},
    afterTotalsByTeam: {},
    ...overrides,
  };
}

const LAL_BEFORE_TOTALS = {
  LAL: {
    totalCapAllocations: 160_000_000,
    capSpace: 10_000_000,
    luxuryTax: 170_000_000,
    isFirstApron: false,
    isSecondApron: false,
    isHardCapped: false,
  },
};

const LAL_AFTER_TOTALS = {
  LAL: {
    totalCapAllocations: 175_000_000,
    capSpace: -5_000_000,
    luxuryTax: 170_000_000,
    isFirstApron: true,
    isSecondApron: false,
    isHardCapped: false,
  },
};

// ---------------------------------------------------------------------------
// deriveRosterDelta
// ---------------------------------------------------------------------------

describe('deriveRosterDelta', () => {
  it('returns empty arrays when no events', () => {
    const result = deriveRosterDelta([], ['player_1']);
    expect(result.rosterAdditions).toEqual([]);
    expect(result.rosterRemovals).toEqual([]);
    expect(result.rosterChangedPlayers).toEqual([]);
  });

  it('returns empty arrays when events have no playerIds', () => {
    const event = makeEvent({ playerIds: [], mutationType: 'signFreeAgent' });
    const result = deriveRosterDelta([event], ['player_1']);
    expect(result.rosterAdditions).toEqual([]);
  });

  it('classifies signFreeAgent player as addition when in current roster', () => {
    const event = makeEvent({
      mutationType: 'signFreeAgent',
      playerIds: ['player_signed'],
    });
    const result = deriveRosterDelta([event], ['player_signed', 'player_other']);
    expect(result.rosterAdditions).toHaveLength(1);
    expect(result.rosterAdditions[0].playerId).toBe('player_signed');
    expect(result.rosterAdditions[0].authority).toBe('committed-world / event-derived');
  });

  it('does not include signFreeAgent player in additions when not in current roster', () => {
    const event = makeEvent({
      mutationType: 'signFreeAgent',
      playerIds: ['player_signed'],
    });
    // Player signed but no longer on roster (e.g. waived later)
    const result = deriveRosterDelta([event], ['player_other']);
    expect(result.rosterAdditions).toHaveLength(0);
  });

  it('classifies waivePlayer player as removal when not in current roster', () => {
    const event = makeEvent({
      mutationType: 'waivePlayer',
      playerIds: ['player_waived'],
    });
    const result = deriveRosterDelta([event], ['player_other']);
    expect(result.rosterRemovals).toHaveLength(1);
    expect(result.rosterRemovals[0].playerId).toBe('player_waived');
    expect(result.rosterRemovals[0].authority).toBe('committed-world / event-derived');
  });

  it('does not classify waivePlayer player as removal when still on roster', () => {
    const event = makeEvent({
      mutationType: 'waivePlayer',
      playerIds: ['player_waived'],
    });
    // Player is still in roster (unusual but possible in test fixtures)
    const result = deriveRosterDelta([event], ['player_waived']);
    expect(result.rosterRemovals).toHaveLength(0);
  });

  it('classifies waiveAndStretch as removal', () => {
    const event = makeEvent({
      mutationType: 'waiveAndStretch',
      playerIds: ['player_stretched'],
    });
    const result = deriveRosterDelta([event], []);
    expect(result.rosterRemovals[0].playerId).toBe('player_stretched');
  });

  it('classifies buyoutPlayer as removal', () => {
    const event = makeEvent({
      mutationType: 'buyoutPlayer',
      playerIds: ['player_bought'],
    });
    const result = deriveRosterDelta([event], []);
    expect(result.rosterRemovals[0].playerId).toBe('player_bought');
  });

  it('trade event: player in roster → addition; player not in roster → removal', () => {
    const event = makeEvent({
      mutationType: 'executeTrade',
      playerIds: ['player_acquired', 'player_sent'],
    });
    const result = deriveRosterDelta([event], ['player_acquired']);
    expect(result.rosterAdditions.map((e) => e.playerId)).toContain('player_acquired');
    expect(result.rosterRemovals.map((e) => e.playerId)).toContain('player_sent');
  });

  it('signAndTrade: acquired player in additions, sent player in removals', () => {
    const event = makeEvent({
      mutationType: 'signAndTrade',
      playerIds: ['player_incoming', 'player_outgoing'],
    });
    const result = deriveRosterDelta([event], ['player_incoming']);
    expect(result.rosterAdditions.map((e) => e.playerId)).toContain('player_incoming');
    expect(result.rosterRemovals.map((e) => e.playerId)).toContain('player_outgoing');
  });

  it('extendPlayer classifies player as rosterChangedPlayers when still on roster', () => {
    const event = makeEvent({
      mutationType: 'extendPlayer',
      playerIds: ['player_extended'],
    });
    const result = deriveRosterDelta([event], ['player_extended']);
    expect(result.rosterChangedPlayers).toHaveLength(1);
    expect(result.rosterChangedPlayers[0].playerId).toBe('player_extended');
  });

  it('optionDecision classifies player in rosterChangedPlayers', () => {
    const event = makeEvent({
      mutationType: 'optionDecision',
      playerIds: ['player_option'],
    });
    const result = deriveRosterDelta([event], ['player_option']);
    expect(result.rosterChangedPlayers[0].playerId).toBe('player_option');
  });

  it('deduplicates player ids appearing in multiple events', () => {
    const events = [
      makeEvent({ mutationType: 'signFreeAgent', playerIds: ['player_1'] }),
      makeEvent({ mutationType: 'signFreeAgent', playerIds: ['player_1'] }),
    ];
    const result = deriveRosterDelta(events, ['player_1']);
    expect(result.rosterAdditions).toHaveLength(1);
  });

  it('ignores empty string player ids', () => {
    const event = makeEvent({
      mutationType: 'signFreeAgent',
      playerIds: ['', '  ', 'player_valid'],
    });
    const result = deriveRosterDelta([event], ['player_valid']);
    expect(result.rosterAdditions).toHaveLength(1);
    expect(result.rosterAdditions[0].playerId).toBe('player_valid');
  });

  it('does not name-overmatch: player ids must be exact string matches', () => {
    const event = makeEvent({
      mutationType: 'signFreeAgent',
      playerIds: ['player_123'],
    });
    // 'player_12' is a prefix of 'player_123' — should NOT match
    const result = deriveRosterDelta([event], ['player_12']);
    expect(result.rosterAdditions).toHaveLength(0);
  });

  it('unknown mutation types do not produce roster entries', () => {
    const event = makeEvent({
      mutationType: 'someUnknownMutationType',
      playerIds: ['player_1'],
    });
    const result = deriveRosterDelta([event], ['player_1']);
    expect(result.rosterAdditions).toHaveLength(0);
    expect(result.rosterRemovals).toHaveLength(0);
    expect(result.rosterChangedPlayers).toHaveLength(0);
  });

  it('null mutationType does not produce roster entries', () => {
    const event = makeEvent({ mutationType: null, playerIds: ['player_1'] });
    const result = deriveRosterDelta([event], ['player_1']);
    expect(result.rosterAdditions).toHaveLength(0);
    expect(result.rosterRemovals).toHaveLength(0);
    expect(result.rosterChangedPlayers).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// deriveCapDelta
// ---------------------------------------------------------------------------

describe('deriveCapDelta', () => {
  it('returns null cap delta when both inputs are null', () => {
    const result = deriveCapDelta(null, null, 'LAL');
    expect(result.capTotalDelta).toBeNull();
    expect(result.taxApronPostureDelta).toBeNull();
  });

  it('returns null cap delta when team is absent from both records', () => {
    const result = deriveCapDelta({ BOS: {} }, { BOS: {} }, 'LAL');
    expect(result.capTotalDelta).toBeNull();
  });

  it('derives correct totalCapAllocationsDelta from single event', () => {
    const result = deriveCapDelta(LAL_BEFORE_TOTALS, LAL_AFTER_TOTALS, 'LAL');
    expect(result.capTotalDelta).not.toBeNull();
    expect(result.capTotalDelta!.totalCapAllocationsDelta).toBe(
      175_000_000 - 160_000_000
    );
  });

  it('derives correct capSpaceDelta (after − before)', () => {
    const result = deriveCapDelta(LAL_BEFORE_TOTALS, LAL_AFTER_TOTALS, 'LAL');
    expect(result.capTotalDelta!.capSpaceDelta).toBe(-5_000_000 - 10_000_000);
  });

  it('derives taxSpaceDelta from luxuryTax − totalCapAllocations when taxSpace absent', () => {
    // luxuryTax = 170M in both; before alloc = 160M → before taxSpace = 10M
    //                           after  alloc = 175M → after  taxSpace = -5M
    const result = deriveCapDelta(LAL_BEFORE_TOTALS, LAL_AFTER_TOTALS, 'LAL');
    // -5M - 10M = -15M
    expect(result.capTotalDelta!.taxSpaceDelta).toBe(-15_000_000);
  });

  it('returns null totalCapAllocationsDelta when before totals are missing for team', () => {
    const result = deriveCapDelta(
      { BOS: { totalCapAllocations: 150_000_000 } },
      LAL_AFTER_TOTALS,
      'LAL'
    );
    expect(result.capTotalDelta!.totalCapAllocationsDelta).toBeNull();
  });

  it('detects first-apron crossing: was below, now above', () => {
    const result = deriveCapDelta(LAL_BEFORE_TOTALS, LAL_AFTER_TOTALS, 'LAL');
    expect(result.taxApronPostureDelta!.crossedFirstApron).toBe(true);
    expect(result.taxApronPostureDelta!.crossedSecondApron).toBe(false);
    expect(result.taxApronPostureDelta!.hardCapActivated).toBe(false);
  });

  it('does not report first-apron crossing when team was already above apron before', () => {
    const alreadyAbove = {
      LAL: {
        totalCapAllocations: 185_000_000,
        isFirstApron: true,
        isSecondApron: false,
        isHardCapped: false,
      },
    };
    const stillAbove = {
      LAL: {
        totalCapAllocations: 190_000_000,
        isFirstApron: true,
        isSecondApron: false,
        isHardCapped: false,
      },
    };
    const result = deriveCapDelta(alreadyAbove, stillAbove, 'LAL');
    expect(result.taxApronPostureDelta!.crossedFirstApron).toBe(false);
  });

  it('detects hard-cap activation', () => {
    const before = { LAL: { totalCapAllocations: 160_000_000, isFirstApron: false, isSecondApron: false, isHardCapped: false } };
    const after = { LAL: { totalCapAllocations: 178_000_000, isFirstApron: true, isSecondApron: false, isHardCapped: true } };
    const result = deriveCapDelta(before, after, 'LAL');
    expect(result.taxApronPostureDelta!.hardCapActivated).toBe(true);
  });

  it('returns null apron delta when boolean fields are absent', () => {
    const before = { LAL: { totalCapAllocations: 160_000_000 } };
    const after = { LAL: { totalCapAllocations: 175_000_000 } };
    const result = deriveCapDelta(before, after, 'LAL');
    expect(result.taxApronPostureDelta).toBeNull();
  });

  it('authority label is present on cap total delta', () => {
    const result = deriveCapDelta(LAL_BEFORE_TOTALS, LAL_AFTER_TOTALS, 'LAL');
    expect(result.capTotalDelta!.authority).toBe('committed-world / event-derived');
  });

  it('authority label is present on tax/apron posture delta', () => {
    const result = deriveCapDelta(LAL_BEFORE_TOTALS, LAL_AFTER_TOTALS, 'LAL');
    expect(result.taxApronPostureDelta!.authority).toBe('committed-world / event-derived');
  });
});

// ---------------------------------------------------------------------------
// detectSeasonMismatch
// ---------------------------------------------------------------------------

describe('detectSeasonMismatch', () => {
  it('returns hasMismatch: false for empty event stream', () => {
    const result = detectSeasonMismatch([]);
    expect(result.hasMismatch).toBe(false);
    expect(result.seasonAdvanceEventCount).toBe(0);
  });

  it('returns hasMismatch: false for non-season-advance events', () => {
    const events = [
      { mutationType: 'signFreeAgent' },
      { mutationType: 'executeTrade' },
      { mutationType: 'extendPlayer' },
    ];
    const result = detectSeasonMismatch(events);
    expect(result.hasMismatch).toBe(false);
  });

  it('detects advanceSeason mutation type', () => {
    const result = detectSeasonMismatch([{ mutationType: 'advanceSeason' }]);
    expect(result.hasMismatch).toBe(true);
    expect(result.seasonAdvanceEventCount).toBe(1);
  });

  it('detects seasonAdvanced mutation type', () => {
    const result = detectSeasonMismatch([{ mutationType: 'seasonAdvanced' }]);
    expect(result.hasMismatch).toBe(true);
  });

  it('detects seasonAdvance mutation type', () => {
    const result = detectSeasonMismatch([{ mutationType: 'seasonAdvance' }]);
    expect(result.hasMismatch).toBe(true);
  });

  it('counts multiple season-advance events', () => {
    const events = [
      { mutationType: 'signFreeAgent' },
      { mutationType: 'advanceSeason' },
      { mutationType: 'executeTrade' },
      { mutationType: 'seasonAdvanced' },
    ];
    const result = detectSeasonMismatch(events);
    expect(result.hasMismatch).toBe(true);
    expect(result.seasonAdvanceEventCount).toBe(2);
  });

  it('detects via fallback: mutationType containing "season" and "advance"', () => {
    const result = detectSeasonMismatch([{ mutationType: 'advanceSeasonInWorld' }]);
    expect(result.hasMismatch).toBe(true);
  });

  it('handles null mutationType gracefully', () => {
    const result = detectSeasonMismatch([{ mutationType: null }]);
    expect(result.hasMismatch).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deriveComparisonViewModel
// ---------------------------------------------------------------------------

describe('deriveComparisonViewModel', () => {
  const baseInput = {
    worldId: 'world_test',
    worldName: 'Test World',
    teamCode: 'LAL',
    baselineSeason: '2025-26',
    currentSeason: '2025-26',
    currentRosterPlayerIds: [] as string[],
  };

  it('returns safe empty view model when no events', () => {
    const vm = deriveComparisonViewModel({
      ...baseInput,
      committedEventRows: [],
    });
    expect(vm.committedEventCount).toBe(0);
    expect(vm.rosterAdditions).toEqual([]);
    expect(vm.rosterRemovals).toEqual([]);
    expect(vm.rosterChangedPlayers).toEqual([]);
    expect(vm.capTotalDelta).toBeNull();
    expect(vm.taxApronPostureDelta).toBeNull();
    expect(vm.changedTeams.teamCodes).toEqual([]);
    expect(vm.changedPlayers.playerIds).toEqual([]);
    expect(vm.isMultiSeasonComparison).toBe(false);
  });

  it('populates unavailableSummary when no events', () => {
    const vm = deriveComparisonViewModel({
      ...baseInput,
      committedEventRows: [],
    });
    const fields = vm.unavailableSummary.map((e) => e.field);
    expect(fields).toContain('capTotalDelta');
    expect(fields).toContain('draftAssetDelta');
  });

  it('exception delta is always deferred', () => {
    const vm = deriveComparisonViewModel({
      ...baseInput,
      committedEventRows: [],
    });
    expect(vm.exceptionDelta.status).toBe('deferred');
    expect(typeof vm.exceptionDelta.reason).toBe('string');
    expect(vm.exceptionDelta.reason.length).toBeGreaterThan(0);
  });

  it('scope has correct authority label', () => {
    const vm = deriveComparisonViewModel({
      ...baseInput,
      committedEventRows: [],
    });
    expect(vm.scope.authority).toBe('committed-world');
    expect(vm.scope.worldId).toBe('world_test');
    expect(vm.scope.teamCode).toBe('LAL');
  });

  it('derives cap delta from single committed event before/after totals', () => {
    const event = makeEvent({
      mutationType: 'signFreeAgent',
      playerIds: ['player_1'],
      beforeTotalsByTeam: LAL_BEFORE_TOTALS,
      afterTotalsByTeam: LAL_AFTER_TOTALS,
    });
    const vm = deriveComparisonViewModel({
      ...baseInput,
      committedEventRows: [event],
      currentRosterPlayerIds: ['player_1'],
    });
    expect(vm.capTotalDelta).not.toBeNull();
    expect(vm.capTotalDelta!.totalCapAllocationsDelta).toBe(15_000_000);
    expect(vm.capTotalDelta!.authority).toBe('committed-world / event-derived');
  });

  it('uses earliest before-totals and latest after-totals across multiple events', () => {
    const earliest = makeEvent({
      id: 'evt_a',
      eventId: 'evt_a',
      occurredAt: '2026-01-10T00:00:00.000Z',
      mutationType: 'signFreeAgent',
      beforeTotalsByTeam: { LAL: { totalCapAllocations: 155_000_000 } },
      afterTotalsByTeam: { LAL: { totalCapAllocations: 162_000_000 } },
    });
    const later = makeEvent({
      id: 'evt_b',
      eventId: 'evt_b',
      occurredAt: '2026-02-10T00:00:00.000Z',
      mutationType: 'executeTrade',
      beforeTotalsByTeam: { LAL: { totalCapAllocations: 162_000_000 } },
      afterTotalsByTeam: { LAL: { totalCapAllocations: 170_000_000 } },
    });
    // Pass newest-first (as useWorldTeamEvents returns)
    const vm = deriveComparisonViewModel({
      ...baseInput,
      committedEventRows: [later, earliest],
    });
    // Should use earliest.before (155M) and latest.after (170M)
    expect(vm.capTotalDelta!.totalCapAllocationsDelta).toBe(15_000_000);
  });

  it('accumulates changed players from multiple events', () => {
    const e1 = makeEvent({ playerIds: ['player_a', 'player_b'], mutationType: 'executeTrade' });
    const e2 = makeEvent({ playerIds: ['player_b', 'player_c'], mutationType: 'signFreeAgent', occurredAt: '2026-02-01T00:00:00.000Z' });
    const vm = deriveComparisonViewModel({
      ...baseInput,
      committedEventRows: [e1, e2],
    });
    expect(vm.changedPlayers.playerIds).toContain('player_a');
    expect(vm.changedPlayers.playerIds).toContain('player_b');
    expect(vm.changedPlayers.playerIds).toContain('player_c');
    // Deduplicated
    expect(vm.changedPlayers.playerIds.filter((id) => id === 'player_b')).toHaveLength(1);
    expect(vm.changedPlayers.authority).toBe('committed-world / event-derived');
  });

  it('accumulates changed teams from events', () => {
    const event = makeEvent({
      teamsInvolved: ['LAL', 'BOS'],
      teamCodes: ['LAL', 'BOS'],
    });
    const vm = deriveComparisonViewModel({
      ...baseInput,
      committedEventRows: [event],
    });
    expect(vm.changedTeams.teamCodes).toContain('LAL');
    expect(vm.changedTeams.teamCodes).toContain('BOS');
    expect(vm.changedTeams.authority).toBe('committed-world / event-derived');
  });

  it('merges worldModifiedTeams into changedTeams', () => {
    const event = makeEvent({ teamsInvolved: ['LAL'] });
    const vm = deriveComparisonViewModel({
      ...baseInput,
      committedEventRows: [event],
      worldModifiedTeams: ['LAL', 'MIL'],
    });
    expect(vm.changedTeams.teamCodes).toContain('MIL');
  });

  it('classifies roster addition from signing event + current roster', () => {
    const event = makeEvent({
      mutationType: 'signFreeAgent',
      playerIds: ['player_signed'],
    });
    const vm = deriveComparisonViewModel({
      ...baseInput,
      committedEventRows: [event],
      currentRosterPlayerIds: ['player_signed', 'player_other'],
    });
    expect(vm.rosterAdditions[0].playerId).toBe('player_signed');
  });

  it('classifies roster removal from waive event + player absent from roster', () => {
    const event = makeEvent({
      mutationType: 'waivePlayer',
      playerIds: ['player_waived'],
    });
    const vm = deriveComparisonViewModel({
      ...baseInput,
      committedEventRows: [event],
      currentRosterPlayerIds: ['player_other'],
    });
    expect(vm.rosterRemovals[0].playerId).toBe('player_waived');
  });

  it('event id and occurredAt are preserved in committedEventReferences', () => {
    const event = makeEvent({
      id: 'evt_ref_test',
      eventId: 'evt_ref_test',
      occurredAt: '2026-03-10T12:00:00.000Z',
      mutationType: 'executeTrade',
    });
    const vm = deriveComparisonViewModel({
      ...baseInput,
      committedEventRows: [event],
    });
    const ref = vm.committedEventReferences.find((r) => r.eventId === 'evt_ref_test');
    expect(ref).toBeDefined();
    expect(ref!.occurredAt).toBe('2026-03-10T12:00:00.000Z');
    expect(ref!.mutationType).toBe('executeTrade');
    expect(ref!.authority).toBe('committed-world');
  });

  it('deduplicates committedEventReferences by eventId', () => {
    const e1 = makeEvent({ id: 'evt_dup', eventId: 'evt_dup', occurredAt: '2026-01-01T00:00:00.000Z' });
    const e2 = makeEvent({ id: 'evt_dup', eventId: 'evt_dup', occurredAt: '2026-01-02T00:00:00.000Z' });
    const vm = deriveComparisonViewModel({
      ...baseInput,
      committedEventRows: [e1, e2],
    });
    expect(vm.committedEventReferences.filter((r) => r.eventId === 'evt_dup')).toHaveLength(1);
  });

  it('skips committedEventReference when eventId is null', () => {
    const event = makeEvent({ eventId: null });
    const vm = deriveComparisonViewModel({
      ...baseInput,
      committedEventRows: [event],
    });
    expect(vm.committedEventReferences).toHaveLength(0);
  });

  it('flags isMultiSeasonComparison when season-advance event present', () => {
    const event = makeEvent({ mutationType: 'advanceSeason' });
    const vm = deriveComparisonViewModel({
      ...baseInput,
      committedEventRows: [event],
    });
    expect(vm.isMultiSeasonComparison).toBe(true);
    const hasSeasonNote = vm.unavailableSummary.some(
      (e) => e.field === 'seasonComparison'
    );
    expect(hasSeasonNote).toBe(true);
  });

  it('draft asset delta is always in unavailableSummary', () => {
    const vm = deriveComparisonViewModel({
      ...baseInput,
      committedEventRows: [makeEvent()],
    });
    const hasDraft = vm.unavailableSummary.some(
      (e) => e.field === 'draftAssetDelta'
    );
    expect(hasDraft).toBe(true);
  });

  it('capTotalDelta added to unavailableSummary when cap totals are missing', () => {
    const event = makeEvent({
      beforeTotalsByTeam: {},
      afterTotalsByTeam: {},
    });
    const vm = deriveComparisonViewModel({
      ...baseInput,
      committedEventRows: [event],
    });
    const hasCapNote = vm.unavailableSummary.some(
      (e) => e.field === 'capTotalDelta'
    );
    expect(hasCapNote).toBe(true);
  });

  it('changedTeams and changedPlayers have authority labels', () => {
    const vm = deriveComparisonViewModel({
      ...baseInput,
      committedEventRows: [makeEvent()],
    });
    expect(vm.changedTeams.authority).toBe('committed-world / event-derived');
    expect(vm.changedPlayers.authority).toBe('committed-world / event-derived');
  });

  it('committedEventCount matches number of input rows', () => {
    const events = [
      makeEvent({ id: 'e1', eventId: 'e1', occurredAt: '2026-01-01T00:00:00.000Z' }),
      makeEvent({ id: 'e2', eventId: 'e2', occurredAt: '2026-02-01T00:00:00.000Z' }),
      makeEvent({ id: 'e3', eventId: 'e3', occurredAt: '2026-03-01T00:00:00.000Z' }),
    ];
    const vm = deriveComparisonViewModel({
      ...baseInput,
      committedEventRows: events,
    });
    expect(vm.committedEventCount).toBe(3);
  });

  it('produces correct cap delta from multi-event stream sorted by this function', () => {
    // Pass events in reverse chronological order (as useWorldTeamEvents would)
    const newest = makeEvent({
      id: 'e_new',
      eventId: 'e_new',
      occurredAt: '2026-03-01T00:00:00.000Z',
      mutationType: 'executeTrade',
      beforeTotalsByTeam: { LAL: { totalCapAllocations: 168_000_000 } },
      afterTotalsByTeam: { LAL: { totalCapAllocations: 172_000_000 } },
    });
    const oldest = makeEvent({
      id: 'e_old',
      eventId: 'e_old',
      occurredAt: '2026-01-01T00:00:00.000Z',
      mutationType: 'signFreeAgent',
      beforeTotalsByTeam: { LAL: { totalCapAllocations: 158_000_000 } },
      afterTotalsByTeam: { LAL: { totalCapAllocations: 168_000_000 } },
    });
    const vm = deriveComparisonViewModel({
      ...baseInput,
      committedEventRows: [newest, oldest], // newest-first (as from hook)
    });
    // Should use oldest.before (158M) and newest.after (172M) → delta = 14M
    expect(vm.capTotalDelta!.totalCapAllocationsDelta).toBe(14_000_000);
  });
});
