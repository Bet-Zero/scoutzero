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

  const handleStoreOfferSheet = useCallback(
    async (
      playerObj: ArchitectPlayer,
      contract: SigningDetails
    ): Promise<MutationActionResult> => {
      const worldRequiredMessage =
        requireActiveWorldForFreeAgencyWorldOnlyCommit('offerSheetCreation', {
          playerObj,
        });
      if (worldRequiredMessage) {
        return {
          success: false,
          message: worldRequiredMessage,
        };
      }

      const creationDefinition = prepareOfferSheetCreationDefinition(
        playerObj,
        contract
      );
      if (isOfferSheetCreationDefinitionFailure(creationDefinition)) {
        reportMutationError(
          creationDefinition.storeMessage,
          creationDefinition.logContext
        );
        return {
          success: false,
          message: creationDefinition.storeMessage,
        };
      }

      const result = await executeWorldModeOfferSheetStore(
        creationDefinition.actionSeasonContext,
        creationDefinition.mutationPayload
      );

      if (result.success !== true) {
        return {
          success: false,
          message: result.message,
        };
      }

      try {
        await applyCommittedOfferSheetState(
          result.committedTeam,
          result.committedTeamSource
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Offer sheet saved but the committed team state could not be applied.';
        reportMutationError(message, {
          mutationType: 'storeOfferSheet',
          playerId: creationDefinition.mutationPayload.playerId,
          error,
        });
        return {
          success: false,
          message,
        };
      }

      return { success: true };
    },
    [
      applyCommittedOfferSheetState,
      executeWorldModeOfferSheetStore,
      prepareOfferSheetCreationDefinition,
      requireActiveWorldForFreeAgencyWorldOnlyCommit,
      reportMutationError,
    ]
  );

  const runOfferSheetResolutionAction = useCallback(
    (
      action: OfferSheetResolutionAction,
      offeringTeamCode: string,
      offerSheetId: string
    ): void => {
      const mutationType: OfferSheetResolutionMutationType =
        action === 'match' ? 'matchOfferSheet' : 'declineOfferSheet';
      const actionLabel = action === 'match' ? 'match' : 'decline';

      void (async () => {
        const worldRequiredMessage =
          requireActiveWorldForFreeAgencyWorldOnlyCommit(
            'offerSheetLifecycle',
            {
              offeringTeamCode,
              offerSheetId,
              action,
            }
          );
        if (worldRequiredMessage) {
          return;
        }

        if (!offeringTeamCode || !offerSheetId) {
          reportMutationError(
            `Cannot ${actionLabel} offer sheet: missing offering team or offer sheet ID.`,
            {
              offeringTeamCode,
              offerSheetId,
              action,
            }
          );
          return;
        }

        const expectation: OfferSheetLifecycleCommittedStateExpectation = {
          activeTeamArrayKey: 'incomingOfferSheets',
          presence: 'present',
          identity: {
            offerSheetId,
            offeringTeamCode,
            homeTeamCode: teamCode,
            status: action === 'match' ? 'MATCHED' : 'DECLINED',
          },
        };

        await executeWorldModeOfferSheetLifecycleMutation(
          mutationType,
          {
            teamCode,
            offeringTeamCode,
            offerSheetId,
          },
          expectation
        );
      })();
    },
    [
      executeWorldModeOfferSheetLifecycleMutation,
      requireActiveWorldForFreeAgencyWorldOnlyCommit,
      reportMutationError,
      teamCode,
    ]
  );

  const resolveOfferSheetFinalizeMutationRoute = useCallback(
    (
      offerSheet: OfferSheet | null | undefined
    ): OfferSheetFinalizeMutationRoute => {
      if (!offerSheet) {
        return {
          ok: false,
          message: 'Cannot finalize offer sheet: offer sheet data is missing.',
        };
      }

      if (!offerSheet.id) {
        return {
          ok: false,
          message: 'Cannot finalize offer sheet: missing offer sheet ID.',
          logContext: {
            offerSheet,
          },
        };
      }

      if (
        offerSheet.status === 'MATCHED' &&
        offerSheet.homeTeamCode === teamCode
      ) {
        return {
          ok: true,
          mutationType: 'finalizeMatchedOfferSheet',
          payload: {
            teamCode,
            offeringTeamCode: offerSheet.offeringTeamCode,
            offerSheetId: offerSheet.id,
          },
        };
      }

      if (
        offerSheet.status === 'DECLINED' &&
        offerSheet.offeringTeamCode === teamCode
      ) {
        return {
          ok: true,
          mutationType: 'finalizeDeclinedOfferSheet',
          payload: {
            teamCode,
            offeringTeamCode: teamCode,
            homeTeamCode: offerSheet.homeTeamCode,
            offerSheetId: offerSheet.id,
            dedupKey: offerSheet.dedupKey,
            playerId: offerSheet.playerId,
            seasonKey: offerSheet.seasonKey,
          },
        };
      }

      return {
        ok: false,
        message: `Cannot finalize offer sheet: status/team mismatch (status=${offerSheet.status || 'unknown'}).`,
        logContext: {
          offerSheet,
        },
      };
    },
    [teamCode]
  );

  const handleMatchOfferSheet = useCallback(
    (offeringTeamCode: string, offerSheetId: string): void => {
      runOfferSheetResolutionAction('match', offeringTeamCode, offerSheetId);
    },
    [runOfferSheetResolutionAction]
  );

  const handleDeclineOfferSheet = useCallback(
    (offeringTeamCode: string, offerSheetId: string): void => {
      runOfferSheetResolutionAction('decline', offeringTeamCode, offerSheetId);
    },
    [runOfferSheetResolutionAction]
  );

  const handleFinalizeOfferSheet = useCallback(
    (offerSheet: OfferSheet | null | undefined): void => {
      void (async () => {
        const worldRequiredMessage =
          requireActiveWorldForFreeAgencyWorldOnlyCommit(
            'offerSheetLifecycle',
            {
              offerSheet,
            }
          );
        if (worldRequiredMessage) {
          return;
        }

        const finalizeRoute =
          resolveOfferSheetFinalizeMutationRoute(offerSheet);
        if ('message' in finalizeRoute) {
          reportMutationError(finalizeRoute.message, finalizeRoute.logContext);
          return;
        }

        const expectation: OfferSheetLifecycleCommittedStateExpectation =
          finalizeRoute.mutationType === 'finalizeMatchedOfferSheet'
            ? {
                activeTeamArrayKey: 'incomingOfferSheets',
                presence: 'absent',
                identity: {
                  offerSheetId: finalizeRoute.payload.offerSheetId,
                  offeringTeamCode: finalizeRoute.payload.offeringTeamCode,
                  homeTeamCode: teamCode,
                },
              }
            : {
                activeTeamArrayKey: 'offerSheets',
                presence: 'absent',
                identity: {
                  offerSheetId: finalizeRoute.payload.offerSheetId,
                  dedupKey: finalizeRoute.payload.dedupKey,
                  playerId: finalizeRoute.payload.playerId,
                  seasonKey: finalizeRoute.payload.seasonKey,
                  offeringTeamCode: finalizeRoute.payload.offeringTeamCode,
                  homeTeamCode: finalizeRoute.payload.homeTeamCode,
                },
              };

        await executeWorldModeOfferSheetLifecycleMutation(
          finalizeRoute.mutationType,
          finalizeRoute.payload,
          expectation
        );
      })();
    },
    [
      executeWorldModeOfferSheetLifecycleMutation,
      requireActiveWorldForFreeAgencyWorldOnlyCommit,
      reportMutationError,
      resolveOfferSheetFinalizeMutationRoute,
      teamCode,
    ]
  );

  const runManualCapSheetLedgerMutation = useCallback(
    (params: ManualCapSheetLedgerMutationParams): Promise<boolean> => {
      const normalizedExceptions =
        params.type === 'exceptions'
          ? normalizeManualExceptionsForMutation(params.exceptions)
          : null;
      const mutationConfig =
        params.type === 'deadCap'
          ? {
              mutationType: 'setDeadCap',
              playerIds: [],
              invalidMessage:
                'Dead cap update blocked by post-state cap validation.',
              computeNextTeam: (beforeTeam: CapSheet) =>
                synchronizeTeamTotalsSnapshot(
                  {
                    ...beforeTeam,
                    deadCap: params.deadCap,
                  },
                  currentYear
                ) as CapSheet,
              persistPayload: {
                teamCode,
                deadCap: params.deadCap,
              },
            }
          : {
              mutationType: 'setExceptions',
              playerIds: [],
              invalidMessage:
                'Exception update blocked by post-state cap validation.',
              computeNextTeam: (beforeTeam: CapSheet) =>
                synchronizeTeamTotalsSnapshot(
                  {
                    ...beforeTeam,
                    exceptions: mergeManualExceptionSnapshot(
                      beforeTeam.exceptions as Record<string, unknown> | null,
                      normalizedExceptions as Record<string, unknown> | null
                    ) as NonNullable<CapSheet['exceptions']>,
                  },
                  currentYear
                ) as CapSheet,
              persistPayload: {
                teamCode,
                exceptions: normalizedExceptions,
              },
            };
      const mutationResult = applyCapAuditedTeamMutation(mutationConfig);
      if (!mutationResult.applied) {
        return Promise.resolve(false);
      }
      return mutationResult.persistPromise || Promise.resolve(true);
    },
    [applyCapAuditedTeamMutation, currentYear, teamCode]
  );

  // === Dead Money Actions (Phase 24) ===
  const handleSetDeadCap = useCallback(
    (deadCap: DeadCapEntry[]): Promise<boolean> =>
      runManualCapSheetLedgerMutation({
        type: 'deadCap',
        deadCap,
      }),
    [runManualCapSheetLedgerMutation]
  );

  // === Exception Management Actions (Phase 27) ===
  const handleSetExceptions = useCallback(
    (exceptions: ManualExceptionsSavePayload): Promise<boolean> =>
      runManualCapSheetLedgerMutation({
        type: 'exceptions',
        exceptions,
      }),
    [runManualCapSheetLedgerMutation]
  );

  const hasInjectedCapSheetFixtures = useMemo(
    () => hasInjectedCapSheetFixturesInTeam(teamCapSheet),
    [teamCapSheet]
  );

  const applyLocalDevCapSheetFixtureState = useCallback(
    (operation: 'inject' | 'clear'): MutationActionResult => {
      if (!import.meta.env.DEV) {
        return {
          success: false,
          message:
            'Cap sheet DEV fixtures are only available in local DEV builds.',
        };
      }

      if (!teamCapSheet) {
        return {
          success: false,
          message: `Cannot ${operation} fixtures: team state is not loaded.`,
        };
      }

      const nextTeam =
        operation === 'inject'
          ? injectCapSheetFixtures(teamCapSheet, currentYear)
          : clearCapSheetFixtures(teamCapSheet);

      // Local DEV seam only: fixture players never enter mutation persistence.
      setTeamCapSheetSafe(nextTeam as CapSheet);
      return { success: true };
    },
    [currentYear, setTeamCapSheetSafe, teamCapSheet]
  );

  const injectCapSheetDevFixtures = useCallback(
    (): MutationActionResult => applyLocalDevCapSheetFixtureState('inject'),
    [applyLocalDevCapSheetFixtureState]
  );

  const clearCapSheetDevFixtures = useCallback(
    (): MutationActionResult => applyLocalDevCapSheetFixtureState('clear'),
    [applyLocalDevCapSheetFixtureState]
  );

  const capSheetDevTools = useMemo<CapSheetDevTools>(
    () => ({
      injectLocalFixtures: injectCapSheetDevFixtures,
      clearLocalFixtures: clearCapSheetDevFixtures,
      hasInjectedLocalFixtures: hasInjectedCapSheetFixtures,
      localStateOwner: DEV_CAP_SHEET_FIXTURE_LOCAL_STATE_OWNER,
      syntheticCoverageBoundary: DEV_CAP_SHEET_FIXTURE_BOUNDARY,
      runtimeBoundary: DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY,
      injectFixtures: injectCapSheetDevFixtures,
      clearFixtures: clearCapSheetDevFixtures,
      hasInjectedFixtures: hasInjectedCapSheetFixtures,
    }),
    [
      clearCapSheetDevFixtures,
      hasInjectedCapSheetFixtures,
      injectCapSheetDevFixtures,
    ]
  );

  const hasInjectedTeamHistoryFixtures = useMemo(
    () => hasInjectedTeamHistoryFixturesInTeam(teamCapSheet ?? null),
    [teamCapSheet]
  );

  const injectTeamHistoryDevFixtures = useCallback((): MutationActionResult => {
    if (!teamCapSheet) {
      return {
        success: false,
        message:
          'Cannot inject Team History fixtures: team state is not loaded.',
      };
    }

    const nextTeam = injectTeamHistoryFixtures(teamCapSheet);
    setTeamCapSheetSafe(nextTeam as CapSheet);
    return { success: true };
  }, [setTeamCapSheetSafe, teamCapSheet]);

  const clearTeamHistoryDevFixtures = useCallback((): MutationActionResult => {
    if (!teamCapSheet) {
      return {
        success: false,
        message:
          'Cannot clear Team History fixtures: team state is not loaded.',
      };
    }

    const nextTeam = clearTeamHistoryFixtures(teamCapSheet);
    setTeamCapSheetSafe(nextTeam as CapSheet);
    return { success: true };
  }, [setTeamCapSheetSafe, teamCapSheet]);

  const teamHistoryDevTools = useMemo<TeamHistoryDevTools>(
    () => ({
      injectFixtures: injectTeamHistoryDevFixtures,
      clearFixtures: clearTeamHistoryDevFixtures,
      hasInjectedFixtures: hasInjectedTeamHistoryFixtures,
    }),
    [
      clearTeamHistoryDevFixtures,
      hasInjectedTeamHistoryFixtures,
      injectTeamHistoryDevFixtures,
    ]
  );

  const handleEditContract = useCallback(
    (
      player: PlayerRulesProfileInput | ArchitectDashboardPlayer | ArchitectPlayer
    ): void => {
      openPlayerContractModalRoute({
        player: player as PlayerRulesProfileInput | ArchitectPlayer,
        rulesYear: currentYear,
        initialAction: null,
        targetYear: null,
        actionContext: null,
      });
    },
    [currentYear, openPlayerContractModalRoute]
  );

  // Shared helper for renounce confirmation and execution
  // Now directly updates teamCapSheet instead of using capSheetState
  const confirmAndRenounceRights = useCallback(
    async (
      playerOrHold: RenounceActionTarget,
      overrideMetadata?: OverrideMetadata | null
    ): Promise<MutationActionResult> => {
      const playerName = getRenounceTargetDisplayName(playerOrHold);

      if (
        !window.confirm(
          `Are you sure you want to renounce rights to ${playerName}? This will clear their cap hold.`
        )
      ) {
        return {
          success: false,
          message: 'Action canceled. No changes were saved.',
        };
      }

      const candidateIdSet = new Set<string>();
      const candidateNameSet = new Set<string>();
      const collectCandidate = (value: unknown): void => {
        const trimmed = String(value || '').trim();
        if (trimmed) {
          candidateIdSet.add(trimmed);
        }
        const normalized = normalizeEntityIdentity(value);
        if (normalized) {
          candidateNameSet.add(normalized);
        }
      };

      for (const candidateValue of getRenounceTargetCandidateValues(
        playerOrHold
      )) {
        collectCandidate(candidateValue);
      }

      const idToRenounce = getRenounceTargetPrimaryId(playerOrHold);

      // Persist to world if in world mode
      if (!idToRenounce) {
        console.error('Renounce missing playerId');
        toast.error('Cannot save: Player ID missing');
        return { success: false, message: 'Cannot save: Player ID missing.' };
      }

      const matchesHold = (hold: CapHold): boolean => {
        const holdId = String(hold?.playerId || '').trim();
        return (
          (holdId && candidateIdSet.has(holdId)) ||
          candidateNameSet.has(normalizeEntityIdentity(hold?.playerName)) ||
          candidateNameSet.has(normalizeEntityIdentity(holdId))
        );
      };
      const isPlayerRenounceable = (player: ArchitectPlayer): boolean => {
        const playerBirdStatus = String(
          player.contract?.birdRights?.status || ''
        ).toLowerCase();
        const rightsAlreadyCleared =
          Boolean(player.rightsRenounced) &&
          (!playerBirdStatus || playerBirdStatus === 'none');
        return !rightsAlreadyCleared;
      };
      const matchesPlayer = (player: ArchitectPlayer): boolean => {
        const playerId = String(player?.id || '').trim();
        const playerAltId = String(player?.player_id || '').trim();
        return (
          (playerId && candidateIdSet.has(playerId)) ||
          (playerAltId && candidateIdSet.has(playerAltId)) ||
          candidateNameSet.has(normalizeEntityIdentity(player?.name)) ||
          candidateNameSet.has(normalizeEntityIdentity(player?.displayName))
        );
      };

      const hasRemovableHold = (teamCapSheet?.capHolds || []).some((hold) =>
        matchesHold(hold as CapHold)
      );
      const hasRenounceablePlayer = (teamCapSheet?.players || []).some(
        (player) =>
          matchesPlayer(player as ArchitectPlayer) &&
          isPlayerRenounceable(player as ArchitectPlayer)
      );
      if (!hasRemovableHold && !hasRenounceablePlayer) {
        const message =
          'No matching cap hold or renounceable rights were found for this player.';
        reportMutationError(message, {
          playerName,
          idToRenounce,
          candidateIds: Array.from(candidateIdSet),
        });
        return { success: false, message };
      }

      const mutationResult = applyCapAuditedTeamMutation({
        mutationType: 'renounceRights',
        playerIds: [String(idToRenounce)],
        invalidMessage: 'Renounce rights blocked by post-state cap validation.',
        computeNextTeam: (beforeTeam) => {
          // Remove from capHolds array
          const updatedCapHolds = (beforeTeam.capHolds || []).filter(
            (h) => !matchesHold(h as CapHold)
          );

          // Update player object if it exists
          let rightsUpdates = 0;
          const updatedPlayers = (beforeTeam.players || []).map((p) => {
            if (matchesPlayer(p as ArchitectPlayer)) {
              let playerChanged = false;
              const updated: ArchitectPlayer = { ...p };
              if (!updated.rightsRenounced) {
                updated.rightsRenounced = true;
                playerChanged = true;
              }
              const currentStatus = String(
                updated.contract?.birdRights?.status || ''
              ).toLowerCase();
              if (updated.contract?.birdRights && currentStatus !== 'none') {
                updated.contract = {
                  ...updated.contract,
                  birdRights: {
                    ...updated.contract.birdRights,
                    status: 'None',
                  },
                };
                playerChanged = true;
              }
              if (playerChanged) {
                rightsUpdates += 1;
              }
              return updated;
            }
            return p;
          });

          const removedHoldsCount =
            (beforeTeam.capHolds || []).length - updatedCapHolds.length;
          if (removedHoldsCount === 0 && rightsUpdates === 0) {
            return beforeTeam;
          }

          // Record override audit log if override was used
          const overrideAuditLog = overrideMetadata?.overrideUsed
            ? recordOverrideAudit(
                beforeTeam,
                'renounce',
                overrideMetadata.overrideReasons || [],
                idToRenounce,
                playerName
              )
            : beforeTeam?.overrideAuditLog;

          return {
            ...beforeTeam,
            players: updatedPlayers,
            capHolds: updatedCapHolds,
            ...(overrideAuditLog ? { overrideAuditLog } : {}),
          };
        },
        persistPayload: {
          teamCode,
          playerId: idToRenounce,
        },
      });

      return finalizeCapMutationResult(
        mutationResult,
        'Failed to save renounce action. Please try again.'
      );
    },
    [
      applyCapAuditedTeamMutation,
      finalizeCapMutationResult,
      reportMutationError,
      teamCapSheet,
      teamCode,
    ]
  );

  const handleCapTableModalAction = useCallback(
    (
      player: PlayerRulesProfileInput,
      actionType: CapSheetModalActionType,
      year: number
    ): void => {
      const contextMap: Record<CapSheetModalActionType, ActionContext> = {
        po: 'option',
        to: 'option',
        ufa: 'freeAgent',
        rfa: 'freeAgent',
      };

      openPlayerContractModalRoute({
        player,
        rulesYear: year || currentYear,
        initialAction: null,
        targetYear: year,
        actionContext: contextMap[actionType],
      });
    },
    [currentYear, openPlayerContractModalRoute]
  );

  const handleCapHoldRenounce = useCallback(
    (capHold: CapHoldActionItem): void => {
      void confirmAndRenounceRights(capHold);
    },
    [confirmAndRenounceRights]
  );

  // handleExtendContract - directly updates teamCapSheet
  const handleExtendContract = useCallback(
    async (
      player: ArchitectPlayer,
      extensionContract: SigningDetails
    ): Promise<MutationActionResult> => {
      const playerId = player.id || player.player_id || player.name;
      if (!playerId) {
        console.error('Extend player missing playerId', { player });
        toast.error('Cannot save: Player ID missing');
        return { success: false, message: 'Cannot save: Player ID missing.' };
      }

      const mutationResult = applyCapAuditedTeamMutation({
        mutationType: 'extendPlayer',
        playerIds: [String(playerId)],
        invalidMessage: 'Extension blocked by post-state cap validation.',
        computeNextTeam: (beforeTeam) => {
          const updatedPlayers = (beforeTeam.players || []).map((p) => {
            if (
              p.id === playerId ||
              p.player_id === playerId ||
              p.name === playerId
            ) {
              // Add extension years to futureContract
              const futureContract = p.futureContract || {
                salariesByYear: [],
                extension: true,
              };

              const newYears: SalaryByYear[] = (
                extensionContract.salariesByYear || []
              ).map((y) => ({
                season: String(y.season || ''),
                salary: Number(y.salary ?? y.capHit ?? 0),
                capHit: Number(y.capHit ?? y.salary ?? 0),
                guaranteed: y.guaranteed ?? true,
                option: y.option ?? null,
                optionType: y.optionType ?? null,
                optionUsed: y.optionUsed ?? null,
                isExtensionSeason: true,
              }));

              return {
                ...p,
                futureContract: {
                  ...futureContract,
                  salariesByYear: [
                    ...(futureContract.salariesByYear || []),
                    ...newYears,
                  ],
                  extension: true,
                },
              };
            }
            return p;
          });

          // Record override audit log if override was used
          const overrideAuditLog = extensionContract.overrideUsed
            ? recordOverrideAudit(
                beforeTeam,
                'extend',
                extensionContract.overrideReasons || [],
                playerId,
                normalizeOptionalMutationString(
                  player.name || player.displayName
                )
              )
            : beforeTeam.overrideAuditLog;

          return {
            ...beforeTeam,
            players: updatedPlayers,
            ...(overrideAuditLog ? { overrideAuditLog } : {}),
          };
        },
        persistPayload: {
          teamCode,
          playerId,
          extension: {
            salariesByYear: extensionContract.salariesByYear || [],
          },
        },
      });

      return finalizeCapMutationResult(
        mutationResult,
        'Failed to save extension. Please try again.'
      );
    },
    [applyCapAuditedTeamMutation, finalizeCapMutationResult, teamCode]
  );

  // handleWaiveContract - directly updates teamCapSheet
  const handleWaiveContract = useCallback(
    async (
      player: ArchitectPlayer,
      options: WaiveOptions
    ): Promise<MutationActionResult> => {
      const { stretch, buyout, buyoutAmount, overrideUsed, overrideReasons } =
        options;
      const confirmMsg = stretch
        ? 'Waive and stretch this player?'
        : buyout
          ? 'Buy out this player?'
          : 'Waive this player?';
      if (!window.confirm(confirmMsg)) {
        return {
          success: false,
          message: 'Action canceled. No changes were saved.',
        };
      }

      const playerId = player.id || player.player_id || player.name;
      if (!playerId) {
        console.error('Waive missing playerId', { player });
        toast.error('Cannot save: Player ID missing');
        return { success: false, message: 'Cannot save: Player ID missing.' };
      }

      const normalizedBuyoutAmount = buyout
        ? Math.max(0, Number(buyoutAmount) || 0)
        : 0;

      const mutationResult = applyCapAuditedTeamMutation({
        mutationType: 'waivePlayer',
        playerIds: [String(playerId)],
        invalidMessage: 'Waive action blocked by post-state cap validation.',
        computeNextTeam: (beforeTeam) => {
          const rosterPlayer = (beforeTeam.players || []).find(
            (p) =>
              p.id === playerId ||
              p.player_id === playerId ||
              p.name === playerId
          );
          const contractRows: SalaryByYear[] =
            rosterPlayer?.contract?.salariesByYear ||
            player.contract?.salariesByYear ||
            [];

          // Calculate remaining guaranteed money from current/future rows.
          const remainingGuaranteed = contractRows
            .filter((y) => {
              const season = String(y.season);
              const yearEnd = /^\d{4}-\d{2}$/.test(season)
                ? 2000 + parseInt(season.split('-')[1], 10)
                : parseInt(season, 10);
              return yearEnd >= currentYear && y.guaranteed !== false;
            })
            .reduce((sum, y) => sum + Number(y.salary || 0), 0);

          const boundedBuyoutAmount = buyout
            ? Math.min(remainingGuaranteed, normalizedBuyoutAmount)
            : 0;

          // Buyout follows the same model in local + world paths:
          // dead cap equals remaining guaranteed minus buyout reduction amount.
          const deadCapAmount = buyout
            ? Math.max(0, remainingGuaranteed - boundedBuyoutAmount)
            : remainingGuaranteed;

          const shouldStretch = !!stretch && deadCapAmount > 0;
          const stretchYears = shouldStretch ? 3 : 1;
          const baseAmount = shouldStretch
            ? Math.floor(deadCapAmount / stretchYears)
            : deadCapAmount;
          const remainder = shouldStretch
            ? deadCapAmount - baseAmount * stretchYears
            : 0;

          const deadCapEntries =
            deadCapAmount > 0
              ? [
                  {
                    playerId: String(playerId),
                    playerName:
                      rosterPlayer?.displayName ||
                      rosterPlayer?.name ||
                      player.displayName ||
                      player.name ||
                      String(playerId),
                    originalSalary: remainingGuaranteed,
                    amountByYear: Array.from(
                      { length: stretchYears },
                      (_, index) => ({
                        season: toSeasonCode(currentYear + index),
                        amount:
                          shouldStretch && index < remainder
                            ? baseAmount + 1
                            : baseAmount,
                        isStretched: shouldStretch,
                      })
                    ),
                    waiveDate: new Date().toISOString(),
                    notes: buyout
                      ? `Buyout reduction: $${boundedBuyoutAmount.toLocaleString()}`
                      : shouldStretch
                        ? `Stretched over ${stretchYears} years`
                        : undefined,
                  },
                ]
              : [];

          const updatedPlayers = (beforeTeam.players || []).filter(
            (p) =>
              p.id !== playerId &&
              p.player_id !== playerId &&
              p.name !== playerId
          );

          const updatedRoster = (
            Array.isArray(beforeTeam.roster) ? beforeTeam.roster : []
          ).filter((id) => String(id) !== String(playerId));

          // Record override audit log if override was used
          const overrideAuditLog = overrideUsed
            ? recordOverrideAudit(
                beforeTeam,
                stretch ? 'waiveStretch' : buyout ? 'buyout' : 'waive',
                overrideReasons || [],
                playerId,
                normalizeOptionalMutationString(
                  player.name || player.displayName
                )
              )
            : beforeTeam.overrideAuditLog;

          return {
            ...beforeTeam,
            roster: updatedRoster,
            players: updatedPlayers,
            deadCap: [...(beforeTeam.deadCap || []), ...deadCapEntries],
            ...(overrideAuditLog ? { overrideAuditLog } : {}),
          };
        },
        persistPayload: {
          teamCode,
          playerId,
          stretch: !!stretch,
          stretchYears: stretch ? 3 : 0, // Default stretch years
          buyout: !!buyout,
          buyoutAmount: buyout ? normalizedBuyoutAmount : 0,
          isGracePeriod: false, // Default, UI doesn't currently expose this
        },
      });

      return finalizeCapMutationResult(
        mutationResult,
        'Failed to save waive/buyout action. Please try again.'
      );
    },
    [
      currentYear,
      applyCapAuditedTeamMutation,
      finalizeCapMutationResult,
      teamCode,
    ]
  );

  // handleOptionDecision - directly updates teamCapSheet and manages cap holds
  const handleOptionDecision = useCallback(
    async (
      player: ArchitectPlayer,
      accepted: boolean,
      overrideMetadata?: OverrideMetadata | null,
      targetYearOverride?: number | null
    ): Promise<MutationActionResult> => {
      const playerId = player.id || player.player_id || player.name;
      const yearSeasonContext = buildYearSeasonContext(
        targetYearOverride,
        currentYear + 1
      );
      const targetYear = yearSeasonContext.actionYear;
      if (!playerId) {
        console.error('Option decision missing playerId', { player });
        toast.error('Cannot save: Player ID missing');
        return { success: false, message: 'Cannot save: Player ID missing.' };
      }

      const mutationResult = applyCapAuditedTeamMutation({
        mutationType: 'optionDecision',
        playerIds: [String(playerId)],
        invalidMessage: 'Option decision blocked by post-state cap validation.',
        seasonIdOverride: yearSeasonContext.seasonId,
        yearOverride: yearSeasonContext.actionYear,
        computeNextTeam: (beforeTeam) => {
          let newCapHold: CapHold | null = null;

          const updatedPlayers = (beforeTeam.players || []).map((p) => {
            if (
              p.id === playerId ||
              p.player_id === playerId ||
              p.name === playerId
            ) {
              const salaries: SalaryByYear[] = p.contract?.salariesByYear || [];

              // Find the option year entry
              const optionIndex = salaries.findIndex((y) => {
                const season = String(y.season);
                const yearEnd = /^\d{4}-\d{2}$/.test(season)
                  ? 2000 + parseInt(season.split('-')[1], 10)
                  : parseInt(season, 10);
                return yearEnd === targetYear && y.option;
              });

              if (optionIndex === -1) {
                console.warn(`No option found for year ${targetYear}`);
                return p;
              }

              // Mark option as used (canonical boolean format)
              const updatedSalaries: SalaryByYear[] = [...salaries];
              updatedSalaries[optionIndex] = {
                ...updatedSalaries[optionIndex],
                optionUsed: accepted, // CANONICAL: boolean, not string
              };

              if (!accepted) {
                const optionSeason = salaries[optionIndex]?.season || null;
                const faYearInfo = deriveFreeAgencyYearFromOptionSeason(
                  optionSeason,
                  targetYear
                );
                const freeAgencyYear =
                  typeof faYearInfo.year === 'number'
                    ? faYearInfo.year
                    : targetYear - 1;

                // Declining: remove this year and all future years
                const filteredSalaries: SalaryByYear[] = salaries.filter(
                  (_, idx) => idx < optionIndex
                );

                // Calculate cap hold for declined option
                const priorRow = salaries[optionIndex - 1];
                const lastSalary = priorRow?.salary ?? priorRow?.capHit ?? 0;
                const rightsType = getRightsTypeFromPlayer(p);
                const capHoldResult = computeExpectedCapHoldAmount({
                  player: p,
                  lastSalary,
                  rules: null,
                  rightsType,
                });
                if (lastSalary > 0 && capHoldResult.amount) {
                  newCapHold = {
                    playerId: p.id || p.player_id || p.name || '',
                    playerName: p.displayName || p.name || '',
                    amount: capHoldResult.amount,
                    type: 'FA Cap Hold',
                    season: toSeasonCode(targetYear),
                    isSigned: false,
                    reason: capHoldResult.usedFallback
                      ? 'Declined Option (fallback multiplier)'
                      : 'Declined Option',
                    notes: capHoldResult.usedFallback
                      ? 'Fallback multiplier used due to missing/unsupported Bird rights type.'
                      : undefined,
                    active: true,
                  };
                }

                return {
                  ...p,
                  contract: {
                    ...(p.contract || {}),
                    salariesByYear: filteredSalaries,
                    freeAgency: {
                      year: freeAgencyYear,
                      type: 'UFA' as const,
                    },
                  },
                  freeAgentYear: freeAgencyYear,
                };
              }

              // Accepted: just update the option status
              return {
                ...p,
                contract: {
                  ...(p.contract || {}),
                  salariesByYear: updatedSalaries,
                },
              };
            }
            return p;
          });

          // Update capHolds array
          let updatedCapHolds = beforeTeam.capHolds || [];
          const finalCapHold = newCapHold as CapHold | null;
          if (finalCapHold) {
            // Remove any existing hold for this player and add the new one
            const holdPlayerId = finalCapHold.playerId;
            updatedCapHolds = updatedCapHolds.filter(
              (h) => h.playerId !== holdPlayerId
            );
            updatedCapHolds = [...updatedCapHolds, finalCapHold];
          }

          const finalPlayers = accepted
            ? updatedPlayers
            : updatedPlayers.filter(
                (p) =>
                  p.id !== playerId &&
                  p.player_id !== playerId &&
                  p.name !== playerId
              );
          const updatedRoster = accepted
            ? beforeTeam.roster
            : (Array.isArray(beforeTeam.roster)
                ? beforeTeam.roster
                : []
              ).filter((id) => String(id) !== String(playerId));

          // Record override audit log if override was used
          const overrideAuditLog = overrideMetadata?.overrideUsed
            ? recordOverrideAudit(
                beforeTeam,
                accepted ? 'accept' : 'decline',
                overrideMetadata.overrideReasons || [],
                playerId,
                normalizeOptionalMutationString(
                  player.name || player.displayName
                )
              )
            : beforeTeam.overrideAuditLog;

          return {
            ...beforeTeam,
            roster: updatedRoster,
            players: finalPlayers,
            capHolds: updatedCapHolds,
            ...(overrideAuditLog ? { overrideAuditLog } : {}),
          };
        },
        persistPayload: {
          teamCode,
          playerId,
          accepted,
          targetYear,
        },
      });

      return finalizeCapMutationResult(
        mutationResult,
        'Failed to save option decision. Please try again.'
      );
    },
    [
      currentYear,
      applyCapAuditedTeamMutation,
      finalizeCapMutationResult,
      teamCode,
    ]
  );

  const handleRenounceRights = useCallback(
    async (
      player: ArchitectPlayer,
      overrideMetadata?: OverrideMetadata | null
    ): Promise<MutationActionResult> => {
      return confirmAndRenounceRights(player, overrideMetadata);
    },
    [confirmAndRenounceRights]
  );

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
