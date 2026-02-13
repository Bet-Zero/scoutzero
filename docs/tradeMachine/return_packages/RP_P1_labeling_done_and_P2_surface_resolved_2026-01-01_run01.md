# Return Package: P1 "Base vs Matching" Labeling + P2 TradeSalaryCalculator Resolution

> **Date**: 2026-01-01  
> **Run**: 01  
> **Master Doc Version**: 1.2.2  
> **Fix Plan Version**: 4.1.0

---

## 1. Summary (What Changed + Why)

### A) P1 "Base vs Matching" Labeling Audit + Fixes

**Goal**: Make Base vs Matching labeling consistent across all Trade Machine salary displays.

**Audit Results**: The existing implementation was already largely compliant with the labeling policy. The key components were reviewed:

1. **TradeTeamCard.jsx** — Already shows:
   - "Outgoing Salary" vs "Outgoing Matching Value" label based on adjustment presence
   - "Base Salary: $X" secondary line when matching differs from base
   - "Adj" badge on player chips only when `base != matching`
   - Tooltip showing "Type: Base $X → Match $Y" format

2. **TradeSummaryPanel.jsx** — Already shows:
   - "Matching In / Allowed" label for the team-level summary
   - "Adj" badge on incoming players when `base != matching`
   - Base salary displayed next to player name
   - Tooltip showing "Type: Base $X → Match $Y" format

3. **TradeReceiptPanel.jsx** — Updated:
   - Changed generic tooltip from "Trade matching value differs from base salary" to "Adjusted: Base $X → Match $Y" format
   - Enhanced BYC, PP, TK badge tooltips to include "Base $X → Match $Y" format

4. **TradeExportCapture.jsx** — Added:
   - New disclaimer note: "Salaries shown are base contract values. Matching values for trade legality may differ (BYC, trade kicker, poison pill adjustments)."

5. **TradeValidationPanel.jsx** — No changes needed (shows rule results, not individual salaries)

### B) P2 TradeSalaryCalculator Resolution

**Goal**: Resolve whether TradeSalaryCalculator is user-reachable or dev-only.

**Resolution**: TradeSalaryCalculator is now **user-reachable** via a collapsible panel in TradeEditor.

**Implementation**:

- Added collapsible "Salary Calculator (Exploratory)" panel to TradeEditor
- Wired props: `teamSalary`, `outgoingSalary`, `incomingPlayers`, `tpes`, `capSettings`, `yearKey`
- Wired official validator results: `validatorAllowableIncoming`, `validatorRule`, `hasValidatorResult`
- Team selector dropdown allows switching between teams in multi-team trades

---

## 2. Salary Display Inventory Table

| Surface | Component | Location | What Number is Shown | Base/Matching/Both | Label/Badge/Tooltip |
|---------|-----------|----------|---------------------|-------------------|---------------------|
| Outgoing team total | TradeTeamCard | Outgoing section header | Matching (from snapshot) | Matching only (base shown as secondary when differs) | "Outgoing Matching Value" label when adjusted; "Adjusted" badge when totals differ |
| Outgoing player chip | TradeTeamCard | Outgoing expanded list | Matching (player-level) | Both when differs | "Adj" badge with tooltip "Type: Base $X → Match $Y" |
| Incoming team total | TradeTeamCard | Incoming section header | Matching (from snapshot) | Matching only (base shown as secondary when differs) | "Incoming Matching Value" label when adjusted; "Adjusted" badge when totals differ |
| Incoming player chip | TradeTeamCard | Incoming expanded list | Matching (player-level) | Both when differs | "Adj" badge with tooltip "Type: Base $X → Match $Y" |
| Allowable Incoming | TradeTeamCard | Below incoming section | Allowable limit (from snapshot) | N/A (limit value) | Rule label tooltip, "Estimate" badge when pre-validation |
| Summary matching | TradeSummaryPanel | Team card | Matching In / Allowed | Matching | "Matching In / Allowed" label |
| Summary player | TradeSummaryPanel | Players Received | Base salary | Both when differs | Base salary shown; "Adj" badge with tooltip |
| Receipt player | TradeReceiptPanel | Outgoing/Incoming players | Matching value | Both (breakdown shown) | BYC/PP/TK badges with "Base $X → Match $Y" tooltips; "Adj" for unknown |
| Receipt totals | TradeReceiptPanel | Salary Flow grid | Base and Matching | Both | "Outgoing (Base)", "Outgoing (Match)", etc. labels |
| Export player | TradeExportCapture | Team cards | Base salary | Base only | Note at bottom about matching values |
| Calculator | TradeSalaryCalculator | Collapsible panel | Sandbox + Official | Both when available | "Sandbox Estimate" vs "Official Validator Result" sections |

---

## 3. "Adj" Badge Rules Implemented

The "Adj" badge appears under these exact conditions:

```javascript
// Player-level (TradeTeamCard)
const baseSalary = getSalaryForYear([player], yearKey);
const matchingValue = player.matchOutgoing ?? baseSalary; // or matchIncoming
const hasPlayerAdjustment = Math.abs(matchingValue - baseSalary) > 1;
// Show "Adj" badge when hasPlayerAdjustment === true

// Team-level (TradeTeamCard)  
const hasOutgoingAdjustment = hasValidatorResult && Math.abs(outgoingSalary - outgoingBaseSalary) > 1;
// Show "Adjusted" badge when hasOutgoingAdjustment === true
```

**Tooltip format**: `${adjustmentLabel}: Base ${formatSalary(baseSalary)} → Match ${formatSalary(matchingValue)}`

Where `adjustmentLabel` comes from `getAdjustmentTooltipLabel(player)`:

- Returns specific type(s) if detected: "BYC", "Trade Kicker", "Poison Pill"
- Falls back to: "Adjusted trade matching value (BYC/kicker/poison pill may apply)"

**Detection logic** (from `tradeHelpers.js`):

- BYC: `player.isBYC === true` OR `player.baseYearCompensation === true`
- Trade Kicker: `player.tradeKicker` exists OR `player.tradeKickerPct > 0`
- Poison Pill: `player.isPoisonPill === true` (explicit flag only, NOT inferred from isRookieScale)

---

## 4. TradeSalaryCalculator Resolution

### Is it reachable?

**Yes** — TradeSalaryCalculator is now user-reachable via a collapsible panel in TradeEditor.

### Where in UI?

- Location: After TradeValidationPanel, before TradeReceiptPanel (debug panel)
- Trigger: Click "🧮 Salary Calculator (Exploratory)" button to expand/collapse
- Team selector: Dropdown to switch between teams in multi-team trades

### Prop Wiring Map

| Prop | Source | Type |
|------|--------|------|
| `teamSalary` | `teams[idx].team?.teamTotalSalary` | Official (from team object) |
| `outgoingSalary` | `salaryOut[idx]` from useTradeMachine | Local (getSalaryForYear) |
| `incomingPlayers` | `incomingAssets[idx]?.players` | Local (derived from teams) |
| `tpes` | `teams[idx].team?.tradeExceptions` | Official (from team object) |
| `capSettings` | `result?.capSettings \|\| capProjections` | Official when available |
| `yearKey` | `yearKey` from useTradeMachine | Context value |
| `validatorAllowableIncoming` | `teamResult?.rules?.salaryMatching?.allowableIncoming` | Official (from validator snapshot) |
| `validatorRule` | `teamResult?.rules?.salaryMatching?.details?.ruleApplied` | Official (from validator snapshot) |
| `hasValidatorResult` | `teamResult != null` | Boolean |

### Official vs Sandbox Separation

TradeSalaryCalculator displays:

1. **Official Validator Result** (blue section) — when validator result is available
   - Allowable Incoming from snapshot
   - Rule Applied from snapshot
2. **Sandbox Estimate** (muted section) — local calculation
   - Outgoing Salary
   - Allowable Incoming (local calc)
   - "Validator will use: $X" message when sandbox differs by >$1

---

## 5. Files Changed List

| File | Change |
|------|--------|
| `src/features/architect/tradeMachine/TradeExportCapture.jsx` | Added "Matching values may differ" disclaimer note |
| `src/features/architect/tradeMachine/TradeEditor.jsx` | Imported TradeSalaryCalculator; added collapsible panel with proper wiring |
| `src/features/architect/tradeMachine/TradeReceiptPanel.jsx` | Updated tooltips to "Base $X → Match $Y" format |
| `docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md` | Updated Section 4.1-4.3 to reflect TradeSalaryCalculator is user-reachable; updated Amendment Log; bumped version to 1.2.2 |
| `docs/tradeMachine/return-packages/RP_P1_labeling_done_and_P2_surface_resolved_2026-01-01_run01.md` | This document |

---

## 6. Command Outputs

### Test: tests/trade/

```bash
$ npm run test tests/trade/ -- --run

 Test Files  28 passed (28)
      Tests  139 passed (139)
   Duration  8.91s
```

### Test: src/tests/trade/

```bash
$ npm run test src/tests/trade/ -- --run

 Test Files  3 passed (3)
      Tests  45 passed (45)
   Duration  1.54s
```

### Build

```bash
$ npm run build

vite v4.5.14 building for production...
✓ 2914 modules transformed.
dist/index.html                            0.60 kB │ gzip:   0.37 kB
dist/assets/index-54ac6277.css            71.49 kB │ gzip:  12.61 kB
dist/assets/index.esm-ff4b6074.js          3.62 kB │ gzip:   1.56 kB
dist/assets/tradeManager-e891d1f9.js       5.24 kB │ gzip:   2.05 kB
dist/assets/seasonManager-a12efa09.js      7.89 kB │ gzip:   2.93 kB
dist/assets/index-57c797cc.js          1,819.35 kB │ gzip: 533.63 kB
✓ built in 9.26s
```

---

## 7. No-Scope Confirmation

**Validator logic**: ✅ NOT CHANGED

- No changes to `salaryMatchingRules.js`
- No changes to `validateSalaryMatching.js`
- No changes to any rule calculation math

**Snapshot accessor semantics**: ✅ NOT CHANGED

- No changes to `useTradeMachineSnapshot.js`
- Existing accessor patterns preserved

---

*End of Return Package*
