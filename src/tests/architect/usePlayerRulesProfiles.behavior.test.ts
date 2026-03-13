// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { usePlayerRulesProfiles } from '@/features/architect/hooks/usePlayerRulesProfiles';

const formatSeason = (endYear: number) =>
  `${endYear - 1}-${String(endYear % 100).padStart(2, '0')}`;

const PLAYER_ONE = {
  playerId: 'player_one',
  name: 'Player One',
  bio: {
    experience: 4,
  },
  contractType: 'Standard',
  contract: {
    contractType: 'Standard',
    birdRights: {
      status: 'Early Bird',
      yearsWithTeam: 2,
    },
    freeAgency: {
      year: 2027,
      type: 'Unrestricted',
    },
    salariesByYear: [
      {
        season: formatSeason(2026),
        salary: 10_000_000,
        capHit: 10_000_000,
        guaranteed: true,
      },
      {
        season: formatSeason(2027),
        salary: 11_000_000,
        capHit: 11_000_000,
        guaranteed: true,
      },
    ],
  },
};

const PLAYER_TWO = {
  playerId: 'player_two',
  name: 'Player Two',
  bio: {
    experience: 2,
  },
  contractType: 'Standard',
  contract: {
    contractType: 'Standard',
    birdRights: {
      status: 'Non-Bird',
      yearsWithTeam: 1,
    },
    freeAgency: {
      year: 2026,
      type: 'Restricted',
    },
    salariesByYear: [
      {
        season: formatSeason(2026),
        salary: 5_000_000,
        capHit: 5_000_000,
        guaranteed: true,
      },
      {
        season: formatSeason(2027),
        salary: 6_000_000,
        capHit: 6_000_000,
        guaranteed: true,
      },
    ],
  },
};

afterEach(() => {
  cleanup();
});

describe('usePlayerRulesProfiles', () => {
  it('preserves the empty return shape and key order', () => {
    const { result } = renderHook(() => usePlayerRulesProfiles());

    expect(Object.keys(result.current)).toEqual([
      'profilesById',
      'leagueContext',
      'teamContext',
      'leagueContextByYear',
      'teamContextByYear',
      'profilesByYear',
      'getProfile',
      'getProfileForYear',
    ]);
    expect(result.current.profilesById).toBeInstanceOf(Map);
    expect(result.current.leagueContext).toBeNull();
    expect(result.current.teamContext).toBeNull();
    expect(result.current.leagueContextByYear.size).toBe(0);
    expect(result.current.teamContextByYear.size).toBe(0);
    expect(result.current.profilesByYear.size).toBe(0);
    expect(result.current.getProfile(undefined)).toBeNull();
    expect(result.current.getProfileForYear(undefined)).toBeNull();
  });

  it('preserves the populated return shape, field order, and helper lookups', () => {
    const players = [PLAYER_ONE, PLAYER_TWO];
    const teamCapSheet = {
      teamCode: 'TST',
      players,
    };
    const simulationDate = new Date('2025-07-15T12:00:00.000Z');
    const evaluationYears = [2026, 2027];
    const { result } = renderHook(() =>
      usePlayerRulesProfiles({
        players,
        teamCapSheet,
        currentYear: 2026,
        teamCode: 'TST',
        simulationDate,
        evaluationYears,
      })
    );

    expect(Object.keys(result.current)).toEqual([
      'profilesById',
      'profilesByYear',
      'leagueContext',
      'leagueContextByYear',
      'teamContext',
      'teamContextByYear',
      'getProfile',
      'getProfileForYear',
    ]);
    expect(result.current.profilesById).toBe(result.current.profilesByYear.get(2026));
    expect(result.current.leagueContext?.currentYear).toBe(2026);
    expect(result.current.teamContext).toMatchObject({
      teamCode: 'TST',
      teamSalary: 15_000_000,
      isOverCap: false,
      apronStatus: 'UNDER_CAP',
    });
    expect(result.current.leagueContextByYear.get(2027)?.currentSeason).toBe(
      '2026-27'
    );
    expect(result.current.teamContextByYear.get(2027)?.teamSalary).toBe(
      17_000_000
    );

    const defaultProfile = result.current.getProfile(PLAYER_ONE);
    const yearProfile = result.current.getProfileForYear(PLAYER_ONE, 2027);

    expect(defaultProfile).toBe(result.current.profilesById.get('player_one'));
    expect(yearProfile).toBe(
      result.current.profilesByYear.get(2027)?.get('player_one') || null
    );
    expect(defaultProfile?.playerId).toBe('player_one');
  });

  it('preserves default-year fallback and zero-salary apronStatus null behavior', () => {
    const { result: zeroSalaryResult } = renderHook(() =>
      usePlayerRulesProfiles({
        players: [],
        teamCapSheet: {
          teamCode: 'TST',
          players: [],
        },
        currentYear: 2026,
        teamCode: 'TST',
      })
    );

    expect(zeroSalaryResult.current.teamContext).toMatchObject({
      teamCode: 'TST',
      teamSalary: 0,
      isOverCap: false,
      apronStatus: null,
    });

    const players = [PLAYER_ONE];
    const teamCapSheet = {
      teamCode: 'TST',
      players,
    };
    const { result } = renderHook(() =>
      usePlayerRulesProfiles({
        players,
        teamCapSheet,
        currentYear: 2028,
        teamCode: 'TST',
        evaluationYears: [2026, 2027],
      })
    );

    expect(result.current.leagueContext?.currentYear).toBe(2026);
    expect(result.current.profilesById).toBe(result.current.profilesByYear.get(2026));
    expect(result.current.getProfile(PLAYER_ONE)).toBe(
      result.current.profilesByYear.get(2026)?.get('player_one') || null
    );
  });

  it('preserves the exact memoization boundaries from the dependency array', () => {
    const players = [PLAYER_ONE];
    const teamCapSheet = {
      teamCode: 'TST',
      players,
    };
    const simulationDate = new Date('2025-07-15T12:00:00.000Z');
    const evaluationYears = [2026];
    const { result, rerender } = renderHook(
      ({
        hookPlayers,
        hookTeamCapSheet,
        hookEvaluationYears,
      }: {
        hookPlayers: typeof players;
        hookTeamCapSheet: typeof teamCapSheet;
        hookEvaluationYears: number[];
      }) =>
        usePlayerRulesProfiles({
          players: hookPlayers,
          teamCapSheet: hookTeamCapSheet,
          currentYear: 2026,
          teamCode: 'TST',
          simulationDate,
          evaluationYears: hookEvaluationYears,
        }),
      {
        initialProps: {
          hookPlayers: players,
          hookTeamCapSheet: teamCapSheet,
          hookEvaluationYears: evaluationYears,
        },
      }
    );

    const firstResult = result.current;

    rerender({
      hookPlayers: players,
      hookTeamCapSheet: teamCapSheet,
      hookEvaluationYears: evaluationYears,
    });

    expect(result.current).toBe(firstResult);

    rerender({
      hookPlayers: players,
      hookTeamCapSheet: teamCapSheet,
      hookEvaluationYears: [2026],
    });

    expect(result.current).not.toBe(firstResult);
  });
});
