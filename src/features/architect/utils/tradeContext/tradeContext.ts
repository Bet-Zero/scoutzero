/**
 * FILE: src/features/architect/utils/tradeContext/tradeContext.ts
 * PURPOSE: Trade snapshot and validation context builders.
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * HISTORY:
 *  - 2026-01-30: Phase 58 - Extracted from mutationPipeline.ts
 *  - 2026-01-30: Phase 59 - Moved validateTradeForContext to legacy/ namespace
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Types: src/features/architect/utils/tradeContext/types.ts
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
 * These were extracted from mutationPipeline.ts to:
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
import { createValidationIssue } from '@/features/architect/utils/tradeMachine/utils/validationIssueText.js';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';
import type {
  AnyRecord,
  BuildPostTradeTeamsSnapshotParams,
  PostTradeSnapshot,
  TeamResult,
  TeamUpdate,
  ValidatePostTradeSnapshotForContextParams,
  ValidatedTradeContext,
  ValidationTeam,
  ValidationIssue,
} from './types';

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
  const teamUpdates: TeamUpdate[] = [];
  const timestampISO = new Date(timestamp).toISOString();

  const normalizeTPE = (t: AnyRecord) => ({
    ...t,
    id:
      t.id ||
      `tpe_legacy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    amount: t.remainingAmount ?? t.totalAmount ?? t.amount ?? 0,
    totalAmount: t.totalAmount ?? t.amount ?? 0,
    remainingAmount: t.remainingAmount ?? t.totalAmount ?? t.amount ?? 0,
    usedAmount: t.usedAmount ?? 0,
  });

  const dedupeById = (tpes: AnyRecord[]) => {
    const seen = new Map<string, AnyRecord>();
    for (const tpe of tpes) {
      if (!tpe.id) continue;
      const tpeId = String(tpe.id);
      const existing = seen.get(tpeId);
      if (!existing) {
        seen.set(tpeId, tpe);
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
          seen.set(tpeId, tpe);
        }
      }
    }
    return Array.from(seen.values());
  };

  const normalizeTeamCodeLike = (x: unknown): string | null => {
    if (!x) return null;
    const s = String(x).trim();
    return s.length === 3 ? s.toUpperCase() : s;
  };

  const payloadTeamCodes = payload.teams
    .map((t) => normalizeTeamCodeLike(t.team?.id || t.teamCode || t.teamId))
    .filter(Boolean) as string[];
  const activeTeamCount = payloadTeamCodes.length;
  const currentEndYear = toEndYear(seasonId) ?? new Date(timestamp).getFullYear();
  const enforceSatPreflight =
    payload?.tradeCtx?.source === 'tradeMachine' ||
    payload?.tradeCtx?.enforceSignAndTradePreflight === true;

  const currentTeamByCode = new Map<string | null, AnyRecord>(
    (currentState.teams || []).map(({ teamCode, team }) => [
      normalizeTeamCodeLike(teamCode),
      team,
    ])
  );

  if (enforceSatPreflight) {
    payload.teams.forEach((teamTrade, senderIndex) => {
      const senderTeamCode = payloadTeamCodes[senderIndex];
      const senderTeamState =
        currentTeamByCode.get(senderTeamCode) ||
        currentState.teams[senderIndex]?.team;
      const senderCapHolds = Array.isArray(senderTeamState?.capHolds)
        ? senderTeamState.capHolds
        : [];

      (teamTrade.sends || []).forEach((player, playerIndex) => {
        if (player.signAndTrade !== true) return;

        const destinationTeamId = normalizeTeamCodeLike(
          player.receivingTeamId ||
            player.tradeTo ||
            player.toTeamId ||
            player.destTeamId
        );
        const playerLabel =
          player.name ||
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

    const updatedTeam: AnyRecord = { ...team };

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

    const incomingPlayers: AnyRecord[] = [];
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
                    normalizeTeamCodeLike(
                      currentState.teams[otherIndex]?.teamCode
                    ),
                });
              } else {
                incomingPlayers.push(player);
              }
            }
            return;
          }

          if (activeTeamCount <= 2) {
            incomingPlayers.push(player);
            return;
          }

          throw new Error(
            `[TRADE_APPLY_ROUTING_ERROR] 3+ team apply missing destination for player "${player.name || player.player_id || player.id}"`
          );
        });
      }
    });

    const incomingPlayerIds = incomingPlayers.map(
      (p) => p.player_id || p.id || p.playerId
    );

    updatedTeam.roster = [
      ...(Array.isArray(team.roster) ? team.roster : []).filter((id: string) => !outgoingPlayerIds.includes(id)),
      ...incomingPlayerIds,
    ];

    updatedTeam.players = [
      ...(Array.isArray(team.players) ? team.players : []).filter((p: AnyRecord) => {
        const pid = p.player_id || p.id;
        return !outgoingPlayerIds.includes(pid);
      }),
      ...incomingPlayers.map((p) => ({
        ...p,
        teamCode,
        teamName: team.teamName,
      })),
    ];

    if (Array.isArray(team.twoWayPlayers)) {
      const merged = [
        ...team.twoWayPlayers.filter((p: AnyRecord) => {
          const pid = p.player_id || p.id;
          return !outgoingPlayerIds.includes(pid);
        }),
        ...incomingPlayers
          .filter((p) => p.isTwoWay === true)
          .map((p) => ({ ...p, teamCode, teamName: team.teamName })),
      ];
      const seen = new Set<string>();
      updatedTeam.twoWayPlayers = merged.filter((p: AnyRecord) => {
        const pid = p.player_id || p.id;
        if (!pid) return true;
        const pidStr = String(pid);
        if (seen.has(pidStr)) return false;
        seen.add(pidStr);
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

    const outgoingPicks = teamTrade.picksOut || [];
    const incomingPicks: AnyRecord[] = [];
    payload.teams.forEach((otherTeamTrade, otherIndex) => {
      if (otherIndex !== i) {
        incomingPicks.push(...(otherTeamTrade.picksOut || []));
      }
    });

    updatedTeam.draftPicks = [
      ...(Array.isArray(team.draftPicks) ? team.draftPicks : []).filter(
        (pick: AnyRecord) =>
          !outgoingPicks.some(
            (outgoing: AnyRecord) =>
              outgoing.year === pick.year &&
              outgoing.round === pick.round &&
              outgoing.owner === pick.owner
          )
      ),
      ...incomingPicks,
    ];

    const outgoingEntitlementIds = (
      teamTrade.outgoingEntitlements ||
      teamTrade.entitlementsOut ||
      []
    )
      .map((e) => e.entitlementId || e.id)
      .filter(Boolean);

    const incomingEntitlementIds: string[] = [];
    payload.teams.forEach((otherTeamTrade, otherIndex) => {
      if (otherIndex === i) return;

      const otherOut =
        otherTeamTrade.outgoingEntitlements ||
        otherTeamTrade.entitlementsOut ||
        [];

      otherOut.forEach((e: AnyRecord) => {
        const entIdRaw = e.entitlementId || e.id;
        if (!entIdRaw) return;
        const entId = String(entIdRaw);

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
      const currentEntitlementIds = Array.isArray(team.entitlementIds) ? team.entitlementIds : [];
      const newEntitlementIds = [
        ...currentEntitlementIds.filter(
          (id: string) => !outgoingEntitlementIds.includes(id)
        ),
        ...incomingEntitlementIds,
      ];
      updatedTeam.entitlementIds = [...new Set(newEntitlementIds)];
    }

    const primaryTPEs = (Array.isArray(team.tradeExceptions) ? team.tradeExceptions : []).map(normalizeTPE);
    const exceptions = team.exceptions as AnyRecord | undefined;
    const legacyTPEs = (Array.isArray(exceptions?.tpe) ? exceptions.tpe : []).map(normalizeTPE);
    const currentTPEs = dedupeById([...primaryTPEs, ...legacyTPEs]);
    updatedTeam.tradeExceptions = currentTPEs;

    updatedTeam.source = {
      ...(updatedTeam.source as AnyRecord),
      type: 'world-snapshot',
      lastModifiedAt: timestampISO,
    };

    updatedTeam.totals = computeTeamCapTotals(updatedTeam, toEndYear(seasonId));

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
    const entitlementIds = Array.isArray(team.entitlementIds) ? team.entitlementIds : [];
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

  const validationTeams: ValidationTeam[] = payload.teams.map((teamTrade, idx) => {
    const teamUpdate = teamUpdates[idx];
    return {
      team: teamUpdate.team,
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
      tradeCtx: {
        ...(payload.tradeCtx || {}),
        ...(payload.asOfDate ? { asOfDate: payload.asOfDate } : {}),
      },
    };

    const validation = validateTrade(validationInput) as AnyRecord;

    const normalizedTeamResults = Array.isArray(validation?.teamResults)
      ? (validation.teamResults as TeamResult[])
      : [];
    const normalizedSummaryByTeamIndex = Array.isArray(
      validation?.summaryByTeamIndex
    )
      ? validation.summaryByTeamIndex
      : [];
    const normalizedViolations = Array.isArray(validation?.violations)
      ? validation.violations
      : [];
    const normalizedWarnings = Array.isArray(validation?.warnings)
      ? validation.warnings
      : [];
    const normalizedTradeReceipt =
      validation &&
      Object.prototype.hasOwnProperty.call(validation, 'tradeReceipt')
        ? validation.tradeReceipt
        : null;
    const normalizedDataWarnings = Array.isArray(validation?.dataWarnings)
      ? validation.dataWarnings
      : [];

    const resolvedYearKey =
      validation &&
      Object.prototype.hasOwnProperty.call(validation, 'yearKey') &&
      validation.yearKey != null
        ? (validation.yearKey as number | string)
        : currentYear;

    return {
      ...validation,
      legal: Boolean(validation.legal),
      valid: Boolean(validation.legal),
      reason: (validation.reason as string | null) ?? null,
      error:
        (validation.error as string | null) ||
        (validation.legal ? null : (validation.reason as string) || 'Trade is not legal'),
      violations: normalizedViolations,
      warnings: normalizedWarnings,
      teamResults: normalizedTeamResults,
      summaryByTeamIndex: normalizedSummaryByTeamIndex,
      tradeReceipt: normalizedTradeReceipt as AnyRecord | null,
      dataWarnings: normalizedDataWarnings,
      hasDataIssues:
        typeof validation?.hasDataIssues === 'boolean'
          ? validation.hasDataIssues
          : normalizedDataWarnings.length > 0,
      yearKey: resolvedYearKey,
      seasonKey:
        validation &&
        Object.prototype.hasOwnProperty.call(validation, 'seasonKey')
          ? (validation.seasonKey as string | null)
          : seasonId,
      capSettings:
        validation &&
        Object.prototype.hasOwnProperty.call(validation, 'capSettings')
          ? (validation.capSettings as AnyRecord | null)
          : null,
      capSettingsSource:
        validation &&
        Object.prototype.hasOwnProperty.call(validation, 'capSettingsSource')
          ? (validation.capSettingsSource as string | null)
          : null,
      capSettingsWarnings: Array.isArray(validation?.capSettingsWarnings)
        ? validation.capSettingsWarnings
        : [],
      asOfDate:
        validation &&
        Object.prototype.hasOwnProperty.call(validation, 'asOfDate')
          ? (validation.asOfDate as string | null)
          : (payload.asOfDate as string | null) || (payload.tradeCtx?.asOfDate as string | null) || null,
      tradeDate:
        validation &&
        Object.prototype.hasOwnProperty.call(validation, 'tradeDate')
          ? (validation.tradeDate as string | null)
          : (payload.tradeCtx?.tradeDate as string | null) ||
            (payload.asOfDate as string | null) ||
            (payload.tradeCtx?.asOfDate as string | null) ||
            null,
      offseason:
        validation &&
        Object.prototype.hasOwnProperty.call(validation, 'offseason')
          ? (validation.offseason as boolean | null)
          : typeof payload.tradeCtx?.offseason === 'boolean'
            ? payload.tradeCtx.offseason as boolean
            : null,
      validationTeams: snapshot.validationTeams,
      _rawValidation: validation,
      _isValidatedTradeContext: true,
    };
  } catch (error: any) {
    const message = error.message || 'Trade validation failed';
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
      valid: false,
      reason: message,
      error: message,
      violations: [failureIssue],
      warnings: [],
      teamResults: [],
      summaryByTeamIndex: [],
      tradeReceipt: null,
      dataWarnings: [],
      hasDataIssues: false,
      yearKey: currentYear,
      seasonKey: seasonId,
      capSettings: null,
      capSettingsSource: null,
      capSettingsWarnings: [],
      asOfDate: (payload.asOfDate as string | null) || (payload.tradeCtx?.asOfDate as string | null) || null,
      tradeDate:
        (payload.tradeCtx?.tradeDate as string | null) ||
        (payload.asOfDate as string | null) ||
        (payload.tradeCtx?.asOfDate as string | null) ||
        null,
      offseason:
        typeof payload.tradeCtx?.offseason === 'boolean'
          ? payload.tradeCtx.offseason as boolean
          : null,
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
