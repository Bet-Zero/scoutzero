// @vitest-environment jsdom
/**
 * FILE: src/tests/architect/myct_step4_guardrails.test.tsx
 * PURPOSE: Focused closeout guardrails for Multi-Year Cap Table Step 4.
 * OWNERSHIP: Feature: architect
 *
 * Protects:
 * - CapSheet as the selected-year composition owner
 * - CapSummaryTiles as a canonical totals consumer with handed-in hard-cap truth
 * - ExceptionTracker as the current-season-only adjacent authority surface
 * - UI banners, chips, disabled states, and control-strip signaling for the
 *   selected-year vs current-season authority split
 */

import React from 'react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { CapSheetSection } from '@/features/architect/GMDashboard/sections/CapSheetSection';
import {
  canUseRoomException,
  computeTeamCapTotals,
} from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { getCapSettingsForYear } from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hardCapHarness = vi.hoisted(() => ({
  status: {
    isHardCapped: true,
    hardCapCeiling: 179_000_000,
    hardCapCeilingType: 'FIRST_APRON',
    hardCapCeilingLabel: '1st Apron',
    reason: 'Triggered by Non-Taxpayer MLE',
  },
}));

vi.mock('@/features/architect/hooks/usePlayerRulesProfiles', () => ({
  usePlayerRulesProfiles: () => ({
    getProfile: () => null,
  }),
}));

vi.mock(
  '@/features/architect/utils/capTotals/computeTeamCapTotals',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/features/architect/utils/capTotals/computeTeamCapTotals')
      >();

    return {
      ...actual,
      canUseRoomException: vi.fn(() => ({
        eligible: true,
        reason: 'Under cap',
      })),
    };
  }
);

vi.mock(
  '@/features/architect/utils/tradeMachine/utils/capSettingsProvider',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/features/architect/utils/tradeMachine/utils/capSettingsProvider')
      >();

    return {
      ...actual,
      getCapSettingsForYear: vi.fn(() => ({
        salaryCap: 141_000_000,
        luxuryTax: 171_000_000,
        firstApron: 179_000_000,
        secondApron: 189_000_000,
        fullMLE: 12_800_000,
        taxpayerMLE: 5_000_000,
        bae: 4_700_000,
        roomMLE: 7_900_000,
        _meta: {
          source: 'test',
          warnings: [],
          seasonKey: '2025-26',
          resolved: true,
        },
      })),
    };
  }
);

vi.mock(
  '@/features/architect/utils/tradeMachine/utils/hardCapStatus',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/features/architect/utils/tradeMachine/utils/hardCapStatus')
      >();

    return {
      ...actual,
      getHardCapStatus: vi.fn(() => hardCapHarness.status),
    };
  }
);

vi.mock('@/features/architect/capSheet/modals/ManageExceptionsModal', () => ({
  default: ({
    isOpen,
    currentYear,
  }: {
    isOpen?: boolean;
    currentYear?: number;
  }) =>
    isOpen ? (
      <div role="dialog">Manage Exceptions Modal | {String(currentYear)}</div>
    ) : null,
}));

vi.mock('@/features/architect/capSheet/modals/ManageDeadMoneyModal', () => ({
  default: ({
    isOpen,
    currentYear,
  }: {
    isOpen?: boolean;
    currentYear?: number;
  }) =>
    isOpen ? (
      <div role="dialog">Manage Dead Money Modal | {String(currentYear)}</div>
    ) : null,
}));

const CURRENT_YEAR = 2026;

const formatMoney = (amount: number) => `$${amount.toLocaleString()}`;

const buildPlayer = (
  playerId: string,
  displayName: string,
  currentSalary: number,
  futureSalary: number
) => ({
  playerId,
  id: playerId,
  name: displayName,
  displayName,
  position: 'PG',
  age: 27,
  contract: {
    contractType: 'Standard',
    salariesByYear: [
      {
        season: '2025-26',
        salary: currentSalary,
        capHit: currentSalary,
      },
      {
        season: '2026-27',
        salary: futureSalary,
        capHit: futureSalary,
      },
    ],
  },
});

function buildTeamCapSheet() {
  return {
    teamCode: 'TST',
    players: [
      buildPlayer('player-alpha', 'Alpha Guard', 20_000_000, 23_500_000),
      buildPlayer('player-beta', 'Beta Wing', 14_000_000, 16_250_000),
    ],
    capHolds: [
      {
        playerId: 'hold-current',
        playerName: 'Unsigned Hold Wing',
        season: '2025-26',
        amount: 3_200_000,
        type: 'Bird Rights',
        reason: 'Bird rights cap hold',
        isSigned: false,
      },
      {
        playerId: 'hold-future',
        playerName: 'Future Hold Wing',
        season: '2026-27',
        amount: 4_100_000,
        type: 'Bird Rights',
        reason: 'Future bird rights cap hold',
        isSigned: false,
      },
    ],
    deadCap: [
      {
        playerId: 'dead-cap-entry',
        amountByYear: [
          { season: '2025-26', amount: 2_500_000 },
          { season: '2026-27', amount: 1_250_000 },
        ],
      },
    ],
    exceptions: {
      mle: {
        enabled: true,
        totalAmount: 12_800_000,
        usedAmount: 2_000_000,
        remainingAmount: 10_800_000,
      },
      tpmle: {
        enabled: true,
        totalAmount: 5_000_000,
        usedAmount: 0,
        remainingAmount: 5_000_000,
      },
      bae: {
        enabled: true,
        totalAmount: 4_700_000,
        usedAmount: 0,
        remainingAmount: 4_700_000,
      },
      room: {
        enabled: false,
        totalAmount: 7_900_000,
        usedAmount: 0,
        remainingAmount: 7_900_000,
      },
      tpe: [
        {
          id: 'tpe-1',
          totalAmount: 6_000_000,
          remainingAmount: 6_000_000,
          createdFrom: 'Trade with ATL',
          expiresOn: '2026-02-01',
        },
      ],
    },
  };
}

const renderCapSheetSection = () => {
  const teamCapSheet = buildTeamCapSheet();

  render(
    <CapSheetSection
      teamCapSheet={
        teamCapSheet as Parameters<typeof CapSheetSection>[0]['teamCapSheet']
      }
      currentYear={CURRENT_YEAR}
      onOpenPlayerContractModal={() => {}}
      manualCapSheetMutationAuthority={{
        handleSetDeadCap: vi.fn(async () => true),
        handleSetExceptions: vi.fn(async () => true),
      }}
    />
  );

  return {
    teamCapSheet,
    currentTotals: computeTeamCapTotals(teamCapSheet, CURRENT_YEAR),
    futureTotals: computeTeamCapTotals(teamCapSheet, CURRENT_YEAR + 1),
  };
};

describe('MYCT Step 4 Guardrails - Source Scan', () => {
  const architectRoot = path.resolve(__dirname, '../../features/architect');
  const capSheetPath = path.join(
    architectRoot,
    'capSheet/CapSheet/CapSheet.tsx'
  );
  const capSummaryTilesPath = path.join(
    architectRoot,
    'capSheet/CapSheet/CapSummaryTiles.tsx'
  );
  const exceptionTrackerPath = path.join(
    architectRoot,
    'capSheet/ExceptionTracker/ExceptionTracker.tsx'
  );

  it('keeps CapSheet as the selected-year composition owner and CapSummaryTiles as a handed-in canonical totals consumer', () => {
    const capSheetSource = fs.readFileSync(capSheetPath, 'utf-8');
    const capSummaryTilesSource = fs.readFileSync(capSummaryTilesPath, 'utf-8');

    expect(capSheetSource).toMatch(
      /const\s+canonicalTotals\s*=\s*React\.useMemo\s*\(\s*\(\)\s*=>\s*computeTeamCapTotals\s*\(/
    );
    expect(capSheetSource.match(/computeTeamCapTotals\s*\(/g) || []).toHaveLength(1);
    expect(capSheetSource).toContain(
      'const summaryHardCapStatus = React.useMemo(() => {'
    );
    expect(capSheetSource).toContain('return getHardCapStatus(teamCapSheet, {');
    expect(capSheetSource).toMatch(
      /<CapSummaryTiles[\s\S]*canonicalTotals=\{canonicalTotals\}[\s\S]*hardCapStatus=\{summaryHardCapStatus\}/
    );
    expect(capSheetSource).toContain('Selected-Year Supporting Detail');
    expect(capSheetSource).toContain(
      'This breakdown reads the same selected-year canonical totals as'
    );

    expect(capSummaryTilesSource).toContain(
      'canonicalTotals: ReturnType<typeof computeTeamCapTotals>;'
    );
    expect(capSummaryTilesSource).not.toContain('getHardCapStatus');
    expect(capSummaryTilesSource).not.toMatch(/computeTeamCapTotals\s*\(/);
    expect(capSummaryTilesSource).toContain(
      'selectedYear === currentYear && Boolean(hardCapStatus)'
    );
  });

  it('keeps current-season-only adjacent authority and the split control-strip signaling explicit in source', () => {
    const capSheetSource = fs.readFileSync(capSheetPath, 'utf-8');
    const exceptionTrackerSource = fs.readFileSync(exceptionTrackerPath, 'utf-8');

    expect(capSheetSource).toContain('Selected-Year Mutation Entry Point');
    expect(capSheetSource).toContain('Current-Season-Only Adjacent Authority');
    expect(capSheetSource).toContain(
      'cap-sheet-future-year-exception-edit-boundary'
    );
    expect(capSheetSource).toContain(
      'Viewing {selectedSeasonLabel} does not create'
    );
    expect(capSheetSource).toMatch(
      /<ManageExceptionsModal[\s\S]*currentYear=\{currentYear\}/
    );
    expect(capSheetSource).not.toMatch(
      /<ManageExceptionsModal[\s\S]*currentYear=\{selectedYear\}/
    );

    expect(exceptionTrackerSource).toContain(
      'const isViewingCurrentYear = selectedYear === currentYear;'
    );
    expect(exceptionTrackerSource).toContain(
      'cap-sheet-future-year-boundary-panel'
    );
    expect(exceptionTrackerSource).toContain(
      'No future-year hard-cap, exception, or trade-exception authority is'
    );
    expect(exceptionTrackerSource).toMatch(
      /Switch back to the current season to view the[\s\S]*live hard-cap and exception surface\./
    );
    expect(exceptionTrackerSource).toContain(
      'cap-sheet-current-season-authority-banner'
    );
    expect(exceptionTrackerSource).not.toMatch(/computeTeamCapTotals\s*\(/);
  });
});

describe('MYCT Step 4 Guardrails - Runtime Consumer Surfaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hardCapHarness.status = {
      isHardCapped: true,
      hardCapCeiling: 179_000_000,
      hardCapCeilingType: 'FIRST_APRON',
      hardCapCeilingLabel: '1st Apron',
      reason: 'Triggered by Non-Taxpayer MLE',
    };
    vi.mocked(getCapSettingsForYear).mockReturnValue({
      salaryCap: 141_000_000,
      luxuryTax: 171_000_000,
      firstApron: 179_000_000,
      secondApron: 189_000_000,
      fullMLE: 12_800_000,
      taxpayerMLE: 5_000_000,
      bae: 4_700_000,
      roomMLE: 7_900_000,
      _meta: {
        source: 'test',
        warnings: [],
        seasonKey: '2025-26',
        resolved: true,
      },
    } as ReturnType<typeof getCapSettingsForYear>);
    vi.mocked(canUseRoomException).mockReturnValue({
      eligible: true,
      reason: 'Under cap',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps canonical summary and supporting detail on the selected-year totals while current-season authority stays visibly separate', () => {
    const { currentTotals } = renderCapSheetSection();

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
    const breakdownSurface = within(rosterSurface).getByRole('region', {
      name: 'Selected-year canonical totals breakdown surface',
    });
    const controlSurface = within(rosterSurface).getByTestId(
      'cap-sheet-control-surface'
    );
    const adjacentSurface = screen.getByRole('region', {
      name: 'Adjacent current-season authority surface',
    });

    expect(shellTruthPanel).toHaveTextContent('Cap table: 2025-26');
    expect(shellTruthPanel).toHaveTextContent('Adjacent authority: 2025-26');

    expect(
      within(summarySurface).getByTestId('cap-summary-surface-truth-banner')
    ).toHaveTextContent('Canonical totals: 2025-26');
    expect(
      within(summarySurface).getByTestId('cap-summary-surface-truth-banner')
    ).toHaveTextContent('Hard-cap badge authority: 2025-26');
    expect(
      within(summarySurface).getByText(formatMoney(currentTotals.totalCapAllocations))
    ).toBeInTheDocument();
    expect(
      within(summarySurface).getByText('Hard Capped at 1st Apron')
    ).toBeInTheDocument();

    expect(
      within(rosterSurface).getByText('Selected-Year Supporting Detail')
    ).toBeInTheDocument();
    expect(
      within(rosterSurface).getByText(
        /the selected-year canonical totals for 2025-26/i
      )
    ).toBeInTheDocument();
    expect(
      within(breakdownSurface).getByText(
        /This breakdown reads the same selected-year canonical totals as the summary tiles\./i
      )
    ).toBeInTheDocument();
    expect(
      within(breakdownSurface).getByText(
        formatMoney(currentTotals.totalCapAllocations)
      )
    ).toBeInTheDocument();

    expect(
      within(controlSurface).getByText('Selected-Year Mutation Entry Point')
    ).toBeInTheDocument();
    expect(
      within(controlSurface).getByText('Current-Season-Only Adjacent Authority')
    ).toBeInTheDocument();
    expect(within(controlSurface).getByText('Input season: 2025-26')).toBeInTheDocument();
    expect(
      within(controlSurface).getByText('Authority season: 2025-26')
    ).toBeInTheDocument();
    expect(
      within(controlSurface).getByText('Selected-year view: 2025-26')
    ).toBeInTheDocument();
    expect(
      within(controlSurface).getByRole('button', {
        name: /manage dead money/i,
      })
    ).toBeEnabled();
    expect(
      within(controlSurface).getByRole('button', {
        name: /manage exceptions/i,
      })
    ).toBeEnabled();

    expect(
      within(adjacentSurface).getByTestId(
        'cap-sheet-current-season-authority-banner'
      )
    ).toHaveTextContent('Authority season: 2025-26');
    expect(
      within(adjacentSurface).getByTestId(
        'cap-sheet-current-season-authority-banner'
      )
    ).toHaveTextContent('Selected-year view: 2025-26');
    expect(within(adjacentSurface).getByText('Hard Capped')).toBeInTheDocument();
    expect(
      within(adjacentSurface).getByText('Trade Exceptions')
    ).toBeInTheDocument();
  });

  it('fails closed for future years and keeps chips, disabled states, and boundary notes aligned with current-season-only exception authority', async () => {
    const { futureTotals } = renderCapSheetSection();

    const controlSurface = screen.getByTestId('cap-sheet-control-surface');
    fireEvent.click(
      within(controlSurface).getByRole('button', {
        name: /manage exceptions/i,
      })
    );

    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Manage Exceptions Modal | 2026'
    );

    fireEvent.click(screen.getByRole('button', { name: '2026-27' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

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
    const breakdownSurface = within(rosterSurface).getByRole('region', {
      name: 'Selected-year canonical totals breakdown surface',
    });
    const adjacentSurface = screen.getByRole('region', {
      name: 'Adjacent current-season authority surface',
    });

    expect(shellTruthPanel).toHaveTextContent('Cap table: 2026-27');
    expect(shellTruthPanel).toHaveTextContent('Adjacent authority: 2025-26 only');

    expect(
      within(summarySurface).getByTestId('cap-summary-surface-truth-banner')
    ).toHaveTextContent('Canonical totals: 2026-27');
    expect(
      within(summarySurface).getByTestId('cap-summary-surface-truth-banner')
    ).toHaveTextContent('Hard-cap badge authority: 2025-26 only');
    expect(
      within(summarySurface).getByText(formatMoney(futureTotals.totalCapAllocations))
    ).toBeInTheDocument();
    expect(
      within(breakdownSurface).getByText(
        formatMoney(futureTotals.totalCapAllocations)
      )
    ).toBeInTheDocument();
    expect(
      within(summarySurface).queryByText('Hard Capped at 1st Apron')
    ).not.toBeInTheDocument();

    expect(
      within(controlSurface).getByText('Authority season: 2025-26 only')
    ).toBeInTheDocument();
    expect(
      within(controlSurface).getByText('Selected-year view: 2026-27')
    ).toBeInTheDocument();
    expect(
      within(controlSurface).getByTestId(
        'cap-sheet-future-year-exception-edit-boundary'
      )
    ).toHaveTextContent(
      'Viewing 2026-27 does not create future-year exception authority.'
    );
    expect(
      within(controlSurface).getByRole('button', {
        name: /manage exceptions/i,
      })
    ).toBeDisabled();

    const futureYearBoundaryPanel = within(adjacentSurface).getByTestId(
      'cap-sheet-future-year-boundary-panel'
    );
    expect(futureYearBoundaryPanel).toHaveTextContent(
      'No future-year hard-cap, exception, or trade-exception authority is shown here.'
    );
    expect(futureYearBoundaryPanel).toHaveTextContent(
      'Selected-year view: 2026-27'
    );
    expect(futureYearBoundaryPanel).toHaveTextContent(
      'Authority season: 2025-26 only'
    );
    expect(futureYearBoundaryPanel).toHaveTextContent(
      'hard-cap, exception, and TPE state is only authoritative for 2025-26'
    );
    expect(
      within(adjacentSurface).queryByTestId(
        'cap-sheet-current-season-authority-banner'
      )
    ).not.toBeInTheDocument();
    expect(within(adjacentSurface).queryByText('Hard Capped')).not.toBeInTheDocument();
  });
});
