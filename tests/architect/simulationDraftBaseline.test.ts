import { describe, expect, it } from 'vitest';
import {
  compileSimulationDraftBaseline,
  SIMULATION_DRAFT_ASSUMPTIONS,
  type SimulationDraftCandidate,
} from '@/features/architect/utils/simulationDraftBaseline';
import {
  validateGovernedDraftBaseline,
  governedDraftHolders,
} from '@/features/architect/utils/governedDraftWorld.baseline';

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
    [2026, 2027, 2028, 2029, 2030, 2031].map((y) => own(t, y))
  );
  const traded = own('TAA', 2032, 'TAB'); // outside admitted years until A4
  rows.push(traded);
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

const compile = (over: Partial<ReturnType<typeof inputs>> = {}) => {
  const base = inputs();
  return compileSimulationDraftBaseline({
    candidate: over.candidate ?? base.candidate,
    entitlements: over.entitlements ?? base.entitlements,
    candidateSha256: SHA,
    seasonId: '2025-26',
    releaseId: 'simulation-june5-software-test',
  });
};

describe('SIMULATION draft baseline compiler (software inputs, not NBA facts)', () => {
  it('retains every identity and admits only outright 2026-2031 originals', () => {
    const b = compile();
    expect(b.classification).toBe('simulation');
    expect(b.assumptions).toEqual(SIMULATION_DRAFT_ASSUMPTIONS);
    expect(b.identities).toHaveLength(30 * 6 + 2);
    const admitted = new Set(b.records.map((r) => r.entitlement.id));
    expect(admitted.has('ent:TAA:2027:1:own:x')).toBe(true);
    for (const excluded of [
      'ent:TAA:2028:1:own:x', // conditional / future-pending
      'ent:TAA:2032:1:own:x', // needs Apron history
      'ent:TAB:2029:1:own:x', // inside a swap pool
      'ent:TAD:2029:1:own:x', // inside a swap pool
      'ent:TAB:2029:1:swap:y', // swap right itself
      'ent:TAE:2030:1:own:x', // unresolved evidence
    ])
      expect(admitted.has(excluded)).toBe(false);
    expect(b.records).toHaveLength(30 * 6 - 4);
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
