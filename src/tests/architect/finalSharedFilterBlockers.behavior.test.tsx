/**
 * FILE: src/tests/architect/finalSharedFilterBlockers.behavior.test.tsx
 * PURPOSE: Focused behavior coverage for the final shared filter blocker component migrations.
 * OWNERSHIP: Feature: architect/shared-runtime-blockers
 *
 * HISTORY:
 *  - 2026-03-20: Added representative render, callback, and fallback coverage for the final three shared filter blocker migrations.
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import BadgeFilterSelect from '@/shared/components/ui/filters/BadgeFilterSelect';
import RangeSelector from '@/shared/components/ui/filters/RangeSelector';
import RoleChecklist from '@/shared/components/ui/filters/RoleChecklist';

afterEach(() => {
  cleanup();
});

describe('Architect final shared filter blocker behavior', () => {
  it('BadgeFilterSelect preserves closed render, toggle behavior, and add/remove callback payloads', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <BadgeFilterSelect selected={['sniper']} onChange={onChange} />
    );

    expect(screen.getByRole('button', { name: /badges/i })).toBeInTheDocument();
    expect(screen.queryByText('Dimes')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /badges/i }));

    expect(screen.getByText('Sniper')).toBeInTheDocument();
    expect(screen.getByText('Dimes')).toBeInTheDocument();

    const dimesCheckbox = screen
      .getByText('Dimes')
      .closest('label')
      ?.querySelector('input') as HTMLInputElement;

    fireEvent.click(dimesCheckbox);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['sniper', 'dimes']);

    rerender(<BadgeFilterSelect selected={['sniper', 'dimes']} onChange={onChange} />);

    const sniperCheckbox = screen
      .getByText('Sniper')
      .closest('label')
      ?.querySelector('input') as HTMLInputElement;

    fireEvent.click(sniperCheckbox);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(['dimes']);

    fireEvent.click(screen.getByRole('button', { name: /badges/i }));
    expect(screen.queryByText('Dimes')).not.toBeInTheDocument();
  });

  it('RangeSelector preserves label rendering, displayed values, and min/max update semantics', () => {
    const update = vi.fn();
    const options = [
      { value: 20, label: '20' },
      { value: 23, label: '23' },
      { value: 25, label: '25' },
      { value: 30, label: '30' },
    ];

    render(
      <RangeSelector
        label="Age"
        minKey="minAge"
        maxKey="maxAge"
        filters={{ minAge: 23, maxAge: 30 }}
        options={options}
        update={update}
      />
    );

    const [minSelect, maxSelect] = screen.getAllByRole('combobox');

    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(minSelect).toHaveValue('23');
    expect(maxSelect).toHaveValue('30');

    fireEvent.change(minSelect, { target: { value: '25' } });
    expect(update).toHaveBeenNthCalledWith(1, 'minAge', 25);

    fireEvent.change(minSelect, { target: { value: '' } });
    expect(update).toHaveBeenNthCalledWith(2, 'minAge', 0);

    fireEvent.change(maxSelect, { target: { value: '' } });
    expect(update).toHaveBeenNthCalledWith(3, 'maxAge', '');
  });

  it('RangeSelector preserves the allowNullMax clear branch', () => {
    const update = vi.fn();

    render(
      <RangeSelector
        label="Weight"
        minKey="minWeight"
        maxKey="maxWeight"
        filters={{ minWeight: 0, maxWeight: null }}
        options={[{ value: 200, label: '200' }]}
        update={update}
        allowNullMax
      />
    );

    const [, maxSelect] = screen.getAllByRole('combobox');

    expect(maxSelect).toHaveValue('');

    fireEvent.change(maxSelect, { target: { value: '' } });
    expect(update).toHaveBeenCalledWith('maxWeight', null);
  });

  it('RoleChecklist preserves role rendering, selected-state behavior, wrapper classes, and toggle callbacks', () => {
    const onToggle = vi.fn();
    const roles = [
      { name: 'Defender', type: 'positive', isPositive: true },
      { name: 'Turnover Risk', type: 'negative', isPositive: false },
    ];
    const { container } = render(
      <RoleChecklist
        roles={roles}
        selected={{ positive: ['Defender'], negative: [] }}
        onToggle={onToggle}
        columns={3}
        className="extra-grid"
      />
    );

    const wrapper = container.firstChild as HTMLElement;
    const defenderCard = screen.getByText('Defender').parentElement as HTMLElement;
    const turnoverCard = screen.getByText('Turnover Risk')
      .parentElement as HTMLElement;

    expect(screen.getByText('Defender')).toBeInTheDocument();
    expect(screen.getByText('Turnover Risk')).toBeInTheDocument();
    expect(wrapper).toHaveClass('grid-cols-3', 'extra-grid');
    expect(defenderCard).toHaveClass('bg-green-900/50');
    expect(turnoverCard).toHaveClass('bg-[#2a2a2a]');

    fireEvent.click(defenderCard);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('Defender');
  });
});
