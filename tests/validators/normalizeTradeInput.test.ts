import { describe, expect, it } from 'vitest';
import { normalizeTradeInput } from '@/features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts';
import { normalizeTradeInput as compatNormalizeTradeInput } from '@/features/architect/utils/tradeMachine/validators/index.js';
import { normalizeTradeInput as utilsNormalizeTradeInput } from '@/features/architect/utils/tradeMachine/utils/index.js';
import capProjections from '@/features/architect/utils/capProjections.js';

const currentYear = 2025;

describe('normalizeTradeInput compatibility surface', () => {
  it('preserves helper identity through the kept compatibility barrels', () => {
    expect(compatNormalizeTradeInput).toBe(normalizeTradeInput);
    expect(utilsNormalizeTradeInput).toBe(normalizeTradeInput);
  });

  it('preserves authoritative normalizeTradeInput behavior', () => {
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
