# Wave 9 — `tradeValidator.ts` + `tradeContext.ts` Split Plan

**Goal:** Break the two largest pure-TypeScript utility files that haven't been touched yet.

**Scope:** Two files, four steps.

| File | Before | After (est.) |
|------|--------|--------------|
| `tradeValidator.ts` | 1,894 lines | ~1,230 lines |
| `tradeContext.ts` | 1,840 lines | ~960 lines |

---

## Target 1 — `tradeValidator.ts` (Steps 1–2)

### Structure of the current file

| Lines | Content |
|-------|---------|
| 1–260 | Imports + type definitions |
| 261–397 | Scalar normalizers: `normalizeTeamCodeLike`, `resolveTeamIdentity`, `resolvePlayerDestinationTeamId`, `normalizeTradeValidationDate`, `getDeterministicValidationDate`, `deriveSeasonStateFromDate`, `hasOwn`, `normalizeArrayInput`, `isObjectLike`, `isRuleEnvelopeObject` |
| 398–648 | Rule envelope readers: `readSalaryMatchingRuleEnvelope`, `readSignAndTradeRuleEnvelope`, `readHardCapRuleEnvelope`, `toSignAndTradeCapProjectionMap`, `createRuleEnvelope`, `buildValidationResult` |
| 649–801 | Player routing + roster legality: `shouldRoutePlayerToTeam`, `extractPlayerId`, `computeProjectedRosterLegality`, `baseValidators`, `validators` |
| 802–1091 | `generateTradeReceipt` |
| 1092–1894 | `validateTrade` (orchestrator) |

### Why Step 1 before Step 2

`generateTradeReceipt` calls `readSalaryMatchingRuleEnvelope` and `buildValidationResult`.
Extracting rule envelopes first (Step 1) lets the receipt file (Step 2) import cleanly from the
sibling submodule, avoiding any circular dependency with the main file.

---

### Step 1 — Extract `tradeValidator.ruleEnvelopes.ts`

**What moves:** Scalar normalizers + rule envelope readers (L261–L648).

**Functions:**
- `TRADE_VALIDATOR_VERSION` (exported constant)
- `normalizeTeamCodeLike`, `resolveTeamIdentity`, `resolvePlayerDestinationTeamId`
- `normalizeTradeValidationDate`, `getDeterministicValidationDate`, `deriveSeasonStateFromDate`
- `hasOwn`, `normalizeArrayInput`, `isObjectLike`, `isRuleEnvelopeObject`
- `readSalaryMatchingRuleEnvelope`, `readSignAndTradeRuleEnvelope`, `readHardCapRuleEnvelope`
- `toSignAndTradeCapProjectionMap`, `createRuleEnvelope`, `buildValidationResult`

**Note:** `TRADE_VALIDATOR_VERSION` is already exported — the barrel re-export preserves this.
Most of these are private to the file; only `TRADE_VALIDATOR_VERSION` is externally consumed.

**Dependencies (imports the new file needs):**
- Types from `./tradeValidator` types section (TradeValidator* types)
- Any external rule/validator types already imported at the top of tradeValidator.ts

**Pattern:** Same barrel — `tradeValidator.ts` gets
`export * from './tradeValidator.ruleEnvelopes'` + explicit internal import.

**Gate:** TypeScript clean + `npm run test:architect -- --reporter=dot`.

**Est. size:** ~390 lines. `tradeValidator.ts` drops from 1,894 → ~1,504.

---

### Step 2 — Extract `tradeValidator.receipt.ts`

**What moves:** `generateTradeReceipt` (L802–L1091).

**Functions:**
- `generateTradeReceipt`

**Dependencies (imports the new file needs):**
- `readSalaryMatchingRuleEnvelope`, `buildValidationResult` from `./tradeValidator.ruleEnvelopes`
- Types from `./tradeValidator`

**Note:** `validateTrade` calls `generateTradeReceipt` at the very end (line ~1866). After
extraction, tradeValidator.ts imports it explicitly from the submodule.

**Gate:** TypeScript clean + tests green.

**Est. size:** ~290 lines. `tradeValidator.ts` drops to ~1,214.

---

## Target 2 — `tradeContext.ts` (Steps 3–4)

### Structure of the current file

| Lines | Content |
|-------|---------|
| 1–114 | Imports |
| 115–154 | Private scalar converters: `toFiniteNumberOrUndefined`, `toNonEmptyString`, `toScalarId`, `toStringOrNull`, `toObjectRecord` |
| 155–731 | Player projection + exception normalization + payload normalization (see below) |
| 732–1229 | `buildPostTradeTeamsSnapshot` (large snapshot builder) |
| 1230–1345 | `validatePostTradeSnapshotForContext` |
| 1346–1701 | Preparation builders (see Step 4) |
| 1702–1840 | Preview authority: `buildPreviewAuthorityTeamMaps`, `getTradePreviewAuthority`, `getFullLegalityPreview` |

### Lines 155–731 breakdown (Step 3 target)

| Lines | Content |
|-------|---------|
| 155–376 | Player projection helpers: `toSignAndTradePlayerLike`, `projectTradeApplyValidationPlayer`, `normalizeFallbackTradeApplyValidationTeam`, `getTradeApplyValidationPlayerKey`, `mergeTradeApplyValidationPlayer`, `buildAuthoritativeTradeApplyReceives` |
| 377–505 | Exception normalization: `normalizeSnapshotTradeException`, `buildSnapshotTradeExceptions` |
| 506–731 | Payload normalization: `normalizeTradeTeamCodeLike` (exported), `resolveOutgoingTradeDestinationTeamCode` (exported), `getTradePayloadPlayerId`, `getTradePayloadPlayerMatchKey`, `findMatchingTradeReceivePayload`, `findTradePlayerSnapshot`, `buildTradeValidationPlayer`, `buildTradeValidationTeamRecord`, `buildTradeValidatorContext`, `buildTradeIncomingPlayerSnapshot` |

---

### Step 3 — Extract `tradeContext.payloadNormalization.ts`

**What moves:** Lines 155–731 (player projections + exception normalization + payload normalization).

**Critical note on private scalar converters (lines 115–154):** The functions in lines 155–731
use `toFiniteNumberOrUndefined`, `toScalarId`, etc. These are private to tradeContext.ts.
**Copy** the 5 private converters (40 lines) into the new file rather than importing them from
`./tradeContext` — importing back would be circular.

**Exported functions that other files already import:**
- `normalizeTradeTeamCodeLike` — imported by `mutationPipeline.helpers.ts`, `mutationPipeline.compute.trade.ts`
- `resolveOutgoingTradeDestinationTeamCode` — imported by `mutationPipeline.helpers.ts`

The barrel `export * from './tradeContext.payloadNormalization'` in tradeContext.ts preserves
these export paths automatically. No changes needed in the importing files.

**Dependencies (imports the new file needs):**
- Types from `./tradeContext` (TradeContextCurrentState, snapshot types, etc.)
- External imports already at top of tradeContext.ts

**Gate:** TypeScript clean + `npm run test:architect -- --reporter=dot`.

**Est. size:** ~620 lines (576 content + 40 copied converters + header). `tradeContext.ts` drops from 1,840 → ~1,264.

---

### Step 4 — Extract `tradeContext.preparation.ts`

**What moves:** Preparation builders (L1350–L1701, ~351 lines).

**Functions:**
- `normalizeTradePayloadPlayer`
- `normalizeTradePayloadEntitlements`
- `normalizeTradePayloadTeam`
- `normalizeTradeContextPayload` (exported)
- `buildTradeValidationPayload`
- `buildSignAndTradeTradeHandoff` (exported)
- `buildTradeApplyPreparation` (exported)

**Exported functions that other files already import:**
- `buildSignAndTradeTradeHandoff` — imported by `mutationPipeline.compute.ts`
- `buildTradeApplyPreparation` — imported by `mutationPipeline.ts`
- `normalizeTradeContextPayload` — imported by `mutationPipeline.read.ts` (verify during execution)

The barrel preserves all export paths.

**Dependencies (imports the new file needs):**
- Types from `./tradeContext`
- Payload normalization helpers from `./tradeContext.payloadNormalization` (barrel-safe)
- `buildPostTradeTeamsSnapshot`, `validatePostTradeSnapshotForContext` stay in `tradeContext.ts` —
  the new file calls them, so import from `./tradeContext` (direction: preparation → tradeContext is fine; tradeContext does not import from preparation).

**Gate:** TypeScript clean + tests green.

**Est. size:** ~370 lines. `tradeContext.ts` drops to ~893.

---

## What remains in each file after all steps

### `tradeValidator.ts` (~1,214 lines)
- Imports + type definitions (1–260)
- Player routing + roster legality (649–801) — kept here because `computeProjectedRosterLegality` calls `baseValidators`/`validators` which are defined inline
- `validateTrade` orchestrator (1092–1894)
- Barrel re-exports + internal imports for both submodules

### `tradeContext.ts` (~893 lines)
- Imports (1–114)
- Private scalar converters (115–154) — kept here; copied (not imported) by payloadNormalization
- `buildPostTradeTeamsSnapshot` (732–1229)
- `validatePostTradeSnapshotForContext` (1230–1345)
- Preview authority: `buildPreviewAuthorityTeamMaps`, `getTradePreviewAuthority`, `getFullLegalityPreview` (1702–1840)
- Barrel re-exports + internal imports for both submodules

---

## Difficulty note

**Steps 1–2** (tradeValidator): Purely mechanical. The main risk is that `generateTradeReceipt`
or `validateTrade` uses private utilities scattered through the file — TypeScript will catch every
missed import immediately. Expect 1–2 fix rounds per step.

**Steps 3–4** (tradeContext): Moderate. The `buildPostTradeTeamsSnapshot` (staying in
tradeContext.ts) is large (~500 lines) and may call functions from the extraction target. Check
carefully during execution with grep before removing lines. The private scalar converters must be
copied, not imported (circular-import avoidance).

---

## One step at a time

Execute one step per session. Start with Step 1 — rule envelope readers are the most self-contained
cluster, have zero circular-dep risk, and unlock Step 2.
