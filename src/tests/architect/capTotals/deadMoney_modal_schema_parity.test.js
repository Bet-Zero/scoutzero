/**
 * FILE: src/tests/architect/capTotals/deadMoney_modal_schema_parity.test.js
 * PURPOSE: Guardrails for ManageDeadMoneyModal schema parity with DeadCapItemZ
 *          (CAP_SHEET_E2E_SSOT_PARITY_E1)
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2026-02-28: CAP_SHEET_E2E_SSOT_PARITY_E1 - Created
 *
 * TESTS:
 * 1. Modal output uses canonical array shape for amountByYear
 * 2. computeTeamCapTotals correctly reads modal-written dead money
 * 3. Legacy object-map shape still handled by compute function (backward compat)
 * 4. Modal read path: canonical array shape is correctly parsed
 * 5. Modal read path: legacy object-map shape is correctly parsed
 * 6. Modal output only contains DEAD_CAP_ITEM_ALLOWLIST fields
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { DEAD_CAP_ITEM_ALLOWLIST } from '@/features/architect/utils/persistenceContracts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODAL_PATH = path.resolve(
  __dirname,
  '../../../features/architect/capSheet/modals/ManageDeadMoneyModal.tsx'
);

const YEAR = 2026; // 2025-26 season

// Helper: create full roster to avoid incomplete roster charge noise
function createFullRoster() {
  return Array.from({ length: 14 }, (_, i) => ({
    player_id: `roster-player-${i}`,
    displayName: `Roster Player ${i}`,
    contract: {
      contractType: 'Standard',
      salariesByYear: [],
    },
  }));
}

// Simulate what the modal's handleSave now produces (canonical shape)
function simulateModalOutput(entries) {
  const groups = new Map();

  entries.forEach((entry, index) => {
    const groupKey = entry.sourceGroupKey || `manual-row-${index}`;
    const groupedEntries = groups.get(groupKey) || [];
    groupedEntries.push(entry);
    groups.set(groupKey, groupedEntries);
  });

  return Array.from(groups.values()).map((groupedEntries) => {
    const first = groupedEntries[0];

    return {
      playerId: first.playerId || `manual_${Date.now()}`,
      playerName: first.label,
      amountByYear: groupedEntries.map((e) => ({
        season: e.seasonKey,
        amount: Number(e.amount),
        isStretched: !!e.stretched,
      })),
      notes: first.notes || 'Manual Adjustment',
    };
  });
}

describe('ManageDeadMoneyModal Schema Parity — Canonical Shape', () => {
  it('TEST 1: Modal output uses canonical array shape for amountByYear', () => {
    const entries = [
      {
        playerId: 'p1',
        label: 'Waived Player',
        seasonKey: '2025-26',
        amount: 5000000,
        stretched: false,
      },
    ];

    const result = simulateModalOutput(entries);

    expect(result).toHaveLength(1);
    expect(Array.isArray(result[0].amountByYear)).toBe(true);
    expect(result[0].amountByYear[0]).toEqual({
      season: '2025-26',
      amount: 5000000,
      isStretched: false,
    });
  });

  it('TEST 2: computeTeamCapTotals correctly reads modal-written dead money', () => {
    const modalOutput = simulateModalOutput([
      {
        playerId: 'p1',
        label: 'Waived Player',
        seasonKey: '2025-26',
        amount: 4_000_000,
        stretched: true,
      },
    ]);

    const team = {
      deadCap: modalOutput,
      players: createFullRoster(),
      capHolds: [],
    };

    const totals = computeTeamCapTotals(team, YEAR);
    expect(totals.deadMoneyTotal).toBe(4_000_000);
    expect(totals.totalCapAllocations).toBe(4_000_000);
  });

  it('TEST 3: Legacy object-map shape still handled by compute function', () => {
    // This tests backward compat for any existing Firestore data in old shape
    const team = {
      waivedContracts: [
        {
          playerId: 'legacy-1',
          amountByYear: { 2026: 2_000_000 },
        },
      ],
      players: createFullRoster(),
      capHolds: [],
    };

    const totals = computeTeamCapTotals(team, YEAR);
    expect(totals.deadMoneyTotal).toBe(2_000_000);
  });

  it('TEST 4: Modal source reads canonical array shape', () => {
    const source = fs.readFileSync(MODAL_PATH, 'utf-8');
    // Should check for Array.isArray(entry.amountByYear) to handle canonical shape
    expect(source).toMatch(/Array\.isArray\(entry\.amountByYear\)/);
  });

  it('TEST 5: Modal source reads legacy object-map shape as fallback', () => {
    const source = fs.readFileSync(MODAL_PATH, 'utf-8');
    // Should have Object.entries fallback for legacy data
    expect(source).toMatch(/Object\.entries\(entry\.amountByYear\)/);
  });

  it('TEST 6: Modal output only contains DEAD_CAP_ITEM_ALLOWLIST fields', () => {
    const allowlist = new Set(DEAD_CAP_ITEM_ALLOWLIST);

    const modalOutput = simulateModalOutput([
      {
        playerId: 'p1',
        label: 'Test',
        seasonKey: '2025-26',
        amount: 1000,
        stretched: false,
      },
    ]);

    for (const entry of modalOutput) {
      const keys = Object.keys(entry);
      for (const key of keys) {
        expect(
          allowlist.has(key),
          `Key "${key}" is NOT in DEAD_CAP_ITEM_ALLOWLIST: [${[...allowlist].join(', ')}]`
        ).toBe(true);
      }
    }
  });

  it('TEST 7: Source-grouped modal rows preserve one multi-season canonical entry', () => {
    const modalOutput = simulateModalOutput([
      {
        playerId: 'p1',
        label: 'Stretched Buyout',
        seasonKey: '2025-26',
        amount: 3_000_000,
        stretched: true,
        sourceGroupKey: 'dead-cap-source-1',
        notes: 'Original grouped ledger',
      },
      {
        playerId: 'p1',
        label: 'Stretched Buyout',
        seasonKey: '2026-27',
        amount: 3_000_000,
        stretched: true,
        sourceGroupKey: 'dead-cap-source-1',
        notes: 'Original grouped ledger',
      },
    ]);

    expect(modalOutput).toHaveLength(1);
    expect(modalOutput[0]).toEqual({
      playerId: 'p1',
      playerName: 'Stretched Buyout',
      amountByYear: [
        { season: '2025-26', amount: 3_000_000, isStretched: true },
        { season: '2026-27', amount: 3_000_000, isStretched: true },
      ],
      notes: 'Original grouped ledger',
    });
  });

  it('TEST 8: Multiple manual modal entries for same player produce correct totals without accidental grouping', () => {
    // User creates 2 entries for same player across different years
    const modalOutput = simulateModalOutput([
      {
        playerId: 'p1',
        label: 'Stretched Buyout',
        seasonKey: '2025-26',
        amount: 3_000_000,
        stretched: true,
      },
      {
        playerId: 'p1',
        label: 'Stretched Buyout',
        seasonKey: '2026-27',
        amount: 3_000_000,
        stretched: true,
      },
    ]);

    const team = {
      deadCap: modalOutput,
      players: createFullRoster(),
      capHolds: [],
    };

    // For 2025-26, only the first entry applies
    const totals2026 = computeTeamCapTotals(team, 2026);
    expect(totals2026.deadMoneyTotal).toBe(3_000_000);

    // For 2026-27, only the second entry applies
    const totals2027 = computeTeamCapTotals(team, 2027);
    expect(totals2027.deadMoneyTotal).toBe(3_000_000);
  });
});

// =============================================================================
// Phase E1.1: Legacy deadCap object-map normalization
// =============================================================================
describe('Legacy deadCap object-map normalization (E1.1)', () => {
  it('TEST 9: deadCap with object-map { year: amount } counts toward totals', () => {
    // Pre-fix ManageDeadMoneyModal wrote amountByYear as { "2026": 5000000 }
    const team = {
      deadCap: [
        {
          playerId: 'legacy-obj-flat',
          playerName: 'Legacy Flat',
          amountByYear: { 2026: 5_000_000 },
        },
      ],
      players: createFullRoster(),
      capHolds: [],
    };

    const totals = computeTeamCapTotals(team, 2026);
    expect(totals.deadMoneyTotal).toBe(5_000_000);
    expect(totals.totalCapAllocations).toBe(5_000_000);
  });

  it('TEST 10: deadCap with object-map { year: { amount } } counts toward totals', () => {
    // Another legacy variant: { "2026": { amount: 3000000 } }
    const team = {
      deadCap: [
        {
          playerId: 'legacy-obj-nested',
          playerName: 'Legacy Nested',
          amountByYear: { 2026: { amount: 3_000_000 } },
        },
      ],
      players: createFullRoster(),
      capHolds: [],
    };

    const totals = computeTeamCapTotals(team, 2026);
    expect(totals.deadMoneyTotal).toBe(3_000_000);
  });

  it('TEST 11: deadCap with string year key in object-map counts toward totals', () => {
    // String key variant: { "2025-26": 2000000 }
    const team = {
      deadCap: [
        {
          playerId: 'legacy-string-key',
          playerName: 'Legacy String',
          amountByYear: { '2025-26': 2_000_000 },
        },
      ],
      players: createFullRoster(),
      capHolds: [],
    };

    const totals = computeTeamCapTotals(team, 2026);
    expect(totals.deadMoneyTotal).toBe(2_000_000);
  });

  it('TEST 12: mixed canonical + legacy deadCap items both count', () => {
    const team = {
      deadCap: [
        {
          playerId: 'canonical-item',
          playerName: 'Canonical',
          amountByYear: [
            { season: '2025-26', amount: 1_000_000, isStretched: false },
          ],
        },
        {
          playerId: 'legacy-item',
          playerName: 'Legacy',
          amountByYear: { 2026: 2_000_000 },
        },
      ],
      players: createFullRoster(),
      capHolds: [],
    };

    const totals = computeTeamCapTotals(team, 2026);
    expect(totals.deadMoneyTotal).toBe(3_000_000);
  });
});
