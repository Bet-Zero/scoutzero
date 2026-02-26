import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('Trade Apply Routing Guardrails', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

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

    const postA = snapshot.teamUpdates.find((t) => t.teamCode === 'TMA')?.team;
    const postB = snapshot.teamUpdates.find((t) => t.teamCode === 'TMB')?.team;
    const postC = snapshot.teamUpdates.find((t) => t.teamCode === 'TMC')?.team;

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

  it('does not broadcast unrouted players in 3-team apply snapshot', () => {
    const unrouted = makePlayer('a_out', 10_000_000);
    const teamA = makeTeam('TMA', [unrouted]);
    const teamB = makeTeam('TMB', [makePlayer('b_keep', 4_000_000)]);
    const teamC = makeTeam('TMC', [makePlayer('c_keep', 4_000_000)]);

    const snapshot = buildPostTradeTeamsSnapshot({
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
    });

    const postA = snapshot.teamUpdates.find((t) => t.teamCode === 'TMA')?.team;
    const postB = snapshot.teamUpdates.find((t) => t.teamCode === 'TMB')?.team;
    const postC = snapshot.teamUpdates.find((t) => t.teamCode === 'TMC')?.team;

    expect(postA?.roster).not.toContain('a_out');
    expect(postB?.roster).not.toContain('a_out');
    expect(postC?.roster).not.toContain('a_out');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('has no destination'));
  });
});
