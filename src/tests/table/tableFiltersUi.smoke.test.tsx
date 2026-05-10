import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActiveFiltersDrawer } from '@/features/filters/ActiveFiltersDrawer';
import { TopControlsBar } from '@/features/table/PlayerTable/PlayerTableHeader/TopControlsBar';
import { getDefaultPlayerFilters } from '@/shared/utils/filtering/playerFilterDefaults';
import { DEFAULT_SALARY_YEAR } from '@/constants/yearDefaults';

afterEach(() => {
  cleanup();
});

describe('table and filters UI smoke', () => {
  it('updates table controls through the typed filter setter contract', () => {
    const filters = getDefaultPlayerFilters();
    const setFilters = vi.fn();

    render(
      <TopControlsBar
        filters={filters}
        setFilters={setFilters}
        activeFilterCount={0}
        onOpenAdvancedFilters={vi.fn()}
        onOpenActiveFilters={vi.fn()}
      />
    );

    fireEvent.change(screen.getByTitle('Season (for salary/stats context)'), {
      target: { value: String(DEFAULT_SALARY_YEAR + 1) },
    });

    const updater = setFilters.mock.calls[0]?.[0];
    expect(typeof updater).toBe('function');
    expect(updater(filters)).toMatchObject({
      salaryYear: DEFAULT_SALARY_YEAR + 1,
    });
  });

  it('renders the active filters drawer and wires clear/close actions', () => {
    const onClose = vi.fn();
    const onClearFilters = vi.fn();
    const filters = {
      ...getDefaultPlayerFilters(),
      team: 'BOS',
      subRoles: { offense: ['Primary Initiator'], defense: [] },
    };

    render(
      <ActiveFiltersDrawer
        open
        onClose={onClose}
        filters={filters}
        setFilters={vi.fn()}
        getDefaultFilters={getDefaultPlayerFilters}
        excludeFromDisplay={['nameSearch', 'salaryYear', 'sortBy', 'sortAsc']}
        onClearFilters={onClearFilters}
      />
    );

    expect(screen.getByText('Active Filters')).toBeTruthy();
    expect(screen.getByText('Primary Initiator')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear All Filters' }));

    expect(onClearFilters).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
