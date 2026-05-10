/**
 * FILE: src/tests/architect/architectHardeningE3.polish.test.ts
 * PURPOSE: Narrow regression proof for the third Architect TS hardening pass (E3).
 * Validates the EditContractModal -> useCapValidation alignment and the
 * CapSheetSection / CapTableSection wrapper callback forwarding contracts.
 * OWNERSHIP: Feature: architect/ts-hardening
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CapSheet } from '@/features/architect/capSheet/CapSheet';
import type { CapSheetFull } from '@/features/architect/capSheet/CapSheetFull';
import { EditContractModal } from '@/shared/components/EditContractModal';
import { useCapValidation, buildSigningGuardrails } from '@/features/architect/hooks/useCapValidation';
import { CapSheetSection } from '@/features/architect/GMDashboard/sections/CapSheetSection';
import { CapTableSection } from '@/features/architect/GMDashboard/sections/CapTableSection';

type CapSheetChildProps = Parameters<typeof CapSheet>[0];
type CapSheetFullChildProps = Parameters<typeof CapSheetFull>[0];
type ModalPlayerLike = NonNullable<
  Parameters<typeof EditContractModal>[0]['player']
>;
type ModalTeamCapSheetLike = NonNullable<
  Parameters<typeof EditContractModal>[0]['teamCapSheet']
>;
type HookContractDataLike = NonNullable<
  Parameters<typeof useCapValidation>[0]['contractData']
>;

const wrapperFixtures = vi.hoisted(() => ({
  deadCapPayload: [
    {
      playerId: 'dead_cap_fixture',
      playerName: 'Dead Cap Fixture',
      originalSalary: 5_000_000,
      amountByYear: [{ season: '2025-26', amount: 5_000_000 }],
    },
  ],
  exceptionsPayload: {
    mle: {
      enabled: true,
      totalAmount: 12_800_000,
      usedAmount: 1_200_000,
      seasonKey: '2025-26',
    },
  },
  capTablePlayer: {
    id: 'cap_table_fixture',
    player_id: 'cap_table_fixture',
    name: 'Cap Table Fixture',
    displayName: 'Cap Table Fixture',
    contract: {
      contractType: 'Standard',
      salariesByYear: [
        {
          season: '2025-26',
          salary: 6_000_000,
          capHit: 6_000_000,
          guaranteed: true,
        },
      ],
    },
  },
  capHold: {
    playerId: 'cap_hold_fixture',
    playerName: 'Cap Hold Fixture',
  },
  lastForwardedManualCapSheetMutationAuthority: null as unknown,
}));

vi.mock('@/features/architect/capSheet/CapSheet', () => ({
  default: ({
    manualCapSheetMutationAuthority,
    onOpenPlayerContractModal,
  }: CapSheetChildProps) => {
    wrapperFixtures.lastForwardedManualCapSheetMutationAuthority =
      manualCapSheetMutationAuthority ?? null;

    return React.createElement(
      'div',
      null,
      React.createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'cap-sheet-forward-dead-cap',
          onClick: () =>
            manualCapSheetMutationAuthority?.handleSetDeadCap(
              wrapperFixtures.deadCapPayload
            ),
        },
        'Forward Dead Cap'
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'cap-sheet-forward-exceptions',
          onClick: () =>
            manualCapSheetMutationAuthority?.handleSetExceptions(
              wrapperFixtures.exceptionsPayload
            ),
        },
        'Forward Exceptions'
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'cap-sheet-forward-open-contract',
          onClick: () =>
            onOpenPlayerContractModal?.(wrapperFixtures.capTablePlayer),
        },
        'Forward Open Contract'
      )
    );
  },
}));

vi.mock('@/features/architect/capSheet/CapSheetFull', () => ({
  default: ({
    onOpenPlayerContractModal,
    onLaunchContractAction,
    onRenounceCapHold,
  }: CapSheetFullChildProps) =>
    React.createElement(
      'div',
      null,
      React.createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'cap-table-forward-select-player',
          onClick: () =>
            onOpenPlayerContractModal?.(wrapperFixtures.capTablePlayer),
        },
        'Forward Select Player'
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'cap-table-forward-action',
          onClick: () =>
            onLaunchContractAction?.(
              wrapperFixtures.capTablePlayer,
              'rfa',
              2027
            ),
        },
        'Forward Action'
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'cap-table-forward-renounce',
          onClick: () => onRenounceCapHold?.(wrapperFixtures.capHold),
        },
        'Forward Renounce'
      )
    ),
}));

vi.mock('@/features/architect/capSheet/ExceptionTracker', () => ({
  default: () =>
    React.createElement('div', { 'data-testid': 'mock-exception-tracker' }),
}));

describe('Architect TypeScript hardening E3 regression', () => {
  it('keeps useCapValidation directly consumable by modal-compatible player and cap-sheet shapes', () => {
    const player: ModalPlayerLike = {
      id: 'modal_fixture',
      player_id: 'modal_fixture',
      name: 'Modal Fixture',
      displayName: 'Modal Fixture',
      yearsOfService: 4,
      bio: {
        experience: 4,
      },
      contract: {
        contractType: 'Standard',
        salariesByYear: [
          {
            season: '2025-26',
            salary: 5_000_000,
            capHit: 5_000_000,
            guaranteed: true,
          },
        ],
      },
    };
    const teamCapSheet: ModalTeamCapSheetLike = {
      teamCode: 'TST',
      players: [player],
      capHolds: [],
      deadCap: [],
    };
    const contractData: HookContractDataLike = {
      years: 1,
      salaries: [1_000_000],
      exceptionType: 'None',
      guardrails: buildSigningGuardrails(
        {
          minimumSalary: 2_000_000,
          birdRights: {
            type: 'None',
            signingAbilities: {
              canSignToMax: false,
              maxFirstYearSalary: 8_000_000,
              raisePercentage: 0.05,
              maxYears: 4,
            },
          },
          maxSalary: {
            maxSalary: 8_000_000,
            maxSalaryBird: 8_000_000,
          },
          restrictedFreeAgency: {
            isRFA: false,
          },
        },
        {},
        'None'
      ),
    };

    const { result } = renderHook(() =>
      useCapValidation({
        player,
        action: 'signNew',
        contractData,
        teamCapSheet,
        currentYear: 2026,
        rulesProfile: {
          minimumSalary: 2_000_000,
          birdRights: {
            type: 'None',
            signingAbilities: {
              canSignToMax: false,
              maxFirstYearSalary: 8_000_000,
              raisePercentage: 0.05,
              maxYears: 4,
            },
          },
          maxSalary: {
            maxSalary: 8_000_000,
            maxSalaryBird: 8_000_000,
          },
          restrictedFreeAgency: {
            isRFA: false,
          },
        },
      })
    );

    expect(result.current.errors).toEqual([
      {
        severity: 'error',
        message: 'Below minimum allowed first year ($2.00M)',
      },
    ]);
    expect(result.current.warnings).toEqual([]);
    expect(result.current.isValid).toBe(false);
    expect(result.current.incomplete).toBe(false);
  });

  it('forwards CapSheetSection manual mutation authority unchanged', () => {
    const manualCapSheetMutationAuthority = {
      handleSetDeadCap: vi.fn(),
      handleSetExceptions: vi.fn(),
    };
    const onOpenPlayerContractModal = vi.fn();

    render(
      React.createElement(CapSheetSection, {
        teamCapSheet: {
          teamCode: 'TST',
          players: [wrapperFixtures.capTablePlayer],
        },
        currentYear: 2026,
        onOpenPlayerContractModal,
        manualCapSheetMutationAuthority,
      })
    );

    fireEvent.click(screen.getByTestId('cap-sheet-forward-dead-cap'));
    fireEvent.click(screen.getByTestId('cap-sheet-forward-exceptions'));
    fireEvent.click(screen.getByTestId('cap-sheet-forward-open-contract'));

    expect(wrapperFixtures.lastForwardedManualCapSheetMutationAuthority).toBe(
      manualCapSheetMutationAuthority
    );
    expect(manualCapSheetMutationAuthority.handleSetDeadCap).toHaveBeenCalledTimes(
      1
    );
    expect(
      manualCapSheetMutationAuthority.handleSetDeadCap.mock.calls[0][0]
    ).toBe(wrapperFixtures.deadCapPayload);
    expect(
      manualCapSheetMutationAuthority.handleSetExceptions
    ).toHaveBeenCalledTimes(1);
    expect(
      manualCapSheetMutationAuthority.handleSetExceptions.mock.calls[0][0]
    ).toBe(
      wrapperFixtures.exceptionsPayload
    );
    expect(onOpenPlayerContractModal).toHaveBeenCalledTimes(1);
    expect(onOpenPlayerContractModal.mock.calls[0][0]).toBe(
      wrapperFixtures.capTablePlayer
    );
  });

  it('forwards CapTableSection select/action payloads unchanged', () => {
    const onOpenPlayerContractModal = vi.fn();
    const onLaunchContractAction = vi.fn();
    const onRenounceCapHold = vi.fn();

    render(
      React.createElement(CapTableSection, {
        teamCapSheet: {
          teamCode: 'TST',
          players: [wrapperFixtures.capTablePlayer],
        },
        currentYear: 2026,
        onOpenPlayerContractModal,
        onLaunchContractAction,
        onRenounceCapHold,
      })
    );

    fireEvent.click(screen.getByTestId('cap-table-forward-select-player'));
    fireEvent.click(screen.getByTestId('cap-table-forward-action'));
    fireEvent.click(screen.getByTestId('cap-table-forward-renounce'));

    expect(onOpenPlayerContractModal).toHaveBeenCalledTimes(1);
    expect(onOpenPlayerContractModal.mock.calls[0][0]).toBe(
      wrapperFixtures.capTablePlayer
    );
    expect(onLaunchContractAction).toHaveBeenCalledTimes(1);
    expect(onLaunchContractAction.mock.calls[0][0]).toBe(
      wrapperFixtures.capTablePlayer
    );
    expect(onLaunchContractAction.mock.calls[0][1]).toBe('rfa');
    expect(onLaunchContractAction.mock.calls[0][2]).toBe(2027);
    expect(onRenounceCapHold).toHaveBeenCalledTimes(1);
    expect(onRenounceCapHold.mock.calls[0][0]).toBe(wrapperFixtures.capHold);
  });
});
