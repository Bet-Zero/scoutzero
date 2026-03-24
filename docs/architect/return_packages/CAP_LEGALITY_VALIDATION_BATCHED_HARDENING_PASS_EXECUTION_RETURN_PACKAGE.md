# CAP_LEGALITY_VALIDATION_BATCHED_HARDENING_PASS — EXECUTION RETURN PACKAGE

**Date:** 2026-03-24
**Files touched:** 2 (compact format applies)

---

## 1. Summary

Pass completed **fully**. Runtime behavior unchanged. The exported and live validator boundaries in `capLegalityValidation.ts` are materially less dependent on placeholder typing:

- `AnyRecord` (`Record<string, any>`) is **eliminated entirely** from the module. All 13+ violation/warning array declarations and every exported boundary that previously used it now use `CapLegalityViolation[]` or named types.
- The `normalizeSigningTerms` input type is narrowed from `AnyRecord | null | undefined` to `SigningTerms | null | undefined` — matching the actual callers.
- Three `MutationPlayer` `unknown` fields narrowed to specific primitive unions where caller evidence confirmed the correct type.
- One `as AnyRecord` cast in the tolerant raw-input path (`validateExceptions`) is preserved as a localized `as Record<string, any>` with an explicit eslint-disable, documented below.

---

## 2. Files Changed

| File | Change |
|---|---|
| `src/features/architect/utils/capLegalityValidation.ts` | `AnyRecord` removed; `CapLegalityViolation` type added; all violations/warnings arrays explicitly typed; `MutationPlayer` fields narrowed; `normalizeSigningTerms` input narrowed; `asRecordLike` default tightened |
| `src/tests/architect/capLegalityValidation.batchedHardening.test.ts` | New — 7 focused behavioral tests across 3 describe blocks |

Support edits: **0**

---

## 3. Deliberate Non-Changes

### `MutationPlayer.experience?: unknown` — kept as `unknown`

**Symbol:** `MutationPlayer.experience`
**Why still present:** Callers in `useArchitectActions.ts` (lines 1811–1812) pass `ArchitectDashboardPlayer` which has `experience: unknown`. Narrowing to `number | string | null` caused typecheck failures because TypeScript cannot prove `unknown` satisfies the narrower union at those call sites.
**What would fix it:** Narrow `ArchitectDashboardPlayer.experience` to `number | string | null` in the GMDashboard type definition (a support edit in `useArchitectActions.ts` or the ArchitectDashboard types file).

### `MutationPlayer.draftPick?: unknown` — kept as `unknown`

**Symbol:** `MutationPlayer.draftPick`
**Why still present:** `getDraftPickNumber()` explicitly handles `number | string | { pick?, number? } | null` — the object shape is a live legacy data path that a `number | string | null` narrowing would silently discard.
**What would fix it:** Nothing practical — `getDraftPickNumber` is designed for this exact mixed-shape case.

### `MutationContract.draftPick?: unknown` — kept as `unknown`

**Symbol:** `MutationContract.draftPick`
**Why still present:** Same as `MutationPlayer.draftPick` — `getDraftPickNumber` handles mixed shapes.

### `validateDeadCap(deadCap: unknown)` input — kept broad

**Symbol:** `validateDeadCap` parameter
**Why still present:** Intentionally accepts pre-normalized, malformed, or primitive raw input. This IS the tolerant boundary.

### `validateExceptions(exceptions: unknown)` input — kept broad

**Symbol:** `validateExceptions` parameter
**Why still present:** Same — accepts raw Firestore data before normalization.

### `validateExceptions` inner cast `exceptions as Record<string, any>`

**Symbol:** `exceptionsObj` cast at line ~1285
**Why still present:** After the outer cast to `Record<string, unknown>`, accessing `entry.enabled`, `entry.totalAmount`, etc. would require an additional `entry as Record<string, unknown>` cast per property access loop — changing 15+ property access sites. Since the INPUT is already `unknown`, the internal `any` cast is a localized tolerance, not an exported boundary issue. Isolated with an explicit `eslint-disable-next-line` comment.
**What would fix it:** Change `const entry = exceptionsObj[key]` → `const entry = exceptionsObj[key] as Record<string, unknown>` and update all downstream `entry.field` accesses inside the loop.

### `getMutationYearsOfService` / `calculateMutationTeamCapHit` / `computeMutationTeamCapTotals` casts

**Symbol:** `player as Parameters<typeof getYearsOfService>[0]` and similar
**Why still present:** These adapter casts require knowing the exact input contracts of `getYearsOfService`, `calculateTeamCapHit`, and `computeTeamCapTotals`. Fixing them cleanly is an adapter rewrite outside the scope of this pass.

### `ArchitectMutationContract[key: string]: unknown` (imported)

**Symbol:** Catch-all on imported mutation contract type
**Why still present:** Load-bearing from Chunk 3 deliberate non-change — `contract.years`/`contractYears` are accessed but undeclared in the named fields.

---

## 4. Validation Results

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** — 0 errors |
| `npm run test:node -- --reporter=dot src/tests/architect/capLegalityValidation.batchedHardening.test.ts` | **PASS** — 7/7 tests |
| `npm run build` | **PASS** — built in 28.95s |

---

## 5. Standing Failures

None. Pre-existing build warnings (dynamic import module placement, chunk size) are unrelated to this pass and were present before.

---

## 6. Recommended Next Step

Move to **`seasonManager.ts`** — `capLegalityValidation.ts` exported validator boundaries are no longer the dominant blocker. The remaining loose typing in this file is small, localized, and justified by genuinely tolerant or load-bearing runtime contracts.
