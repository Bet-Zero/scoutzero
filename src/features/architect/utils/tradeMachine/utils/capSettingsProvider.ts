/**
 * FILE: src/features/architect/utils/tradeMachine/utils/capSettingsProvider.ts
 * PURPOSE: Single source of truth for cap settings resolution.
 *          All trade validation and UI calculations should use this module
 *          to ensure consistent cap settings across the application.
 * OWNERSHIP: Feature: architect (Trade Machine - Cap Settings)
 *
 * HISTORY:
 *  - 2025-12-27: Phase 4 - Created as single source for cap settings resolution
 *                Eliminates silent defaults throughout the codebase
 */

import capProjectionsData from '@/features/architect/utils/capProjections';
import {
  getCapYearData,
  normalizeSeasonKey,
} from '@/features/architect/data/capYearData';

type CapYearInput = string | number | null | undefined;

interface CapProjectionEntry {
  cap?: number | null;
  salaryCap?: number | null;
  firstApron?: number | null;
  apron?: number | null;
  secondApron?: number | null;
  tax?: number | null;
  luxuryTax?: number | null;
  bae?: number | null;
  roomMLE?: number | null;
  fullMLE?: number | null;
  mle?: number | null;
  taxpayerMLE?: number | null;
  floor?: number | null;
  rookieMin?: number | null;
  rookieMinSource?: string | null;
  growthRate?: number | null;
  confirmed?: boolean | null;
  [key: string]: unknown;
}

type CapProjectionMap = Record<string, CapProjectionEntry | null | undefined>;
type CapProjectionSource = Record<string, unknown> | null | undefined;

interface NormalizedCapSettings {
  salaryCap: number;
  firstApron: number;
  secondApron: number;
  luxuryTax: number;
  bae: number;
  roomMLE: number;
  fullMLE: number;
  taxpayerMLE: number;
  floor?: number;
  rookieMin?: number;
  rookieMinSource?: string | null;
  growthRate?: number;
  confirmed?: boolean;
  [key: string]: unknown;
}

export type ExceptionDefaultType = 'mle' | 'tpmle' | 'bae' | 'room';

export type ExceptionDefaultCapSettings = Pick<
  NormalizedCapSettings,
  'fullMLE' | 'taxpayerMLE' | 'bae' | 'roomMLE'
>;

interface GetCapSettingsParams {
  year: CapYearInput;
  capProjections?: CapProjectionSource;
  providedCapSettings?: Record<string, unknown> | null;
  strict?: boolean;
}

interface CapSettingsResolutionResult {
  settings: NormalizedCapSettings;
  source: string;
  warnings: string[];
  resolved: boolean;
  year: number;
  seasonKey: string;
}

interface CapSettingsWithMeta extends NormalizedCapSettings {
  _meta: {
    source: string;
    warnings: string[];
    seasonKey: string;
    resolved: boolean;
  };
}

interface CapSettingsValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

interface GetCapSettingsForReceiptParams {
  yearKey: CapYearInput;
  capProjections?: CapProjectionSource;
  contextCapSettings?: Record<string, unknown> | null;
}

interface CapSettingsReceiptResult {
  capSettingsUsed: {
    salaryCap: number;
    firstApron: number;
    secondApron: number;
    luxuryTax: number;
  };
  capSettingsSource: string;
  capSettingsWarnings: string[];
  seasonKey: string;
}

export const CAP_SETTINGS_VERSION = '1.0.0';

const MIN_VALID_YEAR = 2020;
const MAX_VALID_YEAR = 2040;

export const CAP_SETTINGS_SOURCE_KEYS = {
  PROJECTIONS: 'capProjections',
  PROJECTIONS_FALLBACK: 'capProjections_fallback',
  PROVIDED: 'provided_capSettings',
  CBA_CONSTANTS: 'CBA_CONSTANTS_fallback',
  MISSING: 'MISSING_NO_DATA',
} as const;

const EMERGENCY_FALLBACK_2024_25 = Object.freeze<NormalizedCapSettings>({
  salaryCap: 141_000_000,
  firstApron: 179_000_000,
  secondApron: 190_000_000,
  luxuryTax: 171_000_000,
  bae: 4_700_000,
  roomMLE: 8_000_000,
  fullMLE: 12_900_000,
  taxpayerMLE: 5_000_000,
});

const defaultCapProjections = capProjectionsData as CapProjectionMap;

function toNonNegativeAmount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, parsed);
}

export function getExceptionDefaultAmountFromCapSettings(
  type: ExceptionDefaultType,
  capSettings: Partial<ExceptionDefaultCapSettings> | null | undefined
): number {
  if (!capSettings || typeof capSettings !== 'object') {
    return 0;
  }

  switch (type) {
    case 'mle':
      return toNonNegativeAmount(capSettings.fullMLE);
    case 'tpmle':
      return toNonNegativeAmount(capSettings.taxpayerMLE);
    case 'bae':
      return toNonNegativeAmount(capSettings.bae);
    case 'room':
      return toNonNegativeAmount(capSettings.roomMLE);
    default:
      return 0;
  }
}

export function yearToSeasonKey(year: CapYearInput): string | null {
  if (typeof year === 'string' && year.includes('-')) {
    return year;
  }

  const endYear = Number(year);
  if (
    !Number.isFinite(endYear) ||
    endYear < MIN_VALID_YEAR ||
    endYear > MAX_VALID_YEAR
  ) {
    return null;
  }

  return `${endYear - 1}-${String(endYear).slice(-2)}`;
}

function normalizeCapEntry(rawEntry: unknown): NormalizedCapSettings | null {
  if (!rawEntry || typeof rawEntry !== 'object') {
    return null;
  }

  const entry = rawEntry as CapProjectionEntry;

  return {
    salaryCap: Number(entry.cap ?? entry.salaryCap ?? 0),
    firstApron: Number(entry.firstApron ?? entry.apron ?? 0),
    secondApron: Number(entry.secondApron ?? 0),
    luxuryTax: Number(entry.tax ?? entry.luxuryTax ?? 0),
    bae: Number(entry.bae ?? 0),
    roomMLE: Number(entry.roomMLE ?? 0),
    fullMLE: Number(entry.fullMLE ?? entry.mle ?? 0),
    taxpayerMLE: Number(entry.taxpayerMLE ?? 0),
    floor: Number(entry.floor ?? 0),
    rookieMin: Number(entry.rookieMin ?? 0),
    rookieMinSource: entry.rookieMinSource,
    growthRate: Number(entry.growthRate ?? 0),
    confirmed: Boolean(entry.confirmed ?? false),
  };
}

export function getCapSettings({
  year,
  capProjections = null,
  providedCapSettings = null,
  strict = false,
}: GetCapSettingsParams): CapSettingsResolutionResult {
  const warnings: string[] = [];
  let settings: NormalizedCapSettings | null = null;
  let source: string = CAP_SETTINGS_SOURCE_KEYS.MISSING;
  let resolved = false;

  const seasonKey =
    year === null || year === undefined ? null : normalizeSeasonKey(year);

  if (!seasonKey) {
    if (strict) {
      throw new Error(`[CapSettingsProvider] FATAL: Invalid year input: ${year}`);
    }

    return {
      settings: { ...EMERGENCY_FALLBACK_2024_25 },
      source: `${CAP_SETTINGS_SOURCE_KEYS.CBA_CONSTANTS}_2024-25_invalid_input`,
      warnings: ['CRITICAL: Invalid season input. Using 2024-25 emergency fallback.'],
      resolved: true,
      year: 2025,
      seasonKey: '2024-25',
    };
  }

  const resolvedYear = Number(seasonKey.split('-')[0]) + 1;
  const yearInfo = getCapYearData(seasonKey);
  const isProjectedYear = yearInfo.type === 'PROJECTED';
  const providedCapProjectionMap =
    capProjections && typeof capProjections === 'object' ? capProjections : null;
  const providedSettings =
    providedCapSettings && typeof providedCapSettings === 'object'
      ? providedCapSettings
      : null;

  if (providedSettings) {
    const normalized = normalizeCapEntry(providedSettings);
    if (normalized && normalized.salaryCap > 0 && normalized.firstApron > 0) {
      settings = normalized;
      source = CAP_SETTINGS_SOURCE_KEYS.PROVIDED;
      resolved = true;
    }
  }

  if (!resolved && providedCapProjectionMap) {
    const entry = providedCapProjectionMap[seasonKey];
    if (entry) {
      const normalized = normalizeCapEntry(entry);
      if (normalized && normalized.salaryCap > 0) {
        settings = normalized;
        source = `${CAP_SETTINGS_SOURCE_KEYS.PROJECTIONS}[${seasonKey}]`;
        resolved = true;

        if (!normalized.confirmed || isProjectedYear) {
          warnings.push(
            `Cap values for ${seasonKey} are projected (${isProjectedYear ? 'Future Year' : 'Unconfirmed'})`
          );
        }
      }
    }
  }

  if (!resolved) {
    const entry = defaultCapProjections[seasonKey];
    if (entry) {
      const normalized = normalizeCapEntry(entry);
      if (normalized && normalized.salaryCap > 0) {
        settings = normalized;
        source = `${CAP_SETTINGS_SOURCE_KEYS.PROJECTIONS}[${seasonKey}]`;
        resolved = true;

        if (!normalized.confirmed || isProjectedYear) {
          warnings.push(
            `Cap values for ${seasonKey} are projected (${isProjectedYear ? 'Future Year' : 'Unconfirmed'})`
          );
        }
      }
    }
  }

  if (!resolved) {
    const prevSeasonKey = normalizeSeasonKey(resolvedYear - 1);
    const prevEntry = prevSeasonKey
      ? providedCapProjectionMap?.[prevSeasonKey] ||
        defaultCapProjections[prevSeasonKey]
      : null;

    if (prevEntry) {
      const normalizedPrev = normalizeCapEntry(prevEntry);
      if (normalizedPrev && normalizedPrev.salaryCap > 0) {
        settings = normalizedPrev;
        source = 'projected_from_previous';
        resolved = true;
        warnings.push(
          `No data for ${seasonKey}. Projected using ${prevSeasonKey} values as baseline.`
        );
      }
    }
  }

  if (!resolved) {
    if (strict) {
      throw new Error(
        `[CapSettingsProvider] FATAL: No cap settings available for year ${resolvedYear} (${seasonKey}).`
      );
    }

    settings = { ...EMERGENCY_FALLBACK_2024_25 };
    source = `${CAP_SETTINGS_SOURCE_KEYS.CBA_CONSTANTS}_2024-25_emergency`;
    resolved = true;
    warnings.push(
      `CRITICAL: No cap data found for ${seasonKey}. Using 2024-25 emergency fallback values.`
    );
  }

  return {
    settings: settings || { ...EMERGENCY_FALLBACK_2024_25 },
    source,
    warnings,
    resolved,
    year: resolvedYear,
    seasonKey,
  };
}

export function getCapSettingsForYear(
  year: CapYearInput,
  capProjections: CapProjectionSource = null
): CapSettingsWithMeta {
  const result = getCapSettings({ year, capProjections });

  return {
    ...result.settings,
    _meta: {
      source: result.source,
      warnings: result.warnings,
      seasonKey: result.seasonKey,
      resolved: result.resolved,
    },
  };
}

export function validateCapSettings(
  capSettings: Record<string, unknown> | null | undefined
): CapSettingsValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!capSettings || typeof capSettings !== 'object') {
    return {
      passed: false,
      errors: ['Cap settings are null or undefined'],
      warnings: [],
    };
  }

  const {
    salaryCap = 0,
    firstApron = 0,
    secondApron = 0,
  } = capSettings as CapProjectionEntry;

  if (!salaryCap || Number(salaryCap) <= 0) {
    errors.push('salaryCap is missing or invalid');
  }
  if (!firstApron || Number(firstApron) <= 0) {
    errors.push('firstApron is missing or invalid');
  }
  if (!secondApron || Number(secondApron) <= 0) {
    errors.push('secondApron is missing or invalid');
  }

  if (
    Number(salaryCap) > 0 &&
    (Number(salaryCap) < 100_000_000 || Number(salaryCap) > 350_000_000)
  ) {
    warnings.push(`salaryCap (${salaryCap}) outside typical range`);
  }
  if (Number(firstApron) > 0 && Number(firstApron) <= Number(salaryCap)) {
    warnings.push(
      `firstApron (${firstApron}) should be greater than salaryCap (${salaryCap})`
    );
  }
  if (
    Number(secondApron) > 0 &&
    Number(secondApron) <= Number(firstApron)
  ) {
    warnings.push(
      `secondApron (${secondApron}) should be greater than firstApron (${firstApron})`
    );
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

export function getCapSettingsForReceipt({
  yearKey,
  capProjections,
  contextCapSettings,
}: GetCapSettingsForReceiptParams): CapSettingsReceiptResult {
  const result = getCapSettings({
    year: yearKey,
    capProjections,
    providedCapSettings: contextCapSettings ?? null,
  });

  return {
    capSettingsUsed: {
      salaryCap: result.settings.salaryCap,
      firstApron: result.settings.firstApron,
      secondApron: result.settings.secondApron,
      luxuryTax: result.settings.luxuryTax,
    },
    capSettingsSource: result.source,
    capSettingsWarnings: result.warnings,
    seasonKey: result.seasonKey,
  };
}

export default {
  getCapSettings,
  getCapSettingsForYear,
  validateCapSettings,
  getCapSettingsForReceipt,
  CAP_SETTINGS_VERSION,
  CAP_SETTINGS_SOURCE_KEYS,
};
