/**
 * FILE: src/tests/architect/season_advance_bridge_gate_guardrails.test.js
 * PURPOSE: Guardrails for Season Advance Bridge Gate persistence hygiene
 *          (CAP_SHEET_E2E_SSOT_PARITY_E1)
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2026-02-28: CAP_SHEET_E2E_SSOT_PARITY_E1 - Created
 *
 * INVARIANT: Season advance persistence path must use the same hygiene chain
 *            as persistWorldMutation: strip hydration → sanitize → normalize TPE → validate contract → removeUndefined
 *
 * TESTS:
 * A) Source-scan guardrails:
 *    1. seasonManager.js contains sanitizeTransientFieldsForPersistence
 *    2. seasonManager.js contains assertPersistableOrThrow
 *    3. Correct ordering: stripHydration before sanitize before normalize before assertPersistable before removeUndefined
 *    4. seasonManager.js imports sanitizeTransientFieldsForPersistence from mutationPipeline
 *    5. seasonManager.js imports assertPersistableOrThrow from persistenceContracts
 *    6. computeTeamCapTotals uses team.players (not team.roster) for salary computation
 *    7. seasonManager.js strips hydration-only fields (HYDRATION_ONLY_KEYS)
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEASON_MANAGER_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/seasonManager.js'
);

const COMPUTE_TOTALS_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/capTotals/computeTeamCapTotals.ts'
);

const COMPUTE_TOTALS_SHIM_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/capTotals/computeTeamCapTotals.js'
);

describe('Season Advance Bridge Gate — Source-Scan Guardrails', () => {
  const seasonManagerSource = fs.readFileSync(SEASON_MANAGER_PATH, 'utf-8');

  it('TEST 1: seasonManager.js calls sanitizeTransientFieldsForPersistence', () => {
    // Must contain at least one call (not just import)
    expect(seasonManagerSource).toMatch(
      /sanitizeTransientFieldsForPersistence\(/
    );
  });

  it('TEST 2: seasonManager.js calls assertPersistableOrThrow', () => {
    expect(seasonManagerSource).toMatch(/assertPersistableOrThrow\(/);
  });

  it('TEST 3: Correct ordering — stripHydration before sanitize before normalize before assertPersistable before removeUndefined', () => {
    // Find the bridge gate block within advanceSeasonInWorld
    const stripIdx = seasonManagerSource.indexOf(
      'stripHydrationOnlyFields(updatedTeam)'
    );
    const sanitizeIdx = seasonManagerSource.indexOf(
      'sanitizeTransientFieldsForPersistence(afterHydrationStrip)'
    );
    const normalizeIdx = seasonManagerSource.indexOf(
      'normalizeTeamTpeSchema(afterSanitize)'
    );
    const assertIdx = seasonManagerSource.indexOf(
      'assertPersistableOrThrow({'
    );
    const removeIdx = seasonManagerSource.indexOf(
      'removeUndefinedDeep(normalizedTeam)',
      stripIdx > 0 ? stripIdx : 0
    );

    expect(stripIdx, 'stripHydration call should exist').toBeGreaterThan(-1);
    expect(sanitizeIdx, 'sanitize call should exist').toBeGreaterThan(-1);
    expect(normalizeIdx, 'normalize call should exist').toBeGreaterThan(-1);
    expect(assertIdx, 'assertPersistable call should exist').toBeGreaterThan(-1);
    expect(removeIdx, 'removeUndefined call should exist').toBeGreaterThan(-1);

    // Verify ordering
    expect(
      stripIdx < sanitizeIdx,
      'stripHydration must come before sanitize'
    ).toBe(true);
    expect(
      sanitizeIdx < normalizeIdx,
      'sanitize must come before normalize'
    ).toBe(true);
    expect(
      normalizeIdx < assertIdx,
      'normalize must come before assertPersistable'
    ).toBe(true);
    expect(
      assertIdx < removeIdx,
      'assertPersistable must come before removeUndefined'
    ).toBe(true);
  });

  it('TEST 4: seasonManager imports sanitizeTransientFieldsForPersistence from mutationPipeline', () => {
    expect(seasonManagerSource).toMatch(
      /import\s*\{[^}]*sanitizeTransientFieldsForPersistence[^}]*\}\s*from\s*['"].*mutationPipeline['"]/
    );
  });

  it('TEST 5: seasonManager imports assertPersistableOrThrow from persistenceContracts', () => {
    expect(seasonManagerSource).toMatch(
      /import\s*\{[^}]*assertPersistableOrThrow[^}]*\}\s*from\s*['"].*persistenceContracts['"]/
    );
  });

  it('TEST 6: computeTeamCapTotals reads from team.players, not team.roster, for salary computation', () => {
    const computeSource = fs.readFileSync(COMPUTE_TOTALS_PATH, 'utf-8');

    // The SSOT function passes teamCapSheet?.players to computePlayersTotal
    expect(computeSource).toMatch(/teamCapSheet\?\.players/);

    // Should NOT use teamCapSheet?.roster for salary computation
    const usesRosterForCompute =
      /computePlayersTotal\(.*teamCapSheet\?\.roster/.test(computeSource);
    expect(usesRosterForCompute).toBe(false);
  });

  it('TEST 6b: computeTeamCapTotals.js remains a shim-only compatibility surface', () => {
    const computeShimSource = fs.readFileSync(COMPUTE_TOTALS_SHIM_PATH, 'utf-8');

    expect(computeShimSource).toContain(
      "export * from './computeTeamCapTotals.ts';"
    );
    expect(computeShimSource).toContain(
      "export { default } from './computeTeamCapTotals.ts';"
    );
    expect(computeShimSource).not.toContain('teamCapSheet?.players');
  });

  it('TEST 7: seasonManager strips hydration-only display fields before persistence', () => {
    // HYDRATION_ONLY_KEYS must be defined and include known hydration fields
    expect(seasonManagerSource).toMatch(/HYDRATION_ONLY_KEYS/);
    expect(seasonManagerSource).toMatch(/stripHydrationOnlyFields/);

    // Verify specific keys are in the list
    const knownHydrationKeys = ['id', 'activeContracts', 'draftAssets', 'mle', 'tpMle', 'bae', 'baseline'];
    for (const key of knownHydrationKeys) {
      expect(
        seasonManagerSource.includes(`'${key}'`),
        `HYDRATION_ONLY_KEYS should include '${key}'`
      ).toBe(true);
    }
  });
});
