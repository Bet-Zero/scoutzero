# Phase 9: Eligibility ID Correctness + FA Plausibility Policy

**Date:** 2026-01-18  
**Owner:** architect/cap-sheet validation  
**Mode:** EXECUTION

---

## Summary of Changes

Phase 9 addresses two related issues:

1. **False-blocking on re-signing eligibility** due to team ID format mismatches
2. **Hard-coded FA year plausibility range** that didn't adapt to context year

### Key Improvements

| Area | Before | After |
|------|--------|-------|
| Team ID comparison | Direct string match (case-insensitive) | Canonical normalization handles prefixes, case, object extraction |
| Missing team refs | Silent false-block possible | Warning (`resigning_eligibility_unverifiable`) instead of hard-block |
| FA year plausibility | Hardcoded 2020-2040 | Context-relative: [contextYear - 5, contextYear + 10] |
| rightsRenounced | Not explicitly checked | `rightsRenounced === true` → ineligible |

---

## Audit Evidence

### Team Identifier Shapes Found

| Field | Location | Format | Example |
|-------|----------|--------|---------|
| `team.teamCode` | Team objects | Canonical uppercase | `"LAL"` |
| `player.teamId` | Player objects | May be prefixed | `"NBA:LAL"` |
| `player.team_id` | Legacy player objects | Various | `"lal"` |
| `contract.signingTeam` | Player contract | Canonical uppercase | `"LAL"` |

### Call-sites Where Identifiers Are Set

1. **mutationPipeline.js:716** - `signingTeam: teamCode` (canonical)
2. **useArchitectActions.ts:461,509,585,633,869** - `signingTeam: teamCode` (canonical via `resolveTeamCode`)
3. **computeSigningResult** (mutationPipeline.js:714-717) - Sets `signingTeam` on contract normalization

---

## Final Eligibility Normalization Rules

### Helpers Added

**File:** `src/features/architect/utils/contractNormalization.js`

```javascript
export function normalizeTeamRef(teamOrCode) {
  // Handles: objects, strings, prefixed ("NBA:LAL"), case ("lal")
  // Returns: Canonical uppercase code ("LAL") or null
}

export function normalizePlayerTeamRef(player) {
  // Checks: teamId → team_id → teamCode → contract.signingTeam
  // Returns: Normalized team code or null
}
```

### Verification Policy

| Condition | Result |
|-----------|--------|
| Both sides normalize, match | ✅ Valid |
| Both sides normalize, mismatch | ❌ Hard-block (`resigning_ineligible`) |
| Either side cannot normalize | ⚠️ Warning (`resigning_eligibility_unverifiable`) |
| `rightsRenounced === true` | ❌ Hard-block (`resigning_ineligible`) |
| `birdRights.status` is "None"/"renounced" | ❌ Hard-block (`resigning_ineligible`) |

---

## Final FA Plausibility Policy

### Centralized Function

**File:** `src/features/architect/utils/contractNormalization.js`

```javascript
export function isPlausibleFreeAgencyYear(year, contextYear = DEFAULT_CONTEXT_YEAR) {
  const minYear = contextYear - 5;   // e.g., 2026 → 2021
  const maxYear = contextYear + 10;  // e.g., 2026 → 2036
  return { 
    plausible: Number.isInteger(year) && year >= minYear && year <= maxYear,
    minYear, 
    maxYear 
  };
}
```

### Context Year Resolution (Priority)

1. `context.year` (passed to validator)
2. `context.contextYear` (passed to validator)
3. `DEFAULT_CONTEXT_YEAR` constant (2026)

### Examples

| Context Year | Min Year | Max Year |
|--------------|----------|----------|
| 2026 | 2021 | 2036 |
| 2030 | 2025 | 2040 |
| 2035 | 2030 | 2045 |

---

## Rule IDs Added/Changed

| Rule ID | Type | Description |
|---------|------|-------------|
| `resigning_eligibility_unverifiable` | **NEW (Warning)** | Cannot verify eligibility due to missing/unnormalizable team refs |

| Rule ID | Change Type | Description |
|---------|-------------|-------------|
| `resigning_ineligible` | **Enhanced** | Now uses canonical normalization; includes `rightsRenounced` check |
| `rfa_state_invalid` | **Enhanced** | Uses context year for plausibility range; includes contextYear/minYear/maxYear in payload |

---

## Files Changed

| File | Changes |
|------|---------|
| `src/features/architect/utils/contractNormalization.js` | Added `normalizeTeamRef`, `normalizePlayerTeamRef`, `isPlausibleFreeAgencyYear`, policy constants |
| `src/features/architect/utils/capLegalityValidation.js` | Updated imports; refactored re-signing eligibility check; added warning rule to SOFT_WARNING_RULES |
| `tests/architect/capLegalityValidation.test.js` | Added 9 new Phase 9 tests (4 test suites) |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Added Phase 9 changelog; added sections 9.8 (Team Identity) and 9.9 (FA Plausibility Policy) |

---

## Tests

### New Test Suites

1. **Phase 9 - Eligibility ID Normalization**
   - Does NOT false-block when player/team use different ID formats (e.g., "NBA:LAL" vs "LAL")
   - Does NOT false-block when player/team use different case (e.g., "lal" vs "LAL")
   - Still hard-blocks when player is clearly NOT on the signing team
   - Blocks when player has rightsRenounced === true

2. **Phase 9 - Unverifiable Eligibility Warning**
   - Produces warning (not hard-block) when team refs are missing/unnormalizable

3. **Phase 9 - FA Year Plausibility Policy**
   - Still hard-blocks truly absurd years (e.g., 1900, 9999)
   - Uses context year for plausibility range calculation
   - Shifts plausibility range when context year changes
   - Includes contextYear in violation payload

### Test Output

```
✓ tests/architect/capLegalityValidation.test.js  (138 tests) 146ms

 Test Files  1 passed (1)
      Tests  138 passed (138)
   Start at  22:28:04
   Duration  6.15s
```

---

## Build Output

```
✓ 2927 modules transformed.
✓ built in 38.55s

dist/index.html                            0.60 kB
dist/assets/index-2d63ff9c.css            73.22 kB
dist/assets/index-1ce79d56.js          1,888.76 kB
```

---

## Master Doc Updates

Added to `CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`:

1. **Changelog entry** for Phase 9
2. **Section 9.8** - Team Identity for Re-Signing Eligibility
3. **Section 9.9** - Free Agency Year Plausibility Policy
4. Updated **Soft Warning Rules** to include `resigning_eligibility_unverifiable`
