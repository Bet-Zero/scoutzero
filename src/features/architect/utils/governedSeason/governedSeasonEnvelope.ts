/**
 * FILE: src/features/architect/utils/governedSeason/governedSeasonEnvelope.ts
 * PURPOSE: Fail-closed resolver for governed season inputs.
 * OWNERSHIP: Feature: architect/governed season inputs
 *
 * BZE-270. One entry point resolves the date, Salary Cap Year, calendar, team
 * context, and the five core annual system levels, or reports exactly what is
 * missing. The resolver has no fallback of any kind:
 *
 *  - it never reads the runtime clock or a current year (`CBA2-L01.1`);
 *  - it never borrows a prior Salary Cap Year's value (`CBA2-S01.9`);
 *  - it never lets an official record stand in for a projected one, or the
 *    reverse (`CBA2-S01.9`);
 *  - it never reads an ungoverned constant such as `capProjections`
 *    (`CBA2-S02.3`, `CBA2-S02.4`);
 *  - it never picks a winner between two current records for the same governed
 *    value; that is an unresolved conflict (`CBA2-S02.2`).
 *
 * A complete envelope carries an input manifest naming every record ID and
 * version it used, so a later source revision produces a new record and a new
 * result instead of retroactively changing this one (`CBA2-S02.6`).
 */

import { CANON_GOVERNED_SEASON_REGISTRY } from './canonGovernedSeasonRegistry';
import {
  GOVERNED_AUTHORITIES,
  GOVERNED_SYSTEM_LEVEL_IDS,
  type GovernedAuthority,
  type GovernedCalendarDate,
  type GovernedSeasonCalendarRecord,
  type GovernedSeasonRegistry,
  type GovernedSystemLevelId,
  type GovernedSystemLevelRecord,
} from './governedSeasonRecords';
import {
  isDateOnlyWithinSalaryCapYear,
  isNonEmptyString,
  isWithinSalaryCapYear,
  isZonedDateTime,
  salaryCapYearWindow,
  seasonKeyForSalaryCapYear,
  type SalaryCapYearWindow,
} from './governedTime';

export type GovernedResolutionState =
  | 'available'
  | 'unavailable'
  | 'unresolved-conflict';

export interface GovernedTeamContext {
  readonly teamId: string;
  readonly teamCode?: string;
  /** World the request is evaluated inside, when the caller has one. */
  readonly worldId?: string;
}

/** Identity every resolved governed value retains. */
export interface GovernedRecordIdentity {
  readonly recordId: string;
  readonly recordVersion: number;
  readonly authority: GovernedAuthority;
  readonly sourceRecordId: string;
  readonly sourceRecordVersion: number;
  readonly sourceField: string;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly canonLeafIds: readonly string[];
}

export interface GovernedSystemLevelResolution {
  readonly levelId: GovernedSystemLevelId;
  readonly state: GovernedResolutionState;
  readonly amount: number | null;
  readonly record: GovernedRecordIdentity | null;
  readonly unavailableReason: string | null;
  readonly conflictingRecordIds: readonly string[];
}

export interface GovernedCalendarResolution {
  readonly state: GovernedResolutionState;
  readonly seasonKey: string | null;
  readonly regularSeasonOpening: GovernedCalendarDate | null;
  readonly regularSeasonClosing: GovernedCalendarDate | null;
  readonly uncertifiedFields: readonly string[];
  readonly record: GovernedRecordIdentity | null;
  readonly unavailableReason: string | null;
  readonly conflictingRecordIds: readonly string[];
}

export type GovernedReconciliationState =
  | 'reconciled'
  | 'unreconciled'
  | 'not-evaluated';

export interface GovernedReconciliation {
  readonly state: GovernedReconciliationState;
  readonly salaryCapYearWindow: SalaryCapYearWindow | null;
  readonly expectedSeasonKey: string | null;
  readonly findings: readonly string[];
}

export interface GovernedRequestEcho {
  readonly asOfDate: string;
  readonly salaryCapYear: number;
  readonly requiredAuthority: GovernedAuthority;
  readonly team: GovernedTeamContext;
}

export interface GovernedRegistryIdentity {
  readonly registryId: string;
  readonly registryVersion: number;
  readonly canonCandidateCommit: string;
  readonly canonSha256: string;
}

export interface GovernedManifestInput {
  readonly levelId: GovernedSystemLevelId;
  readonly amount: number;
  readonly recordId: string;
  readonly recordVersion: number;
  readonly authority: GovernedAuthority;
  readonly sourceRecordId: string;
  readonly sourceRecordVersion: number;
}

export interface GovernedManifestCalendar {
  readonly recordId: string;
  readonly recordVersion: number;
  readonly authority: GovernedAuthority;
  readonly seasonKey: string;
  readonly sourceRecordId: string;
  readonly sourceRecordVersion: number;
}

/**
 * The exact inputs a complete result was computed from. Frozen on creation: a
 * result that can be edited after the fact proves nothing about immutability.
 */
export interface GovernedInputManifest {
  readonly manifestVersion: 1;
  readonly registry: GovernedRegistryIdentity;
  readonly asOfDate: string;
  readonly salaryCapYear: number;
  readonly requiredAuthority: GovernedAuthority;
  readonly team: GovernedTeamContext;
  readonly calendar: GovernedManifestCalendar;
  readonly systemLevels: readonly GovernedManifestInput[];
}

export interface GovernedSeasonEnvelope {
  readonly status: 'complete' | 'unavailable';
  readonly registry: GovernedRegistryIdentity;
  readonly requested: GovernedRequestEcho | null;
  readonly reconciliation: GovernedReconciliation;
  readonly calendar: GovernedCalendarResolution;
  readonly systemLevels: Readonly<
    Record<GovernedSystemLevelId, GovernedSystemLevelResolution>
  >;
  readonly missingInputs: readonly string[];
  readonly unavailableReasons: readonly string[];
  readonly inputManifest: GovernedInputManifest | null;
}

export interface GovernedSeasonEnvelopeRequest {
  /** ISO-8601 instant with an explicit `Z` or UTC offset. Required. */
  asOfDate?: string | null;
  /** End year of the Salary Cap Year, e.g. 2027 for 2026-27. Required. */
  salaryCapYear?: number | null;
  /**
   * Required. There is no default: choosing an authority class silently is the
   * substitution `CBA2-S01.9` forbids.
   */
  requiredAuthority?: GovernedAuthority | null;
  team?: Partial<GovernedTeamContext> | null;
  /** Defaults to the Canon-seeded registry. */
  registry?: GovernedSeasonRegistry;
}

function registryIdentity(
  registry: GovernedSeasonRegistry
): GovernedRegistryIdentity {
  return Object.freeze({
    registryId: registry.registryId,
    registryVersion: registry.registryVersion,
    canonCandidateCommit: registry.canonCandidateCommit,
    canonSha256: registry.canonSha256,
  });
}

function recordIdentity(
  record: GovernedSystemLevelRecord | GovernedSeasonCalendarRecord
): GovernedRecordIdentity {
  return Object.freeze({
    recordId: record.recordId,
    recordVersion: record.recordVersion,
    authority: record.authority,
    sourceRecordId: record.sourceRecordId,
    sourceRecordVersion: record.sourceRecordVersion,
    sourceField: record.sourceField,
    effectiveFrom: record.effectiveFrom,
    effectiveUntil: record.effectiveUntil,
    canonLeafIds: Object.freeze([...record.canonLeafIds]),
  });
}

function unavailableLevel(
  levelId: GovernedSystemLevelId,
  reason: string
): GovernedSystemLevelResolution {
  return Object.freeze({
    levelId,
    state: 'unavailable' as const,
    amount: null,
    record: null,
    unavailableReason: reason,
    conflictingRecordIds: Object.freeze([]),
  });
}

function unavailableCalendar(reason: string): GovernedCalendarResolution {
  return Object.freeze({
    state: 'unavailable' as const,
    seasonKey: null,
    regularSeasonOpening: null,
    regularSeasonClosing: null,
    uncertifiedFields: Object.freeze([]),
    record: null,
    unavailableReason: reason,
    conflictingRecordIds: Object.freeze([]),
  });
}

function allLevelsUnavailable(
  reason: string
): Record<GovernedSystemLevelId, GovernedSystemLevelResolution> {
  const levels = {} as Record<
    GovernedSystemLevelId,
    GovernedSystemLevelResolution
  >;
  GOVERNED_SYSTEM_LEVEL_IDS.forEach((levelId) => {
    levels[levelId] = unavailableLevel(levelId, reason);
  });
  return levels;
}

/**
 * Records whose effective period actually covers the evaluation instant. A
 * record keyed to the right Salary Cap Year but effective for a narrower window
 * does not answer a request outside that window.
 */
function coversInstant(
  record: { effectiveFrom: string; effectiveUntil: string | null },
  asOfTime: number
): boolean {
  if (asOfTime < Date.parse(record.effectiveFrom)) return false;
  if (record.effectiveUntil == null) return true;
  return asOfTime < Date.parse(record.effectiveUntil);
}

function describeOtherAuthority(
  requested: GovernedAuthority,
  otherAuthorityRecordIds: readonly string[]
): string {
  if (otherAuthorityRecordIds.length === 0) return '';
  const other: GovernedAuthority =
    requested === 'official' ? 'projected' : 'official';
  return ` A ${other} record exists (${otherAuthorityRecordIds.join(
    ', '
  )}) but ${other} and ${requested} values may not substitute for each other.`;
}

function resolveSystemLevel(
  levelId: GovernedSystemLevelId,
  registry: GovernedSeasonRegistry,
  salaryCapYear: number,
  requiredAuthority: GovernedAuthority,
  asOfTime: number
): GovernedSystemLevelResolution {
  const forYear = registry.systemLevels.filter(
    (record) =>
      record.levelId === levelId && record.salaryCapYear === salaryCapYear
  );

  const current = forYear.filter((record) => record.recordStatus === 'current');
  const matching = current.filter(
    (record) => record.authority === requiredAuthority
  );

  if (matching.length > 1) {
    return Object.freeze({
      levelId,
      state: 'unresolved-conflict' as const,
      amount: null,
      record: null,
      unavailableReason: `Salary Cap Year ${salaryCapYear} has ${matching.length} current ${requiredAuthority} records for ${levelId}; the conflict must be reconciled at the source before a value resolves.`,
      conflictingRecordIds: Object.freeze(
        matching.map((record) => `${record.recordId}@v${record.recordVersion}`)
      ),
    });
  }

  if (matching.length === 0) {
    const otherAuthority = current
      .filter((record) => record.authority !== requiredAuthority)
      .map((record) => `${record.recordId}@v${record.recordVersion}`);
    const supersededOnly =
      current.length === 0 && forYear.length > 0
        ? ' Only superseded record versions exist for this value.'
        : '';

    return unavailableLevel(
      levelId,
      `No current ${requiredAuthority} ${levelId} record exists for Salary Cap Year ${salaryCapYear}.${describeOtherAuthority(
        requiredAuthority,
        otherAuthority
      )}${supersededOnly}`
    );
  }

  const record = matching[0];
  if (!coversInstant(record, asOfTime)) {
    return unavailableLevel(
      levelId,
      `The current ${requiredAuthority} ${levelId} record ${record.recordId}@v${record.recordVersion} is effective ${record.effectiveFrom} to ${record.effectiveUntil ?? 'open-ended'}, which does not cover the requested instant.`
    );
  }

  return Object.freeze({
    levelId,
    state: 'available' as const,
    amount: record.amount,
    record: recordIdentity(record),
    unavailableReason: null,
    conflictingRecordIds: Object.freeze([]),
  });
}

function resolveCalendar(
  registry: GovernedSeasonRegistry,
  salaryCapYear: number,
  requiredAuthority: GovernedAuthority,
  asOfTime: number,
  expectedSeasonKey: string,
  findings: string[]
): GovernedCalendarResolution {
  const forYear = registry.calendars.filter(
    (record) => record.salaryCapYear === salaryCapYear
  );
  const current = forYear.filter((record) => record.recordStatus === 'current');
  const matching = current.filter(
    (record) => record.authority === requiredAuthority
  );

  if (matching.length > 1) {
    return Object.freeze({
      state: 'unresolved-conflict' as const,
      seasonKey: null,
      regularSeasonOpening: null,
      regularSeasonClosing: null,
      uncertifiedFields: Object.freeze([]),
      record: null,
      unavailableReason: `Salary Cap Year ${salaryCapYear} has ${matching.length} current ${requiredAuthority} calendar records; the conflict must be reconciled at the source before a calendar resolves.`,
      conflictingRecordIds: Object.freeze(
        matching.map((record) => `${record.recordId}@v${record.recordVersion}`)
      ),
    });
  }

  if (matching.length === 0) {
    const otherAuthority = current
      .filter((record) => record.authority !== requiredAuthority)
      .map((record) => `${record.recordId}@v${record.recordVersion}`);
    const supersededOnly =
      current.length === 0 && forYear.length > 0
        ? ' Only superseded calendar versions exist for this Salary Cap Year.'
        : '';

    return unavailableCalendar(
      `No current ${requiredAuthority} season calendar record exists for Salary Cap Year ${salaryCapYear}.${describeOtherAuthority(
        requiredAuthority,
        otherAuthority
      )}${supersededOnly} A calendar from another Season may not be reused.`
    );
  }

  const record = matching[0];

  if (!coversInstant(record, asOfTime)) {
    return unavailableCalendar(
      `Season calendar ${record.recordId}@v${record.recordVersion} is effective ${record.effectiveFrom} to ${record.effectiveUntil ?? 'open-ended'}, which does not cover the requested instant.`
    );
  }

  // Reconciliation: the calendar must describe the Salary Cap Year that was
  // requested, and its own dates must sit inside that year.
  const mismatches: string[] = [];
  if (record.seasonKey !== expectedSeasonKey) {
    mismatches.push(
      `calendar ${record.recordId}@v${record.recordVersion} is keyed to season ${record.seasonKey}, not ${expectedSeasonKey}`
    );
  }
  if (
    !isDateOnlyWithinSalaryCapYear(
      record.regularSeasonOpening.value,
      salaryCapYear
    )
  ) {
    mismatches.push(
      `calendar ${record.recordId}@v${record.recordVersion} opening date ${record.regularSeasonOpening.value} falls outside Salary Cap Year ${salaryCapYear}`
    );
  }
  if (
    !isDateOnlyWithinSalaryCapYear(
      record.regularSeasonClosing.value,
      salaryCapYear
    )
  ) {
    mismatches.push(
      `calendar ${record.recordId}@v${record.recordVersion} closing date ${record.regularSeasonClosing.value} falls outside Salary Cap Year ${salaryCapYear}`
    );
  }

  if (mismatches.length > 0) {
    findings.push(...mismatches);
    return unavailableCalendar(
      `The season calendar does not reconcile with Salary Cap Year ${salaryCapYear}: ${mismatches.join('; ')}.`
    );
  }

  return Object.freeze({
    state: 'available' as const,
    seasonKey: record.seasonKey,
    regularSeasonOpening: Object.freeze({ ...record.regularSeasonOpening }),
    regularSeasonClosing: Object.freeze({ ...record.regularSeasonClosing }),
    uncertifiedFields: Object.freeze([...record.uncertifiedFields]),
    record: recordIdentity(record),
    unavailableReason: null,
    conflictingRecordIds: Object.freeze([]),
  });
}

function unavailableEnvelope(
  registry: GovernedSeasonRegistry,
  requested: GovernedRequestEcho | null,
  reconciliation: GovernedReconciliation,
  reason: string,
  missingInputs: readonly string[]
): GovernedSeasonEnvelope {
  return Object.freeze({
    status: 'unavailable' as const,
    registry: registryIdentity(registry),
    requested,
    reconciliation,
    calendar: unavailableCalendar(reason),
    systemLevels: Object.freeze(allLevelsUnavailable(reason)),
    missingInputs: Object.freeze([...missingInputs]),
    unavailableReasons: Object.freeze([reason]),
    inputManifest: null,
  });
}

/**
 * Resolve the governed season envelope, or report precisely why it cannot be
 * resolved. A caller that receives `status: 'unavailable'` has no supported way
 * to proceed; there is no partial or best-effort result to fall back on.
 */
export function resolveGovernedSeasonEnvelope(
  request: GovernedSeasonEnvelopeRequest = {}
): GovernedSeasonEnvelope {
  const registry = request.registry ?? CANON_GOVERNED_SEASON_REGISTRY;

  const missingInputs: string[] = [];
  if (!isZonedDateTime(request.asOfDate)) missingInputs.push('asOfDate');
  if (!Number.isInteger(request.salaryCapYear)) {
    missingInputs.push('salaryCapYear');
  }
  if (!GOVERNED_AUTHORITIES.some((a) => a === request.requiredAuthority)) {
    missingInputs.push('requiredAuthority');
  }
  if (!isNonEmptyString(request.team?.teamId))
    missingInputs.push('team.teamId');

  if (missingInputs.length > 0) {
    return unavailableEnvelope(
      registry,
      null,
      Object.freeze({
        state: 'not-evaluated' as const,
        salaryCapYearWindow: null,
        expectedSeasonKey: null,
        findings: Object.freeze([]),
      }),
      'The governed season envelope requires an explicit zoned as-of date, Salary Cap Year, authority class, and team context. No runtime date, current year, or default authority is substituted.',
      missingInputs
    );
  }

  const asOfDate = request.asOfDate as string;
  const salaryCapYear = request.salaryCapYear as number;
  const requiredAuthority = request.requiredAuthority as GovernedAuthority;
  const teamCode = isNonEmptyString(request.team?.teamCode)
    ? request.team.teamCode.trim()
    : undefined;
  const worldId = isNonEmptyString(request.team?.worldId)
    ? request.team.worldId.trim()
    : undefined;

  const requested: GovernedRequestEcho = Object.freeze({
    asOfDate,
    salaryCapYear,
    requiredAuthority,
    team: Object.freeze({
      teamId: (request.team?.teamId as string).trim(),
      ...(teamCode ? { teamCode } : {}),
      ...(worldId ? { worldId } : {}),
    }),
  });

  const window = salaryCapYearWindow(salaryCapYear) as SalaryCapYearWindow;
  const expectedSeasonKey = seasonKeyForSalaryCapYear(salaryCapYear) as string;
  const findings: string[] = [];

  // Date and Salary Cap Year must reconcile before any record is consulted.
  if (!isWithinSalaryCapYear(asOfDate, salaryCapYear)) {
    const finding = `as-of date ${asOfDate} falls outside Salary Cap Year ${salaryCapYear} (${window.from} through ${window.until}, exclusive)`;
    return unavailableEnvelope(
      registry,
      requested,
      Object.freeze({
        state: 'unreconciled' as const,
        salaryCapYearWindow: window,
        expectedSeasonKey,
        findings: Object.freeze([finding]),
      }),
      `The requested date and Salary Cap Year do not reconcile: ${finding}. Neither input is adjusted to fit the other.`,
      Object.freeze([])
    );
  }

  if (!registry.supportedSalaryCapYears.includes(salaryCapYear)) {
    return unavailableEnvelope(
      registry,
      requested,
      Object.freeze({
        state: 'reconciled' as const,
        salaryCapYearWindow: window,
        expectedSeasonKey,
        findings: Object.freeze([]),
      }),
      `Salary Cap Year ${salaryCapYear} is not a supported season in registry ${registry.registryId}@v${registry.registryVersion}; it holds records for ${registry.supportedSalaryCapYears.join(', ') || 'no season'}. An unsupported season stays unavailable rather than inheriting another season's records.`,
      Object.freeze([])
    );
  }

  const asOfTime = Date.parse(asOfDate);
  const calendar = resolveCalendar(
    registry,
    salaryCapYear,
    requiredAuthority,
    asOfTime,
    expectedSeasonKey,
    findings
  );

  const systemLevels = {} as Record<
    GovernedSystemLevelId,
    GovernedSystemLevelResolution
  >;
  GOVERNED_SYSTEM_LEVEL_IDS.forEach((levelId) => {
    systemLevels[levelId] = resolveSystemLevel(
      levelId,
      registry,
      salaryCapYear,
      requiredAuthority,
      asOfTime
    );
  });

  const unavailableReasons: string[] = [];
  if (calendar.state !== 'available' && calendar.unavailableReason) {
    unavailableReasons.push(calendar.unavailableReason);
  }
  GOVERNED_SYSTEM_LEVEL_IDS.forEach((levelId) => {
    const level = systemLevels[levelId];
    if (level.state !== 'available' && level.unavailableReason) {
      unavailableReasons.push(level.unavailableReason);
    }
  });

  const reconciliation: GovernedReconciliation = Object.freeze({
    state: (findings.length > 0
      ? 'unreconciled'
      : 'reconciled') as GovernedReconciliationState,
    salaryCapYearWindow: window,
    expectedSeasonKey,
    findings: Object.freeze([...findings]),
  });

  if (unavailableReasons.length > 0) {
    return Object.freeze({
      status: 'unavailable' as const,
      registry: registryIdentity(registry),
      requested,
      reconciliation,
      calendar,
      systemLevels: Object.freeze(systemLevels),
      missingInputs: Object.freeze([]),
      unavailableReasons: Object.freeze(unavailableReasons),
      inputManifest: null,
    });
  }

  const calendarRecord = calendar.record as GovernedRecordIdentity;
  const inputManifest: GovernedInputManifest = Object.freeze({
    manifestVersion: 1 as const,
    registry: registryIdentity(registry),
    asOfDate,
    salaryCapYear,
    requiredAuthority,
    team: requested.team,
    calendar: Object.freeze({
      recordId: calendarRecord.recordId,
      recordVersion: calendarRecord.recordVersion,
      authority: calendarRecord.authority,
      seasonKey: calendar.seasonKey as string,
      sourceRecordId: calendarRecord.sourceRecordId,
      sourceRecordVersion: calendarRecord.sourceRecordVersion,
    }),
    systemLevels: Object.freeze(
      GOVERNED_SYSTEM_LEVEL_IDS.map((levelId) => {
        const level = systemLevels[levelId];
        const record = level.record as GovernedRecordIdentity;
        return Object.freeze({
          levelId,
          amount: level.amount as number,
          recordId: record.recordId,
          recordVersion: record.recordVersion,
          authority: record.authority,
          sourceRecordId: record.sourceRecordId,
          sourceRecordVersion: record.sourceRecordVersion,
        });
      })
    ),
  });

  return Object.freeze({
    status: 'complete' as const,
    registry: registryIdentity(registry),
    requested,
    reconciliation,
    calendar,
    systemLevels: Object.freeze(systemLevels),
    missingInputs: Object.freeze([]),
    unavailableReasons: Object.freeze([]),
    inputManifest,
  });
}

export type GovernedManifestVerificationState =
  | 'current'
  | 'superseded'
  | 'registry-mismatch';

export interface GovernedManifestDrift {
  readonly inputId: string;
  readonly recordId: string;
  readonly recordVersion: number;
  readonly reason: string;
}

export interface GovernedManifestVerification {
  readonly state: GovernedManifestVerificationState;
  readonly driftedInputs: readonly GovernedManifestDrift[];
}

/**
 * Check a retained manifest against a registry without changing the manifest.
 * A source revision that produced newer record versions is reported as drift;
 * the earlier result keeps the values it was computed from
 * (`CBA2-S02.1`, `CBA2-S02.6`).
 */
export function verifyGovernedInputManifest(
  manifest: GovernedInputManifest,
  registry: GovernedSeasonRegistry = CANON_GOVERNED_SEASON_REGISTRY
): GovernedManifestVerification {
  if (
    manifest.registry.registryId !== registry.registryId ||
    manifest.registry.canonSha256 !== registry.canonSha256
  ) {
    return Object.freeze({
      state: 'registry-mismatch' as const,
      driftedInputs: Object.freeze([]),
    });
  }

  const drifted: GovernedManifestDrift[] = [];

  const calendarRecord = registry.calendars.find(
    (record) =>
      record.recordId === manifest.calendar.recordId &&
      record.recordVersion === manifest.calendar.recordVersion
  );
  if (!calendarRecord) {
    drifted.push({
      inputId: 'calendar',
      recordId: manifest.calendar.recordId,
      recordVersion: manifest.calendar.recordVersion,
      reason:
        'The calendar record version used by this result is not in the registry.',
    });
  } else if (calendarRecord.recordStatus !== 'current') {
    drifted.push({
      inputId: 'calendar',
      recordId: calendarRecord.recordId,
      recordVersion: calendarRecord.recordVersion,
      reason:
        'The calendar record version used by this result has been superseded.',
    });
  }

  manifest.systemLevels.forEach((input) => {
    const record = registry.systemLevels.find(
      (candidate) =>
        candidate.recordId === input.recordId &&
        candidate.recordVersion === input.recordVersion
    );
    if (!record) {
      drifted.push({
        inputId: input.levelId,
        recordId: input.recordId,
        recordVersion: input.recordVersion,
        reason:
          'The record version used by this result is not in the registry.',
      });
      return;
    }
    if (record.recordStatus !== 'current') {
      drifted.push({
        inputId: input.levelId,
        recordId: record.recordId,
        recordVersion: record.recordVersion,
        reason: 'The record version used by this result has been superseded.',
      });
    }
  });

  return Object.freeze({
    state: (drifted.length > 0 ? 'superseded' : 'current') as
      | 'current'
      | 'superseded',
    driftedInputs: Object.freeze(drifted),
  });
}
