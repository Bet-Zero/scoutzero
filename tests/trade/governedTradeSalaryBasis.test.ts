import { describe, expect, it } from 'vitest';

import type { ContractSalaryTerm } from '@/schemas/governedContractState';
import type { GovernedCalendarResolution } from '@/features/architect/utils/governedSeason';
import type { LifecycleProjectionManifest } from '@/features/architect/utils/contractHistory';
import {
  attachGovernedTradeSalaryBasisToRoster,
  collectUniqueWorldContractEventLedgers,
  loadWorldGovernedTradeSalaryBasisEntries,
  resolveGovernedTradeSalaryBasis,
  resolveTradeSalaryBasisPlayerId,
} from '@/features/architect/utils/tradeMachine/utils/governedTradeSalaryBasis';
import {
  computeMatchingValues,
  type MatchingValuePlayer,
} from '@/features/architect/utils/tradeMachine/utils/matchingValues';
import { normalizeTradeContextPayload } from '@/features/architect/utils/tradeContext/tradeContext.snapshot.payloadNorm';
import { normalizeCurrentStatePlayerSnapshot } from '@/features/architect/utils/mutationPipeline.helpers.playerNorm';
import { buildTradeValidationPlayer } from '@/features/architect/utils/tradeContext/tradeContext.payloadNormalization';
import {
  makeResultingState,
  signingEvent,
} from '../architect/contractHistory/contractHistoryFixtures';

const WORLD_ID = 'world-bze287';
const TEAM_ID = 'BOS';
const PLAYER_ID = 'player-0001';
const CONTRACT_ID = 'contract-0001';
const YEAR = 2027;

function row(
  season: string,
  salary: number,
  guaranteedAmount = salary,
  guaranteeSchedule: ContractSalaryTerm['guaranteeSchedule'] = []
): ContractSalaryTerm {
  return {
    season,
    salary,
    capHit: salary,
    guaranteed: guaranteedAmount >= salary,
    guaranteedAmount,
    option: null,
    optionHolder: null,
    optionUsed: null,
    optionDecisionDate: { precision: 'unknown', value: null, rawValue: null },
    optionDecisionDeadline: {
      precision: 'unknown',
      value: null,
      rawValue: null,
    },
    tradeBonus: null,
    incentives: { likely: 0, unlikely: 0, criteriaEvidence: 'unsupported' },
    guaranteeSchedule,
    voidedByExtension: null,
    voidedOn: { precision: 'unknown', value: null, rawValue: null },
  };
}

function protectionStep(date: string, amount: number) {
  return {
    effectiveDate: { precision: 'date' as const, value: date, rawValue: date },
    guaranteedAmount: amount,
    status: 'Decision Pending',
    note: `Increases to ${amount} if not waived before ${date}`,
  };
}

function instantProtectionStep(instant: string, amount: number) {
  return {
    effectiveDate: {
      precision: 'instant' as const,
      value: instant,
      rawValue: instant,
    },
    guaranteedAmount: amount,
    status: 'Decision Pending',
    note: `Increases to ${amount} at ${instant}`,
  };
}

const calendar: GovernedCalendarResolution = {
  state: 'available',
  seasonKey: '2026-27',
  regularSeasonOpening: {
    value: '2026-10-20',
    precision: 'date-only',
    governingTimeZone: 'America/New_York',
  },
  regularSeasonClosing: {
    value: '2027-04-11',
    precision: 'date-only',
    governingTimeZone: 'America/New_York',
  },
  uncertifiedFields: [],
  record: {
    recordId: 'GOV-CAL-BZE287',
    recordVersion: 1,
    authority: 'official',
    sourceRecordId: 'SRC-BZE287',
    sourceRecordVersion: 1,
    sourceField: 'fixture calendar',
    effectiveFrom: '2026-07-01T00:00:00-04:00',
    effectiveUntil: '2027-07-01T00:00:00-04:00',
    canonLeafIds: ['CBA2-A03.2'],
  },
  unavailableReason: null,
  conflictingRecordIds: [],
};

function state(
  salaries: ContractSalaryTerm[],
  overrides: {
    contractType?: string;
    signingDate?: string | null;
    signedUsing?: string;
    contractLength?: number;
    isExtension?: boolean;
    isRookieScale?: boolean;
    tradeKickerPercent?: number | null;
    evidence?: unknown;
  } = {}
) {
  const base = makeResultingState({
    contractId: CONTRACT_ID,
    playerId: PLAYER_ID,
    teamId: TEAM_ID,
  });
  return makeResultingState({
    contractId: CONTRACT_ID,
    playerId: PLAYER_ID,
    teamId: TEAM_ID,
    terms: {
      ...base.terms,
      contractType: overrides.contractType ?? base.terms.contractType,
      ...(overrides.contractType === 'Two-Way'
        ? { endSeason: salaries.at(-1)?.season ?? null }
        : {}),
      ...(overrides.signingDate !== undefined
        ? {
            signingDate:
              overrides.signingDate === null
                ? { precision: 'unknown' as const, value: null, rawValue: null }
                : {
                    precision: 'date' as const,
                    value: overrides.signingDate,
                    rawValue: overrides.signingDate,
                  },
          }
        : {}),
      signedUsing: overrides.signedUsing ?? 'Bird Exception',
      contractLength: overrides.contractLength ?? salaries.length,
      isExtension: overrides.isExtension ?? false,
      isRookieScale: overrides.isRookieScale ?? false,
      salaries,
      bonuses: {
        ...base.terms.bonuses,
        tradeKickerPercent: overrides.tradeKickerPercent ?? null,
      },
      ...(overrides.evidence !== undefined
        ? { tradeSalaryBasisEvidence: overrides.evidence }
        : {}),
    },
  });
}

function manifest(
  contractState: ReturnType<typeof state>
): LifecycleProjectionManifest {
  return {
    manifestVersion: 2,
    ledger: { ledgerId: 'world-bze287:contract-0001', ledgerVersion: 3 },
    worldId: WORLD_ID,
    contractId: CONTRACT_ID,
    playerId: PLAYER_ID,
    teamId: TEAM_ID,
    asOfDate: '2026-12-15T23:59:59Z',
    salaryCapYear: YEAR,
    seasonKey: '2026-27',
    consumedEvents: [],
    resultingContractVersion: contractState.contractVersion,
    resultingStateDigest: contractState.stateDigest,
    sourceRelease: contractState.source,
  };
}

function resolve(
  contractState: ReturnType<typeof state>,
  asOfDate: string,
  options: {
    extensionEffectiveAt?: string | null;
    salaryCapAtTrade?: number | null;
  } = {}
) {
  return resolveGovernedTradeSalaryBasis({
    contractState,
    contractManifest: manifest(contractState),
    extensionEffectiveAt: options.extensionEffectiveAt,
    calendar,
    worldId: WORLD_ID,
    teamId: TEAM_ID,
    playerId: PLAYER_ID,
    asOfDate,
    salaryCapYear: YEAR,
    salaryCapAtTrade: options.salaryCapAtTrade,
  });
}

describe('governed ordinary Trade Machine salary basis', () => {
  it('authenticates a continuing Two-Way without inventing cash pay or requiring salary protection', () => {
    const rows = [row('2026-27', 636435, 0), row('2027-28', 650000, 0)];
    rows.forEach((term) => {
      term.guaranteedAmount = null;
    });
    const result = resolve(
      state(rows, {
        contractType: 'Two-Way',
        signingDate: '2026-07-10',
      }),
      '2027-06-05'
    );
    expect(result).toMatchObject({
      status: 'ready',
      method: 'two-way-exclusion',
      contractId: CONTRACT_ID,
      currentSalary: 636435,
      outgoingSalary: 0,
      incomingSalary: 0,
      poisonPillIncomingSalary: null,
    });
    expect(result.proof?.stateDigest).toMatch(/^fnv1a64:/);
    expect(result.canonLeafIds).toContain('CBA2-A02.14');
    const ordinary = resolve(
      state(rows, { signingDate: '2026-07-10' }),
      '2027-06-05'
    );
    expect(ordinary.status).toBe('needs-input');
  });
  it.each([
    [
      'expired',
      [row('2026-27', 636435)],
      '2026-07-10',
      '2027-06-05',
      /last Season of the Contract \(CBA2-L03.14\)/,
    ],
    [
      'missing-signing-date',
      [row('2026-27', 636435), row('2027-28', 650000)],
      null,
      '2027-06-05',
      /governed signing date/i,
    ],
    [
      'recent-signing',
      [row('2026-27', 636435), row('2027-28', 650000)],
      '2027-02-20',
      '2027-03-10',
      /thirty days/i,
    ],
    [
      'anniversary',
      [row('2026-27', 636435), row('2027-28', 650000)],
      '2027-02-20',
      '2027-03-22',
      /exact timing/i,
    ],
    [
      'after-deadline',
      [row('2026-27', 636435)],
      '2026-07-10',
      '2027-02-20',
      /through the last Regular Season game.*CBA2-L03.15/,
    ],
  ] as const)(
    'keeps %s Two-Way assignment unavailable',
    (_, rows, signingDate, date, reason) => {
      const result = resolve(
        state([...rows], { contractType: 'Two-Way', signingDate }),
        date
      );
      expect(result.status).toBe('needs-input');
      expect(result.reasons.join(' ')).toMatch(reason);
      expect(result.outgoingSalary).toBeNull();
    }
  );
  it('distinguishes missing continuing terms from a proved expiring Two-Way', () => {
    const contract = state([row('2026-27', 636435)], {
      contractType: 'Two-Way',
      signingDate: '2026-07-10',
    });
    const incomplete = makeResultingState({
      ...contract,
      terms: { ...contract.terms, endSeason: '2027-28' },
    });
    const result = resolve(incomplete, '2027-06-05');
    expect(result.status).toBe('needs-input');
    expect(result.reasons.join(' ')).toMatch(
      /missing next-season terms do not establish expiry/
    );
    expect(result.currentSalary).toBeNull();
  });
  it.each(['third-season', 'unknown-start', 'option-year'])(
    'withholds Two-Way authority for %s terms',
    (mode) => {
      const contract = state([row('2026-27', 636435), row('2027-28', 650000)], {
        contractType: 'Two-Way',
        signingDate: '2026-07-10',
      });
      const terms = structuredClone(contract.terms);
      if (mode === 'third-season') terms.startSeason = '2025-26';
      if (mode === 'unknown-start') terms.startSeason = null;
      if (mode === 'option-year') terms.salaries[1].option = 'TO';
      const result = resolve(
        makeResultingState({ ...contract, terms }),
        '2027-06-05'
      );
      expect(result.status).toBe('needs-input');
      expect(result.reasons.join(' ')).toMatch(
        mode === 'option-year' ? /Option Year/ : /one or two Seasons/
      );
      expect(result.outgoingSalary).toBeNull();
    }
  );
  it('uses exact protected and earned Base Compensation before January 8', () => {
    const contractState = state(
      [
        row('2026-27', 10_000_000, 6_000_000, [
          protectionStep('2027-01-10', 10_000_000),
        ]),
      ],
      {
        evidence: {
          evidenceVersion: 1,
          earnedBaseCompensation: [
            { season: '2026-27', asOfDate: '2026-12-15', amount: 4_000_000 },
          ],
          oneYearMinimum: null,
          poisonPill: null,
        },
      }
    );
    const result = resolve(contractState, '2026-12-15');

    expect(result).toMatchObject({
      status: 'ready',
      method: 'ordinary-protection',
      currentSalary: 10_000_000,
      outgoingSalary: 6_000_000,
      incomingSalary: 10_000_000,
      canonLeafIds: ['CBA2-A03.1'],
    });
    expect(result.proof?.stateDigest).toBe(contractState.stateDigest);
  });

  it('fails closed when partially protected in-season Salary lacks exact earned compensation', () => {
    const result = resolve(
      state([
        row('2026-27', 10_000_000, 6_000_000, [
          protectionStep('2027-01-10', 10_000_000),
        ]),
      ]),
      '2026-12-15'
    );

    expect(result.status).toBe('needs-input');
    expect(result.reasons.join(' ')).toContain(
      'exact earned Base Compensation'
    );
  });

  it('compares offset protection instants on their UTC date', () => {
    const result = resolve(
      state(
        [
          row('2026-27', 10_000_000, 2_000_000, [
            instantProtectionStep('2026-12-15T22:00:00-08:00', 8_000_000),
          ]),
        ],
        {
          evidence: {
            evidenceVersion: 1,
            earnedBaseCompensation: [
              { season: '2026-27', asOfDate: '2026-12-15', amount: 1_000_000 },
            ],
            oneYearMinimum: null,
            poisonPill: null,
          },
        }
      ),
      '2026-12-15'
    );

    expect(result.outgoingSalary).toBe(2_000_000);
  });

  it('changes only at the inclusive January 8 boundary', () => {
    const contractState = state(
      [
        row('2026-27', 10_000_000, 6_000_000, [
          protectionStep('2027-01-10', 10_000_000),
        ]),
      ],
      {
        evidence: {
          evidenceVersion: 1,
          earnedBaseCompensation: [
            { season: '2026-27', asOfDate: '2027-01-07', amount: 5_000_000 },
          ],
          oneYearMinimum: null,
          poisonPill: null,
        },
      }
    );

    expect(resolve(contractState, '2027-01-07')).toMatchObject({
      outgoingSalary: 6_000_000,
      method: 'ordinary-protection',
    });
    expect(resolve(contractState, '2027-01-08')).toMatchObject({
      outgoingSalary: 10_000_000,
      method: 'january-8-deemed-full',
      canonLeafIds: ['CBA2-A03.2'],
    });
  });

  it('uses the post-season lesser-of rule beginning the day after the last game', () => {
    const contractState = state([
      row('2026-27', 12_000_000),
      row('2027-28', 15_000_000, 10_000_000, [
        protectionStep('2027-06-30', 15_000_000),
      ]),
    ]);

    // The deadline day itself is before the 3 p.m. ET deadline.
    expect(resolve(contractState, '2027-02-11')).toMatchObject({
      outgoingSalary: 12_000_000,
      method: 'january-8-deemed-full',
    });
    expect(resolve(contractState, '2027-04-12')).toMatchObject({
      outgoingSalary: 10_000_000,
      method: 'postseason-lesser-of',
      canonLeafIds: ['CBA2-A03.1', 'CBA2-A03.3', 'CBA2-L03.14', 'CBA2-L03.15'],
    });
  });

  describe('trade deadline (V1 B7, named SIMULATION assumption)', () => {
    const optionRow = (used: boolean | null, option: 'PO' | 'ETO' = 'PO') => ({
      ...row('2027-28', 15_000_000),
      option,
      optionHolder: 'player' as const,
      optionUsed: used,
    });

    it('stops all trades from the deadline to the last Regular Season game (CBA2-L03.15)', () => {
      const contractState = state([
        row('2026-27', 12_000_000),
        row('2027-28', 15_000_000),
      ]);
      expect(resolve(contractState, '2027-02-11').status).toBe('ready');
      for (const date of ['2027-02-12', '2027-04-11']) {
        const result = resolve(contractState, date);
        expect(result.status).toBe('needs-input');
        expect(result.reasons.join(' ')).toMatch(/2027-02-11.*CBA2-L03.15/);
      }
      expect(resolve(contractState, '2027-04-12').status).toBe('ready');
    });

    it('refuses the last or possible last Season after the deadline (CBA2-L03.14)', () => {
      const expiring = state([row('2026-27', 12_000_000)]);
      expect(resolve(expiring, '2027-02-11').status).toBe('ready');
      const june = resolve(expiring, '2027-06-05');
      expect(june.status).toBe('needs-input');
      expect(june.reasons.join(' ')).toMatch(
        /last Season of the Contract \(CBA2-L03.14\)/
      );

      const undecided = resolve(
        state([row('2026-27', 12_000_000), optionRow(null)]),
        '2027-06-05'
      );
      expect(undecided.status).toBe('needs-input');
      expect(undecided.reasons.join(' ')).toMatch(/PO is undecided/);

      // Once exercised, this is no longer a possible last Season.
      expect(
        resolve(
          state([row('2026-27', 12_000_000), optionRow(true)]),
          '2027-06-05'
        ).status
      ).toBe('ready');

      // A declined Player Option ends the Contract: a certain last Season.
      const declined = resolve(
        state([row('2026-27', 12_000_000), optionRow(false)]),
        '2027-06-05'
      );
      expect(declined.status).toBe('needs-input');
      expect(declined.reasons.join(' ')).toMatch(
        /last Season of the Contract \(CBA2-L03.14\)/
      );
    });

    it('reads an ETO in its own direction: exercising ends the Contract, declining continues it', () => {
      const at = (used: boolean | null) =>
        resolve(
          state([row('2026-27', 12_000_000), optionRow(used, 'ETO')]),
          '2027-06-05'
        );
      expect(at(null).status).toBe('needs-input');
      expect(at(null).reasons.join(' ')).toMatch(/ETO is undecided/);
      expect(at(false).status).toBe('ready');
      expect(at(true).status).toBe('needs-input');
      expect(at(true).reasons.join(' ')).toMatch(
        /last Season of the Contract \(CBA2-L03.14\)/
      );
    });

    it('names the deadline as a SIMULATION assumption in the result and the refusal', () => {
      const contractState = state([
        row('2026-27', 12_000_000),
        row('2027-28', 15_000_000),
      ]);
      const before = resolve(contractState, '2027-01-08');
      expect(before.status).toBe('ready');
      expect(before.assumptionIds).toEqual(['simulation-trade-deadline']);
      const blocked = resolve(contractState, '2027-03-01');
      expect(blocked.assumptionIds).toEqual(['simulation-trade-deadline']);
      expect(blocked.reasons.join(' ')).toMatch(
        /2027-02-11, 3 p\.m\. ET, a SIMULATION assumption; a trade dated that day counts as before it/
      );
    });
  });

  it('includes authenticated League reimbursement for a one-year Minimum Contract', () => {
    const contractState = state(
      [row('2026-27', 3_000_000, 0, [protectionStep('2027-01-10', 3_000_000)])],
      {
        signedUsing: 'Minimum Salary Exception',
        contractLength: 1,
        evidence: {
          evidenceVersion: 1,
          earnedBaseCompensation: [
            { season: '2026-27', asOfDate: '2026-12-15', amount: 1_000_000 },
          ],
          oneYearMinimum: {
            qualifies: true,
            leagueReimbursedUnearnedPortion: 500_000,
          },
          poisonPill: null,
        },
      }
    );
    const result = resolve(contractState, '2026-12-15');

    expect(result.outgoingSalary).toBe(1_500_000);
    expect(result.canonLeafIds).toEqual(['CBA2-A03.12', 'CBA2-A03.1']);
  });

  it('does not invent bonus or trade-bonus treatment outside the tranche', () => {
    const bonusRow = row('2026-27', 10_000_000);
    bonusRow.incentives.likely = 250_000;
    const bonus = resolve(state([bonusRow]), '2027-01-08');
    const kicker = resolve(
      state([row('2026-27', 10_000_000)], { tradeKickerPercent: 0.15 }),
      '2027-01-08'
    );

    expect(bonus.status).toBe('needs-input');
    expect(bonus.reasons.join(' ')).toContain('bonus compensation');
    expect(kicker.status).toBe('needs-input');
    expect(kicker.reasons.join(' ')).toContain('trade bonus');
  });
});

describe('2025-26 zero/one-YOS Minimum uplift', () => {
  const calendar2026: GovernedCalendarResolution = {
    ...calendar,
    seasonKey: '2025-26',
    regularSeasonOpening: {
      ...calendar.regularSeasonOpening!,
      value: '2025-10-21',
    },
    regularSeasonClosing: {
      ...calendar.regularSeasonClosing!,
      value: '2026-04-12',
    },
  };
  const at = (salary: number) => {
    const contractState = state(
      [row('2025-26', salary), row('2026-27', 2_411_090)],
      {
        signedUsing: 'Minimum Salary Exception',
        contractLength: 2,
      }
    );
    return resolveGovernedTradeSalaryBasis({
      contractState,
      contractManifest: {
        ...manifest(contractState),
        salaryCapYear: 2026,
        seasonKey: '2025-26',
      },
      calendar: calendar2026,
      worldId: WORLD_ID,
      teamId: TEAM_ID,
      playerId: PLAYER_ID,
      asOfDate: '2026-06-05',
      salaryCapYear: 2026,
    });
  };

  it('matches a Contract carrying an Apron uplift at its Salary; the uplift moves in the books', () => {
    const uplift = at(623_967);
    expect(uplift.status).toBe('ready');
    expect(uplift.outgoingSalary).toBe(623_967);
    expect(uplift.incomingSalary).toBe(623_967);
    expect(at(857_804).status).toBe('ready');
  });

  it('marks a two-Season, bonus-free Minimum Exception Contract as acquirable with the Minimum Exception', () => {
    expect(at(623_967).minimumExceptionAcquisition).toBe(true);
    const longer = state(
      [
        row('2025-26', 623_967),
        row('2026-27', 2_411_090),
        row('2027-28', 2_500_000),
      ],
      { signedUsing: 'Minimum Salary Exception', contractLength: 3 }
    );
    const result = resolveGovernedTradeSalaryBasis({
      contractState: longer,
      contractManifest: {
        ...manifest(longer),
        salaryCapYear: 2026,
        seasonKey: '2025-26',
      },
      calendar: calendar2026,
      worldId: WORLD_ID,
      teamId: TEAM_ID,
      playerId: PLAYER_ID,
      asOfDate: '2026-06-05',
      salaryCapYear: 2026,
    });
    expect(result.status).toBe('ready');
    expect(result.minimumExceptionAcquisition).toBeUndefined();
    // Seasons left, counting the current Salary Cap Year (exception paths).
    expect(at(623_967).contractSeasonsRemaining).toBe(2);
    expect(result.contractSeasonsRemaining).toBe(3);
  });
});

describe('governed poison-pill incoming basis', () => {
  const extensionSignedAt = '2026-10-01T12:00:00-04:00';

  it('averages the original final year with every fixed extended year only before the boundary', () => {
    const contractState = state(
      [
        row('2026-27', 10_000_000),
        row('2027-28', 20_000_000),
        row('2028-29', 22_000_000),
        row('2029-30', 24_000_000),
      ],
      {
        isExtension: true,
        isRookieScale: true,
        evidence: {
          evidenceVersion: 1,
          earnedBaseCompensation: [],
          oneYearMinimum: null,
          poisonPill: {
            rookieScaleExtendedUnderVii7b: true,
            extensionSignedAt,
            firstFollowingSalaryCapYearStartsAt: '2027-07-01T00:00:00-04:00',
            originalLastSeason: '2026-27',
            extendedTerms: [
              fixed('2027-28', 20_000_000),
              fixed('2028-29', 22_000_000),
              fixed('2029-30', 24_000_000),
            ],
          },
        },
      }
    );

    const active = resolve(contractState, '2027-02-01', {
      extensionEffectiveAt: extensionSignedAt,
    });
    const expired = resolve(contractState, '2027-04-12', {
      extensionEffectiveAt: extensionSignedAt,
    });
    expect(active.poisonPillIncomingSalary).toBe(19_000_000);
    expect(active.canonLeafIds).toContain('CBA2-A03.5');
    // Still before July 1; post-season changes outgoing, not poison-pill timing.
    expect(expired.poisonPillIncomingSalary).toBe(19_000_000);
  });

  it('uses 104.5% Cap, no Higher Max credit, and the over-maximum deemed amendment', () => {
    const contractState = state(
      [row('2026-27', 10_000_000), row('2027-28', 51_000_000)],
      {
        isExtension: true,
        isRookieScale: true,
        evidence: {
          evidenceVersion: 1,
          earnedBaseCompensation: [],
          oneYearMinimum: null,
          poisonPill: {
            rookieScaleExtendedUnderVii7b: true,
            extensionSignedAt,
            firstFollowingSalaryCapYearStartsAt: '2027-07-01T00:00:00-04:00',
            originalLastSeason: '2026-27',
            extendedTerms: [
              {
                season: '2027-28',
                salaryBasis: 'percentage-of-assumed-cap',
                fixedSalary: null,
                salaryPercentage: 0.25,
                unlikelyBonuses: 2_000_000,
                applicableMaximumAnnualSalary: 35_000_000,
              },
            ],
          },
        },
      }
    );
    const result = resolve(contractState, '2027-02-01', {
      extensionEffectiveAt: extensionSignedAt,
      salaryCapAtTrade: 164_961_000,
    });

    expect(result.poisonPillIncomingSalary).toBe(21_500_000);
    expect(result.canonLeafIds).toEqual([
      'CBA2-A03.2',
      'CBA2-A03.5',
      'CBA2-A03.6',
      'CBA2-A03.10',
      'CBA2-A03.14',
    ]);
  });

  it('rejects a Higher Max percentage and missing governed Cap', () => {
    const evidence = {
      evidenceVersion: 1 as const,
      earnedBaseCompensation: [],
      oneYearMinimum: null,
      poisonPill: {
        rookieScaleExtendedUnderVii7b: true,
        extensionSignedAt,
        firstFollowingSalaryCapYearStartsAt: '2027-07-01T00:00:00-04:00',
        originalLastSeason: '2026-27',
        extendedTerms: [
          {
            season: '2027-28',
            salaryBasis: 'percentage-of-assumed-cap' as const,
            fixedSalary: null,
            salaryPercentage: 0.3,
            unlikelyBonuses: 0,
            applicableMaximumAnnualSalary: 60_000_000,
          },
        ],
      },
    };
    const contractState = state(
      [row('2026-27', 10_000_000), row('2027-28', 51_000_000)],
      { isExtension: true, isRookieScale: true, evidence }
    );

    const higherMax = resolve(contractState, '2027-02-01', {
      extensionEffectiveAt: extensionSignedAt,
      salaryCapAtTrade: 164_961_000,
    });
    const noCapState = state(
      [row('2026-27', 10_000_000), row('2027-28', 51_000_000)],
      {
        isExtension: true,
        isRookieScale: true,
        evidence: {
          ...evidence,
          poisonPill: {
            ...evidence.poisonPill,
            extendedTerms: [
              {
                ...evidence.poisonPill.extendedTerms[0],
                salaryPercentage: 0.25,
              },
            ],
          },
        },
      }
    );
    const noCap = resolve(noCapState, '2027-02-01', {
      extensionEffectiveAt: extensionSignedAt,
    });

    expect(higherMax.status).toBe('needs-input');
    expect(noCap.status).toBe('needs-input');
  });
});

describe('saved-world validation trust boundary', () => {
  it('rejects a missing Team identity before loading world authority', async () => {
    await expect(
      loadWorldGovernedTradeSalaryBasisEntries({
        worldId: WORLD_ID,
        teamId: '   ',
        rosterPlayerIds: [PLAYER_ID],
        worldAsOfDate: '2027-01-08',
        salaryCapYear: YEAR,
      })
    ).rejects.toThrow('requires a Team identity');
  });

  it('uses ready authority and rejects a byte-identical player with a different world identity', () => {
    const authority = resolve(
      state([row('2026-27', 10_000_000)]),
      '2027-01-08'
    );
    const player: MatchingValuePlayer = {
      id: PLAYER_ID,
      salary: 1,
      governedTradeSalaryBasis: authority,
    };
    const accepted = computeMatchingValues({
      teams: [{ teamId: TEAM_ID, sends: [player] }],
      yearKey: '2026-27',
      worldId: WORLD_ID,
      asOfDate: '2027-01-08',
      requireGovernedSalaryBasis: true,
    });
    const tampered = computeMatchingValues({
      teams: [{ teamId: TEAM_ID, sends: [{ ...player }] }],
      yearKey: YEAR,
      worldId: 'other-world',
      asOfDate: '2027-01-08',
      requireGovernedSalaryBasis: true,
    });

    expect(accepted.salaryBasisIssues).toEqual([]);
    expect(player.matchOutgoing).toBe(10_000_000);
    expect(tampered.salaryBasisIssues[0]?.reason).toContain('does not match');
  });

  it('never falls back to legacy salary when sign-and-trade authority is malformed', () => {
    const player: MatchingValuePlayer = {
      id: PLAYER_ID,
      salary: 99_000_000,
      signAndTrade: true,
      governedSignAndTradeAuthority: { status: 'forged' } as never,
    };

    const result = computeMatchingValues({
      teams: [{ teamId: TEAM_ID, sends: [player] }],
      yearKey: '2026-27',
      worldId: WORLD_ID,
      asOfDate: '2027-01-08',
      requireGovernedSalaryBasis: true,
    });

    expect(result.salaryBasisIssues[0]?.reason).toContain(
      'missing or malformed'
    );
    expect(player.matchOutgoing).toBe(0);
    expect(player.matchIncoming).toBe(0);
  });

  it('treats equivalent team identity casing as the same governed team', () => {
    const authority = resolve(
      state([row('2026-27', 10_000_000)]),
      '2027-01-08'
    );
    const result = computeMatchingValues({
      teams: [
        {
          teamId: TEAM_ID.toLowerCase(),
          sends: [
            {
              id: PLAYER_ID,
              salary: 1,
              governedTradeSalaryBasis: authority,
            },
          ],
        },
      ],
      yearKey: '2026-27',
      worldId: WORLD_ID,
      asOfDate: '2027-01-08',
      requireGovernedSalaryBasis: true,
    });

    expect(result.salaryBasisIssues).toEqual([]);
  });

  it('preserves unmatched roster players without an undefined authority key', () => {
    const player = { playerId: PLAYER_ID, name: 'Fixture Player' };
    const [unmatched] = attachGovernedTradeSalaryBasisToRoster(
      [player],
      new Map()
    );

    expect(resolveTradeSalaryBasisPlayerId(player)).toBe(PLAYER_ID);
    expect(
      resolveTradeSalaryBasisPlayerId({ bio: { playerId: PLAYER_ID } })
    ).toBe(PLAYER_ID);
    expect(unmatched).toBe(player);
    expect('governedTradeSalaryBasis' in unmatched).toBe(false);
  });

  it('carries proof through apply validation but strips it from mutable player persistence', () => {
    const authority = resolve(
      state([row('2026-27', 10_000_000)]),
      '2027-01-08'
    );
    const normalized = normalizeTradeContextPayload({
      teams: [
        {
          teamCode: TEAM_ID,
          sends: [
            {
              player_id: PLAYER_ID,
              tradeTo: 'LAL',
              governedTradeSalaryBasis: authority,
            },
          ],
        },
        { teamCode: 'LAL', sends: [] },
      ],
    });
    const persistencePlayer = normalizeCurrentStatePlayerSnapshot({
      player_id: PLAYER_ID,
      teamCode: 'LAL',
      governedTradeSalaryBasis: authority,
    });

    expect(normalized.teams[0].sends[0].governedTradeSalaryBasis).toEqual(
      authority
    );
    expect(persistencePlayer).not.toHaveProperty('governedTradeSalaryBasis');
  });

  it('replaces a payload salary receipt with live current-state authority at apply time', () => {
    const authority = resolve(
      state([row('2026-27', 10_000_000)]),
      '2027-01-08'
    );
    const forged = { ...authority, outgoingSalary: 1, incomingSalary: 1 };
    const fromLiveState = buildTradeValidationPlayer({
      player: {
        player_id: PLAYER_ID,
        governedTradeSalaryBasis: forged,
      },
      sourceTeamState: {
        [Symbol.for('scoutzero.liveGovernedTradeSalaryAuthority')]: true,
        players: [
          { player_id: PLAYER_ID, governedTradeSalaryBasis: authority },
        ],
      },
    });
    const withoutLiveState = buildTradeValidationPlayer({
      player: {
        player_id: PLAYER_ID,
        governedTradeSalaryBasis: forged,
      },
      sourceTeamState: {
        [Symbol.for('scoutzero.liveGovernedTradeSalaryAuthority')]: true,
        players: [{ player_id: PLAYER_ID }],
      },
    });

    expect(fromLiveState.governedTradeSalaryBasis).toEqual(authority);
    expect(withoutLiveState).not.toHaveProperty('governedTradeSalaryBasis');
  });

  it('finds a prior-team Contract overlay but rejects duplicate ownership', () => {
    const overlay = {
      payloadVersion: 2 as const,
      ledgerId: 'ledger-prior-team',
      ledgerVersion: 1,
      events: [signingEvent()],
    };
    const unique = collectUniqueWorldContractEventLedgers([
      { teamCode: 'LAL', contractEventLedgers: [] },
      { teamCode: 'BOS', contractEventLedgers: [overlay] },
    ]);

    expect(unique.get(overlay.ledgerId)).toEqual(overlay);
    expect(() =>
      collectUniqueWorldContractEventLedgers([
        { teamCode: 'LAL', contractEventLedgers: [overlay] },
        { teamCode: 'BOS', contractEventLedgers: [overlay] },
      ])
    ).toThrow('owned by more than one Team snapshot');
  });
});

function fixed(season: string, salary: number) {
  return {
    season,
    salaryBasis: 'fixed' as const,
    fixedSalary: salary,
    salaryPercentage: null,
    unlikelyBonuses: 0,
    applicableMaximumAnnualSalary: salary,
  };
}
