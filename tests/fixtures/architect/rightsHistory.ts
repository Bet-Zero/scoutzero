import {
  RIGHTS_EVENT_LEDGER_PAYLOAD_VERSION,
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
  governedSalaryCapYear: number,
  overrides: Partial<RightsServiceSeason> = {}
): RightsServiceSeason {
  const governedSeasonStartYear = governedSalaryCapYear - 1;
  return {
    serviceRecordId: `service-${salaryCapYear}`,
    serviceRecordVersion: 1,
    salaryCapYear,
    serviceStatus: qualified ? 'credited' : 'not-credited',
    creditedTeamId: qualified ? RIGHTS_FIXTURE_TEAM_ID : null,
    rightsTeamId: RIGHTS_FIXTURE_TEAM_ID,
    continuityRoute: qualified ? 'same-team' : 'not-applicable',
    continuityEventId: null,
    source: makeRightsSource(`service-${salaryCapYear}-source`, {
      effectiveFrom: `${governedSeasonStartYear}-07-01`,
      effectiveThrough: `${governedSalaryCapYear}-06-30`,
    }),
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
  salaryCapYear = RIGHTS_FIXTURE_SALARY_CAP_YEAR,
  amountOverrides = {},
  freeAgentStatus = 'UFA',
  rightOfFirstRefusal = 'not-applicable',
  eventOverrides = {},
}: {
  qualifiedSeasons?: number;
  salaryCapYear?: number;
  amountOverrides?: Partial<Record<FreeAgentAmountKind, number>>;
  freeAgentStatus?: 'UFA' | 'RFA';
  rightOfFirstRefusal?: 'active' | 'inactive' | 'not-applicable';
  eventOverrides?: Partial<RightsEstablishedEvent>;
} = {}): RightsEstablishedEvent {
  const seasonStartYear = salaryCapYear - 1;
  const governedSourceWindow = {
    effectiveFrom: `${seasonStartYear}-07-01`,
    effectiveThrough: `${salaryCapYear}-06-30`,
  };
  const amounts = { ...DEFAULT_AMOUNTS, ...amountOverrides };
  const amountRecords = Object.entries(amounts).map(([kind, amount]) => ({
    amountRecordId: `amount-${kind}`,
    amountRecordVersion: 1,
    kind: kind as FreeAgentAmountKind,
    salaryCapYear,
    amount,
    source: makeRightsSource(`amount-${kind}-source`, governedSourceWindow),
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
    salaryCapYear,
    executedAt: `${seasonStartYear}-07-01`,
    effectiveAt: `${seasonStartYear}-07-01`,
    recordedAt: `${seasonStartYear}-07-01T16:00:00Z`,
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
    serviceHistoryCompleteFromSalaryCapYear: salaryCapYear - 3,
    serviceSeasons: [
      makeServiceSeason(
        salaryCapYear - 1,
        qualifiedSeasons >= 1,
        salaryCapYear
      ),
      makeServiceSeason(
        salaryCapYear - 2,
        qualifiedSeasons >= 2,
        salaryCapYear
      ),
      makeServiceSeason(
        salaryCapYear - 3,
        qualifiedSeasons >= 3,
        salaryCapYear
      ),
    ],
    priorContract: {
      contractId: 'contract-bze-273',
      contractVersion: 4,
      finalSalaryCapYear: salaryCapYear - 1,
      wasOneSeasonMinimumContract: false,
      wasRookieScaleFourthYear: false,
      source: makeRightsSource('prior-contract-source', governedSourceWindow),
    },
    amountRecords,
    ...eventOverrides,
  };
}

export function makeRightsLedger(
  event: RightsEstablishedEvent = makeRightsEstablishedEvent()
): RightsEventLedgerPayload {
  return createRightsEventLedger({
    payloadVersion: RIGHTS_EVENT_LEDGER_PAYLOAD_VERSION,
    ledgerId: 'rights-ledger',
    ledgerVersion: 1,
    worldId: event.worldId,
    teamId: event.teamId,
    events: [event],
  });
}

export function makeRightsLedgerForIdentity({
  worldId,
  teamId,
  playerId,
  qualifiedSeasons = 3,
  salaryCapYear = RIGHTS_FIXTURE_SALARY_CAP_YEAR,
}: {
  worldId: string;
  teamId: string;
  playerId: string;
  qualifiedSeasons?: number;
  salaryCapYear?: number;
}): RightsEventLedgerPayload {
  const event = makeRightsEstablishedEvent({
    qualifiedSeasons,
    salaryCapYear,
  });
  return makeRightsLedger({
    ...event,
    worldId,
    teamId,
    playerId,
    serviceSeasons: event.serviceSeasons.map((entry) => ({
      ...entry,
      creditedTeamId: entry.creditedTeamId === null ? null : teamId,
      rightsTeamId: teamId,
    })),
  });
}
