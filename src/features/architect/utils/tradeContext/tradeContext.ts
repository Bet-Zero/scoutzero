/**
 * FILE: src/features/architect/utils/tradeContext/tradeContext.ts
 * PURPOSE: Trade snapshot, preparation, and preview helpers.
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * HISTORY:
 *  - 2026-01-30: Phase 58 - Extracted from mutationPipeline.ts
 *  - 2026-01-30: Phase 59 - Moved validateTradeForContext to legacy/ namespace
 *  - 2026-03-27: TM-3E - Added canonical preview authority naming and
 *                        clarified preparation-vs-authority boundary.
 *  - 2026-03-28: TM-5D - Clarified canonical preparation and preview
 *                        ownership boundaries so safe staging is preserved.
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Types: src/features/architect/utils/tradeContext/types.ts
 *  - Phase 56: Post-Trade Snapshot Validation + Pure Compute
 *  - Phase 58: Trade Context Extraction + Shape Hardening
 *  - Phase 59: Legacy Trade Validation Retirement
 *
 * DESIGN:
 * This module contains the Phase 56 / TM-3B trade-apply helpers up to the
 * prepared validated context handoff:
 * - buildPostTradeTeamsSnapshot(): Pure function that applies roster moves
 * - validatePostTradeSnapshotForContext(): Validates snapshot and returns context
 * - buildTradeApplyPreparation(): Canonical preparation handoff only
 * - buildSignAndTradeTradeHandoff(): SAT-specific handoff into trade preparation
 * - getTradePreviewAuthority(): Canonical preview authority surface
 *
 * INTENTIONAL STAGING BOUNDARIES:
 * - Preparation stays separate from execution authority so preview/apply can
 *   reuse the same prepared trade context without blurring final legality.
 * - Preview stays separate from apply because it intentionally omits the live
 *   world-state-only gates and never crosses into persistence.
 *
 * Legacy convenience wrapper (validateTradeForContext) moved to ./legacy/ in Phase 59.
 *
 * These were extracted from mutationPipeline.ts to:
 * 1. Improve maintainability (smaller files, single responsibility)
 * 2. Enable better testing of snapshot/context logic in isolation
 * 3. Define a clear module boundary for the trade validation pipeline
 *
 * PURE FUNCTION GUARANTEES:
 * - buildPostTradeTeamsSnapshot: No side effects, no validation calls
 * - validatePostTradeSnapshotForContext: Calls validateTrade exactly ONCE
 * - buildSignAndTradeTradeHandoff: Deterministic SAT handoff builder
 * - Both functions are deterministic given the same inputs
 */

import { validateTrade } from '@/features/architect/utils/tradeMachine';
import { toEndYear } from '@/features/architect/utils/seasonFormat';
import { assertPostTradeSnapshot } from './assertions';
import { normalizeContractForWorld } from '@/features/architect/utils/contractNormalization';
import {
  isSignAndTradeEligible,
  resolveSignAndTradeContractPayload,
  validateSignAndTradeContractPayload,
  type SignAndTradePlayerLike,
} from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';
import { createValidationIssue } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';
import type {
  ArchitectMutationPlayerRecord,
  ArchitectMutationTeamRecord,
  ArchitectTradePayloadPlayer,
} from '@/features/architect/utils/mutationPipeline';
import type {
  NormalizedTeamPick,
  TradeExceptionRecord,
  TradeValidationResult,
  TradeValidatorContext,
} from '@/features/architect/utils/tradeMachine/constants/types';
import {
  validateTradePreviewAuthority,
  type TradePreviewExcludedAuthorityStage,
} from './tradeExecutionAuthority';
import type {
  AnyRecord,
  BuildTradeApplyPreparationParams,
  BuildPostTradeTeamsSnapshotParams,
  OutgoingTradeRouteLike,
  PostTradeSnapshot,
  TradeApplyPreparation,
  TradeApplyValidationPlayer,
  TradeApplyValidationTeam,
  TeamUpdate,
  ValidatePostTradeSnapshotForContextParams,
  ValidatedTradeContext,
  ValidationTeam,
  ValidationIssue,
  PayloadPlayerIngress,
  PayloadTeamIngress,
  TradeContextValidationPlayer,
  TradeContextPayload,
  TradeContextNormalizedPayload,
  TradeContextCurrentState,
} from './types';

type SnapshotTradeException = Required<
  Pick<
    TradeExceptionRecord,
    'id' | 'amount' | 'totalAmount' | 'remainingAmount' | 'usedAmount'
  >
> &
  Pick<TradeExceptionRecord, 'createdSeason' | 'expiresOn' | 'createdFrom'>;

type SnapshotTradeExceptionSource = 'legacy' | 'canonical';

type SnapshotTradeExceptionCandidate = {
  normalized: SnapshotTradeException;
  completeness: number;
  source: SnapshotTradeExceptionSource;
};


// Wave 9 Step 3: payload normalization + player projections extracted to submodule
export * from './tradeContext.payloadNormalization';
import {
  buildAuthoritativeTradeApplyReceives,
  buildSnapshotTradeExceptions,
  buildTradeIncomingPlayerSnapshot,
  buildTradeValidationPlayer,
  buildTradeValidationTeamRecord,
  buildTradeValidatorContext,
  findMatchingTradeReceivePayload,
  findTradePlayerSnapshot,
  getTradeApplyValidationPlayerKey,
  getTradePayloadPlayerId,
  getTradePayloadPlayerMatchKey,
  mergeTradeApplyValidationPlayer,
  normalizeFallbackTradeApplyValidationTeam,
  normalizeSnapshotTradeException,
  normalizeTradeTeamCodeLike,
  projectTradeApplyValidationPlayer,
  resolveOutgoingTradeDestinationTeamCode,
  toFiniteNumberOrUndefined,
  toNonEmptyString,
  toObjectRecord,
  toScalarId,
  toSignAndTradePlayerLike,
  toStringOrNull,
} from './tradeContext.payloadNormalization';


// ==============================================================================
// PHASE 56/58: POST-TRADE SNAPSHOT BUILDER
// ==============================================================================

/**
 * Phase 56: Build post-trade team snapshot (PURE function - no validation calls).
 *
 * This function applies roster moves to build the post-trade state that validation
 * needs to see. It does NOT call any validators - it purely transforms state.
 *
 * The snapshot represents the team state AFTER:
 * - Outgoing players removed from roster/players
 * - Incoming players added to roster/players
 * - Draft picks exchanged
 * - Entitlements transferred
 */
export function buildPostTradeTeamsSnapshot({
  payload,
  currentState,
  seasonId,
  timestamp,
}: BuildPostTradeTeamsSnapshotParams): PostTradeSnapshot {
  const normalizedPayload = normalizeTradeContextPayload(payload);
  const payloadTeams = normalizedPayload.teams;
  const teamUpdates: TeamUpdate[] = [];
  const timestampISO = new Date(timestamp).toISOString();

  const payloadTeamCodes = payloadTeams
    .map((team) => normalizeTradeTeamCodeLike(team.teamCode))
    .filter(Boolean) as string[];
  const activeTeamCount = payloadTeamCodes.length;
  const currentEndYear =
    toEndYear(seasonId) ?? new Date(timestamp).getFullYear();
  const enforceSatPreflight =
    normalizedPayload?.tradeCtx?.source === 'tradeMachine' ||
    normalizedPayload?.tradeCtx?.enforceSignAndTradePreflight === true;

  const currentTeamByCode = new Map<string | null, AnyRecord>(
    (currentState.teams || []).map(({ teamCode, team }) => [
      normalizeTradeTeamCodeLike(teamCode),
      team,
    ])
  );
  const validationSendsByTeam: TradeContextValidationPlayer[][] =
    payloadTeams.map((teamTrade, senderIndex) => {
      const senderTeamCode = payloadTeamCodes[senderIndex];
      const senderTeamState =
        currentTeamByCode.get(senderTeamCode) ||
        currentState.teams[senderIndex]?.team;

      return (teamTrade.sends || []).map((player) =>
        buildTradeValidationPlayer({
          player,
          sourceTeamState: senderTeamState,
        })
      );
    });
  const validationReceivesByTeam: TradeContextValidationPlayer[][] =
    payloadTeams.map(() => []);

  if (enforceSatPreflight) {
    payloadTeams.forEach((teamTrade, senderIndex) => {
      const senderTeamCode = payloadTeamCodes[senderIndex];
      const senderTeamState =
        currentTeamByCode.get(senderTeamCode) ||
        currentState.teams[senderIndex]?.team;
      const senderCapHolds = Array.isArray(senderTeamState?.capHolds)
        ? senderTeamState.capHolds
        : [];

      (validationSendsByTeam[senderIndex] || []).forEach(
        (player, playerIndex) => {
          if (player.signAndTrade !== true) return;

          const destinationTeamId = resolveOutgoingTradeDestinationTeamCode({
            payloadTeamCodes,
            senderIndex,
            player,
          });
          const playerLabel =
            player.name ||
            player.displayName ||
            player.playerName ||
            player.player_id ||
            player.id ||
            `send[${playerIndex}]`;

          if (
            !destinationTeamId ||
            !payloadTeamCodes.includes(destinationTeamId) ||
            destinationTeamId === senderTeamCode
          ) {
            throw new Error(
              `[SIGN_AND_TRADE_APPLY_ERROR] Outgoing sign-and-trade player "${playerLabel}" from ${senderTeamCode} must have a valid destination team`
            );
          }

          const eligibility = isSignAndTradeEligible({
            player: toSignAndTradePlayerLike(player),
            yearKey: currentEndYear,
            sourceTeamId: senderTeamCode,
            sourceTeamCapHolds: senderCapHolds,
          });

          if (!eligibility.eligible) {
            throw new Error(
              `[SIGN_AND_TRADE_APPLY_ERROR] Outgoing sign-and-trade player "${playerLabel}" is ineligible (${eligibility.reasonCode})`
            );
          }

          if (!player.signAndTradeContract) {
            throw new Error(
              `[SIGN_AND_TRADE_APPLY_ERROR] Outgoing sign-and-trade player "${playerLabel}" is missing signAndTradeContract payload`
            );
          }

          const contract = resolveSignAndTradeContractPayload(
            toSignAndTradePlayerLike(player),
            currentEndYear,
            { allowPlayerContractFallback: false }
          );
          const contractValidation = validateSignAndTradeContractPayload(
            contract,
            currentEndYear,
            { requireActiveYearRow: true }
          );

          if (!contractValidation.valid) {
            throw new Error(
              `[SIGN_AND_TRADE_APPLY_ERROR] Invalid sign-and-trade contract for "${playerLabel}": ${contractValidation.reasons.join('; ')}`
            );
          }
        }
      );
    });
  }

  if (activeTeamCount >= 3) {
    payloadTeams.forEach((teamTrade, senderIndex) => {
      const senderTeamCode = payloadTeamCodes[senderIndex];
      (teamTrade.sends || []).forEach((player, playerIndex) => {
        const resolvedTarget = resolveOutgoingTradeDestinationTeamCode({
          payloadTeamCodes,
          senderIndex,
          player,
        });

        const isValidTarget =
          !!resolvedTarget &&
          payloadTeamCodes.includes(resolvedTarget) &&
          resolvedTarget !== senderTeamCode;

        if (!isValidTarget) {
          const playerLabel =
            player.name ||
            player.displayName ||
            player.player_id ||
            `send[${playerIndex}]`;
          const destinationDetail = resolvedTarget
            ? `invalid destination "${resolvedTarget}"`
            : 'missing destination';

          throw new Error(
            `[TRADE_APPLY_ROUTING_ERROR] 3+ team apply requires explicit valid destination for outgoing player "${playerLabel}" from ${senderTeamCode || `team-${senderIndex}`}: ${destinationDetail}`
          );
        }
      });
    });
  }

  for (let i = 0; i < payloadTeams.length; i++) {
    const teamTrade = payloadTeams[i];
    const { teamCode, team } = currentState.teams[i];
    const thisTeamCode = normalizeTradeTeamCodeLike(teamCode);

    const updatedTeam: AnyRecord = { ...team };
    const validationSends = validationSendsByTeam[i] || [];
    const outgoingPlayerIds = (teamTrade.sends || [])
      .map((player) => getTradePayloadPlayerId(player))
      .filter((playerId): playerId is string => Boolean(playerId));
    const outgoingSignAndTradePlayers = validationSends.filter(
      (player) => player.signAndTrade === true
    );
    const outgoingSignAndTradeIds = outgoingSignAndTradePlayers
      .map((player) => getTradePayloadPlayerId(player))
      .filter((playerId): playerId is string => Boolean(playerId));
    const outgoingSignAndTradeNames = outgoingSignAndTradePlayers
      .map((player) => player.name || player.displayName || player.playerName)
      .filter((playerName): playerName is string => Boolean(playerName));

    const incomingPlayers: AnyRecord[] = [];
    const validationReceives: AnyRecord[] = [];
    payloadTeams.forEach((otherTeamTrade, otherIndex) => {
      if (otherIndex !== i) {
        const otherTeamCode =
          payloadTeamCodes[otherIndex] ||
          normalizeTradeTeamCodeLike(currentState.teams[otherIndex]?.teamCode);
        const otherTeamState =
          currentTeamByCode.get(otherTeamCode) ||
          currentState.teams[otherIndex]?.team;

        (otherTeamTrade.sends || []).forEach((player, playerIndex) => {
          const validationPlayer = validationSendsByTeam[otherIndex]?.[
            playerIndex
          ] || { ...player };
          const receiveOverride = findMatchingTradeReceivePayload(
            teamTrade.receives || [],
            player
          );
          const mergedValidationPlayer = receiveOverride
            ? { ...validationPlayer, ...receiveOverride }
            : validationPlayer;
          const incomingPlayerSnapshot = buildTradeIncomingPlayerSnapshot({
            player,
            sourceTeamState: otherTeamState,
          });
          const mergedIncomingPlayerSnapshot = receiveOverride
            ? { ...incomingPlayerSnapshot, ...receiveOverride }
            : incomingPlayerSnapshot;
          const resolvedTarget = resolveOutgoingTradeDestinationTeamCode({
            payloadTeamCodes,
            senderIndex: otherIndex,
            player,
          });

          if (resolvedTarget) {
            if (resolvedTarget === thisTeamCode) {
              validationReceives.push(mergedValidationPlayer);

              if (player.signAndTrade === true) {
                const satContract = resolveSignAndTradeContractPayload(
                  toSignAndTradePlayerLike(mergedValidationPlayer),
                  currentEndYear,
                  { allowPlayerContractFallback: false }
                );
                const normalizedSatContract =
                  normalizeContractForWorld({
                    ...(satContract || {}),
                    contractType: 'Sign & Trade',
                    signAndTrade: true,
                    signingDate: timestampISO,
                    signingTeam: otherTeamCode,
                  }) || null;

                incomingPlayers.push({
                  ...mergedIncomingPlayerSnapshot,
                  signAndTrade: true,
                  contractType: 'Sign & Trade',
                  contract: normalizedSatContract,
                  signedDate: timestampISO,
                  isNewlySignedFA: true,
                  originTeamId: otherTeamCode,
                });
              } else {
                incomingPlayers.push(mergedIncomingPlayerSnapshot);
              }
            }
            return;
          }

          if (activeTeamCount <= 2) {
            validationReceives.push(mergedValidationPlayer);
            incomingPlayers.push(mergedIncomingPlayerSnapshot);
            return;
          }

          throw new Error(
            `[TRADE_APPLY_ROUTING_ERROR] 3+ team apply missing destination for player "${player.name || player.displayName || player.player_id}"`
          );
        });
      }
    });
    validationReceivesByTeam[i] = validationReceives;

    const incomingPlayerIds = incomingPlayers
      .map((player) => getTradePayloadPlayerId(player))
      .filter((playerId): playerId is string => Boolean(playerId));

    updatedTeam.roster = [
      ...(Array.isArray(team.roster) ? team.roster : []).filter(
        (id: string) => !outgoingPlayerIds.includes(id)
      ),
      ...incomingPlayerIds,
    ];

    updatedTeam.players = [
      ...(Array.isArray(team.players) ? team.players : []).filter(
        (player: AnyRecord) => {
          const playerId = getTradePayloadPlayerId(player);
          return !outgoingPlayerIds.includes(playerId || '');
        }
      ),
      ...incomingPlayers.map((player) => ({
        ...player,
        teamCode,
        teamName: team.teamName,
      })),
    ];

    if (Array.isArray(team.twoWayPlayers)) {
      const merged = [
        ...team.twoWayPlayers.filter((player: AnyRecord) => {
          const playerId = getTradePayloadPlayerId(player);
          return !outgoingPlayerIds.includes(playerId || '');
        }),
        ...incomingPlayers
          .filter((player) => player.isTwoWay === true)
          .map((player) => ({ ...player, teamCode, teamName: team.teamName })),
      ];
      const seen = new Set<string>();
      updatedTeam.twoWayPlayers = merged.filter((player: AnyRecord) => {
        const playerId = getTradePayloadPlayerId(player);
        if (!playerId) return true;
        if (seen.has(playerId)) return false;
        seen.add(playerId);
        return true;
      });
    }

    const receivesSignAndTrade = incomingPlayers.some(
      (p) => p.signAndTrade === true
    );

    if (
      outgoingSignAndTradeIds.length > 0 &&
      Array.isArray(updatedTeam.capHolds)
    ) {
      updatedTeam.capHolds = updatedTeam.capHolds.filter((hold: AnyRecord) => {
        const holdPlayerId = getTradePayloadPlayerId(hold);
        if (holdPlayerId && outgoingSignAndTradeIds.includes(holdPlayerId)) {
          return false;
        }
        const holdName =
          toNonEmptyString(hold.playerName) || toNonEmptyString(hold.name);
        if (holdName && outgoingSignAndTradeNames.includes(holdName)) {
          return false;
        }
        return true;
      });
    }

    const outgoingPicks = teamTrade.picksOut || [];
    const incomingPicks: NormalizedTeamPick[] = [];
    payloadTeams.forEach((otherTeamTrade, otherIndex) => {
      if (otherIndex !== i) {
        incomingPicks.push(...(otherTeamTrade.picksOut || []));
      }
    });

    updatedTeam.draftPicks = [
      ...(Array.isArray(team.draftPicks) ? team.draftPicks : []).filter(
        (pick: NormalizedTeamPick) =>
          !outgoingPicks.some(
            (outgoing) =>
              outgoing.year === pick.year &&
              outgoing.round === pick.round &&
              outgoing.owner === pick.owner
          )
      ),
      ...incomingPicks,
    ];

    const outgoingEntitlementIds = (teamTrade.entitlementsOut || [])
      .map((e) => e.entitlementId || e.id)
      .filter(Boolean);

    const incomingEntitlementIds: string[] = [];
    payloadTeams.forEach((otherTeamTrade, otherIndex) => {
      if (otherIndex === i) return;

      const otherOut = otherTeamTrade.entitlementsOut || [];

      otherOut.forEach((e: AnyRecord) => {
        const entIdRaw = e.entitlementId || e.id;
        if (!entIdRaw) return;
        const entId = String(entIdRaw);

        const toTeam = normalizeTradeTeamCodeLike(e.toTeamId);

        if (toTeam) {
          if (!payloadTeamCodes.includes(toTeam)) {
            return;
          }
          if (toTeam === thisTeamCode) {
            incomingEntitlementIds.push(entId);
          }
          return;
        }

        if (activeTeamCount > 2) {
          console.warn(
            `[tradeContext] Entitlement "${entId}" has no toTeamId in ${activeTeamCount}-team trade - skipping`
          );
          return;
        }

        incomingEntitlementIds.push(entId);
      });
    });

    if (
      outgoingEntitlementIds.length > 0 ||
      incomingEntitlementIds.length > 0
    ) {
      const currentEntitlementIds = Array.isArray(team.entitlementIds)
        ? team.entitlementIds
        : [];
      const newEntitlementIds = [
        ...currentEntitlementIds.filter(
          (id: string) => !outgoingEntitlementIds.includes(id)
        ),
        ...incomingEntitlementIds,
      ];
      updatedTeam.entitlementIds = [...new Set(newEntitlementIds)];
    }

    updatedTeam.tradeExceptions = buildSnapshotTradeExceptions({
      team,
      teamCode,
      timestamp,
    });

    updatedTeam.source = {
      ...(updatedTeam.source as AnyRecord),
      type: 'world-snapshot',
      lastModifiedAt: timestampISO,
    };

    updatedTeam.totals = computeTeamCapTotals(updatedTeam, currentEndYear);

    if (receivesSignAndTrade) {
      const totalsObj = updatedTeam.totals as AnyRecord | undefined;
      const existingLevel =
        totalsObj?.hardCapLevel ||
        (updatedTeam.hardCapped === 2 ? 'secondApron' : null);
      const hardCapLevel =
        existingLevel === 'secondApron' ? 'secondApron' : 'firstApron';

      updatedTeam.hardCapped = hardCapLevel === 'secondApron' ? 2 : 1;
      updatedTeam.hardCapLevel = hardCapLevel;
      updatedTeam.hardCapReason =
        'Triggered by receiving sign-and-trade player';
      updatedTeam.hardCapTriggeredBy = 'signAndTrade';
      updatedTeam.totals = {
        ...(totalsObj || {}),
        isHardCapped: true,
        hardCapLevel,
        hardCapDetail: 'Triggered by receiving sign-and-trade player',
      };
    }

    teamUpdates.push({ teamCode, team: updatedTeam });
  }

  const entitlementOwnership = new Map<string, string>();
  for (const { teamCode, team } of teamUpdates) {
    const entitlementIds = Array.isArray(team.entitlementIds)
      ? team.entitlementIds
      : [];
    for (const entId of entitlementIds) {
      const ownershipTeamCode = teamCode ?? 'UNKNOWN_TEAM';
      if (entitlementOwnership.has(entId)) {
        const otherTeam = entitlementOwnership.get(entId);
        throw new Error(
          `[tradeContext] INVARIANT VIOLATION: Entitlement "${entId}" would exist on both ${otherTeam} and ${ownershipTeamCode} after trade. This indicates a routing bug.`
        );
      }
      entitlementOwnership.set(entId, ownershipTeamCode);
    }
  }

  const validationTeams: ValidationTeam[] = payloadTeams.map(
    (teamTrade, idx) => {
      const teamUpdate = teamUpdates[idx];
      return {
        team: buildTradeValidationTeamRecord(
          teamUpdate.team,
          teamUpdate.teamCode
        ),
        teamCode: teamUpdate.teamCode,
        sends: validationSendsByTeam[idx] || [],
        receives: validationReceivesByTeam[idx] || [],
        picksOut: teamTrade.picksOut || [],
        picksIn: [],
        cashSent: teamTrade.cashSent || 0,
        cashReceived: teamTrade.cashReceived || 0,
      };
    }
  );

  return {
    teamUpdates,
    validationTeams,
    payloadTeams: payloadTeams,
    _isPostTradeSnapshot: true,
  };
}

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
}: ValidatePostTradeSnapshotForContextParams): ValidatedTradeContext {
  assertPostTradeSnapshot(snapshot, 'validatePostTradeSnapshotForContext');

  const currentYear = toEndYear(seasonId) ?? new Date().getFullYear();

  try {
    const validationInput = {
      teams: snapshot.validationTeams,
      capProjections: payload.capProjections || {},
      currentYear,
      tradeCtx: buildTradeValidatorContext(payload),
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
      validationTeams: snapshot.validationTeams.map(
        normalizeFallbackTradeApplyValidationTeam
      ),
      _isValidatedTradeContext: true,
    };
  }
}

// ==============================================================================
// TM-3B: TRADE APPLY PREPARATION + STAGE-1 VERDICT ADAPTER
// ==============================================================================

function normalizeTradePayloadPlayer({
  player,
  payloadTeamCodes,
  senderIndex,
}: {
  player: PayloadPlayerIngress | null | undefined;
  payloadTeamCodes: string[];
  senderIndex: number;
}): ArchitectTradePayloadPlayer {
  const normalized: ArchitectTradePayloadPlayer = {};
  const playerId =
    toNonEmptyString(player?.player_id) ??
    toNonEmptyString(player?.playerId) ??
    toNonEmptyString(player?.id);
  const name =
    toNonEmptyString(player?.name) ??
    toNonEmptyString(player?.displayName) ??
    toNonEmptyString(player?.playerName);
  const displayName = toNonEmptyString(player?.displayName) ?? name;
  const originTeamId = toNonEmptyString(player?.originTeamId);
  const matchIncoming = toFiniteNumberOrUndefined(player?.matchIncoming);
  const matchOutgoing = toFiniteNumberOrUndefined(player?.matchOutgoing);
  const absorptionMode = toNonEmptyString(player?.absorptionMode);
  const tpeId = toNonEmptyString(player?.tpeId);
  const isTwoWay = player?.isTwoWay === true;
  const tradeTo = resolveOutgoingTradeDestinationTeamCode({
    payloadTeamCodes,
    senderIndex,
    player: player ?? {},
  });

  if (playerId !== undefined) {
    normalized.player_id = playerId;
  }
  if (name !== undefined) {
    normalized.name = name;
  }
  if (displayName !== undefined) {
    normalized.displayName = displayName;
  }
  if (originTeamId !== undefined) {
    normalized.originTeamId = originTeamId;
  }
  if (matchIncoming !== undefined) {
    normalized.matchIncoming = matchIncoming;
  }
  if (matchOutgoing !== undefined) {
    normalized.matchOutgoing = matchOutgoing;
  }
  if (absorptionMode !== undefined) {
    normalized.absorptionMode = absorptionMode;
  }
  if (tpeId !== undefined) {
    normalized.tpeId = tpeId;
  }
  if (isTwoWay) {
    normalized.isTwoWay = true;
  }
  if (player?.signAndTrade === true) {
    normalized.signAndTrade = true;
  }
  if (player?.signAndTradeContract != null) {
    normalized.signAndTradeContract = player.signAndTradeContract;
  }
  if (tradeTo !== null) {
    normalized.tradeTo = tradeTo;
  }

  return normalized;
}

function normalizeTradePayloadEntitlements(
  entitlements: PayloadTeamIngress['entitlementsOut']
): TradeContextNormalizedPayload['teams'][number]['entitlementsOut'] {
  if (!Array.isArray(entitlements)) {
    return [];
  }

  return entitlements.map((entitlement) => ({
    ...(entitlement?.entitlementId != null
      ? { entitlementId: String(entitlement.entitlementId) }
      : {}),
    ...(entitlement?.id != null ? { id: String(entitlement.id) } : {}),
    ...(toNonEmptyString(entitlement?.type) !== undefined
      ? { type: toNonEmptyString(entitlement?.type) }
      : {}),
    ...(toNonEmptyString(entitlement?.name) !== undefined
      ? { name: toNonEmptyString(entitlement?.name) }
      : {}),
    ...(toFiniteNumberOrUndefined(entitlement?.year) !== undefined
      ? { year: toFiniteNumberOrUndefined(entitlement?.year) }
      : entitlement?.year != null
        ? { year: String(entitlement.year) }
        : {}),
    ...(toFiniteNumberOrUndefined(entitlement?.round) !== undefined
      ? { round: toFiniteNumberOrUndefined(entitlement?.round) }
      : {}),
    ...(entitlement?.toTeamId != null
      ? { toTeamId: String(entitlement.toTeamId) }
      : {}),
  }));
}

function normalizeTradePayloadTeam({
  team,
  payloadTeamCodes,
  senderIndex,
}: {
  team: PayloadTeamIngress | null | undefined;
  payloadTeamCodes: string[];
  senderIndex: number;
}): TradeContextNormalizedPayload['teams'][number] {
  const teamCode =
    normalizeTradeTeamCodeLike(team?.teamCode) ??
    normalizeTradeTeamCodeLike(team?.team?.teamCode) ??
    normalizeTradeTeamCodeLike(team?.team?.id) ??
    normalizeTradeTeamCodeLike(team?.teamId);

  return {
    teamCode,
    sends: Array.isArray(team?.sends)
      ? team.sends.map((player) =>
          normalizeTradePayloadPlayer({
            player,
            payloadTeamCodes,
            senderIndex,
          })
        )
      : [],
    receives: Array.isArray(team?.receives)
      ? team.receives.map((player) =>
          normalizeTradePayloadPlayer({
            player,
            payloadTeamCodes,
            senderIndex,
          })
        )
      : [],
    entitlementsOut: normalizeTradePayloadEntitlements(
      team?.entitlementsOut || team?.outgoingEntitlements || []
    ),
    picksOut: Array.isArray(team?.picksOut) ? team.picksOut : [],
    ...(toFiniteNumberOrUndefined(team?.cashSent) !== undefined
      ? { cashSent: toFiniteNumberOrUndefined(team?.cashSent) }
      : {}),
    ...(toFiniteNumberOrUndefined(team?.cashReceived) !== undefined
      ? { cashReceived: toFiniteNumberOrUndefined(team?.cashReceived) }
      : {}),
  };
}

export function normalizeTradeContextPayload(
  payload: TradeContextPayload
): TradeContextNormalizedPayload {
  const ingressTeams = Array.isArray(payload?.teams) ? payload.teams : [];
  const payloadTeamCodes = ingressTeams
    .map(
      (team) =>
        normalizeTradeTeamCodeLike(team?.teamCode) ??
        normalizeTradeTeamCodeLike(team?.team?.teamCode) ??
        normalizeTradeTeamCodeLike(team?.team?.id) ??
        normalizeTradeTeamCodeLike(team?.teamId)
    )
    .map((teamCode) => teamCode ?? '');

  return {
    teams: ingressTeams.map((team, senderIndex) =>
      normalizeTradePayloadTeam({
        team,
        payloadTeamCodes,
        senderIndex,
      })
    ),
    ...(payload?.capProjections
      ? { capProjections: payload.capProjections }
      : {}),
    ...(payload?.tradeCtx ? { tradeCtx: payload.tradeCtx } : {}),
    ...(payload?.asOfDate != null ? { asOfDate: payload.asOfDate } : {}),
  };
}

function buildTradeValidationPayload({
  payload,
  asOfDate,
}: Pick<
  BuildTradeApplyPreparationParams,
  'payload' | 'asOfDate'
>): TradeContextNormalizedPayload {
  const normalizedPayload = normalizeTradeContextPayload(payload);

  if (!asOfDate || normalizedPayload.asOfDate === asOfDate) {
    return normalizedPayload;
  }

  return {
    ...normalizedPayload,
    asOfDate,
    tradeCtx: {
      ...(normalizedPayload?.tradeCtx || {}),
      asOfDate,
    },
  };
}

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
  });

  return {
    postTradeSnapshot,
    validatedContext,
    validationPayload,
  };
}

// ==============================================================================
// TM-1A / TM-3D: FULL LEGALITY PREVIEW (execution authority minus world-state gates)
// ==============================================================================

function buildPreviewAuthorityTeamMaps({
  currentState,
  postTradeSnapshot,
}: {
  currentState: TradeContextCurrentState;
  postTradeSnapshot: PostTradeSnapshot;
}): {
  beforeTeamsByCode: Record<string, AnyRecord>;
  afterTeamsByCode: Record<string, AnyRecord>;
} {
  const beforeTeamsByCode: Record<string, AnyRecord> = {};
  for (const entry of currentState.teams ?? []) {
    const code = entry?.teamCode;
    if (code && entry.team) {
      beforeTeamsByCode[code] = entry.team;
    }
  }

  const afterTeamsByCode: Record<string, AnyRecord> = {};
  for (const update of postTradeSnapshot.teamUpdates) {
    const code = update?.teamCode;
    if (code && update.team) {
      afterTeamsByCode[code] = update.team;
    }
  }

  return {
    beforeTeamsByCode,
    afterTeamsByCode,
  };
}

export type FullLegalityPreviewResult = {
  legal: boolean;
  violations: ValidationIssue[];
  warnings: ValidationIssue[];
  reason: string;
  error: string | null;
  source: 'apply-preview';
  omittedStages?: TradePreviewExcludedAuthorityStage[];
};

type TradePreviewAuthorityParams = {
  payload: TradeContextPayload;
  currentState: TradeContextCurrentState;
  seasonId: string;
  preparation?: TradeApplyPreparation;
};

// TM-3D/TM-3E/TM-5D: Canonical preview authority surface.
// Preview mirrors apply across the shared non-live stages only:
// prepare -> snapshot stage -> post-state stage.
// Preview intentionally omits the live world-state-only gates and never
// replaces apply authority or persistence.
export function getTradePreviewAuthority({
  payload,
  currentState,
  seasonId,
  preparation,
}: TradePreviewAuthorityParams): FullLegalityPreviewResult {
  try {
    const prepared =
      preparation ||
      buildTradeApplyPreparation({
        payload,
        currentState,
        seasonId,
        timestamp: Date.now(),
      });
    const { beforeTeamsByCode, afterTeamsByCode } =
      buildPreviewAuthorityTeamMaps({
        currentState,
        postTradeSnapshot: prepared.postTradeSnapshot,
      });
    const previewAuthority = validateTradePreviewAuthority({
      seasonId,
      validatedTradeContext: prepared.validatedContext,
      beforeTeamsByCode,
      afterTeamsByCode,
      worldId: String(payload.tradeCtx?.worldId ?? 'preview-world'),
      asOfDate:
        typeof payload.tradeCtx?.asOfDate === 'string'
          ? payload.tradeCtx.asOfDate
          : null,
    });

    return {
      legal: previewAuthority.valid,
      violations: previewAuthority.violations,
      warnings: previewAuthority.warnings,
      reason: previewAuthority.reason,
      error:
        previewAuthority.failedStage === 'SNAPSHOT_VALIDATION'
          ? (previewAuthority.error ?? prepared.validatedContext.error ?? null)
          : (prepared.validatedContext.error ?? null),
      source: 'apply-preview',
      omittedStages: previewAuthority.omittedStages,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      legal: false,
      violations: [
        {
          message,
          severity: 'error' as const,
          rule: 'apply-preview-error',
          code: 'APPLY_PREVIEW_ERROR',
        },
      ],
      warnings: [],
      reason: message,
      error: message,
      source: 'apply-preview',
    };
  }
}

/**
 * @deprecated Compatibility alias. Use getTradePreviewAuthority() as the
 * canonical preview authority surface. This alias is retained for legacy/
 * compatibility re-export only.
 */
export function getFullLegalityPreview(
  params: TradePreviewAuthorityParams
): FullLegalityPreviewResult {
  return getTradePreviewAuthority(params);
}

// ==============================================================================
// PHASE 59: LEGACY FUNCTION MOVED
// ==============================================================================
// validateTradeForContext has been moved to tradeContext/legacy/index.ts
// Import from '@/features/architect/utils/tradeContext/legacy' for the deprecated wrapper
