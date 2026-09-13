import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
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
test.setTimeout(180000);
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
  await page.goto('/gm/BOS?season=2027');
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
  for (const [team, expected] of [
    ['BOS', bos],
    ['MIA', mia],
  ] as const) {
    await page.goto(`/gm/${team}?season=2027`);
    await openDashboardTab(page, 'Team History');
    await page
      .getByTestId('team-history-section-timeline')
      .getByRole('button', { name: /Trade Executed:/ })
      .click();
    await expect(
      page
        .getByTestId('team-history-detail-modal')
        .getByText('Sent by Boston Celtics: 2028 first-round pick', {
          exact: false,
        })
        .first()
    ).toBeVisible();
    await expect(page.getByTestId('team-history-detail-modal')).toContainText(
      'Received by Miami Heat: 2028 first-round pick · Boston Celtics'
    );
    await capture(page, `${team.toLowerCase()}-history`);
    await page
      .getByTestId('team-history-detail-modal')
      .getByRole('button', { name: /close/i })
      .click();
    await openDashboardTab(page, 'Compare');
    await expect(
      page.getByText('BOS 2028 first-round pick', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText('MIA 2028 second-round pick', { exact: true })
    ).toBeVisible();
    await capture(page, `${team.toLowerCase()}-compare`);
    await openDashboardTab(page, 'Roster');
    await openDashboardTab(page, 'Compare');
    await page.reload();
    await openDashboardTab(page, 'Compare');
    await expect(
      page.getByText('BOS 2028 first-round pick', { exact: true })
    ).toBeVisible();
    await capture(page, `${team.toLowerCase()}-reload`);
    expect(await getWorldTeamDocument(root, team)).toEqual(expected);
  }
  // Every source collection stays empty: this proof never invokes the source seeder.
  const db = getReviewAdminDb();
  for (const name of [
    'players_v2',
    'architect_basePlayers',
    'architect_baseTeams',
    'architect_baseEntitlements',
    'architect_basePickRules',
  ])
    expect((await db.collection(name).get()).size).toBe(0);
  expect(await savedState(root)).toEqual(afterAll);
  retain('proof.json', {
    normal,
    forged,
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
