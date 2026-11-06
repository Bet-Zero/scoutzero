import { describe, expect, it } from 'vitest';
import { normalizeWorldEventsForTeamHistory } from '@/features/architect/history/utils/normalizeWorldEventsForTeamHistory';
import { deriveComparisonViewModel } from '@/features/architect/comparison/deriveComparisonViewModel';

const route = (
  playerId: string,
  sourceTeamCode: string,
  destinationTeamCode: string
) => ({ playerId, sourceTeamCode, destinationTeamCode });
const routes = [
  route('a', 'LAL', 'BOS'),
  route('b', 'LAL', 'MIA'),
  route('c', 'BOS', 'LAL'),
  route('d', 'MIA', 'BOS'),
];
function comparison(
  team: string,
  roster: string[],
  movements: unknown,
  playerIds = ['a', 'b', 'c', 'd']
) {
  const rows = normalizeWorldEventsForTeamHistory(
    [
      {
        eventId: 'trade',
        worldId: 'world',
        mutationType: 'executeTrade',
        occurredAt: '2026-06-05T12:00:00Z',
        teamCodes: ['LAL', 'BOS', 'MIA'],
        playerIds,
        metadata: movements === undefined ? {} : { playerMovements: movements },
      },
    ],
    team
  );
  return deriveComparisonViewModel({
    worldId: 'world',
    worldName: 'Plan',
    teamCode: team,
    baselineSeason: '2025-26',
    currentSeason: '2025-26',
    currentRosterPlayerIds: roster,
    committedEventRows: rows,
  });
}
const ids = (entries: { playerId: string }[]) =>
  entries.map((p) => p.playerId).sort();

describe('shared trade participant comparisons', () => {
  it.each([
    ['LAL', ['c'], ['a', 'b']],
    ['BOS', ['a', 'd'], ['c']],
    ['MIA', ['b'], ['d']],
  ] as const)(
    'attributes split player routes only to %s',
    (team, incoming, outgoing) => {
      const vm = comparison(team, [...incoming], [...routes].reverse());
      expect(ids(vm.rosterAdditions)).toEqual([...incoming]);
      expect(ids(vm.rosterRemovals)).toEqual([...outgoing]);
    }
  );

  it('does not invent player removals for a pick-only third participant', () => {
    const vm = comparison(
      'MIA',
      ['unchanged'],
      [route('a', 'LAL', 'BOS'), route('c', 'BOS', 'LAL')],
      ['a', 'c']
    );
    expect(vm.rosterAdditions).toEqual([]);
    expect(vm.rosterRemovals).toEqual([]);
    expect(vm.rosterChangedPlayers).toEqual([]);
  });

  it.each([
    routes.slice(1),
    [...routes, routes[0]],
    [route('a', 'LAL', 'LAL'), ...routes.slice(1)],
    [route('a', 'LAL', 'NYK'), ...routes.slice(1)],
  ])(
    'reports incomplete or inconsistent modern routes without fabricated changes',
    (...badRoutes) => {
      const vm = comparison('MIA', [], badRoutes);
      expect(vm.rosterRemovals).toEqual([]);
      expect(vm.unavailableSummary.some((s) => s.field === 'rosterDelta')).toBe(
        true
      );
    }
  );

  it('preserves historical event-only roster classification when routes were not recorded', () => {
    const vm = comparison('LAL', ['c'], undefined, ['a', 'c']);
    expect(ids(vm.rosterAdditions)).toEqual(['c']);
    expect(ids(vm.rosterRemovals)).toEqual(['a']);
    expect(vm.unavailableSummary.some((s) => s.field === 'rosterDelta')).toBe(
      false
    );
  });
});
