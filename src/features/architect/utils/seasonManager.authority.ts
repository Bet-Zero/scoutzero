/** Governed authority gate for the one atomic league-wide Season Advance. */

import {
  CANON_GOVERNED_SEASON_REGISTRY,
  governedSourceAuthorityClass,
  resolveGovernedSeasonEnvelope,
  salaryCapYearWindow,
  seasonKeyForSalaryCapYear,
  type GovernedInputManifest,
  type GovernedSeasonCalendarRecord,
  type GovernedSeasonRegistry,
  type GovernedSourceRecord,
} from '@/features/architect/utils/governedSeason';
import type { CapProjectionOverrides } from '@/features/architect/utils/capRulesProfile';

export const SEASON_ADVANCE_AUTHORITY_VERSION =
  'governed-season-advance-authority-v2';

export const SEASON_ADVANCE_MISSING_GOVERNED_DRAFT_INPUTS = Object.freeze([
  'governedDraftHistory.ownership',
  'governedDraftHistory.protection',
  'governedDraftHistory.conveyance',
  'governedDraftHistory.freeze',
  'governedDraftHistory.unfreeze',
  'governedDraftHistory.penalty',
  'governedDraftHistory.requiredTransition',
] as const);

const SEASON_ADVANCE_EXCLUDED_DRAFT_VERDICTS = Object.freeze([
  'draft-ownership',
  'stepien',
  'second-apron-freeze',
  'conveyance',
  'swap',
] as const);

const LEGACY_ENTITLEMENT_BOUNDARY_GOVERNING_CANON_LEAF_IDS = Object.freeze([
  'CBA2-L08.1',
  'CBA2-L09.2',
] as const);

const LEGACY_ENTITLEMENT_BOUNDARY_KEYS = Object.freeze([
  'mode',
  'unavailableCanonLeafId',
  'governingCanonLeafIds',
  'excludedVerdicts',
] as const);

const CURRENT_ENTITLEMENT_BOUNDARY_KEYS = Object.freeze([
  'mode',
  'authenticatedCanonLeafIds',
  'governingCanonLeafIds',
  'missingGovernedInputs',
  'excludedVerdicts',
] as const);

export type SeasonAdvanceEntitlementBoundary = {
  mode: 'preserve-or-fail-closed';
  authenticatedCanonLeafIds: readonly ['CBA2-A12.3'];
  governingCanonLeafIds: readonly [
    'CBA2-A12.3',
    'CBA2-L08.1',
    'CBA2-L09.2',
  ];
  missingGovernedInputs: typeof SEASON_ADVANCE_MISSING_GOVERNED_DRAFT_INPUTS;
  excludedVerdicts: typeof SEASON_ADVANCE_EXCLUDED_DRAFT_VERDICTS;
};

const CURRENT_ENTITLEMENT_BOUNDARY: SeasonAdvanceEntitlementBoundary =
  Object.freeze({
    mode: 'preserve-or-fail-closed',
    authenticatedCanonLeafIds: Object.freeze(['CBA2-A12.3'] as const),
    governingCanonLeafIds: Object.freeze([
      'CBA2-A12.3',
      'CBA2-L08.1',
      'CBA2-L09.2',
    ] as const),
    missingGovernedInputs: SEASON_ADVANCE_MISSING_GOVERNED_DRAFT_INPUTS,
    excludedVerdicts: SEASON_ADVANCE_EXCLUDED_DRAFT_VERDICTS,
  });

export type SeasonAdvanceCalendarManifest = {
  recordId: string;
  recordVersion: number;
  salaryCapYear: number;
  seasonKey: string;
  regularSeasonOpening: string;
  regularSeasonClosing: string;
  sourceRecordId: string;
  sourceRecordVersion: number;
  sourceIdentity: string;
  sourceField: string;
  sourceArtifactSha256: string;
  sourceAuthorityClass: 'accepted-canon' | 'post-canon-official';
  canonLeafIds: readonly string[];
};

export type SeasonAdvanceAuthority = {
  authorityVersion: typeof SEASON_ADVANCE_AUTHORITY_VERSION;
  fromSeason: string;
  toSeason: string;
  fromSalaryCapYear: number;
  toSalaryCapYear: number;
  seasonCloseDate: string;
  transitionEffectiveAt: string;
  metadataAsOfDate: string;
  sourceCalendar: SeasonAdvanceCalendarManifest;
  targetInputManifest: GovernedInputManifest;
  targetCapProjections: CapProjectionOverrides;
  entitlementBoundary: SeasonAdvanceEntitlementBoundary;
};

export type SeasonAdvanceAuthorityResult =
  | { status: 'complete'; authority: SeasonAdvanceAuthority }
  | { status: 'unavailable'; reason: string };

export type SeasonAdvanceAuthorityRequest = {
  worldId?: string | null;
  worldSeason?: string | null;
  worldAsOfDate?: string | null;
  registry?: GovernedSeasonRegistry;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[]
): boolean {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) =>
      Object.prototype.hasOwnProperty.call(value, key)
    )
  );
}

function isExactStringArray(
  value: unknown,
  expected: readonly string[]
): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    expected.every(
      (entry, index) =>
        Object.prototype.hasOwnProperty.call(value, index) &&
        value[index] === entry
    )
  );
}

function isLegacyEntitlementBoundary(
  value: Record<string, unknown>
): boolean {
  return (
    hasExactKeys(value, LEGACY_ENTITLEMENT_BOUNDARY_KEYS) &&
    value.mode === 'preserve-or-fail-closed' &&
    value.unavailableCanonLeafId === 'CBA2-A12.3' &&
    isExactStringArray(
      value.governingCanonLeafIds,
      LEGACY_ENTITLEMENT_BOUNDARY_GOVERNING_CANON_LEAF_IDS
    ) &&
    isExactStringArray(
      value.excludedVerdicts,
      SEASON_ADVANCE_EXCLUDED_DRAFT_VERDICTS
    )
  );
}

function isCurrentEntitlementBoundary(
  value: Record<string, unknown>
): boolean {
  return (
    hasExactKeys(value, CURRENT_ENTITLEMENT_BOUNDARY_KEYS) &&
    value.mode === 'preserve-or-fail-closed' &&
    isExactStringArray(value.authenticatedCanonLeafIds, ['CBA2-A12.3']) &&
    isExactStringArray(
      value.governingCanonLeafIds,
      CURRENT_ENTITLEMENT_BOUNDARY.governingCanonLeafIds
    ) &&
    isExactStringArray(
      value.missingGovernedInputs,
      SEASON_ADVANCE_MISSING_GOVERNED_DRAFT_INPUTS
    ) &&
    isExactStringArray(
      value.excludedVerdicts,
      SEASON_ADVANCE_EXCLUDED_DRAFT_VERDICTS
    )
  );
}

/**
 * Return the truthful current interpretation of either a new entitlement
 * boundary or a durable BZE-289 v1 record. The stored record remains untouched,
 * so existing manifest bytes and evidence digests preserve their identity.
 */
export function interpretSeasonAdvanceEntitlementBoundary(
  value: unknown
): SeasonAdvanceEntitlementBoundary | null {
  if (
    isRecord(value) &&
    (isLegacyEntitlementBoundary(value) ||
      isCurrentEntitlementBoundary(value))
  ) {
    return CURRENT_ENTITLEMENT_BOUNDARY;
  }
  return null;
}

function currentOfficialCalendarForSeason(
  registry: GovernedSeasonRegistry,
  seasonKey: string
): GovernedSeasonCalendarRecord[] {
  return registry.calendars.filter(
    (record) =>
      record.seasonKey === seasonKey &&
      record.authority === 'official' &&
      record.recordStatus === 'current'
  );
}

function sourceForCalendar(
  registry: GovernedSeasonRegistry,
  calendar: GovernedSeasonCalendarRecord
): GovernedSourceRecord | null {
  return (
    registry.sourceRecords.find(
      (record) =>
        record.sourceRecordId === calendar.sourceRecordId &&
        record.sourceRecordVersion === calendar.sourceRecordVersion &&
        record.recordStatus === 'current'
    ) ?? null
  );
}

function sourceCalendarManifest(
  calendar: GovernedSeasonCalendarRecord,
  source: GovernedSourceRecord
): SeasonAdvanceCalendarManifest | null {
  if (!source.artifactSha256 || !/^[0-9a-f]{64}$/.test(source.artifactSha256)) {
    return null;
  }
  return Object.freeze({
    recordId: calendar.recordId,
    recordVersion: calendar.recordVersion,
    salaryCapYear: calendar.salaryCapYear,
    seasonKey: calendar.seasonKey,
    regularSeasonOpening: calendar.regularSeasonOpening.value,
    regularSeasonClosing: calendar.regularSeasonClosing.value,
    sourceRecordId: source.sourceRecordId,
    sourceRecordVersion: source.sourceRecordVersion,
    sourceIdentity: source.identity,
    sourceField: calendar.sourceField,
    sourceArtifactSha256: source.artifactSha256,
    sourceAuthorityClass: governedSourceAuthorityClass(source),
    canonLeafIds: Object.freeze([...calendar.canonLeafIds]),
  });
}

/**
 * Resolve both sides of a Season Advance without using runtime time, caller
 * arithmetic, or a projected fallback. Source-season core levels are not
 * required: the close date comes from its independently governed calendar.
 * The target season must resolve the complete official envelope.
 */
export function resolveSeasonAdvanceAuthority(
  request: SeasonAdvanceAuthorityRequest = {}
): SeasonAdvanceAuthorityResult {
  const worldId = request.worldId?.trim();
  const worldSeason = request.worldSeason?.trim();
  const worldAsOfDate = request.worldAsOfDate?.trim();
  if (!worldId || !worldSeason || !worldAsOfDate) {
    return {
      status: 'unavailable',
      reason:
        'Season Advance requires explicit world identity, world season, and world as-of date.',
    };
  }

  const registry = request.registry ?? CANON_GOVERNED_SEASON_REGISTRY;
  const sourceCalendars = currentOfficialCalendarForSeason(
    registry,
    worldSeason
  );
  if (sourceCalendars.length !== 1) {
    return {
      status: 'unavailable',
      reason:
        sourceCalendars.length === 0
          ? `No current official governed calendar exists for world season ${worldSeason}.`
          : `Conflicting current official governed calendars exist for world season ${worldSeason}: ${sourceCalendars
              .map((record) => record.recordId)
              .join(', ')}.`,
    };
  }

  const sourceCalendar = sourceCalendars[0];
  const expectedSourceSeason = seasonKeyForSalaryCapYear(
    sourceCalendar.salaryCapYear
  );
  if (expectedSourceSeason !== worldSeason) {
    return {
      status: 'unavailable',
      reason: `Governed source calendar ${sourceCalendar.recordId} has a wrong-year season identity.`,
    };
  }
  if (worldAsOfDate !== sourceCalendar.regularSeasonClosing.value) {
    return {
      status: 'unavailable',
      reason: `World as-of date ${worldAsOfDate} is stale or conflicting; ${worldSeason} must be parked at its governed Regular Season close ${sourceCalendar.regularSeasonClosing.value}.`,
    };
  }

  const sourceRecord = sourceForCalendar(registry, sourceCalendar);
  const sourceManifest = sourceRecord
    ? sourceCalendarManifest(sourceCalendar, sourceRecord)
    : null;
  if (!sourceRecord || !sourceManifest) {
    return {
      status: 'unavailable',
      reason: `Governed source calendar ${sourceCalendar.recordId} has unavailable or unauthenticated source identity.`,
    };
  }

  const toSalaryCapYear = sourceCalendar.salaryCapYear + 1;
  const targetWindow = salaryCapYearWindow(toSalaryCapYear);
  if (!targetWindow) {
    return {
      status: 'unavailable',
      reason: `No governed Salary Cap Year window exists for ${toSalaryCapYear}.`,
    };
  }
  const targetEnvelope = resolveGovernedSeasonEnvelope({
    asOfDate: targetWindow.from,
    salaryCapYear: toSalaryCapYear,
    requiredAuthority: 'official',
    team: { teamId: `league:${worldId}`, worldId },
    registry,
  });
  if (targetEnvelope.status !== 'complete' || !targetEnvelope.inputManifest) {
    return {
      status: 'unavailable',
      reason: `Target Salary Cap Year ${toSalaryCapYear} is unavailable: ${targetEnvelope.unavailableReasons.join(' ')}`,
    };
  }

  const targetManifest = targetEnvelope.inputManifest;
  const targetSeason = targetManifest.calendar.seasonKey;
  if (
    targetSeason !== seasonKeyForSalaryCapYear(toSalaryCapYear) ||
    targetEnvelope.calendar.regularSeasonOpening === null ||
    targetEnvelope.calendar.regularSeasonClosing === null
  ) {
    return {
      status: 'unavailable',
      reason: `Target Salary Cap Year ${toSalaryCapYear} has malformed or wrong-year governed calendar inputs.`,
    };
  }

  const amounts = Object.fromEntries(
    targetManifest.systemLevels.map((input) => [input.levelId, input.amount])
  );
  const targetCapProjections: CapProjectionOverrides = Object.freeze({
    [targetSeason]: Object.freeze({
      salaryCap: amounts['salary-cap'],
      luxuryTax: amounts['tax-level'],
      firstApron: amounts['first-apron'],
      secondApron: amounts['second-apron'],
    }),
  });

  return {
    status: 'complete',
    authority: Object.freeze({
      authorityVersion: SEASON_ADVANCE_AUTHORITY_VERSION,
      fromSeason: worldSeason,
      toSeason: targetSeason,
      fromSalaryCapYear: sourceCalendar.salaryCapYear,
      toSalaryCapYear,
      seasonCloseDate: sourceCalendar.regularSeasonClosing.value,
      transitionEffectiveAt: targetWindow.from,
      metadataAsOfDate: targetWindow.from.slice(0, 10),
      sourceCalendar: sourceManifest,
      targetInputManifest: targetManifest,
      targetCapProjections,
      entitlementBoundary: CURRENT_ENTITLEMENT_BOUNDARY,
    }),
  };
}
