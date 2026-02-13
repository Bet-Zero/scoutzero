/**
 * FILE: src/features/architect/freeAgency/useFreeAgencyFilterPersistence.ts
 * PURPOSE: Persist Free Agency filter/search/sort state to localStorage so it
 *          survives tab switches and page refreshes.
 * OWNERSHIP: Feature: architect/freeAgency
 *
 * HISTORY:
 *  - 2026-02-13: Created for Free Agency UX P2 (results count + persisted filters).
 *
 * LINKS:
 *  - Master Doc: docs/architect/free_agency_MASTER.md
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  FREE_AGENCY_DEFAULT_FILTER_STATE,
  type FreeAgencyFilterState,
} from '@/shared/utils/filtering/freeAgencyFilterUtils';

// ── storage constants ────────────────────────────────────────────────
export const FA_FILTER_STORAGE_KEY = 'architect-free-agency-filters-v1';

// ── validation / parsing ─────────────────────────────────────────────

/** List of accepted values per field – anything outside these falls back. */
const VALID_POSITIONS = new Set(['', 'guard', 'wing', 'big']);
const VALID_AGE_BUCKETS = new Set(['', 'age_u24', 'age_25_29', 'age_30_plus']);
const VALID_SALARY_BUCKETS = new Set([
  '',
  'salary_lt_5m',
  'salary_5m_10m',
  'salary_10m_20m',
  'salary_gte_20m',
]);
const VALID_SORT_KEYS = new Set(['name_asc', 'salary_desc', 'age_asc']);

/**
 * Parse a raw value from localStorage into a valid FreeAgencyFilterState.
 * Returns defaults for any invalid / missing / corrupt data.
 */
export function parseFreeAgencyFilterState(
  raw: unknown
): FreeAgencyFilterState {
  const defaults = { ...FREE_AGENCY_DEFAULT_FILTER_STATE };

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults;

  const obj = raw as Record<string, unknown>;

  return {
    query: typeof obj.query === 'string' ? obj.query : defaults.query,
    position: VALID_POSITIONS.has(obj.position as string)
      ? (obj.position as FreeAgencyFilterState['position'])
      : defaults.position,
    ageBucket: VALID_AGE_BUCKETS.has(obj.ageBucket as string)
      ? (obj.ageBucket as FreeAgencyFilterState['ageBucket'])
      : defaults.ageBucket,
    salaryBucket: VALID_SALARY_BUCKETS.has(obj.salaryBucket as string)
      ? (obj.salaryBucket as FreeAgencyFilterState['salaryBucket'])
      : defaults.salaryBucket,
    sortBy: VALID_SORT_KEYS.has(obj.sortBy as string)
      ? (obj.sortBy as FreeAgencyFilterState['sortBy'])
      : defaults.sortBy,
  };
}

/**
 * Load persisted filter state from localStorage.
 * Returns defaults on any failure (missing key, corrupt JSON, invalid shape).
 */
export function loadPersistedFilters(): FreeAgencyFilterState {
  try {
    const stored = localStorage.getItem(FA_FILTER_STORAGE_KEY);
    if (stored === null) return { ...FREE_AGENCY_DEFAULT_FILTER_STATE };
    const parsed = JSON.parse(stored);
    return parseFreeAgencyFilterState(parsed);
  } catch {
    // Invalid JSON or storage error → overwrite with defaults
    try {
      localStorage.removeItem(FA_FILTER_STORAGE_KEY);
    } catch {
      // storage completely broken – ignore
    }
    return { ...FREE_AGENCY_DEFAULT_FILTER_STATE };
  }
}

/**
 * Save filter state to localStorage (non-throwing).
 */
export function savePersistedFilters(state: FreeAgencyFilterState): void {
  try {
    localStorage.setItem(FA_FILTER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded or storage disabled – silent
  }
}

/**
 * Remove persisted filter state entirely.
 */
export function clearPersistedFilters(): void {
  try {
    localStorage.removeItem(FA_FILTER_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ── React hook ───────────────────────────────────────────────────────

/**
 * React hook that wraps Free Agency filter state with localStorage
 * persistence. Restores on mount, persists on every change, and
 * resets storage on clear.
 */
export function useFreeAgencyFilterPersistence() {
  const [filterState, setFilterState] =
    useState<FreeAgencyFilterState>(loadPersistedFilters);

  // Persist to localStorage whenever filterState changes.
  // Use a ref to skip the initial render (already loaded from storage).
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    savePersistedFilters(filterState);
  }, [filterState]);

  const updateFilterState = useCallback(
    (patch: Partial<FreeAgencyFilterState>) =>
      setFilterState((prev) => ({ ...prev, ...patch })),
    []
  );

  const clearFilters = useCallback(() => {
    const defaults = { ...FREE_AGENCY_DEFAULT_FILTER_STATE };
    setFilterState(defaults);
    clearPersistedFilters();
  }, []);

  return { filterState, updateFilterState, clearFilters } as const;
}
