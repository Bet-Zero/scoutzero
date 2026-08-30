import {
  TradeHardCapLedgerZ,
  type TradeApronRestrictionTrigger,
  type TradeHardCapLedgerEntry,
  type TradeHardCapProof,
} from '@/schemas/tradeApronRestriction';
import {
  CANON_GOVERNED_SEASON_REGISTRY,
  isWithinSalaryCapYear,
  resolveGovernedSeasonEnvelope,
  type GovernedSeasonRegistry,
  type GovernedSystemLevelRecord,
} from '@/features/architect/utils/governedSeason';
import {
  GovernedCashLedgerZ,
  type GovernedCashLedger,
  type GovernedCashLedgerEntry,
} from '@/schemas/governedCashConsideration';
import { cashDollarsToCents } from '@/features/architect/utils/tradeMachine/utils/tradeCashRouting';
import { normalizeTradeApronEnvelopeDate } from './tradeApronDate';

export type ParsedTradeHardCapLedger = {
  entries: TradeHardCapLedgerEntry[];
  valid: boolean;
};

export type PersistedHardCapAuthorityContext = {
  containingTeamCode: unknown;
  worldLineage?: unknown;
  cashLedger?: unknown;
};

export type TrustedPersistedHardCapAuthorityContext = Omit<
  PersistedHardCapAuthorityContext,
  'cashLedger'
>;

const TRUSTED_PERSISTED_HARD_CAP_AUTHORITY = Symbol(
  'trusted-persisted-hard-cap-authority'
);

export function getTrustedPersistedHardCapAuthority(
  value: object | null | undefined
): TrustedPersistedHardCapAuthorityContext | undefined {
  if (!value) return undefined;
  return (
    value as {
      [TRUSTED_PERSISTED_HARD_CAP_AUTHORITY]?: TrustedPersistedHardCapAuthorityContext;
    }
  )[TRUSTED_PERSISTED_HARD_CAP_AUTHORITY];
}

export function resolveTrustedPersistedHardCapAuthority(
  value: object,
  explicit?: TrustedPersistedHardCapAuthorityContext
): TrustedPersistedHardCapAuthorityContext | undefined {
  const retained = getTrustedPersistedHardCapAuthority(value);
  if (
    retained &&
    explicit &&
    (retained.containingTeamCode !== explicit.containingTeamCode ||
      (explicit.worldLineage !== undefined &&
        JSON.stringify(retained.worldLineage ?? null) !==
          JSON.stringify(explicit.worldLineage ?? null)))
  ) {
    throw new Error(
      'Persisted hard-cap containing-Team or world-lineage authority conflicts with the mutation target.'
    );
  }
  return retained ?? explicit;
}

export function retainTrustedPersistedHardCapAuthority<T extends object>(
  value: T,
  authorityContext?: TrustedPersistedHardCapAuthorityContext
): T {
  if (
    typeof authorityContext?.containingTeamCode !== 'string' ||
    !authorityContext.containingTeamCode.trim()
  ) {
    return value;
  }
  Object.defineProperty(value, TRUSTED_PERSISTED_HARD_CAP_AUTHORITY, {
    value: Object.freeze({
      ...authorityContext,
      ...(Array.isArray(authorityContext.worldLineage)
        ? { worldLineage: Object.freeze([...authorityContext.worldLineage]) }
        : {}),
    }),
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return value;
}

const ROW_I_CANON_LEAF_IDS = [
  'CBA2-A05.11',
  'CBA2-A05.1',
  'CBA2-A05.2',
] as const;

function sameLeafSet(
  actual: readonly string[],
  expected: readonly string[]
): boolean {
  return (
    actual.length === expected.length &&
    expected.every((leafId) => actual.includes(leafId))
  );
}

function rowILeafProofIsAuthenticated(entry: TradeHardCapLedgerEntry): boolean {
  if (!entry.triggers.some((trigger) => trigger.restrictionRow === 'I')) {
    return true;
  }
  const triggerLeaves = [
    ...new Set(entry.triggers.flatMap((trigger) => trigger.canonLeafIds)),
  ];
  return (
    entry.triggers
      .filter((trigger) => trigger.restrictionRow === 'I')
      .every((trigger) =>
        sameLeafSet(trigger.canonLeafIds, ROW_I_CANON_LEAF_IDS)
      ) && sameLeafSet(entry.canonLeafIds, triggerLeaves)
  );
}

function sameProof(left: TradeHardCapProof, right: TradeHardCapProof): boolean {
  return (
    left.registryId === right.registryId &&
    left.registryVersion === right.registryVersion &&
    left.canonCandidateCommit === right.canonCandidateCommit &&
    left.canonSha256 === right.canonSha256 &&
    left.calendarRecordId === right.calendarRecordId &&
    left.calendarRecordVersion === right.calendarRecordVersion &&
    left.apronRecordId === right.apronRecordId &&
    left.apronRecordVersion === right.apronRecordVersion
  );
}

function proofMatchesRegistry(
  proof: TradeHardCapProof,
  registry: GovernedSeasonRegistry
): boolean {
  return (
    proof.registryId === registry.registryId &&
    proof.registryVersion === registry.registryVersion &&
    proof.canonCandidateCommit === registry.canonCandidateCommit &&
    proof.canonSha256 === registry.canonSha256
  );
}

function resolveAuthenticatedLevel(
  entry: TradeHardCapLedgerEntry,
  trigger: TradeApronRestrictionTrigger,
  registry: GovernedSeasonRegistry
): GovernedSystemLevelRecord | null {
  if (!proofMatchesRegistry(trigger.proof, registry)) return null;

  const expectedLevelId =
    trigger.apronLevel === 'FIRST_APRON' ? 'first-apron' : 'second-apron';
  const matchingLevels = registry.systemLevels.filter(
    (candidate) =>
      candidate.recordId === trigger.proof.apronRecordId &&
      candidate.recordVersion === trigger.proof.apronRecordVersion
  );
  const level = matchingLevels[0];
  if (
    matchingLevels.length !== 1 ||
    !level ||
    level.recordStatus !== 'current' ||
    level.authority !== 'official' ||
    level.salaryCapYear !== entry.salaryCapYear ||
    level.levelId !== expectedLevelId ||
    level.amount !== trigger.ceiling
  ) {
    return null;
  }
  if (trigger.restrictionRow === 'I') {
    const currentOfficialLevels = registry.systemLevels.filter(
      (candidate) =>
        candidate.recordStatus === 'current' &&
        candidate.authority === 'official' &&
        candidate.salaryCapYear === entry.salaryCapYear &&
        candidate.levelId === expectedLevelId
    );
    if (
      currentOfficialLevels.length !== 1 ||
      currentOfficialLevels[0].recordId !== level.recordId ||
      currentOfficialLevels[0].recordVersion !== level.recordVersion
    ) {
      return null;
    }
  }
  return level;
}

function calendarProofIsAuthenticated(
  entry: TradeHardCapLedgerEntry,
  trigger: TradeApronRestrictionTrigger,
  registry: GovernedSeasonRegistry
): boolean {
  const matchingCalendars = registry.calendars.filter(
    (candidate) =>
      candidate.recordId === trigger.proof.calendarRecordId &&
      candidate.recordVersion === trigger.proof.calendarRecordVersion
  );
  const calendar = matchingCalendars[0];
  if (
    matchingCalendars.length !== 1 ||
    !calendar ||
    calendar.recordStatus !== 'current' ||
    calendar.authority !== 'official'
  ) {
    return false;
  }

  if (trigger.restrictionRow === 'C' || trigger.restrictionRow === 'H') {
    return calendar.salaryCapYear === entry.salaryCapYear;
  }

  if (trigger.restrictionRow === 'I') {
    const transactionAsOf = normalizeTradeApronEnvelopeDate(
      entry.triggerTransactionDate
    );
    const currentOfficialCalendars = registry.calendars.filter(
      (candidate) =>
        candidate.recordStatus === 'current' &&
        candidate.authority === 'official' &&
        candidate.salaryCapYear === entry.salaryCapYear
    );
    return (
      currentOfficialCalendars.length === 1 &&
      currentOfficialCalendars[0].recordId === calendar.recordId &&
      currentOfficialCalendars[0].recordVersion === calendar.recordVersion &&
      calendar.salaryCapYear === entry.salaryCapYear &&
      transactionAsOf !== null &&
      isWithinSalaryCapYear(transactionAsOf, entry.salaryCapYear) &&
      trigger.componentId === `cash:${entry.teamCode}`
    );
  }

  if (!trigger.tpeTiming) return false;
  const createdAsOf = normalizeTradeApronEnvelopeDate(
    trigger.tpeTiming.createdOn
  );
  if (!createdAsOf) return false;
  const creationCalendars = registry.calendars.filter(
    (candidate) =>
      candidate.recordStatus === 'current' &&
      candidate.authority === 'official' &&
      isWithinSalaryCapYear(createdAsOf, candidate.salaryCapYear)
  );
  const creationCalendar = creationCalendars[0];
  const createdDay =
    trigger.tpeTiming.createdOn.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (creationCalendars.length !== 1 || !creationCalendar || !createdDay) {
    return false;
  }

  const expectedCalendarYear =
    createdDay <= creationCalendar.regularSeasonClosing.value
      ? creationCalendar.salaryCapYear
      : creationCalendar.salaryCapYear + 1;
  return (
    calendar.salaryCapYear === expectedCalendarYear &&
    trigger.regularSeasonClosing === calendar.regularSeasonClosing.value
  );
}

function entryMatchesAuthenticatedTriggers(
  entry: TradeHardCapLedgerEntry,
  registry: GovernedSeasonRegistry
): boolean {
  if (!rowILeafProofIsAuthenticated(entry)) return false;

  const authenticated = entry.triggers.map((trigger) => {
    const level = resolveAuthenticatedLevel(entry, trigger, registry);
    return level && calendarProofIsAuthenticated(entry, trigger, registry)
      ? { trigger, level }
      : null;
  });
  if (authenticated.some((candidate) => candidate === null)) return false;

  const controlling = authenticated
    .filter((candidate): candidate is NonNullable<typeof candidate> =>
      Boolean(candidate)
    )
    .sort(
      (left, right) =>
        left.level.amount - right.level.amount ||
        left.trigger.restrictionRow.localeCompare(
          right.trigger.restrictionRow
        ) ||
        left.trigger.componentId.localeCompare(right.trigger.componentId)
    )[0];
  if (!controlling) return false;

  const expectedTransactionPath = entry.triggers.some(
    (trigger) => trigger.restrictionRow === 'H'
  )
    ? 'AGGREGATED_STANDARD_TPE'
    : entry.triggers.some((trigger) => trigger.restrictionRow === 'F')
      ? 'STANDARD_TPE'
      : controlling.trigger.salaryMatchingPath;

  return (
    entry.restrictionRow === controlling.trigger.restrictionRow &&
    entry.apronLevel === controlling.trigger.apronLevel &&
    entry.ceiling === controlling.level.amount &&
    entry.salaryMatchingPath === expectedTransactionPath &&
    sameProof(entry.proof, controlling.trigger.proof)
  );
}

function canonicalContainingTeamCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return /^[A-Z0-9]{2,5}$/.test(normalized) ? normalized : null;
}

function independentlyTrustedWorldLineage(
  value: unknown
): readonly string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const normalized = value.map((worldId) =>
    typeof worldId === 'string' ? worldId.trim() : ''
  );
  if (
    normalized.some((worldId) => !worldId) ||
    new Set(normalized).size !== normalized.length
  ) {
    return null;
  }
  return normalized;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function cashEntryHasCurrentGovernedProof(
  entry: GovernedCashLedgerEntry,
  containingTeamCode: string,
  worldLineage: readonly string[],
  registry: GovernedSeasonRegistry
): boolean {
  const provenanceWorldId = entry.worldId.trim();
  if (!provenanceWorldId || !worldLineage.includes(provenanceWorldId)) {
    return false;
  }
  const envelope = resolveGovernedSeasonEnvelope({
    asOfDate: entry.transactionAt,
    salaryCapYear: entry.salaryCapYear,
    requiredAuthority: 'official',
    team: {
      teamId: containingTeamCode,
      teamCode: containingTeamCode,
      worldId: provenanceWorldId,
    },
    registry,
  });
  const salaryCap = envelope.systemLevels['salary-cap'];
  const salaryCapCents = cashDollarsToCents(salaryCap.amount);

  return (
    envelope.status === 'complete' &&
    envelope.inputManifest !== null &&
    salaryCap.state === 'available' &&
    salaryCapCents !== null &&
    entry.proof.canonCandidateCommit === registry.canonCandidateCommit &&
    entry.proof.canonSha256 === registry.canonSha256 &&
    entry.teamId === containingTeamCode &&
    entry.worldId === provenanceWorldId &&
    entry.proof.salaryCapCents === salaryCapCents &&
    entry.proof.annualLimitCents ===
      Math.floor((salaryCapCents * 515) / 10_000) &&
    canonicalJson(entry.proof.seasonInputManifest) ===
      canonicalJson(envelope.inputManifest)
  );
}

function cashEntryHasAuthenticatedLeafSet(
  entry: GovernedCashLedgerEntry
): boolean {
  const required =
    entry.direction === 'PAID'
      ? ['CBA2-A08.1', 'CBA2-A08.4', 'CBA2-A08.5', 'CBA2-A08.6', 'CBA2-A05.11']
      : ['CBA2-A08.2', 'CBA2-A08.4', 'CBA2-A08.5', 'CBA2-A08.6'];
  const allowed = new Set([
    ...required,
    entry.direction === 'PAID' ? 'CBA2-A08.2' : 'CBA2-A08.1',
  ]);
  return (
    new Set(entry.canonLeafIds).size === entry.canonLeafIds.length &&
    required.every((leafId) => entry.canonLeafIds.includes(leafId)) &&
    entry.canonLeafIds.every((leafId) => allowed.has(leafId))
  );
}

function parseAuthenticatedCashLedger(
  value: unknown,
  containingTeamCode: string,
  worldLineage: readonly string[],
  registry: GovernedSeasonRegistry
): GovernedCashLedger | null {
  const parsed = GovernedCashLedgerZ.safeParse(value);
  if (
    !parsed.success ||
    parsed.data.teamId !== containingTeamCode ||
    parsed.data.ledgerId !== `cash-ledger:${containingTeamCode}`
  ) {
    return null;
  }

  const transactionDirections = new Set<string>();
  for (const entry of parsed.data.entries) {
    const transactionDirection = [
      entry.transactionId,
      entry.direction,
      entry.counterpartyTeamId,
    ].join(':');
    if (
      transactionDirections.has(transactionDirection) ||
      !cashEntryHasAuthenticatedLeafSet(entry) ||
      !cashEntryHasCurrentGovernedProof(
        entry,
        containingTeamCode,
        worldLineage,
        registry
      )
    ) {
      return null;
    }
    transactionDirections.add(transactionDirection);
  }

  return parsed.data;
}

function sameTransactionInstant(left: string, right: string): boolean {
  // Product hard-cap entries retain a governed transaction day while the cash
  // ledger retains the corresponding noon-UTC envelope instant. Reuse the
  // accepted shared interpretation without rewriting either persisted value.
  const normalizedLeft = normalizeTradeApronEnvelopeDate(left);
  const normalizedRight = normalizeTradeApronEnvelopeDate(right);
  const leftInstant = normalizedLeft ? Date.parse(normalizedLeft) : Number.NaN;
  const rightInstant = normalizedRight
    ? Date.parse(normalizedRight)
    : Number.NaN;
  return (
    Number.isFinite(leftInstant) &&
    Number.isFinite(rightInstant) &&
    leftInstant === rightInstant
  );
}

function rowIEntryHasAuthenticatedPayerEvidence(
  entry: TradeHardCapLedgerEntry,
  cashLedger: GovernedCashLedger
): boolean {
  const rowITriggers = entry.triggers.filter(
    (trigger) => trigger.restrictionRow === 'I'
  );
  if (rowITriggers.length !== 1) return false;
  const trigger = rowITriggers[0];
  const matchingPaidEntries = cashLedger.entries.filter(
    (cashEntry) =>
      cashEntry.direction === 'PAID' &&
      cashEntry.teamId === entry.teamCode &&
      cashEntry.transactionId === entry.transactionId &&
      cashEntry.amountCents === trigger.cashAmountCents &&
      cashEntry.salaryCapYear === entry.salaryCapYear &&
      sameTransactionInstant(
        cashEntry.transactionAt,
        entry.triggerTransactionDate
      ) &&
      cashEntry.canonLeafIds.includes('CBA2-A05.11')
  );

  return matchingPaidEntries.length === 1;
}

/**
 * Structural parsing is not authority. Persisted money becomes enforceable
 * only after every trigger and the controlling entry reauthenticate against
 * the pinned governed registry.
 */
export function parseTradeHardCapLedger(
  value: unknown,
  registry: GovernedSeasonRegistry = CANON_GOVERNED_SEASON_REGISTRY
): ParsedTradeHardCapLedger {
  if (value === undefined || value === null) {
    return { entries: [], valid: true };
  }
  const parsed = TradeHardCapLedgerZ.safeParse(value);
  if (
    !parsed.success ||
    !parsed.data.every((entry) =>
      entryMatchesAuthenticatedTriggers(entry, registry)
    )
  ) {
    return { entries: [], valid: false };
  }
  return { entries: parsed.data, valid: true };
}

/**
 * Production persisted-read authority. The containing Team and, for saved-world
 * Row I entries, the authenticated current/ancestor lineage are supplied by the
 * caller boundary rather than recovered from persisted Team contents.
 */
export function parsePersistedTradeHardCapLedger(
  value: unknown,
  context: PersistedHardCapAuthorityContext,
  registry: GovernedSeasonRegistry = CANON_GOVERNED_SEASON_REGISTRY
): ParsedTradeHardCapLedger {
  if (value === undefined || value === null) {
    return { entries: [], valid: true };
  }

  const parsed = parseTradeHardCapLedger(value, registry);
  const containingTeamCode = canonicalContainingTeamCode(
    context.containingTeamCode
  );
  if (
    !parsed.valid ||
    !containingTeamCode ||
    parsed.entries.some(
      (entry) =>
        entry.teamCode !== containingTeamCode ||
        entry.entryId !==
          `${entry.transactionId}:hard-cap:${containingTeamCode}`
    ) ||
    new Set(parsed.entries.map((entry) => entry.entryId)).size !==
      parsed.entries.length
  ) {
    return { entries: [], valid: false };
  }

  const rowIEntries = parsed.entries.filter((entry) =>
    entry.triggers.some((trigger) => trigger.restrictionRow === 'I')
  );
  if (rowIEntries.length === 0) return parsed;

  const worldLineage = independentlyTrustedWorldLineage(context.worldLineage);
  if (!worldLineage) return { entries: [], valid: false };
  const cashLedger = parseAuthenticatedCashLedger(
    context.cashLedger,
    containingTeamCode,
    worldLineage,
    registry
  );
  if (
    !cashLedger ||
    !rowIEntries.every((entry) =>
      rowIEntryHasAuthenticatedPayerEvidence(entry, cashLedger)
    )
  ) {
    return { entries: [], valid: false };
  }

  return parsed;
}
