/**
 * FILE: src/tests/architect/phase13_entitlementIds_transfer_guardrail.test.js
 * PURPOSE: Guardrail tests for Phase 13 - entitlementIds transfer correctness (SSOT).
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * HISTORY:
 *   - 2026-02-01: Created for Phase 13 - Entitlements SSOT Validation
 *
 * LINKS:
 *   - docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 13)
 *   - src/features/architect/utils/tradeContext/tradeContext.js
 *
 * TESTS:
 *   1. 2-team trade: team A sends entitlement e1 → team B receives e1
 *   2. 3-team trade with toTeamId routing: e1→B, e2→C (routed)
 *   3. 3-team trade without toTeamId: unrouted entitlement broadcasts to all
 */

import { describe, it, expect } from 'vitest';
import { buildPostTradeTeamsSnapshot } from '@/features/architect/utils/mutationPipeline';

// ============================================================================
// Minimal Fixtures
// ============================================================================

const makeMinimalTeam = (teamCode, entitlementIds = []) => ({
  teamCode,
  teamName: `Team ${teamCode}`,
  roster: [],
  players: [],
  draftPicks: [],
  entitlementIds,
  tradeExceptions: [],
  exceptions: {},
  totals: { totalSalary: 100000000, capHit: 100000000 },
});

// ============================================================================
// Test Suite
// ============================================================================

describe('Phase 13: entitlementIds Transfer Guardrails', () => {
  describe('Test 1: 2-Team Trade - Basic entitlementIds Transfer', () => {
    it('should remove sent entitlement from sender and add to receiver', () => {
      // Setup: Team A has [e1, e2], Team B has [e3]
      const teamA = makeMinimalTeam('TMA', ['e1', 'e2']);
      const teamB = makeMinimalTeam('TMB', ['e3']);

      const payload = {
        teams: [
          {
            teamCode: 'TMA',
            sends: [],
            entitlementsOut: [{ id: 'e1', entitlementId: 'e1' }], // A sends e1
          },
          {
            teamCode: 'TMB',
            sends: [],
            entitlementsOut: [], // B sends nothing
          },
        ],
      };

      const currentState = {
        teams: [
          { teamCode: 'TMA', team: teamA },
          { teamCode: 'TMB', team: teamB },
        ],
      };

      const snapshot = buildPostTradeTeamsSnapshot({
        payload,
        currentState,
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      // Get post-trade teams
      const postTradeA = snapshot.teamUpdates.find(
        (t) => t.teamCode === 'TMA'
      ).team;
      const postTradeB = snapshot.teamUpdates.find(
        (t) => t.teamCode === 'TMB'
      ).team;

      // Team A should no longer have e1, but still have e2
      expect(postTradeA.entitlementIds).not.toContain('e1');
      expect(postTradeA.entitlementIds).toContain('e2');

      // Team B should now have e1 (in addition to e3)
      expect(postTradeB.entitlementIds).toContain('e1');
      expect(postTradeB.entitlementIds).toContain('e3');
    });

    it('should handle bidirectional entitlement exchange', () => {
      // Setup: A has [e1], B has [e2] - they swap
      const teamA = makeMinimalTeam('TMA', ['e1']);
      const teamB = makeMinimalTeam('TMB', ['e2']);

      const payload = {
        teams: [
          {
            teamCode: 'TMA',
            sends: [],
            entitlementsOut: [{ id: 'e1' }],
          },
          {
            teamCode: 'TMB',
            sends: [],
            entitlementsOut: [{ id: 'e2' }],
          },
        ],
      };

      const currentState = {
        teams: [
          { teamCode: 'TMA', team: teamA },
          { teamCode: 'TMB', team: teamB },
        ],
      };

      const snapshot = buildPostTradeTeamsSnapshot({
        payload,
        currentState,
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      const postTradeA = snapshot.teamUpdates.find(
        (t) => t.teamCode === 'TMA'
      ).team;
      const postTradeB = snapshot.teamUpdates.find(
        (t) => t.teamCode === 'TMB'
      ).team;

      // A should now have e2 (from B), not e1
      expect(postTradeA.entitlementIds).toContain('e2');
      expect(postTradeA.entitlementIds).not.toContain('e1');

      // B should now have e1 (from A), not e2
      expect(postTradeB.entitlementIds).toContain('e1');
      expect(postTradeB.entitlementIds).not.toContain('e2');
    });
  });

  describe('Test 2: 3-Team Trade - Routed Entitlements (toTeamId)', () => {
    it('should route entitlements to specified toTeamId only', () => {
      // Setup: A sends e1→B, e2→C using toTeamId routing
      const teamA = makeMinimalTeam('TMA', ['e1', 'e2', 'e3']);
      const teamB = makeMinimalTeam('TMB', ['e4']);
      const teamC = makeMinimalTeam('TMC', ['e5']);

      const payload = {
        teams: [
          {
            teamCode: 'TMA',
            sends: [],
            entitlementsOut: [
              { id: 'e1', toTeamId: 'TMB' }, // e1 → Team B only
              { id: 'e2', toTeamId: 'TMC' }, // e2 → Team C only
            ],
          },
          {
            teamCode: 'TMB',
            sends: [],
            entitlementsOut: [],
          },
          {
            teamCode: 'TMC',
            sends: [],
            entitlementsOut: [],
          },
        ],
      };

      const currentState = {
        teams: [
          { teamCode: 'TMA', team: teamA },
          { teamCode: 'TMB', team: teamB },
          { teamCode: 'TMC', team: teamC },
        ],
      };

      const snapshot = buildPostTradeTeamsSnapshot({
        payload,
        currentState,
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      const postTradeA = snapshot.teamUpdates.find(
        (t) => t.teamCode === 'TMA'
      ).team;
      const postTradeB = snapshot.teamUpdates.find(
        (t) => t.teamCode === 'TMB'
      ).team;
      const postTradeC = snapshot.teamUpdates.find(
        (t) => t.teamCode === 'TMC'
      ).team;

      // Team A loses e1 and e2, keeps e3
      expect(postTradeA.entitlementIds).not.toContain('e1');
      expect(postTradeA.entitlementIds).not.toContain('e2');
      expect(postTradeA.entitlementIds).toContain('e3');

      // Team B gets ONLY e1 (not e2)
      expect(postTradeB.entitlementIds).toContain('e1');
      expect(postTradeB.entitlementIds).not.toContain('e2');
      expect(postTradeB.entitlementIds).toContain('e4'); // Keeps original

      // Team C gets ONLY e2 (not e1)
      expect(postTradeC.entitlementIds).toContain('e2');
      expect(postTradeC.entitlementIds).not.toContain('e1');
      expect(postTradeC.entitlementIds).toContain('e5'); // Keeps original
    });

    it('should handle mixed routed and unrouted in same trade', () => {
      // Setup: A sends e1→B (routed), e2 (unrouted - broadcasts to all)
      const teamA = makeMinimalTeam('TMA', ['e1', 'e2']);
      const teamB = makeMinimalTeam('TMB', []);
      const teamC = makeMinimalTeam('TMC', []);

      const payload = {
        teams: [
          {
            teamCode: 'TMA',
            sends: [],
            entitlementsOut: [
              { id: 'e1', toTeamId: 'TMB' }, // Routed to B
              { id: 'e2' }, // No toTeamId = broadcasts
            ],
          },
          {
            teamCode: 'TMB',
            sends: [],
            entitlementsOut: [],
          },
          {
            teamCode: 'TMC',
            sends: [],
            entitlementsOut: [],
          },
        ],
      };

      const currentState = {
        teams: [
          { teamCode: 'TMA', team: teamA },
          { teamCode: 'TMB', team: teamB },
          { teamCode: 'TMC', team: teamC },
        ],
      };

      const snapshot = buildPostTradeTeamsSnapshot({
        payload,
        currentState,
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      const postTradeA = snapshot.teamUpdates.find(
        (t) => t.teamCode === 'TMA'
      ).team;
      const postTradeB = snapshot.teamUpdates.find(
        (t) => t.teamCode === 'TMB'
      ).team;
      const postTradeC = snapshot.teamUpdates.find(
        (t) => t.teamCode === 'TMC'
      ).team;

      // Team A loses both e1 and e2
      expect(postTradeA.entitlementIds).not.toContain('e1');
      expect(postTradeA.entitlementIds).not.toContain('e2');

      // Team B gets e1 (routed) AND e2 (broadcast)
      expect(postTradeB.entitlementIds).toContain('e1');
      expect(postTradeB.entitlementIds).toContain('e2');

      // Team C gets ONLY e2 (broadcast), NOT e1 (was routed to B)
      expect(postTradeC.entitlementIds).not.toContain('e1');
      expect(postTradeC.entitlementIds).toContain('e2');
    });
  });

  describe('Test 3: 3-Team Trade - Unrouted Entitlements (Broadcast)', () => {
    it('should broadcast unrouted entitlement to ALL other trade participants', () => {
      // Setup: A sends e1 (no toTeamId) - should go to BOTH B and C
      const teamA = makeMinimalTeam('TMA', ['e1']);
      const teamB = makeMinimalTeam('TMB', []);
      const teamC = makeMinimalTeam('TMC', []);

      const payload = {
        teams: [
          {
            teamCode: 'TMA',
            sends: [],
            entitlementsOut: [{ id: 'e1' }], // No toTeamId = broadcast
          },
          {
            teamCode: 'TMB',
            sends: [],
            entitlementsOut: [],
          },
          {
            teamCode: 'TMC',
            sends: [],
            entitlementsOut: [],
          },
        ],
      };

      const currentState = {
        teams: [
          { teamCode: 'TMA', team: teamA },
          { teamCode: 'TMB', team: teamB },
          { teamCode: 'TMC', team: teamC },
        ],
      };

      const snapshot = buildPostTradeTeamsSnapshot({
        payload,
        currentState,
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      const postTradeA = snapshot.teamUpdates.find(
        (t) => t.teamCode === 'TMA'
      ).team;
      const postTradeB = snapshot.teamUpdates.find(
        (t) => t.teamCode === 'TMB'
      ).team;
      const postTradeC = snapshot.teamUpdates.find(
        (t) => t.teamCode === 'TMC'
      ).team;

      // Team A loses e1
      expect(postTradeA.entitlementIds).not.toContain('e1');

      // BOTH Team B and Team C should receive e1 (broadcast behavior)
      expect(postTradeB.entitlementIds).toContain('e1');
      expect(postTradeC.entitlementIds).toContain('e1');
    });

    it('should dedupe entitlementIds if same ID received from multiple sources', () => {
      // Edge case: If broadcast causes duplicates, they should be deduped
      const teamA = makeMinimalTeam('TMA', ['e1']);
      const teamB = makeMinimalTeam('TMB', ['e1']); // Already has e1!
      const teamC = makeMinimalTeam('TMC', []);

      const payload = {
        teams: [
          {
            teamCode: 'TMA',
            sends: [],
            entitlementsOut: [{ id: 'e1' }],
          },
          {
            teamCode: 'TMB',
            sends: [],
            entitlementsOut: [],
          },
          {
            teamCode: 'TMC',
            sends: [],
            entitlementsOut: [],
          },
        ],
      };

      const currentState = {
        teams: [
          { teamCode: 'TMA', team: teamA },
          { teamCode: 'TMB', team: teamB },
          { teamCode: 'TMC', team: teamC },
        ],
      };

      const snapshot = buildPostTradeTeamsSnapshot({
        payload,
        currentState,
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      const postTradeB = snapshot.teamUpdates.find(
        (t) => t.teamCode === 'TMB'
      ).team;

      // B should have e1 exactly ONCE (deduped)
      const e1Count = postTradeB.entitlementIds.filter(
        (id) => id === 'e1'
      ).length;
      expect(e1Count).toBe(1);
    });
  });

  describe('Test 4: Edge Cases', () => {
    it('should handle empty entitlementsOut gracefully', () => {
      const teamA = makeMinimalTeam('TMA', ['e1', 'e2']);
      const teamB = makeMinimalTeam('TMB', ['e3']);

      const payload = {
        teams: [
          { teamCode: 'TMA', sends: [], entitlementsOut: [] },
          { teamCode: 'TMB', sends: [], entitlementsOut: [] },
        ],
      };

      const currentState = {
        teams: [
          { teamCode: 'TMA', team: teamA },
          { teamCode: 'TMB', team: teamB },
        ],
      };

      const snapshot = buildPostTradeTeamsSnapshot({
        payload,
        currentState,
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      const postTradeA = snapshot.teamUpdates.find(
        (t) => t.teamCode === 'TMA'
      ).team;
      const postTradeB = snapshot.teamUpdates.find(
        (t) => t.teamCode === 'TMB'
      ).team;

      // No changes - all entitlements should remain
      expect(postTradeA.entitlementIds).toEqual(['e1', 'e2']);
      expect(postTradeB.entitlementIds).toEqual(['e3']);
    });

    it('should handle missing entitlementsOut field gracefully', () => {
      const teamA = makeMinimalTeam('TMA', ['e1']);
      const teamB = makeMinimalTeam('TMB', ['e2']);

      const payload = {
        teams: [
          { teamCode: 'TMA', sends: [] }, // No entitlementsOut field
          { teamCode: 'TMB', sends: [] },
        ],
      };

      const currentState = {
        teams: [
          { teamCode: 'TMA', team: teamA },
          { teamCode: 'TMB', team: teamB },
        ],
      };

      const snapshot = buildPostTradeTeamsSnapshot({
        payload,
        currentState,
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      // Should not throw, entitlements unchanged
      expect(snapshot.teamUpdates).toHaveLength(2);
    });

    it('should use entitlementId field if id is not present', () => {
      // Some code paths use entitlementId instead of id
      const teamA = makeMinimalTeam('TMA', ['e1']);
      const teamB = makeMinimalTeam('TMB', []);

      const payload = {
        teams: [
          {
            teamCode: 'TMA',
            sends: [],
            entitlementsOut: [{ entitlementId: 'e1' }], // Uses entitlementId, not id
          },
          { teamCode: 'TMB', sends: [], entitlementsOut: [] },
        ],
      };

      const currentState = {
        teams: [
          { teamCode: 'TMA', team: teamA },
          { teamCode: 'TMB', team: teamB },
        ],
      };

      const snapshot = buildPostTradeTeamsSnapshot({
        payload,
        currentState,
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      const postTradeA = snapshot.teamUpdates.find(
        (t) => t.teamCode === 'TMA'
      ).team;
      const postTradeB = snapshot.teamUpdates.find(
        (t) => t.teamCode === 'TMB'
      ).team;

      // Should still work with entitlementId field
      expect(postTradeA.entitlementIds).not.toContain('e1');
      expect(postTradeB.entitlementIds).toContain('e1');
    });
  });
});
