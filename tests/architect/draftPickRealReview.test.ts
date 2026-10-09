import { describe, it, expect } from 'vitest';
import { syntheticFoundationInput } from './fixtures/draftPickFoundation';
import { buildDraftPickFoundation } from '@/features/architect/utils/draftPickFoundation';
import { serializeDraftPickFoundation } from '@/features/architect/utils/draftPickRelease';
import { sha256Digest } from '@/features/architect/utils/contractSource/deterministicDigest';
import {
  verifyRealDraftReviewPackage,
  deriveRealDraftSelection,
  loadRealDraftReview,
  reviewRealDraftSelection,
} from '@/features/architect/utils/draftPickRealReview';
import type { DraftPickRealReviewPackage } from '@/schemas/draftPickRealReview';

async function fixture() {
  const foundation = buildDraftPickFoundation(syntheticFoundationInput());
  const foundationText = serializeDraftPickFoundation(foundation);
  const pick = {
    kind: 'authenticated-original-pick' as const,
    id: 'AAA_2030_1st',
    originalTeam: 'AAA',
    draftYear: 2030,
    round: 1 as const,
  };
  const asOf = foundation.release.asOf;
  const data: DraftPickRealReviewPackage = {
    version: 1,
    foundationText,
    foundationPin: {
      release: foundation.release,
      payloadSha256: (await sha256Digest(foundationText)).slice(7),
    },
    inventorySha256: 'a'.repeat(64),
    acceptanceReference: 'synthetic-acceptance',
    records: [
      {
        entitlementId: 'legacy-own',
        label: 'AAA 2030 first',
        role: 'original',
        originalPick: pick,
        poolIds: [],
        evidence: [],
        ownership: {
          id: 'synthetic-owned',
          scope: 'original-pick-ownership',
          pick,
          status: 'supported in stated scope',
          effectiveAt: asOf,
          validUntil: null,
          unresolvedDependencyIds: [],
          claimCoverage: 'complete',
          claims: [
            {
              id: 'synthetic-claim',
              team: 'BBB',
              status: 'owned-unconditionally',
            },
          ],
          sources: [
            {
              id: 'synthetic-source',
              artifactSha256: 'b'.repeat(64),
              locator: 'synthetic#ownership',
              scope: 'original-pick-ownership',
              qualification: 'qualified',
              publishedAt: '2029-01-01T00:00:00Z',
              capturedAt: asOf,
              review: {
                status: 'accepted',
                reference: 'synthetic-review',
                limitations: [],
              },
            },
          ],
        },
      },
      {
        entitlementId: 'legacy-projection',
        label: 'AAA pool entry',
        role: 'generated-alias',
        originalPick: null,
        ownership: null,
        poolIds: ['synthetic-pool'],
        evidence: [],
      },
    ],
    unresolved: [
      {
        dependencyId: 'd3',
        entitlementIds: ['legacy-own', 'legacy-projection'],
        occurrenceIds: ['o3'],
        actions: ['allocate'],
        reason: 'Unestablished allocation',
        missingSource: 'Explicit selector terms',
        sourceRefs: ['synthetic#d3'],
      },
    ],
  };
  async function load(value = data) {
    const text = JSON.stringify(value);
    return verifyRealDraftReviewPackage(text, {
      payloadSha256: (await sha256Digest(text)).slice(7),
      inventorySha256: 'a'.repeat(64),
      acceptanceReference: 'synthetic-acceptance',
      entitlements: 2,
      occurrences: 5,
      dependencies: 5,
      predecessors: 1,
      unresolved: 1,
    });
  }
  const args = {
    selections: [{ entitlementId: 'legacy-own', team: 'BBB' }],
    asOfDate: asOf.slice(0, 10),
    proposalSha256: 'c'.repeat(64),
    stateVersion: 'synthetic-state',
  };
  return { data, load, args };
}

describe('retained real-data review boundary (synthetic public cases)', () => {
  it('establishes supported ownership independently of an unrelated unresolved allocation, without an overall pass', async () => {
    const f = await fixture();
    const result = deriveRealDraftSelection(await f.load(), f.args);
    expect(result).toMatchObject({
      apply: 'blocked',
      tradingVerdict: 'not-evaluated',
    });
    expect(result.records[0].components).toMatchObject({
      status: 'reviewed',
      ownership: { status: 'component-permits' },
      stepien: { status: 'needs-input' },
      cashSale: { status: 'needs-input' },
    });
    expect(result.records[0].blockers).toEqual([]);
    expect(result.records[0].relatedDependencies[0].actions).toEqual([
      'allocate',
    ]);
  });
  it('rejects the wrong conveying team without hiding the separate missing components', async () => {
    const f = await fixture();
    f.args.selections[0].team = 'CCC';
    expect(
      deriveRealDraftSelection(await f.load(), f.args).records[0].components
    ).toMatchObject({
      ownership: { status: 'component-prohibits' },
      stepien: { status: 'needs-input' },
    });
  });
  it.each(['2030-06-06', '2029-06-05', null])(
    'withholds component conclusions for wrong or absent world date %s',
    async (date) => {
      const f = await fixture();
      expect(
        deriveRealDraftSelection(await f.load(), { ...f.args, asOfDate: date })
          .records[0].components
      ).toBeNull();
    }
  );
  it('does not substitute publication for a missing or later effective date', async () => {
    const f = await fixture();
    for (const date of [null, '2031-01-01T00:00:00Z']) {
      f.data.records[0].ownership!.effectiveAt = date;
      expect(
        deriveRealDraftSelection(await f.load(), f.args).records[0].components
      ).toMatchObject({ ownership: { status: 'needs-input' } });
    }
  });
  it('preserves generated aliases and cannot evaluate them as original assets', async () => {
    const f = await fixture();
    f.args.selections[0].entitlementId = 'legacy-projection';
    expect(
      deriveRealDraftSelection(await f.load(), f.args).records[0]
    ).toMatchObject({
      role: 'generated-alias',
      poolIds: ['synthetic-pool'],
      components: null,
      status: 'needs-input',
    });
    f.data.records[1].originalPick = f.data.records[0].originalPick;
    await expect(f.load()).rejects.toThrow('cannot become an original');
  });
  it('rejects inventory omission, substitution and duplicate blocker lineage', async () => {
    const f = await fixture();
    const missing = structuredClone(f.data);
    missing.records.pop();
    await expect(f.load(missing)).rejects.toThrow('inventory');
    const substituted = structuredClone(f.data);
    substituted.records[0].entitlementId = 'unregistered';
    await expect(f.load(substituted)).rejects.toThrow('inventory');
    f.data.unresolved[0].entitlementIds = ['legacy-projection'];
    await expect(f.load()).rejects.toThrow('lineage');
  });
  it('rejects incomplete future alternatives and wrong-scope supported evidence', async () => {
    const f = await fixture();
    f.data.records[0].evidence = [
      {
        dependencyId: 'd0',
        status: 'legitimate future outcome pending',
        summary: 'Synthetic option',
        limitation: '',
        effectiveAt: null,
        alternativesComplete: false,
        sourceRefs: ['synthetic#option'],
      },
    ];
    await expect(f.load()).rejects.toThrow('incomplete alternatives');
    f.data.records[0].evidence[0].alternativesComplete = true;
    f.data.records[0].evidence[0].dependencyId = 'unrelated';
    await expect(f.load()).rejects.toThrow('wrong scope');
  });
  it('does not treat schema validity or a caller-created pin as installed authority', async () => {
    const f = await fixture();
    await expect(loadRealDraftReview(JSON.stringify(f.data))).rejects.toThrow(
      'evidence changed'
    );
    expect(() => reviewRealDraftSelection({}, f.args)).toThrow('authenticated');
  });
  it('does not assume an Apron status from missing observations for a covered draft year', async () => {
    const f = await fixture();
    // The retained original tuple is changed coherently in a synthetic successor.
    const foundation = JSON.parse(f.data.foundationText);
    for (const e of foundation.retained.entitlements)
      e.baselineUnderlyingAssetIdsUnchanged = ['AAA_2033_1st'];
    f.data.foundationText = JSON.stringify(foundation);
    f.data.foundationPin.payloadSha256 = (
      await sha256Digest(f.data.foundationText)
    ).slice(7);
    f.data.records[0].originalPick = {
      ...f.data.records[0].originalPick!,
      id: 'AAA_2033_1st',
      draftYear: 2033,
    };
    f.data.records[0].ownership!.pick = f.data.records[0].originalPick;
    const result = deriveRealDraftSelection(await f.load(), f.args);
    expect(result.records[0].components).toMatchObject({
      apron: [
        { status: 'evaluated', result: { frozen: { status: 'blocked' } } },
      ],
    });
  });
});
