/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectActions.signingExecution.ts
 * PURPOSE: Signing execution routes, cap-audited mutation apply, and signing preparation sub-hook.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Wave 12 Step 2: Extracted from useArchitectActions.ts (L776–L1525).
 */

import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { validateSigning } from '@/features/architect/utils/capLegalityValidation';
import {
  applyWorldMutation,
  computeWorldMutation,
  findUpdatedTeamSnapshot,
} from '@/features/architect/utils/mutationPipeline';
import type { ArchitectMutationPayload } from '@/features/architect/utils/mutationPipeline';
import {
  BASE_LOCAL_VALIDATED_CAP_AUDIT_STREAM,
  appendLocalCapAuditEvent,
  withLocalCapAuditLifecycleState,
} from '@/features/architect/utils/capLegality/localCapAuditLog';
import { resolveTeamCode } from '@/features/architect/utils/worldTeamData';
import {
  acquireOptimisticLock,
  releaseOptimisticLock,
} from './optimisticMutationLock';
import {
  MINIMUM_SIGNING_HEURISTIC,
  buildActionSeasonContext,
  buildCapAuditEvaluation,
  buildOfferSheetCreationDefinitionFailure,
  buildSignAndTradeTransactionPreparationFailure,
  deriveSigningMechanism,
  deriveSigningYearsOfService,
  ensureContractStructure,
  filterSignedPlayerFromFreeAgents,
  generateLocalOperationId,
  getFirstViolationMessage,
  getWorldOptimisticLockScopeKey,
  safeCloneForAudit,
  stripPrebuiltSigningRowsForAuthority,
} from './useArchitectActions.helpers';
import type {
  AuthoritativeSigningPreparationOverrides,
  CommittedWorldReloadPlan,
  CommittedWorldReloadResult,
  PreparedAuthoritativeSigningDetails,
  PreparedOfferSheetCreationDefinition,
  PreparedSignAndTradeTransactionDefinition,
  PreparedStandardSigningDetails,
  StandardSigningExecutionResult,
  StandardSigningExecutionRoute,
  StandardSigningMutationPayload,
  StandardSigningResolvedState,
  TeamsByCode,
} from './useArchitectActions.helpers';
import {
  normalizeOptionalMutationString,
  toFreeAgentComputeState,
  toSigningValidationPlayer,
  toSigningValidationTeam,
} from './useArchitectActions.types';
import type {
  ArchitectPlayer,
  CapSheet,
  ComputeMutationResult,
  LocalContract,
  MutationActionResult,
  PersistMutationResult,
  SigningDetails,
} from './useArchitectActions.types';
import type { UseArchitectStateReturn } from './useArchitectState';
import type { PreparedCapAuditedMutationBoundary } from './useArchitectActions.persistenceHelpers';
import type {
  ArchitectPostActionReceipt,
  ArchitectReceiptActionContext,
} from '../postActionHandoff/types';
import {
  deriveReceiptFromMutationResult,
  deriveReceiptFromTeamSnapshots,
} from '../postActionHandoff/types';

export interface UseSigningExecutionParams {
  teamCode: string;
  worldId: string | null;
  userId: string | null;
  currentYear: number;
  teamCapSheet: UseArchitectStateReturn['teamCapSheet'];
  playersMap: Record<string, ArchitectPlayer | unknown>;
  setTeamCapSheetSafe: (team: CapSheet | null) => void;
  setFreeAgents: UseArchitectStateReturn['setFreeAgents'];
  startSave: UseArchitectStateReturn['startSave'];
  finishSave: UseArchitectStateReturn['finishSave'];
  // from persistenceHelpers
  reportMutationError: (message: string, details?: Record<string, unknown>) => void;
  evaluateMutationTruth: (
    mutationType: string,
    result: PersistMutationResult,
    options: { requireWorldPersistence: boolean }
  ) => { ok: boolean; message: string; appliedToLocalState: boolean; persistedToWorld: boolean };
  persistMutation: (
    mutationType: string,
    payload: ArchitectMutationPayload,
    options?: {
      operationId?: string;
      seasonIdOverride?: string;
      onSuccess?: (result: PersistMutationResult) => void;
      onFailure?: (message: string, result?: PersistMutationResult) => void;
    }
  ) => Promise<PersistMutationResult>;
  prepareCapAuditedMutationBoundary: (params: {
    mutationType: string;
    playerIds?: string[];
    computeNextTeam: (beforeTeam: CapSheet) => CapSheet;
    yearOverride?: number;
  }) => PreparedCapAuditedMutationBoundary;
  buildCommittedWorldReloadPlan: (
    mutationType: string,
    result: PersistMutationResult
  ) => Promise<CommittedWorldReloadPlan | null>;
  applyCommittedWorldReloadPlan: (
    plan: CommittedWorldReloadPlan
  ) => Promise<CommittedWorldReloadResult>;
  syncTeamFromMutationResult: (
    mutationType: string,
    result: PersistMutationResult
  ) => Promise<void>;
  /**
   * Stage 2B post-action receipt publisher. Receives a receipt derived
   * from the canonical committed signing result. No-op when omitted.
   */
  publishPostActionReceipt?: (receipt: ArchitectPostActionReceipt) => void;
}

export function useSigningExecution({
  teamCode,
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
}: UseSigningExecutionParams) {

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
        // Stage 2B: derive a post-action receipt from the committed result.
        if (publishPostActionReceipt) {
          const signingPlayerId =
            standardSigningPayload.playerId ||
            playerObj.id ||
            playerObj.player_id ||
            null;
          const signingReceiptContext: ArchitectReceiptActionContext = {
            actionType: 'free-agent-signing',
            playerId: signingPlayerId,
            playerName: playerObj.displayName || playerObj.name || null,
            affectedSeasons:
              standardSigningPayload.contract?.salariesByYear?.map(
                (row) => row.season
              ) || [],
            effectAreas: ['roster', 'cap', 'exceptions', 'contract'],
          };
          const receipt = teamCapSheet
            ? deriveReceiptFromTeamSnapshots({
                mutationType: 'signFreeAgent',
                result,
                beforeTeam: teamCapSheet,
                afterTeam:
                  committedWorldReloadPlan.committedWorldTeam.committedTeam,
                selectedYear: actionSeasonContext.actionYear,
                primaryTeamCode: teamCode || null,
                primaryPlayerIds: signingPlayerId
                  ? [String(signingPlayerId)]
                  : [],
                payload: standardSigningPayload,
                actionContext: signingReceiptContext,
              })
            : deriveReceiptFromMutationResult({
                mutationType: 'signFreeAgent',
                result,
                primaryTeamCode: teamCode || null,
                payload: standardSigningPayload,
                actionContext: signingReceiptContext,
              });
          if (receipt) {
            publishPostActionReceipt(receipt);
          }
        }
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
      teamCapSheet,
      userId,
      worldId,
      publishPostActionReceipt,
      teamCode,
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
      receiptContext?: ArchitectReceiptActionContext;
    }): {
      applied: boolean;
      operationId: string | null;
      message?: string;
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
        receiptContext,
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
            return {
              applied: false,
              operationId: null,
              message: blockedMessage,
              persistPromise: null,
            };
          }
        }

        if (!teamCapSheet) {
          const message = `Cannot apply ${mutationType}: team state is not loaded.`;
          reportMutationError(message, {
            mutationType,
          });
          return {
            applied: false,
            operationId: null,
            message,
            persistPromise: null,
          };
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
          const message = getFirstViolationMessage(
            boundary.auditEvaluation.validation,
            invalidMessage
          );
          // The audit record has already been written with an explicit
          // `evaluation-blocked` lifecycle state, so callers can distinguish
          // blocked preview/audit records from pending optimistic preview.
          reportMutationError(message, {
            mutationType,
            operationId: boundary.operationId,
            violations: boundary.auditEvaluation.validation.violations,
          });
          return {
            applied: false,
            operationId: boundary.operationId,
            message,
            persistPromise: null,
          };
        }

        boundary.applyNonAuthoritativeState();

        if (boundary.localStateKind === 'local-validated-apply') {
          if (publishPostActionReceipt && receiptContext) {
            const receipt = deriveReceiptFromTeamSnapshots({
              mutationType,
              beforeTeam: boundary.beforeTeamSnapshot,
              afterTeam: boundary.afterTeamSnapshot,
              selectedYear: yearOverride,
              primaryTeamCode: teamCode || null,
              primaryPlayerIds: playerIds.map(String),
              payload: persistPayload,
              actionContext: receiptContext,
              authority: 'local-only',
            });
            if (receipt) {
              publishPostActionReceipt(receipt);
            }
          }
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
            if (publishPostActionReceipt && receiptContext) {
              const receipt = deriveReceiptFromTeamSnapshots({
                mutationType,
                result,
                beforeTeam: boundary.beforeTeamSnapshot,
                afterTeam: boundary.afterTeamSnapshot,
                selectedYear: yearOverride,
                primaryTeamCode: teamCode || null,
                primaryPlayerIds: playerIds.map(String),
                payload: persistPayload,
                actionContext: receiptContext,
              });
              if (receipt) {
                publishPostActionReceipt(receipt);
              }
            }
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
      publishPostActionReceipt,
      reportMutationError,
      syncTeamFromMutationResult,
      teamCapSheet,
      teamCode,
      worldId,
    ]
  );

  const finalizeCapMutationResult = useCallback(
    async (
      mutationResult: {
        applied: boolean;
        message?: string;
        persistPromise: Promise<boolean> | null;
      },
      failureMessage: string
    ): Promise<MutationActionResult> => {
      if (!mutationResult.applied) {
        return {
          success: false,
          message: mutationResult.message || failureMessage,
        };
      }
      const persisted = mutationResult.persistPromise
        ? await mutationResult.persistPromise
        : true;
      if (!persisted) {
        return {
          success: false,
          message: mutationResult.message || failureMessage,
        };
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

  return {
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
  };
}
