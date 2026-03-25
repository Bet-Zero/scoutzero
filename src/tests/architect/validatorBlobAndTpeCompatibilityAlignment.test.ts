import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  TradeTeamResult,
  TradeValidationResult,
} from '@/features/architect/utils/tradeMachine/constants/types';

const harness = vi.hoisted(() => ({
  validateTradeMock: vi.fn(),
}));

vi.mock('@/firebaseConfig', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  getDoc: vi.fn(),
  writeBatch: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  collection: vi.fn((_db: unknown, ...segments: string[]) => segments.join('/')),
  doc: vi.fn((_db: unknown, ...segments: string[]) => segments.join('/')),
}));

vi.mock('@/features/architect/utils/tradeMachine', async () => {
  const actual =
    await vi.importActual<
      typeof import('@/features/architect/utils/tradeMachine')
    >('@/features/architect/utils/tradeMachine');

  return {
    ...actual,
    validateTrade: harness.validateTradeMock,
  };
});

import {
  computeWorldMutation,
} from '@/features/architect/utils/mutationPipeline';
import {
  buildPostTradeTeamsSnapshot,
} from '@/features/architect/utils/tradeContext';

const SEASON_ID = '2025-26';
const FIXED_TIMESTAMP = Date.parse('2026-03-25T12:00:00.000Z');

function makePlayer(
  id: string,
  name: string,
  salary: number,
  teamCode: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    player_id: id,
    id,
    playerId: id,
    name,
    displayName: name,
    teamCode,
    salary,
    contract: {
      contractType: 'Standard',
      salariesByYear: [
        {
          season: SEASON_ID,
          salary,
          capHit: salary,
          guaranteed: true,
        },
      ],
    },
    ...overrides,
  };
}

function makeTeam(
  teamCode: string,
  players: Array<ReturnType<typeof makePlayer>>,
  overrides: Record<string, unknown> = {}
) {
  const totalSalary = players.reduce(
    (sum, player) => sum + (Number(player.salary) || 0),
    0
  );

  return {
    id: teamCode,
    teamCode,
    teamName: `Team ${teamCode}`,
    players,
    roster: players.map((player) => player.player_id),
    twoWayPlayers: [],
    capHolds: [],
    deadCap: [],
    tradeExceptions: [],
    exceptionHistory: [],
    entitlementIds: [],
    exceptions: { tpe: [] },
    totals: {
      totalSalary,
      capHit: totalSalary,
      isHardCapped: false,
    },
    source: { type: 'test-fixture' },
    ...overrides,
  };
}

function makeTeamResult(
  teamCode: string,
  overrides: Partial<TradeTeamResult> = {}
): TradeTeamResult {
  return {
    teamId: teamCode,
    teamCode,
    teamName: `Team ${teamCode}`,
    legal: true,
    violations: [],
    warnings: [],
    rules: {},
    salaryOut: 0,
    salaryIn: 0,
    outgoingPlayers: [],
    incomingPlayers: [],
    calculations: {
      salaryIn: 0,
      salaryOut: 0,
      salaryMatching: {
        allowedIncoming: 0,
        margin: 0,
        difference: 0,
      },
    },
    totalSalary: 0,
    projectedSalary: 0,
    capRoom: 0,
    hardCapped: false,
    apronStatus: 'Below Aprons',
    faExceptionBuckets: [],
    notes: null,
    createdTPE: null,
    details: '',
    warningDetails: '',
    ...overrides,
  };
}

function makeValidationResult(
  teamResults: TradeTeamResult[]
): TradeValidationResult {
  return {
    legal: true,
    valid: true,
    error: null,
    reason: 'Valid trade',
    violations: [],
    warnings: [],
    teamResults,
    summaryByTeamIndex: [],
    performance: {
      validationTime: 1,
    },
    tradeReceipt: null,
    dataWarnings: [],
    hasDataIssues: false,
    yearKey: 2026,
    seasonKey: SEASON_ID,
    capSettings: null,
    capSettingsSource: null,
    capSettingsWarnings: [],
    asOfDate: null,
    tradeDate: null,
    offseason: null,
  };
}

describe('validator blob and TPE compatibility alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps executeTrade working with the narrowed validated trade context bridge', () => {
    const playerA = makePlayer('player-a', 'Player A', 10_000_000, 'LAL');
    const playerB = makePlayer('player-b', 'Player B', 10_000_000, 'BOS');

    harness.validateTradeMock.mockReturnValue(
      makeValidationResult([
        makeTeamResult('LAL'),
        makeTeamResult('BOS'),
      ])
    );

    const result = computeWorldMutation({
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'LAL',
            sends: [{ ...playerA, matchOutgoing: 10_000_000 }],
            receives: [{ ...playerB, matchIncoming: 10_000_000 }],
            entitlementsOut: [],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
          {
            teamCode: 'BOS',
            sends: [{ ...playerB, matchOutgoing: 10_000_000 }],
            receives: [{ ...playerA, matchIncoming: 10_000_000 }],
            entitlementsOut: [],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
        ],
      },
      currentState: {
        teams: [
          { teamCode: 'LAL', team: makeTeam('LAL', [playerA]) },
          { teamCode: 'BOS', team: makeTeam('BOS', [playerB]) },
        ],
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world-alignment',
    });

    expect(result.success).toBe(true);
    expect(result.teamUpdates).toHaveLength(2);
    expect(result._validatedTradeContext?._isValidatedTradeContext).toBe(true);
    expect(result._validatedTradeContext?.legal).toBe(true);
    expect(result._validatedTradeContext?._rawValidation?.teamResults).toHaveLength(
      2
    );
  });

  it('still applies TPE consumption through observable trade results with the narrowed raw-validation slice', () => {
    const absorbingTeamTpe = {
      id: 'tpe-live',
      amount: 10_000_000,
      totalAmount: 10_000_000,
      remainingAmount: 10_000_000,
      usedAmount: 0,
      createdSeason: 2026,
      expiresOn: '2027-07-01',
      createdFrom: 'Existing trade',
    };
    const incomingPlayer = makePlayer('player-in', 'Incoming Player', 6_000_000, 'BOS');

    harness.validateTradeMock.mockReturnValue(
      makeValidationResult([
        makeTeamResult('LAL', {
          rules: {
            tradeExceptions: {
              key: 'tradeExceptions',
              sourceType: 'validator',
              passed: true,
              violations: [],
              warnings: [],
              message: 'TPE usage accepted',
              details: null,
            },
          },
        }),
        makeTeamResult('BOS'),
      ])
    );

    const result = computeWorldMutation({
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'LAL',
            sends: [],
            receives: [
              {
                ...incomingPlayer,
                absorptionMode: 'TPE',
                tpeId: 'tpe-live',
                matchIncoming: 6_000_000,
              },
            ],
            entitlementsOut: [],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
          {
            teamCode: 'BOS',
            sends: [{ ...incomingPlayer, matchOutgoing: 6_000_000 }],
            receives: [],
            entitlementsOut: [],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
        ],
      },
      currentState: {
        teams: [
          {
            teamCode: 'LAL',
            team: makeTeam('LAL', [], {
              tradeExceptions: [absorbingTeamTpe],
            }),
          },
          {
            teamCode: 'BOS',
            team: makeTeam('BOS', [incomingPlayer]),
          },
        ],
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world-alignment',
    });

    const updatedLal = result.teamUpdates?.find(
      (entry) => entry.teamCode === 'LAL'
    )?.team;
    const consumedTpe = updatedLal?.tradeExceptions?.find(
      (entry) => entry.id === 'tpe-live'
    );

    expect(result.success).toBe(true);
    expect(consumedTpe).toMatchObject({
      id: 'tpe-live',
      remainingAmount: 4_000_000,
      usedAmount: 6_000_000,
      isUsed: false,
    });
  });

  it('keeps the local mixed TPE overlap bridge with more-complete and canonical tie-break behavior', () => {
    const lalTeam = makeTeam('LAL', [], {
      tradeExceptions: [
        { id: 'shared', amount: 8_000_000, createdFrom: 'Legacy shared' },
        { id: 'tie', amount: 2_000_000, createdFrom: 'Legacy tie' },
      ],
      exceptions: {
        tpe: [
          {
            id: 'shared',
            amount: 8_000_000,
            remainingAmount: 5_000_000,
            usedAmount: 3_000_000,
            expiresOn: '2027-07-01',
            createdFrom: 'Canonical shared',
          },
          {
            id: 'tie',
            amount: 2_000_000,
            createdFrom: 'Canonical tie',
          },
        ],
      },
    });

    const snapshot = buildPostTradeTeamsSnapshot({
      payload: {
        teams: [
          {
            teamCode: 'LAL',
            sends: [],
            receives: [],
            entitlementsOut: [],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
          {
            teamCode: 'BOS',
            sends: [],
            receives: [],
            entitlementsOut: [],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
        ],
      },
      currentState: {
        teams: [
          { teamCode: 'LAL', team: lalTeam },
          { teamCode: 'BOS', team: makeTeam('BOS', []) },
        ],
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    const updatedLal = snapshot.teamUpdates.find(
      (entry) => entry.teamCode === 'LAL'
    )?.team;
    const shared = updatedLal?.tradeExceptions?.find(
      (entry) => entry.id === 'shared'
    );
    const tie = updatedLal?.tradeExceptions?.find(
      (entry) => entry.id === 'tie'
    );

    expect(updatedLal?.tradeExceptions).toHaveLength(2);
    expect(shared).toMatchObject({
      id: 'shared',
      remainingAmount: 5_000_000,
      usedAmount: 3_000_000,
      createdFrom: 'Canonical shared',
    });
    expect(tie).toMatchObject({
      id: 'tie',
      createdFrom: 'Canonical tie',
    });
  });
});
