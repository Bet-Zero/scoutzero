import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { seedApronDraftWorld } from './fixtures/apronDraftWorld';
import { multiseasonApronFixture } from './fixtures/multiseasonApronWorld';
import { registerSoftwareSeasonEnvironment } from '@/features/architect/utils/governedSeason/softwareSeasonEnvironment';
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

registerSoftwareSeasonEnvironment(() => true);
test.use({
  viewport: { width: 1280, height: 720 },
  actionTimeout: 15000,
  trace: 'on',
});
test.setTimeout(900000);
test.skip(
  process.env.PLAYWRIGHT_DRAFT_SIMULATION !== 'true' ||
    !process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE,
  'Protected retained catalogue required.'
);
const proofDir =
  process.env.SCOUTZERO_BROWSER_PROOF_DIR ??
  'work/bze-329-multiseason/private/browser';
async function capture(page: Page, key: string) {
  fs.mkdirSync(proofDir, { recursive: true });
  await page.screenshot({ path: path.join(proofDir, `${key}-1280x720.png`) });
}
async function room(page: Page) {
  if (new URL(page.url()).searchParams.get('room') !== 'trade')
    await page.getByRole('tab', { name: /^Trade Machine$/ }).click();
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  await expect(
    dialog.getByRole('region', { name: 'Second-apron freeze' })
  ).toBeVisible({ timeout: 60000 });
  return dialog;
}
async function tradeInRoom(page: Page, tor: string, mia: string) {
  await page.goto('/gm/TOR?season=2031');
  const dialog = await room(page);
  const picker = dialog
    .locator('label', { hasText: /^Select Team$/ })
    .locator('xpath=following-sibling::select[1]');
  if (!(await picker.count()))
    await dialog.getByRole('button', { name: /^Add Team$/ }).click();
  await picker.first().selectOption('heat');
  for (const [team, id, to] of [
    ['TOR', tor, 'Miami Heat'],
    ['MIA', mia, 'Toronto Raptors'],
  ]) {
    const card = dialog.getByTestId(`trade-team-card-${team}`);
    await card
      .getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i })
      .click();
    await card
      .locator(`[data-entitlement-id="${id}"]`)
      .getByRole('button', { name: '•••' })
      .click();
    await page
      .getByRole('button', { name: `Trade to ${to}`, exact: true })
      .click();
  }
  await dialog.getByRole('button', { name: /^Validate Trade$/ }).click();
  return dialog;
}
async function advance(page: Page, worldId: string, fromSeason: string) {
  return page.evaluate(
    async ({ worldId, fromSeason }) => {
      const modulePath = '/src/features/architect/utils/seasonManager.ts';
      return (await import(modulePath)).advanceSeasonInWorld(worldId, {
        fromSeason,
      });
    },
    { worldId, fromSeason }
  );
}
const scenarios = [
  { name: 'penalty', followups: [1, 1, 0, 0], releaseStep: 0 },
  { name: 'earliest-release', followups: [0, -1, 0, 1], releaseStep: 4 },
  { name: 'latest-release', followups: [1, 0, -1, 0], releaseStep: 5 },
];
for (const scenario of scenarios)
  test(`saved consecutive seasons: ${scenario.name}`, async ({ page }) => {
    await page.goto('/gm/TOR?season=2026');
    await expect
      .poll(() => readReviewUserId(page), { timeout: 30000 })
      .not.toBe('');
    const uid = await readReviewUserId(page),
      worldId = `multi_${scenario.name}_${Date.now()}`;
    const fixture = multiseasonApronFixture(scenario.followups);
    const { catalogue, original } = await seedApronDraftWorld(
      uid,
      worldId,
      1,
      fixture
    );
    const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
    const initial = await conditionalState(worldId);
    const sources = async () =>
      (
        await getReviewAdminDb().collection('architect_baseEntitlements').get()
      ).docs.map((d) => ({ id: d.id, data: d.data() }));
    const sourceBefore = await sources();
    await page.evaluate(
      ({ uid, worldId }) => {
        localStorage.setItem(`architect.activeWorldId.${uid}`, worldId);
        localStorage.setItem('hz.currentSeasonEndYear', '2026');
      },
      { uid, worldId }
    );
    await page.reload();
    for (let step = 1; step <= 5; step++) {
      let dialog = await room(page);
      const season = `${2025 + step}-${String(2026 + step).slice(-2)}`;
      await Promise.all([
        page.waitForEvent('load', { timeout: 180000 }),
        dialog
          .getByRole('button', {
            name: `Advance to ${season.replace('-', '–')}`,
          })
          .click(),
      ]);
      await expect
        .poll(async () => (await root.get()).data()?.currentSeason, {
          timeout: 120000,
        })
        .toBe(season);
      expect((await root.get()).data()!.draftApronHistory).toHaveLength(step);
      expect((await root.collection('seasonHistory').get()).size).toBe(
        30 * step
      );
      const released = scenario.releaseStep > 0 && step >= scenario.releaseStep;
      const status = released
        ? 'Released · no draft-pick penalty'
        : scenario.name === 'penalty' && step >= 3
          ? 'Frozen · penalty eligible; final draft placement pending'
          : 'Frozen · later-season review pending';
      await page.reload();
      dialog = await room(page);
      await expect(dialog.getByTestId('apron-lifecycle-summary')).toContainText(
        `TOR 2033 first · held by TOR: ${status}`
      );
      const financial = await page.evaluate(
        async ({ worldId, year }) => {
          const loader = '/src/features/architect/utils/teamLoader.ts';
          const capPath =
            '/src/features/architect/utils/capTotals/computeTeamCapTotals.ts';
          const { getTeam } = await import(loader);
          const { createCanonicalTeamTotalsSnapshot } = await import(capPath);
          return createCanonicalTeamTotalsSnapshot(
            await getTeam(worldId, 'TOR'),
            year,
            { asOfDate: `${year - 1}-07-01` }
          );
        },
        { worldId, year: 2026 + step }
      );
      expect(
        financial.salaryBooks.status,
        JSON.stringify(financial.salaryBooks)
      ).toBe('complete');
      expect(financial.salaryCap).toBe(fixture.plan.seasons![step].salaryCap);
      expect(financial.secondApron).toBe(
        fixture.plan.seasons![step].secondApron
      );
      await capture(page, `${scenario.name}-season-${2026 + step}`);
      const saved = await conditionalState(worldId);
      const date = {
        seasonId: season,
        asOfDate: `${2025 + step}-07-01`,
        yearKey: 2026 + step,
      };
      const preview = await prepareConditionalTrade(
        page,
        uid,
        worldId,
        [original('TOR', 2033), original('MIA', 2033)],
        ['TOR', 'MIA'],
        date
      );
      if (!released) {
        expect(preview, JSON.stringify(preview)).toMatchObject({
          status: 'blocked',
        });
        expect('reasons' in preview ? preview.reasons : null).toEqual([
          'apron:TOR_2033_1st:component-prohibits',
        ]);
        expect((await applyConditionalTrade(page)).success).toBe(false);
        expect(await conditionalState(worldId)).toEqual(saved);
      } else
        expect(preview, JSON.stringify(preview)).toMatchObject({
          status: 'prepared',
          legal: true,
        });
      // The exact missing-context dependency: a separate unfrozen pick exchange really saves in 2027–28.
      if (step === 2) {
        const allowed = await prepareConditionalTrade(
          page,
          uid,
          worldId,
          [original('TOR', 2031), original('MIA', 2031)],
          ['TOR', 'MIA'],
          date
        );
        expect(allowed, JSON.stringify(allowed)).toMatchObject({
          status: 'prepared',
          legal: true,
        });
        const applied = await applyConditionalTrade(page);
        expect(applied.success, JSON.stringify(applied)).toBe(true);
        await page.reload();
        expect(
          (
            await root
              .collection('entitlements')
              .doc(original('TOR', 2031))
              .get()
          ).data()!.holderTeam
        ).toBe('MIA');
        await page
          .getByRole('dialog', { name: /Trade Machine/i })
          .getByRole('button', { name: 'Close Trade Machine', exact: true })
          .click();
        await openDashboardTab(page, 'Cap Sheet');
        await expect(
          page.getByRole('region', {
            name: 'Selected-year roster detail surface',
          })
        ).toContainText('Software assumptions');
        await expect(
          page.getByRole('region', {
            name: 'Selected-year canonical totals breakdown surface',
          })
        ).toContainText(`$${financial.teamSalary.toLocaleString('en-US')}`);
        await capture(page, `${scenario.name}-2028-cap`);
        await openDashboardTab(page, 'Full Cap Table');
        await expect(
          page
            .locator('[data-salary-cap-year="2028"]')
            .filter({
              hasText: `$${financial.teamSalary.toLocaleString('en-US')}`,
            })
        ).toBeVisible();
        await capture(page, `${scenario.name}-2028-fullcap`);
      }
    }
    // Verify visible financial and restriction history from both teams after all five atomic transitions.
    for (const team of ['TOR', 'MIA']) {
      await page.goto(`/gm/${team}?season=2031`);
      await openDashboardTab(page, 'Cap Sheet');
      await expect(
        page.getByRole('region', {
          name: 'Selected-year roster detail surface',
        })
      ).toContainText('Software assumptions');
      await expect(
        page.getByRole('region', {
          name: 'Selected-year canonical totals breakdown surface',
        })
      ).toContainText('$277,677,000');
      await capture(page, `${scenario.name}-${team}-cap`);
      await openDashboardTab(page, 'Full Cap Table');
      await expect(
        page
          .locator('[data-salary-cap-year="2031"]')
          .filter({ hasText: '$277,677,000' })
      ).toBeVisible();
      await capture(page, `${scenario.name}-${team}-fullcap`);
      await openDashboardTab(page, 'Team History');
      const timeline = page.getByTestId('team-history-section-timeline');
      await timeline
        .getByRole('button')
        .filter({ hasText: /Season Advance/i })
        .first()
        .click();
      const detail = page.getByTestId('team-history-detail-sections');
      await expect(detail).toContainText(
        team === 'TOR'
          ? scenario.releaseStep
            ? 'Released'
            : 'penalty eligible'
          : 'No freeze triggered'
      );
      await detail.scrollIntoViewIfNeeded();
      await capture(page, `${scenario.name}-${team}-history`);
      await page.getByTestId('team-history-detail-close').click();
      await openDashboardTab(page, 'Compare');
      await expect(
        page.getByText(
          `${team} 2033 first: ${team === 'MIA' ? 'No freeze triggered' : scenario.releaseStep ? 'Released · no draft-pick penalty' : 'Frozen · penalty eligible; final draft placement pending'}`,
          { exact: true }
        )
      ).toBeVisible();
      await capture(page, `${scenario.name}-${team}-compare`);
    }
    if (scenario.releaseStep) {
      const ready = await prepareConditionalTrade(
        page,
        uid,
        worldId,
        [original('TOR', 2033), original('MIA', 2033)],
        ['TOR', 'MIA'],
        { seasonId: '2030-31', asOfDate: '2030-07-01', yearKey: 2031 }
      );
      expect(ready, JSON.stringify(ready)).toMatchObject({
        status: 'prepared',
        legal: true,
      });
      // Saved future inputs are part of the optimistic fence: even untouched future books cannot drift after preview.
      const stepDoc = root.collection('draftSeasonInputs').doc('2029');
      const originalStep = (await stepDoc.get()).data()!;
      await stepDoc.update({
        'targetBooks.TOR.softwareSeasonContext.secondApron': 1,
      });
      const stale = await conditionalState(worldId);
      expect((await applyConditionalTrade(page)).success).toBe(false);
      expect(await conditionalState(worldId)).toEqual(stale);
      await stepDoc.set(originalStep);
      const dialog = await tradeInRoom(
        page,
        original('TOR', 2033),
        original('MIA', 2033)
      );
      await expect(
        dialog.getByRole('button', { name: /^Apply Trade$/ })
      ).toBeEnabled({ timeout: 120000 });
      await capture(page, `${scenario.name}-trade`);
      await dialog.getByRole('button', { name: /^Apply Trade$/ }).click();
      await expect
        .poll(async () => (await root.collection('events').get()).size, {
          timeout: 120000,
        })
        .toBe(7);
      await expect(dialog).toBeHidden({ timeout: 30000 });
      await page.reload();
      expect(
        (
          await root.collection('entitlements').doc(original('TOR', 2033)).get()
        ).data()!.holderTeam
      ).toBe('MIA');
      expect(
        (
          await root.collection('entitlements').doc(original('MIA', 2033)).get()
        ).data()!.holderTeam
      ).toBe('TOR');
    }
    if (!scenario.releaseStep) {
      const dialog = await tradeInRoom(
        page,
        original('TOR', 2033),
        original('MIA', 2033)
      );
      await expect(
        dialog
          .getByRole('status')
          .filter({
            hasText:
              'This original first-round pick is frozen by the Second Apron rule.',
          })
      ).toBeVisible({ timeout: 120000 });
      await expect(
        dialog.getByRole('button', { name: /^Apply Trade$/ })
      ).toBeDisabled();
      await capture(page, `${scenario.name}-trade`);
    }
    for (const team of ['TOR', 'MIA']) {
      await page.goto(`/gm/${team}?season=2031`);
      const expand = page.getByRole('button', { name: 'Expand activity rail' });
      if (await expand.isVisible()) await expand.click();
      await page.getByTestId('cockpit-activity-rail-assets-open').click();
      const assets = page.getByTestId('cockpit-assets-panel-picks-2033-first');
      await expect(assets).toContainText(
        scenario.releaseStep
          ? team === 'MIA'
            ? 'Released'
            : 'No freeze triggered'
          : team === 'TOR'
            ? 'penalty eligible'
            : 'No freeze triggered'
      );
      if (scenario.releaseStep)
        await expect(assets).toContainText(
          team === 'TOR' ? 'via MIA' : 'via TOR'
        );
      await assets.scrollIntoViewIfNeeded();
      await capture(page, `${scenario.name}-${team}-assets`);
    }
    const final = await conditionalState(worldId);
    expect((await advance(page, worldId, '2030-31')).success).toBe(false);
    expect(await conditionalState(worldId)).toEqual(final);
    const terms = (state: typeof initial) =>
      state.children
        .find((c) => c.name === 'entitlements')!
        .docs.map(({ id, data: { holderTeam, ...terms } }) => ({ id, terms }));
    expect(terms(final)).toHaveLength(278);
    expect(terms(final)).toEqual(terms(initial));
    expect(final.metadata!.draftSimulationUnresolved).toEqual(
      catalogue.data.unresolved
    );
    expect(catalogue.data.unresolved).toHaveLength(29);
    expect(await sources()).toEqual(sourceBefore);
    fs.writeFileSync(
      path.join(proofDir, `proof-${scenario.name}.json`),
      JSON.stringify(
        {
          candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
          scope: 'governed-simulation-only',
          packageSha256: createHash('sha256')
            .update(
              fs.readFileSync(process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE!)
            )
            .digest('hex'),
          range: '2025-26 through 2030-31',
          observations: '2025-26 through 2029-30',
          catalogue: 278,
          unresolved: 29,
          sourceUnchanged: true,
          scenario,
          finalPlacement: 'blocked',
          events: final.children.find((c) => c.name === 'events')!.docs,
        },
        null,
        2
      )
    );
  });

test('multi-season missing inputs, repeat, skipped year, context drift and future witness block without writes', async ({
  page,
}) => {
  await page.goto('/gm/TOR?season=2026');
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  const uid = await readReviewUserId(page),
    worldId = `multi_negative_${Date.now()}`;
  const fixture = multiseasonApronFixture([0, 0, 0, 0]);
  fixture.plan.softwareRetainedFirsts = [];
  const { original } = await seedApronDraftWorld(uid, worldId, 1, fixture);
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const next = root.collection('draftSeasonInputs').doc('2026');
  const intact = (await next.get()).data()!;
  for (const kind of ['missing-season-document', 'drifted-calendar']) {
    if (kind === 'missing-season-document') await next.delete();
    else await next.update({ 'tradingWindow.lastYear': 2040 });
    const before = await conditionalState(worldId);
    expect((await advance(page, worldId, '2025-26')).success).toBe(false);
    expect(await conditionalState(worldId)).toEqual(before);
    await next.set(intact);
  }
  expect((await advance(page, worldId, '2025-26')).success).toBe(true);
  const first = await conditionalState(worldId);
  expect((await advance(page, worldId, '2025-26')).success).toBe(false);
  expect((await advance(page, worldId, '2027-28')).success).toBe(false);
  expect(await conditionalState(worldId)).toEqual(first);
  expect((await advance(page, worldId, '2026-27')).success).toBe(true);
  const date = { seasonId: '2027-28', asOfDate: '2027-07-01', yearKey: 2028 };
  const saved = await conditionalState(worldId);
  const missing = await prepareConditionalTrade(
    page,
    uid,
    worldId,
    [original('TOR', 2031), original('MIA', 2031)],
    ['TOR', 'MIA'],
    date
  );
  expect(missing.status).toBe('blocked');
  expect(JSON.stringify(missing)).toContain('unknown-2034/2035');
  expect(await conditionalState(worldId)).toEqual(saved);
  const team = root.collection('teams').doc('TOR');
  const originalTeam = (await team.get()).data()!;
  await team.update({
    'salaryBookInputs.softwareSeasonContext.secondApron': 999999999,
  });
  const altered = await conditionalState(worldId);
  const invalid = await prepareConditionalTrade(
    page,
    uid,
    worldId,
    [original('TOR', 2031), original('MIA', 2031)],
    ['TOR', 'MIA'],
    date
  );
  expect(invalid.status).toBe('error');
  expect(JSON.stringify(invalid)).toContain('financial contexts');
  expect((await advance(page, worldId, '2027-28')).success).toBe(false);
  expect(await conditionalState(worldId)).toEqual(altered);
  await team.set(originalTeam);
  fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(
    path.join(proofDir, 'negative-proof.json'),
    JSON.stringify(
      {
        candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
        scope: 'governed-simulation-only',
        noWrites: true,
        cases: [
          'missing-season-document',
          'drifted-calendar',
          'repeat-transition',
          'skipped-year',
          'missing-future-Stepien-witness',
          'saved-financial-context-drift',
        ],
      },
      null,
      2
    )
  );
});

test.afterAll(() => {
  const files = scenarios.map((s) =>
    path.join(proofDir, `proof-${s.name}.json`)
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
