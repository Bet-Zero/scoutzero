# Master Trade Machine Alignment Document

> **Version**: 1.0.0 (December 2024)  
> **Purpose**: Define non-negotiable product invariants, terminology definitions, and UI policies for Trade Machine salary display consistency  
> **Companion Documents**:  
> - [`TRADE_MACHINE_AUDIT.md`](../../TRADE_MACHINE_AUDIT.md) — Detailed audit of UI vs validator mismatches  
> - [`TRADE_MACHINE_FIX_PLAN.md`](../../TRADE_MACHINE_FIX_PLAN.md) — Prioritized implementation plan

---

## 1. Definitions

This section establishes canonical terminology. All code, UI labels, and documentation MUST use these terms consistently.

### 1.1 Base Salary vs Matching Salary

| Term | Definition | Example |
|------|------------|---------|
| **Base Salary** (Contract Salary) | The actual dollar amount specified in the player's contract for a given year. This is the "roster reality" value that appears on cap sheets. | Player signed for $20M/year → Base Salary = $20,000,000 |
| **Matching Salary** (Trade Value) | The adjusted salary used for trade matching calculations. May differ from base salary due to BYC, trade kicker, or poison pill rules. | BYC player with $20M contract but $8M previous salary → Matching Salary = max($8M, $10M) = $10M |

**Key Distinctions:**

- **Base Year Compensation (BYC)**: For outgoing players whose salary increased >~100% in one year, matching value = max(previous salary, 50% of new salary)
- **Trade Kicker**: For incoming players, matching value = base salary + prorated kicker amount
- **Poison Pill (Rookie Extension)**: For incoming players on recently-signed rookie extensions, matching value = average of current + extension year salaries

### 1.2 Allowable Incoming vs Remaining Room

| Term | Definition | Formula |
|------|------------|---------|
| **Allowable Incoming** | The maximum total **matching salary** a team can receive in a trade, based on what they are sending out and their cap status. This is a **LIMIT**. | Depends on tier (see Section 3) |
| **Incoming Selected** | The sum of **matching salaries** of players currently selected to be received by a team. This is the **CURRENT** value. | Σ(matchingSalary of all incoming players) |
| **Remaining Room** | How much more matching salary a team can receive before hitting their Allowable Incoming limit. | **LIMIT - CURRENT** = Allowable Incoming - Incoming Selected |

**Important**: Remaining Room is NOT the same as "cap room." Cap room refers to space under the salary cap. Remaining Room refers to space under the salary matching ceiling for a specific trade.

### 1.3 Apron Status

| Term | Definition | Implications |
|------|------------|--------------|
| **Under Cap** | Team total salary < salary cap | Can absorb salary up to cap ceiling using cap room |
| **Over Cap (Under Apron)** | Salary cap ≤ team total < first apron | Uses tiered matching bands (175-200% + addition for small trades) |
| **First Apron** | First apron ≤ team total < second apron | 100% matching only — cannot receive more than sent |
| **Second Apron** | Team total ≥ second apron | 100% matching + no aggregation + additional restrictions |

---

## 2. Non-Negotiable Invariants

These four invariants MUST be enforced in all Trade Machine code. Violations are P0 blockers.

### Invariant 1: Single Source per Concept

> **If the same concept is displayed in multiple UI locations, it MUST use the SAME SOURCE/PIPELINE once validation exists (validator snapshot).**

**Rationale**: Users should never see "Allowable Incoming: $15M" in one panel and "Allowable Incoming: $13M" in another. This destroys trust.

**Implementation**: Once `validateTrade()` runs and produces a result, ALL UI surfaces displaying `allowableIncoming` MUST read from `teamResult.rules.salaryMatching.allowableIncoming` (the snapshot field).

### Invariant 2: Snapshot-Only for Official Values

> **"Official" salary matching numbers (outgoing matching, incoming matching, allowable incoming, passed/failed status) are snapshot-only after validation runs. During validation-in-flight, UI MUST show "Calculating…" or "Updating…".**

**Rationale**: Prevents race conditions where UI shows stale data while validator recomputes.

**Implementation**:
- Official values: `outgoingMatchingSalary`, `incomingMatchingSalary`, `allowableIncoming`, `salaryMatching.passed`
- Source: `useTradeMachineSnapshot.js` accessor
- During validation: Show loading indicator (e.g., "Calculating…", spinner, or skeleton)
- Never display a locally-computed value alongside a snapshot value for the same concept

### Invariant 3: Explicit Base vs Matching Labels

> **Base (Contract) vs Matching (Trade) salary MUST be explicitly labeled in any place where users might confuse them.**

**Rationale**: A $20M player might have an $8M matching value (BYC) or $23M matching value (trade kicker). Users need to know which they're looking at.

**Implementation**:
- When showing base salary: Label as "Contract Salary", "Base", or show no badge
- When showing matching salary (different from base): Show purple "Adj" badge with tooltip explaining adjustment
- In export/download views: Show base salary (roster reality) with note "Matching values may differ"

### Invariant 4: Clear LIMIT/CURRENT/REMAINING Distinction

> **Distinguish: Allowable Incoming = LIMIT, Incoming Selected = CURRENT, Remaining Room = LIMIT - CURRENT. If Remaining Room is displayed, it MUST be computed from snapshot-derived values where matching adjustments apply.**

**Rationale**: Users often confuse "how much can I receive?" with "how much have I selected to receive?" and "how much more can I add?"

**Implementation**:
- `allowableIncoming` → Label as "Allowable" or "Max Incoming" (the limit)
- Sum of incoming matching salaries → Label as "Selected" or "Incoming Total" (the current)
- Difference → Label as "Remaining Room" or "Available" with calculation shown
- Remaining Room MUST use `snapshot.allowableIncoming - snapshot.incomingMatchingSalary` (not local recalculation)

---

## 3. UI Policy

### 3.1 What May Be Estimated (Pre-Validation)

These values MAY be displayed with an "Estimate" badge before validation runs:

| Value | Estimation Source | Badge Required |
|-------|-------------------|----------------|
| Outgoing Salary | `getSalaryForYear()` from tradeHelpers | ✅ "Estimate" |
| Incoming Salary | `getSalaryForYear()` from tradeHelpers | ✅ "Estimate" |
| Allowable Incoming (exploratory) | `getSalaryMatchingResult()` local calc | ✅ "Estimate" + "Validator may differ" |

**Purpose**: Allow users to explore "what if" scenarios before committing to a trade configuration that triggers validation.

### 3.2 What Must Be Snapshot-Only (Post-Validation)

These values MUST come from the validator snapshot once validation has run:

| Value | Snapshot Field | UI Must Show |
|-------|----------------|--------------|
| Outgoing Matching Salary | `snapshot.outgoingMatchingSalary` | Exact validator value |
| Incoming Matching Salary | `snapshot.incomingMatchingSalary` | Exact validator value |
| Allowable Incoming | `snapshot.allowableIncoming` OR `teamResult.rules.salaryMatching.allowableIncoming` | Exact validator value |
| Matching Rule Applied | `snapshot.matchingRule` or `teamResult.rules.salaryMatching.ruleLabel` | Exact rule label |
| Passed/Failed | `teamResult.rules.salaryMatching.passed` | Boolean status |
| Remaining Room (if shown) | `allowableIncoming - incomingMatchingSalary` (from snapshot) | Calculated from snapshot |

### 3.3 What to Show During Validation In-Flight

When validation is running (user has made a change, validation triggered, result not yet returned):

| Scenario | Display |
|----------|---------|
| First validation ever | "Calculating…" or loading skeleton |
| Re-validation after change | Previous value with "Updating…" overlay or spinner |
| Validation error | Previous value (if any) + error banner |

**Never show**: A locally-computed value presented as if it were the official validated result.

### 3.4 Exploratory Tools Exception

`TradeSalaryCalculator.jsx` is designated as an **exploratory tool**. It:
- Re-derives matching values locally for user experimentation
- MUST include disclaimer: "Exploratory tool — validator is authoritative"
- SHOULD show validator comparison when available: "Validator will use: $X" if differs from local calculation
- MAY show different numbers than the snapshot for educational/exploration purposes

---

## 4. Must-Match UI Surfaces

The following UI surfaces display salary matching values and MUST use the same snapshot source after validation:

### 4.1 Allowable Incoming Surfaces

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| **TradeTeamCard** | `src/features/architect/tradeMachine/TradeTeamCard.jsx` | ✅ Uses snapshot | Primary display — shows `allowableIncomingNoTPE` from snapshot |
| **TradeSummaryPanel** | `src/features/architect/tradeMachine/TradeSummaryPanel.jsx` | ✅ Uses snapshot | Summary view — reads from `teamResult` |
| **TradeSalaryCalculator** | `src/features/architect/tradeMachine/TradeSalaryCalculator.jsx` | ⚠️ Local calculation | Exploratory tool — by design uses local `getSalaryMatchingResult()`. MUST show disclaimer. |
| **TradeReceiptPanel** | `src/features/architect/tradeMachine/TradeReceiptPanel.jsx` | ✅ Uses snapshot | Debug panel — shows exact validator values |
| **TradeValidationPanel** | `src/features/architect/tradeMachine/TradeValidationPanel.jsx` | ✅ Uses snapshot | Rule-by-rule breakdown from validator |

### 4.2 Outgoing/Incoming Matching Salary Surfaces

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| **TradeTeamCard** | `TradeTeamCard.jsx` (lines 135-142) | ✅ Uses snapshot with fallback | Shows "Estimate" badge when using local fallback |
| **TradeSummaryPanel** | `TradeSummaryPanel.jsx` (line 121) | ✅ Uses snapshot | Reads from `teamResult.salaryOut/In` |
| **TradeExportCapture** | `TradeExportCapture.jsx` (line 139) | ⚠️ Uses base salary | Intentional — export shows "roster reality" not matching values |

### 4.3 Matching Rule Label Surfaces

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| **TradeTeamCard** | `TradeTeamCard.jsx` (lines 240-245) | ✅ Uses snapshot | Shows rule from `snapshot.matchingRule` |
| **TradeSalaryCalculator** | `TradeSalaryCalculator.jsx` (line 68) | ⚠️ Local calculation | Exploratory — may show different rule than validator |

### 4.4 Discovered Surfaces (From Code Scan)

Additional files that reference `allowableIncoming` and may need alignment:

| File | Purpose | Action Required |
|------|---------|-----------------|
| `salaryMatchingRules.js` | Single source of truth for matching calculations | N/A — this IS the source |
| `validateSalaryMatching.js` | Validator rule implementation | N/A — produces the snapshot |
| `useTradeMachineSnapshot.js` | Snapshot accessor hook | N/A — provides snapshot values |
| `tradeHelpers.js` | Legacy helpers with `calculateAllowableIncoming()` | ⚠️ May conflict with snapshot — review usage |
| `salaryMargin.js` | Utility for margin calculations | Verify uses snapshot when available |
| `capUtils.js` | Cap-related utilities | Verify doesn't duplicate matching logic |

---

## 5. Verification Checklist

Use this checklist when implementing or reviewing Trade Machine changes:

### Pre-Implementation
- [ ] I have read this Master Alignment document
- [ ] I understand which values must come from snapshot vs may be estimated
- [ ] I know which UI surfaces must match

### Implementation
- [ ] New/modified code reads from snapshot accessor (`useTradeMachineSnapshot.js`) for official values
- [ ] Base vs Matching salary is clearly labeled where they differ
- [ ] Allowable Incoming uses `teamResult.rules.salaryMatching.allowableIncoming` from validator
- [ ] No local re-calculation of snapshot-only values in production code paths
- [ ] Loading states shown during validation in-flight

### Post-Implementation
- [ ] All `allowableIncoming` displays show same value for same trade state
- [ ] BYC/kicker/poison pill players show "Adj" badge when matching differs from base
- [ ] TradeReceiptPanel (if visible) shows same values as TradeTeamCard
- [ ] `npm run test tests/salaryMatchingRules.test.js` passes
- [ ] `npm run test tests/trade/ -- --run` passes

---

## 6. Amendment Log

| Date | Version | Change | Author |
|------|---------|--------|--------|
| Dec 2024 | 1.0.0 | Initial document created | Trade Machine Team |

---

*This document is the authoritative source for Trade Machine alignment requirements. All Trade Machine fix plans, audits, and implementations must reference and conform to it.*
