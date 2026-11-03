import { afterEach, describe, expect, it, vi } from 'vitest';
import * as digest from '@/features/architect/utils/contractSource/deterministicDigest';
import {
  HISTORICAL_OVERLAPPING_TERMS_SHA256,
  OVERLAPPING_TERMS_SHA256,
  requireAdmittedOverlappingEvent,
  requireAdmittedOverlappingTerms,
  verifyStoredOverlappingTerms,
} from '@/features/architect/utils/draftReview/overlappingTerms';
import { isNativeSelectionTradeAdmitted } from '@/features/architect/utils/draftReview/nativeTrading';
import { resolveOverlappingPool } from '@/features/architect/utils/draftReview/overlappingPool';
import { program, teams } from '../fixtures/draftOverlappingProgram';

// This suite tests admission routing with controlled digest results. It does not
// claim this software analogue hashes to either privately retained program.
// The exact accepted input is exercised separately by the private browser proof.
afterEach(() => vi.restoreAllMocks());
describe('versioned overlapping program admission', () => {
  it('pins the accepted replacement and preserves the original historical identity', () => {
    expect(OVERLAPPING_TERMS_SHA256).toBe(
      'sha256:230f39b559b01398f753d810824f2e906a5c83a58616622cc7029569f7477ac8'
    );
    expect(HISTORICAL_OVERLAPPING_TERMS_SHA256).toBe(
      'sha256:6856c1d73e9fd6cc1be33feb3d15f3a132f7fe4c3773e858f433c83fb0ca32ed'
    );
    expect(isNativeSelectionTradeAdmitted(program)).toBe(true);
    expect(isNativeSelectionTradeAdmitted({ ...program, year: 2029 })).toBe(
      false
    );
  });
  it('hashes the complete terms while keeping saved results outside the pin', async () => {
    const spy = vi
      .spyOn(digest, 'sha256Digest')
      .mockResolvedValue(OVERLAPPING_TERMS_SHA256);
    const after = resolveOverlappingPool(
      program,
      Object.fromEntries(teams.map((t, i) => [t, i + 9])),
      Object.fromEntries(program.claims.map((c) => [c.clauseId, true]))
    );
    const saved = structuredClone(after);
    await expect(requireAdmittedOverlappingTerms(after)).resolves.toEqual(
      after
    );
    expect(spy).toHaveBeenCalledWith(digest.canonicalStringify(program));
    expect(after).toEqual(saved);
  });
  it('reads historical terms and receipts without rewriting them or authorizing new operations', async () => {
    vi.spyOn(digest, 'sha256Digest').mockResolvedValue(
      HISTORICAL_OVERLAPPING_TERMS_SHA256
    );
    const saved = structuredClone(program);
    await expect(verifyStoredOverlappingTerms(program)).resolves.toEqual({
      program,
      historical: true,
    });
    await expect(requireAdmittedOverlappingTerms(program)).rejects.toThrow(
      /historical.*separate world/
    );
    await expect(
      requireAdmittedOverlappingEvent({
        metadata: { swapDraftReceipt: { before: program, after: program } },
      })
    ).resolves.toBeUndefined();
    await expect(
      requireAdmittedOverlappingEvent({
        metadata: {
          draftReviewReceipt: { assumptions: { nativeTrade: { program } } },
        },
      })
    ).resolves.toBeUndefined();
    expect(program).toEqual(saved);
  });
  it('rejects a receipt that changes authority between before and after', async () => {
    vi.spyOn(digest, 'sha256Digest')
      .mockResolvedValueOnce(HISTORICAL_OVERLAPPING_TERMS_SHA256)
      .mockResolvedValueOnce(OVERLAPPING_TERMS_SHA256);
    await expect(
      requireAdmittedOverlappingEvent({
        metadata: { swapDraftReceipt: { before: program, after: program } },
      })
    ).rejects.toThrow(/cannot change/);
  });
  it('does not accept an unknown digest or the never-admitted proposal v1', async () => {
    for (const hash of [
      'sha256:' + 'a'.repeat(64),
      'sha256:04e38fc3cf695c6ddd00e0d30f6c51870a6433c2b21d378abcc5869d701168e7',
    ]) {
      vi.spyOn(digest, 'sha256Digest').mockResolvedValue(hash);
      await expect(verifyStoredOverlappingTerms(program)).rejects.toThrow(
        /reviewed source-linked/
      );
      await expect(requireAdmittedOverlappingTerms(program)).rejects.toThrow(
        /reviewed source-linked/
      );
    }
  });
});
