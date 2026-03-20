import { describe, expect, it } from 'vitest';
import { validateAggregation } from '@/features/architect/utils/tradeMachine/rules/validateAggregation.js';
import {
  SECOND_APRON_AGGREGATION_UP_BLOCKED,
  SECOND_APRON_MULTI_TEAM_AGGREGATION_BLOCKED,
} from '@/features/architect/utils/tradeMachine/constants/secondApronMessages';

const capSettings = {
  salaryCap: 141_000_000,
  firstApron: 179_000_000,
  secondApron: 190_000_000,
};

describe('validateAggregation compatibility surface', () => {
  it('preserves the exact non-second-apron early-return object', () => {
    expect(
      validateAggregation(
        {
          teamTotalSalary: 190_000_000,
          outgoingPlayers: [{ salary: 5_000_000 }],
          incomingPlayers: [{ salary: 12_000_000 }],
        },
        { capSettings, yearKey: 2025 }
      )
    ).toEqual({
      passed: true,
      violations: [],
      message: 'Aggregation valid (not a second apron team)',
      details: 'Team salary 190,000,000 is below second apron 190,000,000',
    });
  });

  it('preserves sends fallback and sorted calculations for valid above-second-apron aggregation', () => {
    expect(
      validateAggregation(
        {
          teamTotalSalary: 210_000_000,
          sends: [{ salary: 5_000_000 }, { salary: 10_000_000 }],
          incomingPlayers: [{ salary: 10_000_000 }],
        },
        { capSettings, yearKey: 2025 }
      )
    ).toEqual({
      passed: true,
      violations: [],
      message: 'Valid aggregation',
      details: '',
      calculations: {
        outgoingSalaries: [10_000_000, 5_000_000],
        incomingSalaries: [10_000_000],
      },
    });
  });

  it('preserves violation ordering and sorted calculations for dual blocker cases', () => {
    expect(
      validateAggregation(
        {
          teamTotalSalary: 210_000_000,
          outgoingPlayers: [{ salary: 5_000_000 }, { salary: 8_000_000 }],
          incomingPlayers: [
            { salary: 12_000_000, fromTeamId: 'B' },
            { salary: 2_000_000, fromTeamId: 'C' },
          ],
        },
        { capSettings, yearKey: 2025 }
      )
    ).toEqual({
      passed: false,
      violations: [
        SECOND_APRON_AGGREGATION_UP_BLOCKED,
        SECOND_APRON_MULTI_TEAM_AGGREGATION_BLOCKED,
      ],
      message: 'Aggregation violation',
      details: `${SECOND_APRON_AGGREGATION_UP_BLOCKED}; ${SECOND_APRON_MULTI_TEAM_AGGREGATION_BLOCKED}`,
      calculations: {
        outgoingSalaries: [8_000_000, 5_000_000],
        incomingSalaries: [12_000_000, 2_000_000],
      },
    });
  });
});
