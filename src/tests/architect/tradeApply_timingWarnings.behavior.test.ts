import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validationFlags } from '@/config/validationFlags.js';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText.js';

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

import {
  applyWorldMutation,
  computeWorldMutation,
} from '@/features/architect/utils/mutationPipeline';

const SEASON_ID = '2024-25';
const FIXED_TIMESTAMP = Date.UTC(2024, 6, 3, 12, 0, 0);
const WORLD_ID = 'world_timing_warns';

const issueTexts = (issues: Array<Record<string, unknown>> = []) =>
  issues.map((issue) => getValidationIssueText(issue));

function makePlayer(
  id: string,
  salary: number,
  teamCode: string,
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    player_id: id,
    name: id,
    teamCode,
    salary,
    currentSalary: salary,
    contract: {
      salariesByYear: [
        {
          season: SEASON_ID,
          salary,
          capHit: salary,
          guaranteed: true,
        },
      ],
    },
    ...extra,
  };
}

function makeRoster(teamCode: string, count: number, salary = 1_000_000) {
  return Array.from({ length: count }, (_, index) =>
    makePlayer(`${teamCode}_filler_${index}`, salary, teamCode)
  );
}

function makeTeam(teamCode: string, players: Array<Record<string, unknown>>) {
  const totalSalary = players.reduce(
    (sum, player) =>
      sum +
      Number(
        (player.contract as { salariesByYear?: Array<{ capHit?: number; salary?: number }> })
          ?.salariesByYear?.[0]?.capHit ??
          player.currentSalary ??
          player.salary ??
          0
      ),
    0
  );

  return {
    teamCode,
    teamName: `Team ${teamCode}`,
    roster: players.map((player) => String(player.player_id || player.id)),
    players,
    capHolds: [],
    draftPicks: [],
    entitlementIds: [],
    tradeExceptions: [],
    exceptionHistory: [],
    exceptions: { tpe: [] },
    totals: { totalSalary, capHit: totalSalary },
  };
}

function buildTradePayload() {
  return {
    teams: [
      {
        teamCode: 'A',
        sends: [makePlayer('a_out', 10_000_000, 'A', { tradeTo: 'B' })],
        entitlementsOut: [],
      },
      {
        teamCode: 'B',
        sends: [makePlayer('b_out', 10_000_000, 'B', { tradeTo: 'A' })],
        entitlementsOut: [],
      },
    ],
    asOfDate: '2024-07-03',
    tradeCtx: {
      source: 'tradeMachine',
      worldId: WORLD_ID,
      asOfDate: '2024-07-03',
    },
  };
}

describe('trade apply timing warnings', () => {
  beforeEach(() => {
    validationFlags.timingEnforcement = 'warn';
    vi.clearAllMocks();

    const teamsByCode = {
      A: makeTeam('A', [makePlayer('a_out', 10_000_000, 'A'), ...makeRoster('A', 13)]),
      B: makeTeam('B', [makePlayer('b_out', 10_000_000, 'B'), ...makeRoster('B', 13)]),
    };

    teamLoaderMocks.getTeam.mockImplementation(
      async (_worldId: string, teamCode: 'A' | 'B') => teamsByCode[teamCode]
    );
  });

  afterEach(() => {
    validationFlags.timingEnforcement = 'warn';
  });

  it('keeps warning-mode timing in _validatedTradeContext without failing compute-time trade validation', () => {
    const currentState = {
      teams: [
        {
          teamCode: 'A',
          team: makeTeam('A', [
            makePlayer('a_out', 10_000_000, 'A'),
            ...makeRoster('A', 13),
          ]),
        },
        {
          teamCode: 'B',
          team: makeTeam('B', [
            makePlayer('b_out', 10_000_000, 'B'),
            ...makeRoster('B', 13),
          ]),
        },
      ],
    };

    const result = computeWorldMutation({
      mutationType: 'executeTrade',
      payload: buildTradePayload(),
      currentState,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      asOfDate: '2024-07-03',
      worldId: WORLD_ID,
    });

    const validatedContext = result._validatedTradeContext;
    const teamAResult = validatedContext?.teamResults?.find(
      (team: { teamId: string }) => team.teamId === 'A'
    );

    expect(result.success).toBe(true);
    expect(validatedContext?._isValidatedTradeContext).toBe(true);
    expect(validatedContext?.legal).toBe(true);
    expect(issueTexts(validatedContext?.warnings)).toEqual(
      expect.arrayContaining([expect.stringMatching(/moratorium/i)])
    );
    expect(issueTexts(teamAResult?.warnings)).toEqual(
      expect.arrayContaining([expect.stringMatching(/moratorium/i)])
    );
    expect(issueTexts(teamAResult?.rules?.timingEnforcement?.warnings)).toEqual(
      expect.arrayContaining([expect.stringMatching(/moratorium/i)])
    );
  });

  it('surfaces warning-mode timing through applyWorldMutation warnings while still succeeding', async () => {
    const result = await applyWorldMutation({
      userId: 'user_timing_warns',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
      mutationType: 'executeTrade',
      payload: buildTradePayload(),
    });

    expect(result.success).toBe(true);
    expect(result.warnings?.some((warning) => warning.rule === 'timingEnforcement')).toBe(
      true
    );
    expect(issueTexts(result.warnings)).toEqual(
      expect.arrayContaining([expect.stringMatching(/moratorium/i)])
    );
    expect(firestoreMocks.writeBatch).toHaveBeenCalled();
    expect(firestoreMocks.commit).toHaveBeenCalled();
  });
});
