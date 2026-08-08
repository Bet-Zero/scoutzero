/**
 * FILE: tests/architect/governedSeason/governedSeasonReviewRepairs.test.ts
 * PURPOSE: Regression coverage for the BZE-270 PR #493 review findings.
 *
 * One describe block per corrected review cluster. Each pins the behavior the
 * reviewers proved was missing, so a regression fails here by name rather than
 * quietly restoring the defect.
 */

import { describe, expect, it } from 'vitest';
import {
  CANON_GOVERNED_SEASON_REGISTRY,
  createGovernedSeasonRegistry,
  GOVERNED_SYSTEM_LEVEL_IDS,
  GovernedSeasonRegistryError,
  isSupportedSalaryCapYear,
  isDateOnlyWithinSalaryCapYear,
  resolveGovernedSeasonEnvelope,
  salaryCapYearWindow,
  seasonKeyForSalaryCapYear,
  verifyGovernedInputManifest,
} from '@/features/architect/utils/governedSeason';
import {
  buildFixtureRegistry,
  calendarAlteredFixtureRegistry,
  completeFixtureRegistry,
  contentAlteredFixtureRegistry,
  fixtureCalendarRecord,
  fixtureLevelRecord,
  fixtureRegistryWithoutCalendar,
  fixtureRegistryWithRetainedInputs,
  FIXTURE_AS_OF_DATE,
  FIXTURE_CANON_SHA256,
  FIXTURE_LEVEL_AMOUNTS,
  FIXTURE_SALARY_CAP_YEAR,
  FIXTURE_SOURCE_RECORDS,
  FIXTURE_SOURCE_SHA256,
  FIXTURE_TEAM,
} from './governedSeasonFixtures';

const COMPLETE_REQUEST = {
  asOfDate: FIXTURE_AS_OF_DATE,
  salaryCapYear: FIXTURE_SALARY_CAP_YEAR,
  requiredAuthority: 'official' as const,
  team: FIXTURE_TEAM,
};

describe('BZE-270 repair: registry records are cloned and deeply frozen', () => {
  it('ignores mutation of the caller-retained level objects', () => {
    const { registry, systemLevels } = fixtureRegistryWithRetainedInputs();

    systemLevels[0].amount = 1;
    systemLevels[0].effectiveFrom = '1999-07-01T00:00:00-04:00';
    systemLevels[0].sourceRecordId = 'SRC2-TEST-999';
    systemLevels[0].recordStatus = 'superseded';

    const stored = registry.systemLevels.find(
      (record) => record.recordId === systemLevels[0].recordId
    );
    expect(stored?.amount).toBe(FIXTURE_LEVEL_AMOUNTS[systemLevels[0].levelId]);
    expect(stored?.effectiveFrom).toBe('2030-07-01T00:00:00-04:00');
    expect(stored?.sourceRecordId).toBe('SRC2-TEST-001');
    expect(stored?.recordStatus).toBe('current');
  });

  it('ignores mutation of caller-retained calendar and source objects', () => {
    const { registry, calendars, sourceRecords } =
      fixtureRegistryWithRetainedInputs();

    calendars[0].seasonKey = '1999-00';
    calendars[0].regularSeasonOpening.value = '1999-10-22';
    calendars[0].uncertifiedFields = [];
    sourceRecords[0].artifactSha256 = 'ff'.repeat(32);

    const storedCalendar = registry.calendars[0];
    expect(storedCalendar.seasonKey).toBe('2030-31');
    expect(storedCalendar.regularSeasonOpening.value).toBe('2030-10-22');
    expect(storedCalendar.uncertifiedFields).toContain('tradeDeadline');
    expect(registry.sourceRecords[0].artifactSha256).toBe(
      FIXTURE_SOURCE_SHA256['SRC2-TEST-001']
    );
  });

  it('keeps a later envelope, amount, and manifest unchanged after mutation', () => {
    const { registry, systemLevels, calendars } =
      fixtureRegistryWithRetainedInputs();

    systemLevels[0].amount = 1;
    calendars[0].seasonKey = '1999-00';

    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      registry,
    });

    expect(envelope.status).toBe('complete');
    expect(envelope.systemLevels['salary-cap'].amount).toBe(
      FIXTURE_LEVEL_AMOUNTS['salary-cap']
    );
    expect(envelope.calendar.seasonKey).toBe('2030-31');
    expect(envelope.inputManifest?.systemLevels[0].amount).toBe(
      FIXTURE_LEVEL_AMOUNTS['salary-cap']
    );
    expect(envelope.registry.registryVersion).toBe(1);
    expect(envelope.registry.canonSha256).toBe(FIXTURE_CANON_SHA256);
  });

  it('freezes every record and nested object, not only the arrays', () => {
    const { registry } = fixtureRegistryWithRetainedInputs();

    expect(Object.isFrozen(registry.systemLevels)).toBe(true);
    expect(Object.isFrozen(registry.systemLevels[0])).toBe(true);
    expect(Object.isFrozen(registry.systemLevels[0].canonLeafIds)).toBe(true);
    expect(Object.isFrozen(registry.calendars[0])).toBe(true);
    expect(Object.isFrozen(registry.calendars[0].regularSeasonOpening)).toBe(
      true
    );
    expect(Object.isFrozen(registry.calendars[0].uncertifiedFields)).toBe(true);
    expect(Object.isFrozen(registry.sourceRecords[0])).toBe(true);
  });

  it('protects the shipped Canon registry singleton the same way', () => {
    expect(
      Object.isFrozen(CANON_GOVERNED_SEASON_REGISTRY.systemLevels[0])
    ).toBe(true);
    expect(Object.isFrozen(CANON_GOVERNED_SEASON_REGISTRY.calendars[0])).toBe(
      true
    );
    expect(
      Object.isFrozen(
        CANON_GOVERNED_SEASON_REGISTRY.calendars[0].regularSeasonOpening
      )
    ).toBe(true);
  });
});

describe('BZE-270 repair: duplicate source-record versions are rejected', () => {
  it('rejects two source records sharing one id and version', () => {
    const duplicate = {
      ...FIXTURE_SOURCE_RECORDS[0],
      identity: 'A different artifact reusing the same source key',
      artifactSha256: 'ee'.repeat(32),
    };

    expect(() =>
      createGovernedSeasonRegistry({
        registryId: 'dup-source',
        registryVersion: 1,
        canonCandidateCommit: 'test-fixture-commit',
        canonSha256: FIXTURE_CANON_SHA256,
        sourceRecords: [...FIXTURE_SOURCE_RECORDS, duplicate],
        systemLevels: [fixtureLevelRecord('salary-cap')],
      })
    ).toThrow(GovernedSeasonRegistryError);
  });

  it('names the duplicated source key in the rejection', () => {
    let problems: readonly string[] = [];
    try {
      createGovernedSeasonRegistry({
        registryId: 'dup-source',
        registryVersion: 1,
        canonCandidateCommit: 'test-fixture-commit',
        canonSha256: FIXTURE_CANON_SHA256,
        sourceRecords: [FIXTURE_SOURCE_RECORDS[0], FIXTURE_SOURCE_RECORDS[0]],
      });
    } catch (error) {
      problems = (error as GovernedSeasonRegistryError).problems;
    }

    expect(problems.join(' ')).toContain('SRC2-TEST-001@1');
  });

  it('still accepts the same source id at two different versions', () => {
    const nextVersion = {
      ...FIXTURE_SOURCE_RECORDS[0],
      sourceRecordVersion: 2,
      recordStatus: 'current' as const,
    };

    expect(() =>
      createGovernedSeasonRegistry({
        registryId: 'two-versions',
        registryVersion: 1,
        canonCandidateCommit: 'test-fixture-commit',
        canonSha256: FIXTURE_CANON_SHA256,
        sourceRecords: [...FIXTURE_SOURCE_RECORDS, nextVersion],
        systemLevels: [fixtureLevelRecord('salary-cap')],
      })
    ).not.toThrow();
  });
});

describe('BZE-270 repair: manifest verification compares retained content', () => {
  const manifestFor = (registry = completeFixtureRegistry()) => {
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      registry,
    });
    expect(envelope.inputManifest).not.toBeNull();
    return envelope.inputManifest!;
  };

  it('retains source field and artifact identity for every input', () => {
    const manifest = manifestFor();

    manifest.systemLevels.forEach((level) => {
      expect(level.sourceField).toContain('SRC2-TEST-001');
      expect(level.sourceArtifactSha256).toBe(
        FIXTURE_SOURCE_SHA256['SRC2-TEST-001']
      );
    });
    expect(manifest.calendar.sourceArtifactSha256).toBe(
      FIXTURE_SOURCE_SHA256['SRC2-TEST-002']
    );
  });

  it('refuses to certify a changed amount behind a reused version', () => {
    const manifest = manifestFor();
    const verification = verifyGovernedInputManifest(
      manifest,
      contentAlteredFixtureRegistry('salary-cap', { amount: 1 })
    );

    expect(verification.state).toBe('content-mismatch');
    expect(verification.driftedInputs[0]).toMatchObject({
      inputId: 'salary-cap',
      recordVersion: 1,
      kind: 'content-changed',
    });
    expect(verification.driftedInputs[0].changedFields).toContain('amount');
    expect(manifest.systemLevels[0].amount).toBe(
      FIXTURE_LEVEL_AMOUNTS['salary-cap']
    );
  });

  it('refuses to certify a changed authority behind a reused version', () => {
    const verification = verifyGovernedInputManifest(
      manifestFor(),
      contentAlteredFixtureRegistry('tax-level', { authority: 'projected' })
    );

    expect(verification.state).toBe('content-mismatch');
    expect(
      verification.driftedInputs.find((d) => d.inputId === 'tax-level')
        ?.changedFields
    ).toContain('authority');
  });

  it('refuses to certify a changed source identity behind a reused version', () => {
    const verification = verifyGovernedInputManifest(
      manifestFor(),
      contentAlteredFixtureRegistry('first-apron', {
        sourceRecordId: 'SRC2-TEST-003',
        sourceField: 'SRC2-TEST-003 substituted field',
      })
    );

    const drift = verification.driftedInputs.find(
      (entry) => entry.inputId === 'first-apron'
    );
    expect(verification.state).toBe('content-mismatch');
    expect(drift?.changedFields).toEqual(
      expect.arrayContaining([
        'sourceRecordId',
        'sourceField',
        'sourceArtifactSha256',
      ])
    );
  });

  it('refuses to certify a changed level id behind a reused record id', () => {
    const swapped = buildFixtureRegistry({
      systemLevels: GOVERNED_SYSTEM_LEVEL_IDS.map((id) =>
        id === 'second-apron'
          ? fixtureLevelRecord('second-apron')
          : fixtureLevelRecord(id)
      ).map((record) =>
        record.recordId === 'TEST-LVL-second-apron'
          ? { ...record, levelId: 'tax-level' as const }
          : record
      ),
    });
    const verification = verifyGovernedInputManifest(manifestFor(), swapped);

    expect(verification.state).toBe('content-mismatch');
    expect(
      verification.driftedInputs.some((d) =>
        d.changedFields.includes('levelId')
      )
    ).toBe(true);
  });

  it('refuses to certify a changed calendar season behind a reused version', () => {
    const verification = verifyGovernedInputManifest(
      manifestFor(),
      calendarAlteredFixtureRegistry({ seasonKey: '2029-30' })
    );

    expect(verification.state).toBe('content-mismatch');
    expect(
      verification.driftedInputs.find((d) => d.inputId === 'calendar')
        ?.changedFields
    ).toContain('seasonKey');
  });

  it('reports a calendar record absent from the registry as absent, not superseded', () => {
    const verification = verifyGovernedInputManifest(
      manifestFor(),
      fixtureRegistryWithoutCalendar()
    );

    const drift = verification.driftedInputs.find(
      (entry) => entry.inputId === 'calendar'
    );
    expect(drift?.kind).toBe('record-absent');
    expect(drift?.reason).toContain('is not in the registry');
    expect(verification.state).toBe('superseded');
  });

  it('reports a system-level record absent from the registry as absent', () => {
    const withoutApron = buildFixtureRegistry({
      systemLevels: GOVERNED_SYSTEM_LEVEL_IDS.filter(
        (id) => id !== 'second-apron'
      ).map((id) => fixtureLevelRecord(id)),
    });
    const verification = verifyGovernedInputManifest(
      manifestFor(),
      withoutApron
    );

    const drift = verification.driftedInputs.find(
      (entry) => entry.inputId === 'second-apron'
    );
    expect(drift?.kind).toBe('record-absent');
    expect(verification.state).toBe('superseded');
  });

  it('still verifies an untouched registry as current', () => {
    const registry = completeFixtureRegistry();
    const verification = verifyGovernedInputManifest(
      manifestFor(registry),
      registry
    );

    expect(verification.state).toBe('current');
    expect(verification.driftedInputs).toEqual([]);
  });
});

describe('BZE-270 repair: Salary Cap Year validation is fail-closed', () => {
  it('rejects years that cannot form valid ISO boundaries', () => {
    [0, -1, 1, 1000, 10_000, 99_999, 2031.5, Number.NaN].forEach((year) => {
      expect(isSupportedSalaryCapYear(year), `year ${year}`).toBe(false);
      expect(salaryCapYearWindow(year as number)).toBeNull();
      expect(seasonKeyForSalaryCapYear(year as number)).toBeNull();
    });
  });

  it('accepts the representable range', () => {
    [1001, 2026, 2031, 9999].forEach((year) => {
      expect(isSupportedSalaryCapYear(year), `year ${year}`).toBe(true);
      expect(salaryCapYearWindow(year)).not.toBeNull();
    });
  });

  it('refuses a date-only comparison against an unrepresentable year', () => {
    expect(isDateOnlyWithinSalaryCapYear('2030-10-22', 0)).toBe(false);
    expect(isDateOnlyWithinSalaryCapYear('2030-10-22', 2031)).toBe(true);
  });

  it('returns an unavailable envelope instead of throwing on a bad year', () => {
    const envelope = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      asOfDate: '2031-01-15T12:00:00-05:00',
      salaryCapYear: 0,
      registry: completeFixtureRegistry(),
    });

    expect(envelope.status).toBe('unavailable');
    expect(envelope.reconciliation.state).toBe('not-evaluated');
    expect(envelope.reconciliation.salaryCapYearWindow).toBeNull();
    expect(envelope.missingInputs).toContain('salaryCapYear');
    expect(envelope.inputManifest).toBeNull();
  });

  it('rejects a record keyed to an unrepresentable Salary Cap Year', () => {
    expect(() =>
      buildFixtureRegistry({
        systemLevels: [
          fixtureLevelRecord('salary-cap', {
            salaryCapYear: 0,
            effectiveFrom: '2030-07-01T00:00:00-04:00',
            effectiveUntil: null,
          }),
        ],
      })
    ).toThrow(GovernedSeasonRegistryError);
  });

  it('keeps the July 1 reconciliation boundaries unchanged', () => {
    const opening = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      asOfDate: '2030-07-01T00:00:00-04:00',
      registry: completeFixtureRegistry(),
    });
    const closing = resolveGovernedSeasonEnvelope({
      ...COMPLETE_REQUEST,
      asOfDate: '2031-07-01T00:00:00-04:00',
      registry: completeFixtureRegistry(),
    });

    expect(opening.status).toBe('complete');
    expect(closing.status).toBe('unavailable');
    expect(closing.reconciliation.state).toBe('unreconciled');
  });
});

describe('BZE-270 repair: effective period is bounded at both ends', () => {
  it('rejects an open-ended record starting after the year boundary', () => {
    expect(() =>
      buildFixtureRegistry({
        systemLevels: [
          fixtureLevelRecord('salary-cap', {
            effectiveFrom: '2031-08-01T00:00:00-04:00',
            effectiveUntil: null,
          }),
        ],
      })
    ).toThrow(GovernedSeasonRegistryError);
  });

  it('rejects a record starting exactly at the exclusive upper boundary', () => {
    expect(() =>
      buildFixtureRegistry({
        systemLevels: [
          fixtureLevelRecord('salary-cap', {
            effectiveFrom: '2031-07-01T00:00:00-04:00',
            effectiveUntil: null,
          }),
        ],
      })
    ).toThrow(GovernedSeasonRegistryError);
  });

  it('accepts an open-ended record inside the year', () => {
    expect(() =>
      buildFixtureRegistry({
        systemLevels: [
          fixtureLevelRecord('salary-cap', {
            effectiveFrom: '2031-06-30T00:00:00-04:00',
            effectiveUntil: null,
          }),
        ],
      })
    ).not.toThrow();
  });

  it('still rejects a start before the lower boundary', () => {
    expect(() =>
      buildFixtureRegistry({
        systemLevels: [
          fixtureLevelRecord('salary-cap', {
            effectiveFrom: '2030-06-30T00:00:00-04:00',
          }),
        ],
      })
    ).toThrow(GovernedSeasonRegistryError);
  });

  it('still rejects an end past the upper boundary', () => {
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

  it('applies the same bounds to a calendar record', () => {
    expect(() =>
      buildFixtureRegistry({
        calendars: [
          fixtureCalendarRecord({
            effectiveFrom: '2031-07-01T00:00:00-04:00',
            effectiveUntil: null,
          }),
        ],
      })
    ).toThrow(GovernedSeasonRegistryError);
  });
});
