import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import EditContractModal from '@/shared/components/EditContractModal.jsx';

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
  extensionTerms: {
    maxYears: 3,
    maxFirstYearSalary: 20_000_000,
    minFirstYearSalary: 15_000_000,
    raisePercentage: 0.08,
    extensionType: 'Veteran Extension',
    basedOn: 'Test range',
    notes: 'Profile-driven terms',
  },
  birdRights: {},
  restrictedFreeAgency: {},
  contractSummary: {},
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

  it('disables extend action and confirm when player is not extension eligible', async () => {
    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={BASE_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        initialAction="extend"
        playerRulesProfile={INELIGIBLE_PROFILE}
      />
    );

    const extendOption = screen.getByLabelText(/extend contract/i);
    expect(extendOption).toBeDisabled();

    const confirmButton = screen.getByRole('button', { name: /action/i });
    await waitFor(() => {
      expect(confirmButton).toBeDisabled();
    });
    expect(screen.getAllByText(/not extension eligible/i).length).toBeGreaterThan(0);
  });

  it('prefills within rules profile range and blocks confirm when out of range', async () => {
    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={BASE_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        initialAction="extend"
        playerRulesProfile={ELIGIBLE_PROFILE}
      />
    );

    const confirmButton = screen.getByRole('button', { name: /action/i });
    await waitFor(() => {
      expect(confirmButton).toBeEnabled();
    });

    const salaryInput = screen.getAllByPlaceholderText('0')[0];
    fireEvent.change(salaryInput, { target: { value: '50000000' } });

    await waitFor(() => {
      expect(confirmButton).toBeDisabled();
    });
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
        initialAction="resign"
        playerRulesProfile={RFA_PROFILE}
      />
    );

    expect(screen.getByText(/rights\/exception/i)).toBeInTheDocument();
    expect(screen.getByText(/first-year range/i)).toBeInTheDocument();

    const salaryInput = screen.getAllByPlaceholderText('0')[0];
    fireEvent.change(salaryInput, { target: { value: '1000000' } });
    await waitFor(() => {
      const parsed = Number(salaryInput.value.replace(/[^0-9]/g, ''));
      expect(parsed).toBeGreaterThanOrEqual(8_000_000);
    });

    fireEvent.change(salaryInput, { target: { value: '20000000' } });
    const secondYearInput = screen.getAllByPlaceholderText('0')[1];
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

  it('shows "Action Blocked" button when validation fails without override', async () => {
    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={BASE_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        initialAction="extend"
        playerRulesProfile={INELIGIBLE_PROFILE}
      />
    );

    // Try to select the extend action (it's disabled but we test the confirm button)
    const confirmButton = screen.getByRole('button', { name: /blocked/i });
    
    await waitFor(() => {
      expect(confirmButton).toBeDisabled();
      expect(confirmButton).toHaveTextContent(/blocked/i);
    });
  });

  it('shows Advanced Override accordion when action is illegal', async () => {
    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={BASE_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        playerRulesProfile={ELIGIBLE_PROFILE}
      />
    );

    // Select extend action
    const extendOption = screen.getByLabelText(/extend contract/i);
    fireEvent.click(extendOption);

    // Enter an invalid salary (too high)
    await waitFor(() => {
      const salaryInput = screen.getAllByPlaceholderText('0')[0];
      fireEvent.change(salaryInput, { target: { value: '50000000' } });
    });

    // Should show the Advanced Override section
    await waitFor(() => {
      expect(screen.getByText(/Advanced: Override Validation/i)).toBeInTheDocument();
    });
  });

  it('requires typing OVERRIDE to enable the override button', async () => {
    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={BASE_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        playerRulesProfile={ELIGIBLE_PROFILE}
      />
    );

    // Select extend action
    const extendOption = screen.getByLabelText(/extend contract/i);
    fireEvent.click(extendOption);

    // Enter an invalid salary
    await waitFor(() => {
      const salaryInput = screen.getAllByPlaceholderText('0')[0];
      fireEvent.change(salaryInput, { target: { value: '50000000' } });
    });

    // Open the Advanced section
    await waitFor(() => {
      const advancedButton = screen.getByText(/Advanced: Override Validation/i);
      fireEvent.click(advancedButton);
    });

    // Find the override input
    const overrideInput = screen.getByPlaceholderText('OVERRIDE');
    expect(overrideInput).toBeInTheDocument();

    // Confirm button should be disabled
    const confirmButton = screen.getByRole('button', { name: /blocked/i });
    expect(confirmButton).toBeDisabled();

    // Type incorrect text
    fireEvent.change(overrideInput, { target: { value: 'override' } });
    await waitFor(() => {
      expect(confirmButton).toBeDisabled();
    });

    // Type correct text
    fireEvent.change(overrideInput, { target: { value: 'OVERRIDE' } });
    await waitFor(() => {
      const forceButton = screen.getByRole('button', { name: /force override/i });
      expect(forceButton).toBeEnabled();
    });
  });

  it('calls onAuditLog with override metadata when override is used', async () => {
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
        playerRulesProfile={ELIGIBLE_PROFILE}
      />
    );

    // Select extend action
    const extendOption = screen.getByLabelText(/extend contract/i);
    fireEvent.click(extendOption);

    // Enter an invalid salary (too high)
    await waitFor(() => {
      const salaryInput = screen.getAllByPlaceholderText('0')[0];
      fireEvent.change(salaryInput, { target: { value: '50000000' } });
    });

    // Open the Advanced section
    await waitFor(() => {
      const advancedButton = screen.getByText(/Advanced: Override Validation/i);
      fireEvent.click(advancedButton);
    });

    // Type OVERRIDE to confirm
    const overrideInput = screen.getByPlaceholderText('OVERRIDE');
    fireEvent.change(overrideInput, { target: { value: 'OVERRIDE' } });

    // Click Force Override button
    await waitFor(() => {
      const forceButton = screen.getByRole('button', { name: /force override/i });
      fireEvent.click(forceButton);
    });

    // Verify audit log was called with override metadata
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'extend',
        overrideUsed: true,
        reasons: expect.arrayContaining([expect.any(String)]),
        timestamp: expect.any(String),
        playerId: expect.any(String),
        playerName: expect.any(String),
      })
    );
  });

  it('passes override metadata to handler when override is used', async () => {
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
        playerRulesProfile={ELIGIBLE_PROFILE}
      />
    );

    // Select extend action
    const extendOption = screen.getByLabelText(/extend contract/i);
    fireEvent.click(extendOption);

    // Enter an invalid salary (too high)
    await waitFor(() => {
      const salaryInput = screen.getAllByPlaceholderText('0')[0];
      fireEvent.change(salaryInput, { target: { value: '50000000' } });
    });

    // Open the Advanced section
    await waitFor(() => {
      const advancedButton = screen.getByText(/Advanced: Override Validation/i);
      fireEvent.click(advancedButton);
    });

    // Type OVERRIDE to confirm
    const overrideInput = screen.getByPlaceholderText('OVERRIDE');
    fireEvent.change(overrideInput, { target: { value: 'OVERRIDE' } });

    // Click Force Override button
    await waitFor(() => {
      const forceButton = screen.getByRole('button', { name: /force override/i });
      fireEvent.click(forceButton);
    });

    // Verify onExtend was called with override metadata
    expect(mockOnExtend).toHaveBeenCalledTimes(1);
    expect(mockOnExtend).toHaveBeenCalledWith(
      BASE_PLAYER,
      expect.objectContaining({
        overrideUsed: true,
        overrideReasons: expect.arrayContaining([expect.any(String)]),
        overrideTimestamp: expect.any(String),
      })
    );
  });

  it('does not show Advanced Override section when action is legal', async () => {
    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={BASE_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2025}
        playerRulesProfile={ELIGIBLE_PROFILE}
      />
    );

    // Select extend action
    const extendOption = screen.getByLabelText(/extend contract/i);
    fireEvent.click(extendOption);

    // Wait for initial state
    await waitFor(() => {
      // With default prefill from rules profile, should be legal
      const confirmButton = screen.getByRole('button', { name: /confirm action/i });
      expect(confirmButton).toBeEnabled();
    });

    // Advanced Override section should NOT be visible
    expect(screen.queryByText(/Advanced: Override Validation/i)).not.toBeInTheDocument();
  });
});
