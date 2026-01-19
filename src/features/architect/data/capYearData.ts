/**
 * FILE: src/features/architect/data/capYearData.ts
 * PURPOSE: Single source of truth for Cap Year classification (REAL vs PROJECTED).
 *          Defines which years have authoritative hard data versus allowed projections.
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2026-01-18: Created for Phase 11 (Year Coverage Policy)
 */

export type CapYearType = 'REAL' | 'PROJECTED';

export interface CapYearInfo {
  type: CapYearType;
  seasonKey: string; // e.g. "2024-25"
  notes?: string;
}

/**
 * Registry of supported cap years and their data confidence status.
 */
export const CAP_YEAR_DATA: Record<string, CapYearInfo> = {
  '2019-20': { type: 'REAL', seasonKey: '2019-20' },
  '2020-21': { type: 'REAL', seasonKey: '2020-21' },
  '2021-22': { type: 'REAL', seasonKey: '2021-22' },
  '2022-23': { type: 'REAL', seasonKey: '2022-23' },
  '2023-24': { type: 'REAL', seasonKey: '2023-24' },
  '2024-25': { type: 'REAL', seasonKey: '2024-25' },
  // Future years are implicitly PROJECTED if not listed here as REAL
};

/**
 * Get data classification for a season.
 * @param seasonKey - e.g. "2024-25"
 */
export function getCapYearData(seasonKey: string): CapYearInfo {
  if (CAP_YEAR_DATA[seasonKey]) {
    return CAP_YEAR_DATA[seasonKey];
  }
  
  // Implicitly PROJECTED for future-looking valid strings
  return {
    type: 'PROJECTED',
    seasonKey,
    notes: 'Future tax year; utilizing projections.',
  };
}

/**
 * Helper to check if a season has REAL authoritative data.
 */
export function isRealSeason(seasonKey: string): boolean {
  return CAP_YEAR_DATA[seasonKey]?.type === 'REAL';
}

/**
 * Canonical helper to normalize year input to season key.
 * Supports: 2025 (number), "2025" (string), "2024-25" (string)
 */
export function normalizeSeasonKey(input: string | number): string | null {
  if (!input) return null;
  
  // Handle "2024-25" format
  if (typeof input === 'string' && input.includes('-')) {
    return input;
  }
  
  // Handle 2025 / "2025" -> "2024-25"
  const year = Number(input);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return null;
  }
  
  return `${year - 1}-${String(year).slice(-2)}`;
}
