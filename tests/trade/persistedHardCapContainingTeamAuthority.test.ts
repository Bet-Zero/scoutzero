import { describe, expect, it } from 'vitest';
import { GovernedCashLedgerZ } from '@/schemas/governedCashConsideration';
import {
  createTradeHardCapLedgerEntry,
  evaluateTradeApronRestriction,
} from '@/features/architect/utils/tradeMachine/utils/tradeApronRestrictions';
import { parsePersistedTradeHardCapLedger } from '@/features/architect/utils/tradeMachine/utils/tradeHardCapLedgerAuthority';
import { evaluateGovernedCashConsideration } from '@/features/architect/utils/tradeMachine/utils/governedCashConsideration';
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

function context(): TeamContext {
  return {
    source: 'tradeMachine',
    worldId: WORLD_ID,
    currentYear: SALARY_CAP_YEAR,
    yearKey: SALARY_CAP_YEAR,
    tradeDate: TRANSACTION_AT,
    asOfDate: TRANSACTION_AT,
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

function productGeneratedRowI(teamCode = 'MIA') {
  const team = cashPayingTeam(teamCode);
  const cashEvaluation = evaluateGovernedCashConsideration({
    team,
    context: context(),
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
        entryId: `${TRANSACTION_ID}:cash:${teamCode}:PAID:DEN`,
        transactionId: TRANSACTION_ID,
        worldId: WORLD_ID,
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
    context: context(),
  });
  const hardCapEntry = createTradeHardCapLedgerEntry({
    evaluation: apronEvaluation,
    teamCode,
    transactionId: TRANSACTION_ID,
    effectiveAt: '2026-07-15T16:00:00Z',
  });
  if (!hardCapEntry) throw new Error('expected product-generated Row I entry');

  return { hardCapLedger: [hardCapEntry], cashLedger };
}

describe('persisted hard-cap containing-Team authority', () => {
  it('keeps a genuine MIA Row I entry valid and byte-identical in MIA', () => {
    const { hardCapLedger, cashLedger } = productGeneratedRowI();
    const hardCapBefore = JSON.stringify(hardCapLedger);
    const cashBefore = JSON.stringify(cashLedger);

    expect(
      parsePersistedTradeHardCapLedger(hardCapLedger, {
        containingTeamCode: 'MIA',
        worldId: WORLD_ID,
        cashLedger,
      })
    ).toEqual({ entries: hardCapLedger, valid: true });
    expect(
      parsePersistedTradeHardCapLedger(hardCapLedger, {
        containingTeamCode: 'MIA',
        worldId: WORLD_ID,
        cashLedger,
      })
    ).toEqual({ entries: hardCapLedger, valid: true });
    expect(JSON.stringify(hardCapLedger)).toBe(hardCapBefore);
    expect(JSON.stringify(cashLedger)).toBe(cashBefore);
  });

  it('rejects identical MIA bytes in DEN and a mutually rewritten DEN pair without DEN governed proof', () => {
    const { hardCapLedger, cashLedger } = productGeneratedRowI();
    expect(
      parsePersistedTradeHardCapLedger(hardCapLedger, {
        containingTeamCode: 'DEN',
        worldId: WORLD_ID,
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
    rewrittenCashLedger.entries[0].entryId =
      `${TRANSACTION_ID}:cash:DEN:PAID:MIA`;
    rewrittenCashLedger.entries[0].counterpartyTeamId = 'MIA';

    expect(
      parsePersistedTradeHardCapLedger(rewrittenHardCapLedger, {
        containingTeamCode: 'DEN',
        worldId: WORLD_ID,
        cashLedger: rewrittenCashLedger,
      })
    ).toEqual({ entries: [], valid: false });
  });

  it('rejects missing containing-Team context and RECEIVED-only Row I evidence', () => {
    const { hardCapLedger, cashLedger } = productGeneratedRowI();
    expect(
      parsePersistedTradeHardCapLedger(hardCapLedger, {
        containingTeamCode: null,
        worldId: WORLD_ID,
        cashLedger,
      })
    ).toEqual({ entries: [], valid: false });

    const receivedOnly = structuredClone(cashLedger);
    receivedOnly.entries[0].direction = 'RECEIVED';
    expect(
      parsePersistedTradeHardCapLedger(hardCapLedger, {
        containingTeamCode: 'MIA',
        worldId: WORLD_ID,
        cashLedger: receivedOnly,
      })
    ).toEqual({ entries: [], valid: false });
  });
});
