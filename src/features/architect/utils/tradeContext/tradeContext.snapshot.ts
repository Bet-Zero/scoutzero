/**
 * FILE: src/features/architect/utils/tradeContext/tradeContext.snapshot.ts
 * PURPOSE: Post-trade snapshot builder, context validator, and trade apply preparation.
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * Wave 9 Step 4: Extracted from tradeContext.ts (L161-L1114).
 * Imports helpers from ./tradeContext.payloadNormalization (leaf→sibling, no cycle).
 */

import { validateTrade } from '@/features/architect/utils/tradeMachine';
import { toEndYear } from '@/features/architect/utils/seasonFormat';
import { assertPostTradeSnapshot } from './assertions';
import { normalizeContractForWorld } from '@/features/architect/utils/contractNormalization';
import { createValidationIssue } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';
import { getTrustedPersistedHardCapAuthority } from '@/features/architect/utils/tradeMachine/utils/tradeHardCapLedgerAuthority';
import {
  buildAuthoritativeTradeApplyReceives,
  buildTradeValidatorContext,
  normalizeFallbackTradeApplyValidationTeam,
  normalizeTradeTeamCodeLike,
  projectTradeApplyValidationPlayer,
  toNonEmptyString,
} from './tradeContext.payloadNormalization';
import type {
  TradeValidationResult,
} from '@/features/architect/utils/tradeMachine/constants/types';
import type {
  ArchitectMutationPlayerRecord,
  ArchitectMutationTeamRecord,
  ArchitectTradePayloadPlayer,
} from '@/features/architect/utils/mutationPipeline';
import type {
  BuildTradeApplyPreparationParams,
  PostTradeSnapshot,
  TradeApplyPreparation,
  TradeApplyValidationPlayer,
  TradeApplyValidationTeam,
  TradeContextCurrentState,
  TradeContextNormalizedPayload,
  ValidatedTradeContext,
  ValidatePostTradeSnapshotForContextParams,
  ValidationIssue,
} from './types';

// Wave 26 Step 1: payload normalization functions
export * from './tradeContext.snapshot.payloadNorm';
import { buildTradeValidationPayload } from './tradeContext.snapshot.payloadNorm';

// Wave 26 Step 2: buildPostTradeTeamsSnapshot
export * from './tradeContext.snapshot.builder';
import { buildPostTradeTeamsSnapshot } from './tradeContext.snapshot.builder';


// ==============================================================================
// PHASE 56/58: VALIDATION CONTEXT BUILDER
// ==============================================================================

/**
 * Phase 56: Validate a post-trade snapshot and return context for pure computation.
 *
 * This function validates the POST-TRADE state (after roster moves) exactly ONCE
 * and returns a validated context object for computeTradeResult.
 *
 * CRITICAL: This validates the snapshot (post-roster-change state), NOT the original state.
 * This is required for correct TPE absorption validation.
 */
export function validatePostTradeSnapshotForContext({
  snapshot,
  payload,
  seasonId,
  trustedWorldLineage,
}: ValidatePostTradeSnapshotForContextParams): ValidatedTradeContext {
  assertPostTradeSnapshot(snapshot, 'validatePostTradeSnapshotForContext');

  const currentYear = toEndYear(seasonId) ?? new Date().getFullYear();

  try {
    const validationInput = {
      teams: snapshot.validationTeams,
      capProjections: payload.capProjections || {},
      currentYear,
      tradeCtx: buildTradeValidatorContext(payload, trustedWorldLineage),
    };

    const validation = validateTrade(validationInput) as TradeValidationResult;

    const normalizedTeamResults = Array.isArray(validation.teamResults)
      ? validation.teamResults
      : [];
    const normalizedViolations = Array.isArray(validation.violations)
      ? validation.violations
      : [];
    const normalizedWarnings = Array.isArray(validation.warnings)
      ? validation.warnings
      : [];
    const applyValidationTeams: TradeApplyValidationTeam[] =
      snapshot.validationTeams.map((snapshotTeam, index) => {
        const validatedReceives = Array.isArray(
          normalizedTeamResults[index]?.incomingPlayers
        )
          ? normalizedTeamResults[index].incomingPlayers
              .map((player) => projectTradeApplyValidationPlayer(player))
              .filter(
                (player): player is TradeApplyValidationPlayer =>
                  player !== null
              )
          : [];
        const fallbackReceives =
          normalizeFallbackTradeApplyValidationTeam(snapshotTeam).receives;
        const authoritativeReceives = buildAuthoritativeTradeApplyReceives({
          validatedReceives,
          fallbackReceives,
        });

        return {
          teamCode:
            toNonEmptyString(normalizedTeamResults[index]?.teamCode) ??
            snapshotTeam.teamCode,
          receives: authoritativeReceives,
        };
      });
    const context = {
      ...validation,
      legal: Boolean(validation.legal),
      reason: validation.reason ?? null,
      error:
        validation.error ||
        (validation.legal
          ? null
          : (validation.reason as string) || 'Trade is not legal'),
      violations: normalizedViolations,
      warnings: normalizedWarnings,
      teamResults: normalizedTeamResults,
      validationTeams: applyValidationTeams,
      _rawValidation: validation,
      _isValidatedTradeContext: true,
    };

    return context as ValidatedTradeContext;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Trade validation failed';
    const failureIssue =
      createValidationIssue(message, {
        rule: 'tradeContext',
        severity: 'error',
        code: 'TRADE_CONTEXT_VALIDATION_FAILURE',
      }) ||
      ({
        message,
        rule: 'tradeContext',
        severity: 'error',
        code: 'TRADE_CONTEXT_VALIDATION_FAILURE',
      } as ValidationIssue);

    return {
      legal: false,
      reason: message,
      error: message,
      violations: [failureIssue],
      warnings: [],
      teamResults: [],
      validationTeams: snapshot.validationTeams.map((snapshotTeam) => ({
        teamCode: snapshotTeam.teamCode,
        receives: normalizeFallbackTradeApplyValidationTeam(snapshotTeam).receives,
      })),
      _rawValidation: null,
      _isValidatedTradeContext: true,
    } as unknown as ValidatedTradeContext;
  }
}


// ==============================================================================
// TM-3B: TRADE APPLY PREPARATION + STAGE-1 VERDICT ADAPTER
// ==============================================================================

/**
 * SAT-specific handoff owner for the mutation pipeline.
 *
 * This helper does not own signing or trade legality rules. It owns only the
 * explicit handoff from an already-signed source-team state into the canonical
 * trade preparation surface.
 */
export function buildSignAndTradeTradeHandoff({
  sourceTeamCode,
  destinationTeamCode,
  updatedSourceTeam,
  destinationTeam,
  signedPlayer,
  contract,
  seasonId,
  timestamp,
  asOfDate = null,
  worldId = null,
}: {
  sourceTeamCode: string | null | undefined;
  destinationTeamCode: string | null | undefined;
  updatedSourceTeam: ArchitectMutationTeamRecord;
  destinationTeam: ArchitectMutationTeamRecord;
  signedPlayer: ArchitectMutationPlayerRecord;
  contract: ArchitectTradePayloadPlayer['signAndTradeContract'];
  seasonId: string;
  timestamp: number;
  asOfDate?: string | number | null;
  worldId?: string | null;
}): {
  tradePayload: TradeContextNormalizedPayload;
  tradeState: TradeContextCurrentState;
  tradeApplyPreparation: TradeApplyPreparation;
} {
  const signedPlayerId =
    toNonEmptyString(signedPlayer.player_id) ??
    toNonEmptyString(signedPlayer.playerId) ??
    toNonEmptyString(signedPlayer.id);
  const signedPlayerName =
    toNonEmptyString(signedPlayer.name) ??
    toNonEmptyString(signedPlayer.displayName) ??
    toNonEmptyString(signedPlayer.playerName);
  const signedPlayerDisplayName =
    toNonEmptyString(signedPlayer.displayName) ?? signedPlayerName;

  const tradePayload: TradeContextNormalizedPayload = {
    teams: [
      {
        teamCode: sourceTeamCode ?? null,
        sends: [
          {
            ...(signedPlayerId ? { player_id: signedPlayerId } : {}),
            ...(signedPlayerName ? { name: signedPlayerName } : {}),
            ...(signedPlayerDisplayName
              ? { displayName: signedPlayerDisplayName }
              : {}),
            ...(sourceTeamCode != null
              ? { originTeamId: String(sourceTeamCode) }
              : {}),
            signAndTrade: true,
            signAndTradeContract: contract,
            ...(destinationTeamCode != null
              ? { tradeTo: String(destinationTeamCode) }
              : {}),
          },
        ],
        receives: [],
      },
      {
        teamCode: destinationTeamCode ?? null,
        sends: [],
        receives: [],
      },
    ],
    ...(asOfDate != null ? { asOfDate } : {}),
    tradeCtx: {
      ...(asOfDate != null ? { asOfDate } : {}),
      ...(worldId ? { worldId } : {}),
    },
  };

  const tradeState: TradeContextCurrentState = {
    teams: [
      {
        teamCode: sourceTeamCode ?? null,
        team: updatedSourceTeam,
      },
      {
        teamCode: destinationTeamCode ?? null,
        team: destinationTeam,
      },
    ],
  };

  const tradeApplyPreparation = buildTradeApplyPreparation({
    payload: tradePayload,
    currentState: tradeState,
    seasonId,
    timestamp,
    asOfDate,
  });

  return {
    tradePayload,
    tradeState,
    tradeApplyPreparation,
  };
}

/**
 * Canonical trade-apply preparation handoff. Builds the post-trade snapshot
 * and validated context consumed by compute and authority surfaces.
 *
 * This function is the canonical preparation handoff. It does NOT determine
 * final execution legality, run live world-state-only gates, or persist
 * anything.
 */
export function buildTradeApplyPreparation({
  payload,
  currentState,
  seasonId,
  timestamp,
  asOfDate,
}: BuildTradeApplyPreparationParams): TradeApplyPreparation {
  const authorityLineages = currentState.teams
    .map((entry) => getTrustedPersistedHardCapAuthority(entry.team))
    .map((authority) => authority?.worldLineage)
    .filter((lineage): lineage is readonly string[] => Array.isArray(lineage));
  const trustedWorldLineage = authorityLineages[0];
  if (
    authorityLineages.some(
      (lineage) =>
        JSON.stringify(lineage) !== JSON.stringify(trustedWorldLineage)
    )
  ) {
    throw new Error(
      'Trade current-state Teams disagree on authenticated world lineage.'
    );
  }
  const validationPayload = buildTradeValidationPayload({
    payload,
    asOfDate,
  });

  const postTradeSnapshot = buildPostTradeTeamsSnapshot({
    payload: validationPayload,
    currentState,
    seasonId,
    timestamp,
  });

  const validatedContext = validatePostTradeSnapshotForContext({
    snapshot: postTradeSnapshot,
    payload: validationPayload,
    seasonId,
    trustedWorldLineage,
  });

  return {
    postTradeSnapshot,
    validatedContext,
    validationPayload,
  };
}
