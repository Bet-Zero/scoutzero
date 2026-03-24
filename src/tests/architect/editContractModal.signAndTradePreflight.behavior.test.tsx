/**
 * FILE: src/tests/architect/editContractModal.signAndTradePreflight.behavior.test.tsx
 * PURPOSE: Prove SAT modal preflight alignment, loading, and stale-response handling.
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
      <button type="button" onClick={() => onChange?.('NYK')}>
        Select NYK
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
  getContractYearSlice: (contract: {
    salariesByYear?: Array<Record<string, unknown>> | null;
  } | null | undefined, year: number) =>
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

describe('EditContractModal SAT preflight behavior', () => {
  it('keeps SAT disabled while authoritative preflight is pending and enables only after legal result', async () => {
    const onClose = vi.fn();
    const onSignAndTrade = vi.fn().mockResolvedValue({ success: true });
    const pendingPreflight = deferred<{
      status: 'legal';
      reasons: string[];
      warnings: string[];
      source: 'authoritative-preflight';
    }>();
    const getSignAndTradePreflight = vi
      .fn()
      .mockReturnValueOnce(pendingPreflight.promise);

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
        onSignAndTrade={onSignAndTrade}
        getSignAndTradePreflight={getSignAndTradePreflight}
      />
    );

    const confirmButton = screen.getByTestId(
      'edit-contract-confirm-action-button'
    );
    fireEvent.click(screen.getByRole('button', { name: /select bos/i }));

    await waitFor(() => {
      expect(getSignAndTradePreflight).toHaveBeenCalledWith(
        PLAYER,
        expect.objectContaining({
          signAndTrade: true,
          contractType: 'Sign & Trade',
        }),
        'BOS'
      );
    });

    expect(confirmButton).toBeDisabled();
    expect(screen.getByTestId('validation-warnings')).toHaveTextContent(
      'Checking authoritative sign-and-trade legality...'
    );

    pendingPreflight.resolve({
      status: 'legal',
      reasons: [],
      warnings: ['Sign-and-trade will hard cap receiving team at First Apron'],
      source: 'authoritative-preflight',
    });

    await waitFor(() => {
      expect(confirmButton).toBeEnabled();
    });
    expect(screen.getByTestId('validation-warnings')).toHaveTextContent(
      'Sign-and-trade will hard cap receiving team at First Apron'
    );

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
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('invalidates prior SAT legality immediately and ignores stale legal responses', async () => {
    const onSignAndTrade = vi.fn().mockResolvedValue({ success: true });
    const firstRequest = deferred<{
      status: 'legal';
      reasons: string[];
      warnings: string[];
      source: 'authoritative-preflight';
    }>();
    const getSignAndTradePreflight = vi
      .fn()
      .mockReturnValueOnce(firstRequest.promise)
      .mockResolvedValueOnce({
        status: 'blocked',
        reasons: ['Receiver would exceed First Apron after sign-and-trade.'],
        warnings: [],
        source: 'authoritative-preflight',
      });

    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        initialAction="signAndTrade"
        actionContext="freeAgent"
        actionsOverride={['signAndTrade']}
        onSignAndTrade={onSignAndTrade}
        getSignAndTradePreflight={getSignAndTradePreflight}
      />
    );

    const confirmButton = screen.getByTestId(
      'edit-contract-confirm-action-button'
    );

    fireEvent.click(screen.getByRole('button', { name: /select bos/i }));
    await waitFor(() => {
      expect(getSignAndTradePreflight).toHaveBeenCalledWith(
        PLAYER,
        expect.any(Object),
        'BOS'
      );
    });
    expect(confirmButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /select nyk/i }));

    await waitFor(() => {
      expect(getSignAndTradePreflight).toHaveBeenLastCalledWith(
        PLAYER,
        expect.any(Object),
        'NYK'
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('validation-warnings')).toHaveTextContent(
        'Receiver would exceed First Apron after sign-and-trade.'
      );
    });
    expect(confirmButton).toBeDisabled();

    firstRequest.resolve({
      status: 'legal',
      reasons: [],
      warnings: [],
      source: 'authoritative-preflight',
    });

    await waitFor(() => {
      expect(confirmButton).toBeDisabled();
    });
    expect(screen.getByTestId('selected-destination-team')).toHaveTextContent(
      'NYK'
    );
    expect(screen.getByTestId('validation-warnings')).toHaveTextContent(
      'Receiver would exceed First Apron after sign-and-trade.'
    );
    expect(onSignAndTrade).not.toHaveBeenCalled();
  });
});
