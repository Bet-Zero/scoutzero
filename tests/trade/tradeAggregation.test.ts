import { describe, expect, it } from 'vitest';
import {
  evaluateTradeAggregation,
  twoCalendarMonthsAfter,
  contractAggregationFacts,
} from '@/features/architect/utils/tradeMachine/utils/tradeAggregation';
import { recordTradeAcquisitions } from '@/features/architect/utils/tradeMachine/utils/tradeAcquisitionHistory';
import type { TradeAggregationFacts } from '@/schemas/tradeAggregation';
import type { TradeSalaryPathEvaluation } from '@/features/architect/utils/tradeMachine/utils/tradeSalaryMatchingPaths';
import type { TradeTeamUpdate } from '@/features/architect/utils/mutationPipeline.types.result';
import { makeResultingState } from '../architect/contractHistory/contractHistoryFixtures';
import { normalizeCurrentStateTeamMutationCore } from '@/features/architect/utils/mutationPipeline.read.normalizeTeam.builders';
import {
  PERSISTENCE_CONTRACTS,
  validatePersistableShape,
} from '@/features/architect/utils/persistenceContracts';

function player(
  id: string,
  acquiredAt = '2025-07-01',
  viaException = true,
  minimum: boolean | null = false,
  minimumYear = 2027
) {
  return {
    playerId: id,
    playerName: id,
    aggregationFacts: {
      acquisition: { status: 'known', acquiredAt, viaException },
      minimumSalaryCapYear: minimumYear,
      minimumTradedPlayer: minimum,
    } satisfies TradeAggregationFacts,
  };
}
function evaluate(
  overrides: Partial<Parameters<typeof evaluateTradeAggregation>[0]> = {}
) {
  return evaluateTradeAggregation({
    path: 'AGGREGATED_STANDARD_TPE',
    outgoing: [player('a'), player('b')],
    replacementCount: 1,
    transactionDate: '2026-06-05',
    salaryCapYear: 2026,
    deadline: '2026-02-05',
    regularSeasonEnd: '2026-04-12',
    ...overrides,
  });
}
function passes(result: ReturnType<typeof evaluate>) {
  expect(result).toEqual({ violations: [], missingInputs: [] });
}

describe('CBA2-A06 aggregation timing and minimum stacking', () => {
  it('counts calendar months, including month ends and Eastern daylight offsets', () => {
    expect(twoCalendarMonthsAfter('2026-01-05')).toBe('2026-03-05');
    expect(twoCalendarMonthsAfter('2025-12-31')).toBe('2026-02-28');
    expect(twoCalendarMonthsAfter('2026-01-15T12:00:00-05:00')).toBe(
      '2026-03-15T12:00:00.000-04:00'
    );
    expect(twoCalendarMonthsAfter('bad')).toBeNull();
  });
  it.each(['AGGREGATED_STANDARD_TPE', 'EXPANDED_TPE'])(
    'bars an exception acquisition just inside two months on %s, then releases it',
    (path) => {
      const input = {
        path,
        salaryCapYear: 2027,
        outgoing: [player('a', '2026-05-15T12:00:00-04:00'), player('b')],
      };
      expect(
        evaluate({
          ...input,
          transactionDate: '2026-07-15T11:59:59-04:00',
        }).violations.join()
      ).toContain('CBA2-A06.1');
      passes(
        evaluate({ ...input, transactionDate: '2026-07-15T12:00:00-04:00' })
      );
    }
  );
  it('does not impose the wait on a solo re-trade or room transaction', () => {
    passes(
      evaluate({ path: 'STANDARD_TPE', outgoing: [player('a', '2026-06-05')] })
    );
    passes(
      evaluate({ path: 'EXPANDED_TPE', outgoing: [player('a', '2026-06-05')] })
    );
    passes(
      evaluate({
        path: 'ROOM',
        outgoing: [player('a', '2026-06-05'), player('b')],
      })
    );
    passes(
      evaluate({ outgoing: [player('a', '2026-06-05', false), player('b')] })
    );
  });
  it('applies the December 16 carve-out only from the day before this season’s deadline', () => {
    const outgoing = [player('a', '2025-12-16T23:59:59-05:00'), player('b')];
    expect(
      evaluate({ outgoing, transactionDate: '2026-02-03' }).violations.length
    ).toBe(1);
    passes(evaluate({ outgoing, transactionDate: '2026-02-04' }));
    expect(
      evaluate({
        outgoing: [player('a', '2025-12-17T00:00:00-05:00'), player('b')],
        transactionDate: '2026-02-04',
      }).violations.length
    ).toBe(1);
    expect(
      evaluate({
        outgoing,
        transactionDate: '2026-02-04',
        deadline: null,
      }).missingInputs.join()
    ).toContain('CBA2-A06.2');
  });
  it('does not clear missing, malformed or future acquisition facts', () => {
    const unknown = { playerId: 'a', playerName: 'a' };
    expect(
      evaluate({ outgoing: [unknown, player('b')] }).missingInputs.join()
    ).toContain('CBA2-A06.1');
    expect(
      evaluate({
        outgoing: [{ ...unknown, aggregationFacts: {} }, player('b')],
      }).missingInputs.length
    ).toBe(1);
    expect(
      evaluate({
        outgoing: [player('a', '2026-06-06'), player('b')],
      }).missingInputs.join()
    ).toContain('later');
  });
  it('does not invent a clock time when a two-month boundary mixes date precision', () => {
    expect(
      evaluate({
        outgoing: [player('a', '2026-04-05T12:00:00-04:00'), player('b')],
      }).missingInputs.join()
    ).toContain('eligibility instant');
    expect(
      evaluate({
        transactionDate: '2026-06-05T11:00:00-04:00',
        outgoing: [
          player('a', '2026-06-05T12:00:00-04:00', false),
          player('b'),
        ],
      }).missingInputs.join()
    ).toContain('later');
    passes(evaluate({ outgoing: [player('a', '2026-04-05'), player('b')] }));
  });
  it('limits three-out/two-in aggregation to one next-season minimum on June 5', () => {
    const outgoing = [
      player('a', undefined, true, true),
      player('b', undefined, true, true),
      player('c'),
    ];
    expect(
      evaluate({ outgoing, replacementCount: 2 }).violations.join()
    ).toContain('CBA2-A06.3');
    passes(
      evaluate({
        outgoing: [outgoing[0], player('b'), player('c')],
        replacementCount: 2,
      })
    );
    passes(evaluate({ outgoing, replacementCount: 3 }));
    passes(evaluate({ outgoing: outgoing.slice(0, 2), replacementCount: 1 }));
  });
  it('keeps the December 15-through-deadline stacking window inclusive', () => {
    const outgoing = [
      player('a', undefined, true, true, 2026),
      player('b', undefined, true, true, 2026),
      player('c'),
    ];
    expect(
      evaluate({ outgoing, transactionDate: '2025-12-14' }).violations.join()
    ).toContain('CBA2-A06.3');
    passes(evaluate({ outgoing, transactionDate: '2025-12-15' }));
    passes(evaluate({ outgoing, transactionDate: '2026-02-05' }));
    expect(
      evaluate({ outgoing, transactionDate: '2026-02-06' }).violations.join()
    ).toContain('CBA2-A06.3');
  });
  it('requires next-season classifications only after the last Regular Season day', () => {
    const outgoing = [
      player('a', undefined, true, true, 2026),
      player('b', undefined, true, true, 2026),
      player('c'),
    ];
    expect(
      evaluate({ outgoing, transactionDate: '2026-04-12' }).violations.join()
    ).toContain('CBA2-A06.3');
    expect(
      evaluate({ outgoing, transactionDate: '2026-04-13' }).missingInputs.join()
    ).toContain('2026-27');
    expect(
      evaluate({
        outgoing: [
          player('a'),
          player('b', undefined, true, null),
          player('c'),
        ],
      }).missingInputs
    ).toEqual([]);
    expect(
      evaluate({
        outgoing: [
          player('a', undefined, true, true),
          player('b', undefined, true, null),
          player('c'),
        ],
      }).missingInputs.join()
    ).toContain('classification');
  });
});

describe('saved acquisition authority', () => {
  it.each([
    'MINIMUM_EXCEPTION',
    'NON_TAXPAYER_MLE',
    'BI_ANNUAL_EXCEPTION',
    'ROOM_MLE',
    'STANDARD_TPE',
    'ROOM',
  ] as const)(
    'records and preserves the validated %s method through normalization and copying',
    (path) => {
      const updates: TradeTeamUpdate[] = [
        {
          teamCode: 'BOS',
          team: { teamCode: 'BOS', players: [{ playerId: 'a' }] },
        },
      ];
      const evaluation = {
        status: 'PASS',
        components: [
          {
            path,
            incomingPlayers: [{ playerId: 'a', playerName: 'a', salary: 1 }],
          },
        ],
      } as TradeSalaryPathEvaluation;
      const input = {
        teamUpdates: updates,
        movements: [{ playerId: 'a', destinationTeamCode: 'BOS' }],
        salaryMatchingPaths: [{ teamCode: 'BOS', evaluation }],
        transactionId: 'trade-1',
        asOfDate: '2026-06-05',
      };
      expect(recordTradeAcquisitions(input)).toBeNull();
      expect(recordTradeAcquisitions(input)).toBeNull();
      const history = updates[0].team!.tradeAcquisitionHistory!;
      expect(history.baseline).toBeNull();
      expect(history.entries).toEqual([
        {
          transactionId: 'trade-1',
          playerId: 'a',
          teamCode: 'BOS',
          acquiredAt: '2026-06-05',
          viaException: path !== 'ROOM',
        },
      ]);
      expect(
        normalizeCurrentStateTeamMutationCore(updates[0].team!)
          .tradeAcquisitionHistory
      ).toEqual(history);
      expect(
        JSON.parse(JSON.stringify(updates[0].team)).tradeAcquisitionHistory
      ).toEqual(history);
      expect(
        validatePersistableShape({
          obj: { tradeAcquisitionHistory: history },
          allowlist: PERSISTENCE_CONTRACTS.TEAM.topLevel,
          label: 'TEAM',
          deepRules: PERSISTENCE_CONTRACTS.TEAM.deepRules,
        })
      ).toMatchObject({ valid: true });
      expect(
        recordTradeAcquisitions({ ...input, asOfDate: '2026-06-06' })
      ).toContain('conflicts');
    }
  );
  it('cannot treat missing components or an unknown world date as a cleared acquisition', () => {
    const updates: TradeTeamUpdate[] = [
      { teamCode: 'BOS', team: { players: [{ playerId: 'a' }] } },
    ];
    const input = {
      teamUpdates: updates,
      movements: [{ playerId: 'a', destinationTeamCode: 'BOS' }],
      salaryMatchingPaths: [
        {
          teamCode: 'BOS',
          evaluation: {
            status: 'PASS',
            components: [],
          } as unknown as TradeSalaryPathEvaluation,
        },
      ],
      transactionId: 'trade-1',
      asOfDate: undefined,
    };
    expect(recordTradeAcquisitions(input)).toContain('unavailable');
    expect(updates[0].team!.tradeAcquisitionHistory).toBeUndefined();
  });
  function state() {
    const contract = makeResultingState();
    contract.terms.restrictions.aggregation = true;
    return contract;
  }
  function facts(history?: unknown) {
    return contractAggregationFacts({
      state: state(),
      teamId: 'BOS',
      asOfDate: '2026-06-05',
      salaryCapYear: 2026,
      regularSeasonEnd: '2026-04-12',
      history,
    });
  }
  it('does not add baseline clearance to an older world, and never clears a known restriction', () => {
    expect(facts().acquisition.status).toBe('unknown');
    const contract = state();
    const history = {
      version: 1,
      baseline: {
        asOfDate: '2026-06-05',
        playerIds: [contract.playerId],
        assumptionId: 'starting-roster-acquisitions',
      },
      entries: [],
    };
    expect(facts(history).acquisition.status).toBe('baseline-assumption');
    contract.terms.restrictions.aggregation = false;
    expect(
      contractAggregationFacts({
        state: contract,
        teamId: 'BOS',
        asOfDate: '2026-06-05',
        salaryCapYear: 2026,
        regularSeasonEnd: '2026-04-12',
        history,
      }).acquisition.status
    ).toBe('unknown');
  });
  it('uses the latest saved acquisition, including a return after a room acquisition', () => {
    const contract = state();
    const entries = [true, false].map((viaException, i) => ({
      transactionId: `trade-${i}`,
      playerId: contract.playerId,
      teamCode: 'BOS',
      acquiredAt: '2026-06-05',
      viaException,
    }));
    expect(
      facts({ version: 1, baseline: null, entries }).acquisition
    ).toMatchObject({ status: 'known', viaException: false });
    expect(
      facts({
        version: 1,
        baseline: null,
        entries: [{ ...entries[0], teamCode: 'CHI' }],
      }).acquisition.status
    ).toBe('unknown');
  });
  it('uses a known recent signing instead of the starting-roster assumption', () => {
    const contract = state();
    contract.terms.signingTeam = 'BOS';
    contract.terms.signingDate = {
      precision: 'date',
      value: '2026-05-15',
      rawValue: '2026-05-15',
    };
    contract.terms.signedUsing = null;
    const input = {
      state: contract,
      teamId: 'BOS',
      asOfDate: '2026-06-05',
      salaryCapYear: 2026,
      regularSeasonEnd: '2026-04-12',
      history: {
        version: 1,
        baseline: {
          asOfDate: '2026-06-05',
          playerIds: [contract.playerId],
          assumptionId: 'starting-roster-acquisitions',
        },
        entries: [],
      },
    };
    expect(contractAggregationFacts(input).acquisition).toEqual({
      status: 'known',
      acquiredAt: '2026-05-15',
      viaException: true,
    });
    contract.terms.signedUsing = 'Cap Space';
    expect(contractAggregationFacts(input).acquisition).toMatchObject({
      status: 'known',
      viaException: false,
    });
  });
  it('classifies compensation using the correct Contract-start/year/YOS table cell', () => {
    const contract = state();
    contract.terms.signedUsing = 'Cap Space';
    contract.terms.startSeason = '2025-26';
    contract.terms.birdRights.yearsOfService = 2;
    const row = contract.terms.salaries[0];
    contract.terms.salaries = [
      { ...row, season: '2025-26', salary: 2_000_000 },
      { ...row, season: '2026-27', salary: 3_000_000 },
    ];
    contract.terms.tradeSalaryBasisEvidence = {
      evidenceVersion: 1,
      earnedBaseCompensation: [],
      oneYearMinimum: null,
      poisonPill: null,
      minimumSalaryAmounts: [
        {
          salaryCapYear: 2027,
          contractStartSalaryCapYear: 2026,
          contractYear: 2,
          yearsOfService: 2,
          amount: 2_100_000,
        },
      ],
    };
    const input = {
      state: contract,
      teamId: 'BOS',
      asOfDate: '2026-06-05',
      salaryCapYear: 2026,
      regularSeasonEnd: '2026-04-12',
    };
    expect(contractAggregationFacts(input)).toMatchObject({
      minimumSalaryCapYear: 2027,
      minimumTradedPlayer: false,
    });
    contract.terms.signedUsing = 'Minimum';
    expect(contractAggregationFacts(input).minimumTradedPlayer).toBeNull();
    contract.terms.salaries[1].salary = 2_100_000;
    expect(contractAggregationFacts(input).minimumTradedPlayer).toBe(true);
    contract.terms.salaries.pop();
    expect(contractAggregationFacts(input).minimumTradedPlayer).toBeNull();
  });
});
