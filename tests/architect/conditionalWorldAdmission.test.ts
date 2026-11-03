import { afterEach, expect, it, vi } from 'vitest';
import { program } from '../fixtures/draftOverlappingProgram';
import * as digest from '@/features/architect/utils/contractSource/deterministicDigest';
import {
  HISTORICAL_OVERLAPPING_TERMS_SHA256,
  OVERLAPPING_TERMS_SHA256,
} from '@/features/architect/utils/draftReview/overlappingTerms';
import { loadConditionalWorld } from '@/features/architect/utils/draftReview/conditionalWorld';

// Isolate the loader's read/write admission boundary. Inventory and receipt
// replay use their existing tests and the real private emulator journeys.
vi.mock('@/firebaseConfig', () => ({
  db: {},
  auth: { currentUser: { uid: 'owner', getIdToken: async () => 'emulator' } },
  isSyntheticDraftReviewEnvironment: () => true,
}));
vi.mock('firebase/firestore', () => ({
  doc: (_: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
  collection: (_: unknown, name: string) => ({ path: name }),
  getDoc: async () => ({
    data: () => ({
      createdBy: 'owner',
      draftInventoryRevision: 0,
      draftSimulationBranches: 'swap-program',
    }),
  }),
  getDocs: async (ref: { path: string }) =>
    ref.path === 'teams'
      ? {
          size: 30,
          docs: Array.from({ length: 30 }, (_, i) => ({
            id: String(i),
            ref: { path: `teams/${i}` },
            data: () => ({}),
          })),
        }
      : { size: 0, docs: [] },
}));
vi.mock('@/features/architect/utils/draftReview/simulationInventory', () => ({
  assertSimulationInventory: vi.fn(),
  loadSimulationCatalogue: async () => ({ data: { records: [] } }),
}));
vi.mock('@/features/architect/utils/draftReview/conditionalProgram', () => ({
  conditionalPrograms: () => [],
}));
vi.mock('@/features/architect/utils/draftReview/swapProgram', async () => ({
  swapProgram: () => program,
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('defaults every action loader to active admission; historical display is an explicit read-only opt-in', async () => {
  vi.stubGlobal('fetch', async () => ({ ok: true, text: async () => '' }));
  const hash = vi
    .spyOn(digest, 'sha256Digest')
    .mockResolvedValue(HISTORICAL_OVERLAPPING_TERMS_SHA256);
  await expect(loadConditionalWorld('world')).rejects.toThrow(/historical/);
  const historical = await loadConditionalWorld('world', { readOnly: true });
  expect(historical.historicalTerms).toBe(true);
  expect(historical.swap).toEqual(program);
  hash.mockResolvedValue(OVERLAPPING_TERMS_SHA256);
  expect((await loadConditionalWorld('world')).historicalTerms).toBe(false);
  hash.mockResolvedValue('sha256:' + 'f'.repeat(64));
  await expect(
    loadConditionalWorld('world', { readOnly: true })
  ).rejects.toThrow(/reviewed source-linked/);
});
