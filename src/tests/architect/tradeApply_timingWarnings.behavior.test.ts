import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validationFlags } from '@/config/validationFlags';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';

const firestoreMocks = vi.hoisted(() => {
  const commit = vi.fn(async () => undefined);
  return {
    commit,
    writeBatch: vi.fn(() => ({
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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

const makeSalaryAuthority = ({
  worldId,
  teamId,
  playerId,
  asOfDate,
  salaryCapYear,
  salary = 10_000_000,
}: {
  worldId: string;
  teamId: string;
  playerId: string;
  asOfDate: string;
  salaryCapYear: number;
  salary?: number;
}) => ({
  authorityVersion: 1 as const,
  status: 'ready' as const,
  worldId,
  teamId,
  playerId,
  contractId: `contract-${playerId}`,
  asOfDate,
  salaryCapYear,
  method: 'ordinary-protection' as const,
  currentSalary: salary,
  outgoingSalary: salary,
  incomingSalary: salary,
  poisonPillIncomingSalary: null,
  canonLeafIds: ['CBA2-A03.1'],
  reasons: [],
  proof: {
    ledgerId: `ledger-${playerId}`,
    ledgerVersion: 1,
    contractVersion: 1,
    stateDigest: 'fnv1a64:1111111111111111',
    calendarRecordId: 'calendar-test',
    calendarRecordVersion: 1,
    calendarSourceRecordId: 'calendar-source-test',
    calendarSourceRecordVersion: 1,
  },
});

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

vi.mock(
  '@/features/architect/utils/tradeMachine/utils/governedTradeSalaryBasis',
  () => ({
    loadWorldGovernedTradeSalaryBasisEntries: vi.fn(
      async ({
        worldId,
        teamId,
        rosterPlayerIds,
        worldAsOfDate,
        salaryCapYear,
      }) =>
        new Map(
          rosterPlayerIds.map((playerId: string) => [
            playerId,
            makeSalaryAuthority({
              worldId,
              teamId,
              playerId,
              asOfDate: worldAsOfDate,
              salaryCapYear,
              salary: playerId.endsWith('_out') ? 10_000_000 : 1_000_000,
            }),
          ])
        )
    ),
    attachGovernedTradeSalaryBasisToRoster: vi.fn(
      (players, entries) =>
        players.map((player: Record<string, unknown>) => ({
          ...player,
          governedTradeSalaryBasis: entries.get(
            String(player.id ?? player.player_id ?? player.playerId ?? '')
          ),
        }))
    ),
  })
);

vi.mock('@/features/architect/utils/worldManager', () => ({
  updateWorldStats: vi.fn(async () => undefined),
  getWorldMetadata: vi.fn(async () => ({ parentWorldId: null })),
}));

vi.mock(
  '@/features/architect/utils/capTotals/computeTeamCapTotals',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/features/architect/utils/capTotals/computeTeamCapTotals')
      >();
    const snapshot = (
      team: Parameters<typeof actual.computeTeamCapTotals>[0],
      year: number
    ) => {
      const legacy = actual.computeTeamCapTotals(team, year);
      const totals = team?.totals as Record<string, unknown> | null | undefined;
      return {
        ...legacy,
        teamSalary:
          typeof totals?.teamSalary === 'number' ? totals.teamSalary : null,
        apronTeamSalary:
          typeof totals?.apronTeamSalary === 'number'
            ? totals.apronTeamSalary
            : null,
        taxSalary:
          typeof totals?.taxSalary === 'number' ? totals.taxSalary : null,
      };
    };

    return {
      ...actual,
      createCanonicalTeamTotalsSnapshot: vi.fn(snapshot),
      synchronizeTeamTotalsSnapshot: vi.fn((team, year) => ({
        ...team,
        totals: snapshot(team, year),
      })),
    };
  }
);

import {
  applyWorldMutation,
  computeWorldMutation,
} from '@/features/architect/utils/mutationPipeline';

type IssueWire = Parameters<typeof getValidationIssueText>[0];

const SEASON_ID = '2024-25';
const FIXED_TIMESTAMP = Date.UTC(2024, 6, 3, 12, 0, 0);
const WORLD_ID = 'world_timing_warns';

const issueTexts = (issues: readonly IssueWire[] | undefined) =>
  (issues ?? []).map((issue) => getValidationIssueText(issue));

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
    totals: {
      yearKey: 2025,
      playersTotal: totalSalary,
      deadMoneyTotal: 0,
      capHoldsTotal: 0,
      incompleteChargesTotal: 0,
      totalCapAllocations: totalSalary,
      salaryCap: 140_588_000,
      luxuryTax: 170_814_000,
      firstApron: 178_132_000,
      secondApron: 188_931_000,
      teamSalary: totalSalary,
      apronTeamSalary: totalSalary,
      taxSalary: totalSalary,
      totalSalary,
      capHit: totalSalary,
    },
  };
}

function buildTradePayload({
  asOfDate = '2024-07-03',
  teamAPlayerExtra = {},
  teamBPlayerExtra = {},
}: {
  asOfDate?: string;
  teamAPlayerExtra?: Record<string, unknown>;
  teamBPlayerExtra?: Record<string, unknown>;
} = {}) {
  return {
    teams: [
      {
        teamCode: 'A',
        sends: [
          makePlayer('a_out', 10_000_000, 'A', {
            tradeTo: 'B',
            governedTradeSalaryBasis: makeSalaryAuthority({
              worldId: WORLD_ID,
              teamId: 'A',
              playerId: 'a_out',
              asOfDate,
              salaryCapYear: 2025,
            }),
            ...teamAPlayerExtra,
          }),
        ],
        entitlementsOut: [],
        salaryMatchingElection: {
          version: 1 as const,
          path: 'ROOM' as const,
          postAssignmentApronTeamSalary: 23_000_000,
          tradedPlayerPreTradeSalaries: {
            a_out: 10_000_000,
          } as Record<string, number>,
        },
      },
      {
        teamCode: 'B',
        sends: [
          makePlayer('b_out', 10_000_000, 'B', {
            tradeTo: 'A',
            governedTradeSalaryBasis: makeSalaryAuthority({
              worldId: WORLD_ID,
              teamId: 'B',
              playerId: 'b_out',
              asOfDate,
              salaryCapYear: 2025,
            }),
            ...teamBPlayerExtra,
          }),
        ],
        entitlementsOut: [],
        salaryMatchingElection: {
          version: 1 as const,
          path: 'ROOM' as const,
          postAssignmentApronTeamSalary: 23_000_000,
          tradedPlayerPreTradeSalaries: {
            b_out: 10_000_000,
          } as Record<string, number>,
        },
      },
    ],
    asOfDate,
    tradeCtx: {
      source: 'tradeMachine',
      worldId: WORLD_ID,
      asOfDate,
      yearKey: 2025,
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
    expect(
      (result.warnings ?? []).some(
        (warning) =>
          typeof warning === 'object' &&
          warning !== null &&
          (warning as { rule?: string }).rule === 'timingEnforcement'
      )
    ).toBe(true);
    expect(issueTexts(result.warnings)).toEqual(
      expect.arrayContaining([expect.stringMatching(/moratorium/i)])
    );
    expect(firestoreMocks.writeBatch).toHaveBeenCalled();
    expect(firestoreMocks.commit).toHaveBeenCalled();
  });

  it('keeps the retired 60-day timing message out of authoritative apply-time output', async () => {
    const payload = buildTradePayload({
      asOfDate: '2024-02-15',
      teamAPlayerExtra: { signedDate: '2024-01-20' },
      teamBPlayerExtra: { signedDate: '2024-01-10' },
    });
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

    const computeResult = computeWorldMutation({
      mutationType: 'executeTrade',
      payload,
      currentState,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      asOfDate: '2024-02-15',
      worldId: WORLD_ID,
    });

    const validatedContext = computeResult._validatedTradeContext;
    const teamAResult = validatedContext?.teamResults?.find(
      (team: { teamId: string }) => team.teamId === 'A'
    );
    const applyTexts = [
      ...issueTexts(validatedContext?.warnings),
      ...issueTexts(validatedContext?.violations),
      ...issueTexts(teamAResult?.warnings),
      ...issueTexts(teamAResult?.violations),
      ...issueTexts(teamAResult?.rules?.timingEnforcement?.warnings),
      ...issueTexts(teamAResult?.rules?.timingEnforcement?.violations),
    ].join(' | ');

    expect(applyTexts).not.toMatch(/acquired within the last 60 days/i);
    expect(applyTexts).not.toMatch(/recently acquired players for 2 months/i);

    const result = await applyWorldMutation({
      userId: 'user_timing_warns',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
      mutationType: 'executeTrade',
      payload,
    });

    const warningTexts = issueTexts(result.warnings).join(' | ');

    expect(result.success).toBe(true);
    expect(warningTexts).not.toMatch(/acquired within the last 60 days/i);
    expect(warningTexts).not.toMatch(/recently acquired players for 2 months/i);
  });
});
