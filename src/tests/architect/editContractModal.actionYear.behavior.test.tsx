/**
 * FILE: src/tests/architect/editContractModal.actionYear.behavior.test.tsx
 * PURPOSE: Focused proof that future-year Full Cap Table modal actions keep the clicked year.
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
  within,
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

vi.mock('@/shared/components/TeamSelectDropdown', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-team-select" />,
}));

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

vi.mock(
  '@/features/architect/utils/contractUtils',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/features/architect/utils/contractUtils')
      >();

    return {
      ...actual,
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
      getPlayerCapHitForYear: (
        player: {
          contract?: {
            salariesByYear?: Array<Record<string, unknown>> | null;
          } | null;
        } | null | undefined,
        year: number
      ) => {
        const contractSlice =
          (player?.contract?.salariesByYear || []).find((row) => {
            const season = String(row.season || '');
            if (/^\d{4}-\d{2}$/.test(season)) {
              return 2000 + parseInt(season.split('-')[1], 10) === year;
            }
            return parseInt(season, 10) === year;
          }) || null;
        return Number(contractSlice?.capHit ?? contractSlice?.salary ?? 0) || 0;
      },
    };
  }
);

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

const FUTURE_FA_PLAYER = {
  id: 'future_fa_1',
  player_id: 'future_fa_1',
  name: 'Future FA Player',
  displayName: 'Future FA Player',
  freeAgentYear: 2028,
  contract: {
    birdRights: {
      status: 'Full Bird',
    },
    salariesByYear: [
      {
        season: '2025-26',
        salary: 14_000_000,
        capHit: 14_000_000,
        guaranteed: true,
      },
      {
        season: '2026-27',
        salary: 15_120_000,
        capHit: 15_120_000,
        guaranteed: true,
      },
      {
        season: '2027-28',
        salary: 16_329_600,
        capHit: 16_329_600,
        guaranteed: true,
      },
    ],
    freeAgency: {
      type: 'UFA',
      year: 2028,
    },
  },
};

const FUTURE_RFA_PLAYER = {
  ...FUTURE_FA_PLAYER,
  id: 'future_rfa_1',
  player_id: 'future_rfa_1',
  name: 'Future RFA Player',
  displayName: 'Future RFA Player',
  contract: {
    ...FUTURE_FA_PLAYER.contract,
    freeAgency: {
      type: 'RFA',
      year: 2028,
    },
  },
};

const ETO_PLAYER = {
  ...FUTURE_FA_PLAYER,
  id: 'eto_player_1',
  player_id: 'eto_player_1',
  name: 'ETO Player',
  displayName: 'ETO Player',
  contract: {
    ...FUTURE_FA_PLAYER.contract,
    salariesByYear: FUTURE_FA_PLAYER.contract.salariesByYear.map((row) =>
      row.season === '2027-28' ? { ...row, option: 'ETO' } : row
    ),
  },
};

const TEAM_CAP_SHEET = {
  teamCode: 'LAL',
  players: [FUTURE_FA_PLAYER, FUTURE_RFA_PLAYER],
  deadCap: [],
  capHolds: [],
};

afterEach(() => {
  cleanup();
});

describe('EditContractModal future-year action-year routing', () => {
  it('shows a choosing-action context before a direct action is selected', () => {
    render(
      <EditContractModal
        isOpen
        onClose={vi.fn()}
        player={FUTURE_FA_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        targetYear={2028}
        actionYear={2028}
        actionContext="freeAgent"
        actionsOverride={['signNew']}
        onSignFreeAgent={vi.fn().mockResolvedValue({ success: true })}
      />
    );

    const context = within(screen.getByTestId('contract-modal-action-context'));
    expect(context.getByText('Team Plan action')).toBeInTheDocument();
    expect(context.getByText('Choose contract action')).toBeInTheDocument();
    expect(context.getByText('Choosing action')).toBeInTheDocument();
    expect(context.getByText('Future FA Player')).toBeInTheDocument();
    expect(context.getByText('2027-28')).toBeInTheDocument();
  });

  it('shows the selected direct action and action season when initialized from a clicked cell', () => {
    render(
      <EditContractModal
        isOpen
        onClose={vi.fn()}
        player={FUTURE_FA_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        targetYear={2028}
        actionYear={2028}
        actionContext="freeAgent"
        initialAction="signNew"
        actionsOverride={['signNew']}
        onSignFreeAgent={vi.fn().mockResolvedValue({ success: true })}
      />
    );

    const context = within(screen.getByTestId('contract-modal-action-context'));
    expect(context.getByText('Team Plan action')).toBeInTheDocument();
    expect(context.getByText('Sign New Contract')).toBeInTheDocument();
    expect(context.getByText('Editing terms')).toBeInTheDocument();
    expect(context.getByText('Future FA Player')).toBeInTheDocument();
    expect(context.getByText('2027-28')).toBeInTheDocument();
  });

  it('offers only canonical enabled signing exceptions and resets stale selections to None', async () => {
    const renderModal = (teamCapSheet: Record<string, unknown>) =>
      render(
        <EditContractModal
          isOpen
          onClose={vi.fn()}
          player={FUTURE_FA_PLAYER}
          teamCapSheet={teamCapSheet}
          currentYear={2026}
          targetYear={2028}
          actionYear={2028}
          actionContext="freeAgent"
          initialAction="signNew"
          actionsOverride={['signNew']}
          onSignFreeAgent={vi.fn().mockResolvedValue({ success: true })}
        />
      );

    const canonicalTeamCapSheet = {
      ...TEAM_CAP_SHEET,
      exceptions: {
        mle: {
          enabled: true,
          totalAmount: 12_900_000,
          usedAmount: 0,
          remainingAmount: 12_900_000,
        },
        tpmle: {
          enabled: false,
          totalAmount: 5_685_000,
          usedAmount: 0,
          remainingAmount: 5_685_000,
        },
      },
    };

    const { rerender } = renderModal(canonicalTeamCapSheet);

    const getExceptionSelect = () =>
      screen.getAllByRole('combobox')[1] as HTMLSelectElement;

    const initialExceptionSelect = getExceptionSelect();
    const initialOptions = within(initialExceptionSelect)
      .getAllByRole('option')
      .map((option) => option.textContent?.trim());

    expect(initialOptions).toEqual(['Cap Space / Rights', 'Full MLE', 'Minimum']);

    fireEvent.change(initialExceptionSelect, {
      target: { value: 'Full MLE' },
    });
    expect(getExceptionSelect().value).toBe('Full MLE');

    rerender(
      <EditContractModal
        isOpen
        onClose={vi.fn()}
        player={FUTURE_FA_PLAYER}
        teamCapSheet={{ ...TEAM_CAP_SHEET, exceptions: {} }}
        currentYear={2026}
        targetYear={2028}
        actionYear={2028}
        actionContext="freeAgent"
        initialAction="signNew"
        actionsOverride={['signNew']}
        onSignFreeAgent={vi.fn().mockResolvedValue({ success: true })}
      />
    );

    await waitFor(() => {
      expect(getExceptionSelect().value).toBe('None');
    });

    const resetOptions = within(getExceptionSelect())
      .getAllByRole('option')
      .map((option) => option.textContent?.trim());
    expect(resetOptions).toEqual(['Cap Space / Rights', 'Minimum']);
  });

  it('stages standard-sign payloads from the clicked action year without modal-finalized rows or totals', async () => {
    const onClose = vi.fn();
    const onSignFreeAgent = vi.fn().mockResolvedValue({ success: true });

    render(
      <EditContractModal
        isOpen
        onClose={onClose}
        player={FUTURE_FA_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        targetYear={2028}
        actionYear={2028}
        actionContext="freeAgent"
        initialAction="signNew"
        actionsOverride={['signNew']}
        onSignFreeAgent={onSignFreeAgent}
      />
    );

    const confirmButton = screen.getByTestId('edit-contract-confirm-action-button');
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(onSignFreeAgent).toHaveBeenCalledTimes(1);
    });

    const stagedPayload = onSignFreeAgent.mock.calls.at(-1)?.[1] as Record<
      string,
      unknown
    >;

    expect(onSignFreeAgent).toHaveBeenCalledWith(
      FUTURE_FA_PLAYER,
      expect.objectContaining({
        startYear: 2028,
        years: expect.any(Number),
        salaries: expect.any(Array),
      })
    );
    expect(Array.isArray(stagedPayload.salaries)).toBe(true);
    expect(stagedPayload.salaries).toHaveLength(Number(stagedPayload.years));
    expect((stagedPayload.salaries as number[])[0]).toBeGreaterThan(0);
    expect(stagedPayload).not.toHaveProperty('salariesByYear');
    expect(stagedPayload).not.toHaveProperty('base');
    expect(stagedPayload).not.toHaveProperty('totalValue');
    expect(stagedPayload).not.toHaveProperty('averageAnnualValue');
    expect(stagedPayload).not.toHaveProperty('firstYearGuaranteed');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('builds future-year offer-sheet preflight payload seasons from the clicked action year', async () => {
    const getOfferSheetPreflight = vi.fn().mockResolvedValue({
      status: 'legal',
      reasons: [],
      warnings: [],
      source: 'authoritative-preflight',
    });

    render(
      <EditContractModal
        isOpen
        onClose={vi.fn()}
        player={FUTURE_RFA_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        targetYear={2028}
        actionYear={2028}
        actionContext="freeAgent"
        initialAction="signNew"
        actionsOverride={['signNew']}
        getOfferSheetPreflight={getOfferSheetPreflight}
        onStoreOfferSheet={vi.fn().mockResolvedValue({ success: true })}
      />
    );

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(getOfferSheetPreflight).toHaveBeenCalledWith(
        FUTURE_RFA_PLAYER,
        expect.objectContaining({
          startYear: 2028,
          contractType: 'Offer Sheet',
          salariesByYear: expect.arrayContaining([
            expect.objectContaining({
              season: '2027-28',
            }),
          ]),
        })
      );
    });
  });

  it('stores future-year offer sheets from the same clicked action-year payload seam', async () => {
    const getOfferSheetPreflight = vi.fn().mockResolvedValue({
      status: 'legal',
      reasons: [],
      warnings: [],
      source: 'authoritative-preflight',
    });
    const onStoreOfferSheet = vi.fn().mockResolvedValue({ success: true });

    render(
      <EditContractModal
        isOpen
        onClose={vi.fn()}
        player={FUTURE_RFA_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        targetYear={2028}
        actionYear={2028}
        actionContext="freeAgent"
        initialAction="signNew"
        actionsOverride={['signNew']}
        getOfferSheetPreflight={getOfferSheetPreflight}
        onStoreOfferSheet={onStoreOfferSheet}
      />
    );

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(getOfferSheetPreflight).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByTestId('edit-contract-confirm-action-button'));

    await waitFor(() => {
      expect(onStoreOfferSheet).toHaveBeenCalledWith(
        FUTURE_RFA_PLAYER,
        expect.objectContaining({
          startYear: 2028,
          contractType: 'Offer Sheet',
          salariesByYear: expect.arrayContaining([
            expect.objectContaining({
              season: '2027-28',
            }),
          ]),
        })
      );
    });

    expect(onStoreOfferSheet.mock.calls[0][1]).toEqual(
      getOfferSheetPreflight.mock.calls[0][1]
    );
  });

  it('requires and dispatches exact governed notice evidence for an ETO', async () => {
    const onOptionDecision = vi.fn().mockResolvedValue({ success: true });
    const onClose = vi.fn();
    render(
      <EditContractModal
        isOpen
        onClose={onClose}
        player={ETO_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        targetYear={2028}
        actionYear={2028}
        actionContext="option"
        initialAction="accept"
        actionsOverride={['accept', 'decline']}
        actionLabelsOverride={{
          accept: 'Exercise ETO',
          decline: 'Do Not Exercise ETO',
        }}
        optionDecisionAvailability={{
          status: 'ready',
          playerId: 'eto_player_1',
          contractId: 'contract-eto-1',
          targetYear: 2028,
          optionType: 'ETO',
          reasons: [],
          noticeRequirements: {
            deadline: '2027-06-29T17:00:00-04:00',
            windowOpensAt: '2027-06-01T09:00:00-04:00',
            allowedMethods: ['email'],
            recipientId: 'eto_player_1',
            recipientRole: 'player',
            leagueForwardingRequired: true,
          },
        }}
        onOptionDecision={onOptionDecision}
      />
    );

    expect(screen.getAllByText('Exercise ETO').length).toBeGreaterThan(0);
    expect(screen.getByText('Do Not Exercise ETO')).toBeInTheDocument();
    expect(screen.getByTestId('governed-option-notice-form')).toHaveTextContent(
      'No date is inferred'
    );
    const confirm = screen.getByTestId('edit-contract-confirm-action-button');
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByTestId('option-notice-delivered-at'), {
      target: { value: '2027-06-29T16:30:00-04:00' },
    });
    fireEvent.change(screen.getByTestId('option-notice-league-received-at'), {
      target: { value: '2027-06-29T16:31:00-04:00' },
    });
    fireEvent.change(screen.getByTestId('option-notice-pa-forwarded-at'), {
      target: { value: '2027-06-30T09:00:00-04:00' },
    });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(onOptionDecision).toHaveBeenCalledWith(
        ETO_PLAYER,
        true,
        null,
        2028,
        {
          deliveredAt: '2027-06-29T16:30:00-04:00',
          method: 'email',
          recipient: 'eto_player_1',
          leagueReceivedAt: '2027-06-29T16:31:00-04:00',
          playersAssociationForwardedAt: '2027-06-30T09:00:00-04:00',
        }
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a governed Needs input reason and cannot select a blocked decision', () => {
    render(
      <EditContractModal
        isOpen
        onClose={vi.fn()}
        player={ETO_PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        targetYear={2028}
        actionYear={2028}
        actionContext="option"
        actionsOverride={['accept', 'decline']}
        optionDecisionAvailability={{
          status: 'needs-input',
          playerId: 'eto_player_1',
          contractId: 'contract-eto-1',
          targetYear: 2028,
          optionType: 'ETO',
          reasons: [
            'The exact contractual notice deadline must be an exact governed instant with a UTC offset.',
          ],
          noticeRequirements: null,
        }}
        onOptionDecision={vi.fn()}
      />
    );

    expect(
      screen.getByText(/exact contractual notice deadline/i)
    ).toBeInTheDocument();
    const optionRadios = screen.getAllByRole('radio');
    expect(optionRadios).toHaveLength(2);
    optionRadios.forEach((radio) => expect(radio).toBeDisabled());
    expect(
      screen.queryByTestId('governed-option-notice-form')
    ).not.toBeInTheDocument();
  });
});
