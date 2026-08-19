/** BZE-283 exact-head browser and persistence proof for governed RFA Offer Sheets. */

import { expect, test, type Page, type TestInfo } from '@playwright/test';
import admin from 'firebase-admin';

import {
  makeGovernedOfferSheetFixture,
  makeGovernedOfferSheetProposal,
} from '../fixtures/architect/governedOfferSheet';
import {
  activateSeededWorld,
  enableArchitectReviewFlags,
  getReviewAdminDb,
  getWorldEventDocuments,
  getWorldTeamDocument,
  openDashboardTab,
  readReviewUserId,
  seedSeasonAdvanceReviewWorld,
  waitForReviewDashboard,
  type RecordLike,
} from './helpers/architectReviewWorld';

const HOME_TEAM = 'BOS';
const OFFERING_TEAM = 'LAL';
const PLAYER_ID = 'review_offer_sheet_guard';
const PLAYER_NAME = 'Review Offer Sheet Guard';
const AUTHOR_PLAYER_ID = 'bze283_offer_sheet_author';
const AUTHOR_PLAYER_NAME = 'BZE 283 Offer Sheet Author';
const LEGACY_PLAYER_NAME = 'Unreadable Legacy Offer';
const WORLD_SEASON = '2025-26';
const WORLD_AS_OF_DATE = '2025-07-10';
const HOME_URL = '/gm/BOS?season=2026';
const OFFERING_URL = '/gm/LAL?season=2026';
const RESOLUTION_AT = '2025-07-09T23:59:59-04:00';

const seededWorldIds = new Set<string>();
let basePlayerBefore: RecordLike | undefined;

const teamPlayers = (team: RecordLike | undefined): RecordLike[] =>
  Array.isArray(team?.players)
    ? team.players.filter(
        (player): player is RecordLike =>
          Boolean(player) &&
          typeof player === 'object' &&
          !Array.isArray(player)
      )
    : [];

const teamPlayer = (team: RecordLike | undefined, playerId: string) =>
  teamPlayers(team).find((player) =>
    [player.id, player.playerId, player.player_id].some(
      (candidate) => String(candidate || '') === playerId
    )
  );

const seedGovernedOfferSheetWorld = async (userId: string) => {
  const db = getReviewAdminDb();
  const worldId = await seedSeasonAdvanceReviewWorld(
    userId,
    `BZE 283 Offer Sheet Proof ${Date.now()}`
  );
  seededWorldIds.add(worldId);

  const fixture = makeGovernedOfferSheetFixture({
    worldId,
    playerId: PLAYER_ID,
    homeTeamId: HOME_TEAM,
    offeringTeamId: OFFERING_TEAM,
    offerSheetId: 'bze-283-governed-offer-sheet',
    salariesByYear: [
      { season: '2025-26', salary: 10_000_000 },
      { season: '2026-27', salary: 10_500_000 },
    ],
  });
  const authorFixture = makeGovernedOfferSheetFixture({
    worldId,
    playerId: AUTHOR_PLAYER_ID,
    homeTeamId: HOME_TEAM,
    offeringTeamId: OFFERING_TEAM,
    offerSheetId: 'bze-283-authoring-fixture',
    salariesByYear: [
      { season: '2025-26', salary: 9_000_000 },
      { season: '2026-27', salary: 9_450_000 },
    ],
  });
  const [world, homeTeam, offeringTeam, basePlayerSnapshot] = await Promise.all(
    [
      db.doc(`architect_worlds/${worldId}`).get(),
      getWorldTeamDocument(worldId, HOME_TEAM),
      getWorldTeamDocument(worldId, OFFERING_TEAM),
      db.doc(`architect_basePlayers/${PLAYER_ID}`).get(),
    ]
  );
  if (
    !world.exists ||
    !homeTeam ||
    !offeringTeam ||
    !basePlayerSnapshot.exists
  ) {
    throw new Error('BZE-283 review seed is incomplete.');
  }
  basePlayerBefore = basePlayerSnapshot.data() as RecordLike;

  const player: RecordLike = {
    ...basePlayerBefore,
    id: PLAYER_ID,
    playerId: PLAYER_ID,
    player_id: PLAYER_ID,
    name: PLAYER_NAME,
    displayName: PLAYER_NAME,
    teamCode: HOME_TEAM,
    teamId: HOME_TEAM,
    teamName: 'Boston Celtics',
    contract: {
      signingTeam: HOME_TEAM,
      salariesByYear: [],
      freeAgency: { type: 'RFA', year: 2026, capHold: 7_200_000 },
    },
    rfaContext: { governedEvidence: fixture.evidence },
  };
  const totalValue = fixture.contract.salariesByYear.reduce(
    (sum, row) => sum + Number(row.salary || 0),
    0
  );
  const governedOfferSheet = {
    id: 'bze-283-governed-offer-sheet',
    dedupKey: `os:${worldId}:${OFFERING_TEAM}:${PLAYER_ID}:${WORLD_SEASON}`,
    playerId: PLAYER_ID,
    playerName: PLAYER_NAME,
    offeringTeamCode: OFFERING_TEAM,
    homeTeamCode: HOME_TEAM,
    seasonKey: WORLD_SEASON,
    year: 2026,
    contractYears: fixture.contract.salariesByYear.length,
    salariesByYear: fixture.contract.salariesByYear,
    status: 'PENDING_MATCH',
    createdAt: fixture.proposal.receivedAt,
    totalValue,
    governedLifecycle: fixture.lifecycle,
  };
  const unreadableOfferSheet = {
    id: 'bze-283-unreadable-offer-sheet',
    dedupKey: `os:${worldId}:NYK:legacy-player:${WORLD_SEASON}`,
    playerId: 'legacy-player',
    playerName: LEGACY_PLAYER_NAME,
    offeringTeamCode: 'NYK',
    homeTeamCode: HOME_TEAM,
    seasonKey: WORLD_SEASON,
    year: 2026,
    contractYears: 2,
    salariesByYear: [
      { season: '2025-26', salary: 8_000_000, capHit: 8_000_000 },
      { season: '2026-27', salary: 8_400_000, capHit: 8_400_000 },
    ],
    status: 'PENDING_MATCH',
    createdAt: fixture.proposal.receivedAt,
    totalValue: 16_400_000,
  };

  await Promise.all([
    world.ref.set(
      {
        currentSeason: WORLD_SEASON,
        baselineSeason: WORLD_SEASON,
        asOfDate: WORLD_AS_OF_DATE,
        rightsLedgerVersion: 1,
        contractBaselineVersion: 2,
        contractSourceRelease: {
          releaseId: 'bze-283-browser-offer-sheet',
          releaseVersion: 1,
          releaseDigest: `sha256:${'9'.repeat(64)}`,
        },
        contractBaselineEffectiveAt: '2025-07-01T00:00:00-04:00',
        contractBaselineSalaryCapYear: 2026,
        contractBaselineCoverage: {
          total: 0,
          complete: 0,
          needsInput: 0,
        },
        description:
          'BZE-283 deterministic governed Offer Sheet browser proof.',
      },
      { merge: true }
    ),
    db.doc(`architect_basePlayers/${PLAYER_ID}`).set(
      {
        ...basePlayerBefore,
        rfaContext: { governedEvidence: fixture.evidence },
      },
      { merge: false }
    ),
    db.doc(`architect_basePlayers/${AUTHOR_PLAYER_ID}`).set(
      {
        id: AUTHOR_PLAYER_ID,
        playerId: AUTHOR_PLAYER_ID,
        player_id: AUTHOR_PLAYER_ID,
        name: AUTHOR_PLAYER_NAME,
        displayName: AUTHOR_PLAYER_NAME,
        teamId: HOME_TEAM,
        teamCode: null,
        teamName: 'Free Agent',
        position: 'G',
        bio: { position: 'G', age: 25, experience: 3 },
        contract: {
          contractType: 'VETERAN CONTRACT',
          signingTeam: HOME_TEAM,
          startSeason: '2024-25',
          endSeason: '2025-26',
          contractLength: 2,
          yearsRemaining: 0,
          salariesByYear: [
            {
              season: '2024-25',
              salary: 4_000_000,
              capHit: 4_000_000,
              guaranteed: true,
            },
            {
              season: '2025-26',
              salary: 4_400_000,
              capHit: 4_400_000,
              guaranteed: true,
            },
          ],
          birdRights: { status: 'Restricted' },
          freeAgency: { type: 'RFA', year: 2026, capHold: 6_600_000 },
        },
        rfaContext: { governedEvidence: authorFixture.evidence },
        source: { provider: 'BZE-283 Playwright fixture' },
      },
      { merge: false }
    ),
    db.doc(`architect_worlds/${worldId}/teams/${HOME_TEAM}`).set(
      {
        ...homeTeam,
        season: WORLD_SEASON,
        players: [
          ...teamPlayers(homeTeam).filter(
            (candidate) =>
              String(candidate.playerId || candidate.id || '') !== PLAYER_ID
          ),
          player,
        ],
        roster: [
          ...new Set([
            ...(Array.isArray(homeTeam.roster)
              ? homeTeam.roster.map((entry) =>
                  typeof entry === 'string'
                    ? entry
                    : String((entry as RecordLike)?.playerId || '')
                )
              : []),
            PLAYER_ID,
          ]),
        ].filter(Boolean),
        incomingOfferSheets: [governedOfferSheet, unreadableOfferSheet],
        rightsLedger: fixture.rightsLedger,
      },
      { merge: false }
    ),
    db.doc(`architect_worlds/${worldId}/teams/${OFFERING_TEAM}`).set(
      {
        ...offeringTeam,
        season: WORLD_SEASON,
        offerSheets: [governedOfferSheet],
      },
      { merge: false }
    ),
  ]);

  return { worldId, fixture };
};

const waitForUser = async (page: Page) => {
  await expect
    .poll(() => readReviewUserId(page), {
      timeout: 25_000,
      message: 'anonymous review user should initialize',
    })
    .not.toBe('');
  return readReviewUserId(page);
};

const capture = async (page: Page, testInfo: TestInfo, name: string) => {
  const path = testInfo.outputPath(`${name}-1280x720.png`);
  await page.screenshot({ path, fullPage: false });
  await testInfo.attach(name, { path, contentType: 'image/png' });
};

test.describe('BZE-283 governed Offer Sheet browser proof', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await enableArchitectReviewFlags(page);
    await page.goto(OFFERING_URL, { waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);
  });

  test.afterEach(async () => {
    const db = getReviewAdminDb();
    await Promise.allSettled(
      [...seededWorldIds].map((worldId) =>
        db.recursiveDelete(db.doc(`architect_worlds/${worldId}`))
      )
    );
    seededWorldIds.clear();
    if (basePlayerBefore) {
      await db
        .doc(`architect_basePlayers/${PLAYER_ID}`)
        .set(basePlayerBefore, { merge: false });
      basePlayerBefore = undefined;
    }
    await db.doc(`architect_basePlayers/${AUTHOR_PLAYER_ID}`).delete();
  });

  test('authors exact notice evidence, rejects an unreadable row, and persists an exact matched result through reload', async ({
    page,
  }, testInfo) => {
    const userId = await waitForUser(page);
    const { worldId } = await seedGovernedOfferSheetWorld(userId);
    await activateSeededWorld(page, userId, worldId);

    await openDashboardTab(page, 'Free Agency');
    const freeAgentRow = page.locator('li').filter({
      has: page.getByText(new RegExp(`^${AUTHOR_PLAYER_NAME}$`, 'i')),
    });
    await expect(freeAgentRow).toBeVisible({ timeout: 20_000 });
    await freeAgentRow
      .locator('button')
      .filter({ hasText: '•••' })
      .first()
      .click();
    await page.getByRole('button', { name: /^Sign Free Agent$/i }).click();
    const modal = page.getByTestId('edit-contract-modal');
    await expect(modal).toBeVisible({ timeout: 20_000 });
    await modal.getByRole('radio', { name: /Sign Free Agent/i }).check();
    await modal.getByLabel(/^Offer Sheet$/i).check();
    await expect(
      modal.getByTestId('governed-offer-sheet-signed-at')
    ).toBeVisible();
    await expect(
      modal.getByTestId('governed-offer-sheet-received-at')
    ).toBeVisible();
    await modal
      .getByTestId('governed-offer-sheet-signed-at')
      .fill(makeGovernedOfferSheetProposal().signedAt);
    await modal
      .getByTestId('governed-offer-sheet-received-at')
      .fill(makeGovernedOfferSheetProposal().receivedAt);
    await capture(page, testInfo, 'BZE-283-exact-notice-authoring');
    await modal.getByRole('button', { name: /^Cancel$/i }).click();

    await page.goto(HOME_URL, { waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);
    await activateSeededWorld(page, userId, worldId);
    await openDashboardTab(page, 'Free Agency');
    const incoming = page
      .locator('div')
      .filter({
        has: page.getByRole('heading', { name: /Incoming Offer Sheets/i }),
      })
      .first();
    const governedRow = incoming.locator('tr').filter({ hasText: PLAYER_NAME });
    const unreadableRow = incoming
      .locator('tr')
      .filter({ hasText: LEGACY_PLAYER_NAME });
    await expect(governedRow).toBeVisible({ timeout: 20_000 });
    await expect(unreadableRow).toContainText(
      /missing the saved notice record/i
    );
    await expect(
      unreadableRow.getByRole('button', { name: /^Match$/i })
    ).toBeDisabled();
    const resolutionInput = governedRow.getByTestId(
      'offer-sheet-resolution-at-bze-283-governed-offer-sheet'
    );
    await resolutionInput.fill('2025-07-09T23:59:59-05:00');
    await expect(
      governedRow.getByRole('button', { name: /^Match$/i })
    ).toBeDisabled();
    await resolutionInput.fill(RESOLUTION_AT);
    await expect(
      governedRow.getByRole('button', { name: /^Match$/i })
    ).toBeEnabled();
    await capture(page, testInfo, 'BZE-283-pending-and-fail-closed');
    await governedRow.getByRole('button', { name: /^Match$/i }).click();

    await expect(page.getByTestId('cockpit-last-receipt')).toContainText(
      /Offer sheet matched/i,
      { timeout: 25_000 }
    );
    await expect
      .poll(
        async () => {
          const [home, offering] = await Promise.all([
            getWorldTeamDocument(worldId, HOME_TEAM),
            getWorldTeamDocument(worldId, OFFERING_TEAM),
          ]);
          const persistedPlayer = teamPlayer(home, PLAYER_ID);
          const contract =
            persistedPlayer?.contract &&
            typeof persistedPlayer.contract === 'object' &&
            !Array.isArray(persistedPlayer.contract)
              ? (persistedPlayer.contract as RecordLike)
              : {};
          return {
            homeIncoming: Array.isArray(home?.incomingOfferSheets)
              ? home.incomingOfferSheets.filter(
                  (sheet) =>
                    String((sheet as RecordLike)?.playerId || '') === PLAYER_ID
                ).length
              : -1,
            offeringOutgoing: Array.isArray(offering?.offerSheets)
              ? offering.offerSheets.filter(
                  (sheet) =>
                    String((sheet as RecordLike)?.playerId || '') === PLAYER_ID
                ).length
              : -1,
            signingRoute: String(contract.signedUsing || ''),
            restriction: contract.offerSheetMatchRestriction || null,
          };
        },
        {
          timeout: 25_000,
          message:
            'matched Offer Sheet should persist atomically on both Teams',
        }
      )
      .toMatchObject({
        homeIncoming: 0,
        offeringOutgoing: 0,
        signingRoute: 'Match',
        restriction: {
          restrictionVersion: 1,
          offeringTeamId: OFFERING_TEAM,
          matchedAt: RESOLUTION_AT,
          restrictedUntil: '2026-07-09T23:59:59-04:00',
        },
      });
    await expect
      .poll(async () => {
        const events = await getWorldEventDocuments(worldId);
        return events.some(
          (event) =>
            event.mutationType === 'matchOfferSheet' &&
            JSON.stringify(event).includes(PLAYER_ID)
        );
      })
      .toBe(true);
    await capture(page, testInfo, 'BZE-283-matched-receipt');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);
    await openDashboardTab(page, 'Full Cap Table');
    await expect(page.getByText(PLAYER_NAME).first()).toBeVisible({
      timeout: 20_000,
    });
    const reloadedHome = await getWorldTeamDocument(worldId, HOME_TEAM);
    expect(
      (teamPlayer(reloadedHome, PLAYER_ID)?.contract as RecordLike)
        ?.offerSheetMatchRestriction
    ).toMatchObject({ matchedAt: RESOLUTION_AT });
    testInfo.annotations.push({
      type: 'audit-note',
      description:
        'At 1280×720 the saved-world UI exposes exact Eastern notice inputs, visibly disables an unreadable pending lifecycle and a wrong seasonal offset, resolves the certified mirror at the exact deadline, persists one matched contract with the one-year restriction, removes both active mirrors, records the event, and reloads the player in Full Cap Table.',
    });
  });
});
