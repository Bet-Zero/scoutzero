import { describe, expect, it } from 'vitest';
import { mapDraftPickRetained } from '@/features/architect/utils/mapDraftPickRetained';

const fixture = () => {
  const dependencies = ['identity', 'comparison', 'unrelated'].map((id, i) => ({
    id,
    family: [
      'derivative-right-correspondence',
      'contractual-priority-ties',
      'related-obligation-branch',
    ][i],
    authorityStatus: 'unresolved',
    baselineOccurrenceIds: [`o${i}`],
    entitlementIds: ['legacy'],
    controlsAtStart: 'synthetic controlled decision',
    evidenceRefs: ['synthetic#clause'],
    governingAlternativesComplete: false,
    requiredAuthority: ['qualified clause'],
    remainingRouteOrUnblockingEvent: 'actual identity evidence',
    runtimeAuthority: false,
    wholeAssetCertified: false,
  }));
  return {
    release: {
      id: 'synthetic',
      schemaVersion: 1,
      evidenceSha256: 'a'.repeat(64),
      assessmentSha256: 'b'.repeat(64),
      asOf: '2030-01-01T00:00:00Z',
      review: { status: 'accepted', reference: 'synthetic', limitations: [] },
    },
    retained: {
      dependencies,
      entitlements: [
        {
          entitlementId: 'legacy',
          kind: 'swap_right',
          baselineUnderlyingAssetIdsUnchanged: ['synthetic-pick'],
          dependencyIds: dependencies.map((d) => d.id),
          occurrenceIds: ['o0', 'o1', 'o2'],
          positivePathAuthority: 'unavailable',
          wholeAssetCertified: false,
        },
      ],
      occurrences: dependencies.map((d, i) => ({
        id: `o${i}`,
        dependencyIds: [d.id],
        baseline: { id: `o${i}`, entitlementId: 'legacy' },
      })),
      predecessorDependencies: [],
      summary: { asOf: '2030-01-01T00:00:00Z' },
    },
    overlay: dependencies.map((d, i) => ({
      ...d,
      category: i === 0 ? 'A' : 'B',
      structuralDependencyOrScope: i === 0 ? ['BOS/MIL/POR pool'] : [],
    })),
    branchDetails: [
      {
        id: 'comparison',
        retainedDetail: {
          clauseLocators: [
            {
              sourceText:
                'second most favorable of Blazers, Bucks, Celtics picks',
              rawDateLabel: 'undated',
            },
          ],
        },
      },
      {
        id: 'unrelated',
        retainedDetail: {
          clauseLocators: [
            {
              sourceText:
                'least favorable of Cavaliers, Jazz, Timberwolves picks',
            },
          ],
        },
      },
    ],
    retainedArtifacts: [],
  };
};

describe('retained mapping boundary', () => {
  it('links only the source-named pool, despite identical inherited entitlement associations', () => {
    const result = mapDraftPickRetained(fixture());
    expect(result.poolScopeNotes).toHaveLength(1);
    expect(result.poolScopeNotes[0]).toMatchObject({
      dependencyId: 'comparison',
      pool: ['BOS', 'MIL', 'POR'],
      relation: 'shared-pool-scope-only',
    });
    expect(
      result.programs.every(
        (p) => !p.executable && p.completeness === 'unresolved'
      )
    ).toBe(true);
    expect(result.sourceRights).toEqual([]);
    expect(result.retainedBranchDetails).toEqual(fixture().branchDetails);
    expect(result.overlay.map((d) => d.category)).toEqual(['A', 'B', 'B']);
  });
  it('retains an unfamiliar program as unresolved when no recognized clause structure exists', () => {
    const d = fixture();
    d.branchDetails[0].retainedDetail.clauseLocators = [];
    const result = mapDraftPickRetained(d);
    expect(result.programs[0]).toMatchObject({
      clauses: [],
      completeness: 'unresolved',
      executable: false,
    });
    expect(result.poolScopeNotes).toEqual([]);
  });
});
