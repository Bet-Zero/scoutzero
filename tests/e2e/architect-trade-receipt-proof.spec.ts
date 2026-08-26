import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { TWO_WAY_TRADE_MATCHING_EXPLANATION } from '@/features/architect/utils/tradeMachine/utils/twoWayTradeSalary';
import {
  getTeamPlayerIds,
  getReviewAdminDb,
  getWorldEventDocuments,
  getWorldTeamDocument,
  openDashboardTab,
  readReviewUserId,
} from './helpers/architectReviewWorld';
import {
  makeResultingState,
  signingEvent,
} from '../architect/contractHistory/contractHistoryFixtures';
import {
  GovernedCashLedgerZ,
  GovernedCashReceiptZ,
} from '@/schemas/governedCashConsideration';
import { TradeHardCapLedgerZ } from '@/schemas/tradeApronRestriction';

const CANDIDATE = process.env.SCOUTZERO_PROOF_CANDIDATE ?? '';
const ARTIFACT_DIR = process.env.SCOUTZERO_BROWSER_PROOF_DIR ?? '';
const MIA_URL = '/gm/MIA?season=2027';
const PROOF_WORLD_ID = 'world_trade_receipt_proof';
const PROOF_AS_OF_DATE = '2026-11-15';
const EMPTY_RELEASE_DIGEST = `sha256:${'3'.repeat(64)}`;

const proofTpe = (teamCode: 'MIA' | 'DEN') => ({
  id: `proof-tpe-${teamCode}`,
  name: `${teamCode} governed proof TPE`,
  amount: 10_000_000,
  remainingAmount: 10_000_000,
  usedAmount: 0,
  isUsed: false,
  createdFrom: 'trade-receipt-proof',
  createdOn: '2026-02-01T12:00:00-05:00',
  expiresOn: '2027-02-01T12:00:00-05:00',
});

const salaryRow = (season: string, salary: number) => ({
  season,
  salary,
  capHit: salary,
  guaranteed: true,
  guaranteedAmount: salary,
  option: null,
  optionHolder: null,
  optionUsed: null,
  optionDecisionDate: {
    precision: 'unknown' as const,
    value: null,
    rawValue: null,
  },
  optionDecisionDeadline: {
    precision: 'unknown' as const,
    value: null,
    rawValue: null,
  },
  tradeBonus: null,
  incentives: {
    likely: 0,
    unlikely: 0,
    criteriaEvidence: 'unsupported' as const,
  },
  guaranteeSchedule: [],
  voidedByExtension: null,
  voidedOn: {
    precision: 'unknown' as const,
    value: null,
    rawValue: null,
  },
});

const proofContractLedger = (
  teamCode: 'MIA' | 'DEN',
  playerId: string,
  salary: number
) => {
  const contractId = `proof-contract-${playerId}`;
  const base = makeResultingState({
    contractId,
    contractVersion: 1,
    playerId,
    teamId: teamCode,
  });
  const resultingState = makeResultingState({
    contractId,
    contractVersion: 1,
    playerId,
    teamId: teamCode,
    terms: {
      ...base.terms,
      signingTeam: teamCode,
      salaries: [salaryRow('2026-27', salary), salaryRow('2027-28', salary)],
      totalValue: salary * 2,
      averageAnnualValue: salary,
      guaranteedValue: salary * 2,
      guaranteedYears: 2,
    },
  });
  return {
    payloadVersion: 2,
    ledgerId: `${PROOF_WORLD_ID}:${contractId}:contract`,
    ledgerVersion: 1,
    events: [
      signingEvent({
        eventId: `${contractId}:signing`,
        worldId: PROOF_WORLD_ID,
        contractId,
        playerId,
        teamId: teamCode,
        sourceTransactionId: `${contractId}:transaction`,
        resultingContractVersion: 1,
        resultingState,
      }),
    ],
  };
};

const proofContractLedgers = (teamCode: 'MIA' | 'DEN') =>
  teamCode === 'MIA'
    ? [
        proofContractLedger('MIA', 'mia_owen_frost', 3_200_000),
        proofContractLedger('MIA', 'mia_eli_navarro', 2_000_000),
      ]
    : [
        proofContractLedger('DEN', 'den_aaron_pike', 3_200_000),
        proofContractLedger('DEN', 'den_reggie_voss', 2_000_000),
      ];

const salaryBookInputs = (teamCode: 'MIA' | 'DEN') => {
  const line = (
    ledger: 'apron-team-salary' | 'tax-salary',
    leafId: string,
    effectiveFrom: string
  ) => ({
    id: `proof:${ledger}:${leafId}`,
    ledger,
    label: `${leafId} proof fixture`,
    amount: 0,
    effectiveFrom,
    canonLeafIds: [leafId],
    source: {
      authority: 'external-determination',
      reference: `trade-receipt-proof:${leafId}`,
    },
  });
  return {
    version: 1,
    salaryCapYear: 2027,
    incompleteRosterCharge: {
      id: `proof:team-salary:${teamCode}:incomplete-roster`,
      ledger: 'team-salary',
      label: 'Governed incomplete-roster charge',
      amount: teamCode === 'MIA' ? 1_357_763 : 0,
      effectiveFrom: '2026-07-01T00:00:00Z',
      canonLeafIds: ['CBA2-A01.1'],
      source: {
        authority: 'external-determination',
        reference: `trade-receipt-proof:${teamCode}:incomplete-roster`,
      },
    },
    apronAdjustments: {
      status: 'ready',
      lineItems: Array.from({ length: 10 }, (_, index) =>
        line(
          'apron-team-salary',
          `CBA2-C07.${index + 2}`,
          '2026-07-01T00:00:00Z'
        )
      ),
    },
    taxSalary: {
      status: 'ready',
      lineItems: Array.from({ length: 8 }, (_, index) =>
        line(
          'tax-salary',
          `CBA2-C08.${index + 1}`,
          index === 0 ? '2026-11-14T00:00:00Z' : '2026-11-14T01:00:00Z'
        )
      ),
    },
  };
};

test.use({ viewport: { width: 1280, height: 720 } });
test.setTimeout(240_000);

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const worldCount = async () =>
  getReviewAdminDb()
    .collection('architect_worlds')
    .get()
    .then((snapshot) => snapshot.size);

const seedProofWorld = async (uid: string) => {
  const db = getReviewAdminDb();
  const now = new Date();
  await db.doc(`architect_worlds/${PROOF_WORLD_ID}`).set({
    worldId: PROOF_WORLD_ID,
    worldName: 'Trade Receipt Proof',
    description: 'Deterministic emulator-only browser proof world.',
    createdBy: uid,
    createdAt: now,
    lastModifiedAt: now,
    currentSeason: '2026-27',
    baselineSeason: '2026-27',
    asOfDate: PROOF_AS_OF_DATE,
    parentWorldId: null,
    isArchived: false,
    contractBaselineVersion: 2,
    contractSourceRelease: {
      releaseId: 'trade-receipt-proof-overlay-only',
      releaseVersion: 1,
      releaseDigest: EMPTY_RELEASE_DIGEST,
    },
    contractBaselineEffectiveAt: '2026-07-01T00:00:00Z',
    contractBaselineSalaryCapYear: 2027,
    contractBaselineCoverage: { total: 0, complete: 0, needsInput: 0 },
  });

  const batch = db.batch();
  for (const teamCode of ['MIA', 'DEN'] as const) {
    const base = await db.doc(`architect_baseTeams/${teamCode}`).get();
    expect(base.exists).toBe(true);
    const baseData = base.data() ?? {};
    const baseExceptions =
      baseData.exceptions && typeof baseData.exceptions === 'object'
        ? baseData.exceptions
        : {};
    batch.set(db.doc(`architect_worlds/${PROOF_WORLD_ID}/teams/${teamCode}`), {
      ...baseData,
      id: teamCode,
      teamId: teamCode,
      teamCode,
      salaryBookInputs: salaryBookInputs(teamCode),
      contractEventLedgers: proofContractLedgers(teamCode),
      cashLedger: {
        ledgerVersion: 0,
        ledgerId: `cash-ledger:${teamCode}`,
        teamId: teamCode,
        entries: [],
      },
      exceptions: {
        ...baseExceptions,
        tpe: [proofTpe(teamCode)],
      },
    });
  }
  await batch.commit();
};

const prepareProofWorld = async (page: Page) => {
  await page.goto(MIA_URL, { waitUntil: 'domcontentloaded' });
  await expect
    .poll(() => readReviewUserId(page), {
      timeout: 30_000,
      message: 'review-mode anonymous authentication should become available',
    })
    .not.toBe('');
  const uid = await readReviewUserId(page);
  await seedProofWorld(uid);
  await page.evaluate(
    ({ storageKey, worldId }) => {
      window.localStorage.setItem(storageKey, worldId);
      window.localStorage.setItem('hz.currentSeasonEndYear', '2027');
    },
    {
      storageKey: `architect.activeWorldId.${uid}`,
      worldId: PROOF_WORLD_ID,
    }
  );
};

const isVisible = async (locator: Locator, timeout = 1_000) =>
  locator.isVisible({ timeout }).catch(() => false);

const fillPostAssignmentApronSalary = async (
  card: Locator
): Promise<number> => {
  const apronSalary = await card
    .locator('[data-apron-team-salary]')
    .getAttribute('data-apron-team-salary');
  expect(apronSalary).not.toBeNull();
  expect(String(apronSalary).trim()).not.toBe('');
  const salary = Number(apronSalary);
  expect(Number.isFinite(salary)).toBe(true);
  await card
    .getByLabel('Post-assignment Apron Team Salary')
    .fill(String(salary));
  return salary;
};

const openTradeMachine = async (page: Page) => {
  await page.goto(MIA_URL, { waitUntil: 'domcontentloaded' });
  const loadingDashboard = page.getByText(/^Loading GM Dashboard/i);
  const noTeamData = page.getByText(/^No team data$/i);
  const dashboardHeading = page.getByRole('heading', {
    name: /GM Dashboard/i,
  });

  await expect
    .poll(
      async () => {
        const stillLoading = await isVisible(loadingDashboard);
        const hasDashboardHeading = await isVisible(dashboardHeading);
        const hasNoTeamData = await isVisible(noTeamData);
        return {
          hasNoTeamData,
          isReady: !stillLoading && (hasDashboardHeading || hasNoTeamData),
        };
      },
      {
        timeout: 90_000,
        message:
          'MIA review dashboard should finish emulator authentication and fixture loading',
      }
    )
    .toMatchObject({ isReady: true });
  await expect(noTeamData).toHaveCount(0);
  await expect(
    page.getByText('Trade Receipt Proof', { exact: true }).first()
  ).toBeVisible({ timeout: 90_000 });
  await expect
    .poll(
      async () =>
        page.locator('[data-apron-team-salary]').evaluateAll((elements) =>
          elements.some((element) => {
            const raw = element.getAttribute('data-apron-team-salary');
            return (
              raw !== null && raw.trim() !== '' && Number.isFinite(Number(raw))
            );
          })
        ),
      {
        timeout: 90_000,
        message: 'the saved proof world should publish governed salary books',
      }
    )
    .toBe(true);

  const tradeTab = page.getByRole('tab', { name: /^Trade Machine$/i });
  await expect(tradeTab).toBeVisible({ timeout: 30_000 });
  await tradeTab.click();

  const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByTestId('trade-salary-path-election')).toHaveCount(
    1,
    {
      timeout: 90_000,
    }
  );
  return dialog;
};

const electSalaryPath = async (
  card: Locator,
  path: 'STANDARD_TPE' | 'AGGREGATED_STANDARD_TPE'
) => {
  await card.getByLabel('Elected path').selectOption(path);
};

const teamCard = (dialog: Locator, teamCode: string) =>
  dialog.getByTestId(`trade-team-card-${teamCode}`);

const assignHeldTpe = async (
  card: Locator,
  playerName: string,
  teamCode: 'MIA' | 'DEN'
): Promise<string> => {
  await card.getByLabel(`${playerName} absorption mode`).selectOption('TPE');
  const selector = card.getByLabel(`${playerName} held TPE`);
  const heldTpeId = `proof-tpe-${teamCode}`;
  await selector.selectOption(heldTpeId);
  return heldTpeId;
};

const routePlayer = async (
  dialog: Locator,
  page: Page,
  sourceTeamCode: string,
  playerName: string,
  destinationTeam: string
) => {
  const card = teamCard(dialog, sourceTeamCode);
  await expect(card).toBeVisible();
  const player = card
    .getByAltText(playerName, { exact: true })
    .or(card.getByText(playerName, { exact: true }))
    .first();
  const playerRow = player.locator(
    'xpath=ancestor::div[.//button[normalize-space()="•••"]][1]'
  );
  const menu = playerRow.getByRole('button', { name: '•••' });
  await expect(menu).toBeVisible();
  await menu.click();
  const route = page.getByRole('button', {
    name: new RegExp(`^Trade to ${escapeRegExp(destinationTeam)}$`, 'i'),
  });
  await expect(route).toBeVisible();
  await route.click();
};

const cancelPlayerTrade = async (
  dialog: Locator,
  page: Page,
  sourceTeamCode: string,
  playerName: string
) => {
  const card = teamCard(dialog, sourceTeamCode);
  const player = card
    .getByAltText(playerName, { exact: true })
    .or(card.getByText(playerName, { exact: true }))
    .first();
  const playerRow = player.locator(
    'xpath=ancestor::div[contains(@class, "h-[68px]") or contains(@class, "h-[40px]")][1]'
  );
  await playerRow.getByRole('button', { name: '•••' }).first().click();
  const cancel = page.getByRole('button', { name: /^Cancel Trade$/i });
  await expect(cancel).toBeVisible();
  await cancel.click();
};

test('exact-head Trade Machine produces a retained governed apron Trade Receipt', async ({
  page,
}, testInfo) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.stack ?? error.message);
  });
  expect(CANDIDATE).toMatch(/^[0-9a-f]{40}$/);
  expect(ARTIFACT_DIR).not.toBe('');
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  await page.addInitScript(() => {
    window.localStorage.setItem('hz.dev.tradeMachineDebug', 'true');
  });

  expect(await worldCount()).toBe(0);
  await prepareProofWorld(page);
  expect(await worldCount()).toBe(1);
  const dialog = await openTradeMachine(page);
  await expect(dialog.getByRole('button', { name: /Miami Heat/i })).toBeVisible(
    {
      timeout: 30_000,
    }
  );

  const teamPicker = dialog
    .locator('label', { hasText: /^Select Team$/i })
    .locator('xpath=following-sibling::select[1]');
  if ((await teamPicker.count()) === 0) {
    await dialog.getByRole('button', { name: /^Add Team$/i }).click();
  }
  await dialog
    .locator('label', { hasText: /^Select Team$/i })
    .locator('xpath=following-sibling::select[1]')
    .first()
    .selectOption('nuggets');

  const miamiCard = teamCard(dialog, 'MIA');
  const denverCard = teamCard(dialog, 'DEN');
  await electSalaryPath(miamiCard, 'AGGREGATED_STANDARD_TPE');
  await electSalaryPath(denverCard, 'AGGREGATED_STANDARD_TPE');

  await routePlayer(dialog, page, 'MIA', 'Tobias Lund', 'Denver Nuggets');
  await routePlayer(dialog, page, 'DEN', 'Obi Nwachukwu', 'Miami Heat');
  await routePlayer(dialog, page, 'MIA', 'Owen Frost', 'Denver Nuggets');
  await routePlayer(dialog, page, 'MIA', 'Eli Navarro', 'Denver Nuggets');
  await routePlayer(dialog, page, 'DEN', 'Aaron Pike', 'Miami Heat');
  await routePlayer(dialog, page, 'DEN', 'Reggie Voss', 'Miami Heat');

  const heldTpeIds = {
    MIA: await assignHeldTpe(miamiCard, 'Aaron Pike', 'MIA'),
    DEN: await assignHeldTpe(denverCard, 'Owen Frost', 'DEN'),
  };

  await miamiCard.getByLabel('MIA cash sent').fill('1');
  await expect(miamiCard.getByLabel('MIA cash recipient')).toHaveValue('DEN');

  await miamiCard.getByLabel('Tobias Lund exact pre-trade Salary').fill('0');
  await miamiCard
    .getByLabel('Owen Frost exact pre-trade Salary')
    .fill('3200000');
  await miamiCard
    .getByLabel('Eli Navarro exact pre-trade Salary')
    .fill('2000000');
  await denverCard.getByLabel('Obi Nwachukwu exact pre-trade Salary').fill('0');
  await denverCard
    .getByLabel('Aaron Pike exact pre-trade Salary')
    .fill('3200000');
  await denverCard
    .getByLabel('Reggie Voss exact pre-trade Salary')
    .fill('2000000');
  const governedPostSalaries = {
    MIA: await fillPostAssignmentApronSalary(miamiCard),
    DEN: await fillPostAssignmentApronSalary(denverCard),
  };
  expect(governedPostSalaries.MIA).toBeGreaterThan(209_015_000);
  expect(governedPostSalaries.DEN).toBeGreaterThan(209_015_000);
  expect(governedPostSalaries.MIA).toBeLessThanOrEqual(221_686_000);
  expect(governedPostSalaries.DEN).toBeLessThanOrEqual(221_686_000);

  const proofTeamRefs = ['MIA', 'DEN'].map((teamCode) =>
    getReviewAdminDb().doc(
      `architect_worlds/${PROOF_WORLD_ID}/teams/${teamCode}`
    )
  );
  const beforeValidationTeams = await Promise.all(
    proofTeamRefs.map((ref) => ref.get().then((snapshot) => snapshot.data()))
  );

  await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
  await page.waitForTimeout(500);
  expect(pageErrors).toEqual([]);
  await expect(dialog.getByTestId('trade-readiness-summary')).toContainText(
    'Trade blocked',
    { timeout: 20_000 }
  );
  await expect(dialog.getByTestId('trade-readiness-summary')).toContainText(
    'Transaction Restrictions Table Row F prohibits this trade'
  );
  await expect(
    dialog.getByRole('button', { name: /^Apply Trade$/i })
  ).toBeDisabled();

  const developmentTools = dialog.getByRole('button', {
    name: /Development Tools/i,
  });
  await expect(developmentTools).toBeVisible();
  await developmentTools.click();

  const receipt = dialog.getByTestId('section-trade-receipt');
  await expect(receipt).toBeVisible();
  await expect(receipt).toContainText('Trade Receipt (Debug Mode)');
  await expect(receipt).toContainText('ILLEGAL');
  await receipt.getByRole('button', { name: 'Show Details' }).click();

  await expect(receipt.getByText('Tobias Lund').first()).toBeVisible();
  await expect(receipt.getByText('Obi Nwachukwu').first()).toBeVisible();
  // Two routed Two-Way players appear once as outgoing and once as incoming,
  // yielding four explanations and four `2W` markers in the detailed receipt.
  await expect(
    receipt.getByText(TWO_WAY_TRADE_MATCHING_EXPLANATION, { exact: true })
  ).toHaveCount(4);
  await expect(receipt.getByText('2W', { exact: true })).toHaveCount(4);
  const heatApronProof = receipt.getByTestId('trade-apron-restriction-MIA');
  await expect(heatApronProof).toBeVisible();
  await expect(heatApronProof).toContainText('Rows F + H + I');
  await expect(heatApronProof).toContainText('FAIL');
  await expect(heatApronProof).toContainText('Controlling First Apron ceiling');
  await expect(heatApronProof).toContainText(
    'Row F · Held Standard TPE component proof-tpe-MIA'
  );
  await expect(heatApronProof).toContainText('Players: Aaron Pike');
  await expect(heatApronProof).toContainText(
    'Held TPE proof-tpe-MIA · created 2026-02-01T12:00:00-05:00 · expires 2027-02-01T12:00:00-05:00'
  );
  await expect(heatApronProof).toContainText(
    'Creation-season regular season ended 2026-04-12'
  );
  await expect(heatApronProof).toContainText('Authority GOV-CAL-0001');
  await expect(heatApronProof).toContainText('GOV-LVL-0004');
  await expect(heatApronProof).toContainText('CBA2-A05.8');
  await expect(heatApronProof).toContainText(
    /Row H · Aggregated Standard TPE component aggregated:/
  );
  await expect(heatApronProof).toContainText('Players: Reggie Voss');
  await expect(heatApronProof).toContainText('Row I · Cash payment');
  await expect(heatApronProof).toContainText('Authority GOV-CAL-0002');
  await expect(heatApronProof).toContainText('GOV-LVL-0005');
  await expect(heatApronProof).toContainText('CBA2-A05.10');

  const nuggetsApronProof = receipt.getByTestId('trade-apron-restriction-DEN');
  await expect(nuggetsApronProof).toBeVisible();
  await expect(nuggetsApronProof).toContainText('Rows F + H');
  await expect(nuggetsApronProof).toContainText('FAIL');
  await expect(nuggetsApronProof).toContainText(
    'Controlling First Apron ceiling'
  );
  await expect(nuggetsApronProof).toContainText(
    'Row F · Held Standard TPE component proof-tpe-DEN'
  );
  await expect(nuggetsApronProof).toContainText('Players: Owen Frost');
  await expect(nuggetsApronProof).toContainText(
    /Row H · Aggregated Standard TPE component aggregated:/
  );
  await expect(nuggetsApronProof).toContainText('Players: Eli Navarro');

  const heatCashProof = receipt.getByTestId('trade-cash-consideration-mia');
  await expect(heatCashProof).toBeVisible();
  await expect(heatCashProof).toContainText('PASS');
  await expect(heatCashProof).toContainText('Paid now');
  await expect(heatCashProof).toContainText('$1.00');
  await expect(heatCashProof).toContainText('Salary Cap Year 2027');
  const nuggetsCashProof = receipt.getByTestId('trade-cash-consideration-den');
  await expect(nuggetsCashProof).toBeVisible();
  await expect(nuggetsCashProof).toContainText('PASS');
  await expect(nuggetsCashProof).toContainText('Received now');
  await expect(nuggetsCashProof).toContainText('$1.00');

  const afterValidationTeams = await Promise.all(
    proofTeamRefs.map((ref) => ref.get().then((snapshot) => snapshot.data()))
  );
  expect(afterValidationTeams).toEqual(beforeValidationTeams);
  expect(await worldCount()).toBe(1);
  expect(pageErrors).toEqual([]);
  await receipt
    .getByTestId('trade-apron-restriction-MIA')
    .scrollIntoViewIfNeeded();
  const screenshotPath = path.join(ARTIFACT_DIR, 'trade-receipt-1280x720.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });

  await receipt.getByRole('button', { name: 'Hide Details' }).click();
  await cancelPlayerTrade(dialog, page, 'MIA', 'Eli Navarro');
  await cancelPlayerTrade(dialog, page, 'DEN', 'Reggie Voss');
  await electSalaryPath(miamiCard, 'STANDARD_TPE');
  await electSalaryPath(denverCard, 'STANDARD_TPE');
  await miamiCard.getByLabel('Aaron Pike absorption mode').selectOption('MATCH');
  await denverCard.getByLabel('Owen Frost absorption mode').selectOption('MATCH');

  await miamiCard.getByLabel('Tobias Lund exact pre-trade Salary').fill('0');
  await miamiCard
    .getByLabel('Owen Frost exact pre-trade Salary')
    .fill('3200000');
  await denverCard.getByLabel('Obi Nwachukwu exact pre-trade Salary').fill('0');
  await denverCard
    .getByLabel('Aaron Pike exact pre-trade Salary')
    .fill('3200000');
  const legalPostSalaries = {
    MIA: await fillPostAssignmentApronSalary(miamiCard),
    DEN: await fillPostAssignmentApronSalary(denverCard),
  };

  await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
  const readiness = dialog.getByTestId('trade-readiness-summary');
  await expect(readiness).toContainText('Ready to apply', { timeout: 20_000 });
  const applyTrade = dialog.getByRole('button', { name: /^Apply Trade$/i });
  await expect(applyTrade).toBeEnabled();
  await expect(receipt).toContainText('LEGAL');
  await receipt.getByRole('button', { name: 'Show Details' }).click();
  const legalHeatApronProof = receipt.getByTestId(
    'trade-apron-restriction-MIA'
  );
  await expect(legalHeatApronProof).toContainText('Row I');
  await expect(legalHeatApronProof).toContainText('PASS');
  await expect(legalHeatApronProof).toContainText(
    'Controlling Second Apron ceiling'
  );
  await expect(legalHeatApronProof).toContainText('Row I · Cash payment');
  await expect(legalHeatApronProof).toContainText(
    'Hard cap persists through Salary Cap Year 2027'
  );
  await expect(receipt.getByTestId('trade-cash-consideration-mia')).toContainText(
    '$1.00'
  );
  const legalScreenshotPath = path.join(
    ARTIFACT_DIR,
    'trade-cash-legal-1280x720.png'
  );
  await legalHeatApronProof.scrollIntoViewIfNeeded();
  await page.screenshot({ path: legalScreenshotPath, fullPage: false });
  await receipt.getByRole('button', { name: 'Hide Details' }).click();

  const salaryBooksBeforeApply = {
    MIA: beforeValidationTeams[0]?.salaryBookInputs,
    DEN: beforeValidationTeams[1]?.salaryBookInputs,
  };
  await applyTrade.click();
  await expect(dialog).toHaveCount(0, { timeout: 30_000 });

  await expect
    .poll(
      async () => {
        const [mia, den, events] = await Promise.all([
          getWorldTeamDocument(PROOF_WORLD_ID, 'MIA'),
          getWorldTeamDocument(PROOF_WORLD_ID, 'DEN'),
          getWorldEventDocuments(PROOF_WORLD_ID),
        ]);
        const tradeEvent = events.find(
          (event) => event.mutationType === 'executeTrade'
        );
        return {
          miaHasAaron: getTeamPlayerIds(mia).includes('den_aaron_pike'),
          miaRemovedOwen: !getTeamPlayerIds(mia).includes('mia_owen_frost'),
          denHasOwen: getTeamPlayerIds(den).includes('mia_owen_frost'),
          denRemovedAaron: !getTeamPlayerIds(den).includes('den_aaron_pike'),
          eventId: String(tradeEvent?.id || ''),
        };
      },
      {
        timeout: 30_000,
        message:
          'legal cash trade should atomically persist both Team snapshots and one executeTrade event',
      }
    )
    .toMatchObject({
      miaHasAaron: true,
      miaRemovedOwen: true,
      denHasOwen: true,
      denRemovedAaron: true,
    });

  const miaAfterApply = await getWorldTeamDocument(PROOF_WORLD_ID, 'MIA');
  const denAfterApply = await getWorldTeamDocument(PROOF_WORLD_ID, 'DEN');
  const eventsAfterApply = await getWorldEventDocuments(PROOF_WORLD_ID);
  const tradeEvent = eventsAfterApply.find(
    (event) => event.mutationType === 'executeTrade'
  );
  expect(tradeEvent).toBeDefined();
  const miaLedger = GovernedCashLedgerZ.parse(miaAfterApply?.cashLedger);
  const denLedger = GovernedCashLedgerZ.parse(denAfterApply?.cashLedger);
  expect(miaLedger).toMatchObject({
    ledgerVersion: 1,
    entries: [
      {
        direction: 'PAID',
        amountCents: 100,
        teamId: 'MIA',
        counterpartyTeamId: 'DEN',
        salaryCapYear: 2027,
      },
    ],
  });
  expect(denLedger).toMatchObject({
    ledgerVersion: 1,
    entries: [
      {
        direction: 'RECEIVED',
        amountCents: 100,
        teamId: 'DEN',
        counterpartyTeamId: 'MIA',
        salaryCapYear: 2027,
      },
    ],
  });
  expect(miaLedger.entries[0].transactionId).toBe(
    denLedger.entries[0].transactionId
  );
  expect(miaAfterApply?.salaryBookInputs).toEqual(salaryBooksBeforeApply.MIA);
  expect(denAfterApply?.salaryBookInputs).toEqual(salaryBooksBeforeApply.DEN);
  expect(TradeHardCapLedgerZ.parse(miaAfterApply?.hardCapLedger)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        restrictionRow: 'I',
        transactionId: miaLedger.entries[0].transactionId,
      }),
    ])
  );
  const eventMetadata =
    tradeEvent?.metadata && typeof tradeEvent.metadata === 'object'
      ? tradeEvent.metadata
      : {};
  const cashReceipt = GovernedCashReceiptZ.parse(
    eventMetadata.governedCashReceipt
  );
  expect(cashReceipt).toMatchObject({
    verificationStatus: 'complete',
    transactionId: miaLedger.entries[0].transactionId,
    salaryCapYear: 2027,
    salaryBookCashDeltas: [
      { teamId: 'MIA', teamSalary: 0, apronTeamSalary: 0, taxSalary: 0 },
      { teamId: 'DEN', teamSalary: 0, apronTeamSalary: 0, taxSalary: 0 },
    ],
  });
  expect(getTeamPlayerIds(miaAfterApply)).toEqual(
    expect.arrayContaining([
      'den_obi_nwachukwu',
      'den_aaron_pike',
      'mia_eli_navarro',
    ])
  );
  expect(getTeamPlayerIds(denAfterApply)).toEqual(
    expect.arrayContaining([
      'mia_tobias_lund',
      'mia_owen_frost',
      'den_reggie_voss',
    ])
  );
  expect(await worldCount()).toBe(1);

  await page.goto(MIA_URL, { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByText('Trade Receipt Proof', { exact: true }).first()
  ).toBeVisible({ timeout: 90_000 });
  await openDashboardTab(page, 'Team History');
  const historyTimeline = page.getByTestId('team-history-section-timeline');
  const tradeHistoryRow = historyTimeline.getByRole('button', {
    name: /Trade Executed: MIA ↔ DEN/i,
  });
  await expect(tradeHistoryRow).toBeVisible({ timeout: 30_000 });
  await tradeHistoryRow.click();
  const historyDetail = page.getByTestId('team-history-detail-modal');
  await expect(historyDetail).toContainText('Cash Consideration Receipt');
  await expect(historyDetail).toContainText(cashReceipt.receiptId);
  await expect(historyDetail).toContainText('MIA paid $1.00 to DEN');
  await expect(historyDetail).toContainText(
    'Salary-book cash deltas: $0.00 for every Team'
  );
  await expect(historyDetail).toContainText('Persistence verification: Complete');
  const historyScreenshotPath = path.join(
    ARTIFACT_DIR,
    'trade-cash-history-reload-1280x720.png'
  );
  await page.screenshot({ path: historyScreenshotPath, fullPage: false });
  expect(pageErrors).toEqual([]);

  const proof = {
    candidate: CANDIDATE,
    route: MIA_URL,
    viewport: page.viewportSize(),
    fixtures: {
      sourceTeam: 'MIA',
      sourcePlayer: 'mia_tobias_lund',
      destinationTeam: 'DEN',
      destinationPlayer: 'den_obi_nwachukwu',
      governedApronTransaction: {
        elections: {
          MIA: 'AGGREGATED_STANDARD_TPE',
          DEN: 'AGGREGATED_STANDARD_TPE',
        },
        heldTpeAbsorptions: {
          MIA: ['Aaron Pike'],
          DEN: ['Owen Frost'],
        },
        heldTpes: heldTpeIds,
        governedPostAssignmentApronSalaries: governedPostSalaries,
      },
    },
    assertions: {
      readiness: 'Trade blocked',
      blockingReason:
        'Transaction Restrictions Table Row F prohibits this trade because the mixed MIA component package exceeds the controlling First Apron.',
      receiptVerdict: 'ILLEGAL',
      apronRestrictionRows: { MIA: ['F', 'H', 'I'], DEN: ['F', 'H'] },
      controllingAprons: { MIA: 'FIRST_APRON', DEN: 'FIRST_APRON' },
      apronRestrictionStatuses: { MIA: 'FAIL', DEN: 'FAIL' },
      cashConsideration: {
        payer: 'MIA',
        recipient: 'DEN',
        amountCents: 100,
        salaryCapYear: 2027,
        evaluationStatuses: { MIA: 'PASS', DEN: 'PASS' },
      },
      componentAttribution: {
        MIA: {
          F: { componentId: heldTpeIds.MIA, players: ['Aaron Pike'] },
          H: { componentIdPrefix: 'aggregated:', players: ['Reggie Voss'] },
        },
        DEN: {
          F: { componentId: heldTpeIds.DEN, players: ['Owen Frost'] },
          H: { componentIdPrefix: 'aggregated:', players: ['Eli Navarro'] },
        },
      },
      heldTpeTimings: {
        MIA: {
          createdOn: '2026-02-01T12:00:00-05:00',
          expiresOn: '2027-02-01T12:00:00-05:00',
          creationSeasonRegularSeasonClosing: '2026-04-12',
        },
        DEN: {
          createdOn: '2026-02-01T12:00:00-05:00',
          expiresOn: '2027-02-01T12:00:00-05:00',
          creationSeasonRegularSeasonClosing: '2026-04-12',
        },
      },
      twoWayExplanationCount: 4,
      fixtureWorldCount: 1,
      durableWorldCountChangeAfterValidation: 0,
      durableTeamDocumentChangeAfterValidation: 0,
      savedWorldApply: {
        readiness: 'Ready to apply',
        electedPaths: { MIA: 'STANDARD_TPE', DEN: 'STANDARD_TPE' },
        governedPostAssignmentApronSalaries: legalPostSalaries,
        cashLedgerVersions: { MIA: 1, DEN: 1 },
        pairedTransactionId: miaLedger.entries[0].transactionId,
        receiptId: cashReceipt.receiptId,
        cashAmountCents: 100,
        salaryBookCashDeltas: cashReceipt.salaryBookCashDeltas,
        hardCapRows: { MIA: ['I'], DEN: [] },
        worldCountAfterApply: 1,
        reloadHistoryReceiptVisible: true,
      },
    },
  };
  const proofPath = path.join(ARTIFACT_DIR, 'proof.json');
  fs.writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
  await testInfo.attach('exact-candidate-proof', {
    body: Buffer.from(JSON.stringify(proof, null, 2)),
    contentType: 'application/json',
  });
  await testInfo.attach('trade-receipt-1280x720', {
    path: screenshotPath,
    contentType: 'image/png',
  });
  await testInfo.attach('trade-cash-legal-1280x720', {
    path: legalScreenshotPath,
    contentType: 'image/png',
  });
  await testInfo.attach('trade-cash-history-reload-1280x720', {
    path: historyScreenshotPath,
    contentType: 'image/png',
  });
});
