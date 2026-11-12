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

  it('refuses a below-cap Standard election (room or the Expanded TPE instead)', () => {
    const result = evaluate({ teamSalary: SALARY_CAP - 1 });

    expect(result.status).toBe('FAIL');
    expect(result.maximumIncoming).toBeNull();
    expect(result.violations[0]).toMatch(/unavailable below the Salary Cap/);
  });

  describe('Expanded TPE (CBA2-A02.7, A02.8, A02.11)', () => {
    // A = $7.5M x 2026-27 Salary Cap / 2023-24 Salary Cap, unrounded.
    const A = (7_500_000 * SALARY_CAP) / 136_021_000;
    const K = TRADE_SALARY_ALLOWANCE;
    const expanded = (
      outgoing: number,
      incoming: number,
      extra: Partial<Parameters<typeof evaluateTradeSalaryMatchingPath>[0]> = {}
    ) =>
      evaluate({
        election: election('EXPANDED_TPE', {
          first: outgoing / 2,
          second: outgoing / 2,
        }),
        outgoingPlayers: [
          { playerId: 'first', playerName: 'First' },
          { playerId: 'second', playerName: 'Second' },
        ],
        incomingMatchingPlayers: [
          { playerId: 'incoming', playerName: 'Incoming', salary: incoming },
        ],
        ...extra,
      });

    it('uses 200% + K below the first crossover, O + A between, 125% + K above', () => {
      expect(A).toBeCloseTo(9_095_709.49, 1);
      expect(expanded(5_000_000, 0).maximumIncoming).toBe(2 * 5_000_000 + K);
      expect(expanded(20_000_000, 0).maximumIncoming).toBe(20_000_000 + A);
      expect(expanded(40_000_000, 0).maximumIncoming).toBe(
        1.25 * 40_000_000 + K
      );
      // The crossovers are A - K and 4(A - K); the formula is continuous there.
      const low = A - K;
      expect(expanded(low, 0).maximumIncoming).toBeCloseTo(2 * low + K, 6);
      expect(expanded(low, 0).maximumIncoming).toBeCloseTo(low + A, 6);
      const high = 4 * (A - K);
      expect(expanded(high, 0).maximumIncoming).toBeCloseTo(high + A, 6);
      expect(expanded(high, 0).maximumIncoming).toBeCloseTo(1.25 * high + K, 6);
    });

    it('passes at the limit and fails a cent above it', () => {
      const limit = 20_000_000 + A;
      const pass = expanded(20_000_000, limit);
      expect(pass.status).toBe('PASS');
      expect(pass.components[0]).toMatchObject({
        kind: 'ELECTED_PATH',
        path: 'EXPANDED_TPE',
        timing: 'SIMULTANEOUS',
      });
      expect(pass.canonLeafIds).toContain('CBA2-A02.8');
      const fail = expanded(20_000_000, limit + 0.01);
      expect(fail.status).toBe('FAIL');
      expect(fail.violations[0]).toMatch(/Expanded Traded Player Exception/);
    });

    it('is the below-cap election in lieu of the room path', () => {
      expect(
        expanded(5_000_000, 10_000_000, { teamSalary: SALARY_CAP - 1 }).status
      ).toBe('PASS');
    });

    it('zeroes the allowance above the First Apron', () => {
      const result = evaluate({
        election: election(
          'EXPANDED_TPE',
          { first: 2_500_000, second: 2_500_000 },
          FIRST_APRON + 1
        ),
        outgoingPlayers: [
          { playerId: 'first', playerName: 'First' },
          { playerId: 'second', playerName: 'Second' },
        ],
      });
      expect(result.allowance).toBe(0);
      expect(result.maximumIncoming).toBe(10_000_000);
    });

    it('keeps a held Standard TPE as its own component beside the Expanded TPE', () => {
      // Pinned behaviour (B3 review follow-up): like the Standard path, the
      // Expanded limit covers only its own incoming players; a held Standard
      // TPE absorbs its assigned player separately (row F applies to it).
      const result = expanded(20_000_000, 20_000_000 + A, {
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
      expect(result.status).toBe('PASS');
      expect(result.actualIncoming).toBe(20_000_000 + A);
      expect(result.components.map((c) => [c.kind, c.path])).toEqual([
        ['ELECTED_PATH', 'EXPANDED_TPE'],
        ['HELD_STANDARD_TPE', 'STANDARD_TPE'],
      ]);
      expect(result.components[1].usedIncoming).toBe(2_000_000);
    });

    it('needs players both ways and exact pre-trade Salary', () => {
      expect(
        expanded(5_000_000, 0, { incomingMatchingPlayers: [] }).status
      ).toBe('FAIL');
      expect(expanded(5_000_000, 0, { outgoingPlayers: [] }).status).toBe(
        'FAIL'
      );
      const missing = expanded(5_000_000, 1, {
        election: election('EXPANDED_TPE', { first: 1 }),
      });
      expect(missing.status).toBe('NEEDS_INPUT');
      expect(missing.missingInputs).toEqual([
        'tradedPlayerPreTradeSalaries.second',
      ]);
    });
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

  it('passes the Minimum Exception path for qualifying incoming players only', () => {
    const minimum = (qualifies: boolean) => ({
      playerId: 'minimum',
      playerName: 'Minimum',
      salary: 2_296_274,
      minimumExceptionAcquisition: qualifies,
    });
    const pass = evaluate({
      election: election('MINIMUM_EXCEPTION'),
      outgoingPlayers: [],
      incomingMatchingPlayers: [minimum(true)],
    });
    expect(pass.status).toBe('PASS');
    expect(pass.canonLeafIds).toEqual(['CBA2-C13.4', 'CBA2-C13.6']);
    expect(pass.components).toEqual([
      expect.objectContaining({
        componentId: 'minimum-exception',
        path: 'MINIMUM_EXCEPTION',
        incomingPlayers: [
          { playerId: 'minimum', playerName: 'Minimum', salary: 2_296_274 },
        ],
      }),
    ]);
    // Also above the Second Apron: the Minimum Exception has no Apron limit.
    expect(
      evaluate({
        election: election('MINIMUM_EXCEPTION', {}, 260_000_000),
        outgoingPlayers: [],
        incomingMatchingPlayers: [minimum(true)],
        teamSalary: 255_000_000,
      }).status
    ).toBe('PASS');

    const notMinimum = evaluate({
      election: election('MINIMUM_EXCEPTION'),
      outgoingPlayers: [],
      incomingMatchingPlayers: [minimum(false)],
    });
    expect(notMinimum.status).toBe('FAIL');
    expect(notMinimum.violations[0]).toContain('not on a Minimum Exception');

    const sendsPlayer = evaluate({
      election: election('MINIMUM_EXCEPTION', { outgoing: 1_000_000 }),
      incomingMatchingPlayers: [minimum(true)],
    });
    expect(sendsPlayer.status).toBe('FAIL');
    expect(
      evaluate({
        election: election('MINIMUM_EXCEPTION'),
        outgoingPlayers: [],
        incomingMatchingPlayers: [],
      }).status
    ).toBe('FAIL');
  });

  describe('free-agent exception paths', () => {
    const MLE = 14_104_000;
    const BAE = 5_134_000;
    const ROOM = 8_781_000;
    const incoming = (salary: number, seasons: number | null = 2) => ({
      playerId: 'acquired',
      playerName: 'Acquired',
      salary,
      contractSeasonsRemaining: seasons,
    });
    const balances = (overrides = {}) => ({
      mle: {
        enabled: true,
        totalAmount: MLE,
        usedAmount: 0,
        remainingAmount: MLE,
        seasonAmount: MLE,
      },
      bae: {
        enabled: true,
        totalAmount: BAE,
        usedAmount: 0,
        remainingAmount: BAE,
        seasonAmount: BAE,
      },
      room: {
        enabled: true,
        totalAmount: ROOM,
        usedAmount: 0,
        remainingAmount: ROOM,
        seasonAmount: ROOM,
      },
      ...overrides,
    });
    const exception = (
      path: TradeSalaryMatchingPath,
      overrides: Partial<
        Parameters<typeof evaluateTradeSalaryMatchingPath>[0]
      > = {}
    ) =>
      evaluate({
        election: election(path, {}, 190_000_000),
        outgoingPlayers: [],
        incomingMatchingPlayers: [incoming(MLE)],
        teamSalary: 175_000_000,
        capTeamSalary: 175_000_000,
        exceptionBalances: balances(),
        ...overrides,
      });

    it('passes the Non-Taxpayer MLE at its remaining amount and fails one dollar above', () => {
      const pass = exception('NON_TAXPAYER_MLE');
      expect(pass.status).toBe('PASS');
      expect(pass.maximumIncoming).toBe(MLE);
      expect(pass.components).toEqual([
        expect.objectContaining({
          componentId: 'exception:mle',
          path: 'NON_TAXPAYER_MLE',
          remaining: 0,
        }),
      ]);
      const above = exception('NON_TAXPAYER_MLE', {
        incomingMatchingPlayers: [incoming(MLE + 1)],
      });
      expect(above.status).toBe('FAIL');
      expect(above.violations).toEqual([
        'Incoming Salary exceeds the remaining Non-Taxpayer Mid-Level Exception by $1.',
      ]);
    });

    it('uses only the remaining balance after earlier use', () => {
      const partlyUsed = balances({
        mle: {
          enabled: true,
          totalAmount: MLE,
          usedAmount: MLE - 4_000_000,
          remainingAmount: 4_000_000,
          seasonAmount: MLE,
        },
      });
      expect(
        exception('NON_TAXPAYER_MLE', {
          exceptionBalances: partlyUsed,
          incomingMatchingPlayers: [incoming(4_000_000)],
        }).status
      ).toBe('PASS');
      expect(
        exception('NON_TAXPAYER_MLE', {
          exceptionBalances: partlyUsed,
          incomingMatchingPlayers: [incoming(4_000_001)],
        }).status
      ).toBe('FAIL');
    });

    it('blocks every exception path from January 10', () => {
      for (const path of [
        'NON_TAXPAYER_MLE',
        'BI_ANNUAL_EXCEPTION',
        'ROOM_MLE',
      ] as const) {
        const before = exception(path, {
          transactionDate: '2027-01-09',
          incomingMatchingPlayers: [incoming(1_000_000)],
        });
        expect(before.status).toBe('PASS');
        const from = exception(path, {
          transactionDate: '2027-01-10',
          incomingMatchingPlayers: [incoming(1_000_000)],
        });
        expect(from.status).toBe('FAIL');
        expect(from.violations[0]).toContain('January 10');
      }
    });

    it('keeps the Non-Taxpayer MLE and BAE at or below the First Apron', () => {
      for (const path of ['NON_TAXPAYER_MLE', 'BI_ANNUAL_EXCEPTION'] as const) {
        const small = [incoming(1_000_000)];
        expect(
          exception(path, {
            election: election(path, {}, FIRST_APRON),
            incomingMatchingPlayers: small,
          }).status
        ).toBe('PASS');
        const over = exception(path, {
          election: election(path, {}, FIRST_APRON + 1),
          incomingMatchingPlayers: small,
        });
        expect(over.status).toBe('FAIL');
        expect(over.violations).toContainEqual(
          expect.stringContaining('First Apron')
        );
      }
      // The Room MLE has no Apron limit of its own.
      expect(
        exception('ROOM_MLE', {
          election: election('ROOM_MLE', {}, FIRST_APRON + 1),
          incomingMatchingPlayers: [incoming(1_000_000)],
        }).status
      ).toBe('PASS');
    });

    it("applies each exception's Contract-length limit", () => {
      expect(
        exception('BI_ANNUAL_EXCEPTION', {
          incomingMatchingPlayers: [incoming(BAE, 2)],
        }).status
      ).toBe('PASS');
      expect(
        exception('BI_ANNUAL_EXCEPTION', {
          incomingMatchingPlayers: [incoming(BAE, 3)],
        }).violations
      ).toEqual([
        "Acquired's Contract runs longer than the 2 Seasons the Bi-annual Exception allows.",
      ]);
      expect(
        exception('NON_TAXPAYER_MLE', {
          incomingMatchingPlayers: [incoming(MLE, 5)],
        }).status
      ).toBe('FAIL');
      expect(
        exception('ROOM_MLE', {
          incomingMatchingPlayers: [incoming(1_000_000, 4)],
        }).status
      ).toBe('FAIL');
    });

    it('refuses the BAE in consecutive Seasons', () => {
      const usedLastSeason = balances({
        bae: {
          enabled: true,
          totalAmount: BAE,
          usedAmount: 0,
          remainingAmount: BAE,
          seasonAmount: BAE,
          lastUsedSeasonEndYear: 2026,
        },
      });
      const result = exception('BI_ANNUAL_EXCEPTION', {
        exceptionBalances: usedLastSeason,
        incomingMatchingPlayers: [incoming(BAE)],
      });
      expect(result.status).toBe('FAIL');
      expect(result.violations[0]).toContain('consecutive');
    });

    it('keeps the Mid-Level flavors and the Room MLE/BAE exclusive within a Season', () => {
      const used = (key: 'mle' | 'tpmle' | 'bae' | 'room') =>
        balances({
          [key]: {
            enabled: true,
            totalAmount: 1_000_000,
            usedAmount: 1,
            remainingAmount: 999_999,
            seasonAmount: 1_000_000,
          },
        });
      const small = [incoming(1_000)];
      expect(
        exception('NON_TAXPAYER_MLE', {
          exceptionBalances: used('tpmle'),
          incomingMatchingPlayers: small,
        }).violations
      ).toEqual([
        'This team already used its Taxpayer Mid-Level Exception this Season, so it cannot also use the Non-Taxpayer Mid-Level Exception.',
      ]);
      expect(
        exception('ROOM_MLE', {
          exceptionBalances: used('bae'),
          incomingMatchingPlayers: small,
        }).status
      ).toBe('FAIL');
      expect(
        exception('BI_ANNUAL_EXCEPTION', {
          exceptionBalances: used('room'),
          incomingMatchingPlayers: small,
        }).status
      ).toBe('FAIL');
      // The NTMLE and BAE can both be used in one Season.
      expect(
        exception('BI_ANNUAL_EXCEPTION', {
          exceptionBalances: used('mle'),
          incomingMatchingPlayers: small,
        }).status
      ).toBe('PASS');
    });

    it('requires the over-cap condition for the MLE and BAE but not the Room MLE', () => {
      const wellBelowCap = SALARY_CAP - MLE;
      expect(
        exception('NON_TAXPAYER_MLE', { capTeamSalary: wellBelowCap })
          .violations
      ).toContainEqual(expect.stringContaining('at the Cap'));
      expect(
        exception('NON_TAXPAYER_MLE', { capTeamSalary: wellBelowCap + 1 })
          .status
      ).toBe('PASS');
      // The Cap book decides, not the (here lower) Apron book.
      expect(
        exception('NON_TAXPAYER_MLE', {
          teamSalary: 135_000_000,
          capTeamSalary: wellBelowCap + 1,
        }).status
      ).toBe('PASS');
      expect(
        exception('NON_TAXPAYER_MLE', { capTeamSalary: null }).missingInputs
      ).toEqual(['capTeamSalary']);
      expect(
        exception('ROOM_MLE', {
          capTeamSalary: 150_000_000,
          incomingMatchingPlayers: [incoming(1_000_000)],
        }).status
      ).toBe('PASS');
    });

    it('fails closed on missing balances, disabled exceptions, unknown terms and wrong structure', () => {
      expect(
        exception('NON_TAXPAYER_MLE', { exceptionBalances: {} }).missingInputs
      ).toEqual(['exceptions.mle']);
      expect(
        exception('NON_TAXPAYER_MLE', {
          incomingMatchingPlayers: [incoming(1_000_000, null)],
        }).missingInputs
      ).toEqual(['Acquired.contractSeasonsRemaining']);
      expect(
        exception('NON_TAXPAYER_MLE', {
          exceptionBalances: balances({
            mle: {
              enabled: false,
              totalAmount: MLE,
              usedAmount: 0,
              remainingAmount: MLE,
              seasonAmount: MLE,
            },
          }),
        }).violations
      ).toEqual([
        'This team has no Non-Taxpayer Mid-Level Exception available.',
      ]);
      expect(
        exception('NON_TAXPAYER_MLE', {
          election: election(
            'NON_TAXPAYER_MLE',
            { outgoing: 1_000_000 },
            190_000_000
          ),
          outgoingPlayers: [{ playerId: 'outgoing', playerName: 'Outgoing' }],
        }).status
      ).toBe('FAIL');
      expect(
        exception('NON_TAXPAYER_MLE', { incomingMatchingPlayers: [] }).status
      ).toBe('FAIL');
      expect(
        exception('NON_TAXPAYER_MLE', {
          exceptionBalances: balances({
            mle: {
              enabled: true,
              totalAmount: MLE,
              usedAmount: 0,
              remainingAmount: MLE,
              seasonAmount: null,
            },
          }),
        }).missingInputs
      ).toEqual(['seasonAmount.mle']);
    });

    it("refuses an exception record holding another Mid-Level flavor's amount", () => {
      // A Taxpayer MLE amount stored under the Non-Taxpayer key.
      const result = exception('NON_TAXPAYER_MLE', {
        exceptionBalances: balances({
          mle: {
            enabled: true,
            totalAmount: 5_685_000,
            usedAmount: 0,
            remainingAmount: 5_685_000,
            seasonAmount: MLE,
          },
        }),
        incomingMatchingPlayers: [incoming(1_000_000)],
      });
      expect(result.status).toBe('FAIL');
      expect(result.violations[0]).toContain(
        "does not match this Season's amount"
      );
    });
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

  it('does not require Apron Salary or cap settings when no player Contracts move', () => {
    const result = validateSalaryMatching(
      { salaryOut: 0, salaryIn: 0, sends: [], incomingPlayers: [] },
      { source: 'tradeMachine' }
    );
    expect(result).toMatchObject({
      passed: true,
      applicable: false,
      skipReason: 'NO_SALARY_MATCHING',
      allowableIncoming: null,
      violations: [],
      details: { pathEvaluation: null },
    });
    expect(result.details).not.toHaveProperty('totalSalary');
  });

  it.each([
    ['missing salary', { salaryOut: undefined }],
    ['malformed salary', { salaryIn: Number.NaN }],
    ['string salary', { salaryIn: '0' }],
    ['nonzero salary', { salaryOut: 1 }],
    ['missing outgoing list', { sends: undefined }],
    ['missing incoming list', { incomingPlayers: undefined }],
    ['malformed incoming list', { receives: null }],
    ['hidden outgoing alias', { outgoingPlayers: [{ id: 'outgoing' }] }],
    ['hidden incoming alias', { receives: [{ id: 'incoming' }] }],
    ['two-way player', { sends: [{ id: 'two-way', isTwoWay: true }] }],
    ['path election', { salaryMatchingElection: election('STANDARD_TPE') }],
    ['exception mode', { absorptionMode: 'FA_EXCEPTION' }],
    ['exception bucket', { bucketType: 'BAE' }],
    ['applied TPE', { appliedTPEs: [{ id: 'held-tpe', amount: 1 }] }],
  ])('retains the financial-input gate for %s', (_, override) => {
    const result = validateSalaryMatching(
      {
        salaryOut: 0,
        salaryIn: 0,
        sends: [],
        incomingPlayers: [],
        ...override,
      },
      context
    );
    expect(result.passed).toBe(false);
    expect(result.violations).toContain(
      'Apron Team Salary needs governed input'
    );
  });

  it('keeps ordinary player trades and contradictory context financially gated', () => {
    const noPlayers = {
      salaryOut: 0,
      salaryIn: 0,
      sends: [],
      incomingPlayers: [],
    };
    for (const result of [
      validateSalaryMatching(
        { ...noPlayers, sends: [{ id: 'player', salary: 10_000_000 }] },
        context
      ),
      validateSalaryMatching(noPlayers, { ...context, salaryIn: 1 }),
      validateSalaryMatching(noPlayers, {}),
    ]) {
      expect(result.passed).toBe(false);
      expect(result.violations).toContain(
        'Apron Team Salary needs governed input'
      );
    }
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
