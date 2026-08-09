/**
 * Browser acceptance for BZE-273's saved-world governed rights path.
 *
 * Run:
 *   PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true npx playwright test tests/e2e/architect-governed-rights-renunciation.spec.ts --reporter=line --workers=1
 */

import { expect, test, type Page } from '@playwright/test';
import {
  MIA_SEASON_ADVANCE_URL,
  MIA_TEAM_CODE,
  activateSeededWorld,
  enableArchitectReviewFlags,
  getReviewAdminDb,
  getWorldEventDocuments,
  getWorldTeamDocument,
  openDashboardTab,
  readReviewUserId,
  seedSeasonAdvanceReviewWorld,
  waitForReviewDashboard,
} from './helpers/architectReviewWorld';

const PLAYER_ID = 'mia_grant_holloway';
const PLAYER_NAME = 'Grant Holloway';
const SALARY_CAP_YEAR = 2027;
const RIGHTS_WORLD_VERSION = 1;

const source = (sourceId: string) => ({
  sourceId,
  sourceVersion: 1,
  authority: 'official',
  artifact: 'bze-273-browser-fixture',
  field: sourceId,
  effectiveFrom: '2026-07-01',
  effectiveThrough: '2027-06-30',
  recordStatus: 'current',
  supersedesSourceVersion: null,
});

const service = (salaryCapYear: number) => ({
  serviceRecordId: `service-${salaryCapYear}`,
  serviceRecordVersion: 1,
  salaryCapYear,
  serviceStatus: 'credited',
  creditedTeamId: MIA_TEAM_CODE,
  rightsTeamId: MIA_TEAM_CODE,
  continuityRoute: 'same-team',
  continuityEventId: null,
  source: source(`service-${salaryCapYear}-source`),
  recordStatus: 'current',
  supersedesServiceRecordVersion: null,
});

const governedRightsLedger = (worldId: string) => {
  const amounts = {
    'prior-regular-salary': 10_000_000,
    'prior-signing-bonus-allocation': 1_000_000,
    'earned-performance-bonuses': 500_000,
    'applicable-minimum-salary': 1_500_000,
    'two-years-service-minimum-salary': 2_000_000,
    'applicable-maximum-salary': 30_000_000,
    'estimated-average-player-salary': 12_000_000,
  } as const;
  const ledgerId = `rights-${worldId}-${MIA_TEAM_CODE}`;

  return {
    payloadVersion: 1,
    ledgerId,
    ledgerVersion: 1,
    worldId,
    teamId: MIA_TEAM_CODE,
    events: [
      {
        eventId: `${ledgerId}:${PLAYER_ID}:established`,
        eventVersion: 1,
        eventKind: 'rights-established',
        worldId,
        playerId: PLAYER_ID,
        teamId: MIA_TEAM_CODE,
        salaryCapYear: SALARY_CAP_YEAR,
        executedAt: '2026-07-01',
        effectiveAt: '2026-07-01',
        recordedAt: '2026-07-01T16:00:00Z',
        predecessorEventId: null,
        predecessorState: null,
        resultingState: {
          stateId: `${ledgerId}:${PLAYER_ID}:state`,
          stateVersion: 1,
        },
        provenance: {
          sourceTransactionId: 'bze-273-browser-seed',
          authoringIdentity: 'browser-fixture',
        },
        recordStatus: 'current',
        supersedesEventVersion: null,
        canonLeafIds: [
          'CBA2-C01.2',
          'CBA2-C01.3',
          'CBA2-C01.4',
          'CBA2-C01.5',
          'CBA2-C01.6',
          'CBA2-C14.1',
          'CBA2-C14.2',
          'CBA2-C14.3',
          'CBA2-C14.4',
        ],
        freeAgentStatus: 'UFA',
        rightOfFirstRefusal: 'not-applicable',
        serviceHistoryCompleteFromSalaryCapYear: 2024,
        serviceSeasons: [service(2026), service(2025), service(2024)],
        priorContract: {
          contractId: 'grant-holloway-prior-contract',
          contractVersion: 1,
          finalSalaryCapYear: 2026,
          wasOneSeasonMinimumContract: false,
          wasRookieScaleFourthYear: false,
          source: source('grant-holloway-prior-contract-source'),
        },
        amountRecords: Object.entries(amounts).map(([kind, amount]) => ({
          amountRecordId: `amount-${kind}`,
          amountRecordVersion: 1,
          kind,
          salaryCapYear: SALARY_CAP_YEAR,
          amount,
          source: source(`amount-${kind}-source`),
          recordStatus: 'current',
          supersedesAmountRecordVersion: null,
        })),
      },
    ],
  };
};

const ownFreeAgentRow = (page: Page) =>
  page
    .getByTestId('cap-sheet-full-fa-decision-row')
    .filter({ hasText: PLAYER_NAME });

const reloadFullCap = async (page: Page) => {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForReviewDashboard(page);
  await openDashboardTab(page, 'Full Cap Table');
};

test.describe('BZE-273 governed rights browser acceptance', () => {
  test('fails closed, renounces, persists, records history, and reloads exactly', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await enableArchitectReviewFlags(page);
    await page.goto(MIA_SEASON_ADVANCE_URL, { waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);

    await expect
      .poll(() => readReviewUserId(page), {
        timeout: 25_000,
        message: 'anonymous review user should initialize',
      })
      .not.toBe('');
    const userId = await readReviewUserId(page);
    const worldId = await seedSeasonAdvanceReviewWorld(
      userId,
      `BZE-273 Rights Proof ${Date.now()}`
    );
    await activateSeededWorld(page, userId, worldId);
    await openDashboardTab(page, 'Full Cap Table');

    // Clean break: the deliberately pre-ledger world is rejected visibly.
    await expect(
      page.getByTestId('cap-sheet-full-rights-incompatible')
    ).toContainText('Recreate it');

    // A compatible world still fails closed until governed evidence is supplied.
    const db = getReviewAdminDb();
    await db.doc(`architect_worlds/${worldId}`).set(
      { rightsLedgerVersion: RIGHTS_WORLD_VERSION },
      { merge: true }
    );
    await reloadFullCap(page);
    await expect(
      page.getByTestId('cap-sheet-full-rights-totals-incomplete')
    ).toBeVisible();
    await expect(
      ownFreeAgentRow(page).getByTestId('cap-sheet-full-rights-needs-input')
    ).toContainText('Needs input');
    await expect(
      ownFreeAgentRow(page).getByTestId('cap-sheet-full-fa-absolve-button')
    ).toBeDisabled();

    // Supply an explicitly governed test ledger; no runtime inference occurs.
    await db.doc(`architect_worlds/${worldId}/teams/${MIA_TEAM_CODE}`).set(
      { rightsLedger: governedRightsLedger(worldId) },
      { merge: true }
    );
    await reloadFullCap(page);
    const initialRow = ownFreeAgentRow(page);
    await expect(initialRow).toBeVisible();
    await expect(initialRow.getByTestId('fa-bird-rights')).toHaveAttribute(
      'title',
      'Full Bird rights'
    );
    await expect(
      initialRow.getByTestId('cap-sheet-full-fa-resign-cell')
    ).toContainText('$21,850,000');

    page.on('dialog', (dialog) => void dialog.accept());
    await initialRow.hover();
    await initialRow
      .getByTestId('cap-sheet-full-fa-absolve-button')
      .click();
    await expect(ownFreeAgentRow(page)).toHaveCount(0, { timeout: 20_000 });

    await expect
      .poll(async () => {
        const team = await getWorldTeamDocument(worldId, MIA_TEAM_CODE);
        const ledger = team?.rightsLedger as
          | { ledgerVersion?: number; events?: Array<{ eventKind?: string }> }
          | undefined;
        return {
          holdPresent: Array.isArray(team?.capHolds)
            ? team.capHolds.some(
                (hold) =>
                  typeof hold === 'object' &&
                  hold !== null &&
                  (hold as { playerId?: string }).playerId === PLAYER_ID
              )
            : false,
          ledgerVersion: ledger?.ledgerVersion,
          finalEvent: ledger?.events?.at(-1)?.eventKind,
        };
      })
      .toEqual({
        holdPresent: false,
        ledgerVersion: 2,
        finalEvent: 'rights-renounced',
      });

    const events = await getWorldEventDocuments(worldId);
    expect(events.some((event) => event.mutationType === 'renounceRights')).toBe(
      true
    );

    await openDashboardTab(page, 'Team History');
    await expect(page.getByText(/Team Transaction History/i)).toBeVisible();
    const historyRow = page.getByTestId('team-history-event-row-0');
    await expect(historyRow).toContainText(/Free Agent Amount renounced/i);
    await historyRow.click();
    const detail = page.getByTestId('team-history-detail-modal');
    await expect(detail).toContainText('Former status: Full Bird');
    await expect(detail).toContainText('Free Agent Amount removed: $21,850,000');
    await expect(detail).toContainText('Resulting rights state:');

    await reloadFullCap(page);
    await expect(ownFreeAgentRow(page)).toHaveCount(0);
    await openDashboardTab(page, 'Team History');
    await expect(page.getByTestId('team-history-event-row-0')).toContainText(
      /Free Agent Amount renounced/i
    );

    testInfo.annotations.push({
      type: 'audit-note',
      description:
        'BZE-273 browser proof: an old world visibly required recreation; the compatible world visibly blocked missing rights inputs; an explicit governed Full Bird/FAA ledger enabled renunciation; the hold disappeared, immutable rights history advanced to v2, Team History named the former status/amount/result state, and reload preserved the exact result.',
    });
  });
});
