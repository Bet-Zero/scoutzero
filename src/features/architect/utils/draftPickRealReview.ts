import {
  DraftPickRealReviewPackageZ,
  type DraftPickRealReviewPackage,
} from '@/schemas/draftPickRealReview';
import {
  loadDraftPickRelease,
  type LoadedDraftPickRelease,
} from './draftPickRelease';
import {
  sha256Digest,
  canonicalStringify,
} from './contractSource/deterministicDigest';
import { reviewDraftPickComponents } from './draftPickReview';
import { REAL_DRAFT_REVIEW_PIN } from './draftPickRealReviewPin';

const verified = new WeakMap<
  object,
  { data: DraftPickRealReviewPackage; release: LoadedDraftPickRelease }
>();
type Pin = typeof REAL_DRAFT_REVIEW_PIN;

/** Integrity plus a separately installed trust pin; caller JSON alone is never authority. */
export async function verifyRealDraftReviewPackage(text: string, pin: Pin) {
  if ((await sha256Digest(text)) !== `sha256:${pin.payloadSha256}`)
    throw new Error('Draft review evidence changed.');
  const data = DraftPickRealReviewPackageZ.parse(JSON.parse(text));
  if (
    data.inventorySha256 !== pin.inventorySha256 ||
    data.acceptanceReference !== pin.acceptanceReference
  )
    throw new Error('Draft review acceptance does not match.');
  const release = await loadDraftPickRelease(
    data.foundationText,
    data.foundationPin,
    'retained-baseline'
  );
  const retained = release.foundation.retained;
  const same = (a: string[], b: string[]) =>
    canonicalStringify([...a].sort()) === canonicalStringify([...b].sort());
  if (
    retained.entitlements.length !== pin.entitlements ||
    retained.occurrences.length !== pin.occurrences ||
    retained.dependencies.length !== pin.dependencies ||
    retained.predecessorDependencies.length !== pin.predecessors ||
    data.unresolved.length !== pin.unresolved ||
    !same(
      data.records.map((r) => r.entitlementId),
      retained.entitlements.map((r) => r.entitlementId)
    )
  )
    throw new Error('Draft review inventory is incomplete.');
  const dependencies = new Map(retained.dependencies.map((d) => [d.id, d]));
  for (const row of data.unresolved) {
    const original = dependencies.get(row.dependencyId);
    if (
      !original ||
      !same(row.entitlementIds, original.entitlementIds) ||
      !same(row.occurrenceIds, original.baselineOccurrenceIds)
    )
      throw new Error('Draft review dependency lineage differs.');
  }
  if (
    new Set(data.unresolved.map((d) => d.dependencyId)).size !==
    data.unresolved.length
  )
    throw new Error('Duplicate draft dependency.');
  for (const row of data.records) {
    const original = retained.entitlements.find(
      (e) => e.entitlementId === row.entitlementId
    )!;
    if (
      row.originalPick &&
      (row.role !== 'original' ||
        original.kind !== 'pick_ownership' ||
        !same(original.baselineUnderlyingAssetIdsUnchanged, [
          row.originalPick.id,
        ]))
    )
      throw new Error(
        'A generated or conditional right cannot become an original pick.'
      );
    if (
      row.ownership &&
      (!row.originalPick ||
        canonicalStringify(row.ownership.pick) !==
          canonicalStringify(row.originalPick))
    )
      throw new Error('Ownership evidence identifies a different right.');
    for (const evidence of row.evidence) {
      if (
        !original.dependencyIds.includes(evidence.dependencyId) ||
        (evidence.status === 'legitimate future outcome pending' &&
          !evidence.alternativesComplete)
      )
        throw new Error(
          'Draft evidence has the wrong scope or incomplete alternatives.'
        );
    }
  }
  // This internal verifier is also testable with synthetic pins. Only the installed
  // production loader below creates a token accepted by the product reviewer.
  return { data, release };
}

export async function loadRealDraftReview(text: string): Promise<object> {
  const result = await verifyRealDraftReviewPackage(
    text,
    REAL_DRAFT_REVIEW_PIN
  );
  const token = Object.freeze({});
  verified.set(token, result);
  return token;
}

export type RealDraftReviewSelection = {
  entitlementId: string;
  team: string;
};
export function reviewRealDraftSelection(
  token: object,
  args: {
    selections: RealDraftReviewSelection[];
    asOfDate: string | null;
    proposalSha256: string;
    stateVersion: string;
  }
) {
  const loaded = verified.get(token);
  if (!loaded) throw new Error('No authenticated draft review is installed.');
  return deriveRealDraftSelection(loaded, args);
}

/** Pure derivation; exported for adversarial synthetic testing, never an Apply result. */
export function deriveRealDraftSelection(
  { data, release }: Awaited<ReturnType<typeof verifyRealDraftReviewPackage>>,
  args: Parameters<typeof reviewRealDraftSelection>[1]
) {
  const asOf = release.foundation.release.asOf;
  const dateMatches =
    args.asOfDate === asOf || args.asOfDate === asOf.slice(0, 10);
  return {
    apply: 'blocked' as const,
    tradingVerdict: 'not-evaluated' as const,
    asOf,
    records: args.selections.map((selection) => {
      const row = data.records.find(
        (r) => r.entitlementId === selection.entitlementId
      );
      const relatedDependencies = data.unresolved.filter((d) =>
        d.entitlementIds.includes(selection.entitlementId)
      );
      const blockers = relatedDependencies.filter((d) =>
        d.actions.includes('transfer')
      );
      const context = {
        proposalSha256: args.proposalSha256,
        stateVersion: args.stateVersion,
        releaseId: release.foundation.release.id,
        asOf,
        team: selection.team,
      };
      // No holder, Stepien branch, consideration, or later-world continuity is
      // manufactured from a supported identity or an unrelated sibling fact.
      const components =
        dateMatches && row?.originalPick
          ? reviewDraftPickComponents({
              request: { context, outgoing: [row.originalPick] },
              facts: row.ownership ? [{ ...row.ownership, context }] : [],
              apron: [
                {
                  context,
                  input: {
                    team: row.originalPick.originalTeam,
                    triggerSeasonStartYear: row.originalPick.draftYear - 8,
                    originalPick: {
                      id: row.originalPick.id,
                      originalTeam: row.originalPick.originalTeam,
                      draftYear: row.originalPick.draftYear,
                      round: 1,
                    },
                    asOf,
                    observations: [],
                    regularSeasonEnds: [],
                  },
                },
              ],
            })
          : null;
      return {
        entitlementId: selection.entitlementId,
        label: row?.label ?? 'Unrecognized first-round right',
        role: row?.role ?? 'unestablished',
        poolIds: row?.poolIds ?? [],
        status:
          components?.status === 'reviewed' &&
          components.ownership.status === 'component-prohibits'
            ? ('prohibited' as const)
            : ('needs-input' as const),
        reason: !row
          ? 'This right is not in the retained pick inventory.'
          : !dateMatches
            ? 'The retained pick evidence does not establish this world’s date. Review the starting position or supply dated changes.'
            : row.role === 'generated-alias'
              ? 'This archived entry describes a shared pick pool. A separately transferable right has not been established.'
              : components?.status === 'reviewed' &&
                  components.ownership.status === 'component-prohibits'
                ? 'The retained starting position assigns this pick to another team.'
                : components?.status === 'reviewed' &&
                    components.ownership.status === 'component-permits'
                  ? 'Recorded ownership supports this team conveying the pick. The proposed trade still needs complete post-trade branches and exchange terms.'
                  : 'The recorded right can be inspected. Complete ownership, possible post-trade branches and exchange terms must be established before a trade can pass.',
        evidence: (row?.evidence ?? []).map((e) => ({
          ...e,
          current:
            dateMatches &&
            e.effectiveAt !== null &&
            Date.parse(e.effectiveAt) <= Date.parse(asOf),
        })),
        blockers,
        relatedDependencies,
        components,
      };
    }),
  };
}

export type RealDraftSelectionReview = ReturnType<
  typeof deriveRealDraftSelection
>;
