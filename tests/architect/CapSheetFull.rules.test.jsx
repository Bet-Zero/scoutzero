import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import CapSheetFull from '@/features/architect/CapSheetFull.jsx';

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
};

const getRulesProfileForYear = (player) => {
  if (player.name === 'Ext Player') {
    return {
      extensionEligibility: { isEligible: true, reason: 'Extension eligible' },
      birdRights: { type: 'Full Bird' },
      contractSummary: { freeAgencyYear: 2027, freeAgencyType: 'Unrestricted' },
    };
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
    };
  }

  return null;
};

describe('CapSheetFull — rules profile indicators', () => {
  it('shows extension badge once when rules profile marks player eligible', () => {
    render(
      <CapSheetFull
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        getRulesProfileForYear={getRulesProfileForYear}
      />
    );

    const badges = screen.getAllByTestId('extension-eligibility-badge');
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveAttribute(
      'title',
      expect.stringMatching(/extension/i)
    );
  });

  it('shows RFA bird rights and qualifying offer info on free agency cell', () => {
    render(
      <CapSheetFull
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        getRulesProfileForYear={getRulesProfileForYear}
      />
    );

    expect(screen.getAllByTestId('fa-bird-rights').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/QO \$9\.0M/i).length).toBeGreaterThan(0);
  });
});
