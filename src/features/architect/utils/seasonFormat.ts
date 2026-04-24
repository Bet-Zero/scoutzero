/**
 * FILE: src/features/architect/utils/seasonFormat.ts
 * PURPOSE: Authoritative season format conversion helpers for Architect utilities.
 * OWNERSHIP: Feature: architect/utils
 *
 * HISTORY:
 *  - 2026-03-12: Migrated authoritative implementation to TypeScript for E59.
 */

// SeasonValue accepts anything; functions use Number() coercion internally so all inputs are safe
type SeasonValue = any; // load-bearing: callers pass unknown values; intent is number|string|null|undefined
type CapProjectionsLike = Record<string, unknown> | null | undefined;

export type SeasonAdvanceDraftContext = {
  authoritativeSeason: string;
  nextUsedDraftYear: number;
  nextSeason: string;
};

export function toSeasonCode(endYear: SeasonValue) {
  const numericEndYear = Number(endYear);

  if (!Number.isFinite(numericEndYear) || numericEndYear < 1900) {
    return String(endYear);
  }

  const startYear = numericEndYear - 1;
  return `${startYear}-${String(numericEndYear).slice(-2)}`;
}

export function toEndYear(seasonCode: SeasonValue) {
  const s = String(seasonCode);

  if (/^\d{4}-\d{2}$/.test(s)) {
    const tail = parseInt(s.split('-')[1], 10);
    return 2000 + tail;
  }

  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export function getDraftYearForSeasonAdvance(seasonCode: SeasonValue) {
  return getSeasonAdvanceDraftContext(seasonCode)?.nextUsedDraftYear ?? null;
}

export function getSeasonAdvanceDraftContext(
  seasonCode: SeasonValue
): SeasonAdvanceDraftContext | null {
  const endYear = toEndYear(seasonCode);

  if (typeof endYear !== 'number' || !Number.isFinite(endYear) || endYear < 1900) {
    return null;
  }

  return {
    authoritativeSeason: toSeasonCode(endYear),
    nextUsedDraftYear: endYear,
    nextSeason: toSeasonCode(endYear + 1),
  };
}

export function parseSeason(seasonOrYear: SeasonValue) {
  if (typeof seasonOrYear === 'string' && /^\d{4}-\d{2}$/.test(seasonOrYear)) {
    return seasonOrYear;
  }

  const endYear =
    typeof seasonOrYear === 'number'
      ? seasonOrYear
      : parseInt(String(seasonOrYear), 10);

  if (Number.isFinite(endYear) && endYear >= 1900) {
    return toSeasonCode(endYear);
  }

  return String(seasonOrYear);
}

export function getDefaultSeasonEndYear(date = new Date()) {
  const y = date.getFullYear();
  return date.getMonth() >= 6 ? y + 1 : y;
}

export function toSeasonKey(endYear: SeasonValue) {
  return toSeasonCode(endYear);
}

export function seasonEndYearsFromCaps(capProjections: CapProjectionsLike) {
  const keys = Object.keys((capProjections as Record<string, unknown>) || {});
  const years = keys
    .map((k) => {
      if (/^\d{4}-\d{2}$/.test(k)) {
        const [startYear, endYearSuffix] = k.split('-');
        const startYearNum = parseInt(startYear, 10);
        const tail = parseInt(endYearSuffix, 10);
        const century =
          tail < startYearNum % 100
            ? Math.floor(startYearNum / 100) + 1
            : Math.floor(startYearNum / 100);
        return century * 100 + tail;
      }

      const num = parseInt(k, 10);
      return Number.isFinite(num) ? num : null;
    })
    .filter(Boolean) as number[];

  if (years.length === 0) {
    const def = getDefaultSeasonEndYear();
    return [def - 1, def, def + 1];
  }

  return years.sort((a, b) => a - b);
}
