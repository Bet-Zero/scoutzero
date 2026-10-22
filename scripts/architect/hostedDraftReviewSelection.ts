import type { Page } from 'playwright';

export const HOSTED_DRAFT_REVIEW_PRIMARY_TEAM = 'PHI';

// Fixed labels only: never put UI text, pick IDs, URLs or exceptions in logs.
export type HostedSelectionPhase =
  | 'open-trade-machine'
  | 'load-primary-team'
  | 'select-counterparty'
  | 'load-counterparty'
  | 'open-pick-inventory'
  | 'find-first-round-pick'
  | 'live-pick-inventory-empty'
  | 'open-pick-menu'
  | 'stage-pick-destination'
  | 'cancel-pick-destination';

export async function selectHostedDraftReviewPick(
  page: Page,
  setPhase: (phase: HostedSelectionPhase) => void
) {
  setPhase('open-trade-machine');
  await page.getByRole('tab', { name: /^Trade Machine$/i }).click();
  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  const card = dialog.getByTestId(
    `trade-team-card-${HOSTED_DRAFT_REVIEW_PRIMARY_TEAM}`
  );
  setPhase('load-primary-team');
  await card.waitFor();
  const picker = dialog
    .locator('label', { hasText: /^Select Team$/ })
    .locator('xpath=following-sibling::select[1]');
  setPhase('select-counterparty');
  if ((await picker.count()) === 0)
    await dialog.getByRole('button', { name: /^Add Team$/ }).click();
  await picker.first().selectOption('nuggets');
  setPhase('load-counterparty');
  await dialog.getByTestId('trade-team-card-DEN').waitFor();
  setPhase('open-pick-inventory');
  await card.getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i }).click();
  setPhase('find-first-round-pick');
  // The approved source installation links this one year. A different first
  // round must not make an incomplete installation appear to work.
  const pick = card.getByText('2028 - Round 1', { exact: true });
  const empty = card.getByText('No draft picks to show.', { exact: false });
  await pick.or(empty).first().waitFor();
  if (!(await pick.isVisible()) && (await empty.isVisible())) {
    setPhase('live-pick-inventory-empty');
    throw new Error('LIVE_PICK_INVENTORY_REQUIRED');
  }
  // No synthetic fixture, legacy-pick inference, session edit or world seed.
  await pick.waitFor();
  const row = pick.locator(
    'xpath=ancestor::div[.//button[normalize-space()="•••"]][1]'
  );
  return async function stage(cancel = false) {
    setPhase('open-pick-menu');
    await row.getByRole('button', { name: '•••' }).click();
    setPhase(cancel ? 'cancel-pick-destination' : 'stage-pick-destination');
    await row
      .getByRole('button', {
        // Loaded team names retain their source casing (e.g. DENVER NUGGETS).
        // Match only casing variants of this exact counterparty, in this row.
        name: cancel ? /^Cancel Trade$/ : /^Trade to Denver Nuggets$/i,
      })
      .click();
  };
}
