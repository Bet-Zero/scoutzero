# Phase 15 Preflight Return Package: Offer Sheet Persistence + Workflow Entry Points

**Mode:** PREFLIGHT (Review-only; no code changes)  
**Date:** 2026-01-19  
**Phase:** 15

---

## 1. Direct Answer: Where Should Offer Sheets Be Stored?

**Recommendation: Option A — Stored under the team overlay in `architect_worlds/{worldId}/teams/{teamCode}`**

Offer sheets should be stored as an `offerSheets` array property on the team overlay document, NOT on individual player objects or in a separate subcollection. This approach:

1. **Respects data doctrine:** `/teams/` base is read-only; `architect_worlds/` is the sole writable layer
2. **Co-locates team obligations:** Offer sheets are a team cap commitment (the offering team holds cap space)
3. **Enables simple loading:** Existing `teamLoader.js` patterns already load team overlays
4. **Avoids player confusion:** Storing on player objects would risk conflating "pending offer" with "signed contract"

---

## 2. Entry Point Inventory Table

All paths that can reach `validateSigning()` and/or create/update a contract:

| Entry Point | File + Function | What It Does | Supports Store-Only Today? |
|-------------|-----------------|--------------|----------------------------|
| **persistMutation('signFreeAgent')** | `useArchitectActions.ts:673` | UI handler for FA signings | ❌ No — always finalizes |
| **applyWorldMutation (signFreeAgent)** | `mutationPipeline.js:265` via case `signFreeAgent:536` | Pipeline entry, calls `computeSigningResult` + `validateSigning` | ❌ No — pipeline adds to roster |
| **computeSigningResult** | `mutationPipeline.js:693` | Pure compute of signing result state | ❌ No — produces roster mutation |
| **validateSigning** | `capLegalityValidation.js:1738` | Validation function, supports `rfaOfferSheetOnly` flag | ✅ **Partial** — accepts store-only flag but no persistence |
| **persistMutation('extendPlayer')** | `useArchitectActions.ts:964` | UI handler for extensions | N/A (not signing) |
| **persistMutation('optionDecision')** | `useArchitectActions.ts:1224` | UI handler for options | N/A (not signing) |
| **persistMutation('renounceRights')** | `useArchitectActions.ts:777` | UI handler for renouncing | N/A (not signing) |
| **persistMutation('waivePlayer')** | `useArchitectActions.ts:1059` | UI handler for waiving | N/A (not signing) |
| **persistMutation('executeTrade')** | `useArchitectActions.ts:569` | UI handler for trades | N/A (trade flow) |
| **signFreeAgent (tradeManager)** | `tradeManager.js:214` | Direct DB mutation (deprecated) | ❌ No |
| **Test direct calls** | `tests/architect/*.test.js` | Test harness calls | N/A (test only) |

### Key Finding

All signing entry points flow through:

```
useArchitectActions.persistMutation → applyWorldMutation → computeSigningResult → persistWorldMutation
```

There is **no existing store-only persistence path**. The `rfaOfferSheetOnly` flag in `validateSigning()` is validation-only; it prevents hard-blocks but does NOT persist the offer sheet separately.

---

## 3. Persistence Decision: Option A (Team-Level Property)

### Options Evaluated

| Option | Location | Pros | Cons |
|--------|----------|------|------|
| **A** *(Recommended)* | `architect_worlds/{worldId}/teams/{teamCode}.offerSheets[]` | Co-locates with team cap state; simple to load; no new subcollections | Array growth if many offer sheets (unlikely) |
| **B** | `architect_worlds/{worldId}/teams/{teamCode}/offerSheets/{offerId}` | Subcollection allows individual updates | Requires additional Firestore queries; more complex loading |
| **C** | `architect_worlds/{worldId}/players/{playerId}.pendingOfferSheet` | Player-centric view | Mixes pending offer with player state; confuses rostered vs. not-rostered; player may not exist in team overlay yet |

### Decision Rationale

**Option A** is preferred because:

1. **Offer sheets are team obligations.** The *offering team* is responsible for the cap space hold. Storing on the team matches this reality.
2. **Loading is straightforward.** `teamLoader.getTeam()` already loads the full team overlay. Adding `offerSheets` as a property requires no new queries.
3. **No Firestore path changes.** All existing path helpers work unchanged.
4. **Atomic updates.** Team overlay is already updated atomically via `writeBatch` in `persistWorldMutation`.

### Schema Location

```
architect_worlds/{worldId}/teams/{teamCode}
├── players[]          (existing)
├── roster[]           (existing)
├── capHolds[]         (existing)
├── exceptions{}       (existing)
├── offerSheets[]      ◀ NEW: Pending RFA offer sheets issued by this team
└── ...
```

---

## 4. Canonical OfferSheet Object Shape

```typescript
/**
 * Canonical OfferSheet schema for pending RFA offer sheets.
 * 
 * Stored in: architect_worlds/{worldId}/teams/{teamCode}.offerSheets[]
 */
interface OfferSheet {
  // === Identification ===
  id: string;                    // REQUIRED - Stable unique ID (e.g., UUID or `{playerId}_{timestamp}`)
  playerId: string;              // REQUIRED - Target player ID
  playerName: string;            // REQUIRED - Display name for UI (denormalized)
  
  // === Team References (Normalized) ===
  offeringTeamCode: string;      // REQUIRED - Team issuing the offer sheet (e.g., "LAL")
  homeTeamCode: string;          // REQUIRED - RFA home team with matching rights (e.g., "BOS")
  
  // === Season Context ===
  seasonKey: string;             // REQUIRED - Season of offer (e.g., "2025-26")
  year: number;                  // REQUIRED - End year for cap calculations (e.g., 2026)
  
  // === Contract Terms ===
  contractYears: number;         // REQUIRED - Length in years (1-4 per CBA)
  salariesByYear: SalaryByYear[]; // REQUIRED - Full salary breakdown per year
  totalValue: number;            // OPTIONAL - Computed total (convenience)
  raises: number;                // OPTIONAL - Raise percentage (e.g., 0.05)
  
  // === Status Tracking ===
  status: 'PENDING_MATCH' | 'MATCHED' | 'DECLINED'; // REQUIRED - Resolution state
  
  // === Metadata ===
  createdAt: string;             // REQUIRED - ISO timestamp of creation
  createdBy?: string;            // OPTIONAL - User ID who created
  updatedAt?: string;            // OPTIONAL - ISO timestamp of last update
  matchedAt?: string;            // OPTIONAL - ISO timestamp of match decision
  declinedAt?: string;           // OPTIONAL - ISO timestamp of decline decision
  
  // === Linkage to Validation Flags ===
  // These mirror the contract-level flags used by existing validators:
  // - When storing: rfaOfferSheet = true, rfaOfferSheetOnly = true, rfaOfferSheetStatus = status
  // - When loading: build contract object from OfferSheet for display/finalization
}

/**
 * SalaryByYear entry (matches existing contract schema)
 */
interface SalaryByYear {
  season: string;        // e.g., "2025-26"
  salary: number;        // Base salary
  capHit: number;        // Cap hit (defaults to salary)
  guaranteed: boolean;   // Guaranteed status
  guaranteedAmount?: number;
}
```

### Required vs Optional Fields

| Field | Required | Validation Driver? | Notes |
|-------|----------|-------------------|-------|
| `id` | ✅ | No | Stable key for updates/deletes |
| `playerId` | ✅ | Yes | Used to lookup player data |
| `playerName` | ✅ | No | Denormalized for display |
| `offeringTeamCode` | ✅ | Yes | Verified against signing team |
| `homeTeamCode` | ✅ | Yes | For home team match/decline actions |
| `seasonKey` | ✅ | No | For display |
| `year` | ✅ | Yes | Cap lookups |
| `contractYears` | ✅ | Yes | validateOfferSheetTerms |
| `salariesByYear` | ✅ | Yes | validateOfferSheetTerms (raises) |
| `status` | ✅ | Yes | Finalization gate |
| `createdAt` | ✅ | No | Audit trail |

---

## 5. Workflow Map: Store → Finalize → Decline

### 5.1 Store Offer Sheet (Non-Finalizing)

**Purpose:** Create a pending offer sheet without rostering the player.

| Aspect | Value |
|--------|-------|
| **Action Name** | `storeOfferSheet` |
| **UI Trigger** | New "Submit Offer Sheet" button in Free Agent actions |
| **Existing Function?** | ❌ No — needs new mutation type |
| **New Function/Mutation** | `computeStoreOfferSheetResult` + `applyWorldMutation('storeOfferSheet')` |
| **Validator** | `validateSigning` with `contract.rfaOfferSheetOnly = true` |
| **Expected Flags** | `rfaOfferSheet: true, rfaOfferSheetOnly: true, rfaOfferSheetStatus: 'PENDING_MATCH'` |
| **Roster Effect** | None — player NOT added to roster |
| **Cap Effect** | Cap hold may be computed for "pending offer sheet" (TBD) |
| **Persistence** | Append to `team.offerSheets[]` |

### 5.2 Finalize Offer Sheet (MATCHED → Roster Add)

**Purpose:** Convert a MATCHED offer sheet into a rostered contract.

| Aspect | Value |
|--------|-------|
| **Action Name** | `finalizeOfferSheet` |
| **UI Trigger** | "Complete Signing" button on MATCHED offer sheet |
| **Existing Function?** | ✅ Reuses `signFreeAgent` with modified flags |
| **New Function/Mutation** | `computeFinalizeOfferSheetResult` OR reuse `computeSigningResult` |
| **Validator** | `validateSigning` with `rfaOfferSheetStatus: 'MATCHED', rfaOfferSheetOnly: undefined` |
| **Expected Flags** | `rfaOfferSheet: true, rfaOfferSheetStatus: 'MATCHED'` (NO `rfaOfferSheetOnly`) |
| **Roster Effect** | Player ADDED to offering team roster |
| **Cap Effect** | Cap hit applied; cap hold (if any) removed |
| **Persistence** | Remove from `team.offerSheets[]`; add to `team.players[]` |

### 5.3 Match Offer Sheet (Home Team Decision)

**Purpose:** Home team matches the offer sheet, keeping the player.

| Aspect | Value |
|--------|-------|
| **Action Name** | `matchOfferSheet` |
| **UI Trigger** | "Match Offer" button on home team's view |
| **Existing Function?** | ❌ No — new action |
| **New Function/Mutation** | `computeMatchOfferSheetResult` |
| **Validator** | New validation: verify offer sheet exists, status is PENDING_MATCH |
| **Expected Flags** | Updates status to `'MATCHED'` |
| **Roster Effect** | Player STAYS on home team roster (re-signed with matching terms) |
| **Cap Effect** | Home team takes on the matched contract |
| **Persistence** | Option 1: Update `offeringTeam.offerSheets[].status = 'MATCHED'` + sign on home team |
|                | Option 2: Remove from offeringTeam, add contract to homeTeam.players |

### 5.4 Decline Offer Sheet (Home Team Decision)

**Purpose:** Home team declines to match; offering team acquires player.

| Aspect | Value |
|--------|-------|
| **Action Name** | `declineOfferSheet` |
| **UI Trigger** | "Decline to Match" button on home team's view |
| **Existing Function?** | ❌ No — new action |
| **New Function/Mutation** | `computeDeclineOfferSheetResult` |
| **Validator** | New validation: verify offer sheet exists, status is PENDING_MATCH |
| **Expected Flags** | Updates status to `'DECLINED'` |
| **Roster Effect** | Player removed from home team roster (if applicable) |
| **Cap Effect** | Home team cap hold removed |
| **Persistence** | Update `offeringTeam.offerSheets[].status = 'DECLINED'`; enable finalization |

### 5.5 Cancel/Delete Offer Sheet (Optional)

**Purpose:** Withdraw an offer sheet before any decision.

| Aspect | Value |
|--------|-------|
| **Action Name** | `cancelOfferSheet` |
| **UI Trigger** | "Withdraw Offer" button on pending offer sheet |
| **Existing Function?** | ❌ No — new action |
| **Persistence** | Remove from `team.offerSheets[]` |

---

## 6. UI Surface Audit

### Current UI Components Related to Free Agency / Cap Sheet

| Component | File Path | Shows Offer Sheets Today? | Should Show? |
|-----------|-----------|---------------------------|--------------|
| **FreeAgencySection** | `GMDashboard/sections/FreeAgencySection.jsx` | ❌ No | ✅ Yes — pending offers from this team |
| **FreeAgentPool** | `freeAgency/FreeAgentPool/FreeAgentPool.jsx` | ❌ No | ✅ Yes — offer sheet actions for RFAs |
| **FreeAgentRow** | `freeAgency/FreeAgentPool/FreeAgentRow.jsx` | ❌ No | ✅ Yes — status indicators |
| **FreeAgentCard** | `freeAgency/FreeAgentPool/FreeAgentCard.jsx` | ❌ No | ✅ Yes — offer sheet button |
| **EditContractModal** | `shared/components/EditContractModal.jsx` | ❌ No | ✅ Yes — offer sheet mode toggle |
| **CapSheet** | `capSheet/CapSheet/CapSheet.jsx` | ❌ No | ⚠️ Maybe — pending obligations section |
| **CapSheetFull** | `capSheet/CapSheetFull/CapSheetFull.jsx` | ❌ No | ⚠️ Maybe — offer sheet summary |
| **CapSummaryTiles** | `capSheet/CapSheet/CapSummaryTiles.jsx` | ❌ No | ⚠️ Maybe — "pending offer sheets" tile |

### Recommended New Components

| Component | Purpose |
|-----------|---------|
| **OfferSheetList** | Display list of pending offer sheets for a team |
| **OfferSheetCard** | Card view with player, terms, status, actions |
| **OfferSheetActions** | Match/Decline/Cancel button group |

---

## 7. Phase 16 Execution Checklist

### Schema + Types

- [ ] Add `OfferSheet` interface to `src/schemas/architect.ts`
- [ ] Add `offerSheets` property to `WorldTeamSnapshot` type
- [ ] Add `SalaryByYear` import/reuse

### Persistence Layer

- [ ] Add `storeOfferSheet` case to `mutationPipeline.js:loadStateForMutation`
- [ ] Add `storeOfferSheet` case to `mutationPipeline.js:computeWorldMutation`
- [ ] Create `computeStoreOfferSheetResult()` function in `mutationPipeline.js`
- [ ] Update `persistWorldMutation()` to handle `offerSheets[]` array updates
- [ ] Add `matchOfferSheet` mutation type
- [ ] Add `declineOfferSheet` mutation type
- [ ] Add `finalizeOfferSheet` mutation type (or reuse `signFreeAgent` with flags)

### Validation

- [ ] Create `validateStoreOfferSheet()` in `capLegalityValidation.js`
- [ ] Reuse existing `validateOfferSheetTerms()` for term validation
- [ ] Add `offer_sheet_player_not_rfa` hard-block rule
- [ ] Add `offer_sheet_duplicate_pending` warning rule

### UI Handlers

- [ ] Add `handleSubmitOfferSheet` to `useArchitectActions.ts`
- [ ] Add `handleMatchOfferSheet` to `useArchitectActions.ts`
- [ ] Add `handleDeclineOfferSheet` to `useArchitectActions.ts`
- [ ] Add `handleFinalizeOfferSheet` (or modify `handleSign`) to `useArchitectActions.ts`

### UI Components

- [ ] Create `OfferSheetList.jsx` in `src/features/architect/freeAgency/`
- [ ] Create `OfferSheetCard.jsx` in `src/features/architect/freeAgency/`
- [ ] Modify `FreeAgencySection.jsx` to display pending offer sheets
- [ ] Modify `FreeAgentCard.jsx` to add "Submit Offer Sheet" action for RFAs
- [ ] Modify `EditContractModal.jsx` to support offer sheet mode

### Loading

- [ ] Update `teamLoader.js:loadTeamSnapshot` to include `offerSheets` in result
- [ ] Ensure `offerSheets` defaults to `[]` when missing

### Testing

- [ ] Add unit tests for `computeStoreOfferSheetResult`
- [ ] Add unit tests for `validateStoreOfferSheet`
- [ ] Add integration tests for Store → Match → Finalize flow
- [ ] Add integration tests for Store → Decline → Finalize flow

### Documentation

- [ ] Update `CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` with Phase 16 entry
- [ ] Add offer sheet schema documentation section
- [ ] Document new mutation types

---

## 8. Updates Needed in Master Doc

Add the following to `CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`:

### Section 9.13: Offer Sheet Persistence (Phase 15)

**Location:** `architect_worlds/{worldId}/teams/{teamCode}.offerSheets[]`

**Data Doctrine:** Offer sheets are team-level obligations. Stored on the *offering team's* overlay.

**Status Enum:**

- `PENDING_MATCH` — Awaiting home team decision
- `MATCHED` — Home team matched; eligible for finalization
- `DECLINED` — Home team declined; offering team may finalize

**Workflow:**

1. Store → `storeOfferSheet` mutation (non-finalizing)
2. Match/Decline → Home team actions on their view
3. Finalize → Convert to rostered contract (MATCHED or DECLINED only)

### Change Log Entry

```
| 2026-01-19 | **Contract Rules Phase 15 (Preflight):** Designed offer sheet persistence model. Offer sheets stored in `architect_worlds/{worldId}/teams/{teamCode}.offerSheets[]`. Canonical OfferSheet schema defined. Workflow: Store → Match/Decline → Finalize. UI surfaces identified (FreeAgencySection, FreeAgentPool, EditContractModal). Phase 16 execution checklist created. |
```

---

## Stop Conditions Encountered

| Condition | Status | Notes |
|-----------|--------|-------|
| Offer sheets already persisted somewhere | ❌ Not found | Only contract-level flags (`rfaOfferSheet`) exist; no persistence |
| No stable playerId/teamId available | ✅ Available | Player IDs and team codes are stable |
| TeamPlans persistence layer missing | N/A | `teamPlans` is dead; `architect_worlds` is active |

---

## Validation Performed

- [x] Searched for `validateSigning(`, `computeSigningResult`, `signFreeAgent`, `rfaOfferSheet*`
- [x] Confirmed no Firestore writes to `/teams/` in mutation paths
- [x] Confirmed all mutations flow through `applyWorldMutation → persistWorldMutation`
- [x] Reviewed `architectFirestorePaths.ts` for existing path helpers
- [x] Audited `useArchitectActions.ts` for all action handlers

---

**END OF PREFLIGHT RETURN PACKAGE**
