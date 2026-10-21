/**
 * FILE: src/features/ranker/hooks/useOwnerPlayerLists.ts
 * PURPOSE: The signed-in user's player lists (ordered ids first, then the rest) for importing into the ranker pool
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Extracted from RankingBuilder.tsx
 *
 * LINKS:
 *  - Used in: src/features/ranker/RankingBuilder.tsx
 */
import { useMemo } from 'react';
import { where } from 'firebase/firestore';
import { useFirebaseQuery } from '@/shared/hooks/useFirebaseQuery';
import { LISTS_COLLECTION } from '@/constants/collections';
import type { PlayerList } from '@/firebase/listHelpers';

export type OwnerPlayerList = { id: string; name: string; playerIds: string[] };

export const useOwnerPlayerLists = (
  userId: string | null | undefined
): OwnerPlayerList[] => {
  // Lists query (owner-scoped; skipped while signed out)
  const ownerConstraints = useMemo(
    () => (userId ? [where('ownerUid', '==', userId)] : []),
    [userId]
  );
  const { data: listsData } = useFirebaseQuery<PlayerList>(
    LISTS_COLLECTION,
    ownerConstraints,
    { enabled: Boolean(userId) }
  );

  const lists = useMemo(
    () =>
      (listsData || []).map((l) => {
        const orderIds = Array.isArray(l.playerOrder)
          ? l.playerOrder.filter((id): id is string => typeof id === 'string')
          : [];
        const allIds = Array.isArray(l.playerIds)
          ? l.playerIds.filter((id): id is string => typeof id === 'string')
          : [];
        const merged = [...orderIds];
        allIds.forEach((id) => {
          if (!merged.includes(id)) merged.push(id);
        });
        return { id: l.id, name: l.name, playerIds: merged };
      }),
    [listsData]
  );

  return lists;
};
