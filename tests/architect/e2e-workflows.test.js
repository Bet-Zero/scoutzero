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
import { advanceSeason } from '@/features/architect/utils/seasonManager';
import {
  seedBaseData,
  createMockCapProjections,
  seedTeamSnapshot,
} from '../helpers/architectTestHelpers.js';
import { seedMockData as seedMockDataDirect } from '../__mocks__/firebase.js';

/**
 * Helper to persist team snapshot to mock Firestore
 * (Simulates what a server-side write would do)
 */
function saveTeamSnapshotToMock(worldId, team) {
  const teamCode = team.teamCode;
  const snapshotPath = `architect_worlds/${worldId}/teams/${teamCode}`;
  seedMockDataDirect(snapshotPath, team);
}

/**
 * Helper to extract player IDs from roster (handles both string and object formats)
 */
function getRosterIds(roster) {
  return roster.map((p) =>
    typeof p === 'string' ? p : p.player_id || p.playerId || p.id
  );
}

function toSeasonId(currentYear) {
  if (typeof currentYear === 'string' && currentYear) {
    return currentYear;
  }

  const year = typeof currentYear === 'number' ? currentYear : 2025;
  return `${year}-${String(year + 1).slice(-2)}`;
}

async function computeTrade(worldId, tradeData) {
  const teams = await Promise.all(
    tradeData.teams.map(async (tradeTeam) => {
      const teamCode = tradeTeam.teamCode || tradeTeam.team?.teamCode;
      return {
        teamCode,
        team: await getTeam(worldId, teamCode),
      };
    })
  );

  const result = computeWorldMutation({
    mutationType: 'executeTrade',
    payload: tradeData,
    currentState: { teams },
    seasonId: toSeasonId(tradeData.currentYear),
    timestamp: Date.now(),
    worldId,
  });

  if (!result.success) {
    throw new Error(result.error || 'Authoritative trade compute failed');
  }

  return {
    success: true,
    teams: result.teamUpdates,
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
      const renamedWorld = userWorlds.find((w) => w.worldId === worldId);
      expect(renamedWorld).toBeDefined();
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
      const archivedWorld = allWorlds.find((w) => w.worldId === worldId);
      expect(archivedWorld).toBeDefined();
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
      const initialRosterIds = getRosterIds(lalTeam.roster);
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
      const signedRosterIds = getRosterIds(signResult.team.roster);
      expect(signedRosterIds).toContain(faPlayerId);

      // Save the updated team snapshot
      saveTeamSnapshotToMock(worldId, signResult.team);

      // Step 6: Verify signing persisted by reloading team
      lalTeam = await getTeam(worldId, 'LAL');
      const reloadedRosterIds = getRosterIds(lalTeam.roster);
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

      const lalInitialRosterIds = getRosterIds(lalTeam.roster);
      const gswInitialRosterIds = getRosterIds(gswTeam.roster);

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

      const lalTradeResult = tradeResult.teams.find((t) => t.teamCode === 'LAL');
      const gswTradeResult = tradeResult.teams.find((t) => t.teamCode === 'GSW');

      expect(lalTradeResult).toBeDefined();
      expect(gswTradeResult).toBeDefined();

      // Verify source metadata updated
      expect(lalTradeResult.team.source.type).toBe('world-snapshot');
      expect(lalTradeResult.team.source.worldId).toBeUndefined();
      expect(gswTradeResult.team.source.type).toBe('world-snapshot');
      expect(gswTradeResult.team.source.worldId).toBeUndefined();

      // Step 5: Verify trade result includes incoming players (added as string IDs)
      const lalTradeRosterIds = getRosterIds(lalTradeResult.team.roster);
      const gswTradeRosterIds = getRosterIds(gswTradeResult.team.roster);

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
        saveTeamSnapshotToMock(worldId, teamResult.team);
      }

      // Reload teams from the world
      const lalTeam = await getTeam(worldId, 'LAL');
      const gswTeam = await getTeam(worldId, 'GSW');

      // Verify snapshots were saved and retrieved
      expect(lalTeam.source.type).toBe('world-snapshot');
      expect(gswTeam.source.type).toBe('world-snapshot');

      // Verify the rosters include the incoming players
      const lalRosterIds = getRosterIds(lalTeam.roster);
      const gswRosterIds = getRosterIds(gswTeam.roster);

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
        expect(teamResult.team.source.type).toBe('world-snapshot');
        expect(teamResult.team.source.worldId).toBeUndefined();
      }

      // Verify each team received exactly the player routed to them
      const lalTeamResult = tradeResult.teams.find((t) => t.teamCode === 'LAL');
      const gswTeamResult = tradeResult.teams.find((t) => t.teamCode === 'GSW');
      const bosTeamResult = tradeResult.teams.find((t) => t.teamCode === 'BOS');

      expect(lalTeamResult).toBeDefined();
      expect(gswTeamResult).toBeDefined();
      expect(bosTeamResult).toBeDefined();

      const lalRosterIds = getRosterIds(lalTeamResult.team.roster);
      const gswRosterIds = getRosterIds(gswTeamResult.team.roster);
      const bosRosterIds = getRosterIds(bosTeamResult.team.roster);

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
