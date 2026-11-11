import { describe, expect, it } from 'vitest';
import { ordinaryDraftInventoryAdvance } from '@/features/architect/utils/draftReview/inventoryFence';

describe('ordinaryDraftInventoryAdvance', () => {
  it('advances a fenced world by exactly one', () => {
    expect(
      ordinaryDraftInventoryAdvance({ draftInventoryRevision: 0 })
    ).toEqual({ draftInventoryRevision: 1 });
    expect(
      ordinaryDraftInventoryAdvance({ draftInventoryRevision: 41 })
    ).toEqual({ draftInventoryRevision: 42 });
  });
  it('leaves a world that never opted in unchanged', () => {
    expect(ordinaryDraftInventoryAdvance({ actionCount: 3 })).toEqual({});
    expect(ordinaryDraftInventoryAdvance(undefined)).toEqual({});
  });
  it('fails closed on an invalid revision', () => {
    for (const draftInventoryRevision of [
      -1,
      1.5,
      '2',
      null,
      Number.MAX_SAFE_INTEGER,
    ])
      expect(() =>
        ordinaryDraftInventoryAdvance({ draftInventoryRevision })
      ).toThrow(/inventory revision/);
  });
});
