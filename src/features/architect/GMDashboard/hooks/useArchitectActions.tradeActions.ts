/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectActions.tradeActions.ts
 * PURPOSE: Sub-hook for trade, sign, and sign-and-trade action handlers.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Wave 6 Step 3: Extracted from useArchitectActions.ts.
 */

import { useCallback } from 'react';
import { buildTradeExecutionHandoff as createTradeExecutionHandoff } from './useArchitectActions.tradeHandoff';
import {
  applyWorldMutation,
  computeWorldMutation,
  findUpdatedTeamSnapshot,
  preflightSignAndTradeMutation,
  preflightOfferSheetMutation,
  type ArchitectMutationPayload,
  type SignAndTradePreflightResult,
  type OfferSheetPreflightResult,
} from '@/features/architect/utils/mutationPipeline';
import {
  loadWorldTeamData,
  resolveTeamCode,
} from '@/features/architect/utils/worldTeamData';
import {
  BASE_LOCAL_VALIDATED_CAP_AUDIT_STREAM,
  appendLocalCapAuditEvent,
  withLocalCapAuditLifecycleState,
} from '@/features/architect/utils/capLegality/localCapAuditLog';
import toast from 'react-hot-toast';
import {
  buildActionSeasonContext,
  buildCapAuditEvaluation,
  buildBlockedSignAndTradePreflightResult,
  buildOfferSheetPreflightResult,
  generateLocalOperationId,
  getFirstViolationMessage,
  isOfferSheetCreationDefinitionFailure,
  isSignAndTradeTransactionPreparationFailure,
  safeCloneForAudit,
  type CommittedWorldReloadResult,
  type CommittedWorldReloadSeed,
  type FreeAgencyWorldOnlyActionKind,
  type FreeAgencyWorldOnlyActionPhase,
  type PreparedOfferSheetCreationDefinition,
  type PreparedSignAndTradeTransactionDefinition,
  type PreparedStandardSigningDetails,
  type ResolvedCommittedWorldTeam,
  type SignAndTradeExecutionResult,
  type SignAndTradeMutationPayload,
  type StandardSigningExecutionRoute,
  type StandardSigningResolvedState,
  type TeamsByCode,
} from './useArchitectActions.helpers';
import type {
  ArchitectPlayer,
  CapSheet,
  ComputeMutationResult,
  ExecuteTradeCurrentState,
  MutationActionResult,
  MutationTruthResult,
  PersistMutationResult,
  SigningDetails,
  TradeDataItem,
  TradeExecutionHandoff,
  TradeExecutionPayload,
} from './useArchitectActions.types';

export type UseTradeActionsParams = {
  currentYear: number;
  seasonId: string;
  teamCode: string;
  userId: string | null | undefined;
  worldId: string | null | undefined;
  worldAsOfDate: string | null | undefined;
  startSave: () => void;
  finishSave: (errorMsg?: string) => void;
  // Shared closures passed from useArchitectActions
  setTeamCapSheetSafe: (team: CapSheet | null) => void;
  reportMutationError: (
    message: string,
    details?: Record<string, unknown>
  ) => void;
  getFreeAgencyWorldOnlyMessage: (
    kind: FreeAgencyWorldOnlyActionKind,
    phase: FreeAgencyWorldOnlyActionPhase
  ) => string;
  requireActiveWorldForFreeAgencyWorldOnlyCommit: (
    kind: FreeAgencyWorldOnlyActionKind,
    details?: Record<string, unknown>
  ) => string | null;
  buildBlockedWorldOnlySignAndTradePreflightResult: () => SignAndTradePreflightResult;
  buildBlockedWorldOnlyOfferSheetPreflightResult: () => OfferSheetPreflightResult;
  resolveCommittedWorldTeamSnapshot: (
    result: PersistMutationResult
  ) => Promise<CommittedWorldReloadSeed | null>;
  applyCommittedWorldReload: (
    mutationType: string,
    committedWorldTeam: CommittedWorldReloadSeed
  ) => Promise<CommittedWorldReloadResult>;
  applyResolvedStandardSigningState: (
    playerObj: ArchitectPlayer,
    resolvedState: StandardSigningResolvedState
  ) => Promise<void>;
  resolveStandardSigningExecutionRoute: () => StandardSigningExecutionRoute;
  runAuthoritativeWorldMutationWithDashboardSync: (
    mutationType: string,
    payload: ArchitectMutationPayload,
    options?: {
      worldRequiredMessage?: string;
      seasonIdOverride?: string;
      draftReviewAuthority?: object;
      operationId?: string;
    }
  ) => Promise<PersistMutationResult>;
  evaluateMutationTruth: (
    mutationType: string,
    result: MutationTruthResult,
    options: { requireWorldPersistence: boolean }
  ) => {
    ok: boolean;
    message: string;
    appliedToLocalState: boolean;
    persistedToWorld: boolean;
  };
  prepareStandardSigningMutationPayload: (
    playerObj: ArchitectPlayer,
    playerId: string,
    contract: SigningDetails
  ) => PreparedStandardSigningDetails;
  prepareSignAndTradeTransactionDefinition: (
    playerObj: ArchitectPlayer,
    contract: SigningDetails,
    destinationTeamCode: string
  ) => PreparedSignAndTradeTransactionDefinition;
  prepareOfferSheetCreationDefinition: (
    playerObj: ArchitectPlayer,
    contract: SigningDetails
  ) => PreparedOfferSheetCreationDefinition;
};

export function useTradeActions({
  currentYear,
  seasonId,
  teamCode,
  userId,
  worldId,
  worldAsOfDate,
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
}: UseTradeActionsParams) {
  const buildTradeExecutionHandoff = useCallback(
    (tradeData: TradeDataItem[]): TradeExecutionHandoff => {
      return createTradeExecutionHandoff(tradeData, {
        currentYear,
        worldId,
        worldAsOfDate,
      });
    },
    [currentYear, worldAsOfDate, worldId]
  );

  const commitTradeExecutionHandoff = useCallback(
    async (
      tradeExecutionHandoff: TradeExecutionHandoff,
      review?: import('../../utils/draftReview/simulationPreview').DraftSimulationHandoff
    ): Promise<void> => {
      const result = review
        ? await runAuthoritativeWorldMutationWithDashboardSync(
            'executeTrade',
            tradeExecutionHandoff.payload,
            {
              draftReviewAuthority: review.authority,
              operationId: review.operationId,
            }
          )
        : await runAuthoritativeWorldMutationWithDashboardSync(
            'executeTrade',
            tradeExecutionHandoff.payload
          );
      if (!result.success) {
        const message =
          result.error instanceof Error
            ? result.error.message
            : result.error || 'The saved-world trade could not be applied.';
        throw new Error(message);
      }
    },
    [runAuthoritativeWorldMutationWithDashboardSync]
  );

  const applyTradeExecutionHandoffToBaseState = useCallback(
    async (tradeExecutionHandoff: TradeExecutionHandoff): Promise<void> => {
      const { resolvedTeamCodes, payload } = tradeExecutionHandoff;
      const teams = payload.teams;

      try {
        const loadedTeams = await Promise.all(
          resolvedTeamCodes.map(async (resolvedTeamCode, index) => {
            const baseTeamSnapshot = await loadWorldTeamData(
              null,
              resolvedTeamCode
            );
            if (!baseTeamSnapshot) {
              throw new Error(
                `Unable to load base-state snapshot for team ${resolvedTeamCode} (trade index ${index})`
              );
            }
            return {
              teamCode: resolvedTeamCode,
              team: baseTeamSnapshot,
            };
          })
        );

        const tradePayload = {
          ...payload,
          tradeCtx: {
            ...payload.tradeCtx,
            worldId: null,
          },
        } satisfies TradeExecutionPayload;

        const tradeCurrentState = {
          teams: loadedTeams,
        } as ExecuteTradeCurrentState;

        const computeResult = computeWorldMutation({
          mutationType: 'executeTrade',
          payload: tradePayload,
          currentState: tradeCurrentState,
          seasonId,
          timestamp: Date.now(),
          asOfDate: worldAsOfDate || undefined,
        }) as ComputeMutationResult;

        if (!computeResult?.success) {
          throw new Error(
            String(
              computeResult?.error ||
                'Base-state trade apply failed authoritative compute.'
            )
          );
        }

        const validatedContext = computeResult._validatedTradeContext;

        if (!validatedContext?._isValidatedTradeContext) {
          throw new Error(
            'Base-state trade apply failed: missing authoritative validated trade context.'
          );
        }

        if (!validatedContext.legal) {
          throw new Error(
            validatedContext.error ||
              validatedContext.reason ||
              'Base-state trade apply blocked by authoritative validation.'
          );
        }

        // TMAPPLY-03 (decision): sandbox/base mode is single-team scoped. The GM
        // Dashboard displays only the primary team (`teamCode`), so only its
        // computed snapshot is applied here. Other teams' updates are computed
        // (and captured in the cap audit above) but intentionally not surfaced —
        // base mode has no multi-team roster view and never writes their base data.
        const updatedTeam = findUpdatedTeamSnapshot(
          computeResult.teamUpdates,
          teamCode
        );

        if (!updatedTeam) {
          throw new Error(
            `Base-state trade apply failed: authoritative compute did not return team snapshot for ${teamCode}.`
          );
        }

        const beforeTeamsByCode: TeamsByCode = {};
        for (const loadedTeam of loadedTeams) {
          if (loadedTeam?.teamCode && loadedTeam?.team) {
            beforeTeamsByCode[loadedTeam.teamCode] = safeCloneForAudit(
              loadedTeam.team as CapSheet
            );
          }
        }

        const afterTeamsByCode: TeamsByCode = {};
        for (const update of computeResult.teamUpdates || []) {
          if (update?.teamCode && update?.team) {
            afterTeamsByCode[update.teamCode] = safeCloneForAudit(
              update.team as CapSheet
            );
          }
        }

        const tradePlayerIds = Array.from(
          new Set(
            teams.flatMap((team) =>
              (team?.sends || [])
                .map((player) => String(player?.playerId || ''))
                .filter((playerId) => playerId.length > 0)
            )
          )
        );
        const operationId = generateLocalOperationId();
        const occurredAt = new Date().toISOString();
        const localValidatedAudit = buildCapAuditEvaluation({
          operationId,
          occurredAt,
          mutationType: 'executeTrade',
          worldId: null,
          year: currentYear,
          teamCodes: resolvedTeamCodes,
          playerIds: tradePlayerIds,
          beforeTeamsByCode,
          afterTeamsByCode,
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
          throw new Error(
            getFirstViolationMessage(
              localValidatedAudit.validation,
              'Base-state trade apply blocked by post-state cap validation.'
            )
          );
        }

        setTeamCapSheetSafe(updatedTeam as CapSheet);
      } catch (error) {
        console.error('[Architect][Trade][BaseStateApply] failed', {
          teamCode,
          seasonId,
          currentYear,
          error,
        });
        throw error;
      }
    },
    [currentYear, seasonId, setTeamCapSheetSafe, teamCode, worldAsOfDate]
  );

  const applyTradeToCapSheet = useCallback(
    async (
      tradeData: TradeDataItem[],
      review?: import('../../utils/draftReview/simulationPreview').DraftSimulationHandoff
    ): Promise<void> => {
      if (!tradeData || !Array.isArray(tradeData)) {
        return;
      }

      /* TRADE APPLY CONTRACT:
         - TradeSection/TradeEditor hand off a staged draft only.
         - This action layer normalizes the authoritative executeTrade payload.
         - World-mode commit and base-mode preview apply branch here, not in the wrapper. */
      const tradeExecutionHandoff = buildTradeExecutionHandoff(tradeData);

      if (worldId) {
        await commitTradeExecutionHandoff(tradeExecutionHandoff, review);
        return;
      }

      await applyTradeExecutionHandoffToBaseState(tradeExecutionHandoff);
    },
    [
      applyTradeExecutionHandoffToBaseState,
      buildTradeExecutionHandoff,
      commitTradeExecutionHandoff,
      worldId,
    ]
  );

  // === Contract/Player Actions ===

  const handleSign = useCallback(
    async (
      playerObj: ArchitectPlayer,
      contract: SigningDetails
    ): Promise<MutationActionResult> => {
      const idToSign = playerObj.id || playerObj.player_id;
      if (!idToSign) {
        reportMutationError('Cannot sign player: missing player ID.', {
          playerObj,
        });
        return {
          success: false,
          message: 'Cannot sign player: missing player ID.',
        };
      }

      const normalizedPlayerId = String(idToSign).trim();
      const { actionSeasonContext, standardSigningPayload } =
        prepareStandardSigningMutationPayload(
          playerObj,
          normalizedPlayerId,
          contract
        );

      if (!standardSigningPayload?.contract) {
        reportMutationError(
          'Cannot sign player: contract payload is missing salaries.',
          {
            playerId: normalizedPlayerId,
            contract,
          }
        );
        return {
          success: false,
          message: 'Cannot sign player: contract payload is missing salaries.',
        };
      }

      const standardSigningExecutionRoute =
        resolveStandardSigningExecutionRoute();
      const executionResult = await standardSigningExecutionRoute.execute(
        playerObj,
        actionSeasonContext,
        standardSigningPayload
      );

      if (executionResult.success !== true) {
        return {
          success: false,
          message: executionResult.message,
        };
      }

      try {
        await applyResolvedStandardSigningState(playerObj, executionResult);
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Signing saved but the committed team state could not be applied.';
        reportMutationError(message, {
          mutationType: 'signFreeAgent',
          playerId: normalizedPlayerId,
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
      applyResolvedStandardSigningState,
      reportMutationError,
      resolveStandardSigningExecutionRoute,
    ]
  );

  const applyCommittedSignAndTradeState = useCallback(
    async (committedWorldTeam: ResolvedCommittedWorldTeam): Promise<void> => {
      await applyCommittedWorldReload('signAndTrade', {
        committedTeam: committedWorldTeam.committedTeam,
        committedTeamSource: committedWorldTeam.committedTeamSource,
      });
    },
    [applyCommittedWorldReload]
  );

  const executeWorldModeSignAndTrade = useCallback(
    async (
      actionSeasonContext: ReturnType<typeof buildActionSeasonContext>,
      mutationPayload: SignAndTradeMutationPayload
    ): Promise<SignAndTradeExecutionResult> => {
      if (!worldId) {
        const message = getFreeAgencyWorldOnlyMessage('signAndTrade', 'commit');
        reportMutationError(message, {
          mutationType: 'signAndTrade',
          payload: mutationPayload,
        });
        return { success: false, message };
      }

      if (!userId) {
        const message = 'Cannot save changes: missing user identity.';
        reportMutationError(message, {
          mutationType: 'signAndTrade',
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
          mutationType: 'signAndTrade',
          payload: mutationPayload,
        })) as PersistMutationResult;

        const truth = evaluateMutationTruth('signAndTrade', rawResult, {
          requireWorldPersistence: true,
        });
        const result: PersistMutationResult = {
          ...rawResult,
          success: truth.ok,
          error: truth.ok
            ? rawResult?.error
            : truth.message || 'Failed to save sign-and-trade.',
          appliedToLocalState: truth.appliedToLocalState,
          persistedToWorld: truth.persistedToWorld,
        };

        if (!result.success) {
          const message = String(
            result.error || 'Failed to save sign-and-trade.'
          );
          reportMutationError(message, {
            mutationType: 'signAndTrade',
            payload: mutationPayload,
            result: rawResult,
          });
          finishSave(message);
          return { success: false, message };
        }

        const committedWorldTeam =
          await resolveCommittedWorldTeamSnapshot(result);
        const committedTeam = committedWorldTeam?.committedTeam || null;

        if (!committedTeam) {
          const message =
            'Sign-and-trade saved but the committed team snapshot could not be reloaded.';
          reportMutationError(message, {
            mutationType: 'signAndTrade',
            payload: mutationPayload,
            playerId: mutationPayload.playerId,
            result,
          });
          finishSave(message);
          return { success: false, message };
        }

        toast.success('Saved changes');
        finishSave();
        if (!committedWorldTeam) {
          return {
            success: false,
            message:
              'Sign-and-trade saved but the committed team snapshot could not be reloaded.',
          };
        }
        return {
          success: true,
          propagationMode: 'world-committed' as const,
          ...committedWorldTeam,
        };
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to save sign-and-trade.';
        reportMutationError(message, {
          mutationType: 'signAndTrade',
          payload: mutationPayload,
          error,
        });
        finishSave(message);
        return { success: false, message };
      }
    },
    [
      evaluateMutationTruth,
      finishSave,
      getFreeAgencyWorldOnlyMessage,
      reportMutationError,
      resolveCommittedWorldTeamSnapshot,
      startSave,
      userId,
      worldId,
    ]
  );

  const handleSignAndTrade = useCallback(
    async (
      playerObj: ArchitectPlayer,
      contract: SigningDetails,
      destinationTeamCode: string
    ): Promise<MutationActionResult> => {
      const worldRequiredMessage =
        requireActiveWorldForFreeAgencyWorldOnlyCommit('signAndTrade', {
          playerObj,
          destinationTeamCode,
        });
      if (worldRequiredMessage) {
        return {
          success: false,
          message: worldRequiredMessage,
        };
      }

      const transactionDefinition = prepareSignAndTradeTransactionDefinition(
        playerObj,
        contract,
        destinationTeamCode
      );

      if (isSignAndTradeTransactionPreparationFailure(transactionDefinition)) {
        reportMutationError(
          transactionDefinition.message,
          transactionDefinition.logContext
        );
        return {
          success: false,
          message: transactionDefinition.message,
        };
      }

      const result = await executeWorldModeSignAndTrade(
        transactionDefinition.actionSeasonContext,
        transactionDefinition.mutationPayload
      );

      if (result.success !== true) {
        return {
          success: false,
          message: result.message,
        };
      }

      try {
        await applyCommittedSignAndTradeState(result);
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Sign-and-trade saved but the committed team state could not be applied.';
        reportMutationError(message, {
          mutationType: 'signAndTrade',
          playerId: transactionDefinition.mutationPayload.playerId,
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
      applyCommittedSignAndTradeState,
      executeWorldModeSignAndTrade,
      prepareSignAndTradeTransactionDefinition,
      requireActiveWorldForFreeAgencyWorldOnlyCommit,
      reportMutationError,
    ]
  );

  const getSignAndTradePreflight = useCallback(
    async (
      playerObj: ArchitectPlayer,
      contract: SigningDetails,
      destinationTeamCode: string
    ): Promise<SignAndTradePreflightResult> => {
      if (!worldId) {
        return buildBlockedWorldOnlySignAndTradePreflightResult();
      }

      const transactionDefinition = prepareSignAndTradeTransactionDefinition(
        playerObj,
        contract,
        destinationTeamCode
      );

      if (isSignAndTradeTransactionPreparationFailure(transactionDefinition)) {
        return transactionDefinition.preflightResult;
      }

      try {
        return await preflightSignAndTradeMutation({
          worldId,
          seasonId: transactionDefinition.actionSeasonContext.seasonId,
          payload: transactionDefinition.mutationPayload,
        });
      } catch (error) {
        return {
          status: 'incomplete',
          reasons: [
            error instanceof Error
              ? error.message
              : 'Authoritative sign-and-trade preflight failed before legality could be determined.',
          ],
          warnings: [],
          source: 'authoritative-preflight',
        };
      }
    },
    [
      buildBlockedWorldOnlySignAndTradePreflightResult,
      prepareSignAndTradeTransactionDefinition,
      worldId,
    ]
  );

  const getOfferSheetPreflight = useCallback(
    async (
      playerObj: ArchitectPlayer,
      contract: SigningDetails
    ): Promise<OfferSheetPreflightResult> => {
      if (!worldId) {
        return buildBlockedWorldOnlyOfferSheetPreflightResult();
      }

      const creationDefinition = prepareOfferSheetCreationDefinition(
        playerObj,
        contract
      );
      if (isOfferSheetCreationDefinitionFailure(creationDefinition)) {
        return creationDefinition.preflightResult;
      }

      try {
        return await preflightOfferSheetMutation({
          worldId,
          seasonId: creationDefinition.actionSeasonContext.seasonId,
          ...creationDefinition.preflightPayload,
        });
      } catch (error) {
        return {
          status: 'incomplete',
          reasons: [
            error instanceof Error
              ? error.message
              : 'Authoritative offer sheet preflight failed before legality could be determined.',
          ],
          warnings: [],
          source: 'authoritative-preflight',
        };
      }
    },
    [
      buildBlockedWorldOnlyOfferSheetPreflightResult,
      prepareOfferSheetCreationDefinition,
      worldId,
    ]
  );

  // === RFA Offer Sheet Actions ===

  return {
    applyTradeToCapSheet,
    handleSign,
    handleSignAndTrade,
    getSignAndTradePreflight,
    getOfferSheetPreflight,
  };
}
