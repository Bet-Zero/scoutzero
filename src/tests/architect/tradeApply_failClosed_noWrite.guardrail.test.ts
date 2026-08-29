import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSalaryAuthority } from '@/tests/fixtures/governedTradeSalaryBasis';
import { withGovernedSalaryBooks } from '@/tests/fixtures/governedSalaryBookInputs';

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

const salaryBasisMocks = vi.hoisted(() => ({
  loadWorldGovernedTradeSalaryBasisEntries: vi.fn(),
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

vi.mock(
  '@/features/architect/utils/tradeMachine/utils/governedTradeSalaryBasis',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('@/features/architect/utils/tradeMachine/utils/governedTradeSalaryBasis')
    >()),
    loadWorldGovernedTradeSalaryBasisEntries:
      salaryBasisMocks.loadWorldGovernedTradeSalaryBasisEntries,
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

import { applyWorldMutation } from '@/features/architect/utils/mutationPipeline';
import { loadStateForMutation } from '@/features/architect/utils/mutationPipeline.read.stateLoader';

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
    totals: {
      teamSalary: totalSalary,
      apronTeamSalary: totalSalary,
      taxSalary: totalSalary,
      totalSalary,
      capHit: totalSalary,
    },
  };
}

describe('Trade Apply Fail-Closed Routing Guardrail', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    salaryBasisMocks.loadWorldGovernedTradeSalaryBasisEntries.mockImplementation(
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
            }),
          ])
        )
    );

    teamLoaderMocks.getTeam.mockImplementation(async (_worldId, teamCode) => {
      const playerId =
        teamCode === 'TMA'
          ? 'a_out'
          : teamCode === 'TMB'
            ? 'b_out'
            : 'c_out';
      return withGovernedSalaryBooks(
        makeTeam(teamCode, [makePlayer(playerId, 10_000_000)]),
        {
          salaryCapYear: 2027,
          asOfDate: '2026-08-24T12:00:00-04:00',
          teamSalary: 10_000_000,
          apronTeamSalary: 11_000_000,
          taxSalary: 12_000_000,
        }
      );
    });
  });

  it('materializes exact governed pre-trade salary bridges before trade computation', async () => {
    teamLoaderMocks.getTeam.mockImplementation(async (_worldId, teamCode) =>
      withGovernedSalaryBooks(
        makeTeam(
          teamCode,
          [
            makePlayer(
              teamCode === 'TMA' ? 'a_out' : 'b_out',
              10_000_000
            ),
          ]
        ),
        {
          salaryCapYear: 2027,
          asOfDate: '2026-08-24T12:00:00-04:00',
          teamSalary: 10_000_000,
          apronTeamSalary: 11_000_000,
          taxSalary: 12_000_000,
        }
      )
    );

    const currentState = await loadStateForMutation(
      'world_1',
      'executeTrade',
      {
        teams: [
          { teamCode: 'TMA', sends: [], entitlementsOut: [] },
          { teamCode: 'TMB', sends: [], entitlementsOut: [] },
        ],
        asOfDate: '2026-08-25',
        tradeCtx: {
          source: 'tradeMachine',
          worldId: 'world_1',
          asOfDate: '2026-08-25',
          yearKey: '2026-27',
        },
      }
    );

    expect(currentState.teams).toHaveLength(2);
    for (const entry of currentState.teams || []) {
      expect(
        entry.team?.totals?.salaryBooks,
        JSON.stringify(entry.team?.totals?.salaryBooks)
      ).toMatchObject({ status: 'complete' });
      expect(entry.team).toMatchObject({
        teamSalary: 10_000_000,
        apronTeamSalary: 11_000_000,
        taxSalary: 12_000_000,
        teamTotalSalary: 11_000_000,
        totals: {
          teamSalary: 10_000_000,
          apronTeamSalary: 11_000_000,
          taxSalary: 12_000_000,
        },
      });
    }
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
          asOfDate: '2026-08-25',
          yearKey: '2026-27',
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

  it('fails before writes when production-path Team Salary and Apron Team Salary books are unresolved', async () => {
    teamLoaderMocks.getTeam.mockImplementation(async (_worldId, teamCode) => {
      const playerId = teamCode === 'TMA' ? 'a_out' : 'b_out';
      const unresolvedTeam = makeTeam(teamCode, [
        makePlayer(playerId, 10_000_000),
      ]);
      return {
        ...unresolvedTeam,
        totals: {
          ...unresolvedTeam.totals,
          teamSalary: null,
          apronTeamSalary: null,
          totalSalary: null,
          capHit: null,
        },
        salaryBookInputs: {
          version: 1,
          salaryCapYear: 2026,
          apronAdjustments: {
            status: 'needs-input',
            missingInputs: ['salaryBookInputs.apronAdjustments'],
            reason: 'Apron Team Salary adjustments are unresolved.',
          },
          taxSalary: {
            status: 'needs-input',
            missingInputs: ['salaryBookInputs.taxSalary'],
            reason: 'Tax Salary is unresolved.',
          },
        },
      };
    });

    const result = await applyWorldMutation({
      userId: 'user_1',
      worldId: 'world_1',
      seasonId: '2025-26',
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'TMA',
            sends: [
              { ...makePlayer('a_out', 10_000_000), tradeTo: 'TMB' },
            ],
            entitlementsOut: [],
            salaryMatchingElection: {
              version: 1,
              path: 'ROOM',
              postAssignmentApronTeamSalary: 0,
              tradedPlayerPreTradeSalaries: { a_out: 10_000_000 },
            },
          },
          {
            teamCode: 'TMB',
            sends: [
              { ...makePlayer('b_out', 10_000_000), tradeTo: 'TMA' },
            ],
            entitlementsOut: [],
            salaryMatchingElection: {
              version: 1,
              path: 'ROOM',
              postAssignmentApronTeamSalary: 0,
              tradedPlayerPreTradeSalaries: { b_out: 10_000_000 },
            },
          },
        ],
        asOfDate: '2026-03-15',
        tradeCtx: {
          source: 'tradeMachine',
          worldId: 'world_1',
          asOfDate: '2026-03-15',
          yearKey: '2025-26',
        },
      },
    });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toMatch(
      /Team Salary|Apron Team Salary|SALARY_BOOK_NEEDS_INPUT/i
    );
    expect(firestoreMocks.writeBatch).not.toHaveBeenCalled();
    expect(firestoreMocks.commit).not.toHaveBeenCalled();
  });

  it('fails with the trade-bonus reason before opening any saved-world write batch', async () => {
    salaryBasisMocks.loadWorldGovernedTradeSalaryBasisEntries.mockImplementation(
      async ({
        worldId,
        teamId,
        rosterPlayerIds,
        worldAsOfDate,
        salaryCapYear,
      }) =>
        new Map(
          rosterPlayerIds.map((playerId: string) => {
            const ready = makeSalaryAuthority({
              worldId,
              teamId,
              playerId,
              asOfDate: worldAsOfDate,
              salaryCapYear,
            });
            return [
              playerId,
              playerId === 'a_out'
                ? {
                    ...ready,
                    status: 'needs-input' as const,
                    method: null,
                    currentSalary: null,
                    outgoingSalary: null,
                    incomingSalary: null,
                    canonLeafIds: [],
                    reasons: [
                      'This Contract has a trade bonus whose allocation is outside this governed tranche.',
                    ],
                    proof: null,
                  }
                : ready,
            ];
          })
        )
    );

    const result = await applyWorldMutation({
      userId: 'user_1',
      worldId: 'world_1',
      seasonId: '2026-27',
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'TMA',
            sends: [
              { ...makePlayer('a_out', 10_000_000), tradeTo: 'TMB' },
            ],
            entitlementsOut: [],
            salaryMatchingElection: {
              version: 1,
              path: 'ROOM',
              postAssignmentApronTeamSalary: 11_000_000,
              tradedPlayerPreTradeSalaries: { a_out: 10_000_000 },
            },
          },
          {
            teamCode: 'TMB',
            sends: [
              { ...makePlayer('b_out', 10_000_000), tradeTo: 'TMA' },
            ],
            entitlementsOut: [],
            salaryMatchingElection: {
              version: 1,
              path: 'ROOM',
              postAssignmentApronTeamSalary: 11_000_000,
              tradedPlayerPreTradeSalaries: { b_out: 10_000_000 },
            },
          },
        ],
        asOfDate: '2026-08-25T12:00:00-04:00',
        tradeCtx: {
          source: 'tradeMachine',
          worldId: 'world_1',
          asOfDate: '2026-08-25T12:00:00-04:00',
          yearKey: '2026-27',
        },
      },
    });

    expect(result).toMatchObject({
      success: false,
      appliedToLocalState: false,
      persistedToWorld: false,
    });
    expect(JSON.stringify(result)).toMatch(/trade bonus whose allocation/i);
    expect(firestoreMocks.writeBatch).not.toHaveBeenCalled();
    expect(firestoreMocks.commit).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'numeric round on the exact discriminator shape',
      entitlementId: 'TMA_2029_R1',
      entitlement: { year: 2029, round: 1 },
    },
    {
      label: 'string round alias in another draft year',
      entitlementId: 'TMA_2031_FIRST',
      entitlement: { seasonYear: 2031, round: 'first round' },
    },
    {
      label: 'embedded round classification in another draft year',
      entitlementId: 'TMA_2032_TERMS',
      entitlement: { seasonYear: 2032, terms: { round: '1st' } },
    },
  ])(
    'rejects $label before any saved-world write',
    async ({ entitlementId, entitlement }) => {
      teamLoaderMocks.getTeam.mockImplementation(async (_worldId, teamCode) => {
        const playerId = teamCode === 'TMA' ? 'a_out' : 'b_out';
        return withGovernedSalaryBooks(
          {
            ...makeTeam(teamCode, [makePlayer(playerId, 10_000_000)]),
            entitlementIds: teamCode === 'TMA' ? [entitlementId] : [],
          },
          {
            salaryCapYear: 2027,
            asOfDate: '2026-08-24T12:00:00-04:00',
            teamSalary: 10_000_000,
            apronTeamSalary: 11_000_000,
            taxSalary: 12_000_000,
          }
        );
      });

      const result = await applyWorldMutation({
        userId: 'user_1',
        worldId: 'world_1',
        seasonId: '2026-27',
        mutationType: 'executeTrade',
        payload: {
          teams: [
            {
              teamCode: 'TMA',
              sends: [
                { ...makePlayer('a_out', 10_000_000), tradeTo: 'TMB' },
              ],
              entitlementsOut: [
                {
                  id: entitlementId,
                  entitlementId,
                  ...entitlement,
                  toTeamId: 'TMB',
                },
              ],
              salaryMatchingElection: {
                version: 1,
                path: 'ROOM',
                postAssignmentApronTeamSalary: 0,
                tradedPlayerPreTradeSalaries: { a_out: 10_000_000 },
              },
            },
            {
              teamCode: 'TMB',
              sends: [
                { ...makePlayer('b_out', 10_000_000), tradeTo: 'TMA' },
              ],
              entitlementsOut: [],
              salaryMatchingElection: {
                version: 1,
                path: 'ROOM',
                postAssignmentApronTeamSalary: 0,
                tradedPlayerPreTradeSalaries: { b_out: 10_000_000 },
              },
            },
          ],
          asOfDate: '2026-08-25T12:00:00-04:00',
          tradeCtx: {
            source: 'tradeMachine',
            worldId: 'world_1',
            asOfDate: '2026-08-25T12:00:00-04:00',
            yearKey: '2026-27',
          },
        },
      });

      expect(result).toMatchObject({
        success: false,
        appliedToLocalState: false,
        persistedToWorld: false,
      });
      expect(JSON.stringify(result)).toMatch(/Needs input/i);
      expect(JSON.stringify(result)).toMatch(/Stepien/i);
      expect(firestoreMocks.writeBatch).not.toHaveBeenCalled();
      expect(firestoreMocks.commit).not.toHaveBeenCalled();
    }
  );
});
