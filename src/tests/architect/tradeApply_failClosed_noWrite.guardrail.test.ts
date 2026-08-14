import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => {
  const commit = vi.fn(async () => undefined);
  return {
    commit,
    writeBatch: vi.fn(() => ({
      set: vi.fn(),
      update: vi.fn(),
      commit,
    })),
    getDoc: vi.fn(async () => ({
      exists: () => false,
      data: () => ({}),
    })),
  };
});

const teamLoaderMocks = vi.hoisted(() => ({
  getTeam: vi.fn(),
  getPlayer: vi.fn(),
  getLeague: vi.fn(async () => []),
  mergePlayerOverride: vi.fn((base, override) =>
    override ? { ...base, ...override } : base
  ),
}));

vi.mock('@/firebaseConfig', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  writeBatch: firestoreMocks.writeBatch,
  getDoc: firestoreMocks.getDoc,
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  collection: vi.fn((_db: unknown, ...pathParts: string[]) => ({
    _path: pathParts.join('/'),
  })),
  doc: vi.fn((_db: unknown, ...pathParts: string[]) => ({
    _path: pathParts.join('/'),
  })),
}));

vi.mock('@/features/architect/utils/teamLoader', () => ({
  getTeam: teamLoaderMocks.getTeam,
  getPlayer: teamLoaderMocks.getPlayer,
  getLeague: teamLoaderMocks.getLeague,
  mergePlayerOverride: teamLoaderMocks.mergePlayerOverride,
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  updateWorldStats: vi.fn(async () => undefined),
  getWorldMetadata: vi.fn(async () => ({ parentWorldId: null })),
}));

import { applyWorldMutation } from '@/features/architect/utils/mutationPipeline';

function makePlayer(id: string, salary: number) {
  return {
    id,
    player_id: id,
    name: id,
    salary,
    currentSalary: salary,
    contract: {
      salariesByYear: [{ season: '2025-26', salary, capHit: salary }],
    },
  };
}

function makeTeam(teamCode: string, players: Array<Record<string, unknown>>) {
  const totalSalary = players.reduce(
    (sum, p) => sum + Number(p.currentSalary || p.salary || 0),
    0
  );

  return {
    id: teamCode,
    teamCode,
    teamName: `Team ${teamCode}`,
    roster: players.map((p) => String(p.player_id || p.id)),
    players,
    capHolds: [],
    draftPicks: [],
    tradeExceptions: [],
    exceptions: {},
    totals: { totalSalary, capHit: totalSalary },
  };
}

describe('Trade Apply Fail-Closed Routing Guardrail', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    teamLoaderMocks.getTeam.mockImplementation(async (_worldId, teamCode) => {
      if (teamCode === 'TMA') {
        return makeTeam('TMA', [makePlayer('a_out', 10_000_000)]);
      }
      if (teamCode === 'TMB') {
        return makeTeam('TMB', [makePlayer('b_out', 10_000_000)]);
      }
      return makeTeam('TMC', [makePlayer('c_out', 10_000_000)]);
    });
  });

  it('fails loudly and does not open a Firestore write batch when 3+ team routing is missing', async () => {
    const result = await applyWorldMutation({
      userId: 'user_1',
      worldId: 'world_1',
      seasonId: '2025-26',
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'TMA',
            sends: [makePlayer('a_out', 10_000_000)], // no destination
            entitlementsOut: [],
          },
          {
            teamCode: 'TMB',
            sends: [makePlayer('b_out', 10_000_000)],
            entitlementsOut: [],
          },
          {
            teamCode: 'TMC',
            sends: [makePlayer('c_out', 10_000_000)],
            entitlementsOut: [],
          },
        ],
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('TRADE_APPLY_ROUTING_ERROR');
    expect(firestoreMocks.writeBatch).not.toHaveBeenCalled();
    expect(firestoreMocks.commit).not.toHaveBeenCalled();
  });

  it('fails before writes when the live Trade Machine payload has no salary-path election', async () => {
    const result = await applyWorldMutation({
      userId: 'user_1',
      worldId: 'world_1',
      seasonId: '2025-26',
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'TMA',
            sends: [makePlayer('a_out', 10_000_000)],
            entitlementsOut: [],
          },
          {
            teamCode: 'TMB',
            sends: [makePlayer('b_out', 10_000_000)],
            entitlementsOut: [],
          },
        ],
        tradeCtx: {
          source: 'tradeMachine',
          asOfDate: '2026-03-15',
          yearKey: '2025-26',
        },
      },
    });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toMatch(
      /salary path|salaryMatchingElection/i
    );
    expect(firestoreMocks.writeBatch).not.toHaveBeenCalled();
    expect(firestoreMocks.commit).not.toHaveBeenCalled();
  });
});
