// All claims, IDs and source fingerprints in public fixtures are synthetic.
export function syntheticFoundationInput() {
  const statuses = [
    'supported in stated scope',
    'legitimate future outcome pending',
    'proven non-applicable',
    'unresolved',
    'conflicting',
  ] as const;
  const dependencies = statuses.map((status, i) => ({
    id: `d${i}`,
    family: i === 3 ? 'derivative-right-correspondence' : 'synthetic-fact',
    authorityStatus: status,
    baselineOccurrenceIds: [`o${i}`],
    entitlementIds: ['legacy-own', 'legacy-projection'],
    controlsAtStart: `synthetic controlled decision ${i}`,
    evidenceRefs: [`source#claim-${i}`],
    governingAlternativesComplete: i < 3,
    requiredAuthority: ['scoped source'],
    remainingRouteOrUnblockingEvent: 'qualified evidence or actual event',
    runtimeAuthority: false as const,
    wholeAssetCertified: false as const,
    retainedAnnotation: { captureDate: '2030-06-06', effectiveDate: null },
  }));
  return {
    release: {
      id: 'synthetic-v1',
      schemaVersion: 1,
      evidenceSha256: 'a'.repeat(64),
      assessmentSha256: 'b'.repeat(64),
      asOf: '2030-06-05T12:00:00Z',
      review: {
        status: 'accepted-with-limitations',
        reference: 'synthetic-review',
        limitations: ['storage only'],
      },
    },
    retained: {
      dependencies,
      entitlements: ['legacy-own', 'legacy-projection'].map(
        (entitlementId, i) => ({
          entitlementId,
          kind: i === 0 ? 'pick_ownership' : 'swap_right',
          baselineUnderlyingAssetIdsUnchanged: ['AAA_2030_1st'],
          dependencyIds: dependencies.map((d) => d.id),
          occurrenceIds: i === 0 ? [] : dependencies.map((_, n) => `o${n}`),
          positivePathAuthority: 'unavailable',
          wholeAssetCertified: false,
        })
      ),
      occurrences: dependencies.map((d, i) => ({
        id: `o${i}`,
        dependencyIds: [d.id],
        baseline: {
          id: `o${i}`,
          entitlementId: 'legacy-projection',
          originalText: 'retained synthetic clause',
        },
      })),
      predecessorDependencies: [
        {
          id: 'predecessor',
          affectedEntitlementIds: ['legacy-own'],
          applicability: 'branch relevance unresolved',
        },
      ],
      summary: { asOf: '2030-06-05T12:00:00Z', acceptedAccounting: statuses },
    },
    overlay: dependencies
      .filter((_, i) => i === 1 || i >= 3)
      .map((d) => ({
        ...d,
        category: d.id === 'd3' ? 'A' : d.id === 'd4' ? 'D' : 'C',
        structuralDependencyOrScope: [],
      })),
    assertions: [],
    sourceRights: [],
    programs: [
      {
        id: 'unknown-program',
        dependencyId: 'd3',
        clauses: [
          {
            text: 'An unfamiliar contingent obligation',
            sourceRef: 'synthetic-source#clause',
            parsed: null,
          },
        ],
        completeness: 'unresolved',
        executable: false,
      },
    ],
    poolScopeNotes: [],
    retainedArtifacts: [],
    retainedBranchDetails: [],
  };
}
