/**
 * FILE: src/features/architect/utils/tradeContext/tradeExecutionAuthority.ts
 * PURPOSE: Explicit execution authority surface for trade apply-time legality (TM-3A).
 *          Composes all validation stages that gate trade persistence into one
 *          discoverable, clearly named function.
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * HISTORY:
 *  - 2026-03-26: TM-3A - Created. Extracted from applyWorldMutation inline stages.
 *  - 2026-03-26: TM-3B - Stage 1 now consumes explicit prepared trade context.
 *  - 2026-03-26: TM-3C - Stage ownership made explicit: authority composes, validators own rules.
 *
 * AUTHORITY CHAIN (5 stages, short-circuits on first failure):
 *  1. SNAPSHOT_VALIDATION     — evaluateTradeSnapshotValidationStage (adapts prepared trade verdict)
 *  2. LEAGUE_INVARIANTS       — validateMutationLeagueInvariants (no duplicate players)
 *  3. ENTITLEMENT_INVARIANTS  — validateMutationEntitlementInvariants (no duplicate entitlements)
 *  4. ENTITLEMENT_EXCLUSIVITY — validateTradeApplyExclusivity (per-team + league-wide)
 *  5. POST_STATE_CAP_LEGALITY — runTradePostStateLegalityStage (derives inputs, delegates rules)
 *
 * Every trade mutation must pass all 5 stages before persistence is allowed.
 *
 * OWNERSHIP:
 * - This module owns sequencing, short-circuit behavior, warning aggregation, and audit artifacts.
 * - This module does NOT own trade rules, post-state cap rules, or world invariants themselves.
 */

import { toEndYear } from '@/features/architect/utils/seasonFormat';
import {
  extractTeamsByCodeFromComputeResult,
  buildTotalsByTeam,
  buildPostStateRulesContext,
  type MutationPayloadLike,
  type ComputeResultLike,
  type MutationTeamMap,
  type MutationResultIssueLike,
  type PostStateTotalsByTeam,
} from '@/features/architect/utils/mutationPipeline';
import {
  validateMutationLeagueInvariants,
  validateMutationEntitlementInvariants,
  validateTradeApplyExclusivity,
} from '@/features/architect/utils/leagueInvariants';
import { validatePostStateCapLegality } from '@/features/architect/utils/capLegality/postStateCapValidator';
import { assertValidatedTradeContext } from './assertions';
import type { ValidatedTradeContext } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LooseRecord = Record<string, unknown>;

/** Identifies which validation stage failed. */
export type TradeExecutionAuthorityStage =
  | 'SNAPSHOT_VALIDATION'
  | 'LEAGUE_INVARIANTS'
  | 'ENTITLEMENT_INVARIANTS'
  | 'ENTITLEMENT_EXCLUSIVITY'
  | 'POST_STATE_CAP_LEGALITY';

/** Computed artifacts the persist phase needs for audit context. */
export interface TradeExecutionAuditArtifacts {
  afterTeamsByCode: MutationTeamMap;
  beforeTotalsByTeam: PostStateTotalsByTeam;
  afterTotalsByTeam: PostStateTotalsByTeam;
  postStateValid: boolean;
  postStateViolations: MutationResultIssueLike[];
  postStateWarnings: MutationResultIssueLike[];
}

/** Result of the full trade execution authority validation. */
export interface TradeExecutionAuthorityResult {
  valid: boolean;
  /** Which stage failed (only present on failure). */
  failedStage?: TradeExecutionAuthorityStage;
  /** Error message suitable for failure result construction. */
  error?: string;
  /** Violations from the failing stage. */
  violations: MutationResultIssueLike[];
  /** Combined warnings from all stages that ran (stage 1 + stage 5). */
  warnings: MutationResultIssueLike[];
  /** Artifacts needed by the persist phase's audit context. */
  auditArtifacts: TradeExecutionAuditArtifacts;
}

/** Input for the trade execution authority validation. */
export interface TradeExecutionAuthorityInput {
  worldId: string;
  operationId: string;
  mutationType: string;
  payload: MutationPayloadLike;
  computeResult: ComputeResultLike;
  validatedTradeContext: ValidatedTradeContext;
  seasonId: string;
  asOfDate?: string | null;
  dateDefaulted?: boolean;
  timestamp: number;
  beforeTeamsByCode: MutationTeamMap;
}

/** Input for the stage-1 snapshot validation adapter. */
export interface TradeSnapshotValidationStageInput {
  validatedTradeContext: ValidatedTradeContext;
  asOfDate?: string | null;
  dateDefaulted?: boolean;
}

/** Result for the stage-1 snapshot validation adapter. */
export interface TradeSnapshotValidationStageResult {
  valid: boolean;
  error?: string;
  violations: string[];
  warnings: unknown[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_AUDIT_ARTIFACTS: TradeExecutionAuditArtifacts = {
  afterTeamsByCode: {},
  beforeTotalsByTeam: {},
  afterTotalsByTeam: {},
  postStateValid: false,
  postStateViolations: [],
  postStateWarnings: [],
};

interface TradePostStateLegalityStageInput {
  operationId: string;
  mutationType: string;
  worldId: string;
  seasonId: string;
  timestamp: number;
  beforeTeamsByCode: MutationTeamMap;
  computeResult: ComputeResultLike;
}

interface TradePostStateLegalityStageResult {
  valid: boolean;
  error?: string;
  violations: MutationResultIssueLike[];
  warnings: MutationResultIssueLike[];
  auditArtifacts: TradeExecutionAuditArtifacts;
}

function buildTradeSnapshotValidationStageWarnings({
  asOfDate,
  dateDefaulted,
}: Pick<TradeSnapshotValidationStageInput, 'asOfDate' | 'dateDefaulted'>): unknown[] {
  if (!dateDefaulted) {
    return [];
  }

  return [
    {
      rule: 'world_time_defaulted',
      message: `World time was defaulted to ${asOfDate}. For accurate timing-based validation, provide asOfDate in payload or world metadata.`,
      severity: 'warning',
      asOfDateUsed: asOfDate,
    },
  ];
}

export function evaluateTradeSnapshotValidationStage({
  validatedTradeContext,
  asOfDate,
  dateDefaulted,
}: TradeSnapshotValidationStageInput): TradeSnapshotValidationStageResult {
  assertValidatedTradeContext(
    validatedTradeContext,
    'evaluateTradeSnapshotValidationStage'
  );

  const stageWarnings = buildTradeSnapshotValidationStageWarnings({
    asOfDate,
    dateDefaulted,
  });

  return {
    valid: validatedTradeContext.legal,
    error: validatedTradeContext.error || undefined,
    violations: (validatedTradeContext.violations || []).map((violation) =>
      typeof violation === 'string' ? violation : JSON.stringify(violation)
    ),
    warnings: [
      ...(validatedTradeContext.warnings || []),
      ...stageWarnings,
    ],
  };
}

function runTradePostStateLegalityStage({
  operationId,
  mutationType,
  worldId,
  seasonId,
  timestamp,
  beforeTeamsByCode,
  computeResult,
}: TradePostStateLegalityStageInput): TradePostStateLegalityStageResult {
  const year = toEndYear(seasonId) ?? new Date(timestamp).getFullYear();
  const afterTeamsByCode = extractTeamsByCodeFromComputeResult(computeResult);
  const beforeTotalsByTeam = buildTotalsByTeam(beforeTeamsByCode, year);
  const afterTotalsByTeam = buildTotalsByTeam(afterTeamsByCode, year);

  if (Object.keys(afterTotalsByTeam).length === 0) {
    return {
      valid: false,
      error: 'Post-state validator requires afterTotalsByTeam for at least one affected team',
      violations: [
        {
          rule: 'POST_STATE_TOTALS_UNAVAILABLE',
          message: 'Unable to build afterTotalsByTeam from computeResult.teamUpdates',
          severity: 'error',
        } as LooseRecord,
      ],
      warnings: [],
      auditArtifacts: {
        afterTeamsByCode,
        beforeTotalsByTeam,
        afterTotalsByTeam,
        postStateValid: false,
        postStateViolations: [],
        postStateWarnings: [],
      },
    };
  }

  const rulesContext = buildPostStateRulesContext(year);
  const postStateValidation = validatePostStateCapLegality({
    operationId,
    mutationType,
    worldId,
    year,
    beforeTeamsByCode,
    afterTeamsByCode,
    beforeTotalsByTeam,
    afterTotalsByTeam,
    rulesContext,
  });

  return {
    valid: postStateValidation.valid,
    error: postStateValidation.valid
      ? undefined
      : 'Post-state cap validation failed',
    violations: postStateValidation.violations as MutationResultIssueLike[],
    warnings: postStateValidation.warnings as MutationResultIssueLike[],
    auditArtifacts: {
      afterTeamsByCode,
      beforeTotalsByTeam,
      afterTotalsByTeam,
      postStateValid: postStateValidation.valid,
      postStateViolations: postStateValidation.violations as MutationResultIssueLike[],
      postStateWarnings: postStateValidation.warnings as MutationResultIssueLike[],
    },
  };
}

function buildFailure(
  failedStage: TradeExecutionAuthorityStage,
  error: string,
  violations: MutationResultIssueLike[],
  warnings: MutationResultIssueLike[],
  auditArtifacts: TradeExecutionAuditArtifacts = EMPTY_AUDIT_ARTIFACTS,
): TradeExecutionAuthorityResult {
  return { valid: false, failedStage, error, violations, warnings, auditArtifacts };
}

// ---------------------------------------------------------------------------
// Main authority function
// ---------------------------------------------------------------------------

/**
 * Validate all apply-time legality gates for a trade mutation.
 *
 * This is the single authoritative surface for trade execution legality.
 * All 5 validation stages must pass before persistence is allowed.
 * Stages run sequentially and short-circuit on first failure, matching
 * the behavior of the original inline chain in applyWorldMutation.
 */
export async function validateTradeExecutionAuthority(
  input: TradeExecutionAuthorityInput,
): Promise<TradeExecutionAuthorityResult> {
  const {
    worldId,
    operationId,
    mutationType,
    payload,
    computeResult,
    validatedTradeContext,
    seasonId,
    asOfDate,
    dateDefaulted,
    timestamp,
    beforeTeamsByCode,
  } = input;

  // =========================================================================
  // STAGE 1: SNAPSHOT_VALIDATION
  // Adapts the prepared trade context (from buildTradeApplyPreparation /
  // computeWorldMutation) into the authority-stage contract.
  // =========================================================================
  const validationResult = evaluateTradeSnapshotValidationStage({
    validatedTradeContext,
    asOfDate,
    dateDefaulted,
  });

  if (!validationResult.valid) {
    return buildFailure(
      'SNAPSHOT_VALIDATION',
      validationResult.error || 'Validation failed',
      (validationResult.violations || []) as MutationResultIssueLike[],
      (validationResult.warnings || []) as MutationResultIssueLike[],
    );
  }

  const stage1Warnings = (validationResult.warnings || []) as MutationResultIssueLike[];

  // =========================================================================
  // STAGE 2: LEAGUE_INVARIANTS
  // Prevents players from appearing on multiple teams after the trade.
  // =========================================================================
  const leagueInvariantResult = await validateMutationLeagueInvariants(
    worldId,
    mutationType,
    payload,
    computeResult,
  );

  if (!leagueInvariantResult.valid) {
    return buildFailure(
      'LEAGUE_INVARIANTS',
      leagueInvariantResult.error || 'League invariant violation',
      leagueInvariantResult.duplicates
        ? [{ rule: 'LEAGUE_DUPLICATE_PLAYER', details: leagueInvariantResult.duplicates } as LooseRecord]
        : [],
      [],
    );
  }

  // =========================================================================
  // STAGE 3: ENTITLEMENT_INVARIANTS
  // Prevents entitlements from appearing on multiple teams after the trade.
  // =========================================================================
  const entitlementInvariantResult = await validateMutationEntitlementInvariants(
    worldId,
    mutationType,
    computeResult,
  );

  if (!entitlementInvariantResult.valid) {
    return buildFailure(
      'ENTITLEMENT_INVARIANTS',
      entitlementInvariantResult.error || 'Entitlement invariant violation',
      entitlementInvariantResult.duplicates
        ? [{ rule: 'LEAGUE_DUPLICATE_ENTITLEMENT', details: entitlementInvariantResult.duplicates } as LooseRecord]
        : [],
      [],
    );
  }

  // =========================================================================
  // STAGE 4: ENTITLEMENT_EXCLUSIVITY
  // Validates per-team and league-wide entitlement exclusivity constraints.
  // =========================================================================
  const exclusivityResult = await validateTradeApplyExclusivity(
    worldId,
    mutationType,
    computeResult,
  );

  if (!exclusivityResult.valid) {
    return buildFailure(
      'ENTITLEMENT_EXCLUSIVITY',
      exclusivityResult.error || 'Trade would create exclusivity-violating entitlement set',
      exclusivityResult.teamViolations
        ? exclusivityResult.teamViolations.map((tv) => ({
            rule: 'ENTITLEMENT_EXCLUSIVITY_VIOLATION',
            details: tv,
          } as LooseRecord))
        : [],
      [],
    );
  }

  // =========================================================================
  // STAGE 5: POST_STATE_CAP_LEGALITY
  // Derives post-state inputs, then delegates rule ownership to
  // validatePostStateCapLegality().
  // =========================================================================
  const postStateStage = runTradePostStateLegalityStage({
    operationId,
    mutationType,
    worldId,
    seasonId,
    timestamp,
    beforeTeamsByCode,
    computeResult,
  });

  const combinedWarnings: MutationResultIssueLike[] = [
    ...stage1Warnings,
    ...postStateStage.warnings,
  ];

  if (!postStateStage.valid) {
    return buildFailure(
      'POST_STATE_CAP_LEGALITY',
      postStateStage.error || 'Post-state cap validation failed',
      postStateStage.violations,
      combinedWarnings,
      postStateStage.auditArtifacts,
    );
  }

  // =========================================================================
  // ALL STAGES PASSED — Trade is authorized for persistence.
  // =========================================================================
  return {
    valid: true,
    violations: [],
    warnings: combinedWarnings,
    auditArtifacts: postStateStage.auditArtifacts,
  };
}
