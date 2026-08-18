import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  type GovernedInputManifest,
  type GovernedInputManifestV1,
  type GovernedPostCanonOfficialSourceRecord,
  type GovernedSeasonCalendarRecord,
} from '@/features/architect/utils/governedSeason';
import {
  completeFixtureRegistry,
  FIXTURE_AS_OF_DATE,
  FIXTURE_SALARY_CAP_YEAR,
  FIXTURE_TEAM,
} from './governedSeasonFixtures';

const ARTIFACT_SHA256 =
  '2470130997194e83e2419cb272cb384473fe3444a8b2e4fd85b30608daf86c3f';
const ARTIFACT_SIZE = 122_319;
const ARTIFACT_PATH =
  'docs/reference/cba/source-artifacts/post-canon/2026-27-nba-regular-season-schedule.2470130997194e83e2419cb272cb384473fe3444a8b2e4fd85b30608daf86c3f.html';
const OLD_UNRETAINED_GATE_SHA256 =
  '0169bb5c78a5ddd0727254dcc991222fbe4e82407b3ba36f60dcc038f002fb18';

const REQUEST_2027 = {
  asOfDate: '2026-10-20T12:00:00-04:00',
  salaryCapYear: 2027,
  requiredAuthority: 'official' as const,
  team: { teamId: 'TEAM-001' },
};

function shippedPostCanonSource(): GovernedPostCanonOfficialSourceRecord {
  const source = CANON_GOVERNED_SEASON_REGISTRY.postCanonSourceRecords.find(
    (record) => record.sourceRecordId === 'POSTCANON-SRC-0001'
  );
  if (!source) throw new Error('Missing shipped post-Canon source fixture');
  return source;
}

function shipped2027Calendar(): GovernedSeasonCalendarRecord {
  const calendar = CANON_GOVERNED_SEASON_REGISTRY.calendars.find(
    (record) => record.salaryCapYear === 2027
  );
  if (!calendar) throw new Error('Missing shipped 2026-27 calendar fixture');
  return calendar;
}

function registryWithPostCanonSource(
  source: GovernedPostCanonOfficialSourceRecord,
  calendars: readonly GovernedSeasonCalendarRecord[] = CANON_GOVERNED_SEASON_REGISTRY.calendars
) {
  return createGovernedSeasonRegistry({
    registryId: CANON_GOVERNED_SEASON_REGISTRY.registryId,
    registryVersion: CANON_GOVERNED_SEASON_REGISTRY.registryVersion,
    canonCandidateCommit: ACCEPTED_CANON_CANDIDATE_COMMIT,
    canonSha256: ACCEPTED_CANON_SHA256,
    sourceRecords: [
      ...CANON_GOVERNED_SEASON_REGISTRY.sourceRecords.filter(
        (record) => record.sourceRecordId !== 'POSTCANON-SRC-0001'
      ),
      source,
    ],
    systemLevels: CANON_GOVERNED_SEASON_REGISTRY.systemLevels,
    calendars,
  });
}

function asLegacyManifest(
  manifest: GovernedInputManifest
): GovernedInputManifestV1 {
  const { sourceAuthorityClass: calendarAuthorityClass, ...calendar } =
    manifest.calendar;
  const systemLevels = manifest.systemLevels.map((input) => {
    const { sourceAuthorityClass, ...legacyInput } = input;
    void sourceAuthorityClass;
    return legacyInput;
  });
  void calendarAuthorityClass;

  return {
    manifestVersion: 1,
    registry: { ...manifest.registry, registryVersion: 1 },
    asOfDate: manifest.asOfDate,
    salaryCapYear: manifest.salaryCapYear,
    requiredAuthority: manifest.requiredAuthority,
    team: manifest.team,
    calendar,
    systemLevels,
  };
}

describe('BZE-280 retained first-party artifact', () => {
  it('retains the exact authorized NBA Communications bytes and relied-upon text', () => {
    const bytes = readFileSync(resolve(process.cwd(), ARTIFACT_PATH));
    const html = bytes.toString('utf8');

    expect(bytes.byteLength).toBe(ARTIFACT_SIZE);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      ARTIFACT_SHA256
    );
    expect(html).toContain(
      'American Express NBA Tip-Off 2026 will begin on Tuesday, Oct. 20'
    );
    expect(html).toContain(
      'The NBA’s 81<sup>st</sup> regular season will conclude on Sunday, April 11, 2027'
    );
    expect(html).toContain(
      'The two unassigned games for each team, to be played from Friday, Dec. 4 through Thursday, Dec. 10'
    );
  });

  it('records the old unretained gate capture only as non-authorizing history', () => {
    const source = shippedPostCanonSource();
    const history = source.postCanonCertification.gateHistory;

    expect(source.sourceRecordVersion).toBe(1);
    expect(history).toEqual([
      expect.objectContaining({
        artifactSha256: OLD_UNRETAINED_GATE_SHA256,
        artifactByteSize: 122_306,
        bytesRetained: false,
        runtimeAuthority: 'none',
        disposition: 'superseded-by-mutable-page-drift',
      }),
    ]);
    expect(
      CANON_GOVERNED_SEASON_REGISTRY.sourceRecords.some(
        (record) => record.artifactSha256 === OLD_UNRETAINED_GATE_SHA256
      )
    ).toBe(false);
  });

  it('deep-freezes the post-Canon certification and its retained field history', () => {
    const source = shippedPostCanonSource();

    expect(Object.isFrozen(source)).toBe(true);
    expect(Object.isFrozen(source.postCanonCertification)).toBe(true);
    expect(Object.isFrozen(source.postCanonCertification.exactFields)).toBe(
      true
    );
    expect(Object.isFrozen(source.postCanonCertification.exactFields[0])).toBe(
      true
    );
    expect(Object.isFrozen(source.postCanonCertification.gateHistory)).toBe(
      true
    );
  });
});

describe('BZE-280 governed Salary Cap Year 2027 activation', () => {
  it('combines the post-Canon calendar with unchanged SRC2-004 levels', () => {
    const envelope = resolveGovernedSeasonEnvelope(REQUEST_2027);

    expect(envelope.status).toBe('complete');
    expect(envelope.calendar.regularSeasonOpening?.value).toBe('2026-10-20');
    expect(envelope.calendar.regularSeasonClosing?.value).toBe('2027-04-11');
    expect(envelope.calendar.uncertifiedFields).toEqual([
      'tradeDeadline',
      'nbaCupGameAssignments',
    ]);
    GOVERNED_SYSTEM_LEVEL_IDS.forEach((levelId) => {
      expect(envelope.systemLevels[levelId].record?.sourceRecordId).toBe(
        'SRC2-004'
      );
      expect(
        envelope.inputManifest?.systemLevels.find(
          (input) => input.levelId === levelId
        )?.sourceAuthorityClass
      ).toBe('accepted-canon');
    });

    expect(envelope.inputManifest).toMatchObject({
      manifestVersion: 2,
      registry: {
        canonCandidateCommit: ACCEPTED_CANON_CANDIDATE_COMMIT,
        canonSha256: ACCEPTED_CANON_SHA256,
      },
      calendar: {
        sourceRecordId: 'POSTCANON-SRC-0001',
        sourceRecordVersion: 1,
        sourceArtifactSha256: ARTIFACT_SHA256,
        sourceAuthorityClass: 'post-canon-official',
      },
      postCanonSources: [
        {
          sourceRecordId: 'POSTCANON-SRC-0001',
          sourceRecordVersion: 1,
          officialUrl:
            'https://pr.nba.com/2026-27-nba-regular-season-schedule/',
          artifactSha256: ARTIFACT_SHA256,
          artifactByteSize: ARTIFACT_SIZE,
          authorityScope: 'time-varying-factual-input-only',
          retainedArtifactPath: ARTIFACT_PATH,
          retainedArtifactSha256: ARTIFACT_SHA256,
          retainedArtifactByteSize: ARTIFACT_SIZE,
        },
      ],
    });
    expect(verifyGovernedInputManifest(envelope.inputManifest!).state).toBe(
      'current'
    );
  });

  it('does not change the prior 2025-26 or 2023-24 behavior', () => {
    const season2026 = resolveGovernedSeasonEnvelope({
      asOfDate: '2025-12-01T12:00:00-05:00',
      salaryCapYear: 2026,
      requiredAuthority: 'official',
      team: { teamId: 'TEAM-001' },
    });
    const season2024 = resolveGovernedSeasonEnvelope({
      asOfDate: '2023-12-01T12:00:00-05:00',
      salaryCapYear: 2024,
      requiredAuthority: 'official',
      team: { teamId: 'TEAM-001' },
    });

    expect(season2026.status).toBe('unavailable');
    expect(season2026.calendar.record?.sourceRecordId).toBe('SRC2-005');
    expect(season2024.status).toBe('unavailable');
    expect(season2024.systemLevels['salary-cap'].amount).toBe(136_021_000);
  });
});

describe('BZE-280 post-Canon authority fail-closed boundary', () => {
  it.each([
    ['weaker provenance', { provenanceType: 'ext-contract' as const }, {}],
    [
      'non-first-party URL',
      { officialUrl: 'https://example.com/2026-27-schedule/' },
      {},
    ],
    [
      'mismatched retained fingerprint',
      {},
      { retainedArtifactSha256: 'aa'.repeat(32) },
    ],
    ['missing exact fields', {}, { exactFields: [] }],
    [
      'insufficient matching first-party retrieves',
      {},
      { matchingFirstPartyRetrievalCount: 1 },
    ],
  ])('rejects %s', (_label, sourceOverrides, certificationOverrides) => {
    const source = shippedPostCanonSource();
    const altered = {
      ...source,
      ...sourceOverrides,
      postCanonCertification: {
        ...source.postCanonCertification,
        ...certificationOverrides,
      },
    } as GovernedPostCanonOfficialSourceRecord;

    expect(() => registryWithPostCanonSource(altered)).toThrow(
      GovernedSeasonRegistryError
    );
  });

  it('rejects a post-Canon source that tries to carry a Canon locator or SRC2 identity', () => {
    const source = shippedPostCanonSource();
    const masquerading = {
      ...source,
      sourceRecordId: 'SRC2-006',
      canonLocator: 'ARCHITECT_CBA_CANON.md §15.12.3',
    } as unknown as GovernedPostCanonOfficialSourceRecord;

    expect(() => registryWithPostCanonSource(masquerading)).toThrow(
      GovernedSeasonRegistryError
    );
  });

  it('cannot invent a usable successor without retaining its superseded source version', () => {
    const source = shippedPostCanonSource();
    const inventedV2: GovernedPostCanonOfficialSourceRecord = {
      ...source,
      sourceRecordVersion: 2,
      postCanonCertification: {
        ...source.postCanonCertification,
        certificationRecordVersion: 2,
        supersedesCertificationRecordVersion: 1,
      },
    };

    expect(() => registryWithPostCanonSource(inventedV2)).toThrow(
      GovernedSeasonRegistryError
    );
  });

  it('rejects missing source authority and altered or wrong-year endpoint fields', () => {
    const source = shippedPostCanonSource();
    const calendar = shipped2027Calendar();

    expect(() =>
      createGovernedSeasonRegistry({
        registryId: CANON_GOVERNED_SEASON_REGISTRY.registryId,
        registryVersion: CANON_GOVERNED_SEASON_REGISTRY.registryVersion,
        canonCandidateCommit: ACCEPTED_CANON_CANDIDATE_COMMIT,
        canonSha256: ACCEPTED_CANON_SHA256,
        sourceRecords: CANON_GOVERNED_SEASON_REGISTRY.sourceRecords.filter(
          (record) => record.sourceRecordId !== source.sourceRecordId
        ),
        systemLevels: CANON_GOVERNED_SEASON_REGISTRY.systemLevels,
        calendars: CANON_GOVERNED_SEASON_REGISTRY.calendars,
      })
    ).toThrow(GovernedSeasonRegistryError);

    expect(() =>
      registryWithPostCanonSource(source, [
        ...CANON_GOVERNED_SEASON_REGISTRY.calendars.filter(
          (record) => record.recordId !== calendar.recordId
        ),
        {
          ...calendar,
          salaryCapYear: 2028,
          seasonKey: '2027-28',
          regularSeasonOpening: {
            ...calendar.regularSeasonOpening,
            value: '2027-10-19',
          },
          regularSeasonClosing: {
            ...calendar.regularSeasonClosing,
            value: '2028-04-09',
          },
          effectiveFrom: '2027-07-01T00:00:00-04:00',
          effectiveUntil: '2028-07-01T00:00:00-04:00',
        },
      ])
    ).toThrow(GovernedSeasonRegistryError);
  });

  it('blocks ambiguous calendars and never falls back to projected authority', () => {
    const calendar = shipped2027Calendar();
    const conflictingRegistry = registryWithPostCanonSource(
      shippedPostCanonSource(),
      [
        ...CANON_GOVERNED_SEASON_REGISTRY.calendars,
        { ...calendar, recordId: 'GOV-CAL-TEST-CONFLICT' },
      ]
    );
    const conflict = resolveGovernedSeasonEnvelope({
      ...REQUEST_2027,
      registry: conflictingRegistry,
    });
    const projected = resolveGovernedSeasonEnvelope({
      ...REQUEST_2027,
      requiredAuthority: 'projected',
    });

    expect(conflict.status).toBe('unavailable');
    expect(conflict.calendar.state).toBe('unresolved-conflict');
    expect(projected.status).toBe('unavailable');
    expect(projected.calendar.state).toBe('unavailable');
    GOVERNED_SYSTEM_LEVEL_IDS.forEach((levelId) => {
      expect(projected.systemLevels[levelId].state).toBe('unavailable');
    });
  });

  it('detects a manifest that hides or weakens its post-Canon lineage', () => {
    const manifest = resolveGovernedSeasonEnvelope(REQUEST_2027).inputManifest!;
    const tampered = {
      ...manifest,
      calendar: {
        ...manifest.calendar,
        sourceAuthorityClass: 'accepted-canon',
      },
      postCanonSources: [],
    } as GovernedInputManifest;

    const verification = verifyGovernedInputManifest(tampered);
    expect(verification.state).toBe('content-mismatch');
    expect(
      verification.driftedInputs.flatMap((entry) => entry.changedFields)
    ).toEqual(expect.arrayContaining(['sourceAuthorityClass']));
  });

  it('keeps legacy Canon-only manifests verifiable but never lets v1 authorize post-Canon evidence', () => {
    const fixtureRegistry = completeFixtureRegistry();
    const canonOnlyManifest = resolveGovernedSeasonEnvelope({
      asOfDate: FIXTURE_AS_OF_DATE,
      salaryCapYear: FIXTURE_SALARY_CAP_YEAR,
      requiredAuthority: 'official',
      team: FIXTURE_TEAM,
      registry: fixtureRegistry,
    }).inputManifest!;
    const legacyCanonOnly = asLegacyManifest(canonOnlyManifest);
    const postCanonLegacy = asLegacyManifest(
      resolveGovernedSeasonEnvelope(REQUEST_2027).inputManifest!
    );

    expect(
      verifyGovernedInputManifest(legacyCanonOnly, fixtureRegistry).state
    ).toBe('current');
    const rejectedPostCanon = verifyGovernedInputManifest(postCanonLegacy);
    expect(rejectedPostCanon.state).toBe('content-mismatch');
    expect(
      rejectedPostCanon.driftedInputs.flatMap((entry) => entry.changedFields)
    ).toContain('manifestVersion');
  });
});

describe('BZE-280 append-only source revision behavior', () => {
  it('keeps an earlier result immutable and reports supersession against a later source version', () => {
    const before = resolveGovernedSeasonEnvelope(REQUEST_2027);
    const originalManifest = before.inputManifest!;
    const retainedBefore = JSON.stringify(originalManifest);
    const sourceV1 = shippedPostCanonSource();
    const calendarV1 = shipped2027Calendar();
    const sourceV2Hash = 'ab'.repeat(32);
    const sourceV2: GovernedPostCanonOfficialSourceRecord = {
      ...sourceV1,
      sourceRecordVersion: 2,
      artifactSha256: sourceV2Hash,
      artifactByteSize: ARTIFACT_SIZE + 1,
      retrievalTimestamp: '2026-08-18T12:00:00Z',
      verificationSessionId: 'session:bze-280-revision-test',
      verificationDate: '2026-08-18',
      postCanonCertification: {
        ...sourceV1.postCanonCertification,
        certificationRecordVersion: 2,
        retainedArtifactPath: `test-only/${sourceV2Hash}.html`,
        retainedArtifactSha256: sourceV2Hash,
        retainedArtifactByteSize: ARTIFACT_SIZE + 1,
        matchingRetrievalDate: '2026-08-18',
        supersedesCertificationRecordVersion: 1,
      },
    };
    const revisedRegistry = createGovernedSeasonRegistry({
      registryId: CANON_GOVERNED_SEASON_REGISTRY.registryId,
      registryVersion: CANON_GOVERNED_SEASON_REGISTRY.registryVersion + 1,
      canonCandidateCommit: ACCEPTED_CANON_CANDIDATE_COMMIT,
      canonSha256: ACCEPTED_CANON_SHA256,
      sourceRecords: [
        ...CANON_GOVERNED_SEASON_REGISTRY.sourceRecords.filter(
          (record) => record.sourceRecordId !== sourceV1.sourceRecordId
        ),
        { ...sourceV1, recordStatus: 'superseded' },
        sourceV2,
      ],
      systemLevels: CANON_GOVERNED_SEASON_REGISTRY.systemLevels,
      calendars: [
        ...CANON_GOVERNED_SEASON_REGISTRY.calendars.filter(
          (record) => record.recordId !== calendarV1.recordId
        ),
        { ...calendarV1, recordStatus: 'superseded' },
        {
          ...calendarV1,
          recordVersion: 2,
          sourceRecordVersion: 2,
          recordStatus: 'current',
          supersedesRecordVersion: 1,
        },
      ],
    });
    const after = resolveGovernedSeasonEnvelope({
      ...REQUEST_2027,
      registry: revisedRegistry,
    });

    expect(after.status).toBe('complete');
    expect(after.inputManifest?.calendar.sourceRecordVersion).toBe(2);
    expect(JSON.stringify(originalManifest)).toBe(retainedBefore);
    expect(
      verifyGovernedInputManifest(originalManifest, revisedRegistry).state
    ).toBe('superseded');
  });
});
