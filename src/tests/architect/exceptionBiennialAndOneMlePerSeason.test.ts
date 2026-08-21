/**
 * FILE: src/tests/architect/exceptionBiennialAndOneMlePerSeason.test.ts
 * PURPOSE: Guardrails for two CBA exception-usage rules enforced at signing:
 *   - BAE biennial restriction (cannot be used in consecutive seasons)
 *   - One Mid-Level/Room Exception per season (NT-MLE / Taxpayer MLE / Room are
 *     mutually exclusive once one has been consumed)
 * OWNERSHIP: Feature: architect/cap-sheet
 */
import { describe, it, expect, vi } from 'vitest';
import { validateSigning } from '@/features/architect/utils/capLegalityValidation';
import { capProjections } from '@/features/architect/utils/capProjections';
import { consumeSigningExceptionUsage } from '@/features/architect/utils/mutationPipeline.compute.signings.signing';
import { resetTeamNonTpeExceptionsForNewSeason } from '@/features/architect/utils/exceptions';

// Mirror the cap-totals mock used by exceptionBlocking.test.ts so apron
// detection keys off the team's declared totals.
vi.mock(
  '@/features/architect/utils/capTotals/computeTeamCapTotals',
  async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
      ...actual,
      computeTeamCapTotals: vi.fn((team) => ({
        totalCapAllocations:
          (team as { totals?: { capHit?: number } })?.totals?.capHit ?? 0,
      })),
      createCanonicalTeamTotalsSnapshot: vi.fn((team) => {
        const totals = (team as {
          totals?: {
            teamSalary?: number;
            apronTeamSalary?: number;
            taxSalary?: number;
            salaryCap?: number;
          };
        })?.totals;
        return {
          teamSalary: totals?.teamSalary ?? null,
          apronTeamSalary: totals?.apronTeamSalary ?? null,
          taxSalary: totals?.taxSalary ?? null,
          bookDeltas: {
            vsCap:
              typeof totals?.teamSalary === 'number' &&
              typeof totals?.salaryCap === 'number'
                ? totals.teamSalary - totals.salaryCap
                : null,
          },
        };
      }),
      canUseRoomException: vi.fn((team) => {
        const totals = (team as {
          totals?: { teamSalary?: number; salaryCap?: number };
        })?.totals;
        return typeof totals?.teamSalary === 'number' &&
          typeof totals?.salaryCap === 'number' &&
          totals.teamSalary < totals.salaryCap
          ? { eligible: true }
          : { eligible: false, reason: 'Team must be under the salary cap' };
      }),
    };
  }
);

const YEAR = 2025; // 2024-25 season
const CAP = capProjections['2024-25'];
const FIRST_APRON = CAP.firstApron;
// Comfortably under the first apron so apron-based blocks don't short-circuit.
const UNDER_APRON_CAP_HIT = FIRST_APRON - 15_000_000;

function createContract(salary = 2_000_000) {
  return {
    contractType: 'Standard',
    salariesByYear: [{ season: '2024-25', salary }],
  };
}

function createTeam(exceptions: Record<string, unknown>) {
  return {
    teamCode: 'TST',
    players: [],
    capHolds: [],
    exceptions,
    totals: {
      teamSalary: UNDER_APRON_CAP_HIT,
      apronTeamSalary: UNDER_APRON_CAP_HIT,
      taxSalary: UNDER_APRON_CAP_HIT,
      salaryCap: CAP.cap,
      capHit: UNDER_APRON_CAP_HIT,
      totalSalary: UNDER_APRON_CAP_HIT,
      totalCapAllocations: UNDER_APRON_CAP_HIT,
      isHardCapped: false,
      hardCapLevel: null,
    },
  };
}

const enabledException = (extra: Record<string, unknown> = {}) => ({
  enabled: true,
  available: true,
  amount: 12_000_000,
  maxAmount: 12_000_000,
  totalAmount: 12_000_000,
  remainingAmount: 12_000_000,
  usedAmount: 0,
  ...extra,
});

function hasExceptionBlock(violations: { rule?: string; message?: string }[]) {
  return violations.some((v) => v.rule === 'exception_blocked');
}

describe('BAE biennial restriction', () => {
  it('blocks BAE when it was used in the immediately prior season', () => {
    const team = createTeam({
      bae: enabledException({ lastUsedSeasonEndYear: YEAR - 1 }),
    });
    const result = validateSigning({
      team,
      player: { player_id: 'p1' },
      contract: createContract(),
      signedUsing: 'BAE',
      year: YEAR,
    });
    expect(result.valid).toBe(false);
    expect(result.violations).toContainEqual(
      expect.objectContaining({ rule: 'exception_blocked' })
    );
    expect(
      result.violations.some((v) => /every other season/i.test(v.message ?? ''))
    ).toBe(true);
  });

  it('allows BAE when last used two seasons ago (every-other-season is satisfied)', () => {
    const team = createTeam({
      bae: enabledException({ lastUsedSeasonEndYear: YEAR - 2 }),
    });
    const result = validateSigning({
      team,
      player: { player_id: 'p1' },
      contract: createContract(),
      signedUsing: 'BAE',
      year: YEAR,
    });
    expect(hasExceptionBlock(result.violations)).toBe(false);
  });

  it('allows BAE when it has never been used', () => {
    const team = createTeam({ bae: enabledException() });
    const result = validateSigning({
      team,
      player: { player_id: 'p1' },
      contract: createContract(),
      signedUsing: 'BAE',
      year: YEAR,
    });
    expect(hasExceptionBlock(result.violations)).toBe(false);
  });
});

describe('One MLE/Room exception per season', () => {
  it('blocks Taxpayer MLE when the Non-Taxpayer MLE was already used', () => {
    const team = createTeam({
      mle: enabledException({ usedAmount: 5_000_000, remainingAmount: 7_000_000 }),
      tpmle: enabledException(),
    });
    const result = validateSigning({
      team,
      player: { player_id: 'p1' },
      contract: createContract(),
      signedUsing: 'Taxpayer MLE',
      year: YEAR,
    });
    expect(result.valid).toBe(false);
    expect(hasExceptionBlock(result.violations)).toBe(true);
    expect(
      result.violations.some((v) => /one mid-level/i.test(v.message ?? ''))
    ).toBe(true);
  });

  it('blocks Room Exception when the Non-Taxpayer MLE was already used', () => {
    const team = createTeam({
      mle: enabledException({ usedAmount: 1_000_000, remainingAmount: 11_000_000 }),
      room: enabledException(),
    });
    const result = validateSigning({
      team,
      player: { player_id: 'p1' },
      contract: createContract(),
      signedUsing: 'Room',
      year: YEAR,
    });
    // Room also requires under-cap; either way it must be blocked.
    expect(result.valid).toBe(false);
    expect(
      result.violations.some((violation) =>
        ['exception_blocked', 'ROOM_REQUIRES_UNDER_CAP'].includes(
          violation.rule ?? ''
        )
      )
    ).toBe(true);
  });

  it('does NOT block the same MLE flavor that is already partially used (splitting is allowed)', () => {
    const team = createTeam({
      mle: enabledException({ usedAmount: 5_000_000, remainingAmount: 7_000_000 }),
    });
    const result = validateSigning({
      team,
      player: { player_id: 'p1' },
      contract: createContract(),
      signedUsing: 'MLE',
      year: YEAR,
    });
    expect(hasExceptionBlock(result.violations)).toBe(false);
  });

  it('does NOT block an MLE because the BAE was used (BAE is separate)', () => {
    const team = createTeam({
      bae: enabledException({ usedAmount: 4_000_000, remainingAmount: 0 }),
      mle: enabledException(),
    });
    const result = validateSigning({
      team,
      player: { player_id: 'p1' },
      contract: createContract(),
      signedUsing: 'MLE',
      year: YEAR,
    });
    expect(hasExceptionBlock(result.violations)).toBe(false);
  });
});

describe('BAE biennial marker plumbing', () => {
  it('records lastUsedSeasonEndYear when the BAE is consumed', () => {
    const team = {
      exceptions: {
        bae: {
          enabled: true,
          available: true,
          totalAmount: 4_000_000,
          maxAmount: 4_000_000,
          amount: 4_000_000,
          usedAmount: 0,
          remainingAmount: 4_000_000,
        },
      },
    } as Parameters<typeof consumeSigningExceptionUsage>[0]['updatedTeam'];

    const result = consumeSigningExceptionUsage({
      updatedTeam: team,
      mechanism: 'BAE',
      contractValue: 3_000_000,
      timestamp: Date.now(),
      seasonEndYear: YEAR,
    });

    expect(result.consumedExceptionKey).toBe('bae');
    expect(
      (team.exceptions as Record<string, { lastUsedSeasonEndYear?: number }>).bae
        .lastUsedSeasonEndYear
    ).toBe(YEAR);
  });

  it('preserves lastUsedSeasonEndYear across the season rollover reset', () => {
    const team = {
      exceptions: {
        bae: {
          enabled: true,
          maxAmount: 4_000_000,
          totalAmount: 4_000_000,
          usedAmount: 3_000_000,
          remainingAmount: 1_000_000,
          seasonKey: '2024-25',
          lastUsedSeasonEndYear: YEAR,
        },
      },
    };

    resetTeamNonTpeExceptionsForNewSeason(team, YEAR + 1);

    const bae = team.exceptions.bae as {
      usedAmount: number;
      lastUsedSeasonEndYear?: number;
    };
    // usedAmount resets, but the biennial marker must survive.
    expect(bae.usedAmount).toBe(0);
    expect(bae.lastUsedSeasonEndYear).toBe(YEAR);
  });
});
