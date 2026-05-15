# Wave 7 — `mutationPipeline.ts` + `signing.ts` Split Plan

**Goal:** Break the two largest remaining files into AI-agent-friendly pieces.

**Scope:** Two files only.

| File | Before | After (est.) |
|------|--------|--------------|
| `mutationPipeline.ts` | 4,254 lines | ~1,500 lines |
| `capLegalityValidation/signing.ts` | 3,020 lines | ~1,200 lines |

---

## Target 1 — `mutationPipeline.ts` (Steps 1–3)

### Why it's still large

Wave 4 extracted helpers, read, and compute into submodules but left all type
definitions inside the main file. Lines 186–2372 (~2,186 lines) are pure type
and interface declarations — no runtime code. Extracting them is fully
mechanical.

---

### Step 1 — Extract `mutationPipeline.types.ts`

**What moves:** All type and interface declarations (L186–L2372).

**Includes:**
- All contract types (`ArchitectMutationContract`, `LocalBirdRights`, etc.)
- All trade payload types (`TradeTeamPayload`, `TradePick`, etc.)
- All current-state types (`CurrentStatePlayerSnapshot`, etc.)
- All mutation event/result types (`ArchitectMutationResult`, etc.)
- All convenience aliases and ingress/input types

**Pattern:** Same as Wave 6 Step 1 (`useArchitectActions.types.ts`).
- New file exports everything
- `mutationPipeline.ts` gets `export * from './mutationPipeline.types'`
- `mutationPipeline.ts` adds explicit `import type { ... }` for internal use

**Consumers to update:** Several guardrail tests scan `mutationPipeline.ts`
source — they will need the types file added to their combined source string.
Run tests after and fix the same way as Waves 5/6.

**Gate:** `npx tsc --noEmit` clean + `npm run test:architect -- --reporter=dot`
(only pre-existing phase66–70 failures).

**Est. size:** ~2,200 lines. Main file drops from 4,254 → ~2,068.

---

### Step 2 — Extract `mutationPipeline.validate.ts`

**What moves:** The PHASE 3 validate section (currently ~L3842–L3978 in main).

**Includes:**
- `validateMutation()` function and all its internal helpers
- Any validation-only constants defined in that section

**Note:** `validateMutation()` is called by `applyWorldMutation()` which stays
in main. After extraction, main imports `validateMutation` from the new file.

**Gate:** TypeScript clean + tests green.

**Est. size:** ~150 lines. Main file drops to ~1,918.

---

### Step 3 — Extract `mutationPipeline.persist.ts`

**What moves:** The PHASE 4 persist section (currently ~L3991–L4254 in main).

**Includes:**
- `persistWorldMutation()` function and its internal helpers

**Note:** Same pattern — `applyWorldMutation()` in main calls
`persistWorldMutation()` imported from the new file.

**Gate:** TypeScript clean + tests green.

**Est. size:** ~260 lines. Main file drops to ~1,658.

---

## Target 2 — `capLegalityValidation/signing.ts` (Steps 4–5)

### Why it's large

`signing.ts` grew organically across many phases. It has five well-defined
sections already marked by section comments, making splits mechanical.
All content is pure TypeScript — no React, no hooks.

---

### Step 4 — Extract `signing.contractValidators.ts`

**What moves:** The PHASE 5 contract row schema validation helpers (L470–L698).

**Includes:**
- `validateSalaryRowSchema()`
- `validateGuaranteesPolicy()`
- `validateOptionsPolicy()`
- `validateContractRows()`

These are self-contained validators that take contract row data and return
validation results. They don't reference anything from the rest of signing.ts
except a few small utility types — those move with them or are imported back.

**Pattern:** Move functions, `signing.ts` imports them, re-exports via
`export * from './signing.contractValidators'`.

**Gate:** TypeScript clean + tests green.

**Est. size:** ~230 lines. `signing.ts` drops from 3,020 → ~2,790.

---

### Step 5 — Extract `signing.terms.ts`

**What moves:** The signing terms builder section (L739–L1356).

**Includes:**
- `BIRD_RIGHTS_KEYWORDS`, `RIGHTS_TYPE_MAP` constants
- `normalizeSigningTerms()`
- `isCapSpaceSigning()`
- Exception availability builders
- `getSigningTermsForPlayer()`

These functions build the "signing terms" data structure consumed by
`validateSigning()`. They are the largest self-contained block.

**Pattern:** Same as Step 4.

**Gate:** TypeScript clean + `npm run test:architect -- --reporter=dot`.

**Est. size:** ~620 lines. `signing.ts` drops to ~2,170.

---

## What stays in each file after all steps

### `mutationPipeline.ts` (~1,658 lines)
- Imports + `export *` barrels for all submodules
- `pickMutationPayloadFields()`, `normalizeComputeWorldMutationPayload()` utilities
- `computeTypedWorldMutation()`, `computeWorldMutation()`, `computeNormalizedWorldMutation()`
- `applyWorldMutation()` — the main orchestrator (PHASE 1 load, calls validate + persist)
- `preflightSignAndTradeMutation()`, `preflightOfferSheetMutation()`

### `capLegalityValidation/signing.ts` (~2,170 lines)
- Imports + `export *` barrels
- Utility helpers (L1–L289)
- Signing mechanism resolution (L309–L477)
- Raise validators (L1445–L1664)
- Exception eligibility + type mappers (L1732–L1914)
- `validateSigning()`, `validateOfferSheetResolution()` — the core public API

---

## Difficulty note

**Steps 1–3** (mutationPipeline.ts): Step 1 is mechanical but large — ~2,186
lines of types with many inter-references. Steps 2–3 are small and easy.

**Steps 4–5** (signing.ts): Step 4 is straightforward (self-contained
validators). Step 5 is the tricky one — `getSigningTermsForPlayer()` calls
many internal helpers; TypeScript will catch any missed imports immediately.
Plan for 2–3 fix iterations on Step 5.

---

## One step at a time

Execute one step per session. Start with Step 1 — purely mechanical and
gives the most relief (4,254 → 2,068 lines on the most-referenced file).
