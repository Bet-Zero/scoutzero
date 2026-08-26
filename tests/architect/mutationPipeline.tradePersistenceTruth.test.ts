import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDoc } from 'firebase/firestore';
import {
  applyWorldMutation,
  computeWorldMutation,
  persistWorldMutation,
  type ArchitectMutationContract,
} from '@/features/architect/utils/mutationPipeline';
import { loadStateForMutation } from '@/features/architect/utils/mutationPipeline.read.stateLoader';
import { getMockTeamSnapshot } from '../helpers/architectTestHelpers.js';
import {
  createMockPlayer,
  createMockTeam,
  createMockWorld,
  seedMockData,
  seedTeamSnapshot,
  seedWorldMetadata,
  type MockCapHold,
  type MockPlayer,
  type MockPlayerContract,
  type MockSalaryRow,
  type MockTeam,
  type MockTeamSnapshot,
} from '../helpers/architectTestHelpers.js';
import { getAllMockData, resetMockDataStore } from '../__mocks__/firebase.js';
import { getPlayer } from '@/features/architect/utils/teamLoader';
import { worldPlayerRef } from '@/features/architect/utils/architectFirestorePaths';
import { makeGovernedOfferSheetFixture } from '../fixtures/architect/governedOfferSheet';
import { GovernedOfferSheetLifecycleZ } from '@/schemas/governedOfferSheet';
import { buildGeneralMutationCommittedTeamUpdates } from '@/features/architect/utils/mutationPipeline.read.persistence.snapshots';
import { buildGovernedOfferSheetAuthorization } from '@/features/architect/utils/offerSheets';
import { withGovernedSalaryBooks } from '@/tests/fixtures/governedSalaryBookInputs';
import { validateTrade } from '@/features/architect/utils/tradeMachine';
import {
  GovernedCashLedgerZ,
  GovernedCashReceiptZ,
  type GovernedCashEvaluation,
} from '@/schemas/governedCashConsideration';
import type { TradeApronRestrictionEvaluation } from '@/features/architect/utils/tradeMachine/utils/tradeApronRestrictions';
import { toTeamHistoryEventDisplay } from '@/features/architect/history/utils/normalizeWorldEventsForTeamHistory';

vi.mock('@/features/architect/utils/capLegalityValidation', () => ({
  validateSigning: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateWaive: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateExtension: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateOptionDecision: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateOfferSheetResolution: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateRenounceRights: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateDeadCap: vi.fn(() => ({ violations: [], warnings: [] })),
  validateExceptions: vi.fn(() => ({ violations: [], warnings: [] })),
  isOverrideEnabled: vi.fn(() => false),
}));

vi.mock('@/features/architect/utils/tradeMachine', () => ({
  validateTrade: vi.fn((input: { teams?: unknown[] | null }) => ({
    valid: true,
    success: true,
    legal: true,
    reason: null,
    error: null,
    warnings: [],
    violations: [],
    teamResults: Array.from(
      { length: Array.isArray(input?.teams) ? input.teams.length : 0 },
      () => ({ rules: {} })
    ),
  })),
}));

vi.mock('@/features/architect/utils/capLegality/postStateCapValidator', () => ({
  POST_STATE_CAP_VALIDATOR_VERSION: 'test-post-state-validator',
  validatePostStateCapLegality: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
}));

vi.mock('@/features/architect/utils/leagueInvariants', () => ({
  validateMutationLeagueInvariants: vi.fn(async () => ({ valid: true })),
  validateMutationEntitlementInvariants: vi.fn(async () => ({ valid: true })),
  validateTradeApplyExclusivity: vi.fn(async () => ({ valid: true })),
}));

const SEASON_ID = '2025-26';
const TIMESTAMP = Date.UTC(2026, 6, 2, 12, 0, 0);
const USER_ID = 'user_trade_truth';

type TradeSalaryRowFixture = MockSalaryRow;

type TradeContractFixture = ArchitectMutationContract &
  MockPlayerContract & {
    contractType: string;
    totalValue: number;
    salariesByYear: TradeSalaryRowFixture[];
    signedUsing?: string;
    signingTeam?: string;
    rfaOfferSheet?: boolean;
    rfaOfferSheetOnly?: boolean;
    rfaOfferSheetStatus?: string;
    contractYears?: number;
  };

type TradePlayerFixture = MockPlayer & {
  id: string;
  player_id: string;
  name: string;
  contract: TradeContractFixture;
} & Record<string, unknown>;

type ComputeWorldMutationInput = Parameters<typeof computeWorldMutation>[0];
type ExecuteTradeCurrentState = Extract<
  ComputeWorldMutationInput,
  { mutationType: 'executeTrade' }
>['currentState'];
type ExecuteTradeTeamState = NonNullable<
  NonNullable<ExecuteTradeCurrentState['teams']>[number]['team']
>;
type ExtendPlayerCurrentState = Extract<
  ComputeWorldMutationInput,
  { mutationType: 'extendPlayer' }
>['currentState'];
type ExtendPlayerTeamState = NonNullable<ExtendPlayerCurrentState['team']>;
type WaivePlayerCurrentState = Extract<
  ComputeWorldMutationInput,
  { mutationType: 'waivePlayer' }
>['currentState'];
type WaivePlayerTeamState = NonNullable<WaivePlayerCurrentState['team']>;

type TradeCapHoldFixture = MockCapHold & Record<string, unknown>;

type TradeOfferSheetFixture = {
  id: string;
  dedupKey: string;
  playerId: string;
  playerName: string;
  offeringTeamCode: string;
  homeTeamCode: string;
  seasonKey: string;
  year: number;
  status: string;
  contractYears: number;
  totalValue: number;
  salariesByYear: TradeSalaryRowFixture[];
} & Record<string, unknown>;

type TradeTeamFixture = MockTeam & {
  players: TradePlayerFixture[];
  capHolds: TradeCapHoldFixture[];
  offerSheets?: TradeOfferSheetFixture[] | null;
  incomingOfferSheets?: TradeOfferSheetFixture[] | null;
} & Record<string, unknown>;

function requireValue<T>(value: T | null | undefined, message: string): T {
  expect(value, message).toBeDefined();

  if (value == null) {
    throw new Error(message);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOfferSheetSnapshot(value: unknown): value is TradeOfferSheetFixture {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.dedupKey === 'string' &&
    typeof value.playerId === 'string' &&
    typeof value.playerName === 'string' &&
    typeof value.offeringTeamCode === 'string' &&
    typeof value.homeTeamCode === 'string'
  );
}

function requireTeamSnapshot(
  worldId: string,
  teamCode: string
): MockTeamSnapshot {
  return requireValue(
    getMockTeamSnapshot(worldId, teamCode),
    `Expected mock team snapshot for ${worldId}/${teamCode}`
  );
}

function getOfferSheets(snapshot: MockTeamSnapshot): TradeOfferSheetFixture[] {
  return (snapshot.offerSheets ?? []).filter(isOfferSheetSnapshot);
}

function getIncomingOfferSheets(
  snapshot: MockTeamSnapshot
): TradeOfferSheetFixture[] {
  return (snapshot.incomingOfferSheets ?? []).filter(isOfferSheetSnapshot);
}

function makeContract(
  salary: number,
  extra: Partial<TradeContractFixture> = {}
): TradeContractFixture {
  return {
    contractType: 'Standard',
    totalValue: salary,
    salariesByYear: [
      {
        season: SEASON_ID,
        salary,
        capHit: salary,
        guaranteed: true,
      },
    ],
    ...extra,
  };
}

function makePlayer(
  id: string,
  teamCode: string,
  salary: number,
  extra: Partial<TradePlayerFixture> & Record<string, unknown> = {}
): TradePlayerFixture {
  const contract = makeContract(salary);
  const basePlayer = createMockPlayer({
    playerId: id,
    displayName: id,
    teamCode,
    contract,
  });

  return {
    ...basePlayer,
    id,
    playerId: id,
    player_id: id,
    name: id,
    contract,
    ...extra,
  };
}

function makeTeam(
  teamCode: string,
  players: TradePlayerFixture[],
  capHolds: TradeCapHoldFixture[] = []
): TradeTeamFixture {
  const totalSalary = players.reduce(
    (sum, player) =>
      sum + Number(player?.contract?.salariesByYear?.[0]?.capHit ?? 0),
    0
  );

  const baseTeam = createMockTeam({
    teamCode,
    season: SEASON_ID,
    roster: players.map((player) => String(player.player_id || player.id)),
    players,
    capHolds,
    draftPicks: [],
    totals: {
      totalSalary,
      capHit: totalSalary,
    },
  });

  const team = {
    ...baseTeam,
    roster: players.map((player) => String(player.player_id || player.id)),
    players,
    capHolds,
    tradeExceptions: [],
    exceptionHistory: [],
    offerSheets: [],
    incomingOfferSheets: [],
  };
  const capHoldsTotal = capHolds.reduce(
    (sum, hold) =>
      sum +
      (hold.active === false || hold.isSigned === true
        ? 0
        : Number(hold.amount || 0)),
    0
  );
  return withGovernedSalaryBooks(team, {
    salaryCapYear: 2026,
    asOfDate: '2025-07-08T09:55:00-04:00',
    teamSalary: totalSalary + capHoldsTotal,
    apronTeamSalary: totalSalary + capHoldsTotal + 1_000_000,
    taxSalary: totalSalary + capHoldsTotal + 2_000_000,
  }) as TradeTeamFixture;
}

function basicTradeValidation(
  input: Parameters<typeof validateTrade>[0]
): ReturnType<typeof validateTrade> {
  return {
    valid: true,
    success: true,
    legal: true,
    reason: null,
    error: null,
    warnings: [],
    violations: [],
    teamResults: Array.from(
      { length: Array.isArray(input?.teams) ? input.teams.length : 0 },
      () => ({ rules: {} })
    ),
  } as ReturnType<typeof validateTrade>;
}

function makeOfferSheet(
  overrides: Partial<TradeOfferSheetFixture> = {}
): TradeOfferSheetFixture {
  return {
    id: 'os_default',
    dedupKey: 'os:world_default:LAL:player_default:2025-26',
    playerId: 'player_default',
    playerName: 'Offer Sheet Fragment Name',
    offeringTeamCode: 'LAL',
    homeTeamCode: 'BOS',
    seasonKey: SEASON_ID,
    year: 2026,
    status: 'PENDING_MATCH',
    contractYears: 4,
    totalValue: 72_000_000,
    salariesByYear: [
      {
        season: SEASON_ID,
        salary: 18_000_000,
        capHit: 18_000_000,
        guaranteed: true,
      },
      {
        season: '2026-27',
        salary: 18_900_000,
        capHit: 18_900_000,
        guaranteed: true,
      },
      {
        season: '2027-28',
        salary: 19_845_000,
        capHit: 19_845_000,
        guaranteed: true,
      },
      {
        season: '2028-29',
        salary: 20_837_250,
        capHit: 20_837_250,
        guaranteed: true,
      },
    ],
    ...overrides,
  };
}

function toExecuteTradeCurrentStateTeam(
  team: TradeTeamFixture
): ExecuteTradeTeamState {
  const totalSalary = Number(team.totals?.totalSalary ?? 0);

  return {
    teamCode: team.teamCode,
    teamName: team.teamName,
    players: team.players,
    roster: team.roster,
    capHolds: team.capHolds,
    deadCap: team.deadCap ?? [],
    exceptions: team.exceptions ?? null,
    totals: { totalSalary, capHit: Number(team.totals?.capHit ?? totalSalary) },
    tradeExceptions: team.tradeExceptions ?? [],
    cashLedger: team.cashLedger ?? null,
    exceptionHistory: team.exceptionHistory ?? [],
    draftPicks: [],
    entitlementIds: team.entitlementIds ?? [],
    twoWayPlayers: [],
    teamTotalSalary: totalSalary,
    hardCapped: team.hardCapped ?? null,
    hardCapLevel: team.hardCapLevel ?? null,
    hardCapReason: team.hardCapReason ?? null,
    hardCapTriggeredBy: team.hardCapTriggeredBy ?? null,
  };
}

function toExtendPlayerCurrentStateTeam(
  team: TradeTeamFixture
): ExtendPlayerTeamState {
  const totalSalary = Number(team.totals?.totalSalary ?? 0);

  return {
    teamCode: team.teamCode,
    teamName: team.teamName,
    players: team.players,
    roster: team.roster,
    capHolds: team.capHolds,
    deadCap: team.deadCap ?? [],
    exceptions: team.exceptions ?? null,
    totals: { totalSalary, capHit: Number(team.totals?.capHit ?? totalSalary) },
    tradeExceptions: team.tradeExceptions ?? [],
    cashLedger: team.cashLedger ?? null,
    exceptionHistory: team.exceptionHistory ?? [],
    draftPicks: [],
    entitlementIds: team.entitlementIds ?? [],
    hardCapped: team.hardCapped ?? null,
    hardCapLevel: team.hardCapLevel ?? null,
    hardCapReason: team.hardCapReason ?? null,
    hardCapTriggeredBy: team.hardCapTriggeredBy ?? null,
  };
}

function toWaivePlayerCurrentStateTeam(
  team: TradeTeamFixture
): WaivePlayerTeamState {
  return toExtendPlayerCurrentStateTeam(team);
}

function makeStoredOfferSheetContract(
  overrides: Partial<TradeContractFixture> = {}
): TradeContractFixture {
  return {
    contractType: 'Offer Sheet',
    rfaOfferSheet: true,
    rfaOfferSheetOnly: true,
    rfaOfferSheetStatus: 'PENDING_MATCH',
    contractYears: 4,
    totalValue: 77_582_250,
    salariesByYear: [
      {
        season: SEASON_ID,
        salary: 18_000_000,
        capHit: 18_000_000,
        guaranteed: true,
      },
      {
        season: '2026-27',
        salary: 18_900_000,
        capHit: 18_900_000,
        guaranteed: true,
      },
      {
        season: '2027-28',
        salary: 19_845_000,
        capHit: 19_845_000,
        guaranteed: true,
      },
      {
        season: '2028-29',
        salary: 20_837_250,
        capHit: 20_837_250,
        guaranteed: true,
      },
    ],
    ...overrides,
  };
}

function seedBasePlayer(player: TradePlayerFixture) {
  seedMockData(`architect_basePlayers/${player.playerId}`, player);
}

function seedOfferSheetAuthorization(
  worldId: string,
  offerSheet: TradeOfferSheetFixture
) {
  const lifecycle = GovernedOfferSheetLifecycleZ.parse(
    offerSheet.governedLifecycle
  );
  seedMockData(
    `architect_worlds/${worldId}/offerSheetAuthorizations/${offerSheet.id}`,
    buildGovernedOfferSheetAuthorization({
      lifecycle,
      offerSheetId: offerSheet.id,
      dedupKey: offerSheet.dedupKey,
    })
  );
}

function seedPlayerOverride(
  worldId: string,
  teamCode: string,
  player: TradePlayerFixture
) {
  seedMockData(
    `architect_worlds/${worldId}/teams/${teamCode}/players/${player.playerId}`,
    {
      playerId: player.playerId,
      displayName: player.displayName,
      teamCode: player.teamCode,
      teamName: player.teamName,
      contract: player.contract,
      source: {
        type: 'world-override',
        worldId,
      },
      lastUpdated: '2026-07-01T00:00:00.000Z',
      version: 'override-1',
    }
  );
}

describe('mutationPipeline trade persistence truth', () => {
  beforeEach(() => {
    resetMockDataStore();
    vi.clearAllMocks();
    vi.mocked(validateTrade).mockImplementation(basicTradeValidation);
  });

  it('fails closed on a legacy waiver payload without governed Contract and receipt authority', async () => {
    const player = makePlayer('waive_multiyear_truth', 'LAL', 0, {
      displayName: 'Waive Multi-Year Truth',
      contract: makeContract(30_000_000, {
        totalValue: 30_000_000,
        guaranteedValue: 30_000_000,
        salariesByYear: [
          {
            season: SEASON_ID,
            salary: 12_000_000,
            capHit: 12_000_000,
            guaranteed: true,
            guaranteedAmount: 12_000_000,
          },
          {
            season: '2026-27',
            salary: 18_000_000,
            capHit: 18_000_000,
            guaranteed: true,
            guaranteedAmount: 18_000_000,
          },
        ],
      }),
    });
    const team = makeTeam('LAL', [player]);

    const result = computeWorldMutation({
      mutationType: 'waivePlayer',
      seasonId: SEASON_ID,
      timestamp: TIMESTAMP,
      currentState: {
        teamCode: 'LAL',
        team: toWaivePlayerCurrentStateTeam(team),
        player,
      },
      payload: {
        teamCode: 'LAL',
        playerId: player.playerId,
      },
    });

    expect(result.success).toBe(false);
    expect(String(result.error)).toMatch(
      /pinned Contract.*exact.*League receipt.*author provenance/i
    );
    expect(result.teamUpdates || []).toEqual([]);
    expect(result.playerUpdates || []).toEqual([]);
    expect(result.playerDeletes || []).toEqual([]);
  });

  it('persists standard trade destination overrides and deletes superseded source overrides', async () => {
    const worldId = 'world_trade_truth_standard';
    seedWorldMetadata(
      worldId,
      createMockWorld({
        worldId,
        userId: USER_ID,
        currentSeason: SEASON_ID,
      })
    );

    const lalOut = makePlayer('lal_out_18m', 'LAL', 18_000_000);
    const bosOut = makePlayer('bos_out_10m', 'BOS', 10_000_000);

    seedBasePlayer(lalOut);
    seedBasePlayer(bosOut);
    seedTeamSnapshot(worldId, 'LAL', makeTeam('LAL', [lalOut]), {
      padRoster: false,
    });
    seedTeamSnapshot(worldId, 'BOS', makeTeam('BOS', [bosOut]), {
      padRoster: false,
    });
    seedPlayerOverride(worldId, 'LAL', lalOut);
    seedPlayerOverride(worldId, 'BOS', bosOut);

    const result = await applyWorldMutation({
      userId: USER_ID,
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'executeTrade',
      timestamp: TIMESTAMP,
      payload: {
        teams: [
          {
            teamCode: 'LAL',
            sends: [{ ...lalOut, tradeTo: 'BOS' }],
            entitlementsOut: [],
          },
          {
            teamCode: 'BOS',
            sends: [{ ...bosOut, tradeTo: 'LAL' }],
            entitlementsOut: [],
          },
        ],
        tradeCtx: {
          // This test owns the generic player-override persistence boundary.
          // The governed Trade Machine authority path has dedicated BZE-287
          // tests and intentionally requires date/year/Contract fixtures.
          source: 'mutationPipeline-test',
        },
      },
    });

    expect(result.success, String(result.error)).toBe(true);
    expect(
      result.changedPlayers?.map((entry) => entry.playerId).sort()
    ).toEqual(['bos_out_10m', 'lal_out_18m']);

    const lalSnapshot = requireTeamSnapshot(worldId, 'LAL');
    const bosSnapshot = requireTeamSnapshot(worldId, 'BOS');
    expect(lalSnapshot.roster).toContain('bos_out_10m');
    expect(lalSnapshot.roster).not.toContain('lal_out_18m');
    expect(bosSnapshot.roster).toContain('lal_out_18m');
    expect(bosSnapshot.roster).not.toContain('bos_out_10m');

    const deletedSourceOverride = await getDoc(
      worldPlayerRef(worldId, 'LAL', 'lal_out_18m')
    );
    const destinationOverride = await getDoc(
      worldPlayerRef(worldId, 'BOS', 'lal_out_18m')
    );
    expect(deletedSourceOverride.exists()).toBe(false);
    expect(destinationOverride.exists()).toBe(true);

    const movedPlayer = await getPlayer(worldId, 'BOS', 'lal_out_18m');
    expect(movedPlayer.teamCode).toBe('BOS');
    expect(movedPlayer.contract?.salariesByYear?.[0]?.salary).toBe(18_000_000);
  });

  it('atomically persists paired cash ledgers, the uninvolved Team snapshot, Row I, and one receipt while rejecting a stale replay', async () => {
    const worldId = 'world_trade_truth_cash';
    const transactionAt = '2025-07-08T09:55:00-04:00';
    const cashTimestamp = Date.UTC(2025, 6, 8, 14, 0, 0);
    const annualLimitCents = 796_432_050;
    const cashProof = {
      canonCandidateCommit: '6cf8aaf358c158a88e630e8a7336f7e9c3febc17' as const,
      canonSha256:
        '23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76' as const,
      salaryCapCents: 15_464_700_000,
      annualLimitCents,
      seasonInputManifest: {},
    };
    const cashEvaluation = (
      teamId: 'LAL' | 'BOS',
      direction: 'PAID' | 'RECEIVED'
    ): GovernedCashEvaluation => ({
      evaluationVersion: 1,
      status: 'PASS',
      passed: true,
      teamId,
      salaryCapYear: 2026,
      transactionAt,
      cashSentCents: direction === 'PAID' ? 100 : 0,
      cashReceivedCents: direction === 'RECEIVED' ? 100 : 0,
      priorPaidCents: 0,
      priorReceivedCents: 0,
      projectedPaidCents: direction === 'PAID' ? 100 : 0,
      projectedReceivedCents: direction === 'RECEIVED' ? 100 : 0,
      annualLimitCents,
      regularSeasonClosing: '2026-04-12',
      ledgerVersion: 0,
      canonLeafIds: [
        direction === 'PAID' ? 'CBA2-A08.1' : 'CBA2-A08.2',
        'CBA2-A08.4',
        'CBA2-A08.5',
        'CBA2-A08.6',
      ],
      missingInputs: [],
      violations: [],
      proof: cashProof,
    });
    const hardCapProof = {
      registryId: 'canon-governed-season-registry',
      registryVersion: 1,
      canonCandidateCommit: '6cf8aaf358c158a88e630e8a7336f7e9c3febc17',
      canonSha256:
        '23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76',
      calendarRecordId: 'season-2025-26',
      calendarRecordVersion: 1,
      apronRecordId: 'apron-2025-26',
      apronRecordVersion: 1,
    };
    const rowIEvaluation: TradeApronRestrictionEvaluation = {
      version: 1,
      status: 'PASS',
      passed: true,
      restrictionRow: 'I',
      salaryMatchingPath: 'ROOM',
      apronLevel: 'SECOND_APRON',
      ceiling: 207_824_000,
      postTransactionApronTeamSalary: 20_000_000,
      margin: 187_824_000,
      transactionDate: transactionAt,
      salaryCapYear: 2026,
      tpeId: null,
      tpeCreatedOn: null,
      tpeExpiresOn: null,
      tpeTimings: [],
      attachedRestrictions: [
        {
          restrictionRow: 'I',
          componentId: 'cash:LAL:BOS',
          componentKind: 'CASH',
          salaryMatchingPath: 'ROOM',
          apronLevel: 'SECOND_APRON',
          ceiling: 207_824_000,
          incomingPlayers: [],
          cashAmountCents: 100,
          tpeTiming: null,
          regularSeasonClosing: null,
          canonLeafIds: ['CBA2-A05.11'],
          proof: hardCapProof,
        },
      ],
      regularSeasonClosing: '2026-04-12',
      hardCapWillPersist: true,
      canonLeafIds: ['CBA2-A05.11'],
      missingInputs: [],
      violations: [],
      proof: hardCapProof,
    };
    vi.mocked(validateTrade).mockImplementation((input) => {
      const result = basicTradeValidation(input);
      return {
        ...result,
        teamResults: [
          {
            teamId: 'LAL',
            teamCode: 'LAL',
            teamName: 'Lakers',
            rules: {},
            cashConsiderationEvaluation: cashEvaluation('LAL', 'PAID'),
            apronRestrictionEvaluation: rowIEvaluation,
          },
          {
            teamId: 'BOS',
            teamCode: 'BOS',
            teamName: 'Celtics',
            rules: {},
            cashConsiderationEvaluation: cashEvaluation('BOS', 'RECEIVED'),
            apronRestrictionEvaluation: null,
          },
          {
            teamId: 'DET',
            teamCode: 'DET',
            teamName: 'Pistons',
            rules: {},
            cashConsiderationEvaluation: null,
            apronRestrictionEvaluation: null,
          },
        ],
        tradeReceipt: {
          isLegal: true,
          capSettings: {
            salaryCap: 154_647_000,
            rookieMinSource: undefined,
          },
          teams: [
            {
              teamCode: 'LAL',
              cashConsiderationEvaluation: cashEvaluation('LAL', 'PAID'),
            },
            {
              teamCode: 'BOS',
              cashConsiderationEvaluation: cashEvaluation('BOS', 'RECEIVED'),
            },
            {
              teamCode: 'DET',
              cashConsiderationEvaluation: null,
            },
          ],
        },
      } as ReturnType<typeof validateTrade>;
    });

    seedWorldMetadata(
      worldId,
      createMockWorld({
        worldId,
        userId: USER_ID,
        currentSeason: SEASON_ID,
      })
    );
    const lalOut = makePlayer('cash_lal_out', 'LAL', 8_000_000);
    const bosOut = makePlayer('cash_bos_out', 'BOS', 8_000_000);
    const detOut = makePlayer('cash_det_out', 'DET', 8_000_000);
    seedBasePlayer(lalOut);
    seedBasePlayer(bosOut);
    seedBasePlayer(detOut);
    seedTeamSnapshot(
      worldId,
      'LAL',
      {
        ...makeTeam('LAL', [lalOut]),
        cashLedger: {
          ledgerVersion: 0,
          ledgerId: 'cash-ledger:LAL',
          teamId: 'LAL',
          entries: [],
        },
      },
      { padRoster: false }
    );
    seedTeamSnapshot(
      worldId,
      'BOS',
      {
        ...makeTeam('BOS', [bosOut]),
        cashLedger: {
          ledgerVersion: 0,
          ledgerId: 'cash-ledger:BOS',
          teamId: 'BOS',
          entries: [],
        },
      },
      { padRoster: false }
    );
    seedTeamSnapshot(worldId, 'DET', makeTeam('DET', [detOut]), {
      padRoster: false,
    });
    const salaryBooksBefore = {
      LAL: requireTeamSnapshot(worldId, 'LAL').salaryBookInputs,
      BOS: requireTeamSnapshot(worldId, 'BOS').salaryBookInputs,
      DET: requireTeamSnapshot(worldId, 'DET').salaryBookInputs,
    };
    const payload = {
      teams: [
        {
          teamCode: 'LAL',
          sends: [{ ...lalOut, tradeTo: 'BOS' }],
          entitlementsOut: [],
          cashSent: 1,
          cashToTeamId: 'BOS',
        },
        {
          teamCode: 'BOS',
          sends: [{ ...bosOut, tradeTo: 'DET' }],
          entitlementsOut: [],
        },
        {
          teamCode: 'DET',
          sends: [{ ...detOut, tradeTo: 'LAL' }],
          entitlementsOut: [],
        },
      ],
      tradeCtx: {
        source: 'mutationPipeline-test',
        worldId,
        tradeDate: transactionAt,
        asOfDate: transactionAt,
        currentYear: 2026,
        yearKey: 2026,
      },
    };
    const staleState = await loadStateForMutation(
      worldId,
      'executeTrade',
      payload
    );
    const firstCandidate = computeWorldMutation({
      mutationType: 'executeTrade',
      payload,
      currentState: staleState,
      seasonId: SEASON_ID,
      timestamp: cashTimestamp,
      asOfDate: transactionAt,
      worldId,
      operationId: 'cash-operation-first',
    });
    const staleCandidate = computeWorldMutation({
      mutationType: 'executeTrade',
      payload,
      currentState: staleState,
      seasonId: SEASON_ID,
      timestamp: cashTimestamp + 1,
      asOfDate: transactionAt,
      worldId,
      operationId: 'cash-operation-stale',
    });
    expect(firstCandidate.success, String(firstCandidate.error)).toBe(true);
    expect(staleCandidate.success, String(staleCandidate.error)).toBe(true);
    expect(
      GovernedCashReceiptZ.parse(
        firstCandidate.metadata?.governedCashReceipt
      ).tradeReceipt
    ).toEqual({
      isLegal: true,
      capSettings: { salaryCap: 154_647_000 },
      teams: [
        {
          teamCode: 'LAL',
          cashConsiderationEvaluation: cashEvaluation('LAL', 'PAID'),
        },
        {
          teamCode: 'BOS',
          cashConsiderationEvaluation: cashEvaluation('BOS', 'RECEIVED'),
        },
        {
          teamCode: 'DET',
          cashConsiderationEvaluation: null,
        },
      ],
    });

    const firstPersisted = await persistWorldMutation({
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'executeTrade',
      computeResult: firstCandidate,
      committedTeamUpdates: buildGeneralMutationCommittedTeamUpdates(
        firstCandidate.teamUpdates,
        SEASON_ID
      ),
      timestamp: cashTimestamp,
    });
    expect(firstPersisted.success, String(firstPersisted.error)).toBe(true);

    const lalSnapshot = requireTeamSnapshot(worldId, 'LAL');
    const bosSnapshot = requireTeamSnapshot(worldId, 'BOS');
    const detSnapshot = requireTeamSnapshot(worldId, 'DET');
    const lalLedger = GovernedCashLedgerZ.parse(lalSnapshot.cashLedger);
    const bosLedger = GovernedCashLedgerZ.parse(bosSnapshot.cashLedger);
    expect(lalLedger).toMatchObject({
      ledgerVersion: 1,
      entries: [
        {
          direction: 'PAID',
          teamId: 'LAL',
          counterpartyTeamId: 'BOS',
          amountCents: 100,
        },
      ],
    });
    expect(bosLedger).toMatchObject({
      ledgerVersion: 1,
      entries: [
        {
          direction: 'RECEIVED',
          teamId: 'BOS',
          counterpartyTeamId: 'LAL',
          amountCents: 100,
        },
      ],
    });
    expect(lalLedger.entries[0].transactionId).toBe(
      bosLedger.entries[0].transactionId
    );
    expect(lalSnapshot.hardCapLedger).toEqual([
      expect.objectContaining({
        restrictionRow: 'I',
        transactionId: lalLedger.entries[0].transactionId,
      }),
    ]);
    expect(lalSnapshot.salaryBookInputs).toEqual(salaryBooksBefore.LAL);
    expect(bosSnapshot.salaryBookInputs).toEqual(salaryBooksBefore.BOS);
    expect(detSnapshot.salaryBookInputs).toEqual(salaryBooksBefore.DET);
    expect(detSnapshot.cashLedger).toBeUndefined();

    expect(firstPersisted.event).toMatchObject({
      metadata: {
        governedCashReceipt: {
          verificationStatus: 'complete',
          salaryBookCashDeltas: [
            {
              teamId: 'LAL',
              teamSalary: 0,
              apronTeamSalary: 0,
              taxSalary: 0,
            },
            {
              teamId: 'BOS',
              teamSalary: 0,
              apronTeamSalary: 0,
              taxSalary: 0,
            },
          ],
        },
      },
    });
    const cashHistory = toTeamHistoryEventDisplay(
      firstPersisted.event as unknown as Record<string, unknown>,
      { teamCode: 'LAL' }
    );
    expect(cashHistory.detailSections).toContainEqual({
      title: 'Cash Consideration Receipt',
      lines: expect.arrayContaining([
        'Salary Cap Year: 2026',
        'LAL paid $1.00 to BOS',
        'BOS received $1.00 from LAL',
        'Salary-book cash deltas: $0.00 for every Team',
        'Persistence verification: Complete',
      ]),
    });
    const eventCountAfterWinner = [...getAllMockData().keys()].filter((key) =>
      key.includes('/events/')
    ).length;

    const stalePersisted = await persistWorldMutation({
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'executeTrade',
      computeResult: staleCandidate,
      committedTeamUpdates: buildGeneralMutationCommittedTeamUpdates(
        staleCandidate.teamUpdates,
        SEASON_ID
      ),
      timestamp: cashTimestamp + 1,
    });
    expect(stalePersisted.success).toBe(false);
    if (!stalePersisted.success) {
      expect(stalePersisted.error).toMatch(/snapshot|ledger.*changed/i);
    }
    expect(
      [...getAllMockData().keys()].filter((key) => key.includes('/events/'))
    ).toHaveLength(eventCountAfterWinner);
    expect(
      GovernedCashLedgerZ.parse(requireTeamSnapshot(worldId, 'LAL').cashLedger)
        .ledgerVersion
    ).toBe(1);
  });

  it('persists sign-and-trade destination overrides with the signed contract and deletes source overrides', async () => {
    const worldId = 'world_trade_truth_sat';
    seedWorldMetadata(
      worldId,
      createMockWorld({
        worldId,
        userId: USER_ID,
        currentSeason: SEASON_ID,
      })
    );

    const satBasePlayer = makePlayer('sat_player', 'LAL', 0, {
      freeAgentYear: 2026,
      contract: makeContract(0, {
        contractType: 'Free Agent',
      }),
    });
    const bosKeeper = makePlayer('bos_keeper', 'BOS', 8_000_000);

    seedBasePlayer(satBasePlayer);
    seedBasePlayer(bosKeeper);
    seedTeamSnapshot(
      worldId,
      'LAL',
      makeTeam(
        'LAL',
        [satBasePlayer],
        [
          {
            playerId: 'sat_player',
            playerName: 'sat_player',
            season: SEASON_ID,
            amount: 12_000_000,
            active: true,
            isSigned: false,
          },
        ]
      ),
      { padRoster: false }
    );
    seedTeamSnapshot(worldId, 'BOS', makeTeam('BOS', [bosKeeper]), {
      padRoster: false,
    });
    seedPlayerOverride(worldId, 'LAL', satBasePlayer);

    const satContract = {
      contractType: 'Sign & Trade',
      signAndTrade: true,
      contractYears: 3,
      firstYearGuaranteed: true,
      salariesByYear: [
        {
          season: SEASON_ID,
          salary: 15_000_000,
          capHit: 15_000_000,
          guaranteed: true,
        },
        {
          season: '2026-27',
          salary: 15_750_000,
          capHit: 15_750_000,
          guaranteed: true,
        },
        {
          season: '2027-28',
          salary: 16_537_500,
          capHit: 16_537_500,
          guaranteed: true,
        },
      ],
    };

    const result = await applyWorldMutation({
      userId: USER_ID,
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'signAndTrade',
      timestamp: TIMESTAMP,
      payload: {
        teamCode: 'LAL',
        destinationTeamCode: 'BOS',
        playerId: 'sat_player',
        contract: satContract,
        signedUsing: 'Bird Rights',
      },
    });

    expect(result.success, String(result.error)).toBe(true);

    const sourceOverride = await getDoc(
      worldPlayerRef(worldId, 'LAL', 'sat_player')
    );
    const destinationOverride = await getDoc(
      worldPlayerRef(worldId, 'BOS', 'sat_player')
    );
    expect(sourceOverride.exists()).toBe(false);
    expect(destinationOverride.exists()).toBe(true);

    const movedPlayer = await getPlayer(worldId, 'BOS', 'sat_player');
    expect(movedPlayer.teamCode).toBe('BOS');
    expect(movedPlayer.contract?.contractType).toBe('Sign & Trade');
    expect(movedPlayer.contract?.salariesByYear?.[0]?.salary).toBe(15_000_000);
    expect(movedPlayer.contract?.signingTeam).toBe('LAL');
  });

  it('stores offer sheets from authoritative home-team ownership and ignores offering-team-path truth', async () => {
    const worldId = 'world_offer_sheet_store_truth';
    const governed = makeGovernedOfferSheetFixture({
      worldId,
      playerId: 'store_rfa_truth',
      homeTeamId: 'BOS',
      offeringTeamId: 'LAL',
      salariesByYear: makeStoredOfferSheetContract().salariesByYear,
    });
    seedWorldMetadata(
      worldId,
      createMockWorld({
        worldId,
        userId: USER_ID,
        currentSeason: SEASON_ID,
        asOfDate: governed.asOfDate,
      })
    );

    const homePlayerBase = makePlayer('store_rfa_truth', 'BOS', 8_000_000, {
      displayName: 'Base Home Truth',
      contract: makeContract(8_000_000, {
        contractType: 'Standard',
        signingTeam: 'BOS',
      }),
      rfaContext: { governedEvidence: governed.evidence },
    });
    const lalKeeper = makePlayer('lal_keeper_store_truth', 'LAL', 7_000_000);

    seedBasePlayer(homePlayerBase);
    seedBasePlayer(lalKeeper);
    seedTeamSnapshot(
      worldId,
      'BOS',
      {
        ...makeTeam('BOS', [homePlayerBase]),
        incomingOfferSheets: [],
        rightsLedger: governed.rightsLedger,
      },
      { padRoster: false }
    );
    seedTeamSnapshot(
      worldId,
      'LAL',
      {
        ...makeTeam('LAL', [lalKeeper]),
        offerSheets: [],
      },
      { padRoster: false }
    );
    seedPlayerOverride(worldId, 'BOS', {
      ...homePlayerBase,
      displayName: 'Canonical Home Override Name',
      contract: makeContract(9_500_000, {
        contractType: 'Standard',
        signingTeam: 'BOS',
      }),
    });
    seedMockData(
      `architect_worlds/${worldId}/teams/LAL/players/store_rfa_truth`,
      {
        playerId: 'store_rfa_truth',
        displayName: 'Wrong Offering Path Name',
        teamCode: 'LAL',
        teamName: 'Team LAL',
        contract: makeContract(99_000_000, {
          contractType: 'Standard',
          signingTeam: 'LAL',
        }),
      }
    );

    const result = await applyWorldMutation({
      userId: USER_ID,
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'storeOfferSheet',
      timestamp: TIMESTAMP,
      payload: {
        teamCode: 'LAL',
        playerId: 'store_rfa_truth',
        worldId,
        contract: makeStoredOfferSheetContract(),
        offerSheetProposal: governed.proposal,
        signedUsing: 'Cap Space',
      },
    });

    expect(result.success, String(result.error)).toBe(true);

    const offeringSnapshot = requireTeamSnapshot(worldId, 'LAL');
    const homeSnapshot = requireTeamSnapshot(worldId, 'BOS');
    const storedSheet = requireValue(
      getOfferSheets(offeringSnapshot)[0],
      'Expected stored offer sheet on offering snapshot'
    );
    const mirroredSheet = requireValue(
      getIncomingOfferSheets(homeSnapshot)[0],
      'Expected mirrored offer sheet on home snapshot'
    );

    expect(storedSheet).toBeTruthy();
    expect(mirroredSheet).toBeTruthy();
    expect(storedSheet.playerName).toBe('Canonical Home Override Name');
    expect(storedSheet.playerName).not.toBe('Wrong Offering Path Name');
    expect(storedSheet.playerName).not.toBe('Base Home Truth');
    expect(storedSheet.homeTeamCode).toBe('BOS');
    expect(mirroredSheet.playerName).toBe('Canonical Home Override Name');
    expect(mirroredSheet.homeTeamCode).toBe('BOS');
  });

  it('resolves RFA home-team ownership from an active unsigned cap hold without rostering the player', async () => {
    const worldId = 'world_offer_sheet_store_cap_hold_rights';
    const governed = makeGovernedOfferSheetFixture({
      worldId,
      playerId: 'cap_hold_rfa',
      homeTeamId: 'BOS',
      offeringTeamId: 'LAL',
      salariesByYear: makeStoredOfferSheetContract().salariesByYear,
    });
    seedWorldMetadata(
      worldId,
      createMockWorld({
        worldId,
        userId: USER_ID,
        currentSeason: SEASON_ID,
        asOfDate: governed.asOfDate,
      })
    );

    const rightsPlayer = makePlayer('cap_hold_rfa', 'BOS', 8_000_000, {
      displayName: 'Cap Hold Rights Player',
      name: 'Cap Hold Rights Player',
      rfaContext: { governedEvidence: governed.evidence },
    });
    const lalKeeper = makePlayer('lal_keeper_cap_hold', 'LAL', 7_000_000);
    const bosKeeper = makePlayer('bos_keeper_cap_hold', 'BOS', 6_000_000);

    seedBasePlayer(rightsPlayer);
    seedBasePlayer(lalKeeper);
    seedBasePlayer(bosKeeper);
    seedTeamSnapshot(worldId, 'LAL', makeTeam('LAL', [lalKeeper]), {
      padRoster: false,
    });
    seedTeamSnapshot(
      worldId,
      'BOS',
      {
        ...makeTeam(
          'BOS',
          [bosKeeper],
          [
            {
              playerId: 'cap_hold_rfa',
              playerName: 'Cap Hold Rights Player',
              amount: 2_000_000,
              season: SEASON_ID,
              type: 'RFA Rights',
              active: true,
              isSigned: false,
            },
          ]
        ),
        rightsLedger: governed.rightsLedger,
      },
      { padRoster: false }
    );

    const result = await applyWorldMutation({
      userId: USER_ID,
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'storeOfferSheet',
      timestamp: TIMESTAMP,
      payload: {
        teamCode: 'LAL',
        playerId: 'cap_hold_rfa',
        worldId,
        contract: makeStoredOfferSheetContract(),
        offerSheetProposal: governed.proposal,
        signedUsing: 'Cap Space',
      },
    });

    expect(result.success, String(result.error)).toBe(true);

    const offeringSnapshot = requireTeamSnapshot(worldId, 'LAL');
    const homeSnapshot = requireTeamSnapshot(worldId, 'BOS');
    const storedSheet = requireValue(
      getOfferSheets(offeringSnapshot)[0],
      'Expected stored offer sheet on offering snapshot'
    );
    const mirroredSheet = requireValue(
      getIncomingOfferSheets(homeSnapshot)[0],
      'Expected mirrored offer sheet on home snapshot'
    );

    expect(homeSnapshot.players.map((player) => player.id)).not.toContain(
      'cap_hold_rfa'
    );
    expect(storedSheet.playerName).toBe('Cap Hold Rights Player');
    expect(storedSheet.homeTeamCode).toBe('BOS');
    expect(mirroredSheet.playerName).toBe('Cap Hold Rights Player');
    expect(mirroredSheet.homeTeamCode).toBe('BOS');
  });

  it('fails closed when authoritative world snapshots cannot resolve a home-team owner', async () => {
    const worldId = 'world_offer_sheet_store_no_owner';
    seedWorldMetadata(
      worldId,
      createMockWorld({
        worldId,
        userId: USER_ID,
        currentSeason: SEASON_ID,
      })
    );

    const baseOnlyPlayer = makePlayer('no_owner_rfa', 'BOS', 8_000_000, {
      displayName: 'Base Only Owner',
    });
    const lalKeeper = makePlayer('lal_keeper_no_owner', 'LAL', 7_000_000);
    const bosKeeper = makePlayer('bos_keeper_no_owner', 'BOS', 6_000_000);

    seedBasePlayer(baseOnlyPlayer);
    seedBasePlayer(lalKeeper);
    seedBasePlayer(bosKeeper);
    seedTeamSnapshot(worldId, 'LAL', makeTeam('LAL', [lalKeeper]), {
      padRoster: false,
    });
    seedTeamSnapshot(worldId, 'BOS', makeTeam('BOS', [bosKeeper]), {
      padRoster: false,
    });

    const result = await applyWorldMutation({
      userId: USER_ID,
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'storeOfferSheet',
      timestamp: TIMESTAMP,
      payload: {
        teamCode: 'LAL',
        playerId: 'no_owner_rfa',
        worldId,
        contract: makeStoredOfferSheetContract(),
        signedUsing: 'Cap Space',
      },
    });

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain(
      'could not resolve an authoritative home team'
    );
    expect(getOfferSheets(requireTeamSnapshot(worldId, 'LAL'))).toHaveLength(0);
    expect(
      getIncomingOfferSheets(requireTeamSnapshot(worldId, 'BOS'))
    ).toHaveLength(0);
  });

  it('fails closed when multiple world snapshots claim roster ownership of the same player', async () => {
    const worldId = 'world_offer_sheet_store_multi_owner';
    seedWorldMetadata(
      worldId,
      createMockWorld({
        worldId,
        userId: USER_ID,
        currentSeason: SEASON_ID,
      })
    );

    const sharedPlayer = makePlayer('multi_owner_rfa', 'BOS', 8_000_000, {
      displayName: 'Multi Owner Player',
    });
    const lalKeeper = makePlayer('lal_keeper_multi_owner', 'LAL', 7_000_000);

    seedBasePlayer(sharedPlayer);
    seedBasePlayer(lalKeeper);
    seedTeamSnapshot(worldId, 'LAL', makeTeam('LAL', [lalKeeper]), {
      padRoster: false,
    });
    seedTeamSnapshot(worldId, 'BOS', makeTeam('BOS', [sharedPlayer]), {
      padRoster: false,
    });
    seedTeamSnapshot(worldId, 'NYK', makeTeam('NYK', [sharedPlayer]), {
      padRoster: false,
    });

    const result = await applyWorldMutation({
      userId: USER_ID,
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'storeOfferSheet',
      timestamp: TIMESTAMP,
      payload: {
        teamCode: 'LAL',
        playerId: 'multi_owner_rfa',
        worldId,
        contract: makeStoredOfferSheetContract(),
        signedUsing: 'Cap Space',
      },
    });

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain('multiple roster owners found');
    expect(getOfferSheets(requireTeamSnapshot(worldId, 'LAL'))).toHaveLength(0);
    expect(
      getIncomingOfferSheets(requireTeamSnapshot(worldId, 'BOS'))
    ).toHaveLength(0);
    expect(
      getIncomingOfferSheets(requireTeamSnapshot(worldId, 'NYK'))
    ).toHaveLength(0);
  });

  it('fails closed when a candidate owner snapshot roster and players[] disagree', async () => {
    const worldId = 'world_offer_sheet_store_membership_conflict';
    seedWorldMetadata(
      worldId,
      createMockWorld({ worldId, userId: USER_ID, currentSeason: SEASON_ID })
    );

    const conflictedPlayer = makePlayer('conflict_rfa', 'BOS', 8_000_000, {
      displayName: 'Conflict Player',
    });
    const lalKeeper = makePlayer('lal_keeper_conflict', 'LAL', 7_000_000);
    const bosOther = makePlayer('bos_other_player', 'BOS', 6_000_000);

    seedBasePlayer(conflictedPlayer);
    seedBasePlayer(lalKeeper);
    seedBasePlayer(bosOther);
    seedTeamSnapshot(worldId, 'LAL', makeTeam('LAL', [lalKeeper]), {
      padRoster: false,
    });
    seedTeamSnapshot(
      worldId,
      'BOS',
      {
        ...makeTeam('BOS', [bosOther]),
        roster: ['conflict_rfa'],
      },
      { padRoster: false }
    );

    const result = await applyWorldMutation({
      userId: USER_ID,
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'storeOfferSheet',
      timestamp: TIMESTAMP,
      payload: {
        teamCode: 'LAL',
        playerId: 'conflict_rfa',
        worldId,
        contract: makeStoredOfferSheetContract(),
        signedUsing: 'Cap Space',
      },
    });

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain(
      'roster membership disagrees with players[] membership'
    );
    expect(getOfferSheets(requireTeamSnapshot(worldId, 'LAL'))).toHaveLength(0);
    expect(
      getIncomingOfferSheets(requireTeamSnapshot(worldId, 'BOS'))
    ).toHaveLength(0);
  });

  it('keeps E4 matched resolution compatible for offer sheets created under the strict store path', async () => {
    const worldId = 'world_offer_sheet_store_to_match_finalize';
    const governed = makeGovernedOfferSheetFixture({
      worldId,
      playerId: 'store_match_rfa',
      homeTeamId: 'BOS',
      offeringTeamId: 'LAL',
      salariesByYear: makeStoredOfferSheetContract().salariesByYear,
    });
    seedWorldMetadata(
      worldId,
      createMockWorld({
        worldId,
        userId: USER_ID,
        currentSeason: SEASON_ID,
        asOfDate: governed.asOfDate,
      })
    );

    const matchedPlayer = makePlayer('store_match_rfa', 'BOS', 9_000_000, {
      displayName: 'Strict Store Match Player',
      contract: makeContract(9_000_000, {
        contractType: 'Standard',
        signingTeam: 'BOS',
      }),
      rfaContext: { governedEvidence: governed.evidence },
    });
    const lalKeeper = makePlayer('lal_keeper_store_match', 'LAL', 7_000_000);

    seedBasePlayer(matchedPlayer);
    seedBasePlayer(lalKeeper);
    seedTeamSnapshot(
      worldId,
      'BOS',
      {
        ...makeTeam(
          'BOS',
          [matchedPlayer],
          [
            {
              playerId: 'store_match_rfa',
              playerName: 'Strict Store Match Player',
              season: SEASON_ID,
              amount: 14_000_000,
              active: true,
              isSigned: false,
            },
          ]
        ),
        incomingOfferSheets: [],
        rightsLedger: governed.rightsLedger,
      },
      { padRoster: false }
    );
    seedTeamSnapshot(
      worldId,
      'LAL',
      {
        ...makeTeam('LAL', [lalKeeper]),
        offerSheets: [],
      },
      { padRoster: false }
    );
    seedPlayerOverride(worldId, 'BOS', matchedPlayer);

    const storeResult = await applyWorldMutation({
      userId: USER_ID,
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'storeOfferSheet',
      timestamp: TIMESTAMP,
      payload: {
        teamCode: 'LAL',
        playerId: 'store_match_rfa',
        worldId,
        contract: makeStoredOfferSheetContract(),
        offerSheetProposal: governed.proposal,
        signedUsing: 'Cap Space',
      },
    });
    expect(storeResult.success, String(storeResult.error)).toBe(true);

    const offerSheetId =
      getOfferSheets(requireTeamSnapshot(worldId, 'LAL'))[0]?.id || null;
    expect(offerSheetId).toBeTruthy();

    // BZE-191: one-click match resolves the sheet atomically (no separate
    // finalize step) — the home team keeps the player on the matched contract
    // and the sheet is removed from both teams in a single mutation. Standalone
    // finalize coverage lives in the directly-seeded finalize* tests below.
    const matchResult = await applyWorldMutation({
      userId: USER_ID,
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'matchOfferSheet',
      timestamp: TIMESTAMP + 1,
      payload: {
        teamCode: 'BOS',
        offeringTeamCode: 'LAL',
        offerSheetId,
        offerSheetResolutionAt: governed.resolutionAt,
      },
    });
    expect(matchResult.success).toBe(true);

    const persistedPlayer = await getPlayer(worldId, 'BOS', 'store_match_rfa');
    expect(persistedPlayer.teamCode).toBe('BOS');
    expect(persistedPlayer.contract?.signedUsing).toBe('Match');
    expect(getOfferSheets(requireTeamSnapshot(worldId, 'LAL'))).toHaveLength(0);
    expect(
      getIncomingOfferSheets(requireTeamSnapshot(worldId, 'BOS'))
    ).toHaveLength(0);
  });

  it('rejects a concurrent Offer Sheet creation computed from stale Team snapshots', async () => {
    const worldId = 'world_offer_sheet_creation_race';
    const playerId = 'creation_race_rfa';
    const governed = makeGovernedOfferSheetFixture({
      worldId,
      playerId,
      homeTeamId: 'BOS',
      offeringTeamId: 'LAL',
      salariesByYear: makeStoredOfferSheetContract().salariesByYear,
    });
    seedWorldMetadata(
      worldId,
      createMockWorld({
        worldId,
        userId: USER_ID,
        currentSeason: SEASON_ID,
        asOfDate: governed.asOfDate,
      })
    );

    const player = makePlayer(playerId, 'BOS', 9_000_000, {
      displayName: 'Creation Race Player',
      contract: makeContract(9_000_000, {
        contractType: 'Standard',
        signingTeam: 'BOS',
      }),
      rfaContext: { governedEvidence: governed.evidence },
    });
    const lalKeeper = makePlayer('lal_keeper_creation_race', 'LAL', 7_000_000);
    seedBasePlayer(player);
    seedBasePlayer(lalKeeper);
    seedTeamSnapshot(
      worldId,
      'BOS',
      {
        ...makeTeam('BOS', [player]),
        incomingOfferSheets: [],
        rightsLedger: governed.rightsLedger,
      },
      { padRoster: false }
    );
    seedTeamSnapshot(
      worldId,
      'LAL',
      { ...makeTeam('LAL', [lalKeeper]), offerSheets: [] },
      { padRoster: false }
    );

    const payload = {
      teamCode: 'LAL',
      playerId,
      worldId,
      contract: makeStoredOfferSheetContract(),
      offerSheetProposal: governed.proposal,
      signedUsing: 'Cap Space',
    };
    const staleState = await loadStateForMutation(
      worldId,
      'storeOfferSheet',
      payload
    );
    const firstCreation = computeWorldMutation({
      mutationType: 'storeOfferSheet',
      payload,
      currentState: staleState,
      seasonId: SEASON_ID,
      timestamp: TIMESTAMP,
      asOfDate: governed.asOfDate,
      worldId,
    });
    const staleCreation = computeWorldMutation({
      mutationType: 'storeOfferSheet',
      payload,
      currentState: staleState,
      seasonId: SEASON_ID,
      timestamp: TIMESTAMP + 1,
      asOfDate: governed.asOfDate,
      worldId,
    });
    expect(firstCreation.success, String(firstCreation.error)).toBe(true);
    expect(staleCreation.success, String(staleCreation.error)).toBe(true);

    const firstPersisted = await persistWorldMutation({
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'storeOfferSheet',
      computeResult: firstCreation,
      committedTeamUpdates: buildGeneralMutationCommittedTeamUpdates(
        firstCreation.teamUpdates,
        SEASON_ID
      ),
      timestamp: TIMESTAMP,
    });
    expect(firstPersisted.success, String(firstPersisted.error)).toBe(true);
    const firstOfferSheetId = requireValue(
      getOfferSheets(requireTeamSnapshot(worldId, 'LAL'))[0]?.id,
      'Expected the winning Offer Sheet to persist'
    );
    const eventCountAfterWinner = [...getAllMockData().keys()].filter((key) =>
      key.includes('/events/')
    ).length;

    const stalePersisted = await persistWorldMutation({
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'storeOfferSheet',
      computeResult: staleCreation,
      committedTeamUpdates: buildGeneralMutationCommittedTeamUpdates(
        staleCreation.teamUpdates,
        SEASON_ID
      ),
      timestamp: TIMESTAMP + 1,
    });

    expect(stalePersisted.success).toBe(false);
    if (!stalePersisted.success) {
      expect(stalePersisted.error).toContain('changed before commit');
    }
    expect(getOfferSheets(requireTeamSnapshot(worldId, 'LAL'))).toMatchObject([
      { id: firstOfferSheetId },
    ]);
    expect(
      getIncomingOfferSheets(requireTeamSnapshot(worldId, 'BOS'))
    ).toMatchObject([{ id: firstOfferSheetId }]);
    expect(
      [...getAllMockData().keys()].filter((key) => key.includes('/events/'))
    ).toHaveLength(eventCountAfterWinner);
  });

  it('rejects identically tampered Team mirrors before resolving an Offer Sheet', async () => {
    const worldId = 'world_offer_sheet_tampered_mirrors';
    const playerId = 'tampered_mirror_rfa';
    const governed = makeGovernedOfferSheetFixture({
      worldId,
      playerId,
      homeTeamId: 'BOS',
      offeringTeamId: 'LAL',
      salariesByYear: makeStoredOfferSheetContract().salariesByYear,
    });
    seedWorldMetadata(
      worldId,
      createMockWorld({
        worldId,
        userId: USER_ID,
        currentSeason: SEASON_ID,
        asOfDate: governed.asOfDate,
      })
    );

    const player = makePlayer(playerId, 'BOS', 9_000_000, {
      displayName: 'Tampered Mirror Player',
      contract: makeContract(9_000_000, {
        contractType: 'Standard',
        signingTeam: 'BOS',
      }),
      rfaContext: { governedEvidence: governed.evidence },
    });
    const lalKeeper = makePlayer(
      'lal_keeper_tampered_mirror',
      'LAL',
      7_000_000
    );
    seedBasePlayer(player);
    seedBasePlayer(lalKeeper);
    seedTeamSnapshot(
      worldId,
      'BOS',
      {
        ...makeTeam('BOS', [player]),
        incomingOfferSheets: [],
        rightsLedger: governed.rightsLedger,
      },
      { padRoster: false }
    );
    seedTeamSnapshot(
      worldId,
      'LAL',
      { ...makeTeam('LAL', [lalKeeper]), offerSheets: [] },
      { padRoster: false }
    );

    const stored = await applyWorldMutation({
      userId: USER_ID,
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'storeOfferSheet',
      timestamp: TIMESTAMP,
      payload: {
        teamCode: 'LAL',
        playerId,
        worldId,
        contract: makeStoredOfferSheetContract(),
        offerSheetProposal: governed.proposal,
        signedUsing: 'Cap Space',
      },
    });
    expect(stored.success, String(stored.error)).toBe(true);

    const homeBeforeTamper = requireTeamSnapshot(worldId, 'BOS');
    const offeringBeforeTamper = requireTeamSnapshot(worldId, 'LAL');
    const originalSheet = requireValue(
      getOfferSheets(offeringBeforeTamper)[0],
      'Expected a pending Offer Sheet before mirror tampering'
    );
    const originalLifecycle = GovernedOfferSheetLifecycleZ.parse(
      originalSheet.governedLifecycle
    );
    const tamperedLifecycle = GovernedOfferSheetLifecycleZ.parse({
      ...originalLifecycle,
      evidenceSnapshot: {
        ...originalLifecycle.evidenceSnapshot,
        homeTeamMatchingAuthority: {
          ...originalLifecycle.evidenceSnapshot.homeTeamMatchingAuthority,
          amount:
            originalLifecycle.evidenceSnapshot.homeTeamMatchingAuthority
              .amount + 1,
        },
      },
      reservations: {
        ...originalLifecycle.reservations,
        offeringTeam: originalLifecycle.reservations.offeringTeam.map(
          (reservation, index) =>
            index === 0
              ? { ...reservation, amount: reservation.amount - 1 }
              : reservation
        ),
      },
      events: originalLifecycle.events.map((event) =>
        event.eventKind === 'offer-sheet-signed'
          ? {
              ...event,
              proposal: {
                ...event.proposal,
                principalTermsDocumentId: 'tampered-principal-terms',
              },
            }
          : event
      ),
    });
    const tamperedSheet = {
      ...originalSheet,
      governedLifecycle: tamperedLifecycle,
    };
    seedMockData(`architect_worlds/${worldId}/teams/BOS`, {
      ...homeBeforeTamper,
      incomingOfferSheets: [tamperedSheet],
    });
    seedMockData(`architect_worlds/${worldId}/teams/LAL`, {
      ...offeringBeforeTamper,
      offerSheets: [tamperedSheet],
    });
    const eventCountBeforeResolution = [...getAllMockData().keys()].filter(
      (key) => key.includes('/events/')
    ).length;

    const result = await applyWorldMutation({
      userId: USER_ID,
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'matchOfferSheet',
      timestamp: TIMESTAMP + 1,
      payload: {
        teamCode: 'BOS',
        offeringTeamCode: 'LAL',
        offerSheetId: originalSheet.id,
        offerSheetResolutionAt: governed.resolutionAt,
      },
    });

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain('authorization');
    expect(
      GovernedOfferSheetLifecycleZ.parse(
        getOfferSheets(requireTeamSnapshot(worldId, 'LAL'))[0]
          ?.governedLifecycle
      ).events[0]
    ).toMatchObject({
      proposal: { principalTermsDocumentId: 'tampered-principal-terms' },
    });
    expect(
      [...getAllMockData().keys()].filter((key) => key.includes('/events/'))
    ).toHaveLength(eventCountBeforeResolution);
  });

  it('rejects a stale competing resolution without overwriting the committed lifecycle', async () => {
    const worldId = 'world_offer_sheet_resolution_race';
    const governed = makeGovernedOfferSheetFixture({
      worldId,
      playerId: 'resolution_race_rfa',
      homeTeamId: 'BOS',
      offeringTeamId: 'LAL',
      salariesByYear: makeStoredOfferSheetContract().salariesByYear,
    });
    seedWorldMetadata(
      worldId,
      createMockWorld({
        worldId,
        userId: USER_ID,
        currentSeason: SEASON_ID,
        asOfDate: governed.asOfDate,
      })
    );

    const player = makePlayer('resolution_race_rfa', 'BOS', 9_000_000, {
      displayName: 'Resolution Race Player',
      contract: makeContract(9_000_000, {
        contractType: 'Standard',
        signingTeam: 'BOS',
      }),
      rfaContext: { governedEvidence: governed.evidence },
    });
    const lalKeeper = makePlayer(
      'lal_keeper_resolution_race',
      'LAL',
      7_000_000
    );
    seedBasePlayer(player);
    seedBasePlayer(lalKeeper);
    seedTeamSnapshot(
      worldId,
      'BOS',
      {
        ...makeTeam('BOS', [player]),
        incomingOfferSheets: [],
        rightsLedger: governed.rightsLedger,
      },
      { padRoster: false }
    );
    seedTeamSnapshot(
      worldId,
      'LAL',
      { ...makeTeam('LAL', [lalKeeper]), offerSheets: [] },
      { padRoster: false }
    );
    seedPlayerOverride(worldId, 'BOS', player);

    const stored = await applyWorldMutation({
      userId: USER_ID,
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'storeOfferSheet',
      timestamp: TIMESTAMP,
      payload: {
        teamCode: 'LAL',
        playerId: 'resolution_race_rfa',
        worldId,
        contract: makeStoredOfferSheetContract(),
        offerSheetProposal: governed.proposal,
        signedUsing: 'Cap Space',
      },
    });
    expect(stored.success, String(stored.error)).toBe(true);

    const offerSheetId = requireValue(
      getOfferSheets(requireTeamSnapshot(worldId, 'LAL'))[0]?.id,
      'Expected a pending Offer Sheet for the concurrency fixture'
    );
    const resolutionPayload = {
      teamCode: 'BOS',
      homeTeamCode: 'BOS',
      offeringTeamCode: 'LAL',
      offerSheetId,
      offerSheetResolutionAt: governed.resolutionAt,
    };
    const currentState = await loadStateForMutation(
      worldId,
      'matchOfferSheet',
      resolutionPayload
    );
    const commonComputeInput = {
      payload: resolutionPayload,
      currentState,
      seasonId: SEASON_ID,
      timestamp: TIMESTAMP + 1,
      asOfDate: governed.asOfDate,
      worldId,
    };
    const winningMatch = computeWorldMutation({
      mutationType: 'matchOfferSheet',
      ...commonComputeInput,
    });
    const staleDecline = computeWorldMutation({
      mutationType: 'declineOfferSheet',
      ...commonComputeInput,
    });
    expect(winningMatch.success, String(winningMatch.error)).toBe(true);
    expect(staleDecline.success, String(staleDecline.error)).toBe(true);

    const offeringBeforeConcurrentEdit = requireTeamSnapshot(worldId, 'LAL');
    const eventCountBeforeConcurrentEdit = [...getAllMockData().keys()].filter(
      (key) => key.includes('/events/')
    ).length;
    seedMockData(`architect_worlds/${worldId}/teams/LAL`, {
      ...offeringBeforeConcurrentEdit,
      teamName: 'Concurrent unrelated Team edit',
    });

    const staleAfterUnrelatedEdit = await persistWorldMutation({
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'matchOfferSheet',
      computeResult: winningMatch,
      committedTeamUpdates: winningMatch.teamUpdates ?? [],
      timestamp: TIMESTAMP + 1,
    });
    expect(staleAfterUnrelatedEdit.success).toBe(false);
    if (!staleAfterUnrelatedEdit.success) {
      expect(staleAfterUnrelatedEdit.error).toContain('changed before commit');
    }
    expect(requireTeamSnapshot(worldId, 'LAL').teamName).toBe(
      'Concurrent unrelated Team edit'
    );
    expect(
      [...getAllMockData().keys()].filter((key) => key.includes('/events/'))
    ).toHaveLength(eventCountBeforeConcurrentEdit);

    seedMockData(
      `architect_worlds/${worldId}/teams/LAL`,
      offeringBeforeConcurrentEdit
    );

    const homePlayerPath = `architect_worlds/${worldId}/teams/BOS/players/resolution_race_rfa`;
    const homePlayerBeforeConcurrentEdit = requireValue(
      getAllMockData().get(homePlayerPath),
      'Expected a home player override for the concurrency fixture'
    );
    seedMockData(homePlayerPath, {
      ...(homePlayerBeforeConcurrentEdit as Record<string, unknown>),
      displayName: 'Concurrent player override edit',
    });

    const staleAfterPlayerEdit = await persistWorldMutation({
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'matchOfferSheet',
      computeResult: winningMatch,
      committedTeamUpdates: winningMatch.teamUpdates ?? [],
      timestamp: TIMESTAMP + 1,
    });
    expect(staleAfterPlayerEdit.success).toBe(false);
    if (!staleAfterPlayerEdit.success) {
      expect(staleAfterPlayerEdit.error).toContain('changed before commit');
    }
    expect(getAllMockData().get(homePlayerPath)).toMatchObject({
      displayName: 'Concurrent player override edit',
    });
    expect(
      [...getAllMockData().keys()].filter((key) => key.includes('/events/'))
    ).toHaveLength(eventCountBeforeConcurrentEdit);

    seedMockData(homePlayerPath, homePlayerBeforeConcurrentEdit);

    const winnerPersisted = await persistWorldMutation({
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'matchOfferSheet',
      computeResult: winningMatch,
      committedTeamUpdates: winningMatch.teamUpdates ?? [],
      timestamp: TIMESTAMP + 1,
    });
    expect(winnerPersisted.success, String(winnerPersisted.error)).toBe(true);

    const homeAfterWinner = JSON.stringify(requireTeamSnapshot(worldId, 'BOS'));
    const offeringAfterWinner = JSON.stringify(
      requireTeamSnapshot(worldId, 'LAL')
    );
    const eventCountAfterWinner = [...getAllMockData().keys()].filter((key) =>
      key.includes('/events/')
    ).length;

    const stalePersisted = await persistWorldMutation({
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'declineOfferSheet',
      computeResult: staleDecline,
      committedTeamUpdates: staleDecline.teamUpdates ?? [],
      timestamp: TIMESTAMP + 2,
    });

    expect(stalePersisted.success).toBe(false);
    if (!stalePersisted.success) {
      expect(stalePersisted.error).toContain('changed before commit');
    }
    expect(JSON.stringify(requireTeamSnapshot(worldId, 'BOS'))).toBe(
      homeAfterWinner
    );
    expect(JSON.stringify(requireTeamSnapshot(worldId, 'LAL'))).toBe(
      offeringAfterWinner
    );
    expect(
      [...getAllMockData().keys()].filter((key) => key.includes('/events/'))
    ).toHaveLength(eventCountAfterWinner);
  });

  it('keeps E4 declined resolution compatible for offer sheets created under the strict store path', async () => {
    const worldId = 'world_offer_sheet_store_to_decline_finalize';
    const governed = makeGovernedOfferSheetFixture({
      worldId,
      playerId: 'store_decline_rfa',
      homeTeamId: 'BOS',
      offeringTeamId: 'LAL',
      salariesByYear: makeStoredOfferSheetContract().salariesByYear,
    });
    seedWorldMetadata(
      worldId,
      createMockWorld({
        worldId,
        userId: USER_ID,
        currentSeason: SEASON_ID,
        asOfDate: governed.asOfDate,
      })
    );

    const declinedPlayer = makePlayer('store_decline_rfa', 'BOS', 8_500_000, {
      displayName: 'Strict Store Decline Player',
      contract: makeContract(8_500_000, {
        contractType: 'Standard',
        signingTeam: 'BOS',
      }),
      rfaContext: { governedEvidence: governed.evidence },
    });
    const lalKeeper = makePlayer('lal_keeper_store_decline', 'LAL', 6_500_000);

    seedBasePlayer(declinedPlayer);
    seedBasePlayer(lalKeeper);
    seedTeamSnapshot(
      worldId,
      'BOS',
      {
        ...makeTeam(
          'BOS',
          [declinedPlayer],
          [
            {
              playerId: 'store_decline_rfa',
              playerName: 'Strict Store Decline Player',
              season: SEASON_ID,
              amount: 13_500_000,
              active: true,
              isSigned: false,
            },
          ]
        ),
        incomingOfferSheets: [],
        rightsLedger: governed.rightsLedger,
      },
      { padRoster: false }
    );
    seedTeamSnapshot(
      worldId,
      'LAL',
      {
        ...makeTeam(
          'LAL',
          [lalKeeper],
          [
            {
              playerId: 'store_decline_rfa',
              playerName: 'Strict Store Decline Player',
              season: SEASON_ID,
              amount: 3_500_000,
              active: true,
              isSigned: false,
            },
          ]
        ),
        offerSheets: [],
      },
      { padRoster: false }
    );
    seedPlayerOverride(worldId, 'BOS', declinedPlayer);

    const storeResult = await applyWorldMutation({
      userId: USER_ID,
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'storeOfferSheet',
      timestamp: TIMESTAMP,
      payload: {
        teamCode: 'LAL',
        playerId: 'store_decline_rfa',
        worldId,
        contract: makeStoredOfferSheetContract(),
        offerSheetProposal: governed.proposal,
        signedUsing: 'Cap Space',
      },
    });
    expect(storeResult.success, String(storeResult.error)).toBe(true);

    const storedOfferSheet = requireValue(
      getOfferSheets(requireTeamSnapshot(worldId, 'LAL'))[0],
      'Expected stored offer sheet for declined finalization path'
    );

    // BZE-191: one-click decline resolves the sheet atomically (no separate
    // finalize step) — the player + cap move to the offering team and the sheet
    // is removed from both teams in a single mutation. Standalone finalize
    // coverage lives in the directly-seeded finalize* tests below.
    const declineResult = await applyWorldMutation({
      userId: USER_ID,
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'declineOfferSheet',
      timestamp: TIMESTAMP + 1,
      payload: {
        teamCode: 'BOS',
        offeringTeamCode: 'LAL',
        offerSheetId: storedOfferSheet.id,
        offerSheetResolutionAt: governed.resolutionAt,
      },
    });
    expect(declineResult.success).toBe(true);

    const persistedPlayer = await getPlayer(
      worldId,
      'LAL',
      'store_decline_rfa'
    );
    expect(persistedPlayer.teamCode).toBe('LAL');
    expect(persistedPlayer.contract?.signedUsing).toBe('Offer Sheet');
    expect(getOfferSheets(requireTeamSnapshot(worldId, 'LAL'))).toHaveLength(0);
    expect(
      getIncomingOfferSheets(requireTeamSnapshot(worldId, 'BOS'))
    ).toHaveLength(0);
    expect(requireTeamSnapshot(worldId, 'BOS').roster).not.toContain(
      'store_decline_rfa'
    );
  });

  it('persists finalizeMatchedOfferSheet as a same-team canonical upsert with no delete path', async () => {
    const worldId = 'world_offer_sheet_matched_truth';
    const governed = makeGovernedOfferSheetFixture({
      worldId,
      playerId: 'matched_rfa',
      homeTeamId: 'BOS',
      offeringTeamId: 'LAL',
      offerSheetId: 'os_match_truth',
      salariesByYear: makeOfferSheet().salariesByYear,
    });
    seedWorldMetadata(
      worldId,
      createMockWorld({
        worldId,
        userId: USER_ID,
        currentSeason: SEASON_ID,
        asOfDate: governed.asOfDate,
      })
    );

    const matchedPlayer = makePlayer('matched_rfa', 'BOS', 9_000_000, {
      displayName: 'Canonical Matched Player',
      contract: makeContract(9_000_000, {
        contractType: 'Standard',
        signingTeam: 'BOS',
      }),
      rfaContext: { governedEvidence: governed.evidence },
    });
    const lalKeeper = makePlayer('lal_keeper', 'LAL', 7_000_000);
    const matchedOfferSheet = makeOfferSheet({
      id: 'os_match_truth',
      dedupKey: `os:${worldId}:LAL:matched_rfa:${SEASON_ID}`,
      playerId: 'matched_rfa',
      playerName: 'Offer Sheet Fragment Name',
      offeringTeamCode: 'LAL',
      homeTeamCode: 'BOS',
      status: 'MATCHED',
      totalValue: 77_582_250,
      governedLifecycle: governed.lifecycle,
    });

    seedBasePlayer(matchedPlayer);
    seedBasePlayer(lalKeeper);
    seedOfferSheetAuthorization(worldId, matchedOfferSheet);
    seedTeamSnapshot(
      worldId,
      'BOS',
      {
        ...makeTeam(
          'BOS',
          [matchedPlayer],
          [
            {
              playerId: 'matched_rfa',
              playerName: 'Canonical Matched Player',
              season: SEASON_ID,
              amount: 14_000_000,
              active: true,
              isSigned: false,
            },
          ]
        ),
        incomingOfferSheets: [matchedOfferSheet],
      },
      { padRoster: false }
    );
    seedTeamSnapshot(
      worldId,
      'LAL',
      {
        ...makeTeam('LAL', [lalKeeper]),
        offerSheets: [matchedOfferSheet],
      },
      { padRoster: false }
    );
    seedPlayerOverride(worldId, 'BOS', matchedPlayer);

    const result = await applyWorldMutation({
      userId: USER_ID,
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'finalizeMatchedOfferSheet',
      timestamp: TIMESTAMP,
      payload: {
        teamCode: 'BOS',
        offeringTeamCode: 'LAL',
        offerSheetId: matchedOfferSheet.id,
        offerSheetResolutionAt: governed.resolutionAt,
      },
    });

    expect(result.success, String(result.error)).toBe(true);
    expect(result.changedPlayers?.map((entry) => entry.playerId)).toEqual([
      'matched_rfa',
    ]);
    expect(result.writesSummary?.playersPatched).toBe(1);

    const homeSnapshot = requireTeamSnapshot(worldId, 'BOS');
    const offeringSnapshot = requireTeamSnapshot(worldId, 'LAL');
    expect(getIncomingOfferSheets(homeSnapshot)).toHaveLength(0);
    expect(getOfferSheets(offeringSnapshot)).toHaveLength(0);
    expect(
      (homeSnapshot.capHolds || []).some(
        (hold: TradeCapHoldFixture) => hold.playerId === 'matched_rfa'
      )
    ).toBe(false);

    const homeOverride = await getDoc(
      worldPlayerRef(worldId, 'BOS', 'matched_rfa')
    );
    const unexpectedOfferingOverride = await getDoc(
      worldPlayerRef(worldId, 'LAL', 'matched_rfa')
    );
    expect(homeOverride.exists()).toBe(true);
    expect(unexpectedOfferingOverride.exists()).toBe(false);

    const persistedPlayer = await getPlayer(worldId, 'BOS', 'matched_rfa');
    expect(persistedPlayer.teamCode).toBe('BOS');
    expect(persistedPlayer.displayName).toBe('Canonical Matched Player');
    expect(persistedPlayer.contract?.signedUsing).toBe('Match');
    expect(persistedPlayer.contract?.signingTeam).toBe('BOS');
    expect(persistedPlayer.contract?.contractLength).toBe(4);
    expect(persistedPlayer.contract?.salariesByYear?.[0]?.salary).toBe(
      18_000_000
    );
  });

  it('persists finalizeDeclinedOfferSheet as canonical movement with destination upsert and source delete', async () => {
    const worldId = 'world_offer_sheet_declined_truth';
    const governed = makeGovernedOfferSheetFixture({
      worldId,
      playerId: 'declined_rfa',
      homeTeamId: 'BOS',
      offeringTeamId: 'LAL',
      offerSheetId: 'os_decline_truth',
      salariesByYear: makeOfferSheet().salariesByYear,
    });
    seedWorldMetadata(
      worldId,
      createMockWorld({
        worldId,
        userId: USER_ID,
        currentSeason: SEASON_ID,
        asOfDate: governed.asOfDate,
      })
    );

    const declinedPlayer = makePlayer('declined_rfa', 'BOS', 8_000_000, {
      displayName: 'Canonical Declined Player',
      contract: makeContract(8_000_000, {
        contractType: 'Standard',
        signingTeam: 'BOS',
      }),
      rfaContext: { governedEvidence: governed.evidence },
    });
    const lalKeeper = makePlayer('lal_keeper_2', 'LAL', 6_500_000);
    const declinedOfferSheet = makeOfferSheet({
      id: 'os_decline_truth',
      dedupKey: `os:${worldId}:LAL:declined_rfa:${SEASON_ID}`,
      playerId: 'declined_rfa',
      playerName: 'Fragment-Only Name',
      offeringTeamCode: 'LAL',
      homeTeamCode: 'BOS',
      status: 'DECLINED',
      totalValue: 77_582_250,
      governedLifecycle: governed.lifecycle,
    });

    seedBasePlayer(declinedPlayer);
    seedBasePlayer(lalKeeper);
    seedOfferSheetAuthorization(worldId, declinedOfferSheet);
    seedTeamSnapshot(
      worldId,
      'BOS',
      {
        ...makeTeam(
          'BOS',
          [declinedPlayer],
          [
            {
              playerId: 'declined_rfa',
              playerName: 'Canonical Declined Player',
              season: SEASON_ID,
              amount: 13_500_000,
              active: true,
              isSigned: false,
            },
          ]
        ),
        incomingOfferSheets: [declinedOfferSheet],
      },
      { padRoster: false }
    );
    seedTeamSnapshot(
      worldId,
      'LAL',
      {
        ...makeTeam(
          'LAL',
          [lalKeeper],
          [
            {
              playerId: 'declined_rfa',
              playerName: 'Canonical Declined Player',
              season: SEASON_ID,
              amount: 3_500_000,
              active: true,
              isSigned: false,
            },
          ]
        ),
        offerSheets: [declinedOfferSheet],
      },
      { padRoster: false }
    );
    seedPlayerOverride(worldId, 'BOS', declinedPlayer);

    const result = await applyWorldMutation({
      userId: USER_ID,
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'finalizeDeclinedOfferSheet',
      timestamp: TIMESTAMP,
      payload: {
        teamCode: 'LAL',
        homeTeamCode: 'BOS',
        offeringTeamCode: 'LAL',
        offerSheetId: declinedOfferSheet.id,
        dedupKey: declinedOfferSheet.dedupKey,
        offerSheetResolutionAt: governed.resolutionAt,
      },
    });

    expect(result.success, String(result.error)).toBe(true);
    expect(result.changedPlayers?.map((entry) => entry.playerId)).toEqual([
      'declined_rfa',
    ]);

    const homeSnapshot = requireTeamSnapshot(worldId, 'BOS');
    const offeringSnapshot = requireTeamSnapshot(worldId, 'LAL');
    expect(homeSnapshot.roster).not.toContain('declined_rfa');
    expect(offeringSnapshot.roster).toContain('declined_rfa');
    expect(getIncomingOfferSheets(homeSnapshot)).toHaveLength(0);
    expect(getOfferSheets(offeringSnapshot)).toHaveLength(0);
    expect(
      (homeSnapshot.capHolds || []).some(
        (hold: TradeCapHoldFixture) => hold.playerId === 'declined_rfa'
      )
    ).toBe(false);
    expect(
      (offeringSnapshot.capHolds || []).some(
        (hold: TradeCapHoldFixture) => hold.playerId === 'declined_rfa'
      )
    ).toBe(false);

    const deletedSourceOverride = await getDoc(
      worldPlayerRef(worldId, 'BOS', 'declined_rfa')
    );
    const destinationOverride = await getDoc(
      worldPlayerRef(worldId, 'LAL', 'declined_rfa')
    );
    expect(deletedSourceOverride.exists()).toBe(false);
    expect(destinationOverride.exists()).toBe(true);

    const movedPlayer = await getPlayer(worldId, 'LAL', 'declined_rfa');
    expect(movedPlayer.teamCode).toBe('LAL');
    expect(movedPlayer.displayName).toBe('Canonical Declined Player');
    expect(movedPlayer.displayName).not.toBe('Fragment-Only Name');
    expect(movedPlayer.contract?.signedUsing).toBe('Offer Sheet');
    expect(movedPlayer.contract?.signingTeam).toBe('LAL');
    expect(movedPlayer.contract?.contractLength).toBe(4);
    expect(movedPlayer.contract?.salariesByYear?.[0]?.salary).toBe(18_000_000);
  });

  it('fails closed when duplicate move candidates resolve to conflicting destinations', () => {
    const duplicatePlayer = makePlayer('dup_player', 'LAL', 9_000_000);
    const currentState: ExecuteTradeCurrentState = {
      teams: [
        {
          teamCode: 'LAL',
          team: toExecuteTradeCurrentStateTeam(
            makeTeam('LAL', [duplicatePlayer])
          ),
        },
        {
          teamCode: 'BOS',
          team: toExecuteTradeCurrentStateTeam(makeTeam('BOS', [])),
        },
        {
          teamCode: 'NYK',
          team: toExecuteTradeCurrentStateTeam(makeTeam('NYK', [])),
        },
      ],
    };

    const result = computeWorldMutation({
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'LAL',
            sends: [
              { ...duplicatePlayer, tradeTo: 'BOS' },
              { ...duplicatePlayer, tradeTo: 'NYK' },
            ],
            entitlementsOut: [],
          },
          { teamCode: 'BOS', sends: [], entitlementsOut: [] },
          { teamCode: 'NYK', sends: [], entitlementsOut: [] },
        ],
      },
      currentState,
      seasonId: SEASON_ID,
      timestamp: TIMESTAMP,
      worldId: 'world_conflict_trade_truth',
    });

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain('conflicting destinations');
  });

  it('rejects legacy non-trade extension blobs without mutation writes', () => {
    const player = makePlayer('extend_player', 'LAL', 12_000_000, {
      futureContract: {
        salariesByYear: [],
      },
    });
    const currentState: ExtendPlayerCurrentState = {
      team: toExtendPlayerCurrentStateTeam(makeTeam('LAL', [player])),
      player,
      teamCode: 'LAL',
    };

    const result = computeWorldMutation({
      mutationType: 'extendPlayer',
      payload: {
        teamCode: 'LAL',
        playerId: 'extend_player',
        extension: {
          salariesByYear: [
            { season: '2027-28', salary: 14_000_000, capHit: 14_000_000 },
          ],
        },
      },
      currentState,
      seasonId: SEASON_ID,
      timestamp: TIMESTAMP,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Governed extension requires');
    expect(result.playerDeletes).toEqual([]);
    expect(result.playerUpdates).toBeUndefined();
    expect(result.teamUpdates).toBeUndefined();
  });
});
