import { describe, expect, it } from 'vitest';
import {
  assertDraftFinancialStateUnchanged,
  canPreserveDraftTradeFinances,
  draftFinancialState,
  hasDraftFinancialPreservation,
} from '@/features/architect/utils/tradeContext/draftFinancialPreservation';
import { buildTradeApplyPreparation } from '@/features/architect/utils/tradeContext';
import { computeTradeResult } from '@/features/architect/utils/mutationPipeline.compute.trade';
import { decorateEntitlementForTrade } from '@/features/architect/utils/entitlements/entitlementTerms';
import { withGovernedSalaryBooks } from '../../src/tests/fixtures/governedSalaryBookInputs';

function fixture() {
  const teams = ['CHI', 'TOR'].map((code) => {
    const id = `synthetic:${code}:2028`;
    return {
      teamCode: code,
      team: {
        id: code,
        teamCode: code,
        teamName: code,
        roster: [],
        players: [],
        entitlementIds: [id],
        entitlements: [
          {
            id,
            kind: 'pick_ownership',
            holderTeam: code,
            underlyingPickId: `${code}_2028_1st`,
            description: 'Synthetic unconditional original first',
            seasonYear: 2028,
            round: 1,
          },
        ],
        // Deliberately finite legacy values: neither these nor equality may
        // certify unknown initial Apron/hard-cap compliance.
        teamTotalSalary: 100_000_000,
        totals: { totalSalary: 100_000_000, unknown: null },
        salaryBookInputs: {
          version: 1,
          salaryCapYear: 2026,
          apronAdjustments: {
            status: 'needs-input',
            missingInputs: ['dated-apron'],
            reason: 'Unknown June 5 books',
          },
          taxSalary: {
            status: 'needs-input',
            missingInputs: ['dated-tax'],
            reason: 'Unknown tax books',
          },
        },
        capHolds: [],
        deadCap: [],
        exceptions: { tpe: [] },
        financialSourceLimitation: 'Initial compliance remains unknown',
      },
    };
  });
  const payload = {
    teams: teams.map(({ teamCode, team }, index) => ({
      teamCode,
      sends: [],
      cashSent: 0,
      salaryMatchingElection: null,
      entitlementsOut: [
        {
          ...decorateEntitlementForTrade(team.entitlements[0]),
          entitlementId: team.entitlementIds[0],
          fromTeamId: teamCode,
          toTeamId: teams[1 - index].teamCode,
        },
      ],
    })),
    tradeCtx: {
      worldId: 'normal-world',
      source: 'tradeMachine',
      asOfDate: '2026-06-05',
      yearKey: 2026,
    },
  };
  return {
    payload,
    currentState: { teams },
    seasonId: '2025-26',
    timestamp: Date.parse('2026-06-05T12:19:56.526Z'),
  };
}

describe('future original-pick financial preservation in the shared trade path', () => {
  it('keeps unknown books, absent ledgers and exact non-draft state while routing both rights', () => {
    const args = fixture();
    const original = structuredClone(args.currentState);
    expect(
      canPreserveDraftTradeFinances(
        args.payload,
        args.currentState,
        args.seasonId
      )
    ).toBe(true);
    const prepared = buildTradeApplyPreparation(args);
    for (const [i, after] of prepared.postTradeSnapshot.teamUpdates.entries()) {
      expect(draftFinancialState(after.team)).toEqual(
        draftFinancialState(original.teams[i].team)
      );
      expect(after.team.entitlementIds).toEqual(
        original.teams[1 - i].team.entitlementIds
      );
      expect(after.team).not.toHaveProperty('hardCapLedger');
      expect(after.team).not.toHaveProperty('cashLedger');
      expect(after.team).not.toHaveProperty('tradeExceptions');
      expect(after.team).not.toHaveProperty('draftPicks');
    }
    expect(args.currentState).toEqual(original);
    expect(prepared.validatedContext.legal).toBe(false);
    expect(JSON.stringify(prepared.validatedContext)).toContain(
      'Apron Team Salary needs governed input'
    );
    expect(
      prepared.postTradeSnapshot.validationTeams[0].team.teamTotalSalary
    ).toBeUndefined();
    const computed = computeTradeResult({ ...args, ...prepared });
    expect(computed.success).toBe(true); // computation is deliberately not save authority
    expect(computed._validatedTradeContext?.legal).toBe(false);
    for (const [i, after] of (computed.teamUpdates ?? []).entries()) {
      expect(draftFinancialState(after.team!)).toEqual(
        draftFinancialState(original.teams[i].team)
      );
    }
  });

  it.each([
    [
      'player',
      (a: any) => {
        a.payload.teams[0].sends = [{ id: 'player' }];
      },
    ],
    [
      'cash',
      (a: any) => {
        a.payload.teams[0].cashSent = 1;
      },
    ],
    [
      'cash route',
      (a: any) => {
        a.payload.teams[0].cashToTeamId = 'TOR';
      },
    ],
    [
      'exception',
      (a: any) => {
        a.payload.teams[0].salaryMatchingElection = { path: 'TPE' };
      },
    ],
    [
      'hidden team term',
      (a: any) => {
        a.payload.teams[0].fee = 1;
      },
    ],
    [
      'hidden proposal term',
      (a: any) => {
        a.payload.pickOnly = true;
      },
    ],
    [
      'new protection',
      (a: any) => {
        a.payload.teams[0].entitlementsOut[0].protection = 'top-5';
      },
    ],
    [
      'unknown source term',
      (a: any) => {
        a.currentState.teams[0].team.entitlements[0].feeOnTransfer = 1;
        a.payload.teams[0].entitlementsOut[0].feeOnTransfer = 1;
      },
    ],
    [
      'mismatched source year',
      (a: any) => {
        a.currentState.teams[0].team.entitlements[0].underlyingPickId =
          'CHI_2026_1st';
      },
    ],
    [
      'changed source term',
      (a: any) => {
        a.payload.teams[0].entitlementsOut[0].seasonYear = 2029;
      },
    ],
    [
      'different date',
      (a: any) => {
        a.payload.asOfDate = '2026-06-06';
      },
    ],
    [
      'different year',
      (a: any) => {
        a.payload.tradeCtx.yearKey = 2027;
      },
    ],
    [
      'current draft',
      (a: any) => {
        a.currentState.teams[0].team.entitlements[0].seasonYear = 2026;
        a.payload.teams[0].entitlementsOut[0].seasonYear = 2026;
      },
    ],
    [
      'unresolved inventory',
      (a: any) => {
        a.currentState.teams[0].team.entitlements = [];
      },
    ],
    [
      'duplicate identity',
      (a: any) => {
        a.payload.teams[0].entitlementsOut.push(
          a.payload.teams[0].entitlementsOut[0]
        );
      },
    ],
  ])('does not classify %s as financial preservation', (_, mutate) => {
    const args = fixture();
    mutate(args);
    expect(
      canPreserveDraftTradeFinances(
        args.payload,
        args.currentState,
        args.seasonId
      )
    ).toBe(false);
    const prepared = buildTradeApplyPreparation(args);
    expect(
      hasDraftFinancialPreservation(
        prepared.postTradeSnapshot,
        prepared.validationPayload,
        args.currentState,
        args.seasonId
      )
    ).toBe(false);
  });

  it('rejects stale state and cloned handoffs; no persisted assertion authorizes preservation', () => {
    const args = fixture();
    const prepared = buildTradeApplyPreparation(args);
    expect(
      hasDraftFinancialPreservation(
        structuredClone(prepared.postTradeSnapshot),
        args.payload,
        args.currentState,
        args.seasonId
      )
    ).toBe(false);
    args.currentState.teams[0].team.totals.totalSalary += 1;
    expect(() => computeTradeResult({ ...args, ...prepared })).toThrow(/stale/);
  });

  it.each([true, false])(
    'keeps a separately supplied world date consistent (payload date: %s)',
    (hasPayloadDate) => {
      const args = fixture();
      if (!hasPayloadDate)
        delete (args.payload.tradeCtx as Record<string, unknown>).asOfDate;
      const prepared = buildTradeApplyPreparation({
        ...args,
        asOfDate: '2026-06-05',
      });
      const computed = computeTradeResult({ ...args, ...prepared });
      expect(computed.success).toBe(true);
      expect(computed._validatedTradeContext?.legal).toBe(false);
      expect(draftFinancialState(computed.teamUpdates![0].team!)).toEqual(
        draftFinancialState(args.currentState.teams[0].team)
      );
      args.payload.tradeCtx.asOfDate = '2026-06-06';
      expect(() => computeTradeResult({ ...args, ...prepared })).toThrow(
        /stale/
      );
    }
  );

  it('rejects post-state financial drift, including a newly invented zero ledger', () => {
    const args = fixture();
    const prepared = buildTradeApplyPreparation(args);
    prepared.postTradeSnapshot.teamUpdates[0].team.cashLedger = { entries: [] };
    expect(() => computeTradeResult({ ...args, ...prepared })).toThrow(
      /changed financial state/
    );
    expect(() =>
      assertDraftFinancialStateUnchanged({}, { teamTotalSalary: 0 })
    ).toThrow();
    expect(() =>
      assertDraftFinancialStateUnchanged(
        { teamTotalSalary: null },
        { teamTotalSalary: 0 }
      )
    ).toThrow();
    expect(() =>
      assertDraftFinancialStateUnchanged(
        { source: { authority: 'retained' } },
        { source: { authority: 'invented' } }
      )
    ).toThrow();
  });

  it.each([100_000_000, 250_000_000])(
    'runs the existing hard-cap validator with governed books at %s',
    (salary) => {
      const args = fixture();
      for (const entry of args.currentState.teams) {
        Object.assign(
          entry.team,
          withGovernedSalaryBooks(entry.team, {
            salaryCapYear: 2026,
            asOfDate: '2026-06-05T00:00:00-04:00',
            teamSalary: salary,
          }),
          { hardCapped: true, hardCapLevel: 'firstApron' }
        );
      }
      const prepared = buildTradeApplyPreparation(args);
      expect(
        prepared.postTradeSnapshot.validationTeams[0].team.teamTotalSalary
      ).toBe(salary);
      expect(
        prepared.validatedContext.teamResults[0].rules.hardCap.passed
      ).toBe(salary === 100_000_000);
      expect(prepared.validatedContext.legal).toBe(false); // first-round activation remains closed
      const computed = computeTradeResult({ ...args, ...prepared });
      expect(computed._validatedTradeContext?.legal).toBe(false);
      expect(draftFinancialState(computed.teamUpdates![0].team!)).toEqual(
        draftFinancialState(args.currentState.teams[0].team)
      );
    }
  );

  it.each([
    'salaryBookInputs',
    'cashLedger',
    'hardCapLedger',
    'contractEventLedgers',
  ])('rejects malformed %s even when unchanged', (field) => {
    const args = fixture();
    (args.currentState.teams[0].team as Record<string, unknown>)[field] = {
      version: 999,
    };
    expect(() => buildTradeApplyPreparation(args)).toThrow();
  });
});
