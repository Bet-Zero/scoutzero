import { describe, expect, it } from 'vitest';
import { validateStepien } from '@/features/architect/utils/tradeMachine/rules/validateStepien';
import {
  buildStepienOutgoingPicksFromEntitlements,
  isPooledEntitlement,
  isStepienRelevantKind,
} from '@/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils';

describe('stepienEntitlementUtils', () => {
  it('distinguishes pooled from governed clean and encumbered records', () => {
    expect(isPooledEntitlement({ underlyingStatus: 'pooled' })).toBe(true);
    expect(isPooledEntitlement({ underlyingStatus: 'clean' })).toBe(false);
    expect(isPooledEntitlement({ underlyingStatus: 'encumbered' })).toBe(false);
    expect(isPooledEntitlement({})).toBe(false);
  });

  it('recognizes the supported first-round entitlement kinds', () => {
    expect(isStepienRelevantKind('pick_ownership')).toBe(true);
    expect(isStepienRelevantKind('swap_right')).toBe(true);
    expect(isStepienRelevantKind('conveyance_right')).toBe(true);
    expect(isStepienRelevantKind('other')).toBe(false);
  });

  it('normalizes supported outgoing entitlements and filters pooled/R2 records', () => {
    const result = buildStepienOutgoingPicksFromEntitlements([
      {
        id: 'ownership',
        kind: 'pick_ownership',
        round: 1,
        seasonYear: 2027,
        underlyingStatus: 'clean',
      },
      {
        id: 'swap',
        kind: 'swap_right',
        round: 1,
        seasonYear: 2028,
        underlyingStatus: 'encumbered',
      },
      {
        id: 'pooled',
        kind: 'conveyance_right',
        round: 1,
        seasonYear: 2029,
        underlyingStatus: 'pooled',
      },
      {
        id: 'second',
        kind: 'pick_ownership',
        round: 2,
        seasonYear: 2030,
        underlyingStatus: 'clean',
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      year: 2027,
      round: 1,
      isSwap: false,
      _entitlementId: 'ownership',
    });
    expect(result[1]).toMatchObject({
      year: 2028,
      round: 1,
      isSwap: true,
      _entitlementId: 'swap',
    });
  });
});

const makeTeam = (entitlementsOut: Array<Record<string, unknown>>) => ({
  teamId: 'TEST',
  team: { picks: [] },
  context: { yearKey: 2025 },
  outgoingPicks: [],
  validationEntitlements: [],
  entitlementsOut,
});

describe('validateStepien entitlement authority boundary', () => {
  it.each([
    ['pick ownership', 'pick_ownership', 2027],
    ['swap right', 'swap_right', 2029],
    ['conveyance right', 'conveyance_right', 2031],
  ])('fails closed for a first-round %s', (_label, kind, seasonYear) => {
    const result = validateStepien(
      makeTeam([
        {
          id: `${kind}-${seasonYear}`,
          kind,
          round: 1,
          seasonYear,
          underlyingStatus: 'clean',
        },
      ])
    );

    expect(result).toMatchObject({
      passed: false,
      status: 'NEEDS_INPUT',
      evaluated: false,
    });
    expect(result.missingInputs).not.toContain('acceptedCanon.CBA2-A12.3');
    expect(result.missingInputs).toEqual(
      expect.arrayContaining([
        'governedDraftHistory.ownership',
        'governedDraftHistory.protection',
        'governedDraftHistory.conveyance',
      ])
    );
  });

  it('does not let partial protection metadata create a legality result', () => {
    const result = validateStepien(
      makeTeam([
        {
          id: 'protected-2034',
          kind: 'pick_ownership',
          round: 1,
          seasonYear: 2034,
          underlyingStatus: 'encumbered',
          protectionLadder: [
            {
              year: 2034,
              condition: 'Top 3',
              ifTriggered: 'roll',
              rollToYear: 2035,
            },
          ],
        },
      ])
    );

    expect(result.status).toBe('NEEDS_INPUT');
    expect(result.missingInputs).toContain('governedDraftHistory.protection');
  });

  it('keeps round-two entitlement trading supported', () => {
    const result = validateStepien(
      makeTeam([
        {
          id: 'second-2027',
          kind: 'pick_ownership',
          round: 2,
          seasonYear: 2027,
          underlyingStatus: 'clean',
        },
      ])
    );

    expect(result.passed).toBe(true);
    expect(result.status).toBe('PASS');
  });
});
