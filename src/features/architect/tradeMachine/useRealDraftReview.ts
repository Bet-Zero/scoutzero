import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { sha256Digest } from '@/features/architect/utils/contractSource/deterministicDigest';
import { mutationSnapshotText } from '@/features/architect/utils/mutationPipeline.snapshotDigest';
import {
  loadRealDraftReview,
  reviewRealDraftSelection,
  type RealDraftSelectionReview,
} from '@/features/architect/utils/draftPickRealReview';

export type DraftReviewTeam = {
  team: { id?: string | null; teamCode?: string | null } | null;
  entitlementsOut?: {
    id?: string | number | null;
    entitlementId?: string | number | null;
    round?: number | string | null;
  }[];
};

export function useRealDraftReview(
  teams: DraftReviewTeam[],
  asOfDate: string | null,
  worldId: string | null
) {
  const { user, loading: authLoading } = useAuth();
  // Entire proposal/state, including destinations and terms. A late response may
  // never reappear after a selection, world, date, or roster change.
  const key = mutationSnapshotText({
    teams,
    asOfDate,
    worldId,
    userId: user?.uid ?? null,
  });
  const selections = teams.flatMap((slot) =>
    (slot.entitlementsOut ?? [])
      .filter((e) => Number(e.round) === 1)
      .map((e) => ({
        entitlementId: String(e.entitlementId ?? e.id ?? ''),
        team: String(slot.team?.teamCode ?? slot.team?.id ?? ''),
      }))
  );
  const [result, setResult] = useState<{
    key: string;
    review?: RealDraftSelectionReview;
    error?: string;
  } | null>(null);
  useEffect(() => {
    setResult(null);
    if (!selections.length || authLoading) return;
    const controller = new AbortController();
    async function read() {
      try {
        if (!user) throw new Error('Sign in to load the retained pick review.');
        const idToken = await user.getIdToken();
        if (controller.signal.aborted) return;
        const response = await fetch('/api/architect/draft-review', {
          headers: { Authorization: `Bearer ${idToken}` },
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok)
          throw new Error(
            'The retained pick review is unavailable. First-round trades still need a complete review.'
          );
        const token = await loadRealDraftReview(await response.text());
        const digest = (await sha256Digest(key)).slice(7);
        const review = reviewRealDraftSelection(token, {
          selections,
          asOfDate,
          proposalSha256: digest,
          stateVersion: digest,
        });
        if (!controller.signal.aborted) setResult({ key, review });
      } catch (error) {
        if (!controller.signal.aborted)
          setResult({
            key,
            error:
              error instanceof Error
                ? error.message
                : 'Pick review could not be loaded.',
          });
      }
    }
    void read();
    return () => controller.abort();
    // The complete serialized input is the dependency; selections are derived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, user, authLoading]);
  if (!selections.length) return null;
  return result?.key === key ? result : { key, loading: true as const };
}
