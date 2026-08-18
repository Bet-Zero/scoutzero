/**
 * Wave 28: Constants, private helpers, type definitions, and
 * computeNormalizedWorldMutation extracted from mutationPipeline.ts
 * (lines 221–652 and 1563–1751).
 */

import {
  buildTradeApplyPreparation,
} from '@/features/architect/utils/tradeContext/tradeContext';
import {
  normalizeTradeMutationCurrentState,
  normalizeTeamOnlyMutationCurrentState,
  normalizeTeamAndPlayerMutationCurrentState,
  normalizeOfferSheetTeamAndPlayerMutationCurrentState,
  normalizeOfferSheetResolutionMutationCurrentState,
  normalizeSignAndTradeMutationCurrentState,
  toTradePayload,
  withDefaultPlayerDeletes,
  canonicalizeComputeResultTeamUpdates,
} from './mutationPipeline.read';
import { toTradeStateSlice } from './mutationPipeline.helpers';
import {
  computeTradeResult,
  computeSigningResult,
  computeWaiveResult,
  computeExtensionResult,
  computeOptionResult,
  computeRenounceResult,
  computeSetExceptionsResult,
  computeStoreOfferSheetResult,
  computeMatchOfferSheetResult,
  computeDeclineOfferSheetResult,
  computeFinalizeMatchedOfferSheetResult,
  computeFinalizeDeclinedOfferSheetResult,
  computeSignAndTradeResult,
  computeSetDeadCapResult,
} from './mutationPipeline.compute';
import type {
  ArchitectMutationPayload,
  ComputeResultLike,
  ComputeWorldMutationArgs,
  MutationAuditContext,
  MutationCurrentStateInputByType,
  MutationEventSourceResult,
  MutationPayloadInputByType,
  PlayerLike,
  PublicComputeWorldMutationArgs,
  PublicMutationPayloadInputByType,
  SignAndTradePreflightStatus,
  SupportedComputeMutationType,
  TeamLike,
} from './mutationPipeline.types';

// ============================================================
// Constants
// ============================================================

const SUPPORTED_COMPUTE_MUTATION_TYPES = [
  'executeTrade',
  'signFreeAgent',
  'waivePlayer',
  'extendPlayer',
  'optionDecision',
  'renounceRights',
  'storeOfferSheet',
  'matchOfferSheet',
  'declineOfferSheet',
  'finalizeMatchedOfferSheet',
  'finalizeDeclinedOfferSheet',
  'signAndTrade',
  'setDeadCap',
  'setExceptions',
] as const satisfies readonly SupportedComputeMutationType[];
const SUPPORTED_COMPUTE_MUTATION_TYPE_SET =
  new Set<SupportedComputeMutationType>(SUPPORTED_COMPUTE_MUTATION_TYPES);

const TRADE_MUTATION_PAYLOAD_KEYS = [
  'teams',
  'capProjections',
  'tradeCtx',
  'asOfDate',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];
const SIGNING_MUTATION_PAYLOAD_KEYS = [
  'playerId',
  'contract',
  'signedUsing',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];
const WAIVE_MUTATION_PAYLOAD_KEYS = [
  'playerId',
  'stretch',
  'stretchYears',
  'buyout',
  'buyoutAmount',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];
const EXTENSION_MUTATION_PAYLOAD_KEYS = [
  'playerId',
  'contractId',
  'extension',
  'extensionProposal',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];
const OPTION_MUTATION_PAYLOAD_KEYS = [
  'playerId',
  'accepted',
  'targetYear',
  'contractId',
  'optionNotice',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];
const RENOUNCE_MUTATION_PAYLOAD_KEYS = [
  'playerId',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];
const STORE_OFFER_SHEET_MUTATION_PAYLOAD_KEYS = [
  'contract',
  'offerSheetId',
  'worldId',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];
const OFFER_SHEET_RESOLUTION_MUTATION_PAYLOAD_KEYS = [
  'dedupKey',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];
const SIGN_AND_TRADE_MUTATION_PAYLOAD_KEYS = [
  'teamCode',
  'destinationTeamCode',
  'playerId',
  'contract',
  'signedUsing',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];
const SET_DEAD_CAP_MUTATION_PAYLOAD_KEYS = [
  'teamCode',
  'deadCap',
  'deadCapChanges',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];
const SET_EXCEPTIONS_MUTATION_PAYLOAD_KEYS = [
  'teamCode',
  'exceptions',
  'exceptionChanges',
] as const satisfies readonly (keyof ArchitectMutationPayload)[];

// ============================================================
// Private helpers
// ============================================================

export function isSupportedComputeMutationType(
  mutationType: string
): mutationType is SupportedComputeMutationType {
  return SUPPORTED_COMPUTE_MUTATION_TYPE_SET.has(
    mutationType as SupportedComputeMutationType
  );
}

function pickMutationPayloadFields<
  TMutationPayloadKey extends keyof ArchitectMutationPayload,
>(
  payload: ArchitectMutationPayload,
  keys: readonly TMutationPayloadKey[]
): Pick<ArchitectMutationPayload, TMutationPayloadKey> {
  return Object.fromEntries(
    keys
      .filter((key) => payload[key] !== undefined)
      .map((key) => [key, payload[key]])
  ) as Pick<ArchitectMutationPayload, TMutationPayloadKey>;
}

function normalizeComputeWorldMutationPayload<
  TMutationType extends SupportedComputeMutationType,
>(
  mutationType: TMutationType,
  payload:
    | PublicMutationPayloadInputByType[TMutationType]
    | ArchitectMutationPayload
): MutationPayloadInputByType[TMutationType] {
  const publicPayload = payload as ArchitectMutationPayload;

  switch (mutationType) {
    case 'executeTrade':
      return toTradePayload(
        pickMutationPayloadFields(publicPayload, TRADE_MUTATION_PAYLOAD_KEYS)
      ) as MutationPayloadInputByType[TMutationType];

    case 'signFreeAgent':
      return pickMutationPayloadFields(
        publicPayload,
        SIGNING_MUTATION_PAYLOAD_KEYS
      ) as MutationPayloadInputByType[TMutationType];

    case 'waivePlayer':
      return pickMutationPayloadFields(
        publicPayload,
        WAIVE_MUTATION_PAYLOAD_KEYS
      ) as MutationPayloadInputByType[TMutationType];

    case 'extendPlayer':
      return pickMutationPayloadFields(
        publicPayload,
        EXTENSION_MUTATION_PAYLOAD_KEYS
      ) as MutationPayloadInputByType[TMutationType];

    case 'optionDecision':
      return pickMutationPayloadFields(
        publicPayload,
        OPTION_MUTATION_PAYLOAD_KEYS
      ) as MutationPayloadInputByType[TMutationType];

    case 'renounceRights':
      return pickMutationPayloadFields(
        publicPayload,
        RENOUNCE_MUTATION_PAYLOAD_KEYS
      ) as MutationPayloadInputByType[TMutationType];

    case 'storeOfferSheet':
      return pickMutationPayloadFields(
        publicPayload,
        STORE_OFFER_SHEET_MUTATION_PAYLOAD_KEYS
      ) as MutationPayloadInputByType[TMutationType];

    // BZE-191: match/decline are now atomic resolutions sharing the finalize
    // resolution payload shape (offer-sheet identity + optional dedupKey).
    case 'matchOfferSheet':
    case 'declineOfferSheet':
    case 'finalizeMatchedOfferSheet':
    case 'finalizeDeclinedOfferSheet':
      return pickMutationPayloadFields(
        publicPayload,
        OFFER_SHEET_RESOLUTION_MUTATION_PAYLOAD_KEYS
      ) as MutationPayloadInputByType[TMutationType];

    case 'signAndTrade':
      return pickMutationPayloadFields(
        publicPayload,
        SIGN_AND_TRADE_MUTATION_PAYLOAD_KEYS
      ) as MutationPayloadInputByType[TMutationType];

    case 'setDeadCap':
      return pickMutationPayloadFields(
        publicPayload,
        SET_DEAD_CAP_MUTATION_PAYLOAD_KEYS
      ) as MutationPayloadInputByType[TMutationType];

    case 'setExceptions':
      return pickMutationPayloadFields(
        publicPayload,
        SET_EXCEPTIONS_MUTATION_PAYLOAD_KEYS
      ) as MutationPayloadInputByType[TMutationType];
  }
}

export function normalizeComputeWorldMutationArgs(
  args: PublicComputeWorldMutationArgs
): ComputeWorldMutationArgs {
  switch (args.mutationType) {
    case 'executeTrade':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeTradeMutationCurrentState(args.currentState),
      };

    case 'signFreeAgent':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeOfferSheetTeamAndPlayerMutationCurrentState(
          args.currentState
        ),
      };

    case 'storeOfferSheet':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeOfferSheetTeamAndPlayerMutationCurrentState(
          args.currentState
        ),
      };

    case 'waivePlayer':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeTeamAndPlayerMutationCurrentState(
          args.currentState
        ),
      };

    case 'extendPlayer':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeTeamAndPlayerMutationCurrentState(
          args.currentState
        ),
      };

    case 'optionDecision':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeTeamAndPlayerMutationCurrentState(
          args.currentState
        ),
      };

    case 'renounceRights':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeTeamAndPlayerMutationCurrentState(
          args.currentState
        ),
      };

    // BZE-191: match/decline now perform the full atomic resolution outcome and
    // therefore need the resolution current-state shape (both teams' players /
    // rosters), identical to the legacy two-step finalize path.
    case 'matchOfferSheet':
    case 'declineOfferSheet':
    case 'finalizeMatchedOfferSheet':
    case 'finalizeDeclinedOfferSheet':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeOfferSheetResolutionMutationCurrentState(
          args.currentState
        ),
      };

    case 'signAndTrade':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeSignAndTradeMutationCurrentState(
          args.currentState
        ),
      };

    case 'setDeadCap':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeTeamOnlyMutationCurrentState(args.currentState),
      };

    case 'setExceptions':
      return {
        ...args,
        payload: normalizeComputeWorldMutationPayload(
          args.mutationType,
          args.payload
        ),
        currentState: normalizeTeamOnlyMutationCurrentState(args.currentState),
      };
  }
}

export function computeTypedWorldMutation<
  TMutationType extends SupportedComputeMutationType,
>({
  mutationType,
  payload,
  currentState,
  seasonId,
  timestamp,
  asOfDate,
  worldId,
  operationId,
  authoringIdentity,
  recordedAt,
}: {
  mutationType: TMutationType;
  payload:
    | PublicMutationPayloadInputByType[TMutationType]
    | ArchitectMutationPayload;
  currentState: MutationCurrentStateInputByType[TMutationType];
  seasonId: string;
  timestamp: number;
  asOfDate?: string | number | null;
  worldId?: string;
  operationId?: string;
  authoringIdentity?: string;
  recordedAt?: string;
}): ComputeResultLike {
  return computeNormalizedWorldMutation({
    mutationType,
    payload: normalizeComputeWorldMutationPayload(mutationType, payload),
    currentState,
    seasonId,
    timestamp,
    asOfDate,
    worldId,
    operationId,
    authoringIdentity,
    recordedAt,
  } as ComputeWorldMutationArgs);
}

// ============================================================
// Type definitions
// ============================================================

export type BuildWorldMutationEventPayloadArgs = {
  mutationType: string;
  eventId: string;
  seasonId: string;
  worldId: string;
  timestamp: number;
  computeResult: MutationEventSourceResult;
  auditContext?: MutationAuditContext;
};

/** Shared base parameter type for all compute*Result functions */
type ComputeMutationParams<TPayload, TCurrentState> = {
  payload: TPayload;
  currentState: TCurrentState;
  seasonId: string;
  timestamp: number;
};
export type ComputeMutationParamsWithCurrentState<TCurrentState, TPayload> =
  ComputeMutationParams<TPayload, TCurrentState>;

export type SignAndTradeAuthoritySummary = {
  status: SignAndTradePreflightStatus;
  reasons: string[];
  warnings: string[];
  error: string | null;
  violations: string[];
  warningIssues: unknown[];
};

export const AUTHORITATIVE_WORLD_TEAM_CODES = [
  'ATL',
  'BOS',
  'BKN',
  'CHA',
  'CHI',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GSW',
  'HOU',
  'IND',
  'LAC',
  'LAL',
  'MEM',
  'MIA',
  'MIL',
  'MIN',
  'NOP',
  'NYK',
  'OKC',
  'ORL',
  'PHI',
  'PHX',
  'POR',
  'SAC',
  'SAS',
  'TOR',
  'UTA',
  'WAS',
] as const;

export type StoreOfferSheetOwnershipCandidate = {
  teamCode: string;
  snapshotWorldId: string;
  team: TeamLike;
  rosterMatch: boolean | null;
  playersMatch: boolean | null;
  capHoldMatch: boolean | null;
  snapshotPlayer: PlayerLike | null;
};

// ============================================================
// computeNormalizedWorldMutation
// ============================================================

export function computeNormalizedWorldMutation(
  args: ComputeWorldMutationArgs
): ComputeResultLike {
  const {
    seasonId,
    timestamp,
    asOfDate,
    worldId,
    operationId,
    authoringIdentity,
    recordedAt,
  } = args;
  const result = (() => {
    switch (args.mutationType) {
      case 'executeTrade': {
        const tradePayload = args.payload;
        const tradeState = toTradeStateSlice(args.currentState);

        // TM-3B: Prepare trade apply inputs in one canonical handoff surface.
        const tradeApplyPreparation = buildTradeApplyPreparation({
          payload: tradePayload,
          currentState: tradeState,
          seasonId,
          timestamp,
          asOfDate,
        });

        // Step 2: Call pure computeTradeResult with prepared snapshot/context
        const tradeResult = computeTradeResult({
          payload: tradePayload,
          currentState: tradeState,
          seasonId,
          timestamp,
          historyContext: { worldId, mutationType: args.mutationType },
          postTradeSnapshot: tradeApplyPreparation.postTradeSnapshot,
          validatedContext: tradeApplyPreparation.validatedContext,
        });

        return withDefaultPlayerDeletes(tradeResult);
      }

      case 'signFreeAgent': {
        return withDefaultPlayerDeletes(
          computeSigningResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'waivePlayer': {
        return withDefaultPlayerDeletes(
          computeWaiveResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'extendPlayer': {
        return withDefaultPlayerDeletes(
          computeExtensionResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
            asOfDate,
            worldId,
            operationId,
            authoringIdentity,
            recordedAt,
          })
        );
      }

      case 'storeOfferSheet': {
        return withDefaultPlayerDeletes(
          computeStoreOfferSheetResult({
            // computeStoreOfferSheetResult reads worldId from the payload for its
            // dedup identity. Thread the authoritative top-level worldId in (as
            // signAndTrade does with its worldId param) so both the preflight and
            // the commit can resolve it; callers don't always set payload.worldId.
            payload: {
              ...args.payload,
              worldId: args.payload?.worldId ?? worldId,
            },
            currentState: args.currentState,
            seasonId,
            timestamp,
            asOfDate,
          })
        );
      }

      case 'matchOfferSheet': {
        return withDefaultPlayerDeletes(
          computeMatchOfferSheetResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'declineOfferSheet': {
        return withDefaultPlayerDeletes(
          computeDeclineOfferSheetResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'finalizeMatchedOfferSheet': {
        return withDefaultPlayerDeletes(
          computeFinalizeMatchedOfferSheetResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'finalizeDeclinedOfferSheet': {
        return withDefaultPlayerDeletes(
          computeFinalizeDeclinedOfferSheetResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'optionDecision': {
        return withDefaultPlayerDeletes(
          computeOptionResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
            asOfDate,
            worldId,
            operationId,
            authoringIdentity,
          })
        );
      }

      case 'renounceRights': {
        return withDefaultPlayerDeletes(
          computeRenounceResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
            asOfDate,
            worldId,
            operationId,
            authoringIdentity,
            recordedAt,
          })
        );
      }

      case 'signAndTrade': {
        return withDefaultPlayerDeletes(
          computeSignAndTradeResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
            asOfDate,
            worldId,
            historyContext: { worldId, mutationType: args.mutationType },
          })
        );
      }

      case 'setDeadCap': {
        return withDefaultPlayerDeletes(
          computeSetDeadCapResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
          })
        );
      }

      case 'setExceptions': {
        return withDefaultPlayerDeletes(
          computeSetExceptionsResult({
            payload: args.payload,
            currentState: args.currentState,
            seasonId,
            timestamp,
          })
        );
      }

      default:
        return withDefaultPlayerDeletes({
          success: false,
          error: 'Unknown mutation type',
        });
    }
  })();

  return canonicalizeComputeResultTeamUpdates(result, seasonId);
}
