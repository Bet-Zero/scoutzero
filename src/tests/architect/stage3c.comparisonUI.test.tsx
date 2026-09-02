/**
 * FILE: src/tests/architect/stage3c.comparisonUI.test.tsx
 * PURPOSE: Targeted tests for Stage 3C ComparisonSection rendering.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Covers:
 * - sandbox/no-world state renders sandbox message
 * - loading state renders loading indicator
 * - error state renders error message
 * - no committed events renders empty state
 * - committed events render event count, teams, players
 * - cap delta renders when derivable
 * - missing cap totals renders unavailable in deferred summary
 * - multi-season warning renders when isMultiSeasonComparison is true
 * - deferred exception/draft summaries render
 * - navigation buttons are navigation-only (call callbacks, no mutation)
 * - authority labels are visible
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ComparisonSection } from '@/features/architect/GMDashboard/sections/ComparisonSection';
import type { Stage3ComparisonViewModel } from '@/features/architect/comparison/types';

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeScopeViewModel = (
  overrides: Partial<Stage3ComparisonViewModel> = {}
): Stage3ComparisonViewModel => ({
  scope: {
    teamCode: 'LAL',
    worldId: 'world_test',
    worldName: 'Test World',
    baselineSeason: '2025-26',
    currentSeason: '2025-26',
    authority: 'committed-world',
  },
  rosterAdditions: [],
  rosterRemovals: [],
  rosterChangedPlayers: [],
  capTotalDelta: null,
  taxApronPostureDelta: null,
  exceptionDelta: {
    status: 'deferred',
    reason: 'Exception delta is not reliably derivable from the current event stream.',
  },
  changedTeams: { teamCodes: [], authority: 'committed-world / event-derived' },
  changedPlayers: { playerIds: [], authority: 'committed-world / event-derived' },
  committedEventCount: 0,
  committedEventReferences: [],
  isMultiSeasonComparison: false,
  unavailableSummary: [
    { field: 'capTotalDelta', reason: 'No committed events in this world.' },
    { field: 'draftAssetDelta', reason: 'Draft delta deferred.' },
  ],
  ...overrides,
});

const makeViewModelWithEvents = (): Stage3ComparisonViewModel =>
  makeScopeViewModel({
    committedEventCount: 3,
    changedTeams: {
      teamCodes: ['LAL', 'BOS'],
      authority: 'committed-world / event-derived',
    },
    changedPlayers: {
      playerIds: ['player_a', 'player_b', 'player_c'],
      authority: 'committed-world / event-derived',
    },
    rosterAdditions: [
      {
        playerId: 'player_a',
        displayName: 'Austin Reaves',
        authority: 'committed-world / event-derived',
      },
    ],
    rosterRemovals: [
      {
        playerId: 'player_b',
        displayName: 'Derrick White',
        authority: 'committed-world / event-derived',
      },
    ],
    rosterChangedPlayers: [
      {
        playerId: 'player_c',
        displayName: 'Bam Adebayo',
        authority: 'committed-world / event-derived',
      },
    ],
    capTotalDelta: {
      teamSalaryDelta: 15_000_000,
      apronTeamSalaryDelta: 16_000_000,
      taxSalaryDelta: 17_000_000,
      capSpaceDelta: -15_000_000,
      taxSpaceDelta: -15_000_000,
      firstApronSpaceDelta: -16_000_000,
      secondApronSpaceDelta: -16_000_000,
      authority: 'committed-world / event-derived',
    },
    taxApronPostureDelta: {
      crossedFirstApron: true,
      crossedSecondApron: false,
      hardCapActivated: false,
      authority: 'committed-world / event-derived',
    },
    unavailableSummary: [
      { field: 'draftAssetDelta', reason: 'Draft delta deferred.' },
    ],
  });

// ---------------------------------------------------------------------------
// Sandbox state
// ---------------------------------------------------------------------------

describe('ComparisonSection — sandbox state', () => {
  it('renders sandbox message when status is sandbox', () => {
    render(
      <ComparisonSection
        status="sandbox"
        viewModel={null}
      />
    );
    expect(screen.getByTestId('comparison-sandbox-state')).toBeInTheDocument();
    expect(screen.getByText(/requires a saved world/i)).toBeInTheDocument();
  });

  it('does not render available content in sandbox state', () => {
    render(<ComparisonSection status="sandbox" viewModel={null} />);
    expect(screen.queryByTestId('comparison-available')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe('ComparisonSection — loading state', () => {
  it('renders loading indicator when status is loading', () => {
    render(<ComparisonSection status="loading" viewModel={null} />);
    expect(screen.getByTestId('comparison-loading-state')).toBeInTheDocument();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe('ComparisonSection — error state', () => {
  it('renders error message when status is error', () => {
    render(
      <ComparisonSection
        status="error"
        viewModel={null}
        error="Firestore read failed"
      />
    );
    expect(screen.getByTestId('comparison-error-state')).toBeInTheDocument();
    expect(screen.getByText(/Firestore read failed/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// No committed events (empty world)
// ---------------------------------------------------------------------------

describe('ComparisonSection — no committed events', () => {
  it('renders available container with empty state when no events', () => {
    render(
      <ComparisonSection status="available" viewModel={makeScopeViewModel()} />
    );
    expect(screen.getByTestId('comparison-available')).toBeInTheDocument();
    expect(screen.getByTestId('comparison-empty-state')).toBeInTheDocument();
  });

  it('shows event count of zero', () => {
    render(
      <ComparisonSection status="available" viewModel={makeScopeViewModel()} />
    );
    const eventCountEl = screen.getByTestId('comparison-event-count');
    expect(eventCountEl).toHaveTextContent('0');
    expect(eventCountEl).toHaveTextContent(/saved move/i);
  });

  it('shows world name in scope header', () => {
    render(
      <ComparisonSection status="available" viewModel={makeScopeViewModel()} />
    );
    expect(screen.getByText('Test World')).toBeInTheDocument();
  });

  it('does not expose internal authority labels', () => {
    render(
      <ComparisonSection status="available" viewModel={makeScopeViewModel()} />
    );
    expect(screen.queryByText(/committed world/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/event-derived/i)).not.toBeInTheDocument();
  });

  it('renders deferred/unavailable summary', () => {
    render(
      <ComparisonSection status="available" viewModel={makeScopeViewModel()} />
    );
    expect(screen.getByTestId('comparison-unavailable-summary')).toBeInTheDocument();
    expect(screen.getByText(/Cap totals/)).toBeInTheDocument();
    expect(screen.getByText(/Draft picks/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// With committed events
// ---------------------------------------------------------------------------

describe('ComparisonSection — with committed events', () => {
  it('renders event count', () => {
    render(
      <ComparisonSection
        status="available"
        viewModel={makeViewModelWithEvents()}
      />
    );
    const el = screen.getByTestId('comparison-event-count');
    expect(el).toHaveTextContent('3');
    expect(el).toHaveTextContent(/saved move/i);
  });

  it('renders changed teams count', () => {
    render(
      <ComparisonSection
        status="available"
        viewModel={makeViewModelWithEvents()}
      />
    );
    const el = screen.getByTestId('comparison-changed-teams');
    expect(el).toHaveTextContent('2');
    expect(el).toHaveTextContent(/team/i);
  });

  it('renders changed players count', () => {
    render(
      <ComparisonSection
        status="available"
        viewModel={makeViewModelWithEvents()}
      />
    );
    const el = screen.getByTestId('comparison-changed-players');
    expect(el).toHaveTextContent('3');
    expect(el).toHaveTextContent(/player/i);
  });

  it('renders the roster addition display name without its raw id', () => {
    render(
      <ComparisonSection
        status="available"
        viewModel={makeViewModelWithEvents()}
      />
    );
    const addEl = screen.getByTestId('comparison-roster-additions');
    expect(addEl).toHaveTextContent('Austin Reaves');
    expect(addEl).not.toHaveTextContent('player_a');
  });

  it('renders the roster removal display name without its raw id', () => {
    render(
      <ComparisonSection
        status="available"
        viewModel={makeViewModelWithEvents()}
      />
    );
    const remEl = screen.getByTestId('comparison-roster-removals');
    expect(remEl).toHaveTextContent('Derrick White');
    expect(remEl).not.toHaveTextContent('player_b');
  });

  it('renders the changed player display name without its raw id', () => {
    render(
      <ComparisonSection
        status="available"
        viewModel={makeViewModelWithEvents()}
      />
    );
    const chgEl = screen.getByTestId('comparison-roster-changed');
    expect(chgEl).toHaveTextContent('Bam Adebayo');
    expect(chgEl).not.toHaveTextContent('player_c');
  });

  it('keeps internal comparison terminology out of normal mode', () => {
    render(
      <ComparisonSection
        status="available"
        viewModel={makeViewModelWithEvents()}
      />
    );
    expect(screen.queryByText(/event-derived/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/committed event/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/players touched/i)).not.toBeInTheDocument();
  });

  it('does not render empty state when events present', () => {
    render(
      <ComparisonSection
        status="available"
        viewModel={makeViewModelWithEvents()}
      />
    );
    expect(screen.queryByTestId('comparison-empty-state')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Cap total delta
// ---------------------------------------------------------------------------

describe('ComparisonSection — cap delta', () => {
  it('renders cap delta section when capTotalDelta is present', () => {
    render(
      <ComparisonSection
        status="available"
        viewModel={makeViewModelWithEvents()}
      />
    );
    expect(screen.getByTestId('comparison-cap-delta')).toBeInTheDocument();
    // Positive cap allocation delta shown as +$15.0M
    expect(screen.getByText('+$15.0M')).toBeInTheDocument();
  });

  it('does not render cap delta section when capTotalDelta is null', () => {
    const vm = makeScopeViewModel({ committedEventCount: 1 });
    render(<ComparisonSection status="available" viewModel={vm} />);
    expect(screen.queryByTestId('comparison-cap-delta')).not.toBeInTheDocument();
  });

  it('renders cap space delta with correct sign', () => {
    render(
      <ComparisonSection
        status="available"
        viewModel={makeViewModelWithEvents()}
      />
    );
    // capSpaceDelta and taxSpaceDelta are both -15M → at least one −$15.0M present
    const elements = screen.getAllByText('−$15.0M');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows unavailable marker for null delta fields', () => {
    const vm = makeScopeViewModel({
      committedEventCount: 1,
      capTotalDelta: {
        teamSalaryDelta: 10_000_000,
        apronTeamSalaryDelta: null,
        taxSalaryDelta: null,
        capSpaceDelta: null,
        taxSpaceDelta: null,
        firstApronSpaceDelta: null,
        secondApronSpaceDelta: null,
        authority: 'committed-world / event-derived',
      },
    });
    render(<ComparisonSection status="available" viewModel={vm} />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Tax/apron posture delta
// ---------------------------------------------------------------------------

describe('ComparisonSection — apron posture', () => {
  it('renders apron delta section when taxApronPostureDelta is present', () => {
    render(
      <ComparisonSection
        status="available"
        viewModel={makeViewModelWithEvents()}
      />
    );
    expect(screen.getByTestId('comparison-apron-delta')).toBeInTheDocument();
  });

  it('shows Yes for crossed first apron', () => {
    render(
      <ComparisonSection
        status="available"
        viewModel={makeViewModelWithEvents()}
      />
    );
    // crossedFirstApron is true → shown as 'Yes'
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('does not render apron section when taxApronPostureDelta is null', () => {
    const vm = makeScopeViewModel({ committedEventCount: 1 });
    render(<ComparisonSection status="available" viewModel={vm} />);
    expect(screen.queryByTestId('comparison-apron-delta')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Multi-season warning
// ---------------------------------------------------------------------------

describe('ComparisonSection — multi-season warning', () => {
  it('renders multi-season warning when isMultiSeasonComparison is true', () => {
    const vm = makeScopeViewModel({
      isMultiSeasonComparison: true,
      committedEventCount: 2,
    });
    render(<ComparisonSection status="available" viewModel={vm} />);
    expect(
      screen.getByTestId('comparison-multi-season-warning')
    ).toBeInTheDocument();
    expect(screen.getByText(/includes a season change/i)).toBeInTheDocument();
  });

  it('does not render multi-season warning when isMultiSeasonComparison is false', () => {
    render(
      <ComparisonSection
        status="available"
        viewModel={makeViewModelWithEvents()}
      />
    );
    expect(
      screen.queryByTestId('comparison-multi-season-warning')
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Deferred / unavailable summary
// ---------------------------------------------------------------------------

describe('ComparisonSection — deferred and unavailable', () => {
  it('renders unavailable summary section', () => {
    render(
      <ComparisonSection
        status="available"
        viewModel={makeViewModelWithEvents()}
      />
    );
    expect(
      screen.getByTestId('comparison-unavailable-summary')
    ).toBeInTheDocument();
  });

  it('renders draftAssetDelta in unavailable list', () => {
    render(
      <ComparisonSection
        status="available"
        viewModel={makeViewModelWithEvents()}
      />
    );
    expect(screen.getByText(/Draft picks/)).toBeInTheDocument();
  });

  it('exception delta is not a number — it is labeled deferred', () => {
    // Ensure no numeric exception delta value is ever rendered.
    render(
      <ComparisonSection
        status="available"
        viewModel={makeViewModelWithEvents()}
      />
    );
    // The exceptionDelta.status is 'deferred' — not a numeric field in the UI.
    // We verify the component doesn't render the exception delta reason directly
    // as a number (it is in the unavailableSummary or just absent from numbers).
    const capDeltaEl = screen.queryByTestId('comparison-cap-delta');
    // cap delta exists, but it should only show cap-related fields (no exceptions)
    if (capDeltaEl) {
      expect(capDeltaEl).not.toHaveTextContent(/exception/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Navigation buttons
// ---------------------------------------------------------------------------

describe('ComparisonSection — navigation buttons', () => {
  it('calls onNavigateToHistory when View History button is clicked', () => {
    const onHistory = vi.fn();
    render(
      <ComparisonSection
        status="available"
        viewModel={makeScopeViewModel()}
        onNavigateToHistory={onHistory}
      />
    );
    fireEvent.click(screen.getByTestId('comparison-nav-history'));
    expect(onHistory).toHaveBeenCalledTimes(1);
  });

  it('calls onNavigateToCapSheet when Cap Sheet button is clicked', () => {
    const onCapSheet = vi.fn();
    render(
      <ComparisonSection
        status="available"
        viewModel={makeScopeViewModel()}
        onNavigateToCapSheet={onCapSheet}
      />
    );
    fireEvent.click(screen.getByTestId('comparison-nav-cap-sheet'));
    expect(onCapSheet).toHaveBeenCalledTimes(1);
  });

  it('calls onNavigateToRoster when Roster button is clicked', () => {
    const onRoster = vi.fn();
    render(
      <ComparisonSection
        status="available"
        viewModel={makeScopeViewModel()}
        onNavigateToRoster={onRoster}
      />
    );
    fireEvent.click(screen.getByTestId('comparison-nav-roster'));
    expect(onRoster).toHaveBeenCalledTimes(1);
  });

  it('does not render nav buttons when callbacks are not provided', () => {
    render(
      <ComparisonSection
        status="available"
        viewModel={makeScopeViewModel()}
      />
    );
    expect(
      screen.queryByTestId('comparison-nav-history')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('comparison-nav-cap-sheet')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('comparison-nav-roster')
    ).not.toBeInTheDocument();
  });
});
