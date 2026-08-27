import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as firestore from 'firebase/firestore';
import * as postStateValidator from '@/features/architect/utils/capLegality/postStateCapValidator';
import {
  getAllMockData,
  getMockData,
  resetMockDataStore,
  seedMockData,
  failMockBatchCommitAfter,
} from '../__mocks__/firebase';
import { withDerivedGovernedSalaryBooks } from '@/tests/fixtures/governedSalaryBookInputs';
import { advanceSeasonInWorld } from '@/features/architect/utils/seasonManager';
import { resolveSeasonAdvanceAuthority } from '@/features/architect/utils/seasonManager.authority';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { validateNonTradeMutationStage } from '@/features/architect/utils/nonTradeMutationValidationStage';
import { CANON_GOVERNED_SEASON_REGISTRY } from '@/features/architect/utils/governedSeason';
import {
  createContractEventLedger,
  toContractEventLedgerPayload,
} from '@/features/architect/utils/contractHistory';
import {
  makeEvent,
  makeResultingState,
} from './contractHistory/contractHistoryFixtures';

const TEAM_CODES = [
  'ATL',
  'BOS',
  'BKN',
  'CHA',
  'CHI',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GSW',
  'HOU',
  'IND',
  'LAC',
  'LAL',
  'MEM',
  'MIA',
  'MIL',
  'MIN',
  'NOP',
  'NYK',
  'OKC',
  'ORL',
  'PHI',
  'PHX',
  'POR',
  'SAC',
  'SAS',
  'TOR',
  'UTA',
  'WAS',
] as const;

const WORLD_ID = 'world_governed_season_advance';
const TRANSITION_ID = 'seasonAdvance__2025-26__2026-27';
const seededTeamDocuments = new Map<string, unknown>();

function worldMetadata(overrides: Record<string, unknown> = {}) {
  return {
    worldId: WORLD_ID,
    worldName: 'Governed Season Advance',
    createdBy: 'user_test',
    currentSeason: '2025-26',
    baselineSeason: '2025-26',
    asOfDate: '2026-04-12',
    actionCount: 0,
    lastModifiedTeams: [],
    ...overrides,
  };
}

function teamSnapshot(
  teamCode: string,
  overrides: Record<string, unknown> = {}
) {
  const players = Array.from({ length: 13 }, (_value, index) => ({
    playerId: `${teamCode}_p${index + 1}`,
    displayName: `${teamCode} Player ${index + 1}`,
    teamCode,
    contract: {
      contractId: `${teamCode}_contract_${index + 1}`,
      yearsRemaining: 2,
      salariesByYear: [
        {
          season: '2025-26',
          salary: 1_000_000,
          capHit: 1_000_000,
          guaranteed: true,
        },
        {
          season: '2026-27',
          salary: 1_100_000,
          capHit: 1_100_000,
          guaranteed: true,
        },
      ],
    },
  }));
  return withDerivedGovernedSalaryBooks(
    {
      teamCode,
      teamName: `Team ${teamCode}`,
      abbreviation: teamCode,
      season: '2025-26',
      roster: players.map((player) => player.playerId),
      players,
      capHolds: [],
      deadCap: [],
      draftPicks: [],
      draftPicksInventory: [],
      draftPicksObligations: [],
      draftPicksContested: [],
      entitlementIds: [],
      offerSheets: [],
      incomingOfferSheets: [],
      exceptions: {},
      totals: {},
      ...overrides,
    },
    {
      salaryCapYear: 2027,
      asOfDate: '2026-07-01T00:00:00-04:00',
      apronDelta: 100,
      taxDelta: 200,
    }
  );
}

function seedLeague(
  args: {
    metadata?: Record<string, unknown>;
    omitTeam?: string;
    mutateTeam?: (
      teamCode: string,
      team: Record<string, unknown>
    ) => Record<string, unknown>;
  } = {}
) {
  seededTeamDocuments.clear();
  seedMockData(`architect_worlds/${WORLD_ID}`, worldMetadata(args.metadata));
  for (const teamCode of TEAM_CODES) {
    const path = `architect_worlds/${WORLD_ID}/teams/${teamCode}`;
    if (teamCode === args.omitTeam) {
      seededTeamDocuments.set(teamCode, undefined);
      continue;
    }
    const original = teamSnapshot(teamCode) as Record<string, unknown>;
    seedMockData(path, args.mutateTeam?.(teamCode, original) ?? original);
    seededTeamDocuments.set(teamCode, getMockData(path));
  }
}

function persistedWorldPaths() {
  return [...getAllMockData().keys()].filter((path) =>
    path.startsWith(`architect_worlds/${WORLD_ID}`)
  );
}

function expectNoTransitionWrites() {
  for (const teamCode of TEAM_CODES) {
    expect(
      getMockData(`architect_worlds/${WORLD_ID}/teams/${teamCode}`)
    ).toEqual(seededTeamDocuments.get(teamCode));
  }
  expect(
    getMockData(
      `architect_worlds/${WORLD_ID}/seasonTransitions/${TRANSITION_ID}`
    )
  ).toBeUndefined();
  expect(
    persistedWorldPaths().some((path) => path.includes('/seasonHistory/'))
  ).toBe(false);
  expect(
    getMockData(`architect_worlds/${WORLD_ID}/events/${TRANSITION_ID}`)
  ).toBeUndefined();
  expect(
    (getMockData(`architect_worlds/${WORLD_ID}`) as Record<string, unknown>)
      .currentSeason
  ).toBe('2025-26');
}

describe('governed Season Advance authority', () => {
  it('resolves the one supported source close and complete target envelope', () => {
    const result = resolveSeasonAdvanceAuthority({
      worldId: WORLD_ID,
      worldSeason: '2025-26',
      worldAsOfDate: '2026-04-12',
    });
    expect(result.status).toBe('complete');
    if (result.status !== 'complete') return;
    expect(result.authority.toSeason).toBe('2026-27');
    expect(result.authority.transitionEffectiveAt).toBe(
      '2026-07-01T00:00:00-04:00'
    );
    expect(result.authority.entitlementBoundary).toEqual(
      expect.objectContaining({
        mode: 'preserve-or-fail-closed',
        unavailableCanonLeafId: 'CBA2-A12.3',
      })
    );
  });

  it.each([
    ['missing inputs', null, null],
    ['wrong year', '2024-25', '2025-04-13'],
    ['malformed date', '2025-26', '04/12/2026'],
    ['stale date', '2025-26', '2026-04-11'],
    ['unavailable target', '2026-27', '2027-04-11'],
  ])('fails closed on %s', (_label, season, asOfDate) => {
    const result = resolveSeasonAdvanceAuthority({
      worldId: WORLD_ID,
      worldSeason: season,
      worldAsOfDate: asOfDate,
    });
    expect(result.status).toBe('unavailable');
  });

  it('fails closed on conflicting current calendar records', () => {
    const source = CANON_GOVERNED_SEASON_REGISTRY.calendars.find(
      (calendar) => calendar.seasonKey === '2025-26'
    );
    expect(source).toBeDefined();
    const result = resolveSeasonAdvanceAuthority({
      worldId: WORLD_ID,
      worldSeason: '2025-26',
      worldAsOfDate: '2026-04-12',
      registry: {
        ...CANON_GOVERNED_SEASON_REGISTRY,
        calendars: [
          ...CANON_GOVERNED_SEASON_REGISTRY.calendars,
          { ...source!, recordId: 'CONFLICTING-CALENDAR' },
        ],
      },
    });
    expect(result).toEqual(expect.objectContaining({ status: 'unavailable' }));
  });
});

describe('governed 30-team Season Advance persistence', () => {
  beforeEach(() => {
    resetMockDataStore();
  });

  it('commits 30 teams, immutable history, manifest, event, and exact reload state', async () => {
    seedLeague({
      mutateTeam: (teamCode, team) =>
        teamCode === 'MIA'
          ? {
              ...team,
              id: 'hydrated-mia',
              activeContracts: [{ playerId: 'MIA_p1' }],
              draftAssets: { derived: true },
              baseline: { source: 'base-doc' },
              _derivedDraftPicks: [{ id: 'derived-pick' }],
              source: { layer: 'world' },
              _meta: { totalsSource: 'fixture' },
            }
          : team,
    });
    const result = await advanceSeasonInWorld(WORLD_ID, {
      fromSeason: '2025-26',
      toSeason: '2026-27',
      optionDecisions: {},
      focusTeamCode: 'MIA',
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error);
    expect(result.updatedTeams).toHaveLength(30);
    expect(result.draftResolutionInfo).toEqual({
      draftYear: 2026,
      hadPositions: false,
    });
    const metadata = getMockData(`architect_worlds/${WORLD_ID}`) as Record<
      string,
      unknown
    >;
    expect(metadata.currentSeason).toBe('2026-27');
    expect(metadata.currentYear).toBe(2027);
    expect(metadata.asOfDate).toBe('2026-07-01');
    expect(metadata.actionCount).toBe(1);

    const manifest = getMockData(
      `architect_worlds/${WORLD_ID}/seasonTransitions/${TRANSITION_ID}`
    ) as Record<string, unknown>;
    expect(manifest).toEqual(
      expect.objectContaining({
        fromSeason: '2025-26',
        toSeason: '2026-27',
      })
    );
    expect(manifest.teamRecords).toHaveLength(30);
    expect(
      persistedWorldPaths().filter((path) => path.includes('/seasonHistory/'))
    ).toHaveLength(30);

    const miaHistory = getMockData(
      `architect_worlds/${WORLD_ID}/seasonHistory/2025-26__MIA`
    ) as Record<string, unknown>;
    expect(miaHistory.finalRoster).toHaveLength(13);
    expect(miaHistory.finalRoster).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ playerId: 'MIA_p1' }),
      ])
    );
    expect(miaHistory.preAdvanceState).toEqual(
      expect.objectContaining({
        season: '2025-26',
        roster: expect.arrayContaining(['MIA_p1']),
      })
    );
    expect(miaHistory.contractEvents).toHaveLength(13);
    const persistedMia = getMockData(
      `architect_worlds/${WORLD_ID}/teams/MIA`
    ) as Record<string, unknown>;
    expect(persistedMia.season).toBe('2026-27');
    expect(persistedMia).not.toHaveProperty('id');
    expect(persistedMia).not.toHaveProperty('activeContracts');
    expect(persistedMia).not.toHaveProperty('draftAssets');
    expect(persistedMia).not.toHaveProperty('baseline');
    expect(persistedMia).not.toHaveProperty('_derivedDraftPicks');
    expect(persistedMia).toEqual(
      expect.objectContaining({
        source: { layer: 'world' },
        _meta: { totalsSource: 'fixture' },
      })
    );
    expect(result.committedState.focusTeamSnapshot).toEqual(
      expect.objectContaining({
        teamCode: 'MIA',
      })
    );
    expect(result.committedState.focusTeamSnapshot).not.toHaveProperty(
      'source'
    );
    expect(result.committedState.focusTeamSnapshot).not.toHaveProperty('_meta');
    expect(
      (persistedMia.totals as Record<string, unknown>).salaryBooks
    ).toEqual(expect.objectContaining({ status: 'complete' }));
    expect(
      getMockData(`architect_worlds/${WORLD_ID}/events/${TRANSITION_ID}`)
    ).toEqual(expect.objectContaining({ type: 'seasonAdvance' }));
  });

  it('recomputes and persists the governed target-year roster result during Season Advance', async () => {
    seedLeague({
      mutateTeam: (teamCode, team) => {
        if (teamCode !== 'MIA') return team;
        const salaryBookInputs = {
          ...(team.salaryBookInputs as Record<string, unknown>),
        };
        delete salaryBookInputs.incompleteRosterCharge;
        return {
          ...team,
          salaryBookInputs: {
            ...salaryBookInputs,
            unsignedFirstRoundPickState: {
              version: 1,
              status: 'ready',
              teamCode: 'MIA',
              salaryCapYear: 2027,
              entries: [],
              source: {
                evidenceId: 'bze-293:season-advance:MIA:2027:none',
                evidenceVersion: 1,
                authority: 'external-determination',
                reference: 'authenticated-test-team-state:none',
                authenticatedAt: '2026-07-01T00:00:00-04:00',
                recordStatus: 'current',
                canonLeafIds: ['CBA2-C02.1', 'CBA2-C03.1'],
              },
            },
          },
        };
      },
    });

    const result = await advanceSeasonInWorld(WORLD_ID);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error);
    const metadata = getMockData(
      `architect_worlds/${WORLD_ID}`
    ) as Record<string, unknown>;
    expect(metadata.asOfDate).toBe('2026-07-01');
    const persistedMia = getMockData(
      `architect_worlds/${WORLD_ID}/teams/MIA`
    ) as Record<string, unknown> & { totals?: Record<string, unknown> };
    expect(persistedMia.totals?.incompleteRosterResolution).toMatchObject({
      mode: 'governed',
      status: 'complete',
      activeWindow: true,
      counts: { underContract: 13, total: 13 },
      missingSlots: 0,
      amount: 0,
    });
    expect(persistedMia.totals?.salaryBooks).toMatchObject({
      status: 'complete',
    });

    const recomputedTotals = createCanonicalTeamTotalsSnapshot(
      persistedMia,
      2027,
      { asOfDate: String(metadata.asOfDate) }
    );
    expect(recomputedTotals.incompleteRosterResolution).toEqual(
      persistedMia.totals?.incompleteRosterResolution
    );
    expect(JSON.parse(JSON.stringify(recomputedTotals.salaryBooks))).toEqual(
      persistedMia.totals?.salaryBooks
    );

    const firstPlayer = (persistedMia.players as Array<Record<string, unknown>>)[0];
    const gate = validateNonTradeMutationStage({
      mutationType: 'waivePlayer',
      payload: { stretch: false },
      currentState: { team: persistedMia, player: firstPlayer },
      computeResult: {
        success: true,
        teamUpdates: [
          {
            teamCode: 'MIA',
            team: { ...persistedMia, totals: recomputedTotals },
          },
        ],
      },
      seasonId: '2026-27',
      asOfDate: String(metadata.asOfDate),
      dateDefaulted: false,
      worldId: WORLD_ID,
    });
    expect(gate.violations?.join(' ') ?? '').not.toContain(
      'governed_incomplete_roster_books_required'
    );
  });

  it('rolls one complete explicit option decision backed by immutable event authority', async () => {
    seedLeague({
      mutateTeam: (teamCode, team) => {
        if (teamCode !== 'MIA') return team;
        const players = team.players as Array<Record<string, unknown>>;
        const player = players[0];
        const contract = player.contract as Record<string, unknown>;
        const rows = contract.salariesByYear as Array<Record<string, unknown>>;
        const contractId = String(contract.contractId);
        const state = (contractVersion: number) =>
          makeResultingState({
            contractId,
            contractVersion,
            playerId: 'MIA_p1',
            teamId: 'MIA',
          });
        const root = makeEvent({
          eventId: 'mia-option-root',
          eventKind: 'signing',
          worldId: WORLD_ID,
          contractId,
          playerId: 'MIA_p1',
          teamId: 'MIA',
          executedAt: '2025-07-01T12:00:00-04:00',
          effectiveAt: '2025-07-01T12:00:00-04:00',
          recordedAt: '2025-07-01T12:00:00-04:00',
          predecessorContractVersion: null,
          predecessorEventId: null,
          resultingContractVersion: 1,
          resultingState: state(1),
        });
        const exercise = makeEvent({
          eventId: 'mia-option-exercise',
          eventKind: 'option-exercise',
          worldId: WORLD_ID,
          contractId,
          playerId: 'MIA_p1',
          teamId: 'MIA',
          executedAt: '2026-06-29T12:00:00-04:00',
          effectiveAt: '2026-06-29T12:00:00-04:00',
          recordedAt: '2026-06-29T12:00:00-04:00',
          predecessorContractVersion: 1,
          predecessorEventId: root.eventId,
          resultingContractVersion: 2,
          resultingState: state(2),
        });
        return {
          ...team,
          players: [
            {
              ...player,
              contract: {
                ...contract,
                salariesByYear: rows.map((row) =>
                  row.season === '2026-27'
                    ? { ...row, option: 'Player Option' }
                    : row
                ),
              },
            },
            ...players.slice(1),
          ],
          contractEventLedgers: [
            toContractEventLedgerPayload(
              createContractEventLedger({
                ledgerId: 'mia-option-ledger',
                ledgerVersion: 1,
                events: [root, exercise],
              })
            ),
          ],
        };
      },
    });
    const result = await advanceSeasonInWorld(WORLD_ID, {
      optionDecisions: {
        MIA_p1: {
          decision: 'exercise',
          optionType: 'player',
          season: '2026-27',
        },
      },
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error);
    expect(result.summary.exercisedOptions).toHaveLength(1);
    const miaHistory = getMockData(
      `architect_worlds/${WORLD_ID}/seasonHistory/2025-26__MIA`
    ) as Record<string, unknown>;
    const contractEvents = miaHistory.contractEvents as Array<
      Record<string, unknown>
    >;
    expect(contractEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventKind: 'option-exercised',
          sourceContractEvent: expect.objectContaining({
            eventId: 'mia-option-exercise',
          }),
        }),
      ])
    );
  });

  it.each([
    [
      'missing Apron measurement',
      (team: Record<string, unknown>) => {
        const inputs = {
          ...(team.salaryBookInputs as Record<string, unknown>),
        };
        delete inputs.seasonCloseApronMeasurement;
        return { ...team, salaryBookInputs: inputs };
      },
    ],
    [
      'wrong-year Apron measurement',
      (team: Record<string, unknown>) => {
        const inputs = team.salaryBookInputs as Record<string, unknown>;
        return {
          ...team,
          salaryBookInputs: {
            ...inputs,
            seasonCloseApronMeasurement: {
              ...(inputs.seasonCloseApronMeasurement as Record<
                string,
                unknown
              >),
              salaryCapYear: 2025,
            },
          },
        };
      },
    ],
    [
      'malformed Apron source',
      (team: Record<string, unknown>) => {
        const inputs = team.salaryBookInputs as Record<string, unknown>;
        const measurement = inputs.seasonCloseApronMeasurement as Record<
          string,
          unknown
        >;
        return {
          ...team,
          salaryBookInputs: {
            ...inputs,
            seasonCloseApronMeasurement: {
              ...measurement,
              source: {
                ...(measurement.source as Record<string, unknown>),
                sourceArtifactSha256: 'not-a-hash',
              },
            },
          },
        };
      },
    ],
    [
      'incorrect Apron source identity',
      (team: Record<string, unknown>) => {
        const inputs = team.salaryBookInputs as Record<string, unknown>;
        const measurement = inputs.seasonCloseApronMeasurement as Record<
          string,
          unknown
        >;
        return {
          ...team,
          salaryBookInputs: {
            ...inputs,
            seasonCloseApronMeasurement: {
              ...measurement,
              source: {
                ...(measurement.source as Record<string, unknown>),
                sourceField: 'genericApronTeamSalary',
              },
            },
          },
        };
      },
    ],
    [
      'unavailable A12.3 Apron source claim',
      (team: Record<string, unknown>) => {
        const inputs = team.salaryBookInputs as Record<string, unknown>;
        const measurement = inputs.seasonCloseApronMeasurement as Record<
          string,
          unknown
        >;
        return {
          ...team,
          salaryBookInputs: {
            ...inputs,
            seasonCloseApronMeasurement: {
              ...measurement,
              source: {
                ...(measurement.source as Record<string, unknown>),
                canonLeafIds: ['CBA2-L08.1', 'CBA2-A12.3'],
              },
            },
          },
        };
      },
    ],
    [
      'incomplete Tax book',
      (team: Record<string, unknown>) => ({
        ...team,
        salaryBookInputs: {
          ...(team.salaryBookInputs as Record<string, unknown>),
          taxSalary: {
            status: 'needs-input',
            missingInputs: ['last-game-baseline'],
            reason: 'Fixture intentionally incomplete.',
          },
        },
      }),
    ],
  ])('aborts before every write on %s', async (_label, mutate) => {
    seedLeague({
      mutateTeam: (teamCode, team) =>
        teamCode === 'MIA' ? mutate(team) : team,
    });
    const result = await advanceSeasonInWorld(WORLD_ID);
    expect(result.success).toBe(false);
    expectNoTransitionWrites();
  });

  it('aborts on partial league state before every write', async () => {
    seedLeague({ omitTeam: 'WAS' });
    const result = await advanceSeasonInWorld(WORLD_ID);
    expect(result.success).toBe(false);
    expectNoTransitionWrites();
  });

  it('aborts when draft positions require unavailable entitlement transitions', async () => {
    seedLeague({
      metadata: {
        draftPositionsByYear: {
          2026: {
            positionsMap: { MIA: 15 },
            method: 'manual',
            updatedAtIso: '2026-04-13T00:00:00Z',
          },
        },
      },
    });
    const result = await advanceSeasonInWorld(WORLD_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/entitlement transition/i);
    expectNoTransitionWrites();
  });

  it('aborts an incomplete or unsupported option decision before every write', async () => {
    seedLeague({
      mutateTeam: (teamCode, team) => {
        if (teamCode !== 'MIA') return team;
        const players = team.players as Array<Record<string, unknown>>;
        const contract = players[0].contract as Record<string, unknown>;
        const rows = contract.salariesByYear as Array<Record<string, unknown>>;
        return {
          ...team,
          players: [
            {
              ...players[0],
              contract: {
                ...contract,
                salariesByYear: rows.map((row) =>
                  row.season === '2026-27'
                    ? { ...row, option: 'Player Option' }
                    : row
                ),
              },
            },
          ],
        };
      },
    });
    const result = await advanceSeasonInWorld(WORLD_ID, {
      optionDecisions: {},
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/option decisions are incomplete/i);
    expectNoTransitionWrites();
  });

  it('aborts conflicting extra option decisions before every write', async () => {
    seedLeague();
    const result = await advanceSeasonInWorld(WORLD_ID, {
      optionDecisions: {
        not_a_current_option: {
          decision: 'exercise',
          optionType: 'team',
          season: '2026-27',
        },
      },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unsupported extras/i);
    expectNoTransitionWrites();
  });

  it('aborts when an explicit decision lacks immutable contract-event authority', async () => {
    seedLeague({
      mutateTeam: (teamCode, team) => {
        if (teamCode !== 'MIA') return team;
        const players = team.players as Array<Record<string, unknown>>;
        const contract = players[0].contract as Record<string, unknown>;
        const rows = contract.salariesByYear as Array<Record<string, unknown>>;
        return {
          ...team,
          players: [
            {
              ...players[0],
              contract: {
                ...contract,
                salariesByYear: rows.map((row) =>
                  row.season === '2026-27'
                    ? { ...row, option: 'Player Option' }
                    : row
                ),
              },
            },
            ...players.slice(1),
          ],
        };
      },
    });
    const result = await advanceSeasonInWorld(WORLD_ID, {
      optionDecisions: {
        MIA_p1: {
          decision: 'exercise',
          optionType: 'player',
          season: '2026-27',
        },
      },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/immutable governed contract event/i);
    expectNoTransitionWrites();
  });

  it('aborts when a changed contract cannot retain complete event identity', async () => {
    seedLeague({
      mutateTeam: (teamCode, team) => {
        if (teamCode !== 'MIA') return team;
        const players = team.players as Array<Record<string, unknown>>;
        const contract = players[0].contract as Record<string, unknown>;
        const { contractId: _contractId, ...contractWithoutId } = contract;
        return {
          ...team,
          players: [
            { ...players[0], contract: contractWithoutId },
            ...players.slice(1),
          ],
        };
      },
    });
    const result = await advanceSeasonInWorld(WORLD_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/contract-event identity is unavailable/i);
    expectNoTransitionWrites();
  });

  it('aborts an oversized immutable team/history document before every write', async () => {
    seedLeague({
      mutateTeam: (teamCode, team) =>
        teamCode === 'MIA'
          ? { ...team, teamName: `MIA ${'x'.repeat(900_000)}` }
          : team,
    });
    const transactionSpy = vi.spyOn(firestore, 'runTransaction');
    try {
      const result = await advanceSeasonInWorld(WORLD_ID);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/safe Firestore document limit/i);
      expect(transactionSpy).not.toHaveBeenCalled();
      expectNoTransitionWrites();
    } finally {
      transactionSpy.mockRestore();
    }
  });

  it('aborts a partial roster/team transition before every write', async () => {
    seedLeague({
      mutateTeam: (teamCode, team) =>
        teamCode === 'MIA'
          ? {
              ...team,
              players: (team.players as unknown[]).slice(0, 1),
              roster: (team.roster as unknown[]).slice(0, 1),
            }
          : team,
    });
    const result = await advanceSeasonInWorld(WORLD_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/minimum offseason roster/i);
    expectNoTransitionWrites();
  });

  it('aborts an incorrect prior-season final-roster capture before every write', async () => {
    seedLeague({
      mutateTeam: (teamCode, team) =>
        teamCode === 'MIA'
          ? {
              ...team,
              roster: [
                'MIA_wrong_player',
                ...(team.roster as unknown[]).slice(1),
              ],
            }
          : team,
    });
    const result = await advanceSeasonInWorld(WORLD_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/final roster is incomplete or conflicting/i);
    expectNoTransitionWrites();
  });

  it('aborts before every write when final 30-team post-state reconciliation fails', async () => {
    seedLeague();
    const transactionSpy = vi.spyOn(firestore, 'runTransaction');
    const validationSpy = vi
      .spyOn(postStateValidator, 'validatePostStateCapLegality')
      .mockReturnValueOnce({
        valid: false,
        violations: [
          {
            code: 'TOTALS_NON_FINITE',
            teamCode: 'MIA',
            path: 'afterTotalsByTeam.MIA.teamSalary',
            message: 'Final Team Salary is not finite.',
          },
        ],
        warnings: [],
      });
    try {
      const result = await advanceSeasonInWorld(WORLD_ID);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Post-state cap validation failed');
      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'TOTALS_NON_FINITE' }),
        ])
      );
      expect(transactionSpy).not.toHaveBeenCalled();
      expectNoTransitionWrites();
    } finally {
      validationSpy.mockRestore();
      transactionSpy.mockRestore();
    }
  });

  it('aborts a stale concurrent world mutation before every write', async () => {
    seedLeague();
    const originalRunTransaction = firestore.runTransaction;
    const transactionSpy = vi
      .spyOn(firestore, 'runTransaction')
      .mockImplementationOnce(async (db, updateFunction, options) => {
        seedMockData(
          `architect_worlds/${WORLD_ID}`,
          worldMetadata({ actionCount: 7, concurrentMarker: 'changed' })
        );
        return originalRunTransaction(db, updateFunction, options);
      });
    try {
      const result = await advanceSeasonInWorld(WORLD_ID);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/stale\/concurrent world mutation/i);
      expectNoTransitionWrites();
    } finally {
      transactionSpy.mockRestore();
    }
  });

  it('aborts a team mutation that races the league load before every write', async () => {
    seedLeague();
    const originalGetDocs = firestore.getDocs;
    const getDocsSpy = vi
      .spyOn(firestore, 'getDocs')
      .mockImplementationOnce(async (query) => {
        const result = await originalGetDocs(query);
        const miaPath = `architect_worlds/${WORLD_ID}/teams/MIA`;
        seedMockData(miaPath, {
          ...(getMockData(miaPath) as Record<string, unknown>),
          teamName: 'Concurrent MIA mutation',
        });
        seededTeamDocuments.set('MIA', getMockData(miaPath));
        return result;
      });
    try {
      const result = await advanceSeasonInWorld(WORLD_ID);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/stale\/concurrent team mutation.*MIA/i);
      expectNoTransitionWrites();
    } finally {
      getDocsSpy.mockRestore();
    }
  });

  it('commits nothing when the transaction commit fails', async () => {
    seedLeague();
    failMockBatchCommitAfter(0, new Error('atomic commit rejected'));
    const result = await advanceSeasonInWorld(WORLD_ID);
    expect(result.success).toBe(false);
    expectNoTransitionWrites();
  });

  it('reports exact reload and cross-room event divergence after commit', async () => {
    seedLeague();
    const originalRunTransaction = firestore.runTransaction;
    const transactionSpy = vi
      .spyOn(firestore, 'runTransaction')
      .mockImplementationOnce(async (db, updateFunction, options) => {
        const transactionResult = await originalRunTransaction(
          db,
          updateFunction,
          options
        );
        const eventPath = `architect_worlds/${WORLD_ID}/events/${TRANSITION_ID}`;
        seedMockData(eventPath, {
          ...(getMockData(eventPath) as Record<string, unknown>),
          afterTotalsByTeam: { MIA: { teamSalary: -1 } },
        });
        return transactionResult;
      });
    try {
      const result = await advanceSeasonInWorld(WORLD_ID);
      expect(result.success).toBe(true);
      if (!result.success) throw new Error(result.error);
      expect(result.persistenceConfirmed).toBe(false);
      expect(result.confirmationError).toMatch(
        /exact reload verification diverged/i
      );
      expect(
        (
          getMockData(`architect_worlds/${WORLD_ID}`) as Record<
            string,
            unknown
          >
        ).currentSeason
      ).toBe('2026-27');
      expect(
        getMockData(
          `architect_worlds/${WORLD_ID}/seasonTransitions/${TRANSITION_ID}`
        )
      ).toBeDefined();
    } finally {
      transactionSpy.mockRestore();
    }
  });

  it('rejects a duplicate/replayed transition without changing the committed result', async () => {
    seedLeague();
    const first = await advanceSeasonInWorld(WORLD_ID);
    expect(first.success).toBe(true);
    const manifestBefore = getMockData(
      `architect_worlds/${WORLD_ID}/seasonTransitions/${TRANSITION_ID}`
    );
    seedMockData(
      `architect_worlds/${WORLD_ID}`,
      worldMetadata({ actionCount: 1 })
    );
    const second = await advanceSeasonInWorld(WORLD_ID);
    expect(second.success).toBe(false);
    expect(second.error).toBe(
      'Duplicate/replayed Season Advance: immutable history 2025-26__ATL already exists.'
    );
    expect(
      persistedWorldPaths().filter((path) => path.includes('/seasonHistory/'))
    ).toHaveLength(30);
    expect(
      getMockData(
        `architect_worlds/${WORLD_ID}/seasonTransitions/${TRANSITION_ID}`
      )
    ).toEqual(manifestBefore);
  });
});
