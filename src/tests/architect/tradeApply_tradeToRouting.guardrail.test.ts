import { describe, expect, it } from 'vitest';
import { buildPostTradeTeamsSnapshot } from '@/features/architect/utils/mutationPipeline';

const SEASON_ID = '2025-26';

type TradePlayer = {
  id: string;
  player_id: string;
  name: string;
  tradeTo?: string;
  currentSalary: number;
  contract: {
    salariesByYear: Array<{ season: string; salary: number; capHit: number }>;
  };
};

function makePlayer(
  id: string,
  salary: number,
  opts: { tradeTo?: string } = {}
): TradePlayer {
  return {
    id,
    player_id: id,
    name: id,
    tradeTo: opts.tradeTo,
    currentSalary: salary,
    contract: {
      salariesByYear: [{ season: SEASON_ID, salary, capHit: salary }],
    },
  };
}

function makeTeam(teamCode: string, players: TradePlayer[]) {
  const totalSalary = players.reduce((sum, p) => sum + p.currentSalary, 0);
  return {
    id: teamCode,
    teamCode,
    teamName: `Team ${teamCode}`,
    roster: players.map((p) => p.player_id),
    players,
    capHolds: [],
    draftPicks: [],
    tradeExceptions: [],
    exceptions: {},
    totals: { totalSalary, capHit: totalSalary },
  };
}

type TradeTeamFixture = ReturnType<typeof makeTeam>;

describe('Trade Apply Routing Guardrails', () => {
  it('routes 3-team incoming players using tradeTo in apply snapshot', () => {
    const aOut = makePlayer('a_out', 10_000_000, { tradeTo: 'TMB' });
    const bOut = makePlayer('b_out', 11_000_000, { tradeTo: 'TMC' });
    const cOut = makePlayer('c_out', 12_000_000, { tradeTo: 'TMA' });

    const teamA = makeTeam('TMA', [aOut, makePlayer('a_keep', 4_000_000)]);
    const teamB = makeTeam('TMB', [bOut, makePlayer('b_keep', 4_000_000)]);
    const teamC = makeTeam('TMC', [cOut, makePlayer('c_keep', 4_000_000)]);

    const snapshot = buildPostTradeTeamsSnapshot({
      payload: {
        teams: [
          { teamCode: 'TMA', sends: [aOut], entitlementsOut: [] },
          { teamCode: 'TMB', sends: [bOut], entitlementsOut: [] },
          { teamCode: 'TMC', sends: [cOut], entitlementsOut: [] },
        ],
      },
      currentState: {
        teams: [
          { teamCode: 'TMA', team: teamA },
          { teamCode: 'TMB', team: teamB },
          { teamCode: 'TMC', team: teamC },
        ],
      },
      seasonId: SEASON_ID,
      timestamp: Date.now(),
    });

    const postA = snapshot.teamUpdates.find((t) => t.teamCode === 'TMA')
      ?.team as TradeTeamFixture | undefined;
    const postB = snapshot.teamUpdates.find((t) => t.teamCode === 'TMB')
      ?.team as TradeTeamFixture | undefined;
    const postC = snapshot.teamUpdates.find((t) => t.teamCode === 'TMC')
      ?.team as TradeTeamFixture | undefined;

    expect(postA?.roster).toContain('c_out');
    expect(postA?.roster).toContain('a_keep');
    expect(postA?.roster).not.toContain('a_out');
    expect(postA?.roster).not.toContain('b_out');

    expect(postB?.roster).toContain('a_out');
    expect(postB?.roster).toContain('b_keep');
    expect(postB?.roster).not.toContain('b_out');
    expect(postB?.roster).not.toContain('c_out');

    expect(postC?.roster).toContain('b_out');
    expect(postC?.roster).toContain('c_keep');
    expect(postC?.roster).not.toContain('c_out');
    expect(postC?.roster).not.toContain('a_out');
  });

  it('fails closed for 3-team apply when any outgoing player lacks destination', () => {
    const unrouted = makePlayer('a_out', 10_000_000);
    const teamA = makeTeam('TMA', [unrouted]);
    const teamB = makeTeam('TMB', [makePlayer('b_keep', 4_000_000)]);
    const teamC = makeTeam('TMC', [makePlayer('c_keep', 4_000_000)]);

    expect(() =>
      buildPostTradeTeamsSnapshot({
        payload: {
          teams: [
            { teamCode: 'TMA', sends: [unrouted], entitlementsOut: [] },
            { teamCode: 'TMB', sends: [], entitlementsOut: [] },
            { teamCode: 'TMC', sends: [], entitlementsOut: [] },
          ],
        },
        currentState: {
          teams: [
            { teamCode: 'TMA', team: teamA },
            { teamCode: 'TMB', team: teamB },
            { teamCode: 'TMC', team: teamC },
          ],
        },
        seasonId: SEASON_ID,
        timestamp: Date.now(),
      })
    ).toThrow(/TRADE_APPLY_ROUTING_ERROR/);
  });

  it('preserves 2-team fallback behavior when outgoing player has no destination', () => {
    const aOut = makePlayer('a_out', 10_000_000);
    const bOut = makePlayer('b_out', 9_000_000);
    const teamA = makeTeam('TMA', [aOut, makePlayer('a_keep', 3_000_000)]);
    const teamB = makeTeam('TMB', [bOut, makePlayer('b_keep', 3_000_000)]);

    const snapshot = buildPostTradeTeamsSnapshot({
      payload: {
        teams: [
          { teamCode: 'TMA', sends: [aOut], entitlementsOut: [] },
          { teamCode: 'TMB', sends: [bOut], entitlementsOut: [] },
        ],
      },
      currentState: {
        teams: [
          { teamCode: 'TMA', team: teamA },
          { teamCode: 'TMB', team: teamB },
        ],
      },
      seasonId: SEASON_ID,
      timestamp: Date.now(),
    });

    const postA = snapshot.teamUpdates.find((t) => t.teamCode === 'TMA')
      ?.team as TradeTeamFixture | undefined;
    const postB = snapshot.teamUpdates.find((t) => t.teamCode === 'TMB')
      ?.team as TradeTeamFixture | undefined;

    expect(postA?.roster).toContain('b_out');
    expect(postA?.roster).toContain('a_keep');
    expect(postA?.roster).not.toContain('a_out');

    expect(postB?.roster).toContain('a_out');
    expect(postB?.roster).toContain('b_keep');
    expect(postB?.roster).not.toContain('b_out');
  });
});
