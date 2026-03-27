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
 *
 * AUTHORITY CHAIN (5 stages, short-circuits on first failure):
 *  1. SNAPSHOT_VALIDATION     — evaluatePreparedTradeContext (verifies prepared trade context)
 *  2. LEAGUE_INVARIANTS       — validateMutationLeagueInvariants (no duplicate players)
 *  3. ENTITLEMENT_INVARIANTS  — validateMutationEntitlementInvariants (no duplicate entitlements)
 *  4. ENTITLEMENT_EXCLUSIVITY — validateTradeApplyExclusivity (per-team + league-wide)
 *  5. POST_STATE_CAP_LEGALITY — validatePostStateCapLegality (hard cap, roster limits, etc.)
 *
 * Every trade mutation must pass all 5 stages before persistence is allowed.
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
import { evaluatePreparedTradeContext } from './tradeContext';
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
  // Verifies that the prepared trade context (from buildTradeApplyPreparation /
  // computeWorldMutation) is present and carries the legality determination.
  // =========================================================================
  const validationResult = evaluatePreparedTradeContext({
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
  // Validates post-trade state against cap rules (hard cap, roster limits, etc.).
  // =========================================================================
  const year = toEndYear(seasonId) ?? new Date(timestamp).getFullYear();
  const afterTeamsByCode = extractTeamsByCodeFromComputeResult(computeResult);
  const beforeTotalsByTeam = buildTotalsByTeam(beforeTeamsByCode, year);
  const afterTotalsByTeam = buildTotalsByTeam(afterTeamsByCode, year);

  if (Object.keys(afterTotalsByTeam).length === 0) {
    return buildFailure(
      'POST_STATE_CAP_LEGALITY',
      'Post-state validator requires afterTotalsByTeam for at least one affected team',
      [{
        rule: 'POST_STATE_TOTALS_UNAVAILABLE',
        message: 'Unable to build afterTotalsByTeam from computeResult.teamUpdates',
        severity: 'error',
      } as LooseRecord],
      stage1Warnings,
      {
        afterTeamsByCode,
        beforeTotalsByTeam,
        afterTotalsByTeam,
        postStateValid: false,
        postStateViolations: [],
        postStateWarnings: [],
      },
    );
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

  const combinedWarnings: MutationResultIssueLike[] = [
    ...stage1Warnings,
    ...((postStateValidation.warnings || []) as MutationResultIssueLike[]),
  ];

  const auditArtifacts: TradeExecutionAuditArtifacts = {
    afterTeamsByCode,
    beforeTotalsByTeam,
    afterTotalsByTeam,
    postStateValid: postStateValidation.valid,
    postStateViolations: postStateValidation.violations as MutationResultIssueLike[],
    postStateWarnings: postStateValidation.warnings as MutationResultIssueLike[],
  };

  if (!postStateValidation.valid) {
    return buildFailure(
      'POST_STATE_CAP_LEGALITY',
      'Post-state cap validation failed',
      postStateValidation.violations as MutationResultIssueLike[],
      combinedWarnings,
      auditArtifacts,
    );
  }

  // =========================================================================
  // ALL STAGES PASSED — Trade is authorized for persistence.
  // =========================================================================
  return {
    valid: true,
    violations: [],
    warnings: combinedWarnings,
    auditArtifacts,
  };
}
