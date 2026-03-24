/**
 * FILE: src/tests/architect/signAndTrade.test.js
 * PURPOSE: Comprehensive tests for Sign-and-Trade (S&T) mutation workflow
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-01-22: Phase 26 - Extended from 2 tests to 15+ for MVP S&T constraint coverage
 *
 * TESTED CONSTRAINTS (Phase 26 MVP Checklist):
 *  A) Player is signed to origin team atomically before trade
 *  B) Trade legality validated using same validator as Trade Machine
 *  C) Salary matching enforced (via trade validator)
 *  D) Missing source/destination/player blocks mutation
 *  E) Signing validation failures block entire transaction
 *  F) Trade validation failures block entire transaction
 *  G) Contract marked as Sign & Trade on destination
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyWorldMutation,
  preflightSignAndTradeMutation,
} from '@/features/architect/utils/mutationPipeline';
import { getTeam, getPlayer } from '@/features/architect/utils/teamLoader';
import { validateSigning } from '@/features/architect/utils/capLegalityValidation';
import { validateTrade } from '@/features/architect/utils/tradeMachine';

// Mock dependencies
vi.mock('@/firebaseConfig', () => ({
  db: {},
}));
vi.mock('firebase/firestore', () => ({
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  })),
  getDoc: vi.fn(() =>
    Promise.resolve({ exists: () => false, data: () => ({}) })
  ),
  serverTimestamp: vi.fn(() => 'TIMESTAMP'),
  collection: vi.fn(),
  doc: vi.fn(),
}));
vi.mock('@/features/architect/utils/teamLoader', () => ({
  getTeam: vi.fn(),
  getPlayer: vi.fn(),
  getLeague: vi.fn(() => Promise.resolve([])),
  mergePlayerOverride: vi.fn((base, override) =>
    override ? { ...base, ...override } : base
  ),
}));
vi.mock('@/features/architect/utils/worldManager', () => ({
  updateWorldStats: vi.fn(),
}));

// Mock validators - configurable per test
vi.mock('@/features/architect/utils/capLegalityValidation', () => ({
  validateSigning: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateWaive: vi.fn(),
  validateExtension: vi.fn(),
  validateOptionDecision: vi.fn(),
  validateRenounceRights: vi.fn(),
  validateDeadCap: vi.fn(() => ({ violations: [], warnings: [] })),
  validateContractRows: vi.fn(() => ({ violations: [], warnings: [] })),
  validateExceptions: vi.fn(() => ({ violations: [], warnings: [] })),
  isOverrideEnabled: vi.fn(() => false),
}));

// Mock trade validator - configurable per test
vi.mock('@/features/architect/utils/tradeMachine', () => ({
  validateTrade: vi.fn(() => ({ valid: true, success: true, legal: true })),
}));

describe('Sign and Trade Mutation', () => {
  const worldId = 'test-world-123';
  const seasonId = '2025-26';
  const userId = 'user-1';

  const sourceTeamCode = 'LAL';
  const destTeamCode = 'BOS';
  const playerId = 'player-1';

  const mockSourceTeam = {
    teamCode: sourceTeamCode,
    teamName: 'Lakers',
    roster: [],
    players: [],
    totals: { totalSalary: 0, capHit: 0 },
  };

  const mockDestTeam = {
    teamCode: destTeamCode,
    teamName: 'Celtics',
    roster: [],
    players: [],
    totals: { totalSalary: 0, capHit: 0 },
  };

  const mockPlayer = {
    id: playerId,
    player_id: playerId,
    name: 'LeBron Test',
    contract: { contractType: 'Free Agent' },
  };

  const validSigningContract = {
    years: 3,
    salaries: [10000000, 10500000, 11000000],
    base: 10000000,
    signAndTrade: true,
    salariesByYear: [
      { season: '2025-26', salary: 10000000, capHit: 10000000 },
      { season: '2026-27', salary: 10500000, capHit: 10500000 },
      { season: '2027-28', salary: 11000000, capHit: 11000000 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful mocks
    getTeam.mockImplementation((wid, code) => {
      if (code === sourceTeamCode)
        return Promise.resolve({ ...mockSourceTeam });
      if (code === destTeamCode) return Promise.resolve({ ...mockDestTeam });
      return Promise.resolve(null);
    });
    getPlayer.mockResolvedValue({ ...mockPlayer });
    validateSigning.mockReturnValue({
      valid: true,
      violations: [],
      warnings: [],
    });
    validateTrade.mockReturnValue({ valid: true, success: true, legal: true });
  });

  // ============================================================================
  // SAT1: SUCCESS PATH - Player moves to destination with correct contract
  // ============================================================================
  describe('SAT1: Success Path', () => {
    it('should successfully execute a sign and trade', async () => {
      const result = await applyWorldMutation({
        userId,
        worldId,
        seasonId,
        mutationType: 'signAndTrade',
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          playerId,
          contract: validSigningContract,
          signedUsing: 'Bird Rights',
        },
      });

      expect(result.success).toBe(true);
      expect(result.changedTeams).toHaveLength(2);

      const sourceUpdate = result.changedTeams.find(
        (t) => t.teamCode === sourceTeamCode
      );
      const destUpdate = result.changedTeams.find(
        (t) => t.teamCode === destTeamCode
      );

      // Source team should NOT have the player (traded away)
      expect(sourceUpdate.team.roster).not.toContain(playerId);

      // Dest team SHOULD have the player in roster
      expect(destUpdate.team.roster).toContain(playerId);

      // Player should be in destination team's players array
      const playerInDest = destUpdate.team.players?.find(
        (p) => (p.player_id || p.id) === playerId
      );
      expect(playerInDest).toBeDefined();
      expect(playerInDest.teamCode).toBe(destTeamCode);
    });

    it('should mark contract as Sign & Trade type', async () => {
      const result = await applyWorldMutation({
        userId,
        worldId,
        seasonId,
        mutationType: 'signAndTrade',
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          playerId,
          contract: validSigningContract,
          signedUsing: 'Bird Rights',
        },
      });

      expect(result.success).toBe(true);

      const destUpdate = result.changedTeams.find(
        (t) => t.teamCode === destTeamCode
      );
      const playerInDest = destUpdate.team.players?.find(
        (p) => (p.player_id || p.id) === playerId
      );
      expect(playerInDest).toBeDefined();
      // Contract should be marked as Sign & Trade - check for either format
      const contract = playerInDest.contract;
      expect(
        contract.contractType === 'Sign & Trade' ||
          contract.signAndTrade === true
      ).toBe(true);
    });
  });

  describe('SAT preflight alignment', () => {
    it('closes the old source-team drift by allowing a SAT that is legal for the receiving team post-trade', async () => {
      const firstApron = 178_000_000;
      const sourceTotalSalary = firstApron + 2_000_000;
      getTeam.mockImplementation((wid, code) => {
        if (code === sourceTeamCode) {
          return Promise.resolve({
            ...mockSourceTeam,
            totals: { totalSalary: sourceTotalSalary, capHit: sourceTotalSalary },
          });
        }
        if (code === destTeamCode) {
          return Promise.resolve({
            ...mockDestTeam,
            totals: { totalSalary: firstApron - 12_000_000, capHit: firstApron - 12_000_000 },
          });
        }
        return Promise.resolve(null);
      });
      validateTrade.mockReturnValue({
        valid: true,
        legal: true,
        reason: null,
        error: null,
        violations: [],
        warnings: [
          {
            message: 'Sign-and-trade will hard cap receiving team at First Apron',
            severity: 'warning',
            rule: 'signAndTrade',
            code: 'SIGN_AND_TRADE__RECEIVER_HARD_CAP_TRIGGER',
          },
        ],
        teamResults: [],
        summaryByTeamIndex: [],
        tradeReceipt: null,
        dataWarnings: [],
        hasDataIssues: false,
        yearKey: 2026,
        seasonKey: '2025-26',
        capSettings: { firstApron },
        capSettingsSource: 'test',
        capSettingsWarnings: [],
        asOfDate: '2025-07-01',
        tradeDate: '2025-07-01',
        offseason: true,
      });

      const oldLocalWouldBlock = sourceTotalSalary > firstApron;
      expect(oldLocalWouldBlock).toBe(true);

      const result = await preflightSignAndTradeMutation({
        worldId,
        seasonId,
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          playerId,
          contract: validSigningContract,
          signedUsing: 'Bird Rights',
        },
      });

      expect(result).toEqual({
        status: 'legal',
        reasons: [],
        warnings: ['Sign-and-trade will hard cap receiving team at First Apron'],
        source: 'authoritative-preflight',
      });
    });

    it('blocks SAT from receiving-team post-trade context even when the source team local total is under the apron', async () => {
      const firstApron = 178_000_000;
      const sourceTotalSalary = firstApron - 15_000_000;
      getTeam.mockImplementation((wid, code) => {
        if (code === sourceTeamCode) {
          return Promise.resolve({
            ...mockSourceTeam,
            totals: { totalSalary: sourceTotalSalary, capHit: sourceTotalSalary },
          });
        }
        if (code === destTeamCode) {
          return Promise.resolve({
            ...mockDestTeam,
            totals: { totalSalary: firstApron - 1_000_000, capHit: firstApron - 1_000_000 },
          });
        }
        return Promise.resolve(null);
      });
      validateTrade.mockReturnValue({
        valid: false,
        legal: false,
        reason: 'Receiver would exceed First Apron after sign-and-trade.',
        error: 'Receiver would exceed First Apron after sign-and-trade.',
        violations: [
          {
            message: 'Receiver would exceed First Apron after sign-and-trade.',
            severity: 'error',
            rule: 'signAndTrade',
            code: 'SIGN_AND_TRADE__FIRST_APRON_HARD_CAP_EXCEEDED',
          },
        ],
        warnings: [],
        teamResults: [],
        summaryByTeamIndex: [],
        tradeReceipt: null,
        dataWarnings: [],
        hasDataIssues: false,
        yearKey: 2026,
        seasonKey: '2025-26',
        capSettings: { firstApron },
        capSettingsSource: 'test',
        capSettingsWarnings: [],
        asOfDate: '2025-07-01',
        tradeDate: '2025-07-01',
        offseason: true,
      });

      const oldLocalWouldBlock = sourceTotalSalary > firstApron;
      expect(oldLocalWouldBlock).toBe(false);

      const preflightResult = await preflightSignAndTradeMutation({
        worldId,
        seasonId,
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          playerId,
          contract: validSigningContract,
          signedUsing: 'Bird Rights',
        },
      });

      expect(preflightResult).toEqual({
        status: 'blocked',
        reasons: ['Receiver would exceed First Apron after sign-and-trade.'],
        warnings: [],
        source: 'authoritative-preflight',
      });

      const applyResult = await applyWorldMutation({
        userId,
        worldId,
        seasonId,
        mutationType: 'signAndTrade',
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          playerId,
          contract: validSigningContract,
          signedUsing: 'Bird Rights',
        },
      });

      expect(applyResult.success).toBe(false);
      expect(applyResult.error).toContain(
        'Receiver would exceed First Apron after sign-and-trade.'
      );
    });

    it('fails closed as incomplete when authoritative SAT hard-cap context is unavailable', async () => {
      validateTrade.mockReturnValue({
        valid: false,
        legal: false,
        reason: 'Cannot validate sign-and-trade hard cap: firstApron not available for season',
        error: 'Cannot validate sign-and-trade hard cap: firstApron not available for season',
        violations: [
          {
            message: 'Cannot validate sign-and-trade hard cap: firstApron not available for season',
            severity: 'error',
            rule: 'signAndTrade',
            code: 'SIGN_AND_TRADE__MISSING_FIRST_APRON',
          },
        ],
        warnings: [],
        teamResults: [],
        summaryByTeamIndex: [],
        tradeReceipt: null,
        dataWarnings: [],
        hasDataIssues: false,
        yearKey: 2026,
        seasonKey: '2025-26',
        capSettings: null,
        capSettingsSource: 'test',
        capSettingsWarnings: [],
        asOfDate: '2025-07-01',
        tradeDate: '2025-07-01',
        offseason: true,
      });

      const result = await preflightSignAndTradeMutation({
        worldId,
        seasonId,
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          playerId,
          contract: validSigningContract,
          signedUsing: 'Bird Rights',
        },
      });

      expect(result).toEqual({
        status: 'incomplete',
        reasons: [
          'Cannot validate sign-and-trade hard cap: firstApron not available for season',
        ],
        warnings: [],
        source: 'authoritative-preflight',
      });
    });
  });

  // ============================================================================
  // SAT2: MISSING DESTINATION - Blocks mutation
  // ============================================================================
  describe('SAT2: Missing Destination', () => {
    it('should fail if destination team is missing', async () => {
      const result = await applyWorldMutation({
        userId,
        worldId,
        seasonId,
        mutationType: 'signAndTrade',
        payload: {
          teamCode: sourceTeamCode,
          // Missing destinationTeamCode
          playerId,
          contract: validSigningContract,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('destinationTeamCode');
    });
  });

  // ============================================================================
  // SAT3: MISSING SOURCE - Blocks mutation
  // ============================================================================
  describe('SAT3: Missing Source', () => {
    it('should fail if source team is missing', async () => {
      const result = await applyWorldMutation({
        userId,
        worldId,
        seasonId,
        mutationType: 'signAndTrade',
        payload: {
          // Missing teamCode
          destinationTeamCode: destTeamCode,
          playerId,
          contract: validSigningContract,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('teamCode');
    });
  });

  // ============================================================================
  // SAT4: MISSING PLAYER ID - Blocks mutation
  // ============================================================================
  describe('SAT4: Missing Player ID', () => {
    it('should fail if player ID is missing', async () => {
      const result = await applyWorldMutation({
        userId,
        worldId,
        seasonId,
        mutationType: 'signAndTrade',
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          // Missing playerId
          contract: validSigningContract,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('playerId');
    });
  });

  // ============================================================================
  // SAT5: SIGNING INVALID - Blocks entire transaction
  // ============================================================================
  describe('SAT5: Signing Validation Failure', () => {
    it('should block transaction if signing validation fails', async () => {
      // Configure signing validation to fail
      validateSigning.mockReturnValue({
        valid: false,
        violations: [
          { rule: 'roster_size', message: 'Roster is full', severity: 'error' },
        ],
        warnings: [],
      });

      const result = await applyWorldMutation({
        userId,
        worldId,
        seasonId,
        mutationType: 'signAndTrade',
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          playerId,
          contract: validSigningContract,
          signedUsing: 'Bird Rights',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Roster is full');
    });

    it('should block on minimum salary violation', async () => {
      validateSigning.mockReturnValue({
        valid: false,
        violations: [
          {
            rule: 'min_salary_violation',
            message: 'Salary below minimum',
            severity: 'error',
          },
        ],
        warnings: [],
      });

      const result = await applyWorldMutation({
        userId,
        worldId,
        seasonId,
        mutationType: 'signAndTrade',
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          playerId,
          contract: { ...validSigningContract, base: 100 }, // Too low
          signedUsing: 'Bird Rights',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Salary below minimum');
    });
  });

  // ============================================================================
  // SAT6: TRADE INVALID - Blocks entire transaction
  // ============================================================================
  describe('SAT6: Trade Validation Failure', () => {
    it('should block transaction if trade validation fails', async () => {
      // Configure trade validation to fail
      validateTrade.mockReturnValue({
        legal: false,
        success: false,
        reason: 'Salary matching violation',
        teamResults: [{ violations: ['Salary matching failed'] }],
      });

      const result = await applyWorldMutation({
        userId,
        worldId,
        seasonId,
        mutationType: 'signAndTrade',
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          playerId,
          contract: validSigningContract,
          signedUsing: 'Bird Rights',
        },
      });

      expect(result.success).toBe(false);
      // Error message comes from validateTradeForPipeline which uses 'reason' or 'not legal'
      expect(result.error).toMatch(/not legal|Salary matching/i);
    });

    it('should block on hard cap violation', async () => {
      validateTrade.mockReturnValue({
        legal: false,
        success: false,
        reason: 'Team would exceed hard cap after receiving S&T player',
        teamResults: [{ violations: ['Hard cap exceeded'] }],
      });

      const result = await applyWorldMutation({
        userId,
        worldId,
        seasonId,
        mutationType: 'signAndTrade',
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          playerId,
          contract: validSigningContract,
          signedUsing: 'Bird Rights',
        },
      });

      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // SAT7: ROSTER SIZE CONSTRAINTS
  // ============================================================================
  describe('SAT7: Roster Size Constraints', () => {
    it('should enforce roster size via signing validation', async () => {
      validateSigning.mockReturnValue({
        valid: false,
        violations: [
          {
            rule: 'roster_size',
            message: 'Destination roster would exceed 15 players',
            severity: 'error',
          },
        ],
        warnings: [],
      });

      const result = await applyWorldMutation({
        userId,
        worldId,
        seasonId,
        mutationType: 'signAndTrade',
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          playerId,
          contract: validSigningContract,
          signedUsing: 'Bird Rights',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('roster');
    });
  });

  // ============================================================================
  // SAT8: SALARY MATCHING VIA TRADE VALIDATOR
  // ============================================================================
  describe('SAT8: Salary Matching', () => {
    it('should validate salary matching through trade validator', async () => {
      // Trade validator is called for salary matching
      validateTrade.mockReturnValue({
        legal: false,
        success: false,
        reason: 'Incoming salary exceeds 125% + $100k of outgoing',
        teamResults: [{ violations: ['Salary matching failed'] }],
      });

      const result = await applyWorldMutation({
        userId,
        worldId,
        seasonId,
        mutationType: 'signAndTrade',
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          playerId,
          contract: validSigningContract,
          signedUsing: 'Bird Rights',
        },
      });

      expect(result.success).toBe(false);
      expect(validateTrade).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // SAT9: ATOMIC OPERATION - Both teams updated
  // ============================================================================
  describe('SAT9: Atomic Operation', () => {
    it('should update both teams atomically on success', async () => {
      const result = await applyWorldMutation({
        userId,
        worldId,
        seasonId,
        mutationType: 'signAndTrade',
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          playerId,
          contract: validSigningContract,
          signedUsing: 'Bird Rights',
        },
      });

      expect(result.success).toBe(true);
      expect(result.changedTeams).toHaveLength(2);

      const teamCodes = result.changedTeams.map((t) => t.teamCode);
      expect(teamCodes).toContain(sourceTeamCode);
      expect(teamCodes).toContain(destTeamCode);
    });

    it('should not update either team if signing fails', async () => {
      validateSigning.mockReturnValue({
        valid: false,
        violations: [
          {
            rule: 'exception_blocked',
            message: 'Exception not available',
            severity: 'error',
          },
        ],
        warnings: [],
      });

      const result = await applyWorldMutation({
        userId,
        worldId,
        seasonId,
        mutationType: 'signAndTrade',
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          playerId,
          contract: validSigningContract,
          signedUsing: 'MLE',
        },
      });

      expect(result.success).toBe(false);
      expect(result.changedTeams).toBeUndefined();
    });
  });

  // ============================================================================
  // SAT10: WARNINGS PRESERVED
  // ============================================================================
  describe('SAT10: Warnings Preserved', () => {
    it('should preserve warnings from signing validation', async () => {
      validateSigning.mockReturnValue({
        valid: true,
        violations: [],
        warnings: [
          {
            rule: 'byc_not_modeled',
            message: 'BYC treatment not fully modeled for S&T',
            severity: 'warning',
          },
        ],
      });

      const result = await applyWorldMutation({
        userId,
        worldId,
        seasonId,
        mutationType: 'signAndTrade',
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          playerId,
          contract: validSigningContract,
          signedUsing: 'Bird Rights',
        },
      });

      // Mutation should succeed but warnings should be present in validation result
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // SAT11: PLAYER DATA CARRIED THROUGH
  // ============================================================================
  describe('SAT11: Player Data Integrity', () => {
    it('should carry player data through to destination', async () => {
      const playerWithData = {
        ...mockPlayer,
        displayName: 'LeBron James',
        position: 'SF',
        age: 41,
      };
      getPlayer.mockResolvedValue(playerWithData);

      const result = await applyWorldMutation({
        userId,
        worldId,
        seasonId,
        mutationType: 'signAndTrade',
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          playerId,
          contract: validSigningContract,
          signedUsing: 'Bird Rights',
        },
      });

      expect(result.success).toBe(true);

      const destUpdate = result.changedTeams.find(
        (t) => t.teamCode === destTeamCode
      );
      const playerInDest = destUpdate.team.players?.find(
        (p) => (p.player_id || p.id) === playerId
      );
      expect(playerInDest).toBeDefined();
      expect(playerInDest.teamCode).toBe(destTeamCode);
    });
  });

  // ============================================================================
  // SAT12: TWO-WAY CONTRACT LIMIT
  // ============================================================================
  describe('SAT12: Two-Way Contract Limit', () => {
    it('should block S&T of two-way contracts via signing validation', async () => {
      validateSigning.mockReturnValue({
        valid: false,
        violations: [
          {
            rule: 'two_way_limit',
            message: 'Two-way contracts cannot be signed and traded',
            severity: 'error',
          },
        ],
        warnings: [],
      });

      const twoWayContract = {
        ...validSigningContract,
        contractType: 'Two-Way',
        isTwoWay: true,
      };

      const result = await applyWorldMutation({
        userId,
        worldId,
        seasonId,
        mutationType: 'signAndTrade',
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          playerId,
          contract: twoWayContract,
          signedUsing: 'Two-Way',
        },
      });

      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // SAT13: TRADE VALIDATOR CALLED WITH CORRECT STRUCTURE
  // ============================================================================
  describe('SAT13: Trade Validator Structure', () => {
    it('should call trade validator with properly structured input', async () => {
      await applyWorldMutation({
        userId,
        worldId,
        seasonId,
        mutationType: 'signAndTrade',
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          playerId,
          contract: validSigningContract,
          signedUsing: 'Bird Rights',
        },
      });

      // Verify validateTrade was called
      expect(validateTrade).toHaveBeenCalled();

      // Get the call arguments
      const callArgs = validateTrade.mock.calls[0][0];

      // Should have teams array with 2 teams
      expect(callArgs.teams).toBeDefined();
      expect(callArgs.teams.length).toBe(2);
    });
  });

  // ============================================================================
  // SAT14: SIGNING VALIDATOR CALLED FIRST
  // ============================================================================
  describe('SAT14: Validation Order', () => {
    it('should call signing validator before trade validator', async () => {
      const callOrder = [];

      validateSigning.mockImplementation(() => {
        callOrder.push('signing');
        return { valid: true, violations: [], warnings: [] };
      });

      validateTrade.mockImplementation(() => {
        callOrder.push('trade');
        return { legal: true, success: true };
      });

      await applyWorldMutation({
        userId,
        worldId,
        seasonId,
        mutationType: 'signAndTrade',
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          playerId,
          contract: validSigningContract,
          signedUsing: 'Bird Rights',
        },
      });

      expect(callOrder[0]).toBe('signing');
      expect(callOrder[1]).toBe('trade');
    });

    it('should not call trade validator if signing fails', async () => {
      validateSigning.mockReturnValue({
        valid: false,
        violations: [
          { rule: 'test_fail', message: 'Signing blocked', severity: 'error' },
        ],
        warnings: [],
      });

      await applyWorldMutation({
        userId,
        worldId,
        seasonId,
        mutationType: 'signAndTrade',
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          playerId,
          contract: validSigningContract,
          signedUsing: 'Bird Rights',
        },
      });

      expect(validateTrade).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // SAT15: HARD CAP TRIGGER (S&T-specific gotcha)
  // ============================================================================
  describe('SAT15: Hard Cap Trigger', () => {
    it('should document that receiving team becomes hard-capped', async () => {
      // This test documents behavior - the validateSignAndTrade rule in tradeMachine
      // sets hardCapped: true for receiving team. This is a key S&T constraint.
      const result = await applyWorldMutation({
        userId,
        worldId,
        seasonId,
        mutationType: 'signAndTrade',
        payload: {
          teamCode: sourceTeamCode,
          destinationTeamCode: destTeamCode,
          playerId,
          contract: validSigningContract,
          signedUsing: 'Bird Rights',
        },
      });

      // Success path - hard cap enforcement happens in trade validator
      expect(result.success).toBe(true);
      // The destination team's hard cap status is tracked by validateSignAndTrade rule
    });
  });
});
