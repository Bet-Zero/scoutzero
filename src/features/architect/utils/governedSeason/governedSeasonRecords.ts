/**
 * FILE: src/features/architect/utils/governedSeason/governedSeasonRecords.ts
 * PURPOSE: Immutable, versioned governed records for season inputs.
 * OWNERSHIP: Feature: architect/governed season inputs
 *
 * BZE-270. A governed record is the unit the audit asks for: one value, one
 * Salary Cap Year, one authority class, one exact source artifact and field,
 * one record version, and one effective period.
 *
 * Records are immutable. A source revision does not edit a record in place; it
 * appends a new record version that marks the prior version `superseded`
 * (Canon `CBA2-S02.1`). Two `current` records for the same value and authority
 * are an unresolved conflict, not a tie to break (`CBA2-S02.2`).
 */

import {
  isDateOnly,
  isNonEmptyString,
  isSupportedSalaryCapYear,
  isZonedDateTime,
  salaryCapYearWindow,
} from './governedTime';

/** The five core annual system levels governed by BZE-270. */
export const GOVERNED_SYSTEM_LEVEL_IDS = [
  'salary-cap',
  'minimum-team-salary',
  'tax-level',
  'first-apron',
  'second-apron',
] as const;

export type GovernedSystemLevelId = (typeof GOVERNED_SYSTEM_LEVEL_IDS)[number];

/**
 * Authority class. Official and projected are separate populations; neither
 * substitutes for the other (`CBA2-S01.9`).
 */
export const GOVERNED_AUTHORITIES = ['official', 'projected'] as const;
export type GovernedAuthority = (typeof GOVERNED_AUTHORITIES)[number];

export type GovernedRecordStatus = 'current' | 'superseded';

export const GOVERNED_SOURCE_PROVENANCE_TYPES = [
  'official-immutable',
  'official-mutable',
  'ext-contract',
] as const;
export type GovernedSourceProvenanceType =
  (typeof GOVERNED_SOURCE_PROVENANCE_TYPES)[number];

export type GovernedSourceAuthorityClass =
  | 'accepted-canon'
  | 'post-canon-official';

export interface GovernedPostCanonExactField {
  readonly fieldId: string;
  /** Exact text or markup retained in the captured artifact. */
  readonly sourceText: string;
  readonly normalizedValue: string;
}

export interface GovernedPostCanonGateHistoryEntry {
  readonly artifactSha256: string;
  readonly artifactByteSize: number;
  readonly capturedOn: string;
  readonly bytesRetained: false;
  readonly runtimeAuthority: 'none';
  readonly disposition: 'superseded-by-mutable-page-drift';
}

/**
 * Certification metadata for a first-party factual input published after the
 * accepted Canon froze. This lane cannot carry or reinterpret a CBA rule.
 */
export interface GovernedPostCanonOfficialCertification {
  readonly certificationRecordId: string;
  readonly certificationRecordVersion: number;
  readonly authorityScope: 'time-varying-factual-input-only';
  readonly publicationDate: string;
  readonly firstPartyHost: 'pr.nba.com';
  readonly retainedArtifactPath: string;
  readonly retainedArtifactSha256: string;
  readonly retainedArtifactByteSize: number;
  readonly matchingFirstPartyRetrievalCount: number;
  readonly matchingRetrievalDate: string;
  readonly exactFields: readonly GovernedPostCanonExactField[];
  readonly supersedesCertificationRecordVersion: number | null;
  readonly gateHistory: readonly GovernedPostCanonGateHistoryEntry[];
}

interface GovernedSourceRecordBase {
  readonly sourceRecordId: string;
  readonly sourceRecordVersion: number;
  readonly provenanceType: GovernedSourceProvenanceType;
  readonly identity: string;
  /** `basis:value` form used by the Canon, e.g. `publication:2026-06-30`. */
  readonly sourceDateBasis: string | null;
  readonly officialUrl: string | null;
  readonly artifactSha256: string | null;
  readonly artifactByteSize: number | null;
  readonly retrievalTimestamp: string | null;
  readonly authenticationTimestamp: string | null;
  readonly verifierIdentity: string;
  readonly verificationSessionId: string;
  readonly verificationDate: string;
  readonly recordLimitations: string;
  readonly recordStatus: GovernedRecordStatus;
}

/** A source record transcribed from the frozen accepted Canon candidate. */
export interface GovernedCanonSourceRecord extends GovernedSourceRecordBase {
  readonly canonLocator: string;
  readonly postCanonCertification?: never;
}

/** A separately certified, retained first-party factual source. */
export interface GovernedPostCanonOfficialSourceRecord
  extends GovernedSourceRecordBase {
  readonly sourceDateBasis: string;
  readonly officialUrl: string;
  readonly artifactSha256: string;
  readonly artifactByteSize: number;
  readonly retrievalTimestamp: string;
  /** Canon leaf mappings on governed values are traceability, not provenance. */
  readonly canonLocator: null;
  readonly postCanonCertification: GovernedPostCanonOfficialCertification;
}

export type GovernedSourceRecord =
  | GovernedCanonSourceRecord
  | GovernedPostCanonOfficialSourceRecord;

export function isGovernedPostCanonOfficialSourceRecord(
  record: GovernedSourceRecord
): record is GovernedPostCanonOfficialSourceRecord {
  return record.postCanonCertification != null;
}

export function governedSourceAuthorityClass(
  record: GovernedSourceRecord
): GovernedSourceAuthorityClass {
  return isGovernedPostCanonOfficialSourceRecord(record)
    ? 'post-canon-official'
    : 'accepted-canon';
}

/** A governed annual system level for one Salary Cap Year. */
export interface GovernedSystemLevelRecord {
  readonly recordId: string;
  readonly recordVersion: number;
  readonly levelId: GovernedSystemLevelId;
  /** End year of the Salary Cap Year, e.g. 2027 for 2026-27. */
  readonly salaryCapYear: number;
  readonly authority: GovernedAuthority;
  /** Whole dollars. */
  readonly amount: number;
  readonly sourceRecordId: string;
  readonly sourceRecordVersion: number;
  /** Exact field identity relied upon inside the source artifact. */
  readonly sourceField: string;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly canonLeafIds: readonly string[];
  readonly recordStatus: GovernedRecordStatus;
  readonly supersedesRecordVersion: number | null;
}

/**
 * A calendar date exactly as its source states it. `date-only` values carry no
 * time and no zone: promoting one to an instant would violate `CBA2-L01.8`.
 */
export interface GovernedCalendarDate {
  readonly value: string;
  readonly precision: 'date-only';
  readonly governingTimeZone: string;
}

/** A governed annual season calendar record. */
export interface GovernedSeasonCalendarRecord {
  readonly recordId: string;
  readonly recordVersion: number;
  readonly salaryCapYear: number;
  readonly seasonKey: string;
  readonly authority: GovernedAuthority;
  readonly regularSeasonOpening: GovernedCalendarDate;
  readonly regularSeasonClosing: GovernedCalendarDate;
  readonly sourceRecordId: string;
  readonly sourceRecordVersion: number;
  readonly sourceField: string;
  readonly publicationDate: string;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly canonLeafIds: readonly string[];
  readonly recordStatus: GovernedRecordStatus;
  readonly supersedesRecordVersion: number | null;
  /**
   * Calendar fields this source explicitly does not certify. They stay named
   * and unavailable rather than being inferred (`CBA2-S01.6`).
   */
  readonly uncertifiedFields: readonly string[];
}

export interface GovernedSeasonRegistry {
  readonly registryId: string;
  readonly registryVersion: number;
  /** Accepted Canon candidate commit this registry was transcribed from. */
  readonly canonCandidateCommit: string;
  readonly canonSha256: string;
  readonly sourceRecords: readonly GovernedSourceRecord[];
  /** Separate view of factual sources certified after the Canon freeze. */
  readonly postCanonSourceRecords: readonly GovernedPostCanonOfficialSourceRecord[];
  readonly systemLevels: readonly GovernedSystemLevelRecord[];
  readonly calendars: readonly GovernedSeasonCalendarRecord[];
  /** Salary Cap Years this registry holds any governed record for. */
  readonly supportedSalaryCapYears: readonly number[];
}

export interface GovernedSeasonRegistryInput {
  registryId: string;
  registryVersion: number;
  canonCandidateCommit: string;
  canonSha256: string;
  sourceRecords: readonly GovernedSourceRecord[];
  systemLevels?: readonly GovernedSystemLevelRecord[];
  calendars?: readonly GovernedSeasonCalendarRecord[];
}

export class GovernedSeasonRegistryError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Invalid governed season registry: ${problems.join('; ')}`);
    this.name = 'GovernedSeasonRegistryError';
    this.problems = [...problems];
  }
}

function validateSourceRecord(
  record: GovernedSourceRecord,
  index: number,
  problems: string[]
): void {
  const at = `sourceRecords[${index}]`;

  if (!isNonEmptyString(record.sourceRecordId)) {
    problems.push(`${at}.sourceRecordId`);
  }
  if (
    !Number.isInteger(record.sourceRecordVersion) ||
    record.sourceRecordVersion < 1
  ) {
    problems.push(`${at}.sourceRecordVersion`);
  }
  if (
    !GOVERNED_SOURCE_PROVENANCE_TYPES.some(
      (type) => type === record.provenanceType
    )
  ) {
    problems.push(`${at}.provenanceType`);
  }
  if (!isNonEmptyString(record.identity)) problems.push(`${at}.identity`);
  if (
    record.recordStatus !== 'current' &&
    record.recordStatus !== 'superseded'
  ) {
    problems.push(`${at}.recordStatus`);
  }

  if (!isGovernedPostCanonOfficialSourceRecord(record)) {
    if (!isNonEmptyString(record.canonLocator)) {
      problems.push(`${at}.canonLocator`);
    }
    return;
  }

  const certification = record.postCanonCertification;
  if (record.canonLocator !== null) problems.push(`${at}.canonLocator`);
  if (!record.sourceRecordId.startsWith('POSTCANON-SRC-')) {
    problems.push(`${at}.sourceRecordId`);
  }
  if (
    record.provenanceType !== 'official-immutable' &&
    record.provenanceType !== 'official-mutable'
  ) {
    problems.push(`${at}.provenanceType`);
  }
  if (!isNonEmptyString(record.officialUrl)) {
    problems.push(`${at}.officialUrl`);
  } else {
    try {
      const url = new URL(record.officialUrl);
      if (
        url.protocol !== 'https:' ||
        url.hostname !== certification.firstPartyHost
      ) {
        problems.push(`${at}.officialUrl`);
      }
    } catch {
      problems.push(`${at}.officialUrl`);
    }
  }
  if (!/^[0-9a-f]{64}$/.test(record.artifactSha256 ?? '')) {
    problems.push(`${at}.artifactSha256`);
  }
  if (
    !Number.isInteger(record.artifactByteSize) ||
    (record.artifactByteSize ?? 0) < 1
  ) {
    problems.push(`${at}.artifactByteSize`);
  }
  if (!isZonedDateTime(record.retrievalTimestamp ?? '')) {
    problems.push(`${at}.retrievalTimestamp`);
  }
  if (!isDateOnly(record.verificationDate)) {
    problems.push(`${at}.verificationDate`);
  }
  if (!isNonEmptyString(record.verifierIdentity)) {
    problems.push(`${at}.verifierIdentity`);
  }
  if (!isNonEmptyString(record.verificationSessionId)) {
    problems.push(`${at}.verificationSessionId`);
  }
  if (!isNonEmptyString(record.recordLimitations)) {
    problems.push(`${at}.recordLimitations`);
  }

  if (!isNonEmptyString(certification.certificationRecordId)) {
    problems.push(`${at}.postCanonCertification.certificationRecordId`);
  }
  if (
    !Number.isInteger(certification.certificationRecordVersion) ||
    certification.certificationRecordVersion < 1
  ) {
    problems.push(`${at}.postCanonCertification.certificationRecordVersion`);
  }
  if (certification.authorityScope !== 'time-varying-factual-input-only') {
    problems.push(`${at}.postCanonCertification.authorityScope`);
  }
  if (
    !isDateOnly(certification.publicationDate) ||
    record.sourceDateBasis !== `publication:${certification.publicationDate}`
  ) {
    problems.push(`${at}.postCanonCertification.publicationDate`);
  }
  if (certification.firstPartyHost !== 'pr.nba.com') {
    problems.push(`${at}.postCanonCertification.firstPartyHost`);
  }
  if (!isNonEmptyString(certification.retainedArtifactPath)) {
    problems.push(`${at}.postCanonCertification.retainedArtifactPath`);
  }
  if (
    certification.retainedArtifactSha256 !== record.artifactSha256 ||
    certification.retainedArtifactByteSize !== record.artifactByteSize
  ) {
    problems.push(`${at}.postCanonCertification.retainedArtifact`);
  }
  if (
    !Number.isInteger(certification.matchingFirstPartyRetrievalCount) ||
    certification.matchingFirstPartyRetrievalCount < 2
  ) {
    problems.push(
      `${at}.postCanonCertification.matchingFirstPartyRetrievalCount`
    );
  }
  if (!isDateOnly(certification.matchingRetrievalDate)) {
    problems.push(`${at}.postCanonCertification.matchingRetrievalDate`);
  }
  if (
    !Array.isArray(certification.exactFields) ||
    certification.exactFields.length === 0 ||
    certification.exactFields.some(
      (field) =>
        !isNonEmptyString(field.fieldId) ||
        !isNonEmptyString(field.sourceText) ||
        !isNonEmptyString(field.normalizedValue)
    )
  ) {
    problems.push(`${at}.postCanonCertification.exactFields`);
  }
  if (
    certification.supersedesCertificationRecordVersion != null &&
    (!Number.isInteger(certification.supersedesCertificationRecordVersion) ||
      certification.supersedesCertificationRecordVersion >=
        certification.certificationRecordVersion)
  ) {
    problems.push(
      `${at}.postCanonCertification.supersedesCertificationRecordVersion`
    );
  }
  if (
    !Array.isArray(certification.gateHistory) ||
    certification.gateHistory.some(
      (entry) =>
        !/^[0-9a-f]{64}$/.test(entry.artifactSha256) ||
        !Number.isInteger(entry.artifactByteSize) ||
        entry.artifactByteSize < 1 ||
        !isDateOnly(entry.capturedOn) ||
        entry.bytesRetained !== false ||
        entry.runtimeAuthority !== 'none' ||
        entry.disposition !== 'superseded-by-mutable-page-drift'
    )
  ) {
    problems.push(`${at}.postCanonCertification.gateHistory`);
  }
}

function validateEffectivePeriod(
  at: string,
  effectiveFrom: string,
  effectiveUntil: string | null,
  salaryCapYear: number,
  problems: string[]
): void {
  if (!isZonedDateTime(effectiveFrom)) {
    problems.push(`${at}.effectiveFrom`);
    return;
  }
  if (effectiveUntil != null && !isZonedDateTime(effectiveUntil)) {
    problems.push(`${at}.effectiveUntil`);
    return;
  }
  if (
    effectiveUntil != null &&
    Date.parse(effectiveUntil) <= Date.parse(effectiveFrom)
  ) {
    problems.push(`${at}.effectiveUntil`);
    return;
  }

  // A record's effective period must not claim authority outside the Salary
  // Cap Year it is keyed to; that is how a prior season leaks into a later one.
  const window = salaryCapYearWindow(salaryCapYear);
  if (!window) {
    problems.push(`${at}.salaryCapYear`);
    return;
  }
  if (Date.parse(effectiveFrom) < Date.parse(window.from)) {
    problems.push(`${at}.effectiveFrom`);
  }
  // An open-ended record starting after the year's upper boundary would be
  // keyed to one Salary Cap Year while claiming authority in every later
  // instant. The resolver rejects it at read time, but construction is where
  // validation is total, so it is closed here too.
  if (Date.parse(effectiveFrom) >= Date.parse(window.until)) {
    problems.push(`${at}.effectiveFrom`);
  }
  if (
    effectiveUntil != null &&
    Date.parse(effectiveUntil) > Date.parse(window.until)
  ) {
    problems.push(`${at}.effectiveUntil`);
  }
}

function validateSystemLevelRecord(
  record: GovernedSystemLevelRecord,
  index: number,
  sourceRecordsByKey: ReadonlyMap<string, GovernedSourceRecord>,
  problems: string[]
): void {
  const at = `systemLevels[${index}]`;

  if (!isNonEmptyString(record.recordId)) problems.push(`${at}.recordId`);
  if (!Number.isInteger(record.recordVersion) || record.recordVersion < 1) {
    problems.push(`${at}.recordVersion`);
  }
  if (!GOVERNED_SYSTEM_LEVEL_IDS.some((id) => id === record.levelId)) {
    problems.push(`${at}.levelId`);
  }
  if (!isSupportedSalaryCapYear(record.salaryCapYear)) {
    problems.push(`${at}.salaryCapYear`);
  }
  if (!GOVERNED_AUTHORITIES.some((a) => a === record.authority)) {
    problems.push(`${at}.authority`);
  }
  if (!Number.isFinite(record.amount) || record.amount < 0) {
    problems.push(`${at}.amount`);
  }
  if (!isNonEmptyString(record.sourceField)) problems.push(`${at}.sourceField`);
  const sourceRecord = sourceRecordsByKey.get(
    `${record.sourceRecordId}@${record.sourceRecordVersion}`
  );
  if (!sourceRecord) {
    problems.push(`${at}.sourceRecordId`);
  }
  if (sourceRecord && isGovernedPostCanonOfficialSourceRecord(sourceRecord)) {
    const exactField = sourceRecord.postCanonCertification.exactFields.find(
      (field) => field.fieldId === record.levelId
    );
    if (
      record.authority !== 'official' ||
      !exactField ||
      exactField.normalizedValue !== String(record.amount) ||
      !record.sourceField.includes(exactField.sourceText)
    ) {
      problems.push(`${at}.postCanonCertification.exactFields`);
    }
  }
  if (
    !Array.isArray(record.canonLeafIds) ||
    record.canonLeafIds.length === 0 ||
    record.canonLeafIds.some((leafId) => !isNonEmptyString(leafId))
  ) {
    problems.push(`${at}.canonLeafIds`);
  }
  if (
    record.recordStatus !== 'current' &&
    record.recordStatus !== 'superseded'
  ) {
    problems.push(`${at}.recordStatus`);
  }
  if (
    record.supersedesRecordVersion != null &&
    (!Number.isInteger(record.supersedesRecordVersion) ||
      record.supersedesRecordVersion >= record.recordVersion)
  ) {
    problems.push(`${at}.supersedesRecordVersion`);
  }
  if (isSupportedSalaryCapYear(record.salaryCapYear)) {
    validateEffectivePeriod(
      at,
      record.effectiveFrom,
      record.effectiveUntil,
      record.salaryCapYear,
      problems
    );
  }
}

function validateCalendarDate(
  at: string,
  date: GovernedCalendarDate,
  problems: string[]
): void {
  if (!date || !isDateOnly(date.value)) {
    problems.push(`${at}.value`);
  }
  if (date?.precision !== 'date-only') problems.push(`${at}.precision`);
  if (!isNonEmptyString(date?.governingTimeZone)) {
    problems.push(`${at}.governingTimeZone`);
  }
}

function validateCalendarRecord(
  record: GovernedSeasonCalendarRecord,
  index: number,
  sourceRecordsByKey: ReadonlyMap<string, GovernedSourceRecord>,
  problems: string[]
): void {
  const at = `calendars[${index}]`;

  if (!isNonEmptyString(record.recordId)) problems.push(`${at}.recordId`);
  if (!Number.isInteger(record.recordVersion) || record.recordVersion < 1) {
    problems.push(`${at}.recordVersion`);
  }
  if (!isSupportedSalaryCapYear(record.salaryCapYear)) {
    problems.push(`${at}.salaryCapYear`);
  }
  if (!isNonEmptyString(record.seasonKey)) problems.push(`${at}.seasonKey`);
  if (!GOVERNED_AUTHORITIES.some((a) => a === record.authority)) {
    problems.push(`${at}.authority`);
  }
  if (!isNonEmptyString(record.sourceField)) problems.push(`${at}.sourceField`);
  if (!isDateOnly(record.publicationDate)) {
    problems.push(`${at}.publicationDate`);
  }
  const sourceRecord = sourceRecordsByKey.get(
    `${record.sourceRecordId}@${record.sourceRecordVersion}`
  );
  if (!sourceRecord) {
    problems.push(`${at}.sourceRecordId`);
  }
  if (sourceRecord && isGovernedPostCanonOfficialSourceRecord(sourceRecord)) {
    const openingField = sourceRecord.postCanonCertification.exactFields.find(
      (field) => field.fieldId === 'regularSeasonOpening'
    );
    const closingField = sourceRecord.postCanonCertification.exactFields.find(
      (field) => field.fieldId === 'regularSeasonClosing'
    );
    if (
      record.authority !== 'official' ||
      record.publicationDate !==
        sourceRecord.postCanonCertification.publicationDate ||
      !openingField ||
      openingField.normalizedValue !== record.regularSeasonOpening?.value ||
      !record.sourceField.includes(openingField.sourceText) ||
      !closingField ||
      closingField.normalizedValue !== record.regularSeasonClosing?.value ||
      !record.sourceField.includes(closingField.sourceText)
    ) {
      problems.push(`${at}.postCanonCertification.exactFields`);
    }
  }
  if (
    !Array.isArray(record.canonLeafIds) ||
    record.canonLeafIds.length === 0 ||
    record.canonLeafIds.some((leafId) => !isNonEmptyString(leafId))
  ) {
    problems.push(`${at}.canonLeafIds`);
  }
  if (
    record.recordStatus !== 'current' &&
    record.recordStatus !== 'superseded'
  ) {
    problems.push(`${at}.recordStatus`);
  }

  validateCalendarDate(
    `${at}.regularSeasonOpening`,
    record.regularSeasonOpening,
    problems
  );
  validateCalendarDate(
    `${at}.regularSeasonClosing`,
    record.regularSeasonClosing,
    problems
  );

  if (
    isDateOnly(record.regularSeasonOpening?.value) &&
    isDateOnly(record.regularSeasonClosing?.value) &&
    record.regularSeasonClosing.value <= record.regularSeasonOpening.value
  ) {
    problems.push(`${at}.regularSeasonClosing.value`);
  }
  if (isSupportedSalaryCapYear(record.salaryCapYear)) {
    validateEffectivePeriod(
      at,
      record.effectiveFrom,
      record.effectiveUntil,
      record.salaryCapYear,
      problems
    );
  }
}

/**
 * Clone-and-freeze helpers.
 *
 * `Object.freeze` is shallow, and spreading an array copies element references
 * rather than the elements. Freezing only the arrays would leave every record
 * — and every nested date, leaf-id list, and uncertified-field list — writable
 * through the objects the caller passed in. Because
 * `CANON_GOVERNED_SEASON_REGISTRY` is a module-level singleton, one such
 * mutation would change every later resolution and every manifest verification
 * while the record version, registry version, and Canon hash stayed put. Each
 * record is therefore copied away from the caller and frozen to its leaves.
 */
function freezeSourceRecord(
  record: GovernedSourceRecord
): GovernedSourceRecord {
  if (!isGovernedPostCanonOfficialSourceRecord(record)) {
    return Object.freeze({ ...record });
  }

  return Object.freeze({
    ...record,
    postCanonCertification: Object.freeze({
      ...record.postCanonCertification,
      exactFields: Object.freeze(
        record.postCanonCertification.exactFields.map((field) =>
          Object.freeze({ ...field })
        )
      ),
      gateHistory: Object.freeze(
        record.postCanonCertification.gateHistory.map((entry) =>
          Object.freeze({ ...entry })
        )
      ),
    }),
  });
}

function freezeSystemLevelRecord(
  record: GovernedSystemLevelRecord
): GovernedSystemLevelRecord {
  return Object.freeze({
    ...record,
    canonLeafIds: Object.freeze([...record.canonLeafIds]),
  });
}

function freezeCalendarDate(date: GovernedCalendarDate): GovernedCalendarDate {
  return Object.freeze({ ...date });
}

function freezeCalendarRecord(
  record: GovernedSeasonCalendarRecord
): GovernedSeasonCalendarRecord {
  return Object.freeze({
    ...record,
    regularSeasonOpening: freezeCalendarDate(record.regularSeasonOpening),
    regularSeasonClosing: freezeCalendarDate(record.regularSeasonClosing),
    canonLeafIds: Object.freeze([...record.canonLeafIds]),
    uncertifiedFields: Object.freeze([...record.uncertifiedFields]),
  });
}

/**
 * Build a governed registry, rejecting anything that could not be audited back
 * to a declared source record. Construction is the only place a record enters
 * the governed path, so validation is total rather than best-effort.
 */
export function createGovernedSeasonRegistry(
  input: GovernedSeasonRegistryInput
): GovernedSeasonRegistry {
  const problems: string[] = [];

  if (!isNonEmptyString(input.registryId)) problems.push('registryId');
  if (!Number.isInteger(input.registryVersion) || input.registryVersion < 1) {
    problems.push('registryVersion');
  }
  if (!isNonEmptyString(input.canonCandidateCommit)) {
    problems.push('canonCandidateCommit');
  }
  if (!/^[0-9a-f]{64}$/.test(input.canonSha256 ?? '')) {
    problems.push('canonSha256');
  }

  const sourceRecords = input.sourceRecords ?? [];
  sourceRecords.forEach((record, index) =>
    validateSourceRecord(record, index, problems)
  );

  // Two source records sharing one `id@version` would collapse into a single
  // lookup entry while identifying different artifacts, hashes, or provenance.
  // Governed records citing that key would then validate against an ambiguous
  // source, which defeats exact-source traceability. Reject before the lookup
  // is built rather than letting a Set silently pick one.
  const seenSourceKeys = new Set<string>();
  const duplicateSourceKeys = new Set<string>();
  sourceRecords.forEach((record) => {
    const key = `${record.sourceRecordId}@${record.sourceRecordVersion}`;
    if (seenSourceKeys.has(key)) {
      duplicateSourceKeys.add(key);
      return;
    }
    seenSourceKeys.add(key);
  });
  duplicateSourceKeys.forEach((key) => {
    problems.push(
      `sourceRecords.sourceRecordId (duplicate source key ${key}; one key must identify exactly one artifact)`
    );
  });

  const postCanonSources = sourceRecords.filter(
    isGovernedPostCanonOfficialSourceRecord
  );
  postCanonSources.forEach((record) => {
    const at = `sourceRecords.${record.sourceRecordId}@${record.sourceRecordVersion}`;
    const certification = record.postCanonCertification;
    if (
      certification.certificationRecordVersion !== record.sourceRecordVersion
    ) {
      problems.push(`${at}.postCanonCertification.certificationRecordVersion`);
    }

    if (record.sourceRecordVersion === 1) {
      if (certification.supersedesCertificationRecordVersion !== null) {
        problems.push(
          `${at}.postCanonCertification.supersedesCertificationRecordVersion`
        );
      }
      return;
    }

    const priorVersion = record.sourceRecordVersion - 1;
    const prior = postCanonSources.find(
      (candidate) =>
        candidate.sourceRecordId === record.sourceRecordId &&
        candidate.sourceRecordVersion === priorVersion
    );
    if (
      certification.supersedesCertificationRecordVersion !== priorVersion ||
      !prior ||
      prior.recordStatus !== 'superseded' ||
      prior.postCanonCertification.certificationRecordId !==
        certification.certificationRecordId
    ) {
      problems.push(
        `${at}.postCanonCertification.supersedesCertificationRecordVersion`
      );
    }
  });

  const postCanonCurrentCounts = new Map<string, number>();
  postCanonSources.forEach((record) => {
    if (record.recordStatus !== 'current') return;
    postCanonCurrentCounts.set(
      record.sourceRecordId,
      (postCanonCurrentCounts.get(record.sourceRecordId) ?? 0) + 1
    );
  });
  postCanonCurrentCounts.forEach((count, sourceRecordId) => {
    if (count > 1) {
      problems.push(
        `sourceRecords.sourceRecordId (${sourceRecordId} has multiple current post-Canon versions)`
      );
    }
  });

  const sourceRecordsByKey = new Map(
    sourceRecords.map((record) => [
      `${record.sourceRecordId}@${record.sourceRecordVersion}`,
      record,
    ])
  );
  const sourceStatusByKey = new Map(
    sourceRecords.map((record) => [
      `${record.sourceRecordId}@${record.sourceRecordVersion}`,
      record.recordStatus,
    ])
  );

  const systemLevels = input.systemLevels ?? [];
  const calendars = input.calendars ?? [];

  [...systemLevels, ...calendars].forEach((record) => {
    const sourceKey = `${record.sourceRecordId}@${record.sourceRecordVersion}`;
    if (
      record.recordStatus === 'current' &&
      sourceStatusByKey.get(sourceKey) !== 'current'
    ) {
      problems.push(
        `records.sourceRecordId (${record.recordId}@${record.recordVersion} cannot be current while ${sourceKey} is not current)`
      );
    }
  });

  systemLevels.forEach((record, index) =>
    validateSystemLevelRecord(record, index, sourceRecordsByKey, problems)
  );
  calendars.forEach((record, index) =>
    validateCalendarRecord(record, index, sourceRecordsByKey, problems)
  );

  const recordIds = [
    ...systemLevels.map((r) => `${r.recordId}@${r.recordVersion}`),
    ...calendars.map((r) => `${r.recordId}@${r.recordVersion}`),
  ];
  if (new Set(recordIds).size !== recordIds.length) {
    problems.push('records.recordId (duplicate record id and version)');
  }

  if (problems.length > 0) throw new GovernedSeasonRegistryError(problems);

  const supportedSalaryCapYears = [
    ...new Set([
      ...systemLevels.map((record) => record.salaryCapYear),
      ...calendars.map((record) => record.salaryCapYear),
    ]),
  ].sort((a, b) => a - b);

  const frozenSourceRecords = sourceRecords.map(freezeSourceRecord);
  const frozenPostCanonSourceRecords = frozenSourceRecords.filter(
    isGovernedPostCanonOfficialSourceRecord
  );

  return Object.freeze({
    registryId: input.registryId,
    registryVersion: input.registryVersion,
    canonCandidateCommit: input.canonCandidateCommit,
    canonSha256: input.canonSha256,
    sourceRecords: Object.freeze(frozenSourceRecords),
    postCanonSourceRecords: Object.freeze(frozenPostCanonSourceRecords),
    systemLevels: Object.freeze(systemLevels.map(freezeSystemLevelRecord)),
    calendars: Object.freeze(calendars.map(freezeCalendarRecord)),
    supportedSalaryCapYears: Object.freeze(supportedSalaryCapYears),
  });
}
