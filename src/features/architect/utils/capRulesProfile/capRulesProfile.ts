/**
 * FILE: src/features/architect/utils/capRulesProfile/capRulesProfile.ts
 * PURPOSE: Single canonical gateway for cap rules, constants, and thresholds.
 * OWNERSHIP: Feature: architect
 *
 * This facade aggregates data from:
 * 1. Cap Settings Provider (Cap, Tax, Aprons, Exceptions)
 * 2. CBA Constants (Roster limits)
 * 3. CBA Thresholds (Rookie minimums)
 *
 * IT IS THE ONLY ALLOWED SOURCE FOR THESE VALUES.
 * Direct imports of capProjections or cbaConstants in feature code are DEPRECATED.
 */

import {
  getCapSettingsForYear,
  yearToSeasonKey,
} from '../tradeMachine/utils/capSettingsProvider';
import {
  ROSTER_REQUIREMENTS,
  CBA_THRESHOLDS,
} from '../tradeMachine/constants/cbaConstants';
import capProjections from '../capProjections';
import {
  MINIMUM_SALARY_SCALES,
  getScaleForSeason,
} from '../../data/minimumSalaryScales';

export type SourceTag = 'real' | 'reported' | 'projected' | 'unknown';

export interface CapRulesMeta {
  source: string;
  resolved: boolean;
  projectionMethod?: string;
  sourcesSummary: SourceTag;
  sources: {
    cap: Record<keyof CapLines, SourceTag>;
    exceptions: Record<keyof ExceptionAmounts, SourceTag>;
    salaries: { rookieMin: SourceTag };
  };
}

export interface RosterRules {
  minStandard: number;
  maxStandard: number;
  maxTwoWay: number;
  graceMin: number;
}

export interface CapLines {
  salaryCap: number;
  luxuryTax: number;
  firstApron: number;
  secondApron: number;
}

export interface ExceptionAmounts {
  fullMLE: number;
  taxpayerMLE: number;
  roomMLE: number;
  bae: number;
}

export interface SalaryScales {
  rookieMin: number;
  rookieMinSource: 'real' | 'projected';
  getMinimumForYOS: (yos: number) => number;
}

export interface CapRulesProfile {
  yearKey: number;
  seasonKey: string;
  roster: RosterRules;
  cap: CapLines;
  exceptions: ExceptionAmounts;
  salaries: SalaryScales;
  _meta?: CapRulesMeta;
}

export type CapProjectionOverrideRow = Partial<
  (typeof capProjections)[string]
> & {
  salaryCap?: number | null;
  luxuryTax?: number | null;
  apron?: number | null;
  mle?: number | null;
};

export type CapProjectionOverrides = Record<
  string,
  CapProjectionOverrideRow | null | undefined
>;

/**
 * Gets the consolidated cap rules profile for a specific year.
 * Throws an error if critical data (like rookie scale) is missing and cannot be projected.
 *
 * @param yearKey - The season end year (e.g., 2025 for 2024-25)
 * @param customCapProjections - Optional override for cap projections (for simulation/sandbox)
 * @returns CapRulesProfile containing all necessary rules/constants
 */
export function getCapRulesForYear(
  yearKey: number,
  customCapProjections?: CapProjectionOverrides | null
): CapRulesProfile;
export function getCapRulesForYear(
  yearKey: number,
  customCapProjections?: unknown
): CapRulesProfile;
export function getCapRulesForYear(
  yearKey: number,
  customCapProjections?: unknown
): CapRulesProfile {
  const seasonKey = yearToSeasonKey(yearKey);

  if (!seasonKey) {
    throw new Error(`[CapRulesProfile] Invalid yearKey provided: ${yearKey}`);
  }

  // 1. Get Cap & Exception settings
  // Pass custom projections if provided, otherwise default to the imported source
  const projectionOverrides = (customCapProjections ||
    capProjections) as Record<string, unknown>;
  const capSettings = getCapSettingsForYear(yearKey, projectionOverrides);
  
  // 2. Resolve Rookie Minimum
  // Primary Source: Cap Settings (extended projections in capProjections.js)
  // Fallback 1: CBA Thresholds (legacy constants)
  // Fallback 2: Deterministic Projection tied to Cap Growth
  
  // Note: capSettings comes from a JS file, so we cast to safely access properties
  const settingsAny = capSettings as any;
  let rookieMin = settingsAny.rookieMin;
  let rookieMinSource: SourceTag = settingsAny.rookieMinSource === 'real' ? 'real' : 'projected';
  
  // Default source for cap settings is 'real' if confirmed, otherwise 'projected'
  // capProjections uses 'confirmed' boolean to indicate real/final values
  const isConfirmed = settingsAny.confirmed === true;
  const defaultSource: SourceTag = isConfirmed ? 'real' : 'projected';
  
  let projectionDetails = settingsAny.projectionDetails || '';

  // Case A: Missing Rookie Min -> Project it
  if (!rookieMin) {
    // Try Legacy Fallback first (strictly for this season)
    const thresholdEntry = CBA_THRESHOLDS[seasonKey as keyof typeof CBA_THRESHOLDS];
    if (thresholdEntry?.MIN_SALARY_ROOKIE) {
      rookieMin = thresholdEntry.MIN_SALARY_ROOKIE;
      rookieMinSource = 'real'; // It's a constant, treat as real-ish
    } else {
      // Deterministic Projection
      try {
        // Recursive Call: Get previous year's rules to establish baseline
        // Base case is implicitly 2024-25 which has hardcoded values
        const prevYearKey = yearKey - 1;
        
        // Guard against infinite recursion or too far back
        if (prevYearKey < 2020) {
           throw new Error('Projection reached limit (2020)');
        }

        const prevRules = getCapRulesForYear(
          prevYearKey,
          customCapProjections as CapProjectionOverrides | null | undefined
        );
        const prevRookieMin = prevRules.salaries.rookieMin;
        const prevCap = prevRules.cap.salaryCap;
        const currentCap = capSettings.salaryCap;

        if (prevRookieMin && prevCap && currentCap) {
          // Method: Scale by Cap Growth
          // rookieMin = prevRookieMin * (currentCap / prevCap)
          const ratio = currentCap / prevCap;
          rookieMin = Math.floor(prevRookieMin * ratio);
          rookieMinSource = 'projected';
          projectionDetails = `Derived from ${prevRules.seasonKey} ($${prevRookieMin}) * CapGrowth (${ratio.toFixed(4)})`;
        } else {
           // Fallback if caps missing: Fixed 4% growth
           rookieMin = Math.floor(prevRookieMin * 1.04);
           rookieMinSource = 'projected';
           projectionDetails = `Derived from ${prevRules.seasonKey} ($${prevRookieMin}) * FixedGrowth (1.04)`;
        }
      } catch (err) {
        // If recursion fails (e.g. base year not found), we can't project
         console.warn(`[CapRulesProfile] Failed to project rookieMin for ${seasonKey}:`, err);
      }
    }
  }

  // STOP CONDITION: We do not silently fallback for future years if projection failed.
  if (rookieMin === undefined || rookieMin === 0) {
    throw new Error(
      `[CapRulesProfile] CRITICAL: Could not resolve rookieMin for ${seasonKey}. ` +
      `No entry in capProjections or CBA_THRESHOLDS, and projection failed.`
    );
  }

  // 3. Define Scale Lookup Function
  const getMinimumForYOS = (yos: number): number => {
    // Try explicit scale first
    const scale = getScaleForSeason(seasonKey as any); // Cast for SeasonId compatibility
    if (scale) {
      // Cap at 10 years
      const cappedYOS = Math.min(Math.max(0, yos), 10);
      return scale[cappedYOS] ?? scale[10]; // 10 is safest fallback for max
    }

    // Fallback if scale is missing:
    // For Rookie (0 YOS), use our resolved rookieMin
    if (yos === 0) {
      return rookieMin;
    }

    // For vets, usage of this fallback implies we don't know the veteran minimum.
    // We return rookieMin but warn.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[CapRulesProfile] Warning: Requested minimum salary for YOS ${yos} in ${seasonKey}, ` +
        `but no scale data exists. Returning rookie minimum (${rookieMin}).`
      );
    }
    return rookieMin;
  };

  return {
    yearKey,
    seasonKey,
    roster: {
      minStandard: ROSTER_REQUIREMENTS.MIN_STANDARD_ROSTER,
      maxStandard: ROSTER_REQUIREMENTS.MAX_STANDARD_ROSTER,
      maxTwoWay: ROSTER_REQUIREMENTS.MAX_TWO_WAY_CONTRACTS,
      graceMin: ROSTER_REQUIREMENTS.OFFSEASON_MIN_ROSTER,
    },
    cap: {
      salaryCap: capSettings.salaryCap,
      luxuryTax: capSettings.luxuryTax,
      firstApron: capSettings.firstApron,
      secondApron: capSettings.secondApron,
    },
    exceptions: {
      fullMLE: capSettings.fullMLE,
      taxpayerMLE: capSettings.taxpayerMLE,
      roomMLE: capSettings.roomMLE,
      bae: capSettings.bae,
    },
    salaries: {
      rookieMin,
      rookieMinSource: rookieMinSource as 'real' | 'projected', // Keep strict link to legacy prop if needed, or update interface
      getMinimumForYOS,
    },
    _meta: {
      source: 'CapRulesProfile',
      resolved: true,
      projectionMethod: projectionDetails || undefined,
      sourcesSummary: defaultSource, // Can be refined if mixed
      sources: {
        cap: {
          salaryCap: defaultSource,
          luxuryTax: defaultSource,
          firstApron: defaultSource,
          secondApron: defaultSource,
        },
        exceptions: {
          fullMLE: defaultSource,
          taxpayerMLE: defaultSource,
          roomMLE: defaultSource,
          bae: defaultSource,
        },
        salaries: {
          rookieMin: rookieMinSource,
        },
      },
    }
  };
}
