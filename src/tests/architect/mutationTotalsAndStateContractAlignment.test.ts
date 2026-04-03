/**
 * @vitest-environment jsdom
 *
 * FILE: src/tests/architect/mutationTotalsAndStateContractAlignment.test.ts
 * PURPOSE: Focused runtime proof for the mutation totals and dashboard state-contract alignment pass.
 * OWNERSHIP: Feature: architect/type-hardening
 */

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useArchitectState } from '@/features/architect/GMDashboard/hooks/useArchitectState';
import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';

const stateMocks = vi.hoisted(() => ({
  loadWorldTeamData: vi.fn(),
  getWorldMetadata: vi.fn(),
  updateWorldMetadata: vi.fn(),
  getLeague: vi.fn(),
  useArchitectPlayerData: vi.fn(),
}));

vi.mock('@/features/architect/utils/worldTeamData', () => ({
  loadWorldTeamData: stateMocks.loadWorldTeamData,
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  getWorldMetadata: stateMocks.getWorldMetadata,
  updateWorldMetadata: stateMocks.updateWorldMetadata,
}));

vi.mock('@/features/architect/utils/teamLoader', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/architect/utils/teamLoader')
  >('@/features/architect/utils/teamLoader');
  return {
    ...actual,
    getLeague: stateMocks.getLeague,
  };
});

vi.mock('@/features/architect/hooks/useArchitectPlayerData', () => ({
  default: () => stateMocks.useArchitectPlayerData(),
}));

const TEST_TIMESTAMP = Date.parse('2026-03-24T12:00:00.000Z');
const SEASON_ID = '2025-26';
const SEASON = '2025-26';
const CURRENT_YEAR = 2026;

function makeMinimalTeam(teamCode: string) {
  return {
    id: teamCode.toLowerCase(),
    teamCode,
    teamName: `Team ${teamCode}`,
    roster: [],
    players: [],
    capHolds: [],
    deadCap: [],
    exceptions: { tpe: [] },
    tradeExceptions: [],
    entitlementIds: [],
    totals: {
      totalSalary: 0,
      capHit: 0,
      isHardCapped: false,
    },
  };
}

function makeSatContract(firstYearSalary: number) {
  return {
    contractType: 'Sign & Trade',
    contractYears: 3,
    firstYearGuaranteed: true,
    salariesByYear: [
      {
        season: SEASON,
        salary: firstYearSalary,
        capHit: firstYearSalary,
        guaranteed: true,
      },
      {
        season: '2026-27',
        salary: Math.round(firstYearSalary * 1.05),
        capHit: Math.round(firstYearSalary * 1.05),
        guaranteed: true,
      },
      {
        season: '2027-28',
        salary: Math.round(firstYearSalary * 1.1),
        capHit: Math.round(firstYearSalary * 1.1),
        guaranteed: true,
      },
    ],
  };
}

function makeTradePlayer(
  id: string,
  salary: number,
  teamCode: string,
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    player_id: id,
    playerId: id,
    name: id,
    displayName: id,
    teamCode,
    freeAgentYear: CURRENT_YEAR,
    contract: {
      contractType: 'Standard',
      salariesByYear: [
        {
          season: SEASON,
          salary,
          capHit: salary,
          guaranteed: true,
        },
      ],
      birdRights: { status: 'Full Bird' },
      freeAgency: { type: 'UFA', year: CURRENT_YEAR },
    },
    ...extra,
  };
}

function makeTradeTeam(
  teamCode: string,
  players: Array<ReturnType<typeof makeTradePlayer>>,
  capHolds: Array<Record<string, unknown>> = []
) {
  const totalSalary = players.reduce(
    (sum, player) =>
      sum + Number(player.contract?.salariesByYear?.[0]?.capHit || 0),
    0
  );

  return {
    id: teamCode.toLowerCase(),
    teamCode,
    teamName: `Team ${teamCode}`,
    roster: players.map((player) => String(player.player_id || player.id)),
    players,
    capHolds,
    deadCap: [],
    draftPicks: [],
    tradeExceptions: [],
    exceptions: {},
    totals: {
      totalSalary,
      capHit: totalSalary,
      isHardCapped: false,
    },
    source: { type: 'test' },
  };
}

describe('mutation totals and state contract alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stateMocks.loadWorldTeamData.mockResolvedValue(null);
    stateMocks.getWorldMetadata.mockResolvedValue({ asOfDate: '2026-07-01' });
    stateMocks.getLeague.mockResolvedValue([]);
    stateMocks.useArchitectPlayerData.mockReturnValue({
      players: [],
      loading: false,
      error: null,
    });
  });

  it('returns computed totals snapshot fields on the renounceRights mutation path', () => {
    const result = computeWorldMutation({
      mutationType: 'renounceRights',
      payload: { teamCode: 'LAL', playerId: 'player_cap_1' },
      currentState: {
        team: makeMinimalTeam('LAL'),
        player: {
          player_id: 'player_cap_1',
          displayName: 'Cap Player',
        },
      },
      seasonId: SEASON_ID,
      timestamp: TEST_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedTeam = result.teamUpdates?.[0]?.team;
    expect(updatedTeam?.totals).toMatchObject({
      yearKey: 2026,
    });
    expect(typeof updatedTeam?.totals?.totalCapAllocations).toBe('number');
    expect(typeof updatedTeam?.totals?.salaryCap).toBe('number');
  });

  it('loads dashboard state from real loaded totals data and canonical exception ownership', async () => {
    stateMocks.loadWorldTeamData.mockResolvedValue({
      id: 'lal',
      teamCode: 'LAL',
      teamName: 'Los Angeles Lakers',
      season: '2025-26',
      abbreviation: 'LAL',
      players: [],
      roster: [],
      activeContracts: [],
      capHolds: [],
      draftPicks: [],
      draftPicksInventory: [],
      draftPicksObligations: [],
      draftPicksContested: [],
      draftAssets: null,
      entitlementIds: [],
      offerSheets: [],
      incomingOfferSheets: [],
      exceptions: {
        tpmle: {
          enabled: true,
          totalAmount: 5_685_000,
          usedAmount: 1_000_000,
          remainingAmount: 4_685_000,
        },
      },
      hardCapLevel: 'firstApron',
      hardCapped: true,
      deadCap: [],
      baseline: {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
      },
      totals: {
        totalSalary: 170_000_000,
        capHit: 170_000_000,
        isHardCapped: true,
        hardCapLevel: 'firstApron',
      },
    });

    const { result } = renderHook(() =>
      useArchitectState({
        teamId: 'LAL',
        userId: 'user_1',
        authLoading: false,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.teamCapSheet?.totals?.totalSalary).toBe(170_000_000);
    expect(result.current.teamCapSheet?.totals?.hardCapLevel).toBe(
      'firstApron'
    );
    expect(result.current.teamCapSheet?.hardCapped).toBe(true);
    expect(result.current.teamCapSheet?.exceptions?.tpmle?.remainingAmount).toBe(
      4_685_000
    );
    expect(
      result.current.teamCapSheet
        ? 'tpMle' in result.current.teamCapSheet
        : false
    ).toBe(false);
  });

  it('preserves the minimal hard-cap overlay on computed totals for sign-and-trade trade results', () => {
    const satPlayer = makeTradePlayer('sat_player', 0, 'LAL', {
      signAndTrade: true,
      signAndTradeContract: makeSatContract(15_000_000),
      tradeTo: 'BOS',
    });
    const counterPlayer = makeTradePlayer('counter', 15_000_000, 'BOS', {
      tradeTo: 'LAL',
    });

    const sourceTeam = makeTradeTeam('LAL', [satPlayer], [
      {
        playerId: 'sat_player',
        playerName: 'sat_player',
        season: SEASON,
        amount: 12_000_000,
        active: true,
        isSigned: false,
      },
    ]);
    const destinationTeam = makeTradeTeam('BOS', [counterPlayer]);

    const result = computeWorldMutation({
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'LAL',
            sends: [satPlayer],
            entitlementsOut: [],
          },
          {
            teamCode: 'BOS',
            sends: [counterPlayer],
            entitlementsOut: [],
          },
        ],
        tradeCtx: { source: 'tradeMachine', offseason: true },
      },
      currentState: {
        teams: [
          { teamCode: 'LAL', team: sourceTeam },
          { teamCode: 'BOS', team: destinationTeam },
        ],
      },
      seasonId: SEASON_ID,
      timestamp: TEST_TIMESTAMP,
      worldId: 'world_test',
    });

    expect(result.success).toBe(true);

    const destinationUpdate = result.teamUpdates.find(
      (entry) => entry.teamCode === 'BOS'
    );

    expect(destinationUpdate?.team.totals).toMatchObject({
      isHardCapped: true,
      hardCapLevel: 'firstApron',
      hardCapDetail: 'Triggered by receiving sign-and-trade player',
    });
    expect(typeof destinationUpdate?.team.totals?.totalCapAllocations).toBe(
      'number'
    );
  });
});
