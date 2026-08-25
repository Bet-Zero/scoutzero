/**
 * FILE: src/tests/architect/editContractModal.signAndTradePreflight.behavior.test.tsx
 * PURPOSE: Prove SAT modal preflight alignment, loading, and stale-response handling.
 * OWNERSHIP: Feature: architect/contracts
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EditContractModal } from '@/shared/components/EditContractModal';

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

vi.mock('@/shared/components/TeamSelectDropdown', () => {
  const MockTeamSelectDropdown = ({
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
  );

  return {
    __esModule: true,
    default: MockTeamSelectDropdown,
    TeamSelectDropdown: MockTeamSelectDropdown,
  };
});

vi.mock('@/features/architect/shared/ValidationWarnings', () => {
  const MockValidationWarnings = ({
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
  );

  return {
    __esModule: true,
    default: MockValidationWarnings,
    ValidationWarnings: MockValidationWarnings,
  };
});

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
    contract?: {
      salariesByYear?: Array<Record<string, unknown>> | null;
    } | null;
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
    contract:
      | {
          salariesByYear?: Array<Record<string, unknown>> | null;
        }
      | null
      | undefined,
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

vi.mock('@/features/architect/utils/seasonFormat', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/features/architect/utils/seasonFormat')
    >();
  return {
    ...actual,
    toSeasonCode: (endYear: number) =>
      `${endYear - 1}-${String(endYear).slice(-2)}`,
  };
});

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

function completeGovernedSignAndTradeEvidence() {
  fireEvent.change(screen.getByTestId('governed-sat-transaction-at'), {
    target: { value: '2026-07-15T12:00:00-04:00' },
  });
  fireEvent.change(screen.getByTestId('governed-sat-higher-max'), {
    target: { value: 'not-relied-upon' },
  });
  fireEvent.click(screen.getByTestId('governed-sat-consent'));
  fireEvent.click(screen.getByTestId('governed-sat-exhibit-6'));
}

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
      .mockReturnValue(pendingPreflight.promise);

    const { container } = render(
      <EditContractModal
        isOpen
        onClose={onClose}
        player={PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2027}
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
    const salaryInputs = container.querySelectorAll<HTMLInputElement>(
      'input[inputmode="decimal"]'
    );
    fireEvent.change(salaryInputs[0], { target: { value: '20000000' } });
    fireEvent.change(salaryInputs[1], { target: { value: '21000000' } });
    fireEvent.change(salaryInputs[2], { target: { value: '22000000' } });
    expect(
      Array.from(salaryInputs)
        .slice(0, 3)
        .map((input) => input.value)
    ).toEqual(['$20,000,000', '$21,000,000', '$22,000,000']);
    fireEvent.click(screen.getByRole('button', { name: /select bos/i }));
    expect(getSignAndTradePreflight).not.toHaveBeenCalled();
    expect(confirmButton).toBeDisabled();
    expect(screen.getByTestId('validation-warnings')).toHaveTextContent(
      'Complete the exact governed sign-and-trade evidence before preflight.'
    );
    completeGovernedSignAndTradeEvidence();

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
    const stagedPreflightPayload = getSignAndTradePreflight.mock.calls.at(
      -1
    )?.[1] as Record<string, unknown>;
    expect(stagedPreflightPayload).toEqual(
      expect.objectContaining({
        signAndTrade: true,
        contractType: 'Sign & Trade',
        years: 3,
        salaries: [20_000_000, 21_000_000, 22_000_000],
        startYear: 2027,
        salariesByYear: [
          expect.objectContaining({
            season: '2026-27',
            salary: 20_000_000,
            capHit: 20_000_000,
            guaranteed: true,
            incentives: { likely: 0, unlikely: 0 },
          }),
          expect.objectContaining({ season: '2027-28' }),
          expect.objectContaining({ season: '2028-29' }),
        ],
        totalValue: 63_000_000,
        averageAnnualValue: 21_000_000,
        firstYearGuaranteed: true,
        governedSignAndTradeProposal: {
          proposalVersion: 1,
          transactionAt: '2026-07-15T12:00:00-04:00',
          playerConsentConfirmed: true,
          higherMaxStatus: 'not-relied-upon',
          firstSeasonUnlikelyBonuses: 0,
          exhibit6Present: false,
          physicalExam: { status: 'not-required' },
        },
      })
    );

    expect(confirmButton).toBeDisabled();
    expect(screen.getByTestId('validation-warnings')).toHaveTextContent(
      'Checking authoritative sign-and-trade legality...'
    );
    expect(screen.getByText('Authoritative preflight')).toBeInTheDocument();
    expect(
      screen.getByText(
        /This action is using authoritative preflight from the action and mutation layer before confirm\./i
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('Modal guardrails')).toBeNull();

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
    const stagedCommitPayload = onSignAndTrade.mock.calls.at(-1)?.[1] as Record<
      string,
      unknown
    >;
    expect(stagedCommitPayload).toBe(stagedPreflightPayload);
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
    const getSignAndTradePreflight = vi.fn(
      (_player, _payload, destinationTeamCode: string) =>
        destinationTeamCode === 'BOS'
          ? firstRequest.promise
          : Promise.resolve({
              status: 'blocked' as const,
              reasons: [
                'Receiver would exceed First Apron after sign-and-trade.',
              ],
              warnings: [],
              source: 'authoritative-preflight' as const,
            })
    );

    render(
      <EditContractModal
        isOpen
        onClose={() => {}}
        player={PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2027}
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

    fireEvent.click(screen.getByRole('button', { name: /select bos/i }));
    completeGovernedSignAndTradeEvidence();
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
