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
  [key: string]: unknown;
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

const STORAGE_KEY = 'ranker_draft_v1';
const DEBOUNCE_MS = 800;

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
 * Load draft from sessionStorage.
 */
export const loadLocalDraft = (): LoadedRankerDraft | null => {
  try {
    const draft = parseStoredDraft(sessionStorage.getItem(STORAGE_KEY));
    return draft ? toLoadedDraft(draft) : null;
  } catch (err) {
    console.warn('[rankerLocalDraft] Failed to load draft:', err);
    return null;
  }
};

/**
 * Replace the stored draft outright (used when a new session starts, so
 * nothing from a previous session can leak into it).
 */
export const replaceLocalDraft = (draft: RankerDraftPatch): void => {
  cancelPendingDraftSave();
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(mergeDraftPatch(null, draft))
    );
  } catch (err) {
    console.warn('[rankerLocalDraft] Failed to save draft:', err);
  }
};

/**
 * Save draft to sessionStorage immediately, without debounce.
 */
export const saveLocalDraftImmediate = (draftData: RankerDraftPatch): void => {
  // Write any older debounced save first so it can't land later and
  // overwrite this newer state
  if (pendingDraft) flushPendingDraftSave();
  try {
    const existing = loadLocalDraftRaw();
    const merged = mergeDraftPatch(existing, draftData);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (err) {
    console.warn('[rankerLocalDraft] Failed to save draft:', err);
  }
};

const loadLocalDraftRaw = (): StoredRankerDraft | null => {
  try {
    return parseStoredDraft(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
};

export const clearLocalDraft = (): void => {
  cancelPendingDraftSave();
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[rankerLocalDraft] Failed to clear draft:', err);
  }
};

export const hasLocalDraft = (): boolean => {
  try {
    return parseStoredDraft(sessionStorage.getItem(STORAGE_KEY)) !== null;
  } catch {
    return false;
  }
};

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
  DEBOUNCE_MS,
};

