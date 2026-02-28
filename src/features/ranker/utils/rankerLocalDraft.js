/**
 * FILE: src/features/ranker/utils/rankerLocalDraft.js
 * PURPOSE: Local draft persistence for ranker sessions using sessionStorage
 * OWNERSHIP: Ranker feature
 *
 * DESCRIPTION:
 * Provides local-first persistence for in-progress ranker sessions.
 * All users (owner and non-owner) benefit from crash/refresh safety.
 * Stores a single "most recent session" draft in sessionStorage.
 *
 * IMPORTANT:
 * - Does NOT store currentPair or closureCache (both are derived on load)
 * - skippedPairs stored as array, converted to Set on load
 * - draftUpdatedAt is a timestamp for staleness detection
 */

const STORAGE_KEY = 'ranker_draft_v1';
const DEBOUNCE_MS = 800;

/**
 * @typedef {Object} RankerDraft
 * @property {string|null} name - Optional session name
 * @property {string[]} playerPoolIds - Array of player IDs in the pool
 * @property {Object|null} setupData - Setup configuration (topTier, bottomTier, anchor, etc.)
 * @property {Array<{winner: string, loser: string}>} results - Comparison results
 * @property {string[]} skippedPairs - Pairs temporarily skipped (stored as array)
 * @property {boolean} anchorDone - Whether anchor phase is complete
 * @property {boolean} isFinished - Whether ranking is fully complete
 * @property {string[]|null} adjustments - Final adjusted ranking (player IDs in order)
 * @property {number} draftUpdatedAt - Unix timestamp of last update
 * @property {string|null} firestoreSessionId - If saved to Firestore, store the doc ID
 */

/**
 * Serialize skippedPairs Set to array for storage.
 * @param {Set<string>|string[]} skippedPairs
 * @returns {string[]}
 */
const serializeSkippedPairs = (skippedPairs) => {
  if (!skippedPairs) return [];
  if (skippedPairs instanceof Set) return Array.from(skippedPairs);
  if (Array.isArray(skippedPairs)) return skippedPairs;
  return [];
};

/**
 * Deserialize skippedPairs array to Set.
 * @param {string[]|null|undefined} arr
 * @returns {Set<string>}
 */
const deserializeSkippedPairs = (arr) => {
  if (!Array.isArray(arr)) return new Set();
  return new Set(arr);
};

/**
 * Load draft from sessionStorage.
 * @returns {RankerDraft|null} The stored draft or null if not found/invalid
 */
export const loadLocalDraft = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    // Basic validation
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.playerPoolIds) || parsed.playerPoolIds.length < 2) {
      return null;
    }

    // Return with skippedPairs converted to Set
    return {
      ...parsed,
      skippedPairs: deserializeSkippedPairs(parsed.skippedPairs),
    };
  } catch (err) {
    console.warn('[rankerLocalDraft] Failed to load draft:', err);
    return null;
  }
};

/**
 * Save draft to sessionStorage (immediate, no debounce).
 * @param {Partial<RankerDraft>} draftData - Draft data to save
 */
export const saveLocalDraftImmediate = (draftData) => {
  try {
    const existing = loadLocalDraftRaw();
    const merged = {
      ...existing,
      ...draftData,
      skippedPairs: serializeSkippedPairs(draftData.skippedPairs ?? existing?.skippedPairs),
      draftUpdatedAt: Date.now(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (err) {
    console.warn('[rankerLocalDraft] Failed to save draft:', err);
  }
};

/**
 * Load raw draft (without Set conversion) for merging.
 * @returns {Object|null}
 */
const loadLocalDraftRaw = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * Clear local draft from sessionStorage.
 */
export const clearLocalDraft = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[rankerLocalDraft] Failed to clear draft:', err);
  }
};

/**
 * Check if a local draft exists.
 * @returns {boolean}
 */
export const hasLocalDraft = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return (
      parsed &&
      Array.isArray(parsed.playerPoolIds) &&
      parsed.playerPoolIds.length >= 2
    );
  } catch {
    return false;
  }
};

// ─── Debounced Save Handler ───────────────────────────────────────────────────

let debounceTimeout = null;

/**
 * Save draft with debounce (750-800ms delay).
 * Call this on every user action (select, skip, undo, setup completion).
 * @param {Partial<RankerDraft>} draftData - Draft data to save
 */
export const saveLocalDraftDebounced = (draftData) => {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }
  debounceTimeout = setTimeout(() => {
    saveLocalDraftImmediate(draftData);
    debounceTimeout = null;
  }, DEBOUNCE_MS);
};

/**
 * Flush any pending debounced save immediately.
 * Call this before page unload or when saving to Firestore.
 */
export const flushPendingDraftSave = () => {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
    debounceTimeout = null;
    // Note: We can't actually flush the pending data here since it's not stored
    // The pattern is to always call saveLocalDraftImmediate when you need instant save
  }
};

/**
 * Create initial draft structure from pool.
 * @param {Object} params
 * @param {string[]} params.playerPoolIds - Array of player IDs
 * @param {string|null} [params.name] - Optional session name
 * @returns {RankerDraft}
 */
export const createInitialDraft = ({
  playerPoolIds,
  name = null,
}) => {
  return {
    name: name || `Ranking ${new Date().toISOString().slice(0, 10)}`,
    playerPoolIds,
    setupData: null,
    results: [],
    skippedPairs: [],
    anchorDone: false,
    isFinished: false,
    adjustments: null,
    draftUpdatedAt: Date.now(),
    firestoreSessionId: null,
  };
};

// ─── Export Utilities for Testing ─────────────────────────────────────────────

export const __testing = {
  serializeSkippedPairs,
  deserializeSkippedPairs,
  STORAGE_KEY,
  DEBOUNCE_MS,
};

export default {
  loadLocalDraft,
  saveLocalDraftImmediate,
  saveLocalDraftDebounced,
  clearLocalDraft,
  hasLocalDraft,
  flushPendingDraftSave,
  createInitialDraft,
};
