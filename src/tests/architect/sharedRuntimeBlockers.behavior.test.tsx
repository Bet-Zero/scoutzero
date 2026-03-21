/**
 * FILE: src/tests/architect/sharedRuntimeBlockers.behavior.test.tsx
 * PURPOSE: Focused behavior coverage for the migrated shared runtime blocker components.
 * OWNERSHIP: Feature: architect/shared-runtime-blockers
 *
 * HISTORY:
 *  - 2026-03-20: Added representative render, fallback, and callback coverage for the five component migrations.
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TeamLogo from '@/shared/components/TeamLogo';
import BirdRightsIcon from '@/shared/components/BirdRightsIcon';
import TeamSelectDropdown from '@/shared/components/TeamSelectDropdown';
import { Dialog, DialogContent } from '@/shared/components/ui/Dialog';
import * as DialogModule from '@/shared/components/ui/Dialog';
import MultiSelectFilter from '@/shared/components/ui/filters/MultiSelectFilter';

beforeEach(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Architect shared runtime blocker behavior', () => {
  it('TeamLogo renders the expected asset path, class handling, and image fallback', () => {
    const { container, rerender } = render(
      <TeamLogo teamAbbr="ATL" className="w-6 h-6" />
    );
    const img = screen.getByAltText('ATL logo') as HTMLImageElement;
    const wrapper = container.firstChild as HTMLElement;

    expect(img.src).toContain('/assets/logos/hawks.png');
    expect(wrapper).toHaveClass('relative', 'w-6', 'h-6');

    fireEvent.error(img);
    expect(img.src).toContain('/assets/logos/default.png');

    rerender(<TeamLogo teamId="BOS" />);
    const defaultWrapper = container.firstChild as HTMLElement;
    const defaultImg = screen.getByAltText('BOS logo') as HTMLImageElement;

    expect(defaultWrapper.className).toContain('w-[3.5rem] h-[3.5rem]');
    expect(defaultImg.src).toContain('/assets/logos/celtics.png');
  });

  it('BirdRightsIcon renders supported icons and returns null for falsy or unsupported values', () => {
    const { container, rerender } = render(
      <BirdRightsIcon type="Full Bird" className="badge-icon" size={24} />
    );
    const img = screen.getByAltText('Full Bird rights');

    expect(img).toHaveAttribute('src', expect.stringContaining('/assets/icons/bird_full_bird.svg'));
    expect(img).toHaveClass('inline-block', 'badge-icon');
    expect(img).toHaveStyle({ width: '24px', height: '24px' });

    rerender(<BirdRightsIcon type={null} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<BirdRightsIcon type="Unsupported" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('TeamSelectDropdown resolves the selected team, renders the current team content, and returns id values by default', () => {
    const onChange = vi.fn();
    const { container } = render(
      <TeamSelectDropdown selectedTeamId="ATL" onChange={onChange} />
    );

    const button = screen.getByRole('button', { name: /atlanta hawks/i });
    const selectedLabel = screen.getByText('Atlanta Hawks');
    const selectedLogo = container.querySelector('img[alt="hawks logo"]');

    expect(selectedLabel.style.color).not.toBe('');
    expect(selectedLogo).not.toBeNull();
    expect((selectedLogo as HTMLImageElement).src).toContain(
      '/assets/logos/hawks.png'
    );

    fireEvent.click(button);
    fireEvent.click(screen.getByText('Boston Celtics'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('celtics');
  });

  it('TeamSelectDropdown returns teamCode values when requested', () => {
    const onChange = vi.fn();

    render(
      <TeamSelectDropdown
        selectedTeamId="ATL"
        onChange={onChange}
        valueFormat="teamCode"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /atlanta hawks/i }));
    fireEvent.click(screen.getByText('Boston Celtics'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('BOS');
  });

  it('Dialog preserves the current named export surface and open/close click behavior', () => {
    const onOpenChange = vi.fn();
    const { container, rerender } = render(
      <Dialog open={false} onOpenChange={onOpenChange}>
        <DialogContent className="dialog-body">Modal Body</DialogContent>
      </Dialog>
    );

    expect(Object.keys(DialogModule).sort()).toEqual(['Dialog', 'DialogContent']);
    expect(container).toBeEmptyDOMElement();

    rerender(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent className="dialog-body">Modal Body</DialogContent>
      </Dialog>
    );

    const overlay = container.firstChild as HTMLElement;
    const body = screen.getByText('Modal Body');

    expect(body).toBeInTheDocument();
    expect(body).toHaveClass('dialog-body');

    fireEvent.click(body);
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(overlay);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('MultiSelectFilter renders labels and primitive options, then forwards the selected value', () => {
    const onChange = vi.fn();

    render(
      <MultiSelectFilter
        label="Team"
        value=""
        options={['ATL', 'BOS']}
        onChange={onChange}
        allLabel="All Teams"
      />
    );

    const select = screen.getByRole('combobox');
    const allTeamsOption = within(select).getByRole('option', {
      name: 'All Teams',
    }) as HTMLOptionElement;

    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(select).toHaveValue('');
    expect(allTeamsOption.value).toBe('');

    fireEvent.change(select, { target: { value: 'BOS' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('BOS');
  });

  it('MultiSelectFilter supports object options with custom label and value keys', () => {
    const onChange = vi.fn();
    const options = [
      { code: 'ATL', name: 'Atlanta Hawks' },
      { code: 'BOS', name: 'Boston Celtics' },
    ];
    const { container } = render(
      <MultiSelectFilter
        value="ATL"
        options={options}
        onChange={onChange}
        containerClass="filter-wrap"
        selectClass="team-select"
        valueKey="code"
        labelKey="name"
      />
    );

    const select = screen.getByRole('combobox');
    const atlOption = within(select).getByRole('option', {
      name: 'Atlanta Hawks',
    }) as HTMLOptionElement;

    expect((container.firstChild as HTMLElement)).toHaveClass('filter-wrap');
    expect(select).toHaveClass('team-select');
    expect(atlOption.value).toBe('ATL');

    fireEvent.change(select, { target: { value: 'BOS' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('BOS');
  });
});
