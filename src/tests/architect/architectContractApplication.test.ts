/**
 * @vitest-environment jsdom
 *
 * FILE: src/tests/architect/architectContractApplication.test.ts
 * PURPOSE: Focused regression proof for the Architect contract application pass.
 * Covers:
 *  - ContractEditorModal forwarding and sign payload preservation with canonical-compatible fixtures
 *  - useArchitectActions contract normalization on a pipeline-facing helper boundary
 *  - useCapValidation with PlayerRulesProfile-compatible player/team slices
 */

import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import ContractEditorModal from '@/features/architect/contract/ContractEditorModal/ContractEditorModal';
import {
  ensureContractStructure,
} from '@/features/architect/GMDashboard/hooks/useArchitectActions';
import useCapValidation from '@/features/architect/hooks/useCapValidation';
import type { PlayerRulesProfileInput } from '@/features/architect/types';
import type { CapProjectionOverrides } from '@/features/architect/utils/capRulesProfile';

type ContractEditorModalProps = Parameters<typeof ContractEditorModal>[0];
type ValidationParams = Parameters<typeof useCapValidation>[0];

describe('Architect contract application pass', () => {
  it('preserves the ContractEditorModal sign payload shape with canonical-compatible fixtures', () => {
    const onSign = vi.fn();
    const player: PlayerRulesProfileInput = {
      id: 'player_1',
      playerId: 'player_1',
      player_id: 'player_1',
      name: 'Typed Player',
      displayName: 'Typed Player',
      yearsOfService: 4,
      draftPick: 8,
      bio: {
        displayName: 'Typed Player',
        experience: 4,
        draftPick: 8,
      },
      contract: {
        contractType: 'Standard',
        salariesByYear: [
          {
            season: '2025-26',
            salary: 9_000_000,
            capHit: 9_000_000,
            guaranteed: true,
          },
        ],
      },
    };
    const capProjections: CapProjectionOverrides = {
      '2025-26': {
        cap: 141_000_000,
      },
    };
    const playersMap: NonNullable<ContractEditorModalProps['playersMap']> = {
      player_1: player,
    };

    render(
      React.createElement(ContractEditorModal, {
        player,
        isOpen: true,
        onClose: vi.fn(),
        capProjections,
        onSign,
        playersMap,
      })
    );

    fireEvent.click(screen.getByText('Preview Contract'));
    fireEvent.click(screen.getByText('Sign Player'));

    expect(onSign).toHaveBeenCalledTimes(1);
    expect(onSign.mock.calls[0]?.[0]).toBe(player);
    expect(onSign.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        type: 'Custom',
        yearsOfService: 4,
        isMinimum: false,
        guaranteed: true,
      })
    );
    expect(onSign.mock.calls[0]?.[1]?.salariesByYear).toHaveLength(4);
  });

  it('keeps ensureContractStructure aligned to the pipeline-facing contract rows', () => {
    const contract = ensureContractStructure(
      {
        salaries: [12_000_000, '13500000'],
        years: 2,
        startYear: 2026,
        contractType: 'Offer Sheet',
      },
      {
        contractType: 'Offer Sheet',
        startYear: 2026,
      }
    );

    expect(contract).toEqual(
      expect.objectContaining({
        contractType: 'Offer Sheet',
        salariesByYear: [
          {
            season: '2025-26',
            salary: 12_000_000,
            capHit: 12_000_000,
            guaranteed: true,
            guaranteedAmount: 12_000_000,
            option: null,
            optionType: null,
            optionUsed: null,
          },
          {
            season: '2026-27',
            salary: 13_500_000,
            capHit: 13_500_000,
            guaranteed: true,
            guaranteedAmount: 13_500_000,
            option: null,
            optionType: null,
            optionUsed: null,
          },
        ],
      })
    );
  });

  it('accepts canonical player and team slices in useCapValidation without changing validation behavior', () => {
    const player: NonNullable<ValidationParams['player']> = {
      id: 'player_2',
      player_id: 'player_2',
      name: 'Validation Player',
      displayName: 'Validation Player',
      contractType: 'Standard',
      contract: {
        salariesByYear: [
          {
            season: '2025-26',
            salary: 5_000_000,
            capHit: 5_000_000,
            guaranteed: true,
          },
        ],
        birdRights: {
          status: 'None',
        },
      },
    };
    const teamCapSheet: NonNullable<ValidationParams['teamCapSheet']> = {
      teamCode: 'TST',
      players: [player],
      deadCap: [],
      capHolds: [],
    };

    const { result } = renderHook(() =>
      useCapValidation({
        player,
        action: 'signNew',
        contractData: {
          base: 1_000_000,
        },
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
    expect(result.current.isValid).toBe(false);
  });
});
