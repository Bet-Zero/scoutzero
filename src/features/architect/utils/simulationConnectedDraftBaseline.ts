/** Add source-supplied connected interests to a new immutable simulation package.
 * Existing world packages and their identities are never rewritten.
 */
import { DraftConnectedProgramsZ } from '@/schemas/draftConnectedRights';
import type { GovernedDraftWorldBaseline } from '@/schemas/governedDraftWorld';
import { validateGovernedDraftBaseline } from './governedDraftWorld.validation';
import { originalFirst } from './draftReview/connectedRights';

export function compileSimulationConnectedDraftBaseline(args: {
  baseline: GovernedDraftWorldBaseline;
  programs: unknown;
  holders: Record<string, string>;
  releaseId: string;
  sourceSha256: string;
}) {
  const baseline = structuredClone(
    validateGovernedDraftBaseline(args.baseline)
  );
  if (
    baseline.classification !== 'simulation' ||
    baseline.connectedPrograms?.length ||
    !/^[a-f0-9]{64}$/.test(args.sourceSha256)
  )
    throw new Error(
      'A new pinned simulation package and complete source digest are required.'
    );
  const programs = DraftConnectedProgramsZ.parse(args.programs);
  const originals = new Set(programs.flatMap((p) => p.originals));
  for (const original of originals) {
    if (!original.endsWith('_1st')) continue;
    const matches = baseline.identities
      .map((id) => baseline.retainedEntitlements[id])
      .filter((e) => e.underlyingPickId === original);
    if (
      matches.length !== 1 ||
      matches[0].simulationRestriction === 'forfeited'
    )
      throw new Error(
        'Connected programs cannot invent or restore a forfeited original.'
      );
  }
  const represented = new Set(
    baseline.identities.filter((id) =>
      originals.has(String(baseline.retainedEntitlements[id].underlyingPickId))
    )
  );
  baseline.records = baseline.records.filter(
    (r) => !represented.has(String(r.entitlement.id))
  );
  baseline.unresolved = baseline.unresolved.filter(
    (u) => !u.entitlementIds.every((id) => represented.has(id))
  );
  for (const id of represented)
    baseline.retainedEntitlements[id].simulationRestriction = 'represented';
  baseline.connectedPrograms = programs;
  baseline.releaseId = args.releaseId;
  const evidence = Object.values(baseline.stepien)[0];
  for (const program of programs)
    for (const interest of program.interests) {
      const id = interest.entitlementId;
      const holderTeam = args.holders[id];
      if (
        baseline.identities.includes(id) ||
        !baseline.initialTeams[holderTeam]
      )
        throw new Error(
          'A connected interest needs a distinct identity and a retained team holder.'
        );
      const anchor = interest.anchorPickId ?? interest.possibleOriginals[0];
      const [originalTeam, year] = anchor.split('_');
      const entitlement = {
        id,
        identityKey: `connected|${program.id}|${id}`,
        holderTeam,
        originalTeam,
        seasonYear: Number(year),
        round: interest.anchorPickId ? 1 : 2,
        kind: 'pick_ownership' as const,
        underlyingPickId: anchor,
        underlyingStatus: 'encumbered' as const,
        description: interest.terms,
      };
      baseline.identities.push(id);
      baseline.retainedEntitlements[id] = entitlement;
      (baseline.initialTeams[holderTeam].entitlementIds as string[]).push(id);
      if (interest.anchorPickId)
        baseline.records.push({
          entitlement,
          ownership: {
            id: `connected-ownership:${id}`,
            scope: 'original-pick-ownership',
            status: evidence.status,
            effectiveAt: baseline.asOf,
            validUntil: null,
            sources: evidence.sources.map((s) => ({
              ...s,
              artifactSha256: args.sourceSha256,
              scope: 'original-pick-ownership',
              locator: `connected-program:${program.id}/${id}`,
            })),
            unresolvedDependencyIds: [],
            pick: originalFirst(anchor),
            claimCoverage: 'complete',
            claims: [
              {
                id: `connected-holder:${id}`,
                team: holderTeam,
                status: 'owned-conditional-selection-right',
              },
            ],
          },
        });
    }
  for (const pick of originals) {
    if (
      !pick.endsWith('_1st') ||
      baseline.apron.some((a) => a.originalPick.id === pick)
    )
      continue;
    const original = originalFirst(pick);
    const history = baseline.apron
      .filter((a) => a.team === original.originalTeam)
      .flatMap((a) => a.observations);
    const trigger = original.draftYear - 8;
    baseline.apron.push({
      team: original.originalTeam,
      triggerSeasonStartYear: trigger,
      originalPick: {
        id: original.id,
        originalTeam: original.originalTeam,
        draftYear: original.draftYear,
        round: 1,
      },
      asOf: baseline.asOf,
      observations: [
        ...new Map(
          history
            .filter(
              (o) =>
                o.seasonStartYear >= trigger && o.seasonStartYear <= trigger + 4
            )
            .map((o) => [o.seasonStartYear, o])
        ).values(),
      ],
      regularSeasonEnds: [],
    });
  }
  baseline.assumptions = (baseline.assumptions ?? []).filter(
    (a) =>
      ![
        'unconditional-transfer-only',
        'current-reported-holder',
        'complete-league-inventory',
      ].includes(a.id)
  );
  baseline.assumptions.push(
    {
      id: 'current-connected-selection-rights',
      statement:
        'Current selection interests retain the November 14 public protection, swap priority, pool and fallback terms. A transfer changes only the holder of that interest, including its attached fallback; it does not choose a draft outcome. Every possible possession pattern is tested for Stepien. Referenced originals are not duplicate tradeable assets.',
    },
    {
      id: 'complete-league-inventory',
      statement:
        'The retained thirty-team current first-round inventory and connected possession classes are treated as complete under the public-data simulation standard. Ranking outcomes with identical first-round possession share a class; no final draft order is assumed. Genuinely unresolved terms remain unavailable and never supply a Stepien witness.',
    }
  );
  return validateGovernedDraftBaseline(baseline);
}
