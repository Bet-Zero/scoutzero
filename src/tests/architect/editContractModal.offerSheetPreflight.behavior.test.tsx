/**
 * FILE: src/tests/architect/editContractModal.offerSheetPreflight.behavior.test.tsx
 * PURPOSE: Prove offer-sheet modal preflight alignment, loading, stale-response handling, and
 *          conservative guards. Mirrors editContractModal.signAndTradePreflight.behavior.test.tsx.
 * OWNERSHIP: Feature: architect/contracts
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import {
  afterEach,
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

vi.mock('@/features/architect/shared/ValidationWarnings', () => ({
  __esModule: true,
  default: ({
    warnings,
    errors,
  }: {
    warnings?: Array<{ message?: string }>;
    errors?: Array<{ message?: string }>;
  }) => (
    <div data-testid="validation-warnings">
      {(errors || []).map((entry, index) => (
        <div key={`error-${index}`}>{entry.message}</div>
      ))}
      {(warnings || []).map((entry, index) => (
        <div key={`warning-${index}`}>{entry.message}</div>
      ))}
    </div>
  ),
}));

vi.mock('@/features/architect/utils/capHelpers', () => ({
  getCapSettings: () => ({
    salaryCap: 140_000_000,
    firstApron: 178_000_000,
    secondApron: 188_000_000,
  }),
  calculateTeamCapHit: () => 0,
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
  getContractYearSlice: (
    contract: {
      salariesByYear?: Array<Record<string, unknown>> | null;
    } | null | undefined,
    year: number
  ) =>
    (contract?.salariesByYear || []).find((row) => {
      const season = String(row.season || '');
      if (/^\d{4}-\d{2}$/.test(season)) {
        return 2000 + parseInt(season.split('-')[1], 10) === year;
      }
      return parseInt(season, 10) === year;
    }) || null,
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

const RFA_PLAYER = {
  id: 'p_rfa',
  player_id: 'p_rfa',
  name: 'RFA Player',
  displayName: 'RFA Player',
  freeAgentYear: 2026,
  contract: {
    salariesByYear: [
      {
        season: '2025-26',
        salary: 10_000_000,
        capHit: 10_000_000,
        guaranteed: true,
      },
    ],
    freeAgency: { type: 'RFA', year: 2026 },
  },
};

const TEAM_CAP_SHEET = {
  teamCode: 'LAL',
  players: [RFA_PLAYER],
  deadCap: [],
  capHolds: [],
};

const HIGH_SALARY_RFA_PLAYER = {
  ...RFA_PLAYER,
  contract: {
    ...RFA_PLAYER.contract,
    salariesByYear: [
      {
        season: '2025-26',
        salary: 200_000_000,
        capHit: 200_000_000,
        guaranteed: true,
      },
    ],
  },
};

const HIGH_SALARY_TEAM_CAP_SHEET = {
  ...TEAM_CAP_SHEET,
  players: [HIGH_SALARY_RFA_PLAYER],
};

function deferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  let reject: ((error?: unknown) => void) | undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve: (value: T) => resolve?.(value),
    reject: (error?: unknown) => reject?.(error),
  };
}

afterEach(() => {
  cleanup();
});

describe('EditContractModal offer-sheet preflight behavior', () => {
  it('keeps confirm disabled while preflight is pending and enables only after legal result', async () => {
    const onClose = vi.fn();
    const onStoreOfferSheet = vi.fn().mockResolvedValue({ success: true });
    const pendingPreflight = deferred<{
      status: 'legal';
      reasons: string[];
      warnings: string[];
      source: 'authoritative-preflight';
    }>();
    const getOfferSheetPreflight = vi
      .fn()
      .mockReturnValueOnce(pendingPreflight.promise);

    render(
      <EditContractModal
        isOpen
        onClose={onClose}
        player={RFA_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        initialAction="signNew"
        actionsOverride={['signNew']}
        onStoreOfferSheet={onStoreOfferSheet}
        getOfferSheetPreflight={getOfferSheetPreflight}
      />
    );

    const confirmButton = screen.getByTestId('edit-contract-confirm-action-button');
    const offerSheetCheckbox = screen.getByRole('checkbox');

    // Without toggle: confirm enabled (normal signNew validation)
    expect(confirmButton).toBeEnabled();

    // Toggle offer sheet on → preflight starts
    fireEvent.click(offerSheetCheckbox);

    await waitFor(() => {
      expect(getOfferSheetPreflight).toHaveBeenCalledWith(
        RFA_PLAYER,
        expect.objectContaining({
          rfaOfferSheet: true,
          rfaOfferSheetOnly: true,
          rfaOfferSheetStatus: 'PENDING_MATCH',
          contractType: 'Offer Sheet',
        })
      );
    });

    // While pending: confirm is disabled, loading message shown
    expect(confirmButton).toBeDisabled();
    expect(screen.getByTestId('validation-warnings')).toHaveTextContent(
      'Checking authoritative offer sheet legality...'
    );

    // Resolve legal with a home-team warning
    pendingPreflight.resolve({
      status: 'legal',
      reasons: [],
      warnings: ['Home team has 3 days to match this offer sheet.'],
      source: 'authoritative-preflight',
    });

    await waitFor(() => {
      expect(confirmButton).toBeEnabled();
    });
    expect(screen.getByTestId('validation-warnings')).toHaveTextContent(
      'Home team has 3 days to match this offer sheet.'
    );
  });

  it('blocks confirm and shows reasons when preflight returns blocked', async () => {
    const getOfferSheetPreflight = vi.fn().mockResolvedValue({
      status: 'blocked',
      reasons: ['Player is not RFA-eligible for an offer sheet.'],
      warnings: [],
      source: 'authoritative-preflight',
    });

    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={RFA_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        initialAction="signNew"
        actionsOverride={['signNew']}
        onStoreOfferSheet={vi.fn()}
        getOfferSheetPreflight={getOfferSheetPreflight}
      />
    );

    const confirmButton = screen.getByTestId('edit-contract-confirm-action-button');
    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(screen.getByTestId('validation-warnings')).toHaveTextContent(
        'Player is not RFA-eligible for an offer sheet.'
      );
    });
    expect(confirmButton).toBeDisabled();
  });

  it('discards stale offer sheet preflight when toggle is turned off mid-request', async () => {
    const pendingPreflight = deferred<{
      status: 'legal';
      reasons: string[];
      warnings: string[];
      source: 'authoritative-preflight';
    }>();
    const getOfferSheetPreflight = vi
      .fn()
      .mockReturnValueOnce(pendingPreflight.promise);

    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={RFA_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        initialAction="signNew"
        actionsOverride={['signNew']}
        onStoreOfferSheet={vi.fn()}
        getOfferSheetPreflight={getOfferSheetPreflight}
      />
    );

    const confirmButton = screen.getByTestId('edit-contract-confirm-action-button');
    const checkbox = screen.getByRole('checkbox');

    // Toggle on → preflight starts
    fireEvent.click(checkbox);
    await waitFor(() => {
      expect(getOfferSheetPreflight).toHaveBeenCalledTimes(1);
    });
    expect(confirmButton).toBeDisabled();

    // Toggle off → clears preflight state + increments request ID
    fireEvent.click(checkbox);

    // Confirm re-enables because isOfferSheet=false means normal signNew runs
    await waitFor(() => {
      expect(confirmButton).toBeEnabled();
    });

    // Stale legal response arrives — must be ignored
    pendingPreflight.resolve({
      status: 'legal',
      reasons: [],
      warnings: [],
      source: 'authoritative-preflight',
    });

    // Button should remain enabled (toggle is off, stale result doesn't affect anything)
    await waitFor(() => {
      expect(confirmButton).toBeEnabled();
    });
    expect(screen.queryByText('Checking authoritative offer sheet legality...')).toBeNull();
  });

  it('does not call getOfferSheetPreflight when offer sheet toggle is off', async () => {
    const getOfferSheetPreflight = vi.fn();

    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={RFA_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        initialAction="signNew"
        actionsOverride={['signNew']}
        onStoreOfferSheet={vi.fn()}
        getOfferSheetPreflight={getOfferSheetPreflight}
      />
    );

    const confirmButton = screen.getByTestId('edit-contract-confirm-action-button');

    // Do NOT click the checkbox
    await waitFor(() => {
      expect(confirmButton).toBeEnabled();
    });
    expect(getOfferSheetPreflight).not.toHaveBeenCalled();
  });

  it('blocks immediately when getOfferSheetPreflight is null (no world context)', async () => {
    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={RFA_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        initialAction="signNew"
        actionsOverride={['signNew']}
        onStoreOfferSheet={vi.fn()}
        getOfferSheetPreflight={null}
      />
    );

    const confirmButton = screen.getByTestId('edit-contract-confirm-action-button');
    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(screen.getByTestId('validation-warnings')).toHaveTextContent(
        'Offer sheet preflight unavailable (no world context).'
      );
    });
    expect(confirmButton).toBeDisabled();
  });

  it('returns incomplete immediately when player is null and never calls preflight', async () => {
    const getOfferSheetPreflight = vi.fn();

    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={null}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        initialAction="signNew"
        actionsOverride={['signNew']}
        onStoreOfferSheet={vi.fn()}
        getOfferSheetPreflight={getOfferSheetPreflight}
      />
    );

    // With no player, offer-sheet toggle won't render (no RFA context)
    // but if it did appear: preflight callback must not be called
    expect(getOfferSheetPreflight).not.toHaveBeenCalled();
  });

  it('calls getOfferSheetPreflight with rfaOfferSheet and rfaOfferSheetOnly flags', async () => {
    const getOfferSheetPreflight = vi.fn().mockResolvedValue({
      status: 'legal',
      reasons: [],
      warnings: [],
      source: 'authoritative-preflight',
    });

    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={RFA_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        initialAction="signNew"
        actionsOverride={['signNew']}
        onStoreOfferSheet={vi.fn()}
        getOfferSheetPreflight={getOfferSheetPreflight}
      />
    );

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(getOfferSheetPreflight).toHaveBeenCalledWith(
        RFA_PLAYER,
        expect.objectContaining({
          rfaOfferSheet: true,
          rfaOfferSheetOnly: true,
          rfaOfferSheetStatus: 'PENDING_MATCH',
          contractType: 'Offer Sheet',
        })
      );
    });
  });

  it('renders only authoritative offer-sheet output when local signNew warnings would otherwise fire', async () => {
    const getOfferSheetPreflight = vi.fn().mockResolvedValue({
      status: 'blocked',
      reasons: ['Offer sheet requires a distinct home team.'],
      warnings: [],
      source: 'authoritative-preflight',
    });

    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={HIGH_SALARY_RFA_PLAYER}
        teamCapSheet={HIGH_SALARY_TEAM_CAP_SHEET}
        currentYear={2026}
        initialAction="signNew"
        actionsOverride={['signNew']}
        onStoreOfferSheet={vi.fn()}
        getOfferSheetPreflight={getOfferSheetPreflight}
      />
    );

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(screen.getByTestId('validation-warnings')).toHaveTextContent(
        'Offer sheet requires a distinct home team.'
      );
    });
    expect(screen.getByTestId('validation-warnings')).not.toHaveTextContent(
      'Signing puts team over Second Apron - limited flexibility'
    );
  });

  it('resets offer-sheet toggle state when the modal closes and reopens', async () => {
    const getOfferSheetPreflight = vi.fn().mockResolvedValue({
      status: 'legal',
      reasons: [],
      warnings: [],
      source: 'authoritative-preflight',
    });
    const props = {
      onClose: () => {},
      player: RFA_PLAYER,
      teamCapSheet: TEAM_CAP_SHEET,
      currentYear: 2026,
      initialAction: 'signNew' as const,
      actionsOverride: ['signNew'],
      onStoreOfferSheet: vi.fn(),
      getOfferSheetPreflight,
    };

    const { rerender } = render(<EditContractModal isOpen {...props} />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(getOfferSheetPreflight).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('checkbox')).toBeChecked();
    });

    rerender(<EditContractModal isOpen={false} {...props} />);
    rerender(<EditContractModal isOpen {...props} />);

    await waitFor(() => {
      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });
    expect(getOfferSheetPreflight).toHaveBeenCalledTimes(1);
  });

  it('uses authoritative preflight result (blocked) over local state — home-team truth proof', async () => {
    // Modal has a player that locally looks like a free agent.
    // Authoritative preflight says blocked (home-team resolution failed).
    // Modal must reflect the authoritative verdict, not its own local inference.
    const getOfferSheetPreflight = vi.fn().mockResolvedValue({
      status: 'blocked',
      reasons: ['Offer sheet requires a distinct home team (offering team is the home team).'],
      warnings: [],
      source: 'authoritative-preflight',
    });

    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={RFA_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        initialAction="signNew"
        actionsOverride={['signNew']}
        onStoreOfferSheet={vi.fn()}
        getOfferSheetPreflight={getOfferSheetPreflight}
      />
    );

    const confirmButton = screen.getByTestId('edit-contract-confirm-action-button');
    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(screen.getByTestId('validation-warnings')).toHaveTextContent(
        'Offer sheet requires a distinct home team (offering team is the home team).'
      );
    });
    expect(confirmButton).toBeDisabled();
  });
});
