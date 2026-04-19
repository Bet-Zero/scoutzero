/**
 * FILE: src/tests/architect/phase17_entitlement_routing_guardrail.test.js
 * PURPOSE: Guardrail tests for Phase 17 - Entitlement Routing Closure
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * HISTORY:
 *   - 2026-02-03: Created for Phase 17 - Entitlement Routing Closure
 *
 * LINKS:
 *   - Audit: docs/architect/DRAFT_ASSET_TRADING_CLOSURE_AUDIT.md
 *   - Rule: src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting
 *
 * TESTS:
 *   1. 3-team trade: entitlement routed to exactly one team (no broadcast)
 *   2. Same entitlement in two outgoing lists → validator blocks
 *   3. Entitlement without destination in 3+ team → validator blocks
 *   4. Apply snapshot updates entitlementIds correctly (routed)
 *   5. 2-team trade: destination auto-default works
 *   6. Ownership validation: cannot trade entitlement you don't own
 */

import { describe, it, expect } from 'vitest';
import { validateEntitlementRouting } from '@/features/architect/utils/tradeMachine/rules/validateEntitlementRouting';
import { buildPostTradeTeamsSnapshot } from '@/features/architect/utils/mutationPipeline';

// ============================================================================
// Minimal Fixtures
// ============================================================================

const makeMinimalTeam = (teamCode, entitlementIds = []) => ({
  id: teamCode,
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

const makeTradeSlot = (
  teamCode,
  entitlementIds = [],
  entitlementsOut = []
) => ({
  team: makeMinimalTeam(teamCode, entitlementIds),
  sends: [],
  entitlementsOut,
});

// ============================================================================
// Test Suite: validateEntitlementRouting
// ============================================================================

describe('Phase 17: validateEntitlementRouting', () => {
  describe('Test 1: 3-team trade - requires explicit routing', () => {
    it('should pass when all entitlements have toTeamId in 3+ team trade', () => {
      const teams = [
        makeTradeSlot(
          'TMA',
          ['e1', 'e2'],
          [{ id: 'e1', entitlementId: 'e1', toTeamId: 'TMB' }]
        ),
        makeTradeSlot('TMB', ['e3']),
        makeTradeSlot('TMC', ['e4']),
      ];

      const result = validateEntitlementRouting({ teams });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when entitlement lacks toTeamId in 3+ team trade', () => {
      const teams = [
        makeTradeSlot(
          'TMA',
          ['e1', 'e2'],
          [
            { id: 'e1', entitlementId: 'e1' }, // No toTeamId
          ]
        ),
        makeTradeSlot('TMB', ['e3']),
        makeTradeSlot('TMC', ['e4']),
      ];

      const result = validateEntitlementRouting({ teams });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('no destination');
    });
  });

  describe('Test 2: Duplicate entitlement detection', () => {
    it('should fail when same entitlement is in two outgoing lists', () => {
      const teams = [
        makeTradeSlot(
          'TMA',
          ['e1'],
          [{ id: 'e1', entitlementId: 'e1', toTeamId: 'TMC' }]
        ),
        makeTradeSlot(
          'TMB',
          ['e1'],
          [
            // e1 is also selected by TMB (invalid)
            { id: 'e1', entitlementId: 'e1', toTeamId: 'TMC' },
          ]
        ),
        makeTradeSlot('TMC', ['e3']),
      ];

      const result = validateEntitlementRouting({ teams });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('selected by both');
    });
  });

  describe('Test 3: 2-team trade - toTeamId not required', () => {
    it('should pass when entitlement lacks toTeamId in 2-team trade', () => {
      const teams = [
        makeTradeSlot(
          'TMA',
          ['e1', 'e2'],
          [
            { id: 'e1', entitlementId: 'e1' }, // No toTeamId, but 2-team trade is fine
          ]
        ),
        makeTradeSlot('TMB', ['e3']),
      ];

      const result = validateEntitlementRouting({ teams });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Test 4: Invalid destination detection', () => {
    it('should fail when toTeamId is not a team in the trade', () => {
      const teams = [
        makeTradeSlot(
          'TMA',
          ['e1'],
          [
            { id: 'e1', entitlementId: 'e1', toTeamId: 'XXX' }, // XXX not in trade
          ]
        ),
        makeTradeSlot('TMB', ['e3']),
        makeTradeSlot('TMC', ['e4']),
      ];

      const result = validateEntitlementRouting({ teams });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('invalid destination');
    });

    it('should fail when toTeamId points to the sending team', () => {
      const teams = [
        makeTradeSlot(
          'TMA',
          ['e1'],
          [
            { id: 'e1', entitlementId: 'e1', toTeamId: 'TMA' }, // Self-routing
          ]
        ),
        makeTradeSlot('TMB', ['e3']),
        makeTradeSlot('TMC', ['e4']),
      ];

      const result = validateEntitlementRouting({ teams });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('cannot be routed to the same team');
    });
  });

  describe('Test 5: Ownership validation', () => {
    it('should fail when team trades entitlement it does not own', () => {
      const teams = [
        makeTradeSlot(
          'TMA',
          ['e2'], // Only owns e2, not e1
          [{ id: 'e1', entitlementId: 'e1', toTeamId: 'TMB' }] // Tries to trade e1
        ),
        makeTradeSlot('TMB', ['e3']),
        makeTradeSlot('TMC', ['e4']),
      ];

      const result = validateEntitlementRouting({ teams });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('not owned by');
    });
  });
});

// ============================================================================
// Test Suite: buildPostTradeTeamsSnapshot (Entitlement Transfer)
// ============================================================================

describe('Phase 17: buildPostTradeTeamsSnapshot - Entitlement Transfer', () => {
  describe('Test 1: 3-team trade - routed entitlements', () => {
    it('should route entitlement to specified toTeamId only', () => {
      const teamA = makeMinimalTeam('TMA', ['e1', 'e2']);
      const teamB = makeMinimalTeam('TMB', ['e3']);
      const teamC = makeMinimalTeam('TMC', ['e4']);

      const payload = {
        teams: [
          {
            teamCode: 'TMA',
            sends: [],
            entitlementsOut: [
              { id: 'e1', entitlementId: 'e1', toTeamId: 'TMB' },
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

      // Team A should no longer have e1
      expect(postTradeA.entitlementIds).not.toContain('e1');
      expect(postTradeA.entitlementIds).toContain('e2');

      // Team B should have e1
      expect(postTradeB.entitlementIds).toContain('e1');
      expect(postTradeB.entitlementIds).toContain('e3');

      // Team C should NOT have e1 (was routed to B, not broadcast)
      expect(postTradeC.entitlementIds).not.toContain('e1');
      expect(postTradeC.entitlementIds).toContain('e4');
    });
  });

  describe('Test 2: 2-team trade - broadcast fallback', () => {
    it('should transfer entitlement to other team without toTeamId', () => {
      const teamA = makeMinimalTeam('TMA', ['e1', 'e2']);
      const teamB = makeMinimalTeam('TMB', ['e3']);

      const payload = {
        teams: [
          {
            teamCode: 'TMA',
            sends: [],
            entitlementsOut: [
              { id: 'e1', entitlementId: 'e1' }, // No toTeamId
            ],
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

      // Team A should no longer have e1
      expect(postTradeA.entitlementIds).not.toContain('e1');
      expect(postTradeA.entitlementIds).toContain('e2');

      // Team B should have e1 (broadcast in 2-team trade)
      expect(postTradeB.entitlementIds).toContain('e1');
      expect(postTradeB.entitlementIds).toContain('e3');
    });
  });
});
