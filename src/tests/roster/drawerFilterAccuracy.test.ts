import { describe, it, expect } from 'vitest';
import {
  filterRosterDrawerPlayers,
  getDrawerPlayerAge,
} from '@/features/roster/utils';
import type { DrawerSeasonView, RosterDrawerPlayer } from '@/features/roster/utils';
import { getDefaultAddPlayerFilters } from '@/shared/utils/filtering';

type Stats = Record<string, number>;

const yearsAgo = (years: number, extraDays = 0): string => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() - extraDays);
  return d.toISOString().slice(0, 10);
};

const player = (
  id: string,
  { stats, dob, age }: { stats?: Stats | null; dob?: string; age?: number } = {}
): RosterDrawerPlayer => ({
  id,
  name: id,
  team: 'lal',
  teamCode: 'LAL',
  position: 'G',
  offenseRoles: [],
  defenseRoles: [],
  offenseSubroles: [],
  defenseSubroles: [],
  shootingProfile: '',
  badges: [],
  salary: 10_000_000,
  freeAgentYear: null,
  freeAgentType: '',
  contractType: '',
  extension: null,
  options: [],
  original: {
    id,
    age,
    bio: { displayName: id, dob },
    currentSeasonStats: stats ?? null,
  },
});

const ids = (players: Array<{ id?: string }>) => players.map((p) => p.id);
const base = getDefaultAddPlayerFilters();

describe('add-player drawer filter accuracy', () => {
  it('filters by current age computed from date of birth', () => {
    const vet = player('vet', { dob: yearsAgo(36, 30) });
    const young = player('young', { dob: yearsAgo(24, 30) });
    const enriched = player('enriched', { age: 37 });
    const unknown = player('unknown');

    expect(getDrawerPlayerAge(vet.original)).toBe(36);
    expect(getDrawerPlayerAge(enriched.original)).toBe(37);
    expect(getDrawerPlayerAge(unknown.original)).toBeNull();

    const result = filterRosterDrawerPlayers(
      [vet, young, enriched, unknown],
      '',
      { ...base, minAge: 35 }
    );
    expect(ids(result)).toEqual(['vet', 'enriched']);
  });

  it('excludes players without stats instead of treating them as zero', () => {
    const scorer = player('scorer', { stats: { PTS: 24, GP: 30 } });
    const benchGuy = player('bench', { stats: { PTS: 3, GP: 30 } });
    const noStats = player('nostats');

    expect(
      ids(filterRosterDrawerPlayers([scorer, benchGuy, noStats], '', { ...base, max_PPG: 5 }))
    ).toEqual(['bench']);
    expect(
      ids(filterRosterDrawerPlayers([scorer, benchGuy, noStats], '', { ...base, min_PPG: 20 }))
    ).toEqual(['scorer']);
  });

  it('applies minimum games only while a stat filter is active', () => {
    const regular = player('regular', { stats: { PTS: 22, GP: 40 } });
    const smallSample = player('small', { stats: { PTS: 30, GP: 2 } });
    const all = [regular, smallSample];

    expect(
      ids(filterRosterDrawerPlayers(all, '', { ...base, min_PPG: 20 }, { minGames: 10 }))
    ).toEqual(['regular']);
    // No stat filter: games played doesn't matter
    expect(
      ids(filterRosterDrawerPlayers(all, '', { ...base, minAge: undefined }, { minGames: 10 }))
    ).toEqual(['regular', 'small']);
  });

  it('uses a supplied season stat line instead of current-season stats', () => {
    const a = player('a', { stats: { PTS: 25, GP: 5 } });
    const b = player('b', { stats: { PTS: 8, GP: 5 } });
    const lastSeason = new Map<string, DrawerSeasonView>([
      ['a', { stats: { PTS: 12, GP: 70 } }],
      ['b', { stats: { PTS: 21, GP: 70 } }],
    ]);

    expect(
      ids(
        filterRosterDrawerPlayers([a, b], '', { ...base, min_PPG: 20 }, {
          seasonById: lastSeason,
        })
      )
    ).toEqual(['b']);
  });

  it('filters team, salary and age as of the chosen season', () => {
    // Everyone is currently on LAL, earning $10M
    const mover = player('mover', { age: 30 });
    const vet = player('vet', { age: 41 });
    const rookie = player('rookie', { age: 20 });
    const all = [mover, vet, rookie];
    const lastSeason = new Map<string, DrawerSeasonView>([
      ['mover', { team: 'BOS', age: 29, salary: 30_000_000 }],
      ['vet', { team: 'LAL', age: 40, salary: 52_600_000 }],
      // rookie has no season record: he wasn't in the league
    ]);
    const run = (filters: Partial<typeof base>) =>
      ids(
        filterRosterDrawerPlayers(all, '', { ...base, ...filters }, {
          seasonById: lastSeason,
        })
      );

    expect(run({ team: 'LAL' })).toEqual(['vet']);
    expect(run({ team: 'BOS' })).toEqual(['mover']);
    expect(run({ minSalary: 50 })).toEqual(['vet']);
    expect(run({ minAge: 40 })).toEqual(['vet']);
    expect(run({ maxAge: 30 })).toEqual(['mover']);
    // Without season views the current team applies
    expect(ids(filterRosterDrawerPlayers(all, '', { ...base, team: 'BOS' }))).toEqual([]);
  });

  it('reads stored percentage fractions as percentages', () => {
    const shooter = player('shooter', { stats: { '3PT%': 0.41, GP: 50 } });
    const brick = player('brick', { stats: { '3PT%': 0.29, GP: 50 } });

    expect(
      ids(filterRosterDrawerPlayers([shooter, brick], '', { ...base, min_TPP: 38 }))
    ).toEqual(['shooter']);
  });
});
