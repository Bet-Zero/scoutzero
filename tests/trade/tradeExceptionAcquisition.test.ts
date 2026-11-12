import { describe, expect, it } from 'vitest';
import { applyTradeExceptionAcquisitions } from '@/features/architect/utils/mutationPipeline.compute.trade';
import type { TradeTeamUpdate } from '@/features/architect/utils/mutationPipeline.types.result';
import type { TradeSalaryMatchingPath } from '@/schemas/tradeSalaryMatchingPath';
import { validateFaExceptionUsage } from '@/features/architect/utils/tradeMachine/rules/validateFaExceptionUsage';

const MLE = 14_104_000;
const BAE = 5_134_000;
const AT = '2026-07-15T16:00:00.000Z';

function team(): TradeTeamUpdate {
  return {
    teamCode: 'CHI',
    team: {
      teamCode: 'CHI',
      exceptions: {
        mle: {
          enabled: true,
          totalAmount: MLE,
          usedAmount: 0,
          remainingAmount: MLE,
        },
        bae: {
          enabled: true,
          totalAmount: BAE,
          usedAmount: 0,
          remainingAmount: BAE,
        },
      },
    },
  };
}

function apply(
  update: TradeTeamUpdate,
  electedPath: TradeSalaryMatchingPath,
  actualIncoming: number,
  status: 'PASS' | 'FAIL' = 'PASS'
) {
  return applyTradeExceptionAcquisitions({
    salaryMatchingPaths: [
      { teamCode: 'CHI', evaluation: { electedPath, status, actualIncoming } },
    ],
    teamUpdates: [update],
    timestamp: Date.parse(AT),
    effectiveAt: AT,
    seasonEndYear: 2027,
  });
}

describe('free-agent exception use in an applied trade', () => {
  it('consumes the Non-Taxpayer MLE and records a First Apron hard cap', () => {
    const update = team();
    expect(apply(update, 'NON_TAXPAYER_MLE', 10_000_000)).toBeNull();
    expect(update.team?.exceptions?.mle).toMatchObject({
      usedAmount: 10_000_000,
      remainingAmount: MLE - 10_000_000,
      lastUsedAt: AT,
    });
    expect(update.team).toMatchObject({
      hardCapped: 1,
      hardCapLevel: 'firstApron',
      hardCapTriggeredBy: 'fullMLE',
    });
  });

  it('records the BAE Season for the consecutive-Season rule', () => {
    const update = team();
    expect(apply(update, 'BI_ANNUAL_EXCEPTION', BAE)).toBeNull();
    expect(update.team?.exceptions?.bae).toMatchObject({
      remainingAmount: 0,
      lastUsedSeasonEndYear: 2027,
    });
    expect(update.team?.hardCapTriggeredBy).toBe('bae');
  });

  it('fails closed above the remaining balance, on a non-passing path and on a missing team', () => {
    const update = team();
    expect(apply(update, 'NON_TAXPAYER_MLE', MLE + 1)).toContain(
      'exceeds remaining MLE'
    );
    expect(update.team?.exceptions?.mle).toMatchObject({ usedAmount: 0 });
    expect(update.team?.hardCapped).toBeUndefined();
    expect(apply(team(), 'NON_TAXPAYER_MLE', 1, 'FAIL')).toContain(
      'cannot use a free-agent exception'
    );
    expect(
      applyTradeExceptionAcquisitions({
        salaryMatchingPaths: [
          {
            teamCode: 'NYK',
            evaluation: {
              electedPath: 'ROOM_MLE',
              status: 'PASS',
              actualIncoming: 1,
            },
          },
        ],
        teamUpdates: [team()],
        timestamp: Date.parse(AT),
        effectiveAt: AT,
        seasonEndYear: 2027,
      })
    ).toContain('NYK cannot use');
  });

  it('leaves other paths untouched', () => {
    const update = team();
    expect(apply(update, 'STANDARD_TPE', 10_000_000)).toBeNull();
    expect(apply(update, 'MINIMUM_EXCEPTION', 1_000_000)).toBeNull();
    expect(update).toEqual(team());
  });
});

describe('per-player FA Exception shortcut in governed trades', () => {
  const governedTeam = (absorptionMode?: string) => ({
    team: {
      faExceptionBuckets: [{ type: 'NTMLE', remaining: MLE }],
    },
    teamTotalSalary: 150_000_000,
    projectedSalary: 151_000_000,
    incomingPlayers: [
      { salary: 1_000_000, ...(absorptionMode ? { absorptionMode } : {}) },
    ],
    outgoingPlayers: [],
    salaryOut: 0,
    context: {
      yearKey: 2027,
      capSettings: { firstApron: 195_945_000, secondApron: 207_824_000 },
    },
  });

  it('is never auto-selected and is refused when chosen', () => {
    const auto = governedTeam();
    expect(validateFaExceptionUsage(auto, { source: 'tradeMachine' })).toEqual(
      []
    );
    expect(auto.incomingPlayers[0]).not.toHaveProperty('absorptionMode');

    expect(
      validateFaExceptionUsage(governedTeam('FA_EXCEPTION'), {
        source: 'tradeMachine',
      })
    ).toEqual([expect.stringContaining('elect the Non-Taxpayer Mid-Level')]);
  });

  it('still auto-selects outside governed trades', () => {
    const legacy = governedTeam();
    validateFaExceptionUsage(legacy, {});
    expect(legacy.incomingPlayers[0]).toMatchObject({
      absorptionMode: 'FA_EXCEPTION',
    });
  });
});
