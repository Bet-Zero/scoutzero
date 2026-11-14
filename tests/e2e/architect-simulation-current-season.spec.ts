/** Real private current packages only. Software fixtures do not satisfy this proof. */
import { createHash } from 'node:crypto';
import {
  expect as baseExpect,
  test,
  type Locator,
  type Page,
} from '@playwright/test';
import {
  getReviewAdminDb,
  getWorldEventDocuments,
  getWorldTeamDocument,
  readReviewUserId,
} from './helpers/architectReviewWorld';
import { canonicalStringify } from '../../src/features/architect/utils/contractSource/deterministicDigest';
import { createCanonicalTeamTotalsSnapshot } from '../../src/features/architect/utils/capTotals/computeTeamCapTotals';

test.skip(
  process.env.SCOUTZERO_SIMULATION_FINANCIAL_PROOF !== 'true' ||
    process.env.SCOUTZERO_CURRENT_SEASON_PROOF !== 'true',
  'Requires both explicit proof gates and private current-season financial/draft packages.'
);
test.use({ viewport: { width: 1280, height: 720 }, actionTimeout: 30000 });
test.setTimeout(300000);
const expect = baseExpect.configure({ timeout: 30000 });
const PICKS = {
  CHI: 'ent:CHI:2028:1:own:2afbfb42',
  TOR: 'ent:TOR:2028:1:own:d917f516',
};

async function worldDigest(worldId: string) {
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const rows: Array<[string, unknown]> = [
    [root.path, (await root.get()).data()],
  ];
  // Architect persists its team, contract, draft and receipt documents in
  // these world subcollections; contract events are arrays inside their shards.
  for (const collection of await root.listCollections()) {
    const docs = (await collection.get()).docs;
    rows.push(
      ...docs.map((doc) => [doc.ref.path, doc.data()] as [string, unknown])
    );
  }
  return createHash('sha256')
    .update(
      canonicalStringify(
        JSON.parse(JSON.stringify(rows.sort(([a], [b]) => a.localeCompare(b))))
      )
    )
    .digest('hex');
}
async function openTrade(page: Page, team: string, slug: string, home = 'CHI') {
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  if (!(await dialog.isVisible()))
    await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
  await expect(dialog.getByTestId(`trade-team-card-${home}`)).toBeVisible({
    timeout: 60000,
  });
  const picker = dialog
    .locator('label', { hasText: /^Select Team$/ })
    .locator('xpath=following-sibling::select[1]');
  if (!(await picker.count()))
    await dialog.getByRole('button', { name: /^Add Team$/i }).click();
  await picker.first().selectOption(slug);
  await expect(dialog.getByTestId(`trade-team-card-${team}`)).toBeVisible();
  return dialog;
}
async function move(page: Page, row: Locator, name: string) {
  await row.getByRole('button', { name: '•••' }).click();
  await page
    .getByRole('button', { name: new RegExp(`^Trade to ${name}$`, 'i') })
    .click();
}
async function pick(
  page: Page,
  dialog: Locator,
  code: string,
  id: string,
  to: string
) {
  const card = dialog.getByTestId(`trade-team-card-${code}`);
  await card.getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i }).click();
  await move(page, card.locator(`[data-entitlement-id="${id}"]`), to);
}
async function player(
  page: Page,
  dialog: Locator,
  code: string,
  name: string,
  to: string
) {
  const card = dialog.getByTestId(`trade-team-card-${code}`);
  await card
    .getByRole('button', { name: /^(Players|Plr)( \(\d+\))?$/i })
    .click();
  await move(
    page,
    card
      .getByAltText(new RegExp(`^${name}$`, 'i'))
      .first()
      .locator('xpath=ancestor::div[.//button[normalize-space()="•••"]][1]'),
    to
  );
}
async function apply(dialog: Locator, worldId: string, count: number) {
  await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
  await expect(
    dialog.getByRole('button', { name: /^Apply Trade$/i })
  ).toBeEnabled({ timeout: 60000 });
  await dialog.getByRole('button', { name: /^Apply Trade$/i }).click();
  await expect
    .poll(async () => (await getWorldEventDocuments(worldId)).length, {
      timeout: 60000,
    })
    .toBe(count);
  await expect(dialog).toBeHidden();
}

async function electEqualSalaries(
  dialog: Locator,
  worldId: string,
  players: string[][]
) {
  for (const [code, name] of players) {
    const card = dialog.getByTestId(`trade-team-card-${code}`);
    await card
      .getByLabel('Elected path', { exact: true })
      .selectOption('STANDARD_TPE');
    const totals = createCanonicalTeamTotalsSnapshot(
      (await getWorldTeamDocument(worldId, code))!,
      2027,
      { asOfDate: '2026-11-14' }
    );
    await card
      .getByLabel('Post-assignment Apron Team Salary', { exact: true })
      .fill(String(totals.apronTeamSalary));
    await card
      .getByLabel(new RegExp(`^${name} exact pre-trade Salary$`, 'i'))
      .fill('8000000');
  }
}

test('current GM world: create, assumptions, pick and player-plus-pick trades, receipts, reload, copy and historical preservation', async ({
  page,
}) => {
  const olderId = process.env.SCOUTZERO_PRESERVED_WORLD_ID;
  if (!olderId)
    throw new Error(
      'Save a real historical world in this emulator session and supply SCOUTZERO_PRESERVED_WORLD_ID.'
    );
  const db = getReviewAdminDb();
  const older = (await db.doc(`architect_worlds/${olderId}`).get()).data();
  expect(older?.currentSeason).toBe('2025-26');
  const olderDigest =
    await test.step('Hash the preserved historical world', () =>
      worldDigest(olderId));
  console.log('Current proof: historical snapshot read.');
  await test.step('Open the current-season GM workspace', () =>
    page.goto('/gm/CHI?season=2027'));
  console.log('Current proof: workspace opened.');
  await expect.poll(() => readReviewUserId(page)).not.toBe('');
  const uid = await readReviewUserId(page);
  console.log('Current proof: signed in.');
  // Exercise the ordinary Create control, without passing a season override.
  await page.getByTestId('cockpit-world-menu-trigger').click();
  await expect(
    page.getByTitle('Create new world', { exact: true })
  ).toBeVisible();
  await page.getByTitle('Create new world', { exact: true }).click();
  await page
    .getByLabel('World Name', { exact: true })
    .fill('Current NBA starting world');
  page.once('dialog', async (confirmation) => {
    expect(confirmation.type()).toBe('confirm');
    await confirmation.accept();
  });
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(
    page.getByTestId('cockpit-activity-rail-identity')
  ).toContainText('SIMULATION', { timeout: 60000 });
  const worldId = await page.evaluate(
    (uid) => localStorage.getItem(`architect.activeWorldId.${uid}`)!,
    uid
  );
  const root = db.doc(`architect_worlds/${worldId}`);
  const metadata = (await root.get()).data()!;
  console.log('Current proof: world created.');
  expect(metadata.currentSeason).toBe('2026-27');
  expect(metadata.asOfDate).toBe('2026-11-14');
  expect(metadata.contractBaselineSalaryCapYear).toBe(2027);
  const timing = await page.evaluate(
    async ({ worldId }) => {
      const { loadWorldGovernedTradeSalaryBasisEntries } = await import(
        '/src/features/architect/utils/tradeMachine/utils/governedTradeSalaryBasis.ts'
      );
      const result: Record<string, unknown> = {};
      for (const [teamId, playerId] of [
        ['CHI', 'zach_collins'],
        ['MIA', 'andrew_wiggins'],
        ['TOR', 'kawhi_leonard'],
        ['PHX', 'dillon_brooks'],
      ]) {
        const entries = await loadWorldGovernedTradeSalaryBasisEntries({
          worldId,
          teamId,
          rosterPlayerIds: [playerId],
          worldAsOfDate: '2026-11-14',
          salaryCapYear: 2027,
        });
        result[playerId] = entries.get(playerId);
      }
      return result;
    },
    { worldId }
  );
  for (const id of ['zach_collins', 'andrew_wiggins'])
    expect(timing[id]).toMatchObject({ status: 'ready' });
  expect(timing.kawhi_leonard).toMatchObject({
    status: 'needs-input',
    reasons: [
      'This Contract has a trade bonus whose allocation is outside this governed tranche.',
    ],
  });
  expect(timing.dillon_brooks).toMatchObject({ status: 'needs-input' });
  expect(JSON.stringify(timing.dillon_brooks)).toContain(
    'extension salary change above 5%'
  );
  const teams = await root.collection('teams').get();
  expect(teams.size).toBe(30);
  const players = teams.docs.flatMap((t) => t.data().players);
  expect(players).toHaveLength(525);
  expect(
    players.filter(
      (p) => p.bio?.draftYear === '2026' || p.bio?.draftYear === 2026
    ).length
  ).toBeGreaterThanOrEqual(50);
  for (const t of teams.docs) {
    expect(t.data().players.length).toBeGreaterThanOrEqual(14);
    expect(t.data().salaryBookInputs.salaryCapYear).toBe(2027);
    expect(t.data().salaryBookInputs.taxSalary.status).toBe('needs-input');
  }
  // A November roster addition and a moved veteran prove this is not a relabel.
  expect(
    (await getWorldTeamDocument(worldId, 'CHI'))!.players.some(
      (p: { id: string }) => p.id === 'orlando_robinson'
    )
  ).toBe(true);
  expect(
    (await getWorldTeamDocument(worldId, 'WAS'))!.players.some(
      (p: { id: string }) => p.id === 'tre_mann'
    )
  ).toBe(true);
  if (!(await page.getByTestId('cockpit-world-menu-popover').isVisible()))
    await page.getByTestId('cockpit-world-menu-trigger').click();
  await expect(page.getByTestId('simulation-draft-assumptions')).toContainText(
    'Current-season'
  );
  await page.getByTestId('cockpit-world-menu-trigger').click();
  await page.getByTestId('simulation-assumptions-toggle').first().click();
  const assumptions = page.getByTestId('simulation-assumptions-panel').first();
  await expect(assumptions).toContainText(
    'Final 2026–27 Tax Salary is not yet known'
  );
  await expect(assumptions).toContainText('B5 is unresolved');
  await expect(assumptions).not.toContainText('June 5 postseason rosters');
  let dialog = await openTrade(page, 'TOR', 'raptors');
  await pick(page, dialog, 'CHI', PICKS.CHI, 'Toronto Raptors');
  await pick(page, dialog, 'TOR', PICKS.TOR, 'Chicago Bulls');
  await apply(dialog, worldId, 1);
  expect(
    (await getWorldTeamDocument(worldId, 'CHI'))!.entitlementIds
  ).toContain(PICKS.TOR);
  expect(
    (await getWorldEventDocuments(worldId))[0].metadata.draftReviewReceipt
      .movements
  ).toHaveLength(2);

  await page.reload();
  await expect(
    page.getByTestId('cockpit-activity-rail-identity')
  ).toContainText('SIMULATION');
  dialog = await openTrade(page, 'WAS', 'wizards');
  await player(page, dialog, 'CHI', 'TRE JONES', 'Washington Wizards');
  await player(page, dialog, 'WAS', 'TRE MANN', 'Chicago Bulls');
  await pick(page, dialog, 'CHI', PICKS.TOR, 'Washington Wizards');
  await electEqualSalaries(dialog, worldId, [
    ['CHI', 'TRE JONES'],
    ['WAS', 'TRE MANN'],
  ]);
  await apply(dialog, worldId, 2);
  const events = await getWorldEventDocuments(worldId);
  expect(
    events.some(
      (event) =>
        event.metadata.draftReviewReceipt.movements.length === 1 &&
        event.metadata.draftReviewReceipt.movements[0].entitlementId ===
          PICKS.TOR &&
        event.metadata.draftReviewReceipt.movements[0].toTeam === 'WAS'
    )
  ).toBe(true);
  expect(
    (await getWorldTeamDocument(worldId, 'CHI'))!.players.some(
      (p: { id: string }) => p.id === 'tre_mann'
    )
  ).toBe(true);
  expect(
    (await getWorldTeamDocument(worldId, 'WAS'))!.entitlementIds
  ).toContain(PICKS.TOR);
  await page.reload();
  dialog = await openTrade(page, 'WAS', 'wizards');
  await player(page, dialog, 'CHI', 'TRE MANN', 'Washington Wizards');
  await player(page, dialog, 'WAS', 'TRE JONES', 'Chicago Bulls');
  await electEqualSalaries(dialog, worldId, [
    ['CHI', 'TRE MANN'],
    ['WAS', 'TRE JONES'],
  ]);
  await apply(dialog, worldId, 3);
  await page.reload();
  expect(
    (await getWorldTeamDocument(worldId, 'CHI'))!.players.some(
      (p: { id: string }) => p.id === 'tre_jones'
    )
  ).toBe(true);
  const copied = await page.evaluate(
    async ({ worldId, uid }) => {
      const { branchWorld } = await import(
        '/src/features/architect/utils/worldManager.ts'
      );
      const { loadGovernedDraftWorld } = await import(
        '/src/features/architect/utils/governedDraftWorld.load.ts'
      );
      const copy = await branchWorld(worldId, 'Current-world copy', '', uid);
      const reloaded = await loadGovernedDraftWorld(copy.worldId);
      return { id: copy.worldId, transfers: reloaded?.transfers.length };
    },
    { worldId, uid }
  );
  expect(copied.transfers).toBe(2);
  expect(
    (await db.doc(`architect_worlds/${copied.id}`).get()).data()
      ?.contractSourceRelease
  ).toEqual(metadata.contractSourceRelease);
  expect(
    (await getWorldTeamDocument(copied.id, 'WAS'))!.entitlementIds
  ).toContain(PICKS.TOR);
  dialog = await openTrade(page, 'WAS', 'wizards');
  await player(page, dialog, 'CHI', 'ORLANDO ROBINSON', 'Washington Wizards');
  await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
  await expect(dialog).toContainText('CBA2-L03.17');
  await expect(
    dialog.getByRole('button', { name: /^Apply Trade$/i })
  ).toBeDisabled();
  expect(await getWorldEventDocuments(worldId)).toHaveLength(3);
  expect(await worldDigest(olderId)).toBe(olderDigest);
});

test('current mixed matching and separate minimum: reject, elect, save, reload and copy', async ({
  page,
}) => {
  const olderId = process.env.SCOUTZERO_PRESERVED_WORLD_ID;
  if (!olderId) throw new Error('SCOUTZERO_PRESERVED_WORLD_ID is required.');
  const olderDigest = await worldDigest(olderId);
  await page.goto('/gm/HOU?season=2027');
  await expect.poll(() => readReviewUserId(page)).not.toBe('');
  const uid = await readReviewUserId(page);
  await page.getByTestId('cockpit-world-menu-trigger').click();
  await page.getByTitle('Create new world', { exact: true }).click();
  await page
    .getByLabel('World Name', { exact: true })
    .fill('Current mixed minimum trade');
  page.once('dialog', async (confirmation) => confirmation.accept());
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(
    page.getByTestId('cockpit-activity-rail-identity')
  ).toContainText('SIMULATION', { timeout: 60000 });
  const worldId = await page.evaluate(
    (uid) => localStorage.getItem(`architect.activeWorldId.${uid}`)!,
    uid
  );
  const dialog = await openTrade(page, 'MIL', 'bucks', 'HOU');
  await player(page, dialog, 'HOU', 'REED SHEPPARD', 'Milwaukee Bucks');
  await player(page, dialog, 'MIL', 'AJ GREEN', 'Houston Rockets');
  await player(page, dialog, 'MIL', 'JERICHO SIMS', 'Houston Rockets');
  const pickId = 'ent:HOU:2033:1:own:7b093a9d';
  await pick(page, dialog, 'HOU', pickId, 'Milwaukee Bucks');
  for (const [code, path, delta, outgoing] of [
    [
      'HOU',
      'STANDARD_TPE',
      10_044_644 + 2_801_346 - 11_108_880,
      [['REED SHEPPARD', 11_108_880]],
    ],
    [
      'MIL',
      'AGGREGATED_STANDARD_TPE',
      11_108_880 - 10_044_644 - 2_801_346,
      [
        ['AJ GREEN', 10_044_644],
        ['JERICHO SIMS', 2_801_346],
      ],
    ],
  ] as const) {
    const card = dialog.getByTestId(`trade-team-card-${code}`);
    await card.getByLabel('Elected path', { exact: true }).selectOption(path);
    const totals = createCanonicalTeamTotalsSnapshot(
      (await getWorldTeamDocument(worldId, code))!,
      2027,
      { asOfDate: '2026-11-14' }
    );
    await card
      .getByLabel('Post-assignment Apron Team Salary', { exact: true })
      .fill(String(totals.apronTeamSalary + delta));
    for (const [name, salary] of outgoing)
      await card
        .getByLabel(new RegExp(`^${name} exact pre-trade Salary$`, 'i'))
        .fill(String(salary));
  }
  await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
  await expect(
    dialog.getByRole('button', { name: /^Apply Trade$/i })
  ).toBeDisabled();
  await dialog
    .getByTestId('trade-team-card-HOU')
    .getByRole('checkbox', {
      name: /^Acquire Jericho Sims with Minimum Exception$/i,
    })
    .check();
  await dialog
    .getByTestId('trade-team-card-HOU')
    .getByRole('checkbox', {
      name: /^Acquire Jericho Sims with Minimum Exception$/i,
    })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: test.info().outputPath('mixed-minimum-election.png'),
  });
  await apply(dialog, worldId, 1);
  const hou = (await getWorldTeamDocument(worldId, 'HOU'))!;
  const mil = (await getWorldTeamDocument(worldId, 'MIL'))!;
  expect(hou.players.some((p: { id: string }) => p.id === 'jericho_sims')).toBe(
    true
  );
  expect(hou.players.some((p: { id: string }) => p.id === 'aj_green')).toBe(
    true
  );
  expect(mil.entitlementIds).toContain(pickId);
  const events = await getWorldEventDocuments(worldId);
  expect(
    events[0].metadata.salaryMatchingPaths.find(
      (entry: { teamCode: string }) => entry.teamCode === 'HOU'
    ).evaluation
  ).toMatchObject({
    actualIncoming: 10_044_644,
    election: { minimumExceptionPlayerIds: ['jericho_sims'] },
    components: [
      { path: 'STANDARD_TPE', usedIncoming: 10_044_644 },
      {
        componentId: 'minimum-exception:jericho_sims',
        path: 'MINIMUM_EXCEPTION',
        incomingPlayers: [{ playerId: 'jericho_sims', salary: 0 }],
      },
    ],
  });
  expect(
    createCanonicalTeamTotalsSnapshot(hou, 2027, { asOfDate: '2026-11-14' })
      .apronTeamSalary
  ).toBe(203_970_470);
  await page.reload();
  await expect(
    page.getByTestId('cockpit-activity-rail-identity')
  ).toContainText('SIMULATION');
  const copy = await page.evaluate(
    async ({ worldId, uid }) => {
      const { branchWorld } = await import(
        '/src/features/architect/utils/worldManager.ts'
      );
      return branchWorld(worldId, 'Mixed minimum copy', '', uid);
    },
    { worldId, uid }
  );
  const copiedHou = (await getWorldTeamDocument(copy.worldId, 'HOU'))!;
  expect(copiedHou.players.map((p: { id: string }) => p.id)).toEqual(
    hou.players.map((p: { id: string }) => p.id)
  );
  expect(copiedHou.tradeAcquisitionHistory).toEqual(
    hou.tradeAcquisitionHistory
  );
  // Branching updates parent branch metadata; original teams and receipts stay intact.
  expect(await getWorldTeamDocument(worldId, 'HOU')).toEqual(hou);
  expect(await getWorldEventDocuments(worldId)).toEqual(events);
  expect(await worldDigest(olderId)).toBe(olderDigest);
});
