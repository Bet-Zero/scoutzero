/**
 * FILE: src/tests/architect/myct_step2_guardrails.test.ts
 * PURPOSE: Focused closeout guardrails for Multi-Year Cap Table Step 2.
 * OWNERSHIP: Feature: architect
 *
 * Protects:
 * - capRulesProfile as the yearly threshold gateway
 * - conservative threshold provenance reporting
 * - canonical-first dead-money compatibility behavior
 * - snapshot helpers consuming canonical totals
 * - selected/end-year truth for future-year totals computation
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  computeTeamCapTotals,
  createCanonicalTeamTotalsSnapshot,
  synchronizeTeamTotalsSnapshot,
} from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { computeDeadMoneyForYear } from '@/features/architect/utils/capTotals/deadMoneyForYear';
import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_TAG_PRIORITY = ['unknown', 'projected', 'reported', 'real'] as const;

function getConservativeSummary(tags: string[]): string | undefined {
  return SOURCE_TAG_PRIORITY.find((tag) => tags.includes(tag));
}

function countMappedThresholdFields(
  fieldsBySource:
    | Partial<Record<string, string[]>>
    | null
    | undefined
): number {
  return Object.values(fieldsBySource || {}).reduce(
    (sum, entries) => sum + (entries?.length ?? 0),
    0
  );
}

describe('MYCT Step 2 Guardrails - Source Scan', () => {
  const architectRoot = path.resolve(__dirname, '../../features/architect');
  const capRulesProfilePath = path.join(
    architectRoot,
    'utils/capRulesProfile/capRulesProfile.ts'
  );
  const computeTotalsPath = path.join(
    architectRoot,
    'utils/capTotals/computeTeamCapTotals.ts'
  );
  const deadMoneyHelperPath = path.join(
    architectRoot,
    'utils/capTotals/deadMoneyForYear.ts'
  );

  it('capRulesProfile remains the yearly threshold gateway', () => {
    const source = fs.readFileSync(capRulesProfilePath, 'utf-8');

    expect(source).toContain('export function getCapRulesForYear');
    expect(source).toContain('getCapSettingsForYear');
    expect(source).toContain('resolveRookieMinimumForYear');
  });

  it('computeTeamCapTotals routes yearly threshold truth through capRulesProfile and end-year cap holds', () => {
    const source = fs.readFileSync(computeTotalsPath, 'utf-8');

    expect(source).toMatch(
      /import\s+\{\s*getCapRulesForYear\s*\}\s+from\s+['"]@\/features\/architect\/utils\/capRulesProfile['"]/
    );
    expect(source).toMatch(
      /import\s+\{\s*getActiveUnsignedCapHoldsTotalByEndYear\s*\}\s+from\s+['"]@\/features\/architect\/utils\/capHolds['"]/
    );
    expect(source).toContain('const normalizedYear = toEndYear(selectedYear);');
    expect(source).toContain('const yearKey = Number.isFinite(normalizedYear)');
    expect(source).toContain(
      'const rules = getCapRulesForYear(yearKey, options.capProjections);'
    );
    expect(source).not.toContain('getCapRulesForYear(yearKey, options.capProjections) as any');
    expect(source).toContain('getActiveUnsignedCapHoldsTotalByEndYear(');
    expect(source).not.toContain('currentYear');
    expect(source).not.toContain('getCapSettingsForYear');
    expect(source).not.toContain('CBA_THRESHOLDS');
    expect(source).not.toMatch(/from\s+['"][^'"]*capProjections['"]/);
  });

  it('snapshot and derived helpers consume computeTeamCapTotals rather than partially recomputing totals', () => {
    const source = fs.readFileSync(computeTotalsPath, 'utf-8');

    expect(source).toMatch(
      /const\s+canonicalTotals\s*=\s*computeTeamCapTotals\s*\(\s*teamCapSheet\s*,\s*selectedYear\s*,\s*options\s*\)\s*;/
    );
    expect(source).toMatch(
      /const\s+totals\s*=\s*computeTeamCapTotals\s*\(\s*team\s*,\s*yearKey\s*\)\s*;/
    );
  });

  it('bounded legacy dead-money compatibility remains contained in the dedicated helper', () => {
    const source = fs.readFileSync(deadMoneyHelperPath, 'utf-8');

    expect(source).toContain('export function computeDeadMoneyForYear');
    expect(source).toContain('if (deadCapResolution.hasCoverage)');
    expect(source).toContain(
      'return computeLegacyDeadMoneyCompatibilityTotalForYear(teamCapSheet, endYear);'
    );
  });
});

describe('MYCT Step 2 Guardrails - Threshold Provenance', () => {
  it('keeps sourcesSummary conservative relative to active source tags', () => {
    const realRules = getCapRulesForYear(2026);
    const mixedRules = getCapRulesForYear(2026, {
      '2025-26': {
        cap: 154_647_000,
        tax: 187_895_000,
        firstApron: 195_945_000,
        secondApron: 207_824_000,
        bae: 5_135_000,
        roomMLE: 8_781_000,
        fullMLE: 14_104_000,
        taxpayerMLE: 5_685_000,
        confirmed: true,
      },
    });
    const projectedRules = getCapRulesForYear(2028);

    for (const rules of [realRules, mixedRules, projectedRules]) {
      const tags = rules._meta?.sourceTags ?? [];
      expect(rules._meta?.sourcesSummary).toBe(getConservativeSummary(tags));
      expect(rules._meta?.sourcesMixed).toBe(tags.length > 1);
      expect(countMappedThresholdFields(rules._meta?.fieldsBySource)).toBe(9);
    }

    expect(mixedRules._meta?.sourceTags).toEqual(['projected', 'real']);
    expect(mixedRules._meta?.fieldsBySource.projected).toEqual([
      'salaries.rookieMin',
    ]);
    expect(mixedRules._meta?.fieldsBySource.real).toHaveLength(8);
  });

  it('reports legacyThreshold when a real-year rookie minimum falls back to CBA thresholds', () => {
    const rules = getCapRulesForYear(2025, {
      '2024-25': {
        cap: 141_000_000,
        tax: 171_000_000,
        firstApron: 179_000_000,
        secondApron: 190_000_000,
        bae: 4_700_000,
        roomMLE: 8_000_000,
        fullMLE: 12_900_000,
        taxpayerMLE: 5_000_000,
        confirmed: true,
      },
    });

    expect(rules._meta?.sourcesSummary).toBe('real');
    expect(rules._meta?.sourcesMixed).toBe(false);
    expect(rules._meta?.provenance.capSettingsTag).toBe('real');
    expect(rules._meta?.provenance.rookieMinResolver).toBe('legacyThreshold');
    expect(rules.salaries.rookieMinSource).toBe('real');
  });

  it('keeps projection-chain provenance explicit for mixed-source future years', () => {
    const rules = getCapRulesForYear(2026, {
      '2025-26': {
        cap: 154_647_000,
        tax: 187_895_000,
        firstApron: 195_945_000,
        secondApron: 207_824_000,
        bae: 5_135_000,
        roomMLE: 8_781_000,
        fullMLE: 14_104_000,
        taxpayerMLE: 5_685_000,
        confirmed: true,
      },
    });

    expect(rules._meta?.provenance.rookieMinResolver).toBe(
      'previousYearCapGrowth'
    );
    expect(rules._meta?.provenance.rookieMinBaseSeasonKey).toBe('2024-25');
    expect(rules._meta?.sources.salaries.rookieMin).toBe('projected');
  });
});

describe('MYCT Step 2 Guardrails - Canonical Totals and Future-Year Truth', () => {
  function createMultiYearTeam() {
    return {
      players: [
        {
          playerId: 'player-a',
          contract: {
            contractType: 'Standard',
            salariesByYear: [
              { season: '2024-25', salary: 10_000_000, capHit: 10_000_000 },
              { season: '2025-26', salary: 12_000_000, capHit: 12_000_000 },
            ],
          },
        },
        {
          playerId: 'player-b',
          contract: {
            contractType: 'Standard',
            salariesByYear: [
              { season: '2024-25', salary: 8_000_000, capHit: 8_000_000 },
              { season: '2025-26', salary: 9_000_000, capHit: 9_000_000 },
            ],
          },
        },
      ],
      capHolds: [
        {
          playerId: 'hold-2025',
          playerName: '2024-25 Hold',
          amount: 3_000_000,
          season: '2024-25',
          type: 'Bird Rights',
          active: true,
          isSigned: false,
        },
        {
          playerId: 'hold-2026',
          playerName: '2025-26 Hold',
          amount: 4_500_000,
          season: '2025-26',
          type: 'Bird Rights',
          active: true,
          isSigned: false,
        },
      ],
      deadCap: [
        {
          playerId: 'dead-cap-1',
          amountByYear: [
            { season: '2024-25', amount: 2_000_000 },
            { season: '2025-26', amount: 5_000_000 },
          ],
        },
      ],
      totals: {
        totalCapAllocations: 1,
        teamSalary: 1,
        totalSalary: 1,
        currentCapHit: 1,
        capSpace: -999,
        hardCapRoom: 321,
        hardCapReason: 'stale stored hard cap reason',
      },
    };
  }

  it('keeps dead-money resolution canonical-first and only falls back when canonical coverage is absent', () => {
    const explicitZeroTeam = {
      deadCap: [
        {
          playerId: 'canonical-zero',
          amountByYear: [{ season: '2025-26', amount: 0 }],
        },
      ],
      waivedContracts: [{ deadMoneyByYear: { 2026: 5_000_000 } }],
      stretchHistory: [{ amountByYear: { 2026: 2_000_000 } }],
      deadMoney: { 2026: 1_000_000 },
    };
    const fallbackTeam = {
      deadCap: [
        {
          playerId: 'other-year-only',
          amountByYear: [{ season: '2024-25', amount: 3_000_000 }],
        },
      ],
      waivedContracts: [{ deadMoneyByYear: { 2026: 5_000_000 } }],
      stretchHistory: [{ amountByYear: { 2026: 2_000_000 } }],
      deadMoney: { 2026: 1_000_000 },
    };

    expect(computeDeadMoneyForYear(explicitZeroTeam, 2026)).toBe(0);
    expect(computeDeadMoneyForYear(fallbackTeam, 2026)).toBe(8_000_000);
  });

  it('keys totals to selected end year for players, cap holds, dead money, and incomplete charges', () => {
    const team = createMultiYearTeam();
    const totals2025 = computeTeamCapTotals(team, 2025);
    const totals2026 = computeTeamCapTotals(team, 2026);
    const rules2025 = getCapRulesForYear(2025);
    const rules2026 = getCapRulesForYear(2026);

    expect(totals2025.playersTotal).toBe(18_000_000);
    expect(totals2026.playersTotal).toBe(21_000_000);

    expect(totals2025.capHoldsTotal).toBe(3_000_000);
    expect(totals2026.capHoldsTotal).toBe(4_500_000);

    expect(totals2025.deadMoneyTotal).toBe(2_000_000);
    expect(totals2026.deadMoneyTotal).toBe(5_000_000);

    expect(totals2025._meta.seasonKey).toBe('2024-25');
    expect(totals2026._meta.seasonKey).toBe('2025-26');
    expect(totals2025._meta.incompleteRosterCharge?.chargePerSlot).toBe(
      rules2025.salaries.rookieMin
    );
    expect(totals2026._meta.incompleteRosterCharge?.chargePerSlot).toBe(
      rules2026.salaries.rookieMin
    );
    expect(totals2025._meta.incompleteRosterCharge?.chargePerSlot).not.toBe(
      totals2026._meta.incompleteRosterCharge?.chargePerSlot
    );
  });

  it('snapshot helpers keep consuming canonical totals and overwrite stale stored totals', () => {
    const team = createMultiYearTeam();
    const canonicalTotals = computeTeamCapTotals(team, 2026);
    const snapshot = createCanonicalTeamTotalsSnapshot(team, 2026);
    const synchronized = synchronizeTeamTotalsSnapshot(team, 2026);

    expect(snapshot.totalCapAllocations).toBe(canonicalTotals.totalCapAllocations);
    expect(snapshot.teamSalary).toBe(canonicalTotals.totalCapAllocations);
    expect(snapshot.currentCapHit).toBe(canonicalTotals.totalCapAllocations);
    expect(snapshot.capSpace).toBe(
      canonicalTotals.salaryCap - canonicalTotals.totalCapAllocations
    );
    expect(snapshot.totalCapAllocations).not.toBe(1);
    expect(snapshot.hardCapReason).toBe('stale stored hard cap reason');

    expect(synchronized?.totals).toBeDefined();
    expect(synchronized?.totals.totalCapAllocations).toBe(
      canonicalTotals.totalCapAllocations
    );
    expect(synchronized?.totals.teamSalary).toBe(
      canonicalTotals.totalCapAllocations
    );
    expect(synchronized?.totals.capSpace).toBe(
      canonicalTotals.salaryCap - canonicalTotals.totalCapAllocations
    );
  });
});
