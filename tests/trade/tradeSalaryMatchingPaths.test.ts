import { describe, expect, it } from 'vitest';
import {
  evaluateTradeSalaryMatchingPath,
  TRADE_SALARY_ALLOWANCE,
} from '@/features/architect/utils/tradeMachine/utils/tradeSalaryMatchingPaths';
import type {
  TradeSalaryMatchingElection,
  TradeSalaryMatchingPath,
} from '@/schemas/tradeSalaryMatchingPath';
import { validateSalaryMatching } from '@/features/architect/utils/tradeMachine/rules/validateSalaryMatching';
import { validateTradeExceptions } from '@/features/architect/utils/tradeMachine/rules/validateTradeExceptions';
import { applyTradeExceptionLifecycle } from '@/features/architect/utils/tradeMachine/utils/tradeExceptionLifecycle';
import {
  normalizeTeamTpeSchema,
  PERSISTENCE_CONTRACTS,
  validatePersistableShape,
} from '@/features/architect/utils/persistenceContracts';
import { WorldTeamSnapshotZ } from '@/schemas/architect';

const SALARY_CAP = 164_961_000;
const FIRST_APRON = 209_015_000;
const TRANSACTION_DATE = '2026-07-15T12:00:00-04:00';

function election(
  path: TradeSalaryMatchingPath,
  exactSalaries: Record<string, number> = {},
  postAssignmentApronTeamSalary = FIRST_APRON
): TradeSalaryMatchingElection {
  return {
    version: 1,
    path,
    postAssignmentApronTeamSalary,
    tradedPlayerPreTradeSalaries: exactSalaries,
  };
}

function evaluate(
  overrides: Partial<Parameters<typeof evaluateTradeSalaryMatchingPath>[0]>
) {
  return evaluateTradeSalaryMatchingPath({
    election: election('STANDARD_TPE', { outgoing: 10_000_000 }),
    outgoingPlayers: [{ playerId: 'outgoing', playerName: 'Outgoing' }],
    incomingMatchingPlayers: [
      { playerId: 'incoming', playerName: 'Incoming', salary: 10_250_000 },
    ],
    teamSalary: 180_000_000,
    salaryCap: SALARY_CAP,
    firstApron: FIRST_APRON,
    transactionDate: TRANSACTION_DATE,
    salaryCapYear: '2026-27',
    ...overrides,
  });
}

describe('governed Trade Machine salary paths', () => {
  it('accepts an exact governed transaction date without inventing a time', () => {
    expect(evaluate({ transactionDate: '2026-07-15' }).status).toBe('PASS');
  });

  it('fails closed on invalid exact context instead of calculating with it', () => {
    const invalidSalary = evaluate({ teamSalary: Number.NaN });
    const zeroSalary = evaluate({ teamSalary: 0 });
    const invalidDate = evaluate({ transactionDate: '2026-99-99' });
    const supportedEarlyYear = evaluate({ salaryCapYear: 1001 });
    const unsupportedYear = evaluate({ salaryCapYear: 10_000 });

    expect(invalidSalary.missingInputs).toContain('teamSalary');
    expect(zeroSalary.missingInputs).toContain('teamSalary');
    expect(invalidDate.missingInputs).toContain('transactionDate');
    expect(supportedEarlyYear.status).toBe('PASS');
    expect(unsupportedYear.missingInputs).toContain('salaryCapYear');
  });

  it('fails closed when a Traded Player has no verifiable identity', () => {
    const result = evaluate({
      election: election('STANDARD_TPE', { 'player-0': 10_000_000 }),
      outgoingPlayers: [{ playerId: null, playerName: 'Unknown' }],
    });

    expect(result.status).toBe('NEEDS_INPUT');
    expect(result.missingInputs).toContain('outgoingPlayers.0.identity');
    expect(result.missingInputs).not.toContain(
      'tradedPlayerPreTradeSalaries.player-0'
    );
  });

  it('passes Standard TPE at the exact limit and decomposes the component', () => {
    const result = evaluate({});

    expect(result.status).toBe('PASS');
    expect(result.maximumIncoming).toBe(10_250_000);
    expect(result.margin).toBe(0);
    expect(result.canonLeafIds).toEqual([
      'CBA2-A02.1',
      'CBA2-A02.2',
      'CBA2-A02.12',
    ]);
    expect(result.components[0]).toMatchObject({
      kind: 'ELECTED_PATH',
      path: 'STANDARD_TPE',
      usedIncoming: 10_250_000,
      remaining: 0,
    });
  });

  it('fails Standard TPE by the Canon counterfactual $0.01', () => {
    const result = evaluate({
      incomingMatchingPlayers: [
        {
          playerId: 'incoming',
          playerName: 'Incoming',
          salary: 10_250_000.01,
        },
      ],
    });

    expect(result.status).toBe('FAIL');
    expect(result.margin).toBeCloseTo(-0.01, 5);
  });

  it('fails closed when exact pre-trade Salary is missing', () => {
    const result = evaluate({
      election: election('STANDARD_TPE'),
    });

    expect(result.status).toBe('NEEDS_INPUT');
    expect(result.missingInputs).toEqual([
      'tradedPlayerPreTradeSalaries.outgoing',
    ]);
    expect(result.maximumIncoming).toBeNull();
  });

  it('rejects two outgoing players on the Standard path', () => {
    const result = evaluate({
      election: election('STANDARD_TPE', {
        first: 4_000_000,
        second: 6_000_000,
      }),
      outgoingPlayers: [
        { playerId: 'first', playerName: 'First' },
        { playerId: 'second', playerName: 'Second' },
      ],
    });

    expect(result.status).toBe('FAIL');
    expect(result.violations[0]).toMatch(/exactly one Traded Player/);
  });

  it('fails closed on a below-cap Standard election until its separate governed path exists', () => {
    const result = evaluate({ teamSalary: SALARY_CAP - 1 });

    expect(result.status).toBe('FAIL');
    expect(result.maximumIncoming).toBeNull();
    expect(result.violations[0]).toMatch(/unavailable below the Salary Cap/);
  });

  it('passes Aggregated Standard TPE at the exact limit', () => {
    const result = evaluate({
      election: election('AGGREGATED_STANDARD_TPE', {
        first: 4_000_000,
        second: 6_000_000,
      }),
      outgoingPlayers: [
        { playerId: 'first', playerName: 'First' },
        { playerId: 'second', playerName: 'Second' },
      ],
    });

    expect(result.status).toBe('PASS');
    expect(result.maximumIncoming).toBe(10_250_000);
    expect(result.components[0].outgoingPlayers).toHaveLength(2);
  });

  it('fails Aggregated Standard TPE by the Canon counterfactual $0.01', () => {
    const result = evaluate({
      election: election('AGGREGATED_STANDARD_TPE', {
        first: 4_000_000,
        second: 6_000_000,
      }),
      outgoingPlayers: [
        { playerId: 'first', playerName: 'First' },
        { playerId: 'second', playerName: 'Second' },
      ],
      incomingMatchingPlayers: [
        {
          playerId: 'incoming',
          playerName: 'Incoming',
          salary: 10_250_000.01,
        },
      ],
    });

    expect(result.status).toBe('FAIL');
    expect(result.margin).toBeCloseTo(-0.01, 5);
  });

  it('passes Room path at room plus $250,000', () => {
    const result = evaluate({
      election: election('ROOM'),
      outgoingPlayers: [],
      teamSalary: 154_961_000,
    });

    expect(result.status).toBe('PASS');
    expect(result.maximumIncoming).toBe(10_250_000);
    expect(result.components[0]).toMatchObject({
      path: 'ROOM',
      maximumIncoming: 10_250_000,
    });
  });

  it('fails Room path by the Canon counterfactual $0.01', () => {
    const result = evaluate({
      election: election('ROOM'),
      outgoingPlayers: [],
      teamSalary: 154_961_000,
      incomingMatchingPlayers: [
        {
          playerId: 'incoming',
          playerName: 'Incoming',
          salary: 10_250_000.01,
        },
      ],
    });

    expect(result.status).toBe('FAIL');
    expect(result.margin).toBeCloseTo(-0.01, 5);
  });

  it('includes exact outgoing Salary in Room capacity and fails closed without it', () => {
    const positive = evaluate({
      election: election('ROOM', { outgoing: 10_000_000 }),
      teamSalary: SALARY_CAP - 1_000_000,
      incomingMatchingPlayers: [
        { playerId: 'incoming', playerName: 'Incoming', salary: 11_250_000 },
      ],
    });
    const counterfactual = evaluate({
      election: election('ROOM', { outgoing: 10_000_000 }),
      teamSalary: SALARY_CAP - 1_000_000,
      incomingMatchingPlayers: [
        {
          playerId: 'incoming',
          playerName: 'Incoming',
          salary: 11_250_000.01,
        },
      ],
    });
    const missingExactSalary = evaluate({
      election: election('ROOM'),
      teamSalary: SALARY_CAP - 1_000_000,
    });

    expect(positive).toMatchObject({
      status: 'PASS',
      maximumIncoming: 11_250_000,
      margin: 0,
    });
    expect(positive.components[0].outgoingPlayers).toEqual([
      { playerId: 'outgoing', playerName: 'Outgoing', salary: 10_000_000 },
    ]);
    expect(counterfactual.status).toBe('FAIL');
    expect(counterfactual.margin).toBeCloseTo(-0.01, 5);
    expect(missingExactSalary.status).toBe('NEEDS_INPUT');
    expect(missingExactSalary.missingInputs).toEqual([
      'tradedPlayerPreTradeSalaries.outgoing',
    ]);
  });

  it('fails Room path when a held Standard TPE is also used', () => {
    const result = evaluate({
      election: election('ROOM'),
      outgoingPlayers: [],
      teamSalary: 154_961_000,
      heldStandardTpeComponents: [
        {
          tpeId: 'held-tpe',
          capacity: 3_000_000,
          incomingPlayers: [
            { playerId: 'other', playerName: 'Other', salary: 2_000_000 },
          ],
        },
      ],
    });

    expect(result.status).toBe('FAIL');
    expect(result.violations[0]).toMatch(/mutually exclusive/);
  });

  it('retains the allowance at equality and zeroes it only above First Apron', () => {
    const atApron = evaluate({});
    const aboveApron = evaluate({
      election: election(
        'STANDARD_TPE',
        { outgoing: 10_000_000 },
        FIRST_APRON + 0.01
      ),
      incomingMatchingPlayers: [
        { playerId: 'incoming', playerName: 'Incoming', salary: 10_000_000 },
      ],
    });

    expect(atApron.allowance).toBe(TRADE_SALARY_ALLOWANCE);
    expect(aboveApron.allowance).toBe(0);
    expect(aboveApron.maximumIncoming).toBe(10_000_000);
    expect(aboveApron.status).toBe('PASS');
  });

  it('fails closed without an explicit path election', () => {
    const result = evaluate({ election: null });

    expect(result.status).toBe('NEEDS_INPUT');
    expect(result.missingInputs).toEqual(['salaryMatchingElection']);
  });
});

describe('governed salary path lifecycle integration', () => {
  const context = {
    source: 'tradeMachine',
    yearKey: '2026-27',
    tradeDate: TRANSACTION_DATE,
    capSettings: {
      salaryCap: SALARY_CAP,
      firstApron: FIRST_APRON,
      secondApron: 222_000_000,
    },
  };

  it('skips path election only when the participant has no matching salary', () => {
    const result = validateSalaryMatching(
      {
        salaryOut: 0,
        salaryIn: 0,
        teamTotalSalary: 180_000_000,
        outgoingPlayers: [],
        incomingPlayers: [],
      },
      context
    );
    const zeroSalaryPlayer = validateSalaryMatching(
      {
        salaryOut: 0,
        salaryIn: 0,
        teamTotalSalary: 180_000_000,
        outgoingPlayers: [
          { id: 'missing-salary', name: 'Missing Salary', matchOutgoing: 0 },
        ],
        incomingPlayers: [],
      },
      context
    );

    expect(result).toMatchObject({
      passed: true,
      applicable: false,
      skipReason: 'NO_SALARY_MATCHING',
      allowableIncoming: null,
      violations: [],
    });
    expect(result.details.pathEvaluation).toBeNull();
    expect(zeroSalaryPlayer.passed).toBe(false);
    expect(zeroSalaryPlayer.violations[0]).toMatch(/salaryMatchingElection/);
  });

  it('replaces the generic shortcut in live Trade Machine validation', () => {
    const result = validateSalaryMatching(
      {
        salaryOut: 10_000_000,
        salaryIn: 10_250_000,
        teamTotalSalary: 180_000_000,
        outgoingPlayers: [
          { id: 'outgoing', name: 'Outgoing', matchOutgoing: 10_000_000 },
        ],
        incomingPlayers: [
          {
            id: 'incoming',
            name: 'Incoming',
            matchIncoming: 10_250_000,
            absorptionMode: 'MATCH',
          },
        ],
        salaryMatchingElection: election('STANDARD_TPE', {
          outgoing: 10_000_000,
        }),
      },
      context
    );

    expect(result.passed).toBe(true);
    expect(result.allowableIncoming).toBe(10_250_000);
    expect(result.details.ruleApplied).toBe('Standard Traded Player Exception');
    expect(result.details.pathEvaluation?.status).toBe('PASS');
  });

  it('does not fall back to generic bands when election input is absent', () => {
    const result = validateSalaryMatching(
      {
        salaryOut: 10_000_000,
        salaryIn: 8_000_000,
        teamTotalSalary: 180_000_000,
        outgoingPlayers: [
          { id: 'outgoing', name: 'Outgoing', matchOutgoing: 10_000_000 },
        ],
        incomingPlayers: [
          {
            id: 'incoming',
            name: 'Incoming',
            matchIncoming: 8_000_000,
            absorptionMode: 'MATCH',
          },
        ],
      },
      context
    );

    expect(result.passed).toBe(false);
    expect(result.allowableIncoming).toBeNull();
    expect(result.violations[0]).toMatch(/salaryMatchingElection/);
  });

  it('fails closed when held-TPE absorption has no exact TPE identity', () => {
    const result = validateSalaryMatching(
      {
        salaryOut: 0,
        salaryIn: 2_000_000,
        teamTotalSalary: 180_000_000,
        incomingPlayers: [
          {
            id: 'held',
            name: 'Held',
            matchIncoming: 2_000_000,
            absorptionMode: 'TPE',
          },
        ],
        appliedTPEs: [
          {
            id: 'held-tpe',
            amount: 3_000_000,
            remainingAmount: 3_000_000,
          },
        ],
        salaryMatchingElection: election('STANDARD_TPE'),
      },
      context
    );

    expect(result.passed).toBe(false);
    expect(result.violations[0]).toMatch(/requires an exact tpeId/);
    expect(result.details.pathEvaluation).toBeUndefined();
  });

  it('fails closed when a designated held TPE has no available team record', () => {
    const result = validateSalaryMatching(
      {
        salaryOut: 0,
        salaryIn: 2_000_000,
        teamTotalSalary: 180_000_000,
        incomingPlayers: [
          {
            id: 'held',
            name: 'Held',
            matchIncoming: 2_000_000,
            absorptionMode: 'TPE',
            tpeId: 'missing-tpe',
          },
        ],
        appliedTPEs: [],
        salaryMatchingElection: election('STANDARD_TPE'),
      },
      context
    );

    expect(result.passed).toBe(false);
    expect(result.allowableIncoming).toBeNull();
    expect(result.violations[0]).toMatch(/no available TPE/);
    expect(result.details.pathEvaluation).toBeUndefined();
  });

  it('creates and applies the exact remaining Standard TPE with one-year expiry', () => {
    const salaryResult = validateSalaryMatching(
      {
        salaryOut: 10_000_000,
        salaryIn: 8_000_000,
        teamTotalSalary: 180_000_000,
        outgoingPlayers: [
          { id: 'outgoing', name: 'Outgoing', matchOutgoing: 10_000_000 },
        ],
        incomingPlayers: [
          {
            id: 'incoming',
            name: 'Incoming',
            matchIncoming: 8_000_000,
            absorptionMode: 'MATCH',
          },
        ],
        salaryMatchingElection: election('STANDARD_TPE', {
          outgoing: 10_000_000,
        }),
      },
      context
    );

    const exceptionResult = validateTradeExceptions({
      salaryOut: 10_000_000,
      salaryIn: 8_000_000,
      teamTotalSalary: 180_000_000,
      outgoingPlayers: [
        { id: 'outgoing', name: 'Outgoing', matchOutgoing: 10_000_000 },
      ],
      incomingPlayers: [
        {
          id: 'incoming',
          name: 'Incoming',
          matchIncoming: 8_000_000,
          absorptionMode: 'MATCH',
        },
      ],
      salaryMatchingPathEvaluation: salaryResult.details.pathEvaluation ?? null,
      context,
    });

    expect(exceptionResult.passed).toBe(true);
    expect(exceptionResult.createdTPE).toMatchObject({
      amount: 10_250_000,
      totalAmount: 10_250_000,
      usedAmount: 8_000_000,
      remainingAmount: 2_250_000,
      expiresOn: '2027-07-15T16:00:00.000Z',
      salaryMatchingPath: {
        path: 'STANDARD_TPE',
        allowance: 250_000,
        preTradeSalary: 10_000_000,
        acquiredSalary: 8_000_000,
      },
    });

    const lifecycle = applyTradeExceptionLifecycle({
      currentTradeExceptions: [],
      hasTradeExceptionsValidation: true,
      createdTPE: exceptionResult.createdTPE,
      incomingPlayers: [],
      outgoingPlayers: [{ name: 'Outgoing' }],
      teamCode: 'TMA',
      seasonId: '2026-27',
      seasonYear: 2027,
      timestampISO: '2026-07-15T16:00:00.000Z',
      worldId: 'world-1',
      mutationType: 'executeTrade',
      mutationId: 'mutation-1',
    });

    expect(lifecycle.blockingIssues).toEqual([]);
    expect(lifecycle.updatedTradeExceptions[0]).toMatchObject({
      totalAmount: 10_250_000,
      usedAmount: 8_000_000,
      remainingAmount: 2_250_000,
      salaryMatchingPath: {
        componentId: 'standard:outgoing',
      },
    });
    expect(lifecycle.updatedTradeExceptions[0]).not.toHaveProperty('remaining');
    expect(lifecycle.updatedTradeExceptions[0]).not.toHaveProperty(
      'expirationDate'
    );

    const persistedTeam = normalizeTeamTpeSchema({
      teamCode: 'TMA',
      teamName: 'Team A',
      season: '2026-27',
      roster: [],
      tradeExceptions: lifecycle.updatedTradeExceptions,
    });
    const persistenceResult = validatePersistableShape({
      obj: persistedTeam,
      allowlist: PERSISTENCE_CONTRACTS.TEAM.topLevel,
      label: 'TEAM',
      deepRules: PERSISTENCE_CONTRACTS.TEAM.deepRules,
    });

    expect(persistenceResult).toMatchObject({ valid: true, violations: [] });
    const reloadedTeam = WorldTeamSnapshotZ.parse(persistedTeam);
    expect(reloadedTeam.exceptions?.tpe?.[0]).toMatchObject({
      totalAmount: 10_250_000,
      usedAmount: 8_000_000,
      remainingAmount: 2_250_000,
      salaryMatchingPath: {
        path: 'STANDARD_TPE',
        allowance: 250_000,
        preTradeSalary: 10_000_000,
        acquiredSalary: 8_000_000,
      },
    });
  });

  it('permits distinct held-TPE and outgoing Standard components together', () => {
    const heldTpe = {
      id: 'held-tpe',
      amount: 5_000_000,
      totalAmount: 5_000_000,
      remainingAmount: 3_000_000,
      createdSeason: 2026,
      expiresOn: '2027-08-01T00:00:00.000Z',
    };
    const salaryResult = validateSalaryMatching(
      {
        salaryOut: 10_000_000,
        salaryIn: 10_000_000,
        teamTotalSalary: 180_000_000,
        outgoingPlayers: [
          { id: 'outgoing', name: 'Outgoing', matchOutgoing: 10_000_000 },
        ],
        incomingPlayers: [
          {
            id: 'matched',
            name: 'Matched',
            matchIncoming: 8_000_000,
            absorptionMode: 'MATCH',
          },
          {
            id: 'held',
            name: 'Held',
            matchIncoming: 2_000_000,
            absorptionMode: 'TPE',
            tpeId: 'held-tpe',
          },
        ],
        appliedTPEs: [heldTpe],
        salaryMatchingElection: election('STANDARD_TPE', {
          outgoing: 10_000_000,
        }),
      },
      context
    );

    expect(salaryResult.passed).toBe(true);
    expect(salaryResult.details.pathEvaluation?.components).toHaveLength(2);

    const exceptionResult = validateTradeExceptions({
      salaryOut: 10_000_000,
      salaryIn: 10_000_000,
      teamTotalSalary: 180_000_000,
      outgoingPlayers: [
        { id: 'outgoing', name: 'Outgoing', matchOutgoing: 10_000_000 },
      ],
      incomingPlayers: [
        {
          id: 'held',
          name: 'Held',
          matchIncoming: 2_000_000,
          absorptionMode: 'TPE',
          tpeId: 'held-tpe',
        },
      ],
      tradeExceptions: [heldTpe],
      salaryMatchingPathEvaluation: salaryResult.details.pathEvaluation ?? null,
      context,
    });

    expect(exceptionResult.passed).toBe(true);
    expect(exceptionResult.violations).toEqual([]);
  });
});
