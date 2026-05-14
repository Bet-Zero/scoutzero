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

  const setTeamCapSheetSafe = useCallback(
    (
      nextTeam:
        | CapSheet
        | UseArchitectStateReturn['teamCapSheet']
        | null
    ): void => {
      setTeamCapSheet(nextTeam as UseArchitectStateReturn['teamCapSheet']);
    },
    [setTeamCapSheet]
  );

  const setSelectedPlayerSafe = useCallback(
    (player: ArchitectPlayer | null): void => {
      setSelectedPlayer(player as UseArchitectStateReturn['selectedPlayer']);
    },
    [setSelectedPlayer]
  );

  const openPlayerContractModalRoute = useCallback(
    ({
      player,
      rulesYear,
      targetYear = null,
      actionContext = null,
      initialAction = null,
    }: {
      player: PlayerRulesProfileInput | ArchitectPlayer;
      rulesYear: number;
      targetYear?: number | null;
      actionContext?: ActionContext;
      initialAction?: string | null;
    }): void => {
      setSelectedPlayerSafe(player as ArchitectPlayer);
      setSelectedRulesYear(rulesYear);
      openContractModal({
        initialAction,
        targetYear,
        actionContext,
      });
    },
    [openContractModal, setSelectedPlayerSafe, setSelectedRulesYear]
  );

  type CapAuditedMutationLocalStateBoundary =
    | typeof BASE_LOCAL_VALIDATED_CAP_AUDIT_STREAM
    | typeof WORLD_OPTIMISTIC_PREVIEW_CAP_AUDIT_STREAM;
  type CapAuditedMutationLocalStateKind =
    CapAuditedMutationLocalStateBoundary['stateKind'];
  type PreparedCapAuditedMutationBoundary = {
    operationId: string;
    storageKey: string;
    localStateKind: CapAuditedMutationLocalStateKind;
    auditLifecycleState: LocalCapAuditLifecycleState;
    beforeTeamSnapshot: CapSheet;
    afterTeamSnapshot: CapSheet;
    beforeTeamsByCode: TeamsByCode;
    afterTeamsByCode: TeamsByCode;
    auditEvent: CapAuditEventV1Like;
    auditEvaluation: ReturnType<typeof buildCapAuditEvaluation>;
    applyNonAuthoritativeState: () => void;
    linkCommittedPersistSuccess: (result: PersistMutationResult) => void;
    rollbackOptimisticLocalState: () => void;
  };

  /**
   * Dashboard non-authoritative mutation boundary.
   * - `local-validated-apply`: validated local state with no world write.
   * - `optimistic-local-preview`: temporary local state while world persistence
   *   is pending; rollback stays here until committed-world reload resumes.
   */
  const prepareCapAuditedMutationBoundary = useCallback(
    (params: {
      mutationType: string;
      playerIds?: string[];
      computeNextTeam: (beforeTeam: CapSheet) => CapSheet;
      yearOverride?: number;
    }): PreparedCapAuditedMutationBoundary => {
      const {
        mutationType,
        playerIds = [],
        computeNextTeam,
        yearOverride = currentYear,
      } = params;
      const auditStreamBoundary: CapAuditedMutationLocalStateBoundary = worldId
        ? WORLD_OPTIMISTIC_PREVIEW_CAP_AUDIT_STREAM
        : BASE_LOCAL_VALIDATED_CAP_AUDIT_STREAM;
      const beforeTeamSnapshot = safeCloneForAudit(teamCapSheet as CapSheet);
      const afterTeamSnapshot = safeCloneForAudit(
        computeNextTeam(safeCloneForAudit(beforeTeamSnapshot))
      );
      const operationId = generateLocalOperationId();
      const occurredAt = new Date().toISOString();
      const beforeTeamsByCode: TeamsByCode = {
        [teamCode]: beforeTeamSnapshot,
      };
      const afterTeamsByCode: TeamsByCode = {
        [teamCode]: afterTeamSnapshot,
      };
      const auditEvaluation = buildCapAuditEvaluation({
        operationId,
        occurredAt,
        mutationType,
        worldId,
        year: yearOverride,
        teamCodes: [teamCode],
        playerIds: playerIds.filter(Boolean).map(String),
        beforeTeamsByCode,
        afterTeamsByCode,
        preview: auditStreamBoundary.preview,
        authoritativeEventLinked:
          auditStreamBoundary.initialAuthoritativeEventLinked,
      });
      const auditLifecycleState: LocalCapAuditLifecycleState = !auditEvaluation
        .validation.valid
        ? 'evaluation-blocked'
        : auditStreamBoundary.stateKind === 'local-validated-apply'
          ? 'local-validated-applied'
          : 'optimistic-preview-pending';
      const auditEvent = withLocalCapAuditLifecycleState(
        auditEvaluation.event,
        auditLifecycleState
      );
      const storageKey = auditStreamBoundary.storageKey;

      return {
        operationId,
        storageKey,
        localStateKind: auditStreamBoundary.stateKind,
        auditLifecycleState,
        beforeTeamSnapshot,
        afterTeamSnapshot,
        beforeTeamsByCode,
        afterTeamsByCode,
        auditEvent,
        auditEvaluation,
        applyNonAuthoritativeState: () => {
          setTeamCapSheetSafe(afterTeamSnapshot);
        },
        linkCommittedPersistSuccess: (result) => {
          const authoritativeOperationId = String(
            result?.event?.operationId || operationId
          );
          updateLocalCapAuditEvent(
            operationId,
            buildAuthoritativeLinkEstablishedAuditPatch(
              authoritativeOperationId
            ),
            {
              storageKey,
            }
          );
        },
        rollbackOptimisticLocalState: () => {
          setTeamCapSheetSafe(beforeTeamSnapshot);
          const didUpdatePreview = updateLocalCapAuditEvent(
            operationId,
            buildPersistFailedRolledBackAuditPatch(),
            {
              storageKey,
            }
          );

          if (!didUpdatePreview) {
            appendLocalCapAuditEvent(
              {
                ...auditEvent,
                ...buildPersistFailedRolledBackAuditPatch(),
              },
              {
                storageKey,
              }
            );
          }
        },
      };
    },
    [currentYear, setTeamCapSheetSafe, teamCapSheet, teamCode, worldId]
  );

  // === Persistence Helper ===
  type PersistMutationOptions = {
    operationId?: string;
    seasonIdOverride?: string;
    onSuccess?: (result: PersistMutationResult) => void;
    onFailure?: (message: string, result?: PersistMutationResult) => void;
  };

  const evaluateMutationTruth = useCallback(
    (
      mutationType: string,
      result: MutationTruthResult,
      options: { requireWorldPersistence: boolean }
    ): {
      ok: boolean;
      message: string;
      appliedToLocalState: boolean;
      persistedToWorld: boolean;
    } => {
      const writesSummary = result?.writesSummary;
      const summaryBackedApplyCheck =
        Number(writesSummary?.teamsPatched || 0) > 0 ||
        Number(writesSummary?.playersPatched || 0) > 0 ||
        Number(writesSummary?.entitlementsPatched || 0) > 0;
      const hasApplySummary =
        writesSummary?.teamsPatched !== undefined ||
        writesSummary?.playersPatched !== undefined ||
        writesSummary?.entitlementsPatched !== undefined;
      const appliedToLocalState =
        result?.appliedToLocalState !== false &&
        (!hasApplySummary || summaryBackedApplyCheck);

      const hasPersistSummary =
        writesSummary?.eventsWritten !== undefined ||
        writesSummary?.worldMetadataPatched !== undefined ||
        writesSummary?.teamsPatched !== undefined;
      const summaryBackedPersistCheck =
        Number(writesSummary?.eventsWritten ?? 1) > 0 &&
        Number(writesSummary?.worldMetadataPatched ?? 1) > 0 &&
        Number(writesSummary?.teamsPatched ?? 1) > 0;
      const persistedToWorld = options.requireWorldPersistence
        ? result?.persistedToWorld !== false &&
          result?.skipped !== true &&
          (!hasPersistSummary || summaryBackedPersistCheck)
        : true;

      const ok =
        Boolean(result?.success) && appliedToLocalState && persistedToWorld;
      const fallbackError = `${mutationType} did not complete required world writes.`;
      const message = String(result?.error || fallbackError);

      return {
        ok,
        message,
        appliedToLocalState,
        persistedToWorld,
      };
    },
    []
  );

  /**
   * Persist mutation to Firestore if in world mode.
   * Skips persistence when worldId is null (base mode) or userId is missing.
   */
  const persistMutation = useCallback(
    async (
      mutationType: string,
      payload: ArchitectMutationPayload,
      options: PersistMutationOptions = {}
    ): Promise<PersistMutationResult> => {
      // Base mode: no persistence
      if (!worldId) {
        return { success: true, skipped: true };
      }
      // Cannot persist without userId
      if (!userId) {
        const message = '[Architect] Cannot save: missing userId';
        console.warn(message);
        options.onFailure?.(message);
        return { success: false, error: message };
      }

      try {
        console.log(`💾 Saving ${mutationType}...`);
        const effectiveSeasonId = options.seasonIdOverride || seasonId;
        const result = (await applyWorldMutation({
          userId,
          worldId,
          seasonId: effectiveSeasonId,
          mutationType,
          payload,
          operationId: options.operationId,
        })) as PersistMutationResult;

        const truth = evaluateMutationTruth(mutationType, result, {
          requireWorldPersistence: true,
        });
        const normalizedResult: PersistMutationResult = {
          ...result,
          success: truth.ok,
          error: truth.ok ? result?.error : truth.message,
          appliedToLocalState: truth.appliedToLocalState,
          persistedToWorld: truth.persistedToWorld,
        };

        if (truth.ok) {
          console.log(`✅ Saved ${mutationType}!`, result);
          toast.success('Saved changes');
          options.onSuccess?.(normalizedResult);
        } else {
          console.error(`❌ Save failed:`, truth.message);
          // E2 fix: Skip toast when onFailure callback handles error reporting
          // This prevents duplicate toasts when caller uses reportMutationError
          if (!options.onFailure) {
            toast.error(`Save failed: ${truth.message}`);
          }
          options.onFailure?.(
            truth.message || `Save failed for ${mutationType}`,
            normalizedResult
          );
        }

        return normalizedResult;
      } catch (err: unknown) {
        console.error('[Architect][PersistMutation] failed', {
          mutationType,
          payload,
          err,
        });
        // E2 fix: Skip toast when onFailure callback handles error reporting
        if (!options.onFailure) {
          toast.error('Failed to save changes');
        }
        const message = 'Failed to save changes';
        options.onFailure?.(message);
        return { success: false, error: message };
      }
    },
    [evaluateMutationTruth, worldId, userId, seasonId]
  );

  const reportMutationError = useCallback(
    (message: string, details?: Record<string, unknown>): void => {
      console.error('[Architect][FreeAgency]', message, {
        teamCode,
        worldId,
        ...details,
      });
      toast.error(message);
    },
    [teamCode, worldId]
  );

  const getFreeAgencyWorldOnlyMessage = useCallback(
    (
      kind: FreeAgencyWorldOnlyActionKind,
      phase: FreeAgencyWorldOnlyActionPhase
    ): string => getFreeAgencyWorldOnlyRequirement(kind, phase).message,
    []
  );

  const requireActiveWorldForFreeAgencyWorldOnlyCommit = useCallback(
    (
      kind: FreeAgencyWorldOnlyActionKind,
      details?: Record<string, unknown>
    ): string | null => {
      if (worldId) {
        return null;
      }

      const message = getFreeAgencyWorldOnlyMessage(kind, 'commit');
      reportMutationError(message, details);
      return message;
    },
    [getFreeAgencyWorldOnlyMessage, reportMutationError, worldId]
  );

  const buildBlockedWorldOnlySignAndTradePreflightResult = useCallback(
    (): SignAndTradePreflightResult =>
      buildBlockedSignAndTradePreflightResult(
        getFreeAgencyWorldOnlyMessage('signAndTrade', 'preview')
      ),
    [getFreeAgencyWorldOnlyMessage]
  );

  const buildBlockedWorldOnlyOfferSheetPreflightResult = useCallback(
    (): OfferSheetPreflightResult =>
      buildOfferSheetPreflightResult(
        'blocked',
        getFreeAgencyWorldOnlyMessage('offerSheetCreation', 'preview')
      ),
    [getFreeAgencyWorldOnlyMessage]
  );

  const resolveCommittedWorldTeamSnapshot = useCallback(
    async (
      result: PersistMutationResult
    ): Promise<ResolvedCommittedWorldTeam | null> => {
      // Preferred committed-mutation order:
      // 1. Reuse the authoritative changedTeams snapshot when it already
      //    includes the active team.
      // 2. Otherwise reload through the read stack to recover a committed
      //    snapshot instead of reconstructing local fallback logic here.
      const changedTeam = findCommittedTeamSnapshot(
        result?.changedTeams,
        teamCode
      );
      const dashboardChangedTeam =
        buildGeneralMutationDashboardReloadTeamSnapshot(changedTeam);

      if (dashboardChangedTeam) {
        return {
          propagationMode: 'world-committed',
          committedTeam: toDashboardCommittedTeamSnapshot(dashboardChangedTeam),
          committedTeamSource: 'changedTeams',
        };
      }

      if (!worldId) {
        return null;
      }

      // Post-commit UI reloads intentionally re-enter through the dashboard
      // adapter instead of rebuilding world/base fallback logic locally.
      const reloadedTeam = await loadWorldTeamData(worldId, teamCode);
      if (!reloadedTeam) {
        return null;
      }

      return {
        propagationMode: 'world-committed',
        committedTeam: reloadedTeam as DashboardCommittedTeamSnapshot,
        committedTeamSource: 'reload',
      };
    },
    [teamCode, worldId]
  );

  const shouldRefreshWorldRosterAfterMutation = useCallback(
    (mutationType: string): boolean => {
      switch (mutationType) {
        case 'storeOfferSheet':
        case 'matchOfferSheet':
        case 'declineOfferSheet':
          return false;
        default:
          return true;
      }
    },
    []
  );

  const buildCommittedWorldReloadPlan = useCallback(
    async (
      mutationType: string,
      result: PersistMutationResult
    ): Promise<CommittedWorldReloadPlan | null> => {
      const committedWorldTeam =
        await resolveCommittedWorldTeamSnapshot(result);

      if (!committedWorldTeam) {
        return null;
      }

      return {
        committedWorldTeam,
        committedWorldMetadata: extractCommittedWorldMetadataPatch(result),
        refreshRosterBundle:
          shouldRefreshWorldRosterAfterMutation(mutationType),
      };
    },
    [resolveCommittedWorldTeamSnapshot, shouldRefreshWorldRosterAfterMutation]
  );

  const applyCommittedWorldReloadPlan = useCallback(
    async (
      plan: CommittedWorldReloadPlan
    ): Promise<CommittedWorldReloadResult> => {
      // Committed-world ownership resumes here after successful persistence.
      if (reloadActiveWorldTeamData && worldId) {
        const reloadedWorldTeam = await reloadActiveWorldTeamData({
          committedTeamSnapshot: plan.committedWorldTeam.committedTeam,
          committedTeamSource: plan.committedWorldTeam.committedTeamSource,
          committedWorldMetadata: plan.committedWorldMetadata,
          refreshRosterBundle: plan.refreshRosterBundle,
        });

        if (!reloadedWorldTeam || reloadedWorldTeam.outcome === 'stale-drop') {
          return { status: 'stale-drop' };
        }

        return {
          status: 'applied',
          committedWorldTeam: {
            propagationMode: 'world-committed',
            committedTeam: reloadedWorldTeam.committedWorldTeam.committedTeam,
            committedTeamSource:
              reloadedWorldTeam.committedWorldTeam.committedTeamSource,
          },
        };
      }

      setTeamCapSheet(plan.committedWorldTeam.committedTeam);

      if (plan.refreshRosterBundle) {
        try {
          await refreshWorldRosterIndex();
        } catch (error) {
          console.warn(
            `[Architect][FreeAgency] Failed to refresh roster index after world reload plan:`,
            error
          );
        }
      }

      return {
        status: 'applied',
        committedWorldTeam: plan.committedWorldTeam,
      };
    },
    [
      refreshWorldRosterIndex,
      reloadActiveWorldTeamData,
      setTeamCapSheetSafe,
      worldId,
    ]
  );

  const applyCommittedWorldReload = useCallback(
    async (
      mutationType: string,
      committedWorldTeam: CommittedWorldReloadSeed
    ): Promise<CommittedWorldReloadResult> => {
      return applyCommittedWorldReloadPlan({
        committedWorldTeam: {
          propagationMode: 'world-committed',
          committedTeam: committedWorldTeam.committedTeam,
          committedTeamSource: committedWorldTeam.committedTeamSource,
        },
        committedWorldMetadata: null,
        refreshRosterBundle:
          shouldRefreshWorldRosterAfterMutation(mutationType),
      });
    },
    [applyCommittedWorldReloadPlan, shouldRefreshWorldRosterAfterMutation]
  );

  const syncTeamFromMutationResult = useCallback(
    async (
      mutationType: string,
      result: PersistMutationResult
    ): Promise<void> => {
      const committedWorldReloadPlan = await buildCommittedWorldReloadPlan(
        mutationType,
        result
      );

      if (!committedWorldReloadPlan) {
        return;
      }

      await applyCommittedWorldReloadPlan(committedWorldReloadPlan);
    },
    [applyCommittedWorldReloadPlan, buildCommittedWorldReloadPlan]
  );

  const runAuthoritativeFAMutation = useCallback(
    async (
      mutationType: string,
      payload: ArchitectMutationPayload,
      options: {
        worldRequiredMessage?: string;
        seasonIdOverride?: string;
      } = {}
    ): Promise<PersistMutationResult> => {
      if (!worldId) {
        const message =
          options.worldRequiredMessage ||
          'This action requires an active world to commit.';
        reportMutationError(message, { mutationType, payload });
        return { success: false, error: message };
      }

      if (!userId) {
        const message = 'Cannot save changes: missing user identity.';
        reportMutationError(message, { mutationType, payload });
        return { success: false, error: message };
      }

      startSave();
      try {
        const rawResult = (await applyWorldMutation({
          userId,
          worldId,
          seasonId: options.seasonIdOverride || seasonId,
          mutationType,
          payload,
        })) as PersistMutationResult;

        const truth = evaluateMutationTruth(mutationType, rawResult, {
          requireWorldPersistence: true,
        });
        const result: PersistMutationResult = {
          ...rawResult,
          success: truth.ok,
          error: truth.ok
            ? rawResult?.error
            : truth.message || `Failed to run ${mutationType} mutation.`,
          appliedToLocalState: truth.appliedToLocalState,
          persistedToWorld: truth.persistedToWorld,
        };

        if (!result.success) {
          const message = result.error as string;
          reportMutationError(message, {
            mutationType,
            payload,
            result: rawResult,
          });
          finishSave(message);
          return result;
        }

        await syncTeamFromMutationResult(mutationType, result);
        toast.success('Saved changes');
        finishSave();
        return result;
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : `Failed to run ${mutationType} mutation.`;
        reportMutationError(message, { mutationType, payload, error });
        finishSave(message);
        return { success: false, error: message };
      }
    },
    [
      finishSave,
      reportMutationError,
      startSave,
      syncTeamFromMutationResult,
      userId,
      worldId,
      evaluateMutationTruth,
      seasonId,
    ]
  );

  /**
   * Shared world-mutation sync lane for non-Free Agency surfaces.
   * Trade apply re-enters through this helper so the trade wrapper/action seam
   * does not read like it owns post-commit reload or dashboard state writes.
   */
  const runAuthoritativeWorldMutationWithDashboardSync = useCallback(
    async (
      mutationType: string,
      payload: ArchitectMutationPayload,
      options: {
        worldRequiredMessage?: string;
        seasonIdOverride?: string;
      } = {}
    ): Promise<PersistMutationResult> =>
      runAuthoritativeFAMutation(mutationType, payload, options),
    [runAuthoritativeFAMutation]
  );

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
          teamCode,
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
          teamCode,
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
          teamCode,
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
          teamCode,
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
    teamCode,
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
    teamCode,
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
    teamCode,
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
