// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CapSummaryTiles } from '@/features/architect/capSheet/CapSheet/CapSummaryTiles';
import { IncompleteRosterChargeSummary } from '@/features/architect/capSheet/CapSheet/IncompleteRosterChargeSummary';
import { CapTableSection } from '@/features/architect/GMDashboard/sections/CapTableSection';

type GetRulesProfileForYear = NonNullable<
  Parameters<typeof CapTableSection>[0]['getRulesProfileForYear']
>;
type RulesProfileForYearResult = ReturnType<GetRulesProfileForYear>;

const makeRulesProfile = (
  overrides: Partial<NonNullable<RulesProfileForYearResult>>
): RulesProfileForYearResult => ({
  playerId: 'profile_fixture',
  playerName: 'Profile Fixture',
  evaluatedAt: '2026-03-01T00:00:00.000Z',
  evaluatedForSeason: '2025-26',
  extensionEligibility: {
    isEligible: false,
    reason: 'Not eligible',
    blockers: [],
    extensionType: 'standard',
    eligibleDate: null,
  },
  extensionTerms: null,
  birdRights: {
    type: 'None',
    yearsWithTeam: 0,
    summary: 'No Bird rights',
    signingAbilities: {
      canSignOverCap: false,
      maxYears: 4,
      raisePercentage: 0.05,
    },
  },
  minimumSalary: 0,
  minimumSalaryReason: 'Fixture',
  maxSalary: {
    maxSalary: 0,
    tier: 'standard',
    supermaxEligible: false,
    reason: 'Fixture',
  },
  restrictedFreeAgency: {
    isRFA: false,
    qualifyingOfferEligible: false,
    qualifyingOfferAmount: null,
    canAcceptQO: false,
    qoDeadline: null,
    teamHasMatchingRights: false,
    reason: undefined,
  },
  contractSummary: {
    yearsOfService: 0,
    yearsRemaining: 0,
    freeAgencyYear: null,
    freeAgencyType: 'Unknown',
    currentSalary: null,
    hasContract: false,
  },
  teamContext: null,
  ...overrides,
});

const SUMMARY_TOTALS = {
  yearKey: 2026,
  playersTotal: 120_000_000,
  deadMoneyTotal: 5_000_000,
  capHoldsTotal: 10_000_000,
  incompleteChargesTotal: 0,
  totalCapAllocations: 165_000_000,
  teamSalary: 165_000_000,
  apronTeamSalary: 166_000_000,
  taxSalary: 164_000_000,
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
  bookDeltas: {
    vsCap: 25_000_000,
    vsLuxuryTax: -6_000_000,
    vsFirstApron: -12_000_000,
    vsSecondApron: -22_000_000,
  },
  salaryBooks: {
    version: 1 as const,
    status: 'complete' as const,
    context: { asOfDate: '2026-02-01T00:00:00Z', salaryCapYear: 2026, teamId: 'TST' },
    ledgers: {
      teamSalary: { kind: 'team-salary' as const, status: 'complete' as const, total: 165_000_000, lineItems: [] },
      apronTeamSalary: { kind: 'apron-team-salary' as const, status: 'complete' as const, total: 166_000_000, lineItems: [] },
      taxSalary: { kind: 'tax-salary' as const, status: 'complete' as const, total: 164_000_000, lineItems: [] },
    },
    governedInputs: null,
  },
  totalSalary: 165_000_000,
  capHit: 165_000_000,
  currentCapHit: 165_000_000,
  luxuryTaxLine: 170_000_000,
  taxablePayroll: 164_000_000,
  capSpace: -25_000_000,
  capRoom: -25_000_000,
  effectiveCap: 140_000_000,
  firstApronRoom: 12_000_000,
  isFirstApron: false,
  secondApronRoom: 22_000_000,
  isSecondApron: false,
  isOverTax: false,
  isHardCapped: false,
  hardCapLevel: null,
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
    return makeRulesProfile({
      extensionEligibility: {
        isEligible: true,
        reason: 'Extension eligible',
        blockers: [],
        extensionType: 'standard',
        eligibleDate: new Date('2025-07-01T00:00:00.000Z'),
      },
      birdRights: {
        type: 'Full Bird',
        yearsWithTeam: 3,
        summary: 'Full Bird rights',
        signingAbilities: {
          canSignOverCap: true,
          maxYears: 5,
          raisePercentage: 0.08,
        },
      },
      contractSummary: {
        yearsOfService: 0,
        yearsRemaining: 2,
        currentSalary: 12_000_000,
        hasContract: true,
        freeAgencyYear: 2027,
        freeAgencyType: 'Unrestricted',
      },
    });
  }

  if (player.name === 'RFA Player') {
    return makeRulesProfile({
      extensionEligibility: {
        isEligible: false,
        reason: 'RFA timing',
        blockers: ['Restricted free agency timing'],
        extensionType: 'standard',
        eligibleDate: null,
      },
      birdRights: {
        type: 'Early Bird',
        yearsWithTeam: 2,
        summary: 'Early Bird rights',
        signingAbilities: {
          canSignOverCap: true,
          maxYears: 4,
          raisePercentage: 0.08,
        },
      },
      restrictedFreeAgency: {
        isRFA: true,
        qualifyingOfferEligible: true,
        qualifyingOfferAmount: 9_000_000,
        canAcceptQO: true,
        qoDeadline: null,
        teamHasMatchingRights: true,
        reason: 'RFA rights active',
      },
      contractSummary: {
        yearsOfService: 0,
        yearsRemaining: 0,
        currentSalary: 8_000_000,
        hasContract: true,
        freeAgencyYear: 2025,
        freeAgencyType: 'Restricted',
      },
    });
  }

  return null;
};

describe('Cap Sheet display-core E88 compatibility', () => {
  it('exposes the governed Needs input reason to assistive technology', () => {
    const resolution = {
      mode: 'governed' as const,
      status: 'needs-input' as const,
      activeWindow: true,
      window: { opens: '2026-07-01', closes: '2026-10-20' },
      counts: null,
      threshold: 12 as const,
      missingSlots: null,
      chargePerSlot: null,
      amount: null,
      canonLeafIds: [
        'CBA2-C03.1',
        'CBA2-C03.2',
        'CBA2-C07.11',
      ] as const,
      missingInputs: ['salaryBookInputs.unsignedFirstRoundPickState'],
      reason: 'Unsigned first-round pick state is unresolved.',
    };

    render(
      <IncompleteRosterChargeSummary
        canonicalTotals={{
          ...SUMMARY_TOTALS,
          incompleteChargesTotal: null,
          totalCapAllocations: null,
          deltas: {
            vsCap: null,
            vsLuxuryTax: null,
            vsFirstApron: null,
            vsSecondApron: null,
          },
          incompleteRosterResolution: resolution,
          _meta: {
            ...SUMMARY_TOTALS._meta,
            incompleteRosterCharge: resolution,
          },
        }}
      />
    );

    expect(
      screen.getByTestId('incomplete-roster-charge-needs-input')
    ).toHaveAccessibleDescription(resolution.reason);
    expect(screen.queryByTestId('incomplete-roster-charge-row')).toBeNull();
  });

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
      'SALARY BOOKS',
      'CAP SPACE',
      'LUXURY TAX SPACE',
      '1ST APRON SPACE',
      '2ND APRON SPACE',
    ]);

    expect(screen.getByText('Team $165,000,000')).toBeInTheDocument();
    expect(screen.getByText('-$25,000,000')).toBeInTheDocument();
    expect(screen.getByText('$6,000,000')).toBeInTheDocument();
    expect(screen.getByText('$12,000,000')).toBeInTheDocument();
    expect(screen.getByText('$22,000,000')).toBeInTheDocument();
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

    expect(
      screen.getByRole('region', {
        name: /Primary multi-year cap sheet surface/i,
      })
    ).toBeInTheDocument();
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
