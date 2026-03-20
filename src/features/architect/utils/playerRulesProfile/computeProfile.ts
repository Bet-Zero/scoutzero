/**
 * Compute Player Rules Profile
 *
 * Central entry point for computing all player-specific CBA rules.
 * This function aggregates results from all rule modules into a single
 * comprehensive PlayerRulesProfile object.
 *
 * Usage:
 * ```ts
 * import { computePlayerRulesProfile } from '@/features/architect/utils/playerRulesProfile';
 *
 * const profile = computePlayerRulesProfile(player, teamContext, leagueContext);
 * console.log(profile.extensionEligibility.isEligible);
 * console.log(profile.birdRights.type);
 * console.log(profile.minimumSalary);
 * ```
 *
 * @file src/features/architect/utils/playerRulesProfile/computeProfile.ts
 */

import {
  computeExtensionEligibility,
  computeExtensionTerms,
} from '@/features/architect/utils/playerRulesProfile/extensionRules';
import { computeBirdRights } from '@/features/architect/utils/playerRulesProfile/birdRightsRules';
import {
  computeMinimumSalary,
  getYearsOfService,
} from '@/features/architect/utils/playerRulesProfile/minimumSalaryRules';
import { computeRFAStatus } from '@/features/architect/utils/playerRulesProfile/rfaRules';
import { computeMaxSalary } from '@/features/architect/utils/playerRulesProfile/maxSalaryRules';
import { parseSeasonEndYear } from '@/features/architect/utils/seasonUtils';
import { DEFAULT_AVERAGE_SALARY } from '@/features/architect/utils/cbaConstants';
import { getCapForSeason } from '@/features/architect/utils/capHelpers';
import {
  getCurrentSeasonId,
  getCurrentSeasonEndYear,
} from '@/features/architect/utils/seasonHelpers';

type CapLookupSeason = Parameters<typeof getCapForSeason>[0];
type CapInfo = NonNullable<ReturnType<typeof getCapForSeason>>;

type SalaryEntryLike = {
  season?: string | null;
  salary?: number | null;
  capHit?: number | null;
  guaranteed?: boolean | null;
};

type ContractLike = {
  contractType?: string | null;
  isRookieScale?: boolean | null;
  yearsRemaining?: number | null;
  endSeason?: string | null;
  freeAgency?: {
    year?: number | null;
    type?: string | null;
  } | null;
  salariesByYear?: SalaryEntryLike[] | null;
};

type PlayerLike = {
  playerId?: string | null;
  player_id?: string | null;
  id?: string | null;
  displayName?: string | null;
  name?: string | null;
  bio?: {
    experience?: unknown;
    yearsExperience?: unknown;
    draftYear?: number | string | null;
    draftPick?: number | string | null;
    ['Years Pro']?: unknown;
  } | null;
  contract?: ContractLike | null;
  yearsOfService?: unknown;
  years_of_service?: unknown;
  experience?: unknown;
  yearsPro?: unknown;
  ['Years Pro']?: unknown;
  usedETO?: boolean | null;
  lastRenegotiatedDate?: string | null;
  lastTradedDate?: string | null;
  awards?: Array<Record<string, unknown>> | null;
  draftYear?: number | string | null;
  draftPick?: number | string | null;
};

type TeamContextLike = {
  teamCode?: string | null;
  teamSalary?: number | null;
  isOverCap?: boolean | null;
  apronStatus?: string | null;
};

type LeagueContextLike = {
  currentSeason?: string | null;
  currentYear?: number | null;
  simulationDate?: Date | null;
  leaguePhase?: string | null;
  capSettings?: {
    salaryCap?: number | null;
    firstApron?: number | null;
    secondApron?: number | null;
    taxLine?: number | null;
    averageSalary?: number | null;
  } | null;
};

type NormalizedLeagueContext = {
  currentYear: number;
  currentSeason: string;
  simulationDate: Date;
  leaguePhase: string;
  capSettings: {
    salaryCap: number;
    firstApron: number;
    secondApron: number;
    taxLine: number;
    averageSalary: number;
  };
};

type ContractSummary = {
  yearsOfService: number;
  yearsRemaining: number;
  freeAgencyYear: number | null | undefined;
  freeAgencyType: string;
  currentSalary: number | null;
  hasContract: boolean;
  contractType?: string;
  isRookieScale?: boolean | null;
};

type ExtensionEligibilityInfo = ReturnType<typeof computeExtensionEligibility>;
type ExtensionTermsInfo = NonNullable<ReturnType<typeof computeExtensionTerms>>;
type BirdRightsInfo = ReturnType<typeof computeBirdRights>;
type MinimumSalaryInfo = ReturnType<typeof computeMinimumSalary>;
type MaxSalaryInfo = ReturnType<typeof computeMaxSalary>;
type RFAStatusInfo = ReturnType<typeof computeRFAStatus>;

type PlayerRulesSigningAbilities = {
  canSignOverCap: boolean;
  maxYears: number;
  raisePercentage: number;
  maxFirstYearSalary?: number;
  canSignToMax?: boolean;
  method?: string;
};

type PlayerRulesProfile = {
  playerId: string;
  playerName: string;
  evaluatedAt: string;
  evaluatedForSeason: string;
  error?: string;
  extensionEligibility: {
    isEligible: boolean;
    reason: string;
    blockers: string[];
    extensionType: string;
    eligibleDate: Date | null;
  };
  extensionTerms: {
    maxYears: number;
    maxFirstYearSalary: number;
    minFirstYearSalary: number | null | undefined;
    raisePercentage: number;
    extensionType: string;
    basedOn: string;
    notes: string;
  } | null;
  birdRights: {
    type: string;
    yearsWithTeam: number;
    summary: string;
    signingAbilities: PlayerRulesSigningAbilities;
  };
  minimumSalary: number;
  minimumSalaryReason: string;
  maxSalary: {
    maxSalary: number;
    maxSalaryBird?: number;
    tier: string;
    supermaxEligible: boolean;
    reason: string;
  };
  restrictedFreeAgency: {
    isRFA: boolean;
    qualifyingOfferEligible: boolean;
    qualifyingOfferAmount: number | null;
    canAcceptQO: boolean;
    qoDeadline: Date | null;
    teamHasMatchingRights: boolean;
    reason: string | undefined;
  };
  contractSummary: ContractSummary;
  teamContext: {
    teamCode: string;
    isOverCap: boolean;
    apronStatus: string | null;
  } | null;
};

/**
 * Get default cap settings for a season
 * Uses capProjections if available, otherwise returns defaults for the latest known season
 */
function getDefaultCapSettingsForSeason(
  seasonId: string
): NormalizedLeagueContext['capSettings'] {
  // Try to get from capProjections first
  const capData = getCapForSeason(seasonId as CapLookupSeason);
  if (capData) {
    return {
      salaryCap: capData.salaryCap,
      firstApron: capData.firstApron,
      secondApron: capData.secondApron,
      taxLine: capData.taxLine,
      averageSalary: capData.averagePlayerSalary || DEFAULT_AVERAGE_SALARY,
    };
  }

  // Fallback to latest available season data (2025-26)
  const fallbackCap = getCapForSeason('2025-26' as CapLookupSeason);
  if (fallbackCap) {
    return {
      salaryCap: fallbackCap.salaryCap,
      firstApron: fallbackCap.firstApron,
      secondApron: fallbackCap.secondApron,
      taxLine: fallbackCap.taxLine,
      averageSalary:
        fallbackCap.averagePlayerSalary || DEFAULT_AVERAGE_SALARY,
    };
  }

  // Ultimate fallback (should rarely happen)
  return {
    salaryCap: 154_647_000, // 2025-26 cap
    firstApron: 195_945_000,
    secondApron: 207_824_000,
    taxLine: 187_895_000,
    averageSalary: DEFAULT_AVERAGE_SALARY,
  };
}

/**
 * Compute comprehensive player rules profile
 *
 * This is the main entry point for the player rules determination layer.
 * It computes all relevant CBA rules for a player and returns a structured
 * profile object.
 *
 * The function is pure and deterministic - given the same inputs,
 * it will always return the same output.
 *
 * @param player - Player data object
 * @param teamContext - Team context (optional)
 * @param leagueContext - League context
 * @returns PlayerRulesProfile - Comprehensive rules profile
 */
export function computePlayerRulesProfile(
  player: PlayerLike | null | undefined,
  teamContext: TeamContextLike = {},
  leagueContext: LeagueContextLike = {}
): PlayerRulesProfile {
  // Validate input
  if (!player) {
    return createEmptyProfile(
      'Unknown',
      'No player data provided',
      leagueContext.simulationDate
    );
  }

  // Normalize league context with defaults
  const normalizedLeagueContext = normalizeLeagueContext(leagueContext);

  // Extract player identity
  const playerId = player.playerId || player.player_id || player.id || 'unknown';
  const playerName = player.displayName || player.name || playerId;

  // Compute all rule components
  const extensionEligibility: ExtensionEligibilityInfo =
    computeExtensionEligibility(player, normalizedLeagueContext);
  const extensionTerms: ExtensionTermsInfo | null =
    extensionEligibility.isEligible
      ? computeExtensionTerms(
          player,
          normalizedLeagueContext,
          extensionEligibility
        )
      : null;

  const birdRights: BirdRightsInfo = computeBirdRights(
    player,
    normalizedLeagueContext
  );
  const minimumSalaryInfo: MinimumSalaryInfo = computeMinimumSalary(
    player,
    normalizedLeagueContext
  );
  const maxSalaryInfo: MaxSalaryInfo = computeMaxSalary(
    player,
    normalizedLeagueContext
  );
  const rfaStatus: RFAStatusInfo = computeRFAStatus(
    player,
    normalizedLeagueContext
  );

  // Build contract summary
  const contractSummary = buildContractSummary(
    player,
    normalizedLeagueContext.currentYear
  );

  // Assemble the complete profile
  return {
    // Identity
    playerId,
    playerName,
    evaluatedAt: (
      normalizedLeagueContext.simulationDate || new Date()
    ).toISOString(),
    evaluatedForSeason: normalizedLeagueContext.currentSeason,

    // Extension eligibility and terms
    extensionEligibility: {
      isEligible: extensionEligibility.isEligible,
      reason: extensionEligibility.reason,
      blockers: extensionEligibility.blockers || [],
      extensionType: extensionEligibility.extensionType,
      eligibleDate: extensionEligibility.eligibleDate || null,
    },
    extensionTerms: extensionTerms
      ? {
          maxYears: extensionTerms.maxYears,
          maxFirstYearSalary: extensionTerms.maxFirstYearSalary,
          minFirstYearSalary: extensionTerms.minFirstYearSalary,
          raisePercentage: extensionTerms.raisePercentage,
          extensionType: extensionTerms.extensionType,
          basedOn: extensionTerms.basedOn,
          notes: extensionTerms.notes,
        }
      : null,

    // Bird rights
    birdRights: {
      type: birdRights.type,
      yearsWithTeam: birdRights.yearsWithTeam,
      summary: birdRights.summary,
      signingAbilities: {
        ...birdRights.signingAbilities,
        maxFirstYearSalary:
          birdRights.signingAbilities.maxFirstYearSalary ?? undefined,
      },
    },

    // Salary constraints
    minimumSalary: minimumSalaryInfo.minimumSalary,
    minimumSalaryReason: minimumSalaryInfo.reason,

    maxSalary: {
      maxSalary: maxSalaryInfo.maxSalary,
      maxSalaryBird: maxSalaryInfo.maxSalaryBird,
      tier: maxSalaryInfo.tier,
      supermaxEligible: maxSalaryInfo.supermaxEligible,
      reason: maxSalaryInfo.reason,
    },

    // Restricted free agency
    restrictedFreeAgency: {
      isRFA: rfaStatus.isRFA,
      qualifyingOfferEligible: rfaStatus.qualifyingOfferEligible,
      qualifyingOfferAmount: rfaStatus.qualifyingOfferAmount || null,
      canAcceptQO: rfaStatus.canAcceptQO || false,
      qoDeadline: rfaStatus.qoDeadline || null,
      teamHasMatchingRights: rfaStatus.teamHasMatchingRights || false,
      reason: rfaStatus.reason,
    },

    // Contract summary
    contractSummary,

    // Team context if provided
    teamContext: teamContext.teamCode
      ? {
          teamCode: teamContext.teamCode,
          isOverCap: teamContext.isOverCap || false,
          apronStatus: teamContext.apronStatus || null,
        }
      : null,
  };
}

/**
 * Normalize league context with defaults
 *
 * When simulationDate is provided, derive currentYear/currentSeason from it
 * to ensure all rules are evaluated for the correct league year.
 *
 * @param leagueContext - Raw league context
 * @returns Normalized league context
 */
function normalizeLeagueContext(
  leagueContext: LeagueContextLike
): NormalizedLeagueContext {
  // Use simulationDate if provided, otherwise fall back to real-world time
  const effectiveDate = leagueContext.simulationDate || new Date();

  // Use seasonHelpers for proper season calculation
  const defaultSeason = getCurrentSeasonId(effectiveDate);
  const defaultYear = getCurrentSeasonEndYear(effectiveDate);

  const currentSeason = leagueContext.currentSeason || defaultSeason;
  const currentYear = leagueContext.currentYear || defaultYear;

  // Get cap settings from capProjections for the current season
  const defaultCapSettings = getDefaultCapSettingsForSeason(currentSeason);

  return {
    currentYear,
    currentSeason,
    simulationDate: effectiveDate,
    leaguePhase: leagueContext.leaguePhase || 'regular',
    capSettings: {
      salaryCap:
        leagueContext.capSettings?.salaryCap ?? defaultCapSettings.salaryCap,
      firstApron:
        leagueContext.capSettings?.firstApron ?? defaultCapSettings.firstApron,
      secondApron:
        leagueContext.capSettings?.secondApron ??
        defaultCapSettings.secondApron,
      taxLine: leagueContext.capSettings?.taxLine ?? defaultCapSettings.taxLine,
      averageSalary:
        leagueContext.capSettings?.averageSalary ??
        defaultCapSettings.averageSalary,
    },
  };
}

/**
 * Build contract summary from player data
 *
 * @param player - Player data
 * @param currentYear - Current season end year
 * @returns Contract summary
 */
function buildContractSummary(
  player: PlayerLike,
  currentYear: number
): ContractSummary {
  const contract = player?.contract;
  const yearsOfService = getYearsOfService(player);

  if (!contract) {
    return {
      yearsOfService,
      yearsRemaining: 0,
      freeAgencyYear: null,
      freeAgencyType: 'Unknown',
      currentSalary: null,
      hasContract: false,
    };
  }

  // Get years remaining
  let yearsRemaining = contract.yearsRemaining;
  if (yearsRemaining === undefined && contract.endSeason) {
    const endYear = parseSeasonEndYear(contract.endSeason);
    yearsRemaining = endYear ? Math.max(0, endYear - currentYear + 1) : 0;
  }

  // Get free agency info
  let freeAgencyYear = contract.freeAgency?.year;
  if (!freeAgencyYear && contract.endSeason) {
    freeAgencyYear = parseSeasonEndYear(contract.endSeason);
  }

  const freeAgencyType =
    contract.freeAgency?.type ||
    (yearsOfService < 4 ? 'Restricted' : 'Unrestricted');

  // Get current salary
  const currentSeason = toSeasonCode(currentYear);
  const currentSalaryEntry = contract.salariesByYear?.find(
    (entry) => entry.season === currentSeason
  );
  const currentSalary =
    currentSalaryEntry?.salary || currentSalaryEntry?.capHit || null;

  return {
    yearsOfService,
    yearsRemaining: yearsRemaining || 0,
    freeAgencyYear,
    freeAgencyType,
    currentSalary,
    hasContract: true,
    contractType: contract.contractType || 'Standard',
    isRookieScale:
      contract.isRookieScale || contract.contractType === 'Rookie Scale',
  };
}

/**
 * Create an empty profile for error cases
 *
 * @param playerId - Player identifier
 * @param reason - Reason for empty profile
 * @returns Empty profile
 */
function createEmptyProfile(
  playerId: string,
  reason: string,
  simulationDate: Date | null = null
): PlayerRulesProfile {
  const evalDate = simulationDate || new Date();
  return {
    playerId,
    playerName: playerId,
    evaluatedAt: evalDate.toISOString(),
    evaluatedForSeason: getCurrentSeasonId(evalDate),
    error: reason,

    extensionEligibility: {
      isEligible: false,
      reason,
      blockers: [reason],
      extensionType: 'Not Eligible',
      eligibleDate: null,
    },
    extensionTerms: null,

    birdRights: {
      type: 'None',
      yearsWithTeam: 0,
      summary: 'Unable to determine - ' + reason,
      signingAbilities: {
        canSignOverCap: false,
        maxYears: 4,
        raisePercentage: 0.05,
      },
    },

    minimumSalary: 0,
    minimumSalaryReason: reason,

    maxSalary: {
      maxSalary: 0,
      tier: 'Unknown',
      supermaxEligible: false,
      reason,
    },

    restrictedFreeAgency: {
      isRFA: false,
      qualifyingOfferEligible: false,
      qualifyingOfferAmount: null,
      canAcceptQO: false,
      qoDeadline: null,
      teamHasMatchingRights: false,
      reason,
    },

    contractSummary: {
      yearsOfService: 0,
      yearsRemaining: 0,
      freeAgencyYear: null,
      freeAgencyType: 'Unknown',
      currentSalary: null,
      hasContract: false,
    },

    teamContext: null,
  };
}

/**
 * Convert end year to season code
 *
 * @param endYear - End year (e.g., 2025)
 * @returns Season code (e.g., "2024-25")
 */
function toSeasonCode(endYear: number): string {
  const startYear = endYear - 1;
  return `${startYear}-${String(endYear).slice(-2)}`;
}
