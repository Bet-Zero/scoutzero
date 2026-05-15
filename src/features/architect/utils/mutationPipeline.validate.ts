/**
 * FILE: src/features/architect/utils/mutationPipeline.validate.ts
 * PURPOSE: PHASE 3 validate function for the mutation pipeline.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 7 Step 2: Extracted from mutationPipeline.ts (PHASE 3 section).
 */

import { validateNonTradeMutationStage } from '@/features/architect/utils/nonTradeMutationValidationStage';
import { evaluateTradeSnapshotValidationStage } from '@/features/architect/utils/tradeContext/tradeExecutionAuthority';
import { summarizeSignAndTradeAuthority } from '@/features/architect/utils/mutationPipeline.read';
import type {
  ComputeResultLike,
  MutationCurrentState,
  MutationPayloadLike,
} from './mutationPipeline.types';

export function validateMutation({
  mutationType,
  payload,
  currentState,
  computeResult,
  seasonId,
  asOfDate,
  dateDefaulted,
}: {
  mutationType: string;
  payload: MutationPayloadLike;
  currentState: MutationCurrentState;
  computeResult: ComputeResultLike;
  seasonId: string;
  asOfDate?: string | null;
  dateDefaulted?: boolean;
}): {
  valid: boolean;
  error?: string;
  violations?: string[];
  warnings?: unknown[];
} {
  // Phase 20: Collect warnings including world time defaulted warning
  const pipelineWarnings = [];

  if (dateDefaulted) {
    pipelineWarnings.push({
      rule: 'world_time_defaulted',
      message: `World time was defaulted to ${asOfDate}. For accurate timing-based validation, provide asOfDate in payload or world metadata.`,
      severity: 'warning',
      asOfDateUsed: asOfDate,
    });
  }

  // Trade validation uses the prepared Trade Machine context.
  if (mutationType === 'executeTrade') {
    // This remains a compatibility-stage adapter for callers that still route
    // through validateMutation(). It is NOT the canonical execution surface.
    // applyWorldMutation() must continue to use:
    // prepared context -> validateTradeExecutionAuthority() -> persistWorldMutation().
    // Phase 56+/TM-3B: Trade validation MUST have already occurred via
    // buildTradeApplyPreparation, which attaches _validatedTradeContext.
    // TM-3C: The authority layer owns the stage-1 verdict adapter for that context.
    // computeWorldMutation guarantees _validatedTradeContext is attached to computeResult
    if (computeResult?._validatedTradeContext?._isValidatedTradeContext) {
      return evaluateTradeSnapshotValidationStage({
        validatedTradeContext: computeResult._validatedTradeContext,
        asOfDate: asOfDate ?? null,
        dateDefaulted,
      });
    }

    // Phase 57: Hard error if context is missing - no fallback validation
    // This should never happen if the pipeline is correctly structured
    throw new Error(
      '[validateMutation] Phase 57 violation: executeTrade requires pre-validated context. ' +
        'computeWorldMutation must attach _validatedTradeContext via buildTradeApplyPreparation().'
    );
  }

  switch (mutationType) {
    case 'signAndTrade': {
      // Phase 56+: S&T validation MUST have already occurred via computeSignAndTradeResult
      // which calls validateSigning + validatePostTradeSnapshotForContext before computeTradeResult
      const hasPreValidatedSigning =
        computeResult?._signingValidation?.valid !== undefined;
      const hasPreValidatedTrade =
        computeResult?._validatedTradeContext?._isValidatedTradeContext;

      if (hasPreValidatedSigning && hasPreValidatedTrade) {
        const summary = summarizeSignAndTradeAuthority({
          signingValidation: computeResult._signingValidation,
          tradeValidation: computeResult._validatedTradeContext,
        });

        return {
          valid: summary.status === 'legal',
          error: summary.error || undefined,
          violations: summary.violations,
          warnings: [...summary.warningIssues, ...pipelineWarnings],
        };
      }

      // Phase 57: Hard error if contexts are missing - no fallback validation
      // computeSignAndTradeResult must attach both _signingValidation and _validatedTradeContext
      throw new Error(
        '[validateMutation] Phase 57 violation: signAndTrade requires pre-validated contexts. ' +
          'computeSignAndTradeResult must attach _signingValidation and _validatedTradeContext.'
      );
    }

    default:
      {
        const stageResult = validateNonTradeMutationStage({
          mutationType,
          payload,
          currentState,
          computeResult,
          seasonId,
          asOfDate,
          dateDefaulted,
        });

        return {
          valid: stageResult.valid,
          ...(stageResult.error ? { error: stageResult.error } : {}),
          ...(stageResult.violations
            ? { violations: stageResult.violations }
            : {}),
          ...(stageResult.warnings ? { warnings: stageResult.warnings } : {}),
        };
      }
  }
}
