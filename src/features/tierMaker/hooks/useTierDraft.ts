/**
 * useTierDraft.ts — sessionStorage persistence hook for Tiermaker/Tieramid draft state.
 *
 * Manages both standard and tieramid draft layouts under a single sessionStorage key.
 * Only active when isDraftMode is true (no tierListId in the URL).
 *
 * Storage key: tiermaker_draft_v1
 * Debounce: ~1000ms for sessionStorage writes
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DraftStandard {
  tiers: Record<string, string[]>;
  tierOrder: string[];
}

export interface DraftTieramid {
  rows: Record<string, string[]>;
  rowOrder: string[];
}

interface DraftEnvelope {
  draftStandard: DraftStandard | null;
  draftTieramid: DraftTieramid | null;
  draftUpdatedAt: number | null;
}

export interface UseTierDraftReturn {
  draftStandard: DraftStandard | null;
  draftTieramid: DraftTieramid | null;
  draftUpdatedAt: number | null;
  updateStandard: (data: DraftStandard) => void;
  updateTieramid: (data: DraftTieramid) => void;
  clearDraft: () => void;
  /** True once the initial sessionStorage restore has finished (or was skipped). */
  restored: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'tiermaker_draft_v1';
const DEBOUNCE_MS = 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArrayRecord = (value: unknown): value is Record<string, string[]> =>
  isRecord(value) &&
  Object.values(value).every(
    (items) =>
      Array.isArray(items) &&
      items.every((item): item is string => typeof item === 'string')
  );

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every((item): item is string => typeof item === 'string');

const parseDraftStandard = (value: unknown): DraftStandard | null => {
  if (!isRecord(value)) return null;
  if (!isStringArrayRecord(value.tiers) || !isStringArray(value.tierOrder)) {
    return null;
  }

  return {
    tiers: value.tiers,
    tierOrder: value.tierOrder,
  };
};

const parseDraftTieramid = (value: unknown): DraftTieramid | null => {
  if (!isRecord(value)) return null;
  if (!isStringArrayRecord(value.rows) || !isStringArray(value.rowOrder)) {
    return null;
  }

  return {
    rows: value.rows,
    rowOrder: value.rowOrder,
  };
};

const parseDraftEnvelope = (value: unknown): DraftEnvelope | null => {
  if (!isRecord(value)) return null;

  const draftStandard =
    value.draftStandard === null || value.draftStandard === undefined
      ? null
      : parseDraftStandard(value.draftStandard);
  const draftTieramid =
    value.draftTieramid === null || value.draftTieramid === undefined
      ? null
      : parseDraftTieramid(value.draftTieramid);

  if (
    (value.draftStandard !== null && value.draftStandard !== undefined && !draftStandard) ||
    (value.draftTieramid !== null && value.draftTieramid !== undefined && !draftTieramid)
  ) {
    return null;
  }

  const draftUpdatedAt =
    typeof value.draftUpdatedAt === 'number' &&
    Number.isFinite(value.draftUpdatedAt)
      ? value.draftUpdatedAt
      : null;

  return {
    draftStandard,
    draftTieramid,
    draftUpdatedAt,
  };
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTierDraft(isDraftMode: boolean): UseTierDraftReturn {
  const [draftStandard, setDraftStandard] = useState<DraftStandard | null>(
    null
  );
  const [draftTieramid, setDraftTieramid] = useState<DraftTieramid | null>(
    null
  );
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<number | null>(null);
  const [restored, setRestored] = useState(!isDraftMode);

  // Ref to track whether we've already restored this session
  const hasRestored = useRef(false);

  // ── Restore from sessionStorage on mount (draft mode only) ──────────────
  useEffect(() => {
    if (!isDraftMode || hasRestored.current) {
      setRestored(true);
      return;
    }
    hasRestored.current = true;

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = parseDraftEnvelope(JSON.parse(raw));
        if (!parsed) {
          sessionStorage.removeItem(STORAGE_KEY);
          setRestored(true);
          return;
        }
        if (parsed.draftStandard) setDraftStandard(parsed.draftStandard);
        if (parsed.draftTieramid) setDraftTieramid(parsed.draftTieramid);
        if (parsed.draftUpdatedAt !== null) setDraftUpdatedAt(parsed.draftUpdatedAt);
      }
    } catch {
      // Corrupted data — clear it and start fresh
      sessionStorage.removeItem(STORAGE_KEY);
    }
    setRestored(true);
  }, [isDraftMode]);

  // ── Debounced save to sessionStorage ────────────────────────────────────
  useEffect(() => {
    if (!isDraftMode || !restored) return;

    // Don't persist if everything is null (nothing to save)
    if (!draftStandard && !draftTieramid) return;

    const timer = setTimeout(() => {
      try {
        const envelope: DraftEnvelope = {
          draftStandard,
          draftTieramid,
          draftUpdatedAt,
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
      } catch {
        // sessionStorage full or unavailable — silently ignore
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [isDraftMode, restored, draftStandard, draftTieramid, draftUpdatedAt]);

  // ── Updaters ────────────────────────────────────────────────────────────
  const updateStandard = useCallback((data: DraftStandard) => {
    setDraftStandard(data);
    setDraftUpdatedAt(Date.now());
  }, []);

  const updateTieramid = useCallback((data: DraftTieramid) => {
    setDraftTieramid(data);
    setDraftUpdatedAt(Date.now());
  }, []);

  const clearDraft = useCallback(() => {
    setDraftStandard(null);
    setDraftTieramid(null);
    setDraftUpdatedAt(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return {
    draftStandard,
    draftTieramid,
    draftUpdatedAt,
    updateStandard,
    updateTieramid,
    clearDraft,
    restored,
  };
}
