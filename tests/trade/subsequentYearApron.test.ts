import { describe, expect, it } from 'vitest';
import { computeSubsequentYearApronTeamSalary } from '@/features/architect/utils/tradeMachine/utils/subsequentYearApronTeamSalary';
import {
  createSubsequentYearHardCapLedgerEntry,
  createTradeHardCapLedgerEntry,
  evaluateTradeApronRestriction,
} from '@/features/architect/utils/tradeMachine/utils/tradeApronRestrictions';
import {
  parsePersistedTradeHardCapLedger,
  parseTradeHardCapLedger,
} from '@/features/architect/utils/tradeMachine/utils/tradeHardCapLedgerAuthority';
import { validateHardCap } from '@/features/architect/utils/tradeMachine/rules/hardCapValidation';
import type {
  TradeTeam,
  TradeValidatorContext,
} from '@/features/architect/utils/tradeMachine/constants/types';
import type { TradeSalaryPathEvaluation } from '@/features/architect/utils/tradeMachine/utils/tradeSalaryMatchingPaths';

// 2025-26 (Salary Cap Year 2026) and 2026-27 (2027) official levels.
const CAP_2026 = 154_647_000;
const SECOND_APRON_2026 = 207_824_000;
const SECOND_APRON_2027 = 221_686_000;

type Row = Record<string, unknown>;

function row(season: string, salary: number, extra: Row = {}): Row {
  return {
    season,
    salary,
    capHit: salary,
    option: null,
    optionUsed: null,
    tradeBonus: null,
    incentives: { likely: 0, unlikely: 0 },
    ...extra,
  };
}

function player(
  id: string,
  rows: Row[],
  extra: Row = {},
  contract: Row = {}
): Row {
  const last = rows[rows.length - 1]?.season ?? '2025-26';
  return {
    id,
    player_id: id,
    name: id,
    contract: {
      contractType: 'VETERAN CONTRACT',
      endSeason: last,
      salariesByYear: rows,
      ...contract,
    },
    futureContract: null,
    ...extra,
  };
}

function compute(
  players: Row[],
  {
    outgoing = [],
    incoming = [],
    deadCap = [],
    extraTeam = {},
    incomingUplift = new Map<string, number>(),
  }: {
    outgoing?: Row[];
    incoming?: Row[];
    deadCap?: Row[];
    extraTeam?: Row;
    incomingUplift?: Map<string, number>;
  } = {}
) {
  return computeSubsequentYearApronTeamSalary({
    team: { teamCode: 'DET', players, deadCap, ...extraTeam },
    outgoingPlayers: outgoing,
    incomingPlayers: incoming,
    incomingUpliftByPlayer: incomingUplift,
    salaryCapYear: 2026,
    asOfDate: '2026-06-05',
    salaryCap: CAP_2026,
  });
}

describe('next season Apron Team Salary (CBA2-A05.17)', () => {
  it('counts options as exercised and drops declined, voided and expiring rows', () => {
    const result = compute([
      player('guaranteed', [row('2025-26', 1), row('2026-27', 10_000_000)]),
      player('team-option', [
        row('2025-26', 1),
        row('2026-27', 5_000_000, { option: 'TO' }),
      ]),
      player('player-option', [
        row('2025-26', 1),
        row('2026-27', 4_000_000, { option: 'PO' }),
      ]),
      player('declined', [
        row('2025-26', 1),
        row('2026-27', 3_000_000, { option: 'TO', optionUsed: false }),
      ]),
      player('voided', [
        row('2025-26', 1),
        row('2026-27', 2_000_000, { voidedByExtension: true }),
      ]),
      player('expiring', [row('2025-26', 30_000_000)]),
      player(
        'two-way',
        [row('2026-27', 600_000)],
        {},
        { contractType: 'TWO-WAY' }
      ),
    ]);
    expect(result).toMatchObject({
      status: 'ready',
      salaryCapYear: 2027,
      season: '2026-27',
      amount: 19_000_000,
    });
  });

  it('follows a signed extension, unlikely bonuses and next-season dead money', () => {
    const extended = player('extended', [row('2025-26', 5_000_000)]);
    extended.futureContract = {
      endSeason: '2029-30',
      salariesByYear: [row('2026-27', 25_000_000)],
    };
    const result = compute(
      [
        extended,
        player('bonus', [
          row('2025-26', 1),
          row('2026-27', 8_000_000, {
            capHit: 8_500_000,
            incentives: { likely: 500_000, unlikely: 750_000 },
          }),
        ]),
      ],
      {
        deadCap: [
          {
            playerId: 'waived',
            amountByYear: [
              { season: '2025-26', amount: 9_000_000 },
              { season: '2026-27', amount: 3_000_000 },
            ],
          },
        ],
      }
    );
    expect(result).toMatchObject({
      status: 'ready',
      amount: 25_000_000 + 8_500_000 + 750_000 + 3_000_000,
    });
  });

  it('moves traded Contracts and bounds an incoming Minimum uplift', () => {
    const minimum = player('minimum', [
      row('2025-26', 1_272_870),
      row('2026-27', 2_048_494),
    ]);
    const result = compute(
      [player('leaving', [row('2025-26', 1), row('2026-27', 20_000_000)])],
      {
        outgoing: [{ id: 'leaving' }],
        incoming: [minimum],
        incomingUplift: new Map([['minimum', 1_000_000]]),
      }
    );
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    const uplift = result.lines.find((line) => line.kind === 'minimum-uplift');
    expect(uplift?.amount).toBeGreaterThan(0);
    expect(result.amount).toBe(2_048_494 + (uplift?.amount ?? 0));
    expect(result.lines.some((line) => line.playerId === 'leaving')).toBe(
      false
    );
  });

  it('gives the same amount for the post-trade roster that Apply re-validates', () => {
    const minimum = player('minimum', [
      row('2025-26', 1_272_870),
      row('2026-27', 2_048_494),
    ]);
    const staying = player('staying', [
      row('2025-26', 1),
      row('2026-27', 9_000_000),
    ]);
    const options = {
      outgoing: [{ id: 'leaving' }],
      incoming: [minimum],
      incomingUplift: new Map([['minimum', 1_000_000]]),
    };
    const before = compute(
      [
        staying,
        player('leaving', [row('2025-26', 1), row('2026-27', 20_000_000)]),
      ],
      options
    );
    const after = compute([staying, minimum], options);
    expect(before.status).toBe('ready');
    expect(after).toEqual(before);
  });

  it('assumes the Higher Max for a final-season Rookie Scale player with a maximum extension', () => {
    const rookie = player(
      'rookie',
      [row('2025-26', 10_000_000)],
      {},
      { isRookieScale: true }
    );
    rookie.futureContract = {
      isMaxContract: true,
      endSeason: '2030-31',
      salariesByYear: [row('2026-27', 38_000_000)],
    };
    const result = compute([rookie]);
    expect(result).toMatchObject({
      status: 'ready',
      amount: Math.round(CAP_2026 * 0.3),
    });
    if (result.status === 'ready') {
      expect(result.assumptions.join(' ')).toContain('Higher Max');
    }
  });

  it('fails closed on missing Contracts, extension status, bonuses and pending Offer Sheets', () => {
    // A stored record omits an empty futureContract: no extension.
    const noFuture = player('no-future', [row('2025-26', 1)]);
    delete noFuture.futureContract;
    expect(compute([noFuture])).toMatchObject({ status: 'ready', amount: 0 });
    expect(
      compute([player('gap', [row('2025-26', 1), row('2027-28', 1)])])
    ).toMatchObject({
      status: 'needs-input',
      missingInputs: ['players.gap.nextSeasonSalary'],
    });
    expect(
      compute([
        player('kicker', [
          row('2025-26', 1),
          row('2026-27', 1, { tradeBonus: 500_000 }),
        ]),
      ])
    ).toMatchObject({ status: 'needs-input' });
    expect(
      compute([], {
        extraTeam: { incomingOfferSheets: [{ status: 'PENDING' }] },
      })
    ).toMatchObject({ status: 'needs-input' });
    expect(
      computeSubsequentYearApronTeamSalary({
        team: { teamCode: 'DET', players: [] },
        outgoingPlayers: [],
        incomingPlayers: [],
        incomingUpliftByPlayer: new Map(),
        salaryCapYear: 2026,
        asOfDate: '2026-06-05',
        salaryCap: CAP_2026,
      })
    ).toMatchObject({ status: 'needs-input', missingInputs: ['team.deadCap'] });
  });
});

function aggregatedPath(postSalary: number): TradeSalaryPathEvaluation {
  return {
    status: 'PASS',
    passed: true,
    electedPath: 'AGGREGATED_STANDARD_TPE',
    ruleLabel: 'AGGREGATED_STANDARD_TPE',
    formula: 'fixture',
    allowance: 250_000,
    postAssignmentApronTeamSalary: postSalary,
    firstApron: 195_945_000,
    maximumIncoming: 10_000_000,
    actualIncoming: 5_000_000,
    margin: 5_000_000,
    components: [
      {
        componentId: 'aggregated_standard_tpe:players',
        kind: 'ELECTED_PATH',
        path: 'AGGREGATED_STANDARD_TPE',
        timing: 'SIMULTANEOUS',
        outgoingPlayers: [],
        incomingPlayers: [
          { playerId: 'incoming', playerName: 'Incoming', salary: 5_000_000 },
        ],
        maximumIncoming: 0,
        usedIncoming: 0,
        remaining: 0,
      },
    ],
    missingInputs: [],
    violations: [],
    canonLeafIds: [],
    election: {
      version: 1,
      path: 'AGGREGATED_STANDARD_TPE',
      postAssignmentApronTeamSalary: postSalary,
      tradedPlayerPreTradeSalaries: {},
    },
  };
}

function june5Context(
  tradeDate = '2026-06-05T12:00:00-04:00'
): TradeValidatorContext {
  return {
    source: 'tradeMachine',
    worldId: 'WORLD-1',
    containingTeamCode: 'DET',
    currentYear: 2026,
    yearKey: 2026,
    tradeDate,
    asOfDate: tradeDate,
    capSettings: {
      salaryCap: CAP_2026,
      firstApron: 195_945_000,
      secondApron: SECOND_APRON_2026,
    },
  };
}

function detTeam(postSalary: number, nextSeason: number | null): TradeTeam {
  return {
    teamId: 'DET',
    projectedSalary: postSalary,
    teamTotalSalary: postSalary,
    subsequentYearApron:
      nextSeason === null
        ? {
            status: 'needs-input',
            salaryCapYear: 2027,
            missingInputs: ['team.deadCap'],
            reason: 'fixture',
          }
        : {
            status: 'ready',
            salaryCapYear: 2027,
            season: '2026-27',
            amount: nextSeason,
            lines: [{ kind: 'contract', playerId: 'P', amount: nextSeason }],
            assumptions: [],
            canonLeafIds: ['CBA2-A05.15', 'CBA2-A05.17'],
          },
    team: { id: 'DET', teamCode: 'DET', apronTeamSalary: postSalary },
  };
}

function evaluateJune(
  nextSeason: number | null,
  tradeDate?: string,
  postSalary = 190_000_000
) {
  return evaluateTradeApronRestriction({
    team: detTeam(postSalary, nextSeason),
    teamCode: 'DET',
    pathEvaluation: aggregatedPath(postSalary),
    context: june5Context(tradeDate),
  });
}

describe('post-Regular-Season dual-year test (CBA2-A05.15, A05.16)', () => {
  it('passes an aggregated trade only when next season also stays under the Second Apron', () => {
    const atLevel = evaluateJune(SECOND_APRON_2026);
    expect(atLevel).toMatchObject({
      status: 'PASS',
      restrictionRow: 'H',
      subsequentYear: {
        salaryCapYear: 2027,
        apronTeamSalary: SECOND_APRON_2026,
        testCeiling: SECOND_APRON_2026,
        triggers: [
          {
            restrictionRow: 'H',
            ceiling: SECOND_APRON_2027,
            levelBasis: 'official',
          },
        ],
      },
    });
    expect(atLevel.canonLeafIds).toEqual(
      expect.arrayContaining(['CBA2-A05.15', 'CBA2-A05.16', 'CBA2-A05.17'])
    );

    const above = evaluateJune(SECOND_APRON_2026 + 1);
    expect(above.status).toBe('FAIL');
    expect(above.violations).toEqual([
      expect.stringContaining(
        '2026-27 amount of $207,824,001 exceeds it by $1'
      ),
    ]);
    expect(above.canonLeafIds).not.toContain('CBA2-A05.16');

    expect(evaluateJune(null)).toMatchObject({
      status: 'NEEDS_INPUT',
      missingInputs: ['subsequentSalaryCapYear.team.deadCap'],
    });
  });

  it('applies only after the last Regular Season day', () => {
    const inSeason = evaluateJune(
      SECOND_APRON_2026 + 50_000_000,
      '2026-02-01T12:00:00-05:00'
    );
    expect(inSeason.status).toBe('PASS');
    expect(inSeason.subsequentYear).toBeNull();
  });

  it('records and authenticates a next-season hard cap at that season’s Level', () => {
    const evaluation = evaluateJune(200_000_000);
    const current = createTradeHardCapLedgerEntry({
      evaluation,
      teamCode: 'DET',
      transactionId: 'TRADE-JUNE',
      effectiveAt: '2026-06-05T16:00:00Z',
    });
    const next = createSubsequentYearHardCapLedgerEntry({
      evaluation,
      teamCode: 'DET',
      transactionId: 'TRADE-JUNE',
      effectiveAt: '2026-06-05T16:00:00Z',
    });
    expect(next).toMatchObject({
      entryId: 'TRADE-JUNE:hard-cap:DET:2027',
      salaryCapYear: 2027,
      ceiling: SECOND_APRON_2027,
      expiresAt: '2027-07-01T00:00:00Z',
      dualYear: { triggerSalaryCapYear: 2026, levelBasis: 'official' },
    });
    const ledger = JSON.parse(JSON.stringify([current, next]));
    expect(parseTradeHardCapLedger(ledger).valid).toBe(true);
    expect(
      parsePersistedTradeHardCapLedger(ledger, {
        containingTeamCode: 'DET',
        worldLineage: ['WORLD-1'],
      }).valid
    ).toBe(true);

    // Tampering with the year, Level or date breaks authentication.
    for (const mutate of [
      (entry: Record<string, unknown>) => {
        entry.salaryCapYear = 2028;
      },
      (entry: Record<string, unknown>) => {
        entry.ceiling = SECOND_APRON_2026;
      },
      (entry: Record<string, unknown>) => {
        entry.triggerTransactionDate = '2026-03-01T12:00:00-05:00';
      },
    ]) {
      const copy = JSON.parse(JSON.stringify(next));
      mutate(copy);
      expect(parseTradeHardCapLedger([copy]).valid).toBe(false);
    }

    // Not created when the dual-year test did not apply.
    const inSeason = evaluateJune(100_000_000, '2026-02-01T12:00:00-05:00');
    expect(
      createSubsequentYearHardCapLedgerEntry({
        evaluation: inSeason,
        teamCode: 'DET',
        transactionId: 'TRADE-FEB',
        effectiveAt: '2026-02-01T17:00:00Z',
      })
    ).toBeNull();
  });

  it('binds later trades this season to the next-season hard cap', () => {
    const evaluation = evaluateJune(200_000_000);
    const next = createSubsequentYearHardCapLedgerEntry({
      evaluation,
      teamCode: 'DET',
      transactionId: 'TRADE-JUNE',
      effectiveAt: '2026-06-05T16:00:00Z',
    });
    const ledger = JSON.parse(JSON.stringify([next]));
    const later = (nextSeason: number | null) =>
      validateHardCap(
        {
          ...detTeam(150_000_000, nextSeason),
          hardCapLedger: ledger,
        } as never,
        {
          ...june5Context('2026-06-20T12:00:00-04:00'),
          worldLineage: ['WORLD-1'],
        } as never
      );
    expect(later(SECOND_APRON_2027).passed).toBe(true);
    expect(later(SECOND_APRON_2027 + 1)).toMatchObject({
      passed: false,
      violations: [expect.stringContaining('Next-season hard cap')],
    });
    expect(later(null).passed).toBe(false);
  });
});
