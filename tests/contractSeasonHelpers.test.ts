import { afterEach, describe, expect, it, vi } from 'vitest';
import * as contractUtils from '@/features/architect/utils/contractUtils';
import { calculateCapHold } from '@/features/architect/utils/capHolds';
import {
  getDefaultSeasonEndYear,
  parseSeason,
  seasonEndYearsFromCaps,
  toEndYear,
  toSeasonCode,
  toSeasonKey,
} from '@/features/architect/utils/seasonFormat';

const {
  createMaxContract,
  generateContract,
  generateDefaultFreeAgentContract,
  generateExtensionContract,
  generateRookieContract,
  getPlayerCapSheetAmountsForYear,
  getContractYearSlice,
  getContractYearsForDisplay,
  getLastSalary,
  getMinimumCapHit,
  getMinimumSalary,
  getYearsRemainingDisplay,
  stretchContract,
} = contractUtils;

afterEach(() => {
  vi.useRealTimers();
});

describe('contract and season helpers', () => {
  describe('seasonFormat', () => {
    it('preserves mixed season conversion semantics and fallbacks', () => {
      expect(toSeasonCode(2025)).toBe('2024-25');
      expect(toSeasonCode('bad')).toBe('bad');
      expect(toSeasonKey(2026)).toBe('2025-26');

      expect(toEndYear('2024-25')).toBe(2025);
      expect(toEndYear(2026)).toBe(2026);
      expect(toEndYear('bad')).toBeNull();

      expect(parseSeason('2024-25')).toBe('2024-25');
      expect(parseSeason(2026)).toBe('2025-26');
      expect(parseSeason('oops')).toBe('oops');
    });

    it('preserves the July 1 default season boundary', () => {
      expect(getDefaultSeasonEndYear(new Date('2026-06-30T12:00:00Z'))).toBe(
        2026
      );
      expect(getDefaultSeasonEndYear(new Date('2026-07-01T12:00:00Z'))).toBe(
        2027
      );
    });

    it('preserves cap-year parsing semantics and the empty fallback window', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-15T12:00:00Z'));

      expect(
        seasonEndYearsFromCaps({
          '1999-00': {},
          '2024': {},
          '2025-26': {},
          invalid: {},
        })
      ).toEqual([2000, 2024, 2026]);

      expect(seasonEndYearsFromCaps({})).toEqual([2025, 2026, 2027]);
    });
  });

  describe('contractUtils', () => {
    it('keeps the behavior-bearing export surface intact, including calculateCapHold', () => {
      const expectedExports = [
        'generateContract',
        'generateExtensionContract',
        'getContractYearsForDisplay',
        'getYearsRemainingDisplay',
        'getContractYearSlice',
        'createMaxContract',
        'generateRookieContract',
        'getMinimumSalary',
        'stretchContract',
        'getMinimumCapHit',
        'calculateCapHold',
        'generateDefaultFreeAgentContract',
        'getLastSalary',
      ] as const;

      for (const exportName of expectedExports) {
        expect(contractUtils[exportName]).toBeDefined();
      }

      expect(contractUtils.calculateCapHold).toBe(calculateCapHold);
    });

    it('preserves generic, extension, max, rookie, and summary contract shaping', () => {
      expect(
        generateContract({
          baseSalary: 10_000_000,
          years: 2,
          startYear: 2025,
        })
      ).toEqual({
        salariesByYear: [
          {
            season: '2024-25',
            salary: 10_000_000,
            capHit: 10_000_000,
            guaranteed: true,
            guaranteedAmount: 10_000_000,
            option: null,
            optionUsed: null,
            tradeBonus: null,
          },
          {
            season: '2025-26',
            salary: 10_800_000,
            capHit: 10_800_000,
            guaranteed: true,
            guaranteedAmount: 10_800_000,
            option: null,
            optionUsed: null,
            tradeBonus: null,
          },
        ],
        extension: false,
        totalValue: 20_800_000,
        yearsLeft: 2,
        birdRights: 'Full Bird',
        freeAgency: '2027 (UFA)',
      });

      expect(
        generateExtensionContract({
          firstYearSalary: 8_000_000,
          years: 1,
          raisePct: 0,
          startYear: 2026,
        }).extension
      ).toBe(true);

      expect(
        createMaxContract('Test Player', 7, { '2025-26': { cap: 100_000_000 } })
          .salariesByYear[0]?.salary
      ).toBe(30_000_000);

      const rookie = generateRookieContract(99, 2025);
      expect(rookie.salariesByYear[0]?.salary).toBe(2_500_000);
      expect(rookie.salariesByYear[3]?.option).toBe('Team Option');

      expect(
        generateDefaultFreeAgentContract(2_200_000, 2025, 6)
      ).toMatchObject({
        signAndTrade: false,
        guaranteed: true,
        isMinimum: true,
        yearsOfService: 6,
      });
    });

    it('preserves exact contract-row merge, dedupe, sort, and extension precedence behavior', () => {
      const sharedContract = {
        salariesByYear: [{ season: '2024-25', salary: 1_000_000, capHit: 1_100_000 }],
      };

      expect(
        getContractYearsForDisplay({ contract: sharedContract }, {
          primaryContract: sharedContract,
        })
      ).toHaveLength(1);

      const player = {
        contract: {
          salariesByYear: [
            { season: '2024-25', salary: 10_000_000, capHit: 11_000_000, guaranteed: true },
          ],
        },
        futureContract: {
          salariesByYear: [
            {
              season: '2025-26',
              salary: 30_000_000,
              capHit: 31_000_000,
              guaranteed: false,
              option: 'Player Option',
            },
            { year: 2027, salary: 40_000_000, guaranteed: true },
          ],
        },
      };
      const primaryContract = {
        salariesByYear: [
          {
            season: '2025-26',
            salary: 20_000_000,
            capHit: 21_000_000,
            guaranteed: true,
            optionType: 'Team Option',
          },
        ],
      };

      const displayRows = getContractYearsForDisplay(player, { primaryContract });

      expect(displayRows.map((row) => row.year)).toEqual([2025, 2026, 2027]);
      expect(displayRows[0]).toMatchObject({
        season: '2024-25',
        salary: 10_000_000,
        capHit: 11_000_000,
        guaranteed: true,
        option: null,
        isExtension: false,
        contractSource: 'playerContract',
      });
      expect(displayRows[1]).toMatchObject({
        season: '2025-26',
        salary: 30_000_000,
        capHit: 31_000_000,
        guaranteed: false,
        option: 'Player Option',
        isExtension: true,
        contractSource: 'futureContract',
      });
      expect(displayRows[2]).toMatchObject({
        year: 2027,
        season: '2026-27',
        salary: 40_000_000,
        capHit: 40_000_000,
        guaranteed: true,
        option: null,
        isExtension: true,
        contractSource: 'futureContract',
      });

      const baseContractWinsSameYear = getContractYearsForDisplay(
        {
          contract: {
            salariesByYear: [{ season: '2025-26', salary: 18_000_000, capHit: 18_500_000 }],
          },
        },
        {
          primaryContract: {
            salariesByYear: [{ season: '2025-26', salary: 20_000_000, capHit: 21_000_000 }],
          },
        }
      );
      expect(baseContractWinsSameYear[0]).toMatchObject({
        salary: 18_000_000,
        capHit: 18_500_000,
        contractSource: 'playerContract',
      });

      const optionFallbackRow = getContractYearsForDisplay(
        { futureContract: null },
        {
          primaryContract: {
            salariesByYear: [{ season: '2026-27', capHit: 12_000_000, optionType: 'Team Option' }],
          },
        }
      );
      expect(optionFallbackRow[0]).toMatchObject({
        option: 'Team Option',
        salary: 12_000_000,
        capHit: 12_000_000,
        contractSource: 'primaryContract',
      });
    });

    it('preserves year-slice behavior and keeps years-remaining row-first when row truth exists', () => {
      const player = {
        contract: {
          yearsRemaining: 5,
          salariesByYear: [
            { season: '2024-25', salary: 10_000_000, capHit: 10_500_000 },
          ],
        },
        futureContract: {
          salariesByYear: [
            { season: '2025-26', salary: 25_000_000, capHit: 25_500_000 },
            { season: '2026-27', salary: 30_000_000, capHit: 30_500_000 },
          ],
        },
      };

      expect(getContractYearSlice(player, 2026)).toMatchObject({
        season: '2025-26',
        salary: 25_000_000,
        capHit: 25_500_000,
        isExtensionSeason: true,
        source: 'extension',
      });
      expect(getContractYearSlice(player, 2030)).toBeNull();

      expect(
        getYearsRemainingDisplay({
          player,
          currentYear: 2026,
        })
      ).toBe(2);

      expect(
        getYearsRemainingDisplay({
          player: {
            contract: {
              yearsRemaining: 3,
              salariesByYear: [
                { season: '2024-25', salary: 10_000_000, capHit: 10_000_000 },
              ],
            },
          },
          currentYear: 2026,
        })
      ).toBe(0);

      expect(
        getYearsRemainingDisplay({
          player: {
            contract: { yearsRemaining: 3 },
          },
          currentYear: 2026,
        })
      ).toBe(3);

      expect(
        getYearsRemainingDisplay({
          player: {
            bio: {
              display: {
                freeAgentYear: 2029,
              },
            },
          },
          currentYear: 2026,
        })
      ).toBe(3);
    });

    it('preserves minimum salary, stretch, and last-salary behavior while making minimum cap hits year-aware', () => {
      expect(getMinimumSalary(0)).toBe(1_120_000);
      expect(getMinimumSalary(22)).toBe(3_800_000);
      expect(getMinimumCapHit(2)).toBe(2_092_400);
      expect(getMinimumCapHit(3)).toBe(2_092_400);
      expect(getMinimumCapHit(3, 2026)).toBe(2_176_096);

      expect(
        getPlayerCapSheetAmountsForYear(
          {
            isMinimum: true,
            yearsOfService: 4,
            contract: {
              salariesByYear: [
                { season: '2025-26', salary: 2_485_600, capHit: 2_485_600 },
              ],
            },
          },
          2026
        )
      ).toMatchObject({
        capHit: 2_176_096,
        baseSalary: 2_485_600,
        hasCapHitAdjustment: true,
      });

      expect(
        getPlayerCapSheetAmountsForYear(
          {
            isMinimum: true,
            yearsOfService: 4,
            contract: {
              salariesByYear: [
                { season: '2026-27', salary: 2_485_600, capHit: 2_485_600 },
              ],
            },
          },
          2026
        )
      ).toEqual({
        contractSlice: null,
        capHit: 0,
        baseSalary: 0,
        hasCapHitAdjustment: false,
      });

      expect(
        stretchContract(
          {
            salariesByYear: [
              { season: '2025-26', salary: 10_000_000 },
              { season: '2026-27', salary: 12_000_000 },
            ],
          },
          2026
        )
      ).toEqual({
        2026: 4_400_000,
        2027: 4_400_000,
        2028: 4_400_000,
        2029: 4_400_000,
        2030: 4_400_000,
      });

      expect(
        getLastSalary({
          contract: {
            salariesByYear: [
              { season: '2024-25', salary: 15_000_000 },
              { season: '2025-26', capHit: 18_000_000 },
            ],
          },
        })
      ).toBe(18_000_000);
    });
  });
});
