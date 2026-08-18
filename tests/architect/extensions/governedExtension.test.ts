import { describe, expect, it } from 'vitest';

import type { ContractEventLedgerPayload } from '@/schemas/contractEventLedger';
import type {
  ContractSalaryTerm,
  GovernedContractState,
} from '@/schemas/governedContractState';
import type {
  GovernedExtensionContractEvidence,
  GovernedExtensionLeagueEvidence,
  GovernedExtensionProposal,
  GovernedExtensionRoute,
} from '@/schemas/governedExtension';
import {
  decideGovernedExtension,
  inspectGovernedExtension,
  resolveGovernedExtensionLedgerAuthority,
} from '@/features/architect/utils/extensions';
import {
  createContractEventLedger,
  projectContractStateAsOf,
  toContractEventLedgerPayload,
} from '@/features/architect/utils/contractHistory';
import { deterministicStateDigest } from '@/features/architect/utils/contractSource';
import {
  computeWorldMutation,
  persistWorldMutation,
} from '@/features/architect/utils/mutationPipeline';
import {
  makeEvent,
  makeResultingState,
} from '../contractHistory/contractHistoryFixtures';
import {
  createMockWorld,
  getMockTeamSnapshot,
  seedBaseData,
  seedTeamSnapshot,
  seedWorldMetadata,
  type MockTeam,
} from '../../helpers/architectTestHelpers';
import { getAllMockData, seedMockData } from '../../__mocks__/firebase';
import { mutationSnapshotDigest } from '@/features/architect/utils/mutationPipeline.snapshotDigest';

const WORLD_ID = 'world-bze-282';
const PARENT_WORLD_ID = 'parent-world-bze-282';
const TEAM_ID = 'MIA';
const PLAYER_ID = 'player-bze-282';
const CONTRACT_ID = 'contract-bze-282';
const WORLD_DATE = '2026-10-20';
const SIGNED_AT = '2026-10-19T18:00:00-04:00';

const instant = (value: string) => ({
  precision: 'instant' as const,
  value,
  rawValue: value,
});
const date = (value: string) => ({
  precision: 'date' as const,
  value,
  rawValue: value,
});
const unknown = () => ({
  precision: 'unknown' as const,
  value: null,
  rawValue: null,
});

function salaryRow(
  season: string,
  regularSalary: number,
  option: 'TO' | 'PO' | 'ETO' | null = null,
  optionUsed: boolean | null = null
): ContractSalaryTerm {
  return {
    season,
    salary: regularSalary,
    capHit: regularSalary,
    guaranteed: true,
    guaranteedAmount: regularSalary,
    option,
    optionHolder: option === 'TO' ? 'team' : option ? 'player' : null,
    optionUsed,
    optionDecisionDate: unknown(),
    optionDecisionDeadline: unknown(),
    optionDecisionTerms: null,
    tradeBonus: null,
    incentives: { likely: 0, unlikely: 0, criteriaEvidence: 'known' },
    guaranteeSchedule: [],
    voidedByExtension: false,
    voidedOn: unknown(),
  };
}

function sourceIdentity() {
  return {
    releaseId: 'fixture-release',
    releaseVersion: 1,
    releaseDigest: `sha256:${'1'.repeat(64)}`,
    sourceProvider: 'fixture',
    sourceRecordVersion: '1',
    sourceObservationId: 'fixture-observation',
    sourceArtifactSha256: `sha256:${'2'.repeat(64)}`,
    sourceContractPath: 'contract' as const,
  };
}

function contractEvidence(
  rows: readonly ContractSalaryTerm[],
  route: GovernedExtensionRoute
): GovernedExtensionContractEvidence {
  return {
    evidenceVersion: 1,
    status: 'known',
    observedAt: date('2026-07-01'),
    sourceIdentity: sourceIdentity(),
    transactionHistoryComplete: true,
    originalSignedAt: instant('2023-07-01T12:00:00-04:00'),
    yearsOfServiceAtFirstExtendedSeason:
      route === 'rookie-scale' ? 4 : route === 'designated-veteran' ? 8 : 9,
    projectedQvfaAtOriginalExpiry: route === 'rookie-scale' ? null : true,
    seasonsPlayedForCurrentTeam: route === 'veteran' ? 9 : 8,
    designatedTeamRoute:
      route === 'designated-veteran' ? 'original-team' : null,
    latestRenegotiationAt: unknown(),
    latestRenegotiationSalaryIncreasePercent: null,
    fourthSeasonFirstGameAt:
      route === 'rookie-scale'
        ? instant('2026-10-20T19:00:00-04:00')
        : unknown(),
    originalCompensation: rows.map((row) => ({
      season: row.season!,
      salaryExcludingIncentive: row.salary!,
      regularSalary: row.salary!,
      bonuses: [],
    })),
    awardEvidence: {
      status: route === 'designated-veteran' ? 'known' : 'unknown',
      achievement: route === 'designated-veteran' ? 'MVP' : null,
      achievementSeason: route === 'designated-veteran' ? '2025-26' : null,
      qualificationWindowSatisfied:
        route === 'designated-veteran' ? true : null,
      gameThresholdStatus:
        route === 'designated-veteran' ? 'satisfied' : 'unknown',
      determinationId: null,
    },
  };
}

function leagueEvidence(): GovernedExtensionLeagueEvidence {
  return {
    evidenceVersion: 1,
    status: 'known',
    signingSalaryCapYear: 2027,
    firstExtendedSalaryCapYear: 2028,
    salaryCap: 180_000_000,
    estimatedAveragePlayerSalary: 22_000_000,
    moratoriumEndsAt: instant('2026-07-07T12:00:00-04:00'),
    regularSeasonFirstDay: date('2026-10-20'),
    source: {
      provider: 'governed-fixture',
      sourceUrl: 'fixture://league-values',
      retainedArtifactPath: 'tests/fixtures/architect/extension-league.txt',
      artifactSha256: `sha256:${'3'.repeat(64)}`,
      artifactBytes: 128,
      retrievedAt: '2026-07-01T09:00:00-04:00',
    },
  };
}

function baselineFor(
  route: GovernedExtensionRoute,
  options: {
    omitEvidence?: boolean;
    contractEvidence?: Partial<GovernedExtensionContractEvidence>;
    leagueEvidence?: Partial<GovernedExtensionLeagueEvidence>;
  } = {}
): ContractEventLedgerPayload {
  const isRookie = route === 'rookie-scale';
  const rows = [
    salaryRow('2023-24', 17_000_000, isRookie ? 'TO' : null, isRookie ? true : null),
    salaryRow('2024-25', 18_000_000, isRookie ? 'TO' : null, isRookie ? true : null),
    salaryRow('2025-26', 19_000_000),
    salaryRow('2026-27', 20_000_000),
  ];
  const base = makeResultingState({
    contractId: CONTRACT_ID,
    contractVersion: 1,
    playerId: PLAYER_ID,
    teamId: TEAM_ID,
    establishmentKind: 'source-establishment',
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { stateDigest: _baseDigest, ...baseWithoutDigest } = base;
  const evidence = {
    ...contractEvidence(rows, route),
    ...(options.contractEvidence || {}),
  };
  const league = {
    ...leagueEvidence(),
    ...(options.leagueEvidence || {}),
  };
  const stateWithoutDigest: Omit<GovernedContractState, 'stateDigest'> = {
    ...baseWithoutDigest,
    terms: {
      ...base.terms,
      contractType: isRookie ? 'ROOKIE SCALE CONTRACT' : 'VETERAN CONTRACT',
      isRookieScale: isRookie,
      signingTeam: TEAM_ID,
      signingDate: instant('2023-07-01T12:00:00-04:00'),
      startSeason: rows[0].season,
      endSeason: rows.at(-1)!.season,
      contractLength: rows.length,
      salaries: rows,
      totalValue: 74_000_000,
      averageAnnualValue: 18_500_000,
      guaranteedValue: 74_000_000,
      guaranteedYears: 4,
      birdRights: {
        status: 'Full Bird',
        yearsOfService:
          route === 'rookie-scale' ? 4 : route === 'designated-veteran' ? 8 : 9,
        yearsWithTeam: route === 'veteran' ? 9 : 8,
        eligibleFor: ['Veteran Extension'],
      },
      freeAgency: {
        ...base.terms.freeAgency,
        type: 'UFA',
        year: 2027,
      },
      ...(options.omitEvidence
        ? {}
        : {
            extensionEvidence: evidence,
            extensionLeagueEvidence: league,
          }),
    },
    completeness: { status: 'complete', reasons: [] },
  };
  const state = {
    ...stateWithoutDigest,
    stateDigest: deterministicStateDigest(stateWithoutDigest),
  };
  const root = makeEvent({
    eventId: 'source-bze-282',
    eventKind: 'source-establishment',
    worldId: WORLD_ID,
    contractId: CONTRACT_ID,
    playerId: PLAYER_ID,
    teamId: TEAM_ID,
    executedAt: '2026-07-01T00:00:00-04:00',
    effectiveAt: '2026-07-01T00:00:00-04:00',
    recordedAt: '2026-07-01T00:01:00-04:00',
    predecessorContractVersion: null,
    predecessorEventId: null,
    resultingContractVersion: 1,
    resultingState: state,
  });
  return toContractEventLedgerPayload(
    createContractEventLedger({
      ledgerId: 'contract-ledger-bze-282',
      ledgerVersion: 1,
      events: [root],
    })
  );
}

function salaries(
  route: GovernedExtensionRoute
): GovernedExtensionProposal['salariesByYear'] {
  const first =
    route === 'rookie-scale'
      ? 45_000_000
      : route === 'designated-veteran'
        ? 57_600_000
        : 30_800_000;
  const count = route === 'rookie-scale' ? 5 : route === 'designated-veteran' ? 5 : 4;
  const change = first * 0.08;
  return Array.from({ length: count }, (_, index) => ({
    season: `${2027 + index}-${String((28 + index) % 100).padStart(2, '0')}`,
    salaryExcludingIncentive: first + change * index,
    regularSalary: first + change * index,
    bonuses: [],
    guaranteed: true,
    option: null,
  }));
}

function proposal(route: GovernedExtensionRoute): GovernedExtensionProposal {
  return {
    proposalVersion: 1,
    contractId: CONTRACT_ID,
    route,
    signedAt: SIGNED_AT,
    conditionalHigherMaxPercentage: null,
    agreedDesignatedVeteranPercentage:
      route === 'designated-veteran' ? 32 : null,
    salariesByYear: salaries(route),
  };
}

function withUniformCompensation({
  proposal: input,
  regularSalary,
  bonusAmount,
  classification,
}: {
  proposal: GovernedExtensionProposal;
  regularSalary: number;
  bonusAmount: number;
  classification: 'likely' | 'unlikely';
}): GovernedExtensionProposal {
  return {
    ...input,
    salariesByYear: input.salariesByYear.map((row) => ({
      ...row,
      salaryExcludingIncentive: regularSalary,
      regularSalary,
      bonuses: [
        {
          bonusId: `${classification}-boundary`,
          classification,
          amount: bonusAmount,
        },
      ],
    })),
  };
}

function request(
  route: GovernedExtensionRoute,
  options: {
    baseline?: ContractEventLedgerPayload;
    proposal?: GovernedExtensionProposal;
  } = {}
) {
  return {
    authority: resolveGovernedExtensionLedgerAuthority({
      baselineLedger: options.baseline ?? baselineFor(route),
      baselineSalaryCapYear: 2027,
    }),
    worldId: WORLD_ID,
    teamId: TEAM_ID,
    playerId: PLAYER_ID,
    contractId: CONTRACT_ID,
    worldAsOfDate: WORLD_DATE,
    proposal: options.proposal ?? proposal(route),
    operationId: `operation-${route}`,
    authoringIdentity: 'user-bze-282',
    recordedAt: '2026-10-19T18:01:00-04:00',
  };
}

describe('governed Full Cap Table extension routes', () => {
  it.each(['rookie-scale', 'veteran', 'designated-veteran'] as const)(
    'appends a replayable immutable %s Extension event at exact evidenced terms',
    (route) => {
      const input = request(route);
      const before = JSON.stringify(input);
      const result = decideGovernedExtension(input);
      expect(result.success, JSON.stringify(result)).toBe(true);
      expect(JSON.stringify(input)).toBe(before);
      if (!result.success) return;
      expect(result.route).toBe(route);
      expect(result.event.eventKind).toBe('extension');
      expect(result.event.executedAt).toBe(SIGNED_AT);
      expect(result.event.resultingContractVersion).toBe(2);
      expect(result.ledger.ledgerVersion).toBe(2);
      expect(result.contractState.terms.salaries).toHaveLength(
        4 + proposal(route).salariesByYear.length
      );
      expect(result.manifest.resultingStateDigest).toBe(
        result.contractState.stateDigest
      );
      const replay = projectContractStateAsOf({
        ledger: result.ledger,
        worldId: WORLD_ID,
        contractId: CONTRACT_ID,
        asOfDate: '2026-10-19T18:01:00-04:00',
        salaryCapYear: 2027,
      });
      expect(replay.state).toBe('projected');
      expect(replay.contractState?.stateDigest).toBe(
        result.contractState.stateDigest
      );
    }
  );

  it('persists the exact one-year Designated Veteran trade restriction', () => {
    const result = decideGovernedExtension(request('designated-veteran'));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.contractState.terms.restrictions.canBeTradedNow).toBe(false);
    expect(result.contractState.terms.restrictions.restrictedUntil.value).toBe(
      '2027-10-19T22:00:00.000Z'
    );
    expect(result.event.canonLeafIds).toContain('CBA2-C16.31');
  });

  it('retains a pending Rookie Scale Higher Max clause without assuming the future award result', () => {
    const conditional = proposal('rookie-scale');
    conditional.conditionalHigherMaxPercentage = 30;

    const result = decideGovernedExtension(
      request('rookie-scale', { proposal: conditional })
    );

    expect(result.success, JSON.stringify(result)).toBe(true);
    if (!result.success) return;
    expect(result.contractState.terms.extensionHigherMax).toEqual({
      percentage: 30,
      status: 'pending',
      firstExtendedSalaryCapYear: 2028,
      determinationId: null,
      resolutionEventId: null,
    });
  });

  it('applies and retains a Higher Max already qualified at signing', () => {
    const conditional = proposal('rookie-scale');
    conditional.conditionalHigherMaxPercentage = 30;
    conditional.salariesByYear = conditional.salariesByYear.map(
      (row, index) => ({
        ...row,
        salaryExcludingIncentive: 54_000_000 + 4_320_000 * index,
        regularSalary: 54_000_000 + 4_320_000 * index,
      })
    );
    const result = decideGovernedExtension(
      request('rookie-scale', {
        proposal: conditional,
        baseline: baselineFor('rookie-scale', {
          contractEvidence: {
            awardEvidence: {
              status: 'known',
              achievement: 'ALL_NBA',
              achievementSeason: '2025-26',
              qualificationWindowSatisfied: true,
              gameThresholdStatus: 'satisfied',
              determinationId: 'award-determination-bze-282',
            },
          },
        }),
      })
    );

    expect(result.success, JSON.stringify(result)).toBe(true);
    if (!result.success) return;
    expect(result.contractState.terms.extensionHigherMax).toMatchObject({
      percentage: 30,
      status: 'qualified-at-signing',
      determinationId: 'award-determination-bze-282',
    });
  });
});

describe('workflow-specific failure matrix', () => {
  it('fails closed when the retained baseline does not carry extension evidence', () => {
    const baseline = baselineFor('veteran', { omitEvidence: true });
    const availability = inspectGovernedExtension({
      authority: resolveGovernedExtensionLedgerAuthority({
        baselineLedger: baseline,
        baselineSalaryCapYear: 2027,
      }),
      worldAsOfDate: WORLD_DATE,
      playerId: PLAYER_ID,
      contractId: CONTRACT_ID,
    });
    expect(availability.status).toBe('needs-input');
    expect(availability.reasons.join(' ')).toMatch(
      /extension evidence.*league calendar/i
    );
  });

  it('rejects unauthenticated and contradictory retained evidence', () => {
    const unauthenticated = decideGovernedExtension(
      request('veteran', {
        baseline: baselineFor('veteran', {
          contractEvidence: {
            sourceIdentity: {
              ...sourceIdentity(),
              sourceObservationId: 'different-observation',
            },
          },
        }),
      })
    );
    expect(unauthenticated.success).toBe(false);
    if (!unauthenticated.success) {
      expect(unauthenticated.status).toBe('incompatible');
      expect(unauthenticated.reasons.join(' ')).toMatch(/unauthenticated/i);
    }

    const conflicting = decideGovernedExtension(
      request('veteran', {
        baseline: baselineFor('veteran', {
          contractEvidence: { status: 'conflicting' },
        }),
      })
    );
    expect(conflicting.success).toBe(false);
    if (!conflicting.success) expect(conflicting.status).toBe('incompatible');
  });

  it('rejects the Rookie Scale deadline by one second', () => {
    const late = proposal('rookie-scale');
    late.signedAt = '2026-10-19T18:00:01-04:00';
    const result = decideGovernedExtension(
      request('rookie-scale', { proposal: late })
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reasons.join(' ')).toMatch(/after .*18:00:00/i);
  });

  it('rejects first-year and each independent 8% annual-change basis by one cent', () => {
    const tooRich = proposal('veteran');
    tooRich.salariesByYear[0].salaryExcludingIncentive += 0.01;
    tooRich.salariesByYear[0].regularSalary += 0.01;
    const firstYear = decideGovernedExtension(
      request('veteran', { proposal: tooRich })
    );
    expect(firstYear.success).toBe(false);
    if (!firstYear.success) {
      expect(firstYear.reasons.join(' ')).toMatch(/controlling Veteran Extension ceiling/i);
    }

    const raise = proposal('veteran');
    raise.salariesByYear[1].regularSalary += 0.01;
    const annual = decideGovernedExtension(
      request('veteran', { proposal: raise })
    );
    expect(annual.success).toBe(false);
    if (!annual.success) expect(annual.reasons.join(' ')).toMatch(/Regular Salary changes/i);
  });

  it('rejects one cent of Designated Veteran incentive compensation', () => {
    const withBonus = proposal('designated-veteran');
    withBonus.salariesByYear[0].bonuses = [
      { bonusId: 'award-bonus', classification: 'unlikely', amount: 0.01 },
    ];
    const result = decideGovernedExtension(
      request('designated-veteran', { proposal: withBonus })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reasons.join(' ')).toMatch(/may not include Incentive Compensation/i);
    }
  });

  it('counts the active original Season for an in-season Veteran aggregate-term limit', () => {
    const inSeason = proposal('veteran');
    inSeason.signedAt = '2027-01-14T18:00:00-05:00';
    const last = inSeason.salariesByYear.at(-1)!;
    inSeason.salariesByYear.push({
      ...last,
      season: '2031-32',
      salaryExcludingIncentive: last.salaryExcludingIncentive * 1.08,
      regularSalary: last.regularSalary * 1.08,
    });

    const result = decideGovernedExtension({
      ...request('veteran', { proposal: inSeason }),
      worldAsOfDate: '2027-01-15',
      recordedAt: '2027-01-14T18:01:00-05:00',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reasons.join(' ')).toMatch(/no more than five aggregate Seasons/i);
    }
  });

  it('counts the active original Season for an in-season Designated Veteran term', () => {
    const inSeason = proposal('designated-veteran');
    inSeason.signedAt = '2027-01-14T18:00:00-05:00';

    const result = decideGovernedExtension({
      ...request('designated-veteran', { proposal: inSeason }),
      worldAsOfDate: '2027-01-15',
      recordedAt: '2027-01-14T18:01:00-05:00',
    });

    expect(result.success, JSON.stringify(result)).toBe(true);
  });

  it('accepts the 20% total-incentive boundary and rejects one cent more', () => {
    const exact = withUniformCompensation({
      proposal: proposal('rookie-scale'),
      regularSalary: 30_000_000,
      bonusAmount: 6_000_000,
      classification: 'likely',
    });
    const accepted = decideGovernedExtension(
      request('rookie-scale', { proposal: exact })
    );
    expect(accepted.success, JSON.stringify(accepted)).toBe(true);

    const excessive = structuredClone(exact);
    excessive.salariesByYear[0].bonuses[0].amount += 0.01;
    const rejected = decideGovernedExtension(
      request('rookie-scale', { proposal: excessive })
    );
    expect(rejected.success).toBe(false);
    if (!rejected.success) {
      expect(rejected.reasons.join(' ')).toMatch(/exceeds 20% of Regular Salary/i);
    }
  });

  it('accepts the 15% unlikely-incentive boundary and rejects one cent more', () => {
    const exact = withUniformCompensation({
      proposal: proposal('rookie-scale'),
      regularSalary: 30_000_000,
      bonusAmount: 4_500_000,
      classification: 'unlikely',
    });
    const accepted = decideGovernedExtension(
      request('rookie-scale', { proposal: exact })
    );
    expect(accepted.success, JSON.stringify(accepted)).toBe(true);

    const excessive = structuredClone(exact);
    excessive.salariesByYear[0].bonuses[0].amount += 0.01;
    const rejected = decideGovernedExtension(
      request('rookie-scale', { proposal: excessive })
    );
    expect(rejected.success).toBe(false);
    if (!rejected.success) {
      expect(rejected.reasons.join(' ')).toMatch(
        /Unlikely Incentive Compensation exceeds 15\.0000%/i
      );
    }
  });

  it('honors only the exact signing-year unlikely percentage in the first extension Season', () => {
    const originalCompensation = [
      '2023-24',
      '2024-25',
      '2025-26',
      '2026-27',
    ].map((season, index) => ({
      season,
      salaryExcludingIncentive: 17_000_000 + index * 1_000_000,
      regularSalary: 17_000_000 + index * 1_000_000,
      bonuses:
        season === '2026-27'
          ? [
              {
                bonusId: 'unlikely-boundary',
                classification: 'unlikely' as const,
                amount: 3_400_000,
              },
            ]
          : [],
    }));
    const grandfathered = proposal('rookie-scale');
    grandfathered.salariesByYear = grandfathered.salariesByYear.map(
      (row, index) => ({
        ...row,
        salaryExcludingIncentive: 30_000_000 + index * 2_400_000,
        regularSalary: 30_000_000 + index * 2_400_000,
        bonuses: [
          {
            bonusId: 'unlikely-boundary',
            classification: 'unlikely',
            amount: index === 0 ? 5_100_000 : 4_860_000,
          },
        ],
      })
    );
    const baseline = baselineFor('rookie-scale', {
      contractEvidence: { originalCompensation },
    });
    const accepted = decideGovernedExtension(
      request('rookie-scale', { baseline, proposal: grandfathered })
    );
    expect(accepted.success, JSON.stringify(accepted)).toBe(true);

    const excessive = structuredClone(grandfathered);
    excessive.salariesByYear[0].bonuses[0].amount += 0.01;
    const rejected = decideGovernedExtension(
      request('rookie-scale', { baseline, proposal: excessive })
    );
    expect(rejected.success).toBe(false);
    if (!rejected.success) {
      expect(rejected.reasons.join(' ')).toMatch(
        /Unlikely Incentive Compensation exceeds 17\.0000%/i
      );
    }
  });

  it('requires an explicit external award determination identity when needed', () => {
    const result = decideGovernedExtension(
      request('designated-veteran', {
        baseline: baselineFor('designated-veteran', {
          contractEvidence: {
            awardEvidence: {
              status: 'known',
              achievement: 'MVP',
              achievementSeason: '2025-26',
              qualificationWindowSatisfied: true,
              gameThresholdStatus: 'external-determination',
              determinationId: null,
            },
          },
        }),
      })
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reasons.join(' ')).toMatch(/explicit.*determination/i);
  });
});

function compatibilityPlayer(baseline: ContractEventLedgerPayload) {
  const state = baseline.events[0].resultingState;
  return {
    playerId: PLAYER_ID,
    player_id: PLAYER_ID,
    id: PLAYER_ID,
    displayName: 'Governed Extension Player',
    name: 'Governed Extension Player',
    teamCode: TEAM_ID,
    teamName: 'Miami Heat',
    contract: {
      salariesByYear: state.terms.salaries.map((row) => ({
        season: row.season || '',
        salary: row.salary,
        capHit: row.capHit,
        guaranteed: row.guaranteed,
        option: row.option,
        optionUsed: row.optionUsed,
      })),
    },
  };
}

function persistencePlayerFixture() {
  return compatibilityPlayer(baselineFor('veteran'));
}

function persistenceTeamFixture() {
  const player = persistencePlayerFixture();
  return {
    teamCode: TEAM_ID,
    teamName: 'Miami Heat',
    roster: [PLAYER_ID],
    players: [player],
    capHolds: [],
    contractEventLedgers: [],
    totals: { totalSalary: 74_000_000 },
    source: { type: 'world-snapshot', provider: 'fixture' },
  };
}

function computeMutation(
  options: {
    operationId?: string;
    omitAuthority?: boolean;
    localSnapshotsExist?: boolean;
    sourceWorldId?: string | null;
    malformedSourceReceipt?: boolean;
  } = {}
) {
  const baseline = baselineFor('veteran');
  const team = persistenceTeamFixture();
  const player = team.players[0];
  const localSnapshotsExist = options.localSnapshotsExist ?? true;
  const sourceWorldId = localSnapshotsExist
    ? WORLD_ID
    : options.sourceWorldId ?? null;
  const authority = resolveGovernedExtensionLedgerAuthority({
    baselineLedger: baseline,
    baselineSalaryCapYear: 2027,
  });
  return computeWorldMutation({
    mutationType: 'extendPlayer',
    payload: {
      teamCode: TEAM_ID,
      playerId: PLAYER_ID,
      contractId: CONTRACT_ID,
      extensionProposal: proposal('veteran'),
    },
    currentState: {
      teamCode: TEAM_ID,
      player,
      ...(options.omitAuthority ? {} : { extensionAuthority: authority }),
      extensionTeamSnapshot: {
        exists: localSnapshotsExist,
        digest: localSnapshotsExist ? mutationSnapshotDigest(team) : null,
        sourceWorldId,
        sourceDigest:
          sourceWorldId && !options.malformedSourceReceipt
            ? mutationSnapshotDigest(team)
            : null,
      },
      extensionPlayerSnapshot: {
        exists: localSnapshotsExist,
        digest: localSnapshotsExist ? mutationSnapshotDigest(player) : null,
        sourceWorldId,
        sourceDigest:
          sourceWorldId && !options.malformedSourceReceipt
            ? mutationSnapshotDigest(player)
            : null,
      },
      team,
    },
    seasonId: '2026-27',
    timestamp: Date.parse('2026-10-19T18:01:00-04:00'),
    asOfDate: WORLD_DATE,
    worldId: WORLD_ID,
    operationId: options.operationId ?? 'compute-extension',
    authoringIdentity: 'user-bze-282',
    recordedAt: '2026-10-19T18:01:00-04:00',
  });
}

function seedPersistenceWorld(): void {
  const world = {
    ...createMockWorld({
      worldId: WORLD_ID,
      userId: 'user-bze-282',
      currentSeason: '2026-27',
      asOfDate: WORLD_DATE,
    }),
    contractBaselineVersion: 2,
    contractBaselineEffectiveAt: '2026-07-01T00:00:00-04:00',
    contractBaselineSalaryCapYear: 2027,
  };
  seedWorldMetadata(WORLD_ID, world);
  const player = persistencePlayerFixture();
  const team = persistenceTeamFixture();
  seedTeamSnapshot(
    WORLD_ID,
    TEAM_ID,
    team as unknown as MockTeam,
    { padRoster: false }
  );
  seedMockData(
    `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`,
    player
  );
}

function seedParentFallbackWorld(): void {
  seedBaseData();
  seedWorldMetadata(PARENT_WORLD_ID, {
    ...createMockWorld({
      worldId: PARENT_WORLD_ID,
      userId: 'user-bze-282',
      currentSeason: '2026-27',
      asOfDate: WORLD_DATE,
    }),
    contractBaselineVersion: 2,
    contractBaselineEffectiveAt: '2026-07-01T00:00:00-04:00',
    contractBaselineSalaryCapYear: 2027,
  });
  seedWorldMetadata(WORLD_ID, {
    ...createMockWorld({
      worldId: WORLD_ID,
      userId: 'user-bze-282',
      currentSeason: '2026-27',
      asOfDate: WORLD_DATE,
    }),
    parentWorldId: PARENT_WORLD_ID,
    contractBaselineVersion: 2,
    contractBaselineEffectiveAt: '2026-07-01T00:00:00-04:00',
    contractBaselineSalaryCapYear: 2027,
  });
  seedTeamSnapshot(
    PARENT_WORLD_ID,
    TEAM_ID,
    persistenceTeamFixture() as unknown as MockTeam,
    { padRoster: false }
  );
  seedMockData(
    `architect_worlds/${PARENT_WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`,
    persistencePlayerFixture()
  );
}

describe('governed extension mutation and atomic persistence', () => {
  it('projects the event, future Contract, trade state, and expected ledger from one authority', () => {
    const result = computeMutation();
    expect(result.success, String(result.error || '')).toBe(true);
    const team = result.teamUpdates?.[0]?.team;
    const player = result.playerUpdates?.[0]?.player;
    expect(team?.contractEventLedgers?.[0]?.ledgerVersion).toBe(2);
    expect(player?.futureContract?.isExtension).toBe(true);
    expect(player?.futureContract?.salariesByYear).toHaveLength(4);
    expect(result.metadata).toMatchObject({
      extensionRoute: 'veteran',
      contractId: CONTRACT_ID,
      expectedContractOverlayLedgerVersion: null,
    });
  });

  it('returns failure with no team or player updates when authority is absent', () => {
    const result = computeMutation({ omitAuthority: true });
    expect(result.success).toBe(false);
    expect(result.teamUpdates || []).toEqual([]);
    expect(result.playerUpdates || []).toEqual([]);
    expect(String(result.error)).toMatch(/pinned Contract.*retained extension evidence/i);
  });

  it('fails computation before mutation when a mutable fallback receipt is incomplete', () => {
    const result = computeMutation({
      localSnapshotsExist: false,
      sourceWorldId: PARENT_WORLD_ID,
      malformedSourceReceipt: true,
    });
    expect(result.success).toBe(false);
    expect(result.teamUpdates || []).toEqual([]);
    expect(result.playerUpdates || []).toEqual([]);
    expect(String(result.error)).toMatch(/fallback source-snapshot receipts/i);
  });

  it('commits the future Contract and immutable overlay atomically', async () => {
    seedBaseData();
    seedPersistenceWorld();
    const computed = computeMutation();
    expect(computed.success).toBe(true);
    const persisted = await persistWorldMutation({
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'extendPlayer',
      computeResult: computed,
      committedTeamUpdates: computed.teamUpdates || [],
      timestamp: Date.parse('2026-10-19T18:01:00-04:00'),
    });
    expect(persisted.success).toBe(true);
    const reloaded = getMockTeamSnapshot(WORLD_ID, TEAM_ID);
    expect(reloaded?.players?.[0]?.futureContract?.salariesByYear).toHaveLength(4);
    expect(reloaded?.contractEventLedgers?.[0]).toMatchObject({
      ledgerVersion: 2,
    });
    expect(
      getAllMockData().get(
        `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`
      )
    ).toMatchObject({ futureContract: { isExtension: true } });
  });

  it('creates the first local team and player snapshots atomically from fallback state', async () => {
    seedBaseData();
    seedWorldMetadata(WORLD_ID, {
      ...createMockWorld({
        worldId: WORLD_ID,
        userId: 'user-bze-282',
        currentSeason: '2026-27',
        asOfDate: WORLD_DATE,
      }),
      contractBaselineVersion: 2,
      contractBaselineEffectiveAt: '2026-07-01T00:00:00-04:00',
      contractBaselineSalaryCapYear: 2027,
    });
    const computed = computeMutation({ localSnapshotsExist: false });
    expect(computed.success).toBe(true);

    const persisted = await persistWorldMutation({
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'extendPlayer',
      computeResult: computed,
      committedTeamUpdates: computed.teamUpdates || [],
      timestamp: Date.parse('2026-10-19T18:01:00-04:00'),
    });

    expect(persisted.success).toBe(true);
    expect(getMockTeamSnapshot(WORLD_ID, TEAM_ID)).toMatchObject({
      contractEventLedgers: [{ ledgerVersion: 2 }],
    });
    expect(
      getAllMockData().get(
        `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`
      )
    ).toMatchObject({ futureContract: { isExtension: true } });
  });

  it('creates first local snapshots only while the consumed parent fallback is unchanged', async () => {
    seedParentFallbackWorld();
    const computed = computeMutation({
      localSnapshotsExist: false,
      sourceWorldId: PARENT_WORLD_ID,
    });
    expect(computed.success).toBe(true);

    const persisted = await persistWorldMutation({
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'extendPlayer',
      computeResult: computed,
      committedTeamUpdates: computed.teamUpdates || [],
      timestamp: Date.parse('2026-10-19T18:01:00-04:00'),
    });

    expect(persisted.success).toBe(true);
    expect(getMockTeamSnapshot(WORLD_ID, TEAM_ID)).toMatchObject({
      contractEventLedgers: [{ ledgerVersion: 2 }],
    });
  });

  it('rejects a changed parent team fallback with no partial child write', async () => {
    seedParentFallbackWorld();
    const computed = computeMutation({
      operationId: 'parent-team-race',
      localSnapshotsExist: false,
      sourceWorldId: PARENT_WORLD_ID,
    });
    expect(computed.success).toBe(true);
    seedTeamSnapshot(
      PARENT_WORLD_ID,
      TEAM_ID,
      {
        ...persistenceTeamFixture(),
        totals: { totalSalary: 74_000_001 },
      } as unknown as MockTeam,
      { padRoster: false }
    );
    const eventCountBefore = [...getAllMockData().keys()].filter((key) =>
      key.includes(`/events/`)
    ).length;

    const persisted = await persistWorldMutation({
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'extendPlayer',
      computeResult: computed,
      committedTeamUpdates: computed.teamUpdates || [],
      timestamp: Date.parse('2026-10-19T18:01:00-04:00'),
    });

    expect(persisted.success).toBe(false);
    if (!persisted.success) {
      expect(persisted.error).toContain('Inherited team snapshot');
    }
    expect(getMockTeamSnapshot(WORLD_ID, TEAM_ID)).toBeUndefined();
    expect(
      getAllMockData().get(
        `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`
      )
    ).toBeUndefined();
    expect(
      [...getAllMockData().keys()].filter((key) => key.includes(`/events/`))
    ).toHaveLength(eventCountBefore);
  });

  it('rejects a changed parent player fallback with no partial child write', async () => {
    seedParentFallbackWorld();
    const computed = computeMutation({
      operationId: 'parent-player-race',
      localSnapshotsExist: false,
      sourceWorldId: PARENT_WORLD_ID,
    });
    expect(computed.success).toBe(true);
    const parentPlayerPath =
      `architect_worlds/${PARENT_WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`;
    seedMockData(parentPlayerPath, {
      ...persistencePlayerFixture(),
      scoutingNote: 'concurrent parent change',
    });
    const eventCountBefore = [...getAllMockData().keys()].filter((key) =>
      key.includes(`/events/`)
    ).length;

    const persisted = await persistWorldMutation({
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'extendPlayer',
      computeResult: computed,
      committedTeamUpdates: computed.teamUpdates || [],
      timestamp: Date.parse('2026-10-19T18:01:00-04:00'),
    });

    expect(persisted.success).toBe(false);
    if (!persisted.success) {
      expect(persisted.error).toContain('Inherited player snapshot');
    }
    expect(getMockTeamSnapshot(WORLD_ID, TEAM_ID)).toBeUndefined();
    expect(
      getAllMockData().get(
        `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`
      )
    ).toBeUndefined();
    expect(
      [...getAllMockData().keys()].filter((key) => key.includes(`/events/`))
    ).toHaveLength(eventCountBefore);
  });

  it('rejects a concurrent first-snapshot creator with no partial write', async () => {
    seedBaseData();
    seedPersistenceWorld();
    const computed = computeMutation({
      operationId: 'first-snapshot-race',
      localSnapshotsExist: false,
    });
    expect(computed.success).toBe(true);
    const beforeTeam = JSON.stringify(getMockTeamSnapshot(WORLD_ID, TEAM_ID));
    const playerPath =
      `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`;
    const beforePlayer = JSON.stringify(getAllMockData().get(playerPath));
    const eventCountBefore = [...getAllMockData().keys()].filter((key) =>
      key.includes(`/events/`)
    ).length;

    const persisted = await persistWorldMutation({
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'extendPlayer',
      computeResult: computed,
      committedTeamUpdates: computed.teamUpdates || [],
      timestamp: Date.parse('2026-10-19T18:01:00-04:00'),
    });

    expect(persisted.success).toBe(false);
    if (!persisted.success) expect(persisted.error).toContain('Team snapshot');
    expect(JSON.stringify(getMockTeamSnapshot(WORLD_ID, TEAM_ID))).toBe(
      beforeTeam
    );
    expect(JSON.stringify(getAllMockData().get(playerPath))).toBe(beforePlayer);
    expect(
      [...getAllMockData().keys()].filter((key) => key.includes(`/events/`))
    ).toHaveLength(eventCountBefore);
  });

  it('rejects a stale overlay with no partial team, player, or event write', async () => {
    seedBaseData();
    seedPersistenceWorld();
    const stale = computeMutation({ operationId: 'stale-extension' });
    const winner = computeMutation({ operationId: 'winning-extension' });
    expect(stale.success).toBe(true);
    expect(winner.success).toBe(true);
    const winningTeam = winner.teamUpdates?.[0]?.team;
    if (!winningTeam) throw new Error('winning fixture must produce a team');
    seedTeamSnapshot(WORLD_ID, TEAM_ID, winningTeam as unknown as MockTeam, {
      padRoster: false,
    });
    const beforeTeam = JSON.stringify(getMockTeamSnapshot(WORLD_ID, TEAM_ID));
    const beforePlayer = JSON.stringify(
      getAllMockData().get(
        `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`
      )
    );
    const eventCountBefore = [...getAllMockData().keys()].filter((key) =>
      key.includes(`/events/`)
    ).length;
    const persisted = await persistWorldMutation({
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'extendPlayer',
      computeResult: stale,
      committedTeamUpdates: stale.teamUpdates || [],
      timestamp: Date.parse('2026-10-19T18:01:00-04:00'),
    });
    expect(persisted.success).toBe(false);
    if (!persisted.success) expect(persisted.error).toContain('changed before commit');
    expect(JSON.stringify(getMockTeamSnapshot(WORLD_ID, TEAM_ID))).toBe(
      beforeTeam
    );
    expect(
      JSON.stringify(
        getAllMockData().get(
          `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`
        )
      )
    ).toBe(beforePlayer);
    expect(
      [...getAllMockData().keys()].filter((key) => key.includes(`/events/`))
    ).toHaveLength(eventCountBefore);
  });

  it('rejects an unrelated concurrent team-snapshot change without a partial write', async () => {
    seedBaseData();
    seedPersistenceWorld();
    const computed = computeMutation({ operationId: 'stale-team-snapshot' });
    expect(computed.success).toBe(true);

    const concurrentTeam = {
      ...persistenceTeamFixture(),
      totals: { totalSalary: 74_000_001 },
    };
    seedTeamSnapshot(
      WORLD_ID,
      TEAM_ID,
      concurrentTeam as unknown as MockTeam,
      { padRoster: false }
    );
    const beforeTeam = JSON.stringify(getMockTeamSnapshot(WORLD_ID, TEAM_ID));
    const playerPath =
      `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`;
    const beforePlayer = JSON.stringify(getAllMockData().get(playerPath));
    const eventCountBefore = [...getAllMockData().keys()].filter((key) =>
      key.includes(`/events/`)
    ).length;

    const persisted = await persistWorldMutation({
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'extendPlayer',
      computeResult: computed,
      committedTeamUpdates: computed.teamUpdates || [],
      timestamp: Date.parse('2026-10-19T18:01:00-04:00'),
    });

    expect(persisted.success).toBe(false);
    if (!persisted.success) expect(persisted.error).toContain('Team snapshot');
    expect(JSON.stringify(getMockTeamSnapshot(WORLD_ID, TEAM_ID))).toBe(
      beforeTeam
    );
    expect(JSON.stringify(getAllMockData().get(playerPath))).toBe(beforePlayer);
    expect(
      [...getAllMockData().keys()].filter((key) => key.includes(`/events/`))
    ).toHaveLength(eventCountBefore);
  });

  it('rejects an unrelated concurrent player-override change without a partial write', async () => {
    seedBaseData();
    seedPersistenceWorld();
    const computed = computeMutation({ operationId: 'stale-player-snapshot' });
    expect(computed.success).toBe(true);

    const playerPath =
      `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`;
    const currentPlayer = getAllMockData().get(playerPath) as Record<
      string,
      unknown
    >;
    seedMockData(playerPath, {
      ...currentPlayer,
      scoutingNote: 'concurrent change outside contract history',
    });
    const beforeTeam = JSON.stringify(getMockTeamSnapshot(WORLD_ID, TEAM_ID));
    const beforePlayer = JSON.stringify(getAllMockData().get(playerPath));
    const eventCountBefore = [...getAllMockData().keys()].filter((key) =>
      key.includes(`/events/`)
    ).length;

    const persisted = await persistWorldMutation({
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'extendPlayer',
      computeResult: computed,
      committedTeamUpdates: computed.teamUpdates || [],
      timestamp: Date.parse('2026-10-19T18:01:00-04:00'),
    });

    expect(persisted.success).toBe(false);
    if (!persisted.success) expect(persisted.error).toContain('Player snapshot');
    expect(JSON.stringify(getMockTeamSnapshot(WORLD_ID, TEAM_ID))).toBe(
      beforeTeam
    );
    expect(JSON.stringify(getAllMockData().get(playerPath))).toBe(beforePlayer);
    expect(
      [...getAllMockData().keys()].filter((key) => key.includes(`/events/`))
    ).toHaveLength(eventCountBefore);
  });
});
