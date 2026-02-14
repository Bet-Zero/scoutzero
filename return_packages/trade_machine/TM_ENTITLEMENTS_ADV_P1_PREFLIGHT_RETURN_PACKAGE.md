# TM-ENTITLEMENTS-ADV-P1 PREFLIGHT RETURN PACKAGE

**Ticket:** TM-ENTITLEMENTS-ADV-P1  
**Mode:** PREFLIGHT (discovery-only)  
**Status:** COMPLETE  
**Date:** 2026-02-14

---

## Summary

This PREFLIGHT phase established the canonical "advanced entitlement system" contract and identified gaps for complex NBA pick-right patterns.

**Key Findings:**

1. Three entitlement kinds fully implemented: `pick_ownership`, `swap_right`, `conveyance_right`
2. `team.entitlementIds[]` is the **single source of truth** for ownership
3. Editor coverage: 88% via UI, 100% via JSON
4. Chained constructs (Houston-style multi-entitlement patterns) require schema extension

**Master Doc:** [TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md](../../docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md)

---

## 1. Field Semantics Table (Summary)

| Kind               | Required Fields                                                                              | Semantic Fields                                             | Display-Only |
| ------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------ |
| `pick_ownership`   | holderTeam, seasonYear, round, kind, underlyingPickId                                        | underlyingStatus, coveredByEntitlementIds, protectionLadder | description  |
| `swap_right`       | holderTeam, seasonYear, round, kind, swapControllerPickId, swapTargetDefinition              | swapType, poolUnderlyingPickIds                             | description  |
| `conveyance_right` | holderTeam, seasonYear, round, kind, poolUnderlyingPickIds, receivesRank, receivesComparator | —                                                           | description  |

**Full table:** [Master Doc §1.2](../../docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md#12-field-semantics-table)

---

## 2. Pattern Support Matrix (Summary)

| Pattern                       | Status         | Implementation                                 |
| ----------------------------- | -------------- | ---------------------------------------------- |
| **A.** Unprotected pick       | ✅ Supported   | `pick_ownership` + `underlyingPickId`          |
| **B.** Single-year protection | ✅ Supported   | `protectionLadder[]` with 1 tier               |
| **C.** Multi-year ladder      | ✅ Supported   | `protectionLadder[]` with N tiers              |
| **D.** Two-pick swap          | ✅ Supported   | `swap_right` + `swapControllerPickId`          |
| **E.** N-pick pool            | ✅ Supported   | `conveyance_right` + `poolUnderlyingPickIds[]` |
| **F.** Chained constructs     | ⚠️ **Partial** | Multiple entitlements, no linkage field        |

**Full matrix:** [Master Doc §2](../../docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md#2-pattern-support-matrix)

---

## 3. Advanced Editor Coverage Checklist

| Field                   | UI Tab     | JSON   | Status             |
| ----------------------- | ---------- | ------ | ------------------ |
| holderTeam              | Basics     | Locked | ⚠️ Identity locked |
| seasonYear              | Basics     | Locked | ⚠️ Identity locked |
| round                   | Basics     | Locked | ⚠️ Identity locked |
| kind                    | Basics     | Locked | ⚠️ Identity locked |
| underlyingPickId        | Basics     | Locked | ⚠️ Identity locked |
| swapControllerPickId    | Swap       | Locked | ⚠️ Identity locked |
| description             | Basics     | ✅     | ✅ Editable        |
| underlyingStatus        | Basics     | ✅     | ✅ Editable        |
| protectionLadder        | Protection | ✅     | ✅ Editable        |
| swapTargetDefinition    | Swap       | ✅     | ✅ Editable        |
| swapType                | Swap       | ✅     | ✅ Editable        |
| poolUnderlyingPickIds   | Swap/Conv  | ✅     | ✅ Editable        |
| receivesRank            | Conveyance | ✅     | ✅ Editable        |
| receivesComparator      | Conveyance | ✅     | ✅ Editable        |
| coveredByEntitlementIds | ❌         | ✅     | ⚠️ JSON only       |
| evidenceRowRefs         | ❌         | ✅     | ⚠️ JSON only       |
| sourceUrl               | ❌         | ✅     | ⚠️ JSON only       |

**Full checklist:** [Master Doc §3.2](../../docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md#32-field-editability-checklist)

---

## 4. Ownership Truth Conclusion

> **`team.entitlementIds[]` is the single source of truth for entitlement ownership.**

`holderTeam` on the entitlement document is a display convenience field. The resolver (`entitlementResolver.ts`) determines ownership solely by `entitlementIds[]` membership.

**Why this design?**

- Allows the same base entitlement document to be "owned" by different teams in different worlds
- World overrides patch `holderTeam` for display correctness but do not affect resolution
- Vacuum mode patches `holderTeam` in memory at resolve time

**Code evidence:**

- `resolveTeamEntitlementIds()` reads `entitlementIds[]` from team doc
- `resolveEntitlementsForTeam()` fetches only IDs in that array
- Vacuum transfers exclude/include by ID, then patch `holderTeam` on resolved docs

**Full analysis:** [Master Doc §4](../../docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md#4-trade-execution-truth-single-source-of-ownership)

---

## 5. Gap List + Recommended Options

| Gap                                      | Severity | Recommendation                                                  |
| ---------------------------------------- | -------- | --------------------------------------------------------------- |
| Chained constructs not linkable          | High     | Add `linkedEntitlementIds[]` + `residualOfEntitlementId` fields |
| `coveredByEntitlementIds` no UI          | Medium   | Add multi-select to Basics tab                                  |
| No "trade as package"                    | Medium   | Add warning if linked entitlement not included                  |
| No cross-entitlement conflict validation | Medium   | Add warning when swap's controller is also outgoing             |

**Full gap analysis:** [Master Doc §5](../../docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md#5-gap-list--minimal-fix-options)

---

## 6. E1 Execution Punchlist

### Phase 1: Schema + Validation (Priority 1)

| ID     | Task                                   | File(s)                    | Acceptance                             |
| ------ | -------------------------------------- | -------------------------- | -------------------------------------- |
| E1-1.1 | Add `linkedEntitlementIds?: string[]`  | `src/schemas/architect.ts` | Validates as optional string[]         |
| E1-1.2 | Add `residualOfEntitlementId?: string` | `src/schemas/architect.ts` | Validates as optional string           |
| E1-1.3 | Cross-entitlement conflict warning     | `entitlementWarnings.js`   | Warns when swap controller is outgoing |
| E1-1.4 | Linked entitlement warning             | `entitlementWarnings.js`   | Warns when linked not included         |

### Phase 2: Editor UI (Priority 2)

| ID     | Task                             | File(s)                          | Acceptance                      |
| ------ | -------------------------------- | -------------------------------- | ------------------------------- |
| E1-2.1 | Add `linkedEntitlementIds` UI    | `EntitlementEditorBasicsTab.tsx` | Multi-select or textarea        |
| E1-2.2 | Add `residualOfEntitlementId` UI | `EntitlementEditorSwapTab.tsx`   | Dropdown from conveyance_rights |
| E1-2.3 | Add `coveredByEntitlementIds` UI | `EntitlementEditorBasicsTab.tsx` | Multi-select control            |

### Phase 3: Trade Display (Priority 3)

| ID     | Task                      | File(s)                    | Acceptance         |
| ------ | ------------------------- | -------------------------- | ------------------ |
| E1-3.1 | Group linked entitlements | `EntitlementPicksList.jsx` | Visual grouping    |
| E1-3.2 | Show linkage in preview   | `PickTermsPreview.tsx`     | Display linked IDs |

### Phase 4: Documentation (Priority 4)

| ID     | Task                 | File(s)                                 | Acceptance                      |
| ------ | -------------------- | --------------------------------------- | ------------------------------- |
| E1-4.1 | Update schema notes  | `ENTITLEMENT_AUTHORING_SCHEMA_NOTES.md` | Document new fields             |
| E1-4.2 | Add chained examples | Master Doc                              | JSON examples for Houston-style |

---

## Deliverables Created

1. ✅ **Master Doc:** [docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md](../../docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md)
   - Field semantics table
   - Pattern support matrix
   - Editor capability audit
   - Ownership truth analysis
   - Gap list + options
   - E1 punchlist

2. ✅ **Return Package:** This file

---

## Next Steps

1. **Review:** Confirm E1 punchlist priorities with stakeholder
2. **Decide:** Option selection for Gap 1 (chained constructs) — recommend 1B + 1C
3. **Execute:** Begin E1-1.x schema additions when approved
