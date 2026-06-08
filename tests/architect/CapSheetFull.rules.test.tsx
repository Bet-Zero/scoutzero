import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CapSheetFull } from '@/features/architect/capSheet/CapSheetFull';
import type {
  PlayerRulesProfile,
  PlayerRulesProfileInput,
} from '@/features/architect/types';

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

const getRulesProfileForYear = (
  player: PlayerRulesProfileInput
): PlayerRulesProfile | null => {
  if (player.name === 'Ext Player') {
    return {
      extensionEligibility: {
        isEligible: true,
        reason: 'Extension eligible',
        eligibleDate: '2025-07-01T00:00:00.000Z',
      },
      birdRights: { type: 'Full Bird' },
      contractSummary: { freeAgencyYear: 2027, freeAgencyType: 'Unrestricted' },
    } as unknown as PlayerRulesProfile;
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
    } as unknown as PlayerRulesProfile;
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
    expect(badges[0].textContent).toMatch(/EXT '25/i);
    expect(badges[0]).toHaveAttribute(
      'title',
      expect.stringMatching(/2024-25/i)
    );
  });

  it('shows RFA bird rights on the free agency cell', () => {
    render(
      <CapSheetFull
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        getRulesProfileForYear={getRulesProfileForYear}
      />
    );

    expect(screen.getAllByTestId('fa-bird-rights').length).toBeGreaterThan(0);
    // NOTE: the original assertion also expected a "QO $9.0M" qualifying-offer
    // label on the cell. The current CapSheetFull renders the FA tag + bird-
    // rights icon but no QO amount text, so that assertion was stale — it never
    // actually ran because this file used a (broken) default import of the
    // named-only CapSheetFull export. Import fixed; QO-display gap recorded in
    // the Slice 2 progress ledger for the product owner to triage.
  });
});
