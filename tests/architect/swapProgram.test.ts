import { describe, it, expect } from 'vitest';
import { resolveSwapProgram } from '@/features/architect/utils/draftReview/swapProgram';
import {
  DraftSwapProgramZ,
  type DraftSwapProgram,
} from '@/schemas/draftSwapProgram';

// Independent stipulated terms, not NBA facts: BBB/CCC exchange first; AAA then
// has the best-of option over AAA and the selection left in BBB's slot.
const program: DraftSwapProgram = {
  kind: 'ordered-swap-pool-v1',
  year: 2026,
  tradedRightId: 'right-a',
  grantorTeam: 'DDD',
  slots: ['AAA', 'BBB', 'CCC'].map((t) => ({
    entitlementId: t,
    originalTeam: t,
    holderTeam: t,
    protectedThrough: 0,
  })),
  steps: [
    {
      rightId: 'right-c',
      controllerId: 'CCC',
      poolIds: ['BBB', 'CCC'],
      comparator: 'best_of',
      election: 'exercise-or-waive',
    },
    {
      rightId: 'right-a',
      controllerId: 'AAA',
      poolIds: ['AAA', 'BBB'],
      comparator: 'best_of',
      election: 'exercise-or-waive',
    },
  ],
  inactiveClaimIds: [],
  result: null,
};
describe('complete ordered swap pools', () => {
  it('uses the selection left by a prior claim, rather than the original team position', () => {
    // BBB #5 goes to CCC; CCC #10 goes to BBB, then to AAA for AAA #20.
    expect(
      resolveSwapProgram(
        program,
        { AAA: 20, BBB: 5, CCC: 10 },
        { 'right-c': true, 'right-a': true }
      ).result?.allocation
    ).toEqual({ AAA: 'BBB', BBB: 'CCC', CCC: 'AAA' });
  });
  it('honors prior waiver, final waiver and a retained better return selection', () => {
    expect(
      resolveSwapProgram(
        program,
        { AAA: 20, BBB: 5, CCC: 10 },
        { 'right-c': false, 'right-a': true }
      ).result?.allocation
    ).toEqual({ AAA: 'BBB', BBB: 'AAA', CCC: 'CCC' });
    expect(
      resolveSwapProgram(
        program,
        { AAA: 20, BBB: 5, CCC: 10 },
        { 'right-c': true, 'right-a': false }
      ).result?.allocation
    ).toEqual({ AAA: 'AAA', BBB: 'CCC', CCC: 'BBB' });
    expect(
      resolveSwapProgram(
        program,
        { AAA: 1, BBB: 5, CCC: 10 },
        { 'right-c': true, 'right-a': true }
      ).result?.allocation
    ).toEqual({ AAA: 'AAA', BBB: 'CCC', CCC: 'BBB' });
  });
  it('supports explicit less-favorable terms without a franchise exception', () => {
    const terms = {
      ...program,
      steps: [
        {
          ...program.steps[1],
          poolIds: ['AAA', 'BBB', 'CCC'],
          comparator: 'worst_of' as const,
        },
      ],
    };
    expect(
      resolveSwapProgram(
        terms,
        { AAA: 10, BBB: 25, CCC: 2 },
        { 'right-a': true }
      ).result?.allocation
    ).toEqual({ AAA: 'BBB', BBB: 'AAA', CCC: 'CCC' });
  });
  it.each([
    { AAA: 20, BBB: 5 },
    { AAA: 20, BBB: 5, CCC: 5 },
    { AAA: 20, BBB: 5, CCC: 0 },
    { AAA: 20, BBB: 5, CCC: 31 },
    { AAA: 20, BBB: 5, CCC: 1.5 },
  ])('rejects incomplete or invalid outcome %j', (positions) => {
    expect(() =>
      resolveSwapProgram(program, positions, {
        'right-c': true,
        'right-a': true,
      })
    ).toThrow(/Every pool/);
  });
  it('rejects missing priority/elections and duplicate resolution', () => {
    expect(() =>
      resolveSwapProgram(
        program,
        { AAA: 20, BBB: 5, CCC: 10 },
        { 'right-a': true }
      )
    ).toThrow(/every ordered claim/);
    expect(() =>
      DraftSwapProgramZ.parse({ ...program, steps: [program.steps[0]] })
    ).toThrow();
    const resolved = resolveSwapProgram(
      program,
      { AAA: 20, BBB: 5, CCC: 10 },
      { 'right-c': true, 'right-a': true }
    );
    expect(() =>
      resolveSwapProgram(
        resolved,
        { AAA: 20, BBB: 5, CCC: 10 },
        { 'right-c': true, 'right-a': true }
      )
    ).toThrow(/already resolved/);
  });
});
