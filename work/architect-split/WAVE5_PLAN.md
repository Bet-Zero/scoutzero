# Wave 5 — `mutationPipeline.read.ts` Split Plan

**Goal:** Break the 5,248-line `read.ts` into 4 focused submodules + a thin orchestrator,
so AI agents can work with each piece in context without burning the whole window.

**Scope:** `mutationPipeline.read.ts` only. One file, one wave.

**Approach:** Same pattern as Wave 4 — extract by domain, re-export from orchestrator,
no call-site changes needed.

---

## Proposed output

| File | Est. lines | Contents |
|------|------------|----------|
| `mutationPipeline.read.normalizeData.ts` | ~1,000 | Raw Firestore → typed value normalizers |
| `mutationPipeline.read.normalizeTeam.ts` | ~1,100 | Team current-state construction |
| `mutationPipeline.read.persistence.ts`  | ~1,300 | Post-compute persistence + dashboard reload + audit |
| `mutationPipeline.read.stateLoader.ts`  | ~550   | `loadStateForMutation` + world lineage + offer sheet |
| `mutationPipeline.read.ts` (reduced)    | ~700   | Utilities + `export *` from all 4 submodules |

Total: ~4,650 lines across 5 files. Largest is ~1,300. Down from one 5,248-line file.

---

## Step-by-step

### Step 0 — Baseline
Run `npm run test:architect -- --reporter=dot` and confirm only the 5 pre-existing
phase66-70 failures. Record the result.

---

### Step 1 — Extract `mutationPipeline.read.normalizeData.ts`

**What moves:** All functions that normalize a raw incoming Firestore value into a
typed internal value. These are pure data-shaping functions with no side effects.

**Line range in current `read.ts`:** approximately L1060–L1960

Functions:
- `normalizeCurrentStateCashLedger`
- `normalizeCurrentStateOfferSheetSalaryRows`
- `normalizeCurrentStateOfferSheet`
- `normalizeCurrentStateOfferSheets`
- `normalizeCurrentStateCapHold`
- `normalizeCurrentStateCapHolds`
- `normalizeCurrentStateDeadCapAmountByYear`
- `normalizeCurrentStateDeadCapEntry`
- `normalizeCurrentStateDeadCap`
- `normalizeCurrentStateTotalsDeltas`
- `normalizeCurrentStateTotalsMeta`
- `normalizeCurrentStateTeamTotals`
- `normalizeCurrentStateDraftPickProtectionMeta`
- `normalizeCurrentStateDraftPickConveyance`
- `normalizeCurrentStateDraftPickMetadata`
- `normalizeCurrentStateDraftPick`
- `normalizeCurrentStateDraftPicks`
- `toCurrentStateTradeException`
- `normalizeCurrentStateTradeExceptions`
- `MutationExceptionPreserveOnlyBuckets` (type)
- `hasMutationExceptionBuckets`
- `normalizeCurrentStateTeamExceptions`
- `normalizeCurrentStateExceptionHistory`
- `CurrentStatePlayerBoundaryInput` (type)
- `normalizeCurrentStatePlayerArray`
- `resolveCurrentStateTeamTotalSalary`

**Wiring:** `read.ts` adds `export * from './mutationPipeline.read.normalizeData'`.
Any guardrail tests that source-scan `read.ts` for these patterns need to combine
`read.ts + read.normalizeData.ts`.

**Gate:** `npm run test:architect -- --reporter=dot` — only pre-existing failures.

---

### Step 2 — Extract `mutationPipeline.read.normalizeTeam.ts`

**What moves:** Everything that builds a fully-normalized team current-state object
for a specific mutation type. Depends on Step 1 (imports from normalizeData).

**Line range in current `read.ts`:** approximately L1960–L3005

Functions:
- `CURRENT_STATE_PLAYER_OPS_PRESERVED_FIELDS` (const)
- `CURRENT_STATE_MANUAL_CAP_PRESERVED_FIELDS` (const)
- `CURRENT_STATE_SIGNING_PRESERVED_FIELDS` (const)
- `CURRENT_STATE_OFFER_SHEET_MIRROR_PRESERVED_FIELDS` (const)
- `CURRENT_STATE_OFFER_SHEET_RESOLUTION_PRESERVED_FIELDS` (const)
- `buildCurrentStateBaseTeamBoundaryInput`
- `buildCurrentStateTradeTeamBoundaryInput`
- `normalizeCurrentStateTeamMutationCore`
- `buildCurrentStateBaseTeamPreservedFields`
- `normalizeCurrentStateBaseTeamBoundary`
- `buildCurrentStateTradeTeamPreservedFields`
- `normalizeCurrentStateTradeTeamBoundary`
- `buildCurrentStatePlayerOpsTeam`
- `buildCurrentStateManualCapTeam`
- `buildCurrentStateSigningTeam`
- `buildCurrentStateOfferSheetMirrorTeam`
- `buildCurrentStateOfferSheetResolutionTeam`
- `buildCurrentStateTradeTeam`
- `isCurrentStateTeamBoundaryObject`
- `buildPostComputeTradeBoundaryInput`
- `normalizePostComputeTeamSnapshotForPostState`
- `normalizeCurrentStateTeamSnapshot` (all overloads)
- `normalizeTradeMutationCurrentStateTeamEntry`
- `normalizeTradeMutationCurrentState`
- `normalizeTeamOnlyMutationCurrentState`
- `normalizeTeamAndPlayerMutationCurrentState`
- `normalizeOfferSheetTeamAndPlayerMutationCurrentState`
- `normalizeOfferSheetMirrorMutationCurrentState`
- `normalizeOfferSheetResolutionMutationCurrentState`
- `normalizeSignAndTradeMutationCurrentState`

**Gate:** same as Step 1.

---

### Step 3 — Extract `mutationPipeline.read.stateLoader.ts`

**What moves:** The top-level state-loading entry point and everything it directly
depends on that isn't shared more broadly. This is the "READ phase public API".

**Line range in current `read.ts`:** approximately L3005–L3440 + L4787–L5248

Functions:
- `toLineageOverrideMergeBio`
- `toLineageOverrideMergePlayer`
- `mergeLineageOverrideSalariesByYear`
- `mergeLineageOverridePlayers`
- `CurrentStateWithBasicTeam` (type)
- `CurrentStateWithBasicTeamAndPlayer` (type)
- `CurrentStateWithSigningPair` (type)
- `materializeCurrentStateTeamForAudit`
- `getSnapshotRosterMembership`
- `getSnapshotPlayersMembership`
- `resolveWorldLineage`
- `getFirstExplicitWorldTeamSnapshotFromLineage`
- `getFirstExplicitWorldPlayerOverrideFromLineage`
- `resolveStoreOfferSheetAuthority`
- `loadStateForMutation` (the main entry point)
- `withDefaultPlayerDeletes`
- `MutationPlayerIdCarrier` (type)
- `matchesOfferSheetIdentity`
- `removeOfferSheetEntries`
- `buildNormalizedOfferSheetFinalContract`

**Gate:** same as Step 1.

---

### Step 4 — Extract `mutationPipeline.read.persistence.ts`

**What moves:** Everything related to preparing and normalizing data for persistence,
dashboard reload, and audit/event recording. This is the "post-compute output layer".

**Line range in current `read.ts`:** approximately L3440–L4787

Functions:
- `extractTeamsByCodeFromComputeResult`
- `buildTotalsByTeam`
- `prepareGeneralMutationPersistenceTeamSnapshot`
- `buildGeneralMutationCommittedTeamSnapshot`
- `buildGeneralMutationCommittedTeamUpdates`
- `normalizeDashboardReloadDeadCapAmountByYear`
- `normalizeDashboardReloadDeadCapEntry`
- `normalizeDashboardReloadDeadCap`
- `normalizeDashboardReloadExceptionEntry`
- `normalizeDashboardReloadExceptions`
- `normalizeDashboardReloadOfferSheet`
- `normalizeDashboardReloadOfferSheets`
- `normalizeDashboardReloadContractDateLike`
- `normalizeDashboardReloadContractFreeAgency`
- `normalizeDashboardReloadContractBirdRights`
- `normalizeDashboardReloadPlayerContract`
- `normalizeDashboardReloadPlayer`
- `normalizeDashboardReloadPlayers`
- `buildGeneralMutationDashboardReloadTeamSnapshot`
- `canonicalizeTeamUpdatesWithCanonicalTotals`
- `canonicalizeComputeResultTeamUpdates`
- `collectMutationPlayerIds`
- `buildPostStateRulesContext`
- `buildCapAuditDiffSummary`
- `FREE_AGENCY_MUTATION_TYPES` (const)
- `buildComputeWritesSummary`
- `buildMutationFailureResult`
- `sanitizeStringList`
- `collectPlayerTouchIds`
- `deriveEventTeamCodes`
- `deriveEventPlayerIds`
- `TEAM_HISTORY_REQUIRED_MUTATION_TYPES` (const)
- `normalizeEventMutationType`
- `toSafeIsoTimestamp`
- `coerceObject`
- `toArrayOfStrings`
- `deriveContractSummary`
- `deriveTradePicksMoved`
- `buildTeamHistoryDiffSummary`
- `buildTeamHistoryMutationMetadata`
- `buildWorldMutationEventPayload`

**Gate:** same as Step 1.

---

### Step 5 — Update all guardrail tests + final gate

Source-scan tests that read `mutationPipeline.read.ts` for patterns now in submodules
need the same `content = read.ts + read.normalizeData.ts + ...` treatment used in
Wave 4. Identify all failures from Step 4's gate run and fix them.

Then run:
- `npm run typecheck` — must be clean
- `npm run test:architect -- --reporter=dot` — only pre-existing phase66-70 failures
- `npm run build` — must succeed

---

## Dependency order (safe execution sequence)

```
normalizeData  ← no internal read.ts deps
normalizeTeam  ← imports normalizeData
stateLoader    ← imports normalizeData + normalizeTeam
persistence    ← imports normalizeData + normalizeTeam
read.ts        ← export * from all 4
```

`normalizeData` must be extracted first. Steps 2–4 can be done in any order after that.
Step 3 and Step 4 are independent of each other.

---

## What stays in `mutationPipeline.read.ts` after all steps

- Section headers and the `export *` re-exports for all 4 submodules
- Infrastructure/utility functions used broadly across the module:
  - `findUndefinedPaths`, `attachCurrentStateBaseTeamPreservedFields`,
    `backfillCurrentStateBaseTeamPreservedFields`, `stripComputeOnlyTeamFieldsForPersistence`,
    `guardAgainstUndefined`, `sanitizePayloadForOverride`
  - `resolveWorldAsOfDate`, `generateOperationId`, `safeCloneForAudit`, `getErrorMessage`,
    `toValidationMessage`, `dedupeMessages`
  - `hasIncompleteSignAndTradeViolation`, `validateSignAndTradeSigningPhase`,
    `summarizeSignAndTradeAuthority`
  - `loadWorldAsOfDate`, `addTeamSnapshot`, `extractTeamsByCodeFromCurrentState`
  - `toTradePayload`, `toOptionalScalarId`, `normalizeRosterEntries`, `toOptionalDateLike`
  - `AUTHORITATIVE_SAT_PREFLIGHT_SOURCE`, `SAT_INCOMPLETE_VALIDATION_CODES`,
    `CAP_AUDIT_EVENT_SCHEMA_VERSION`
- All existing imports (trimmed to what actually stays)
- Re-exports of `FORBIDDEN_TRANSIENT_KEYS` and `sanitizeTransientFieldsForPersistence`

Estimated ~700 lines.

---

## One step at a time

Execute one step per session. Don't plan Step 2 while executing Step 1.
Each step is self-contained and independently testable.
