import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyWorldMutation,
  computeWorldMutation,
  type MutationTeamAndPlayerCurrentStateInput,
} from '@/features/architect/utils/mutationPipeline';
import type { RightsEventLedgerPayload } from '@/schemas/rightsEventLedger';
import {
  createWorld,
  branchWorld,
  updateWorldAsOfDate,
} from '@/features/architect/utils/worldManager';
import { projectRightsStateAsOf } from '@/features/architect/utils/rightsHistory';
import { toTeamHistoryEventDisplay } from '@/features/architect/history/utils/normalizeWorldEventsForTeamHistory';
import {
  makeRightsEstablishedEvent,
  makeRightsLedger,
} from '../fixtures/architect/rightsHistory';
import {
  createMockPlayer,
  createMockTeam,
  createMockWorld,
  getMockTeamSnapshot,
  seedBaseData,
  seedTeamSnapshot,
  seedWorldMetadata,
} from '../helpers/architectTestHelpers.js';

vi.mock('@/features/architect/utils/capLegalityValidation', () => ({
  validateSigning: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateWaive: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateExtension: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateOptionDecision: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateRenounceRights: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateDeadCap: vi.fn(() => ({ violations: [], warnings: [] })),
  validateContractRows: vi.fn(() => ({ violations: [], warnings: [] })),
  validateExceptions: vi.fn(() => ({ violations: [], warnings: [] })),
  isOverrideEnabled: vi.fn(() => false),
}));

const TEAM_ID = 'DET';
const PLAYER_ID = 'player-bze-273';
const PLAYER_NAME = 'Governed Rights Player';
const SEASON_ID = '2026-27';
const AS_OF_DATE = '2026-07-15';
const TIMESTAMP = Date.parse('2026-07-15T16:00:00Z');

function ledgerFor(worldId: string, options: { rfaActive?: boolean } = {}) {
  return makeRightsLedger(
    makeRightsEstablishedEvent({
      ...(options.rfaActive
        ? { freeAgentStatus: 'RFA' as const, rightOfFirstRefusal: 'active' as const }
        : {}),
      eventOverrides: {
        worldId,
        teamId: TEAM_ID,
        playerId: PLAYER_ID,
      },
    })
  );
}

function currentState(
  worldId: string,
  options: {
    ledger?: RightsEventLedgerPayload | null;
    extraCapHolds?: Array<{
      playerId: string;
      playerName: string;
      amount: number;
      type: string;
      season: string;
      isSigned: boolean;
    }>;
  } = {}
): MutationTeamAndPlayerCurrentStateInput {
  const player = {
    playerId: PLAYER_ID,
    player_id: PLAYER_ID,
    displayName: PLAYER_NAME,
    name: PLAYER_NAME,
    teamCode: TEAM_ID,
    contract: { birdRights: { status: 'Full' } },
  };
  return {
    team: {
      teamCode: TEAM_ID,
      players: [player],
      capHolds: [
        {
          playerId: PLAYER_ID,
          playerName: PLAYER_NAME,
          amount: 999,
          type: 'UFA',
          season: SEASON_ID,
          isSigned: false,
        },
        ...(options.extraCapHolds ?? []),
      ],
      rightsLedger:
        options.ledger === undefined ? ledgerFor(worldId) : options.ledger,
      totals: { totalSalary: 90_000_000 },
      source: { type: 'base', provider: 'governed-test-fixture' },
    },
    player,
    teamCode: TEAM_ID,
  } as MutationTeamAndPlayerCurrentStateInput;
}

function compute(worldId = 'world-compute', state = currentState(worldId)) {
  return computeWorldMutation({
    mutationType: 'renounceRights',
    payload: { teamCode: TEAM_ID, playerId: PLAYER_ID },
    currentState: state,
    seasonId: SEASON_ID,
    timestamp: TIMESTAMP,
    asOfDate: AS_OF_DATE,
    worldId,
    operationId: 'operation-bze-273',
    authoringIdentity: 'user-bze-273',
    recordedAt: '2026-07-15T16:00:00Z',
  });
}

describe('renounceRights governed compute', () => {
  it('removes the hold and appends the immutable ledger event', () => {
    const result = compute();
    expect(result.success).toBe(true);
    const team = result.teamUpdates?.[0]?.team;
    expect(team?.capHolds).toEqual([]);
    expect(team?.rightsLedger?.ledgerVersion).toBe(2);
    expect(team?.rightsLedger?.events).toHaveLength(2);
    expect(team?.totals?.capHoldsTotal).toBe(0);
    expect(team?.source?.type).toBe('world-snapshot');
    expect(team?.source?.lastModifiedAt).toBe(
      new Date(TIMESTAMP).toISOString()
    );
    expect(result.metadata).toMatchObject({
      type: 'renounce',
      playerId: PLAYER_ID,
      teamCode: TEAM_ID,
      birdRightsType: 'Full Bird',
      freeAgentAmountRemoved: 21_850_000,
      rightsStateVersion: 2,
    });
  });

  it('does not rewrite legacy player Bird flags as authority', () => {
    const result = compute();
    const player = result.teamUpdates?.[0]?.team?.players?.[0];
    expect(player?.contract?.birdRights?.status).toBe('Full');
    expect(player).not.toHaveProperty('rightsRenounced');
    expect(player).not.toHaveProperty('renouncedAt');
  });

  it('fails closed without a governed ledger', () => {
    const result = compute(
      'world-compute',
      currentState('world-compute', { ledger: null })
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('complete rights ledger');
  });

  it('blocks active RFA Right of First Refusal state', () => {
    const state = currentState('world-compute', {
      ledger: ledgerFor('world-compute', { rfaActive: true }),
    });
    const result = compute('world-compute', state);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Right of First Refusal');
  });

  it('rejects a repeated renunciation', () => {
    const first = compute();
    const firstTeam = first.teamUpdates?.[0]?.team;
    expect(first.success).toBe(true);
    expect(firstTeam).toBeDefined();
    if (!firstTeam) return;
    const second = compute('world-compute', {
      ...currentState('world-compute'),
      team: firstTeam,
    });
    expect(second.success).toBe(false);
    expect(second.error).toContain('already renounced');
  });

  it('removes only the exact player hold when other holds share the team', () => {
    const result = compute(
      'world-compute',
      currentState('world-compute', {
        extraCapHolds: [
          {
            playerId: 'player-to-keep',
            playerName: 'Keep This Hold',
            amount: 8_000_000,
            type: 'UFA',
            season: SEASON_ID,
            isSigned: false,
          },
        ],
      })
    );
    expect(result.success).toBe(true);
    expect(result.teamUpdates?.[0]?.team?.capHolds).toEqual([
      expect.objectContaining({
        playerId: 'player-to-keep',
        amount: 8_000_000,
      }),
    ]);
  });
});

describe('renounceRights world persistence and reload', () => {
  beforeEach(() => {
    seedBaseData();
  });

  it('commits financial and rights state atomically and reloads without drift', async () => {
    const created = await createWorld({
      name: 'BZE-273 governed world',
      userId: 'user-bze-273',
      currentSeason: SEASON_ID,
    });
    await updateWorldAsOfDate(created.worldId, AS_OF_DATE);
    const player = createMockPlayer({
      playerId: PLAYER_ID,
      displayName: PLAYER_NAME,
      teamCode: TEAM_ID,
    });
    const team = {
      ...createMockTeam({
        teamCode: TEAM_ID,
        season: SEASON_ID,
        roster: [PLAYER_ID],
        players: [player],
        capHolds: [
          {
            playerId: PLAYER_ID,
            playerName: PLAYER_NAME,
            amount: 21_850_000,
            type: 'UFA',
            season: SEASON_ID,
            isSigned: false,
          },
        ],
      }),
      rightsLedger: ledgerFor(created.worldId),
    };
    seedTeamSnapshot(created.worldId, TEAM_ID, team);

    const result = await applyWorldMutation({
      userId: 'user-bze-273',
      worldId: created.worldId,
      seasonId: SEASON_ID,
      mutationType: 'renounceRights',
      payload: { teamCode: TEAM_ID, playerId: PLAYER_ID },
      timestamp: TIMESTAMP,
      operationId: 'operation-bze-273',
    });

    expect(result.success).toBe(true);
    expect(result.persistedToWorld).toBe(true);
    const reloaded = getMockTeamSnapshot(created.worldId, TEAM_ID);
    expect(reloaded?.capHolds).toEqual([]);
    expect(reloaded?.players?.find((entry) => entry.playerId === PLAYER_ID)?.contract.birdRights?.status).not.toBe('None');
    const projection = projectRightsStateAsOf({
      ledger: reloaded?.rightsLedger,
      worldId: created.worldId,
      teamId: TEAM_ID,
      playerId: PLAYER_ID,
      asOfDate: AS_OF_DATE,
      salaryCapYear: 2027,
    });
    expect(projection.status).toBe('renounced');
    expect(projection.freeAgentAmount).toBe(0);
    expect(projection.stateReference?.stateVersion).toBe(2);
    const persistedEvent = result.event as unknown as {
      metadata?: Record<string, unknown>;
    };
    expect(persistedEvent.metadata).toMatchObject({
      freeAgentAmountRemoved: 21_850_000,
      rightsStateVersion: 2,
    });
    const historyDisplay = toTeamHistoryEventDisplay(
      result.event as unknown as Record<string, unknown>,
      { teamCode: TEAM_ID }
    );
    const rightsDetails = historyDisplay.detailSections.find(
      (section) => section.title === 'Rights'
    );
    expect(rightsDetails?.lines).toEqual(
      expect.arrayContaining([
        'Former status: Full Bird',
        'Free agency: UFA',
        'Right of First Refusal: not-applicable',
        'Free Agent Amount removed: $21,850,000',
        expect.stringContaining('Resulting rights state:'),
      ])
    );

    const branched = await branchWorld(
      created.worldId,
      'BZE-273 governed branch',
      '',
      'user-bze-273'
    );
    const branchedTeam = getMockTeamSnapshot(branched.worldId, TEAM_ID);
    const branchedProjection = projectRightsStateAsOf({
      ledger: branchedTeam?.rightsLedger,
      worldId: branched.worldId,
      teamId: TEAM_ID,
      playerId: PLAYER_ID,
      asOfDate: AS_OF_DATE,
      salaryCapYear: 2027,
    });
    expect(branchedProjection.status).toBe('renounced');
    expect(branchedProjection.stateReference?.stateVersion).toBe(2);
  });

  it('rejects a newly marked world until its governed date is supplied', async () => {
    const created = await createWorld({
      name: 'BZE-273 missing date',
      userId: 'user-bze-273',
      currentSeason: SEASON_ID,
    });
    const result = await applyWorldMutation({
      userId: 'user-bze-273',
      worldId: created.worldId,
      seasonId: SEASON_ID,
      mutationType: 'renounceRights',
      payload: { teamCode: TEAM_ID, playerId: PLAYER_ID },
      timestamp: TIMESTAMP,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('explicit governed world date');
  });

  it('fails closed for an old saved world and requires recreation', async () => {
    const oldWorld = createMockWorld({
      worldId: 'old-world-before-bze-273',
      userId: 'user-bze-273',
      currentSeason: SEASON_ID,
      asOfDate: AS_OF_DATE,
    });
    seedWorldMetadata(oldWorld.worldId, oldWorld);
    const player = createMockPlayer({
      playerId: PLAYER_ID,
      displayName: PLAYER_NAME,
      teamCode: TEAM_ID,
    });
    seedTeamSnapshot(oldWorld.worldId, TEAM_ID, {
      ...createMockTeam({
        teamCode: TEAM_ID,
        season: SEASON_ID,
        roster: [PLAYER_ID],
        players: [player],
      }),
      rightsLedger: ledgerFor(oldWorld.worldId),
    });

    const result = await applyWorldMutation({
      userId: 'user-bze-273',
      worldId: oldWorld.worldId,
      seasonId: SEASON_ID,
      mutationType: 'renounceRights',
      payload: { teamCode: TEAM_ID, playerId: PLAYER_ID },
      timestamp: TIMESTAMP,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('predates governed rights history');
    await expect(
      branchWorld(oldWorld.worldId, 'invalid branch', '', 'user-bze-273')
    ).rejects.toThrow('predates governed rights history');
  });

  it('rejects missing world identity before reading mutable state', async () => {
    const result = await applyWorldMutation({
      userId: 'user-bze-273',
      worldId: null as unknown as string,
      seasonId: SEASON_ID,
      mutationType: 'renounceRights',
      payload: { teamCode: TEAM_ID, playerId: PLAYER_ID },
    });
    expect(result).toMatchObject({
      success: false,
      error: 'worldId is required',
    });
  });

  it('rejects a missing mutation payload', async () => {
    const created = await createWorld({
      name: 'BZE-273 missing payload',
      userId: 'user-bze-273',
      currentSeason: SEASON_ID,
    });
    const result = await applyWorldMutation({
      userId: 'user-bze-273',
      worldId: created.worldId,
      seasonId: SEASON_ID,
      mutationType: 'renounceRights',
      payload: null as unknown as Parameters<
        typeof applyWorldMutation
      >[0]['payload'],
    });
    expect(result).toMatchObject({
      success: false,
      error: 'payload is required',
    });
  });
});
