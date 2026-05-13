/**
 * FILE: src/features/architect/utils/mutationPipeline.compute.ts
 * PURPOSE: Compute-phase helpers for world mutations — all compute*Result() functions.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 4 Step 4d: Extracted from mutationPipeline.ts (L3820-5194, L5608-end).
 * These are pure computation functions: no Firebase, no React, no read.ts calls.
 * The orchestrator (computeWorldMutation) stays in mutationPipeline.ts.
 */

import {
  buildCanonicalPlayerPersistenceManifest,
  buildTradePlayerPersistenceManifest,
  findPlayerInTeamPlayers,
  getMutationPlayerId,
  getMutationRosterEntryId,
  getSalaryRowEndYear,
  getTeamSourceRecord,
  materializeCurrentStateBaseTeamPreservedFields,
  normalizeMutationExceptionsFromIngress,
  requireBasicTeamAndPlayerState,
  requireBasicTeamState,
  requireDestinationState,
  requireOfferSheetTeamState,
  requireSigningState,
  synchronizeTeamTotalsSnapshotOrTeam,
  toMutationExceptionPreserveOnlyBuckets,
  toOptionalNumber,
  toOptionalTrimmedString,
} from './mutationPipeline.helpers';

import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import {
  normalizeContractForWorld,
  normalizeFutureContract,
  normalizeSalaryRow,
} from '@/features/architect/utils/contractNormalization';
import {
  computeExpectedCapHoldAmount,
  deriveFreeAgencyYearFromOptionSeason,
  getRightsTypeFromPlayer,
} from '@/features/architect/utils/capHoldTransitionHelpers';
import { appendExceptionHistory } from '@/features/architect/utils/exceptionHistory/historyHelpers';
import { applyTradeExceptionLifecycle } from '@/features/architect/utils/tradeMachine/utils/tradeExceptionLifecycle';
import {
  getCanonicalExceptionAvailability,
  getCanonicalExceptionKeyForSigningMechanism,
} from '@/features/architect/utils/exceptions/exceptionOwnership';
import { getSigningHardCapTriggerMetadata } from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import {
  buildSignAndTradeTradeHandoff,
  normalizeTradeTeamCodeLike,
} from '@/features/architect/utils/tradeContext/tradeContext';

import { assertTradeComputeInputs } from '@/features/architect/utils/tradeContext';
import {
  matchesOfferSheetIdentity,
  buildNormalizedOfferSheetFinalContract,
  removeOfferSheetEntries,
  validateSignAndTradeSigningPhase,
} from './mutationPipeline.read';

import type { TradeContextCurrentState } from '@/features/architect/utils/tradeContext/types';
import type { MutationExceptionPreserveOnlyBuckets } from './mutationPipeline.read';
import type {
  ArchitectMutationContract,
  ArchitectMutationExceptionEntry,
  ArchitectMutationExceptions,
  ArchitectMutationOfferSheet,
  ArchitectMutationPlayerRecord,
  ArchitectMutationTeamRecord,
  ArchitectMutationTeamUpdate,
  CapHoldComputationPlayer,
  ComputeMutationParamsWithCurrentState,
  ComputeResultLike,
  CurrentStateTeamRoundTripMaterializable,
  EntitlementUpdateLike,
  MutationOfferSheetMirrorCurrentState,
  MutationOfferSheetResolutionCurrentState,
  MutationOfferSheetTeamAndPlayerCurrentState,
  MutationPayloadInputByType,
  MutationPipelineSalaryRow,
  MutationSignAndTradeCurrentState,
  MutationSigningCurrentState,
  MutationTeamAndPlayerCurrentState,
  MutationTeamOnlyCurrentState,
  NormalizedMutationSalaryRow,
  PlayerDeleteLike,
  PlayerUpdateLike,
  TeamLike,
  TradeMutationPayload,
  TradeApplyValidationTeamLike,
  TradeEntitlementsMovedByTeam,
  TradeHistoryContextLike,
  TradeMutationMetadata,
  TradeSnapshotLike,
  TradeTeamUpdate,
  TradeTpeConsumptionIssue,
  TradeValidatedContextLike,
  TradeValidationApplyTimeSlice,
} from './mutationPipeline';

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
}: {
  payload: TradeMutationPayload;
  currentState: TradeContextCurrentState;
  seasonId: string;
  timestamp: number;
  historyContext?: TradeHistoryContextLike;
  postTradeSnapshot: TradeSnapshotLike;
  validatedContext: TradeValidatedContextLike;
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
    timestamp,
  };

  // Phase 56: Return pure compute result - validation context is passed through, not created here
  return {
    success: true,
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

export function resolveSigningMechanismForPipeline(
  contract: ArchitectMutationContract | null | undefined,
  signedUsing: string | null | undefined
) {
  const source = contract?.exceptionType || signedUsing;
  if (!source) {
    return 'UNKNOWN';
  }

  const normalized = String(source)
    .toLowerCase()
    .replace(/[^a-z]/g, '');

  if (
    normalized === 'fullmle' ||
    normalized === 'ntmle' ||
    normalized === 'mle' ||
    normalized === 'full'
  ) {
    return 'FULL_MLE';
  }
  if (
    normalized === 'tpmle' ||
    normalized === 'taxpayermle' ||
    normalized.includes('taxpayer')
  ) {
    return 'TPMLE';
  }
  if (
    normalized === 'roommle' ||
    normalized === 'rmle' ||
    normalized.includes('room')
  ) {
    return 'ROOM_MLE';
  }
  if (normalized === 'bae' || normalized === 'biannual') {
    return 'BAE';
  }
  if (
    normalized === 'minimum' ||
    normalized === 'min' ||
    normalized === 'vetminimum' ||
    normalized === 'vetmin'
  ) {
    return 'MINIMUM';
  }
  if (
    normalized === 'tenday' ||
    normalized.includes('tenday') ||
    normalized.includes('day')
  ) {
    return 'TEN_DAY';
  }

  return 'UNKNOWN';
}

export function toFiniteAmount(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function toFiniteIntegerOrNull(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
}

export function sumContractValueFromRows(
  contract:
    | ArchitectMutationContract
    | {
        salariesByYear?: Array<{
          salary?: number | string | null;
          capHit?: number | string | null;
        }> | null;
      }
    | null
    | undefined
) {
  if (!Array.isArray(contract?.salariesByYear)) {
    return 0;
  }

  return contract.salariesByYear.reduce(
    (total, row) => total + toFiniteAmount(row?.salary ?? row?.capHit, 0),
    0
  );
}

export function toCapHoldComputationPlayer(
  player: ArchitectMutationPlayerRecord
): CapHoldComputationPlayer {
  const yearsExperience = toFiniteIntegerOrNull(player.bio?.yearsExperience);
  const draftRound = toFiniteIntegerOrNull(player.draft?.round);
  const draftPick = toFiniteIntegerOrNull(player.draft?.pick);
  const contractBirdRightsStatus =
    typeof player.contract?.birdRights?.status === 'string'
      ? player.contract.birdRights.status
      : typeof player.contract?.birdRights?.type === 'string'
        ? player.contract.birdRights.type
        : undefined;
  const fallbackBirdRights =
    typeof player.birdRights === 'string'
      ? player.birdRights
      : typeof player.birdRights?.status === 'string'
        ? player.birdRights.status
        : typeof player.birdRights?.type === 'string'
          ? player.birdRights.type
          : undefined;

  return {
    renounced: player.renounced === true,
    bio:
      player.bio || yearsExperience != null
        ? {
            yearsExperience: yearsExperience ?? undefined,
          }
        : undefined,
    contract:
      player.contract || contractBirdRightsStatus
        ? {
            birdRights: contractBirdRightsStatus
              ? { status: contractBirdRightsStatus }
              : undefined,
            salariesByYear: Array.isArray(player.contract?.salariesByYear)
              ? player.contract.salariesByYear.map((row) => ({
                  season:
                    typeof row?.season === 'string' ? row.season : undefined,
                  salary:
                    typeof row?.salary === 'number' ? row.salary : undefined,
                  capHit:
                    typeof row?.capHit === 'number' ? row.capHit : undefined,
                }))
              : undefined,
          }
        : undefined,
    draft:
      player.draft || draftRound != null || draftPick != null
        ? {
            round: draftRound ?? undefined,
            pick: draftPick ?? undefined,
          }
        : undefined,
    birdRights: fallbackBirdRights,
  };
}

export function consumeSigningExceptionUsage({
  updatedTeam,
  mechanism,
  contractValue,
  timestamp,
}: {
  updatedTeam: ArchitectMutationTeamRecord;
  mechanism: string;
  contractValue: number;
  timestamp: number;
}) {
  // Phase 74 guardrail compatibility markers:
  // exceptionType === 'room'
  // updatedTeam.exceptions.room
  // updatedTeam.exceptions.room.usedAmount
  const exceptionKey = getCanonicalExceptionKeyForSigningMechanism(mechanism);
  if (!exceptionKey) {
    return { consumedExceptionKey: null, error: null };
  }

  updatedTeam.exceptions = normalizeMutationExceptionsFromIngress(
    updatedTeam.exceptions
  );

  const availability = getCanonicalExceptionAvailability(
    updatedTeam,
    exceptionKey
  );
  if (!availability.present) {
    return {
      consumedExceptionKey: null,
      error: `Cannot use ${mechanism} - canonical ${exceptionKey.toUpperCase()} owner is missing.`,
    };
  }
  if (!availability.enabled) {
    return {
      consumedExceptionKey: null,
      error: `Cannot use ${mechanism} - canonical ${exceptionKey.toUpperCase()} owner is disabled.`,
    };
  }
  if (!availability.usable) {
    return {
      consumedExceptionKey: null,
      error: `Cannot use ${mechanism} - canonical ${exceptionKey.toUpperCase()} owner has no remaining amount.`,
    };
  }

  if (contractValue <= 0) {
    return {
      consumedExceptionKey: null,
      error: `Cannot use ${mechanism} - signing contract value is missing or zero, so canonical exception usage cannot be consumed.`,
    };
  }

  const currentState = availability.entry;
  const normalizedState: ArchitectMutationExceptionEntry = currentState
    ? { ...(currentState as ArchitectMutationExceptionEntry) }
    : {
        enabled: true,
        maxAmount: 0,
        totalAmount: 0,
        amount: 0,
        usedAmount: 0,
        remainingAmount: 0,
      };

  normalizedState.enabled = true;
  normalizedState.available = true;
  normalizedState.maxAmount = availability.totalAmount;
  normalizedState.totalAmount = availability.totalAmount;
  normalizedState.amount = availability.totalAmount;
  normalizedState.usedAmount = availability.usedAmount + contractValue;
  normalizedState.remainingAmount = Math.max(
    0,
    availability.remainingAmount - contractValue
  );
  normalizedState.lastUsedAt = new Date(timestamp).toISOString();

  updatedTeam.exceptions = {
    ...updatedTeam.exceptions,
    [exceptionKey]: normalizedState,
  };
  return {
    consumedExceptionKey: exceptionKey,
    error: null,
  };
}

export function computeSigningResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationSigningCurrentState,
  MutationPayloadInputByType['signFreeAgent']
>): ComputeResultLike {
  const { team, player } = requireSigningState(currentState, 'signFreeAgent');
  const teamCode = currentState.teamCode || team.teamCode || null;
  const { contract, signedUsing } = payload;
  const signingMechanism = resolveSigningMechanismForPipeline(
    contract,
    signedUsing
  );

  const updatedTeam = { ...team };
  updatedTeam.exceptions = normalizeMutationExceptionsFromIngress(
    updatedTeam.exceptions
  );

  // Add player to roster if not already present
  const playerId = String(
    payload.playerId || player.player_id || player.id || ''
  ).trim();
  if (!playerId) {
    return {
      success: false,
      error: 'Player ID is required for signing.',
    };
  }
  const rosterEntries = Array.isArray(updatedTeam.roster)
    ? updatedTeam.roster
    : [];
  if (
    !rosterEntries.some((entry) => getMutationRosterEntryId(entry) === playerId)
  ) {
    updatedTeam.roster = [...rosterEntries, playerId];
  }

  // Update or add player to players array
  const existingPlayers = updatedTeam.players || [];
  const existingIndex = existingPlayers.findIndex(
    (existingPlayer) => getMutationPlayerId(existingPlayer) === playerId
  );

  // Normalize contract for world persistence (canonical field names/types)
  const normalizedContract = normalizeContractForWorld({
    ...contract,
    signingTeam: teamCode,
    signingDate: new Date(timestamp).toISOString(),
  }) as ArchitectMutationContract | null;

  const updatedPlayer = {
    ...player,
    teamCode,
    teamName: team.teamName,
    contract: normalizedContract,
  };

  if (existingIndex >= 0) {
    updatedTeam.players = [...existingPlayers];
    updatedTeam.players[existingIndex] = updatedPlayer;
  } else {
    updatedTeam.players = [...existingPlayers, updatedPlayer];
  }

  // Update exceptions if signing consumed one
  const contractValue = toFiniteAmount(
    contract?.totalValue,
    toFiniteAmount(
      normalizedContract?.totalValue,
      sumContractValueFromRows(normalizedContract || contract)
    )
  );
  const exceptionConsumption = consumeSigningExceptionUsage({
    updatedTeam,
    mechanism: signingMechanism,
    contractValue,
    timestamp,
  });
  if (exceptionConsumption.error) {
    return {
      success: false,
      error: exceptionConsumption.error,
    };
  }
  const consumedExceptionKey = exceptionConsumption.consumedExceptionKey;

  const signingHardCapTrigger =
    consumedExceptionKey && getSigningHardCapTriggerMetadata(signingMechanism);
  if (signingHardCapTrigger) {
    updatedTeam.hardCapped = 1;
    updatedTeam.hardCapLevel = signingHardCapTrigger.hardCapLevel;
    updatedTeam.hardCapReason = signingHardCapTrigger.hardCapReason;
    updatedTeam.hardCapTriggeredBy = signingHardCapTrigger.hardCapTriggeredBy;
  }
  // Phase 74: Room Exception usage tracking
  // Room Exception does NOT trigger hard cap.

  // Remove cap hold if player had one
  if (updatedTeam.capHolds) {
    updatedTeam.capHolds = updatedTeam.capHolds.filter(
      (hold) => hold.playerId !== playerId
    );
  }

  // Remove pending offer sheet if finalizing an RFA offer
  // (processed offer sheets are removed to prevent state staleness)
  // Remove pending offer sheet if finalizing an RFA offer
  // (processed offer sheets are removed to prevent state staleness)
  if (
    normalizedContract?.rfaOfferSheet &&
    'offerSheets' in updatedTeam &&
    Array.isArray(updatedTeam.offerSheets)
  ) {
    updatedTeam.offerSheets = updatedTeam.offerSheets.filter(
      (offerSheet) => String(offerSheet.playerId || '').trim() !== playerId
    );
  }

  // Update source metadata
  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals
  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedTeam,
    toEndYear(seasonId)
  ).totals;

  const teamUpdates: ArchitectMutationTeamUpdate[] = [
    { teamCode, team: updatedTeam },
  ];

  // Cleanup incomingOfferSheets on home team if applicable
  if (
    normalizedContract?.rfaOfferSheet &&
    currentState.homeTeam &&
    Array.isArray(currentState.homeTeam.incomingOfferSheets)
  ) {
    const existingIncomingOfferSheets = currentState.homeTeam.incomingOfferSheets;
    const updatedHomeTeam = {
      ...currentState.homeTeam,
      incomingOfferSheets: existingIncomingOfferSheets.filter(
        (offerSheet) => String(offerSheet.playerId || '').trim() !== playerId
      ),
    };
    // Only add update if something changed
    if (
      updatedHomeTeam.incomingOfferSheets.length !==
      existingIncomingOfferSheets.length
    ) {
      updatedHomeTeam.source = {
        ...getTeamSourceRecord(updatedHomeTeam.source),
        lastModifiedAt: new Date(timestamp).toISOString(),
      };
      teamUpdates.push({
        teamCode: currentState.homeTeam.teamCode,
        team: updatedHomeTeam,
      });
    }
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: [{ playerId, player: updatedPlayer }],
    metadata: {
      type: 'signing',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      contract: normalizedContract,
      rightsUsed: consumedExceptionKey || undefined,
      timestamp,
      signedUsing,
    },
  };
}

/**
 * Compute waive result
 */
export function computeWaiveResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationTeamAndPlayerCurrentState,
  MutationPayloadInputByType['waivePlayer']
>): ComputeResultLike {
  const { team, player } = requireBasicTeamAndPlayerState(
    currentState,
    'waivePlayer'
  );
  const teamCode = currentState.teamCode || team.teamCode || null;
  const stretch = payload.stretch ?? false;
  const stretchYears = Number(payload.stretchYears ?? 3);
  const buyout = payload.buyout ?? false;

  // Prioritize payload ID, then fall back to player object properties
  const playerId = payload.playerId || player.player_id || player.id;

  // Invariant check (Dev only)
  if (!playerId) {
    console.error(
      '[computeWaiveResult] CRITICAL: deadCap entry missing playerId',
      {
        payloadId: payload.playerId,
        playerObj: player,
      }
    );
    // In dev, we want to explode so we catch this
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('deadCap entry missing playerId');
    }
  }

  const updatedTeam = { ...team };

  // Remove player from roster
  updatedTeam.roster = (updatedTeam.roster || []).filter(
    (entry) => getMutationRosterEntryId(entry) !== playerId
  );

  // Remove player from players array
  updatedTeam.players = (updatedTeam.players || []).filter(
    (teamPlayer) => getMutationPlayerId(teamPlayer) !== playerId
  );

  // Calculate dead cap from guaranteed rows in current/future seasons.
  const contract = player.contract;
  const contractRows = Array.isArray(contract?.salariesByYear)
    ? contract.salariesByYear
    : [];
  const seasonEndYear = toEndYear(seasonId) ?? 0;
  const remainingGuaranteedFromRows = contractRows
    .filter((row) => {
      const yearEnd = toEndYear(row.season);
      return typeof yearEnd === 'number' && yearEnd >= seasonEndYear;
    })
    .filter((row) => row.guaranteed !== false)
    .reduce((sum, row) => sum + (Number(row.salary) || 0), 0);
  const guaranteedValueFallback = Number(contract?.guaranteedValue) || 0;
  const remainingSalary =
    remainingGuaranteedFromRows || guaranteedValueFallback;
  const rawBuyoutAmount = buyout
    ? Math.max(0, Number(payload.buyoutAmount) || 0)
    : 0;
  const boundedBuyoutAmount = buyout
    ? Math.min(remainingSalary, rawBuyoutAmount)
    : 0;
  const deadCapAmount = buyout
    ? Math.max(0, remainingSalary - boundedBuyoutAmount)
    : remainingSalary;

  if (stretch && deadCapAmount > 0) {
    // Calculate stretched amounts with remainder distribution to avoid rounding loss
    const baseStretchedAmount = Math.floor(deadCapAmount / stretchYears);
    const remainder = deadCapAmount - baseStretchedAmount * stretchYears;

    updatedTeam.deadCap = updatedTeam.deadCap || [];
    updatedTeam.deadCap.push({
      playerId,
      playerName: player.displayName || playerId,
      originalSalary: remainingSalary,
      amountByYear: Array.from({ length: stretchYears }, (_, i) => {
        // Use toSeasonCode for consistent season formatting
        const startYear = toEndYear(seasonId) ?? seasonEndYear;
        const yearEndYear = startYear + i;
        // Distribute remainder to first years to avoid losing money
        const yearAmount = baseStretchedAmount + (i < remainder ? 1 : 0);
        return {
          season: toSeasonCode(yearEndYear),
          amount: yearAmount,
          isStretched: true,
        };
      }),
      waiveDate: new Date(timestamp).toISOString(),
      notes: buyout
        ? `Buyout reduction: $${boundedBuyoutAmount.toLocaleString()} (stretched over ${stretchYears} years)`
        : `Stretched over ${stretchYears} years`,
    });
  } else if (deadCapAmount > 0) {
    updatedTeam.deadCap = updatedTeam.deadCap || [];
    updatedTeam.deadCap.push({
      playerId,
      playerName: player.displayName || playerId,
      originalSalary: remainingSalary,
      amountByYear: [
        {
          season: seasonId,
          amount: deadCapAmount,
          isStretched: false,
        },
      ],
      waiveDate: new Date(timestamp).toISOString(),
      notes: buyout
        ? `Buyout reduction: $${boundedBuyoutAmount.toLocaleString()}`
        : undefined,
    });
  }

  // Update source metadata
  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals
  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedTeam,
    toEndYear(seasonId)
  ).totals;

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [],
    metadata: {
      type: 'waive',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      stretched: stretch,
      buyout,
      buyoutAmount: boundedBuyoutAmount,
      stretchYears: stretch ? stretchYears : undefined,
      deadCapAmount,
      timestamp,
    },
  };
}

/**
 * Compute extension result
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- params required by ComputeMutationParamsWithCurrentState interface
export function computeExtensionResult({
  payload,
  currentState,
  seasonId: _seasonId, // eslint-disable-line @typescript-eslint/no-unused-vars
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationTeamAndPlayerCurrentState,
  MutationPayloadInputByType['extendPlayer']
>): ComputeResultLike {
  const { team, player } = requireBasicTeamAndPlayerState(
    currentState,
    'extendPlayer'
  );
  const teamCode = currentState.teamCode || team.teamCode || null;
  const { extension } = payload;

  const playerId = payload.playerId || player.player_id || player.id;
  const updatedTeam = { ...team };
  const teamPlayers = Array.isArray(updatedTeam.players)
    ? [...updatedTeam.players]
    : [];

  // Update player's contract in players array
  const playerIndex = teamPlayers.findIndex(
    (teamPlayer) => getMutationPlayerId(teamPlayer) === playerId
  );

  if (playerIndex === -1) {
    return {
      success: false,
      error: `Player ${playerId} not found on team ${teamCode}`,
    };
  }

  const normalizedExtensionRows: MutationPipelineSalaryRow[] = Array.isArray(
    extension?.salariesByYear
  )
    ? extension.salariesByYear.map((row): MutationPipelineSalaryRow => {
        const normalizedRow = normalizeSalaryRow(row);
        const capHit = toOptionalNumber(normalizedRow?.capHit);
        const optionUsed =
          typeof normalizedRow?.optionUsed === 'boolean'
            ? normalizedRow.optionUsed
            : undefined;

        return {
          ...row,
          ...(capHit !== undefined ? { capHit } : {}),
          ...(optionUsed !== undefined ? { optionUsed } : {}),
          isExtensionSeason: true,
        };
      })
    : [];

  // Determine which years the extension covers so we can void overlapping originals
  const extensionYearSet = new Set(
    normalizedExtensionRows
      .map((row) => getSalaryRowEndYear(row))
      .filter((year): year is number => typeof year === 'number')
  );

  // Mark existing salary rows that overlap with extension years as voidedByExtension
  const existingFutureContract = teamPlayers[playerIndex].futureContract;
  const existingRows = (
    Array.isArray(existingFutureContract?.salariesByYear)
      ? existingFutureContract.salariesByYear
      : []
  ).map((row) => {
    const rowYear = getSalaryRowEndYear(row as MutationPipelineSalaryRow);
    return typeof rowYear === 'number' && extensionYearSet.has(rowYear)
      ? { ...row, voidedByExtension: true }
      : row;
  });

  // Build and normalize futureContract with canonical field names
  const rawFutureContract = {
    ...(existingFutureContract || {}),
    salariesByYear: [...existingRows, ...normalizedExtensionRows],
    isExtension: true,
    signingDate: new Date(timestamp).toISOString(),
  };

  const updatedPlayer = {
    ...teamPlayers[playerIndex],
    futureContract: normalizeFutureContract(
      rawFutureContract
    ) as ArchitectMutationContract | null,
  };

  teamPlayers[playerIndex] = updatedPlayer;
  updatedTeam.players = teamPlayers;

  // Update source metadata
  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [{ playerId, player: updatedPlayer }],
    metadata: {
      type: 'extension',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      extensionYears: normalizedExtensionRows.length,
      extensionTerms: {
        years: normalizedExtensionRows.length,
        salariesByYear: normalizedExtensionRows,
      },
      timestamp,
    },
  };
}

/**
 * Compute option decision result
 */
export function computeOptionResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationTeamAndPlayerCurrentState,
  MutationPayloadInputByType['optionDecision']
>): ComputeResultLike {
  const { team, player } = requireBasicTeamAndPlayerState(
    currentState,
    'optionDecision'
  );
  const teamCode = currentState.teamCode || team.teamCode || null;
  const { accepted, targetYear } = payload;

  const playerId = payload.playerId || player.player_id || player.id;
  const updatedTeam = { ...team };
  const teamPlayers = Array.isArray(updatedTeam.players)
    ? [...updatedTeam.players]
    : [];

  // Find player in team
  const playerIndex = teamPlayers.findIndex(
    (teamPlayer) => getMutationPlayerId(teamPlayer) === playerId
  );

  if (playerIndex === -1) {
    return {
      success: false,
      error: `Player ${playerId} not found on team ${teamCode}`,
    };
  }

  const playerData = teamPlayers[playerIndex];
  const salaries = Array.isArray(playerData.contract?.salariesByYear)
    ? playerData.contract.salariesByYear
    : [];

  // Find the option year entry
  const optionIndex = salaries.findIndex((row) => {
    const yearEnd = toEndYear(row.season);
    return yearEnd === targetYear && row.option;
  });

  if (optionIndex === -1) {
    return { success: false, error: `No option found for year ${targetYear}` };
  }

  let updatedPlayer;
  let newCapHold = null;

  if (accepted) {
    // Accepted: mark option as used (canonical boolean format)
    const updatedSalaries: MutationPipelineSalaryRow[] = salaries.map(
      (row) => row as MutationPipelineSalaryRow
    );
    updatedSalaries[optionIndex] = {
      ...(normalizeSalaryRow(
        updatedSalaries[optionIndex]
      ) as MutationPipelineSalaryRow),
      optionUsed: true, // CANONICAL: boolean, not string
    };

    updatedPlayer = {
      ...playerData,
      contract: normalizeContractForWorld({
        ...playerData.contract,
        salariesByYear: updatedSalaries,
      }) as ArchitectMutationContract | null,
    };
  } else {
    const optionSeason = salaries[optionIndex]?.season || null;
    const faYearInfo = deriveFreeAgencyYearFromOptionSeason(
      optionSeason,
      targetYear
    );
    const freeAgencyYear =
      typeof faYearInfo.year === 'number'
        ? faYearInfo.year
        : Number(targetYear) - 1;

    // Declined: remove this year and all future years
    const filteredSalaries = salaries
      .filter((_, idx) => idx < optionIndex)
      .map(normalizeSalaryRow);

    updatedPlayer = {
      ...playerData,
      contract: normalizeContractForWorld({
        ...playerData.contract,
        salariesByYear: filteredSalaries,
        freeAgency: {
          year: freeAgencyYear,
          type: 'UFA',
        },
      }) as ArchitectMutationContract | null,
    };

    // Create cap hold for declined option
    const priorRow = salaries[optionIndex - 1];
    const lastSalary = Number(priorRow?.salary ?? priorRow?.capHit ?? 0);
    const capHoldPlayer = toCapHoldComputationPlayer(playerData);
    const rightsType = getRightsTypeFromPlayer(capHoldPlayer);
    const capHoldExpectation = computeExpectedCapHoldAmount({
      player: capHoldPlayer,
      lastSalary,
      rules: null,
      rightsType,
    });

    if (lastSalary > 0 && capHoldExpectation.amount > 0) {
      const fallbackNotes = capHoldExpectation.usedFallback
        ? 'Fallback multiplier used due to missing/unsupported Bird rights type.'
        : undefined;
      newCapHold = {
        playerId,
        playerName: playerData.displayName || playerData.name || '',
        amount: capHoldExpectation.amount,
        type: 'FA Cap Hold',
        season: toSeasonCode(targetYear),
        isSigned: false,
        reason: capHoldExpectation.usedFallback
          ? 'Declined Option (fallback multiplier)'
          : 'Declined Option',
        active: true,
        ...(fallbackNotes ? { notes: fallbackNotes } : {}),
      };
    }

    // Remove from roster if option declined (becomes FA)
    updatedTeam.roster = (updatedTeam.roster || []).filter(
      (entry) => getMutationRosterEntryId(entry) !== playerId
    );
    updatedTeam.players = teamPlayers.filter(
      (teamPlayer) => getMutationPlayerId(teamPlayer) !== playerId
    );
  }

  // Update player in team's players array if still on roster
  if (accepted) {
    teamPlayers[playerIndex] = updatedPlayer;
    updatedTeam.players = teamPlayers;
  }

  // Add cap hold if created
  if (newCapHold) {
    updatedTeam.capHolds = [...(updatedTeam.capHolds || []), newCapHold];
  }

  // Update source metadata
  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals
  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedTeam,
    toEndYear(seasonId)
  ).totals;

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: accepted ? [{ playerId, player: updatedPlayer }] : [],
    metadata: {
      type: 'option',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      optionType: salaries[optionIndex]?.option,
      accepted,
      targetYear,
      timestamp,
    },
  };
}

/**
 * Compute renounce rights result
 *
 * Renouncing rights removes the team's cap hold on a free agent
 * and clears their Bird rights association with this team.
 * The player remains in the FA pool but cannot be re-signed using Bird rights.
 */
export function computeRenounceResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationTeamAndPlayerCurrentState,
  MutationPayloadInputByType['renounceRights']
>): ComputeResultLike {
  const { team, player } = requireBasicTeamAndPlayerState(
    currentState,
    'renounceRights'
  );
  const teamCode = currentState.teamCode || team.teamCode || null;
  const playerId = payload.playerId || player.player_id || player.id;
  const playerName = player.displayName || player.name;

  const updatedTeam = { ...team };

  // 1. Remove the player's cap hold from the team
  // Match by playerId first (primary), then by playerName (fallback) using OR logic
  if (updatedTeam.capHolds && Array.isArray(updatedTeam.capHolds)) {
    updatedTeam.capHolds = updatedTeam.capHolds.filter((hold) => {
      // Remove if playerId matches
      if (hold.playerId === playerId) return false;
      // Also remove if playerName matches (in case IDs don't align)
      if (hold.playerName === playerName) return false;
      return true;
    });
  }

  // 2. Mark the player's Bird rights as renounced/cleared for this team
  // Update player entry if present in team's players array
  // Prioritize ID matching over name matching
  if (updatedTeam.players && Array.isArray(updatedTeam.players)) {
    updatedTeam.players = updatedTeam.players.map((teamPlayer) => {
      const pid = getMutationPlayerId(teamPlayer);
      // Prioritize exact ID match, then fall back to name match
      const isMatch =
        pid === playerId || (pid == null && teamPlayer.name === playerName);
      if (isMatch) {
        return {
          ...teamPlayer,
          rightsRenounced: true,
          renouncedAt: new Date(timestamp).toISOString(),
          contract: {
            ...(teamPlayer.contract || {}),
            birdRights: {
              ...(teamPlayer.contract?.birdRights || {}),
              status: 'None',
              renouncedBy: teamCode,
              renouncedAt: new Date(timestamp).toISOString(),
            },
          },
        };
      }
      return teamPlayer;
    });
  }

  // Update source metadata
  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals (cap holds affect cap space)
  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedTeam,
    toEndYear(seasonId)
  ).totals;

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [],
    metadata: {
      type: 'renounce',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      rightsUsed: 'Renounced',
      timestamp,
    },
  };
}

export const MANUAL_EXCEPTION_MUTATION_KEYS = [
  'mle',
  'tpmle',
  'taxpayerMle',
  'tpMle',
  'miniMle',
  'nonTaxpayerMle',
  'fullMLE',
  'bae',
  'biAnnual',
  'room',
  'roomMLE',
  'roommle',
  'rmle',
] as const;
export const MANUAL_EXCEPTION_MUTATION_KEY_SET = new Set<string>(
  MANUAL_EXCEPTION_MUTATION_KEYS
);

export function mergeManualExceptionSnapshot(
  existingExceptions: unknown,
  editedExceptions: unknown
): ArchitectMutationExceptions {
  const existingBuckets =
    toMutationExceptionPreserveOnlyBuckets(existingExceptions);
  const editedBuckets =
    toMutationExceptionPreserveOnlyBuckets(editedExceptions);
  const mergedPreserveOnlyBuckets: MutationExceptionPreserveOnlyBuckets = {};

  for (const [key, value] of Object.entries(existingBuckets || {})) {
    if (!MANUAL_EXCEPTION_MUTATION_KEY_SET.has(key)) {
      mergedPreserveOnlyBuckets[key] = value;
    }
  }

  if (editedBuckets) {
    Object.assign(mergedPreserveOnlyBuckets, editedBuckets);
  }

  return normalizeMutationExceptionsFromIngress(mergedPreserveOnlyBuckets);
}

/**
 * Compute set exceptions result (Phase 27)
 *
 * Replaces only the editable exception subset while preserving untouched
 * non-editable buckets such as canonical TPE storage.
 */
export function computeSetExceptionsResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationTeamOnlyCurrentState,
  MutationPayloadInputByType['setExceptions']
>): ComputeResultLike {
  const { team } = requireBasicTeamState(currentState, 'setExceptions');
  const { teamCode } = payload;

  // Validate payload.exceptions is an object or null/undefined (to clear)
  if (payload.exceptions !== null && payload.exceptions !== undefined) {
    if (
      typeof payload.exceptions !== 'object' ||
      Array.isArray(payload.exceptions)
    ) {
      return {
        success: false,
        error: 'Invalid exceptions payload: must be an object or null',
      };
    }
  }

  const updatedTeam = {
    ...team,
    exceptions: mergeManualExceptionSnapshot(
      team?.exceptions,
      payload.exceptions
    ),
  };

  // Update source metadata
  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };
  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedTeam,
    toEndYear(seasonId)
  ).totals;

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [],
    metadata: {
      actionType: 'setExceptions',
      teamCode,
      exceptionChanges:
        Array.isArray(payload.exceptionChanges) &&
        payload.exceptionChanges.length
          ? payload.exceptionChanges
          : ['Exceptions updated'],
      timestamp,
    },
  };
}

export function computeStoreOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationOfferSheetTeamAndPlayerCurrentState,
  MutationPayloadInputByType['storeOfferSheet']
>): ComputeResultLike {
  const { team: offeringTeam, player, teamCode, homeTeam } = currentState;
  const { contract, worldId } = payload;
  const currentYear = toEndYear(seasonId);

  if (!offeringTeam || !teamCode) {
    return {
      success: false,
      error:
        'storeOfferSheet requires an authoritative offering team snapshot.',
    };
  }

  if (!homeTeam?.teamCode) {
    return {
      success: false,
      error:
        'storeOfferSheet requires resolved authoritative home-team truth before offer-sheet creation.',
    };
  }

  if (homeTeam.teamCode === teamCode) {
    return {
      success: false,
      error:
        'storeOfferSheet requires a home team distinct from the offering team.',
    };
  }

  if (!player) {
    return {
      success: false,
      error:
        'storeOfferSheet requires canonical home-team player truth before offer-sheet creation.',
    };
  }
  if (!contract) {
    return {
      success: false,
      error:
        'storeOfferSheet requires contract terms before offer-sheet creation.',
    };
  }

  // Validate store-only invariants programmatically just in case
  if (contract.rfaOfferSheetOnly !== true || contract.rfaOfferSheet !== true) {
    return {
      success: false,
      error:
        'storeOfferSheet requires rfaOfferSheet=true and rfaOfferSheetOnly=true',
    };
  }

  const playerId = player.player_id || player.id;
  const homeTeamCode = homeTeam.teamCode;
  const authoritativeSnapshotPlayer = findPlayerInTeamPlayers(
    homeTeam,
    String(playerId || '')
  );

  if (!playerId) {
    return {
      success: false,
      error: 'storeOfferSheet requires a stable playerId from canonical truth.',
    };
  }

  if (!authoritativeSnapshotPlayer) {
    return {
      success: false,
      error:
        'storeOfferSheet requires pre-resolved authoritative home-team snapshot player truth.',
    };
  }

  // Phase 18.2: worldId is REQUIRED for audit-grade dedupKey
  // Cannot store offer sheet without worldId - fail fast
  if (!worldId) {
    return {
      success: false,
      error:
        'worldId is required for offer sheet identity. Cannot store offer sheet without worldId.',
    };
  }

  // Phase 18.1/18.2: Generate DETERMINISTIC dedupKey for idempotency
  // Format: os:{worldId}:{offeringTeamCode}:{playerId}:{seasonKey}
  // This is stable across retries (no timestamp dependency)
  const dedupKey = `os:${worldId}:${teamCode}:${playerId}:${seasonId}`;

  // Generate unique ID (includes timestamp for uniqueness, but NOT used for dedup)
  const offerSheetId =
    payload.offerSheetId || `os_${teamCode}_${playerId}_${timestamp}`;

  // Build canonical OfferSheet object
  const offerSheet: ArchitectMutationOfferSheet = {
    id: offerSheetId,
    dedupKey, // Phase 18.1: Deterministic key for idempotency
    playerId,
    playerName: player.displayName || player.name,
    offeringTeamCode: teamCode,
    homeTeamCode,
    seasonKey: seasonId,
    year: currentYear,
    contractYears: contract.contractYears || contract.years || 1,
    salariesByYear:
      (contract.salariesByYear?.map(normalizeSalaryRow) as
        | NormalizedMutationSalaryRow[]
        | undefined) || [],
    status: 'PENDING_MATCH',
    createdAt: new Date(timestamp).toISOString(),
    totalValue: contract.totalValue,
  };

  const updatedOfferingTeam = { ...offeringTeam };
  const offeringOfferSheets = updatedOfferingTeam.offerSheets ?? [];

  // Phase 18.1: DEDUPLICATION - Check by id first, then by dedupKey
  // This ensures retries don't create duplicates even with different timestamps
  let existingIndex = offeringOfferSheets.findIndex(
    (existingOfferSheet) => existingOfferSheet.id === offerSheetId
  );
  if (existingIndex === -1) {
    // Not found by ID, try dedupKey
    existingIndex = offeringOfferSheets.findIndex(
      (existingOfferSheet) => existingOfferSheet.dedupKey === dedupKey
    );
  }

  if (existingIndex !== -1) {
    // UPDATE IN PLACE - preserve existing ID if found by dedupKey
    const existingSheet = offeringOfferSheets[existingIndex];
    const newSheets = [...offeringOfferSheets];
    newSheets[existingIndex] = {
      ...offerSheet,
      id: existingSheet.id, // Preserve original ID
      createdAt: existingSheet.createdAt, // Preserve original creation time
    };
    updatedOfferingTeam.offerSheets = newSheets;
  } else {
    updatedOfferingTeam.offerSheets = [
      ...(updatedOfferingTeam.offerSheets || []),
      offerSheet,
    ];
  }

  // Update source metadata
  updatedOfferingTeam.source = {
    ...getTeamSourceRecord(updatedOfferingTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  const teamUpdates = [{ teamCode, team: updatedOfferingTeam }];

  // MIRRORING: Add to home team's incomingOfferSheets if home team exists
  if (homeTeam) {
    const updatedHomeTeam = { ...homeTeam };
    const incomingOfferSheets = updatedHomeTeam.incomingOfferSheets ?? [];

    // Phase 18.1: Same dedup logic for home team
    let existingHomeIndex = incomingOfferSheets.findIndex(
      (existingOfferSheet) => existingOfferSheet.id === offerSheetId
    );
    if (existingHomeIndex === -1) {
      existingHomeIndex = incomingOfferSheets.findIndex(
        (existingOfferSheet) => existingOfferSheet.dedupKey === dedupKey
      );
    }

    if (existingHomeIndex !== -1) {
      const existingSheet = incomingOfferSheets[existingHomeIndex];
      const newSheets = [...incomingOfferSheets];
      newSheets[existingHomeIndex] = {
        ...offerSheet,
        id: existingSheet.id,
        createdAt: existingSheet.createdAt,
      };
      updatedHomeTeam.incomingOfferSheets = newSheets;
    } else {
      updatedHomeTeam.incomingOfferSheets = [
        ...(updatedHomeTeam.incomingOfferSheets || []),
        offerSheet,
      ];
    }

    updatedHomeTeam.source = {
      ...getTeamSourceRecord(updatedHomeTeam.source),
      lastModifiedAt: new Date(timestamp).toISOString(),
    };
    teamUpdates.push({ teamCode: homeTeam.teamCode, team: updatedHomeTeam });
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: [],
    metadata: {
      type: 'storeOfferSheet',
      teamCode,
      playerId: offerSheet.playerId,
      offerSheetId: offerSheet.id,
      dedupKey, // Phase 18.1: Include for traceability
      timestamp,
    },
  };
}

/**
 * Compute match offer sheet result
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- params required by ComputeMutationParamsWithCurrentState interface
export function computeMatchOfferSheetResult({
  payload: _payload, // eslint-disable-line @typescript-eslint/no-unused-vars
  currentState,
  seasonId: _seasonId, // eslint-disable-line @typescript-eslint/no-unused-vars
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationOfferSheetMirrorCurrentState,
  MutationPayloadInputByType['matchOfferSheet']
>): ComputeResultLike {
  const { offeringTeam, homeTeam, offerSheetId } = requireOfferSheetTeamState(
    currentState,
    'matchOfferSheet'
  );

  // Find offer sheet on offering team
  const offeringOfferSheets = offeringTeam.offerSheets ?? [];
  const offerSheetIndex = offeringOfferSheets.findIndex(
    (offerSheet) => offerSheet.id === offerSheetId
  );
  if (offerSheetIndex === -1) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} not found on team ${offeringTeam.teamCode}`,
    };
  }

  const existingSheet = offeringOfferSheets[offerSheetIndex];

  if (existingSheet.status !== 'PENDING_MATCH') {
    return {
      success: false,
      error: `Offer sheet status is ${existingSheet.status}, expected PENDING_MATCH`,
    };
  }

  // Update status
  const updatedOfferSheet = {
    ...existingSheet,
    status: 'MATCHED',
    matchedAt: new Date(timestamp).toISOString(),
  };

  const updatedOfferingTeam = { ...offeringTeam };
  updatedOfferingTeam.offerSheets = [...offeringOfferSheets];
  updatedOfferingTeam.offerSheets[offerSheetIndex] = updatedOfferSheet;
  updatedOfferingTeam.source = {
    ...getTeamSourceRecord(updatedOfferingTeam.source),
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  const teamUpdates = [
    { teamCode: offeringTeam.teamCode, team: updatedOfferingTeam },
  ];

  // MIRRORING: Update logic on home team
  if (homeTeam && homeTeam.incomingOfferSheets) {
    const homeIndex = homeTeam.incomingOfferSheets.findIndex(
      (offerSheet) => offerSheet.id === offerSheetId
    );
    if (homeIndex !== -1) {
    const updatedHomeTeam = { ...homeTeam };
    const incomingOfferSheets = updatedHomeTeam.incomingOfferSheets ?? [];
    updatedHomeTeam.incomingOfferSheets = [...incomingOfferSheets];
    updatedHomeTeam.incomingOfferSheets[homeIndex] = updatedOfferSheet;
      updatedHomeTeam.source = {
        ...getTeamSourceRecord(updatedHomeTeam.source),
        lastModifiedAt: new Date(timestamp).toISOString(),
      };
      teamUpdates.push({ teamCode: homeTeam.teamCode, team: updatedHomeTeam });
    }
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: [],
    metadata: {
      type: 'matchOfferSheet',
      offeringTeamCode: offeringTeam.teamCode,
      homeTeamCode: homeTeam.teamCode,
      offerSheetId,
      timestamp,
    },
  };
}

/**
 * Compute decline offer sheet result
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- params required by ComputeMutationParamsWithCurrentState interface
export function computeDeclineOfferSheetResult({
  payload: _payload, // eslint-disable-line @typescript-eslint/no-unused-vars
  currentState,
  seasonId: _seasonId, // eslint-disable-line @typescript-eslint/no-unused-vars
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationOfferSheetMirrorCurrentState,
  MutationPayloadInputByType['declineOfferSheet']
>): ComputeResultLike {
  const { offeringTeam, homeTeam, offerSheetId } = requireOfferSheetTeamState(
    currentState,
    'declineOfferSheet'
  );

  // Find offer sheet
  const offeringOfferSheets = offeringTeam.offerSheets ?? [];
  const offerSheetIndex = offeringOfferSheets.findIndex(
    (offerSheet) => offerSheet.id === offerSheetId
  );
  if (offerSheetIndex === -1) {
    return { success: false, error: `Offer sheet ${offerSheetId} not found` };
  }

  const existingSheet = offeringOfferSheets[offerSheetIndex];
  if (existingSheet.status !== 'PENDING_MATCH') {
    return {
      success: false,
      error: `Offer sheet status is ${existingSheet.status}, expected PENDING_MATCH`,
    };
  }

  const updatedOfferSheet = {
    ...existingSheet,
    status: 'DECLINED',
    declinedAt: new Date(timestamp).toISOString(),
  };

  const updatedOfferingTeam = { ...offeringTeam };
  updatedOfferingTeam.offerSheets = [...offeringOfferSheets];
  updatedOfferingTeam.offerSheets[offerSheetIndex] = updatedOfferSheet;
  updatedOfferingTeam.source = {
    ...getTeamSourceRecord(updatedOfferingTeam.source),
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  const teamUpdates = [
    { teamCode: offeringTeam.teamCode, team: updatedOfferingTeam },
  ];

  // MIRRORING: Update logic on home team
  if (homeTeam && homeTeam.incomingOfferSheets) {
    const homeIndex = homeTeam.incomingOfferSheets.findIndex(
      (offerSheet) => offerSheet.id === offerSheetId
    );
    if (homeIndex !== -1) {
      const updatedHomeTeam = { ...homeTeam };
      const incomingOfferSheets = updatedHomeTeam.incomingOfferSheets ?? [];
      updatedHomeTeam.incomingOfferSheets = [...incomingOfferSheets];
      updatedHomeTeam.incomingOfferSheets[homeIndex] = updatedOfferSheet;
      updatedHomeTeam.source = {
        ...getTeamSourceRecord(updatedHomeTeam.source),
        lastModifiedAt: new Date(timestamp).toISOString(),
      };
      teamUpdates.push({ teamCode: homeTeam.teamCode, team: updatedHomeTeam });
    }
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: [],
    metadata: {
      type: 'declineOfferSheet',
      offeringTeamCode: offeringTeam.teamCode,
      homeTeamCode: homeTeam.teamCode,
      offerSheetId,
      timestamp,
    },
  };
}

/**
 * Compute MATCHED offer sheet finalization.
 *
 * GOAL:
 * 1. Validate status is MATCHED (and acting team is home team - handled by validator).
 * 2. Apply the contract terms from offer sheet to the home team's player.
 * 3. Remove offer sheet from BOTH home and offering teams.
 */
export function computeFinalizeMatchedOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationOfferSheetResolutionCurrentState,
  MutationPayloadInputByType['finalizeMatchedOfferSheet']
>): ComputeResultLike {
  const { homeTeam, offeringTeam, offerSheetId } = requireOfferSheetTeamState(
    currentState,
    'finalizeMatchedOfferSheet'
  );
  const incomingOfferSheets = homeTeam.incomingOfferSheets || [];
  const requestedDedupKey = payload.dedupKey as string | null | undefined;
  const offerSheet = incomingOfferSheets.find((existingOfferSheet) =>
    matchesOfferSheetIdentity(
      existingOfferSheet,
      offerSheetId || '',
      requestedDedupKey
    )
  );

  if (!offerSheet) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} not found on home team.`,
    };
  }

  if (offerSheet.status !== 'MATCHED') {
    return {
      success: false,
      error: `Offer sheet status is ${offerSheet.status}, expected MATCHED.`,
    };
  }

  const playerId = String(offerSheet.playerId || '').trim();
  if (!playerId) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} is missing playerId.`,
    };
  }

  const homeTeamPlayers = homeTeam.players ?? [];
  const playerIndex = homeTeamPlayers.findIndex(
    (teamPlayer) => getMutationPlayerId(teamPlayer) === playerId
  );

  if (playerIndex === -1) {
    return {
      success: false,
      error: `Player ${playerId} not found on home team roster for contract application.`,
    };
  }

  const normalizedContract = buildNormalizedOfferSheetFinalContract({
    offerSheet,
    signingTeam: homeTeam.teamCode || '',
    signedUsing: 'Match',
    timestamp,
  });
  if (!normalizedContract) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} could not be normalized for matched finalization.`,
    };
  }

  const updatedPlayer = {
    ...homeTeamPlayers[playerIndex],
    teamCode: homeTeam.teamCode,
    teamName: homeTeam.teamName,
    contract: normalizedContract,
  };
  delete updatedPlayer.rfaOfferSheet;
  delete updatedPlayer.rfaOfferSheetOnly;
  delete updatedPlayer.rfaContext;

  const resolvedDedupKey = String(
    offerSheet.dedupKey || requestedDedupKey || ''
  ).trim();
  const updatedHomeTeam = { ...homeTeam };
  updatedHomeTeam.incomingOfferSheets = removeOfferSheetEntries(
    incomingOfferSheets,
    offerSheetId || '',
    resolvedDedupKey
  );
  updatedHomeTeam.players = [
    ...homeTeamPlayers.slice(0, playerIndex),
    updatedPlayer,
    ...homeTeamPlayers.slice(playerIndex + 1),
  ];
  if (Array.isArray(updatedHomeTeam.capHolds)) {
    updatedHomeTeam.capHolds = updatedHomeTeam.capHolds.filter(
      (hold) => String(hold?.playerId || '').trim() !== playerId
    );
  }
  updatedHomeTeam.source = {
    ...getTeamSourceRecord(updatedHomeTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };
  updatedHomeTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedHomeTeam,
    toEndYear(seasonId)
  ).totals;

  const updatedOfferingTeam = { ...offeringTeam };
  updatedOfferingTeam.offerSheets = removeOfferSheetEntries(
    updatedOfferingTeam.offerSheets || [],
    offerSheetId || '',
    resolvedDedupKey
  );
  updatedOfferingTeam.source = {
    ...getTeamSourceRecord(updatedOfferingTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  const teamUpdates = [
    { teamCode: homeTeam.teamCode, team: updatedHomeTeam },
    { teamCode: offeringTeam.teamCode, team: updatedOfferingTeam },
  ];
  const persistenceManifest = buildCanonicalPlayerPersistenceManifest({
    teamUpdates,
    candidates: [
      {
        playerId,
        destinationTeamCode: String(homeTeam.teamCode || '').trim(),
        mode: 'replace',
      },
    ],
    manifestLabel: 'Offer sheet matched persistence manifest',
  });
  if ('error' in persistenceManifest) {
    return {
      success: false,
      error: persistenceManifest.error,
    };
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: persistenceManifest.playerUpdates,
    playerDeletes: persistenceManifest.playerDeletes,
    metadata: {
      type: 'finalizeMatchedOfferSheet',
      offerSheetId,
      playerId,
      homeTeam: homeTeam.teamCode,
      offeringTeam: offeringTeam.teamCode,
      teamCode: homeTeam.teamCode,
      playerName: updatedPlayer.displayName || updatedPlayer.name,
      signedUsing: 'Match',
      contract: normalizedContract,
      timestamp,
    },
  };
}

/**
 * Phase 18.1: Compute DECLINED offer sheet finalization.
 *
 * GOAL:
 * 1. Validate status is DECLINED (and acting team is offering team - handled by validator).
 * 2. Remove offer sheet from BOTH teams (explicit cleanup).
 * 3. Apply the contract terms from offer sheet to the offering team's player (signing).
 */
export function computeFinalizeDeclinedOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationOfferSheetResolutionCurrentState,
  MutationPayloadInputByType['finalizeDeclinedOfferSheet']
>): ComputeResultLike {
  const { offeringTeam, homeTeam, offerSheetId } = requireOfferSheetTeamState(
    currentState,
    'finalizeDeclinedOfferSheet'
  );
  const dedupKey = payload.dedupKey as string | null | undefined;

  // 1. Find the offer sheet (on offering team)
  const offerSheets = offeringTeam.offerSheets || [];
  const offerSheet = offerSheets.find((existingOfferSheet) =>
    matchesOfferSheetIdentity(existingOfferSheet, offerSheetId || '', dedupKey)
  );

  if (!offerSheet) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} not found on offering team.`,
    };
  }

  if (offerSheet.status !== 'DECLINED') {
    return {
      success: false,
      error: `Offer sheet status is ${offerSheet.status}, expected DECLINED.`,
    };
  }

  const playerId = String(offerSheet.playerId || '').trim();
  if (!playerId) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} is missing playerId.`,
    };
  }

  const sourcePlayer = findPlayerInTeamPlayers(homeTeam, playerId);
  if (!sourcePlayer) {
    return {
      success: false,
      error: `Player ${playerId} not found on home team roster for declined finalization.`,
    };
  }

  const normalizedContract = buildNormalizedOfferSheetFinalContract({
    offerSheet,
    signingTeam: offeringTeam.teamCode || '',
    signedUsing: 'Offer Sheet',
    timestamp,
  });
  if (!normalizedContract) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} could not be normalized for declined finalization.`,
    };
  }

  const resolvedDedupKey = String(offerSheet.dedupKey || dedupKey || '').trim();
  const updatedPlayer = {
    ...sourcePlayer,
    teamCode: offeringTeam.teamCode,
    teamName: offeringTeam.teamName,
    contract: normalizedContract,
  };
  delete updatedPlayer.rfaOfferSheet;
  delete updatedPlayer.rfaOfferSheetOnly;
  delete updatedPlayer.rfaContext;

  const updatedOfferingTeam = { ...offeringTeam };
  updatedOfferingTeam.offerSheets = removeOfferSheetEntries(
    offerSheets,
    offerSheetId || '',
    resolvedDedupKey
  );
  const offeringTeamPlayers = updatedOfferingTeam.players ?? [];
  const offeringPlayerIndex = offeringTeamPlayers.findIndex(
    (teamPlayer) => getMutationPlayerId(teamPlayer) === playerId
  );
  if (offeringPlayerIndex !== -1) {
    updatedOfferingTeam.players = [
      ...offeringTeamPlayers.slice(0, offeringPlayerIndex),
      updatedPlayer,
      ...offeringTeamPlayers.slice(offeringPlayerIndex + 1),
    ];
  } else {
    updatedOfferingTeam.players = [
      ...offeringTeamPlayers,
      updatedPlayer,
    ];
  }
  if (
    !(updatedOfferingTeam.roster || []).some(
      (entry) => getMutationRosterEntryId(entry) === playerId
    )
  ) {
    updatedOfferingTeam.roster = [
      ...(updatedOfferingTeam.roster || []),
      playerId,
    ];
  }
  if (Array.isArray(updatedOfferingTeam.capHolds)) {
    updatedOfferingTeam.capHolds = updatedOfferingTeam.capHolds.filter(
      (hold) => String(hold?.playerId || '').trim() !== playerId
    );
  }
  updatedOfferingTeam.source = {
    ...getTeamSourceRecord(updatedOfferingTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };
  updatedOfferingTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedOfferingTeam,
    toEndYear(seasonId)
  ).totals;

  const updatedHomeTeam = { ...homeTeam };
  updatedHomeTeam.incomingOfferSheets = removeOfferSheetEntries(
    updatedHomeTeam.incomingOfferSheets || [],
    offerSheetId || '',
    resolvedDedupKey
  );
  updatedHomeTeam.roster = (updatedHomeTeam.roster || []).filter(
    (entry) => getMutationRosterEntryId(entry) !== playerId
  );
  updatedHomeTeam.players = (updatedHomeTeam.players || []).filter(
    (teamPlayer) => getMutationPlayerId(teamPlayer) !== playerId
  );
  if (Array.isArray(updatedHomeTeam.capHolds)) {
    updatedHomeTeam.capHolds = updatedHomeTeam.capHolds.filter(
      (hold) => String(hold?.playerId || '').trim() !== playerId
    );
  }
  updatedHomeTeam.source = {
    ...getTeamSourceRecord(updatedHomeTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };
  updatedHomeTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedHomeTeam,
    toEndYear(seasonId)
  ).totals;

  const teamUpdates = [
    { teamCode: offeringTeam.teamCode, team: updatedOfferingTeam },
    { teamCode: homeTeam.teamCode, team: updatedHomeTeam },
  ];
  const persistenceManifest = buildCanonicalPlayerPersistenceManifest({
    teamUpdates,
    candidates: [
      {
        playerId,
        sourceTeamCode: String(homeTeam.teamCode || '').trim(),
        destinationTeamCode: String(offeringTeam.teamCode || '').trim(),
        mode: 'move',
      },
    ],
    manifestLabel: 'Offer sheet declined persistence manifest',
  });
  if ('error' in persistenceManifest) {
    return {
      success: false,
      error: persistenceManifest.error,
    };
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: persistenceManifest.playerUpdates,
    playerDeletes: persistenceManifest.playerDeletes,
    metadata: {
      type: 'finalizeDeclinedOfferSheet',
      offerSheetId,
      playerId,
      offeringTeam: offeringTeam.teamCode,
      homeTeam: homeTeam.teamCode,
      teamCode: offeringTeam.teamCode,
      playerName: updatedPlayer.displayName || updatedPlayer.name,
      signedUsing: 'Offer Sheet',
      contract: normalizedContract,
      timestamp,
    },
  };
}

/**
 * Compute Sign and Trade result.
 *
 * 1. Signs player to Source Team.
 * 2. Trades player to Destination Team.
 */
export function computeSignAndTradeResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  asOfDate = null,
  worldId,
  historyContext = {},
}: ComputeMutationParamsWithCurrentState<
  MutationSignAndTradeCurrentState,
  MutationPayloadInputByType['signAndTrade']
> & {
  asOfDate?: string | number | null;
  worldId?: string;
  historyContext?: TradeHistoryContextLike;
}): ComputeResultLike {
  const { team, destinationTeam, player } = requireDestinationState(
    currentState,
    'signAndTrade'
  );
  const { teamCode, destinationTeamCode } = payload;

  // 1. Compute Signing Result
  const signingPayload = {
    playerId: payload.playerId,
    contract: payload.contract,
    signedUsing: payload.signedUsing,
  };

  const signingState: MutationSigningCurrentState = { team, player, teamCode };
  const signingResult = computeSigningResult({
    payload: signingPayload,
    currentState: signingState,
    seasonId,
    timestamp,
  });

  if (!signingResult.success) {
    return {
      success: false,
      error: signingResult.error || 'Signing step failed',
    };
  }

  // Phase 48: Validate the SAT signing phase before the trade handoff.
  const signingValidation = validateSignAndTradeSigningPhase({
    team,
    player,
    contract: payload.contract,
    signedUsing: payload.signedUsing,
    seasonId,
  });

  if (!signingValidation.valid) {
    return {
      success: false,
      error:
        signingValidation.violations?.[0]?.message ||
        'Signing validation failed',
      violations: signingValidation.violations.map((violation: unknown) =>
        typeof violation === 'string' ? violation : JSON.stringify(violation)
      ),
      warnings: signingValidation.warnings,
    };
  }

  // Extract updated source team and player (now signed) from signing result
  const signingTeamUpdate = signingResult.teamUpdates?.[0]?.team;
  const signedPlayer = signingResult.playerUpdates?.[0]?.player;
  if (!signingTeamUpdate || !signedPlayer) {
    return {
      success: false,
      error:
        'Signing step did not return the source-team and player truth required for sign-and-trade handoff.',
    };
  }
  const updatedSourceTeam =
    (materializeCurrentStateBaseTeamPreservedFields(
      signingTeamUpdate as CurrentStateTeamRoundTripMaterializable
    ) as ArchitectMutationTeamRecord | null) ||
    (signingTeamUpdate as ArchitectMutationTeamRecord);

  // 2. Build the SAT handoff into the canonical trade preparation surface.
  const tradeHandoff = buildSignAndTradeTradeHandoff({
    sourceTeamCode: teamCode,
    destinationTeamCode,
    updatedSourceTeam,
    destinationTeam,
    signedPlayer,
    contract: payload.contract || null,
    seasonId,
    timestamp,
    asOfDate,
    worldId,
  });

  // 3. Call pure trade compute with the prepared SAT trade handoff.
  const tradeResult = computeTradeResult({
    payload: tradeHandoff.tradePayload,
    currentState: tradeHandoff.tradeState,
    seasonId,
    timestamp,
    historyContext: {
      worldId: historyContext.worldId || worldId,
      mutationType: historyContext.mutationType || 'signAndTrade',
      mutationId: historyContext.mutationId,
    },
    postTradeSnapshot: tradeHandoff.tradeApplyPreparation.postTradeSnapshot,
    validatedContext: tradeHandoff.tradeApplyPreparation.validatedContext,
  });

  if (!tradeResult.success) {
    return { success: false, error: tradeResult.error || 'Trade step failed' };
  }

  // 4. Return combined SAT result with both prevalidated contexts attached.
  // Phase 56: Attach validated contexts for validateMutation de-duplication
  return {
    success: true,
    teamUpdates: tradeResult.teamUpdates, // Contains both Source (minus player) and Dest (plus player)
    playerUpdates: tradeResult.playerUpdates, // Player with new teamCode
    playerDeletes: tradeResult.playerDeletes,
    metadata: {
      type: 'signAndTrade',
      sourceTeam: teamCode,
      destinationTeam: destinationTeamCode,
      playerId: payload.playerId,
      contract: payload.contract,
      timestamp,
    },
    // Phase 56: Attach validated contexts for validateMutation de-duplication
    _signingValidation: signingValidation,
    _validatedTradeContext: tradeHandoff.tradeApplyPreparation.validatedContext,
  };
}

// ==============================================================================
// HELPER FUNCTIONS
// ==============================================================================

/**
 * Map mutation type to action type for stats tracking
 */
export function getMutationActionType(mutationType: string) {
  switch (mutationType) {
    case 'executeTrade':
      return 'trade';
    case 'signFreeAgent':
      return 'signing';
    case 'waivePlayer':
      return 'waive';
    case 'extendPlayer':
      return 'signing';
    case 'optionDecision':
      return 'signing';
    case 'renounceRights':
      return 'renounce';
    case 'storeOfferSheet':
    case 'matchOfferSheet':
    case 'declineOfferSheet':
    case 'finalizeMatchedOfferSheet':
    case 'finalizeDeclinedOfferSheet':
    case 'signAndTrade':
      return 'signing';
    default:
      return 'unknown';
  }
}

/**
 * Compute set dead cap result
 */
export function computeSetDeadCapResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}: ComputeMutationParamsWithCurrentState<
  MutationTeamOnlyCurrentState,
  MutationPayloadInputByType['setDeadCap']
>): ComputeResultLike {
  const { teamCode } = payload;
  const { team } = requireBasicTeamState(currentState, 'setDeadCap');

  if (!payload.deadCap || !Array.isArray(payload.deadCap)) {
    return {
      success: false,
      error: 'Invalid deadCap payload: must be an array',
    };
  }

  // Update deadCap
  const updatedTeam = {
    ...team,
    deadCap: payload.deadCap,
    // Add logic to clean up legacy fields if we want to force migration?
    // For now, let's keep it simple: new schema takes precedence in computation anyway.
  };
  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };
  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedTeam,
    toEndYear(seasonId)
  ).totals;

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [],
    metadata: {
      actionType: 'setDeadCap',
      teamCode,
      deadCapChanges:
        Array.isArray(payload.deadCapChanges) && payload.deadCapChanges.length
          ? payload.deadCapChanges
          : ['Dead cap updated'],
      timestamp,
    },
  };
}
