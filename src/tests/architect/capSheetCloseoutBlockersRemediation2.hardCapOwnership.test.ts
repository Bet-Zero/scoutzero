/**
 * FILE: src/tests/architect/capSheetCloseoutBlockersRemediation2.hardCapOwnership.test.ts
 * PURPOSE: Focused closeout blocker proof for Full-MLE hard-cap ownership coherence.
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import {
  computeWorldMutation,
  type ArchitectMutationPayload,
} from '@/features/architect/utils/mutationPipeline';
import { synchronizeTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { validatePostStateCapLegality } from '@/features/architect/utils/capLegality/postStateCapValidator';
import { getHardCapStatus } from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import { hydrateBaseTeam } from '@/features/architect/utils/firebaseTeamPlanHelpers';

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

const PLAYER_FIXTURE = {
  id: 'player_1',
  player_id: 'player_1',
  name: 'Test Player',
  displayName: 'Test Player',
  contract: {
    salariesByYear: [],
  },
};

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

describe('Cap Sheet closeout blocker remediation 2: hard-cap ownership', () => {
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
        LAL: beforeTeam.totals || {},
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
      validation.violations.some((violation) => violation.code === 'HARD_CAP_EXCEEDED')
    ).toBe(false);
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
});
