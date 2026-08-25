/**
 * BZE-290 browser/emulator proof for the governed saved-world sign-and-trade.
 *
 * Run:
 *   PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true npx playwright test tests/e2e/architect-governed-sign-and-trade.spec.ts --workers=1 --reporter=line
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  buildContractBaselineTeamDocuments,
  contractBaselineMetadata,
} from '@/features/architect/utils/contractSource/contractSourceRelease';
import { ContractSourceReleaseZ } from '@/schemas/contractSourceRelease';
import { withGovernedSalaryBooks } from '@/tests/fixtures/governedSalaryBookInputs';
import { makeRightsLedgerForIdentity } from '../fixtures/architect/rightsHistory';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals';
import { deterministicStateDigest as mutationSnapshotDigest } from '@/features/architect/utils/contractSource/deterministicDigest';
import {
  SeasonHistoryRecordZ,
  SeasonTransitionManifestZ,
} from '@/schemas/seasonTransition';
import {
  ALL_TEAM_CODES,
  ANDRE_COLE_PLAYER_ID,
  ANDRE_COLE_PLAYER_NAME,
  MIA_SEASON_ADVANCE_URL,
  enableArchitectReviewFlags,
  getReviewAdminDb,
  getTeamPlayerIds,
  getWorldEventDocuments,
  getWorldMetadataDocument,
  getWorldTeamDocument,
  openDashboardTab,
  prepareSeasonAdvanceReviewWorld,
  readActiveWorldId,
  waitForReviewDashboard,
} from './helpers/architectReviewWorld';

type RecordLike = Record<string, unknown>;

const CURRENT_SEASON = '2026-27';
const CURRENT_YEAR = 2027;
const PRIOR_SEASON = '2025-26';
const SEASON_TRANSITION_ID = 'seasonAdvance__2025-26__2026-27';
const SEASON_TRANSITION_AT = '2026-07-01T00:00:00-04:00';
const SEASON_TRANSITION_COMMITTED_AT = '2026-07-01T00:00:01-04:00';
const RETAINED_CONTRACT_RELEASE_PATH = path.resolve(
  process.cwd(),
  'public/architect/contract-source-releases/salaryswish-retained-2026-06-05-v1.json'
);

const isRecord = (value: unknown): value is RecordLike =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const playerId = (value: unknown) => {
  if (!isRecord(value)) return '';
  return String(value.player_id || value.playerId || value.id || '');
};

const buildActiveContracts = (players: RecordLike[]) =>
  players
    .filter((player) => isRecord(player.contract))
    .map((player) => ({
      name: player.name || player.displayName,
      player_id: player.player_id || player.playerId || player.id,
      contract: player.contract,
      years: Number((player.contract as RecordLike).yearsRemaining || 0),
      type: (player.contract as RecordLike).contractType || 'Standard Contract',
      signAndTrade: false,
      guaranteed: true,
    }));

const withDistributedCurrentSalary = (players: RecordLike[], total: number) => {
  const activeIndexes = players.flatMap((player, index) => {
    const contract = isRecord(player.contract) ? player.contract : null;
    const rows = Array.isArray(contract?.salariesByYear)
      ? contract.salariesByYear
      : [];
    return rows.some((row) => isRecord(row) && row.season === CURRENT_SEASON)
      ? [index]
      : [];
  });
  if (activeIndexes.length === 0) {
    throw new Error('Review salary allocation found no current Contracts.');
  }
  const ordinarySalary = Math.floor(total / activeIndexes.length);
  const lastSalary = total - ordinarySalary * (activeIndexes.length - 1);
  const salaryByIndex = new Map(
    activeIndexes.map((index, allocationIndex) => [
      index,
      allocationIndex === activeIndexes.length - 1
        ? lastSalary
        : ordinarySalary,
    ])
  );

  return players.map((player, index) => {
    const salary = salaryByIndex.get(index);
    if (salary === undefined || !isRecord(player.contract)) return player;
    const rows = Array.isArray(player.contract.salariesByYear)
      ? player.contract.salariesByYear.map((row) =>
          isRecord(row) && row.season === CURRENT_SEASON
            ? {
                ...row,
                salary,
                capHit: salary,
                guaranteed: true,
                guaranteedAmount: salary,
              }
            : row
        )
      : [];
    const totalValue = rows.reduce(
      (sum, row) =>
        sum +
        (isRecord(row) && Number.isFinite(row.salary) ? Number(row.salary) : 0),
      0
    );
    return {
      ...player,
      salary,
      currentSalary: salary,
      contract: {
        ...player.contract,
        salariesByYear: rows,
        totalValue,
        averageAnnualValue: rows.length > 0 ? totalValue / rows.length : 0,
      },
    };
  });
};

const seedRetainedContractBaseline = async (worldId: string) => {
  const release = ContractSourceReleaseZ.parse(
    JSON.parse(await readFile(RETAINED_CONTRACT_RELEASE_PATH, 'utf8'))
  );
  const documents = buildContractBaselineTeamDocuments(release, worldId);
  const db = getReviewAdminDb();
  await Promise.all(
    documents.map((document) =>
      db
        .doc(
          `architect_worlds/${worldId}/contractBaselines/${document.shardId}`
        )
        .set(document)
    )
  );
  return contractBaselineMetadata(release);
};

/**
 * Seed the exact immutable output contract already proved by BZE-289's own
 * 30-team browser workflow. The S&T proof consumes that authority; rerunning
 * the entire Season Advance UI here would duplicate BZE-289 and exceed the
 * repository's four-minute focused-test budget.
 */
const seedAuthenticatedSeasonCloseEvidence = async (worldId: string) => {
  const teams = await Promise.all(
    ALL_TEAM_CODES.map(async (teamCode) => {
      const team = await getWorldTeamDocument(worldId, teamCode);
      if (!team) {
        throw new Error(`BZE-289 review Team ${teamCode} is missing.`);
      }
      return { teamCode, team };
    })
  );
  const authorityDigest = mutationSnapshotDigest({
    worldId,
    transitionId: SEASON_TRANSITION_ID,
    status: 'complete',
  });
  const histories = teams.map(({ teamCode, team }) => {
    const salaryBookInputs = isRecord(team.salaryBookInputs)
      ? team.salaryBookInputs
      : null;
    const seasonCloseApronMeasurement =
      salaryBookInputs?.seasonCloseApronMeasurement;
    if (!seasonCloseApronMeasurement) {
      throw new Error(
        `BZE-289 review Team ${teamCode} lacks its authenticated Apron close measurement.`
      );
    }
    const finalRoster = Array.isArray(team.players) ? team.players : [];
    return SeasonHistoryRecordZ.parse({
      schemaVersion: 'season-history-v1',
      historyId: `${PRIOR_SEASON}__${teamCode}`,
      transitionId: SEASON_TRANSITION_ID,
      worldId,
      teamCode,
      fromSeason: PRIOR_SEASON,
      toSeason: CURRENT_SEASON,
      seasonCloseDate: '2026-04-12',
      transitionEffectiveAt: SEASON_TRANSITION_AT,
      preAdvanceState: team,
      preAdvanceStateDigest: mutationSnapshotDigest(team),
      finalRoster,
      finalRosterDigest: mutationSnapshotDigest(finalRoster),
      seasonCloseApronMeasurement,
      beforeTotals: isRecord(team.totals) ? team.totals : {},
      afterTotals: isRecord(team.totals) ? team.totals : {},
      contractEvents: [],
      entitlementStateDigest: mutationSnapshotDigest({
        entitlementIds: team.entitlementIds || [],
        draftPicks: team.draftPicks || [],
        draftPicksInventory: team.draftPicksInventory || [],
        draftPicksObligations: team.draftPicksObligations || [],
        draftPicksContested: team.draftPicksContested || [],
      }),
      authorityDigest,
    });
  });
  const manifest = SeasonTransitionManifestZ.parse({
    schemaVersion: 'season-transition-manifest-v1',
    transitionId: SEASON_TRANSITION_ID,
    operationId: 'bze-289-review-season-advance',
    eventId: SEASON_TRANSITION_ID,
    worldId,
    fromSeason: PRIOR_SEASON,
    toSeason: CURRENT_SEASON,
    fromSalaryCapYear: 2026,
    toSalaryCapYear: CURRENT_YEAR,
    seasonCloseDate: '2026-04-12',
    transitionEffectiveAt: SEASON_TRANSITION_AT,
    committedAt: SEASON_TRANSITION_COMMITTED_AT,
    authority: { status: 'complete', source: 'BZE-289' },
    authorityDigest,
    entitlementBoundary: { mode: 'preserve-or-fail-closed' },
    preAdvanceMetadataDigest: mutationSnapshotDigest({
      worldId,
      currentSeason: PRIOR_SEASON,
    }),
    teamRecords: histories.map((history) => ({
      teamCode: history.teamCode,
      historyId: history.historyId,
      preAdvanceStateDigest: history.preAdvanceStateDigest,
      committedStateDigest: mutationSnapshotDigest(
        teams.find(({ teamCode }) => teamCode === history.teamCode)?.team || {}
      ),
      finalRosterDigest: history.finalRosterDigest,
      seasonCloseApronMeasurementDigest: mutationSnapshotDigest(
        history.seasonCloseApronMeasurement
      ),
      entitlementStateDigest: history.entitlementStateDigest,
      contractEventIds: [],
      booksStatus: 'complete',
    })),
    reconciliation: {
      expectedTeamCount: 30,
      preparedTeamCount: 30,
      completeBookCount: 30,
      historyRecordCount: 30,
      entitlementPreservationCount: 30,
    },
    canonLeafIds: ['CBA2-L02.1', 'CBA2-L08.1', 'CBA2-L09.2'],
  });

  const db = getReviewAdminDb();
  const batch = db.batch();
  histories.forEach((history) => {
    batch.set(
      db.doc(`architect_worlds/${worldId}/seasonHistory/${history.historyId}`),
      history
    );
  });
  batch.set(
    db.doc(
      `architect_worlds/${worldId}/seasonTransitions/${SEASON_TRANSITION_ID}`
    ),
    manifest
  );
  batch.set(
    db.doc(`architect_worlds/${worldId}/events/${SEASON_TRANSITION_ID}`),
    {
      eventId: SEASON_TRANSITION_ID,
      worldId,
      mutationType: 'seasonAdvance',
      category: 'offseason',
      timestamp: SEASON_TRANSITION_COMMITTED_AT,
      occurredAt: SEASON_TRANSITION_COMMITTED_AT,
      teamCodes: [...ALL_TEAM_CODES],
      teamsAffected: [...ALL_TEAM_CODES],
      teamsInvolved: [...ALL_TEAM_CODES],
      playerIds: [],
      summary: `Season Advance: ${ALL_TEAM_CODES.join(' ↔ ')}`,
      metadata: {
        fromSeason: PRIOR_SEASON,
        toSeason: CURRENT_SEASON,
        seasonTransitionId: SEASON_TRANSITION_ID,
        seasonHistoryIds: histories.map((history) => history.historyId),
      },
      mutationMetadata: {
        mutationType: 'seasonAdvance',
        category: 'offseason',
        worldId,
        teams: [...ALL_TEAM_CODES],
        players: [],
      },
      diffSummary: { teamsChanged: [...ALL_TEAM_CODES] },
    }
  );
  await batch.commit();
};

const buildSignAndTradeRightsLedger = (worldId: string) => {
  const ledger = makeRightsLedgerForIdentity({
    worldId,
    teamId: 'MIA',
    playerId: ANDRE_COLE_PLAYER_ID,
    salaryCapYear: CURRENT_YEAR,
  });
  return {
    ...ledger,
    events: ledger.events.map((event) =>
      event.eventKind === 'rights-established'
        ? {
            ...event,
            priorContract: {
              ...event.priorContract,
              contractId: `review-contract:${ANDRE_COLE_PLAYER_ID}:2025-26`,
            },
            amountRecords: event.amountRecords.map((row) =>
              row.kind === 'prior-regular-salary'
                ? { ...row, amount: 2_000_000 }
                : row.kind === 'prior-signing-bonus-allocation' ||
                    row.kind === 'earned-performance-bonuses'
                  ? { ...row, amount: 0 }
                  : row
            ),
          }
        : event
    ),
  };
};

const withReviewTotals = (
  team: RecordLike,
  players: RecordLike[],
  total: number,
  transactionAt: string
) => {
  const asOfDate = `${transactionAt.slice(0, 10)}T00:00:00Z`;
  const governedTeam = withGovernedSalaryBooks(
    {
      ...team,
      season: CURRENT_SEASON,
      players,
      roster: players.map(playerId),
      activeContracts: buildActiveContracts(players),
      teamTotalSalary: total,
      teamSalary: total,
      apronTeamSalary: total,
      taxSalary: total,
    },
    {
      salaryCapYear: CURRENT_YEAR,
      asOfDate,
      teamSalary: total,
      apronTeamSalary: total,
      taxSalary: total,
    }
  );
  const totals = createCanonicalTeamTotalsSnapshot(governedTeam, CURRENT_YEAR, {
    asOfDate,
  });
  return {
    ...governedTeam,
    teamTotalSalary: totals.apronTeamSalary,
    teamSalary: totals.teamSalary,
    apronTeamSalary: totals.apronTeamSalary,
    taxSalary: totals.taxSalary,
    totals,
  };
};

const configureSignAndTradeWorld = async (
  worldId: string,
  transactionAt: string
) => {
  const [mia, bos] = await Promise.all([
    getWorldTeamDocument(worldId, 'MIA'),
    getWorldTeamDocument(worldId, 'BOS'),
  ]);
  if (!mia || !bos) throw new Error('Advanced MIA/BOS snapshots are missing.');

  const miaPlayers = (Array.isArray(mia.players) ? mia.players : []).map(
    (candidate) => {
      if (
        !isRecord(candidate) ||
        playerId(candidate) !== ANDRE_COLE_PLAYER_ID
      ) {
        return candidate as RecordLike;
      }
      return {
        ...candidate,
        teamCode: 'MIA',
        teamId: 'MIA',
        salary: 0,
        currentSalary: 0,
        contract: {
          contractId: `review-contract:${ANDRE_COLE_PLAYER_ID}:2025-26`,
          contractType: 'Standard Contract',
          isExtension: false,
          signingTeam: 'MIA',
          salariesByYear: [
            {
              season: '2025-26',
              salary: 2_000_000,
              capHit: 2_000_000,
              guaranteed: true,
              guaranteedAmount: 2_000_000,
              option: null,
              incentives: { likely: 0, unlikely: 0 },
            },
          ],
          birdRights: { status: 'Full Bird' },
          freeAgency: {
            type: 'UFA',
            year: 2026,
            capHold: 3_800_000,
          },
        },
        futureContract: null,
      };
    }
  );
  const bosPlayers = (Array.isArray(bos.players) ? bos.players : [])
    .filter(isRecord)
    .slice(0, 14);
  const governedMiaPlayers = withDistributedCurrentSalary(
    miaPlayers,
    168_000_000
  );
  const governedBosPlayers = withDistributedCurrentSalary(
    bosPlayers,
    80_000_000
  );
  const capHolds = [
    {
      playerId: ANDRE_COLE_PLAYER_ID,
      playerName: ANDRE_COLE_PLAYER_NAME,
      amount: 2_000_000,
      season: CURRENT_SEASON,
      type: 'UFA',
      active: true,
      isSigned: false,
      reason: 'Governed BZE-290 sign-and-trade review fixture',
    },
  ];
  const governedMia = withReviewTotals(
    {
      ...mia,
      capHolds,
      deadCap: [],
      waivedContracts: [],
      stretchHistory: [],
      deadMoney: {},
      offerSheets: [],
      incomingOfferSheets: [],
      rightsLedger: buildSignAndTradeRightsLedger(worldId),
    },
    governedMiaPlayers,
    170_000_000,
    transactionAt
  );
  const governedBos = withReviewTotals(
    {
      ...bos,
      capHolds: [],
      deadCap: [],
      waivedContracts: [],
      stretchHistory: [],
      deadMoney: {},
      offerSheets: [],
      incomingOfferSheets: [],
    },
    governedBosPlayers,
    80_000_000,
    transactionAt
  );

  const baselineMetadata = await seedRetainedContractBaseline(worldId);
  const db = getReviewAdminDb();
  const batch = db.batch();
  batch.update(db.doc(`architect_worlds/${worldId}`), {
    currentSeason: CURRENT_SEASON,
    currentYear: CURRENT_YEAR,
    asOfDate: transactionAt.slice(0, 10),
    rightsLedgerVersion: 1,
    ...baselineMetadata,
  });
  batch.set(db.doc(`architect_worlds/${worldId}/teams/MIA`), governedMia);
  batch.set(db.doc(`architect_worlds/${worldId}/teams/BOS`), governedBos);
  batch.delete(
    db.doc(
      `architect_worlds/${worldId}/teams/MIA/players/${ANDRE_COLE_PLAYER_ID}`
    )
  );
  batch.delete(
    db.doc(
      `architect_worlds/${worldId}/teams/BOS/players/${ANDRE_COLE_PLAYER_ID}`
    )
  );
  await batch.commit();
};

const teamCard = (dialog: Locator, teamCode: string) =>
  dialog.getByTestId(`trade-team-card-${teamCode}`);

const fillPostAssignmentApronSalary = async (
  card: Locator,
  adjustment: number
) => {
  const raw = await card
    .locator('[data-apron-team-salary]')
    .getAttribute('data-apron-team-salary');
  expect(raw).not.toBeNull();
  const value = Number(raw);
  expect(Number.isFinite(value)).toBe(true);
  await card
    .getByLabel(/^Post-assignment Apron Team Salary$/i)
    .fill(String(value + adjustment));
  return value + adjustment;
};

const currentRoomApronSalaries = async (page: Page) =>
  page
    .locator('[data-apron-team-salary]')
    .evaluateAll((elements) =>
      elements
        .map((element) =>
          Number(element.getAttribute('data-apron-team-salary'))
        )
        .filter(Number.isFinite)
    );

test.describe('BZE-290 governed saved-world sign-and-trade', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(240_000);
    await enableArchitectReviewFlags(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('hz.dev.tradeMachineDebug', 'true');
    });
    await page.goto(MIA_SEASON_ADVANCE_URL, {
      waitUntil: 'domcontentloaded',
    });
  });

  test('authenticates BZE-289 history, applies atomically, and reloads every consumer', async ({
    page,
  }, testInfo) => {
    page.on('console', async (message) => {
      const text = message.text();
      if (
        (message.type() === 'error' &&
          !text.startsWith('Failed to load resource')) ||
        text.includes('Governed sign-and-trade preview failed') ||
        text.includes('[validate -> teams payroll]') ||
        text.includes('[after validate]')
      ) {
        console.log(text);
        if (text.includes('Post-state cap validation failed')) {
          const values = await Promise.all(
            message.args().map(async (argument) => {
              try {
                return await argument.jsonValue();
              } catch {
                return '[unserializable]';
              }
            })
          );
          console.log(`[BZE-290 apply diagnostic] ${JSON.stringify(values)}`);
        }
      }
    });
    page.on('pageerror', (error) => console.log(error.message));
    const worldId = await prepareSeasonAdvanceReviewWorld(page);
    await seedAuthenticatedSeasonCloseEvidence(worldId);
    const transactionAt = '2026-07-10T12:00:00-04:00';
    await configureSignAndTradeWorld(worldId, transactionAt);
    await page.goto('/gm/MIA?season=2027', { waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);
    await expect
      .poll(() => currentRoomApronSalaries(page), { timeout: 60_000 })
      .toContain(170_000_000);
    await expect(
      page.locator('[data-tax-salary="170000000"]').first()
    ).toBeVisible({ timeout: 60_000 });

    await openDashboardTab(page, 'Free Agency');
    const ownFa = page
      .getByTestId('own-free-agent-row')
      .filter({ hasText: ANDRE_COLE_PLAYER_NAME });
    await expect(ownFa).toBeVisible({ timeout: 30_000 });
    await ownFa.getByTestId('own-free-agent-sign-and-trade-button').click();

    const dialog = page.getByRole('dialog', { name: /Trade Machine/i });
    await expect(dialog.getByTestId('pending-sign-and-trade')).toBeVisible();
    const miamiTeamCard = dialog.getByTestId('trade-team-card-MIA');
    await expect(miamiTeamCard).toBeVisible({ timeout: 60_000 });
    const emptyTeamPickers = () =>
      dialog
        .locator('label', { hasText: /^Select Team$/i })
        .locator('xpath=following-sibling::select[1]');
    await expect(emptyTeamPickers().first()).toBeVisible({ timeout: 60_000 });
    await emptyTeamPickers().first().selectOption('celtics');
    await expect(dialog.getByTestId('trade-team-card-BOS')).toBeVisible({
      timeout: 60_000,
    });

    await dialog
      .getByRole('button', { name: /Set contract & destination/i })
      .click();
    const modal = page.getByTestId('edit-contract-modal');
    await expect(modal).toBeVisible();
    await modal.locator('button[aria-haspopup="listbox"]').first().click();
    await page.getByRole('option', { name: /Boston Celtics/i }).click();
    await modal.getByTestId('contract-years').selectOption('3');
    const salaries = modal.locator('input[inputmode="decimal"]');
    await salaries.nth(0).fill('20000000');
    await salaries.nth(1).fill('21000000');
    await salaries.nth(2).fill('22000000');
    await expect(salaries.nth(0)).toHaveValue('$20,000,000');
    await expect(salaries.nth(1)).toHaveValue('$21,000,000');
    await expect(salaries.nth(2)).toHaveValue('$22,000,000');
    await modal.getByTestId('governed-sat-transaction-at').fill(transactionAt);
    await modal
      .getByTestId('governed-sat-higher-max')
      .selectOption('not-relied-upon');
    await modal.getByTestId('governed-sat-unlikely-bonuses').fill('0');
    await modal.getByTestId('governed-sat-consent').check();
    await modal.getByTestId('governed-sat-exhibit-6').check();
    await expect(
      modal.getByTestId('governed-sat-physical-status')
    ).toBeDisabled();
    const confirm = modal.getByTestId('edit-contract-confirm-action-button');
    await expect(confirm).toBeEnabled({ timeout: 30_000 });
    await confirm.click();
    await expect(modal).toHaveCount(0);

    const miaCard = teamCard(dialog, 'MIA');
    const bosCard = teamCard(dialog, 'BOS');
    await miaCard.getByLabel(/^Elected path$/i).selectOption('STANDARD_TPE');
    await bosCard.getByLabel(/^Elected path$/i).selectOption('ROOM');
    await miaCard
      .getByLabel(`${ANDRE_COLE_PLAYER_NAME} exact pre-trade Salary`)
      .fill('10000000');
    await fillPostAssignmentApronSalary(miaCard, -10_000_000);
    await fillPostAssignmentApronSalary(bosCard, 20_000_000);

    const validate = dialog.getByRole('button', { name: /^Validate Trade$/i });
    await validate.click();
    await expect(validate).toBeVisible({ timeout: 60_000 });
    await expect
      .poll(
        async () =>
          JSON.stringify({
            header:
              (await page
                .getByTestId('validation-state-header')
                .textContent()) || '',
            toasts: await page.locator('[role="status"]').allTextContents(),
          }),
        { timeout: 30_000 }
      )
      .toMatch(/"header":"[^"]*Last checked/i);
    const apply = dialog.getByRole('button', { name: /^Apply Trade$/i });
    await expect
      .poll(() => apply.isEnabled(), {
        timeout: 30_000,
        message: 'fresh live S&T authority should make the trade applyable',
      })
      .toBe(true);

    await apply.click();

    await expect
      .poll(
        async () => {
          const events = await getWorldEventDocuments(worldId);
          return events.filter((event) => event.mutationType === 'executeTrade')
            .length;
        },
        { timeout: 90_000 }
      )
      .toBe(1);

    const [miaAfter, bosAfter, events, destinationPlayer] = await Promise.all([
      getWorldTeamDocument(worldId, 'MIA'),
      getWorldTeamDocument(worldId, 'BOS'),
      getWorldEventDocuments(worldId),
      getReviewAdminDb()
        .doc(
          `architect_worlds/${worldId}/teams/BOS/players/${ANDRE_COLE_PLAYER_ID}`
        )
        .get()
        .then((snapshot) => snapshot.data() as RecordLike | undefined),
    ]);
    const tradeEvent = events.find(
      (event) => event.mutationType === 'executeTrade'
    );
    const metadata = isRecord(tradeEvent?.metadata) ? tradeEvent.metadata : {};
    const receipt = isRecord(metadata.governedSignAndTradeReceipt)
      ? metadata.governedSignAndTradeReceipt
      : null;
    expect(receipt?.verificationStatus).toBe('complete');
    expect(getTeamPlayerIds(miaAfter)).not.toContain(ANDRE_COLE_PLAYER_ID);
    expect(getTeamPlayerIds(bosAfter)).toContain(ANDRE_COLE_PLAYER_ID);
    expect(destinationPlayer?.contract).toMatchObject({
      contractType: 'Sign & Trade',
      signingTeam: 'MIA',
      signingDate: transactionAt,
    });
    const destinationRows = Array.isArray(
      (destinationPlayer?.contract as RecordLike | undefined)?.salariesByYear
    )
      ? ((destinationPlayer?.contract as RecordLike)
          .salariesByYear as RecordLike[])
      : [];
    expect(destinationRows).toHaveLength(3);
    expect(destinationRows[0]).toMatchObject({
      season: '2026-27',
      salary: 20_000_000,
      guaranteedAmount: 20_000_000,
    });
    const books = Array.isArray(receipt?.salaryBooks)
      ? (receipt.salaryBooks as RecordLike[])
      : [];
    expect(books).toHaveLength(2);
    for (const [teamCode, document] of [
      ['MIA', miaAfter],
      ['BOS', bosAfter],
    ] as const) {
      const book = books.find((entry) => entry.teamId === teamCode);
      expect(book).toBeDefined();
      expect((document?.totals as RecordLike)?.teamSalary).toBe(
        book?.teamSalary
      );
      expect((document?.totals as RecordLike)?.apronTeamSalary).toBe(
        book?.apronTeamSalary
      );
      expect((document?.totals as RecordLike)?.taxSalary).toBe(book?.taxSalary);
    }

    await expect(dialog).toHaveCount(0, { timeout: 30_000 });
    const miaBook = books.find((entry) => entry.teamId === 'MIA');
    await expect
      .poll(() => currentRoomApronSalaries(page), { timeout: 30_000 })
      .toContain(Number(miaBook?.apronTeamSalary));
    await openDashboardTab(page, 'Team History');
    await page
      .getByTestId('team-history-section-timeline')
      .getByRole('button', { name: /Trade Executed: MIA ↔ BOS/i })
      .click();
    const historyDetail = page.getByTestId('team-history-detail-modal');
    await expect(historyDetail.getByText(/Trade Receipt/i)).toBeVisible();
    await expect(
      historyDetail.getByText(String(receipt?.receiptId)).first()
    ).toBeVisible();
    await historyDetail.getByRole('button', { name: /close/i }).click();
    await openDashboardTab(page, 'Compare');
    await expect(page.getByTestId('comparison-event-count')).toContainText(
      /2\s+committed events/i
    );

    const bosBook = books.find((entry) => entry.teamId === 'BOS');
    await page.goto('/gm/BOS?season=2027', { waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);
    await openDashboardTab(page, 'Cap Sheet');
    await expect(page.getByTestId('tab-cap-sheet')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect
      .poll(() => currentRoomApronSalaries(page), { timeout: 30_000 })
      .toContain(Number(bosBook?.apronTeamSalary));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);
    await expect
      .poll(() => readActiveWorldId(page), { timeout: 20_000 })
      .toBe(worldId);
    const reloadedMetadata = await getWorldMetadataDocument(worldId);
    expect(reloadedMetadata?.currentSeason).toBe(CURRENT_SEASON);
    await openDashboardTab(page, 'Cap Sheet');
    await expect(page.getByTestId('tab-cap-sheet')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect
      .poll(() => currentRoomApronSalaries(page), { timeout: 30_000 })
      .toContain(Number(bosBook?.apronTeamSalary));

    testInfo.annotations.push({
      type: 'audit-note',
      description:
        'BZE-290 proof: the live saved world authenticated Andre Cole on MIA’s immutable BZE-289 final roster, loaded dated rights and exact 30-team history for preview, rebuilt authority at Apply, derived BYC and Row C, atomically moved the player and new protected Contract to BOS, persisted independent Team/Apron/Tax books plus receipt/history, and reloaded with History, Compare, Cap Sheet, and cross-room Apron parity.',
    });
  });
});
