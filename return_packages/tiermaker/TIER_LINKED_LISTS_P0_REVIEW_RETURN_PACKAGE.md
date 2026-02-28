# TIER_LINKED_LISTS_P0 — Review Return Package

**Date:** 2026-02-28  
**Mode:** REVIEW / AUDIT (Discovery-first, read-only)  
**Scope:** Tiermaker + Tieramid only (no Architect)

---

## 1) Feature Map + Entry Points

### Route Definition

| Route                      | File                                                       | Purpose                         |
| -------------------------- | ---------------------------------------------------------- | ------------------------------- |
| `/tier-maker/:tierListId?` | [src/App.jsx](src/App.jsx#L32)                             | Main route, optional tierListId |
| TierMakerView              | [src/pages/TierMakerView.jsx](src/pages/TierMakerView.jsx) | Page component, renders board   |

### Core Component Map

| File                                                                      | Purpose                                           | Read/Write Surface                        |
| ------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------- |
| [TierMakerView.jsx](src/pages/TierMakerView.jsx)                          | Page-level orchestration, mode toggle, draft hook | Reads draft from hook, passes to boards   |
| [TierMakerBoard.jsx](src/features/tierMaker/TierMakerBoard.jsx)           | Standard tier layout UI                           | Reads/writes `tierLists` via listHelpers  |
| [TieramidBoard.jsx](src/features/tierMaker/TieramidBoard.jsx)             | Pyramid layout UI                                 | Reads/writes `tierLists` via listHelpers  |
| [TierRow.jsx](src/features/tierMaker/TierRow.jsx)                         | Individual tier row rendering                     | Read-only (receives data from board)      |
| [TieramidPlayerTile.jsx](src/features/tierMaker/TieramidPlayerTile.jsx)   | Player tile for pyramid                           | Read-only (receives data from board)      |
| [CreateTierListModal.jsx](src/features/tierMaker/CreateTierListModal.jsx) | New tier list creation dialog                     | Writes `tierLists` via `createTierList()` |

### Hooks

| File                                                            | Purpose                               | Storage Target                             |
| --------------------------------------------------------------- | ------------------------------------- | ------------------------------------------ |
| [useTierDraft.ts](src/features/tierMaker/hooks/useTierDraft.ts) | sessionStorage persistence for drafts | `sessionStorage` key: `tiermaker_draft_v1` |

### Utility Files

| File                                                                  | Purpose                               |
| --------------------------------------------------------------------- | ------------------------------------- |
| [draftConversion.ts](src/features/tierMaker/utils/draftConversion.ts) | Standard ↔ Tieramid draft conversion |

### Firebase Helpers (External Dependencies)

| File                                          | Functions Used                                    | Collection  |
| --------------------------------------------- | ------------------------------------------------- | ----------- |
| [listHelpers.js](src/firebase/listHelpers.js) | `fetchTierList`, `saveTierList`, `createTierList` | `tierLists` |

---

## 2) Persistence Policy Audit

### Required Policy (Target State)

| User Type  | Local Storage Autosave  | Firestore Save   | UI Save Button |
| ---------- | ----------------------- | ---------------- | -------------- |
| All users  | ✅ Yes (sessionStorage) | ❌ Never auto    | ❌ Hidden      |
| Owner only | ✅ Yes (sessionStorage) | ✅ Explicit only | ✅ Visible     |

### Current State Evidence

#### ✅ Local Persistence (sessionStorage) — COMPLIANT

**Location:** [src/features/tierMaker/hooks/useTierDraft.ts](src/features/tierMaker/hooks/useTierDraft.ts)

| Property           | Current Value            | Evidence (Line #)                                                                  |
| ------------------ | ------------------------ | ---------------------------------------------------------------------------------- |
| Storage key        | `tiermaker_draft_v1`     | [L46](src/features/tierMaker/hooks/useTierDraft.ts#L46)                            |
| Debounce           | 1000ms                   | [L47](src/features/tierMaker/hooks/useTierDraft.ts#L47)                            |
| Overwrite behavior | Most recent only         | Envelope pattern at [L28-32](src/features/tierMaker/hooks/useTierDraft.ts#L28-L32) |
| Resume on refresh  | Yes (via restore effect) | [L63-82](src/features/tierMaker/hooks/useTierDraft.ts#L63-L82)                     |

**Draft mode detection:** Triggered when URL has no `tierListId` param. Line reference: [TierMakerView.jsx#L19](src/pages/TierMakerView.jsx#L19)

#### ⚠️ Firestore Saves — PARTIALLY COMPLIANT

**Evidence of explicit save (not auto):**

- Save is triggered only by button click: [TierMakerBoard.jsx#L653](src/features/tierMaker/TierMakerBoard.jsx#L653), [TieramidBoard.jsx#L941](src/features/tierMaker/TieramidBoard.jsx#L941)
- No `useEffect` with auto-save to Firestore found
- Comment confirms: "Firestore auto-load: only in saved mode (not draft mode)" — [TierMakerBoard.jsx#L470](src/features/tierMaker/TierMakerBoard.jsx#L470)

**Evidence of ownership guard in backend:**

- `saveTierList()` uses `readAndGuard()` which asserts ownership — [listHelpers.js#L343-L350](src/firebase/listHelpers.js#L343-L350)
- `createTierList()` requires `userId` — [listHelpers.js#L260-L263](src/firebase/listHelpers.js#L260-L263)

#### ❌ UI Ownership Gating — **NOT COMPLIANT**

**Critical Gap:** Save button is ALWAYS visible, regardless of ownership.

| Location                                                                            | Save Button Code                                | isOwner Check |
| ----------------------------------------------------------------------------------- | ----------------------------------------------- | ------------- |
| [TierMakerBoard.jsx#L649-L656](src/features/tierMaker/TierMakerBoard.jsx#L649-L656) | `<button onClick={() => handleSaveTierList()}>` | ❌ None       |
| [TieramidBoard.jsx#L940-L946](src/features/tierMaker/TieramidBoard.jsx#L940-L946)   | `<button onClick={() => handleSaveTierList()}>` | ❌ None       |

**Comparison to Ranker (gold standard):**

- Ranker uses `{isOwner && ...}` pattern for save buttons — [RankingSession.jsx#L264](src/features/ranker/RankingSession.jsx#L264), [RankingResults.jsx#L222](src/features/ranker/RankingResults.jsx#L222)
- TierMaker does NOT implement this pattern

### Current State vs Required Policy Summary

| Aspect                  | Current State                   | Required State          | Verdict |
| ----------------------- | ------------------------------- | ----------------------- | ------- |
| sessionStorage autosave | ✅ All users, debounced 1s      | ✅ All users, debounced | ✅ PASS |
| Single draft overwrite  | ✅ Most recent only             | ✅ Most recent only     | ✅ PASS |
| Resume on refresh       | ✅ Restores from sessionStorage | ✅ Restores             | ✅ PASS |
| Firestore auto-save     | ✅ None (explicit only)         | ❌ Never auto           | ✅ PASS |
| Save button owner-gated | ❌ Always visible               | ✅ Owner-only           | ❌ FAIL |
| Backend ownership guard | ✅ `readAndGuard()` on save     | ✅ Server-side check    | ✅ PASS |

---

## 3) Data Model Contracts (Draft Schemas)

### Draft Envelope (sessionStorage)

**Location:** [useTierDraft.ts#L28-L32](src/features/tierMaker/hooks/useTierDraft.ts#L28-L32)

```typescript
interface DraftEnvelope {
  draftStandard: DraftStandard | null;
  draftTieramid: DraftTieramid | null;
  draftUpdatedAt: number | null;
}
```

### DraftStandard (Tiermaker)

**Location:** [useTierDraft.ts#L14-L17](src/features/tierMaker/hooks/useTierDraft.ts#L14-L17)

```typescript
interface DraftStandard {
  tiers: Record<string, string[]>; // tier name → player IDs
  tierOrder: string[]; // ordered list of tier names (Pool always last)
}
```

**Example:**

```json
{
  "tiers": {
    "S": ["player_1", "player_2"],
    "A": ["player_3"],
    "B": [],
    "Pool": ["player_4", "player_5"]
  },
  "tierOrder": ["S", "A", "B", "C", "D", "Pool"]
}
```

### DraftTieramid (Pyramid)

**Location:** [useTierDraft.ts#L19-L22](src/features/tierMaker/hooks/useTierDraft.ts#L19-L22)

```typescript
interface DraftTieramid {
  rows: Record<string, string[]>; // row name → player IDs
  rowOrder: string[]; // ordered list of row names (Pool always last)
}
```

**Example:**

```json
{
  "rows": {
    "Row1": ["player_1"],
    "Row2": ["player_2", "player_3"],
    "Row3": [],
    "Pool": ["player_4", "player_5"]
  },
  "rowOrder": ["Row1", "Row2", "Row3", "Row4", "Row5", "Pool"]
}
```

### Firestore Schema (tierLists collection)

**Write location:** [listHelpers.js#L287-L296](src/firebase/listHelpers.js#L287-L296)

```typescript
interface TierListDoc {
  name: string;
  tiers: Record<string, string[]>; // tier/row name → player IDs
  tierOrder: string[]; // ordered names
  mode: 'standard' | 'pyramid'; // added at creation
  ownerUid: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Canonical Pool Order Representation

**Answer:** Order is preserved in the array itself.

- `tiers["Pool"]` or `rows["Pool"]` is a `string[]` — array order IS the player order.
- No separate `poolOrder` field exists.

### sourceListId Metadata

**Answer:** Does NOT currently exist.

- Neither `DraftEnvelope`, `DraftStandard`, `DraftTieramid`, nor `TierListDoc` has a `sourceListId` field.
- **Proposed:** Add optional `sourceListId?: string` to the envelope for P1 implementation.

---

## 4) Lists Integration Audit

### Existing "Add List" Capability

| Board          | Has UI Control? | Function          | Location                                                                            |
| -------------- | --------------- | ----------------- | ----------------------------------------------------------------------------------- |
| TierMakerBoard | ✅ Yes          | `handleAddList()` | [TierMakerBoard.jsx#L384-L392](src/features/tierMaker/TierMakerBoard.jsx#L384-L392) |
| TieramidBoard  | ✅ Yes          | `handleAddList()` | [TieramidBoard.jsx#L434-L441](src/features/tierMaker/TieramidBoard.jsx#L434-L441)   |

### Order Preservation Analysis

#### TierMakerBoard — ❌ DOES NOT preserve order

```javascript
// TierMakerBoard.jsx L388-389
const listPlayers = list.playerIds.map((id) => playersMap[id]).filter(Boolean);
```

**Issue:** Uses `list.playerIds` only — ignores `playerOrder` field entirely.

#### TieramidBoard — ✅ DOES preserve order

```javascript
// TieramidBoard.jsx L437-438
const listPlayers = (
  list.playerOrder.length ? list.playerOrder : list.playerIds
)
  .map((id) => playersMap[id])
  .filter(Boolean);
```

**Behavior:** Prefers `playerOrder` when available, falls back to `playerIds`.

### List Schema for Reference

**Location:** [listHelpers.js#L93-L95](src/firebase/listHelpers.js#L93-L95)

```typescript
interface ListDoc {
  name: string;
  playerIds: string[]; // unordered set of player IDs
  playerOrder: string[]; // ranked order (primary source of truth for order)
  playerNotes: Record<string, string>;
  ownerUid: string;
  // ...timestamps
}
```

### Lists Integration Summary

| Capability                  | TierMakerBoard | TieramidBoard |
| --------------------------- | -------------- | ------------- |
| UI to select list           | ✅ Yes         | ✅ Yes        |
| Adds players to pool        | ✅ Yes         | ✅ Yes        |
| Uses `playerOrder` for sort | ❌ No          | ✅ Yes        |
| Uses `playerIds` fallback   | ✅ (only this) | ✅ Yes        |

### Gap for P1

**TierMakerBoard must be updated** to use `playerOrder` preferentially, matching TieramidBoard pattern.

---

## 5) Risk Register

### R1: Save Button Visible to Non-Owners (CRITICAL)

- **Impact:** Non-owners see Save button, click it, get error from backend guard.
- **Current behavior:** Error toast shown after failed write attempt.
- **Required behavior:** Button should be hidden for non-owners (match Ranker pattern).
- **Severity:** HIGH — poor UX, confusing error experience.
- **Fix complexity:** LOW — add `isOwner` gating pattern.

### R2: TierMakerBoard Ignores playerOrder (HIGH)

- **Impact:** When seeding from a ranked list, order is lost in TierMaker (standard mode).
- **Current behavior:** Uses `playerIds` (unordered) instead of `playerOrder`.
- **Required behavior:** Prefer `playerOrder` when available.
- **Severity:** HIGH — defeats purpose of "seed from ranked list".
- **Fix complexity:** LOW — 2-line change, copy TieramidBoard pattern.

### R3: No sourceListId Tracking (LOW)

- **Impact:** Cannot trace where pool players came from.
- **Current behavior:** No metadata linking draft to source list.
- **Proposed:** Add optional `sourceListId` to envelope.
- **Severity:** LOW — nice-to-have for debugging/UX.
- **Fix complexity:** LOW — add field to envelope, pass through on import.

### R4: Draft Schema Migration Risk (LOW)

- **Impact:** If draft shape changes, old drafts may fail to restore.
- **Current behavior:** Basic validation on restore (checks array exists).
- **Mitigation:** Version key is `tiermaker_draft_v1` — can bump to `v2` if shape changes.
- **Severity:** LOW — sessionStorage is ephemeral anyway.
- **Fix complexity:** N/A — existing versioning strategy is adequate.

### R5: Storage Key Collision Risk (NONE)

- **Evidence:** Verified unique keys:
  - Tiermaker: `tiermaker_draft_v1` — [useTierDraft.ts#L46](src/features/tierMaker/hooks/useTierDraft.ts#L46)
  - Ranker: `ranker_draft_v1` — [rankerLocalDraft.js#L17](src/features/ranker/utils/rankerLocalDraft.js#L17)
- **Severity:** NONE — no conflict exists.

---

## 6) STOP Condition Checks

### ❌ Tiermaker writes to Firestore automatically for all users?

**PASS** — No auto-writes. All Firestore writes are explicit button clicks with backend ownership guards.

### ❌ Tiermaker writes to read-only base collections?

**PASS** — Only writes to `tierLists` collection (user content). No writes to `players_v2`, `architect_base*`, or any source data collections.

### ❌ Draft persistence keys conflict with other features?

**PASS** — Unique key `tiermaker_draft_v1` has no collisions.

---

## 7) Review Verdict

### ✅ Ship-Ready for Persistence Policy?

**NO — Needs Alignment**

| Requirement                    | Status  | Blocker? |
| ------------------------------ | ------- | -------- |
| sessionStorage draft autosave  | ✅ PASS | No       |
| Explicit Firestore saves only  | ✅ PASS | No       |
| Backend ownership guard        | ✅ PASS | No       |
| UI ownership gating (Save btn) | ❌ FAIL | **YES**  |

### ✅ Ready for Ordered Seed from Lists?

**PARTIALLY — Needs Fix in TierMakerBoard**

| Requirement                     | Status  | Blocker? |
| ------------------------------- | ------- | -------- |
| UI control to select list       | ✅ PASS | No       |
| TieramidBoard uses playerOrder  | ✅ PASS | No       |
| TierMakerBoard uses playerOrder | ❌ FAIL | **YES**  |

---

## 8) P1 Execution Scope

### Must Fix (Blocking)

1. **Add `isOwner` gating to Save buttons**
   - Files: `TierMakerBoard.jsx`, `TieramidBoard.jsx`
   - Pattern: Match `RankingSession.jsx` — `{isOwner && ...}`
   - Requires: Fetch `ownershipValid` from `fetchTierList()` response

1. **Fix TierMakerBoard list import to use playerOrder**
   - File: `TierMakerBoard.jsx`
   - Change: `list.playerIds` → `list.playerOrder.length ? list.playerOrder : list.playerIds`
   - Location: [TierMakerBoard.jsx#L388-L389](src/features/tierMaker/TierMakerBoard.jsx#L388-L389)

### Should Fix (Recommended)

1. **Add `sourceListId` to draft envelope** (optional tracking)
   - File: `useTierDraft.ts`
   - Add field to `DraftEnvelope` interface
   - Pass through from import flow

### Won't Fix (Out of Scope)

- No UI makeover
- No Architect integration
- No Tiermaker → List export (reverse flow)

---

## Validation Commands Run

| Command             | Result                    |
| ------------------- | ------------------------- |
| File reads & grep   | ✅ All evidence gathered  |
| `npm run build`     | Not run (read-only audit) |
| `npm run test:diff` | Not run (no code changes) |

---

## Files Examined

| File                                              | Lines Read | Purpose                     |
| ------------------------------------------------- | ---------- | --------------------------- |
| `src/pages/TierMakerView.jsx`                     | 1-192      | Page component              |
| `src/features/tierMaker/TierMakerBoard.jsx`       | 1-683      | Standard board              |
| `src/features/tierMaker/TieramidBoard.jsx`        | 1-1058     | Pyramid board               |
| `src/features/tierMaker/hooks/useTierDraft.ts`    | 1-137      | Draft persistence hook      |
| `src/features/tierMaker/utils/draftConversion.ts` | 1-150      | Conversion utilities        |
| `src/features/tierMaker/CreateTierListModal.jsx`  | 1-56       | Create dialog               |
| `src/firebase/listHelpers.js`                     | 250-400    | Firestore helpers           |
| `src/features/ranker/RankingSession.jsx`          | 250-290    | isOwner pattern reference   |
| `src/features/ranker/RankingResults.jsx`          | 175-240    | isOwner pattern reference   |
| `src/features/ranker/utils/rankerLocalDraft.js`   | 1-100      | Ranker draft for comparison |
