// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  cleanup,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import CapSheet from '@/features/architect/capSheet/CapSheet/CapSheet';
import CapSheetFull from '@/features/architect/capSheet/CapSheetFull/CapSheetFull';
import { CapSheetSection } from '@/features/architect/GMDashboard/sections/CapSheetSection';
import {
  DEV_CAP_SHEET_FIXTURE_FLAG,
  injectCapSheetFixtures,
  clearCapSheetFixtures,
  hasInjectedCapSheetFixtures,
} from '@/features/architect/capSheet/devCapSheetFixtures';

const CURRENT_YEAR = 2026;

type TeamLike = {
  teamCode: string;
  teamName: string;
  roster: string[];
  players: Array<Record<string, unknown>>;
  deadCap: unknown[];
  capHolds: unknown[];
  exceptions: Record<string, unknown>;
  totals: Record<string, unknown>;
};

function parseCurrency(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function readVisibleTotalCapHit(): number {
  const label = screen.getByText(/Total Cap Hit/i);
  const row = label.parentElement;
  const values = row ? Array.from(row.querySelectorAll('span')) : [];
  const rawValue = values[values.length - 1]?.textContent;
  return parseCurrency(rawValue);
}

function makePlayer(index: number): Record<string, unknown> {
  const id = `base_player_${index + 1}`;
  return {
    id,
    player_id: id,
    name: id,
    displayName: `Base Player ${index + 1}`,
    position: 'G',
    contract: {
      contractType: 'Standard',
      salariesByYear: [
        {
          season: toSeasonCode(CURRENT_YEAR),
          salary: 1_000_000,
          capHit: 1_000_000,
          guaranteed: true,
        },
        {
          season: toSeasonCode(CURRENT_YEAR + 1),
          salary: 1_000_000,
          capHit: 1_000_000,
          guaranteed: true,
        },
      ],
    },
  };
}

function buildTeamFixture(): TeamLike {
  const players = Array.from({ length: 14 }, (_, index) => makePlayer(index));
  return {
    teamCode: 'LAL',
    teamName: 'Los Angeles Lakers',
    roster: players.map((player) => String(player.id)),
    players,
    deadCap: [],
    capHolds: [],
    exceptions: {},
    totals: {},
  };
}

function FixtureInjectorHarness() {
  const [teamCapSheet, setTeamCapSheet] = React.useState<TeamLike>(() =>
    buildTeamFixture()
  );

  const handleSetDeadCap = React.useCallback(async (deadCap: unknown) => {
    setTeamCapSheet((prev) => ({ ...prev, deadCap } as TeamLike));
    return true;
  }, []);

  const handleSetExceptions = React.useCallback(
    async (exceptions: unknown) => {
      setTeamCapSheet((prev) => ({ ...prev, exceptions } as TeamLike));
      return true;
    },
    []
  );

  const handleInjectCapSheetFixtures = React.useCallback(() => {
    setTeamCapSheet(
      (prev) => injectCapSheetFixtures(prev, CURRENT_YEAR) as TeamLike
    );
    return { success: true };
  }, []);

  const handleClearCapSheetFixtures = React.useCallback(() => {
    setTeamCapSheet((prev) => clearCapSheetFixtures(prev) as TeamLike);
    return { success: true };
  }, []);

  const injected = hasInjectedCapSheetFixtures(teamCapSheet);

  return (
    <div>
      <CapSheetSection
        teamCapSheet={teamCapSheet}
        currentYear={CURRENT_YEAR}
        onSelectPlayer={() => {}}
        onSetDeadCap={handleSetDeadCap}
        onSetExceptions={handleSetExceptions}
        onInjectCapSheetFixtures={handleInjectCapSheetFixtures}
        onClearCapSheetFixtures={handleClearCapSheetFixtures}
        hasInjectedCapSheetFixtures={injected}
      />
      <CapSheetFull
        teamCapSheet={teamCapSheet}
        currentYear={CURRENT_YEAR}
        onSelectPlayer={() => {}}
        onActionClick={() => {}}
      />
    </div>
  );
}

function ModalFlowsHarness() {
  const [teamCapSheet, setTeamCapSheet] = React.useState<TeamLike>(() =>
    buildTeamFixture()
  );

  const handleSetDeadCap = React.useCallback(async (deadCap: unknown) => {
    setTeamCapSheet((prev) => ({ ...prev, deadCap } as TeamLike));
    return true;
  }, []);

  const handleSetExceptions = React.useCallback(
    async (exceptions: unknown) => {
      setTeamCapSheet((prev) => ({ ...prev, exceptions } as TeamLike));
      return true;
    },
    []
  );

  return (
    <CapSheet
      teamCapSheet={teamCapSheet}
      currentYear={CURRENT_YEAR}
      onSelectPlayer={() => {}}
      onSetDeadCap={handleSetDeadCap}
      onSetExceptions={handleSetExceptions}
    />
  );
}

describe('Cap Sheet UI integration flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('injects/clears DEV fixtures and surfaces future contract rows with deterministic totals changes', async () => {
    vi.stubEnv('DEV', true);
    localStorage.setItem(DEV_CAP_SHEET_FIXTURE_FLAG, 'true');

    render(<FixtureInjectorHarness />);

    expect(screen.getByTestId('cap-sheet-fixtures-panel')).toBeInTheDocument();

    const beforeInjectTotal = readVisibleTotalCapHit();

    fireEvent.click(screen.getByTestId('cap-sheet-inject-fixtures-button'));

    await waitFor(() => {
      expect(
        screen.getAllByText('CAP DEV FutureContract Fixture').length
      ).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('CAP DEV Control Fixture').length).toBeGreaterThan(
      0
    );
    expect(screen.getAllByText('$16,000,000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$18,000,000').length).toBeGreaterThan(0);

    const afterInjectCurrentYearTotal = readVisibleTotalCapHit();
    expect(afterInjectCurrentYearTotal).toBeGreaterThan(beforeInjectTotal);

    fireEvent.click(screen.getByRole('button', { name: '2026-27' }));

    await waitFor(() => {
      expect(readVisibleTotalCapHit()).not.toBe(afterInjectCurrentYearTotal);
    });

    fireEvent.click(screen.getByTestId('cap-sheet-clear-fixtures-button'));

    await waitFor(() => {
      expect(
        screen.queryAllByText('CAP DEV FutureContract Fixture')
      ).toHaveLength(0);
    });
    expect(screen.queryAllByText('CAP DEV Control Fixture')).toHaveLength(0);
  });

  it('submits dead-money and exceptions modal flows and reflects deterministic totals on screen', async () => {
    render(<ModalFlowsHarness />);

    const beforeActionsTotal = readVisibleTotalCapHit();

    fireEvent.click(screen.getByTestId('cap-sheet-manage-dead-money-button'));

    const deadMoneyModal = await screen.findByTestId('manage-dead-money-modal');
    fireEvent.click(
      within(deadMoneyModal).getByRole('button', { name: /add entry/i })
    );

    const amountInput = within(deadMoneyModal).getByRole('spinbutton');
    fireEvent.change(amountInput, { target: { value: '2500000' } });

    fireEvent.click(
      within(deadMoneyModal).getByRole('button', { name: /save changes/i })
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId('manage-dead-money-modal')
      ).not.toBeInTheDocument();
    });

    const afterDeadMoneyTotal = readVisibleTotalCapHit();
    expect(afterDeadMoneyTotal).toBeGreaterThan(beforeActionsTotal);
    expect(screen.getAllByText('$2,500,000').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId('cap-sheet-manage-exceptions-button'));

    const exceptionsModal = await screen.findByTestId(
      'manage-exceptions-modal'
    );
    const mleEnabledToggle =
      within(exceptionsModal).getAllByRole('checkbox')[0];
    fireEvent.click(mleEnabledToggle);

    fireEvent.click(
      within(exceptionsModal).getByRole('button', { name: /save changes/i })
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId('manage-exceptions-modal')
      ).not.toBeInTheDocument();
    });

    expect(readVisibleTotalCapHit()).toBe(afterDeadMoneyTotal);
  });
});
