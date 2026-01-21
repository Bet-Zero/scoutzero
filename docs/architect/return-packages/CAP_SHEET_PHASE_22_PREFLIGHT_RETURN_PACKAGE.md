# CAP SHEET CONTRACT RULES — PHASE 22 PREFLIGHT RETURN PACKAGE

## Group 1 Functionality Reality Check (UI → Pipeline → Persist → Reload)

**DATE:** 2026-01-21  
**FEATURE:** architect/cap-sheet  
**STATUS:** PREFLIGHT COMPLETE  

---

## 1. Group 1 Status Table (A1–A8)

| Action | Status | Reason |
| :--- | :--- | :--- |
| **1. Sign Free Agent** | ✅ End-to-End | UI wired → Pipeline validated → Persists to world overlay. |
| **2. Extend Player** | ✅ End-to-End | Validates eligibility → computes terms → updates `futureContract`. |
| **3. Option Decision** | ✅ End-to-End | Handles `accept`/`decline`, properly updates roster/cap holds. |
| **4. Renounce Rights** | ✅ End-to-End | Removes cap hold, updates Bird rights status, persists correctly. |
| **5. Waive Player** | ✅ End-to-End | Moves to dead cap, removes from roster, calculates charges. |
| **6. Waive & Stretch** | ✅ End-to-End | Correctly flags `stretched: true` and spreads dead money. |
| **7. Sign-and-Trade** | 🟡 Partial | **UI Stub**: `handleSign` supports flag, but no Trade integration exists. |
| **8. Offer Sheets (RFA)** | ✅ End-to-End | Store/Match/Decline/Finalize all wired with audit-grade persistence. |

## 2. Supporting Systems Status Table (B9–B12)

| System | Status | Reason |
| :--- | :--- | :--- |
| **9. Dead Money** | 🟡 Partial | **UI Gap**: Can create via Waive, but no manual Add/Edit/Remove UI. |
| **10. Roster Charges** | 🟡 Partial | **Display Gap**: Computed correctly in totals, but not visible as line items. |
| **11. Exceptions** | 🟡 Partial | **Lifecycle Gap**: Usage tracked on sign, but no expiry/manual management. |
| **12. TPEs** | 🟡 Partial | **Pipeline Gap**: Exists in state, but trade pipeline doesn't explicitly consume them yet. |

---

## 3. End-to-End Call Paths (✅ Actions)

### A1. Sign Free Agent

- **UI Entry:** `EditContractModal.jsx` (Sign New) → `handleConfirm`
- **Hook:** `useArchitectActions.ts` → `handleSign`
- **Mutation:** `signFreeAgent`
- **Pipeline:** `mutationPipeline.js` → `computeSigningResult`
- **Validation:** `capLegalityValidation.js` → `validateSigning`
- **Persistence:** `architect_worlds/{worldId}/teams/{code}` (updates `players`, `roster`, `capHolds`, `exceptions`)
- **Refresh:** `useArchitectState.ts` → `setTeamCapSheet` (React Set) + `loadWorldTeamData` (Next Mount)

### A3. Option Decision

- **UI Entry:** `EditContractModal.jsx` (Accept/Decline) → `handleConfirm`
- **Hook:** `useArchitectActions.ts` → `handleOptionDecision`
- **Mutation:** `optionDecision`
- **Pipeline:** `mutationPipeline.js` → `computeOptionResult`
- **Validation:** `validateOptionDecision` (checks date window + invariants)
- **Persistence:** Updates `contract.salariesByYear[].optionUsed` (bool) + `capHolds` (on decline)

### A5. Waive & Stretch

- **UI Entry:** `EditContractModal.jsx` (Waive/Waive & Stretch) → `handleConfirm`
- **Hook:** `useArchitectActions.ts` → `handleWaiveContract`
- **Mutation:** `waivePlayer`
- **Pipeline:** `mutationPipeline.js` → `computeWaiveResult`
- **Validation:** `validateWaive` (checks roster min + stretch timing warning)
- **Persistence:** Updates `roster` (remove), reads/writes `deadCap` array canonical schema.

### A8. Offer Sheets (RFA)

- **UI Entry:** `EditContractModal.jsx` (Sign as Offer Sheet) OR `OfferSheetList.jsx` (Match/Decline)
- **Hook:** `useArchitectActions.ts` → `handleStoreOfferSheet` / `handleMatchOfferSheet`
- **Mutation:** `storeOfferSheet` / `matchOfferSheet` / `declineOfferSheet`
- **Pipeline:** `mutationPipeline.js` → `computeStoreOfferSheetResult` (deduped)
- **Persistence:** `teams/{offering}.offerSheets[]` AND `teams/{home}.incomingOfferSheets[]` (mirrored)

---

## 4. Breakpoints for 🟡/❌ Items

### Sign-and-Trade (🟡 Partial)

- **Type:** **UI Stub / Pipeline Gap**
- **Evidence:** `useArchitectActions.ts` sets `type: 'Sign & Trade'` on the contract, but performs a simple `signFreeAgent` mutation. It does **not** trigger `executeTrade` or prompt the user to select a destination team. It essentially just signs them to the current team with a label.

### Dead Money Manual Management (🟡 Partial)

- **Type:** **UI Missing**
- **Evidence:** `EditContractModal` handles waivers, but there is no "Add Dead Money" button or modal in the Cap Sheet view to fix data errors or add legacy dead money manually.

### Roster Charges (🟡 Partial)

- **Type:** **Display Gap**
- **Evidence:** `computeTeamCapTotals.js` correctly calculates `incompleteChargesTotal` ($1.1M * empty slots), but the `CapSummary` component (not reviewed here, but inferred) likely only shows the `totalCapAllocations`, hiding the explicit line item for the charge.

---

## 5. Persistence & Reload Findings

### Findings

1. **Write Path:** Confirmed. `persistWorldMutation` in `mutationPipeline.js` uses atomic batch writes to `architect_worlds/{worldId}/teams/{code}`. It validates `userId` ownership before writing.
2. **Read Path:** Confirmed. `useArchitectState.ts` calls `loadWorldTeamData(worldId, teamId)`, which correctly attempts to load from the world overlay before falling back to base teams.
3. **Totals Recompute:** Confirmed. `updateWorldStats` is called post-mutation to refresh cached totals, and the UI re-runs `computeTeamCapTotals` on the fly when `teamCapSheet` updates.
4. **Reload Reality:** Because `architect_worlds` is the single source of truth for the overlay, a browser refresh will reload the exact state stored in Firestore.

---

## 6. Group 1 Completion Punchlist

### P0: Essential for Standalone Utility

1. **Sign-and-Trade Logic:**
    - **Phase:** Phase 23
    - **Criteria:** `handleSign` with `signAndTrade: true` must redirect to a Trade flow or require a destination team, executing a `sign` + `trade` atomic operation (or sequential).
    - **Files:** `useArchitectActions.ts`, `mutationPipeline.js`.
2. **Manual Dead Money Tools:**
    - **Phase:** Phase 24
    - **Criteria:** "Manage Dead Money" modal allowing Add/Edit/Remove of dead cap entries.
    - **Files:** `CapSheetSection.jsx`, `DeadMoneyModal.jsx` (New).

### P1: Important Completeness

3. **Roster Charge Visibility:**
    - **Phase:** Phase 25
    - **Criteria:** If `incompleteChargesTotal > 0`, display a "Incomplete Roster Charge (x Slots)" row in the Cap Sheet totals area.
    - **Files:** `CapSummary.jsx`.

### P2: Polish

4. **TPE Explicit Consumption:**
    - **Phase:** Phase 26
    - **Criteria:** Trade Machine should explicitly ask which TPE to use if multiple exist, rather than auto-selecting.

---

## 7. Risks / Rabbit Holes

1. **Sign-and-Trade Complexity:** The interaction between "Signing Rules" (Cap Space/Exceptions) and "Trade Rules" (Salary Matching/BYC) is the most complex validation area. Currently, it's just a label. Wiring this fully is a large task.
2. **TPE "Zombie" State:** Without explicit expiration *cleanup* (which is implemented in `advanceSeason` but maybe not visible during the season), TPEs might look valid when they shouldn't be.
3. **Date/Time Drift:** While Phase 20/21 fixed the backend SSOT, the frontend `currentYear` (Season) selector vs. `asOfDate` (Calendar Date) can still be confusing. Users might be in "2026 Season" but `asOfDate` defaults to "Now".
