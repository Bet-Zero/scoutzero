import { describe, expect, it } from 'vitest';
import { TradeHardCapLedgerZ } from '@/schemas/tradeApronRestriction';
import {
  createTradeHardCapLedgerEntry,
  evaluateTradeApronRestriction,
  parseTradeHardCapLedger,
  selectHardCapLedgerEntry,
  type TradeApronRestrictionEvaluation,
} from '@/features/architect/utils/tradeMachine/utils/tradeApronRestrictions';
import { getHardCapStatus } from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import { validateHardCap } from '@/features/architect/utils/tradeMachine/rules/hardCapValidation';
import { createTPE } from '@/features/architect/utils/tradeMachine/utils/tpeValidation';
import { hydrateBaseTeam } from '@/features/architect/utils/firebaseTeamPlanHelpers';
import type {
  TradeSalaryPathComponent,
  TradeSalaryPathEvaluation,
} from '@/features/architect/utils/tradeMachine/utils/tradeSalaryMatchingPaths';
import type {
  TradeTeam,
  TradeValidatorContext,
} from '@/features/architect/utils/tradeMachine/constants/types';

const FIRST_APRON = 209_015_000;
const SECOND_APRON = 221_686_000;

function electedComponent(
  path: 'STANDARD_TPE' | 'AGGREGATED_STANDARD_TPE'
): TradeSalaryPathComponent {
  return {
    componentId: `${path.toLowerCase()}:players`,
    kind: 'ELECTED_PATH',
    path,
    timing: 'SIMULTANEOUS',
    outgoingPlayers: [],
    incomingPlayers: [],
    maximumIncoming: 0,
    usedIncoming: 0,
    remaining: 0,
  };
}

function heldComponent(tpeId = 'TPE-1'): TradeSalaryPathComponent {
  return {
    componentId: tpeId,
    kind: 'HELD_STANDARD_TPE',
    path: 'STANDARD_TPE',
    timing: 'NON_SIMULTANEOUS',
    outgoingPlayers: [],
    incomingPlayers: [
      { playerId: 'PLAYER-1', playerName: 'Player One', salary: 5_000_000 },
    ],
    maximumIncoming: 8_000_000,
    usedIncoming: 5_000_000,
    remaining: 3_000_000,
  };
}

function pathEvaluation({
  path,
  postSalary,
  components,
}: {
  path: 'STANDARD_TPE' | 'AGGREGATED_STANDARD_TPE';
  postSalary: number;
  components?: TradeSalaryPathComponent[];
}): TradeSalaryPathEvaluation {
  return {
    status: 'PASS',
    passed: true,
    electedPath: path,
    ruleLabel: path,
    formula: 'fixture',
    allowance: 250_000,
    postAssignmentApronTeamSalary: postSalary,
    firstApron: FIRST_APRON,
    maximumIncoming: 10_000_000,
    actualIncoming: 5_000_000,
    margin: 5_000_000,
    components: components ?? [electedComponent(path)],
    missingInputs: [],
    violations: [],
    canonLeafIds: [],
    election: {
      version: 1,
      path,
      postAssignmentApronTeamSalary: postSalary,
      tradedPlayerPreTradeSalaries: {},
    },
  };
}

function context(tradeDate: string): TradeValidatorContext {
  return {
    source: 'tradeMachine',
    worldId: 'WORLD-1',
    currentYear: 2027,
    yearKey: 2027,
    tradeDate,
    asOfDate: tradeDate,
    capSettings: {
      salaryCap: 164_961_000,
      firstApron: FIRST_APRON,
      secondApron: SECOND_APRON,
    },
  };
}

function team(postSalary: number, tpes: Array<Record<string, unknown>> = []): TradeTeam {
  return {
    teamId: 'DET',
    projectedSalary: postSalary,
    teamTotalSalary: postSalary,
    team: {
      id: 'DET',
      teamCode: 'DET',
      apronTeamSalary: postSalary,
      exceptions: { tpe: tpes as never[] },
    },
  };
}

function evaluateAggregated(postSalary: number) {
  return evaluateTradeApronRestriction({
    team: team(postSalary),
    teamCode: 'DET',
    pathEvaluation: pathEvaluation({
      path: 'AGGREGATED_STANDARD_TPE',
      postSalary,
    }),
    context: context('2026-07-15T12:00:00-04:00'),
  });
}

describe('governed Trade Machine apron restrictions', () => {
  it('CBA2-A05.10/A05.1: classifies Row H and distinguishes equality from one cent above', () => {
    const atCeiling = evaluateAggregated(SECOND_APRON);
    const above = evaluateAggregated(SECOND_APRON + 0.01);

    expect(atCeiling).toMatchObject({
      status: 'PASS',
      restrictionRow: 'H',
      apronLevel: 'SECOND_APRON',
      ceiling: SECOND_APRON,
      margin: 0,
      hardCapWillPersist: true,
    });
    expect(atCeiling.canonLeafIds).toEqual([
      'CBA2-A05.10',
      'CBA2-A05.1',
      'CBA2-A05.2',
    ]);
    expect(above.status).toBe('FAIL');
    expect(above.margin).toBeCloseTo(-0.01, 6);
    expect(above.hardCapWillPersist).toBe(false);
  });

  it('CBA2-A05.8: Row F attaches only after the governed regular-season closing day', () => {
    const heldTpe = {
      id: 'TPE-1',
      amount: 8_000_000,
      remainingAmount: 8_000_000,
      createdOn: '2026-11-01T12:00:00-04:00',
      expiresOn: '2027-11-01T12:00:00-04:00',
    };
    const salaryPath = pathEvaluation({
      path: 'STANDARD_TPE',
      postSalary: FIRST_APRON,
      components: [heldComponent()],
    });
    const onClosingDay = evaluateTradeApronRestriction({
      team: team(FIRST_APRON, [heldTpe]),
      teamCode: 'DET',
      pathEvaluation: salaryPath,
      context: context('2027-04-11T23:59:59-04:00'),
    });
    const afterClosingDay = evaluateTradeApronRestriction({
      team: team(FIRST_APRON, [heldTpe]),
      teamCode: 'DET',
      pathEvaluation: salaryPath,
      context: context('2027-04-12T00:00:00-04:00'),
    });

    expect(onClosingDay.status).toBe('NOT_APPLICABLE');
    expect(onClosingDay.restrictionRow).toBeNull();
    expect(afterClosingDay).toMatchObject({
      status: 'PASS',
      restrictionRow: 'F',
      apronLevel: 'FIRST_APRON',
      ceiling: FIRST_APRON,
      regularSeasonClosing: '2027-04-11',
      hardCapWillPersist: true,
    });
    expect(afterClosingDay.canonLeafIds).toEqual([
      'CBA2-A02.3',
      'CBA2-A05.8',
      'CBA2-A05.1',
      'CBA2-A05.2',
    ]);
  });

  it('CBA2-A02.3: needs exact time on the expiry day and rejects one second late', () => {
    const heldTpe = {
      id: 'TPE-1',
      amount: 8_000_000,
      remainingAmount: 8_000_000,
      createdOn: '2026-04-12T12:00:00-04:00',
      expiresOn: '2027-04-12T12:00:00-04:00',
    };
    const salaryPath = pathEvaluation({
      path: 'STANDARD_TPE',
      postSalary: FIRST_APRON,
      components: [heldComponent()],
    });
    const dateOnly = evaluateTradeApronRestriction({
      team: team(FIRST_APRON, [heldTpe]),
      teamCode: 'DET',
      pathEvaluation: salaryPath,
      context: context('2027-04-12'),
    });
    const oneSecondLate = evaluateTradeApronRestriction({
      team: team(FIRST_APRON, [heldTpe]),
      teamCode: 'DET',
      pathEvaluation: salaryPath,
      context: context('2027-04-12T12:00:01-04:00'),
    });

    expect(dateOnly.status).toBe('NEEDS_INPUT');
    expect(dateOnly.missingInputs).toContain(
      'transactionDate.exactTimeAtTpeExpiry'
    );
    expect(oneSecondLate.status).toBe('FAIL');
    expect(oneSecondLate.canonLeafIds).toEqual(['CBA2-A02.3']);
  });

  it('fails closed when held Standard TPE creation evidence is missing', () => {
    const evaluation = evaluateTradeApronRestriction({
      team: team(FIRST_APRON, [
        {
          id: 'TPE-1',
          amount: 8_000_000,
          remainingAmount: 8_000_000,
          expiresOn: '2027-11-01T12:00:00-04:00',
        },
      ]),
      teamCode: 'DET',
      pathEvaluation: pathEvaluation({
        path: 'STANDARD_TPE',
        postSalary: FIRST_APRON,
        components: [heldComponent()],
      }),
      context: context('2027-04-12T12:00:00-04:00'),
    });

    expect(evaluation.status).toBe('NEEDS_INPUT');
    expect(evaluation.missingInputs).toContain('heldTpe.TPE-1.createdOn');
  });

  it('does not manufacture Row F for a simultaneous Standard TPE', () => {
    const evaluation = evaluateTradeApronRestriction({
      team: team(FIRST_APRON),
      teamCode: 'DET',
      pathEvaluation: pathEvaluation({
        path: 'STANDARD_TPE',
        postSalary: FIRST_APRON,
      }),
      context: context('2027-04-12T12:00:00-04:00'),
    });

    expect(evaluation.status).toBe('NOT_APPLICABLE');
    expect(evaluation.restrictionRow).toBeNull();
  });

  it('does not classify a TPE created after the current season closing as aged Row F', () => {
    const evaluation = evaluateTradeApronRestriction({
      team: team(FIRST_APRON, [
        {
          id: 'TPE-1',
          amount: 8_000_000,
          remainingAmount: 8_000_000,
          createdOn: '2027-06-01T12:00:00-04:00',
          expiresOn: '2028-06-01T12:00:00-04:00',
        },
      ]),
      teamCode: 'DET',
      pathEvaluation: pathEvaluation({
        path: 'STANDARD_TPE',
        postSalary: FIRST_APRON,
        components: [heldComponent()],
      }),
      context: context('2027-06-15T12:00:00-04:00'),
    });

    expect(evaluation.status).toBe('NOT_APPLICABLE');
    expect(evaluation.restrictionRow).toBeNull();
  });

  it('reconciles every held TPE component and keeps their identities in the ledger', () => {
    const tpes = [
      {
        id: 'TPE-1',
        amount: 8_000_000,
        remainingAmount: 8_000_000,
        createdOn: '2026-11-01T12:00:00-04:00',
        expiresOn: '2027-11-01T12:00:00-04:00',
      },
      {
        id: 'TPE-2',
        amount: 6_000_000,
        remainingAmount: 6_000_000,
        createdOn: '2026-12-01T12:00:00-05:00',
        expiresOn: '2027-12-01T12:00:00-05:00',
      },
    ];
    const evaluation = evaluateTradeApronRestriction({
      team: team(FIRST_APRON, tpes),
      teamCode: 'DET',
      pathEvaluation: pathEvaluation({
        path: 'STANDARD_TPE',
        postSalary: FIRST_APRON,
        components: [heldComponent('TPE-1'), heldComponent('TPE-2')],
      }),
      context: context('2027-04-12T12:00:00-04:00'),
    });
    const entry = createTradeHardCapLedgerEntry({
      evaluation,
      teamCode: 'DET',
      transactionId: 'TRADE-MULTI',
      effectiveAt: '2027-04-12T16:00:00Z',
    });

    expect(evaluation.status).toBe('PASS');
    expect(evaluation.tpeTimings.map((timing) => timing.tpeId)).toEqual([
      'TPE-1',
      'TPE-2',
    ]);
    expect(entry?.tpeIds).toEqual(['TPE-1', 'TPE-2']);
  });

  it('fails closed when persisted expiry does not reconcile to the one-year window', () => {
    const evaluation = evaluateTradeApronRestriction({
      team: team(FIRST_APRON, [
        {
          id: 'TPE-1',
          amount: 8_000_000,
          remainingAmount: 8_000_000,
          createdOn: '2026-11-01T12:00:00-04:00',
          expiresOn: '2027-11-02T12:00:00-04:00',
        },
      ]),
      teamCode: 'DET',
      pathEvaluation: pathEvaluation({
        path: 'STANDARD_TPE',
        postSalary: FIRST_APRON,
        components: [heldComponent()],
      }),
      context: context('2027-04-12T12:00:00-04:00'),
    });

    expect(evaluation.status).toBe('NEEDS_INPUT');
    expect(evaluation.missingInputs).toContain(
      'heldTpe.TPE-1.expiresOn.oneYearReconciliation'
    );
  });

  it('CBA2-A05.2: creates, reloads, and enforces an exact season-keyed hard cap', () => {
    const evaluation = evaluateAggregated(SECOND_APRON);
    const entry = createTradeHardCapLedgerEntry({
      evaluation,
      teamCode: 'DET',
      transactionId: 'TRADE-1',
      effectiveAt: '2026-07-15T16:00:00Z',
    });
    expect(entry).not.toBeNull();
    expect(TradeHardCapLedgerZ.parse([entry])).toHaveLength(1);

    const serialized = JSON.parse(JSON.stringify([entry]));
    expect(parseTradeHardCapLedger(serialized).valid).toBe(true);
    expect(selectHardCapLedgerEntry(serialized, 2027)?.entryId).toBe(
      'TRADE-1:hard-cap:DET'
    );
    expect(selectHardCapLedgerEntry(serialized, 2028)).toBeNull();

    const status = getHardCapStatus(
      { hardCapLedger: serialized },
      {
        salaryCapYear: 2027,
        capSettings: { firstApron: FIRST_APRON, secondApron: SECOND_APRON },
      }
    );
    expect(status).toMatchObject({
      isHardCapped: true,
      hardCapType: 'SECOND_APRON',
      hardCapCeiling: SECOND_APRON,
      source: 'team.hardCapLedger.TRADE-1:hard-cap:DET',
    });

    const allowed = validateHardCap(
      {
        teamTotalSalary: SECOND_APRON,
        projectedSalary: SECOND_APRON,
        hardCapLedger: serialized,
        capSettings: { firstApron: FIRST_APRON, secondApron: SECOND_APRON },
      } as never,
      context('2026-12-01T12:00:00-05:00')
    );
    const blocked = validateHardCap(
      {
        teamTotalSalary: SECOND_APRON,
        projectedSalary: SECOND_APRON + 0.01,
        hardCapLedger: serialized,
        capSettings: { firstApron: FIRST_APRON, secondApron: SECOND_APRON },
      } as never,
      context('2026-12-01T12:00:00-05:00')
    );
    expect(allowed.passed).toBe(true);
    expect(blocked.passed).toBe(false);
    expect(blocked.violations[0]).toMatch(/hard cap violation/i);
  });

  it('treats malformed persisted hard-cap history as fail-closed unknown state', () => {
    const status = getHardCapStatus(
      { hardCapLedger: [{ version: 999 }] as never },
      {
        salaryCapYear: 2027,
        capSettings: { firstApron: FIRST_APRON, secondApron: SECOND_APRON },
      }
    );
    expect(status).toMatchObject({
      isHardCapped: true,
      hardCapType: 'UNKNOWN',
      failClosed: true,
    });
  });

  it('fails closed instead of applying a persisted hard cap without its salary cap year', () => {
    const entry = createTradeHardCapLedgerEntry({
      evaluation: evaluateAggregated(SECOND_APRON),
      teamCode: 'DET',
      transactionId: 'TRADE-NO-YEAR',
      effectiveAt: '2026-07-15T16:00:00Z',
    });
    const status = getHardCapStatus(
      { hardCapLedger: [entry] },
      { capSettings: { firstApron: FIRST_APRON, secondApron: SECOND_APRON } }
    );

    expect(status).toMatchObject({
      isHardCapped: true,
      hardCapType: 'UNKNOWN',
      failClosed: true,
      activeHardCapLedgerEntry: null,
    });
  });

  it('preserves validated persisted hard-cap history through saved-team hydration', async () => {
    const entry = createTradeHardCapLedgerEntry({
      evaluation: evaluateAggregated(SECOND_APRON),
      teamCode: 'DET',
      transactionId: 'TRADE-HYDRATE',
      effectiveAt: '2026-07-15T16:00:00Z',
    });
    expect(entry).not.toBeNull();

    const hydrated = await hydrateBaseTeam('DET', {
      roster: [],
      teamName: 'Detroit Pistons',
      exceptions: {},
      hardCapLedger: entry ? [entry] : [],
    });

    expect(hydrated.hardCapLedger).toEqual([entry]);
    expect(
      getHardCapStatus(hydrated, {
        salaryCapYear: 2027,
        capSettings: { firstApron: FIRST_APRON, secondApron: SECOND_APRON },
      }).hardCapCeiling
    ).toBe(SECOND_APRON);
  });

  it('normalizes generated TPE creation and expiry into the same UTC calendar frame', () => {
    const tpe = createTPE({
      teamCtx: { isOverCap: true },
      outgoing: 8_000_000,
      incoming: 2_000_000,
      tradeDate: '2026-11-01T21:00:00-04:00',
    });

    expect(tpe?.createdOn).toBe('2026-11-02T01:00:00.000Z');
    expect(tpe?.expiresOn).toBe('2027-11-02T01:00:00.000Z');
  });

  it('does not persist a hard cap for a failed restriction', () => {
    const failed = evaluateAggregated(SECOND_APRON + 1);
    expect(
      createTradeHardCapLedgerEntry({
        evaluation: failed as TradeApronRestrictionEvaluation,
        teamCode: 'DET',
        transactionId: 'TRADE-FAIL',
        effectiveAt: '2026-07-15T16:00:00Z',
      })
    ).toBeNull();
  });

  it('does not persist a hard cap without an attributable team code', () => {
    expect(
      createTradeHardCapLedgerEntry({
        evaluation: evaluateAggregated(SECOND_APRON),
        teamCode: '   ',
        transactionId: 'TRADE-NO-TEAM',
        effectiveAt: '2026-07-15T16:00:00Z',
      })
    ).toBeNull();
  });
});
