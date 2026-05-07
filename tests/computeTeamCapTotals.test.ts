/**
 * Test file for computeTeamCapTotals - Single Source of Truth
 * Verifies that the canonical totals computation is correct and consistent.
 *
 * See docs/architect/cap-sheet/ARCHITECT_CAP_TOTAL_SINGLE_SOURCE.md for details.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeTeamCapTotals,
  createCanonicalTeamTotalsSnapshot,
  warnOnTotalsDivergence,
} from '@/features/architect/utils/capTotals';

// Mock the imports
vi.mock('@/features/architect/utils/tradeMachine/utils/capSettingsProvider', () => ({
  getCapSettingsForYear: vi.fn((year) => ({
    salaryCap: 141_000_000,
    firstApron: 179_000_000,
    secondApron: 190_000_000,
    _meta: {
      source: 'mock',
      seasonKey: `${year - 1}-${String(year).slice(-2)}`,
    },
  })),
  yearToSeasonKey: vi.fn((year) => `${year - 1}-${String(year).slice(-2)}`),
}));

vi.mock('@/features/architect/utils/capRulesProfile', () => ({
  getCapRulesForYear: vi.fn((yearKey) => ({
    seasonKey: `${yearKey - 1}-${String(yearKey).slice(-2)}`,
    cap: {
      salaryCap: 141_000_000,
      luxuryTax: 172_000_000,
      firstApron: 179_000_000,
      secondApron: 190_000_000,
    },
    roster: { minStandard: 14, maxStandard: 15, maxTwoWay: 2, graceMin: 13 },
    salaries: { rookieMin: 1_119_563 },
    _meta: {
      source: 'mock',
      resolved: true,
      sourcesSummary: 'projected',
      sources: {},
    },
  })),
}));

vi.mock('@/features/architect/utils/capHolds', () => ({
  getActiveUnsignedCapHoldsTotalByEndYear: vi.fn((capHolds, year) => {
    if (!Array.isArray(capHolds)) return 0;
    return capHolds
      .filter((h) => h.active && !h.isSigned)
      .reduce((sum, h) => sum + (h.amount || 0), 0);
  }),
}));

vi.mock('@/features/architect/utils/contractUtils', () => ({
  getContractYearSlice: vi.fn((player, year) => {
    const seasonKey = `${year - 1}-${String(year).slice(-2)}`;
    const entry = player?.contract?.salariesByYear?.find(
      (e) => e.season === seasonKey
    );
    return entry || null;
  }),
  getPlayerCapHitForYear: vi.fn((player, year) => {
    const seasonKey = `${year - 1}-${String(year).slice(-2)}`;
    const entry = player?.contract?.salariesByYear?.find(
      (e) => e.season === seasonKey
    );
    return entry?.capHit ?? entry?.salary ?? 0;
  }),
  isTwoWayContract: vi.fn(
    (player) =>
      String(player?.contract?.contractType || '')
        .trim()
        .toLowerCase() === 'two-way'
  ),
}));

vi.mock('@/features/architect/utils/seasonFormat', () => ({
  toSeasonKey: vi.fn((year) => `${year - 1}-${String(year).slice(-2)}`),
  toEndYear: vi.fn((season) => {
    if (/^\d{4}-\d{2}$/.test(String(season))) {
      return 2000 + Number(String(season).split('-')[1]);
    }
    return Number(season);
  }),
}));

describe('computeTeamCapTotals', () => {
  describe('basic computation', () => {
    it('returns correct totals object structure', () => {
      const teamCapSheet = {
        players: [],
        capHolds: [],
      };

      const result = computeTeamCapTotals(teamCapSheet, 2025);

      expect(result).toHaveProperty('yearKey', 2025);
      expect(result).toHaveProperty('playersTotal');
      expect(result).toHaveProperty('deadMoneyTotal');
      expect(result).toHaveProperty('capHoldsTotal');
      expect(result).toHaveProperty('incompleteChargesTotal');
      expect(result).toHaveProperty('totalCapAllocations');
      expect(result).toHaveProperty('salaryCap');
      expect(result).toHaveProperty('firstApron');
      expect(result).toHaveProperty('secondApron');
      expect(result).toHaveProperty('deltas');
      expect(result.deltas).toHaveProperty('vsCap');
      expect(result.deltas).toHaveProperty('vsFirstApron');
      expect(result.deltas).toHaveProperty('vsSecondApron');
      expect(result).toHaveProperty('_meta');
    });

    it('handles empty team data gracefully', () => {
      const result = computeTeamCapTotals(null, 2025);

      expect(result.playersTotal).toBe(0);
      expect(result.deadMoneyTotal).toBe(0);
      expect(result.capHoldsTotal).toBe(0);
      // CBA requires 14-player minimum; empty roster incurs incomplete charges
      expect(result.incompleteChargesTotal).toBe(14 * 1_119_563);
      expect(result.totalCapAllocations).toBe(result.incompleteChargesTotal);
    });

    it('handles undefined team data gracefully', () => {
      const result = computeTeamCapTotals(undefined, 2025);

      expect(result.playersTotal).toBe(0);
      expect(result.deadMoneyTotal).toBe(0);
      expect(result.capHoldsTotal).toBe(0);
      // CBA requires 14-player minimum; empty roster incurs incomplete charges
      expect(result.incompleteChargesTotal).toBe(14 * 1_119_563);
      expect(result.totalCapAllocations).toBe(result.incompleteChargesTotal);
    });
  });

  describe('players total computation', () => {
    it('sums player cap hits for the year', () => {
      const teamCapSheet = {
        players: [
          {
            id: 'player1',
            contract: {
              salariesByYear: [
                { season: '2024-25', salary: 10_000_000, capHit: 10_000_000 },
              ],
            },
          },
          {
            id: 'player2',
            contract: {
              salariesByYear: [
                { season: '2024-25', salary: 15_000_000, capHit: 15_000_000 },
              ],
            },
          },
        ],
        capHolds: [],
      };

      const result = computeTeamCapTotals(teamCapSheet, 2025);

      expect(result.playersTotal).toBe(25_000_000);
    });

    it('prefers capHit over salary when both are present', () => {
      const teamCapSheet = {
        players: [
          {
            id: 'player1',
            contract: {
              salariesByYear: [
                { season: '2024-25', salary: 10_000_000, capHit: 12_000_000 },
              ],
            },
          },
        ],
        capHolds: [],
      };

      const result = computeTeamCapTotals(teamCapSheet, 2025);

      expect(result.playersTotal).toBe(12_000_000);
    });

    it('returns 0 for players without contract data for the year', () => {
      const teamCapSheet = {
        players: [
          {
            id: 'player1',
            contract: {
              salariesByYear: [
                { season: '2023-24', salary: 10_000_000, capHit: 10_000_000 },
              ],
            },
          },
        ],
        capHolds: [],
      };

      const result = computeTeamCapTotals(teamCapSheet, 2025);

      expect(result.playersTotal).toBe(0);
    });
  });

  describe('cap holds total computation', () => {
    it('includes active, unsigned cap holds', () => {
      const teamCapSheet = {
        players: [],
        capHolds: [
          {
            playerId: 'hold1',
            amount: 5_000_000,
            active: true,
            isSigned: false,
            season: '2024-25',
          },
          {
            playerId: 'hold2',
            amount: 3_000_000,
            active: true,
            isSigned: false,
            season: '2024-25',
          },
        ],
      };

      const result = computeTeamCapTotals(teamCapSheet, 2025);

      expect(result.capHoldsTotal).toBe(8_000_000);
    });

    it('excludes signed cap holds', () => {
      const teamCapSheet = {
        players: [],
        capHolds: [
          {
            playerId: 'hold1',
            amount: 5_000_000,
            active: true,
            isSigned: true,
            season: '2024-25',
          },
        ],
      };

      const result = computeTeamCapTotals(teamCapSheet, 2025);

      expect(result.capHoldsTotal).toBe(0);
    });

    it('excludes inactive cap holds', () => {
      const teamCapSheet = {
        players: [],
        capHolds: [
          {
            playerId: 'hold1',
            amount: 5_000_000,
            active: false,
            isSigned: false,
            season: '2024-25',
          },
        ],
      };

      const result = computeTeamCapTotals(teamCapSheet, 2025);

      expect(result.capHoldsTotal).toBe(0);
    });
  });

  describe('dead money computation', () => {
    it('includes dead money from waivedContracts', () => {
      const teamCapSheet = {
        players: [],
        capHolds: [],
        waivedContracts: [
          { deadMoneyByYear: { 2025: 2_000_000 } },
          { deadMoneyByYear: { 2025: 1_500_000 } },
        ],
      };

      const result = computeTeamCapTotals(teamCapSheet, 2025);

      expect(result.deadMoneyTotal).toBe(3_500_000);
    });

    it('includes dead money from stretchHistory', () => {
      const teamCapSheet = {
        players: [],
        capHolds: [],
        stretchHistory: [{ amountByYear: { 2025: 3_000_000 } }],
      };

      const result = computeTeamCapTotals(teamCapSheet, 2025);

      expect(result.deadMoneyTotal).toBe(3_000_000);
    });

    it('includes dead money from flat deadMoney object', () => {
      const teamCapSheet = {
        players: [],
        capHolds: [],
        deadMoney: { 2025: 4_000_000 },
      };

      const result = computeTeamCapTotals(teamCapSheet, 2025);

      expect(result.deadMoneyTotal).toBe(4_000_000);
    });

    it('combines dead money from all sources', () => {
      const teamCapSheet = {
        players: [],
        capHolds: [],
        waivedContracts: [{ deadMoneyByYear: { 2025: 2_000_000 } }],
        stretchHistory: [{ amountByYear: { 2025: 1_000_000 } }],
        deadMoney: { 2025: 500_000 },
      };

      const result = computeTeamCapTotals(teamCapSheet, 2025);

      expect(result.deadMoneyTotal).toBe(3_500_000);
    });
  });

  describe('totalCapAllocations computation', () => {
    it('sums players + cap holds + dead money', () => {
      const teamCapSheet = {
        players: [
          {
            id: 'player1',
            contract: {
              salariesByYear: [
                { season: '2024-25', salary: 20_000_000, capHit: 20_000_000 },
              ],
            },
          },
        ],
        capHolds: [
          {
            playerId: 'hold1',
            amount: 5_000_000,
            active: true,
            isSigned: false,
            season: '2024-25',
          },
        ],
        waivedContracts: [{ deadMoneyByYear: { 2025: 2_000_000 } }],
      };

      const result = computeTeamCapTotals(teamCapSheet, 2025);

      expect(result.playersTotal).toBe(20_000_000);
      expect(result.capHoldsTotal).toBe(5_000_000);
      expect(result.deadMoneyTotal).toBe(2_000_000);
      // 1 standard player → 13 missing slots × rookieMin = 14,554,319
      const expectedIncomplete = 13 * 1_119_563;
      expect(result.totalCapAllocations).toBe(
        20_000_000 + 5_000_000 + 2_000_000 + expectedIncomplete
      );
    });

    it('includes incomplete roster charges for undersized rosters', () => {
      const teamCapSheet = {
        players: [],
        capHolds: [],
      };

      const result = computeTeamCapTotals(teamCapSheet, 2025);

      // CBA requires 14-player minimum; empty roster incurs 14 × rookieMin
      expect(result.incompleteChargesTotal).toBe(14 * 1_119_563);
    });
  });

  describe('deltas computation', () => {
    it('calculates correct deltas vs cap thresholds', () => {
      const teamCapSheet = {
        players: [
          {
            id: 'player1',
            contract: {
              salariesByYear: [
                { season: '2024-25', salary: 150_000_000, capHit: 150_000_000 },
              ],
            },
          },
        ],
        capHolds: [],
      };

      const result = computeTeamCapTotals(teamCapSheet, 2025);

      // 1 standard player → 13 missing slots × rookieMin
      const incompleteCharges = 13 * 1_119_563;
      const total = 150_000_000 + incompleteCharges;

      // salaryCap = 141M, firstApron = 179M, secondApron = 190M
      expect(result.deltas.vsCap).toBe(total - 141_000_000);
      expect(result.deltas.vsFirstApron).toBe(total - 179_000_000);
      expect(result.deltas.vsSecondApron).toBe(total - 190_000_000);
    });

    it('negative deltas indicate room under threshold', () => {
      const teamCapSheet = {
        players: [
          {
            id: 'player1',
            contract: {
              salariesByYear: [
                { season: '2024-25', salary: 100_000_000, capHit: 100_000_000 },
              ],
            },
          },
        ],
        capHolds: [],
      };

      const result = computeTeamCapTotals(teamCapSheet, 2025);

      expect(result.deltas.vsCap).toBeLessThan(0); // Under cap
      expect(result.deltas.vsFirstApron).toBeLessThan(0); // Under first apron
      expect(result.deltas.vsSecondApron).toBeLessThan(0); // Under second apron
    });
  });

  describe('cap settings integration', () => {
    it('uses cap settings from the provider', () => {
      const teamCapSheet = {
        players: [],
        capHolds: [],
      };

      const result = computeTeamCapTotals(teamCapSheet, 2025);

      expect(result.salaryCap).toBe(141_000_000);
      expect(result.firstApron).toBe(179_000_000);
      expect(result.secondApron).toBe(190_000_000);
    });

    it('includes metadata about cap settings source', () => {
      const teamCapSheet = {
        players: [],
        capHolds: [],
      };

      const result = computeTeamCapTotals(teamCapSheet, 2025);

      expect(result._meta.source).toBe('computeTeamCapTotals');
      expect(result._meta.capSettingsSource).toBe('via_facade');
    });
  });

  describe('snapshot containment', () => {
    it('builds snapshots from canonical totals and applies hard-cap overlay downstream', () => {
      const teamCapSheet = {
        players: [
          {
            id: 'player1',
            contract: {
              salariesByYear: [
                { season: '2024-25', salary: 20_000_000, capHit: 20_000_000 },
              ],
            },
          },
        ],
        capHolds: [],
        totals: {
          totalCapAllocations: 999,
          capSpace: -999,
          hardCapRoom: 123,
        },
        hardCapLevel: 'firstApron',
        hardCapReason: 'Taxpayer MLE hard cap',
      };

      const snapshot = createCanonicalTeamTotalsSnapshot(teamCapSheet, 2025);
      const expectedIncomplete = 13 * 1_119_563;
      const expectedTotal = 20_000_000 + expectedIncomplete;

      expect(snapshot.totalCapAllocations).toBe(expectedTotal);
      expect(snapshot.capSpace).toBe(141_000_000 - expectedTotal);
      expect(snapshot.hardCapLevel).toBe('firstApron');
      expect(snapshot.isHardCapped).toBe(true);
      expect(snapshot.hardCapReason).toBe('Taxpayer MLE hard cap');
      expect(snapshot.hardCapRoom).toBe(179_000_000 - expectedTotal);
    });
  });

  describe('regression: Lakers-style mismatch prevention', () => {
    /**
     * This test ensures that both CapSummaryTiles and CapImpactTiles
     * would produce the same totals when given the same team data,
     * because they both use computeTeamCapTotals as the single source.
     *
     * The Lakers-style mismatch occurred when:
     * - Cap Sheet used: players + capHolds (no dead money)
     * - Trade Machine used: players + deadMoney (no cap holds)
     *
     * With the single source of truth, both MUST include all three.
     */
    it('includes ALL components: players + capHolds + deadMoney', () => {
      const teamCapSheet = {
        players: [
          {
            id: 'player1',
            contract: {
              salariesByYear: [
                { season: '2024-25', salary: 100_000_000, capHit: 100_000_000 },
              ],
            },
          },
        ],
        capHolds: [
          {
            playerId: 'hold1',
            amount: 10_000_000,
            active: true,
            isSigned: false,
            season: '2024-25',
          },
        ],
        waivedContracts: [{ deadMoneyByYear: { 2025: 5_000_000 } }],
      };

      const result = computeTeamCapTotals(teamCapSheet, 2025);

      // ALL three components must be included
      expect(result.playersTotal).toBe(100_000_000);
      expect(result.capHoldsTotal).toBe(10_000_000);
      expect(result.deadMoneyTotal).toBe(5_000_000);

      // Total must be sum of all components including incomplete roster charges
      // 1 standard player → 13 missing slots × rookieMin
      const expectedIncomplete = 13 * 1_119_563;
      expect(result.totalCapAllocations).toBe(
        100_000_000 + 10_000_000 + 5_000_000 + expectedIncomplete
      );

      // Previous mismatch scenarios:
      // Old Cap Sheet: 100M + 10M = 110M (missing dead money)
      // Old Trade Machine: 100M + 5M = 105M (missing cap holds)
      // Canonical: 100M + 10M + 5M = 115M (all components)
    });

    it('calling computeTeamCapTotals twice produces identical results', () => {
      const teamCapSheet = {
        players: [
          {
            id: 'player1',
            contract: {
              salariesByYear: [
                { season: '2024-25', salary: 150_000_000, capHit: 150_000_000 },
              ],
            },
          },
        ],
        capHolds: [
          {
            playerId: 'hold1',
            amount: 8_000_000,
            active: true,
            isSigned: false,
            season: '2024-25',
          },
        ],
        waivedContracts: [{ deadMoneyByYear: { 2025: 3_000_000 } }],
      };

      // Simulate Cap Sheet calling the function
      const capSheetResult = computeTeamCapTotals(teamCapSheet, 2025);

      // Simulate Trade Machine calling the same function
      const tradeMachineResult = computeTeamCapTotals(teamCapSheet, 2025);

      // They MUST be identical
      expect(capSheetResult.totalCapAllocations).toBe(
        tradeMachineResult.totalCapAllocations
      );
      expect(capSheetResult.playersTotal).toBe(tradeMachineResult.playersTotal);
      expect(capSheetResult.capHoldsTotal).toBe(tradeMachineResult.capHoldsTotal);
      expect(capSheetResult.deadMoneyTotal).toBe(tradeMachineResult.deadMoneyTotal);
    });
  });
});

describe('warnOnTotalsDivergence', () => {
  let consoleWarnSpy;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('warns when displayed value differs from canonical value', () => {
    warnOnTotalsDivergence(
      'TestComponent',
      'totalCapAllocations',
      100_000_000, // displayed
      105_000_000, // canonical
      1 // tolerance
    );

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('TOTALS DIVERGENCE'),
      expect.objectContaining({
        displayedValue: 100_000_000,
        canonicalValue: 105_000_000,
        diff: 5_000_000,
      })
    );
  });

  it('does not warn when values are within tolerance', () => {
    warnOnTotalsDivergence(
      'TestComponent',
      'totalCapAllocations',
      100_000_000, // displayed
      100_000_001, // canonical (1 off due to rounding)
      1 // tolerance
    );

    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('does not warn when values are identical', () => {
    warnOnTotalsDivergence(
      'TestComponent',
      'totalCapAllocations',
      100_000_000,
      100_000_000
    );

    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});
