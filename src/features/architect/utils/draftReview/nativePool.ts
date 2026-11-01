import {
  DraftNativePoolProgramZ,
  type DraftNativePoolProgram,
} from '@/schemas/draftNativePool';
import { canonicalStringify } from '../contractSource/deterministicDigest';
import type { SimulationCatalogue } from './simulationInventory';
const same = (a: string[], b: string[]) =>
  canonicalStringify([...a].sort()) === canonicalStringify([...b].sort());

/** Validate separate supplied terms; archival bindings supply coverage, never rights. */
export function nativePoolProgram(
  input: unknown,
  catalogue: SimulationCatalogue,
  entitlements: Record<string, Record<string, unknown>>
) {
  const p = DraftNativePoolProgramZ.parse(input);
  const originals = p.slots.map((slot) => {
    const row = catalogue.data.records.find(
      (r) => r.entitlementId === slot.entitlementId
    );
    if (
      !row?.originalPick ||
      row.role !== 'original' ||
      row.originalPick.draftYear !== p.year ||
      row.originalPick.originalTeam !== slot.originalTeam ||
      entitlements[slot.entitlementId]?.kind !== 'pick_ownership'
    )
      throw new Error(
        'Native pool selections must match retained same-draft originals.'
      );
    return row.originalPick.id;
  });
  const relevant = Object.entries(entitlements).filter(
    ([, e]) =>
      e.kind !== 'pick_ownership' &&
      (originals.includes(String(e.swapControllerPickId)) ||
        (Array.isArray(e.poolUnderlyingPickIds) &&
          e.poolUnderlyingPickIds.some((id) => originals.includes(id))))
  );
  if (
    !same(
      relevant.map(([id]) => id),
      p.nativePool.archivalIds
    )
  )
    throw new Error(
      'Every overlapping retained claim needs its exact disposition.'
    );
  for (const [id] of relevant) {
    const row = catalogue.data.records.find((r) => r.entitlementId === id);
    if (
      row?.role !== 'generated-alias' ||
      !row.poolIds.length ||
      row.poolIds.some((id) => !p.nativePool.clauseIds.includes(id))
    )
      throw new Error(
        'A source-native competing claim cannot be dismissed as an archival alias.'
      );
  }
  const clauses = [
    ...new Set(
      relevant.flatMap(
        ([id]) =>
          catalogue.data.records.find((r) => r.entitlementId === id)!.poolIds
      )
    ),
  ];
  if (!same(clauses, p.nativePool.clauseIds))
    throw new Error('Native clause coverage is missing or conflicting.');
  const foundation = catalogue.release.foundation.retained;
  const covered = new Set<string>();
  for (const id of p.nativePool.dependencyIds) {
    const d = foundation.dependencies.find((d) => d.id === id);
    if (!d || !p.slots.some((s) => d.entitlementIds.includes(s.entitlementId)))
      throw new Error('Native terms need retained dependency lineage.');
    for (const entitlementId of d.entitlementIds) covered.add(entitlementId);
  }
  if (p.slots.some((s) => !covered.has(s.entitlementId)))
    throw new Error('Native governing lineage must cover every original.');
  // The accepted projection preserves its historical foundation separately from
  // the exact current unresolved crosswalk. Do not rewrite either one here.
  if (
    catalogue.data.unresolved.some((d) =>
      d.entitlementIds.some((id) => p.slots.some((s) => s.entitlementId === id))
    )
  )
    throw new Error('A native original still has unresolved governing terms.');
  for (const slot of p.slots)
    if (
      entitlements[slot.entitlementId]?.holderTeam !==
      (p.result?.allocation[slot.entitlementId] ?? slot.holderTeam)
    )
      throw new Error(
        'Native pool ownership differs from the saved inventory.'
      );
  return p;
}

export function nativePoolLines(p: DraftNativePoolProgram) {
  if (!p.result) return [];
  const { beneficiaryTeam, residualTeam } = p.nativePool;
  return [
    `${beneficiaryTeam}: exercised the native ${p.year} two-most-favorable claim; ${residualTeam} receives the remaining selection`,
    ...p.slots.map(
      (s) =>
        `${s.originalTeam} ${p.year} first: final pick ${p.result!.positions[s.originalTeam]} · held by ${p.result!.allocation[s.entitlementId]}`
    ),
  ];
}
