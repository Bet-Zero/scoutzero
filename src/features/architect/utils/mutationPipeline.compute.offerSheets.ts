/**
 * FILE: src/features/architect/utils/mutationPipeline.compute.offerSheets.ts
 * PURPOSE: Offer-sheet lifecycle compute functions.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 8 Step 1: Extracted from mutationPipeline.compute.ts (L1482-L2249).
 * Wave 50 Step 1: store/match/decline functions extracted to submodule.
 * BZE-191: matched/declined OUTCOME logic factored into the shared outcome module
 * so the two-step finalize* path and the one-click match/decline path reuse it.
 */

import type {
  ComputeMutationParamsWithCurrentState,
  ComputeResultLike,
  MutationOfferSheetResolutionCurrentState,
  MutationPayloadInputByType,
} from './mutationPipeline';
import {
  computeMatchedOfferSheetOutcome,
  computeDeclinedOfferSheetOutcome,
} from './mutationPipeline.compute.offerSheets.outcome';

// Wave 50 Step 1: store/match/decline functions extracted to submodule
export * from './mutationPipeline.compute.offerSheets.initial';
// BZE-191: shared matched/declined outcome helpers
export * from './mutationPipeline.compute.offerSheets.outcome';

/**
 * Compute MATCHED offer sheet finalization (legacy two-step path).
 *
 * Requires a prior MATCHED status flip; the player-move outcome is shared with
 * the one-click match path via computeMatchedOfferSheetOutcome.
 */
export function computeFinalizeMatchedOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  asOfDate,
}: ComputeMutationParamsWithCurrentState<
  MutationOfferSheetResolutionCurrentState,
  MutationPayloadInputByType['finalizeMatchedOfferSheet']
> & { asOfDate?: string | number | null }): ComputeResultLike {
  return computeMatchedOfferSheetOutcome({
    payload,
    currentState,
    seasonId,
    timestamp,
    resolutionAt: payload.offerSheetResolutionAt,
    worldAsOfDate: asOfDate,
    acceptedStatuses: ['MATCHED'],
    metadataType: 'finalizeMatchedOfferSheet',
  });
}

/**
 * Phase 18.1: Compute DECLINED offer sheet finalization (legacy two-step path).
 *
 * Requires a prior DECLINED status flip; the player-move outcome is shared with
 * the one-click decline path via computeDeclinedOfferSheetOutcome.
 */
export function computeFinalizeDeclinedOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  asOfDate,
}: ComputeMutationParamsWithCurrentState<
  MutationOfferSheetResolutionCurrentState,
  MutationPayloadInputByType['finalizeDeclinedOfferSheet']
> & { asOfDate?: string | number | null }): ComputeResultLike {
  return computeDeclinedOfferSheetOutcome({
    payload,
    currentState,
    seasonId,
    timestamp,
    resolutionAt: payload.offerSheetResolutionAt,
    worldAsOfDate: asOfDate,
    acceptedStatuses: ['DECLINED'],
    metadataType: 'finalizeDeclinedOfferSheet',
  });
}
