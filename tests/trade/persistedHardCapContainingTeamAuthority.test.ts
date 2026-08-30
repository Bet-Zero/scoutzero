import { describe, expect, it } from 'vitest';
import { GovernedCashLedgerZ } from '@/schemas/governedCashConsideration';
import type { TradeHardCapLedgerEntry } from '@/schemas/tradeApronRestriction';
import {
  createTradeHardCapLedgerEntry,
  evaluateTradeApronRestriction,
} from '@/features/architect/utils/tradeMachine/utils/tradeApronRestrictions';
import { parsePersistedTradeHardCapLedger } from '@/features/architect/utils/tradeMachine/utils/tradeHardCapLedgerAuthority';
import { evaluateGovernedCashConsideration } from '@/features/architect/utils/tradeMachine/utils/governedCashConsideration';
import { CANON_GOVERNED_SEASON_REGISTRY } from '@/features/architect/utils/governedSeason';
import { hydrateBaseTeam } from '@/features/architect/utils/firebaseTeamPlanHelpers';
import {
  normalizeTradeMutationCurrentState,
  toCurrentStateTeam,
} from '@/features/architect/utils/mutationPipeline.read.normalizeTeam';
import {
  getHardCapStatus,
  getHardCapStatusFromContext,
} from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import { validateHardCap } from '@/features/architect/utils/tradeMachine/rules/hardCapValidation';
import { validateSalaryMatching } from '@/features/architect/utils/tradeMachine/rules/validateSalaryMatching';
import { validatePostStateCapLegality } from '@/features/architect/utils/capLegality/postStateCapValidator';
import type {
  TeamContext,
  TradeTeam,
} from '@/features/architect/utils/tradeMachine/constants/types';
import type { TradeSalaryPathEvaluation } from '@/features/architect/utils/tradeMachine/utils/tradeSalaryMatchingPaths';

const WORLD_ID = 'world-bze-298';
const TRANSACTION_AT = '2026-07-15T12:00:00-04:00';
const SALARY_CAP_YEAR = 2027;
const SECOND_APRON = 221_686_000;
const TRANSACTION_ID = 'trade-bze-298-row-i';

function context(
  tradeDate = TRANSACTION_AT,
  worldId = WORLD_ID,
  worldLineage: readonly string[] = [worldId]
): TeamContext {
  return {
    source: 'tradeMachine',
    worldId,
    worldLineage,
    currentYear: SALARY_CAP_YEAR,
    yearKey: SALARY_CAP_YEAR,
    tradeDate,
    asOfDate: tradeDate,
    capSettings: {
      salaryCap: 164_961_000,
      firstApron: 209_015_000,
      secondApron: SECOND_APRON,
    },
  };
}

function emptyCashLedger(teamCode: string) {
  return {
    ledgerVersion: 0,
    ledgerId: `cash-ledger:${teamCode}`,
    teamId: teamCode,
    entries: [],
  };
}

function cashPayingTeam(teamCode: string): TradeTeam {
  return {
    teamId: teamCode,
    teamCode,
    cashSent: 1,
    cashReceived: 0,
    projectedSalary: SECOND_APRON,
    teamTotalSalary: SECOND_APRON,
    team: {
      id: teamCode,
      teamCode,
      apronTeamSalary: SECOND_APRON,
      cashLedger: emptyCashLedger(teamCode),
    },
  };
}

function roomPath(): TradeSalaryPathEvaluation {
  return {
    status: 'PASS',
    passed: true,
    electedPath: 'ROOM',
    ruleLabel: 'ROOM',
    formula: 'fixture',
    allowance: 0,
    postAssignmentApronTeamSalary: SECOND_APRON,
    firstApron: 209_015_000,
    maximumIncoming: 0,
    actualIncoming: 0,
    margin: 0,
    components: [],
    missingInputs: [],
    violations: [],
    canonLeafIds: [],
    election: {
      version: 1,
      path: 'ROOM',
      postAssignmentApronTeamSalary: SECOND_APRON,
      tradedPlayerPreTradeSalaries: {},
    },
  };
}

function productGeneratedRowI(
  teamCode = 'MIA',
  tradeDate = TRANSACTION_AT,
  provenanceWorldId = WORLD_ID,
  transactionId = TRANSACTION_ID
) {
  const team = cashPayingTeam(teamCode);
  const cashEvaluation = evaluateGovernedCashConsideration({
    team,
    context: context(tradeDate, provenanceWorldId),
  });
  if (
    cashEvaluation.status !== 'PASS' ||
    !cashEvaluation.proof ||
    cashEvaluation.cashSentCents === null ||
    cashEvaluation.salaryCapYear === null ||
    !cashEvaluation.transactionAt
  ) {
    throw new Error('expected governed cash authority');
  }

  const cashLedger = GovernedCashLedgerZ.parse({
    ledgerVersion: 1,
    ledgerId: `cash-ledger:${teamCode}`,
    teamId: teamCode,
    entries: [
      {
        entryVersion: 1,
        entryId: `${transactionId}:cash:${teamCode}:PAID:DEN`,
        transactionId,
        worldId: provenanceWorldId,
        teamId: teamCode,
        counterpartyTeamId: 'DEN',
        direction: 'PAID',
        amountCents: cashEvaluation.cashSentCents,
        salaryCapYear: cashEvaluation.salaryCapYear,
        transactionAt: cashEvaluation.transactionAt,
        recordedAt: '2026-07-15T16:00:00Z',
        canonLeafIds: [...cashEvaluation.canonLeafIds, 'CBA2-A05.11'],
        proof: cashEvaluation.proof,
      },
    ],
  });
  const apronEvaluation = evaluateTradeApronRestriction({
    team,
    teamCode,
    pathEvaluation: roomPath(),
    context: context(tradeDate, provenanceWorldId),
  });
  const hardCapEntry = createTradeHardCapLedgerEntry({
    evaluation: apronEvaluation,
    teamCode,
    transactionId,
    effectiveAt: '2026-07-15T16:00:00Z',
  });
  if (!hardCapEntry) throw new Error('expected product-generated Row I entry');

  return { hardCapLedger: [hardCapEntry], cashLedger };
}

function productFormatEntryForRow(
  row: 'C' | 'F' | 'H',
  teamCode = 'MIA'
): TradeHardCapLedgerEntry {
  const calendar = CANON_GOVERNED_SEASON_REGISTRY.calendars.find(
    (candidate) =>
      candidate.recordStatus === 'current' &&
      candidate.authority === 'official' &&
      candidate.salaryCapYear === SALARY_CAP_YEAR
  );
  const apronLevel = row === 'H' ? 'SECOND_APRON' : 'FIRST_APRON';
  const levelId = row === 'H' ? 'second-apron' : 'first-apron';
  const level = CANON_GOVERNED_SEASON_REGISTRY.systemLevels.find(
    (candidate) =>
      candidate.recordStatus === 'current' &&
      candidate.authority === 'official' &&
      candidate.salaryCapYear === SALARY_CAP_YEAR &&
      candidate.levelId === levelId
  );
  if (!calendar || !level) throw new Error('expected governed row authority');
  const proof = {
    registryId: CANON_GOVERNED_SEASON_REGISTRY.registryId,
    registryVersion: CANON_GOVERNED_SEASON_REGISTRY.registryVersion,
    canonCandidateCommit: CANON_GOVERNED_SEASON_REGISTRY.canonCandidateCommit,
    canonSha256: CANON_GOVERNED_SEASON_REGISTRY.canonSha256,
    calendarRecordId: calendar.recordId,
    calendarRecordVersion: calendar.recordVersion,
    apronRecordId: level.recordId,
    apronRecordVersion: level.recordVersion,
  };
  const componentId =
    row === 'C'
      ? 'sign-and-trade:player-1'
      : row === 'F'
        ? 'tpe-row-f'
        : 'aggregated-standard-tpe:players';
  const salaryMatchingPath =
    row === 'F'
      ? 'STANDARD_TPE'
      : row === 'H'
        ? 'AGGREGATED_STANDARD_TPE'
        : 'ROOM';
  const canonLeafIds =
    row === 'C'
      ? ['CBA2-A05.5', 'CBA2-A05.1']
      : row === 'F'
        ? ['CBA2-A02.3', 'CBA2-A05.8', 'CBA2-A05.1']
        : ['CBA2-A05.10', 'CBA2-A05.1'];
  const trigger = {
    restrictionRow: row,
    componentId,
    componentKind:
      row === 'C'
        ? ('SIGN_AND_TRADE' as const)
        : row === 'F'
          ? ('HELD_STANDARD_TPE' as const)
          : ('ELECTED_PATH' as const),
    salaryMatchingPath,
    apronLevel,
    ceiling: level.amount,
    incomingPlayers: [
      { playerId: 'player-1', playerName: 'Player One', salary: 1_000_000 },
    ],
    cashAmountCents: null,
    tpeTiming:
      row === 'F'
        ? {
            tpeId: componentId,
            createdOn: '2026-07-15T12:00:00-04:00',
            expiresOn: '2027-07-15T12:00:00-04:00',
          }
        : null,
    regularSeasonClosing:
      row === 'F' ? calendar.regularSeasonClosing.value : null,
    canonLeafIds,
    proof,
  };

  return {
    version: 1,
    entryId: `trade-${row}:hard-cap:${teamCode}`,
    teamCode,
    salaryCapYear: SALARY_CAP_YEAR,
    restrictionRow: row,
    salaryMatchingPath,
    apronLevel,
    ceiling: level.amount,
    triggerTransactionDate: TRANSACTION_AT,
    effectiveAt: '2026-07-15T16:00:00Z',
    expiresAt: '2027-07-01T04:00:00Z',
    transactionId: `trade-${row}`,
    tpeIds: row === 'F' ? [componentId] : [],
    tpeTimings: row === 'F' && trigger.tpeTiming ? [trigger.tpeTiming] : [],
    canonLeafIds,
    proof,
    triggers: [trigger],
  };
}

function persistedTeam(
  hardCapLedger: TradeHardCapLedgerEntry[],
  cashLedger: unknown
) {
  return {
    teamCode: 'MIA',
    roster: [],
    players: [],
    hardCapLedger,
    cashLedger,
    totals: {
      yearKey: SALARY_CAP_YEAR,
      playersTotal: SECOND_APRON,
      deadMoneyTotal: 0,
      capHoldsTotal: 0,
      incompleteChargesTotal: 0,
      totalCapAllocations: SECOND_APRON,
      teamSalary: SECOND_APRON,
      apronTeamSalary: SECOND_APRON,
      taxSalary: SECOND_APRON,
      salaryCap: 164_961_000,
      luxuryTax: 187_895_000,
      firstApron: 209_015_000,
      secondApron: SECOND_APRON,
    },
  };
}

describe('persisted hard-cap containing-Team authority', () => {
  it('keeps a genuine MIA Row I entry valid and byte-identical in MIA', () => {
    const { hardCapLedger, cashLedger } = productGeneratedRowI();
    const hardCapBefore = JSON.stringify(hardCapLedger);
    const cashBefore = JSON.stringify(cashLedger);

    expect(
      parsePersistedTradeHardCapLedger(hardCapLedger, {
        containingTeamCode: 'MIA',
        worldLineage: [WORLD_ID],
        cashLedger,
      })
    ).toEqual({ entries: hardCapLedger, valid: true });
    expect(
      getHardCapStatusFromContext(
        { hardCapLedger, cashLedger },
        {
          containingTeamCode: 'MIA',
          worldId: WORLD_ID,
          worldLineage: [WORLD_ID],
          salaryCapYear: SALARY_CAP_YEAR,
          capSettings: {
            firstApron: 209_015_000,
            secondApron: SECOND_APRON,
          },
        }
      )
    ).toMatchObject({
      isHardCapped: true,
      hardCapType: 'SECOND_APRON',
      failClosed: false,
    });
    expect(
      parsePersistedTradeHardCapLedger(hardCapLedger, {
        containingTeamCode: 'MIA',
        worldLineage: [WORLD_ID],
        cashLedger,
      })
    ).toEqual({ entries: hardCapLedger, valid: true });
    expect(JSON.stringify(hardCapLedger)).toBe(hardCapBefore);
    expect(JSON.stringify(cashLedger)).toBe(cashBefore);
  });

  it('authenticates the product date-only hard-cap day against its governed noon-UTC cash instant', () => {
    const { hardCapLedger, cashLedger } = productGeneratedRowI(
      'MIA',
      '2026-07-15'
    );
    expect(hardCapLedger[0].triggerTransactionDate).toBe('2026-07-15');
    expect(cashLedger.entries[0].transactionAt).toBe('2026-07-15T12:00:00Z');
    expect(
      parsePersistedTradeHardCapLedger(hardCapLedger, {
        containingTeamCode: 'MIA',
        worldLineage: [WORLD_ID],
        cashLedger,
      })
    ).toEqual({ entries: hardCapLedger, valid: true });
  });

  it('accepts authenticated ancestor provenance and rejects siblings or missing lineage', () => {
    const parentWorldId = 'world-parent';
    const childWorldId = 'world-child';
    const siblingWorldId = 'world-sibling';
    const { hardCapLedger, cashLedger } = productGeneratedRowI(
      'MIA',
      TRANSACTION_AT,
      parentWorldId
    );

    expect(
      parsePersistedTradeHardCapLedger(hardCapLedger, {
        containingTeamCode: 'MIA',
        worldLineage: [childWorldId, parentWorldId],
        cashLedger,
      })
    ).toEqual({ entries: hardCapLedger, valid: true });
    expect(
      parsePersistedTradeHardCapLedger(hardCapLedger, {
        containingTeamCode: 'MIA',
        worldLineage: [childWorldId, siblingWorldId],
        cashLedger,
      })
    ).toEqual({ entries: [], valid: false });
    expect(
      parsePersistedTradeHardCapLedger(hardCapLedger, {
        containingTeamCode: 'MIA',
        cashLedger,
      })
    ).toEqual({ entries: [], valid: false });
  });

  it('authenticates mixed parent and child transactions against each entry provenance', () => {
    const parentWorldId = 'world-parent';
    const childWorldId = 'world-child';
    const parent = productGeneratedRowI(
      'MIA',
      TRANSACTION_AT,
      parentWorldId,
      'trade-parent'
    );
    const child = productGeneratedRowI(
      'MIA',
      TRANSACTION_AT,
      childWorldId,
      'trade-child'
    );
    const hardCapLedger = [
      ...parent.hardCapLedger,
      ...child.hardCapLedger,
    ];
    const cashLedger = GovernedCashLedgerZ.parse({
      ...parent.cashLedger,
      ledgerVersion: 2,
      entries: [...parent.cashLedger.entries, ...child.cashLedger.entries],
    });

    expect(
      parsePersistedTradeHardCapLedger(hardCapLedger, {
        containingTeamCode: 'MIA',
        worldLineage: [childWorldId, parentWorldId],
        cashLedger,
      })
    ).toEqual({ entries: hardCapLedger, valid: true });

    const unrelatedOnly = structuredClone(cashLedger);
    unrelatedOnly.entries[1].worldId = 'world-unrelated';
    expect(
      parsePersistedTradeHardCapLedger(hardCapLedger, {
        containingTeamCode: 'MIA',
        worldLineage: [childWorldId, parentWorldId],
        cashLedger: unrelatedOnly,
      })
    ).toEqual({ entries: [], valid: false });
  });

  it('rejects identical MIA bytes in DEN and a mutually rewritten DEN pair without DEN governed proof', () => {
    const { hardCapLedger, cashLedger } = productGeneratedRowI();
    expect(
      parsePersistedTradeHardCapLedger(hardCapLedger, {
        containingTeamCode: 'DEN',
        worldLineage: [WORLD_ID],
        cashLedger,
      })
    ).toEqual({ entries: [], valid: false });

    const rewrittenHardCapLedger = structuredClone(hardCapLedger);
    rewrittenHardCapLedger[0].teamCode = 'DEN';
    rewrittenHardCapLedger[0].entryId = `${TRANSACTION_ID}:hard-cap:DEN`;
    rewrittenHardCapLedger[0].triggers[0].componentId = 'cash:DEN';
    const rewrittenCashLedger = structuredClone(cashLedger);
    rewrittenCashLedger.teamId = 'DEN';
    rewrittenCashLedger.ledgerId = 'cash-ledger:DEN';
    rewrittenCashLedger.entries[0].teamId = 'DEN';
    rewrittenCashLedger.entries[0].entryId = `${TRANSACTION_ID}:cash:DEN:PAID:MIA`;
    rewrittenCashLedger.entries[0].counterpartyTeamId = 'MIA';

    expect(
      parsePersistedTradeHardCapLedger(rewrittenHardCapLedger, {
        containingTeamCode: 'DEN',
        worldLineage: [WORLD_ID],
        cashLedger: rewrittenCashLedger,
      })
    ).toEqual({ entries: [], valid: false });
  });

  it('rejects missing containing-Team context and RECEIVED-only Row I evidence', () => {
    const { hardCapLedger, cashLedger } = productGeneratedRowI();
    expect(
      parsePersistedTradeHardCapLedger(hardCapLedger, {
        containingTeamCode: null,
        worldLineage: [WORLD_ID],
        cashLedger,
      })
    ).toEqual({ entries: [], valid: false });

    const receivedOnly = structuredClone(cashLedger);
    receivedOnly.entries[0].direction = 'RECEIVED';
    expect(
      parsePersistedTradeHardCapLedger(hardCapLedger, {
        containingTeamCode: 'MIA',
        worldLineage: [WORLD_ID],
        cashLedger: receivedOnly,
      })
    ).toEqual({ entries: [], valid: false });
  });

  it.each(['C', 'F', 'H'] as const)(
    'keeps valid Row %s authority for its true Team and rejects a cross-Team copy',
    (row) => {
      const entry = productFormatEntryForRow(row);
      expect(
        parsePersistedTradeHardCapLedger([entry], {
          containingTeamCode: 'MIA',
        })
      ).toEqual({ entries: [entry], valid: true });
      expect(
        parsePersistedTradeHardCapLedger([entry], {
          containingTeamCode: 'DEN',
        })
      ).toEqual({ entries: [], valid: false });
    }
  );

  it('keeps Row F tpeTiming fail-closed', () => {
    const entry = productFormatEntryForRow('F');
    const missingTiming = structuredClone(entry);
    missingTiming.triggers[0].tpeTiming = null;
    expect(
      parsePersistedTradeHardCapLedger([missingTiming], {
        containingTeamCode: 'MIA',
      })
    ).toEqual({ entries: [], valid: false });
  });

  it('rejects duplicated or rewritten hard-cap ledger identity', () => {
    const { hardCapLedger, cashLedger } = productGeneratedRowI();
    const duplicated = [...hardCapLedger, structuredClone(hardCapLedger[0])];
    const rewrittenEntryId = structuredClone(hardCapLedger);
    rewrittenEntryId[0].entryId = 'rewritten-hard-cap-entry';

    for (const candidate of [duplicated, rewrittenEntryId]) {
      expect(
        parsePersistedTradeHardCapLedger(candidate, {
          containingTeamCode: 'MIA',
          worldLineage: [WORLD_ID],
          cashLedger,
        })
      ).toEqual({ entries: [], valid: false });
    }
  });

  it.each([
    [
      'missing ledger',
      () => undefined,
    ],
    [
      'received only',
      (ledger: ReturnType<typeof productGeneratedRowI>['cashLedger']) => {
        ledger.entries[0].direction = 'RECEIVED';
        return ledger;
      },
    ],
    [
      'amount mismatch',
      (ledger: ReturnType<typeof productGeneratedRowI>['cashLedger']) => {
        ledger.entries[0].amountCents += 1;
        return ledger;
      },
    ],
    [
      'year mismatch',
      (ledger: ReturnType<typeof productGeneratedRowI>['cashLedger']) => {
        ledger.entries[0].salaryCapYear += 1;
        return ledger;
      },
    ],
    [
      'instant mismatch',
      (ledger: ReturnType<typeof productGeneratedRowI>['cashLedger']) => {
        ledger.entries[0].transactionAt = '2026-07-16T12:00:00-04:00';
        return ledger;
      },
    ],
    [
      'world mismatch',
      (ledger: ReturnType<typeof productGeneratedRowI>['cashLedger']) => {
        ledger.entries[0].worldId = 'foreign-world';
        return ledger;
      },
    ],
    [
      'manifest tamper',
      (ledger: ReturnType<typeof productGeneratedRowI>['cashLedger']) => {
        ledger.entries[0].proof.seasonInputManifest = {};
        return ledger;
      },
    ],
    [
      'ledger identity tamper',
      (ledger: ReturnType<typeof productGeneratedRowI>['cashLedger']) => {
        ledger.ledgerId = 'rewritten-cash-ledger';
        return ledger;
      },
    ],
    [
      'missing payer leaf',
      (ledger: ReturnType<typeof productGeneratedRowI>['cashLedger']) => {
        ledger.entries[0].canonLeafIds = ledger.entries[0].canonLeafIds.filter(
          (leafId) => leafId !== 'CBA2-A08.1'
        );
        return ledger;
      },
    ],
    [
      'unknown cash leaf',
      (ledger: ReturnType<typeof productGeneratedRowI>['cashLedger']) => {
        ledger.entries[0].canonLeafIds.push('CBA2-UNKNOWN');
        return ledger;
      },
    ],
    [
      'unknown proof',
      (ledger: ReturnType<typeof productGeneratedRowI>['cashLedger']) => {
        (
          ledger.entries[0].proof as { canonCandidateCommit: string }
        ).canonCandidateCommit = 'unknown';
        return ledger;
      },
    ],
    [
      'duplicate paid evidence',
      (ledger: ReturnType<typeof productGeneratedRowI>['cashLedger']) => {
        ledger.entries.push({
          ...structuredClone(ledger.entries[0]),
          entryId: 'duplicate-paid',
        });
        ledger.ledgerVersion = ledger.entries.length;
        return ledger;
      },
    ],
  ])('rejects Row I %s evidence', (_label, mutate) => {
    const { hardCapLedger, cashLedger } = productGeneratedRowI();
    expect(
      parsePersistedTradeHardCapLedger(hardCapLedger, {
        containingTeamCode: 'MIA',
        worldLineage: [WORLD_ID],
        cashLedger: mutate(structuredClone(cashLedger)),
      })
    ).toEqual({ entries: [], valid: false });
  });

  it('fails a foreign Row I copy at hydration, mutation normalization, status, salary/hard-cap validation, and final-state validation', async () => {
    const { hardCapLedger, cashLedger } = productGeneratedRowI();
    const team = persistedTeam(hardCapLedger, cashLedger);
    const trustedMiaTeam = toCurrentStateTeam(team, 'trade', {
      containingTeamCode: 'MIA',
      worldLineage: [WORLD_ID],
    });
    if (!trustedMiaTeam) throw new Error('expected trusted MIA Team fixture');

    await expect(
      hydrateBaseTeam('DEN', team, { worldLineage: [WORLD_ID] })
    ).rejects.toThrow(/hardCapLedger is not governed authority/i);
    expect(() =>
      toCurrentStateTeam(team, 'trade', {
        containingTeamCode: 'DEN',
        worldLineage: [WORLD_ID],
      })
    ).toThrow(/hard-cap ledger is malformed or version-incompatible/i);
    expect(() => toCurrentStateTeam(team, 'trade')).toThrow(
      /hard-cap ledger is malformed or version-incompatible/i
    );
    expect(() =>
      normalizeTradeMutationCurrentState(
        { teams: [{ teamCode: 'DEN', team: trustedMiaTeam }] },
        [WORLD_ID]
      )
    ).toThrow(/authority conflicts with the mutation target/i);

    const status = getHardCapStatus(team, {
      containingTeamCode: 'DEN',
      worldLineage: [WORLD_ID],
      salaryCapYear: SALARY_CAP_YEAR,
      capSettings: {
        firstApron: 209_015_000,
        secondApron: SECOND_APRON,
      },
    });
    expect(status).toMatchObject({
      isHardCapped: true,
      hardCapType: 'UNKNOWN',
      source: 'team.hardCapLedger (invalid)',
    });

    const validationContext = {
      ...context(),
      containingTeamCode: 'DEN',
    };
    const hardCapValidation = validateHardCap(
      {
        ...team,
        teamTotalSalary: SECOND_APRON,
        projectedSalary: SECOND_APRON,
      },
      { ...validationContext, source: 'boundary-test' }
    );
    expect(hardCapValidation.passed).toBe(false);
    expect(hardCapValidation.hardCapStatus?.source).toBe(
      'team.hardCapLedger (invalid)'
    );
    const salaryValidation = validateSalaryMatching(
      {
        ...team,
        teamTotalSalary: SECOND_APRON,
        projectedSalary: SECOND_APRON + 1,
        salaryIn: 1,
        salaryOut: 0,
        incomingPlayers: [
          {
            id: 'incoming-one-cent',
            name: 'Incoming One Cent',
            salary: 1,
            matchIncoming: 1,
            matchOutgoing: 1,
            isTwoWay: false,
            absorptionMode: 'MATCH',
            signAndTrade: false,
            contractYears: 1,
            firstYearGuaranteed: true,
          },
        ],
      },
      { ...validationContext, source: 'boundary-test' }
    );
    expect(salaryValidation.details.hardCapStatus?.source).toBe(
      'team.hardCapLedger (invalid)'
    );

    const postState = validatePostStateCapLegality({
      operationId: 'bze-298-foreign-copy',
      mutationType: 'executeTrade',
      worldId: WORLD_ID,
      worldLineage: [WORLD_ID],
      year: SALARY_CAP_YEAR,
      beforeTeamsByCode: { DEN: team },
      afterTeamsByCode: { DEN: team },
      beforeTotalsByTeam: { DEN: team.totals },
      afterTotalsByTeam: { DEN: team.totals },
      rulesContext: {
        capSettings: {
          firstApron: 209_015_000,
          secondApron: SECOND_APRON,
        },
      },
    });
    expect(postState.violations).toContainEqual(
      expect.objectContaining({
        code: 'HARD_CAP_LEDGER_INVALID',
        teamCode: 'DEN',
      })
    );
  });
});
