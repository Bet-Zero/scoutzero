import { describe, it, expect } from 'vitest';
import { buildPostTradeTeamsSnapshot } from '@/features/architect/utils/tradeContext/tradeContext';

const makeTeam = (id, players = [], twoWayPlayers = undefined) => {
  const base = {
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

const makePayloadTeam = (teamCode, sends = []) => ({
  teamCode,
  team: { id: teamCode },
  sends,
  picksOut: [],
  outgoingEntitlements: [],
  entitlementsOut: [],
});

const makePlayer = (name, extra = {}) => ({
  name,
  player_id: name.toLowerCase().replace(/\s/g, '_'),
  ...extra,
});

describe('buildPostTradeTeamsSnapshot — twoWayPlayers maintenance', () => {
  it('removes outgoing two-way player from twoWayPlayers', () => {
    const twPlayer = makePlayer('Two Way Guy', { isTwoWay: true });
    const stdPlayer = makePlayer('Standard Guy');

    const payload = {
      teams: [
        makePayloadTeam('LAL', [twPlayer]),
        makePayloadTeam('BOS', []),
      ],
    };

    const currentState = {
      teams: [
        { teamCode: 'LAL', team: makeTeam('LAL', [stdPlayer], [twPlayer]) },
        { teamCode: 'BOS', team: makeTeam('BOS', []) },
      ],
    };

    const result = buildPostTradeTeamsSnapshot({
      payload,
      currentState,
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    const lalUpdate = result.teamUpdates.find((u) => u.teamCode === 'LAL');
    expect(lalUpdate.team.twoWayPlayers).toEqual([]);
  });

  it('adds incoming two-way player to twoWayPlayers', () => {
    const twPlayer = makePlayer('Two Way Guy', { isTwoWay: true });

    const payload = {
      teams: [
        makePayloadTeam('LAL', [twPlayer]),
        makePayloadTeam('BOS', []),
      ],
    };

    const currentState = {
      teams: [
        { teamCode: 'LAL', team: makeTeam('LAL', [], []) },
        { teamCode: 'BOS', team: makeTeam('BOS', [], []) },
      ],
    };

    const result = buildPostTradeTeamsSnapshot({
      payload,
      currentState,
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    const bosUpdate = result.teamUpdates.find((u) => u.teamCode === 'BOS');
    expect(bosUpdate.team.twoWayPlayers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ player_id: 'two_way_guy', isTwoWay: true }),
      ])
    );
  });

  it('does not create duplicates when incoming player already present', () => {
    const twPlayer = makePlayer('Two Way Guy', { isTwoWay: true });

    const payload = {
      teams: [
        makePayloadTeam('LAL', [twPlayer]),
        makePayloadTeam('BOS', []),
      ],
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

    const result = buildPostTradeTeamsSnapshot({
      payload,
      currentState,
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    const bosUpdate = result.teamUpdates.find((u) => u.teamCode === 'BOS');
    const twIds = bosUpdate.team.twoWayPlayers.map((p) => p.player_id);
    const uniqueIds = [...new Set(twIds)];
    expect(twIds.length).toBe(uniqueIds.length);
  });

  it('does not invent twoWayPlayers when field is absent pre-trade', () => {
    const twPlayer = makePlayer('Two Way Guy', { isTwoWay: true });

    const payload = {
      teams: [
        makePayloadTeam('LAL', [twPlayer]),
        makePayloadTeam('BOS', []),
      ],
    };

    const currentState = {
      teams: [
        { teamCode: 'LAL', team: makeTeam('LAL', []) },
        { teamCode: 'BOS', team: makeTeam('BOS', []) },
      ],
    };

    const result = buildPostTradeTeamsSnapshot({
      payload,
      currentState,
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    const bosUpdate = result.teamUpdates.find((u) => u.teamCode === 'BOS');
    expect(bosUpdate.team).not.toHaveProperty('twoWayPlayers');
  });
});
