import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildDraftPickFoundation } from '@/features/architect/utils/draftPickFoundation';
import {
  loadDraftPickRelease,
  serializeDraftPickFoundation,
} from '@/features/architect/utils/draftPickRelease';
import { compareDraftPickReleases } from '@/features/architect/utils/draftPickReleaseComparison';
import {
  DraftPickReleasePinZ,
  type DraftPickReleaseUse,
} from '@/schemas/draftPickRelease';
import { syntheticFoundationInput } from './fixtures/draftPickFoundation';

// Synthetic statements only. Independent byte hashes use Node, not the loader helper.
function document(
  input: {
    release: unknown;
    [key: string]: unknown;
  } = syntheticFoundationInput()
) {
  const serialized = JSON.stringify(input);
  return {
    serialized,
    pin: DraftPickReleasePinZ.parse({
      payloadSha256: createHash('sha256').update(serialized).digest('hex'),
      release: structuredClone(input.release),
    }),
  };
}
async function load(
  input: {
    release: unknown;
    [key: string]: unknown;
  } = syntheticFoundationInput(),
  use: DraftPickReleaseUse = 'retained-baseline'
) {
  const d = document(input);
  return loadDraftPickRelease(d.serialized, d.pin, use);
}
function successor() {
  const input = syntheticFoundationInput();
  input.release.id = 'synthetic-v2';
  return input;
}

describe('pinned draft release loading', () => {
  it('reconstructs and freezes every retained field, without making any right executable', async () => {
    const input = syntheticFoundationInput();
    const result = await load(input);
    expect(result.foundation.retained).toEqual(input.retained);
    expect(result.foundation.overlay).toEqual(input.overlay);
    expect(result.foundation.programs).toEqual(input.programs);
    expect(result.foundation.release.review.limitations).toEqual([
      'storage only',
    ]);
    expect(Object.isFrozen(result.foundation.retained.occurrences[0])).toBe(
      true
    );
    expect(result.execution).toBe('disabled');
    expect(
      result.foundation.legacyRecords.every(
        (r) => !r.executable && !r.wholeAssetReady
      )
    ).toBe(true);
  });

  it.each([
    'bytes',
    'release-id',
    'as-of',
    'evidence-pin',
    'assessment-pin',
    'review-scope',
  ])('rejects an incorrect %s before returning a model', async (kind) => {
    const d = document();
    if (kind === 'bytes') d.serialized += ' ';
    if (kind === 'release-id') d.pin.release.id = 'wrong';
    if (kind === 'as-of') d.pin.release.asOf = '2030-06-06T12:00:00Z';
    if (kind === 'evidence-pin') d.pin.release.evidenceSha256 = 'c'.repeat(64);
    if (kind === 'assessment-pin')
      d.pin.release.assessmentSha256 = 'c'.repeat(64);
    if (kind === 'review-scope') d.pin.release.review.limitations = [];
    await expect(
      loadDraftPickRelease(d.serialized, d.pin, 'retained-baseline')
    ).rejects.toThrow();
  });

  it('rejects malformed JSON even with the right byte hash', async () => {
    const d = document();
    d.serialized = '{';
    d.pin.payloadSha256 = createHash('sha256').update('{').digest('hex');
    await expect(
      loadDraftPickRelease(d.serialized, d.pin, 'proposal')
    ).rejects.toThrow();
  });

  it.each(['unreviewed', 'rejected'])(
    'keeps a %s successor a proposal, never the accepted baseline',
    async (status) => {
      const input = successor();
      input.release.review.status = status;
      const d = document(input);
      await expect(
        loadDraftPickRelease(d.serialized, d.pin, 'retained-baseline')
      ).rejects.toThrow('unaccepted');
      const proposed = await loadDraftPickRelease(
        d.serialized,
        d.pin,
        'proposal'
      );
      expect(proposed.use).toBe('proposal');
      expect(proposed.execution).toBe('disabled');
    }
  );

  it('reuses full builder validation even when corrupt lineage has a matching new payload hash', async () => {
    const input = successor();
    input.retained.occurrences.pop();
    await expect(load(input, 'proposal')).rejects.toThrow();
  });

  it('rejects duplicate artifact IDs so comparison cannot collapse two contents', async () => {
    const input = syntheticFoundationInput();
    const artifact = {
      id: 'artifact',
      sha256: 'c'.repeat(64),
      scope: 'synthetic',
      review: input.release.review,
      content: { claim: 1 },
    };
    await expect(
      load({
        ...input,
        retainedArtifacts: [artifact, { ...artifact, content: { claim: 2 } }],
      })
    ).rejects.toThrow('Duplicate retained artifact');
  });

  it('serializes retained inputs and reproduces derived fields on a fresh load', async () => {
    const foundation = buildDraftPickFoundation(syntheticFoundationInput());
    const serialized = serializeDraftPickFoundation(foundation);
    expect(JSON.parse(serialized)).not.toHaveProperty('legacyRecords');
    const pin = {
      release: foundation.release,
      payloadSha256: createHash('sha256').update(serialized).digest('hex'),
    };
    const reloaded = await loadDraftPickRelease(
      serialized,
      pin,
      'retained-baseline'
    );
    expect(reloaded.foundation).toEqual(foundation);
  });
});

describe('non-adopting successor comparison', () => {
  it('reports no changes for the exact same release, while still refusing any trading verdict', async () => {
    const baseline = await load();
    const result = compareDraftPickReleases(baseline, baseline);
    expect(result.changedDependencyIds).toEqual([]);
    expect(result.affectedOperations).toEqual([]);
    expect(result.unmappedImpact).toEqual([]);
    expect(result.unchangedDependencyIds).toEqual([
      'd0',
      'd1',
      'd2',
      'd3',
      'd4',
    ]);
    expect(result.adoption).toBe('not-performed');
    expect(result.tradingVerdict).toBe('not-evaluated');
    expect(result.execution).toBe('disabled');
    expect(Object.isFrozen(result.sections.dependencies)).toBe(true);
    expect(Object.isFrozen(result.affectedOperations)).toBe(true);
  });

  it('does not count changed release/review metadata as a resolved fact', async () => {
    const input = successor();
    input.release.review.status = 'unreviewed';
    const result = compareDraftPickReleases(
      await load(),
      await load(input, 'proposal')
    );
    expect(result.changedDependencyIds).toEqual([]);
    expect(result.sections.dependencies).toEqual([]);
    expect(result.unmappedImpact).toContain('release');
  });

  it('reports exact changed fields and both old/new operations, retaining unrelated evidence', async () => {
    const before = await load();
    const input = successor();
    input.retained.dependencies[0].controlsAtStart =
      'synthetic replacement decision';
    input.retained.dependencies[0].evidenceRefs = ['new-source#specific-claim'];
    const result = compareDraftPickReleases(
      before,
      await load(input, 'proposal')
    );
    expect(
      result.sections.dependencies.map((d) => ({ id: d.id, fields: d.fields }))
    ).toEqual([{ id: 'd0', fields: ['controlsAtStart', 'evidenceRefs'] }]);
    expect(result.changedDependencyIds).toEqual(['d0']);
    expect(result.affectedOperations).toEqual([
      'synthetic controlled decision 0',
      'synthetic replacement decision',
    ]);
    expect(result.associatedEntitlementIds).toEqual([
      'legacy-own',
      'legacy-projection',
    ]);
    expect(result.unchangedDependencyIds).toEqual(['d1', 'd2', 'd3', 'd4']);
    expect(before.foundation.retained.dependencies[0].evidenceRefs).toEqual([
      'source#claim-0',
    ]);
  });

  it('detects source date changes despite unchanged counts and status', async () => {
    const input = successor();
    input.retained.dependencies[0].retainedAnnotation.captureDate =
      '2030-06-07';
    const result = compareDraftPickReleases(
      await load(),
      await load(input, 'proposal')
    );
    expect(result.sections.dependencies[0].fields).toEqual([
      'retainedAnnotation',
    ]);
    expect(result.sections.dependencies[0].before?.authorityStatus).toBe(
      result.sections.dependencies[0].after?.authorityStatus
    );
  });

  it.each([
    'legacy-id',
    'original-pick',
    'occurrence-baseline',
    'predecessor-id',
  ])('rejects a same-count %s substitution', async (kind) => {
    const input = successor();
    if (kind === 'legacy-id') {
      input.retained.entitlements[0].entitlementId = 'replacement';
      input.retained.dependencies.forEach((d) => {
        d.entitlementIds[0] = 'replacement';
      });
      input.overlay.forEach((d) => {
        d.entitlementIds[0] = 'replacement';
      });
      input.retained.predecessorDependencies[0].affectedEntitlementIds = [
        'replacement',
      ];
    }
    if (kind === 'original-pick')
      input.retained.entitlements[0].baselineUnderlyingAssetIdsUnchanged = [
        'BBB_2030_1st',
      ];
    if (kind === 'occurrence-baseline')
      input.retained.occurrences[0].baseline.originalText =
        'rewritten historical source';
    if (kind === 'predecessor-id')
      input.retained.predecessorDependencies[0].id = 'replacement';
    const baseline = await load(),
      proposed = await load(input, 'proposal');
    expect(() => compareDraftPickReleases(baseline, proposed)).toThrow(
      'lineage'
    );
  });

  it('rejects changed bytes under the old release ID', async () => {
    const input = syntheticFoundationInput();
    input.retained.dependencies[0].evidenceRefs = ['new'];
    const baseline = await load(),
      proposed = await load(input, 'proposal');
    expect(() => compareDraftPickReleases(baseline, proposed)).toThrow(
      'new release identity'
    );
  });

  it('does not hide unmapped source-artifact or branch-detail impact behind an empty operation list', async () => {
    const input = successor();
    const changed = {
      ...input,
      retainedBranchDetails: [{ newTerm: 'unknown meaning' }],
    };
    const result = compareDraftPickReleases(
      await load(),
      await load(changed, 'proposal')
    );
    expect(result.affectedOperations).toEqual([]);
    expect(result.unmappedImpact).toContain('branchDetails');
  });

  it('does not infer new causality from a changed readiness overlay', async () => {
    const input = successor();
    input.overlay[0].category = 'B';
    const result = compareDraftPickReleases(
      await load(),
      await load(input, 'proposal')
    );
    expect(result.sections.dependencies).toEqual([]);
    expect(result.changedDependencyIds).toEqual(['d1']);
    expect(result.associationScope).toBe(
      'registered-links-not-proven-causality'
    );
  });

  it('rejects a caller-fabricated loaded model and an unaccepted predecessor', async () => {
    const good = await load();
    expect(() => compareDraftPickReleases({ ...good }, good)).toThrow('loader');
    const proposal = await load(successor(), 'proposal');
    expect(() => compareDraftPickReleases(proposal, good)).toThrow('baseline');
  });
});
