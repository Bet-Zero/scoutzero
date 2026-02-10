# TM-9A: Wizard Reality Check — Evidence Pack

**Date:** 2026-02-10
**Mode:** Preflight (read-only — no code changes, no Firestore writes)
**Master doc:** `docs/architect/TRADE_MACHINE_MASTER_AUDIT.md`

---

## Summary

| Task | Description | Result |
|------|-------------|--------|
| T1 | Wiring Reality Check | **PASS** — Wizard is the default entrypoint |
| T2 | Jargon Ban Audit | **PASS** — Zero jargon in rendered wizard UI |
| T3 | Translation Layer Tests | **84/86 PASS**, 2 draft-persistence test failures (scoped) |
| T4 | Build Sanity | **PASS** — `vite build` succeeds (known warnings only) |
| T5 | Copy Inventory | **COMPLETE** — Full inventory below |

---

## T1 — Wiring Reality Check

### Call Chain

```
User clicks pencil icon / "New Pick Right" button
    │
    ├─ EntitlementPickRow.jsx:216-226
    │    Renders <Pencil> icon only when `onEdit` prop exists
    │
    ├─ EntitlementPicksList.jsx:~179
    │    Passes `onEdit` prop down from parent
    │
    ├─ TradeTeamCard.jsx:~269
    │    Gates on `canEditEntitlements` (derived from feature flag)
    │
    ├─ TradeEditor.jsx:134-158  → handleEditEntitlement()
    │    Validates: flag enabled, worldId exists, userId exists, entitlementId exists
    │    Sets: setEntitlementEditorState({ entitlementId, initialDocument })
    │
    ├─ TradeEditor.jsx:160-188  → handleCreateEntitlement()
    │    Same guards; sets entitlementId=null (create mode)
    │
    └─ TradeEditor.jsx:356-368  → Renders PickRightWizardModal
         {entitlementEditorState && (
           <PickRightWizardModal
             worldId={worldId}
             entitlementId={entitlementEditorState.entitlementId}
             initialDocument={entitlementEditorState.initialDocument}
             userId={userId}
             onClose={() => setEntitlementEditorState(null)}
             onSuccess={({ entitlementId, document }) => {
               applyEntitlementOverrideUpdate(entitlementId, document);
               setEntitlementEditorState(null);
             }}
           />
         )}
```

**Confirmed:** `PickRightWizardModal` is the SOLE modal rendered — NOT `EntitlementEditorModal`.

### Create Button

`EntitlementEditorCreateButton.tsx:28-38` renders a green "New Pick Right" button with `<Plus>` icon. User-facing label: **"New Pick Right"** (no jargon).

### Feature Flag

`entitlementWriter.ts:92-105`:
```ts
export function isEntitlementAuthoringEnabled(): boolean {
  try {
    const env =
      typeof import.meta !== 'undefined' && import.meta.env
        ? import.meta.env
        : typeof process !== 'undefined'
          ? process.env
          : {};
    return env.VITE_FEATURE_ENTITLEMENT_AUTHORING === 'true';
  } catch {
    return false;
  }
}
```

**When disabled:**
- Pencil/Plus buttons receive `null` for their `onClick` → not rendered (gated by `{onEdit && ...}`)
- If somehow opened, handler shows toast: "Entitlement authoring is disabled."
- Firestore writes blocked at persistence layer

---

## T2 — Jargon Ban Audit

### Banned Terms
`underlyingPickId`, `underlyingStatus`, `encumbered`, `clean`, `swapControllerPickId`, `swapTargetDefinition`, `poolUnderlyingPickIds`, `receivesComparator`, `receivesRank`

### Broad Sweep: `src/features/architect/admin/`

Grep command:
```
rg -n "underlyingPickId|underlyingStatus|encumbered|\bclean\b|swapControllerPickId|
swapTargetDefinition|poolUnderlyingPickIds|receivesComparator|receivesRank"
src/features/architect/admin/
```

**Total hits:** ~100+ lines across 12 files

### Classification of Hits

| File | Category | Renders Jargon to User? |
|------|----------|------------------------|
| `entitlementEditorFormState.ts` | Internal form state model (type defs, defaults, serialization) | **No** — code-only |
| `useEntitlementEditorState.ts` | Validation hook (error key lookups) | **No** — error messages are plain English |
| `wizardToEntitlement.ts` | Translation layer (wizard model → form state) | **No** — code-only |
| `pickRightWizardModel.ts` | Wizard model → form state mapping | **No** — code-only |
| `pickEditorCopy.ts` | `JARGON_GLOSSARY` (Advanced Editor tooltips only) + `WIZARD_STATUS_LABELS` (maps `clean`→"Tradable", `encumbered`→"Restricted") | **No** — glossary never rendered in wizard mode; status labels map TO plain English |
| `PlainEnglishPreview.tsx` | Reads `formState.swapControllerPickId` etc. to build English sentences | **No** — accesses values, renders English |
| `PickRightWizardModal.tsx` | Validation logic (`formState.underlyingPickId?.trim()` etc.) | **No** — JS property access; error msgs are plain English |
| `EntitlementEditorBasicsTab.tsx` | Advanced Editor tab | **N/A** — not wizard mode |
| `EntitlementEditorSwapTab.tsx` | Advanced Editor tab | **N/A** — not wizard mode |
| `EntitlementEditorConveyanceTab.tsx` | Advanced Editor tab | **N/A** — not wizard mode |
| `EntitlementEditorFormTabs.tsx` | Advanced Editor tab routing | **N/A** — not wizard mode |

### Focused Sweep: Wizard Step Components

| File | Hits | Analysis |
|------|------|----------|
| `WizardStepIntent.tsx` | **0 hits** | Clean |
| `WizardStepDetails.tsx` | 6 hits | All are `fieldErrors.{schemaKey}` lookups — the *rendered text* is the error MESSAGE value (e.g., "Required for swap right"), never the key name |
| `WizardStepReview.tsx` | 2 hits | `WIZARD_STATUS_LABELS[formState.underlyingStatus]` → renders "Tradable"/"Restricted"; `WIZARD_COMPARATOR_LABELS[formState.receivesComparator]` → renders "Most favorable"/"Least favorable"/"Middle" |

### Verdict: **PASS**

Zero banned terms appear as user-visible rendered text in the wizard. All hits in wizard files are:
1. JavaScript property key access on `formState.*` or `fieldErrors.*`
2. Lookup keys into `WIZARD_STATUS_LABELS` / `WIZARD_COMPARATOR_LABELS` that map TO plain English

---

## T3 — Translation Layer Tests

### Command
```bash
npm test -- --run src/tests/architect/wizardTranslation.test.ts \
  src/tests/architect/pickRightWizard.test.tsx \
  src/tests/architect/pickRightWizardDraft.test.ts \
  src/tests/architect/pickSelector.test.tsx \
  src/tests/architect/pickTermsPreview.test.tsx
```

### Results

| Test File | Tests | Passed | Failed |
|-----------|-------|--------|--------|
| `wizardTranslation.test.ts` | 37 | 37 | 0 |
| `pickRightWizard.test.tsx` | 23 | 23 | 0 |
| `pickRightWizardDraft.test.ts` | 10 | 8 | **2** |
| `pickSelector.test.tsx` | 10 | 10 | 0 |
| `pickTermsPreview.test.tsx` | 6 | 6 | 0 |
| **Total** | **86** | **84** | **2** |

### Failures (scoped to draft persistence)

Both failures are in `pickRightWizardDraft.test.ts`:

1. **`saveDraft > stores draft to localStorage with correct key`**
   - Test expects flat `mockFormState` in localStorage
   - Actual stored value is `{ version: 2, wizardModel: { ...mockFormState } }`
   - **Root cause:** `saveDraft()` wraps the model in a version envelope (`{ version: 2, wizardModel }`) — the test's `mockFormState` fixture was written against the flat (v1) format

2. **`loadDraft > retrieves a previously saved draft`**
   - Test saves flat `mockFormState` via `saveDraft()`, which wraps it in v2 envelope
   - `loadDraft()` reads the v2 envelope but the test asserts against the flat fixture
   - Returns `null` because the test's expectation doesn't match the unwrapped v2 output

**Impact:** These are **test fixture bugs**, not production bugs. The save/load draft code correctly handles v1→v2 migration (verified by the 8 passing tests including the migration tests). The two failing tests just need their assertions updated to account for the v2 envelope format.

**No user-facing or data-integrity risk.**

---

## T4 — Build Sanity

### Command
```bash
npm run build
```

### Output
```
vite v4.5.14 building for production...
✓ 3018 modules transformed.
✓ built in 22.80s
```

### Warnings (all pre-existing, not wizard-related)

1. **Browserslist data stale** — `caniuse-lite` 6 months old (cosmetic)
2. **`fs` externalized** — `tradeDebug.js` imports Node `fs` module (browser build excludes it; debug-only)
3. **`firebaseConfig.js` mixed import** — both static and dynamic imports from two entitlement resolvers (tree-shaking note, not an error)
4. **Chunk size** — `index-1872926f.js` at 2,124 KB exceeds 500 KB warning threshold (pre-existing)

### Verdict: **PASS** — Build succeeds with zero new warnings.

---

## T5 — Copy Inventory

### Step 1: Intent ("What are you doing?")

**Source:** `WizardStepIntent.tsx:21-54`

| Icon | Title | Description |
|------|-------|-------------|
| 🛡️ | Protect a Pick | Set up pick ownership with optional protection ladders (Top 3, Lottery, etc.) |
| 🔄 | Create a Swap Right | Define a draft pick swap — best-of or worst-of between two teams' picks. |
| 📦 | Create a Conveyance Right | Pool multiple picks and select by favorability ranking. |
| ⚙️ | Advanced Editor | Open the full tabbed editor with all fields and raw JSON access. |

**Heading:** "What are you doing?"
**Subheading:** "Choose the type of pick right you want to create or edit."

---

### Step 2: Details (per-intent fields)

**Source:** `WizardStepDetails.tsx`, `pickEditorCopy.ts:88-140`

#### Common Fields (all intents)
| Label | Help Text / Placeholder |
|-------|------------------------|
| Pick | "Select the team, year, and round for this pick." |
| Description (optional) | Placeholder: "e.g. 2027 BOS 1st, Lottery-protected via trade with PHI" |

#### PickSelector Dropdowns (`PickSelector.tsx`)
| Field | Options |
|-------|---------|
| Team | "Select..." → "{CODE} — {TeamName}" (from allTeams) |
| Year | "Select..." → 2024–2033 |
| Round | "1st Round" / "2nd Round" |
| Advanced toggle | "Advanced: edit raw pick ID" / "Hide" |
| Raw input | Placeholder: "e.g. BOS_2027_1" |
| Generated ID | "Pick ID: {value}" |

#### Pick Ownership
| Label | Help Text |
|-------|-----------|
| Protection Pattern | "Choose a common protection pattern to auto-fill the ladder." |
| Protection Ladder | (renders tier list) |
| Clear ladder | (button) |

**Protection Templates** (`ProtectionLadderTemplates.ts`):
| Template | Description |
|----------|-------------|
| Unprotected | No protection - pick conveys regardless of position |
| Lottery -> Top 10 -> Unprotected | 3-year ladder: Lottery protected, rolls to Top 10, then unprotected |
| Top 3 -> Unprotected | 2-year ladder: Top 3 protected first year, unprotected second year |
| Top 10 -> Converts to 2nd | If top 10, converts to 2nd round pick instead |
| Top 5 -> Top 3 -> Unprotected | 3-year ladder: Top 5 first, Top 3 second, unprotected third |
| Lottery -> Converts to 2nd | If lottery pick, converts to 2nd round instead |

#### Swap Right
| Label | Help Text / Placeholder |
|-------|------------------------|
| Swap Type | Buttons: "Best of" / "Worst of" |
| Controller Pick | "The pick that controls the swap — the team with the right to choose." |
| Target Description | Help: "Describe which pick(s) the swap targets." Placeholder: "e.g. BOS own 1st round pick" |

#### Conveyance Right
| Label | Help Text / Placeholder |
|-------|------------------------|
| Pool of Picks | Help: "Add picks to the conveyance pool (minimum 2 required)." Button: "+ Add Pick" |
| Selection Method | Options: "Best (most favorable)" / "Worst (least favorable)" / "Middle" |
| Selection Rank | Help: "Which rank(s) to receive (e.g. 1 for best, or 1, 2 for top 2)." |

#### Validation Error Messages (all intents)
| Error | Context |
|-------|---------|
| Required for pick ownership | Missing pick ID |
| Required for swap right | Missing controller pick or target description |
| Pool must have at least 2 picks | Conveyance pool too small |
| Selection method required | Missing comparator |
| At least one rank required | Missing rank |

---

### Step 3: Review & Apply

**Source:** `WizardStepReview.tsx`, `PlainEnglishPreview.tsx`

#### Validity Indicator (`PlainEnglishPreview`)
| State | Display |
|-------|---------|
| Valid | ✅ "Valid — ready to apply" |
| Invalid | ❌ "Fix {count} error(s)" |

#### Tradability Badge
| Condition | Icon | Label | Reason |
|-----------|------|-------|--------|
| No intent selected | ❓ | Unknown | "Select a pick right type" |
| Pick ownership, no protections | ✅ | Tradable | "No restrictions" |
| Pick ownership, has protections | ⚠️ | Tradable with restriction | "Has {n} protection tier(s)" |
| Swap right | ⚠️ | Tradable with restriction | "Subject to swap right" |
| Conveyance right | ⚠️ | Tradable with restriction | "Part of conveyance pool" |

#### Field Summary Labels
| Label (rendered) | Value format |
|-----------------|--------------|
| Type | "Pick Ownership" / "Swap Right" / "Conveyance Right" |
| Team | 3-letter code |
| Season Year | Number |
| Round | "1st" / "2nd" |
| Pick | `{TEAM}_{YEAR}_{ROUND}` |
| Restrictions | "Tradable" / "Restricted" / "Part of a pool" |
| Protection Tiers | "{n} tier(s)" |
| Swap Type | "Best of" / "Worst of" |
| Controller Pick | `{TEAM}_{YEAR}_{ROUND}` |
| Target Description | Free text |
| Pool of Picks | "{n} pick(s)" |
| Selection Method | "Most favorable" / "Least favorable" / "Middle" |
| Selection Rank | Comma-separated numbers |
| Description (optional) | Free text |

#### Action Buttons
| Button | Condition |
|--------|-----------|
| **Apply** | Enabled when valid + not saving; shows "Applying..." when active |
| **Save Draft** | Always available (disabled during save) |
| **Open in Advanced Editor** | Always available (text link, bottom-right) |

---

### Supporting: Modal Chrome

**Source:** `PickRightWizardModal.tsx`

| Element | Text |
|---------|------|
| Header (edit mode) | "Edit Pick Right" |
| Header (create mode) | "New Pick Right" |
| Step indicator | "1. Type → 2. Details → 3. Review" |
| Cancel button | "Cancel" (step 1 only) |
| Back button | "← Back" |
| Next button | "Review →" |
| Toast: draft restored | "Draft restored" |
| Toast: draft migrated | "Draft restored (migrated from v1)" |
| Toast: draft needs advanced | "Draft restored — open Advanced Editor for full access" |
| Toast: draft saved | "Draft saved" |
| Toast: validation failed | "Validation failed" |
| Toast: missing ID | "Entitlement ID could not be determined." |
| Toast: write failed | "Write failed" |
| Toast: success | "Entitlement saved" |

---

## Risks & Observations

### 1. Draft Test Fixture Mismatch (LOW)
Two `pickRightWizardDraft.test.ts` tests fail because the test fixture uses flat (v1) format but `saveDraft()` now wraps in `{ version: 2, wizardModel: {...} }`. The migration logic works correctly (8/10 tests pass including v1→v2 migration). **Fix:** Update test assertions to account for v2 envelope.

### 2. `firebaseConfig.js` Mixed Import Warning (PRE-EXISTING)
`PickRightWizardModal.tsx` statically imports `firebaseConfig.js` while `entitlementResolver.ts` and `pickRulesResolver.ts` dynamically import it. This triggers a Vite tree-shaking note. Not a correctness issue but may prevent optimal code-splitting.

### 3. Main Chunk Size (PRE-EXISTING)
`index-1872926f.js` at 2,124 KB. The wizard adds to this bundle since it's statically imported via `TradeEditor.jsx`. Could benefit from lazy-loading the wizard modal.

### 4. "Conveyance Right" Terminology
"Conveyance" is CBA-specific terminology that casual basketball fans may not understand. However, it is the correct NBA term and there is no simpler equivalent. Consider adding a tooltip or one-line explanation in the wizard card description.

### 5. PlainEnglishPreview Uses `formState` Field Names Internally
`PlainEnglishPreview.tsx:96-110` accesses `formState.swapControllerPickId`, `formState.poolUnderlyingPickIdsText`, `formState.receivesComparator` to build English sentences. The rendered output is always plain English, but if these field names ever appear in error states or fallback paths, they could leak. Currently safe.

---

*Generated by TM-9A preflight audit, 2026-02-10.*
