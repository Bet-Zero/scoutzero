# Trade Machine — Salary Display Guide

**Created:** 2026-02-15  
**Purpose:** Document UI conventions for salary display across Trade Machine surfaces  
**Gap Reference:** GAP-UI-005 (TM_GAPS_TRIAGE_V1.md)

---

## Overview

The Trade Machine displays salaries in two contexts:

1. **Base Salary** — Contract cap hit, unmodified
2. **Matching Value** — Adjusted value used for CBA trade legality calculations

Understanding when each is shown helps users interpret trade scenarios correctly.

---

## Key Concepts

### Base Salary

- The player's actual cap hit for the season
- What teams are spending on the player
- What appears on cap sheets and roster views

### Matching Value

- Adjusted salary for trade legality calculation
- Can differ from base due to BYC, Poison Pill, or Trade Kicker adjustments
- What the CBA uses to determine if a trade is legal

---

## Adjustment Types

| Flag             | Adjustment                        | Impact                                                                  |
| ---------------- | --------------------------------- | ----------------------------------------------------------------------- |
| **BYC**          | Base Year Compensation            | `max(previousSalary, 50% × newSalary)` — raises outgoing matching value |
| **Poison Pill**  | Rookie extension in first 2 years | Average of current + extension years — may raise or lower matching      |
| **Trade Kicker** | Contractual bonus on trade        | Adds bonus to matching value (up to 15% of remaining contract)          |

---

## UI Indicators

### Adjustment Badge ("Adj")

- **Location:** Appears next to player name/salary when matching ≠ base

- **Tooltip Contents:** Shows adjustment type and Base → Match transformation
- **Color:** Purple background (`bg-purple-600/20 text-purple-300`)

**Example:**

```

Jaylen Brown  $36.2M  [Adj]
              ↳ Tooltip: "BYC: Base $36.2M → Match $18.1M"
```

### Estimate Badge

- **Location:** Appears when validator hasn't run yet
- **Color:** Amber background (`bg-amber-600/20 text-amber-400`)
- **Meaning:** Value is local calculation, not yet confirmed by validator

### Skip Reason Display

- **Location:** Shown as "—" with `(N/A)` tag when salary matching not applicable
- **Tooltip Contents:** Explains why (e.g., "Not applicable: Hard cap skip", "TPE absorption")
- **When Shown:** Team is sending only, no players selected, or special absorbing scenario

---

## Display Surfaces

### TradeTeamCard (main trade builder)

**Outgoing Section:**

- Shows "Outgoing Salary" when no adjustment
- Shows "Outgoing Matching Value" when adjustment exists

- Shows base salary as secondary line when adjusted

**Incoming Section:**

- Shows "Incoming Salary" when no adjustment
- Shows "Incoming Matching Value" when adjustment exists
- Shows base salary as secondary line when adjusted

**Allowable Incoming:**

- Numeric value when salary matching applies
- "—" with "(N/A)" tooltip when salary matching not applicable
- Rule label in parentheses (e.g., "Over Cap Band 2")
- Skip reason tooltip explains N/A scenarios

### TradeSummaryPanel (validation results)

**Team Summaries:**

- Shows "Matching In / Allowed: $X / $Y" format
- Includes skip reason inline when applicable
- Players Received shows [Adj] badge for adjusted players

### TradeSalaryCalculator (sandbox tool)

**Key Features:**

- Prominent disclaimer: "Exploratory tool — validator is authoritative"
- "Official Validator Result" section (blue) when available
- "Sandbox Estimate" section (neutral) for local calculations
- Shows mismatch warning when sandbox differs from validator

---

## Canonical Sources

| Value                  | Source                                                                          |
| ---------------------- | ------------------------------------------------------------------------------- |
| Salary Matching Result | `getSalaryMatchingResult()` in `salaryMatchingRules.js`                         |
| Official Snapshot      | `getOfficialSalaryMatchingSnapshot()` in `getOfficialSalaryMatchingSnapshot.js` |
| Adjustment Labels      | `getAdjustmentTooltipLabel()` in `tradeHelpers.js`                              |
| Skip Reason Format     | `formatSkipReasonLabel()` in `TradeTeamCard.jsx`                                |

---

## Export Behavior

When exporting trade screenshots:

- Base salaries appear by default for readability
- Matching values use [Adj] indicator
- Note: "Matching values may differ from base salaries" added when adjustments present

---

## Related Documentation

- [TRADE_MACHINE_MASTER.md](../architect/trade-machine/TRADE_MACHINE_MASTER.md) — Trade Machine runtime reference
- [TRADE_MACHINE_AUDIT.md](./TRADE_MACHINE_AUDIT.md) — Detailed audit of UI vs validator
