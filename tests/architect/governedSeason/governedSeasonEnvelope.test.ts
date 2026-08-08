import { describe, expect, it } from 'vitest';
import {
  ACCEPTED_CANON_CANDIDATE_COMMIT,
  ACCEPTED_CANON_SHA256,
  CANON_GOVERNED_SEASON_REGISTRY,
  createGovernedSeasonRegistry,
  GOVERNED_SYSTEM_LEVEL_IDS,
  GovernedSeasonRegistryError,
  resolveGovernedSeasonEnvelope,
  verifyGovernedInputManifest,
} from '@/features/architect/utils/governedSeason';
import {
  buildFixtureRegistry,
  completeFixtureRegistry,
  fixtureCalendarRecord,
  fixtureLevelRecord,
  FIXTURE_AS_OF_DATE,
  FIXTURE_CANON_SHA256,
  FIXTURE_LEVEL_AMOUNTS,
  FIXTURE_SALARY_CAP_YEAR,
  FIXTURE_SEASON_KEY,
  FIXTURE_SOURCE_SHA256,
  FIXTURE_TEAM,
  revisedFixtureRegistry,
} from './governedSeasonFixtures';

const COMPLETE_REQUEST = {
  asOfDate: FIXTURE_AS_OF_DATE,
  salaryCapYear: FIXTURE_SALARY_CAP_YEAR,
  requiredAuthority: 'official' as const,
  team: FIXTURE_TEAM,
};

describe('BZE-270 governed season registry seeded from accepted Canon', () => {
  it('pins the accepted Canon candidate and its exact SHA-256', () => {
    expect(ACCEPTED_CANON_CANDIDATE_COMMIT).toBe(
      '6cf8aaf358c158a88e630e8a7336f7e9c3febc17'
    );
    expect(ACCEPTED_CANON_SHA256).toBe(
      '23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76'
    );
    expect(CANON_GOVERNED_SEASON_REGISTRY.canonSha256).toBe(
      ACCEPTED_CANON_SHA256
    );
  });

  it('carries only the source records the accepted Canon certifies', () => {
    expect(
      CANON_GOVERNED_SEASON_REGISTRY.sourceRecords.map((r) => r.sourceRecordId)
    ).toEqual(['SRC2-003', 'SRC2-004', 'SRC2-005']);
    expect(CANON_GOVERNED_SEASON_REGISTRY.supportedSalaryCapYears).toEqual([
      2024, 2026, 2027,
    ]);
  });

  it('transcribes the SRC2-004 core levels exactly', () => {
    const byLevel = new Map(
      CANON_GOVERNED_SEASON_REGISTRY.systemLevels
        .filter((record) => record.salaryCapYear === 2027)
        .map((record) => [record.levelId, record])
    );

    expect(byLevel.get('salary-cap')?.amount).toBe(164_961_000);
    expect(byLevel.get('minimum-team-salary')?.amount).toBe(148_465_000);
    expect(byLevel.get('tax-level')?.amount).toBe(200_428_000);
    expect(byLevel.get('first-apron')?.amount).toBe(209_015_000);
    expect(byLevel.get('second-apron')?.amount).toBe(221_686_000);

    GOVERNED_SYSTEM_LEVEL_IDS.forEach((levelId) => {
      const record = byLevel.get(levelId);
      expect(record?.sourceRecordId).toBe('SRC2-004');
      expect(record?.sourceRecordVersion).toBe(1);
      expect(record?.authority).toBe('official');
    });
  });

  it('transcribes the SRC2-005 calendar and keeps its uncertified fields named', () => {
    const calendar = CANON_GOVERNED_SEASON_REGISTRY.calendars.find(
      (record) => record.salaryCapYear === 2026
    );

    expect(calendar?.regularSeasonOpening).toEqual({
      value: '2025-10-21',
      precision: 'date-only',
      governingTimeZone: 'America/New_York',
    });
    expect(calendar?.regularSeasonClosing.value).toBe('2026-04-12');
    expect(calendar?.uncertifiedFields).toContain('tradeDeadline');
  });
});

describe('BZE-270 honest unavailability on the shipped Canon registry', () => {
  it('resolves all five 2026-27 levels but stays unavailable with no calendar', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      asOfDate: '2026-10-15T12:00:00-04:00',
      salaryCapYear: 2027,
      requiredAuthority: 'official',
      team: { teamId: 'TEAM-001' },
    });

    GOVERNED_SYSTEM_LEVEL_IDS.forEach((levelId) => {
      expect(envelope.systemLevels[levelId].state).toBe('available');
      expect(envelope.systemLevels[levelId].record?.sourceRecordId).toBe(
        'SRC2-004'
      );
    });

    expect(envelope.calendar.state).toBe('unavailable');
    expect(envelope.status).toBe('unavailable');
    expect(envelope.inputManifest).toBeNull();
    expect(envelope.unavailableReasons.join(' ')).toContain(
      'No current official season calendar record exists for Salary Cap Year 2027'
    );
  });

  it('resolves the 2025-26 calendar but stays unavailable with no level records', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      asOfDate: '2025-12-01T12:00:00-05:00',
      salaryCapYear: 2026,
      requiredAuthority: 'official',
      team: { teamId: 'TEAM-001' },
    });

    expect(envelope.calendar.state).toBe('available');
    expect(envelope.calendar.record?.sourceRecordId).toBe('SRC2-005');
    expect(envelope.calendar.seasonKey).toBe('2025-26');

    GOVERNED_SYSTEM_LEVEL_IDS.forEach((levelId) => {
      expect(envelope.systemLevels[levelId].state).toBe('unavailable');
      expect(envelope.systemLevels[levelId].amount).toBeNull();
    });
    expect(envelope.status).toBe('unavailable');
  });

  it('never borrows the 2026-27 levels for the 2025-26 season', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      asOfDate: '2025-12-01T12:00:00-05:00',
      salaryCapYear: 2026,
      requiredAuthority: 'official',
      team: { teamId: 'TEAM-001' },
    });

    expect(envelope.systemLevels['salary-cap'].amount).not.toBe(164_961_000);
    expect(envelope.systemLevels['salary-cap'].amount).toBeNull();
    expect(envelope.systemLevels['salary-cap'].record).toBeNull();
  });

  it('leaves 2023-24 levels other than the Salary Cap unavailable', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      asOfDate: '2023-12-01T12:00:00-05:00',
      salaryCapYear: 2024,
      requiredAuthority: 'official',
      team: { teamId: 'TEAM-001' },
    });

    expect(envelope.systemLevels['salary-cap'].amount).toBe(136_021_000);
    (
      [
        'minimum-team-salary',
        'tax-level',
        'first-apron',
        'second-apron',
      ] as const
    ).forEach((levelId) => {
      expect(envelope.systemLevels[levelId].state).toBe('unavailable');
    });
    expect(envelope.status).toBe('unavailable');
  });
});

describe('BZE-270 missing-input and no-fallback behavior', () => {
  it('requires an explicit date, year, authority, and team', () => {
    const envelope = resolveGovernedSeasonEnvelope();

    expect(envelope.status).toBe('unavailable');
    expect(envelope.requested).toBeNull();
    expect(envelope.missingInputs).toEqual([
      'asOfDate',
      'salaryCapYear',
      'requiredAuthority',
      'team.teamId',
    ]);
    expect(envelope.reconciliation.state).toBe('not-evaluated');
  });

  it('does not substitute the runtime date or current year', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      requiredAuthority: 'official',
      team: { teamId: 'TEAM-001' },
    });

    expect(envelope.missingInputs).toContain('asOfDate');
    expect(envelope.missingInputs).toContain('salaryCapYear');
    expect(envelope.requested).toBeNull();
    expect(envelope.unavailableReasons.join(' ')).toContain(
      'No runtime date, current year, or default authority is substituted'
    );
  });

  it('rejects a date with no time zone', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      asOfDate: '2031-01-15',
      registry: completeFixtureRegistry(),
    });

    expect(envelope.missingInputs).toContain('asOfDate');
  });

  it('rejects an impossible calendar date', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      asOfDate: '2031-02-30T12:00:00-05:00',
      registry: completeFixtureRegistry(),
    });

    expect(envelope.missingInputs).toContain('asOfDate');
  });

  it('rejects a non-integer Salary Cap Year', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      salaryCapYear: 2031.5,
      registry: completeFixtureRegistry(),
    });

    expect(envelope.missingInputs).toContain('salaryCapYear');
  });

  it('requires an explicit authority rather than defaulting to official', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      asOfDate: FIXTURE_AS_OF_DATE,
      salaryCapYear: FIXTURE_SALARY_CAP_YEAR,
      team: FIXTURE_TEAM,
      registry: completeFixtureRegistry(),
    });

    expect(envelope.missingInputs).toEqual(['requiredAuthority']);
    expect(envelope.status).toBe('unavailable');
  });
});

describe('BZE-270 date, Salary Cap Year, and calendar reconciliation', () => {
  it('rejects an as-of date outside the requested Salary Cap Year', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      asOfDate: '2031-08-01T12:00:00-04:00',
      registry: completeFixtureRegistry(),
    });

    expect(envelope.reconciliation.state).toBe('unreconciled');
    expect(envelope.reconciliation.findings.join(' ')).toContain(
      'falls outside Salary Cap Year 2031'
    );
    expect(envelope.status).toBe('unavailable');
    expect(envelope.inputManifest).toBeNull();
  });

  it('treats July 1 as the inclusive opening boundary of the Salary Cap Year', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      asOfDate: '2030-07-01T00:00:00-04:00',
      registry: completeFixtureRegistry(),
    });

    expect(envelope.reconciliation.state).toBe('reconciled');
    expect(envelope.status).toBe('complete');
  });

  it('treats the following July 1 as the exclusive closing boundary', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      asOfDate: '2031-07-01T00:00:00-04:00',
      registry: completeFixtureRegistry(),
    });

    expect(envelope.reconciliation.state).toBe('unreconciled');
    expect(envelope.status).toBe('unavailable');
  });

  it('reports the Salary Cap Year window and expected season key', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      registry: completeFixtureRegistry(),
    });

    expect(envelope.reconciliation.salaryCapYearWindow).toEqual({
      from: '2030-07-01T00:00:00-04:00',
      until: '2031-07-01T00:00:00-04:00',
    });
    expect(envelope.reconciliation.expectedSeasonKey).toBe(FIXTURE_SEASON_KEY);
  });

  it('refuses a calendar keyed to a different season', () => {
    const registry = buildFixtureRegistry({
      calendars: [fixtureCalendarRecord({ seasonKey: '2029-30' })],
    });
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      registry,
    });

    expect(envelope.calendar.state).toBe('unavailable');
    expect(envelope.reconciliation.state).toBe('unreconciled');
    expect(envelope.calendar.unavailableReason).toContain(
      'is keyed to season 2029-30, not 2030-31'
    );
  });

  it('refuses a calendar whose season dates fall outside the Salary Cap Year', () => {
    const registry = buildFixtureRegistry({
      calendars: [
        fixtureCalendarRecord({
          regularSeasonOpening: {
            value: '2031-10-22',
            precision: 'date-only',
            governingTimeZone: 'America/New_York',
          },
          regularSeasonClosing: {
            value: '2032-04-15',
            precision: 'date-only',
            governingTimeZone: 'America/New_York',
          },
        }),
      ],
    });
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      registry,
    });

    expect(envelope.calendar.state).toBe('unavailable');
    expect(envelope.calendar.unavailableReason).toContain(
      'falls outside Salary Cap Year 2031'
    );
  });

  it('keeps calendar dates date-only rather than coercing them to an instant', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      registry: completeFixtureRegistry(),
    });

    expect(envelope.calendar.regularSeasonOpening?.precision).toBe('date-only');
    expect(envelope.calendar.regularSeasonOpening?.value).toBe('2030-10-22');
    expect(envelope.calendar.regularSeasonOpening?.governingTimeZone).toBe(
      'America/New_York'
    );
  });
});

describe('BZE-270 unsupported seasons', () => {
  it('reports an unsupported season without inheriting an adjacent one', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      asOfDate: '2024-12-01T12:00:00-05:00',
      salaryCapYear: 2025,
      requiredAuthority: 'official',
      team: { teamId: 'TEAM-001' },
    });

    expect(envelope.status).toBe('unavailable');
    expect(envelope.reconciliation.state).toBe('reconciled');
    expect(envelope.unavailableReasons.join(' ')).toContain(
      'Salary Cap Year 2025 is not a supported season'
    );
    GOVERNED_SYSTEM_LEVEL_IDS.forEach((levelId) => {
      expect(envelope.systemLevels[levelId].amount).toBeNull();
    });
    expect(envelope.calendar.record).toBeNull();
  });
});

describe('BZE-270 official and projected separation', () => {
  it('will not serve a projected record against an official request', () => {
    const registry = completeFixtureRegistry('projected');
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      requiredAuthority: 'official',
      registry,
    });

    expect(envelope.status).toBe('unavailable');
    expect(envelope.systemLevels['salary-cap'].state).toBe('unavailable');
    expect(envelope.systemLevels['salary-cap'].unavailableReason).toContain(
      'projected and official values may not substitute for each other'
    );
  });

  it('will not serve an official record against a projected request', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      requiredAuthority: 'projected',
      registry: completeFixtureRegistry('official'),
    });

    expect(envelope.status).toBe('unavailable');
    expect(envelope.systemLevels['tax-level'].unavailableReason).toContain(
      'official and projected values may not substitute for each other'
    );
  });

  it('resolves a projected request against projected records and labels it', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      requiredAuthority: 'projected',
      registry: completeFixtureRegistry('projected'),
    });

    expect(envelope.status).toBe('complete');
    expect(envelope.inputManifest?.requiredAuthority).toBe('projected');
    envelope.inputManifest?.systemLevels.forEach((level) => {
      expect(level.authority).toBe('projected');
    });
    expect(envelope.calendar.record?.authority).toBe('projected');
  });
});

describe('BZE-270 unresolved conflicts', () => {
  it('blocks a level with two current records instead of choosing one', () => {
    const registry = buildFixtureRegistry({
      systemLevels: [
        ...GOVERNED_SYSTEM_LEVEL_IDS.map((levelId) =>
          fixtureLevelRecord(levelId)
        ),
        fixtureLevelRecord('tax-level', {
          recordId: 'TEST-LVL-tax-level-alternate',
          amount: 999_000_000,
          sourceRecordId: 'SRC2-TEST-003',
        }),
      ],
    });
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      registry,
    });

    expect(envelope.systemLevels['tax-level'].state).toBe(
      'unresolved-conflict'
    );
    expect(envelope.systemLevels['tax-level'].amount).toBeNull();
    expect(envelope.systemLevels['tax-level'].conflictingRecordIds).toEqual([
      'TEST-LVL-tax-level@v1',
      'TEST-LVL-tax-level-alternate@v1',
    ]);
    expect(envelope.status).toBe('unavailable');
  });

  it('blocks a season with two current calendar records', () => {
    const registry = buildFixtureRegistry({
      calendars: [
        fixtureCalendarRecord(),
        fixtureCalendarRecord({ recordId: 'TEST-CAL-0002' }),
      ],
    });
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      registry,
    });

    expect(envelope.calendar.state).toBe('unresolved-conflict');
    expect(envelope.calendar.conflictingRecordIds).toHaveLength(2);
    expect(envelope.status).toBe('unavailable');
  });

  it('treats a superseded-only record as unavailable, not as a fallback', () => {
    const registry = buildFixtureRegistry({
      systemLevels: GOVERNED_SYSTEM_LEVEL_IDS.map((levelId) =>
        levelId === 'first-apron'
          ? fixtureLevelRecord(levelId, { recordStatus: 'superseded' })
          : fixtureLevelRecord(levelId)
      ),
    });
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      registry,
    });

    expect(envelope.systemLevels['first-apron'].state).toBe('unavailable');
    expect(envelope.systemLevels['first-apron'].unavailableReason).toContain(
      'Only superseded record versions exist'
    );
  });

  it('will not use a record whose effective period misses the instant', () => {
    const registry = buildFixtureRegistry({
      systemLevels: GOVERNED_SYSTEM_LEVEL_IDS.map((levelId) =>
        levelId === 'second-apron'
          ? fixtureLevelRecord(levelId, {
              effectiveFrom: '2031-03-01T00:00:00-05:00',
            })
          : fixtureLevelRecord(levelId)
      ),
    });
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      registry,
    });

    expect(envelope.systemLevels['second-apron'].state).toBe('unavailable');
    expect(envelope.systemLevels['second-apron'].unavailableReason).toContain(
      'does not cover the requested instant'
    );
  });
});

describe('BZE-270 source and version retention', () => {
  it('retains full record identity for every resolved level', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      registry: completeFixtureRegistry(),
    });

    expect(envelope.status).toBe('complete');
    GOVERNED_SYSTEM_LEVEL_IDS.forEach((levelId) => {
      const level = envelope.systemLevels[levelId];
      expect(level.state).toBe('available');
      expect(level.amount).toBe(FIXTURE_LEVEL_AMOUNTS[levelId]);
      expect(level.record).toMatchObject({
        recordId: `TEST-LVL-${levelId}`,
        recordVersion: 1,
        authority: 'official',
        sourceRecordId: 'SRC2-TEST-001',
        sourceRecordVersion: 1,
        effectiveFrom: '2030-07-01T00:00:00-04:00',
        effectiveUntil: '2031-07-01T00:00:00-04:00',
      });
      expect(level.record?.sourceField).toContain(levelId);
      expect(level.record?.canonLeafIds).toContain('CBA2-S02.5');
    });
  });

  it('retains the calendar record identity and the registry identity', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      registry: completeFixtureRegistry(),
    });

    expect(envelope.calendar.record).toMatchObject({
      recordId: 'TEST-CAL-0001',
      recordVersion: 1,
      sourceRecordId: 'SRC2-TEST-002',
      sourceRecordVersion: 1,
    });
    expect(envelope.registry).toMatchObject({
      registryId: 'test-governed-season-registry',
      registryVersion: 1,
      canonSha256: FIXTURE_CANON_SHA256,
    });
  });

  it('names every consumed record and version in the input manifest', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      registry: completeFixtureRegistry(),
    });
    const manifest = envelope.inputManifest;

    expect(manifest?.asOfDate).toBe(FIXTURE_AS_OF_DATE);
    expect(manifest?.salaryCapYear).toBe(FIXTURE_SALARY_CAP_YEAR);
    expect(manifest?.team).toEqual(FIXTURE_TEAM);
    expect(manifest?.calendar).toEqual({
      recordId: 'TEST-CAL-0001',
      recordVersion: 1,
      authority: 'official',
      seasonKey: FIXTURE_SEASON_KEY,
      sourceRecordId: 'SRC2-TEST-002',
      sourceRecordVersion: 1,
      sourceField: 'SRC2-TEST-002 test regular-season endpoints',
      sourceArtifactSha256: FIXTURE_SOURCE_SHA256['SRC2-TEST-002'],
    });
    expect(manifest?.systemLevels.map((level) => level.levelId)).toEqual([
      ...GOVERNED_SYSTEM_LEVEL_IDS,
    ]);
    manifest?.systemLevels.forEach((level) => {
      expect(level.recordVersion).toBe(1);
      expect(level.sourceRecordId).toBe('SRC2-TEST-001');
    });
  });
});

describe('BZE-270 source-revision immutability', () => {
  it('leaves an earlier evaluated result unchanged after a source revision', () => {
    const before = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      registry: completeFixtureRegistry(),
    });
    const originalCap = before.systemLevels['salary-cap'].amount;
    const originalManifest = before.inputManifest;

    const revised = revisedFixtureRegistry('salary-cap', 195_000_000);
    const after = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      registry: revised,
    });

    expect(originalCap).toBe(FIXTURE_LEVEL_AMOUNTS['salary-cap']);
    expect(before.systemLevels['salary-cap'].amount).toBe(originalCap);
    expect(originalManifest?.systemLevels[0]).toMatchObject({
      levelId: 'salary-cap',
      recordVersion: 1,
      amount: FIXTURE_LEVEL_AMOUNTS['salary-cap'],
    });

    expect(after.status).toBe('complete');
    expect(after.systemLevels['salary-cap'].amount).toBe(195_000_000);
    expect(after.systemLevels['salary-cap'].record?.recordVersion).toBe(2);
    expect(after.systemLevels['salary-cap'].record?.sourceRecordId).toBe(
      'SRC2-TEST-003'
    );
  });

  it('reports the earlier manifest as superseded without rewriting it', () => {
    const before = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      registry: completeFixtureRegistry(),
    });
    const manifest = before.inputManifest;
    expect(manifest).not.toBeNull();

    const revised = revisedFixtureRegistry('salary-cap', 195_000_000);
    const verification = verifyGovernedInputManifest(manifest!, revised);

    expect(verification.state).toBe('superseded');
    expect(verification.driftedInputs).toHaveLength(1);
    expect(verification.driftedInputs[0]).toMatchObject({
      inputId: 'salary-cap',
      recordId: 'TEST-LVL-salary-cap',
      recordVersion: 1,
    });
    expect(manifest?.systemLevels[0].amount).toBe(
      FIXTURE_LEVEL_AMOUNTS['salary-cap']
    );
  });

  it('verifies as current against the registry it was computed from', () => {
    const registry = completeFixtureRegistry();
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      registry,
    });

    const verification = verifyGovernedInputManifest(
      envelope.inputManifest!,
      registry
    );
    expect(verification.state).toBe('current');
    expect(verification.driftedInputs).toEqual([]);
  });

  it('reports a registry mismatch rather than silently re-resolving', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      registry: completeFixtureRegistry(),
    });

    const verification = verifyGovernedInputManifest(
      envelope.inputManifest!,
      CANON_GOVERNED_SEASON_REGISTRY
    );
    expect(verification.state).toBe('registry-mismatch');
  });

  it('freezes the resolved envelope so a result cannot be edited after the fact', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      registry: completeFixtureRegistry(),
    });

    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.inputManifest)).toBe(true);
    expect(Object.isFrozen(envelope.systemLevels['salary-cap'])).toBe(true);
  });
});

describe('BZE-270 registry construction is fail-closed', () => {
  it('rejects a record citing a source that is not declared', () => {
    expect(() =>
      buildFixtureRegistry({
        systemLevels: [
          fixtureLevelRecord('salary-cap', {
            sourceRecordId: 'SRC2-NOT-DECLARED',
          }),
        ],
      })
    ).toThrow(GovernedSeasonRegistryError);
  });

  it('rejects an effective period that reaches outside its Salary Cap Year', () => {
    expect(() =>
      buildFixtureRegistry({
        systemLevels: [
          fixtureLevelRecord('salary-cap', {
            effectiveUntil: '2031-08-01T00:00:00-04:00',
          }),
        ],
      })
    ).toThrow(GovernedSeasonRegistryError);
  });

  it('rejects a record with no Canon leaf traceability', () => {
    expect(() =>
      buildFixtureRegistry({
        systemLevels: [fixtureLevelRecord('salary-cap', { canonLeafIds: [] })],
      })
    ).toThrow(GovernedSeasonRegistryError);
  });

  it('rejects a calendar date carrying a time component', () => {
    expect(() =>
      buildFixtureRegistry({
        calendars: [
          fixtureCalendarRecord({
            regularSeasonOpening: {
              value: '2030-10-22T00:00:00-04:00',
              precision: 'date-only',
              governingTimeZone: 'America/New_York',
            },
          }),
        ],
      })
    ).toThrow(GovernedSeasonRegistryError);
  });

  it('rejects a registry that does not pin a canon SHA-256', () => {
    expect(() =>
      createGovernedSeasonRegistry({
        registryId: 'bad',
        registryVersion: 1,
        canonCandidateCommit: 'x',
        canonSha256: 'not-a-hash',
        sourceRecords: [],
      })
    ).toThrow(GovernedSeasonRegistryError);
  });
});
