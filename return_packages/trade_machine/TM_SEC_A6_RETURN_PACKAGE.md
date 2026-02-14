# TM_SEC_A6 — RETURN PACKAGE

**Audit ID:** TM_SEC_A6  
**Section:** 12 (Save/Load + Immutability)  
**Date:** 2026-02-14  
**Mode:** PREFLIGHT (Discovery-only)  
**Status:** ✅ PASS

---

## Deliverables

| #   | Deliverable     | Path                                                        | Status       |
| --- | --------------- | ----------------------------------------------------------- | ------------ |
| 1   | Section Doc     | `docs/architect/audits/TM_SEC_A6_SAVE_LOAD_IMMUTABILITY.md` | ✅ Created   |
| 2   | Workbook Update | `docs/architect/audits/TM_AUDIT_WORKBOOK.md` (Section 12)   | ✅ Updated   |
| 3   | Return Package  | `return_packages/trade_machine/TM_SEC_A6_RETURN_PACKAGE.md` | ✅ This file |

---

## Key Findings Summary

| Question                                    | Answer                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| Does trade machine have save/load in scope? | **PARTIAL** — No save/load trade session; Apply Trade persists to world |
| If YES: where is it stored?                 | `architect_worlds/{worldId}/teams/{teamCode}`                           |
| Are base collections protected from writes? | **YES** — Zero writes to base collections                               |
| Hidden writes present?                      | **NO** — No Firestore imports in trade machine                          |

---

## Section 12 Audit Results

| Item                           | In UI? | Implemented? | Validated? | Single Source? | Risk   |
| ------------------------------ | ------ | ------------ | ---------- | -------------- | ------ |
| Save trade session             | NO     | NO           | N/A        | N/A            | LOW    |
| Load trade session             | NO     | NO           | N/A        | N/A            | LOW    |
| Save location correct          | N/A    | YES          | YES        | YES            | LOW    |
| Base collection immutability   | N/A    | YES          | YES        | YES            | LOW    |
| Firestore rules match behavior | N/A    | PARTIAL      | N/A        | N/A            | MEDIUM |

---

## Evidence Summary (FAIL/HIGH only)

**A6-E5: Firestore Rules — MEDIUM Risk**

- **Current:** `firestore.rules` is DEV-OPEN (`allow read, write: if true`)
- **Production:** `firestore.rules.backup` has correct locks (`allow write: if false` for base collections)
- **Action:** Deploy locked rules before production launch

---

## Write Path

```
Apply Trade button (TradeEditor.jsx)
    ↓
onApplyTrade(tradeData) — GMDashboard.jsx:L309
    ↓
applyTradeToCapSheet() — useArchitectActions.ts:L567
    ↓
runAuthoritativeFAMutation('executeTrade', { teams }) — L603
    ↓
mutationPipeline.js::writeBatchToWorld()
    ↓
✅ architect_worlds/{worldId}/teams/{teamCode}
✅ architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}
✅ architect_worlds/{worldId}/entitlements/{entitlementId}
❌ /teams — NEVER WRITTEN
❌ architect_baseTeams — NEVER WRITTEN
```

---

## Immutability Verification

| Collection                     | Written By Trade Machine? | Evidence                       |
| ------------------------------ | ------------------------- | ------------------------------ |
| `/teams`                       | NO                        | Not referenced                 |
| `architect_baseTeams`          | NO                        | Rules: `allow write: if false` |
| `architect_basePlayers`        | NO                        | Rules: `allow write: if false` |
| `architect_baseEntitlements`   | NO                        | Rules: `allow write: if false` |
| `players_v2`                   | NO                        | Not referenced                 |
| `architect_worlds/{worldId}/*` | YES (intended)            | User-owned world data          |

---

## Files Referenced (8 total)

1. `src/features/architect/tradeMachine/TradeEditor.jsx`
2. `src/features/architect/hooks/useTradeMachine.js`
3. `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
4. `src/features/architect/GMDashboard/GMDashboard.jsx`
5. `src/features/architect/utils/mutationPipeline.js`
6. `src/features/architect/utils/tradeManager.js`
7. `firestore.rules`
8. `firestore.rules.backup`

---

## Workbook Changes

**Section 12 Updated:**

- All 5 rows filled with In UI?, Implemented?, Validated?, Single Source?, Risk
- Section marked AUDITED in Summary Statistics
- Added to Completed Section Audits table
- Key Observations #4 updated

**Statistics Change:**

- UNKNOWN: 13 → 8 (−5)
- YES: 75 → 76 (+1)
- NO: 5 → 7 (+2)
- N/A: 10 → 12 (+2)

---

## Recommendations

1. **Deploy Locked Firestore Rules** — Use `firestore.rules.backup` pattern before production
2. **No Action Required** — Save/Load trade session not in scope; immutability verified

---

## Sign-Off

- [x] Section 12 fully audited
- [x] All 5 rows completed with evidence
- [x] Section Doc created
- [x] Workbook updated
- [x] Return Package created
- [x] Max 12 files referenced (8 used)
- [x] Max 20 evidence entries (5 used)
- [x] No builds/tests/refactors performed
