/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectPostActionReceipt.ts
 * PURPOSE: Stage 2B session-scoped state for the post-action handoff strip.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Holds at most one active receipt at a time. Publishing a new receipt
 * replaces the prior one. Dismissal clears the receipt manually.
 *
 * `generation` increments on every successful publish so dependent surfaces
 * (e.g. the activity rail) can opt into a single, debounced refetch.
 *
 * Session-scoped only. Never persisted to Firestore. No new write authority.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArchitectPostActionReceipt } from '../postActionHandoff/types';

export interface UseArchitectPostActionReceiptResult {
  receipt: ArchitectPostActionReceipt | null;
  generation: number;
  publish: (receipt: ArchitectPostActionReceipt | null) => void;
  dismiss: () => void;
}

export function useArchitectPostActionReceipt(
  scopeKey?: string | null
): UseArchitectPostActionReceiptResult {
  const [receipt, setReceipt] = useState<ArchitectPostActionReceipt | null>(
    null
  );
  const [generation, setGeneration] = useState(0);
  const lastScopeKeyRef = useRef<string | null | undefined>(scopeKey);

  useEffect(() => {
    if (scopeKey === undefined) {
      return;
    }
    if (lastScopeKeyRef.current === scopeKey) {
      return;
    }
    lastScopeKeyRef.current = scopeKey;
    setReceipt(null);
  }, [scopeKey]);

  const publish = useCallback(
    (next: ArchitectPostActionReceipt | null) => {
      if (!next) {
        return;
      }
      setReceipt(next);
      setGeneration((prev) => prev + 1);
    },
    []
  );

  const dismiss = useCallback(() => {
    setReceipt(null);
  }, []);

  return { receipt, generation, publish, dismiss };
}
