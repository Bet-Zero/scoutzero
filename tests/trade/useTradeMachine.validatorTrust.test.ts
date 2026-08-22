// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import capProjections from '@/features/architect/utils/capProjections';
import type {
  NormalizedPlayer,
} from '@/features/architect/utils/tradeMachine/constants/types';

const worldTeamDataMocks = vi.hoisted(() => ({
  loadWorldTeamData: vi.fn(),
}));

vi.mock('@/features/architect/utils/worldTeamData', () => ({
  loadWorldTeamData: worldTeamDataMocks.loadWorldTeamData,
}));

import { useTradeMachine } from '@/features/architect/hooks/useTradeMachine';

const CURRENT_YEAR = 2026;
const SEASON = '2025-26';
type PlayerFixtureExtra = Record<string, unknown> & {
  name?: string;
  teamCode?: string | null;
  position?: string;
  contract?: unknown;
  contractType?: string;
  guaranteed?: boolean;
};

const makePlayer = (
  id: string,
  salary: number,
  extra: PlayerFixtureExtra = {}
) => ({
  id,
  player_id: id,
  name: extra.name ?? id,
  teamCode: extra.teamCode ?? null,
  bio: {
    displayName: extra.name ?? id,
    playerId: id,
    position: extra.position ?? 'G',
  },
  contract:
    extra.contract || {
      contractType: extra.contractType,
      salariesByYear: [
        {
          season: SEASON,
          salary,
          capHit: salary,
          guaranteed: extra.guaranteed ?? true,
        },
      ],
    },
  ...extra,
});

const makeRoster = (teamCode: string, count: number, salary = 1_000_000) =>
  Array.from({ length: count }, (_, index) =>
    makePlayer(`${teamCode}_player_${index}`, salary, { teamCode })
  );

const makeSatContract = (firstYearSalary: number) => ({
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
});

function assertDefined<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

const signAndTradePlayer = makePlayer('sat_player', 0, {
  name: 'Sign And Trade Player',
  teamCode: 'LAL',
  freeAgentYear: CURRENT_YEAR,
  contract: {
    salariesByYear: [
      { season: SEASON, salary: 0, capHit: 0, guaranteed: false },
    ],
  },
});

const primaryTeamData = {
  id: 'LAL',
  teamCode: 'LAL',
  teamName: 'Los Angeles Lakers',
  abbreviation: 'LAL',
  players: [signAndTradePlayer, ...makeRoster('LAL', 13)],
  totalSalary: 13_000_000,
  teamTotalSalary: 13_000_000,
  capHolds: [
    {
      playerId: 'sat_player',
      playerName: 'Sign And Trade Player',
      season: SEASON,
      active: true,
      isSigned: false,
    },
  ],
  deadCap: [],
  entitlementIds: [],
  totals: {},
};

const bosCounter = makePlayer('bos_counter', 12_000_000, {
  name: 'Boston Counter',
  teamCode: 'BOS',
});

const secondaryTeamData = {
  id: 'BOS',
  teamCode: 'BOS',
  teamName: 'Boston Celtics',
  abbreviation: 'BOS',
  players: [bosCounter, ...makeRoster('BOS', 13)],
  totalSalary: 25_000_000,
  teamTotalSalary: 25_000_000,
  capHolds: [],
  deadCap: [],
  entitlementIds: [],
  totals: {},
};

describe('useTradeMachine validator trust contract', () => {
  beforeEach(() => {
    worldTeamDataMocks.loadWorldTeamData.mockReset();
    worldTeamDataMocks.loadWorldTeamData.mockImplementation(
      async (_worldId: string | null, teamId: string) => {
        if (teamId === 'celtics' || teamId === 'BOS') {
          return JSON.parse(JSON.stringify(secondaryTeamData));
        }
        return JSON.parse(JSON.stringify(primaryTeamData));
      }
    );
  });

  it('keeps override state separate and fails closed when named books are unavailable', async () => {
    const { result } = renderHook(() =>
      useTradeMachine(
        'lakers',
        capProjections,
        CURRENT_YEAR,
        primaryTeamData,
        null,
        '2026-02-01'
      )
    );

    await waitFor(
      () => {
        expect(result.current.initError).toBeNull();
        expect(result.current.teams[0]?.team?.players?.length).toBe(14);
      },
      { timeout: 3000 }
    );

    await act(async () => {
      await result.current.selectTeam(1, 'celtics');
    });

    await waitFor(
      () => {
        expect(result.current.teams[1]?.team?.id).toBe('BOS');
        expect(result.current.teams[1]?.team?.players?.length).toBe(14);
      },
      { timeout: 3000 }
    );

    const primaryTeam = assertDefined(
      result.current.teams[0]?.team,
      'Primary team should be loaded'
    );
    const secondaryTeam = assertDefined(
      result.current.teams[1]?.team,
      'Secondary team should be loaded'
    );
    const primaryPlayers = assertDefined(
      primaryTeam.players,
      'Primary players should be loaded'
    );
    const secondaryPlayers = assertDefined(
      secondaryTeam.players,
      'Secondary players should be loaded'
    );

    const outgoingSatPlayer = primaryPlayers.find(
      (player: NormalizedPlayer) =>
        (player.player_id || player.id) === 'sat_player'
    );
    const incomingCounter = secondaryPlayers.find(
      (player: NormalizedPlayer) =>
        (player.player_id || player.id) === 'bos_counter'
    );

    expect(outgoingSatPlayer).toBeDefined();
    expect(incomingCounter).toBeDefined();
    const definedOutgoingSatPlayer = assertDefined(
      outgoingSatPlayer,
      'Expected outgoing sign-and-trade player'
    );
    const definedIncomingCounter = assertDefined(
      incomingCounter,
      'Expected incoming counter player'
    );

    act(() => {
      result.current.setPlayerTrade(0, definedOutgoingSatPlayer, 'signAndTrade', 'BOS', {
        signAndTradeContract: makeSatContract(15_000_000),
      });
      result.current.setPlayerTrade(1, definedIncomingCounter, 'trade', 'LAL');
    });

    act(() => {
      result.current.setForceTrade(true);
    });

    await waitFor(() => {
      expect(result.current.forceTrade).toBe(true);
    });

    act(() => {
      result.current.handleValidate();
    });

    await waitFor(() => {
      expect(result.current.isValidating).toBe(false);
    });

    expect(result.current.snapshotValidationDetails).toBeNull();
    expect(result.current.previewAuthority).toBeNull();
    expect(result.current.forceTrade).toBe(true);
  });
});
