# RETURN PACKAGE: Cap Sheet — Contract Schema Alignment (Phase 0)

**DATE:** 2026-01-17

---

## 1. What Changed (Concise Bullets)

- **Created `contractNormalization.js`**: New utility file with helpers to normalize contract schemas for world persistence
- **Updated `computeSigningResult`**: Changed `signedAt` to canonical `signingDate` field
- **Updated `computeExtensionResult`**: Changed `extension` to `isExtension`, `extensionSignedAt` to `signingDate`
- **Updated `computeOptionResult`**: Changed string `optionUsed` (`'accepted'`/`'declined'`) to boolean (`true`/`false`)
- **Updated consumers**: `useCapSheetState`, `useArchitectActions`, `seasonManager` now use boolean `optionUsed`
- **Added 52 unit tests**: Comprehensive test coverage for normalization helpers and mutation output validation

---

## 2. Canonical Schema Definition

### salariesByYear[] Entry

```typescript
{
  season: string;           // "2025-26" format (CANONICAL)
  salary: number;
  capHit: number;           // defaults to salary if absent
  guaranteed: boolean;
  guaranteedAmount?: number;
  option: "Team Option" | "Player Option" | null;
  optionUsed: boolean | null;  // CANONICAL: boolean, NOT string
  tradeBonus?: number;
}
```

### Contract Metadata

```typescript
{
  startSeason: string;      // "2025-26" format
  endSeason: string;
  contractLength: number;
  yearsRemaining: number;
  signingDate: string;      // ISO format (CANONICAL field name)
  isExtension: boolean;     // CANONICAL field name
  signingTeam?: string;
}
```

### freeAgency Object

```typescript
{
  type: "UFA" | "RFA" | "TO" | "PO" | null;
  year: number;             // End year (e.g., 2026)
  capHold?: number;
  qualifyingOffer?: number;
}
```

---

## 3. Files Changed/Created

| Path | Action | Description |
|------|--------|-------------|
| `src/features/architect/utils/contractNormalization.js` | **CREATED** | Normalization helpers for canonical schema |
| `src/features/architect/utils/mutationPipeline.js` | Modified | Updated 3 compute functions to use canonical fields |
| `src/features/architect/hooks/useCapSheetState.js` | Modified | Updated to use boolean `optionUsed` |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` | Modified | Updated type definition and usage for boolean `optionUsed` |
| `src/features/architect/utils/seasonManager.js` | Modified | Updated to use boolean `optionUsed` |
| `tests/architect/contractNormalization.test.js` | **CREATED** | 52 unit tests for normalization |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Modified | Added Section 9: Canonical Contract Schema |

---

## 4. Before/After Examples

### Sign Free Agent (computeSigningResult)

**BEFORE:**

```javascript
contract: {
  ...contract,
  signingTeam: teamCode,
  signedAt: new Date(timestamp).toISOString(),  // ❌ Legacy field name
}
```

**AFTER:**

```javascript
contract: normalizeContractForWorld({
  ...contract,
  signingTeam: teamCode,
  signingDate: new Date(timestamp).toISOString(),  // ✅ Canonical field name
})
```

### Extend Contract (computeExtensionResult)

**BEFORE:**

```javascript
futureContract: {
  salariesByYear: [...],
  extension: true,                                    // ❌ Legacy field name
  extensionSignedAt: new Date(timestamp).toISOString(), // ❌ Legacy field name
}
```

**AFTER:**

```javascript
futureContract: normalizeFutureContract({
  salariesByYear: [...],
  isExtension: true,                                  // ✅ Canonical field name
  signingDate: new Date(timestamp).toISOString(),    // ✅ Canonical field name
})
```

### Option Decision (computeOptionResult)

**BEFORE:**

```javascript
updatedSalaries[optionIndex] = {
  ...updatedSalaries[optionIndex],
  optionUsed: 'accepted',  // ❌ String value
};
```

**AFTER:**

```javascript
updatedSalaries[optionIndex] = {
  ...normalizeSalaryRow(updatedSalaries[optionIndex]),
  optionUsed: true,  // ✅ Boolean value
};
```

---

## 5. Tests Added/Updated

### Test File

`tests/architect/contractNormalization.test.js`

### Command Run

```bash
npm test tests/architect/contractNormalization.test.js -- --run
```

### Results

```
 ✓ tests/architect/contractNormalization.test.js  (52 tests) 52ms

 Test Files  1 passed (1)
      Tests  52 passed (52)
```

### Test Coverage

| Category | Tests | Description |
|----------|-------|-------------|
| `normalizeOptionUsed` | 10 | String-to-boolean conversion, case handling |
| `normalizeSalaryRow` | 5 | optionUsed normalization, capHit defaulting |
| `normalizeFreeAgency` | 6 | String parsing, object passthrough |
| `normalizeSigningDate` | 5 | Field name priority resolution |
| `normalizeContractForWorld` | 6 | Full contract normalization |
| `normalizeFutureContract` | 3 | Extension-specific normalization |
| Helper functions | 9 | `isOptionAccepted`, `isOptionDeclined`, `hasOptionDecision` |
| Mutation Output Validation | 4 | Integration tests for mutation output |

---

## 6. Compatibility Notes

### Legacy Field Handling

| Legacy Field | Canonical Field | Handling |
|--------------|-----------------|----------|
| `signedAt` | `signingDate` | Removed from output; read fallback in normalization |
| `extensionSignedAt` | `signingDate` | Removed from output; read fallback in normalization |
| `extension` | `isExtension` | Removed from output; converted in normalization |
| `optionUsed: 'accepted'` | `optionUsed: true` | Converted by `normalizeOptionUsed()` |
| `optionUsed: 'declined'` | `optionUsed: false` | Converted by `normalizeOptionUsed()` |
| `optionUsed: 'exercised'` | `optionUsed: true` | Converted by `normalizeOptionUsed()` |
| `freeAgency: "2027 (UFA)"` | `freeAgency: { year: 2027, type: "UFA" }` | Parsed by `normalizeFreeAgency()` |

### Existing Worlds

- **No migration required**: Existing Worlds continue to work
- **Read path**: Normalization helpers accept both legacy and canonical formats
- **Write path**: New mutations always produce canonical format
- **Gradual migration**: As mutations are applied, data naturally migrates to canonical format

---

## 7. Master Docs Updated

**Yes** — Updated `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`:

- Added **Section 9: Canonical Contract Schema (World)** with:
  - 9.1 salariesByYear[] Entry schema
  - 9.2 Contract Metadata schema
  - 9.3 freeAgency Object schema
  - 9.4 Normalization Helpers table
  - 9.5 Backward Compatibility notes
- Added entry to **Section 10: Change Log** documenting Phase 0 completion

---

## 8. Phase 1 Readiness

With Phase 0 complete, the mutation pipeline now produces consistent contract schemas. Phase 1 (Min Salary Enforcement) can safely:

1. **Read `salariesByYear[].salary`** — Guaranteed to be a number
2. **Check `optionUsed`** — Guaranteed to be boolean or null (not string)
3. **Access `freeAgency.year`** — Guaranteed to be object format
4. **Validate against `signingDate`** — Canonical field name always present for new signings

The normalization layer ensures backward compatibility while enabling strict schema enforcement going forward.
