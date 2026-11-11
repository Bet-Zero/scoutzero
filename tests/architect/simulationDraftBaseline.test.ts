import { describe, expect, it } from 'vitest';
import {
  compileSimulationDraftBaseline,
  SIMULATION_DRAFT_ASSUMPTIONS,
  type SimulationApronHistoryRow,
  type SimulationDraftCandidate,
} from '@/features/architect/utils/simulationDraftBaseline';
import {
  validateGovernedDraftBaseline,
  governedDraftHolders,
} from '@/features/architect/utils/governedDraftWorld.baseline';
import type { GovernedDraftWorldBaseline } from '@/schemas/governedDraftWorld';

// Invented software inputs. Team codes are labels only; no NBA facts.
const TEAMS = Array.from({ length: 30 }, (_, i) =>
  i < 26
    ? `TA${String.fromCharCode(65 + i)}`
    : `TB${String.fromCharCode(65 + i - 26)}`
);
const SHA = 'a'.repeat(64);
const AS_OF = '2026-06-05T12:19:56.526Z';

function own(
  team: string,
  year: number,
  holder = team,
  group = 'original-supported',
  status = 'non-applicable-or-underlying-program-only'
) {
  const id = `ent:${team}:${year}:1:own:x`;
  return {
    record: {
      entitlementId: id,
      group,
      reportedHolder:
        group === 'original-supported' ||
        group === 'original-frozen' ||
        group === 'original-outside-window'
          ? holder
          : null,
      nativeAssets: [] as string[],
      originalPick: {
        id: `${team}_${year}_1st`,
        originalTeam: team,
        draftYear: year,
        round: 1,
      },
      retainedAssessment: {
        actions: { resolveConditionalOutcome: { status } },
      },
    },
    doc: {
      id,
      kind: 'pick_ownership',
      holderTeam: team, // legacy label; the accepted holder replaces it
      originalTeam: team,
      seasonYear: year,
      round: 1,
      underlyingPickId: `${team}_${year}_1st`,
      description: `${team} ${year} first (software)`,
    },
  };
}

function inputs() {
  const rows = TEAMS.flatMap((t) =>
    [2026, 2027, 2028, 2029, 2030, 2031, 2032].map((y) => own(t, y))
  );
  rows[6] = own('TAA', 2032, 'TAB'); // traded 2032 first
  rows[1] = own('TAA', 2027, 'TAC'); // outright traded pick held by TAC
  rows[2] = own('TAA', 2028, 'TAA', 'original-future-pending', 'needs-input');
  rows[2].record.reportedHolder = null;
  const swap = {
    record: {
      entitlementId: 'ent:TAB:2029:1:swap:y',
      group: 'native-grant-mapping',
      reportedHolder: null,
      nativeAssets: ['TAB_2029_1st', 'TAD_2029_1st'],
      originalPick: null,
      retainedAssessment: {
        actions: { resolveConditionalOutcome: { status: 'needs-input' } },
      },
    },
    doc: {
      id: 'ent:TAB:2029:1:swap:y',
      kind: 'swap_right',
      holderTeam: 'TAD',
      seasonYear: 2029,
      round: 1,
      description: 'TAD swap right (software)',
    },
  };
  rows.push(swap);
  const candidate: SimulationDraftCandidate = {
    asOf: AS_OF,
    records: rows.map((r) => r.record),
    unresolved: [
      {
        dependencyId: 'software:unresolved',
        entitlementIds: [`ent:TAE:2030:1:own:x`],
        occurrenceIds: ['software:occurrence'],
        actions: ['transfer'],
        reason: 'software-reason',
        missingSource: 'software-missing',
        sourceRefs: ['software:ref'],
      },
    ],
    teamInputs: TEAMS.map((team) => ({ team })),
  };
  return { candidate, entitlements: rows.map((r) => r.doc) };
}

const compile = (
  over: Partial<ReturnType<typeof inputs>> = {},
  apronHistory?: SimulationApronHistoryRow[]
) => {
  const base = inputs();
  return compileSimulationDraftBaseline({
    apronHistory,
    candidate: over.candidate ?? base.candidate,
    entitlements: over.entitlements ?? base.entitlements,
    candidateSha256: SHA,
    seasonId: '2025-26',
    releaseId: 'simulation-june5-software-test',
  });
};

describe('SIMULATION draft baseline compiler (software inputs, not NBA facts)', () => {
  it('retains every identity and admits only outright originals', () => {
    const b = compile();
    expect(b.classification).toBe('simulation');
    expect(b.assumptions).toEqual(SIMULATION_DRAFT_ASSUMPTIONS);
    expect(b.identities).toHaveLength(30 * 7 + 1);
    const admitted = new Set(b.records.map((r) => r.entitlement.id));
    expect(admitted.has('ent:TAA:2027:1:own:x')).toBe(true);
    expect(admitted.has('ent:TAA:2032:1:own:x')).toBe(true); // Stepien witness
    for (const excluded of [
      'ent:TAA:2028:1:own:x', // conditional / future-pending
      'ent:TAB:2029:1:own:x', // inside a swap pool
      'ent:TAD:2029:1:own:x', // inside a swap pool
      'ent:TAB:2029:1:swap:y', // swap right itself
      'ent:TAE:2030:1:own:x', // unresolved evidence
    ])
      expect(admitted.has(excluded)).toBe(false);
    expect(b.records).toHaveLength(30 * 7 - 4);
  });

  it('uses the accepted June 5 holder and conserves team membership', () => {
    const b = compile();
    expect(b.retainedEntitlements['ent:TAA:2027:1:own:x'].holderTeam).toBe(
      'TAC'
    );
    expect(b.retainedEntitlements['ent:TAB:2029:1:swap:y'].holderTeam).toBe(
      'TAD'
    );
    expect(b.initialTeams.TAC.entitlementIds).toContain('ent:TAA:2027:1:own:x');
    expect(b.initialTeams.TAA.entitlementIds).not.toContain(
      'ent:TAA:2027:1:own:x'
    );
    const { holders } = governedDraftHolders(b, []);
    expect(holders['ent:TAA:2032:1:own:x']).toBe('TAB');
  });

  it('records owed years so Stepien closure covers them', () => {
    const b = compile();
    expect(b.stepien.TAA.finiteScope?.knownObligationDraftYears).toEqual([
      2027, 2032,
    ]);
    expect(b.stepien.TAA.throughDraftYear).toBe(2032);
    expect(b.stepien.TAC.finiteScope?.knownObligationDraftYears).toEqual([]);
  });

  it('fails closed instead of guessing a holder or identity', () => {
    const { candidate, entitlements } = inputs();
    expect(() =>
      compile({ candidate, entitlements: entitlements.slice(1) })
    ).toThrow('exactly the retained identities');
    const unknownHolder = entitlements.map((e) =>
      e.id === 'ent:TAB:2029:1:swap:y' ? { ...e, holderTeam: 'ZZZ' } : e
    );
    expect(() => compile({ candidate, entitlements: unknownHolder })).toThrow(
      'No holder team'
    );
    expect(() =>
      compile({
        candidate: { ...candidate, asOf: '2026-06-07T00:00:00.000Z' },
        entitlements,
      })
    ).toThrow('June 5');
  });

  it('keeps assumptions bound to the simulation classification', () => {
    const b = compile();
    expect(() =>
      validateGovernedDraftBaseline({ ...b, assumptions: [] })
    ).toThrow('name their assumptions');
    expect(() =>
      validateGovernedDraftBaseline({
        ...b,
        classification: 'qualified-source',
      })
    ).toThrow('name their assumptions');
  });
});

describe('SIMULATION assets view', () => {
  it('labels every untradeable right honestly', async () => {
    const { governedDraftWorldAssets } = await import(
      '@/features/architect/utils/governedDraftWorld.assets'
    );
    const b = compile();
    const { holders } = governedDraftHolders(b, []);
    const tad = governedDraftWorldAssets({ baseline: b, holders }, 'TAD', 2026);
    const labels = tad.years.flatMap((y) =>
      (y.rights ?? []).map((r) => r.label)
    );
    expect(labels).toContain('TAD swap right (software) — not tradeable yet');
    const tae = governedDraftWorldAssets({ baseline: b, holders }, 'TAE', 2026);
    expect(
      tae.years.flatMap((y) => (y.rights ?? []).map((r) => r.label))
    ).toContain(
      "TAE 2030 first (software) — not tradeable: its terms can't be confirmed"
    );
  });
});

describe('SIMULATION baseline through the unconditional trade review', () => {
  // Team books come from the software fixture; only the draft rights differ.
  async function review(year: number, history?: SimulationApronHistoryRow[]) {
    const fixture = (
      await import(
        '../../functions/src/architect/fixtures/governedDraftWorld.json'
      )
    ).default as unknown as GovernedDraftWorldBaseline;
    const { reviewGovernedDraftWorldTrade } = await import(
      '@/features/architect/utils/governedDraftWorld.baseline'
    );
    const { decorateEntitlementForTrade } = await import(
      '@/features/architect/utils/entitlements/entitlementTerms'
    );
    const { retainDraftPersistenceSource } = await import(
      '@/features/architect/utils/tradeContext/draftFinancialPersistence'
    );
    const baseline = compile({}, history);
    const { holders } = governedDraftHolders(baseline, []);
    const codes = ['TAF', 'TAG'];
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
      asOfDate: '2026-06-05',
      tradeCtx: {
        worldId: 'software-world',
        source: 'tradeMachine',
        asOfDate: '2026-06-05',
        yearKey: 2026,
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
      stateVersion: 'software-world-state',
    } as Parameters<typeof reviewGovernedDraftWorldTrade>[0]);
  }

  it('keeps 2032 originals as Stepien witnesses so earlier firsts can move', async () => {
    const result = await review(2028);
    expect(result.reviews.map((r) => r.reasons)).toEqual([[], []]);
    expect(result.reviews.every((r) => r.eligible)).toBe(true);
  });

  it('fails closed on a 2032 first until its Apron history exists', async () => {
    const result = await review(2032);
    expect(result.reviews.every((r) => !r.eligible)).toBe(true);
    expect(JSON.stringify(result.reviews)).toContain(
      'missing-or-invalid-observation'
    );
    expect(result.reviews[0].reasons).toEqual([
      'apron:TAF_2032_1st:needs-input',
    ]);
  });

  const row = (
    team: string,
    seasonStartYear: number,
    aboveSecondApron: boolean
  ): SimulationApronHistoryRow => ({
    team,
    seasonStartYear,
    aboveSecondApron,
    sourceResultId: `software:${team}:${seasonStartYear}`,
  });

  it('trades a 2032 first once its 2024-25 season-end history says at or below', async () => {
    const result = await review(2032, [
      row('TAF', 2024, false),
      row('TAG', 2024, false),
      row('TAF', 2025, true),
    ]);
    expect(result.reviews.map((r) => r.reasons)).toEqual([[], []]);
  });

  it('keeps a 2032 first frozen when its team finished 2024-25 above the Second Apron', async () => {
    const result = await review(2032, [
      row('TAF', 2024, true),
      row('TAF', 2025, false),
      row('TAG', 2024, false),
    ]);
    expect(result.reviews[0].reasons).toEqual([
      'apron:TAF_2032_1st:needs-input',
    ]);
    expect(result.reviews[1].reasons).toEqual([]);
  });
});

describe('SIMULATION Apron history (A4)', () => {
  const at = (team: string, year: number, above = false) => ({
    team,
    seasonStartYear: year,
    aboveSecondApron: above,
    sourceResultId: 'software',
  });
  it('rejects seasons without a final day, unknown teams and duplicates', () => {
    expect(() => compile({}, [at('TAA', 2023)])).toThrow('invalid');
    expect(() => compile({}, [at('ZZZ', 2024)])).toThrow('invalid');
    expect(() => compile({}, [at('TAA', 2024), at('TAA', 2024)])).toThrow(
      'duplicated'
    );
  });
  it('records scoped determinations only in simulation baselines', () => {
    const own = compile().apron.find(
      (a) => a.originalPick.id === 'TAB_2032_1st'
    )!;
    expect(own.observations).toEqual([]);
    const withHistory = compile({}, [at('TAB', 2024, true)]);
    const tab = withHistory.apron.find(
      (a) => a.originalPick.id === 'TAB_2032_1st'
    )!;
    expect(tab.observations[0].value).toMatchObject({
      basis: 'simulation-scoped-determination',
      aboveSecondApron: true,
      measuredAt: '2025-04-13T00:00:00.000Z',
    });
    expect(() =>
      validateGovernedDraftBaseline({
        ...withHistory,
        classification: 'qualified-source',
        assumptions: undefined,
      })
    ).toThrow('Scoped SIMULATION Apron determinations');
  });
});
