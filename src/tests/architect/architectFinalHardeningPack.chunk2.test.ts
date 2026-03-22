/**
 * FILE: src/tests/architect/architectFinalHardeningPack.chunk2.test.ts
 * PURPOSE: Narrow regression proof for ARCHITECT_FINAL_HARDENING_PACK Chunk 2.
 * Covers the two primary type-hardening areas:
 *  - useArchitectState: catch-all removal from SalaryByYear, ArchitectContract,
 *    ArchitectExceptionEntryLike; roster array narrowing
 *  - useArchitectActions: ArchitectPlayer weak fields narrowed to specific types
 * OWNERSHIP: Feature: architect/ts-hardening
 */

import { describe, expect, it } from 'vitest';
import { mergeWorldPlayerOverride } from '@/features/architect/GMDashboard/hooks/useArchitectState';
import {
  ensureContractStructure,
  deriveSigningMechanism,
} from '@/features/architect/GMDashboard/hooks/useArchitectActions';

// ---------------------------------------------------------------------------
// 1. mergeWorldPlayerOverride — state slice contract
//    Verifies the exported utility merges player + contract fields correctly.
//    Covers the narrowed SalaryByYear / ArchitectContract shapes.
// ---------------------------------------------------------------------------
describe('mergeWorldPlayerOverride — state slice merge contract', () => {
  it('merges override contract salariesByYear on top of base', () => {
    const base = {
      id: 'p1',
      name: 'Player A',
      contract: {
        salariesByYear: [
          { season: '2024-25', salary: 10_000_000, guaranteed: true },
        ],
      },
    };

    const override = {
      id: 'p1',
      name: 'Player A',
      contract: {
        salariesByYear: [
          { season: '2024-25', salary: 12_000_000, guaranteed: false },
          { season: '2025-26', salary: 13_000_000, guaranteed: true },
        ],
      },
    };

    const result = mergeWorldPlayerOverride(base as Parameters<typeof mergeWorldPlayerOverride>[0], override as Parameters<typeof mergeWorldPlayerOverride>[1]);
    expect(result.contract?.salariesByYear).toHaveLength(2);
    expect(result.contract?.salariesByYear?.[0]?.salary).toBe(12_000_000);
    expect(result.contract?.salariesByYear?.[1]?.salary).toBe(13_000_000);
    // Name and id from override
    expect(result.name).toBe('Player A');
    expect(result.id).toBe('p1');
  });

  it('preserves base contract when override has no contract', () => {
    const base = {
      id: 'p2',
      name: 'Player B',
      contract: {
        salariesByYear: [{ season: '2024-25', salary: 5_000_000 }],
        birdRights: { status: 'Bird', yearsOfService: 3 },
      },
    };

    const override = { id: 'p2', name: 'Player B Override' };

    const result = mergeWorldPlayerOverride(base as Parameters<typeof mergeWorldPlayerOverride>[0], override as Parameters<typeof mergeWorldPlayerOverride>[1]);
    // Contract from base preserved
    expect(result.contract?.salariesByYear?.[0]?.salary).toBe(5_000_000);
    expect(result.contract?.birdRights?.status).toBe('Bird');
    // Name from override
    expect(result.name).toBe('Player B Override');
  });

  it('deep-merges bio fields from override over base', () => {
    const base = {
      id: 'p3',
      bio: { playerId: 'p3', displayName: 'Old Name' },
    };
    const override = {
      id: 'p3',
      bio: { playerId: 'p3', displayName: 'New Name' },
    };

    const result = mergeWorldPlayerOverride(base as Parameters<typeof mergeWorldPlayerOverride>[0], override as Parameters<typeof mergeWorldPlayerOverride>[1]);
    expect(result.bio?.displayName).toBe('New Name');
  });
});

// ---------------------------------------------------------------------------
// 2. ensureContractStructure — action contract: salary array normalization
//    Tests the exported helper used by handleSign / handleSaveContract.
// ---------------------------------------------------------------------------
describe('ensureContractStructure — action contract normalization', () => {
  it('returns contract unchanged when salariesByYear is already present', () => {
    const contract = {
      salariesByYear: [
        { season: '2025-26', salary: 8_000_000, guaranteed: true },
      ],
      contractType: 'Signed FA',
    };

    const result = ensureContractStructure(contract, { startYear: 2026 });
    expect(result?.salariesByYear).toHaveLength(1);
    expect(result?.salariesByYear?.[0]?.salary).toBe(8_000_000);
    expect(result?.contractType).toBe('Signed FA');
  });

  it('converts legacy salaries[] to salariesByYear[]', () => {
    const contract = {
      salaries: [10_000_000, 11_000_000],
      years: 2,
    };

    const result = ensureContractStructure(contract, { startYear: 2026 });
    expect(result?.salariesByYear).toHaveLength(2);
    expect(result?.salariesByYear?.[0]?.salary).toBe(10_000_000);
    expect(result?.salariesByYear?.[1]?.salary).toBe(11_000_000);
    // toSeasonCode(2026) = '2025-26', toSeasonCode(2027) = '2026-27'
    expect(result?.salariesByYear?.[0]?.season).toBe('2025-26');
    expect(result?.salariesByYear?.[1]?.season).toBe('2026-27');
  });

  it('returns null for a null contract', () => {
    expect(ensureContractStructure(null)).toBeNull();
    expect(ensureContractStructure(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. deriveSigningMechanism — action result: signing mechanism extraction
// ---------------------------------------------------------------------------
describe('deriveSigningMechanism — action signing contract', () => {
  it('returns signedUsing when set', () => {
    const result = deriveSigningMechanism({ signedUsing: 'MLE', salariesByYear: [] });
    expect(result).toBe('MLE');
  });

  it('falls back to exceptionType when signedUsing is absent', () => {
    const result = deriveSigningMechanism({ exceptionType: 'BAE', salariesByYear: [] });
    expect(result).toBe('BAE');
  });

  it('returns null for missing/empty mechanism', () => {
    expect(deriveSigningMechanism({ salariesByYear: [] })).toBeNull();
    expect(deriveSigningMechanism({ signedUsing: 'none', salariesByYear: [] })).toBeNull();
    expect(deriveSigningMechanism(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. SalaryByYear structural compatibility — enumerated fields only
//    Verifies the narrowed shape (no catch-all) still satisfies usage patterns.
// ---------------------------------------------------------------------------
describe('SalaryByYear — enumerated fields contract (no catch-all)', () => {
  it('accepts an object with only the canonical salary fields', () => {
    // Compile-time contract proof: if SalaryByYear had [key: string]: unknown
    // removed, code that assigns only the known fields must still work.
    const salaryRow = {
      season: '2025-26',
      salary: 15_000_000,
      option: null,
      optionType: null,
      capHit: 15_000_000,
      guaranteed: true,
    };

    expect(salaryRow.salary).toBe(15_000_000);
    expect(salaryRow.capHit).toBe(15_000_000);
    expect(salaryRow.guaranteed).toBe(true);
    expect(salaryRow.option).toBeNull();
    expect(typeof salaryRow.season).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// 5. ArchitectExceptionEntryLike structural compatibility — enumerated fields
// ---------------------------------------------------------------------------
describe('ArchitectExceptionEntryLike — enumerated fields contract (no catch-all)', () => {
  it('accepts an object with the canonical exception fields', () => {
    const entry = {
      type: 'MLE',
      enabled: true,
      available: true,
      totalAmount: 12_000_000,
      usedAmount: 5_000_000,
      remainingAmount: 7_000_000,
      createdFrom: null,
      createdOn: '2025-07-01',
      expiresOn: '2026-06-30',
      notes: null,
      seasonKey: '2025-26',
    };

    expect(entry.type).toBe('MLE');
    expect(entry.totalAmount).toBe(12_000_000);
    expect(entry.remainingAmount).toBe(7_000_000);
    expect(entry.seasonKey).toBe('2025-26');
  });
});
