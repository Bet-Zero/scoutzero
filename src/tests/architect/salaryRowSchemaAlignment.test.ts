/**
 * FILE: src/tests/architect/salaryRowSchemaAlignment.test.ts
 * PURPOSE: Behavioral proofs for the salary-row schema alignment pass.
 *   Covers the NormalizedMutationSalaryRow introduction and the alignment of
 *   SalaryByYear → NormalizedMutationSalaryRow in useArchitectActions.ts.
 *
 *   Key mismatch resolved:
 *   - ArchitectMutationSalaryRow.season?: string | null  (optional)
 *   - NormalizedMutationSalaryRow.season: string         (required)
 *   - ArchitectMutationSalaryRow.salary?: number | string | null  (accepts string)
 *   - NormalizedMutationSalaryRow.salary?: number | null          (number only)
 *
 * HISTORY:
 *   2026-03-24  Salary-Row Schema Alignment Pass
 */

import { describe, expect, it } from 'vitest';
import type {
  ArchitectMutationSalaryRow,
  NormalizedMutationSalaryRow,
  ArchitectMutationOfferSheet,
} from '@/features/architect/utils/mutationPipeline';
import { ensureContractStructure } from '@/features/architect/GMDashboard/hooks/useArchitectActions';

// ============================================================================
// Boundary 1: NormalizedMutationSalaryRow structural contract
//
// SalaryByYear (in useArchitectActions) is now a type alias for
// NormalizedMutationSalaryRow. These tests confirm the shape at runtime.
// ============================================================================

describe('NormalizedMutationSalaryRow structural contract', () => {
  it('accepts a fully-populated normalized row with required season string', () => {
    const row: NormalizedMutationSalaryRow = {
      season: '2025-26',
      salary: 12_000_000,
      capHit: 12_000_000,
      guaranteed: true,
      option: null,
      optionType: null,
      optionUsed: null,
      isExtensionSeason: null,
      // guaranteedAmount absent — optional field
    };
    expect(row.season).toBe('2025-26');
    expect(row.salary).toBe(12_000_000);
    expect(typeof row.salary).toBe('number');
  });

  it('accepts a row with guaranteedAmount (extra field absent from SalaryByYear predecessor)', () => {
    const row: NormalizedMutationSalaryRow = {
      season: '2025-26',
      salary: 15_000_000,
      capHit: 15_000_000,
      guaranteed: true,
      guaranteedAmount: 15_000_000,
      option: null,
    };
    expect(row.guaranteedAmount).toBe(15_000_000);
    expect(typeof row.guaranteedAmount).toBe('number');
  });
});

// ============================================================================
// Boundary 2: ensureContractStructure produces NormalizedMutationSalaryRow-
//             compatible output via the legacy salaries[] path
//
// ensureContractStructure coerces legacy salary arrays (number|string entries)
// into canonical salariesByYear[] rows. The result must have:
//   - season: string  (not null/undefined)
//   - salary: number  (not string)
// ============================================================================

describe('ensureContractStructure — legacy salaries[] → normalized rows', () => {
  it('produces string season and number salary from numeric salary entries', () => {
    const contract = ensureContractStructure(
      { salaries: [10_000_000, 11_000_000], years: 2, startYear: 2026 },
      {}
    );
    expect(contract).not.toBeNull();
    const rows = contract!.salariesByYear!;
    expect(rows).toHaveLength(2);
    expect(typeof rows[0].season).toBe('string');
    expect(rows[0].season).toBe('2025-26');
    expect(typeof rows[0].salary).toBe('number');
    expect(rows[0].salary).toBe(10_000_000);
    expect(typeof rows[1].salary).toBe('number');
    expect(rows[1].salary).toBe(11_000_000);
  });

  it('coerces string salary entries to numbers in the legacy path', () => {
    const contract = ensureContractStructure(
      { salaries: ['11500000' as unknown as number], years: 1, startYear: 2026 },
      {}
    );
    expect(contract).not.toBeNull();
    const rows = contract!.salariesByYear!;
    expect(rows).toHaveLength(1);
    expect(typeof rows[0].salary).toBe('number');
    expect(rows[0].salary).toBe(11_500_000);
    // season is a required string, never null/undefined
    expect(typeof rows[0].season).toBe('string');
    expect(rows[0].season.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Boundary 3: ensureContractStructure pass-through of existing salariesByYear
//
// When a contract already has salariesByYear, ensureContractStructure passes
// them through. The rows must satisfy NormalizedMutationSalaryRow's contract.
// ============================================================================

describe('ensureContractStructure — salariesByYear pass-through', () => {
  it('passes through an existing NormalizedMutationSalaryRow array unchanged', () => {
    const inputRow: NormalizedMutationSalaryRow = {
      season: '2025-26',
      salary: 8_000_000,
      capHit: 8_000_000,
      guaranteed: true,
      option: null,
    };
    const contract = ensureContractStructure({ salariesByYear: [inputRow] }, {});
    expect(contract).not.toBeNull();
    expect(contract!.salariesByYear).toHaveLength(1);
    expect(contract!.salariesByYear![0].season).toBe('2025-26');
    expect(contract!.salariesByYear![0].salary).toBe(8_000_000);
  });
});

// ============================================================================
// Boundary 4: ArchitectMutationSalaryRow raw/normalized distinction
//
// ArchitectMutationSalaryRow is intentionally wider than NormalizedMutationSalaryRow.
// It accepts string salary and optional season — documenting the raw input boundary.
// ============================================================================

describe('ArchitectMutationSalaryRow — raw input boundary is intentionally wider', () => {
  it('accepts string salary (raw UI form data)', () => {
    const rawRow: ArchitectMutationSalaryRow = {
      season: '2025-26',
      salary: '10000000',   // string — valid in raw form, must be normalized before pipeline
      capHit: '10000000',
      guaranteed: true,
    };
    // The raw row has a string salary — valid per ArchitectMutationSalaryRow type
    expect(typeof rawRow.salary).toBe('string');
    expect(rawRow.salary).toBe('10000000');
  });

  it('accepts absent season (raw input boundary allows optional season)', () => {
    const rawRow: ArchitectMutationSalaryRow = {
      salary: 5_000_000,
      guaranteed: true,
      // season absent — valid in raw form; normalization/ensureContractStructure fills it in
    };
    expect(rawRow.season).toBeUndefined();
  });
});

// ============================================================================
// Boundary 5: ArchitectMutationOfferSheet accepts NormalizedMutationSalaryRow entries
//
// ArchitectMutationOfferSheet.salariesByYear was updated from ArchitectMutationSalaryRow[]
// to NormalizedMutationSalaryRow[]. Verify the type accepts normalized rows.
// ============================================================================

describe('ArchitectMutationOfferSheet — normalized salary rows', () => {
  it('accepts NormalizedMutationSalaryRow entries', () => {
    const offerSheet: ArchitectMutationOfferSheet = {
      playerId: 'player_1',
      salariesByYear: [
        { season: '2025-26', salary: 5_000_000, capHit: 5_000_000, guaranteed: true, option: null },
        { season: '2026-27', salary: 5_500_000, capHit: 5_500_000, guaranteed: true, option: null },
      ],
      contractYears: 2,
      status: 'PENDING_MATCH',
    };
    expect(offerSheet.salariesByYear).toHaveLength(2);
    expect(offerSheet.salariesByYear![0].season).toBe('2025-26');
    expect(typeof offerSheet.salariesByYear![0].salary).toBe('number');
  });
});
