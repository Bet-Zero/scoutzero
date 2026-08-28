import { describe, expect, it } from 'vitest';
import { validateStepien } from '@/features/architect/utils/tradeMachine/rules/validateStepien';

type StepienTeamInput = Parameters<typeof validateStepien>[0] & {
  draftPicksObligations?: Array<Record<string, unknown>>;
};

const makeTeam = (overrides: Partial<StepienTeamInput>): StepienTeamInput => ({
  teamId: 'TEST',
  team: { picks: [] },
  context: { yearKey: 2025 },
  outgoingPicks: [],
  validationEntitlements: [],
  entitlementsOut: [],
  draftPicksObligations: [],
  ...overrides,
});

describe('validateStepien governed-history boundary', () => {
  it.each([
    ['missing history', {}, { year: 2027, round: '1st' }],
    [
      'partial ownership history',
      {
        draftPicksObligations: [
          { year: 2026, round: 1, owner: 'OTHER', status: 'outgoing' },
        ],
      },
      { year: 2029, round: 1 },
    ],
    [
      'partial protection and conveyance history',
      {
        validationEntitlements: [
          {
            kind: 'conveyance_right',
            round: 1,
            seasonYear: 2030,
            protectionLadder: [{ year: 2030, condition: 'Top 4' }],
          },
        ],
      },
      { year: 2030, round: 'first' },
    ],
  ])('does not convert %s into an affirmative verdict', (_name, history, pick) => {
    const result = validateStepien(
      makeTeam({ ...history, outgoingPicks: [pick] })
    );

    expect(result).toMatchObject({
      passed: false,
      status: 'NEEDS_INPUT',
      evaluated: false,
    });
    expect(result.missingInputs).toContain('governedDraftHistory.freeze');
    expect(result.missingInputs).toContain('governedDraftHistory.conveyance');
  });

  it('does not evaluate dormant history when only a second-round asset is sent', () => {
    const result = validateStepien(
      makeTeam({
        draftPicksObligations: [
          { year: 2027, round: 1, owner: 'OTHER', status: 'outgoing' },
        ],
        outgoingPicks: [{ year: 2028, round: '2nd' }],
      })
    );

    expect(result.passed).toBe(true);
    expect(result.status).toBe('PASS');
  });
});
