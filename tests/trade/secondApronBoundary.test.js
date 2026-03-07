/**
 * FILE: tests/trade/secondApronBoundary.test.js
 * PURPOSE: Boundary tests for second apron classification threshold
 * OWNERSHIP: Feature: architect/trade-machine validation
 *
 * HISTORY:
 *  - 2026-01-23: Created for Phase 34 - Second Apron Threshold Boundary Bug fix
 *
 * LINKS:
 *  - Preflight: docs/architect/return_packages/PHASE_34_SECOND_APRON_THRESHOLD_PREFLIGHT_RETURN_PACKAGE.md
 *  - CBA Reference: Article VII, Section 2(f), Rule Card 6
 */

import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/features/architect/utils/tradeMachine/index.js';
import capProjections from '@/features/architect/utils/capProjections.js';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText.js';

// Use 2024-25 season where secondApron = 190,000,000
const currentYear = 2025;
const season = `${currentYear - 1}-${String(currentYear).slice(-2)}`;

// Helpers (same pattern as tradeValidator.test.js)
const makePlayer = (name, salary, signAndTrade = false, contractYears = 4) => ({
  name,
  signAndTrade,
  contractYears,
  contract: { salariesByYear: [{ season, salary }] },
});

const makeTeam = (name, totalSalary, rosterSize = 14, picks = []) => ({
  teamName: name,
  totalSalary,
  players: Array.from({ length: rosterSize }, (_, i) =>
    makePlayer(`${name}${i}`, 1_000_000)
  ),
  picks,
});

const issueTexts = (issues = []) => issues.map((issue) => getValidationIssueText(issue));

/**
 * Per CBA Article VII, Section 2(f), Rule Card 6:
 * "If Apron Salary > Second Apron, team is 'Second Apron Team.'"
 *
 * This means:
 * - salary > secondApron → IS a second apron team (restrictions apply)
 * - salary == secondApron → is NOT a second apron team (no restrictions)
 * - salary < secondApron → is NOT a second apron team (no restrictions)
 *
 * For 2024-25: secondApron = $190,000,000
 */
describe('second apron boundary cases', () => {
  /**
   * Test 1: Team with projectedSalary EQUAL to secondApron should NOT be treated as second apron
   *
   * Scenario: Team A at $180M receives $10M → projected $190M == secondApron
   * Expected: No second apron violations
   */
  it('does not classify projectedSalary equal to secondApron as second apron team', () => {
    const teamA = makeTeam('A', 180_000_000);
    const teamB = makeTeam('B', 100_000_000);

    // Team B sends $10M player, Team A receives it
    const incomingPlayer = makePlayer('Incoming', 10_000_000);
    teamB.players.push(incomingPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [], picksOut: [] },
        { team: teamB, sends: [incomingPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    // Team A's projected salary = 180M + 10M = 190M (equals secondApron)
    // Should NOT trigger second apron restrictions

    // Check that secondApronEnforcement rule has no violations
    const secondApronViolations =
      result.teamResults[0].rules?.secondApronEnforcement?.violations || [];
    expect(issueTexts(secondApronViolations)).toEqual([]);

    // Also verify aggregation rule didn't flag second apron
    const aggregationResult = result.teamResults[0].rules?.aggregation || {};
    const aggregationViolations = issueTexts(aggregationResult.violations || []);
    const hasSecondApronAggregation = aggregationViolations.some((v) =>
      v.toLowerCase().includes('second apron')
    );
    expect(hasSecondApronAggregation).toBe(false);
  });

  /**
   * Test 2: Team with projectedSalary EXCEEDING secondApron by $1 should be treated as second apron
   *
   * Scenario: Team A at $180M receives $10,000,001 → projected $190,000,001 > secondApron
   * Expected: Second apron violation (more salary in than out)
   */
  it('classifies projectedSalary exceeding secondApron by $1 as second apron team', () => {
    const teamA = makeTeam('A', 180_000_000);
    const teamB = makeTeam('B', 100_000_000);

    // Team B sends $10,000,001 player
    const incomingPlayer = makePlayer('BigIncoming', 10_000_001);
    teamB.players.push(incomingPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [], picksOut: [] },
        { team: teamB, sends: [incomingPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    // Team A's projected salary = 180M + 10,000,001 = 190,000,001 > secondApron
    // Should trigger second apron restrictions (100% matching required, but A sends nothing)

    // At least one rule should have a second apron related violation
    const allViolations = issueTexts(result.teamResults[0].violations || []);
    const hasSecondApronViolation = allViolations.some(
      (v) =>
        v.toLowerCase().includes('second apron') ||
        v.toLowerCase().includes('2nd apron')
    );
    expect(hasSecondApronViolation).toBe(true);
  });

  /**
   * Test 3: Team with pre-trade salary EQUAL to secondApron should NOT be treated as second apron
   *
   * Scenario: Team A at $190M (equals threshold) trades 1-for-1 equal salary
   * Expected: No second apron violations
   */
  it('does not classify pre-trade salary equal to secondApron as second apron team', () => {
    const teamA = makeTeam('A', 190_000_000);
    const teamB = makeTeam('B', 100_000_000);

    // Equal salary swap
    const playerFromA = makePlayer('PlayerA', 10_000_000);
    const playerFromB = makePlayer('PlayerB', 10_000_000);
    teamA.players.push(playerFromA);
    teamB.players.push(playerFromB);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [playerFromA], picksOut: [] },
        { team: teamB, sends: [playerFromB], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    // Team A pre-trade = 190M, projected = 190M (equal swap)
    // Since 190M is NOT > 190M, should NOT trigger second apron restrictions

    const secondApronViolations =
      result.teamResults[0].rules?.secondApronEnforcement?.violations || [];
    expect(issueTexts(secondApronViolations)).toEqual([]);

    const aggregationResult = result.teamResults[0].rules?.aggregation || {};
    const aggregationViolations = issueTexts(aggregationResult.violations || []);
    const hasSecondApronAggregation = aggregationViolations.some((v) =>
      v.toLowerCase().includes('second apron')
    );
    expect(hasSecondApronAggregation).toBe(false);
  });

  /**
   * Test 4: Team with pre-trade salary ABOVE secondApron should be treated as second apron team
   *
   * Scenario: Team A at $190,000,001 (above threshold) tries to take more salary
   * Expected: Second apron violation
   */
  it('classifies pre-trade salary above secondApron as second apron team', () => {
    const teamA = makeTeam('A', 190_000_001); // $1 above second apron
    const teamB = makeTeam('B', 100_000_000);

    // Team A tries to receive more than it sends (violates 100% matching)
    const playerFromA = makePlayer('PlayerA', 10_000_000);
    const playerFromB = makePlayer('PlayerB', 12_000_000);
    teamA.players.push(playerFromA);
    teamB.players.push(playerFromB);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [playerFromA], picksOut: [] },
        { team: teamB, sends: [playerFromB], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    // Team A at 190,000,001 > 190,000,000 → IS second apron team
    // Receiving 12M while sending 10M violates 100% matching

    const allViolations = issueTexts(result.teamResults[0].violations || []);
    const hasSecondApronViolation = allViolations.some(
      (v) =>
        v.toLowerCase().includes('second apron') ||
        v.toLowerCase().includes('2nd apron')
    );
    expect(hasSecondApronViolation).toBe(true);
  });

  /**
   * Test 5: Regression test for Phase 33 scenario
   *
   * This is the exact scenario that triggered the Phase 34 investigation:
   * - Team A at $180M, hardCapped, receives $10M
   * - projectedSalary = $190M = secondApron
   *
   * Expected: No spurious "Second apron team cannot receive more salary than sent" violation
   */
  it('regression: Phase 33 scenario no longer emits spurious second apron violation', () => {
    const teamA = makeTeam('A', 180_000_000);
    const teamB = makeTeam('B', 150_000_000);
    const incoming = makePlayer('Bstar', 10_000_000);
    teamB.players.push(incoming);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [], picksOut: [], hardCapped: true },
        { team: teamB, sends: [incoming], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    // Team A projected = 180M + 10M = 190M (equals secondApron)
    // The aggregated violations array should NOT contain the spurious second apron message

    const allViolations = issueTexts(result.teamResults[0].violations || []);

    // Should NOT contain second apron specific violations
    const hasSecondApronViolation = allViolations.some(
      (v) =>
        v.includes('Second apron team cannot receive more salary than sent') ||
        v.includes('Second apron team cannot aggregate')
    );
    expect(hasSecondApronViolation).toBe(false);

    // Should still have hard cap violation (first apron), which is expected
    // Team A is hard capped at first apron ($179M) and is receiving $10M with no outgoing
    expect(issueTexts(result.teamResults[0].rules.hardCap.violations)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('1st Apron hard cap violation'),
      ])
    );
  });
});
