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
  default: () => <div data-testid="mock-team-select" />,
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
  it('builds sign payload seasons from the clicked action year instead of dashboard current year', async () => {
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

    expect(onSignFreeAgent).toHaveBeenCalledWith(
      FUTURE_FA_PLAYER,
      expect.objectContaining({
        startYear: 2028,
        salariesByYear: expect.arrayContaining([
          expect.objectContaining({
            season: '2027-28',
          }),
        ]),
      })
    );
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
});
