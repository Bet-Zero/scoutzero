/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectActions.persistenceHelpers.ts
 * PURPOSE: Cap-audit boundary, persistence, and world-reload orchestration helpers sub-hook.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Wave 12 Step 1: Extracted from useArchitectActions.ts (L311–L957).
 */

import { useCallback } from 'react';
import {
  applyWorldMutation,
  buildGeneralMutationDashboardReloadTeamSnapshot,
  type ArchitectMutationPayload,
  type OfferSheetPreflightResult,
  type SignAndTradePreflightResult,
} from '@/features/architect/utils/mutationPipeline';
import { findCommittedTeamSnapshot } from '@/features/architect/utils/mutationPipeline';
import { loadWorldTeamData } from '@/features/architect/utils/worldTeamData';
import {
  BASE_LOCAL_VALIDATED_CAP_AUDIT_STREAM,
  WORLD_OPTIMISTIC_PREVIEW_CAP_AUDIT_STREAM,
  appendLocalCapAuditEvent,
  buildAuthoritativeLinkEstablishedAuditPatch,
  buildPersistFailedRolledBackAuditPatch,
  updateLocalCapAuditEvent,
  withLocalCapAuditLifecycleState,
  type CapAuditEventV1Like,
  type LocalCapAuditLifecycleState,
} from '@/features/architect/utils/capLegality/localCapAuditLog';
import toast from 'react-hot-toast';
import type { PlayerRulesProfileInput } from '@/features/architect/types';
import type { ActionContext, EditModalContext } from './useArchitectModals';
import {
  BASE_MODE_VALIDATOR_WORLD_ID,
  CAP_AUDIT_EVENT_SCHEMA_VERSION,
  buildBlockedSignAndTradePreflightResult,
  buildCapAuditEvaluation,
  buildOfferSheetPreflightResult,
  extractCommittedWorldMetadataPatch,
  generateLocalOperationId,
  getFreeAgencyWorldOnlyRequirement,
  safeCloneForAudit,
  toDashboardCommittedTeamSnapshot,
} from './useArchitectActions.helpers';
import type {
  CommittedWorldReloadPlan,
  CommittedWorldReloadResult,
  CommittedWorldReloadSeed,
  FreeAgencyWorldOnlyActionKind,
  FreeAgencyWorldOnlyActionPhase,
  ResolvedCommittedWorldTeam,
  TeamsByCode,
} from './useArchitectActions.helpers';
import type {
  ArchitectPlayer,
  CapSheet,
  DashboardCommittedTeamSnapshot,
  MutationTruthResult,
  PersistMutationResult,
} from './useArchitectActions.types';
import type { UseArchitectStateReturn } from './useArchitectState';

// Module-level types lifted from usePersistenceHelpers for external use
export type PreparedCapAuditedMutationBoundary = {
  operationId: string;
  storageKey: string;
  localStateKind: string;
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

export interface UsePersistenceHelpersParams {
  teamCode: string;
  worldId: string | null;
  userId: string | null;
  seasonId: string;
  currentYear: number;
  teamCapSheet: UseArchitectStateReturn['teamCapSheet'];
  setTeamCapSheet: UseArchitectStateReturn['setTeamCapSheet'];
  setSelectedPlayer: UseArchitectStateReturn['setSelectedPlayer'];
  setSelectedRulesYear: UseArchitectStateReturn['setSelectedRulesYear'];
  openContractModal: (context?: EditModalContext) => void;
  startSave: UseArchitectStateReturn['startSave'];
  finishSave: UseArchitectStateReturn['finishSave'];
  reloadActiveWorldTeamData: UseArchitectStateReturn['reloadActiveWorldTeamData'];
  refreshWorldRosterIndex: UseArchitectStateReturn['refreshWorldRosterIndex'];
}

export function usePersistenceHelpers({
  teamCode,
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
  reloadActiveWorldTeamData,
  refreshWorldRosterIndex,
}: UsePersistenceHelpersParams) {

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

  return {
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
  };
}
