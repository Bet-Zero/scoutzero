import {
  TradeHardCapLedgerZ,
  type TradeApronRestrictionTrigger,
  type TradeHardCapLedgerEntry,
  type TradeHardCapProof,
} from '@/schemas/tradeApronRestriction';
import {
  CANON_GOVERNED_SEASON_REGISTRY,
  isWithinSalaryCapYear,
  type GovernedSeasonRegistry,
  type GovernedSystemLevelRecord,
} from '@/features/architect/utils/governedSeason';
import { normalizeTradeApronEnvelopeDate } from './tradeApronDate';

export type ParsedTradeHardCapLedger = {
  entries: TradeHardCapLedgerEntry[];
  valid: boolean;
};

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
  const level = registry.systemLevels.find(
    (candidate) =>
      candidate.recordId === trigger.proof.apronRecordId &&
      candidate.recordVersion === trigger.proof.apronRecordVersion
  );
  if (
    !level ||
    level.recordStatus !== 'current' ||
    level.authority !== 'official' ||
    level.salaryCapYear !== entry.salaryCapYear ||
    level.levelId !== expectedLevelId ||
    level.amount !== trigger.ceiling
  ) {
    return null;
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
