// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useFilterDiagnostics } from '@/features/table/hooks/useFilterDiagnostics';
import { getDefaultPlayerFilters } from '@/shared/utils/filtering/playerFilterDefaults';

describe('useFilterDiagnostics', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('returns null when debugFilters query param is absent', () => {
    const filters = getDefaultPlayerFilters();
    const { result } = renderHook(() => useFilterDiagnostics([], [], filters));

    expect(result.current).toBeNull();
  });

  it('returns diagnostics when debugFilters query param is enabled', () => {
    window.history.pushState({}, '', '/?debugFilters=1');

    const defaults = getDefaultPlayerFilters();
    const optionYear = defaults.salaryYear;
    const players = [
      {
        id: 'alpha',
        name: 'Alpha',
        bio: { displayName: 'Alpha' },
        currentContractView: {
          options: ['PO'],
          optionsByYear: { [optionYear]: 'PO' },
        },
        optionByYear: { [optionYear]: 'PO' },
      },
      {
        id: 'beta',
        name: 'Beta',
        bio: { displayName: 'Beta' },
      },
    ];
    const filters = {
      ...defaults,
      nameSearch: 'alp',
      optionTypes: ['PO'],
    };

    const { result } = renderHook(() =>
      useFilterDiagnostics(players, [players[0]], filters)
    );

    expect(result.current?.enabled).toBe(true);
    expect(result.current?.reduction).toMatchObject({
      totalPlayers: 2,
      filteredPlayers: 1,
      removedPlayers: 1,
      reductionPercentage: 50,
    });
    expect(result.current?.activeFilters.map((entry) => entry.key)).toEqual(
      expect.arrayContaining(['nameSearch', 'optionTypes'])
    );
    expect(
      result.current?.activeFilters.find((entry) => entry.key === 'optionTypes')
        ?.status
    ).toBe('WIRED');
    expect(result.current?.catalog.wired).toBeGreaterThan(0);
    expect(
      result.current?.optionCoverage.rawOptionSources
        .currentContractViewOptionsByYear
    ).toBe(1);
  });
});
