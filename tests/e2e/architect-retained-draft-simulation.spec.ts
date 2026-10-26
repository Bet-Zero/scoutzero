import { test, expect, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { loadSnapshot, coverage } from '../../scripts/dev/cloudData';
import { seedRetainedDraftSimulation } from './fixtures/retainedDraftSimulationWorld';
import {
  readReviewUserId,
  getReviewAdminDb,
  getWorldTeamDocument,
  getWorldEventDocuments,
  openDashboardTab,
} from './helpers/architectReviewWorld';

test.use({ viewport: { width: 1280, height: 720 }, trace: 'on' });
test.setTimeout(220000);
const chi = 'ent:CHI:2028:1:own:2afbfb42';
const tor = 'ent:TOR:2029:1:own:d3e27549';
const proofDir =
  process.env.SCOUTZERO_BROWSER_PROOF_DIR ?? 'tmp/retained-simulation';
async function state(id: string) {
  const ref = getReviewAdminDb().doc(`architect_worlds/${id}`);
  return {
    metadata: (await ref.get()).data(),
    children: await Promise.all(
      ['teams', 'entitlements', 'events'].map(async (name) => ({
        name,
        docs: (await ref.collection(name).get()).docs.map((d) => ({
          id: d.id,
          data: d.data(),
        })),
      }))
    ),
  };
}
async function login(page: Page) {
  await page.goto('/gm/CHI?season=2026');
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  return readReviewUserId(page);
}
async function pick(
  page: Page,
  card: Locator,
  year: number,
  destination: string
) {
  await card.getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i }).click();
  const row = card
    .getByText(`${year} - Round 1`, { exact: true })
    .locator('xpath=ancestor::div[.//button[normalize-space()="•••"]][1]');
  await row.getByRole('button', { name: '•••' }).click();
  await page
    .getByRole('button', { name: new RegExp(`^Trade to ${destination}$`) })
    .click();
}
async function capture(page: Page, name: string) {
  fs.mkdirSync(proofDir, { recursive: true });
  await page.screenshot({ path: path.join(proofDir, `${name}-1280x720.png`) });
}
async function prepare(
  page: Page,
  uid: string,
  worldId: string,
  ids = [chi, tor]
) {
  const docs = await Promise.all(
    ids.map(async (id) =>
      (
        await getReviewAdminDb()
          .doc(`architect_worlds/${worldId}/entitlements/${id}`)
          .get()
      ).data()
    )
  );
  return page.evaluate(
    async ({ uid, worldId, ids, docs }) => {
      const path =
        '/src/features/architect/utils/draftReview/simulationPreview.ts';
      const { previewRetainedDraftSimulation } = await import(path);
      const termsPath =
        '/src/features/architect/utils/entitlements/entitlementTerms.ts';
      const { decorateEntitlementForTrade } = await import(termsPath);
      const teams = await Promise.all(
        ['CHI', 'TOR'].map(async (teamCode, i) => {
          const outgoing = [
            {
              ...decorateEntitlementForTrade(docs[i]),
              entitlementId: ids[i],
              id: ids[i],
              toTeamId: i ? 'CHI' : 'TOR',
            },
          ];
          return {
            teamCode,
            sends: [],
            picksOut: [],
            outgoingEntitlements: outgoing,
            entitlementsOut: outgoing,
            salaryMatchingElection: null,
            cashSent: 0,
            cashToTeamId: null,
          };
        })
      );
      const args = {
        userId: uid,
        worldId,
        mutationType: 'executeTrade',
        seasonId: '2025-26',
        operationId: `simulation_${crypto.randomUUID()}`,
        payload: {
          teams,
          asOfDate: '2026-06-05',
          tradeCtx: {
            source: 'tradeMachine',
            worldId,
            yearKey: 2026,
            asOfDate: '2026-06-05',
          },
        },
      };
      const result = await previewRetainedDraftSimulation(args);
      Reflect.set(window, '__retainedSimulation', { args, result });
      return result.status === 'prepared'
        ? {
            status: result.status,
            legal: result.preview.legal,
            reason: result.preview.reason,
          }
        : result;
    },
    { uid, worldId, ids, docs }
  );
}
async function apply(
  page: Page,
  mode: 'valid' | 'forged' | 'changed' = 'valid'
) {
  return page.evaluate(async (mode) => {
    const path = '/src/features/architect/utils/mutationPipeline.ts';
    const { applyWorldMutation } = await import(path);
    const { args, result } = Reflect.get(window, '__retainedSimulation');
    return applyWorldMutation({
      ...args,
      ...(mode === 'changed'
        ? { payload: { ...args.payload, asOfDate: '2026-06-06' } }
        : {}),
      draftReviewAuthority:
        mode === 'forged' ? { ...result.authority } : result.authority,
    });
  }, mode);
}

test('retained catalogue -> actual Trade Machine -> both-team saved state, receipts, History, Compare and reload', async ({
  page,
}) => {
  const uid = await login(page);
  const worldId = `world_retained_simulation_${uid}`;
  const catalogue = await seedRetainedDraftSimulation(uid, worldId);
  const before = await state(worldId);
  expect(
    before.children.find((c) => c.name === 'entitlements')!.docs
  ).toHaveLength(278);
  expect(before.metadata?.draftSimulationUnresolved).toEqual(
    catalogue.data.unresolved
  );
  const actualSource = await loadSnapshot();
  const declaredSource = process.env.SCOUTZERO_DRAFT_SIMULATION_BASELINE;
  if (declaredSource)
    expect(
      coverage(JSON.parse(fs.readFileSync(declaredSource, 'utf8'))).sha256
    ).toBe(coverage(actualSource).sha256);
  const sourceBefore = (
    await getReviewAdminDb().collection('architect_baseEntitlements').get()
  ).docs.map((d) => ({ id: d.id, data: d.data() }));
  await page.evaluate(
    ({ uid, worldId }) => {
      localStorage.setItem(`architect.activeWorldId.${uid}`, worldId);
      localStorage.setItem('hz.currentSeasonEndYear', '2026');
    },
    { uid, worldId }
  );
  await page.reload();
  await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  await expect(dialog.getByTestId('trade-team-card-CHI')).toBeVisible({
    timeout: 30000,
  });
  const picker = dialog
    .locator('label', { hasText: /^Select Team$/ })
    .locator('xpath=following-sibling::select[1]');
  if ((await picker.count()) === 0)
    await dialog.getByRole('button', { name: /^Add Team$/ }).click();
  await picker.first().selectOption('raptors');
  await expect(
    dialog.getByRole('region', { name: 'Draft simulation assumptions' })
  ).toContainText('not verified NBA');
  await pick(
    page,
    dialog.getByTestId('trade-team-card-CHI'),
    2028,
    'Toronto Raptors'
  );
  await pick(
    page,
    dialog.getByTestId('trade-team-card-TOR'),
    2029,
    'Chicago Bulls'
  );
  await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
  await expect(
    dialog.getByRole('button', { name: /^Apply Trade$/i })
  ).toBeEnabled({ timeout: 30000 });
  await capture(page, 'permitted-proposal');
  await dialog.getByRole('button', { name: /^Apply Trade$/i }).click();
  await expect
    .poll(async () => (await getWorldEventDocuments(worldId)).length, {
      timeout: 30000,
    })
    .toBe(1);
  const after = await state(worldId);
  const events = await getWorldEventDocuments(worldId);
  expect(JSON.stringify(events)).toContain('governed-simulation-only');
  expect(JSON.stringify(events)).toContain('CHI 2028 first-round pick');
  expect(JSON.stringify(events)).toContain('TOR 2029 first-round pick');
  const ents = after.children.find((c) => c.name === 'entitlements')!.docs;
  expect(ents).toHaveLength(278);
  expect(ents.find((e) => e.id === chi)?.data.holderTeam).toBe('TOR');
  expect(ents.find((e) => e.id === tor)?.data.holderTeam).toBe('CHI');
  expect(after.metadata?.draftSimulationUnresolved).toEqual(
    before.metadata?.draftSimulationUnresolved
  );
  expect(
    (await getWorldTeamDocument(worldId, 'CHI'))?.entitlementIds
  ).toContain(tor);
  expect(
    (await getWorldTeamDocument(worldId, 'TOR'))?.entitlementIds
  ).toContain(chi);
  for (const team of ['CHI', 'TOR']) {
    await page.goto(`/gm/${team}?season=2026`);
    await openDashboardTab(page, 'Team History');
    await expect(
      page.getByTestId('team-history-section-timeline')
    ).toContainText('Trade Executed');
    await page
      .getByTestId('team-history-section-timeline')
      .getByRole('button', { name: /Trade Executed:/ })
      .click();
    await expect(page.getByTestId('team-history-detail-modal')).toContainText(
      '2028 first-round pick'
    );
    await expect(page.getByTestId('team-history-detail-modal')).toContainText(
      '2029 first-round pick'
    );
    await capture(page, `${team}-history`);
    await page
      .getByTestId('team-history-detail-modal')
      .getByRole('button', { name: /close/i })
      .click();
    await openDashboardTab(page, 'Compare');
    await expect(
      page.getByText('CHI 2028 first-round pick', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText('TOR 2029 first-round pick', { exact: true })
    ).toBeVisible();
    await capture(page, `${team}-compare`);
    await openDashboardTab(page, 'Roster');
    await page.reload();
    await openDashboardTab(page, 'Compare');
    await expect(
      page.getByText('CHI 2028 first-round pick', { exact: true })
    ).toBeVisible();
    await capture(page, `${team}-reload`);
    await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
    const returned = page.getByRole('dialog', { name: /Trade Machine/i });
    const returnedCard = returned.getByTestId(`trade-team-card-${team}`);
    await returnedCard
      .getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i })
      .click();
    await expect(
      returnedCard.locator(
        `[data-entitlement-id="${team === 'CHI' ? tor : chi}"]`
      )
    ).toBeVisible();
    await expect(
      returnedCard.locator(
        `[data-entitlement-id="${team === 'CHI' ? chi : tor}"]`
      )
    ).toHaveCount(0);
  }
  expect(await state(worldId)).toEqual(after);
  expect(
    (
      await getReviewAdminDb().collection('architect_baseEntitlements').get()
    ).docs.map((d) => ({ id: d.id, data: d.data() }))
  ).toEqual(sourceBefore);
  fs.writeFileSync(
    path.join(proofDir, 'proof.json'),
    JSON.stringify(
      {
        candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
        scope: 'governed-simulation-only',
        packageSha256: createHash('sha256')
          .update(fs.readFileSync(process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE!))
          .digest('hex'),
        catalogue: 278,
        unresolved: 29,
        bothTeams: true,
        reload: true,
        events,
      },
      null,
      2
    )
  );
});

test('proposal branches and actual mutation reject forged, changed, stale, missing-finance and retry inputs', async ({
  page,
}) => {
  const uid = await login(page);
  const worldId = `world_retained_failures_${uid}`;
  await seedRetainedDraftSimulation(uid, worldId, true);
  const before = await state(worldId);
  const branched = await prepare(page, uid, worldId);
  expect(branched.status).toBe('blocked');
  expect(JSON.stringify(branched)).toContain('conveys:unknown-2027/2028');
  expect(await state(worldId)).toEqual(before);
  // Change the actual proposal to retain 2028 in both protection branches.
  const positive = await prepare(page, uid, worldId, [
    'ent:CHI:2030:1:own:382a238d',
    tor,
  ]);
  expect(positive).toMatchObject({ status: 'prepared', legal: true });
  expect((await apply(page, 'forged')).success).toBe(false);
  expect((await apply(page, 'changed')).success).toBe(false);
  expect(await state(worldId)).toEqual(before);
  const result = await apply(page);
  expect(result.success, JSON.stringify(result)).toBe(true);
  const committed = await state(worldId);
  expect((await apply(page)).success).toBe(false);
  expect(await state(worldId)).toEqual(committed);
  // Re-review the current world, not a fixed source proposal: exchanging back works.
  expect(
    await prepare(page, uid, worldId, [tor, 'ent:CHI:2030:1:own:382a238d'])
  ).toMatchObject({ status: 'prepared', legal: true });
  const reversed = await apply(page);
  expect(reversed.success, JSON.stringify(reversed)).toBe(true);
  expect(
    (await getWorldTeamDocument(worldId, 'CHI'))?.entitlementIds
  ).toContain('ent:CHI:2030:1:own:382a238d');
  await getReviewAdminDb()
    .doc(`architect_worlds/${worldId}/teams/CHI`)
    .update({ salaryBookInputs: null });
  const changed = await state(worldId);
  expect((await apply(page)).success).toBe(false);
  expect(await state(worldId)).toEqual(changed);
  const missing = await prepare(page, uid, worldId, [
    'ent:CHI:2030:1:own:382a238d',
    tor,
  ]);
  expect(missing).toMatchObject({ status: 'prepared', legal: false });
  expect(JSON.stringify(missing)).toMatch(/Salary|salary|input/);
  expect((await apply(page)).success).toBe(false);
  expect(await state(worldId)).toEqual(changed);
  await expect(
    prepare(page, uid, worldId, ['ent:CHI:2033:1:own:baa33ef0', tor])
  ).rejects.toThrow('protection/conveyance');
  expect(await state(worldId)).toEqual(changed);
  fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(
    path.join(proofDir, 'negative-proof.json'),
    JSON.stringify({
      candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
      scope: 'governed-simulation-only',
      protectionBranches: true,
      changedProposal: true,
      forged: true,
      stale: true,
      retry: true,
      reverseTransfer: true,
      missingFinanceNoWrite: true,
      unsupportedRightNoWrite: true,
    })
  );
});
