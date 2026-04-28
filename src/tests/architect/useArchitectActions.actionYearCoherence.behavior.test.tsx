/**
 * FILE: src/tests/architect/useArchitectActions.actionYearCoherence.behavior.test.tsx
 * PURPOSE: Focused proof that future-year Cap Table actions persist/preflight with the clicked season.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  useArchitectActions,
  type UseArchitectActionsParams,
  type UseArchitectActionsReturn,
} from '@/features/architect/GMDashboard/hooks/useArchitectActions';

type SetterValue<TSetter> = TSetter extends Dispatch<SetStateAction<infer TValue>>
  ? TValue
  : never;

type HarnessTeamCapSheet = NonNullable<
  UseArchitectActionsParams['state']['teamCapSheet']
>;
type HarnessSelectedPlayer = SetterValue<
  UseArchitectActionsParams['state']['setSelectedPlayer']
>;
type HarnessFreeAgents = SetterValue<
  UseArchitectActionsParams['state']['setFreeAgents']
>;
type HarnessOffseasonSummary = SetterValue<
  UseArchitectActionsParams['state']['setOffseasonSummary']
>;
type SigningContract = Parameters<UseArchitectActionsReturn['handleSign']>[1];

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
  preflightOfferSheetMutation: vi.fn(),
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
  preflightOfferSheetMutation: mutationMocks.preflightOfferSheetMutation,
}));

vi.mock('@/features/architect/utils/worldTeamData', () => ({
  loadWorldTeamData: worldTeamDataMocks.loadWorldTeamData,
  resolveTeamCode: worldTeamDataMocks.resolveTeamCode,
}));

vi.mock('react-hot-toast', () => ({
  default: toastMocks,
}));

const PLAYER_FIXTURE = {
  id: 'future_player_1',
  player_id: 'future_player_1',
  name: 'Future Player',
  displayName: 'Future Player',
  freeAgentYear: 2028,
  previousSalary: 0,
  birdRights: 'restricted',
  freeAgentType: 'RFA' as const,
  contract: {
    salariesByYear: [],
  },
};

const BASE_TEAM: HarnessTeamCapSheet = {
  teamCode: 'LAL',
  teamName: 'Los Angeles Lakers',
  roster: [],
  players: [],
  deadCap: [],
  capHolds: [],
  exceptions: {},
  totals: {},
};

function renderActionsHarness() {
  const refreshWorldRosterIndex = vi.fn().mockResolvedValue(new Set<string>());
  const startSave = vi.fn();
  const finishSave = vi.fn();
  const openContractModal = vi.fn();
  const closeContractModal = vi.fn();

  const { result } = renderHook(() => {
    const [teamCapSheet, setTeamCapSheet] =
      useState<UseArchitectActionsParams['state']['teamCapSheet']>(BASE_TEAM);
    const [selectedRulesYear, setSelectedRulesYear] = useState<number>(2026);
    const [selectedPlayer, setSelectedPlayer] =
      useState<HarnessSelectedPlayer>(null);
    const [freeAgents, setFreeAgents] = useState<HarnessFreeAgents>([
      PLAYER_FIXTURE,
    ]);
    const [offseasonRun, setOffseasonRun] = useState<boolean>(false);
    const [offseasonSummary, setOffseasonSummary] =
      useState<HarnessOffseasonSummary>(null);

    const actions = useArchitectActions({
      teamId: 'LAL',
      userId: 'user_1',
      authLoading: false,
      state: {
        teamCapSheet,
        currentYear: 2026,
        worldAsOfDate: null,
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
        [PLAYER_FIXTURE.id]: PLAYER_FIXTURE,
        [PLAYER_FIXTURE.player_id]: PLAYER_FIXTURE,
        [PLAYER_FIXTURE.name]: PLAYER_FIXTURE,
      },
      modals: {
        openContractModal,
        closeContractModal,
      },
      worldId: 'world_1',
      seasonId: '2025-26',
    });

    return {
      actions,
      teamCapSheet: teamCapSheet ?? BASE_TEAM,
      selectedRulesYear,
      selectedPlayer,
    };
  });

  return {
    result,
    refreshWorldRosterIndex,
  };
}

describe('useArchitectActions future-year action-year coherence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    worldTeamDataMocks.resolveTeamCode.mockImplementation((teamId: string) =>
      String(teamId || '').toUpperCase()
    );
    worldTeamDataMocks.loadWorldTeamData.mockResolvedValue(BASE_TEAM);
    mutationMocks.preflightOfferSheetMutation.mockResolvedValue({
      status: 'legal',
      reasons: [],
      warnings: [],
      source: 'authoritative-preflight',
    });
  });

  it('uses the contract first season as the authoritative seasonId for future-year sign saves', async () => {
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: BASE_TEAM }],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 1,
        playersPatched: 1,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      event: { eventId: 'evt_future_sign' },
    });

    const { result } = renderActionsHarness();

    await act(async () => {
      const futureSignContract: SigningContract = {
        contractType: 'Signed FA',
        salariesByYear: [
          {
            season: '2027-28',
            salary: 18_000_000,
            capHit: 18_000_000,
            guaranteed: true,
          },
          {
            season: '2028-29',
            salary: 18_900_000,
            capHit: 18_900_000,
            guaranteed: true,
          },
        ],
      };

      await result.current.actions.handleSign(PLAYER_FIXTURE, futureSignContract);
    });

    expect(mutationMocks.applyWorldMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationType: 'signFreeAgent',
        seasonId: '2027-28',
        payload: expect.objectContaining({
          contract: expect.objectContaining({
            salariesByYear: expect.arrayContaining([
              expect.objectContaining({
                season: '2027-28',
              }),
            ]),
          }),
        }),
      })
    );
  });

  it('uses the contract first season as the authoritative seasonId for future-year offer-sheet preflight', async () => {
    const { result } = renderActionsHarness();

    await act(async () => {
      const futureOfferSheetContract: SigningContract = {
        contractType: 'Offer Sheet',
        rfaOfferSheet: true,
        rfaOfferSheetOnly: true,
        rfaOfferSheetStatus: 'PENDING_MATCH',
        salariesByYear: [
          {
            season: '2027-28',
            salary: 21_000_000,
            capHit: 21_000_000,
            guaranteed: true,
          },
          {
            season: '2028-29',
            salary: 22_680_000,
            capHit: 22_680_000,
            guaranteed: true,
          },
        ],
      };

      await result.current.actions.getOfferSheetPreflight(
        PLAYER_FIXTURE,
        futureOfferSheetContract
      );
    });

    expect(mutationMocks.preflightOfferSheetMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        worldId: 'world_1',
        seasonId: '2027-28',
        offeringTeamCode: 'LAL',
        playerId: 'future_player_1',
        contract: expect.objectContaining({
          rfaOfferSheet: true,
          rfaOfferSheetOnly: true,
          rfaOfferSheetStatus: 'PENDING_MATCH',
          salariesByYear: expect.arrayContaining([
            expect.objectContaining({
              season: '2027-28',
            }),
          ]),
        }),
      })
    );
  });

  it('uses the contract first season as the authoritative seasonId for future-year offer-sheet store', async () => {
    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: BASE_TEAM }],
      changedPlayers: [],
      appliedToLocalState: true,
      persistedToWorld: true,
      writesSummary: {
        teamsPatched: 1,
        playersPatched: 1,
        eventsWritten: 1,
        worldMetadataPatched: 1,
      },
      event: { eventId: 'evt_future_offer_sheet' },
    });

    const { result } = renderActionsHarness();

    await act(async () => {
      const futureOfferSheetContract: SigningContract = {
        contractType: 'Offer Sheet',
        rfaOfferSheet: true,
        rfaOfferSheetOnly: true,
        rfaOfferSheetStatus: 'PENDING_MATCH',
        salariesByYear: [
          {
            season: '2027-28',
            salary: 21_000_000,
            capHit: 21_000_000,
            guaranteed: true,
          },
          {
            season: '2028-29',
            salary: 22_680_000,
            capHit: 22_680_000,
            guaranteed: true,
          },
        ],
      };

      await result.current.actions.handleStoreOfferSheet(
        PLAYER_FIXTURE,
        futureOfferSheetContract
      );
    });

    expect(mutationMocks.applyWorldMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationType: 'storeOfferSheet',
        seasonId: '2027-28',
        payload: expect.objectContaining({
          playerId: 'future_player_1',
          contract: expect.objectContaining({
            contractType: 'Offer Sheet',
            rfaOfferSheet: true,
            rfaOfferSheetOnly: true,
            rfaOfferSheetStatus: 'PENDING_MATCH',
            salariesByYear: expect.arrayContaining([
              expect.objectContaining({
                season: '2027-28',
              }),
            ]),
          }),
        }),
      })
    );
  });
});
