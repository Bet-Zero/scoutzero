import { describe, expect, it } from 'vitest';
import {
  buildSyntheticSntPlayers,
  clearSyntheticSntPlayersFromTeams,
  DEV_SNT_INJECTOR_MARKER,
  hasSyntheticSntPlayers,
  injectSyntheticSntPlayersIntoTeams,
  isSyntheticSntPlayer,
  stripSyntheticSntPlayers,
} from '@/features/architect/tradeMachine/utils/devSntInjector';

function assertDefined<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

type SyntheticSntTeamSlots = NonNullable<
  Parameters<typeof injectSyntheticSntPlayersIntoTeams>[0]
>;

function makeTeamsFixture(): SyntheticSntTeamSlots {
  return [
    {
      team: {
        id: 'lal',
        teamCode: 'LAL',
        players: [
          {
            id: 'base_1',
            player_id: 'base_1',
            name: 'Base Player',
            teamCode: 'LAL',
          },
        ],
      },
      sends: [],
      entitlementsOut: [],
    },
    {
      team: {
        id: 'bos',
        teamCode: 'BOS',
        players: [],
      },
      sends: [],
      entitlementsOut: [],
    },
  ];
}

describe('DEV S&T injector utilities', () => {
  it('builds one eligible and one ineligible synthetic player', () => {
    const [eligible, ineligible] = buildSyntheticSntPlayers(
      { teamCode: 'LAL' },
      2026
    );

    expect(eligible.name).toContain('Eligible');
    expect(ineligible.name).toContain('Ineligible');
    expect(eligible[DEV_SNT_INJECTOR_MARKER]).toBe(true);
    expect(ineligible[DEV_SNT_INJECTOR_MARKER]).toBe(true);
    expect(eligible.freeAgentYear).toBe(2026);
    expect(ineligible.freeAgentYear).toBeGreaterThan(2026);
  });

  it('preserves the exact synthetic payload key order for both generated players', () => {
    const [eligible, ineligible] = buildSyntheticSntPlayers(
      { teamCode: 'LAL' },
      2026
    );

    expect(Object.keys(eligible)).toEqual([
      'teamCode',
      'teamId',
      'teamAbbr',
      '__tmDevSyntheticSnt',
      'id',
      'player_id',
      'playerId',
      'name',
      'displayName',
      'salary',
      'freeAgentYear',
      'rightsRenounced',
      'bio',
      'contract',
      'primaryContract',
      '__tmDevSntProfile',
    ]);
    expect(Object.keys(ineligible)).toEqual([
      'teamCode',
      'teamId',
      'teamAbbr',
      '__tmDevSyntheticSnt',
      'id',
      'player_id',
      'playerId',
      'name',
      'displayName',
      'salary',
      'freeAgentYear',
      'rightsRenounced',
      'bio',
      'contract',
      'primaryContract',
      '__tmDevSntProfile',
    ]);
    expect(Object.keys(eligible.bio)).toEqual([
      'displayName',
      'playerId',
      'position',
      'team',
    ]);
    expect(Object.keys(ineligible.bio)).toEqual([
      'displayName',
      'playerId',
      'position',
      'team',
    ]);
    const ineligibleContract = assertDefined(
      ineligible.contract,
      'Ineligible synthetic contract should exist'
    );
    const ineligiblePrimaryContract = assertDefined(
      ineligible.primaryContract,
      'Ineligible primary contract should exist'
    );
    expect(Object.keys(ineligibleContract)).toEqual(['salariesByYear']);
    expect(Object.keys(ineligiblePrimaryContract)).toEqual(['salariesByYear']);
    expect(Object.keys(ineligibleContract.salariesByYear[0])).toEqual([
      'season',
      'salary',
      'capHit',
    ]);
    expect(Object.keys(ineligiblePrimaryContract.salariesByYear[0])).toEqual([
      'season',
      'salary',
      'capHit',
    ]);
  });

  it('preserves current fallback behavior for team identity and year parsing', () => {
    const [eligible, ineligible] = buildSyntheticSntPlayers(
      { abbreviation: 'lal' },
      '2025-26'
    );

    expect(eligible.id).toBe('tm-dev-snt-eligible-LAL');
    expect(ineligible.id).toBe('tm-dev-snt-ineligible-LAL');
    expect(eligible.teamCode).toBe('lal');
    expect(ineligible.teamId).toBe('lal');
    expect(eligible.freeAgentYear).toBe(2026);
    expect(ineligible.freeAgentYear).toBe(2028);
    expect(
      assertDefined(
        ineligible.contract,
        'Ineligible synthetic contract should exist'
      ).salariesByYear[0].season
    ).toBe('2025-26');
  });

  it('detects synthetic players and strips them without mutating the input array', () => {
    const [eligible] = buildSyntheticSntPlayers({ teamCode: 'LAL' }, 2026);
    const players = [
      { id: 'base_1', name: 'Base Player' },
      eligible,
    ];

    const stripped = stripSyntheticSntPlayers(players);

    expect(isSyntheticSntPlayer(eligible)).toBe(true);
    expect(isSyntheticSntPlayer(players[0])).toBe(false);
    expect(isSyntheticSntPlayer(null)).toBe(false);
    expect(stripped).toEqual([{ id: 'base_1', name: 'Base Player' }]);
    expect(stripped).not.toBe(players);
    expect(players).toHaveLength(2);
  });

  it('returns the original teams reference when there is no injection target', () => {
    const teams: SyntheticSntTeamSlots = [{ team: null }, { sends: [] }];

    const injected = injectSyntheticSntPlayersIntoTeams(teams, 2026);

    expect(injected).toBe(teams);
  });

  it('injects synthetic players into local team state and clears them cleanly', () => {
    const initialTeams = makeTeamsFixture();
    const injectedTeams = assertDefined(
      injectSyntheticSntPlayersIntoTeams(initialTeams, 2026),
      'Expected injected teams result'
    );
    const primaryInjectedTeam = assertDefined(
      injectedTeams[0]?.team,
      'Expected primary injected team'
    );
    const secondaryInjectedTeam = assertDefined(
      injectedTeams[1]?.team,
      'Expected secondary injected team'
    );

    expect(hasSyntheticSntPlayers(initialTeams)).toBe(false);
    expect(hasSyntheticSntPlayers(injectedTeams)).toBe(true);
    expect(primaryInjectedTeam.players).toHaveLength(3);
    expect(secondaryInjectedTeam.players).toHaveLength(0);

    const cleared = assertDefined(
      clearSyntheticSntPlayersFromTeams(injectedTeams),
      'Expected cleared teams result'
    );
    const clearedPrimaryTeam = assertDefined(
      cleared[0]?.team,
      'Expected cleared primary team'
    );
    expect(hasSyntheticSntPlayers(cleared)).toBe(false);
    expect(clearedPrimaryTeam.players || []).toHaveLength(1);
    expect(clearedPrimaryTeam.players?.[0]?.name).toBe('Base Player');
  });
});
