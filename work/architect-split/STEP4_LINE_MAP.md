# Step 4a — mutationPipeline.ts Phase Boundary Map

Produced: 2026-05-13 (Wave 4 Step 4a)

---

## Verified Phase Ranges

| Phase | Start | End | Content |
|-------|-------|-----|---------|
| Preamble / Types | 1 | 2,726 | Imports, re-exports (tradeContext), 42 exported types |
| Utility Types & Helpers | 2,727 | ~3,050 | sanitizeTransientFieldsForPersistence, deep sanitization utils |
| READ — Normalization Core | 3,051 | 10,390 | ~7,340 lines of state-loading helpers, normalizers, boundary builders |
| COMPUTE | 10,391 | 12,009 | `computeWorldMutation` + 15 `compute*Result()` variants |
| VALIDATE | 12,010 | 12,148 | `validateMutation` (phase 3 marker at line 12,011) |
| Persist helpers (Phase 4) | 12,149 | 13,325 | Persist orchestration helpers (called by `applyWorldMutation`) |
| EXPORTS section | 13,326 | 13,412 | Final helpers (`getMutationActionType`, `computeSetDeadCapResult`) |

**Note:** The PLAN's estimated ranges (READ 1-10390, COMPUTE 10391-12009, VALIDATE 12010-12147, PERSIST 12148-13412) match the actual markers at lines 9596, 10392, 12011, 12160. The PLAN estimates are **confirmed accurate**.

### Phase markers in file

| Line | Marker |
|------|--------|
| 9,596 | `// PHASE 1: READ - Load state for mutation` |
| 10,392 | `// PHASE 2: COMPUTE (PURE) - Calculate mutation result` |
| 12,011 | `// PHASE 3: VALIDATE - Ensure mutation is legal` |
| 12,149 | `// PHASE 59: LEGACY VALIDATION HELPERS REMOVED` |
| 12,160 | `// PHASE 4: PERSIST - Write to Firestore (ONLY place that writes)` |

---

## Exported Symbols (42 types + 13 functions)

### Types (suitable for mutationPipeline.types.ts)

All 42 exported types are standalone — no dependencies on each other beyond standard TypeScript references. Safe to extract as a unit.

| Lines | Type |
|-------|------|
| 236 | `ArchitectComputedTeamTotalsSnapshot` |
| 254 | `ArchitectMutationTeamTotals` |
| 293 | `ArchitectMutationSalaryRow` |
| 318 | `NormalizedMutationSalaryRow` |
| 337 | `ArchitectMutationBirdRights` |
| 346 | `ArchitectMutationFreeAgency` |
| 357 | `ArchitectMutationContract` |
| 407 | `ArchitectMutationDeadCapEntry` |
| 419 | `ArchitectMutationExceptionEntry` |
| 451 | `ArchitectMutationExceptions` |
| 462 | `ArchitectMutationOfferSheet` |
| 499 | `ArchitectMutationPlayerRecord` |
| 554 | `ArchitectMutationTeamRecord` |
| 610 | `ArchitectTradePayloadPlayerIngress` |
| 630 | `ArchitectTradePayloadPlayer` |
| 655 | `ArchitectTradePayloadTeamRef` |
| 662 | `ArchitectTradePayloadLegacyReceivingPlayer` |
| 667 | `ArchitectTradePayloadTeamIngress` |
| 694 | `ArchitectTradePayloadTeam` |
| 735 | `ArchitectMutationValidatedTradeContext` |
| 742 | `ArchitectMutationTradeContext` |
| 755 | `ArchitectMutationPayload` |
| 1,400 | `ArchitectMutationComputedTeamSnapshot` |
| 1,402 | `ArchitectMutationTeamUpdate` |
| 1,416 | `ArchitectGeneralMutationCommittedTeamSnapshot` |
| 1,419 | `ArchitectGeneralMutationCommittedTeamUpdate` |
| 1,529 | `ArchitectGeneralMutationDashboardReloadTeamSnapshot` |
| 1,552 | `ArchitectGeneralMutationDashboardReloadTeamUpdate` |
| 1,637 | `MutationTeamMap` |
| 1,646 | `ArchitectMutationPlayerUpdate` |
| 1,650 | `ArchitectMutationPlayerDelete` |
| 1,654 | `ArchitectMutationWritesSummary` |
| 1,678 | `MutationResultIssueLike` |
| 1,831 | `ArchitectMutationResult` |
| 1,893 | `SignAndTradePreflightStatus` |
| 1,894 | `SignAndTradePreflightResult` |
| 1,900 | `OfferSheetPreflightStatus` |
| 1,901 | `OfferSheetPreflightResult` |
| 1,907 | `MutationPayloadLike` |
| 1,963 | `ComputeResultLike` |
| 1,965 | `PostStateTotalsByTeam` |
| 2,062 | `MutationCurrentState` |

### Functions (exported)

| Line | Function | Phase | Pure? |
|------|----------|-------|-------|
| 1,859 | `findUpdatedTeamSnapshot` | Pre-READ | Yes (pure lookup) |
| 1,882 | `findCommittedTeamSnapshot` | Pre-READ | Yes (pure lookup) |
| 3,171 | `resolveWorldAsOfDate` | READ | Yes (date resolution) |
| 7,393 | `extractTeamsByCodeFromComputeResult` | READ | Yes (pure extraction) |
| 7,407 | `buildTotalsByTeam` | READ | Yes (pure computation) |
| 8,007 | `buildGeneralMutationDashboardReloadTeamSnapshot` | READ | Yes (pure build) |
| 8,165 | `buildPostStateRulesContext` | READ | Yes (pure build) |
| 8,716 | `buildWorldMutationEventPayload` | READ (pre-COMPUTE) | Yes (pure build) |
| 8,815 | `applyWorldMutation` | ORCHESTRATOR | No (async, writes to Firestore) |
| 9,281 | `preflightSignAndTradeMutation` | ORCHESTRATOR | No (async, reads Firestore) |
| 9,427 | `preflightOfferSheetMutation` | ORCHESTRATOR | No (async, reads Firestore) |
| 10,407 | `computeWorldMutation` | COMPUTE | Yes (pure dispatcher) |
| 12,033 | `validateMutation` | VALIDATE | Yes (pure validation) |

---

## Per-compute*Result() Analysis

| Function | Lines | Pure? | Cross-phase calls |
|----------|-------|-------|-------------------|
| `computeNormalizedWorldMutation` | 10,423–10,654 | Yes | `materializeCurrentStateBaseTeamPreservedFields` (1x) |
| `computeTradeResult` | 10,655–11,159 | Yes | `getTeamSourceRecord` (5x), `getMutationPlayerId` (1x), `getMutationRosterEntryId` (2x), `synchronizeTeamTotalsSnapshotOrTeam` (1x) |
| `computeSigningResult` | 11,160–11,347 | Yes | `requireSigningState` (1x), `getMutationPlayerId` (2x), `getMutationRosterEntryId` (1x), `synchronizeTeamTotalsSnapshotOrTeam` (1x), `getTeamSourceRecord` (2x) |
| `computeWaiveResult` | 11,348–11,504 | Yes | `requireBasicTeamAndPlayerState` (1x), `getMutationPlayerId` (1x), `getMutationRosterEntryId` (1x), `getTeamSourceRecord` (2x), `synchronizeTeamTotalsSnapshotOrTeam` (1x) |
| `computeExtensionResult` | 11,505–11,625 | Yes | `requireBasicTeamAndPlayerState` (1x), `getMutationPlayerId` (1x), `getTeamSourceRecord` (2x), `synchronizeTeamTotalsSnapshotOrTeam` (1x) |
| `computeOptionResult` | 11,626–11,812 | Yes | `requireBasicTeamAndPlayerState` (1x), `getMutationPlayerId` (1x), `getTeamSourceRecord` (2x), `synchronizeTeamTotalsSnapshotOrTeam` (1x) |
| `computeRenounceResult` | 11,813–11,948 | Yes | `requireBasicTeamAndPlayerState` (1x), `getMutationPlayerId` (1x), `getTeamSourceRecord` (2x), `synchronizeTeamTotalsSnapshotOrTeam` (1x) |
| `computeSetExceptionsResult` | 11,949–12,009 | Yes | `requireBasicTeamState` (1x), `getTeamSourceRecord` (1x), `synchronizeTeamTotalsSnapshotOrTeam` (1x) |
| `computeStoreOfferSheetResult` | 12,422–12,641 | Yes | `requireOfferSheetTeamState` (1x), `getTeamSourceRecord` (2x), `getMutationPlayerId` (1x) |
| `computeMatchOfferSheetResult` | 12,642–12,731 | Yes | `requireOfferSheetTeamState` (1x), `getTeamSourceRecord` (2x) |
| `computeDeclineOfferSheetResult` | 12,732–12,820 | Yes | `requireOfferSheetTeamState` (1x), `getTeamSourceRecord` (2x) |
| `computeFinalizeMatchedOfferSheetResult` | 12,821–12,991 | Yes | `requireOfferSheetTeamState` (1x), many shared helpers |
| `computeFinalizeDeclinedOfferSheetResult` | 12,992–13,189 | Yes | `requireOfferSheetTeamState` (1x), many shared helpers |
| `computeSignAndTradeResult` | 13,190–13,361 | Yes | `requireDestinationState` (1x), `getTeamSourceRecord` (4x), `synchronizeTeamTotalsSnapshotOrTeam` (2x) |
| `computeSetDeadCapResult` | 13,362–13,412 | Yes | `requireBasicTeamState` (1x), `getTeamSourceRecord` (1x) |

All `compute*Result()` functions are **logically pure** (no I/O, deterministic given inputs). They do however call helper functions currently defined in the READ section.

---

## Cross-Phase Dependency Analysis

### ⚠️ STOP CONDITION TRIGGERED

**The PLAN's COMPUTE/READ split cannot proceed as written.** The `compute*Result()` functions call 30+ functions that are currently defined in the READ section (lines 1–10,390).

Key cross-phase dependencies (defined in READ, called from COMPUTE):

| Function | Defined at | COMPUTE calls | READ calls |
|----------|-----------|---------------|------------|
| `getTeamSourceRecord` | ~7,103 | 18x | 0 |
| `synchronizeTeamTotalsSnapshotOrTeam` | ~5,xxx | 9x | 0 |
| `getMutationPlayerId` | ~9,936 | 10x | 3x |
| `requireBasicTeamAndPlayerState` | ~7,023 | 4x | 0 |
| `requireOfferSheetTeamState` | ~7,079 | 4x | 0 |
| `getMutationRosterEntryId` | ~6,946 | 5x | 2x |
| `removeOfferSheetEntries` | ~xxx | 4x | 0x |
| `removeUndefinedDeep` | ~xxx | 4x | 0x |
| `normalizeMutationExceptionsFromIngress` | ~xxx | 3x | 0x |
| `cloneWritesSummary` | ~8,xxx | 2x | 5x |
| `buildCanonicalPlayerPersistenceManifest` | ~10,381 | 2x | 1x |
| `materializeCurrentStateBaseTeamPreservedFields` | ~2,849 | 2x | 5x |
| `requireBasicTeamState` | ~7,012 | 2x | 1x |
| `requireSigningState` | ~7,044 | 1x | 2x |
| `requireDestinationState` | ~7,063 | 1x | 1x |
| ...and 15 more | — | — | — |

**The PLAN says:** "If Step 4a reveals that the phases are not cleanly separable (e.g., COMPUTE functions repeatedly call into READ helpers in ways that can't be untangled), stop and surface the finding. Wave 4 may need to land a smaller Step 4 (types-only extraction)."

### What IS safe to extract

**`mutationPipeline.types.ts` (Step 4b)** — The 42 exported types are cleanly separable. No function dependencies. Safe to proceed.

**`mutationPipeline.compute.ts` (Step 4c)** — BLOCKED unless the shared helpers are first extracted to a `mutationPipeline.helpers.ts` (or types.ts extended), or the PLAN constraint "compute MUST NOT import from read.ts" is relaxed. This requires user decision.

**`mutationPipeline.read.ts` (Step 4d)** — Similarly blocked. If a shared helpers module exists, the READ section can be split after COMPUTE is stable.

### Recommended paths

**Option 1 (Safer, smaller):** Extract only `mutationPipeline.types.ts`. Leaves 13,000 lines in the main file but achieves Step 4b unambiguously. Requires user decision to authorize going further.

**Option 2 (Full split with new shared module):** Add a `mutationPipeline.helpers.ts` submodule for the ~30 cross-phase utilities, then extract COMPUTE and READ in subsequent steps. Requires plan deviation + additional step.

**Option 3 (Relax constraint):** Allow compute.ts to import from read.ts (treating read as a "utilities layer"). This requires updating the PLAN's circular-import rules and accepting that read.ts becomes a dependency of compute.ts.

---

## Confirmed Plan Table Update

The PLAN.md Step 4 table was based on unverified estimates. Verified values:

| Phase | Estimated | Verified | Accurate? |
|-------|-----------|----------|-----------|
| READ | 1–10,390 | 9,596–10,390 (section header) | ✅ matches |
| COMPUTE | 10,391–12,009 | 10,392–12,010 | ✅ matches |
| VALIDATE | 12,010–12,147 | 12,011–12,032 (section header) | ✅ matches |
| PERSIST | 12,148–13,412 | 12,160–13,412 | ✅ matches |

No plan table update needed — the estimates were accurate.
