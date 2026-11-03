import type { DraftOverlappingPoolProgram } from '@/schemas/draftOverlappingPool';

// Independent software analogue: A receives C conditionally, then B and D
// options, E consumes B's residual, F has priority over G, then E takes G's residual.
export const teams = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF', 'GGG'];
const binding = { sourceRefs: ['software-terms'], dependencyIds: ['terms'] };
const claim = (
  holderTeam: string,
  targetTeam: string,
  eligibleReturnIds: string[],
  i: number,
  representationIds = [`right-${i}`]
) => ({
  ...binding,
  clauseId: `native-${i}`,
  representationIds,
  holderTeam,
  targetTeam,
  eligibleReturnIds,
  dependencyIds: [
    'terms',
    ...representationIds.map((id) => `right-correspondence:${id}`),
  ],
  election: 'exercise-only' as const,
});
export const program: DraftOverlappingPoolProgram = {
  kind: 'native-overlapping-pool-v1',
  year: 2028,
  slots: teams.map((originalTeam) => ({
    entitlementId: originalTeam,
    originalTeam,
    holderTeam: originalTeam,
    protectedThrough: 0,
  })),
  conveyance: {
    ...binding,
    entitlementId: 'CCC',
    recipientTeam: 'AAA',
    protectedThrough: 8,
    priorObligation: 'satisfied',
    scope: 'first-round-only',
  },
  claims: [
    claim('AAA', 'BBB', ['AAA', 'CCC'], 1),
    claim('AAA', 'DDD', ['AAA', 'BBB'], 2),
    claim('EEE', 'BBB', ['EEE'], 3, ['right-3', 'duplicate-3']),
    claim('FFF', 'GGG', ['FFF'], 4),
    claim('EEE', 'GGG', ['EEE', 'AAA', 'BBB', 'CCC'], 5, []),
  ],
  unrelatedClaims: [
    {
      ...binding,
      representationId: 'unrelated',
      originalPickIds: ['HHH_2028_1st', 'III_2028_1st'],
      dependencyIds: ['right-correspondence:unrelated'],
    },
  ],
  result: null,
};
