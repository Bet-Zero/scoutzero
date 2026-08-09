/**
 * FILE: src/tests/architect/capSheetCloseoutBlockersRemediation2.hardCapOwnership.test.ts
 * PURPOSE: Focused closeout blocker proof for first-apron hard-cap ownership coherence.
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import {
  buildTotalsByTeam,
  computeWorldMutation,
  type ArchitectMutationPayload,
} from '@/features/architect/utils/mutationPipeline';
import { synchronizeTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { validatePostStateCapLegality } from '@/features/architect/utils/capLegality/postStateCapValidator';
import {
  validateExceptionEligibility,
  validateSigning,
} from '@/features/architect/utils/capLegalityValidation';
import { getHardCapStatus } from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import { hydrateBaseTeam } from '@/features/architect/utils/firebaseTeamPlanHelpers';
import {
  makeRightsEstablishedEvent,
  makeRightsLedger,
} from '../../../tests/fixtures/architect/rightsHistory';

const CAP_SETTINGS = {
  salaryCap: 140_588_000,
  firstApron: 178_132_000,
  secondApron: 188_932_000,
};

const EXISTING_STANDARD_PLAYERS = Array.from({ length: 13 }, (_, index) => ({
  id: `existing_player_${index + 1}`,
  player_id: `existing_player_${index + 1}`,
  name: `Existing Player ${index + 1}`,
  displayName: `Existing Player ${index + 1}`,
  contract: {
    contractType: 'Standard',
    salariesByYear: [
      {
        season: '2025-26',
        salary: 1_000_000,
        capHit: 1_000_000,
        guaranteed: true,
      },
    ],
  },
}));

const TEAM_FIXTURE = {
  teamCode: 'LAL',
  teamName: 'Los Angeles Lakers',
  roster: [],
  players: EXISTING_STANDARD_PLAYERS,
  capHolds: [
    {
      playerId: 'player_1',
      playerName: 'Test Player',
      amount: 9_000_000,
      type: 'FA Cap Hold',
      season: '2025-26',
      isSigned: false,
      active: true,
    },
  ],
  deadCap: [],
  exceptions: {
    mle: {
      type: 'non-taxpayer',
      totalAmount: 12_900_000,
      usedAmount: 0,
      remainingAmount: 12_900_000,
    },
  },
  totals: {},
};

const BAE_TEAM_FIXTURE = {
  ...TEAM_FIXTURE,
  exceptions: {
    bae: {
      totalAmount: 5_135_000,
      usedAmount: 0,
      remainingAmount: 5_135_000,
    },
  },
  totals: {},
};

const DISABLED_MLE_TEAM_FIXTURE = {
  ...TEAM_FIXTURE,
  exceptions: {
    mle: {
      type: 'non-taxpayer',
      enabled: false,
      totalAmount: 12_900_000,
      usedAmount: 0,
      remainingAmount: 12_900_000,
    },
  },
  totals: {},
};

const LEGACY_ALIAS_ONLY_MLE_TEAM_FIXTURE = {
  ...TEAM_FIXTURE,
  exceptions: {},
  mle: {
    amount: 12_900_000,
    used: 0,
    remaining: 12_900_000,
  },
  totals: {},
};

const PLAYER_FIXTURE = {
  id: 'player_1',
  player_id: 'player_1',
  name: 'Test Player',
  displayName: 'Test Player',
  contract: {
    salariesByYear: [],
  },
};

function createStandardPlayer(playerId: string, salary: number) {
  return {
    id: playerId,
    player_id: playerId,
    name: playerId,
    displayName: playerId,
    contract: {
      contractType: 'Standard',
      salariesByYear: [
        {
          season: '2025-26',
          salary,
          capHit: salary,
          guaranteed: true,
        },
      ],
    },
  };
}

const SIGNING_PAYLOAD: ArchitectMutationPayload = {
  teamCode: 'LAL',
  playerId: 'player_1',
  signedUsing: 'Full MLE',
  contract: {
    contractType: 'Signed FA',
    salariesByYear: [
      {
        season: '2025-26',
        salary: 12_000_000,
        capHit: 12_000_000,
        guaranteed: true,
      },
    ],
    totalValue: 12_000_000,
  },
};

const BAE_SIGNING_PAYLOAD: ArchitectMutationPayload = {
  teamCode: 'LAL',
  playerId: 'player_1',
  signedUsing: 'BAE',
  contract: {
    contractType: 'Signed FA',
    salariesByYear: [
      {
        season: '2025-26',
        salary: 4_500_000,
        capHit: 4_500_000,
        guaranteed: true,
      },
    ],
    totalValue: 4_500_000,
  },
};

const TPMLE_SIGNING_PAYLOAD: ArchitectMutationPayload = {
  teamCode: 'LAL',
  playerId: 'player_1',
  signedUsing: 'Taxpayer MLE',
  contract: {
    contractType: 'Signed FA',
    salariesByYear: [
      {
        season: '2025-26',
        salary: 5_000_000,
        capHit: 5_000_000,
        guaranteed: true,
      },
    ],
    totalValue: 5_000_000,
  },
};

describe('Cap Sheet closeout blocker remediation 2: hard-cap ownership', () => {
  it('blocks exception-backed validation when the canonical exception owner is disabled', () => {
    const validationResult = validateSigning({
      team: DISABLED_MLE_TEAM_FIXTURE,
      player: PLAYER_FIXTURE,
      contract: SIGNING_PAYLOAD.contract,
      signedUsing: 'Full MLE',
      year: 2026,
    });

    expect(validationResult.valid).toBe(false);
    expect(
      validationResult.violations.some((violation) =>
        String(violation.message).includes('canonical MLE owner is disabled')
      )
    ).toBe(true);
  });

  it('blocks alias-only top-level Full-MLE ownership in both validation and mutation', () => {
    const validationResult = validateSigning({
      team: LEGACY_ALIAS_ONLY_MLE_TEAM_FIXTURE,
      player: PLAYER_FIXTURE,
      contract: SIGNING_PAYLOAD.contract,
      signedUsing: 'Full MLE',
      year: 2026,
    });

    expect(validationResult.valid).toBe(false);
    expect(
      validationResult.violations.some((violation) =>
        String(violation.message).includes('no canonical MLE owner exists')
      )
    ).toBe(true);

    const beforeTeam = synchronizeTeamTotalsSnapshot(
      LEGACY_ALIAS_ONLY_MLE_TEAM_FIXTURE,
      2026
    );
    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: SIGNING_PAYLOAD,
      currentState: {
        team: beforeTeam,
        player: PLAYER_FIXTURE,
        teamCode: 'LAL',
      },
      seasonId: '2025-26',
      timestamp: Date.parse('2026-03-29T11:59:00.000Z'),
      worldId: 'world_closeout',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('canonical MLE owner is missing');
  });

  it('blocks TPMLE signing when only the full MLE owner exists', () => {
    const beforeTeam = synchronizeTeamTotalsSnapshot(TEAM_FIXTURE, 2026);
    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: TPMLE_SIGNING_PAYLOAD,
      currentState: {
        team: beforeTeam,
        player: PLAYER_FIXTURE,
        teamCode: 'LAL',
      },
      seasonId: '2025-26',
      timestamp: Date.parse('2026-03-29T12:01:00.000Z'),
      worldId: 'world_closeout',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('canonical TPMLE owner is missing');
  });

  it('keeps Full-MLE hard-cap truth aligned across compute, totals, validation, and display', () => {
    const beforeTeam = synchronizeTeamTotalsSnapshot(TEAM_FIXTURE, 2026);
    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: SIGNING_PAYLOAD,
      currentState: {
        team: beforeTeam,
        player: PLAYER_FIXTURE,
        teamCode: 'LAL',
      },
      seasonId: '2025-26',
      timestamp: Date.parse('2026-03-29T12:00:00.000Z'),
      worldId: 'world_closeout',
    });

    expect(result.success).toBe(true);
    const updatedTeam = result.teamUpdates?.[0]?.team;
    expect(updatedTeam).toBeTruthy();
    if (!updatedTeam) {
      throw new Error('Expected updated team after signFreeAgent mutation');
    }

    expect(updatedTeam).toEqual(
      expect.objectContaining({
        hardCapped: 1,
        hardCapLevel: 'firstApron',
        hardCapReason: 'Triggered by Non-Taxpayer MLE',
        hardCapTriggeredBy: 'fullMLE',
      })
    );
    expect(updatedTeam?.totals).toEqual(
      expect.objectContaining({
        isHardCapped: true,
        hardCapLevel: 'firstApron',
        hardCapDetail: 'Triggered by Non-Taxpayer MLE',
        hardCapReason: 'Triggered by Non-Taxpayer MLE',
      })
    );
    expect(updatedTeam.exceptions?.mle).toEqual(
      expect.objectContaining({
        usedAmount: 12_000_000,
        remainingAmount: 900_000,
      })
    );
    expect((updatedTeam as Record<string, unknown>).mle).toBeUndefined();

    expect(buildTotalsByTeam({ LAL: updatedTeam }, 2026).LAL).toEqual(
      expect.objectContaining({
        isHardCapped: true,
        hardCapLevel: 'firstApron',
        hardCapReason: 'Triggered by Non-Taxpayer MLE',
      })
    );

    const displayStatus = getHardCapStatus(updatedTeam, {
      capSettings: CAP_SETTINGS,
    });
    expect(displayStatus).toEqual(
      expect.objectContaining({
        isHardCapped: true,
        hardCapType: 'FIRST_APRON',
        reason: 'Triggered by Non-Taxpayer MLE',
      })
    );

    const validation = validatePostStateCapLegality({
      operationId: 'op_full_mle_hard_cap',
      mutationType: 'signFreeAgent',
      worldId: 'world_closeout',
      year: 2026,
      afterTeamsByCode: {
        LAL: updatedTeam,
      },
      beforeTotalsByTeam: {
        LAL: beforeTeam?.totals || {},
      },
      afterTotalsByTeam: {
        LAL: updatedTeam?.totals || {},
      },
      rulesContext: {
        capSettings: CAP_SETTINGS,
      },
    });

    expect(validation.valid).toBe(true);
    expect(
      validation.violations.some(
        (violation) => violation.code === 'HARD_CAP_EXCEEDED'
      )
    ).toBe(false);
  });

  it('keeps BAE hard-cap truth aligned across compute, totals, validation, and display', () => {
    const beforeTeam = synchronizeTeamTotalsSnapshot(BAE_TEAM_FIXTURE, 2026);
    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: BAE_SIGNING_PAYLOAD,
      currentState: {
        team: beforeTeam,
        player: PLAYER_FIXTURE,
        teamCode: 'LAL',
      },
      seasonId: '2025-26',
      timestamp: Date.parse('2026-03-29T12:02:00.000Z'),
      worldId: 'world_closeout',
    });

    expect(result.success).toBe(true);
    const updatedTeam = result.teamUpdates?.[0]?.team;
    expect(updatedTeam).toBeTruthy();
    if (!updatedTeam) {
      throw new Error('Expected updated team after BAE signFreeAgent mutation');
    }

    expect(updatedTeam).toEqual(
      expect.objectContaining({
        hardCapped: 1,
        hardCapLevel: 'firstApron',
        hardCapReason: 'Triggered by Bi-Annual Exception',
        hardCapTriggeredBy: 'bae',
      })
    );
    expect(updatedTeam?.totals).toEqual(
      expect.objectContaining({
        isHardCapped: true,
        hardCapLevel: 'firstApron',
        hardCapDetail: 'Triggered by Bi-Annual Exception',
        hardCapReason: 'Triggered by Bi-Annual Exception',
      })
    );
    expect(updatedTeam.exceptions?.bae).toEqual(
      expect.objectContaining({
        usedAmount: 4_500_000,
        remainingAmount: 635_000,
      })
    );

    expect(buildTotalsByTeam({ LAL: updatedTeam }, 2026).LAL).toEqual(
      expect.objectContaining({
        isHardCapped: true,
        hardCapLevel: 'firstApron',
        hardCapReason: 'Triggered by Bi-Annual Exception',
      })
    );

    const displayStatus = getHardCapStatus(updatedTeam, {
      capSettings: CAP_SETTINGS,
    });
    expect(displayStatus).toEqual(
      expect.objectContaining({
        isHardCapped: true,
        hardCapType: 'FIRST_APRON',
        reason: 'Triggered by Bi-Annual Exception',
        source: 'team.hardCapped',
      })
    );

    const validation = validatePostStateCapLegality({
      operationId: 'op_bae_hard_cap',
      mutationType: 'signFreeAgent',
      worldId: 'world_closeout',
      year: 2026,
      afterTeamsByCode: {
        LAL: updatedTeam,
      },
      beforeTotalsByTeam: {
        LAL: beforeTeam?.totals || {},
      },
      afterTotalsByTeam: {
        LAL: updatedTeam?.totals || {},
      },
      rulesContext: {
        capSettings: CAP_SETTINGS,
      },
    });

    expect(validation.valid).toBe(true);
    expect(
      validation.violations.some(
        (violation) => violation.code === 'HARD_CAP_EXCEEDED'
      )
    ).toBe(false);
  });

  it('preserves hard-cap overlay fields when a non-trade mutation recalculates team totals', () => {
    const root = makeRightsEstablishedEvent();
    const rightsLedger = makeRightsLedger({
      ...root,
      worldId: 'world_closeout',
      teamId: 'LAL',
      playerId: 'player_1',
      serviceSeasons: root.serviceSeasons.map((record) => ({
        ...record,
        creditedTeamId:
          record.creditedTeamId === null ? null : 'LAL',
        rightsTeamId: 'LAL',
      })),
    });
    const beforeTeam = synchronizeTeamTotalsSnapshot(
      {
        ...TEAM_FIXTURE,
        rightsLedger,
        hardCapLevel: 'firstApron',
        hardCapReason: 'Triggered by Non-Taxpayer MLE',
        hardCapTriggeredBy: 'fullMLE',
      },
      2026
    );
    const result = computeWorldMutation({
      mutationType: 'renounceRights',
      payload: {
        teamCode: 'LAL',
        playerId: 'player_1',
      },
      currentState: {
        team: beforeTeam,
        player: PLAYER_FIXTURE,
        teamCode: 'LAL',
      },
      seasonId: '2026-27',
      timestamp: Date.parse('2026-07-15T12:05:00.000Z'),
      asOfDate: '2026-07-15',
      worldId: 'world_closeout',
      operationId: 'hard-cap-renounce',
      authoringIdentity: 'guardrail-author',
      recordedAt: '2026-07-15T12:05:00.000Z',
    });

    expect(result.success).toBe(true);

    const updatedTeam = result.teamUpdates?.[0]?.team;
    expect(updatedTeam?.capHolds).toHaveLength(0);
    expect(updatedTeam?.totals).toEqual(
      expect.objectContaining({
        isHardCapped: true,
        hardCapLevel: 'firstApron',
        hardCapReason: 'Triggered by Non-Taxpayer MLE',
      })
    );
  });

  it('validation reads the shared hard-cap owner instead of a totals-only local resolver', () => {
    const validationResult = validateExceptionEligibility({
      team: {
        ...TEAM_FIXTURE,
        hardCapLevel: 'firstApron',
        hardCapReason: 'Triggered by Non-Taxpayer MLE',
        hardCapTriggeredBy: 'fullMLE',
        totals: {},
      },
      signedUsing: 'BAE',
      year: 2026,
    });

    expect(validationResult.blocked).toBe(true);
    expect(validationResult.reason).toBe(
      'BAE unavailable when hard-capped at first apron'
    );
  });

  it('validation uses canonical cap-sheet totals when apron checks depend on non-player allocations', () => {
    const playerSalaries = Array.from({ length: 13 }, (_, index) =>
      createStandardPlayer(`apron_player_${index + 1}`, 15_200_000)
    );

    const validationResult = validateExceptionEligibility({
      team: {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        roster: playerSalaries.map((player) => player.id),
        players: playerSalaries,
        capHolds: [
          {
            playerId: 'hold_1',
            playerName: 'Second Apron Hold',
            amount: 12_000_000,
            type: 'FA Cap Hold',
            season: '2025-26',
            isSigned: false,
            active: true,
          },
        ],
        deadCap: [],
        exceptions: {},
        totals: {},
      },
      signedUsing: 'TPMLE',
      year: 2026,
    });

    expect(validationResult.blocked).toBe(true);
    expect(validationResult.reason).toBe(
      'Second apron teams cannot use exceptions'
    );
  });

  it('preserves Full-MLE hard-cap owner metadata through hydration for reload/display parity', async () => {
    const hydratedTeam = await hydrateBaseTeam('LAL', {
      teamName: 'Los Angeles Lakers',
      season: '2025-26',
      abbreviation: 'LAL',
      roster: [],
      capHolds: [],
      draftPicks: [],
      draftPicksInventory: [],
      draftPicksObligations: [],
      draftPicksContested: [],
      entitlementIds: [],
      offerSheets: [],
      incomingOfferSheets: [],
      deadCap: [],
      exceptions: {
        mle: {
          type: 'non-taxpayer',
          totalAmount: 12_900_000,
          usedAmount: 12_000_000,
          remainingAmount: 900_000,
        },
      },
      hardCapLevel: 'firstApron',
      hardCapReason: 'Triggered by Non-Taxpayer MLE',
      hardCapTriggeredBy: 'fullMLE',
      totals: {
        isHardCapped: true,
        hardCapLevel: 'firstApron',
        hardCapDetail: 'Triggered by Non-Taxpayer MLE',
      },
    });

    expect(hydratedTeam).toEqual(
      expect.objectContaining({
        hardCapLevel: 'firstApron',
        hardCapReason: 'Triggered by Non-Taxpayer MLE',
        hardCapTriggeredBy: 'fullMLE',
      })
    );

    const displayStatus = getHardCapStatus(hydratedTeam, {
      capSettings: CAP_SETTINGS,
    });
    expect(displayStatus.reason).toBe('Triggered by Non-Taxpayer MLE');
    expect(displayStatus.isHardCapped).toBe(true);
  });

  it('preserves BAE hard-cap owner metadata through hydration for reload/display parity', async () => {
    const hydratedTeam = await hydrateBaseTeam('LAL', {
      teamName: 'Los Angeles Lakers',
      season: '2025-26',
      abbreviation: 'LAL',
      roster: [],
      capHolds: [],
      draftPicks: [],
      draftPicksInventory: [],
      draftPicksObligations: [],
      draftPicksContested: [],
      entitlementIds: [],
      offerSheets: [],
      incomingOfferSheets: [],
      deadCap: [],
      exceptions: {
        bae: {
          totalAmount: 5_135_000,
          usedAmount: 4_500_000,
          remainingAmount: 635_000,
        },
      },
      hardCapLevel: 'firstApron',
      hardCapReason: 'Triggered by Bi-Annual Exception',
      hardCapTriggeredBy: 'bae',
      totals: {
        isHardCapped: true,
        hardCapLevel: 'firstApron',
        hardCapDetail: 'Triggered by Bi-Annual Exception',
      },
    });

    expect(hydratedTeam).toEqual(
      expect.objectContaining({
        hardCapLevel: 'firstApron',
        hardCapReason: 'Triggered by Bi-Annual Exception',
        hardCapTriggeredBy: 'bae',
      })
    );

    const displayStatus = getHardCapStatus(hydratedTeam, {
      capSettings: CAP_SETTINGS,
    });
    expect(displayStatus.reason).toBe('Triggered by Bi-Annual Exception');
    expect(displayStatus.source).toBe('team.hardCapped === true');
    expect(displayStatus.isHardCapped).toBe(true);
  });
});
