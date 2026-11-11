/**
 * V1 item B1 prerequisite: player trades in a SIMULATION world (local emulator
 * only). Requires cloud:dev with privately prepared SIMULATION financial and
 * draft packages. A player swap applies through the ordinary Trade Machine,
 * advances the draft fence, and a later first-round swap still applies.
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

// Equal, fully guaranteed, bonus-free 2025-26 and 2026-27 salaries, so the
// post-season lesser-of salary is exact and a Standard TPE path matches.
const SALARY = 8_000_000;
const PLAYERS = { CHI: 'TRE JONES', CHA: 'TRE MANN' } as const;
const IDS = { CHI: 'tre_jones', CHA: 'tre_mann' } as const;
const NAMES = { CHI: 'Chicago Bulls', CHA: 'Charlotte Hornets' } as const;
const OTHER = { CHI: 'CHA', CHA: 'CHI' } as const;

async function openTradeMachine(page: Page) {
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  // The Trade Machine can reopen by itself after a reload.
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
  await picker.first().selectOption('hornets');
  await expect(dialog.getByTestId('trade-team-card-CHA')).toBeVisible({
    timeout: 60000,
  });
  return dialog;
}

async function tradeTo(page: Page, row: Locator, to: string) {
  await row.getByRole('button', { name: '•••' }).click();
  await page
    .getByRole('button', { name: new RegExp(`^Trade to ${to}$`, 'i') })
    .click();
}

async function validateAndApply(page: Page, dialog: Locator, events: number) {
  const worldId = await page.evaluate(
    () =>
      Object.entries(localStorage).find(([k]) =>
        k.startsWith('architect.activeWorldId')
      )?.[1] ?? ''
  );
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

async function createSimulationWorld(page: Page, name: string) {
  await page.goto('/gm/CHI?season=2026', { waitUntil: 'domcontentloaded' });
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
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const apron: Record<string, number> = {};
  for (const code of ['CHI', 'CHA'] as const) {
    const team = (await getWorldTeamDocument(worldId, code))!;
    // A2/A4: the Tax Salary book is complete, with its C08.1 baseline.
    expect(team.salaryBookInputs.taxSalary.status).toBe('ready');
    const player = team.players.find((p: { id: string }) => p.id === IDS[code]);
    const rows = player.contract.salariesByYear;
    for (const season of ['2025-26', '2026-27'])
      expect(
        rows.find((r: { season: string }) => r.season === season)
      ).toMatchObject({ salary: SALARY, guaranteed: true });
  }
  await page.reload();
  await expect(
    page.getByTestId('cockpit-activity-rail-identity')
  ).toContainText('SIMULATION', { timeout: 30000 });

  return { worldId, root, apron };
}

async function selectPlayers(dialog: Locator, page: Page) {
  for (const code of ['CHI', 'CHA'] as const) {
    const card = dialog.getByTestId(`trade-team-card-${code}`);
    await card
      .getByRole('button', { name: /^(Players|Plr)( \(\d+\))?$/i })
      .click();
    await tradeTo(
      page,
      card
        .getByAltText(new RegExp(`^${PLAYERS[code]}$`, 'i'))
        .first()
        .locator('xpath=ancestor::div[.//button[normalize-space()="•••"]][1]'),
      NAMES[OTHER[code]]
    );
  }
}

async function electStandardTpe(
  dialog: Locator,
  worldId: string,
  apron: Record<string, number>
) {
  for (const code of ['CHI', 'CHA'] as const) {
    const card = dialog.getByTestId(`trade-team-card-${code}`);
    await expect(card).toContainText(/TAX SALARY\s*\$\d/i);
    await card
      .getByLabel('Elected path', { exact: true })
      .selectOption('STANDARD_TPE');
    // Equal salaries leave Apron Team Salary unchanged.
    apron[code] = createCanonicalTeamTotalsSnapshot(
      (await getWorldTeamDocument(worldId, code))!,
      2026,
      { asOfDate: '2026-06-05' }
    ).apronTeamSalary as number;
    expect(Number.isSafeInteger(apron[code])).toBe(true);
    await card
      .getByLabel('Post-assignment Apron Team Salary', { exact: true })
      .fill(String(apron[code]));
    await card
      .getByLabel(new RegExp(`^${PLAYERS[code]} exact pre-trade Salary$`, 'i'))
      .fill(String(SALARY));
  }
}

async function firstId(
  root: ReturnType<ReturnType<typeof getReviewAdminDb>['doc']>,
  code: string,
  year: number
) {
  return (
    await root
      .collection('entitlements')
      .where('underlyingPickId', '==', `${code}_${year}_1st`)
      .get()
  ).docs[0].id;
}

test('SIMULATION world: a player swap applies, then a first-round swap still applies', async ({
  page,
}) => {
  const { worldId, root, apron } = await createSimulationWorld(
    page,
    'Player trades'
  );
  // 1. Player for player.
  let dialog = await openTradeMachine(page);
  await selectPlayers(dialog, page);
  await electStandardTpe(dialog, worldId, apron);
  await validateAndApply(page, dialog, 1);
  let metadata = (await root.get()).data()!;
  // Ordinary commits advance the draft fence too (firestore.rules).
  expect(metadata.draftInventoryRevision).toBe(1);
  expect(metadata.draftWorldTransfers).toEqual([]);
  for (const code of ['CHI', 'CHA'] as const) {
    const team = (await getWorldTeamDocument(worldId, code))!;
    const ids = team.players.map((p: { id: string }) => p.id);
    expect(ids).toContain(IDS[OTHER[code]]);
    expect(ids).not.toContain(IDS[code]);
  }

  // 2. A first-round swap after the player trade (mirrored overrides exist).
  const picks: Record<string, string> = {};
  for (const code of ['CHI', 'CHA'] as const)
    picks[code] = await firstId(root, code, 2028);
  await page.reload();
  dialog = await openTradeMachine(page);
  for (const code of ['CHI', 'CHA'] as const) {
    const card = dialog.getByTestId(`trade-team-card-${code}`);
    await card
      .getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i })
      .click();
    await tradeTo(
      page,
      card.locator(`[data-entitlement-id="${picks[code]}"]`),
      NAMES[OTHER[code]]
    );
  }
  await validateAndApply(page, dialog, 2);
  metadata = (await root.get()).data()!;
  expect(metadata.draftInventoryRevision).toBe(2);
  expect(metadata.draftWorldTransfers).toHaveLength(1);
  for (const code of ['CHI', 'CHA'] as const)
    expect(
      (await root.collection('entitlements').doc(picks[code]).get()).data()
        ?.holderTeam
    ).toBe(OTHER[code]);
});

test('SIMULATION world: players and a first travel together in one trade', async ({
  page,
}) => {
  const { worldId, root, apron } = await createSimulationWorld(
    page,
    'Players with a first'
  );
  const pick = await firstId(root, 'CHI', 2028);
  // CHI sends Tre Jones and its 2028 first; CHA sends Tre Mann.
  const dialog = await openTradeMachine(page);
  await selectPlayers(dialog, page);
  const chi = dialog.getByTestId('trade-team-card-CHI');
  await chi.getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i }).click();
  await tradeTo(
    page,
    chi.locator(`[data-entitlement-id="${pick}"]`),
    NAMES.CHA
  );
  await electStandardTpe(dialog, worldId, apron);
  await validateAndApply(page, dialog, 1);
  const metadata = (await root.get()).data()!;
  expect(metadata.draftInventoryRevision).toBe(1);
  expect(metadata.draftWorldTransfers).toHaveLength(1);
  expect(metadata.draftWorldTransfers[0].movements).toMatchObject([
    { entitlementId: pick, fromTeam: 'CHI', toTeam: 'CHA' },
  ]);
  expect(
    (await root.collection('entitlements').doc(pick).get()).data()?.holderTeam
  ).toBe('CHA');
  for (const code of ['CHI', 'CHA'] as const) {
    const team = (await getWorldTeamDocument(worldId, code))!;
    const ids = team.players.map((p: { id: string }) => p.id);
    expect(ids).toContain(IDS[OTHER[code]]);
    expect(ids).not.toContain(IDS[code]);
  }

  // The mixed custody history replays: a later first-round swap applies.
  const later: Record<string, string> = {};
  for (const code of ['CHI', 'CHA'] as const)
    later[code] = await firstId(root, code, 2030);
  await page.reload();
  const again = await openTradeMachine(page);
  for (const code of ['CHI', 'CHA'] as const) {
    const card = again.getByTestId(`trade-team-card-${code}`);
    await card
      .getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i })
      .click();
    await tradeTo(
      page,
      card.locator(`[data-entitlement-id="${later[code]}"]`),
      NAMES[OTHER[code]]
    );
  }
  await validateAndApply(page, again, 2);
  const after = (await root.get()).data()!;
  expect(after.draftInventoryRevision).toBe(2);
  expect(after.draftWorldTransfers).toHaveLength(2);
});
