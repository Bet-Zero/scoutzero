# Trade Machine Draft Pick Display — Preflight Return Package

> **Date**: 2026-01-10
> **Task**: MODE: PREFLIGHT — Identify pick rendering logic and edit points for logo/via display fixes

---

## Executive Summary

The bug where `LAL_2029_1st` shows DAL logo instead of LAL logo is caused by **two issues**:

1. **Logo selection uses wrong field**: `TradePickRow.jsx` uses `originalTeamId` but schema field is `originalTeam`
2. **`via` field is not populated**: The `via` field that drives "(via X)" display is a separate optional field in the schema, not auto-computed from `owner !== originalTeam`

---

## 1. Pick Render Surfaces in Trade Machine

| Surface | File | Purpose | Uses Logo? | Uses `via`? |
|---------|------|---------|------------|-------------|
| **Main pick rows** | [TradePickRow.jsx](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/tradeMachine/TradePickRow.jsx) | Interactive draft pick selection | ✅ Line 108 | Via `formatPick()` |
| Outgoing chips | [TradeTeamCard.jsx](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/tradeMachine/TradeTeamCard.jsx#L471-L480) | Collapsed view chips | ❌ No logo | Via `formatPick()` |
| Incoming chips | [TradeTeamCard.jsx](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/tradeMachine/TradeTeamCard.jsx#L578-L585) | Collapsed view chips | ❌ No logo | Via `formatPick()` |
| Incoming panel | [TradeTeamCard.jsx](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/tradeMachine/TradeTeamCard.jsx#L843-L846) | Incoming assets detail | ❌ No logo | Via `formatPick()` |
| Summary panel | [TradeSummaryPanel.jsx](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/tradeMachine/TradeSummaryPanel.jsx#L217-L230) | Trade summary cards | ❌ No logo | Via `getPickLabel()` → `formatPick()` |
| Export capture | [TradeExportCapture.jsx](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/tradeMachine/TradeExportCapture.jsx#L205-L221) | Image export for sharing | ✅ Line 211-219 | Via `formatPick()` |

---

## 2. Current Logo Selection Logic

### TradePickRow.jsx (Line 107-110)

```jsx
<TeamLogo
  teamId={pick?.originalTeamId || pick?.teamId || teamId}
  className="w-4 h-4"
/>
```

> [!WARNING]
> **Bug**: Uses `originalTeamId` but schema field is `originalTeam`. This fallback chain never reaches `originalTeam`, so it falls back to `teamId` (which is the current owner team).

### TradeExportCapture.jsx (Line 211-219)

```jsx
<TeamLogo
  teamId={
    p.fromTeamId ||
    p.originTeamId ||
    p.teamId ||
    p.teamAbbr ||
    p.team
  }
  className="w-5 h-5 ml-2 shrink-0"
/>
```

> [!NOTE]
> This uses `fromTeamId` which is a trade-specific field (who traded the pick), not `originalTeam`. Different purpose — showing who sent the pick in this trade, not who the pick originally belonged to.

---

## 3. Current "(via X)" Label Logic

### formatPick() in tradeHelpers.js (Line 358-376)

```javascript
export const formatPick = (p, options = {}) => {
  const { includeNote = true } = options;
  
  if (!p) return '';
  let str = `${p.year} ${p.round} Round`;
  if (p.via) str += ` (via ${p.via})`;   // ← Line 363: Only shows if p.via is explicitly set
  
  // Phase 4: Display protection from protectionMeta or legacy string
  const protectionLabel = getProtectionDisplayLabel(p);
  if (protectionLabel) {
    str += ` 🛡 ${protectionLabel}`;
  }
  
  if (p.isSwap) {
    str += ` 🔁 ${formatSwapInfo(p)}`;
  }
  if (includeNote && p.note) str += ` 📝 ${p.note}`;
  return str;
};
```

> [!CAUTION]
> **Bug**: The `via` field is **optional** in the schema and is only present when explicitly set during scraping. When `owner !== originalTeam`, we should compute and display "(via {originalTeam})" even if `via` is not explicitly populated.

---

## 4. Schema Definition

### DraftPickZ in architect.ts (Line 141-160)

```typescript
export const DraftPickZ = z.object({
  id: z.string().optional(),
  year: z.number().int(),
  round: z.number().int(),
  pick: z.number().int().nullable(),
  owner: TeamCodeZ,                      // ← Current owner (who can trade it)
  originalTeam: TeamCodeZ.optional(),    // ← Original team whose draft slot this is
  status: z.string().optional(),
  isSwap: z.boolean().optional(),
  protection: z.string().nullable().optional(),
  protectionMeta: ProtectionMetaZ,
  stepienEligible: z.boolean().optional(),
  tradeable: z.boolean().optional(),
  via: TeamCodeZ.optional(),             // ← "via" label (optional, separate from originalTeam)
  recipient: TeamCodeZ.optional(),
  route: z.array(TeamCodeZ).optional(),
  notes: z.string().optional(),
  conveyance: DraftPickConveyanceZ,
  metadata: z.object({}).passthrough().optional(),
});
```

### Key Fields:
| Field | Purpose | Example for `LAL_2029_1st` owned by DAL |
|-------|---------|----------------------------------------|
| `owner` | Current owner | `"DAL"` |
| `originalTeam` | Team whose draft slot | `"LAL"` |
| `via` | Display hint (optional) | Should be `"LAL"` or computed |

---

## 5. Proposed Edit Points

### Edit Point 1: Fix Logo Selection in TradePickRow.jsx

**File**: [TradePickRow.jsx:107-110](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/tradeMachine/TradePickRow.jsx#L107-L110)

**Current**:
```jsx
<TeamLogo
  teamId={pick?.originalTeamId || pick?.teamId || teamId}
  className="w-4 h-4"
/>
```

**Proposed**:
```jsx
<TeamLogo
  teamId={pick?.originalTeam || pick?.originalTeamId || pick?.teamId || teamId}
  className="w-4 h-4"
/>
```

> [!NOTE]
> Add `originalTeam` as the **first** fallback since that's the schema's canonical field name.

---

### Edit Point 2: Compute "(via X)" in formatPick()

**File**: [tradeHelpers.js:362-363](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/tradeHelpers.js#L362-L363)

**Current**:
```javascript
let str = `${p.year} ${p.round} Round`;
if (p.via) str += ` (via ${p.via})`;
```

**Proposed**:
```javascript
let str = `${p.year} ${p.round} Round`;
// Compute (via X) when owner !== originalTeam, respecting explicit p.via if set
const viaTeam = p.via || (p.originalTeam && p.owner && p.owner !== p.originalTeam ? p.originalTeam : null);
if (viaTeam) str += ` (via ${viaTeam})`;
```

> [!IMPORTANT]
> This auto-computes "(via LAL)" when a pick's `owner` is "DAL" but `originalTeam` is "LAL", without requiring the `via` field to be explicitly populated.

---

### Edit Point 3 (Optional): Fix TradeExportCapture Logo

**File**: [TradeExportCapture.jsx:211-219](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/tradeMachine/TradeExportCapture.jsx#L211-L219)

**Note**: This component shows `fromTeamId` which is correct for "who sent you this pick in the trade". If we want it to show the original team's logo instead, update similarly:

```jsx
<TeamLogo
  teamId={
    p.originalTeam ||     // ← Add as first choice
    p.fromTeamId ||
    p.originTeamId ||
    p.teamId ||
    p.teamAbbr ||
    p.team
  }
  className="w-5 h-5 ml-2 shrink-0"
/>
```

---

## 6. Swap Display (Current State)

Swap display is already handled separately via `formatSwapInfo()`:

```javascript
if (p.isSwap) {
  str += ` 🔁 ${formatSwapInfo(p)}`;
}
```

The `formatSwapInfo()` function (lines 320-335) correctly shows:
- "Swap (Best of)" or "Swap (Worst of)"
- Partner team: "vs OKC"
- Resolved outcome: "→ Won by OKC"

> [!TIP]
> Swap icon (`🔁`) already replaces/augments the pick display. Per requirements, we should keep pick looking like a pick even for swaps — the current approach is correct: logo stays as `originalTeam`, swap icon/details are **secondary UI only**.

---

## 7. Other Places Picks Are Rendered (Consistency Check)

| File | Component | Pick Render | Notes |
|------|-----------|-------------|-------|
| `OutgoingPicksList.jsx` | `OutgoingPicksList` | Passes to `TradePickRow` | ✅ Will inherit fix |
| `TradeTeamCard.jsx` | Inline chips | `formatPick(p)` only | ✅ Will inherit fix |
| `TradeSummaryPanel.jsx` | `getPickLabel(p)` | `formatPick(p, {includeNote: false})` | ✅ Will inherit fix |
| `TradeExportCapture.jsx` | Export cards | `formatPick(p)` + separate logo | ⚠️ Logo uses different field |
| `TradeReceiptPanel.jsx` | Debug panel | Raw JSON display | N/A (debug only) |

---

## 8. Files to Edit

### Minimal Fix (2 files):
1. **[TradePickRow.jsx](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/tradeMachine/TradePickRow.jsx)** — Fix logo fallback chain (line 108)
2. **[tradeHelpers.js](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/tradeHelpers.js)** — Auto-compute `via` in `formatPick()` (line 363)

### Optional Consistency Fix (1 additional file):
3. **[TradeExportCapture.jsx](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/tradeMachine/TradeExportCapture.jsx)** — Add `originalTeam` to logo fallback (line 212)

---

## 9. Verification Plan

After implementing fixes:

1. **Load Trade Machine with DAL team**
2. **Verify `LAL_2029_1st` in DAL inventory shows**:
   - LAL logo (not DAL)
   - "2029 1st Round (via LAL)" label
3. **Check swaps still display correctly** with `🔁` icon and swap details
4. **Check export capture** shows correct logos
5. **No regressions** on picks where `owner === originalTeam` (should show owner logo, no "(via X)")

---

## Stop Condition Notes

- ✅ Pick rendering logic is consistent across surfaces (all use `formatPick()`)
- ✅ Pick objects use consistent field names from schema (`owner`, `originalTeam`, `via`)
- ⚠️ `TradeExportCapture` uses `fromTeamId` which is a trade-context field, not `originalTeam` — decide if this is intentional
