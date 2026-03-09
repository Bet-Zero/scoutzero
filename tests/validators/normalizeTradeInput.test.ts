import { describe, expect, it } from 'vitest';
import { normalizeTradeInput } from '@/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js';
import { normalizeTradeInput as compatNormalizeTradeInput } from '@/features/architect/utils/tradeMachine/validators/index.js';
import capProjections from '@/features/architect/utils/capProjections.js';

const currentYear = 2025;

describe('normalizeTradeInput JS shim', () => {
  it('preserves helper identity through the validator compatibility path', () => {
    expect(compatNormalizeTradeInput).toBe(normalizeTradeInput);
  });

  it('preserves direct normalizeTradeInput.js behavior', () => {
    const result = normalizeTradeInput({
      teams: [
        {
          team: {
            teamName: 'Team A',
            payroll: 90_000_000,
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
  });
});
