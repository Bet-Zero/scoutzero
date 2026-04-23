/**
 * E2E Integration Tests for Architect Critical Workflows
 *
 * Tests the 3 core E2E scenarios:
 * 1. World lifecycle: create → rename → archive → verify hidden
 * 2. Offseason core loop: sign FA → cap sheet update → advance season → roster persists
 * 3. Trade + persistence: execute trade → apply → reload → verify persistence
 *
 * @file tests/architect/e2e-workflows.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createWorld,
  getWorldMetadata,
  listUserWorlds,
  updateWorldMetadata,
  archiveWorld,
} from '@/features/architect/utils/worldManager';
import { getTeam } from '@/features/architect/utils/teamLoader';
import { signFreeAgent } from '@/features/architect/utils/tradeManager';
import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';
import { advanceSeasonLegacy as advanceSeason } from '@/features/architect/utils/seasonManagerLegacy';
import {
  seedBaseData,
  createMockCapProjections,
  seedTeamSnapshot,
} from '../helpers/architectTestHelpers.js';
import { seedMockData as seedMockDataDirect } from '../__mocks__/firebase.js';

type ComputeMutationArgs = Parameters<typeof computeWorldMutation>[0];
type ExecuteTradeArgs = Extract<
  ComputeMutationArgs,
  { mutationType: 'executeTrade' }
>;
type TradePayload = ExecuteTradeArgs['payload'];
type TradeCurrentState = ExecuteTradeArgs['currentState'];
type MutationResult = ReturnType<typeof computeWorldMutation>;
type TradeComputeResult = {
  success: true;
  teams: NonNullable<MutationResult['teamUpdates']>;
  validation: MutationResult['_validatedTradeContext'];
};
type TradeTeam = NonNullable<TradeComputeResult['teams'][number]['team']>;
type ListedWorld = Awaited<ReturnType<typeof listUserWorlds>>[number];
type TeamSource = { type?: string; worldId?: string } & Record<string, unknown>;

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

function getPlayerId(value: unknown, message: string): string {
  if (typeof value === 'string') {
    return value;
  }

  if (isRecord(value)) {
    const playerId = value.player_id ?? value.playerId ?? value.id;
    if (typeof playerId === 'string') {
      return playerId;
    }
  }

  throw new Error(message);
}

function getRosterIds(roster: unknown, message: string): string[] {
  const rosterEntries = requireValue(
    Array.isArray(roster) ? roster : undefined,
    message
  );

  return rosterEntries.map((player, index) =>
    getPlayerId(player, `${message} at index ${index}`)
  );
}

function getTradeTeam(
  result: TradeComputeResult,
  teamCode: string,
  message: string
): TradeTeam {
  const teamUpdate = requireValue(
    result.teams.find((candidate) => candidate.teamCode === teamCode),
    message
  );

  return requireValue(teamUpdate.team, `${message} with hydrated team data`);
}

function getTeamSource(
  team: unknown,
  message: string
): TeamSource {
  const source = isRecord(team) ? team.source : undefined;

  return requireValue(
    isRecord(source) ? (source as TeamSource) : undefined,
    message
  );
}

function getListedWorld(
  worlds: ListedWorld[],
  worldId: string,
  message: string
): ListedWorld {
  return requireValue(
    worlds.find((world) => world.worldId === worldId),
    message
  );
}

/**
 * Helper to persist team snapshot to mock Firestore
 * (Simulates what a server-side write would do)
 */
function saveTeamSnapshotToMock(
  worldId: string,
  team: Record<string, unknown> & { teamCode?: unknown }
) {
  const teamCode = requireValue(
    typeof team.teamCode === 'string' ? team.teamCode : undefined,
    'Expected teamCode when saving mock team snapshot'
  );
  const snapshotPath = `architect_worlds/${worldId}/teams/${teamCode}`;
  seedMockDataDirect(snapshotPath, team);
}

/**
 * Helper to extract player IDs from roster (handles both string and object formats)
 */
function toSeasonId(currentYear: string | number | null | undefined) {
  if (typeof currentYear === 'string' && currentYear) {
    return currentYear;
  }

  const year = typeof currentYear === 'number' ? currentYear : 2025;
  return `${year}-${String(year + 1).slice(-2)}`;
}

async function computeTrade(
  worldId: string,
  tradeData: TradePayload
): Promise<TradeComputeResult> {
  const tradeTeams = requireValue(
    Array.isArray(tradeData.teams) ? tradeData.teams : undefined,
    'Expected teams array for authoritative trade compute'
  );

  const teams = await Promise.all(
    tradeTeams.map(async (tradeTeam) => {
      const teamCode = requireValue(
        typeof tradeTeam.teamCode === 'string'
          ? tradeTeam.teamCode
          : typeof tradeTeam.team?.teamCode === 'string'
            ? tradeTeam.team.teamCode
            : undefined,
        'Expected trade team code for authoritative compute'
      );

      return {
        teamCode,
        team: await getTeam(worldId, teamCode),
      };
    })
  );

  const result = computeWorldMutation({
    mutationType: 'executeTrade',
    payload: tradeData,
    currentState: { teams } as TradeCurrentState,
    seasonId: toSeasonId((tradeData as { currentYear?: string | number }).currentYear),
    timestamp: Date.now(),
    worldId,
  } as ExecuteTradeArgs);

  if (!result.success) {
    throw new Error(
      typeof result.error === 'string'
        ? result.error
        : 'Authoritative trade compute failed'
    );
  }

  return {
    success: true,
    teams: requireValue(
      result.teamUpdates,
      'Expected team updates from authoritative trade compute'
    ),
    validation: result._validatedTradeContext,
  };
}

// Mock validateTrade to return valid trades for testing
vi.mock('@/features/architect/utils/tradeMachine', () => ({
  validateTrade: vi.fn(() => ({
    legal: true,
    reason: 'Trade is valid',
    teamResults: [],
  })),
}));

describe('E2E Workflow Tests', () => {
  const userId = 'e2e_test_user';

  beforeEach(() => {
    // Seed all 30 teams for comprehensive testing
    seedBaseData('all');
  });

  // ===========================================================================
  // TEST 1: WORLD LIFECYCLE
  // ===========================================================================
  describe('Test 1: World Lifecycle (create → rename → archive → verify hidden)', () => {
    it('E2E: creates world, renames it, archives it, and confirms it disappears from default list', async () => {
      // Step 1: Create a new world
      const createResult = await createWorld({
        name: 'My Test World',
        description: 'Testing world lifecycle',
        userId,
      });

      expect(createResult.worldId).toBeDefined();
      expect(createResult.metadata.worldName).toBe('My Test World');
      expect(createResult.metadata.description).toBe('Testing world lifecycle');

      const worldId = createResult.worldId;

      // Verify world is visible in user's list
      let userWorlds = await listUserWorlds(userId);
      expect(userWorlds.some((w) => w.worldId === worldId)).toBe(true);

      // Step 2: Rename the world
      await updateWorldMetadata(worldId, {
        worldName: 'Renamed Test World',
        description: 'Updated description after rename',
      });

      // Verify rename persisted
      const metadataAfterRename = await getWorldMetadata(worldId);
      expect(metadataAfterRename.worldName).toBe('Renamed Test World');
      expect(metadataAfterRename.description).toBe('Updated description after rename');

      // Verify world still visible in list
      userWorlds = await listUserWorlds(userId);
      const renamedWorld = getListedWorld(
        userWorlds,
        worldId,
        'Expected renamed world in default user world list'
      );
      expect(renamedWorld.worldName).toBe('Renamed Test World');

      // Step 3: Archive the world
      await archiveWorld(worldId, userId);

      // Verify archived status
      const metadataAfterArchive = await getWorldMetadata(worldId);
      expect(metadataAfterArchive.isArchived).toBe(true);

      // Step 4: Confirm world disappears from default list
      userWorlds = await listUserWorlds(userId); // Default excludes archived
      expect(userWorlds.some((w) => w.worldId === worldId)).toBe(false);

      // Step 5: Verify world is still accessible with includeArchived option
      const allWorlds = await listUserWorlds(userId, { includeArchived: true });
      const archivedWorld = getListedWorld(
        allWorlds,
        worldId,
        'Expected archived world when includeArchived is enabled'
      );
      expect(archivedWorld.isArchived).toBe(true);
      expect(archivedWorld.worldName).toBe('Renamed Test World');
    });

    it('E2E: multiple worlds can be created and archived independently', async () => {
      // Create 3 worlds
      const world1 = await createWorld({ name: 'World Alpha', userId });
      const world2 = await createWorld({ name: 'World Beta', userId });
      const world3 = await createWorld({ name: 'World Gamma', userId });

      // All visible
      let userWorlds = await listUserWorlds(userId);
      expect(userWorlds.length).toBeGreaterThanOrEqual(3);
      expect(userWorlds.some((w) => w.worldId === world1.worldId)).toBe(true);
      expect(userWorlds.some((w) => w.worldId === world2.worldId)).toBe(true);
      expect(userWorlds.some((w) => w.worldId === world3.worldId)).toBe(true);

      // Archive only World Beta
      await archiveWorld(world2.worldId, userId);

      // World Beta hidden, others visible
      userWorlds = await listUserWorlds(userId);
      expect(userWorlds.some((w) => w.worldId === world1.worldId)).toBe(true);
      expect(userWorlds.some((w) => w.worldId === world2.worldId)).toBe(false);
      expect(userWorlds.some((w) => w.worldId === world3.worldId)).toBe(true);

      // Archive World Gamma
      await archiveWorld(world3.worldId, userId);

      // Only World Alpha visible
      userWorlds = await listUserWorlds(userId);
      expect(userWorlds.some((w) => w.worldId === world1.worldId)).toBe(true);
      expect(userWorlds.some((w) => w.worldId === world2.worldId)).toBe(false);
      expect(userWorlds.some((w) => w.worldId === world3.worldId)).toBe(false);

      // All 3 visible with includeArchived
      const allWorlds = await listUserWorlds(userId, { includeArchived: true });
      expect(allWorlds.some((w) => w.worldId === world1.worldId)).toBe(true);
      expect(allWorlds.some((w) => w.worldId === world2.worldId)).toBe(true);
      expect(allWorlds.some((w) => w.worldId === world3.worldId)).toBe(true);
    });
  });

  // ===========================================================================
  // TEST 2: OFFSEASON CORE LOOP
  // ===========================================================================
  describe('Test 2: Offseason Core Loop (sign FA → cap sheet update → advance season)', () => {
    it('E2E: signs free agent and updates team roster', async () => {
      // Step 1: Create world
      const worldResult = await createWorld({
        name: 'Offseason Test World',
        userId,
        currentSeason: '2025-26',
      });
      const worldId = worldResult.worldId;

      // Step 2: Verify initial LAL roster from base data
      let lalTeam = await getTeam(worldId, 'LAL');
      const initialRosterIds = getRosterIds(
        lalTeam.roster,
        'Expected initial LAL roster entries in offseason workflow test'
      );
      expect(initialRosterIds).toContain('lebron_james');

      // Step 3: Seed a free agent player in base players
      const faPlayerId = 'test_fa_player';
      seedMockDataDirect(`architect_basePlayers/${faPlayerId}`, {
        playerId: faPlayerId,
        displayName: 'Test Free Agent',
        name: 'Test Free Agent',
        teamCode: null,
        bio: { position: 'SF', age: 26, experience: 4 },
        contract: {
          contractType: 'Standard',
          startSeason: '2025-26',
          endSeason: '2027-28',
          yearsRemaining: 3,
          totalValue: 30_000_000,
          salariesByYear: [
            { season: '2025-26', salary: 10_000_000, capHit: 10_000_000, guaranteed: true },
            { season: '2026-27', salary: 10_000_000, capHit: 10_000_000, guaranteed: true },
            { season: '2027-28', salary: 10_000_000, capHit: 10_000_000, guaranteed: true },
          ],
        },
        source: { provider: 'test' },
      });

      // Step 4: Sign free agent
      const signingData = {
        playerId: faPlayerId,
        contract: {
          contractType: 'Standard',
          startSeason: '2025-26',
          endSeason: '2027-28',
          yearsRemaining: 3,
          totalValue: 30_000_000,
          salariesByYear: [
            { season: '2025-26', salary: 10_000_000, capHit: 10_000_000, guaranteed: true },
            { season: '2026-27', salary: 10_000_000, capHit: 10_000_000, guaranteed: true },
            { season: '2027-28', salary: 10_000_000, capHit: 10_000_000, guaranteed: true },
          ],
        },
      };

      const signResult = await signFreeAgent(worldId, 'LAL', signingData);

      // Step 5: Verify signing succeeded and roster updated
      expect(signResult.success).toBe(true);
      const signedRosterIds = getRosterIds(
        signResult.team.roster,
        'Expected signed LAL roster entries after free-agent signing'
      );
      expect(signedRosterIds).toContain(faPlayerId);

      // Save the updated team snapshot
      saveTeamSnapshotToMock(worldId, signResult.team);

      // Step 6: Verify signing persisted by reloading team
      lalTeam = await getTeam(worldId, 'LAL');
      const reloadedRosterIds = getRosterIds(
        lalTeam.roster,
        'Expected reloaded LAL roster entries after saving free-agent snapshot'
      );
      expect(reloadedRosterIds).toContain(faPlayerId);
    });

    it('E2E: advances season and updates world metadata', async () => {
      // Create world
      const worldResult = await createWorld({
        name: 'Season Advance Test',
        userId,
        currentSeason: '2025-26',
      });
      const worldId = worldResult.worldId;

      // Verify initial season
      let metadata = await getWorldMetadata(worldId);
      expect(metadata.currentSeason).toBe('2025-26');

      // Advance season
      const advanceResult = await advanceSeason(worldId);

      expect(advanceResult.success).toBe(true);
      expect(advanceResult.fromSeason).toBe('2025-26');
      expect(advanceResult.toSeason).toBe('2026-27');

      // Confirm new season in metadata
      metadata = await getWorldMetadata(worldId);
      expect(metadata.currentSeason).toBe('2026-27');
    });
  });

  // ===========================================================================
  // TEST 3: TRADE + PERSISTENCE
  // ===========================================================================
  describe('Test 3: Trade + Persistence (execute trade → apply → verify)', () => {
    it('E2E: executes trade and returns updated team data', async () => {
      // Step 1: Create world
      const worldResult = await createWorld({
        name: 'Trade Test World',
        userId,
        currentSeason: '2025-26',
      });
      const worldId = worldResult.worldId;

      // Step 2: Verify initial state from base data
      let lalTeam = await getTeam(worldId, 'LAL');
      let gswTeam = await getTeam(worldId, 'GSW');

      const lalInitialRosterIds = getRosterIds(
        lalTeam.roster,
        'Expected initial LAL roster entries in e2e trade workflow test'
      );
      const gswInitialRosterIds = getRosterIds(
        gswTeam.roster,
        'Expected initial GSW roster entries in e2e trade workflow test'
      );

      expect(lalInitialRosterIds).toContain('lebron_james');
      expect(gswInitialRosterIds).toContain('stephen_curry');

      // Step 3: Execute trade - LeBron to GSW, Curry to LAL
      const tradeData = {
        teams: [
          {
            teamCode: 'LAL',
            sends: [{ player_id: 'lebron_james' }],
            picksOut: [],
            cashSent: 0,
          },
          {
            teamCode: 'GSW',
            sends: [{ player_id: 'stephen_curry' }],
            picksOut: [],
            cashSent: 0,
          },
        ],
        capProjections: createMockCapProjections(),
        currentYear: 2025,
      };

      const tradeResult = await computeTrade(worldId, tradeData);

      // Step 4: Verify trade execution succeeded
      expect(tradeResult.success).toBe(true);
      expect(tradeResult.teams).toHaveLength(2);

      const lalTradeResult = getTradeTeam(
        tradeResult,
        'LAL',
        'Expected LAL team update after executing trade in e2e workflow test'
      );
      const gswTradeResult = getTradeTeam(
        tradeResult,
        'GSW',
        'Expected GSW team update after executing trade in e2e workflow test'
      );
      const lalTradeSource = getTeamSource(
        lalTradeResult,
        'Expected source metadata for post-trade LAL team result'
      );
      const gswTradeSource = getTeamSource(
        gswTradeResult,
        'Expected source metadata for post-trade GSW team result'
      );

      // Verify source metadata updated
      expect(lalTradeSource.type).toBe('world-snapshot');
      expect(lalTradeSource.worldId).toBeUndefined();
      expect(gswTradeSource.type).toBe('world-snapshot');
      expect(gswTradeSource.worldId).toBeUndefined();

      // Step 5: Verify trade result includes incoming players (added as string IDs)
      const lalTradeRosterIds = getRosterIds(
        lalTradeResult.roster,
        'Expected post-trade LAL roster entries in e2e trade workflow test'
      );
      const gswTradeRosterIds = getRosterIds(
        gswTradeResult.roster,
        'Expected post-trade GSW roster entries in e2e trade workflow test'
      );

      // LAL should have gained stephen_curry
      expect(lalTradeRosterIds).toContain('stephen_curry');

      // GSW should have gained lebron_james
      expect(gswTradeRosterIds).toContain('lebron_james');
    });

    it('E2E: trade results persist after saving to world snapshot', async () => {
      // Create world
      const worldResult = await createWorld({
        name: 'Trade Persistence Test',
        userId,
        currentSeason: '2025-26',
      });
      const worldId = worldResult.worldId;

      // Execute trade
      const tradeData = {
        teams: [
          {
            teamCode: 'LAL',
            sends: [{ player_id: 'lebron_james' }],
            picksOut: [],
            cashSent: 0,
          },
          {
            teamCode: 'GSW',
            sends: [{ player_id: 'stephen_curry' }],
            picksOut: [],
            cashSent: 0,
          },
        ],
        capProjections: createMockCapProjections(),
        currentYear: 2025,
      };

      const tradeResult = await computeTrade(worldId, tradeData);
      expect(tradeResult.success).toBe(true);

      // Save the trade result snapshots
      for (const teamResult of tradeResult.teams) {
        saveTeamSnapshotToMock(
          worldId,
          requireValue(
            teamResult.team,
            `Expected hydrated team snapshot for ${teamResult.teamCode}`
          )
        );
      }

      // Reload teams from the world
      const lalTeam = await getTeam(worldId, 'LAL');
      const gswTeam = await getTeam(worldId, 'GSW');
      const lalSource = getTeamSource(
        lalTeam,
        'Expected source metadata for persisted LAL world snapshot'
      );
      const gswSource = getTeamSource(
        gswTeam,
        'Expected source metadata for persisted GSW world snapshot'
      );

      // Verify snapshots were saved and retrieved
      expect(lalSource.type).toBe('world-snapshot');
      expect(gswSource.type).toBe('world-snapshot');

      // Verify the rosters include the incoming players
      const lalRosterIds = getRosterIds(
        lalTeam.roster,
        'Expected persisted LAL roster entries after saving trade snapshot'
      );
      const gswRosterIds = getRosterIds(
        gswTeam.roster,
        'Expected persisted GSW roster entries after saving trade snapshot'
      );

      expect(lalRosterIds).toContain('stephen_curry');
      expect(gswRosterIds).toContain('lebron_james');
    });

    it('E2E: multi-team trade correctly routes players to specified destinations', async () => {
      // Create world
      const worldResult = await createWorld({
        name: 'Multi-Team Trade Test',
        userId,
        currentSeason: '2025-26',
      });
      const worldId = worldResult.worldId;

      // Execute 3-team trade using base teams with explicit destination routing:
      // LAL sends lebron_james → GSW
      // GSW sends stephen_curry → BOS
      // BOS sends jayson_tatum → LAL
      const tradeData = {
        teams: [
          {
            teamCode: 'LAL',
            sends: [{ player_id: 'lebron_james', tradeTo: 'GSW' }],
            picksOut: [],
            cashSent: 0,
          },
          {
            teamCode: 'GSW',
            sends: [{ player_id: 'stephen_curry', tradeTo: 'BOS' }],
            picksOut: [],
            cashSent: 0,
          },
          {
            teamCode: 'BOS',
            sends: [{ player_id: 'jayson_tatum', tradeTo: 'LAL' }],
            picksOut: [],
            cashSent: 0,
          },
        ],
        capProjections: createMockCapProjections(),
        currentYear: 2025,
      };

      const tradeResult = await computeTrade(worldId, tradeData);

      // Verify trade executed successfully
      expect(tradeResult.success).toBe(true);
      expect(tradeResult.teams).toHaveLength(3);

      // All teams should have snapshot source metadata
      for (const teamResult of tradeResult.teams) {
        const updatedTeam = requireValue(
          teamResult.team,
          `Expected hydrated team snapshot for ${teamResult.teamCode}`
        );
        const source = getTeamSource(
          updatedTeam,
          `Expected source metadata for ${teamResult.teamCode} in multi-team trade`
        );

        expect(source.type).toBe('world-snapshot');
        expect(source.worldId).toBeUndefined();
      }

      // Verify each team received exactly the player routed to them
      const lalTeamResult = getTradeTeam(
        tradeResult,
        'LAL',
        'Expected LAL team result in multi-team routed trade test'
      );
      const gswTeamResult = getTradeTeam(
        tradeResult,
        'GSW',
        'Expected GSW team result in multi-team routed trade test'
      );
      const bosTeamResult = getTradeTeam(
        tradeResult,
        'BOS',
        'Expected BOS team result in multi-team routed trade test'
      );

      const lalRosterIds = getRosterIds(
        lalTeamResult.roster,
        'Expected routed roster entries for LAL in multi-team trade'
      );
      const gswRosterIds = getRosterIds(
        gswTeamResult.roster,
        'Expected routed roster entries for GSW in multi-team trade'
      );
      const bosRosterIds = getRosterIds(
        bosTeamResult.roster,
        'Expected routed roster entries for BOS in multi-team trade'
      );

      // LAL receives jayson_tatum from BOS (not stephen_curry or lebron_james)
      expect(lalRosterIds).toContain('jayson_tatum');
      expect(lalRosterIds).not.toContain('stephen_curry');
      expect(lalRosterIds).not.toContain('lebron_james');

      // GSW receives lebron_james from LAL (not jayson_tatum or stephen_curry)
      expect(gswRosterIds).toContain('lebron_james');
      expect(gswRosterIds).not.toContain('jayson_tatum');
      expect(gswRosterIds).not.toContain('stephen_curry');

      // BOS receives stephen_curry from GSW (not lebron_james or jayson_tatum)
      expect(bosRosterIds).toContain('stephen_curry');
      expect(bosRosterIds).not.toContain('lebron_james');
      expect(bosRosterIds).not.toContain('jayson_tatum');
    });
  });
});
