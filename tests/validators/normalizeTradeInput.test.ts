import { describe, expect, it } from 'vitest';
import { normalizeTradeInput } from '@/features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts';
import { normalizeTradeInput as utilsNormalizeTradeInput } from '@/features/architect/utils/tradeMachine/utils';
import capProjections from '@/features/architect/utils/capProjections';

const currentYear = 2025;

describe('normalizeTradeInput canonical surfaces', () => {
  it('preserves helper identity through the utils barrel', () => {
    expect(utilsNormalizeTradeInput).toBe(normalizeTradeInput);
  });

  it('preserves authoritative normalizeTradeInput behavior', () => {
    const result = normalizeTradeInput({
      teams: [
        {
          team: {
            teamName: 'Team A',
            teamSalary: 89_000_000,
            apronTeamSalary: 90_000_000,
            taxSalary: 91_000_000,
            players: [],
          },
          sends: [],
        },
        {
          team: {
            teamName: 'Team B',
            players: [],
          },
          sends: [],
        },
      ],
      capProjections,
      currentYear,
    });

    expect(result.teams[0].team.teamTotalSalary).toBe(90_000_000);
    expect(result.teams[0].team.projectedSalary).toBe(90_000_000);

    const legacyOnly = normalizeTradeInput({
      teams: [{ team: { totalSalary: 90_000_000, players: [] }, sends: [] }],
      capProjections,
      currentYear,
    });
    expect(legacyOnly.teams[0].team.teamTotalSalary).toBeNaN();
  });

  it.each([
    null,
    undefined,
    '',
    '0',
    false,
    true,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])('never turns unresolved salary-book values into zero (%p)', (value) => {
    const result = normalizeTradeInput({
      teams: [
        {
          team: {
            teamName: 'Unresolved Team',
            teamTotalSalary: value as never,
            apronTeamSalary: value as never,
            projectedSalary: value as never,
            players: [],
          },
          sends: [],
        },
      ],
      capProjections,
      currentYear,
    });

    expect(result.teams[0].team.teamTotalSalary).toBeNaN();
    expect(result.teams[0].team.projectedSalary).toBeNaN();
    expect(result.teams[0].team.teamTotalSalary).not.toBe(0);
  });
});
