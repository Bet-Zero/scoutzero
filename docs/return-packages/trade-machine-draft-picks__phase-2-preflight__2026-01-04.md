# Trade Machine Draft Picks — Phase 2 PREFLIGHT Return Package

> **Date**: 2026-01-04  
> **Status**: PREFLIGHT COMPLETE  
> **Document**: `docs/return-packages/trade-machine-draft-picks__phase-2-preflight__2026-01-04.md`

---

## Summary

Phase 2 PREFLIGHT is complete. This document contains all findings needed to begin Phase 2 implementation without discovery surprises.

---

## 1. Master Doc Section Added

The following section was added to `docs/tradeMachine/TRADE_MACHINE_DRAFT_PICKS_MASTER.md`:

### Phase 2 PREFLIGHT Findings (January 2026)

> **Status**: PREFLIGHT COMPLETE  
> **Mode**: Minimal behavioral changes, DEV-only instrumentation gated

---

## 2. Evidence Index Additions (E15+)

### E-F1: Firestore → Team Loader Pass-Through

| Field | Value |
|-------|-------|
| **Claim** | `draftPicks` array passes unchanged from Firestore through `hydrateBaseTeam()` |
| **Evidence** | `src/features/architect/utils/firebaseTeamPlanHelpers.js:163` |
| **Snippet** | `draftPicks: baseDoc.draftPicks || [],` |

### E-F2: useTradeMachine ID Normalization

| Field | Value |
|-------|-------|
| **Claim** | All picks are normalized via `ensurePickId()` on load |
| **Evidence** | `src/features/architect/hooks/useTradeMachine.js:237-239` |
| **Snippet** | `const rawPicks = data.draftPicks || data.picks || []; const picksWithIds = rawPicks.map(p => ensurePickId(p));` |

### E-F3: picksOut UI State Shape

| Field | Value |
|-------|-------|
| **Claim** | `picksOut` contains selected picks with swap fields |
| **Evidence** | `src/features/architect/hooks/useTradeMachine.js:438-441` |
| **Fields Added** | `fromTeamId`, `toTeamId`, `isSwap`, `swapWithTeamId` (via UI editing) |

### E-F4: Validator Uses outgoingPicks or picksOut

| Field | Value |
|-------|-------|
| **Claim** | `validateStepien` accepts picks from `outgoingPicks` or `picksOut` |
| **Evidence** | `src/features/architect/utils/tradeMachine/rules/validateStepien.js:15, 22` |

### E-F5: Stepien Reads isSwap But Treats As Outright

| Field | Value |
|-------|-------|
| **Claim** | `isSwap` picks are included in Stepien checks but not specially handled |
| **Evidence** | `src/features/architect/utils/tradeMachine/rules/validateStepien.js:37-39` |
| **Note** | Phase 1 v2.0.2 removed `!pick.isSwap` exclusion - swaps now included |

---

## 3. Pick Shape Matrix

| Pipeline Stage | Source Location | Example Keys Present | Format Variants |
|---------------|-----------------|---------------------|-----------------|
| **1. Firestore Base** | `architect_baseTeams/{teamCode}.draftPicks[]` | `year`, `round`, `originalTeam`, `currentOwner`, `protection`, `status` | `round: 1` or `"1st"`; `protection: string \| null` |
| **2. Team Loader** | `firebaseTeamPlanHelpers.hydrateBaseTeam()` | Same as Firestore | Passed through unchanged |
| **3. useTradeMachine Init** | `useTradeMachine.js:237-245` | `id` (generated), `year`, `round`, `originalTeam`, `protection`, `pickIdWarning` | `ensurePickId()` normalizes |
| **4. UI State (picksOut)** | `teams[idx].picksOut[]` | `id`, `year`, `round`, `originalTeam`, `protection`, `isSwap`, `swapWithTeamId`, `fromTeamId` | `isSwap: boolean` |
| **5. Validator Input** | `tradeValidator.js` → `validateStepien()` | `team.outgoingPicks[]` or `team.picksOut[]` | Prefers `outgoingPicks` |
| **6. Stepien Evaluation** | `validateStepien.js:37-61` | `year`, `round`, `protection` | `isSwap` included but not specially handled |

---

## 4. Validator Input Call Graph

```
USER SELECTS PICK
└─► TradePickRow.jsx onToggle(pick)
    └─► useTradeMachine.togglePick(idx, pick)
        └─► ensurePickId(pick)                    // Generate/preserve canonical ID
            └─► newTeams[idx].picksOut.push({...pick, fromTeamId})

USER EDITS PICK (isSwap, swapWithTeamId)
└─► useTradeMachine.updatePickField(idx, pick, field, value)
    └─► picksOut[pickIdx][field] = value

VALIDATION TRIGGERED
└─► useTradeMachine.handleValidate()
    └─► validateTrade({teams: [...], ...})
        └─► validators.validateStepien(team, context)
            │
            ├─► Extract: const { picksOut = [], outgoingPicks = [] } = team;
            ├─► const picks = outgoingPicks.length > 0 ? outgoingPicks : picksOut;
            ├─► const firstRoundPicks = picks.filter(round === '1st' || 1 || 'first')
            │   NOTE: isSwap picks INCLUDED (Phase 1 v2.0.2)
            ├─► Check consecutive unprotected years
            ├─► Check 7-year limit
            └─► Check second apron frozen pick restriction
```

### Definitive "Truth Object" for Stepien

The validator uses:
- **`team.outgoingPicks[]`** (if present and length > 0) OR
- **`team.picksOut[]`** (fallback)

Fields actually read:
- `pick.year`, `pick.round`, `pick.protection`, `pick.originalTeam`

Fields NOT read:
- `pick.isSwap` (present but not read)
- `pick.swapWithTeamId` (NEVER read - zero call sites)

---

## 5. Recommendation: Option B (Reserve Most)

### ⚠️ DESIGN DECISION REQUIRED

| Option | Swaps Reserve Year? | Protected Picks Reserve? | Recommendation |
|--------|--------------------|-----------------------|----------------|
| **A: Reserve All** | ✅ Yes | ✅ Yes | Most restrictive |
| **B: Reserve Most** | ✅ Yes | ✅ Yes | **RECOMMENDED** |
| **C: Reserve Minimum** | ❌ No | ❌ No | Least restrictive |

### Why Option B?

1. **CBA Intent**: Stepien rule ensures teams always have a first-round pick. Swaps represent real obligations.

2. **Repo Reality**: 
   - `isSwap` already stored in pick objects
   - Phase 1 v2.0.2 includes swaps in Stepien filter
   - Adding year reservation is additive, not disruptive

3. **UX Expectations**: Users expect swaps to "count" toward Stepien.

4. **Exception for worst_of**: A "worst of" swap doesn't reserve the year (team keeps better pick).

### Implementation Impact

- Modify `validateStepien.js` to check `isSwap` field
- For `isSwap === true`: Reserve the year
- Future: Add `swapType: 'best_of' | 'worst_of'` to distinguish

---

## 6. Files Changed/Added

### Master Doc Updated
- `docs/tradeMachine/TRADE_MACHINE_DRAFT_PICKS_MASTER.md` — Added "Phase 2 PREFLIGHT Findings" section

### Return Package Created
- `docs/return-packages/trade-machine-draft-picks__phase-2-preflight__2026-01-04.md` — This file

### Fixtures Created
- `src/tests/fixtures/tradeMachinePicks/swapOnly.json`
- `src/tests/fixtures/tradeMachinePicks/swapPlusAdjacentPick.json`
- `src/tests/fixtures/tradeMachinePicks/protectionStringPresent.json`
- `src/tests/fixtures/tradeMachinePicks/missingOriginalTeam.json`
- `src/tests/fixtures/tradeMachinePicks/multiTeamTrade.json`
- `src/tests/fixtures/tradeMachinePicks/secondApronFrozenSwap.json`

### Test File Created
- `src/tests/tradeMachine/draftPicksPreflight.test.js` — 16 passing, 2 skipped (Phase 2)

---

## 7. Commands Run + Results

```bash
# Tests - Preflight
npm run test -- src/tests/tradeMachine/draftPicksPreflight.test.js --run
# Result: 16 passed, 2 skipped (18)

# Tests - Pick ID Utils (existing)
npm run test -- src/tests/tradeMachine/pickIdUtils.test.js --run
# Result: 34 passed (34)

# Build
npm run build
# Result: ✓ built in 9.92s (no errors, only expected chunk size warnings)
```

---

## Swap Reality Check Summary

### Current State

| Field | Written | Read | Validated |
|-------|---------|------|-----------|
| `isSwap` | ✅ UI checkbox | ✅ Display only | ❌ Not specially handled |
| `swapWithTeamId` | ✅ UI dropdown | ❌ **NEVER** | ❌ Not validated |

### 5 Swap Scenarios for Phase 2

| # | Scenario | Current Gap |
|---|----------|-------------|
| S1 | Swap-only trade | No special handling |
| S2 | Swap + adjacent outright pick | May incorrectly pass Stepien |
| S3 | Best-of swap resolution | No resolution logic |
| S4 | Swap partner UI display | `swapWithTeamId` ignored |
| S5 | Second apron frozen swap | Not implemented |

---

## Stop Conditions Check

| Condition | Status | Notes |
|-----------|--------|-------|
| Pick objects don't include `year`/`round` | ✅ CLEAR | All picks have `year` and `round` |
| `outgoingPicks` isn't what Stepien uses | ✅ CLEAR | Validator uses `outgoingPicks` or `picksOut` |
| Swaps stripped before validation | ✅ CLEAR | Swaps reach validator intact |
| Multiple pipelines mutate picks | ✅ CLEAR | Single pipeline: ensurePickId → picksOut |

**No stop conditions triggered. Ready for Phase 2 implementation.**

---

## Next Steps for Phase 2

1. **Implement swap year reservation** in `validateStepien.js`
2. **Add `swapType` field** to distinguish `best_of` vs `worst_of`
3. **Implement swap resolution logic** for draft lottery simulation
4. **Wire `swapWithTeamId`** to display "Swap: Best of PHI/OKC"
5. **Add second apron frozen swap restriction**

---

*End of Return Package*
