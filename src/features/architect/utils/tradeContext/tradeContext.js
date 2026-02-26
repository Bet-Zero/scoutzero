/**
 * FILE: src/features/architect/utils/tradeContext/tradeContext.js
 * PURPOSE: Trade snapshot and validation context builders.
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * HISTORY:
 *  - 2026-01-30: Phase 58 - Extracted from mutationPipeline.js
 *  - 2026-01-30: Phase 59 - Moved validateTradeForContext to legacy/ namespace
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Types: src/features/architect/utils/tradeContext/types.js
 *  - Phase 56: Post-Trade Snapshot Validation + Pure Compute
 *  - Phase 58: Trade Context Extraction + Shape Hardening
 *  - Phase 59: Legacy Trade Validation Retirement
 *
 * DESIGN:
 * This module contains the Phase 56 "snapshot → validate → context" helpers:
 * - buildPostTradeTeamsSnapshot(): Pure function that applies roster moves
 * - validatePostTradeSnapshotForContext(): Validates snapshot and returns context
 *
 * Legacy convenience wrapper (validateTradeForContext) moved to ./legacy/ in Phase 59.
 *
 * These were extracted from mutationPipeline.js to:
 * 1. Improve maintainability (smaller files, single responsibility)
 * 2. Enable better testing of snapshot/context logic in isolation
 * 3. Define a clear module boundary for the trade validation pipeline
 *
 * PURE FUNCTION GUARANTEES:
 * - buildPostTradeTeamsSnapshot: No side effects, no validation calls
 * - validatePostTradeSnapshotForContext: Calls validateTrade exactly ONCE
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
} from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';

// Phase 72: SSOT for team cap totals computation
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';

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
 *
 * @param {Object} params
 * @param {Object} params.payload - Trade payload with teams array
 * @param {Object} params.currentState - Current state with teams array
 * @param {string} params.seasonId - Season ID (e.g., "2025-26")
 * @param {number} params.timestamp - Mutation timestamp
 * @returns {import('./types').PostTradeSnapshot} Post-trade snapshot with:
 *   - teamUpdates: Array of { teamCode, team } with roster changes applied
 *   - validationTeams: Array in format expected by validateTrade
 *   - payloadTeams: Original payload.teams for reference
 *   - _isPostTradeSnapshot: Sentinel flag (Phase 58)
 */
export function buildPostTradeTeamsSnapshot({
  payload,
  currentState,
  seasonId,
  timestamp,
}) {
  const teamUpdates = [];
  const timestampISO = new Date(timestamp).toISOString();

  // Helper: normalize TPE object to canonical schema
  const normalizeTPE = (t) => ({
    ...t,
    id:
      t.id ||
      `tpe_legacy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    amount: t.remainingAmount ?? t.totalAmount ?? t.amount ?? 0,
    totalAmount: t.totalAmount ?? t.amount ?? 0,
    remainingAmount: t.remainingAmount ?? t.totalAmount ?? t.amount ?? 0,
    usedAmount: t.usedAmount ?? 0,
  });

  // Helper: dedupe TPEs by id, preferring ones with more canonical fields
  const dedupeById = (tpes) => {
    const seen = new Map();
    for (const tpe of tpes) {
      if (!tpe.id) continue;
      const existing = seen.get(tpe.id);
      if (!existing) {
        seen.set(tpe.id, tpe);
      } else {
        const existingScore =
          (existing.remainingAmount !== undefined ? 1 : 0) +
          (existing.usedAmount !== undefined ? 1 : 0) +
          (existing.expiresOn ? 1 : 0);
        const newScore =
          (tpe.remainingAmount !== undefined ? 1 : 0) +
          (tpe.usedAmount !== undefined ? 1 : 0) +
          (tpe.expiresOn ? 1 : 0);
        if (newScore > existingScore) {
          seen.set(tpe.id, tpe);
        }
      }
    }
    return Array.from(seen.values());
  };

  // Helper: normalize team code for comparison
  const normalizeTeamCodeLike = (x) => {
    if (!x) return null;
    const s = String(x).trim();
    return s.length === 3 ? s.toUpperCase() : s;
  };

  // Get all team codes in this trade payload
  const payloadTeamCodes = payload.teams
    .map((t) => normalizeTeamCodeLike(t.team?.id || t.teamCode || t.teamId))
    .filter(Boolean);
  const activeTeamCount = payloadTeamCodes.length;
  const currentEndYear = toEndYear(seasonId);
  const enforceSatPreflight =
    payload?.tradeCtx?.source === 'tradeMachine' ||
    payload?.tradeCtx?.enforceSignAndTradePreflight === true;

  const currentTeamByCode = new Map(
    (currentState.teams || []).map(({ teamCode, team }) => [
      normalizeTeamCodeLike(teamCode),
      team,
    ])
  );

  // Fail-closed invariant for Trade Machine executeTrade sign-and-trade payloads.
  // If signAndTrade is set, contract payload + eligibility + destination must be valid.
  if (enforceSatPreflight) {
    payload.teams.forEach((teamTrade, senderIndex) => {
      const senderTeamCode = payloadTeamCodes[senderIndex];
      const senderTeamState =
        currentTeamByCode.get(senderTeamCode) || currentState.teams[senderIndex]?.team;
      const senderCapHolds = senderTeamState?.capHolds || [];

      (teamTrade.sends || []).forEach((player, playerIndex) => {
        if (player.signAndTrade !== true) return;

        const destinationTeamId = normalizeTeamCodeLike(
          player.receivingTeamId ||
            player.tradeTo ||
            player.toTeamId ||
            player.destTeamId
        );
        const playerLabel =
          player.name || player.player_id || player.id || `send[${playerIndex}]`;

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
          player,
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
          player,
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
      });
    });
  }

  // Fail-closed invariant for 3+ team apply:
  // every outgoing player must resolve to a valid destination participant.
  if (activeTeamCount >= 3) {
    payload.teams.forEach((teamTrade, senderIndex) => {
      const senderTeamCode = payloadTeamCodes[senderIndex];
      (teamTrade.sends || []).forEach((player, playerIndex) => {
        const parsedTargetIndex = Number(player.receivingTeamIndex);
        const hasIndexRoute = Number.isInteger(parsedTargetIndex);
        const normalizedTargetId = normalizeTeamCodeLike(
          player.receivingTeamId ||
            player.tradeTo ||
            player.toTeamId ||
            player.destTeamId
        );

        let resolvedTarget = normalizedTargetId;
        if (hasIndexRoute) {
          resolvedTarget = payloadTeamCodes[parsedTargetIndex] || null;
        }

        const isValidTarget =
          !!resolvedTarget &&
          payloadTeamCodes.includes(resolvedTarget) &&
          resolvedTarget !== senderTeamCode;

        if (!isValidTarget) {
          const playerLabel =
            player.name ||
            player.player_id ||
            player.id ||
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

  for (let i = 0; i < payload.teams.length; i++) {
    const teamTrade = payload.teams[i];
    const { teamCode, team } = currentState.teams[i];
    const thisTeamCode = normalizeTeamCodeLike(teamCode);

    // Build updated team state
    const updatedTeam = { ...team };

    // Get player IDs to remove and add
    const outgoingPlayerIds = (teamTrade.sends || []).map(
      (p) => p.player_id || p.id || p.playerId
    );
    const outgoingSignAndTradePlayers = (teamTrade.sends || []).filter(
      (p) => p.signAndTrade === true
    );
    const outgoingSignAndTradeIds = outgoingSignAndTradePlayers
      .map((p) => p.player_id || p.id || p.playerId)
      .filter(Boolean);
    const outgoingSignAndTradeNames = outgoingSignAndTradePlayers
      .map((p) => p.name || p.displayName)
      .filter(Boolean);

    // Collect incoming players from other teams (with directed routing support)
    const incomingPlayers = [];
    payload.teams.forEach((otherTeamTrade, otherIndex) => {
      if (otherIndex !== i) {
        (otherTeamTrade.sends || []).forEach((player) => {
          const parsedTargetIndex = Number(player.receivingTeamIndex);
          const normalizedTargetId = normalizeTeamCodeLike(
            player.receivingTeamId ||
              player.tradeTo ||
              player.toTeamId ||
              player.destTeamId
          );
          const hasIndexRoute = Number.isInteger(parsedTargetIndex);

          let resolvedTarget = normalizedTargetId;
          if (hasIndexRoute) {
            const indexedTarget = payloadTeamCodes[parsedTargetIndex];
            if (indexedTarget) {
              resolvedTarget = indexedTarget;
            }
          }

          if (resolvedTarget) {
            if (resolvedTarget === thisTeamCode) {
              if (player.signAndTrade === true) {
                const satContract = resolveSignAndTradeContractPayload(
                  player,
                  currentEndYear,
                  { allowPlayerContractFallback: false }
                );
                const normalizedSatContract =
                  normalizeContractForWorld({
                    ...(satContract || {}),
                    contractType: 'Sign & Trade',
                    signAndTrade: true,
                    signingDate: timestampISO,
                    signingTeam:
                      payloadTeamCodes[otherIndex] ||
                      normalizeTeamCodeLike(
                        currentState.teams[otherIndex]?.teamCode
                      ),
                  }) || null;

                incomingPlayers.push({
                  ...player,
                  signAndTrade: true,
                  contractType: 'Sign & Trade',
                  contract: normalizedSatContract,
                  signedDate: timestampISO,
                  isNewlySignedFA: true,
                  originTeamId:
                    payloadTeamCodes[otherIndex] ||
                    normalizeTeamCodeLike(currentState.teams[otherIndex]?.teamCode),
                });
              } else {
                incomingPlayers.push(player);
              }
            }
            return;
          }

          // 2-team trade: preserve broadcast fallback for backward compatibility.
          if (activeTeamCount <= 2) {
            incomingPlayers.push(player);
            return;
          }

          // 3+ teams: no broadcast fallback for unrouted players.
          // This should be unreachable due to pre-validation above.
          throw new Error(
            `[TRADE_APPLY_ROUTING_ERROR] 3+ team apply missing destination for player "${player.name || player.player_id || player.id}"`
          );
        });
      }
    });

    const incomingPlayerIds = incomingPlayers.map(
      (p) => p.player_id || p.id || p.playerId
    );

    // Update roster array
    updatedTeam.roster = [
      ...(team.roster || []).filter((id) => !outgoingPlayerIds.includes(id)),
      ...incomingPlayerIds,
    ];

    // Update players array (remove outgoing, add incoming)
    updatedTeam.players = [
      ...(team.players || []).filter((p) => {
        const pid = p.player_id || p.id;
        return !outgoingPlayerIds.includes(pid);
      }),
      ...incomingPlayers.map((p) => ({
        ...p,
        teamCode,
        teamName: team.teamName,
      })),
    ];

    // Sign-and-trade to this team triggers first-apron hard cap metadata.
    const receivesSignAndTrade = incomingPlayers.some(
      (p) => p.signAndTrade === true
    );

    // Signing a cap-hold player via S&T removes that hold from the source team.
    if (
      outgoingSignAndTradeIds.length > 0 &&
      Array.isArray(updatedTeam.capHolds)
    ) {
      updatedTeam.capHolds = updatedTeam.capHolds.filter((hold) => {
        const holdPlayerId = hold.playerId || hold.player_id || hold.id;
        if (holdPlayerId && outgoingSignAndTradeIds.includes(holdPlayerId)) {
          return false;
        }
        const holdName = hold.playerName || hold.name;
        if (holdName && outgoingSignAndTradeNames.includes(holdName)) {
          return false;
        }
        return true;
      });
    }

    // Update draft picks if any
    const outgoingPicks = teamTrade.picksOut || [];
    const incomingPicks = [];
    payload.teams.forEach((otherTeamTrade, otherIndex) => {
      if (otherIndex !== i) {
        incomingPicks.push(...(otherTeamTrade.picksOut || []));
      }
    });

    updatedTeam.draftPicks = [
      ...(team.draftPicks || []).filter(
        (pick) =>
          !outgoingPicks.some(
            (outgoing) =>
              outgoing.year === pick.year &&
              outgoing.round === pick.round &&
              outgoing.owner === pick.owner
          )
      ),
      ...incomingPicks,
    ];

    // Update entitlementIds if any entitlements are traded
    // Phase 17: Removed broadcast fallback for 3+ team trades
    const outgoingEntitlementIds = (
      teamTrade.outgoingEntitlements ||
      teamTrade.entitlementsOut ||
      []
    )
      .map((e) => e.entitlementId || e.id)
      .filter(Boolean);

    const incomingEntitlementIds = [];
    payload.teams.forEach((otherTeamTrade, otherIndex) => {
      if (otherIndex === i) return;

      const otherOut =
        otherTeamTrade.outgoingEntitlements ||
        otherTeamTrade.entitlementsOut ||
        [];

      otherOut.forEach((e) => {
        const entId = e.entitlementId || e.id;
        if (!entId) return;

        const toTeam = normalizeTeamCodeLike(e.toTeamId);

        if (toTeam) {
          if (!payloadTeamCodes.includes(toTeam)) {
            return;
          }
          if (toTeam === thisTeamCode) {
            incomingEntitlementIds.push(entId);
          }
          return;
        }

        // Phase 17: For 3+ team trades, require explicit toTeamId (no broadcast)
        // For 2-team trades, allow broadcast fallback for backward compatibility
        if (activeTeamCount > 2) {
          // 3+ teams: entitlement without toTeamId is an error - skip it
          // (validation should have blocked this, but guard defensively)
          console.warn(
            `[tradeContext] Entitlement "${entId}" has no toTeamId in ${activeTeamCount}-team trade - skipping`
          );
          return;
        }

        // 2-team trade: broadcast to the other team (legacy behavior)
        incomingEntitlementIds.push(entId);
      });
    });

    if (
      outgoingEntitlementIds.length > 0 ||
      incomingEntitlementIds.length > 0
    ) {
      const currentEntitlementIds = team.entitlementIds || [];
      const newEntitlementIds = [
        ...currentEntitlementIds.filter(
          (id) => !outgoingEntitlementIds.includes(id)
        ),
        ...incomingEntitlementIds,
      ];
      updatedTeam.entitlementIds = [...new Set(newEntitlementIds)];
    }

    // Normalize and dedupe TPEs from multiple sources
    const primaryTPEs = (team.tradeExceptions || []).map(normalizeTPE);
    const legacyTPEs = (team.exceptions?.tpe || []).map(normalizeTPE);
    const currentTPEs = dedupeById([...primaryTPEs, ...legacyTPEs]);
    updatedTeam.tradeExceptions = currentTPEs;

    // Update source metadata
    updatedTeam.source = {
      ...updatedTeam.source,
      type: 'world-snapshot',
      lastModifiedAt: timestampISO,
    };

    // Recalculate totals (Phase 72: Using SSOT)
    updatedTeam.totals = computeTeamCapTotals(updatedTeam, toEndYear(seasonId));

    if (receivesSignAndTrade) {
      const existingLevel =
        updatedTeam.totals?.hardCapLevel ||
        (updatedTeam.hardCapped === 2 ? 'secondApron' : null);
      const hardCapLevel =
        existingLevel === 'secondApron' ? 'secondApron' : 'firstApron';

      updatedTeam.hardCapped = hardCapLevel === 'secondApron' ? 2 : 1;
      updatedTeam.hardCapLevel = hardCapLevel;
      updatedTeam.hardCapReason = 'Triggered by receiving sign-and-trade player';
      updatedTeam.hardCapTriggeredBy = 'signAndTrade';
      updatedTeam.totals = {
        ...(updatedTeam.totals || {}),
        isHardCapped: true,
        hardCapLevel,
        hardCapDetail: 'Triggered by receiving sign-and-trade player',
      };
    }

    teamUpdates.push({ teamCode, team: updatedTeam });
  }

  // Phase 17: Post-apply assertion - verify no entitlement appears on multiple teams
  const entitlementOwnership = new Map(); // entitlementId → teamCode
  for (const { teamCode, team } of teamUpdates) {
    const entitlementIds = team.entitlementIds || [];
    for (const entId of entitlementIds) {
      if (entitlementOwnership.has(entId)) {
        const otherTeam = entitlementOwnership.get(entId);
        throw new Error(
          `[tradeContext] INVARIANT VIOLATION: Entitlement "${entId}" would exist on both ${otherTeam} and ${teamCode} after trade. This indicates a routing bug.`
        );
      }
      entitlementOwnership.set(entId, teamCode);
    }
  }

  // Build validation teams from the POST-TRADE state (this is the key Phase 56 requirement)
  const validationTeams = payload.teams.map((teamTrade, idx) => {
    const teamUpdate = teamUpdates[idx];
    return {
      team: teamUpdate.team, // POST-TRADE team state
      teamCode: teamUpdate.teamCode,
      sends: teamTrade.sends || [],
      receives: teamTrade.receives || [],
      picksOut: teamTrade.picksOut || [],
      picksIn: teamTrade.picksIn || [],
      cashSent: teamTrade.cashSent || 0,
      cashReceived: teamTrade.cashReceived || 0,
    };
  });

  return {
    teamUpdates,
    validationTeams,
    payloadTeams: payload.teams,
    _isPostTradeSnapshot: true, // Phase 58 sentinel flag
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
 *
 * @param {Object} params
 * @param {import('./types').PostTradeSnapshot} params.snapshot - Result from buildPostTradeTeamsSnapshot
 * @param {Object} params.payload - Original trade payload (for capProjections, tradeCtx)
 * @param {string} params.seasonId - Season ID (e.g., "2025-26")
 * @returns {import('./types').ValidatedTradeContext} Validated context with:
 *   - legal: boolean - Is the trade legal?
 *   - valid: boolean - Alias for legal
 *   - reason: string - Reason if not legal
 *   - error: string - Error message if not legal
 *   - violations: Array - Validation violations
 *   - warnings: Array - Validation warnings
 *   - teamResults: Array - Per-team validation results (createdTPE, rules.tradeExceptions)
 *   - validationTeams: Array - The validated teams with matchIncoming populated
 *   - _isValidatedTradeContext: true - Sentinel flag for context detection
 */
export function validatePostTradeSnapshotForContext({
  snapshot,
  payload,
  seasonId,
}) {
  // Phase 58: Assert snapshot shape before proceeding
  assertPostTradeSnapshot(snapshot, 'validatePostTradeSnapshotForContext');

  const currentYear = toEndYear(seasonId);

  try {
    const validationInput = {
      teams: snapshot.validationTeams,
      capProjections: payload.capProjections || {},
      currentYear,
      tradeCtx: payload.tradeCtx || {},
    };

    // Run validation exactly once on the POST-TRADE snapshot
    const validation = validateTrade(validationInput);

    return {
      legal: validation.legal,
      valid: validation.legal,
      reason: validation.reason,
      error: validation.legal
        ? null
        : validation.reason || 'Trade is not legal',
      violations:
        validation.teamResults?.flatMap((r) => r.violations || []) || [],
      warnings: validation.warnings || [],
      teamResults: validation.teamResults || [],
      validationTeams: snapshot.validationTeams,
      _rawValidation: validation,
      _isValidatedTradeContext: true,
    };
  } catch (error) {
    return {
      legal: false,
      valid: false,
      reason: error.message || 'Trade validation failed',
      error: error.message || 'Trade validation failed',
      violations: [],
      warnings: [],
      teamResults: [],
      validationTeams: snapshot.validationTeams,
      _isValidatedTradeContext: true,
    };
  }
}

// ==============================================================================
// PHASE 59: LEGACY FUNCTION MOVED
// ==============================================================================
// validateTradeForContext has been moved to tradeContext/legacy/index.js
// Import from '@/features/architect/utils/tradeContext/legacy' for the deprecated wrapper
