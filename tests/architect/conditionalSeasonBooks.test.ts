import { describe, expect, it } from 'vitest';
import { resolveOffseasonTransition } from '@/features/architect/utils/offseason/resolveOffseasonTransition';
import { withDerivedGovernedSalaryBooks } from '@/tests/fixtures/governedSalaryBookInputs';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals';

function team() {
  const players = Array.from({ length: 15 }, (_, i) => ({
    id: `p${i}`,
    playerId: `p${i}`,
    name: `Player ${i}`,
    contract: {
      contractId: `contract${i}`,
      contractType: 'STANDARD CONTRACT',
      salariesByYear: ['2025-26', '2026-27'].map((season) => ({
        season,
        salary: 8000000,
        capHit: 8000000,
        guaranteed: true,
      })),
    },
  }));
  const value = withDerivedGovernedSalaryBooks(
    {
      teamCode: 'CHI',
      players,
      roster: players.map((p) => p.id),
      capHolds: [],
      exceptions: {},
      hardCapped: true,
      hardCapLevel: 'firstApron',
      totals: { apronTeamSalary: null },
    },
    { salaryCapYear: 2027, asOfDate: '2026-07-01T00:00:00-04:00' }
  );
  delete value.salaryBookInputs.incompleteRosterCharge;
  value.salaryBookInputs.unsignedFirstRoundPickState = {
    version: 1,
    status: 'ready',
    teamCode: 'CHI',
    salaryCapYear: 2027,
    entries: [],
    source: {
      evidenceId: 'software-empty-unsigned',
      evidenceVersion: 1,
      authority: 'external-determination',
      reference: 'Software fixture only',
      authenticatedAt: '2026-06-05T00:00:00Z',
      recordStatus: 'current',
      canonLeafIds: ['CBA2-C02.1', 'CBA2-C03.1'],
    },
  };
  return value;
}
describe('dated conditional-world season books', () => {
  it('uses the governed effective date through OSTE and preserves Contracts', () => {
    const before = team();
    const totals = createCanonicalTeamTotalsSnapshot(before, 2027, {
      asOfDate: '2026-07-01T00:00:00-04:00',
    });
    expect(totals.apronTeamSalary, JSON.stringify(totals)).toBe(120000000);
    const result = resolveOffseasonTransition({
      teamCapSheet: before,
      fromYear: 2026,
      toYear: 2027,
      optionDecisions: {},
      context: { effectiveAt: '2026-07-01T00:00:00-04:00' },
    });
    expect(result.success, JSON.stringify(result)).toBe(true);
    expect(result.nextTeamCapSheet?.totals).toMatchObject({
      teamSalary: 120000000,
      apronTeamSalary: 120000000,
      taxSalary: 120000000,
    });
    expect(
      result.nextTeamCapSheet?.players?.map((p) => p.contract?.contractId)
    ).toEqual(before.players.map((p) => p.contract.contractId));
  });
  it.each(['missing-date', 'missing-books', 'overflow'])(
    'keeps %s blocked',
    (mode) => {
      const input = team();
      if (mode === 'missing-books')
        input.salaryBookInputs.apronAdjustments.status = 'needs-input';
      if (mode === 'overflow')
        input.salaryBookInputs.apronAdjustments.lineItems[0].amount = 150000000;
      const before = structuredClone(input);
      const result = resolveOffseasonTransition({
        teamCapSheet: input,
        fromYear: 2026,
        toYear: 2027,
        optionDecisions: {},
        context:
          mode === 'missing-date'
            ? {}
            : { effectiveAt: '2026-07-01T00:00:00-04:00' },
      });
      expect(result.success).toBe(false);
      expect(result.nextTeamCapSheet).toBeUndefined();
      expect(input).toEqual(before);
    }
  );
});
