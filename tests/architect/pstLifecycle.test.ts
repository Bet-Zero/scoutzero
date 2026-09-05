import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PstSourceReleaseZ } from '@/schemas/pstSourceRelease';
import { observePstPage } from '../../scripts/source-releases/pst-lifecycle/observe';
import {
  narrativeClauses,
  reconstructPst,
} from '../../scripts/source-releases/pst-lifecycle/reconstruct';
import {
  parseTerm,
  statedYears,
  type PstTerm,
} from '../../scripts/source-releases/pst-lifecycle/terms';
import { branchAssetReferences } from '../../scripts/source-releases/pst-lifecycle/branch-links';
import { dependencyLinks } from '../../scripts/source-releases/pst-lifecycle/dependency-links';
import {
  primaryClass,
  validateComparison,
  accountPst,
} from '../../scripts/source-releases/pst-lifecycle/account';

const release = PstSourceReleaseZ.parse(
  JSON.parse(
    readFileSync(
      'docs/reference/sources/releases/pst/pst-current-bze-304-07daf7583c6c9ef5-v1.json',
      'utf8'
    )
  )
);
const comparison = JSON.parse(
  readFileSync(
    'docs/reference/sources/releases/pst/pst-exposure-comparison-bze306-v1.json',
    'utf8'
  )
);
const flat = (term: PstTerm): PstTerm[] => [
  term,
  ...term.children.flatMap(flat),
];
const htmlFor = (
  narrative: string,
  original = 'Hawks',
  recipient = 'Celtics'
) =>
  `<html><body><p class="headline">2028</p><table class="datatable"><tr class="DraftTableLabel"><td>Team</td><td>Transactions</td></tr><tr><td class="RoundLabel" colspan="2">Round 1</td></tr><tr><td><div class="textrightoflogo">${original}</div></td><td><div class="textrightoflogo">${recipient}</div><p class="bodyCopySm">${narrative}</p></td></tr></table></body></html>`;
const observe = (html: string, id = 'team-ATL') =>
  observePstPage(html, {
    ...release.pages[0],
    sourcePageId: id,
    captureId: id,
    rawResponse: {
      ...release.pages[0].rawResponse,
      sha256: createHash('sha256').update(html).digest('hex'),
    },
  });
// These fixtures are invented. No PST transaction prose is published here.
const syntheticTrade =
  'Traded • Example Player to Hawks for • <strong>2028 first round pick (protected top 3 in 2028, unprotected in 2029)</strong> on 2025-01-02';

describe('PST observation and lifecycle isolation', () => {
  it('preserves exact decoded text, markup attributes, links, status and byte locators', () => {
    const html = htmlFor(syntheticTrade)
      .replace('<tr><td><div', '<tr class="unsure"><td><div')
      .replace(
        'Example Player',
        'Example &amp; Player <a href="../Years/2025.htm">older</a>'
      );
    const page = observe(html);
    const cell = page.rows[2].cells[1];
    expect(cell.narratives[0].text).toContain('Example & Player');
    expect(cell.links[0].href).toBe('../Years/2025.htm');
    expect(cell.links[0].resolvedUrl).toBe(
      'https://www.prosportstransactions.com/basketball/DraftTrades/Years/2025.htm'
    );
    expect(
      cell.signals.some((signal) => signal.classes.includes('unsure'))
    ).toBe(true);
    const span = cell.narratives[0].span!;
    expect(
      Buffer.from(html).subarray(span.byteStart, span.byteEnd).toString()
    ).toContain('Example &amp; Player');
    expect(
      page.nodes.find((node) => node.id === cell.nodeId)?.children.length
    ).toBeGreaterThan(0);
    expect(page.captureStartedAt).not.toBe('2025-01-02');
  });

  it('uses page-qualified identities and merges repeated evidence for one dated claim', () => {
    const one = observe(htmlFor(syntheticTrade));
    const two = observe(htmlFor(syntheticTrade), 'team-BOS');
    expect(one.rows[2].id).not.toBe(two.rows[2].id);
    const result = reconstructPst([two, one]);
    const events = result.assertions.filter(
      (assertion) => assertion.transactionDate
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      fromTeam: 'ATL',
      toTeam: 'BOS',
      transactionDate: '2025-01-02',
      effectiveDate: null,
    });
    expect(events[0].observations).toHaveLength(2);
    expect(reconstructPst([one, two])).toEqual(result);
  });

  it('retains same-date variants without claiming that page order proves two transfers', () => {
    const one = observe(htmlFor(syntheticTrade));
    const two = observe(
      htmlFor(
        syntheticTrade.replace(
          'Example Player',
          'Example Player and consideration'
        )
      ),
      'team-BOS'
    );
    const result = reconstructPst([one, two]);
    const event = result.assertions.find(
      (assertion) => assertion.transactionDate
    )!;
    expect(event.eventIdentity).toBe('dated-claim-with-source-variants');
    expect(
      result.histories.find((history) => history.assetId === 'ATL_2028_1st')!
        .datedGroups[0].assertionIds
    ).toEqual([event.id]);
  });

  it('never attaches a sibling pick protection or the transaction year to the target', () => {
    const page = observe(
      htmlFor(
        'Traded • 2027 first round pick (protected top 8) to Hawks for • <strong>2028 first round pick</strong> on 2025-01-02'
      )
    );
    const result = reconstructPst([page]);
    const event = result.assertions.find(
      (assertion) => assertion.transactionDate
    )!;
    expect(
      flat(event.variants[0].terms).some((term) => term.kind === 'protection')
    ).toBe(false);
    expect(statedYears(event.variants[0].text)).toEqual([2028]);
    expect(result.transactions[0].clauses[0].terms?.text).toContain(
      'protected top 8'
    );
  });

  it('retains undated observations separately and reports unresolved binding as implementation work', () => {
    const result = reconstructPst([
      observe(htmlFor('Traded • unspecified consideration')),
    ]);
    expect(result.implementationConcerns).toEqual([
      {
        evidence: 'team-ATL/t0/r2/c1/n0',
        reason: 'Target binding requires source inspection',
      },
    ]);
    expect(
      result.assertions.every((assertion) => assertion.transactionDate === null)
    ).toBe(true);
  });

  it('preserves a first-cell pool allocation without inventing an original recipient pick', () => {
    const html = htmlFor(syntheticTrade).replace(
      '<div class="textrightoflogo">Hawks</div>',
      '<div class="textrightoflogo">Hawks (most favorable of Celtics, Nets picks)</div><p class="bodyCopySm">Traded • Example Player to Nets for • <strong>2028 first round pick (most favorable of Celtics, Nets picks)</strong> on 2025-01-02</p>'
    );
    const page = observe(html);
    expect(page.rows[2]).toMatchObject({
      role: 'pooled-allocation',
      assetId: null,
      originalTeam: null,
    });
    expect(page.rows[2].transactionCellIds).toContain('team-ATL/t0/r2/c0');
    const allocation = reconstructPst([page]).assertions.find(
      (assertion) => assertion.kind === 'pool-allocation'
    )!;
    expect(allocation.assetIds).toEqual(['BKN_2028_1st', 'BOS_2028_1st']);
  });

  it('rejects canonical hash drift and refuses repeat pages as extra source identities', () => {
    expect(() => observePstPage('<html/>', release.pages[0])).toThrow('hash');
    expect(() =>
      observePstPage(
        '<html/>',
        release.pages.find(
          (page) => page.classification !== 'canonical-required'
        )!
      )
    ).toThrow('Repeats');
  });
});

describe('scoped governing expressions', () => {
  it('pairs thresholds with their stated years instead of applying every year to every threshold', () => {
    const term = parseTerm(
      'first round pick (protected top 3 in 2027-28, top 1 in 2029, unprotected in 2030)'
    );
    const schedule = flat(term).filter(
      (node) =>
        node.kind === 'protection' && Array.isArray(node.parameters.years)
    );
    expect(
      schedule.map((node) => [
        node.parameters.years,
        node.parameters.topThresholds,
        node.parameters.unprotected,
      ])
    ).toEqual([
      [[2027, 2028], [3], false],
      [[2029], [1], false],
      [[2030], [], true],
    ]);
  });

  it('binds a nested pool guard to its named pick and keeps an explicit replacement branch', () => {
    const term = parseTerm(
      '2028 first round pick (least favorable of Hawks, Celtics (protected top 3), Nets picks; else 2029 second round pick (Bulls pick))'
    );
    const guard = flat(term).find((node) => node.kind === 'protection')!;
    expect(guard.parameters.subjectTeam).toBe('BOS');
    expect(
      flat(term).find((node) => node.parameters.branchRole === 'fallback')?.text
    ).toContain('2029 second round');
  });

  it('retains dependency offset, counterparties, alternative years, deferral holder and relinquishment', () => {
    const dependency = parseTerm(
      'at least 2 years after Hawks send first round pick to Nets; protected top 3 in 2028-29'
    );
    expect(
      flat(dependency).find((term) => term.kind === 'dependency')?.parameters
    ).toMatchObject({
      minimumYearsAfter: 2,
      teams: ['ATL', 'BKN'],
      trigger: 'prior-conveyance',
    });
    expect(
      flat(parseTerm('2028 or 2029 first round pick (Hawks option)')).some(
        (term) => term.parameters.yearRelationship === 'alternative-years'
      )
    ).toBe(true);
    expect(parseTerm('relinquished in subsequent trade').kind).toBe(
      'relinquishment'
    );
    expect(parseTerm('not exercised').parameters.state).toBe('not-exercised');
  });

  it('retains malformed source punctuation explicitly without inventing a missing term', () => {
    expect(
      parseTerm('2028 first round pick (protected top 3').parameters.balanced
    ).toBe(false);
  });

  it('separates replacement identities and does not borrow an omitted original team', () => {
    const page = observe(
      htmlFor(
        syntheticTrade.replace(
          'protected top 3 in 2028, unprotected in 2029',
          'protected top 3 in 2028, else 2029 second round pick (Bulls pick), 2030 second round pick'
        )
      )
    );
    const refs = branchAssetReferences(
      reconstructPst([page]).assertions
    ).filter((ref) => ref.role === 'replacement');
    expect(refs).toHaveLength(2);
    expect(refs.find((ref) => ref.year === 2029)?.assetId).toBe('CHI_2029_2nd');
    expect(refs.find((ref) => ref.year === 2030)).toMatchObject({
      assetId: null,
      originalTeam: null,
    });
  });

  it('keeps source assignment direction outside the terms and retains both trade sides', () => {
    const clauses = narrativeClauses(
      'Traded • 2027 first round pick to Hawks for • 2028 first round pick on 2025-01-02'
    );
    expect(clauses.map((clause) => clause.direction)).toEqual([
      'given',
      'received',
    ]);
    expect(clauses[1].terms?.parameters.years).toEqual([2028]);
  });

  it('never links a second-round favorable pool to first-round histories', () => {
    const page = observe(
      htmlFor(
        'Traded • Example Player to Hawks for • <strong>2028 second round pick (most favorable of Hawks, Nets picks)</strong> on 2025-01-02'
      ).replace('Round 1', 'Round 2')
    );
    const refs = branchAssetReferences(reconstructPst([page]).assertions);
    expect(
      refs
        .filter((ref) => ref.role === 'selection-member')
        .map((ref) => ref.assetId)
    ).toEqual(expect.arrayContaining(['ATL_2028_2nd', 'BKN_2028_2nd']));
    expect(refs.some((ref) => ref.assetId?.endsWith('_1st'))).toBe(false);
  });
});

describe('truthful comparison partition', () => {
  it('pins all 278 IDs and rejects omission, duplicate, kind and year drift', () => {
    const assets = validateComparison(comparison.entitlements);
    expect(assets).toHaveLength(278);
    expect(() => validateComparison(assets.slice(1))).toThrow();
    expect(() =>
      validateComparison([assets[0], ...assets.slice(0, -1)])
    ).toThrow('Duplicate');
    expect(() =>
      validateComparison(
        assets.map((asset, index) =>
          index ? asset : { ...asset, kind: 'swap_right' }
        )
      )
    ).toThrow();
    expect(() =>
      validateComparison(
        assets.map((asset, index) =>
          index ? asset : { ...asset, seasonYear: 2033 }
        )
      )
    ).toThrow();
  });

  it('keeps recovered fields orthogonal to unresolved source facts and gives conflict precedence', () => {
    expect(
      primaryClass({
        mapped: true,
        conflict: false,
        partial: true,
        recovered: true,
      })
    ).toBe('source-partial/uncertain');
    expect(
      primaryClass({
        mapped: true,
        conflict: true,
        partial: true,
        recovered: true,
      })
    ).toBe('conflicting');
    expect(
      primaryClass({
        mapped: false,
        conflict: true,
        partial: true,
        recovered: true,
      })
    ).toBe('missing');
  });

  it('does not turn absent narratives or future placeholders into completeness proof', () => {
    const page = observe(htmlFor(''));
    const result = accountPst(
      validateComparison(comparison.entitlements),
      [page],
      reconstructPst([page])
    );
    const row = result.register.find(
      (row) =>
        row.underlyingAssetIds.includes('ATL_2028_1st') &&
        row.kind === 'pick_ownership'
    )!;
    expect(row.primaryClass).toBe('source-partial/uncertain');
    expect(
      row.gaps.some((gap) => gap.code === 'SNAPSHOT_WITHOUT_GOVERNING_HISTORY')
    ).toBe(true);
    expect(
      result.register.every(
        (row) => row.positivePathAuthority === 'unavailable'
      )
    ).toBe(true);
    expect(
      Object.values(result.counts).reduce((sum, count) => sum + count, 0)
    ).toBe(278);
  });
});

// Private-byte probes have hand-authored expectations from the accepted HTML,
// never parser snapshots. Public CI uses only the synthetic cases above.
const retainedDirectory = process.env.PST_LIFECYCLE_EVIDENCE;
const retainedPage = (id: string) => {
  const metadata = release.pages.find(
    (page) =>
      page.sourcePageId === id && page.classification === 'canonical-required'
  )!;
  return observePstPage(
    readFileSync(
      `${retainedDirectory}/${metadata.rawResponse.relativePath}`,
      'utf8'
    ),
    metadata
  );
};
describe.skipIf(!retainedDirectory)(
  'accepted private current-byte discriminators',
  () => {
    it('keeps the LAC 2026 target free of both other-pick protection clauses', () => {
      const result = reconstructPst([retainedPage('year-2026')]);
      const claim = result.assertions.find(
        (assertion) =>
          assertion.assetIds.includes('LAC_2026_1st') &&
          assertion.transactionDate === '2019-07-10'
      )!;
      expect(claim).toMatchObject({ fromTeam: 'LAC', toTeam: 'OKC' });
      expect(
        flat(claim.variants[0].terms).some((term) => term.kind === 'protection')
      ).toBe(false);
      expect(
        result.histories.find((history) => history.assetId === 'LAC_2026_1st')!
          .outcomes[0].outcome.overall
      ).toBe(12);
    });

    it('preserves all four current Indiana assignments and the distinct replacement years', () => {
      const result = reconstructPst([retainedPage('year-2026')]);
      const history = result.histories.find(
        (item) => item.assetId === 'IND_2026_1st'
      )!;
      expect(history.datedGroups.map((group) => group.transactionDate)).toEqual(
        ['2024-01-17', '2025-02-06', '2025-06-17', '2026-02-05']
      );
      const claims = history.datedGroups.map(
        (group) =>
          result.assertions.find(
            (assertion) => assertion.id === group.assertionIds[0]
          )!
      );
      expect(claims.map((claim) => [claim.fromTeam, claim.toTeam])).toEqual([
        ['IND', 'TOR'],
        ['TOR', 'NOP'],
        ['NOP', 'IND'],
        ['IND', 'LAC'],
      ]);
      const refs = branchAssetReferences(claims).filter(
        (ref) => ref.role === 'replacement'
      );
      expect(refs.map((ref) => ref.assetId)).toContain('UTA_2027_2nd');
      expect(refs.map((ref) => ref.assetId)).toContain('DAL_2028_2nd');
      expect(refs.some((ref) => ref.year === 2031 && ref.round === 1)).toBe(
        true
      );
      expect(history.outcomes[0].outcome.overall).toBe(5);
    });

    it('separates the Philadelphia predecessor dependency from its protection ladder', () => {
      const result = reconstructPst([
        retainedPage('year-2026'),
        retainedPage('year-2027'),
      ]);
      const claim = result.assertions.find(
        (assertion) =>
          assertion.assetIds.includes('PHI_2027_1st') &&
          assertion.transactionDate === '2022-02-10'
      )!;
      const terms = flat(claim.variants[0].terms);
      expect(
        terms.find((term) => term.kind === 'dependency')?.parameters
          .minimumYearsAfter
      ).toBe(2);
      expect(
        terms.some(
          (term) =>
            term.kind === 'protection' &&
            JSON.stringify(term.parameters.years) === '[2027,2028]' &&
            JSON.stringify(term.parameters.topThresholds) === '[8]'
        )
      ).toBe(true);
      expect(
        terms.some((term) => term.parameters.branchRole === 'fallback')
      ).toBe(true);
      const predecessor = dependencyLinks(result.assertions).find(
        (link) => link.assertionId === claim.id
      )!;
      expect(predecessor.status).toBe('unique-dated-prior-claim');
      expect(predecessor.candidateAssetIds).toContain('PHI_2026_1st');
    });

    it('keeps Denver protection inside the 2027 swap alternative and preserves rank two in the 2029 pool', () => {
      const result = reconstructPst([
        retainedPage('team-LAC'),
        retainedPage('team-HOU'),
      ]);
      const swap = result.assertions.find(
        (assertion) =>
          assertion.assetIds.includes('LAC_2027_1st') &&
          assertion.kind === 'swap-interest'
      )!;
      const guard = flat(swap.variants[0].terms).find(
        (term) => term.kind === 'protection'
      )!;
      expect(guard.parameters).toMatchObject({
        subjectTeam: 'DEN',
        topThresholds: [5],
      });
      const allocation = result.assertions.find(
        (assertion) =>
          assertion.kind === 'pool-allocation' &&
          assertion.assetIds.includes('HOU_2029_1st')
      )!;
      expect(
        flat(allocation.variants[0].terms).find(
          (term) => term.kind === 'selection'
        )?.parameters
      ).toMatchObject({
        rank: 2,
        order: 'most-favorable-first',
        members: ['DAL', 'HOU', 'PHX'],
      });
    });

    it('keeps Brooklyn outbound/return history and the separate contextual relinquishment', () => {
      const result = reconstructPst([retainedPage('year-2026')]);
      const history = result.histories.find(
        (item) => item.assetId === 'BKN_2026_1st'
      )!;
      expect(history.datedGroups.map((group) => group.transactionDate)).toEqual(
        ['2021-01-16', '2024-06-26']
      );
      const targets = history.datedGroups.map(
        (group) =>
          result.assertions.find(
            (assertion) => assertion.id === group.assertionIds[0]
          )!.toTeam
      );
      expect(targets).toEqual(['HOU', 'BKN']);
      expect(
        result.transactions
          .filter((transaction) => transaction.rowId === 'year-2026/t0/r7')
          .some((transaction) =>
            transaction.clauses.some(
              (clause) =>
                clause.terms &&
                flat(clause.terms).some(
                  (term) => term.kind === 'relinquishment'
                )
            )
          )
      ).toBe(true);
    });
  }
);
