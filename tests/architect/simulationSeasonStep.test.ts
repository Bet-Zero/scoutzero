import { describe, expect, it } from 'vitest';
import {
  compileSimulationDraftBaseline,
  type SimulationDraftCandidate,
} from '@/features/architect/utils/simulationDraftBaseline';
import {
  advanceSimulationDraftBaseline,
  SIMULATION_SEASON_STEP_ASSUMPTIONS,
} from '@/features/architect/utils/simulationSeasonStep';
import { governedDraftHolders } from '@/features/architect/utils/governedDraftWorld.baseline';
import type { GovernedDraftWorldBaseline } from '@/schemas/governedDraftWorld';

// Invented software inputs. Team codes are labels only; no NBA facts.
const TEAMS = Array.from({ length: 30 }, (_, i) =>
  i < 26
    ? `TA${String.fromCharCode(65 + i)}`
    : `TB${String.fromCharCode(65 + i - 26)}`
);
const SHA = 'a'.repeat(64);
const AS_OF = '2026-06-05T12:19:56.526Z';
const JULY1 = '2026-07-01T04:00:00.000Z';

function own(team: string, year: number, holder = team) {
  const id = `ent:${team}:${year}:1:own:x`;
  return {
    record: {
      entitlementId: id,
      group: year === 2033 ? 'original-outside-window' : 'original-supported',
      reportedHolder: holder,
      nativeAssets: [] as string[],
      originalPick: {
        id: `${team}_${year}_1st`,
        originalTeam: team,
        draftYear: year,
        round: 1,
      },
      retainedAssessment: {
        actions: {
          resolveConditionalOutcome: {
            status: 'non-applicable-or-underlying-program-only',
          },
        },
      },
    },
    doc: {
      id,
      kind: 'pick_ownership',
      holderTeam: team,
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
    [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033].map((y) => own(t, y))
  );
  // TAA's 2026 first was traded to TAB before June 5.
  rows[0] = own('TAA', 2026, 'TAB');
  // TAC's 2026 first sits in a swap, so it is held back (not tradeable).
  const swap = {
    record: {
      entitlementId: 'ent:TAD:2026:1:swap:y',
      group: 'native-grant-mapping',
      reportedHolder: null,
      nativeAssets: ['TAC_2026_1st', 'TAD_2026_1st'],
      originalPick: null,
      retainedAssessment: {
        actions: { resolveConditionalOutcome: { status: 'needs-input' } },
      },
    },
    doc: {
      id: 'ent:TAD:2026:1:swap:y',
      kind: 'swap_right',
      holderTeam: 'TAD',
      seasonYear: 2026,
      round: 1,
      swapControllerPickId: 'TAD_2026_1st',
      description: 'TAD swap right (software)',
    },
  };
  rows.push(swap);
  const candidate: SimulationDraftCandidate = {
    asOf: AS_OF,
    records: rows.map((r) => r.record),
    unresolved: [
      {
        dependencyId: 'software:unresolved-2033',
        entitlementIds: ['ent:TAE:2033:1:own:x'],
        occurrenceIds: ['software:occurrence'],
        actions: ['transfer'],
        reason: 'software-reason',
        missingSource: 'software-missing',
        sourceRefs: ['software:ref'],
      },
      {
        dependencyId: 'software:unresolved-2026',
        entitlementIds: ['ent:TAF:2026:1:own:x'],
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

// Software season-end history: every team at or below the Second Apron.
const HISTORY = TEAMS.flatMap((team) =>
  [2024, 2025].map((seasonStartYear) => ({
    team,
    seasonStartYear,
    aboveSecondApron: false,
    sourceResultId: `software:${team}:${seasonStartYear}`,
  }))
);

const compile = (admissionYears?: { first: number; last: number }) => {
  const { candidate, entitlements } = inputs();
  return compileSimulationDraftBaseline({
    apronHistory: HISTORY,
    candidate,
    entitlements,
    candidateSha256: SHA,
    seasonId: '2025-26',
    releaseId: 'simulation-june5-software-test',
    ...(admissionYears ? { admissionYears } : {}),
  });
};

function step(overrides: Record<string, unknown> = {}) {
  const opening = compile({ first: 2033, last: 2033 });
  return {
    version: 1,
    classification: 'simulation',
    fromSeason: '2025-26',
    toSeason: '2026-27',
    asOf: JULY1,
    draft: {
      year: 2026,
      completedAt: '2026-06-25T03:59:59.000Z',
      // Software order: slot n is TEAMS[n-1]'s own pick.
      order: TEAMS.map((team, i) => ({
        slot: i + 1,
        originalTeam: team,
        holderBeforeDraft:
          team === 'TAA' ? 'TAB' : team === 'TAC' ? 'TAD' : team,
      })),
      sources: ['software order'],
    },
    nextDraftStartsAt: '2027-06-23T04:00:00.000Z',
    opened: {
      year: 2033,
      records: opening.records,
      apron: opening.apron,
    },
    ...overrides,
  };
}

function holdersOf(baseline: GovernedDraftWorldBaseline) {
  return governedDraftHolders(baseline, []).holders;
}

describe('SIMULATION season step June 5 to July 1, 2026 (C1)', () => {
  it('keeps the June 5 compiler unchanged and leaves 2033 out of it', () => {
    const june5 = compile();
    expect(june5.records.some((r) => r.ownership.pick.draftYear === 2033)).toBe(
      false
    );
    expect(june5.identities).toContain('ent:TAA:2033:1:own:x');
  });

  it('resolves the 2026 Draft and opens 2033', () => {
    const june5 = compile();
    const holders = holdersOf(june5);
    // The owner traded TAB's own 2026 first to TAG in this world.
    holders['ent:TAB:2026:1:own:x'] = 'TAG';
    const { baseline, selections, resolvedIdentities } =
      advanceSimulationDraftBaseline({
        baseline: june5,
        holders,
        step: step(),
      });
    expect(resolvedIdentities.every((id) => id.includes(':2026:'))).toBe(true);
    expect(resolvedIdentities).toHaveLength(31);
    expect(baseline.identities.some((id) => id.includes(':2026:'))).toBe(false);
    expect(baseline.asOf).toBe(JULY1);
    expect(baseline.seasonId).toBe('2026-27');
    expect(baseline.assumptions?.map((a) => a.id)).toEqual(
      expect.arrayContaining(
        SIMULATION_SEASON_STEP_ASSUMPTIONS.map((a) => a.id)
      )
    );
    expect(selections).toHaveLength(30);
    expect(selections[0]).toMatchObject({
      slot: 1,
      originalTeam: 'TAA',
      selectingTeam: 'TAB',
      basis: 'world-custody',
    });
    // The owner's trade counts.
    expect(selections[1]).toMatchObject({
      selectingTeam: 'TAG',
      basis: 'world-custody',
    });
    // A held-back pick goes by the public record.
    expect(selections[2]).toMatchObject({
      originalTeam: 'TAC',
      selectingTeam: 'TAD',
      basis: 'public-outcome',
      entitlementId: null,
    });
    // The unresolved 2026 pick also goes by the public record.
    expect(selections[5]).toMatchObject({
      originalTeam: 'TAF',
      basis: 'public-outcome',
    });
    const years = new Set(
      baseline.records.map((r) => r.ownership.pick.draftYear)
    );
    expect([...years].sort()).toEqual([
      2027, 2028, 2029, 2030, 2031, 2032, 2033,
    ]);
    // 29 opened 2033 firsts; TAE's stays unresolved and held back.
    expect(
      baseline.records.filter((r) => r.ownership.pick.draftYear === 2033)
    ).toHaveLength(29);
    expect(baseline.unresolved.map((u) => u.dependencyId)).toEqual([
      'software:unresolved-2033',
    ]);
    const window = baseline.stepien.TAA.finiteScope?.simulationWindow;
    expect(window).toMatchObject({ firstYear: 2027, lastYear: 2033 });
    expect(baseline.stepien.TAA.firstFutureDraftYear).toBe(2027);
    expect(baseline.apron.every((a) => a.asOf === JULY1)).toBe(true);
  });

  it('carries later rights with their current holders', () => {
    const june5 = compile();
    const holders = holdersOf(june5);
    holders['ent:TAC:2029:1:own:x'] = 'TAH';
    const { baseline } = advanceSimulationDraftBaseline({
      baseline: june5,
      holders,
      step: step(),
    });
    const record = baseline.records.find(
      (r) => r.entitlement.id === 'ent:TAC:2029:1:own:x'
    )!;
    expect(record.entitlement.holderTeam).toBe('TAH');
    expect(record.ownership.claims[0].team).toBe('TAH');
    expect(baseline.initialTeams.TAH.entitlementIds).toContain(
      'ent:TAC:2029:1:own:x'
    );
    expect(baseline.stepien.TAC.finiteScope?.knownObligationDraftYears).toEqual(
      [2029]
    );
  });

  it('refuses an order that disagrees with a June 5 holder', () => {
    const june5 = compile();
    const bad = step();
    (
      bad.draft as { order: { holderBeforeDraft: string }[] }
    ).order[0].holderBeforeDraft = 'TAA';
    expect(() =>
      advanceSimulationDraftBaseline({
        baseline: june5,
        holders: holdersOf(june5),
        step: bad,
      })
    ).toThrow(/disagrees with the June 5 holder/);
  });

  it('refuses an order that names an unknown team', () => {
    const june5 = compile();
    const bad = step();
    (
      bad.draft as { order: { holderBeforeDraft: string }[] }
    ).order[2].holderBeforeDraft = 'XXX';
    expect(() =>
      advanceSimulationDraftBaseline({
        baseline: june5,
        holders: holdersOf(june5),
        step: bad,
      })
    ).toThrow(/Unknown team XXX/);
  });

  it('refuses a step that does not follow the world date', () => {
    const june5 = compile();
    expect(() =>
      advanceSimulationDraftBaseline({
        baseline: june5,
        holders: holdersOf(june5),
        step: step({ asOf: '2026-06-20T04:00:00.000Z' }),
      })
    ).toThrow(/does not follow the world date/);
  });

  it('refuses a missing or unknown holder', () => {
    const june5 = compile();
    const missing = holdersOf(june5);
    delete missing['ent:TAA:2027:1:own:x'];
    expect(() =>
      advanceSimulationDraftBaseline({
        baseline: june5,
        holders: missing,
        step: step(),
      })
    ).toThrow(/exactly one current holder/);
    const unknown = holdersOf(june5);
    unknown['ent:TAA:2027:1:own:x'] = 'XXX';
    expect(() =>
      advanceSimulationDraftBaseline({
        baseline: june5,
        holders: unknown,
        step: step(),
      })
    ).toThrow(/not one of the thirty teams/);
  });

  it('refuses opened rights that are already admitted or unresolved', () => {
    const june5 = compile();
    const opened = step();
    const twice = {
      ...opened,
      opened: {
        ...opened.opened,
        records: [...opened.opened.records, june5.records[0]],
      },
    };
    expect(() =>
      advanceSimulationDraftBaseline({
        baseline: june5,
        holders: holdersOf(june5),
        step: twice,
      })
    ).toThrow();
  });
});

describe('Trading after the season step (C1)', () => {
  // Team books come from the software fixture; only the draft rights differ.
  async function review(year: number) {
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
    const june5 = compile();
    const { baseline } = advanceSimulationDraftBaseline({
      baseline: june5,
      holders: holdersOf(june5),
      step: step(),
    });
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
      asOfDate: '2026-07-01',
      tradeCtx: {
        worldId: 'software-world',
        source: 'tradeMachine',
        asOfDate: '2026-07-01',
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
      stateVersion: 'software-world-state',
    } as Parameters<typeof reviewGovernedDraftWorldTrade>[0]);
  }

  it('keeps the coming 2027 Draft out of this path, as June 5 did for 2026', async () => {
    await expect(review(2027)).rejects.toThrow(
      /existing future unconditional firsts/
    );
  });

  it('trades 2028 firsts on July 1', async () => {
    const result = await review(2028);
    expect(result.reviews.map((r) => r.reasons)).toEqual([[], []]);
    expect(result.reviews.every((r) => r.eligible)).toBe(true);
  });

  it('trades newly opened 2033 firsts on July 1', async () => {
    const result = await review(2033);
    expect(result.reviews.map((r) => r.reasons)).toEqual([[], []]);
    expect(result.reviews.every((r) => r.eligible)).toBe(true);
  });
});
