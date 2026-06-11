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

import { describe, it, expect, beforeEach } from 'vitest';
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
  createMockPlayer,
  seedTeamSnapshot,
} from '../helpers/architectTestHelpers.js';
import { seedMockData } from '../__mocks__/firebase.js';

type SignFreeAgentResult = Awaited<ReturnType<typeof signFreeAgent>>;
type WaivePlayerResult = Awaited<ReturnType<typeof waivePlayer>>;
type ExtendPlayerResult = Awaited<ReturnType<typeof extendPlayer>>;

type MleException = {
  usedAmount?: number;
  remainingAmount?: number;
};

type HardCapStatus = {
  active?: boolean;
};

type CapHoldEntry = {
  playerId?: string;
};

type DeadCapAmountByYear = {
  season?: string;
  amount?: number;
  isStretched?: boolean;
};

type DeadCapEntry = {
  playerId?: string;
  amountByYear?: DeadCapAmountByYear[];
};

type ExtensionYear = {
  season?: string;
  salary?: number;
};

type ExtendedContract = {
  contractType?: string;
  salariesByYear?: ExtensionYear[];
};

const invalidWorldId = null as unknown as string;

const requireValue = <T>(value: T | null | undefined, label: string): T => {
  if (value == null) {
    throw new Error(`${label} is required`);
  }

  return value;
};

const getMleException = (result: SignFreeAgentResult): MleException =>
  requireValue(result.team.exceptions?.mle, 'team.exceptions.mle');

const getHardCapFirstApron = (result: SignFreeAgentResult): HardCapStatus =>
  requireValue(
    result.team.hardCapFirstApron as HardCapStatus | null | undefined,
    'team.hardCapFirstApron'
  );

const getRemainingCapHolds = (result: SignFreeAgentResult): CapHoldEntry[] =>
  result.team.capHolds ?? [];

const getDeadCapEntries = (result: WaivePlayerResult): DeadCapEntry[] =>
  requireValue(
    result.team.deadCap as DeadCapEntry[] | null | undefined,
    'team.deadCap'
  );

const getExtendedContract = (result: ExtendPlayerResult): ExtendedContract =>
  requireValue(
    result.player.contract as ExtendedContract | null | undefined,
    'player.contract'
  );

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
      const mle = getMleException(result);

      expect(mle.usedAmount).toBe(10_000_000);
      expect(mle.remainingAmount).toBe(2_860_000);
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
      const hardCapFirstApron = getHardCapFirstApron(result);

      expect(result.team.hardCapped).toBe(true);
      expect(hardCapFirstApron.active).toBe(true);
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

      const remainingHolds = getRemainingCapHolds(result).filter(
        (h) => h.playerId === 'test_player'
      );
      expect(remainingHolds.length).toBe(0);
    });

    it('throws error when worldId is missing', async () => {
      await expect(
        signFreeAgent(invalidWorldId, 'LAL', {
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
      const deadCap = getDeadCapEntries(result);

      expect(Array.isArray(deadCap)).toBe(true);
      const deadCapEntry = deadCap.find((d) => d.playerId === 'lebron_james');
      expect(deadCapEntry).toBeDefined();
    });

    it('allocates standard waiver dead cap to the original contract seasons', async () => {
      const player = createMockPlayer({
        playerId: 'waive_multiyear',
        displayName: 'Waive Multi-Year',
        teamCode: 'LAL',
        contract: {
          contractType: 'Standard',
          startSeason: '2025-26',
          endSeason: '2026-27',
          totalValue: 30_000_000,
          guaranteedValue: 30_000_000,
          salariesByYear: [
            {
              season: '2025-26',
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
        },
      });

      seedMockData('architect_basePlayers/waive_multiyear', player);
      seedTeamSnapshot(
        worldId,
        'LAL',
        createMockTeam({
          teamCode: 'LAL',
          season: '2025-26',
          roster: ['waive_multiyear'],
          players: [player],
          totals: { totalSalary: 30_000_000, capHit: 30_000_000 },
        }),
        { padRoster: false }
      );

      const result = await waivePlayer(worldId, 'LAL', 'waive_multiyear');
      const deadCap = getDeadCapEntries(result);

      const deadCapEntry = requireValue(
        deadCap.find((d) => d.playerId === 'waive_multiyear'),
        'deadCapEntry'
      );

      expect(deadCapEntry.amountByYear).toEqual([
        { season: '2025-26', amount: 12_000_000, isStretched: false },
        { season: '2026-27', amount: 18_000_000, isStretched: false },
      ]);
    });

    it('handles stretch provision', async () => {
      const result = await waivePlayer(worldId, 'LAL', 'lebron_james', {
        stretch: true,
        stretchYears: 3,
      });
      const deadCap = getDeadCapEntries(result);

      const deadCapEntry = requireValue(
        deadCap.find((d) => d.playerId === 'lebron_james'),
        'deadCapEntry'
      );
      const amountByYear = requireValue(
        deadCapEntry.amountByYear,
        'deadCapEntry.amountByYear'
      );

      expect(amountByYear.length).toBeGreaterThan(1); // Stretched over multiple years
    });

    it('throws error when worldId is missing', async () => {
      await expect(
        waivePlayer(invalidWorldId, 'LAL', 'lebron_james')
      ).rejects.toThrow('worldId, teamCode, and playerId are required');
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
      const contract = getExtendedContract(result);

      expect(result.success).toBe(true);
      expect(Object.keys(result)).toEqual(['success', 'player', 'team']);
      expect(contract.contractType).toBe('Extension');
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
      const contract = getExtendedContract(result);
      const salariesByYear = requireValue(
        contract.salariesByYear,
        'player.contract.salariesByYear'
      );

      expect(salariesByYear.length).toBeGreaterThanOrEqual(2);
      const newYear = requireValue(
        salariesByYear.find((y) => y.season === '2026-27'),
        'player.contract.salariesByYear[2026-27]'
      );
      expect(newYear.salary).toBe(50_000_000);
    });

    it('throws error when worldId is missing', async () => {
      await expect(
        extendPlayer(invalidWorldId, 'LAL', 'lebron_james', {})
      ).rejects.toThrow('worldId');
    });
  });

  // Note: updateTeamCapTotals was removed in Phase 78
  // All totals now use SSOT computeTeamCapTotals() from capTotals
  // See src/tests/architect/phase78_remove_updateTeamCapTotals_ssot_only_guardrails.test.js for guardrails
});
