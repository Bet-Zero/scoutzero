import { describe, expect, it } from 'vitest';
import { validateStepien } from '@/features/architect/utils/tradeMachine/rules/validateStepien';
import { buildStepienBaselinePicksFromEntitlements } from '@/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils';

const makeEntitlement = (overrides: Record<string, unknown>) => ({
  id: `ent-${overrides.seasonYear ?? 2026}`,
  kind: 'pick_ownership',
  round: 1,
  seasonYear: 2026,
  underlyingStatus: 'clean',
  ...overrides,
});

describe('buildStepienBaselinePicksFromEntitlements', () => {
  it('returns an empty baseline for absent input', () => {
    expect(buildStepienBaselinePicksFromEntitlements([])).toEqual([]);
    expect(buildStepienBaselinePicksFromEntitlements(null)).toEqual([]);
    expect(buildStepienBaselinePicksFromEntitlements(undefined)).toEqual([]);
  });

  it.each([
    ['pick_ownership', false],
    ['swap_right', true],
    ['conveyance_right', false],
  ])('normalizes a %s record', (kind, isSwap) => {
    const result = buildStepienBaselinePicksFromEntitlements([
      makeEntitlement({ kind, seasonYear: 2028 }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      year: 2028,
      round: 1,
      isSwap,
      _source: 'entitlement_baseline',
    });
  });

  it('filters pooled and second-round baseline records', () => {
    const result = buildStepienBaselinePicksFromEntitlements([
      makeEntitlement({ underlyingStatus: 'pooled' }),
      makeEntitlement({ id: 'round-two', round: 2 }),
    ]);

    expect(result).toEqual([]);
  });
});

const makeTeam = (overrides: Record<string, unknown>) => ({
  teamId: 'TEST',
  team: { picks: [] },
  context: { yearKey: 2025 },
  outgoingPicks: [],
  validationEntitlements: [],
  entitlementsOut: [],
  ...overrides,
});

describe('validateStepien with partial governed baseline', () => {
  it('does not mistake a populated baseline for complete governed history', () => {
    const result = validateStepien(
      makeTeam({
        validationEntitlements: [
          makeEntitlement({ seasonYear: 2027 }),
          makeEntitlement({ kind: 'swap_right', seasonYear: 2028 }),
        ],
        entitlementsOut: [makeEntitlement({ seasonYear: 2027 })],
      }),
      { yearKey: 2025 }
    );

    expect(result).toMatchObject({
      passed: false,
      status: 'NEEDS_INPUT',
      evaluated: false,
    });
    expect(result.missingInputs).toContain('governedDraftHistory.ownership');
    expect(result.missingInputs).toContain('governedDraftHistory.freeze');
  });

  it('fails closed for a different direct first-round year', () => {
    const result = validateStepien(
      makeTeam({
        validationEntitlements: [makeEntitlement({ seasonYear: 2033 })],
        outgoingPicks: [{ year: 2033, round: '1st' }],
      }),
      { yearKey: 2026 }
    );

    expect(result.status).toBe('NEEDS_INPUT');
    expect(result.passed).toBe(false);
  });

  it('keeps a second-round outgoing entitlement outside the Stepien gate', () => {
    const result = validateStepien(
      makeTeam({
        validationEntitlements: [makeEntitlement({ round: 2 })],
        entitlementsOut: [makeEntitlement({ round: 2 })],
      })
    );

    expect(result.passed).toBe(true);
    expect(result.status).toBe('PASS');
  });
});
