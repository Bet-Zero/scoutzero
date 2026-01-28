# PHASE 47C — TPE Persistence Hardening (No Inference / No Dupes) — EXECUTION RETURN PACKAGE

**Date:** 2026-01-28
**Mode:** EXECUTION
**Scope:** `src/features/architect/utils/mutationPipeline.js`, `src/tests/architect/phase47c_tpe_persistence_hardening_guardrails.test.js`
**Master Doc:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

---

## 1. Summary

**What was done:**

Phase 47C hardens Phase 47B's TPE persistence to be SSOT-aligned, non-inferential, and idempotent:

### Task A — Remove Consumption Inference (No salary fallback)

- **BEHAVIOR CHOSEN: Zero-Consumption + Explicit Warning** (acceptable per task spec)
- If a player has `tpeId` but `matchIncoming` is missing/undefined, consumption is **skipped** (not inferred from salary)
- Warnings are logged in dev mode and attached to `teamResult._tpeConsumptionWarnings` for visibility
- This approach is non-blocking (trade proceeds) but makes the gap explicit for debugging

### Task B — Normalize + Dedupe TPE Sources

- Created `normalizeTPE()` helper to canonicalize fields across sources
- Created `dedupeById()` function that merges `team.tradeExceptions` and `team.exceptions?.tpe`
- **DEDUPE RULE:** Prefers entry with more canonical fields populated (remainingAmount, usedAmount, expiresOn)
- If equal, primary source (`tradeExceptions`) wins over legacy (`exceptions.tpe`)

### Task C — Idempotent Created TPE Persistence

- **Validator id preservation:** If `createdTPE.id` exists, it is used (not replaced with generated id)
- **Signature-based duplicate detection:** Signature = `(createdSeason, expiresOn, amount, createdFrom)`
- Duplicate detection checks BOTH by id AND by signature
- If either matches, TPE is not added (logged in dev mode)

### Task D — Guardrail Tests

- Created 16 new tests in `phase47c_tpe_persistence_hardening_guardrails.test.js`
- All 16 tests pass

---

## 2. Files Changed

| File                                                                        | Change Type | Description                                                                                            |
| --------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| `src/features/architect/utils/mutationPipeline.js`                          | Modified    | Replaced Phase 47B TPE logic with Phase 47C hardening: no salary fallback, dedupe, idempotent creation |
| `src/tests/architect/phase47c_tpe_persistence_hardening_guardrails.test.js` | Created     | 16 new guardrail tests for Phase 47C behaviors                                                         |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`               | Modified    | Added Phase 47C changelog entry                                                                        |

---

## 3. Behavior Decisions

### 3.1 Missing matchIncoming: Zero-Consumption + Warning

**Choice:** Zero-consumption with explicit structured warning (non-blocking)

**Rationale:**

- Fail-fast would block valid trades where TPE consumption wasn't properly wired upstream
- Zero-consumption is safe (doesn't incorrectly decrement TPE) and makes the gap visible
- Warning attached to `teamResult._tpeConsumptionWarnings` for downstream visibility
- Dev-mode console warning for debugging

**Code behavior:**

```javascript
if (player.matchIncoming === undefined || player.matchIncoming === null) {
  tpeConsumptionWarnings.push({
    playerId: player.player_id || player.name,
    tpeId: player.tpeId,
    reason: 'matchIncoming missing for TPE consumption - consumption skipped',
  });
  return; // Skip this player - no consumption without validator-produced value
}
```

### 3.2 Dedupe Rule

**Rule:** Prefer entry with more canonical fields populated; if equal, prefer `tradeExceptions` (primary source)

**Canonical fields scored:**

1. `remainingAmount !== undefined` (+1)
2. `usedAmount !== undefined` (+1)
3. `expiresOn` truthy (+1)

Higher score wins. Equal score = keep existing (primary source).

### 3.3 Idempotent Signature

**Signature:** `(createdSeason, expiresOn, amount, createdFrom).join('|')`

**Why these fields:**

- `createdSeason` + `expiresOn`: Time context of TPE
- `amount`: Value of TPE
- `createdFrom`: Player(s) that generated TPE

This combination uniquely identifies a TPE per trade. If the same trade is rerun, the signature matches and no duplicate is added.

---

## 4. Test Outputs

### 4.1 Phase 47C Tests

```
 RUN  v1.6.1 /Users/brenthibbitts/Desktop/ScoutZero

 ✓ src/tests/architect/phase47c_tpe_persistence_hardening_guardrails.test.js (16)
   ✓ Phase 47C: TPE Persistence Hardening Guardrails (16)
     ✓ Task A: No Salary Fallback for TPE Consumption (5)
       ✓ TC-A1: Player with tpeId but missing matchIncoming triggers warning, no consumption
       ✓ TC-A2: Player with tpeId and matchIncoming consumes correctly
       ✓ TC-A3: Player with matchIncoming=0 consumes 0 (no warning)
       ✓ TC-A4: Player without tpeId is not processed for TPE consumption
       ✓ TC-A5: Multiple players, some missing matchIncoming
     ✓ Task B: Dedupe by ID Across TPE Sources (4)
       ✓ TC-B1: Two sources with same TPE id produces one entry
       ✓ TC-B2: Prefer TPE with more canonical fields populated
       ✓ TC-B3: Unique TPEs from both sources are all kept
       ✓ TC-B4: Empty sources produce empty result
     ✓ Task C: Idempotent Created TPE (No Duplicates on Retry) (3)
       ✓ TC-C1: Same trade rerun does not add duplicate TPE (by signature)
       ✓ TC-C2: Different trade produces new TPE
       ✓ TC-C3: Running append twice with same id does not add duplicate
     ✓ Task C (continued): Validator ID Preservation (1)
       ✓ TC-C4: If createdTPE.id exists, persisted TPE id matches it
     ✓ Task C (continued): Signature-Based Dedupe (2)
       ✓ TC-C5: TPE without id uses signature for duplicate detection
       ✓ TC-C6: Signature components must all match for duplicate detection
     ✓ Integration: Combined Behaviors (1)
       ✓ Full pipeline simulation: dedupe + consume + create idempotently

 Test Files  1 passed (1)
      Tests  16 passed (16)
   Start at  05:28:50
   Duration  6.04s
```

### 4.2 Architect Regression Tests

```
 Test Files  1 failed | 19 passed (20)
      Tests  2 failed | 223 passed (225)
   Start at  05:29:02
   Duration  23.89s
```

**Result:** 223/225 tests passing (99.1% pass rate)

**Pre-existing failures (unchanged from Phase 47B):**

- `signAndTrade.test.js` - 2 tests related to `validateTrade` mock assertions (pre-existing, not caused by Phase 47C)

### 4.3 Build

```
✓ built in 29.92s
```

Build succeeds with no errors.

---

## 5. Regressions

**None introduced by Phase 47C.**

The 2 failing tests in `signAndTrade.test.js` are pre-existing from Phase 47B (207/209 → adjusted to 223/225 due to new tests added in Phase 47C).

---

## 6. Acceptance Criteria Verification

| AC  | Requirement                      | Status  | Evidence                                                                                         |
| --- | -------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| AC1 | No inference for TPE consumption | ✅ PASS | Code removes `\|\| player.salary \|\| 0` fallback; missing matchIncoming triggers warning + skip |
| AC2 | Dedupe works                     | ✅ PASS | `dedupeById()` merges sources with unique ids in output; TC-B1..B4 pass                          |
| AC3 | Created TPE idempotency          | ✅ PASS | Signature + id checks prevent duplicates; TC-C1..C6 pass                                         |
| AC4 | Tests prove it                   | ✅ PASS | 16 new Phase 47C tests pass; 223/225 architect tests pass (2 pre-existing failures)              |
| AC5 | Docs updated                     | ✅ PASS | Master Doc changelog updated; return package created                                             |

---

## 7. Master Doc Changelog Entry

```markdown
- - 2026-01-28: Phase 47C TPE Persistence Hardening (EXECUTION) - Hardened Phase 47B: removed salary fallback for TPE consumption (uses `matchIncoming` only with explicit warnings); added dedupe logic merging `tradeExceptions` + `exceptions.tpe` sources; implemented idempotent creation with signature-based duplicate detection; preserved validator-provided TPE ids; 16 new guardrail tests; 223/225 architect tests passing (2 pre-existing failures unchanged). Return package: `docs/architect/return_packages/PHASE_47C_TPE_PERSISTENCE_HARDENING_EXECUTION_RETURN_PACKAGE.md`.
```

---

## 8. Stop Conditions

None triggered. All tasks completed successfully.

---

## 9. Key Code Changes

### mutationPipeline.js - TPE Source Normalization and Dedupe

```javascript
// Phase 47C Helper: Normalize a TPE object to canonical schema
const normalizeTPE = (t) => ({
  ...t,
  id:
    t.id ||
    `tpe_legacy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  amount: t.remainingAmount ?? t.totalAmount ?? t.amount ?? 0,
  totalAmount: t.totalAmount ?? t.amount ?? 0,
  remainingAmount: t.remainingAmount ?? t.totalAmount ?? t.amount ?? 0,
  usedAmount: t.usedAmount ?? 0,
});

// Dedupe by id - prefer primaryTPEs (tradeExceptions) over legacyTPEs
const dedupeById = (tpes) => {
  const seen = new Map();
  for (const tpe of tpes) {
    if (!tpe.id) continue;
    const existing = seen.get(tpe.id);
    if (!existing) {
      seen.set(tpe.id, tpe);
    } else {
      // Prefer the one with more canonical fields populated
      const existingScore =
        (existing.remainingAmount !== undefined ? 1 : 0) +
        (existing.usedAmount !== undefined ? 1 : 0) +
        (existing.expiresOn ? 1 : 0);
      const newScore =
        (tpe.remainingAmount !== undefined ? 1 : 0) +
        (tpe.usedAmount !== undefined ? 1 : 0) +
        (tpe.expiresOn ? 1 : 0);
      if (newScore > existingScore) {
        seen.set(tpe.id, tpe);
      }
    }
  }
  return Array.from(seen.values());
};

const currentTPEs = dedupeById([...primaryTPEs, ...legacyTPEs]);
```

### mutationPipeline.js - No Salary Fallback for Consumption

```javascript
if (player.matchIncoming === undefined || player.matchIncoming === null) {
  tpeConsumptionWarnings.push({
    playerId: player.player_id || player.name,
    tpeId: player.tpeId,
    reason: 'matchIncoming missing for TPE consumption - consumption skipped',
  });
  return; // Skip - no consumption without validator-produced value
}

const consumed = player.matchIncoming;
const current = tpeUsageMap.get(player.tpeId) || 0;
tpeUsageMap.set(player.tpeId, current + consumed);
```

### mutationPipeline.js - Idempotent TPE Creation

```javascript
// Preserve validator-provided id if present
const tpeId = createdTPE.id || `tpe_${teamCode}_${Date.now()}_${...}`;

// Signature-based duplicate detection
const newTPESignature = [
  createdTPE.createdSeason,
  createdTPE.expiresOn,
  createdTPE.amount,
  createdFrom,
].join('|');

const hasDuplicateById = updatedTPEs.some((t) => t.id === tpeId);
const hasDuplicateBySignature = updatedTPEs.some((t) => {
  const existingSignature = [
    t.createdSeason,
    t.expiresOn,
    t.totalAmount ?? t.amount,
    t.createdFrom,
  ].join('|');
  return existingSignature === newTPESignature;
});

if (!hasDuplicateById && !hasDuplicateBySignature) {
  updatedTPEs.push({ id: tpeId, ... });
}
```

---

**Phase 47C Complete.** TPE persistence is now hardened: non-inferential consumption, deduped sources, idempotent creation.
