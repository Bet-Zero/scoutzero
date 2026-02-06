/**
 * FILE: src/tests/architect/pickSelector.test.tsx
 * PURPOSE: Tests for PickSelector component (TM-8).
 * OWNERSHIP: Test suite
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PickSelector } from '@/features/architect/admin/PickSelector';

describe('PickSelector', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders team, year, and round dropdowns', () => {
    render(<PickSelector value="" onChange={vi.fn()} />);

    expect(screen.getByTestId('pick-selector-team')).toBeInTheDocument();
    expect(screen.getByTestId('pick-selector-year')).toBeInTheDocument();
    expect(screen.getByTestId('pick-selector-round')).toBeInTheDocument();
  });

  it('displays label when provided', () => {
    render(
      <PickSelector value="" onChange={vi.fn()} label="Underlying Pick" />
    );
    expect(screen.getByText('Underlying Pick')).toBeInTheDocument();
  });

  it('parses existing pick ID into dropdowns', () => {
    render(<PickSelector value="BOS_2027_1" onChange={vi.fn()} />);

    const teamSelect = screen.getByTestId(
      'pick-selector-team'
    ) as HTMLSelectElement;
    const yearSelect = screen.getByTestId(
      'pick-selector-year'
    ) as HTMLSelectElement;
    const roundSelect = screen.getByTestId(
      'pick-selector-round'
    ) as HTMLSelectElement;

    expect(teamSelect.value).toBe('BOS');
    expect(yearSelect.value).toBe('2027');
    expect(roundSelect.value).toBe('1');
  });

  it('generates canonical pick ID when team is changed', () => {
    const onChange = vi.fn();
    render(<PickSelector value="BOS_2027_1" onChange={onChange} />);

    fireEvent.change(screen.getByTestId('pick-selector-team'), {
      target: { value: 'LAL' },
    });

    expect(onChange).toHaveBeenCalledWith('LAL_2027_1');
  });

  it('generates canonical pick ID when year is changed', () => {
    const onChange = vi.fn();
    render(<PickSelector value="BOS_2027_1" onChange={onChange} />);

    fireEvent.change(screen.getByTestId('pick-selector-year'), {
      target: { value: '2028' },
    });

    expect(onChange).toHaveBeenCalledWith('BOS_2028_1');
  });

  it('generates canonical pick ID when round is changed', () => {
    const onChange = vi.fn();
    render(<PickSelector value="BOS_2027_1" onChange={onChange} />);

    fireEvent.change(screen.getByTestId('pick-selector-round'), {
      target: { value: '2' },
    });

    expect(onChange).toHaveBeenCalledWith('BOS_2027_2');
  });

  it('shows the generated pick ID display', () => {
    render(<PickSelector value="PHI_2026_1" onChange={vi.fn()} />);
    expect(screen.getByText('PHI_2026_1')).toBeInTheDocument();
  });

  it('toggles advanced raw ID editor', () => {
    render(<PickSelector value="BOS_2027_1" onChange={vi.fn()} />);

    // Raw input hidden by default
    expect(screen.queryByTestId('pick-selector-raw')).not.toBeInTheDocument();

    // Click toggle
    fireEvent.click(screen.getByText(/advanced: edit raw pick id/i));

    // Raw input visible
    const rawInput = screen.getByTestId(
      'pick-selector-raw'
    ) as HTMLInputElement;
    expect(rawInput).toBeInTheDocument();
    expect(rawInput.value).toBe('BOS_2027_1');
  });

  it('displays error when provided', () => {
    render(
      <PickSelector
        value=""
        onChange={vi.fn()}
        error="Required for pick ownership"
      />
    );
    expect(screen.getByText('Required for pick ownership')).toBeInTheDocument();
  });

  it('uses defaultTeam when value is empty', () => {
    render(<PickSelector value="" onChange={vi.fn()} defaultTeam="MIA" />);

    const teamSelect = screen.getByTestId(
      'pick-selector-team'
    ) as HTMLSelectElement;
    expect(teamSelect.value).toBe('MIA');
  });
});
