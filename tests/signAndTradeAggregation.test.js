/**
 * FILE: tests/signAndTradeAggregation.test.js
 * PURPOSE: Tests for Sign-and-Trade aggregation prohibition rules (Phase 32)
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * HISTORY:
 *  - 2026-01-23: Phase 32 - Created for incoming S&T aggregation prohibition (P0-2)
 *
 * TESTED CONSTRAINTS:
 *  - Outgoing aggregation: Origin team cannot send S&T player + other players (existing Rule 1.5)
 *  - Incoming aggregation: Receiving team cannot get S&T player + other players (NEW Rule 1.6)
 *  - Picks allowed alongside S&T (picks are not "players" for aggregation)
 *  - Multi-team trade edge cases
 */

import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/features/architect/utils/tradeMachine/index.js';
import capProjections from '@/features/architect/utils/capProjections.js';

const currentYear = 2025;
const season = `${currentYear - 1}-${String(currentYear).slice(-2)}`;

// Helper: Create a player object
const makePlayer = (name, salary, signAndTrade = false, contractYears = 4) => ({
  id: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  signAndTrade,
  contractYears,
  firstYearGuaranteed: true,
  contract: { salariesByYear: [{ season, salary, capHit: salary }] },
});

// Helper: Create a team object
const makeTeam = (name, totalSalary, rosterSize = 14, picks = []) => ({
  teamId: name,
  teamName: name,
  teamCode: name,
  totalSalary,
  teamTotalSalary: totalSalary,
  players: Array.from({ length: rosterSize }, (_, i) =>
    makePlayer(`${name}${i}`, 1_000_000)
  ),
  picks,
  rosterSize,
});

// Helper: Create a draft pick
const makePick = (year, round = '1st') => ({
  year,
  round,
  type: 'pick',
});

describe('Sign-and-Trade Aggregation Rules', () => {
  // ============================================================================
  // TEST 1: Baseline pass - valid S&T where receiving team gets only S&T player
  // ============================================================================
  describe('Baseline: Valid S&T trades', () => {
    it('allows valid S&T where receiving team gets only the S&T player', () => {
      const teamA = makeTeam('A', 100_000_000);
      const teamB = makeTeam('B', 100_000_000);

      // Team A sends S&T player, Team B sends regular player back
      const satPlayer = makePlayer('SATstar', 20_000_000, true, 4);
      const regularPlayer = makePlayer('Bstar', 15_000_000);
      teamA.players.push(satPlayer);
      teamB.players.push(regularPlayer);

      const result = validateTrade({
        teams: [
          { team: teamA, sends: [satPlayer], picksOut: [] },
          { team: teamB, sends: [regularPlayer], picksOut: [] },
        ],
        capProjections,
        currentYear,
        tradeCtx: { offseason: true },
      });

      // Trade should be legal - S&T player is traded alone, receiving team gets only S&T
      expect(result.legal).toBe(true);
      expect(result.teamResults[0].rules.signAndTrade.passed).toBe(true);
      expect(result.teamResults[1].rules.signAndTrade.passed).toBe(true);
    });
  });

  // ============================================================================
  // TEST 2: Existing rule - blocks origin team sending S&T + another player
  // ============================================================================
  describe('Outgoing Aggregation (existing Rule 1.5)', () => {
    it('blocks origin team sending S&T player + another player', () => {
      const teamA = makeTeam('A', 100_000_000);
      const teamB = makeTeam('B', 100_000_000);

      const satPlayer = makePlayer('SATstar', 15_000_000, true, 4);
      const extraPlayer = makePlayer('Aextra', 5_000_000);
      const bPlayer = makePlayer('Bstar', 20_000_000);
      teamA.players.push(satPlayer, extraPlayer);
      teamB.players.push(bPlayer);

      const result = validateTrade({
        teams: [
          { team: teamA, sends: [satPlayer, extraPlayer], picksOut: [] },
          { team: teamB, sends: [bPlayer], picksOut: [] },
        ],
        capProjections,
        currentYear,
        tradeCtx: { offseason: true },
      });

      expect(result.legal).toBe(false);
      expect(result.teamResults[0].violations).toContain(
        'Sign-and-trade player must be traded alone.'
      );
      expect(result.teamResults[0].rules.signAndTrade.passed).toBe(false);
    });
  });

  // ============================================================================
  // TEST 3: Rule 1.6 - receiver cannot take S&T + another player
  // ============================================================================
  describe('Incoming Aggregation (Rule 1.6)', () => {
    it('blocks receiving team getting S&T + another player from same origin team', () => {
      const teamA = makeTeam('A', 100_000_000, 13);
      const teamB = makeTeam('B', 100_000_000, 13);

      const satPlayer = makePlayer('SATstar', 15_000_000, true, 4);
      const extraPlayer = makePlayer('Aextra', 5_000_000);
      const bPlayer = makePlayer('Bstar', 20_000_000);
      teamA.players.push(satPlayer, extraPlayer);
      teamB.players.push(bPlayer);

      const result = validateTrade({
        teams: [
          {
            team: teamA,
            sends: [
              { ...satPlayer, tradeTo: 'B' },
              { ...extraPlayer, tradeTo: 'B' },
            ],
            picksOut: [],
          },
          { team: teamB, sends: [{ ...bPlayer, tradeTo: 'A' }], picksOut: [] },
        ],
        capProjections,
        currentYear,
        tradeCtx: { offseason: true },
      });

      expect(result.legal).toBe(false);
      expect(result.teamResults[0].violations).toContain(
        'Sign-and-trade player must be traded alone.'
      );
      expect(result.teamResults[1].violations).toContain(
        'Cannot aggregate other players with sign-and-trade player.'
      );
      expect(result.teamResults[1].rules.signAndTrade.passed).toBe(false);
    });

    it('blocks receiving team getting S&T + another player in same inbound (3-team routed fixture)', () => {
      const teamA = makeTeam('A', 100_000_000, 13);
      const teamB = makeTeam('B', 100_000_000, 13);
      const teamC = makeTeam('C', 100_000_000, 13);

      const satPlayer = makePlayer('SATstar', 15_000_000, true, 4);
      const extraPlayer = makePlayer('Aextra', 5_000_000);
      const bOut = makePlayer('Bout', 10_000_000);
      const cOut = makePlayer('Cout', 10_000_000);
      teamA.players.push(satPlayer, extraPlayer);
      teamB.players.push(bOut);
      teamC.players.push(cOut);

      const result = validateTrade({
        teams: [
          {
            team: teamA,
            sends: [
              { ...satPlayer, tradeTo: 'B' },
              { ...extraPlayer, tradeTo: 'B' },
            ],
            picksOut: [],
          },
          { team: teamB, sends: [{ ...bOut, tradeTo: 'C' }], picksOut: [] },
          { team: teamC, sends: [{ ...cOut, tradeTo: 'A' }], picksOut: [] },
        ],
        capProjections,
        currentYear,
        tradeCtx: { offseason: true },
      });

      expect(result.legal).toBe(false);
      expect(result.teamResults[1].violations).toContain(
        'Cannot aggregate other players with sign-and-trade player.'
      );
      expect(result.teamResults[1].rules.signAndTrade.passed).toBe(false);
    });
  });

  // ============================================================================
  // TEST 4: Rule 1.6 - receiver cannot aggregate across teams in 3-team trade
  // ============================================================================
  describe('3-Team Trade Incoming Aggregation (Rule 1.6)', () => {
    it('blocks receiving team getting S&T + player from a different team', () => {
      const teamA = makeTeam('A', 100_000_000, 13);
      const teamB = makeTeam('B', 100_000_000, 13);
      const teamC = makeTeam('C', 100_000_000, 14);

      const satPlayer = makePlayer('SATstar', 20_000_000, true, 4);
      const bOut = makePlayer('Bout', 10_000_000);
      const cOut = makePlayer('Cout', 5_000_000);
      teamA.players.push(satPlayer);
      teamB.players.push(bOut);
      teamC.players.push(cOut);

      const result = validateTrade({
        teams: [
          { team: teamA, sends: [{ ...satPlayer, tradeTo: 'B' }], picksOut: [] },
          { team: teamB, sends: [{ ...bOut, tradeTo: 'A' }], picksOut: [] },
          { team: teamC, sends: [{ ...cOut, tradeTo: 'B' }], picksOut: [] },
        ],
        capProjections,
        currentYear,
        tradeCtx: { offseason: true },
      });

      expect(result.legal).toBe(false);
      expect(result.teamResults[1].violations).toContain(
        'Cannot aggregate other players with sign-and-trade player.'
      );
      expect(result.teamResults[1].rules.signAndTrade.passed).toBe(false);
      expect(result.teamResults[0].rules.signAndTrade.passed).toBe(true);
      expect(result.teamResults[2].rules.signAndTrade.passed).toBe(true);
    });
  });

  // ============================================================================
  // TEST 5: Pass - allows S&T with picks alongside
  // ============================================================================
  describe('Picks Allowed with S&T', () => {
    it('allows S&T with draft picks alongside (picks are not players)', () => {
      const teamA = makeTeam('A', 100_000_000);
      const teamB = makeTeam('B', 100_000_000);

      const satPlayer = makePlayer('SATstar', 20_000_000, true, 4);
      const bPlayer = makePlayer('Bstar', 15_000_000);
      teamA.players.push(satPlayer);
      teamB.players.push(bPlayer);

      const result = validateTrade({
        teams: [
          {
            team: teamA,
            sends: [satPlayer],
            picksOut: [makePick(2027, '1st')],
          },
          { team: teamB, sends: [bPlayer], picksOut: [] },
        ],
        capProjections,
        currentYear,
        tradeCtx: { offseason: true },
      });

      // S&T with picks should be allowed - picks don't count for player aggregation
      expect(result.legal).toBe(true);
      expect(result.teamResults[0].rules.signAndTrade.passed).toBe(true);
    });
  });

  // ============================================================================
  // TEST 6: Control - non-S&T multi-player trade remains unaffected
  // ============================================================================
  describe('Control: Non-S&T trades unaffected', () => {
    it('allows non-S&T multi-player trade (control case)', () => {
      const teamA = makeTeam('A', 100_000_000, 13);
      const teamB = makeTeam('B', 100_000_000, 13);

      const aPlayer1 = makePlayer('Astar1', 10_000_000);
      const aPlayer2 = makePlayer('Astar2', 10_000_000);
      const bPlayer1 = makePlayer('Bstar1', 10_000_000);
      const bPlayer2 = makePlayer('Bstar2', 10_000_000);
      teamA.players.push(aPlayer1, aPlayer2);
      teamB.players.push(bPlayer1, bPlayer2);

      const result = validateTrade({
        teams: [
          { team: teamA, sends: [aPlayer1, aPlayer2], picksOut: [] },
          { team: teamB, sends: [bPlayer1, bPlayer2], picksOut: [] },
        ],
        capProjections,
        currentYear,
        tradeCtx: { offseason: true },
      });

      expect(result.legal).toBe(true);
      expect(result.teamResults[0].rules.signAndTrade.passed).toBe(true);
      expect(result.teamResults[1].rules.signAndTrade.passed).toBe(true);
    });
  });

  // ============================================================================
  // TEST 7: Complex 3-team incoming aggregation still blocked by Rule 1.6
  // ============================================================================
  describe('Complex 3-Team S&T Aggregation (Rule 1.6)', () => {
    it('blocks receiving team in 3-team trade that gets S&T + any other player', () => {
      const teamA = makeTeam('A', 100_000_000, 13);
      const teamB = makeTeam('B', 100_000_000, 12);
      const teamC = makeTeam('C', 100_000_000, 14);

      const satPlayer = makePlayer('SATstar', 15_000_000, true, 4);
      const bOut = makePlayer('Bout', 15_000_000);
      const cOut1 = makePlayer('Cout1', 5_000_000);
      const cOut2 = makePlayer('Cout2', 4_000_000);
      teamA.players.push(satPlayer);
      teamB.players.push(bOut);
      teamC.players.push(cOut1, cOut2);

      const result = validateTrade({
        teams: [
          { team: teamA, sends: [{ ...satPlayer, tradeTo: 'B' }], picksOut: [] },
          { team: teamB, sends: [{ ...bOut, tradeTo: 'A' }], picksOut: [] },
          {
            team: teamC,
            sends: [
              { ...cOut1, tradeTo: 'B' },
              { ...cOut2, tradeTo: 'B' },
            ],
            picksOut: [],
          },
        ],
        capProjections,
        currentYear,
        tradeCtx: { offseason: true },
      });

      expect(result.legal).toBe(false);
      expect(result.teamResults[1].violations).toContain(
        'Cannot aggregate other players with sign-and-trade player.'
      );
      expect(result.teamResults[1].rules.signAndTrade.passed).toBe(false);
    });
  });

  // ============================================================================
  // TEST 8: Third party teams remain unaffected by Rule 1.6
  // ============================================================================
  describe('Third Party Unaffected in 3-Team S&T (Rule 1.6)', () => {
    it('allows third party team to receive multiple non-S&T players with routed fixture', () => {
      const teamA = makeTeam('A', 100_000_000, 13);
      const teamB = makeTeam('B', 100_000_000, 13);
      const teamC = makeTeam('C', 100_000_000, 13);

      const satPlayer = makePlayer('SATstar', 15_000_000, true, 4);
      const bOut1 = makePlayer('Bout1', 8_000_000);
      const bOut2 = makePlayer('Bout2', 7_000_000);
      const cOut = makePlayer('Cout', 1_000_000);
      teamA.players.push(satPlayer);
      teamB.players.push(bOut1, bOut2);
      teamC.players.push(cOut);

      const result = validateTrade({
        teams: [
          { team: teamA, sends: [{ ...satPlayer, tradeTo: 'B' }], picksOut: [] },
          {
            team: teamB,
            sends: [
              { ...bOut1, tradeTo: 'C' },
              { ...bOut2, tradeTo: 'C' },
            ],
            picksOut: [],
          },
          { team: teamC, sends: [{ ...cOut, tradeTo: 'A' }], picksOut: [] },
        ],
        capProjections,
        currentYear,
        tradeCtx: { offseason: true },
      });

      expect(result.legal).toBe(true);
      expect(result.teamResults[1].rules.signAndTrade.passed).toBe(true);
      expect(result.teamResults[2].rules.signAndTrade.passed).toBe(true);
    });
  });
});
