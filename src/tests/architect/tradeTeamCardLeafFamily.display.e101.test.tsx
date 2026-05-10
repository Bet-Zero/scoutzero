/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CapImpactTiles } from '@/features/architect/tradeMachine/CapImpactTiles';
import { SelectTeamCard } from '@/features/architect/tradeMachine/SelectTeamCard';
import { TradeExceptionManager } from '@/features/architect/tradeMachine/TradeExceptionManager';

const {
  mockComputeTeamCapTotals,
  mockGetSalaryForYear,
  mockIsHardCappedAtFirstApron,
  mockIsHardCappedAtSecondApron,
  mockGetFirstApronHardCapReason,
} = vi.hoisted(() => ({
  mockComputeTeamCapTotals: vi.fn(),
  mockGetSalaryForYear: vi.fn(),
  mockIsHardCappedAtFirstApron: vi.fn(),
  mockIsHardCappedAtSecondApron: vi.fn(),
  mockGetFirstApronHardCapReason: vi.fn(),
}));

vi.mock('@/features/architect/utils/capTotals', () => ({
  computeTeamCapTotals: mockComputeTeamCapTotals,
}));

vi.mock('@/features/architect/utils/tradeHelpers', async () => {
  const actual =
    await vi.importActual<typeof import('@/features/architect/utils/tradeHelpers')>(
      '@/features/architect/utils/tradeHelpers'
    );

  return {
    ...actual,
    getSalaryForYear: mockGetSalaryForYear,
  };
});

vi.mock('@/features/architect/utils/hardCapUtils', () => ({
  isHardCappedAtFirstApron: mockIsHardCappedAtFirstApron,
  isHardCappedAtSecondApron: mockIsHardCappedAtSecondApron,
  getFirstApronHardCapReason: mockGetFirstApronHardCapReason,
}));

vi.mock('@/shared/components/TeamLogo', () => ({
  __esModule: true,
  default: ({
    teamId,
    className,
  }: {
    teamId?: string;
    className?: string;
  }) => <div data-testid="team-logo" data-team-id={teamId} className={className} />,
}));

describe('E101 Trade Team Card leaf-family display surfaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComputeTeamCapTotals.mockReturnValue({
      salaryCap: 140_000_000,
      firstApron: 150_000_000,
      secondApron: 160_000_000,
      capHoldsTotal: 5_000_000,
      totalCapAllocations: 120_000_000,
    });
    mockGetSalaryForYear.mockImplementation((assets: Array<{ amount?: number }> = []) =>
      assets.reduce((sum, asset) => sum + (asset.amount || 0), 0)
    );
    mockIsHardCappedAtFirstApron.mockReturnValue(false);
    mockIsHardCappedAtSecondApron.mockReturnValue(false);
    mockGetFirstApronHardCapReason.mockReturnValue('');
  });

  afterEach(() => {
    cleanup();
  });

  it('CapImpactTiles preserves tile label order, fallback math, and cap-holds wording', () => {
    render(
      <CapImpactTiles
        team={{ id: 'LAL' }}
        sends={[{ amount: 10_000_000 }]}
        incomingPlayers={[{ amount: 4_000_000 }]}
        yearKey={2026}
      />
    );

    const totalCapLabel = screen.getByText('TOTAL CAP');
    const capSpaceLabel = screen.getByText('CAP SPACE');
    const firstApronLabel = screen.getByText('1ST APRON');
    const secondApronLabel = screen.getByText('2ND APRON');

    expect(
      totalCapLabel.compareDocumentPosition(capSpaceLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      capSpaceLabel.compareDocumentPosition(firstApronLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      firstApronLabel.compareDocumentPosition(secondApronLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    expect(screen.getByText('$114.0M')).toBeInTheDocument();
    expect(screen.getByText('$26.0M')).toBeInTheDocument();
    expect(screen.getByText('$36.0M')).toBeInTheDocument();
    expect(screen.getByText('$46.0M')).toBeInTheDocument();
    expect(
      screen.getByText('Cap Holds (not in projected): $5.0M')
    ).toBeInTheDocument();
  });

  it('CapImpactTiles preserves snapshot-over-fallback behavior and validating indicator wording', () => {
    render(
      <CapImpactTiles
        team={{ id: 'LAL', teamTotalSalary: 136_000_000 }}
        sends={[{ amount: 10_000_000 }]}
        incomingPlayers={[{ amount: 4_000_000 }]}
        yearKey={2026}
        snapshot={{ projectedSalary: 130_000_000 }}
        isValidating
      />
    );

    expect(screen.getByText('$130.0M')).toBeInTheDocument();
    expect(screen.getByText('$10.0M')).toBeInTheDocument();
    expect(screen.getByText('Validating...')).toBeInTheDocument();
  });

  it('SelectTeamCard preserves visible wording plus select/remove wiring', () => {
    const onSelectTeam = vi.fn();
    const onRemove = vi.fn();

    render(
      <SelectTeamCard onSelectTeam={onSelectTeam} onRemove={onRemove} />
    );

    expect(screen.getByText('Select Team', { selector: 'label' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Select Team');

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'hawks' },
    });
    fireEvent.click(screen.getByRole('button', { name: '✕' }));

    expect(onSelectTeam).toHaveBeenCalledWith('hawks');
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('TradeExceptionManager preserves active/expired wording, filtering, and ordering', () => {
    render(
      <TradeExceptionManager
        teamId="LAL"
        exceptions={[
          {
            id: 'active-exception',
            name: 'Active Exception',
            amount: 5_000_000,
            expirationDate: '2099-01-01',
          },
          {
            id: 'expired-exception',
            name: 'Expired Exception',
            amount: 2_500_000,
            expirationDate: '2000-01-01',
          },
          {
            id: 'used-exception',
            name: 'Used Exception',
            amount: 1_000_000,
            expirationDate: '2099-01-01',
            isUsed: true,
          },
        ]}
      />
    );

    const activeRow = screen.getByText('Active Exception');
    const expiredHeading = screen.getByText('Expired');
    const expiredRow = screen.getByText('Expired Exception');

    expect(screen.getByText('Available Trade Exceptions')).toBeInTheDocument();
    expect(screen.queryByText('Used Exception')).not.toBeInTheDocument();
    expect(
      activeRow.compareDocumentPosition(expiredHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      expiredHeading.compareDocumentPosition(expiredRow) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Trade exceptions allow acquiring players without matching salary.'
      )
    ).toBeInTheDocument();
  });
});
