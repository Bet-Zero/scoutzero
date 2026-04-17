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
import { getScaleForSeason } from '../../data/minimumSalaryScales';

export type SourceTag = 'real' | 'reported' | 'projected' | 'unknown';
type ThresholdFieldPath =
  | `cap.${keyof CapLines}`
  | `exceptions.${keyof ExceptionAmounts}`
  | 'salaries.rookieMin';
type RookieMinResolver =
  | 'capSettings'
  | 'legacyThreshold'
  | 'previousYearCapGrowth'
  | 'previousYearFixedGrowth';

export interface CapRulesMeta {
  source: string;
  resolved: boolean;
  projectionMethod?: string;
  sourcesSummary: SourceTag;
  sourcesMixed: boolean;
  sourceTags: SourceTag[];
  fieldsBySource: Partial<Record<SourceTag, ThresholdFieldPath[]>>;
  provenance: {
    capSettingsSource: string;
    capSettingsTag: SourceTag;
    rookieMinResolver: RookieMinResolver;
    rookieMinBaseSeasonKey?: string;
  };
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

interface RookieMinimumResolution {
  rookieMin: number | null;
  sourceTag: SourceTag;
  salarySource: 'real' | 'projected';
  resolver: RookieMinResolver;
  baseSeasonKey?: string;
  projectionDetails?: string;
}

const CAP_SOURCE_FIELDS: Array<keyof CapLines> = [
  'salaryCap',
  'luxuryTax',
  'firstApron',
  'secondApron',
];

const EXCEPTION_SOURCE_FIELDS: Array<keyof ExceptionAmounts> = [
  'fullMLE',
  'taxpayerMLE',
  'roomMLE',
  'bae',
];

const SOURCE_SUMMARY_PRIORITY: SourceTag[] = [
  'unknown',
  'projected',
  'reported',
  'real',
];

function getCapSettingsSourceTag(settings: Record<string, unknown>): SourceTag {
  const metaSource = String(
    (settings._meta as { source?: unknown } | undefined)?.source ?? ''
  );

  if (
    metaSource.includes('CBA_CONSTANTS') &&
    metaSource.includes('emergency')
  ) {
    return 'unknown';
  }
  if (metaSource === 'projected_from_previous') {
    return 'projected';
  }
  if (metaSource.startsWith('provided_capSettings')) {
    return settings.confirmed === true ? 'reported' : 'projected';
  }
  if (metaSource.includes('CBA_CONSTANTS')) {
    return 'reported';
  }

  return settings.confirmed === true ? 'real' : 'projected';
}

function getRookieMinSourceTag(
  explicitSource: unknown,
  fallbackTag: SourceTag
): SourceTag {
  const normalized = String(explicitSource ?? '')
    .trim()
    .toLowerCase();

  if (
    normalized === 'real' ||
    normalized === 'reported' ||
    normalized === 'projected' ||
    normalized === 'unknown'
  ) {
    return normalized as SourceTag;
  }

  return fallbackTag === 'unknown' ? 'projected' : fallbackTag;
}

function resolveRookieMinimumForYear(
  yearKey: number,
  seasonKey: string,
  capSettings: Record<string, unknown>,
  customCapProjections?: CapProjectionOverrides | null
): RookieMinimumResolution {
  const capSettingsSourceTag = getCapSettingsSourceTag(capSettings);
  const directRookieMin = Number(capSettings.rookieMin ?? 0);

  if (directRookieMin > 0) {
    const sourceTag = getRookieMinSourceTag(
      capSettings.rookieMinSource,
      capSettingsSourceTag
    );

    return {
      rookieMin: directRookieMin,
      sourceTag,
      salarySource: sourceTag === 'projected' ? 'projected' : 'real',
      resolver: 'capSettings',
    };
  }

  const thresholdEntry =
    CBA_THRESHOLDS[seasonKey as keyof typeof CBA_THRESHOLDS];
  if (thresholdEntry?.MIN_SALARY_ROOKIE) {
    return {
      rookieMin: thresholdEntry.MIN_SALARY_ROOKIE,
      sourceTag: 'real',
      salarySource: 'real',
      resolver: 'legacyThreshold',
    };
  }

  try {
    const prevYearKey = yearKey - 1;
    if (prevYearKey < 2020) {
      throw new Error('Projection reached limit (2020)');
    }

    const prevRules = getCapRulesForYear(prevYearKey, customCapProjections);
    const prevRookieMin = prevRules.salaries.rookieMin;
    const prevCap = prevRules.cap.salaryCap;
    const currentCap = Number(capSettings.salaryCap ?? 0);

    if (prevRookieMin && prevCap && currentCap) {
      const ratio = currentCap / prevCap;
      return {
        rookieMin: Math.floor(prevRookieMin * ratio),
        sourceTag: 'projected',
        salarySource: 'projected',
        resolver: 'previousYearCapGrowth',
        baseSeasonKey: prevRules.seasonKey,
        projectionDetails: `Derived from ${prevRules.seasonKey} ($${prevRookieMin}) * CapGrowth (${ratio.toFixed(4)})`,
      };
    }

    return {
      rookieMin: Math.floor(prevRookieMin * 1.04),
      sourceTag: 'projected',
      salarySource: 'projected',
      resolver: 'previousYearFixedGrowth',
      baseSeasonKey: prevRules.seasonKey,
      projectionDetails: `Derived from ${prevRules.seasonKey} ($${prevRookieMin}) * FixedGrowth (1.04)`,
    };
  } catch (err) {
    console.warn(
      `[CapRulesProfile] Failed to project rookieMin for ${seasonKey}:`,
      err
    );
  }

  return {
    rookieMin: null,
    sourceTag: 'unknown',
    salarySource: 'projected',
    resolver: 'previousYearCapGrowth',
  };
}

function buildSourceMaps(
  capSettingsSourceTag: SourceTag,
  rookieMinSourceTag: SourceTag
): CapRulesMeta['sources'] {
  const cap = {} as Record<keyof CapLines, SourceTag>;
  for (const field of CAP_SOURCE_FIELDS) {
    cap[field] = capSettingsSourceTag;
  }

  const exceptions = {} as Record<keyof ExceptionAmounts, SourceTag>;
  for (const field of EXCEPTION_SOURCE_FIELDS) {
    exceptions[field] = capSettingsSourceTag;
  }

  return {
    cap,
    exceptions,
    salaries: {
      rookieMin: rookieMinSourceTag,
    },
  };
}

function summarizeSourceMaps(
  sources: CapRulesMeta['sources']
): Pick<
  CapRulesMeta,
  'sourcesSummary' | 'sourcesMixed' | 'sourceTags' | 'fieldsBySource'
> {
  const fieldsBySource: Partial<Record<SourceTag, ThresholdFieldPath[]>> = {};
  const pushField = (tag: SourceTag, field: ThresholdFieldPath) => {
    const existing = fieldsBySource[tag] ?? [];
    existing.push(field);
    fieldsBySource[tag] = existing;
  };

  for (const field of CAP_SOURCE_FIELDS) {
    pushField(sources.cap[field], `cap.${field}`);
  }

  for (const field of EXCEPTION_SOURCE_FIELDS) {
    pushField(sources.exceptions[field], `exceptions.${field}`);
  }

  pushField(sources.salaries.rookieMin, 'salaries.rookieMin');

  const sourceTags = SOURCE_SUMMARY_PRIORITY.filter(
    (tag) => (fieldsBySource[tag] ?? []).length > 0
  );

  return {
    sourcesSummary:
      SOURCE_SUMMARY_PRIORITY.find((tag) => sourceTags.includes(tag)) ??
      'unknown',
    sourcesMixed: sourceTags.length > 1,
    sourceTags,
    fieldsBySource,
  };
}

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
  const capSettings = getCapSettingsForYear(
    yearKey,
    projectionOverrides
  ) as Record<string, unknown>;
  const capSettingsSourceTag = getCapSettingsSourceTag(capSettings);

  // 2. Resolve Rookie Minimum
  // Primary Source: cap settings facade
  // Fallback 1: legacy per-season threshold constant
  // Fallback 2: previous-year projection tied to cap growth
  const rookieMinResolution = resolveRookieMinimumForYear(
    yearKey,
    seasonKey,
    capSettings,
    customCapProjections as CapProjectionOverrides | null | undefined
  );
  const rookieMin = rookieMinResolution.rookieMin;
  const rookieMinSource = rookieMinResolution.sourceTag;
  const projectionDetails = rookieMinResolution.projectionDetails;

  // STOP CONDITION: We do not silently fallback for future years if projection failed.
  if (rookieMin == null || rookieMin === 0) {
    throw new Error(
      `[CapRulesProfile] CRITICAL: Could not resolve rookieMin for ${seasonKey}. ` +
        `No entry in capProjections or CBA_THRESHOLDS, and projection failed.`
    );
  }

  const sources = buildSourceMaps(capSettingsSourceTag, rookieMinSource);
  const sourceSummary = summarizeSourceMaps(sources);

  // 3. Define Scale Lookup Function
  const getMinimumForYOS = (yos: number): number => {
    // Try explicit scale first
    const scale = getScaleForSeason(seasonKey);
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
      salaryCap: Number(capSettings.salaryCap ?? 0),
      luxuryTax: Number(capSettings.luxuryTax ?? 0),
      firstApron: Number(capSettings.firstApron ?? 0),
      secondApron: Number(capSettings.secondApron ?? 0),
    },
    exceptions: {
      fullMLE: Number(capSettings.fullMLE ?? 0),
      taxpayerMLE: Number(capSettings.taxpayerMLE ?? 0),
      roomMLE: Number(capSettings.roomMLE ?? 0),
      bae: Number(capSettings.bae ?? 0),
    },
    salaries: {
      rookieMin,
      rookieMinSource: rookieMinResolution.salarySource,
      getMinimumForYOS,
    },
    _meta: {
      source: 'CapRulesProfile',
      resolved: true,
      projectionMethod: projectionDetails || undefined,
      sourcesSummary: sourceSummary.sourcesSummary,
      sourcesMixed: sourceSummary.sourcesMixed,
      sourceTags: sourceSummary.sourceTags,
      fieldsBySource: sourceSummary.fieldsBySource,
      provenance: {
        capSettingsSource: String(
          (capSettings._meta as { source?: unknown } | undefined)?.source ??
            'unknown'
        ),
        capSettingsTag: capSettingsSourceTag,
        rookieMinResolver: rookieMinResolution.resolver,
        ...(rookieMinResolution.baseSeasonKey
          ? { rookieMinBaseSeasonKey: rookieMinResolution.baseSeasonKey }
          : {}),
      },
      sources,
    },
  };
}
