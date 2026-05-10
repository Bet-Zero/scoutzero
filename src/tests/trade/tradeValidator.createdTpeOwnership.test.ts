import { beforeEach, describe, expect, it, vi } from 'vitest';
import { capProjections } from '@/features/architect/utils/capProjections';

const harness = vi.hoisted(() => ({
  validateTradeExceptionsMock: vi.fn(),
}));

vi.mock(
  '@/features/architect/utils/tradeMachine/rules/validateTradeExceptions',
  async () => {
    const actual =
      await vi.importActual<
        typeof import('@/features/architect/utils/tradeMachine/rules/validateTradeExceptions')
      >(
        '@/features/architect/utils/tradeMachine/rules/validateTradeExceptions'
      );

    return {
      ...actual,
      validateTradeExceptions: harness.validateTradeExceptionsMock,
    };
  }
);

import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';

const CURRENT_YEAR = 2026;
const TRADE_DATE = '2026-07-01T00:00:00.000Z';

function seasonForYear(year: number) {
  return `${year - 1}-${String(year).slice(-2)}`;
}

function makePlayer(
  name: string,
  salary: number,
  extra: Record<string, unknown> = {},
  year = CURRENT_YEAR
) {
  return {
    name,
    salary,
    contract: { salariesByYear: [{ season: seasonForYear(year), salary }] },
    ...extra,
  };
}

function makeTeam(
  name: string,
  totalSalary: number,
  rosterSize = 14,
  year = CURRENT_YEAR
) {
  return {
    id: name,
    teamName: name,
    totalSalary,
    teamTotalSalary: totalSalary,
    players: Array.from({ length: rosterSize }, (_, index) =>
      makePlayer(`${name}${index}`, 1_000_000, {}, year)
    ),
    picks: [],
  };
}

describe('tradeValidator createdTPE ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.validateTradeExceptionsMock.mockImplementation((team) => ({
      passed: true,
      violations: [],
      warnings: [],
      message: 'Trade exceptions validated',
      details: '',
      createdTPE:
        team?.team?.id === 'A'
          ? {
              amount: 1_234_567,
              totalAmount: 1_234_567,
              remainingAmount: 1_234_567,
              createdSeason: 2026,
              expiresOn: '2027-07-01T00:00:00.000Z',
            }
          : null,
    }));
  });

  it('uses the trade-exception rule result as the single createdTPE owner', () => {
    const teamA = makeTeam('A', 150_000_000);
    const teamB = makeTeam('B', 120_000_000);
    const outgoing = {
      ...makePlayer('Out', 10_000_000, { toTeamId: 'B' }),
    };
    const incoming = {
      ...makePlayer('In', 10_000_000, { fromTeamId: 'B' }),
    };
    teamA.players.push(outgoing);
    teamB.players.push(incoming);

    const result = validateTrade({
      teams: [
        { team: teamA as never, sends: [outgoing], picksOut: [] },
        { team: teamB as never, sends: [incoming], picksOut: [] },
      ],
      capProjections,
      currentYear: CURRENT_YEAR,
      tradeCtx: { tradeDate: TRADE_DATE },
    });

    expect(harness.validateTradeExceptionsMock).toHaveBeenCalled();
    expect(result.teamResults[0].createdTPE).toMatchObject({
      amount: 1_234_567,
      totalAmount: 1_234_567,
      remainingAmount: 1_234_567,
      createdSeason: 2026,
      expiresOn: '2027-07-01T00:00:00.000Z',
    });
    expect(result.teamResults[1].createdTPE).toBeNull();
  });
});
