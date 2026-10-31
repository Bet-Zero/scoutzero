import { DraftSwapReceiptZ } from '@/schemas/draftSwapReceipt';
import { resolveSwapProgram } from '../utils/draftReview/swapProgram';
import {
  DraftConditionalReceiptZ,
  ConditionalSeasonReceiptZ,
} from '@/schemas/draftConditionalReceipt';
import { REAL_DRAFT_REVIEW_PIN } from '../utils/draftPickRealReviewPin';
import { canonicalStringify } from '../utils/contractSource/deterministicDigest';
/** Pure synthetic receipt calculation; callers must enforce the review environment. */
import { DraftReviewMutationReceiptZ } from '@/schemas/draftPickReviewMutation';
import { DraftReviewSeasonReceiptZ } from '@/schemas/draftReviewSeason';
import { SYNTHETIC_DRAFT_SEASON_PIN } from '@/features/architect/utils/draftReview/seasonFixturePin';
import type { ComparisonEventRow } from './deriveComparisonViewModel';

export type DraftAssetDeltaEntry = {
  entitlementId: string;
  displayName: string;
};
export function deriveDraftAssetDelta(
  rows: ComparisonEventRow[],
  worldId: string,
  teamCode: string
) {
  const movements = new Map<
    string,
    { identity: string; from: string; to: string; displayName: string }
  >();
  const seen = new Set<string>();
  let count = 0;
  let seasonSeen = false;
  let conditionalState: string | null = null;
  for (const row of rows) {
    if (row.mutationType === 'seasonAdvance') {
      const conditional = ConditionalSeasonReceiptZ.safeParse(
        Reflect.get(row.raw?.metadata ?? {}, 'conditionalSeasonReceipt')
      );
      if (conditional.success) {
        if (
          conditional.data.worldId !== worldId ||
          conditional.data.operationId !== row.raw?.operationId ||
          conditional.data.catalogueSha256 !==
            REAL_DRAFT_REVIEW_PIN.payloadSha256 ||
          canonicalStringify(
            conditional.data.swapProgram ?? conditional.data.programs
          ) !== conditionalState ||
          seen.has(conditional.data.operationId)
        )
          return null;
        seen.add(conditional.data.operationId);
        continue;
      }
      const parsed = DraftReviewSeasonReceiptZ.safeParse(
        row.raw?.metadata && typeof row.raw.metadata === 'object'
          ? Reflect.get(row.raw.metadata, 'draftReviewSeasonReceipt')
          : null
      );
      // This single accepted fixture advances before its trade. No claim that
      // an already-traded pick survived an unsupported later season is inferred.
      if (
        !parsed.success ||
        count !== 0 ||
        seasonSeen ||
        parsed.data.worldId !== worldId ||
        parsed.data.operationId !== row.raw?.operationId ||
        parsed.data.releaseId !== SYNTHETIC_DRAFT_SEASON_PIN.release.id ||
        parsed.data.releaseSha256 !== SYNTHETIC_DRAFT_SEASON_PIN.payloadSha256
      )
        return null;
      seasonSeen = true;
      continue;
    }
    if (
      row.mutationType !== 'executeTrade' &&
      row.mutationType !== 'draftConveyance'
    ) {
      // Other pick-changing operation families have no receipt contract here.
      if (/season|entitlement|pick|convey|swap/i.test(row.mutationType ?? ''))
        return null;
      continue;
    }
    const metadata = row.raw?.metadata;
    const receipt =
      row.mutationType === 'draftConveyance'
        ? Reflect.get(metadata ?? {}, 'swapDraftReceipt') !== undefined
          ? DraftSwapReceiptZ.safeParse(
              Reflect.get(metadata ?? {}, 'swapDraftReceipt')
            )
          : DraftConditionalReceiptZ.safeParse(
              Reflect.get(metadata ?? {}, 'conditionalDraftReceipt')
            )
        : DraftReviewMutationReceiptZ.safeParse(
            metadata && typeof metadata === 'object'
              ? Reflect.get(metadata, 'draftReviewReceipt')
              : null
          );
    if (
      !receipt.success ||
      receipt.data.worldId !== worldId ||
      receipt.data.operationId !== row.raw?.operationId ||
      seen.has(receipt.data.operationId)
    )
      return null;
    if (
      seasonSeen &&
      'releaseId' in receipt.data &&
      (receipt.data.releaseId !== SYNTHETIC_DRAFT_SEASON_PIN.release.id ||
        receipt.data.releaseSha256 !==
          SYNTHETIC_DRAFT_SEASON_PIN.payloadSha256 ||
        receipt.data.asOfDate !== '2026-07-01')
    )
      return null;
    if (
      'catalogueSha256' in receipt.data &&
      receipt.data.catalogueSha256 !== REAL_DRAFT_REVIEW_PIN.payloadSha256
    )
      return null;
    seen.add(receipt.data.operationId);
    if ('before' in receipt.data) {
      if (
        !Array.isArray(receipt.data.before) &&
        !Array.isArray(receipt.data.after)
      ) {
        try {
          const result = receipt.data.after.result!;
          if (
            canonicalStringify(
              resolveSwapProgram(
                receipt.data.before,
                result.positions,
                result.elections
              )
            ) !== canonicalStringify(receipt.data.after)
          )
            return null;
        } catch {
          return null;
        }
      }
      if (
        conditionalState === null &&
        !Array.isArray(receipt.data.before) &&
        receipt.data.before.slots.some((s) => s.holderTeam === teamCode)
      )
        conditionalState = canonicalStringify(receipt.data.before);
      if (canonicalStringify(receipt.data.before) !== conditionalState)
        return null;
      conditionalState = canonicalStringify(receipt.data.after);
    } else if (
      receipt.data.assumptions?.programs ||
      receipt.data.assumptions?.swapProgram
    ) {
      const programs = canonicalStringify(
        receipt.data.assumptions.swapProgram ??
          receipt.data.assumptions.programs
      );
      if (conditionalState !== null && programs !== conditionalState)
        return null;
      conditionalState = programs;
    }
    count++;
    for (const p of receipt.data.movements) {
      const identity = `${p.originalTeam}:${p.year}:${p.round}:${p.assetKind ?? 'pick_ownership'}`;
      const previous = movements.get(p.entitlementId);
      if (
        p.fromTeam === p.toTeam ||
        (previous &&
          (previous.identity !== identity || previous.to !== p.fromTeam))
      )
        return null;
      movements.set(p.entitlementId, {
        identity,
        from: previous?.from ?? p.fromTeam,
        to: p.toTeam,
        displayName: `${p.originalTeam} ${p.year} ${p.round === 1 ? 'first' : 'second'}-round ${p.assetKind === 'swap_right' ? 'swap right' : 'pick'}`,
      });
    }
  }
  if (!count) return null;
  const additions: DraftAssetDeltaEntry[] = [],
    removals: DraftAssetDeltaEntry[] = [];
  for (const [entitlementId, p] of movements) {
    const entry = { entitlementId, displayName: p.displayName };
    if (p.to === teamCode && p.from !== teamCode) additions.push(entry);
    if (p.from === teamCode && p.to !== teamCode) removals.push(entry);
  }
  return { additions, removals };
}
