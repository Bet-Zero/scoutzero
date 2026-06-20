/**
 * FILE: src/tests/scouting/playerSearchBar.a11y.test.tsx
 * PURPOSE: Keyboard/screen-reader accessibility coverage for the profile search bar.
 * RELATIONS: BZE-75 (Player Discovery and Entry Flow Audit), finding U2 from BZE-70.
 */

import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PlayerSearchBar } from '@/features/profile/PlayerSearchBar';

afterEach(cleanup);

const playersData = {
  '1': { bio: { displayName: 'Stephen Curry', display: { team: 'GSW' } } },
  '2': { bio: { displayName: 'Klay Thompson', display: { team: 'GSW' } } },
  '3': { bio: { displayName: 'Draymond Green', display: { team: 'GSW' } } },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe('PlayerSearchBar accessibility', () => {
  it('exposes the input as a named combobox', () => {
    render(<PlayerSearchBar playersData={playersData} onSelect={vi.fn()} />);
    const input = screen.getByRole('combobox', { name: 'Search players' });
    expect(input).toBeInTheDocument();
  });

  it('renders results as a listbox of options', () => {
    render(<PlayerSearchBar playersData={playersData} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'a' } });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
  });

  it('selects a result via ArrowDown + Enter (keyboard only)', () => {
    const onSelect = vi.fn();
    render(<PlayerSearchBar playersData={playersData} onSelect={onSelect} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'curry' } });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith('1', 'GSW');
  });

  it('Enter with no active option selects the first result', () => {
    const onSelect = vi.fn();
    render(<PlayerSearchBar playersData={playersData} onSelect={onSelect} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'curry' } });

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith('1', 'GSW');
  });
});
