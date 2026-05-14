# Wave 6 — `useArchitectActions.ts` Split Plan

**Goal:** Break the 6,139-line hook into focused files an AI agent can work with
in a single context window.

**Scope:** `useArchitectActions.ts` only.

**Key difference from Waves 4/5:** Lines 1–2248 are pure TypeScript (types + plain
functions — no React). These extract identically to what we've done before.
Lines 2249–6139 are a React hook body — action handlers close over shared state,
so they extract as **sub-hooks** that receive the shared state as parameters.

---

## Proposed output

| File | Est. lines | Contents |
|------|------------|----------|
| `useArchitectActions.types.ts` | ~1,240 | All type/interface declarations |
| `useArchitectActions.helpers.ts` | ~950 | Pure helper functions (no React) |
| `useArchitectActions.tradeActions.ts` | ~650 | Sub-hook: trade + sign + sign-and-trade handlers |
| `useArchitectActions.offerSheetActions.ts` | ~420 | Sub-hook: RFA offer sheet handlers |
| `useArchitectActions.contractActions.ts` | ~650 | Sub-hook: waive, extend, option, renounce, dead cap, exceptions |
| `useArchitectActions.ts` (reduced) | ~1,700 | Hook setup + shared closures + sub-hook calls + return |

Total: ~5,610 lines across 6 files. Largest is ~1,700 (the orchestrator with
the shared persistence closures that can't be extracted). Down from one 6,139-line file.

---

## Step 0 — Baseline

Run `npm run test:architect -- --reporter=dot` and confirm only the 5 pre-existing
phase66-70 failures. Record result.

---

## Step 1 — Extract `useArchitectActions.types.ts`

**What moves:** All type and interface declarations. These are the first ~1,211 lines
after the file header (L116–L1326 in the current file).

**Includes:**
- All `type X = ...` aliases
- All `interface UseArchitectActionsParams`, `UseArchitectActionsReturn`, etc.
- All exported types consumed by the dashboard and tests

**Pattern:** Same as mutationPipeline.types.ts (Wave 4 Step 4b) — a pure re-export
barrel. `useArchitectActions.ts` gets `export * from './useArchitectActions.types'`
and keeps using all the types via that re-export.

**Gate:** TypeScript clean + `npm run test:architect -- --reporter=dot`.

---

## Step 2 — Extract `useArchitectActions.helpers.ts`

**What moves:** All pure helper functions defined before the hook function
(L1327–L2248). These are regular TypeScript functions, not hooks.

**Includes:**
- `ensureContractStructure`
- `deriveSigningMechanism` (and its internals)
- `resolveTeamCode`
- Any other standalone utilities in this section

**Note:** These are currently used BOTH inside the hook body (after L2249) AND
potentially by callers outside the hook. After extraction, `useArchitectActions.ts`
imports them from `./useArchitectActions.helpers`.

**Gate:** TypeScript clean + tests green.

---

## Step 3 — Extract `useArchitectActions.tradeActions.ts` (sub-hook)

**What moves:** The trade, signing, and sign-and-trade action handlers
(approx L3849–L4793 in the current file after Steps 1–2 shift line numbers).

**Handlers:**
- `handleExecuteTrade` (and all trade-related callbacks)
- `handleSign`
- `handleSignAndTrade`

**Sub-hook pattern:**
```typescript
// useArchitectActions.tradeActions.ts
export function useTradeActions(params: UseTradeActionsParams) {
  const handleExecuteTrade = useCallback(async (...) => {
    // body moved here verbatim
  }, [/* deps */]);

  const handleSign = useCallback(async (...) => { ... }, []);
  const handleSignAndTrade = useCallback(async (...) => { ... }, []);

  return { handleExecuteTrade, handleSign, handleSignAndTrade };
}

// In useArchitectActions.ts:
const tradeActions = useTradeActions({ teamCode, userId, worldId, ..., modals, persistMutation, ... });
```

**Shared state params:** The sub-hook receives as parameters everything the handlers
currently close over: `teamCode`, `userId`, `worldId`, `seasonId`, `teamCapSheet`,
`currentYear`, `worldAsOfDate`, `setTeamCapSheet`, `startSave`, `finishSave`,
`reloadActiveWorldTeamData`, `modals`, plus the shared closures from the persistence
section (e.g. `persistMutation`).

**Gate:** TypeScript clean + tests green.

---

## Step 4 — Extract `useArchitectActions.offerSheetActions.ts` (sub-hook)

**What moves:** All RFA offer sheet action handlers (approx L4794–L5133).

**Handlers:**
- `handleStoreOfferSheet`
- `handleMatchOfferSheet`
- `handleDeclineOfferSheet`
- `handleFinalizeOfferSheet`

**Same sub-hook pattern as Step 3.**

**Gate:** TypeScript clean + tests green.

---

## Step 5 — Extract `useArchitectActions.contractActions.ts` (sub-hook)

**What moves:** All remaining action handlers (approx L5134–L6103).

**Handlers:**
- `handleSetDeadCap`
- `handleSetExceptions`
- `handleEditContract`
- `handleCapTableModalAction`
- `handleCapHoldRenounce`
- `handleExtendContract`
- `handleWaiveContract`
- `handleOptionDecision`
- `handleRenounceRights`

**Same sub-hook pattern.**

**Gate:** TypeScript clean + `npm run test:architect -- --reporter=dot` (only
pre-existing phase66-70 failures).

---

## What stays in `useArchitectActions.ts` after all steps

- Imports + `export * from './useArchitectActions.types'`
- Hook signature and parameter destructuring (L2249–L2460)
- Shared persistence closures + internal helpers (L2461–L3848) — these close over
  too much state to extract without a major refactor; ~1,388 lines stays here
- Three sub-hook calls: `useTradeActions(...)`, `useOfferSheetActions(...)`,
  `useContractActions(...)`
- The `return { ... }` that assembles all handlers

Estimated ~1,700 lines.

---

## Difficulty note: Steps 1–2 vs Steps 3–5

**Steps 1–2** are mechanical — same extraction pattern as Waves 4/5. Expect zero
surprises.

**Steps 3–5** require identifying which shared closures each handler uses and
passing them as explicit params to the sub-hook. The main risk: missing a
dependency in the sub-hook's parameter list → TypeScript will catch it immediately.
Plan for 1–3 TypeScript fix iterations per step.

---

## One step at a time

Execute one step per session. Start with Step 1 — it's the safest and gives
immediate relief (6,139 → ~4,928 lines, purely mechanical).
