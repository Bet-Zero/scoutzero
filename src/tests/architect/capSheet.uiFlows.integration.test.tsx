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
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
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

function expectBefore(first: Element, second: Element) {
  expect(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING
  ).not.toBe(0);
}

function readVisibleTotalCapHit(): number {
  const label = screen.getByText(/^Total Cap Hit$/i);
  const row = label.parentElement;
  const values = row ? Array.from(row.querySelectorAll('span')) : [];
  const rawValue = values[values.length - 1]?.textContent;
  return parseCurrency(rawValue);
}

function readBreakdownValue(labelText: string): number {
  const label = screen.getByText(labelText);
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

function buildTeamWithCapHoldFixture(): TeamLike {
  return {
    ...buildTeamFixture(),
    capHolds: [
      {
        playerId: 'unsigned_hold_player',
        playerName: 'Unsigned Hold Wing',
        amount: 4_500_000,
        season: toSeasonCode(CURRENT_YEAR),
        type: 'Bird',
        active: true,
        isSigned: false,
        reason: 'Bird rights cap hold',
      },
    ],
  };
}

function buildTeamWithMixedAllocationFixture(): TeamLike {
  const basePlayers = buildTeamFixture().players.slice(0, 12);

  return {
    teamCode: 'LAL',
    teamName: 'Los Angeles Lakers',
    roster: basePlayers.map((player) => String(player.id)),
    players: basePlayers,
    deadCap: [
      {
        playerId: 'waived_fixture_player',
        playerName: 'Waived Stretch Veteran',
        amountByYear: [
          {
            season: toSeasonCode(CURRENT_YEAR),
            amount: 3_250_000,
            isStretched: true,
          },
        ],
      },
    ],
    capHolds: [
      {
        playerId: 'unsigned_hold_player',
        playerName: 'Unsigned Hold Wing',
        amount: 4_500_000,
        season: toSeasonCode(CURRENT_YEAR),
        type: 'Bird',
        active: true,
        isSigned: false,
        reason: 'Bird rights cap hold',
      },
    ],
    exceptions: {},
    totals: {},
  };
}

function buildTeamWithVeteranMinimumAndTwoWayFixture(): TeamLike {
  const basePlayers = Array.from({ length: 13 }, (_, index) => makePlayer(index));
  const veteranMinimumId = 'vet_minimum_standard';
  const twoWayId = 'two_way_non_zero';

  return {
    teamCode: 'LAL',
    teamName: 'Los Angeles Lakers',
    roster: [
      ...basePlayers.map((player) => String(player.id)),
      veteranMinimumId,
      twoWayId,
    ],
    players: [
      ...basePlayers,
      {
        id: veteranMinimumId,
        player_id: veteranMinimumId,
        name: 'vet_minimum_standard',
        displayName: 'Veteran Minimum Wing',
        position: 'F',
        isMinimum: true,
        yearsOfService: 4,
        contract: {
          contractType: 'Standard',
          salariesByYear: [
            {
              season: toSeasonCode(CURRENT_YEAR),
              salary: 2_390_000,
              capHit: 2_390_000,
              guaranteed: true,
            },
          ],
        },
      },
      {
        id: twoWayId,
        player_id: twoWayId,
        name: 'two_way_non_zero',
        displayName: 'Two-Way Prospect',
        position: 'G',
        contractType: 'two-way',
        contract: {
          contractType: 'Two-Way',
          salariesByYear: [
            {
              season: toSeasonCode(CURRENT_YEAR),
              salary: 500_000,
              capHit: 500_000,
              guaranteed: true,
            },
          ],
        },
      },
    ],
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
    setTeamCapSheet((prev): any => ({ ...(prev as any), deadCap }));
    return true;
  }, []);

  const handleSetExceptions = React.useCallback(
    async (exceptions: unknown) => {
      setTeamCapSheet((prev): any => ({ ...(prev as any), exceptions }));
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
  const [teamCapSheet, setTeamCapSheet] = React.useState<
    Parameters<typeof CapSheet>[0]['teamCapSheet']
  >(() => buildTeamFixture() as any);

  const handleSetDeadCap = React.useCallback(async (deadCap: unknown) => {
    setTeamCapSheet(
      (prev) =>
        ({
          ...(prev as any),
          deadCap,
        }) as Parameters<typeof CapSheet>[0]['teamCapSheet']
    );
    return true;
  }, []);

  const handleSetExceptions = React.useCallback(
    async (exceptions: unknown) => {
      setTeamCapSheet(
        (prev) =>
          ({
            ...(prev as any),
            exceptions,
          }) as Parameters<typeof CapSheet>[0]['teamCapSheet']
      );
      return true;
    },
    []
  );

  return (
    <CapSheet
      teamCapSheet={teamCapSheet as Parameters<typeof CapSheet>[0]['teamCapSheet']}
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

  it('keeps canonical totals, supporting detail, and adjacent exception surfaces structurally separated', async () => {
    render(
      <CapSheetSection
        teamCapSheet={
          buildTeamWithCapHoldFixture() as Parameters<typeof CapSheetSection>[0]['teamCapSheet']
        }
        currentYear={CURRENT_YEAR}
        onSelectPlayer={() => {}}
        onSetDeadCap={async () => true}
        onSetExceptions={async () => true}
      />
    );

    const primarySurface = screen.getByRole('region', {
      name: 'Primary current-year cap sheet surface',
    });
    const summarySurface = within(primarySurface).getByRole('region', {
      name: 'Current-year canonical totals summary surface',
    });
    const rosterSurface = within(primarySurface).getByRole('region', {
      name: 'Current-year roster detail surface',
    });
    const capHoldsSurface = within(rosterSurface).getByRole('region', {
      name: 'Current-year cap holds detail surface',
    });
    const breakdownSurface = within(rosterSurface).getByRole('region', {
      name: 'Current-year canonical totals breakdown surface',
    });
    const controlSurface = within(rosterSurface).getByTestId(
      'cap-sheet-control-surface'
    );

    expect(summarySurface).toBeInTheDocument();
    expect(
      within(rosterSurface).getByText(
        /Player rows show player salaries only\./i
      )
    ).toBeInTheDocument();
    expectBefore(summarySurface, rosterSurface);
    expect(
      within(breakdownSurface).getByText('Total Cap Hit Breakdown')
    ).toBeInTheDocument();
    expectBefore(breakdownSurface, capHoldsSurface);
    expectBefore(breakdownSurface, controlSurface);

    fireEvent.click(
      within(capHoldsSurface).getByRole('button', {
        name: /show cap hold details/i,
      })
    );

    expect(
      within(capHoldsSurface).getByText('Unsigned Hold Wing')
    ).toBeInTheDocument();
    expect(
      within(capHoldsSurface).getByText('Bird rights cap hold')
    ).toBeInTheDocument();
    expect(
      within(capHoldsSurface).getByText(
        /Active cap holds are included in Total Cap Hit\./i
      )
    ).toBeInTheDocument();
    expect(
      within(breakdownSurface).getByText(/^Total Cap Hit$/i)
    ).toBeInTheDocument();
    expect(
      within(breakdownSurface).queryByText('Unsigned Hold Wing')
    ).not.toBeInTheDocument();

    const adjacentSurface = screen.getByRole('region', {
      name: 'Adjacent exception presentation surface',
    });
    expectBefore(primarySurface, adjacentSurface);
    expect(
      within(adjacentSurface).getByRole('region', {
        name: 'Cap sheet adjacent exception presentation surface',
      })
    ).toBeInTheDocument();
    expect(
      within(adjacentSurface).queryByText(/^Total Cap Hit$/i)
    ).not.toBeInTheDocument();
  });

  it('makes non-player cap allocations visibly part of Total Cap Hit when present', () => {
    const teamCapSheet = buildTeamWithMixedAllocationFixture();
    const totals = computeTeamCapTotals(teamCapSheet, CURRENT_YEAR);

    render(
      <CapSheet
        teamCapSheet={teamCapSheet as Parameters<typeof CapSheet>[0]['teamCapSheet']}
        currentYear={CURRENT_YEAR}
        onSelectPlayer={() => {}}
      />
    );

    const rosterSurface = screen.getByRole('region', {
      name: 'Current-year roster detail surface',
    });
    const breakdownSurface = within(rosterSurface).getByRole('region', {
      name: 'Current-year canonical totals breakdown surface',
    });
    const capHoldsSurface = within(rosterSurface).getByRole('region', {
      name: 'Current-year cap holds detail surface',
    });
    const controlSurface = within(rosterSurface).getByTestId(
      'cap-sheet-control-surface'
    );

    expect(
      within(rosterSurface).getByText(
        'Player rows show player salaries only. Total Cap Hit also includes dead money, cap holds, and incomplete roster charges when present.'
      )
    ).toBeInTheDocument();
    expect(
      within(breakdownSurface).getByText('Total Cap Hit Breakdown')
    ).toBeInTheDocument();
    expect(
      within(breakdownSurface).getByText(
        /Player salaries from the table above plus non-player cap allocations roll into the total below\./i
      )
    ).toBeInTheDocument();
    expect(within(breakdownSurface).getByText('Dead Money')).toBeInTheDocument();
    expect(within(breakdownSurface).getByText('Cap Holds')).toBeInTheDocument();
    expect(
      within(breakdownSurface).getByTestId('incomplete-roster-charge-row')
    ).toBeInTheDocument();
    expectBefore(breakdownSurface, capHoldsSurface);
    expectBefore(breakdownSurface, controlSurface);
    expect(readBreakdownValue('Player Salaries')).toBe(totals.playersTotal);
    expect(readVisibleTotalCapHit()).toBe(totals.totalCapAllocations);
    expect(readVisibleTotalCapHit()).toBeGreaterThan(
      readBreakdownValue('Player Salaries')
    );

    expect(
      within(capHoldsSurface).getByText(
        /Active cap holds are included in Total Cap Hit\./i
      )
    ).toBeInTheDocument();

    fireEvent.click(
      within(capHoldsSurface).getByRole('button', {
        name: /show cap hold details/i,
      })
    );

    expect(
      within(capHoldsSurface).getByText('Unsigned Hold Wing')
    ).toBeInTheDocument();
  });

  it('keeps veteran-minimum and two-way row cap hits aligned with canonical player salaries', () => {
    const teamCapSheet = buildTeamWithVeteranMinimumAndTwoWayFixture();
    const totals = computeTeamCapTotals(teamCapSheet, CURRENT_YEAR);

    render(
      <CapSheet
        teamCapSheet={teamCapSheet as Parameters<typeof CapSheet>[0]['teamCapSheet']}
        currentYear={CURRENT_YEAR}
        onSelectPlayer={() => {}}
      />
    );

    const veteranButton = screen.getByRole('button', {
      name: 'Veteran Minimum Wing',
    });
    const veteranRow = veteranButton.closest('div.grid');

    expect(veteranRow).not.toBeNull();
    expect(
      within(veteranRow as HTMLElement).getByText('$2,092,400')
    ).toBeInTheDocument();
    expect(
      within(veteranRow as HTMLElement).getByText('$2,390,000')
    ).toBeInTheDocument();
    expect(
      within(veteranRow as HTMLElement).getByText('Vet Min')
    ).toBeInTheDocument();

    const twoWayButton = screen.getByRole('button', {
      name: 'Two-Way Prospect',
    });
    const twoWayRow = twoWayButton.closest('div.grid');

    expect(twoWayRow).not.toBeNull();
    expect(within(twoWayRow as HTMLElement).getByText('$0')).toBeInTheDocument();
    expect(
      within(twoWayRow as HTMLElement).getByText('$500,000')
    ).toBeInTheDocument();
    expect(within(twoWayRow as HTMLElement).getByText('2W')).toBeInTheDocument();

    expect(totals.playersTotal).toBe(15_092_400);
    expect(totals.totalCapAllocations).toBe(15_092_400);
    expect(readBreakdownValue('Player Salaries')).toBe(totals.playersTotal);
    expect(readVisibleTotalCapHit()).toBe(totals.totalCapAllocations);
  });
});
