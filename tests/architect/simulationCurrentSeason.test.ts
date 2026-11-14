import { describe, expect, it } from 'vitest';
import { buildSimulationTeam } from '@/features/architect/utils/simulationFinancialInputs';
import { minimumUpliftFor } from '@/features/architect/utils/simulationMinimumUplift';
import {
  checkSimulationTpes,
  resolveSimulationHardCap,
} from '@/features/architect/utils/simulationHardCap';
import { simulationAssumptionsForWorld } from '@/features/architect/utils/simulationAssumptions';
import {
  compileSimulationDraftBaseline,
  type SimulationDraftCandidate,
} from '@/features/architect/utils/simulationDraftBaseline';
import { simulationPickStatuses } from '@/features/architect/utils/simulationPickStatus';
import {
  governedDraftHolders,
  reviewGovernedDraftWorldTrade,
} from '@/features/architect/utils/governedDraftWorld.baseline';
import { decorateEntitlementForTrade } from '@/features/architect/utils/entitlements/entitlementTerms';
import { retainDraftPersistenceSource } from '@/features/architect/utils/tradeContext/draftFinancialPersistence';
import { validateContractRows } from '@/features/architect/utils/capLegalityValidation/signing.contractValidators';
import fixture from '../../functions/src/architect/fixtures/governedDraftWorld.json';

// Invented software inputs exercise current-season rules; no NBA facts.
const AS_OF = '2026-11-14T09:28:06.158Z';
const SEASON = '2026-27';
const TEAMS = Array.from(
  { length: 30 },
  (_, i) =>
    `A${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`
);
function currentDraft() {
  const entitlements = TEAMS.flatMap((team) =>
    Array.from({ length: 8 }, (_, i) => ({
      id: `ent:${team}:${2027 + i}:1:own:x`,
      kind: 'pick_ownership',
      holderTeam: team,
      originalTeam: team,
      seasonYear: 2027 + i,
      round: 1,
      underlyingPickId: `${team}_${2027 + i}_1st`,
      description: 'Software original first',
    }))
  );
  const candidate: SimulationDraftCandidate = {
    asOf: AS_OF,
    teamInputs: TEAMS.map((team) => ({ team })),
    unresolved: [],
    records: entitlements.map((e) => ({
      entitlementId: e.id,
      group: 'original-supported',
      reportedHolder: e.holderTeam,
      nativeAssets: [],
      originalPick: {
        id: e.underlyingPickId,
        originalTeam: e.originalTeam,
        draftYear: e.seasonYear,
        round: 1,
      },
      ...(e.id === entitlements[1].id
        ? { transferRestriction: 'forfeited' as const }
        : {}),
      ...(e.id === entitlements[2].id
        ? { transferRestriction: 'conditional' as const }
        : {}),
      retainedAssessment: {
        actions: {
          resolveConditionalOutcome: {
            status: 'non-applicable-or-underlying-program-only',
          },
        },
      },
    })),
  };
  return {
    candidate,
    entitlements,
    candidateSha256: 'a'.repeat(64),
    seasonId: SEASON,
    releaseId: 'simulation-current-software',
    currentWindow: {
      kind: 'governed-test-seven-draft-window' as const,
      asOf: AS_OF,
      previousDraftCompletedAt: '2026-06-25T03:59:59.000Z',
      firstFutureDraftStartsAt: '2027-06-23T04:00:00.000Z',
      firstYear: 2027,
      lastYear: 2033,
    },
    currentAssumptions: [
      {
        id: 'current-software',
        statement: 'Invented dated software inventory; not real facts.',
      },
    ],
    admissionYears: { first: 2027, last: 2034 },
    apronHistory: TEAMS.flatMap((team) =>
      [2024, 2025].map((seasonStartYear) => ({
        team,
        seasonStartYear,
        aboveSecondApron: false,
        sourceResultId: 'software-history',
      }))
    ),
  };
}

describe('direct current-season SIMULATION starting state', () => {
  it('uses the current apron and MLE thresholds and counts only open TPE balances', () => {
    const args = {
      teamCode: 'AAA',
      season: SEASON,
      sourceLabel: 'firstApron',
      releaseDocs: {},
      apronTeamSalary: 209_015_000,
    };
    expect(resolveSimulationHardCap(args).level).toBe('firstApron');
    expect(() =>
      resolveSimulationHardCap({ ...args, apronTeamSalary: 209_015_001 })
    ).toThrow('exceeds');
    const signing = (salary: number) => ({
      contract: {
        signedUsing: 'Mle',
        salariesByYear: [{ season: SEASON, salary }],
      },
    });
    expect(
      resolveSimulationHardCap({
        ...args,
        sourceLabel: 'none',
        releaseDocs: { p: signing(6_064_000) },
      }).level
    ).toBe('none');
    expect(() =>
      resolveSimulationHardCap({
        ...args,
        sourceLabel: 'none',
        releaseDocs: { p: signing(6_064_001) },
      })
    ).toThrow('Non-Taxpayer');
    const tpe = {
      totalAmount: 100,
      usedAmount: 100,
      remainingAmount: 0,
      expiresOn: '2027-01-01',
    };
    expect(
      checkSimulationTpes(
        'AAA',
        [
          tpe,
          {
            ...tpe,
            usedAmount: 0,
            remainingAmount: 100,
            expiresOn: '2026-11-13',
          },
        ],
        AS_OF,
        true
      )
    ).toBe(0);
    expect(() =>
      checkSimulationTpes('AAA', [{ ...tpe, remainingAmount: 1 }], AS_OF, true)
    ).toThrow('incoherent');
  });

  it('uses the official current minimum and keeps older Contract-year amounts bounded', () => {
    const current = {
      season: SEASON,
      startSeason: SEASON,
      signedUsing: 'Minimum Salary Exception',
    };
    expect(minimumUpliftFor({ ...current, amount: 1_357_763 })).toMatchObject({
      status: 'qualifying',
      yearsOfService: 0,
      uplift: 1_091_658,
      days: 174,
      bounded: false,
    });
    expect(minimumUpliftFor({ ...current, amount: 2_185_116 })).toMatchObject({
      status: 'qualifying',
      yearsOfService: 1,
      uplift: 264_305,
      bounded: false,
    });
    expect(minimumUpliftFor({ ...current, amount: 2_449_421 }).status).toBe(
      'none'
    );
    expect(
      minimumUpliftFor({
        ...current,
        startSeason: '2024-25',
        yearsOfService: 2,
        amount: 2_296_271,
      })
    ).toMatchObject({ status: 'qualifying', yearsOfService: 0, bounded: true });
    expect(
      minimumUpliftFor({
        ...current,
        startSeason: '2024-25',
        amount: 2_296_271,
      }).status
    ).toBe('unresolved');
    expect(
      minimumUpliftFor({
        ...current,
        startSeason: '2020-21',
        yearsOfService: 2,
        amount: 250_000,
      })
    ).toMatchObject({
      status: 'qualifying',
      yearsOfService: null,
      bounded: true,
    });
    expect(
      minimumUpliftFor({
        ...current,
        startSeason: '2020-21',
        yearsOfService: 2,
        amount: 250_000,
        contractSalary: 8_000_000,
      }).status
    ).toBe('none');
    expect(
      minimumUpliftFor({ ...current, season: '2099-00', amount: 100 }).status
    ).toBe('unresolved');
  });

  it('requires reconciled offseason state and never borrows June cash or tax clearance', async () => {
    const releaseDocs = Object.fromEntries(
      Array.from({ length: 14 }, (_, i) => [
        `p${i}`,
        {
          playerId: `p${i}`,
          displayName: `Software ${i}`,
          teamCode: 'BOS',
          bio: { experience: 5, draftYear: '2020' },
          contract: {
            signedUsing: 'Bird Exception',
            salariesByYear: [
              {
                season: SEASON,
                salary: 10_000_000,
                capHit: 10_000_000,
                guaranteed: true,
                guaranteedAmount: 10_000_000,
                incentives: { likely: 0, unlikely: 0 },
              },
            ],
          },
        },
      ])
    );
    const args = {
      teamCode: 'BOS',
      asOf: AS_OF,
      salaryCapYear: 2027,
      baseDoc: {
        teamCode: 'BOS',
        roster: [],
        capHolds: [],
        deadCap: [],
        exceptions: {},
        totals: {},
      } as never,
      releaseDocs,
      baseOnlyDocs: {},
      assumption: {
        checkedAt: AS_OF,
        evidenceReferences: ['software-current-state'],
      },
    };
    releaseDocs.p0.contract.salariesByYear[0].guaranteedAmount = 11_000_000;
    await expect(buildSimulationTeam(args)).rejects.toThrow(
      'must be reconciled'
    );
    const currentSeasonState: NonNullable<
      Parameters<typeof buildSimulationTeam>[0]['currentSeasonState']
    > = {
      unsignedFirstRoundPickState: {
        version: 1,
        status: 'ready',
        teamCode: 'BOS',
        salaryCapYear: 2027,
        entries: [],
        source: {
          evidenceId: 'software-current-draft',
          evidenceVersion: 1,
          authority: 'external-determination',
          reference: 'software all selections signed',
          authenticatedAt: AS_OF,
          recordStatus: 'current',
          canonLeafIds: ['CBA2-C02.1', 'CBA2-C03.1'],
        },
      },
      restrictedFreeAgentTender: {
        amount: 1_000_000,
        evidenceReference: 'software outstanding tender',
      },
    };
    for (const invalid of [
      {},
      {
        restrictedFreeAgentTender: currentSeasonState.restrictedFreeAgentTender,
      },
      {
        unsignedFirstRoundPickState:
          currentSeasonState.unsignedFirstRoundPickState,
      },
      { ...currentSeasonState, unsignedFirstRoundPickState: null },
      {
        ...currentSeasonState,
        unsignedFirstRoundPickState: {
          ...currentSeasonState.unsignedFirstRoundPickState,
          teamCode: 'MIA',
        },
      },
      {
        ...currentSeasonState,
        unsignedFirstRoundPickState: {
          ...currentSeasonState.unsignedFirstRoundPickState,
          salaryCapYear: 2026,
        },
      },
      { ...currentSeasonState, restrictedFreeAgentTender: { amount: 0 } },
      {
        ...currentSeasonState,
        restrictedFreeAgentTender: { amount: -1, evidenceReference: 'invalid' },
      },
      {
        ...currentSeasonState,
        restrictedFreeAgentTender: { amount: 0, evidenceReference: 1 },
      },
    ]) {
      await expect(
        buildSimulationTeam({
          ...args,
          currentSeasonState: invalid as typeof currentSeasonState,
        })
      ).rejects.toThrow(/reconciled|incomplete/);
    }
    const { team, report } = await buildSimulationTeam({
      ...args,
      currentSeasonState,
    });
    expect(report.teamSalary).toBe(140_000_000);
    expect(report.apronTeamSalary).toBe(141_000_000);
    expect(report.taxSalary).toBeNull();
    expect(team.cashLedger).toBeUndefined();
    expect(team.tradeAcquisitionHistory).toMatchObject({
      baseline: null,
      entries: [],
    });
    const projected = (
      team.players as Array<{
        id: string;
        contract: { salariesByYear: unknown[] };
      }>
    ).find((p) => p.id === 'p0')!.contract;
    expect(projected.salariesByYear[0]).toMatchObject({
      salary: 10_000_000,
      capHit: 10_000_000,
      guaranteed: null,
      guaranteedAmount: null,
    });
    expect(validateContractRows(projected).violations).toHaveLength(0);
    expect(releaseDocs.p0.contract.salariesByYear[0].guaranteedAmount).toBe(
      11_000_000
    );
  });

  it('admits unselected 2027 picks while withholding forfeited and conditional rights', () => {
    const b = compileSimulationDraftBaseline(currentDraft());
    const statuses = simulationPickStatuses(b);
    expect(statuses['ent:AAA:2027:1:own:x'].tradeable).toBe(true);
    expect(statuses['ent:AAA:2028:1:own:x']).toEqual({
      tradeable: false,
      text: 'Not tradeable: forfeited by league sanction',
    });
    expect(statuses['ent:AAA:2029:1:own:x'].tradeable).toBe(false);
    expect(statuses['ent:AAA:2033:1:own:x'].tradeable).toBe(true);
    expect(statuses['ent:AAA:2034:1:own:x']).toEqual({
      tradeable: false,
      text: 'Not tradeable: outside the seven-draft trading window',
    });
    expect(b.records).toHaveLength(238);
    expect(() =>
      compileSimulationDraftBaseline({
        ...currentDraft(),
        currentAssumptions: [],
      })
    ).toThrow('dated window');
    const wrong = currentDraft();
    wrong.candidate.asOf = wrong.currentWindow.asOf =
      '2026-06-26T00:00:00.000Z';
    expect(() => compileSimulationDraftBaseline(wrong)).toThrow('dated window');
  });

  it('uses a non-tradeable boundary witness when the last open first is owed, without opening an eighth trading year', async () => {
    async function review(year: number, witness: boolean) {
      const input = currentDraft();
      const last = input.candidate.records.find(
        (r) => r.entitlementId === 'ent:AAD:2033:1:own:x'
      )!;
      last.reportedHolder = 'AAF';
      if (!witness) {
        input.candidate.records = input.candidate.records.filter(
          (r) => r.originalPick!.draftYear !== 2034
        );
        input.entitlements = input.entitlements.filter(
          (e) => e.seasonYear !== 2034
        );
        input.admissionYears.last = 2033;
      }
      const baseline = compileSimulationDraftBaseline(input);
      const { holders } = governedDraftHolders(baseline, []);
      const codes = ['AAD', 'AAE'];
      const books = [fixture.initialTeams.BOS, fixture.initialTeams.MIA];
      const state = {
        teams: codes.map((teamCode, i) => {
          const raw = {
            ...structuredClone(books[i]),
            teamCode,
            entitlementIds: baseline.initialTeams[teamCode].entitlementIds,
          };
          const team = {
            ...raw,
            entitlements: baseline.records
              .filter((r) => holders[String(r.entitlement.id)] === teamCode)
              .map((r) => r.entitlement),
          };
          retainDraftPersistenceSource(team, raw);
          return { teamCode, team };
        }),
      };
      const payload = {
        asOfDate: '2026-11-14',
        tradeCtx: {
          worldId: 'software-current',
          source: 'tradeMachine',
          asOfDate: '2026-11-14',
          yearKey: 2027,
        },
        teams: codes.map((teamCode, i) => ({
          teamCode,
          sends: [],
          picksOut: [],
          entitlementsOut: state.teams[i].team.entitlements
            .filter((e) => e.seasonYear === year)
            .map((e) => ({
              ...decorateEntitlementForTrade(e),
              entitlementId: e.id,
              toTeamId: codes[(i + 1) % 2],
            })),
        })),
      };
      return reviewGovernedDraftWorldTrade({
        baseline,
        holders,
        payload,
        state,
        stateVersion: 'software-current',
      } as Parameters<typeof reviewGovernedDraftWorldTrade>[0]);
    }
    expect((await review(2028, false)).reviews[0].reasons.join(' ')).toContain(
      'unknown-2033/2034'
    );
    expect((await review(2028, true)).reviews.every((r) => r.eligible)).toBe(
      true
    );
    expect((await review(2027, true)).reviews.every((r) => r.eligible)).toBe(
      true
    );
    expect((await review(2034, true)).reviews.every((r) => !r.eligible)).toBe(
      true
    );
  });

  it('shows the package assumptions without presenting historical June claims as current', () => {
    const a = simulationAssumptionsForWorld({
      simulationFinancialBaseline: {
        classification: 'SIMULATION',
        asOf: AS_OF,
      },
      draftBaseline: {
        classification: 'simulation',
        assumptions: currentDraft().currentAssumptions,
      },
    });
    expect(a.some((x) => x.id === 'june5-postseason-rosters')).toBe(false);
    expect(
      a.find((x) => x.id === 'current-porzingis-pay-withholding')?.statement
    ).toContain('grants no salary relief');
    expect(a.find((x) => x.id === 'tax-salary-baseline')?.statement).toContain(
      'not yet known'
    );
    expect(a.find((x) => x.id === 'empty-cash-ledger')?.statement).toContain(
      'have not been established'
    );
    expect(a.find((x) => x.id === 'current-software')?.statement).toContain(
      'Invented dated software'
    );
    expect(a.some((x) => x.id === 'june5-reported-holder')).toBe(false);
    const earlier = simulationAssumptionsForWorld({
      simulationFinancialBaseline: {
        classification: 'SIMULATION',
        asOf: '2026-07-01T12:00:00.000Z',
      },
    });
    expect(
      earlier.some((x) =>
        [
          'current-porzingis-pay-withholding',
          'current-minnesota-hard-cap',
        ].includes(x.id)
      )
    ).toBe(false);
  });
});
