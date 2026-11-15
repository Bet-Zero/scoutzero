import { EntitlementAssetZ } from '@/schemas/architect';
/** Present-day custody adapter; existing Stepien/Apron/cash engines own rules. */
import type { GovernedDraftWorldBaseline } from '@/schemas/governedDraftWorld';
import type { DraftOriginalFirst } from '@/schemas/draftPickOperation';
import { canonicalStringify } from '../contractSource/deterministicDigest';

export function connectedInterest(
  baseline: Pick<GovernedDraftWorldBaseline, 'connectedPrograms'>,
  id: string
) {
  for (const program of baseline.connectedPrograms ?? []) {
    const interest = program.interests.find((i) => i.entitlementId === id);
    if (interest) return { program, interest };
  }
  return null;
}
/** Stable receipt identity for either an admitted first or a connected second.
 * The full interest's scope lives in the immutable program, never in its anchor. */
export function governedDraftAsset(
  baseline: GovernedDraftWorldBaseline,
  id: string
) {
  const record = baseline.records.find((r) => r.entitlement.id === id);
  if (record)
    return {
      originalTeam: record.ownership.pick.originalTeam,
      year: record.ownership.pick.draftYear,
      round: 1 as const,
    };
  const connected = connectedInterest(baseline, id);
  const e = baseline.retainedEntitlements[id];
  if (connected?.interest.anchorPickId === null && e?.round === 2)
    return {
      originalTeam: String(e.originalTeam),
      year: Number(e.seasonYear),
      round: 2 as const,
    };
  return null;
}
export function originalFirst(id: string): DraftOriginalFirst {
  const match = /^([A-Z]{3})_(\d{4})_1st$/.exec(id);
  if (!match) throw new Error('A first-round original identity is required.');
  return {
    kind: 'authenticated-original-pick',
    id,
    originalTeam: match[1],
    draftYear: Number(match[2]),
    round: 1,
  };
}
export function interestOriginals(
  baseline: GovernedDraftWorldBaseline,
  id: string
) {
  const connected = connectedInterest(baseline, id);
  return connected
    ? connected.interest.possibleOriginals
        .filter((o) => o.endsWith('_1st'))
        .map(originalFirst)
    : baseline.records
        .filter((r) => r.entitlement.id === id)
        .map((r) => r.ownership.pick);
}

/** Cartesian possession, reduced only by identical per-year presence. Stepien
 * depends on presence, not ranking or number beyond one. Keep one real original
 * witness for each present year; never count a bare option as an extra pick.
 */
export function connectedPossessionBranches(
  baseline: GovernedDraftWorldBaseline,
  holders: Record<string, string>,
  team: string
) {
  const covered = new Set(
    (baseline.connectedPrograms ?? []).flatMap((p) => p.originals)
  );
  const unconditional = baseline.records
    .filter(
      (r) =>
        !connectedInterest(baseline, String(r.entitlement.id)) &&
        !covered.has(r.ownership.pick.id) &&
        holders[String(r.entitlement.id)] === team
    )
    .map((r) => r.ownership.pick);
  const reduce = (picks: DraftOriginalFirst[]) =>
    Object.fromEntries(picks.map((p) => [p.draftYear, p]));
  let possibilities = [reduce(unconditional)];
  for (const program of baseline.connectedPrograms ?? []) {
    // A program irrelevant to this team cannot change its possession.
    if (!program.interests.some((i) => holders[i.entitlementId] === team))
      continue;
    const cases = program.possessionCases.map((c) =>
      reduce(
        Object.entries(c.allocation)
          .filter(
            ([pick, interest]) =>
              pick.endsWith('_1st') &&
              interest !== null &&
              holders[interest] === team
          )
          .map(([pick]) => originalFirst(pick))
      )
    );
    const next = new Map<string, Record<string, DraftOriginalFirst>>();
    for (const before of possibilities)
      for (const after of cases) {
        const merged = { ...before, ...after };
        next.set(Object.keys(merged).sort().join(','), merged);
      }
    possibilities = [...next.values()];
  }
  const scope = baseline.stepien[team];
  if (!scope)
    throw new Error('Connected trading needs the complete dated team scope.');
  return possibilities.map((retained, index) => ({
    id: `connected-possession:${team}:${index}`,
    possible: true as const,
    unresolvedDependencyIds: [],
    drafts: Array.from(
      { length: scope.throughDraftYear - scope.firstFutureDraftYear + 1 },
      (_, offset) => {
        const draftYear = scope.firstFutureDraftYear + offset;
        return {
          draftYear,
          inventoryComplete: false,
          retained: retained[draftYear] ? [retained[draftYear]] : [],
        };
      }
    ),
  }));
}

export function validateConnectedBaseline(
  baseline: GovernedDraftWorldBaseline
) {
  const programs = baseline.connectedPrograms ?? [];
  const covered = new Set(programs.flatMap((p) => p.originals));
  const interests = new Set(
    programs.flatMap((p) => p.interests.map((i) => i.entitlementId))
  );
  for (const program of programs)
    for (const interest of program.interests) {
      const e = baseline.retainedEntitlements[interest.entitlementId];
      const record = baseline.records.find(
        (r) => r.entitlement.id === interest.entitlementId
      );
      if (
        e?.identityKey !== `connected|${program.id}|${interest.entitlementId}`
      )
        throw new Error(
          'A connected interest needs its distinct immutable identity.'
        );
      if (interest.anchorPickId === null) {
        if (
          !e ||
          record ||
          !baseline.initialTeams[String(e.holderTeam)] ||
          e.description !== interest.terms ||
          !EntitlementAssetZ.strict().safeParse(e).success ||
          e.round !== 2 ||
          e.underlyingStatus !== 'encumbered' ||
          e.underlyingPickId !== interest.possibleOriginals[0] ||
          e.originalTeam !== interest.possibleOriginals[0].split('_')[0] ||
          e.seasonYear !== Number(interest.possibleOriginals[0].split('_')[1])
        )
          throw new Error(
            'A reserved second-round counterpart must remain retained separately.'
          );
        continue;
      }
      if (
        !e ||
        !baseline.initialTeams[String(e.holderTeam)] ||
        !record ||
        record.ownership.pick.id !== interest.anchorPickId ||
        e.description !== interest.terms ||
        e.underlyingStatus !== 'encumbered' ||
        record.ownership.claims.length !== 1 ||
        record.ownership.claims[0].team !== e.holderTeam ||
        record.ownership.claims[0].status !==
          'owned-conditional-selection-right' ||
        canonicalStringify(e) !== canonicalStringify(record.entitlement)
      )
        throw new Error(
          'Connected rights must retain their exact source scope, terms and initial custody.'
        );
    }
  if (
    baseline.records.some(
      (r) =>
        covered.has(r.ownership.pick.id) &&
        !interests.has(String(r.entitlement.id))
    )
  )
    throw new Error(
      'An underlying original cannot also be admitted outside its connected claims.'
    );
}
