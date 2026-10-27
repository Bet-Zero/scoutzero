import { describe, expect, it } from 'vitest';
import { DraftConditionalProgramsZ } from '@/schemas/draftConditionalProgram';
import { DraftConditionalReceiptZ } from '@/schemas/draftConditionalReceipt';
import { evaluateSuppliedDraftStepien } from '@/features/architect/utils/draftStepien';
import {
  syntheticDraftOperation,
  syntheticOriginal,
} from './fixtures/draftPickOperation';
import {
  activeConditionalStage,
  conditionalPostTradeBranches,
  conditionalPrograms,
  resolveConditionalDraft,
} from '@/features/architect/utils/draftReview/conditionalProgram';

const program = {
  id: 'p',
  originalTeam: 'AAA',
  stages: [
    { entitlementId: 'a', year: 2026, protectedThrough: 10 },
    { entitlementId: 'b', year: 2027, protectedThrough: 0 },
  ],
  results: [],
};
const originals = program.stages.map((s) => ({
  entitlementId: s.entitlementId,
  originalPick: {
    kind: 'authenticated-original-pick' as const,
    id: `AAA_${s.year}_1st`,
    originalTeam: 'AAA',
    draftYear: s.year,
    round: 1 as const,
  },
}));
describe('conditional first-round contract', () => {
  it('conveys above the boundary and ends the obligation', () => {
    const result = resolveConditionalDraft(program, 11);
    expect(result.results).toEqual([
      { year: 2026, position: 11, outcome: 'conveyed' },
    ]);
    expect(activeConditionalStage(result)).toBeNull();
    expect(() => resolveConditionalDraft(result, 11)).toThrow();
  });
  it('defers at the boundary and conveys the explicit final unprotected first', () => {
    const deferred = resolveConditionalDraft(program, 10);
    expect(activeConditionalStage(deferred)?.entitlementId).toBe('b');
    expect(resolveConditionalDraft(deferred, 1).results.at(-1)).toEqual({
      year: 2027,
      position: 1,
      outcome: 'conveyed',
    });
  });
  it.each([0, 31, 1.5, NaN])('rejects invalid position %s', (position) => {
    expect(() => resolveConditionalDraft(program, position)).toThrow();
  });
  it('requires a complete explicit terminal and every intervening year', () => {
    expect(() =>
      DraftConditionalProgramsZ.parse([
        { ...program, stages: [program.stages[0]] },
      ])
    ).toThrow();
    expect(() =>
      DraftConditionalProgramsZ.parse([
        {
          ...program,
          stages: [program.stages[0], { ...program.stages[1], year: 2028 }],
        },
      ])
    ).toThrow();
  });
  it('does not invent an impossible conveyance for top-30 protection', () => {
    const complete = {
      ...program,
      stages: [
        { ...program.stages[0], protectedThrough: 30 },
        program.stages[1],
      ],
    };
    const branches = conditionalPostTradeBranches({
      programs: [complete],
      originals,
      holders: { a: 'BBB', b: 'AAA' },
      team: 'AAA',
      firstYear: 2026,
      throughYear: 2027,
    });
    expect(branches.map((b) => b.conditionalOutcomes)).toEqual([{ p: 2027 }]);
    expect(resolveConditionalDraft(complete, 30).results[0].outcome).toBe(
      'deferred'
    );
  });
  it('rejects competing programs and independently held fallback firsts', () => {
    expect(() =>
      DraftConditionalProgramsZ.parse([program, { ...program, id: 'q' }])
    ).toThrow();
    expect(() =>
      conditionalPrograms([program], originals, {
        a: { holderTeam: 'BBB' },
        b: { holderTeam: 'CCC' },
      })
    ).toThrow(/competing/);
  });
  it('rejects outcome tampering and skipped/repeated stages', () => {
    for (const results of [
      [{ year: 2026, position: 10, outcome: 'conveyed' }],
      [{ year: 2027, position: 1, outcome: 'conveyed' }],
      [
        { year: 2026, position: 11, outcome: 'conveyed' },
        { year: 2027, position: 1, outcome: 'conveyed' },
      ],
    ])
      expect(() =>
        DraftConditionalProgramsZ.parse([{ ...program, results }])
      ).toThrow();
  });
  it('enumerates both teams’ mutually exclusive possession, with unknown other holdings', () => {
    const review = (team: string) =>
      conditionalPostTradeBranches({
        programs: [program],
        originals,
        holders: { a: 'BBB', b: 'AAA' },
        team,
        firstYear: 2026,
        throughYear: 2027,
      });
    expect(
      review('AAA').map((b) =>
        b.drafts.map((d) => d.retained.map((p) => p.draftYear))
      )
    ).toEqual([
      [[], [2027]],
      [[2026], []],
    ]);
    expect(
      review('BBB').map((b) =>
        b.drafts.map((d) => d.retained.map((p) => p.draftYear))
      )
    ).toEqual([
      [[2026], []],
      [[], [2027]],
    ]);
    expect(
      review('AAA').every((b) => b.drafts.every((d) => !d.inventoryComplete))
    ).toBe(true);
  });
});

describe('complete conditional outcome review', () => {
  it('evaluates the Cartesian product of independent obligations', () => {
    const other = {
      ...program,
      id: 'q',
      originalTeam: 'CCC',
      stages: program.stages.map((s, i) => ({ ...s, entitlementId: `c${i}` })),
    };
    const rows = [
      ...originals,
      ...originals.map((r, i) => ({
        entitlementId: `c${i}`,
        originalPick: {
          ...r.originalPick,
          id: `CCC_${r.originalPick.draftYear}_1st`,
          originalTeam: 'CCC',
        },
      })),
    ];
    const branches = conditionalPostTradeBranches({
      programs: [program, other],
      originals: rows,
      holders: { a: 'BBB', b: 'AAA', c0: 'BBB', c1: 'CCC' },
      team: 'BBB',
      firstYear: 2026,
      throughYear: 2027,
    });
    expect(branches.map((b) => b.conditionalOutcomes)).toEqual([
      { p: 2026, q: 2026 },
      { p: 2026, q: 2027 },
      { p: 2027, q: 2026 },
      { p: 2027, q: 2027 },
    ]);
    expect(branches.map((b) => b.drafts.map((d) => d.retained.length))).toEqual(
      [
        [2, 0],
        [1, 1],
        [1, 1],
        [0, 2],
      ]
    );
  });
  function fixture() {
    const f = syntheticDraftOperation();
    const terms = {
      ...program,
      originalTeam: 'BOS',
      stages: [
        { ...program.stages[0], year: 2028 },
        { ...program.stages[1], year: 2029 },
      ],
    };
    f.stepien.conditionalPrograms = [terms];
    f.stepien.branches = [2028, 2029].map((year) => ({
      id: `conveys-${year}`,
      possible: true,
      unresolvedDependencyIds: [],
      conditionalOutcomes: { p: year },
      drafts: [2027, 2028, 2029, 2030].map((draftYear) => ({
        draftYear,
        inventoryComplete: true,
        retained: draftYear === year ? [] : [syntheticOriginal(draftYear)],
      })),
    }));
    return f;
  }
  it('requires every outcome and accepts the protected retained first only in the deferral branch', () => {
    const f = fixture();
    expect(evaluateSuppliedDraftStepien(f.request, [f.stepien]).status).toBe(
      'component-permits'
    );
    f.stepien.branches.pop();
    expect(
      evaluateSuppliedDraftStepien(f.request, [f.stepien]).reasons
    ).toContain('complete-conditional-outcomes-required');
  });
  it.each(['missing', 'duplicate', 'wrong', 'contradictory'])(
    'fails closed on %s outcomes',
    (kind) => {
      const f = fixture();
      if (kind === 'missing') delete f.stepien.branches[0].conditionalOutcomes;
      if (kind === 'duplicate')
        f.stepien.branches[1].conditionalOutcomes = { p: 2028 };
      if (kind === 'wrong')
        f.stepien.branches[1].conditionalOutcomes = { p: 2030 };
      if (kind === 'contradictory')
        f.stepien.branches[0].drafts[1].retained = [syntheticOriginal(2028)];
      expect(evaluateSuppliedDraftStepien(f.request, [f.stepien]).status).toBe(
        'needs-input'
      );
    }
  );
  it('prohibits consecutive empty firsts in just one possible branch', () => {
    const f = fixture();
    f.stepien.branches[1].drafts[3].retained = [];
    expect(evaluateSuppliedDraftStepien(f.request, [f.stepien]).status).toBe(
      'component-prohibits'
    );
  });
});

describe('conditional receipt consistency', () => {
  const valid = () => ({
    scope: 'governed-simulation-only',
    worldId: 'test',
    operationId: 'draft',
    catalogueSha256: 'a'.repeat(64),
    before: [program],
    after: [resolveConditionalDraft(program, 10)],
    positions: { AAA: 10 },
    draftYear: 2026,
    date: '2026-06-30',
    movements: [
      {
        entitlementId: 'a',
        originalTeam: 'AAA',
        year: 2026,
        round: 1,
        fromTeam: 'BBB',
        toTeam: 'AAA',
      },
      {
        entitlementId: 'b',
        originalTeam: 'AAA',
        year: 2027,
        round: 1,
        fromTeam: 'AAA',
        toTeam: 'BBB',
      },
    ],
  });
  it('accepts the reciprocal return and deferred transfer', () =>
    expect(DraftConditionalReceiptZ.safeParse(valid()).success).toBe(true));
  it.each([
    'missing-movement',
    'wrong-beneficiary',
    'changed-terms',
    'wrong-position',
    'extra-position',
    'unresolved-result',
  ])('rejects %s', (kind) => {
    const r = valid();
    if (kind === 'missing-movement') r.movements.pop();
    if (kind === 'wrong-beneficiary') r.movements[1].toTeam = 'CCC';
    if (kind === 'changed-terms') r.after[0].stages[0].protectedThrough = 11;
    if (kind === 'wrong-position') r.positions.AAA = 9;
    if (kind === 'extra-position') Object.assign(r.positions, { CCC: 12 });
    if (kind === 'unresolved-result') r.after[0].results = [];
    expect(DraftConditionalReceiptZ.safeParse(r).success).toBe(false);
  });
});
