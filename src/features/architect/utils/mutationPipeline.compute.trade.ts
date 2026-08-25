/**
 * FILE: src/features/architect/utils/mutationPipeline.compute.trade.ts
 * PURPOSE: Trade compute functions — getTradeValidationApplyTimeSlice and computeTradeResult.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 8 Step 3: Extracted from mutationPipeline.compute.ts (L106-L395).
 */

import {
  buildTradePlayerPersistenceManifest,
  materializeCurrentStateBaseTeamPreservedFields,
  toOptionalTrimmedString,
} from './mutationPipeline.helpers';
import { toEndYear } from '@/features/architect/utils/seasonFormat';
import { applyTradeExceptionLifecycle } from '@/features/architect/utils/tradeMachine/utils/tradeExceptionLifecycle';
import { appendExceptionHistory } from '@/features/architect/utils/exceptionHistory/historyHelpers';
import { assertTradeComputeInputs } from '@/features/architect/utils/tradeContext';
import { createTradeHardCapLedgerEntry } from '@/features/architect/utils/tradeMachine/utils/tradeApronRestrictions';
import { normalizeContractForWorld } from '@/features/architect/utils/contractNormalization';
import { buildGovernedSigningHistory } from '@/features/architect/utils/signings';
import type { GovernedSigningAuthority } from '@/features/architect/utils/signings';
import {
  appendSigningSalaryBookAdjustments,
  updateIncompleteRosterChargeAfterSigning,
} from './mutationPipeline.compute.signings.signing';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals';
import { GovernedSignAndTradeReceiptZ } from '@/schemas/governedSignAndTrade';
import { mutationSnapshotDigest } from './mutationPipeline.snapshotDigest';
import { normalizeTradeTeamCodeLike } from '@/features/architect/utils/tradeContext/tradeContext';
import { resolveGovernedSeasonEnvelope } from '@/features/architect/utils/governedSeason';
import type { TradeContextCurrentState } from '@/features/architect/utils/tradeContext/types';
import type {
  ComputeResultLike,
  EntitlementUpdateLike,
  PlayerDeleteLike,
  PlayerUpdateLike,
  TeamLike,
  TradeApplyValidationTeamLike,
  TradeEntitlementsMovedByTeam,
  TradeHistoryContextLike,
  TradeMutationMetadata,
  TradeMutationPayload,
  TradeSnapshotLike,
  TradeTeamUpdate,
  TradeTpeConsumptionIssue,
  TradeValidatedContextLike,
  TradeValidationApplyTimeSlice,
  ArchitectMutationContract,
  ArchitectMutationPlayerRecord,
  ArchitectMutationTeamRecord,
} from './mutationPipeline';
import type { GovernedSignAndTradeAuthority } from '@/schemas/governedSignAndTrade';

function safeIntegerMoney(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) ? amount : null;
}

export function getTradeValidationApplyTimeSlice(
  validatedContext: TradeValidatedContextLike
): TradeValidationApplyTimeSlice {
  const rawValidation = validatedContext._rawValidation;
  if (rawValidation) {
    return {
      legal: Boolean(rawValidation.legal),
      teamResults: Array.isArray(rawValidation.teamResults)
        ? rawValidation.teamResults
        : [],
    };
  }

  return {
    legal: Boolean(validatedContext.legal),
    teamResults: Array.isArray(validatedContext.teamResults)
      ? validatedContext.teamResults
      : [],
  };
}

export function computeTradeResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  historyContext = {},
  postTradeSnapshot,
  validatedContext,
  governedSignAndTradeAuthority = null,
}: {
  payload: TradeMutationPayload;
  currentState: TradeContextCurrentState;
  seasonId: string;
  timestamp: number;
  historyContext?: TradeHistoryContextLike;
  postTradeSnapshot: TradeSnapshotLike;
  validatedContext: TradeValidatedContextLike;
  governedSignAndTradeAuthority?: GovernedSignAndTradeAuthority | null;
}): ComputeResultLike {
  // Phase 58: Use shared assertions from tradeContext module
  // (replaces Phase 56 inline checks with centralized assertions)
  assertTradeComputeInputs({
    postTradeSnapshot,
    validatedContext,
    callSite: 'computeTradeResult',
  });

  const playerUpdates: PlayerUpdateLike[] = [];
  const playerDeletes: PlayerDeleteLike[] = [];
  const tradeTeams = Array.isArray(payload.teams) ? payload.teams : [];

  const currentYear = toEndYear(seasonId) ?? new Date(timestamp).getFullYear();
  const timestampISO = new Date(timestamp).toISOString();
  const resolvedWorldId =
    historyContext.worldId || payload?.tradeCtx?.worldId || null;
  const resolvedMutationType = historyContext.mutationType || 'executeTrade';
  const resolvedMutationId = historyContext.mutationId;

  // Phase 56: Use pre-built snapshot teamUpdates (already has roster changes applied)
  // Deep clone to avoid mutating the snapshot
  const teamUpdates: TradeTeamUpdate[] = (
    postTradeSnapshot.teamUpdates || []
  ).map((entry) => {
    const clonedTeam = JSON.parse(JSON.stringify(entry.team || {})) as TeamLike;
    return {
      teamCode: entry.teamCode ?? null,
      team:
        materializeCurrentStateBaseTeamPreservedFields(clonedTeam) ||
        clonedTeam,
    };
  });

  // Phase 56: Use validation results from validatedContext (already validated once)
  const validation = getTradeValidationApplyTimeSlice(validatedContext);

  // Phase 56: Use only the authoritative apply-time validationTeams from context.
  const validationTeams: TradeApplyValidationTeamLike[] =
    validatedContext.validationTeams;

  // Warn if multi-team trade without directed routing (informational only)
  if (tradeTeams.length > 2) {
    const hasDirectedRouting = tradeTeams.some((teamTrade) =>
      (teamTrade.sends || []).some(
        (sentPlayer) =>
          toOptionalTrimmedString(sentPlayer.tradeTo) !== undefined
      )
    );
    if (!hasDirectedRouting) {
      console.warn(
        'Multi-team trade detected without directed routing (tradeTo). ' +
          'Apply-time snapshot building will fail closed with TRADE_APPLY_ROUTING_ERROR.'
      );
    }
  }

  // ============================================================================
  // Phase 56: Apply validated TPE creation/consumption to each team
  // (validation already ran externally via validatePostTradeSnapshotForContext)
  // ============================================================================
  teamUpdates.forEach((teamUpdate: TradeTeamUpdate, idx: number) => {
    const teamResult = validation.teamResults?.[idx];
    if (!teamResult) return;

    const updatedTeam = teamUpdate.team;
    if (!updatedTeam) return;
    const lifecycleResult = applyTradeExceptionLifecycle({
      currentTradeExceptions: updatedTeam.tradeExceptions || [],
      hasTradeExceptionsValidation: Boolean(teamResult.rules?.tradeExceptions),
      createdTPE: teamResult.createdTPE,
      incomingPlayers: validationTeams[idx]?.receives || [],
      outgoingPlayers: tradeTeams[idx]?.sends || [],
      teamCode: teamUpdate.teamCode || '',
      seasonId,
      seasonYear: currentYear,
      timestampISO,
      worldId: resolvedWorldId,
      mutationType: resolvedMutationType,
      mutationId: resolvedMutationId,
    });

    if (lifecycleResult.blockingIssues.length > 0) {
      teamResult._tpeConsumptionErrors = lifecycleResult.blockingIssues;
      teamResult._blocked = true;
      console.error(
        '[mutationPipeline] TPE fail-closed: blocking mutation due to invalid TPE state:',
        lifecycleResult.blockingIssues
      );
    }

    if (lifecycleResult.warnings.length > 0) {
      const isDev =
        import.meta.env?.DEV || process.env.NODE_ENV === 'development';
      if (isDev) {
        console.warn(
          '[mutationPipeline] Phase 47C TPE consumption warnings:',
          lifecycleResult.warnings
        );
      }
      teamResult._tpeConsumptionWarnings = lifecycleResult.warnings;
    }

    updatedTeam.tradeExceptions = lifecycleResult.updatedTradeExceptions;

    if (lifecycleResult.historyEntries.length > 0) {
      appendExceptionHistory(updatedTeam, lifecycleResult.historyEntries);
    }

    const transactionId =
      resolvedMutationId || `${resolvedMutationType}:${timestamp}`;
    const ledgerTeamCode = teamUpdate.teamCode;
    const hardCapEntry =
      ledgerTeamCode && teamResult.apronRestrictionEvaluation
        ? createTradeHardCapLedgerEntry({
            evaluation: teamResult.apronRestrictionEvaluation,
            teamCode: ledgerTeamCode,
            transactionId,
            effectiveAt: timestampISO,
          })
        : null;
    if (hardCapEntry) {
      const currentLedger = Array.isArray(updatedTeam.hardCapLedger)
        ? updatedTeam.hardCapLedger
        : [];
      updatedTeam.hardCapLedger = currentLedger.some(
        (entry) => entry.entryId === hardCapEntry.entryId
      )
        ? currentLedger
        : [...currentLedger, hardCapEntry];
    }
  });

  // Phase 11.3: Build entitlementsTraded structure for event log
  // Format: { [teamCode]: { out: string[], in: string[] } }
  // Phase 11.3.1: Respect toTeamId routing when present (for multi-team trades)
  const entitlementsTraded: TradeEntitlementsMovedByTeam = {};
  for (const teamTrade of tradeTeams) {
    const teamKey = normalizeTradeTeamCodeLike(teamTrade.teamCode);
    if (!teamKey) {
      continue;
    }

    // Outgoing entitlement IDs from this team (unchanged)
    const outIds = (teamTrade.entitlementsOut || [])
      .map((entitlement) => {
        const rawEntitlementId = entitlement.entitlementId ?? entitlement.id;
        return rawEntitlementId == null ? null : String(rawEntitlementId);
      })
      .filter((entitlementId): entitlementId is string =>
        Boolean(entitlementId)
      );

    // Incoming entitlement IDs: respect toTeamId routing when present
    // Phase 11.3.1: Only include entitlement if:
    //   - toTeamId is NOT set (broadcast mode - all teams receive)
    //   - OR toTeamId matches this team's key (teamKey or teamCode)
    const inIds: string[] = [];
    for (const otherTrade of tradeTeams) {
      const otherTeamKey = normalizeTradeTeamCodeLike(otherTrade.teamCode);
      if (otherTeamKey === teamKey) {
        continue;
      }

      for (const entitlement of otherTrade.entitlementsOut || []) {
        const rawEntitlementId = entitlement.entitlementId ?? entitlement.id;
        const entitlementId =
          rawEntitlementId == null ? null : String(rawEntitlementId);
        if (!entitlementId) {
          continue;
        }

        const routedTo =
          entitlement.toTeamId == null ? null : String(entitlement.toTeamId);
        const teamCode = normalizeTradeTeamCodeLike(teamTrade.teamCode);
        if (!routedTo || routedTo === teamKey || routedTo === teamCode) {
          inIds.push(entitlementId);
        }
      }
    }

    // Only add entry if there are entitlement transfers
    if (outIds.length > 0 || inIds.length > 0) {
      entitlementsTraded[teamKey] = {
        out: [...new Set(outIds)],
        in: [...new Set(inIds)],
      };
    }
  }

  // TM-PICKS-E1: Build entitlementUpdates for holderTeam patches
  // When an entitlement is traded, we need to update its holderTeam field
  // in the world overlay so downstream readers see the correct owner.
  const entitlementUpdates: EntitlementUpdateLike[] = [];
  if (Object.keys(entitlementsTraded).length > 0) {
    for (const [teamKey, transfers] of Object.entries(entitlementsTraded)) {
      // For each entitlement this team received, patch holderTeam to this team
      for (const entitlementId of transfers.in) {
        entitlementUpdates.push({
          entitlementId,
          holderTeam: teamKey,
        });
      }
    }
  }

  // FAIL-CLOSED: If any team had TPE consumption errors, block the entire mutation
  const blockedTeams = (validation.teamResults || []).filter(
    (teamResult) => teamResult?._blocked
  );
  if (blockedTeams.length > 0) {
    const allErrors = blockedTeams
      .flatMap((teamResult) =>
        Array.isArray(teamResult._tpeConsumptionErrors)
          ? teamResult._tpeConsumptionErrors
          : []
      )
      .filter(
        (issue): issue is TradeTpeConsumptionIssue =>
          !!issue &&
          typeof issue === 'object' &&
          'reason' in issue &&
          typeof (issue as { reason?: unknown }).reason === 'string'
      );
    return {
      success: false,
      error: `TPE fail-closed: ${allErrors.map((issue) => issue.reason).join('; ')}`,
      _tpeConsumptionErrors: allErrors,
    };
  }

  const salaryMatchingPaths = validation.teamResults.flatMap(
    (teamResult, index) => {
      const teamCode = teamUpdates[index]?.teamCode;
      if (!teamCode || !teamResult.salaryMatchingPathEvaluation) return [];
      return [
        {
          teamCode,
          evaluation: teamResult.salaryMatchingPathEvaluation,
        },
      ];
    }
  );
  const apronRestrictions = validation.teamResults.flatMap(
    (teamResult, index) => {
      const teamCode = teamUpdates[index]?.teamCode;
      if (!teamCode || !teamResult.apronRestrictionEvaluation) return [];
      return [
        {
          teamCode,
          evaluation: teamResult.apronRestrictionEvaluation,
        },
      ];
    }
  );

  let governedSignAndTradeReceipt = null;
  if (governedSignAndTradeAuthority) {
    const authority = governedSignAndTradeAuthority;
    const sourceUpdate = teamUpdates.find(
      (entry) => entry.teamCode === authority.sourceTeamId
    );
    const destinationUpdate = teamUpdates.find(
      (entry) => entry.teamCode === authority.destinationTeamId
    );
    const sourceBefore = currentState.teams.find(
      (entry) => entry.teamCode === authority.sourceTeamId
    )?.team;
    const destinationBefore = currentState.teams.find(
      (entry) => entry.teamCode === authority.destinationTeamId
    )?.team;
    if (
      !sourceUpdate?.team ||
      !destinationUpdate?.team ||
      !sourceBefore ||
      !destinationBefore ||
      !resolvedWorldId ||
      !resolvedMutationId
    ) {
      return {
        success: false,
        error:
          'Governed sign-and-trade cannot reconcile both exact Team snapshots and operation identity.',
      };
    }
    const destinationPlayer = (destinationUpdate.team.players || []).find(
      (candidate) =>
        String(
          candidate.player_id || candidate.playerId || candidate.id || ''
        ) === authority.playerId
    );
    if (!destinationPlayer?.contract) {
      return {
        success: false,
        error:
          'Governed sign-and-trade did not author the Contract on the receiving Team.',
      };
    }
    const normalizedContract = normalizeContractForWorld({
      ...destinationPlayer.contract,
      contractType: 'Sign & Trade',
      signingTeam: authority.sourceTeamId,
      signingDate: authority.transactionAt,
      signedUsing: authority.contract.signedUsing,
    }) as ArchitectMutationContract | null;
    const normalizedRows = (normalizedContract?.salariesByYear || []).map(
      (row) => ({
        season: row.season,
        salary: row.salary,
        capHit: row.capHit,
        guaranteed: row.guaranteed,
        guaranteedAmount: row.guaranteedAmount,
        option: row.option ?? null,
        likelyBonuses: Number(row.incentives?.likely || 0),
        unlikelyBonuses: Number(row.incentives?.unlikely || 0),
      })
    );
    if (
      !normalizedContract ||
      mutationSnapshotDigest(normalizedRows) !==
        mutationSnapshotDigest(authority.contract.rows)
    ) {
      return {
        success: false,
        error:
          'The authored sign-and-trade Contract diverged from its live governed authority.',
      };
    }
    destinationPlayer.contract = normalizedContract;
    const signingEnvelope = resolveGovernedSeasonEnvelope({
      asOfDate: authority.transactionAt,
      salaryCapYear: authority.salaryCapYear,
      requiredAuthority: 'official',
      team: {
        teamId: authority.destinationTeamId,
        teamCode: authority.destinationTeamId,
        worldId: authority.worldId,
      },
    });
    if (
      signingEnvelope.status !== 'complete' ||
      !signingEnvelope.inputManifest ||
      mutationSnapshotDigest(signingEnvelope.inputManifest) !==
        mutationSnapshotDigest(authority.seasonInputManifest)
    ) {
      return {
        success: false,
        error:
          'Governed sign-and-trade signing authority no longer matches the live official Season inputs.',
      };
    }
    const signingAuthority: GovernedSigningAuthority = {
      worldDate: authority.transactionAt,
      effectiveAt: authority.transactionAt,
      salaryCapYear: authority.salaryCapYear,
      seasonKey: authority.seasonKey,
      firstYearSalary: authority.contract.firstSeasonSalary,
      firstYearCapHit: authority.contract.rows[0].capHit,
      exceptionCharge: authority.contract.firstSeasonSalary,
      canonLeafIds: authority.canonLeafIds,
      seasonInputManifest: signingEnvelope.inputManifest,
    };
    const signingHistory = buildGovernedSigningHistory({
      contract: normalizedContract,
      playerId: authority.playerId,
      teamId: authority.destinationTeamId,
      signingTeamId: authority.sourceTeamId,
      sourceKind: 'saved-world-sign-and-trade',
      worldId: resolvedWorldId,
      operationId: resolvedMutationId,
      authoringIdentity: authority.authoringIdentity,
      recordedAt: authority.recordedAt,
      authority: signingAuthority,
    });
    destinationUpdate.team.contractEventLedgers = [
      ...(destinationUpdate.team.contractEventLedgers || []).filter(
        (ledger) => ledger.ledgerId !== signingHistory.ledger.ledgerId
      ),
      signingHistory.ledger,
    ];
    const sourceRosterChargeError = updateIncompleteRosterChargeAfterSigning({
      beforeTeam: sourceBefore as ArchitectMutationTeamRecord,
      afterTeam: sourceUpdate.team as ArchitectMutationTeamRecord,
      salaryCapYear: authority.salaryCapYear,
      effectiveAt: authority.transactionAt,
      requireAuthenticatedBasis: true,
    });
    const destinationRosterChargeError =
      updateIncompleteRosterChargeAfterSigning({
        beforeTeam: destinationBefore as ArchitectMutationTeamRecord,
        afterTeam: destinationUpdate.team as ArchitectMutationTeamRecord,
        salaryCapYear: authority.salaryCapYear,
        effectiveAt: authority.transactionAt,
        requireAuthenticatedBasis: true,
      });
    if (sourceRosterChargeError || destinationRosterChargeError) {
      return {
        success: false,
        error: sourceRosterChargeError || destinationRosterChargeError || '',
      };
    }
    const salaryBookError = appendSigningSalaryBookAdjustments({
      team: destinationUpdate.team as ArchitectMutationTeamRecord,
      player: destinationPlayer as ArchitectMutationPlayerRecord,
      contract: normalizedContract,
      authority: signingAuthority,
      mechanism: 'CAP_SPACE_OR_RIGHTS',
      operationId: resolvedMutationId,
    });
    if (salaryBookError) {
      return { success: false, error: salaryBookError };
    }
    [sourceUpdate, destinationUpdate].forEach((entry) => {
      entry.team!.totals = createCanonicalTeamTotalsSnapshot(
        entry.team!,
        authority.salaryCapYear,
        { asOfDate: authority.transactionAt }
      );
    });
    const destinationApron = apronRestrictions.find(
      (entry) => entry.teamCode === authority.destinationTeamId
    )?.evaluation;
    const destinationSalaryPath = salaryMatchingPaths.find(
      (entry) => entry.teamCode === authority.destinationTeamId
    )?.evaluation;
    const destinationAcquisitionCapacity =
      destinationSalaryPath?.maximumIncoming == null
        ? null
        : destinationSalaryPath.electedPath === 'ROOM'
          ? destinationSalaryPath.maximumIncoming -
            (destinationSalaryPath.allowance || 0)
          : destinationSalaryPath.maximumIncoming;
    if (
      destinationSalaryPath?.status !== 'PASS' ||
      destinationAcquisitionCapacity === null ||
      authority.salaryTreatment.assigneeRoomAmount >
        destinationAcquisitionCapacity
    ) {
      return {
        success: false,
        error:
          destinationAcquisitionCapacity === null
            ? destinationSalaryPath?.missingInputs.length
              ? `Governed sign-and-trade assignee salary path lacks exact input: ${destinationSalaryPath.missingInputs.join(', ')}.`
              : destinationSalaryPath?.violations.length
                ? `Governed sign-and-trade assignee salary path failed: ${destinationSalaryPath.violations.join('; ')}`
                : 'Governed sign-and-trade cannot authenticate the assignee Room or qualifying Exception capacity.'
            : `Governed sign-and-trade Salary plus unlikely bonuses exceeds assignee Room by $${(
                authority.salaryTreatment.assigneeRoomAmount -
                destinationAcquisitionCapacity
              ).toLocaleString('en-US')}.`,
      };
    }
    const hardCapEntry = (destinationUpdate.team.hardCapLedger || []).find(
      (entry) =>
        entry.transactionId === resolvedMutationId &&
        entry.triggers.some((trigger) => trigger.restrictionRow === 'C')
    );
    if (
      destinationApron?.status !== 'PASS' ||
      !destinationApron.attachedRestrictions.some(
        (trigger) => trigger.restrictionRow === 'C'
      ) ||
      !hardCapEntry
    ) {
      return {
        success: false,
        error: `The receiving Team lacks a complete governed Row C First Apron hard-cap result (status=${destinationApron?.status || 'missing'}, rowC=${destinationApron?.attachedRestrictions.some((trigger) => trigger.restrictionRow === 'C') === true ? 'present' : 'missing'}, ledger=${hardCapEntry ? 'present' : 'missing'}, missingInputs=${destinationApron?.missingInputs.join(',') || 'none'}).`,
      };
    }
    const destinationApronTeamSalary = safeIntegerMoney(
      (destinationUpdate.team.totals as Record<string, unknown>).apronTeamSalary
    );
    if (
      destinationApronTeamSalary === null ||
      destinationApron.postTransactionApronTeamSalary !==
        destinationApronTeamSalary ||
      destinationApronTeamSalary > hardCapEntry.ceiling
    ) {
      return {
        success: false,
        error:
          'The receiving Team’s live post-transaction Apron Team Salary does not reconcile to its governed Row C First Apron result.',
      };
    }
    const salaryBooks = [];
    for (const entry of [sourceUpdate, destinationUpdate]) {
      const totals = entry.team!.totals as Record<string, unknown>;
      const teamSalary = safeIntegerMoney(totals.teamSalary);
      const apronTeamSalary = safeIntegerMoney(totals.apronTeamSalary);
      const taxSalary = safeIntegerMoney(totals.taxSalary);
      if (
        teamSalary === null ||
        apronTeamSalary === null ||
        taxSalary === null
      ) {
        return {
          success: false,
          error: `Governed salary books are incomplete for ${entry.teamCode}.`,
        };
      }
      salaryBooks.push({
        teamId: String(entry.teamCode),
        teamSalary,
        apronTeamSalary,
        taxSalary,
      });
    }
    const tradeReceipt = {
      receiptVersion: 1,
      worldId: resolvedWorldId,
      transactionId: resolvedMutationId,
      playerId: authority.playerId,
      sourceTeamId: authority.sourceTeamId,
      destinationTeamId: authority.destinationTeamId,
      transactionAt: authority.transactionAt,
      assignorSalary: authority.salaryTreatment.assignorSalary,
      assigneeSalary: authority.salaryTreatment.assigneeSalary,
      assigneeRoomAmount: authority.salaryTreatment.assigneeRoomAmount,
      assigneeAcquisitionCapacity: destinationAcquisitionCapacity,
      bycTriggered: authority.salaryTreatment.bycTriggered,
      poisonPillTriggered: authority.salaryTreatment.poisonPillTriggered,
      salaryMatchingPaths,
      apronRestrictions,
      salaryBooks,
    };
    governedSignAndTradeReceipt = GovernedSignAndTradeReceiptZ.parse({
      receiptVersion: 1,
      receiptId: `${resolvedMutationId}:sign-and-trade-receipt`,
      transactionId: resolvedMutationId,
      worldId: resolvedWorldId,
      sourceTeamId: authority.sourceTeamId,
      destinationTeamId: authority.destinationTeamId,
      playerId: authority.playerId,
      salaryCapYear: authority.salaryCapYear,
      transactionAt: authority.transactionAt,
      committedAt: authority.recordedAt,
      authorityDigest: mutationSnapshotDigest(authority),
      contractId: signingHistory.contractId,
      contractEventId: signingHistory.eventId,
      contractLedgerId: signingHistory.ledger.ledgerId,
      contractLedgerVersion: signingHistory.ledger.ledgerVersion,
      hardCapEntryId: hardCapEntry.entryId,
      salaryBooks,
      tradeReceipt,
      verificationStatus: 'complete',
      canonLeafIds: authority.canonLeafIds,
    });
  }

  const tradePlayerManifest = buildTradePlayerPersistenceManifest({
    payload,
    currentState,
    teamUpdates,
  });

  if ('error' in tradePlayerManifest) {
    return {
      success: false,
      error: tradePlayerManifest.error,
    };
  }

  playerUpdates.push(...tradePlayerManifest.playerUpdates);
  playerDeletes.push(...tradePlayerManifest.playerDeletes);

  const metadata: TradeMutationMetadata = {
    type: 'trade',
    teamsInvolved: teamUpdates.map((teamUpdate) => teamUpdate.teamCode),
    playersTraded: tradeTeams.flatMap((teamTrade) =>
      (teamTrade.sends || []).map(
        (player) => player.player_id || player.displayName || player.name
      )
    ),
    // Phase 11.3: Include entitlement transfers per team (IDs only for lightweight payload)
    entitlementsTraded:
      Object.keys(entitlementsTraded).length > 0
        ? entitlementsTraded
        : undefined,
    salaryMatchingPaths:
      salaryMatchingPaths.length > 0 ? salaryMatchingPaths : undefined,
    apronRestrictions:
      apronRestrictions.length > 0 ? apronRestrictions : undefined,
    timestamp,
    ...(governedSignAndTradeAuthority ? { governedSignAndTradeAuthority } : {}),
    ...(governedSignAndTradeReceipt ? { governedSignAndTradeReceipt } : {}),
  };

  // Phase 56: Return pure compute result - validation context is passed through, not created here
  return {
    success: true,
    ...(governedSignAndTradeAuthority
      ? { _requiresGovernedSignAndTradePersistence: true }
      : {}),
    teamUpdates,
    playerUpdates,
    playerDeletes,
    // TM-PICKS-E1: Include entitlement doc patches for persistence
    entitlementUpdates,
    metadata,
    // Phase 56: Pass through the provided validated context (created externally)
    _validatedTradeContext: validatedContext,
  };
}
