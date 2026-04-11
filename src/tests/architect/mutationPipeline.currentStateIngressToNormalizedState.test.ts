/**
 * FILE: src/tests/architect/mutationPipeline.currentStateIngressToNormalizedState.test.ts
 * PURPOSE: Behavioral coverage for MutationCurrentStateIngress -> MutationCurrentState normalization.
 * HISTORY:
 *  - 2026-04-11: Added for MUTATION_PIPELINE_CURRENT_STATE_INGRESS_TO_NORMALIZED_STATE_PASS.
 */

import { describe, expect, it } from 'vitest';
import {
  computeWorldMutation,
  type ArchitectMutationContract,
  type ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline';

type ComputeArgs = Parameters<typeof computeWorldMutation>[0];
type CurrentStateInput = ComputeArgs['currentState'];

const FIXED_TIMESTAMP = Date.parse('2026-04-11T16:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-04-11T16:00:00.000Z';
const SEASON_ID = '2025-26';

function makeContract(
  salary: number,
  overrides: Record<string, unknown> = {}
): ArchitectMutationContract & Record<string, unknown> {
  return {
    contractType: 'Standard',
    salariesByYear: [
      {
        season: SEASON_ID,
        salary,
        capHit: salary,
        guaranteed: true,
        guaranteedAmount: salary,
      },
    ],
    birdRights: { status: 'Full', yearsOfService: 5 },
    freeAgency: { type: 'UFA', year: 2027 },
    totalValue: salary,
    years: 1,
    contractYears: 1,
    ...overrides,
  } as ArchitectMutationContract & Record<string, unknown>;
}

function makePlayer(
  id: string,
  name: string,
  salary: number,
  teamCode: string | null,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    player_id: id,
    id,
    playerId: id,
    name,
    displayName: name,
    playerName: name,
    teamCode,
    teamName: teamCode ? `Team ${teamCode}` : null,
    salary,
    currentSalary: salary,
    contract: makeContract(salary, { signingTeam: teamCode }),
    bio: {
      displayName: name,
      playerId: id,
      position: 'SF',
      yearsExperience: 4,
    },
    ...overrides,
  };
}

function makeTeam(
  teamCode: string,
  players: Array<Record<string, unknown>>,
  overrides: Partial<ArchitectMutationTeamRecord> & Record<string, unknown> = {}
): ArchitectMutationTeamRecord & Record<string, unknown> {
  const totalSalary = players.reduce((sum, player) => {
    const contract = player.contract as
      | { salariesByYear?: Array<{ capHit?: number | string | null }> }
      | undefined;

    return (
      sum +
      Number(
        contract?.salariesByYear?.[0]?.capHit ??
          player.currentSalary ??
          player.salary ??
          0
      )
    );
  }, 0);

  return {
    id: teamCode.toLowerCase(),
    teamCode,
    teamName: `Team ${teamCode}`,
    teamTotalSalary: totalSalary,
    roster: players.map((player) => String(player.player_id || player.id)),
    players,
    twoWayPlayers: players.filter((player) => player.isTwoWay === true),
    capHolds: [],
    deadCap: [],
    tradeExceptions: [],
    exceptionHistory: [],
    offerSheets: [],
    incomingOfferSheets: [],
    draftPicks: [],
    entitlementIds: [],
    cashLedger: { totalOut: 0 },
    exceptions: { mle: null, bae: null, tpe: [] },
    totals: {
      totalSalary,
      capHit: totalSalary,
      totalCapAllocations: totalSalary,
      rosterCount: players.length,
      isHardCapped: false,
    },
    source: {
      provider: 'test-suite',
      type: 'test',
      generatedAt: FIXED_TIMESTAMP_ISO,
    },
    ...overrides,
  } as ArchitectMutationTeamRecord & Record<string, unknown>;
}

describe('mutationPipeline current-state ingress to normalized state', () => {
  it('supports signing from mixed raw ingress while preserving isolated exception state', () => {
    const preservedHistory = [
      {
        historyKey: 'hist_existing_tpe',
        type: 'TPE_CREATED',
        teamCode: 'LAL',
        tpeId: 'tpe_keep',
        timestamp: FIXED_TIMESTAMP_ISO,
        legacyProducerPayload: { keep: true },
      },
    ];
    const team = makeTeam('LAL', [], {
      legacyTeamIngressBlob: { shouldDrop: true },
      tradeExceptions: [
        {
          id: 'legacy_tpe_keep',
          amount: 2_000_000,
          totalAmount: 2_000_000,
          remainingAmount: 2_000_000,
          createdSeason: 2026,
          expiresOn: '2026-07-01',
        },
      ],
      exceptionHistory: preservedHistory,
      draftPicks: [
        {
          year: 2029,
          round: 1,
          pick: null,
          owner: 'LAL',
          metadata: { keep: true },
        },
      ],
      entitlementIds: ['ent_lal_keep'],
      cashLedger: { totalOut: 500_000 },
      exceptions: {
        roomMLE: {
          enabled: true,
          totalAmount: 8_000_000,
          remainingAmount: 8_000_000,
          usedAmount: 0,
        },
        tpe: [{ id: 'canonical_tpe_keep', amount: 750_000 }],
        scoutingOnlyExceptionLedger: { keep: true },
      },
    });
    const freeAgent = makePlayer('fa_norm_1', 'Ingress Free Agent', 0, null, {
      displayName: undefined,
      bio: {
        displayName: 'Ingress Free Agent Bio',
        playerId: 'fa_norm_1',
        position: 'SG',
        yearsExperience: '6',
        rawBioBlob: { shouldDrop: true },
      },
      source: {
        provider: 'legacy-import',
        playerPageUrl: '/players/fa_norm_1',
        generatedAt: FIXED_TIMESTAMP_ISO,
        rawProviderBlob: { shouldDrop: true },
      },
      legacyPlayerIngressBlob: { shouldDrop: true },
    });

    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'LAL',
        playerId: 'fa_norm_1',
        contract: makeContract(3_000_000, {
          signingTeam: null,
          signingDate: null,
          totalValue: 3_000_000,
        }),
        signedUsing: 'Room Exception',
      },
      currentState: {
        team: team as CurrentStateInput['team'],
        player: freeAgent as CurrentStateInput['player'],
        teamCode: 'LAL',
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedTeam = result.teamUpdates?.[0]?.team;
    expect(updatedTeam?.roster).toContain('fa_norm_1');
    expect(updatedTeam?.exceptions).toMatchObject({
      room: {
        usedAmount: 3_000_000,
        remainingAmount: 5_000_000,
      },
      tpe: [{ id: 'canonical_tpe_keep', amount: 750_000 }],
      scoutingOnlyExceptionLedger: { keep: true },
    });
    expect(updatedTeam?.exceptions).not.toHaveProperty('roomMLE');
    expect(updatedTeam?.tradeExceptions).toEqual([
      expect.objectContaining({ id: 'legacy_tpe_keep', amount: 2_000_000 }),
    ]);
    expect(updatedTeam?.exceptionHistory).toEqual(preservedHistory);
    expect(updatedTeam?.draftPicks).toEqual([
      expect.objectContaining({ year: 2029, round: 1, owner: 'LAL' }),
    ]);
    expect(updatedTeam?.entitlementIds).toEqual(['ent_lal_keep']);
    expect(updatedTeam?.cashLedger).toMatchObject({ totalOut: 500_000 });
    expect(updatedTeam).not.toHaveProperty('legacyTeamIngressBlob');

    const updatedPlayer = result.playerUpdates?.[0]?.player;
    expect(updatedPlayer?.displayName).toBe('Ingress Free Agent');
    expect(updatedPlayer?.teamCode).toBe('LAL');
    expect(updatedPlayer?.contract?.signingTeam).toBe('LAL');
    expect(updatedPlayer?.source).toEqual({
      provider: 'legacy-import',
      playerPageUrl: '/players/fa_norm_1',
      generatedAt: FIXED_TIMESTAMP_ISO,
    });
    expect(updatedPlayer?.bio).not.toHaveProperty('rawBioBlob');
    expect(updatedPlayer).not.toHaveProperty('legacyPlayerIngressBlob');
  });

  it('supports player-array contract compute after player normalization drops row baggage', () => {
    const optionPlayer = makePlayer('option_norm_1', 'Option Normalized', 9_500_000, 'LAL', {
      contract: makeContract(9_500_000, {
        salariesByYear: [
          {
            season: '2025-26',
            salary: 9_500_000,
            capHit: 9_500_000,
            guaranteed: true,
            guaranteedAmount: 9_500_000,
          },
          {
            season: '2026-27',
            salary: '10500000',
            capHit: '10500000',
            guaranteed: true,
            guaranteedAmount: '10500000',
            option: 'Player',
            optionUsed: 'accepted',
            legacyRowIngressBlob: { shouldDrop: true },
          },
        ],
      }),
      legacyPlayerIngressBlob: { shouldDrop: true },
    });
    const team = makeTeam('LAL', [optionPlayer]);

    const result = computeWorldMutation({
      mutationType: 'optionDecision',
      payload: {
        teamCode: 'LAL',
        playerId: 'option_norm_1',
        accepted: true,
        targetYear: 2027,
      },
      currentState: {
        team: team as CurrentStateInput['team'],
        player: optionPlayer as CurrentStateInput['player'],
        teamCode: 'LAL',
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedPlayer = result.playerUpdates?.[0]?.player;
    const optionRow = updatedPlayer?.contract?.salariesByYear?.[1];
    expect(optionRow).toMatchObject({
      season: '2026-27',
      salary: 10_500_000,
      capHit: 10_500_000,
      option: 'Player',
      optionUsed: true,
    });
    expect(optionRow).not.toHaveProperty('legacyRowIngressBlob');
    expect(updatedPlayer).not.toHaveProperty('legacyPlayerIngressBlob');
  });

  it('keeps manual exception edits scoped while preserving exception history objects', () => {
    const historyEntry = {
      historyKey: 'hist_manual_keep',
      type: 'TPE_CONSUMED',
      teamCode: 'LAL',
      tpeId: 'tpe_manual_keep',
      timestamp: FIXED_TIMESTAMP_ISO,
      legacyMeta: { keep: true },
    };
    const team = makeTeam('LAL', [], {
      exceptionHistory: [historyEntry],
      exceptions: {
        room: {
          enabled: true,
          totalAmount: 5_000_000,
          remainingAmount: 5_000_000,
          usedAmount: 0,
        },
        tpe: [{ id: 'tpe_manual_keep', amount: 1_000_000 }],
        customNonEditableBucket: { keep: true },
      },
      legacyTeamIngressBlob: { shouldDrop: true },
    });

    const result = computeWorldMutation({
      mutationType: 'setExceptions',
      payload: {
        teamCode: 'LAL',
        exceptions: {
          room: {
            enabled: true,
            totalAmount: 6_000_000,
            remainingAmount: 6_000_000,
            usedAmount: 0,
          },
        },
        exceptionChanges: ['Room Exception updated'],
      },
      currentState: {
        team: team as CurrentStateInput['team'],
        teamCode: 'LAL',
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedTeam = result.teamUpdates?.[0]?.team;
    expect(updatedTeam?.exceptions).toMatchObject({
      room: {
        totalAmount: 6_000_000,
        remainingAmount: 6_000_000,
        usedAmount: 0,
      },
      tpe: [{ id: 'tpe_manual_keep', amount: 1_000_000 }],
      customNonEditableBucket: { keep: true },
    });
    expect(updatedTeam?.exceptionHistory).toEqual([historyEntry]);
    expect(updatedTeam).not.toHaveProperty('legacyTeamIngressBlob');
  });
});
