/**
 * FILE: src/features/architect/utils/tradeMachine/engine/tradeValidator.receipt.ts
 * PURPOSE: generateTradeReceipt — builds a detailed trade receipt snapshot for UI display.
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * Wave 9 Step 2: Extracted from tradeValidator.ts (generateTradeReceipt function).
 */

import {
  CAP_SETTINGS_VERSION,
} from '../utils/capSettingsProvider';
import { SALARY_MATCHING_VERSION } from '../rules/validateSalaryMatching';
import { decorateEntitlementForTrade } from '@/features/architect/utils/entitlements/entitlementTerms';
import { getSalaryForYear } from '@/features/architect/utils/tradeHelpers';
import { isTwoWayTradePlayer } from '../utils/twoWayTradeSalary';
import {
  normalizeTeamCodeLike,
  readSalaryMatchingRuleEnvelope,
  resolveTeamIdentity,
  TRADE_VALIDATOR_VERSION,
} from './tradeValidator.ruleEnvelopes';
import type {
  TradeExceptionPlayer,
  TradeFaExceptionBucket,
  TradeReceipt,
  TradeReceiptTeamRow,
  TradeTeam,
  TradeTeamResult,
  TradeValidatorContext,
} from '../constants/types';

// Local types copied from tradeValidator.ts (needed by generateTradeReceipt)
type TradeValidatorPlayer = TradeExceptionPlayer & {
  player_id?: string;
  playerName?: string;
  playerId?: string;
  teamCode?: string | null;
  currentSalary?: number;
  previousSalary?: number;
  extensionYears?: Array<{
    season?: string | null;
    year?: number | string | null;
    salary?: number | string | null;
    // eslint-disable-next-line no-restricted-syntax -- LEDGER:CAST-170
    [key: string]: unknown;
  }>;
  tradeKicker?: {
    percentage?: number;
    waived?: number;
    maximum?: unknown;
  };
  tradeKickerPct?: number;
  tradeKickerWaivedPct?: number;
  isBYC?: boolean;
  baseYearCompensation?: boolean;
  isPoisonPill?: boolean;
  signAndTrade?: boolean;
  isTwoWay?: boolean;
};

type TradeValidatorTeamData = NonNullable<TradeTeam['team']> & {
  players?: TradeValidatorPlayer[];
  twoWayPlayers?: TradeValidatorPlayer[];
  faExceptionBuckets?: TradeFaExceptionBucket[];
  hardCapped?: boolean | string;
  hardCapFirstApron?: {
    active?: boolean;
    reason?: string | null;
    season?: string | null;
  } | null;
};

type TradeValidatorEntitlement = {
  entitlementId?: string;
  id?: string;
  seasonYear?: number | string;
  round?: number | string;
  kind?: string;
  description?: string;
  toTeamId?: string | null;
  draftKey?: string;
  terms?: unknown;
  termsShort?: unknown;
  linkedEntitlementIds?: string[];
};

type TradeValidatorTeamSlot = TradeTeam & {
  teamId?: string;
  teamCode?: string;
  sends?: TradeValidatorPlayer[];
  outgoingPlayers?: TradeValidatorPlayer[];
  incomingPlayers?: TradeValidatorPlayer[];
  entitlementsOut?: TradeValidatorEntitlement[];
  outgoingEntitlements?: TradeValidatorEntitlement[];
  validationEntitlements?: TradeValidatorEntitlement[];
  teamTotalSalary?: number;
  salaryOut?: number;
  salaryIn?: number;
  projectedSalary?: number;
  cashSent?: number;
  cashReceived?: number;
  notes?: unknown;
  context?: TradeValidatorContext;
  team?: TradeValidatorTeamData | null;
};

interface GenerateTradeReceiptParams {
  teamsWithAssets: TradeValidatorTeamSlot[];
  teamResults: TradeTeamResult[];
  context: TradeValidatorContext;
  isOverallLegal: boolean;
  reason: string;
  validationTime: number;
}


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
export function generateTradeReceipt({
  teamsWithAssets,
  teamResults,
  context,
  isOverallLegal,
  reason,
  validationTime,
}: GenerateTradeReceiptParams): TradeReceipt {
  const teamReceipts: TradeReceiptTeamRow[] = teamsWithAssets.map((team, index) => {
    const teamResult = teamResults[index];
    const salaryMatchingResult = readSalaryMatchingRuleEnvelope(
      teamResult?.rules?.salaryMatching
    );
    const salaryMatchingDetails = salaryMatchingResult.details;

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
      salaryMatchingDetails.totalSalarySource ||
      'team.teamTotalSalary';

    // Build outgoing players list with detailed info
    const outgoingPlayers = (team.outgoingPlayers || team.sends || []).map(
      (player: TradeValidatorPlayer) => {
        const baseSalary = getSalaryForYear(player, context.currentYear) || 0;
        const matchingValue = player.matchOutgoing ?? baseSalary;
        const isBYC = !!player.isBYC || !!player.baseYearCompensation;
        const bycMethod: 'previousSalary' | '50%_of_new' =
          (player.previousSalary || 0) >= Math.floor(baseSalary * 0.5)
            ? 'previousSalary'
            : '50%_of_new';

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
            isTwoWay: isTwoWayTradePlayer(player),
          },
          // BYC breakdown: include previous salary and calculation details
          bycDetails: isBYC
            ? {
                previousSalary: player.previousSalary || 0,
                fiftyPercentNew: Math.floor(baseSalary * 0.5),
                method: bycMethod,
              }
            : null,
        };
      }
    );

    // Build incoming players list with detailed info
    const incomingPlayers = (team.incomingPlayers || []).map(
      (player: TradeValidatorPlayer) => {
      const baseSalary = getSalaryForYear(player, context.currentYear) || 0;
      const matchingValue = player.matchIncoming ?? baseSalary;
      const isPoisonPill = !!player.isPoisonPill;
      const hasTradeKicker = !!(
        player.tradeKicker?.percentage || player.tradeKickerPct
      );
      const poisonPillMethod = 'averaging_current_plus_extensions' as const;

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
          isTwoWay: isTwoWayTradePlayer(player),
        },
        // Poison pill breakdown: include extension years and averaging calculation
        poisonPillDetails:
          isPoisonPill && (player.extensionYears?.length ?? 0) > 0
            ? {
                currentSalary: player.currentSalary || baseSalary,
                extensionYears: player.extensionYears ?? [],
                averagedSalary: matchingValue,
                method: poisonPillMethod,
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
      }
    );

    // Phase 11.3: Build outgoing entitlements list for receipt
    const outgoingEntitlements = (
      team.outgoingEntitlements ||
      team.entitlementsOut ||
      []
    ).map((ent: TradeValidatorEntitlement) => {
      const decorated = decorateEntitlementForTrade(ent) || ent;
      return {
        id: (decorated.entitlementId || decorated.id) as string | undefined,
        seasonYear: decorated.seasonYear as number | string | undefined,
        round: decorated.round as number | string | undefined,
        kind: decorated.kind as string | undefined,
        description: decorated.description as string | undefined,
        toTeamId: (decorated.toTeamId as string | null | undefined) || null, // Phase 11.3.1: Include routing target for debug clarity
        draftKey: decorated.draftKey as string | undefined,
        terms: decorated.terms,
        termsShort: decorated.termsShort,
      };
    });

    // Phase 11.3: Build incoming entitlements list (from other teams' outgoing)
    // Phase 11.3.1: Respect toTeamId routing when present
    const incomingEntitlements: TradeReceipt['teams'][number]['incomingEntitlements'] = [];
    const thisTeamKey = resolveTeamIdentity(team, index);
    const thisTeamCode = normalizeTeamCodeLike(team.teamCode || team.team?.teamCode);

    teamsWithAssets.forEach((otherTeam, otherIndex) => {
      if (otherIndex !== index) {
        (
          otherTeam.outgoingEntitlements ||
          otherTeam.entitlementsOut ||
          []
        ).forEach((ent: TradeValidatorEntitlement) => {
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
              id: (decorated.entitlementId || decorated.id) as string | undefined,
              seasonYear: decorated.seasonYear as number | string | undefined,
              round: decorated.round as number | string | undefined,
              kind: decorated.kind as string | undefined,
              description: decorated.description as string | undefined,
              fromTeam: resolveTeamIdentity(otherTeam, otherIndex),
              toTeamId: (decorated.toTeamId as string | null | undefined) || null, // Phase 11.3.1: Include for debug clarity
              draftKey: decorated.draftKey as string | undefined,
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
      ruleApplied: isSkipped
        ? null
        : (salaryMatchingDetails.ruleApplied ?? null),
      skipReason: salaryMatchingResult.skipReason ?? null,
      formulaUsed: salaryMatchingDetails.formulaUsed ?? null,
      // When skipped, allowableIncoming should be null (not 0)
      allowableIncoming: isSkipped
        ? null
        : (salaryMatchingResult.allowableIncoming ?? null),
      actualIncoming:
        salaryMatchingResult.salaryIn ??
        team.salaryIn ??
        incomingMatchingTotal ??
        null,
      // When skipped, passed should be null (validation didn't run)
      passed: isSkipped
        ? null
        : (salaryMatchingResult.passed ?? null),
      // When skipped, margin should be null
      margin: isSkipped
        ? null
        : (salaryMatchingDetails.margin ?? null),
      // Reference global cap settings even on skip (for transparency)
      capSettings: context.capSettings,
      capSettingsSource: isSkipped
        ? salaryMatchingDetails.capSettingsSource || 'N/A (skipped)'
        : salaryMatchingDetails.capSettingsSource ||
          context.capSettingsSource ||
          'unknown',
      pathEvaluation: teamResult?.salaryMatchingPathEvaluation ?? null,
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
  const receiptYear = context.currentYear ?? 0;

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
      `${receiptYear - 1}-${String(receiptYear).slice(-2)}`,
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
