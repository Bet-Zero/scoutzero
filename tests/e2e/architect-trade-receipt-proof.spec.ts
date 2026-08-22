import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { TWO_WAY_TRADE_MATCHING_EXPLANATION } from '@/features/architect/utils/tradeMachine/utils/twoWayTradeSalary';
import {
  getReviewAdminDb,
  readReviewUserId,
} from './helpers/architectReviewWorld';
import {
  makeResultingState,
  signingEvent,
} from '../architect/contractHistory/contractHistoryFixtures';

const CANDIDATE = process.env.SCOUTZERO_PROOF_CANDIDATE ?? '';
const ARTIFACT_DIR = process.env.SCOUTZERO_BROWSER_PROOF_DIR ?? '';
const MIA_URL = '/gm/MIA';
const PROOF_WORLD_ID = 'world_trade_receipt_proof';
const PROOF_AS_OF_DATE = '2027-04-12';
const EMPTY_RELEASE_DIGEST = `sha256:${'3'.repeat(64)}`;

const proofTpe = (teamCode: 'MIA' | 'DEN') => ({
  id: `proof-tpe-${teamCode}`,
  name: `${teamCode} governed proof TPE`,
  amount: 10_000_000,
  remainingAmount: 10_000_000,
  usedAmount: 0,
  isUsed: false,
  createdFrom: 'trade-receipt-proof',
  createdOn: '2026-07-01T12:00:00Z',
  expiresOn: '2027-07-01T12:00:00Z',
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
          index === 0
            ? '2027-04-11T00:00:00Z'
            : '2027-04-11T01:00:00Z'
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
          isReady:
            !stillLoading &&
            (hasDashboardHeading || hasNoTeamData),
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
        page
          .locator('[data-apron-team-salary]')
          .evaluateAll((elements) =>
            elements.some((element) =>
              Number.isFinite(Number(element.getAttribute('data-apron-team-salary')))
            )
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
  await expect(dialog.getByTestId('trade-salary-path-election')).toHaveCount(1, {
    timeout: 90_000,
  });
  return dialog;
};

const electAggregatedPath = async (card: Locator) => {
  const apronSalary = await card
    .locator('[data-apron-team-salary]')
    .getAttribute('data-apron-team-salary');
  expect(Number.isFinite(Number(apronSalary))).toBe(true);
  await card
    .getByLabel('Elected path')
    .selectOption('AGGREGATED_STANDARD_TPE');
  await card
    .getByLabel('Post-assignment Apron Team Salary')
    .fill(String(apronSalary));
};

const teamCard = (dialog: Locator, teamCode: string) =>
  dialog.getByTestId(`trade-team-card-${teamCode}`);

const assignHeldTpe = async (
  card: Locator,
  playerName: string,
  teamCode: 'MIA' | 'DEN'
): Promise<string> => {
  await card
    .getByLabel(`${playerName} absorption mode`)
    .selectOption('TPE');
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

test('exact-head Trade Machine produces a retained governed apron Trade Receipt', async ({
  page,
}, testInfo) => {
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
  await electAggregatedPath(miamiCard);
  await electAggregatedPath(denverCard);

  await routePlayer(
    dialog,
    page,
    'MIA',
    'Tobias Lund',
    'Denver Nuggets'
  );
  await routePlayer(
    dialog,
    page,
    'DEN',
    'Obi Nwachukwu',
    'Miami Heat'
  );
  await routePlayer(dialog, page, 'MIA', 'Owen Frost', 'Denver Nuggets');
  await routePlayer(dialog, page, 'MIA', 'Eli Navarro', 'Denver Nuggets');
  await routePlayer(dialog, page, 'DEN', 'Aaron Pike', 'Miami Heat');
  await routePlayer(dialog, page, 'DEN', 'Reggie Voss', 'Miami Heat');

  const heldTpeIds = {
    MIA: await assignHeldTpe(miamiCard, 'Aaron Pike', 'MIA'),
    DEN: await assignHeldTpe(denverCard, 'Owen Frost', 'DEN'),
  };
  await miamiCard
    .getByLabel('Reggie Voss absorption mode')
    .selectOption('TPE');
  await miamiCard
    .getByLabel('Reggie Voss held TPE')
    .selectOption(heldTpeIds.MIA);
  await denverCard
    .getByLabel('Eli Navarro absorption mode')
    .selectOption('TPE');
  await denverCard
    .getByLabel('Eli Navarro held TPE')
    .selectOption(heldTpeIds.DEN);

  await miamiCard
    .getByLabel('Tobias Lund exact pre-trade Salary')
    .fill('0');
  await miamiCard
    .getByLabel('Owen Frost exact pre-trade Salary')
    .fill('3200000');
  await miamiCard
    .getByLabel('Eli Navarro exact pre-trade Salary')
    .fill('2000000');
  await denverCard
    .getByLabel('Obi Nwachukwu exact pre-trade Salary')
    .fill('0');
  await denverCard
    .getByLabel('Aaron Pike exact pre-trade Salary')
    .fill('3200000');
  await denverCard
    .getByLabel('Reggie Voss exact pre-trade Salary')
    .fill('2000000');

  await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
  await expect(dialog.getByTestId('trade-readiness-summary')).toContainText(
    'Ready with warnings',
    { timeout: 20_000 }
  );
  await expect(dialog.getByTestId('trade-readiness-summary')).toContainText(
    'Team MIA has a partial post-state receipt because teamSalary is not complete.'
  );
  await expect(
    dialog.getByRole('button', { name: /^Apply Trade$/i })
  ).toBeEnabled();

  const developmentTools = dialog.getByRole('button', {
    name: /Development Tools/i,
  });
  await expect(developmentTools).toBeVisible();
  await developmentTools.click();

  const receipt = dialog.getByTestId('section-trade-receipt');
  await expect(receipt).toBeVisible();
  await expect(receipt).toContainText('Trade Receipt (Debug Mode)');
  await expect(receipt).toContainText('LEGAL');
  await receipt.getByRole('button', { name: 'Show Details' }).click();

  await expect(receipt.getByText('Tobias Lund').first()).toBeVisible();
  await expect(receipt.getByText('Obi Nwachukwu').first()).toBeVisible();
  // Two routed Two-Way players appear once as outgoing and once as incoming,
  // yielding four explanations and four `2W` markers in the detailed receipt.
  await expect(
    receipt.getByText(TWO_WAY_TRADE_MATCHING_EXPLANATION, { exact: true })
  ).toHaveCount(4);
  await expect(receipt.getByText('2W', { exact: true })).toHaveCount(4);
  for (const teamCode of ['heat', 'nuggets']) {
    const apronProof = receipt.getByTestId(
      `trade-apron-restriction-${teamCode}`
    );
    await expect(apronProof).toBeVisible();
    await expect(apronProof).toContainText('Row H');
    await expect(apronProof).toContainText('PASS');
    await expect(apronProof).toContainText('Second Apron ceiling');
    await expect(apronProof).toContainText('CBA2-A05.10');
  }
  expect(await worldCount()).toBe(1);
  await receipt
    .getByTestId('trade-apron-restriction-heat')
    .scrollIntoViewIfNeeded();
  const screenshotPath = path.join(ARTIFACT_DIR, 'trade-receipt-1280x720.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });

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
        MIA: ['Owen Frost', 'Eli Navarro'],
        DEN: ['Aaron Pike', 'Reggie Voss'],
        heldTpes: heldTpeIds,
      },
    },
    assertions: {
      readiness: 'Ready with warnings',
      postStateWarning:
        'Team MIA has a partial post-state receipt because teamSalary is not complete.',
      receiptVerdict: 'LEGAL',
      apronRestrictionRows: { MIA: 'H', DEN: 'H' },
      apronRestrictionStatuses: { MIA: 'PASS', DEN: 'PASS' },
      twoWayExplanationCount: 4,
      fixtureWorldCount: 1,
      durableWorldCountChangeAfterValidation: 0,
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
});
