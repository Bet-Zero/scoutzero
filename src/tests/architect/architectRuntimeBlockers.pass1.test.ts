/**
 * @vitest-environment jsdom
 *
 * FILE: src/tests/architect/architectRuntimeBlockers.pass1.test.ts
 * PURPOSE: Narrow runtime proof for ARCHITECT_RUNTIME_BLOCKERS_PASS1.
 * Covers:
 *  - executeTrade compute path in mutationPipeline.ts
 *  - world-mode handleSign path in useArchitectActions.ts
 *  - hard-cap reset + TPE expiry transition path in resolveOffseasonTransition.ts
 * OWNERSHIP: Feature: architect/runtime-blockers
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useArchitectActions } from '@/features/architect/GMDashboard/hooks/useArchitectActions';
import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';
import { resolveOffseasonTransition } from '@/features/architect/utils/offseason';
import type {
  OffseasonTransitionParams,
} from '@/features/architect/utils/offseason/resolveOffseasonTransition';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';

const FIXED_TIMESTAMP = new Date('2026-03-22T12:00:00.000Z').getTime();

const mutationMocks = vi.hoisted(() => ({
  applyWorldMutation: vi.fn(),
}));

const worldTeamDataMocks = vi.hoisted(() => ({
  loadWorldTeamData: vi.fn(),
  resolveTeamCode: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/features/architect/utils/mutationPipeline', async () => {
  const actual =
    await vi.importActual<
      typeof import('@/features/architect/utils/mutationPipeline')
    >('@/features/architect/utils/mutationPipeline');

  return {
    ...actual,
    applyWorldMutation: mutationMocks.applyWorldMutation,
  };
});

vi.mock('@/features/architect/utils/worldTeamData', () => ({
  loadWorldTeamData: worldTeamDataMocks.loadWorldTeamData,
  resolveTeamCode: worldTeamDataMocks.resolveTeamCode,
}));

vi.mock('react-hot-toast', () => ({
  default: toastMocks,
}));

type SeasonRow = {
  season: string;
  salary: number;
  capHit: number;
  option?: string | null;
  optionUsed?: boolean | null;
};

const makeSeasonRow = (
  endYear: number,
  salary: number,
  option?: string | null
): SeasonRow => ({
  season: toSeasonCode(endYear),
  salary,
  capHit: salary,
  option: option ?? null,
  optionUsed: null,
});

const makeTradePlayer = (
  id: string,
  name: string,
  salary: number,
  teamCode: string
) => ({
  player_id: id,
  id,
  playerId: id,
  name,
  displayName: name,
  teamCode,
  salary,
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
    birdRights: { status: 'Full Bird' },
    freeAgency: { type: 'UFA', year: 2027 },
  },
});

const makeTradeTeam = (
  teamCode: string,
  totalSalary: number,
  players: Array<ReturnType<typeof makeTradePlayer>>
) => ({
  id: teamCode.toLowerCase(),
  teamCode,
  teamName: `Team ${teamCode}`,
  teamTotalSalary: totalSalary,
  players,
  roster: players.map((player) => player.player_id),
  tradeExceptions: [],
  exceptionHistory: [],
  capHolds: [],
  deadCap: [],
  exceptions: { mle: null, bae: null, tpe: [] },
  totals: {
    teamSalary: totalSalary,
    totalSalary,
    capHit: totalSalary,
    rosterCount: players.length,
    isHardCapped: false,
  },
  source: { type: 'test' },
});

const makeCapProjections = () => ({
  '2025-26': {
    salaryCap: 141_000_000,
    luxuryTax: 170_000_000,
    firstApron: 178_000_000,
    secondApron: 188_000_000,
    minSalary: 1_164_000,
    maxSalary: 52_750_000,
  },
});

const makeOffseasonPlayer = (
  id: string,
  name: string,
  rows: SeasonRow[]
) => ({
  player_id: id,
  id,
  playerId: id,
  name,
  displayName: name,
  contract: {
    salariesByYear: rows,
    yearsRemaining: rows.length,
    contractType: 'Standard',
    birdRights: { status: 'Full Bird' },
  },
});

const makeStandardRoster = (
  count: number,
  fromYear: number,
  toYear: number,
  startIndex = 0
) =>
  Array.from({ length: count }).map((_, index) =>
    makeOffseasonPlayer(
      `fill-${startIndex + index}`,
      `Filler ${startIndex + index}`,
      [makeSeasonRow(fromYear, 1_200_000), makeSeasonRow(toYear, 1_250_000)]
    )
  );

const makeOffseasonTeam = (
  players: Array<ReturnType<typeof makeOffseasonPlayer>>,
  overrides: Partial<OffseasonTransitionParams['teamCapSheet']> = {}
): OffseasonTransitionParams['teamCapSheet'] => ({
  teamCode: 'TST',
  teamName: 'Test Team',
  players,
  roster: players.map((player) => player.player_id),
  capHolds: [],
  exceptions: {},
  totals: {},
  ...overrides,
});

const playerFixture = {
  id: 'player_1',
  player_id: 'player_1',
  name: 'Test Player',
  displayName: 'Test Player',
  teamCode: 'LAL',
  contract: {
    salariesByYear: [],
  },
};

const contractFixture = {
  salariesByYear: [
    {
      season: '2025-26',
      salary: 12_000_000,
      capHit: 12_000_000,
      guaranteed: true,
    },
  ],
  totalValue: 12_000_000,
  signedUsing: 'Full MLE',
};

const baseTeamFixture = {
  teamCode: 'LAL',
  teamName: 'Los Angeles Lakers',
  roster: [],
  players: [],
  capHolds: [{ playerId: 'player_1', amount: 9_000_000 }],
  exceptions: {
    mle: {
      type: 'non-taxpayer',
      usedAmount: 0,
      remainingAmount: 12_900_000,
    },
  },
  totals: {
    isHardCapped: false,
  },
};

function renderActionsHarness({
  worldId,
  userId = 'user_1',
  initialTeam = baseTeamFixture,
}: {
  worldId: string | null;
  userId?: string | null;
  initialTeam?: unknown;
}) {
  const refreshWorldRosterIndex = vi.fn().mockResolvedValue(new Set<string>());
  const startSave = vi.fn();
  const finishSave = vi.fn();

  const modals = {
    openContractModal: vi.fn(),
    closeContractModal: vi.fn(),
  };

  const { result } = renderHook(() => {
    const [teamCapSheet, setTeamCapSheet] = useState<any>(initialTeam);
    const [selectedRulesYear, setSelectedRulesYear] = useState<number>(2026);
    const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
    const [freeAgents, setFreeAgents] = useState<any[]>([playerFixture]);
    const [offseasonRun, setOffseasonRun] = useState<boolean>(false);
    const [offseasonSummary, setOffseasonSummary] = useState(null);

    const actions = useArchitectActions({
      teamId: 'LAL',
      userId: userId ?? null,
      authLoading: false,
      state: {
        teamCapSheet,
        currentYear: 2026,
        setTeamCapSheet,
        setSelectedRulesYear,
        setSelectedPlayer,
        setFreeAgents,
        startSave,
        finishSave,
        setOffseasonRun,
        setOffseasonSummary,
        refreshWorldRosterIndex,
      },
      playersMap: {
        [playerFixture.id]: playerFixture,
        [playerFixture.player_id]: playerFixture,
        [playerFixture.name]: playerFixture,
      },
      modals,
      worldId,
      seasonId: '2025-26',
    });

    return {
      actions,
      teamCapSheet,
      freeAgents,
      selectedRulesYear,
      selectedPlayer,
      offseasonRun,
      offseasonSummary,
    };
  });

  return {
    result,
    refreshWorldRosterIndex,
    startSave,
    finishSave,
  };
}

describe('Architect runtime blockers pass 1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    worldTeamDataMocks.resolveTeamCode.mockImplementation((teamId: string) =>
      String(teamId || '').toUpperCase()
    );
    worldTeamDataMocks.loadWorldTeamData.mockResolvedValue(baseTeamFixture);
  });

  it('keeps executeTrade compute output structured around the hardened trade-path contracts', () => {
    const playerA = makeTradePlayer('player_a', 'Player A', 10_000_000, 'TMA');
    const playerB = makeTradePlayer('player_b', 'Player B', 10_000_000, 'TMB');

    const teamA = makeTradeTeam('TMA', 150_000_000, [playerA]);
    const teamB = makeTradeTeam('TMB', 120_000_000, [playerB]);

    const result = computeWorldMutation({
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            team: teamA,
            teamCode: 'TMA',
            sends: [{ ...playerA, matchOutgoing: 10_000_000 }],
            receives: [{ ...playerB, matchIncoming: 10_000_000 }],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
          {
            team: teamB,
            teamCode: 'TMB',
            sends: [{ ...playerB, matchOutgoing: 10_000_000 }],
            receives: [{ ...playerA, matchIncoming: 10_000_000 }],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
        ],
        capProjections: makeCapProjections(),
        tradeCtx: { worldId: 'world_pass1', seasonId: '2025-26' },
      },
      currentState: {
        teams: [
          { teamCode: 'TMA', team: teamA },
          { teamCode: 'TMB', team: teamB },
        ],
      },
      seasonId: '2025-26',
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_pass1',
    });

    expect(result.success).toBe(true);
    expect(result.teamUpdates).toHaveLength(2);
    expect(result.teamUpdates?.map((update) => update.teamCode)).toEqual([
      'TMA',
      'TMB',
    ]);
    expect(result.metadata?.type).toBe('trade');
    expect(result.metadata?.teamsInvolved).toEqual(['TMA', 'TMB']);
    expect(result.metadata?.playersTraded).toEqual(['player_a', 'player_b']);
    expect(result._validatedTradeContext?._isValidatedTradeContext).toBe(true);
    expect(Array.isArray(result._validatedTradeContext?.teamResults)).toBe(
      true
    );
  });

  it('dispatches a typed signing payload and requires persisted world writes in handleSign', async () => {
    const updatedTeam = {
      ...baseTeamFixture,
      roster: ['player_1'],
      players: [
        {
          ...playerFixture,
          contract: {
            salariesByYear: contractFixture.salariesByYear,
          },
        },
      ],
      capHolds: [],
      exceptions: {
        mle: {
          type: 'non-taxpayer',
          usedAmount: 12_000_000,
          remainingAmount: 900_000,
        },
      },
      totals: {
        isHardCapped: true,
        hardCapLevel: 'firstApron',
      },
    };

    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: updatedTeam }],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 1,
        playersPatched: 1,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      event: { eventId: 'evt_sign_pass1' },
    });

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
    });

    let actionResult: { success: boolean; message?: string };
    await act(async () => {
      actionResult = await result.current.actions.handleSign(
        playerFixture,
        contractFixture
      );
    });

    await waitFor(() => {
      expect(result.current.teamCapSheet.capHolds).toHaveLength(0);
      expect(result.current.teamCapSheet.totals?.isHardCapped).toBe(true);
      expect(result.current.teamCapSheet.exceptions?.mle?.usedAmount).toBe(
        12_000_000
      );
    });

    expect(mutationMocks.applyWorldMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationType: 'signFreeAgent',
        worldId: 'world_1',
        payload: expect.objectContaining({
          teamCode: 'LAL',
          playerId: 'player_1',
          signedUsing: 'Full MLE',
          contract: expect.objectContaining({
            contractType: 'Signed FA',
            signingTeam: 'LAL',
            salariesByYear: [
              expect.objectContaining({
                season: '2025-26',
                salary: 12_000_000,
                capHit: 12_000_000,
              }),
            ],
          }),
        }),
      })
    );
    expect(actionResult!).toEqual({ success: true });
    expect(toastMocks.success).toHaveBeenCalledWith('Saved changes');
    expect(refreshWorldRosterIndex).toHaveBeenCalled();
  });

  it('keeps TPE expiry and hard-cap reset behavior intact under the hardened transition contracts', () => {
    const fromYear = 2026;
    const toYear = 2027;
    const anchorPlayer = makeOffseasonPlayer('p-anchor', 'Anchor Player', [
      makeSeasonRow(fromYear, 7_000_000),
      makeSeasonRow(toYear, 7_000_000),
    ]);
    const fillers = makeStandardRoster(13, fromYear, toYear);
    const team = makeOffseasonTeam([anchorPlayer, ...fillers], {
      exceptions: {
        dpe: {
          enabled: true,
          totalAmount: 1_000_000,
          usedAmount: 250_000,
          remainingAmount: 750_000,
          seasonKey: '2025-26',
        },
        tpe: [
          {
            id: 'tpe-expired',
            totalAmount: 1_000_000,
            remainingAmount: 1_000_000,
            expiresOn: '2026-06-01T00:00:00.000Z',
          },
          {
            id: 'tpe-active',
            totalAmount: 2_000_000,
            remainingAmount: 2_000_000,
            expiresOn: '2026-08-01T00:00:00.000Z',
          },
        ],
      },
      hardCapTriggered: 'FirstApron',
      hardCapFirstApron: { active: true, reason: 'Test', season: '2025-26' },
      hardCapped: true,
      totals: {
        isHardCapped: true,
        hardCapLevel: 'firstApron',
        hardCapDetail: 'Triggered by test',
      },
    });

    const result = resolveOffseasonTransition({
      teamCapSheet: team,
      fromYear,
      toYear,
      optionDecisions: {},
    });

    expect(result.success).toBe(true);
    expect(result.appliedChangesSummary?.hardCapCleared).toBe(true);
    expect(result.appliedChangesSummary?.expiredTPEs).toHaveLength(1);
    expect(result.appliedChangesSummary?.expiredTPEs[0]?.id).toBe(
      'tpe-expired'
    );
    expect(result.nextTeamCapSheet?.exceptions?.dpe).toEqual(
      expect.objectContaining({
        enabled: false,
        usedAmount: 0,
      })
    );
    expect(result.nextTeamCapSheet?.hardCapTriggered).toBeUndefined();
    expect(result.nextTeamCapSheet?.hardCapped).toBe(false);
    expect(result.nextTeamCapSheet?.exceptions?.tpe).toHaveLength(1);
    expect(result.nextTeamCapSheet?.exceptions?.tpe?.[0]).toEqual(
      expect.objectContaining({ id: 'tpe-active' })
    );
  });
});
