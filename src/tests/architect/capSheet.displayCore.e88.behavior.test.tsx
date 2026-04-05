// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import CapSummaryTiles from '@/features/architect/capSheet/CapSheet/CapSummaryTiles';
import { CapTableSection } from '@/features/architect/GMDashboard/sections/CapTableSection';

type GetRulesProfileForYear = NonNullable<
  Parameters<typeof CapTableSection>[0]['getRulesProfileForYear']
>;

const SUMMARY_TOTALS = {
  yearKey: 2026,
  playersTotal: 120_000_000,
  deadMoneyTotal: 5_000_000,
  capHoldsTotal: 10_000_000,
  incompleteChargesTotal: 0,
  totalCapAllocations: 165_000_000,
  salaryCap: 140_000_000,
  luxuryTax: 170_000_000,
  firstApron: 178_000_000,
  secondApron: 188_000_000,
  deltas: {
    vsCap: 25_000_000,
    vsLuxuryTax: -5_000_000,
    vsFirstApron: -13_000_000,
    vsSecondApron: -23_000_000,
  },
  _meta: {
    source: 'computeTeamCapTotals' as const,
    rulesSource: 'reported',
    rulesSourcesSummary: 'reported',
    rulesSources: null,
    capSettingsSource: 'via_facade' as const,
    seasonKey: '2025-26',
    incompleteRosterCharge: null,
  },
};

const FIRST_APRON_HARD_CAP_STATUS = {
  isHardCapped: true,
  hardCapCeilingType: 'FIRST_APRON',
  hardCapCeilingLabel: '1st Apron',
  reason: 'Hard cap triggered at First Apron via Non-Taxpayer MLE usage.',
};

const SECOND_APRON_HARD_CAP_STATUS = {
  isHardCapped: true,
  hardCapCeilingType: 'SECOND_APRON',
  hardCapCeilingLabel: '2nd Apron',
  reason: 'Structured second-apron tile reason',
};

const TEAM_CAP_SHEET = {
  teamCode: 'TST',
  players: [
    {
      name: 'Ext Player',
      contract: {
        contractType: 'Standard',
        salariesByYear: [
          { season: '2024-25', salary: 11_000_000 },
          { season: '2025-26', salary: 12_000_000 },
        ],
        freeAgency: { year: 2027, type: 'Unrestricted' },
      },
    },
    {
      name: 'RFA Player',
      contract: {
        contractType: 'Standard',
        salariesByYear: [{ season: '2024-25', salary: 8_000_000 }],
        freeAgency: { year: 2025, type: 'Restricted' },
      },
    },
  ],
  capHolds: [
    {
      playerId: 'hold_fixture',
      playerName: 'Hold Fixture',
      season: '2025-26',
      amount: 4_250_000,
      type: 'Bird Rights',
      isSigned: false,
    },
  ],
};

const getRulesProfileForYear: GetRulesProfileForYear = (player) => {
  if (!player) {
    return null;
  }
  if (player.name === 'Ext Player') {
    return {
      extensionEligibility: {
        isEligible: true,
        reason: 'Extension eligible',
        eligibleDate: '2025-07-01T00:00:00.000Z',
      },
      birdRights: { type: 'Full Bird' },
      contractSummary: { freeAgencyYear: 2027, freeAgencyType: 'Unrestricted' },
    } as any;
  }

  if (player.name === 'RFA Player') {
    return {
      extensionEligibility: { isEligible: false, reason: 'RFA timing' },
      birdRights: { type: 'Early Bird' },
      restrictedFreeAgency: {
        isRFA: true,
        qualifyingOfferEligible: true,
        qualifyingOfferAmount: 9_000_000,
        reason: 'RFA rights active',
      },
      contractSummary: { freeAgencyYear: 2025, freeAgencyType: 'Restricted' },
    } as any;
  }

  return null;
};

describe('Cap Sheet display-core E88 compatibility', () => {
  it('renders CapSummaryTiles in the existing visible order with canonical hard-cap compatibility intact', () => {
    const { container } = render(
      <CapSummaryTiles
        currentYear={2026}
        selectedYear={2026}
        canonicalTotals={SUMMARY_TOTALS}
        hardCapStatus={FIRST_APRON_HARD_CAP_STATUS}
      />
    );

    const labels = Array.from(container.querySelectorAll('div.text-sm')).map(
      (node) => node.textContent?.trim()
    );

    expect(labels).toEqual([
      'TOTAL CAP ALLOCATIONS',
      'CAP SPACE',
      'LUXURY TAX SPACE',
      '1ST APRON SPACE',
      '2ND APRON SPACE',
    ]);

    expect(screen.getByText('$165,000,000')).toBeInTheDocument();
    expect(screen.getByText('-$25,000,000')).toBeInTheDocument();
    expect(screen.getByText('$5,000,000')).toBeInTheDocument();
    expect(
      within(container).getByTestId('cap-summary-surface-truth-banner')
    ).toHaveTextContent('Canonical totals: 2025-26');
    expect(
      within(container).getByTestId('cap-summary-surface-truth-banner')
    ).toHaveTextContent('Hard-cap badge authority: 2025-26');
    expect(screen.getByText('Hard Capped at 1st Apron')).toBeInTheDocument();
    expect(
      screen.getByText('Hard cap triggered at First Apron via Non-Taxpayer MLE usage.')
    ).toBeInTheDocument();
  });

  it('renders second-apron lock copy from canonical structured hard-cap state', () => {
    render(
      <CapSummaryTiles
        currentYear={2026}
        selectedYear={2026}
        canonicalTotals={SUMMARY_TOTALS}
        hardCapStatus={SECOND_APRON_HARD_CAP_STATUS}
      />
    );

    expect(screen.getByText('Hard Capped at 2nd Apron')).toBeInTheDocument();
    expect(
      screen.getByText('Structured second-apron tile reason')
    ).toBeInTheDocument();
  });

  it('suppresses current-year hard-cap copy when the summary is switched to a future year', () => {
    const { container } = render(
      <CapSummaryTiles
        currentYear={2026}
        selectedYear={2027}
        canonicalTotals={{
          ...SUMMARY_TOTALS,
          yearKey: 2027,
        }}
        hardCapStatus={FIRST_APRON_HARD_CAP_STATUS}
      />
    );

    expect(
      within(container).getByTestId('cap-summary-surface-truth-banner')
    ).toHaveTextContent('Canonical totals: 2026-27');
    expect(
      within(container).getByTestId('cap-summary-surface-truth-banner')
    ).toHaveTextContent('Hard-cap badge authority: 2025-26 only');
    expect(
      within(container).queryByText('Hard Capped at 1st Apron')
    ).not.toBeInTheDocument();
    expect(
      within(container).queryByText(
        'Hard cap triggered at First Apron via Non-Taxpayer MLE usage.'
      )
    ).not.toBeInTheDocument();
  });

  it('keeps CapTableSection as a pass-through shell for CapSheetFull callbacks and rules-profile rendering', () => {
    const onOpenPlayerContractModal = vi.fn();
    const onLaunchContractAction = vi.fn();
    const onRenounceCapHold = vi.fn();

    render(
      <CapTableSection
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        onOpenPlayerContractModal={onOpenPlayerContractModal}
        onLaunchContractAction={onLaunchContractAction}
        onRenounceCapHold={onRenounceCapHold}
        getRulesProfileForYear={getRulesProfileForYear}
      />
    );

    expect(screen.getByText(/Future Cap Sheet/i)).toBeInTheDocument();
    expect(screen.getByTestId('extension-eligibility-badge')).toHaveTextContent(
      /EXT '25/i
    );

    fireEvent.click(screen.getByText('Ext Player'));
    expect(onOpenPlayerContractModal).toHaveBeenCalledTimes(1);
    expect(onOpenPlayerContractModal.mock.calls[0][0]).toMatchObject({
      name: 'Ext Player',
    });

    fireEvent.click(screen.getByText('RFA'));
    expect(onLaunchContractAction).toHaveBeenCalledTimes(1);
    expect(onLaunchContractAction.mock.calls[0][0]).toMatchObject({
      name: 'RFA Player',
    });
    expect(onLaunchContractAction.mock.calls[0][1]).toBe('rfa');
    expect(onLaunchContractAction.mock.calls[0][2]).toBe(2026);

    fireEvent.click(screen.getByTestId('cap-sheet-full-cap-holds-toggle'));
    fireEvent.click(screen.getByTestId('cap-sheet-full-absolve-button'));

    expect(onRenounceCapHold).toHaveBeenCalledTimes(1);
    expect(onRenounceCapHold.mock.calls[0][0]).toMatchObject({
      playerId: 'hold_fixture',
      playerName: 'Hold Fixture',
    });
  });
});
