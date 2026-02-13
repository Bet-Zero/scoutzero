# TM-VACUUM-P1 — Preflight Return Package

> **Ticket:** TM-VACUUM-P1  
> **Mode:** PREFLIGHT (discovery only — no functional code changes)  
> **Date:** 2026-02-12  
> **Master doc:** `docs/architect/TRADE_MACHINE_VACUUM_MODE_MASTER.md`

---

## T1 — Reality Check: Where Is "Vacuum" Today?

### Where worldId is decided

`worldId` originates in `useArchitectState` (called by `GMDashboard.jsx` L83) and flows through:

```
GMDashboard.jsx
  └─ state.worldId (from useArchitectState hook)
     └─ TradeSection.jsx  (pass-through)
        └─ TradeEditor.jsx  (prop: worldId = null default)
           └─ useTradeMachine(…, worldId)
```

`useTradeMachine.js` L235 accepts `worldId = null` as default parameter.

### What happens when worldId is missing

| Behavior                     | Detail                                                                                                                                                                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Entitlement loading**      | Still works — `resolveEntitlementsForTeam(null, teamCode)` falls back to `architect_baseTeams/{teamCode}.entitlementIds` → fetches from `architect_baseEntitlements`. ([entitlementResolver.ts L111-133](src/features/architect/utils/entitlements/entitlementResolver.ts#L111-L133))             |
| **Entitlement display**      | Entitlements render normally in `EntitlementPicksList` / `EntitlementPickRow` — no worldId dependency in display code.                                                                                                                                                                            |
| **Edit pencil icon**         | Visible (controlled by `isEntitlementAuthoringEnabled()` feature flag). But clicking it triggers `handleEditEntitlement()` which toasts _"Select an active world to edit entitlements."_ and returns. ([TradeEditor.jsx L141-145](src/features/architect/tradeMachine/TradeEditor.jsx#L141-L145)) |
| **"New Pick Right" button**  | Visible. But clicking triggers `handleCreateEntitlement()` which toasts same error. ([TradeEditor.jsx L155-159](src/features/architect/tradeMachine/TradeEditor.jsx#L155-L159))                                                                                                                   |
| **Trade validation**         | Works — `validationEntitlements` are populated from resolved entitlements; `validateStepien()` consumes them normally.                                                                                                                                                                            |
| **World entitlement writes** | `writeWorldEntitlement()` guards on `!worldId` → returns `{ success: false }`. ([entitlementWriter.ts L290](src/features/architect/utils/entitlements/entitlementWriter.ts#L290))                                                                                                                 |

**Summary:** In vacuum mode today, entitlements load and display correctly. Only editing/creating is blocked.

---

## T2 — Entitlement Edit Entrypoints & Hard Gates

### Edit flow (pencil icon click)

```
EntitlementPickRow.jsx
  └─ <Pencil> onClick → onEdit(entitlement)
     └─ EntitlementPicksList.jsx  prop: onEditEntitlement
        └─ TradeTeamCard.jsx  prop: onEditEntitlement
           └─ TradeEditor.jsx  handleEditEntitlement(entitlement)
              ├─ GATE 1: !canEditEntitlements → toast("authoring disabled") ← feature flag
              ├─ GATE 2: !worldId → toast("Select an active world…") ← HARD BLOCK
              ├─ GATE 3: !userId → toast("Sign in to edit…")
              └─ setEntitlementEditorState({ entitlementId, initialDocument })
                 └─ <PickRightWizardModal worldId={worldId} …/>
```

### Create flow ("New Pick Right" click)

```
EntitlementEditorCreateButton.tsx
  └─ onClick → onCreateEntitlement
     └─ EntitlementPicksList.jsx  prop: onCreateEntitlement
        └─ TradeTeamCard.jsx  → onCreateEntitlement(team.id)
           └─ TradeEditor.jsx  handleCreateEntitlement(teamCode)
              ├─ GATE 1: !canEditEntitlements → toast ← feature flag
              ├─ GATE 2: !worldId → toast("Select an active world…") ← HARD BLOCK
              ├─ GATE 3: !userId → toast("Sign in…")
              └─ setEntitlementEditorState({ entitlementId: null, initialDocument: defaults })
                 └─ <PickRightWizardModal worldId={worldId} …/>
```

### PickRightWizardModal save flow

```
PickRightWizardModal.tsx  handleApply()  (L268-L308)
  ├─ buildEntitlementDocument(formState)
  ├─ validateEntitlementDocument(document)
  ├─ generateEntitlementId() if needed
  └─ writeWorldEntitlement(db, { worldId, entitlementId, document, userId })
     ├─ GATE: !isEntitlementAuthoringEnabled() → return { success: false }
     ├─ GATE: !worldId → return { success: false, error: "worldId required" }
     └─ setDoc(…) to Firestore
```

### Hard gates summary (to relax in execution)

| #   | Location                        | Condition                                   | Action needed                                     |
| --- | ------------------------------- | ------------------------------------------- | ------------------------------------------------- |
| G1  | `TradeEditor.jsx:L141`          | `!worldId` in `handleEditEntitlement`       | Allow when vacuum overlay enabled                 |
| G2  | `TradeEditor.jsx:L155`          | `!worldId` in `handleCreateEntitlement`     | Allow when vacuum overlay enabled                 |
| G3  | `TradeEditor.jsx:L149`          | `!userId` in `handleEditEntitlement`        | Keep or relax (userId not needed for local edits) |
| G4  | `TradeEditor.jsx:L163`          | `!userId` in `handleCreateEntitlement`      | Keep or relax                                     |
| G5  | `PickRightWizardModal.tsx:L284` | `writeWorldEntitlement(…)` call             | Route to vacuum overlay writer when !worldId      |
| G6  | `entitlementWriter.ts:L290`     | `!worldId` guard in `writeWorldEntitlement` | Secondary safety net — keep as-is                 |

---

## T3 — Entitlement Resolution & Validator Inputs

### Resolution chain (produces entitlement rows)

```
useTradeMachine.js  init() / selectTeam()
  └─ resolveEntitlementsForTeam(worldId, teamCode)     ← entitlementResolver.ts L215-219
     └─ resolveEntitlementsForTeamWithDb(db, worldId, teamCode)    ← L184-211
        ├─ resolveTeamEntitlementIds(db, worldId, teamCode)        ← L106-133
        │     ├─ If worldId: read architect_worlds/{worldId}/teams/{teamCode}.entitlementIds
        │     └─ Else: read architect_baseTeams/{teamCode}.entitlementIds
        ├─ fetchEntitlementsByIds(basePath, ids)  → base docs
        ├─ If worldId: fetchEntitlementsByIds(worldPath, ids) → override docs
        └─ For each id: deepMerge(base, override) → EffectiveEntitlement[]
```

Result is stored as:

- `teamObj.entitlements` → used for UI display in `EntitlementPicksList`
- Passed as `validationEntitlements` to `validateTrade()` → consumed by `validateStepien()`

### Validator input structure

```javascript
// useTradeMachine.js L867-876 — validateCurrentTrade()
validateTrade({
  teams: patchedTeams
    .filter((t) => t.team)
    .map((t) => ({
      team: t.team,
      sends: t.sends,
      hardCapped: t.team.hardCapped,
      entitlementsOut: t.entitlementsOut || [], // ← selected for trade
      validationEntitlements: t.entitlements || [], // ← full team inventory (for Stepien baseline)
    })),
  capProjections,
  currentYear: yearKey,
  tradeCtx: { worldId, yearKey },
});
```

### Merge seam identification

**Primary merge seam:** `resolveEntitlementsForTeam()` in `entitlementResolver.ts`  
This is the **single function** that every consumer calls. Injecting the vacuum overlay here ensures:

- `team.entitlements` in `useTradeMachine` state includes overlay entitlements
- `validationEntitlements` passed to validator includes overlay entitlements
- `EntitlementPicksList` / `EntitlementPickRow` display includes overlay entitlements
- Trade receipt includes overlay entitlements

**Verdict:** Clean single merge seam exists. No refactor needed.

### Local state refresh path (after wizard save)

```
TradeEditor.jsx L363-364:
  onSuccess → applyEntitlementOverrideUpdate(entitlementId, document)
    └─ useTradeMachine.js L1004-1078:
       Deep-merges into team.entitlements and team.entitlementsOut in-memory.
       Refreshes pickRulesById.
```

This path works for both world and vacuum mode — it only mutates React state.

---

## T4 — Local Overlay Design

### Option A: Resolver-Layer Session Overlay (RECOMMENDED ✓)

Merge overlay at `resolveEntitlementsForTeam()` level.

**Storage:**

```
localStorage key: "vacuum_entitlement_overlay"
Shape: {
  version: 1,
  overlays: {
    "<teamCode>": {
      edits: { "<entitlementId>": { /* partial fields */ } },
      creates: { "vacuum:<team>:<year>:<round>:<kind>:<uuid>": { /* full doc */ } }
    }
  },
  _updatedAt: "<ISO>"
}
```

**Pros:**

- Single merge point → all downstream automatically correct
- Matches existing `deepMerge` pattern in resolver
- Validator gets correct data with zero additional wiring
- Existing `applyEntitlementOverrideUpdate()` continues to work for React state refresh

**Cons:**

- Resolver currently async (Firestore). Adding sync localStorage read is trivial but mixes concerns slightly.

### Option B: UI Projection Layer Overlay (REJECTED)

Merge overlay at `EntitlementPicksList` level.

**Pros:**

- No resolver changes.

**Cons:**

- Does NOT affect `validationEntitlements` → Stepien, trade receipt wrong.
- Requires separate merge in `useTradeMachine.js` for validator inputs.
- Two merge points = fragile.

### Chosen: Option A

### Vacuum ID generation

```typescript
function generateVacuumEntitlementId(
  holderTeam: string,
  seasonYear: number,
  round: number,
  kind: 'pick_ownership' | 'swap_right' | 'conveyance_right'
): string {
  const kindShort =
    kind === 'pick_ownership' ? 'own' : kind === 'swap_right' ? 'swap' : 'conv';
  const shortUuid = Math.random().toString(36).substring(2, 10);
  return `vacuum:${holderTeam}:${seasonYear}:${round}:${kindShort}:${shortUuid}`;
}
```

### Clear/reset strategy

- `resetVacuumOverlay()` → removes `"vacuum_entitlement_overlay"` key.
- Called on: explicit reset button, or when user selects a worldId (entering world mode).
- Draft data (`pickrightdraft:…`) uses existing key format and is unaffected.

### Firestore write prevention in vacuum mode

1. `PickRightWizardModal.handleApply()` checks `!worldId`:
   - If vacuum: call `saveToVacuumOverlay(teamCode, entitlementId, document)` + call `onSuccess` callback (which triggers `applyEntitlementOverrideUpdate` for React state).
   - If world: existing `writeWorldEntitlement()` path.
2. `writeWorldEntitlement()` already returns `{ success: false }` when `!worldId` — safety net unchanged.

---

## T5 — Acceptance Criteria (for Execution)

### AC-1: Vacuum edit works without worldId

- When `worldId === null`, clicking the pencil icon on an entitlement opens `PickRightWizardModal` in vacuum mode.
- Saving in vacuum mode stores the edit in the session overlay (localStorage), NOT Firestore.
- The edited entitlement is immediately reflected in the UI (EntitlementPickRow) and in trade validation.

### AC-2: Vacuum create works without worldId

- When `worldId === null`, clicking "New Pick Right" opens `PickRightWizardModal` in create mode.
- The new entitlement gets a `vacuum:` prefixed ID.
- Saving stores the new entitlement in the session overlay.
- The new entitlement appears in the team's entitlement list and is selectable for trading.

### AC-3: Session overlay persists in browser

- Overlay data survives page refreshes within the same browser (localStorage).
- Overlay data is cleared when user explicitly resets, or switches to world mode.

### AC-4: Entitlements affect trade summary + receipt

- Vacuum-created/edited entitlements appear in trade receipt (`outgoingEntitlements` / `incomingEntitlements`).
- Vacuum-edited protections/terms are reflected in Stepien validation warnings.

### AC-5: Does not require advanced editor for common presets

- The 3-step wizard (Intent → Details → Review) works in vacuum mode without fallback to advanced editor.
- "Open in Advanced Editor" button still available as escape hatch.

### AC-6: World-based authoring unchanged

- When `worldId` is set, all existing behavior is identical.
- Session overlay is ignored when `worldId` is present.
- `writeWorldEntitlement()` path is unchanged.

### AC-7: Zero Firestore writes in vacuum mode

- No Firestore document is created, updated, or deleted when operating in vacuum mode.
- `writeWorldEntitlement()` safety net guard remains in place.

### AC-8: userId not required in vacuum mode

- Vacuum mode does not require authentication/userId.
- `_lastModifiedBy` field is not needed for localStorage-only storage.

---

## Call Chain Diagrams

### (a) Edit Existing Entitlement

```
User clicks pencil icon
  └─ EntitlementPickRow.jsx → onEdit(entitlement)
     └─ EntitlementPicksList.jsx → onEditEntitlement(entitlement)
        └─ TradeTeamCard.jsx → onEditEntitlement(entitlement)
           └─ TradeEditor.jsx → handleEditEntitlement(entitlement)
              ├─ CHECK: canEditEntitlements (feature flag)
              ├─ CHECK: worldId || vacuumMode  ← CHANGE: relax gate
              └─ setEntitlementEditorState({ entitlementId, initialDocument })
                 └─ <PickRightWizardModal>
                    ├─ wizardModel ↔ formState sync
                    └─ handleApply()
                       ├─ buildEntitlementDocument(formState)
                       ├─ validateEntitlementDocument(document)
                       ├─ IF worldId: writeWorldEntitlement(db, params)
                       ├─ IF !worldId: saveToVacuumOverlay(teamCode, id, doc)  ← NEW
                       └─ onSuccess({ entitlementId, document })
                          └─ TradeEditor.jsx → applyEntitlementOverrideUpdate(id, doc)
                             └─ useTradeMachine.js → deep-merge into teams state
```

### (b) Create New Pick Right

```
User clicks "New Pick Right"
  └─ EntitlementEditorCreateButton.tsx → onClick
     └─ EntitlementPicksList.jsx → onCreateEntitlement()
        └─ TradeTeamCard.jsx → onCreateEntitlement(team.id)
           └─ TradeEditor.jsx → handleCreateEntitlement(teamCode)
              ├─ CHECK: canEditEntitlements
              ├─ CHECK: worldId || vacuumMode  ← CHANGE: relax gate
              └─ setEntitlementEditorState({ entitlementId: null, initialDocument: defaults })
                 └─ <PickRightWizardModal>
                    ├─ createDefaultWizardModel()
                    └─ handleApply()
                       ├─ buildEntitlementDocument(formState)
                       ├─ validateEntitlementDocument(document)
                       ├─ id = generateVacuumEntitlementId(…) if !worldId  ← NEW
                       ├─ IF worldId: writeWorldEntitlement(…)
                       ├─ IF !worldId: saveToVacuumOverlay(teamCode, id, doc)  ← NEW
                       └─ onSuccess({ entitlementId, document })
                          └─ TradeEditor → applyEntitlementOverrideUpdate(id, doc)
                             └─ useTradeMachine → append to teams[idx].team.entitlements
```

### (c) Entitlement Resolution into Validator Inputs

```
useTradeMachine.js  init() or selectTeam()
  └─ resolveEntitlementsForTeam(worldId, teamCode)
     └─ entitlementResolver.ts → resolveEntitlementsForTeamWithDb(db, worldId, teamCode)
        ├─ resolveTeamEntitlementIds(db, worldId, teamCode) → string[]
        ├─ fetchEntitlementsByIds(basePath, ids) → base docs
        ├─ If worldId: fetchEntitlementsByIds(worldPath, ids) → override docs
        ├─ ★ If !worldId: loadVacuumOverlay(teamCode) → { edits, creates }  ← NEW
        ├─ For each id: deepMerge(base, override OR vacuumEdit)
        ├─ Append vacuum creates
        └─ Return EffectiveEntitlement[]

  ── stored as ──►  teamObj.entitlements

useTradeMachine.js  validateCurrentTrade()
  └─ validateTrade({
       teams: [{ …, validationEntitlements: teamObj.entitlements, entitlementsOut }]
     })
     └─ tradeValidator.js → per-team processing
        ├─ outgoingEntitlements → decorateEntitlementForTrade() → trade receipt
        ├─ incomingEntitlements → from other teams' outgoing → trade receipt
        └─ validateStepien(team, tradeCtx)
           ├─ team.validationEntitlements → buildStepienBaselinePicksFromEntitlements()
           └─ team.entitlementsOut → buildStepienOutgoingPicksFromEntitlements()
```

---

## Proposed File Change List (Execution)

| #   | File                                                               | Change   | Reason                                                                                                                                                                            |
| --- | ------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/features/architect/utils/entitlements/vacuumOverlayStore.ts`  | **NEW**  | localStorage read/write/clear for vacuum session overlay. Pure utility, no React.                                                                                                 |
| 2   | `src/features/architect/utils/entitlements/entitlementResolver.ts` | **EDIT** | In `resolveEntitlementsForTeamWithDb()`: if `!worldId`, load overlay, deep-merge edits, append creates. ~15 lines.                                                                |
| 3   | `src/features/architect/tradeMachine/TradeEditor.jsx`              | **EDIT** | Relax gates G1/G2 in `handleEditEntitlement` / `handleCreateEntitlement`: allow when `!worldId`. ~6 lines changed.                                                                |
| 4   | `src/features/architect/admin/PickRightWizardModal.tsx`            | **EDIT** | In `handleApply()`: if `!worldId`, call `saveToVacuumOverlay()` instead of `writeWorldEntitlement()`. Generate `vacuum:` ID for creates. ~20 lines. Make `worldId` prop optional. |
| 5   | `src/features/architect/hooks/useTradeMachine.js`                  | **EDIT** | In `applyEntitlementOverrideUpdate()`: for vacuum creates (new entitlements not in existing list), append to `team.entitlements` array. ~8 lines.                                 |
| 6   | `src/features/architect/admin/pickRightWizardDraft.ts`             | **EDIT** | Allow `worldId = 'vacuum'` as special key for draft storage when worldId is null. ~3 lines.                                                                                       |
| 7   | `tests/vacuumOverlayStore.test.ts`                                 | **NEW**  | Unit tests for overlay CRUD, merge logic, clear on world switch.                                                                                                                  |
| 8   | `tests/entitlementResolver.vacuum.test.ts`                         | **NEW**  | Integration test: resolver returns overlay-merged results when worldId is null.                                                                                                   |

**Total estimated changes:** ~80 lines of new code across 4 edited files + 1 new utility + 2 test files.

---

## Stop Condition Assessment

> _"If there is no single safe merge seam for overlay injection, stop and propose a minimal refactor strategy."_

**Result: SAFE MERGE SEAM EXISTS.** `resolveEntitlementsForTeam()` is the single resolver entry point consumed by all downstream code. No refactor needed to proceed with execution.

---

## Existing localStorage Patterns (extensible)

The `pickRightWizardDraft.ts` module already demonstrates the project's localStorage pattern:

- Key format: `pickrightdraft:{worldId}:{entitlementId|new}`
- Versioned envelope: `{ version: 2, wizardModel, formState }`
- Try/catch around all localStorage access
- Silent failure on quota/unavailability

The vacuum overlay store will follow this same pattern.
