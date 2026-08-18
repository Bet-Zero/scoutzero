/**
 * Focused browser proof for the Full Cap Table Contract Extension V1 path.
 *
 * Run:
 *   PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true npx playwright test tests/e2e/architect-contract-extension.spec.ts --reporter=line --workers=1
 */

import {
  test,
  expect,
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
import { makeResultingState } from '../architect/contractHistory/contractHistoryFixtures';

const MIA_URL = '/gm/MIA?season=2029';
const TEAM_CODE = 'MIA';
const PLAYER_NAME = 'Marcus Vance';
const PLAYER_ID = 'mia_marcus_vance';
const SUCCESS_PLAYER_NAME = 'BZE 282 Extension Player';
const SUCCESS_PLAYER_ID = 'bze282_extension_success';
const SUCCESS_CONTRACT_ID = 'bze282_extension_success_contract';
const SUCCESS_WORLD_SEASON = '2026-27';
const SUCCESS_WORLD_AS_OF_DATE = '2026-08-18';
const SUCCESS_URL = '/gm/MIA?season=2027';
const EXTENSION_SIGNED_AT = '2026-08-01T12:00:00-04:00';
const REVIEW_FIRESTORE_EMULATOR_HOST = '127.0.0.1:8082';
const REVIEW_FIRESTORE_PROJECT_ID = 'demo-architect-review';
const REVIEW_WORLD_SEASON = '2028-29';
const REVIEW_WORLD_AS_OF_DATE = '2028-07-15';
const DEV_LOCAL_STORAGE_FLAGS = {
  'hz.dev.capSheetFixtures': 'true',
  'hz.dev.offseasonPreview': 'true',
  'hz.dev.teamHistoryFixtures': 'true',
};

type RecordLike = Record<string, unknown>;

const seededWorldIds = new Set<string>();
const seededBasePlayerIds = new Set<string>();

const instant = (value: string) => ({
  precision: 'instant' as const,
  value,
  rawValue: value,
});

const dateValue = (value: string) => ({
  precision: 'date' as const,
  value,
  rawValue: value,
});

const unknownInstant = () => ({
  precision: 'unknown' as const,
  value: null,
  rawValue: null,
});

const extensionSalaryRow = (
  season: string,
  salary: number
): ContractSalaryTerm => ({
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

const buildSuccessfulExtensionFixture = () => {
  const releaseId = 'bze-282-browser-extension';
  const releaseDigest = `sha256:${'4'.repeat(64)}`;
  const sourceArtifactSha256 = `sha256:${'5'.repeat(64)}`;
  const sourceObservationId = 'bze-282-extension-observation';
  const sourceProvider = 'BZE-282 Playwright fixture';
  const salaries = [
    extensionSalaryRow('2023-24', 17_000_000),
    extensionSalaryRow('2024-25', 18_000_000),
    extensionSalaryRow('2025-26', 19_000_000),
    extensionSalaryRow('2026-27', 20_000_000),
  ];
  const totalValue = salaries.reduce(
    (sum, salary) => sum + (salary.salary ?? 0),
    0
  );
  const state = makeResultingState({
    contractId: SUCCESS_CONTRACT_ID,
    contractVersion: 1,
    playerId: SUCCESS_PLAYER_ID,
    teamId: TEAM_CODE,
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
      isExtension: false,
      isRookieScale: false,
      signedUsing: 'Bird Exception',
      signingTeam: TEAM_CODE,
      signingDate: instant('2023-07-01T12:00:00-04:00'),
      signedByCurrentTeam: true,
      startSeason: '2023-24',
      endSeason: '2026-27',
      contractLength: salaries.length,
      totalValue,
      averageAnnualValue: totalValue / salaries.length,
      guaranteedValue: totalValue,
      guaranteedYears: salaries.length,
      salaries,
      birdRights: {
        status: 'Full Bird',
        yearsOfService: 9,
        yearsWithTeam: 6,
        eligibleFor: ['Veteran Extension'],
      },
      freeAgency: {
        type: 'UFA',
        year: 2027,
        capHold: null,
        qualifyingOffer: null,
        earlyTerminationOption: null,
        hasOption: false,
        optionYear: null,
        optionType: null,
      },
      sourceLimitations: [],
      extensionEvidence: {
        evidenceVersion: 1,
        status: 'known',
        observedAt: dateValue('2026-07-01'),
        sourceIdentity: {
          releaseId,
          releaseVersion: 1,
          releaseDigest,
          sourceProvider,
          sourceRecordVersion: '1',
          sourceObservationId,
          sourceArtifactSha256,
          sourceContractPath: 'contract',
        },
        transactionHistoryComplete: true,
        originalSignedAt: instant('2023-07-01T12:00:00-04:00'),
        yearsOfServiceAtFirstExtendedSeason: 9,
        projectedQvfaAtOriginalExpiry: true,
        seasonsPlayedForCurrentTeam: 6,
        designatedTeamRoute: null,
        latestRenegotiationAt: unknownInstant(),
        latestRenegotiationSalaryIncreasePercent: null,
        fourthSeasonFirstGameAt: unknownInstant(),
        originalCompensation: salaries.map((salary) => ({
          season: salary.season!,
          salaryExcludingIncentive: salary.salary!,
          regularSalary: salary.salary!,
          bonuses: [],
        })),
        awardEvidence: {
          status: 'unknown',
          achievement: null,
          achievementSeason: null,
          qualificationWindowSatisfied: null,
          gameThresholdStatus: 'unknown',
          determinationId: null,
        },
      },
      extensionLeagueEvidence: {
        evidenceVersion: 1,
        status: 'known',
        signingSalaryCapYear: 2027,
        firstExtendedSalaryCapYear: 2028,
        salaryCap: 180_000_000,
        estimatedAveragePlayerSalary: 22_000_000,
        moratoriumEndsAt: instant('2026-07-07T12:00:00-04:00'),
        regularSeasonFirstDay: dateValue('2026-10-20'),
        source: {
          provider: sourceProvider,
          sourceUrl: 'fixture://bze-282-extension-league-values',
          retainedArtifactPath:
            'inline://tests/e2e/architect-contract-extension.spec.ts#league-evidence',
          artifactSha256: `sha256:${'6'.repeat(64)}`,
          artifactBytes: 192,
          retrievedAt: '2026-07-01T09:00:00-04:00',
        },
      },
    },
  });
  const mutableContract = {
    contractType: state.terms.contractType,
    isExtension: false,
    isRookieScale: false,
    signingTeam: TEAM_CODE,
    startSeason: state.terms.startSeason,
    endSeason: state.terms.endSeason,
    contractLength: state.terms.contractLength,
    years: state.terms.contractLength,
    yearsRemaining: 1,
    totalValue: state.terms.totalValue,
    averageAnnualValue: state.terms.averageAnnualValue,
    guaranteedValue: state.terms.guaranteedValue,
    guaranteedYears: state.terms.guaranteedYears,
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
    id: SUCCESS_PLAYER_ID,
    playerId: SUCCESS_PLAYER_ID,
    player_id: SUCCESS_PLAYER_ID,
    name: SUCCESS_PLAYER_NAME,
    displayName: SUCCESS_PLAYER_NAME,
    teamCode: TEAM_CODE,
    teamId: TEAM_CODE,
    teamName: 'Miami Heat',
    position: 'F',
    age: 31,
    salary: 20_000_000,
    currentSalary: 20_000_000,
    contract: mutableContract,
    futureContract: null,
    bio: {
      playerId: SUCCESS_PLAYER_ID,
      displayName: SUCCESS_PLAYER_NAME,
      position: 'F',
      age: 31,
      experience: 9,
    },
    source: { provider: sourceProvider, type: 'extension-fixture' },
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
      selectionPolicy: 'Only the bounded BZE-282 successful extension record.',
      transformationId: 'bze-282-browser-extension-v1',
      limitations: [
        'Synthetic browser proof; not production source authority.',
      ],
      evidenceCatalog: {
        transformations: [
          {
            id: 'bze-282-browser-extension-v1',
            description: 'Explicit complete Veteran Extension fixture.',
          },
        ],
        limitations: [],
      },
    },
    observations: [],
    records: [
      {
        contractId: SUCCESS_CONTRACT_ID,
        contractVersion: 1,
        playerId: SUCCESS_PLAYER_ID,
        teamId: TEAM_CODE,
        sourceObservationId,
        sourceContractPath: 'contract',
        resultingState: state,
      },
    ],
    coverage: {
      sourceObservationCount: 1,
      uniquePlayerCount: 1,
      totalSourceContracts: 1,
      completeRecordIds: [SUCCESS_CONTRACT_ID],
      needsInputRecordIds: [],
      excludedCorruptRecordIds: [],
      missingByCategory: [],
      laterRouteReadiness: {
        option: {
          readyRecordIds: [],
          blockedRecordIds: [SUCCESS_CONTRACT_ID],
          missingByCategory: [
            {
              category: 'option-route-not-in-fixture',
              recordIds: [SUCCESS_CONTRACT_ID],
            },
          ],
        },
        extension: {
          readyRecordIds: [SUCCESS_CONTRACT_ID],
          blockedRecordIds: [],
          missingByCategory: [],
        },
      },
    },
  };

  return { player, release };
};

const isVisible = async (locator: Locator, timeout = 3000) =>
  locator.isVisible({ timeout }).catch(() => false);

const getReviewAdminDb = () => {
  process.env.FIRESTORE_EMULATOR_HOST = REVIEW_FIRESTORE_EMULATOR_HOST;

  const app =
    admin.apps.find(
      (existingApp) => existingApp.name === 'contract-extension-proof'
    ) ||
    admin.initializeApp(
      { projectId: REVIEW_FIRESTORE_PROJECT_ID },
      'contract-extension-proof'
    );

  return app.firestore();
};

const getWorldTeamDocument = async (worldId: string, teamCode: string) =>
  (await getReviewAdminDb()
    .doc(`architect_worlds/${worldId}/teams/${teamCode}`)
    .get()
    .then((snapshot) => snapshot.data())) as RecordLike | undefined;

const getWorldEventDocuments = async (worldId: string) =>
  (await getReviewAdminDb()
    .collection(`architect_worlds/${worldId}/events`)
    .get()
    .then((snapshot) =>
      snapshot.docs
        .map((docSnapshot) => ({
          id: docSnapshot.id,
          ...(docSnapshot.data() as RecordLike),
        }))
        .sort((left, right) => {
          const leftTimestamp = Date.parse(
            String(left.occurredAt || left.timestamp || 0)
          );
          const rightTimestamp = Date.parse(
            String(right.occurredAt || right.timestamp || 0)
          );
          return rightTimestamp - leftTimestamp;
        })
    )) as Array<RecordLike & { id: string }>;

const getExtensionEvent = async (worldId: string, playerId = PLAYER_ID) => {
  const events = await getWorldEventDocuments(worldId);

  return events.find((event) => {
    const eventText = JSON.stringify(event);
    return (
      event.mutationType === 'extendPlayer' && eventText.includes(playerId)
    );
  });
};

const readReviewUserId = async (page: Page): Promise<string> =>
  page
    .evaluate(
      () =>
        new Promise<string>((resolve) => {
          let settled = false;
          const finish = (value: string) => {
            if (settled) return;
            settled = true;
            resolve(value);
          };
          const timer = setTimeout(() => finish(''), 4000);
          try {
            const request = indexedDB.open('firebaseLocalStorageDb');
            request.onerror = () => {
              clearTimeout(timer);
              finish('');
            };
            request.onsuccess = () => {
              const idb = request.result;
              try {
                const store = idb
                  .transaction('firebaseLocalStorage', 'readonly')
                  .objectStore('firebaseLocalStorage');
                const getAll = store.getAll();
                getAll.onerror = () => {
                  clearTimeout(timer);
                  finish('');
                };
                getAll.onsuccess = () => {
                  clearTimeout(timer);
                  const records = (getAll.result || []) as Array<{
                    fbase_key?: string;
                    value?: { uid?: string } | string;
                  }>;
                  const authRecord = records.find((record) =>
                    String(record.fbase_key || '').includes('authUser')
                  );
                  let value: { uid?: string } | string | undefined =
                    authRecord?.value;
                  if (typeof value === 'string') {
                    try {
                      value = JSON.parse(value) as { uid?: string };
                    } catch {
                      value = undefined;
                    }
                  }
                  finish(
                    value &&
                      typeof value === 'object' &&
                      typeof value.uid === 'string'
                      ? value.uid
                      : ''
                  );
                };
              } catch {
                clearTimeout(timer);
                finish('');
              }
            };
          } catch {
            clearTimeout(timer);
            finish('');
          }
        })
    )
    .catch(() => '');

const readActiveWorldId = async (page: Page) =>
  page
    .evaluate(() => {
      const storageKey = Object.keys(window.localStorage).find((key) =>
        key.startsWith('architect.activeWorldId.')
      );

      return storageKey ? window.localStorage.getItem(storageKey) || '' : '';
    })
    .catch(() => '');

const seedReviewWorld = async (userId: string) => {
  const worldId = `world_contract_extension_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
  seededWorldIds.add(worldId);
  const now = admin.firestore.Timestamp.now();
  await getReviewAdminDb()
    .doc(`architect_worlds/${worldId}`)
    .set({
      worldId,
      worldName: `Contract Extension Proof ${Date.now()}`,
      description: '',
      createdBy: userId,
      createdAt: now,
      lastModifiedAt: now,
      currentSeason: REVIEW_WORLD_SEASON,
      baselineSeason: REVIEW_WORLD_SEASON,
      asOfDate: REVIEW_WORLD_AS_OF_DATE,
      parentWorldId: null,
      branchedFrom: null,
      childWorlds: [],
      modifiedTeams: [],
      actionCount: 0,
      tags: [],
      isArchived: false,
      isFavorite: false,
      contractBaselineVersion: 2,
      contractSourceRelease: {
        releaseId: 'bze-282-browser-empty-release',
        releaseVersion: 1,
        releaseDigest: `sha256:${'8'.repeat(64)}`,
      },
      contractBaselineEffectiveAt: '2028-07-15T12:00:00-04:00',
      contractBaselineSalaryCapYear: 2029,
      contractBaselineCoverage: {
        total: 0,
        complete: 0,
        needsInput: 0,
      },
      stats: {
        totalTrades: 0,
        totalSignings: 0,
        totalWaives: 0,
        totalRenounces: 0,
        teamsInvolved: 0,
      },
    });
  return worldId;
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

const seedSuccessfulReviewWorld = async (userId: string) => {
  const db = getReviewAdminDb();
  const worldId = `world_contract_extension_success_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
  seededWorldIds.add(worldId);
  seededBasePlayerIds.add(SUCCESS_PLAYER_ID);
  const { player, release } = buildSuccessfulExtensionFixture();
  const now = admin.firestore.Timestamp.now();
  await db.doc(`architect_worlds/${worldId}`).set({
    worldId,
    worldName: `Contract Extension Success ${Date.now()}`,
    description: 'BZE-282 deterministic successful extension proof.',
    createdBy: userId,
    createdAt: now,
    lastModifiedAt: now,
    currentSeason: SUCCESS_WORLD_SEASON,
    baselineSeason: SUCCESS_WORLD_SEASON,
    asOfDate: SUCCESS_WORLD_AS_OF_DATE,
    parentWorldId: null,
    branchedFrom: null,
    childWorlds: [],
    modifiedTeams: [TEAM_CODE],
    lastModifiedTeams: [TEAM_CODE],
    actionCount: 0,
    tags: ['review', 'bze-282', 'extension-success'],
    isArchived: false,
    isFavorite: false,
    ...contractBaselineMetadata(release),
    stats: {
      totalTrades: 0,
      totalSignings: 0,
      totalWaives: 0,
      totalRenounces: 0,
      teamsInvolved: 1,
    },
  });
  const team = {
    id: TEAM_CODE,
    teamCode: TEAM_CODE,
    teamName: 'Miami Heat',
    abbreviation: TEAM_CODE,
    season: SUCCESS_WORLD_SEASON,
    players: [player],
    roster: [SUCCESS_PLAYER_ID],
    activeContracts: [
      {
        name: SUCCESS_PLAYER_NAME,
        player_id: SUCCESS_PLAYER_ID,
        contract: player.contract,
        years: 1,
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
    totals: {
      totalSalary: 20_000_000,
      rosterCount: 1,
      isHardCapped: false,
    },
    source: {
      type: 'review-world-bze-282-fixture',
      provider: 'playwright',
      worldId,
    },
  };
  await Promise.all([
    db.doc(`architect_worlds/${worldId}/teams/${TEAM_CODE}`).set(team),
    db.doc(`architect_basePlayers/${SUCCESS_PLAYER_ID}`).set(player),
    writeBaselineDocuments(
      worldId,
      buildContractBaselineTeamDocuments(release, worldId)
    ),
  ]);
  return worldId;
};

const waitForMiaDashboard = async (page: Page) => {
  const fullCapTab = page.getByRole('tab', { name: /^Full Cap Table$/i });
  const noTeamData = page.getByText(/^No team data$/i);
  const loadingDashboard = page.getByText(/^Loading GM Dashboard/i);

  await expect
    .poll(
      async () => {
        const stillLoading = await isVisible(loadingDashboard, 1000);
        const hasFullCapTab = await isVisible(fullCapTab, 1000);
        const hasNoTeamData = await isVisible(noTeamData, 1000);
        return !stillLoading && (hasFullCapTab || hasNoTeamData);
      },
      {
        timeout: 60000,
        message: 'MIA review dashboard should reach an interactive state',
      }
    )
    .toBe(true);

  expect(
    await isVisible(noTeamData, 1000),
    'MIA review fixture should be seeded before extension proof'
  ).toBe(false);
};

const activateSeededWorld = async (
  page: Page,
  userId: string,
  worldId: string
) => {
  await page.evaluate(
    ({ uid, wid }) => {
      window.localStorage.setItem(`architect.activeWorldId.${uid}`, wid);
    },
    { uid: userId, wid: worldId }
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForMiaDashboard(page);

  const worldMenuTrigger = page.getByTestId('cockpit-world-menu-trigger');
  await expect(worldMenuTrigger).toBeVisible({ timeout: 20000 });
  await expect
    .poll(
      async () =>
        ((await worldMenuTrigger.textContent()) || '').includes('Sandbox'),
      {
        timeout: 20000,
        message: `cockpit should leave Sandbox after restoring ${worldId}`,
      }
    )
    .toBe(false);
};

const ensureWorldSelected = async (page: Page) => {
  await expect
    .poll(async () => await readReviewUserId(page), {
      timeout: 25000,
      message: 'anonymous review uid should initialize',
    })
    .not.toBe('');

  const userId = await readReviewUserId(page);
  const worldId = await seedReviewWorld(userId);
  await activateSeededWorld(page, userId, worldId);
  return worldId;
};

const ensureSuccessfulWorldSelected = async (page: Page) => {
  await expect
    .poll(async () => await readReviewUserId(page), {
      timeout: 25000,
      message: 'anonymous review uid should initialize',
    })
    .not.toBe('');

  const userId = await readReviewUserId(page);
  const worldId = await seedSuccessfulReviewWorld(userId);
  await page.goto(SUCCESS_URL, { waitUntil: 'domcontentloaded' });
  await waitForMiaDashboard(page);
  await activateSeededWorld(page, userId, worldId);
  return worldId;
};

const ensureSpecificWorldSelected = async (page: Page, worldId: string) => {
  await expect
    .poll(async () => await readActiveWorldId(page), {
      timeout: 10000,
      message: `world ${worldId} should remain active after reload`,
    })
    .toBe(worldId);
};

const enableDevAuditFlags = async (page: Page) => {
  await page.addInitScript((flags) => {
    Object.entries(flags).forEach(([key, value]) => {
      window.localStorage.setItem(key, value);
    });
  }, DEV_LOCAL_STORAGE_FLAGS);
};

const openDashboardTab = async (page: Page, label: string) => {
  const tab = page.getByRole('tab', {
    name: new RegExp(`^${label}$`, 'i'),
  });
  await expect(tab).toBeVisible();
  await tab.click();
};

const extensionPlayerRow = (page: Page, playerName = PLAYER_NAME): Locator =>
  page.locator('[data-cap-fit-row]').filter({
    has: page
      .getByTestId('cap-sheet-full-player-row-button')
      .filter({ hasText: playerName }),
  });

const openContractExtensionModal = async (
  page: Page,
  {
    playerName = PLAYER_NAME,
    expectedStatus = 'needs-input',
  }: {
    playerName?: string;
    expectedStatus?: 'needs-input' | 'ready';
  } = {}
) => {
  await openDashboardTab(page, 'Full Cap Table');

  const row = extensionPlayerRow(page, playerName).first();
  await expect(row).toBeVisible({ timeout: 20000 });
  await expect(row).toContainText(playerName);
  await row.getByTestId('cap-sheet-full-player-row-button').hover();

  await page
    .getByRole('button', {
      name: new RegExp(`More actions for ${playerName}`, 'i'),
    })
    .click();

  const overflowMenu = page.getByTestId(
    'cap-sheet-full-player-row-overflow-menu'
  );
  await expect(overflowMenu).toBeVisible();

  const extendAction = overflowMenu.getByTestId(
    'cap-sheet-full-player-row-action-extend'
  );
  await expect(extendAction).toBeVisible();
  await expect(extendAction).toHaveText(/^Extend$/i);
  await expect(extendAction).toHaveAttribute(
    'data-action-exposure-classification',
    'V1 supported'
  );
  await extendAction.click();

  const modal = page.getByTestId('edit-contract-modal');
  await expect(modal).toBeVisible({ timeout: 20000 });
  await expect(
    modal.getByTestId('contract-modal-action-context')
  ).toContainText(
    expectedStatus === 'ready' ? /Extend Contract/i : /Extension Needs Input/i
  );
  await expect(
    modal.getByTestId('contract-modal-action-context')
  ).toContainText(playerName);
  if (expectedStatus === 'needs-input') {
    await expect(
      modal.getByText(/^Extension Needs Input$/i).first()
    ).toBeVisible();
  }
  await expect(modal.getByText(/Extend Contract \(Preview\)/i)).toHaveCount(0);
  await expect(modal.getByText(/Sign & Trade/i)).toHaveCount(0);
  await expect(page.getByLabel(/^Offer Sheet$/i)).toHaveCount(0);

  return modal;
};

const getTeamPlayer = (
  team: RecordLike | undefined,
  playerId: string
): RecordLike | undefined =>
  (Array.isArray(team?.players) ? team.players : []).find((player) => {
    if (!player || typeof player !== 'object' || Array.isArray(player)) {
      return false;
    }
    const record = player as RecordLike;
    return (
      String(record.playerId || record.player_id || record.id || '') ===
      playerId
    );
  }) as RecordLike | undefined;

const getContractLedgerEvents = (team: RecordLike | undefined): RecordLike[] =>
  (Array.isArray(team?.contractEventLedgers)
    ? team.contractEventLedgers
    : []
  ).flatMap((ledger) => {
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger))
      return [];
    const events = (ledger as RecordLike).events;
    return Array.isArray(events)
      ? events.filter(
          (event): event is RecordLike =>
            Boolean(event) && typeof event === 'object' && !Array.isArray(event)
        )
      : [];
  });

test.describe('ARCH-CONTRACT-EXTENSION: Full Cap saved-world proof', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test.beforeEach(async ({ page }) => {
    await enableDevAuditFlags(page);
    await page.goto(MIA_URL, { waitUntil: 'domcontentloaded' });
    await waitForMiaDashboard(page);
  });

  test.afterEach(async () => {
    const db = getReviewAdminDb();
    const worldCleanup = await Promise.allSettled(
      [...seededWorldIds].map((worldId) =>
        db.recursiveDelete(db.doc(`architect_worlds/${worldId}`))
      )
    );
    let basePlayerCleanupError: unknown = null;
    if (seededBasePlayerIds.size > 0) {
      try {
        const cleanup = db.batch();
        seededBasePlayerIds.forEach((playerId) => {
          cleanup.delete(db.doc(`architect_basePlayers/${playerId}`));
        });
        await cleanup.commit();
      } catch (error) {
        basePlayerCleanupError = error;
      }
    }
    const cleanupErrors = worldCleanup.flatMap((result) =>
      result.status === 'rejected' ? [result.reason] : []
    );
    if (basePlayerCleanupError) cleanupErrors.push(basePlayerCleanupError);
    seededWorldIds.clear();
    seededBasePlayerIds.clear();
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        cleanupErrors,
        'BZE-282 emulator fixture cleanup failed.'
      );
    }
  });

  test('MIA Full Cap row fails closed without governed extension evidence and reloads unchanged', async ({
    page,
  }, testInfo: TestInfo) => {
    const worldId = await ensureWorldSelected(page);
    const teamBefore = await getWorldTeamDocument(worldId, TEAM_CODE);
    const eventsBefore = await getWorldEventDocuments(worldId);

    const modal = await openContractExtensionModal(page);
    const extendRadio = modal.getByTestId('contract-action-extend');
    await expect(extendRadio).toBeChecked();
    await expect(extendRadio).toBeDisabled();
    await expect(
      modal.getByText(/Required contract information is missing/i).first()
    ).toBeVisible();
    await expect(
      modal
        .getByText(/Required contract information is missing for this player/i)
        .first()
    ).toBeVisible();
    await expect(
      modal.getByTestId('edit-contract-confirm-action-button')
    ).toBeDisabled();
    await expect(
      modal.getByTestId('edit-contract-confirm-action-button')
    ).toHaveText(/Authoritative Preflight Pending/i);
    await expect(modal.getByText(/Advanced: Override Validation/i)).toHaveCount(
      0
    );

    expect(await getExtensionEvent(worldId)).toBeUndefined();
    expect(await getWorldTeamDocument(worldId, TEAM_CODE)).toEqual(teamBefore);
    expect(await getWorldEventDocuments(worldId)).toEqual(eventsBefore);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForMiaDashboard(page);
    await ensureSpecificWorldSelected(page, worldId);
    const reloadedModal = await openContractExtensionModal(page);
    await expect(
      reloadedModal.getByTestId('edit-contract-confirm-action-button')
    ).toBeDisabled();
    await expect(
      reloadedModal
        .getByText(/Required contract information is missing/i)
        .first()
    ).toBeVisible();
    expect(await getExtensionEvent(worldId)).toBeUndefined();
    expect(await getWorldTeamDocument(worldId, TEAM_CODE)).toEqual(teamBefore);
    expect(await getWorldEventDocuments(worldId)).toEqual(eventsBefore);

    testInfo.annotations.push({
      type: 'audit-note',
      description:
        'MIA saved-world Full Cap Table extension fails closed when required contract and league information is missing; the action cannot be overridden, creates no event or team write, and remains blocked after reload.',
    });
  });

  test('MIA Full Cap row saves a salary-only extension, reloads identically, and records Team History', async ({
    page,
  }, testInfo: TestInfo) => {
    const worldId = await ensureSuccessfulWorldSelected(page);
    const teamBefore = await getWorldTeamDocument(worldId, TEAM_CODE);
    expect(
      getTeamPlayer(teamBefore, SUCCESS_PLAYER_ID)?.futureContract
    ).toBeNull();
    expect(await getExtensionEvent(worldId, SUCCESS_PLAYER_ID)).toBeUndefined();

    const modal = await openContractExtensionModal(page, {
      playerName: SUCCESS_PLAYER_NAME,
      expectedStatus: 'ready',
    });
    await expect(modal.getByTestId('contract-action-extend')).toBeChecked();
    await expect(modal.getByText(/Extension information ready/i)).toBeVisible();
    await modal.getByTestId('contract-years').selectOption('4');
    await modal
      .getByTestId('governed-extension-signed-at')
      .fill(EXTENSION_SIGNED_AT);
    const salaryInputs = modal.locator('input[inputmode="decimal"]:enabled');
    await expect(salaryInputs).toHaveCount(4);
    for (const [index, salary] of [
      30_800_000, 33_264_000, 35_728_000, 38_192_000,
    ].entries()) {
      await salaryInputs.nth(index).fill(String(salary));
    }

    const confirm = modal.getByTestId('edit-contract-confirm-action-button');
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(modal).toHaveCount(0, { timeout: 25_000 });
    await expect(page.getByTestId('cockpit-last-receipt')).toContainText(
      /Extension saved/i,
      { timeout: 20_000 }
    );

    const persistedTeam = await getWorldTeamDocument(worldId, TEAM_CODE);
    const persistedPlayer = getTeamPlayer(persistedTeam, SUCCESS_PLAYER_ID);
    const futureContract = persistedPlayer?.futureContract as
      | RecordLike
      | undefined;
    const futureSalaries = Array.isArray(futureContract?.salariesByYear)
      ? futureContract.salariesByYear
      : [];
    expect(
      futureSalaries.map((salary) => Number((salary as RecordLike).salary))
    ).toEqual([30_800_000, 33_264_000, 35_728_000, 38_192_000]);
    const ledgerEvents = getContractLedgerEvents(persistedTeam);
    expect(ledgerEvents.some((event) => event.eventKind === 'extension')).toBe(
      true
    );
    expect(await getExtensionEvent(worldId, SUCCESS_PLAYER_ID)).toBeTruthy();

    await openDashboardTab(page, 'Team History');
    await expect(page.getByText(/Team Transaction History/i)).toBeVisible();
    await expect(page.getByText(/Extension Signed/i).first()).toBeVisible();
    await expect(
      page.getByText(SUCCESS_PLAYER_NAME, { exact: false }).first()
    ).toBeVisible();

    const persistedFutureContract = JSON.stringify(futureContract);
    const persistedLedgerEvents = JSON.stringify(ledgerEvents);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForMiaDashboard(page);
    await ensureSpecificWorldSelected(page, worldId);
    await openDashboardTab(page, 'Full Cap Table');
    const reloadedRow = extensionPlayerRow(page, SUCCESS_PLAYER_NAME).first();
    await expect(reloadedRow).toBeVisible({ timeout: 20_000 });
    await expect(reloadedRow).toContainText('$30,800,000');
    const reloadedTeam = await getWorldTeamDocument(worldId, TEAM_CODE);
    const reloadedPlayer = getTeamPlayer(reloadedTeam, SUCCESS_PLAYER_ID);
    expect(JSON.stringify(reloadedPlayer?.futureContract)).toBe(
      persistedFutureContract
    );
    expect(JSON.stringify(getContractLedgerEvents(reloadedTeam))).toBe(
      persistedLedgerEvents
    );
    await openDashboardTab(page, 'Team History');
    await expect(page.getByText(/Extension Signed/i).first()).toBeVisible();
    await expect(
      page.getByText(SUCCESS_PLAYER_NAME, { exact: false }).first()
    ).toBeVisible();

    testInfo.annotations.push({
      type: 'audit-note',
      description:
        'BZE-282 successful browser gate: the saved-world Full Cap row submits a salary-only Veteran Extension, persists the future contract and immutable contract event, reloads with identical values, and shows the committed Team History event.',
    });
  });
});
