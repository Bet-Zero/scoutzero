/**
 * V1 item B1: acquiring a player with the Minimum Exception in a SIMULATION
 * world trade (local emulator only). Requires cloud:dev with privately
 * prepared SIMULATION financial and draft packages.
 *
 * CHI takes Naeqwan Tomlin (CLE, two-Season Minimum Exception Contract)
 * without sending a player, by electing the Minimum Exception path. CLE uses
 * a Standard TPE path for its outgoing player. Tomlin's CBA2-C07.3 Apron
 * uplift moves with him. A non-qualifying player is refused on that path.
 *
 * The Non-Taxpayer MLE also works with its June 5 prorated balance. The saved
 * acquisition bars aggregation for two months, including after copying, but
 * permits a solo re-trade under CBA2-A06.1.
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
test.use({ viewport: { width: 1280, height: 720 }, actionTimeout: 30000 });
const expect = baseExpect.configure({ timeout: 30000 });
test.setTimeout(300000);

type Code = 'CHI' | 'CLE' | 'CHA';
const DAY = '2026-06-05';
const TOMLIN = {
  id: 'naeqwan_tomlin',
  name: "NAE'QWAN TOMLIN",
  salary: 718_150,
  uplift: 86_866,
};
const NAMES = {
  CHI: 'Chicago Bulls',
  CLE: 'Cleveland Cavaliers',
  CHA: 'Charlotte Hornets',
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- emulator documents
type TeamDoc = Record<string, any>;
const totals = (team: TeamDoc) =>
  createCanonicalTeamTotalsSnapshot(team, 2026, { asOfDate: DAY });

async function openTradeMachine(page: Page, other: 'CLE' | 'CHA' = 'CLE') {
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  await page.waitForTimeout(2000);
  if (!(await dialog.isVisible())) {
    // A reloaded world may restore the overlay while the tab click is pending.
    try {
      await page
        .getByRole('tab', { name: /^Trade Machine$/i })
        .click({ timeout: 3000 });
    } catch (error) {
      if (!(await dialog.isVisible())) throw error;
    }
  }
  await expect(dialog.getByTestId('trade-team-card-CHI')).toBeVisible({
    timeout: 60000,
  });
  const picker = dialog
    .locator('label', { hasText: /^Select Team$/ })
    .locator('xpath=following-sibling::select[1]');
  if ((await picker.count()) === 0)
    await dialog.getByRole('button', { name: /^Add Team$/i }).click();
  await picker.first().selectOption(other === 'CLE' ? 'cavaliers' : 'hornets');
  await expect(dialog.getByTestId(`trade-team-card-${other}`)).toBeVisible({
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

for (const path of ['MINIMUM_EXCEPTION', 'NON_TAXPAYER_MLE'] as const) {
  test(`SIMULATION world: a team takes a player with ${path} without sending one`, async ({
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
    const before: Record<'CHI' | 'CLE', TeamDoc> = {
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
    // CHI holds its 2025-26 Non-Taxpayer MLE in the SIMULATION books.
    expect(before.CHI.exceptions.mle).toMatchObject({
      enabled: true,
      totalAmount: 14_104_000,
    });
    await chi
      .getByLabel('Elected path', { exact: true })
      .selectOption('NON_TAXPAYER_MLE');
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
    // June 5 uses the prorated balance, not a blanket January 10 refusal.
    await expect(
      dialog.getByRole('button', { name: /^Apply Trade$/i })
    ).toBeEnabled({ timeout: 60000 });

    await chi.getByLabel('Elected path', { exact: true }).selectOption(path);
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

    const after: Record<'CHI' | 'CLE', TeamDoc> = {
      CHI: (await getWorldTeamDocument(worldId, 'CHI'))!,
      CLE: (await getWorldTeamDocument(worldId, 'CLE'))!,
    };
    expect(after.CHI.players.map((p: TeamDoc) => p.id)).toContain(TOMLIN.id);
    expect(after.CHI.tradeAcquisitionHistory.entries).toEqual([
      expect.objectContaining({
        playerId: TOMLIN.id,
        teamCode: 'CHI',
        acquiredAt: DAY,
        viaException: true,
      }),
    ]);
    expect(after.CLE.players.map((p: TeamDoc) => p.id)).not.toContain(
      TOMLIN.id
    );
    for (const code of ['CHI', 'CLE'] as const)
      expect(totals(after[code]).apronTeamSalary).toBe(expected[code]);
    if (path === 'MINIMUM_EXCEPTION') {
      // The Minimum Exception attaches no hard cap of its own.
      expect(
        (after.CHI.hardCapLedger ?? []).filter(
          (entry: TeamDoc) => String(entry.transactionId ?? '').length > 0
        ).length
      ).toBe((before.CHI.hardCapLedger ?? []).length);
    } else {
      expect(after.CHI.exceptions.mle.usedAmount).toBe(
        before.CHI.exceptions.mle.usedAmount + TOMLIN.salary
      );
      expect(after.CHI.exceptions.mle.remainingAmount).toBe(
        before.CHI.exceptions.mle.remainingAmount - TOMLIN.salary
      );
      expect(after.CHI.hardCapLevel).toBe('firstApron');
    }
    await page.reload();
    for (const code of ['CHI', 'CLE'] as const) {
      expect(await getWorldTeamDocument(worldId, code)).toEqual(after[code]);
    }
    if (path !== 'NON_TAXPAYER_MLE') return;
    // Wait for the reloaded app's authenticated world reader before copying.
    await expect(
      page.getByTestId('cockpit-activity-rail-identity')
    ).toContainText('SIMULATION');
    await expect.poll(() => readReviewUserId(page)).toBe(uid);
    const copyId = await page.evaluate(
      async ({ worldId, uid }) => {
        const { branchWorld } = await import(
          '/src/features/architect/utils/worldManager.ts'
        );
        const copy = await branchWorld(
          worldId,
          'Acquisition restriction survives copy',
          '',
          uid
        );
        localStorage.setItem(`architect.activeWorldId.${uid}`, copy.worldId);
        return copy.worldId;
      },
      { worldId, uid }
    );
    expect(
      (await getWorldTeamDocument(copyId, 'CHI'))!.tradeAcquisitionHistory
    ).toEqual(after.CHI.tradeAcquisitionHistory);
    const copiedEventCount = (await getWorldEventDocuments(copyId)).length;
    await page.reload();
    const again = await openTradeMachine(page, 'CHA');
    await sendPlayer(page, again, 'CHI', 'CHA', TOMLIN.name);
    await sendPlayer(page, again, 'CHI', 'CHA', 'TRE JONES');
    const home = again.getByTestId('trade-team-card-CHI');
    const other = again.getByTestId('trade-team-card-CHA');
    await home
      .getByLabel('Elected path', { exact: true })
      .selectOption('AGGREGATED_STANDARD_TPE');
    await home
      .getByLabel('Post-assignment Apron Team Salary', { exact: true })
      .fill(String(expected.CHI - TOMLIN.salary - TOMLIN.uplift - 8_000_000));
    await home
      .getByLabel(new RegExp(`^${TOMLIN.name} exact pre-trade Salary$`, 'i'))
      .fill(String(TOMLIN.salary));
    await home
      .getByLabel(/^TRE JONES exact pre-trade Salary$/i)
      .fill('8000000');
    await other
      .getByLabel('Elected path', { exact: true })
      .selectOption('MINIMUM_EXCEPTION');
    const otherBefore = totals((await getWorldTeamDocument(copyId, 'CHA'))!)
      .apronTeamSalary as number;
    await other
      .getByLabel('Post-assignment Apron Team Salary', { exact: true })
      .fill(String(otherBefore + TOMLIN.salary + TOMLIN.uplift + 8_000_000));
    await again.getByRole('button', { name: /^Validate Trade$/i }).click();
    await expect(again).toContainText(/cannot be aggregated until 2026-08-05/);
    await expect(
      again.getByRole('button', { name: /^Apply Trade$/i })
    ).toBeDisabled();
    expect(await getWorldEventDocuments(copyId)).toHaveLength(copiedEventCount);
    // Re-stage just Tomlin: A06.1 must not bar a solo re-trade.
    await page.reload();
    const solo = await openTradeMachine(page, 'CHA');
    await sendPlayer(page, solo, 'CHI', 'CHA', TOMLIN.name);
    const soloHome = solo.getByTestId('trade-team-card-CHI');
    const soloOther = solo.getByTestId('trade-team-card-CHA');
    await soloHome
      .getByLabel('Elected path', { exact: true })
      .selectOption('STANDARD_TPE');
    await soloHome
      .getByLabel('Post-assignment Apron Team Salary', { exact: true })
      .fill(String(expected.CHI - TOMLIN.salary - TOMLIN.uplift));
    await soloHome
      .getByLabel(new RegExp(`^${TOMLIN.name} exact pre-trade Salary$`, 'i'))
      .fill(String(TOMLIN.salary));
    await soloOther
      .getByLabel('Elected path', { exact: true })
      .selectOption('MINIMUM_EXCEPTION');
    await soloOther
      .getByLabel('Post-assignment Apron Team Salary', { exact: true })
      .fill(String(otherBefore + TOMLIN.salary + TOMLIN.uplift));
    await solo.getByRole('button', { name: /^Validate Trade$/i }).click();
    await expect(
      solo.getByRole('button', { name: /^Apply Trade$/i })
    ).toBeEnabled();
    await solo.getByRole('button', { name: /^Apply Trade$/i }).click();
    await expect
      .poll(async () => (await getWorldEventDocuments(copyId)).length)
      .toBe(copiedEventCount + 1);
    expect(
      (await getWorldTeamDocument(copyId, 'CHA'))!.tradeAcquisitionHistory
        .entries
    ).toEqual([
      expect.objectContaining({
        playerId: TOMLIN.id,
        teamCode: 'CHA',
        acquiredAt: DAY,
        viaException: true,
      }),
    ]);
    expect(await getWorldTeamDocument(worldId, 'CHI')).toEqual(after.CHI);
  });
}
