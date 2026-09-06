import { describe, expect, it } from 'vitest';
import {
  compareOfficialHtml,
  sha256,
} from '../../scripts/source-releases/official-nba-html/compare';
import { qualifyRetainedPair } from '../../scripts/source-releases/official-nba-html/qualify';
import {
  assertPreservedLineage,
  type verifyRetainedV2,
} from '../../scripts/source-releases/official-nba-html/retained';
import { verifyAuthorAssessment } from '../../scripts/source-releases/official-nba-html/assessment';

// Synthetic documents only: invented identifiers, timing values and factual data.
const monitoring = (queue = '2', app = '100') =>
  '<script type="text/javascript">window.NREUM||(NREUM={});NREUM.info=' +
  '{"beacon":"bam.nr-data.net","licenseKey":"0000000000","applicationID":"123",' +
  '"transactionName":"YWJj","queueTime":' +
  queue +
  ',"applicationTime":' +
  app +
  ',"atts":"ZGVm","errorBeacon":"bam.nr-data.net","agent":""}</script>';
const data =
  '<article><time datetime="2026-04-01">April 1</time>' +
  '<a href="/evidence">Source</a><table><tr><td>40–42</td></tr></table>' +
  '<p>Author: Synthetic Staff</p><small>Conditional allocation</small></article>' +
  '<script type="application/json">{"originalPick":"SYN_2026_1st","rank":9}</script>';
const html = (tail = '', head = '') =>
  Buffer.from(
    `<!doctype html><html><head>${head}</head><body>${data}${tail}</body></html>`
  );
const loader =
  '<script >bazadebezolkohpepadr="1234567890"</script>' +
  '<script type="text/javascript" src="https://www.nba.com/akam/13/00000000"  defer></script>';
const payload = Buffer.from('t=' + '0'.repeat(40) + '&js=off').toString(
  'base64'
);
const pixel =
  `<noscript><img src="https://www.nba.com/akam/13/pixel_00000000?a=${payload}" ` +
  'style="visibility: hidden; position: absolute; left: -999px; top: -999px;" /></noscript>';
const compare = (a: Buffer, b: Buffer) =>
  compareOfficialHtml(a, b, 'monitoring-timing');
function capture(
  bytes: Buffer,
  n: number,
  overrides: Record<string, unknown> = {}
) {
  return {
    bytes,
    receiptBytes: Buffer.from(
      JSON.stringify({
        targetId: '2026-notes',
        requestedUrl: 'https://pr.nba.com/2026-nba-draft-notes/',
        finalUrl: 'https://pr.nba.com/2026-nba-draft-notes/',
        sha256: sha256(bytes),
        byteSize: bytes.length,
        publisher: 'NBA Communications',
        httpStatus: 200,
        contentType: 'text/html; charset=utf-8',
        startedAt: `2026-09-05T12:00:0${n}.000Z`,
        completedAt: `2026-09-05T12:00:0${n}.100Z`,
        method: 'Synthetic response-body fixture',
        ...overrides,
      })
    ),
  };
}

describe('exact byte accounting', () => {
  it('retains distinct originals and covers every byte with exact intervals', () => {
    const a = html(monitoring());
    const b = html(monitoring('33', '999'));
    const proof = compare(a, b);
    expect(proof.rawByteIdentical).toBe(false);
    expect(proof.originals[0].sha256).not.toBe(proof.originals[1].sha256);
    expect(proof.differences).toHaveLength(2);
    for (const side of ['left', 'right'] as const) {
      const bytes = side === 'left' ? a : b;
      const spans = [
        ...proof.equalIntervals.map((x) => x[side]),
        ...proof.differences.map((x) => [x[side].start, x[side].end]),
      ].sort((x, y) => x[0] - y[0]);
      let end = 0;
      for (const [start, stop] of spans) {
        expect(start).toBe(end);
        end = stop;
      }
      expect(end).toBe(bytes.length);
    }
    expect(
      proof.differences.map((d) =>
        a.subarray(d.left.start, d.left.end).toString()
      )
    ).toEqual(['2', '100']);
    expect(proof.requirementSatisfaction).toBe(false);
    expect(proof.runtimeAuthority).toBe(false);
    expect(compare(b, a).differences.map((d) => d.right.start)).toEqual(
      proof.differences.map((d) => d.left.start)
    );
  });

  it('does not exclude the unchanged timing field or require particular real values', () => {
    expect(
      compare(html(monitoring()), html(monitoring('2', '7'))).differences
    ).toHaveLength(1);
    expect(
      compare(html(monitoring('100', '9999')), html(monitoring('6', '5')))
        .differences
    ).toHaveLength(2);
    expect(compare(html(), html()).byteRule).toBe('whole-response-equality');
  });

  it.each([
    ['embedded JSON', '"rank":9', '"rank":8'],
    ['date', '2026-04-01', '2026-04-02'],
    ['link', 'href="/evidence"', 'href="/different"'],
    ['table', '40–42', '41–41'],
    ['attribution', 'Synthetic Staff', 'Secondary Reporter'],
    ['footnote', 'Conditional allocation', 'Unconditional allocation'],
    [
      'configuration outside timing',
      '"applicationID":"123"',
      '"applicationID":"124"',
    ],
  ])(
    'rejects a changed %s even alongside valid timing differences',
    (_name, oldValue, newValue) => {
      const b = html(monitoring('3', '101'))
        .toString()
        .replace(oldValue, newValue);
      expect(() => compare(html(monitoring()), Buffer.from(b))).toThrow();
    }
  );

  it.each(['"2"', '-2', '2.5', '2e3', 'null', '[]', '2,"rank":1'])(
    'rejects non-grammar timing %s',
    (value) => {
      expect(() =>
        compare(html(monitoring()), html(monitoring(value)))
      ).toThrow();
    }
  );

  it('rejects executable suffixes, nested and duplicate configurations', () => {
    expect(() =>
      compare(
        html(monitoring()),
        html(monitoring('3').replace('</script>', ';window.rank=1;</script>'))
      )
    ).toThrow();
    expect(() =>
      compare(
        html(`<article>${monitoring()}</article>`),
        html(`<article>${monitoring('3')}</article>`)
      )
    ).toThrow();
    expect(() =>
      compare(
        html(monitoring() + monitoring()),
        html(monitoring('3') + monitoring())
      )
    ).toThrow();
    expect(() =>
      compare(html(`<!--${monitoring()}-->`), html(`<!--${monitoring('3')}-->`))
    ).toThrow();
    expect(() =>
      compare(
        html(`<template>${monitoring()}</template>`),
        html(`<template>${monitoring('3')}</template>`)
      )
    ).toThrow();
  });

  it('fails on invalid UTF-8 instead of replacing or normalizing bytes', () => {
    const a = Buffer.concat([html(monitoring()), Buffer.from([0xff])]);
    expect(() => compare(a, a)).toThrow();
  });
});

describe('bounded security presence', () => {
  it('accounts for only the paired loader/pixel, in either direction', () => {
    const a = html(pixel, loader);
    const b = html();
    const proof = compareOfficialHtml(a, b, 'security-presence');
    expect(proof.differences).toHaveLength(2);
    expect(
      proof.differences.map((d) =>
        a.subarray(d.left.start, d.left.end).toString()
      )
    ).toEqual([loader, pixel]);
    expect(
      proof.differences.reduce((sum, d) => sum + d.left.end - d.left.start, 0)
    ).toBe(Buffer.byteLength(loader + pixel));
    expect(
      compareOfficialHtml(b, a, 'security-presence')
        .protectedIntervalsByteIdentical
    ).toBe(true);
  });

  it.each([
    [
      'extra executable statement',
      pixel,
      loader.replace('</script>', ';window.rank=1;</script>'),
    ],
    [
      'extra pixel field',
      pixel.replace(
        payload,
        Buffer.from('t=' + '0'.repeat(40) + '&js=off&rank=1').toString('base64')
      ),
      loader,
    ],
    [
      'extra image attribute',
      pixel.replace('style=', 'data-rank="1" style='),
      loader,
    ],
    [
      'mismatched asset',
      pixel.replace('pixel_00000000', 'pixel_11111111'),
      loader,
    ],
    [
      'different host',
      pixel,
      loader.replace('www.nba.com', 'nba.com.example.test'),
    ],
    [
      'nested facts',
      pixel.replace(
        '</noscript>',
        '<table><tr><td>1</td></tr></table></noscript>'
      ),
      loader,
    ],
    ['duplicate loader', pixel, loader + loader],
    ['duplicate pixel', pixel + pixel, loader],
    ['missing pixel', '', loader],
    ['missing loader', pixel, ''],
  ])('rejects %s', (_name, tail, head) => {
    expect(() =>
      compareOfficialHtml(html(tail, head), html(), 'security-presence')
    ).toThrow();
  });

  it('does not ignore changed security values present in both originals', () => {
    expect(() =>
      compareOfficialHtml(
        html(pixel, loader),
        html(pixel, loader.replace('1234567890', '1234567891')),
        'security-presence'
      )
    ).toThrow();
  });

  it('protects surrounding facts, original head/body placement and all other source policies', () => {
    expect(() =>
      compareOfficialHtml(
        html(pixel, loader),
        Buffer.from(html().toString().replace('"rank":9', '"rank":8')),
        'security-presence'
      )
    ).toThrow();
    expect(() =>
      compareOfficialHtml(html(loader + pixel), html(), 'security-presence')
    ).toThrow();
    expect(() =>
      compareOfficialHtml(html(pixel, loader), html(), 'exact-only')
    ).toThrow();
  });
});

describe('provenance and authority are independent gates', () => {
  it('requires complete distinct captures and never automatically accepts a fact', () => {
    const result = qualifyRetainedPair('2026-notes', [
      capture(html(monitoring()), 1),
      capture(html(monitoring('3')), 2),
    ]);
    expect(result.eligibleAfterIndependentRecovery).toBe(true);
    expect(result.completeRequirementsAutomaticallySatisfied).toBe(0);
    expect(result.supportedFactsAutomaticallyAdded).toBe(0);
  });

  it.each([
    { startedAt: undefined },
    { completedAt: undefined },
    { publisher: undefined },
    { httpStatus: null },
    { httpStatus: 403 },
    { contentType: 'application/json' },
    { metadataRecoveryLimitation: true },
    { completedAt: '2020-01-01T00:00:00Z' },
  ])('does not waive missing or invalid provenance: %j', (overrides) => {
    expect(
      qualifyRetainedPair('2026-notes', [
        capture(html(), 1, overrides),
        capture(html(), 2),
      ]).eligibleAfterIndependentRecovery
    ).toBe(false);
  });

  it('rejects wrong-source pairing, unknown sources, tampering and duplicated events', () => {
    expect(() =>
      qualifyRetainedPair('2026-notes', [
        capture(html(), 1, { targetId: '2025-notes' }),
        capture(html(), 2),
      ])
    ).toThrow();
    expect(() =>
      qualifyRetainedPair('2026-notes', [
        capture(html(), 1, { finalUrl: 'https://example.test/' }),
        capture(html(), 2),
      ])
    ).toThrow();
    expect(() =>
      qualifyRetainedPair('pst', [capture(html(), 1), capture(html(), 2)])
    ).toThrow();
    const a = capture(html(), 1);
    a.bytes = html('tampered');
    expect(() =>
      qualifyRetainedPair('2026-notes', [a, capture(html(), 2)])
    ).toThrow();
    expect(
      qualifyRetainedPair('2026-notes', [
        capture(html(), 1),
        capture(html(), 1),
      ]).eligibleAfterIndependentRecovery
    ).toBe(false);
  });

  it('cannot promote secondary AP reporting even with identical bytes and metadata', () => {
    const overrides = {
      targetId: '2026-lottery-story',
      requestedUrl: 'https://www.nba.com/news/2026-nba-draft-lottery-result',
      finalUrl: 'https://www.nba.com/news/2026-nba-draft-lottery-result',
    };
    const result = qualifyRetainedPair('2026-lottery-story', [
      capture(html(), 1, overrides),
      capture(html(), 2, overrides),
    ]);
    expect(result.byteProof?.rawByteIdentical).toBe(true);
    expect(result.eligibleAfterIndependentRecovery).toBe(false);
  });
});

describe('lineage and author-claim boundaries', () => {
  const original = [
    {
      baselineRequirementId: 'gap:synthetic',
      entitlementId: 'ent:synthetic',
      code: 'OFFICIAL_OUTCOME_AND_ORDER' as const,
      disposition: 'unresolved' as const,
      originalPickGroupIds: ['SYN_2026_1st'],
      baselineSeason: 2026,
    },
  ];
  function fixture() {
    const a = capture(html(monitoring()), 1);
    const b = capture(html(monitoring('3')), 2);
    const qualified = qualifyRetainedPair('2026-notes', [a, b]);
    const start = a.bytes.indexOf('<article>');
    const end = a.bytes.indexOf('</article>') + '</article>'.length;
    const citation = {
      sourceId: '2026-notes',
      capture: 0 as const,
      byteStart: start,
      byteEnd: end,
      sha256: sha256(a.bytes.subarray(start, end)),
      locator: 'article',
    };
    const inputs: Awaited<ReturnType<typeof verifyRetainedV2>> = {
      files: new Map([
        ['a', a.bytes],
        ['b', b.bytes],
        ['observations.json', Buffer.from('[{"id":"prior"}]')],
      ]),
      qualifications: [
        {
          ...qualified,
          sourceRecord: {
            id: '2026-notes',
            url: qualified.url,
            candidateBaselineRequirementIds: ['gap:synthetic'],
            captures: [
              { path: 'a', receipt: 'ra' },
              { path: 'b', receipt: 'rb' },
            ],
          },
        },
      ],
      occurrences: original,
      scopedIds: ['gap:synthetic'],
    };
    const assessment = {
      version: 'bze307-author-reassessment-v3',
      observations: [
        {
          id: 'new',
          type: 'published record',
          claim: 'Synthetic published statement',
          baselineRequirementIds: ['gap:synthetic'],
          citations: [citation],
          limitations: ['No original-pick correspondence'],
          status: 'partial',
          fullRequirementSatisfied: false,
        },
      ],
      corroborations: [
        {
          existingObservationId: 'prior',
          citations: [citation],
          limitations: ['Corroboration only'],
        },
      ],
      remaining: [
        {
          baselineRequirementId: 'gap:synthetic',
          disposition: 'unresolved',
          remainingFacts: ['Original-pick correspondence'],
        },
      ],
      conflictingRequirementIds: [] as string[],
      dependencyReview: 'No controlling branch certification',
      runtimeAuthority: false,
      independentSemanticAccept: false,
    };
    return { inputs, assessment, citation };
  }

  it('preserves exact IDs, original fields, reverse groups and dispositions', () => {
    const annotated = original.map((x) => ({
      ...x,
      officialHtmlQualification: {
        sourceIds: ['2026-notes'],
        requirementSatisfied: false,
        runtimeAuthority: false,
      },
    }));
    expect(() => assertPreservedLineage(original, annotated)).not.toThrow();
    expect(() => assertPreservedLineage(original, [])).toThrow();
    expect(() =>
      assertPreservedLineage(original, [...annotated, ...annotated])
    ).toThrow();
    for (const change of [
      { entitlementId: 'different' },
      { baselineSeason: 2025 },
      { originalPickGroupIds: [] },
      { disposition: 'satisfied by retained evidence' },
    ])
      expect(() =>
        assertPreservedLineage(original, [{ ...original[0], ...change }])
      ).toThrow();
    annotated[0].officialHtmlQualification.requirementSatisfied = true;
    expect(() => assertPreservedLineage(original, annotated)).toThrow();
  });

  it('accepts separately labeled partial claims only with exact qualified protected locators', () => {
    const { inputs, assessment } = fixture();
    expect(
      verifyAuthorAssessment(assessment, inputs).observations
    ).toHaveLength(1);
  });

  it('rejects missing IDs, unmapped facts, duplicate observations and false completeness', () => {
    const { inputs, assessment } = fixture();
    expect(() =>
      verifyAuthorAssessment({ ...assessment, remaining: [] }, inputs)
    ).toThrow();
    expect(() =>
      verifyAuthorAssessment(
        {
          ...assessment,
          observations: [
            ...assessment.observations,
            ...assessment.observations,
          ],
        },
        inputs
      )
    ).toThrow();
    assessment.observations[0].fullRequirementSatisfied = true;
    expect(() => verifyAuthorAssessment(assessment, inputs)).toThrow();
    assessment.observations[0].fullRequirementSatisfied = false;
    assessment.observations[0].baselineRequirementIds = ['gap:unrelated'];
    expect(() => verifyAuthorAssessment(assessment, inputs)).toThrow();
  });

  it('rejects citation tampering, excluded timing values and waived source gates', () => {
    const { inputs, assessment } = fixture();
    assessment.observations[0].citations[0].sha256 = '0'.repeat(64);
    expect(() => verifyAuthorAssessment(assessment, inputs)).toThrow();
    const difference = inputs.qualifications[0].byteProof!.differences[0].left;
    assessment.observations[0].citations[0] = {
      sourceId: '2026-notes',
      capture: 0,
      byteStart: difference.start,
      byteEnd: difference.end,
      sha256: difference.sha256,
      locator: 'timing',
    };
    expect(() => verifyAuthorAssessment(assessment, inputs)).toThrow();
    inputs.qualifications[0].eligibleAfterIndependentRecovery = false;
    expect(() => verifyAuthorAssessment(assessment, inputs)).toThrow();
  });

  it('keeps existing conflicts and requires source-to-requirement mapping', () => {
    const { inputs, assessment } = fixture();
    inputs.qualifications[0].sourceRecord.candidateBaselineRequirementIds = [];
    expect(() => verifyAuthorAssessment(assessment, inputs)).toThrow();
    assessment.conflictingRequirementIds = ['gap:synthetic'];
    expect(() => verifyAuthorAssessment(assessment, inputs)).toThrow();
  });
});
