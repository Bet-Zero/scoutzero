import { describe, expect, it } from 'vitest';
import { evaluatePartialBranchCleanupEligibility } from './partialBranchCleanup';

const childWorldId = 'world_child';
const expectedParentWorldId = 'world_parent';
const ownerId = 'owner-a';

const partialChild = () => ({
  worldId: childWorldId,
  createdBy: ownerId,
  parentWorldId: expectedParentWorldId,
  branchedFrom: '2026-08-11T00:00:00.000Z',
  childWorlds: [],
  isArchived: true,
});

const parent = () => ({
  worldId: expectedParentWorldId,
  createdBy: ownerId,
  childWorlds: [],
});

describe('partial branch cleanup eligibility', () => {
  it('accepts a hidden unfinished child and its exact parent', () => {
    expect(
      evaluatePartialBranchCleanupEligibility({
        childWorldId,
        expectedParentWorldId,
        ownerId,
        child: partialChild(),
        parent: parent(),
      })
    ).toEqual({ eligible: true });
  });

  it.each([
    ['visible child', { isArchived: false }, 'child-is-visible'],
    ['non-child target', { parentWorldId: null }, 'child-not-branch'],
    ['mismatched parent', { parentWorldId: 'world_other' }, 'child-not-branch'],
  ])('refuses a %s', (_label, childUpdate, reason) => {
    expect(
      evaluatePartialBranchCleanupEligibility({
        childWorldId,
        expectedParentWorldId,
        ownerId,
        child: { ...partialChild(), ...childUpdate },
        parent: parent(),
      })
    ).toEqual({ eligible: false, reason });
  });

  it('refuses finalized lineage even if the child is archived later', () => {
    expect(
      evaluatePartialBranchCleanupEligibility({
        childWorldId,
        expectedParentWorldId,
        ownerId,
        child: partialChild(),
        parent: { ...parent(), childWorlds: [childWorldId] },
      })
    ).toEqual({ eligible: false, reason: 'child-lineage-attached' });
  });

  it('accepts an exact existing claim for idempotent queued retry', () => {
    expect(
      evaluatePartialBranchCleanupEligibility({
        childWorldId,
        expectedParentWorldId,
        ownerId,
        child: {
          ...partialChild(),
          partialBranchCleanupClaim: {
            state: 'claimed',
            childWorldId,
            parentWorldId: expectedParentWorldId,
            ownerId,
          },
        },
        parent: parent(),
      })
    ).toEqual({ eligible: true });
  });

  it('fails closed for unavailable, malformed, or claim-mismatched state', () => {
    const cases = [
      {
        child: partialChild(),
        parent: null,
        reason: 'parent-unavailable',
      },
      {
        child: partialChild(),
        parent: { ...parent(), childWorlds: 'not-an-array' },
        reason: 'parent-lineage-malformed',
      },
      {
        child: {
          ...partialChild(),
          partialBranchCleanupClaim: {
            state: 'claimed',
            childWorldId,
            parentWorldId: 'world_other',
            ownerId,
          },
        },
        parent: parent(),
        reason: 'cleanup-claim-mismatch',
      },
    ];

    for (const entry of cases) {
      expect(
        evaluatePartialBranchCleanupEligibility({
          childWorldId,
          expectedParentWorldId,
          ownerId,
          child: entry.child,
          parent: entry.parent,
        })
      ).toEqual({ eligible: false, reason: entry.reason });
    }
  });
});
