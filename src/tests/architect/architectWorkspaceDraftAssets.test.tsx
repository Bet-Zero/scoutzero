import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../../functions/src/architect/fixtures/governedDraftWorld.json';
import { seedMockData } from '../../../tests/__mocks__/firebase';
import { ARCHITECT_WORLDS_COLLECTION } from '@/constants/collections';
import { useArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import { loadGovernedDraftWorld } from '@/features/architect/utils/governedDraftWorld.load';
import {
  governedDraftHolders,
  validateGovernedDraftBaseline,
} from '@/features/architect/utils/governedDraftWorld.baseline';

vi.mock('@/features/architect/utils/governedDraftWorld.load', () => ({
  loadGovernedDraftWorld: vi.fn(),
}));

describe('saved draft inventory in the workspace', () => {
  beforeEach(() => {
    const baseline = validateGovernedDraftBaseline(structuredClone(fixture));
    const { holders } = governedDraftHolders(baseline, []);
    seedMockData(`${ARCHITECT_WORLDS_COLLECTION}/inventory-world`, {
      draftBaseline: { releaseId: 'test-release' },
    });
    vi.mocked(loadGovernedDraftWorld).mockResolvedValue({
      baseline,
      holders,
      metadata: {},
      transfers: [],
      teams: {},
      entitlements: {},
      documentSnapshots: {},
      digest: 'test-digest',
    });
  });

  it.each(['celtics', 'BOS', 'bos'])(
    'shows the same saved picks when the route uses %s',
    async (teamId) => {
      const { result } = renderHook(() =>
        useArchitectWorkspaceContext({
          teamId,
          teamCapSheet: { teamCode: 'BOS', teamName: 'Boston Celtics' },
          worldId: 'inventory-world',
          currentYear: 2026,
        })
      );
      await waitFor(() =>
        expect(result.current.draftAssets).toMatchObject({
          status: 'available',
          firstRoundCount: 7,
        })
      );
      expect(result.current.draftAssets).toMatchObject({
        years: expect.arrayContaining([
          expect.objectContaining({
            year: 2028,
            firstRound: expect.arrayContaining([
              expect.objectContaining({ isOwn: true, sourceLabel: 'Own' }),
            ]),
          }),
        ]),
      });
    }
  );
});
