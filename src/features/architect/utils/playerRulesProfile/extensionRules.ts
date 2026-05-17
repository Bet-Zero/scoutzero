/**
 * Extension Eligibility Rules
 *
 * Determines when a player is eligible for a contract extension
 * and what terms are available.
 *
 * Key Rules (from CBA_Article_7_RuleCards.md, Rule Cards 16-17):
 *
 * Veteran Extensions:
 * - 3-4 year contracts: extendable after 2 years
 * - 5-6 year contracts: extendable after 3 years
 * - Not extendable if shortened via ETO
 * - First-year extended salary capped at 140% of prior salary or avg player salary
 * - Designated Vet Extensions allowed up to max salary
 *
 * Rookie Scale Extensions:
 * - Eligible after 3rd season (in 4th year)
 * - Window: After Moratorium until before regular season of 4th year
 * - First-year salary capped at Rookie Scale max
 *
 * @file src/features/architect/utils/playerRulesProfile/extensionRules.ts
 */

import { getYearsOfService } from './minimumSalaryRules';
import { checkSupermaxEligibility } from './maxSalaryRules';
import { DEFAULT_AVERAGE_SALARY } from '../cbaConstants';
// Wave 39 Step 1: types, constants, and eligibility logic extracted to submodule
export * from './extensionRules.eligibility';
import {
  EXTENSION_TYPES,
  RAISE_PERCENTAGES,
  computeExtensionEligibility,
  type ExtensionContractLike,
  type ExtensionPlayerLike,
  type ExtensionLeagueContextLike,
  type ExtensionRuleContextLike,
  type ExtensionEligibilityInfo,
  type ExtensionTermsInfo,
  type ExtensionProfile,
} from './extensionRules.eligibility';

export function computeExtensionTerms(
  player: ExtensionPlayerLike | null | undefined,
  leagueContext?: ExtensionLeagueContextLike | null,
  eligibility: ExtensionEligibilityInfo | null = null
): ExtensionTermsInfo | null {
  const extEligibility = eligibility || computeExtensionEligibility(player, leagueContext);

  if (!extEligibility.isEligible) {
    return null;
  }

  const capSettings = leagueContext?.capSettings ?? {};
  const currentSeason = leagueContext?.currentSeason || 'unknown';
  const salaryCap = capSettings.salaryCap;
  const isValidCap =
    typeof salaryCap === 'number' &&
    Number.isFinite(salaryCap) &&
    salaryCap > 0;
  if (!isValidCap) {
    console.warn(
      `[extensionRules] Missing or invalid capSettings.salaryCap in leagueContext for season ${currentSeason}. Extension terms may be inaccurate.`
    );
  }
  const effectiveCap = isValidCap ? salaryCap : 0;
  const contract = player?.contract;
  const currentYear = leagueContext?.currentYear || new Date().getFullYear();

  let terms = null;
  switch (extEligibility.extensionType) {
    case EXTENSION_TYPES.ROOKIE:
      terms = computeRookieExtensionTerms(player, effectiveCap, leagueContext);
      break;

    case EXTENSION_TYPES.DESIGNATED_VETERAN:
      terms = computeDesignatedVeteranTerms(player, effectiveCap);
      break;

    case EXTENSION_TYPES.TRADE_RESTRICTED:
      terms = computeTradeRestrictedTerms(player, contract, currentYear);
      break;

    case EXTENSION_TYPES.VETERAN:
    default:
      terms = computeVeteranExtensionTerms(
        player,
        contract,
        effectiveCap,
        leagueContext,
        currentYear
      );
      break;
  }

  if (
    terms &&
    typeof terms.minFirstYearSalary === 'number' &&
    typeof terms.maxFirstYearSalary === 'number'
  ) {
    if (terms.minFirstYearSalary > terms.maxFirstYearSalary) {
      console.warn(
        `[extensionRules] Clamping minFirstYearSalary (${terms.minFirstYearSalary}) to maxFirstYearSalary (${terms.maxFirstYearSalary}). This may indicate an upstream calculation issue with effectiveCap=${effectiveCap}.`
      );
      terms = {
        ...terms,
        minFirstYearSalary: terms.maxFirstYearSalary,
      };
    }
  }

  return terms;
}

function computeRookieExtensionTerms(
  player: ExtensionPlayerLike | null | undefined,
  salaryCap: number,
  leagueContext?: ExtensionLeagueContextLike | null
): ExtensionTermsInfo {
  const supermaxCheck = checkSupermaxEligibility(player, leagueContext);
  let maxPercent = 0.25;
  let notes = 'Standard rookie extension max';

  if (supermaxCheck.isEligible) {
    maxPercent = 0.3;
    notes = 'Higher Max - All-NBA/MVP/DPOY selection';
  }

  const maxFirstYearSalary = Math.round(salaryCap * maxPercent);

  return {
    maxYears: 4,
    maxFirstYearSalary,
    minFirstYearSalary: null,
    raisePercentage: RAISE_PERCENTAGES.standard,
    extensionType: EXTENSION_TYPES.ROOKIE,
    basedOn: `${maxPercent * 100}% of cap`,
    notes,
  };
}

function computeDesignatedVeteranTerms(
  player: ExtensionPlayerLike | null | undefined,
  salaryCap: number
): ExtensionTermsInfo {
  const maxFirstYearSalary = Math.round(salaryCap * 0.35);

  return {
    maxYears: 5,
    maxFirstYearSalary,
    minFirstYearSalary: null,
    raisePercentage: RAISE_PERCENTAGES.standard,
    extensionType: EXTENSION_TYPES.DESIGNATED_VETERAN,
    basedOn: '35% of cap (Designated Veteran)',
    notes: 'Meets All-NBA/MVP/DPOY criteria with 7+ years of service',
  };
}

function computeTradeRestrictedTerms(
  player: ExtensionPlayerLike | null | undefined,
  contract: ExtensionContractLike | null | undefined,
  currentYear: number
): ExtensionTermsInfo {
  const currentSalary = getCurrentSalary(contract, currentYear);
  const maxFirstYearSalary = Math.round(currentSalary * 1.05);

  return {
    maxYears: 2,
    maxFirstYearSalary,
    minFirstYearSalary: currentSalary,
    raisePercentage: RAISE_PERCENTAGES.trade,
    extensionType: EXTENSION_TYPES.TRADE_RESTRICTED,
    basedOn: '105% of current salary',
    notes: 'Restricted due to recent trade - limited to 2 years at 105% raise',
  };
}

function computeVeteranExtensionTerms(
  player: ExtensionPlayerLike | null | undefined,
  contract: ExtensionContractLike | null | undefined,
  salaryCap: number,
  leagueContext?: ExtensionLeagueContextLike | null,
  currentYear?: number
): ExtensionTermsInfo {
  const currentSalary = getCurrentSalary(contract, currentYear || 0);
  const averageSalary =
    leagueContext?.capSettings?.averageSalary || DEFAULT_AVERAGE_SALARY;

  const maxFirstYearSalary = Math.round(
    Math.max(currentSalary * 1.4, averageSalary * 1.4)
  );

  const yearsOfService = getYearsOfService(player);
  let maxPercent = 0.25;
  if (yearsOfService >= 10) maxPercent = 0.35;
  else if (yearsOfService >= 7) maxPercent = 0.3;

  const maxSalary = Math.round(salaryCap * maxPercent);
  const effectiveMax = Math.min(maxFirstYearSalary, maxSalary);

  return {
    maxYears: 4,
    maxFirstYearSalary: effectiveMax,
    minFirstYearSalary: currentSalary,
    raisePercentage: RAISE_PERCENTAGES.standard,
    extensionType: EXTENSION_TYPES.VETERAN,
    basedOn: '140% of salary or average salary (capped at max for years of service)',
    notes: '',
  };
}

function getCurrentSalary(
  contract: ExtensionContractLike | null | undefined,
  currentYear: number
): number {
  if (!contract?.salariesByYear?.length) return 0;

  const currentSeason = `${currentYear - 1}-${String(currentYear).slice(-2)}`;

  const currentEntry = contract.salariesByYear.find(
    (entry) => entry.season === currentSeason
  );

  if (currentEntry) {
    return currentEntry.salary || currentEntry.capHit || 0;
  }

  return contract.salariesByYear[0]?.salary || contract.salariesByYear[0]?.capHit || 0;
}

export function computeExtensionFromRuleContext(
  ctx: ExtensionRuleContextLike | null | undefined
): ExtensionProfile {
  if (!ctx || !ctx.timing || !ctx.player || !ctx.cap) {
    return {
      eligibility: {
        isEligible: false,
        reason: 'Cannot compute extension: invalid or missing RuleContext',
        blockers: ['Missing context'],
        extensionType: EXTENSION_TYPES.INELIGIBLE,
      },
      terms: null,
    };
  }

  const { timing, player: playerCtx, cap } = ctx;

  if (!timing.operationDate) {
    return {
      eligibility: {
        isEligible: false,
        reason: 'Cannot compute extension: missing operationDate in RuleContext',
        blockers: ['Missing operationDate'],
        extensionType: EXTENSION_TYPES.INELIGIBLE,
      },
      terms: null,
    };
  }

  const parseSeasonYear = (seasonId: string | null | undefined) => {
    if (!seasonId) return null;
    const match = String(seasonId).match(/^(\d{4})-(\d{2})$/);
    if (match) {
      return 2000 + parseInt(match[2], 10);
    }
    return null;
  };

  const currentYear = parseSeasonYear(timing.operationSeasonId);

  if (!currentYear) {
    return {
      eligibility: {
        isEligible: false,
        reason: `Cannot compute extension: invalid operationSeasonId "${timing.operationSeasonId}"`,
        blockers: ['Invalid season format'],
        extensionType: EXTENSION_TYPES.INELIGIBLE,
      },
      terms: null,
    };
  }

  if (!playerCtx.contractEndSeasonId) {
    return {
      eligibility: {
        isEligible: false,
        reason:
          'Cannot compute extension: missing contract metadata in RuleContext (no contractEndSeasonId)',
        blockers: ['Missing contract end season'],
        extensionType: EXTENSION_TYPES.INELIGIBLE,
      },
      terms: null,
    };
  }

  if (!playerCtx.originalContractLength) {
    return {
      eligibility: {
        isEligible: false,
        reason: 'Missing contract metadata in RuleContext',
        blockers: [
          'originalContractLength field required for extension eligibility',
        ],
        extensionType: EXTENSION_TYPES.INELIGIBLE,
      },
      terms: null,
    };
  }

  const syntheticPlayer: ExtensionPlayerLike = {
    playerId: playerCtx.playerId,
    bio: {
      draftYear: playerCtx.draftInfo?.year ?? null,
      experience: playerCtx.yearsOfServiceAtOperation ?? 0,
    },
    draftYear: playerCtx.draftInfo?.year ?? null,
    contract: {
      contractType: playerCtx.isRookieScale ? 'Rookie Scale' : 'Standard',
      isRookieScale: playerCtx.isRookieScale,
      endSeason: playerCtx.contractEndSeasonId,
      contractLength: playerCtx.originalContractLength,
      yearsRemaining: playerCtx.contractYearsRemaining ?? 1,
      salariesByYear:
        playerCtx.priorSeasonSalary != null
          ? [{ season: timing.referenceSeasonId, salary: playerCtx.priorSeasonSalary }]
          : playerCtx.currentSeasonSalary != null
            ? [{ season: timing.operationSeasonId, salary: playerCtx.currentSeasonSalary }]
            : [],
      birdRights: {
        status: playerCtx.birdTypeAtOperation,
        yearsWithTeam: 0,
      },
    },
    awards: (playerCtx.awards || []) as Array<Record<string, unknown>>,
    lastTradedDate: playerCtx.lastTradedDate || null,
    signingDate: playerCtx.signingDate || null,
  };

  const leagueContext = {
    currentSeason: timing.operationSeasonId,
    currentYear,
    simulationDate: timing.operationDate,
    capSettings: {
      salaryCap: cap.salaryCap,
      averageSalary: cap.averagePlayerSalary,
    },
  };

  const eligibility = computeExtensionEligibility(
    syntheticPlayer,
    leagueContext
  );
  const terms = eligibility.isEligible
    ? computeExtensionTerms(syntheticPlayer, leagueContext, eligibility)
    : null;

  return {
    eligibility,
    terms,
  };
}
