/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectActions.offerSheetExecutors.ts
 * PURPOSE: Offer-sheet verification and execution sub-hook.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Wave 12 Step 3: Extracted from useArchitectActions.ts (L358–L779).
 */

import { useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  applyWorldMutation,
  type ArchitectMutationPayload,
} from '@/features/architect/utils/mutationPipeline';
import {
  OFFER_SHEET_WORLD_REQUIRED_MESSAGE,
  buildActionSeasonContext,
  buildCommittedOfferSheetIdentity,
  buildCommittedOfferSheetLifecycleIdentity,
  matchesCommittedOfferSheetIdentity,
  matchesCommittedOfferSheetLifecycleIdentity,
  OfferSheetMutationPayload,
  WorldCommittedTeamSource,
} from './useArchitectActions.helpers';
import type {
  CommittedWorldReloadResult,
  CommittedWorldReloadSeed,
  FreeAgencyWorldOnlyActionKind,
  FreeAgencyWorldOnlyActionPhase,
} from './useArchitectActions.helpers';
import {
  OFFER_SHEET_LIFECYCLE_RELOAD_FAILURE_MESSAGE,
  OFFER_SHEET_LIFECYCLE_VERIFICATION_FAILURE_MESSAGE,
} from './useArchitectActions.types';
import type {
  CapSheet,
  DashboardCommittedTeamSnapshot,
  OfferSheet,
  OfferSheetCommittedState,
  OfferSheetCommittedStateResolution,
  OfferSheetLifecycleCommittedState,
  OfferSheetLifecycleCommittedStateExpectation,
  OfferSheetLifecycleCommittedStateResolution,
  OfferSheetLifecycleExecutionResult,
  OfferSheetLifecycleMutationType,
  OfferSheetStoreExecutionResult,
  PersistMutationResult,
} from './useArchitectActions.types';
import type { UseArchitectStateReturn } from './useArchitectState';
import {
  deriveReceiptFromMutationResult,
  deriveReceiptFromTeamSnapshots,
  type ArchitectPostActionReceipt,
} from '../postActionHandoff/types';

export interface UseOfferSheetExecutorsParams {
  teamCode: string;
  worldId: string | null;
  userId: string | null;
  seasonId: string;
  currentYear: number;
  teamCapSheet: UseArchitectStateReturn['teamCapSheet'];
  startSave: UseArchitectStateReturn['startSave'];
  finishSave: UseArchitectStateReturn['finishSave'];
  publishPostActionReceipt?: (receipt: ArchitectPostActionReceipt) => void;
  // from persistenceHelpers
  reportMutationError: (message: string, details?: Record<string, unknown>) => void;
  evaluateMutationTruth: (
    mutationType: string,
    result: PersistMutationResult,
    options: { requireWorldPersistence: boolean }
  ) => { ok: boolean; message: string; appliedToLocalState: boolean; persistedToWorld: boolean };
  getFreeAgencyWorldOnlyMessage: (kind: FreeAgencyWorldOnlyActionKind, phase: FreeAgencyWorldOnlyActionPhase) => string;
  requireActiveWorldForFreeAgencyWorldOnlyCommit: (
    kind: FreeAgencyWorldOnlyActionKind,
    details?: Record<string, unknown>
  ) => string | null;
  resolveCommittedWorldTeamSnapshot: (
    result: PersistMutationResult
  ) => Promise<{ committedTeam: DashboardCommittedTeamSnapshot | null; committedTeamSource: WorldCommittedTeamSource } | null>;
  applyCommittedWorldReload: (
    mutationType: string,
    seed: CommittedWorldReloadSeed
  ) => Promise<CommittedWorldReloadResult>;
  applyCapAuditedTeamMutation: (params: {
    mutationType: string;
    playerIds?: string[];
    computeNextTeam: (beforeTeam: CapSheet) => CapSheet;
    persistPayload?: ArchitectMutationPayload;
    invalidMessage: string;
    seasonIdOverride?: string;
    yearOverride?: number;
  }) => {
    applied: boolean;
    operationId: string | null;
    message?: string;
    persistPromise: Promise<boolean> | null;
  };
}

export function useOfferSheetExecutors({
  teamCode,
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
}: UseOfferSheetExecutorsParams) {
  const publishOfferSheetReceipt = useCallback(
    (
      mutationType: OfferSheetLifecycleMutationType | 'storeOfferSheet',
      result: PersistMutationResult,
      payload: ArchitectMutationPayload,
      afterTeam?: DashboardCommittedTeamSnapshot | null
    ): void => {
      if (!publishPostActionReceipt) {
        return;
      }

      const receipt =
        teamCapSheet && afterTeam
          ? deriveReceiptFromTeamSnapshots({
              mutationType,
              result,
              beforeTeam: teamCapSheet,
              afterTeam,
              selectedYear: currentYear,
              primaryTeamCode: teamCode || null,
              payload,
            })
          : deriveReceiptFromMutationResult({
              mutationType,
              result,
              primaryTeamCode: teamCode || null,
              payload,
            });

      if (receipt) {
        publishPostActionReceipt(receipt);
      }
    },
    [currentYear, publishPostActionReceipt, teamCapSheet, teamCode]
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
        publishOfferSheetReceipt(
          'storeOfferSheet',
          result,
          mutationPayload,
          committedState.value.committedTeam
        );
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
      publishOfferSheetReceipt,
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
        publishOfferSheetReceipt(
          mutationType,
          result,
          mutationPayload,
          committedState.value.committedTeam
        );
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
      publishOfferSheetReceipt,
      reportMutationError,
      resolveCommittedOfferSheetLifecycleState,
      seasonId,
      startSave,
      userId,
      worldId,
    ]
  );

  return {
    resolveCommittedOfferSheetState,
    applyCommittedOfferSheetState,
    executeWorldModeOfferSheetStore,
    resolveCommittedOfferSheetLifecycleState,
    applyCommittedOfferSheetLifecycleState,
    executeWorldModeOfferSheetLifecycleMutation,
  };
}
