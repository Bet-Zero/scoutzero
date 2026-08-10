/**
 * FILE: tests/architect/contractHistory/contractHistoryFixtures.ts
 * PURPOSE: Shared contract-event fixtures for the BZE-271 history suites.
 *
 * Every instant sits inside Salary Cap Year 2027 (2026-07-01 through
 * 2027-06-30 Eastern) so a fixture never fails for a reason the test is not
 * about. Dates are written as explicit UTC instants because the ledger accepts
 * only zoned instants.
 */

import type {
  ContractEventKind,
  ContractEventRecord,
  GovernedContractState,
} from '@/features/architect/utils/contractHistory';
import { deterministicStateDigest } from '@/features/architect/utils/contractSource/deterministicDigest';

export const WORLD_ID = 'world-bze271';
export const CONTRACT_ID = 'contract-0001';
export const PLAYER_ID = 'player-0001';
export const TEAM_ID = 'team-BOS';
export const SALARY_CAP_YEAR = 2027;

/** Inside Salary Cap Year 2027 and after every fixture event. */
export const AS_OF_LATE = '2027-03-01T12:00:00Z';
/** Inside Salary Cap Year 2027 and before every fixture event. */
export const AS_OF_BEFORE_SIGNING = '2026-07-02T00:00:00Z';

export interface EventOverrides {
  eventId?: string;
  eventVersion?: number;
  eventKind?: ContractEventKind;
  worldId?: string;
  contractId?: string;
  playerId?: string;
  teamId?: string;
  executedAt?: string;
  effectiveAt?: string;
  recordedAt?: string;
  predecessorContractVersion?: number | null;
  resultingContractVersion?: number;
  predecessorEventId?: string | null;
  sourceTransactionId?: string | null;
  authoringIdentity?: string | null;
  recordStatus?: 'current' | 'superseded';
  supersedesEventVersion?: number | null;
  canonLeafIds?: readonly string[];
  resultingState?: GovernedContractState;
}

export function makeResultingState(
  overrides: Partial<GovernedContractState> & {
    contractId?: string;
    contractVersion?: number;
    playerId?: string;
    teamId?: string;
    establishmentKind?: 'signing' | 'source-establishment';
  } = {}
): GovernedContractState {
  const stateWithoutDigest: Omit<GovernedContractState, 'stateDigest'> = {
    stateVersion: 1,
    contractId: overrides.contractId ?? CONTRACT_ID,
    contractVersion: overrides.contractVersion ?? 2,
    playerId: overrides.playerId ?? PLAYER_ID,
    teamId: overrides.teamId ?? TEAM_ID,
    establishmentKind: overrides.establishmentKind ?? 'signing',
    terms: overrides.terms ?? {
      contractType: 'VETERAN CONTRACT',
      isExtension: false,
      isRookieScale: false,
      signedUsing: 'Bird Exception',
      signingTeam: TEAM_ID,
      signingDate: {
        precision: 'date',
        value: '2026-07-05',
        rawValue: '2026-07-05',
      },
      signingExecutive: null,
      signedByCurrentTeam: true,
      startSeason: '2026-27',
      endSeason: '2027-28',
      contractLength: 2,
      totalValue: 20000000,
      averageAnnualValue: 10000000,
      guaranteedValue: 20000000,
      guaranteedYears: 2,
      salaries: [],
      bonuses: { tradeKickerPercent: null },
      restrictions: {
        noTradeClause: false,
        tradeRestrictions: [],
        canBeTradedNow: null,
        restrictedUntil: {
          precision: 'unknown',
          value: null,
          rawValue: null,
        },
        reason: null,
        baseYearCompensation: null,
        poisonPill: null,
        aggregation: null,
      },
      birdRights: {
        status: null,
        yearsOfService: null,
        yearsWithTeam: null,
        eligibleFor: [],
      },
      freeAgency: {
        type: null,
        year: null,
        capHold: null,
        qualifyingOffer: null,
        earlyTerminationOption: null,
        hasOption: null,
        optionYear: null,
        optionType: null,
      },
      sourceLimitations: ['Fixture source only.'],
    },
    evidence: overrides.evidence ?? [],
    completeness: overrides.completeness ?? {
      status: 'complete',
      reasons: [],
    },
    source: overrides.source ?? {
      releaseId: 'fixture-release',
      releaseVersion: 1,
      releaseDigest: `sha256:${'1'.repeat(64)}`,
      sourceProvider: 'fixture',
      sourceRecordVersion: '1',
      sourceObservationId: 'fixture-observation',
      sourceArtifactSha256: `sha256:${'2'.repeat(64)}`,
      sourceContractPath: 'contract',
    },
  };
  return {
    ...stateWithoutDigest,
    stateDigest: deterministicStateDigest(stateWithoutDigest),
  };
}

/**
 * One event with sound defaults. Defaults describe an amendment succeeding
 * contract version 1, so a test that cares about one field overrides that field
 * alone.
 */
export function makeEvent(overrides: EventOverrides = {}): ContractEventRecord {
  const eventKind = overrides.eventKind ?? 'amendment';
  const isRoot = eventKind === 'signing' || eventKind === 'source-establishment';
  const resultingContractVersion = overrides.resultingContractVersion ?? 2;

  return {
    eventId: overrides.eventId ?? 'evt-002',
    eventVersion: overrides.eventVersion ?? 1,
    eventKind,
    worldId: overrides.worldId ?? WORLD_ID,
    contractId: overrides.contractId ?? CONTRACT_ID,
    playerId: overrides.playerId ?? PLAYER_ID,
    teamId: overrides.teamId ?? TEAM_ID,
    executedAt: overrides.executedAt ?? '2026-08-01T15:00:00Z',
    effectiveAt: overrides.effectiveAt ?? '2026-08-01T15:00:00Z',
    recordedAt: overrides.recordedAt ?? '2026-08-01T15:00:00Z',
    predecessorContractVersion:
      overrides.predecessorContractVersion !== undefined
        ? overrides.predecessorContractVersion
        : isRoot
          ? null
          : 1,
    resultingContractVersion,
    predecessorEventId:
      overrides.predecessorEventId !== undefined
        ? overrides.predecessorEventId
        : isRoot
          ? null
          : 'evt-001',
    sourceTransactionId:
      overrides.sourceTransactionId !== undefined
        ? overrides.sourceTransactionId
        : 'txn-0002',
    authoringIdentity:
      overrides.authoringIdentity !== undefined
        ? overrides.authoringIdentity
        : null,
    recordStatus: overrides.recordStatus ?? 'current',
    supersedesEventVersion:
      overrides.supersedesEventVersion !== undefined
        ? overrides.supersedesEventVersion
        : null,
    canonLeafIds: overrides.canonLeafIds ?? ['CBA2-L02.1'],
    resultingState:
      overrides.resultingState ??
      makeResultingState({
        contractId: overrides.contractId ?? CONTRACT_ID,
        contractVersion: resultingContractVersion,
        playerId: overrides.playerId ?? PLAYER_ID,
        teamId: overrides.teamId ?? TEAM_ID,
        establishmentKind:
          eventKind === 'source-establishment'
            ? 'source-establishment'
            : 'signing',
      }),
  };
}

/** The root signing every chain fixture starts from. */
export function signingEvent(
  overrides: EventOverrides = {}
): ContractEventRecord {
  return makeEvent({
    eventId: 'evt-001',
    eventKind: 'signing',
    executedAt: '2026-07-05T18:00:00Z',
    effectiveAt: '2026-07-06T18:00:00Z',
    recordedAt: '2026-07-06T18:00:00Z',
    resultingContractVersion: 1,
    sourceTransactionId: 'txn-0001',
    ...overrides,
  });
}

interface ChainStep {
  readonly eventId: string;
  readonly eventKind: ContractEventKind;
  readonly effectiveAt: string;
  readonly executedAt: string;
}

/**
 * The nine lifecycle kinds in one chain, one contract version per event. Kinds
 * are ordered only so the fixture reads as a plausible season; the ledger
 * imposes no order between kinds.
 */
const CHAIN_STEPS: readonly ChainStep[] = [
  {
    eventId: 'evt-002',
    eventKind: 'amendment',
    executedAt: '2026-08-01T15:00:00Z',
    effectiveAt: '2026-08-01T15:00:00Z',
  },
  {
    eventId: 'evt-003',
    eventKind: 'conversion',
    executedAt: '2026-09-15T15:00:00Z',
    effectiveAt: '2026-09-15T15:00:00Z',
  },
  {
    eventId: 'evt-004',
    eventKind: 'option-exercise',
    executedAt: '2026-10-20T15:00:00Z',
    effectiveAt: '2026-10-20T15:00:00Z',
  },
  {
    eventId: 'evt-005',
    eventKind: 'option-decline',
    executedAt: '2026-11-05T15:00:00Z',
    effectiveAt: '2026-11-05T15:00:00Z',
  },
  {
    eventId: 'evt-006',
    eventKind: 'eto-exercise',
    executedAt: '2026-12-01T15:00:00Z',
    effectiveAt: '2026-12-01T15:00:00Z',
  },
  {
    eventId: 'evt-007',
    eventKind: 'eto-decline',
    executedAt: '2027-01-10T15:00:00Z',
    effectiveAt: '2027-01-10T15:00:00Z',
  },
  {
    eventId: 'evt-008',
    eventKind: 'extension',
    executedAt: '2027-02-14T15:00:00Z',
    effectiveAt: '2027-02-14T15:00:00Z',
  },
  {
    eventId: 'evt-009',
    eventKind: 'renegotiation',
    executedAt: '2027-02-20T15:00:00Z',
    effectiveAt: '2027-02-20T15:00:00Z',
  },
];

/**
 * A full nine-event history: one signing plus the eight other lifecycle kinds,
 * producing contract versions 1 through 9.
 */
export function fullLifecycleEvents(): ContractEventRecord[] {
  const events: ContractEventRecord[] = [signingEvent()];

  CHAIN_STEPS.forEach((step, index) => {
    events.push(
      makeEvent({
        eventId: step.eventId,
        eventKind: step.eventKind,
        executedAt: step.executedAt,
        effectiveAt: step.effectiveAt,
        recordedAt: step.effectiveAt,
        predecessorContractVersion: index + 1,
        resultingContractVersion: index + 2,
        predecessorEventId: events[index].eventId,
        sourceTransactionId: `txn-${String(index + 2).padStart(4, '0')}`,
      })
    );
  });

  return events;
}

/** Signing plus one amendment — the smallest chain with a predecessor link. */
export function twoEventChain(): ContractEventRecord[] {
  return [signingEvent(), makeEvent()];
}

export const LEDGER_ID = 'ledger-bze271';
