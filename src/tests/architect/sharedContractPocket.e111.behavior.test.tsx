/**
 * FILE: src/tests/architect/sharedContractPocket.e111.behavior.test.tsx
 * PURPOSE: Focused behavior proof for the E111 shared contract pocket TS authorities.
 * OWNERSHIP: Feature: architect/shared-contract-pocket
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import EditContractModal from '@/shared/components/EditContractModal';
import {
  getCurrentSeasonYear,
  getYearsRemaining,
} from '@/shared/utils/contracts/contractUtils';
import {
  compareSeason,
  isSeasonActive,
  isSeasonExpired,
  isSeasonFuture,
  normalizeSeason,
  seasonStartYear,
} from '@/shared/utils/contracts/seasonNormalizer';

const mockValidationState = vi.hoisted(() => ({
  warnings: [] as Array<{ severity?: string; message?: string }>,
  errors: [] as Array<{ severity?: string; message?: string }>,
  isValid: true,
  signingGuardrails: null as
    | null
    | {
        minFirstYear?: number;
        maxFirstYear?: number;
        raisePct?: number;
        maxYears?: number;
        source?: string;
      },
}));

vi.mock('@/shared/components/ui/Dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open?: boolean;
    children?: React.ReactNode;
  }) => (open ? <div data-testid="mock-dialog">{children}</div> : null),
  DialogContent: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => <div {...props}>{children}</div>,
}));

vi.mock('@/features/architect/hooks/useCapValidation', () => ({
  __esModule: true,
  default: () => ({
    warnings: mockValidationState.warnings,
    errors: mockValidationState.errors,
    isValid: mockValidationState.isValid,
    incomplete: false,
  }),
  buildSigningGuardrails: () => mockValidationState.signingGuardrails,
}));

vi.mock('@/features/architect/shared/ValidationWarnings', () => ({
  __esModule: true,
  default: ({
    warnings,
    errors,
    showErrors,
  }: {
    warnings?: Array<{ message?: string }>;
    errors?: Array<{ message?: string }>;
    showErrors?: boolean;
  }) => (
    <div data-testid="validation-warnings">
      <div data-testid="validation-show-errors">
        {showErrors ? 'shown' : 'hidden'}
      </div>
      {(errors || []).map((entry, index) => (
        <div key={`error-${index}`}>{entry.message}</div>
      ))}
      {(warnings || []).map((entry, index) => (
        <div key={`warning-${index}`}>{entry.message}</div>
      ))}
    </div>
  ),
}));

vi.mock('@/shared/components/TeamSelectDropdown', () => ({
  __esModule: true,
  default: ({
    selectedTeamId,
    onChange,
  }: {
    selectedTeamId?: string | null;
    onChange?: (value: string) => void;
  }) => (
    <div>
      <div data-testid="selected-destination-team">{selectedTeamId || ''}</div>
      <button type="button" onClick={() => onChange?.('BOS')}>
        Select BOS
      </button>
    </div>
  ),
}));

vi.mock('@/features/architect/utils/capHelpers', () => ({
  getCapSettings: (currentYear: number) => ({ currentYear }),
}));

vi.mock('@/features/architect/utils/contractUtils', () => ({
  generateExtensionContract: ({
    firstYearSalary,
    years,
    raisePct,
    startYear,
  }: {
    firstYearSalary: number;
    years: number;
    raisePct: number;
    startYear: number;
  }) => ({
    firstYearSalary,
    years,
    raisePct,
    startYear,
  }),
  getContractYearsForDisplay: (player: {
    contract?: { salariesByYear?: Array<Record<string, unknown>> | null } | null;
  }) =>
    (player?.contract?.salariesByYear || []).map((row) => {
      const season = String(row.season || '');
      const year = /^\d{4}-\d{2}$/.test(season)
        ? 2000 + parseInt(season.split('-')[1], 10)
        : parseInt(season, 10);
      return {
        season,
        year,
        salary: Number(row.salary) || 0,
        option: row.option || null,
        isExtension: Boolean(row.isExtension),
        guaranteed: row.guaranteed,
      };
    }),
}));

vi.mock('@/features/architect/utils/seasonFormat', () => ({
  toSeasonCode: (endYear: number) =>
    `${endYear - 1}-${String(endYear).slice(-2)}`,
}));

vi.mock('@/features/architect/utils/salaryEngine', () => ({
  buildMinimalRuleContext: () => ({
    player: {
      currentTeamId: null,
      birdTypeAtOperation: null,
      maxPercentBucket: 0.25,
    },
  }),
  getExtensionProfile: () => ({
    eligibility: {
      isEligible: false,
      reason: 'Not eligible',
    },
    terms: null,
  }),
}));

vi.mock('@/features/architect/utils/worldTeamData', () => ({
  resolveTeamCode: (teamId: string) => teamId,
}));

const ORIGINAL_OVERRIDE_ENV = import.meta.env.VITE_ENABLE_CBA_OVERRIDE;

const PLAYER = {
  id: 'p1',
  player_id: 'p1',
  name: 'Test Player',
  displayName: 'Test Player',
  freeAgentYear: 2026,
  contract: {
    salariesByYear: [
      {
        season: '2025-26',
        salary: 12_000_000,
        capHit: 12_000_000,
        guaranteed: true,
      },
    ],
  },
};

const TEAM_CAP_SHEET = {
  teamCode: 'LAL',
  players: [PLAYER],
  deadCap: [],
  capHolds: [],
};

describe('E111 contractUtils behavior', () => {
  it('keeps the UTC June 30 vs July 1 season rollover semantics', () => {
    expect(getCurrentSeasonYear(new Date(Date.UTC(2026, 5, 30)))).toBe(2025);
    expect(getCurrentSeasonYear(new Date(Date.UTC(2026, 6, 1)))).toBe(2026);
  });

  it('keeps years-remaining math and loose invalid-input fallback', () => {
    expect(getYearsRemaining(2028, 2026)).toBe(2);
    expect(getYearsRemaining(2024, 2026)).toBe(0);
    expect(getYearsRemaining('2028' as never, 2026)).toBe(0);
  });
});

describe('E111 seasonNormalizer behavior', () => {
  it('keeps current normalization and parse semantics', () => {
    expect(normalizeSeason('2025-26')).toBe('2025-26');
    expect(normalizeSeason('2025')).toBe('2025-26');
    expect(normalizeSeason(2025)).toBe('2025-26');
    expect(normalizeSeason('2025-2026')).toBe('2025-26');
    expect(normalizeSeason('bad-input')).toBeNull();
    expect(normalizeSeason('')).toBeNull();
    expect(seasonStartYear('2025-26')).toBe(2025);
    expect(seasonStartYear('bad-input')).toBe(0);
  });

  it('keeps compare, active, future, and expired helper behavior', () => {
    expect(compareSeason('2025-26', '2026-27')).toBe(-1);
    expect(compareSeason('2026-27', '2025-26')).toBe(1);
    expect(compareSeason('2025-26', '2025-26')).toBe(0);
    expect(isSeasonActive('2024-25', '2026-27', '2025-26')).toBe(true);
    expect(isSeasonFuture('2026-27', '2025-26')).toBe(true);
    expect(isSeasonExpired('2024-25', '2025-26')).toBe(true);
  });
});

describe('E111 EditContractModal behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mockValidationState.warnings = [];
    mockValidationState.errors = [];
    mockValidationState.isValid = true;
    mockValidationState.signingGuardrails = {
      minFirstYear: 1_000_000,
      maxFirstYear: 20_000_000,
      raisePct: 0.05,
      maxYears: 4,
      source: 'Bird Rights',
    };
    import.meta.env.VITE_ENABLE_CBA_OVERRIDE = 'false';
  });

  afterEach(() => {
    import.meta.env.VITE_ENABLE_CBA_OVERRIDE = ORIGINAL_OVERRIDE_ENV;
  });

  it('renders the current modal shell, labels, and primary buttons', () => {
    render(
      <EditContractModal
        isOpen
        onClose={vi.fn()}
        player={PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        initialAction="waive"
        actionContext="underContract"
      />
    );

    expect(screen.getByTestId('edit-contract-modal')).toBeInTheDocument();
    expect(screen.getByText('Available Actions')).toBeInTheDocument();
    expect(screen.getByText('Waive Player')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(
      screen.getByTestId('edit-contract-confirm-action-button')
    ).toHaveTextContent('Confirm Action');
  });

  it('renders current validation and warning paths when validation returns issues', async () => {
    mockValidationState.errors = [{ severity: 'error', message: 'Illegal move' }];
    mockValidationState.warnings = [
      { severity: 'warning', message: 'Proceed carefully' },
    ];
    mockValidationState.isValid = false;

    render(
      <EditContractModal
        isOpen
        onClose={vi.fn()}
        player={PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        initialAction="waive"
        actionContext="underContract"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('validation-warnings')).toBeInTheDocument();
    });

    expect(screen.getByTestId('validation-show-errors')).toHaveTextContent(
      'shown'
    );
    expect(screen.getByTestId('validation-warnings')).toHaveTextContent(
      'Illegal move'
    );
    expect(screen.getByTestId('validation-warnings')).toHaveTextContent(
      'Proceed carefully'
    );
    expect(screen.getByText('Modal guardrails')).toBeInTheDocument();
    expect(
      screen.getByText(
        /These checks are advisory UI guardrails only\. Final cap-state truth is still enforced later/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('edit-contract-confirm-action-button')
    ).toHaveTextContent('Action Blocked');
  });

  it('uses the current destination-team flow for sign-and-trade', async () => {
    const onClose = vi.fn();
    const onSignAndTrade = vi.fn().mockResolvedValue({ success: true });
    const getSignAndTradePreflight = vi.fn().mockResolvedValue({
      status: 'legal',
      reasons: [],
      warnings: [],
      source: 'authoritative-preflight',
    });

    render(
      <EditContractModal
        isOpen
        onClose={onClose}
        player={PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        initialAction="signAndTrade"
        actionContext="freeAgent"
        actionsOverride={['signAndTrade']}
        signAndTradeInitiation={{
          onSignAndTrade,
          getSignAndTradePreflight,
        }}
      />
    );

    const confirmButton = screen.getByTestId(
      'edit-contract-confirm-action-button'
    );
    expect(confirmButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /select bos/i }));

    expect(screen.getByTestId('selected-destination-team')).toHaveTextContent(
      'BOS'
    );
    expect(screen.getByText('Authoritative preflight')).toBeInTheDocument();
    expect(
      screen.getByText(
        /This action is using authoritative preflight from the action and mutation layer before confirm\./i
      )
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(confirmButton).not.toBeDisabled();
    });

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(onSignAndTrade).toHaveBeenCalledWith(
        PLAYER,
        expect.objectContaining({
          signAndTrade: true,
          contractType: 'Sign & Trade',
        }),
        'BOS'
      );
    });
    expect(getSignAndTradePreflight).toHaveBeenCalledWith(
      PLAYER,
      expect.objectContaining({
        signAndTrade: true,
        contractType: 'Sign & Trade',
      }),
      'BOS'
    );
    const stagedPreflightPayload =
      getSignAndTradePreflight.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    const stagedCommitPayload =
      onSignAndTrade.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(stagedPreflightPayload).toEqual(
      expect.objectContaining({
        signAndTrade: true,
        contractType: 'Sign & Trade',
        years: 3,
        salaries: [12_000_000, 12_000_000, 12_000_000],
        startYear: 2026,
      })
    );
    expect(stagedPreflightPayload.salariesByYear).toBeUndefined();
    expect(stagedPreflightPayload.totalValue).toBeUndefined();
    expect(stagedPreflightPayload.averageAnnualValue).toBeUndefined();
    expect(stagedPreflightPayload.firstYearGuaranteed).toBeUndefined();
    expect(stagedCommitPayload).toBe(stagedPreflightPayload);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('forwards current buyout payload fields and closes only on success', async () => {
    const onClose = vi.fn();
    const onWaive = vi.fn().mockResolvedValue({ success: true });

    render(
      <EditContractModal
        isOpen
        onClose={onClose}
        player={PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        initialAction="buyout"
        actionContext="underContract"
        onWaive={onWaive}
      />
    );

    fireEvent.change(screen.getByLabelText(/buyout amount/i), {
      target: { value: '5000000' },
    });
    fireEvent.click(
      screen.getByTestId('edit-contract-confirm-action-button')
    );

    await waitFor(() => {
      expect(onWaive).toHaveBeenCalledWith(
        PLAYER,
        expect.objectContaining({
          stretch: false,
          buyout: true,
          buyoutAmount: 5_000_000,
        })
      );
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps the current override confirm path and callback metadata', async () => {
    import.meta.env.VITE_ENABLE_CBA_OVERRIDE = 'true';
    mockValidationState.errors = [{ severity: 'error', message: 'Illegal move' }];
    mockValidationState.isValid = false;

    const onWaive = vi.fn().mockResolvedValue({ success: true });
    const onAuditLog = vi.fn();

    render(
      <EditContractModal
        isOpen
        onClose={vi.fn()}
        player={PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        initialAction="waive"
        actionContext="underContract"
        onWaive={onWaive}
        onAuditLog={onAuditLog}
      />
    );

    const confirmButton = screen.getByTestId(
      'edit-contract-confirm-action-button'
    );
    expect(confirmButton).toBeDisabled();

    fireEvent.click(
      screen.getByRole('button', { name: /advanced: override validation/i })
    );
    fireEvent.change(screen.getByLabelText(/type\s+override\s+to confirm/i), {
      target: { value: 'OVERRIDE' },
    });

    expect(confirmButton).toHaveTextContent('Force Override');
    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(onWaive).toHaveBeenCalledWith(
        PLAYER,
        expect.objectContaining({
          stretch: false,
          buyout: false,
          overrideUsed: true,
          overrideReasons: ['Illegal move'],
          overrideTimestamp: expect.any(String),
        })
      );
    });

    expect(onAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'waive',
        overrideUsed: true,
        reasons: ['Illegal move'],
      })
    );
  });

  it('keeps the modal open and shows the current inline alert on failed save results', async () => {
    const onClose = vi.fn();
    const onWaive = vi.fn().mockResolvedValue({
      success: false,
      message: 'Action canceled. No changes were saved.',
    });

    render(
      <EditContractModal
        isOpen
        onClose={onClose}
        player={PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        initialAction="waive"
        actionContext="underContract"
        onWaive={onWaive}
      />
    );

    fireEvent.click(
      screen.getByTestId('edit-contract-confirm-action-button')
    );

    await waitFor(() => {
      expect(onWaive).toHaveBeenCalledTimes(1);
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      /action canceled\. no changes were saved\./i
    );
  });
});
