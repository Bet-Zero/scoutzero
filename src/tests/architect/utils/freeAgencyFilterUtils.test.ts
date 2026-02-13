/**
 * FILE: src/tests/architect/utils/freeAgencyFilterUtils.test.ts
 * PURPOSE: Guard Free Agency search/filter/sort utility behavior.
 * OWNERSHIP: Feature: architect/freeAgency
 *
 * HISTORY:
 *  - 2026-02-13: Created for Free Agency filters/search execution.
 */
import { describe, expect, it } from 'vitest';
import {
  applyFreeAgencyFilters,
  FREE_AGENCY_DEFAULT_FILTER_STATE,
} from '@/shared/utils/filtering/freeAgencyFilterUtils';

const FIXTURE_FREE_AGENTS = [
  {
    id: 'fa-1',
    name: 'Alex Guard',
    teamCode: 'LAL',
    teamName: 'Los Angeles Lakers',
    position: 'Point Guard',
    age: 22,
    previousSalary: 3_200_000,
  },
  {
    id: 'fa-2',
    name: 'Bruno Wing',
    teamCode: 'BOS',
    teamName: 'Boston Celtics',
    position: 'Small Forward',
    age: 27,
    previousSalary: 7_500_000,
  },
  {
    id: 'fa-3',
    name: 'Carter Big',
    teamCode: 'NYK',
    teamName: 'New York Knicks',
    position: 'Center',
    age: 31,
    previousSalary: 12_000_000,
  },
  {
    id: 'fa-4',
    name: 'Dario Veteran',
    teamCode: 'MIA',
    teamName: 'Miami Heat',
    position: 'Power Forward',
    age: 34,
    previousSalary: 24_000_000,
  },
  {
    id: 'fa-5',
    name: 'Emilé Guard',
    teamCode: 'DAL',
    teamName: 'Dallas Mavericks',
    position: 'Shooting Guard',
    age: null,
    previousSalary: null,
  },
];

describe('freeAgencyFilterUtils', () => {
  it('defaults to salary high->low ordering', () => {
    const result = applyFreeAgencyFilters(
      FIXTURE_FREE_AGENTS,
      FREE_AGENCY_DEFAULT_FILTER_STATE
    );
    expect(result.map((player) => player.name)).toEqual([
      'Dario Veteran',
      'Carter Big',
      'Bruno Wing',
      'Alex Guard',
      'Emilé Guard',
    ]);
  });

  it('matches search query case-insensitively across player/team/position text', () => {
    const result = applyFreeAgencyFilters(FIXTURE_FREE_AGENTS, {
      query: 'new center',
    });

    expect(result.map((player) => player.name)).toEqual(['Carter Big']);
  });

  it('filters by position bucket', () => {
    const result = applyFreeAgencyFilters(FIXTURE_FREE_AGENTS, {
      position: 'guard',
    });

    expect(result.map((player) => player.name)).toEqual([
      'Alex Guard',
      'Emilé Guard',
    ]);
  });

  it('normalizes accented names for search matching', () => {
    const result = applyFreeAgencyFilters(FIXTURE_FREE_AGENTS, {
      query: 'emile',
    });

    expect(result.map((player) => player.name)).toEqual(['Emilé Guard']);
  });

  it('filters by age bucket and excludes missing ages when bucket is active', () => {
    const result = applyFreeAgencyFilters(FIXTURE_FREE_AGENTS, {
      ageBucket: 'age_25_29',
    });

    expect(result.map((player) => player.name)).toEqual(['Bruno Wing']);
  });

  it('filters by salary bucket and excludes missing salaries when bucket is active', () => {
    const result = applyFreeAgencyFilters(FIXTURE_FREE_AGENTS, {
      salaryBucket: 'salary_10m_20m',
    });

    expect(result.map((player) => player.name)).toEqual(['Carter Big']);
  });

  it('supports age low->high sort with missing ages placed last', () => {
    const result = applyFreeAgencyFilters(FIXTURE_FREE_AGENTS, {
      sortBy: 'age_asc',
    });

    expect(result.map((player) => player.name)).toEqual([
      'Alex Guard',
      'Bruno Wing',
      'Carter Big',
      'Dario Veteran',
      'Emilé Guard',
    ]);
  });
});
