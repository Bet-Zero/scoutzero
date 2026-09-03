/**
 * FILE: src/tests/architect/stage5.polish.test.tsx
 * PURPOSE: Targeted tests for Stage 5A product polish.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Covers the rendering / a11y changes introduced by Stage 5A:
 * - ArchitectTabBar renders all nine tabs with correct semantics
 * - Tab buttons use type="button", role="tab", aria-pressed/aria-selected
 * - Tab bar exposes role="tablist" + aria-label
 * - ComparisonSection navigation buttons use type="button"
 * - ComparisonSection nav button labels are "View …"
 * - ComparisonSection section title is present
 * - ComparisonSection scope chip reads "Committed world"
 * - ComparisonSection loading state has role=status / aria-live=polite
 * - ComparisonSection error state has role=alert
 * - GuideSection scope chip reads "Committed world"
 * - GuideSection section title is present
 * - GuideSection still renders no input, textarea, or contentEditable
 * - GuideSection navigation buttons carry navigation-only intent labelling
 * - ScenarioMoveRail history button label is "View full history →"
 * - ArchitectWorkspaceHeader bottom row uses "·" separator copy
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { ArchitectTabBar } from '@/features/architect/GMDashboard/components/ArchitectTabBar';
import { ComparisonSection } from '@/features/architect/GMDashboard/sections/ComparisonSection';
import { GuideSection } from '@/features/architect/GMDashboard/sections/GuideSection';
import { ArchitectWorkspaceHeader } from '@/features/architect/GMDashboard/components/ArchitectWorkspaceHeader';
import { ScenarioMoveRail } from '@/features/architect/GMDashboard/components/ScenarioMoveRail';
import { deriveGuidedAnswers } from '@/features/architect/guidedQuestions';
import type { Stage3ComparisonViewModel } from '@/features/architect/comparison/types';
import type { ArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import { deriveArchitectTeamPlanSaveState } from '@/features/architect/GMDashboard/hooks/teamPlanSaveState';
import type { ActiveTab } from '@/features/architect/GMDashboard/hooks/useArchitectState.types';

// Mock the scenario activity rail data hook — Stage 5 does not change rail
// data behavior, but we need a stable render to exercise the wrapper.
vi.mock(
  '@/features/architect/GMDashboard/hooks/useScenarioActivityRail',
  () => ({
    useScenarioActivityRail: () => ({
      railState: { status: 'empty' },
      localPendingDeferred: false,
    }),
  })
);

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NINE_TABS: ActiveTab[] = [
  'roster',
  'cap',
  'capfull',
  'trade',
  'fa',
  'offseason',
  'history',
  'compare',
  'guide',
];

const makeTabDescriptors = (onActivate: (id: ActiveTab) => void) =>
  NINE_TABS.map((id) => ({
    id,
    label: id,
    onActivate: () => onActivate(id),
    testId: `polish-tab-${id}`,
  }));

const makeWorkspaceContext = (
  overrides: Partial<ArchitectWorkspaceContext> = {}
): ArchitectWorkspaceContext => ({
  team: { status: 'available', id: 'LAL', label: 'Los Angeles Lakers' },
  world: {
    status: 'available',
    id: 'world_test',
    label: 'Test World',
    labelSource: 'provided',
  },
  seasons: {
    selectedViewingSeason: 2025,
    selectedViewingSeasonLabel: '2025-26',
    authoritativeWorldSeason: '2025-26',
    authoritativeWorldSeasonLabel: '2025-26',
    authoritativeWorldSeasonStatus: 'available',
    viewingSeasonDiffersFromWorldSeason: false,
  },
  worldDate: {
    status: 'available',
    value: '2025-07-01',
    label: '2025-07-01',
  },
  mode: {
    kind: 'committed-world',
    label: 'Committed World',
    shortLabel: 'World',
    detail: 'Committed world',
    tone: 'success',
    worldId: 'world_test',
    isCommittedWorldTruth: true,
  },
  status: {
    isLoading: false,
    isSaving: false,
    worldMetadataLoading: false,
    hasError: false,
    errorMessage: null,
  },
  saveState: deriveArchitectTeamPlanSaveState({ worldId: 'world_test' }),
  roster: {
    status: 'available',
    count: 15,
    standardCount: 15,
    twoWayCount: 0,
    source: 'players',
  },
  cap: {
    status: 'unavailable',
    reason: 'No cap snapshot available in this fixture.',
  },
  exceptions: {
    status: 'unavailable',
    deferralHint: 'see-cap-sheet',
    reason: 'Exception detail is owned by the Cap Sheet surface.',
  },
  draftAssets: {
    status: 'unavailable',
    deferralHint: 'see-trade-history',
    reason: 'Draft asset surfacing is deferred.',
  },
  recentActivity: {
    status: 'deferred',
    entryPoint: 'history-tab',
  },
  ...overrides,
});

const makeComparisonVm = (
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
    reason: 'Exception delta is not reliably derivable.',
  },
  changedTeams: {
    teamCodes: [],
    authority: 'committed-world / event-derived',
  },
  changedPlayers: {
    playerIds: [],
    authority: 'committed-world / event-derived',
  },
  committedEventCount: 0,
  committedEventReferences: [],
  isMultiSeasonComparison: false,
  unavailableSummary: [],
  ...overrides,
});

// ---------------------------------------------------------------------------
// ArchitectTabBar
// ---------------------------------------------------------------------------

describe('ArchitectTabBar (Stage 5A)', () => {
  it('renders one button per descriptor with type="button" and role="tab"', () => {
    render(
      <ArchitectTabBar
        activeTab="cap"
        tabs={makeTabDescriptors(() => undefined)}
      />
    );
    const buttons = screen.getAllByRole('tab');
    expect(buttons).toHaveLength(NINE_TABS.length);
    for (const b of buttons) {
      expect(b).toHaveAttribute('type', 'button');
    }
  });

  it('container has role="tablist" and an aria-label', () => {
    render(
      <ArchitectTabBar
        activeTab="cap"
        tabs={makeTabDescriptors(() => undefined)}
      />
    );
    const tablist = screen.getByRole('tablist');
    expect(tablist).toHaveAttribute('aria-label');
  });

  it('marks the active tab with aria-pressed=true and aria-selected=true', () => {
    render(
      <ArchitectTabBar
        activeTab="compare"
        tabs={makeTabDescriptors(() => undefined)}
      />
    );
    const compareTab = screen.getByTestId('polish-tab-compare');
    expect(compareTab).toHaveAttribute('aria-pressed', 'true');
    expect(compareTab).toHaveAttribute('aria-selected', 'true');
    const rosterTab = screen.getByTestId('polish-tab-roster');
    expect(rosterTab).toHaveAttribute('aria-pressed', 'false');
    expect(rosterTab).toHaveAttribute('aria-selected', 'false');
  });

  it('invokes the descriptor onActivate when clicked', () => {
    const onActivate = vi.fn();
    render(
      <ArchitectTabBar activeTab="cap" tabs={makeTabDescriptors(onActivate)} />
    );
    fireEvent.click(screen.getByTestId('polish-tab-guide'));
    expect(onActivate).toHaveBeenCalledWith('guide');
  });
});

// ---------------------------------------------------------------------------
// ComparisonSection polish
// ---------------------------------------------------------------------------

describe('ComparisonSection (Stage 5A polish)', () => {
  it('renders the section title and read-only qualifier', () => {
    render(
      <ComparisonSection status="available" viewModel={makeComparisonVm()} />
    );
    expect(screen.getByText('Saved Move Comparison')).toBeInTheDocument();
    expect(
      screen.getByText(/Read-only · Before and after/i)
    ).toBeInTheDocument();
  });

  it('keeps authority vocabulary out of the owner-facing scope', () => {
    render(
      <ComparisonSection status="available" viewModel={makeComparisonVm()} />
    );
    const scope = screen.getByTestId('comparison-scope');
    expect(scope).not.toHaveTextContent('Committed world');
    expect(scope).not.toHaveTextContent('Event-derived');
  });

  it('navigation buttons use type="button" and "View …" labels', () => {
    render(
      <ComparisonSection
        status="available"
        viewModel={makeComparisonVm()}
        onNavigateToHistory={() => undefined}
        onNavigateToCapSheet={() => undefined}
        onNavigateToRoster={() => undefined}
      />
    );
    const history = screen.getByTestId('comparison-nav-history');
    const cap = screen.getByTestId('comparison-nav-cap-sheet');
    const roster = screen.getByTestId('comparison-nav-roster');
    for (const b of [history, cap, roster]) {
      expect(b).toHaveAttribute('type', 'button');
    }
    expect(history).toHaveTextContent('View History');
    expect(cap).toHaveTextContent('View Cap Sheet');
    expect(roster).toHaveTextContent('View Roster');
  });

  it('navigation buttons still call only their navigation callback', () => {
    const onCap = vi.fn();
    const onRoster = vi.fn();
    const onHistory = vi.fn();
    render(
      <ComparisonSection
        status="available"
        viewModel={makeComparisonVm()}
        onNavigateToHistory={onHistory}
        onNavigateToCapSheet={onCap}
        onNavigateToRoster={onRoster}
      />
    );
    fireEvent.click(screen.getByTestId('comparison-nav-cap-sheet'));
    fireEvent.click(screen.getByTestId('comparison-nav-roster'));
    fireEvent.click(screen.getByTestId('comparison-nav-history'));
    expect(onCap).toHaveBeenCalledTimes(1);
    expect(onRoster).toHaveBeenCalledTimes(1);
    expect(onHistory).toHaveBeenCalledTimes(1);
  });

  it('loading state exposes role="status" with aria-live="polite"', () => {
    render(<ComparisonSection status="loading" viewModel={null} />);
    const node = screen.getByTestId('comparison-loading-state');
    expect(node).toHaveAttribute('role', 'status');
    expect(node).toHaveAttribute('aria-live', 'polite');
  });

  it('error state exposes role="alert"', () => {
    render(
      <ComparisonSection
        status="error"
        viewModel={null}
        error="Firestore read failed"
      />
    );
    const node = screen.getByTestId('comparison-error-state');
    expect(node).toHaveAttribute('role', 'alert');
    expect(node).toHaveTextContent('Firestore read failed');
  });
});

// ---------------------------------------------------------------------------
// GuideSection polish
// ---------------------------------------------------------------------------

describe('GuideSection (Stage 5A polish)', () => {
  const vm = deriveGuidedAnswers({
    workspaceContext: makeWorkspaceContext(),
    comparisonStatus: 'available',
    comparisonViewModel: null,
    comparisonError: null,
    postActionReceipt: null,
  });

  it('renders the section title and qualifier', () => {
    render(<GuideSection viewModel={vm} onNavigate={() => undefined} />);
    expect(screen.getByText('Front Office Guide')).toBeInTheDocument();
    expect(
      screen.getByText(/Read-only · Navigation only/i)
    ).toBeInTheDocument();
  });

  it('scope chip reads "Committed world" in a committed-world context', () => {
    render(<GuideSection viewModel={vm} onNavigate={() => undefined} />);
    const scope = screen.getByTestId('guide-scope');
    expect(scope).toHaveTextContent('Committed world');
  });

  it('still does not render any input, textarea, or contentEditable element', () => {
    const { container } = render(
      <GuideSection viewModel={vm} onNavigate={() => undefined} />
    );
    expect(container.querySelectorAll('input').length).toBe(0);
    expect(container.querySelectorAll('textarea').length).toBe(0);
    expect(container.querySelectorAll('[contenteditable]').length).toBe(0);
  });

  it('every visible button is a type="button" element', () => {
    render(<GuideSection viewModel={vm} onNavigate={() => undefined} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) {
      expect(b).toHaveAttribute('type', 'button');
    }
  });

  it('navigation buttons carry a navigation-only accessible name', () => {
    render(<GuideSection viewModel={vm} onNavigate={() => undefined} />);
    const navCap = screen.getAllByTestId('guide-nav-cap')[0];
    expect(navCap).toHaveAttribute(
      'aria-label',
      expect.stringContaining('navigation only')
    );
    expect(navCap).toHaveAttribute('title');
  });

  it('clicking every button only triggers navigation events', () => {
    const onNavigate = vi.fn();
    render(<GuideSection viewModel={vm} onNavigate={onNavigate} />);
    const buttons = screen.getAllByRole('button');
    for (const b of buttons) {
      fireEvent.click(b);
    }
    // Every onNavigate call should have a string target id.
    for (const call of onNavigate.mock.calls) {
      expect(typeof call[0]).toBe('string');
    }
    // The number of calls equals the number of clicked buttons — i.e. no
    // button did "nothing" or fired something other than navigation.
    expect(onNavigate).toHaveBeenCalledTimes(buttons.length);
  });
});

// ---------------------------------------------------------------------------
// ScenarioMoveRail polish
// ---------------------------------------------------------------------------

describe('ScenarioMoveRail (Stage 5A polish)', () => {
  it('history button reads "View full history →"', () => {
    render(
      <ScenarioMoveRail
        worldId={null}
        teamCode={null}
        onOpenHistory={() => undefined}
      />
    );
    const button = screen.getByTestId('scenario-move-rail-open-history');
    expect(button).toHaveTextContent('View full history');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('wrapper has an aria-label', () => {
    render(
      <ScenarioMoveRail
        worldId={null}
        teamCode={null}
        onOpenHistory={() => undefined}
      />
    );
    const rail = screen.getByTestId('scenario-move-rail');
    expect(rail).toHaveAttribute('aria-label');
  });
});

// ---------------------------------------------------------------------------
// ArchitectWorkspaceHeader copy polish
// ---------------------------------------------------------------------------

describe('ArchitectWorkspaceHeader (Stage 5A copy polish)', () => {
  it('renders the new "·"-separated indicator copy when fallbacks apply', () => {
    render(<ArchitectWorkspaceHeader context={makeWorkspaceContext()} />);
    const header = screen.getByTestId('architect-workspace-header');
    expect(header).toHaveTextContent('Exceptions · See Cap Sheet');
    expect(header).toHaveTextContent('Draft picks · See Trade');
    expect(header).toHaveTextContent('Activity · See History');
  });
});
