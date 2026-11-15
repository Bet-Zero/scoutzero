/** Independent controlled-fixture oracle for the maintained waiver form.
 * Not current NBA inputs. CBA2-R01.4/R01.6/R01.11/R01.18 separate receipt,
 * removal and expiry; R04.1/.2 govern 2n+1; R05.6 requires proportional buyout.
 */
import { ARCHITECT_WORLDS_COLLECTION } from '@/constants/collections';
import { expect, type Page } from '@playwright/test';
import {
  getReviewAdminDb,
  getWorldTeamDocument,
  openDashboardTab,
} from './architectReviewWorld';

export type QaWaiverPath = 'waive' | 'waive-and-stretch' | 'buyout';

export async function fillQaWaiverEvidence(page: Page, path: QaWaiverPath) {
  const modal = page.getByTestId('edit-contract-modal');
  await modal
    .getByTestId('governed-waiver-league-receipt')
    .fill('2026-07-15T00:00');
  if (path === 'waive-and-stretch')
    await modal.getByTestId('governed-waiver-stretch-election').check();
  if (path === 'buyout') {
    await modal
      .getByLabel('Reduction of protected Base Compensation', { exact: true })
      .fill('5000000');
    await modal.getByTestId('governed-waiver-buyout-agreement').check();
  }
}

export async function verifyQaWaiverSchedule(
  page: Page,
  worldId: string,
  path: QaWaiverPath
) {
  // Declared fixture: remaining protected pay is 15m + 16m = 31m.
  // July stretch: 2*2+1 = 5, so 31m/5 = 6.2m per year.
  // Buyout: 31m-5m = 26m, allocated in the 15:16 ratio. Whole-dollar
  // residual reconciliation gives 12,580,645 and 13,419,355 (sum 26m).
  const expected =
    path === 'waive-and-stretch'
      ? ['2026-27', '2027-28', '2028-29', '2029-30', '2030-31'].map(
          (season) => ({ season, amount: 6_200_000, isStretched: true })
        )
      : [
          {
            season: '2026-27',
            amount: path === 'buyout' ? 12_580_645 : 15_000_000,
            isStretched: false,
          },
          {
            season: '2027-28',
            amount: path === 'buyout' ? 13_419_355 : 16_000_000,
            isStretched: false,
          },
        ];
  const team = (await getWorldTeamDocument(worldId, 'LAL'))!;
  const entry = team.deadCap.find(
    (row: Record<string, unknown>) => row.playerId === 'austin_reaves'
  );
  expect(entry.amountByYear).toEqual([
    { season: '2026-27', amount: 15_000_000, isStretched: false },
    { season: '2027-28', amount: 16_000_000, isStretched: false },
  ]);
  expect(entry.governedLifecycle).toMatchObject({
    path: path === 'waive' ? 'standard' : path,
    leagueReceivedAt: '2026-07-15T00:00-04:00',
    expiresAt: '2026-07-17T00:00:00-04:00',
    terminationAt: '2026-07-17T00:00:00-04:00',
    buyoutReduction: path === 'buyout' ? 5_000_000 : 0,
  });
  expect(
    entry.governedLifecycle.allocations.map((row: Record<string, unknown>) => ({
      season: row.season,
      amount: row.teamSalary,
      isStretched: row.isTeamSalaryStretched,
    }))
  ).toEqual(expected);

  await openDashboardTab(page, 'Full Cap Table');
  const status = page.getByTestId('cap-sheet-full-governed-waiver-status');
  if (!(await status.isVisible()))
    await page.getByTestId('cap-sheet-full-dead-money-toggle').click();
  await expect(status).toHaveAttribute('data-waiver-status', 'pending');
  const amounts = page.getByTestId('cap-sheet-full-dead-money-amount');
  await expect(amounts.nth(0)).toContainText('$15,000,000');
  await expect(amounts.nth(1)).toContainText('$16,000,000');

  // Advance the controlled world clock beyond the exact 48h window. The
  // immutable saved lifecycle remains unchanged; readers project the new date.
  await getReviewAdminDb()
    .doc(`${ARCHITECT_WORLDS_COLLECTION}/${worldId}`)
    .update({ asOfDate: '2026-07-18' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('cockpit-world-menu-trigger')).toContainText(
    '2026-07-18',
    { timeout: 20_000 }
  );
  await openDashboardTab(page, 'Full Cap Table');
  if (!(await status.isVisible()))
    await page.getByTestId('cap-sheet-full-dead-money-toggle').click();
  await expect(status).toHaveAttribute('data-waiver-status', 'terminated');
  // Full Cap Table retains empty future-year cells beyond the liability term.
  await expect(amounts.filter({ hasText: /\$/ })).toHaveCount(expected.length);
  for (const [index, row] of expected.entries())
    await expect(amounts.nth(index)).toContainText(
      `$${row.amount.toLocaleString('en-US')}`
    );
  expect(await getWorldTeamDocument(worldId, 'LAL')).toEqual(team);
}
