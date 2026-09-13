import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { seedSyntheticDraftSeasonWorld } from './fixtures/syntheticDraftSeasonWorld';
import {
  getReviewAdminDb,
  readReviewUserId,
  openDashboardTab,
} from './helpers/architectReviewWorld';
import { DraftReviewSeasonReceiptZ } from '@/schemas/draftReviewSeason';
// Persisted salary books are plain JSON. Import the pure digest without the
// application contract-source barrel (which initializes Firebase in Node).
import { deterministicStateDigest as mutationSnapshotDigest } from '@/features/architect/utils/contractSource/deterministicDigest';
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
} from '@/constants/collections';

test.use({
  viewport: { width: 1280, height: 720 },
  trace: 'on',
  ...(process.env.SCOUTZERO_SEASON_CONTINUATION === 'true'
    ? {
        storageState: path.join(
          process.env.SCOUTZERO_BROWSER_PROOF_DIR!,
          'browser-state.json'
        ),
      }
    : {}),
});
test.setTimeout(200000);
const worldId = 'world_synthetic_draft_season';
const transitionId = 'seasonAdvance__2025-26__2026-27';
const proofDir =
  process.env.SCOUTZERO_BROWSER_PROOF_DIR ||
  'tmp/browser-proofs/draft-season-diagnostic';
function retain(name: string, proof: unknown) {
  fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(
    path.join(proofDir, name),
    JSON.stringify(
      {
        candidate:
          process.env.SCOUTZERO_PROOF_CANDIDATE || 'unfrozen-diagnostic',
        scope: 'synthetic-review-only',
        proof,
      },
      null,
      2
    )
  );
}
async function capture(page: Page, name: string) {
  fs.mkdirSync(proofDir, { recursive: true });
  await page.screenshot({
    path: path.join(proofDir, `${name}-1280x720.png`),
    fullPage: false,
  });
}
async function savedState(id: string) {
  const root = getReviewAdminDb()
    .collection(ARCHITECT_WORLDS_COLLECTION)
    .doc(id);
  const collections = [
    ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
    ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
    ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
    'seasonHistory',
    'seasonTransitions',
  ];
  const snapshots = await Promise.all(
    collections.map((name) => root.collection(name).get())
  );
  return {
    metadata: (await root.get()).data(),
    ...Object.fromEntries(
      snapshots.map((snapshot, i) => [
        collections[i],
        snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() })),
      ])
    ),
  } as {
    metadata: Record<string, any>;
    teams: { id: string; data: Record<string, any> }[];
    entitlements: { id: string; data: Record<string, any> }[];
    events: { id: string; data: Record<string, any> }[];
    seasonHistory: { id: string; data: Record<string, any> }[];
    seasonTransitions: { id: string; data: Record<string, any> }[];
  };
}
async function prepare(page: Page, id = worldId) {
  console.info('draft-season: authenticate', id, new Date().toISOString());
  await page.goto('/gm/BOS?season=2027', { waitUntil: 'domcontentloaded' });
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  const uid = await readReviewUserId(page);
  const source = await seedSyntheticDraftSeasonWorld(uid, id);
  console.info('draft-season: seeded; preparing', id, new Date().toISOString());
  await page.evaluate(
    async ({ uid, id, payload }) => {
      const modulePath =
        '/src/features/architect/utils/draftReview/seasonCapability.ts';
      const { prepareSyntheticDraftSeasonReview } = await import(modulePath);
      const authority = await prepareSyntheticDraftSeasonReview({
        userId: uid,
        worldId: id,
        operationId: 'synthetic-season-advance',
      });
      Reflect.set(window, '__draftSeasonReview', {
        uid,
        id,
        payload,
        authority,
      });
    },
    { uid, id, payload: source.proposal }
  );
  console.info('draft-season: prepared', id, new Date().toISOString());
  return uid;
}
async function advance(
  page: Page,
  mode: 'review' | 'default' | 'forged' = 'review'
) {
  return page.evaluate(async (mode) => {
    const modulePath = '/src/features/architect/utils/seasonManager.ts';
    const { advanceSeasonInWorld } = await import(modulePath);
    const { id, authority } = Reflect.get(window, '__draftSeasonReview');
    return advanceSeasonInWorld(
      id,
      mode === 'default'
        ? {}
        : {
            draftReviewAuthority:
              mode === 'forged'
                ? JSON.parse(JSON.stringify(authority))
                : authority,
            focusTeamCode: 'BOS',
          }
    );
  }, mode);
}
test('season record persists with all thirty histories and exact reload', async ({
  page,
}) => {
  const uid = await prepare(page);
  const before = await savedState(worldId);
  const result = await advance(page);
  console.info('draft-season: advance returned', new Date().toISOString());
  expect(result.success, JSON.stringify(result)).toBe(true);
  expect(result.persistenceConfirmed).toBe(true);
  const advanced = await savedState(worldId);
  expect(advanced.entitlements).toEqual(before.entitlements);
  expect(advanced.teams).toHaveLength(30);
  expect(advanced.seasonHistory).toHaveLength(30);
  expect(advanced.seasonTransitions).toHaveLength(1);
  const seasonEvent = advanced.events[0].data;
  const receipt = DraftReviewSeasonReceiptZ.parse(
    seasonEvent.metadata.draftReviewSeasonReceipt
  );
  expect(
    receipt.freezeEvents
      .filter((e) => e.freezeTriggered)
      .map((e) => e.originalPick.id)
  ).toEqual(['BOS_2033_1st']);
  for (const team of advanced.teams) {
    expect(team.data.entitlementIds).toEqual(
      before.teams.find((t) => t.id === team.id)!.data.entitlementIds
    );
    const history = advanced.seasonHistory.find(
      (h) => h.id === `2025-26__${team.id}`
    )!.data;
    expect(history.draftReviewFreezeEvent).toEqual(
      receipt.freezeEvents.find((e) => e.originalPick.originalTeam === team.id)
    );
    expect(history.afterTotals).toEqual(team.data.totals);
    expect(receipt.salaryBookHistory[team.id]).toEqual({
      historyId: history.historyId,
      beforeTotalsDigest: mutationSnapshotDigest(history.beforeTotals),
      afterTotalsDigest: mutationSnapshotDigest(history.afterTotals),
    });
    for (const book of ['teamSalary', 'apronTeamSalary', 'taxSalary']) {
      expect(seasonEvent.beforeTotalsByTeam[team.id][book]).toBe(
        history.beforeTotals[book]
      );
      expect(seasonEvent.afterTotalsByTeam[team.id][book]).toBe(
        history.afterTotals[book]
      );
    }
  }
  expect((await advance(page)).success).toBe(false);
  expect(await savedState(worldId)).toEqual(advanced);
  const payload = await page.evaluate(
    () => Reflect.get(window, '__draftSeasonReview').payload
  );
  retain('season-proof.json', { uid, payload, result, before, advanced });
  await page
    .context()
    .storageState({
      path: path.join(proofDir, 'browser-state.json'),
      indexedDB: true,
    });
});

test('season continuation trades the persisted world and reloads both teams', async ({
  page,
}) => {
  // This phase consumes the preceding real emulator writes. It never seeds or
  // imports an advanced fixture, and cannot accept a different candidate/state.
  const checkpoint = JSON.parse(
    fs.readFileSync(path.join(proofDir, 'season-proof.json'), 'utf8')
  );
  expect(checkpoint.candidate).toBe(
    process.env.SCOUTZERO_PROOF_CANDIDATE || 'unfrozen-diagnostic'
  );
  const { uid, payload, result, before, advanced } = checkpoint.proof;
  expect(await savedState(worldId)).toEqual(advanced);
  await page.goto('/gm/BOS?season=2027', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => readReviewUserId(page)).toBe(uid);
  await page.evaluate(
    ({ uid, id, payload }) => {
      Reflect.set(window, '__draftSeasonReview', { uid, id, payload });
    },
    { uid, id: worldId, payload }
  );
  const trade = await page.evaluate(async () => {
    const { uid, id, payload } = Reflect.get(window, '__draftSeasonReview');
    const capabilityPath =
      '/src/features/architect/utils/draftReview/capability.ts';
    const pipelinePath = '/src/features/architect/utils/mutationPipeline.ts';
    const { prepareSyntheticDraftReview } = await import(capabilityPath);
    const { applyWorldMutation } = await import(pipelinePath);
    const args = {
      userId: uid,
      worldId: id,
      seasonId: '2026-27',
      operationId: 'synthetic-season-first-exchange',
      mutationType: 'executeTrade',
      payload,
    };
    const prepared = await prepareSyntheticDraftReview(args);
    if (prepared.status !== 'prepared') return { prepared };
    const normal = await applyWorldMutation(args);
    const applied = await applyWorldMutation({
      ...args,
      draftReviewAuthority: prepared.authority,
    });
    const retry = await applyWorldMutation({
      ...args,
      draftReviewAuthority: prepared.authority,
    });
    return { prepared: { status: prepared.status }, normal, applied, retry };
  });
  console.info('draft-season: trade returned', new Date().toISOString());
  expect(trade.prepared.status).toBe('prepared');
  expect(trade.normal!.success).toBe(false);
  expect(trade.applied!.success, JSON.stringify(trade.applied)).toBe(true);
  expect(trade.retry!.success).toBe(false);
  const after = await savedState(worldId);
  expect(after.events).toHaveLength(2);
  expect(after.seasonHistory).toEqual(advanced.seasonHistory);
  expect(
    after.entitlements.find((e) => e.id === 'review-BOS-2028-1')!.data
      .holderTeam
  ).toBe('MIA');
  expect(
    after.entitlements.find((e) => e.id === 'review-MIA-2028-2')!.data
      .holderTeam
  ).toBe('BOS');
  await page.evaluate(
    ({ uid, worldId }) => {
      localStorage.setItem(`architect.activeWorldId.${uid}`, worldId);
      localStorage.setItem('hz.currentSeasonEndYear', '2027');
    },
    { uid, worldId }
  );
  await Promise.all(
    ['BOS', 'MIA'].map(async (team) => {
      const view = team === 'BOS' ? page : await page.context().newPage();
      try {
        await view.goto(`/gm/${team}?season=2027`, {
          waitUntil: 'domcontentloaded',
        });
        await openDashboardTab(view, 'Team History');
        await view
          .getByTestId('team-history-section-timeline')
          .getByRole('button', { name: /Season Advance/ })
          .click();
        const detail = view.getByTestId('team-history-detail-modal');
        await expect(detail).toContainText('2033 first-round pick');
        await expect(detail).not.toContainText('No event-specific');
        await expect(detail).toContainText(
          team === 'BOS' ? 'freeze triggered' : 'freeze not triggered'
        );
        const disclosure = detail
          .getByRole('listitem')
          .filter({
            hasText:
              'Synthetic review only. Later restriction changes and trading availability are not established by this record.',
          });
        await disclosure.scrollIntoViewIfNeeded();
        await expect(disclosure).toBeVisible();
        await expect(
          detail.getByText('Draft Pick Season Record', { exact: true })
        ).toBeVisible();
        await capture(view, `${team.toLowerCase()}-history`);
        await detail.getByRole('button', { name: /close/i }).click();
        await openDashboardTab(view, 'Compare');
        await expect(
          view.getByText('BOS 2028 first-round pick', { exact: true })
        ).toBeVisible();
        await expect(
          view.getByText('MIA 2028 second-round pick', { exact: true })
        ).toBeVisible();
        await capture(view, `${team.toLowerCase()}-compare`);
        await openDashboardTab(view, 'Roster');
        await openDashboardTab(view, 'Compare');
        await view.reload({ waitUntil: 'domcontentloaded' });
        await openDashboardTab(view, 'Compare');
        await expect(
          view.getByText('BOS 2028 first-round pick', { exact: true })
        ).toBeVisible();
        await capture(view, `${team.toLowerCase()}-reload`);
        console.info(
          'draft-season: team reloaded',
          team,
          new Date().toISOString()
        );
      } finally {
        if (view !== page) await view.close();
      }
    })
  );
  expect(await savedState(worldId)).toEqual(after);
  for (const collection of [
    'players_v2',
    'architect_basePlayers',
    'architect_baseTeams',
    'architect_baseEntitlements',
    'architect_basePickRules',
  ])
    expect((await getReviewAdminDb().collection(collection).get()).size).toBe(
      0
    );
  retain('proof.json', {
    result,
    trade,
    before,
    advanced,
    after,
    all30Preserved: true,
    bothTeamsReloaded: true,
    sourceCollectionsEmpty: true,
  });
});

test('season review rejects forged and stale supplied inputs without writes', async ({
  page,
}) => {
  const results = [];
  for (const kind of [
    'default',
    'forged',
    'team',
    'entitlement',
    'date',
    'release',
  ] as const) {
    const id = `${worldId}_${kind}`;
    await prepare(page, id);
    const db = getReviewAdminDb();
    const root = db.collection(ARCHITECT_WORLDS_COLLECTION).doc(id);
    if (kind === 'team')
      await root
        .collection(ARCHITECT_WORLD_TEAMS_SUBCOLLECTION)
        .doc('BOS')
        .update({
          'salaryBookInputs.seasonCloseApronMeasurement.apronTeamSalary': 1,
        });
    if (kind === 'entitlement')
      await root
        .collection(ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION)
        .doc('review-BOS-2033-1')
        .update({ holderTeam: 'MIA' });
    if (kind === 'date') await root.update({ asOfDate: '2026-04-11' });
    if (kind === 'release')
      await root.update({ draftReviewReleaseText: 'forged-permission' });
    const before = await savedState(id);
    const result = await advance(
      page,
      kind === 'default' || kind === 'forged' ? kind : 'review'
    );
    expect(result.success, `${kind}: ${JSON.stringify(result)}`).toBe(false);
    expect(await savedState(id)).toEqual(before);
    results.push({ kind, result });
  }
  retain('negative-proof.json', results);
});

test('season denied final metadata write leaves no partial history or freeze record', async ({
  page,
}) => {
  const id = `${worldId}_atomic`;
  await prepare(page, id);
  const before = await savedState(id);
  const originalRules = fs.readFileSync('firestore.rules', 'utf8');
  const anchor = 'allow update: if isWorldMetadataOwner()';
  expect(originalRules.split(anchor)).toHaveLength(2);
  const configure = async (rules: string) => {
    const env = await initializeTestEnvironment({
      projectId: 'demo-architect-review',
      firestore: { host: '127.0.0.1', port: 8082, rules },
    });
    await env.cleanup();
  };
  await configure(
    originalRules.replace(anchor, `${anchor} && worldId != '${id}'`)
  );
  let result;
  try {
    result = await advance(page);
  } finally {
    await configure(originalRules);
  }
  expect(result.success).toBe(false);
  expect(String(result.error)).toMatch(
    /permission|denied|insufficient|evaluation error|false for 'update'/i
  );
  expect(await savedState(id)).toEqual(before);
  retain('atomic-proof.json', { result, before, after: await savedState(id) });
});
