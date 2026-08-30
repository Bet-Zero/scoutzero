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
import { SalaryBooksSnapshotZ } from '@/schemas/salaryBooks';

const CANDIDATE = process.env.SCOUTZERO_PROOF_CANDIDATE ?? '';
const ARTIFACT_DIR = process.env.SCOUTZERO_BROWSER_PROOF_DIR ?? '';
const MIA_URL = '/gm/MIA?season=2027';
const PROOF_WORLD_ID = 'world_trade_receipt_proof';
const PROOF_AS_OF_DATE = '2026-07-07';
const EMPTY_RELEASE_DIGEST = `sha256:${'3'.repeat(64)}`;
const ZERO_YOS_MINIMUM = 1_357_763;
const FIRST_ROUND_PROOF_ENTITLEMENT_ID =
  'proof-entitlement-MIA-2027-first-round';
const PROOF_ROSTERS = {
  MIA: [
    'mia_marcus_vance',
    'mia_theo_bennett',
    'mia_andre_cole',
    'mia_rashad_pierce',
    'mia_isaiah_fenn',
    'mia_lucas_reyes',
    'mia_devin_oakes',
    'mia_owen_frost',
    'mia_eli_navarro',
    'mia_silas_park',
    'mia_tobias_lund',
  ],
  DEN: [
    'den_elias_rho',
    'den_marcus_devlin',
    'den_otto_grausam',
    'den_rhys_calder',
    'den_nikolai_vasquez',
    'den_damon_pearl',
    'den_silas_wren',
    'den_ivo_karlsson',
    'den_teo_marchetti',
    'den_aaron_pike',
    'den_reggie_voss',
    'den_obi_nwachukwu',
  ],
} as const;

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
  salary: number,
  tradeKickerPercent: number | null = null
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
      bonuses: { tradeKickerPercent },
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
        proofContractLedger('MIA', 'mia_silas_park', 2_000_000, 0.15),
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
    unsignedFirstRoundPickState: {
      version: 1,
      status: 'ready',
      teamCode,
      salaryCapYear: 2027,
      entries: [],
      source: {
        evidenceId: `trade-receipt-proof:${teamCode}:unsigned-first-round-picks`,
        evidenceVersion: 1,
        authority: 'external-determination',
        reference: 'authenticated-proof-fixture:none',
        authenticatedAt: '2026-07-01T00:00:00-04:00',
        recordStatus: 'current',
        canonLeafIds: ['CBA2-C02.1', 'CBA2-C03.1'],
      },
    },
    apronAdjustments: {
      status: 'ready',
      lineItems: Array.from({ length: 10 }, (_, index) =>
        ({
          ...line(
            'apron-team-salary',
            `CBA2-C07.${index + 2}`,
            '2026-07-01T00:00:00Z'
          ),
          amount:
            index === 0 ? (teamCode === 'MIA' ? 30_000_000 : 8_000_000) : 0,
        })
      ),
    },
    taxSalary: {
      status: 'ready',
      lineItems: Array.from({ length: 8 }, (_, index) =>
        line(
          'tax-salary',
          `CBA2-C08.${index + 1}`,
          index === 0 ? '2026-07-01T00:00:00Z' : '2026-07-01T01:00:00Z'
        )
      ),
    },
  };
};

test.use({
  viewport: { width: 1280, height: 720 },
  trace: {
    mode: 'on',
    screenshots: false,
    snapshots: false,
    sources: true,
  },
});
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
      roster: [...PROOF_ROSTERS[teamCode]],
      entitlementIds:
        teamCode === 'MIA'
          ? [FIRST_ROUND_PROOF_ENTITLEMENT_ID]
          : [],
      capHolds: [],
      offerSheets: [],
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
  batch.set(
    db.doc(
      `architect_worlds/${PROOF_WORLD_ID}/entitlements/${FIRST_ROUND_PROOF_ENTITLEMENT_ID}`
    ),
    {
      id: FIRST_ROUND_PROOF_ENTITLEMENT_ID,
      entitlementId: FIRST_ROUND_PROOF_ENTITLEMENT_ID,
      holderTeam: 'MIA',
      originalTeam: 'MIA',
      seasonYear: 2027,
      year: 2027,
      round: 1,
      kind: 'pick_ownership',
      description: 'MIA own 2027 first-round pick',
      underlyingPickId: 'MIA_2027_1',
      underlyingStatus: 'clean',
    }
  );
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
  if (!(await menu.isVisible())) {
    await card
      .getByRole('button', { name: /^(Players|Plr)( \(\d+\))?$/i })
      .click();
  }
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
  sourceTeamCode: string,
  playerName: string
) => {
  const card = teamCard(dialog, sourceTeamCode);
  const outgoingChip = card
    .locator('span[class*="bg-cockpit-danger/15"]')
    .filter({ hasText: playerName });
  await expect(outgoingChip).toHaveCount(1);
  await outgoingChip.getByRole('button').click();
  await expect(outgoingChip).toHaveCount(0);
};

const routeEntitlement = async (
  card: Locator,
  page: Page,
  year: number,
  round: number,
  destinationTeam: string
) => {
  await card
    .getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i })
    .click();
  const entitlementLabel = card.getByText(`${year} - Round ${round}`, {
    exact: true,
  });
  await expect(entitlementLabel).toBeVisible();
  const entitlementRow = entitlementLabel.locator(
    'xpath=ancestor::div[.//button[normalize-space()="•••"]][1]'
  );
  await entitlementRow.getByRole('button', { name: '•••' }).click();
  await page
    .getByRole('button', {
      name: new RegExp(`^Trade to ${escapeRegExp(destinationTeam)}$`, 'i'),
    })
    .click();
};

const cancelEntitlementTrade = async (
  card: Locator,
  page: Page,
  year: number,
  round: number
) => {
  const entitlementLabel = card.getByText(`${year} - Round ${round}`, {
    exact: true,
  });
  const entitlementRow = entitlementLabel.locator(
    'xpath=ancestor::div[.//button[normalize-space()="•••"]][1]'
  );
  await entitlementRow.getByRole('button', { name: '•••' }).click();
  await page.getByRole('button', { name: /^Cancel Trade$/i }).click();
};

const assertPersistedIncompleteRosterBooks = (
  teamDocument: Record<string, unknown> | undefined,
  expected: { teamCode: 'MIA' | 'DEN'; count: number; missingSlots: number }
) => {
  const totals = (teamDocument?.totals ?? {}) as Record<string, unknown>;
  const amount = expected.missingSlots * ZERO_YOS_MINIMUM;
  expect(totals.incompleteRosterResolution).toMatchObject({
    mode: 'governed',
    status: 'complete',
    activeWindow: true,
    counts: {
      underContract: expected.count,
      veteranFreeAgentAmounts: 0,
      offerSheets: 0,
      unsignedFirstRoundPicks: 0,
      total: expected.count,
    },
    threshold: 12,
    missingSlots: expected.missingSlots,
    chargePerSlot: ZERO_YOS_MINIMUM,
    amount,
    canonLeafIds: ['CBA2-C03.1', 'CBA2-C03.2', 'CBA2-C07.11'],
    missingInputs: [],
  });

  const salaryBooks = SalaryBooksSnapshotZ.parse(totals.salaryBooks);
  const { teamSalary, apronTeamSalary, taxSalary } = salaryBooks.ledgers;
  expect(salaryBooks).toMatchObject({
    status: 'complete',
    context: { salaryCapYear: 2027, teamId: expected.teamCode },
  });
  if (
    teamSalary.status !== 'complete' ||
    apronTeamSalary.status !== 'complete' ||
    taxSalary.status !== 'complete'
  ) {
    throw new Error(`${expected.teamCode} salary books did not persist complete.`);
  }

  const teamChargeLines = teamSalary.lineItems.filter((lineItem) =>
    lineItem.canonLeafIds.includes('CBA2-C03.1')
  );
  const apronReversalLines = apronTeamSalary.lineItems.filter((lineItem) =>
    lineItem.canonLeafIds.includes('CBA2-C07.11')
  );
  expect(teamChargeLines).toHaveLength(1);
  expect(apronReversalLines).toHaveLength(1);
  const [teamCharge] = teamChargeLines;
  const [apronReversal] = apronReversalLines;
  expect(teamCharge).toMatchObject({
    amount,
    included: true,
    source: {
      authority: 'canon',
      reference: 'derived-from:governed-incomplete-roster-resolution',
    },
  });
  expect(apronReversal).toMatchObject({
    amount: -amount,
    included: true,
    source: {
      authority: 'canon',
      reference: 'derived-from:governed-incomplete-roster-resolution',
    },
  });
  expect(taxSalary.lineItems).toHaveLength(8);
  expect(
    taxSalary.lineItems.some((lineItem) =>
      lineItem.canonLeafIds.some(
        (leafId) => leafId === 'CBA2-C03.1' || leafId === 'CBA2-C07.11'
      )
    )
  ).toBe(false);
  expect(totals.teamSalary).toBe(teamSalary.total);
  expect(totals.apronTeamSalary).toBe(apronTeamSalary.total);
  expect(totals.taxSalary).toBe(taxSalary.total);

  return {
    count: expected.count,
    missingSlots: expected.missingSlots,
    chargePerSlot: ZERO_YOS_MINIMUM,
    amount,
    teamSalary: teamSalary.total,
    apronTeamSalary: apronTeamSalary.total,
    taxSalary: taxSalary.total,
    teamSalaryCharge: teamCharge?.amount ?? null,
    apronTeamSalaryReversal: apronReversal?.amount ?? null,
  };
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
  const proofTeamRefs = ['MIA', 'DEN'].map((teamCode) =>
    getReviewAdminDb().doc(
      `architect_worlds/${PROOF_WORLD_ID}/teams/${teamCode}`
    )
  );

  await electSalaryPath(miamiCard, 'STANDARD_TPE');
  await electSalaryPath(denverCard, 'STANDARD_TPE');
  await fillPostAssignmentApronSalary(miamiCard);
  await fillPostAssignmentApronSalary(denverCard);

  const draftAuthorityBefore = {
    teams: await Promise.all(
      proofTeamRefs.map((ref) =>
        ref.get().then((snapshot) => snapshot.data())
      )
    ),
    events: await getWorldEventDocuments(PROOF_WORLD_ID),
  };
  await routeEntitlement(miamiCard, page, 2027, 1, 'Denver Nuggets');
  await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
  const readiness = dialog.getByTestId('trade-readiness-summary');
  await expect(readiness).toContainText('Needs input', { timeout: 20_000 });
  await expect(readiness).toContainText(
    'Complete governed ownership, protection, conveyance, freeze, unfreeze, and penalty history is unavailable'
  );
  await expect(
    dialog.getByRole('button', { name: /^Apply Trade$/i })
  ).toBeDisabled();
  await expect(dialog).not.toContainText('Stepien Rule compliant');
  const stepienNeedsInputScreenshotPath = path.join(
    ARTIFACT_DIR,
    'stepien-needs-input-1280x720.png'
  );
  await readiness.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: stepienNeedsInputScreenshotPath,
    fullPage: false,
  });
  expect(
    await Promise.all(
      proofTeamRefs.map((ref) =>
        ref.get().then((snapshot) => snapshot.data())
      )
    )
  ).toEqual(draftAuthorityBefore.teams);
  expect(await getWorldEventDocuments(PROOF_WORLD_ID)).toEqual(
    draftAuthorityBefore.events
  );

  await cancelEntitlementTrade(miamiCard, page, 2027, 1);

  const tradeBonusBefore = {
    teams: await Promise.all(
      proofTeamRefs.map((ref) =>
        ref.get().then((snapshot) => snapshot.data())
      )
    ),
    events: await getWorldEventDocuments(PROOF_WORLD_ID),
  };
  await routePlayer(dialog, page, 'MIA', 'Silas Park', 'Denver Nuggets');
  await miamiCard
    .getByLabel('Silas Park exact pre-trade Salary')
    .fill('2000000');
  await fillPostAssignmentApronSalary(miamiCard);
  await fillPostAssignmentApronSalary(denverCard);
  await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
  await expect(readiness).toContainText('Needs input', { timeout: 20_000 });
  await expect(readiness).toContainText(/trade bonus/i);
  await expect(readiness).not.toContainText('Not validated');
  await expect(
    dialog.getByRole('button', { name: /^Apply Trade$/i })
  ).toBeDisabled();
  await expect(dialog.getByTestId('trade-summary-button')).toBeDisabled();
  const tradeBonusNeedsInputScreenshotPath = path.join(
    ARTIFACT_DIR,
    'trade-bonus-needs-input-1280x720.png'
  );
  await readiness.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: tradeBonusNeedsInputScreenshotPath,
    fullPage: false,
  });
  expect(
    await Promise.all(
      proofTeamRefs.map((ref) =>
        ref.get().then((snapshot) => snapshot.data())
      )
    )
  ).toEqual(tradeBonusBefore.teams);
  expect(await getWorldEventDocuments(PROOF_WORLD_ID)).toEqual(
    tradeBonusBefore.events
  );
  await cancelPlayerTrade(dialog, 'MIA', 'Silas Park');

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
  await cancelPlayerTrade(dialog, 'MIA', 'Eli Navarro');
  await cancelPlayerTrade(dialog, 'DEN', 'Reggie Voss');
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
  await expect(readiness).toContainText('Ready with warnings', {
    timeout: 20_000,
  });
  await expect(readiness).toContainText(
    'Team MIA has 9 standard contracts (min 14).'
  );
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
  const persistedIncompleteRosterCharges = {
    MIA: assertPersistedIncompleteRosterBooks(miaAfterApply, {
      teamCode: 'MIA',
      count: 10,
      missingSlots: 2,
    }),
    DEN: assertPersistedIncompleteRosterBooks(denAfterApply, {
      teamCode: 'DEN',
      count: 11,
      missingSlots: 1,
    }),
  };
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
  await openDashboardTab(page, 'Cap Sheet');
  const incompleteRosterRow = page.getByTestId(
    'incomplete-roster-charge-row'
  );
  await expect(incompleteRosterRow).toContainText('Incomplete Roster Charge');
  await expect(incompleteRosterRow).toContainText('$2,715,526');
  await expect(incompleteRosterRow).toContainText('2 open slots');
  const incompleteRosterScreenshotPath = path.join(
    ARTIFACT_DIR,
    'incomplete-roster-charge-reload-1280x720.png'
  );
  await incompleteRosterRow.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: incompleteRosterScreenshotPath,
    fullPage: false,
  });
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
      tradeBonusAuthorityBoundary: {
        retainedTradeKickerPercent: 0.15,
        verdict: 'Needs input',
        applyBlocked: true,
        savedWorldTeamChanges: 0,
        savedWorldEventChanges: 0,
      },
      draftAuthorityBoundary: {
        firstRoundEntitlementId: FIRST_ROUND_PROOF_ENTITLEMENT_ID,
        expectedAuthority: {
          authenticatedCanonLeaf: 'CBA2-A12.3',
          requiredCanonLeaves: [
            'CBA2-A12.3',
            'CBA2-L09.2',
            'CBA2-L09.3',
            'CBA2-L09.6',
            'CBA2-A12.4',
          ],
          governedHistory:
            'ownership/protection/conveyance/freeze/unfreeze/penalty',
        },
        verdict: 'Needs input',
        evaluated: false,
        applyBlocked: true,
        savedWorldTeamChanges: 0,
        savedWorldEventChanges: 0,
      },
      savedWorldApply: {
        readiness: 'Ready with warnings',
        warning:
          'Team MIA has a partial post-state receipt because teamSalary is not complete.',
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
      incompleteRosterCharges: {
        asOfDate: PROOF_AS_OF_DATE,
        activeWindow: '2026-07-01 through the day before opening day',
        threshold: 12,
        twoWayPlayersExcluded: {
          MIA: 'mia_tobias_lund',
          DEN: 'den_obi_nwachukwu',
        },
        persisted: persistedIncompleteRosterCharges,
        reloadCapSheetVisible: true,
        reloadHistoryVisible: true,
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
  await testInfo.attach('stepien-needs-input-1280x720', {
    path: stepienNeedsInputScreenshotPath,
    contentType: 'image/png',
  });
  await testInfo.attach('trade-bonus-needs-input-1280x720', {
    path: tradeBonusNeedsInputScreenshotPath,
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
  await testInfo.attach('incomplete-roster-charge-reload-1280x720', {
    path: incompleteRosterScreenshotPath,
    contentType: 'image/png',
  });
});
