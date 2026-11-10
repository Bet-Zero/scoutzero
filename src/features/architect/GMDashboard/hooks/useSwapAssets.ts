import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, isSyntheticDraftReviewEnvironment } from '@/firebaseConfig';
import { loadGovernedDraftWorld } from '../../utils/governedDraftWorld.load';
import { governedDraftWorldAssets } from '../../utils/governedDraftWorld.assets';
import { ARCHITECT_WORLDS_COLLECTION } from '@/constants/collections';
import { loadConditionalWorld } from '../../utils/draftReview/conditionalWorld';
import { swapAssets } from '../../utils/draftReview/swapAssets';
import type { ArchitectWorkspaceDraftAssetsSummary } from './useArchitectWorkspaceContext';
/** Saved draft read projection; never writes legacy draftPicks or source records. */
export function useSwapAssets(
  worldId: string | null | undefined,
  team: string | null | undefined,
  year: number | null | undefined,
  inventoryKey: string
) {
  const key = JSON.stringify([worldId, team, year, inventoryKey]);
  const [value, setValue] = useState<{
    key: string;
    summary: ArchitectWorkspaceDraftAssetsSummary | null;
  } | null>(null);
  const enabled = !!worldId && !!team && !!year;
  useEffect(() => {
    setValue(null);
    if (!worldId || !team || !year || !enabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const metadata = (
          await getDoc(doc(db, ARCHITECT_WORLDS_COLLECTION, worldId))
        ).data();
        if (cancelled) return;
        if (metadata?.draftBaseline) {
          const state = await loadGovernedDraftWorld(worldId);
          if (!state) throw new Error('Saved draft source disappeared.');
          if (!cancelled)
            setValue({
              key,
              summary: governedDraftWorldAssets(state, team, year),
            });
          return;
        }
        if (
          !isSyntheticDraftReviewEnvironment() ||
          ![
            'unconditional',
            'protection-programs',
            'swap-program',
            'apron-lifecycle',
          ].includes(String(metadata?.draftSimulationBranches))
        ) {
          setValue({ key, summary: null });
          return;
        }
        const state = await loadConditionalWorld(worldId, {
          readOnly: true,
          allowUnconditionalInventory:
            metadata?.draftSimulationBranches === 'unconditional',
        });
        if (!cancelled)
          setValue({ key, summary: swapAssets(state, team, year) });
      } catch {
        if (!cancelled)
          setValue({
            key,
            summary: {
              status: 'unavailable',
              deferralHint: 'see-trade-history',
              reason: 'Saved draft inventory could not be verified.',
            },
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, worldId, team, year, enabled]);
  return !enabled
    ? null
    : value?.key === key
      ? value.summary
      : ({ status: 'loading' } as const);
}
