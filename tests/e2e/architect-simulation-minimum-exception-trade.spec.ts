/**
 * V1 item B1: acquiring a player with the Minimum Exception in a SIMULATION
 * world trade (local emulator only). Requires cloud:dev with privately
 * prepared SIMULATION financial and draft packages.
 *
 * CHI takes Naeqwan Tomlin (CLE, two-Season Minimum Exception Contract)
 * without sending a player, by electing the Minimum Exception path. CLE uses
 * a Standard TPE path for its outgoing player. Tomlin's CBA2-C07.3 Apron
 * uplift moves with him. A non-qualifying player is refused on that path.
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

type Code = 'CHI' | 'CLE';
const DAY = '2026-06-05';
const TOMLIN = {
  id: 'naeqwan_tomlin',
  name: "NAE'QWAN TOMLIN",
  salary: 718_150,
  uplift: 86_866,
};
const NAMES = { CHI: 'Chicago Bulls', CLE: 'Cleveland Cavaliers' } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- emulator documents
type TeamDoc = Record<string, any>;
const totals = (team: TeamDoc) =>
  createCanonicalTeamTotalsSnapshot(team, 2026, { asOfDate: DAY });

async function openTradeMachine(page: Page) {
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  await page.waitForTimeout(2000);
  if (!(await dialog.isVisible()))
    await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
  await expect(dialog.getByTestId('trade-team-card-CHI')).toBeVisible({
    timeout: 60000,
  });
  const picker = dialog
    .locator('label', { hasText: /^Select Team$/ })
    .locator('xpath=following-sibling::select[1]');
  if ((await picker.count()) === 0)
    await dialog.getByRole('button', { name: /^Add Team$/i }).click();
  await picker.first().selectOption('cavaliers');
  await expect(dialog.getByTestId('trade-team-card-CLE')).toBeVisible({
    timeout: 60000,
  });
  return dialog;
}

async function sendPlayer(
  page: Page,
  dialog: Locator,
  from: Code,
  to: Code,
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
    .getByRole('button', { name: new RegExp(`^Trade to ${NAMES[to]}$`, 'i') })
    .click();
}

test('SIMULATION world: a team takes a Minimum Exception player without sending one', async ({
  page,
}) => {
  await page.goto('/gm/CHI?season=2026', { waitUntil: 'domcontentloaded' });
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
      name: 'Minimum Exception trade',
      currentSeason: '2025-26',
    });
    if (metadata.draftBaseline?.classification !== 'simulation')
      throw new Error('Local SIMULATION draft baseline not configured.');
    localStorage.setItem(`architect.activeWorldId.${uid}`, worldId);
    localStorage.setItem('hz.currentSeasonEndYear', '2026');
    return worldId;
  }, uid);
  const before: Record<Code, TeamDoc> = {
    CHI: (await getWorldTeamDocument(worldId, 'CHI'))!,
    CLE: (await getWorldTeamDocument(worldId, 'CLE'))!,
  };
  const apron0 = {
    CHI: totals(before.CHI).apronTeamSalary as number,
    CLE: totals(before.CLE).apronTeamSalary as number,
  };
  const expected = {
    CHI: apron0.CHI + TOMLIN.salary + TOMLIN.uplift,
    CLE: apron0.CLE - TOMLIN.salary - TOMLIN.uplift,
  };

  await page.reload();
  await expect(
    page.getByTestId('cockpit-activity-rail-identity')
  ).toContainText('SIMULATION', { timeout: 30000 });
  const dialog = await openTradeMachine(page);
  await sendPlayer(page, dialog, 'CLE', 'CHI', TOMLIN.name);

  const chi = dialog.getByTestId('trade-team-card-CHI');
  const cle = dialog.getByTestId('trade-team-card-CLE');
  await expect(chi).toContainText(/TAX SALARY\s*\$\d/i);
  await chi
    .getByLabel('Elected path', { exact: true })
    .selectOption('MINIMUM_EXCEPTION');
  await chi
    .getByLabel('Post-assignment Apron Team Salary', { exact: true })
    .fill(String(expected.CHI));
  await cle
    .getByLabel('Elected path', { exact: true })
    .selectOption('STANDARD_TPE');
  await cle
    .getByLabel('Post-assignment Apron Team Salary', { exact: true })
    .fill(String(expected.CLE));
  await cle
    .getByLabel(new RegExp(`^${TOMLIN.name} exact pre-trade Salary$`, 'i'))
    .fill(String(TOMLIN.salary));

  await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
  await expect(
    dialog.getByRole('button', { name: /^Apply Trade$/i })
  ).toBeEnabled({ timeout: 60000 });
  await dialog.getByRole('button', { name: /^Apply Trade$/i }).click();
  await expect
    .poll(async () => (await getWorldEventDocuments(worldId)).length, {
      timeout: 60000,
    })
    .toBe(1);
  await expect(dialog).toBeHidden({ timeout: 30000 });

  const after: Record<Code, TeamDoc> = {
    CHI: (await getWorldTeamDocument(worldId, 'CHI'))!,
    CLE: (await getWorldTeamDocument(worldId, 'CLE'))!,
  };
  expect(after.CHI.players.map((p: TeamDoc) => p.id)).toContain(TOMLIN.id);
  expect(after.CLE.players.map((p: TeamDoc) => p.id)).not.toContain(TOMLIN.id);
  for (const code of ['CHI', 'CLE'] as const)
    expect(totals(after[code]).apronTeamSalary).toBe(expected[code]);
  // The Minimum Exception attaches no hard cap of its own.
  expect(
    (after.CHI.hardCapLedger ?? []).filter(
      (entry: TeamDoc) => String(entry.transactionId ?? '').length > 0
    ).length
  ).toBe((before.CHI.hardCapLedger ?? []).length);
});
