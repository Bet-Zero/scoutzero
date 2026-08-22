import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EditContractModal } from '@/shared/components/EditContractModal';

type TeamSelectDropdownProps = {
  selectedTeamId?: string | null;
  onChange: (teamId: string) => void;
};

// Stub TeamSelectDropdown so the S&T destination picker is testable
vi.mock('@/shared/components/TeamSelectDropdown', () => {
  const TeamSelectDropdown = ({ selectedTeamId, onChange }: TeamSelectDropdownProps) => (
    <select data-testid="team-select" value={selectedTeamId || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select Team</option>
      <option value="BOS">Boston Celtics</option>
    </select>
  );
  return { default: TeamSelectDropdown, TeamSelectDropdown };
});

// Mock environment variable to enable override functionality for tests
// In production, this would be false to prevent illegal state creation
beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_CBA_OVERRIDE', 'true');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const BASE_PLAYER = {
  name: 'Test Player',
  playerId: 'test_player',
  contract: {
    contractType: 'Standard',
    originalLength: 3,
    salariesByYear: [
      { season: '2024-25', salary: 12_000_000, capHit: 12_000_000, guaranteed: true },
    ],
    freeAgency: {
      type: 'Unrestricted',
      year: 2025,
    },
  },
};

const TEAM_CAP_SHEET = {
  teamCode: 'TST',
  players: [BASE_PLAYER],
};

const INELIGIBLE_PROFILE = {
  extensionEligibility: {
    isEligible: false,
    reason: 'Not extension eligible',
  },
  extensionTerms: null,
  birdRights: {},
  restrictedFreeAgency: {},
  contractSummary: {},
};

const ELIGIBLE_PROFILE = {
  extensionEligibility: {
    isEligible: true,
    reason: 'Eligible',
    extensionType: 'Veteran Extension',
  },
  // Terms must be coherent with BASE_PLAYER's $12M salary: the form clamps
  // the prefill to the extension-mutation first-year max (currentSalary ×
  // 1.05 = $12.6M, mirroring extensionRules.ts), so a real profile for this
  // player could never carry a $15M floor.
  extensionTerms: {
    maxYears: 3,
    maxFirstYearSalary: 12_500_000,
    minFirstYearSalary: 10_000_000,
    raisePercentage: 0.08,
    extensionType: 'Veteran Extension',
    basedOn: 'Test range',
    notes: 'Profile-driven terms',
  },
  birdRights: {},
  restrictedFreeAgency: {},
  contractSummary: {},
};

const READY_EXTENSION_AVAILABILITY = {
  status: 'ready' as const,
  playerId: 'test_player',
  contractId: 'contract-test-player',
  reasons: [],
  suggestedRoute: 'veteran' as const,
  allowedRoutes: ['veteran' as const],
  firstExtendedSeason: '2025-26',
};

const READY_ROOKIE_EXTENSION_AVAILABILITY = {
  ...READY_EXTENSION_AVAILABILITY,
  suggestedRoute: 'rookie-scale' as const,
  allowedRoutes: ['rookie-scale' as const],
};

const RFA_PROFILE = {
  extensionEligibility: {
    isEligible: false,
    reason: 'RFA timing',
  },
  extensionTerms: null,
  birdRights: {
    type: 'Early Bird',
    signingAbilities: {
      maxFirstYearSalary: 20_000_000,
    },
  },
  restrictedFreeAgency: {
    isRFA: true,
    qualifyingOfferEligible: true,
    qualifyingOfferAmount: 8_000_000,
    reason: 'Qualifying offer required',
  },
  contractSummary: {
    freeAgencyYear: 2025,
    freeAgencyType: 'Restricted',
  },
};

const RFA_PLAYER = {
  name: 'RFA Player',
  playerId: 'rfa_player',
  freeAgentYear: 2025,
};

describe('EditContractModal — PlayerRulesProfile integration', () => {
  afterEach(() => cleanup());

  it('disables extend action and confirm when governed evidence is absent', async () => {
    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={BASE_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        worldAsOfDate="2024-07-08"
        initialAction="extend"
        playerRulesProfile={INELIGIBLE_PROFILE}
      />
    );

    const extendOption = screen.getByLabelText(/extend contract/i);
    expect(extendOption).toBeDisabled();

    const confirmButton = screen.getByRole('button', {
      name: /authoritative preflight pending/i,
    });
    await waitFor(() => {
      expect(confirmButton).toBeDisabled();
    });
    expect(
      screen.getAllByText(/required contract and league information/i).length
    ).toBeGreaterThan(0);
  });

  it('does not treat a legacy rules profile as governed extension authority', async () => {
    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={BASE_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        worldAsOfDate="2024-07-08"
        initialAction="extend"
        playerRulesProfile={ELIGIBLE_PROFILE}
      />
    );

    const confirmButton = screen.getByRole('button', {
      name: /authoritative preflight pending/i,
    });
    await waitFor(() => {
      expect(confirmButton).toBeDisabled();
    });
    expect(screen.queryByText(/Advanced: Override Validation/i)).toBeNull();
  });

  it('shows extension disabled when player is not extension eligible (baseline rules)', async () => {
    // When no rulesProfile is provided, the component uses baseline rules
    // A player in their free agency year is not extension eligible - they need to sign a new contract
    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={BASE_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        worldAsOfDate="2024-07-08"
        initialAction="extend"
      />
    );

    const extendOption = screen.getByLabelText(/extend contract/i);
    // Extension should be disabled for a player in their free agency year
    await waitFor(() => {
      expect(extendOption).toBeDisabled();
    });

    // But the modal should still render and other options should work
    const waiveOption = screen.getByLabelText(/waive player/i);
    expect(waiveOption).toBeEnabled();
  });

  it('flags re-sign offers below qualifying offer when rules profile is present', async () => {
    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={RFA_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        worldAsOfDate="2024-07-08"
        initialAction="resign"
        playerRulesProfile={RFA_PROFILE}
      />
    );

    expect(screen.getByText(/rights\/exception/i)).toBeInTheDocument();
    expect(screen.getByText(/first-year range/i)).toBeInTheDocument();

    const salaryInput = screen.getAllByPlaceholderText('0')[0] as HTMLInputElement;
    fireEvent.change(salaryInput, { target: { value: '1000000' } });
    await waitFor(() => {
      const parsed = Number(salaryInput.value.replace(/[^0-9]/g, ''));
      expect(parsed).toBeGreaterThanOrEqual(8_000_000);
    });

    fireEvent.change(salaryInput, { target: { value: '20000000' } });
    const secondYearInput = screen.getAllByPlaceholderText('0')[1] as HTMLInputElement;
    fireEvent.change(secondYearInput, { target: { value: '25000000' } });

    await waitFor(() => {
      const parsed = Number(
        secondYearInput.value.replace(/[^0-9]/g, '')
      );
      expect(parsed).toBeLessThanOrEqual(21_600_000);
    });
  });
});

describe('EditContractModal — Override validation enforcement', () => {
  afterEach(() => cleanup());

  it('shows authoritative preflight pending when governed evidence is absent', async () => {
    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={BASE_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        worldAsOfDate="2024-07-08"
        initialAction="extend"
        playerRulesProfile={INELIGIBLE_PROFILE}
      />
    );

    // Try to select the extend action (it's disabled but we test the confirm button)
    const confirmButton = screen.getByRole('button', {
      name: /authoritative preflight pending/i,
    });
    
    await waitFor(() => {
      expect(confirmButton).toBeDisabled();
      expect(confirmButton).toHaveTextContent(/authoritative preflight pending/i);
    });
  });

  it('does not expose Advanced Override for governed extension evidence gaps', () => {
    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={BASE_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        worldAsOfDate="2024-07-08"
        initialAction="extend"
        playerRulesProfile={ELIGIBLE_PROFILE}
      />
    );

    expect(screen.queryByText(/Advanced: Override Validation/i)).toBeNull();
    expect(screen.queryByPlaceholderText('OVERRIDE')).toBeNull();
  });

  it('cannot unlock a governed extension with the development override flag', () => {
    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={BASE_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        worldAsOfDate="2024-07-08"
        initialAction="extend"
        playerRulesProfile={ELIGIBLE_PROFILE}
      />
    );

    const confirmButton = screen.getByRole('button', {
      name: /authoritative preflight pending/i,
    });
    expect(confirmButton).toBeDisabled();
    expect(screen.queryByRole('button', { name: /force override/i })).toBeNull();
  });

  it('does not emit an override audit for a governed evidence block', () => {
    const mockAuditLog = vi.fn();
    const mockOnExtend = vi.fn();
    const mockOnClose = vi.fn();

    render(
      <EditContractModal
        isOpen
        onClose={mockOnClose}
        onExtend={mockOnExtend}
        onAuditLog={mockAuditLog}
        player={BASE_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        worldAsOfDate="2024-07-08"
        initialAction="extend"
        playerRulesProfile={ELIGIBLE_PROFILE}
      />
    );

    expect(mockAuditLog).not.toHaveBeenCalled();
    expect(mockOnExtend).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('does not dispatch a governed extension without authority', () => {
    const mockOnExtend = vi.fn();
    const mockOnClose = vi.fn();

    render(
      <EditContractModal
        isOpen
        onClose={mockOnClose}
        onExtend={mockOnExtend}
        player={BASE_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        worldAsOfDate="2024-07-08"
        initialAction="extend"
        playerRulesProfile={ELIGIBLE_PROFILE}
      />
    );

    expect(mockOnExtend).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('does not show Advanced Override section when action is legal', async () => {
    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={BASE_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        worldAsOfDate="2024-07-08"
        initialAction="extend"
        extensionAvailability={READY_EXTENSION_AVAILABILITY}
        playerRulesProfile={ELIGIBLE_PROFILE}
      />
    );

    fireEvent.change(screen.getByTestId('governed-extension-signed-at'), {
      target: { value: '2025-07-08T12:00:00-04:00' },
    });

    // Wait for initial state
    await waitFor(() => {
      // With default prefill from rules profile, should be legal
      const confirmButton = screen.getByRole('button', { name: /confirm action/i });
      expect(confirmButton).toBeEnabled();
    });

    // Advanced Override section should NOT be visible
    expect(screen.queryByText(/Advanced: Override Validation/i)).not.toBeInTheDocument();
  });

  it('offers the governed fifth Rookie Scale extension Season', () => {
    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={BASE_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        worldAsOfDate="2024-07-08"
        initialAction="extend"
        extensionAvailability={READY_ROOKIE_EXTENSION_AVAILABILITY}
        playerRulesProfile={ELIGIBLE_PROFILE}
      />
    );

    const years = screen.getByTestId('contract-years') as HTMLSelectElement;
    const fifthYear = [...years.options].find((option) => option.value === '5');
    expect(fifthYear).toBeDefined();
    expect(fifthYear).not.toBeDisabled();
    fireEvent.change(years, { target: { value: '5' } });
    expect(years).toHaveValue('5');
  });
});

describe('EditContractModal — Sign & Trade callback wiring (Gap C guard)', () => {
  afterEach(() => cleanup());

  it('calls onSignAndTrade with (player, contract, destinationTeamId) on confirm', async () => {
    const mockOnSignAndTrade = vi.fn();
    const mockGetSignAndTradePreflight = vi.fn().mockResolvedValue({
      status: 'legal',
      reasons: [],
      warnings: ['Sign-and-trade will hard cap receiving team at First Apron'],
      source: 'authoritative-preflight',
    });
    const faPlayer = {
      name: 'Trade Target',
      player_id: 'tt_1',
      freeAgentYear: 2025,
    };

    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={faPlayer}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        worldAsOfDate="2024-07-08"
        onSignAndTrade={mockOnSignAndTrade}
        getSignAndTradePreflight={mockGetSignAndTradePreflight}
        actionContext="freeAgent"
        actionsOverride={['signAndTrade']}
      />
    );

    // Select Sign & Trade radio
    const satOption = screen.getByLabelText(/sign & trade/i);
    fireEvent.click(satOption);

    // Pick destination team via mocked dropdown
    const teamSelect = screen.getByTestId('team-select');
    fireEvent.change(teamSelect, { target: { value: 'BOS' } });

    // If validation blocks, unlock via override
    await waitFor(() => {
      const advancedToggle = screen.queryByText(/Advanced: Override Validation/i);
      if (advancedToggle) {
        fireEvent.click(advancedToggle);
        const input = screen.getByPlaceholderText('OVERRIDE');
        fireEvent.change(input, { target: { value: 'OVERRIDE' } });
      }
    });

    // Click whichever confirm variant is active
    await waitFor(() => {
      const btn =
        screen.queryByRole('button', { name: /confirm action/i }) ||
        screen.queryByRole('button', { name: /force override/i });
      expect(btn).toBeTruthy();
      expect(btn).toBeEnabled();
    });

    const confirmBtn =
      screen.queryByRole('button', { name: /confirm action/i }) ||
      screen.queryByRole('button', { name: /force override/i });
    expect(confirmBtn).not.toBeNull();
    fireEvent.click(confirmBtn as HTMLElement);

    // Verify the real S&T handler was called with all three args
    expect(mockOnSignAndTrade).toHaveBeenCalledTimes(1);
    expect(mockOnSignAndTrade).toHaveBeenCalledWith(
      faPlayer,
      expect.objectContaining({ signAndTrade: true }),
      'BOS'
    );
    expect(mockGetSignAndTradePreflight).toHaveBeenCalledWith(
      faPlayer,
      expect.objectContaining({ signAndTrade: true }),
      'BOS'
    );
  });
});

describe('EditContractModal — explicit sign/resign callbacks', () => {
  afterEach(() => cleanup());

  it('routes resign confirm to onResign instead of generic save handler', async () => {
    const mockOnResign = vi.fn();
    const faPlayer = {
      name: 'Resign Candidate',
      player_id: 're_1',
      freeAgentYear: 2025,
    };

    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={faPlayer}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        worldAsOfDate="2024-07-08"
        actionContext="freeAgent"
        onResign={mockOnResign}
      />
    );

    fireEvent.click(screen.getByLabelText(/re-sign player/i));
    fireEvent.click(screen.getByRole('button', { name: /confirm action/i }));

    expect(mockOnResign).toHaveBeenCalledTimes(1);
  });
});
