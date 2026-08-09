// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  useArchitectActions,
  type UseArchitectActionsParams,
  type UseArchitectActionsReturn,
} from '@/features/architect/GMDashboard/hooks/useArchitectActions';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import { RIGHTS_LEDGER_WORLD_VERSION } from '@/features/architect/utils/rightsHistory';
import { makeRightsLedgerForIdentity } from '../../../tests/fixtures/architect/rightsHistory';

type MatrixTeamCapSheet = NonNullable<
  UseArchitectActionsParams['state']['teamCapSheet']
>;
type StateSetterValue<T> = T extends Dispatch<SetStateAction<infer TValue>>
  ? TValue
  : never;
type MatrixTeamCapSheetState = StateSetterValue<
  UseArchitectActionsParams['state']['setTeamCapSheet']
>;
type MatrixSelectedPlayerState = StateSetterValue<
  UseArchitectActionsParams['state']['setSelectedPlayer']
>;
type MatrixFreeAgentsState = StateSetterValue<
  UseArchitectActionsParams['state']['setFreeAgents']
>;
type MatrixOffseasonSummaryState = StateSetterValue<
  UseArchitectActionsParams['state']['setOffseasonSummary']
>;
type MatrixPlayer = NonNullable<MatrixTeamCapSheet['players']>[number];
type MatrixActionPlayer = Parameters<
  UseArchitectActionsReturn['handleExtendContract']
>[0];
type MatrixCapHold = NonNullable<MatrixTeamCapSheet['capHolds']>[number];
type MatrixSigningResult = Awaited<
  ReturnType<UseArchitectActionsReturn['handleSign']>
>;
type MatrixSignAndTradeResult = Awaited<
  ReturnType<UseArchitectActionsReturn['handleSignAndTrade']>
>;
type SignFreeAgentComputeArgs = {
  mutationType: string;
  currentState?: {
    team?: MatrixTeamCapSheet | null;
  } | null;
  payload?: {
    playerId?: string | number | null;
    contract?: {
      contractType?: string | null;
      salariesByYear?: Array<{ salary?: number | string | null }> | null;
    } | null;
  } | null;
};

const mutationMocks = vi.hoisted(() => ({
  applyWorldMutation: vi.fn(),
  computeWorldMutation: vi.fn(),
  findUpdatedTeamSnapshot: vi.fn(
    (
      teamUpdates: Array<{ teamCode?: string; team?: unknown }> | null | undefined,
      targetTeamCode: string
    ) =>
      (teamUpdates || []).find(
        (update) => update?.teamCode === targetTeamCode && update?.team
      )?.team || null
  ),
  findCommittedTeamSnapshot: vi.fn(
    (
      teamUpdates: Array<{ teamCode?: string; team?: unknown }> | null | undefined,
      targetTeamCode: string
    ) =>
      (teamUpdates || []).find(
        (update) => update?.teamCode === targetTeamCode && update?.team
      )?.team || null
  ),
  buildGeneralMutationDashboardReloadTeamSnapshot: vi.fn(
    (team: unknown) => team || null
  ),
  preflightSignAndTradeMutation: vi.fn(),
}));

const worldTeamDataMocks = vi.hoisted(() => ({
  loadWorldTeamData: vi.fn(),
  resolveTeamCode: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/features/architect/utils/mutationPipeline', () => ({
  applyWorldMutation: mutationMocks.applyWorldMutation,
  buildGeneralMutationDashboardReloadTeamSnapshot:
    mutationMocks.buildGeneralMutationDashboardReloadTeamSnapshot,
  computeWorldMutation: mutationMocks.computeWorldMutation,
  findCommittedTeamSnapshot: mutationMocks.findCommittedTeamSnapshot,
  findUpdatedTeamSnapshot: mutationMocks.findUpdatedTeamSnapshot,
  preflightSignAndTradeMutation: mutationMocks.preflightSignAndTradeMutation,
}));

vi.mock('@/features/architect/utils/worldTeamData', () => ({
  loadWorldTeamData: worldTeamDataMocks.loadWorldTeamData,
  resolveTeamCode: worldTeamDataMocks.resolveTeamCode,
}));

vi.mock('@/features/architect/utils/capLegality/postStateCapValidator', () => ({
  POST_STATE_CAP_VALIDATOR_VERSION: 'test-validator',
  validatePostStateCapLegality: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
}));

vi.mock('@/features/architect/utils/capLegalityValidation', () => ({
  validateSigning: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateContractRows: vi.fn(() => ({ violations: [], warnings: [] })),
  validateDeadCap: vi.fn(() => ({ violations: [], warnings: [] })),
  validateExceptions: vi.fn(() => ({ violations: [], warnings: [] })),
  isOverrideEnabled: vi.fn(() => false),
}));

vi.mock('react-hot-toast', () => ({
  default: toastMocks,
}));

const CURRENT_YEAR = 2026;
const CURRENT_SEASON = toSeasonCode(CURRENT_YEAR);
const NEXT_SEASON = toSeasonCode(CURRENT_YEAR + 1);

function salaryRow(endYear: number, salary: number) {
  return {
    season: toSeasonCode(endYear),
    salary,
    capHit: salary,
    guaranteed: true,
  };
}

function makeRosterPlayer(id: string, salary: number) {
  return {
    id,
    player_id: id,
    name: id,
    displayName: id,
    contract: {
      contractType: 'Standard',
      salariesByYear: [salaryRow(CURRENT_YEAR, salary)],
    },
  };
}

function buildTeamFixture() {
  const basePlayers = [
    makeRosterPlayer('p_extend', 8_000_000),
    makeRosterPlayer('p_waive', 10_000_000),
    makeRosterPlayer('p_stretch', 9_000_000),
    makeRosterPlayer('p_buyout', 12_000_000),
    makeRosterPlayer('p_renounce', 4_000_000),
  ];

  const fillers = Array.from({ length: 10 }, (_, index) =>
    makeRosterPlayer(`p_fill_${index + 1}`, 1_000_000)
  );

  const players = [...basePlayers, ...fillers];

  return {
    teamCode: 'LAL',
    teamName: 'Los Angeles Lakers',
    roster: players.map((player) => player.id),
    players,
    deadCap: [],
    capHolds: [
      {
        playerId: 'p_renounce',
        playerName: 'p_renounce',
        amount: 4_000_000,
        season: CURRENT_SEASON,
        type: 'FA Cap Hold',
        active: true,
        isSigned: false,
      },
      {
        playerId: 'p_resign',
        playerName: 'p_resign',
        amount: 3_000_000,
        season: CURRENT_SEASON,
        type: 'FA Cap Hold',
        active: true,
        isSigned: false,
      },
      {
        playerId: 'hold_only',
        playerName: 'hold_only',
        amount: 2_000_000,
        season: CURRENT_SEASON,
        type: 'FA Cap Hold',
        active: true,
        isSigned: false,
      },
    ],
    exceptions: {},
    totals: {},
  };
}

function totalForYear(team: MatrixTeamCapSheet, endYear = CURRENT_YEAR): number {
  return computeTeamCapTotals(team, endYear).totalCapAllocations;
}

function getPlayer(team: MatrixTeamCapSheet, playerId: string) {
  return (team?.players || []).find(
    (player) => player.id === playerId || player.player_id === playerId
  );
}

function getRequiredPlayer(
  team: MatrixTeamCapSheet,
  playerId: string
): MatrixActionPlayer {
  const player = getPlayer(team, playerId);
  if (!player) {
    throw new Error(`Missing test player fixture: ${playerId}`);
  }
  return player as MatrixActionPlayer;
}

function buildPlayersMap(team: MatrixTeamCapSheet): Record<string, MatrixPlayer> {
  const map: Record<string, MatrixPlayer> = {};
  (team?.players || []).forEach((player) => {
    const id = player.id || player.player_id || player.name;
    if (id) map[id] = player;
    if (player.name) map[player.name] = player;
  });

  const resignPlayer = {
    id: 'p_resign',
    player_id: 'p_resign',
    name: 'p_resign',
    displayName: 'p_resign',
    contract: null,
  };
  map.p_resign = resignPlayer;
  map['p_resign'] = resignPlayer;

  return map;
}

function renderActionsHarness({
  worldId,
  initialTeam,
}: {
  worldId: string | null;
  initialTeam?: MatrixTeamCapSheet;
}) {
  const sourceTeam: MatrixTeamCapSheet = initialTeam || buildTeamFixture();
  const team = worldId
    ? {
        ...sourceTeam,
        rightsLedger:
          sourceTeam.rightsLedger ??
          makeRightsLedgerForIdentity({
            worldId,
            teamId: 'LAL',
            playerId: 'p_renounce',
            salaryCapYear: CURRENT_YEAR,
          }),
      }
    : sourceTeam;
  const refreshWorldRosterIndex = vi.fn().mockResolvedValue(new Set<string>());
  const startSave = vi.fn();
  const finishSave = vi.fn();

  const { result } = renderHook(() => {
    const [teamCapSheet, setTeamCapSheet] =
      useState<MatrixTeamCapSheetState>(team);
    const [selectedRulesYear, setSelectedRulesYear] =
      useState<number>(CURRENT_YEAR);
    const [selectedPlayer, setSelectedPlayer] =
      useState<MatrixSelectedPlayerState>(null);
    const [freeAgents, setFreeAgents] = useState<MatrixFreeAgentsState>([]);
    const [offseasonRun, setOffseasonRun] = useState<boolean>(false);
    const [offseasonSummary, setOffseasonSummary] =
      useState<MatrixOffseasonSummaryState>(null);

    const actions = useArchitectActions({
      teamId: 'LAL',
      userId: 'user_1',
      authLoading: false,
      state: {
        teamCapSheet,
        currentYear: CURRENT_YEAR,
        worldAsOfDate: worldId ? '2025-07-15' : null,
        rightsLedgerWorldVersion: worldId
          ? RIGHTS_LEDGER_WORLD_VERSION
          : null,
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
      playersMap: buildPlayersMap(teamCapSheet || buildTeamFixture()),
      modals: {
        openContractModal: vi.fn(),
        closeContractModal: vi.fn(),
      },
      worldId,
      seasonId: CURRENT_SEASON,
    });

    return { actions, teamCapSheet: teamCapSheet || buildTeamFixture() };
  });

  return { result, refreshWorldRosterIndex };
}

function expectWorldMutationCall(
  mutationType: string,
  expectedPayload: Record<string, unknown> = {}
) {
  expect(mutationMocks.applyWorldMutation).toHaveBeenCalledWith(
    expect.objectContaining({
      mutationType,
      payload: expect.objectContaining(expectedPayload),
    })
  );
}

describe('Cap Sheet transaction matrix (deterministic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    worldTeamDataMocks.resolveTeamCode.mockImplementation((teamId: string) =>
      String(teamId || '').toUpperCase()
    );
    worldTeamDataMocks.loadWorldTeamData.mockResolvedValue(null);
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [],
      event: { operationId: 'world-op' },
    });
    mutationMocks.computeWorldMutation.mockImplementation(
      ({ mutationType, currentState, payload }: SignFreeAgentComputeArgs) => {
        if (mutationType !== 'signFreeAgent') {
          return {
            success: false,
            error: `Unsupported mutationType ${mutationType}`,
          };
        }
        const team = currentState?.team || buildTeamFixture();
        const playerId = String(payload?.playerId || 'p_resign');
        const salary =
          Number(payload?.contract?.salariesByYear?.[0]?.salary) || 5_000_000;
        const signedPlayer = {
          id: playerId,
          player_id: playerId,
          name: playerId,
          displayName: playerId,
          contract: {
            contractType: payload?.contract?.contractType || 'Signed FA',
            salariesByYear: [salaryRow(CURRENT_YEAR, salary)],
          },
        };
        const nextTeam = {
          ...team,
          roster: [...(team.roster || []), playerId],
          players: [...(team.players || []), signedPlayer],
          capHolds: (team.capHolds || []).filter(
            (hold: MatrixCapHold) => hold.playerId !== playerId
          ),
        };

        return {
          success: true,
          teamUpdates: [{ teamCode: 'LAL', team: nextTeam }],
        };
      }
    );
  });

  it('base mode: extend contract mutates future state, changes totals, and skips world persistence', async () => {
    const { result } = renderActionsHarness({ worldId: null });
    const targetPlayer = getRequiredPlayer(
      result.current.teamCapSheet,
      'p_extend'
    );
    const beforeFutureTotal = totalForYear(
      result.current.teamCapSheet,
      CURRENT_YEAR + 1
    );

    await act(async () => {
      await result.current.actions.handleExtendContract(targetPlayer, {
        salariesByYear: [salaryRow(CURRENT_YEAR + 1, 11_000_000)],
      });
    });

    const updatedPlayer = getRequiredPlayer(
      result.current.teamCapSheet,
      'p_extend'
    );
    const afterFutureTotal = totalForYear(
      result.current.teamCapSheet,
      CURRENT_YEAR + 1
    );
    expect(
      updatedPlayer.futureContract?.salariesByYear?.length
    ).toBeGreaterThan(0);
    expect(afterFutureTotal).toBeGreaterThan(beforeFutureTotal);
    expect(mutationMocks.applyWorldMutation).not.toHaveBeenCalled();
  });

  it('base mode: waive / waive-stretch / buyout each produce deterministic state+totals deltas and skip world persistence', async () => {
    const { result } = renderActionsHarness({ worldId: null });

    const waiveBefore = totalForYear(result.current.teamCapSheet);
    await act(async () => {
      await result.current.actions.handleWaiveContract(
        getRequiredPlayer(result.current.teamCapSheet, 'p_waive'),
        { stretch: false, buyout: false }
      );
    });
    const waiveAfter = totalForYear(result.current.teamCapSheet);
    expect(getPlayer(result.current.teamCapSheet, 'p_waive')).toBeUndefined();
    expect(waiveAfter).toBe(waiveBefore);

    const stretchBefore = totalForYear(result.current.teamCapSheet);
    await act(async () => {
      await result.current.actions.handleWaiveContract(
        getRequiredPlayer(result.current.teamCapSheet, 'p_stretch'),
        { stretch: true, buyout: false }
      );
    });
    const stretchAfter = totalForYear(result.current.teamCapSheet);
    expect(getPlayer(result.current.teamCapSheet, 'p_stretch')).toBeUndefined();
    expect(stretchAfter).toBeLessThan(stretchBefore);

    const buyoutBefore = totalForYear(result.current.teamCapSheet);
    await act(async () => {
      await result.current.actions.handleWaiveContract(
        getRequiredPlayer(result.current.teamCapSheet, 'p_buyout'),
        { stretch: false, buyout: true, buyoutAmount: 5_000_000 }
      );
    });
    const buyoutAfter = totalForYear(result.current.teamCapSheet);
    expect(getPlayer(result.current.teamCapSheet, 'p_buyout')).toBeUndefined();
    expect(buyoutAfter).toBeLessThan(buyoutBefore);
    expect(mutationMocks.applyWorldMutation).not.toHaveBeenCalled();
  });

  it('base mode: rights renunciation fails closed and skips world persistence', async () => {
    const { result } = renderActionsHarness({ worldId: null });

    const renounceBefore = totalForYear(result.current.teamCapSheet);
    await act(async () => {
      await result.current.actions.handleRenounceRights(
        getRequiredPlayer(result.current.teamCapSheet, 'p_renounce')
      );
    });
    const renounceAfter = totalForYear(result.current.teamCapSheet);
    expect(renounceAfter).toBe(renounceBefore);
    expect(
      result.current.teamCapSheet.capHolds?.some(
        (hold: MatrixCapHold) => hold.playerId === 'p_renounce'
      )
    ).toBe(true);

    const absolveBefore = totalForYear(result.current.teamCapSheet);
    act(() => {
      result.current.actions.handleCapHoldRenounce({
        playerId: 'hold_only',
        playerName: 'hold_only',
      });
    });
    expect(
      result.current.teamCapSheet.capHolds?.some(
        (hold: MatrixCapHold) => hold.playerId === 'hold_only'
      )
    ).toBe(true);
    const absolveAfter = totalForYear(result.current.teamCapSheet);
    expect(absolveAfter).toBe(absolveBefore);
    expect(toastMocks.error).toHaveBeenCalledWith(
      'Renunciation requires a saved Team Plan with governed rights history.'
    );
    expect(mutationMocks.applyWorldMutation).not.toHaveBeenCalled();
  });

  it('base mode: manage exceptions (unchanged totals), dead money save (changed totals), and rights actions route without world persistence', async () => {
    const { result } = renderActionsHarness({ worldId: null });

    const exceptionsBefore = totalForYear(result.current.teamCapSheet);
    await act(async () => {
      await result.current.actions.handleSetExceptions({
        mle: {
          enabled: true,
          totalAmount: 12_900_000,
          usedAmount: 2_000_000,
          seasonKey: CURRENT_SEASON,
        },
      });
    });
    const exceptionsAfter = totalForYear(result.current.teamCapSheet);
    const exceptions = result.current.teamCapSheet.exceptions as
      | { mle?: { enabled?: boolean } }
      | null
      | undefined;
    expect(exceptions?.mle?.enabled).toBe(true);
    expect(exceptionsAfter).toBe(exceptionsBefore);

    const deadMoneyBefore = totalForYear(result.current.teamCapSheet);
    await act(async () => {
      await result.current.actions.handleSetDeadCap([
        {
          playerId: 'manual_dead_cap',
          playerName: 'manual_dead_cap',
          amountByYear: [{ season: CURRENT_SEASON, amount: 2_500_000 }],
        },
      ]);
    });
    const deadMoneyAfter = totalForYear(result.current.teamCapSheet);
    expect(deadMoneyAfter).toBeGreaterThan(deadMoneyBefore);
    expect(result.current.teamCapSheet.deadCap).toHaveLength(1);

    const resignBefore = totalForYear(result.current.teamCapSheet);
    let resignResult: MatrixSigningResult | undefined;
    await act(async () => {
      resignResult = await result.current.actions.handleSign(
        {
          id: 'p_resign',
          player_id: 'p_resign',
          name: 'p_resign',
          displayName: 'p_resign',
          contract: null,
        },
        {
          contractType: 'Signed FA',
          salariesByYear: [salaryRow(CURRENT_YEAR, 6_000_000)],
          signedUsing: 'Bird',
        }
      );
    });
    expect(resignResult?.success).toBe(true);
    const resignAfter = totalForYear(result.current.teamCapSheet);
    expect(resignAfter).toBeGreaterThan(resignBefore);
    expect(getPlayer(result.current.teamCapSheet, 'p_resign')).toBeTruthy();

    const signAndTradeBefore = totalForYear(result.current.teamCapSheet);
    let signAndTradeResult: MatrixSignAndTradeResult | undefined;
    await act(async () => {
      signAndTradeResult = await result.current.actions.handleSignAndTrade(
        {
          id: 'p_resign',
          player_id: 'p_resign',
          name: 'p_resign',
          displayName: 'p_resign',
          contract: null,
        },
        {
          contractType: 'Sign & Trade',
          salariesByYear: [salaryRow(CURRENT_YEAR, 7_000_000)],
        },
        'BOS'
      );
    });
    expect(signAndTradeResult?.success).toBe(false);
    expect(signAndTradeResult?.message).toMatch(/active world/i);
    expect(totalForYear(result.current.teamCapSheet)).toBe(signAndTradeBefore);
    expect(mutationMocks.applyWorldMutation).not.toHaveBeenCalled();
  });

  it('world mode: matrix routes through world mutation pipeline with deterministic payloads', async () => {
    const { result } = renderActionsHarness({ worldId: 'world_1' });

    await act(async () => {
      await result.current.actions.handleSetExceptions({
        mle: {
          enabled: true,
          totalAmount: 12_900_000,
          usedAmount: 2_000_000,
          seasonKey: CURRENT_SEASON,
        },
      });
    });
    expectWorldMutationCall('setExceptions', { teamCode: 'LAL' });

    await act(async () => {
      await result.current.actions.handleSetDeadCap([
        {
          playerId: 'manual_dead_cap',
          playerName: 'manual_dead_cap',
          amountByYear: [{ season: CURRENT_SEASON, amount: 2_500_000 }],
        },
      ]);
    });
    expectWorldMutationCall('setDeadCap', { teamCode: 'LAL' });

    await act(async () => {
      await result.current.actions.handleExtendContract(
        getRequiredPlayer(result.current.teamCapSheet, 'p_extend'),
        {
          salariesByYear: [salaryRow(CURRENT_YEAR + 1, 11_000_000)],
        }
      );
    });
    expectWorldMutationCall('extendPlayer', {
      teamCode: 'LAL',
      playerId: 'p_extend',
    });

    await act(async () => {
      await result.current.actions.handleWaiveContract(
        getRequiredPlayer(result.current.teamCapSheet, 'p_waive'),
        { stretch: false, buyout: false }
      );
    });
    expectWorldMutationCall('waivePlayer', {
      teamCode: 'LAL',
      playerId: 'p_waive',
    });

    await act(async () => {
      await result.current.actions.handleWaiveContract(
        getRequiredPlayer(result.current.teamCapSheet, 'p_stretch'),
        { stretch: true, buyout: false }
      );
    });
    expectWorldMutationCall('waivePlayer', {
      teamCode: 'LAL',
      playerId: 'p_stretch',
    });

    await act(async () => {
      await result.current.actions.handleWaiveContract(
        getRequiredPlayer(result.current.teamCapSheet, 'p_buyout'),
        { stretch: false, buyout: true, buyoutAmount: 5_000_000 }
      );
    });
    expectWorldMutationCall('waivePlayer', {
      teamCode: 'LAL',
      playerId: 'p_buyout',
      buyout: true,
    });

    await act(async () => {
      await result.current.actions.handleRenounceRights(
        getRequiredPlayer(result.current.teamCapSheet, 'p_renounce')
      );
    });
    expectWorldMutationCall('renounceRights', {
      teamCode: 'LAL',
      playerId: 'p_renounce',
    });

    const mutationCallsBeforeSnapshotOnlyHold =
      mutationMocks.applyWorldMutation.mock.calls.length;
    act(() => {
      result.current.actions.handleCapHoldRenounce({
        playerId: 'hold_only',
        playerName: 'hold_only',
      });
    });
    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalledWith(
        'No complete governed rights history exists for this player.'
      );
    });
    expect(mutationMocks.applyWorldMutation).toHaveBeenCalledTimes(
      mutationCallsBeforeSnapshotOnlyHold
    );
  });

  it('world mode: rights actions (re-sign + sign-and-trade) mutate state/totals and call world persistence branch', async () => {
    mutationMocks.applyWorldMutation.mockImplementation(
      async ({ mutationType }: { mutationType: string }) => {
        const baseTeam = buildTeamFixture();

        if (mutationType === 'signFreeAgent') {
          return {
            success: true,
            changedTeams: [
              {
                teamCode: 'LAL',
                team: {
                  ...baseTeam,
                  roster: [...baseTeam.roster, 'p_resign'],
                  players: [
                    ...baseTeam.players,
                    {
                      id: 'p_resign',
                      player_id: 'p_resign',
                      name: 'p_resign',
                      displayName: 'p_resign',
                      contract: {
                        contractType: 'Signed FA',
                        salariesByYear: [salaryRow(CURRENT_YEAR, 6_000_000)],
                      },
                    },
                  ],
                  capHolds: baseTeam.capHolds.filter(
                    (hold) => hold.playerId !== 'p_resign'
                  ),
                },
              },
            ],
            event: { operationId: 'sign-free-agent-op' },
          };
        }

        if (mutationType === 'signAndTrade') {
          return {
            success: true,
            changedTeams: [
              {
                teamCode: 'LAL',
                team: {
                  ...baseTeam,
                  capHolds: baseTeam.capHolds.filter(
                    (hold) => hold.playerId !== 'p_resign'
                  ),
                },
              },
            ],
            event: { operationId: 'sign-and-trade-op' },
          };
        }

        return {
          success: true,
          changedTeams: [],
          event: { operationId: 'other-op' },
        };
      }
    );

    const { result } = renderActionsHarness({ worldId: 'world_1' });

    const resignBefore = totalForYear(result.current.teamCapSheet);
    let resignResult: MatrixSigningResult | undefined;
    await act(async () => {
      resignResult = await result.current.actions.handleSign(
        {
          id: 'p_resign',
          player_id: 'p_resign',
          name: 'p_resign',
          displayName: 'p_resign',
          contract: null,
        },
        {
          contractType: 'Signed FA',
          salariesByYear: [salaryRow(CURRENT_YEAR, 6_000_000)],
          signedUsing: 'Bird',
        }
      );
    });
    expect(resignResult?.success).toBe(true);
    expectWorldMutationCall('signFreeAgent', {
      teamCode: 'LAL',
      playerId: 'p_resign',
    });
    const resignAfter = totalForYear(result.current.teamCapSheet);
    expect(resignAfter).toBeGreaterThan(resignBefore);

    const signAndTradeBefore = totalForYear(result.current.teamCapSheet);
    let signAndTradeResult: MatrixSignAndTradeResult | undefined;
    await act(async () => {
      signAndTradeResult = await result.current.actions.handleSignAndTrade(
        {
          id: 'p_resign',
          player_id: 'p_resign',
          name: 'p_resign',
          displayName: 'p_resign',
          contract: null,
        },
        {
          contractType: 'Sign & Trade',
          salariesByYear: [salaryRow(CURRENT_YEAR, 7_000_000)],
        },
        'BOS'
      );
    });
    expect(signAndTradeResult?.success).toBe(true);
    expectWorldMutationCall('signAndTrade', {
      teamCode: 'LAL',
      destinationTeamCode: 'BOS',
      playerId: 'p_resign',
    });
    const signAndTradeAfter = totalForYear(result.current.teamCapSheet);
    expect(signAndTradeAfter).toBeLessThan(signAndTradeBefore);
  });
});
