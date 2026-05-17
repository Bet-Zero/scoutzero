/**
 * Wave 21 Step 2: World load request tracking sub-hook extracted from
 * useArchitectState.ts (lines 293–388).
 *
 * Owns the 4 staleness-tracking refs and returns the 8 tracking callbacks.
 * Main hook passes tracker results to useWorldLoader (Step 3).
 */

import { useRef, useCallback } from 'react';
import type {
  ActiveWorldDateMutationRequest,
  ActiveWorldLoadFreshness,
  ActiveWorldLoadRequest,
  ReloadActiveWorldTeamDataStaleDropResult,
} from './useArchitectState.types';

export type WorldLoadTrackerResult = {
  activeWorldIdentityTokenRef: React.MutableRefObject<number>;
  startWorldLoadRequest: (requestWorldId: string | null) => ActiveWorldLoadRequest;
  resolveWorldLoadFreshness: (request: ActiveWorldLoadRequest) => ActiveWorldLoadFreshness;
  isFreshWorldLoadRequest: (request: ActiveWorldLoadRequest) => boolean;
  resolveWorldLoadStaleDrop: (request: ActiveWorldLoadRequest) => ReloadActiveWorldTeamDataStaleDropResult | null;
  invalidateActiveWorldAsyncWork: (nextWorldId: string | null) => void;
  isCurrentActiveWorldIdentity: (candidateWorldId: string | null) => boolean;
  startWorldAsOfDateMutationRequest: (requestWorldId: string) => ActiveWorldDateMutationRequest;
  isCurrentWorldAsOfDateMutationRequest: (request: ActiveWorldDateMutationRequest) => boolean;
};

export function useWorldLoadTracker(): WorldLoadTrackerResult {
  const dataLoadRequestIdRef = useRef(0);
  const activeWorldIdentityRef = useRef<string | null>(null);
  const activeWorldIdentityTokenRef = useRef(0);
  const worldAsOfDateMutationIdRef = useRef(0);

  const startWorldLoadRequest = useCallback(
    (requestWorldId: string | null): ActiveWorldLoadRequest => {
      const requestId = dataLoadRequestIdRef.current + 1;
      dataLoadRequestIdRef.current = requestId;
      return { requestWorldId, requestId };
    },
    []
  );

  const resolveWorldLoadFreshness = useCallback(
    (request: ActiveWorldLoadRequest): ActiveWorldLoadFreshness => {
      if (activeWorldIdentityRef.current !== request.requestWorldId) {
        return { status: 'stale', reason: 'active-world-changed' };
      }
      if (dataLoadRequestIdRef.current !== request.requestId) {
        return { status: 'stale', reason: 'superseded-by-newer-request' };
      }
      return { status: 'fresh' };
    },
    []
  );

  const isFreshWorldLoadRequest = useCallback(
    (request: ActiveWorldLoadRequest) =>
      resolveWorldLoadFreshness(request).status === 'fresh',
    [resolveWorldLoadFreshness]
  );

  const resolveWorldLoadStaleDrop = useCallback(
    (
      request: ActiveWorldLoadRequest
    ): ReloadActiveWorldTeamDataStaleDropResult | null => {
      const freshness = resolveWorldLoadFreshness(request);
      if (freshness.status === 'fresh') return null;
      return { outcome: 'stale-drop', reason: freshness.reason };
    },
    [resolveWorldLoadFreshness]
  );

  const invalidateActiveWorldAsyncWork = useCallback(
    (nextWorldId: string | null) => {
      const identityChanged = activeWorldIdentityRef.current !== nextWorldId;
      activeWorldIdentityRef.current = nextWorldId;
      if (!identityChanged) return;
      activeWorldIdentityTokenRef.current += 1;
      dataLoadRequestIdRef.current += 1;
      worldAsOfDateMutationIdRef.current += 1;
    },
    []
  );

  const isCurrentActiveWorldIdentity = useCallback(
    (candidateWorldId: string | null) =>
      activeWorldIdentityRef.current === candidateWorldId,
    []
  );

  const startWorldAsOfDateMutationRequest = useCallback(
    (requestWorldId: string): ActiveWorldDateMutationRequest => {
      const requestId = worldAsOfDateMutationIdRef.current + 1;
      worldAsOfDateMutationIdRef.current = requestId;
      return { requestWorldId, requestId };
    },
    []
  );

  const isCurrentWorldAsOfDateMutationRequest = useCallback(
    (request: ActiveWorldDateMutationRequest) =>
      worldAsOfDateMutationIdRef.current === request.requestId &&
      activeWorldIdentityRef.current === request.requestWorldId,
    []
  );

  return {
    activeWorldIdentityTokenRef,
    startWorldLoadRequest,
    resolveWorldLoadFreshness,
    isFreshWorldLoadRequest,
    resolveWorldLoadStaleDrop,
    invalidateActiveWorldAsyncWork,
    isCurrentActiveWorldIdentity,
    startWorldAsOfDateMutationRequest,
    isCurrentWorldAsOfDateMutationRequest,
  };
}
