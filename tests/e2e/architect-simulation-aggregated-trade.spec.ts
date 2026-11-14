/**
 * V1 item B2, part 1: the post-Regular-Season dual-year test (CBA2-A05.15 to
 * A05.17) in a June 5 SIMULATION world (local emulator only). Requires
 * cloud:dev with privately prepared SIMULATION financial and draft packages.
 *
 * CHI aggregates Noa Essengue and Tre Jones for Charlotte's Grant Williams.
 * The trade also passes on CHI's 2026-27 books, so Apply records the 2025-26
 * Row H hard cap and the 2026-27 next-season hard cap.
 *
 * SAC aggregates Malik Monk and Dylan Cardwell for New York's Josh Hart. SAC
 * is refused at the earlier June 5 postseason-roster gate for Hart. The
 * next-season Apron rejection remains covered by the focused Apron tests.
 */
import {
  expect as baseExpect,
  test,
  type Locator,
  type Page,
} from '@playwright/test';
import {
  readReviewUserId,
  getWorldEventDocuments,
  getWorldTeamDocument,
} from './helpers/architectReviewWorld';
import { createCanonicalTeamTotalsSnapshot } from '../../src/features/architect/utils/capTotals/computeTeamCapTotals';

test.skip(
  process.env.SCOUTZERO_SIMULATION_FINANCIAL_PROOF !== 'true',
  'Opt in with SCOUTZERO_SIMULATION_FINANCIAL_PROOF=true and privately prepared local simulation packages.'
);
test.use({ viewport: { width: 1280, height: 720 } });
const expect = baseExpect.configure({ timeout: 30000 });
test.setTimeout(300000);

type Side = {
  code: string;
  slug: string;
  name: string;
  path: 'AGGREGATED_STANDARD_TPE' | 'STANDARD_TPE' | 'EXPANDED_TPE';
  sends: Array<{ name: string; salary: number }>;
};

const PASSING: [Side, Side] = [
  {
    code: 'CHI',
    slug: 'bulls',
    name: 'Chicago Bulls',
    path: 'AGGREGATED_STANDARD_TPE',
    sends: [
      { name: 'NOA ESSENGUE', salary: 5_429_520 },
      { name: 'TRE JONES', salary: 8_000_000 },
    ],
  },
  {
    code: 'CHA',
    slug: 'hornets',
    name: 'Charlotte Hornets',
    path: 'STANDARD_TPE',
    sends: [{ name: 'GRANT WILLIAMS', salary: 13_645_500 }],
  },
];

const REFUSED: [Side, Side] = [
  {
    code: 'SAC',
    slug: 'kings',
    name: 'Sacramento Kings',
    path: 'AGGREGATED_STANDARD_TPE',
    sends: [
      { name: 'MALIK MONK', salary: 18_797_619 },
      { name: 'DYLAN CARDWELL', salary: 871_000 },
    ],
  },
  {
    code: 'NYK',
    slug: 'knicks',
    name: 'New York Knicks',
    path: 'STANDARD_TPE',
    sends: [{ name: 'JOSH HART', salary: 19_472_240 }],
  },
];

// V1 B3: CHI takes Grant Williams for Tre Jones alone. 100% + $250,000 of
// $8,000,000 is too little; the Expanded TPE allows 200% + $250,000.
const EXPANDED: [Side, Side] = [
  {
    code: 'CHI',
    slug: 'bulls',
    name: 'Chicago Bulls',
    path: 'EXPANDED_TPE',
    sends: [{ name: 'TRE JONES', salary: 8_000_000 }],
  },
  {
    code: 'CHA',
    slug: 'hornets',
    name: 'Charlotte Hornets',
    path: 'STANDARD_TPE',
    sends: [{ name: 'GRANT WILLIAMS', salary: 13_645_500 }],
  },
];

async function activeWorldId(page: Page) {
  return page.evaluate(
    () =>
      Object.entries(localStorage).find(([k]) =>
        k.startsWith('architect.activeWorldId')
      )?.[1] ?? ''
  );
}

async function createSimulationWorld(page: Page, home: string, name: string) {
  await page.goto(`/gm/${home}?season=2026`, { waitUntil: 'domcontentloaded' });
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  const uid = await readReviewUserId(page);
  const worldId = await page.evaluate(
    async ({ uid, name }) => {
      const { createWorld } = await import(
        '/src/features/architect/utils/worldManager.ts'
      );
      const { worldId, metadata } = await createWorld({
        userId: uid,
        name,
        currentSeason: '2025-26',
      });
      if (metadata.draftBaseline?.classification !== 'simulation')
        throw new Error('Local SIMULATION draft baseline not configured.');
      localStorage.setItem(`architect.activeWorldId.${uid}`, worldId);
      localStorage.setItem('hz.currentSeasonEndYear', '2026');
      return worldId;
    },
    { uid, name }
  );
  await page.reload();
  await expect(
    page.getByTestId('cockpit-activity-rail-identity')
  ).toContainText('SIMULATION', { timeout: 30000 });
  return worldId;
}

async function openTradeMachine(page: Page, home: Side, other: Side) {
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  await page.waitForTimeout(2000);
  if (!(await dialog.isVisible()))
    await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
  await expect(dialog.getByTestId(`trade-team-card-${home.code}`)).toBeVisible({
    timeout: 60000,
  });
  const picker = dialog
    .locator('label', { hasText: /^Select Team$/ })
    .locator('xpath=following-sibling::select[1]');
  if ((await picker.count()) === 0)
    await dialog.getByRole('button', { name: /^Add Team$/i }).click();
  await picker.first().selectOption(other.slug);
  await expect(dialog.getByTestId(`trade-team-card-${other.code}`)).toBeVisible(
    { timeout: 60000 }
  );
  return dialog;
}

async function buildTrade(
  page: Page,
  dialog: Locator,
  worldId: string,
  sides: [Side, Side]
) {
  for (const [index, side] of sides.entries()) {
    const other = sides[1 - index];
    const card = dialog.getByTestId(`trade-team-card-${side.code}`);
    await card
      .getByRole('button', { name: /^(Players|Plr)( \(\d+\))?$/i })
      .click();
    for (const player of side.sends) {
      await card
        .getByAltText(new RegExp(`^${player.name}$`, 'i'))
        .first()
        .locator('xpath=ancestor::div[.//button[normalize-space()="•••"]][1]')
        .getByRole('button', { name: '•••' })
        .click();
      await page
        .getByRole('button', {
          name: new RegExp(`^Trade to ${other.name}$`, 'i'),
        })
        .click();
    }
  }
  for (const [index, side] of sides.entries()) {
    const other = sides[1 - index];
    const card = dialog.getByTestId(`trade-team-card-${side.code}`);
    await expect(card).toContainText(/TAX SALARY\s*\$\d/i);
    await card
      .getByLabel('Elected path', { exact: true })
      .selectOption(side.path);
    const before = createCanonicalTeamTotalsSnapshot(
      (await getWorldTeamDocument(worldId, side.code))!,
      2026,
      { asOfDate: '2026-06-05' }
    ).apronTeamSalary as number;
    const out = side.sends.reduce((sum, p) => sum + p.salary, 0);
    const incoming = other.sends.reduce((sum, p) => sum + p.salary, 0);
    await card
      .getByLabel('Post-assignment Apron Team Salary', { exact: true })
      .fill(String(before - out + incoming));
    for (const player of side.sends)
      await card
        .getByLabel(new RegExp(`^${player.name} exact pre-trade Salary$`, 'i'))
        .fill(String(player.salary));
  }
}

test('June 5 SIMULATION world: an aggregated trade passes both seasons and records the next-season hard cap', async ({
  page,
}) => {
  const [chi, cha] = PASSING;
  const worldId = await createSimulationWorld(
    page,
    'CHI',
    'B2 aggregated pass'
  );
  const dialog = await openTradeMachine(page, chi, cha);
  await buildTrade(page, dialog, worldId, PASSING);
  await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
  const apply = dialog.getByRole('button', { name: /^Apply Trade$/i });
  await expect(apply).toBeEnabled({ timeout: 60000 });
  await apply.click();
  await expect
    .poll(async () => (await getWorldEventDocuments(worldId)).length, {
      timeout: 60000,
    })
    .toBe(1);
  await expect(dialog).toBeHidden({ timeout: 30000 });

  const team = (await getWorldTeamDocument(worldId, 'CHI'))!;
  const ledger = team.hardCapLedger as Array<Record<string, unknown>>;
  const thisSeason = ledger.find((entry) => entry.salaryCapYear === 2026);
  const nextSeason = ledger.find((entry) => entry.salaryCapYear === 2027);
  expect(thisSeason).toMatchObject({
    restrictionRow: 'H',
    apronLevel: 'SECOND_APRON',
    ceiling: 207_824_000,
  });
  expect(nextSeason).toMatchObject({
    restrictionRow: 'H',
    apronLevel: 'SECOND_APRON',
    ceiling: 221_686_000,
    expiresAt: '2027-07-01T00:00:00Z',
    dualYear: {
      triggerSalaryCapYear: 2026,
      levelBasis: 'official',
      canonLeafIds: ['CBA2-A05.15', 'CBA2-A05.16', 'CBA2-A05.17'],
    },
  });
  expect(String(nextSeason?.entryId)).toMatch(/:hard-cap:CHI:2027$/);
  expect((team.players as Array<{ id: string }>).map((p) => p.id)).toContain(
    'grant_williams'
  );

  // The saved ledger reloads as governed authority.
  await page.reload();
  await expect(
    page.getByTestId('cockpit-activity-rail-identity')
  ).toContainText('SIMULATION', { timeout: 30000 });
  expect(await activeWorldId(page)).toBe(worldId);
  await expect(
    page.getByText(/hardCapLedger is not governed authority/)
  ).toHaveCount(0);
});

test('June 5 SIMULATION world: aggregation cannot bypass a finalist postseason-roster restriction', async ({
  page,
}) => {
  const [sac, nyk] = REFUSED;
  const worldId = await createSimulationWorld(
    page,
    'SAC',
    'B2 aggregated refused'
  );
  const dialog = await openTradeMachine(page, sac, nyk);
  await buildTrade(page, dialog, worldId, REFUSED);
  await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
  await expect(dialog).toContainText(
    /still in the postseason on June 5.*cannot be traded \(CBA2-L03\.15/,
    { timeout: 60000 }
  );
  await expect(
    dialog.getByRole('button', { name: /^Apply Trade$/i })
  ).toBeDisabled();
});

test('June 5 SIMULATION world: the Expanded TPE takes back more than 100% and hard-caps at the First Apron both seasons (V1 B3)', async ({
  page,
}) => {
  const [chi, cha] = EXPANDED;
  const worldId = await createSimulationWorld(page, 'CHI', 'B3 expanded');
  const dialog = await openTradeMachine(page, chi, cha);
  await buildTrade(page, dialog, worldId, EXPANDED);
  await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
  const apply = dialog.getByRole('button', { name: /^Apply Trade$/i });
  await expect(apply).toBeEnabled({ timeout: 60000 });
  await apply.click();
  await expect
    .poll(async () => (await getWorldEventDocuments(worldId)).length, {
      timeout: 60000,
    })
    .toBe(1);
  await expect(dialog).toBeHidden({ timeout: 30000 });

  const team = (await getWorldTeamDocument(worldId, 'CHI'))!;
  const ledger = team.hardCapLedger as Array<Record<string, unknown>>;
  expect(ledger.find((entry) => entry.salaryCapYear === 2026)).toMatchObject({
    restrictionRow: 'E',
    salaryMatchingPath: 'EXPANDED_TPE',
    apronLevel: 'FIRST_APRON',
    ceiling: 195_945_000,
  });
  expect(ledger.find((entry) => entry.salaryCapYear === 2027)).toMatchObject({
    restrictionRow: 'E',
    ceiling: 209_015_000,
    dualYear: { triggerSalaryCapYear: 2026, levelBasis: 'official' },
  });
  expect((team.players as Array<{ id: string }>).map((p) => p.id)).toContain(
    'grant_williams'
  );
  await page.reload();
  await expect(
    page.getByTestId('cockpit-activity-rail-identity')
  ).toContainText('SIMULATION', { timeout: 30000 });
  await expect(
    page.getByText(/hardCapLedger is not governed authority/)
  ).toHaveCount(0);
});
