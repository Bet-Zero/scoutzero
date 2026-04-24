/**
 * FILE: src/tests/architect/rosterChargeDisplay.test.jsx
 * PURPOSE: Test visibility of Incomplete Roster Charge row in CapSheet UI
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2026-01-22: Created for Phase 25 (Roster Charge Visibility)
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import React from 'react';

// Mock usePlayerRulesProfiles hook to avoid complex dependencies
vi.mock('@/features/architect/hooks/usePlayerRulesProfiles', () => ({
  usePlayerRulesProfiles: () => ({
    getProfile: () => null,
  }),
}));

// Mock computeTeamCapTotals to return controlled totals
vi.mock('@/features/architect/utils/capTotals/computeTeamCapTotals', () => ({
  computeTeamCapTotals: vi.fn(),
}));

import CapSheet from '@/features/architect/capSheet/CapSheet/CapSheet';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';

type TeamCapTotals = ReturnType<typeof computeTeamCapTotals>;

const mockedComputeTeamCapTotals = vi.mocked(computeTeamCapTotals);
const asTeamCapTotals = (value: unknown) => value as TeamCapTotals;

function parseCurrency(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function readCurrencyForLabel(labelText: string | RegExp) {
  const label = screen.getByText(labelText);
  const container = label.parentElement;
  const lastChild = container
    ? Array.from(container.children)[container.children.length - 1]
    : null;

  return parseCurrency(lastChild?.textContent);
}

describe('CapSheet - Incomplete Roster Charge Visibility (Phase 25)', () => {
  const mockTeamCapSheet = {
    teamCode: 'BOS',
    players: [
      {
        player_id: 'p1',
        displayName: 'Test Player',
        contract: {
          contractType: 'Standard',
          salariesByYear: [
            { season: '2024-25', salary: 5_000_000, capHit: 5_000_000 },
          ],
        },
      },
    ],
    capHolds: [],
    deadCap: [],
  };

  const mockTeamCapSheetWithCapHoldDetail = {
    ...mockTeamCapSheet,
    capHolds: [
      {
        playerId: 'hold_1',
        playerName: 'Unsigned Wing Hold',
        amount: 1_500_000,
        season: '2024-25',
        type: 'Bird',
        active: true,
        isSigned: false,
        reason: 'Bird rights cap hold',
      },
    ],
  };

  const baseTotals = {
    yearKey: 2025,
    playersTotal: 5_000_000,
    deadMoneyTotal: 0,
    capHoldsTotal: 0,
    incompleteChargesTotal: 0,
    totalCapAllocations: 5_000_000,
    salaryCap: 140_000_000,
    luxuryTax: 170_000_000,
    firstApron: 178_000_000,
    secondApron: 189_000_000,
    deltas: {
      vsCap: -135_000_000,
      vsLuxuryTax: -165_000_000,
      vsFirstApron: -173_000_000,
      vsSecondApron: -184_000_000,
    },
    _meta: {
      source: 'computeTeamCapTotals',
      incompleteRosterCharge: null,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('RC1: incompleteChargesTotal = 0 → row NOT rendered', () => {
    mockedComputeTeamCapTotals.mockReturnValue(asTeamCapTotals({
      ...baseTotals,
      incompleteChargesTotal: 0,
      _meta: { ...baseTotals._meta, incompleteRosterCharge: null },
    }));

    render(
      <CapSheet
        teamCapSheet={mockTeamCapSheet}
        currentYear={2025}
        onSelectPlayer={() => {}}
      />
    );

    // Row should NOT be present
    expect(screen.queryByTestId('incomplete-roster-charge-row')).toBeNull();
  });

  it('RC2: incompleteChargesTotal > 0 → row rendered with correct amount', () => {
    const chargeAmount = 1_119_563; // 1 missing slot at rookie min

    mockedComputeTeamCapTotals.mockReturnValue(asTeamCapTotals({
      ...baseTotals,
      incompleteChargesTotal: chargeAmount,
      totalCapAllocations: baseTotals.playersTotal + chargeAmount,
      _meta: {
        ...baseTotals._meta,
        incompleteRosterCharge: {
          standardRosterCount: 13,
          minRoster: 14,
          missingSlots: 1,
          chargePerSlot: chargeAmount,
        },
      },
    }));

    render(
      <CapSheet
        teamCapSheet={mockTeamCapSheet}
        currentYear={2025}
        onSelectPlayer={() => {}}
      />
    );

    // Row should be present
    const row = screen.getByTestId('incomplete-roster-charge-row');
    expect(row).toBeTruthy();

    // Should display label
    expect(within(row).getByText(/Incomplete Roster Charge/i)).toBeTruthy();

    // Should display formatted amount within the row
    expect(row.textContent).toContain('$1,119,563');
  });

  it('RC3: if slot count is available → row includes "(N open slots)"', () => {
    const chargePerSlot = 1_119_563;
    const missingSlots = 3;
    const chargeAmount = chargePerSlot * missingSlots;

    mockedComputeTeamCapTotals.mockReturnValue(asTeamCapTotals({
      ...baseTotals,
      incompleteChargesTotal: chargeAmount,
      totalCapAllocations: baseTotals.playersTotal + chargeAmount,
      _meta: {
        ...baseTotals._meta,
        incompleteRosterCharge: {
          standardRosterCount: 11,
          minRoster: 14,
          missingSlots,
          chargePerSlot,
        },
      },
    }));

    render(
      <CapSheet
        teamCapSheet={mockTeamCapSheet}
        currentYear={2025}
        onSelectPlayer={() => {}}
      />
    );

    // Row should be present
    const row = screen.getByTestId('incomplete-roster-charge-row');
    expect(row).toBeTruthy();

    // Should display slot count (plural) within the row
    expect(row.textContent).toContain('3 open slots');
  });

  it('RC3a: single missing slot uses singular "(1 open slot)"', () => {
    const chargePerSlot = 1_119_563;
    const chargeAmount = chargePerSlot;

    mockedComputeTeamCapTotals.mockReturnValue(asTeamCapTotals({
      ...baseTotals,
      incompleteChargesTotal: chargeAmount,
      totalCapAllocations: baseTotals.playersTotal + chargeAmount,
      _meta: {
        ...baseTotals._meta,
        incompleteRosterCharge: {
          standardRosterCount: 13,
          minRoster: 14,
          missingSlots: 1,
          chargePerSlot,
        },
      },
    }));

    render(
      <CapSheet
        teamCapSheet={mockTeamCapSheet}
        currentYear={2025}
        onSelectPlayer={() => {}}
      />
    );

    // Should display slot count (singular)
    const row = screen.getByTestId('incomplete-roster-charge-row');
    expect(row.textContent).toContain('1 open slot');
    expect(row.textContent).not.toContain('1 open slots');
  });

  it('RC4: breakdown shows Player Salaries row', () => {
    mockedComputeTeamCapTotals.mockReturnValue(asTeamCapTotals({
      ...baseTotals,
      incompleteChargesTotal: 0,
    }));

    render(
      <CapSheet
        teamCapSheet={mockTeamCapSheet}
        currentYear={2025}
        onSelectPlayer={() => {}}
      />
    );

    // Should show Player Salaries (use getAllByText to handle multiple occurrences)
    const salaryLabels = screen.getAllByText('Player Salaries');
    expect(salaryLabels.length).toBeGreaterThan(0);
  });

  it('RC5: dead money row shown only when > 0', () => {
    mockedComputeTeamCapTotals.mockReturnValue(asTeamCapTotals({
      ...baseTotals,
      deadMoneyTotal: 2_500_000,
      totalCapAllocations: baseTotals.playersTotal + 2_500_000,
    }));

    render(
      <CapSheet
        teamCapSheet={mockTeamCapSheet}
        currentYear={2025}
        onSelectPlayer={() => {}}
      />
    );

    expect(screen.getByText('Dead Money')).toBeTruthy();
  });

  it('RC6: cap holds row shown only when > 0', () => {
    mockedComputeTeamCapTotals.mockReturnValue(asTeamCapTotals({
      ...baseTotals,
      capHoldsTotal: 3_000_000,
      totalCapAllocations: baseTotals.playersTotal + 3_000_000,
    }));

    render(
      <CapSheet
        teamCapSheet={mockTeamCapSheet}
        currentYear={2025}
        onSelectPlayer={() => {}}
      />
    );

    expect(screen.getByText('Cap Holds')).toBeTruthy();
  });

  it('RC7: summary, breakdown, and footer stay canonicalTotals-driven even when rows/detail surfaces differ', () => {
    mockedComputeTeamCapTotals.mockReturnValue(asTeamCapTotals({
      ...baseTotals,
      playersTotal: 9_876_543,
      deadMoneyTotal: 4_321_000,
      capHoldsTotal: 7_654_321,
      incompleteChargesTotal: 1_119_563,
      totalCapAllocations: 22_971_427,
      deltas: {
        vsCap: -117_028_573,
        vsLuxuryTax: -147_028_573,
        vsFirstApron: -155_028_573,
        vsSecondApron: -166_028_573,
      },
      _meta: {
        ...baseTotals._meta,
        incompleteRosterCharge: {
          standardRosterCount: 13,
          minRoster: 14,
          missingSlots: 1,
          chargePerSlot: 1_119_563,
        },
      },
    }));

    render(
      <CapSheet
        teamCapSheet={mockTeamCapSheetWithCapHoldDetail}
        currentYear={2025}
        onSelectPlayer={() => {}}
      />
    );

    expect(screen.getAllByText('$5,000,000').length).toBeGreaterThan(0);
    expect(readCurrencyForLabel('TOTAL CAP ALLOCATIONS')).toBe(22_971_427);
    expect(readCurrencyForLabel('Player Salaries')).toBe(9_876_543);
    expect(readCurrencyForLabel('Dead Money')).toBe(4_321_000);
    expect(readCurrencyForLabel('Cap Holds')).toBe(7_654_321);
    expect(readCurrencyForLabel(/^Total Cap Hit$/i)).toBe(22_971_427);

    fireEvent.click(
      screen.getByRole('button', { name: /show cap hold details/i })
    );

    expect(screen.getByText('Unsigned Wing Hold')).toBeTruthy();
    expect(screen.getByText('Bird rights cap hold')).toBeTruthy();
    expect(screen.getByText('$1,500,000')).toBeTruthy();
    expect(readCurrencyForLabel('Cap Holds')).toBe(7_654_321);
    expect(readCurrencyForLabel('Cap Holds')).not.toBe(1_500_000);
  });
});
