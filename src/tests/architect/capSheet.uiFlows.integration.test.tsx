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
  hardCapLevel?: string;
  hardCapReason?: string;
  hardCapTriggeredBy?: string;
};
type ManualCapSheetMutationAuthority = NonNullable<
  Parameters<typeof CapSheet>[0]['manualCapSheetMutationAuthority']
>;

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

function readPrimaryMultiYearCellAmount(
  cell: HTMLElement | null | undefined
): number {
  if (!cell) return 0;

  const primaryAmount = Array.from(cell.querySelectorAll('span'))
    .map((span) => span.textContent?.trim() ?? '')
    .find((text) => /^\$[\d,]+(?:\.\d+)?$/.test(text));

  if (primaryAmount) {
    return parseCurrency(primaryAmount);
  }

  return parseCurrency(cell.textContent?.trim());
}

function getFutureYearCell(
  row: Element | null,
  yearOffsetFromCurrent: number
): HTMLElement {
  expect(row).not.toBeNull();
  const cells = Array.from((row as HTMLElement).children);
  const targetCell = cells[yearOffsetFromCurrent + 1] as HTMLElement | undefined;
  expect(targetCell).toBeDefined();
  return targetCell as HTMLElement;
}

function sumVisiblePlayerBodyColumnAmounts(
  yearOffsetFromCurrent: number
): number {
  return screen
    .getAllByTestId('cap-sheet-full-player-row-button')
    .reduce((sum, button) => {
      const row = button.closest('div.grid');
      const cell = getFutureYearCell(row, yearOffsetFromCurrent);
      return sum + readPrimaryMultiYearCellAmount(cell);
    }, 0);
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

function buildTeamWithFutureYearCapHitAdjustmentsFixture(): TeamLike {
  const basePlayers = Array.from({ length: 12 }, (_, index) => makePlayer(index));
  const veteranMinimumId = 'future_vet_minimum_standard';
  const adjustedStandardId = 'future_standard_cap_hit_adjusted';
  const twoWayId = 'future_two_way_non_zero';
  const futureYear = CURRENT_YEAR + 1;

  return {
    teamCode: 'LAL',
    teamName: 'Los Angeles Lakers',
    roster: [
      ...basePlayers.map((player) => String(player.id)),
      veteranMinimumId,
      adjustedStandardId,
      twoWayId,
    ],
    players: [
      ...basePlayers,
      {
        id: veteranMinimumId,
        player_id: veteranMinimumId,
        name: 'future_vet_minimum_standard',
        displayName: 'Future Veteran Minimum Wing',
        position: 'F',
        isMinimum: true,
        yearsOfService: 4,
        contract: {
          contractType: 'Standard',
          salariesByYear: [
            {
              season: toSeasonCode(CURRENT_YEAR),
              salary: 2_200_000,
              capHit: 2_200_000,
              guaranteed: true,
            },
            {
              season: toSeasonCode(futureYear),
              salary: 2_390_000,
              capHit: 2_390_000,
              guaranteed: true,
            },
          ],
        },
      },
      {
        id: adjustedStandardId,
        player_id: adjustedStandardId,
        name: 'future_standard_cap_hit_adjusted',
        displayName: 'Future Cap-Hit Forward',
        position: 'F',
        contract: {
          contractType: 'Standard',
          salariesByYear: [
            {
              season: toSeasonCode(CURRENT_YEAR),
              salary: 7_500_000,
              capHit: 7_500_000,
              guaranteed: true,
            },
            {
              season: toSeasonCode(futureYear),
              salary: 8_000_000,
              capHit: 9_000_000,
              guaranteed: true,
            },
          ],
        },
      },
      {
        id: twoWayId,
        player_id: twoWayId,
        name: 'future_two_way_non_zero',
        displayName: 'Future Two-Way Guard',
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
            {
              season: toSeasonCode(futureYear),
              salary: 700_000,
              capHit: 700_000,
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

function buildTeamWithFutureOnlyVisiblePlayerFixture(): TeamLike {
  const baseTeam = buildTeamFixture();
  const futureOnlyId = 'future_only_visible_player';
  const futureYear = CURRENT_YEAR + 1;

  return {
    ...baseTeam,
    roster: [...baseTeam.roster, futureOnlyId],
    players: [
      ...baseTeam.players,
      {
        id: futureOnlyId,
        player_id: futureOnlyId,
        name: 'future_only_visible_player',
        displayName: 'Future Only Stretch Big',
        position: 'C',
        contract: {
          contractType: 'Standard',
          salariesByYear: [
            {
              season: toSeasonCode(futureYear),
              salary: 6_000_000,
              capHit: 6_000_000,
              guaranteed: true,
            },
            {
              season: toSeasonCode(futureYear + 1),
              salary: 6_500_000,
              capHit: 6_500_000,
              guaranteed: true,
            },
          ],
        },
      },
    ],
  };
}

function buildTeamWithFutureYearHardCapBoundaryFixture(): TeamLike {
  return {
    ...buildTeamWithFutureYearCapHitAdjustmentsFixture(),
    exceptions: {
      mle: {
        type: 'non-taxpayer',
        totalAmount: 12_900_000,
        usedAmount: 12_000_000,
        remainingAmount: 900_000,
        seasonKey: toSeasonCode(CURRENT_YEAR),
      },
    },
    hardCapLevel: 'firstApron',
    hardCapReason: 'Triggered by Non-Taxpayer MLE',
    hardCapTriggeredBy: 'fullMLE',
    totals: {
      isHardCapped: true,
      hardCapLevel: 'firstApron',
      hardCapReason: 'Triggered by Non-Taxpayer MLE',
      hardCapDetail: 'Triggered by Non-Taxpayer MLE',
    },
  };
}

function buildTeamWithMultiYearHierarchyFixture(): TeamLike {
  const futureYear = CURRENT_YEAR + 1;

  return {
    ...buildTeamWithFutureOnlyVisiblePlayerFixture(),
    capHolds: [
      {
        playerId: 'hierarchy_hold_player',
        playerName: 'Hierarchy Hold Wing',
        amount: 4_250_000,
        season: toSeasonCode(futureYear),
        type: 'Bird',
        active: true,
        isSigned: false,
        reason: 'Future Bird rights cap hold',
      },
    ],
  };
}

function buildTeamWithMultiYearBodyParityFixture(): TeamLike {
  const basePlayers = buildTeamFixture().players.slice(0, 12);
  const futureYear = CURRENT_YEAR + 1;
  const veteranMinimumId = 'mixed_future_vet_minimum_standard';
  const adjustedStandardId = 'mixed_future_standard_cap_hit_adjusted';
  const twoWayId = 'mixed_future_two_way_non_zero';
  const futureOnlyId = 'mixed_future_only_visible_player';

  return {
    teamCode: 'LAL',
    teamName: 'Los Angeles Lakers',
    roster: [
      ...basePlayers.map((player) => String(player.id)),
      veteranMinimumId,
      adjustedStandardId,
      twoWayId,
      futureOnlyId,
    ],
    players: [
      ...basePlayers,
      {
        id: veteranMinimumId,
        player_id: veteranMinimumId,
        name: 'mixed_future_vet_minimum_standard',
        displayName: 'Mixed Future Veteran Minimum Wing',
        position: 'F',
        isMinimum: true,
        yearsOfService: 4,
        contract: {
          contractType: 'Standard',
          salariesByYear: [
            {
              season: toSeasonCode(CURRENT_YEAR),
              salary: 2_200_000,
              capHit: 2_200_000,
              guaranteed: true,
            },
            {
              season: toSeasonCode(futureYear),
              salary: 2_390_000,
              capHit: 2_390_000,
              guaranteed: true,
            },
          ],
        },
      },
      {
        id: adjustedStandardId,
        player_id: adjustedStandardId,
        name: 'mixed_future_standard_cap_hit_adjusted',
        displayName: 'Mixed Future Cap-Hit Forward',
        position: 'F',
        contract: {
          contractType: 'Standard',
          salariesByYear: [
            {
              season: toSeasonCode(CURRENT_YEAR),
              salary: 7_500_000,
              capHit: 7_500_000,
              guaranteed: true,
            },
            {
              season: toSeasonCode(futureYear),
              salary: 8_000_000,
              capHit: 9_000_000,
              guaranteed: true,
            },
          ],
        },
      },
      {
        id: twoWayId,
        player_id: twoWayId,
        name: 'mixed_future_two_way_non_zero',
        displayName: 'Mixed Future Two-Way Guard',
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
            {
              season: toSeasonCode(futureYear),
              salary: 700_000,
              capHit: 700_000,
              guaranteed: true,
            },
          ],
        },
      },
      {
        id: futureOnlyId,
        player_id: futureOnlyId,
        name: 'mixed_future_only_visible_player',
        displayName: 'Mixed Future Only Stretch Big',
        position: 'C',
        contract: {
          contractType: 'Standard',
          salariesByYear: [
            {
              season: toSeasonCode(futureYear),
              salary: 6_000_000,
              capHit: 6_000_000,
              guaranteed: true,
            },
          ],
        },
      },
    ],
    deadCap: [],
    capHolds: [
      {
        playerId: 'mixed_future_hold_player',
        playerName: 'Mixed Future Hold Wing',
        amount: 4_250_000,
        season: toSeasonCode(futureYear),
        type: 'Bird',
        active: true,
        isSigned: false,
        reason: 'Future Bird rights cap hold',
      },
    ],
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
  const manualCapSheetMutationAuthority = React.useMemo<
    ManualCapSheetMutationAuthority
  >(
    () => ({
      handleSetDeadCap,
      handleSetExceptions,
    }),
    [handleSetDeadCap, handleSetExceptions]
  );

  return (
    <div>
      <CapSheetSection
        teamCapSheet={teamCapSheet}
        currentYear={CURRENT_YEAR}
        onOpenPlayerContractModal={() => {}}
        manualCapSheetMutationAuthority={manualCapSheetMutationAuthority}
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

type ModalFlowsHarnessProps = {
  includeManualCapSheetMutationAuthority?: boolean;
  onDeadCapMutation?: (deadCap: unknown) => void;
  onExceptionsMutation?: (exceptions: unknown) => void;
};

function ModalFlowsHarness({
  includeManualCapSheetMutationAuthority = true,
  onDeadCapMutation,
  onExceptionsMutation,
}: ModalFlowsHarnessProps) {
  const [teamCapSheet, setTeamCapSheet] = React.useState<
    Parameters<typeof CapSheet>[0]['teamCapSheet']
  >(() => buildTeamFixture() as any);

  const handleSetDeadCap = React.useCallback(async (deadCap: unknown) => {
    onDeadCapMutation?.(deadCap);
    setTeamCapSheet(
      (prev) =>
        ({
          ...(prev as any),
          deadCap,
        }) as Parameters<typeof CapSheet>[0]['teamCapSheet']
    );
    return true;
  }, [onDeadCapMutation]);

  const handleSetExceptions = React.useCallback(
    async (exceptions: unknown) => {
      onExceptionsMutation?.(exceptions);
      setTeamCapSheet(
        (prev) =>
          ({
            ...(prev as any),
            exceptions,
          }) as Parameters<typeof CapSheet>[0]['teamCapSheet']
      );
      return true;
    },
    [onExceptionsMutation]
  );

  const manualCapSheetMutationAuthority = React.useMemo<
    ManualCapSheetMutationAuthority | null
  >(() => {
    if (!includeManualCapSheetMutationAuthority) {
      return null;
    }
    return {
      handleSetDeadCap,
      handleSetExceptions,
    };
  }, [
    handleSetDeadCap,
    handleSetExceptions,
    includeManualCapSheetMutationAuthority,
  ]);

  return (
    <CapSheet
      teamCapSheet={teamCapSheet as Parameters<typeof CapSheet>[0]['teamCapSheet']}
      currentYear={CURRENT_YEAR}
      onSelectPlayer={() => {}}
      manualCapSheetMutationAuthority={manualCapSheetMutationAuthority}
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
    const deadCapMutationSpy = vi.fn();
    const exceptionsMutationSpy = vi.fn();

    render(
      <ModalFlowsHarness
        onDeadCapMutation={deadCapMutationSpy}
        onExceptionsMutation={exceptionsMutationSpy}
      />
    );

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
    expect(deadCapMutationSpy).toHaveBeenCalledTimes(1);
    expect(deadCapMutationSpy.mock.calls[0][0]).toEqual([
      {
        playerId: expect.stringMatching(/^manual_/),
        playerName: 'New Dead Money Adjustment',
        amountByYear: [
          {
            season: '2025-26',
            amount: 2500000,
            isStretched: false,
          },
        ],
        notes: 'Manual Adjustment',
      },
    ]);

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
    expect(exceptionsMutationSpy).toHaveBeenCalledTimes(1);
    expect(exceptionsMutationSpy.mock.calls[0][0]).toEqual({
      mle: expect.objectContaining({
        enabled: true,
        totalAmount: expect.any(Number),
        usedAmount: 0,
        seasonKey: '2025-26',
      }),
    });

    expect(readVisibleTotalCapHit()).toBe(afterDeadMoneyTotal);
  });

  it('disables manual dead-money and exception edit buttons when no audited authority is provided', () => {
    render(<ModalFlowsHarness includeManualCapSheetMutationAuthority={false} />);

    const deadMoneyButton = screen.getByTestId(
      'cap-sheet-manage-dead-money-button'
    );
    const exceptionsButton = screen.getByTestId(
      'cap-sheet-manage-exceptions-button'
    );

    expect(deadMoneyButton).toBeDisabled();
    expect(exceptionsButton).toBeDisabled();

    fireEvent.click(deadMoneyButton);
    fireEvent.click(exceptionsButton);

    expect(
      screen.queryByTestId('manage-dead-money-modal')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('manage-exceptions-modal')
    ).not.toBeInTheDocument();
  });

  it('keeps canonical totals, supporting detail, and adjacent exception surfaces structurally separated', async () => {
    render(
      <CapSheetSection
        teamCapSheet={
          buildTeamWithCapHoldFixture() as Parameters<typeof CapSheetSection>[0]['teamCapSheet']
        }
        currentYear={CURRENT_YEAR}
        onOpenPlayerContractModal={() => {}}
        manualCapSheetMutationAuthority={{
          handleSetDeadCap: async () => true,
          handleSetExceptions: async () => true,
        }}
      />
    );

    const shellTruthPanel = screen.getByTestId('cap-sheet-shell-year-truth-panel');
    const primarySurface = screen.getByRole('region', {
      name: 'Primary selected-year cap sheet surface',
    });
    const summarySurface = within(primarySurface).getByRole('region', {
      name: 'Selected-year canonical totals summary surface',
    });
    const rosterSurface = within(primarySurface).getByRole('region', {
      name: 'Selected-year roster detail surface',
    });
    const capHoldsSurface = within(rosterSurface).getByRole('region', {
      name: 'Selected-year cap holds detail surface',
    });
    const breakdownSurface = within(rosterSurface).getByRole('region', {
      name: 'Selected-year canonical totals breakdown surface',
    });
    const controlSurface = within(rosterSurface).getByTestId(
      'cap-sheet-control-surface'
    );

    expect(shellTruthPanel).toHaveTextContent('Cap table: 2025-26');
    expect(shellTruthPanel).toHaveTextContent('Adjacent authority: 2025-26');
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
      name: 'Adjacent current-season authority surface',
    });
    expectBefore(primarySurface, adjacentSurface);
    expect(
      within(adjacentSurface).getByRole('region', {
        name: 'Cap sheet current-season exception authority surface',
      })
    ).toBeInTheDocument();
    expect(
      within(adjacentSurface).queryByText(/^Total Cap Hit$/i)
    ).not.toBeInTheDocument();
  });

  it('keeps future-year cap totals visible while fencing hard-cap and exception truth to the current season', async () => {
    const teamCapSheet = buildTeamWithFutureYearHardCapBoundaryFixture();
    const futureYearTotals = computeTeamCapTotals(teamCapSheet, CURRENT_YEAR + 1);

    render(
      <CapSheetSection
        teamCapSheet={
          teamCapSheet as Parameters<typeof CapSheetSection>[0]['teamCapSheet']
        }
        currentYear={CURRENT_YEAR}
        onOpenPlayerContractModal={() => {}}
        manualCapSheetMutationAuthority={{
          handleSetDeadCap: async () => true,
          handleSetExceptions: async () => true,
        }}
      />
    );

    expect(screen.getByText('Hard Capped at 1st Apron')).toBeInTheDocument();
    expect(
      screen.queryByTestId('cap-sheet-future-year-boundary-panel')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '2026-27' }));

    await waitFor(() => {
      expect(readVisibleTotalCapHit()).toBe(futureYearTotals.totalCapAllocations);
    });

    expect(
      screen.queryByText('Hard Capped at 1st Apron')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Triggered by Non-Taxpayer MLE')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('cap-sheet-shell-year-truth-panel')).toHaveTextContent(
      'Cap table: 2026-27'
    );
    expect(screen.getByTestId('cap-sheet-shell-year-truth-panel')).toHaveTextContent(
      'Adjacent authority: 2025-26 only'
    );

    const adjacentSurface = screen.getByRole('region', {
      name: 'Adjacent current-season authority surface',
    });
    expect(
      within(adjacentSurface).getByTestId(
        'cap-sheet-future-year-boundary-panel'
      )
    ).toBeInTheDocument();
    expect(
      within(adjacentSurface).getByText(
        /hard-cap, exception, and TPE state is only authoritative for 2025-26/i
      )
    ).toBeInTheDocument();
    expect(
      within(adjacentSurface).getByText(
        /This cap table can show 2026-27 totals/i
      )
    ).toBeInTheDocument();
  });

  it('disables future-year exception editing and closes an open exceptions modal outside the current season', async () => {
    const teamCapSheet = buildTeamWithFutureYearHardCapBoundaryFixture();

    render(
      <CapSheetSection
        teamCapSheet={
          teamCapSheet as Parameters<typeof CapSheetSection>[0]['teamCapSheet']
        }
        currentYear={CURRENT_YEAR}
        onOpenPlayerContractModal={() => {}}
        manualCapSheetMutationAuthority={{
          handleSetDeadCap: async () => true,
          handleSetExceptions: async () => true,
        }}
      />
    );

    fireEvent.click(screen.getByTestId('cap-sheet-manage-exceptions-button'));
    expect(
      await screen.findByTestId('manage-exceptions-modal')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '2026-27' }));

    await waitFor(() => {
      expect(
        screen.queryByTestId('manage-exceptions-modal')
      ).not.toBeInTheDocument();
    });

    const futureYearExceptionsButton = screen.getByTestId(
      'cap-sheet-manage-exceptions-button'
    );
    expect(futureYearExceptionsButton).toBeDisabled();
    expect(
      screen.getByTestId('cap-sheet-future-year-exception-edit-boundary')
    ).toHaveTextContent(
      'Exception editing is only available for the current season.'
    );

    fireEvent.click(futureYearExceptionsButton);
    expect(
      screen.queryByTestId('manage-exceptions-modal')
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
      name: 'Selected-year roster detail surface',
    });
    const breakdownSurface = within(rosterSurface).getByRole('region', {
      name: 'Selected-year canonical totals breakdown surface',
    });
    const capHoldsSurface = within(rosterSurface).getByRole('region', {
      name: 'Selected-year cap holds detail surface',
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

  it('keeps future-year multi-year row values aligned with canonical cap hits', () => {
    const teamCapSheet = buildTeamWithFutureYearCapHitAdjustmentsFixture();
    const futureYear = CURRENT_YEAR + 1;
    const totals = computeTeamCapTotals(teamCapSheet, futureYear);

    render(
      <CapSheetFull
        teamCapSheet={teamCapSheet as Parameters<typeof CapSheetFull>[0]['teamCapSheet']}
        currentYear={CURRENT_YEAR}
        onSelectPlayer={() => {}}
        onActionClick={() => {}}
      />
    );

    const veteranRow = screen
      .getByRole('button', { name: 'Future Veteran Minimum Wing' })
      .closest('div.grid');
    const veteranFutureCell = getFutureYearCell(veteranRow, 1);
    expect(
      within(veteranFutureCell).getByText('$2,092,400')
    ).toBeInTheDocument();
    expect(
      within(veteranFutureCell).queryByText('$2,390,000')
    ).not.toBeInTheDocument();
    expect(
      within(veteranFutureCell).getByText('Base $2,390,000')
    ).toBeInTheDocument();

    const adjustedRow = screen
      .getByRole('button', { name: 'Future Cap-Hit Forward' })
      .closest('div.grid');
    const adjustedFutureCell = getFutureYearCell(adjustedRow, 1);
    expect(
      within(adjustedFutureCell).getByText('$9,000,000')
    ).toBeInTheDocument();
    expect(
      within(adjustedFutureCell).queryByText('$8,000,000')
    ).not.toBeInTheDocument();
    expect(
      within(adjustedFutureCell).getByText('Base $8,000,000')
    ).toBeInTheDocument();

    const twoWayRow = screen
      .getByRole('button', { name: 'Future Two-Way Guard' })
      .closest('div.grid');
    const twoWayFutureCell = getFutureYearCell(twoWayRow, 1);
    expect(within(twoWayFutureCell).getByText('$0')).toBeInTheDocument();
    expect(
      within(twoWayFutureCell).queryByText('$700,000')
    ).not.toBeInTheDocument();
    expect(
      within(twoWayFutureCell).getByText('Base $700,000')
    ).toBeInTheDocument();

    const totalRow = screen.getByText('Total Cap').closest('div.grid');
    expect(totalRow).not.toBeNull();
    expect(
      within(totalRow as HTMLElement).getByText(
        `$${totals.totalCapAllocations.toLocaleString()}`
      )
    ).toBeInTheDocument();
    expect(totals.playersTotal).toBe(23_092_400);
    expect(totals.totalCapAllocations).toBe(23_092_400);
  });

  it('shows future-only contract contributors in the multi-year body alongside coherent future totals', () => {
    const teamCapSheet = buildTeamWithFutureOnlyVisiblePlayerFixture();
    const futureYear = CURRENT_YEAR + 1;
    const totals = computeTeamCapTotals(teamCapSheet, futureYear);

    render(
      <CapSheetFull
        teamCapSheet={teamCapSheet as Parameters<typeof CapSheetFull>[0]['teamCapSheet']}
        currentYear={CURRENT_YEAR}
        onSelectPlayer={() => {}}
        onActionClick={() => {}}
      />
    );

    const currentYearPlayerButton = screen.getByRole('button', {
      name: 'Base Player 1',
    });
    const futureOnlyButton = screen.getByRole('button', {
      name: 'Future Only Stretch Big',
    });
    const futureOnlyRow = futureOnlyButton.closest('div.grid');

    expect(futureOnlyRow).not.toBeNull();
    expectBefore(currentYearPlayerButton, futureOnlyButton);

    const futureOnlyCurrentYearCell = getFutureYearCell(futureOnlyRow, 0);
    const futureOnlyFirstFutureCell = getFutureYearCell(futureOnlyRow, 1);

    expect(futureOnlyCurrentYearCell).toBeEmptyDOMElement();
    expect(
      within(futureOnlyFirstFutureCell).getByText('$6,000,000')
    ).toBeInTheDocument();

    const totalRow = screen.getByText('Total Cap').closest('div.grid');
    expect(totalRow).not.toBeNull();

    const futureTotalCell = getFutureYearCell(totalRow, 1);
    expect(
      within(futureTotalCell).getByText(
        `$${totals.totalCapAllocations.toLocaleString()}`
      )
    ).toBeInTheDocument();
    expect(totals.playersTotal).toBe(20_000_000);
    expect(totals.totalCapAllocations).toBe(20_000_000);
  });

  it('clarifies the multi-year hierarchy between player detail, canonical totals, and cap-hold detail', () => {
    const teamCapSheet = buildTeamWithMultiYearHierarchyFixture();
    const futureYear = CURRENT_YEAR + 1;
    const totals = computeTeamCapTotals(teamCapSheet, futureYear);

    render(
      <CapSheetFull
        teamCapSheet={teamCapSheet as Parameters<typeof CapSheetFull>[0]['teamCapSheet']}
        currentYear={CURRENT_YEAR}
        onSelectPlayer={() => {}}
        onActionClick={() => {}}
      />
    );

    const primarySurface = screen.getByRole('region', {
      name: 'Primary multi-year cap sheet surface',
    });
    const playerDetailSurface = within(primarySurface).getByRole('region', {
      name: 'Multi-year player detail surface',
    });
    const canonicalTotalsSurface = within(primarySurface).getByRole('region', {
      name: 'Multi-year canonical yearly totals surface',
    });
    const capHoldsSurface = screen.getByRole('region', {
      name: 'Multi-year cap holds detail surface',
    });

    expect(
      within(playerDetailSurface).getByText(
        /Player rows show season-by-season contract detail only\./i
      )
    ).toBeInTheDocument();
    expect(
      within(playerDetailSurface).getByRole('button', {
        name: 'Future Only Stretch Big',
      })
    ).toBeInTheDocument();

    expect(
      within(canonicalTotalsSurface).getByText('Canonical Yearly Totals')
    ).toBeInTheDocument();
    expect(
      within(canonicalTotalsSurface).getByText(
        /Player rows above and cap hold details below support the same future-year cap story\./i
      )
    ).toBeInTheDocument();
    expect(
      within(canonicalTotalsSurface).getByText(/^Total Cap$/i)
    ).toBeInTheDocument();
    expect(
      within(canonicalTotalsSurface).getByText(/^Canonical yearly total$/i)
    ).toBeInTheDocument();

    expect(
      within(capHoldsSurface).getByText(
        /Separate from player rows\. Matching-season holds feed the canonical Total Cap row\./i
      )
    ).toBeInTheDocument();

    expectBefore(playerDetailSurface, canonicalTotalsSurface);
    expectBefore(canonicalTotalsSurface, capHoldsSurface);

    fireEvent.click(screen.getByTestId('cap-sheet-full-cap-holds-toggle'));

    expect(
      within(capHoldsSurface).getByText('Hierarchy Hold Wing')
    ).toBeInTheDocument();
    expect(
      within(capHoldsSurface).getByText('$4,250,000')
    ).toBeInTheDocument();
    expect(
      within(canonicalTotalsSurface).queryByText('Hierarchy Hold Wing')
    ).not.toBeInTheDocument();

    const totalRow = within(canonicalTotalsSurface)
      .getByText(/^Total Cap$/i)
      .closest('div.grid');
    expect(totalRow).not.toBeNull();

    const futureTotalCell = getFutureYearCell(totalRow, 1);
    expect(
      within(futureTotalCell).getByText(
        `$${totals.totalCapAllocations.toLocaleString()}`
      )
    ).toBeInTheDocument();
    expect(totals.playersTotal).toBe(20_000_000);
    expect(totals.capHoldsTotal).toBe(4_250_000);
    expect(totals.totalCapAllocations).toBe(24_250_000);
  });

  it('keeps the visible future-year player body, canonical total row, and cap-hold detail in coherent lockstep', () => {
    const teamCapSheet = buildTeamWithMultiYearBodyParityFixture();
    const futureYear = CURRENT_YEAR + 1;
    const totals = computeTeamCapTotals(teamCapSheet, futureYear);

    render(
      <CapSheetFull
        teamCapSheet={teamCapSheet as Parameters<typeof CapSheetFull>[0]['teamCapSheet']}
        currentYear={CURRENT_YEAR}
        onSelectPlayer={() => {}}
        onActionClick={() => {}}
      />
    );

    const primarySurface = screen.getByRole('region', {
      name: 'Primary multi-year cap sheet surface',
    });
    const playerDetailSurface = within(primarySurface).getByRole('region', {
      name: 'Multi-year player detail surface',
    });
    const canonicalTotalsSurface = within(primarySurface).getByRole('region', {
      name: 'Multi-year canonical yearly totals surface',
    });
    const capHoldsSurface = screen.getByRole('region', {
      name: 'Multi-year cap holds detail surface',
    });

    expect(
      within(playerDetailSurface).getByRole('button', {
        name: 'Mixed Future Only Stretch Big',
      })
    ).toBeInTheDocument();

    const playerBodyFutureYearSum = sumVisiblePlayerBodyColumnAmounts(1);
    expect(playerBodyFutureYearSum).toBe(totals.playersTotal);

    const totalRow = within(canonicalTotalsSurface)
      .getByText(/^Total Cap$/i)
      .closest('div.grid');
    expect(totalRow).not.toBeNull();

    const futureTotalCell = getFutureYearCell(totalRow, 1);
    const displayedFutureTotal = readPrimaryMultiYearCellAmount(futureTotalCell);

    expect(displayedFutureTotal).toBe(totals.totalCapAllocations);
    expect(displayedFutureTotal).toBeGreaterThan(playerBodyFutureYearSum);
    expect(displayedFutureTotal - playerBodyFutureYearSum).toBe(
      totals.capHoldsTotal
    );

    expect(totals.playersTotal).toBe(29_092_400);
    expect(totals.deadMoneyTotal).toBe(0);
    expect(totals.incompleteChargesTotal).toBe(0);
    expect(totals.capHoldsTotal).toBe(4_250_000);
    expect(totals.totalCapAllocations).toBe(33_342_400);

    fireEvent.click(screen.getByTestId('cap-sheet-full-cap-holds-toggle'));

    expect(
      within(capHoldsSurface).getByText('Mixed Future Hold Wing')
    ).toBeInTheDocument();
    expect(
      within(capHoldsSurface).getByText('$4,250,000')
    ).toBeInTheDocument();
    expect(
      within(playerDetailSurface).queryByText('Mixed Future Hold Wing')
    ).not.toBeInTheDocument();
    expect(
      within(canonicalTotalsSurface).queryByText('Mixed Future Hold Wing')
    ).not.toBeInTheDocument();
  });
});
