# PHASE 40 — Second Apron Drift Scan (Architect-wide) — PREFLIGHT RETURN PACKAGE

**DATE:** 2026-01-27
**STATUS:** COMPLETED
**SCOPE:** `src/features/architect/**` (excluding `utils/tradeMachine/**`)

## 1. Executive Summary

The preflight scan identified **3 distinct logic locations** and **1 interface definition** within the Architect feature where "Second Apron" classification semantics persist in using inclusive (`>=`) comparisons, in direct conflict with the Trade Machine SSOT (`>`).

Additionally, `buildRuleContext.ts` was found to contain **duplicate classification logic** (`deriveApronLevel`) rather than delegating to the existing `capUtils.js` or SSOT, which is a primary contributor to this drift.

## 2. Findings List

### A. Logic Drift (Classification & Gating)

These instances actively use `>=` to determine status or block actions, causing distinct behavior from the Trade Machine at the exact apron boundary.

| File Location | Function / Context | Snippet | Type | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| `src/features/architect/utils/buildRuleContext.ts` | `deriveApronLevel` | `if (teamSalary >= cap.secondApron) return 'SECOND_APRON';` | Classification | **DRIFT** (Must be `>`) |
| `src/features/architect/utils/capLegalityValidation.js` | `validateSigning` (Rule 1.8) | `projectedCapHit >= rules.cap.secondApron` | Blocking/Gating | **DRIFT** (Must be `>`) |
| `src/features/architect/utils/faExceptionUtils.js` | `canUseFaException` | `if (... && teamTotalSalary >= capSettings.secondApron)` | Blocking/Gating | **DRIFT** (Must be `>`) |

### B. Interface & Labeling Drift

These instances promote the incorrect "At Or Above" mental model through parameter naming or API design, even if the boolean logic is externally supplied.

| File Location | Function / Context | Snippet | Type | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| `src/features/architect/utils/draftPickUtils.js` | `isFrozenPick` | `function isFrozenPick(..., { teamIsAtOrAboveSecondApron })` | Interface Name | **DRIFT** (Rename to `isSecondApron`) |

### C. Duplicate Utilities

| File | Issue |
| :--- | :--- |
| `src/features/architect/utils/buildRuleContext.ts` | **Redundant Logic**: Contains its own private `deriveApronLevel` function instead of importing from `capUtils.js` or `tradeMachine/ssot`. This private implementation contains the drift. |

## 3. Recommended Actions (For Execution Phase)

1. **Refactor `deriveApronLevel`** in `buildRuleContext.ts` to use strict `>` (or delegate to `capUtils.js`).
2. **update `capLegalityValidation.js`** to use `projectedCapHit > rules.cap.secondApron` for minimum-only enforcement.
3. **Update `faExceptionUtils.js`** to check `teamTotalSalary > capSettings.secondApron`.
4. **Rename `teamIsAtOrAboveSecondApron`** in `draftPickUtils.js` to `isSecondApron` (and update consumers).

## 4. Next Steps

- Proceed to Phase 40 Execution.
