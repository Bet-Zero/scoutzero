/**
 * FILE: src/features/architect/utils/governedSeason/index.ts
 * PURPOSE: Barrel export for the governed season-input envelope.
 * OWNERSHIP: Feature: architect/governed season inputs
 *
 * HISTORY:
 *  - 2026-08-08: BZE-270 - Created for the governed core season inputs.
 */

export {
  GOVERNING_TIME_ZONE,
  governingCalendarDate,
  governingDayStartInstant,
  isDateOnly,
  isDateOnlyWithinSalaryCapYear,
  isNonEmptyString,
  isSupportedSalaryCapYear,
  isWithinSalaryCapYear,
  isZonedDateTime,
  parseZonedDateTime,
  salaryCapYearWindow,
  seasonKeyForSalaryCapYear,
} from './governedTime';
export type { SalaryCapYearWindow } from './governedTime';

export {
  createGovernedSeasonRegistry,
  governedSourceAuthorityClass,
  isGovernedPostCanonOfficialSourceRecord,
  GOVERNED_AUTHORITIES,
  GOVERNED_SOURCE_PROVENANCE_TYPES,
  GOVERNED_SYSTEM_LEVEL_IDS,
  GovernedSeasonRegistryError,
} from './governedSeasonRecords';
export type {
  GovernedAuthority,
  GovernedCanonSourceRecord,
  GovernedCalendarDate,
  GovernedRecordStatus,
  GovernedPostCanonExactField,
  GovernedPostCanonGateHistoryEntry,
  GovernedPostCanonOfficialCertification,
  GovernedPostCanonOfficialSourceRecord,
  GovernedSeasonCalendarRecord,
  GovernedSeasonRegistry,
  GovernedSeasonRegistryInput,
  GovernedSourceProvenanceType,
  GovernedSourceAuthorityClass,
  GovernedSourceRecord,
  GovernedSystemLevelId,
  GovernedSystemLevelRecord,
} from './governedSeasonRecords';

export {
  ACCEPTED_CANON_CANDIDATE_COMMIT,
  ACCEPTED_CANON_SHA256,
  CANON_GOVERNED_SEASON_REGISTRY,
} from './canonGovernedSeasonRegistry';

export {
  resolveGovernedSeasonEnvelope,
  verifyGovernedInputManifest,
} from './governedSeasonEnvelope';
export type {
  GovernedCalendarResolution,
  GovernedInputManifest,
  GovernedInputManifestV1,
  GovernedManifestCalendar,
  GovernedManifestDrift,
  GovernedManifestDriftKind,
  GovernedManifestInput,
  GovernedManifestPostCanonSource,
  GovernedManifestVerification,
  GovernedManifestVerificationState,
  GovernedReconciliation,
  GovernedReconciliationState,
  GovernedRecordIdentity,
  GovernedRegistryIdentity,
  GovernedRequestEcho,
  GovernedResolutionState,
  GovernedSeasonEnvelope,
  GovernedSeasonEnvelopeRequest,
  GovernedSystemLevelResolution,
  GovernedTeamContext,
  GovernedVerifiableInputManifest,
} from './governedSeasonEnvelope';

export {
  FENCED_LEGACY_MODULE_PATTERNS,
  LEGACY_UNGOVERNED_SEASON_INPUTS,
} from './compatibilityFence';
