/**
 * Stepien Obligations Tests
 *
 * Phase 13 Update: Legacy draftPicksObligations behavior has been REMOVED.
 *
 * Previously: This test file validated that draftPicksObligations was read as a
 * fallback baseline when validationEntitlements was empty.
 *
 * Now (Phase 13 SSOT): draftPicksObligations is IGNORED completely.
 * - If validationEntitlements is empty, baseline is empty
 * - Only outgoing picks (outgoingPicks + entitlementsOut) are considered
 * - Stepien violations only occur when outgoing creates consecutive years
 *
 * Tests have been updated to reflect this new behavior.
 *
 * See: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 13)
 * See: docs/tradeMachine/TRADE_MACHINE_DRAFT_PICKS_MASTER.md
 */
import { describe, it, expect } from 'vitest';
import { validateStepien } from '@/features/architect/utils/tradeMachine/rules/validateStepien';

describe('validateStepien - Phase 13 SSOT (Legacy Obligations Removed)', () => {
  const makeTeam = (params) => ({
    teamId: 'TEST',
    teamCode: 'TEST',
    team: {
      picks: [],
    },
    context: {
      yearKey: 2025,
    },
    outgoingPicks: [],
    draftPicksObligations: [],
    validationEntitlements: [], // Phase 13: baseline comes from here
    entitlementsOut: [],
    ...params,
  });

  describe('Phase 13: draftPicksObligations is IGNORED', () => {
    it('does NOT read draftPicksObligations for baseline - single outgoing passes', () => {
      // Phase 13: draftPicksObligations is ignored
      // Only 2028 outgoing pick is considered, no consecutive violation
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [{ year: 2028, round: '1st' }],
          draftPicksObligations: [
            {
              year: 2027,
              round: 1,
              originalTeam: 'TEST',
              owner: 'OTHER',
              status: 'outgoing',
            },
          ],
        })
      );
      // Phase 13: Only 2028 outgoing, no consecutive = pass
      expect(result.passed).toBe(true);
      expect(result._debug.baselineSource).toBe('entitlements_ssot');
      expect(result._debug.baselineYearsCount).toBe(0); // No baseline from obligations
    });

    it('consecutive outgoing picks STILL cause violation (no legacy needed)', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2027, round: '1st' },
            { year: 2028, round: '1st' },
          ],
          draftPicksObligations: [], // Doesn't matter - ignored anyway
        })
      );
      // 2027 + 2028 outgoing = consecutive violation
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('consecutive future 1sts');
    });

    it('non-consecutive outgoing picks pass', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2027, round: '1st' },
            { year: 2029, round: '1st' }, // Gap year
          ],
        })
      );
      expect(result.passed).toBe(true);
    });
  });

  describe('Consecutive violation still works for outgoing picks', () => {
    it('blocks when tradeable: false obligation ignored but outgoing creates consecutive', () => {
      // Phase 13: obligation is ignored, but if outgoing picks are consecutive, still fails
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2027, round: '1st' },
            { year: 2028, round: '1st' },
          ],
          draftPicksObligations: [
            {
              year: 2026,
              round: 1,
              status: 'conditional',
              tradeable: false,
            },
          ],
        })
      );
      // 2027 + 2028 outgoing = consecutive violation (2026 obligation ignored)
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('consecutive future 1sts');
    });

    it('meaningful protection on outgoing picks bypasses violation', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2027, round: '1st', protection: 'Top 5' },
            { year: 2028, round: '1st', protection: 'Top 3' },
          ],
        })
      );
      // Both protected = no violation
      expect(result.passed).toBe(true);
    });

    it('unprotected + protected consecutive = pass', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2027, round: '1st' }, // Unprotected
            { year: 2028, round: '1st', protection: 'Top 3' }, // Protected
          ],
        })
      );
      // One protected = bypass consecutive check for that pair
      expect(result.passed).toBe(true);
    });
  });

  describe('Swap picks in outgoing', () => {
    it('outgoing swap with worst_of does NOT reserve year', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2027, round: '1st', isSwap: true, swapType: 'worst_of' },
            { year: 2028, round: '1st' },
          ],
        })
      );
      // worst_of swap doesn't reserve 2027, only 2028 counts = no consecutive
      expect(result.passed).toBe(true);
    });

    it('outgoing swap with best_of DOES reserve year', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2027, round: '1st', isSwap: true, swapType: 'best_of' },
            { year: 2028, round: '1st' },
          ],
        })
      );
      // best_of swap reserves 2027, plus 2028 = consecutive violation
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('consecutive future 1sts');
    });

    it('outgoing swap with missing swapType defaults to best_of', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2027, round: '1st', isSwap: true }, // No swapType = best_of
            { year: 2028, round: '1st' },
          ],
        })
      );
      // Defaults to best_of = reserves year = consecutive violation
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('consecutive future 1sts');
    });
  });

  describe('Edge cases', () => {
    it('handles empty obligations array gracefully', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [{ year: 2026, round: '1st' }],
          draftPicksObligations: [],
        })
      );
      expect(result.passed).toBe(true);
    });

    it('handles missing draftPicksObligations field gracefully', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [{ year: 2026, round: '1st' }],
          // No draftPicksObligations field at all
        })
      );
      expect(result.passed).toBe(true);
    });

    it('ignores second-round picks for Stepien (outgoing)', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [
            { year: 2027, round: '2nd' },
            { year: 2028, round: '1st' },
          ],
        })
      );
      // Second round ignored, only 2028 1st = no consecutive
      expect(result.passed).toBe(true);
    });

    it('Phase 13: team.team.draftPicksObligations fallback is IGNORED', () => {
      // Phase 13: Even the fallback path is now ignored
      const teamInput = makeTeam({
        team: {
          picks: [],
          draftPicksObligations: [
            {
              year: 2027,
              round: 1,
              status: 'outgoing',
            },
          ],
        },
        outgoingPicks: [{ year: 2028, round: '1st' }],
      });
      const result = validateStepien(teamInput);
      // Phase 13: Obligation is ignored, only 2028 outgoing = pass
      expect(result.passed).toBe(true);
    });

    it('includes debug info with Phase 13 baseline source', () => {
      const result = validateStepien(
        makeTeam({
          outgoingPicks: [{ year: 2028, round: '1st' }],
          draftPicksObligations: [
            {
              year: 2027,
              round: 1,
              status: 'outgoing',
            },
          ],
        })
      );
      // Verify debug info reflects Phase 13 SSOT
      expect(result._debug).toBeDefined();
      expect(result._debug.baselineSource).toBe('entitlements_ssot');
      expect(result._debug.baselineYearsCount).toBe(0); // No baseline from obligations
      expect(result._debug.tradePicksConsidered).toBe(1);
    });
  });

  describe('Entitlements SSOT baseline works correctly', () => {
    it('uses validationEntitlements for baseline when provided', () => {
      const result = validateStepien(
        makeTeam({
          validationEntitlements: [
            { id: 'e1', kind: 'pick_ownership', round: 1, seasonYear: 2026 },
            { id: 'e2', kind: 'pick_ownership', round: 1, seasonYear: 2027 },
          ],
          entitlementsOut: [
            { id: 'e1', kind: 'pick_ownership', round: 1, seasonYear: 2026 },
            { id: 'e2', kind: 'pick_ownership', round: 1, seasonYear: 2027 },
          ],
        })
      );
      // 2026 + 2027 outgoing = consecutive violation
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('consecutive future 1sts');
      expect(result._debug.baselineYearsCount).toBe(2);
    });

    it('non-consecutive entitlementsOut pass', () => {
      const result = validateStepien(
        makeTeam({
          validationEntitlements: [
            { id: 'e1', kind: 'pick_ownership', round: 1, seasonYear: 2026 },
            { id: 'e2', kind: 'pick_ownership', round: 1, seasonYear: 2028 },
          ],
          entitlementsOut: [
            { id: 'e1', kind: 'pick_ownership', round: 1, seasonYear: 2026 },
            { id: 'e2', kind: 'pick_ownership', round: 1, seasonYear: 2028 },
          ],
        })
      );
      // 2026 + 2028 = non-consecutive = pass
      expect(result.passed).toBe(true);
    });
  });

  describe('TM-6: Improved warning messages for authored terms', () => {
    it('emits specific message for multi-tier protection ladder', () => {
      const result = validateStepien(
        makeTeam({
          entitlementsOut: [
            {
              id: 'ent:LAL:2026:1:own:ladder',
              kind: 'pick_ownership',
              round: 1,
              seasonYear: 2026,
              protectionLadder: [
                { year: 2026, condition: 'Top 3', ifTriggered: 'roll', rollToYear: 2027 },
                { year: 2027, condition: 'Top 5', ifTriggered: 'cancel' },
              ],
            },
          ],
        })
      );
      // Should include tier count and starting year
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('2 tiers');
      expect(result.warnings[0]).toContain('2026');
    });

    it('emits specific message for single-tier protection ladder', () => {
      const result = validateStepien(
        makeTeam({
          entitlementsOut: [
            {
              id: 'ent:LAL:2027:1:own:single',
              kind: 'pick_ownership',
              round: 1,
              seasonYear: 2027,
              protectionLadder: [
                { year: 2027, condition: 'Top 10', ifTriggered: 'roll', rollToYear: 2028 },
              ],
            },
          ],
        })
      );
      // Single tier = "Protected pick" message
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Protected pick');
      expect(result.warnings[0]).toContain('2027');
    });

    it('emits specific message for conveyance with pool', () => {
      const result = validateStepien(
        makeTeam({
          entitlementsOut: [
            {
              id: 'ent:LAL:2028:1:conv:pool',
              kind: 'conveyance_right',
              round: 1,
              seasonYear: 2028,
              poolUnderlyingPickIds: ['ATL_2028_1st', 'SAS_2028_1st', 'ORL_2028_1st'],
              receivesRank: [1],
              receivesComparator: 'less_favorable',
            },
          ],
        })
      );
      // Should mention pool size
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('3-pick pool');
    });

    it('emits generic conveyance message when no pool', () => {
      const result = validateStepien(
        makeTeam({
          entitlementsOut: [
            {
              id: 'ent:LAL:2029:1:conv:nopool',
              kind: 'conveyance_right',
              round: 1,
              seasonYear: 2029,
              receivesRank: [1],
              receivesComparator: 'more_favorable',
            },
          ],
        })
      );
      // No pool = generic conveyance message
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Conveyance right');
      expect(result.warnings[0]).toContain('conveyance outcome known');
    });

    it('does not emit warnings for simple pick_ownership without ladder', () => {
      const result = validateStepien(
        makeTeam({
          entitlementsOut: [
            {
              id: 'ent:LAL:2026:1:own:simple',
              kind: 'pick_ownership',
              round: 1,
              seasonYear: 2026,
              underlyingPickId: 'LAL_2026_1st',
            },
          ],
        })
      );
      // No ladder, no conveyance = no warnings
      expect(result.warnings.length).toBe(0);
    });
  });
});
