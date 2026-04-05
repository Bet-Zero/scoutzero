/**
 * FILE: src/tests/architect/myct_step3_guardrails.test.ts
 * PURPOSE: Focused closeout guardrails for Multi-Year Cap Table Step 3.
 * OWNERSHIP: Feature: architect
 *
 * Protects:
 * - contractUtils as the player-year merge and cap-hit seam owner
 * - same-year precedence across playerContract / primaryContract / futureContract
 * - row-first years-remaining behavior with bounded legacy fallback
 * - selected-year cap-hit adjustments and downstream totals alignment
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getContractYearSlice,
  getContractYearsForDisplay,
  getMinimumCapHit,
  getPlayerCapHitForYear,
  getPlayerCapSheetAmountsForYear,
  getYearsRemainingDisplay,
} from '@/features/architect/utils/contractUtils';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { getMinimumCapHit as getSharedMinimumCapHit } from '@/features/architect/utils/playerRulesProfile/minimumSalaryRules';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('MYCT Step 3 Guardrails - Source Scan', () => {
  const architectRoot = path.resolve(__dirname, '../../features/architect');
  const contractUtilsPath = path.join(architectRoot, 'utils/contractUtils.ts');
  const computeTotalsPath = path.join(
    architectRoot,
    'utils/capTotals/computeTeamCapTotals.ts'
  );

  it('contractUtils remains the merge owner and futureContract precedence surface', () => {
    const source = fs.readFileSync(contractUtilsPath, 'utf-8');

    expect(source).toContain(
      "type ContractYearSource = 'playerContract' | 'primaryContract' | 'futureContract';"
    );
    expect(source).toContain('function selectAuthoritativeContractYear');
    expect(source).toContain('function mergeContractYearsByYear');
    expect(source).toContain(
      "addContractRows(player.futureContract, 'futureContract');"
    );
    expect(source).toContain(
      "source: contractYear.isExtension ? 'extension' : 'contract'"
    );
  });

  it('contractUtils keeps season-aware minimum-cap-hit routing explicit in source', () => {
    const source = fs.readFileSync(contractUtilsPath, 'utf-8');

    expect(source).toContain(
      "import { getMinimumCapHit as getMinimumCapHitFromMinimumSalaryRules } from './playerRulesProfile/minimumSalaryRules';"
    );
    expect(source).toContain(
      "if (existing.contractSource === 'futureContract')"
    );
    expect(source).toContain(
      "if (incoming.contractSource === 'futureContract')"
    );
    expect(source).toMatch(
      /if\s*\(\s*contractSource !== 'futureContract'\s*&&/
    );
    expect(source).toContain('capHit = getMinimumCapHit(yearsOfService, endYear);');
    expect(source).toContain('return getMinimumCapHitFromMinimumSalaryRules(');
  });

  it('computeTeamCapTotals remains a downstream consumer of selected-year cap-hit truth', () => {
    const source = fs.readFileSync(computeTotalsPath, 'utf-8');

    expect(source).toMatch(
      /import\s+\{\s*getPlayerCapHitForYear,\s*isTwoWayContract,\s*\}\s+from\s+['"]@\/features\/architect\/utils\/contractUtils['"]/
    );
    expect(source).toContain('num(getPlayerCapHitForYear((asRecord(player) || {}) as TeamPlayerLike, endYear))');
    expect(source).not.toContain('getContractYearsForDisplay(');
    expect(source).not.toContain('getMinimumCapHit(');
  });
});

describe('MYCT Step 3 Guardrails - Merge Truth and Years Remaining', () => {
  it('keeps duplicate same-source ownership stable, futureContract precedence loud, and extension slices explicit', () => {
    const player = {
      contract: {
        salariesByYear: [
          { season: '2024-25', salary: 10_000_000, capHit: 10_000_000 },
          { season: '2024-25', salary: 12_000_000, capHit: 12_000_000 },
          { season: '2025-26', salary: 18_000_000, capHit: 18_500_000 },
        ],
      },
      futureContract: {
        salariesByYear: [
          { season: '2025-26', salary: 30_000_000, capHit: 30_000_000 },
        ],
      },
    };
    const primaryContract = {
      salariesByYear: [
        { season: '2025-26', salary: 20_000_000, capHit: 21_000_000 },
        { season: '2026-27', salary: 14_000_000, capHit: 14_000_000 },
      ],
    };

    const displayRows = getContractYearsForDisplay(player, { primaryContract });

    expect(displayRows).toEqual([
      expect.objectContaining({
        year: 2025,
        salary: 10_000_000,
        capHit: 10_000_000,
        contractSource: 'playerContract',
      }),
      expect.objectContaining({
        year: 2026,
        salary: 30_000_000,
        capHit: 30_000_000,
        contractSource: 'futureContract',
        isExtension: true,
      }),
      expect.objectContaining({
        year: 2027,
        salary: 14_000_000,
        capHit: 14_000_000,
        contractSource: 'primaryContract',
      }),
    ]);

    expect(getContractYearSlice(player, 2026)).toMatchObject({
      year: 2026,
      salary: 30_000_000,
      contractSource: 'futureContract',
      isExtensionSeason: true,
      source: 'extension',
    });
  });

  it('keeps playerContract ahead of primaryContract when no future row overlaps', () => {
    const displayRows = getContractYearsForDisplay(
      {
        contract: {
          salariesByYear: [
            { season: '2025-26', salary: 18_000_000, capHit: 18_500_000 },
          ],
        },
      },
      {
        primaryContract: {
          salariesByYear: [
            { season: '2025-26', salary: 20_000_000, capHit: 21_000_000 },
          ],
        },
      }
    );

    expect(displayRows).toEqual([
      expect.objectContaining({
        year: 2026,
        salary: 18_000_000,
        capHit: 18_500_000,
        contractSource: 'playerContract',
      }),
    ]);
  });

  it('keeps row truth authoritative and legacy fallback bounded to rowless cases', () => {
    expect(
      getYearsRemainingDisplay({
        player: {
          contract: {
            yearsRemaining: 7,
            freeAgency: { year: 2032 },
            salariesByYear: [
              { season: '2024-25', salary: 9_000_000, capHit: 9_000_000 },
            ],
          },
          bio: {
            display: {
              freeAgentYear: 2034,
            },
          },
          freeAgentYear: 2035,
        },
        currentYear: 2026,
      })
    ).toBe(0);

    expect(
      getYearsRemainingDisplay({
        player: {
          contract: {
            yearsRemaining: 4,
          },
        },
        currentYear: 2026,
      })
    ).toBe(4);

    expect(
      getYearsRemainingDisplay({
        player: {},
        currentYear: 2026,
        primaryContract: {
          yearsRemaining: 2,
        },
      })
    ).toBe(2);

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
});

describe('MYCT Step 3 Guardrails - Cap Hit and Downstream Totals', () => {
  const YEAR = 2026;

  it('keeps two-way zeroing, minimum reimbursement, future-only slice guards, and totals alignment on one selected-year model', () => {
    const extensionPlayer = {
      playerId: 'extension-player',
      contract: {
        contractType: 'Standard',
        salariesByYear: [
          { season: '2025-26', salary: 18_000_000, capHit: 18_500_000 },
        ],
      },
      futureContract: {
        salariesByYear: [
          { season: '2025-26', salary: 30_000_000, capHit: 30_000_000 },
        ],
      },
    };
    const veteranMinimumPlayer = {
      playerId: 'veteran-minimum-player',
      isMinimum: true,
      yearsOfService: 4,
      contract: {
        contractType: 'Standard',
        salariesByYear: [
          { season: '2025-26', salary: 2_485_600, capHit: 2_485_600 },
        ],
      },
    };
    const adjustedStandardPlayer = {
      playerId: 'adjusted-standard-player',
      contract: {
        contractType: 'Standard',
        salariesByYear: [
          { season: '2025-26', salary: 8_000_000, capHit: 9_000_000 },
        ],
      },
    };
    const twoWayPlayer = {
      playerId: 'two-way-player',
      contractType: 'two-way',
      contract: {
        contractType: 'Two-Way',
        salariesByYear: [
          { season: '2025-26', salary: 700_000, capHit: 700_000 },
        ],
      },
    };
    const futureOnlyMinimumPlayer = {
      playerId: 'future-only-minimum-player',
      isMinimum: true,
      yearsOfService: 4,
      contract: {
        contractType: 'Standard',
        salariesByYear: [
          { season: '2026-27', salary: 2_485_600, capHit: 2_485_600 },
        ],
      },
    };
    const team = {
      players: [
        extensionPlayer,
        veteranMinimumPlayer,
        adjustedStandardPlayer,
        twoWayPlayer,
        futureOnlyMinimumPlayer,
      ],
      deadCap: [],
      capHolds: [],
    };

    const sharedMinimumCapHit = getSharedMinimumCapHit(4, '2025-26');

    expect(getMinimumCapHit(4, YEAR)).toBe(sharedMinimumCapHit);
    expect(getPlayerCapSheetAmountsForYear(extensionPlayer, YEAR)).toMatchObject({
      contractSlice: expect.objectContaining({
        contractSource: 'futureContract',
      }),
      capHit: 30_000_000,
      baseSalary: 30_000_000,
      hasCapHitAdjustment: false,
    });
    expect(
      getPlayerCapSheetAmountsForYear(veteranMinimumPlayer, YEAR)
    ).toMatchObject({
      contractSlice: expect.objectContaining({
        season: '2025-26',
      }),
      capHit: sharedMinimumCapHit,
      baseSalary: 2_485_600,
      hasCapHitAdjustment: true,
    });
    expect(getPlayerCapSheetAmountsForYear(twoWayPlayer, YEAR)).toMatchObject({
      capHit: 0,
      baseSalary: 700_000,
      hasCapHitAdjustment: true,
    });
    expect(
      getPlayerCapSheetAmountsForYear(futureOnlyMinimumPlayer, YEAR)
    ).toEqual({
      contractSlice: null,
      capHit: 0,
      baseSalary: 0,
      hasCapHitAdjustment: false,
    });

    const manualCapHitTotal = team.players.reduce(
      (sum, player) => sum + getPlayerCapHitForYear(player, YEAR),
      0
    );
    const manualAmountsTotal = team.players.reduce(
      (sum, player) => sum + getPlayerCapSheetAmountsForYear(player, YEAR).capHit,
      0
    );
    const totals = computeTeamCapTotals(team, YEAR);

    expect(manualCapHitTotal).toBe(41_176_096);
    expect(manualAmountsTotal).toBe(manualCapHitTotal);
    expect(totals.playersTotal).toBe(manualCapHitTotal);
  });
});
