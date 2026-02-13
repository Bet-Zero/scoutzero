/**
 * FILE: src/tests/architect/utils/freeAgencyFilterPersistence.test.ts
 * PURPOSE: Guard Free Agency filter persistence parsing, load, save, and clear behavior.
 * OWNERSHIP: Feature: architect/freeAgency
 *
 * HISTORY:
 *  - 2026-02-13: Created for Free Agency UX P2 (results count + persisted filters).
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  parseFreeAgencyFilterState,
  loadPersistedFilters,
  savePersistedFilters,
  clearPersistedFilters,
  FA_FILTER_STORAGE_KEY,
} from '@/features/architect/freeAgency/useFreeAgencyFilterPersistence';
import { FREE_AGENCY_DEFAULT_FILTER_STATE } from '@/shared/utils/filtering/freeAgencyFilterUtils';

// ── parseFreeAgencyFilterState ────────────────────────────────────────

describe('parseFreeAgencyFilterState', () => {
  it('returns defaults for null input', () => {
    expect(parseFreeAgencyFilterState(null)).toEqual(
      FREE_AGENCY_DEFAULT_FILTER_STATE
    );
  });

  it('returns defaults for non-object input (string)', () => {
    expect(parseFreeAgencyFilterState('bad')).toEqual(
      FREE_AGENCY_DEFAULT_FILTER_STATE
    );
  });

  it('returns defaults for array input', () => {
    expect(parseFreeAgencyFilterState([1, 2])).toEqual(
      FREE_AGENCY_DEFAULT_FILTER_STATE
    );
  });

  it('returns defaults for empty object', () => {
    expect(parseFreeAgencyFilterState({})).toEqual(
      FREE_AGENCY_DEFAULT_FILTER_STATE
    );
  });

  it('preserves valid fields and falls back invalid fields to defaults', () => {
    const result = parseFreeAgencyFilterState({
      query: 'lebron',
      position: 'invalid_bucket',
      ageBucket: 'age_25_29',
      salaryBucket: 'salary_gte_20m',
      sortBy: 'bogus',
    });
    expect(result).toEqual({
      query: 'lebron',
      position: '', // invalid → default
      ageBucket: 'age_25_29',
      salaryBucket: 'salary_gte_20m',
      sortBy: 'salary_desc', // invalid → default
    });
  });

  it('accepts all valid position values', () => {
    for (const pos of ['', 'guard', 'wing', 'big']) {
      const result = parseFreeAgencyFilterState({ position: pos });
      expect(result.position).toBe(pos);
    }
  });

  it('accepts all valid sort keys', () => {
    for (const key of ['name_asc', 'salary_desc', 'age_asc']) {
      const result = parseFreeAgencyFilterState({ sortBy: key });
      expect(result.sortBy).toBe(key);
    }
  });

  it('rejects non-string query values', () => {
    const result = parseFreeAgencyFilterState({ query: 42 });
    expect(result.query).toBe('');
  });
});

// ── localStorage round-trip ──────────────────────────────────────────

describe('localStorage persistence helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('loadPersistedFilters returns defaults when key is absent', () => {
    expect(loadPersistedFilters()).toEqual(FREE_AGENCY_DEFAULT_FILTER_STATE);
  });

  it('savePersistedFilters persists state and loadPersistedFilters reads it back', () => {
    const state = {
      query: 'curry',
      position: 'guard' as const,
      ageBucket: 'age_25_29' as const,
      salaryBucket: 'salary_gte_20m' as const,
      sortBy: 'name_asc' as const,
    };
    savePersistedFilters(state);
    expect(loadPersistedFilters()).toEqual(state);
  });

  it('clearPersistedFilters removes the key so load returns defaults', () => {
    savePersistedFilters({
      ...FREE_AGENCY_DEFAULT_FILTER_STATE,
      query: 'removed',
    });
    clearPersistedFilters();
    expect(loadPersistedFilters()).toEqual(FREE_AGENCY_DEFAULT_FILTER_STATE);
    expect(localStorage.getItem(FA_FILTER_STORAGE_KEY)).toBeNull();
  });

  it('loadPersistedFilters falls back to defaults on invalid JSON', () => {
    localStorage.setItem(FA_FILTER_STORAGE_KEY, '{bad json!!!');
    const result = loadPersistedFilters();
    expect(result).toEqual(FREE_AGENCY_DEFAULT_FILTER_STATE);
    // key should have been removed on corrupt data
    expect(localStorage.getItem(FA_FILTER_STORAGE_KEY)).toBeNull();
  });

  it('loadPersistedFilters falls back to defaults when stored value is not an object', () => {
    localStorage.setItem(FA_FILTER_STORAGE_KEY, '"just a string"');
    expect(loadPersistedFilters()).toEqual(FREE_AGENCY_DEFAULT_FILTER_STATE);
  });

  it('loadPersistedFilters normalizes unknown field values to defaults', () => {
    localStorage.setItem(
      FA_FILTER_STORAGE_KEY,
      JSON.stringify({
        query: 'valid',
        position: 'point_guard', // unknown
        ageBucket: '',
        salaryBucket: '',
        sortBy: 'salary_desc',
      })
    );
    const result = loadPersistedFilters();
    expect(result.query).toBe('valid');
    expect(result.position).toBe(''); // normalized to default
  });

  it('savePersistedFilters is silent when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    // Should not throw
    expect(() =>
      savePersistedFilters(FREE_AGENCY_DEFAULT_FILTER_STATE)
    ).not.toThrow();
  });
});
