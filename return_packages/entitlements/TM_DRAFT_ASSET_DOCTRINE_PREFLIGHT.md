# TM-DRAFT-ASSET-DOCTRINE — Entitlement Lifecycle + Outcome Exclusivity Preflight

**Date:** 2026-02-20  
**Mode:** PREFLIGHT (discovery only — no code changes)  
**Scope:** Entitlement identity, lifecycle, naming, and outcome exclusivity doctrine

---

## Preflight Questions — Answers with Citations

### Q1. What is the single current choke point for entitlement save/write?

**There is no single choke point.** There are **10 distinct write entry points** across 3 storage modes:

| #   | Entry Point                                                         | File                                                                                                                | Line           | Target                                                       |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------ |
| 1   | `saveEntitlementFromFormState()`                                    | [saveEntitlementFromFormState.ts](src/features/architect/admin/saveEntitlementFromFormState.ts#L74)                 | L74            | Router: dispatches to vacuum OR world writes                 |
| 2   | `writeWorldEntitlement()`                                           | [entitlementWriter.ts](src/features/architect/utils/entitlements/entitlementWriter.ts#L340)                         | L340           | Firestore `architect_worlds/{worldId}/entitlements/{id}`     |
| 3   | `deleteWorldEntitlement()`                                          | [entitlementWriter.ts](src/features/architect/utils/entitlements/entitlementWriter.ts#L417)                         | L417           | Firestore delete                                             |
| 4   | `moveWorldEntitlement()`                                            | [moveWorldEntitlement.ts](src/features/architect/utils/entitlements/moveWorldEntitlement.ts#L78)                    | L78            | Atomic move: write new → delete old → re-link team           |
| 5   | `attachEntitlementToTeam()` / `detachEntitlementFromTeam()`         | [entitlementWriter.ts](src/features/architect/utils/entitlements/entitlementWriter.ts#L449)                         | L449/L498      | Firestore team `entitlementIds[]` array                      |
| 6   | `applyVacuumEdit()` / `applyVacuumCreate()` / `rekeyVacuumCreate()` | [vacuumEntitlementOverlayStore.ts](src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts#L167) | L167/L192/L407 | localStorage overlay                                         |
| 7   | `applyVacuumTransfer()`                                             | [vacuumEntitlementOverlayStore.ts](src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts#L333) | L333           | localStorage transfer records                                |
| 8   | Trade execution (vacuum mode)                                       | [TradeEditor.jsx](src/features/architect/tradeMachine/TradeEditor.jsx#L449)                                         | L449           | Calls `applyVacuumTransfer()` per entitlement                |
| 9   | Trade execution (world mode)                                        | [mutationPipeline.js](src/features/architect/utils/mutationPipeline.js#L2488)                                       | L2488          | `batch.set(entitlementRef, { holderTeam }, { merge: true })` |
| 10  | DARE resolver                                                       | [entitlementMutator.ts](src/features/architect/utils/entitlements/dare/entitlementMutator.ts#L55)                   | L55            | Batch upsert/delete for resolution outcomes                  |

**Additionally (offline/admin):**

- PST Phase 10 push: [pst_phase_10_push_base_entitlements.ts](team-scrape/draft-picks/scripts/pst/pst_phase_10_push_base_entitlements.ts#L100) → Seeds `architect_baseEntitlements/{id}`

**The UI save flow IS funneled through `saveEntitlementFromFormState()`** (entry #1), which is the closest thing to a choke point for user-authored writes. But trade execution and DARE bypass it entirely.

---

### Q2. What fields define an entitlement's identity today? Is there an `identityKey` persisted?

**Identity fields by kind** — defined in [entitlementIdentity.ts](src/features/architect/utils/entitlements/entitlementIdentity.ts#L134):

| Kind               | Identity Key Format                                                           | Fields                                                                            |
| ------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `pick_ownership`   | `own\|{TEAM}\|{YEAR}\|{ROUND}\|{underlyingPickId}`                            | `holderTeam`, `seasonYear`, `round`, `kind`, `underlyingPickId`                   |
| `swap_right`       | `swap\|{TEAM}\|{YEAR}\|{ROUND}\|{swapControllerPickId}\|{swapTargetDef}`      | + `swapControllerPickId`, `swapTargetDefinition` (normalized)                     |
| `conveyance_right` | `conv\|{TEAM}\|{YEAR}\|{ROUND}\|{sortedPoolIds}\|{comparator}\|{sortedRanks}` | + `poolUnderlyingPickIds` (sorted), `receivesComparator`, `receivesRank` (sorted) |

**Normalization rules** ([entitlementIdentity.ts#L66–L97](src/features/architect/utils/entitlements/entitlementIdentity.ts#L66)):

- Team codes → uppercase/trimmed
- Free-text fields → lowercase, strip punctuation, collapse whitespace to underscores
- Arrays → sorted before joining

**`identityKey` IS persisted** — stamped by `buildEntitlementDocument()` at [entitlementEditorFormState.ts#L242](src/features/architect/admin/entitlementEditorFormState.ts#L242):

```ts
document.identityKey = getEntitlementIdentityKey(document);
```

**Deterministic ID** (`ent:{TEAM}:{YEAR}:{ROUND}:{kindShort}:{8charHash}`) is generated by `getEntitlementDeterministicId()` at [entitlementIdentity.ts#L188](src/features/architect/utils/entitlements/entitlementIdentity.ts#L188) using a djb2 hash of the identity key.

**Legacy random IDs** still exist: `generateEntitlementId()` in [entitlementWriter.ts#L556](src/features/architect/utils/entitlements/entitlementWriter.ts#L556) and `makeVacuumEntitlementId()` in [vacuumEntitlementOverlayStore.ts#L283](src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts#L283) both use `Math.random()` — deprecated but still callable.

---

### Q3. How are entitlements displayed today? What is derived vs stored?

| Display Layer       | File                                                                                                                         | Line | Derived or Stored?                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------- |
| Primary label       | `formatEntitlementLabel()` in [formatEntitlement.js](src/features/architect/utils/entitlements/formatEntitlement.js#L60)     | L60  | **Derived** — uses `description` if available, else builds `"{year} {round} via {originalTeam} ({kind})"` |
| Kind badge/chip     | `getEntitlementKindTag()` in [formatEntitlement.js](src/features/architect/utils/entitlements/formatEntitlement.js#L18)      | L18  | **Derived** — maps kind → `{ label, colorClass }`                                                         |
| Terms short-line    | `formatEntitlementTermsShort()` in [entitlementTerms.ts](src/features/architect/utils/entitlements/entitlementTerms.ts#L244) | L244 | **Derived** — e.g. "Top 3 prot → 2027 1st", "Swap best (2026)"                                            |
| Terms model         | `normalizeEntitlementTerms()` in [entitlementTerms.ts](src/features/architect/utils/entitlements/entitlementTerms.ts#L115)   | L115 | **Derived** — structured `EntitlementTerms` from raw doc fields                                           |
| Trade decoration    | `decorateEntitlementForTrade()` in [entitlementTerms.ts](src/features/architect/utils/entitlements/entitlementTerms.ts#L318) | L318 | **Derived** — attaches `terms`, `termsShort`, `draftKey`                                                  |
| `description` field | stored on document                                                                                                           | —    | **Stored** — human-authored free-text, used as fallback label                                             |

**Key finding:** All display is derived at render time from stored document fields. The `description` field is the only stored display text; it is **not canonical** — the system can function without it. Labels are generated from structured fields.

---

### Q4. What validators currently exist?

#### 4a. Duplicate Identity

| Mechanism                                 | File                                                                                                                | Line | Scope                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------- |
| Save-time identity dedup (vacuum creates) | [saveEntitlementFromFormState.ts](src/features/architect/admin/saveEntitlementFromFormState.ts#L181)                | L181 | `findVacuumCreateByIdentityKey()` → rekey existing instead of duplicating                 |
| Edit collision resolve                    | [vacuumEntitlementOverlayStore.ts](src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts#L445) | L445 | `resolveVacuumEditCollisions()` — after editing base, delete colliding vacuum creates     |
| Batch dedupe safety net                   | [vacuumEntitlementOverlayStore.ts](src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts#L499) | L499 | `dedupeVacuumByIdentity()` — keeps last per identity key                                  |
| R5 resolver dedupe                        | [entitlementResolver.ts](src/features/architect/utils/entitlements/entitlementResolver.ts#L293)                     | L293 | Post-merge dedupe by `identityKey` with priority: vacuumEdited > vacuumSessionOnly > base |

#### 4b. Overlapping Claims on Same Underlying Pick

| Mechanism                | File                                                                                  | Line | Scope                                                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DARE conflict resolution | [dareResolver.ts](src/features/architect/utils/entitlements/dare/dareResolver.ts#L96) | L96  | `resolveConflicts()` — **runtime (resolver time)**, detects when multiple entitlements claim the same `claimKey` (pickId). Priority: `pick_ownership` (1) > `conveyance_right` (2) > `swap_right` (3). Losers → `outcome='unchanged', reason='conflict_lost'`. |

**Critically missing**: No pre-save or pre-trade overlapping-claim validation. Conflicts are only detected when DARE runs (post-lottery resolution). The system allows conflicting entitlements to coexist in inventory until resolution.

#### 4c. Swap/Conveyance Pool Conflicts

**No validator exists.** There is nothing checking whether two `conveyance_right` entitlements reference overlapping `poolUnderlyingPickIds` with conflicting `receivesRank` values at author time or trade time. DARE handles this at resolution time only ([dareResolver.ts#L96](src/features/architect/utils/entitlements/dare/dareResolver.ts#L96)).

#### 4d. Schema Validation

| Mechanism                  | File                                                                                                                           | Line | Scope                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---- | -------------------------------------------------------------------------------------------------------------------------- |
| Document schema validation | `validateEntitlementDocument()` in [entitlementWriter.ts](src/features/architect/utils/entitlements/entitlementWriter.ts#L115) | L115 | Validates required fields, kind-specific fields, protectionLadder structure, linkedEntitlementIds, residualOfEntitlementId |
| DARE input validation      | `validateDAREInput()` in [dareResolver.ts](src/features/architect/utils/entitlements/dare/dareResolver.ts#L539)                | L539 | Validates worldId, draftYear range, positionsMap, teams array                                                              |

#### 4e. Trade Entitlement Warnings

| Mechanism                                | File                                                                                           | Line | Scope                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| W1: Linked entitlements not all included | [entitlementWarnings.js](src/features/architect/tradeMachine/utils/entitlementWarnings.js#L85) | L85  | Warning (not blocking) if `linkedEntitlementIds` are partially included |

---

### Q5. Can the system currently compute outcome coverage?

#### 5a. Protection Ladder — ✅ YES (partially)

The system can compute protection coverage via:

- `buildProtectionLadder()` in [protectionLadderFactory.ts](src/features/architect/utils/entitlements/dare/protectionLadderFactory.ts#L57) (L57) — builds year-by-year tiers from pick rules or world overrides
- `resolveConveyanceForEntitlement()` in [conveyanceResolutionAdapter.ts](src/features/architect/utils/entitlements/dare/conveyanceResolutionAdapter.ts#L143) (L143) — evaluates protection trigger at a given position

**Data gap:** `condition` is a **free-text string** ("Top 3", "Lottery", etc.) — not a structured range. The system parses conditions heuristically:

- `parseProtectionCondition()` in protectionLadderFactory converts types like `top_n` + `protectedRange` → human-readable strings
- Conveyance resolution checks conditions against positions, but the matching logic for complex conditions (e.g., "Top 3 1st year, Top 1 2nd year") requires the ladder to be pre-expanded

#### 5b. Swap Rights — ✅ YES

- `resolveSwapForEntitlement()` in [swapResolutionAdapter.ts](src/features/architect/utils/entitlements/dare/swapResolutionAdapter.ts#L50) (L50) — determines best/worst from pool
- Swap graph + cycle detection in [swapGraph.ts](src/features/architect/utils/entitlements/dare/swapGraph.ts)

#### 5c. Conveyance Rights (more/less favorable) — ✅ YES

- `selectRankedPick()` in [conveyanceResolutionAdapter.ts](src/features/architect/utils/entitlements/dare/conveyanceResolutionAdapter.ts#L62) (L62) — selects from pool by comparator
- Pool picks + comparator + ranks are fully structured

#### 5d. What's Missing for Full Outcome Coverage

| Gap                                     | Severity | Detail                                                                                                                                                                   |
| --------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No structured protection range          | Medium   | `condition` is free-text string. Can't algorithmically compare "Top 3" vs "Top 5" overlap at author/trade time — only DARE resolution can do it heuristically at runtime |
| No pre-save exclusivity check           | High     | Two entitlements claiming the same pick can coexist until DARE runs                                                                                                      |
| No cross-team pick-slot accounting      | High     | Nothing verifies that across ALL teams, every physical slot is claimed by exactly one `pick_ownership` entitlement                                                       |
| No conveyance-pool partition validation | Medium   | Two conveyance rights with overlapping pools and conflicting ranks can be authored without warning                                                                       |

---

### Q6. Minimal Structured Schema Required for Outcome Coverage

To enable full algorithmic outcome-coverage computation, the protection condition field needs structured data:

```typescript
// Proposed structured protection condition (augments existing ProtectionLadderTier)
interface StructuredProtectionCondition {
  type: 'top_n' | 'lottery' | 'bottom_n' | 'range' | 'unprotected';
  protectedPositions?: number[]; // e.g., [1,2,3] for "Top 3"
  // OR
  protectedRange?: { min: number; max: number }; // e.g., { min: 1, max: 3 }
}

// Extended ProtectionLadderTier
interface ProtectionLadderTierV2 {
  year: number;
  condition: string; // Human-readable (retained for display)
  structuredCondition?: StructuredProtectionCondition; // Machine-readable
  ifTriggered: 'roll' | 'convert' | 'cancel';
  rollToYear?: number;
  convertToRound?: number;
  source?: string;
}
```

**Existing fields that are already sufficient:**

- `poolUnderlyingPickIds` — conveyance pool membership ✅
- `receivesRank` — conveyance rank selection ✅
- `receivesComparator` — conveyance direction ✅
- `swapControllerPickId` / `swapTargetDefinition` — swap targeting ✅
- `underlyingPickId` — ownership claim ✅
- `holderTeam` / `seasonYear` / `round` — scoping ✅
- `linkedEntitlementIds` / `residualOfEntitlementId` — chaining ✅

**Only missing piece for algorithmic coverage:** a `structuredCondition` field on protection ladder tiers so the system can numerically compare protection ranges across entitlements without heuristic string parsing.

---

### Q7. Where should the exclusivity validator live?

| Timing                    | Location                                        | Purpose                                                                     | Canonical?                       |
| ------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------- |
| **Save time**             | `saveEntitlementFromFormState()`                | Prevent authoring conflicting entitlements                                  | **Yes — first line of defense**  |
| **Resolver time** (DARE)  | `resolveConflicts()` in `dareResolver.ts`       | Resolve conflicts that slipped through (or were imported from base data)    | **Fallback — already exists**    |
| **Trade validation time** | New function alongside `entitlementWarnings.js` | Block trades that would create exclusivity violations on the receiving team | **Yes — second line of defense** |

**Recommendation:** The canonical exclusivity validator should be a **pure function** in `src/features/architect/utils/entitlements/` that is called at save time AND at trade validation time, with DARE's conflict resolution as the runtime safety net.

---

## A. Lifecycle Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     ENTITLEMENT LIFECYCLE                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────────┐       │
│  │  CREATE   │───▶│   EDIT   │───▶│   SAVE   │───▶│  PERSISTED STATE │       │
│  └──────────┘    └──────────┘    └──────────┘    └────────┬─────────┘       │
│       │               │               │                    │                 │
│  Pick Right      Wizard / Form   saveEntitlement-     Vacuum (localStorage) │
│  Wizard or       tabs modify    FromFormState()        or World (Firestore) │
│  Quick Builder   fields          routes to target                            │
│                                                           │                 │
│                                                           ▼                 │
│                                               ┌──────────────────┐          │
│                                               │     DISPLAY      │          │
│                                               └────────┬─────────┘          │
│                                                        │                    │
│                                          formatEntitlementLabel()            │
│                                          formatEntitlementTermsShort()       │
│                                          EntitlementPickRow.jsx              │
│                                                        │                    │
│                                                        ▼                    │
│                                               ┌──────────────────┐          │
│                                               │ TRADE SELECTION  │          │
│                                               └────────┬─────────┘          │
│                                                        │                    │
│                                          User adds entitlement to           │
│                                          trade package via UI               │
│                                                        │                    │
│                                                        ▼                    │
│                                               ┌──────────────────┐          │
│                                               │    TRANSFER      │          │
│                                               └────────┬─────────┘          │
│                                                        │                    │
│                                          Vacuum: applyVacuumTransfer()      │
│                                          World: mutationPipeline patch      │
│                                          holderTeam ownership changes        │
│                                                        │                    │
│                                                        ▼                    │
│                                               ┌──────────────────┐          │
│                                               │   RESOLUTION     │          │
│                                               │     (DARE)       │          │
│                                               └──────────────────┘          │
│                                                                              │
│                                          resolveAllDraftAssets()             │
│                                          Maps entitlement → physical slot   │
│                                          Applies protections, swaps,        │
│                                          conveyance, conflict resolution     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## B. Identity + Naming Doctrine

### B1. `identityKey` Spec Per Kind

The `identityKey` is the **canonical field** that defines logical equivalence. Defined in [entitlementIdentity.ts#L134](src/features/architect/utils/entitlements/entitlementIdentity.ts#L134).

| Kind               | Format                                                                   | Example                                                            |
| ------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `pick_ownership`   | `own\|{TEAM}\|{YEAR}\|{ROUND}\|{underlyingPickId}`                       | `own\|BOS\|2026\|1\|bos_2026_1st`                                  |
| `swap_right`       | `swap\|{TEAM}\|{YEAR}\|{ROUND}\|{swapControllerPickId}\|{swapTargetDef}` | `swap\|OKC\|2027\|1\|hou_2027_1st\|best_of_hou_okc`                |
| `conveyance_right` | `conv\|{TEAM}\|{YEAR}\|{ROUND}\|{poolIds}\|{comparator}\|{ranks}`        | `conv\|OKC\|2027\|1\|hou_2027_1st+phx_2027_1st\|more_favorable\|1` |

**Invariants:**

- Team codes: uppercase, trimmed
- Free-text strings: lowercase, no punctuation, whitespace → underscores
- Arrays: sorted before joining (poolIds with `+`, ranks with `+`)

### B2. `deterministicId` Policy

Format: `ent:{TEAM}:{YEAR}:{ROUND}:{kindShort}:{8hexHash}` — Hash is djb2 of `identityKey`.

| Prefix    | Usage                       | Source                            |
| --------- | --------------------------- | --------------------------------- |
| `ent:`    | World and base entitlements | `getEntitlementDeterministicId()` |
| `vacuum:` | Session-only creates        | `getVacuumDeterministicId()`      |

**Policy:** New creates MUST use deterministic IDs. Legacy random IDs (`Math.random`) in `generateEntitlementId()` and `makeVacuumEntitlementId()` are deprecated.

### B3. UI Label Generation Policy

Labels are **always derived, never canonical**. The derivation chain:

1. If `description` field exists → use it as-is (human-authored fallback)
2. Else → `formatEntitlementLabel()` builds from `{year} {round} via {originalTeam} ({kind})`
3. Terms summary → `formatEntitlementTermsShort()` builds from normalized terms
4. Kind badge → `getEntitlementKindTag()` maps kind → `{ label, colorClass }`

**Doctrine:** The `description` field SHOULD NOT be treated as a canonical label. All authoritative display SHOULD be derived from structured fields. `description` is informational/editorial only.

---

## C. Outcome Exclusivity Doctrine

### C1. Formal Statement

> **Every physical draft slot, for every year and round, must be covered by exactly one ownership entitlement. No two entitlements may claim the same outcome (draft position + physical slot) at the same time within the same world state.**

This means:

- Every `{originalTeam}_{year}_{round}` physical pick has exactly one `pick_ownership` entitlement claiming it
- Two `conveyance_right` entitlements with overlapping pools cannot claim the same rank of the same pick
- Two `swap_right` entitlements cannot both swap the same controller pick
- After DARE resolution, every physical slot maps to exactly one team

### C2. Allowed Patterns

| Pattern                          | Description                                                                                                 | How Exclusivity Holds                                                                                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Partitioned protections**      | Pick A has protection tiers that roll to Pick B                                                             | At any given draft position, exactly one tier fires → entitlement either conveys or rolls. The `ifTriggered` ladder ensures mutual exclusivity across years.                                  |
| **Linked residual packages**     | Primary entitlement + residual secondary entitlement via `linkedEntitlementIds` / `residualOfEntitlementId` | The linked entitlement only activates when the primary's protection triggers. They partition the outcome space (protection fires → residual activates, protection doesn't → primary conveys). |
| **Swap + ownership coexistence** | Team A owns the pick, Team B has swap rights                                                                | This is allowed — the swap right doesn't override ownership unless the swap is exercised. DARE resolves which team gets the better/worse outcome.                                             |
| **Single-team pool conveyance**  | Team holds right to "most favorable of" 3 picks                                                             | One pick is selected; the others remain with their `pick_ownership` holders. Pool membership defines candidates, rank + comparator selects one.                                               |

### C3. Forbidden Patterns

| Pattern                                               | Why Forbidden                                                                                                | Current Enforcement                                                                                                                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Two `pick_ownership` for same underlying pick**     | Same physical slot claimed twice                                                                             | Identity-key dedup prevents exact self-duplication, but nothing prevents two differently-authored entitlements from claiming the same underlier with different holder teams (the trade transfer should be the only mechanism for that) |
| **Two `conveyance_right` with identical pool + rank** | Same outcome slot claimed by two teams                                                                       | **NONE at author time.** Only caught by DARE conflict resolution at resolution time                                                                                                                                                    |
| **Orphaned physical slot**                            | A `{team}_{year}_{round}` pick with zero `pick_ownership` entitlements                                       | **NONE.** No completeness check exists                                                                                                                                                                                                 |
| **Overlapping conveyance pools selecting same rank**  | Two conveyance rights from different trades, both receiving "most favorable" rank 1 from an overlapping pool | **NONE at author/trade time.** DARE conflict resolution handles it at resolution                                                                                                                                                       |
| **Circular swap chains**                              | A → B → C → A swap cycle                                                                                     | ✅ Caught by `swapGraph.ts` cycle detection → marks as `unchanged`                                                                                                                                                                     |

---

## D. Gap List

Ranked by severity (critical → low):

| #      | Gap                                                           | Severity    | Impact                                                                                                                                                                                                                                                                         | Current Mitigation                                |
| ------ | ------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| **G1** | **No pre-save exclusivity check for overlapping pick claims** | 🔴 Critical | Two `pick_ownership` entitlements for the same underlier can be authored without error. The system relies entirely on DARE (which only runs at resolution, not authoring/trading).                                                                                             | DARE `resolveConflicts()` at resolution time only |
| **G2** | **No trade-time exclusivity validation**                      | 🔴 Critical | A trade can send an entitlement to a team that already holds a conflicting claim on the same pick — no blocking validation exists. Trade warnings (W1) only check linked entitlements, not pick-level exclusivity.                                                             | None                                              |
| **G3** | **No physical-slot completeness audit**                       | 🟠 High     | No mechanism verifies every `{team}_{year}_{round}` slot is claimed by at least one `pick_ownership` entitlement. Orphaned slots → silent data gaps during DARE.                                                                                                               | None                                              |
| **G4** | **No conveyance pool partition validation**                   | 🟠 High     | Two `conveyance_right` entitlements with overlapping `poolUnderlyingPickIds` and same `receivesRank`/`receivesComparator` can coexist without warning.                                                                                                                         | DARE conflict resolution at runtime               |
| **G5** | **Protection condition is free-text string**                  | 🟡 Medium   | `condition` field on `ProtectionLadderTier` is a human-readable string ("Top 3"). Cannot algorithmically compare protection ranges across entitlements to verify they partition the outcome space correctly.                                                                   | DARE parses heuristically at resolution time      |
| **G6** | **Legacy random ID generators still callable**                | 🟡 Medium   | `generateEntitlementId()` and `makeVacuumEntitlementId()` use `Math.random()`. If called, they bypass deterministic identity and break dedup invariants.                                                                                                                       | Marked deprecated in comments, not enforced       |
| **G7** | **No cross-write-path identity enforcement**                  | 🟡 Medium   | The 10 write entry points each have their own identity/dedup logic (or none). The mutation pipeline (trade execution) patches `holderTeam` without checking exclusivity. DARE mutator creates new entitlements (rolled/converted) without checking against existing inventory. | Fragmented per-path checks                        |

---

## E. Proposed Execution Tickets

### Ticket 1: `TM-EXCL-1` — Entitlement Exclusivity Validator (Pure Function)

**Scope:** Create a pure exclusivity-checking function that validates a set of entitlements has no conflicting claims.

**Files likely touched:**

- NEW: `src/features/architect/utils/entitlements/entitlementExclusivityValidator.ts`
- TEST: `src/tests/architect/entitlementExclusivityValidator.test.ts`

**Acceptance criteria:**

- Given an array of entitlements for a team, returns `{ valid: boolean, violations: Violation[] }`
- Detects: duplicate `pick_ownership` on same underlier, overlapping conveyance pool + rank, duplicate swap controller targeting
- Pure function — no Firestore access, no side effects
- 100% test coverage for all violation types

---

### Ticket 2: `TM-EXCL-2` — Save-Time Exclusivity Gate

**Scope:** Wire the exclusivity validator into the save path so conflicting entitlements are rejected at authoring time.

**Files likely touched:**

- MODIFY: `src/features/architect/admin/saveEntitlementFromFormState.ts` (both vacuum and world paths)
- MODIFY: `src/features/architect/admin/useEntitlementEditorState.ts` (surface errors to UI)
- USE: `src/features/architect/utils/entitlements/entitlementResolver.ts` (load current team entitlements for comparison)
- TEST: `src/tests/architect/saveEntitlementExclusivity.test.ts`

**Acceptance criteria:**

- Saving a `pick_ownership` that duplicates an existing underlier → toast error, save blocked
- Saving a `conveyance_right` with overlapping pool + rank → toast error, save blocked
- Editing an existing entitlement to change its claim does NOT false-positive against itself
- Works in both vacuum and world storage modes

---

### Ticket 3: `TM-EXCL-3` — Trade-Time Exclusivity Validation

**Scope:** Add exclusivity checking to trade validation so trades that create violations on the receiving team are blocked.

**Files likely touched:**

- MODIFY: `src/features/architect/tradeMachine/utils/entitlementWarnings.js` → promote from warning to blocking error for exclusivity
- NEW or MODIFY: Trade validation pipeline integration point
- USE: Exclusivity validator from Ticket 1
- TEST: `src/tests/architect/tradeEntitlementExclusivity.test.ts`

**Acceptance criteria:**

- Trade that sends a `pick_ownership` to a team already holding ownership of same underlier → validation error
- Trade that creates overlapping conveyance claims on receiving team → validation error
- Normal trades with non-conflicting entitlements pass without regression

---

### Ticket 4: `TM-EXCL-4` — Structured Protection Condition Field

**Scope:** Add a `structuredCondition` field to `ProtectionLadderTier` so protection ranges can be compared algorithmically.

**Files likely touched:**

- MODIFY: `src/schemas/architect.ts` — extend `EntitlementProtectionLadderTierZ`
- MODIFY: `src/features/architect/utils/entitlements/dare/types.ts` — extend `ProtectionLadderTier`
- MODIFY: `src/features/architect/admin/entitlementEditorFormState.ts` — UI support for structured conditions
- MODIFY: `src/features/architect/utils/entitlements/dare/protectionLadderFactory.ts` — populate from pick rules
- MODIFY: `src/features/architect/utils/entitlements/dare/conveyanceResolutionAdapter.ts` — use structured conditions
- TEST: Coverage for structured condition parsing and comparison

**Acceptance criteria:**

- Each protection tier has optional `structuredCondition: { type, protectedPositions }`
- Existing free-text `condition` field preserved for display
- `buildProtectionLadder()` populates structured condition from pick rule `type` + `protectedRange`
- Conveyance resolution uses structured condition when available, falls back to heuristic parsing

---

### Ticket 5: `TM-EXCL-5` — Physical Slot Completeness Audit

**Scope:** Build a diagnostic tool that verifies every physical draft slot is claimed by exactly one `pick_ownership` entitlement.

**Files likely touched:**

- NEW: `src/features/architect/utils/entitlements/slotCompletenessAudit.ts`
- NEW: UI integration point (e.g., Architect admin panel diagnostic)
- TEST: `src/tests/architect/slotCompletenessAudit.test.ts`

**Acceptance criteria:**

- Given all teams' entitlements for a year range, produces: `{ orphanedSlots: [], duplicatedSlots: [], healthy: boolean }`
- Reports which `{team}_{year}_{round}` slots have 0 or 2+ `pick_ownership` entitlements
- Can be run as admin diagnostic without modifying data

---

### Ticket 6: `TM-EXCL-6` — Deprecation Enforcement for Random ID Generators

**Scope:** Hard-deprecate or remove `generateEntitlementId()` and `makeVacuumEntitlementId()`. Ensure all write paths use deterministic IDs.

**Files likely touched:**

- MODIFY: `src/features/architect/utils/entitlements/entitlementWriter.ts` — remove/wrap `generateEntitlementId()`
- MODIFY: `src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts` — remove/wrap `makeVacuumEntitlementId()`
- AUDIT: All callers of these functions to verify migration to deterministic IDs
- TEST: Verify no code path reaches random ID generation

**Acceptance criteria:**

- `generateEntitlementId()` either removed or throws with migration message
- `makeVacuumEntitlementId()` either removed or throws with migration message
- All existing entitlements with random IDs continue to work (backward compatible)
- No new random IDs can be created

---

_End of Preflight Document — No code changes made._
