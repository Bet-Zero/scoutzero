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
import RosterVisual, {
  type RosterVisualCapSheetInput,
  type RosterVisualDetailsMap,
} from '@/features/architect/shared/RosterVisual';

type RosterMember = NonNullable<
  NonNullable<RosterVisualCapSheetInput['players']>[number]
>;

const POSITIONS = ['G', 'G', 'G/F', 'F', 'C', 'F', 'F/C'];

const renderRoster = (
  teamCapSheet: RosterVisualCapSheetInput,
  playersMap: RosterVisualDetailsMap = {}
) =>
  render(
    <MemoryRouter initialEntries={['/gm/LAL']}>
      <RosterVisual
        teamCapSheet={teamCapSheet}
        playersMap={playersMap}
        teamId="LAL"
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

const makeTwoWayMember = (id: string, displayName: string): RosterMember => ({
  id,
  name: displayName,
  displayName,
  MIN: 0,
  bio: {
    playerId: id,
    displayName,
    position: 'G',
  },
  contract: {
    contractType: 'Two-Way',
  },
});

describe('RosterVisual adapter boundary', () => {
  afterEach(() => {
    cleanup();
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
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('+')).not.toBeInTheDocument();
  });
});
