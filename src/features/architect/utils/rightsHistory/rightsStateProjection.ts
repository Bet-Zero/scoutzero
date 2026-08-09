/** Deterministic dated projection of Bird status and Free Agent Amount. */

import {
  type BirdRightsType,
  type FreeAgentAmountKind,
  type FreeAgentAmountRecord,
  type FreeAgentStatus,
  type RightOfFirstRefusalStatus,
  type RightsEstablishedEvent,
  type RightsEventLedgerPayload,
  type RightsEventRecord,
  type RightsStateReference,
} from '@/schemas/rightsEventLedger';
import {
  isSupportedSalaryCapYear,
  isDateOnly,
  isDateOnlyWithinSalaryCapYear,
  isWithinSalaryCapYear,
  isZonedDateTime,
  parseZonedDateTime,
} from '@/features/architect/utils/governedSeason';
import {
  createRightsEventLedger,
  walkRightsChain,
} from './rightsEventLedger';

export type RightsProjectionStatus =
  | 'available'
  | 'renounced'
  | 'needs-input'
  | 'incompatible';

export type PostRenunciationSigningAuthority =
  | 'Room'
  | 'Minimum Exception'
  | 'Two-Way';

const POST_RENUNCIATION_SIGNING_AUTHORITIES = Object.freeze([
  'Room',
  'Minimum Exception',
  'Two-Way',
] as const satisfies readonly PostRenunciationSigningAuthority[]);

export interface DatedRightsStateProjection {
  readonly status: RightsProjectionStatus;
  readonly worldId: string | null;
  readonly teamId: string | null;
  readonly playerId: string | null;
  readonly asOfDate: string | null;
  readonly salaryCapYear: number | null;
  readonly ledgerReference: {
    readonly ledgerId: string;
    readonly ledgerVersion: number;
  } | null;
  readonly stateReference: RightsStateReference | null;
  readonly birdType: BirdRightsType | 'None' | null;
  readonly signingBirdType: BirdRightsType | 'None' | null;
  readonly freeAgentStatus: FreeAgentStatus | null;
  readonly rightOfFirstRefusal: RightOfFirstRefusalStatus | null;
  readonly freeAgentAmount: number | null;
  readonly postRenunciationSigningAuthorities: readonly PostRenunciationSigningAuthority[];
  readonly consumedEventIds: readonly string[];
  readonly reasons: readonly string[];
}

export interface DatedRightsProjectionRequest {
  ledger?: unknown;
  worldId?: string | null;
  teamId?: string | null;
  playerId?: string | null;
  asOfDate?: string | null;
  salaryCapYear?: number | null;
}

const REQUIRED_AMOUNT_KINDS: readonly FreeAgentAmountKind[] = Object.freeze([
  'prior-regular-salary',
  'prior-signing-bonus-allocation',
  'earned-performance-bonuses',
  'applicable-minimum-salary',
  'two-years-service-minimum-salary',
  'applicable-maximum-salary',
  'estimated-average-player-salary',
]);

function frozen<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function unavailable(
  request: DatedRightsProjectionRequest,
  reasons: readonly string[],
  status: 'needs-input' | 'incompatible' = 'needs-input',
  ledger: RightsEventLedgerPayload | null = null
): DatedRightsStateProjection {
  return frozen({
    status,
    worldId: typeof request.worldId === 'string' ? request.worldId : null,
    teamId: typeof request.teamId === 'string' ? request.teamId : null,
    playerId: typeof request.playerId === 'string' ? request.playerId : null,
    asOfDate:
      isZonedDateTime(request.asOfDate) || isDateOnly(request.asOfDate)
        ? request.asOfDate
        : null,
    salaryCapYear: isSupportedSalaryCapYear(request.salaryCapYear)
      ? (request.salaryCapYear as number)
      : null,
    ledgerReference: ledger
      ? frozen({
          ledgerId: ledger.ledgerId,
          ledgerVersion: ledger.ledgerVersion,
        })
      : null,
    stateReference: null,
    birdType: null,
    signingBirdType: null,
    freeAgentStatus: null,
    rightOfFirstRefusal: null,
    freeAgentAmount: null,
    postRenunciationSigningAuthorities: Object.freeze([]),
    consumedEventIds: Object.freeze([]),
    reasons: Object.freeze([...reasons]),
  });
}

function sourceSupportsEvent(
  source: RightsEstablishedEvent['priorContract']['source'],
  effectiveAt: string
): boolean {
  const effectiveDate = effectiveAt.slice(0, 10);
  return (
    source.recordStatus === 'current' &&
    source.effectiveFrom <= effectiveDate &&
    source.effectiveThrough >= effectiveDate
  );
}

function resolveBirdType(
  event: RightsEstablishedEvent,
  salaryCapYear: number,
  reasons: string[]
): BirdRightsType | null {
  if (event.serviceHistoryCompleteFromSalaryCapYear > salaryCapYear - 3) {
    reasons.push(
      `Service history is not declared complete through Salary Cap Year ${salaryCapYear - 3}.`
    );
    return null;
  }

  const currentRows = event.serviceSeasons.filter(
    (entry) => entry.recordStatus === 'current'
  );
  const byYear = new Map<number, (typeof currentRows)[number]>();
  for (const entry of currentRows) {
    if (byYear.has(entry.salaryCapYear)) {
      reasons.push(
        `Conflicting current service records exist for Salary Cap Year ${entry.salaryCapYear}.`
      );
      return null;
    }
    byYear.set(entry.salaryCapYear, entry);
  }

  const qualifying: boolean[] = [];
  for (let offset = 1; offset <= 3; offset += 1) {
    const expectedYear = salaryCapYear - offset;
    const entry = byYear.get(expectedYear);
    if (!entry) {
      reasons.push(
        `A governed service record is missing for Salary Cap Year ${expectedYear}.`
      );
      return null;
    }
    if (!sourceSupportsEvent(entry.source, event.effectiveAt)) {
      reasons.push(
        `Service record ${entry.serviceRecordId}@v${entry.serviceRecordVersion} has stale or out-of-window provenance.`
      );
      return null;
    }
    if (entry.serviceStatus === 'not-credited') {
      if (
        entry.creditedTeamId !== null ||
        entry.continuityRoute !== 'not-applicable' ||
        entry.continuityEventId !== null
      ) {
        reasons.push(
          `Non-credited service record ${entry.serviceRecordId} carries unsupported continuity data.`
        );
        return null;
      }
      qualifying.push(false);
      continue;
    }
    const sameTeam =
      entry.continuityRoute === 'same-team' &&
      entry.creditedTeamId === event.teamId &&
      entry.rightsTeamId === event.teamId &&
      entry.continuityEventId === null;
    const supportedChange =
      entry.continuityRoute !== 'same-team' &&
      entry.continuityRoute !== 'not-applicable' &&
      entry.creditedTeamId !== null &&
      entry.rightsTeamId === event.teamId &&
      entry.continuityEventId !== null;
    if (!sameTeam && !supportedChange) {
      reasons.push(
        `Credited service record ${entry.serviceRecordId} has inconsistent or unsupported continuity evidence.`
      );
      return null;
    }
    qualifying.push(true);
  }

  if (qualifying[0] && qualifying[1] && qualifying[2]) return 'Full Bird';
  if (qualifying[0] && qualifying[1]) return 'Early Bird';
  return 'Non-Bird';
}

function currentAmountRecords(
  event: RightsEstablishedEvent,
  salaryCapYear: number,
  reasons: string[]
): ReadonlyMap<FreeAgentAmountKind, FreeAgentAmountRecord> | null {
  const amounts = new Map<FreeAgentAmountKind, FreeAgentAmountRecord>();
  let hasMissingRequiredAmount = false;
  for (const record of event.amountRecords) {
    if (record.recordStatus !== 'current') continue;
    if (record.salaryCapYear !== salaryCapYear) continue;
    if (amounts.has(record.kind)) {
      reasons.push(`Conflicting current ${record.kind} amount records exist.`);
      return null;
    }
    if (!sourceSupportsEvent(record.source, event.effectiveAt)) {
      reasons.push(
        `Amount record ${record.amountRecordId}@v${record.amountRecordVersion} has stale or out-of-window provenance.`
      );
      return null;
    }
    amounts.set(record.kind, record);
  }
  for (const kind of REQUIRED_AMOUNT_KINDS) {
    if (!amounts.has(kind)) {
      hasMissingRequiredAmount = true;
      reasons.push(
        `The governed ${kind} input is missing for Salary Cap Year ${salaryCapYear}.`
      );
    }
  }
  return hasMissingRequiredAmount ? null : amounts;
}

function calculateFreeAgentAmount(
  event: RightsEstablishedEvent,
  birdType: BirdRightsType,
  salaryCapYear: number,
  reasons: string[]
): number | null {
  if (
    event.priorContract.finalSalaryCapYear !== salaryCapYear - 1 ||
    !sourceSupportsEvent(event.priorContract.source, event.effectiveAt)
  ) {
    reasons.push(
      'Prior-contract evidence is stale, out of window, or does not immediately precede this Salary Cap Year.'
    );
    return null;
  }
  const amounts = currentAmountRecords(event, salaryCapYear, reasons);
  if (!amounts) return null;

  const value = (kind: FreeAgentAmountKind) => amounts.get(kind)?.amount ?? 0;
  const minimum = value('applicable-minimum-salary');
  const maximum = value('applicable-maximum-salary');
  if (minimum > maximum) {
    reasons.push('Applicable minimum salary exceeds applicable maximum salary.');
    return null;
  }

  if (event.priorContract.wasOneSeasonMinimumContract) {
    return Math.min(
      maximum,
      Math.min(minimum, value('two-years-service-minimum-salary'))
    );
  }

  const base =
    value('prior-regular-salary') +
    value('prior-signing-bonus-allocation') +
    value('earned-performance-bonuses');
  const belowEaps = base < value('estimated-average-player-salary');
  let multiplier: number;
  if (birdType === 'Full Bird') {
    multiplier = event.priorContract.wasRookieScaleFourthYear
      ? belowEaps
        ? 3
        : 2.5
      : belowEaps
        ? 1.9
        : 1.5;
  } else if (birdType === 'Early Bird') {
    multiplier = 1.3;
  } else {
    multiplier = 1.2;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(base * multiplier)));
}

/**
 * Replay the exact current chain at an explicit instant. No player snapshot,
 * cap-hold amount, runtime clock, or hardcoded cap table is consulted.
 */
export function projectRightsStateAsOf(
  request: DatedRightsProjectionRequest = {}
): DatedRightsStateProjection {
  const missing: string[] = [];
  if (typeof request.worldId !== 'string' || !request.worldId.trim())
    missing.push('worldId');
  if (typeof request.teamId !== 'string' || !request.teamId.trim())
    missing.push('teamId');
  if (typeof request.playerId !== 'string' || !request.playerId.trim())
    missing.push('playerId');
  if (!isZonedDateTime(request.asOfDate) && !isDateOnly(request.asOfDate))
    missing.push('asOfDate');
  if (!isSupportedSalaryCapYear(request.salaryCapYear))
    missing.push('salaryCapYear');
  if (request.ledger == null) missing.push('ledger');
  if (missing.length > 0) {
    return unavailable(
      request,
      [`Required governed input(s) missing: ${missing.join(', ')}.`]
    );
  }

  let ledger: RightsEventLedgerPayload;
  try {
    ledger = createRightsEventLedger(request.ledger);
  } catch (error) {
    return unavailable(
      request,
      [error instanceof Error ? error.message : 'Rights ledger is unreadable.'],
      'incompatible'
    );
  }
  const asOfDate = request.asOfDate as string;
  const salaryCapYear = request.salaryCapYear as number;
  const worldId = request.worldId as string;
  const teamId = request.teamId as string;
  const playerId = request.playerId as string;
  if (
    ledger.worldId !== worldId ||
    ledger.teamId !== teamId ||
    !(
      (isZonedDateTime(asOfDate) &&
        isWithinSalaryCapYear(asOfDate, salaryCapYear)) ||
      (isDateOnly(asOfDate) &&
        isDateOnlyWithinSalaryCapYear(asOfDate, salaryCapYear))
    )
  ) {
    return unavailable(
      request,
      [
        'The rights ledger identity or the governed as-of date does not match this world, team, and Salary Cap Year.',
      ],
      'incompatible',
      ledger
    );
  }

  const chain = walkRightsChain(ledger, playerId, salaryCapYear);
  if (!chain || chain.length === 0) {
    return unavailable(
      request,
      ['No complete governed rights history exists for this player.'],
      'needs-input',
      ledger
    );
  }
  const effective = chain.filter((event) => {
    if (isDateOnly(asOfDate)) {
      return event.effectiveAt.slice(0, 10) <= asOfDate;
    }
    const asOfTime = parseZonedDateTime(asOfDate) as number;
    const eventTime = parseZonedDateTime(event.effectiveAt);
    return eventTime !== null && eventTime <= asOfTime;
  });
  if (effective.length === 0) {
    return unavailable(
      request,
      ['The governed rights history is not effective at the requested date.'],
      'needs-input',
      ledger
    );
  }
  const root = effective[0];
  if (
    root.eventKind !== 'rights-established' ||
    root.salaryCapYear !== salaryCapYear
  ) {
    return unavailable(
      request,
      ['The current Salary Cap Year has no compatible rights-establishment event.'],
      'needs-input',
      ledger
    );
  }

  const latest = effective[effective.length - 1];
  const consumedEventIds = Object.freeze(
    effective.map((event) => `${event.eventId}@v${event.eventVersion}`)
  );
  const ledgerReference = frozen({
    ledgerId: ledger.ledgerId,
    ledgerVersion: ledger.ledgerVersion,
  });
  if (latest.eventKind === 'rights-renounced') {
    return frozen({
      status: 'renounced' as const,
      worldId,
      teamId,
      playerId,
      asOfDate,
      salaryCapYear,
      ledgerReference,
      stateReference: latest.resultingState,
      birdType: 'None' as const,
      signingBirdType: 'None' as const,
      freeAgentStatus: root.freeAgentStatus,
      rightOfFirstRefusal: root.rightOfFirstRefusal,
      freeAgentAmount: 0,
      postRenunciationSigningAuthorities:
        POST_RENUNCIATION_SIGNING_AUTHORITIES,
      consumedEventIds,
      reasons: Object.freeze([]),
    });
  }

  const reasons: string[] = [];
  if (
    (root.freeAgentStatus === 'UFA' &&
      root.rightOfFirstRefusal !== 'not-applicable') ||
    (root.freeAgentStatus === 'RFA' &&
      root.rightOfFirstRefusal === 'not-applicable')
  ) {
    reasons.push(
      'Free-agent status and Right of First Refusal evidence are inconsistent.'
    );
  }
  const birdType = resolveBirdType(root, salaryCapYear, reasons);
  const amount = birdType
    ? calculateFreeAgentAmount(root, birdType, salaryCapYear, reasons)
    : null;
  if (!birdType || amount === null || reasons.length > 0) {
    return unavailable(request, reasons, 'needs-input', ledger);
  }

  return frozen({
    status: 'available' as const,
    worldId,
    teamId,
    playerId,
    asOfDate,
    salaryCapYear,
    ledgerReference,
    stateReference: latest.resultingState,
    birdType,
    signingBirdType:
      latest.eventKind === 'early-bird-election' ? 'Non-Bird' : birdType,
    freeAgentStatus: root.freeAgentStatus,
    rightOfFirstRefusal: root.rightOfFirstRefusal,
    freeAgentAmount: amount,
    postRenunciationSigningAuthorities: Object.freeze([]),
    consumedEventIds,
    reasons: Object.freeze([]),
  });
}

export function latestEffectiveRightsEvent(
  projection: DatedRightsStateProjection,
  ledger: RightsEventLedgerPayload
): RightsEventRecord | null {
  const latestKey = projection.consumedEventIds.at(-1);
  if (!latestKey) return null;
  return (
    ledger.events.find(
      (event) => `${event.eventId}@v${event.eventVersion}` === latestKey
    ) ?? null
  );
}
