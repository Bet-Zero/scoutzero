/**
 * V1 item B1 prerequisite 3: a zero/one-YOS Minimum Contract in a SIMULATION
 * world trade (local emulator only). Requires cloud:dev with privately
 * prepared SIMULATION financial and draft packages.
 *
 * Justin Edwards (PHI) carries a CBA2-C07.3 Apron uplift. Trading him for
 * Sion James (CHA) moves that uplift row to CHA, the elected post-assignment
 * Apron Team Salary must include the move, and Tax Salary (fixed at the last
 * Regular Season game) does not change. Trading him back moves it again.
 */
import {
  expect as baseExpect,
  test,
  type Locator,
  type Page,
} from '@playwright/test';
import {
  readReviewUserId,
  getReviewAdminDb,
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

type Code = 'PHI' | 'CHA';
const CODES: readonly Code[] = ['PHI', 'CHA'];
const OTHER = { PHI: 'CHA', CHA: 'PHI' } as const;
const NAMES = { PHI: 'Philadelphia 76ers', CHA: 'Charlotte Hornets' } as const;
const DAY = '2026-06-05';
const EDWARDS = {
  id: 'justin_edwards',
  name: 'JUSTIN EDWARDS',
  salary: 2_048_494,
  uplift: 247_780,
};
const JAMES = { id: 'sion_james', name: 'SION JAMES', salary: 2_296_274 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- emulator documents
type TeamDoc = Record<string, any>;
const upliftRows = (team: TeamDoc) =>
  (team.salaryBookInputs.apronAdjustments.lineItems as TeamDoc[]).filter(
    (row) =>
      row.canonLeafIds.includes('CBA2-C07.3') &&
      row.amount !== 0 &&
      !String(row.id).includes(':dead-')
  );
const apronOf = (team: TeamDoc) =>
  createCanonicalTeamTotalsSnapshot(team, 2026, { asOfDate: DAY })
    .apronTeamSalary as number;
const taxOf = (team: TeamDoc) =>
  createCanonicalTeamTotalsSnapshot(team, 2026, { asOfDate: DAY })
    .taxSalary as number;

async function openTradeMachine(page: Page) {
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  await page.waitForTimeout(2000);
  if (!(await dialog.isVisible()))
    await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
  await expect(dialog.getByTestId('trade-team-card-PHI')).toBeVisible({
    timeout: 60000,
  });
  const picker = dialog
    .locator('label', { hasText: /^Select Team$/ })
    .locator('xpath=following-sibling::select[1]');
  if ((await picker.count()) === 0)
    await dialog.getByRole('button', { name: /^Add Team$/i }).click();
  await picker.first().selectOption('hornets');
  await expect(dialog.getByTestId('trade-team-card-CHA')).toBeVisible({
    timeout: 60000,
  });
  return dialog;
}

async function sendPlayer(
  page: Page,
  dialog: Locator,
  from: Code,
  playerName: string
) {
  const card = dialog.getByTestId(`trade-team-card-${from}`);
  await card
    .getByRole('button', { name: /^(Players|Plr)( \(\d+\))?$/i })
    .click();
  await card
    .getByAltText(new RegExp(`^${playerName}$`, 'i'))
    .first()
    .locator('xpath=ancestor::div[.//button[normalize-space()="•••"]][1]')
    .getByRole('button', { name: '•••' })
    .click();
  await page
    .getByRole('button', {
      name: new RegExp(`^Trade to ${NAMES[OTHER[from]]}$`, 'i'),
    })
    .click();
}

async function electAndApply(
  page: Page,
  dialog: Locator,
  worldId: string,
  sends: Record<Code, { name: string; salary: number }>,
  expectedApron: Record<Code, number>,
  events: number
) {
  for (const code of CODES) {
    const card = dialog.getByTestId(`trade-team-card-${code}`);
    await expect(card).toContainText(/TAX SALARY\s*\$\d/i);
    await card
      .getByLabel('Elected path', { exact: true })
      .selectOption('STANDARD_TPE');
    await card
      .getByLabel('Post-assignment Apron Team Salary', { exact: true })
      .fill(String(expectedApron[code]));
    await card
      .getByLabel(
        new RegExp(`^${sends[code].name} exact pre-trade Salary$`, 'i')
      )
      .fill(String(sends[code].salary));
  }
  await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
  await expect(
    dialog.getByRole('button', { name: /^Apply Trade$/i })
  ).toBeEnabled({ timeout: 60000 });
  await dialog.getByRole('button', { name: /^Apply Trade$/i }).click();
  await expect
    .poll(async () => (await getWorldEventDocuments(worldId)).length, {
      timeout: 60000,
    })
    .toBe(events);
  await expect(dialog).toBeHidden({ timeout: 30000 });
}

test('SIMULATION world: a Minimum Contract uplift moves with the player', async ({
  page,
}) => {
  await page.goto('/gm/PHI?season=2026', { waitUntil: 'domcontentloaded' });
  await expect
    .poll(() => readReviewUserId(page), { timeout: 30000 })
    .not.toBe('');
  const uid = await readReviewUserId(page);
  const worldId = await page.evaluate(async (uid) => {
    const { createWorld } = await import(
      '/src/features/architect/utils/worldManager.ts'
    );
    const { worldId, metadata } = await createWorld({
      userId: uid,
      name: 'Minimum uplift trade',
      currentSeason: '2025-26',
    });
    if (metadata.draftBaseline?.classification !== 'simulation')
      throw new Error('Local SIMULATION draft baseline not configured.');
    localStorage.setItem(`architect.activeWorldId.${uid}`, worldId);
    localStorage.setItem('hz.currentSeasonEndYear', '2026');
    return worldId;
  }, uid);
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);

  const before: Record<Code, TeamDoc> = {
    PHI: (await getWorldTeamDocument(worldId, 'PHI'))!,
    CHA: (await getWorldTeamDocument(worldId, 'CHA'))!,
  };
  // Starting books: the uplift sits with PHI, CHA has none.
  expect(upliftRows(before.PHI)).toEqual([
    expect.objectContaining({
      id: `apron-team-salary:simulation:PHI:minimum-uplift:${EDWARDS.id}`,
      amount: EDWARDS.uplift,
    }),
  ]);
  expect(upliftRows(before.CHA)).toEqual([]);
  const apron0 = { PHI: apronOf(before.PHI), CHA: apronOf(before.CHA) };
  const tax0 = { PHI: taxOf(before.PHI), CHA: taxOf(before.CHA) };
  for (const code of CODES) {
    expect(Number.isSafeInteger(apron0[code])).toBe(true);
    expect(Number.isSafeInteger(tax0[code])).toBe(true);
  }

  await page.reload();
  await expect(
    page.getByTestId('cockpit-activity-rail-identity')
  ).toContainText('SIMULATION', { timeout: 30000 });

  // 1. Edwards to CHA, Sion James to PHI.
  const delta = JAMES.salary - EDWARDS.salary;
  const apron1 = {
    PHI: apron0.PHI + delta - EDWARDS.uplift,
    CHA: apron0.CHA - delta + EDWARDS.uplift,
  };
  let dialog = await openTradeMachine(page);
  await sendPlayer(page, dialog, 'PHI', EDWARDS.name);
  await sendPlayer(page, dialog, 'CHA', JAMES.name);
  await electAndApply(
    page,
    dialog,
    worldId,
    { PHI: EDWARDS, CHA: JAMES },
    apron1,
    1
  );
  const after1: Record<Code, TeamDoc> = {
    PHI: (await getWorldTeamDocument(worldId, 'PHI'))!,
    CHA: (await getWorldTeamDocument(worldId, 'CHA'))!,
  };
  expect(after1.CHA.players.map((p: TeamDoc) => p.id)).toContain(EDWARDS.id);
  expect(upliftRows(after1.PHI)).toEqual([]);
  expect(upliftRows(after1.CHA)).toEqual([
    expect.objectContaining({
      amount: EDWARDS.uplift,
      effectiveFrom: `${DAY}T00:00:00.000Z`,
    }),
  ]);
  for (const code of CODES) {
    expect(apronOf(after1[code])).toBe(apron1[code]);
    expect(taxOf(after1[code])).toBe(tax0[code]);
  }
  expect((await root.get()).data()!.draftInventoryRevision).toBe(1);

  // 2. The same players back: the uplift returns to PHI.
  await page.reload();
  dialog = await openTradeMachine(page);
  await sendPlayer(page, dialog, 'CHA', EDWARDS.name);
  await sendPlayer(page, dialog, 'PHI', JAMES.name);
  await electAndApply(
    page,
    dialog,
    worldId,
    // The post-season basis is the lesser of this and next season's Salary.
    { CHA: EDWARDS, PHI: JAMES },
    apron0,
    2
  );
  const after2: Record<Code, TeamDoc> = {
    PHI: (await getWorldTeamDocument(worldId, 'PHI'))!,
    CHA: (await getWorldTeamDocument(worldId, 'CHA'))!,
  };
  expect(upliftRows(after2.CHA)).toEqual([]);
  expect(upliftRows(after2.PHI)).toEqual([
    expect.objectContaining({ amount: EDWARDS.uplift }),
  ]);
  for (const code of CODES) {
    expect(apronOf(after2[code])).toBe(apron0[code]);
    expect(taxOf(after2[code])).toBe(tax0[code]);
  }
});
