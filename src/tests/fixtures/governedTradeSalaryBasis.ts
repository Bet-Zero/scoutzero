import type { GovernedTradeSalaryBasis } from '@/schemas/governedTradeSalaryBasis';

export function makeSalaryAuthority({
  worldId,
  teamId,
  playerId,
  asOfDate,
  salaryCapYear,
  salary = 10_000_000,
}: {
  worldId: string;
  teamId: string;
  playerId: string;
  asOfDate: string;
  salaryCapYear: number;
  salary?: number;
}): GovernedTradeSalaryBasis {
  return {
    authorityVersion: 1,
    status: 'ready',
    worldId,
    teamId,
    playerId,
    contractId: `contract-${playerId}`,
    asOfDate,
    salaryCapYear,
    method: 'ordinary-protection',
    currentSalary: salary,
    outgoingSalary: salary,
    incomingSalary: salary,
    poisonPillIncomingSalary: null,
    canonLeafIds: ['CBA2-A03.1'],
    reasons: [],
    proof: {
      ledgerId: `ledger-${playerId}`,
      ledgerVersion: 1,
      contractVersion: 1,
      stateDigest: 'fnv1a64:1111111111111111',
      calendarRecordId: 'calendar-test',
      calendarRecordVersion: 1,
      calendarSourceRecordId: 'calendar-source-test',
      calendarSourceRecordVersion: 1,
    },
  };
}
