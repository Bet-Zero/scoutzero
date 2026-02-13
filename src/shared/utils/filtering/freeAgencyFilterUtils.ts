/**
 * FILE: src/shared/utils/filtering/freeAgencyFilterUtils.ts
 * PURPOSE: Shared search/filter/sort helpers for Architect Free Agency pool UI.
 * OWNERSHIP: Feature: architect/freeAgency + shared filtering utils
 *
 * HISTORY:
 *  - 2026-02-13: Created for Free Agency tab filters/search/sort execution.
 *
 * LINKS:
 *  - Master Doc: docs/architect/free_agency_MASTER.md
 */
import { getPlayerPositionLabel } from '@/shared/utils/roles';

interface FreeAgencyPlayerLike {
  id?: string;
  player_id?: string;
  name?: string;
  displayName?: string;
  teamCode?: string;
  teamName?: string;
  position?: string;
  formattedPosition?: string;
  age?: number | string | null;
  previousSalary?: number | string | null;
  askingSalary?: number | string | null;
  currentContractView?: {
    currentSalary?: number | string | null;
  };
  bio?: {
    playerId?: string;
    displayName?: string;
    age?: number | string | null;
    position?: string;
    display?: {
      teamId?: string;
      team?: string;
    };
  };
  [key: string]: unknown;
}

export type FreeAgencyPositionFilter = '' | 'guard' | 'wing' | 'big';
export type FreeAgencyAgeBucket =
  | ''
  | 'age_u24'
  | 'age_25_29'
  | 'age_30_plus';
export type FreeAgencySalaryBucket =
  | ''
  | 'salary_lt_5m'
  | 'salary_5m_10m'
  | 'salary_10m_20m'
  | 'salary_gte_20m';
export type FreeAgencySortKey = 'name_asc' | 'salary_desc' | 'age_asc';

export interface FreeAgencyFilterState {
  query: string;
  position: FreeAgencyPositionFilter;
  ageBucket: FreeAgencyAgeBucket;
  salaryBucket: FreeAgencySalaryBucket;
  sortBy: FreeAgencySortKey;
}

export interface FreeAgencyFilterOption<T extends string> {
  value: T;
  label: string;
}

export const FREE_AGENCY_DEFAULT_FILTER_STATE: FreeAgencyFilterState = {
  query: '',
  position: '',
  ageBucket: '',
  salaryBucket: '',
  sortBy: 'salary_desc',
};

export const FREE_AGENCY_POSITION_OPTIONS: Array<
  FreeAgencyFilterOption<Exclude<FreeAgencyPositionFilter, ''>>
> = [
  { value: 'guard', label: 'Guard' },
  { value: 'wing', label: 'Wing' },
  { value: 'big', label: 'Big' },
];

export const FREE_AGENCY_AGE_BUCKET_OPTIONS: Array<
  FreeAgencyFilterOption<Exclude<FreeAgencyAgeBucket, ''>>
> = [
  { value: 'age_u24', label: '<=24' },
  { value: 'age_25_29', label: '25-29' },
  { value: 'age_30_plus', label: '30+' },
];

export const FREE_AGENCY_SALARY_BUCKET_OPTIONS: Array<
  FreeAgencyFilterOption<Exclude<FreeAgencySalaryBucket, ''>>
> = [
  { value: 'salary_lt_5m', label: '<$5M' },
  { value: 'salary_5m_10m', label: '$5M-$10M' },
  { value: 'salary_10m_20m', label: '$10M-$20M' },
  { value: 'salary_gte_20m', label: '$20M+' },
];

export const FREE_AGENCY_SORT_OPTIONS: Array<
  FreeAgencyFilterOption<FreeAgencySortKey>
> = [
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'salary_desc', label: 'Salary high->low' },
  { value: 'age_asc', label: 'Age low->high' },
];

const normalizeSearchText = (value: unknown): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const toSearchTokens = (query: string): string[] =>
  normalizeSearchText(query)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const getPlayerName = (player: FreeAgencyPlayerLike): string =>
  player?.name || player?.displayName || player?.bio?.displayName || '';

const getPlayerId = (player: FreeAgencyPlayerLike): string =>
  player?.id || player?.player_id || player?.bio?.playerId || '';

const getPlayerAge = (player: FreeAgencyPlayerLike): number | null =>
  toNumberOrNull(player?.age ?? player?.bio?.age);

const getPlayerSalary = (player: FreeAgencyPlayerLike): number | null =>
  toNumberOrNull(
    player?.previousSalary ??
      player?.askingSalary ??
      player?.currentContractView?.currentSalary
  );

const getPlayerPositionCode = (player: FreeAgencyPlayerLike): string => {
  const rawPosition =
    player?.bio?.position || player?.position || player?.formattedPosition || '';
  const label = getPlayerPositionLabel(rawPosition) || rawPosition;
  return String(label || '').toUpperCase().replace(/\s+/g, '');
};

const getPositionBucket = (
  player: FreeAgencyPlayerLike
): Exclude<FreeAgencyPositionFilter, ''> | '' => {
  const code = getPlayerPositionCode(player);
  if (!code) return '';
  if (code.includes('C') || code === 'PF' || code === 'F/C' || code === 'C/F')
    return 'big';
  if (code.includes('G')) return 'guard';
  if (code.includes('F')) return 'wing';
  return '';
};

const matchesSearch = (
  player: FreeAgencyPlayerLike,
  query: string
): boolean => {
  const tokens = toSearchTokens(query);
  if (tokens.length === 0) return true;

  const searchableText = normalizeSearchText(
    [
      getPlayerName(player),
      player?.teamCode,
      player?.teamName,
      player?.bio?.display?.teamId,
      player?.bio?.display?.team,
      player?.position,
      player?.bio?.position,
      getPlayerPositionCode(player),
    ]
      .filter(Boolean)
      .join(' ')
  );

  return tokens.every((token) => searchableText.includes(token));
};

const matchesPositionBucket = (
  player: FreeAgencyPlayerLike,
  bucket: FreeAgencyPositionFilter
): boolean => {
  if (!bucket) return true;
  return getPositionBucket(player) === bucket;
};

const matchesAgeBucket = (
  player: FreeAgencyPlayerLike,
  ageBucket: FreeAgencyAgeBucket
): boolean => {
  if (!ageBucket) return true;
  const age = getPlayerAge(player);
  if (age === null) return false;

  switch (ageBucket) {
    case 'age_u24':
      return age <= 24;
    case 'age_25_29':
      return age >= 25 && age <= 29;
    case 'age_30_plus':
      return age >= 30;
    default:
      return true;
  }
};

const matchesSalaryBucket = (
  player: FreeAgencyPlayerLike,
  salaryBucket: FreeAgencySalaryBucket
): boolean => {
  if (!salaryBucket) return true;
  const salary = getPlayerSalary(player);
  if (salary === null) return false;

  switch (salaryBucket) {
    case 'salary_lt_5m':
      return salary < 5_000_000;
    case 'salary_5m_10m':
      return salary >= 5_000_000 && salary < 10_000_000;
    case 'salary_10m_20m':
      return salary >= 10_000_000 && salary < 20_000_000;
    case 'salary_gte_20m':
      return salary >= 20_000_000;
    default:
      return true;
  }
};

const compareBySort = (
  a: FreeAgencyPlayerLike,
  b: FreeAgencyPlayerLike,
  sortBy: FreeAgencySortKey
): number => {
  let result = 0;

  if (sortBy === 'salary_desc') {
    const salaryA = getPlayerSalary(a) ?? -1;
    const salaryB = getPlayerSalary(b) ?? -1;
    result = salaryB - salaryA;
  } else if (sortBy === 'age_asc') {
    const ageA = getPlayerAge(a) ?? Number.POSITIVE_INFINITY;
    const ageB = getPlayerAge(b) ?? Number.POSITIVE_INFINITY;
    result = ageA - ageB;
  } else {
    const nameA = normalizeSearchText(getPlayerName(a));
    const nameB = normalizeSearchText(getPlayerName(b));
    result = nameA.localeCompare(nameB);
  }

  if (result === 0) {
    const nameA = normalizeSearchText(getPlayerName(a));
    const nameB = normalizeSearchText(getPlayerName(b));
    result = nameA.localeCompare(nameB);
  }

  if (result === 0) {
    result = getPlayerId(a).localeCompare(getPlayerId(b));
  }

  return result;
};

export function applyFreeAgencyFilters<T extends FreeAgencyPlayerLike>(
  freeAgents: T[] = [],
  partialState: Partial<FreeAgencyFilterState> = {}
): T[] {
  const state = {
    ...FREE_AGENCY_DEFAULT_FILTER_STATE,
    ...partialState,
  };

  return [...freeAgents]
    .filter((player) => matchesSearch(player, state.query))
    .filter((player) => matchesPositionBucket(player, state.position))
    .filter((player) => matchesAgeBucket(player, state.ageBucket))
    .filter((player) => matchesSalaryBucket(player, state.salaryBucket))
    .sort((a, b) => compareBySort(a, b, state.sortBy));
}
