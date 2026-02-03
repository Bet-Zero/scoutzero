/**
 * @file dareResolver.test.js
 * @description Tests for Draft Asset Resolution Engine core orchestrator
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all adapter modules
vi.mock(
  '@/features/architect/utils/entitlements/dare/swapResolutionAdapter',
  () => ({
    resolveSwap: vi.fn(),
  })
);

vi.mock(
  '@/features/architect/utils/entitlements/dare/conveyanceResolutionAdapter',
  () => ({
    resolveConveyance: vi.fn(),
  })
);

vi.mock(
  '@/features/architect/utils/entitlements/dare/entitlementMutator',
  () => ({
    buildMutationBatch: vi.fn(),
    applyMutations: vi.fn(),
  })
);

import {
  resolveAllDraftAssets,
  buildDAREInput,
  classifyEntitlements,
} from '@/features/architect/utils/entitlements/dare/dareResolver';
import { resolveSwap } from '@/features/architect/utils/entitlements/dare/swapResolutionAdapter';
import { resolveConveyance } from '@/features/architect/utils/entitlements/dare/conveyanceResolutionAdapter';
import {
  buildMutationBatch,
  applyMutations,
} from '@/features/architect/utils/entitlements/dare/entitlementMutator';

describe('DARE Resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    resolveSwap.mockReturnValue({
      outcome: 'resolved',
      winner: 'BOS',
      position: 10,
    });
    resolveConveyance.mockReturnValue({
      outcome: 'conveyed',
      protectionTriggered: false,
    });
    buildMutationBatch.mockReturnValue({ upserts: [], deletes: [] });
    applyMutations.mockResolvedValue({ success: true });
  });

  describe('classifyEntitlements', () => {
    it('should classify swap entitlements correctly', () => {
      const entitlements = [
        { id: 'ent-1', hasSwap: true, swapTeams: ['BOS', 'LAL'] },
        { id: 'ent-2', hasSwap: false },
      ];

      const classified = classifyEntitlements(entitlements);

      expect(classified.swaps).toHaveLength(1);
      expect(classified.swaps[0].id).toBe('ent-1');
      expect(classified.conveyances).toHaveLength(1);
      expect(classified.conveyances[0].id).toBe('ent-2');
    });

    it('should classify owned picks (same origin and owner) correctly', () => {
      const entitlements = [
        { id: 'ent-1', originTeam: 'BOS', ownerTeam: 'BOS' }, // Own pick
        { id: 'ent-2', originTeam: 'LAL', ownerTeam: 'BOS' }, // Acquired pick
      ];

      const classified = classifyEntitlements(entitlements);

      expect(classified.ownPicks).toHaveLength(1);
      expect(classified.ownPicks[0].id).toBe('ent-1');
      expect(classified.conveyances).toHaveLength(1);
      expect(classified.conveyances[0].id).toBe('ent-2');
    });

    it('should filter by season year', () => {
      const entitlements = [
        { id: 'ent-1', seasonYear: 2026, originTeam: 'BOS', ownerTeam: 'LAL' },
        { id: 'ent-2', seasonYear: 2027, originTeam: 'CHI', ownerTeam: 'MIA' },
        {
          id: 'ent-3',
          seasonYear: 2026,
          hasSwap: true,
          swapTeams: ['NYK', 'BKN'],
        },
      ];

      const classified = classifyEntitlements(entitlements, 2026);

      expect(classified.conveyances).toHaveLength(1);
      expect(classified.swaps).toHaveLength(1);
    });
  });

  describe('buildDAREInput', () => {
    it('should build valid DARE input from teams', () => {
      const teams = [
        { teamCode: 'BOS', entitlementIds: ['ent-1', 'ent-2'] },
        { teamCode: 'LAL', entitlementIds: ['ent-3'] },
      ];

      const positionsMap = { BOS: 10, LAL: 5 };

      const input = buildDAREInput({
        worldId: 'world-123',
        draftYear: 2026,
        positionsMap,
        teams,
      });

      expect(input.worldId).toBe('world-123');
      expect(input.draftYear).toBe(2026);
      expect(input.positionsMap).toEqual(positionsMap);
      expect(input.teams).toHaveLength(2);
    });

    it('should validate required fields', () => {
      expect(() => buildDAREInput({})).toThrow();
      expect(() => buildDAREInput({ worldId: 'test' })).toThrow();
    });
  });

  describe('resolveAllDraftAssets', () => {
    it('should resolve swaps before conveyances', async () => {
      const callOrder = [];

      resolveSwap.mockImplementation(() => {
        callOrder.push('swap');
        return { outcome: 'resolved', winner: 'BOS', position: 5 };
      });

      resolveConveyance.mockImplementation(() => {
        callOrder.push('conveyance');
        return { outcome: 'conveyed', protectionTriggered: false };
      });

      const input = {
        worldId: 'world-1',
        draftYear: 2026,
        positionsMap: { BOS: 5, LAL: 10 },
        teams: [
          { teamCode: 'BOS', entitlementIds: ['swap-ent'] },
          { teamCode: 'LAL', entitlementIds: ['conv-ent'] },
        ],
      };

      const entitlements = [
        {
          id: 'swap-ent',
          hasSwap: true,
          swapTeams: ['BOS', 'CHI'],
          seasonYear: 2026,
        },
        {
          id: 'conv-ent',
          originTeam: 'LAL',
          ownerTeam: 'NYK',
          seasonYear: 2026,
        },
      ];

      await resolveAllDraftAssets(null, input, entitlements);

      // Swaps should be resolved first
      expect(callOrder[0]).toBe('swap');
    });

    it('should handle rolled picks by creating new entitlements', async () => {
      resolveConveyance.mockReturnValue({
        outcome: 'rolled',
        protectionTriggered: true,
        rollToYear: 2027,
        resolvedPosition: 3,
      });

      const mutations = { upserts: [], deletes: [] };
      buildMutationBatch.mockReturnValue(mutations);

      const input = {
        worldId: 'world-1',
        draftYear: 2026,
        positionsMap: { DET: 3 },
        teams: [{ teamCode: 'MIA', entitlementIds: ['ent-1'] }],
      };

      const entitlements = [
        { id: 'ent-1', originTeam: 'DET', ownerTeam: 'MIA', seasonYear: 2026 },
      ];

      const result = await resolveAllDraftAssets(null, input, entitlements);

      expect(result.resolutionReceipt).toBeDefined();
      expect(buildMutationBatch).toHaveBeenCalled();
    });

    it('should track team entitlement updates', async () => {
      resolveConveyance.mockReturnValue({
        outcome: 'conveyed',
        protectionTriggered: false,
        resolvedPosition: 15,
      });

      const input = {
        worldId: 'world-1',
        draftYear: 2026,
        positionsMap: { LAL: 15 },
        teams: [{ teamCode: 'BOS', entitlementIds: ['ent-1'] }],
      };

      const entitlements = [
        { id: 'ent-1', originTeam: 'LAL', ownerTeam: 'BOS', seasonYear: 2026 },
      ];

      const result = await resolveAllDraftAssets(null, input, entitlements);

      expect(result.teamEntitlementIdUpdates).toBeDefined();
    });

    it('should generate resolution receipt with entries', async () => {
      resolveSwap.mockReturnValue({
        outcome: 'resolved',
        winner: 'BOS',
        loser: 'LAL',
        position: 8,
      });

      const input = {
        worldId: 'world-1',
        draftYear: 2026,
        positionsMap: { BOS: 8, LAL: 12 },
        teams: [{ teamCode: 'BOS', entitlementIds: ['swap-ent'] }],
      };

      const entitlements = [
        {
          id: 'swap-ent',
          hasSwap: true,
          swapTeams: ['BOS', 'LAL'],
          seasonYear: 2026,
        },
      ];

      const result = await resolveAllDraftAssets(null, input, entitlements);

      expect(result.resolutionReceipt).toBeDefined();
      expect(result.resolutionReceipt.entries).toBeDefined();
    });

    it('should collect warnings for resolution issues', async () => {
      resolveConveyance.mockReturnValue({
        outcome: 'error',
        error: 'Origin team not found in positionsMap',
      });

      const input = {
        worldId: 'world-1',
        draftYear: 2026,
        positionsMap: {},
        teams: [{ teamCode: 'NYK', entitlementIds: ['ent-1'] }],
      };

      const entitlements = [
        { id: 'ent-1', originTeam: 'XXX', ownerTeam: 'NYK', seasonYear: 2026 },
      ];

      const result = await resolveAllDraftAssets(null, input, entitlements);

      expect(result.resolutionReceipt.warnings.length).toBeGreaterThan(0);
    });

    it('should not process already resolved entitlements', async () => {
      const input = {
        worldId: 'world-1',
        draftYear: 2026,
        positionsMap: { BOS: 10 },
        teams: [{ teamCode: 'LAL', entitlementIds: ['ent-1'] }],
      };

      const entitlements = [
        {
          id: 'ent-1',
          originTeam: 'BOS',
          ownerTeam: 'LAL',
          seasonYear: 2026,
          resolved: true,
        },
      ];

      await resolveAllDraftAssets(null, input, entitlements);

      expect(resolveConveyance).not.toHaveBeenCalled();
    });

    it('should handle conversion to second round', async () => {
      resolveConveyance.mockReturnValue({
        outcome: 'converted',
        protectionTriggered: true,
        convertToRound: 2,
        resolvedPosition: 4,
      });

      const input = {
        worldId: 'world-1',
        draftYear: 2026,
        positionsMap: { OKC: 4 },
        teams: [{ teamCode: 'HOU', entitlementIds: ['ent-1'] }],
      };

      const entitlements = [
        {
          id: 'ent-1',
          originTeam: 'OKC',
          ownerTeam: 'HOU',
          seasonYear: 2026,
          pickType: 'first',
        },
      ];

      const result = await resolveAllDraftAssets(null, input, entitlements);

      expect(buildMutationBatch).toHaveBeenCalled();
      // Converted picks should create a new second-round entitlement
    });
  });
});
