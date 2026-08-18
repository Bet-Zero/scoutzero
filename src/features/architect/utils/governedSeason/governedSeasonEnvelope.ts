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
  governedSourceAuthorityClass,
  isGovernedPostCanonOfficialSourceRecord,
  type GovernedAuthority,
  type GovernedCalendarDate,
  type GovernedSeasonCalendarRecord,
  type GovernedSeasonRegistry,
  type GovernedSourceAuthorityClass,
  type GovernedSourceRecord,
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

/**
 * `sourceField` and `sourceArtifactSha256` are retained alongside the record
 * and source versions because the governed contract advertises exact source
 * *artifact and field* identity. Without them a registry could reuse
 * `SRC2-x@v1` while pointing at a different artifact or quoting a different
 * field, and an earlier result would still certify as current against inputs it
 * never consumed. The hash is `null` only when the cited source record itself
 * declares no artifact hash.
 */
export interface GovernedManifestInput {
  readonly levelId: GovernedSystemLevelId;
  readonly amount: number;
  readonly recordId: string;
  readonly recordVersion: number;
  readonly authority: GovernedAuthority;
  readonly sourceRecordId: string;
  readonly sourceRecordVersion: number;
  readonly sourceField: string;
  readonly sourceArtifactSha256: string | null;
  readonly sourceAuthorityClass: GovernedSourceAuthorityClass;
}

export interface GovernedManifestCalendar {
  readonly recordId: string;
  readonly recordVersion: number;
  readonly authority: GovernedAuthority;
  readonly seasonKey: string;
  readonly sourceRecordId: string;
  readonly sourceRecordVersion: number;
  readonly sourceField: string;
  readonly sourceArtifactSha256: string | null;
  readonly sourceAuthorityClass: GovernedSourceAuthorityClass;
}

/** Exact post-Canon source lineage actually consumed by one result. */
export interface GovernedManifestPostCanonSource {
  readonly sourceRecordId: string;
  readonly sourceRecordVersion: number;
  readonly identity: string;
  readonly officialUrl: string;
  readonly artifactSha256: string;
  readonly artifactByteSize: number;
  readonly certificationRecordId: string;
  readonly certificationRecordVersion: number;
  readonly authorityScope: 'time-varying-factual-input-only';
  readonly retainedArtifactPath: string;
  readonly retainedArtifactSha256: string;
  readonly retainedArtifactByteSize: number;
}

/**
 * The exact inputs a complete result was computed from. Frozen on creation: a
 * result that can be edited after the fact proves nothing about immutability.
 */
export interface GovernedInputManifest {
  readonly manifestVersion: 2;
  readonly registry: GovernedRegistryIdentity;
  readonly asOfDate: string;
  readonly salaryCapYear: number;
  readonly requiredAuthority: GovernedAuthority;
  readonly team: GovernedTeamContext;
  readonly calendar: GovernedManifestCalendar;
  readonly systemLevels: readonly GovernedManifestInput[];
  readonly postCanonSources: readonly GovernedManifestPostCanonSource[];
}

/**
 * Read-only compatibility shape for manifests emitted before BZE-280. A v1
 * manifest can verify Canon-only inputs but can never authorize post-Canon
 * evidence because it has no field capable of retaining that lineage.
 */
export interface GovernedInputManifestV1 {
  readonly manifestVersion: 1;
  readonly registry: GovernedRegistryIdentity;
  readonly asOfDate: string;
  readonly salaryCapYear: number;
  readonly requiredAuthority: GovernedAuthority;
  readonly team: GovernedTeamContext;
  readonly calendar: Omit<GovernedManifestCalendar, 'sourceAuthorityClass'>;
  readonly systemLevels: readonly Omit<
    GovernedManifestInput,
    'sourceAuthorityClass'
  >[];
}

export type GovernedVerifiableInputManifest =
  | GovernedInputManifest
  | GovernedInputManifestV1;

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

/** Artifact hash of the source record a governed record cites, if it declares one. */
function sourceArtifactSha256For(
  registry: GovernedSeasonRegistry,
  record: Pick<GovernedRecordIdentity, 'sourceRecordId' | 'sourceRecordVersion'>
): string | null {
  const source = registry.sourceRecords.find(
    (candidate) =>
      candidate.sourceRecordId === record.sourceRecordId &&
      candidate.sourceRecordVersion === record.sourceRecordVersion
  );
  return source?.artifactSha256 ?? null;
}

function sourceRecordFor(
  registry: GovernedSeasonRegistry,
  record: Pick<GovernedRecordIdentity, 'sourceRecordId' | 'sourceRecordVersion'>
): GovernedSourceRecord | undefined {
  return registry.sourceRecords.find(
    (candidate) =>
      candidate.sourceRecordId === record.sourceRecordId &&
      candidate.sourceRecordVersion === record.sourceRecordVersion
  );
}

function postCanonManifestSourceFor(
  source: GovernedSourceRecord
): GovernedManifestPostCanonSource | null {
  if (!isGovernedPostCanonOfficialSourceRecord(source)) return null;

  const certification = source.postCanonCertification;
  return Object.freeze({
    sourceRecordId: source.sourceRecordId,
    sourceRecordVersion: source.sourceRecordVersion,
    identity: source.identity,
    officialUrl: source.officialUrl,
    artifactSha256: source.artifactSha256,
    artifactByteSize: source.artifactByteSize,
    certificationRecordId: certification.certificationRecordId,
    certificationRecordVersion: certification.certificationRecordVersion,
    authorityScope: certification.authorityScope,
    retainedArtifactPath: certification.retainedArtifactPath,
    retainedArtifactSha256: certification.retainedArtifactSha256,
    retainedArtifactByteSize: certification.retainedArtifactByteSize,
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

  const window = salaryCapYearWindow(salaryCapYear);
  const expectedSeasonKey = seasonKeyForSalaryCapYear(salaryCapYear);
  const findings: string[] = [];

  // A Salary Cap Year outside the representable ISO range yields no window and
  // no season key. Branch on that rather than asserting non-null: the resolver
  // must fail closed, never dereference null inside its own guard.
  if (!window || !expectedSeasonKey) {
    return unavailableEnvelope(
      registry,
      requested,
      Object.freeze({
        state: 'not-evaluated' as const,
        salaryCapYearWindow: null,
        expectedSeasonKey: null,
        findings: Object.freeze([]),
      }),
      `Salary Cap Year ${salaryCapYear} is not a representable Salary Cap Year, so no year window or season key can be derived and no record is consulted.`,
      Object.freeze(['salaryCapYear'])
    );
  }

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

  // Completeness is decided by the resolution states, never by whether a reason
  // string happens to be non-empty. Reasons are for reporting only: a future
  // branch that returned `unavailable` with an empty reason must still make the
  // envelope unavailable rather than falling through to a null dereference.
  const unavailableReasons: string[] = [];
  let allResolved = calendar.state === 'available';
  if (calendar.state !== 'available' && calendar.unavailableReason) {
    unavailableReasons.push(calendar.unavailableReason);
  }
  GOVERNED_SYSTEM_LEVEL_IDS.forEach((levelId) => {
    const level = systemLevels[levelId];
    if (level.state !== 'available') allResolved = false;
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

  const unresolvedEnvelope = (reasons: readonly string[]) =>
    Object.freeze({
      status: 'unavailable' as const,
      registry: registryIdentity(registry),
      requested,
      reconciliation,
      calendar,
      systemLevels: Object.freeze(systemLevels),
      missingInputs: Object.freeze([]),
      unavailableReasons: Object.freeze(
        reasons.length > 0
          ? [...reasons]
          : ['One or more governed inputs did not resolve.']
      ),
      inputManifest: null,
    });

  if (!allResolved) return unresolvedEnvelope(unavailableReasons);

  // Build the manifest from the resolved values themselves. Anything still
  // absent here means a resolution reported `available` without a record, which
  // is a contract violation rather than a completed result — so it returns
  // unavailable instead of being asserted away with a non-null cast.
  const calendarRecord = calendar.record;
  const calendarSeasonKey = calendar.seasonKey;
  const manifestLevels: GovernedManifestInput[] = [];
  const usedSourceRecords: GovernedSourceRecord[] = [];

  for (const levelId of GOVERNED_SYSTEM_LEVEL_IDS) {
    const level = systemLevels[levelId];
    if (!level.record || level.amount === null) {
      return unresolvedEnvelope([
        `The ${levelId} resolution reported available without a governed record and amount.`,
      ]);
    }
    const levelSource = sourceRecordFor(registry, level.record);
    if (!levelSource) {
      return unresolvedEnvelope([
        `The ${levelId} governed record cites an unavailable source record version.`,
      ]);
    }
    usedSourceRecords.push(levelSource);
    manifestLevels.push(
      Object.freeze({
        levelId,
        amount: level.amount,
        recordId: level.record.recordId,
        recordVersion: level.record.recordVersion,
        authority: level.record.authority,
        sourceRecordId: level.record.sourceRecordId,
        sourceRecordVersion: level.record.sourceRecordVersion,
        sourceField: level.record.sourceField,
        sourceArtifactSha256: levelSource.artifactSha256,
        sourceAuthorityClass: governedSourceAuthorityClass(levelSource),
      })
    );
  }

  if (!calendarRecord || !calendarSeasonKey) {
    return unresolvedEnvelope([
      'The season calendar reported available without a governed record and season key.',
    ]);
  }
  const calendarSource = sourceRecordFor(registry, calendarRecord);
  if (!calendarSource) {
    return unresolvedEnvelope([
      'The season calendar cites an unavailable source record version.',
    ]);
  }
  usedSourceRecords.push(calendarSource);

  const postCanonSources = [
    ...new Map(
      usedSourceRecords
        .map(postCanonManifestSourceFor)
        .filter(
          (source): source is GovernedManifestPostCanonSource => source != null
        )
        .map((source) => [
          `${source.sourceRecordId}@${source.sourceRecordVersion}`,
          source,
        ])
    ).values(),
  ];

  const inputManifest: GovernedInputManifest = Object.freeze({
    manifestVersion: 2 as const,
    registry: registryIdentity(registry),
    asOfDate,
    salaryCapYear,
    requiredAuthority,
    team: requested.team,
    calendar: Object.freeze({
      recordId: calendarRecord.recordId,
      recordVersion: calendarRecord.recordVersion,
      authority: calendarRecord.authority,
      seasonKey: calendarSeasonKey,
      sourceRecordId: calendarRecord.sourceRecordId,
      sourceRecordVersion: calendarRecord.sourceRecordVersion,
      sourceField: calendarRecord.sourceField,
      sourceArtifactSha256: calendarSource.artifactSha256,
      sourceAuthorityClass: governedSourceAuthorityClass(calendarSource),
    }),
    systemLevels: Object.freeze(manifestLevels),
    postCanonSources: Object.freeze(postCanonSources),
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
  | 'content-mismatch'
  | 'registry-mismatch';

/**
 * Why one retained input no longer verifies.
 *
 * `record-absent`    the exact record id and version is gone from the registry;
 * `record-superseded` it is still present but no longer current;
 * `content-changed`  it is still present and current, but its governed content
 *                    differs from what the result actually consumed — the most
 *                    serious failure, because the version did not move.
 */
export type GovernedManifestDriftKind =
  | 'record-absent'
  | 'record-superseded'
  | 'content-changed';

export interface GovernedManifestDrift {
  readonly inputId: string;
  readonly recordId: string;
  readonly recordVersion: number;
  readonly kind: GovernedManifestDriftKind;
  readonly reason: string;
  /** Field names that differ, for `content-changed` only. */
  readonly changedFields: readonly string[];
}

export interface GovernedManifestVerification {
  readonly state: GovernedManifestVerificationState;
  readonly driftedInputs: readonly GovernedManifestDrift[];
}

/** Collect field names whose retained value no longer matches the registry. */
function changedFieldsFor(
  comparisons: readonly [string, unknown, unknown][]
): string[] {
  return comparisons
    .filter(([, retained, current]) => retained !== current)
    .map(([field]) => field);
}

/**
 * Check a retained manifest against a registry without changing the manifest.
 *
 * Existence and `current` status are not enough. A registry can be rebuilt with
 * the same record id and version but a different amount, authority, level,
 * season, or source identity; certifying an old result against that registry
 * would claim it consumed inputs it never saw. So every retained field is
 * compared against the matched record, and any difference is reported as
 * `content-changed` drift — the version did not move, which is why it outranks
 * a plain supersession.
 *
 * The manifest itself is never modified: the earlier result keeps the values it
 * was computed from (`CBA2-S02.1`, `CBA2-S02.6`).
 */
export function verifyGovernedInputManifest(
  manifest: GovernedVerifiableInputManifest,
  registry: GovernedSeasonRegistry = CANON_GOVERNED_SEASON_REGISTRY
): GovernedManifestVerification {
  if (
    manifest.registry.registryId !== registry.registryId ||
    manifest.registry.canonCandidateCommit !== registry.canonCandidateCommit ||
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
      kind: 'record-absent',
      reason:
        'The calendar record version used by this result is not in the registry.',
      changedFields: Object.freeze([]),
    });
  } else if (calendarRecord.recordStatus !== 'current') {
    drifted.push({
      inputId: 'calendar',
      recordId: calendarRecord.recordId,
      recordVersion: calendarRecord.recordVersion,
      kind: 'record-superseded',
      reason:
        'The calendar record version used by this result has been superseded.',
      changedFields: Object.freeze([]),
    });
  } else {
    const changedFields = changedFieldsFor([
      ['authority', manifest.calendar.authority, calendarRecord.authority],
      ['seasonKey', manifest.calendar.seasonKey, calendarRecord.seasonKey],
      ['salaryCapYear', manifest.salaryCapYear, calendarRecord.salaryCapYear],
      [
        'sourceRecordId',
        manifest.calendar.sourceRecordId,
        calendarRecord.sourceRecordId,
      ],
      [
        'sourceRecordVersion',
        manifest.calendar.sourceRecordVersion,
        calendarRecord.sourceRecordVersion,
      ],
      [
        'sourceField',
        manifest.calendar.sourceField,
        calendarRecord.sourceField,
      ],
      [
        'sourceArtifactSha256',
        manifest.calendar.sourceArtifactSha256,
        sourceArtifactSha256For(registry, calendarRecord),
      ],
    ]);
    const calendarSource = sourceRecordFor(registry, calendarRecord);
    if (manifest.manifestVersion === 2) {
      changedFields.push(
        ...changedFieldsFor([
          [
            'sourceAuthorityClass',
            manifest.calendar.sourceAuthorityClass,
            calendarSource
              ? governedSourceAuthorityClass(calendarSource)
              : null,
          ],
        ])
      );
    } else if (
      calendarSource &&
      isGovernedPostCanonOfficialSourceRecord(calendarSource)
    ) {
      changedFields.push('manifestVersion');
    }
    if (changedFields.length > 0) {
      drifted.push({
        inputId: 'calendar',
        recordId: calendarRecord.recordId,
        recordVersion: calendarRecord.recordVersion,
        kind: 'content-changed',
        reason: `The calendar record kept its version but its governed content changed (${changedFields.join(', ')}).`,
        changedFields: Object.freeze(changedFields),
      });
    }
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
        kind: 'record-absent',
        reason:
          'The record version used by this result is not in the registry.',
        changedFields: Object.freeze([]),
      });
      return;
    }
    if (record.recordStatus !== 'current') {
      drifted.push({
        inputId: input.levelId,
        recordId: record.recordId,
        recordVersion: record.recordVersion,
        kind: 'record-superseded',
        reason: 'The record version used by this result has been superseded.',
        changedFields: Object.freeze([]),
      });
      return;
    }

    const changedFields = changedFieldsFor([
      ['levelId', input.levelId, record.levelId],
      ['amount', input.amount, record.amount],
      ['authority', input.authority, record.authority],
      ['salaryCapYear', manifest.salaryCapYear, record.salaryCapYear],
      ['sourceRecordId', input.sourceRecordId, record.sourceRecordId],
      [
        'sourceRecordVersion',
        input.sourceRecordVersion,
        record.sourceRecordVersion,
      ],
      ['sourceField', input.sourceField, record.sourceField],
      [
        'sourceArtifactSha256',
        input.sourceArtifactSha256,
        sourceArtifactSha256For(registry, record),
      ],
    ]);
    const levelSource = sourceRecordFor(registry, record);
    if (manifest.manifestVersion === 2) {
      const currentInput = input as GovernedManifestInput;
      changedFields.push(
        ...changedFieldsFor([
          [
            'sourceAuthorityClass',
            currentInput.sourceAuthorityClass,
            levelSource ? governedSourceAuthorityClass(levelSource) : null,
          ],
        ])
      );
    } else if (
      levelSource &&
      isGovernedPostCanonOfficialSourceRecord(levelSource)
    ) {
      changedFields.push('manifestVersion');
    }
    if (changedFields.length > 0) {
      drifted.push({
        inputId: input.levelId,
        recordId: record.recordId,
        recordVersion: record.recordVersion,
        kind: 'content-changed',
        reason: `The ${input.levelId} record kept its version but its governed content changed (${changedFields.join(', ')}).`,
        changedFields: Object.freeze(changedFields),
      });
    }
  });

  if (manifest.manifestVersion === 2) {
    const usedPostCanonSourceKeys = new Set(
      [manifest.calendar, ...manifest.systemLevels]
        .filter((input) => input.sourceAuthorityClass === 'post-canon-official')
        .map((input) => `${input.sourceRecordId}@${input.sourceRecordVersion}`)
    );
    const retainedPostCanonSourceKeys = new Set(
      manifest.postCanonSources.map(
        (source) => `${source.sourceRecordId}@${source.sourceRecordVersion}`
      )
    );
    if (
      manifest.postCanonSources.length !== retainedPostCanonSourceKeys.size ||
      usedPostCanonSourceKeys.size !== retainedPostCanonSourceKeys.size ||
      [...usedPostCanonSourceKeys].some(
        (key) => !retainedPostCanonSourceKeys.has(key)
      )
    ) {
      drifted.push({
        inputId: 'post-canon-source-lineage',
        recordId: manifest.calendar.recordId,
        recordVersion: manifest.calendar.recordVersion,
        kind: 'content-changed',
        reason:
          'The manifest post-Canon source list does not exactly match the post-Canon sources used by its governed inputs.',
        changedFields: Object.freeze(['postCanonSources']),
      });
    }

    manifest.postCanonSources.forEach((retainedSource) => {
      const currentSource = registry.sourceRecords.find(
        (source) =>
          source.sourceRecordId === retainedSource.sourceRecordId &&
          source.sourceRecordVersion === retainedSource.sourceRecordVersion
      );
      if (!currentSource) {
        drifted.push({
          inputId: `source:${retainedSource.sourceRecordId}`,
          recordId: retainedSource.sourceRecordId,
          recordVersion: retainedSource.sourceRecordVersion,
          kind: 'record-absent',
          reason:
            'The post-Canon source record version used by this result is not in the registry.',
          changedFields: Object.freeze([]),
        });
        return;
      }
      if (currentSource.recordStatus !== 'current') {
        drifted.push({
          inputId: `source:${retainedSource.sourceRecordId}`,
          recordId: retainedSource.sourceRecordId,
          recordVersion: retainedSource.sourceRecordVersion,
          kind: 'record-superseded',
          reason:
            'The post-Canon source record version used by this result has been superseded.',
          changedFields: Object.freeze([]),
        });
        return;
      }

      const currentManifestSource = postCanonManifestSourceFor(currentSource);
      const changedFields = changedFieldsFor([
        [
          'authorityClass',
          'post-canon-official',
          governedSourceAuthorityClass(currentSource),
        ],
        ['identity', retainedSource.identity, currentManifestSource?.identity],
        [
          'officialUrl',
          retainedSource.officialUrl,
          currentManifestSource?.officialUrl,
        ],
        [
          'artifactSha256',
          retainedSource.artifactSha256,
          currentManifestSource?.artifactSha256,
        ],
        [
          'artifactByteSize',
          retainedSource.artifactByteSize,
          currentManifestSource?.artifactByteSize,
        ],
        [
          'certificationRecordId',
          retainedSource.certificationRecordId,
          currentManifestSource?.certificationRecordId,
        ],
        [
          'certificationRecordVersion',
          retainedSource.certificationRecordVersion,
          currentManifestSource?.certificationRecordVersion,
        ],
        [
          'authorityScope',
          retainedSource.authorityScope,
          currentManifestSource?.authorityScope,
        ],
        [
          'retainedArtifactPath',
          retainedSource.retainedArtifactPath,
          currentManifestSource?.retainedArtifactPath,
        ],
        [
          'retainedArtifactSha256',
          retainedSource.retainedArtifactSha256,
          currentManifestSource?.retainedArtifactSha256,
        ],
        [
          'retainedArtifactByteSize',
          retainedSource.retainedArtifactByteSize,
          currentManifestSource?.retainedArtifactByteSize,
        ],
      ]);
      if (changedFields.length > 0) {
        drifted.push({
          inputId: `source:${retainedSource.sourceRecordId}`,
          recordId: retainedSource.sourceRecordId,
          recordVersion: retainedSource.sourceRecordVersion,
          kind: 'content-changed',
          reason: `The post-Canon source kept its version but its retained authority content changed (${changedFields.join(', ')}).`,
          changedFields: Object.freeze(changedFields),
        });
      }
    });
  }

  const state: GovernedManifestVerificationState =
    drifted.length === 0
      ? 'current'
      : drifted.some((entry) => entry.kind === 'content-changed')
        ? 'content-mismatch'
        : 'superseded';

  return Object.freeze({ state, driftedInputs: Object.freeze(drifted) });
}
