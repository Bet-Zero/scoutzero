# Trade Machine Fix Plan

> **Version**: 3.0.0 (December 2024)  
> **Purpose**: Prioritized, step-by-step plan to align Trade Machine UI with validation logic and enforce product invariants  
> **Authoritative Reference**: [`docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md`](docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md)  
> **Companion Document**: [`TRADE_MACHINE_AUDIT.md`](TRADE_MACHINE_AUDIT.md)  
> **Target Audience**: Non-technical readers and development team

---

## Executive Summary

This fix plan has been **re-prioritized** based on the four non-negotiable invariants defined in the Master Trade Machine Alignment document. Priority is now determined by:

1. **Invariant compliance** — Does the fix enforce single source of truth, snapshot-only values, or clear labeling?
2. **User impact** — Does the issue cause users to see conflicting or confusing numbers?
3. **Implementation risk** — Could the fix introduce regressions?

The Trade Machine is **largely aligned** thanks to Phase 1-4 work. Remaining work focuses on:
- **P0**: Ensuring all UI surfaces showing Allowable Incoming use the same snapshot field
- **P1**: Adding validator comparison to exploratory tools and ensuring Base vs Matching labels are consistent
- **P2/P3**: Technical debt cleanup and documentation

---

## Fix Priority Legend

| Priority | Meaning | Invariant Basis | Timeline |
|----------|---------|-----------------|----------|
| 🔴 **P0** | Invariant violation — user sees different numbers for same concept | Invariant 1, 2, or 4 | Immediate |
| 🟠 **P1** | High risk of confusion — labels unclear or validator comparison missing | Invariant 3 or partial 1 | This sprint |
| 🟡 **P2** | Technical debt — doesn't violate invariants but increases maintenance burden | N/A | Next sprint |
| 🟢 **P3** | Polish — nice-to-have improvements | N/A | Backlog |

---

## P0 Fixes: Invariant Enforcement (IMMEDIATE)

These fixes are **blockers** because they directly enforce the non-negotiable invariants.

### P0-1: Verify All Allowable Incoming Surfaces Use Same Snapshot Field

**Invariant Reference**: Invariant 1 (Single Source per Concept), Invariant 4 (LIMIT/CURRENT/REMAINING)

**Issue**: Per audit ISSUE-001, `TradeSalaryCalculator.jsx` re-derives `allowableIncoming` locally while `TradeTeamCard.jsx` uses the snapshot. If both are visible simultaneously, users could see different numbers.

**Current State Assessment**:
| Surface | Source | Aligned? |
|---------|--------|----------|
| TradeTeamCard | `snapshot.allowableIncomingNoTPE` | ✅ Yes |
| TradeSummaryPanel | `teamResult.rules.salaryMatching` | ✅ Yes |
| TradeReceiptPanel | Validator result | ✅ Yes |
| TradeSalaryCalculator | Local `getSalaryMatchingResult()` | ⚠️ Intentional but needs disclaimer |

**Acceptance Criteria**:
- [ ] For a given team + trade state + year, Allowable Incoming is identical across TradeTeamCard, TradeSummaryPanel, and TradeReceiptPanel
- [ ] All three read from `teamResult.rules.salaryMatching.allowableIncoming` (or snapshot equivalent)
- [ ] TradeSalaryCalculator (if visible alongside official panels) displays clear "Exploratory — validator is authoritative" disclaimer
- [ ] No UI surface displays a locally-computed Allowable Incoming value without the "Estimate" or "Exploratory" badge

**Implementation**:
1. Audit current code paths for `allowableIncoming` display
2. Ensure all non-exploratory surfaces read from snapshot
3. Add automated test: given same trade state, all snapshot-based surfaces return identical `allowableIncoming`

**Files to Touch**:
| File | Action |
|------|--------|
| `TradeSalaryCalculator.jsx` | Verify disclaimer exists and is prominent |
| `TradeTeamCard.jsx` | Verify reads from snapshot |
| `TradeSummaryPanel.jsx` | Verify reads from snapshot |
| `tests/trade/tradeSnapshotWiring.test.js` | Add/update test for multi-surface consistency |

**How to Validate**:
```bash
# Run snapshot wiring tests
npm run test tests/trade/tradeSnapshotWiring.test.js -- --run

# Manual: Build a trade, compare allowableIncoming in TradeTeamCard vs TradeSummaryPanel
```

---

### P0-2: Ensure Remaining Room Computes from Snapshot Values

**Invariant Reference**: Invariant 4 (LIMIT - CURRENT = Remaining Room)

**Issue**: If any UI computes `remainingRoom` locally instead of from snapshot, it could diverge from the validated state.

**Acceptance Criteria**:
- [ ] If "Remaining Room" (or equivalent) is displayed, it equals `snapshot.allowableIncoming - snapshot.incomingMatchingSalary`
- [ ] Remaining Room updates correctly as incoming selection changes (recalculated after each validation)
- [ ] During validation in-flight, Remaining Room shows "Updating…" or previous value with loading indicator

**Current State**: Remaining Room is not prominently displayed in current UI. If added in future, it MUST use snapshot values.

**Implementation**: Document requirement; no code change needed unless Remaining Room display exists.

**Files to Touch**:
| File | Action |
|------|--------|
| `docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md` | Already documents this (Section 2, Invariant 4) ✅ |

---

### P0-3: Base vs Matching Labels Consistency Audit

**Invariant Reference**: Invariant 3 (Explicit Base vs Matching Labels)

**Issue**: Per audit ISSUE-002, some places show base salary, others show matching value, without clear indication.

**Acceptance Criteria**:
- [ ] All salary displays in trade panels either show base salary (labeled "Contract" or no badge) OR matching salary (with "Adj" badge and tooltip)
- [ ] TradeExportCapture intentionally shows base salary — must have note "Matching values may differ"
- [ ] BYC players show "Adj" badge on outgoing salary with tooltip "BYC: uses max(previous, 50% of new)"
- [ ] Trade kicker players show "Adj" badge on incoming salary with tooltip explaining kicker adjustment
- [ ] Poison pill players show "Adj" badge on incoming salary with tooltip explaining averaging

**Current State Assessment**:
| Surface | Shows Base? | Shows Matching? | Badge When Different? |
|---------|-------------|-----------------|----------------------|
| TradeTeamCard (player list) | ✅ Base | ✅ Matching | ✅ "Adj" badge |
| TradeSummaryPanel (totals) | ❓ | ✅ Matching | Verify |
| TradeExportCapture | ✅ Base only | ❌ | ⚠️ Needs note |

**Implementation**:
1. Audit all salary displays in trade components
2. Ensure "Adj" badge appears when `matchingSalary !== baseSalary`
3. Add note to TradeExportCapture explaining base vs matching

**Files to Touch**:
| File | Action |
|------|--------|
| `TradeTeamCard.jsx` | Verify "Adj" badge logic covers all cases |
| `TradeSummaryPanel.jsx` | Verify labels are explicit |
| `TradeExportCapture.jsx` | Add note about base vs matching |

---

## P1 Fixes: High Priority (THIS SPRINT)

### P1-1: Add Validator Comparison to TradeSalaryCalculator

**Issue Reference**: ISSUE-001

**Plain English**: The exploratory salary calculator shows locally-computed values. Users may be confused when these differ from validation results due to BYC/kicker adjustments.

**Acceptance Criteria**:
- [ ] When validator result is available AND differs from local calculation by >$1, show comparison
- [ ] Display: "Validator will use: $X" in warning color
- [ ] Tooltip explains why values may differ (BYC, trade kicker, poison pill adjustments)

**Implementation**: See original Fix 2 (Option B) for exact code changes.

**Files to Touch**:
| File | Change |
|------|--------|
| `TradeSalaryCalculator.jsx` | Add `validatorAllowable` prop and comparison display |

---

### P1-2: Show Loading State During Validation In-Flight

**Invariant Reference**: Invariant 2 (Snapshot-only after validation)

**Issue Reference**: ISSUE-003

**Plain English**: During the brief window when validation is running, UI should indicate values are updating.

**Current State**: TradeTeamCard shows "Estimate" badge when using local fallback. This is correct.

**Acceptance Criteria**:
- [ ] When validation is triggered but not yet returned, salary displays show loading indicator OR "Estimate" badge
- [ ] Never show locally-computed value as if it were the validated result

**Implementation**: Current implementation is largely correct. Verify and document.

---

## P2 Fixes: Technical Debt (NEXT SPRINT)

### P2-1: Remove Console.log from TradeSummaryPanel

**Issue Reference**: ISSUE-008

**Files to Touch**:
| File | Change |
|------|--------|
| `TradeSummaryPanel.jsx` | Remove `console.log('TEAMRESULT', teamResult);` |

**How to Validate**:
```bash
grep -rn "console.log" src/features/architect/tradeMachine --include="*.jsx"
```

---

### P2-2: Add Deprecation Notices to Re-Export Files

**Issue Reference**: ISSUE-006

**Files to Touch**:
| File | Change |
|------|--------|
| `utils/salaryUtils.js` | Add `@deprecated` JSDoc pointing to canonical sources |
| `utils/computeMatchingValues.js` | Verify deprecation notice exists |

---

### P2-3: Add Skip Reason Tooltip

**Issue Reference**: ISSUE-004

**Files to Touch**:
| File | Change |
|------|--------|
| `TradeTeamCard.jsx` | Add tooltip to "—" display showing `salaryMatchingSkipReason` |

---

## P3 Fixes: Polish (BACKLOG)

### P3-1: Create Salary Display Documentation

**Issue Reference**: ISSUE-002, ISSUE-005

**Files to Touch**:
| File | Change |
|------|--------|
| `docs/tradeMachine/SALARY_DISPLAY_GUIDE.md` | Create new file explaining Base vs Matching display rules |

---

## Acceptance Criteria Summary (P0)

For a Trade Machine implementation to be considered "aligned," ALL of the following must be true:

### Single Source Verification
- [ ] **AC-1**: For a given team + trade state + year, `allowableIncoming` is identical across TradeTeamCard, TradeSummaryPanel, and TradeReceiptPanel
- [ ] **AC-2**: All three surfaces read from the same snapshot field (`teamResult.rules.salaryMatching.allowableIncoming`)
- [ ] **AC-3**: TradeSalaryCalculator (exploratory) has prominent disclaimer and does NOT affect official displays

### Remaining Room Verification
- [ ] **AC-4**: If Remaining Room is displayed, it equals `allowableIncoming - incomingMatchingSalary` from snapshot
- [ ] **AC-5**: Remaining Room updates after each validation run (not computed locally between validations)

### Base vs Matching Verification
- [ ] **AC-6**: All salary displays clearly indicate Base (contract) vs Matching (trade) where they differ
- [ ] **AC-7**: "Adj" badge appears for BYC, trade kicker, and poison pill players with explanatory tooltip
- [ ] **AC-8**: TradeExportCapture shows base salary with note explaining matching values may differ

### Loading State Verification
- [ ] **AC-9**: During validation in-flight, official values show loading indicator or "Estimate" badge
- [ ] **AC-10**: Never display locally-computed value as official result

---

## Verification Checklist (Post-Implementation)

### Automated Tests
- [ ] `npm run build` succeeds
- [ ] `npm run test tests/trade/tradeSnapshotWiring.test.js -- --run` passes
- [ ] `npm run test tests/salaryMatchingRules.test.js -- --run` passes
- [ ] `npm run test tests/trade/ -- --run` passes (all trade tests)

### Manual Verification
- [ ] Build a 2-team trade with equal salaries — validation passes, all surfaces show same allowableIncoming
- [ ] Build a trade with BYC player — see "Adj" badge on outgoing, tooltip explains BYC
- [ ] Build a trade with trade kicker player — see "Adj" badge on incoming, tooltip explains kicker
- [ ] Open TradeSalaryCalculator alongside TradeTeamCard — calculator shows disclaimer, values may differ
- [ ] Trigger validation — official panels show loading state briefly, then snapshot values
- [ ] Export trade image — shows base salaries with note about matching

### Code Quality
- [ ] `grep -rn "console.log" src/features/architect/tradeMachine --include="*.jsx"` returns only gated debug logs
- [ ] All snapshot reads use `useTradeMachineSnapshot.js` accessor

---

## Implementation Order

| Order | Fix ID | Description | Priority | Effort | Invariant |
|-------|--------|-------------|----------|--------|-----------|
| 1 | P0-1 | Verify Allowable Incoming uses same snapshot field | 🔴 P0 | Low | 1, 4 |
| 2 | P0-3 | Base vs Matching labels audit | 🔴 P0 | Medium | 3 |
| 3 | P0-2 | Document Remaining Room requirements | 🔴 P0 | Low | 4 |
| 4 | P1-1 | Add validator comparison to TradeSalaryCalculator | 🟠 P1 | Low | 1 |
| 5 | P1-2 | Verify loading state during validation | 🟠 P1 | Low | 2 |
| 6 | P2-1 | Remove console.log | 🟡 P2 | 1 min | — |
| 7 | P2-2 | Add deprecation notices | 🟡 P2 | 5 min | — |
| 8 | P2-3 | Add skip reason tooltip | 🟡 P2 | 10 min | — |
| 9 | P3-1 | Create salary display documentation | 🟢 P3 | 15 min | — |

**Total estimated effort**: ~2-3 hours for P0-P2 fixes

---

## What NOT to Change

These are **intentional design choices** documented in the Master Alignment document:

1. **TradeExportCapture using base salary** — Intentional (roster reality view). Add note, don't change behavior.
2. **CapImpactTiles excluding cap holds from projected** — Intentional for trade matching semantics per DG-1/DG-2.
3. **Estimate badges during validation delay** — Working as designed per Invariant 2.
4. **TradeSalaryCalculator using local calculation** — Intentional as exploratory tool. Add disclaimer, don't wire to snapshot.
5. **Multiple re-export files** — Keep for backwards compatibility, just add deprecation notices.

---

## Commands for Testing

```bash
# Run all tests
npm run test -- --run

# Run trade-specific tests
npm run test tests/trade/ -- --run

# Run snapshot wiring tests
npm run test tests/trade/tradeSnapshotWiring.test.js -- --run

# Run salary matching tests
npm run test tests/salaryMatchingRules.test.js -- --run

# Check for console.log statements
grep -rn "console.log" src/features/architect/tradeMachine --include="*.jsx"

# Build check
npm run build
```

---

## Future Considerations (Out of Scope)

Per audit and gap analysis, these items are deferred:

1. **Incomplete Roster Charges** — Placeholder exists in `computeTeamCapTotals.js`
2. **Options/Non-Guaranteed Handling** — Would require schema changes
3. **Recently Signed FA Restriction** — 3-month restriction not implemented (edge case)
4. **Real-time Validation Feedback** — Could add debounced feedback (UX enhancement)

---

## Document References

- **Master Document**: [`docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md`](docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md) — Defines invariants and policies
- **Audit**: [`TRADE_MACHINE_AUDIT.md`](TRADE_MACHINE_AUDIT.md) — Detailed issue findings
- **Gap Analysis**: [`docs/TRADE_MACHINE_GAP_ANALYSIS.md`](docs/TRADE_MACHINE_GAP_ANALYSIS.md) — Root cause analysis

---

*End of Fix Plan v3.0*
