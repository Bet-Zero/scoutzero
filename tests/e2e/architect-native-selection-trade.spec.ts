import { test, expect, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { coverage, loadSnapshot } from '../../scripts/dev/cloudData';
import { seedOverlappingDraftPoolWorld } from './fixtures/overlappingDraftPoolWorld';
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

const overlapping =
  process.env.SCOUTZERO_NATIVE_TRADE_FAMILY === 'overlapping-2028';
const year = overlapping ? 2028 : 2029;
const home = overlapping ? 'BKN' : 'HOU';
const away = overlapping ? 'WAS' : 'BKN';
const termsPath = overlapping
  ? process.env.SCOUTZERO_DRAFT_OVERLAPPING_POOL
  : process.env.SCOUTZERO_DRAFT_NATIVE_POOL;
const teams = overlapping
  ? ['BKN', 'PHX', 'PHI', 'NYK', 'WAS', 'POR', 'MIL', 'GSW']
  : ['HOU', 'BKN', 'DAL', 'PHX'];

test.use({
  viewport: { width: 1280, height: 720 },
  actionTimeout: 15000,
  trace: 'on',
});
test.setTimeout(600000);
test.skip(
  process.env.PLAYWRIGHT_DRAFT_SIMULATION !== 'true' || !termsPath,
  'Protected catalogue and native terms required.'
);
const proofDir =
  process.env.SCOUTZERO_BROWSER_PROOF_DIR ?? 'tmp/native-selection-trade';
const date = {
  seasonId: `${year - 1}-${String(year).slice(-2)}`,
  asOfDate: `${year}-06-20`,
  yearKey: year,
};
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
  await page.goto(`/gm/${home}?season=${year}`);
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  const uid = await readReviewUserId(page),
    worldId = `native_trade_${name}_${Date.now()}`;
  const fixture = overlapping
    ? await seedOverlappingDraftPoolWorld(uid, worldId, preDraft, true)
    : await seedNativeDraftPoolWorld(uid, worldId, preDraft);
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  if (!completeStepien)
    await root.update({ 'draftNativeLifecycle.softwareRetainedFirsts': [] });
  await page.evaluate(
    ({ uid, worldId, year }) => {
      localStorage.setItem(`architect.activeWorldId.${uid}`, worldId);
      localStorage.setItem('hz.currentSeasonEndYear', String(year));
    },
    { uid, worldId, year }
  );
  await page.reload();
  let dialog = await room(page);
  const positions: Record<string, number> = overlapping
    ? { BKN: 20, PHX: 3, PHI: 9, NYK: 6, WAS: 14, POR: 27, MIL: 25 }
    : { DAL: 3, PHX: 14, HOU: 27 };
  for (const [team, position] of Object.entries(positions))
    await dialog.getByLabel(`${team} draft position`).fill(String(position));
  if (overlapping) {
    for (let i = 1; i <= 5; i++)
      await dialog.getByLabel(`Claim ${i} election`).selectOption('exercise');
  } else await dialog.getByLabel('Pool election').selectOption('exercise');
  await Promise.all([
    page.waitForEvent('load', { timeout: 120000 }),
    dialog.getByRole('button', { name: `Resolve ${year} draft` }).click(),
  ]);
  await expect
    .poll(async () => (await root.collection('events').get()).size, {
      timeout: 120000,
    })
    .toBe(1);
  const ids = Object.fromEntries(
    fixture.program.slots.map((s) => [s.originalTeam, s.entitlementId])
  );
  const originals = overlapping
    ? ['BKN_2030_1st', 'GSW_2030_1st'].map(
        (id) =>
          fixture.catalogue.data.records.find((r) => r.originalPick?.id === id)!
            .entitlementId
      )
    : [];
  return { ...fixture, uid, worldId, root, ids, positions, originals };
}

test('resolved selections can be traded twice through Trade Machine and recovered in every affected view', async ({
  page,
}) => {
  const { worldId, root, ids, positions, catalogue, originals } = await start(
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
    await root.collection('events').doc(`swapDraft__${year}`).get()
  ).data();
  expect(before.metadata!.asOfDate).toBe(date.asOfDate);
  for (const [index, pair] of [
    ...(overlapping
      ? [
          [ids.PHX, ids.WAS],
          [ids.PHI, ids.PHX],
        ]
      : [
          [ids.DAL, ids.HOU],
          [ids.PHX, ids.DAL],
        ]),
  ].entries()) {
    await page.goto(`/gm/${home}?season=${year}`);
    const dialog = await room(page);
    // The draft summary and team cards hydrate independently. Wait for the
    // home card before choosing the empty slot, or a slow load can replace it.
    await expect(dialog.getByTestId(`trade-team-card-${home}`)).toBeVisible();
    const picker = dialog
      .locator('label', { hasText: /^Select Team$/ })
      .locator('xpath=following-sibling::select[1]');
    if (!(await picker.count()))
      await dialog.getByRole('button', { name: /^Add Team$/ }).click();
    await picker.first().selectOption(overlapping ? 'wizards' : 'nets');
    await expect(dialog.getByTestId(`trade-team-card-${away}`)).toBeVisible();
    await select(
      page,
      dialog.getByTestId(`trade-team-card-${home}`),
      pair[0],
      overlapping ? 'Washington Wizards' : 'Brooklyn Nets'
    );
    await select(
      page,
      dialog.getByTestId(`trade-team-card-${away}`),
      pair[1],
      overlapping ? 'Brooklyn Nets' : 'Houston Rockets'
    );
    if (overlapping) {
      await select(
        page,
        dialog.getByTestId(`trade-team-card-${home}`),
        originals[index],
        'Washington Wizards'
      );
      await select(
        page,
        dialog.getByTestId(`trade-team-card-${away}`),
        originals[1 - index],
        'Brooklyn Nets'
      );
    }
    if (overlapping) {
      await dialog
        .getByRole('button', { name: 'Close Trade Machine', exact: true })
        .click();
      await openDashboardTab(page, 'Trade Machine');
    }
    await dialog.getByRole('button', { name: /^Validate Trade$/ }).click();
    await expect(
      dialog.getByRole('button', { name: /^Apply Trade$/ })
    ).toBeEnabled({ timeout: 120000 });
    await capture(page, `trade-${index}-legal`);
    if (overlapping && index === 0) {
      await dialog.getByTestId('trade-summary-button').click();
      await expect(
        page.getByTestId('trade-export-simulation-notice').last()
      ).toContainText('not verified NBA');
      for (const name of ['Brooklyn Nets', 'Washington Wizards']) {
        const exported = page
          .getByRole('heading', { name, exact: true })
          .last()
          .locator('xpath=ancestor::div[contains(@class,"shrink-0")][1]');
        for (const pickYear of [2028, 2030])
          await expect(
            exported.getByText(`${pickYear} R1`, { exact: true })
          ).toHaveCount(1);
        for (const original of name === 'Brooklyn Nets'
          ? ['WAS', 'GSW']
          : ['PHX', 'BKN'])
          await expect(
            exported.getByText(`${original} original`, { exact: true })
          ).toBeVisible();
      }
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Download', exact: true }).click(),
      ]);
      await download.saveAs(path.join(proofDir, 'composed-export.png'));
      await page.getByTitle('Close', { exact: true }).click();
    }
    await dialog.getByRole('button', { name: /^Apply Trade$/ }).click();
    await expect
      .poll(async () => (await root.collection('events').get()).size, {
        timeout: 120000,
      })
      .toBe(index + 2);
    await expect(dialog).toBeHidden({ timeout: 30000 });
    await page.reload();
    if (overlapping) {
      expect(
        (
          await root.collection('entitlements').doc(originals[index]).get()
        ).data()!.holderTeam
      ).toBe(away);
      expect(
        (
          await root
            .collection('entitlements')
            .doc(originals[1 - index])
            .get()
        ).data()!.holderTeam
      ).toBe(home);
    }
  }
  const holders: Record<string, string> = overlapping
    ? {
        BKN: 'PHX',
        PHX: 'BKN',
        PHI: 'WAS',
        NYK: 'NYK',
        WAS: 'BKN',
        POR: 'MIL',
        MIL: 'POR',
      }
    : { DAL: 'HOU', HOU: 'HOU', PHX: 'BKN' };
  for (const team of teams) {
    await page.goto(`/gm/${team}?season=${year}`);
    for (const phase of ['compare', 'reload']) {
      if (phase === 'reload') await page.reload();
      await openDashboardTab(page, 'Compare');
      for (const original of Object.keys(holders).filter(
        (t) => t === team || holders[t as keyof typeof holders] === team
      ))
        await expect(
          page.getByText(
            `${original} ${year} first: final pick ${positions[original as keyof typeof positions]} · held by ${holders[original as keyof typeof holders]}`,
            { exact: true }
          )
        ).toBeVisible();
      if (overlapping) {
        if (team === 'BKN')
          await expect(
            page.getByText('BKN 2030 first: held by BKN', { exact: true })
          ).toBeVisible();
        if (team === 'GSW' || team === 'WAS')
          await expect(
            page.getByText('GSW 2030 first: held by WAS', { exact: true })
          ).toBeVisible();
      }
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
        page.getByTestId(`cockpit-assets-panel-picks-${year}-first`)
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
    ).toContainText(
      overlapping ? 'Overlapping draft claims' : 'Native pooled selections'
    );
    await expect(
      page.getByTestId('cockpit-activity-rail-assets-picks')
    ).toBeVisible();
    await capture(page, `${team}-plan`);
  }
  const after = await conditionalState(worldId);
  expect(await sourceState()).toEqual(sourceBefore);
  expect(
    (await root.collection('events').doc(`swapDraft__${year}`).get()).data()
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
    if (originals.includes(row.id))
      expect(row.data.holderTeam).toBe(old.data.holderTeam);
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
      .update(fs.readFileSync(termsPath!))
      .digest('hex'),
    worldId,
    trades: 2,
    teams,
    views: teams.length * 5,
    preservedIdentities: 278,
    unresolved: 29,
    independentOriginals: originals,
    stagedCloseReopenAndExport: overlapping,
  });
});

test('native trades reject stale state, missing inputs, conflict, duplicate writes and closed timing atomically', async ({
  page,
}) => {
  const { uid, worldId, root, ids, originals } = await start(page, 'negative');
  const prepare = (asOfDate = date.asOfDate) =>
    prepareConditionalTrade(
      page,
      uid,
      worldId,
      overlapping ? [ids.PHX, ids.WAS, ...originals] : [ids.DAL, ids.HOU],
      [home, away],
      { ...date, asOfDate }
    );
  expect(await prepare()).toMatchObject({ status: 'prepared', legal: true });
  const selected = root
      .collection('entitlements')
      .doc(overlapping ? ids.PHX : ids.DAL),
    original = (await selected.get()).data()!;
  await selected.update({ holderTeam: overlapping ? 'NYK' : 'PHX' });
  const stale = await conditionalState(worldId);
  expect(await applyConditionalTrade(page)).toMatchObject({ success: false });
  expect(await conditionalState(worldId)).toEqual(stale);
  expect(await prepare()).not.toMatchObject({
    status: 'prepared',
    legal: true,
  });
  await selected.set(original);
  const metadata = (await root.get()).data()!;
  if (overlapping) {
    // Sending the retained 2030 first without a replacement fails Stepien.
    const before = await conditionalState(worldId);
    expect(
      await prepareConditionalTrade(
        page,
        uid,
        worldId,
        [ids.PHX, ids.WAS, originals[0]],
        [home, away],
        date
      )
    ).not.toMatchObject({ status: 'prepared', legal: true });
    expect(await conditionalState(worldId)).toEqual(before);
    // Admission cannot be retrofitted after the resolution receipt is frozen.
    await root.update({
      'draftNativeLifecycle.originalSelections': [
        metadata.draftNativeLifecycle.originalSelections[1],
      ],
    });
    const altered = await conditionalState(worldId);
    expect(await prepare()).not.toMatchObject({
      status: 'prepared',
      legal: true,
    });
    expect(await conditionalState(worldId)).toEqual(altered);
    await root.set(metadata);
  }
  for (const patch of [
    { asOfDate: `${year}-06-30` },
    { asOfDate: `${year}-06-19` },
    { draftNativeLifecycle: null },
    {
      draftNativeLifecycle: {
        ...metadata.draftNativeLifecycle,
        claimsEffectiveDate: `${year}-06-19`,
      },
    },
    {
      draftSwapProgram: {
        ...metadata.draftSwapProgram,
        result: {
          ...metadata.draftSwapProgram.result,
          allocation: {
            ...metadata.draftSwapProgram.result.allocation,
            [overlapping ? ids.PHX : ids.DAL]: away,
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
  const hou = root.collection('teams').doc(home),
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
    overlapping ? [ids.PHX, ids.WAS] : [ids.DAL, ids.HOU],
    [home, away],
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
