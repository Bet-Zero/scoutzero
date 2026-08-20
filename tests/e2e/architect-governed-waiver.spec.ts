/** BZE-284 deterministic browser/emulator proof for an ordinary unclaimed waiver. */

import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';
import admin from 'firebase-admin';

import {
  buildContractBaselineTeamDocuments,
  contractBaselineMetadata,
} from '../../src/features/architect/utils/contractSource/contractSourceRelease';
import type { ContractSalaryTerm } from '../../src/schemas/governedContractState';
import type {
  ContractBaselineTeamDocument,
  ContractSourceRelease,
} from '../../src/schemas/contractSourceRelease';
import { RIGHTS_LEDGER_WORLD_VERSION } from '../../src/schemas/rightsEventLedger';
import { makeResultingState } from '../architect/contractHistory/contractHistoryFixtures';
import {
  activateSeededWorld,
  DEV_LOCAL_STORAGE_FLAGS,
  getReviewAdminDb,
  getWorldEventDocuments,
  getWorldTeamDocument,
  readActiveWorldId,
  readReviewUserId,
  waitForReviewDashboard,
} from './helpers/architectReviewWorld';

const TEAM_ID = 'MIA';
// This ID is part of the maintained review seed. The proof may overlay it in a
// saved world, but must never create or mutate the read-only base-player doc.
const PLAYER_ID = 'mia_silas_park';
const PLAYER_NAME = 'Silas Park';
const CONTRACT_ID = 'bze284_waiver_contract';
const DASHBOARD_URL = '/gm/MIA?season=2027';
const CURRENT_SEASON = '2026-27';
const WORLD_AS_OF_DATE = '2026-07-15';
const LEAGUE_RECEIPT_INPUT = '2026-07-15T12:00';
const LEAGUE_RECEIPT = '2026-07-15T12:00-04:00';
const WAIVER_EXPIRES = '2026-07-17T12:00:00-04:00';

const unknownInstant = () => ({
  precision: 'unknown' as const,
  value: null,
  rawValue: null,
});

const salaryRow = (season: string, salary: number): ContractSalaryTerm => ({
  season,
  salary,
  capHit: salary,
  guaranteed: true,
  guaranteedAmount: salary,
  option: null,
  optionHolder: null,
  optionUsed: null,
  optionDecisionDate: unknownInstant(),
  optionDecisionDeadline: unknownInstant(),
  optionDecisionTerms: null,
  tradeBonus: null,
  incentives: { likely: 0, unlikely: 0, criteriaEvidence: 'known' },
  guaranteeSchedule: [],
  voidedByExtension: false,
  voidedOn: unknownInstant(),
});

const buildWaiverFixture = () => {
  const releaseId = 'bze-284-browser-waiver';
  const releaseDigest = `sha256:${'7'.repeat(64)}`;
  const sourceArtifactSha256 = `sha256:${'8'.repeat(64)}`;
  const sourceObservationId = 'bze-284-waiver-observation';
  const sourceProvider = 'BZE-284 Playwright fixture';
  const salaries = [
    salaryRow('2026-27', 10_000_000),
    salaryRow('2027-28', 12_000_000),
    salaryRow('2028-29', 14_000_000),
  ];
  const totalValue = salaries.reduce(
    (sum, salary) => sum + (salary.salary ?? 0),
    0
  );
  const state = makeResultingState({
    contractId: CONTRACT_ID,
    contractVersion: 1,
    playerId: PLAYER_ID,
    teamId: TEAM_ID,
    establishmentKind: 'source-establishment',
    source: {
      releaseId,
      releaseVersion: 1,
      releaseDigest,
      sourceProvider,
      sourceRecordVersion: '1',
      sourceObservationId,
      sourceArtifactSha256,
      sourceContractPath: 'contract',
    },
    terms: {
      ...makeResultingState().terms,
      contractType: 'VETERAN CONTRACT',
      signingTeam: TEAM_ID,
      startSeason: '2026-27',
      endSeason: '2028-29',
      contractLength: salaries.length,
      totalValue,
      averageAnnualValue: totalValue / salaries.length,
      guaranteedValue: totalValue,
      guaranteedYears: salaries.length,
      salaries,
      birdRights: {
        status: 'Full Bird',
        yearsOfService: 8,
        yearsWithTeam: 4,
        eligibleFor: ['Bird Exception'],
      },
      freeAgency: {
        type: 'UFA',
        year: 2029,
        capHold: null,
        qualifyingOffer: null,
        earlyTerminationOption: null,
        hasOption: false,
        optionYear: null,
        optionType: null,
      },
      sourceLimitations: [],
    },
  });
  const contract = {
    contractType: 'VETERAN CONTRACT',
    signingTeam: TEAM_ID,
    startSeason: '2026-27',
    endSeason: '2028-29',
    contractLength: salaries.length,
    years: salaries.length,
    yearsRemaining: salaries.length,
    totalValue,
    averageAnnualValue: totalValue / salaries.length,
    guaranteedValue: totalValue,
    guaranteedYears: salaries.length,
    salariesByYear: salaries.map((salary) => ({
      season: salary.season,
      salary: salary.salary,
      capHit: salary.capHit,
      guaranteed: salary.guaranteed,
      guaranteedAmount: salary.guaranteedAmount,
      option: salary.option,
      optionUsed: salary.optionUsed,
    })),
    birdRights: state.terms.birdRights,
    freeAgency: state.terms.freeAgency,
  };
  const player = {
    id: PLAYER_ID,
    playerId: PLAYER_ID,
    player_id: PLAYER_ID,
    name: PLAYER_NAME,
    displayName: PLAYER_NAME,
    teamCode: TEAM_ID,
    teamId: TEAM_ID,
    teamName: 'Miami Heat',
    position: 'F',
    age: 29,
    salary: 10_000_000,
    currentSalary: 10_000_000,
    contract,
    futureContract: null,
    bio: {
      playerId: PLAYER_ID,
      displayName: PLAYER_NAME,
      position: 'F',
      age: 29,
      experience: 8,
    },
    source: { provider: sourceProvider, type: 'waiver-fixture' },
  };
  const release: ContractSourceRelease = {
    schemaVersion: 1,
    releaseId,
    releaseVersion: 1,
    releaseDigest,
    supersedes: null,
    effectiveAt: '2026-07-01T00:00:00-04:00',
    salaryCapYear: 2027,
    source: {
      provider: sourceProvider,
      retainedCorpus: 'Inline deterministic browser fixture.',
      selectionPolicy: 'Only the bounded BZE-284 waiver record.',
      transformationId: 'bze-284-browser-waiver-v1',
      limitations: [
        'Synthetic browser proof; not production source authority.',
      ],
      evidenceCatalog: {
        transformations: [
          {
            id: 'bze-284-browser-waiver-v1',
            description: 'Explicit complete ordinary-waiver fixture.',
          },
        ],
        limitations: [],
      },
    },
    observations: [],
    records: [
      {
        contractId: CONTRACT_ID,
        contractVersion: 1,
        playerId: PLAYER_ID,
        teamId: TEAM_ID,
        sourceObservationId,
        sourceContractPath: 'contract',
        resultingState: state,
      },
    ],
    coverage: {
      sourceObservationCount: 1,
      uniquePlayerCount: 1,
      totalSourceContracts: 1,
      completeRecordIds: [CONTRACT_ID],
      needsInputRecordIds: [],
      excludedCorruptRecordIds: [],
      missingByCategory: [],
      laterRouteReadiness: {
        option: {
          readyRecordIds: [],
          blockedRecordIds: [CONTRACT_ID],
          missingByCategory: [],
        },
        extension: {
          readyRecordIds: [],
          blockedRecordIds: [CONTRACT_ID],
          missingByCategory: [],
        },
      },
    },
  };
  return { player, release };
};

const writeBaselineDocuments = async (
  worldId: string,
  documents: readonly ContractBaselineTeamDocument[]
) => {
  const db = getReviewAdminDb();
  const batch = db.batch();
  documents.forEach((document) => {
    batch.set(
      db.doc(
        `architect_worlds/${worldId}/contractBaselines/${document.shardId}`
      ),
      document
    );
  });
  await batch.commit();
};

const seedWaiverWorld = async (userId: string) => {
  const db = getReviewAdminDb();
  const worldId = `world_bze284_waiver_${Date.now()}`;
  const now = admin.firestore.Timestamp.now();
  const { player, release } = buildWaiverFixture();
  const team = {
    id: TEAM_ID,
    teamCode: TEAM_ID,
    teamName: 'Miami Heat',
    abbreviation: TEAM_ID,
    season: CURRENT_SEASON,
    players: [player],
    roster: [PLAYER_ID],
    activeContracts: [
      {
        name: PLAYER_NAME,
        player_id: PLAYER_ID,
        contract: player.contract,
        years: 3,
        type: 'VETERAN CONTRACT',
        signAndTrade: false,
        guaranteed: true,
      },
    ],
    capHolds: [],
    deadCap: [],
    exceptions: {},
    draftPicks: [],
    entitlementIds: [],
    offerSheets: [],
    incomingOfferSheets: [],
    contractEventLedgers: [],
    totals: { totalSalary: 10_000_000, rosterCount: 1, isHardCapped: false },
    source: {
      type: 'review-world-bze-284-fixture',
      provider: 'playwright',
      worldId,
    },
  };
  await Promise.all([
    db.doc(`architect_worlds/${worldId}`).set({
      worldId,
      worldName: `BZE-284 Waiver Proof ${Date.now()}`,
      description: 'Deterministic ordinary unclaimed waiver proof.',
      createdBy: userId,
      createdAt: now,
      lastModifiedAt: now,
      currentSeason: CURRENT_SEASON,
      baselineSeason: CURRENT_SEASON,
      asOfDate: WORLD_AS_OF_DATE,
      parentWorldId: null,
      branchedFrom: null,
      childWorlds: [],
      modifiedTeams: [TEAM_ID],
      lastModifiedTeams: [TEAM_ID],
      actionCount: 0,
      tags: ['review', 'bze-284', 'ordinary-waiver'],
      isArchived: false,
      isFavorite: false,
      ...contractBaselineMetadata(release),
      rightsLedgerVersion: RIGHTS_LEDGER_WORLD_VERSION,
      stats: {
        totalTrades: 0,
        totalSignings: 0,
        totalWaives: 0,
        totalRenounces: 0,
        teamsInvolved: 1,
      },
    }),
    db.doc(`architect_worlds/${worldId}/teams/${TEAM_ID}`).set(team),
    db
      .doc(`architect_worlds/${worldId}/teams/${TEAM_ID}/players/${PLAYER_ID}`)
      .set(player),
    writeBaselineDocuments(
      worldId,
      buildContractBaselineTeamDocuments(release, worldId)
    ),
  ]);
  return worldId;
};

const enableReviewFlags = async (page: Page) => {
  await page.addInitScript((flags) => {
    Object.entries(flags).forEach(([key, value]) => {
      window.localStorage.setItem(key, value);
    });
  }, DEV_LOCAL_STORAGE_FLAGS);
};

const openFullCapTable = async (page: Page) => {
  const tab = page.getByRole('tab', { name: /^Full Cap Table$/i });
  await expect(tab).toBeVisible();
  await tab.click();
};

const playerRow = (page: Page): Locator =>
  page.locator('[data-cap-fit-row]').filter({ hasText: PLAYER_NAME }).first();

const openWaiverModal = async (page: Page) => {
  await openFullCapTable(page);
  const row = playerRow(page);
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.getByTestId('cap-sheet-full-player-row-button').hover();
  await page
    .getByRole('button', { name: `More actions for ${PLAYER_NAME}` })
    .click();
  const menu = page.getByTestId('cap-sheet-full-player-row-overflow-menu');
  const action = menu.getByTestId('cap-sheet-full-player-row-action-waive');
  await expect(action).toHaveText(/^Waive$/i);
  await expect(action).toHaveAttribute(
    'data-action-exposure-classification',
    'V1 supported'
  );
  await action.click();
  const modal = page.getByTestId('edit-contract-modal');
  await expect(modal).toBeVisible({ timeout: 20_000 });
  await expect(modal.getByTestId('governed-waiver-availability')).toContainText(
    /Contract information ready/i
  );
  return modal;
};

const ensureActiveWorld = async (page: Page, worldId: string) => {
  await expect
    .poll(() => readActiveWorldId(page), { timeout: 10_000 })
    .toBe(worldId);
};

test.describe('ARCH-GOVERNED-WAIVER: Full Cap saved-world proof', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });
  test.use({ viewport: { width: 1280, height: 720 } });

  let worldId = '';

  test.beforeEach(async ({ page }) => {
    await enableReviewFlags(page);
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);
    await expect
      .poll(() => readReviewUserId(page), { timeout: 25_000 })
      .not.toBe('');
    worldId = await seedWaiverWorld(await readReviewUserId(page));
    await activateSeededWorld(page, await readReviewUserId(page), worldId);
  });

  test.afterEach(async () => {
    const db = getReviewAdminDb();
    if (worldId)
      await db.recursiveDelete(db.doc(`architect_worlds/${worldId}`));
    worldId = '';
  });

  test('records, reloads, and temporally resolves the ordinary unclaimed waiver', async ({
    page,
  }, testInfo: TestInfo) => {
    const modal = await openWaiverModal(page);
    await modal
      .getByTestId('governed-waiver-league-receipt')
      .fill(LEAGUE_RECEIPT_INPUT);
    await expect(modal).toContainText(`Recorded as ${LEAGUE_RECEIPT}`);
    const confirm = modal.getByTestId('edit-contract-confirm-action-button');
    await expect(confirm).toBeEnabled();
    await expect(confirm).toHaveAttribute('aria-disabled', 'false');
    await expect(confirm).toHaveClass(/bg-orange-600/);
    await page.screenshot({
      path: testInfo.outputPath('01-waiver-ready.png'),
      fullPage: false,
    });

    page.once('dialog', (dialog) => dialog.accept());
    await confirm.click();
    await expect(modal).toHaveCount(0, { timeout: 25_000 });
    await expect(page.getByTestId('cockpit-last-receipt')).toContainText(
      /Waiver request recorded/i,
      { timeout: 20_000 }
    );

    const db = getReviewAdminDb();
    const team = await getWorldTeamDocument(worldId, TEAM_ID);
    expect(team?.roster).toEqual([]);
    expect(team?.players).toEqual([]);
    const deadCap = Array.isArray(team?.deadCap) ? team.deadCap : [];
    expect(deadCap).toHaveLength(1);
    expect(deadCap[0]).toMatchObject({
      playerId: PLAYER_ID,
      governedLifecycle: {
        contractId: CONTRACT_ID,
        leagueReceivedAt: LEAGUE_RECEIPT,
        expiresAt: WAIVER_EXPIRES,
        outcome: 'ordinary-unclaimed',
      },
    });
    expect(
      (
        await db
          .doc(
            `architect_worlds/${worldId}/teams/${TEAM_ID}/players/${PLAYER_ID}`
          )
          .get()
      ).exists
    ).toBe(false);
    expect(
      (await getWorldEventDocuments(worldId)).some(
        (event) => event.mutationType === 'waivePlayer'
      )
    ).toBe(true);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);
    await ensureActiveWorld(page, worldId);
    await openFullCapTable(page);
    await expect(playerRow(page)).toHaveCount(0);
    await page.getByTestId('cap-sheet-full-dead-money-toggle').click();
    const pending = page.getByTestId('cap-sheet-full-governed-waiver-status');
    await expect(pending).toHaveAttribute('data-waiver-status', 'pending');
    await expect(pending).toContainText(/Waiver pending/i);
    await expect(pending).toContainText(/Jul 17, 2026, 12:00 PM ET/i);
    await page.screenshot({
      path: testInfo.outputPath('02-waiver-pending.png'),
      fullPage: false,
    });

    await db.doc(`architect_worlds/${worldId}`).update({
      asOfDate: '2026-07-18',
      lastModifiedAt: admin.firestore.Timestamp.now(),
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);
    await ensureActiveWorld(page, worldId);
    await openFullCapTable(page);
    await page.getByTestId('cap-sheet-full-dead-money-toggle').click();
    const terminated = page.getByTestId(
      'cap-sheet-full-governed-waiver-status'
    );
    await expect(terminated).toHaveAttribute(
      'data-waiver-status',
      'terminated'
    );
    await expect(terminated).toContainText(/Contract terminated/i);
    await page.screenshot({
      path: testInfo.outputPath('03-contract-terminated.png'),
      fullPage: false,
    });

    testInfo.annotations.push({
      type: 'audit-note',
      description:
        'BZE-284 proof: exact governed receipt, immediate Player List removal, atomic saved-world lifecycle and player deletion, pending expiry truth after reload, then date-driven contract termination truth.',
    });
  });
});
