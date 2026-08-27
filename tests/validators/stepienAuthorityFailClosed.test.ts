import { describe, expect, it } from 'vitest';
import { validateStepien } from '@/features/architect/utils/tradeMachine/rules/validateStepien';

/**
 * Source-derived expectation recorded before product execution:
 * - accepted Canon candidate 6cf8aaf358c158a88e630e8a7336f7e9c3febc17
 * - accepted Canon SHA-256
 *   23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76
 * - CBA2-L09.2 / EV2-0776 forbids an automatic legality verdict without
 *   qualifying authority.
 * - CBA2-L09.3 / EV2-0777 requires unresolved protection/deferral to return
 *   UNAVAILABLE/NEEDS-INPUT.
 * - CBA2-L09.6 / EV2-0780 requires the complete retained first-round-rights
 *   set for every adjacent future-Draft pair.
 * - CBA2-A12.4 / EV2-0088 requires season-end Apron Team Salary history and
 *   the seven-season projection for the frozen-pick bar.
 * - pinned lookup of CBA2-A12.3 fails with "Unknown Canon leaf ID".
 *
 * Therefore every first-round variant below must stop without a legality
 * verdict. The second-round controls remain supported. No expected result is
 * derived from application output.
 */

type StepienTeam = Parameters<typeof validateStepien>[0];

function makeTeam(overrides: Record<string, unknown> = {}): StepienTeam {
  return {
    teamId: 'LAL',
    team: { id: 'LAL', teamCode: 'LAL' },
    context: { yearKey: 2026 },
    validationEntitlements: [],
    outgoingPicks: [],
    entitlementsOut: [],
    ...overrides,
  } as StepienTeam;
}

function expectNeedsInput(result: ReturnType<typeof validateStepien>) {
  expect(result).toMatchObject({
    passed: false,
    status: 'NEEDS_INPUT',
    evaluated: false,
  });
  expect(result.message).toMatch(/^Needs input/i);
  expect(result.message).not.toMatch(/compliant|legal/i);
  expect(result.details).toMatch(/not evaluated/i);
  expect(result.details).toMatch(/Apply is blocked/i);
  expect(result.missingInputs).toEqual(
    expect.arrayContaining([
      'acceptedCanon.CBA2-A12.3',
      'governedDraftHistory.ownership',
      'governedDraftHistory.protection',
      'governedDraftHistory.conveyance',
      'governedDraftHistory.freeze',
      'governedDraftHistory.unfreeze',
      'governedDraftHistory.penalty',
    ])
  );
}

describe('first-round draft authority fail-closed gate', () => {
  it('repairs the exact BZE-265 2027 entitlement discriminator', () => {
    const firstRound = {
      id: 'LAL_2027_R1',
      entitlementId: 'LAL_2027_R1',
      kind: 'pick_ownership',
      holderTeam: 'LAL',
      originalTeam: 'LAL',
      seasonYear: 2027,
      round: 1,
      underlyingStatus: 'clean',
    };

    expectNeedsInput(
      validateStepien(
        makeTeam({
          validationEntitlements: [firstRound],
          entitlementsOut: [firstRound],
        }),
        { year: 2026, yearKey: 2026 }
      )
    );
  });

  it.each([
    {
      label: 'partial ownership/protection record in a different year',
      team: makeTeam({
        validationEntitlements: [
          {
            id: 'BOS_2029_R1',
            kind: 'pick_ownership',
            round: 1,
            seasonYear: 2029,
            protection: 'Top 4',
            underlyingStatus: 'clean',
          },
        ],
        entitlementsOut: [
          {
            id: 'BOS_2029_R1',
            kind: 'pick_ownership',
            round: '1st',
            seasonYear: 2029,
            protection: 'Top 4',
          },
        ],
      }),
    },
    {
      label: 'partial conveyance and frozen-pick flags on a legacy pick',
      team: makeTeam({
        outgoingPicks: [
          {
            year: 2031,
            round: 'first',
            originalTeam: 'LAL',
            protection: 'Top 8',
            conveyanceOrder: 1,
            frozen: false,
          },
        ],
      }),
    },
  ])('does not treat $label as complete governed history', ({ team }) => {
    expectNeedsInput(validateStepien(team, { yearKey: 2026 }));
  });

  it.each([
    {
      label: 'direct second-round pick',
      team: makeTeam({ outgoingPicks: [{ year: 2027, round: '2nd' }] }),
    },
    {
      label: 'second-round ownership entitlement',
      team: makeTeam({
        validationEntitlements: [
          {
            id: 'LAL_2027_R2',
            kind: 'pick_ownership',
            round: 2,
            seasonYear: 2027,
          },
        ],
        entitlementsOut: [
          {
            id: 'LAL_2027_R2',
            kind: 'pick_ownership',
            round: 2,
            seasonYear: 2027,
          },
        ],
      }),
    },
  ])('preserves the supported $label control', ({ team }) => {
    expect(validateStepien(team, { yearKey: 2026 })).toMatchObject({
      passed: true,
      status: 'PASS',
      evaluated: true,
      missingInputs: [],
      message: 'Stepien Rule compliant',
    });
  });
});
