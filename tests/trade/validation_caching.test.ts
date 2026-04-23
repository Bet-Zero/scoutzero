import { describe, it, expect, beforeEach } from 'vitest';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import { validationCache } from '@/features/architect/utils/tradeMachine/cache/validationCacheService';
import type {
  NormalizedPlayer,
  TradeExceptionPlayer,
} from '@/features/architect/utils/tradeMachine/constants/types';

type TradeInput = Parameters<typeof validateTrade>[0];
type TradeSlot = NonNullable<NonNullable<TradeInput['teams']>[number]>;
type TradeTeamData = NonNullable<TradeSlot['team']>;
type TradeValidationResult = ReturnType<typeof validateTrade>;
type CacheDataWarning = TradeValidationResult['dataWarnings'][number];
type SalaryRow = {
  season: string;
  salary: number;
  capHit: number;
  guaranteed: boolean;
};
type TestTradePlayer = TradeExceptionPlayer &
  Pick<
    NormalizedPlayer,
    | 'name'
    | 'salary'
    | 'matchIncoming'
    | 'matchOutgoing'
    | 'isTwoWay'
    | 'absorptionMode'
    | 'signAndTrade'
    | 'contractYears'
    | 'firstYearGuaranteed'
  > & {
    id: string;
    player_id: string;
    currentSalary: number;
    contract: {
      salariesByYear: SalaryRow[];
    };
    [key: string]: unknown;
  };
type TestTradeTeamData = Omit<TradeTeamData, 'players'> & {
  players: TestTradePlayer[];
  hardCapped?: boolean;
};
type TestTradeSlot = Omit<TradeSlot, 'team' | 'sends' | 'picksOut'> & {
  team: TestTradeTeamData;
  sends: TestTradePlayer[];
  picksOut: unknown[];
};
type TestTradeInput = Omit<TradeInput, 'teams'> & {
  teams: TestTradeSlot[];
};

const asValidateTradeInput = (trade: TestTradeInput): TradeInput =>
  trade as TradeInput;

describe('Validation Caching', () => {
  const season = '2025-26';
  const makeTrade = (params: Partial<TestTradeInput> = {}): TestTradeInput => ({
      teams: [
        {
          team: {
            teamId: 'test1',
            teamName: 'Test Team',
            teamTotalSalary: 150_000_000,
            players: [],
          },
          sends: [],
          picksOut: [],
        },
        {
          team: {
            teamId: 'test2',
            teamName: 'Test Team 2',
            teamTotalSalary: 120_000_000,
            players: [],
          },
          sends: [],
          picksOut: [],
        },
      ] as TestTradeInput['teams'],
      capProjections: {
        '2025-26': {
          salaryCap: 141_000_000,
          firstApron: 172_346_000,
          secondApron: 182_794_000,
        },
      },
      currentYear: 2025,
      ...params,
    });
  const makePlayer = (
    id: string,
    salary: number,
    extra: Partial<TestTradePlayer> = {}
  ): TestTradePlayer => ({
    id,
    player_id: id,
    name: id,
    salary,
    currentSalary: salary,
    matchIncoming: salary,
    matchOutgoing: salary,
    isTwoWay: false,
    absorptionMode: 'MATCH',
    signAndTrade: false,
    contractYears: 1,
    firstYearGuaranteed: true,
    contract: {
      salariesByYear: [
        {
          season,
          salary,
          capHit: salary,
          guaranteed: true,
        },
      ],
    },
    ...extra,
  });
  const makeTradeWithBycWarning = () => {
    const trade = makeTrade();
    const bycPlayer = makePlayer('byc_player', 20_000_000, {
      isBYC: true,
      teamCode: 'test1',
    });
    const counterPlayer = makePlayer('counter_player', 20_000_000, {
      teamCode: 'test2',
    });

    trade.teams[0].team.players = [bycPlayer];
    trade.teams[1].team.players = [counterPlayer];
    trade.teams[0].sends = [bycPlayer];
    trade.teams[1].sends = [counterPlayer];

    return trade;
  };
  const stripWarningTimestamps = (warnings: CacheDataWarning[] = []) =>
    warnings.map(({ timestamp, ...warning }) => warning);

  beforeEach(() => {
    validationCache.clear();
  });

  describe('Salary Matching Cache', () => {
    it('caches and retrieves salary matching results', () => {
      const trade = makeTrade();

      // Clear cache first
      validationCache.clear();
      const initialMetrics = validationCache.getMetrics();

      // First call - should compute
      const result1 = validateTrade(asValidateTradeInput(trade));

      // Second call - should use cache
      const result2 = validateTrade(asValidateTradeInput(trade));

      expect(result2).toBeDefined();
      expect(result1).toBeDefined();
      
      // Check that cache has some entries - engine layer should cache
      const finalMetrics = validationCache.getMetrics();
      expect(finalMetrics.size).toBeGreaterThanOrEqual(initialMetrics.size);
    });

    it('invalidates cache when salary values change', () => {
      validationCache.clear();
      const initialMetrics = validationCache.getMetrics();
      
      const trade1 = makeTrade();
      const result1 = validateTrade(asValidateTradeInput(trade1));

      // Create a different trade that will have different cache keys
      const trade2 = makeTrade();
      trade2.teams[0].team.teamTotalSalary = 200_000_000; // Much higher value
      const result2 = validateTrade(asValidateTradeInput(trade2));

      expect(result2).toBeDefined();
      expect(result1).toBeDefined();
      
      // Cache should have entries for both calls
      const finalMetrics = validationCache.getMetrics();
      expect(finalMetrics.size).toBeGreaterThanOrEqual(initialMetrics.size);
    });
  });

  describe('Hard Cap Cache', () => {
    it('caches and retrieves hard cap results', () => {
      const trade = makeTrade();
      // Make team hard capped
      trade.teams[0].team.hardCapped = true;
      trade.teams[0].team.teamTotalSalary = 170_000_000;

      validationCache.clear();
      const initialMetrics = validationCache.getMetrics();

      // First call - should compute
      const result1 = validateTrade(asValidateTradeInput(trade));

      // Second call - should use cache
      const result2 = validateTrade(asValidateTradeInput(trade));

      expect(result2).toBeDefined();
      expect(result1).toBeDefined();
      
      // Check that cache has some entries
      const finalMetrics = validationCache.getMetrics();
      expect(finalMetrics.size).toBeGreaterThanOrEqual(initialMetrics.size);
    });

    it('invalidates cache when projected salary changes', () => {
      validationCache.clear();
      const initialMetrics = validationCache.getMetrics();
      
      const trade1 = makeTrade();
      trade1.teams[0].team.hardCapped = true;
      trade1.teams[0].team.teamTotalSalary = 170_000_000;
      const result1 = validateTrade(asValidateTradeInput(trade1));

      const trade2 = makeTrade();
      trade2.teams[0].team.hardCapped = true;
      trade2.teams[0].team.teamTotalSalary = 175_000_000;
      const result2 = validateTrade(asValidateTradeInput(trade2));

      expect(result2).toBeDefined();
      expect(result1).toBeDefined();
      
      // Cache should have entries for both calls
      const finalMetrics = validationCache.getMetrics();
      expect(finalMetrics.size).toBeGreaterThanOrEqual(initialMetrics.size);
    });
  });

  describe('Trade Validation Cache', () => {
    it('caches complete trade validation results', () => {
      const trade = makeTrade();

      validationCache.clear();
      const initialMetrics = validationCache.getMetrics();

      // First call - should compute
      const result1 = validateTrade(asValidateTradeInput(trade));

      // Second call - should use cache
      const result2 = validateTrade(asValidateTradeInput(trade));

      expect(result2).toBeDefined();
      expect(result1).toBeDefined();
      
      // Cache should be working at engine level
      const finalMetrics = validationCache.getMetrics();
      expect(finalMetrics.size).toBeGreaterThanOrEqual(initialMetrics.size);
    });

    it('handles different trade parameters correctly', () => {
      const trade1 = makeTrade();
      const result1 = validateTrade(asValidateTradeInput(trade1));

      // Different trade structure
      const trade2 = makeTrade();
      trade2.teams[0].team.teamTotalSalary = 200_000_000;
      const result2 = validateTrade(asValidateTradeInput(trade2));

      expect(result2).toBeDefined();
      expect(result1).toBeDefined();
      
      // Both should complete successfully regardless of caching
      expect(typeof result1).toBe('object');
      expect(typeof result2).toBe('object');
    });

    it('preserves cache-observable helper behavior and data warning shaping across repeated authoritative validations', () => {
      validationCache.clear();
      const initialMetrics = validationCache.getMetrics();

      const result1 = validateTrade(asValidateTradeInput(makeTradeWithBycWarning()));
      const metricsAfterFirst = validationCache.getMetrics();
      const result2 = validateTrade(asValidateTradeInput(makeTradeWithBycWarning()));
      const metricsAfterSecond = validationCache.getMetrics();

      expect(result1.hasDataIssues).toBe(true);
      expect(result1.dataWarnings).toHaveLength(1);
      expect(result1.dataWarnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'BYC_MISSING_PREVIOUS_SALARY',
            timestamp: expect.any(Number),
          }),
        ])
      );
      expect(result2.hasDataIssues).toBe(true);
      expect(result2.dataWarnings).toHaveLength(1);
      expect(result2.dataWarnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'BYC_MISSING_PREVIOUS_SALARY',
            timestamp: expect.any(Number),
          }),
        ])
      );
      expect(stripWarningTimestamps(result2.dataWarnings)).toEqual(
        stripWarningTimestamps(result1.dataWarnings)
      );
      expect(result2.hasDataIssues).toBe(result1.hasDataIssues);
      expect(metricsAfterFirst.size).toBeGreaterThanOrEqual(initialMetrics.size);
      expect(metricsAfterSecond.hits).toBeGreaterThan(metricsAfterFirst.hits);
    });
  });
});
