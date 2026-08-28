/**
 * Trade Machine draft-asset preflight coverage.
 *
 * Accepted Canon L09.2/L09.3/L09.6 and A12.4 require qualifying authority and
 * complete governed lifecycle history; CBA2-A12.3 is authenticated. First-round
 * scenarios therefore assert Needs input instead of simplified Stepien math.
 */
import { describe, expect, it } from 'vitest';
import { validateStepien } from '@/features/architect/utils/tradeMachine/rules/validateStepien';
import {
  ensurePickId,
  generatePickId,
  normalizeRound,
} from '@/features/architect/utils/tradeMachine/utils/pickIdUtils';
import missingOriginalTeam from '../fixtures/tradeMachinePicks/missingOriginalTeam.json';

describe('draft-asset authority preflight', () => {
  it.each([
    [{ year: 2026, round: 1, isSwap: true, swapType: 'best_of' }],
    [{ year: 2028, round: '1st', protection: 'Top 3' }],
    [{ year: 2032, round: 'first', originalTeam: 'MIA' }],
  ])('fails closed for first-round shape %#', (pick) => {
    const result = validateStepien({ outgoingPicks: [pick] }, {});

    expect(result).toMatchObject({
      passed: false,
      status: 'NEEDS_INPUT',
      evaluated: false,
    });
    expect(result.message).toContain('Needs input');
  });

  it('preserves the supported second-round preflight', () => {
    const result = validateStepien(
      {
        outgoingPicks: [
          { year: 2026, round: 2 },
          { year: 2027, round: '2nd' },
        ],
      },
      {}
    );

    expect(result.passed).toBe(true);
    expect(result.status).toBe('PASS');
  });
});

describe('Pick ID Fallback Handling', () => {
  it('uses the UNK fallback and explains a missing original team', () => {
    const pickWithoutOriginalTeam = missingOriginalTeam.teams[0].picksOut[0];
    const result = ensurePickId(pickWithoutOriginalTeam);

    expect(result.id).toBe('UNK_2026_1');
    expect(result.pickIdWarning).toContain('originalTeam');
  });
});

describe('Pick Shape Validation', () => {
  const roundFormats = [
    [1, 1],
    [2, 2],
    ['1st', 1],
    ['2nd', 2],
    ['first', 1],
    ['second', 2],
    ['First', 1],
    ['Second', 2],
    ['1', 1],
    ['2', 2],
  ];

  it.each(roundFormats)('normalizes %j to %j', (input, expected) => {
    expect(normalizeRound(input)).toBe(expected);
  });

  it('generates the canonical pick ID', () => {
    expect(
      generatePickId({ originalTeam: 'PHI', year: 2026, round: '1st' })
    ).toBe('PHI_2026_1');
  });

  it('uses UNK when the original team is missing', () => {
    expect(generatePickId({ year: 2026, round: 1 })).toBe('UNK_2026_1');
  });
});
