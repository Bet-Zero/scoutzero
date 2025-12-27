/**
 * Golden Regression Tests for Trade Validation
 * 
 * Purpose: Lock down critical trade math behaviors so that future changes
 * don't inadvertently break working functionality.
 * 
 * Coverage:
 * 1. Salary matching tiers (Bands 1-3) at boundaries
 * 2. BYC outgoing matching value calculation
 * 3. First/Second apron 100% matching restrictions
 * 4. Second apron aggregation rule restriction
 * 5. Under-cap absorption logic
 * 6. Trade receipt/validator consistency checks
 */
import { describe, it, expect } from 'vitest';
import {
  getSalaryMatchingResult,
  validateIncomingSalary,
  SALARY_MATCHING_TIERS,
  SALARY_MATCHING_RULE_KEYS,
} from '@/features/architect/utils/tradeMachine/index.js';
import { computeMatchingValues } from '@/features/architect/utils/tradeMachine/utils/matchingValues.js';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator.js';
import capProjections from '@/features/architect/utils/capProjections.js';

// Standard cap settings for 2024-25 season
const DEFAULT_CAP_SETTINGS = {
  salaryCap: 141_000_000,
  firstApron: 178_132_000,
  secondApron: 188_931_000,
};

const currentYear = 2025;
const season = `${currentYear - 1}-${String(currentYear).slice(-2)}`;

// Helper to create a player with salary
const makePlayer = (name, salary, extras = {}) => ({
  name,
  contract: { salariesByYear: [{ season, salary }] },
  ...extras,
});

// Helper to create a team
const makeTeam = (name, totalSalary, rosterSize = 14, extras = {}) => ({
  teamName: name,
  totalSalary,
  players: Array.from({ length: rosterSize }, (_, i) =>
    makePlayer(`${name}${i}`, 1_000_000)
  ),
  picks: [],
  ...extras,
});

describe('Golden Trade Regression Tests', () => {
  describe('Salary Matching Tier Boundaries', () => {
    it('GOLDEN-01: Band 1 boundary at $6.5M yields 200% + $250k', () => {
      const result = getSalaryMatchingResult({
        teamTotalSalary: 150_000_000, // over cap, below apron
        outgoingSalary: SALARY_MATCHING_TIERS.TIER_1_THRESHOLD, // exactly $6.5M
        capSettings: DEFAULT_CAP_SETTINGS,
      });

      // 6.5M * 2.0 + 250k = 13.25M
      expect(result.ruleKey).toBe(SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_1);
      expect(result.allowableIncoming).toBe(13_250_000);
    });

    it('GOLDEN-02: Band 2 boundary at $19.6M yields outgoing + $7.5M', () => {
      const result = getSalaryMatchingResult({
        teamTotalSalary: 150_000_000,
        outgoingSalary: SALARY_MATCHING_TIERS.TIER_2_THRESHOLD, // exactly $19.6M
        capSettings: DEFAULT_CAP_SETTINGS,
      });

      // 19.6M + 7.5M = 27.1M
      expect(result.ruleKey).toBe(SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_2);
      expect(result.allowableIncoming).toBe(27_100_000);
    });

    it('GOLDEN-03: Band 3 for $25M outgoing yields 125% + $250k', () => {
      const result = getSalaryMatchingResult({
        teamTotalSalary: 150_000_000,
        outgoingSalary: 25_000_000, // above $19.6M
        capSettings: DEFAULT_CAP_SETTINGS,
      });

      // 25M * 1.25 + 250k = 31.5M
      expect(result.ruleKey).toBe(SALARY_MATCHING_RULE_KEYS.OVER_CAP_BAND_3);
      expect(result.allowableIncoming).toBe(31_500_000);
    });
  });

  describe('BYC Outgoing Matching Value', () => {
    it('GOLDEN-04: BYC player outgoing uses max(prior, 50% new)', () => {
      const player = {
        name: 'BYC Player',
        isBYC: true,
        previousSalary: 12_000_000,
        newSalary: 20_000_000,
        contract: {
          salariesByYear: [{ season, salary: 20_000_000 }],
        },
      };

      computeMatchingValues({ teams: [{ sends: [player] }], yearKey: currentYear });

      // max(12M, 20M * 0.5) = max(12M, 10M) = 12M
      expect(player.matchOutgoing).toBe(12_000_000);
      expect(player.matchIncoming).toBe(20_000_000);
    });

    it('GOLDEN-05: BYC uses 50% when larger than prior salary', () => {
      const player = {
        name: 'BYC Player',
        isBYC: true,
        previousSalary: 10_000_000,
        newSalary: 30_000_000,
        contract: {
          salariesByYear: [{ season, salary: 30_000_000 }],
        },
      };

      computeMatchingValues({ teams: [{ sends: [player] }], yearKey: currentYear });

      // max(10M, 30M * 0.5) = max(10M, 15M) = 15M
      expect(player.matchOutgoing).toBe(15_000_000);
      expect(player.matchIncoming).toBe(30_000_000);
    });
  });

  describe('First Apron Restrictions', () => {
    it('GOLDEN-06: First apron team gets 100% matching only', () => {
      const result = getSalaryMatchingResult({
        teamTotalSalary: 180_000_000, // above first apron (178.132M)
        outgoingSalary: 15_000_000,
        capSettings: DEFAULT_CAP_SETTINGS,
      });

      expect(result.ruleKey).toBe(SALARY_MATCHING_RULE_KEYS.FIRST_APRON);
      expect(result.allowableIncoming).toBe(15_000_000); // exactly outgoing
    });
  });

  describe('Second Apron Restrictions', () => {
    it('GOLDEN-07: Second apron team cannot receive more than sent', () => {
      const teamA = makeTeam('A', 210_000_000); // above second apron
      const teamB = makeTeam('B', 100_000_000);
      const aPlayer = makePlayer('A1', 10_000_000);
      const bPlayer = makePlayer('B1', 12_000_000);
      teamA.players.push(aPlayer);
      teamB.players.push(bPlayer);

      const result = validateTrade({
        teams: [
          { team: teamA, sends: [aPlayer], picksOut: [] },
          { team: teamB, sends: [bPlayer], picksOut: [] },
        ],
        capProjections,
        currentYear,
      });

      expect(result.legal).toBe(false);
      expect(result.reason).toContain('Second apron');
    });

    it('GOLDEN-08: Second apron team cannot aggregate salaries', () => {
      const teamA = makeTeam('A', 210_000_000); // above second apron
      const teamB = makeTeam('B', 100_000_000);
      const aPlayer1 = makePlayer('A1', 10_000_000);
      const aPlayer2 = makePlayer('A2', 5_000_000);
      const bPlayer = makePlayer('B1', 15_000_000);
      teamA.players.push(aPlayer1, aPlayer2);
      teamB.players.push(bPlayer);

      const result = validateTrade({
        teams: [
          { team: teamA, sends: [aPlayer1, aPlayer2], picksOut: [] },
          { team: teamB, sends: [bPlayer], picksOut: [] },
        ],
        capProjections,
        currentYear,
      });

      expect(result.legal).toBe(false);
      expect(result.reason).toContain('aggregate');
    });
  });

  describe('Under-Cap Absorption', () => {
    it('GOLDEN-09: Under-cap team can absorb using cap space', () => {
      const result = getSalaryMatchingResult({
        teamTotalSalary: 130_000_000, // 11M under cap (141M)
        outgoingSalary: 5_000_000,
        capSettings: DEFAULT_CAP_SETTINGS,
      });

      // outgoing + cap space = 5M + 11M = 16M
      expect(result.ruleKey).toBe(SALARY_MATCHING_RULE_KEYS.UNDER_CAP);
      expect(result.allowableIncoming).toBe(16_000_000);
    });

    it('GOLDEN-10: Under-cap validates incoming correctly', () => {
      const valid = validateIncomingSalary({
        teamTotalSalary: 130_000_000,
        outgoingSalary: 5_000_000,
        incomingSalary: 15_000_000, // within 16M allowable
        capSettings: DEFAULT_CAP_SETTINGS,
      });

      const invalid = validateIncomingSalary({
        teamTotalSalary: 130_000_000,
        outgoingSalary: 5_000_000,
        incomingSalary: 18_000_000, // exceeds 16M allowable
        capSettings: DEFAULT_CAP_SETTINGS,
      });

      expect(valid.passed).toBe(true);
      expect(invalid.passed).toBe(false);
      expect(invalid.violation).toContain('exceeds');
    });
  });

  describe('Trade Receipt Consistency', () => {
    it('GOLDEN-11: Trade receipt captures calculation details', () => {
      const teamA = makeTeam('A', 150_000_000);
      const teamB = makeTeam('B', 100_000_000);
      const aPlayer = makePlayer('Astar', 10_000_000);
      const bPlayer = makePlayer('Bstar', 8_000_000);
      teamA.players.push(aPlayer);
      teamB.players.push(bPlayer);

      const result = validateTrade({
        teams: [
          { team: teamA, sends: [aPlayer], picksOut: [] },
          { team: teamB, sends: [bPlayer], picksOut: [] },
        ],
        capProjections,
        currentYear,
      });

      // Verify receipt exists and has expected structure
      expect(result.tradeReceipt).toBeDefined();
      expect(result.tradeReceipt.teams).toHaveLength(2);
      expect(result.tradeReceipt.isLegal).toBe(result.legal);
      expect(result.tradeReceipt.validatorVersion).toBeDefined();
      expect(result.tradeReceipt.salaryMatchingVersion).toBeDefined();
      
      // Verify team receipts have expected fields
      const teamAReceipt = result.tradeReceipt.teams[0];
      expect(teamAReceipt.outgoingPlayers).toHaveLength(1);
      expect(teamAReceipt.salaryMatchingEvaluation).toBeDefined();
      expect(teamAReceipt.salaryMatchingEvaluation.ruleApplied).toBeDefined();
    });
  });
});
