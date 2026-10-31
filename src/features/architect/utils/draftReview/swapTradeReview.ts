/** Proposal-specific review of a separately transferred ordered-pool option. */
import type { DraftReviewCapabilityRecord } from './capability';
import type { SimulationCatalogue } from './simulationInventory';
import type { ApplyWorldMutationArgs } from '../mutationPipeline.types.ingress';
import { swapProgram } from './swapProgram';
import { simulationOriginals } from './simulationInventory';
import {
  canonicalStringify,
  sha256Digest,
} from '../contractSource/deterministicDigest';
import { mutationSnapshotText } from '../mutationPipeline.snapshotDigest';
import { evaluateSuppliedDraftStepien } from '../draftStepien';
import { QUALIFIED_JUNE5_DRAFT_HORIZON as horizon } from './horizon';
import { normalizeEntitlementTerms } from '../entitlements/entitlementTerms';
import { DraftSimulationAssumptionsZ } from '@/schemas/draftPickReviewMutation';
import { REAL_DRAFT_REVIEW_PIN } from '../draftPickRealReviewPin';
import type { DraftSwapProgram } from '@/schemas/draftSwapProgram';

export type SwapTradeReview = {
  eligible: boolean;
  reasons: string[];
  review: {
    status: 'swap-reviewed';
    team: string;
    swapProgram: DraftSwapProgram;
    stepien: ReturnType<typeof evaluateSuppliedDraftStepien>;
  };
};
export async function prepareSwapTradeRecord(input: {
  args: ApplyWorldMutationArgs;
  catalogue: SimulationCatalogue;
  metadata: Record<string, unknown>;
  entitlements: Record<string, Record<string, unknown>>;
  documentSnapshots: Record<string, string | null>;
  stateDigest: string;
  state: unknown;
}) {
  const { args, catalogue, metadata, entitlements } = input;
  const program = swapProgram(
    metadata.draftSwapProgram,
    catalogue,
    entitlements
  );
  if (program.result) throw new Error('This swap right has already resolved.');
  if (program.year !== 2026)
    throw new Error(
      'This saved-world swap journey supports the 2026 draft; later draft transitions remain unavailable.'
    );
  const slots = args.payload.teams!;
  const teamCodes = slots.map((s) => String(s.teamCode));
  const participants = [
    ...new Set([...teamCodes, ...program.slots.map((s) => s.holderTeam)]),
  ];
  const originalTeams = [
    ...new Set([...teamCodes, ...program.slots.map((s) => s.originalTeam)]),
  ];
  const originals = simulationOriginals(catalogue, originalTeams);
  const movements: DraftReviewCapabilityRecord['movements'][number][] = [];
  const firstsByTeam: Record<string, string[]> = {};
  for (const slot of slots)
    for (const out of slot.entitlementsOut ?? []) {
      const id = String(out.entitlementId ?? out.id ?? '');
      const current = entitlements[id];
      const original = originals.find(
        (r) => r.entitlementId === id
      )?.originalPick;
      const isRight = id === program.tradedRightId;
      if (
        !current ||
        (!isRight && !original) ||
        current.holderTeam !== slot.teamCode ||
        !teamCodes.includes(String(out.toTeamId)) ||
        out.toTeamId === slot.teamCode ||
        movements.some((m) => m.entitlementId === id)
      )
        throw new Error(
          'The sender must own every distinct right and selection in this exchange.'
        );
      if (program.slots.some((s) => s.entitlementId === id))
        throw new Error(
          'Trade the option separately; underlying pool selections are reserved until resolution.'
        );
      if (
        catalogue.data.unresolved.some(
          (d) =>
            d.entitlementIds.includes(id) &&
            d.actions.some((a) =>
              ['transfer', 'stepien', 'apron', 'allocate'].includes(a)
            )
        )
      )
        throw new Error(
          'The selected asset has an unresolved governing dependency.'
        );
      if (
        out.kind !== current.kind ||
        out.round !== 1 ||
        out.seasonYear !== current.seasonYear ||
        (out.id != null && out.id !== id)
      )
        throw new Error(
          'The selected asset must retain its complete source identity.'
        );
      for (const key of [
        'underlyingPickId',
        'underlyingStatus',
        'protectionLadder',
        'swapControllerPickId',
        'poolUnderlyingPickIds',
        'receivesComparator',
        'receivesRank',
      ])
        if (
          key in out &&
          mutationSnapshotText(Reflect.get(out, key)) !==
            mutationSnapshotText(current[key])
        )
          throw new Error('Caller-supplied terms differ from the saved world.');
      if (
        out.terms != null &&
        mutationSnapshotText(out.terms) !==
          mutationSnapshotText(normalizeEntitlementTerms(current))
      )
        throw new Error('Caller-supplied terms differ from the saved world.');
      if (
        !isRight &&
        (Number(current.seasonYear) >= 2032 ||
          current.underlyingStatus === 'encumbered' ||
          (Array.isArray(current.protectionLadder) &&
            current.protectionLadder.length))
      )
        throw new Error(
          'Only unprotected original consideration is supported with this swap family.'
        );
      const controller = program.slots.find(
        (s) =>
          s.entitlementId ===
          program.steps.find((s) => s.rightId === id)?.controllerId
      );
      movements.push({
        entitlementId: id,
        originalTeam: isRight
          ? controller!.originalTeam
          : original!.originalTeam,
        year: Number(current.seasonYear),
        round: 1,
        fromTeam: String(slot.teamCode),
        toTeam: String(out.toTeamId),
        assetKind: isRight ? 'swap_right' : 'pick_ownership',
      });
      (firstsByTeam[String(slot.teamCode)] ??= []).push(id);
    }
  const transfer = movements.find(
    (m) => m.entitlementId === program.tradedRightId
  );
  const controller = program.slots.find(
    (s) =>
      s.entitlementId ===
      program.steps.find((s) => s.rightId === program.tradedRightId)!
        .controllerId
  )!;
  if (
    !transfer ||
    transfer.toTeam !== controller.holderTeam ||
    transfer.fromTeam !== program.grantorTeam
  )
    throw new Error(
      'The receiving team must own the specified return selection; the option alone never transfers that pick.'
    );
  if (
    teamCodes.some(
      (team) =>
        !movements.some((m) => m.fromTeam === team) ||
        !movements.some((m) => m.toTeam === team)
    )
  )
    throw new Error(
      'Both sides require explicit noncash return consideration.'
    );
  const proposalSha256 = (
    await sha256Digest(mutationSnapshotText(args.payload))
  ).slice(7);
  const assumptions = DraftSimulationAssumptionsZ.parse({
    kind: 'governed-test-assumptions-v1',
    catalogueSha256: REAL_DRAFT_REVIEW_PIN.payloadSha256,
    proposalSha256,
    stateDigest: input.stateDigest,
    asOf: horizon.asOf,
    branchMode: 'swap-program',
    swapProgram: program,
    ownership: 'stipulated-for-software-tests',
    otherHoldings: 'unknown-not-empty',
  });
  const assumptionSha256 = (
    await sha256Digest(canonicalStringify(assumptions))
  ).slice(7);
  const holders = Object.fromEntries(
    originals.map((r) => [
      r.entitlementId,
      movements.find((m) => m.entitlementId === r.entitlementId)?.toTeam ??
        String(entitlements[r.entitlementId].holderTeam),
    ])
  );
  // A sequence of same-draft swaps is a bijection: every slot owner retains the
  // same number of firsts under every ordering and exercise/waiver combination.
  // Use ALL possible selections for each slot as a conservative superset; never
  // authorize using only the favorable position ordering.
  const reviews: SwapTradeReview[] = participants.map((team) => {
    const context = {
      proposalSha256,
      stateVersion: input.stateDigest,
      releaseId: catalogue.release.foundation.release.id,
      asOf: horizon.asOf,
      team,
    };
    const teamSlots = program.slots.filter((s) => s.holderTeam === team);
    const outgoing = [
      ...teamSlots.map(
        (s) =>
          originals.find((r) => r.entitlementId === s.entitlementId)!
            .originalPick!
      ),
      ...movements
        .filter((m) => m.fromTeam === team && m.assetKind === 'pick_ownership')
        .map(
          (m) =>
            originals.find((r) => r.entitlementId === m.entitlementId)!
              .originalPick!
        ),
    ];
    // The option seller's original controller is an identity for this Stepien
    // assessment only. Right ownership was checked above; no original ownership
    // fact or original-pick transfer is fabricated for the seller.
    if (!outgoing.length)
      outgoing.push(
        originals.find((r) => r.entitlementId === controller.entitlementId)!
          .originalPick!
      );
    const choose = (ids: string[], count: number): string[][] =>
      count === 0
        ? [[]]
        : ids.flatMap((id, i) =>
            choose(ids.slice(i + 1), count - 1).map((rest) => [id, ...rest])
          );
    const combinations = choose(
      program.slots.map((s) => s.entitlementId),
      teamSlots.length
    );
    const fact = {
      id: `swap-stepien:${team}`,
      context,
      status: 'supported in stated scope',
      effectiveAt: horizon.asOf,
      validUntil: null,
      unresolvedDependencyIds: [],
      sources: [
        {
          id: 'governed-swap-assumptions',
          artifactSha256: assumptionSha256,
          locator: 'Explicit software assumptions',
          scope: 'stepien-post-trade-branches',
          qualification: 'qualified',
          publishedAt: null,
          capturedAt: null,
          review: {
            status: 'accepted',
            reference: 'owner-authorized governed test inputs only',
            limitations: [],
          },
        },
      ],
      scope: 'stepien-post-trade-branches',
      outgoing,
      firstFutureDraftYear: 2026,
      throughDraftYear: 2032,
      laterDrafts: 'outside-qualified-scope',
      finiteScope: {
        authorityId: horizon.id,
        explanationSha256: horizon.explanationSha256,
        calendarSha256: horizon.calendarSha256,
        completeRelevantObligationCoverage: true,
        knownObligationDraftYears: [program.year],
        unresolvedDependencyIds: [],
      },
      swapProgram: program,
      branchesComplete: true,
      branches: combinations.map((ids, i) => ({
        id: `all-allocations-${i}`,
        possible: true,
        unresolvedDependencyIds: [],
        drafts: Array.from({ length: 7 }, (_, i) => ({
          draftYear: 2026 + i,
          inventoryComplete: false,
          retained: originals
            .filter(
              (r) =>
                r.originalPick!.draftYear === 2026 + i &&
                (program.slots.some((s) => s.entitlementId === r.entitlementId)
                  ? ids.includes(r.entitlementId)
                  : holders[r.entitlementId] === team)
            )
            .map((r) => r.originalPick!),
        })),
      })),
    };
    const stepien = evaluateSuppliedDraftStepien({ context, outgoing }, [fact]);
    const reasons =
      stepien.status === 'component-permits'
        ? []
        : stepien.reasons.map((r) => `${team}: stepien:${r}`);
    return {
      eligible: !reasons.length,
      reasons,
      review: { status: 'swap-reviewed', team, swapProgram: program, stepien },
    };
  });
  const reasons = reviews.flatMap((r) => r.reasons);
  if (reasons.length) return { status: 'blocked' as const, reasons, reviews };
  const record: DraftReviewCapabilityRecord = {
    scope: 'governed-simulation-only',
    assumptions,
    assumptionSha256,
    userId: args.userId,
    worldId: args.worldId,
    seasonId: args.seasonId,
    operationId: args.operationId!,
    payloadSnapshot: mutationSnapshotText(args.payload),
    stateDigest: input.stateDigest,
    stateSnapshot: mutationSnapshotText(input.state),
    asOfDate: '2026-06-05',
    releaseId: catalogue.release.foundation.release.id,
    releaseSha256: catalogue.release.payloadSha256,
    documentSnapshots: input.documentSnapshots,
    firstsByTeam,
    reviews,
    movements,
  };
  return { status: 'ready' as const, record };
}
