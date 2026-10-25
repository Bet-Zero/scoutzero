import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CANON_GOVERNED_SEASON_REGISTRY as registry,
  createGovernedSeasonRegistry,
  resolveGovernedSeasonEnvelope,
  verifyGovernedInputManifest,
  type GovernedPostCanonOfficialSourceRecord,
} from '@/features/architect/utils/governedSeason';
import {
  APPROVED_2025_SYSTEM_LEVEL_FIELDS as fields,
  APPROVED_2025_SYSTEM_LEVEL_SOURCE as pin,
} from '@/features/architect/utils/governedSeason/approved2025SystemLevels';

const source = registry.postCanonSourceRecords.find(
  (row) => row.sourceRecordId === pin.sourceRecordId
)!;
const request = {
  asOfDate: '2026-06-05T12:19:56.526Z',
  salaryCapYear: 2026,
  requiredAuthority: 'official' as const,
  team: { teamId: 'PHI', teamCode: 'PHI', worldId: 'test-world' },
};
function replaceSource(replacement: GovernedPostCanonOfficialSourceRecord) {
  return createGovernedSeasonRegistry({
    ...registry,
    sourceRecords: registry.sourceRecords.map((row) =>
      row === source ? replacement : row
    ),
  });
}

describe('BZE-329 exact retained annual-value exception', () => {
  it('recovers the owner-approved original bytes and the five article fields', () => {
    const bytes = readFileSync(pin.retainedArtifactPath);
    expect(bytes.length).toBe(299783);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      pin.artifactSha256
    );
    const json = bytes
      .toString()
      .match(
        /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s
      )![1];
    const article = JSON.parse(json).props.pageProps.article;
    expect(article.permalink).toBe(pin.officialUrl);
    expect(article.date).toBe('2025-06-30T21:39:20Z');
    expect(article.author.name).toBe('NBA.com Staff');
    for (const field of fields)
      expect(article.contentText).toContain(field.sourceText);
    expect(source.postCanonCertification.exactFields).toEqual(fields);
  });

  it('supplies date-correct money inputs and their retained lineage, not trade permission', () => {
    const result = resolveGovernedSeasonEnvelope(request);
    expect(result.status).toBe('complete');
    expect(
      Object.fromEntries(
        Object.entries(result.systemLevels).map(([id, row]) => [id, row.amount])
      )
    ).toEqual({
      'salary-cap': 154647000,
      'minimum-team-salary': 139182000,
      'tax-level': 187895000,
      'first-apron': 195945000,
      'second-apron': 207824000,
    });
    expect(result.calendar.record?.sourceRecordId).toBe('SRC2-005');
    expect(result.calendar.uncertifiedFields).toContain('tradeDeadline');
    expect(result.inputManifest?.postCanonSources).toHaveLength(1);
    expect(verifyGovernedInputManifest(result.inputManifest!).state).toBe(
      'current'
    );
    const altered = structuredClone(result.inputManifest!);
    altered.postCanonSources[0].artifactSha256 = 'a'.repeat(64);
    expect(verifyGovernedInputManifest(altered).state).not.toBe('current');
  });

  it.each([
    [
      'other URL',
      (s: GovernedPostCanonOfficialSourceRecord) => ({
        ...s,
        officialUrl: `${pin.officialUrl}?other=1`,
      }),
    ],
    [
      'other page',
      (s: GovernedPostCanonOfficialSourceRecord) => ({
        ...s,
        officialUrl: 'https://www.nba.com/news/other',
      }),
    ],
    [
      'other payload',
      (s: GovernedPostCanonOfficialSourceRecord) => ({
        ...s,
        artifactSha256: 'f'.repeat(64),
      }),
    ],
    [
      'other size',
      (s: GovernedPostCanonOfficialSourceRecord) => ({
        ...s,
        artifactByteSize: pin.artifactByteSize + 1,
      }),
    ],
    [
      'other source identity',
      (s: GovernedPostCanonOfficialSourceRecord) => ({
        ...s,
        sourceRecordId: 'POSTCANON-SRC-OTHER',
      }),
    ],
    [
      'other certificate',
      (s: GovernedPostCanonOfficialSourceRecord) => ({
        ...s,
        postCanonCertification: {
          ...s.postCanonCertification,
          certificationRecordId: 'OTHER',
        },
      }),
    ],
    [
      'other retained path',
      (s: GovernedPostCanonOfficialSourceRecord) => ({
        ...s,
        postCanonCertification: {
          ...s.postCanonCertification,
          retainedArtifactPath: 'other.html',
        },
      }),
    ],
    [
      'other value',
      (s: GovernedPostCanonOfficialSourceRecord) => ({
        ...s,
        postCanonCertification: {
          ...s.postCanonCertification,
          exactFields: s.postCanonCertification.exactFields.map((f, i) =>
            i ? f : { ...f, normalizedValue: '1' }
          ),
        },
      }),
    ],
    [
      'extra field',
      (s: GovernedPostCanonOfficialSourceRecord) => ({
        ...s,
        postCanonCertification: {
          ...s.postCanonCertification,
          exactFields: [
            ...s.postCanonCertification.exactFields,
            {
              fieldId: 'tradeDeadline',
              sourceText: 'unknown',
              normalizedValue: '2026-02-05',
            },
          ],
        },
      }),
    ],
    [
      'missing field',
      (s: GovernedPostCanonOfficialSourceRecord) => ({
        ...s,
        postCanonCertification: {
          ...s.postCanonCertification,
          exactFields: s.postCanonCertification.exactFields.slice(1),
        },
      }),
    ],
  ])('rejects %s instead of whitelisting NBA.com', (_label, change) => {
    expect(() => replaceSource(change(source))).toThrow();
  });

  it('cannot reuse the five values for another season', () => {
    expect(() =>
      createGovernedSeasonRegistry({
        ...registry,
        systemLevels: registry.systemLevels.map((r) =>
          r.sourceRecordId === pin.sourceRecordId
            ? {
                ...r,
                salaryCapYear: 2025,
                effectiveFrom: '2024-07-01T00:01:00-04:00',
                effectiveUntil: '2025-07-01T00:00:00-04:00',
              }
            : r
        ),
      })
    ).toThrow();
    const other = resolveGovernedSeasonEnvelope({
      ...request,
      salaryCapYear: 2025,
      asOfDate: '2025-06-05',
    });
    expect(other.status).toBe('unavailable');
  });

  it('does not backdate the announced cap into the preceding minute', () => {
    expect(() =>
      createGovernedSeasonRegistry({
        ...registry,
        systemLevels: registry.systemLevels.map((r) =>
          r.sourceRecordId === pin.sourceRecordId
            ? { ...r, effectiveFrom: '2025-07-01T00:00:00-04:00' }
            : r
        ),
      })
    ).toThrow();
    expect(
      resolveGovernedSeasonEnvelope({
        ...request,
        asOfDate: '2025-07-01T00:00:30-04:00',
      }).systemLevels['salary-cap'].state
    ).toBe('unavailable');
    expect(
      resolveGovernedSeasonEnvelope({
        ...request,
        asOfDate: '2025-07-01T00:01:00-04:00',
      }).status
    ).toBe('complete');
  });
});
