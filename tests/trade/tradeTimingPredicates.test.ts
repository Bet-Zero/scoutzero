import { describe, expect, it } from 'vitest';
import type { ContractSalaryTerm } from '@/schemas/governedContractState';
import {
  signingTradeRestrictions,
  amendmentTradeRestrictions,
} from '@/features/architect/utils/tradeMachine/utils/tradeSigningTiming';
import { makeResultingState } from '../architect/contractHistory/contractHistoryFixtures';

const unknown = { precision: 'unknown' as const, value: null, rawValue: null };
const dated = (value: string) => ({
  precision: 'date' as const,
  value,
  rawValue: value,
});
function row(season: string, salary: number): ContractSalaryTerm {
  return {
    season,
    salary,
    capHit: salary,
    guaranteed: true,
    guaranteedAmount: salary,
    option: null,
    optionHolder: null,
    optionUsed: null,
    optionDecisionDate: unknown,
    optionDecisionDeadline: unknown,
    tradeBonus: 0,
    incentives: { likely: 0, unlikely: 0, criteriaEvidence: 'known' },
    guaranteeSchedule: [],
    voidedByExtension: false,
    voidedOn: unknown,
  };
}
function terms(
  salaries = [row('2026-27', 12_000_000), row('2027-28', 12_600_000)]
) {
  return {
    ...makeResultingState().terms,
    signingTeam: 'BOS',
    signingDate: dated('2026-07-06'),
    startSeason: '2026-27',
    endSeason: salaries.at(-1)!.season,
    salaries,
  };
}
const prior = (salary: number) => terms([row('2025-26', salary)]);
const basisEvidence = (extra = {}) => ({
  evidenceVersion: 1,
  earnedBaseCompensation: [],
  oneYearMinimum: null,
  poisonPill: null,
  ...extra,
});
const signingFacts = (extra = {}) => ({
  signingDate: '2026-07-06',
  priorTeamId: 'BOS',
  priorSeasonRegularSalary: 10_000_000,
  teamSalaryAfterSigning: 180_000_000,
  salaryCapAtSigning: 164_961_000,
  ...extra,
});
const league = (amount: number) => ({
  evidenceVersion: 1,
  status: 'known',
  signingSalaryCapYear: 2027,
  firstExtendedSalaryCapYear: 2027,
  salaryCap: 164_961_000,
  estimatedAveragePlayerSalary: amount,
  moratoriumEndsAt: dated('2026-07-06'),
  regularSeasonFirstDay: dated('2026-10-20'),
  source: {
    provider: 'software-test',
    sourceUrl: 'https://example.invalid/league',
    retainedArtifactPath: 'fixture/league',
    artifactSha256: `sha256:${'a'.repeat(64)}`,
    artifactBytes: 1,
    retrievedAt: '2026-07-01T00:00:00Z',
  },
});

describe('current-season Bird signing predicates (L03.18)', () => {
  it('admits the exact 120% boundary and keeps the ordinary December 15 bar', () => {
    const contract = terms();
    const context = { relatedContracts: [prior(10_000_000)] };
    expect(
      signingTradeRestrictions(contract, '2026-12-15', undefined, context)
    ).toEqual([]);
    expect(
      signingTradeRestrictions(
        contract,
        '2026-12-14',
        undefined,
        context
      ).join()
    ).toContain('L03.17');
    expect(
      signingTradeRestrictions(
        { ...contract, salaries: [row('2026-27', 12_000_000.01)] },
        '2026-12-15',
        undefined,
        context
      ).join()
    ).toContain('needs prior-Team');
  });
  it('applies the special bar only when its retained cap and prior-team predicates require it', () => {
    const contract = {
      ...terms([row('2026-27', 13_000_000)]),
      tradeSalaryBasisEvidence: basisEvidence({
        signingEligibility: signingFacts(),
      }),
    };
    expect(signingTradeRestrictions(contract, '2027-01-14').join()).toContain(
      'above-cap Bird re-signing'
    );
    expect(signingTradeRestrictions(contract, '2027-01-15')).toEqual([]);
    for (const override of [
      { teamSalaryAfterSigning: 164_961_000 },
      { priorTeamId: 'CHI' },
    ]) {
      expect(
        signingTradeRestrictions(
          {
            ...contract,
            tradeSalaryBasisEvidence: basisEvidence({
              signingEligibility: signingFacts(override),
            }),
          },
          '2026-12-15'
        )
      ).toEqual([]);
    }
    expect(
      signingTradeRestrictions(
        {
          ...contract,
          tradeSalaryBasisEvidence: basisEvidence({
            signingEligibility: signingFacts({ signingDate: '2025-07-06' }),
          }),
        },
        '2026-12-15'
      ).join()
    ).toContain('conflicts');
    expect(
      signingTradeRestrictions(contract, '2026-12-15', undefined, {
        relatedContracts: [prior(9_000_000)],
      }).join()
    ).toContain('conflicts');
    // Retained signing facts cannot conceal conflicting current salary rows.
    expect(
      signingTradeRestrictions(contract, '2026-12-15', undefined, {
        relatedContracts: [prior(10_000_000), prior(9_000_000)],
      }).join()
    ).toContain('conflicts');
  });
  it('admits the signed minimum/no-bonus exception from exact season cells, never a label alone', () => {
    const contract = {
      ...terms([row('2026-27', 2_449_421)]),
      signedUsing: 'Early Bird Exception',
      tradeSalaryBasisEvidence: basisEvidence({
        minimumSalaryAmounts: [
          {
            salaryCapYear: 2027,
            contractStartSalaryCapYear: 2027,
            contractYear: 1,
            yearsOfService: 2,
            amount: 2_449_421,
          },
        ],
      }),
    };
    expect(signingTradeRestrictions(contract, '2026-12-15')).toEqual([]);
    expect(
      signingTradeRestrictions(
        { ...contract, salaries: [row('2026-27', 2_449_422)] },
        '2026-12-15'
      ).join()
    ).toContain('L03.18');
    expect(
      signingTradeRestrictions(
        {
          ...contract,
          salaries: [
            {
              ...contract.salaries[0],
              incentives: { likely: 1, unlikely: 0, criteriaEvidence: 'known' },
            },
          ],
        },
        '2026-12-15'
      ).join()
    ).toContain('L03.18');
  });
});

describe('recent veteran extension salary and raise predicates (A10.4/.5/.7)', () => {
  const extension = () => ({ ...terms(), isExtension: true });
  const check = (
    contract = extension(),
    relatedContracts = [prior(10_000_000)]
  ) =>
    amendmentTradeRestrictions(contract, '2026-11-14', 2027, {
      relatedContracts,
    });
  it('admits the exact 120% first salary and 5% annual change boundaries', () => {
    expect(check()).toEqual([]);
    expect(
      check({
        ...extension(),
        salaries: [row('2026-27', 12_000_000), row('2027-28', 11_400_000)],
      })
    ).toEqual([]);
    expect(
      check({
        ...extension(),
        salaries: [
          row('2026-27', 12_000_000.01),
          row('2027-28', 12_000_000.01),
        ],
      }).join()
    ).toContain('estimated average');
    for (const amount of [12_600_000.01, 11_399_999.99])
      expect(
        check({
          ...extension(),
          salaries: [row('2026-27', 12_000_000), row('2027-28', amount)],
        }).join()
      ).toContain('change above 5%');
  });
  it('uses either established arm of the greater-of ceiling, and requires both to find an excess', () => {
    const contract = {
      ...extension(),
      salaries: [row('2026-27', 18_000_000), row('2027-28', 18_000_000)],
      extensionLeagueEvidence: league(15_000_000),
    };
    expect(check(contract)).toEqual([]);
    expect(
      check({
        ...contract,
        salaries: [
          row('2026-27', 18_000_000.01),
          row('2027-28', 18_000_000.01),
        ],
      }).join()
    ).toContain('first-year salary above');
    expect(
      check({
        ...contract,
        extensionLeagueEvidence: {
          ...league(15_000_000),
          signingSalaryCapYear: 2026,
        },
      }).join()
    ).toContain('estimated average');
    expect(
      check({
        ...contract,
        extensionLeagueEvidence: { ...league(15_000_000), status: 'unknown' },
      }).join()
    ).toContain('estimated average');
  });
  it('preserves rich-term, renegotiation, missing-row, bonus and rookie-extension refusals', () => {
    expect(check({ ...extension(), endSeason: '2030-31' }).join()).toContain(
      'extension term'
    );
    expect(
      check({ ...extension(), contractType: 'Renegotiation' }).join()
    ).toContain('renegotiation');
    expect(
      check({ ...extension(), salaries: [row('2026-27', 12_000_000)] }).join()
    ).toContain('complete extended-term');
    expect(
      check({ ...extension(), bonuses: { tradeKickerPercent: 1 } }).join()
    ).toContain('post-V1');
    expect(
      check({
        ...extension(),
        isRookieScale: true,
        startSeason: '2027-28',
      }).join()
    ).toContain('poison-pill');
  });
  it('uses prior accepted compensation only when current terms omit it and it predates signing', () => {
    const contract = extension();
    const historical = {
      terms: prior(10_000_000),
      effectiveAt: '2026-06-05T12:00:00Z',
    };
    const checkHistory = (
      context: Parameters<typeof amendmentTradeRestrictions>[3]
    ) => amendmentTradeRestrictions(contract, '2026-11-14', 2027, context);
    expect(checkHistory({ historicalContracts: [historical] })).toEqual([]);
    expect(
      checkHistory({
        historicalContracts: [
          { ...historical, effectiveAt: '2026-07-07T12:00:00Z' },
        ],
      }).join()
    ).toContain('original-term salary');
    expect(
      checkHistory({
        relatedContracts: [prior(1_000_000)],
        historicalContracts: [historical],
      }).join()
    ).toContain('original-term salary');
    expect(
      checkHistory({
        historicalContracts: [
          historical,
          { ...historical, terms: prior(1_000_000) },
        ],
      }).join()
    ).toContain('unambiguous original-term');
  });
});
