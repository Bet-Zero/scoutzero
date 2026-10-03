import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteField } from 'firebase/firestore';
import { seedSyntheticDraftReviewWorld } from './fixtures/syntheticDraftReviewWorld';
import {
  getReviewAdminDb,
  readReviewUserId,
  openDashboardTab,
  getWorldEventDocuments,
  getWorldTeamDocument,
} from './helpers/architectReviewWorld';
import { SYNTHETIC_DRAFT_RELEASES } from './fixtures/syntheticDraftMutationReleases';

test.use({ viewport: { width: 1280, height: 720 }, trace: 'on' });
// Leave startup/teardown inside the wrapper's unchanged four-minute process cap.
test.setTimeout(200000);
const root = 'world_synthetic_draft_review';
const proofDir =
  process.env.SCOUTZERO_BROWSER_PROOF_DIR ||
  'tmp/browser-proofs/draft-review-diagnostic';
const candidate =
  process.env.SCOUTZERO_PROOF_CANDIDATE || 'unfrozen-diagnostic';
function retain(name: string, proof: unknown) {
  fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(
    path.join(proofDir, name),
    `${JSON.stringify({ candidate, scope: 'synthetic-review-only', proof }, null, 2)}\n`
  );
}
async function capture(page: Page, name: string) {
  fs.mkdirSync(proofDir, { recursive: true });
  await page.screenshot({
    path: path.join(proofDir, `${name}-1280x720.png`),
    fullPage: false,
  });
}
async function savedState(worldId: string) {
  const db = getReviewAdminDb();
  const world = db.doc(`architect_worlds/${worldId}`);
  const [metadata, teams, entitlements, events] = await Promise.all([
    world.get(),
    world.collection('teams').get(),
    world.collection('entitlements').get(),
    world.collection('events').get(),
  ]);
  return {
    metadata: metadata.data(),
    teams: teams.docs.map((d) => ({ id: d.id, data: d.data() })),
    entitlements: entitlements.docs.map((d) => ({ id: d.id, data: d.data() })),
    events: events.docs.map((d) => ({ id: d.id, data: d.data() })),
  };
}
async function authenticate(page: Page) {
  await page.goto('/gm/BOS?season=2027', { waitUntil: 'domcontentloaded' });
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  return readReviewUserId(page);
}
async function prepare(
  page: Page,
  uid: string,
  worldId: string,
  variant: keyof typeof SYNTHETIC_DRAFT_RELEASES = 'legal'
) {
  const source = await seedSyntheticDraftReviewWorld(uid, worldId, variant);
  return page.evaluate(
    async ({ uid, worldId, payload }) => {
      const path = '/src/features/architect/utils/draftReview/capability.ts';
      const { prepareSyntheticDraftReview } = await import(path);
      const args = {
        userId: uid,
        worldId,
        seasonId: '2026-27',
        mutationType: 'executeTrade',
        operationId: 'synthetic-first-exchange',
        payload,
      };
      const prepared = await prepareSyntheticDraftReview(args);
      Reflect.set(window, '__syntheticDraftReview', { args, prepared });
      return prepared.status === 'prepared'
        ? { status: prepared.status }
        : prepared;
    },
    { uid, worldId, payload: source.proposal }
  );
}
async function apply(
  page: Page,
  mode: 'review' | 'default' | 'forged' = 'review'
) {
  return page.evaluate(async (mode) => {
    const path = '/src/features/architect/utils/mutationPipeline.ts';
    const { applyWorldMutation } = await import(path);
    const { args, prepared } = Reflect.get(window, '__syntheticDraftReview');
    return applyWorldMutation({
      ...args,
      ...(mode === 'review'
        ? { draftReviewAuthority: prepared.authority }
        : mode === 'forged'
          ? {
              draftReviewAuthority: JSON.parse(
                JSON.stringify(prepared.authority)
              ),
              payload: {
                ...args.payload,
                draftPickReview: { apply: 'permitted' },
              },
            }
          : {}),
    });
  }, mode);
}
test('synthetic first-round review consumes components and persists through the existing mutation', async ({
  page,
}) => {
  const uid = await authenticate(page);
  expect(await prepare(page, uid, root)).toEqual({ status: 'prepared' });
  const before = await getWorldTeamDocument(root, 'BOS');
  const beforeAll = await savedState(root);
  const normal = await apply(page, 'default');
  expect(normal.success, JSON.stringify(normal)).toBe(false);
  expect(await getWorldEventDocuments(root)).toHaveLength(0);
  const forged = await apply(page, 'forged');
  expect(forged.success, JSON.stringify(forged)).toBe(false);
  expect(await savedState(root)).toEqual(beforeAll);
  // A real, publicly verified capability still cannot call the writer directly
  // or mint a result seal by instantiating its own gate.
  const directWriter = await page.evaluate(async () => {
    const capabilityPath =
      '/src/features/architect/utils/draftReview/capability.ts';
    const pipelinePath = '/src/features/architect/utils/mutationPipeline.ts';
    const gatePath = '/src/features/architect/utils/draftReview/commitGate.ts';
    const { verifyDraftReviewApply } = await import(capabilityPath);
    const { loadStateForMutation, persistWorldMutation } = await import(
      pipelinePath
    );
    const { createDraftReviewCommitGate } = await import(gatePath);
    const { args, prepared } = Reflect.get(window, '__syntheticDraftReview');
    const state = await loadStateForMutation(
      args.worldId,
      'executeTrade',
      args.payload
    );
    verifyDraftReviewApply(prepared.authority, {
      ...args,
      state,
      asOfDate: '2026-07-15',
    });
    const result = {
      worldId: args.worldId,
      seasonId: args.seasonId,
      mutationType: 'executeTrade',
      computeResult: {
        success: true,
        metadata: {},
        entitlementUpdates: [
          { entitlementId: 'review-BOS-2028-1', holderTeam: 'DEN' },
        ],
      },
      committedTeamUpdates: [],
      timestamp: Date.now(),
      auditContext: { operationId: args.operationId },
    };
    const denied = [];
    for (const token of [
      undefined,
      {},
      createDraftReviewCommitGate().seal(prepared.authority, result),
    ])
      denied.push(
        await persistWorldMutation({
          ...result,
          draftReviewAuthority: prepared.authority,
          draftReviewCommit: token,
        })
      );
    return denied;
  });
  for (const attempt of directWriter) {
    expect(attempt.success).toBe(false);
    expect(attempt.error).toContain('exact validated one-use result');
  }
  expect(await savedState(root)).toEqual(beforeAll);
  const result = await apply(page);
  expect(result.success, JSON.stringify(result)).toBe(true);
  const events = await getWorldEventDocuments(root);
  expect(events).toHaveLength(1);
  expect(JSON.stringify(events)).toContain('BOS 2028 first-round pick');
  const bos = await getWorldTeamDocument(root, 'BOS');
  const mia = await getWorldTeamDocument(root, 'MIA');
  expect(before?.entitlementIds).toContain('review-BOS-2028-1');
  expect(bos?.entitlementIds).not.toContain('review-BOS-2028-1');
  expect(bos?.entitlementIds).toContain('review-MIA-2028-2');
  expect(mia?.entitlementIds).toContain('review-BOS-2028-1');
  expect(mia?.entitlementIds).not.toContain('review-MIA-2028-2');
  const afterAll = await savedState(root);
  expect(afterAll.metadata?.stats.totalTrades).toBe(1);
  expect(
    afterAll.entitlements.find((e) => e.id === 'review-BOS-2028-1')?.data
      .holderTeam
  ).toBe('MIA');
  expect(
    afterAll.entitlements.find((e) => e.id === 'review-MIA-2028-2')?.data
      .holderTeam
  ).toBe('BOS');
  const retry = await apply(page);
  expect(retry.success).toBe(false);
  expect(await getWorldEventDocuments(root)).toHaveLength(1);
  expect(await savedState(root)).toEqual(afterAll);
  await page.evaluate(
    ({ uid, root }) => {
      localStorage.setItem(`architect.activeWorldId.${uid}`, root);
      localStorage.setItem('hz.currentSeasonEndYear', '2027');
    },
    { uid, root }
  );
  // Both pages observe the same committed world; no mutations occur in this phase.
  await Promise.all(
    (
      [
        ['BOS', bos],
        ['MIA', mia],
      ] as const
    ).map(async ([team, expected]) => {
      const teamPage = team === 'BOS' ? page : await page.context().newPage();
      try {
        await teamPage.goto(`/gm/${team}?season=2027`, {
          waitUntil: 'domcontentloaded',
        });
        await openDashboardTab(teamPage, 'Team History');
        await teamPage
          .getByTestId('team-history-section-timeline')
          .getByRole('button', { name: /Trade Executed:/ })
          .click();
        await expect(
          teamPage
            .getByTestId('team-history-detail-modal')
            .getByText('Sent by Boston Celtics: 2028 first-round pick', {
              exact: false,
            })
            .first()
        ).toBeVisible();
        await expect(
          teamPage.getByTestId('team-history-detail-modal')
        ).toContainText(
          'Received by Miami Heat: 2028 first-round pick · Boston Celtics'
        );
        await capture(teamPage, `${team.toLowerCase()}-history`);
        await teamPage
          .getByTestId('team-history-detail-modal')
          .getByRole('button', { name: /close/i })
          .click();
        await openDashboardTab(teamPage, 'Compare');
        await expect(
          teamPage.getByText('BOS 2028 first-round pick', { exact: true })
        ).toBeVisible();
        await expect(
          teamPage.getByText('MIA 2028 second-round pick', { exact: true })
        ).toBeVisible();
        await capture(teamPage, `${team.toLowerCase()}-compare`);
        await openDashboardTab(teamPage, 'Roster');
        await openDashboardTab(teamPage, 'Compare');
        await teamPage.reload({ waitUntil: 'domcontentloaded' });
        await openDashboardTab(teamPage, 'Compare');
        await expect(
          teamPage.getByText('BOS 2028 first-round pick', { exact: true })
        ).toBeVisible();
        await expect(
          teamPage.getByText('MIA 2028 second-round pick', { exact: true })
        ).toBeVisible();
        await capture(teamPage, `${team.toLowerCase()}-reload`);
        expect(await getWorldTeamDocument(root, team)).toEqual(expected);
      } finally {
        if (teamPage !== page) await teamPage.close();
      }
    })
  );
  // Every source collection stays empty: this proof never invokes the source seeder.
  const db = getReviewAdminDb();
  const sourceSnapshots = await Promise.all(
    [
      'players_v2',
      'architect_basePlayers',
      'architect_baseTeams',
      'architect_baseEntitlements',
      'architect_basePickRules',
    ].map((name) => db.collection(name).get())
  );
  for (const snapshot of sourceSnapshots) expect(snapshot.size).toBe(0);
  expect(await savedState(root)).toEqual(afterAll);
  retain('proof.json', {
    normal,
    forged,
    directWriter,
    result,
    retry,
    before: beforeAll,
    after: afterAll,
    bothTeamsLeftReturnedAndReloaded: true,
    sourceCollectionsEmpty: true,
  });
});

test('required component failures and stale reviews never write', async ({
  page,
}) => {
  const uid = await authenticate(page);
  const db = getReviewAdminDb();
  const cases = [];
  for (const variant of [
    'ownership',
    'stepien',
    'cash',
    'apron',
    'missing',
    'conflicting',
  ] as const) {
    const worldId = `${root}_${variant}`;
    const prepared = await prepare(page, uid, worldId, variant);
    expect(prepared.status, JSON.stringify(prepared)).toBe('blocked');
    const before = await savedState(worldId);
    const result = await apply(page);
    expect(result.success).toBe(false);
    expect(await savedState(worldId)).toEqual(before);
    expect(await getWorldEventDocuments(worldId)).toHaveLength(0);
    cases.push({ variant, prepared, result, unchanged: true });
  }
  for (const field of ['proposal', 'state', 'release', 'date'] as const) {
    const worldId = `${root}_stale_${field}`;
    expect((await prepare(page, uid, worldId)).status).toBe('prepared');
    if (field === 'proposal')
      await page.evaluate(() => {
        Reflect.get(
          window,
          '__syntheticDraftReview'
        ).args.payload.teams[0].entitlementsOut[0].toTeamId = 'DEN';
      });
    if (field === 'state')
      await db
        .doc(`architect_worlds/${worldId}/teams/BOS`)
        .update({ 'totals.teamSalary': 40000000 });
    if (field === 'release')
      await db
        .doc(`architect_worlds/${worldId}`)
        .update({ draftReviewReleaseId: 'stale-release' });
    if (field === 'date')
      await db
        .doc(`architect_worlds/${worldId}`)
        .update({ asOfDate: '2026-07-16' });
    const before = await savedState(worldId);
    const result = await apply(page);
    expect(result.success).toBe(false);
    expect(await savedState(worldId)).toEqual(before);
    expect(await getWorldEventDocuments(worldId)).toHaveLength(0);
    cases.push({ stale: field, result, unchanged: true });
  }
  retain('negative-proof.json', cases);
});

test('an actual denied final metadata write rolls back every queued trade write', async ({
  page,
}) => {
  const uid = await authenticate(page);
  const worldId = `${root}_atomic_failure`;
  expect((await prepare(page, uid, worldId)).status).toBe('prepared');
  const db = getReviewAdminDb();
  const paths = [
    `architect_worlds/${worldId}`,
    `architect_worlds/${worldId}/teams/BOS`,
    `architect_worlds/${worldId}/teams/MIA`,
    `architect_worlds/${worldId}/entitlements/review-BOS-2028-1`,
    `architect_worlds/${worldId}/entitlements/review-MIA-2028-2`,
  ];
  const before = await Promise.all(
    paths.map(async (p) => (await db.doc(p).get()).data())
  );
  const originalRules = fs.readFileSync('firestore.rules', 'utf8');
  const anchor = 'allow update: if isWorldMetadataOwner()';
  expect(originalRules.split(anchor)).toHaveLength(2);
  // Fault injection belongs only to this local emulator's rule configuration;
  // production code and all other write rules are unchanged. Reads still pass.
  const deniedRules = originalRules.replace(
    anchor,
    `${anchor} && worldId != '${worldId}'`
  );
  const configure = async (rules: string) => {
    const environment = await initializeTestEnvironment({
      projectId: 'demo-architect-review',
      firestore: { host: '127.0.0.1', port: 8082, rules },
    });
    await environment.cleanup();
  };
  await configure(deniedRules);
  let result;
  try {
    result = await apply(page);
  } finally {
    await configure(originalRules);
  }
  expect(result.success, JSON.stringify(result)).toBe(false);
  expect(result.appliedToLocalState).toBe(true); // compute and all validation gates succeeded
  expect(result.persistedToWorld).toBe(false);
  expect(String(result.error)).toMatch(
    /permission|denied|insufficient|evaluation error|false for 'update'/i
  );
  expect(
    await Promise.all(paths.map(async (p) => (await db.doc(p).get()).data()))
  ).toEqual(before);
  expect(await getWorldEventDocuments(worldId)).toHaveLength(0);
  retain('atomic-proof.json', {
    result,
    deniedFinalMetadataUpdate: true,
    allQueuedWritesRolledBack: true,
    events: 0,
  });
});

// The extra economic claim is absent from every consumed-document snapshot.
// A collection fence must deny its unfenced write or reject the stale commit.
test('inventory membership cannot change invisibly after review', async ({
  page,
}) => {
  const uid = await authenticate(page);
  const worldId = `${root}_membership_unfenced`;
  expect((await prepare(page, uid, worldId)).status).toBe('prepared');
  const before = await savedState(worldId);
  const environment = await initializeTestEnvironment({
    projectId: 'demo-architect-review',
    firestore: { host: '127.0.0.1', port: 8082 },
  });
  const owner = environment.authenticatedContext(uid).firestore();
  let addition: { written: boolean; error?: string };
  try {
    await owner
      .doc(`architect_worlds/${worldId}/entitlements/competing-original-first`)
      .set({
        id: 'competing-original-first',
        kind: 'pick_ownership',
        holderTeam: 'DEN',
        originalTeam: 'BOS',
        seasonYear: 2028,
        round: 1,
        underlyingPickId: 'BOS_2028_1st',
      });
    addition = { written: true };
  } catch (error) {
    addition = { written: false, error: String(error) };
  } finally {
    await environment.cleanup();
  }
  if (addition.written) {
    const afterAddition = await savedState(worldId);
    const result = await apply(page);
    expect(
      result.success,
      JSON.stringify({ addition, success: result.success, error: result.error })
    ).toBe(false);
    expect(await savedState(worldId)).toEqual(afterAddition);
  } else {
    expect(addition.error).toMatch(
      /permission|denied|insufficient|evaluation error/i
    );
    expect(await savedState(worldId)).toEqual(before);
    expect((await apply(page)).success).toBe(true);
  }
  retain('membership-unfenced-proof.json', { addition, protected: true });
});

// Every client API (including raw owner SDK writes) reaches these same rules.
test('inventory membership changes advance the fence or fail atomically', async ({
  page,
}) => {
  const uid = await authenticate(page);
  const environment = await initializeTestEnvironment({
    projectId: 'demo-architect-review',
    firestore: { host: '127.0.0.1', port: 8082 },
  });
  const owner = environment.authenticatedContext(uid).firestore();
  const cases = [];
  try {
    for (const kind of [
      'addition',
      'removal',
      'reassignment',
      'team-addition',
      'team-removal',
      'team-inventory',
      'event-addition',
    ]) {
      const worldId = `${root}_fence_${kind}`;
      expect((await prepare(page, uid, worldId)).status).toBe('prepared');
      const world = owner.doc(`architect_worlds/${worldId}`);
      const before = await savedState(worldId);
      const queue = (batch: ReturnType<typeof owner.batch>) => {
        const claim = world.collection('entitlements').doc('review-BOS-2028-1');
        if (kind === 'addition')
          batch.set(world.collection('entitlements').doc('extra'), {
            ...before.entitlements.find((e) => e.id === 'review-BOS-2028-1')!
              .data,
            id: 'extra',
            holderTeam: 'DEN',
          });
        if (kind === 'removal') batch.delete(claim);
        if (kind === 'reassignment') batch.update(claim, { holderTeam: 'DEN' });
        if (kind === 'team-addition')
          batch.set(world.collection('teams').doc('XXX'), {
            entitlementIds: ['extra'],
          });
        if (kind === 'team-removal')
          batch.delete(world.collection('teams').doc('DEN'));
        if (kind === 'team-inventory')
          batch.update(world.collection('teams').doc('DEN'), {
            entitlementIds: ['extra'],
          });
        if (kind === 'event-addition')
          batch.set(world.collection('events').doc('extra'), {
            mutationType: 'executeTrade',
          });
      };
      const denied = owner.batch();
      queue(denied);
      await expect(denied.commit()).rejects.toThrow(
        /permission|denied|evaluation/i
      );
      expect(await savedState(worldId)).toEqual(before);
      const admitted = owner.batch();
      queue(admitted);
      admitted.update(world, { draftInventoryRevision: 1 });
      await admitted.commit();
      const changed = await savedState(worldId);
      expect(changed.metadata?.draftInventoryRevision).toBe(1);
      const result = await apply(page);
      expect(result.success, `${kind}: ${result.error}`).toBe(false);
      expect(await savedState(worldId)).toEqual(changed);
      // A client cannot remove, rewind, skip, or replace the fence's type.
      for (const revision of [0, 3, '1', null]) {
        await expect(
          world.update({ draftInventoryRevision: revision })
        ).rejects.toThrow(/permission|denied|evaluation/i);
      }
      await expect(
        world.update({ draftInventoryRevision: deleteField() })
      ).rejects.toThrow(/permission|denied|evaluation/i);
      expect(await savedState(worldId)).toEqual(changed);
      cases.push({
        kind,
        unfencedDenied: true,
        revision: 1,
        staleCommitRejected: true,
        noPartialWrites: true,
      });
    }
  } finally {
    await environment.cleanup();
  }
  retain('membership-changes-proof.json', cases);
});

test('inventory membership is fenced after transaction reads and unchanged retries succeed', async ({
  page,
}) => {
  const uid = await authenticate(page);
  const environment = await initializeTestEnvironment({
    projectId: 'demo-architect-review',
    firestore: { host: '127.0.0.1', port: 8082 },
  });
  const owner = environment.authenticatedContext(uid).firestore();
  const cases = [];
  try {
    for (const kind of ['membership-race', 'unchanged-retry'] as const) {
      const worldId = `${root}_${kind}`;
      expect((await prepare(page, uid, worldId)).status).toBe('prepared');
      let intercepted = 0;
      let afterIntervention: Awaited<ReturnType<typeof savedState>> | undefined;
      await page.route(/documents:commit(?:\?|$)/, async (route) => {
        const body = route.request().postData() || '';
        if (
          !body.includes('draft_review_synthetic-first-exchange') ||
          intercepted++
        ) {
          await route.continue();
          return;
        }
        // Actual final Commit RPC: all SDK transaction reads have completed.
        if (kind === 'membership-race') {
          const batch = owner.batch();
          const world = owner.doc(`architect_worlds/${worldId}`);
          batch.set(world.collection('entitlements').doc('post-read-claim'), {
            id: 'post-read-claim',
            kind: 'pick_ownership',
            holderTeam: 'DEN',
            originalTeam: 'BOS',
            seasonYear: 2028,
            round: 1,
            underlyingPickId: 'BOS_2028_1st',
          });
          batch.update(world, { draftInventoryRevision: 1 });
          await batch.commit();
          afterIntervention = await savedState(worldId);
          await route.continue();
        } else {
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              error: {
                code: 409,
                status: 'ABORTED',
                message: 'BZE-318 unchanged transaction retry probe',
              },
            }),
          });
        }
      });
      let result;
      try {
        result = await apply(page);
      } finally {
        await page.unroute(/documents:commit(?:\?|$)/);
      }
      expect(intercepted).toBeGreaterThan(0);
      expect(result.appliedToLocalState).toBe(true);
      if (kind === 'membership-race') {
        expect(result.success, result.error).toBe(false);
        expect(result.error).toContain('changed before commit');
        expect(await savedState(worldId)).toEqual(afterIntervention);
      } else {
        expect(result.success, result.error).toBe(true);
        expect(intercepted).toBe(2);
        const after = await savedState(worldId);
        expect(after.events).toHaveLength(1);
        expect(after.metadata?.stats.totalTrades).toBe(1);
        expect(after.metadata?.draftInventoryRevision).toBe(1);
        expect((await apply(page)).success).toBe(false);
        expect(await savedState(worldId)).toEqual(after);
      }
      cases.push({
        kind,
        intercepted,
        success: result.success,
        error: result.error ?? null,
        noPartialWrites: true,
      });
    }
  } finally {
    await environment.cleanup();
  }
  retain('membership-commit-race-proof.json', cases);
});

test('inventory membership competing reviews transfer one economic right only once', async ({
  page,
}) => {
  const uid = await authenticate(page);
  const worldId = `${root}_competing`;
  expect((await prepare(page, uid, worldId)).status).toBe('prepared');
  const results = await page.evaluate(async () => {
    const capabilityPath =
      '/src/features/architect/utils/draftReview/capability.ts';
    const pipelinePath = '/src/features/architect/utils/mutationPipeline.ts';
    const { prepareSyntheticDraftReview } = await import(capabilityPath);
    const { applyWorldMutation } = await import(pipelinePath);
    const { args, prepared } = Reflect.get(window, '__syntheticDraftReview');
    const competingArgs = { ...args, operationId: 'competing-first-exchange' };
    const competing = await prepareSyntheticDraftReview(competingArgs);
    if (competing.status !== 'prepared')
      throw new Error('Competing review must be initially valid');
    const results = await Promise.all([
      applyWorldMutation({ ...args, draftReviewAuthority: prepared.authority }),
      applyWorldMutation({
        ...competingArgs,
        draftReviewAuthority: competing.authority,
      }),
    ]);
    return results.map((r) => ({ success: r.success, error: r.error ?? null }));
  });
  expect(results.filter((r) => r.success)).toHaveLength(1);
  const after = await savedState(worldId);
  expect(after.events).toHaveLength(1);
  expect(after.metadata?.stats.totalTrades).toBe(1);
  expect(after.metadata?.draftInventoryRevision).toBe(1);
  expect(
    after.entitlements.find((e) => e.id === 'review-BOS-2028-1')?.data
      .holderTeam
  ).toBe('MIA');
  retain('membership-competing-proof.json', {
    results,
    trades: 1,
    revision: 1,
  });
});

test('inventory membership fence also stops the owner-callable Admin purge', async ({
  page,
}) => {
  const uid = await authenticate(page);
  const worldId = `${root}_purge`;
  expect((await prepare(page, uid, worldId)).status).toBe('prepared');
  const before = await savedState(worldId);
  const result = await page.evaluate(async (worldId) => {
    const modulePath = '/src/features/architect/utils/worldManager.ts';
    const { purgeWorld } = await import(modulePath);
    try {
      return { result: await purgeWorld(worldId) };
    } catch (error) {
      return { error: String(error) };
    }
  }, worldId);
  expect(result.error).toContain('Inventory-fenced review worlds');
  expect(await savedState(worldId)).toEqual(before);
  retain('membership-admin-purge-proof.json', { result, unchanged: true });
});
