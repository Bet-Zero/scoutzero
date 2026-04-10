// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useArchitectActions } from '@/features/architect/GMDashboard/hooks/useArchitectActions';
import useCapValidation from '@/features/architect/hooks/useCapValidation';
import {
  computeExpectedCapHoldAmount,
  getRightsTypeFromPlayer,
  shouldExpectCapHoldOnDecline,
  validateDeclineFreeAgency,
} from '@/features/architect/utils/capHoldTransitionHelpers';
import type {
  PlayerRulesProfileInput,
  PlayerRulesProfileTeamCapSheet,
} from '@/features/architect/types';

const auditLogMocks = vi.hoisted(() => ({
  appendLocalCapAuditEvent: vi.fn(),
  updateLocalCapAuditEvent: vi.fn(),
  withLocalCapAuditLifecycleState: vi.fn((event, lifecycleState) => ({
    ...event,
    localAuditLifecycleState: lifecycleState,
  })),
  buildAuthoritativeLinkEstablishedAuditPatch: vi.fn(
    (authoritativeOperationId: string) => ({
      localAuditLifecycleState: 'authoritative-link-established',
      authoritativeEventLinked: true,
      authoritativeOperationId,
      persistFailed: false,
    })
  ),
  buildPersistFailedRolledBackAuditPatch: vi.fn(() => ({
    localAuditLifecycleState: 'persist-failed-rolled-back',
    authoritativeEventLinked: false,
    authoritativeOperationId: undefined,
    persistFailed: true,
  })),
}));

const validatorMocks = vi.hoisted(() => ({
  validatePostStateCapLegality: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
}));

const totalsMocks = vi.hoisted(() => ({
  computeTeamCapTotals: vi.fn(() => ({
    capHit: 0,
  })),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/features/architect/utils/capLegality/localCapAuditLog', () => ({
  BASE_CAP_AUDIT_STORAGE_KEY: 'base-cap-audit',
  WORLD_PREVIEW_CAP_AUDIT_STORAGE_KEY: 'world-preview-cap-audit',
  BASE_LOCAL_VALIDATED_CAP_AUDIT_STREAM: {
    storageKey: 'base-cap-audit',
    stateKind: 'local-validated-apply',
    authoritative: false,
    persistsToWorld: false,
    preview: false,
    initialAuthoritativeEventLinked: undefined,
    committedWorldTransition: 'never-links',
  },
  WORLD_OPTIMISTIC_PREVIEW_CAP_AUDIT_STREAM: {
    storageKey: 'world-preview-cap-audit',
    stateKind: 'optimistic-local-preview',
    authoritative: false,
    persistsToWorld: 'pending-world-persist',
    preview: true,
    initialAuthoritativeEventLinked: false,
    committedWorldTransition: 'links-on-success-or-rolls-back',
  },
  appendLocalCapAuditEvent: auditLogMocks.appendLocalCapAuditEvent,
  updateLocalCapAuditEvent: auditLogMocks.updateLocalCapAuditEvent,
  withLocalCapAuditLifecycleState: auditLogMocks.withLocalCapAuditLifecycleState,
  buildAuthoritativeLinkEstablishedAuditPatch:
    auditLogMocks.buildAuthoritativeLinkEstablishedAuditPatch,
  buildPersistFailedRolledBackAuditPatch:
    auditLogMocks.buildPersistFailedRolledBackAuditPatch,
}));

vi.mock('@/features/architect/utils/capLegality/postStateCapValidator', () => ({
  POST_STATE_CAP_VALIDATOR_VERSION: 'test-validator',
  validatePostStateCapLegality: validatorMocks.validatePostStateCapLegality,
}));

vi.mock('@/features/architect/utils/capTotals', () => ({
  computeTeamCapTotals: totalsMocks.computeTeamCapTotals,
}));

vi.mock('react-hot-toast', () => ({
  default: toastMocks,
}));

const createArchitectActionsHarness = () => {
  const setTeamCapSheet = vi.fn();
  const state = {
    teamCapSheet: {
      teamCode: 'LAL',
      players: [],
      capHolds: [],
      deadCap: [],
      exceptions: null,
      roster: [],
    },
    currentYear: 2026,
    worldAsOfDate: null,
    setTeamCapSheet,
    setSelectedRulesYear: vi.fn(),
    setSelectedPlayer: vi.fn(),
    setFreeAgents: vi.fn(),
    startSave: vi.fn(),
    finishSave: vi.fn(),
    setOffseasonRun: vi.fn(),
    setOffseasonSummary: vi.fn(),
    refreshWorldRosterIndex: vi.fn(),
  };

  const modals = {
    openContractModal: vi.fn(),
    closeContractModal: vi.fn(),
  };

  return {
    setTeamCapSheet,
    hook: renderHook(() =>
      useArchitectActions({
        teamId: 'lakers',
        userId: null,
        state,
        playersMap: {},
        modals,
        worldId: null,
        seasonId: '2025-26',
      })
    ),
  };
};

describe('Architect final type implementation proof', () => {
  beforeEach(() => {
    auditLogMocks.appendLocalCapAuditEvent.mockClear();
    auditLogMocks.updateLocalCapAuditEvent.mockClear();
    validatorMocks.validatePostStateCapLegality.mockClear();
    totalsMocks.computeTeamCapTotals.mockClear();
    toastMocks.success.mockClear();
    toastMocks.error.mockClear();
  });

  it('keeps useArchitectActions setExceptions aligned to mutation-compatible exception payloads', async () => {
    const { hook, setTeamCapSheet } = createArchitectActionsHarness();
    const exceptionsPayload = {
      mle: {
        enabled: true,
        totalAmount: 12_800_000,
        usedAmount: 1_200_000,
        remainingAmount: 11_600_000,
        seasonKey: '2025-26',
      },
    };

    await expect(
      hook.result.current.handleSetExceptions(exceptionsPayload)
    ).resolves.toBe(true);

    const nextTeam = setTeamCapSheet.mock.calls.at(-1)?.[0];
    expect(nextTeam).toEqual(
      expect.objectContaining({
        exceptions: exceptionsPayload,
      })
    );
    expect(auditLogMocks.appendLocalCapAuditEvent).toHaveBeenCalledTimes(1);
  });

  it('keeps cap-hold decline helpers aligned to canonical player and free-agency state', () => {
    const player = {
      contract: {
        birdRights: {
          status: 'Early Bird',
        },
        salariesByYear: [
          {
            season: '2025-26',
            salary: 10_000_000,
            capHit: 10_000_000,
          },
          {
            season: '2026-27',
            salary: 12_000_000,
            capHit: 12_000_000,
            option: 'PO',
          },
        ],
      },
    };

    expect(shouldExpectCapHoldOnDecline(player, 2027)).toEqual({
      shouldCreate: true,
      priorSalary: 10_000_000,
      optionSeason: '2026-27',
    });

    const rightsType = getRightsTypeFromPlayer(player);
    expect(rightsType).toBe('EARLY_BIRD');

    expect(
      computeExpectedCapHoldAmount({
        player,
        lastSalary: 10_000_000,
        rightsType,
        rules: null,
      })
    ).toEqual({
      amount: 13_000_000,
      multiplier: 1.3,
      rightsType: 'EARLY_BIRD',
      usedFallback: false,
      missingRightsType: false,
    });

    expect(
      validateDeclineFreeAgency(
        {
          type: 'UFA',
          year: 2026,
        },
        2026,
        {
          source: 'option_season',
        }
      )
    ).toEqual({
      valid: true,
      violations: [],
      warnings: [],
    });
  });

  it('keeps useCapValidation consumable by canonical player, team, and rules-profile slices', () => {
    const player: NonNullable<Parameters<typeof useCapValidation>[0]['player']> =
      {
      id: 'player_2',
      player_id: 'player_2',
      playerId: 'player_2',
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

    const teamCapSheet: NonNullable<
      Parameters<typeof useCapValidation>[0]['teamCapSheet']
    > = {
      teamCode: 'TST',
      players: [player],
      deadCap: [],
      capHolds: [],
    };

    const rulesProfile: NonNullable<
      Parameters<typeof useCapValidation>[0]['rulesProfile']
    > = {
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
        rulesProfile,
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
});
