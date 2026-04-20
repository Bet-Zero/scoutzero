/**
 * Phase 72 — SSOT Cap Totals Unification Guardrails
 *
 * PURPOSE: Prevent regression to legacy team totals computation functions.
 * The canonical SSOT is computeTeamCapTotals() from capTotals module.
 *
 * TESTS:
 * 1. Source scan: mutationPipeline.ts must NOT define calculateTeamTotals
 * 2. Source scan: tradeContext.ts must NOT define calculateTeamTotals
 * 3. Source scan: mutationPipeline.ts must import computeTeamCapTotals
 * 4. Source scan: tradeContext.ts must import computeTeamCapTotals
 * 5. Behavioral: SSOT returns incompleteChargesTotal for understaffed roster
 *
 * HISTORY:
 *  - 2026-02-01: Phase 72 - Created as part of SSOT unification
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase 72 SSOT Cap Totals Unification Guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect/utils');
  const mutationPipelinePath = path.join(srcRoot, 'mutationPipeline.ts');
  const tradeContextPath = path.join(srcRoot, 'tradeContext/tradeContext.ts');

  describe('Source scan: banned legacy function definitions', () => {
    it('mutationPipeline.ts should NOT define calculateTeamTotals function', () => {
      const content = fs.readFileSync(mutationPipelinePath, 'utf-8');
      const hasFunctionDefinition = /function\s+calculateTeamTotals\s*\(/.test(
        content
      );
      expect(hasFunctionDefinition).toBe(false);
    });

    it('tradeContext.ts should NOT define calculateTeamTotals function', () => {
      const content = fs.readFileSync(tradeContextPath, 'utf-8');
      const hasFunctionDefinition = /function\s+calculateTeamTotals\s*\(/.test(
        content
      );
      expect(hasFunctionDefinition).toBe(false);
    });
  });

  describe('Source scan: SSOT import presence', () => {
    it('mutationPipeline.ts should import computeTeamCapTotals from capTotals', () => {
      const content = fs.readFileSync(mutationPipelinePath, 'utf-8');
      const hasImport =
        /import\s+\{[^}]*computeTeamCapTotals[^}]*\}\s+from\s+['"]@\/features\/architect\/utils\/capTotals['"]/.test(
          content
        );
      expect(hasImport).toBe(true);
    });

    it('tradeContext.ts should import computeTeamCapTotals from capTotals', () => {
      const content = fs.readFileSync(tradeContextPath, 'utf-8');
      const hasImport =
        /import\s+\{[^}]*computeTeamCapTotals[^}]*\}\s+from\s+['"]@\/features\/architect\/utils\/capTotals['"]/.test(
          content
        );
      expect(hasImport).toBe(true);
    });
  });

  describe('Source scan: SSOT usage in call sites', () => {
    it('mutationPipeline.ts should call computeTeamCapTotals (not calculateTeamTotals)', () => {
      const content = fs.readFileSync(mutationPipelinePath, 'utf-8');
      // Should have computeTeamCapTotals calls
      const hasSSOTCalls = /computeTeamCapTotals\(/.test(content);
      // Should NOT have calculateTeamTotals calls
      const hasLegacyCalls = /calculateTeamTotals\(/.test(content);

      expect(hasSSOTCalls).toBe(true);
      expect(hasLegacyCalls).toBe(false);
    });

    it('tradeContext.ts should call computeTeamCapTotals (not calculateTeamTotals)', () => {
      const content = fs.readFileSync(tradeContextPath, 'utf-8');
      // Should have computeTeamCapTotals calls
      const hasSSOTCalls = /computeTeamCapTotals\(/.test(content);
      // Should NOT have calculateTeamTotals calls
      const hasLegacyCalls = /calculateTeamTotals\(/.test(content);

      expect(hasSSOTCalls).toBe(true);
      expect(hasLegacyCalls).toBe(false);
    });
  });

  describe('Behavioral: SSOT incompleteChargesTotal computation', () => {
    it('SSOT returns non-zero incompleteChargesTotal for roster below CBA minimum', async () => {
      const { computeTeamCapTotals } = await import(
        '@/features/architect/utils/capTotals'
      );

      // Create minimal team with only 10 standard players (below 14 minimum)
      const understaffedTeam = {
        players: Array(10)
          .fill(null)
          .map((_, i) => ({
            player_id: `player_${i}`,
            contract: {
              salariesByYear: [
                { season: '2024-25', salary: 1000000, capHit: 1000000 },
              ],
            },
            contractType: 'standard',
          })),
        capHolds: [],
        deadCap: [],
      };

      const totals = computeTeamCapTotals(understaffedTeam, 2025);

      // With 10 players and 14 minimum, should have 4 * rookieMin charge
      expect(totals.incompleteChargesTotal).toBeGreaterThan(0);
      // Total allocations should include the incomplete charges
      expect(totals.totalCapAllocations).toBeGreaterThan(totals.playersTotal);
      expect(totals.totalCapAllocations).toBe(
        totals.playersTotal +
          totals.deadMoneyTotal +
          totals.capHoldsTotal +
          totals.incompleteChargesTotal
      );
    });

    it('SSOT returns zero incompleteChargesTotal for roster at or above CBA minimum', async () => {
      const { computeTeamCapTotals } = await import(
        '@/features/architect/utils/capTotals'
      );

      // Create team with exactly 14 standard players (meets minimum)
      const fullRosterTeam = {
        players: Array(14)
          .fill(null)
          .map((_, i) => ({
            player_id: `player_${i}`,
            contract: {
              salariesByYear: [
                { season: '2024-25', salary: 1000000, capHit: 1000000 },
              ],
            },
            contractType: 'standard',
          })),
        capHolds: [],
        deadCap: [],
      };

      const totals = computeTeamCapTotals(fullRosterTeam, 2025);

      // With 14 players, no incomplete charge
      expect(totals.incompleteChargesTotal).toBe(0);
    });
  });
});
