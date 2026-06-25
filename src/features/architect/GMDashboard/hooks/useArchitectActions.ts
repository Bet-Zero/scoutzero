/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectActions.ts
 * PURPOSE: Centralized action handlers for GMDashboard - manages all user interactions and mutations.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * ARCHITECT OWNERSHIP:
 * - Dashboard action orchestration adapter.
 * - Owns only non-authoritative local-validated apply, optimistic local
 *   preview, and DEV synthetic fixture seams inside the dashboard.
 * - Routes committed mutation writes through mutationPipeline.ts.
 * - Decides changedTeams reuse vs committed-snapshot reload fallback after commit.
 * - Uses dashboard-facing reload adapters after commits so UI state stays aligned.
 * - Does not replace mutationPipeline.ts or seasonManager.ts as committed authorities.
 *
 * HISTORY:
 *  - 2025-12-12: Created - extracted all handlers from GMDashboard.tsx (Phase 3 refactor)
 *  - 2025-12-12: Converted to TypeScript with proper type annotations
 *  - 2025-12-14: Option B refactor - removed capSheetState dependency, all mutations now update teamCapSheet directly
 *  - 2026-01-18: Phase 7.2 option decline FA-year derivation + cap hold multipliers
 *
 * LINKS:
 *  - Plan: plans/cap-sheet-contract-rules-phase-7-2/plan.md
 */
import { useCallback, useMemo } from 'react';
import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import {
  applyWorldMutation,
  buildGeneralMutationDashboardReloadTeamSnapshot,
  computeWorldMutation,
  findCommittedTeamSnapshot,
  findUpdatedTeamSnapshot,
  preflightSignAndTradeMutation,
  preflightOfferSheetMutation,
  type ArchitectGeneralMutationDashboardReloadTeamSnapshot,
  type ArchitectGeneralMutationCommittedTeamUpdate,
  type ArchitectMutationContract,
  type ArchitectMutationDeadCapEntry,
  type ArchitectMutationExceptionEntry,
  type ArchitectMutationExceptions,
  type ArchitectMutationPayload,
  type ArchitectMutationResult,
  type SignAndTradePreflightResult,
  type OfferSheetPreflightResult,
  type NormalizedMutationSalaryRow,
} from '@/features/architect/utils/mutationPipeline';
import type { ManualExceptionsSavePayload } from '@/features/architect/capSheet/CapSheet/CapSheet';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';
import { synchronizeTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import {
  loadWorldTeamData,
  resolveTeamCode,
} from '@/features/architect/utils/worldTeamData';
import {
  POST_STATE_CAP_VALIDATOR_VERSION,
  validatePostStateCapLegality,
} from '@/features/architect/utils/capLegality/postStateCapValidator';
import {
  buildAuthoritativeLinkEstablishedAuditPatch,
  buildPersistFailedRolledBackAuditPatch,
  BASE_LOCAL_VALIDATED_CAP_AUDIT_STREAM,
  type LocalCapAuditLifecycleState,
  WORLD_OPTIMISTIC_PREVIEW_CAP_AUDIT_STREAM,
  appendLocalCapAuditEvent,
  withLocalCapAuditLifecycleState,
  updateLocalCapAuditEvent,
  type CapAuditEventV1Like,
} from '@/features/architect/utils/capLegality/localCapAuditLog';
import {
  computeExpectedCapHoldAmount,
  deriveFreeAgencyYearFromOptionSeason,
  getRightsTypeFromPlayer,
} from '@/features/architect/utils/capHoldTransitionHelpers';
import { validateSigning } from '@/features/architect/utils/capLegalityValidation';
import {
  type SignAndTradeContractLike,
  type SignAndTradeSalaryRow,
  validateSignAndTradeContractPayload,
} from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';
import type {
  BasePlayerContract,
  BasePlayerDoc,
  DeadCapItem,
  Exceptions,
  PlayerRulesProfileInput,
} from '@/features/architect/types';
import {
  acquireOptimisticLock,
  releaseOptimisticLock,
} from './optimisticMutationLock';
import {
  clearCapSheetFixtures,
  DEV_CAP_SHEET_FIXTURE_BOUNDARY,
  DEV_CAP_SHEET_FIXTURE_LOCAL_STATE_OWNER,
  DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY,
  hasInjectedCapSheetFixtures as hasInjectedCapSheetFixturesInTeam,
  injectCapSheetFixtures,
} from '@/features/architect/capSheet/devCapSheetFixtures';
import {
  clearTeamHistoryFixtures,
  hasInjectedTeamHistoryFixtures as hasInjectedTeamHistoryFixturesInTeam,
  injectTeamHistoryFixtures,
} from '@/features/architect/history/devTeamHistoryFixtures';
import type { CapHold as SharedCapHold } from '@/features/architect/utils/capHolds';
import type { CapSheetModalActionType } from '@/features/architect/capSheet/CapSheetFull/CapSheetFull';
import toast from 'react-hot-toast';
import type {
  ArchitectDashboardCapSheet,
  ArchitectDashboardPlayer,
  ReloadActiveWorldMetadataPatch,
  UseArchitectStateReturn,
} from './useArchitectState';


// Wave 6 Step 1: type definitions extracted to submodule
export * from './useArchitectActions.types';
import type { ActionContext } from './useArchitectModals';
import type {
  ArchitectPlayer,
  CapHold,
  DashboardCommittedTeamSnapshot,
  CapHoldActionItem,
  CapSheet,
  CapSheetDevTools,
  ComputeMutationResult,
  DeadCapEntry,
  ExecuteTradeCurrentState,
  FreeAgencyActionOwner,
  FreeAgencyDualPathSigningOwner,
  FreeAgencyOfferSheetLifecycleActionOwner,
  FreeAgencyOfferSheetSectionAvailability,
  FreeAgencyWorldOnlyActionOwner,
  FreeAgencyWorldOnlyModalActionOwner,
  FreeAgentModalAvailability,
  LocalContract,
  LocalContractLegacySalaryInput,
  ManualCapSheetLedgerMutationParams,
  MutationActionResult,
  MutationTruthResult,
  OfferSheet,
  OfferSheetCommittedIdentity,
  OfferSheetCommittedState,
  OfferSheetCommittedStateResolution,
  OfferSheetFinalizeMutationRoute,
  OfferSheetLifecycleCommittedIdentity,
  OfferSheetLifecycleCommittedIdentityInput,
  OfferSheetLifecycleCommittedState,
  OfferSheetLifecycleCommittedStateExpectation,
  OfferSheetLifecycleCommittedStateResolution,
  OfferSheetLifecycleExecutionResult,
  OfferSheetLifecycleMutationType,
  OfferSheetMutationMetadata,
  OfferSheetResolutionAction,
  OfferSheetResolutionMutationType,
  OfferSheetStoreExecutionResult,
  OverrideAuditEntry,
  OverrideMetadata,
  PersistMutationResult,
  SalaryByYear,
  SigningDetails,
  TeamHistoryDevTools,
  TradeDataItem,
  TradeExecutionHandoff,
  TradeExecutionPayload,
  TradeMutationPayloadTeam,
  UseArchitectActionsParams,
  UseArchitectActionsReturn,
  WaiveOptions,
} from './useArchitectActions.types';
import {
  mergeManualExceptionSnapshot,
  normalizeManualExceptionsForMutation,
  normalizeOptionalMutationString,
  OFFER_SHEET_LIFECYCLE_RELOAD_FAILURE_MESSAGE,
  OFFER_SHEET_LIFECYCLE_VERIFICATION_FAILURE_MESSAGE,
  toFreeAgentComputeState,
  toSignAndTradeValidationContract,
  toSigningValidationPlayer,
  toSigningValidationTeam,
} from './useArchitectActions.types';

// Wave 6 Step 2: helper functions extracted to submodule
export * from './useArchitectActions.helpers';
// Wave 6 Step 3: trade + sign + sign-and-trade sub-hook
export * from './useArchitectActions.tradeActions';
import { useTradeActions } from './useArchitectActions.tradeActions';
// Wave 6 Step 4: RFA offer sheet sub-hook
export * from './useArchitectActions.offerSheetActions';
import { useOfferSheetActions } from './useArchitectActions.offerSheetActions';
// Wave 6 Step 5: contract + cap + DEV fixture handlers sub-hook
export * from './useArchitectActions.contractActions';
import { useContractActions } from './useArchitectActions.contractActions';
import type {
  AuthoritativeSigningPreparationOverrides,
  CommittedWorldReloadPlan,
  CommittedWorldReloadResult,
  CommittedWorldReloadSeed,
  DashboardMutationPropagationMode,
  FreeAgencyWorldOnlyActionKind,
  FreeAgencyWorldOnlyActionPhase,
  FreeAgencyWorldOnlyRequirementTable,
  LocalValidatedTeamPropagation,
  OfferSheetCreationDefinitionFailure,
  OfferSheetMutationPayload,
  PreparedAuthoritativeSigningDetails,
  PreparedOfferSheetCreationDefinition,
  PreparedSignAndTradeTransactionDefinition,
  PreparedStandardSigningDetails,
  RenounceActionTarget,
  ResolvedCommittedWorldTeam,
  SignAndTradeExecutionResult,
  SignAndTradeMutationPayload,
  StandardSigningExecutionResult,
  StandardSigningExecutionRoute,
  StandardSigningMutationPayload,
  StandardSigningResolvedState,
  TeamsByCode,
  WorldCommittedStandardSigningPropagation,
  WorldCommittedTeamPropagation,
  WorldCommittedTeamSource,
} from './useArchitectActions.helpers';

// Wave 12 Step 3: offer-sheet verification + execution sub-hook
export * from './useArchitectActions.offerSheetExecutors';
import { useOfferSheetExecutors } from './useArchitectActions.offerSheetExecutors';


// Wave 12 Step 2: signing execution + cap-audited mutation sub-hook
export * from './useArchitectActions.signingExecution';
import { useSigningExecution } from './useArchitectActions.signingExecution';


// Wave 12 Step 1: cap-audit boundary + world-reload orchestration sub-hook
export * from './useArchitectActions.persistenceHelpers';
import { usePersistenceHelpers } from './useArchitectActions.persistenceHelpers';

import {
  BASE_MODE_VALIDATOR_WORLD_ID,
  CAP_AUDIT_EVENT_SCHEMA_VERSION,
  FREE_AGENCY_WORLD_ONLY_REQUIREMENTS,
  MINIMUM_SIGNING_HEURISTIC,
  OFFER_SHEET_WORLD_REQUIRED_MESSAGE,
  buildActionSeasonContext,
  buildAuditDiffSummary,
  buildBlockedSignAndTradePreflightResult,
  buildCapAuditEvaluation,
  buildCommittedOfferSheetIdentity,
  buildCommittedOfferSheetLifecycleIdentity,
  buildOfferSheetCreationDefinitionFailure,
  buildOfferSheetPreflightResult,
  buildSignAndTradeTransactionPreparationFailure,
  buildTotalsByTeam,
  buildYearSeasonContext,
  deriveContractActionYear,
  deriveSigningMechanism,
  deriveSigningYearsOfService,
  ensureContractStructure,
  extractCommittedWorldMetadataPatch,
  filterSignedPlayerFromFreeAgents,
  generateLocalOperationId,
  getFirstViolationMessage,
  getFreeAgencyWorldOnlyRequirement,
  getRenounceTargetCandidateValues,
  getRenounceTargetDisplayName,
  getRenounceTargetPrimaryId,
  getTeamPlayerIds,
  getWorldOptimisticLockScopeKey,
  hasStagedScalarSigningSalaries,
  isCapHoldTarget,
  isOfferSheetCreationDefinitionFailure,
  isSignAndTradeTransactionPreparationFailure,
  matchesCommittedOfferSheetIdentity,
  matchesCommittedOfferSheetLifecycleIdentity,
  normalizeEntityIdentity,
  normalizeFiniteNumber,
  recordOverrideAudit,
  resolveSeasonEndYear,
  safeCloneForAudit,
  stripPrebuiltSigningRowsForAuthority,
  toDashboardCommittedTeamSnapshot,
  toTrimmedStringOrNull,
} from './useArchitectActions.helpers';

/**
 * Centralized action handlers hook for GMDashboard
 *
 * @param params - Hook parameters
 * @returns All action handlers
 */
export function useArchitectActions({
  teamId,
  userId,
  // authLoading is available but not currently used by handlers
  state,
  playersMap,
  modals,
  worldId,
  seasonId,
  publishPostActionReceipt,
}: UseArchitectActionsParams): UseArchitectActionsReturn {
  // Normalize teamId (route slug like "lakers") to canonical teamCode (like "LAL")
  // This ensures all mutation payloads use the same team code format as Firestore base teams
  const teamCode = useMemo(() => resolveTeamCode(teamId) || teamId, [teamId]);

  // Destructure state for easier access
  const {
    teamCapSheet,
    currentYear,
    worldAsOfDate,
    setTeamCapSheet,
    setSelectedRulesYear,
    setSelectedPlayer,
    setFreeAgents,
    startSave,
    finishSave,
    refreshWorldRosterIndex,
    reloadActiveWorldTeamData,
  } = state;

  // Destructure modals for easier access
  const { openContractModal } = modals;

  const {
    setTeamCapSheetSafe,
    setSelectedPlayerSafe,
    openPlayerContractModalRoute,
    prepareCapAuditedMutationBoundary,
    evaluateMutationTruth,
    persistMutation,
    reportMutationError,
    getFreeAgencyWorldOnlyMessage,
    requireActiveWorldForFreeAgencyWorldOnlyCommit,
    buildBlockedWorldOnlySignAndTradePreflightResult,
    buildBlockedWorldOnlyOfferSheetPreflightResult,
    resolveCommittedWorldTeamSnapshot,
    buildCommittedWorldReloadPlan,
    applyCommittedWorldReloadPlan,
    applyCommittedWorldReload,
    syncTeamFromMutationResult,
    runAuthoritativeFAMutation,
    runAuthoritativeWorldMutationWithDashboardSync,
  } = usePersistenceHelpers({
    teamCode: teamCode ?? '',
    worldId,
    userId,
    seasonId,
    currentYear,
    teamCapSheet,
    setTeamCapSheet,
    setSelectedPlayer,
    setSelectedRulesYear,
    openContractModal,
    startSave,
    finishSave,
    reloadActiveWorldTeamData: reloadActiveWorldTeamData!,
    refreshWorldRosterIndex,
    publishPostActionReceipt,
  });


  const {
    applyResolvedStandardSigningState,
    executeWorldModeStandardSigning,
    executeVacuumModeStandardSigning,
    resolveStandardSigningExecutionRoute,
    applyCapAuditedTeamMutation,
    finalizeCapMutationResult,
    prepareAuthoritativeSigningDetails,
    prepareStandardSigningMutationPayload,
    prepareOfferSheetCreationDefinition,
    prepareSignAndTradeTransactionDefinition,
  } = useSigningExecution({
    teamCode: teamCode ?? '',
    worldId,
    userId,
    currentYear,
    teamCapSheet,
    playersMap,
    setTeamCapSheetSafe,
    setFreeAgents,
    startSave,
    finishSave,
    reportMutationError,
    evaluateMutationTruth,
    persistMutation,
    prepareCapAuditedMutationBoundary,
    buildCommittedWorldReloadPlan,
    applyCommittedWorldReloadPlan,
    syncTeamFromMutationResult,
    publishPostActionReceipt,
  });


  const {
    resolveCommittedOfferSheetState,
    applyCommittedOfferSheetState,
    executeWorldModeOfferSheetStore,
    resolveCommittedOfferSheetLifecycleState,
    applyCommittedOfferSheetLifecycleState,
    executeWorldModeOfferSheetLifecycleMutation,
  } = useOfferSheetExecutors({
    teamCode: teamCode ?? '',
    worldId,
    userId,
    seasonId,
    currentYear,
    teamCapSheet,
    startSave,
    finishSave,
    publishPostActionReceipt,
    reportMutationError,
    evaluateMutationTruth,
    getFreeAgencyWorldOnlyMessage,
    requireActiveWorldForFreeAgencyWorldOnlyCommit,
    resolveCommittedWorldTeamSnapshot,
    applyCommittedWorldReload,
    applyCapAuditedTeamMutation,
  });


  // Wave 6 Step 3: trade + sign + sign-and-trade handlers extracted to sub-hook
  const {
    applyTradeToCapSheet,
    handleSign,
    handleSignAndTrade,
    getSignAndTradePreflight,
    getOfferSheetPreflight,
  } = useTradeActions({
    currentYear,
    seasonId,
    teamCode: teamCode ?? '',
    worldId,
    worldAsOfDate,
    userId,
    startSave,
    finishSave,
    setTeamCapSheetSafe,
    reportMutationError,
    getFreeAgencyWorldOnlyMessage,
    requireActiveWorldForFreeAgencyWorldOnlyCommit,
    buildBlockedWorldOnlySignAndTradePreflightResult,
    buildBlockedWorldOnlyOfferSheetPreflightResult,
    resolveCommittedWorldTeamSnapshot,
    applyCommittedWorldReload,
    applyResolvedStandardSigningState,
    resolveStandardSigningExecutionRoute,
    runAuthoritativeWorldMutationWithDashboardSync,
    evaluateMutationTruth,
    prepareStandardSigningMutationPayload,
    prepareSignAndTradeTransactionDefinition,
    prepareOfferSheetCreationDefinition,
  });


  // Wave 6 Step 4: RFA offer sheet handlers extracted to sub-hook
  const {
    handleStoreOfferSheet,
    handleMatchOfferSheet,
    handleDeclineOfferSheet,
    handleFinalizeOfferSheet,
    runManualCapSheetLedgerMutation,
  } = useOfferSheetActions({
    currentYear,
    teamCode: teamCode ?? '',
    reportMutationError,
    requireActiveWorldForFreeAgencyWorldOnlyCommit,
    applyCommittedOfferSheetState,
    executeWorldModeOfferSheetStore,
    executeWorldModeOfferSheetLifecycleMutation,
    prepareOfferSheetCreationDefinition,
    applyCapAuditedTeamMutation,
  });

  // === Dead Money Actions (Phase 24) ===

  // Wave 6 Step 5: contract + cap + DEV fixture handlers extracted to sub-hook
  const {
    handleSetDeadCap,
    handleSetExceptions,
    handleEditContract,
    handleLaunchPlayerContractAction,
    handleCapTableModalAction,
    handleCapHoldRenounce,
    handleExtendContract,
    handleWaiveContract,
    handleOptionDecision,
    handleRenounceRights,
    capSheetDevTools,
    teamHistoryDevTools,
  } = useContractActions({
    currentYear,
    seasonId,
    teamCode: teamCode ?? '',
    teamCapSheet: teamCapSheet as CapSheet | null | undefined,
    reportMutationError,
    runManualCapSheetLedgerMutation,
    applyCapAuditedTeamMutation,
    finalizeCapMutationResult,
    openPlayerContractModalRoute,
    setTeamCapSheetSafe,
  });

  const dualPathSigning = useMemo<FreeAgencyDualPathSigningOwner>(
    () => ({
      signFreeAgent: handleSign,
    }),
    [handleSign]
  );

  const freeAgencyWorldOnlyModalActionOwner =
    useMemo<FreeAgencyWorldOnlyModalActionOwner | null>(
      () =>
        worldId
          ? {
              signAndTrade: handleSignAndTrade,
              getSignAndTradePreflight,
              getOfferSheetPreflight,
              storeOfferSheet: handleStoreOfferSheet,
            }
          : null,
      [
        getOfferSheetPreflight,
        getSignAndTradePreflight,
        handleSignAndTrade,
        handleStoreOfferSheet,
        worldId,
      ]
    );

  const freeAgencyOfferSheetLifecycleActionOwner =
    useMemo<FreeAgencyOfferSheetLifecycleActionOwner | null>(
      () =>
        worldId
          ? {
              matchOfferSheet: handleMatchOfferSheet,
              declineOfferSheet: handleDeclineOfferSheet,
              finalizeOfferSheet: handleFinalizeOfferSheet,
            }
          : null,
      [
        handleDeclineOfferSheet,
        handleFinalizeOfferSheet,
        handleMatchOfferSheet,
        worldId,
      ]
    );

  const freeAgencyWorldOnlyActionOwner =
    useMemo<FreeAgencyWorldOnlyActionOwner | null>(
      () =>
        freeAgencyWorldOnlyModalActionOwner &&
        freeAgencyOfferSheetLifecycleActionOwner
          ? {
              ...freeAgencyWorldOnlyModalActionOwner,
              ...freeAgencyOfferSheetLifecycleActionOwner,
            }
          : null,
      [
        freeAgencyOfferSheetLifecycleActionOwner,
        freeAgencyWorldOnlyModalActionOwner,
      ]
    );

  // VISUAL/MODAL CONTRACT: FreeAgentPool reads this as upstream truth for what
  // the contract modal is allowed to show. Architect V1 supports the proven
  // saved-world standard FA lane while parking advanced Free Agency transaction
  // lanes from the normal user path.
  const freeAgentModalAvailability = useMemo<FreeAgentModalAvailability>(
    () => {
      const standardSigningIsWorldSupported = Boolean(worldId);
      const offerSheetInitiation = freeAgencyWorldOnlyModalActionOwner
        ? {
            getOfferSheetPreflight:
              freeAgencyWorldOnlyModalActionOwner.getOfferSheetPreflight,
            storeOfferSheet: freeAgencyWorldOnlyModalActionOwner.storeOfferSheet,
          }
        : null;

      return {
        visibleActions: ['signNew'],
        actionLabelsOverride: {
          signNew: standardSigningIsWorldSupported
            ? 'Sign Free Agent'
            : 'Sign Free Agent (Preview)',
        },
        standardSigningExposureClassification:
          standardSigningIsWorldSupported ? 'V1 supported' : 'preview-only',
        showOfferSheetToggle: Boolean(offerSheetInitiation),
        signAndTradeInitiation: null,
        offerSheetInitiation,
      };
    },
    [freeAgencyWorldOnlyModalActionOwner, worldId]
  );

  // SECTION/LIFECYCLE CONTRACT: FreeAgencySection renders disabled messaging
  // from this published availability surface instead of rebuilding world-mode
  // lifecycle rules locally.
  const offerSheetSectionAvailability =
    useMemo<FreeAgencyOfferSheetSectionAvailability>(
      () => ({
        lifecycleActionOwner: freeAgencyOfferSheetLifecycleActionOwner,
        actionsDisabled: !freeAgencyOfferSheetLifecycleActionOwner,
        actionsDisabledReason: freeAgencyOfferSheetLifecycleActionOwner
          ? null
          : getFreeAgencyWorldOnlyMessage('offerSheetLifecycle', 'commit'),
      }),
      [freeAgencyOfferSheetLifecycleActionOwner, getFreeAgencyWorldOnlyMessage]
    );

  // PUBLISHED FREE-AGENCY CONTRACT: downstream surfaces should consume the
  // slice they need rather than infer base-vs-world behavior from raw handlers.
  const freeAgencyActionOwner = useMemo<FreeAgencyActionOwner>(
    () => ({
      dualPathSigning,
      worldOnly: freeAgencyWorldOnlyActionOwner,
      freeAgentModalAvailability,
      offerSheetSectionAvailability,
    }),
    [
      dualPathSigning,
      freeAgentModalAvailability,
      freeAgencyWorldOnlyActionOwner,
      offerSheetSectionAvailability,
    ]
  );

  return {
    freeAgencyActionOwner,

    // Contract/Player actions
    handleSign,
    handleSignAndTrade,
    getSignAndTradePreflight,
    getOfferSheetPreflight,
    handleEditContract,
    handleLaunchPlayerContractAction,
    handleCapTableModalAction,
    handleCapHoldRenounce,
    handleExtendContract,
    handleWaiveContract,
    handleOptionDecision,
    handleRenounceRights,

    // Phase 16: Offer Sheet Actions
    handleStoreOfferSheet,
    handleMatchOfferSheet,
    handleDeclineOfferSheet,
    handleFinalizeOfferSheet,

    // Trade actions
    applyTradeToCapSheet,

    // Phase 24: Dead Money
    handleSetDeadCap,

    // Phase 27: Exception Management
    handleSetExceptions,

    // DEV-only tool surfaces
    capSheetDevTools,
    teamHistoryDevTools,
  };
}
