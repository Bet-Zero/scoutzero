import {
  createRightsEventLedger,
  type FreeAgentAmountKind,
  type RightsEstablishedEvent,
  type RightsEventLedgerPayload,
  type RightsServiceSeason,
  type RightsSourceReference,
} from '@/features/architect/utils/rightsHistory';

export const RIGHTS_FIXTURE_WORLD_ID = 'world-bze-273';
export const RIGHTS_FIXTURE_TEAM_ID = 'DET';
export const RIGHTS_FIXTURE_PLAYER_ID = 'player-bze-273';
export const RIGHTS_FIXTURE_SALARY_CAP_YEAR = 2027;
export const RIGHTS_FIXTURE_AS_OF_DATE = '2026-07-15';

export function makeRightsSource(
  sourceId: string,
  overrides: Partial<RightsSourceReference> = {}
): RightsSourceReference {
  return {
    sourceId,
    sourceVersion: 1,
    authority: 'official',
    artifact: 'governed-bze-273-fixture',
    field: sourceId,
    effectiveFrom: '2026-07-01',
    effectiveThrough: '2027-06-30',
    recordStatus: 'current',
    supersedesSourceVersion: null,
    ...overrides,
  };
}

function makeServiceSeason(
  salaryCapYear: number,
  qualified: boolean,
  overrides: Partial<RightsServiceSeason> = {}
): RightsServiceSeason {
  return {
    serviceRecordId: `service-${salaryCapYear}`,
    serviceRecordVersion: 1,
    salaryCapYear,
    serviceStatus: qualified ? 'credited' : 'not-credited',
    creditedTeamId: qualified ? RIGHTS_FIXTURE_TEAM_ID : null,
    rightsTeamId: RIGHTS_FIXTURE_TEAM_ID,
    continuityRoute: qualified ? 'same-team' : 'not-applicable',
    continuityEventId: null,
    source: makeRightsSource(`service-${salaryCapYear}-source`),
    recordStatus: 'current',
    supersedesServiceRecordVersion: null,
    ...overrides,
  };
}

const DEFAULT_AMOUNTS: Readonly<Record<FreeAgentAmountKind, number>> = {
  'prior-regular-salary': 10_000_000,
  'prior-signing-bonus-allocation': 1_000_000,
  'earned-performance-bonuses': 500_000,
  'applicable-minimum-salary': 1_500_000,
  'two-years-service-minimum-salary': 2_000_000,
  'applicable-maximum-salary': 30_000_000,
  'estimated-average-player-salary': 12_000_000,
};

export function makeRightsEstablishedEvent({
  qualifiedSeasons = 3,
  amountOverrides = {},
  freeAgentStatus = 'UFA',
  rightOfFirstRefusal = 'not-applicable',
  eventOverrides = {},
}: {
  qualifiedSeasons?: number;
  amountOverrides?: Partial<Record<FreeAgentAmountKind, number>>;
  freeAgentStatus?: 'UFA' | 'RFA';
  rightOfFirstRefusal?: 'active' | 'inactive' | 'not-applicable';
  eventOverrides?: Partial<RightsEstablishedEvent>;
} = {}): RightsEstablishedEvent {
  const amounts = { ...DEFAULT_AMOUNTS, ...amountOverrides };
  const amountRecords = Object.entries(amounts).map(([kind, amount]) => ({
    amountRecordId: `amount-${kind}`,
    amountRecordVersion: 1,
    kind: kind as FreeAgentAmountKind,
    salaryCapYear: RIGHTS_FIXTURE_SALARY_CAP_YEAR,
    amount,
    source: makeRightsSource(`amount-${kind}-source`),
    recordStatus: 'current' as const,
    supersedesAmountRecordVersion: null,
  }));

  return {
    eventId: 'rights-established-player-bze-273',
    eventVersion: 1,
    eventKind: 'rights-established',
    worldId: RIGHTS_FIXTURE_WORLD_ID,
    playerId: RIGHTS_FIXTURE_PLAYER_ID,
    teamId: RIGHTS_FIXTURE_TEAM_ID,
    salaryCapYear: RIGHTS_FIXTURE_SALARY_CAP_YEAR,
    executedAt: '2026-07-01',
    effectiveAt: '2026-07-01',
    recordedAt: '2026-07-01T16:00:00Z',
    predecessorEventId: null,
    predecessorState: null,
    resultingState: {
      stateId: 'rights-ledger:player-bze-273:rights-state',
      stateVersion: 1,
    },
    provenance: {
      sourceTransactionId: 'source-transaction-bze-273',
      authoringIdentity: 'fixture-author',
    },
    recordStatus: 'current',
    supersedesEventVersion: null,
    canonLeafIds: [
      'CBA2-C01.2',
      'CBA2-C01.3',
      'CBA2-C01.4',
      'CBA2-C01.5',
      'CBA2-C01.6',
      'CBA2-C14.1',
      'CBA2-C14.2',
      'CBA2-C14.3',
      'CBA2-C14.4',
    ],
    freeAgentStatus,
    rightOfFirstRefusal,
    serviceHistoryCompleteFromSalaryCapYear: 2024,
    serviceSeasons: [
      makeServiceSeason(2026, qualifiedSeasons >= 1),
      makeServiceSeason(2025, qualifiedSeasons >= 2),
      makeServiceSeason(2024, qualifiedSeasons >= 3),
    ],
    priorContract: {
      contractId: 'contract-bze-273',
      contractVersion: 4,
      finalSalaryCapYear: 2026,
      wasOneSeasonMinimumContract: false,
      wasRookieScaleFourthYear: false,
      source: makeRightsSource('prior-contract-source'),
    },
    amountRecords,
    ...eventOverrides,
  };
}

export function makeRightsLedger(
  event: RightsEstablishedEvent = makeRightsEstablishedEvent()
): RightsEventLedgerPayload {
  return createRightsEventLedger({
    payloadVersion: 1,
    ledgerId: 'rights-ledger',
    ledgerVersion: 1,
    worldId: event.worldId,
    teamId: event.teamId,
    events: [event],
  });
}
