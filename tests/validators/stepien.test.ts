import { describe, expect, it } from 'vitest';
import { validateStepien } from '@/features/architect/utils/tradeMachine/rules/validateStepien';

const AUTHORITY_MESSAGE =
  'Needs input — Stepien eligibility cannot be confirmed because complete pick ownership, protection and conveyance terms, trading restrictions and their release, and penalty history are unavailable.';

const makeTeam = (outgoingPicks: Array<Record<string, unknown>>) => ({
  teamId: 'TEST',
  team: { picks: [] },
  context: { yearKey: 2025 },
  outgoingPicks,
});

function expectNeedsInput(result: ReturnType<typeof validateStepien>) {
  expect(result).toMatchObject({
    passed: false,
    status: 'NEEDS_INPUT',
    evaluated: false,
    message: AUTHORITY_MESSAGE,
  });
  expect(result.missingInputs).toEqual(
    expect.arrayContaining([
      'governedDraftHistory.ownership',
      'governedDraftHistory.protection',
      'governedDraftHistory.conveyance',
      'governedDraftHistory.freeze',
      'governedDraftHistory.unfreeze',
      'governedDraftHistory.penalty',
    ])
  );
  expect(result.missingInputs).not.toContain('acceptedCanon.CBA2-A12.3');
  expect(result.details).toContain('complete pick ownership');
  expect(result.details).toContain('protection and conveyance terms');
  expect(result.details).toContain('trading restrictions and their release');
  expect(result.details).toContain('penalty history');
  expect(`${result.message} ${result.details}`).not.toMatch(/compliant/i);
}

describe('validateStepien authority boundary', () => {
  // Source-derived oracle: CBA2-A12.3 is authenticated, while L09.2/L09.3/L09.6
  // and A12.4 require complete governed draft lifecycle history that is not
  // available. No first-round legality result can be computed from partial inputs.
  it.each([
    ['single direct pick', [{ year: 2027, round: '1st' }]],
    ['different year', [{ year: 2031, round: 1 }]],
    ['protected pick', [{ year: 2028, round: 'first', protection: 'Top 3' }]],
    [
      'swap right',
      [
        {
          year: 2029,
          round: 'first_round',
          isSwap: true,
          swapType: 'worst_of',
        },
      ],
    ],
  ])('fails closed for %s', (_name, picks) => {
    expectNeedsInput(validateStepien(makeTeam(picks)));
  });

  it('keeps the supported second-round control unchanged', () => {
    const result = validateStepien(
      makeTeam([
        { year: 2027, round: '2nd' },
        { year: 2028, round: 2 },
      ])
    );

    expect(result).toMatchObject({
      passed: true,
      status: 'PASS',
      evaluated: true,
      missingInputs: [],
    });
  });
});
