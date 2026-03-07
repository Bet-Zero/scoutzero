// tradeValidator.js - Fixed to match test expectations
import {
  getApronStatus,
  getSalaryForYear,
} from '@/features/architect/utils/tradeHelpers.js';
import { wrapCommonValidators } from './validationUtils.js';
import { createTPE } from '../utils/tradeUtilities.js';

// Import base validators from new structure
import {
  validateSalaryMatching,
  SALARY_MATCHING_VERSION,
} from '../rules/validateSalaryMatching.js';
import { validateHardCap } from '../rules/hardCapValidation.js';
import { validateStepien } from '../rules/validateStepien.js';
import { validateCash } from '../rules/eligibilityRules.js';
import { validateTradeExceptions } from '../rules/validateTradeExceptions.js';
import { validateSignAndTrade } from '../rules/validateSignAndTrade.js';
import { validateConsent } from '../rules/validateConsent.js';
import { validateReacquisition } from '../rules/eligibilityRules.js';
import { enforceConsent } from '../rules/enforceConsent.js';
import { enforceEligibility } from '../rules/validateEligibility.js';
import { enforceTiming } from '../rules/timingValidation.js';
import { enforceSecondApronHandcuffs } from '../rules/basicRules.js';
import { computeMatchingValues } from '../utils/salaryUtils.js';
import { enforceRosterWindow } from '../rules/rosterValidation.js';
import { validationFlags } from '@/config/validationFlags.js';
import { validateFaExceptionUsage } from '../rules/validateFaExceptionUsage.js';
import { validateAggregation } from '../rules/validateAggregation.js';
import { normalizeYearInput, yearToSeason } from '../utils/seasonUtils.js';
import { decorateEntitlementForTrade } from '@/features/architect/utils/entitlements/entitlementTerms';
// TM-EXCL-E1: Entitlement exclusivity validation (blocking)
import { validateEntitlementExclusivity } from '@/features/architect/utils/entitlements/entitlementExclusivityValidator';
import { computePostTradeEntitlements } from '../utils/stepienEntitlementUtils.js';
// TM-EXCL-E2: Explicit entitlement routing map builder (no silent skips)
import { buildEntitlementRoutingMap } from '../utils/buildEntitlementRoutingMap.ts';
// Phase 17: Entitlement routing validation (uniqueness, routing, ownership)
import {
  validateEntitlementRouting,
  validateEntitlementLinkageLegality,
} from '../rules/validateEntitlementRouting.js';
// Phase A5-E1: Player routing validation (uniqueness, routing, destinations)
import { validatePlayerRouting } from '../rules/validatePlayerRouting.js';
// Phase 4: Centralized cap settings provider for explicit sourcing
import {
  getCapSettings,
  CAP_SETTINGS_VERSION,
} from '../utils/capSettingsProvider.js';
import {
  createValidationIssue,
  getFirstValidationIssueText,
  getValidationIssueText,
  normalizeValidationIssues,
  summarizeValidationIssues,
} from '../utils/validationIssueText.js';

/**
 * TRADE VALIDATOR
 * ================
 * Version bumped for Phase 1: Legality Correctness (TRADE_MACHINE_UI_WIRING_AUDIT v2.1.0)
 *
 * DEFINITION GATE COMPLETION (Phase 1.6-1.7)
 * -------------------------------------------
 * DG-1: preTradeTeamSalary includes: Players [x] Dead Money [x] Cap Holds [ ] Likely Incentives [ ]
 * DG-2: postTradeSalary includes: Players [x] Dead Money [x] Cap Holds [ ] Likely Incentives [ ]
 * DG-3: Definitions documented in this header block [x]
 *
 * The following fields are used by the UI for cap impact calculations.
 * Before wiring CapImpactTiles to these values, confirm these definitions are correct.
 *
 * preTradeTeamSalary (aka teamTotalSalary):
 * - Source: team.team.teamTotalSalary (passed in from useTradeMachine hook)
 * - Computed in: useTradeMachine.js via getCapTotalsForYear() → computeTeamCapTotals (SSOT)
 * - INCLUDES:
 *   ☑ Active player contracts (capHit from contract.salariesByYear)
 *   ☑ Dead money (from waivedContracts, stretchHistory, or flat deadMoney map)
 *   ☐ Cap holds (NOT included by default — may cause divergence with CapImpactTiles)
 *   ☐ Likely incentives (NOT explicitly handled)
 *
 * postTradeSalary (aka projectedSalary):
 * - Source: computed in validateTrade() as teamTotalSalary - salaryOut + salaryIn
 * - FORMULA: preTradeTeamSalary - outgoingMatchingSalary + incomingMatchingSalary
 * - INCLUDES: Same components as preTradeTeamSalary, adjusted for trade
 *
 * salaryOut / salaryIn:
 * - Source: computed from player.matchOutgoing / player.matchIncoming
 * - These are MATCHING values (with BYC, poison pill, trade kicker adjustments)
 * - NOT the same as base salary
 *
 * ⚠️ KNOWN GAP: CapImpactTiles.jsx computes capHoldsTotal separately.
 *    If cap holds are significant, CapImpactTiles may show different numbers
 *    than validator's projectedSalary. This must be resolved before Phase 1.6.
 */

// Trade Receipt Validator Version - bumped for Phase 1 UI wiring / Phase 4 cap settings
export const TRADE_VALIDATOR_VERSION = '1.2.0';

function normalizeTeamCodeLike(teamIdLike) {
  if (!teamIdLike) return null;

  if (typeof teamIdLike === 'string') {
    const normalized = teamIdLike.trim();
    if (!normalized) return null;
    return normalized.length === 3 ? normalized.toUpperCase() : normalized;
  }

  if (typeof teamIdLike === 'object') {
    return normalizeTeamCodeLike(
      teamIdLike.teamCode ||
        teamIdLike.id ||
        teamIdLike.teamId ||
        teamIdLike.code ||
        teamIdLike.abbreviation
    );
  }

  return null;
}

function resolveTeamIdentity(teamSlot, index) {
  return (
    normalizeTeamCodeLike(teamSlot?.team?.id) ||
    normalizeTeamCodeLike(teamSlot?.team?.teamId) ||
    normalizeTeamCodeLike(teamSlot?.team?.teamCode) ||
    normalizeTeamCodeLike(teamSlot?.teamId) ||
    normalizeTeamCodeLike(teamSlot?.teamCode) ||
    `team-${index}`
  );
}

function resolvePlayerDestinationTeamId(player) {
  return normalizeTeamCodeLike(
    player?.tradeTo ?? player?.toTeamId ?? player?.destTeamId
  );
}

function normalizeTradeValidationDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : trimmed;
  }

  return null;
}

function getDeterministicValidationDate(currentYear) {
  return `${currentYear - 1}-07-15`;
}

function deriveSeasonStateFromDate(asOfDate) {
  const normalizedDate = normalizeTradeValidationDate(asOfDate);
  if (!normalizedDate) {
    return {
      offseason: true,
      seasonState: 'unknown',
    };
  }

  const parsed = new Date(normalizedDate);
  if (Number.isNaN(parsed.getTime())) {
    return {
      offseason: true,
      seasonState: 'unknown',
    };
  }

  const month = parsed.getUTCMonth();
  const day = parsed.getUTCDate();

  if (month === 6 && day >= 1 && day <= 6) {
    return {
      offseason: false,
      seasonState: 'moratorium',
    };
  }

  if (
    (month === 6 && day >= 7) ||
    month === 7 ||
    month === 8 ||
    (month === 9 && day <= 15)
  ) {
    return {
      offseason: true,
      seasonState: 'offseason',
    };
  }

  return {
    offseason: false,
    seasonState: 'inSeason',
  };
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function normalizeArrayInput(values) {
  if (values == null) return [];
  return Array.isArray(values) ? values.filter((value) => value != null) : [values];
}

function createRuleEnvelope(ruleKey, rawResult, label) {
  if (Array.isArray(rawResult)) {
    const violations = normalizeValidationIssues(rawResult, {
      rule: ruleKey,
      severity: 'error',
    });
    return {
      key: ruleKey,
      sourceType: 'enforcement',
      passed: violations.length === 0,
      violations,
      warnings: [],
      message: getFirstValidationIssueText(violations, `${label} validated`),
      details: null,
    };
  }

  if (!rawResult || typeof rawResult !== 'object') {
    return {
      key: ruleKey,
      sourceType: 'validator',
      passed: true,
      violations: [],
      warnings: [],
      message: `${label} validated`,
      details: null,
    };
  }

  const violations = normalizeValidationIssues(rawResult.violations, {
    rule: ruleKey,
    severity: 'error',
  });
  const warnings = normalizeValidationIssues(rawResult.warnings, {
    rule: ruleKey,
    severity: 'warning',
  });
  const passed = hasOwn(rawResult, 'passed')
    ? rawResult.passed
    : violations.length === 0;
  const details = hasOwn(rawResult, 'details') ? rawResult.details : null;
  const message =
    rawResult.message ||
    getFirstValidationIssueText(violations) ||
    getFirstValidationIssueText(warnings) ||
    `${label} validated`;

  return {
    key: ruleKey,
    sourceType: rawResult.sourceType || 'validator',
    ...rawResult,
    passed,
    violations,
    warnings,
    message,
    details,
  };
}

function buildValidationResult({
  legal,
  reason,
  error = null,
  violations = [],
  warnings = [],
  teamResults = [],
  summaryByTeamIndex = [],
  validationTime,
  tradeReceipt = null,
  dataWarnings = [],
  context = {},
}) {
  const normalizedViolations = normalizeValidationIssues(violations, {
    severity: 'error',
  });
  const normalizedWarnings = normalizeValidationIssues(warnings, {
    severity: 'warning',
  });
  const normalizedDataWarnings = normalizeArrayInput(dataWarnings);
  const normalizedSeason =
    context.normalizedYear?.seasonString || yearToSeason(context.currentYear);

  return {
    legal,
    valid: legal,
    error,
    reason:
      reason ||
      (legal
        ? 'Valid trade'
        : getFirstValidationIssueText(normalizedViolations) ||
          'Trade validation failed'),
    violations: normalizedViolations,
    warnings: normalizedWarnings,
    teamResults,
    summaryByTeamIndex,
    performance: { validationTime },
    tradeReceipt,
    dataWarnings: normalizedDataWarnings,
    hasDataIssues: normalizedDataWarnings.length > 0,
    yearKey: context.currentYear ?? null,
    seasonKey: normalizedSeason ?? null,
    capSettings: context.capSettings || null,
    capSettingsSource: context.capSettingsSource || null,
    capSettingsWarnings: normalizeArrayInput(context.capSettingsWarnings),
    asOfDate: context.asOfDate || null,
    tradeDate: context.tradeDate || null,
    offseason:
      typeof context.offseason === 'boolean' ? context.offseason : null,
  };
}

function shouldRoutePlayerToTeam({
  player,
  receivingTeamId,
  activeTeamCount,
}) {
  const destinationTeamId = resolvePlayerDestinationTeamId(player);

  if (activeTeamCount > 2) {
    return destinationTeamId !== null && destinationTeamId === receivingTeamId;
  }

  return destinationTeamId === null || destinationTeamId === receivingTeamId;
}

// ---------------------------------------------------------------------------
// Roster structural legality
// ---------------------------------------------------------------------------
const MIN_ROSTER = 14;
const MAX_ROSTER = 15;
const MAX_TWO_WAY = 3;

function extractPlayerId(p) {
  if (!p) return null;
  if (typeof p === 'string') return p;
  return p.player_id || p.id || p.playerId || null;
}

/**
 * Compute projected roster counts for a team in validateTrade's per-team loop.
 *
 * Handles two team-data shapes:
 *   1. Pre-trade (UI flow) — players/twoWayPlayers not yet adjusted for the trade.
 *      Projected = current - outgoing + incoming (simple arithmetic).
 *   2. Post-trade (apply-time) — players already moved by buildPostTradeTeamsSnapshot.
 *      Player-ID matching detects the overlap so outgoing/incoming don't double-count.
 *
 * When player IDs are unavailable (common in test fixtures), falls back to
 * simple arithmetic which is correct for the pre-trade shape.
 */
function computeRosterValidation(team) {
  const teamPlayers = team.team?.players || [];
  const teamTwoWay = team.team?.twoWayPlayers || [];
  const outgoing = team.outgoingPlayers || [];
  const incoming = team.incomingPlayers || [];

  // Build a set of current player IDs for overlap detection.
  // If most roster players lack IDs we fall back to simple arithmetic.
  const allRoster = teamPlayers.concat(teamTwoWay);
  const currentIds = new Set(
    allRoster.map(extractPlayerId).filter(Boolean)
  );
  const hasReliableIds = currentIds.size > 0 && currentIds.size >= allRoster.length * 0.5;

  // Determine current standard / two-way counts.
  let currentStandard, currentTwoWay;
  if (teamTwoWay.length > 0) {
    currentStandard = teamPlayers.length;
    currentTwoWay = teamTwoWay.length;
  } else {
    currentStandard = teamPlayers.filter((p) => !p.isTwoWay).length;
    currentTwoWay = teamPlayers.filter((p) => p.isTwoWay).length;
  }

  let projectedStandard, projectedTwoWay;

  if (hasReliableIds) {
    // ID-aware path: only count outgoing still in roster and incoming not yet in roster.
    const outStd = outgoing.filter((p) => {
      const pid = extractPlayerId(p);
      return !p.isTwoWay && pid && currentIds.has(pid);
    }).length;
    const outTw = outgoing.filter((p) => {
      const pid = extractPlayerId(p);
      return p.isTwoWay && pid && currentIds.has(pid);
    }).length;
    const inStd = incoming.filter((p) => {
      const pid = extractPlayerId(p);
      return !p.isTwoWay && (!pid || !currentIds.has(pid));
    }).length;
    const inTw = incoming.filter((p) => {
      const pid = extractPlayerId(p);
      return p.isTwoWay && (!pid || !currentIds.has(pid));
    }).length;

    projectedStandard = currentStandard - outStd + inStd;
    projectedTwoWay = currentTwoWay - outTw + inTw;
  } else {
    // Simple arithmetic path (pre-trade shape or test fixtures without IDs).
    const outStd = outgoing.filter((p) => !p.isTwoWay).length;
    const outTw = outgoing.filter((p) => p.isTwoWay).length;
    const inStd = incoming.filter((p) => !p.isTwoWay).length;
    const inTw = incoming.filter((p) => p.isTwoWay).length;

    projectedStandard = currentStandard - outStd + inStd;
    projectedTwoWay = currentTwoWay - outTw + inTw;
  }

  const violations = [];

  if (projectedStandard < MIN_ROSTER) {
    violations.push(
      `Post-trade standard roster (${projectedStandard}) below minimum ${MIN_ROSTER}`
    );
  }
  if (projectedStandard > MAX_ROSTER) {
    violations.push(
      `Post-trade standard roster (${projectedStandard}) exceeds maximum ${MAX_ROSTER}`
    );
  }
  if (projectedTwoWay > MAX_TWO_WAY) {
    violations.push(
      `Two-way slots exceeded (${projectedTwoWay}/${MAX_TWO_WAY})`
    );
  }

  // Respect enforcement flags — only block when the flag is 'error'
  const hasStandardViolation = violations.some((v) => !v.includes('Two-way'));
  const hasTwoWayViolation = violations.some((v) => v.includes('Two-way'));
  const standardBlocks =
    hasStandardViolation && validationFlags.rosterEnforcement === 'error';
  const twoWayBlocks =
    hasTwoWayViolation && validationFlags.twoWayRoster === 'error';

  const passed = !standardBlocks && !twoWayBlocks;

  return {
    passed,
    violations: passed ? [] : violations,
    message: violations.length === 0
      ? 'Roster size validated'
      : violations.join('; '),
    details: `Standard: ${projectedStandard} (${MIN_ROSTER}–${MAX_ROSTER}), Two-way: ${projectedTwoWay} (max ${MAX_TWO_WAY})`,
    rosterCounts: {
      standard: projectedStandard,
      twoWay: projectedTwoWay,
    },
  };
}

// Create wrapped versions with performance monitoring and caching
const baseValidators = {
  validateSalaryMatching,
  validateHardCap,
  validateStepien,
  validateCash,
  validateFaExceptionUsage,
  validateTradeExceptions,
  validateSignAndTrade,
  validateConsent,
  validateReacquisition,
  validateAggregation,
  enforceConsent,
  enforceEligibility,
  enforceTiming,
  enforceSecondApronHandcuffs,
};
const validators = wrapCommonValidators(baseValidators);

// Export functions for external use
export { enforceRosterWindow, validateFaExceptionUsage };

/**
 * Generates a detailed Trade Receipt object for debugging.
 * This captures the exact numbers used by the validator so mismatches can be diagnosed.
 *
 * @param {Object} params - Parameters for receipt generation
 * @param {Array} params.teamsWithAssets - Teams with computed assets
 * @param {Array} params.teamResults - Validation results per team
 * @param {Object} params.context - Validation context
 * @param {boolean} params.isOverallLegal - Overall trade legality
 * @param {string} params.reason - Overall reason
 * @param {number} params.validationTime - Time taken for validation
 * @returns {Object} Trade receipt object
 */
function generateTradeReceipt({
  teamsWithAssets,
  teamResults,
  context,
  isOverallLegal,
  reason,
  validationTime,
}) {
  const teamReceipts = teamsWithAssets.map((team, index) => {
    const teamResult = teamResults[index];
    const salaryMatchingResult = teamResult?.rules?.salaryMatching || {};
    const salaryMatchingDetails = salaryMatchingResult.details || {};

    // Get the team's name and code
    const teamCode = resolveTeamIdentity(team, index);
    const teamName =
      team.team?.teamName ||
      team.team?.name ||
      team.team?.nickname ||
      `Team ${index}`;

    // Pre-trade team salary with source tracking
    const preTradeTeamSalary = team.teamTotalSalary || 0;
    const preTradeTeamSalarySource =
      salaryMatchingDetails.totalSalarySource || 'team.teamTotalSalary';

    // Build outgoing players list with detailed info
    const outgoingPlayers = (team.outgoingPlayers || team.sends || []).map(
      (player) => {
        const baseSalary = getSalaryForYear(player, context.currentYear) || 0;
        const matchingValue = player.matchOutgoing || baseSalary;
        const isBYC = !!player.isBYC || !!player.baseYearCompensation;

        return {
          id: player.id || player.player_id,
          name: player.name || player.playerName || 'Unknown',
          baseSalary,
          matchingValue,
          flags: {
            isBYC,
            isPoisonPill: !!player.isPoisonPill,
            hasTradeKicker: !!(
              player.tradeKicker?.percentage || player.tradeKickerPct
            ),
            tradeKickerPct:
              player.tradeKicker?.percentage || player.tradeKickerPct || 0,
            isSignAndTrade: !!player.signAndTrade,
          },
          // BYC breakdown: include previous salary and calculation details
          bycDetails: isBYC
            ? {
                previousSalary: player.previousSalary || 0,
                fiftyPercentNew: Math.floor(baseSalary * 0.5),
                method:
                  (player.previousSalary || 0) >= Math.floor(baseSalary * 0.5)
                    ? 'previousSalary'
                    : '50%_of_new',
              }
            : null,
        };
      }
    );

    // Build incoming players list with detailed info
    const incomingPlayers = (team.incomingPlayers || []).map((player) => {
      const baseSalary = getSalaryForYear(player, context.currentYear) || 0;
      const matchingValue = player.matchIncoming || baseSalary;
      const isPoisonPill = !!player.isPoisonPill;
      const hasTradeKicker = !!(
        player.tradeKicker?.percentage || player.tradeKickerPct
      );

      return {
        id: player.id || player.player_id,
        name: player.name || player.playerName || 'Unknown',
        baseSalary,
        matchingValue,
        flags: {
          isBYC: !!player.isBYC,
          isPoisonPill,
          hasTradeKicker,
          tradeKickerPct:
            player.tradeKicker?.percentage || player.tradeKickerPct || 0,
          isSignAndTrade: !!player.signAndTrade,
        },
        // Poison pill breakdown: include extension years and averaging calculation
        poisonPillDetails:
          isPoisonPill && player.extensionYears?.length > 0
            ? {
                currentSalary: player.currentSalary || baseSalary,
                extensionYears: player.extensionYears,
                averagedSalary: matchingValue,
                method: 'averaging_current_plus_extensions',
              }
            : null,
        // Trade kicker breakdown: include kicker calculation
        tradeKickerDetails: hasTradeKicker
          ? {
              percentage:
                player.tradeKicker?.percentage || player.tradeKickerPct || 0,
              kickerAmount: matchingValue - baseSalary,
              waivedPct:
                player.tradeKicker?.waived || player.tradeKickerWaivedPct || 0,
              maximum: player.tradeKicker?.maximum,
            }
          : null,
      };
    });

    // Phase 11.3: Build outgoing entitlements list for receipt
    const outgoingEntitlements = (
      team.outgoingEntitlements ||
      team.entitlementsOut ||
      []
    ).map((ent) => {
      const decorated = decorateEntitlementForTrade(ent) || ent;
      return {
        id: decorated.entitlementId || decorated.id,
        seasonYear: decorated.seasonYear,
        round: decorated.round,
        kind: decorated.kind,
        description: decorated.description,
        toTeamId: decorated.toTeamId || null, // Phase 11.3.1: Include routing target for debug clarity
        draftKey: decorated.draftKey,
        terms: decorated.terms,
        termsShort: decorated.termsShort,
      };
    });

    // Phase 11.3: Build incoming entitlements list (from other teams' outgoing)
    // Phase 11.3.1: Respect toTeamId routing when present
    const incomingEntitlements = [];
    const thisTeamKey = resolveTeamIdentity(team, index);
    const thisTeamCode = normalizeTeamCodeLike(team.teamCode || team.team?.teamCode);

    teamsWithAssets.forEach((otherTeam, otherIndex) => {
      if (otherIndex !== index) {
        (
          otherTeam.outgoingEntitlements ||
          otherTeam.entitlementsOut ||
          []
        ).forEach((ent) => {
          const decorated = decorateEntitlementForTrade(ent) || ent;
          // Phase 11.3.1: Check toTeamId routing
          const routedTo = normalizeTeamCodeLike(decorated.toTeamId);

          // Include entitlement if:
          // 1. No routing specified (broadcast mode - backward compatible)
          // 2. OR toTeamId matches this team's key or code
          const shouldInclude =
            !routedTo || routedTo === thisTeamKey || routedTo === thisTeamCode;

          if (shouldInclude) {
            incomingEntitlements.push({
              id: decorated.entitlementId || decorated.id,
              seasonYear: decorated.seasonYear,
              round: decorated.round,
              kind: decorated.kind,
              description: decorated.description,
              fromTeam: resolveTeamIdentity(otherTeam, otherIndex),
              toTeamId: decorated.toTeamId || null, // Phase 11.3.1: Include for debug clarity
              draftKey: decorated.draftKey,
              terms: decorated.terms,
              termsShort: decorated.termsShort,
            });
          }
        });
      }
    });

    // Calculate totals
    const outgoingBaseTotal = outgoingPlayers.reduce(
      (sum, p) => sum + p.baseSalary,
      0
    );
    const outgoingMatchingTotal = outgoingPlayers.reduce(
      (sum, p) => sum + p.matchingValue,
      0
    );
    const incomingBaseTotal = incomingPlayers.reduce(
      (sum, p) => sum + p.baseSalary,
      0
    );
    const incomingMatchingTotal = incomingPlayers.reduce(
      (sum, p) => sum + p.matchingValue,
      0
    );

    // Salary matching evaluation details
    // IMPORTANT: When salary matching is skipped (e.g., HARD_CAP_SKIP, TPE_ABSORPTION, FA_EXCEPTION),
    // preserve null semantics so UI shows "—" instead of misleading 0 values
    const isSkipped = salaryMatchingResult.skipReason != null;
    const salaryMatchingEvaluation = {
      // When skipped, ruleApplied should be null (not "HARD_CAP_SKIP" - that's the skipReason)
      ruleApplied: isSkipped ? null : salaryMatchingDetails.ruleApplied || null,
      skipReason: salaryMatchingResult.skipReason ?? null,
      formulaUsed: salaryMatchingDetails.formulaUsed ?? null,
      // When skipped, allowableIncoming should be null (not 0)
      allowableIncoming: isSkipped
        ? null
        : (salaryMatchingResult.allowableIncoming ?? null),
      actualIncoming: salaryMatchingResult.salaryIn ?? team.salaryIn ?? null,
      // When skipped, passed should be null (validation didn't run)
      passed: isSkipped ? null : (salaryMatchingResult.passed ?? null),
      // When skipped, margin should be null
      margin: isSkipped ? null : (salaryMatchingDetails.margin ?? null),
      // Reference global cap settings even on skip (for transparency)
      capSettings: context.capSettings,
      capSettingsSource: isSkipped
        ? salaryMatchingDetails.capSettingsSource || 'N/A (skipped)'
        : salaryMatchingDetails.capSettingsSource ||
          context.capSettingsSource ||
          'unknown',
    };

    return {
      teamCode,
      teamName,
      preTradeTeamSalary,
      preTradeTeamSalarySource,
      outgoingPlayers,
      incomingPlayers,
      // Phase 11.3: Include entitlements in trade receipt
      outgoingEntitlements,
      incomingEntitlements,
      totals: {
        outgoingBaseTotal,
        outgoingMatchingTotal,
        incomingBaseTotal,
        incomingMatchingTotal,
      },
      salaryMatchingEvaluation,
      violations: teamResult?.violations || [],
      warnings: teamResult?.warnings || [],
    };
  });

  // Build overall receipt
  // Phase 4: Include cap settings used and source for transparency
  // Use the source and warnings that were resolved at the start of validation
  const capSettingsUsed = {
    salaryCap: context.capSettings?.salaryCap || 0,
    firstApron: context.capSettings?.firstApron || 0,
    secondApron: context.capSettings?.secondApron || 0,
    luxuryTax: context.capSettings?.luxuryTax || 0,
  };

  return {
    isLegal: isOverallLegal,
    primaryViolation: !isOverallLegal ? reason : null,
    allViolations: teamResults.flatMap((tr) => tr.violations || []),
    timestamp: new Date().toISOString(),
    validatorVersion: TRADE_VALIDATOR_VERSION,
    salaryMatchingVersion: SALARY_MATCHING_VERSION,
    capSettingsVersion: CAP_SETTINGS_VERSION,
    yearKey: context.currentYear,
    seasonKey:
      context.normalizedYear?.seasonString ||
      `${context.currentYear - 1}-${String(context.currentYear).slice(-2)}`,
    // Phase 4: Cap settings transparency - use source from initial resolution
    capSettingsUsed,
    capSettingsSource: context.capSettingsSource || 'unknown',
    capSettingsWarnings: context.capSettingsWarnings || [],
    teams: teamReceipts,
    performance: {
      validationTimeMs: validationTime,
    },
  };
}

/**
 * Main trade validation entry point
 */
// Special case handling for test files
// Instead of using the regular validation result in certain test cases,
// we'll force-pass specific cases to match the test expectations
export function validateTrade({
  teams,
  capProjections,
  currentYear,
  tradeCtx = {},
}) {
  const startTime = performance.now();
  const rawTradeCtx = tradeCtx && typeof tradeCtx === 'object' ? tradeCtx : {};
  const resolvedYearInput =
    currentYear ?? rawTradeCtx.currentYear ?? rawTradeCtx.yearKey ?? 2025;
  const normalizedYear = normalizeYearInput(resolvedYearInput);
  const resolvedCurrentYear = normalizedYear?.endYear || 2025;
  const canonicalAsOfDate =
    normalizeTradeValidationDate(
      rawTradeCtx.asOfDate || rawTradeCtx.tradeDate
    ) || getDeterministicValidationDate(resolvedCurrentYear);
  const canonicalTradeDate =
    normalizeTradeValidationDate(rawTradeCtx.tradeDate) || canonicalAsOfDate;
  const seasonState = deriveSeasonStateFromDate(canonicalAsOfDate);
  const canonicalOffseason =
    typeof rawTradeCtx.offseason === 'boolean'
      ? rawTradeCtx.offseason
      : seasonState.offseason;

  const capSettingsResult = getCapSettings({
    year: resolvedCurrentYear,
    capProjections,
  });
  const capSettings = capSettingsResult.settings;

  // Log warning to console if fallback was used (in development mode)
  if (
    capSettingsResult.warnings.length > 0 &&
    (process.env.NODE_ENV === 'development' || import.meta?.env?.DEV)
  ) {
    console.warn(
      '[validateTrade] Cap settings warnings:',
      capSettingsResult.warnings
    );
  }

  const baseContext = {
    capProjections: capProjections || {},
    ...rawTradeCtx,
    currentYear: resolvedCurrentYear,
    yearKey: resolvedCurrentYear,
    asOfDate: canonicalAsOfDate,
    tradeDate: canonicalTradeDate,
    offseason: canonicalOffseason,
    seasonState: rawTradeCtx.seasonState || seasonState.seasonState,
    capSettings,
    capSettingsSource: capSettingsResult.source,
    capSettingsWarnings: capSettingsResult.warnings,
    normalizedYear: normalizedYear || {
      endYear: resolvedCurrentYear,
      seasonString: yearToSeason(resolvedCurrentYear),
    },
    teams: [],
  };

  const finishValidation = ({
    legal,
    reason,
    error = null,
    violations = [],
    warnings = [],
    teamResults = [],
    summaryByTeamIndex = [],
    tradeReceipt = null,
    dataWarnings = [],
    context = baseContext,
  }) =>
    buildValidationResult({
      legal,
      reason,
      error,
      violations,
      warnings,
      teamResults,
      summaryByTeamIndex,
      validationTime: performance.now() - startTime,
      tradeReceipt,
      dataWarnings,
      context,
    });

  // Input validation
  if (!teams || !Array.isArray(teams) || teams.length < 2) {
    return finishValidation({
      legal: false,
      error: 'INVALID_INPUT',
      violations: normalizeValidationIssues(
        [
          createValidationIssue(
            'Trade must include at least 2 teams',
            {
              rule: 'inputValidation',
              severity: 'error',
            }
          ),
        ],
        { rule: 'inputValidation', severity: 'error' }
      ),
      reason: 'Invalid trade: Need at least 2 teams',
    });
  }

  // Filter to only teams that actually have team data
  const validTeams = teams.filter((team) => team && team.team);
  if (validTeams.length < 2) {
    return finishValidation({
      legal: false,
      error: 'INVALID_INPUT',
      violations: normalizeValidationIssues(
        [
          createValidationIssue(
            'Trade must include at least 2 valid teams',
            {
              rule: 'inputValidation',
              severity: 'error',
            }
          ),
        ],
        { rule: 'inputValidation', severity: 'error' }
      ),
      reason: 'Invalid trade: Need at least 2 valid teams',
    });
  }

  const context = {
    ...baseContext,
    teams: validTeams, // Add teams to context for consent validation
  };

  const teamIdsByIndex = validTeams.map((teamSlot, index) =>
    resolveTeamIdentity(teamSlot, index)
  );
  const activeTeamCount = validTeams.length;

  // Calculate incoming/outgoing assets for each team
  // First pass: populate team data structure without salary calculations
  const teamsWithAssets = validTeams.map((team, index) => {
    const receivingTeamId = teamIdsByIndex[index];

    // Populate incoming players (what this team is receiving from other teams)
    // 2-team trades keep broadcast fallback for compatibility.
    // 3+ team trades require explicit destination routing.
    const incomingPlayers = [];
    validTeams.forEach((otherTeam, otherIndex) => {
      if (otherIndex === index) return;

      const fromTeamId = teamIdsByIndex[otherIndex];
      (otherTeam.sends || []).forEach((player) => {
        if (
          !shouldRoutePlayerToTeam({
            player,
            receivingTeamId,
            activeTeamCount,
          })
        ) {
          return;
        }

        incomingPlayers.push({
          ...player,
          fromTeamId: player.fromTeamId || fromTeamId,
        });
      });
    });

    // Populate outgoing players (what this team is sending out)
    const outgoingPlayers = team.sends || [];

    // Calculate projected salary after trade (will be updated after matching values computed)
    const currentSalary =
      team.team.teamTotalSalary || team.team.totalSalary || 0;

    return {
      ...team,
      teamId: teamIdsByIndex[index],
      salaryOut: 0, // Will be computed from matchOutgoing values
      salaryIn: 0, // Will be computed from matchIncoming values
      projectedSalary: currentSalary, // Will be updated after salary calculations
      teamTotalSalary: currentSalary,
      incomingPlayers,
      outgoingPlayers,
      cashSent: team.cashSent || 0,
      cashReceived: team.cashReceived || 0,
      context: {
        ...context,
        // Phase 4: Use the already-resolved capSettings from context
        // This ensures all teams use the same cap settings
        capSettings: context.capSettings,
        capSettingsSource: context.capSettingsSource,
        yearKey: resolvedCurrentYear,
      },
    };
  });

  // Compute matching values for all teams FIRST
  // This ensures matchIncoming/matchOutgoing are set correctly using the canonical
  // implementation (BYC, poison pill, trade kicker) before any salary calculations
  // GAP-DATA-001/002: Now also captures data validation warnings
  const matchingValuesResult = computeMatchingValues({
    teams: teamsWithAssets,
    yearKey: resolvedCurrentYear,
    daysRemainingInSeason: context.daysRemainingInSeason,
    daysInSeason: context.daysInSeason,
  });

  // Extract data warnings from matching values computation (GAP-DATA-001, GAP-DATA-002)
  const dataWarnings = matchingValuesResult?.dataWarnings || [];

  // Phase 17: Validate entitlement routing (uniqueness, destination, ownership)
  // This is a cross-team validation that must happen before per-team validation
  const entitlementRoutingResult = validateEntitlementRouting({
    teams: validTeams,
  });

  // If entitlement routing validation fails, return early with blocking error
  if (!entitlementRoutingResult.valid) {
    return finishValidation({
      legal: false,
      error: 'ENTITLEMENT_ROUTING_ERROR',
      violations: normalizeValidationIssues(entitlementRoutingResult.errors, {
        rule: 'entitlementRouting',
        severity: 'error',
      }),
      warnings: normalizeValidationIssues(entitlementRoutingResult.warnings, {
        rule: 'entitlementRouting',
        severity: 'warning',
      }),
      reason: entitlementRoutingResult.errors[0] || 'Entitlement routing error',
      dataWarnings,
      context,
    });
  }

  // E2: Linked/residual integrity and linked package completeness are blocking legality.
  const entitlementLinkageResult = validateEntitlementLinkageLegality({
    teams: validTeams,
  });

  if (!entitlementLinkageResult.valid) {
    return finishValidation({
      legal: false,
      error: 'ENTITLEMENT_LINKAGE_ERROR',
      violations: normalizeValidationIssues(entitlementLinkageResult.errors, {
        rule: 'entitlementLinkage',
        severity: 'error',
      }),
      warnings: normalizeValidationIssues(entitlementLinkageResult.warnings, {
        rule: 'entitlementLinkage',
        severity: 'warning',
      }),
      reason:
        entitlementLinkageResult.errors[0] ||
        'Entitlement linkage validation error',
      dataWarnings,
      context,
    });
  }

  // Phase A5-E1: Validate player routing (uniqueness, no duplicates, destinations)
  // This is a cross-team validation that must happen before per-team validation
  const playerRoutingResult = validatePlayerRouting({
    teams: validTeams,
  });

  // If player routing validation fails, return early with blocking error
  if (!playerRoutingResult.valid) {
    return finishValidation({
      legal: false,
      error: 'PLAYER_ROUTING_ERROR',
      violations: normalizeValidationIssues(playerRoutingResult.errors, {
        rule: 'playerRouting',
        severity: 'error',
      }),
      warnings: normalizeValidationIssues(playerRoutingResult.warnings, {
        rule: 'playerRouting',
        severity: 'warning',
      }),
      reason: playerRoutingResult.errors[0] || 'Player routing error',
      dataWarnings,
      context,
    });
  }

  const crossTradeWarnings = [
    ...normalizeValidationIssues(entitlementRoutingResult.warnings, {
      rule: 'entitlementRouting',
      severity: 'warning',
    }),
    ...normalizeValidationIssues(entitlementLinkageResult.warnings, {
      rule: 'entitlementLinkage',
      severity: 'warning',
    }),
    ...normalizeValidationIssues(playerRoutingResult.warnings, {
      rule: 'playerRouting',
      severity: 'warning',
    }),
  ];

  // Second pass: calculate salaryOut and salaryIn using the canonical matching values
  teamsWithAssets.forEach((team, index) => {
    const receivingTeamId = teamIdsByIndex[index];

    // Calculate outgoing salary using canonical matchOutgoing values
    const salaryOut = (team.sends || []).reduce((sum, player) => {
      // Use matchOutgoing (set by computeMatchingValues) or fallback to base salary
      const matchingValue =
        player.matchOutgoing ??
        getSalaryForYear(player, resolvedCurrentYear) ??
        0;
      return sum + matchingValue;
    }, 0);

    // Calculate incoming salary from other teams using canonical matchIncoming values
    let salaryIn = 0;
    teamsWithAssets.forEach((otherTeam, otherIndex) => {
      if (otherIndex === index) return;

      (otherTeam.sends || []).forEach((player) => {
        if (
          !shouldRoutePlayerToTeam({
            player,
            receivingTeamId,
            activeTeamCount,
          })
        ) {
          return;
        }

        const matchingValue =
          player.matchIncoming ??
          getSalaryForYear(player, resolvedCurrentYear) ??
          0;
        salaryIn += matchingValue;
      });
    });

    // Update team with computed salaries
    team.salaryOut = salaryOut;
    team.salaryIn = salaryIn;
    team.projectedSalary = team.teamTotalSalary - salaryOut + salaryIn;
  });

  // Run validation rules for each team
  const teamResults = teamsWithAssets.map((team, index) => {
    const teamId =
      team.teamId ||
      team.team?.teamId ||
      team.team?.id ||
      resolveTeamIdentity(team, index);
    const teamName =
      team.team?.teamName ||
      team.team?.name ||
      team.team?.nickname ||
      `Team ${index}`;

    // DEV: Definition Gate salary breakdown verification (Phase 1.6-1.7 prep)
    // This log helps verify what preTradeTeamSalary and postTradeSalary actually include
    // ONLY log first team to avoid console spam
    if (import.meta.env.DEV && index === 0) {
      console.log('[Definition Gate] Team salary breakdown', {
        team: teamName,
        preTradeTeamSalary: team.teamTotalSalary,
        salaryOut: team.salaryOut,
        salaryIn: team.salaryIn,
        postTradeSalary: team.projectedSalary,
        // Note: capHolds are NOT included in teamTotalSalary by default
        // CapImpactTiles may show different numbers if it adds cap holds separately
        formula: `${team.teamTotalSalary} - ${team.salaryOut} + ${team.salaryIn} = ${team.projectedSalary}`,
      });
    }

    const teamForValidation = {
      ...team,
      notes: Array.isArray(team.notes) ? [...team.notes] : team.notes,
      team:
        team.team && typeof team.team === 'object'
          ? {
              ...team.team,
              faExceptionBuckets: Array.isArray(team.team.faExceptionBuckets)
                ? team.team.faExceptionBuckets.map((bucket) => ({ ...bucket }))
                : team.team.faExceptionBuckets,
              hardCapFirstApron: team.team.hardCapFirstApron
                ? { ...team.team.hardCapFirstApron }
                : team.team.hardCapFirstApron,
            }
          : team.team,
    };

    const faExceptionUsageViolations = validators.validateFaExceptionUsage(
      teamForValidation,
      context
    );
    const faExceptionUsageResult = Array.isArray(
      faExceptionUsageViolations
    )
      ? {
          passed: faExceptionUsageViolations.length === 0,
          violations: faExceptionUsageViolations,
          message:
            faExceptionUsageViolations[0] ||
            'FA exception trade absorption validated',
        }
      : faExceptionUsageViolations;
    teamForValidation.faExceptionValidation = faExceptionUsageResult;

    // Run individual validation rules
    const salaryMatchingResult = validators.validateSalaryMatching(
      teamForValidation,
      context
    );
    const hardCapResult = validators.validateHardCap(teamForValidation, context);
    const stepienResult = validators.validateStepien(teamForValidation, context);
    const cashResult = validators.validateCash(teamForValidation, context);
    const tradeExceptionsResult = validators.validateTradeExceptions(
      teamForValidation,
      context
    );
    // Sign-and-trade owns all S&T-specific season/timing restrictions.
    const signAndTradeResult = validators.validateSignAndTrade(
      teamForValidation,
      context
    );
    const consentResult = validators.validateConsent(teamForValidation, context);
    const reacquisitionResult = validators.validateReacquisition(
      teamForValidation,
      context
    );
    const aggregationResult = validators.validateAggregation(
      teamForValidation,
      context
    );

    // Enforcement rules
    const consentEnforcement = validators.enforceConsent(
      teamForValidation,
      context
    );
    const eligibilityEnforcement = validators.enforceEligibility(
      teamForValidation,
      context
    );
    // Generic trade timing gates remain here; S&T-specific timing no longer lives in timingEnforcement.
    const timingEnforcement = validators.enforceTiming(
      teamForValidation,
      context
    );
    const secondApronEnforcement = validators.enforceSecondApronHandcuffs(
      teamForValidation,
      context
    );

    // Roster structural legality (min/max standard roster, two-way max)
    const rosterCountResult = computeRosterValidation(team);

    // TM-EXCL-E1 + TM-EXCL-E2: Entitlement exclusivity — block trades that create overlapping claims
    // TM-EXCL-E2: Build explicit routing map FIRST; if routing is incomplete, fail immediately.
    const entitlementExclusivityResult = (() => {
      try {
        // TM-EXCL-E2: Build routing map for all participants
        const routingResult = buildEntitlementRoutingMap(teamsWithAssets);

        if (!routingResult.ok) {
          // Routing incomplete — block trade with clear reason
          return {
            passed: false,
            details: routingResult.reason,
            violations: routingResult.errors,
          };
        }

        // Build allTeamsEntOut with resolved routing from the map
        const tradeParticipantIds = new Set(
          teamsWithAssets
            .map((t, participantIndex) =>
              resolveTeamIdentity(t, participantIndex)
            )
            .filter(Boolean)
        );

        const allTeamsEntOut = teamsWithAssets.map((t, participantIndex) => {
          const tId = resolveTeamIdentity(t, participantIndex);
          return (t.entitlementsOut || []).map((e) => {
            const entId = e.entitlementId || e.id;
            const routingKey = `${tId}::${entId}`;
            const resolvedToTeamId =
              routingResult.map.get(routingKey) || e.toTeamId || null;

            // TM-EXCL-E2: For 2-team trades, auto-resolve missing toTeamId
            const autoResolvedToTeamId =
              teamsWithAssets.length === 2
                ? teamsWithAssets
                    .map((otherTeam, otherIndex) =>
                      resolveTeamIdentity(otherTeam, otherIndex)
                    )
                    .find((otherTeamId) => otherTeamId !== tId)
                : undefined;
            const finalToTeamId =
              resolvedToTeamId || autoResolvedToTeamId;

            return {
              ...e,
              fromTeamId: tId,
              toTeamId: finalToTeamId,
            };
          });
        });

        // TM-EXCL-E2: Use strict computePostTradeEntitlements with tradeParticipantIds
        const postTradeSet = computePostTradeEntitlements({
          currentEntitlements: team.validationEntitlements || [],
          entitlementsOut: team.entitlementsOut || [],
          allTeamsEntitlementsOut: allTeamsEntOut,
          teamId,
          tradeParticipantIds,
        });

        const exclusivityResult = validateEntitlementExclusivity({
          entitlements: postTradeSet,
        });

        if (exclusivityResult.valid) {
          return { passed: true, details: 'No exclusivity conflicts' };
        }

        const messages = exclusivityResult.violations.map((v) => v.message);
        return {
          passed: false,
          details: messages.join('; '),
          violations: exclusivityResult.violations,
        };
      } catch (err) {
        // Integrity-first (TM-EXCL-E1.1 + E2): if routing or post-trade computation fails, BLOCK the trade.
        // Rationale: cannot verify exclusivity = cannot proceed.
        if (import.meta.env.DEV) {
          console.warn(
            '[entitlement-exclusivity] trade validation error, blocking trade:',
            err
          );
        }
        return {
          passed: false,
          details:
            err.message && err.message.startsWith('Pick Exclusivity:')
              ? err.message
              : 'Pick Exclusivity: Error computing post-trade entitlement set',
          violations: [
            err.message && err.message.startsWith('Pick Exclusivity:')
              ? err.message
              : 'Exclusivity validation unavailable — cannot verify trade legality',
          ],
        };
      }
    })();

    const allRules = {
      salaryMatching: createRuleEnvelope(
        'salaryMatching',
        salaryMatchingResult,
        'Salary Matching'
      ),
      hardCap: createRuleEnvelope('hardCap', hardCapResult, 'Hard Cap'),
      stepienRule: createRuleEnvelope(
        'stepienRule',
        stepienResult,
        'Stepien Rule'
      ),
      cash: createRuleEnvelope('cash', cashResult, 'Cash Inclusion'),
      faExceptionUsage: createRuleEnvelope(
        'faExceptionUsage',
        faExceptionUsageResult,
        'FA Exception Usage'
      ),
      tradeExceptions: createRuleEnvelope(
        'tradeExceptions',
        tradeExceptionsResult,
        'Trade Exceptions'
      ),
      signAndTrade: createRuleEnvelope(
        'signAndTrade',
        signAndTradeResult,
        'Sign-and-Trade'
      ),
      consent: createRuleEnvelope('consent', consentResult, 'Player Consent'),
      reacquisition: createRuleEnvelope(
        'reacquisition',
        reacquisitionResult,
        'Reacquisition'
      ),
      aggregation: createRuleEnvelope(
        'aggregation',
        aggregationResult,
        'Aggregation'
      ),
      consentEnforcement: createRuleEnvelope(
        'consentEnforcement',
        consentEnforcement,
        'Consent Enforcement'
      ),
      eligibilityEnforcement: createRuleEnvelope(
        'eligibilityEnforcement',
        eligibilityEnforcement,
        'Eligibility Enforcement'
      ),
      timingEnforcement: createRuleEnvelope(
        'timingEnforcement',
        timingEnforcement,
        'Timing Restrictions'
      ),
      secondApronEnforcement: createRuleEnvelope(
        'secondApronEnforcement',
        secondApronEnforcement,
        'Second Apron Restrictions'
      ),
      entitlementExclusivity: createRuleEnvelope(
        'entitlementExclusivity',
        entitlementExclusivityResult,
        'Pick Exclusivity'
      ),
      rosterCount: createRuleEnvelope(
        'rosterCount',
        rosterCountResult,
        'Roster Count'
      ),
    };

    const violations = Object.values(allRules).flatMap(
      (rule) => rule?.violations || []
    );
    const warnings = Object.values(allRules).flatMap(
      (rule) => rule?.warnings || []
    );

    const isTeamLegal = violations.length === 0;

    // Extract salary matching calculations for UI display
    const salaryMatchingCalcs = salaryMatchingResult || {};
    const calculations = {
      salaryIn: team.salaryIn || 0,
      salaryOut: team.salaryOut || 0,
      salaryMatching: {
        allowedIncoming: salaryMatchingCalcs.allowableIncoming || 0,
        margin:
          (salaryMatchingCalcs.allowableIncoming || 0) - (team.salaryOut || 0),
        difference: (team.salaryIn || 0) - (team.salaryOut || 0),
      },
    };

    const totalSalary =
      team.team?.teamTotalSalary || team.team?.totalSalary || 0;
    const projectedSalary = team.projectedSalary || 0;
    const apronStatus = getApronStatus(projectedSalary, context.capSettings);

    return {
      teamId,
      teamCode: teamId,
      teamName,
      legal: isTeamLegal,
      violations,
      warnings,
      rules: allRules,
      salaryOut: team.salaryOut || 0,
      salaryIn: team.salaryIn || 0,
      outgoingPlayers: team.outgoingPlayers || [],
      incomingPlayers: team.incomingPlayers || [],
      calculations,
      totalSalary,
      projectedSalary,
      capRoom: Math.max(
        0,
        (context.capSettings?.salaryCap || 141000000) - projectedSalary
      ),
      hardCapped: Boolean(
        teamForValidation.team?.hardCapped ||
          teamForValidation.team?.hardCapFirstApron?.active ||
          signAndTradeResult?.hardCapped ||
          hardCapResult?.hardCapStatus?.isHardCapped
      ),
      apronStatus,
      faExceptionBuckets: teamForValidation.team?.faExceptionBuckets || [],
      notes: Array.isArray(teamForValidation.notes) ? teamForValidation.notes : [],
      createdTPE: (() => {
        // TPE is created when team sends out more salary than received and is over cap
        const salaryOut = team.salaryOut || 0;
        const salaryIn = team.salaryIn || 0;
        const teamTotalSalary = team.teamTotalSalary || 0;
        const salaryCap =
          context.capProjections?.salaryCap ||
          context.capSettings?.salaryCap ||
          141000000;
        const isOverCap = teamTotalSalary > salaryCap;

        return createTPE({
          teamCtx: { isOverCap },
          outgoing: salaryOut,
          incoming: salaryIn,
          tradeDate: context.tradeDate,
        });
      })(),
      details: isTeamLegal
        ? 'Valid trade for this team'
        : summarizeValidationIssues(violations, 'Trade validation failed'),
      warningDetails: summarizeValidationIssues(warnings),
    };
  });

  // Calculate summary by team index
  const summaryByTeamIndex = teamsWithAssets.map((team, index) => {
    const playersOut = (team.sends || [])
      .map((p) => p.name || 'Unknown Player')
      .join(', ');
    const playersIn = (team.incomingPlayers || []).map(
      (p) => p.name || 'Unknown Player'
    );

    const capDelta = (team.salaryIn || 0) - (team.salaryOut || 0);

    return {
      playersOut,
      playersIn,
      capDelta,
      teamId: resolveTeamIdentity(team, index),
      teamCode: resolveTeamIdentity(team, index),
      legal: teamResults[index]?.legal ?? true,
      violations: teamResults[index]?.violations || [],
      warnings: teamResults[index]?.warnings || [],
      teamName: team.team?.teamName || team.team?.name || `Team ${index}`,
    };
  });

  // Determine overall trade legality
  const isOverallLegal = teamResults.every((result) => result.legal);
  const topLevelViolations = teamResults.flatMap(
    (result) => result.violations || []
  );
  const topLevelWarnings = [
    ...crossTradeWarnings,
    ...teamResults.flatMap((result) => result.warnings || []),
  ];
  const reason = isOverallLegal
    ? 'Valid trade'
    : getFirstValidationIssueText(topLevelViolations, 'Trade validation failed');

  const validationTime = performance.now() - startTime;

  // Generate trade receipt for debugging (captures exact values used)
  const tradeReceipt = generateTradeReceipt({
    teamsWithAssets,
    teamResults,
    context,
    isOverallLegal,
    reason,
    validationTime,
  });

  const result = finishValidation({
    legal: isOverallLegal,
    error: null,
    violations: topLevelViolations,
    warnings: topLevelWarnings,
    teamResults,
    summaryByTeamIndex,
    reason,
    tradeReceipt,
    dataWarnings,
    context,
  });

  // Phase 15: Legacy pick arrays (picksOut, incomingPicks, outgoingPicks) are IGNORED.
  // Draft-asset validation is entitlements-only. Legacy test cases removed.
  // See Phase 15 return package for migration details.

  return result;
}
