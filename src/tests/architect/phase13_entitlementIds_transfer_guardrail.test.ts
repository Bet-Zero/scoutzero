/**
 * FILE: src/tests/architect/phase13_entitlementIds_transfer_guardrail.test.js
 * PURPOSE: Guardrail tests for Phase 13 - entitlementIds transfer correctness (SSOT).
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * HISTORY:
 *   - 2026-02-01: Created for Phase 13 - Entitlements SSOT Validation
 *   - 2026-02-04: Phase A - Updated 3-team tests to reflect Phase 17 routing rules
 *                 (3+ team trades require explicit toTeamId - no broadcast)
 *
 * LINKS:
 *   - docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 13)
 *   - src/features/architect/utils/tradeContext/tradeContext.js
 *
 * TESTS:
 *   1. 2-team trade: team A sends entitlement e1 → team B receives e1
 *   2. 3-team trade with toTeamId routing: e1→B, e2→C (routed)
 *   3. 3-team trade without toTeamId: unrouted entitlement is SKIPPED (Phase 17 rule)
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
      const teamA = makeMinimalTeam('TMA', ['e1', 'e2']);
      const teamB = makeMinimalTeam('TMB', ['e3']);

      const payload = {
        teams: [
          {
            teamCode: 'TMA',
            sends: [],
            entitlementsOut: [{ id: 'e1', entitlementId: 'e1' }],
          },
          {
            teamCode: 'TMB',
            sends: [],
            entitlementsOut: [],
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

      expect(postTradeA.entitlementIds).not.toContain('e1');
      expect(postTradeA.entitlementIds).toContain('e2');
      expect(postTradeB.entitlementIds).toContain('e1');
      expect(postTradeB.entitlementIds).toContain('e3');
    });

    it('should handle bidirectional entitlement exchange', () => {
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

      expect(postTradeA.entitlementIds).toContain('e2');
      expect(postTradeA.entitlementIds).not.toContain('e1');
      expect(postTradeB.entitlementIds).toContain('e1');
      expect(postTradeB.entitlementIds).not.toContain('e2');
    });
  });

  describe('Test 2: 3-Team Trade - Routed Entitlements (toTeamId)', () => {
    it('should route entitlements to specified toTeamId only', () => {
      const teamA = makeMinimalTeam('TMA', ['e1', 'e2', 'e3']);
      const teamB = makeMinimalTeam('TMB', ['e4']);
      const teamC = makeMinimalTeam('TMC', ['e5']);

      const payload = {
        teams: [
          {
            teamCode: 'TMA',
            sends: [],
            entitlementsOut: [
              { id: 'e1', toTeamId: 'TMB' },
              { id: 'e2', toTeamId: 'TMC' },
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

      expect(postTradeA.entitlementIds).not.toContain('e1');
      expect(postTradeA.entitlementIds).not.toContain('e2');
      expect(postTradeA.entitlementIds).toContain('e3');
      expect(postTradeB.entitlementIds).toContain('e1');
      expect(postTradeB.entitlementIds).not.toContain('e2');
      expect(postTradeB.entitlementIds).toContain('e4');
      expect(postTradeC.entitlementIds).toContain('e2');
      expect(postTradeC.entitlementIds).not.toContain('e1');
      expect(postTradeC.entitlementIds).toContain('e5');
    });

    it('should handle mixed routed and unrouted in same trade (Phase 17: unrouted skipped)', () => {
      // Phase 17 rule: In 3+ team trades, unrouted entitlements are SKIPPED (no broadcast)
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
              { id: 'e2' }, // No toTeamId = SKIPPED in 3-team trade
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

      // Team A loses e1 (routed) but e2 is removed from sender even though skipped
      expect(postTradeA.entitlementIds).not.toContain('e1');
      expect(postTradeA.entitlementIds).not.toContain('e2');

      // Team B gets ONLY e1 (routed), NOT e2 (unrouted not broadcast)
      expect(postTradeB.entitlementIds).toContain('e1');
      expect(postTradeB.entitlementIds).not.toContain('e2');

      // Team C gets NOTHING (e1 routed to B, e2 skipped)
      expect(postTradeC.entitlementIds).not.toContain('e1');
      expect(postTradeC.entitlementIds).not.toContain('e2');
    });
  });

  describe('Test 3: 3-Team Trade - Unrouted Entitlements (Phase 17 Behavior)', () => {
    it('should NOT broadcast unrouted entitlement in 3+ team trade (Phase 17 rule)', () => {
      // Phase 17: 3+ team trades require explicit toTeamId - unrouted entitlements are skipped
      const teamA = makeMinimalTeam('TMA', ['e1']);
      const teamB = makeMinimalTeam('TMB', []);
      const teamC = makeMinimalTeam('TMC', []);

      const payload = {
        teams: [
          {
            teamCode: 'TMA',
            sends: [],
            entitlementsOut: [{ id: 'e1' }], // No toTeamId = SKIPPED
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

      // Team A loses e1 (it's in entitlementsOut)
      expect(postTradeA.entitlementIds).not.toContain('e1');

      // Neither B nor C receives e1 (no toTeamId in 3-team trade = skipped)
      expect(postTradeB.entitlementIds).not.toContain('e1');
      expect(postTradeC.entitlementIds).not.toContain('e1');
    });

    it('should dedupe entitlementIds if same ID received from multiple sources', () => {
      const teamA = makeMinimalTeam('TMA', ['e1']);
      const teamB = makeMinimalTeam('TMB', ['e1']); // Already has e1!
      const teamC = makeMinimalTeam('TMC', []);

      const payload = {
        teams: [
          {
            teamCode: 'TMA',
            sends: [],
            entitlementsOut: [{ id: 'e1', toTeamId: 'TMB' }], // Routed to B
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

      expect(postTradeA.entitlementIds).toEqual(['e1', 'e2']);
      expect(postTradeB.entitlementIds).toEqual(['e3']);
    });

    it('should handle missing entitlementsOut field gracefully', () => {
      const teamA = makeMinimalTeam('TMA', ['e1']);
      const teamB = makeMinimalTeam('TMB', ['e2']);

      const payload = {
        teams: [
          { teamCode: 'TMA', sends: [] },
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

      expect(snapshot.teamUpdates).toHaveLength(2);
    });

    it('should use entitlementId field if id is not present', () => {
      const teamA = makeMinimalTeam('TMA', ['e1']);
      const teamB = makeMinimalTeam('TMB', []);

      const payload = {
        teams: [
          {
            teamCode: 'TMA',
            sends: [],
            entitlementsOut: [{ entitlementId: 'e1' }],
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

      expect(postTradeA.entitlementIds).not.toContain('e1');
      expect(postTradeB.entitlementIds).toContain('e1');
    });
  });
});
