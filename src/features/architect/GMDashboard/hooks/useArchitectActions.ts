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
  FreeAgentOfferSheetInitiation,
  FreeAgentSignAndTradeInitiation,
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
  });


  const resolveCommittedOfferSheetState = useCallback(
    async (
      result: PersistMutationResult,
      params: {
        playerId: string;
        seasonKey: string;
        offeringTeamCode: string;
      }
    ): Promise<OfferSheetCommittedStateResolution> => {
      const committedOfferSheetIdentity = buildCommittedOfferSheetIdentity({
        result,
        playerId: params.playerId,
        seasonKey: params.seasonKey,
        offeringTeamCode: params.offeringTeamCode,
      });
      const committedWorldTeam =
        await resolveCommittedWorldTeamSnapshot(result);
      const committedTeam = committedWorldTeam?.committedTeam || null;
      const committedTeamSource: OfferSheetCommittedState['committedTeamSource'] =
        committedWorldTeam?.committedTeamSource || 'reload';

      if (!committedTeam) {
        return {
          ok: false,
          message:
            'Offer sheet saved but the committed team snapshot could not be reloaded.',
          logContext: {
            result,
            committedOfferSheetIdentity,
          },
        };
      }

      const committedOfferSheet =
        (committedTeam.offerSheets || []).find((offerSheet) =>
          matchesCommittedOfferSheetIdentity(
            offerSheet as OfferSheet,
            committedOfferSheetIdentity
          )
        ) || null;

      if (!committedOfferSheet) {
        return {
          ok: false,
          message:
            'Offer sheet saved but the committed pending offer sheet could not be verified in the active team snapshot.',
          logContext: {
            result,
            committedOfferSheetIdentity,
            committedTeamSource,
            offerSheets: committedTeam.offerSheets || [],
          },
        };
      }

      return {
        ok: true,
        value: {
          committedTeam,
          committedTeamSource,
          committedOfferSheet: committedOfferSheet as OfferSheet,
          committedOfferSheetIdentity,
        },
      };
    },
    [resolveCommittedWorldTeamSnapshot]
  );

  const applyCommittedOfferSheetState = useCallback(
    async (
      committedTeam: DashboardCommittedTeamSnapshot,
      committedTeamSource: WorldCommittedTeamSource
    ): Promise<void> => {
      await applyCommittedWorldReload('storeOfferSheet', {
        committedTeam,
        committedTeamSource,
      });
    },
    [applyCommittedWorldReload]
  );

  const executeWorldModeOfferSheetStore = useCallback(
    async (
      actionSeasonContext: ReturnType<typeof buildActionSeasonContext>,
      mutationPayload: OfferSheetMutationPayload
    ): Promise<OfferSheetStoreExecutionResult> => {
      if (!worldId) {
        const message = getFreeAgencyWorldOnlyMessage(
          'offerSheetCreation',
          'commit'
        );
        reportMutationError(message, {
          mutationType: 'storeOfferSheet',
          payload: mutationPayload,
        });
        return { success: false, message };
      }

      if (!userId) {
        const message = 'Cannot save changes: missing user identity.';
        reportMutationError(message, {
          mutationType: 'storeOfferSheet',
          payload: mutationPayload,
        });
        return { success: false, message };
      }

      startSave();
      try {
        const rawResult = (await applyWorldMutation({
          userId,
          worldId,
          seasonId: actionSeasonContext.seasonId,
          mutationType: 'storeOfferSheet',
          payload: mutationPayload,
        })) as PersistMutationResult;

        const truth = evaluateMutationTruth('storeOfferSheet', rawResult, {
          requireWorldPersistence: true,
        });
        const result: PersistMutationResult = {
          ...rawResult,
          success: truth.ok,
          error: truth.ok
            ? rawResult?.error
            : truth.message || 'Failed to store offer sheet.',
          appliedToLocalState: truth.appliedToLocalState,
          persistedToWorld: truth.persistedToWorld,
        };

        if (!result.success) {
          const message = String(
            result.error || 'Failed to store offer sheet.'
          );
          reportMutationError(message, {
            mutationType: 'storeOfferSheet',
            payload: mutationPayload,
            result: rawResult,
          });
          finishSave(message);
          return { success: false, message };
        }

        const committedState = await resolveCommittedOfferSheetState(result, {
          playerId: mutationPayload.playerId,
          seasonKey: actionSeasonContext.seasonId,
          offeringTeamCode: mutationPayload.teamCode,
        });

        if (committedState.ok !== true) {
          const failedCommittedState = committedState;

          reportMutationError(failedCommittedState.message, {
            mutationType: 'storeOfferSheet',
            payload: mutationPayload,
            ...failedCommittedState.logContext,
          });
          finishSave(failedCommittedState.message);
          return {
            success: false,
            message: failedCommittedState.message,
          };
        }

        toast.success('Saved changes');
        finishSave();
        return {
          success: true,
          ...committedState.value,
        };
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to store offer sheet.';
        reportMutationError(message, {
          mutationType: 'storeOfferSheet',
          payload: mutationPayload,
          error,
        });
        finishSave(message);
        return { success: false, message };
      }
    },
    [
      applyWorldMutation,
      evaluateMutationTruth,
      finishSave,
      getFreeAgencyWorldOnlyMessage,
      reportMutationError,
      resolveCommittedOfferSheetState,
      startSave,
      userId,
      worldId,
    ]
  );

  const resolveCommittedOfferSheetLifecycleState = useCallback(
    async (
      result: PersistMutationResult,
      expectation: OfferSheetLifecycleCommittedStateExpectation
    ): Promise<OfferSheetLifecycleCommittedStateResolution> => {
      const committedOfferSheetIdentity =
        buildCommittedOfferSheetLifecycleIdentity({
          result,
          fallbackIdentity: expectation.identity,
        });
      const committedWorldTeam =
        await resolveCommittedWorldTeamSnapshot(result);
      const committedTeam = committedWorldTeam?.committedTeam || null;
      const committedTeamSource: OfferSheetLifecycleCommittedState['committedTeamSource'] =
        committedWorldTeam?.committedTeamSource || 'reload';

      if (!committedTeam) {
        return {
          ok: false,
          message: OFFER_SHEET_LIFECYCLE_RELOAD_FAILURE_MESSAGE,
          logContext: {
            result,
            expectation,
            committedOfferSheetIdentity,
          },
        };
      }

      const committedOfferSheetEntries =
        expectation.activeTeamArrayKey === 'incomingOfferSheets'
          ? committedTeam.incomingOfferSheets || []
          : committedTeam.offerSheets || [];
      const committedOfferSheet =
        committedOfferSheetEntries.find((offerSheet) =>
          matchesCommittedOfferSheetLifecycleIdentity(
            offerSheet as OfferSheet,
            committedOfferSheetIdentity
          )
        ) || null;

      if (expectation.presence === 'present' && !committedOfferSheet) {
        return {
          ok: false,
          message: OFFER_SHEET_LIFECYCLE_VERIFICATION_FAILURE_MESSAGE,
          logContext: {
            result,
            expectation,
            committedOfferSheetIdentity,
            committedTeamSource,
            [expectation.activeTeamArrayKey]: committedOfferSheetEntries,
          },
        };
      }

      if (expectation.presence === 'absent' && committedOfferSheet) {
        return {
          ok: false,
          message: OFFER_SHEET_LIFECYCLE_VERIFICATION_FAILURE_MESSAGE,
          logContext: {
            result,
            expectation,
            committedOfferSheetIdentity,
            committedTeamSource,
            [expectation.activeTeamArrayKey]: committedOfferSheetEntries,
          },
        };
      }

      return {
        ok: true,
        value: {
          committedTeam,
          committedTeamSource,
          committedOfferSheet: committedOfferSheet as OfferSheet | null,
          committedOfferSheetIdentity,
          expectation,
        },
      };
    },
    [resolveCommittedWorldTeamSnapshot]
  );

  const applyCommittedOfferSheetLifecycleState = useCallback(
    async (
      mutationType: OfferSheetLifecycleMutationType,
      committedTeam: DashboardCommittedTeamSnapshot,
      committedTeamSource: WorldCommittedTeamSource
    ): Promise<void> => {
      await applyCommittedWorldReload(mutationType, {
        committedTeam,
        committedTeamSource,
      });
    },
    [applyCommittedWorldReload]
  );

  const executeWorldModeOfferSheetLifecycleMutation = useCallback(
    async (
      mutationType: OfferSheetLifecycleMutationType,
      mutationPayload: ArchitectMutationPayload,
      expectation: OfferSheetLifecycleCommittedStateExpectation
    ): Promise<OfferSheetLifecycleExecutionResult> => {
      if (!worldId) {
        const message = getFreeAgencyWorldOnlyMessage(
          'offerSheetLifecycle',
          'commit'
        );
        reportMutationError(message, {
          mutationType,
          payload: mutationPayload,
          expectation,
        });
        return {
          success: false,
          message,
        };
      }

      if (!userId) {
        const message = 'Cannot save changes: missing user identity.';
        reportMutationError(message, {
          mutationType,
          payload: mutationPayload,
          expectation,
        });
        return { success: false, message };
      }

      startSave();
      try {
        const rawResult = (await applyWorldMutation({
          userId,
          worldId,
          seasonId,
          mutationType,
          payload: mutationPayload,
        })) as PersistMutationResult;

        const truth = evaluateMutationTruth(mutationType, rawResult, {
          requireWorldPersistence: true,
        });
        const result: PersistMutationResult = {
          ...rawResult,
          success: truth.ok,
          error: truth.ok
            ? rawResult?.error
            : truth.message || `Failed to run ${mutationType}.`,
          appliedToLocalState: truth.appliedToLocalState,
          persistedToWorld: truth.persistedToWorld,
        };

        if (!result.success) {
          const message = String(
            result.error || `Failed to run ${mutationType}.`
          );
          reportMutationError(message, {
            mutationType,
            payload: mutationPayload,
            expectation,
            result: rawResult,
          });
          finishSave(message);
          return { success: false, message };
        }

        const committedState = await resolveCommittedOfferSheetLifecycleState(
          result,
          expectation
        );

        if (committedState.ok !== true) {
          const failedCommittedState = committedState;

          reportMutationError(failedCommittedState.message, {
            mutationType,
            payload: mutationPayload,
            expectation,
            ...failedCommittedState.logContext,
          });
          finishSave(failedCommittedState.message);
          return {
            success: false,
            message: failedCommittedState.message,
          };
        }

        await applyCommittedOfferSheetLifecycleState(
          mutationType,
          committedState.value.committedTeam,
          committedState.value.committedTeamSource
        );
        toast.success('Saved changes');
        finishSave();
        return {
          success: true,
          ...committedState.value,
        };
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : `Failed to run ${mutationType}.`;
        reportMutationError(message, {
          mutationType,
          payload: mutationPayload,
          expectation,
          error,
        });
        finishSave(message);
        return { success: false, message };
      }
    },
    [
      applyCommittedOfferSheetLifecycleState,
      evaluateMutationTruth,
      finishSave,
      getFreeAgencyWorldOnlyMessage,
      reportMutationError,
      resolveCommittedOfferSheetLifecycleState,
      seasonId,
      startSave,
      userId,
      worldId,
    ]
  );

  const applyResolvedStandardSigningState = useCallback(
    async (
      playerObj: ArchitectPlayer,
      resolvedState: StandardSigningResolvedState
    ): Promise<void> => {
      let didApplyResolvedState = false;

      if (resolvedState.propagationMode === 'local-validated') {
        setTeamCapSheetSafe(resolvedState.localValidatedTeam);
        didApplyResolvedState = true;
      } else {
        const worldReloadResult = await applyCommittedWorldReloadPlan(
          resolvedState.reloadPlan
        );

        if (worldReloadResult.status !== 'applied') {
          return;
        }

        didApplyResolvedState = true;
      }

      if (!didApplyResolvedState) {
        return;
      }

      setFreeAgents((prev) =>
        filterSignedPlayerFromFreeAgents(prev, playerObj)
      );
    },
    [applyCommittedWorldReloadPlan, setFreeAgents, setTeamCapSheetSafe]
  );

  const executeWorldModeStandardSigning = useCallback(
    async (
      playerObj: ArchitectPlayer,
      actionSeasonContext: ReturnType<typeof buildActionSeasonContext>,
      standardSigningPayload: StandardSigningMutationPayload
    ): Promise<StandardSigningExecutionResult> => {
      if (!worldId) {
        const message = 'Signing requires an active world to commit.';
        reportMutationError(message, {
          mutationType: 'signFreeAgent',
          payload: standardSigningPayload,
        });
        return { success: false, message };
      }

      if (!userId) {
        const message = 'Cannot save changes: missing user identity.';
        reportMutationError(message, {
          mutationType: 'signFreeAgent',
          payload: standardSigningPayload,
        });
        return { success: false, message };
      }

      startSave();
      try {
        const rawResult = (await applyWorldMutation({
          userId,
          worldId,
          seasonId: actionSeasonContext.seasonId,
          mutationType: 'signFreeAgent',
          payload: standardSigningPayload,
        })) as PersistMutationResult;

        const truth = evaluateMutationTruth('signFreeAgent', rawResult, {
          requireWorldPersistence: true,
        });
        const result: PersistMutationResult = {
          ...rawResult,
          success: truth.ok,
          error: truth.ok
            ? rawResult?.error
            : truth.message || 'Failed to save signing. Please try again.',
          appliedToLocalState: truth.appliedToLocalState,
          persistedToWorld: truth.persistedToWorld,
        };

        if (!result.success) {
          const message = String(
            result.error || 'Failed to save signing. Please try again.'
          );
          reportMutationError(message, {
            mutationType: 'signFreeAgent',
            payload: standardSigningPayload,
            result: rawResult,
          });
          finishSave(message);
          return { success: false, message };
        }

        const committedWorldReloadPlan = await buildCommittedWorldReloadPlan(
          'signFreeAgent',
          result
        );
        if (!committedWorldReloadPlan) {
          const message =
            'Signing saved but the committed team snapshot could not be reloaded.';
          reportMutationError(message, {
            mutationType: 'signFreeAgent',
            payload: standardSigningPayload,
            playerId:
              standardSigningPayload.playerId ||
              playerObj.id ||
              playerObj.player_id,
            result,
          });
          finishSave(message);
          return { success: false, message };
        }

        toast.success('Saved changes');
        finishSave();
        return {
          success: true,
          propagationMode: 'world-committed',
          reloadPlan: committedWorldReloadPlan,
        };
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to save signing. Please try again.';
        reportMutationError(message, {
          mutationType: 'signFreeAgent',
          payload: standardSigningPayload,
          error,
        });
        finishSave(message);
        return { success: false, message };
      }
    },
    [
      applyWorldMutation,
      evaluateMutationTruth,
      finishSave,
      reportMutationError,
      buildCommittedWorldReloadPlan,
      startSave,
      userId,
      worldId,
    ]
  );

  const executeVacuumModeStandardSigning = useCallback(
    async (
      playerObj: ArchitectPlayer,
      actionSeasonContext: ReturnType<typeof buildActionSeasonContext>,
      standardSigningPayload: StandardSigningMutationPayload
    ): Promise<StandardSigningExecutionResult> => {
      const idToSign = playerObj.id || playerObj.player_id;

      if (!teamCapSheet) {
        reportMutationError(
          'Cannot sign player in vacuum mode: team state is not loaded.',
          {
            playerId: idToSign,
          }
        );
        return {
          success: false,
          message: 'Cannot sign player: team state is not loaded.',
        };
      }

      const canonicalPlayer =
        playersMap[playerObj.name || ''] ||
        playersMap[playerObj.player_id || ''] ||
        playersMap[playerObj.id || ''] ||
        playerObj;
      const validationTeam = toSigningValidationTeam(teamCapSheet);
      const validationPlayer = toSigningValidationPlayer(canonicalPlayer);

      if (!validationTeam || !validationPlayer) {
        const message =
          'Cannot sign player: the local team or player snapshot is incomplete.';
        reportMutationError(message, {
          playerId: idToSign,
          teamLoaded: Boolean(teamCapSheet),
          playerLoaded: Boolean(canonicalPlayer),
        });
        return { success: false, message };
      }

      const validation = validateSigning({
        team: validationTeam,
        player: validationPlayer,
        contract: standardSigningPayload.contract,
        signedUsing: standardSigningPayload.signedUsing,
        year: actionSeasonContext.actionYear,
      });

      if (!validation.valid) {
        const firstViolation = validation.violations?.[0];
        const message =
          firstViolation?.message ||
          'Signing failed cap validation in vacuum mode.';
        reportMutationError(message, {
          playerId: idToSign,
          violations: validation.violations,
        });
        return { success: false, message };
      }

      const freeAgentComputeState = toFreeAgentComputeState(
        teamCapSheet,
        canonicalPlayer,
        teamCode
      );

      if (!freeAgentComputeState) {
        const message =
          'Cannot sign player: the canonical current state could not be normalized.';
        reportMutationError(message, {
          playerId: idToSign,
          teamCode: teamCode ?? '',
        });
        return { success: false, message };
      }

      const computeResult = computeWorldMutation({
        mutationType: 'signFreeAgent',
        payload: standardSigningPayload,
        currentState: freeAgentComputeState,
        seasonId: actionSeasonContext.seasonId,
        timestamp: Date.now(),
      }) as ComputeMutationResult;

      if (!computeResult.success) {
        const message = String(
          computeResult.error ||
            'Unable to apply signing in vacuum mode with canonical compute.'
        );
        reportMutationError(message, {
          playerId: idToSign,
          computeResult,
        });
        return { success: false, message };
      }

      const updatedTeam = findUpdatedTeamSnapshot(
        computeResult.teamUpdates,
        teamCode
      );

      if (!updatedTeam) {
        const message =
          'Signing compute succeeded but no updated team snapshot was returned.';
        reportMutationError(message, {
          playerId: idToSign,
          computeResult,
        });
        return { success: false, message };
      }

      const operationId = generateLocalOperationId();
      const occurredAt = new Date().toISOString();
      const localValidatedAudit = buildCapAuditEvaluation({
        operationId,
        occurredAt,
        mutationType: 'signFreeAgent',
        worldId: null,
        year: actionSeasonContext.actionYear,
        teamCodes: [teamCode],
        playerIds: [String(idToSign)],
        beforeTeamsByCode: {
          [teamCode]: safeCloneForAudit(teamCapSheet as CapSheet),
        },
        afterTeamsByCode: {
          [teamCode]: safeCloneForAudit(updatedTeam as CapSheet),
        },
      });
      const localValidatedAuditEvent = withLocalCapAuditLifecycleState(
        localValidatedAudit.event,
        localValidatedAudit.validation.valid
          ? 'local-validated-applied'
          : 'evaluation-blocked'
      );
      appendLocalCapAuditEvent(localValidatedAuditEvent, {
        storageKey: BASE_LOCAL_VALIDATED_CAP_AUDIT_STREAM.storageKey,
      });

      if (!localValidatedAudit.validation.valid) {
        const message = getFirstViolationMessage(
          localValidatedAudit.validation,
          'Signing blocked by post-state cap validation in vacuum mode.'
        );
        reportMutationError(message, {
          playerId: idToSign,
          operationId,
          violations: localValidatedAudit.validation.violations,
        });
        return { success: false, message };
      }

      return {
        success: true,
        propagationMode: 'local-validated',
        localValidatedTeam: updatedTeam as CapSheet,
        localValidatedTeamSource: 'compute',
      };
    },
    [playersMap, reportMutationError, teamCapSheet, teamCode]
  );

  const resolveStandardSigningExecutionRoute = useCallback<
    () => StandardSigningExecutionRoute
  >(
    () =>
      worldId
        ? {
            mode: 'world',
            execute: executeWorldModeStandardSigning,
          }
        : {
            mode: 'vacuum',
            execute: executeVacuumModeStandardSigning,
          },
    [executeVacuumModeStandardSigning, executeWorldModeStandardSigning, worldId]
  );

  const applyCapAuditedTeamMutation = useCallback(
    (params: {
      mutationType: string;
      playerIds?: string[];
      computeNextTeam: (beforeTeam: CapSheet) => CapSheet;
      persistPayload?: ArchitectMutationPayload;
      invalidMessage: string;
      seasonIdOverride?: string;
      yearOverride?: number;
    }): {
      applied: boolean;
      operationId: string | null;
      persistPromise: Promise<boolean> | null;
    } => {
      const {
        mutationType,
        playerIds = [],
        computeNextTeam,
        persistPayload = {},
        invalidMessage,
        seasonIdOverride,
        yearOverride = currentYear,
      } = params;

      const lockScopeKey = worldId
        ? getWorldOptimisticLockScopeKey(worldId)
        : null;
      let optimisticLockAcquired = false;
      let persistScheduled = false;

      try {
        if (lockScopeKey) {
          optimisticLockAcquired = acquireOptimisticLock(lockScopeKey);
          if (!optimisticLockAcquired) {
            const blockedMessage =
              'Another cap mutation is still saving. Please wait and try again.';
            reportMutationError(blockedMessage, {
              mutationType,
              worldId,
              lockScopeKey,
            });
            return { applied: false, operationId: null, persistPromise: null };
          }
        }

        if (!teamCapSheet) {
          reportMutationError(
            `Cannot apply ${mutationType}: team state is not loaded.`,
            {
              mutationType,
            }
          );
          return { applied: false, operationId: null, persistPromise: null };
        }

        const boundary = prepareCapAuditedMutationBoundary({
          mutationType,
          playerIds,
          computeNextTeam,
          yearOverride,
        });

        appendLocalCapAuditEvent(boundary.auditEvent, {
          storageKey: boundary.storageKey,
        });

        if (!boundary.auditEvaluation.validation.valid) {
          // The audit record has already been written with an explicit
          // `evaluation-blocked` lifecycle state, so callers can distinguish
          // blocked preview/audit records from pending optimistic preview.
          reportMutationError(
            getFirstViolationMessage(
              boundary.auditEvaluation.validation,
              invalidMessage
            ),
            {
              mutationType,
              operationId: boundary.operationId,
              violations: boundary.auditEvaluation.validation.violations,
            }
          );
          return {
            applied: false,
            operationId: boundary.operationId,
            persistPromise: null,
          };
        }

        boundary.applyNonAuthoritativeState();

        if (boundary.localStateKind === 'local-validated-apply') {
          return {
            applied: true,
            operationId: boundary.operationId,
            persistPromise: Promise.resolve(true),
          };
        }

        const persistPromise = persistMutation(mutationType, persistPayload, {
          operationId: boundary.operationId,
          seasonIdOverride,
          onSuccess: boundary.linkCommittedPersistSuccess,
          onFailure: (message) => {
            boundary.rollbackOptimisticLocalState();
            reportMutationError(
              message || `Failed to persist ${mutationType} mutation.`,
              {
                mutationType,
                operationId: boundary.operationId,
              }
            );
          },
        });
        const persistCompletionPromise = persistPromise
          .then(async (result) => {
            if (!result?.success) {
              return false;
            }
            await syncTeamFromMutationResult(mutationType, result);
            return true;
          })
          .catch(() => false);

        persistScheduled = true;
        void persistPromise.finally(() => {
          if (lockScopeKey) {
            releaseOptimisticLock(lockScopeKey);
          }
        });

        return {
          applied: true,
          operationId: boundary.operationId,
          persistPromise: persistCompletionPromise,
        };
      } finally {
        if (optimisticLockAcquired && lockScopeKey && !persistScheduled) {
          releaseOptimisticLock(lockScopeKey);
        }
      }
    },
    [
      currentYear,
      persistMutation,
      prepareCapAuditedMutationBoundary,
      reportMutationError,
      syncTeamFromMutationResult,
      teamCapSheet,
      worldId,
    ]
  );

  const finalizeCapMutationResult = useCallback(
    async (
      mutationResult: {
        applied: boolean;
        persistPromise: Promise<boolean> | null;
      },
      failureMessage: string
    ): Promise<MutationActionResult> => {
      if (!mutationResult.applied) {
        return { success: false, message: failureMessage };
      }
      const persisted = mutationResult.persistPromise
        ? await mutationResult.persistPromise
        : true;
      if (!persisted) {
        return { success: false, message: failureMessage };
      }
      return { success: true };
    },
    []
  );

  // === Trade Actions ===

  const prepareAuthoritativeSigningDetails = useCallback(
    (
      playerObj: ArchitectPlayer,
      contract: SigningDetails,
      overrides: AuthoritativeSigningPreparationOverrides
    ): PreparedAuthoritativeSigningDetails => {
      const contractForAuthority =
        stripPrebuiltSigningRowsForAuthority(contract) ||
        (contract as LocalContract);
      const actionSeasonContext = buildActionSeasonContext(
        contractForAuthority,
        currentYear
      );
      const signedUsing = deriveSigningMechanism(contract);
      const signedUsingForContract = normalizeOptionalMutationString(signedUsing);
      const normalizedExceptionType =
        typeof contract.exceptionType === 'string'
          ? contract.exceptionType.trim()
          : '';
      const preparedContract = ensureContractStructure(contractForAuthority, {
        ...overrides,
        contractType: overrides.contractType,
        signingTeam: teamCode,
        startYear: actionSeasonContext.actionYear,
        signedUsing: signedUsingForContract,
        exceptionType:
          normalizedExceptionType || signedUsingForContract || undefined,
      });

      if (!preparedContract) {
        return {
          actionSeasonContext,
          architectContract: null,
          signedUsing,
        };
      }

      const salaryRows = Array.isArray(preparedContract.salariesByYear)
        ? preparedContract.salariesByYear
        : [];
      const baseSalary = Number(salaryRows[0]?.salary) || 0;
      const contractYears =
        salaryRows.length ||
        Math.max(
          1,
          Number(preparedContract.contractYears ?? preparedContract.years) || 1
        );
      const totalValue = salaryRows.reduce(
        (sum, row) => sum + (Number(row?.salary) || 0),
        0
      );
      const yearsOfService = deriveSigningYearsOfService(playerObj, contract);

      return {
        actionSeasonContext,
        signedUsing,
        architectContract: {
          ...preparedContract,
          years: contractYears,
          contractYears,
          totalValue,
          averageAnnualValue:
            contractYears > 0 ? Math.round(totalValue / contractYears) : 0,
          base: baseSalary,
          firstYearGuaranteed: salaryRows[0]?.guaranteed !== false,
          guaranteed:
            preparedContract.guaranteed ??
            salaryRows.every((row) => row?.guaranteed !== false),
          signedUsing: signedUsingForContract,
          exceptionType:
            normalizedExceptionType || signedUsingForContract || undefined,
          yearsOfService: yearsOfService ?? undefined,
          isMinimum:
            signedUsing?.toLowerCase() === 'minimum' ||
            preparedContract.isMinimum === true ||
            baseSalary <= MINIMUM_SIGNING_HEURISTIC,
        },
      };
    },
    [currentYear, teamCode]
  );

  const prepareStandardSigningMutationPayload = useCallback(
    (
      playerObj: ArchitectPlayer,
      playerId: string,
      contract: SigningDetails
    ): PreparedStandardSigningDetails => {
      const { actionSeasonContext, architectContract, signedUsing } =
        prepareAuthoritativeSigningDetails(playerObj, contract, {
          contractType:
            typeof contract.contractType === 'string'
              ? contract.contractType
              : 'Signed FA',
          isExtension: !!contract.isExtension,
          isRookieScale: !!contract.isRookieScale,
          signAndTrade: false,
        });

      if (!architectContract) {
        return {
          actionSeasonContext,
          standardSigningPayload: null,
        };
      }

      return {
        actionSeasonContext,
        standardSigningPayload: {
          teamCode: teamCode ?? '',
          playerId,
          contract: architectContract,
          signedUsing,
        },
      };
    },
    [prepareAuthoritativeSigningDetails, teamCode]
  );

  const prepareOfferSheetCreationDefinition = useCallback(
    (
      playerObj: ArchitectPlayer,
      contract: SigningDetails
    ): PreparedOfferSheetCreationDefinition => {
      const playerId = String(playerObj.id || playerObj.player_id || '').trim();
      if (!playerId) {
        return buildOfferSheetCreationDefinitionFailure(
          'incomplete',
          'Authoritative offer sheet preflight is missing player context.',
          'Cannot store offer sheet: missing player ID.',
          {
            playerObj,
          }
        );
      }

      const { actionSeasonContext, architectContract, signedUsing } =
        prepareAuthoritativeSigningDetails(playerObj, contract, {
          contractType: 'Offer Sheet',
          isExtension: false,
          isRookieScale: !!contract.isRookieScale,
          signAndTrade: false,
          rfaOfferSheet: true,
          rfaOfferSheetOnly: true,
          rfaOfferSheetStatus: 'PENDING_MATCH',
        });

      if (!architectContract) {
        return buildOfferSheetCreationDefinitionFailure(
          'blocked',
          'Cannot complete offer sheet: contract payload is invalid.',
          'Cannot store offer sheet: contract payload is invalid.',
          {
            playerId,
            contract,
          }
        );
      }

      return {
        ok: true,
        actionSeasonContext,
        preflightPayload: {
          offeringTeamCode: teamCode,
          playerId,
          contract: architectContract,
        },
        mutationPayload: {
          teamCode: teamCode ?? '',
          playerId,
          contract: architectContract,
          signedUsing,
        },
      };
    },
    [prepareAuthoritativeSigningDetails, teamCode]
  );

  const prepareSignAndTradeTransactionDefinition = useCallback(
    (
      playerObj: ArchitectPlayer,
      contract: SigningDetails,
      destinationTeamCode: string
    ): PreparedSignAndTradeTransactionDefinition => {
      const canonicalDestinationTeamCode = destinationTeamCode
        ? resolveTeamCode(destinationTeamCode) || destinationTeamCode
        : '';
      if (!canonicalDestinationTeamCode) {
        return buildSignAndTradeTransactionPreparationFailure(
          'Destination team is required for sign-and-trade.',
          {
            playerObj,
            destinationTeamCode,
          }
        );
      }

      if (canonicalDestinationTeamCode === teamCode) {
        return buildSignAndTradeTransactionPreparationFailure(
          'Destination team must be different from the current team for sign-and-trade.',
          {
            playerObj,
            destinationTeamCode,
            canonicalDestinationTeamCode,
          }
        );
      }

      const playerId = String(playerObj.id || playerObj.player_id || '').trim();
      if (!playerId) {
        return buildSignAndTradeTransactionPreparationFailure(
          'Cannot complete sign-and-trade: missing player ID.',
          {
            playerObj,
          }
        );
      }

      const { actionSeasonContext, architectContract, signedUsing } =
        prepareAuthoritativeSigningDetails(playerObj, contract, {
          contractType: 'Sign & Trade',
          isExtension: false,
          isRookieScale: !!contract.isRookieScale,
          signAndTrade: true,
        });

      if (!architectContract) {
        return buildSignAndTradeTransactionPreparationFailure(
          'Cannot complete sign-and-trade: contract payload is invalid.',
          {
            playerId,
            contract,
          }
        );
      }

      return {
        ok: true,
        actionSeasonContext,
        mutationPayload: {
          teamCode: teamCode ?? '',
          destinationTeamCode: canonicalDestinationTeamCode,
          playerId,
          contract: architectContract,
          signedUsing,
          signAndTrade: true,
        },
      };
    },
    [prepareAuthoritativeSigningDetails, teamCode]
  );


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

  const hasWorldOnlySignAndTradeAvailability = Boolean(
    freeAgencyWorldOnlyModalActionOwner?.signAndTrade &&
      freeAgencyWorldOnlyModalActionOwner.getSignAndTradePreflight
  );
  const hasWorldOnlyOfferSheetAvailability = Boolean(
    freeAgencyWorldOnlyModalActionOwner?.storeOfferSheet &&
      freeAgencyWorldOnlyModalActionOwner.getOfferSheetPreflight
  );
  const signAndTradeInitiation =
    useMemo<FreeAgentSignAndTradeInitiation | null>(
      () =>
        hasWorldOnlySignAndTradeAvailability &&
        freeAgencyWorldOnlyModalActionOwner
          ? {
              onSignAndTrade: freeAgencyWorldOnlyModalActionOwner.signAndTrade,
              getSignAndTradePreflight:
                freeAgencyWorldOnlyModalActionOwner.getSignAndTradePreflight,
            }
          : null,
      [
        freeAgencyWorldOnlyModalActionOwner,
        hasWorldOnlySignAndTradeAvailability,
      ]
    );
  const offerSheetInitiation = useMemo<FreeAgentOfferSheetInitiation | null>(
    () =>
      hasWorldOnlyOfferSheetAvailability && freeAgencyWorldOnlyModalActionOwner
        ? {
            getOfferSheetPreflight:
              freeAgencyWorldOnlyModalActionOwner.getOfferSheetPreflight,
            storeOfferSheet:
              freeAgencyWorldOnlyModalActionOwner.storeOfferSheet,
          }
        : null,
    [freeAgencyWorldOnlyModalActionOwner, hasWorldOnlyOfferSheetAvailability]
  );

  // VISUAL/MODAL CONTRACT: FreeAgentPool reads this as upstream truth for what
  // the contract modal is allowed to show. World-only initiators appear here
  // only when the world-only action lane exists.
  const freeAgentModalAvailability = useMemo<FreeAgentModalAvailability>(
    () => ({
      visibleActions: signAndTradeInitiation
        ? ['signNew', 'signAndTrade']
        : ['signNew'],
      actionLabelsOverride: {
        signNew: 'Sign Free Agent',
      },
      showOfferSheetToggle: Boolean(offerSheetInitiation),
      signAndTradeInitiation,
      offerSheetInitiation,
    }),
    [offerSheetInitiation, signAndTradeInitiation]
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
