/**
 * FILE: src/features/architect/utils/tradeContext/tradeContext.ts
 * PURPOSE: Trade snapshot, preparation, and preview helpers.
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * HISTORY:
 *  - 2026-01-30: Phase 58 - Extracted from mutationPipeline.ts
 *  - 2026-01-30: Phase 59 - Moved validateTradeForContext to legacy/ namespace
 *  - 2026-03-27: TM-3E - Added canonical preview authority naming and
 *                        clarified preparation-vs-authority boundary.
 *  - 2026-03-28: TM-5D - Clarified canonical preparation and preview
 *                        ownership boundaries so safe staging is preserved.
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Types: src/features/architect/utils/tradeContext/types.ts
 *  - Phase 56: Post-Trade Snapshot Validation + Pure Compute
 *  - Phase 58: Trade Context Extraction + Shape Hardening
 *  - Phase 59: Legacy Trade Validation Retirement
 *
 * DESIGN:
 * This module contains the Phase 56 / TM-3B trade-apply helpers up to the
 * prepared validated context handoff:
 * - buildPostTradeTeamsSnapshot(): Pure function that applies roster moves
 * - validatePostTradeSnapshotForContext(): Validates snapshot and returns context
 * - buildTradeApplyPreparation(): Canonical preparation handoff only
 * - buildSignAndTradeTradeHandoff(): SAT-specific handoff into trade preparation
 * - getTradePreviewAuthority(): Canonical preview authority surface
 *
 * INTENTIONAL STAGING BOUNDARIES:
 * - Preparation stays separate from execution authority so preview/apply can
 *   reuse the same prepared trade context without blurring final legality.
 * - Preview stays separate from apply because it intentionally omits the live
 *   world-state-only gates and never crosses into persistence.
 *
 * Legacy convenience wrapper (validateTradeForContext) moved to ./legacy/ in Phase 59.
 *
 * These were extracted from mutationPipeline.ts to:
 * 1. Improve maintainability (smaller files, single responsibility)
 * 2. Enable better testing of snapshot/context logic in isolation
 * 3. Define a clear module boundary for the trade validation pipeline
 *
 * PURE FUNCTION GUARANTEES:
 * - buildPostTradeTeamsSnapshot: No side effects, no validation calls
 * - validatePostTradeSnapshotForContext: Calls validateTrade exactly ONCE
 * - buildSignAndTradeTradeHandoff: Deterministic SAT handoff builder
 * - Both functions are deterministic given the same inputs
 */

import { validateTrade } from '@/features/architect/utils/tradeMachine';
import { toEndYear } from '@/features/architect/utils/seasonFormat';
import { assertPostTradeSnapshot } from './assertions';
import { normalizeContractForWorld } from '@/features/architect/utils/contractNormalization';
import {
  isSignAndTradeEligible,
  resolveSignAndTradeContractPayload,
  validateSignAndTradeContractPayload,
  type SignAndTradePlayerLike,
} from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';
import { createValidationIssue } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';
import type {
  ArchitectMutationPlayerRecord,
  ArchitectMutationTeamRecord,
  ArchitectTradePayloadPlayer,
} from '@/features/architect/utils/mutationPipeline';
import type {
  NormalizedTeamPick,
  TradeExceptionRecord,
  TradeValidationResult,
  TradeValidatorContext,
} from '@/features/architect/utils/tradeMachine/constants/types';
import {
  validateTradePreviewAuthority,
  type TradePreviewExcludedAuthorityStage,
} from './tradeExecutionAuthority';
import type {
  AnyRecord,
  BuildTradeApplyPreparationParams,
  BuildPostTradeTeamsSnapshotParams,
  OutgoingTradeRouteLike,
  PostTradeSnapshot,
  TradeApplyPreparation,
  TradeApplyValidationPlayer,
  TradeApplyValidationTeam,
  TeamUpdate,
  ValidatePostTradeSnapshotForContextParams,
  ValidatedTradeContext,
  ValidationTeam,
  ValidationIssue,
  PayloadPlayerIngress,
  PayloadTeamIngress,
  TradeContextValidationPlayer,
  TradeContextPayload,
  TradeContextNormalizedPayload,
  TradeContextCurrentState,
} from './types';

type SnapshotTradeException = Required<
  Pick<
    TradeExceptionRecord,
    'id' | 'amount' | 'totalAmount' | 'remainingAmount' | 'usedAmount'
  >
> &
  Pick<TradeExceptionRecord, 'createdSeason' | 'expiresOn' | 'createdFrom'>;

type SnapshotTradeExceptionSource = 'legacy' | 'canonical';

type SnapshotTradeExceptionCandidate = {
  normalized: SnapshotTradeException;
  completeness: number;
  source: SnapshotTradeExceptionSource;
};


// Wave 9 Step 3: payload normalization + player projections extracted to submodule
export * from './tradeContext.payloadNormalization';
import {
  buildAuthoritativeTradeApplyReceives,
  buildSnapshotTradeExceptions,
  buildTradeIncomingPlayerSnapshot,
  buildTradeValidationPlayer,
  buildTradeValidationTeamRecord,
  buildTradeValidatorContext,
  findMatchingTradeReceivePayload,
  findTradePlayerSnapshot,
  getTradeApplyValidationPlayerKey,
  getTradePayloadPlayerId,
  getTradePayloadPlayerMatchKey,
  mergeTradeApplyValidationPlayer,
  normalizeFallbackTradeApplyValidationTeam,
  normalizeSnapshotTradeException,
  normalizeTradeTeamCodeLike,
  projectTradeApplyValidationPlayer,
  resolveOutgoingTradeDestinationTeamCode,
  toFiniteNumberOrUndefined,
  toNonEmptyString,
  toObjectRecord,
  toScalarId,
  toSignAndTradePlayerLike,
  toStringOrNull,
} from './tradeContext.payloadNormalization';


// Wave 9 Step 4: snapshot builder + preparation extracted to submodule
export * from './tradeContext.snapshot';
import {
  buildPostTradeTeamsSnapshot,
  buildSignAndTradeTradeHandoff,
  buildTradeApplyPreparation,
  buildTradeValidationPayload,
  normalizeTradeContextPayload,
  normalizeTradePayloadEntitlements,
  normalizeTradePayloadPlayer,
  normalizeTradePayloadTeam,
  validatePostTradeSnapshotForContext,
} from './tradeContext.snapshot';


// ==============================================================================
// TM-1A / TM-3D: FULL LEGALITY PREVIEW (execution authority minus world-state gates)
// ==============================================================================

function buildPreviewAuthorityTeamMaps({
  currentState,
  postTradeSnapshot,
}: {
  currentState: TradeContextCurrentState;
  postTradeSnapshot: PostTradeSnapshot;
}): {
  beforeTeamsByCode: Record<string, AnyRecord>;
  afterTeamsByCode: Record<string, AnyRecord>;
} {
  const beforeTeamsByCode: Record<string, AnyRecord> = {};
  for (const entry of currentState.teams ?? []) {
    const code = entry?.teamCode;
    if (code && entry.team) {
      beforeTeamsByCode[code] = entry.team;
    }
  }

  const afterTeamsByCode: Record<string, AnyRecord> = {};
  for (const update of postTradeSnapshot.teamUpdates) {
    const code = update?.teamCode;
    if (code && update.team) {
      afterTeamsByCode[code] = update.team;
    }
  }

  return {
    beforeTeamsByCode,
    afterTeamsByCode,
  };
}

export type FullLegalityPreviewResult = {
  legal: boolean;
  violations: ValidationIssue[];
  warnings: ValidationIssue[];
  reason: string;
  error: string | null;
  source: 'apply-preview';
  omittedStages?: TradePreviewExcludedAuthorityStage[];
};

type TradePreviewAuthorityParams = {
  payload: TradeContextPayload;
  currentState: TradeContextCurrentState;
  seasonId: string;
  preparation?: TradeApplyPreparation;
};

// TM-3D/TM-3E/TM-5D: Canonical preview authority surface.
// Preview mirrors apply across the shared non-live stages only:
// prepare -> snapshot stage -> post-state stage.
// Preview intentionally omits the live world-state-only gates and never
// replaces apply authority or persistence.
export function getTradePreviewAuthority({
  payload,
  currentState,
  seasonId,
  preparation,
}: TradePreviewAuthorityParams): FullLegalityPreviewResult {
  try {
    const prepared =
      preparation ||
      buildTradeApplyPreparation({
        payload,
        currentState,
        seasonId,
        timestamp: Date.now(),
      });
    const { beforeTeamsByCode, afterTeamsByCode } =
      buildPreviewAuthorityTeamMaps({
        currentState,
        postTradeSnapshot: prepared.postTradeSnapshot,
      });
    const previewAuthority = validateTradePreviewAuthority({
      seasonId,
      validatedTradeContext: prepared.validatedContext,
      beforeTeamsByCode,
      afterTeamsByCode,
      worldId: String(payload.tradeCtx?.worldId ?? 'preview-world'),
      asOfDate:
        typeof payload.tradeCtx?.asOfDate === 'string'
          ? payload.tradeCtx.asOfDate
          : null,
    });

    return {
      legal: previewAuthority.valid,
      violations: previewAuthority.violations,
      warnings: previewAuthority.warnings,
      reason: previewAuthority.reason,
      error:
        previewAuthority.failedStage === 'SNAPSHOT_VALIDATION'
          ? (previewAuthority.error ?? prepared.validatedContext.error ?? null)
          : (prepared.validatedContext.error ?? null),
      source: 'apply-preview',
      omittedStages: previewAuthority.omittedStages,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      legal: false,
      violations: [
        {
          message,
          severity: 'error' as const,
          rule: 'apply-preview-error',
          code: 'APPLY_PREVIEW_ERROR',
        },
      ],
      warnings: [],
      reason: message,
      error: message,
      source: 'apply-preview',
    };
  }
}

/**
 * @deprecated Compatibility alias. Use getTradePreviewAuthority() as the
 * canonical preview authority surface. This alias is retained for legacy/
 * compatibility re-export only.
 */
export function getFullLegalityPreview(
  params: TradePreviewAuthorityParams
): FullLegalityPreviewResult {
  return getTradePreviewAuthority(params);
}

// ==============================================================================
// PHASE 59: LEGACY FUNCTION MOVED
// ==============================================================================
// validateTradeForContext has been moved to tradeContext/legacy/index.ts
// Import from '@/features/architect/utils/tradeContext/legacy' for the deprecated wrapper
