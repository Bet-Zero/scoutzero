/** Retained source identity and software assumptions stay separate. No writes. */
import { verifyRealDraftReviewPackage } from '@/features/architect/utils/draftPickRealReview';
import { REAL_DRAFT_REVIEW_PIN } from '@/features/architect/utils/draftPickRealReviewPin';
import { canonicalStringify } from '@/features/architect/utils/contractSource/deterministicDigest';
import { resolveStoredOrComputedIdentityKey } from '@/features/architect/utils/entitlements/entitlementIdentity';
import type { DraftOriginalFirst } from '@/schemas/draftPickOperation';

export const DRAFT_SIMULATION_KIND = 'retained-picks-governed-test-v1';
export const DRAFT_SIMULATION_NOTICE =
  'Governed test world: retained pick identities; stipulated ownership, branches and finances. This is not verified NBA trade legality.';
export async function loadSimulationCatalogue(text: string) {
  return verifyRealDraftReviewPackage(text, REAL_DRAFT_REVIEW_PIN);
}
export type SimulationCatalogue = Awaited<
  ReturnType<typeof loadSimulationCatalogue>
>;
export function simulationOriginals(catalogue: SimulationCatalogue) {
  return catalogue.data.records.filter(
    (r) =>
      r.originalPick &&
      ['CHI', 'TOR'].includes(r.originalPick.originalTeam) &&
      r.originalPick.draftYear >= 2026 &&
      r.originalPick.draftYear <= 2032
  );
}
export function retainedSimulationEntitlement(
  catalogue: SimulationCatalogue,
  id: string,
  source: Record<string, unknown>
) {
  const retained = catalogue.release.foundation.retained.entitlements.find(
    (r) => r.entitlementId === id
  );
  const record = catalogue.data.records.find((r) => r.entitlementId === id);
  if (
    !retained ||
    !record ||
    source.id !== id ||
    source.kind !== retained.kind ||
    typeof source.holderTeam !== 'string'
  )
    throw new Error('Retained entitlement identity is unavailable.');
  if (record.originalPick && source.underlyingPickId !== record.originalPick.id)
    throw new Error('Retained original-pick identity differs from the source.');
  const identityKey = resolveStoredOrComputedIdentityKey(source);
  if (!identityKey)
    throw new Error('The retained source identity is incomplete.');
  // Freeze the existing source key before holderTeam becomes mutable world state.
  return {
    ...source,
    identityKey,
    holderTeam: source.holderTeam,
    simulationRetained: { retained, record },
  };
}
export function assertSimulationInventory(
  catalogue: SimulationCatalogue,
  metadata: Record<string, unknown>,
  teams: Record<string, Record<string, unknown>>,
  entitlements: Record<string, Record<string, unknown>>,
  sources: Record<string, Record<string, unknown>>
) {
  if (
    metadata.draftSimulationKind !== DRAFT_SIMULATION_KIND ||
    metadata.draftSimulationCatalogue !== REAL_DRAFT_REVIEW_PIN.payloadSha256 ||
    canonicalStringify(metadata.draftSimulationUnresolved) !==
      canonicalStringify(catalogue.data.unresolved)
  )
    throw new Error('Simulation catalogue or unresolved dependencies changed.');
  const expected = catalogue.data.records.map((r) => r.entitlementId).sort();
  if (
    canonicalStringify(Object.keys(entitlements).sort()) !==
    canonicalStringify(expected)
  )
    throw new Error(
      'Simulation must retain the complete entitlement inventory.'
    );
  const holders = new Map<string, string>();
  for (const [team, data] of Object.entries(teams)) {
    if (!Array.isArray(data.entitlementIds))
      throw new Error('Team inventory is missing.');
    for (const id of data.entitlementIds) {
      if (typeof id !== 'string' || holders.has(id))
        throw new Error('Duplicate or malformed team ownership.');
      holders.set(id, team);
    }
  }
  if (
    canonicalStringify([...holders.keys()].sort()) !==
    canonicalStringify(expected)
  )
    throw new Error('Team inventories do not cover the complete catalogue.');
  for (const id of expected) {
    const actual = entitlements[id];
    const baseline = retainedSimulationEntitlement(
      catalogue,
      id,
      sources[id] ?? {}
    );
    const { holderTeam: initialHolder, ...initialTerms } = baseline;
    const { holderTeam: holder, ...terms } = actual;
    if (
      canonicalStringify(terms) !== canonicalStringify(initialTerms) ||
      holders.get(id) !== holder
    )
      throw new Error(
        'Simulation rights, source identity or ownership inventory changed.'
      );
    if (
      holder !== initialHolder &&
      !simulationOriginals(catalogue).some((r) => r.entitlementId === id)
    )
      throw new Error('An unsupported retained right changed holders.');
  }
}
export function simulationPostTradeBranches(
  picks: DraftOriginalFirst[],
  conditional: boolean
) {
  const branches = conditional
    ? ['protected-retains', 'conveys']
    : ['stipulated-unconditional'];
  return branches.map((id) => ({
    id,
    possible: true as const,
    unresolvedDependencyIds: [],
    drafts: Array.from({ length: 7 }, (_, i) => {
      const draftYear = 2026 + i;
      // A retained witness suffices; other unresolved holdings are never treated as empty.
      return {
        draftYear,
        inventoryComplete: false,
        retained: picks.filter(
          (p) =>
            p.draftYear === draftYear &&
            !(id === 'conveys' && p.id === 'CHI_2027_1st')
        ),
      };
    }),
  }));
}

export function describeSimulationReason(reason: string) {
  const pair = reason.match(/no-first-in-(\d{4})\/(\d{4})/);
  if (pair)
    return `In one possible outcome, the team would have no first-round selection in ${pair[1]} or ${pair[2]}.`;
  if (reason.startsWith('stepien:'))
    return 'The proposal needs a complete review of every possible future first-round outcome.';
  if (reason.startsWith('ownership:'))
    return 'The selected pick needs complete ownership and protection terms.';
  if (reason.startsWith('cash-sale:'))
    return 'The exchange needs complete, permitted return consideration.';
  if (reason.startsWith('apron:'))
    return 'The pick needs its applicable apron restriction history.';
  if (reason.startsWith('trading-window:'))
    return 'The pick is outside the supported draft-trading window.';
  return reason;
}
