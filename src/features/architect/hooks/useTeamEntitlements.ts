/**
 * FILE: src/features/architect/hooks/useTeamEntitlements.ts
 * PURPOSE: Load effective entitlements for a team using base + world overrides.
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * HISTORY:
 *  - 2026-01-21: Created by plan `plans/pst-phase-10-firestore-entitlements/plan.md`, no chunks
 *
 * LINKS:
 *  - Plan: plans/pst-phase-10-firestore-entitlements/plan.md
 *  - Latest Chunk: n/a
 */

import { useEffect, useState } from 'react';
import {
  resolveEntitlementsForTeam,
  type EffectiveEntitlement,
} from '@/features/architect/utils/entitlements/entitlementResolver';

type UseTeamEntitlementsResult = {
  entitlements: EffectiveEntitlement[];
  loading: boolean;
  error: string | null;
};

export const useTeamEntitlements = (
  worldId: string | null,
  teamCode: string | null
): UseTeamEntitlementsResult => {
  const [entitlements, setEntitlements] = useState<EffectiveEntitlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    if (!teamCode) {
      setEntitlements([]);
      setLoading(false);
      setError(null);
      return () => {
        isActive = false;
      };
    }

    setLoading(true);
    setError(null);

    resolveEntitlementsForTeam(worldId, teamCode)
      .then((data) => {
        if (!isActive) return;
        setEntitlements(data);
      })
      .catch((err) => {
        if (!isActive) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      })
      .finally(() => {
        if (!isActive) return;
        setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [worldId, teamCode]);

  return { entitlements, loading, error };
};
