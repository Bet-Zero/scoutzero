import { test, expect, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadSnapshot, coverage } from '../../scripts/dev/cloudData';
import { seedSwapDraftWorld } from './fixtures/swapDraftWorld';
import {
  conditionalState,
  prepareConditionalTrade,
  applyConditionalTrade,
  conditionalDraft,
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
  'Protected emulators and retained catalogue required.'
);
const proofDir =
  process.env.SCOUTZERO_BROWSER_PROOF_DIR ?? 'tmp/swap-lifecycle';
const affected = ['WAS', 'MIA', 'PHX', 'ORL'];
async function capture(page: Page, key: string) {
  fs.mkdirSync(proofDir, { recursive: true });
  await page.screenshot({ path: path.join(proofDir, `${key}-1280x720.png`) });
}
function receipt(name: string, value: unknown) {
  fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(
    path.join(proofDir, `${name}.json`),
    JSON.stringify(value, null, 2)
  );
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
test.afterAll(() => {
  const files = ['exercise', 'waive'].map((k) =>
    path.join(proofDir, `proof-${k}.json`)
  );
  if (files.every((f) => fs.existsSync(f))) {
    const journeys = files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
    if (
      journeys.every(
        (j) => j.candidate === process.env.SCOUTZERO_PROOF_CANDIDATE
      )
    )
      receipt('proof', {
        candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
        scope: 'governed-simulation-only',
        packageSha256: journeys[0].packageSha256,
        journeys,
      });
  }
});

for (const choice of ['exercise', 'waive'] as const)
  test(`ordered swap ${choice}: trade, all participants, season and reload`, async ({
    page,
  }) => {
    await page.goto('/gm/WAS?season=2026');
    await expect
      .poll(() => readReviewUserId(page), { timeout: 30000 })
      .not.toBe('');
    const uid = await readReviewUserId(page),
      worldId = `swap_${choice}_${Date.now()}`;
    const { program, catalogue, considerationId, rightId, laterId, original } =
      await seedSwapDraftWorld(uid, worldId);
    const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
    const initial = await conditionalState(worldId);
    const sourceBefore = await sourceState();
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
    const picker = dialog
      .locator('label', { hasText: /^Select Team$/ })
      .locator('xpath=following-sibling::select[1]');
    if (!(await picker.count()))
      await dialog.getByRole('button', { name: /^Add Team$/ }).click();
    await picker.first().selectOption('heat');
    await expect(dialog.getByTestId('trade-team-card-MIA')).toContainText(
      'Miami Heat'
    );
    await select(
      page,
      dialog.getByTestId('trade-team-card-WAS'),
      rightId,
      'Miami Heat'
    );
    await select(
      page,
      dialog.getByTestId('trade-team-card-MIA'),
      considerationId,
      'Washington Wizards'
    );
    await dialog.getByRole('button', { name: /^Validate Trade$/ }).click();
    await expect(
      dialog.getByRole('button', { name: /^Apply Trade$/ })
    ).toBeEnabled({ timeout: 120000 });
    await capture(page, `${choice}-proposal`);
    await dialog.getByTestId('trade-summary-button').click();
    await expect(
      page.getByTestId('trade-export-simulation-notice').last()
    ).toContainText('not verified NBA trade legality');
    // Both capture copies must identify a swap right separately from the original consideration.
    await expect(
      page.getByText('Swap Option', { exact: true }).last()
    ).toBeVisible();
    await expect(
      page.getByTestId('trade-export-swap-terms').last()
    ).toContainText(
      '2. ORL slot: more favorable of ORL / PHX slots after prior claims'
    );
    await capture(page, `${choice}-export`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download', exact: true }).click(),
    ]);
    await download.saveAs(path.join(proofDir, `${choice}-trade-export.png`));
    await page.getByTitle('Close', { exact: true }).click();
    const timeOrigin = await page.evaluate(() => performance.timeOrigin);
    await dialog.getByRole('button', { name: /^Apply Trade$/ }).click();
    await expect
      .poll(async () => (await root.collection('events').get()).size, {
        timeout: 120000,
      })
      .toBe(1);
    await expect(dialog).toBeHidden({ timeout: 30000 });
    await expect(page).not.toHaveURL(/[?&]room=trade(?:&|$)/);
    expect(
      (await root.collection('entitlements').doc(rightId).get()).data()!
        .holderTeam
    ).toBe('MIA');
    // Trading only the option must leave every underlying pool pick untouched.
    for (const slot of program.slots)
      expect(
        (
          await root.collection('entitlements').doc(slot.entitlementId).get()
        ).data()!.holderTeam
      ).toBe(slot.holderTeam);
    dialog = await room(page);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
    await expect(
      dialog.getByRole('region', { name: 'Swap pool' })
    ).toContainText('1. MIA:');
    for (const [team, position] of Object.entries({ WAS: 20, PHX: 5, ORL: 25 }))
      await dialog.getByLabel(`${team} draft position`).fill(String(position));
    await dialog.getByLabel('MIA WAS swap choice').selectOption(choice);
    await dialog.getByLabel('ORL ORL swap choice').selectOption('exercise');
    await Promise.all([
      page.waitForEvent('load', { timeout: 120000 }),
      dialog.getByRole('button', { name: 'Resolve 2026 draft' }).click(),
    ]);
    await expect
      .poll(async () => (await root.collection('events').get()).size, {
        timeout: 120000,
      })
      .toBe(2);
    // Independently derived from the stated order: WAS first chooses PHX #5 or
    // waives. ORL then exchanges #25 for the selection left in PHX's slot.
    const allocation = {
      [original('WAS')]: choice === 'exercise' ? 'ORL' : 'MIA',
      [original('PHX')]: choice === 'exercise' ? 'MIA' : 'ORL',
      [original('ORL')]: 'PHX',
    };
    expect((await root.get()).data()!.draftSwapProgram.result).toEqual({
      positions: { WAS: 20, PHX: 5, ORL: 25 },
      elections: { [rightId]: choice === 'exercise', [laterId]: true },
      allocation,
    });
    dialog = await room(page);
    await capture(page, `${choice}-draft`);
    const expectedDelta: Record<string, string[]> = {
      WAS: ['WAS 2026 first-round swap right', 'MIA 2029 first-round pick'],
      MIA: [
        'WAS 2026 first-round swap right',
        'MIA 2029 first-round pick',
        ...(choice === 'exercise'
          ? ['WAS 2026 first-round pick', 'PHX 2026 first-round pick']
          : []),
      ],
      PHX: ['PHX 2026 first-round pick', 'ORL 2026 first-round pick'],
      ORL: [
        'ORL 2026 first-round pick',
        `${choice === 'exercise' ? 'WAS' : 'PHX'} 2026 first-round pick`,
      ],
    };
    for (const team of affected) {
      await page.goto(`/gm/${team}?season=2026`);
      await openDashboardTab(page, 'Team History');
      const timeline = page.getByTestId('team-history-section-timeline');
      await expect(timeline).toContainText('Draft Obligation Resolved');
      await timeline
        .getByRole('button')
        .filter({ hasText: '2026 swap pool resolved' })
        .click();
      await expect(
        page.getByTestId('team-history-detail-sections')
      ).toContainText('at pick 25');
      await capture(page, `${choice}-${team}-history`);
      await page.getByTestId('team-history-detail-close').click();
      await openDashboardTab(page, 'Compare');
      for (const text of expectedDelta[team])
        await expect(page.getByText(text, { exact: true })).toBeVisible();
      await capture(page, `${choice}-${team}-compare`);
      await page.reload();
      await openDashboardTab(page, 'Compare');
      for (const text of expectedDelta[team])
        await expect(page.getByText(text, { exact: true })).toBeVisible();
      await capture(page, `${choice}-${team}-reload`);
      const expand = page.getByRole('button', { name: 'Expand activity rail' });
      if (await expand.isVisible()) await expand.click();
      await page.getByTestId('cockpit-activity-rail-assets-open').click();
      const picks = program.slots.filter(
        (s) => allocation[s.entitlementId] === team
      );
      for (const slot of picks)
        await expect(
          page.getByTestId('cockpit-assets-panel-picks-2026-first')
        ).toContainText(
          slot.originalTeam === team ? 'Own' : `via ${slot.originalTeam}`
        );
      if (team === 'MIA')
        await expect(
          page.getByTestId('cockpit-assets-panel-rights-2026')
        ).toContainText('WAS swap right — resolved');
      await capture(page, `${choice}-${team}-assets`);
      await page.keyboard.press('Escape');
      const inventoryRoom = await room(page),
        card = inventoryRoom.getByTestId(`trade-team-card-${team}`);
      await card
        .getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i })
        .click();
      const inventory = (await root.collection('teams').doc(team).get()).data()!
        .entitlementIds;
      for (const id of [
        rightId,
        considerationId,
        ...program.slots.map((s) => s.entitlementId),
      ]) {
        const holder =
          id === rightId
            ? 'MIA'
            : id === considerationId
              ? 'WAS'
              : allocation[id];
        expect(inventory.includes(id)).toBe(holder === team);
        await expect(card.locator(`[data-entitlement-id="${id}"]`)).toHaveCount(
          holder === team ? 1 : 0
        );
      }
    }
    await page.goto('/gm/MIA?season=2026');
    dialog = await room(page);
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
    await expect(page).toHaveURL(/season=2027/);
    await capture(page, `${choice}-season`);
    for (const team of affected) {
      await page.goto(`/gm/${team}?season=2027`);
      await openDashboardTab(page, 'Compare');
      for (const text of expectedDelta[team])
        await expect(page.getByText(text, { exact: true })).toBeVisible();
    }
    const final = await conditionalState(worldId);
    const laterSeason = await page.evaluate(async (worldId) => {
      const modulePath = '/src/features/architect/utils/seasonManager.ts';
      const { advanceSeasonInWorld } = await import(modulePath);
      return advanceSeasonInWorld(worldId, { fromSeason: '2026-27' });
    }, worldId);
    expect(laterSeason.success).toBe(false);
    expect(await conditionalState(worldId)).toEqual(final);
    const initialEntitlements = initial.children.find(
      (c) => c.name === 'entitlements'
    )!.docs;
    const finalEntitlements = final.children.find(
      (c) => c.name === 'entitlements'
    )!.docs;
    const withoutHolders = (docs: typeof initialEntitlements) =>
      docs.map(({ id, data: { holderTeam, ...terms } }) => ({ id, terms }));
    expect(finalEntitlements).toHaveLength(278);
    expect(withoutHolders(finalEntitlements)).toEqual(
      withoutHolders(initialEntitlements)
    );
    expect(final.metadata!.draftSimulationUnresolved).toEqual(
      catalogue.data.unresolved
    );
    expect(await sourceState()).toEqual(sourceBefore);
    receipt(`proof-${choice}`, {
      candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
      scope: 'governed-simulation-only',
      packageSha256: createHash('sha256')
        .update(fs.readFileSync(process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE!))
        .digest('hex'),
      catalogue: 278,
      unresolved: 29,
      choice,
      allocation,
      metadata: final.metadata,
      events: final.children.find((c) => c.name === 'events')!.docs,
      sourceUnchanged: true,
      allAffectedTeams: affected,
      teamPlan: true,
      export: true,
      reload: true,
    });
  });

test('swap review and resolution reject incomplete, competing, ownership, Stepien, stale and duplicate actions without writes', async ({
  page,
}) => {
  await page.goto('/gm/WAS?season=2026');
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  const uid = await readReviewUserId(page),
    worldId = `swap_negative_${Date.now()}`;
  const { program, rightId, laterId, considerationId, original } =
    await seedSwapDraftWorld(uid, worldId);
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`),
    ids = [rightId, considerationId];
  const sourceBefore = await sourceState();
  const prepare = (outgoing = ids) =>
    prepareConditionalTrade(page, uid, worldId, outgoing, ['WAS', 'MIA']);
  async function rejectProgram(value: unknown, reason?: RegExp) {
    await root.update({ draftSwapProgram: value });
    const before = await conditionalState(worldId),
      result = await prepare();
    expect(result.status).toBe('error');
    if (reason) expect(JSON.stringify(result)).toMatch(reason);
    expect(await conditionalState(worldId)).toEqual(before);
    await root.update({ draftSwapProgram: program });
  }
  await rejectProgram(
    { ...program, steps: [program.steps[0]] },
    /competing|Every participant/
  );
  await rejectProgram(
    { ...program, steps: [program.steps[0]], slots: program.slots.slice(0, 2) },
    /competing/
  );
  await rejectProgram(
    { ...program, steps: [program.steps[1], program.steps[0]] },
    /source-named pool/
  );
  await rejectProgram(
    {
      ...program,
      slots: program.slots.map((s) =>
        s.originalTeam === 'WAS' ? { ...s, holderTeam: 'WAS' } : s
      ),
    },
    /ownership/
  );
  await rejectProgram({ ...program, inactiveClaimIds: [laterId] });
  const pristine = await conditionalState(worldId);
  expect((await prepare([original('WAS'), considerationId])).status).toBe(
    'error'
  );
  // Giving away consecutive MIA 2028/2029 originals leaves no retained witness
  // in that pair; unrelated unknown inventory cannot stand in for one.
  expect(await prepare([...ids, original('MIA', 2028)])).toMatchObject({
    status: 'blocked',
  });
  expect(await conditionalState(worldId)).toEqual(pristine);
  const teamRef = root.collection('teams').doc('WAS'),
    books = (await teamRef.get()).data()!.salaryBookInputs;
  await teamRef.update({ salaryBookInputs: null });
  const missingBooks = await conditionalState(worldId);
  expect(await prepare()).toMatchObject({ status: 'prepared', legal: false });
  expect((await applyConditionalTrade(page)).success).toBe(false);
  expect(await conditionalState(worldId)).toEqual(missingBooks);
  await teamRef.update({ salaryBookInputs: books });
  expect(await prepare()).toMatchObject({ status: 'prepared', legal: true });
  const poolTeam = root.collection('teams').doc('ORL'),
    priorPoolTeam = (await poolTeam.get()).data()!;
  await poolTeam.update({ testConcurrentChange: 'pool-participant' });
  const changedPool = await conditionalState(worldId);
  expect((await applyConditionalTrade(page)).success).toBe(false);
  expect(await conditionalState(worldId)).toEqual(changedPool);
  await poolTeam.set(priorPoolTeam);
  expect(await prepare()).toMatchObject({ status: 'prepared', legal: true });
  await root.update({ draftInventoryRevision: 1 });
  const stale = await conditionalState(worldId);
  expect((await applyConditionalTrade(page)).success).toBe(false);
  expect(await conditionalState(worldId)).toEqual(stale);
  expect(await prepare()).toMatchObject({ status: 'prepared', legal: true });
  expect((await applyConditionalTrade(page)).success).toBe(true);
  const traded = await conditionalState(worldId);
  expect((await applyConditionalTrade(page)).success).toBe(false);
  expect(await conditionalState(worldId)).toEqual(traded);
  const request = {
    operationId: 'swap_resolution',
    draftYear: 2026,
    expectedRevision: Number(traded.metadata!.draftInventoryRevision),
    positions: { WAS: 20, PHX: 5, ORL: 25 },
    elections: { [rightId]: true, [laterId]: true },
  };
  for (const invalid of [
    { ...request, positions: { WAS: 20, PHX: 5 } }, // ORL could exchange the remaining selection.
    { ...request, positions: { WAS: 20, PHX: 5, ORL: 5 } },
    { ...request, positions: { WAS: 20, PHX: 5, ORL: 31 } },
    { ...request, elections: { [rightId]: true } },
    { ...request, expectedRevision: request.expectedRevision - 1 },
    { ...request, draftYear: 2027 },
  ]) {
    expect((await conditionalDraft(page, worldId, invalid)).success).toBe(
      false
    );
    expect(await conditionalState(worldId)).toEqual(traded);
  }
  const outcomes = await Promise.all([
    conditionalDraft(page, worldId, request),
    conditionalDraft(page, worldId, { ...request, operationId: 'race' }),
  ]);
  expect(outcomes.filter((r) => r.success)).toHaveLength(1);
  const resolved = await conditionalState(worldId);
  expect((await conditionalDraft(page, worldId, request)).success).toBe(false);
  expect(
    (
      await conditionalDraft(page, worldId, {
        ...request,
        operationId: 'retry',
        expectedRevision: Number(resolved.metadata!.draftInventoryRevision),
      })
    ).success
  ).toBe(false);
  expect(await conditionalState(worldId)).toEqual(resolved);
  expect((await root.collection('events').get()).size).toBe(2);
  expect(await sourceState()).toEqual(sourceBefore);
  receipt('negative-proof', {
    candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
    scope: 'governed-simulation-only',
    missingPoolParticipantNoWrite: true,
    competingClaimsNoWrite: true,
    missingPriorityNoWrite: true,
    missingElectionNoWrite: true,
    ownershipNoWrite: true,
    adverseStepienNoWrite: true,
    missingFinancialBooksNoWrite: true,
    staleTradeNoWrite: true,
    stalePoolParticipantNoWrite: true,
    duplicateTradeNoWrite: true,
    staleDraftNoWrite: true,
    duplicateDraftNoWrite: true,
    concurrentDraftOnce: true,
    sourceUnchanged: true,
  });
});
