import type { FieldState } from './fieldBuilder';

type RankerComparison = {
  winner: string;
  loser: string;
};

export type RankerSetupData = {
  topTier?: string[];
  bottomTier?: string[];
  anchor?: string | null;
  firstPlace?: string | null;
  lastPlace?: string | null;
  // Top-N mode: only the best N are found and ordered (null = rank everyone)
  topN?: number | null;
  // Top-N mode: players cut by hand; `at` is the result count when cut (-1 = setup)
  cuts?: Array<{ ids: string[]; at: number }>;
  // Top-N list: the field being built before the ranking (see utils/fieldBuilder)
  field?: FieldState;
  // The ranking setup screen has been completed (only meaningful with `field`)
  configured?: boolean;
  // Steps taken with a button (not matchup answers), newest last, so undo can take them back
  steps?: RankerSessionStep[];
  [key: string]: unknown;
};

// The session just before a step button was pressed
export type RankerSessionStep = {
  setupData: Omit<RankerSetupData, 'steps'> | null;
  // Number of results then; undoing the step drops any added since (setup seeds)
  results: number;
  seedCount: number;
  anchorDone: boolean;
};

type SkippedPairsInput = Set<string> | string[] | null | undefined;

type StoredRankerDraft = {
  name: string | null;
  playerPoolIds: string[];
  setupData: RankerSetupData | null;
  results: RankerComparison[];
  skippedPairs: string[];
  anchorDone: boolean;
  isFinished: boolean;
  adjustments: string[] | null;
  // Number of leading results that came from setup (lock-ins, anchor) rather
  // than head-to-head picks; undo never goes below this.
  seedCount: number;
  finishedAt: number | null;
  draftUpdatedAt: number;
  firestoreSessionId: string | null;
  savedListId: string | null;
  savedListName: string | null;
};

export type LoadedRankerDraft = Omit<StoredRankerDraft, 'skippedPairs'> & {
  skippedPairs: Set<string>;
};

export type RankerDraftPatch = Partial<
  Omit<StoredRankerDraft, 'skippedPairs'>
> & {
  skippedPairs?: SkippedPairsInput;
};

type CreateInitialDraftParams = {
  playerPoolIds: string[];
  name?: string | null;
};

// This tab's draft (sessionStorage), plus a copy in localStorage so a
// ranking survives closing the tab or browser. While a tab is open its own
// copy wins, so two tabs ranking at once don't swap drafts on refresh; a new
// tab picks up the most recently saved ranking.
const STORAGE_KEY = 'ranker_draft_v1';
const RECOVERY_KEY = 'ranker_draft_recovery_v1';
const DEBOUNCE_MS = 800;

const readStoredDraft = (): StoredRankerDraft | null => {
  for (const read of [
    () => sessionStorage.getItem(STORAGE_KEY),
    () => localStorage.getItem(RECOVERY_KEY),
  ]) {
    try {
      const draft = parseStoredDraft(read());
      if (draft) return draft;
    } catch {
      // Unavailable storage or an unreadable copy: try the next one
    }
  }
  return null;
};

const writeStoredDraft = (draft: StoredRankerDraft): void => {
  const value = JSON.stringify(draft);
  try {
    sessionStorage.setItem(STORAGE_KEY, value);
  } catch (err) {
    console.warn('[rankerLocalDraft] Failed to save draft:', err);
  }
  try {
    localStorage.setItem(RECOVERY_KEY, value);
  } catch {
    // The copy that outlives the tab is best-effort (private mode, storage full)
  }
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const normalizeComparisons = (value: unknown): RankerComparison[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isPlainObject(item)) return null;
      if (typeof item.winner !== 'string' || typeof item.loser !== 'string') {
        return null;
      }
      return { winner: item.winner, loser: item.loser };
    })
    .filter((item): item is RankerComparison => item !== null);
};

const normalizeSetupData = (value: unknown): RankerSetupData | null => {
  if (!isPlainObject(value)) return null;
  return { ...value };
};

const normalizeStoredDraft = (value: unknown): StoredRankerDraft | null => {
  if (!isPlainObject(value)) return null;
  if (!isStringArray(value.playerPoolIds) || value.playerPoolIds.length < 2) {
    return null;
  }

  return {
    name: typeof value.name === 'string' ? value.name : null,
    playerPoolIds: value.playerPoolIds,
    setupData: normalizeSetupData(value.setupData),
    results: normalizeComparisons(value.results),
    skippedPairs: serializeSkippedPairs(value.skippedPairs),
    anchorDone: value.anchorDone === true,
    isFinished: value.isFinished === true,
    adjustments: isStringArray(value.adjustments) ? value.adjustments : null,
    seedCount: isFiniteNumber(value.seedCount) ? value.seedCount : 0,
    finishedAt: isFiniteNumber(value.finishedAt) ? value.finishedAt : null,
    draftUpdatedAt:
      typeof value.draftUpdatedAt === 'number' &&
      Number.isFinite(value.draftUpdatedAt)
        ? value.draftUpdatedAt
        : Date.now(),
    firestoreSessionId:
      typeof value.firestoreSessionId === 'string'
        ? value.firestoreSessionId
        : null,
    savedListId:
      typeof value.savedListId === 'string' ? value.savedListId : null,
    savedListName:
      typeof value.savedListName === 'string' ? value.savedListName : null,
  };
};

const parseStoredDraft = (raw: string | null): StoredRankerDraft | null => {
  if (!raw) return null;
  return normalizeStoredDraft(JSON.parse(raw));
};

// A patch field left `undefined` keeps the stored value; an explicit `null`
// clears it.
const pick = <T>(patchValue: T | undefined, existingValue: T | undefined, fallback: T): T =>
  patchValue !== undefined ? patchValue : existingValue ?? fallback;

const mergeDraftPatch = (
  existing: StoredRankerDraft | null,
  draftData: RankerDraftPatch
): StoredRankerDraft => ({
  name: pick(draftData.name, existing?.name, null),
  playerPoolIds: pick(draftData.playerPoolIds, existing?.playerPoolIds, []),
  setupData: pick(draftData.setupData, existing?.setupData, null),
  results: pick(draftData.results, existing?.results, []),
  skippedPairs: serializeSkippedPairs(
    draftData.skippedPairs !== undefined
      ? draftData.skippedPairs
      : existing?.skippedPairs
  ),
  anchorDone: pick(draftData.anchorDone, existing?.anchorDone, false),
  isFinished: pick(draftData.isFinished, existing?.isFinished, false),
  adjustments: pick(draftData.adjustments, existing?.adjustments, null),
  seedCount: pick(draftData.seedCount, existing?.seedCount, 0),
  finishedAt: pick(draftData.finishedAt, existing?.finishedAt, null),
  draftUpdatedAt: Date.now(),
  firestoreSessionId: pick(
    draftData.firestoreSessionId,
    existing?.firestoreSessionId,
    null
  ),
  savedListId: pick(draftData.savedListId, existing?.savedListId, null),
  savedListName: pick(draftData.savedListName, existing?.savedListName, null),
});

const toLoadedDraft = (draft: StoredRankerDraft): LoadedRankerDraft => ({
  ...draft,
  skippedPairs: deserializeSkippedPairs(draft.skippedPairs),
});

const serializeSkippedPairs = (skippedPairs: unknown): string[] => {
  if (!skippedPairs) return [];
  if (skippedPairs instanceof Set) return Array.from(skippedPairs);
  if (Array.isArray(skippedPairs)) {
    return skippedPairs.filter((item): item is string => typeof item === 'string');
  }
  return [];
};

const deserializeSkippedPairs = (
  arr: string[] | null | undefined
): Set<string> => {
  if (!Array.isArray(arr)) return new Set();
  return new Set(arr.filter((item) => typeof item === 'string'));
};

/**
 * Load this tab's draft, or the last ranking saved in this browser.
 */
export const loadLocalDraft = (): LoadedRankerDraft | null => {
  const draft = readStoredDraft();
  return draft ? toLoadedDraft(draft) : null;
};

/**
 * Replace the stored draft outright (used when a new session starts, so
 * nothing from a previous session can leak into it).
 */
export const replaceLocalDraft = (draft: RankerDraftPatch): void => {
  cancelPendingDraftSave();
  writeStoredDraft(mergeDraftPatch(null, draft));
};

/**
 * Save draft to sessionStorage immediately, without debounce.
 */
export const saveLocalDraftImmediate = (draftData: RankerDraftPatch): void => {
  // Write any older debounced save first so it can't land later and
  // overwrite this newer state
  if (pendingDraft) flushPendingDraftSave();
  writeStoredDraft(mergeDraftPatch(readStoredDraft(), draftData));
};

export const clearLocalDraft = (): void => {
  cancelPendingDraftSave();
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[rankerLocalDraft] Failed to clear draft:', err);
  }
  try {
    localStorage.removeItem(RECOVERY_KEY);
  } catch {
    // Nothing kept outside the tab
  }
};

export const hasLocalDraft = (): boolean => readStoredDraft() !== null;

let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingDraft: RankerDraftPatch | null = null;

export const saveLocalDraftDebounced = (draftData: RankerDraftPatch): void => {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }
  pendingDraft = draftData;
  debounceTimeout = setTimeout(() => {
    debounceTimeout = null;
    flushPendingDraftSave();
  }, DEBOUNCE_MS);
};

/**
 * Write any debounced save right now (e.g. before the page is hidden).
 */
export const flushPendingDraftSave = (): void => {
  const draft = pendingDraft;
  cancelPendingDraftSave();
  if (draft) saveLocalDraftImmediate(draft);
};

/**
 * Drop any debounced save without writing it.
 */
export const cancelPendingDraftSave = (): void => {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
    debounceTimeout = null;
  }
  pendingDraft = null;
};

export const createInitialDraft = ({
  playerPoolIds,
  name = null,
}: CreateInitialDraftParams): StoredRankerDraft => {
  return {
    name: name || `Ranking ${new Date().toISOString().slice(0, 10)}`,
    playerPoolIds,
    setupData: null,
    results: [],
    skippedPairs: [],
    anchorDone: false,
    isFinished: false,
    adjustments: null,
    seedCount: 0,
    finishedAt: null,
    draftUpdatedAt: Date.now(),
    firestoreSessionId: null,
    savedListId: null,
    savedListName: null,
  };
};

export const __testing = {
  serializeSkippedPairs,
  deserializeSkippedPairs,
  STORAGE_KEY,
  RECOVERY_KEY,
  DEBOUNCE_MS,
};

