import { test, expect, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { coverage, loadSnapshot } from '../../scripts/dev/cloudData';
import { seedNativeDraftPoolWorld } from './fixtures/nativeDraftPoolWorld';
import {
  conditionalState,
  prepareConditionalTrade,
  applyConditionalTrade,
} from './helpers/conditionalDraftJourney';
import {
  readReviewUserId,
  getReviewAdminDb,
  openDashboardTab,
} from './helpers/architectReviewWorld';

test.use({
  viewport: { width: 1280, height: 720 },
  actionTimeout: 15000,
  trace: 'on',
});
test.setTimeout(600000);
test.skip(
  process.env.PLAYWRIGHT_DRAFT_SIMULATION !== 'true' ||
    !process.env.SCOUTZERO_DRAFT_NATIVE_POOL,
  'Protected catalogue and native terms required.'
);
const proofDir =
  process.env.SCOUTZERO_BROWSER_PROOF_DIR ?? 'tmp/native-selection-trade';
const date = { seasonId: '2028-29', asOfDate: '2029-06-20', yearKey: 2029 };
function receipt(name: string, value: unknown) {
  fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(
    path.join(proofDir, `${name}.json`),
    JSON.stringify(value, null, 2)
  );
}
async function capture(page: Page, name: string) {
  fs.mkdirSync(proofDir, { recursive: true });
  await page.screenshot({ path: path.join(proofDir, `${name}-1280x720.png`) });
}
async function sourceState() {
  return (
    await getReviewAdminDb().collection('architect_baseEntitlements').get()
  ).docs.map((d) => ({ id: d.id, data: d.data() }));
}
async function room(page: Page) {
  if (new URL(page.url()).searchParams.get('room') !== 'trade')
    await page.getByRole('tab', { name: /^Trade Machine$/ }).click();
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  await expect(dialog.getByRole('region', { name: 'Swap pool' })).toBeVisible({
    timeout: 30000,
  });
  return dialog;
}
async function select(page: Page, card: Locator, id: string, to: string) {
  await card.getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i }).click();
  await card
    .locator(`[data-entitlement-id="${id}"]`)
    .getByRole('button', { name: '•••' })
    .click();
  await page
    .getByRole('button', { name: `Trade to ${to}`, exact: true })
    .click();
}
async function start(
  page: Page,
  name: string,
  preDraft = true,
  completeStepien = true
) {
  await page.goto('/gm/HOU?season=2029');
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  const uid = await readReviewUserId(page),
    worldId = `native_trade_${name}_${Date.now()}`;
  const fixture = await seedNativeDraftPoolWorld(uid, worldId, preDraft);
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  if (!completeStepien)
    await root.update({ 'draftNativeLifecycle.softwareRetainedFirsts': [] });
  await page.evaluate(
    ({ uid, worldId }) => {
      localStorage.setItem(`architect.activeWorldId.${uid}`, worldId);
      localStorage.setItem('hz.currentSeasonEndYear', '2029');
    },
    { uid, worldId }
  );
  await page.reload();
  let dialog = await room(page);
  const positions = { DAL: 3, PHX: 14, HOU: 27 };
  for (const [team, position] of Object.entries(positions))
    await dialog.getByLabel(`${team} draft position`).fill(String(position));
  await dialog.getByLabel('Pool election').selectOption('exercise');
  await Promise.all([
    page.waitForEvent('load', { timeout: 120000 }),
    dialog.getByRole('button', { name: 'Resolve 2029 draft' }).click(),
  ]);
  await expect
    .poll(async () => (await root.collection('events').get()).size, {
      timeout: 120000,
    })
    .toBe(1);
  const ids = Object.fromEntries(
    fixture.program.slots.map((s) => [s.originalTeam, s.entitlementId])
  );
  return { ...fixture, uid, worldId, root, ids, positions };
}

test('resolved selections can be traded twice through Trade Machine and recovered in every affected view', async ({
  page,
}) => {
  const { worldId, root, ids, positions, catalogue } = await start(
    page,
    'journey'
  );
  const before = await conditionalState(worldId);
  const sourceBefore = await sourceState();
  expect(coverage(await loadSnapshot()).sha256).toBe(
    coverage(
      JSON.parse(
        fs.readFileSync(
          process.env.SCOUTZERO_DRAFT_SIMULATION_BASELINE!,
          'utf8'
        )
      )
    ).sha256
  );
  const resolution = (
    await root.collection('events').doc('swapDraft__2029').get()
  ).data();
  expect(before.metadata!.asOfDate).toBe(date.asOfDate);
  for (const [index, pair] of [
    [ids.DAL, ids.HOU],
    [ids.PHX, ids.DAL],
  ].entries()) {
    await page.goto('/gm/HOU?season=2029');
    const dialog = await room(page);
    const picker = dialog
      .locator('label', { hasText: /^Select Team$/ })
      .locator('xpath=following-sibling::select[1]');
    if (!(await picker.count()))
      await dialog.getByRole('button', { name: /^Add Team$/ }).click();
    await picker.first().selectOption('nets');
    await select(
      page,
      dialog.getByTestId('trade-team-card-HOU'),
      pair[0],
      'Brooklyn Nets'
    );
    await select(
      page,
      dialog.getByTestId('trade-team-card-BKN'),
      pair[1],
      'Houston Rockets'
    );
    await dialog.getByRole('button', { name: /^Validate Trade$/ }).click();
    await expect(
      dialog.getByRole('button', { name: /^Apply Trade$/ })
    ).toBeEnabled({ timeout: 120000 });
    await capture(page, `trade-${index}-legal`);
    await dialog.getByRole('button', { name: /^Apply Trade$/ }).click();
    await expect
      .poll(async () => (await root.collection('events').get()).size, {
        timeout: 120000,
      })
      .toBe(index + 2);
    await expect(dialog).toBeHidden({ timeout: 30000 });
    await page.reload();
  }
  const holders = { DAL: 'HOU', HOU: 'HOU', PHX: 'BKN' };
  for (const team of ['HOU', 'BKN', 'DAL', 'PHX']) {
    await page.goto(`/gm/${team}?season=2029`);
    for (const phase of ['compare', 'reload']) {
      if (phase === 'reload') await page.reload();
      await openDashboardTab(page, 'Compare');
      for (const original of Object.keys(holders).filter(
        (t) => t === team || holders[t as keyof typeof holders] === team
      ))
        await expect(
          page.getByText(
            `${original} 2029 first: final pick ${positions[original as keyof typeof positions]} · held by ${holders[original as keyof typeof holders]}`,
            { exact: true }
          )
        ).toBeVisible();
      await capture(page, `${team}-${phase}`);
    }
    await openDashboardTab(page, 'Team History');
    const timeline = page.getByTestId('team-history-section-timeline');
    await expect(timeline).toContainText('Draft Obligation Resolved');
    await expect(timeline).toContainText('Trade');
    await expect(
      timeline.getByRole('button', { name: /^Trade Executed:/ })
    ).toHaveCount(2);
    await capture(page, `${team}-history`);
    const expand = page.getByRole('button', { name: 'Expand activity rail' });
    if (await expand.isVisible()) await expand.click();
    await page.getByTestId('cockpit-activity-rail-assets-open').click();
    for (const original of Object.keys(holders).filter(
      (t) => holders[t as keyof typeof holders] === team
    ))
      await expect(
        page.getByTestId('cockpit-assets-panel-picks-2029-first')
      ).toContainText(
        `Final pick ${positions[original as keyof typeof positions]}`
      );
    await capture(page, `${team}-assets`);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('cockpit-activity-rail')).toContainText(
      'Team Plan'
    );
    await expect(
      page.getByTestId('cockpit-activity-rail-identity')
    ).toContainText('Native pooled selections');
    await expect(
      page.getByTestId('cockpit-activity-rail-assets-picks')
    ).toBeVisible();
    await capture(page, `${team}-plan`);
  }
  const after = await conditionalState(worldId);
  expect(await sourceState()).toEqual(sourceBefore);
  expect(
    (await root.collection('events').doc('swapDraft__2029').get()).data()
  ).toEqual(resolution);
  expect(after.metadata!.draftSwapProgram).toEqual(
    before.metadata!.draftSwapProgram
  );
  expect(after.metadata!.draftSimulationUnresolved).toEqual(
    catalogue.data.unresolved
  );
  expect(catalogue.data.unresolved).toHaveLength(29);
  const oldEnts = before.children.find((c) => c.name === 'entitlements')!.docs;
  const newEnts = after.children.find((c) => c.name === 'entitlements')!.docs;
  expect(newEnts).toHaveLength(278);
  for (const row of newEnts) {
    const old = oldEnts.find((e) => e.id === row.id)!;
    expect({ ...row.data, holderTeam: old.data.holderTeam }).toEqual(old.data);
    const original = Object.keys(ids).find((t) => ids[t] === row.id);
    if (original)
      expect(row.data.holderTeam).toBe(
        holders[original as keyof typeof holders]
      );
    const owner = after.children
      .find((c) => c.name === 'teams')!
      .docs.filter((t) => t.data.entitlementIds.includes(row.id));
    expect(owner.map((t) => t.id)).toEqual([row.data.holderTeam]);
  }
  receipt('proof', {
    candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
    scope: 'governed-simulation-only',
    packageSha256: createHash('sha256')
      .update(fs.readFileSync(process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE!))
      .digest('hex'),
    nativeTermsSha256: createHash('sha256')
      .update(fs.readFileSync(process.env.SCOUTZERO_DRAFT_NATIVE_POOL!))
      .digest('hex'),
    worldId,
    trades: 2,
    teams: ['HOU', 'BKN', 'DAL', 'PHX'],
    views: 20,
    preservedIdentities: 278,
    unresolved: 29,
  });
});

test('native trades reject stale state, missing inputs, conflict, duplicate writes and closed timing atomically', async ({
  page,
}) => {
  const { uid, worldId, root, ids } = await start(page, 'negative');
  const prepare = (asOfDate = date.asOfDate) =>
    prepareConditionalTrade(
      page,
      uid,
      worldId,
      [ids.DAL, ids.HOU],
      ['HOU', 'BKN'],
      { ...date, asOfDate }
    );
  expect(await prepare()).toMatchObject({ status: 'prepared', legal: true });
  const selected = root.collection('entitlements').doc(ids.DAL),
    original = (await selected.get()).data()!;
  await selected.update({ holderTeam: 'PHX' });
  const stale = await conditionalState(worldId);
  expect(await applyConditionalTrade(page)).toMatchObject({ success: false });
  expect(await conditionalState(worldId)).toEqual(stale);
  expect(await prepare()).not.toMatchObject({
    status: 'prepared',
    legal: true,
  });
  await selected.set(original);
  const metadata = (await root.get()).data()!;
  for (const patch of [
    { asOfDate: '2029-06-30' },
    { asOfDate: '2029-06-19' },
    { draftNativeLifecycle: null },
    {
      draftNativeLifecycle: {
        ...metadata.draftNativeLifecycle,
        claimsEffectiveDate: '2029-06-19',
      },
    },
    {
      draftSwapProgram: {
        ...metadata.draftSwapProgram,
        result: {
          ...metadata.draftSwapProgram.result,
          allocation: {
            ...metadata.draftSwapProgram.result.allocation,
            [ids.DAL]: 'BKN',
          },
        },
      },
    },
  ]) {
    await root.update(patch);
    const before = await conditionalState(worldId);
    expect(
      await prepare('asOfDate' in patch ? patch.asOfDate! : date.asOfDate)
    ).not.toMatchObject({ status: 'prepared', legal: true });
    expect(await conditionalState(worldId)).toEqual(before);
    await root.set(metadata);
  }
  const beforeUnavailable = await conditionalState(worldId);
  await page.route('**/api/architect/draft-review', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' })
  );
  expect(await prepare()).not.toMatchObject({
    status: 'prepared',
    legal: true,
  });
  expect(await conditionalState(worldId)).toEqual(beforeUnavailable);
  await page.unroute('**/api/architect/draft-review');
  const hou = root.collection('teams').doc('HOU'),
    houBefore = (await hou.get()).data()!;
  await hou.update({ salaryBookInputs: null });
  expect(await prepare()).not.toMatchObject({
    status: 'prepared',
    legal: true,
  });
  await hou.set(houBefore);
  expect(await prepare()).toMatchObject({ status: 'prepared', legal: true });
  const applied = await applyConditionalTrade(page);
  expect(applied, applied.error).toMatchObject({ success: true });
  const committed = await conditionalState(worldId);
  expect(await applyConditionalTrade(page)).toMatchObject({ success: false });
  expect(await conditionalState(worldId)).toEqual(committed);
  // A missing prior receipt cannot be hidden by the current holder or root summary.
  const transfer = committed.metadata!.draftNativeTransfers[0];
  const event = root
      .collection('events')
      .doc(`draft_review_${transfer.operationId}`),
    saved = (await event.get()).data()!;
  expect(await prepare()).toMatchObject({ status: 'prepared', legal: true });
  await event.delete();
  expect(await prepare()).not.toMatchObject({
    status: 'prepared',
    legal: true,
  });
  await event.set(saved);
  receipt('negative-proof', {
    candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
    checks: [
      'stale ownership',
      'closed draft date',
      'retrospective date',
      'missing window',
      'retrofit window',
      'conflicting allocation',
      'missing finances',
      'unavailable catalogue',
      'duplicate write',
      'missing prior receipt',
    ],
    worldId,
  });
});

test('missing future retained holdings cannot supply a Stepien verdict or commit', async ({
  page,
}) => {
  const { uid, worldId, ids } = await start(page, 'stepien', true, false);
  const before = await conditionalState(worldId);
  const verdict = await prepareConditionalTrade(
    page,
    uid,
    worldId,
    [ids.DAL, ids.HOU],
    ['HOU', 'BKN'],
    date
  );
  expect(verdict).not.toMatchObject({ status: 'prepared', legal: true });
  expect(JSON.stringify(verdict)).toMatch(
    /Stepien|retained|holding|unavailable|unknown/i
  );
  expect(await conditionalState(worldId)).toEqual(before);
  receipt('stepien-proof', {
    candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
    verdict,
    worldId,
    unchanged: true,
  });
});
