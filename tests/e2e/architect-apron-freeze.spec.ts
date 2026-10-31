import { test, expect, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadSnapshot, coverage } from '../../scripts/dev/cloudData';
import { seedApronDraftWorld } from './fixtures/apronDraftWorld';
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
    !process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE,
  'Protected retained-catalogue simulation required.'
);
const proofDir =
  process.env.SCOUTZERO_BROWSER_PROOF_DIR ??
  'work/bze-329-apron/private/browser';
const date = { seasonId: '2026-27', asOfDate: '2026-07-01', yearKey: 2027 };
async function capture(page: Page, key: string) {
  fs.mkdirSync(proofDir, { recursive: true });
  await page.screenshot({ path: path.join(proofDir, `${key}-1280x720.png`) });
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
  await expect(
    dialog.getByRole('region', { name: 'Second-apron freeze' })
  ).toBeVisible({ timeout: 30000 });
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
async function advance(page: Page, worldId: string, fromSeason = '2025-26') {
  return page.evaluate(
    async ({ worldId, fromSeason }) => {
      const modulePath = '/src/features/architect/utils/seasonManager.ts';
      const { advanceSeasonInWorld } = await import(modulePath);
      return advanceSeasonInWorld(worldId, { fromSeason });
    },
    { worldId, fromSeason }
  );
}

for (const excess of [1, 0])
  test(`GM ${excess ? 'freeze' : 'equality'} observation, saved trade and consistent views`, async ({
    page,
  }) => {
    const mode = excess ? 'frozen' : 'equality';
    const shot = (key: string) => capture(page, `${mode}-${key}`);
    await page.goto('/gm/TOR?season=2026');
    await expect
      .poll(() => readReviewUserId(page), { timeout: 30000 })
      .not.toBe('');
    const uid = await readReviewUserId(page),
      worldId = `apron_${Date.now()}`;
    const { catalogue, original } = await seedApronDraftWorld(
      uid,
      worldId,
      excess
    );
    const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
    const initial = await conditionalState(worldId),
      sourceBefore = await sourceState();
    if (process.env.SCOUTZERO_DRAFT_SIMULATION_BASELINE)
      expect(coverage(await loadSnapshot()).sha256).toBe(
        coverage(
          JSON.parse(
            fs.readFileSync(
              process.env.SCOUTZERO_DRAFT_SIMULATION_BASELINE,
              'utf8'
            )
          )
        ).sha256
      );
    await page.evaluate(
      ({ uid, worldId }) => {
        localStorage.setItem(`architect.activeWorldId.${uid}`, worldId);
        localStorage.setItem('hz.currentSeasonEndYear', '2026');
      },
      { uid, worldId }
    );
    await page.reload();
    let dialog = await room(page);
    await expect(dialog.getByTestId('apron-lifecycle-summary')).toContainText(
      'Restriction history incomplete'
    );
    await shot('before');
    await Promise.all([
      page.waitForEvent('load', { timeout: 120000 }),
      dialog.getByRole('button', { name: 'Advance to 2026–27' }).click(),
    ]);
    await expect
      .poll(async () => (await root.get()).data()?.currentSeason, {
        timeout: 120000,
      })
      .toBe('2026-27');
    expect((await root.collection('seasonHistory').get()).size).toBe(30);
    expect((await root.get()).data()!.draftApronHistory).toHaveLength(1);
    dialog = await room(page);
    await expect(dialog.getByTestId('apron-lifecycle-summary')).toContainText(
      `TOR 2033 first · held by TOR: ${excess ? 'Frozen' : 'No freeze triggered'}`
    );
    await expect(dialog.getByTestId('apron-lifecycle-summary')).toContainText(
      'MIA 2033 first · held by MIA: No freeze triggered'
    );
    await shot('frozen');
    if (excess) {
      const saved = await conditionalState(worldId);
      const blocked = await prepareConditionalTrade(
        page,
        uid,
        worldId,
        [original('TOR', 2033), original('MIA', 2031)],
        ['TOR', 'MIA'],
        date
      );
      expect(blocked.status).toBe('blocked');
      expect(JSON.stringify(blocked)).toMatch(/frozen|apron/i);
      expect((await applyConditionalTrade(page)).success).toBe(false);
      expect(await conditionalState(worldId)).toEqual(saved);
      const picker = dialog
        .locator('label', { hasText: /^Select Team$/ })
        .locator('xpath=following-sibling::select[1]');
      if (!(await picker.count()))
        await dialog.getByRole('button', { name: /^Add Team$/ }).click();
      await picker.first().selectOption('heat');
      await select(
        page,
        dialog.getByTestId('trade-team-card-TOR'),
        original('TOR', 2033),
        'Miami Heat'
      );
      await select(
        page,
        dialog.getByTestId('trade-team-card-MIA'),
        original('MIA', 2031),
        'Toronto Raptors'
      );
      await dialog.getByRole('button', { name: /^Validate Trade$/ }).click();
      await expect(
        dialog.getByRole('button', { name: /^Apply Trade$/ })
      ).toBeDisabled();
      await expect(dialog).toContainText(/frozen|apron/i);
      await shot('blocked');
    }
    await page.reload();
    dialog = await room(page);
    const add = dialog
      .locator('label', { hasText: /^Select Team$/ })
      .locator('xpath=following-sibling::select[1]');
    if (!(await add.count()))
      await dialog.getByRole('button', { name: /^Add Team$/ }).click();
    await add.first().selectOption('heat');
    await select(
      page,
      dialog.getByTestId('trade-team-card-TOR'),
      original('TOR', excess ? 2031 : 2033),
      'Miami Heat'
    );
    await select(
      page,
      dialog.getByTestId('trade-team-card-MIA'),
      original('MIA', excess ? 2031 : 2033),
      'Toronto Raptors'
    );
    await dialog.getByRole('button', { name: /^Validate Trade$/ }).click();
    await expect(
      dialog.getByRole('button', { name: /^Apply Trade$/ })
    ).toBeEnabled({ timeout: 120000 });
    await shot('permitted');
    await dialog.getByRole('button', { name: /^Apply Trade$/ }).click();
    await expect
      .poll(async () => (await root.collection('events').get()).size, {
        timeout: 120000,
      })
      .toBe(2);
    await expect(dialog).toBeHidden({ timeout: 30000 });
    const expectedHolders = excess
      ? {
          [original('TOR', 2033)]: 'TOR',
          [original('MIA', 2033)]: 'MIA',
          [original('TOR', 2031)]: 'MIA',
          [original('MIA', 2031)]: 'TOR',
        }
      : { [original('TOR', 2033)]: 'MIA', [original('MIA', 2033)]: 'TOR' };
    for (const [id, holder] of Object.entries(expectedHolders))
      expect(
        (await root.collection('entitlements').doc(id).get()).data()!.holderTeam
      ).toBe(holder);
    for (const team of ['TOR', 'MIA']) {
      await page.goto(`/gm/${team}?season=2027`);
      await openDashboardTab(page, 'Team History');
      const timeline = page.getByTestId('team-history-section-timeline');
      await expect(timeline).toContainText(/Season/i);
      await timeline
        .getByRole('button')
        .filter({ hasText: /Season Advance/i })
        .first()
        .click();
      await expect(
        page.getByTestId('team-history-detail-sections')
      ).toContainText(
        `${team} 2033 first: ${team === 'TOR' && excess ? 'Frozen' : 'No freeze triggered'}`
      );
      await shot(`${team}-history`);
      await page.getByTestId('team-history-detail-close').click();
      await openDashboardTab(page, 'Compare');
      await expect(
        page.getByText(
          `${team} 2033 first: ${team === 'TOR' && excess ? 'Frozen · later-season review pending' : 'No freeze triggered'}`,
          { exact: true }
        )
      ).toBeVisible();
      await shot(`${team}-compare`);
      await page.reload();
      await openDashboardTab(page, 'Compare');
      await expect(
        page.getByText(
          `${team} 2033 first: ${team === 'TOR' && excess ? 'Frozen · later-season review pending' : 'No freeze triggered'}`,
          { exact: true }
        )
      ).toBeVisible();
      await shot(`${team}-reload`);
      const expand = page.getByRole('button', { name: 'Expand activity rail' });
      if (await expand.isVisible()) await expand.click();
      await page.getByTestId('cockpit-activity-rail-assets-open').click();
      if (team === 'TOR') {
        await expect(
          page.getByTestId('cockpit-assets-panel-picks-2033-first')
        ).toContainText(excess ? 'Frozen' : 'No freeze triggered');
        if (!excess)
          await expect(
            page.getByTestId('cockpit-assets-panel-picks-2033-first')
          ).toContainText('via MIA');
      }
      await shot(`${team}-assets`);
      await page.keyboard.press('Escape');
      dialog = await room(page);
      await expect(dialog.getByTestId('apron-lifecycle-summary')).toContainText(
        `MIA 2033 first · held by ${excess ? 'MIA' : 'TOR'}: No freeze triggered`
      );
      const card = dialog.getByTestId(`trade-team-card-${team}`);
      await card
        .getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i })
        .click();
      for (const [id, holder] of Object.entries(expectedHolders))
        await expect(card.locator(`[data-entitlement-id="${id}"]`)).toHaveCount(
          holder === team ? 1 : 0
        );
    }
    const final = await conditionalState(worldId);
    expect((await advance(page, worldId, '2026-27')).success).toBe(false);
    expect(await conditionalState(worldId)).toEqual(final);
    const before = initial.children.find(
        (c) => c.name === 'entitlements'
      )!.docs,
      after = final.children.find((c) => c.name === 'entitlements')!.docs;
    const terms = (docs: typeof before) =>
      docs.map(({ id, data: { holderTeam, ...terms } }) => ({ id, terms }));
    expect(after).toHaveLength(278);
    expect(terms(after)).toEqual(terms(before));
    expect(final.metadata!.draftSimulationUnresolved).toEqual(
      catalogue.data.unresolved
    );
    expect(catalogue.data.unresolved).toHaveLength(29);
    expect(await sourceState()).toEqual(sourceBefore);
    fs.writeFileSync(
      path.join(proofDir, `proof-${mode}.json`),
      JSON.stringify(
        {
          candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
          scope: 'governed-simulation-only',
          packageSha256: createHash('sha256')
            .update(
              fs.readFileSync(process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE!)
            )
            .digest('hex'),
          catalogue: 278,
          unresolved: 29,
          season: '2025-26 to 2026-27 only',
          frozenBlocked: !!excess,
          equalityTradeSaved: !excess,
          releaseAndPenalty: 'unfinished',
          allAffectedTeams: ['TOR', 'MIA'],
          sourceUnchanged: true,
          events: final.children.find((c) => c.name === 'events')!.docs,
        },
        null,
        2
      )
    );
  });

test('missing/conflicting observations, receipt drift, repeat and later transitions write nothing', async ({
  page,
}) => {
  await page.goto('/gm/TOR?season=2026');
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  const uid = await readReviewUserId(page),
    worldId = `apron_negative_${Date.now()}`;
  const { plan, original } = await seedApronDraftWorld(uid, worldId, 0);
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  for (const kind of ['missing', 'conflicting', 'future']) {
    const altered = structuredClone(plan);
    if (kind === 'missing') altered.steps[0].observations.pop();
    if (kind === 'conflicting')
      altered.steps[0].observations[0].state = 'conflicting';
    if (kind === 'future')
      altered.steps[0].observations[0].value!.measuredAt =
        '2027-04-12T19:00:00-04:00';
    await root.update({ draftApronPlan: altered });
    const before = await conditionalState(worldId);
    expect((await advance(page, worldId)).success).toBe(false);
    expect(await conditionalState(worldId)).toEqual(before);
  }
  await root.update({ draftApronPlan: plan });
  expect((await advance(page, worldId)).success).toBe(true);
  const saved = await conditionalState(worldId);
  expect((await advance(page, worldId)).success).toBe(false);
  expect((await advance(page, worldId, '2026-27')).success).toBe(false);
  expect(await conditionalState(worldId)).toEqual(saved);
  const missingHistory = await prepareConditionalTrade(
    page,
    uid,
    worldId,
    [original('TOR', 2032), original('MIA', 2033)],
    ['TOR', 'MIA'],
    date
  );
  expect(missingHistory.status).toBe('blocked');
  expect(JSON.stringify(missingHistory)).toContain(
    'apron:TOR_2032_1st:needs-input'
  );
  expect(JSON.stringify(missingHistory)).toContain('unknown-2033/2034');
  expect(await conditionalState(worldId)).toEqual(saved);
  const preview = await prepareConditionalTrade(
    page,
    uid,
    worldId,
    [original('TOR', 2033), original('MIA', 2033)],
    ['TOR', 'MIA'],
    date
  );
  expect(preview.status, JSON.stringify(preview)).toBe('prepared');
  const event = (await root.collection('events').get()).docs[0];
  await event.ref.update({
    'metadata.apronSeasonReceipt.planDigest': 'changed-after-validation',
  });
  const stale = await conditionalState(worldId);
  expect((await applyConditionalTrade(page)).success).toBe(false);
  expect(await conditionalState(worldId)).toEqual(stale);
  const invalid = await prepareConditionalTrade(
    page,
    uid,
    worldId,
    [original('TOR', 2033), original('MIA', 2033)],
    ['TOR', 'MIA'],
    date
  );
  expect(invalid.status).toBe('error');
  expect(await conditionalState(worldId)).toEqual(stale);
  fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(
    path.join(proofDir, 'negative-proof.json'),
    JSON.stringify(
      {
        candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
        scope: 'governed-simulation-only',
        cases: [
          'missing-observation',
          'conflicting-observation',
          'future-observation',
          'repeat-transition',
          'unsupported-later-season',
          'missing-2024-history',
          'unknown-2033-2034-Stepien-pair',
          'receipt-drift-after-preview',
          'invalid-saved-receipt',
        ],
        noWrites: true,
      },
      null,
      2
    )
  );
});

test.afterAll(() => {
  const files = ['frozen', 'equality'].map((mode) =>
    path.join(proofDir, `proof-${mode}.json`)
  );
  if (files.every((f) => fs.existsSync(f))) {
    const journeys = files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
    if (
      journeys.every(
        (j) => j.candidate === process.env.SCOUTZERO_PROOF_CANDIDATE
      )
    )
      fs.writeFileSync(
        path.join(proofDir, 'proof.json'),
        JSON.stringify(
          {
            candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
            scope: 'governed-simulation-only',
            packageSha256: journeys[0].packageSha256,
            journeys,
          },
          null,
          2
        )
      );
  }
});
