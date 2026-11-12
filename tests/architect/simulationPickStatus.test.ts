import { describe, expect, it } from 'vitest';
import {
  compileSimulationDraftBaseline,
  type SimulationDraftCandidate,
} from '@/features/architect/utils/simulationDraftBaseline';
import { simulationPickStatuses } from '@/features/architect/utils/simulationPickStatus';

// Invented software inputs. Team codes are labels only; no NBA facts.
const TEAMS = Array.from({ length: 30 }, (_, i) =>
  i < 26
    ? `TA${String.fromCharCode(65 + i)}`
    : `TB${String.fromCharCode(65 + i - 26)}`
);
const YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];

function own(team: string, year: number) {
  const id = `ent:${team}:${year}:1:own:x`;
  return {
    record: {
      entitlementId: id,
      group: year === 2033 ? 'original-outside-window' : 'original-supported',
      reportedHolder: team,
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

function compile(
  history: Array<{ team: string; seasonStartYear: number; above: boolean }>
) {
  const rows = TEAMS.flatMap((t) => YEARS.map((y) => own(t, y)));
  rows.push({
    record: {
      entitlementId: 'ent:TAD:2028:1:swap:y',
      group: 'native-grant-mapping',
      reportedHolder: null,
      nativeAssets: ['TAC_2028_1st', 'TAD_2028_1st'],
      originalPick: null,
      retainedAssessment: {
        actions: { resolveConditionalOutcome: { status: 'needs-input' } },
      },
    },
    doc: {
      id: 'ent:TAD:2028:1:swap:y',
      kind: 'swap_right',
      holderTeam: 'TAD',
      seasonYear: 2028,
      round: 1,
      swapControllerPickId: 'TAD_2028_1st',
      description: 'TAD swap right (software)',
    },
  } as unknown as ReturnType<typeof own>);
  const candidate: SimulationDraftCandidate = {
    asOf: '2026-06-05T12:19:56.526Z',
    records: rows.map((r) => r.record),
    unresolved: [
      {
        dependencyId: 'software:unresolved',
        entitlementIds: ['ent:TAE:2029:1:own:x'],
        occurrenceIds: ['software:occurrence'],
        actions: ['transfer'],
        reason: 'software-reason',
        missingSource: 'software-missing',
        sourceRefs: ['software:ref'],
      },
    ],
    teamInputs: TEAMS.map((team) => ({ team })),
  };
  return compileSimulationDraftBaseline({
    apronHistory: history.map((h) => ({
      team: h.team,
      seasonStartYear: h.seasonStartYear,
      aboveSecondApron: h.above,
      sourceResultId: `software:${h.team}:${h.seasonStartYear}`,
    })),
    candidate,
    entitlements: rows.map((r) => r.doc),
    candidateSha256: 'a'.repeat(64),
    seasonId: '2025-26',
    releaseId: 'simulation-pick-status-software-test',
  });
}

const FULL = TEAMS.flatMap((team) =>
  [2024, 2025].map((seasonStartYear) => ({
    team,
    seasonStartYear,
    above: false,
  }))
);

describe('simulationPickStatuses (E1)', () => {
  it('labels every retained right and offers trades only where the review can accept them', () => {
    const statuses = simulationPickStatuses(compile(FULL));
    expect(statuses['ent:TAA:2026:1:own:x']).toEqual({
      tradeable: false,
      text: 'Not tradeable: the 2026 Draft is next, and trading its picks is not supported yet',
    });
    expect(statuses['ent:TAA:2028:1:own:x']).toEqual({
      tradeable: true,
      text: 'Unprotected, held outright',
    });
    expect(statuses['ent:TAA:2033:1:own:x']).toEqual({
      tradeable: false,
      text: 'Not tradeable until the 2026 Draft is over',
    });
    expect(statuses['ent:TAE:2029:1:own:x']).toEqual({
      tradeable: false,
      text: "Not tradeable: its terms can't be confirmed",
    });
    expect(statuses['ent:TAD:2028:1:swap:y']).toEqual({
      tradeable: false,
      text: 'Not tradeable yet: protected, swap or pool right',
    });
    // Picks inside the swap are held back too.
    expect(statuses['ent:TAC:2028:1:own:x'].tradeable).toBe(false);
    const tradeable = Object.values(statuses).filter((s) => s.tradeable);
    // 30 teams x 2027-2032, less TAE 2029 and the two picks in the swap.
    expect(tradeable).toHaveLength(30 * 6 - 3);
  });

  it('refuses a pick whose team has no Second Apron history', () => {
    const statuses = simulationPickStatuses(
      compile(FULL.filter((h) => h.team !== 'TAB'))
    );
    // Firsts before 2032 precede the freeze rule, so only 2032 depends on it.
    expect(statuses['ent:TAB:2032:1:own:x']).toEqual({
      tradeable: false,
      text: "Not tradeable: the team's Second Apron history is incomplete",
    });
    expect(statuses['ent:TAB:2031:1:own:x'].tradeable).toBe(true);
    expect(statuses['ent:TAA:2032:1:own:x'].tradeable).toBe(true);
  });

  it('refuses the frozen pick of a team above the Second Apron', () => {
    const statuses = simulationPickStatuses(
      compile(FULL.map((h) => (h.team === 'TAB' ? { ...h, above: true } : h)))
    );
    const frozen = Object.entries(statuses).filter(
      ([id, s]) =>
        id.startsWith('ent:TAB:') &&
        s.text === 'Not tradeable: frozen by the Second Apron rule'
    );
    expect(frozen.map(([id]) => id)).toEqual(['ent:TAB:2032:1:own:x']);
  });

  it('says nothing for a non-SIMULATION baseline', () => {
    const baseline = compile(FULL);
    expect(
      simulationPickStatuses({
        ...baseline,
        classification: 'real' as never,
      })
    ).toEqual({});
  });
});
