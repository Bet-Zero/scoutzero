# Phase 65: TPE Read-Path Canonicalization + No-Direct-tradeExceptions Guardrails

**Status:** ✅ COMPLETE  
**Date:** 2026-01-30  
**Prior Phase:** Phase 64 TPE Schema Canonicalization

---

## 1. Executive Summary

Phase 65 completed the TPE canonicalization by making `team.tradeExceptions` read-only legacy compatibility and eliminating direct reads across all production code. All TPE reads now route through `getTeamTpeList(team)`, which handles both canonical (`exceptions.tpe[]`) and legacy (`tradeExceptions[]`) locations transparently.

Key accomplishments:

- Refactored 11 production files to use canonical accessor
- Identified and hardened 2 additional persistence boundaries outside mutationPipeline
- Added 18 guardrail tests with source-scan enforcement
- All 454 architect tests passing

---

## 2. Team Persistence Boundaries

### 2.1 Identified Write Paths

| File                  | Location | Context                | Resolution                                        |
| --------------------- | -------- | ---------------------- | ------------------------------------------------- |
| `mutationPipeline.js` | L189-212 | Main world persistence | Already has Phase 64 normalization                |
| `seasonManager.js`    | L119     | Draft pick write       | Added `normalizeTeamTpeSchema()` before batch.set |
| `seasonManager.js`    | L598     | Season advance         | Added `normalizeTeamTpeSchema()` before batch.set |

### 2.2 seasonManager.js Changes

```javascript
// Before batch.set at L119:
const normalizedTeam = normalizeTeamTpeSchema(updatedTeam);
batch.set(teamRef, normalizedTeam);

// Before batch.set at L598:
const expiredTeam = normalizeTeamTpeSchema(updatedTeam);
batch.set(teamRef, expiredTeam);
```

---

## 3. Refactored Files

### 3.1 Files Updated to Use `getTeamTpeList(team)`

| File                          | Changes                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `TradeTeamCard.jsx`           | Import added, `teamTradeExceptions = getTeamTpeList(team)`, 7 JSX usages updated              |
| `TradeExceptionDashboard.jsx` | Import added, `existingTPEs: getTeamTpeList(teamData?.team)`                                  |
| `ValidationDetailsPanel.jsx`  | Import added, `tpes={getTeamTpeList(selectedTeam.team)}`                                      |
| `useTradeMachine.js`          | Import added, 4 usage points: augmentTeamWithExceptions, team init paths, applyTradeException |
| `tradeExceptions.js`          | Import added, `teamTpes = getTeamTpeList(team.team)`                                          |
| `basicRules.js`               | Import added, `tpes = getTeamTpeList(team)`                                                   |
| `validateSalaryMatching.js`   | Import added, TPE retrieval updated                                                           |
| `runOffseason.js`             | Import added, `activeTPEs` filter updated                                                     |
| `SeasonAdvanceModal.jsx`      | Import added, `findExpiringTPEs` function rewritten                                           |
| `seasonManager.js`            | Import added, TPE expiry processing + normalization before both batch.set                     |

### 3.2 Import Pattern

```javascript
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts/normalizeTeamTpe';

// Usage
const tpes = getTeamTpeList(team);
```

---

## 4. Guardrails

### 4.1 New Test File

**File:** `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js`

**Tests:** 18 total

### 4.2 Source-Scan Enforcement

```javascript
const ALLOWED_FILES = [
  'normalizeTeamTpe.js', // Canonical accessor/normalizer
  'normalizeTradeInput.js', // Trade input normalization
  'schemaAdapter.js', // Schema adaptation layer
  'mutationPipeline.js', // Persistence layer
  'tradeContext.js', // Context building
  'validatePersistableShape.js', // Shape validation
  'tpeLifecycle.js', // TPE lifecycle tests
  'types.js', // Type definitions
  'buildRuleContext.ts', // Rule context builder (internal context)
];
```

### 4.3 Forbidden Patterns

```javascript
const FORBIDDEN_PATTERNS = [
  /\.tradeExceptions\s*[.[]/, // Direct array access
  /\.tradeExceptions\s*\|\|/, // Fallback patterns
  /\.tradeExceptions\s*\?\./, // Optional chaining
  /team\.tradeExceptions\b/, // team.tradeExceptions
  /\.tradeExceptions\s*&&/, // Conditional access
  /\.tradeExceptions\s*:/, // Object spread/assignment
];
```

### 4.4 Test Categories

| Category               | Count | Description                      |
| ---------------------- | ----- | -------------------------------- |
| Basic accessor         | 3     | getTeamTpeList behavior          |
| Schema normalization   | 3     | normalizeTeamTpeSchema merging   |
| Source scan production | 6     | Feature directories (6 patterns) |
| Source scan tests      | 6     | Test directories (6 patterns)    |

---

## 5. Test Results

### 5.1 Full Suite

```bash
npm run test -- --run src/tests/architect/
```

**Output:**

```
✓ src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js (18 tests)
...
Test Files  34 passed (34)
Tests       454 passed (454)
```

### 5.2 Build Verification

```bash
npm run build
```

**Output:**

```
✓ 2967 modules transformed.
✓ built in 31.19s
```

---

## 6. Architecture Summary

### 6.1 TPE Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     TPE Data Flow (Phase 65)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  READS (Production Code)                                        │
│  ┌─────────────────────────────────────────────────────┐        │
│  │ getTeamTpeList(team)                                │        │
│  │ ├── Returns team.exceptions.tpe[] (canonical)       │        │
│  │ └── Falls back to team.tradeExceptions[] (legacy)   │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                 │
│  WRITES (Persistence Boundaries)                                │
│  ┌─────────────────────────────────────────────────────┐        │
│  │ normalizeTeamTpeSchema(team)                        │        │
│  │ ├── Merges legacy → canonical                       │        │
│  │ ├── Deduplicates by ID                              │        │
│  │ └── Removes legacy field                            │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                 │
│  PERSISTENCE                                                    │
│  ┌─────────────────────────────────────────────────────┐        │
│  │ mutationPipeline.js L189   → normalizeTeamTpeSchema │        │
│  │ seasonManager.js L119      → normalizeTeamTpeSchema │        │
│  │ seasonManager.js L598      → normalizeTeamTpeSchema │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Canonical vs Legacy

| Aspect            | Canonical               | Legacy                          |
| ----------------- | ----------------------- | ------------------------------- |
| Path              | `team.exceptions.tpe[]` | `team.tradeExceptions[]`        |
| Read              | Via `getTeamTpeList()`  | Via `getTeamTpeList()` fallback |
| Write             | ✅ Allowed              | ❌ Forbidden                    |
| Production access | Via accessor only       | ❌ Direct access forbidden      |

---

## 7. Documentation Updated

- ✅ `CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` - Phase 65 history entry added
- ✅ `PERSISTENCE_CONTRACTS.md` - Phase 65 read-path rule added

---

## 8. Files Changed

### 8.1 Production Files

| File                          | Change Type                       |
| ----------------------------- | --------------------------------- |
| `TradeTeamCard.jsx`           | Refactored to use accessor        |
| `TradeExceptionDashboard.jsx` | Refactored to use accessor        |
| `ValidationDetailsPanel.jsx`  | Refactored to use accessor        |
| `useTradeMachine.js`          | Refactored to use accessor        |
| `tradeExceptions.js`          | Refactored to use accessor        |
| `basicRules.js`               | Refactored to use accessor        |
| `validateSalaryMatching.js`   | Refactored to use accessor        |
| `runOffseason.js`             | Refactored to use accessor        |
| `SeasonAdvanceModal.jsx`      | Refactored to use accessor        |
| `seasonManager.js`            | Hardened persistence + refactored |

### 8.2 Test Files

| File                                                            | Change Type        |
| --------------------------------------------------------------- | ------------------ |
| `phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js` | Created (18 tests) |

### 8.3 Documentation

| File                                           | Change Type            |
| ---------------------------------------------- | ---------------------- |
| `CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | History entry added    |
| `PERSISTENCE_CONTRACTS.md`                     | Phase 65 section added |

---

## 9. Acceptance Criteria

| Criterion                                              | Status       |
| ------------------------------------------------------ | ------------ |
| All production TPE reads use `getTeamTpeList()`        | ✅           |
| Non-mutation persistence paths normalize before write  | ✅           |
| Guardrail tests forbid direct `.tradeExceptions` reads | ✅           |
| 9-file allowlist for legacy access                     | ✅           |
| All architect tests pass                               | ✅ (454/454) |
| Build passes                                           | ✅           |
| Master doc updated                                     | ✅           |
| Persistence contracts doc updated                      | ✅           |

---

## 10. Next Steps (Future Phases)

1. **Dead code removal:** Remove legacy `tradeExceptions` field from old worlds via migration
2. **Type refinement:** Remove `tradeExceptions` from team types entirely
3. **Monitoring:** Add runtime logging for legacy field access (if needed for migration tracking)
