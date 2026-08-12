/** BZE-275 fresh-world Chromium proof for governed TO, PO, and ETO decisions. */

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
import { deterministicStateDigest } from '../../src/features/architect/utils/contractSource/deterministicDigest';
import { createRightsEventLedger } from '../../src/features/architect/utils/rightsHistory/rightsEventLedger';
import type {
  ContractSalaryTerm,
  GovernedContractState,
  GovernedOptionDecisionTerms,
  GovernedOptionRfaRelevanceEvidence,
} from '../../src/schemas/governedContractState';
import type {
  ContractBaselineTeamDocument,
  ContractSourceRelease,
} from '../../src/schemas/contractSourceRelease';
import {
  RIGHTS_EVENT_LEDGER_PAYLOAD_VERSION,
  type RightsEventRecord,
} from '../../src/schemas/rightsEventLedger';
import { makeResultingState } from '../architect/contractHistory/contractHistoryFixtures';
import { makeRightsEstablishedEvent } from '../fixtures/architect/rightsHistory';
import {
  DEV_LOCAL_STORAGE_FLAGS,
  getReviewAdminDb,
  readActiveWorldId,
  readReviewUserId,
  waitForReviewDashboard,
} from './helpers/architectReviewWorld';

const TEAM_ID = 'MIA';
const DASHBOARD_URL = '/gm/MIA?season=2027';
const CURRENT_SEASON = '2026-27';
const WORLD_AS_OF_DATE = '2027-07-01';
const BASELINE_SALARY_CAP_YEAR = 2027;
const TARGET_YEAR = 2028;
const TARGET_SEASON = '2027-28';
const DEADLINE = '2027-06-29T17:00:00-04:00';
const WINDOW_OPENS = '2027-06-01T09:00:00-04:00';
const CONTRACT_ENDS = '2027-07-01T00:00:00-04:00';
const SOURCE_EFFECTIVE_AT = '2026-07-01T00:00:00-04:00';

type OptionType = 'TO' | 'PO' | 'ETO';
type Choice = 'exercise' | 'decline';
type RecordLike = Record<string, unknown>;

type FixturePlayer = {
  playerId: string;
  displayName: string;
  optionType: OptionType;
  contractId: string;
  state: GovernedContractState;
  player: RecordLike;
  blocked: boolean;
};

const instant = (value: string) => ({
  precision: 'instant' as const,
  value,
  rawValue: value,
});

const unknownInstant = () => ({
  precision: 'unknown' as const,
  value: null,
  rawValue: null,
});

const dateValue = (value: string) => ({
  precision: 'date' as const,
  value,
  rawValue: value,
});

const rfaRelevanceEvidence = (
  declineFreeAgencyStatus: 'RFA' | 'UFA' = 'UFA'
): GovernedOptionRfaRelevanceEvidence => ({
  evidenceVersion: 1,
  status: 'known',
  declineFreeAgencyStatus,
  salaryCapYear: TARGET_YEAR,
  observedAt: dateValue('2027-06-20'),
  sourceIdentity: {
    releaseId: 'fixture-release',
    releaseVersion: 1,
    releaseDigest: `sha256:${'1'.repeat(64)}`,
    sourceProvider: 'fixture',
    sourceRecordVersion: '1',
    sourceObservationId: 'fixture-observation',
    sourceArtifactSha256: `sha256:${'2'.repeat(64)}`,
    sourceContractPath: 'contract',
  },
});

const seasonForEndYear = (endYear: number) =>
  `${endYear - 1}-${String(endYear % 100).padStart(2, '0')}`;

const optionTerms = (
  optionType: OptionType,
  overrides: Partial<GovernedOptionDecisionTerms> = {}
): GovernedOptionDecisionTerms => ({
  termsVersion: 1,
  conditional: false,
  decisionWindowOpensAt: instant(WINDOW_OPENS),
  contractEndsAt: instant(CONTRACT_ENDS),
  nonCompensationTermsMatchPriorSeason: true,
  compensationProtectionMatchesPriorSeason: true,
  rookieScaleOptionOrdinal: null,
  rookieScaleFourthSeasonTermsMatchThird: null,
  playerOptionProtectionAlternative: optionType === 'PO' ? 'A' : null,
  preExerciseProtectionApplies: optionType === 'PO' ? true : null,
  teamLastGameAt: unknownInstant(),
  rfaDeclarationDeadline: unknownInstant(),
  rfaRelevanceEvidence:
    optionType === 'ETO' ? null : rfaRelevanceEvidence(),
  etoOrigin: optionType === 'ETO' ? 'original-contract' : null,
  etoAddedDuringOriginalTerm: optionType === 'ETO' ? false : null,
  allowedNoticeMethods: ['email', 'certified-mail'],
  noticeRecipient: optionType === 'TO' ? 'team' : 'player',
  leagueForwardingRequired: true,
  ...overrides,
});

const salaryRow = ({
  endYear,
  index,
  optionType = null,
  blocked = false,
  deadline = DEADLINE,
  terms = null,
  salaryOverride = null,
  unlikelyBonusOverride = null,
}: {
  endYear: number;
  index: number;
  optionType?: OptionType | null;
  blocked?: boolean;
  deadline?: string;
  terms?: GovernedOptionDecisionTerms | null;
  salaryOverride?: number | null;
  unlikelyBonusOverride?: number | null;
}): ContractSalaryTerm => {
  const salary = salaryOverride ?? 8_000_000 + index * 1_000_000;
  return {
    season: seasonForEndYear(endYear),
    salary,
    capHit: salary,
    guaranteed: true,
    guaranteedAmount: salary,
    option: optionType,
    optionHolder: optionType === 'TO' ? 'team' : optionType ? 'player' : null,
    optionUsed: null,
    optionDecisionDate: unknownInstant(),
    optionDecisionDeadline:
      optionType && !blocked ? instant(deadline) : unknownInstant(),
    optionDecisionTerms: optionType ? terms ?? optionTerms(optionType) : null,
    tradeBonus: null,
    incentives: {
      likely: index * 100_000,
      unlikely: unlikelyBonusOverride ?? index * 50_000,
      criteriaEvidence: 'known',
    },
    guaranteeSchedule: [],
    voidedByExtension: false,
    voidedOn: unknownInstant(),
  };
};

const buildFixturePlayer = ({
  optionType,
  suffix,
  blocked = false,
  declineFreeAgencyStatus = 'UFA',
  isRookieScale = false,
  optionSalary = null,
  optionUnlikelyBonus = null,
}: {
  optionType: OptionType;
  suffix: string;
  blocked?: boolean;
  declineFreeAgencyStatus?: 'RFA' | 'UFA';
  isRookieScale?: boolean;
  optionSalary?: number | null;
  optionUnlikelyBonus?: number | null;
}): FixturePlayer => {
  const playerId = `bze275_${optionType.toLowerCase()}_${suffix}`;
  const displayName = `BZE 275 ${optionType} ${suffix}`;
  const contractId = `${playerId}_contract`;
  const rowCount = optionType === 'ETO' ? 5 : isRookieScale ? 4 : 3;
  const firstEndYear = TARGET_YEAR - rowCount + 1;
  const salaries = Array.from({ length: rowCount }, (_, index) =>
    salaryRow({
      endYear: firstEndYear + index,
      index,
      optionType: index === rowCount - 1 ? optionType : null,
      blocked: index === rowCount - 1 && blocked,
      deadline: isRookieScale ? '2026-11-02T17:00:00-05:00' : DEADLINE,
      terms:
        index === rowCount - 1
          ? optionTerms(optionType, {
              rfaRelevanceEvidence: isRookieScale
                ? null
                : optionType === 'ETO'
                  ? null
                  : rfaRelevanceEvidence(declineFreeAgencyStatus),
              ...(isRookieScale
                ? {
                    decisionWindowOpensAt: instant(
                      '2026-10-01T09:00:00-04:00'
                    ),
                    rookieScaleOptionOrdinal: 'fourth' as const,
                    rookieScaleFourthSeasonTermsMatchThird: true,
                  }
                : {}),
            })
          : null,
      salaryOverride:
        index === rowCount - 1 ? optionSalary : null,
      unlikelyBonusOverride:
        index === rowCount - 1 ? optionUnlikelyBonus : null,
    })
  );
  if (isRookieScale) {
    salaries[2] = {
      ...salaries[2],
      option: 'TO',
      optionHolder: 'team',
      optionUsed: true,
      optionDecisionDate: instant('2025-10-31T16:00:00-04:00'),
      optionDecisionDeadline: instant('2025-10-31T17:00:00-04:00'),
      optionDecisionTerms: null,
    };
  }
  const totalValue = salaries.reduce((sum, row) => sum + (row.salary ?? 0), 0);
  const state = makeResultingState({
    contractId,
    contractVersion: 1,
    playerId,
    teamId: TEAM_ID,
    establishmentKind: 'source-establishment',
    terms: {
      ...makeResultingState().terms,
      contractType: isRookieScale
        ? 'ROOKIE SCALE CONTRACT'
        : 'VETERAN CONTRACT',
      isExtension: false,
      isRookieScale,
      signedUsing: 'Bird Exception',
      signingTeam: TEAM_ID,
      startSeason: salaries[0].season,
      endSeason: TARGET_SEASON,
      contractLength: salaries.length,
      totalValue,
      averageAnnualValue: Math.round(totalValue / salaries.length),
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
        year: TARGET_YEAR,
        capHold: null,
        qualifyingOffer: null,
        earlyTerminationOption: optionType === 'ETO' ? 'ETO' : null,
        hasOption: true,
        optionYear: TARGET_SEASON,
        optionType,
      },
      sourceLimitations: blocked
        ? ['Exact contractual notice deadline is absent.']
        : [],
    },
  });
  const mutableContract = {
    contractType: state.terms.contractType,
    isExtension: false,
    isRookieScale,
    signingTeam: TEAM_ID,
    startSeason: state.terms.startSeason,
    endSeason: state.terms.endSeason,
    contractLength: state.terms.contractLength,
    years: state.terms.contractLength,
    yearsRemaining: state.terms.contractLength,
    totalValue: state.terms.totalValue,
    averageAnnualValue: state.terms.averageAnnualValue,
    guaranteedValue: state.terms.guaranteedValue,
    guaranteedYears: state.terms.guaranteedYears,
    salariesByYear: salaries.map((row) => ({
      season: row.season,
      salary: row.salary,
      capHit: row.capHit,
      guaranteed: row.guaranteed,
      guaranteedAmount: row.guaranteedAmount,
      option: row.option,
      optionUsed: row.optionUsed,
    })),
    birdRights: state.terms.birdRights,
    freeAgency: state.terms.freeAgency,
  };
  const player = {
    id: playerId,
    playerId,
    player_id: playerId,
    name: displayName,
    displayName,
    teamCode: TEAM_ID,
    teamId: TEAM_ID,
    teamName: 'Miami Heat',
    position: 'F',
    age: 28,
    salary: salaries[0].salary,
    currentSalary: salaries[0].salary,
    contract: mutableContract,
    futureContract: null,
    bio: {
      playerId,
      displayName,
      position: 'F',
      age: 28,
      experience: 8,
    },
    source: { provider: 'bze-275-playwright', type: 'governed-fixture' },
  };
  return {
    playerId,
    displayName,
    optionType,
    contractId,
    state,
    player,
    blocked,
  };
};

const seededBasePlayerIds = new Set<string>();
const seededWorldIds = new Set<string>();

const buildSupportPlayer = (worldLabel: string, index: number): RecordLike => {
  const playerId = `bze275_${worldLabel.toLowerCase()}_support_${index}`;
  const displayName = `BZE Support ${worldLabel} ${index}`;
  return {
    id: playerId,
    playerId,
    player_id: playerId,
    name: displayName,
    displayName,
    teamCode: TEAM_ID,
    teamId: TEAM_ID,
    teamName: 'Miami Heat',
    position: 'F',
    age: 25,
    salary: 2_000_000,
    currentSalary: 2_000_000,
    contract: {
      contractType: 'MINIMUM CONTRACT',
      isExtension: false,
      isRookieScale: false,
      signingTeam: TEAM_ID,
      startSeason: CURRENT_SEASON,
      endSeason: TARGET_SEASON,
      contractLength: 2,
      years: 2,
      yearsRemaining: 2,
      totalValue: 4_000_000,
      averageAnnualValue: 2_000_000,
      guaranteedValue: 4_000_000,
      guaranteedYears: 2,
      salariesByYear: [
        {
          season: CURRENT_SEASON,
          salary: 2_000_000,
          capHit: 2_000_000,
          guaranteed: true,
          guaranteedAmount: 2_000_000,
          option: null,
        },
        {
          season: TARGET_SEASON,
          salary: 2_000_000,
          capHit: 2_000_000,
          guaranteed: true,
          guaranteedAmount: 2_000_000,
          option: null,
        },
      ],
      birdRights: { status: 'Non-Bird', eligibleFor: ['Minimum Exception'] },
      freeAgency: { type: 'UFA', year: TARGET_YEAR, capHold: 0 },
    },
    futureContract: null,
    bio: {
      playerId,
      displayName,
      position: 'F',
      age: 25,
      experience: 2,
    },
    source: { provider: 'bze-275-playwright', type: 'support-fixture' },
  };
};

const releaseFor = (
  fixtures: readonly FixturePlayer[]
): ContractSourceRelease => ({
  schemaVersion: 1,
  releaseId: `bze-275-browser-${fixtures[0]?.optionType.toLowerCase() ?? 'fixture'}`,
  releaseVersion: 1,
  releaseDigest:
    'sha256:7777777777777777777777777777777777777777777777777777777777777777',
  supersedes: null,
  effectiveAt: SOURCE_EFFECTIVE_AT,
  salaryCapYear: BASELINE_SALARY_CAP_YEAR,
  source: {
    provider: 'BZE-275 Playwright fixture',
    retainedCorpus:
      'Synthetic complete fixtures; not production source repair.',
    selectionPolicy: 'Only the bounded browser proof records.',
    transformationId: 'bze-275-browser-fixture-v1',
    limitations: [
      'The retained production release remains 0 option-ready / 243 option-blocked.',
    ],
    evidenceCatalog: {
      transformations: [
        {
          id: 'bze-275-browser-fixture-v1',
          description: 'Explicit complete governed option fixture.',
        },
      ],
      limitations: [],
    },
  },
  observations: [],
  records: fixtures.map((fixture) => ({
    contractId: fixture.contractId,
    contractVersion: 1 as const,
    playerId: fixture.playerId,
    teamId: TEAM_ID,
    sourceObservationId: `observation-${fixture.playerId}`,
    sourceContractPath: 'contract' as const,
    resultingState: fixture.state,
  })),
  coverage: {
    sourceObservationCount: fixtures.length,
    uniquePlayerCount: fixtures.length,
    totalSourceContracts: fixtures.length,
    completeRecordIds: fixtures
      .filter((fixture) => !fixture.blocked)
      .map((fixture) => fixture.contractId),
    needsInputRecordIds: fixtures
      .filter((fixture) => fixture.blocked)
      .map((fixture) => fixture.contractId),
    excludedCorruptRecordIds: [],
    missingByCategory: fixtures.some((fixture) => fixture.blocked)
      ? [
          {
            category: 'option-decision-deadline',
            recordIds: fixtures
              .filter((fixture) => fixture.blocked)
              .map((fixture) => fixture.contractId),
          },
        ]
      : [],
    laterRouteReadiness: {
      option: {
        readyRecordIds: fixtures
          .filter((fixture) => !fixture.blocked)
          .map((fixture) => fixture.contractId),
        blockedRecordIds: fixtures
          .filter((fixture) => fixture.blocked)
          .map((fixture) => fixture.contractId),
        missingByCategory: [],
      },
      extension: {
        readyRecordIds: [],
        blockedRecordIds: fixtures.map((fixture) => fixture.contractId),
        missingByCategory: [
          {
            category: 'extension-route-not-in-fixture',
            recordIds: fixtures.map((fixture) => fixture.contractId),
          },
        ],
      },
    },
  },
});

const rightsLedgerFor = (
  worldId: string,
  fixtures: readonly FixturePlayer[]
) => {
  const events = fixtures.map((fixture, index) => {
    const event = makeRightsEstablishedEvent({
      salaryCapYear: TARGET_YEAR,
      eventOverrides: {
        eventId: `rights-established-${fixture.playerId}`,
        worldId,
        teamId: TEAM_ID,
        playerId: fixture.playerId,
        effectiveAt: CONTRACT_ENDS.slice(0, 10),
        executedAt: CONTRACT_ENDS.slice(0, 10),
        recordedAt: `2027-07-01T00:${String(index + 1).padStart(2, '0')}:00-04:00`,
        resultingState: {
          stateId: `rights-ledger:${fixture.playerId}:rights-state`,
          stateVersion: 1,
        },
      },
    });
    return {
      ...event,
      serviceSeasons: event.serviceSeasons.map((season) => ({
        ...season,
        creditedTeamId: season.creditedTeamId === null ? null : TEAM_ID,
        rightsTeamId: TEAM_ID,
      })),
      priorContract: {
        ...event.priorContract,
        contractId: fixture.contractId,
      },
    } as RightsEventRecord;
  });
  return createRightsEventLedger({
    payloadVersion: RIGHTS_EVENT_LEDGER_PAYLOAD_VERSION,
    ledgerId: `${worldId}:${TEAM_ID}:rights`,
    ledgerVersion: 1,
    worldId,
    teamId: TEAM_ID,
    events,
  });
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

const seedOptionWorld = async ({
  userId,
  optionType,
  includeBlocked,
  fixtureOverrides = null,
}: {
  userId: string;
  optionType: OptionType;
  includeBlocked: boolean;
  fixtureOverrides?: readonly FixturePlayer[] | null;
}) => {
  const db = getReviewAdminDb();
  const worldId = `world_bze275_${optionType.toLowerCase()}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  seededWorldIds.add(worldId);
  const actionFixtures = fixtureOverrides
    ? [...fixtureOverrides]
    : [
        buildFixturePlayer({ optionType, suffix: 'Exercise' }),
        buildFixturePlayer({ optionType, suffix: 'Decline' }),
      ];
  const fixtures =
    includeBlocked && !fixtureOverrides
      ? [
          ...actionFixtures,
          buildFixturePlayer({
            optionType,
            suffix: 'Missing Deadline',
            blocked: true,
          }),
        ]
      : actionFixtures;
  const supportCount = 15 - fixtures.length;
  const supportPlayers = Array.from({ length: supportCount }, (_, index) =>
    buildSupportPlayer(optionType, index + 1)
  );
  const players = [
    ...fixtures.map((fixture) => fixture.player),
    ...supportPlayers,
  ];
  const release = releaseFor(fixtures);
  const baselineDocuments = buildContractBaselineTeamDocuments(
    release,
    worldId
  );
  const metadata = contractBaselineMetadata(release);
  const now = admin.firestore.Timestamp.now();
  await db.doc(`architect_worlds/${worldId}`).set({
    worldId,
    worldName: `BZE 275 ${optionType} Review`,
    description: `Governed ${optionType} browser proof.`,
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
    tags: ['review', 'bze-275', optionType],
    isArchived: false,
    isFavorite: false,
    rightsLedgerVersion: 1,
    ...metadata,
    stats: {
      totalTrades: 0,
      totalSignings: 0,
      totalWaives: 0,
      totalRenounces: 0,
      teamsInvolved: 1,
    },
  });
  const team = {
    id: TEAM_ID,
    teamCode: TEAM_ID,
    teamName: 'Miami Heat',
    abbreviation: TEAM_ID,
    season: CURRENT_SEASON,
    players,
    roster: players.map((player) => player.playerId),
    activeContracts: players.map((player) => ({
      name: player.displayName,
      player_id: player.playerId,
      contract: player.contract,
      years: (player.contract as RecordLike).yearsRemaining,
      type: (player.contract as RecordLike).contractType,
      signAndTrade: false,
      guaranteed: true,
    })),
    capHolds: [],
    deadCap: [],
    exceptions: {},
    draftPicks: [],
    entitlementIds: [],
    offerSheets: [],
    incomingOfferSheets: [],
    rightsLedger: rightsLedgerFor(worldId, fixtures),
    contractEventLedgers: [],
    totals: {
      totalSalary: players.reduce(
        (sum, player) => sum + Number(player.currentSalary || 0),
        0
      ),
      rosterCount: players.length,
      isHardCapped: false,
    },
    source: {
      type: 'review-world-bze-275-fixture',
      provider: 'playwright',
      worldId,
    },
  };
  await db.doc(`architect_worlds/${worldId}/teams/${TEAM_ID}`).set(team);
  const playerBatch = db.batch();
  players.forEach((player) => {
    seededBasePlayerIds.add(String(player.playerId));
    playerBatch.set(
      db.doc(`architect_basePlayers/${String(player.playerId)}`),
      player
    );
  });
  await playerBatch.commit();
  await writeBaselineDocuments(worldId, baselineDocuments);
  return { worldId, fixtures };
};

const activateWorld = async (page: Page, userId: string, worldId: string) => {
  await page.evaluate(
    ({ uid, wid }) => {
      window.localStorage.setItem(`architect.activeWorldId.${uid}`, wid);
    },
    { uid: userId, wid: worldId }
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForReviewDashboard(page);
  await expect
    .poll(() => readActiveWorldId(page), { timeout: 20_000 })
    .toBe(worldId);
};

const openTab = async (page: Page, label: string) => {
  const tab = page.getByRole('tab', { name: new RegExp(`^${label}$`, 'i') });
  await expect(tab).toBeVisible({ timeout: 20_000 });
  await tab.click();
};

const playerRow = (page: Page, playerName: string) =>
  page.locator('[data-cap-fit-row]').filter({
    has: page
      .getByTestId('cap-sheet-full-player-row-button')
      .filter({ hasText: playerName }),
  });

const optionCell = (page: Page, playerName: string) =>
  playerRow(page, playerName)
    .locator('[data-action-exposure-classification]')
    .last();

const fillNotice = async (
  modal: Locator,
  notice: {
    deliveredAt?: string;
    leagueReceivedAt?: string;
    forwardedAt?: string;
  } = {}
) => {
  await modal
    .getByTestId('option-notice-delivered-at')
    .fill(notice.deliveredAt ?? DEADLINE);
  await modal
    .getByTestId('option-notice-league-received-at')
    .fill(notice.leagueReceivedAt ?? '2027-06-29T17:01:00-04:00');
  await modal
    .getByTestId('option-notice-pa-forwarded-at')
    .fill(notice.forwardedAt ?? '2027-06-30T09:00:00-04:00');
};

const recordDecision = async ({
  page,
  fixture,
  choice,
  notice,
}: {
  page: Page;
  fixture: FixturePlayer;
  choice: Choice;
  notice?: {
    deliveredAt?: string;
    leagueReceivedAt?: string;
    forwardedAt?: string;
  };
}) => {
  await openTab(page, 'Full Cap Table');
  const cell = optionCell(page, fixture.displayName);
  await expect(cell).toHaveAttribute(
    'data-action-exposure-classification',
    'V1 supported',
    { timeout: 20_000 }
  );
  await cell.click();
  const modal = page.getByTestId('edit-contract-modal');
  await expect(modal).toBeVisible({ timeout: 20_000 });
  const label =
    fixture.optionType === 'ETO'
      ? choice === 'exercise'
        ? 'Exercise ETO'
        : 'Do Not Exercise ETO'
      : choice === 'exercise'
        ? `Exercise ${fixture.optionType === 'TO' ? 'Team' : 'Player'} Option`
        : `Decline ${fixture.optionType === 'TO' ? 'Team' : 'Player'} Option`;
  await modal
    .getByRole('radio', { name: new RegExp(`^${label}`, 'i') })
    .check();
  await fillNotice(modal, notice);
  const confirm = modal.getByTestId('edit-contract-confirm-action-button');
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(modal).toHaveCount(0, { timeout: 25_000 });
  await waitForReviewDashboard(page);
  const endsContract =
    fixture.optionType === 'ETO' ? choice === 'exercise' : choice === 'decline';
  if (endsContract) {
    await expect(playerRow(page, fixture.displayName)).toHaveCount(0, {
      timeout: 20_000,
    });
  } else {
    await expect(optionCell(page, fixture.displayName)).toHaveAttribute(
      'data-action-exposure-classification',
      'recorded',
      { timeout: 20_000 }
    );
  }
};

const capture = async (page: Page, testInfo: TestInfo, label: string) => {
  await page.screenshot({
    path: testInfo.outputPath(`${label}.png`),
    fullPage: true,
  });
};

const worldTeam = async (worldId: string) =>
  getReviewAdminDb()
    .doc(`architect_worlds/${worldId}/teams/${TEAM_ID}`)
    .get()
    .then((snapshot) => snapshot.data() as RecordLike | undefined);

const worldEvents = async (worldId: string) =>
  getReviewAdminDb()
    .collection(`architect_worlds/${worldId}/events`)
    .get()
    .then((snapshot) =>
      snapshot.docs.map((entry) => entry.data() as RecordLike)
    );

const teamPlayerIds = (team: RecordLike | undefined) =>
  (Array.isArray(team?.players) ? team.players : [])
    .map((player) =>
      typeof player === 'object' && player
        ? String(
            (player as RecordLike).playerId ||
              (player as RecordLike).player_id ||
              ''
          )
        : String(player)
    )
    .filter(Boolean);

const contractLedgerEvents = (team: RecordLike | undefined): RecordLike[] => {
  const ledgers = Array.isArray(team?.contractEventLedgers)
    ? team.contractEventLedgers
    : [];
  return ledgers.flatMap((ledgerValue) => {
    if (
      !ledgerValue ||
      typeof ledgerValue !== 'object' ||
      Array.isArray(ledgerValue)
    )
      return [];
    const events = (ledgerValue as RecordLike).events;
    return Array.isArray(events)
      ? events.filter(
          (event): event is RecordLike =>
            Boolean(event) && typeof event === 'object' && !Array.isArray(event)
        )
      : [];
  });
};

const assertAllSurfaces = async ({
  page,
  optionType,
  retained,
  ended,
  worldName,
  expectedEventCount = 2,
}: {
  page: Page;
  optionType: OptionType;
  retained: FixturePlayer;
  ended: FixturePlayer;
  worldName: string;
  expectedEventCount?: number;
}) => {
  await openTab(page, 'Full Cap Table');
  await expect(optionCell(page, retained.displayName)).toHaveAttribute(
    'data-action-exposure-classification',
    'recorded',
    { timeout: 20_000 }
  );
  await expect(playerRow(page, ended.displayName)).toHaveCount(0);

  await openTab(page, 'Roster');
  const roster = page.getByRole('region', { name: /^Roster$/i });
  await expect(
    roster
      .getByRole('button', {
        name: new RegExp(`^${retained.displayName}\\b`, 'i'),
      })
      .first()
  ).toBeVisible();
  await expect(
    roster.getByRole('button', {
      name: new RegExp(`^${ended.displayName}\\b`, 'i'),
    })
  ).toHaveCount(0);

  await openTab(page, 'Cap Sheet');
  await page.getByRole('button', { name: TARGET_SEASON, exact: true }).click();
  const capSheet = page.getByRole('region', { name: /^Cap Sheet$/i });
  await expect(
    capSheet.getByText(retained.displayName, { exact: true }).first()
  ).toBeVisible();
  await capSheet
    .getByRole('button', { name: /Show cap hold details/i })
    .click();
  await expect(
    capSheet.getByText(ended.displayName, { exact: true }).first()
  ).toBeVisible();
  await expect(capSheet).toContainText(/21[,.]?850[,.]?000|21\.85M/i);
  if (optionType === 'ETO') {
    await expect(page.getByText('ETO', { exact: true }).first()).toBeVisible();
  }

  await openTab(page, 'Team History');
  await expect(
    page.getByText(retained.displayName, { exact: false }).first()
  ).toBeVisible();
  await expect(
    page.getByText(ended.displayName, { exact: false }).first()
  ).toBeVisible();

  await openTab(page, 'Compare');
  await expect(page.getByTestId('comparison-event-count')).toContainText(
    new RegExp(`\\b${expectedEventCount}\\s+committed events`, 'i'),
    { timeout: 20_000 }
  );

  const worldTrigger = page.getByTestId('cockpit-world-menu-trigger');
  await expect(worldTrigger).toContainText(worldName);
};

const rewriteWorldIdentity = (
  value: unknown,
  parentWorldId: string,
  childWorldId: string
): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      rewriteWorldIdentity(entry, parentWorldId, childWorldId)
    );
  }
  if (!value || typeof value !== 'object') {
    return typeof value === 'string'
      ? value.split(parentWorldId).join(childWorldId)
      : value;
  }
  if (value instanceof admin.firestore.Timestamp) return value;
  return Object.fromEntries(
    Object.entries(value as RecordLike).map(([key, nested]) => [
      key,
      rewriteWorldIdentity(nested, parentWorldId, childWorldId),
    ])
  );
};

/**
 * Materialize a test-only child for the explicit synthetic contract fixtures.
 * The production branch callable correctly refuses records that do not
 * byte-for-byte match the retained deployment; its rewrite/cleanup behavior
 * remains covered by the BZE-274 browser proof and BZE-275 focused unit proof.
 */
const branchFixtureWorld = async (
  page: Page,
  userId: string,
  parentWorldId: string,
  branchName: string
) => {
  const db = getReviewAdminDb();
  const childWorldId = `world_bze275_branch_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  seededWorldIds.add(childWorldId);
  const parent = await db.doc(`architect_worlds/${parentWorldId}`).get();
  const parentTeam = await db
    .doc(`architect_worlds/${parentWorldId}/teams/${TEAM_ID}`)
    .get();
  const baselines = await db
    .collection(`architect_worlds/${parentWorldId}/contractBaselines`)
    .get();
  const events = await db
    .collection(`architect_worlds/${parentWorldId}/events`)
    .get();
  const playerOverrides = await db
    .collection(`architect_worlds/${parentWorldId}/teams/${TEAM_ID}/players`)
    .get();
  if (!parent.exists || !parentTeam.exists) {
    throw new Error('Synthetic parent world is incomplete.');
  }

  const batch = db.batch();
  const now = admin.firestore.Timestamp.now();
  batch.set(db.doc(`architect_worlds/${childWorldId}`), {
    ...(rewriteWorldIdentity(
      parent.data(),
      parentWorldId,
      childWorldId
    ) as RecordLike),
    worldId: childWorldId,
    worldName: branchName,
    createdBy: userId,
    createdAt: now,
    lastModifiedAt: now,
    parentWorldId,
    branchedFrom: now,
    childWorlds: [],
  });
  batch.update(db.doc(`architect_worlds/${parentWorldId}`), {
    childWorlds: admin.firestore.FieldValue.arrayUnion(childWorldId),
  });
  batch.set(
    db.doc(`architect_worlds/${childWorldId}/teams/${TEAM_ID}`),
    rewriteWorldIdentity(
      parentTeam.data(),
      parentWorldId,
      childWorldId
    ) as RecordLike
  );
  baselines.docs.forEach((snapshot) => {
    const rewritten = rewriteWorldIdentity(
      snapshot.data(),
      parentWorldId,
      childWorldId
    ) as RecordLike;
    const withoutDigest = { ...rewritten };
    delete withoutDigest.documentDigest;
    batch.set(
      db.doc(
        `architect_worlds/${childWorldId}/contractBaselines/${snapshot.id}`
      ),
      {
        ...withoutDigest,
        documentDigest: deterministicStateDigest(withoutDigest),
      }
    );
  });
  events.docs.forEach((snapshot) => {
    batch.set(
      db.doc(`architect_worlds/${childWorldId}/events/${snapshot.id}`),
      rewriteWorldIdentity(
        snapshot.data(),
        parentWorldId,
        childWorldId
      ) as RecordLike
    );
  });
  playerOverrides.docs.forEach((snapshot) => {
    batch.set(
      db.doc(
        `architect_worlds/${childWorldId}/teams/${TEAM_ID}/players/${snapshot.id}`
      ),
      rewriteWorldIdentity(
        snapshot.data(),
        parentWorldId,
        childWorldId
      ) as RecordLike
    );
  });
  await batch.commit();
  await activateWorld(page, userId, childWorldId);
  return childWorldId;
};

test.describe('BZE-275 governed Full Cap Table option/ETO browser proof', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test.beforeEach(async ({ page }) => {
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        !message.text().includes('Failed to load resource')
      ) {
        console.error(`[browser] ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => {
      console.error(`[browser-pageerror] ${error.message}`);
    });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript((flags) => {
      Object.entries(flags).forEach(([key, value]) =>
        window.localStorage.setItem(key, value)
      );
    }, DEV_LOCAL_STORAGE_FLAGS);
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);
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
        'BZE-275 emulator fixture cleanup failed.'
      );
    }
  });

  for (const optionType of ['TO', 'PO', 'ETO'] as const) {
    test(`${optionType} both directions persist, reload, and branch${
      optionType === 'TO' ? '; missing deadline stays unchanged' : ''
    }`, async ({ page }, testInfo) => {
      await expect
        .poll(() => readReviewUserId(page), { timeout: 25_000 })
        .not.toBe('');
      const userId = await readReviewUserId(page);

      const { worldId, fixtures } = await seedOptionWorld({
        userId,
        optionType,
        includeBlocked: optionType === 'TO',
      });
      await activateWorld(page, userId, worldId);
      const worldName = `BZE 275 ${optionType} Review`;
      const exerciseFixture = fixtures.find((fixture) =>
        fixture.displayName.endsWith('Exercise')
      ) as FixturePlayer;
      const declineFixture = fixtures.find((fixture) =>
        fixture.displayName.endsWith('Decline')
      ) as FixturePlayer;
      const blockedFixture = fixtures.find((fixture) => fixture.blocked);

      if (blockedFixture) {
        await openTab(page, 'Full Cap Table');
        const blockedCell = optionCell(page, blockedFixture.displayName);
        await expect(blockedCell).toHaveAttribute(
          'data-action-exposure-classification',
          'Needs input',
          { timeout: 20_000 }
        );
        await expect(blockedCell).toHaveAttribute(
          'data-needs-input-reason',
          /exact contractual notice deadline/i
        );
        const before = JSON.stringify(await worldTeam(worldId));
        await blockedCell.click();
        const modal = page.getByTestId('edit-contract-modal');
        await expect(modal).toContainText(/Needs input/i);
        await expect(modal).toContainText(/exact contractual notice deadline/i);
        await expect(
          modal.getByTestId('edit-contract-confirm-action-button')
        ).toBeDisabled();
        await capture(
          page,
          testInfo,
          'BZE-275-TO-missing-deadline-needs-input'
        );
        await modal.getByRole('button', { name: /^Cancel$/i }).click();
        expect(JSON.stringify(await worldTeam(worldId))).toBe(before);
        expect(await worldEvents(worldId)).toHaveLength(0);
      }

      await recordDecision({
        page,
        fixture: exerciseFixture,
        choice: 'exercise',
      });
      await capture(page, testInfo, `BZE-275-${optionType}-exercise-success`);
      await recordDecision({
        page,
        fixture: declineFixture,
        choice: 'decline',
      });
      await capture(
        page,
        testInfo,
        `BZE-275-${optionType}-${optionType === 'ETO' ? 'non-exercise' : 'decline'}-success`
      );

      const retained = optionType === 'ETO' ? declineFixture : exerciseFixture;
      const ended = optionType === 'ETO' ? exerciseFixture : declineFixture;
      const persisted = await worldTeam(worldId);
      expect(teamPlayerIds(persisted)).toContain(retained.playerId);
      expect(teamPlayerIds(persisted)).not.toContain(ended.playerId);
      expect(await worldEvents(worldId)).toHaveLength(2);
      expect(contractLedgerEvents(persisted)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            worldId,
            playerId: exerciseFixture.playerId,
            eventKind:
              optionType === 'ETO' ? 'eto-exercise' : 'option-exercise',
          }),
          expect.objectContaining({
            worldId,
            playerId: declineFixture.playerId,
            eventKind: optionType === 'ETO' ? 'eto-decline' : 'option-decline',
          }),
        ])
      );
      const capHolds = Array.isArray(persisted?.capHolds)
        ? (persisted?.capHolds as RecordLike[])
        : [];
      expect(capHolds).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            playerId: ended.playerId,
            amount: 21_850_000,
            type: 'Full Bird UFA Amount',
          }),
        ])
      );

      await assertAllSurfaces({
        page,
        optionType,
        retained,
        ended,
        worldName,
      });
      await capture(page, testInfo, `BZE-275-${optionType}-all-surfaces`);

      await openTab(page, 'Roster');
      await openTab(page, 'Full Cap Table');
      await expect(optionCell(page, retained.displayName)).toHaveAttribute(
        'data-action-exposure-classification',
        'recorded'
      );

      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForReviewDashboard(page);
      await expect
        .poll(() => readActiveWorldId(page), { timeout: 20_000 })
        .toBe(worldId);
      await assertAllSurfaces({
        page,
        optionType,
        retained,
        ended,
        worldName,
      });

      const branchName = `BZE 275 ${optionType} Branch`;
      const childWorldId = await branchFixtureWorld(
        page,
        userId,
        worldId,
        branchName
      );
      expect(childWorldId).not.toBe(worldId);
      await waitForReviewDashboard(page);
      await assertAllSurfaces({
        page,
        optionType,
        retained,
        ended,
        worldName: branchName,
      });
      const childTeam = await worldTeam(childWorldId);
      expect(teamPlayerIds(childTeam)).toEqual(teamPlayerIds(persisted));
      expect(contractLedgerEvents(childTeam)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ worldId: childWorldId }),
        ])
      );
      await capture(page, testInfo, `BZE-275-${optionType}-branched-replay`);
    });
  }

  test('CBA2-C24.9 and CBA2-C16.7 repair boundaries persist, reload, and branch', async ({
    page,
  }, testInfo) => {
    await expect
      .poll(() => readReviewUserId(page), { timeout: 25_000 })
      .not.toBe('');
    const userId = await readReviewUserId(page);
    const rfaBefore = buildFixturePlayer({
      optionType: 'TO',
      suffix: 'RFA-Before-Cutoff',
      declineFreeAgencyStatus: 'RFA',
    });
    const rfaExact = buildFixturePlayer({
      optionType: 'TO',
      suffix: 'RFA-Exact-Cutoff',
      declineFreeAgencyStatus: 'RFA',
    });
    const nonRfa = buildFixturePlayer({
      optionType: 'TO',
      suffix: 'Non-RFA-June-29',
      declineFreeAgencyStatus: 'UFA',
    });
    const rookie = buildFixturePlayer({
      optionType: 'TO',
      suffix: 'Rookie-Salary-Only',
      isRookieScale: true,
      optionSalary: 12_000_000,
      optionUnlikelyBonus: 200_000,
    });
    const { worldId } = await seedOptionWorld({
      userId,
      optionType: 'TO',
      includeBlocked: false,
      fixtureOverrides: [rfaBefore, rfaExact, nonRfa, rookie],
    });
    await activateWorld(page, userId, worldId);
    const worldName = 'BZE 275 TO Review';

    await recordDecision({
      page,
      fixture: rfaBefore,
      choice: 'exercise',
      notice: {
        deliveredAt: '2027-06-24T23:59:59.999-04:00',
        leagueReceivedAt: '2027-06-25T00:01:00-04:00',
        forwardedAt: '2027-06-25T09:00:00-04:00',
      },
    });
    await capture(page, testInfo, 'BZE-275-C24-9-before-cutoff-success');

    await openTab(page, 'Full Cap Table');
    const exactCell = optionCell(page, rfaExact.displayName);
    await exactCell.click();
    const exactModal = page.getByTestId('edit-contract-modal');
    await exactModal
      .getByRole('radio', { name: /^Exercise Team Option/i })
      .check();
    await fillNotice(exactModal, {
      deliveredAt: '2027-06-25T00:00:00-04:00',
      leagueReceivedAt: '2027-06-25T00:01:00-04:00',
      forwardedAt: '2027-06-25T09:00:00-04:00',
    });
    const beforeBlockedTeam = JSON.stringify(await worldTeam(worldId));
    const beforeBlockedEvents = JSON.stringify(await worldEvents(worldId));
    await exactModal
      .getByTestId('edit-contract-confirm-action-button')
      .click();
    const exactCutoffAlert = exactModal.getByRole('alert');
    await expect(exactCutoffAlert).toBeVisible();
    await expect(exactCutoffAlert).toContainText(
      /strictly before 2027-06-25T00:00:00-04:00/i
    );
    expect(JSON.stringify(await worldTeam(worldId))).toBe(beforeBlockedTeam);
    expect(JSON.stringify(await worldEvents(worldId))).toBe(
      beforeBlockedEvents
    );
    await exactCutoffAlert.scrollIntoViewIfNeeded();
    await capture(page, testInfo, 'BZE-275-C24-9-exact-cutoff-blocked');
    await exactModal.getByRole('button', { name: /^Cancel$/i }).click();

    await recordDecision({
      page,
      fixture: nonRfa,
      choice: 'exercise',
    });
    await capture(page, testInfo, 'BZE-275-C24-8-non-rfa-success');

    await recordDecision({
      page,
      fixture: rookie,
      choice: 'decline',
      notice: {
        deliveredAt: '2026-11-02T17:00:00-05:00',
        leagueReceivedAt: '2026-11-02T17:01:00-05:00',
        forwardedAt: '2026-11-03T09:00:00-05:00',
      },
    });
    await capture(page, testInfo, 'BZE-275-C16-7-salary-only-success');

    const persisted = await worldTeam(worldId);
    expect(teamPlayerIds(persisted)).toEqual(
      expect.arrayContaining([
        rfaBefore.playerId,
        rfaExact.playerId,
        nonRfa.playerId,
      ])
    );
    expect(teamPlayerIds(persisted)).not.toContain(rookie.playerId);
    expect(contractLedgerEvents(persisted)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          playerId: rfaBefore.playerId,
          executedAt: '2027-06-24T23:59:59.999-04:00',
        }),
        expect.objectContaining({
          playerId: nonRfa.playerId,
          executedAt: DEADLINE,
        }),
        expect.objectContaining({
          playerId: rookie.playerId,
          eventKind: 'option-decline',
        }),
      ])
    );
    const rookieHold = (
      Array.isArray(persisted?.capHolds) ? persisted.capHolds : []
    ).find(
      (hold) =>
        Boolean(hold) &&
        typeof hold === 'object' &&
        !Array.isArray(hold) &&
        (hold as RecordLike).playerId === rookie.playerId
    ) as RecordLike | undefined;
    expect(rookieHold).toMatchObject({
      priorTeamOfferCeiling: 12_000_000,
    });

    await assertAllSurfaces({
      page,
      optionType: 'TO',
      retained: nonRfa,
      ended: rookie,
      worldName,
      expectedEventCount: 3,
    });
    await capture(page, testInfo, 'BZE-275-repair-all-surfaces');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForReviewDashboard(page);
    await assertAllSurfaces({
      page,
      optionType: 'TO',
      retained: nonRfa,
      ended: rookie,
      worldName,
      expectedEventCount: 3,
    });
    const reloaded = await worldTeam(worldId);
    expect(
      (Array.isArray(reloaded?.capHolds) ? reloaded.capHolds : []).find(
        (hold) =>
          Boolean(hold) &&
          typeof hold === 'object' &&
          !Array.isArray(hold) &&
          (hold as RecordLike).playerId === rookie.playerId
      )
    ).toMatchObject({ priorTeamOfferCeiling: 12_000_000 });

    const branchName = 'BZE 275 Repair Branch';
    const childWorldId = await branchFixtureWorld(
      page,
      userId,
      worldId,
      branchName
    );
    await assertAllSurfaces({
      page,
      optionType: 'TO',
      retained: nonRfa,
      ended: rookie,
      worldName: branchName,
      expectedEventCount: 3,
    });
    const childTeam = await worldTeam(childWorldId);
    expect(
      (Array.isArray(childTeam?.capHolds) ? childTeam.capHolds : []).find(
        (hold) =>
          Boolean(hold) &&
          typeof hold === 'object' &&
          !Array.isArray(hold) &&
          (hold as RecordLike).playerId === rookie.playerId
      )
    ).toMatchObject({ priorTeamOfferCeiling: 12_000_000 });
    await capture(page, testInfo, 'BZE-275-repair-branched-replay');
  });
});
