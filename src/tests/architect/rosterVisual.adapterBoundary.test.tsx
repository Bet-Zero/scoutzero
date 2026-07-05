/**
 * FILE: src/tests/architect/rosterVisual.adapterBoundary.test.tsx
 * PURPOSE: Focused guardrails for the Architect roster adapter/display boundary.
 * OWNERSHIP: Feature: architect/roster
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanup,
  render,
  screen,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import {
  RosterVisual,
  type RosterVisualCapSheetInput,
  type RosterVisualDetailsMap,
} from '@/features/architect/shared/RosterVisual';

type RosterMember = NonNullable<
  NonNullable<RosterVisualCapSheetInput['players']>[number]
>;

const POSITIONS = ['G', 'G', 'G/F', 'F', 'C', 'F', 'F/C'];

const renderRoster = (
  teamCapSheet: RosterVisualCapSheetInput,
  playersMap: RosterVisualDetailsMap = {},
  currentYear: number | null = null
) =>
  render(
    <MemoryRouter initialEntries={['/gm/LAL']}>
      <RosterVisual
        teamCapSheet={teamCapSheet}
        playersMap={playersMap}
        teamId="LAL"
        currentYear={currentYear}
      />
    </MemoryRouter>
  );

const getRosterSection = (container: HTMLElement, section: string) => {
  const sectionElement = container.querySelector(
    `[data-roster-section="${section}"]`
  );

  expect(sectionElement).not.toBeNull();
  return sectionElement as HTMLElement;
};

const makeStandardMember = (
  index: number,
  overrides: Partial<RosterMember> = {}
): RosterMember => {
  const id = `std-${index}`;
  const displayName = `Standard ${index} Player`;

  return {
    id,
    name: displayName,
    displayName,
    MIN: 35 - index,
    ...overrides,
    bio: {
      playerId: id,
      displayName,
      position: POSITIONS[index % POSITIONS.length],
      ...(overrides.bio || {}),
    },
    contract: overrides.contract || {
      contractType: 'Standard',
    },
  };
};

const makeTwoWayMember = (
  id: string,
  displayName: string,
  overrides: Partial<RosterMember> = {}
): RosterMember => ({
  id,
  name: displayName,
  displayName,
  MIN: 0,
  ...overrides,
  bio: {
    playerId: id,
    displayName,
    position: 'G',
    ...(overrides.bio || {}),
  },
  contract: overrides.contract || {
    contractType: 'Two-Way',
  },
});

describe('RosterVisual adapter boundary', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders browser-verifiable roster counts and category support states', () => {
    const teamCapSheet: RosterVisualCapSheetInput = {
      id: 'LAL',
      teamName: 'Los Angeles Lakers',
      players: [
        ...Array.from({ length: 13 }, (_, index) =>
          makeStandardMember(index + 1)
        ),
        makeTwoWayMember('two-way-alpha', 'Two Way Alpha'),
        makeTwoWayMember('two-way-beta', 'Two Way Beta'),
      ],
    };

    renderRoster(teamCapSheet);

    const truthPanel = screen.getByTestId('architect-roster-truth-panel');
    expect(truthPanel).toHaveAttribute('data-roster-displayed-count', '15');
    expect(truthPanel).toHaveAttribute('data-roster-standard-count', '13');
    expect(truthPanel).toHaveAttribute('data-roster-two-way-count', '2');
    expect(truthPanel).toHaveAttribute(
      'data-roster-unsupported-categories',
      'fa,expired,waived,options'
    );
    // Counts moved from visible chip text to data attributes (BZE-209): the
    // chip read like an internal audit on a product surface.
    expect(truthPanel).toHaveAttribute(
      'data-roster-section-counts',
      '5 starters / 4 rotation / 6 bench'
    );
    expect(truthPanel).not.toBeVisible();
  });

  it('filters normal roster cards to the selected active contract year', () => {
    const teamCapSheet: RosterVisualCapSheetInput = {
      id: 'LAL',
      teamName: 'Los Angeles Lakers',
      players: [
        makeStandardMember(1, {
          name: 'Expired Own FA',
          displayName: 'Expired Own FA',
          contract: {
            contractType: 'Standard',
            salariesByYear: [
              { season: '2025-26', salary: 12_000_000, capHit: 12_000_000 },
            ],
          },
        }),
        makeStandardMember(2, {
          name: 'Active Standard',
          displayName: 'Active Standard',
          contract: {
            contractType: 'Standard',
            salariesByYear: [
              { season: '2026-27', salary: 10_000_000, capHit: 10_000_000 },
            ],
          },
        }),
        makeTwoWayMember('two-way-active', 'Active Two Way', {
          contract: {
            contractType: 'Two-Way',
            salariesByYear: [
              { season: '2026-27', salary: 597_000, capHit: 597_000 },
            ],
          },
        }),
      ],
    };

    renderRoster(teamCapSheet, {}, 2027);

    const truthPanel = screen.getByTestId('architect-roster-truth-panel');
    expect(truthPanel).toHaveAttribute('data-roster-active-year', '2027');
    expect(truthPanel).toHaveAttribute('data-roster-displayed-count', '2');
    expect(truthPanel).toHaveAttribute('data-roster-standard-count', '1');
    expect(truthPanel).toHaveAttribute('data-roster-two-way-count', '1');
    expect(screen.queryByAltText('Expired Own FA')).not.toBeInTheDocument();
    expect(screen.getByAltText('Active Standard')).toBeInTheDocument();
    expect(screen.getByAltText('Active Two Way')).toBeInTheDocument();
  });

  it('uses teamCapSheet.players for roster membership and playersMap for detail enrichment', () => {
    const detailBackedMember: RosterMember = {
      id: 'team-slot-guard',
      player_id: 'world-map-guard',
      MIN: 48,
      bio: {
        playerId: 'team-slot-guard',
        position: 'G',
      },
      contract: {
        contractType: 'Standard',
      },
    };
    const teamCapSheet: RosterVisualCapSheetInput = {
      id: 'LAL',
      teamName: 'Los Angeles Lakers',
      players: [
        detailBackedMember,
        ...Array.from({ length: 12 }, (_, index) =>
          makeStandardMember(index + 1)
        ),
        makeTwoWayMember('two-way-alpha', 'Two Way Alpha'),
        makeTwoWayMember('two-way-beta', 'Two Way Beta'),
      ],
    };
    const playersMap: RosterVisualDetailsMap = {
      'world-map-guard': {
        id: 'world-map-guard',
        name: 'World Map Guard',
        displayName: 'World Map Guard',
        bio: {
          playerId: 'world-map-guard',
          displayName: 'World Map Guard',
          position: 'G',
        },
        headshotUrl: '/assets/headshots/world_map_guard.png',
        contract: {
          contractType: 'Standard',
        },
      },
      'outside-map-player': {
        id: 'outside-map-player',
        name: 'Outside Map Player',
        displayName: 'Outside Map Player',
        bio: {
          playerId: 'outside-map-player',
          displayName: 'Outside Map Player',
          position: 'F',
        },
        contract: {
          contractType: 'Standard',
        },
      },
    };

    const { container } = renderRoster(teamCapSheet, playersMap);
    const starters = getRosterSection(container, 'starters');
    const rotation = getRosterSection(container, 'rotation');
    const bench = getRosterSection(container, 'bench');

    expect(within(starters).getAllByRole('img')).toHaveLength(5);
    expect(within(rotation).getAllByRole('img')).toHaveLength(4);
    expect(within(bench).getAllByRole('img')).toHaveLength(6);
    expect(within(starters).getByAltText('World Map Guard')).toBeInTheDocument();
    expect(within(bench).getByAltText('Two Way Alpha')).toBeInTheDocument();
    expect(within(bench).getByAltText('Two Way Beta')).toBeInTheDocument();
    expect(
      within(starters).queryByAltText('Two Way Alpha')
    ).not.toBeInTheDocument();
    expect(
      within(rotation).queryByAltText('Two Way Alpha')
    ).not.toBeInTheDocument();
    expect(screen.queryByAltText('Outside Map Player')).not.toBeInTheDocument();
  });

  it('renders the legacy roster cards in display-only mode without add/remove controls', () => {
    const teamCapSheet: RosterVisualCapSheetInput = {
      id: 'LAL',
      teamName: 'Los Angeles Lakers',
      players: Array.from({ length: 6 }, (_, index) =>
        makeStandardMember(index + 1)
      ),
    };

    const { container } = renderRoster(teamCapSheet);
    const starters = getRosterSection(container, 'starters');
    const rotation = getRosterSection(container, 'rotation');
    const bench = getRosterSection(container, 'bench');

    expect(within(starters).getAllByRole('img')).toHaveLength(5);
    expect(within(rotation).getAllByRole('img')).toHaveLength(1);
    expect(within(bench).queryAllByRole('img')).toHaveLength(0);
    const truthPanel = screen.getByTestId('architect-roster-truth-panel');
    expect(truthPanel).toHaveAttribute('data-roster-displayed-count', '6');
    expect(truthPanel).toHaveAttribute('data-roster-two-way-count', '0');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('+')).not.toBeInTheDocument();
  });
});
