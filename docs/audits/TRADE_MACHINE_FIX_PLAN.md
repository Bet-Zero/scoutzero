# Trade Machine Fix Plan

> **Version**: 4.1.0 (January 2026)  
> **Purpose**: Prioritized, step-by-step plan to align Trade Machine UI with validation logic and enforce product invariants  
> **Authoritative Reference**: [`docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md`](docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md)  
> **Companion Document**: [`TRADE_MACHINE_AUDIT.md`](TRADE_MACHINE_AUDIT.md)  
> **Target Audience**: Non-technical readers and development team

---

## Executive Summary

This fix plan has been **rewritten** to strictly implement the four non-negotiable invariants defined in the Master Trade Machine Alignment document (v1.1.0). Priorities now reflect invariant enforcement:

- **P0**: Snapshot-only enforcement + identical Allowable Incoming across all surfaces + in-flight "Calculating/Updating" UI policy
- **P1**: Base vs Matching labeling policy applied consistently
- **P2**: TradeSalaryCalculator policy (snapshot-driven when available OR strict sandbox/official visual separation)
- **P3**: Cleanup (console.log, import docs, tooltips, extra docs)

All P0 items are **blockers** — the Trade Machine cannot be considered aligned until P0 acceptance criteria pass.

---

## Fix Priority Legend

| Priority | Meaning | Invariant Basis | Timeline |
|----------|---------|-----------------|----------|
| 🔴 **P0** | Invariant violation — snapshot-only enforcement, identical values across surfaces, in-flight UI | Invariant 1, 2, and 4 | Immediate |
| 🟠 **P1** | High risk of confusion — Base vs Matching labels unclear or inconsistent | Invariant 3 | This sprint |
| 🟡 **P2** | Exploratory tool policy — TradeSalaryCalculator visual separation requirement | Section 3.4 exception | Next sprint |
| 🟢 **P3** | Cleanup — console.log, deprecation notices, tooltips, extra documentation | N/A | Backlog |

---

## P0 Fixes: Snapshot-Only Enforcement (IMMEDIATE BLOCKERS)

These fixes enforce the core invariants. All P0 acceptance criteria MUST pass for alignment.

### P0-1: Identical Allowable Incoming Across All Surfaces

**Invariant Reference**: Invariant 1 (Single Source per Concept), Invariant 4 (LIMIT/CURRENT/REMAINING)

**Requirement**: For the same team + trade state + year, Allowable Incoming MUST be identical across TradeTeamCard, TradeSummaryPanel, TradeReceiptPanel, and TradeValidationPanel.

**Canonical Source**: `teamResult.rules.salaryMatching.allowableIncoming`

**Current State Assessment**:

| Surface | Source | Aligned? |
|---------|--------|----------|
| TradeTeamCard | `snapshot.allowableIncomingNoTPE` | ✅ Yes (accessor to canonical) |
| TradeSummaryPanel | `teamResult.rules.salaryMatching` | ✅ Yes |
| TradeReceiptPanel | Validator result | ✅ Yes |
| TradeValidationPanel | Validator result | ✅ Yes |
| TradeSalaryCalculator | Local `getSalaryMatchingResult()` | ⚠️ Exception — see P2 |

**Implementation**:

1. Verify all non-exploratory surfaces read from `teamResult.rules.salaryMatching.allowableIncoming` (or accessor alias)
2. Add automated test: given same trade state, all snapshot-based surfaces return identical `allowableIncoming`
3. Document that snapshot accessor fields are aliases, not alternative sources

**Files to Touch**:

| File | Action |
|------|--------|
| `TradeTeamCard.jsx` | Verify reads from canonical source via accessor |
| `TradeSummaryPanel.jsx` | Verify reads from canonical source |
| `TradeReceiptPanel.jsx` | Verify reads from canonical source |
| `tests/trade/tradeSnapshotWiring.test.js` | Add/update test for multi-surface consistency |

---

### P0-2: Snapshot-Only for Official Values (Post-Validation)

**Invariant Reference**: Invariant 2 (Snapshot-Only for Official Values)

**Requirement**: After validation runs, ALL official salary matching values (`salaryOut`, `salaryIn`, `allowableIncoming`, `passed/failed`) MUST come from the validator snapshot. No local recalculation.

**Canonical Source**: `teamResult.rules.salaryMatching.*`

**Implementation**:

1. Audit all code paths that display official values
2. Ensure no local calculation replaces snapshot values after validation exists
3. Only exception: TradeSalaryCalculator (see P2)

**Files to Touch**:

| File | Action |
|------|--------|
| `TradeTeamCard.jsx` | Confirm snapshot-only for outgoing/incoming/allowable |
| `TradeSummaryPanel.jsx` | Confirm snapshot-only for totals |
| `useTradeMachineSnapshot.js` | Document as canonical accessor |

---

### P0-3: In-Flight "Calculating/Updating" UI Policy

**Invariant Reference**: Invariant 2 (During validation-in-flight, UI MUST show "Calculating…" or "Updating…")

**Requirement**: When validation is triggered but not yet returned, UI MUST show loading state — never display locally-computed value as official result.

**Policy**:

| Scenario | Display |
|----------|---------|
| First validation ever | "Calculating…" or loading skeleton |
| Re-validation after change | Previous value with "Updating…" overlay or spinner |
| Validation error | Previous value (if any) + error banner |

**Implementation**:

1. Verify loading state logic in all panels displaying official values
2. Ensure "Estimate" badge appears when using local fallback (pre-validation only)
3. Never show locally-computed value as official result during or after validation

**Current State**: TradeTeamCard shows "Estimate" badge when using local fallback — verify this is correct.

**Files to Touch**:

| File | Action |
|------|--------|
| `TradeTeamCard.jsx` | Verify loading state during in-flight |
| `TradeSummaryPanel.jsx` | Verify loading state during in-flight |

---

### P0-4: Remaining Room from Snapshot Values

**Invariant Reference**: Invariant 4 (LIMIT - CURRENT = Remaining Room)

**Requirement**: If "Remaining Room" (or equivalent) is displayed, it MUST equal:

```text
Remaining Room = Allowable Incoming (snapshot) - Incoming Selected (snapshot-derived matching total)
```

**Incoming Selected Source**: `teamResult.salaryIn` (canonical team-level incoming matching total). If unavailable, sum `player.matchingSalaryIn` for all incoming players on that team. Never use base salary helpers.

**Current State**: Remaining Room is not prominently displayed in current UI. Requirement documented for future implementation.

**Implementation**: If Remaining Room display exists or is added:

1. Source both values from snapshot
2. Show calculation breakdown: "Remaining = $X (Allowable) - $Y (Selected)"
3. Update after each validation run

**Files to Touch**:

| File | Action |
|------|--------|
| `docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md` | Already documents this (Section 1.2, 2.4) ✅ |
| Any component displaying Remaining Room | Verify uses snapshot formula |

---

## P0 Acceptance Criteria (ALL MUST PASS)

For a Trade Machine implementation to be considered "aligned," ALL of the following MUST be true:

### AC-1: Identical Allowable Incoming
>
> **For the same team + trade state + year: Allowable Incoming is identical in TradeTeamCard, TradeSummaryPanel, TradeReceiptPanel, and TradeValidationPanel.**

Test: Build a trade, verify `allowableIncoming` value matches across all four surfaces.

### AC-2: Canonical Source Only
>
> **All non-exploratory surfaces read Allowable Incoming from `teamResult.rules.salaryMatching.allowableIncoming` (or snapshot accessor alias).**

Test: Grep codebase for `allowableIncoming` displays, verify each non-exploratory surface uses canonical source.

### AC-3: No Local Recalculation Post-Validation
>
> **After validation exists, no UI surface (except TradeSalaryCalculator) computes matching values locally.**

Test: Review code paths, verify no `getSalaryMatchingResult()` calls in official display paths.

### AC-4: In-Flight Loading State
>
> **During validation-in-flight, official panels show "Calculating…", "Updating…", or loading indicator — never locally-computed values presented as official.**

Test: Trigger validation, observe loading state in TradeTeamCard/TradeSummaryPanel before result returns.

### AC-5: Remaining Room Formula
>
> **If Remaining Room is implemented: Remaining Room = Allowable Incoming (snapshot) - Incoming Selected (snapshot-derived matching total).**

Test: If displayed, verify formula uses snapshot values only.

---

## P1 Fixes: Base vs Matching Labeling (THIS SPRINT)

### P1-1: Consistent Base vs Matching Labels

**Invariant Reference**: Invariant 3 (Explicit Base vs Matching Labels)

**Requirement**: All salary displays clearly indicate Base (contract) vs Matching (trade) where they differ.

**Policy**:

| Context | Display |
|---------|---------|
| Base salary | Label as "Contract Salary", "Base", or no badge |
| Matching salary (differs from base) | Show purple "Adj" badge with tooltip explaining adjustment |
| Export/download views | Show base salary with note "Matching values may differ" |

**Acceptance Criteria**:

- [ ] All salary displays in trade panels show base OR matching with clear indication
- [ ] BYC players show "Adj" badge on outgoing with tooltip: "BYC: uses max(previous, 50% of new)"
- [ ] Trade kicker players show "Adj" badge on incoming with tooltip explaining kicker
- [ ] Poison pill players show "Adj" badge on incoming with tooltip explaining averaging
- [ ] TradeExportCapture shows base salary with note about matching

**Files to Touch**:

| File | Action |
|------|--------|
| `TradeTeamCard.jsx` | Verify "Adj" badge logic covers BYC, kicker, poison pill |
| `TradeSummaryPanel.jsx` | Verify labels are explicit |
| `TradeExportCapture.jsx` | Add note about base vs matching |

---

## P2 Fixes: TradeSalaryCalculator Policy (NEXT SPRINT)

### P2-1: TradeSalaryCalculator Sandbox/Official Separation

**Reference**: Master Document Section 3.4 (Exploratory Tools Exception)

**Requirement**: TradeSalaryCalculator is the **ONLY** allowed exception to Invariant 2. It MUST visually separate "Sandbox Estimate" values from "Official Validator" values.

**Policy Options**:

1. **Snapshot-Driven When Available**: Show validator values as primary, local estimates as secondary comparison
2. **Strict Sandbox/Official Separation**: Distinct visual sections with clear headers

**Visual Separation Requirements**:

- Distinct visual sections or cards (e.g., "Sandbox Estimate" header vs "Official Result" header)
- Color coding (e.g., gray/muted for sandbox, primary color for official)
- Clear labels on every value indicating source (estimate vs validated)
- Prominent disclaimer: "Exploratory tool — validator is authoritative"

**Acceptance Criteria**:

- [ ] TradeSalaryCalculator has prominent disclaimer
- [ ] Sandbox values visually separated from official values
- [ ] When validator result is available AND differs from local by >$1, show comparison: "Validator will use: $X"
- [ ] Tooltip explains why values may differ (BYC, trade kicker, poison pill)

**Files to Touch**:

| File | Action |
|------|--------|
| `TradeSalaryCalculator.jsx` | Add visual separation, disclaimer, validator comparison |

---

## P3 Fixes: Cleanup (BACKLOG)

### P3-1: Remove Console.log from TradeSummaryPanel

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

### P3-2: Add Deprecation Notices to Re-Export Files

**Issue Reference**: ISSUE-006

**Files to Touch**:

| File | Change |
|------|--------|
| `utils/salaryUtils.js` | Add `@deprecated` JSDoc pointing to canonical sources |
| `utils/computeMatchingValues.js` | Verify deprecation notice exists |

---

### P3-3: Add Skip Reason Tooltip

**Issue Reference**: ISSUE-004

**Files to Touch**:

| File | Change |
|------|--------|
| `TradeTeamCard.jsx` | Add tooltip to "—" display showing `salaryMatchingSkipReason` |

---

### P3-4: Create Salary Display Documentation

**Issue Reference**: ISSUE-002, ISSUE-005

**Files to Touch**:

| File | Change |
|------|--------|
| `docs/tradeMachine/SALARY_DISPLAY_GUIDE.md` | Create new file explaining Base vs Matching display rules |

---

## Implementation Order

| Order | Fix ID | Description | Priority | Invariant |
|-------|--------|-------------|----------|-----------|
| 1 | P0-1 | Identical Allowable Incoming across all surfaces | 🔴 P0 | 1, 4 |
| 2 | P0-2 | Snapshot-only for official values | 🔴 P0 | 2 |
| 3 | P0-3 | In-flight "Calculating/Updating" UI policy | 🔴 P0 | 2 |
| 4 | P0-4 | Remaining Room from snapshot values | 🔴 P0 | 4 |
| 5 | P1-1 | Base vs Matching labels consistency | 🟠 P1 | 3 |
| 6 | P2-1 | TradeSalaryCalculator sandbox/official separation | 🟡 P2 | 3.4 exception |
| 7 | P3-1 | Remove console.log | 🟢 P3 | — |
| 8 | P3-2 | Add deprecation notices | 🟢 P3 | — |
| 9 | P3-3 | Add skip reason tooltip | 🟢 P3 | — |
| 10 | P3-4 | Create salary display documentation | 🟢 P3 | — |

**Total estimated effort**: ~2-3 hours for P0-P2 fixes

---

## What NOT to Change

These are **intentional design choices** documented in the Master Alignment document:

1. **TradeExportCapture using base salary** — Intentional (roster reality view). Add note, don't change behavior.
2. **CapImpactTiles excluding cap holds from projected** — Intentional for trade matching semantics per DG-1/DG-2.
3. **Estimate badges during validation delay** — Working as designed per Invariant 2.
4. **TradeSalaryCalculator using local calculation** — Intentional as exploratory tool. Apply P2 visual separation, don't wire to snapshot as primary.
5. **Multiple re-export files** — Keep for backwards compatibility, just add deprecation notices.

---

## Verification Checklist (Post-Implementation)

### Automated Tests

- [ ] `npm run build` succeeds
- [ ] `npm run test tests/trade/tradeSnapshotWiring.test.js -- --run` passes
- [ ] `npm run test tests/salaryMatchingRules.test.js -- --run` passes
- [ ] `npm run test tests/trade/ -- --run` passes (all trade tests)

### Manual Verification

- [ ] Build a 2-team trade with equal salaries — validation passes, all surfaces show same `allowableIncoming`
- [ ] Build a trade with BYC player — see "Adj" badge on outgoing, tooltip explains BYC
- [ ] Build a trade with trade kicker player — see "Adj" badge on incoming, tooltip explains kicker
- [ ] Open TradeSalaryCalculator alongside TradeTeamCard — calculator shows disclaimer, visual separation of sandbox vs official
- [ ] Trigger validation — official panels show loading state briefly, then snapshot values
- [ ] Export trade image — shows base salaries with note about matching

### Code Quality

- [ ] `grep -rn "console.log" src/features/architect/tradeMachine --include="*.jsx"` returns only gated debug logs
- [ ] All snapshot reads use `useTradeMachineSnapshot.js` accessor

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

- **Master Document**: [`docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md`](docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md) — Defines invariants and policies (v1.1.0)
- **Audit**: [`TRADE_MACHINE_AUDIT.md`](TRADE_MACHINE_AUDIT.md) — Detailed issue findings
- **Gap Analysis**: [`docs/TRADE_MACHINE_GAP_ANALYSIS.md`](docs/TRADE_MACHINE_GAP_ANALYSIS.md) — Root cause analysis

---

---

## Amendment Log

| Date | Version | Change | Author |
|------|---------|--------|--------|
| Dec 2024 | 4.0.0 | Initial rewrite to enforce Master Alignment invariants | Trade Machine Team |
| Jan 2026 | 4.1.0 | Canonical field alignment: Updated P0-2 to use `teamResult.salaryOut/salaryIn` as canonical OUT/IN sources per repo audit; Retained `teamResult.rules.salaryMatching.*` for allowableIncoming, passed, and ruleApplied | Trade Machine Team |

---

*End of Fix Plan v4.1*
