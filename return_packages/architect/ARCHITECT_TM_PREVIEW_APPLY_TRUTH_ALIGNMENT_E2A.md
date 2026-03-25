# ARCHITECT_TM_PREVIEW_APPLY_TRUTH_ALIGNMENT_E2A — Return Package

Executed: 2026-03-25

---

## Summary

Hardened the E2 fallback by:
1. Adding focused tests (18 guardrail + 5 component behavior) that prove the disclosure behavior is real, present, and stable
2. Tightening disclosure language across all three UI surfaces to include post-state cap legality and post-state roster/schema integrity — previously omitted

The E2 fallback semantics are now tested and fully disclosed.

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/architect/tradeMachine/TradeEditor.tsx` | Updated inline disclosure: added exclusivity + "post-state checks (cap/roster integrity)" |
| `src/features/architect/tradeMachine/TradeLegalChecker.tsx` | Updated legend disclaimer: added "post-state cap/roster integrity run at apply time" |
| `src/features/architect/tradeMachine/ValidationDetailsPanel.tsx` | Updated section header: "world-state checks" → "world-state + post-state checks" |
| `src/tests/architect/tm.previewApplyDisclosure.e2a.guardrail.test.ts` | **NEW** — 18 source-content guardrail tests |
| `src/tests/trade/TradeLegalChecker.disclosure.e2a.behavior.test.tsx` | **NEW** — 5 RTL component behavior tests |

**Files NOT changed:** `useTradeMachine.ts` (metadata already correct), `validationPresentationTypes.ts` (type already correct), `mutationPipeline.ts`, `leagueInvariants.ts`, `postStateCapValidator.ts`.

---

## Root Cause

E2 returned a package that said "no tests required — additive text only." That was acceptable as a first pass but left the disclosure untested and fragile. Additionally, the E2 disclosure strings in `TradeEditor.tsx` and `TradeLegalChecker.tsx` mentioned only duplicate players, entitlement conflicts, and exclusivity — silently omitting the fourth apply-only gate (`validatePostStateCapLegality`) which covers post-state cap/roster/schema integrity.

---

## What Was Missing After E2

| Gap | Before E2A |
|-----|-----------|
| Tests for `previewTier` / `applyOnlyGates` metadata | None |
| Tests for disclosure text rendering | None |
| Tests for completeness of disclosure across surfaces | None |
| `TradeEditor.tsx` mentions post-state cap/roster | No — missing entirely |
| `TradeLegalChecker.tsx` mentions post-state cap/roster | No — missing entirely |
| `ValidationDetailsPanel.tsx` mentions post-state | No — only said "world-state" |

---

## Disclosure Wording Before vs After

### TradeEditor.tsx

**Before:**
> CBA validation passed. World-state checks (duplicate players, entitlement conflicts) run at apply time.

**After:**
> CBA validation passed. World-state and post-state checks (duplicate players, entitlement conflicts, exclusivity, cap/roster integrity) run at apply time.

### TradeLegalChecker.tsx

**Before:**
> Preview covers CBA validator rules only. World-state checks (duplicate players, entitlement conflicts, exclusivity) run at apply time.

**After:**
> Preview covers CBA validator rules only. World-state checks (duplicate players, entitlement conflicts, exclusivity) and post-state cap/roster integrity run at apply time.

### ValidationDetailsPanel.tsx

**Before:**
> CBA rule pass/fail per team (preview only — world-state checks run at apply time)

**After:**
> CBA rule pass/fail per team (preview only — world-state + post-state checks run at apply time)

---

## Test Coverage Added

### Guardrail test: `src/tests/architect/tm.previewApplyDisclosure.e2a.guardrail.test.ts`

18 tests, pure vitest (no jsdom, no RTL). Reads source files with `fs.readFileSync`.

| Test | What it proves |
|------|---------------|
| `useTradeMachine` emits `previewTier: 'cba-validator'` | Metadata field present |
| `applyOnlyGates` contains `duplicate-player-world-check` | Gate 1 disclosed |
| `applyOnlyGates` contains `duplicate-entitlement-world-check` | Gate 2 disclosed |
| `applyOnlyGates` contains `entitlement-exclusivity-world-check` | Gate 3 disclosed |
| `applyOnlyGates` contains `post-state-cap-schema` | Gate 4 disclosed |
| `TradeEditor.tsx` disclosure mentions "apply time" | Surface 1 present |
| `TradeEditor.tsx` disclosure mentions "post-state" | Surface 1 complete |
| `TradeEditor.tsx` disclosure mentions "exclusivity" | Surface 1 complete |
| `TradeEditor.tsx` disclosure mentions "cap/roster" | Surface 1 complete |
| `TradeEditor.tsx` no "guaranteed apply" text | Surface 1 honest |
| `TradeLegalChecker.tsx` legend mentions "apply time" | Surface 2 present |
| `TradeLegalChecker.tsx` legend mentions "post-state cap/roster" | Surface 2 complete |
| `TradeLegalChecker.tsx` legend clarifies preview-only | Surface 2 honest |
| `TradeLegalChecker.tsx` no "guaranteed apply" text | Surface 2 honest |
| `ValidationDetailsPanel.tsx` mentions "preview only" | Surface 3 present |
| `ValidationDetailsPanel.tsx` mentions "post-state" | Surface 3 complete |
| `ValidationResultLike` declares `previewTier` | Type contract present |
| `ValidationResultLike` declares `applyOnlyGates` | Type contract present |

### Component behavior test: `src/tests/trade/TradeLegalChecker.disclosure.e2a.behavior.test.tsx`

5 tests, `// @vitest-environment jsdom`, RTL `render` + `screen`. `validationIssueText` mocked as precaution.

| Test | What it proves |
|------|---------------|
| Disclosure paragraph renders with empty `teamResults` | Component actually renders the text |
| Disclosure text contains "apply time" | Live DOM has the right copy |
| Disclosure text contains "post-state" | Live DOM reflects the complete blocker set |
| Disclosure text contains "World-state checks" | Live DOM has the right framing |
| No "guaranteed apply" text in document body | No false certainty in rendered output |

---

## Metadata Proof

`useTradeMachine.ts` result object (unchanged from E2, verified by guardrail):

```typescript
previewTier: 'cba-validator' as const,
applyOnlyGates: [
  'duplicate-player-world-check',
  'duplicate-entitlement-world-check',
  'entitlement-exclusivity-world-check',
  'post-state-cap-schema',
],
```

All 4 gate identifiers present. `previewTier` literal type matches `ValidationResultLike.previewTier?: 'cba-validator'`.

---

## UI Disclosure Proof

All three UI surfaces now mention:
- CBA validator scope ("CBA validator rules only" / "CBA validation passed")
- Apply-time qualifier ("run at apply time")
- Post-state gate ("post-state")
- No false certainty (no "guaranteed" near "apply")

The TradeLegalChecker component test additionally proves the disclosure text is actually rendered in the DOM — not just present in source.

---

## Completeness Proof

The minimum required blocker set per E2A spec:

| Blocker | Disclosed in TradeEditor | Disclosed in TradeLegalChecker | Disclosed in ValidationDetailsPanel |
|---------|-------------------------|-------------------------------|-------------------------------------|
| League/world invariant checks (duplicate players) | ✅ "duplicate players" | ✅ "duplicate players" | ✅ "world-state checks" |
| Entitlement invariant checks | ✅ "entitlement conflicts" | ✅ "entitlement conflicts" | ✅ "world-state checks" |
| Exclusivity checks | ✅ "exclusivity" | ✅ "exclusivity" | ✅ "world-state checks" |
| Post-state cap legality | ✅ "cap/roster integrity" | ✅ "post-state cap/roster integrity" | ✅ "post-state checks" |
| Post-state roster/schema integrity | ✅ "cap/roster integrity" | ✅ "post-state cap/roster integrity" | ✅ "post-state checks" |

All surfaces now reflect the full known apply-only gate set.

---

## Validation Results

- **`npm run typecheck`**: Zero new errors from E2A files. Pre-existing errors in `mutationPipeline.ts`/test files remain.
- **`npm run test:node "tm.previewApplyDisclosure"`**: 18/18 PASS
- **`npm run test:ui "TradeLegalChecker.disclosure"`**: 5/5 PASS
- **`npm run build`**: ✅ PASSED (exit code 0)
- Full suites: same pre-existing failure counts as E2 — no regressions introduced

---

## Remaining Follow-Up Tickets

| Ticket | Description |
|--------|-------------|
| **E3 (TM authority consolidation)** | Single surfaced execute-trade authority result composing all gates. Prerequisite for preferred E2 path. |
| **E4 (alternate apply surface retirement)** | Deprecate `tradeManager.executeTrade()` + `architectCore` re-export. |
| **E5 (hard-cap SSOT consolidation)** | Retire `rules/validateHardCap.ts`. |
| **E6 (roster SSOT consolidation)** | Collapse roster helpers into one tiered path. |
| **E2 preferred path** | Once E3 is complete: surface `validatePostStateCapLegality` in TM preview via shared compute output. |
