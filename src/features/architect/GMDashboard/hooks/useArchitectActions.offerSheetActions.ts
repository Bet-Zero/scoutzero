/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectActions.offerSheetActions.ts
 * PURPOSE: Sub-hook for RFA offer sheet action handlers.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Wave 6 Step 4: Extracted from useArchitectActions.ts.
 */

import { useCallback } from 'react';
import type { ArchitectMutationPayload } from '@/features/architect/utils/mutationPipeline';
import { synchronizeTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import {
  type FreeAgencyWorldOnlyActionKind,
  type OfferSheetMutationPayload,
  type PreparedOfferSheetCreationDefinition,
  type WorldCommittedTeamSource,
  buildActionSeasonContext,
  isOfferSheetCreationDefinitionFailure,
} from './useArchitectActions.helpers';
import type {
  ArchitectPlayer,
  CapSheet,
  DashboardCommittedTeamSnapshot,
  ManualCapSheetLedgerMutationParams,
  MutationActionResult,
  OfferSheet,
  OfferSheetFinalizeMutationRoute,
  OfferSheetLifecycleCommittedStateExpectation,
  OfferSheetLifecycleExecutionResult,
  OfferSheetLifecycleMutationType,
  OfferSheetResolutionAction,
  OfferSheetResolutionMutationType,
  OfferSheetStoreExecutionResult,
  SigningDetails,
} from './useArchitectActions.types';
import {
  mergeManualExceptionSnapshot,
  normalizeManualExceptionsForMutation,
} from './useArchitectActions.types';

export type UseOfferSheetActionsParams = {
  currentYear: number;
  teamCode: string;
  reportMutationError: (message: string, details?: Record<string, unknown>) => void;
  requireActiveWorldForFreeAgencyWorldOnlyCommit: (
    kind: FreeAgencyWorldOnlyActionKind,
    details?: Record<string, unknown>
  ) => string | null;
  applyCommittedOfferSheetState: (
    committedTeam: DashboardCommittedTeamSnapshot,
    committedTeamSource: WorldCommittedTeamSource
  ) => Promise<void>;
  executeWorldModeOfferSheetStore: (
    actionSeasonContext: ReturnType<typeof buildActionSeasonContext>,
    mutationPayload: OfferSheetMutationPayload
  ) => Promise<OfferSheetStoreExecutionResult>;
  executeWorldModeOfferSheetLifecycleMutation: (
    mutationType: OfferSheetLifecycleMutationType,
    mutationPayload: ArchitectMutationPayload,
    expectation: OfferSheetLifecycleCommittedStateExpectation
  ) => Promise<OfferSheetLifecycleExecutionResult>;
  prepareOfferSheetCreationDefinition: (
    playerObj: ArchitectPlayer,
    contract: SigningDetails
  ) => PreparedOfferSheetCreationDefinition;
  applyCapAuditedTeamMutation: (params: {
    mutationType: string;
    playerIds?: string[];
    computeNextTeam: (beforeTeam: CapSheet) => CapSheet;
    persistPayload?: ArchitectMutationPayload;
    invalidMessage: string;
    seasonIdOverride?: string;
    yearOverride?: number;
  }) => { applied: boolean; operationId: string | null; persistPromise: Promise<boolean> | null };
};

export function useOfferSheetActions({
  currentYear,
  teamCode,
  reportMutationError,
  requireActiveWorldForFreeAgencyWorldOnlyCommit,
  applyCommittedOfferSheetState,
  executeWorldModeOfferSheetStore,
  executeWorldModeOfferSheetLifecycleMutation,
  prepareOfferSheetCreationDefinition,
  applyCapAuditedTeamMutation,
}: UseOfferSheetActionsParams) {

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


  return {
    handleStoreOfferSheet,
    handleMatchOfferSheet,
    handleDeclineOfferSheet,
    handleFinalizeOfferSheet,
    runManualCapSheetLedgerMutation,
  };
}
