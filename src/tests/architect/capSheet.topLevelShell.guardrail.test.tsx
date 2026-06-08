// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { CapSheetSection } from '@/features/architect/GMDashboard/sections/CapSheetSection';
import { DEV_CAP_SHEET_FIXTURE_FLAG } from '@/features/architect/capSheet/devCapSheetFixtures';

const shellHarness = vi.hoisted(() => ({
  lastCapSheetProps: null as MockCapSheetProps | null,
  lastExceptionTrackerProps: null as MockExceptionTrackerProps | null,
}));

type MockCapSheetProps = {
  currentYear?: number;
  selectedYear?: number;
  onSelectedYearChange?: ((year: number) => void) | null;
  [key: string]: unknown;
};

type MockExceptionTrackerProps = {
  currentYear?: number;
  selectedYear?: number;
  surfaceLabel?: string;
  [key: string]: unknown;
};

vi.mock('@/features/architect/capSheet/CapSheet', () => {
  const MockCapSheet = (props: MockCapSheetProps) => {
    shellHarness.lastCapSheetProps = props;

    const currentYear = Number(props.currentYear);

    return (
      <div data-testid="mock-cap-sheet-surface">
        <div data-testid="mock-cap-sheet-selected-year">
          {String(props.selectedYear)}
        </div>
        <div data-testid="mock-cap-sheet-current-year">
          {String(props.currentYear)}
        </div>
        <button
          type="button"
          data-testid="mock-cap-sheet-select-next-year"
          onClick={() => props.onSelectedYearChange?.(currentYear + 1)}
        >
          Select Next Year
        </button>
        <button
          type="button"
          data-testid="mock-cap-sheet-select-following-year"
          onClick={() => props.onSelectedYearChange?.(currentYear + 2)}
        >
          Select Following Year
        </button>
      </div>
    );
  };
  return { default: MockCapSheet, CapSheet: MockCapSheet };
});

vi.mock('@/features/architect/capSheet/ExceptionTracker', () => {
  const MockExceptionTracker = (props: MockExceptionTrackerProps) => {
    shellHarness.lastExceptionTrackerProps = props;

    return (
      <div data-testid="mock-exception-tracker-surface">
        <div data-testid="mock-exception-tracker-selected-year">
          {String(props.selectedYear)}
        </div>
        <div data-testid="mock-exception-tracker-current-year">
          {String(props.currentYear)}
        </div>
        <div data-testid="mock-exception-tracker-surface-label">
          {String(props.surfaceLabel)}
        </div>
      </div>
    );
  };
  return {
    default: MockExceptionTracker,
    ExceptionTracker: MockExceptionTracker,
  };
});

const buildTeamCapSheet = () => ({
  teamCode: 'LAL',
  players: [
    {
      id: 'fixture_guard',
      player_id: 'fixture_guard',
      name: 'Fixture Guard',
      displayName: 'Fixture Guard',
    },
  ],
});

const buildBaseProps = (currentYear = 2026) => ({
  teamCapSheet: buildTeamCapSheet(),
  currentYear,
  onOpenPlayerContractModal: vi.fn(),
  manualCapSheetMutationAuthority: {
    handleSetDeadCap: vi.fn(async () => true),
    handleSetExceptions: vi.fn(async () => true),
  },
});

describe('MYCT-1C top-level Cap Sheet shell guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    localStorage.clear();
    shellHarness.lastCapSheetProps = null;
    shellHarness.lastExceptionTrackerProps = null;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('keeps CapSheetSection as the selected-year owner and resets selectedYear from currentYear changes', async () => {
    const props = buildBaseProps(2026);
    const { rerender } = render(<CapSheetSection {...props} />);

    expect(shellHarness.lastCapSheetProps).toMatchObject({
      currentYear: 2026,
      selectedYear: 2026,
    });
    expect(shellHarness.lastExceptionTrackerProps).toMatchObject({
      currentYear: 2026,
      selectedYear: 2026,
      surfaceLabel: 'Cap sheet current-season exception authority surface',
    });
    expect(
      screen.getByTestId('cap-sheet-shell-year-truth-panel')
    ).toHaveTextContent('Current-Season Alignment');

    fireEvent.click(screen.getByTestId('mock-cap-sheet-select-following-year'));

    await waitFor(() => {
      expect(shellHarness.lastCapSheetProps).toMatchObject({
        currentYear: 2026,
        selectedYear: 2028,
      });
    });
    expect(shellHarness.lastExceptionTrackerProps).toMatchObject({
      currentYear: 2026,
      selectedYear: 2028,
      surfaceLabel: 'Cap sheet current-season exception authority surface',
    });
    expect(
      screen.getByTestId('cap-sheet-shell-year-truth-panel')
    ).toHaveTextContent('Cap table: 2027-28');
    expect(
      screen.getByTestId('cap-sheet-shell-year-truth-panel')
    ).toHaveTextContent('Adjacent authority: 2025-26 only');

    rerender(<CapSheetSection {...buildBaseProps(2027)} />);

    await waitFor(() => {
      expect(shellHarness.lastCapSheetProps).toMatchObject({
        currentYear: 2027,
        selectedYear: 2027,
      });
    });
    expect(shellHarness.lastExceptionTrackerProps).toMatchObject({
      currentYear: 2027,
      selectedYear: 2027,
      surfaceLabel: 'Cap sheet current-season exception authority surface',
    });
    expect(
      screen.getByTestId('cap-sheet-shell-year-truth-panel')
    ).toHaveTextContent('Current-Season Alignment');
    expect(
      screen.getByTestId('cap-sheet-shell-year-truth-panel')
    ).toHaveTextContent('Cap table: 2026-27');
    expect(
      screen.getByTestId('cap-sheet-shell-year-truth-panel')
    ).toHaveTextContent('Adjacent authority: 2026-27');
  });

  it('keeps current-year and future-year shell messaging meaningfully different', async () => {
    render(<CapSheetSection {...buildBaseProps(2026)} />);

    const shellTruthPanel = screen.getByTestId('cap-sheet-shell-year-truth-panel');
    expect(shellTruthPanel).toHaveTextContent('Current-Season Alignment');
    expect(shellTruthPanel).toHaveTextContent(
      'The main cap sheet and the adjacent hard-cap, exception, and TPE surface are both aligned to 2025-26.'
    );
    expect(shellTruthPanel).not.toHaveTextContent('Selected-Year Totals View');

    fireEvent.click(screen.getByTestId('mock-cap-sheet-select-next-year'));

    await waitFor(() => {
      expect(shellHarness.lastCapSheetProps).toMatchObject({
        currentYear: 2026,
        selectedYear: 2027,
      });
    });

    expect(shellTruthPanel).toHaveTextContent('Selected-Year Totals View');
    expect(shellTruthPanel).toHaveTextContent(
      'The main cap sheet is showing 2026-27 totals and detail, while adjacent hard-cap, exception, and TPE authority remains on 2025-26 only.'
    );
    expect(shellTruthPanel).not.toHaveTextContent(
      'The main cap sheet and the adjacent hard-cap, exception, and TPE surface are both aligned to 2025-26.'
    );
  });

  it('keeps DEV fixture controls on a separate support surface outside primary and adjacent authority regions', () => {
    vi.stubEnv('DEV', true);
    localStorage.setItem(DEV_CAP_SHEET_FIXTURE_FLAG, 'true');

    const injectLocalFixtures = vi.fn();
    const clearLocalFixtures = vi.fn();

    render(
      <CapSheetSection
        {...buildBaseProps(2026)}
        capSheetDevFixtureControls={{
          injectLocalFixtures,
          clearLocalFixtures,
          hasInjectedLocalFixtures: true,
        }}
      />
    );

    const primarySurface = screen.getByRole('region', {
      name: 'Primary selected-year cap sheet surface',
    });
    const adjacentSurface = screen.getByRole('region', {
      name: 'Adjacent current-season authority surface',
    });
    const fixturePanel = screen.getByTestId('cap-sheet-fixtures-panel');

    expect(fixturePanel).toHaveTextContent('Cap Sheet Fixtures (DEV)');
    expect(fixturePanel).toHaveTextContent(
      'Local owner: useArchitectActions capSheetDevTools.'
    );
    expect(fixturePanel).toHaveTextContent(
      'Scope: local in-memory dashboard teamCapSheet state.'
    );
    expect(fixturePanel).toHaveTextContent('Persistence: none.');
    expect(screen.getByTestId('cap-sheet-fixtures-boundary-note')).toHaveTextContent(
      'Bounded futureContract seam probe'
    );
    expect(screen.getByTestId('cap-sheet-fixtures-boundary-note')).toHaveTextContent(
      'Not representative of real options, guarantee complexity, minimum-contract reimbursement, irregular real-data contract overlaps.'
    );
    expect(screen.getByTestId('cap-sheet-fixtures-active-note')).toHaveTextContent(
      'Synthetic DEV fixture players are active in local team state.'
    );
    expect(
      within(primarySurface).queryByTestId('cap-sheet-fixtures-panel')
    ).not.toBeInTheDocument();
    expect(
      within(adjacentSurface).queryByTestId('cap-sheet-fixtures-panel')
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(fixturePanel).getByTestId('cap-sheet-inject-fixtures-button')
    );
    fireEvent.click(
      within(fixturePanel).getByTestId('cap-sheet-clear-fixtures-button')
    );

    expect(injectLocalFixtures).toHaveBeenCalledTimes(1);
    expect(clearLocalFixtures).toHaveBeenCalledTimes(1);
  });
});
