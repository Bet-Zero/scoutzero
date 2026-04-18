import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import useActiveFilterCount from '@/features/filters/hooks/useActiveFilterCount';
import { DEFAULT_SALARY_YEAR } from '@/constants/yearDefaults';

const getDefaults = () => ({
  nameSearch: '',
  salaryYear: DEFAULT_SALARY_YEAR,
  sortBy: 'name',
  sortAsc: false,
  team: '',
  badges: [],
  subRoles: { offense: [], defense: [] },
});

describe('useActiveFilterCount', () => {
  it('returns zero for default filters', () => {
    const { result } = renderHook(() =>
      useActiveFilterCount(getDefaults(), getDefaults)
    );

    expect(result.current).toBe(0);
  });

  it('counts active filters while honoring excluded keys', () => {
    const filters = {
      ...getDefaults(),
      nameSearch: 'ignored',
      salaryYear: DEFAULT_SALARY_YEAR + 1,
      team: 'LAL',
      badges: ['shooter', 'defender'],
      subRoles: { offense: ['handler'], defense: ['anchor', 'chaser'] },
    };

    const { result } = renderHook(() =>
      useActiveFilterCount(filters, getDefaults, ['nameSearch'])
    );

    expect(result.current).toBe(7);
  });

  it('returns zero when filters or defaults are unavailable', () => {
    const { result } = renderHook(() =>
      useActiveFilterCount(null, undefined)
    );

    expect(result.current).toBe(0);
  });
});
