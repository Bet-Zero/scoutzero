import { test, expect, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadSnapshot, coverage } from '../../scripts/dev/cloudData';
import { seedConditionalDraftWorld } from './fixtures/conditionalDraftWorld';
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
test.setTimeout(420000);
test.skip(
  process.env.PLAYWRIGHT_DRAFT_SIMULATION !== 'true' ||
    !process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE,
  'Requires the protected emulator and exact private catalogue.'
);
const proofDir =
  process.env.SCOUTZERO_BROWSER_PROOF_DIR ?? 'tmp/conditional-lifecycle';
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
test.afterAll(() => {
  const files = [10, 11].map((p) => path.join(proofDir, `proof-${p}.json`));
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

async function selectPick(
  page: Page,
  card: Locator,
  entitlementId: string,
  destination: string
) {
  await card.getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i }).click();
  const row = card.locator(`[data-entitlement-id="${entitlementId}"]`);
  await row.getByRole('button', { name: '•••' }).click();
  await page
    .getByRole('button', { name: `Trade to ${destination}`, exact: true })
    .click();
}
async function tradeRoom(page: Page) {
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  if (new URL(page.url()).searchParams.get('room') !== 'trade')
    await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
  await expect(
    dialog.getByRole('region', { name: 'Conditional draft obligations' })
  ).toBeVisible({ timeout: 30000 });
  return dialog;
}
for (const position of [10, 11])
  test(`protected first: position ${position} through saved-world lifecycle`, async ({
    page,
  }) => {
    await page.goto('/gm/TOR?season=2026');
    await expect
      .poll(() => readReviewUserId(page), { timeout: 30000 })
      .not.toBe('');
    const uid = await readReviewUserId(page);
    const worldId = `conditional_${position}_${Date.now()}`;
    const { program, catalogue, considerationId } =
      await seedConditionalDraftWorld(uid, worldId);
    const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
    const contractIdentities = async () =>
      Promise.all(
        ['TOR', 'MIA'].map(async (team) =>
          (await root.collection('teams').doc(team).get())
            .data()!
            .players.map(
              (p: { id: string; contract: { contractId?: string } }) => ({
                id: p.id,
                contractId: p.contract.contractId,
              })
            )
        )
      );
    const initialContractIdentities = await contractIdentities();
    expect(
      initialContractIdentities
        .flat()
        .every((p) => typeof p.contractId === 'string')
    ).toBe(true);
    const sourceBefore = await sourceState();
    const actualSource = await loadSnapshot();
    if (process.env.SCOUTZERO_DRAFT_SIMULATION_BASELINE)
      expect(
        coverage(
          JSON.parse(
            fs.readFileSync(
              process.env.SCOUTZERO_DRAFT_SIMULATION_BASELINE,
              'utf8'
            )
          )
        ).sha256
      ).toBe(coverage(actualSource).sha256);
    await page.evaluate(
      ({ uid, worldId }) => {
        localStorage.setItem(`architect.activeWorldId.${uid}`, worldId);
        localStorage.setItem('hz.currentSeasonEndYear', '2026');
      },
      { uid, worldId }
    );
    await page.reload();
    const dialog = await tradeRoom(page);
    await expect(dialog.getByTestId('trade-team-card-TOR')).toBeVisible({
      timeout: 30000,
    });
    const picker = dialog
      .locator('label', { hasText: /^Select Team$/ })
      .locator('xpath=following-sibling::select[1]');
    if (!(await picker.count()))
      await dialog.getByRole('button', { name: /^Add Team$/ }).click();
    await picker.first().selectOption('heat');
    await expect(dialog.getByTestId('trade-team-card-MIA')).toContainText(
      'Miami Heat'
    );
    await selectPick(
      page,
      dialog.getByTestId('trade-team-card-TOR'),
      program.stages[0].entitlementId,
      'Miami Heat'
    );
    await selectPick(
      page,
      dialog.getByTestId('trade-team-card-MIA'),
      considerationId,
      'Toronto Raptors'
    );
    await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
    await expect(
      dialog.getByRole('button', { name: /^Apply Trade$/i })
    ).toBeEnabled({ timeout: 30000 });
    await capture(page, `${position}-proposal`);
    const documentStartedAt = await page.evaluate(() => performance.timeOrigin);
    await dialog.getByRole('button', { name: /^Apply Trade$/i }).click();
    await expect
      .poll(async () => (await root.collection('events').get()).size, {
        timeout: 120000,
      })
      .toBe(1);
    expect(await contractIdentities()).toEqual(initialContractIdentities);
    await expect(dialog).toBeHidden({ timeout: 30000 });
    // Closing the mounted overlay and clearing its route settle separately.
    // Reopen only once the preceding close has finished updating the URL.
    await expect(page).not.toHaveURL(/[?&]room=trade(?:&|$)/);
    let room = await tradeRoom(page);
    await expect(
      room.getByRole('region', { name: 'Conditional draft obligations' })
    ).toContainText('2026 first — top 10 protected; held by MIA');
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(
      documentStartedAt
    );
    await room.getByLabel('TOR draft position').fill(String(position));
    await Promise.all([
      page.waitForEvent('load', { timeout: 120000 }),
      room.getByRole('button', { name: 'Resolve 2026 draft' }).click(),
    ]);
    await expect
      .poll(async () => (await root.collection('events').get()).size, {
        timeout: 120000,
      })
      .toBe(2);
    const afterDraft = (await root.get()).data()!;
    expect(afterDraft.draftConditionalPrograms[0].results).toEqual([
      {
        year: 2026,
        position,
        outcome: position === 10 ? 'deferred' : 'conveyed',
      },
    ]);
    expect(
      (
        await root
          .collection('entitlements')
          .doc(program.stages[0].entitlementId)
          .get()
      ).data()!.holderTeam
    ).toBe(position === 10 ? 'TOR' : 'MIA');
    expect(
      (
        await root
          .collection('entitlements')
          .doc(program.stages[1].entitlementId)
          .get()
      ).data()!.holderTeam
    ).toBe(position === 10 ? 'MIA' : 'TOR');
    room = await tradeRoom(page);
    await capture(page, `${position}-draft`);
    await Promise.all([
      page.waitForEvent('load', { timeout: 120000 }),
      room.getByRole('button', { name: 'Advance to 2026–27' }).click(),
    ]);
    await expect
      .poll(async () => (await root.get()).data()?.currentSeason, {
        timeout: 120000,
      })
      .toBe('2026-27');
    expect((await root.collection('seasonHistory').get()).size).toBe(30);
    await expect(page).toHaveURL(/season=2027/);
    await expect(
      page.getByRole('button', { name: /Retained Picks.*2026-27/ })
    ).toBeVisible({ timeout: 30000 });
    await capture(page, `${position}-season`);
    if (position === 10) {
      room = await tradeRoom(page);
      await room.getByLabel('TOR draft position').fill('1');
      await Promise.all([
        page.waitForEvent('load', { timeout: 120000 }),
        room.getByRole('button', { name: 'Resolve 2027 draft' }).click(),
      ]);
      await expect
        .poll(async () => (await root.collection('events').get()).size, {
          timeout: 30000,
        })
        .toBe(4);
    }
    const metadata = (await root.get()).data()!;
    expect(metadata.draftSimulationUnresolved).toEqual(
      catalogue.data.unresolved
    );
    expect((await root.collection('entitlements').get()).size).toBe(278);
    for (const team of ['TOR', 'MIA']) {
      await page.goto(`/gm/${team}?season=2027`);
      await openDashboardTab(page, 'Team History');
      await expect(
        page.getByTestId('team-history-section-timeline')
      ).toContainText('Draft Obligation Resolved');
      for (const year of position === 10 ? [2027, 2026] : [2026]) {
        const outcome =
          year === 2026 && position === 10 ? 'deferred' : 'conveyed';
        const draftPosition = year === 2027 ? 1 : position;
        await page
          .getByTestId('team-history-section-timeline')
          .getByRole('button')
          .filter({ hasText: `${year} first-round pick ${outcome}` })
          .click();
        await expect(
          page.getByTestId('team-history-detail-sections')
        ).toContainText(
          `${year} first-round pick ${outcome} at pick ${draftPosition}${outcome === 'deferred' ? '; 2027 first owed to Miami Heat' : ' to Miami Heat'}`
        );
        if (year === 2026) await capture(page, `${position}-${team}-history`);
        await page.getByTestId('team-history-detail-close').click();
      }
      await openDashboardTab(page, 'Compare');
      await expect(
        page.getByText(
          `TOR ${position === 10 ? 2027 : 2026} first-round pick`,
          { exact: true }
        )
      ).toBeVisible();
      await capture(page, `${position}-${team}-compare`);
      await page.reload();
      await openDashboardTab(page, 'Compare');
      await expect(
        page.getByText(
          `TOR ${position === 10 ? 2027 : 2026} first-round pick`,
          { exact: true }
        )
      ).toBeVisible();
      await capture(page, `${position}-${team}-reload`);
      const inventory = (await root.collection('teams').doc(team).get()).data()!
        .entitlementIds;
      const delivered = program.stages[position === 10 ? 1 : 0].entitlementId;
      expect(inventory.includes(delivered)).toBe(team === 'MIA');
      const inventoryRoom = await tradeRoom(page);
      const card = inventoryRoom.getByTestId(`trade-team-card-${team}`);
      await card
        .getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i })
        .click();
      await expect(
        card.locator(`[data-entitlement-id="${delivered}"]`)
      ).toHaveCount(team === 'MIA' ? 1 : 0);
    }
    expect(await sourceState()).toEqual(sourceBefore);
    receipt(`proof-${position}`, {
      candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
      scope: 'governed-simulation-only',
      packageSha256: createHash('sha256')
        .update(fs.readFileSync(process.env.SCOUTZERO_DRAFT_REVIEW_RELEASE!))
        .digest('hex'),
      catalogue: 278,
      unresolved: 29,
      position,
      metadata,
      events: (await root.collection('events').get()).docs.map((d) => d.data()),
      sourceUnchanged: true,
      bothTeams: true,
      reload: true,
    });
  });

test('conditional transactions fail closed without writes and apply each draft once', async ({
  page,
}) => {
  await page.goto('/gm/TOR?season=2026');
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  const uid = await readReviewUserId(page);
  const worldId = `conditional_negative_${Date.now()}`;
  // The retained Brooklyn inventory has competing swap controllers. Preserve
  // that actual writer rejection; no fixture or runtime exemption removes it.
  const competingWorld = `${worldId}_competing`;
  const competing = await seedConditionalDraftWorld(
    uid,
    competingWorld,
    'TOR',
    'BKN'
  );
  const competingBefore = await conditionalState(competingWorld);
  const rejected = await prepareConditionalTrade(
    page,
    uid,
    competingWorld,
    [competing.program.stages[0].entitlementId, competing.considerationId],
    ['TOR', 'BKN']
  );
  expect(rejected.status).toBe('error');
  expect(JSON.stringify(rejected)).toContain('DUP_SWAP_CONTROLLER');
  expect(await conditionalState(competingWorld)).toEqual(competingBefore);
  const { program, considerationId, catalogue } =
    await seedConditionalDraftWorld(uid, worldId);
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const sourceBefore = await sourceState();
  const ids = [program.stages[0].entitlementId, considerationId];
  const pristine = await conditionalState(worldId);
  const rejectProgram = async (programs: unknown) => {
    await root.update({ draftConditionalPrograms: programs });
    const before = await conditionalState(worldId);
    expect(
      (await prepareConditionalTrade(page, uid, worldId, ids)).status
    ).toBe('error');
    expect(await conditionalState(worldId)).toEqual(before);
    await root.update({ draftConditionalPrograms: [program] });
  };
  await rejectProgram([{ ...program, stages: [program.stages[0]] }]);
  await rejectProgram([program, { ...program, id: 'competing' }]);
  await rejectProgram([
    {
      ...program,
      results: [{ year: 2026, position: 10, outcome: 'conveyed' }],
    },
  ]);
  const adverse = catalogue.data.records.find(
    (r) => r.originalPick?.id === 'TOR_2028_1st'
  )!.entitlementId;
  expect(
    await prepareConditionalTrade(page, uid, worldId, [...ids, adverse])
  ).toMatchObject({ status: 'blocked' });
  expect(
    (
      await prepareConditionalTrade(page, uid, worldId, [
        program.stages[1].entitlementId,
        considerationId,
      ])
    ).status
  ).toBe('error');
  expect(await conditionalState(worldId)).toEqual(pristine);
  const originTeam = root.collection('teams').doc('TOR');
  const originalBooks = (await originTeam.get()).data()!.salaryBookInputs;
  await originTeam.update({ salaryBookInputs: null });
  const incompleteBooks = await conditionalState(worldId);
  expect(await prepareConditionalTrade(page, uid, worldId, ids)).toMatchObject({
    status: 'prepared',
    legal: false,
  });
  expect((await applyConditionalTrade(page)).success).toBe(false);
  expect(await conditionalState(worldId)).toEqual(incompleteBooks);
  await originTeam.update({ salaryBookInputs: originalBooks });
  expect(await prepareConditionalTrade(page, uid, worldId, ids)).toMatchObject({
    status: 'prepared',
    legal: true,
  });
  await root.update({ draftInventoryRevision: 1 });
  const stale = await conditionalState(worldId);
  expect((await applyConditionalTrade(page)).success).toBe(false);
  expect(await conditionalState(worldId)).toEqual(stale);
  expect(await prepareConditionalTrade(page, uid, worldId, ids)).toMatchObject({
    status: 'prepared',
    legal: true,
  });
  expect((await applyConditionalTrade(page)).success).toBe(true);
  const traded = await conditionalState(worldId);
  expect((await applyConditionalTrade(page)).success).toBe(false);
  expect(await conditionalState(worldId)).toEqual(traded);
  const request = {
    operationId: 'draft_negative',
    expectedRevision: Number(traded.metadata!.draftInventoryRevision),
    draftYear: 2026,
    positions: { TOR: 10 },
  };
  for (const invalid of [
    { ...request, operationId: 'invalid/path' },
    { ...request, expectedRevision: request.expectedRevision - 1 },
    { ...request, positions: {} },
    { ...request, positions: { TOR: 31 } },
    { ...request, positions: { TOR: 10, BKN: 10 } },
    { ...request, draftYear: 2027 },
  ]) {
    expect((await conditionalDraft(page, worldId, invalid)).success).toBe(
      false
    );
    expect(await conditionalState(worldId)).toEqual(traded);
  }
  const outcomes = await Promise.all([
    conditionalDraft(page, worldId, request),
    conditionalDraft(page, worldId, { ...request, operationId: 'draft_race' }),
  ]);
  expect(outcomes.filter((r) => r.success)).toHaveLength(1);
  const deferred = await conditionalState(worldId);
  expect((await conditionalDraft(page, worldId, request)).success).toBe(false);
  expect(
    (
      await conditionalDraft(page, worldId, {
        ...request,
        operationId: 'draft_retry',
        expectedRevision: Number(deferred.metadata!.draftInventoryRevision),
      })
    ).success
  ).toBe(false);
  expect(await conditionalState(worldId)).toEqual(deferred);
  expect((await root.collection('events').get()).size).toBe(2);
  expect(await sourceState()).toEqual(sourceBefore);
  receipt('negative-proof', {
    candidate: process.env.SCOUTZERO_PROOF_CANDIDATE,
    scope: 'governed-simulation-only',
    incompleteTerms: true,
    competingClaims: true,
    retainedCompetingSwapClaimsNoWrite: true,
    inconsistentOutcome: true,
    adverseStepienBranch: true,
    reservedFallback: true,
    staleTrade: true,
    retryTrade: true,
    staleDraft: true,
    invalidDraftPositions: true,
    concurrentDraftOnce: true,
    retryDraft: true,
    sourceUnchanged: true,
    missingFinancialBooksNoWrite: true,
  });
});
