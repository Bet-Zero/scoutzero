/**
 * FILE: src/features/architect/utils/mutationPipeline.ts
 * PURPOSE: Centralized mutation pipeline for all Architect world mutations.
 * OWNERSHIP: Feature: architect/core
 *
 * ARCHITECT OWNERSHIP:
 * - Canonical committed-write authority for general world mutations.
 * - Sibling committed-write authority to seasonManager.ts for point-in-time world mutations.
 * - Public mutation entrypoint: READ -> COMPUTE -> VALIDATE -> PERSIST.
 * - Returns changedTeams as the preferred direct post-commit team snapshot when available.
 * - UI/hooks must route general committed mutation writes here.
 * - Uses shared lower-level persistence hygiene from persistenceContracts/enforcement.ts.
 * - Season advancement remains a separate committed authority in seasonManager.ts.
 *
 * HISTORY:
 *  - 2025-12-17: Created per docs/architect/ARCHITECT_GAP_ANALYSIS.md Phase 1 implementation
 *  - 2025-12-25: Removed legacy teamPlans reference (worlds-only cleanup)
 *  - 2026-01-18: Phase 7.2 option decline FA-year derivation + cap hold amounts
 *  - 2026-01-18: Phase 7.3 option state invariant validation wiring
 *  - 2026-01-30: Phase 58 - Extracted trade context helpers to tradeContext module
 *  - 2026-01-30: Phase 59 - Removed validateTradeForPipeline, moved validateTradeForContext to legacy namespace
 *
 * LINKS:
 *  - Plan: plans/cap-sheet-contract-rules-phase-7-3/plan.md
 *  - Trade Context Module: src/features/architect/utils/tradeContext/
 *  - Latest Chunk: n/a (no chunks used)
 *
 * DESIGN CONSTRAINTS (NON-NEGOTIABLE):
 * 1) All Firestore writes MUST occur in one place (persistWorldMutation)
 * 2) All mutation computation MUST be pure (no Firestore, no React state)
 * 3) UI components and hooks MUST NOT write to Firestore directly
 * 4) World context (worldId) MUST be respected for all reads and writes
 * 5) The pipeline must be movable into Cloud Functions later with minimal rewrite
 * 6) Trade validation follows the staged chain:
 *    buildTradeApplyPreparation → validateTradeExecutionAuthority →
 *    persistWorldMutation (Phase 56/58, TM-3B/TM-5D)
 *
 * MUTATION TYPES SUPPORTED:
 * - executeTrade
 * - signFreeAgent
 * - waivePlayer
 * - extendPlayer
 * - optionDecision
 * - renounceRights
 */

import { db } from '@/firebaseConfig';
import { getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import {
  getTeam,
  getPlayer,
} from '@/features/architect/utils/teamLoader';
import {
  getWorldMetadata,
  updateWorldStats,
} from '@/features/architect/utils/worldManager';
import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import {
  worldTeamRef,
  worldPlayerRef,
  worldMetadataRef,
} from '@/features/architect/utils/architectFirestorePaths';
import { collection, doc } from 'firebase/firestore';
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
} from '@/constants/collections';
import { getCapSettings } from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';
// Cap legality validators for non-trade mutations (Phase 5 Production Hardening)
import { isOverrideEnabled } from '@/features/architect/utils/capLegalityValidation';
import { validateNonTradeMutationStage } from '@/features/architect/utils/nonTradeMutationValidationStage';
import {
  normalizeContractForWorld,
  normalizeFutureContract,
  normalizeFreeAgency,
  normalizeOptionUsed,
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
  normalizeCanonicalTeamExceptions,
  type CanonicalNonTpeExceptionKey,
} from '@/features/architect/utils/exceptions/exceptionOwnership';

// Phase 72: SSOT for team cap totals computation
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';
import {
  synchronizeTeamTotalsSnapshot,
  type ComputedTeamCapTotals,
  type LoadedTeamCapTotals,
} from '@/features/architect/utils/capTotals/computeTeamCapTotals';

// Phase 61: Persistence contract enforcement (allowlist-based)
// Phase 64: Added normalizeTeamTpeSchema for TPE canonicalization
import {
  assertPersistableOrThrow,
  PERSISTENCE_CONTRACTS,
  normalizeTeamTpeSchema,
} from '@/features/architect/utils/persistenceContracts';
import {
  FORBIDDEN_TRANSIENT_KEYS,
  sanitizeTransientFieldsForPersistence,
} from '@/features/architect/utils/persistenceContracts/enforcement';

// Phase 86: League-wide invariant validation (cross-team duplicate player prevention)
// Phase B5: Entitlement invariant validation (cross-team duplicate entitlement prevention)
import {
  validateMutationLeagueInvariants,
  validateMutationEntitlementInvariants,
} from '@/features/architect/utils/leagueInvariants';
import {
  POST_STATE_CAP_VALIDATOR_VERSION,
  validatePostStateCapLegality,
} from '@/features/architect/utils/capLegality/postStateCapValidator';
import { getSigningHardCapTriggerMetadata } from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import type { PostStateCapValidationInput } from '@/features/architect/utils/capLegality/postStateCapValidator';
import type {
  NormalizedTeamPick,
  TradeExceptionRecord,
  TradeValidatorCapProjections,
  TradeValidatorContext,
} from '@/features/architect/utils/tradeMachine/constants/types';
import type {
  ArchitectSource,
  BasePlayerDoc,
  DraftPick,
} from '@/schemas/architect';
import type { PlayerBio, PlayerDraft } from '@/schemas/players_v2';
import type { SignAndTradeContractLike } from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';
import type {
  PostTradeSnapshot as TradeContextPostTradeSnapshot,
  TradeApplyValidationTeam as TradeContextApplyValidationTeam,
  TradeContextCurrentState,
  TradeContextNormalizedPayload,
  TeamResult as TradeContextTeamResult,
  ValidatedTradeContext as TradeContextValidatedTradeContext,
} from '@/features/architect/utils/tradeContext/types';

// ==============================================================================
// PHASE 58: TRADE CONTEXT MODULE RE-EXPORTS
// ==============================================================================
// Phase 58 extracted snapshot/validation context helpers to dedicated module.
// These re-exports maintain backward compatibility for existing imports.
import {
  buildPostTradeTeamsSnapshot,
  validatePostTradeSnapshotForContext,
  assertTradeComputeInputs,
} from '@/features/architect/utils/tradeContext';
// TM-3A/TM-3C: Direct import to avoid circular dependency through barrel.
// tradeExecutionAuthority imports from mutationPipeline, so routing through
// tradeContext/index.ts would create a circular initialization path.
import {
  evaluateTradeSnapshotValidationStage,
  validateTradeExecutionAuthority,
} from '@/features/architect/utils/tradeContext/tradeExecutionAuthority';
import {
  buildSignAndTradeTradeHandoff,
  buildTradeApplyPreparation,
  normalizeTradeContextPayload,
  normalizeTradeTeamCodeLike,
  resolveOutgoingTradeDestinationTeamCode,
} from '@/features/architect/utils/tradeContext/tradeContext';

// Wave 4 Step 4a.5: shared helpers submodule (cross-phase utilities used by both READ and COMPUTE)
export * from './mutationPipeline.helpers';
// Wave 4 Step 4c
export * from './mutationPipeline.read';
// Wave 4 Step 4d
export * from './mutationPipeline.compute';

// Wave 7 Step 1: type definitions extracted to submodule
export * from './mutationPipeline.types';
// Wave 28: extracted constants, helpers, types, computeNormalizedWorldMutation
export * from './mutationPipeline.normalize';
// Wave 47 Step 1: computeWorldMutation and preflight functions extracted to submodule
export * from './mutationPipeline.preflights';

import type {
  ApplyWorldMutationArgs,
  ArchitectGeneralMutationCommittedTeamUpdate,
  ArchitectMutationBridgeResult,
  ArchitectMutationContract,
  ArchitectMutationPayload,
  ArchitectMutationResult,
  ArchitectWorldMutationPatch,
  AuditContextLike,
  ComputeResultLike,
  ComputeWorldMutationArgs,
  MutationAuditContext,
  MutationCurrentState,
  MutationCurrentStateInputByType,
  MutationEventMetadataLike,
  MutationEventSourceResult,
  MutationPayloadInputByType,
  MutationPayloadLike,
  MutationResultIssueLike,
  MutationTeamMap,
  OfferSheetPreflightResult,
  PersistWorldMutationResult,
  PlayerLike,
  PostStateTotalsByTeam,
  PublicComputeWorldMutationArgs,
  PublicMutationPayloadInputByType,
  SignAndTradePreflightResult,
  SignAndTradePreflightStatus,
  SupportedComputeMutationType,
  TeamLike,
} from './mutationPipeline.types';

// Re-export for backward compatibility
export { buildPostTradeTeamsSnapshot, validatePostTradeSnapshotForContext };

// Phase 59: Legacy helpers moved to tradeContext/legacy/ namespace
// Import from '@/features/architect/utils/tradeContext/legacy' for deprecated validateTradeForContext

// Wave 4 Step 4c: explicit value imports from read.ts and helpers.ts
// (export * only re-exports; the orchestrator also needs to USE these locally)
import {
  buildMutationFailureResult,
  sanitizePayloadForOverride,
  generateOperationId,
  loadStateForMutation,
  loadWorldAsOfDate,
  extractTeamsByCodeFromCurrentState,
  buildComputeWritesSummary,
  buildGeneralMutationCommittedTeamUpdates,
  canonicalizeComputeResultTeamUpdates,
  collectMutationPlayerIds,
  buildCapAuditDiffSummary,
  FREE_AGENCY_MUTATION_TYPES,
  CAP_AUDIT_EVENT_SCHEMA_VERSION,
  AUTHORITATIVE_SAT_PREFLIGHT_SOURCE,
  toTradePayload,
  normalizeTradeMutationCurrentState,
  normalizeTeamOnlyMutationCurrentState,
  normalizeTeamAndPlayerMutationCurrentState,
  normalizeOfferSheetTeamAndPlayerMutationCurrentState,
  normalizeOfferSheetMirrorMutationCurrentState,
  normalizeOfferSheetResolutionMutationCurrentState,
  normalizeSignAndTradeMutationCurrentState,
  guardAgainstUndefined,
  getErrorMessage,
  matchesOfferSheetIdentity,
  removeOfferSheetEntries,
  buildNormalizedOfferSheetFinalContract,
  withDefaultPlayerDeletes,
  resolveWorldAsOfDate,
  extractTeamsByCodeFromComputeResult,
  buildTotalsByTeam,
  buildPostStateRulesContext,
  buildWorldMutationEventPayload,
} from './mutationPipeline.read';
import type { MutationExceptionPreserveOnlyBuckets } from './mutationPipeline.read';
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
  getMutationActionType,
} from './mutationPipeline.compute';
import {
  cloneWritesSummary,
  getMutationPlayerId,
  getMutationRosterEntryId,
  getSalaryRowEndYear,
  getTeamSourceRecord,
  materializeCurrentStateBaseTeamPreservedFields,
  normalizeMutationExceptionsFromIngress,
  removeUndefinedDeep,
  requireBasicTeamAndPlayerState,
  requireBasicTeamState,
  requireDestinationState,
  requireOfferSheetTeamState,
  requireSigningState,
  synchronizeTeamTotalsSnapshotOrTeam,
  toMutationExceptionPreserveOnlyBuckets,
  toOptionalNumber,
  toOptionalTrimmedString,
  toPersistablePlayerOverrideFromSnapshot,
  toTradeStateSlice,
  buildCanonicalPlayerPersistenceManifest,
  buildTradePlayerPersistenceManifest,
  findPlayerInTeamPlayers,
} from './mutationPipeline.helpers';
import {
  isSupportedComputeMutationType,
  normalizeComputeWorldMutationArgs,
  computeNormalizedWorldMutation,
  computeTypedWorldMutation,
} from './mutationPipeline.normalize';

export async function applyWorldMutation({
  userId,
  worldId,
  seasonId,
  mutationType,
  payload,
  timestamp = Date.now(),
  operationId: operationIdOverride,
}: ApplyWorldMutationArgs): Promise<ArchitectMutationResult> {
  // Input validation
  if (!userId) {
    return buildMutationFailureResult('userId is required');
  }
  if (!worldId) {
    return buildMutationFailureResult('worldId is required');
  }
  if (!seasonId) {
    return buildMutationFailureResult('seasonId is required');
  }
  if (!mutationType) {
    return buildMutationFailureResult('mutationType is required');
  }
  if (!payload) {
    return buildMutationFailureResult('payload is required');
  }
  if (!isSupportedComputeMutationType(mutationType)) {
    return buildMutationFailureResult(
      `Unknown mutation type: ${String(mutationType)}`
    );
  }

  // SECURITY: Strip override metadata if override is disabled
  // This prevents clients from bypassing validation by sending overrideMetadata
  const sanitizedPayload = sanitizePayloadForOverride(
    payload
  ) as MutationPayloadLike;
  const operationId =
    typeof operationIdOverride === 'string' && operationIdOverride.trim()
      ? operationIdOverride
      : generateOperationId(timestamp);

  try {
    // PHASE 1: READ - Load required current state
    const currentState = await loadStateForMutation(
      worldId,
      mutationType,
      sanitizedPayload
    );
    const beforeTeamsByCode = extractTeamsByCodeFromCurrentState(currentState);

    // Phase 20: Load world metadata asOfDate for SSOT resolution
    const worldAsOfDate = await loadWorldAsOfDate(worldId);

    // Phase 20: Resolve canonical asOfDate SSOT
    const { asOfDate, defaulted: dateDefaulted } = resolveWorldAsOfDate({
      payloadAsOfDate:
        sanitizedPayload.asOfDate != null
          ? String(sanitizedPayload.asOfDate)
          : null,
      worldAsOfDate,
    });

    // PHASE 2: COMPUTE (PURE) - Calculate mutation result
    const computeResult: ComputeResultLike = computeTypedWorldMutation({
      mutationType,
      payload: sanitizedPayload,
      currentState,
      seasonId,
      timestamp,
      asOfDate, // Phase 20: World time SSOT
      worldId,
    });

    if (!computeResult.success) {
      return buildMutationFailureResult(computeResult.error);
    }

    const computeWritesSummary = cloneWritesSummary(
      buildComputeWritesSummary(computeResult)
    );
    const appliedToLocalState =
      computeWritesSummary.teamsPatched > 0 ||
      computeWritesSummary.playersPatched > 0 ||
      computeWritesSummary.entitlementsPatched > 0;

    if (FREE_AGENCY_MUTATION_TYPES.has(mutationType) && !appliedToLocalState) {
      return buildMutationFailureResult(
        `${mutationType} produced no state delta and was fail-closed before persistence.`,
        {
          appliedToLocalState: false,
          persistedToWorld: false,
          writesSummary: computeWritesSummary,
        }
      );
    }

    // PHASE 3: VALIDATE - Ensure mutation is legal
    // TM-3A: Trade mutations use the explicit execution authority surface.
    // Non-trade mutations continue with the existing inline validation chain.
    let afterTeamsByCode: MutationTeamMap;
    let beforeTotalsByTeam: PostStateTotalsByTeam;
    let afterTotalsByTeam: PostStateTotalsByTeam;
    let combinedWarnings: MutationResultIssueLike[];
    let postStateValidation: {
      valid: boolean;
      violations: unknown[];
      warnings: unknown[];
    };

    if (mutationType === 'executeTrade') {
      // TM-3A: Trade Execution Authority — all 5 apply-time legality gates
      // composed in one discoverable surface (tradeContext/tradeExecutionAuthority.ts).
      // TM-5D: The staged trade chain remains intentional and should not be
      // collapsed: prepared context -> execution authority -> persist boundary.
      const tradeExecutionAuthorityResult =
        await validateTradeExecutionAuthority({
          worldId,
          operationId,
          mutationType,
          payload: sanitizedPayload,
          computeResult,
          validatedTradeContext:
            computeResult._validatedTradeContext as TradeContextValidatedTradeContext,
          seasonId,
          asOfDate,
          dateDefaulted,
          timestamp,
          beforeTeamsByCode,
        });

      if (!tradeExecutionAuthorityResult.valid) {
        return buildMutationFailureResult(
          tradeExecutionAuthorityResult.error ||
            'Trade execution authority validation failed',
          {
            appliedToLocalState: false,
            persistedToWorld: false,
            writesSummary: computeWritesSummary,
            violations: tradeExecutionAuthorityResult.violations,
            warnings: tradeExecutionAuthorityResult.warnings,
          }
        );
      }

      // TM-3E: Trade legality is complete above. Everything below this point
      // is persist/audit handoff into persistWorldMutation().
      afterTeamsByCode =
        tradeExecutionAuthorityResult.auditArtifacts.afterTeamsByCode;
      beforeTotalsByTeam =
        tradeExecutionAuthorityResult.auditArtifacts.beforeTotalsByTeam;
      afterTotalsByTeam =
        tradeExecutionAuthorityResult.auditArtifacts.afterTotalsByTeam;
      combinedWarnings = tradeExecutionAuthorityResult.warnings;
      postStateValidation = {
        valid: tradeExecutionAuthorityResult.auditArtifacts.postStateValid,
        violations:
          tradeExecutionAuthorityResult.auditArtifacts.postStateViolations,
        warnings:
          tradeExecutionAuthorityResult.auditArtifacts.postStateWarnings,
      };
    } else {
      // Non-trade orchestration stays here:
      // validation stage -> league invariants -> entitlement invariants ->
      // exclusivity -> post-state cap validator -> persistence.
      // Mutation-specific validation-stage adaptation now lives in
      // validateNonTradeMutationStage().
      const validationResult = validateMutation({
        mutationType,
        payload: sanitizedPayload,
        currentState,
        computeResult,
        seasonId,
        asOfDate,
        dateDefaulted,
      });

      if (!validationResult.valid) {
        return buildMutationFailureResult(
          validationResult.error || 'Validation failed',
          {
            appliedToLocalState: false,
            persistedToWorld: false,
            writesSummary: computeWritesSummary,
            violations: validationResult.violations,
            warnings: (validationResult.warnings ||
              []) as MutationResultIssueLike[],
          }
        );
      }

      // PHASE 3.5: LEAGUE INVARIANTS - Validate no cross-team duplicates
      const leagueInvariantResult = await validateMutationLeagueInvariants(
        worldId,
        mutationType,
        sanitizedPayload,
        computeResult
      );

      if (!leagueInvariantResult.valid) {
        return buildMutationFailureResult(
          leagueInvariantResult.error || 'League invariant violation',
          {
            appliedToLocalState: false,
            persistedToWorld: false,
            writesSummary: computeWritesSummary,
            violations: leagueInvariantResult.duplicates
              ? [
                  {
                    rule: 'LEAGUE_DUPLICATE_PLAYER',
                    details: leagueInvariantResult.duplicates,
                  },
                ]
              : [],
            warnings: [],
          }
        );
      }

      // PHASE 3.6: ENTITLEMENT INVARIANTS - Validate no cross-team duplicate entitlements
      const entitlementInvariantResult =
        await validateMutationEntitlementInvariants(
          worldId,
          mutationType,
          computeResult
        );

      if (!entitlementInvariantResult.valid) {
        return buildMutationFailureResult(
          entitlementInvariantResult.error || 'Entitlement invariant violation',
          {
            appliedToLocalState: false,
            persistedToWorld: false,
            writesSummary: computeWritesSummary,
            violations: entitlementInvariantResult.duplicates
              ? [
                  {
                    rule: 'LEAGUE_DUPLICATE_ENTITLEMENT',
                    details: entitlementInvariantResult.duplicates,
                  },
                ]
              : [],
            warnings: [],
          }
        );
      }

      // PHASE 3.7: PER-TEAM ENTITLEMENT EXCLUSIVITY (TM-EXCL-E3)
      const { validateTradeApplyExclusivity } = await import(
        './leagueInvariants'
      );
      const exclusivityResult = await validateTradeApplyExclusivity(
        worldId,
        mutationType,
        computeResult
      );

      if (!exclusivityResult.valid) {
        return buildMutationFailureResult(
          exclusivityResult.error ||
            'Trade would create exclusivity-violating entitlement set',
          {
            appliedToLocalState: false,
            persistedToWorld: false,
            writesSummary: computeWritesSummary,
            violations: exclusivityResult.teamViolations
              ? exclusivityResult.teamViolations.map((tv) => ({
                  rule: 'ENTITLEMENT_EXCLUSIVITY_VIOLATION',
                  details: tv,
                }))
              : [],
            warnings: [],
          }
        );
      }

      // PHASE 3.8: SHARED POST-STATE FINAL-ARTIFACT GATE
      // This shared validator runs after compute has produced authoritative
      // final artifacts and before persistence begins.
      // The mutation-stage validators above remain required, but they are not
      // substitutes for final-state artifact validation.
      const year = toEndYear(seasonId) ?? new Date(timestamp).getFullYear();
      afterTeamsByCode = extractTeamsByCodeFromComputeResult(computeResult);
      beforeTotalsByTeam = buildTotalsByTeam(beforeTeamsByCode, year);
      afterTotalsByTeam = buildTotalsByTeam(afterTeamsByCode, year);

      if (Object.keys(afterTotalsByTeam).length === 0) {
        return buildMutationFailureResult(
          'Post-state validator requires afterTotalsByTeam for at least one affected team',
          {
            appliedToLocalState: false,
            persistedToWorld: false,
            writesSummary: computeWritesSummary,
            violations: [
              {
                rule: 'POST_STATE_TOTALS_UNAVAILABLE',
                message:
                  'Unable to build afterTotalsByTeam from computeResult.teamUpdates',
                severity: 'error',
              },
            ],
            warnings: (validationResult.warnings ||
              []) as MutationResultIssueLike[],
          }
        );
      }

      const rulesContext = buildPostStateRulesContext(year);
      postStateValidation = validatePostStateCapLegality({
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

      combinedWarnings = [
        ...((validationResult.warnings || []) as MutationResultIssueLike[]),
        ...((postStateValidation.warnings || []) as MutationResultIssueLike[]),
      ];

      if (!postStateValidation.valid) {
        return buildMutationFailureResult('Post-state cap validation failed', {
          appliedToLocalState: false,
          persistedToWorld: false,
          writesSummary: computeWritesSummary,
          violations:
            postStateValidation.violations as MutationResultIssueLike[],
          warnings: combinedWarnings,
        });
      }
    }

    const teamUpdates = computeResult.teamUpdates || [];
    const committedTeamUpdates = buildGeneralMutationCommittedTeamUpdates(
      teamUpdates,
      seasonId
    );
    const playerUpdates = computeResult.playerUpdates || [];
    const teamCodes = committedTeamUpdates
      .map((u) => String(u.teamCode || ''))
      .filter(Boolean);
    const playerIds = collectMutationPlayerIds(sanitizedPayload, computeResult);
    const diffSummary = buildCapAuditDiffSummary({
      beforeTeamsByCode,
      afterTeamsByCode,
    });

    // PHASE 4: PERSIST - Write to Firestore (ONLY place that writes)
    // DEV DEBUG: Check for UID mismatch which causes PERMISSION_DENIED
    if (import.meta.env.DEV) {
      try {
        const worldRef = worldMetadataRef(worldId);
        const { getDoc } = await import('firebase/firestore');
        const worldSnap = await getDoc(worldRef);
        if (worldSnap.exists()) {
          const worldData = worldSnap.data();
          const worldOwner = worldData.createdBy;
          if (worldOwner !== userId) {
            console.error(
              `🚨 UID MISMATCH: World createdBy=${worldOwner} but current userId=${userId}\n` +
                `This causes PERMISSION_DENIED. Fix: In Emulator UI, update createdBy to ${userId}`
            );
          }
        }
      } catch (e) {
        console.warn(
          'DEV DEBUG: Could not check world ownership:',
          getErrorMessage(e)
        );
      }
    }

    const persistResult: PersistWorldMutationResult =
      await persistWorldMutation({
        worldId,
        seasonId,
        mutationType,
        computeResult,
        committedTeamUpdates,
        timestamp,
        payloadAsOfDate:
          sanitizedPayload.asOfDate != null
            ? String(sanitizedPayload.asOfDate)
            : null, // Phase 20: Only persist if explicitly provided
        auditContext: {
          operationId,
          validatorVersion: POST_STATE_CAP_VALIDATOR_VERSION,
          schemaVersion: CAP_AUDIT_EVENT_SCHEMA_VERSION,
          mutationCategory: getMutationActionType(mutationType),
          teamCodes,
          playerIds: playerIds as string[],
          beforeTotalsByTeam,
          afterTotalsByTeam,
          valid: postStateValidation.valid,
          violations: (postStateValidation.violations || []).map((v) =>
            typeof v === 'string' ? v : JSON.stringify(v)
          ),
          warnings: (postStateValidation.warnings || []).map((w) =>
            typeof w === 'string' ? w : JSON.stringify(w)
          ),
          diffSummary,
        },
      });

    if (!persistResult.success) {
      return buildMutationFailureResult(persistResult.error, {
        appliedToLocalState,
        persistedToWorld: false,
        eventWritten: false,
        writesSummary: persistResult.writesSummary || computeWritesSummary,
      });
    }

    const writesSummary = {
      ...cloneWritesSummary(computeWritesSummary),
      ...cloneWritesSummary(persistResult.writesSummary),
      worldStatsUpdated: false,
    };
    const persistedToWorld =
      writesSummary.teamsPatched > 0 &&
      writesSummary.eventsWritten > 0 &&
      writesSummary.worldMetadataPatched > 0;

    if (!persistedToWorld) {
      return buildMutationFailureResult(
        `${mutationType} did not persist canonical world writes. Save blocked.`,
        {
          appliedToLocalState,
          persistedToWorld: false,
          eventWritten: writesSummary.eventsWritten > 0,
          writesSummary,
        }
      );
    }

    // PHASE 5: POST-UPDATE - Update world stats and metadata
    await updateWorldStats(
      worldId,
      getMutationActionType(mutationType),
      teamCodes
    );
    writesSummary.worldStatsUpdated = true;

    // Return success result
    return {
      success: true,
      changedTeams: committedTeamUpdates,
      changedPlayers: playerUpdates,
      worldPatch: persistResult.worldPatch,
      event: persistResult.event,
      appliedToLocalState,
      persistedToWorld: true,
      eventWritten: writesSummary.eventsWritten > 0,
      writesSummary,
      warnings: combinedWarnings,
    };
  } catch (error) {
    console.error(`applyWorldMutation failed for ${mutationType}:`, error);
    return buildMutationFailureResult(getErrorMessage(error));
  }
}

// Wave 7 Step 2: validate function extracted to submodule
export { validateMutation } from './mutationPipeline.validate';
import { validateMutation } from './mutationPipeline.validate';

// Wave 7 Step 3: persist function extracted to submodule
export { persistWorldMutation } from './mutationPipeline.persist';
import { persistWorldMutation } from './mutationPipeline.persist';
