import { describe, it, expect } from 'vitest';
import { validateSalaryMatching } from '@/features/architect/utils/tradeMachine/rules/validateSalaryMatching';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import type { NormalizedPlayer } from '@/features/architect/utils/tradeMachine/constants/types';

type SalaryMatchingTeamInput = NonNullable<
  Parameters<typeof validateSalaryMatching>[0]
>;
type SalaryMatchingResultWithEffective = ReturnType<
  typeof validateSalaryMatching
> & {
  effectiveAllowableIncoming?: number;
};

function makeNormalizedPlayer(id: string, salary: number): NormalizedPlayer {
  return {
    id,
    player_id: id,
    name: id.toUpperCase(),
    salary,
    matchIncoming: salary,
    matchOutgoing: salary,
    isTwoWay: false,
    absorptionMode: 'MATCH',
    signAndTrade: false,
    contractYears: 1,
    firstYearGuaranteed: true,
    contract: {
      salariesByYear: [{ season: '2025-26', salary }],
    },
  };
}

describe('salary matching validation', () => {
  const capSettings = {
    salaryCap: 141_000_000,
    firstApron: 178_000_000,
    secondApron: 188_000_000,
  };

  const makeTeam = (
    salaryOut: number,
    salaryIn: number,
    extra: Partial<SalaryMatchingTeamInput> = {}
  ): SalaryMatchingTeamInput => ({
    salaryOut,
    salaryIn,
    ...extra,
  });

  it('allows teams to take back less salary', () => {
    const result = validateSalaryMatching(makeTeam(10_000_000, 8_000_000));
    expect(result.passed).toBe(true);
  });

  it('enforces FA exception bucket limits', () => {
    const result = validateSalaryMatching(
      makeTeam(0, 12_000_000, {
        absorptionMode: 'FA_EXCEPTION',
        bucketType: 'NTMLE',
        team: {
          faExceptionBuckets: [{ type: 'NTMLE', remaining: 11_000_000 }],
        },
      })
    );
    expect(result.passed).toBe(false);
    expect(result.violations[0]).toMatch(/FA Exception bucket insufficient/);
  });

  it('validates allowable incoming margin', () => {
    const result = validateSalaryMatching(
      makeTeam(10_000_000, 18_000_000, {
        teamTotalSalary: 150_000_000,
        context: {
          capSettings: {
            salaryCap: 141_000_000,
            firstApron: 172_346_000,
            secondApron: 182_794_000,
          },
        },
      })
    );
    expect(result.passed).toBe(false);
    expect(result.violations[0]).toMatch(/exceeds allowable amount/);
  });

  it('handles null/undefined team data', () => {
    expect(validateSalaryMatching(null).passed).toBe(false);
    expect(validateSalaryMatching(undefined).passed).toBe(false);
    expect(validateSalaryMatching({}).passed).toBe(false);
  });

  it('enforces effective allowable incoming for first-apron hard-capped teams', () => {
    const result = validateSalaryMatching(
      makeTeam(10_000_000, 12_000_000, {
        teamTotalSalary: 177_000_000,
        hardCapped: 1,
        hardCapLevel: 'firstApron',
        context: { capSettings },
      })
    ) as SalaryMatchingResultWithEffective;

    expect(result.allowableIncoming).toBe(17_500_000);
    expect(result.hardCapIncomingCeiling).toBe(11_000_000);
    expect(result.effectiveAllowableIncoming).toBe(11_000_000);
    expect(result.details.hardCapStatus?.hardCapType).toBe('FIRST_APRON');
    expect(result.passed).toBe(true);
  });

  it('passes through hard-cap status source, reason, and ceiling metadata to salary matching', () => {
    const result = validateSalaryMatching(
      makeTeam(10_000_000, 10_000_000, {
        teamTotalSalary: 175_000_000,
        hardCapped: 1,
        hardCapLevel: 'firstApron',
        context: { capSettings },
      })
    );

    expect(result.details.hardCapStatus).toMatchObject({
      isHardCapped: true,
      source: 'team.hardCapped',
      reason: 'Hard cap triggered at First Apron',
      hardCapCeiling: 178_000_000,
      hardCapCeilingType: 'FIRST_APRON',
      hardCapCeilingLabel: '1st Apron',
    });
  });

  it('uses second-apron hard-cap ceiling when type is SECOND_APRON', () => {
    const result = validateSalaryMatching(
      makeTeam(10_000_000, 10_000_000, {
        teamTotalSalary: 187_000_000,
        hardCapped: 2,
        hardCapLevel: 'secondApron',
        context: { capSettings },
      })
    ) as SalaryMatchingResultWithEffective;

    expect(result.details.hardCapStatus?.hardCapType).toBe('SECOND_APRON');
    expect(result.details.hardCapCeiling?.apronLabel).toBe('2nd Apron');
    expect(result.hardCapIncomingCeiling).toBe(11_000_000);
    expect(result.effectiveAllowableIncoming).toBe(10_000_000);
  });

  it('applies the same effective limiter in world mode payloads', () => {
    const result = validateSalaryMatching(
      makeTeam(10_000_000, 12_000_000, {
        teamTotalSalary: 177_000_000,
        hardCapped: 1,
        hardCapLevel: 'firstApron',
        context: { capSettings, worldId: 'world_dev_1' },
      })
    ) as SalaryMatchingResultWithEffective;

    expect(result.allowableIncoming).toBe(17_500_000);
    expect(result.hardCapIncomingCeiling).toBe(11_000_000);
    expect(result.effectiveAllowableIncoming).toBe(11_000_000);
    expect(result.passed).toBe(true);
  });

  it('fails closed to first apron when hard-cap type is unknown', () => {
    const result = validateSalaryMatching(
      makeTeam(10_000_000, 10_000_000, {
        teamTotalSalary: 177_000_000,
        hardCapped: true, // Legacy boolean with no explicit typed level
        context: { capSettings },
      })
    ) as SalaryMatchingResultWithEffective;

    expect(result.details.hardCapStatus?.hardCapType).toBe('UNKNOWN');
    expect(result.details.hardCapCeiling?.apronLabel).toContain('fail-closed');
    expect(result.hardCapIncomingCeiling).toBe(11_000_000);
    expect(result.effectiveAllowableIncoming).toBe(11_000_000);
    expect(result.passed).toBe(true);
  });

  it('computes fail-closed limiter for potential apron-breach scenarios', () => {
    const result = validateSalaryMatching(
      makeTeam(10_000_000, 12_000_000, {
        teamTotalSalary: 177_000_000,
        hardCapped: true,
        context: { capSettings },
      })
    ) as SalaryMatchingResultWithEffective;

    expect(result.details.hardCapStatus?.hardCapType).toBe('UNKNOWN');
    expect(result.effectiveAllowableIncoming).toBe(11_000_000);
    expect(result.passed).toBe(true);
  });

  it('blocks post-trade apron breach at trade-validation level with fail-closed hard cap', () => {
    const result = validateTrade({
      teams: [
        {
          team: {
            id: 'A',
            teamCode: 'A',
            teamName: 'A',
            totalSalary: 177_000_000,
            players: [makeNormalizedPlayer('a1', 10_000_000)],
          },
          sends: [makeNormalizedPlayer('a1', 10_000_000)],
          hardCapped: true,
          entitlementsOut: [],
        },
        {
          team: {
            id: 'B',
            teamCode: 'B',
            teamName: 'B',
            totalSalary: 120_000_000,
            players: [makeNormalizedPlayer('b1', 12_000_000)],
          },
          sends: [makeNormalizedPlayer('b1', 12_000_000)],
          entitlementsOut: [],
        },
      ],
      capProjections: {
        '2025-26': {
          salaryCap: 141_000_000,
          firstApron: 178_000_000,
          secondApron: 188_000_000,
        },
      },
      currentYear: 2026,
    });

    const teamA = result.teamResults.find((team) => team.teamId === 'A');
    expect(result.legal).toBe(false);
    expect(teamA?.rules?.hardCap?.passed).toBe(false);
    expect(
      (
        teamA?.rules?.salaryMatching as
          | { effectiveAllowableIncoming?: number }
          | undefined
      )?.effectiveAllowableIncoming
    ).toBe(11_000_000);
  });
});
