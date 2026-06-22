/**
 * Browser guardrail for the Architect V1 action exposure matrix (BZE-116).
 *
 * This file verifies the visible promise at action entry points only. It does
 * not execute Trade Machine internals, prove standard FA signing, or broaden
 * into generic action-loop QA.
 *
 * Run:
 *   PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true npx playwright test tests/e2e/architect-action-exposure.spec.ts --reporter=line
 */

import { test, expect, type Locator, type Page } from '@playwright/test';

const MIA_OWN_FA_URL = '/gm/MIA?season=2027';
const OWN_FA_NAME = 'Grant Holloway';
const FCT_PLAYER_NAME = 'Marcus Vance';

const isVisible = async (locator: Locator, timeout = 3000) =>
  locator.isVisible({ timeout }).catch(() => false);

const waitForMiaDashboard = async (page: Page) => {
  const fullCapTab = page.getByTestId('tab-full-cap-table');
  const noTeamData = page.getByText(/^No team data$/i);
  const loadingDashboard = page.getByText(/^Loading GM Dashboard/i);

  await expect
    .poll(
      async () => {
        const stillLoading = await isVisible(loadingDashboard, 1000);
        const hasTab = await isVisible(fullCapTab, 1000);
        const hasNoTeamData = await isVisible(noTeamData, 1000);
        return !stillLoading && (hasTab || hasNoTeamData);
      },
      {
        timeout: 60000,
        message:
          'GM Dashboard should leave loading and reach the MIA review fixture',
      }
    )
    .toBe(true);

  expect(
    await isVisible(noTeamData, 1000),
    'MIA review fixture should be seeded before action exposure checks'
  ).toBe(false);

  if (await isVisible(fullCapTab, 2000)) {
    await fullCapTab.click();
  }
};

const gotoMiaOwnFaSeason = async (page: Page) => {
  await page.goto(MIA_OWN_FA_URL, { waitUntil: 'domcontentloaded' });
  await waitForMiaDashboard(page);
};

const ownFaDecisionRow = (page: Page): Locator =>
  page
    .getByTestId('cap-sheet-full-fa-decision-row')
    .filter({ hasText: OWN_FA_NAME });

test.describe('ARCH-ACTION-EXPOSURE: visible Architect action promises are honest', () => {
  test.beforeEach(async ({ page }) => {
    await gotoMiaOwnFaSeason(page);
  });

  test('supported own-FA actions remain exposed as V1 supported without preview labels', async ({
    page,
  }) => {
    const fullCapRegion = page
      .getByRole('region', { name: /Full Cap Table/i })
      .first();
    await expect(fullCapRegion).toBeVisible({ timeout: 20000 });

    const faRow = ownFaDecisionRow(page);
    await expect(faRow).toBeVisible({ timeout: 20000 });
    await expect(faRow).toContainText(OWN_FA_NAME);

    const resignCell = faRow.getByTestId('cap-sheet-full-fa-resign-cell').first();
    await expect(resignCell).toBeVisible();
    await expect(resignCell).toHaveAttribute(
      'data-action-exposure-classification',
      'V1 supported'
    );

    await faRow.hover();
    const absolveButton = faRow.getByTestId('cap-sheet-full-fa-absolve-button');
    await expect(absolveButton).toBeVisible();
    await expect(absolveButton).toBeEnabled();
    await expect(absolveButton).toHaveAttribute(
      'data-action-exposure-classification',
      'V1 supported'
    );

    await resignCell.click();
    const modal = page.getByTestId('edit-contract-modal');
    await expect(modal).toBeVisible({ timeout: 20000 });
    await expect(modal.getByText(/^Re-sign Player$/i).first()).toBeVisible();
    await expect(modal.getByText(/^Renounce Rights$/i).first()).toBeVisible();
    await expect(modal.getByText(/Re-sign Player \(Preview\)/i)).toHaveCount(0);
    await expect(modal.getByText(/Renounce Rights \(Preview\)/i)).toHaveCount(0);
    await expect(modal.getByText(/Sign & Trade/i)).toHaveCount(0);
    await expect(modal.getByText(/Offer Sheet/i)).toHaveCount(0);
    await modal.getByRole('button', { name: /^Cancel$/i }).click();
    await expect(modal).toHaveCount(0);
  });

  test('unsupported and unproven entry points are labeled as preview or launchers', async ({
    page,
  }) => {
    const standardFaLauncher = page.getByTestId(
      'cap-sheet-full-sign-free-agent-button'
    );
    await expect(standardFaLauncher).toBeVisible({ timeout: 20000 });
    await expect(standardFaLauncher).toHaveAttribute(
      'data-action-exposure-classification',
      'preview-only'
    );
    await expect(standardFaLauncher).toContainText(/Preview/i);

    await standardFaLauncher.click();
    const freeAgentModal = page.getByTestId('full-cap-free-agent-modal');
    await expect(freeAgentModal).toBeVisible({ timeout: 20000 });
    await expect(freeAgentModal).toContainText(/Preview only/i);
    await expect(freeAgentModal).toContainText(
      /not a V1 supported promise/i
    );
    await expect(
      freeAgentModal.getByRole('button', { name: /^Start Preview Signing$/i })
    ).toBeVisible();
    await freeAgentModal
      .getByRole('button', { name: /close sign free agent modal/i })
      .click();
    await expect(freeAgentModal).toHaveCount(0);

    const playerOptionCell = page
      .locator('[title="Preview: manage Player Option"]')
      .first();
    await expect(playerOptionCell).toBeVisible();
    await expect(playerOptionCell).toHaveAttribute(
      'data-action-exposure-classification',
      'preview-only'
    );
    await playerOptionCell.click();

    const contractModal = page.getByTestId('edit-contract-modal');
    await expect(contractModal).toBeVisible({ timeout: 20000 });
    await expect(
      contractModal.getByText(/Accept Option \(Preview\)/i).first()
    ).toBeVisible();
    await expect(
      contractModal.getByText(/Decline Option \(Preview\)/i).first()
    ).toBeVisible();
    await expect(
      contractModal.getByText(/Sign New Contract \(Preview\)/i).first()
    ).toBeVisible();
    await contractModal.getByRole('button', { name: /^Cancel$/i }).click();
    await expect(contractModal).toHaveCount(0);

    const playerRowButton = page
      .getByTestId('cap-sheet-full-player-row-button')
      .filter({ hasText: FCT_PLAYER_NAME })
      .first();
    await expect(playerRowButton).toBeVisible({ timeout: 20000 });
    await playerRowButton.hover();
    await page
      .getByRole('button', {
        name: new RegExp(`More actions for ${FCT_PLAYER_NAME}`, 'i'),
      })
      .click();

    const overflowMenu = page.getByTestId(
      'cap-sheet-full-player-row-overflow-menu'
    );
    await expect(overflowMenu).toBeVisible();
    await expect(
      overflowMenu.getByRole('menuitem', { name: /^Open Trade$/i })
    ).toBeVisible();
    await expect(
      overflowMenu.getByRole('menuitem', { name: /^Extend \(Preview\)$/i })
    ).toBeVisible();
    await expect(
      overflowMenu.getByRole('menuitem', { name: /^Waive \(Preview\)$/i })
    ).toBeVisible();
    await expect(
      overflowMenu.getByRole('menuitem', { name: /^Stretch \(Preview\)$/i })
    ).toBeVisible();
  });
});
