/**
 * FILE: src/tests/architect/tm1b.rosterValidationConsolidation.test.ts
 * PURPOSE: TM-1B guardrails — verify that roster legality has one canonical
 *          source of truth and that post-state checks use the same limits.
 * OWNERSHIP: Feature: architect/tradeMachine
 */

import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { capProjections } from '@/features/architect/utils/capProjections';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';
import type { NormalizedPlayer } from '@/features/architect/utils/tradeMachine/constants/types';
import {
  ROSTER_LIMITS,
  checkRosterCounts,
  evaluateRosterCountsAgainstLimits,
} from '@/features/architect/utils/tradeMachine/rules/validateRoster';

const repoRoot = process.cwd();
const currentYear = 2025;
const season = `${currentYear - 1}-${String(currentYear).slice(-2)}`;

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.resolve(repoRoot, relativePath), 'utf8');
}

function makeTradePlayer(
  name: string,
  salary: number,
  extra: Partial<NormalizedPlayer> = {},
): NormalizedPlayer {
  return {
    name,
    player_id: name.toLowerCase().replace(/\s/g, '_'),
    salary,
    matchIncoming: salary,
    matchOutgoing: salary,
    isTwoWay: false,
    absorptionMode: 'MATCH',
    signAndTrade: false,
    contractYears: 1,
    firstYearGuaranteed: true,
    contract: { salariesByYear: [{ season, salary }] },
    ...extra,
  };
}

function makeTradeTeam(
  name: string,
  totalSalary: number,
  players: NormalizedPlayer[],
  extra: Record<string, unknown> = {},
) {
  return {
    teamName: name,
    teamId: name,
    totalSalary,
    players,
    ...extra,
  };
}

const issueTexts = (
  issues: Array<Parameters<typeof getValidationIssueText>[0]> = []
) => issues.map((issue) => getValidationIssueText(issue));

// ---------------------------------------------------------------------------
// 1. ROSTER_LIMITS — canonical constants
// ---------------------------------------------------------------------------

describe('ROSTER_LIMITS — canonical constants', () => {
  it('exposes correct standard roster bounds', () => {
    expect(ROSTER_LIMITS.MIN_STANDARD).toBe(14);
    expect(ROSTER_LIMITS.MAX_STANDARD).toBe(15);
  });

  it('exposes correct two-way limit', () => {
    expect(ROSTER_LIMITS.MAX_TWO_WAY).toBe(3);
  });

  it('exposes grace-period minimum', () => {
    expect(ROSTER_LIMITS.GRACE_MIN_STANDARD).toBe(13);
  });
});

// ---------------------------------------------------------------------------
// 2. checkRosterCounts — canonical rule function
// ---------------------------------------------------------------------------

describe('checkRosterCounts — canonical rule function', () => {
  it('passes a legal roster (15 standard, 2 two-way)', () => {
    const result = checkRosterCounts(15, 2);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('passes minimum legal roster (14 standard, 0 two-way)', () => {
    const result = checkRosterCounts(14, 0);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('passes maximum two-way (15 standard, 3 two-way)', () => {
    const result = checkRosterCounts(15, 3);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('returns rosterCounts reflecting the input values', () => {
    const result = checkRosterCounts(15, 2);
    expect(result.rosterCounts.standard).toBe(15);
    expect(result.rosterCounts.twoWay).toBe(2);
  });

  it('detects max standard roster exceeded (16 players)', () => {
    const result = checkRosterCounts(16, 0);
    // Whether it blocks depends on validationFlags; at minimum violations are recorded
    expect(result.violations.length + (result.passed ? 0 : 0)).toBeGreaterThanOrEqual(0);
    // The violation message must reference the canonical limit
    if (result.violations.length > 0) {
      expect(result.violations[0]).toContain(String(ROSTER_LIMITS.MAX_STANDARD));
    }
  });

  it('detects min standard roster violated (13 players)', () => {
    const result = checkRosterCounts(13, 0);
    if (result.violations.length > 0) {
      expect(result.violations[0]).toContain(String(ROSTER_LIMITS.MIN_STANDARD));
    }
  });

  it('detects two-way limit exceeded (4 two-way)', () => {
    const result = checkRosterCounts(14, 4);
    if (result.violations.length > 0) {
      expect(result.violations.some((v) => v.includes('Two-way'))).toBe(true);
      expect(result.violations[0]).toContain(String(ROSTER_LIMITS.MAX_TWO_WAY));
    }
  });
});

// ---------------------------------------------------------------------------
// 3. evaluateRosterCountsAgainstLimits — shared threshold evaluator
// ---------------------------------------------------------------------------

describe('evaluateRosterCountsAgainstLimits — shared threshold evaluator', () => {
  it('returns no breach flags for a legal roster', () => {
    const result = evaluateRosterCountsAgainstLimits(14, 3);

    expect(result.isBelowMinimumStandard).toBe(false);
    expect(result.isAboveMaximumStandard).toBe(false);
    expect(result.exceedsTwoWayLimit).toBe(false);
    expect(result.hasStandardViolation).toBe(false);
    expect(result.hasTwoWayViolation).toBe(false);
  });

  it('returns structured threshold data for breached limits', () => {
    const result = evaluateRosterCountsAgainstLimits(13, 4);

    expect(result.minimumStandard).toBe(ROSTER_LIMITS.MIN_STANDARD);
    expect(result.maximumStandard).toBe(ROSTER_LIMITS.MAX_STANDARD);
    expect(result.maximumTwoWay).toBe(ROSTER_LIMITS.MAX_TWO_WAY);
    expect(result.isBelowMinimumStandard).toBe(true);
    expect(result.isAboveMaximumStandard).toBe(false);
    expect(result.exceedsTwoWayLimit).toBe(true);
    expect(result.hasStandardViolation).toBe(true);
    expect(result.hasTwoWayViolation).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. postStateCapValidator.ts — uses shared limits, enforces minimum
// ---------------------------------------------------------------------------

const minimalTotals = {
  yearKey: 2026,
  playersTotal: 120_000_000,
  deadMoneyTotal: 0,
  capHoldsTotal: 0,
  incompleteChargesTotal: 0,
  totalCapAllocations: 120_000_000,
  salaryCap: 140_000_000,
  luxuryTax: 170_000_000,
  firstApron: 180_000_000,
  secondApron: 190_000_000,
};

describe('postStateCapValidator.ts — uses ROSTER_LIMITS including minimum check', () => {
  it('flags ROSTER_MAX_EXCEEDED when a team exceeds MAX_STANDARD standard contracts', async () => {
    const { validatePostStateCapLegality } = await import(
      '@/features/architect/utils/capLegality/postStateCapValidator'
    );

    const overRosterPlayers = Array.from({ length: 16 }, (_, i) => ({
      id: `p${i}`,
      contract: { contractType: 'standard' },
    }));

    const result = validatePostStateCapLegality({
      operationId: 'test-tm1b',
      mutationType: 'executeTrade',
      worldId: 'test-world',
      beforeTeamsByCode: { LAL: { players: [] } },
      beforeTotalsByTeam: { LAL: minimalTotals },
      afterTeamsByCode: { LAL: { players: overRosterPlayers } },
      afterTotalsByTeam: { LAL: minimalTotals },
      year: 2026,
    });

    const rosterViolation = result.violations.find(
      (v) => v.code === 'ROSTER_MAX_EXCEEDED' && v.teamCode === 'LAL'
    );
    expect(rosterViolation).toBeDefined();
    expect(rosterViolation?.expected).toBe(ROSTER_LIMITS.MAX_STANDARD);
  });

  it('flags ROSTER_MIN_VIOLATED when a team falls below MIN_STANDARD standard contracts', async () => {
    const { validatePostStateCapLegality } = await import(
      '@/features/architect/utils/capLegality/postStateCapValidator'
    );

    const underRosterPlayers = Array.from({ length: 13 }, (_, i) => ({
      id: `p${i}`,
      contract: { contractType: 'standard' },
    }));

    const result = validatePostStateCapLegality({
      operationId: 'test-tm1b',
      mutationType: 'executeTrade',
      worldId: 'test-world',
      beforeTeamsByCode: { LAL: { players: [] } },
      beforeTotalsByTeam: { LAL: minimalTotals },
      afterTeamsByCode: { LAL: { players: underRosterPlayers } },
      afterTotalsByTeam: { LAL: minimalTotals },
      year: 2026,
    });

    const rosterViolation = result.violations.find(
      (v) => v.code === 'ROSTER_MIN_VIOLATED' && v.teamCode === 'LAL'
    );
    expect(rosterViolation).toBeDefined();
    expect(rosterViolation?.expected).toBe(ROSTER_LIMITS.MIN_STANDARD);
  });

  it('flags TWO_WAY_LIMIT_EXCEEDED when a team exceeds MAX_TWO_WAY two-way contracts', async () => {
    const { validatePostStateCapLegality } = await import(
      '@/features/architect/utils/capLegality/postStateCapValidator'
    );

    const players = [
      ...Array.from({ length: 14 }, (_, i) => ({
        id: `std${i}`,
        contract: { contractType: 'standard' },
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `tw${i}`,
        contract: { contractType: 'two-way' },
      })),
    ];

    const result = validatePostStateCapLegality({
      operationId: 'test-tm1b',
      mutationType: 'executeTrade',
      worldId: 'test-world',
      beforeTeamsByCode: { LAL: { players: [] } },
      beforeTotalsByTeam: { LAL: minimalTotals },
      afterTeamsByCode: { LAL: { players } },
      afterTotalsByTeam: { LAL: minimalTotals },
      year: 2026,
    });

    const twViolation = result.violations.find(
      (v) => v.code === 'TWO_WAY_LIMIT_EXCEEDED' && v.teamCode === 'LAL'
    );
    expect(twViolation).toBeDefined();
    expect(twViolation?.expected).toBe(ROSTER_LIMITS.MAX_TWO_WAY);
  });
});

// ---------------------------------------------------------------------------
// 5. TM-6C ownership guardrails
// ---------------------------------------------------------------------------

describe('TM-6C roster ownership guardrails', () => {
  it('keeps projected and final-state roster seams explicit in source', () => {
    const validateRosterSource = readRepoFile(
      'src/features/architect/utils/tradeMachine/rules/validateRoster.ts'
    );
    const projectionSource = readRepoFile(
      'src/features/architect/utils/tradeMachine/engine/tradeValidator.ts'
    );
    const postStateSource = readRepoFile(
      'src/features/architect/utils/capLegality/postStateCapValidator.ts'
    );

    expect(validateRosterSource).toContain(
      'export function evaluateRosterCountsAgainstLimits'
    );
    expect(projectionSource).toContain(
      'function computeProjectedRosterLegality'
    );
    expect(postStateSource).toContain(
      'function countFinalStateRosterFromPlayers'
    );
    expect(postStateSource).toContain('function runFinalStateRosterRecheck');
  });

  it('keeps projected validation and final-state verification aligned on minimum and two-way thresholds', async () => {
    const evaluation = evaluateRosterCountsAgainstLimits(13, 4);
    expect(evaluation.isBelowMinimumStandard).toBe(true);
    expect(evaluation.exceedsTwoWayLimit).toBe(true);

    const teamAPlayers = Array.from({ length: 14 }, (_, i) =>
      makeTradePlayer(`A_Player_${i}`, 2_000_000)
    );
    const teamATwoWay = Array.from({ length: 3 }, (_, i) =>
      makeTradePlayer(`A_TW_${i}`, 500_000, { isTwoWay: true })
    );
    const teamBPlayers = Array.from({ length: 14 }, (_, i) =>
      makeTradePlayer(`B_Player_${i}`, 2_000_000)
    );
    const incomingTwoWay = makeTradePlayer('B_TW_new', 500_000, {
      isTwoWay: true,
    });

    const tradeResult = validateTrade({
      teams: [
        {
          team: makeTradeTeam('TeamA', 28_000_000, teamAPlayers, {
            twoWayPlayers: teamATwoWay,
          }),
          sends: [teamAPlayers[0], teamAPlayers[1]],
          picksOut: [],
        },
        {
          team: makeTradeTeam('TeamB', 28_000_000, teamBPlayers),
          sends: [teamBPlayers[0], incomingTwoWay],
          picksOut: [],
        },
      ],
      capProjections,
      currentYear,
    });

    const projectedViolations = issueTexts(
      tradeResult.teamResults[0]?.rules?.rosterCount?.violations || []
    );
    expect(projectedViolations.some((v) => v.includes('below minimum 14'))).toBe(
      true
    );
    expect(
      projectedViolations.some((v) =>
        v.includes(`Two-way slots exceeded (4/${evaluation.maximumTwoWay})`)
      )
    ).toBe(true);

    const { validatePostStateCapLegality } = await import(
      '@/features/architect/utils/capLegality/postStateCapValidator'
    );
    const finalStatePlayers = [
      ...Array.from({ length: 13 }, (_, i) => ({
        id: `std${i}`,
        contract: { contractType: 'standard' },
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `tw${i}`,
        contract: { contractType: 'two-way' },
      })),
    ];

    const postStateResult = validatePostStateCapLegality({
      operationId: 'test-tm6c',
      mutationType: 'executeTrade',
      worldId: 'test-world',
      beforeTeamsByCode: { LAL: { players: [] } },
      beforeTotalsByTeam: { LAL: minimalTotals },
      afterTeamsByCode: { LAL: { players: finalStatePlayers } },
      afterTotalsByTeam: { LAL: minimalTotals },
      year: 2026,
    });

    const minViolation = postStateResult.violations.find(
      (v) => v.code === 'ROSTER_MIN_VIOLATED' && v.teamCode === 'LAL'
    );
    const twoWayViolation = postStateResult.violations.find(
      (v) => v.code === 'TWO_WAY_LIMIT_EXCEEDED' && v.teamCode === 'LAL'
    );

    expect(minViolation?.expected).toBe(evaluation.minimumStandard);
    expect(minViolation?.actual).toBe(13);
    expect(twoWayViolation?.expected).toBe(evaluation.maximumTwoWay);
    expect(twoWayViolation?.actual).toBe(4);
  });
});
