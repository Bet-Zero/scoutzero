// tradeValidator.ts - Fixed to match test expectations
import { getSalaryForYear } from '@/features/architect/utils/tradeHelpers';

// Import base validators from new structure
import { computeMatchingValues } from '../utils/salaryUtils';
import { checkRosterCounts } from '../rules/validateRoster';
import { normalizeYearInput, yearToSeason } from '../utils/seasonUtils';
import { decorateEntitlementForTrade } from '@/features/architect/utils/entitlements/entitlementTerms';
// Phase 17: Entitlement routing validation (uniqueness, routing, ownership)
import {
  validateEntitlementRouting,
  validateEntitlementLinkageLegality,
} from '../rules/validateEntitlementRouting';
// Phase A5-E1: Player routing validation (uniqueness, routing, destinations)
import { validatePlayerRouting } from '../rules/validatePlayerRouting';
// Phase 4: Centralized cap settings provider for explicit sourcing
import {
  getCapSettings,
  CAP_SETTINGS_VERSION,
} from '../utils/capSettingsProvider';
import {
  createValidationIssue,
  getFirstValidationIssueText,
  getValidationIssueText,
  normalizeValidationIssues,
  summarizeValidationIssues,
} from '../utils/validationIssueText';
import type { DataWarning } from '../utils/dataValidation';
import type {
  TradeReceipt,
  TradeReceiptTeamRow,
  TradeFaExceptionBucket,
  TradeRuleEnvelope,
  TradeSummaryByTeamIndexRow,
  TradeTeam,
  TradeTeamResult,
  TradeValidationResult,
  TradeValidatorContext,
  TradeValidatorCapSettings,
  TradeExceptionPlayer,
  ValidateTradeParams,
  ValidationIssueLike,
} from '../constants/types';
// Wave 18: private types and helpers extracted to satellite files
import type {
  TradeValidatorPlayer,
  TradeValidatorTeamData,
  TradeValidatorEntitlement,
  TradeValidatorTeamSlot,
  TradeValidatorActiveTeamSlot,
  RuleEnvelopeObjectLike,
  RuleEnvelopeLike,
  TeamIdentityLike,
  SignAndTradeResultLike,
  HardCapStatusLike,
  SalaryMatchingReceiptDetailsLike,
  SalaryMatchingReceiptRuleLike,
  BuildValidationResultParams,
  GenerateTradeReceiptParams,
} from './tradeValidator.types';
import {
  shouldRoutePlayerToTeam,
  extractPlayerId,
  computeProjectedRosterLegality,
} from './tradeValidator.helpers';

/**
 * TRADE VALIDATOR
 * ================
 * Version bumped for Phase 1: Legality Correctness (TRADE_MACHINE_UI_WIRING_AUDIT v2.1.0)
 *
 * DEFINITION GATE COMPLETION (Phase 1.6-1.7)
 * -------------------------------------------
 * DG-1: the trade engine's compatibility salary is Apron Team Salary.
 * DG-2: projectedSalary is projected Apron Team Salary after matching adjustments.
 * DG-3: Definitions documented in this header block [x]
 *
 * The following fields are used by the UI for cap impact calculations.
 * Before wiring CapImpactTiles to these values, confirm these definitions are correct.
 *
 * teamTotalSalary is a compatibility bridge only:
 * - Source: the complete Apron Team Salary book.
 * - It never falls back to Team Salary, Tax Salary, or a generic payroll total.
 *
 * postTradeSalary (aka projectedSalary):
 * - Source: computed in validateTrade() as teamTotalSalary - salaryOut + salaryIn
 * - FORMULA: pre-trade Apron Team Salary - outgoing matching salary + incoming matching salary
 *
 * salaryOut / salaryIn:
 * - Source: computed from player.matchOutgoing / player.matchIncoming
 * - These are MATCHING values (with BYC, poison pill, trade kicker adjustments)
 * - NOT the same as base salary
 *
 * Receipt/UI Team Salary remains a separate named book and is never read from
 * this compatibility bridge.
 */

// Trade Receipt Validator Version - bumped for Phase 1 UI wiring / Phase 4 cap settings

// Wave 9 Step 1: normalizers + rule envelope readers extracted to submodule
export * from './tradeValidator.ruleEnvelopes';
import {
  TRADE_VALIDATOR_VERSION,
  buildValidationResult,
  deriveSeasonStateFromDate,
  getDeterministicValidationDate,
  hasOwn,
  isObjectLike,
  normalizeArrayInput,
  normalizeTeamCodeLike,
  normalizeTradeValidationDate,
  resolvePlayerDestinationTeamId,
  resolveTeamIdentity,
} from './tradeValidator.ruleEnvelopes';

// Wave 9 Step 2: trade receipt builder extracted to submodule
export * from './tradeValidator.receipt';
import { generateTradeReceipt } from './tradeValidator.receipt';
import { resolveTradeCashRouting } from '../utils/tradeCashRouting';

// Wave 30: per-team validation logic extracted to satellite
export * from './tradeValidator.teamValidation';
import { validateSingleTeam } from './tradeValidator.teamValidation';

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
}: ValidateTradeParams): TradeValidationResult {
  const startTime = performance.now();
  const rawTradeCtx: TradeValidatorContext =
    tradeCtx && typeof tradeCtx === 'object' ? tradeCtx : {};
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
  const capSettings = capSettingsResult.settings as TradeValidatorCapSettings;

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

  const baseContext: TradeValidatorContext = {
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
      seasonString:
        yearToSeason(resolvedCurrentYear) || String(resolvedCurrentYear),
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
  }: Omit<
    BuildValidationResultParams,
    'validationTime'
  >): TradeValidationResult =>
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
          createValidationIssue('Trade must include at least 2 teams', {
            rule: 'inputValidation',
            severity: 'error',
          }),
        ],
        { rule: 'inputValidation', severity: 'error' }
      ),
      reason: 'Invalid trade: Need at least 2 teams',
    });
  }

  // Filter to only teams that actually have team data
  const validTeams = teams.filter(
    (team): team is TradeValidatorActiveTeamSlot => Boolean(team && team.team)
  );
  if (validTeams.length < 2) {
    return finishValidation({
      legal: false,
      error: 'INVALID_INPUT',
      violations: normalizeValidationIssues(
        [
          createValidationIssue('Trade must include at least 2 valid teams', {
            rule: 'inputValidation',
            severity: 'error',
          }),
        ],
        { rule: 'inputValidation', severity: 'error' }
      ),
      reason: 'Invalid trade: Need at least 2 valid teams',
    });
  }

  const cashRoutingResult = resolveTradeCashRouting(validTeams);
  if (!cashRoutingResult.ok) {
    return finishValidation({
      legal: false,
      error: 'CASH_ROUTING_ERROR',
      violations: normalizeValidationIssues(cashRoutingResult.errors, {
        rule: 'cashRouting',
        severity: 'error',
      }),
      reason: cashRoutingResult.errors[0] || 'Cash routing error',
    });
  }
  const routedValidTeams =
    cashRoutingResult.teams as TradeValidatorActiveTeamSlot[];

  const context: TradeValidatorContext = {
    ...baseContext,
    teams: routedValidTeams, // Add teams to context for consent validation
  };

  const teamIdsByIndex = routedValidTeams.map((teamSlot, index) =>
    resolveTeamIdentity(teamSlot, index)
  );
  const activeTeamCount = routedValidTeams.length;
  const buildRoutedIncomingPlayers = (
    receivingTeamId: string,
    receivingIndex: number,
    teamSlots: Array<{ sends?: TradeValidatorPlayer[] }>
  ): TradeValidatorPlayer[] => {
    const incomingPlayers: TradeValidatorPlayer[] = [];

    teamSlots.forEach((otherTeam, otherIndex) => {
      if (otherIndex === receivingIndex) return;

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

    return incomingPlayers;
  };

  // Calculate incoming/outgoing assets for each team
  // First pass: populate team data structure without salary calculations
  const teamsWithAssets = routedValidTeams.map((team, index) => {
    // Populate outgoing players (what this team is sending out)
    const outgoingPlayers = team.sends || [];

    // Calculate projected salary after trade (will be updated after matching values computed)
    const currentSalary = Number.isFinite(team.team.teamTotalSalary)
      ? Number(team.team.teamTotalSalary)
      : Number.NaN;

    return {
      ...team,
      teamId: teamIdsByIndex[index],
      salaryOut: 0, // Will be computed from matchOutgoing values
      salaryIn: 0, // Will be computed from matchIncoming values
      projectedSalary: currentSalary, // Will be updated after salary calculations
      teamTotalSalary: currentSalary,
      incomingPlayers: [],
      outgoingPlayers,
      cashSent: team.cashSent ?? 0,
      cashReceived: team.cashReceived ?? 0,
      cashToTeamId: team.cashToTeamId ?? null,
      context: {
        ...context,
        // Phase 4: Use the already-resolved capSettings from context
        // This ensures all teams use the same cap settings
        capSettings: context.capSettings,
        capSettingsSource: context.capSettingsSource,
        yearKey: resolvedCurrentYear,
      },
    };
  }) as TradeValidatorActiveTeamSlot[];

  // Compute matching values for all teams FIRST
  // This ensures matchIncoming/matchOutgoing are set correctly using the canonical
  // implementation (BYC, poison pill, trade kicker) before any salary calculations
  // GAP-DATA-001/002: Now also captures data validation warnings
  const matchingValuesResult = computeMatchingValues({
    teams: teamsWithAssets as Parameters<
      typeof computeMatchingValues
    >[0]['teams'],
    yearKey: resolvedCurrentYear,
    daysRemainingInSeason: context.daysRemainingInSeason,
    daysInSeason: context.daysInSeason,
    worldId: context.worldId ?? null,
    asOfDate: canonicalAsOfDate,
    requireGovernedSalaryBasis: context.source === 'tradeMachine',
  });

  // Extract data warnings from matching values computation (GAP-DATA-001, GAP-DATA-002)
  const dataWarnings = matchingValuesResult?.dataWarnings || [];

  if (matchingValuesResult.salaryBasisIssues.length > 0) {
    const messages = matchingValuesResult.salaryBasisIssues.map(
      (issue) => `${issue.playerId || 'Unknown player'}: ${issue.reason}`
    );
    return finishValidation({
      legal: false,
      error: 'TRADE_SALARY_BASIS_AUTHORITY_ERROR',
      violations: normalizeValidationIssues(messages, {
        rule: 'governedTradeSalaryBasis',
        severity: 'error',
      }),
      reason: messages[0] || 'Governed player salary basis is unavailable.',
      dataWarnings,
      context,
    });
  }

  // Phase 17: Validate entitlement routing (uniqueness, destination, ownership)
  // This is a cross-team validation that must happen before per-team validation
  const entitlementRoutingResult = validateEntitlementRouting({
    teams: routedValidTeams,
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
    teams: routedValidTeams,
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
    teams: routedValidTeams,
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
    const incomingPlayers = buildRoutedIncomingPlayers(
      teamIdsByIndex[index],
      index,
      teamsWithAssets
    );

    // Calculate outgoing salary using canonical matchOutgoing values
    const salaryOut = (team.sends || []).reduce((sum, player) => {
      // Use matchOutgoing (set by computeMatchingValues) or fallback to base salary
      const matchingValue =
        player.matchOutgoing ??
        getSalaryForYear(player, resolvedCurrentYear) ??
        0;
      return sum + matchingValue;
    }, 0);

    // Rebuild routed incoming players after matching values are computed so
    // downstream rule envelopes and apply-time handoff preserve matchIncoming.
    const salaryIn = incomingPlayers.reduce((sum, player) => {
      const matchingValue =
        player.matchIncoming ??
        getSalaryForYear(player, resolvedCurrentYear) ??
        0;
      return sum + matchingValue;
    }, 0);

    // Update team with computed salaries
    team.incomingPlayers = incomingPlayers;
    team.salaryOut = salaryOut;
    team.salaryIn = salaryIn;
    team.projectedSalary = Number.isFinite(team.teamTotalSalary)
      ? Number(team.teamTotalSalary) - salaryOut + salaryIn
      : Number.NaN;
  });

  // Run validation rules for each team
  const teamResults: TradeTeamResult[] = teamsWithAssets.map((team, index) =>
    validateSingleTeam(team, index, {
      teamsWithAssets,
      teamIdsByIndex,
      context,
    })
  );

  // Calculate summary by team index
  const summaryByTeamIndex: TradeSummaryByTeamIndexRow[] = teamsWithAssets.map(
    (team, index) => {
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
    }
  );

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
    : getFirstValidationIssueText(
        topLevelViolations,
        'Trade validation failed'
      );

  const validationTime = performance.now() - startTime;

  // Generate trade receipt for debugging (captures exact values used)
  const tradeReceipt: TradeReceipt = generateTradeReceipt({
    teamsWithAssets,
    teamResults,
    context,
    isOverallLegal,
    reason,
    validationTime,
  });

  const result: TradeValidationResult = finishValidation({
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
