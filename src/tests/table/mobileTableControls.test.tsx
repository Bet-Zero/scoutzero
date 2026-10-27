import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileTableControls } from '@/features/table/PlayerTable/PlayerTableHeader/MobileTableControls';
import { getDefaultPlayerFilters } from '@/shared/utils/filtering/playerFilterDefaults';

afterEach(() => {
  cleanup();
});

const renderControls = (overrides = {}) => {
  const props = {
    activeFilterCount: 2,
    filteredCount: 312,
    filters: { ...getDefaultPlayerFilters(), sortBy: 'PTS', sortAsc: false },
    onClearFilters: vi.fn(),
    onOpenActiveFilters: vi.fn(),
    onOpenAdvancedFilters: vi.fn(),
    onSearchChange: vi.fn(),
    searchValue: '',
    setFilters: vi.fn(),
    ...overrides,
  };
  render(<MobileTableControls {...props} />);
  return props;
};

describe('MobileTableControls', () => {
  it('shows the count, current sort and active filter badge, with filters hidden until opened', () => {
    renderControls();
    expect(screen.getByText('312 players · PTS ↓')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Filters/ }).textContent).toContain('2');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the sheet and updates sort through the filter setter', () => {
    const props = renderControls();
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    expect(screen.getByRole('dialog', { name: 'Filters and sort' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'REB' } });
    const updater = props.setFilters.mock.calls[0]?.[0];
    expect(updater(props.filters)).toMatchObject({ sortBy: 'REB' });

    fireEvent.click(screen.getByRole('button', { name: '↓ Descending' }));
    const orderUpdater = props.setFilters.mock.calls[1]?.[0];
    expect(orderUpdater(props.filters)).toMatchObject({ sortAsc: true });
  });

  it('hands off to the advanced panel and closes the sheet', () => {
    const props = renderControls();
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    fireEvent.click(screen.getByRole('button', { name: 'More filters' }));
    expect(props.onOpenAdvancedFilters).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clears filters and closes on Done', () => {
    const props = renderControls();
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(props.onClearFilters).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
