import {
  nativeSelectionHolders,
  requireSameNativeValue,
} from '../utils/draftReview/nativeTrading';
import { conditionalRightSuffix } from '../utils/draftReview/conditionalProgram';
import { DraftConditionalProgramsZ } from '@/schemas/draftConditionalProgram';
import type { DraftClaimProgram } from '@/schemas/draftSwapProgram';
import type { NativeSelectionTransfer } from '@/schemas/draftNativeTrading';
import {
  apronRestrictionText,
  readApronSeasonReceipt,
} from '../utils/draftReview/apronSimulation';
import {
  readPenaltyPlacementReceipt,
  placementLine,
} from '../utils/draftReview/penaltyPlacement';
import { nativePoolLines } from '../utils/draftReview/nativePool';
import { overlappingPoolLines } from '../utils/draftReview/overlappingPool';
import { DraftSwapReceiptZ } from '@/schemas/draftSwapReceipt';
import { resolveDraftClaimProgram } from '../utils/draftReview/swapProgram';
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
  const restrictions: string[] = [];
  let apronHistory: string | null = null;
  let seasonSeen = false;
  let conditionalState: string | null = null;
  let nativeProgram: DraftClaimProgram | null = null;
  let nativeResolution: { operationId: string; lifecycle: unknown } | null =
    null;
  const nativeTransfers: NativeSelectionTransfer[] = [];
  for (const row of rows) {
    if (
      row.mutationType === 'draftConveyance' &&
      Reflect.get(row.raw?.metadata ?? {}, 'penaltyDraftReceipt') !== undefined
    ) {
      const r = readPenaltyPlacementReceipt(
        Reflect.get(row.raw?.metadata ?? {}, 'penaltyDraftReceipt')
      );
      if (
        !r ||
        r.worldId !== worldId ||
        r.operationId !== row.raw?.operationId ||
        r.catalogueSha256 !== REAL_DRAFT_REVIEW_PIN.payloadSha256 ||
        seen.has(r.operationId)
      )
        return null;
      seen.add(r.operationId);
      restrictions.splice(
        0,
        restrictions.length,
        ...r.positions
          .filter(
            (p) => p.originalTeam === teamCode || p.holderTeam === teamCode
          )
          .map(placementLine)
      );
      continue;
    }
    if (row.mutationType === 'seasonAdvance') {
      const apron = readApronSeasonReceipt(
        Reflect.get(row.raw?.metadata ?? {}, 'apronSeasonReceipt')
      );
      if (apron) {
        const r = apron;
        if (
          r.worldId !== worldId ||
          r.operationId !== row.raw?.operationId ||
          r.catalogueSha256 !== REAL_DRAFT_REVIEW_PIN.payloadSha256 ||
          seen.has(r.operationId) ||
          (apronHistory !== null &&
            apronHistory !== canonicalStringify(r.before)) ||
          r.after.length !== r.before.length + 1 ||
          canonicalStringify(r.after.slice(0, -1)) !==
            canonicalStringify(r.before)
        )
          return null;
        apronHistory = canonicalStringify(r.after);
        seen.add(r.operationId);
        const input = r.restrictions.find((r) => r.team === teamCode);
        if (!input) return null;
        restrictions.splice(
          0,
          restrictions.length,
          `${teamCode} 2033 first: ${apronRestrictionText(input)}`
        );
        continue;
      }
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
      'playerMovements' in receipt.data &&
      receipt.data.playerMovements &&
      (row.raw?.valid !== true ||
        canonicalStringify(
          Array.isArray(row.raw.playerIds) ? [...row.raw.playerIds].sort() : []
        ) !==
          canonicalStringify(
            receipt.data.playerMovements.map((p) => p.playerId).sort()
          ))
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
              resolveDraftClaimProgram(
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
        (('nativeLifecycle' in receipt.data &&
          receipt.data.nativeLifecycle?.originalSelections?.some(
            (s) => s.holderTeam === teamCode || s.originalTeam === teamCode
          )) ||
          receipt.data.before.slots.some(
            (s) => s.holderTeam === teamCode || s.originalTeam === teamCode
          ) ||
          (receipt.data.before.kind === 'native-ranked-pool-v1' &&
            [
              receipt.data.before.nativePool.beneficiaryTeam,
              receipt.data.before.nativePool.residualTeam,
            ].includes(teamCode)))
      )
        conditionalState = canonicalStringify(receipt.data.before);
      if (canonicalStringify(receipt.data.before) !== conditionalState)
        return null;
      conditionalState = canonicalStringify(receipt.data.after);
      const after = receipt.data.after;
      if (!Array.isArray(after) && after.kind !== 'ordered-swap-pool-v1') {
        nativeProgram = after;
        nativeResolution = {
          operationId: receipt.data.operationId,
          lifecycle:
            'nativeLifecycle' in receipt.data
              ? receipt.data.nativeLifecycle
              : null,
        };
        restrictions.push(
          ...(after.kind === 'native-ranked-pool-v1'
            ? nativePoolLines(after)
            : overlappingPoolLines(after)
          ).filter(
            (line) =>
              line.startsWith(`${teamCode}:`) ||
              after.slots.some(
                (s) =>
                  line.startsWith(`${s.originalTeam} `) &&
                  (s.originalTeam === teamCode ||
                    after.result?.allocation[s.entitlementId] === teamCode)
              )
          )
        );
      }
    } else if (receipt.data.assumptions?.nativeTrade) {
      const n = receipt.data.assumptions.nativeTrade;
      try {
        if (!nativeProgram || !nativeResolution) return null;
        requireSameNativeValue(
          n,
          {
            program: nativeProgram,
            lifecycle: nativeResolution.lifecycle,
            resolutionOperationId: nativeResolution.operationId,
            transfers: nativeTransfers,
          },
          'Broken native receipt chain'
        );
        if (receipt.data.playerMovements) {
          if (row.raw?.valid !== true) return null;
          requireSameNativeValue(
            Array.isArray(row.raw.playerIds)
              ? [...row.raw.playerIds].sort()
              : [],
            receipt.data.playerMovements.map((p) => p.playerId).sort(),
            'Mixed native receipt differs from the committed player transaction'
          );
        }
        const entry = {
          operationId: receipt.data.operationId,
          asOfDate: receipt.data.asOfDate,
          movements: receipt.data.movements,
          ...(receipt.data.playerMovements
            ? { playerMovements: receipt.data.playerMovements }
            : {}),
        };
        const holders = nativeSelectionHolders(
          nativeProgram,
          [...nativeTransfers, entry],
          n.lifecycle.originalSelections
        );
        nativeTransfers.push(entry as NativeSelectionTransfer);
        const claimNotes = restrictions.filter(
          (line) =>
            ![
              ...nativeProgram!.slots.map((s) => ({
                ...s,
                year: nativeProgram!.year,
              })),
              ...(n.lifecycle.originalSelections ?? []),
            ].some((slot) =>
              line.startsWith(`${slot.originalTeam} ${slot.year} first:`)
            )
        );
        restrictions.splice(
          0,
          restrictions.length,
          ...claimNotes,
          ...nativeProgram.slots
            .filter(
              (slot) =>
                slot.originalTeam === teamCode ||
                holders[slot.entitlementId] === teamCode
            )
            .map(
              (slot) =>
                `${slot.originalTeam} ${nativeProgram!.year} first: final pick ${nativeProgram!.result!.positions[slot.originalTeam]} · held by ${holders[slot.entitlementId]}`
            ),
          ...(n.lifecycle.originalSelections ?? [])
            .filter(
              (s) =>
                s.originalTeam === teamCode ||
                holders[s.entitlementId] === teamCode
            )
            .map(
              (s) =>
                `${s.originalTeam} ${s.year} first: held by ${holders[s.entitlementId]}`
            )
        );
      } catch {
        return null;
      }
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
  if (!count && !restrictions.length) return null;
  const additions: DraftAssetDeltaEntry[] = [],
    removals: DraftAssetDeltaEntry[] = [];
  const programs =
    conditionalState === null
      ? null
      : DraftConditionalProgramsZ.safeParse(JSON.parse(conditionalState));
  for (const [entitlementId, p] of movements) {
    const entry = {
      entitlementId,
      displayName:
        p.displayName +
        (programs?.success
          ? conditionalRightSuffix(programs.data, entitlementId)
          : ''),
    };
    if (p.to === teamCode && p.from !== teamCode) additions.push(entry);
    if (p.from === teamCode && p.to !== teamCode) removals.push(entry);
  }
  return {
    additions,
    removals,
    ...(restrictions.length ? { restrictions } : {}),
  };
}
