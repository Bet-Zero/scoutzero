/**
 * usePlayerRulesProfile Hook
 *
 * Central hook for integrating the Player Rules Determination Layer into Architect UI.
 * Provides computed player rules profiles for cap sheet, cap table, and free agency views.
 *
 * This hook serves as the bridge between the pure rules computation layer
 * and the UI components, providing memoized profiles and action availability
 * based on the current simulation date/league phase.
 *
 * Usage:
 * ```javascript
 * import { usePlayerRulesProfile } from '@/features/architect/hooks/usePlayerRulesProfile';
 *
 * const { getPlayerProfile, getCapSheetRowData, getActionAvailability } = usePlayerRulesProfile({
 *   teamCapSheet,
 *   currentYear,
 *   teamContext,
 *   simulationDate,
 * });
 *
 * const profile = getPlayerProfile(player);
 * const actions = getActionAvailability(player);
 * ```
 *
 * @file src/features/architect/hooks/usePlayerRulesProfile.js
 */

import { useMemo, useCallback } from 'react';
import { computePlayerRulesProfile } from '@/features/architect/utils/playerRulesProfile/index.js';
import capProjections from '@/features/architect/utils/capProjections.js';

/**
 * Default cap settings (2024-25 values)
 */
const DEFAULT_CAP_SETTINGS = {
  salaryCap: 140_588_000,
  firstApron: 178_132_000,
  secondApron: 188_938_000,
  taxLine: 170_818_000,
  averageSalary: 11_100_000,
};

/**
 * Action availability categories
 */
export const ACTION_CATEGORIES = {
  EXTEND: 'extend',
  WAIVE: 'waive',
  WAIVE_STRETCH: 'waiveStretch',
  TRADE: 'trade',
  RESIGN: 'resign',
  RENOUNCE: 'renounce',
  SIGN_AND_TRADE: 'signAndTrade',
  ACCEPT_OPTION: 'acceptOption',
  DECLINE_OPTION: 'declineOption',
  OFFER_QO: 'offerQO',
};

/**
 * Main hook for player rules profile integration
 *
 * @param {Object} params - Hook parameters
 * @param {Object} params.teamCapSheet - Team cap sheet data
 * @param {number} params.currentYear - Current season end year (e.g., 2026 for 2025-26)
 * @param {Object} [params.teamContext] - Team context (teamCode, salary info, etc.)
 * @param {Date} [params.simulationDate] - Simulation date for rules evaluation
 * @param {string} [params.leaguePhase] - Current league phase ('regular', 'offseason', 'playoffs')
 * @returns {Object} Profile accessors and utility functions
 */
export function usePlayerRulesProfile({
  teamCapSheet,
  currentYear,
  teamContext = {},
  simulationDate = null,
  leaguePhase = 'regular',
}) {
  /**
   * Build league context from parameters
   */
  const leagueContext = useMemo(() => {
    const seasonKey = `${currentYear - 1}-${String(currentYear).slice(-2)}`;
    const capSettings = capProjections[seasonKey] || DEFAULT_CAP_SETTINGS;

    return {
      currentYear,
      currentSeason: seasonKey,
      simulationDate: simulationDate || new Date(),
      leaguePhase,
      capSettings: {
        salaryCap: capSettings.cap || capSettings.salaryCap || DEFAULT_CAP_SETTINGS.salaryCap,
        firstApron: capSettings.firstApron || DEFAULT_CAP_SETTINGS.firstApron,
        secondApron: capSettings.secondApron || DEFAULT_CAP_SETTINGS.secondApron,
        taxLine: capSettings.taxLine || DEFAULT_CAP_SETTINGS.taxLine,
        averageSalary: capSettings.averageSalary || DEFAULT_CAP_SETTINGS.averageSalary,
      },
    };
  }, [currentYear, simulationDate, leaguePhase]);

  /**
   * Build team context with cap sheet data
   */
  const enrichedTeamContext = useMemo(() => {
    if (!teamCapSheet) return teamContext;

    // Calculate team salary from cap sheet
    const teamSalary = teamCapSheet.players?.reduce((sum, p) => {
      const currentSeason = leagueContext.currentSeason;
      const salaryEntry = p.contract?.salariesByYear?.find(
        (entry) => entry.season === currentSeason
      );
      return sum + (salaryEntry?.salary || salaryEntry?.capHit || 0);
    }, 0) || 0;

    const capSettings = leagueContext.capSettings;
    const isOverCap = teamSalary > capSettings.salaryCap;
    const isOverTax = teamSalary > capSettings.taxLine;

    let apronStatus = 'UNDER_CAP';
    if (teamSalary > capSettings.secondApron) {
      apronStatus = 'ABOVE_SECOND_APRON';
    } else if (teamSalary > capSettings.firstApron) {
      apronStatus = 'ABOVE_FIRST_APRON';
    } else if (teamSalary > capSettings.taxLine) {
      apronStatus = 'OVER_TAX';
    } else if (teamSalary > capSettings.salaryCap) {
      apronStatus = 'OVER_CAP';
    }

    return {
      ...teamContext,
      teamSalary,
      isOverCap,
      isOverTax,
      apronStatus,
    };
  }, [teamCapSheet, teamContext, leagueContext]);

  /**
   * Cache for computed player profiles
   * Using a Map for O(1) lookups within a render cycle
   */
  const profileCache = useMemo(() => new Map(), [leagueContext, enrichedTeamContext]);

  /**
   * Get player rules profile for a single player
   *
   * @param {Object} player - Player data object
   * @returns {Object} PlayerRulesProfile
   */
  const getPlayerProfile = useCallback(
    (player) => {
      if (!player) return null;

      const playerId = player.playerId || player.id || player.player_id || player.name;
      if (!playerId) return null;

      // Check cache first
      if (profileCache.has(playerId)) {
        return profileCache.get(playerId);
      }

      // Compute and cache profile
      const profile = computePlayerRulesProfile(player, enrichedTeamContext, leagueContext);
      profileCache.set(playerId, profile);

      return profile;
    },
    [enrichedTeamContext, leagueContext, profileCache]
  );

  /**
   * Get action availability for a player
   *
   * Returns which actions are available/enabled and why
   *
   * @param {Object} player - Player data object
   * @returns {Object} Action availability map
   */
  const getActionAvailability = useCallback(
    (player) => {
      const profile = getPlayerProfile(player);
      if (!profile) {
        return createDisabledActions('No player data');
      }

      const actions = {};
      const contract = player?.contract;
      const hasContract = profile.contractSummary?.hasContract;

      // Extension action
      actions[ACTION_CATEGORIES.EXTEND] = {
        enabled: profile.extensionEligibility?.isEligible || false,
        reason: profile.extensionEligibility?.reason || 'Unknown',
        details: profile.extensionTerms,
      };

      // Waive actions (only for players under contract)
      const canWaive = hasContract && profile.contractSummary?.yearsRemaining > 0;
      actions[ACTION_CATEGORIES.WAIVE] = {
        enabled: canWaive,
        reason: canWaive ? 'Player can be waived' : 'No active contract to waive',
      };

      actions[ACTION_CATEGORIES.WAIVE_STRETCH] = {
        enabled: canWaive,
        reason: canWaive
          ? 'Player can be waived and stretched'
          : 'No active contract to waive',
      };

      // Trade action (generally available for players under contract)
      actions[ACTION_CATEGORIES.TRADE] = {
        enabled: hasContract,
        reason: hasContract ? 'Player can be traded' : 'Free agents cannot be traded directly',
      };

      // Re-sign action (for free agents or expiring)
      const isFreeAgent = !hasContract || profile.contractSummary?.yearsRemaining === 0;
      const hasBirdRights =
        profile.birdRights?.type !== 'None' && profile.birdRights?.type !== null;

      actions[ACTION_CATEGORIES.RESIGN] = {
        enabled: isFreeAgent,
        reason: isFreeAgent
          ? hasBirdRights
            ? `Can re-sign using ${profile.birdRights.type} rights`
            : 'Can sign as free agent (needs cap space or exception)'
          : 'Player is under contract',
        details: {
          birdRights: profile.birdRights,
          maxSalary: profile.maxSalary,
          minSalary: profile.minimumSalary,
        },
      };

      // Renounce action (for players with Bird rights cap holds)
      actions[ACTION_CATEGORIES.RENOUNCE] = {
        enabled: isFreeAgent && hasBirdRights,
        reason:
          isFreeAgent && hasBirdRights
            ? 'Can renounce Bird rights to clear cap hold'
            : 'No Bird rights to renounce',
      };

      // Sign & Trade action
      actions[ACTION_CATEGORIES.SIGN_AND_TRADE] = {
        enabled: isFreeAgent && hasBirdRights,
        reason:
          isFreeAgent && hasBirdRights
            ? 'Eligible for sign-and-trade'
            : 'Sign-and-trade requires Bird rights',
      };

      // Option actions
      const optionYear = findOptionYear(player, currentYear);
      const hasOption = !!optionYear;

      actions[ACTION_CATEGORIES.ACCEPT_OPTION] = {
        enabled: hasOption,
        reason: hasOption
          ? `${optionYear.optionType} for ${optionYear.season}`
          : 'No option available',
        details: optionYear,
      };

      actions[ACTION_CATEGORIES.DECLINE_OPTION] = {
        enabled: hasOption,
        reason: hasOption
          ? `Can decline ${optionYear.optionType}`
          : 'No option to decline',
        details: optionYear,
      };

      // Qualifying Offer action (for RFAs)
      const rfaStatus = profile.restrictedFreeAgency;
      actions[ACTION_CATEGORIES.OFFER_QO] = {
        enabled: rfaStatus?.qualifyingOfferEligible || false,
        reason: rfaStatus?.qualifyingOfferEligible
          ? `QO amount: $${(rfaStatus.qualifyingOfferAmount || 0).toLocaleString()}`
          : rfaStatus?.reason || 'Not eligible for qualifying offer',
        details: {
          amount: rfaStatus?.qualifyingOfferAmount,
          deadline: rfaStatus?.qoDeadline,
          canAccept: rfaStatus?.canAcceptQO,
        },
      };

      return actions;
    },
    [getPlayerProfile, currentYear]
  );

  /**
   * Build cap sheet row view model
   *
   * Provides all data needed to render a cap sheet row including
   * rules-derived action availability and visual indicators
   *
   * @param {Object} player - Player data object
   * @returns {Object} Cap sheet row view model
   */
  const getCapSheetRowData = useCallback(
    (player) => {
      const profile = getPlayerProfile(player);
      const actions = getActionAvailability(player);

      if (!profile) {
        return {
          player,
          profile: null,
          actions: createDisabledActions('No profile'),
          indicators: {},
        };
      }

      // Build visual indicators
      const indicators = {
        isExtensionEligible: profile.extensionEligibility?.isEligible || false,
        birdRightsType: profile.birdRights?.type || 'None',
        isRFA: profile.restrictedFreeAgency?.isRFA || false,
        hasOption: !!findOptionYear(player, currentYear),
        freeAgencyType: profile.contractSummary?.freeAgencyType || 'Unknown',
        yearsRemaining: profile.contractSummary?.yearsRemaining || 0,
      };

      return {
        player,
        profile,
        actions,
        indicators,
      };
    },
    [getPlayerProfile, getActionAvailability, currentYear]
  );

  /**
   * Get profiles for multiple years (for cap table multi-year view)
   *
   * Computes profiles for each future year to show when players
   * become extension-eligible, hit free agency, etc.
   *
   * @param {Object} player - Player data object
   * @param {number} startYear - Start year
   * @param {number} numYears - Number of years to compute
   * @returns {Object[]} Array of profiles by year
   */
  const getMultiYearProfiles = useCallback(
    (player, startYear, numYears = 7) => {
      const profiles = [];

      for (let i = 0; i < numYears; i++) {
        const year = startYear + i;
        const yearContext = {
          ...leagueContext,
          currentYear: year,
          currentSeason: `${year - 1}-${String(year).slice(-2)}`,
        };

        const profile = computePlayerRulesProfile(player, enrichedTeamContext, yearContext);

        profiles.push({
          year,
          season: yearContext.currentSeason,
          profile,
          indicators: {
            isExtensionEligible: profile.extensionEligibility?.isEligible || false,
            extensionType: profile.extensionEligibility?.extensionType || null,
            birdRightsType: profile.birdRights?.type || 'None',
            isRFA: profile.restrictedFreeAgency?.isRFA || false,
            freeAgencyYear: profile.contractSummary?.freeAgencyYear || null,
            freeAgencyType: profile.contractSummary?.freeAgencyType || 'Unknown',
          },
        });
      }

      return profiles;
    },
    [leagueContext, enrichedTeamContext]
  );

  /**
   * Get extension modal pre-fill data
   *
   * Returns validated defaults for extension modal based on rules profile
   *
   * @param {Object} player - Player data object
   * @returns {Object} Extension modal pre-fill data
   */
  const getExtensionModalData = useCallback(
    (player) => {
      const profile = getPlayerProfile(player);

      if (!profile || !profile.extensionEligibility?.isEligible) {
        return {
          isEligible: false,
          reason: profile?.extensionEligibility?.reason || 'Not eligible',
          defaults: null,
          constraints: null,
        };
      }

      const terms = profile.extensionTerms;
      if (!terms) {
        return {
          isEligible: true,
          reason: profile.extensionEligibility.reason,
          defaults: null,
          constraints: null,
        };
      }

      return {
        isEligible: true,
        reason: profile.extensionEligibility.reason,
        extensionType: terms.extensionType,
        defaults: {
          years: Math.min(terms.maxYears, 4), // Default to 4 years or max
          firstYearSalary: terms.maxFirstYearSalary,
          raisePercentage: terms.raisePercentage,
        },
        constraints: {
          minYears: 1,
          maxYears: terms.maxYears,
          minFirstYearSalary: terms.minFirstYearSalary || profile.minimumSalary,
          maxFirstYearSalary: terms.maxFirstYearSalary,
          raisePercentage: terms.raisePercentage,
        },
        notes: terms.notes,
        basedOn: terms.basedOn,
      };
    },
    [getPlayerProfile]
  );

  /**
   * Get free agent re-sign modal data
   *
   * Returns data for re-signing a free agent based on Bird rights
   *
   * @param {Object} player - Player data object
   * @returns {Object} Re-sign modal data
   */
  const getResignModalData = useCallback(
    (player) => {
      const profile = getPlayerProfile(player);

      if (!profile) {
        return {
          canResign: false,
          reason: 'No player data',
        };
      }

      const birdRights = profile.birdRights;
      const maxSalary = profile.maxSalary;
      const minSalary = profile.minimumSalary;
      const rfaStatus = profile.restrictedFreeAgency;

      return {
        canResign: true,
        birdRights: {
          type: birdRights?.type || 'None',
          summary: birdRights?.summary || '',
          signingAbilities: birdRights?.signingAbilities || {},
        },
        isRFA: rfaStatus?.isRFA || false,
        qualifyingOffer: rfaStatus?.qualifyingOfferEligible
          ? {
              amount: rfaStatus.qualifyingOfferAmount,
              deadline: rfaStatus.qoDeadline,
              canAccept: rfaStatus.canAcceptQO,
            }
          : null,
        constraints: {
          minSalary,
          maxSalary: maxSalary?.maxSalary || null,
          maxSalaryTier: maxSalary?.tier || 'Unknown',
          maxYears: birdRights?.signingAbilities?.maxYears || 4,
          raisePercentage: birdRights?.signingAbilities?.raisePercentage || 0.05,
        },
      };
    },
    [getPlayerProfile]
  );

  return {
    // Core accessors
    getPlayerProfile,
    getActionAvailability,
    getCapSheetRowData,

    // Multi-year support
    getMultiYearProfiles,

    // Modal data helpers
    getExtensionModalData,
    getResignModalData,

    // Context for reference
    leagueContext,
    teamContext: enrichedTeamContext,
  };
}

/**
 * Find option year for a player
 *
 * @param {Object} player - Player data
 * @param {number} currentYear - Current season end year
 * @returns {Object|null} Option year data or null
 */
function findOptionYear(player, currentYear) {
  const salaries = player?.contract?.salariesByYear;
  if (!salaries?.length) return null;

  for (const entry of salaries) {
    if (!entry.option) continue;

    const season = String(entry.season);
    let yearEnd;
    if (/^\d{4}-\d{2}$/.test(season)) {
      yearEnd = 2000 + parseInt(season.split('-')[1], 10);
    } else {
      yearEnd = parseInt(season, 10);
    }

    // Only return future options
    if (yearEnd > currentYear) {
      return {
        year: yearEnd,
        season: entry.season,
        optionType: entry.option,
        salary: entry.salary || entry.capHit || 0,
      };
    }
  }

  return null;
}

/**
 * Create a map of all disabled actions
 *
 * @param {string} reason - Reason for disabling
 * @returns {Object} Disabled actions map
 */
function createDisabledActions(reason) {
  const actions = {};
  for (const category of Object.values(ACTION_CATEGORIES)) {
    actions[category] = {
      enabled: false,
      reason,
    };
  }
  return actions;
}

export default usePlayerRulesProfile;
