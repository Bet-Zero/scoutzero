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
 *  - 2026-03-26: TM-3D - Preview now reuses the same named authority stages,
 *                        explicitly omitting only world-state gates.
 *  - 2026-03-27: TM-3E - Grouped world-state-only gates and narrowed
 *                        canonical-vs-supporting surface discoverability.
 *  - 2026-03-28: TM-5D - Strengthened canonical-vs-supporting boundary
 *                        guidance so safe staging is harder to collapse.
 *
 * AUTHORITY CHAIN (5 stages, short-circuits on first failure):
 *  1. SNAPSHOT_VALIDATION     — evaluateTradeSnapshotValidationStage (adapts prepared trade verdict)
 *  2. LEAGUE_INVARIANTS       — validateMutationLeagueInvariants (no duplicate players)
 *  3. ENTITLEMENT_INVARIANTS  — validateMutationEntitlementInvariants (no duplicate entitlements)
 *  4. ENTITLEMENT_EXCLUSIVITY — validateTradeApplyExclusivity (per-team + league-wide)
 *  5. POST_STATE_CAP_LEGALITY — runTradePostStateLegalityStage (derives inputs, delegates rules)
 *
 * Every trade mutation must pass all 5 stages before persistence is allowed.
 * Preview reuses the same model up to Stage 5, then stops before the 3
 * world-state-only gates that require live world reads.
 *
 * OWNERSHIP:
 * - This module owns sequencing, short-circuit behavior, warning aggregation, and audit artifacts.
 * - This module does NOT own trade rules, post-state cap rules, or world invariants themselves.
 *
 * CANONICAL SURFACES VS SUPPORTING HELPERS:
 * - Canonical execution authority surface: validateTradeExecutionAuthority().
 * - Canonical preview surface lives in tradeContext.ts as getTradePreviewAuthority().
 * - Supporting helpers in this file remain intentionally separate supporting-stage
 *   surfaces. They make stage ownership explicit and should not be promoted into
 *   new peer public authorities, folded into persistence, or used to blur the
 *   preview/apply boundary.
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
import type {
  ValidatedTradeContext,
  ValidationIssue,
} from './types';

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

export const TRADE_WORLD_STATE_ONLY_AUTHORITY_STAGES = [
  'LEAGUE_INVARIANTS',
  'ENTITLEMENT_INVARIANTS',
  'ENTITLEMENT_EXCLUSIVITY',
] as const;

export type TradePreviewExcludedAuthorityStage =
  (typeof TRADE_WORLD_STATE_ONLY_AUTHORITY_STAGES)[number];

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

/** Input for the preview authority validation. */
export interface TradePreviewAuthorityInput {
  seasonId: string;
  validatedTradeContext: ValidatedTradeContext;
  beforeTeamsByCode: MutationTeamMap;
  afterTeamsByCode: MutationTeamMap;
  worldId?: string | null;
  operationId?: string;
  mutationType?: string;
  asOfDate?: string | null;
  dateDefaulted?: boolean;
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

/** Result of the preview authority validation. */
export interface TradePreviewAuthorityResult {
  valid: boolean;
  failedStage?: Extract<
    TradeExecutionAuthorityStage,
    'SNAPSHOT_VALIDATION' | 'POST_STATE_CAP_LEGALITY'
  >;
  error?: string;
  reason: string;
  violations: ValidationIssue[];
  warnings: ValidationIssue[];
  omittedStages: TradePreviewExcludedAuthorityStage[];
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

export interface TradePostStateLegalityStageInput {
  operationId: string;
  mutationType: string;
  worldId: string;
  year: number;
  asOfDate?: string | null;
  beforeTeamsByCode: MutationTeamMap;
  afterTeamsByCode: MutationTeamMap;
}

export interface TradePostStateLegalityStageResult {
  valid: boolean;
  error?: string;
  violations: MutationResultIssueLike[];
  warnings: MutationResultIssueLike[];
  auditArtifacts: TradeExecutionAuditArtifacts;
}

interface TradePostStateLegalityFromComputeResultInput {
  operationId: string;
  mutationType: string;
  worldId: string;
  seasonId: string;
  asOfDate?: string | null;
  timestamp: number;
  beforeTeamsByCode: MutationTeamMap;
  computeResult: ComputeResultLike;
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

function normalizeValidationIssue(
  issue: unknown,
  {
    fallbackRule,
    fallbackCode,
    severity,
    codePrefix = '',
  }: {
    fallbackRule: string;
    fallbackCode: string;
    severity: 'error' | 'warning';
    codePrefix?: string;
  }
): ValidationIssue {
  const record =
    issue && typeof issue === 'object' && !Array.isArray(issue)
      ? (issue as LooseRecord)
      : null;
  const message = (() => {
    if (typeof record?.message === 'string' && record.message.trim()) {
      return record.message;
    }
    if (typeof issue === 'string' && issue.trim()) {
      return issue;
    }
    try {
      return JSON.stringify(issue);
    } catch {
      return String(issue);
    }
  })();
  const rawCode =
    typeof record?.code === 'string' && record.code.trim()
      ? record.code
      : fallbackCode;
  const code = rawCode.startsWith(codePrefix)
    ? rawCode
    : `${codePrefix}${rawCode}`;

  return {
    message,
    code,
    rule:
      (typeof record?.rule === 'string' && record.rule.trim()
        ? record.rule
        : fallbackRule) as ValidationIssue['rule'],
    severity:
      (record?.severity === 'warning' || record?.severity === 'error'
        ? record.severity
        : severity) as ValidationIssue['severity'],
  };
}

function normalizeValidationIssues(
  issues: unknown[],
  config: Parameters<typeof normalizeValidationIssue>[1]
): ValidationIssue[] {
  return issues.map((issue) => normalizeValidationIssue(issue, config));
}

/**
 * Supporting Stage 1 adapter shared by preview and execution authority.
 * Canonical callers should use getTradePreviewAuthority() or
 * validateTradeExecutionAuthority(), not this stage helper directly.
 *
 * This is a supporting-stage surface, not a new canonical public authority.
 */
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

/**
 * Supporting Stage 5 delegator shared by preview and execution authority.
 * Canonical callers should use getTradePreviewAuthority() or
 * validateTradeExecutionAuthority(), not this stage helper directly.
 *
 * This is a supporting-stage surface, not a new canonical public authority.
 * It only adapts trade outputs into the shared post-state layer;
 * validatePostStateCapLegality() remains the rule owner.
 *
 * That shared post-state layer is also used by non-trade apply paths, season
 * advance, and cap-audit event generation. This helper must not make the
 * post-state validator trade-specific.
 */
export function runTradePostStateLegalityStage({
  operationId,
  mutationType,
  worldId,
  year,
  asOfDate,
  beforeTeamsByCode,
  afterTeamsByCode,
}: TradePostStateLegalityStageInput): TradePostStateLegalityStageResult {
  const beforeTotalsByTeam = buildTotalsByTeam(
    beforeTeamsByCode,
    year,
    asOfDate ?? null
  );
  const afterTotalsByTeam = buildTotalsByTeam(
    afterTeamsByCode,
    year,
    asOfDate ?? null
  );

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

function runTradePostStateLegalityStageFromComputeResult({
  operationId,
  mutationType,
  worldId,
  seasonId,
  asOfDate,
  timestamp,
  beforeTeamsByCode,
  computeResult,
}: TradePostStateLegalityFromComputeResultInput): TradePostStateLegalityStageResult {
  const year = toEndYear(seasonId) ?? new Date(timestamp).getFullYear();
  const afterTeamsByCode = extractTeamsByCodeFromComputeResult(
    computeResult,
    worldId
  );

  return runTradePostStateLegalityStage({
    operationId,
    mutationType,
    worldId,
    year,
    asOfDate,
    beforeTeamsByCode,
    afterTeamsByCode,
  });
}

/**
 * Supporting preview-stage surface reused by the canonical preview entrypoint.
 * The discoverable preview authority surface is getTradePreviewAuthority().
 *
 * This is a supporting-stage surface, not a new canonical public preview
 * authority.
 */
export function validateTradePreviewAuthority({
  seasonId,
  validatedTradeContext,
  beforeTeamsByCode,
  afterTeamsByCode,
  worldId = 'preview-world',
  operationId = 'trade-preview-authority',
  mutationType = 'executeTrade',
  asOfDate,
  dateDefaulted,
}: TradePreviewAuthorityInput): TradePreviewAuthorityResult {
  const snapshotStage = evaluateTradeSnapshotValidationStage({
    validatedTradeContext,
    asOfDate,
    dateDefaulted,
  });
  const snapshotViolations = Array.isArray(validatedTradeContext.violations)
    ? validatedTradeContext.violations
    : [];
  const snapshotWarnings = Array.isArray(validatedTradeContext.warnings)
    ? validatedTradeContext.warnings
    : [];
  const stageWarnings = normalizeValidationIssues(
    buildTradeSnapshotValidationStageWarnings({ asOfDate, dateDefaulted }),
    {
      fallbackRule: 'trade-snapshot-stage',
      fallbackCode: 'SNAPSHOT_STAGE_WARNING',
      severity: 'warning',
    }
  );
  const omittedStages = [...TRADE_WORLD_STATE_ONLY_AUTHORITY_STAGES];

  if (!snapshotStage.valid) {
    return {
      valid: false,
      failedStage: 'SNAPSHOT_VALIDATION',
      error: snapshotStage.error || 'Validation failed',
      reason:
        validatedTradeContext.reason ||
        snapshotStage.error ||
        'Trade is not legal',
      violations: snapshotViolations,
      warnings: [...snapshotWarnings, ...stageWarnings],
      omittedStages,
    };
  }

  const year = toEndYear(seasonId) ?? new Date().getFullYear();
  const postStateStage = runTradePostStateLegalityStage({
    operationId,
    mutationType,
    worldId: worldId ?? 'preview-world',
    year,
    asOfDate,
    beforeTeamsByCode,
    afterTeamsByCode,
  });
  const postStateViolations = normalizeValidationIssues(
    postStateStage.violations,
    {
      fallbackRule: 'post-state-cap',
      fallbackCode: 'POST_STATE_CAP_ERROR',
      severity: 'error',
      codePrefix: 'POST_STATE_',
    }
  ).map((issue) => ({
    ...issue,
    rule: 'post-state-cap' as const,
  }));
  const postStateWarnings = normalizeValidationIssues(postStateStage.warnings, {
    fallbackRule: 'post-state-cap',
    fallbackCode: 'POST_STATE_CAP_WARNING',
    severity: 'warning',
    codePrefix: 'POST_STATE_',
  }).map((issue) => ({
    ...issue,
    rule: 'post-state-cap' as const,
  }));
  const combinedWarnings = [
    ...snapshotWarnings,
    ...stageWarnings,
    ...postStateWarnings,
  ];

  if (!postStateStage.valid) {
    return {
      valid: false,
      failedStage: 'POST_STATE_CAP_LEGALITY',
      error: postStateStage.error || 'Post-state cap validation failed',
      reason:
        postStateViolations[0]?.message ||
        validatedTradeContext.reason ||
        postStateStage.error ||
        'Post-state cap validation failed',
      violations: [...snapshotViolations, ...postStateViolations],
      warnings: combinedWarnings,
      omittedStages,
    };
  }

  return {
    valid: true,
    reason: validatedTradeContext.reason ?? '',
    violations: snapshotViolations,
    warnings: combinedWarnings,
    omittedStages,
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

/**
 * Apply-only gates that require live world reads and therefore remain outside
 * preview authority.
 *
 * This is a supporting apply-only gate group behind
 * validateTradeExecutionAuthority(), not a standalone replacement authority
 * surface.
 */
async function validateTradeWorldStateAuthorityGates({
  worldId,
  mutationType,
  payload,
  computeResult,
}: Pick<
  TradeExecutionAuthorityInput,
  'worldId' | 'mutationType' | 'payload' | 'computeResult'
>): Promise<TradeExecutionAuthorityResult | null> {
  // STAGE 2: LEAGUE_INVARIANTS
  // Prevents players from appearing on multiple teams after the trade.
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

  // STAGE 3: ENTITLEMENT_INVARIANTS
  // Prevents entitlements from appearing on multiple teams after the trade.
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

  // STAGE 4: ENTITLEMENT_EXCLUSIVITY
  // Validates per-team and league-wide entitlement exclusivity constraints.
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

  return null;
}

// ---------------------------------------------------------------------------
// Main authority function
// ---------------------------------------------------------------------------

/**
 * Validate all apply-time legality gates for a trade mutation.
 *
 * This is the single authoritative surface for trade execution legality.
 * It is the last legality surface before persistence begins.
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

  const worldStateAuthorityFailure = await validateTradeWorldStateAuthorityGates({
    worldId,
    mutationType,
    payload,
    computeResult,
  });

  if (worldStateAuthorityFailure) {
    return worldStateAuthorityFailure;
  }

  // =========================================================================
  // STAGE 5: POST_STATE_CAP_LEGALITY
  // Derives trade-specific inputs into the shared late post-state layer, then
  // delegates rule ownership to validatePostStateCapLegality().
  // This stage stays after compute/final snapshot derivation and before
  // persistence; non-trade apply paths and season advance use the same shared
  // validator for final artifact verification.
  // =========================================================================
  const postStateStage = runTradePostStateLegalityStageFromComputeResult({
    operationId,
    mutationType,
    worldId,
    seasonId,
    asOfDate,
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
