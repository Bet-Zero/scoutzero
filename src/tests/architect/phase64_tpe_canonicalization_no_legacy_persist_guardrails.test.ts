/**
 * FILE: src/tests/architect/phase64_tpe_canonicalization_no_legacy_persist_guardrails.test.js
 * PURPOSE: Phase 64 guardrail tests ensuring TPE schema canonicalization works correctly.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-01-30: Phase 64 - Created for TPE schema canonicalization guardrails
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Contracts Doc: docs/architect/contracts/PERSISTENCE_CONTRACTS.md
 *  - Phase 64 Return: docs/architect/return_packages/PHASE_64_TPE_CANONICALIZATION_NO_LEGACY_PERSIST_GUARDRAILS_EXECUTION_RETURN_PACKAGE.md
 *
 * TEST CATEGORIES:
 * 1) Unit: normalizeTeamTpeSchema() merges legacy → canonical and deletes tradeExceptions
 * 2) Unit: Deduplication is deterministic
 * 3) Source-scan: persistWorldMutation() applies normalization BEFORE assertPersistableOrThrow()
 * 4) Source-scan: TEAM write path cannot include 'tradeExceptions' (non-comment code)
 * 5) Contract guardrail: TEAM allowlist does NOT include 'tradeExceptions'
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Import normalization helpers
import {
  normalizeTeamTpeSchema,
  getTeamTpeList,
  getTpeIdentityKey,
} from '@/features/architect/utils/persistenceContracts/normalizeTeamTpe';

// Import contracts for guardrail tests
import {
  TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
  TEAM_DEEP_RULES,
} from '@/features/architect/utils/persistenceContracts/contracts';

type TestTpe = {
  id?: string;
  [key: string]: unknown;
};

type TestTeamWithExceptions = {
  teamCode: string;
  tradeExceptions?: TestTpe[];
  exceptions?: {
    tpe?: TestTpe[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

// Helper to read source files
function readSourceFile(relativePath: string): string {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

// ==============================================================================
// TEST CATEGORY 1: normalizeTeamTpeSchema() behavior
// ==============================================================================
describe('Phase 64: normalizeTeamTpeSchema() unit tests', () => {
  it('returns null/undefined unchanged', () => {
    expect(normalizeTeamTpeSchema(null)).toBe(null);
    expect(normalizeTeamTpeSchema(undefined)).toBe(undefined);
  });

  it('returns team unchanged when no TPE data exists anywhere', () => {
    const team = { teamCode: 'BOS', roster: [] };
    const result = normalizeTeamTpeSchema(team);
    expect(result).toEqual(team);
    expect(result).not.toBe(team); // Should be a new object (not shallow equal)
  });

  it('merges legacy tradeExceptions into exceptions.tpe', () => {
    const legacyTPE = {
      id: 'tpe_1',
      totalAmount: 5000000,
      remainingAmount: 5000000,
      createdFrom: 'Trade with LAL',
    };
    const team: TestTeamWithExceptions = {
      teamCode: 'BOS',
      tradeExceptions: [legacyTPE],
    };

    const result = normalizeTeamTpeSchema(team);

    // Legacy field should be removed
    expect(result.tradeExceptions).toBeUndefined();
    expect('tradeExceptions' in result).toBe(false);

    // TPE should be in canonical location
    const canonicalTpes = result.exceptions?.tpe ?? [];
    expect(result.exceptions).toBeDefined();
    expect(canonicalTpes).toHaveLength(1);
    expect(canonicalTpes[0].id).toBe('tpe_1');
  });

  it('removes empty tradeExceptions array (legacy cleanup)', () => {
    const team: TestTeamWithExceptions = {
      teamCode: 'BOS',
      tradeExceptions: [],
      exceptions: { mle: null },
    };

    const result = normalizeTeamTpeSchema(team);

    // Legacy field should be removed even if empty
    expect(result.tradeExceptions).toBeUndefined();
    expect('tradeExceptions' in result).toBe(false);

    // exceptions.tpe should exist and be empty
    expect(result.exceptions?.tpe).toEqual([]);
  });

  it('preserves existing exceptions.tpe when no legacy data', () => {
    const canonicalTPE = {
      id: 'tpe_canonical',
      totalAmount: 3000000,
      remainingAmount: 3000000,
    };
    const team = {
      teamCode: 'LAL',
      exceptions: { tpe: [canonicalTPE], mle: 5000000 },
    };

    const result = normalizeTeamTpeSchema(team);

    expect(result.exceptions.tpe).toHaveLength(1);
    expect(result.exceptions.tpe[0].id).toBe('tpe_canonical');
    expect(result.exceptions.mle).toBe(5000000);
  });

  it('does not mutate the original team object (pure function)', () => {
    const legacyTPE = { id: 'tpe_legacy', totalAmount: 1000000 };
    const team = {
      teamCode: 'BOS',
      tradeExceptions: [legacyTPE],
    };

    const original = JSON.parse(JSON.stringify(team));
    normalizeTeamTpeSchema(team);

    // Original should be unchanged
    expect(team).toEqual(original);
  });
});

// ==============================================================================
// TEST CATEGORY 2: Deduplication behavior
// ==============================================================================
describe('Phase 64: TPE deduplication tests', () => {
  it('deduplicates by id when same TPE exists in both locations', () => {
    const legacyTPE = {
      id: 'tpe_dupe',
      totalAmount: 5000000,
      remainingAmount: 4000000, // Older remaining
      createdFrom: 'Legacy source',
    };
    const canonicalTPE = {
      id: 'tpe_dupe',
      totalAmount: 5000000,
      remainingAmount: 3000000, // Newer remaining (canonical wins)
      createdFrom: 'Canonical source',
    };
    const team = {
      teamCode: 'BOS',
      tradeExceptions: [legacyTPE],
      exceptions: { tpe: [canonicalTPE] },
    };

    const result = normalizeTeamTpeSchema(team);

    // Should only have one TPE
    expect(result.exceptions.tpe).toHaveLength(1);
    // Canonical should win
    expect(result.exceptions.tpe[0].createdFrom).toBe('Canonical source');
    expect(result.exceptions.tpe[0].remainingAmount).toBe(3000000);
  });

  it('merges unique TPEs from both sources', () => {
    const legacyTPE = { id: 'tpe_a', totalAmount: 1000000 };
    const canonicalTPE = { id: 'tpe_b', totalAmount: 2000000 };
    const team = {
      teamCode: 'BOS',
      tradeExceptions: [legacyTPE],
      exceptions: { tpe: [canonicalTPE] },
    };

    const result = normalizeTeamTpeSchema(team);

    expect(result.exceptions.tpe).toHaveLength(2);
    const ids = result.exceptions.tpe.map((t) => t.id).sort();
    expect(ids).toEqual(['tpe_a', 'tpe_b']);
  });

  it('produces deterministic order for merged TPEs', () => {
    const tpe1 = { id: 'tpe_z', totalAmount: 1000000 };
    const tpe2 = { id: 'tpe_a', totalAmount: 2000000 };
    const tpe3 = { id: 'tpe_m', totalAmount: 3000000 };

    const team = {
      teamCode: 'BOS',
      tradeExceptions: [tpe1, tpe3],
      exceptions: { tpe: [tpe2] },
    };

    // Run multiple times
    const results = [];
    for (let i = 0; i < 3; i++) {
      const result = normalizeTeamTpeSchema(team);
      results.push(result.exceptions.tpe.map((t) => t.id));
    }

    // All results should be identical (deterministic)
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
  });

  it('handles TPEs without id using signature-based dedup', () => {
    // Edge case: TPE without id field (legacy edge case)
    const tpe1 = { totalAmount: 5000000, createdFrom: 'Trade with LAL' };
    const tpe2 = { totalAmount: 5000000, createdFrom: 'Trade with LAL' }; // Same signature
    const tpe3 = { totalAmount: 3000000, createdFrom: 'Trade with MIA' }; // Different

    const team = {
      teamCode: 'BOS',
      tradeExceptions: [tpe1, tpe3],
      exceptions: { tpe: [tpe2] },
    };

    const result = normalizeTeamTpeSchema(team);

    // Should dedupe the two identical no-id TPEs
    expect(result.exceptions.tpe.length).toBeLessThanOrEqual(2);
  });
});

// ==============================================================================
// TEST CATEGORY 3: getTeamTpeList() read helper
// ==============================================================================
describe('Phase 64: getTeamTpeList() read helper', () => {
  it('returns exceptions.tpe when available', () => {
    const canonicalTPE = { id: 'tpe_1', totalAmount: 5000000 };
    const team = {
      teamCode: 'BOS',
      exceptions: { tpe: [canonicalTPE] },
    };

    const result = getTeamTpeList(team);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('tpe_1');
  });

  it('falls back to tradeExceptions for legacy worlds', () => {
    const legacyTPE = { id: 'tpe_legacy', totalAmount: 3000000 };
    const team = {
      teamCode: 'BOS',
      tradeExceptions: [legacyTPE],
      // No exceptions.tpe
    };

    const result = getTeamTpeList(team);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('tpe_legacy');
  });

  it('prefers exceptions.tpe even when both exist', () => {
    const legacyTPE = { id: 'tpe_legacy', totalAmount: 1000000 };
    const canonicalTPE = { id: 'tpe_canonical', totalAmount: 5000000 };
    const team = {
      teamCode: 'BOS',
      tradeExceptions: [legacyTPE],
      exceptions: { tpe: [canonicalTPE] },
    };

    const result = getTeamTpeList(team);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('tpe_canonical');
  });

  it('returns empty array for null/undefined team', () => {
    expect(getTeamTpeList(null)).toEqual([]);
    expect(getTeamTpeList(undefined)).toEqual([]);
  });

  it('returns empty array when no TPE data exists', () => {
    const team = { teamCode: 'BOS', roster: [] };
    expect(getTeamTpeList(team)).toEqual([]);
  });
});

// ==============================================================================
// TEST CATEGORY 4: Source-scan guardrails
// ==============================================================================
describe('Phase 64: Source-scan guardrails for mutation pipeline', () => {
  it('committed team snapshots normalize TPEs before persistWorldMutation validation', () => {
    // Stage 6B: prepareGeneralMutationPersistenceTeamSnapshot and the
    // surrounding committed-team snapshot helpers were extracted into
    // mutationPipeline.read.persistence.snapshots.ts; include it in the
    // source bundle so the ordering invariants remain checkable.
    const source =
      readSourceFile('src/features/architect/utils/mutationPipeline.ts') +
      readSourceFile('src/features/architect/utils/mutationPipeline.persist.ts') +
      readSourceFile('src/features/architect/utils/mutationPipeline.validate.ts') +
      readSourceFile('src/features/architect/utils/mutationPipeline.read.ts') +
      readSourceFile('src/features/architect/utils/mutationPipeline.read.persistence.ts') +
      readSourceFile('src/features/architect/utils/mutationPipeline.read.persistence.snapshots.ts');

    const prepareStart = source.indexOf(
      'function prepareGeneralMutationPersistenceTeamSnapshot'
    );
    const prepareEnd = source.indexOf(
      'function buildGeneralMutationCommittedTeamSnapshot'
    );
    const prepareSection = source.slice(prepareStart, prepareEnd);

    expect(prepareSection).toContain(
      'const afterTpeNormalize = normalizeTeamTpeSchema(afterSanitize);'
    );
    expect(
      prepareSection.indexOf('sanitizeTransientFieldsForPersistence(')
    ).toBeLessThan(prepareSection.indexOf('normalizeTeamTpeSchema(afterSanitize)'));

    const builderStart = source.indexOf(
      'function buildGeneralMutationCommittedTeamUpdates'
    );
    const builderEnd = source.indexOf(
      'function normalizeDashboardReloadDeadCapAmountByYear'
    );
    const builderSection = source.slice(builderStart, builderEnd);

    expect(builderSection).toContain(
      'buildGeneralMutationCommittedTeamSnapshot(update.team, seasonId, asOfDate)'
    );

    const persistStart = source.indexOf('async function persistWorldMutation');
    const persistEnd = source.indexOf('// 2. Write player overrides');
    const persistSection = source.slice(persistStart, persistEnd);

    expect(persistSection).toContain('const teamUpdates = committedTeamUpdates || [];');
    expect(persistSection).toContain('assertPersistableOrThrow({');
    expect(persistSection).toContain('obj: persistenceReadyTeam');
  });

  it('the normalized helper output is what team validation consumes', () => {
    // Stage 6B: prepareGeneralMutationPersistenceTeamSnapshot and the
    // surrounding committed-team snapshot helpers were extracted into
    // mutationPipeline.read.persistence.snapshots.ts; include it in the
    // source bundle so the ordering invariants remain checkable.
    const source =
      readSourceFile('src/features/architect/utils/mutationPipeline.ts') +
      readSourceFile('src/features/architect/utils/mutationPipeline.persist.ts') +
      readSourceFile('src/features/architect/utils/mutationPipeline.validate.ts') +
      readSourceFile('src/features/architect/utils/mutationPipeline.read.ts') +
      readSourceFile('src/features/architect/utils/mutationPipeline.read.persistence.ts') +
      readSourceFile('src/features/architect/utils/mutationPipeline.read.persistence.snapshots.ts');

    expect(source).toContain(
      'const afterTpeNormalize = normalizeTeamTpeSchema(afterSanitize)'
    );
    expect(source).toContain(
      'return afterTpeNormalize as GeneralMutationPersistenceTeamSnapshot;'
    );
    expect(source).toContain(
      'prepareGeneralMutationPersistenceTeamSnapshot(team, seasonId, asOfDate)'
    );
    expect(source).toContain('obj: persistenceReadyTeam');
  });

  it('normalizeTeamTpeSchema is imported in mutationPipeline', () => {
    // Stage 6B: prepareGeneralMutationPersistenceTeamSnapshot and the
    // surrounding committed-team snapshot helpers were extracted into
    // mutationPipeline.read.persistence.snapshots.ts; include it in the
    // source bundle so the ordering invariants remain checkable.
    const source =
      readSourceFile('src/features/architect/utils/mutationPipeline.ts') +
      readSourceFile('src/features/architect/utils/mutationPipeline.persist.ts') +
      readSourceFile('src/features/architect/utils/mutationPipeline.validate.ts') +
      readSourceFile('src/features/architect/utils/mutationPipeline.read.ts') +
      readSourceFile('src/features/architect/utils/mutationPipeline.read.persistence.ts') +
      readSourceFile('src/features/architect/utils/mutationPipeline.read.persistence.snapshots.ts');

    expect(source).toContain('normalizeTeamTpeSchema');
    expect(source).toContain(
      "from '@/features/architect/utils/persistenceContracts'"
    );
  });
});

// ==============================================================================
// TEST CATEGORY 5: Contract guardrails (no legacy persist)
// ==============================================================================
describe('Phase 64: Contract guardrails (no legacy persist)', () => {
  it('TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST does NOT include "tradeExceptions"', () => {
    expect(TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST).not.toContain('tradeExceptions');
  });

  it('TEAM_DEEP_RULES does NOT include "tradeExceptions" key', () => {
    expect(TEAM_DEEP_RULES.tradeExceptions).toBeUndefined();
    expect('tradeExceptions' in TEAM_DEEP_RULES).toBe(false);
  });

  it('TEAM_DEEP_RULES DOES include "exceptions.tpe" (canonical path)', () => {
    expect(TEAM_DEEP_RULES['exceptions.tpe']).toBeDefined();
  });

  it('exceptions.tpe deep rule uses TRADE_EXCEPTION_ITEM_ALLOWLIST', () => {
    // Verify the allowlist includes expected TPE fields
    const allowlist = TEAM_DEEP_RULES['exceptions.tpe'];
    expect(allowlist).toContain('id');
    expect(allowlist).toContain('totalAmount');
    expect(allowlist).toContain('remainingAmount');
    expect(allowlist).toContain('createdFrom');
    expect(allowlist).toContain('expiresOn');
  });
});

// ==============================================================================
// TEST CATEGORY 6: getTpeIdentityKey() unit tests
// ==============================================================================
describe('Phase 64: getTpeIdentityKey() unit tests', () => {
  it('uses id field when present', () => {
    const tpe = { id: 'tpe_123', totalAmount: 5000000 };
    expect(getTpeIdentityKey(tpe)).toBe('id:tpe_123');
  });

  it('uses signature when id is missing', () => {
    const tpe = { totalAmount: 5000000, createdFrom: 'Trade with LAL' };
    const key = getTpeIdentityKey(tpe);
    expect(key.startsWith('sig:')).toBe(true);
    expect(key).toContain('totalAmount');
    expect(key).toContain('createdFrom');
  });

  it('produces same key for same TPE data', () => {
    const tpe1 = { totalAmount: 5000000, createdFrom: 'Trade with LAL' };
    const tpe2 = { totalAmount: 5000000, createdFrom: 'Trade with LAL' };
    expect(getTpeIdentityKey(tpe1)).toBe(getTpeIdentityKey(tpe2));
  });

  it('produces different keys for different TPE data', () => {
    const tpe1 = { totalAmount: 5000000, createdFrom: 'Trade with LAL' };
    const tpe2 = { totalAmount: 3000000, createdFrom: 'Trade with MIA' };
    expect(getTpeIdentityKey(tpe1)).not.toBe(getTpeIdentityKey(tpe2));
  });
});
