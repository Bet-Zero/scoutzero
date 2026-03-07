import { describe, expect, it } from 'vitest';
import { getDefaultAddPlayerFilters } from '@/shared/utils/filtering';
import {
  createMissingRosterPlayer,
  filterRosterDrawerPlayers,
  findSalaryForYear,
  getPlayersForSelectedTeam,
  hasActiveAddPlayerFilters,
  normalizePlayer,
} from '@/features/roster/utils';
import { TeamMap } from '@/constants/teamList';

const buildProcessedPlayer = ({
  id,
  name,
  team = 'LAL',
  position = 'G',
  freeAgentYear = null,
  options = [],
  contractType = 'Standard',
}) => ({
  id,
  name: name.toLowerCase(),
  team: team.toLowerCase(),
  teamCode: team,
  position,
  offenseRoles: [],
  defenseRoles: [],
  offenseSubroles: [],
  defenseSubroles: [],
  shootingProfile: '',
  badges: [],
  salary: 10_000_000,
  freeAgentYear,
  freeAgentType: '',
  contractType: contractType.toLowerCase(),
  extension: null,
  options,
  original: {
    id,
    bio: {
      displayName: name,
      display: {
        team,
        teamId: team,
      },
    },
    currentSeasonStats: {},
    currentContractView: {
      contractType,
    },
  },
});

describe('Roster Builder Helpers', () => {
  it('treats default add-player filters as inactive until a real value is set', () => {
    const defaults = getDefaultAddPlayerFilters();

    expect(hasActiveAddPlayerFilters(defaults)).toBe(false);
    expect(
      hasActiveAddPlayerFilters({
        ...defaults,
        subRoles: { offense: ['handler'], defense: [] },
      })
    ).toBe(true);
  });

  it('keeps FA year filters cumulative with contract feature filters', () => {
    const players = [
      buildProcessedPlayer({
        id: 'to-player',
        name: 'TO Player',
        freeAgentYear: '2026',
        options: [{ year: 2026, type: 'TO' }],
      }),
      buildProcessedPlayer({
        id: 'plain-player',
        name: 'Plain Player',
        freeAgentYear: '2026',
      }),
    ];

    const result = filterRosterDrawerPlayers(players, '', {
      ...getDefaultAddPlayerFilters(),
      freeAgentYear: '2026',
      contractFeature: 'to',
    });

    expect(result.map((player) => player.id)).toEqual(['to-player']);
  });

  it('matches current-roster players by normalized team code', () => {
    const players = [
      {
        id: 'laker',
        bio: {
          displayName: 'Laker Player',
          display: { teamId: 'LAL', team: 'LAL' },
        },
      },
      {
        id: 'celtic',
        bio: {
          displayName: 'Celtic Player',
          display: { teamId: 'BOS', team: 'BOS' },
        },
      },
    ];

    const result = getPlayersForSelectedTeam(players, TeamMap.lakers);

    expect(result.map((player) => player.id)).toEqual(['laker']);
  });

  it('preserves missing-player placeholders and their original ids through normalizePlayer', () => {
    const placeholder = createMissingRosterPlayer('missing-player');
    const serializedId = normalizePlayer(placeholder)?.id;

    expect(normalizePlayer(placeholder)).toEqual(placeholder);
    expect(serializedId).toBe('missing-player');
  });

  it('reads salary from currentContractView salaryByYear using the shared default year', () => {
    const salary = findSalaryForYear({
      currentContractView: {
        salaryByYear: {
          2025: 24_500_000,
        },
      },
    });

    expect(salary).toBe(24_500_000);
  });
});
