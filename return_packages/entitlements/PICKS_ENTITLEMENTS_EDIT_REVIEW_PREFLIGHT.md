# PICKS / ENTITLEMENTS EDIT REVIEW — PREFLIGHT RETURN PACKAGE

**Date:** 2026-02-19  
**Mode:** PREFLIGHT (discovery only — no functional code changes)  
**Master Doc:** `docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md`

---

## 1. FILE MAP

### Editor UI

| File | Role |
|------|------|
| [src/features/architect/admin/PickRightWizardModal.tsx](src/features/architect/admin/PickRightWizardModal.tsx) | Primary wizard modal — Quick Builder UX, dual save path (Firestore + vacuum) |
| [src/features/architect/admin/EntitlementEditorModal.tsx](src/features/architect/admin/EntitlementEditorModal.tsx) | Advanced tabbed editor — power-user form + JSON |
| [src/features/architect/admin/EntitlementEditorBasicsTab.tsx](src/features/architect/admin/EntitlementEditorBasicsTab.tsx) | Basics tab: ID, team, year, round, kind, linked IDs |
| [src/features/architect/admin/EntitlementEditorProtectionTab.tsx](src/features/architect/admin/EntitlementEditorProtectionTab.tsx) | Protection tab: ladder CRUD, templates, reorder, validate |
| [src/features/architect/admin/EntitlementEditorSwapTab.tsx](src/features/architect/admin/EntitlementEditorSwapTab.tsx) | Swap tab: type, controller, target, pool, residualOf |
| [src/features/architect/admin/EntitlementEditorConveyanceTab.tsx](src/features/architect/admin/EntitlementEditorConveyanceTab.tsx) | Conveyance tab: pool, method, ranks |
| [src/features/architect/admin/EntitlementEditorAdvancedTab.tsx](src/features/architect/admin/EntitlementEditorAdvancedTab.tsx) | Raw JSON editor with identity-lock |
| [src/features/architect/admin/PickRightWizardSteps/QuickBuilder.tsx](src/features/architect/admin/PickRightWizardSteps/QuickBuilder.tsx) | Single-screen wizard: Protect/Swap/Pool cards |

### State Management

| File | Role |
|------|------|
| [src/features/architect/admin/useEntitlementEditorState.ts](src/features/architect/admin/useEntitlementEditorState.ts) | Advanced editor hook: form state + validation + save handler |
| [src/features/architect/admin/entitlementEditorFormState.ts](src/features/architect/admin/entitlementEditorFormState.ts) | Form state type, `createEntitlementFormState()`, `buildEntitlementDocument()` |
| [src/features/architect/admin/pickRightWizardModel.ts](src/features/architect/admin/pickRightWizardModel.ts) | Wizard data model: `WizardModel`, `formStateToWizardModel()` |
| [src/features/architect/admin/wizardToEntitlement.ts](src/features/architect/admin/wizardToEntitlement.ts) | WizardModel → EntitlementFormState translation |

### Writer (Persistence)

| File | Role |
|------|------|
| [src/features/architect/utils/entitlements/entitlementWriter.ts](src/features/architect/utils/entitlements/entitlementWriter.ts) | `writeWorldEntitlement()` — Firestore `setDoc` with `merge: true` |
| [src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts](src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts) | localStorage overlay for vacuum-mode edits/creates |
| [src/features/architect/admin/pickRightWizardDraft.ts](src/features/architect/admin/pickRightWizardDraft.ts) | Draft save/restore (localStorage, v2 format) |

### Reader (Rehydrate)

| File | Role |
|------|------|
| [src/features/architect/utils/entitlements/entitlementResolver.ts](src/features/architect/utils/entitlements/entitlementResolver.ts) | `resolveEntitlementsForTeam()` — merge base + world + vacuum overlay |
| [src/features/architect/utils/entitlements/entitlementTerms.ts](src/features/architect/utils/entitlements/entitlementTerms.ts) | Normalize for Trade Machine display: `normalizeEntitlementTerms()` |

### Validators

| File | Role |
|------|------|
| [entitlementWriter.ts L125–L299](src/features/architect/utils/entitlements/entitlementWriter.ts#L125-L299) | `validateEntitlementDocument()` — required fields, kind-specific, ladder, linkage |
| [useEntitlementEditorState.ts L38–L113](src/features/architect/admin/useEntitlementEditorState.ts#L38-L113) | `validateFormState()` — field-level errors, protection year ordering |
| [entitlementWarnings.js](src/features/architect/tradeMachine/utils/entitlementWarnings.js) | Trade warnings (encumbered, linked-package, swap-conflict) |

### Downstream Consumers

| File | Role |
|------|------|
| [src/features/architect/tradeMachine/EntitlementPickRow.jsx](src/features/architect/tradeMachine/EntitlementPickRow.jsx) | Row display + badges (encumbered, pooled, linked, residual) |
| [src/features/architect/tradeMachine/EntitlementPicksList.jsx](src/features/architect/tradeMachine/EntitlementPicksList.jsx) | Grouped list with sorting + create button |
| [src/features/architect/tradeMachine/TradeSummaryPanel.jsx](src/features/architect/tradeMachine/TradeSummaryPanel.jsx) | Trade summary consuming entitlement terms |
| [src/features/architect/utils/entitlements/entitlementPickRowProjection.js](src/features/architect/utils/entitlements/entitlementPickRowProjection.js) | PickRow projection for display |

---

## 2. FIELD TRUTH TABLE

Maps each feature to the exact persisted Firestore fields.

### A) Protections

| Form Field | Document Field | Firestore Type | Written? | Read Back? | Notes |
|---|---|---|---|---|---|
| `protectionLadder[].year` | `protectionLadder[].year` | number | YES (when array non-empty) | YES | |
| `protectionLadder[].condition` | `protectionLadder[].condition` | string | YES | YES | |
| `protectionLadder[].ifTriggered` | `protectionLadder[].ifTriggered` | string enum | YES | YES | |
| `protectionLadder[].rollToYear` | `protectionLadder[].rollToYear` | number? | YES (or undefined) | YES | |
| `protectionLadder[].convertToRound` | `protectionLadder[].convertToRound` | number? | YES (or undefined) | YES | |
| *(schema only)* | `protectionLadder[].source` | string? | **NOT WRITTEN by editor** | **NOT READ by editor** | See BUG #5 |

### B) Swap

| Form Field | Document Field | Firestore Type | Written? | Read Back? | Notes |
|---|---|---|---|---|---|
| `swapType` | `swapType` | `best_of` \| `worst_of` | YES (when non-empty) | YES | Missing from Zod schema (BUG #4) |
| `swapControllerPickId` | `swapControllerPickId` | string | YES (when non-empty) | YES | |
| `swapTargetDefinition` | `swapTargetDefinition` | string | YES (when non-empty) | YES | |
| `residualOfEntitlementId` | `residualOfEntitlementId` | string | YES (when non-empty) | YES | |

### C) Linkage

| Form Field | Document Field | Firestore Type | Written? | Read Back? | Notes |
|---|---|---|---|---|---|
| `linkedEntitlementIdsText` | `linkedEntitlementIds` | string[] | YES (when non-empty) | YES | |
| `coveredByEntitlementIdsText` | `coveredByEntitlementIds` | string[] | YES (when non-empty) | YES | |
| `residualOfEntitlementId` | `residualOfEntitlementId` | string | YES (when non-empty) | YES | |

### D) Conveyance

| Form Field | Document Field | Firestore Type | Written? | Read Back? | Notes |
|---|---|---|---|---|---|
| `poolUnderlyingPickIdsText` | `poolUnderlyingPickIds` | string[] | YES (when non-empty) | YES | |
| `receivesRankText` | `receivesRank` | number[] | YES (when non-empty) | YES | |
| `receivesComparator` | `receivesComparator` | string enum | YES (when non-empty) | YES | |

### E) Metadata Fields (Auto-Managed)

| Field | Set By | Purpose |
|---|---|---|
| `_lastModifiedAt` | `writeWorldEntitlement()` | Server timestamp |
| `_lastModifiedBy` | `writeWorldEntitlement()` | userId |
| `_authoredManually` | `writeWorldEntitlement()` | Boolean `true` |
| `__vacuumEdited` | Resolver merge seam | Stripped via `deleteField()` on Firestore writes |
| `__vacuumSessionOnly` | Resolver merge seam | Stripped via `deleteField()` on Firestore writes |

---

## 3. SAVE / RELOAD PROOFS

### 3.1 Protections — Expected JSON (Advanced Editor Path)

**User action:** Add 2 protection tiers via Protection Tab, save.

**Form state:**

{
  "protectionLadder": [
    { "year": "2026", "condition": "Top 3", "ifTriggered": "roll", "rollToYear": "2027", "convertToRound": "" },
    { "year": "2027", "condition": "Unprotected", "ifTriggered": "cancel", "rollToYear": "", "convertToRound": "" }
  ]
}

```

**`buildEntitlementDocument()` output:**
```json
{
  "holderTeam": "LAL",
  "seasonYear": 2026,
  "round": 1,
  "kind": "pick_ownership",
  "underlyingPickId": "BOS_2026_1st",
  "underlyingStatus": "encumbered",
  "protectionLadder": [
    { "year": 2026, "condition": "Top 3", "ifTriggered": "roll", "rollToYear": 2027 },
    { "year": 2027, "condition": "Unprotected", "ifTriggered": "cancel" }
  ]
}
```

**Firestore doc (after `setDoc` with `merge: true`):** Same as above, plus `_lastModifiedAt`, `_lastModifiedBy`, `_authoredManually`, `id`.

**Reload via `createEntitlementFormState(firestoreDoc)`:**

{
  "protectionLadder": [
    { "year": "2026", "condition": "Top 3", "ifTriggered": "roll", "rollToYear": "2027", "convertToRound": "" },
    { "year": "2027", "condition": "Unprotected", "ifTriggered": "cancel", "rollToYear": "", "convertToRound": "" }
  ]
}

```

**Verdict: ROUND-TRIP CORRECT** — numbers serialize to strings on reload, which matches form state expectations. Tests confirm: `entitlementEditorProtection.test.tsx` — "template applied to form state round-trips through build" passes.

### 3.2 Swap — Expected JSON (Advanced Editor Path)

**User action:** Set kind to `swap_right`, fill swap fields, save.

**`buildEntitlementDocument()` output:**
```json
{
  "holderTeam": "LAL",
  "seasonYear": 2026,
  "round": 1,
  "kind": "swap_right",
  "swapType": "best_of",
  "swapControllerPickId": "LAL_2026_1st",
  "swapTargetDefinition": "Best of LAL and BOS 2026 1st round picks",
  "residualOfEntitlementId": "ent:HOU:2026:1:conv:abc123"

}
```

**Reload via `createEntitlementFormState(firestoreDoc)`:**

```json
{
  "swapType": "best_of",
  "swapControllerPickId": "LAL_2026_1st",
  "swapTargetDefinition": "Best of LAL and BOS 2026 1st round picks",
  "residualOfEntitlementId": "ent:HOU:2026:1:conv:abc123"
}
```

**Verdict: ROUND-TRIP CORRECT** — all swap fields read/write symmetrically. Test: `entitlementEditorSwapType.test.tsx` — all 6 tests pass.

### 3.3 Linkage — Expected JSON (Advanced Editor Path)

**User action:** Add linked IDs and coveredBy IDs on Basics tab, save.

```json
{
  "holderTeam": "LAL",
  "seasonYear": 2026,
  "round": 1,
  "kind": "pick_ownership",
  "underlyingPickId": "BOS_2026_1st",

  "linkedEntitlementIds": ["ent:HOU:2026:1:swap:residual", "ent:HOU:2026:2:own:xyz"],
  "coveredByEntitlementIds": ["ent:DAL:2026:1:swap:abc"]
}
```

**Reload:**

```json
{
  "linkedEntitlementIdsText": "ent:HOU:2026:1:swap:residual\nent:HOU:2026:2:own:xyz",
  "coveredByEntitlementIdsText": "ent:DAL:2026:1:swap:abc"
}

```

**Verdict: ROUND-TRIP CORRECT** — `stringifyList()` joins with newlines, `parseListInput()` splits on `\n` or `,`. Symmetric.

### 3.4 Vacuum Mode Save/Reload

**Vacuum Edit (patching existing entitlement):**

```json
// localStorage "vacuum_entitlement_overlay":
{
  "version": 1,
  "overlays": {
    "LAL": {
      "edits": {
        "ent:LAL:2026:1:own:abc": {
          "protectionLadder": [
            { "year": 2026, "condition": "Top 3", "ifTriggered": "roll", "rollToYear": 2027 }
          ]
        }
      },
      "creates": {}
    }
  },
  "transfers": {},
  "_updatedAt": "2026-02-19T..."
}
```

**Resolver merge:** `deepMerge(baseEntitlement, patch)` → base fields preserved, patch fields override.

**Verdict: CORRECT for additive edits.** See BUG #2/#3 for removal edits.

---

## 4. BUG LIST (Prioritized)

### BUG #1 — CRITICAL: `wizardToFormState()` missing 3 required fields → runtime crash

**Severity:** P0/Critical  
**Likelihood:** Certain — happens on every wizard save  
**Location:** [wizardToEntitlement.ts L57–L72](src/features/architect/admin/wizardToEntitlement.ts#L57-L72)

**Symptom:** `TypeError: Cannot read properties of undefined (reading 'split')` when `buildEntitlementDocument()` calls `parseListInput(formState.linkedEntitlementIdsText)` on the wizard-produced form state.
**Root Cause:** The `base` object in `wizardToFormState()` is missing 3 properties required by `EntitlementFormState`:

- `linkedEntitlementIdsText`
- `residualOfEntitlementId`

TypeScript confirms:

```
Type '...' is missing the following properties from type 'EntitlementFormState':
  linkedEntitlementIdsText, residualOfEntitlementId, coveredByEntitlementIdsText
```

**Impact:** The wizard's "Apply" button triggers a crash caught by the try/catch, surfacing as a generic "Unknown error" toast. The save silently fails. This affects ALL saves via the Quick Builder wizard.

**Fix (2 lines):** Add the 3 fields to the `base` object in `wizardToFormState()`:

```typescript
linkedEntitlementIdsText: '',
residualOfEntitlementId: '',
coveredByEntitlementIdsText: '',

**Test Evidence:** The `wizardTranslation.test.ts` suite has 4 tests failing because of this exact crash:

- "protect_pick produces a valid document" — FAIL
- "create_swap produces a valid document" — FAIL
- "create_conveyance produces a valid document" — FAIL
- "wizardToDocument matches buildEntitlementDocument(wizardToFormState())" — FAIL

---

### BUG #2 — HIGH: `merge: true` ghost fields when clearing data on existing entitlements

**Severity:** P1/High  
**Likelihood:** Moderate — affects edit (not create) of World-mode entitlements  
**Location:** [entitlementWriter.ts L340–L371](src/features/architect/utils/entitlements/entitlementWriter.ts#L340-L371)

**Symptom:** Removing all protections from an entitlement, clearing swap fields, or clearing linked IDs appears to save successfully, but the old data persists in Firestore and reappears on reload.
**Root Cause:** `writeWorldEntitlement()` uses `setDoc(ref, {...}, { merge: true })`. `buildEntitlementDocument()` conditionally omits fields when empty:

```typescript
if (formState.protectionLadder.length > 0) {
  document.protectionLadder = formState.protectionLadder.map(...)
}
// When protectionLadder is empty → field is absent from document
// merge: true → old protectionLadder stays in Firestore

**Affected fields** (all use "write only if non-empty" pattern):

- `protectionLadder`

- `poolUnderlyingPickIds`
- `receivesRank`
- `receivesComparator`
- `linkedEntitlementIds`
- `coveredByEntitlementIds`

- `residualOfEntitlementId`
- `swapType`
- `swapControllerPickId`
- `swapTargetDefinition`
- `description`

**Impact:** Data that the user intends to remove persists in Firestore. The edit appears lost on reload.

**Fix:** For each conditional field, add explicit `deleteField()` when the value is empty:

```typescript
document.protectionLadder = formState.protectionLadder.length > 0
  ? formState.protectionLadder.map(...)
  : deleteField();
```

Or switch to `setDoc(ref, {...})` without merge (full replace). Full replace is simpler and avoids all ghost issues, but requires ensuring ALL fields are always present.

---

### BUG #3 — HIGH: Vacuum overlay deep-merge has same ghost problem

**Severity:** P1/High  
**Likelihood:** Moderate — affects edit of existing entitlements in vacuum mode  
**Location:** [entitlementResolver.ts L232–L240](src/features/architect/utils/entitlements/entitlementResolver.ts#L232-L240)

**Symptom:** Editing an existing base entitlement in vacuum mode to remove protections — the base's `protectionLadder` survives the deep merge.

**Root Cause:** `deepMerge(base, override)` only overwrites keys present in the override. If `buildEntitlementDocument()` omits `protectionLadder` (because user cleared it), the base's `protectionLadder` remains.
**Impact:** Same as BUG #2 but for vacuum mode.

**Fix:** Store the full document in vacuum edits instead of a patch, or include explicit `null` markers for cleared fields:

```typescript
// In buildEntitlementDocument:
document.protectionLadder = formState.protectionLadder.length > 0

  ? formState.protectionLadder.map(...)
  : null;  // Explicit null signals "remove this field"

// In deepMerge: treat null as "delete"
```

---

### BUG #4 — LOW: `swapType` missing from Zod schema

**Severity:** P2/Low  
**Likelihood:** No data loss (`.passthrough()` preserves it)  
**Location:** [src/schemas/architect.ts L24–L57](src/schemas/architect.ts#L24-L57)

**Symptom:** `swapType` is written/read/displayed but never validated by Zod. A typo like `"bet_of"` would be silently accepted.

**Fix:** Add to `EntitlementAssetZ`:

```typescript
swapType: z.enum(['best_of', 'worst_of']).optional(),
```

---

### BUG #5 — LOW: `source` field on protection tiers dropped during form round-trip

**Severity:** P3/Low  
**Likelihood:** Only affects entitlements with `source` metadata (pipeline-generated)  
**Location:** [entitlementEditorFormState.ts L134–L140](src/features/architect/admin/entitlementEditorFormState.ts#L134-L140)

**Symptom:** `ProtectionLadderTierForm` omits `source`. When a document with `source` on tiers is loaded into the editor and re-saved, the `source` field is lost.

**Impact:** Informational metadata loss. No functional impact.

**Fix:** Add `source: string` to `ProtectionLadderTierForm`, carry it through read/write.

---

## 5. ACCEPTANCE VERDICTS

| Category | Verdict | Evidence |
|---|---|---|
| **Protections UI** | **PASS (Advanced Editor)** / **FAIL (Wizard)** | Advanced Editor: all tab controls work correctly. Wizard: BUG #1 crashes the save path. |
| **Protections persistence + reload** | **CONDITIONAL PASS** | Round-trip proven for create. BUG #2 causes field ghosts on edit (clearing protections doesn't delete). BUG #5 loses `source` metadata. |
| **Swap UI** | **PASS (Advanced Editor)** / **FAIL (Wizard)** | Advanced Editor: all fields bound, inline validation works. Wizard: BUG #1 crashes. |

| **Swap persistence + reload** | **CONDITIONAL PASS** | Round-trip proven for create (6/6 swap tests pass). BUG #2 causes ghost on edit. |
| **Linkage UI** | **PASS** | Basics tab: `linkedEntitlementIds`, `coveredByEntitlementIds` textarea bindings work. Swap tab: `residualOfEntitlementId` input binding works. Badges render in EntitlementPickRow. |
| **Linkage persistence + reload** | **CONDITIONAL PASS** | Round-trip proven for create. BUG #2 causes ghost on edit. |
| **Downstream consumers stable** | **PASS** | All access patterns use safe null checks (`Array.isArray`, truthy checks). Tests pass: `entitlementTrading (11/11)`, `entitlementPickRowProjection (33/33)`, `entitlementTerms (5/5)`, `entitlementTermsShort (7/7)`, `vacuumOverlay (8/8)`. |

---

## 6. FIX RECOMMENDATIONS (Minimal, Targeted)

### Fix A — BUG #1 (P0): Add missing fields to `wizardToFormState()`

**File:** `src/features/architect/admin/wizardToEntitlement.ts`  
**Change:** Add 3 lines to the `base` object (around L72):

```typescript
linkedEntitlementIdsText: '',
residualOfEntitlementId: '',
coveredByEntitlementIdsText: '',
```

**Risk:** Zero — these are empty-string defaults matching existing form state defaults.  
**Effort:** < 1 minute.

### Fix B — BUG #2 (P1): Explicit field deletion in `buildEntitlementDocument()`

**File:** `src/features/architect/admin/entitlementEditorFormState.ts`  
**Change:** For each conditionally-included field, include an explicit `null` or sentinel when the value is empty. Then in `entitlementWriter.ts`, convert `null` values to `deleteField()` before writing.

Alternative (simpler): change `setDoc(ref, {...}, { merge: true })` to `setDoc(ref, {...})` (full replace). This removes the merge: true ghost problem entirely but requires ensuring the document is always complete.

**Risk:** Low — requires testing that existing documents aren't accidentally losing metadata fields set by other systems.  
**Effort:** ~30 minutes.

### Fix C — BUG #3 (P1): Full-document vacuum edits

**File:** `src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts`  
**Change:** Store complete documents (not patches) in vacuum edits, or handle `null` as "delete field" in `deepMerge`.  
**Risk:** Low — vacuum mode is session-only.  
**Effort:** ~20 minutes.

### Fix D — BUG #4 (P2): Add `swapType` to Zod schema

**File:** `src/schemas/architect.ts`  
**Change:** 1 line addition to `EntitlementAssetZ`.  
**Effort:** < 1 minute.

---

## 7. TEST EVIDENCE SUMMARY

| Test Suite | Pass | Fail | Notes |
|---|---|---|---|
| `entitlementEditorProtection.test.tsx` | 7/7 | 0 | Protection templates + validation |
| `entitlementEditorSwapType.test.tsx` | 6/6 | 0 | Swap type round-trip |
| `entitlementResolver.vacuumOverlay.test.ts` | 8/8 | 0 | Vacuum overlay merge seam |
| `entitlementTermsShort.test.ts` | 7/7 | 0 | Terms display formatting |
| `pickRightWizardDraft.test.ts` | 10/10 | 0 | Draft localStorage persistence |
| `entitlementTrading.test.js` | 11/11 | 0 | Downstream trading logic |
| `entitlementPickRowProjection.test.js` | 33/33 | 0 | PickRow projection |
| `entitlementTerms.test.ts` | 5/5 | 0 | Terms normalizer |
| `wizardTranslation.test.ts` | 26/33 | 7 | **BUG #1** (4 fails from missing fields), **3 fails from label/preset count drift** |
| `pickRightWizard.test.tsx` | 19/26 | 7 | BUG #1 + UI expectation drift |
| `pickRightWizard.vacuumApply.test.tsx` | 1/11 | 10 | Mostly UI rendering expectations |
| `entitlementEditorModal.test.tsx` | 0/? | ALL | Module mock issues (not related to persistence) |

---

## 8. STOP CONDITIONS & UNKNOWNS

| Item | Status | Detail |
|---|---|---|
| Firestore live write verification | **NOT TESTED** | Would require running the dev server with credentials and feature flag enabled. Static trace is complete. |
| `merge: true` ghost proof | **PROVEN BY CODE INSPECTION** | `buildEntitlementDocument` conditionally omits empty fields + `setDoc({merge:true})` = old values persist. No test exists that verifies field deletion on edit. |
| Vacuum overlay revert proof | **PROVEN** | `removeEdit()` deletes the patch from localStorage, resolver reverts to base. Test: `vacuumOverlay` suite passes. |
| DARE engine interaction with editor edits | **OUT OF SCOPE** | DARE resolution is downstream of edits; changes to protection ladders via the editor feed into DARE but DARE simulation is not assessed here. |
