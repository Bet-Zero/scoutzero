import {
  DraftOverlappingPoolProgramZ,
  type DraftOverlappingPoolProgram,
} from '@/schemas/draftOverlappingPool';
import type { SimulationCatalogue } from './simulationInventory';
import { canonicalStringify } from '../contractSource/deterministicDigest';
import { resolveSwapForEntitlement } from '../entitlements/dare/swapResolutionAdapter';

const same = (a: string[], b: string[]) =>
  canonicalStringify([...a].sort()) === canonicalStringify([...b].sort());

/** Validate native coverage without promoting retained representations into rights. */
export function overlappingPoolProgram(
  input: unknown,
  catalogue: SimulationCatalogue,
  entitlements: Record<string, Record<string, unknown>>
) {
  const p = DraftOverlappingPoolProgramZ.parse(input);
  const originals = p.slots.map((s) => {
    const row = catalogue.data.records.find(
      (r) => r.entitlementId === s.entitlementId
    );
    if (
      row?.role !== 'original' ||
      row.originalPick?.draftYear !== p.year ||
      row.originalPick.originalTeam !== s.originalTeam ||
      entitlements[s.entitlementId]?.kind !== 'pick_ownership'
    )
      throw new Error(
        'Overlapping claims require exact retained same-draft originals.'
      );
    return row.originalPick.id;
  });
  const retained = catalogue.release.foundation.retained;
  const relevant = retained.entitlements
    .filter(
      (e) =>
        e.kind !== 'pick_ownership' &&
        e.baselineUnderlyingAssetIdsUnchanged.some((id) =>
          originals.includes(id)
        )
    )
    .map((e) => e.entitlementId);
  const represented = p.claims.flatMap((c) => c.representationIds);
  if (
    !same(relevant, [
      ...represented,
      ...p.unrelatedClaims.map((c) => c.representationId),
    ])
  )
    throw new Error(
      'Every overlapping retained representation needs its native disposition.'
    );
  for (const claim of p.claims) {
    for (const id of claim.representationIds) {
      const record = catalogue.data.records.find((r) => r.entitlementId === id);
      const right = entitlements[id];
      if (
        !record ||
        record.role === 'generated-alias' ||
        !right ||
        !['swap_right', 'conveyance_right'].includes(String(right.kind)) ||
        right.holderTeam !== claim.holderTeam ||
        right.seasonYear !== p.year ||
        right.round !== 1 ||
        !claim.dependencyIds.includes(`right-correspondence:${id}`)
      )
        throw new Error(
          'A native option must match its retained representations and holder.'
        );
    }
  }
  for (const c of p.unrelatedClaims) {
    if (
      c.originalPickIds.some((id) => originals.includes(id)) ||
      !c.dependencyIds.includes(`right-correspondence:${c.representationId}`)
    )
      throw new Error(
        'An overlapping native right cannot be dismissed as navigation.'
      );
    const right = entitlements[c.representationId];
    if (
      !right ||
      (typeof right.swapControllerPickId === 'string' &&
        !c.originalPickIds.includes(right.swapControllerPickId))
    )
      throw new Error(
        'Unrelated option scope contradicts its source controller.'
      );
  }
  const governed = new Set([
    ...p.slots.map((s) => s.entitlementId),
    ...represented,
  ]);
  const covered = new Set<string>();
  for (const binding of [p.conveyance, ...p.claims, ...p.unrelatedClaims]) {
    const bound = new Set<string>();
    for (const id of binding.dependencyIds) {
      const d = retained.dependencies.find((d) => d.id === id);
      if (!d)
        throw new Error('Native claim dependency lineage is unavailable.');
      d.entitlementIds.forEach((id) => {
        covered.add(id);
        bound.add(id);
      });
    }
    const required =
      'eligibleReturnIds' in binding
        ? [
            ...binding.eligibleReturnIds,
            ...binding.representationIds,
            ...p.slots
              .filter((s) =>
                [binding.holderTeam, binding.targetTeam].includes(
                  s.originalTeam
                )
              )
              .map((s) => s.entitlementId),
          ]
        : 'entitlementId' in binding
          ? [binding.entitlementId]
          : [binding.representationId];
    if (required.some((id) => !bound.has(id)))
      throw new Error(
        'Each native claim needs its own complete dependency lineage.'
      );
  }
  if (
    [...governed].some((id) => !covered.has(id)) ||
    catalogue.data.unresolved.some((d) =>
      d.entitlementIds.some((id) => governed.has(id))
    )
  )
    throw new Error(
      'Overlapping claims have missing or unresolved governing terms.'
    );
  for (const s of p.slots)
    if (
      entitlements[s.entitlementId]?.holderTeam !==
      (p.result?.allocation[s.entitlementId] ?? s.holderTeam)
    )
      throw new Error('Overlapping allocation differs from saved inventory.');
  return p;
}

/** Eligible holdings change after each claim. Reuse the existing selection adapter. */
export function resolveOverlappingPool(
  input: DraftOverlappingPoolProgram,
  positions: Record<string, number>,
  elections: Record<string, boolean>
) {
  const p = DraftOverlappingPoolProgramZ.parse(input);
  if (p.result) throw new Error('This overlapping pool was already resolved.');
  if (
    !same(
      Object.keys(positions),
      p.slots.map((s) => s.originalTeam)
    ) ||
    Object.values(positions).some(
      (n) => !Number.isInteger(n) || n < 1 || n > 30
    ) ||
    new Set(Object.values(positions)).size !== p.slots.length
  )
    throw new Error(
      'Every original needs a distinct final draft position; ties and incomplete inputs are unsupported.'
    );
  if (
    !same(
      Object.keys(elections),
      p.claims.map((c) => c.clauseId)
    ) ||
    Object.values(elections).some((value) => value !== true)
  )
    throw new Error(
      'Explicit exercise is required for every native claim; waiver terms are unsupported.'
    );
  const allocation = Object.fromEntries(
    p.slots.map((s) => [s.entitlementId, s.holderTeam])
  );
  const conditional = p.slots.find(
    (s) => s.entitlementId === p.conveyance.entitlementId
  )!;
  if (positions[conditional.originalTeam] > p.conveyance.protectedThrough)
    allocation[conditional.entitlementId] = p.conveyance.recipientTeam;
  const select = (
    ids: string[],
    comparator: 'best_of' | 'worst_of',
    clauseId: string
  ) => {
    if (!ids.length)
      throw new Error('A claim has no eligible return selection.');
    if (ids.length === 1) return ids[0];
    const slots = ids.map((id) => p.slots.find((s) => s.entitlementId === id)!);
    const selected = resolveSwapForEntitlement(
      {
        id: clauseId,
        kind: 'swap_right',
        seasonYear: p.year,
        round: 1,
        holderTeam: slots[0].originalTeam,
        swapType: comparator,
        swapControllerPickId: `${slots[0].originalTeam}_${p.year}_1st`,
        poolUnderlyingPickIds: slots.map(
          (s) => `${s.originalTeam}_${p.year}_1st`
        ),
      },
      positions,
      {
        draftYear: p.year,
        method: 'governed-native-overlap',
        nowIso: `${p.year}-06-30T00:00:00Z`,
      }
    );
    const winner = slots.find((s) => s.originalTeam === selected.swapWinner);
    if (selected.outcome !== 'swap_resolved' || !winner)
      throw new Error('The eligible native claim could not be resolved.');
    return winner.entitlementId;
  };
  for (const c of p.claims) {
    const eligible = c.eligibleReturnIds.filter(
      (id) => allocation[id] === c.holderTeam
    );
    const target = p.slots.filter(
      (s) => allocation[s.entitlementId] === c.targetTeam
    );
    if (target.length !== 1)
      throw new Error('The prior claim did not leave one target selection.');
    const returned = select(eligible, 'worst_of', c.clauseId);
    const chosen = select(
      [returned, target[0].entitlementId],
      'best_of',
      c.clauseId
    );
    if (chosen !== returned) {
      allocation[returned] = c.targetTeam;
      allocation[chosen] = c.holderTeam;
    }
  }
  return DraftOverlappingPoolProgramZ.parse({
    ...p,
    result: { positions, elections, allocation },
  });
}

export function overlappingPoolLines(p: DraftOverlappingPoolProgram) {
  if (!p.result) return [];
  const s = p.slots.find(
    (s) => s.entitlementId === p.conveyance.entitlementId
  )!;
  return [
    `${s.originalTeam}: ${p.result.positions[s.originalTeam] <= p.conveyance.protectedThrough ? 'protected first retained; separate second-round/cash obligation not resolved here' : `first conveyed to ${p.conveyance.recipientTeam} before ordered claims`}`,
    ...p.claims.map(
      (c, i) =>
        `${c.holderTeam}: exercised claim ${i + 1} against ${c.targetTeam}'s eligible selection`
    ),
    ...p.slots.map(
      (s) =>
        `${s.originalTeam} ${p.year} first: final pick ${p.result!.positions[s.originalTeam]} · held by ${p.result!.allocation[s.entitlementId]}`
    ),
  ];
}
