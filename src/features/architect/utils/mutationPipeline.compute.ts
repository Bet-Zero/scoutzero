/**
 * FILE: src/features/architect/utils/mutationPipeline.compute.ts
 * PURPOSE: Compute-phase helpers for world mutations — all compute*Result() functions.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 4 Step 4d: Extracted from mutationPipeline.ts (L3820-5194, L5608-end).
 * These are pure computation functions: no Firebase, no React, no read.ts calls.
 * The orchestrator (computeWorldMutation) stays in mutationPipeline.ts.
 */

import {
  buildCanonicalPlayerPersistenceManifest,
  buildTradePlayerPersistenceManifest,
  findPlayerInTeamPlayers,
  getMutationPlayerId,
  getMutationRosterEntryId,
  getSalaryRowEndYear,
  getTeamSourceRecord,
  materializeCurrentStateBaseTeamPreservedFields,
  normalizeMutationExceptionsFromIngress,
  requireBasicTeamAndPlayerState,
  requireBasicTeamState,
  requireDestinationState,
  requireOfferSheetTeamState,
  requireSigningState,
  synchronizeTeamTotalsSnapshotOrTeam,
  toMutationExceptionPreserveOnlyBuckets,
  toOptionalNumber,
  toOptionalTrimmedString,
} from './mutationPipeline.helpers';

import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import {
  normalizeContractForWorld,
  normalizeFutureContract,
  normalizeSalaryRow,
} from '@/features/architect/utils/contractNormalization';
import {
  computeExpectedCapHoldAmount,
  deriveFreeAgencyYearFromOptionSeason,
  getRightsTypeFromPlayer,
} from '@/features/architect/utils/capHoldTransitionHelpers';
import { appendExceptionHistory } from '@/features/architect/utils/exceptionHistory/historyHelpers';
import { applyTradeExceptionLifecycle } from '@/features/architect/utils/tradeMachine/utils/tradeExceptionLifecycle';
import {
  getCanonicalExceptionAvailability,
  getCanonicalExceptionKeyForSigningMechanism,
} from '@/features/architect/utils/exceptions/exceptionOwnership';
import { getSigningHardCapTriggerMetadata } from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import {
  buildSignAndTradeTradeHandoff,
  normalizeTradeTeamCodeLike,
} from '@/features/architect/utils/tradeContext/tradeContext';

import { assertTradeComputeInputs } from '@/features/architect/utils/tradeContext';
import {
  matchesOfferSheetIdentity,
  buildNormalizedOfferSheetFinalContract,
  removeOfferSheetEntries,
  validateSignAndTradeSigningPhase,
} from './mutationPipeline.read';

import type { TradeContextCurrentState } from '@/features/architect/utils/tradeContext/types';
import type { MutationExceptionPreserveOnlyBuckets } from './mutationPipeline.read';
import type {
  ArchitectMutationContract,
  ArchitectMutationExceptionEntry,
  ArchitectMutationExceptions,
  ArchitectMutationOfferSheet,
  ArchitectMutationPlayerRecord,
  ArchitectMutationTeamRecord,
  ArchitectMutationTeamUpdate,
  CapHoldComputationPlayer,
  ComputeMutationParamsWithCurrentState,
  ComputeResultLike,
  CurrentStateTeamRoundTripMaterializable,
  EntitlementUpdateLike,
  MutationOfferSheetMirrorCurrentState,
  MutationOfferSheetResolutionCurrentState,
  MutationOfferSheetTeamAndPlayerCurrentState,
  MutationPayloadInputByType,
  MutationPipelineSalaryRow,
  MutationSignAndTradeCurrentState,
  MutationSigningCurrentState,
  MutationTeamAndPlayerCurrentState,
  MutationTeamOnlyCurrentState,
  NormalizedMutationSalaryRow,
  PlayerDeleteLike,
  PlayerUpdateLike,
  TeamLike,
  TradeMutationPayload,
  TradeApplyValidationTeamLike,
  TradeEntitlementsMovedByTeam,
  TradeHistoryContextLike,
  TradeMutationMetadata,
  TradeSnapshotLike,
  TradeTeamUpdate,
  TradeTpeConsumptionIssue,
  TradeValidatedContextLike,
  TradeValidationApplyTimeSlice,
} from './mutationPipeline';


// Wave 8 Step 3: trade compute functions extracted to submodule
export * from './mutationPipeline.compute.trade';
import {
  getTradeValidationApplyTimeSlice,
  computeTradeResult,
} from './mutationPipeline.compute.trade';



// Wave 8 Step 2: signing compute functions extracted to submodule
export * from './mutationPipeline.compute.signings';
import {
  resolveSigningMechanismForPipeline,
  toFiniteAmount,
  toFiniteIntegerOrNull,
  sumContractValueFromRows,
  toCapHoldComputationPlayer,
  consumeSigningExceptionUsage,
  computeSigningResult,
  computeWaiveResult,
  computeExtensionResult,
  computeOptionResult,
  computeRenounceResult,
  MANUAL_EXCEPTION_MUTATION_KEYS,
  MANUAL_EXCEPTION_MUTATION_KEY_SET,
  mergeManualExceptionSnapshot,
  computeSetExceptionsResult,
} from './mutationPipeline.compute.signings';



// Wave 8 Step 1: offer-sheet compute functions extracted to submodule
export * from './mutationPipeline.compute.offerSheets';
import {
  computeStoreOfferSheetResult,
  computeMatchOfferSheetResult,
  computeDeclineOfferSheetResult,
  computeFinalizeMatchedOfferSheetResult,
  computeFinalizeDeclinedOfferSheetResult,
} from './mutationPipeline.compute.offerSheets';

export function computeSignAndTradeResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  asOfDate = null,
  worldId,
  historyContext = {},
}: ComputeMutationParamsWithCurrentState<
  MutationSignAndTradeCurrentState,
  MutationPayloadInputByType['signAndTrade']
> & {
  asOfDate?: string | number | null;
  worldId?: string;
  historyContext?: TradeHistoryContextLike;
}): ComputeResultLike {
  const { team, destinationTeam, player } = requireDestinationState(
    currentState,
    'signAndTrade'
  );
  const { teamCode, destinationTeamCode } = payload;

  // 1. Compute Signing Result
  const signingPayload = {
    playerId: payload.playerId,
    contract: payload.contract,
    signedUsing: payload.signedUsing,
  };

  const signingState: MutationSigningCurrentState = { team, player, teamCode };
  const signingResult = computeSigningResult({
    payload: signingPayload,
    currentState: signingState,
    seasonId,
    timestamp,
  });

  if (!signingResult.success) {
    return {
      success: false,
      error: signingResult.error || 'Signing step failed',
    };
  }

  // Phase 48: Validate the SAT signing phase before the trade handoff.
  const signingValidation = validateSignAndTradeSigningPhase({
    team,
    player,
    contract: payload.contract,
    signedUsing: payload.signedUsing,
    seasonId,
  });

  if (!signingValidation.valid) {
    return {
      success: false,
      error:
        signingValidation.violations?.[0]?.message ||
        'Signing validation failed',
      violations: signingValidation.violations.map((violation: unknown) =>
        typeof violation === 'string' ? violation : JSON.stringify(violation)
      ),
      warnings: signingValidation.warnings,
    };
  }

  // Extract updated source team and player (now signed) from signing result
  const signingTeamUpdate = signingResult.teamUpdates?.[0]?.team;
  const signedPlayer = signingResult.playerUpdates?.[0]?.player;
  if (!signingTeamUpdate || !signedPlayer) {
    return {
      success: false,
      error:
        'Signing step did not return the source-team and player truth required for sign-and-trade handoff.',
    };
  }
  const updatedSourceTeam =
    (materializeCurrentStateBaseTeamPreservedFields(
      signingTeamUpdate as CurrentStateTeamRoundTripMaterializable
    ) as ArchitectMutationTeamRecord | null) ||
    (signingTeamUpdate as ArchitectMutationTeamRecord);

  // 2. Build the SAT handoff into the canonical trade preparation surface.
  const tradeHandoff = buildSignAndTradeTradeHandoff({
    sourceTeamCode: teamCode,
    destinationTeamCode,
    updatedSourceTeam,
    destinationTeam,
    signedPlayer,
    contract: payload.contract || null,
    seasonId,
    timestamp,
    asOfDate,
    worldId,
  });

  // 3. Call pure trade compute with the prepared SAT trade handoff.
  const tradeResult = computeTradeResult({
    payload: tradeHandoff.tradePayload,
    currentState: tradeHandoff.tradeState,
    seasonId,
    timestamp,
    historyContext: {
      worldId: historyContext.worldId || worldId,
      mutationType: historyContext.mutationType || 'signAndTrade',
      mutationId: historyContext.mutationId,
    },
    postTradeSnapshot: tradeHandoff.tradeApplyPreparation.postTradeSnapshot,
    validatedContext: tradeHandoff.tradeApplyPreparation.validatedContext,
  });

  if (!tradeResult.success) {
    return { success: false, error: tradeResult.error || 'Trade step failed' };
  }

  // 4. Return combined SAT result with both prevalidated contexts attached.
  // Phase 56: Attach validated contexts for validateMutation de-duplication
  return {
    success: true,
    teamUpdates: tradeResult.teamUpdates, // Contains both Source (minus player) and Dest (plus player)
    playerUpdates: tradeResult.playerUpdates, // Player with new teamCode
    playerDeletes: tradeResult.playerDeletes,
    metadata: {
      type: 'signAndTrade',
      sourceTeam: teamCode,
      destinationTeam: destinationTeamCode,
      playerId: payload.playerId,
      contract: payload.contract,
      timestamp,
    },
    // Phase 56: Attach validated contexts for validateMutation de-duplication
    _signingValidation: signingValidation,
    _validatedTradeContext: tradeHandoff.tradeApplyPreparation.validatedContext,
  };
}

// ==============================================================================
// HELPER FUNCTIONS
// ==============================================================================

/**
 * Map mutation type to action type for stats tracking
 */
export function getMutationActionType(mutationType: string) {
  switch (mutationType) {
    case 'executeTrade':
      return 'trade';
    case 'signFreeAgent':
      return 'signing';
    case 'waivePlayer':
      return 'waive';
    case 'extendPlayer':
      return 'signing';
    case 'optionDecision':
      return 'signing';
    case 'renounceRights':
      return 'renounce';
    case 'storeOfferSheet':
    case 'matchOfferSheet':
    case 'declineOfferSheet':
    case 'finalizeMatchedOfferSheet':
    case 'finalizeDeclinedOfferSheet':
    case 'signAndTrade':
      return 'signing';
    default:
      return 'unknown';
  }
}

/**
 * Compute set dead cap result
 */
export function computeSetDeadCapResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationTeamOnlyCurrentState,
  MutationPayloadInputByType['setDeadCap']
>): ComputeResultLike {
  const { teamCode } = payload;
  const { team } = requireBasicTeamState(currentState, 'setDeadCap');

  if (!payload.deadCap || !Array.isArray(payload.deadCap)) {
    return {
      success: false,
      error: 'Invalid deadCap payload: must be an array',
    };
  }

  // Update deadCap
  const updatedTeam = {
    ...team,
    deadCap: payload.deadCap,
    // Add logic to clean up legacy fields if we want to force migration?
    // For now, let's keep it simple: new schema takes precedence in computation anyway.
  };
  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };
  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedTeam,
    toEndYear(seasonId)
  ).totals;

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [],
    metadata: {
      actionType: 'setDeadCap',
      teamCode,
      deadCapChanges:
        Array.isArray(payload.deadCapChanges) && payload.deadCapChanges.length
          ? payload.deadCapChanges
          : ['Dead cap updated'],
      timestamp,
    },
  };
}
