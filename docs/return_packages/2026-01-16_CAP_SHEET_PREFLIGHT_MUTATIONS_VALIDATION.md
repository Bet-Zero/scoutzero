# Return Package: Cap Sheet Mutations & Validation Preflight

**Date:** 2026-01-16  
**Mode:** PREFLIGHT (Review-only; NO product code changes)  
**Scope:** Cap Sheet and Cap Table only

---

## 1. Executive Summary

### What Exists

- ✅ **Mutation Pipeline:** Centralized `applyWorldMutation()` handles 6 mutation types with 5-phase flow
- ✅ **Validation Layer:** `capLegalityValidation.js` provides 6 validators for non-trade mutations
- ✅ **UI Handlers:** `useArchitectActions.ts` routes all actions through the pipeline
- ✅ **SSOT Computation:** `computeTeamCapTotals.js` is single source of truth for cap totals
- ✅ **Override System:** Hard block vs soft warning classification with env-gated override

### What Doesn't Exist

- ❌ Incomplete roster charge enforcement (auto-applied cap penalty)
- ❌ TPE expiration automation
- ❌ Post-apron exception blocking (MLE/BAE disabled after triggers)
- ❌ Contract min/max rules enforcement
- ❌ Manual dead money entry UI

---

## 2. Mutations Inventory

| Mutation / Action | UI Surface | Handler/Function | Data Written | Uses mutationPipeline? | Notes/Limitations |
|-------------------|------------|------------------|--------------|------------------------|-------------------|
| Sign Free Agent | `EditContractModal` → GMDashboard | `handleSignFreeAgent` | `teams/{code}.players`, `capHolds`, `exceptions` | ✅ Yes | Exception usage tracked |
| Waive Player | `EditContractModal` → GMDashboard | `handleWaiveContract` | `teams/{code}.deadCap`, `players`, `roster` | ✅ Yes | Creates deadCap entry |
| Waive & Stretch | `EditContractModal` → GMDashboard | `handleWaiveContract` | `teams/{code}.deadCap.amountByYear` | ✅ Yes | Stretch over 2n+1 years |
| Buyout | `EditContractModal` → GMDashboard | `handleWaiveContract` | Reduced `deadCap.amount` | ✅ Yes | Negotiated amount |
| Extend Contract | `EditContractModal` → GMDashboard | `handleExtendContract` | `players/{id}.futureContract` | ✅ Yes | Extension eligibility TBD |
| Option Accept/Decline | `EditContractModal` → GMDashboard | `handleOptionDecision` | `contract.salariesByYear[n].optionUsed` | ✅ Yes | Timing validated |
| Renounce Rights | `EditContractModal` → GMDashboard | `handleRenounceRights` | `capHolds` removal | ✅ Yes | Cap space freed |
| Execute Trade | Trade Machine | `applyWorldMutation` | Multiple teams | ✅ Yes | Uses `tradeValidator.js` |
| Manual Dead Money | None | N/A | N/A | ❌ N/A | Not implemented |
| TPE Create/Use | Partial | Trade pipeline only | `tradeExceptions` | Partial | No standalone UI |

---

## 3. Validation Map

| Rule / Check | Where Implemented | Trigger | Hard Block vs Warning | Data Inputs | Evidence |
|--------------|-------------------|---------|----------------------|-------------|----------|
| Roster Size (>15) | `capLegalityValidation.js:validateSigning` L224 | Pre-persist | Hard Block | `team.players` count | `HARD_BLOCK_RULES.roster_size` |
| Two-Way Limit (>3) | `capLegalityValidation.js:validateSigning` L234 | Pre-persist | Hard Block | `team.players` filter | `HARD_BLOCK_RULES.two_way_limit` |
| Hard Cap Ceiling | `capLegalityValidation.js:validateSigning` L252 | Pre-persist | Hard Block | `team.totals.capHit`, `hardCapStatus.ceiling` | via `getHardCapStatus()` |
| Roster Minimum (<14) | `capLegalityValidation.js:validateWaive` L325 | Pre-persist | Warning | `countStandardRoster()` | `SOFT_WARNING_RULES.roster_minimum` |
| Dead Cap Info | `capLegalityValidation.js:validateWaive` L348 | Pre-persist | Info | `remainingGuaranteed` | Display only |
| Option Timing | `capLegalityValidation.js:validateOptionDecision` L435 | Pre-persist | Hard Block | `targetYear`, `currentYear` | Must be next season |
| No Contract | `capLegalityValidation.js:validateExtension` L383 | Pre-persist | Hard Block | `contract.salariesByYear` | Empty = error |
| First Apron | `capLegalityValidation.js:validateSigning` L284 | Pre-persist | Warning | `projectedCapHit > capSettings.firstApron` | Visual warning |
| Second Apron | `capLegalityValidation.js:validateSigning` L278 | Pre-persist | Warning | `projectedCapHit > capSettings.secondApron` | Visual warning |
| MLE Taxpayer | `capLegalityValidation.js:validateSigning` L262 | Pre-persist | Warning | Using MLE while `capHit > tax` | Hard cap trigger |

---

## 4. Key File Paths (Top 10)

| # | File Path | Role |
|---|-----------|------|
| 1 | `src/features/architect/utils/mutationPipeline.js` | Canonical mutation pipeline (1478 lines) |
| 2 | `src/features/architect/utils/capLegalityValidation.js` | Non-trade validation (586 lines) |
| 3 | `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` | UI action handlers (1293 lines) |
| 4 | `src/features/architect/hooks/useCapSheetState.js` | Local session state (515 lines) |
| 5 | `src/features/architect/hooks/useCapValidation.js` | Real-time UI hints (498 lines) |
| 6 | `src/features/architect/utils/capTotals/computeTeamCapTotals.js` | SSOT computation |
| 7 | `src/shared/components/EditContractModal.jsx` | Contract action modal (1260 lines) |
| 8 | `src/features/architect/capSheet/CapSheet/CapSheet.jsx` | Main Cap Sheet component |
| 9 | `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx` | Exception display |
| 10 | `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` | Trade validation reference |

---

## 5. Ranked Gap List

### P0 — Can Produce Incorrect Cap Totals / Silent Illegal States

| ID | Gap | Description | Affected File |
|----|-----|-------------|---------------|
| G0-1 | Incomplete Roster Charge | Teams at <14 players should have auto-applied cap charge (not implemented) | `computeTeamCapTotals.js` |
| G0-2 | Exception Post-Apron | Using NTPMLE/BAE should block further TPMLE usage but not enforced | `capLegalityValidation.js` |
| G0-3 | TPE Expiration | TPEs should auto-expire after 1 year; no automation exists | `mutationPipeline.js` |

### P1 — Allows Illegal Action but Visible/Warned

| ID | Gap | Description | Affected File |
|----|-----|-------------|---------------|
| G1-1 | Stretch Timing | Stretch provision timing rules (before season only) not validated | `validateWaive` |
| G1-2 | Bird Rights UI | Extension/signing options may show for ineligible players | `useCapValidation.js` |
| G1-3 | Cap Hold + FA | Can initiate FA signing even if cap hold + contract > cap space | `validateSigning` |

### P2 — Feature Missing / Polish

| ID | Gap | Description | Priority |
|----|-----|-------------|----------|
| G2-1 | Manual Dead Money | No UI for manual dead money entry/correction | Low |
| G2-2 | Exception UI | No UI for manual exception create/expire | Low |
| G2-3 | Roster Charge Display | Incomplete roster cap penalty not shown in UI | Medium |
| G2-4 | Contract Rules | Min/max contract length not enforced | Medium |

---

## 6. Trade Machine Pattern Comparison

### Shared Utilities

| Utility | Shared? |
|---------|---------|
| `computeTeamCapTotals.js` (SSOT) | ✅ Yes |
| `capSettingsProvider.js` | ✅ Yes |
| `getHardCapStatus()` | ✅ Yes |

### Not Shared (Trade-Specific)

| Component | Reason |
|-----------|--------|
| `tradeValidator.js` full rules engine | Trade-specific (salary matching, BYC, etc.) |
| `validateSalaryMatching` | Only applies to trades |
| `enforceSecondApronHandcuffs` | Trade-specific restrictions |
| `TradeContext` builder | Rich context not needed for signings |

### Assessment

**Cap Sheet currently has no true validator architecture parallel to Trade Machine.** It uses simpler per-action validators in `capLegalityValidation.js` instead of a rules engine pattern.

---

## 7. Master Doc Confirmation

**Created:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

### Sections Included

1. Purpose & Scope
2. Mutation Architecture (Pipeline + Local)
3. Mutations Inventory Table
4. Data Paths & Shapes (deadCap, capHolds schemas)
5. Validation Architecture
6. Validation Map (10 rules)
7. Trade Machine Comparison
8. Gap Analysis (P0/P1/P2)
9. File Map (Top 10)
10. Change Log

---

## 8. Stop Condition Check

| Check | Status |
|-------|--------|
| Cap Sheet writes to base collections? | ✅ No violation found — all writes go to `architect_worlds` overlay |
| Validation formula conflicts? | ✅ No conflicts — single `computeTeamCapTotals` SSOT |

---

## 9. Recommendations

1. **P0 Gaps:** Address incomplete roster charges and exception post-apron blocking before user-facing release
2. **Validation Upgrade:** Consider adopting Trade Machine's rules engine pattern for richer validation context
3. **TPE Automation:** Implement season-advance hook to auto-expire TPEs
4. **Manual Entry UI:** Low priority but needed for data correction workflows
