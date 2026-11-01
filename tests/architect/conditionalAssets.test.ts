import { describe, expect, it } from 'vitest';
import { swapAssets } from '@/features/architect/utils/draftReview/swapAssets';
import { resolveConditionalDraft } from '@/features/architect/utils/draftReview/conditionalProgram';

const program = {
  id: 'p',
  originalTeam: 'CHI',
  stages: [
    { entitlementId: 'a', year: 2026, protectedThrough: 10 },
    { entitlementId: 'b', year: 2027, protectedThrough: 0 },
  ],
  results: [],
};
function state() {
  return {
    metadata: {},
    programs: [structuredClone(program)],
    entitlements: {
      a: { holderTeam: 'ORL', seasonYear: 2026, kind: 'pick_ownership' },
      b: { holderTeam: 'CHI', seasonYear: 2027, kind: 'pick_ownership' },
    },
    catalogue: {
      data: {
        records: program.stages.map((s) => ({
          entitlementId: s.entitlementId,
          originalPick: { originalTeam: 'CHI', draftYear: s.year },
        })),
      },
    },
  } as unknown as Parameters<typeof swapAssets>[0];
}
describe('conditional selection and beneficiary projections', () => {
  it('separates the conditional right from retained selection and reserved fallback', () => {
    const s = state();
    const owner = swapAssets(s, 'CHI', 2026),
      beneficiary = swapAssets(s, 'ORL', 2026);
    expect(owner).toMatchObject({
      status: 'available',
      firstRoundCount: 2,
      rightCount: 0,
      years: [
        {
          year: 2026,
          firstRound: [
            { key: 'a', protectionLabel: 'Top 10 retained; otherwise to ORL' },
          ],
        },
        {
          year: 2027,
          firstRound: [
            {
              key: 'b',
              protectionLabel:
                'Reserved fallback — owed to ORL if 2026 is protected',
            },
          ],
        },
      ],
    });
    expect(beneficiary).toMatchObject({
      status: 'available',
      firstRoundCount: 0,
      rightCount: 1,
      years: [
        {
          firstRound: [],
          rights: [
            {
              key: 'a',
              label:
                'CHI 2026 conditional first — picks 11–30; otherwise 2027 unprotected first',
            },
          ],
        },
      ],
    });
  });
  it.each([10, 11])(
    'projects actual selection ownership after position %s',
    (position) => {
      const s = state();
      s.programs = [resolveConditionalDraft(program, position)];
      if (position === 10) {
        s.entitlements.a.holderTeam = 'CHI';
        s.entitlements.b.holderTeam = 'ORL';
      }
      expect(swapAssets(s, 'ORL', 2026)).toMatchObject({
        firstRoundCount: position === 10 ? 0 : 1,
        rightCount: position === 10 ? 1 : 0,
      });
      const next = swapAssets(s, 'CHI', 2027);
      expect(next).toMatchObject({
        firstRoundCount: position === 10 ? 0 : 1,
        rightCount: 0,
      });
      if (position === 10) {
        s.programs = [resolveConditionalDraft(s.programs[0], 1)];
        expect(swapAssets(s, 'ORL', 2027)).toMatchObject({
          firstRoundCount: 1,
          rightCount: 0,
          years: [
            {
              firstRound: [
                {
                  key: 'b',
                  sourceLabel: 'via CHI',
                  protectionLabel: 'Final pick 1 · conveyed',
                },
              ],
            },
          ],
        });
      }
    }
  );
});
