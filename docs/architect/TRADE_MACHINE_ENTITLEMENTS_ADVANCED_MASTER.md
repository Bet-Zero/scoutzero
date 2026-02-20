# Trade Machine Entitlements Advanced Master Doc

**Ticket:** TM-ENTITLEMENTS-ADV-P1  
**Status:** E1.2 EXECUTION COMPLETE  
**Created:** 2026-02-14  
**Last Updated:** 2026-02-20 (Naming Unification — Entitlement Editor Simple/Advanced)

---

## Executive Summary

This document establishes the canonical "advanced entitlement system" contract for ScoutZero's Trade Machine:

- **Three entitlement kinds**: `pick_ownership`, `swap_right`, `conveyance_right`
- **Ownership truth**: `team.entitlementIds[]` is the single source of truth for runtime ownership
- **Linkage support**: `linkedEntitlementIds` and `residualOfEntitlementId` fields enable Houston-style multi-entitlement patterns
- **Editor coverage**: 100% of fields editable via UI (Basics + Swap tabs now support linkage fields)

---

## 1. Canonical Schema + Semantics Map

### 1.1 Entitlement Kinds

| Kind               | Description                                | Real-World Example                                        |
| ------------------ | ------------------------------------------ | --------------------------------------------------------- |
| `pick_ownership`   | Direct ownership claim to a draft pick     | "Team A owns Team B's 2026 1st"                           |
| `swap_right`       | Option to swap picks based on favorability | "Team A has the right to swap its 2026 1st with Team B's" |
| `conveyance_right` | Ranked selection from a pool of picks      | "Team A receives the best/worst of picks X, Y, Z"         |

### 1.2 Field Semantics Table

#### Core Identity Fields (Must Not Change After Creation)

| Field        | Type               | Required | Description                            | Semantic Impact                                                               | Consumed By                                      |
| ------------ | ------------------ | -------- | -------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ |
| `id`         | string             | Yes      | Unique entitlement identifier          | Identity                                                                      | All consumers                                    |
| `holderTeam` | TeamCode (3-char)  | Yes      | **Display only** - team claimed on doc | Reference only; see [§4](#4-trade-execution-truth-single-source-of-ownership) | Editor, UI display                               |
| `seasonYear` | number (2020-2040) | Yes      | Draft year this applies to             | Stepien validation, UI grouping                                               | `validateStepien.js`, `EntitlementPicksList.jsx` |
| `round`      | number (1\|2)      | Yes      | Draft round                            | Stepien (1st round only), routing                                             | `validateStepien.js`, `entitlementTerms.ts`      |
| `kind`       | enum               | Yes      | Entitlement type                       | Resolution path, validation rules                                             | All validators, resolver, editor tabs            |

#### Pick Ownership Fields

| Field                     | Type             | Required                   | Description                              | Semantic Impact                       | Consumed By                                      |
| ------------------------- | ---------------- | -------------------------- | ---------------------------------------- | ------------------------------------- | ------------------------------------------------ |
| `underlyingPickId`        | string           | **Yes for pick_ownership** | Canonical pick ID (e.g., "LAL_2026_1st") | Links to base pick, DARE resolution   | `entitlementResolver.ts`, `entitlementWriter.ts` |
| `underlyingStatus`        | enum             | Optional                   | `pooled` \| `encumbered` \| `clean`      | Warning triggers (encumbered = warn)  | `entitlementWarnings.js`, UI badges              |
| `coveredByEntitlementIds` | string[]         | Optional                   | IDs of swap_rights covering this pick    | Warning logic for orphaned encumbered | `entitlementWarnings.js`                         |
| `protectionLadder`        | ProtectionTier[] | Optional                   | Multi-year protection sequence           | Display, future simulation            | `entitlementTerms.ts`, `PickTermsPreview.tsx`    |
| `linkedEntitlementIds`    | string[]         | Optional                   | IDs of related entitlements (package)    | Warning if incomplete trade; display  | `entitlementWarnings.js`, `EntitlementPickRow`   |
| `residualOfEntitlementId` | string           | Optional                   | Conveyance this swap targets residual of | Display, future resolution            | `EntitlementEditorSwapTab`, `EntitlementPickRow` |

##### Protection Ladder Tier Schema

```typescript
{
  year: number;           // Required: draft year this tier applies
  condition: string;      // Required: e.g., "Top 3", "Lottery", "Unprotected"
  ifTriggered: 'roll' | 'convert' | 'cancel';  // Required
  rollToYear?: number;    // Required if ifTriggered === 'roll'
  convertToRound?: number; // Required if ifTriggered === 'convert'
  source?: string;        // Optional: provenance/notes
}
```

#### Swap Right Fields

| Field                   | Type     | Required               | Description                           | Semantic Impact                                | Consumed By                                   |
| ----------------------- | -------- | ---------------------- | ------------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| `swapControllerPickId`  | string   | **Yes for swap_right** | Pick ID the holder can swap away from | Identity anchor for swap                       | `entitlementWriter.ts`, `entitlementTerms.ts` |
| `swapTargetDefinition`  | string   | **Yes for swap_right** | Human description of swap target      | Display, swapType parsing                      | `entitlementTerms.ts`, UI display             |
| `swapType`              | enum     | Optional               | `best_of` \| `worst_of`               | Stepien treatment (worst_of = no year reserve) | `entitlementTerms.ts`, `validateStepien.js`   |
| `poolUnderlyingPickIds` | string[] | Optional               | IDs of picks in swap pool             | Future graph resolution                        | Swap tab UI, future simulation                |

#### Conveyance Right Fields

| Field                   | Type     | Required                     | Description                                      | Semantic Impact              | Consumed By                                   |
| ----------------------- | -------- | ---------------------------- | ------------------------------------------------ | ---------------------------- | --------------------------------------------- |
| `poolUnderlyingPickIds` | string[] | **Yes for conveyance_right** | IDs of picks in the selection pool               | Pool size determines warning | `entitlementWriter.ts`, `validateStepien.js`  |
| `receivesRank`          | number[] | **Yes for conveyance_right** | Position(s) in pool received (1-indexed)         | Selection logic              | `entitlementWriter.ts`, `entitlementTerms.ts` |
| `receivesComparator`    | enum     | **Yes for conveyance_right** | `more_favorable` \| `less_favorable` \| `middle` | Selection direction          | `entitlementWriter.ts`, UI                    |

#### Metadata Fields (Display-Only / Non-Semantic)

| Field             | Type     | Description                     | Consumed By    |
| ----------------- | -------- | ------------------------------- | -------------- |
| `description`     | string   | Human-readable summary          | All UI display |
| `evidenceRowRefs` | string[] | Reference to scrape source rows | Audit only     |
| `sourceUrl`       | string   | URL of original source          | Audit only     |

#### Resolver-Injected Fields (Runtime Only)

| Field                 | Type             | Description                      | Lifecycle                                   |
| --------------------- | ---------------- | -------------------------------- | ------------------------------------------- |
| `__vacuumEdited`      | boolean          | Marks vacuum overlay edit        | Stripped before trade payload               |
| `__vacuumSessionOnly` | boolean          | Marks vacuum-created entitlement | Stripped before trade payload               |
| `terms`               | EntitlementTerms | Normalized terms object          | Attached by `decorateEntitlementForTrade()` |
| `termsShort`          | string           | Concise display string           | Attached by `decorateEntitlementForTrade()` |
| `draftKey`            | string           | Stable key for deduplication     | Attached by `decorateEntitlementForTrade()` |

---

## 2. Pattern Support Matrix

### Patterns We Must Support

| ID    | Pattern                                       | Example                                                    | Supported  | How/Where                                                                                                             |
| ----- | --------------------------------------------- | ---------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| **A** | Pick ownership (unprotected)                  | "BOS owns LAL 2026 1st"                                    | ✅ **Yes** | `kind: 'pick_ownership'` + `underlyingPickId`                                                                         |
| **B** | Pick ownership + single-year protection       | "BOS owns LAL 2026 1st, Top 3 protected"                   | ✅ **Yes** | `protectionLadder: [{ year: 2026, condition: 'Top 3', ifTriggered: 'roll' }]`                                         |
| **C** | Pick ownership + multi-year conveyance ladder | "Top 3 in 2026 → rolls to 2027 → Top 5 → 2028 unprotected" | ✅ **Yes** | `protectionLadder[]` with multiple tiers, each specifying `year`, `condition`, `ifTriggered`                          |
| **D** | Swap right between two picks                  | "PHX can swap its 2026 1st with BKN's 2026 1st (best of)"  | ✅ **Yes** | `kind: 'swap_right'` + `swapControllerPickId` + `swapTargetDefinition` + `swapType`                                   |
| **E** | Pool right among N picks                      | "HOU receives the worst of DAL/PHX/BKN 2026 1st"           | ✅ **Yes** | `kind: 'conveyance_right'` + `poolUnderlyingPickIds[]` + `receivesComparator: 'less_favorable'` + `receivesRank: [1]` |
| **F** | Chained constructs (multi-entitlement linked) | See §2.1 below                                             | ✅ **Yes** | Multiple entitlements + `linkedEntitlementIds` + `residualOfEntitlementId` + warnings                                 |

### 2.1 Pattern F: Chained Constructs — Detailed Analysis

**Real-World Example (Houston/DAL/PHX/BKN style):**

> "Team A receives the most favorable of (Pick X, Pick Y)
> AND has the right to swap its own pick with the _remaining_ least favorable."

This requires:

1. A `conveyance_right` selecting best-of from a pool
2. A `swap_right` where the swap target is the _residual_ of the conveyance

**Current Support Level:** ✅ **Fully Supported** (after E1)

| Capability                   | Status | Notes                                                                             |
| ---------------------------- | ------ | --------------------------------------------------------------------------------- |
| Create separate entitlements | ✅     | Can create one conveyance_right + one swap_right                                  |
| Link them semantically       | ✅     | `linkedEntitlementIds` and `residualOfEntitlementId` fields declare the linkage   |
| Validate linked constraints  | ✅     | W1 warning emitted if linked entitlements not all included in trade               |
| Trade as unit                | ✅     | Warning prompts user if linked entitlements missing; visual indicators in list    |
| UI representation            | ✅     | Link2 icon + count shown in EntitlementPickRow; GitBranch icon for residual swaps |

**What's Implemented:**

1. `linkedEntitlementIds?: string[]` — Declares related entitlements that form a package
2. `residualOfEntitlementId?: string` — Declares that this swap targets the residual of a conveyance
3. W1 warning — "This pick right is linked to other pick rights not included in the trade."
4. W2 warning — "This swap uses a controller pick that is also being moved in this trade."
5. UI indicators — Link icon with count, GitBranch icon for residual entitlements

---

## 3. Advanced Editor Capability Audit

### 3.1 Tab Coverage Matrix

| Tab                   | Fields Covered                                                                                                                                      | Editable Status                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Basics**            | id (read-only), holderTeam, seasonYear, round, kind, description, underlyingPickId, underlyingStatus, linkedEntitlementIds, coveredByEntitlementIds | ✅ All editable (except id)         |
| **Protection Ladder** | protectionLadder[].year/condition/ifTriggered/rollToYear/convertToRound                                                                             | ✅ Full array editor with templates |
| **Swap**              | swapType, swapControllerPickId, swapTargetDefinition, poolUnderlyingPickIds, residualOfEntitlementId                                                | ✅ All editable                     |
| **Conveyance**        | poolUnderlyingPickIds, receivesRank, receivesComparator                                                                                             | ✅ All editable                     |
| **Advanced**          | Full JSON document                                                                                                                                  | ✅ All fields via JSON              |

### 3.2 Field Editability Checklist

| Field                   | UI Tab                    | JSON                | Status                   |
| ----------------------- | ------------------------- | ------------------- | ------------------------ |
| id                      | Read-only                 | Locked in edit mode | ✅ Intentionally locked  |
| holderTeam              | Basics                    | Locked in edit mode | ⚠️ Identity field locked |
| seasonYear              | Basics                    | Locked in edit mode | ⚠️ Identity field locked |
| round                   | Basics (dropdown)         | Locked in edit mode | ⚠️ Identity field locked |
| kind                    | Basics (dropdown)         | Locked in edit mode | ⚠️ Identity field locked |
| description             | Basics                    | ✅                  | ✅ Editable              |
| underlyingPickId        | Basics                    | Locked in edit mode | ⚠️ Identity field locked |
| underlyingStatus        | Basics (dropdown)         | ✅                  | ✅ Editable              |
| protectionLadder        | Protection tab            | ✅                  | ✅ Editable              |
| swapControllerPickId    | Swap tab                  | Locked in edit mode | ⚠️ Identity field locked |
| swapTargetDefinition    | Swap tab                  | ✅                  | ✅ Editable              |
| swapType                | Swap tab (dropdown)       | ✅                  | ✅ Editable              |
| poolUnderlyingPickIds   | Swap/Conveyance tabs      | ✅                  | ✅ Editable              |
| receivesRank            | Conveyance tab            | ✅                  | ✅ Editable              |
| receivesComparator      | Conveyance tab (dropdown) | ✅                  | ✅ Editable              |
| linkedEntitlementIds    | Basics tab (textarea)     | ✅                  | ✅ Editable (E1)         |
| residualOfEntitlementId | Swap tab (input)          | ✅                  | ✅ Editable (E1)         |
| coveredByEntitlementIds | Basics tab (textarea)     | ✅                  | ✅ Editable (E1)         |
| evidenceRowRefs         | ❌ No UI                  | ✅ via JSON         | ⚠️ JSON only             |
| sourceUrl               | ❌ No UI                  | ✅ via JSON         | ⚠️ JSON only             |

### 3.3 Identity Lock Behavior

**When editing an existing entitlement:**

- Identity fields are locked in the tab UI
- Identity fields are also locked in Advanced JSON tab (stripped if changed)
- User sees warning: "Identity fields are locked in edit mode. To change identity, use Duplicate as new."

**IDENTITY_FIELDS constant (from `EntitlementEditorAdvancedTab.tsx`):**

```typescript
const IDENTITY_FIELDS = [
  'holderTeam',
  'kind',
  'seasonYear',
  'round',
  'underlyingPickId',
  'swapControllerPickId',
] as const;
```

**Workaround Path:** "Duplicate as new" → creates new entitlement with modified identity → user manually removes old entitlement from team's `entitlementIds[]`

### 3.4 Coverage Summary

| Category                         | Count | Percentage |
| -------------------------------- | ----- | ---------- |
| ✅ Fully editable via UI         | 18    | 90%        |
| ⚠️ Editable only via JSON        | 2     | 10%        |
| ⚠️ Identity locked (intentional) | 6     | —          |
| ❌ No path to edit               | 0     | 0%         |

---

## 4. Trade Execution Truth: Single Source of Ownership

### 4.1 The Question

> When an entitlement is traded, what determines ownership _today_?

### 4.2 The Answer: `entitlementIds[]` is the SSOT

**Ownership is determined by `team.entitlementIds[]` membership, NOT by `holderTeam` on the entitlement document.**

#### Evidence from Code

1. **Resolver reads from `entitlementIds[]`** ([entitlementResolver.ts#L113-L140](src/features/architect/utils/entitlements/entitlementResolver.ts#L113-L140)):

```typescript
const resolveTeamEntitlementIds = async (db, worldId, teamCode) => {
  // World mode: read from architect_worlds/{worldId}/teams/{teamCode}.entitlementIds
  // Base mode: read from architect_baseTeams/{teamCode}.entitlementIds
  return Array.isArray(data.entitlementIds) ? data.entitlementIds : [];
};
```

1. **Trade execution updates `entitlementIds[]`** ([TradeEditor.jsx#L390-L400](src/features/architect/tradeMachine/TradeEditor.jsx#L390-L400)):

```javascript
// Vacuum mode: applyVacuumTransfer records entitlement moves in localStorage
for (const ent of outgoing) {
  applyVacuumTransfer(entId, fromTeam, toTeam);
}
```

1. **Vacuum overlay applies transfers** ([entitlementResolver.ts#L225-L260](src/features/architect/utils/entitlements/entitlementResolver.ts#L225-L260)):

```typescript
// Remove transferred-out entitlements
for (let i = resolved.length - 1; i >= 0; i--) {
  if (outSet.has(resolved[i].id)) {
    resolved.splice(i, 1);
  }
}
// Add transferred-in entitlements
for (const doc of incomingDocs) {
  resolved.push({
    ...doc,
    holderTeam: teamCode, // Patch holderTeam to reflect new owner
  });
}
```

### 4.3 `holderTeam` vs `entitlementIds[]` Usage Matrix

| System Component                   | Reads `holderTeam`  | Reads `entitlementIds[]`           | Purpose                                      |
| ---------------------------------- | ------------------- | ---------------------------------- | -------------------------------------------- |
| `entitlementResolver.ts`           | ❌                  | ✅                                 | Determines which entitlements belong to team |
| `useTradeMachine.js`               | Display only        | ✅ (indirectly via resolver)       | Trade setup                                  |
| `validateEntitlementRouting.js`    | ❌                  | ✅ (from resolved list)            | Ownership validation                         |
| `validateStepien.js`               | ❌                  | ✅ (from `validationEntitlements`) | Stepien check                                |
| `EntitlementPickRow.jsx`           | ✅ (display)        | ❌                                 | UI tooltip                                   |
| `TradeExportCapture.jsx`           | ✅ (display)        | ❌                                 | Receipt display                              |
| `vacuumEntitlementOverlayStore.ts` | Patches on transfer | Manages transfers                  | Sandbox mode                                 |

### 4.4 Correctness Matrix: What Must Be Updated

| Operation                | `entitlementIds[]` | `holderTeam`                  | Notes                          |
| ------------------------ | ------------------ | ----------------------------- | ------------------------------ |
| Trade execution (world)  | ✅ Updated         | ✅ Patched via world override | Both for consistency           |
| Trade execution (vacuum) | ✅ Via transfers   | ✅ Patched at resolve time    | `holderTeam` patched in memory |
| UI display               | N/A                | Read for display              | Display only                   |
| Receipt/Export           | N/A                | Read for display              | Display only                   |
| Validation               | Reads indirectly   | N/A                           | Via resolved list              |

### 4.5 Single Source of Truth Statement

> **`team.entitlementIds[]` is the single source of truth for entitlement ownership.**
>
> `holderTeam` on the entitlement document is a **display convenience field** — it is patched for correctness after trades, but the resolver determines ownership solely by `entitlementIds[]` membership.
>
> This design allows the same base entitlement document to be "owned" by different teams in different worlds or sessions without modifying the base document.

---

## 5. Gap List + Minimal Fix Options

### Gap 1: Chained/Linked Entitlement Constructs ✅ RESOLVED (E1)

**Problem:** Houston-style "best-of pool + swap with residual" patterns cannot be represented as a linked unit.

**Resolution:** Option 1B + 1C implemented — Added `linkedEntitlementIds?: string[]` and `residualOfEntitlementId?: string` fields.

### Gap 2: `coveredByEntitlementIds` Not Editable in UI ✅ RESOLVED (E1)

**Problem:** Linking pick_ownership to covering swap_rights requires JSON editing.

**Resolution:** Option 2A implemented — Added textarea in Basics tab for `coveredByEntitlementIds`.

### Gap 3: No "Trade as Package" Feature ✅ RESOLVED (E1)

**Problem:** Linked entitlements must be manually selected together for trades.

**Resolution:** Option 3A implemented — W1 warning emitted in `entitlementWarnings.js` when linked entitlements not all included.

### Gap 4: No Cross-Entitlement Conflict Validation ✅ RESOLVED (E1)

**Problem:** Trading a `swap_right` whose underlying pick is also being traded produces no warning.

**Resolution:** Option 4A implemented — W2 warning emitted when swap_right's `swapControllerPickId` matches another outgoing `underlyingPickId`.

---

## 6. E1 Execution Punchlist ✅ COMPLETE

### Phase 1: Schema + Validation ✅ COMPLETE

| ID     | Task                                             | File(s)                                                            | Status                    |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------ | ------------------------- |
| E1-1.1 | Add `linkedEntitlementIds?: string[]` to schema  | `src/schemas/architect.ts`                                         | ✅ Implemented            |
| E1-1.2 | Add `residualOfEntitlementId?: string` to schema | `src/schemas/architect.ts`                                         | ✅ Implemented            |
| E1-1.3 | Add cross-entitlement conflict validation        | `src/features/architect/tradeMachine/utils/entitlementWarnings.js` | ✅ W2 warning implemented |
| E1-1.4 | Add linked-entitlement warning                   | `src/features/architect/tradeMachine/utils/entitlementWarnings.js` | ✅ W1 warning implemented |

### Phase 2: Editor UI ✅ COMPLETE

| ID     | Task                                           | File(s)                          | Status                  |
| ------ | ---------------------------------------------- | -------------------------------- | ----------------------- |
| E1-2.1 | Add `linkedEntitlementIds` UI to Basics tab    | `EntitlementEditorBasicsTab.tsx` | ✅ Textarea implemented |
| E1-2.2 | Add `residualOfEntitlementId` UI to Swap tab   | `EntitlementEditorSwapTab.tsx`   | ✅ Input implemented    |
| E1-2.3 | Add `coveredByEntitlementIds` UI to Basics tab | `EntitlementEditorBasicsTab.tsx` | ✅ Textarea implemented |

### Phase 3: Trade Display ✅ COMPLETE

| ID     | Task                              | File(s)                  | Status                            |
| ------ | --------------------------------- | ------------------------ | --------------------------------- |
| E1-3.1 | Add linked indicator in list view | `EntitlementPickRow.jsx` | ✅ Link2 icon + count implemented |
| E1-3.2 | Add residual indicator            | `EntitlementPickRow.jsx` | ✅ GitBranch icon implemented     |

### Phase 4: Documentation ✅ COMPLETE

| ID     | Task                           | File(s)       | Status                       |
| ------ | ------------------------------ | ------------- | ---------------------------- |
| E1-4.1 | Add chained construct examples | This document | ✅ See §7 and §8 below       |
| E1-4.2 | Add authoring guidance         | This document | ✅ See §8 Authoring Guidance |

---

## 7. Example: Houston-Style Chained Construct (Post-E1)

After E1 implementation, a Houston-style "best of DAL/PHX/BKN + swap with residual" would be represented as:

**Entitlement 1: Conveyance Right (Best of Pool)**

```json
{
  "id": "ent:HOU:2026:1:conv:best_of_dal_phx_bkn",
  "holderTeam": "HOU",
  "seasonYear": 2026,
  "round": 1,
  "kind": "conveyance_right",
  "poolUnderlyingPickIds": ["DAL_2026_1st", "PHX_2026_1st", "BKN_2026_1st"],
  "receivesRank": [1],
  "receivesComparator": "more_favorable",
  "linkedEntitlementIds": ["ent:HOU:2026:1:swap:residual"]
}
```

**Entitlement 2: Swap Right (With Residual)**

```json
{
  "id": "ent:HOU:2026:1:swap:residual",
  "holderTeam": "HOU",
  "seasonYear": 2026,
  "round": 1,
  "kind": "swap_right",
  "swapControllerPickId": "HOU_2026_1st",
  "swapTargetDefinition": "Residual of best-of DAL/PHX/BKN (least favorable of remaining 2)",
  "swapType": "best_of",
  "linkedEntitlementIds": ["ent:HOU:2026:1:conv:best_of_dal_phx_bkn"],
  "residualOfEntitlementId": "ent:HOU:2026:1:conv:best_of_dal_phx_bkn"
}
```

---

## 8. Authoring Guidance: When to Use Linkage Fields

### When to Use `linkedEntitlementIds`

Use `linkedEntitlementIds` when:

1. **Multiple entitlements form a single deal** — e.g., a conveyance right and a swap right that must be traded together
2. **Display grouping is important** — you want users to see these entitlements are related
3. **Trade completeness validation** — you want W1 warning if only some are included in a trade

**Best Practice:** List all related entitlements in each one's `linkedEntitlementIds`. This creates bidirectional awareness.

```javascript
// Entitlement A
linkedEntitlementIds: ['ent_B', 'ent_C'];

// Entitlement B
linkedEntitlementIds: ['ent_A', 'ent_C'];

// Entitlement C
linkedEntitlementIds: ['ent_A', 'ent_B'];
```

### When to Use `residualOfEntitlementId`

Use `residualOfEntitlementId` only when:

1. **A swap_right targets the "leftover" of a conveyance_right** — the swap gives you the pick(s) NOT selected by the conveyance
2. **The target is semantically dependent on another entitlement's outcome** — e.g., "swap with the remaining least favorable"

**Example:** Houston receives the BEST of (DAL, PHX, BKN). Houston also has a swap right that lets them swap their own pick with the WORST of the remaining two. The swap_right's `residualOfEntitlementId` points to the conveyance_right.

### Difference Between the Two

| Field                     | Relationship Type  | Use Case                                             |
| ------------------------- | ------------------ | ---------------------------------------------------- |
| `linkedEntitlementIds`    | Peer-to-peer (N:N) | "These entitlements are part of the same package"    |
| `residualOfEntitlementId` | Dependent (1:1)    | "This entitlement targets what's LEFT from that one" |

### Common Patterns

**Pattern A: Simple Pool + Residual Swap (Houston-style)**

```
Entitlement 1: conveyance_right (best of 3)
  linkedEntitlementIds: [entitlement_2]

Entitlement 2: swap_right (with residual)
  linkedEntitlementIds: [entitlement_1]
  residualOfEntitlementId: entitlement_1
```

**Pattern B: Protection Ladder with Swap Option**

```
Entitlement 1: pick_ownership (protected)
  coveredByEntitlementIds: [entitlement_2]

Entitlement 2: swap_right (covers the protected pick)
  linkedEntitlementIds: [entitlement_1]
```

---

## Appendix A: File Reference Map

| File                                                                         | Purpose                              | Entitlement Role                            |
| ---------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------- |
| `src/schemas/architect.ts`                                                   | Zod schema definitions               | `EntitlementAssetZ` defines canonical shape |
| `src/features/architect/utils/entitlements/entitlementResolver.ts`           | Merge base + world + vacuum overlays | Ownership resolution                        |
| `src/features/architect/utils/entitlements/entitlementWriter.ts`             | Write world overrides                | Validation, persistence                     |
| `src/features/architect/utils/entitlements/entitlementTerms.ts`              | Normalize terms for display          | Trade payload decoration                    |
| `src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts` | Sandbox mode persistence             | localStorage overlay                        |
| `src/features/architect/tradeMachine/utils/entitlementWarnings.js`           | Trade warnings                       | Encumbered/linked warnings                  |
| `src/features/architect/admin/EntitlementEditorModal.tsx`                    | Editor modal container               | Full authoring UI                           |
| `src/features/architect/admin/EntitlementEditorFormTabs.tsx`                 | Tab router                           | Routes to tab components                    |
| `src/features/architect/admin/entitlementEditorFormState.ts`                 | Form state helpers                   | Build/serialize documents                   |

---

## Appendix B: Validation Invariants by Kind

### pick_ownership

- **Required:** `underlyingPickId`
- **Invariant:** `underlyingPickId` must be unique per `(seasonYear, round)` tuple
- **Warning:** If `underlyingStatus === 'encumbered'`, linked swap_right should be in same trade

### swap_right

- **Required:** `swapControllerPickId`, `swapTargetDefinition`
- **Invariant:** One swap_right per controller pick per year
- **Warning:** If `swapControllerPickId` matches another outgoing `underlyingPickId`, emit conflict warning

### conveyance_right

- **Required:** `poolUnderlyingPickIds[]` (min 2), `receivesRank[]`, `receivesComparator`
- **Invariant:** `receivesRank` values must be within pool size bounds
- **Warning:** Stepien conservative — reserves years for all pool picks until resolved

---

## Review Findings (2026-02-19 Preflight)

**Return Package:** `return_packages/entitlements/PICKS_ENTITLEMENTS_EDIT_REVIEW_PREFLIGHT.md`

### Summary

A full preflight audit of the entitlement editor's "alter" actions (protections, swaps, linkages) was performed covering UI behavior, state mutations, persistence, rehydration, and downstream consumer stability.

### Bugs Found

| #   | Severity        | Title                                                                                                                                                                 | Status         |
| --- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1   | **P0/Critical** | `wizardToFormState()` missing 3 required fields (`linkedEntitlementIdsText`, `residualOfEntitlementId`, `coveredByEntitlementIdsText`) → runtime crash on wizard save | **FIXED** (E1) |
| 2   | **P1/High**     | `setDoc merge:true` field ghosts — clearing protections/swap/linkage on existing entitlements doesn't delete old data                                                 | **FIXED** (E1) |
| 3   | **P1/High**     | Vacuum overlay deep-merge has same ghost problem for edit patches                                                                                                     | **FIXED** (E1) |
| 4   | **P2/Low**      | `swapType` field missing from Zod `EntitlementAssetZ` schema                                                                                                          | **FIXED** (E1) |
| 5   | **P3/Low**      | `source` field on protection tiers dropped during editor round-trip                                                                                                   | **FIXED** (E1) |

### Verdicts

| Category                         | Verdict                       |
| -------------------------------- | ----------------------------- |
| Protections UI (Advanced Editor) | PASS                          |
| Protections UI (Wizard)          | **PASS** (BUG #1 fixed in E1) |
| Protections persistence + reload | **PASS** (BUG #2 fixed in E1) |
| Swap UI (Advanced Editor)        | PASS                          |
| Swap UI (Wizard)                 | **PASS** (BUG #1 fixed in E1) |
| Swap persistence + reload        | **PASS** (BUG #2 fixed in E1) |
| Linkage UI                       | PASS                          |
| Linkage persistence + reload     | **PASS** (BUG #2 fixed in E1) |
| Downstream consumers stable      | PASS                          |

---

## E1 Execution: Wizard Save + Clear/Delete Semantics

**Date:** 2026-02-20  
**Return Package:** `return_packages/entitlements/PICKS_ENTITLEMENTS_EDIT_REVIEW_EXECUTION_E1.md`

### New Invariants

1. **Clearing fields truly deletes them in world mode.** `writeWorldEntitlement()` applies `deleteField()` for every clearable field absent from the document payload when using `merge: true`. Clearable fields:
   - `protectionLadder`, `poolUnderlyingPickIds`, `receivesRank`, `receivesComparator`
   - `linkedEntitlementIds`, `coveredByEntitlementIds`, `residualOfEntitlementId`
   - `swapType`, `swapControllerPickId`, `swapTargetDefinition`
   - `description`, `underlyingPickId`, `underlyingStatus`

2. **Clearing fields truly deletes them in vacuum mode.** `applyVacuumEdit()` stores full documents with `null` sentinels for cleared fields. `deepMerge()` treats `null` as "delete this key from merged result."

3. **Wizard saves produce complete form states.** `wizardToFormState()` returns all 22 fields of `EntitlementFormState`.

4. **`swapType` is schema-validated.** Zod rejects invalid swap type values.

5. **Protection tier `source` metadata survives editor round-trips.** Carried through `createEntitlementFormState()` and `buildEntitlementDocument()`.

---

## E1.2 Execution: Wizard → Advanced Editor Handoff

**Date:** 2026-02-20  
**Return Package:** `return_packages/entitlements/PICK_WIZARD_ADVANCED_HANDOFF_EXECUTION_E1_2.md`

### Summary

Implemented reliable handoff from Pick Right Wizard to `EntitlementEditorModal` ensuring the "Advanced" button opens with the **current** wizard form state, not a stale snapshot.

### New Invariants

1. **Advanced opens with current wizard formState converted via `buildEntitlementDocument`.** The wizard's `handleOpenAdvanced` callback passes the live `formState` (from React state), and `TradeEditor.jsx` converts it to a document using `buildEntitlementDocument(formState)` before passing to `EntitlementEditorModal`.

2. **No stale snapshot usage.** The handler never uses `entitlementEditorState.initialDocument` (the document from when the wizard opened). It always uses the current formState.

3. **Edit mode preserves entitlementId.** When editing an existing entitlement, the wizard context's `entitlementId` is passed through to `EntitlementEditorModal`, preventing accidental "fork-create" behavior.

4. **Vacuum mode is blocked with toast.** Opening Advanced in vacuum mode shows: "Advanced editor requires saving to a world first" and does not open the modal.

5. **Conversion failures show toast.** `buildEntitlementDocument(formState)` is wrapped in try/catch. On error: "Unable to open Advanced editor: {message}".

### Files Changed

| File                                                          | Change                                                               |
| ------------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/features/architect/tradeMachine/TradeEditor.jsx`         | Added try/catch wrapper around `buildEntitlementDocument(formState)` |
| `src/tests/architect/pickRightWizard.test.tsx`                | Added test for current formState flow                                |
| `src/tests/architect/advancedEditorHandoff.test.ts`           | Created 7 new tests covering handoff scenarios                       |
| `src/features/architect/admin/EntitlementEditorSwapTab.tsx`   | Fixed truncated file (pre-existing bug)                              |
| `src/features/architect/admin/EntitlementEditorBasicsTab.tsx` | Fixed truncated file (pre-existing bug)                              |

### Test Coverage

- **New tests:** 8 total (1 component test, 7 unit tests)
- **Build:** Passes
- **Pre-existing failures:** 11 tests in pickRightWizard/wizardTranslation (unrelated)

---

## Naming: Entitlement Editor (Simple/Advanced)

**Date:** 2026-02-20  
**Ticket:** TM-ENTITLEMENT-NAMING-UNIFY

### Overview

The entitlement editing UI is presented to users as **one editor** with two levels of complexity:

1. **Entitlement Editor (Simple)** — The default view when creating or editing entitlements. Features a streamlined single-screen UI with preset protection templates and swap configuration. Formerly referred to as "Pick Right Wizard" or "Quick Builder" in internal documentation.

2. **Entitlement Editor (Advanced)** — The expanded tabbed view with access to all fields including JSON editing. Accessed via the "Advanced" button in the Simple view.

### UX Model

| User Action                            | Opens                         |
| -------------------------------------- | ----------------------------- |
| Click "New Entitlement" button         | Entitlement Editor (Simple)   |
| Click row to edit existing entitlement | Entitlement Editor (Simple)   |
| Click "Advanced" in Simple view        | Entitlement Editor (Advanced) |

### Key Principles

1. **One editor, two levels.** Users should perceive a single tool that can expand for power-user needs.

2. **Simple is the default.** Most users never need to access Advanced view for common operations (protections, swaps).

3. **No "Wizard" language in UI.** The term "wizard" was removed from all user-facing strings to avoid confusion with multi-step flows. The modal title is always "Entitlement Editor".

4. **Create vs Edit is a mode, not a separate tool.** The same editor opens for both operations, with appropriate field locking in edit mode.

### UI Text Standards

| Element                          | Text                                              |
| -------------------------------- | ------------------------------------------------- |
| Modal title                      | `Entitlement Editor`                              |
| Create button                    | `New Entitlement`                                 |
| Advanced toggle (in Simple view) | `Advanced`                                        |
| Advanced modal title             | `Entitlement Editor (Advanced)`                   |
| Pool redirect message            | "Pool editing is available in the Advanced view." |

### Files Implementing This Model

| File                                | Role                       |
| ----------------------------------- | -------------------------- |
| `PickRightWizardModal.tsx`          | Unified modal (both views) |
| `QuickBuilder.tsx`                  | Simple view content        |
| `EntitlementEditorFormTabs.tsx`     | Advanced view content      |
| `EntitlementEditorCreateButton.tsx` | "New Entitlement" button   |

---

## 8. Unified Entitlement Editor: Simple/Advanced Views

**Added:** 2026-02-20 (Entitlement Editor Unification)

### Overview

The Entitlement Editor is **ONE thing** with two views:

- **Simple view** (default): QuickBuilder controls — templates, Protect/Swap toggles
- **Advanced view** (expanded): full tabbed editor with Basics, Protection, Swap, Conveyance, and JSON tabs

Both views share a single session state and a single save function. The Advanced button is an inline toggle pill in the modal header — not a separate modal.

### Invariants (Non-Negotiable)

#### R1 — One Editor, One Working State

- There is a single "current entitlement being edited" state managed by `useEntitlementEditorSession`.
- Switching Simple → Advanced and back does not lose changes.
- The Advanced view opens showing the latest Simple view edits immediately.

#### R2 — One Save Semantics (Context-Agnostic)

- Clicking **Apply** in either view calls `saveEntitlementFromFormState()`.
- The editor works in all contexts: vacuum mode (localStorage overlay) and world mode (Firestore).
- `storageMode` is the only routing discriminator — not the UI view.

#### R3 — Context Is Implementation Detail

- No user-facing language implies different tools or modes.
- No "Advanced requires world" behavior.
- The `storageMode` ('vacuum' | 'world') is internal to the session hook.

### Architecture

```
useEntitlementEditorSession (Hook)
├── formState: EntitlementFormState    ← canonical shared state
├── wizardModel: WizardModel           ← simple view helper
├── openView: 'simple' | 'advanced'   ← view toggle
├── storageMode: 'vacuum' | 'world'   ← internal routing
└── handleApply()
    └── saveEntitlementFromFormState()
        ├── vacuum: applyVacuumEdit / applyVacuumCreate
        └── world:  writeWorldEntitlement (Firestore)
```

### Key Files

| File                                                           | Purpose                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/features/architect/admin/useEntitlementEditorSession.ts`  | Shared session hook — owns formState, validation, view toggle, save |
| `src/features/architect/admin/saveEntitlementFromFormState.ts` | Unified save function — routes vacuum vs world                      |
| `src/features/architect/admin/PickRightWizardModal.tsx`        | Unified modal container — renders either Simple or Advanced view    |
| `src/tests/architect/entitlementEditorUnification.test.ts`     | Tests for state continuity, save routing, round-trip                |

---

## 9. Deduplication & Deterministic Identity

**Added:** 2026-02-20 (Entitlement Dedupe Prevention)

### Overview

The entitlement system uses **deterministic identity** to prevent duplicate creation. Same logical entitlement → same ID → upsert instead of duplicate.

### Identity Key Definition

Each entitlement has an **identity key** that uniquely identifies the logical entitlement based on its core fields. Identity keys are computed by `getEntitlementIdentityKey()` in [`entitlementIdentity.ts`](src/features/architect/utils/entitlements/entitlementIdentity.ts).

#### Format by Kind

| Kind               | Identity Key Format                                                             | Example                                            |
| ------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------- |
| `pick_ownership`   | `own\|{TEAM}\|{YEAR}\|{ROUND}\|{underlyingPickId}`                              | `own\|LAL\|2026\|1\|lal_2026_1st`                  |
| `swap_right`       | `swap\|{TEAM}\|{YEAR}\|{ROUND}\|{swapControllerPickId}\|{swapTargetDefinition}` | `swap\|BOS\|2027\|1\|bos_2027_1st\|boston_own_1st` |
| `conveyance_right` | `conv\|{TEAM}\|{YEAR}\|{ROUND}\|{sortedPoolIds}\|{comparator}\|{sortedRanks}`   | `conv\|MIA\|2028\|1\|a+b+c\|more_favorable\|1+2`   |

#### Normalization Rules

- **Team codes**: Uppercase, trimmed
- **Numbers**: Parsed to integers
- **String fields**: Lowercase, trimmed, spaces → underscores
- **Arrays**: Sorted before joining (order-independent identity)

### Which Kinds Are Covered

| Kind               | Full Dedupe | Notes                                  |
| ------------------ | ----------- | -------------------------------------- |
| `pick_ownership`   | ✅ Yes      | underlyingPickId is identity anchor    |
| `swap_right`       | ✅ Yes      | swapControllerPickId + target are both |
| `conveyance_right` | ✅ Yes      | Pool + comparator + ranks are identity |

### Upsert Behavior Guarantee

**Create operations use deterministic IDs:**

```typescript
// World creates:
const id = getEntitlementDeterministicId(document);
// Format: ent:{TEAM}:{YEAR}:{ROUND}:{kindShort}:{hash8}

// Vacuum creates:
const id = getVacuumDeterministicId(document);
// Format: vacuum:{TEAM}:{YEAR}:{ROUND}:{kindShort}:{hash8}
```

**Upsert semantics:**

- Creating the "same" entitlement twice produces only one record (same ID)
- World mode: `setDoc()` with deterministic ID overwrites existing
- Vacuum mode: `creates[deterministicId] = document` overwrites existing

### Double-Submit Protection

`handleApply()` in `useEntitlementEditorSession.ts` guards against rapid clicks:

```typescript
if (saving) return; // Ignore if already saving
setSaving(true);
// ... save logic
setSaving(false);
```

### Key Files

| File                                                                         | Purpose                            |
| ---------------------------------------------------------------------------- | ---------------------------------- |
| `src/features/architect/utils/entitlements/entitlementIdentity.ts`           | Identity computation utilities     |
| `src/features/architect/admin/saveEntitlementFromFormState.ts`               | Uses deterministic IDs for creates |
| `src/features/architect/admin/useEntitlementEditorSession.ts`                | Double-submit guard                |
| `src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts` | Keyed creates for natural dedupe   |
| `src/tests/architect/entitlementDedupe.test.ts`                              | 18 tests for identity and dedupe   |

### Limitations

1. **Legacy duplicates**: Entitlements created before this fix may have random IDs — not automatically detected/merged
2. **Free-text variance**: Different descriptions of same swap target produce different identity keys
3. **Intentional duplicates**: No explicit "allow duplicate" path for rare edge cases
4. **Cross-doc references**: If other entitlements reference a moved ID via `linkedEntitlementIds` or `coveredByEntitlementIds`, those references become stale. A future "reference updater" pass can address this.

---

### 9.5 Identity-Change on Edit: Move Semantics

**Added:** 2026-02-20 (Entitlement Identity-Change Dedupe)

#### Problem

When a user edits **identity fields** (holderTeam, seasonYear, round, kind, or kind-specific inputs like `underlyingPickId`) on an existing entitlement, the deterministic ID computation produces a **different ID**. Without intervention, the old record remains — creating an orphaned duplicate.

#### Rule

> **Edits that change identity move to the deterministic ID and delete the old record.**

One logical entitlement identity = one record, in both world (Firestore) and vacuum (overlay).

#### World Mode — Move

When `saveEntitlementFromFormState` detects `originalEntitlementId !== getEntitlementDeterministicId(document)` on an edit:

1. `moveWorldEntitlement()` writes the document to the new deterministic ID (upsert via `merge: true`)
2. Deletes the old document at `originalEntitlementId`
3. Updates `team.entitlementIds[]` — removes old, adds new

**Collision:** If the new ID already exists, `setDoc(merge: true)` cleanly overwrites it. The old ID is still deleted. At most one record per logical identity.

#### Vacuum Mode — Rekey

When editing a vacuum-created entitlement whose identity changed:

1. `rekeyVacuumCreate(teamCode, fromVacId, toVacId, document)` writes to new key, deletes old key
2. If `toVacId` already exists in `creates`, it is overwritten (latest wins)

When editing a base entitlement whose effective identity would collide with a vacuum create:

1. `resolveVacuumEditCollisions(teamCode, editDocument)` removes any vacuum create with the same identity key
2. Base-edit wins (canonical record)

#### UX

- Normal save: `toast.success('Entitlement saved')`
- Identity changed: `toast.success('Entitlement saved (identity updated)')`
- No confirmation dialogs or modals added

#### Key Files

| File                                                                         | Purpose                                                                            |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/features/architect/utils/entitlements/moveWorldEntitlement.ts`          | World move helper (write + delete + inventory)                                     |
| `src/features/architect/admin/saveEntitlementFromFormState.ts`               | Detect identity-change, route to move/rekey                                        |
| `src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts` | `rekeyVacuumCreate()`, `resolveVacuumEditCollisions()`, `dedupeVacuumByIdentity()` |
| `src/tests/architect/entitlementIdentityMove.test.ts`                        | 9 tests for move/rekey/collision                                                   |
