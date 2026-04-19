/**
 * Trade Manager Tests
 *
 * Comprehensive unit tests for the surviving tradeManager helpers:
 * signFreeAgent, waivePlayer, and extendPlayer.
 *
 * Note: updateTeamCapTotals was removed in Phase 78. All totals now use
 * SSOT computeTeamCapTotals() from capTotals. See phase78 guardrail tests.
 *
 * @file tests/architect/tradeManager.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as tradeManagerModule from '@/features/architect/utils/tradeManager';
import {
  signFreeAgent,
  waivePlayer,
  extendPlayer,
} from '@/features/architect/utils/tradeManager';
import {
  seedBaseData,
  seedWorldMetadata,
  createMockWorld,
  createMockTeam,
} from '../helpers/architectTestHelpers.ts';
import { seedMockData } from '../__mocks__/firebase.ts';

describe('Trade Manager', () => {
  const worldId = 'world_123';
  const userId = 'user_123';

  beforeEach(() => {
    seedBaseData(['LAL', 'GSW', 'BOS']);
    const world = createMockWorld({ worldId, userId });
    seedWorldMetadata(worldId, world);
  });

  describe('trade authority removal', () => {
    it('does not expose executeTrade from tradeManager', () => {
      expect('executeTrade' in tradeManagerModule).toBe(false);
      expect(tradeManagerModule.signFreeAgent).toBeTypeOf('function');
      expect(tradeManagerModule.waivePlayer).toBeTypeOf('function');
      expect(tradeManagerModule.extendPlayer).toBeTypeOf('function');
    });
  });

  describe('signFreeAgent', () => {
    it('signs player to roster', async () => {
      const signingData = {
        playerId: 'test_player',
        contract: {
          contractType: 'Standard',
          startSeason: '2025-26',
          endSeason: '2026-27',
          totalValue: 20_000_000,
          salariesByYear: [
            {
              season: '2025-26',
              salary: 10_000_000,
              capHit: 10_000_000,
              guaranteed: true,
            },
          ],
        },
      };

      const result = await signFreeAgent(worldId, 'LAL', signingData);

      expect(result.success).toBe(true);
      expect(Object.keys(result)).toEqual(['success', 'team']);
      expect(result.team.roster).toContain('test_player');
    });

    it('updates exceptions (MLE usage)', async () => {
      const signingData = {
        playerId: 'test_player',
        signedUsing: 'MLE',
        contract: {
          contractType: 'Standard',
          startSeason: '2025-26',
          endSeason: '2026-27',
          totalValue: 10_000_000,
          salariesByYear: [
            {
              season: '2025-26',
              salary: 10_000_000,
              capHit: 10_000_000,
              guaranteed: true,
            },
          ],
        },
      };

      const result = await signFreeAgent(worldId, 'LAL', signingData);

      expect(result.team.exceptions.mle.usedAmount).toBe(10_000_000);
      expect(result.team.exceptions.mle.remainingAmount).toBe(2_860_000);
    });

    it('triggers hard cap when using non-taxpayer MLE', async () => {
      const signingData = {
        playerId: 'test_player',
        signedUsing: 'MLE',
        contract: {
          contractType: 'Standard',
          startSeason: '2025-26',
          endSeason: '2026-27',
          totalValue: 10_000_000,
          salariesByYear: [
            {
              season: '2025-26',
              salary: 10_000_000,
              capHit: 10_000_000,
              guaranteed: true,
            },
          ],
        },
      };

      const result = await signFreeAgent(worldId, 'LAL', signingData);

      expect(result.team.hardCapped).toBe(true);
      expect(result.team.hardCapFirstApron.active).toBe(true);
    });

    it('removes cap hold after signing', async () => {
      // First, create a team with a cap hold
      const teamWithHold = createMockTeam({
        teamCode: 'BOS',
        capHolds: [
          {
            playerId: 'test_player',
            playerName: 'Test Player',
            amount: 12_000_000,
            type: 'Bird',
          },
        ],
      });
      seedMockData(`architect_worlds/${worldId}/teams/BOS`, teamWithHold);

      const signingData = {
        playerId: 'test_player',
        contract: {
          contractType: 'Standard',
          startSeason: '2025-26',
          endSeason: '2026-27',
          totalValue: 20_000_000,
          salariesByYear: [
            {
              season: '2025-26',
              salary: 10_000_000,
              capHit: 10_000_000,
              guaranteed: true,
            },
          ],
        },
      };

      const result = await signFreeAgent(worldId, 'BOS', signingData);

      const remainingHolds = result.team.capHolds?.filter(
        (h) => h.playerId === 'test_player'
      );
      expect(remainingHolds.length).toBe(0);
    });

    it('throws error when worldId is missing', async () => {
      await expect(
        signFreeAgent(null, 'LAL', {
          playerId: 'test',
          contract: {},
        })
      ).rejects.toThrow('worldId');
    });
  });

  describe('waivePlayer', () => {
    it('removes player from roster', async () => {
      const result = await waivePlayer(worldId, 'LAL', 'lebron_james');

      expect(result.success).toBe(true);
      expect(Object.keys(result)).toEqual(['success', 'team']);
      expect(result.team.roster).not.toContain('lebron_james');
    });

    it('creates dead cap entry', async () => {
      const result = await waivePlayer(worldId, 'LAL', 'lebron_james');

      expect(result.team.deadCap).toBeDefined();
      expect(Array.isArray(result.team.deadCap)).toBe(true);
      const deadCapEntry = result.team.deadCap.find(
        (d) => d.playerId === 'lebron_james'
      );
      expect(deadCapEntry).toBeDefined();
    });

    it('handles stretch provision', async () => {
      const result = await waivePlayer(worldId, 'LAL', 'lebron_james', {
        stretch: true,
        stretchYears: 3,
      });

      const deadCapEntry = result.team.deadCap.find(
        (d) => d.playerId === 'lebron_james'
      );
      expect(deadCapEntry.amountByYear.length).toBeGreaterThan(1); // Stretched over multiple years
    });

    it('throws error when worldId is missing', async () => {
      await expect(waivePlayer(null, 'LAL', 'lebron_james')).rejects.toThrow(
        'worldId, teamCode, and playerId are required'
      );
    });
  });

  describe('extendPlayer', () => {
    it('extends contract correctly', async () => {
      const extension = {
        contractType: 'Extension',
        startSeason: '2026-27',
        endSeason: '2028-29',
        totalValue: 150_000_000,
        salariesByYear: [
          {
            season: '2026-27',
            salary: 50_000_000,
            capHit: 50_000_000,
            guaranteed: true,
          },
          {
            season: '2027-28',
            salary: 50_000_000,
            capHit: 50_000_000,
            guaranteed: true,
          },
          {
            season: '2028-29',
            salary: 50_000_000,
            capHit: 50_000_000,
            guaranteed: true,
          },
        ],
      };

      const result = await extendPlayer(
        worldId,
        'LAL',
        'lebron_james',
        extension
      );

      expect(result.success).toBe(true);
      expect(Object.keys(result)).toEqual(['success', 'player', 'team']);
      expect(result.player.contract.contractType).toBe('Extension');
    });

    it('updates salariesByYear array', async () => {
      const extension = {
        contractType: 'Extension',
        startSeason: '2026-27',
        endSeason: '2027-28',
        totalValue: 100_000_000,
        salariesByYear: [
          {
            season: '2026-27',
            salary: 50_000_000,
            capHit: 50_000_000,
            guaranteed: true,
          },
          {
            season: '2027-28',
            salary: 50_000_000,
            capHit: 50_000_000,
            guaranteed: true,
          },
        ],
      };

      const result = await extendPlayer(
        worldId,
        'LAL',
        'lebron_james',
        extension
      );

      expect(
        result.player.contract.salariesByYear.length
      ).toBeGreaterThanOrEqual(2);
      const newYear = result.player.contract.salariesByYear.find(
        (y) => y.season === '2026-27'
      );
      expect(newYear).toBeDefined();
      expect(newYear.salary).toBe(50_000_000);
    });

    it('throws error when worldId is missing', async () => {
      await expect(
        extendPlayer(null, 'LAL', 'lebron_james', {})
      ).rejects.toThrow('worldId');
    });
  });

  // Note: updateTeamCapTotals was removed in Phase 78
  // All totals now use SSOT computeTeamCapTotals() from capTotals
  // See src/tests/architect/phase78_remove_updateTeamCapTotals_ssot_only_guardrails.test.js for guardrails
});
