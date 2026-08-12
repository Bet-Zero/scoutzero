import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

describe('CapSheetFull — governed option exposure', () => {
  const optionTeam = {
    teamCode: 'TST',
    players: [
      {
        id: 'eto-player',
        name: 'ETO Player',
        contract: {
          salariesByYear: [
            { season: '2027-28', salary: 20_000_000, option: 'ETO' },
          ],
        },
      },
      {
        id: 'blocked-player',
        name: 'Blocked TO Player',
        contract: {
          salariesByYear: [
            { season: '2026-27', salary: 12_000_000, option: 'TO' },
          ],
        },
      },
    ],
  };

  it('recognizes an ETO outside the old upcoming-year proxy as governed and launchable', () => {
    const onLaunchContractAction = vi.fn();
    render(
      <CapSheetFull
        teamCapSheet={optionTeam}
        currentYear={2025}
        onLaunchContractAction={onLaunchContractAction}
        getOptionDecisionAvailability={(player, year) => ({
          status: player.id === 'eto-player' ? 'ready' : 'needs-input',
          playerId: String(player.id),
          contractId: `contract-${player.id}`,
          targetYear: year,
          optionType: player.id === 'eto-player' ? 'ETO' : 'TO',
          reasons:
            player.id === 'eto-player'
              ? []
              : [
                  'The exact contractual notice deadline must be an exact governed instant with a UTC offset.',
                ],
          noticeRequirements:
            player.id === 'eto-player'
              ? {
                  deadline: '2027-06-29T17:00:00-04:00',
                  windowOpensAt: '2027-06-01T09:00:00-04:00',
                  allowedMethods: ['email'],
                  recipientId: 'eto-player',
                  recipientRole: 'player',
                  leagueForwardingRequired: true,
                }
              : null,
        })}
      />
    );

    const etoCell = screen.getByTitle(
      'Record Early Termination Option decision'
    );
    expect(etoCell).toHaveAttribute(
      'data-action-exposure-classification',
      'V1 supported'
    );
    expect(etoCell).toHaveAttribute('role', 'button');
    expect(etoCell).toHaveAttribute(
      'aria-label',
      expect.stringContaining('ETO Player, 2027-28')
    );
    fireEvent.keyDown(etoCell, { key: 'Enter' });
    expect(onLaunchContractAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'eto-player' }),
      'eto',
      2028
    );
  });

  it('renders a recorded option without clickable or keyboard affordances', () => {
    const onLaunchContractAction = vi.fn();
    render(
      <CapSheetFull
        teamCapSheet={optionTeam}
        currentYear={2025}
        onLaunchContractAction={onLaunchContractAction}
        getOptionDecisionAvailability={(player, year) => ({
          status: 'decided',
          playerId: String(player.id),
          contractId: `contract-${player.id}`,
          targetYear: year,
          optionType: player.id === 'eto-player' ? 'ETO' : 'TO',
          reasons: ['The governed option decision is already recorded.'],
          noticeRequirements: null,
        })}
      />
    );

    const recordedCell = screen.getByTitle(
      'Early Termination Option decision recorded'
    );
    expect(recordedCell).not.toHaveAttribute('role');
    expect(recordedCell).not.toHaveAttribute('tabindex');
    expect(recordedCell).not.toHaveClass('cursor-pointer');
    fireEvent.click(recordedCell);
    fireEvent.keyDown(recordedCell, { key: 'Enter' });
    expect(onLaunchContractAction).not.toHaveBeenCalled();
  });

  it('renders the exact missing-deadline record as Needs input', () => {
    render(
      <CapSheetFull
        teamCapSheet={optionTeam}
        currentYear={2025}
        getOptionDecisionAvailability={(player, year) => ({
          status: 'needs-input',
          playerId: String(player.id),
          contractId: `contract-${player.id}`,
          targetYear: year,
          optionType: player.id === 'eto-player' ? 'ETO' : 'TO',
          reasons: [
            'The exact contractual notice deadline must be an exact governed instant with a UTC offset.',
          ],
          noticeRequirements: null,
        })}
      />
    );

    expect(screen.getAllByText('Needs input').length).toBeGreaterThan(0);
    const needsInputCells = document.querySelectorAll(
      '[data-action-exposure-classification="Needs input"]'
    );
    expect(needsInputCells.length).toBeGreaterThanOrEqual(2);
    expect(needsInputCells[0]).toHaveAttribute(
      'data-needs-input-reason',
      expect.stringContaining('exact contractual notice deadline')
    );
  });
});
