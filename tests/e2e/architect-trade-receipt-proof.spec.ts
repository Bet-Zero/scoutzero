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
import { parsePersistedTradeHardCapLedger } from '@/features/architect/utils/tradeMachine/utils/tradeHardCapLedgerAuthority';
import { SalaryBooksSnapshotZ } from '@/schemas/salaryBooks';
import { PHASE3A_CLOSURE_EXPECTATIONS } from './fixtures/phase3aClosureExpectations';
import {
  buildContractBaselineTeamDocuments,
  contractBaselineMetadata,
} from '@/features/architect/utils/contractSource/contractSourceRelease';
import {
  RETAINED_AUSTIN_MISSING_EVIDENCE,
  RETAINED_AUSTIN_PLAYER_ID,
  RETAINED_AUSTIN_TRADE_KICKER_PERCENT,
  RETAINED_CONTRACT_RELEASE_PATH,
  loadRetainedAustinTradeBonusAuthority,
  type RetainedAustinTradeBonusAuthority,
} from './fixtures/retainedAustinTradeBonusAuthority';

const CANDIDATE = process.env.SCOUTZERO_PROOF_CANDIDATE ?? '';
const ARTIFACT_DIR = process.env.SCOUTZERO_BROWSER_PROOF_DIR ?? '';
const OWNER_REVIEW_MODE = process.env.ARCHITECT_OWNER_REVIEW_MODE === 'true';
const MIA_URL = '/gm/MIA?season=2027';
const DEN_URL = '/gm/DEN?season=2027';
const LAL_URL = '/gm/LAL?season=2027';
const PROOF_WORLD_ID = 'world_trade_receipt_proof';
const RETAINED_TRADE_BONUS_WORLD_ID = 'world_retained_trade_bonus_proof';
const PROOF_WORLD_NAME = OWNER_REVIEW_MODE
  ? 'Miami 2026-27 Plan'
  : 'Trade Receipt Proof';
const RETAINED_TRADE_BONUS_WORLD_NAME = OWNER_REVIEW_MODE
  ? 'Lakers 2026-27 Contract Review'
  : 'Retained Austin Trade Bonus Proof';
const CHILD_WORLD_NAME = OWNER_REVIEW_MODE
  ? 'Miami 2027-28 Plan'
  : 'Trade Receipt Proof Child';
const GRANDCHILD_WORLD_NAME = OWNER_REVIEW_MODE
  ? 'Miami 2028-29 Plan'
  : 'Trade Receipt Proof Grandchild';
const PROOF_AS_OF_DATE = '2026-07-07';
const EMPTY_RELEASE_DIGEST = `sha256:${'3'.repeat(64)}`;
const ZERO_YOS_MINIMUM =
  PHASE3A_CLOSURE_EXPECTATIONS.season2026_27.zeroYearsOfServiceMinimum;
const FIRST_ROUND_PROOF_ENTITLEMENT_ID =
  'proof-entitlement-MIA-2027-first-round';
const SECOND_ROUND_PROOF_ENTITLEMENT_ID =
  'proof-entitlement-MIA-2027-second-round';
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

const OWNER_DEPTH_NAMES = {
  MIA: {
    standard: [
      'Caleb Foster',
      'Julian Mercer',
      'Darius Sloan',
      'Micah Turner',
      'Jonah Pierce',
    ],
    twoWay: ['Noah Hayes', 'Trevor Banks', 'Malik Dawson'],
  },
  DEN: {
    standard: [
      'Evan Brooks',
      'Jordan Price',
      'Cameron Ellis',
      'Adrian Wells',
      'Xavier Monroe',
    ],
    twoWay: ['Nolan Grant', 'Isaac Rhodes', 'Miles Carter'],
  },
} as const;

const buildProofDepthPlayer = (
  teamCode: 'MIA' | 'DEN',
  ordinal: number,
  isTwoWay = false
) => {
  const suffix = isTwoWay ? `two_way_${ordinal}` : `depth_${ordinal}`;
  const playerId = `proof_${teamCode.toLowerCase()}_${suffix}`;
  const displayName = OWNER_REVIEW_MODE
    ? OWNER_DEPTH_NAMES[teamCode][isTwoWay ? 'twoWay' : 'standard'][
        ordinal - 1
      ] || `${teamCode} Player ${ordinal}`
    : `${teamCode} Proof ${isTwoWay ? 'Two-Way' : 'Depth'} ${ordinal}`;
  const salary = isTwoWay ? 578_577 : 2_000_000;
  return {
    id: playerId,
    playerId,
    player_id: playerId,
    name: displayName,
    displayName,
    position: isTwoWay ? 'G' : 'F',
    age: isTwoWay ? 22 : 25,
    teamCode,
    teamId: teamCode,
    teamName: teamCode === 'MIA' ? 'Miami Heat' : 'Denver Nuggets',
    isTwoWay,
    bio: {
      playerId,
      displayName,
      position: isTwoWay ? 'G' : 'F',
      height: isTwoWay ? '6-4' : '6-7',
      weight: isTwoWay ? '190' : '220',
      age: isTwoWay ? 22 : 25,
      experience: isTwoWay ? 0 : 1,
    },
    contract: {
      contractType: isTwoWay ? 'TWO-WAY' : 'MINIMUM CONTRACT',
      isTwoWay,
      isExtension: false,
      isRookieScale: false,
      startSeason: '2026-27',
      endSeason: '2027-28',
      contractLength: 2,
      yearsRemaining: 2,
      totalValue: salary * 2,
      averageAnnualValue: salary,
      guaranteedValue: isTwoWay ? 0 : salary * 2,
      guaranteedYears: isTwoWay ? 0 : 2,
      salariesByYear: [
        {
          season: '2026-27',
          salary,
          capHit: salary,
          guaranteed: !isTwoWay,
          option: null,
        },
        {
          season: '2027-28',
          salary,
          capHit: salary,
          guaranteed: !isTwoWay,
          option: null,
        },
      ],
      noTradeClause: false,
      tradeKicker: null,
      birdRights: {
        status: 'Non-Bird',
        eligibleFor: isTwoWay ? [] : ['Minimum Exception'],
      },
      freeAgency: { type: isTwoWay ? 'RFA' : 'UFA', year: 2028, capHold: 0 },
    },
  };
};

const buildProofRoster = async (teamCode: 'MIA' | 'DEN') => {
  const db = getReviewAdminDb();
  const basePlayers = await Promise.all(
    PROOF_ROSTERS[teamCode].map(async (playerId) => {
      const snapshot = await db.doc(`architect_basePlayers/${playerId}`).get();
      expect(snapshot.exists).toBe(true);
      const source = snapshot.data() ?? {};
      const displayName = String(source.displayName || source.name || playerId);
      return {
        ...source,
        id: playerId,
        playerId,
        player_id: playerId,
        name: displayName,
        displayName,
      };
    })
  );
  const twoWayCount = basePlayers.filter((player) =>
    String(
      (
        (player as Record<string, unknown>).contract as
          | Record<string, unknown>
          | undefined
      )?.contractType ?? ''
    )
      .toLowerCase()
      .includes('two-way')
  ).length;
  const standardCount = basePlayers.length - twoWayCount;
  const players = [
    ...basePlayers,
    ...Array.from(
      {
        length: PHASE3A_CLOSURE_EXPECTATIONS.roster.standard - standardCount,
      },
      (_, index) => buildProofDepthPlayer(teamCode, index + 1)
    ),
    ...Array.from(
      {
        length: PHASE3A_CLOSURE_EXPECTATIONS.roster.twoWay - twoWayCount,
      },
      (_, index) => buildProofDepthPlayer(teamCode, index + 1, true)
    ),
  ];
  expect(players).toHaveLength(
    PHASE3A_CLOSURE_EXPECTATIONS.roster.standard +
      PHASE3A_CLOSURE_EXPECTATIONS.roster.twoWay
  );
  return {
    players,
    roster: players.map((player) => String(player.playerId || player.id)),
  };
};

const proofTpe = (teamCode: 'MIA' | 'DEN') => ({
  id: `proof-tpe-${teamCode}`,
  name: OWNER_REVIEW_MODE
    ? `${teamCode === 'MIA' ? 'Miami' : 'Denver'} 2026 Trade Exception`
    : `${teamCode} governed proof TPE`,
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
      ]
    : [
        proofContractLedger('DEN', 'den_aaron_pike', 3_200_000),
        proofContractLedger('DEN', 'den_reggie_voss', 2_000_000),
      ];

const salaryBookInputs = (teamCode: string) => {
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
      lineItems: Array.from({ length: 10 }, (_, index) => ({
        ...line(
          'apron-team-salary',
          `CBA2-C07.${index + 2}`,
          '2026-07-01T00:00:00Z'
        ),
        amount: index === 0 ? (teamCode === 'MIA' ? 20_000_000 : 0) : 0,
      })),
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
test.setTimeout(480_000);

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const worldCount = async () =>
  getReviewAdminDb()
    .collection('architect_worlds')
    .get()
    .then((snapshot) => snapshot.size);

const proofWorldExists = async () =>
  getReviewAdminDb()
    .doc(`architect_worlds/${PROOF_WORLD_ID}`)
    .get()
    .then((snapshot) => snapshot.exists);

const resetProofWorld = async () => {
  const db = getReviewAdminDb();
  await db.recursiveDelete(db.doc(`architect_worlds/${PROOF_WORLD_ID}`));
};

const resetRetainedTradeBonusWorld = async () => {
  const db = getReviewAdminDb();
  await db.recursiveDelete(
    db.doc(`architect_worlds/${RETAINED_TRADE_BONUS_WORLD_ID}`)
  );
};

const seedRetainedTradeBonusWorld = async (
  uid: string,
  retainedAuthority: RetainedAustinTradeBonusAuthority
) => {
  const db = getReviewAdminDb();
  const now = new Date();
  const baselineDocuments = buildContractBaselineTeamDocuments(
    retainedAuthority.release,
    RETAINED_TRADE_BONUS_WORLD_ID
  );
  const baselineMetadata = contractBaselineMetadata(retainedAuthority.release);
  await db.doc(`architect_worlds/${RETAINED_TRADE_BONUS_WORLD_ID}`).set({
    worldId: RETAINED_TRADE_BONUS_WORLD_ID,
    worldName: RETAINED_TRADE_BONUS_WORLD_NAME,
    description:
      'Authenticated retained-source Austin Reaves trade-bonus proof world.',
    createdBy: uid,
    createdAt: now,
    lastModifiedAt: now,
    currentSeason: '2026-27',
    baselineSeason: '2025-26',
    asOfDate: PROOF_AS_OF_DATE,
    parentWorldId: null,
    isArchived: false,
    ...baselineMetadata,
  });

  const batch = db.batch();
  for (const teamCode of ['LAL', 'DEN'] as const) {
    const base = await db.doc(`architect_baseTeams/${teamCode}`).get();
    expect(base.exists).toBe(true);
    const baseData = base.data() ?? {};
    const proofRoster =
      teamCode === 'LAL'
        ? {
            players: [retainedAuthority.player],
            roster: [RETAINED_AUSTIN_PLAYER_ID],
          }
        : { players: [], roster: [] };
    const baseExceptions =
      baseData.exceptions && typeof baseData.exceptions === 'object'
        ? baseData.exceptions
        : {};
    batch.set(
      db.doc(
        `architect_worlds/${RETAINED_TRADE_BONUS_WORLD_ID}/teams/${teamCode}`
      ),
      {
        ...baseData,
        id: teamCode,
        teamId: teamCode,
        teamCode,
        roster: proofRoster.roster,
        players: proofRoster.players,
        entitlementIds: [],
        capHolds: [],
        offerSheets: [],
        salaryBookInputs: salaryBookInputs(teamCode),
        contractEventLedgers: [],
        cashLedger: {
          ledgerVersion: 0,
          ledgerId: `cash-ledger:${teamCode}`,
          teamId: teamCode,
          entries: [],
        },
        exceptions: { ...baseExceptions, tpe: [] },
      }
    );
  }
  for (const document of baselineDocuments) {
    batch.set(
      db.doc(
        `architect_worlds/${RETAINED_TRADE_BONUS_WORLD_ID}/contractBaselines/${document.shardId}`
      ),
      document
    );
  }
  await batch.commit();
  return {
    documentCount: baselineDocuments.length,
    ledgerCount: baselineDocuments.reduce(
      (count, document) => count + document.ledgers.length,
      0
    ),
    austinTeamDocumentCount: baselineDocuments.filter(
      (document) => document.teamId === 'LAL'
    ).length,
  };
};

const seedProofWorld = async (uid: string) => {
  const db = getReviewAdminDb();
  const now = new Date();
  await db.doc(`architect_worlds/${PROOF_WORLD_ID}`).set({
    worldId: PROOF_WORLD_ID,
    worldName: PROOF_WORLD_NAME,
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
    const proofRoster = await buildProofRoster(teamCode);
    const baseExceptions =
      baseData.exceptions && typeof baseData.exceptions === 'object'
        ? baseData.exceptions
        : {};
    batch.set(db.doc(`architect_worlds/${PROOF_WORLD_ID}/teams/${teamCode}`), {
      ...baseData,
      id: teamCode,
      teamId: teamCode,
      teamCode,
      roster: proofRoster.roster,
      players: proofRoster.players,
      entitlementIds:
        teamCode === 'MIA'
          ? [
              FIRST_ROUND_PROOF_ENTITLEMENT_ID,
              SECOND_ROUND_PROOF_ENTITLEMENT_ID,
            ]
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
      exceptions: { ...baseExceptions, tpe: [proofTpe(teamCode)] },
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
  batch.set(
    db.doc(
      `architect_worlds/${PROOF_WORLD_ID}/entitlements/${SECOND_ROUND_PROOF_ENTITLEMENT_ID}`
    ),
    {
      id: SECOND_ROUND_PROOF_ENTITLEMENT_ID,
      entitlementId: SECOND_ROUND_PROOF_ENTITLEMENT_ID,
      holderTeam: 'MIA',
      originalTeam: 'MIA',
      seasonYear: 2027,
      year: 2027,
      round: 2,
      kind: 'pick_ownership',
      description: 'MIA own 2027 second-round pick',
      underlyingPickId: 'MIA_2027_2',
      underlyingStatus: 'clean',
    }
  );
  await batch.commit();
};

const prepareReviewUser = async (page: Page) => {
  await page.goto(MIA_URL, { waitUntil: 'domcontentloaded' });
  await expect
    .poll(() => readReviewUserId(page), {
      timeout: 30_000,
      message: 'review-mode anonymous authentication should become available',
    })
    .not.toBe('');
  return readReviewUserId(page);
};

const prepareProofWorld = async (page: Page) => {
  const uid = await prepareReviewUser(page);
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
  return uid;
};

const seedInheritedProofWorld = async ({
  childWorldId,
  childWorldName,
  parentWorldId,
}: {
  childWorldId: string;
  childWorldName: string;
  parentWorldId: string;
}) => {
  const db = getReviewAdminDb();
  const [parentMetadata, parentMia, parentDen] = await Promise.all([
    db.doc(`architect_worlds/${parentWorldId}`).get(),
    getWorldTeamDocument(parentWorldId, 'MIA'),
    getWorldTeamDocument(parentWorldId, 'DEN'),
  ]);
  expect(parentMetadata.exists).toBe(true);
  expect(parentMia).not.toBeNull();
  expect(parentDen).not.toBeNull();
  const now = new Date();
  const childTeam = (team: Record<string, unknown> | null) => ({
    ...team,
    ...(team?.source && typeof team.source === 'object'
      ? { source: { ...team.source, worldId: childWorldId } }
      : {}),
  });
  const batch = db.batch();
  batch.set(db.doc(`architect_worlds/${childWorldId}`), {
    ...parentMetadata.data(),
    worldId: childWorldId,
    worldName: childWorldName,
    description: 'Deterministic inherited-world browser fixture.',
    createdAt: now,
    lastModifiedAt: now,
    parentWorldId,
    branchedFrom: now,
    childWorlds: [],
  });
  batch.set(
    db.doc(`architect_worlds/${childWorldId}/teams/MIA`),
    childTeam(parentMia)
  );
  batch.set(
    db.doc(`architect_worlds/${childWorldId}/teams/DEN`),
    childTeam(parentDen)
  );
  await batch.commit();
};

const activateProofWorld = async (page: Page, uid: string, worldId: string) => {
  await page.evaluate(
    ({ storageKey, nextWorldId }) => {
      window.localStorage.setItem(storageKey, nextWorldId);
    },
    {
      storageKey: `architect.activeWorldId.${uid}`,
      nextWorldId: worldId,
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

const openTradeMachine = async (
  page: Page,
  route = MIA_URL,
  worldName = PROOF_WORLD_NAME
) => {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
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
          'review dashboard should finish emulator authentication and fixture loading',
      }
    )
    .toMatchObject({ isReady: true });
  await expect(noTeamData).toHaveCount(0);
  await expect(page.getByText(worldName, { exact: true }).first()).toBeVisible({
    timeout: 90_000,
  });
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
  if (!(await isVisible(menu))) {
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
  await card.getByRole('button', { name: /^(Picks|Pck)( \(\d+\))?$/i }).click();
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
    throw new Error(
      `${expected.teamCode} salary books did not persist complete.`
    );
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
    amount: amount === 0 ? 0 : -amount,
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
  const retainedAuthority = await loadRetainedAustinTradeBonusAuthority();
  expect(retainedAuthority.artifactSha256).toBe(
    'sha256:23304518f145babfe19ab5341fc60449f39bbfa2b06ad3ce15ef3b3159b91389'
  );
  expect(retainedAuthority.release).toMatchObject({
    releaseId: 'salaryswish-retained-2026-06-05',
    releaseVersion: 1,
    releaseDigest:
      'sha256:46db3137308ff1c05e0066edf09ef08d45b92353bea7a2bcec93fd408adf5950',
  });
  expect(retainedAuthority.tradeKickerPercent).toBe(
    RETAINED_AUSTIN_TRADE_KICKER_PERCENT
  );
  expect(retainedAuthority.missingEvidence).toBe(
    RETAINED_AUSTIN_MISSING_EVIDENCE
  );

  await page.addInitScript((ownerReviewMode) => {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('hz.dev.'))
      .forEach((key) => window.localStorage.removeItem(key));
    if (!ownerReviewMode) {
      window.localStorage.setItem('hz.dev.tradeMachineDebug', 'true');
      window.localStorage.setItem('hz.dev.teamHistoryFixtures', 'true');
    }
  }, OWNER_REVIEW_MODE);

  await resetProofWorld();
  await resetRetainedTradeBonusWorld();
  expect(await proofWorldExists()).toBe(false);
  expect(await worldCount()).toBe(0);
  const authenticatedUid = await prepareReviewUser(page);
  const retainedBaseline = await seedRetainedTradeBonusWorld(
    authenticatedUid,
    retainedAuthority
  );
  await activateProofWorld(
    page,
    authenticatedUid,
    RETAINED_TRADE_BONUS_WORLD_ID
  );
  expect(await worldCount()).toBe(1);
  const retainedDialog = await openTradeMachine(
    page,
    LAL_URL,
    RETAINED_TRADE_BONUS_WORLD_NAME
  );
  await expect(
    retainedDialog.getByRole('button', { name: /Los Angeles Lakers/i })
  ).toBeVisible({ timeout: 30_000 });
  const retainedTeamPicker = retainedDialog
    .locator('label', { hasText: /^Select Team$/i })
    .locator('xpath=following-sibling::select[1]');
  if ((await retainedTeamPicker.count()) === 0) {
    await retainedDialog.getByRole('button', { name: /^Add Team$/i }).click();
  }
  await retainedDialog
    .locator('label', { hasText: /^Select Team$/i })
    .locator('xpath=following-sibling::select[1]')
    .first()
    .selectOption('nuggets');
  const retainedLakersCard = teamCard(retainedDialog, 'LAL');
  const retainedDenverCard = teamCard(retainedDialog, 'DEN');
  await electSalaryPath(retainedLakersCard, 'STANDARD_TPE');
  await electSalaryPath(retainedDenverCard, 'STANDARD_TPE');
  await fillPostAssignmentApronSalary(retainedLakersCard);
  await fillPostAssignmentApronSalary(retainedDenverCard);
  const bonusAuthorityBefore = {
    teams: await Promise.all(
      ['LAL', 'DEN'].map((teamCode) =>
        getReviewAdminDb()
          .doc(
            `architect_worlds/${RETAINED_TRADE_BONUS_WORLD_ID}/teams/${teamCode}`
          )
          .get()
          .then((snapshot) => snapshot.data())
      )
    ),
    events: await getWorldEventDocuments(RETAINED_TRADE_BONUS_WORLD_ID),
  };
  const retainedAustinDisplayName = String(
    retainedAuthority.player.displayName
  );
  await routePlayer(
    retainedDialog,
    page,
    'LAL',
    retainedAustinDisplayName,
    'Denver Nuggets'
  );
  await retainedDialog
    .getByRole('button', { name: /^Validate Trade$/i })
    .click();
  const retainedReadiness = retainedDialog.getByTestId(
    'trade-readiness-summary'
  );
  await expect(retainedReadiness).toContainText('Needs input', {
    timeout: 20_000,
  });
  const retainedTradeBonusUiReason = `${retainedAustinDisplayName}: Available contract information is insufficient to determine the trade-bonus allocation.`;
  await expect(retainedReadiness).toContainText(retainedTradeBonusUiReason);
  await expect(retainedReadiness).not.toContainText('Not validated');
  const retainedApplyTradeButton = retainedDialog.getByRole('button', {
    name: /^Apply Trade$/i,
  });
  const retainedTradeSummaryButton = retainedDialog.getByTestId(
    'trade-summary-button'
  );
  await expect(retainedApplyTradeButton).toBeDisabled();
  await expect(retainedTradeSummaryButton).toBeDisabled();
  const retainedTradeBonusReadinessText = (
    await retainedReadiness.innerText()
  ).trim();
  const retainedTradeBonusUiVerdict =
    retainedTradeBonusReadinessText.match(/needs input/i)?.[0] ?? '';
  expect(retainedTradeBonusUiVerdict.toLowerCase()).toBe('needs input');
  expect(retainedTradeBonusReadinessText).toContain(retainedTradeBonusUiReason);
  expect(retainedTradeBonusReadinessText).not.toContain('governed tranche');
  const retainedTradeBonusApplyBlocked =
    await retainedApplyTradeButton.isDisabled();
  const retainedTradeBonusSummaryBlocked =
    await retainedTradeSummaryButton.isDisabled();
  const tradeBonusNeedsInputScreenshotPath = path.join(
    ARTIFACT_DIR,
    'trade-bonus-needs-input-1280x720.png'
  );
  await retainedReadiness.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: tradeBonusNeedsInputScreenshotPath,
    fullPage: false,
  });
  const bonusTeamsAfter = await Promise.all(
    ['LAL', 'DEN'].map((teamCode) =>
      getReviewAdminDb()
        .doc(
          `architect_worlds/${RETAINED_TRADE_BONUS_WORLD_ID}/teams/${teamCode}`
        )
        .get()
        .then((snapshot) => snapshot.data())
    )
  );
  const bonusEventsAfter = await getWorldEventDocuments(
    RETAINED_TRADE_BONUS_WORLD_ID
  );
  expect(bonusTeamsAfter).toEqual(bonusAuthorityBefore.teams);
  expect(bonusEventsAfter).toEqual(bonusAuthorityBefore.events);
  await cancelPlayerTrade(retainedDialog, 'LAL', retainedAustinDisplayName);
  await resetRetainedTradeBonusWorld();
  expect(await worldCount()).toBe(0);

  const uid = await prepareProofWorld(page);
  expect(uid).toBe(authenticatedUid);
  expect(await proofWorldExists()).toBe(true);
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
      proofTeamRefs.map((ref) => ref.get().then((snapshot) => snapshot.data()))
    ),
    events: await getWorldEventDocuments(PROOF_WORLD_ID),
  };
  await routeEntitlement(miamiCard, page, 2027, 1, 'Denver Nuggets');
  await dialog.getByRole('button', { name: /^Validate Trade$/i }).click();
  const readiness = dialog.getByTestId('trade-readiness-summary');
  await expect(readiness).toContainText('Needs input', { timeout: 20_000 });
  await expect(readiness).toContainText(
    'Stepien eligibility cannot be confirmed because complete pick ownership, protection and conveyance terms, trading restrictions and their release, and penalty history are unavailable'
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
      proofTeamRefs.map((ref) => ref.get().then((snapshot) => snapshot.data()))
    )
  ).toEqual(draftAuthorityBefore.teams);
  expect(await getWorldEventDocuments(PROOF_WORLD_ID)).toEqual(
    draftAuthorityBefore.events
  );

  await cancelEntitlementTrade(miamiCard, page, 2027, 1);

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
  expect(governedPostSalaries.MIA).toBeGreaterThan(
    PHASE3A_CLOSURE_EXPECTATIONS.trade.firstApron
  );
  expect(governedPostSalaries.DEN).toBeGreaterThan(
    PHASE3A_CLOSURE_EXPECTATIONS.trade.firstApron
  );
  expect(governedPostSalaries.MIA).toBeLessThanOrEqual(
    PHASE3A_CLOSURE_EXPECTATIONS.trade.secondApron
  );
  expect(governedPostSalaries.DEN).toBeLessThanOrEqual(
    PHASE3A_CLOSURE_EXPECTATIONS.trade.secondApron
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

  const receipt = dialog.getByTestId('section-trade-receipt');
  const screenshotPath = path.join(ARTIFACT_DIR, 'trade-receipt-1280x720.png');
  if (OWNER_REVIEW_MODE) {
    await expect(receipt).toHaveCount(0);
    await expect(readiness).toContainText('Trade blocked');
    await expect(readiness).toContainText(
      'Transaction Restrictions Table Row F prohibits this trade'
    );
    await expect(readiness).not.toContainText(
      /Local checks|duplicate-player|pick-conflict|exclusivity|governed input|generic matching estimate/i
    );
    await readiness.scrollIntoViewIfNeeded();
    await page.screenshot({ path: screenshotPath, fullPage: false });
  } else {
    const developmentTools = dialog.getByRole('button', {
      name: /Development Tools/i,
    });
    await expect(developmentTools).toBeVisible();
    await developmentTools.click();

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
    await expect(heatApronProof).toContainText(
      'Controlling First Apron ceiling'
    );
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

    const nuggetsApronProof = receipt.getByTestId(
      'trade-apron-restriction-DEN'
    );
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
    const nuggetsCashProof = receipt.getByTestId(
      'trade-cash-consideration-den'
    );
    await expect(nuggetsCashProof).toBeVisible();
    await expect(nuggetsCashProof).toContainText('PASS');
    await expect(nuggetsCashProof).toContainText('Received now');
    await expect(nuggetsCashProof).toContainText('$1.00');
  }

  const afterValidationTeams = await Promise.all(
    proofTeamRefs.map((ref) => ref.get().then((snapshot) => snapshot.data()))
  );
  expect(afterValidationTeams).toEqual(beforeValidationTeams);
  expect(await proofWorldExists()).toBe(true);
  expect(pageErrors).toEqual([]);
  if (!OWNER_REVIEW_MODE) {
    await receipt
      .getByTestId('trade-apron-restriction-MIA')
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: screenshotPath, fullPage: false });
  }

  if (!OWNER_REVIEW_MODE) {
    await receipt.getByRole('button', { name: 'Hide Details' }).click();
  }
  await cancelPlayerTrade(dialog, 'MIA', 'Eli Navarro');
  await cancelPlayerTrade(dialog, 'DEN', 'Reggie Voss');
  await routeEntitlement(miamiCard, page, 2027, 2, 'Denver Nuggets');
  await electSalaryPath(miamiCard, 'STANDARD_TPE');
  await electSalaryPath(denverCard, 'STANDARD_TPE');
  await miamiCard
    .getByLabel('Aaron Pike absorption mode')
    .selectOption('MATCH');
  await denverCard
    .getByLabel('Owen Frost absorption mode')
    .selectOption('MATCH');

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
  await expect(readiness).toContainText('Ready to apply', {
    timeout: 20_000,
  });
  const applyTrade = dialog.getByRole('button', { name: /^Apply Trade$/i });
  await expect(applyTrade).toBeEnabled();
  const legalScreenshotPath = path.join(
    ARTIFACT_DIR,
    'trade-cash-legal-1280x720.png'
  );
  if (OWNER_REVIEW_MODE) {
    await expect(readiness).toContainText('Ready to apply');
    await expect(readiness).toContainText(
      'Final roster and draft-asset checks run when you apply it'
    );
    await expect(readiness).not.toContainText(
      /Local checks|duplicate-player|pick-conflict|exclusivity|governed input|generic matching estimate/i
    );
    await readiness.scrollIntoViewIfNeeded();
    await page.screenshot({ path: legalScreenshotPath, fullPage: false });
  } else {
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
    await expect(
      receipt.getByTestId('trade-cash-consideration-mia')
    ).toContainText('$1.00');
    await legalHeatApronProof.scrollIntoViewIfNeeded();
    await page.screenshot({ path: legalScreenshotPath, fullPage: false });
    await receipt.getByRole('button', { name: 'Hide Details' }).click();
  }

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
  if (!miaAfterApply || !denAfterApply) {
    throw new Error(
      'Expected both persisted Team snapshots after trade apply.'
    );
  }
  const secondRoundAfterApply = await getReviewAdminDb()
    .doc(
      `architect_worlds/${PROOF_WORLD_ID}/entitlements/${SECOND_ROUND_PROOF_ENTITLEMENT_ID}`
    )
    .get()
    .then((snapshot) => snapshot.data());
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
  expect(secondRoundAfterApply).toMatchObject({ holderTeam: 'DEN' });
  expect(miaAfterApply?.entitlementIds).not.toContain(
    SECOND_ROUND_PROOF_ENTITLEMENT_ID
  );
  expect(denAfterApply?.entitlementIds).toContain(
    SECOND_ROUND_PROOF_ENTITLEMENT_ID
  );
  const persistedIncompleteRosterCharges = {
    MIA: assertPersistedIncompleteRosterBooks(miaAfterApply, {
      teamCode: 'MIA',
      count: PHASE3A_CLOSURE_EXPECTATIONS.roster.standard,
      missingSlots: 0,
    }),
    DEN: assertPersistedIncompleteRosterBooks(denAfterApply, {
      teamCode: 'DEN',
      count: PHASE3A_CLOSURE_EXPECTATIONS.roster.standard,
      missingSlots: 0,
    }),
  };
  const structurallyValidHardCapLedger = TradeHardCapLedgerZ.parse(
    miaAfterApply?.hardCapLedger
  );
  expect(structurallyValidHardCapLedger).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        restrictionRow: 'I',
        transactionId: miaLedger.entries[0].transactionId,
      }),
    ])
  );
  expect(
    parsePersistedTradeHardCapLedger(miaAfterApply?.hardCapLedger, {
      containingTeamCode: 'MIA',
      worldLineage: [PROOF_WORLD_ID],
      cashLedger: miaAfterApply?.cashLedger,
    })
  ).toEqual({ entries: structurallyValidHardCapLedger, valid: true });
  const eventMetadata: Record<string, unknown> =
    tradeEvent?.metadata && typeof tradeEvent.metadata === 'object'
      ? (tradeEvent.metadata as Record<string, unknown>)
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
  const proofWorldExistsAfterApply = await proofWorldExists();
  expect(proofWorldExistsAfterApply).toBe(true);

  await page.goto(MIA_URL, { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByText(PROOF_WORLD_NAME, { exact: true }).first()
  ).toBeVisible({ timeout: 90_000 });
  await openDashboardTab(page, 'Cap Sheet');
  await page.getByTestId('cap-sheet-exceptions-toggle').click();
  const hardCapBanner = page.getByTestId(
    'cap-sheet-current-season-authority-banner'
  );
  await expect(hardCapBanner).toContainText('Hard Capped');
  await expect(hardCapBanner).toContainText('2nd Apron');
  await expect(hardCapBanner).toContainText(
    'Transaction Restrictions Table Row I hard cap for Salary Cap Year 2027.'
  );
  await expect(hardCapBanner).not.toContainText(
    'malformed or version-incompatible'
  );
  await expect(hardCapBanner).not.toContainText('fail-closed');
  const incompleteRosterRow = page.getByTestId('incomplete-roster-charge-row');
  await expect(incompleteRosterRow).toHaveCount(0);
  await expect(page.getByTestId('cockpit-status-roster-value')).toHaveText(
    '15 / 15 · 3 / 3'
  );
  const fullRosterBooksScreenshotPath = path.join(
    ARTIFACT_DIR,
    'full-roster-books-reload-1280x720.png'
  );
  await page.screenshot({
    path: fullRosterBooksScreenshotPath,
    fullPage: false,
  });

  const miaHardCapLedgerBytes = JSON.stringify(miaAfterApply.hardCapLedger);
  const miaCashLedgerBytes = JSON.stringify(miaAfterApply.cashLedger);
  const denCashLedgerBytes = JSON.stringify(denAfterApply.cashLedger);
  const denTeamRef = getReviewAdminDb().doc(
    `architect_worlds/${PROOF_WORLD_ID}/teams/DEN`
  );
  const foreignLedgerScreenshotPath = path.join(
    ARTIFACT_DIR,
    'foreign-hard-cap-ledger-fail-closed-1280x720.png'
  );
  try {
    await denTeamRef.set({
      ...denAfterApply,
      hardCapLedger: JSON.parse(miaHardCapLedgerBytes),
    });
    await page.evaluate((route) => {
      window.history.pushState({}, '', route);
      window.dispatchEvent(
        new PopStateEvent('popstate', { state: window.history.state })
      );
    }, DEN_URL);
    await expect(
      page
        .getByText(
          /Persisted hard-cap ledger is malformed or version-incompatible|NO TEAM DATA/
        )
        .first()
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByText(/Transaction Restrictions Table Row I/)
    ).toHaveCount(0);
    await page.screenshot({
      path: foreignLedgerScreenshotPath,
      fullPage: false,
    });
    expect(
      JSON.stringify(
        (await getWorldTeamDocument(PROOF_WORLD_ID, 'MIA'))?.hardCapLedger
      )
    ).toBe(miaHardCapLedgerBytes);
    expect(
      JSON.stringify(
        (await getWorldTeamDocument(PROOF_WORLD_ID, 'MIA'))?.cashLedger
      )
    ).toBe(miaCashLedgerBytes);
    expect(
      JSON.stringify(
        (await getWorldTeamDocument(PROOF_WORLD_ID, 'DEN'))?.cashLedger
      )
    ).toBe(denCashLedgerBytes);
  } finally {
    await denTeamRef.set(denAfterApply);
  }
  expect(await getWorldTeamDocument(PROOF_WORLD_ID, 'DEN')).toEqual(
    denAfterApply
  );

  await page.goto(MIA_URL, { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByText(PROOF_WORLD_NAME, { exact: true }).first()
  ).toBeVisible({ timeout: 90_000 });
  await openDashboardTab(page, 'Team History');
  const historyTimeline = page.getByTestId('team-history-section-timeline');
  const tradeHistoryRow = historyTimeline.getByRole('button', {
    name: OWNER_REVIEW_MODE
      ? /Trade Executed: Miami Heat ↔ Denver Nuggets/i
      : /Trade Executed: MIA ↔ DEN/i,
  });
  await expect(tradeHistoryRow).toBeVisible({ timeout: 30_000 });
  await tradeHistoryRow.click();
  const historyDetail = page.getByTestId('team-history-detail-modal');
  if (OWNER_REVIEW_MODE) {
    await expect(historyDetail).toContainText('Saved Move Details');
    await expect(historyDetail).toContainText('Miami Heat');
    await expect(historyDetail).toContainText('Denver Nuggets');
    await expect(historyDetail.getByText('Saved on')).toBeVisible();
    await expect(
      historyDetail.getByTestId('team-history-player-mia_tobias_lund-direction')
    ).toHaveText('Sent by Miami Heat · Received by Denver Nuggets');
    await expect(
      historyDetail.getByTestId('team-history-player-mia_owen_frost-direction')
    ).toHaveText('Sent by Miami Heat · Received by Denver Nuggets');
    await expect(
      historyDetail.getByTestId(
        'team-history-player-den_obi_nwachukwu-direction'
      )
    ).toHaveText('Sent by Denver Nuggets · Received by Miami Heat');
    await expect(
      historyDetail.getByTestId('team-history-player-den_aaron_pike-direction')
    ).toHaveText('Sent by Denver Nuggets · Received by Miami Heat');
    await expect(historyDetail).not.toContainText(
      /AUTHORITATIVE WORLD-EVENT ROW|mutation type|raw payload|normalized|receipt ID|governed|proof[-_]|entitlement/i
    );
    await expect(
      historyDetail.getByTestId('team-history-detail-timestamp')
    ).toHaveText(/[A-Z][a-z]{2} \d{1,2}, 20\d{2}/);
  } else {
    await expect(historyDetail).toContainText('Cash Consideration Receipt');
    await expect(historyDetail).toContainText(cashReceipt.receiptId);
    await expect(historyDetail).toContainText('MIA paid $1.00 to DEN');
    await expect(historyDetail).toContainText(
      'Salary-book cash deltas: $0.00 for every Team'
    );
    await expect(historyDetail).toContainText(
      'Persistence verification: Complete'
    );
  }
  const historyScreenshotPath = path.join(
    ARTIFACT_DIR,
    'trade-cash-history-reload-1280x720.png'
  );
  await page.screenshot({ path: historyScreenshotPath, fullPage: false });
  await historyDetail.getByTestId('team-history-detail-close').click();
  await openDashboardTab(page, 'Compare');
  await expect(page.getByTestId('comparison-event-count')).toContainText(
    /1\s+saved move/i,
    { timeout: 20_000 }
  );
  await expect(page.getByTestId('comparison-changed-teams')).toContainText(
    /2\s+teams changed/i
  );
  await expect(page.getByTestId('comparison-changed-players')).toContainText(
    /4\s+players changed/i
  );
  await expect(page.getByTestId('comparison-roster-additions')).toContainText(
    'Aaron Pike'
  );
  await expect(page.getByTestId('comparison-roster-removals')).toContainText(
    'Owen Frost'
  );
  await expect(page.getByTestId('comparison-cap-delta')).toBeVisible();
  const compareScreenshotPath = path.join(
    ARTIFACT_DIR,
    'trade-cash-compare-reload-1280x720.png'
  );
  await page.screenshot({ path: compareScreenshotPath, fullPage: false });
  expect(pageErrors).toEqual([]);

  const parentWorldId = PROOF_WORLD_ID;
  const childWorldId = 'world_trade_receipt_proof_child';
  await seedInheritedProofWorld({
    childWorldId,
    childWorldName: CHILD_WORLD_NAME,
    parentWorldId,
  });
  await activateProofWorld(page, uid, childWorldId);
  const childMia = await getWorldTeamDocument(childWorldId, 'MIA');
  const childDen = await getWorldTeamDocument(childWorldId, 'DEN');
  expect(JSON.stringify(childMia?.hardCapLedger)).toBe(miaHardCapLedgerBytes);
  expect(JSON.stringify(childMia?.cashLedger)).toBe(miaCashLedgerBytes);
  expect(JSON.stringify(childDen?.cashLedger)).toBe(denCashLedgerBytes);
  expect(childDen?.hardCapLedger ?? []).toEqual([]);

  await page.goto(MIA_URL, { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByText(CHILD_WORLD_NAME, { exact: true }).first()
  ).toBeVisible({ timeout: 90_000 });
  await openDashboardTab(page, 'Cap Sheet');
  await page.getByTestId('cap-sheet-exceptions-toggle').click();
  const childHardCapBanner = page.getByTestId(
    'cap-sheet-current-season-authority-banner'
  );
  await expect(childHardCapBanner).toContainText('Hard Capped');
  await expect(childHardCapBanner).toContainText(
    'Transaction Restrictions Table Row I hard cap for Salary Cap Year 2027.'
  );
  await expect(childHardCapBanner).not.toContainText(
    'malformed or version-incompatible'
  );
  await expect(childHardCapBanner).not.toContainText('fail-closed');

  const grandchildWorldId = 'world_trade_receipt_proof_grandchild';
  await seedInheritedProofWorld({
    childWorldId: grandchildWorldId,
    childWorldName: GRANDCHILD_WORLD_NAME,
    parentWorldId: childWorldId,
  });
  await activateProofWorld(page, uid, grandchildWorldId);
  const grandchildMia = await getWorldTeamDocument(grandchildWorldId, 'MIA');
  const grandchildDen = await getWorldTeamDocument(grandchildWorldId, 'DEN');
  expect(JSON.stringify(grandchildMia?.hardCapLedger)).toBe(
    miaHardCapLedgerBytes
  );
  expect(JSON.stringify(grandchildMia?.cashLedger)).toBe(miaCashLedgerBytes);
  expect(JSON.stringify(grandchildDen?.cashLedger)).toBe(denCashLedgerBytes);
  expect(grandchildDen?.hardCapLedger ?? []).toEqual([]);
  await page.goto(MIA_URL, { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByText(GRANDCHILD_WORLD_NAME, { exact: true }).first()
  ).toBeVisible({ timeout: 90_000 });
  await openDashboardTab(page, 'Cap Sheet');
  await page.getByTestId('cap-sheet-exceptions-toggle').click();
  const grandchildHardCapBanner = page.getByTestId(
    'cap-sheet-current-season-authority-banner'
  );
  await expect(grandchildHardCapBanner).toContainText('Hard Capped');
  await expect(grandchildHardCapBanner).not.toContainText(
    'malformed or version-incompatible'
  );
  expect(
    JSON.stringify(
      (await getWorldTeamDocument(parentWorldId, 'MIA'))?.hardCapLedger
    )
  ).toBe(miaHardCapLedgerBytes);
  expect(
    JSON.stringify(
      (await getWorldTeamDocument(parentWorldId, 'MIA'))?.cashLedger
    )
  ).toBe(miaCashLedgerBytes);
  expect(await worldCount()).toBe(3);
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
      fixtureWorldCount: 3,
      durableWorldCountChangeAfterValidation: 0,
      durableTeamDocumentChangeAfterValidation: 0,
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
      tradeBonusAuthorityBoundary: {
        artifact: {
          path: path.relative(process.cwd(), RETAINED_CONTRACT_RELEASE_PATH),
          sha256: retainedAuthority.artifactSha256,
        },
        release: {
          releaseId: retainedAuthority.release.releaseId,
          releaseVersion: retainedAuthority.release.releaseVersion,
          releaseDigest: retainedAuthority.release.releaseDigest,
        },
        baseline: retainedBaseline,
        contractIdentity: retainedAuthority.contractIdentity,
        retainedDisplayName: retainedAustinDisplayName,
        derivedTradeKickerPercent: retainedAuthority.tradeKickerPercent,
        derivedMissingEvidence: retainedAuthority.missingEvidence,
        ui: {
          verdict: retainedTradeBonusUiVerdict,
          reason: retainedTradeBonusUiReason,
          readinessText: retainedTradeBonusReadinessText,
          tradeSummaryBlocked: retainedTradeBonusSummaryBlocked,
          applyBlocked: retainedTradeBonusApplyBlocked,
        },
        noWrite: {
          teamChanges:
            JSON.stringify(bonusTeamsAfter) ===
            JSON.stringify(bonusAuthorityBefore.teams)
              ? 0
              : 1,
          eventChanges:
            JSON.stringify(bonusEventsAfter) ===
            JSON.stringify(bonusAuthorityBefore.events)
              ? 0
              : 1,
        },
      },
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
        supportedSecondRoundEntitlement: {
          entitlementId: SECOND_ROUND_PROOF_ENTITLEMENT_ID,
          holderTeam: 'DEN',
        },
        proofWorldExistsAfterApply,
        reloadHistoryReceiptVisible: true,
        reloadCompare: {
          committedEventCount: 1,
          changedTeamCount: 2,
          changedPlayerCount: 4,
          rosterAdditionVisible: 'Aaron Pike',
          rosterRemovalVisible: 'Owen Frost',
        },
        foreignContainingTeamBoundary: {
          copiedFrom: 'MIA',
          evaluatedAs: 'DEN',
          result: 'FAIL_CLOSED',
          denCashLedgerUnchanged: true,
          restoredWithoutContamination: true,
        },
        savedWorldLineage: {
          parentWorldId,
          childWorldId,
          grandchildWorldId,
          inheritedRowIBytesPreserved: true,
          inheritedCashBytesPreserved: true,
          childReloadValid: true,
          grandchildReloadValid: true,
        },
      },
      incompleteRosterCharges: {
        asOfDate: PROOF_AS_OF_DATE,
        activeWindow: '2026-07-01 through the day before opening day',
        threshold: 12,
        fullRosterShape: {
          standard: PHASE3A_CLOSURE_EXPECTATIONS.roster.standard,
          twoWay: PHASE3A_CLOSURE_EXPECTATIONS.roster.twoWay,
        },
        persisted: persistedIncompleteRosterCharges,
        reloadCapSheetChargeHiddenAtZero: true,
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
  await testInfo.attach('trade-cash-compare-reload-1280x720', {
    path: compareScreenshotPath,
    contentType: 'image/png',
  });
  await testInfo.attach('full-roster-books-reload-1280x720', {
    path: fullRosterBooksScreenshotPath,
    contentType: 'image/png',
  });
  await testInfo.attach('foreign-hard-cap-ledger-fail-closed-1280x720', {
    path: foreignLedgerScreenshotPath,
    contentType: 'image/png',
  });
});
