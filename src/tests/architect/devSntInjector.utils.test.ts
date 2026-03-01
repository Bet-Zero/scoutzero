import { describe, expect, it } from 'vitest';
import {
  buildSyntheticSntPlayers,
  clearSyntheticSntPlayersFromTeams,
  DEV_SNT_INJECTOR_MARKER,
  hasSyntheticSntPlayers,
  injectSyntheticSntPlayersIntoTeams,
} from '@/features/architect/tradeMachine/utils/devSntInjector';

function makeTeamsFixture() {
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

  it('injects synthetic players into local team state and clears them cleanly', () => {
    const initialTeams = makeTeamsFixture();
    const injectedTeams = injectSyntheticSntPlayersIntoTeams(initialTeams, 2026);

    expect(hasSyntheticSntPlayers(initialTeams)).toBe(false);
    expect(hasSyntheticSntPlayers(injectedTeams)).toBe(true);
    expect(injectedTeams[0].team.players).toHaveLength(3);
    expect(injectedTeams[1].team.players).toHaveLength(0);

    const cleared = clearSyntheticSntPlayersFromTeams(injectedTeams);
    expect(hasSyntheticSntPlayers(cleared)).toBe(false);
    expect(cleared[0].team.players).toHaveLength(1);
    expect(cleared[0].team.players[0].name).toBe('Base Player');
  });
});

