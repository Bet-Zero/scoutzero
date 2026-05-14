/**
 * FILE: src/tests/architect/capAuditability_closure.gate.test.ts
 * PURPOSE: Permanent regression gates for CAP_AUDITABILITY closure (E6).
 * OWNERSHIP: Feature: architect/core
 *
 * These gates fail CI if cap auditability coverage drifts.
 * Run quickly: npm run test:node -- --run src/tests/architect/capAuditability_closure.gate.test.ts
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  POST_STATE_CAP_VALIDATOR_VERSION,
  validatePostStateCapLegality,
} from '@/features/architect/utils/capLegality/postStateCapValidator';

// === File paths ===
const VALIDATOR_PATH =
  'src/features/architect/utils/capLegality/postStateCapValidator.ts';
const MUTATION_PIPELINE_PATH =
  'src/features/architect/utils/mutationPipeline.ts';
const SEASON_MANAGER_PATH = 'src/features/architect/utils/seasonManager.ts';
const USE_ARCHITECT_ACTIONS_PATH =
  'src/features/architect/GMDashboard/hooks/useArchitectActions.ts';
const USE_ARCHITECT_ACTIONS_HELPERS_PATH =
  'src/features/architect/GMDashboard/hooks/useArchitectActions.helpers.ts';
const LOCAL_CAP_AUDIT_LOG_PATH =
  'src/features/architect/utils/capLegality/localCapAuditLog.ts';
const CAP_AUDIT_DEBUG_PANEL_PATH =
  'src/features/architect/GMDashboard/components/CapAuditDebugPanel.tsx';

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf-8');
}

// === Gate 1: Validator version + rule codes ===
describe('CAP_AUDITABILITY Closure Gate 1: Validator version + rule codes', () => {
  it('maintains POST_STATE_CAP_VALIDATOR_VERSION at 1.0.0', () => {
    expect(POST_STATE_CAP_VALIDATOR_VERSION).toBe('1.0.0');
  });

  it('exports validatePostStateCapLegality function', () => {
    expect(typeof validatePostStateCapLegality).toBe('function');
  });

  it('produces valid/violations/warnings in result shape', () => {
    const result = validatePostStateCapLegality({
      operationId: 'gate_test_op',
      mutationType: 'test',
      worldId: 'gate_test_world',
      year: 2026,
      beforeTeamsByCode: {},
      afterTeamsByCode: {
        LAL: { players: [], deadCap: [], capHolds: [], exceptions: {} },
      },
      beforeTotalsByTeam: {},
      afterTotalsByTeam: {
        LAL: {
          yearKey: 2026,
          playersTotal: 100_000_000,
          deadMoneyTotal: 0,
          capHoldsTotal: 0,
          incompleteChargesTotal: 10_000_000,
          totalCapAllocations: 110_000_000,
          salaryCap: 140_000_000,
          luxuryTax: 170_000_000,
          firstApron: 178_000_000,
          secondApron: 188_000_000,
        },
      },
    });

    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('violations');
    expect(result).toHaveProperty('warnings');
    expect(Array.isArray(result.violations)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('contains all 13 v1.0.0 rule codes in validator source', () => {
    const source = readSource(VALIDATOR_PATH);

    // The 13 canonical v1.0.0 rule codes
    const requiredRuleCodes = [
      'TOTALS_NON_FINITE',
      'TOTALS_YEAR_KEY_MISSING',
      'TOTALS_YEAR_KEY_MISMATCH',
      'TOTALS_MISSING',
      'HARD_CAP_EXCEEDED',
      'SALARY_FLOOR_NOT_MET',
      'LUXURY_TAX_EXCEEDED',
      'ROSTER_MAX_EXCEEDED',
      'TWO_WAY_LIMIT_EXCEEDED',
      'CONTRACT_ROWS_INVALID',
      'DEAD_CAP_INVALID',
      'EXCEPTIONS_INVALID',
      'CAP_HOLD_INVALID',
    ];

    const missingCodes: string[] = [];
    for (const code of requiredRuleCodes) {
      if (!source.includes(`code: '${code}'`)) {
        missingCodes.push(code);
      }
    }

    expect(
      missingCodes,
      `Missing v1.0.0 rule codes in postStateCapValidator.ts: ${missingCodes.join(', ')}`
    ).toHaveLength(0);
  });
});

// === Gate 2: Call-site invocation ===
describe('CAP_AUDITABILITY Closure Gate 2: Call-site invocation', () => {
  it('invokes validatePostStateCapLegality in mutationPipeline.ts (applyWorldMutation)', () => {
    const source = readSource(MUTATION_PIPELINE_PATH);

    expect(
      source,
      'mutationPipeline.ts must import validatePostStateCapLegality'
    ).toContain('validatePostStateCapLegality');

    expect(
      source,
      'mutationPipeline.ts must call validatePostStateCapLegality(...)'
    ).toMatch(/validatePostStateCapLegality\s*\(/);
  });

  it('invokes validatePostStateCapLegality in seasonManager.ts (advanceSeasonInWorld)', () => {
    const source = readSource(SEASON_MANAGER_PATH);

    expect(
      source,
      'seasonManager.ts must import validatePostStateCapLegality'
    ).toContain('validatePostStateCapLegality');

    expect(
      source,
      'seasonManager.ts must call validatePostStateCapLegality(...)'
    ).toMatch(/validatePostStateCapLegality\s*\(/);
  });

  it('invokes validatePostStateCapLegality in useArchitectActions.ts (base-mode + preview)', () => {
    const source =
      readSource(USE_ARCHITECT_ACTIONS_PATH) +
      readSource(USE_ARCHITECT_ACTIONS_HELPERS_PATH);

    expect(
      source,
      'useArchitectActions.ts must import validatePostStateCapLegality'
    ).toContain('validatePostStateCapLegality');

    expect(
      source,
      'useArchitectActions.ts must call validatePostStateCapLegality(...)'
    ).toMatch(/validatePostStateCapLegality\s*\(/);
  });
});

// === Gate 3: Event envelope fields ===
describe('CAP_AUDITABILITY Closure Gate 3: Event envelope fields', () => {
  const requiredCapAuditEventV1Fields = [
    'schemaVersion',
    'validatorVersion',
    'operationId',
    'mutationType',
    'occurredAt',
    'worldId',
    'beforeTotalsByTeam',
    'afterTotalsByTeam',
    'valid',
    'violations',
    'warnings',
    'teamCodes',
    'playerIds',
    'diffSummary',
  ];

  it('persistWorldMutation (mutationPipeline.ts) emits all required CapAuditEventV1 fields', () => {
    const source = readSource(MUTATION_PIPELINE_PATH);
    const missingFields: string[] = [];

    for (const field of requiredCapAuditEventV1Fields) {
      // Check for field assignment patterns like "fieldName:" or "fieldName,"
      const pattern = new RegExp(`${field}[:\\s,]`);
      if (!pattern.test(source)) {
        missingFields.push(field);
      }
    }

    expect(
      missingFields,
      `mutationPipeline.ts missing CapAuditEventV1 fields: ${missingFields.join(', ')}`
    ).toHaveLength(0);
  });

  it('seasonManager.ts emits all required CapAuditEventV1 fields', () => {
    const source = readSource(SEASON_MANAGER_PATH);
    const missingFields: string[] = [];

    for (const field of requiredCapAuditEventV1Fields) {
      const pattern = new RegExp(`${field}[:\\s,]`);
      if (!pattern.test(source)) {
        missingFields.push(field);
      }
    }

    expect(
      missingFields,
      `seasonManager.ts missing CapAuditEventV1 fields: ${missingFields.join(', ')}`
    ).toHaveLength(0);
  });

  it('localCapAuditLog.ts interface declares all required CapAuditEventV1 fields', () => {
    const source = readSource(LOCAL_CAP_AUDIT_LOG_PATH);
    const missingFields: string[] = [];

    for (const field of requiredCapAuditEventV1Fields) {
      // Interface fields are declared as "fieldName:" or "fieldName?"
      const pattern = new RegExp(`${field}[?]?:\\s*`);
      if (!pattern.test(source)) {
        missingFields.push(field);
      }
    }

    expect(
      missingFields,
      `localCapAuditLog.ts CapAuditEventV1Like interface missing fields: ${missingFields.join(', ')}`
    ).toHaveLength(0);
  });

  it('useArchitectActions.ts buildCapAuditEvent emits all required fields', () => {
    const source =
      readSource(USE_ARCHITECT_ACTIONS_PATH) +
      readSource(USE_ARCHITECT_ACTIONS_HELPERS_PATH);
    const missingFields: string[] = [];

    for (const field of requiredCapAuditEventV1Fields) {
      const pattern = new RegExp(`${field}[:\\s,]`);
      if (!pattern.test(source)) {
        missingFields.push(field);
      }
    }

    expect(
      missingFields,
      `useArchitectActions.ts missing CapAuditEventV1 fields: ${missingFields.join(', ')}`
    ).toHaveLength(0);
  });
});

// === Gate 4: Base-mode no Firestore writes ===
describe('CAP_AUDITABILITY Closure Gate 4: Base-mode no Firestore writes', () => {
  function extractCapChangingFunctionRegions(source: string): string[] {
    const regions: string[] = [];

    // Extract regions for cap-changing handlers that have base-mode paths
    const functionPatterns = [
      {
        start: 'const applyTradeToCapSheet = useCallback(',
        end: 'const handleSign = useCallback(',
      },
      {
        start: 'const handleSign = useCallback(',
        end: 'const handleSignAndTrade = useCallback(',
      },
      {
        start: 'const handleSetDeadCap = useCallback(',
        end: 'const handleSetExceptions = useCallback(',
      },
      {
        start: 'const handleSetExceptions = useCallback(',
        end: 'const handleEditContract = useCallback(',
      },
      {
        start: 'const confirmAndRenounceRights = useCallback(',
        end: 'const handleCapTableModalAction = useCallback(',
      },
      {
        start: 'const handleExtendContract = useCallback(',
        end: 'const handleWaiveContract = useCallback(',
      },
      {
        start: 'const handleWaiveContract = useCallback(',
        end: 'const handleOptionDecision = useCallback(',
      },
      {
        start: 'const handleOptionDecision = useCallback(',
        end: 'const handleRenounceRights = useCallback(',
      },
    ];

    for (const { start, end } of functionPatterns) {
      const startIndex = source.indexOf(start);
      const endIndex = source.indexOf(end);
      if (startIndex > -1 && endIndex > startIndex) {
        regions.push(source.slice(startIndex, endIndex));
      }
    }

    return regions;
  }

  it('cap-changing handler regions do not contain direct Firestore write calls', () => {
    const source = readSource(USE_ARCHITECT_ACTIONS_PATH);
    const regions = extractCapChangingFunctionRegions(source);

    const forbiddenPatterns = [
      /\bwriteBatch\s*\(/,
      /\bsetDoc\s*\(/,
      /\bupdateDoc\s*\(/,
      /\baddDoc\s*\(/,
      /\bdeleteDoc\s*\(/,
      /\bbatch\.commit\s*\(/,
    ];

    for (const region of regions) {
      for (const forbidden of forbiddenPatterns) {
        expect(
          region,
          `Cap-changing handler contains forbidden Firestore write pattern: ${forbidden.source}`
        ).not.toMatch(forbidden);
      }
    }
  });

  it('base-mode persistence is skipped (persistMutation returns skipped for null worldId)', () => {
    const source = readSource(USE_ARCHITECT_ACTIONS_PATH);

    // The persistMutation function should return early when worldId is null
    expect(
      source,
      'persistMutation must check for null/missing worldId and skip persistence'
    ).toMatch(/if\s*\(\s*!worldId\s*\)/);

    expect(
      source,
      'persistMutation must return skipped result for base-mode'
    ).toContain('skipped: true');
  });
});

// === Gate 5: CapAuditDebugPanel dev-only ===
describe('CAP_AUDITABILITY Closure Gate 5: CapAuditDebugPanel dev-only', () => {
  it('isCapAuditDebugEnabled checks import.meta.env.DEV or debug flag', () => {
    const source = readSource(CAP_AUDIT_DEBUG_PANEL_PATH);

    expect(
      source,
      'CapAuditDebugPanel must export isCapAuditDebugEnabled function'
    ).toContain('export function isCapAuditDebugEnabled');

    expect(
      source,
      'isCapAuditDebugEnabled must check import.meta.env.DEV'
    ).toContain('import.meta.env.DEV');

    expect(
      source,
      'isCapAuditDebugEnabled must check debug flag fallback'
    ).toContain('hasDebugFlagEnabled');
  });

  it('debug panel is not always-on in production', () => {
    const source = readSource(CAP_AUDIT_DEBUG_PANEL_PATH);

    // Ensure the function doesn't just return true
    expect(
      source,
      'isCapAuditDebugEnabled must not unconditionally return true'
    ).not.toMatch(
      /export function isCapAuditDebugEnabled[^}]*return\s+true\s*;?\s*}/
    );

    // Ensure there's a conditional check
    expect(
      source,
      'isCapAuditDebugEnabled must have conditional logic'
    ).toMatch(/isCapAuditDebugEnabled[^}]*\|\|/);
  });
});
