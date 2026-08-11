import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContractEventLedgerPayload } from '@/schemas/contractEventLedger';
import type {
  ContractSalaryTerm,
  GovernedContractState,
  GovernedOptionDecisionTerms,
} from '@/schemas/governedContractState';
import {
  applyGovernedOptionResult,
  decideGovernedOption,
  inspectGovernedOptionDecision,
  loadWorldGovernedOptionEntries,
  resolveGovernedOptionLedgerAuthority,
  type GovernedOptionType,
} from '@/features/architect/utils/optionDecisions';
import { projectContractStateAsOf } from '@/features/architect/utils/contractHistory';
import {
  buildGeneralMutationDashboardReloadTeamSnapshot,
  computeWorldMutation,
  persistWorldMutation,
} from '@/features/architect/utils/mutationPipeline';
import {
  branchWorld,
  createWorld,
} from '@/features/architect/utils/worldManager';
import { toTeamHistoryEventDisplay } from '@/features/architect/history/utils/normalizeWorldEventsForTeamHistory';
import { deterministicStateDigest } from '@/features/architect/utils/contractSource';
import { validateOptionDecision } from '@/features/architect/utils/capLegalityValidation/actionValidators';
import {
  makeEvent,
  makeResultingState,
} from '../contractHistory/contractHistoryFixtures';
import {
  makeRightsEstablishedEvent,
  makeRightsLedger,
} from '../../fixtures/architect/rightsHistory';
import {
  createMockWorld,
  getMockTeamSnapshot,
  seedBaseData,
  seedTeamSnapshot,
  seedWorldMetadata,
  type MockTeam,
} from '../../helpers/architectTestHelpers';
import { getAllMockData, seedMockData } from '../../__mocks__/firebase';

const WORLD_ID = 'world-bze-275';
const TEAM_ID = 'DET';
const PLAYER_ID = 'player-bze-275';
const CONTRACT_ID = 'contract-bze-275';
const BASELINE_SALARY_CAP_YEAR = 2027;
const TARGET_YEAR = 2028;
const WORLD_AS_OF_DATE = '2027-07-01';
const DEADLINE = '2027-06-29T17:00:00-04:00';
const WINDOW_OPENS = '2027-06-01T09:00:00-04:00';
const CONTRACT_ENDS = '2027-07-01T00:00:00-04:00';

const instant = (value: string) => ({
  precision: 'instant' as const,
  value,
  rawValue: value,
});
const unknownTemporal = () => ({
  precision: 'unknown' as const,
  value: null,
  rawValue: null,
});

function optionTerms(
  optionType: GovernedOptionType,
  overrides: Partial<GovernedOptionDecisionTerms> = {}
): GovernedOptionDecisionTerms {
  return {
    termsVersion: 1,
    conditional: false,
    decisionWindowOpensAt: instant(WINDOW_OPENS),
    contractEndsAt: instant(CONTRACT_ENDS),
    nonCompensationTermsMatchPriorSeason: true,
    compensationProtectionMatchesPriorSeason: true,
    rookieScaleOptionOrdinal: null,
    rookieScaleFourthSeasonTermsMatchThird: null,
    playerOptionProtectionAlternative: optionType === 'PO' ? 'A' : null,
    preExerciseProtectionApplies: optionType === 'PO' ? true : null,
    teamLastGameAt: unknownTemporal(),
    rfaDeclarationDeadline: unknownTemporal(),
    etoOrigin: optionType === 'ETO' ? 'original-contract' : null,
    etoAddedDuringOriginalTerm: optionType === 'ETO' ? false : null,
    allowedNoticeMethods: ['email', 'certified-mail'],
    noticeRecipient: optionType === 'TO' ? 'team' : 'player',
    leagueForwardingRequired: true,
    ...overrides,
  };
}

function salaryRow({
  index,
  option = null,
  optionUsed = null,
  deadline = null,
  terms = null,
}: {
  index: number;
  option?: GovernedOptionType | null;
  optionUsed?: boolean | null;
  deadline?: string | null;
  terms?: GovernedOptionDecisionTerms | null;
}): ContractSalaryTerm {
  const endYear = TARGET_YEAR - 4 + index;
  const salary = 8_000_000 + index * 1_000_000;
  return {
    season: `${endYear - 1}-${String(endYear % 100).padStart(2, '0')}`,
    salary,
    capHit: salary,
    guaranteed: true,
    guaranteedAmount: salary,
    option,
    optionHolder: option === 'TO' ? 'team' : option ? 'player' : null,
    optionUsed,
    optionDecisionDate: unknownTemporal(),
    optionDecisionDeadline: deadline ? instant(deadline) : unknownTemporal(),
    optionDecisionTerms: terms,
    tradeBonus: null,
    incentives: {
      likely: index * 100_000,
      unlikely: index * 50_000,
      criteriaEvidence: 'known',
    },
    guaranteeSchedule: [],
    voidedByExtension: false,
    voidedOn: unknownTemporal(),
  };
}

function baselineFor(
  optionType: GovernedOptionType,
  options: {
    row?: Partial<ContractSalaryTerm>;
    terms?: Partial<GovernedOptionDecisionTerms> | null;
    isRookieScale?: boolean;
  } = {}
): ContractEventLedgerPayload {
  const isRookieScale = options.isRookieScale === true;
  const rowCount = optionType === 'ETO' ? 5 : isRookieScale ? 4 : 3;
  const finalIndex = rowCount - 1;
  const terms =
    options.terms === null
      ? null
      : optionTerms(optionType, {
          ...(isRookieScale
            ? {
                rookieScaleOptionOrdinal: 'fourth' as const,
                rookieScaleFourthSeasonTermsMatchThird: true,
                decisionWindowOpensAt: instant('2026-10-01T09:00:00-04:00'),
              }
            : {}),
          ...(options.terms || {}),
        });
  const deadline = isRookieScale ? '2026-11-02T17:00:00-05:00' : DEADLINE;
  const salaries = Array.from({ length: rowCount }, (_, index) =>
    salaryRow({
      index: index + (5 - rowCount),
      ...(isRookieScale && index === 2
        ? {
            option: 'TO' as const,
            optionUsed: true,
            deadline: '2025-10-31T17:00:00-04:00',
          }
        : {}),
      ...(index === finalIndex ? { option: optionType, deadline, terms } : {}),
    })
  );
  if (options.row)
    salaries[finalIndex] = { ...salaries[finalIndex], ...options.row };

  const governedState = makeResultingState({
    contractId: CONTRACT_ID,
    contractVersion: 1,
    playerId: PLAYER_ID,
    teamId: TEAM_ID,
    establishmentKind: 'source-establishment',
    terms: {
      ...makeResultingState().terms,
      contractType: isRookieScale
        ? 'ROOKIE SCALE CONTRACT'
        : 'VETERAN CONTRACT',
      isRookieScale,
      startSeason: salaries[0].season,
      endSeason: salaries.at(-1)?.season ?? null,
      contractLength: salaries.length,
      totalValue: salaries.reduce((sum, row) => sum + (row.salary || 0), 0),
      averageAnnualValue: Math.round(
        salaries.reduce((sum, row) => sum + (row.salary || 0), 0) /
          salaries.length
      ),
      guaranteedValue: salaries.reduce(
        (sum, row) => sum + (row.guaranteedAmount || 0),
        0
      ),
      guaranteedYears: salaries.length,
      salaries,
      freeAgency: {
        type: 'UFA',
        year: TARGET_YEAR,
        capHold: null,
        qualifyingOffer: null,
        earlyTerminationOption: optionType === 'ETO' ? 'ETO' : null,
        hasOption: true,
        optionYear: salaries.at(-1)?.season ?? null,
        optionType,
      },
    },
  });
  const root = makeEvent({
    eventId: 'source-contract-bze-275',
    eventKind: 'source-establishment',
    worldId: WORLD_ID,
    contractId: CONTRACT_ID,
    playerId: PLAYER_ID,
    teamId: TEAM_ID,
    executedAt: '2026-07-01T00:00:00-04:00',
    effectiveAt: '2026-07-01T00:00:00-04:00',
    recordedAt: '2026-07-01T00:01:00-04:00',
    resultingContractVersion: 1,
    predecessorContractVersion: null,
    predecessorEventId: null,
    resultingState: governedState,
  });
  return {
    payloadVersion: 2,
    ledgerId: 'contract-ledger-bze-275',
    ledgerVersion: 1,
    events: [root],
  };
}

function rightsFor(options: { rfa?: boolean } = {}) {
  const event = makeRightsEstablishedEvent({
    salaryCapYear: TARGET_YEAR,
    ...(options.rfa
      ? {
          freeAgentStatus: 'RFA' as const,
          rightOfFirstRefusal: 'active' as const,
        }
      : {}),
    eventOverrides: {
      worldId: WORLD_ID,
      teamId: TEAM_ID,
      playerId: PLAYER_ID,
      effectiveAt: '2027-07-01',
      executedAt: '2027-07-01',
      recordedAt: '2027-07-01T00:01:00-04:00',
    },
  });
  return makeRightsLedger(event);
}

function request(
  optionType: GovernedOptionType,
  choice: 'exercise' | 'decline',
  options: {
    baseline?: ContractEventLedgerPayload;
    rights?: ReturnType<typeof rightsFor> | null;
    worldAsOfDate?: string;
    deliveredAt?: string;
    recipient?: string;
    method?: 'email' | 'certified-mail' | 'facsimile';
    leagueReceivedAt?: string;
    forwardedAt?: string;
  } = {}
) {
  const baseline = options.baseline ?? baselineFor(optionType);
  return {
    authority: resolveGovernedOptionLedgerAuthority({
      baselineLedger: baseline,
      baselineSalaryCapYear: BASELINE_SALARY_CAP_YEAR,
    }),
    rightsLedger: options.rights === undefined ? rightsFor() : options.rights,
    worldId: WORLD_ID,
    teamId: TEAM_ID,
    playerId: PLAYER_ID,
    contractId: CONTRACT_ID,
    baselineSalaryCapYear: BASELINE_SALARY_CAP_YEAR,
    worldAsOfDate: options.worldAsOfDate ?? WORLD_AS_OF_DATE,
    targetYear: TARGET_YEAR,
    choice,
    notice: {
      deliveredAt: options.deliveredAt ?? DEADLINE,
      method: options.method ?? 'email',
      recipient:
        options.recipient ?? (optionType === 'TO' ? TEAM_ID : PLAYER_ID),
      leagueReceivedAt: options.leagueReceivedAt ?? '2027-06-29T17:01:00-04:00',
      playersAssociationForwardedAt:
        options.forwardedAt ?? '2027-06-30T09:00:00-04:00',
    },
    operationId: `operation-${optionType}-${choice}`,
    authoringIdentity: 'user-bze-275',
  };
}

describe('governed TO, PO, and ETO directionality', () => {
  it.each([
    ['TO', 'exercise', false, 'option-exercise'],
    ['TO', 'decline', true, 'option-decline'],
    ['PO', 'exercise', false, 'option-exercise'],
    ['PO', 'decline', true, 'option-decline'],
    ['ETO', 'exercise', true, 'eto-exercise'],
    ['ETO', 'decline', false, 'eto-decline'],
  ] as const)(
    '%s %s produces the governed contract direction and immutable event',
    (optionType, choice, endsContract, eventKind) => {
      const result = decideGovernedOption(request(optionType, choice));
      expect(result.success, JSON.stringify(result)).toBe(true);
      if (!result.success) return;
      expect(result.endsContract).toBe(endsContract);
      expect(result.event.eventKind).toBe(eventKind);
      expect(result.event.executedAt).toBe(DEADLINE);
      expect(result.event.effectiveAt).toBe(
        endsContract ? CONTRACT_ENDS : DEADLINE
      );
      expect(result.event.recordedAt).toBe(
        endsContract ? CONTRACT_ENDS : '2027-06-30T09:00:00-04:00'
      );
      expect(result.ledger.ledgerVersion).toBe(2);
      expect(result.event.predecessorContractVersion).toBe(1);
      expect(result.event.resultingContractVersion).toBe(2);
      expect(result.manifest.resultingStateDigest).toBe(
        result.contractState.stateDigest
      );
      expect(result.contractState.terms.salaries).toHaveLength(
        endsContract
          ? optionType === 'ETO'
            ? 4
            : 2
          : optionType === 'ETO'
            ? 5
            : 3
      );
      if (endsContract) {
        expect(result.freeAgentStatus).toBe('UFA');
        expect(result.freeAgentAmount).toBe(21_850_000);
        expect(result.birdType).toBe('Full Bird');
      } else {
        expect(result.freeAgentStatus).toBeNull();
        expect(result.contractState.terms.salaries.at(-1)?.optionUsed).toBe(
          choice === 'exercise'
        );
        expect(
          result.contractState.terms.salaries.at(-1)?.optionDecisionDate.value
        ).toBe(DEADLINE);
      }

      const replay = projectContractStateAsOf({
        ledger: result.ledger,
        worldId: WORLD_ID,
        contractId: CONTRACT_ID,
        asOfDate: result.event.effectiveAt,
        salaryCapYear: endsContract ? TARGET_YEAR : BASELINE_SALARY_CAP_YEAR,
      });
      expect(replay.state).toBe('projected');
      expect(replay.contractVersion).toBe(2);
      expect(replay.contractState?.stateDigest).toBe(
        result.contractState.stateDigest
      );
    }
  );

  it('projects the exact governed UFA Amount and never creates a fallback hold', () => {
    const result = decideGovernedOption(request('TO', 'decline'));
    expect(result.success).toBe(true);
    if (!result.success) return;
    const player = {
      playerId: PLAYER_ID,
      name: 'Governed Option Player',
      teamCode: TEAM_ID,
      contract: { salariesByYear: [] },
    };
    const applied = applyGovernedOptionResult({
      team: {
        teamCode: TEAM_ID,
        players: [player],
        roster: [PLAYER_ID],
        capHolds: [],
        rightsLedger: rightsFor(),
      },
      playerId: PLAYER_ID,
      result,
    });
    expect(applied.team.players).toEqual([]);
    expect(applied.team.roster).toEqual([]);
    expect(applied.team.capHolds).toEqual([
      expect.objectContaining({
        playerId: PLAYER_ID,
        amount: 21_850_000,
        type: 'Full Bird UFA Amount',
        governedContractEventId: result.event.eventId,
      }),
    ]);
  });
});

describe('governed deadline, notice, shape, and source boundaries', () => {
  it('includes an exact deadline and excludes one millisecond after it', () => {
    expect(decideGovernedOption(request('TO', 'exercise')).success).toBe(true);
    const late = decideGovernedOption(
      request('TO', 'exercise', {
        deliveredAt: '2027-06-29T17:00:00.001-04:00',
      })
    );
    expect(late).toMatchObject({ success: false, status: 'needs-input' });
    if (!late.success) expect(late.reasons.join(' ')).toContain('after');
  });

  it.each([
    [
      'missing deadline',
      { optionDecisionDeadline: unknownTemporal() },
      'exact contractual notice deadline',
    ],
    ['wrong holder', { optionHolder: 'player' }, 'holder evidence'],
    ['missing terms', { optionDecisionTerms: null }, 'shape, protection'],
  ] as const)(
    '%s remains Needs input without mutating the baseline',
    (_, row, reason) => {
      const baseline = baselineFor('TO', { row });
      const before = JSON.stringify(baseline);
      const availability = inspectGovernedOptionDecision({
        authority: resolveGovernedOptionLedgerAuthority({
          baselineLedger: baseline,
          baselineSalaryCapYear: BASELINE_SALARY_CAP_YEAR,
        }),
        worldId: WORLD_ID,
        teamId: TEAM_ID,
        playerId: PLAYER_ID,
        contractId: CONTRACT_ID,
        targetYear: TARGET_YEAR,
        baselineSalaryCapYear: BASELINE_SALARY_CAP_YEAR,
        worldAsOfDate: WORLD_AS_OF_DATE,
      });
      expect(availability.status).toBe('needs-input');
      expect(availability.reasons.join(' ')).toContain(reason);
      expect(JSON.stringify(baseline)).toBe(before);
    }
  );

  it.each([
    [
      'before the window',
      { deliveredAt: '2027-05-31T23:59:59-04:00' },
      'before',
    ],
    ['wrong recipient', { recipient: 'wrong-recipient' }, 'recipient'],
    ['unsupported method', { method: 'facsimile' as const }, 'allowed notice'],
    [
      'late league forwarding',
      { forwardedAt: '2027-07-03T09:00:00-04:00' },
      'two business days',
    ],
    [
      'contradictory receipt chronology',
      { leagueReceivedAt: '2027-06-29T16:59:00-04:00' },
      'chronology',
    ],
  ] as const)('blocks %s before append', (_, overrides, reason) => {
    const result = decideGovernedOption(request('TO', 'exercise', overrides));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reasons.join(' ')).toContain(reason);
  });

  it('does not use the runtime clock or another Season as a legal fallback', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2045-01-01T00:00:00Z'));
    const futureClock = decideGovernedOption(request('PO', 'exercise'));
    vi.setSystemTime(new Date('1995-01-01T00:00:00Z'));
    const pastClock = decideGovernedOption(request('PO', 'exercise'));
    vi.useRealTimers();
    expect(futureClock).toEqual(pastClock);
  });

  it('blocks a contract-ending action before the exact effective boundary', () => {
    const result = decideGovernedOption(
      request('ETO', 'exercise', { worldAsOfDate: '2027-06-30' })
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.reasons.join(' ')).toContain('takes effect');
  });
});

describe('Rookie Scale, rights, and replay refusal', () => {
  it('enforces the adjusted fourth-Season Rookie Scale TO deadline and offer ceiling', () => {
    const baseline = baselineFor('TO', { isRookieScale: true });
    const result = decideGovernedOption(
      request('TO', 'decline', {
        baseline,
        deliveredAt: '2026-11-02T17:00:00-05:00',
        leagueReceivedAt: '2026-11-02T17:01:00-05:00',
        forwardedAt: '2026-11-03T09:00:00-05:00',
      })
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.priorTeamOfferCeiling).toBe(12_200_000);
    expect(result.event.eventKind).toBe('option-decline');

    const wrongDeadline = baselineFor('TO', {
      isRookieScale: true,
      row: { optionDecisionDeadline: instant('2026-10-31T17:00:00-04:00') },
    });
    const unavailable = inspectGovernedOptionDecision({
      authority: resolveGovernedOptionLedgerAuthority({
        baselineLedger: wrongDeadline,
        baselineSalaryCapYear: BASELINE_SALARY_CAP_YEAR,
      }),
      worldId: WORLD_ID,
      teamId: TEAM_ID,
      playerId: PLAYER_ID,
      contractId: CONTRACT_ID,
      targetYear: TARGET_YEAR,
      baselineSalaryCapYear: BASELINE_SALARY_CAP_YEAR,
      worldAsOfDate: WORLD_AS_OF_DATE,
    });
    expect(unavailable.status).toBe('needs-input');
    expect(unavailable.reasons.join(' ')).toContain('2026-11-02');
  });

  it('blocks missing rights and RFA/QO/ROFR depth while retaining options need no rights', () => {
    const missingRights = decideGovernedOption(
      request('TO', 'decline', { rights: null })
    );
    expect(missingRights.success).toBe(false);
    if (!missingRights.success)
      expect(missingRights.reasons.join(' ')).toContain('rights');

    const rfa = decideGovernedOption(
      request('PO', 'decline', { rights: rightsFor({ rfa: true }) })
    );
    expect(rfa.success).toBe(false);
    if (!rfa.success) {
      expect(rfa.reasons.join(' ')).toContain('CBA2-C01.7');
      expect(rfa.reasons.join(' ')).toContain('Right of First Refusal');
    }

    expect(
      decideGovernedOption(request('TO', 'exercise', { rights: null })).success
    ).toBe(true);
  });

  it('refuses a repeated decision and any overlay that rewrites its pinned root', () => {
    const first = decideGovernedOption(request('PO', 'exercise'));
    expect(first.success).toBe(true);
    if (!first.success) return;
    const repeated = decideGovernedOption({
      ...request('PO', 'exercise'),
      authority: resolveGovernedOptionLedgerAuthority({
        baselineLedger: baselineFor('PO'),
        overlayLedger: first.ledger,
        baselineSalaryCapYear: BASELINE_SALARY_CAP_YEAR,
      }),
    });
    expect(repeated).toMatchObject({ success: false, status: 'decided' });

    const rewritten = structuredClone(first.ledger);
    const rewrittenRoot = rewritten.events.find(
      (event) => event.eventKind === 'source-establishment'
    );
    expect(rewrittenRoot).toBeDefined();
    if (!rewrittenRoot) return;
    rewrittenRoot.authoringIdentity = 'rewritten-root';
    expect(() =>
      resolveGovernedOptionLedgerAuthority({
        baselineLedger: baselineFor('PO'),
        overlayLedger: rewritten,
        baselineSalaryCapYear: BASELINE_SALARY_CAP_YEAR,
      })
    ).toThrow('pinned governed baseline root');
  });
});

function compatibilityPlayer(baseline: ContractEventLedgerPayload) {
  const state = baseline.events[0].resultingState;
  return {
    playerId: PLAYER_ID,
    player_id: PLAYER_ID,
    id: PLAYER_ID,
    displayName: 'Governed Option Player',
    name: 'Governed Option Player',
    teamCode: TEAM_ID,
    teamName: 'Detroit Pistons',
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

function computeMutation(
  optionType: GovernedOptionType,
  choice: 'exercise' | 'decline',
  options: { baseline?: ContractEventLedgerPayload; operationId?: string } = {}
) {
  const baseline = options.baseline ?? baselineFor(optionType);
  const player = compatibilityPlayer(baseline);
  const authority = resolveGovernedOptionLedgerAuthority({
    baselineLedger: baseline,
    baselineSalaryCapYear: BASELINE_SALARY_CAP_YEAR,
  });
  return computeWorldMutation({
    mutationType: 'optionDecision',
    payload: {
      teamCode: TEAM_ID,
      playerId: PLAYER_ID,
      contractId: CONTRACT_ID,
      accepted: choice === 'exercise',
      targetYear: TARGET_YEAR,
      optionNotice: request(optionType, choice).notice,
    },
    currentState: {
      teamCode: TEAM_ID,
      player,
      optionAuthority: authority,
      team: {
        teamCode: TEAM_ID,
        roster: [PLAYER_ID],
        players: [player],
        capHolds: [],
        rightsLedger: rightsFor(),
        contractEventLedgers: [],
        totals: { totalSalary: 27_000_000 },
        source: { type: 'world-snapshot', provider: 'fixture' },
      },
    },
    seasonId: '2026-27',
    timestamp: Date.parse('2027-07-01T09:00:00-04:00'),
    asOfDate: WORLD_AS_OF_DATE,
    worldId: WORLD_ID,
    operationId: options.operationId ?? `compute-${optionType}-${choice}`,
    authoringIdentity: 'user-bze-275',
  });
}

const RELEASE_PIN = {
  releaseId: 'bze-275-complete-fixture',
  releaseVersion: 1,
  releaseDigest: `sha256:${'7'.repeat(64)}`,
};

function seedGovernedPersistenceWorld(baseline = baselineFor('TO')): void {
  const world = {
    ...createMockWorld({
      worldId: WORLD_ID,
      userId: 'user-bze-275',
      currentSeason: '2026-27',
      asOfDate: WORLD_AS_OF_DATE,
    }),
    rightsLedgerVersion: 1,
    contractBaselineVersion: 2,
    contractSourceRelease: RELEASE_PIN,
    contractBaselineEffectiveAt: '2026-07-01T00:00:00-04:00',
    contractBaselineSalaryCapYear: BASELINE_SALARY_CAP_YEAR,
    contractBaselineCoverage: { total: 1, complete: 1, needsInput: 0 },
  };
  seedWorldMetadata(WORLD_ID, world);
  const player = compatibilityPlayer(baseline);
  seedTeamSnapshot(
    WORLD_ID,
    TEAM_ID,
    {
      teamCode: TEAM_ID,
      teamName: 'Detroit Pistons',
      season: '2026-27',
      roster: [PLAYER_ID],
      players: [player],
      capHolds: [],
      rightsLedger: rightsFor(),
      contractEventLedgers: [],
      totals: { totalSalary: 27_000_000 },
      source: { type: 'world-snapshot', provider: 'fixture' },
    } as unknown as MockTeam,
    { padRoster: false }
  );
  seedMockData(
    `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`,
    player
  );
  const withoutDigest = {
    documentVersion: 1 as const,
    worldId: WORLD_ID,
    teamId: TEAM_ID,
    shardId: `${TEAM_ID}-000`,
    shardIndex: 0,
    shardCount: 1,
    release: RELEASE_PIN,
    evidenceCatalog: { transformations: [], limitations: [] },
    ledgers: [baseline],
  };
  seedMockData(
    `architect_worlds/${WORLD_ID}/contractBaselines/${TEAM_ID}-000`,
    {
      ...withoutDigest,
      documentDigest: deterministicStateDigest(withoutDigest),
    }
  );
}

describe('governed option mutation, atomic persistence, reload, and branch', () => {
  beforeEach(() => {
    seedBaseData();
  });

  it('computes contract, roster, books, rights, and overlay from one authority', () => {
    const result = computeMutation('TO', 'decline');
    expect(result.success).toBe(true);
    const team = result.teamUpdates?.[0]?.team;
    expect(team?.players).toEqual([]);
    expect(team?.roster).toEqual([]);
    expect(team?.capHolds).toEqual([
      expect.objectContaining({ amount: 21_850_000, active: true }),
    ]);
    expect(team?.contractEventLedgers?.[0]).toMatchObject({
      ledgerVersion: 2,
    });
    const dashboardReload = buildGeneralMutationDashboardReloadTeamSnapshot(
      team ?? null
    );
    expect(dashboardReload?.rightsLedger).toEqual(rightsFor());
    expect(dashboardReload?.contractEventLedgers?.[0]).toMatchObject({
      ledgerVersion: 2,
    });
    expect(result.playerDeletes).toEqual([
      { playerId: PLAYER_ID, teamCode: TEAM_ID },
    ]);
    expect(result.metadata).toMatchObject({
      optionType: 'TO',
      optionDecision: 'decline',
      freeAgentStatus: 'UFA',
      freeAgentAmount: 21_850_000,
      expectedContractOverlayLedgerVersion: null,
    });
  });

  it.each([
    ['TO', 'decline', false],
    ['ETO', 'exercise', true],
    ['ETO', 'decline', false],
  ] as const)(
    'validates %s %s from the governed event instead of a fallback hold',
    (optionType, choice, accepted) => {
      const baseline = baselineFor(optionType);
      const originalPlayer = compatibilityPlayer(baseline);
      const originalTeam = {
        teamCode: TEAM_ID,
        players: [originalPlayer],
        roster: [PLAYER_ID],
        capHolds: [],
        rightsLedger: rightsFor(),
        contractEventLedgers: [],
        totals: { totalSalary: 27_000_000 },
      };
      const result = computeMutation(optionType, choice);
      expect(result.success).toBe(true);
      const updatedTeam = result.teamUpdates?.[0]?.team ?? null;
      const validation = validateOptionDecision({
        originalTeam,
        updatedTeam,
        originalPlayer,
        updatedPlayer:
          result.playerUpdates?.find((entry) => entry.playerId === PLAYER_ID)
            ?.player ?? null,
        accepted,
        targetYear: TARGET_YEAR,
        currentYear: BASELINE_SALARY_CAP_YEAR,
      });
      expect(validation.valid, JSON.stringify(validation)).toBe(true);
      expect(
        validation.warnings.map((warning) => warning.message).join(' ')
      ).not.toContain('fallback multiplier');
    }
  );

  it('commits every resulting surface atomically and reloads it without drift', async () => {
    seedGovernedPersistenceWorld();
    const computed = computeMutation('TO', 'decline');
    expect(computed.success).toBe(true);
    const persisted = await persistWorldMutation({
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'optionDecision',
      computeResult: computed,
      committedTeamUpdates: computed.teamUpdates || [],
      timestamp: Date.parse('2027-07-01T09:00:00-04:00'),
    });
    expect(persisted.success).toBe(true);
    const reloaded = getMockTeamSnapshot(WORLD_ID, TEAM_ID);
    expect(reloaded?.roster).toEqual([]);
    expect(reloaded?.players).toEqual([]);
    expect(reloaded?.capHolds).toEqual([
      expect.objectContaining({
        playerId: PLAYER_ID,
        amount: 21_850_000,
        governedContractEventId: expect.any(String),
      }),
    ]);
    expect(reloaded?.contractEventLedgers?.[0]?.ledgerVersion).toBe(2);
    expect(
      getAllMockData().has(
        `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`
      )
    ).toBe(false);
    const history = toTeamHistoryEventDisplay(
      persisted.event as unknown as Record<string, unknown>,
      { teamCode: TEAM_ID }
    );
    expect(history.summary).toContain('TO declined');
    expect(
      history.detailSections.find((section) => section.title === 'Option')
        ?.lines
    ).toEqual(
      expect.arrayContaining([
        'Decision: Declined — Contract ends at the governed preceding boundary',
      ])
    );
  });

  it('rewrites the persisted overlay identity and replays the same result after branching', async () => {
    const created = await createWorld({
      name: 'BZE-275 overlay parent',
      userId: 'user-bze-275',
    });
    const result = decideGovernedOption(request('TO', 'decline'));
    expect(result.success).toBe(true);
    if (!result.success) return;
    const parentLedger: ContractEventLedgerPayload = {
      ...result.ledger,
      ledgerId: `${created.worldId}:${CONTRACT_ID}:contract`,
      events: result.ledger.events.map((event) => ({
        ...event,
        worldId: created.worldId,
      })),
    };
    seedTeamSnapshot(
      created.worldId,
      TEAM_ID,
      {
        teamCode: TEAM_ID,
        teamName: 'Detroit Pistons',
        season: '2025-26',
        roster: [],
        players: [],
        capHolds: [
          {
            playerId: PLAYER_ID,
            amount: 21_850_000,
            playerName: 'Governed Option Player',
            type: 'Full Bird UFA Amount',
            season: '2027-28',
            isSigned: false,
          },
        ],
        contractEventLedgers: [parentLedger],
        totals: { totalSalary: 0 },
        source: { type: 'world-snapshot', provider: 'fixture' },
      } as unknown as MockTeam,
      { padRoster: false }
    );

    const child = await branchWorld(
      created.worldId,
      'BZE-275 governed branch',
      '',
      'user-bze-275'
    );
    const childTeam = getMockTeamSnapshot(child.worldId, TEAM_ID);
    const childLedger = childTeam?.contractEventLedgers?.[0];
    expect(childLedger?.ledgerId).toBe(
      `${child.worldId}:${CONTRACT_ID}:contract`
    );
    expect(
      childLedger?.events.every((event) => event.worldId === child.worldId)
    ).toBe(true);
    const childReplay = projectContractStateAsOf({
      ledger: childLedger,
      worldId: child.worldId,
      contractId: CONTRACT_ID,
      asOfDate: CONTRACT_ENDS,
      salaryCapYear: TARGET_YEAR,
    });
    expect(childReplay.state).toBe('projected');
    expect(childReplay.contractVersion).toBe(2);
    expect(childReplay.contractState?.stateDigest).toBe(
      result.contractState.stateDigest
    );
    expect(childTeam?.roster).toEqual([]);
    expect(childTeam?.capHolds?.[0]?.amount).toBe(21_850_000);
  });

  it('rejects a stale overlay replacement with no event or team write', async () => {
    seedGovernedPersistenceWorld();
    const stale = computeMutation('TO', 'exercise', {
      operationId: 'stale-option',
    });
    const winner = computeMutation('TO', 'exercise', {
      operationId: 'winning-option',
    });
    expect(stale.success).toBe(true);
    expect(winner.success).toBe(true);
    const winningTeam = winner.teamUpdates?.[0]?.team;
    if (!winningTeam) throw new Error('winning fixture must produce a team');
    seedTeamSnapshot(WORLD_ID, TEAM_ID, winningTeam as unknown as MockTeam, {
      padRoster: false,
    });
    const before = JSON.stringify(getMockTeamSnapshot(WORLD_ID, TEAM_ID));
    const result = await persistWorldMutation({
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'optionDecision',
      computeResult: stale,
      committedTeamUpdates: stale.teamUpdates || [],
      timestamp: Date.parse('2027-07-01T09:00:00-04:00'),
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toContain('changed before commit');
    expect(JSON.stringify(getMockTeamSnapshot(WORLD_ID, TEAM_ID))).toBe(before);
  });

  it('keeps a blocked record and an incompatible older world byte-unchanged', async () => {
    const missingDeadline = baselineFor('TO', {
      row: { optionDecisionDeadline: unknownTemporal() },
    });
    const blocked = computeMutation('TO', 'exercise', {
      baseline: missingDeadline,
    });
    expect(blocked.success).toBe(false);
    expect(blocked.teamUpdates).toBeUndefined();

    const oldWorld = createMockWorld({
      worldId: 'old-world-bze-275',
      userId: 'user-bze-275',
      asOfDate: WORLD_AS_OF_DATE,
    });
    seedWorldMetadata(oldWorld.worldId, oldWorld);
    const before = [...getAllMockData().entries()];
    await expect(
      loadWorldGovernedOptionEntries({
        worldId: oldWorld.worldId,
        teamId: TEAM_ID,
        worldAsOfDate: WORLD_AS_OF_DATE,
      })
    ).rejects.toThrow('predates governed baseline contracts');
    expect([...getAllMockData().entries()]).toEqual(before);
  });
});
