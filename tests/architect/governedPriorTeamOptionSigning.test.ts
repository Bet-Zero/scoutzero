import { describe, expect, it } from 'vitest';

import {
  createContractEventLedger,
  toContractEventLedgerPayload,
  type ContractEventRecord,
  type ContractSalaryTerm,
  type GovernedContractState,
} from '@/features/architect/utils/contractHistory';
import {
  validateGovernedPriorTeamOptionSigning,
  type MutationContract,
  type MutationPlayer,
  type MutationTeam,
} from '@/features/architect/utils/capLegalityValidation';
import { validateNonTradeMutationStage } from '@/features/architect/utils/nonTradeMutationValidationStage';
import { normalizeCurrentStateCapHold } from '@/features/architect/utils/mutationPipeline.read.normalizeData.capData';
import {
  makeEvent,
  makeResultingState,
} from './contractHistory/contractHistoryFixtures';

const WORLD_ID = 'world-bze-276';
const TEAM_ID = 'DET';
const PLAYER_ID = 'player-bze-276';
const CONTRACT_ID = 'contract-bze-276';
const SALARY_CAP_YEAR = 2028;
const SEASON = '2027-28';
const DECLINED_SALARY = 12_000_000;
const FREE_AGENT_AMOUNT = 21_850_000;
const EFFECTIVE_AT = '2027-07-01T00:00:00-04:00';
const EVENT_ID = `${CONTRACT_ID}:to:${SEASON}:decline:v2`;

const unknownTemporal = () => ({
  precision: 'unknown' as const,
  value: null,
  rawValue: null,
});

const instant = (value: string) => ({
  precision: 'instant' as const,
  value,
  rawValue: value,
});

function salaryRow({
  season,
  salary,
  option = null,
  optionUsed = null,
}: {
  season: string;
  salary: number;
  option?: 'TO' | null;
  optionUsed?: boolean | null;
}): ContractSalaryTerm {
  return {
    season,
    salary,
    capHit: salary,
    guaranteed: true,
    guaranteedAmount: salary,
    option,
    optionHolder: option === 'TO' ? 'team' : null,
    optionUsed,
    optionDecisionDate: unknownTemporal(),
    optionDecisionDeadline: option
      ? instant('2026-11-02T17:00:00-05:00')
      : unknownTemporal(),
    optionDecisionTerms: option
      ? {
          termsVersion: 1,
          conditional: false,
          decisionWindowOpensAt: instant('2026-10-01T09:00:00-04:00'),
          contractEndsAt: instant(EFFECTIVE_AT),
          nonCompensationTermsMatchPriorSeason: true,
          compensationProtectionMatchesPriorSeason: true,
          rookieScaleOptionOrdinal: season === SEASON ? 'fourth' : 'third',
          rookieScaleFourthSeasonTermsMatchThird:
            season === SEASON ? true : null,
          playerOptionProtectionAlternative: null,
          preExerciseProtectionApplies: null,
          teamLastGameAt: unknownTemporal(),
          rfaDeclarationDeadline: unknownTemporal(),
          rfaRelevanceEvidence: null,
          etoOrigin: null,
          etoAddedDuringOriginalTerm: null,
          allowedNoticeMethods: ['email'],
          noticeRecipient: 'team',
          leagueForwardingRequired: true,
        }
      : null,
    tradeBonus: null,
    incentives: {
      likely: 0,
      unlikely: 0,
      criteriaEvidence: 'known',
    },
    guaranteeSchedule: [],
    voidedByExtension: false,
    voidedOn: unknownTemporal(),
  };
}

const predecessorSalaries: ContractSalaryTerm[] = [
  salaryRow({ season: '2024-25', salary: 8_000_000 }),
  salaryRow({ season: '2025-26', salary: 9_000_000 }),
  salaryRow({
    season: '2026-27',
    salary: 10_000_000,
    option: 'TO',
    optionUsed: true,
  }),
  salaryRow({
    season: SEASON,
    salary: DECLINED_SALARY,
    option: 'TO',
  }),
];

function state({
  contractVersion,
  salaries,
  freeAgent,
}: {
  contractVersion: number;
  salaries: ContractSalaryTerm[];
  freeAgent: boolean;
}): GovernedContractState {
  const totalValue = salaries.reduce((sum, row) => sum + (row.salary || 0), 0);
  return makeResultingState({
    contractId: CONTRACT_ID,
    contractVersion,
    playerId: PLAYER_ID,
    teamId: TEAM_ID,
    establishmentKind: 'source-establishment',
    terms: {
      ...makeResultingState().terms,
      contractType: 'ROOKIE SCALE CONTRACT',
      isRookieScale: true,
      signingTeam: TEAM_ID,
      startSeason: predecessorSalaries[0].season,
      endSeason: salaries.at(-1)?.season ?? null,
      contractLength: salaries.length,
      totalValue,
      averageAnnualValue: Math.round(totalValue / salaries.length),
      guaranteedValue: totalValue,
      guaranteedYears: salaries.length,
      salaries,
      freeAgency: freeAgent
        ? {
            type: 'UFA',
            year: SALARY_CAP_YEAR,
            capHold: FREE_AGENT_AMOUNT,
            qualifyingOffer: null,
            earlyTerminationOption: null,
            hasOption: false,
            optionYear: null,
            optionType: null,
          }
        : {
            type: 'UFA',
            year: SALARY_CAP_YEAR,
            capHold: null,
            qualifyingOffer: null,
            earlyTerminationOption: null,
            hasOption: true,
            optionYear: SEASON,
            optionType: 'TO',
          },
    },
  });
}

function events(): ContractEventRecord[] {
  const root = makeEvent({
    eventId: `${CONTRACT_ID}:source-establishment`,
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
    resultingState: state({
      contractVersion: 1,
      salaries: predecessorSalaries,
      freeAgent: false,
    }),
  });
  const decline = makeEvent({
    eventId: EVENT_ID,
    eventKind: 'option-decline',
    worldId: WORLD_ID,
    contractId: CONTRACT_ID,
    playerId: PLAYER_ID,
    teamId: TEAM_ID,
    executedAt: '2026-11-02T17:00:00-05:00',
    effectiveAt: EFFECTIVE_AT,
    recordedAt: '2026-11-03T09:00:00-05:00',
    predecessorContractVersion: 1,
    predecessorEventId: root.eventId,
    resultingContractVersion: 2,
    authoringIdentity: 'user-bze-276',
    resultingState: state({
      contractVersion: 2,
      salaries: predecessorSalaries.slice(0, 3),
      freeAgent: true,
    }),
    canonLeafIds: ['CBA2-C16.7', 'CBA2-L02.1'],
  });
  return [root, decline];
}

function ledger(eventOverrides: ContractEventRecord[] = events()) {
  return toContractEventLedgerPayload(
    createContractEventLedger({
      ledgerId: `${WORLD_ID}:${CONTRACT_ID}:contract`,
      ledgerVersion: eventOverrides.length,
      events: eventOverrides,
    })
  );
}

function team(): MutationTeam {
  return {
    teamCode: TEAM_ID,
    capHolds: [
      {
        playerId: PLAYER_ID,
        playerName: 'Governed Rookie',
        amount: FREE_AGENT_AMOUNT,
        type: 'Bird UFA Amount',
        season: SEASON,
        isSigned: false,
        active: true,
        reason: 'Declined TO',
        priorTeamOfferCeiling: DECLINED_SALARY,
        governedContractEventId: EVENT_ID,
      },
    ],
    contractEventLedgers: [ledger()],
  };
}

const player: MutationPlayer = {
  player_id: PLAYER_ID,
  name: 'Governed Rookie',
};

function offer({
  salary = 11_000_000,
  unlikely = 1_000_000,
  likely = 0,
  capHit = salary,
}: {
  salary?: number;
  unlikely?: number;
  likely?: number;
  capHit?: number;
} = {}): MutationContract {
  return {
    salariesByYear: [
      {
        season: SEASON,
        salary,
        capHit,
        guaranteed: true,
        guaranteedAmount: salary,
        incentives: { likely, unlikely },
      },
    ],
    years: 1,
    contractYears: 1,
    totalValue: salary,
  };
}

function validate(
  overrides: Partial<
    Parameters<typeof validateGovernedPriorTeamOptionSigning>[0]
  > = {}
) {
  return validateGovernedPriorTeamOptionSigning({
    team: team(),
    player,
    contract: offer(),
    worldId: WORLD_ID,
    year: SALARY_CAP_YEAR,
    asOfDate: '2027-07-02',
    dateDefaulted: false,
    ...overrides,
  });
}

describe('governed declined Rookie Scale option signing limit', () => {
  it('preserves the BZE-275 cap-hold linkage through current-state normalization', () => {
    expect(
      normalizeCurrentStateCapHold({
        ...team().capHolds?.[0],
        unrelatedClientField: 'drop-me',
      })
    ).toMatchObject({
      playerId: PLAYER_ID,
      priorTeamOfferCeiling: DECLINED_SALARY,
      governedContractEventId: EVENT_ID,
    });
  });

  it('passes the exact Canon boundary and ignores likely bonuses and cap hit', () => {
    const result = validate({
      contract: offer({
        salary: 11_000_000,
        unlikely: 1_000_000,
        likely: 8_000_000,
        capHit: 30_000_000,
      }),
    });
    expect(result).toEqual({ valid: true, violations: [], warnings: [] });
  });

  it('blocks the exact Canon negative by $0.01 without rounding it away', () => {
    const result = validate({
      contract: offer({ salary: 11_000_000, unlikely: 1_000_000.01 }),
    });
    expect(result.valid).toBe(false);
    expect(result.violations[0]).toMatchObject({
      rule: 'governed_rookie_option_offer_exceeds_ceiling',
      governedOfferAmount: 12_000_000.01,
      priorTeamOfferCeiling: DECLINED_SALARY,
      canonLeafId: 'CBA2-C16.7',
    });
  });

  it('passes salary-only at the ceiling and blocks the smallest amount above it', () => {
    expect(
      validate({ contract: offer({ salary: DECLINED_SALARY, unlikely: 0 }) })
        .valid
    ).toBe(true);
    expect(
      validate({
        contract: offer({ salary: DECLINED_SALARY + 0.01, unlikely: 0 }),
      }).valid
    ).toBe(false);
  });

  it('does not impose the Prior Team limit on another team', () => {
    expect(
      validate({
        team: { teamCode: 'ORL', capHolds: [], contractEventLedgers: [] },
      }).valid
    ).toBe(true);
  });

  it.each([
    ['missing link', () => ({ governedContractEventId: undefined })],
    ['wrong link', () => ({ governedContractEventId: 'missing-event' })],
    ['wrong ceiling', () => ({ priorTeamOfferCeiling: 11_999_999 })],
    ['wrong season', () => ({ season: '2028-29' })],
    ['wrong free-agent amount', () => ({ amount: FREE_AGENT_AMOUNT + 1 })],
    ['inactive hold', () => ({ active: false })],
    ['signed hold', () => ({ isSigned: true })],
  ])('fails closed for %s', (_label, tamper) => {
    const changedTeam = team();
    changedTeam.capHolds = [{ ...changedTeam.capHolds?.[0], ...tamper() }];
    expect(validate({ team: changedTeam }).valid).toBe(false);
  });

  it('fails closed for duplicate cap holds and duplicate linked events', () => {
    const duplicateHolds = team();
    duplicateHolds.capHolds = [
      ...(duplicateHolds.capHolds || []),
      { ...(duplicateHolds.capHolds || [])[0] },
    ];
    expect(validate({ team: duplicateHolds }).violations[0]).toMatchObject({
      failureKind: 'duplicate',
    });

    const duplicateLedgers = team();
    duplicateLedgers.contractEventLedgers = [ledger(), ledger()];
    expect(validate({ team: duplicateLedgers }).violations[0]).toMatchObject({
      failureKind: 'duplicate',
    });
  });

  it('fails closed when the option decline has no authenticated author', () => {
    const unauthenticatedEvents = events();
    unauthenticatedEvents[1] = {
      ...unauthenticatedEvents[1],
      authoringIdentity: null,
    };
    const unauthenticatedTeam = team();
    unauthenticatedTeam.contractEventLedgers = [
      ledger(unauthenticatedEvents),
    ];
    expect(validate({ team: unauthenticatedTeam }).violations[0]).toMatchObject(
      { failureKind: 'unauthenticated' }
    );
  });

  it('fails closed for world, team, Season, decision, Contract, and malformed-ledger mismatches', () => {
    expect(validate({ worldId: 'world-other' }).valid).toBe(false);

    const wrongTeam = team();
    wrongTeam.teamCode = 'ORL';
    expect(validate({ team: wrongTeam }).valid).toBe(false);

    expect(validate({ year: 2029 }).violations[0]).toMatchObject({
      failureKind: 'stale',
    });

    const wrongDecisionEvents = events();
    wrongDecisionEvents[1] = {
      ...wrongDecisionEvents[1],
      eventKind: 'option-exercise',
    };
    const wrongDecision = team();
    wrongDecision.contractEventLedgers = [ledger(wrongDecisionEvents)];
    expect(validate({ team: wrongDecision }).valid).toBe(false);

    const wrongContract = team();
    wrongContract.contractEventLedgers = [
      {
        ...ledger(),
        ledgerId: `${WORLD_ID}:contract-other:contract`,
      },
    ];
    expect(validate({ team: wrongContract }).valid).toBe(false);

    const malformed = team();
    malformed.contractEventLedgers = [
      { ...ledger(), payloadVersion: 999 } as never,
    ];
    expect(validate({ team: malformed }).violations[0]).toMatchObject({
      failureKind: 'malformed',
    });
  });

  it('fails closed when a later Contract event makes the linked decline stale', () => {
    const chain = events();
    const laterState = state({
      contractVersion: 3,
      salaries: predecessorSalaries.slice(0, 3),
      freeAgent: true,
    });
    chain.push(
      makeEvent({
        eventId: `${CONTRACT_ID}:amendment:v3`,
        eventKind: 'amendment',
        worldId: WORLD_ID,
        contractId: CONTRACT_ID,
        playerId: PLAYER_ID,
        teamId: TEAM_ID,
        executedAt: '2027-07-02T00:00:00-04:00',
        effectiveAt: '2027-07-02T00:00:00-04:00',
        recordedAt: '2027-07-02T00:01:00-04:00',
        predecessorContractVersion: 2,
        predecessorEventId: EVENT_ID,
        resultingContractVersion: 3,
        resultingState: laterState,
      })
    );
    const staleTeam = team();
    staleTeam.contractEventLedgers = [ledger(chain)];
    expect(validate({ team: staleTeam }).violations[0]).toMatchObject({
      failureKind: 'stale',
    });
  });

  it('runs at the authoritative non-trade validation stage before persistence', () => {
    const result = validateNonTradeMutationStage({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: TEAM_ID,
        playerId: PLAYER_ID,
        contract: offer({ salary: 11_000_000, unlikely: 1_000_000.01 }),
        signedUsing: 'CAP_SPACE',
      },
      currentState: {
        team: team(),
        player,
        teamCode: TEAM_ID,
      },
      computeResult: { success: true },
      seasonId: SEASON,
      asOfDate: '2027-07-02',
      dateDefaulted: false,
      worldId: WORLD_ID,
    });
    expect(result.valid).toBe(false);
    expect(result.violations?.[0]).toContain(
      'governed_rookie_option_offer_exceeds_ceiling'
    );
  });
});
