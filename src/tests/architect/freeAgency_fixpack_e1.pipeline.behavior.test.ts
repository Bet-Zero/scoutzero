import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyWorldMutation } from '@/features/architect/utils/mutationPipeline';
import { getPlayer, getTeam } from '@/features/architect/utils/teamLoader';
import { updateWorldStats } from '@/features/architect/utils/worldManager';
import { makeRightsLedgerForIdentity } from '../../../tests/fixtures/architect/rightsHistory';

type LoadedTeam = Awaited<ReturnType<typeof getTeam>>;
type LoadedPlayer = Awaited<ReturnType<typeof getPlayer>>;
type ApplyWorldMutationResult = Awaited<ReturnType<typeof applyWorldMutation>>;
type RenouncedPlayerView = {
  rightsRenounced?: boolean;
  contract?: {
    birdRights?: {
      status?: string | null;
    } | null;
  } | null;
};

const requireValue = <T,>(value: T | null | undefined, label: string): T => {
  if (value == null) {
    throw new Error(`${label} is required`);
  }

  return value;
};

const getWritesSummary = (result: ApplyWorldMutationResult) =>
  requireValue(result.writesSummary, 'result.writesSummary');

const getChangedTeam = (
  result: ApplyWorldMutationResult,
  expectedTeamCode: string
) =>
  requireValue(
    result.changedTeams?.find((entry) => entry.teamCode === expectedTeamCode)?.team,
    `changed team ${expectedTeamCode}`
  );

const mockedGetTeam = vi.mocked(getTeam);
const mockedGetPlayer = vi.mocked(getPlayer);
const mockedUpdateWorldStats = vi.mocked(updateWorldStats);

const firestoreMocks = vi.hoisted(() => ({
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  batchCommit: vi.fn(async () => {}),
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
}));

vi.mock('@/firebaseConfig', () => ({
  db: 'db',
}));

vi.mock('firebase/firestore', () => ({
  writeBatch: vi.fn(() => ({
    set: firestoreMocks.batchSet,
    update: firestoreMocks.batchUpdate,
    commit: firestoreMocks.batchCommit,
  })),
  getDoc: firestoreMocks.getDoc,
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  collection: vi.fn((...segments) => segments.map(String).join('/')),
  doc: vi.fn((...segments) => segments.map(String).join('/')),
}));

vi.mock('@/features/architect/utils/teamLoader', () => ({
  getTeam: vi.fn(),
  getPlayer: vi.fn(),
  getLeague: vi.fn(async () => []),
  mergePlayerOverride: vi.fn((base, override) =>
    override ? { ...base, ...override } : base
  ),
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  updateWorldStats: vi.fn(async () => {}),
  getWorldMetadata: vi.fn(async () => ({
    asOfDate: '2026-07-15',
    rightsLedgerVersion: 1,
  })),
}));

vi.mock('@/features/architect/utils/capLegalityValidation', () => ({
  validateSigning: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateWaive: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateExtension: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateOptionDecision: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
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
  validateTrade: vi.fn(() => ({ valid: true, success: true, legal: true })),
}));

vi.mock('@/features/architect/utils/capLegality/postStateCapValidator', () => ({
  POST_STATE_CAP_VALIDATOR_VERSION: 'test-post-state-validator',
  validatePostStateCapLegality: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
}));

describe('FREE_AGENCY_FIXPACK_E1 pipeline closure behaviors', () => {
  const userId = 'user_1';
  const worldId = 'world_1';
  const seasonId = '2026-27';
  const teamCode = 'LAL';
  const playerId = 'player_1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Group A/D: signFreeAgent persists world writes and consumes selected exception usage', async () => {
    const team = {
      teamCode,
      teamName: 'Lakers',
      roster: [],
      players: [],
      capHolds: [
        {
          playerId,
          playerName: 'Test Player',
          amount: 9_000_000,
          season: seasonId,
          type: 'bird',
          active: true,
          isSigned: false,
        },
      ],
      exceptions: {
        tpmle: {
          enabled: true,
          maxAmount: 5_685_000,
          totalAmount: 5_685_000,
          usedAmount: 0,
          remainingAmount: 5_685_000,
        },
      },
      totals: {
        capHit: 0,
        totalSalary: 0,
      },
      source: {
        type: 'world-snapshot',
      },
    };
    const player = {
      displayName: 'Test Player',
      contract: {
        salariesByYear: [],
      },
    };
    const signingContract = {
      salariesByYear: [
        {
          season: seasonId,
          salary: 5_000_000,
          capHit: 5_000_000,
          guaranteed: true,
        },
      ],
      totalValue: 5_000_000,
      exceptionType: 'Taxpayer MLE',
    };

    mockedGetTeam.mockResolvedValue(team as LoadedTeam);
    mockedGetPlayer.mockResolvedValue(player as LoadedPlayer);

    const result = await applyWorldMutation({
      userId,
      worldId,
      seasonId,
      mutationType: 'signFreeAgent',
      payload: {
        teamCode,
        playerId,
        contract: signingContract,
        signedUsing: null,
      },
    });

    const writesSummary = getWritesSummary(result);
    const changedTeam = getChangedTeam(result, teamCode);
    const tpmle = requireValue(changedTeam.exceptions?.tpmle, 'changedTeam.exceptions.tpmle');

    expect(result.success).toBe(true);
    expect(result.appliedToLocalState).toBe(true);
    expect(result.persistedToWorld).toBe(true);
    expect(writesSummary.teamsPatched).toBeGreaterThan(0);
    expect(writesSummary.playersPatched).toBeGreaterThan(0);
    expect(writesSummary.eventsWritten).toBeGreaterThan(0);
    expect(writesSummary.worldMetadataPatched).toBeGreaterThan(0);

    expect(changedTeam).toBeDefined();
    expect(tpmle.usedAmount).toBe(5_000_000);
    expect(tpmle.remainingAmount).toBe(685_000);

    const setPaths = firestoreMocks.batchSet.mock.calls.map(([ref]) => String(ref));
    expect(setPaths.some((path) => path.includes('architect_worlds/world_1/teams/LAL'))).toBe(
      true
    );
    expect(
      setPaths.some((path) =>
        path.includes('architect_worlds/world_1/teams/LAL/players/player_1')
      )
    ).toBe(true);
    expect(setPaths.some((path) => path.includes('signFreeAgent_'))).toBe(true);
    expect(
      setPaths.some(
        (path) => path.includes('/teams/') && !path.includes('/architect_worlds/')
      )
    ).toBe(false);
    expect(mockedUpdateWorldStats).toHaveBeenCalledWith(
      worldId,
      'signing',
      expect.arrayContaining([teamCode])
    );
  });

  it('Group C: renounceRights removes hold and persists event-backed world writes', async () => {
    const team = {
      teamCode,
      teamName: 'Lakers',
      roster: [playerId],
      players: [
        {
          id: playerId,
          player_id: playerId,
          name: 'Test Player',
          displayName: 'Test Player',
          rightsRenounced: false,
          contract: {
            birdRights: {
              status: 'Early Bird',
            },
          },
        },
      ],
      capHolds: [
        {
          playerId,
          playerName: 'Test Player',
          amount: 9_000_000,
          season: seasonId,
          type: 'bird',
          active: true,
          isSigned: false,
        },
      ],
      totals: {
        capHit: 120_000_000,
      },
      source: {
        type: 'world-snapshot',
      },
      rightsLedger: makeRightsLedgerForIdentity({
        worldId,
        teamId: teamCode,
        playerId,
      }),
    };
    const player = {
      id: playerId,
      player_id: playerId,
      name: 'Test Player',
      displayName: 'Test Player',
      contract: {
        birdRights: {
          status: 'Early Bird',
        },
      },
    };

    mockedGetTeam.mockResolvedValue(team as LoadedTeam);
    mockedGetPlayer.mockResolvedValue(player as LoadedPlayer);

    const result = await applyWorldMutation({
      userId,
      worldId,
      seasonId,
      mutationType: 'renounceRights',
      payload: {
        teamCode,
        playerId,
      },
    });

    const writesSummary = getWritesSummary(result);
    const changedTeam = getChangedTeam(result, teamCode);
    const changedPlayer = requireValue(
      changedTeam.players?.find((player) => (player.player_id || player.id) === playerId),
      `changed player ${playerId}`
    ) as RenouncedPlayerView;

    expect(result.success).toBe(true);
    expect(result.appliedToLocalState).toBe(true);
    expect(result.persistedToWorld).toBe(true);
    expect(writesSummary.eventsWritten).toBeGreaterThan(0);

    expect(requireValue(changedTeam.capHolds, 'changedTeam.capHolds')).toHaveLength(0);
    expect(changedPlayer).not.toHaveProperty('rightsRenounced');
    expect(
      requireValue(changedPlayer.contract, 'changedPlayer.contract').birdRights
        ?.status
    ).toBe('Early Bird');
    expect(changedTeam.rightsLedger?.ledgerVersion).toBe(2);
    expect(changedTeam.rightsLedger?.events.at(-1)?.eventKind).toBe(
      'rights-renounced'
    );

    const setPaths = firestoreMocks.batchSet.mock.calls.map(([ref]) => String(ref));
    expect(setPaths.some((path) => path.includes('renounceRights_'))).toBe(true);
    expect(setPaths.some((path) => path.includes('architect_worlds/world_1/teams/LAL'))).toBe(
      true
    );
  });
});
