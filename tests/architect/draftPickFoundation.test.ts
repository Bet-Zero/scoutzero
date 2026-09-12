import { describe, expect, it } from 'vitest';
import {
  buildDraftPickFoundation,
  inspectDraftDependency,
} from '@/features/architect/utils/draftPickFoundation';
import { DraftEvidenceAssertionZ } from '@/schemas/draftPickEvidence';

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

describe('bounded evidence foundation', () => {
  it('preserves every retained object, evidence state, edge and predecessor without minting rights', () => {
    const input = syntheticFoundationInput();
    const foundation = buildDraftPickFoundation(input);
    expect(foundation.retained).toEqual(input.retained);
    expect(foundation.sourceRights).toEqual([]);
    expect(foundation.originalPicks).toEqual([
      {
        id: 'AAA_2030_1st',
        role: 'referenced-original-pick',
        holderEvidence: null,
        ownershipVerdict: 'not-evaluated',
      },
    ]);
    expect(foundation.legacyRecords[1].identity).toBe(
      'candidate-correspondence'
    );
    expect(
      foundation.legacyRecords.every((e) => !e.wholeAssetReady && !e.executable)
    ).toBe(true);
    expect(foundation.programs[0].executable).toBe(false);
    expect(foundation.execution).toBe('disabled');
  });

  it('keeps the five states separate from readiness categories and never treats absence of questions as readiness', () => {
    const f = buildDraftPickFoundation(syntheticFoundationInput());
    expect(inspectDraftDependency(f, 'd2').status).toBe(
      'proven non-applicable'
    );
    expect(inspectDraftDependency(f, 'd1')).toMatchObject({
      status: 'legitimate future outcome pending',
      governingAlternativesComplete: true,
      executable: false,
    });
    expect(inspectDraftDependency(f, 'missing').status).toBe('blocked');
    expect(
      f.legacyRecords[1].dependencies.find((d) => d.id === 'd3')
    ).toMatchObject({ evidenceState: 'unresolved', readinessCategory: 'A' });
  });

  it('does not alias input annotations and freezes the derived records', () => {
    const input = syntheticFoundationInput();
    const f = buildDraftPickFoundation(input);
    input.retained.dependencies[0].retainedAnnotation.captureDate =
      '2099-01-01';
    expect(f.retained.dependencies[0].retainedAnnotation).toEqual({
      captureDate: '2030-06-06',
      effectiveDate: null,
    });
    expect(Object.isFrozen(f.retained.dependencies[0].retainedAnnotation)).toBe(
      true
    );
  });

  it.each([
    'lost-occurrence',
    'lost-dependency',
    'duplicate-id',
    'overlay-promotion',
    'overlay-controls',
    'reverse-edge',
    'predecessor',
    'as-of',
    'executable-program',
  ])('rejects %s', (kind) => {
    const input = syntheticFoundationInput();
    if (kind === 'lost-occurrence') input.retained.occurrences.pop();
    if (kind === 'lost-dependency') input.retained.dependencies.pop();
    if (kind === 'duplicate-id')
      input.retained.entitlements[1].entitlementId = 'legacy-own';
    if (kind === 'overlay-promotion')
      input.overlay[0].authorityStatus = 'supported in stated scope';
    if (kind === 'overlay-controls')
      input.overlay[0].controlsAtStart = 'different operation';
    if (kind === 'reverse-edge')
      input.retained.dependencies[0].entitlementIds.pop();
    if (kind === 'predecessor')
      input.retained.predecessorDependencies[0].affectedEntitlementIds = [
        'absent',
      ];
    if (kind === 'as-of') input.release.asOf = '2030-06-06T12:00:00Z';
    if (kind === 'executable-program') input.programs[0].executable = true;
    expect(() => buildDraftPickFoundation(input)).toThrow();
  });

  it('requires pool notes to reference retained clauses for the same dependency', () => {
    const base = syntheticFoundationInput();
    base.retained.dependencies[3].family = 'contractual-priority-ties';
    base.overlay.find((d) => d.id === 'd3')!.family =
      'contractual-priority-ties';
    const input = {
      ...base,
      poolScopeNotes: [
        {
          dependencyId: 'd3',
          pool: ['AAA', 'BBB'],
          sourceNamedMembers: ['AAA', 'BBB'],
          clauseRef: 'synthetic-source#clause',
          relation: 'shared-pool-scope-only',
        },
      ],
    };
    expect(buildDraftPickFoundation(input).poolScopeNotes).toEqual(
      input.poolScopeNotes
    );
    input.poolScopeNotes[0].clauseRef = 'missing-clause';
    expect(() => buildDraftPickFoundation(input)).toThrow('Pool scope');
    input.poolScopeNotes[0].clauseRef = 'synthetic-source#clause';
    input.programs[0].dependencyId = 'd0';
    expect(() => buildDraftPickFoundation(input)).toThrow('Pool scope');
  });

  it('retains scoped support and review limitations without treating storage as runtime approval', () => {
    const source = {
      id: 'synthetic',
      artifactSha256: 'c'.repeat(64),
      locator: 'source#clause',
      scope: 'one component only',
      qualification: 'qualified',
      publishedAt: null,
      capturedAt: null,
      review: {
        status: 'accepted-with-limitations',
        reference: 'synthetic-review',
        limitations: ['Does not establish a whole asset'],
      },
    };
    const assertion = {
      id: 'claim',
      status: 'supported in stated scope',
      claim: 'component support',
      effectiveAt: null,
      effectiveDateScope: 'unknown',
      sources: [source],
      alternatives: [],
      governingAlternativesComplete: false,
      unresolvedDependencyIds: ['d3'],
    };
    const input = { ...syntheticFoundationInput(), assertions: [assertion] };
    const f = buildDraftPickFoundation(input);
    expect(f.assertions[0]).toEqual(assertion);
    expect(f.execution).toBe('disabled');
    source.qualification = 'unqualified';
    expect(() => buildDraftPickFoundation(input)).toThrow(
      'qualified scoped source'
    );
  });

  it('requires explicit complete future alternatives and separates effective dates from captures', () => {
    const assertion = {
      id: 'event',
      status: 'legitimate future outcome pending',
      claim: 'pending choice',
      effectiveAt: null,
      effectiveDateScope: 'not yet occurred',
      sources: [],
      alternatives: [],
      governingAlternativesComplete: false,
      unresolvedDependencyIds: [],
    };
    expect(DraftEvidenceAssertionZ.safeParse(assertion).success).toBe(false);
    expect(
      DraftEvidenceAssertionZ.parse({
        ...assertion,
        governingAlternativesComplete: true,
        alternatives: [
          { id: 'a', condition: 'above', consequence: 'freeze' },
          {
            id: 'b',
            condition: 'at-or-below',
            consequence: 'no freeze trigger',
          },
        ],
      }).effectiveAt
    ).toBeNull();
  });
});
