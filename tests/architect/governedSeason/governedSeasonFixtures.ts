/**
 * FILE: tests/architect/governedSeason/governedSeasonFixtures.ts
 * PURPOSE: Test-only governed registries for the BZE-270 envelope suites.
 *
 * The Canon-seeded registry deliberately cannot resolve any season complete
 * (its certified levels and its certified calendar land in different Salary Cap
 * Years). These fixtures exercise the resolver's complete and conflicting paths
 * without inventing Canon evidence: every identifier here is prefixed `TEST-`
 * or `SRC2-TEST-` so it can never be mistaken for an accepted Canon record.
 */

import {
  createGovernedSeasonRegistry,
  GOVERNED_SYSTEM_LEVEL_IDS,
  type GovernedAuthority,
  type GovernedSeasonCalendarRecord,
  type GovernedSeasonRegistry,
  type GovernedSourceRecord,
  type GovernedSystemLevelRecord,
} from '@/features/architect/utils/governedSeason';

/** Synthetic Salary Cap Year, i.e. the 2030-31 season. */
export const FIXTURE_SALARY_CAP_YEAR = 2031;
export const FIXTURE_SEASON_KEY = '2030-31';
export const FIXTURE_AS_OF_DATE = '2031-01-15T12:00:00-05:00';
export const FIXTURE_EFFECTIVE_FROM = '2030-07-01T00:00:00-04:00';
export const FIXTURE_EFFECTIVE_UNTIL = '2031-07-01T00:00:00-04:00';

export const FIXTURE_CANON_SHA256 = `${'ab'.repeat(30)}cdef`;

export const FIXTURE_TEAM = {
  teamId: 'TEST-TEAM-001',
  teamCode: 'TST',
  worldId: 'TEST-WORLD-001',
} as const;

export const FIXTURE_LEVEL_AMOUNTS: Record<string, number> = {
  'salary-cap': 190_000_000,
  'minimum-team-salary': 171_000_000,
  'tax-level': 231_000_000,
  'first-apron': 241_000_000,
  'second-apron': 255_000_000,
};

const FIXTURE_SOURCE_RECORDS: readonly GovernedSourceRecord[] = [
  {
    sourceRecordId: 'SRC2-TEST-001',
    sourceRecordVersion: 1,
    provenanceType: 'official-mutable',
    identity: 'Test-only official system-level release for 2030-31',
    sourceDateBasis: 'publication:2030-06-30',
    officialUrl: null,
    artifactSha256: null,
    artifactByteSize: null,
    retrievalTimestamp: '2030-07-01T00:00:00Z',
    authenticationTimestamp: null,
    verifierIdentity: 'agent:test',
    verificationSessionId: 'session:bze-270-fixture',
    verificationDate: '2030-07-01',
    recordLimitations: 'Test fixture; not Canon evidence',
    recordStatus: 'current',
    canonLocator: 'test fixture',
  },
  {
    sourceRecordId: 'SRC2-TEST-002',
    sourceRecordVersion: 1,
    provenanceType: 'official-mutable',
    identity: 'Test-only official 2030-31 regular-season schedule',
    sourceDateBasis: 'publication:2030-08-14',
    officialUrl: null,
    artifactSha256: null,
    artifactByteSize: null,
    retrievalTimestamp: '2030-08-15T00:00:00Z',
    authenticationTimestamp: null,
    verifierIdentity: 'agent:test',
    verificationSessionId: 'session:bze-270-fixture',
    verificationDate: '2030-08-15',
    recordLimitations: 'Test fixture; not Canon evidence',
    recordStatus: 'current',
    canonLocator: 'test fixture',
  },
  {
    sourceRecordId: 'SRC2-TEST-003',
    sourceRecordVersion: 1,
    provenanceType: 'official-mutable',
    identity: 'Test-only revised official system-level release for 2030-31',
    sourceDateBasis: 'publication:2030-09-01',
    officialUrl: null,
    artifactSha256: null,
    artifactByteSize: null,
    retrievalTimestamp: '2030-09-01T00:00:00Z',
    authenticationTimestamp: null,
    verifierIdentity: 'agent:test',
    verificationSessionId: 'session:bze-270-fixture-revision',
    verificationDate: '2030-09-01',
    recordLimitations: 'Test fixture; not Canon evidence',
    recordStatus: 'current',
    canonLocator: 'test fixture',
  },
];

export function fixtureLevelRecord(
  levelId: (typeof GOVERNED_SYSTEM_LEVEL_IDS)[number],
  overrides: Partial<GovernedSystemLevelRecord> = {}
): GovernedSystemLevelRecord {
  return {
    recordId: `TEST-LVL-${levelId}`,
    recordVersion: 1,
    levelId,
    salaryCapYear: FIXTURE_SALARY_CAP_YEAR,
    authority: 'official',
    amount: FIXTURE_LEVEL_AMOUNTS[levelId],
    sourceRecordId: 'SRC2-TEST-001',
    sourceRecordVersion: 1,
    sourceField: `SRC2-TEST-001 test field for ${levelId}`,
    effectiveFrom: FIXTURE_EFFECTIVE_FROM,
    effectiveUntil: FIXTURE_EFFECTIVE_UNTIL,
    canonLeafIds: ['CBA2-S01.3', 'CBA2-S01.4', 'CBA2-S01.9', 'CBA2-S02.5'],
    recordStatus: 'current',
    supersedesRecordVersion: null,
    ...overrides,
  };
}

export function fixtureCalendarRecord(
  overrides: Partial<GovernedSeasonCalendarRecord> = {}
): GovernedSeasonCalendarRecord {
  return {
    recordId: 'TEST-CAL-0001',
    recordVersion: 1,
    salaryCapYear: FIXTURE_SALARY_CAP_YEAR,
    seasonKey: FIXTURE_SEASON_KEY,
    authority: 'official',
    regularSeasonOpening: {
      value: '2030-10-22',
      precision: 'date-only',
      governingTimeZone: 'America/New_York',
    },
    regularSeasonClosing: {
      value: '2031-04-15',
      precision: 'date-only',
      governingTimeZone: 'America/New_York',
    },
    sourceRecordId: 'SRC2-TEST-002',
    sourceRecordVersion: 1,
    sourceField: 'SRC2-TEST-002 test regular-season endpoints',
    publicationDate: '2030-08-14',
    effectiveFrom: FIXTURE_EFFECTIVE_FROM,
    effectiveUntil: FIXTURE_EFFECTIVE_UNTIL,
    canonLeafIds: ['CBA2-L01.2', 'CBA2-L01.8', 'CBA2-L01.9'],
    recordStatus: 'current',
    supersedesRecordVersion: null,
    uncertifiedFields: ['tradeDeadline'],
    ...overrides,
  };
}

export function buildFixtureRegistry(
  options: {
    registryId?: string;
    registryVersion?: number;
    canonSha256?: string;
    systemLevels?: readonly GovernedSystemLevelRecord[];
    calendars?: readonly GovernedSeasonCalendarRecord[];
  } = {}
): GovernedSeasonRegistry {
  return createGovernedSeasonRegistry({
    registryId: options.registryId ?? 'test-governed-season-registry',
    registryVersion: options.registryVersion ?? 1,
    canonCandidateCommit: 'test-fixture-commit',
    canonSha256: options.canonSha256 ?? FIXTURE_CANON_SHA256,
    sourceRecords: FIXTURE_SOURCE_RECORDS,
    systemLevels:
      options.systemLevels ??
      GOVERNED_SYSTEM_LEVEL_IDS.map((levelId) => fixtureLevelRecord(levelId)),
    calendars: options.calendars ?? [fixtureCalendarRecord()],
  });
}

/** A registry where every core level and the calendar resolve for 2030-31. */
export function completeFixtureRegistry(
  authority: GovernedAuthority = 'official'
): GovernedSeasonRegistry {
  return buildFixtureRegistry({
    systemLevels: GOVERNED_SYSTEM_LEVEL_IDS.map((levelId) =>
      fixtureLevelRecord(levelId, { authority })
    ),
    calendars: [fixtureCalendarRecord({ authority })],
  });
}

/** The complete registry after one system level's source has been revised. */
export function revisedFixtureRegistry(
  revisedLevel: (typeof GOVERNED_SYSTEM_LEVEL_IDS)[number],
  revisedAmount: number
): GovernedSeasonRegistry {
  const systemLevels = GOVERNED_SYSTEM_LEVEL_IDS.flatMap((levelId) => {
    if (levelId !== revisedLevel) return [fixtureLevelRecord(levelId)];

    return [
      fixtureLevelRecord(levelId, { recordStatus: 'superseded' }),
      fixtureLevelRecord(levelId, {
        recordVersion: 2,
        amount: revisedAmount,
        sourceRecordId: 'SRC2-TEST-003',
        sourceRecordVersion: 1,
        sourceField: `SRC2-TEST-003 revised field for ${levelId}`,
        recordStatus: 'current',
        supersedesRecordVersion: 1,
      }),
    ];
  });

  return buildFixtureRegistry({ registryVersion: 2, systemLevels });
}
