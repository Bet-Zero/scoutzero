import { describe, expect, it } from 'vitest';
import {
  buildSimulationTeam,
  simulationMinimumUplift,
  SIMULATION_2025_26_MINIMUMS,
} from '@/features/architect/utils/simulationFinancialInputs';
import { minimumUpliftFor } from '@/features/architect/utils/simulationMinimumUplift';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { prepareSimulationFinancialBaseline } from '@/features/architect/utils/prepareSimulationFinancialBaseline';
import { TeamListFull } from '@/constants/teamList';

const ASOF = '2026-06-05T12:19:56.526Z';

function doc(
  playerId: string,
  row: { salary: number; capHit?: number; unlikely?: number },
  options: { signedUsing?: string; seasons?: number; draftYear?: string } = {}
) {
  const season = (i: number) =>
    `${2025 + i}-${String(26 + i).padStart(2, '0')}`;
  return {
    playerId,
    displayName: playerId,
    teamCode: 'TST',
    bio: { draftYear: options.draftYear ?? '2019' },
    contract: {
      signedUsing: options.signedUsing ?? 'Bird Exception',
      salariesByYear: Array.from({ length: options.seasons ?? 1 }, (_, i) => ({
        season: season(i),
        salary: row.salary,
        capHit: row.capHit ?? row.salary,
        guaranteed: true,
        guaranteedAmount: row.salary,
        option: null,
        incentives: { likely: 0, unlikely: i === 0 ? (row.unlikely ?? 0) : 0 },
      })),
    },
  };
}

function roster(extra: Record<string, ReturnType<typeof doc>> = {}) {
  const docs: Record<string, ReturnType<typeof doc>> = { ...extra };
  for (let i = 0; i < 14; i += 1)
    docs[`p${i}`] = doc(`p${i}`, { salary: 10_000_000 });
  return docs;
}

const baseDoc = {
  teamCode: 'BOS',
  roster: ['stale_id'],
  capHolds: [
    {
      playerId: 'h',
      playerName: 'H',
      season: '2025-26',
      type: 'FA Cap Hold',
      amount: 3_000_000,
      isSigned: false,
    },
  ],
  deadCap: [],
  exceptions: {},
  totals: {},
};

async function build(
  releaseDocs: Record<string, ReturnType<typeof doc>>,
  baseOnlyDocs: Record<string, ReturnType<typeof doc>> = {}
) {
  return buildSimulationTeam({
    teamCode: 'BOS',
    asOf: ASOF,
    salaryCapYear: 2026,
    baseDoc: baseDoc as never,
    releaseDocs,
    baseOnlyDocs,
    assumption: {
      checkedAt: '2026-11-10T12:00:00Z',
      evidenceReferences: ['test release'],
    },
  });
}

describe('SIMULATION minimum uplift (CBA2-C07.3)', () => {
  const msE = { signedUsing: 'Minimum Salary Exception' };
  it('reads Years of Service from the exact full or prorated minimum', () => {
    expect(
      simulationMinimumUplift(
        doc('a', { salary: SIMULATION_2025_26_MINIMUMS[0] }, msE)
      )
    ).toEqual({
      status: 'qualifying',
      yearsOfService: 0,
      days: 174,
      uplift: 1_023_404,
      bounded: false,
    });
    // 53 remaining days at the one-YOS minimum.
    expect(simulationMinimumUplift(doc('b', { salary: 623_967 }, msE))).toEqual(
      {
        status: 'qualifying',
        yearsOfService: 1,
        days: 53,
        uplift: 75_473,
        bounded: false,
      }
    );
    // 65 remaining days at the two-YOS minimum: no uplift.
    expect(
      simulationMinimumUplift(doc('c', { salary: 857_804 }, msE)).status
    ).toBe('none');
  });
  it('covers two-season and other-mechanism Minimum contracts (BZE-345 Gueye, Edwards)', () => {
    // Four days at the one-YOS minimum on a two-season contract: $5,696.
    expect(
      simulationMinimumUplift(
        doc('g', { salary: 47_092 }, { ...msE, seasons: 2 })
      )
    ).toMatchObject({ status: 'qualifying', uplift: 5_696 });
    expect(
      simulationMinimumUplift(
        doc(
          'e',
          { salary: 2_048_494 },
          { signedUsing: 'Non-Bird Exception', seasons: 3 }
        )
      )
    ).toMatchObject({ status: 'qualifying', uplift: 247_780 });
  });
  it('uses the verified earlier-season pair and a labelled bound otherwise', () => {
    expect(
      minimumUpliftFor({
        amount: 1_955_377,
        startSeason: '2024-25',
        signedUsing: 'Mle',
      })
    ).toMatchObject({ status: 'qualifying', uplift: 236_520, bounded: false });
    expect(
      minimumUpliftFor({ amount: 2_221_677, startSeason: '2023-24' })
    ).toMatchObject({ status: 'qualifying', uplift: 74_597, bounded: true });
    // Unknown start (dead money without a retained contract).
    expect(minimumUpliftFor({ amount: 1_955_377 })).toMatchObject({
      uplift: 236_520,
    });
    expect(
      minimumUpliftFor({ amount: 2_191_897, startSeason: '2024-25' }).status
    ).toBe('none');
  });
  it('excludes veterans, rookie mechanisms and draft-rights signings', () => {
    expect(
      simulationMinimumUplift(
        doc('v', { salary: 3_634_153, capHit: 2_296_274 }, msE)
      ).status
    ).toBe('none');
    expect(
      simulationMinimumUplift(
        doc(
          'r',
          { salary: 1_272_870 },
          { signedUsing: 'Second Round Rookie Exception', seasons: 3 }
        )
      ).status
    ).toBe('none');
    expect(
      simulationMinimumUplift(
        doc('d', { salary: 1_272_870 }, { ...msE, draftYear: '2025' })
      ).status
    ).toBe('none');
    expect(
      minimumUpliftFor({
        amount: 1_955_377,
        startSeason: '2024-25',
        draftYear: '2024',
      }).status
    ).toBe('none');
    expect(
      simulationMinimumUplift(doc('x', { salary: 1_000_001 }, msE)).status
    ).toBe('none');
  });
  it('gives every full or prorated 2025-26 zero/one/two-YOS amount exactly one reading', () => {
    const readings = new Map<number, number>();
    for (const yos of [0, 1, 2] as const)
      for (let d = 1; d <= 174; d += 1) {
        const amount = Math.round((SIMULATION_2025_26_MINIMUMS[yos] * d) / 174);
        expect(readings.get(amount) ?? yos).toBe(yos);
        readings.set(amount, yos);
        expect(minimumUpliftFor({ amount }).status).not.toBe('unresolved');
      }
  });
});

describe('SIMULATION team money baseline', () => {
  it('takes the roster from the release and completes Team and Apron Team Salary', async () => {
    const { team, report } = await build(
      roster({
        star: doc('star', { salary: 40_000_000, unlikely: 1_500_000 }),
        young: doc(
          'young',
          { salary: SIMULATION_2025_26_MINIMUMS[0] },
          { signedUsing: 'Minimum Salary Exception' }
        ),
      }),
      { only_base: doc('only_base', { salary: 4_422_360 }) }
    );
    expect(team.roster.map((p) => p.player_id)).not.toContain('stale_id');
    expect(team.players).toHaveLength(17);
    const contracts = 14 * 10_000_000 + 40_000_000 + 1_272_870 + 4_422_360;
    expect(report.teamSalary).toBe(contracts + 3_000_000);
    expect(report.apronTeamSalary).toBe(contracts + 1_500_000 + 1_023_404);
    expect(report.baseOnlyPlayers).toEqual(['only_base']);
    const leaves = (
      team.salaryBookInputs.apronAdjustments as {
        lineItems: { canonLeafIds: string[] }[];
      }
    ).lineItems.flatMap((l) => l.canonLeafIds);
    expect(new Set(leaves)).toEqual(
      new Set([2, 3, 5, 6, 7, 9, 10, 11].map((n) => `CBA2-C07.${n}`))
    );
  });

  it('keeps the Free Agent Amounts adjustment in step when a hold leaves', async () => {
    const { team } = await build(roster());
    const before = createCanonicalTeamTotalsSnapshot(team, 2026, {
      asOfDate: ASOF,
    });
    const after = createCanonicalTeamTotalsSnapshot(
      { ...team, capHolds: [] },
      2026,
      { asOfDate: ASOF }
    );
    expect(before.salaryBooks.ledgers.apronTeamSalary.total).toBe(140_000_000);
    expect(after.salaryBooks.ledgers.apronTeamSalary.total).toBe(140_000_000);
    expect(after.salaryBooks.ledgers.teamSalary.total).toBe(140_000_000);
  });

  it('applies the adjustments to a date-only reading of the as-of day', async () => {
    const { team } = await build(roster());
    const dateOnly = createCanonicalTeamTotalsSnapshot(team, 2026, {
      asOfDate: ASOF.slice(0, 10),
    });
    expect(dateOnly.apronTeamSalary).toBe(140_000_000);
    expect(dateOnly.teamSalary).toBe(143_000_000);
  });

  it('carries the hard cap and checks Traded Player Exceptions', async () => {
    const capped = await buildSimulationTeam({
      teamCode: 'BOS',
      asOf: ASOF,
      salaryCapYear: 2026,
      baseDoc: {
        ...baseDoc,
        hardCapLevel: 'none',
        exceptions: {
          tpe: [
            {
              id: 'TPE-BOS-1',
              totalAmount: 8_200_000,
              usedAmount: 0,
              remainingAmount: 8_200_000,
              expiresOn: 'Aug 6, 2026',
            },
          ],
        },
      } as never,
      releaseDocs: roster(),
      baseOnlyDocs: {},
      hardCapCorrection: { level: 'firstApron', evidence: 'retained report' },
      assumption: { checkedAt: ASOF, evidenceReferences: ['test'] },
    });
    expect(capped.team).toMatchObject({
      hardCapLevel: 'firstApron',
      hardCapped: true,
      hardCapTriggeredBy: 'SIMULATION: retained report',
    });
    expect(capped.report.openTradedPlayerExceptions).toBe(8_200_000);
    const { team } = await build(roster());
    expect(team).toMatchObject({ hardCapped: false, hardCapTriggeredBy: null });
  });

  it('refuses a player listed both from the release and from the base', async () => {
    await expect(
      build(roster(), { p1: doc('p1', { salary: 1 }) })
    ).rejects.toThrow('both');
  });

  it('feeds the thirty-team SIMULATION preparation unchanged', async () => {
    const { team } = await build(roster());
    const teams = Object.fromEntries(
      TeamListFull.map((t) => [t.code, { teamCode: t.code }])
    ) as Record<string, Record<string, unknown>>;
    teams.BOS = team as unknown as Record<string, unknown>;
    const prepared = await prepareSimulationFinancialBaseline({
      asOf: ASOF,
      seasonId: '2025-26',
      teams,
      financialInputs: { BOS: team.salaryBookInputs },
    });
    expect(prepared.teams.BOS).toEqual(team);
  });
});
