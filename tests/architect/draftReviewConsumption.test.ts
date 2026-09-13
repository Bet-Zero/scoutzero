import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYNTHETIC_DRAFT_RELEASES } from '../e2e/fixtures/syntheticDraftMutationReleases';
import { SyntheticDraftMutationSourceZ } from '@/schemas/draftPickReviewMutation';
import {
  prepareSyntheticDraftReview,
  verifyDraftReviewApply,
  reviewedFirstsPermit,
} from '@/features/architect/utils/draftReview/capability';
import type { ApplyWorldMutationArgs } from '@/features/architect/utils/mutationPipeline.types.ingress';

const mock = vi.hoisted(() => ({
  allowed: true,
  docs: new Map<string, Record<string, unknown>>(),
  state: {},
}));
vi.mock('@/firebaseConfig', () => ({
  db: {},
  isSyntheticDraftReviewEnvironment: () => mock.allowed,
}));
vi.mock('@/features/architect/utils/mutationPipeline.read.stateLoader', () => ({
  loadStateForMutation: async () => mock.state,
}));
vi.mock('firebase/firestore', () => {
  const ref = (first: { path?: string }, ...parts: string[]) => ({
    path: [first.path, ...parts].filter(Boolean).join('/'),
  });
  const snap = (path: string) => ({
    id: path.split('/').at(-1),
    ref: { path },
    exists: () => mock.docs.has(path),
    data: () => mock.docs.get(path),
  });
  return {
    doc: ref,
    collection: ref,
    getDoc: async (r: { path: string }) => snap(r.path),
    getDocs: async (r: { path: string }) => ({
      docs: [...mock.docs.keys()]
        .filter(
          (p) =>
            p.startsWith(r.path + '/') &&
            p.split('/').length === r.path.split('/').length + 1
        )
        .map(snap),
    }),
  };
});
function setup(
  variant: keyof typeof SYNTHETIC_DRAFT_RELEASES = 'legal'
): ApplyWorldMutationArgs {
  const text = SYNTHETIC_DRAFT_RELEASES[variant];
  const release = JSON.parse(text);
  const source = SyntheticDraftMutationSourceZ.parse(
    release.retainedArtifacts[0].content
  );
  const root = 'architect_worlds/review_world';
  mock.docs.set(root, {
    createdBy: 'review-user',
    parentWorldId: null,
    currentSeason: '2026-27',
    asOfDate: '2026-07-15',
    draftReviewReleaseId: release.release.id,
    draftReviewReleaseText: text,
  });
  for (const [team, entitlementIds] of Object.entries(
    source.teamEntitlementIds
  ))
    mock.docs.set(`${root}/teams/${team}`, { teamCode: team, entitlementIds });
  for (const [id, ent] of Object.entries(source.entitlements))
    mock.docs.set(`${root}/entitlements/${id}`, ent);
  mock.state = {
    teams: ['BOS', 'MIA'].map((teamCode) => ({
      teamCode,
      team: mock.docs.get(`${root}/teams/${teamCode}`),
    })),
  };
  // The literal source is independently parsed above; mutation input is the
  // exact retained fixture proposal, not a derived expected rule result.
  return {
    userId: 'review-user',
    worldId: 'review_world',
    seasonId: '2026-27',
    mutationType: 'executeTrade',
    operationId: 'review-op',
    payload: JSON.parse(JSON.stringify(source.proposal)),
  };
}
beforeEach(() => {
  mock.allowed = true;
  mock.docs.clear();
});

describe('supported synthetic review consumption', () => {
  it('consumes a qualified complete case without promoting the component receipt', async () => {
    const args = setup();
    const r = await prepareSyntheticDraftReview(args);
    expect(r.status).toBe('prepared');
    if (r.status !== 'prepared') throw new Error('Positive control failed');
    expect(r.reviews[0].review).toMatchObject({
      tradingVerdict: 'not-evaluated',
      apply: 'blocked',
    });
    expect(
      reviewedFirstsPermit(r.authority, 'BOS', ['review-BOS-2028-1'], false)
    ).toBe(false);
    verifyDraftReviewApply(r.authority, {
      ...args,
      operationId: 'review-op',
      state: mock.state,
      asOfDate: '2026-07-15',
    });
    expect(
      reviewedFirstsPermit(r.authority, 'BOS', ['review-BOS-2028-1'], false)
    ).toBe(true);
    for (const forged of [
      {},
      JSON.parse(JSON.stringify(r.authority)),
      { apply: 'permitted', review: r.reviews[0].review },
    ])
      expect(
        reviewedFirstsPermit(forged, 'BOS', ['review-BOS-2028-1'], false)
      ).toBe(false);
    expect(
      reviewedFirstsPermit(r.authority, 'MIA', ['review-BOS-2028-1'], false)
    ).toBe(false);
    expect(reviewedFirstsPermit(r.authority, 'BOS', ['different'], false)).toBe(
      false
    );
    expect(
      reviewedFirstsPermit(r.authority, 'BOS', ['review-BOS-2028-1'], true)
    ).toBe(false);
  });
  it.each([
    ['ownership', 'ownership:component-prohibits'],
    ['stepien', 'stepien:component-prohibits'],
    ['cash', 'cash-sale:component-prohibits'],
    ['apron', 'apron:BOS_2032_1st:component-prohibits'],
    ['missing', 'stepien:needs-input'],
    ['conflicting', 'ownership:needs-input'],
  ] as const)(
    'blocks the actual %s component with other results preserved',
    async (variant, reason) => {
      const r = await prepareSyntheticDraftReview(setup(variant));
      expect(r.status).toBe('blocked');
      if (r.status !== 'blocked')
        throw new Error('Negative case incorrectly authorized');
      expect(r.reasons.some((r) => r.startsWith(reason))).toBe(true);
      expect(r).not.toHaveProperty('authority');
    }
  );
  it.each(['proposal', 'state', 'date', 'world', 'operation'] as const)(
    'rejects stale %s at the actual consumption handoff',
    async (kind) => {
      const args = setup();
      const r = await prepareSyntheticDraftReview(args);
      if (r.status !== 'prepared') throw new Error('Positive control failed');
      const actual = {
        ...args,
        operationId: 'review-op',
        state: mock.state,
        asOfDate: '2026-07-15',
      };
      if (kind === 'proposal')
        actual.payload = { ...actual.payload, asOfDate: '2026-07-16' };
      if (kind === 'state') actual.state = { changed: true };
      if (kind === 'date') actual.asOfDate = '2026-07-16';
      if (kind === 'world') actual.worldId = 'other';
      if (kind === 'operation') actual.operationId = 'other';
      expect(() => verifyDraftReviewApply(r.authority, actual)).toThrow(
        /changed/
      );
    }
  );
  it('rejects a changed release even when it keeps the old embedded review', async () => {
    const args = setup();
    mock.docs.get('architect_worlds/review_world')!.draftReviewReleaseText +=
      ' ';
    await expect(prepareSyntheticDraftReview(args)).rejects.toThrow(
      /digest mismatch/
    );
  });
  it('rejects unexpected claims, conditional identity, and inventory omissions', async () => {
    for (const kind of ['extra', 'terms', 'inventory']) {
      const args = setup();
      if (kind === 'extra')
        mock.docs.set('architect_worlds/review_world/entitlements/extra', {
          id: 'extra',
        });
      if (kind === 'terms')
        mock.docs.get(
          'architect_worlds/review_world/entitlements/review-BOS-2028-1'
        )!.protection = 'top 10';
      if (kind === 'inventory')
        mock.docs.get(
          'architect_worlds/review_world/teams/BOS'
        )!.entitlementIds = [];
      await expect(prepareSyntheticDraftReview(args)).rejects.toThrow(
        /coverage|changed/
      );
      mock.docs.clear();
    }
  });
  it('default/production environment denies both issuance and an otherwise valid capability', async () => {
    const args = setup();
    const r = await prepareSyntheticDraftReview(args);
    if (r.status !== 'prepared') throw new Error('Positive control failed');
    verifyDraftReviewApply(r.authority, {
      ...args,
      operationId: 'review-op',
      state: mock.state,
      asOfDate: '2026-07-15',
    });
    mock.allowed = false;
    await expect(prepareSyntheticDraftReview(args)).rejects.toThrow(
      /environment/
    );
    expect(
      reviewedFirstsPermit(r.authority, 'BOS', ['review-BOS-2028-1'], false)
    ).toBe(false);
  });
});
