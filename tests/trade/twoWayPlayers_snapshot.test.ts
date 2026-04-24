import { describe, it, expect } from 'vitest';
import { buildPostTradeTeamsSnapshot } from '@/features/architect/utils/tradeContext/tradeContext';

type SnapshotParams = Parameters<typeof buildPostTradeTeamsSnapshot>[0];
type SnapshotResult = ReturnType<typeof buildPostTradeTeamsSnapshot>;
type SnapshotPlayer = {
  name: string;
  player_id: string;
  isTwoWay?: boolean;
  [key: string]: unknown;
};
type TeamFixture = {
  id: string;
  teamCode: string;
  teamName: string;
  roster: string[];
  players: SnapshotPlayer[];
  draftPicks: unknown[];
  entitlementIds: unknown[];
  tradeExceptions: unknown[];
  exceptions: { tpe: unknown[] };
  activeContracts: unknown[];
  twoWayPlayers?: SnapshotPlayer[];
};
type CurrentStateFixture = {
  teams: Array<{
    teamCode: string;
    team: TeamFixture;
  }>;
};
type PayloadFixture = {
  teams: Array<{
    teamCode: string;
    team: { id: string };
    sends: SnapshotPlayer[];
    picksOut: unknown[];
    outgoingEntitlements: unknown[];
    entitlementsOut: unknown[];
  }>;
};

const requireValue = <T>(value: T | null | undefined, label: string): T => {
  if (value == null) {
    throw new Error(`${label} is required`);
  }

  return value;
};

const buildSnapshot = (
  payload: PayloadFixture,
  currentState: CurrentStateFixture
): SnapshotResult =>
  buildPostTradeTeamsSnapshot({
    payload: payload as SnapshotParams['payload'],
    currentState: currentState as SnapshotParams['currentState'],
    seasonId: '2025-26',
    timestamp: Date.now(),
  });

const getTeamUpdate = (result: SnapshotResult, teamCode: string) =>
  requireValue(
    result.teamUpdates.find((update) => update.teamCode === teamCode),
    `team update ${teamCode}`
  );

const makeTeam = (
  id: string,
  players: SnapshotPlayer[] = [],
  twoWayPlayers: SnapshotPlayer[] | undefined = undefined
): TeamFixture => {
  const base: TeamFixture = {
    id,
    teamCode: id,
    teamName: `Team ${id}`,
    roster: players.map((p) => p.player_id),
    players,
    draftPicks: [],
    entitlementIds: [],
    tradeExceptions: [],
    exceptions: { tpe: [] },
    activeContracts: [],
  };
  if (twoWayPlayers !== undefined) {
    base.twoWayPlayers = twoWayPlayers;
  }
  return base;
};

const makePayloadTeam = (
  teamCode: string,
  sends: SnapshotPlayer[] = []
): PayloadFixture['teams'][number] => ({
  teamCode,
  team: { id: teamCode },
  sends,
  picksOut: [],
  outgoingEntitlements: [],
  entitlementsOut: [],
});

const makePlayer = (
  name: string,
  extra: Partial<SnapshotPlayer> = {}
): SnapshotPlayer => ({
  name,
  player_id: name.toLowerCase().replace(/\s/g, '_'),
  ...extra,
});

describe('buildPostTradeTeamsSnapshot — twoWayPlayers maintenance', () => {
  it('removes outgoing two-way player from twoWayPlayers', () => {
    const twPlayer = makePlayer('Two Way Guy', { isTwoWay: true });
    const stdPlayer = makePlayer('Standard Guy');

    const payload = {
      teams: [makePayloadTeam('LAL', [twPlayer]), makePayloadTeam('BOS', [])],
    };

    const currentState = {
      teams: [
        { teamCode: 'LAL', team: makeTeam('LAL', [stdPlayer], [twPlayer]) },
        { teamCode: 'BOS', team: makeTeam('BOS', []) },
      ],
    };

    const result = buildSnapshot(payload, currentState);

    const lalUpdate = getTeamUpdate(result, 'LAL');
    expect(lalUpdate.team.twoWayPlayers).toEqual([]);
  });

  it('adds incoming two-way player to twoWayPlayers', () => {
    const twPlayer = makePlayer('Two Way Guy', { isTwoWay: true });

    const payload = {
      teams: [makePayloadTeam('LAL', [twPlayer]), makePayloadTeam('BOS', [])],
    };

    const currentState = {
      teams: [
        { teamCode: 'LAL', team: makeTeam('LAL', [], []) },
        { teamCode: 'BOS', team: makeTeam('BOS', [], []) },
      ],
    };

    const result = buildSnapshot(payload, currentState);

    const bosUpdate = getTeamUpdate(result, 'BOS');
    expect(bosUpdate.team.twoWayPlayers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ player_id: 'two_way_guy', isTwoWay: true }),
      ])
    );
  });

  it('does not create duplicates when incoming player already present', () => {
    const twPlayer = makePlayer('Two Way Guy', { isTwoWay: true });

    const payload = {
      teams: [makePayloadTeam('LAL', [twPlayer]), makePayloadTeam('BOS', [])],
    };

    const currentState = {
      teams: [
        { teamCode: 'LAL', team: makeTeam('LAL', [], []) },
        {
          teamCode: 'BOS',
          team: makeTeam('BOS', [], [twPlayer]),
        },
      ],
    };

    const result = buildSnapshot(payload, currentState);

    const bosUpdate = getTeamUpdate(result, 'BOS');
    const twIds = requireValue(
      bosUpdate.team.twoWayPlayers,
      'bosUpdate.team.twoWayPlayers'
    ).map((player) => player.player_id);
    const uniqueIds = [...new Set(twIds)];
    expect(twIds.length).toBe(uniqueIds.length);
  });

  it('does not invent twoWayPlayers when field is absent pre-trade', () => {
    const twPlayer = makePlayer('Two Way Guy', { isTwoWay: true });

    const payload = {
      teams: [makePayloadTeam('LAL', [twPlayer]), makePayloadTeam('BOS', [])],
    };

    const currentState = {
      teams: [
        { teamCode: 'LAL', team: makeTeam('LAL', []) },
        { teamCode: 'BOS', team: makeTeam('BOS', []) },
      ],
    };

    const result = buildSnapshot(payload, currentState);

    const bosUpdate = getTeamUpdate(result, 'BOS');
    expect(bosUpdate.team).not.toHaveProperty('twoWayPlayers');
  });
});
