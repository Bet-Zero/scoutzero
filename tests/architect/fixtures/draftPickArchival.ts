import { syntheticFoundationInput } from './draftPickFoundation';

/** Entirely synthetic twelve-alias/two-pool analogue; no private evidence. */
export function syntheticArchivalInput() {
  const base = syntheticFoundationInput();
  const families = [
    ['AAA', 'BBB', 'CCC'],
    ['DDD', 'EEE', 'FFF'],
  ];
  const rows = families.flatMap((teams, n) =>
    teams.flatMap((holder, i) =>
      ['swap_right', 'conveyance_right'].map((kind, j) => {
        const legacyId = `synthetic-alias-${n}-${i}-${j}`;
        return {
          dependencyId: `synthetic-correspondence-${legacyId}`,
          legacyId,
          archivalRole: 'generated-projection-provenance-only',
          legacyMeaningPreserved: {
            id: legacyId,
            holderTeam: holder,
            kind,
            seasonYear: 2030,
            round: 1,
            receivesRank: [j + 1],
            receivesComparator: 'synthetic-raw-selector',
            evidenceRowRefs: [`row-${n}-${i}`],
            description: 'Uninterpreted archival text',
          },
          exactGeneratorPreimage: `synthetic-preimage-${legacyId}`,
          nativePoolFamily: `${teams.join('/')}:2030`,
          nativePoolClauseIds: [`synthetic-native-${n}`],
          sourceParagraphIds: [`synthetic-paragraph-${n}`],
          occurrenceIds: [`synthetic-occurrence-${legacyId}`],
          economicCorrespondence: 'unresolved',
          transferableRightEstablished: false,
          executable: false,
          accountingDelta: 0,
          reviewStatus: 'unreviewed-author-sidecar',
        };
      })
    )
  );
  const map = {
    predecessorArchiveSha256: 'c'.repeat(64),
    predecessorMappingSha256: 'd'.repeat(64),
    scope: 'Synthetic archival fixture',
    rows,
    pools: Object.fromEntries(
      families.map((teams, n) => [
        `${teams.join('/')}:2030`,
        {
          referencedOriginalPicks: teams.map((t) => `${t}_2030_1st`),
          legacyProjectionCount: 6,
          allocationAuthority: 'No allocation authority',
          sourceFactId: `synthetic-fact-${n}`,
          sharedDependencyId: `synthetic-shared-${n}`,
        },
      ])
    ),
    allTwelveDependenciesRemainUnresolved: true,
  };
  const native = {
    nativeClauses: families.map((teams, n) => ({
      id: `synthetic-native-${n}`,
      years: [2030],
      signature: {
        round: 1,
        semantic: {
          children: [
            {
              kind: 'selection',
              parameters: {
                contextYear: 2030,
                members: teams,
                rank: n + 1,
                tieRule: 'not-stated',
              },
            },
          ],
        },
      },
      locators: [
        { exactText: 'Unchanged native source text', capturedAt: '2030-06-06' },
      ],
    })),
    rights: rows.map((r) => ({
      legacyId: r.legacyId,
      legacyComparison: structuredClone(r.legacyMeaningPreserved),
      candidateClauses: ['opaque retained original annotation'],
    })),
  };
  const dependencies = rows.map((r) => ({
    ...base.retained.dependencies[3],
    id: r.dependencyId,
    entitlementIds: [r.legacyId],
    baselineOccurrenceIds: r.occurrenceIds,
    authorityStatus: 'unresolved',
  }));
  return {
    ...base,
    retained: {
      ...base.retained,
      dependencies,
      entitlements: rows.map((r) => ({
        entitlementId: r.legacyId,
        kind: r.legacyMeaningPreserved.kind,
        // Deliberately broad inherited associations cannot choose the native pool.
        baselineUnderlyingAssetIdsUnchanged: families
          .flat()
          .map((t) => `${t}_2030_1st`),
        dependencyIds: [r.dependencyId],
        occurrenceIds: r.occurrenceIds,
        positivePathAuthority: 'unavailable',
        wholeAssetCertified: false,
      })),
      occurrences: rows.map((r) => ({
        id: r.occurrenceIds[0],
        dependencyIds: [r.dependencyId],
        baseline: {
          id: r.occurrenceIds[0],
          entitlementId: r.legacyId,
          retainedText: 'Never rewritten',
        },
      })),
      predecessorDependencies: [
        {
          id: 'synthetic-predecessor',
          affectedEntitlementIds: [rows[0].legacyId],
        },
      ],
    },
    overlay: [],
    programs: [],
    retainedArtifacts: [
      {
        id: 'archival-map',
        sha256: 'e'.repeat(64),
        scope: 'synthetic provenance',
        review: {
          status: 'unreviewed',
          reference: 'synthetic-review',
          limitations: ['no economic authority'],
        },
        content: map,
      },
      {
        id: 'native-index',
        sha256: 'f'.repeat(64),
        scope: 'synthetic native source index',
        review: {
          status: 'accepted-with-limitations',
          reference: 'synthetic-review',
          limitations: ['source observations only'],
        },
        content: native,
      },
    ],
  };
}

export const archivalSelection = {
  mapArtifactId: 'archival-map',
  nativeIndexArtifactId: 'native-index',
};
