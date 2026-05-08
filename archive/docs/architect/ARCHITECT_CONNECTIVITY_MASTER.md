# Architect Connectivity Master Doc

**Last Updated:** 2026-03-03
**Status:** PASS (14/14 checklist, 5/5 STOP conditions)
**Review:** ARCHITECT_CONNECTIVITY_R1_LOCAL

---

## Purpose

This document is the single source of truth for Architect GM Dashboard cross-tab connectivity in world mode. It proves that Trade Machine, Free Agency, Cap Sheet, Team History, and Offseason (Season Advance + Draft Positions) operate as a single coherent system — every commit action persists, updates cap state, and logs to Team History.

---

## SSOT Definitions

| SSOT | Firestore Path | Reference Builder |
|------|---------------|-------------------|
| World Team | `architect_worlds/{worldId}/teams/{teamCode}` | `architectFirestorePaths.ts:79-83` |
| World Metadata | `architect_worlds/{worldId}` | `architectFirestorePaths.ts:60-61` |
| World Events | `architect_worlds/{worldId}/events/{eventId}` | `collections.ts:67` |
| World Entitlements | `architect_worlds/{worldId}/entitlements/{entitlementId}` | `architectFirestorePaths.ts:126-136` |
| World Players | `architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}` | `architectFirestorePaths.ts:146-159` |

**Fallback Chain (read-only):** World → Parent World → Base Team (`teamLoader.js:34-71`)

---

## Covered Mutation Families

All mutation types registered in `MutationType` union (`mutationPipeline.js:313`):

| Family | Mutation Types | Pipeline Path |
|--------|---------------|---------------|
| Trade | `executeTrade` | `applyWorldMutation` → `computeTradeResult` |
| Free Agency | `signFreeAgent`, `signAndTrade` | `applyWorldMutation` → `computeSigningResult` |
| Rights | `renounceRights` | `applyWorldMutation` → `computeRenounceResult` |
| Cap Sheet | `waivePlayer`, `extendPlayer`, `optionDecision` | `applyWorldMutation` → family-specific compute |
| Cap Admin | `setExceptions`, `setDeadCap`, `setException`, `useException` | `applyWorldMutation` → family-specific compute |
| Offer Sheet | `storeOfferSheet`, `matchOfferSheet`, `declineOfferSheet`, `finalizeMatchedOfferSheet`, `finalizeDeclinedOfferSheet` | `applyWorldMutation` → offer sheet compute |
| TPE | `createTradeException`, `useTradeException` | `applyWorldMutation` → TPE compute |
| Offseason | `seasonAdvance` | `advanceSeasonInWorld` (parallel batch path) |

---

## Write Paths

### Canonical Mutation Pipeline

- Entry: `applyWorldMutation()` (`mutationPipeline.js:1128`)
- Persist: `persistWorldMutation()` (`mutationPipeline.js:3526`)
- Atomic: Firestore `writeBatch.commit()` (line 3689)
- Fail-closed: `teamsPatched > 0 && eventsWritten > 0 && worldMetadataPatched > 0` (line 1462)

### Season Advance (Parallel Path)

- Entry: `advanceSeasonInWorld()` (`seasonManager.js:613`)
- Direct batch write (not routed through `applyWorldMutation`)
- Same atomic pattern: teams + event + metadata in single `batch.commit()` (line 945)
- Same event subcollection (`ARCHITECT_WORLD_EVENTS_SUBCOLLECTION`)
- Justified: league-wide 30-team operation doesn't fit single-mutation model

### Draft Positions (Config Path)

- Entry: `saveDraftPositions()` (`worldManager.js:619`)
- Config-only write to `worldMetadata.draftPositionsByYear.{year}`
- No event emission (intentional — not a GM transaction)

---

## UI State Architecture

- **Shared state:** `useArchitectState.ts` provides `teamCapSheet`, `worldId`, `currentYear` to all tabs via `GMDashboard.jsx` props
- **Actions:** `useArchitectActions.ts` provides mutation handlers to all tabs
- **Refresh:** Optimistic update + authoritative sync from mutation result (no onSnapshot)
- **Rollback:** `setTeamCapSheet(beforeTeamSnapshot)` on persist failure
- **Truth evaluator:** `evaluateMutationTruth` — `ok = success && appliedToLocalState && persistedToWorld`

---

## Safety Guarantees

| Guarantee | Enforcement | Location |
|-----------|-------------|----------|
| World gating (hard) | `if (!worldId) return failure` | `mutationPipeline.js:1141` |
| World gating (soft) | `if (!worldId) return skipped` | `useArchitectActions.ts:814` |
| Forbidden writes | All paths use `architect_worlds/` helpers | `architectFirestorePaths.ts` |
| Persistence contracts | `assertPersistableOrThrow` with allowlists | `persistenceContracts/contracts.js` |
| Fail-closed | Pipeline + UI both enforce | Lines 1462 + 789 |
| OffseasonTab gating | DEV + localStorage gate | `offseason.devGate.guardrail.test.ts` |

---

## Review History

| Review ID | Date | Scope | Result | Return Package |
|-----------|------|-------|--------|----------------|
| ARCHITECT_CONNECTIVITY_R1_LOCAL | 2026-03-03 | Cross-tab integration (all 5 tabs) | **PASS** (14/14, 5/5 STOP) | `return_packages/architect_reviews/ARCHITECT_CONNECTIVITY_R1_LOCAL_REVIEW_RETURN_PACKAGE.md` |

### Prior Section Reviews (Inputs to This Review)

| Review | Result | Link |
|--------|--------|------|
| TM_R2_LOCAL | 10/11 PASS | `return_packages/architect_reviews/TRADE_MACHINE_R2_LOCAL_REVIEW_RETURN_PACKAGE.md` |
| CAP_SHEET_R1/R2_LOCAL | 12/12 PASS | `return_packages/architect_reviews/CAP_SHEET_R1_LOCAL_REVIEW_RETURN_PACKAGE.md` |
| FA_R1_LOCAL | 12/12 PASS | `return_packages/architect_reviews/FREE_AGENCY_R1_LOCAL_REVIEW_RETURN_PACKAGE.md` |
| TEAM_HISTORY_R2_LOCAL | 9/9 PASS | `return_packages/architect_reviews/TEAM_HISTORY_R2_LOCAL_REVIEW_RETURN_PACKAGE.md` |
| OFFSEASON_R2_LOCAL | 12/12 PASS | `return_packages/architect_reviews/OFFSEASON_R2_LOCAL_REVIEW_RETURN_PACKAGE.md` |
| TM_CAP_INTEGRATION_R1/E1 | 12/12 PASS | `return_packages/architect_reviews/TM_CAP_INTEGRATION_R1_LOCAL_REVIEW_RETURN_PACKAGE.md` |

---

## Related Master Docs

- [TM_CAP_INTEGRATION_MASTER.md](./TM_CAP_INTEGRATION_MASTER.md) — Trade Machine ↔ Cap Sheet integration
- [FA_CAP_HISTORY_INTEGRATION_MASTER.md](./FA_CAP_HISTORY_INTEGRATION_MASTER.md) — Free Agency ↔ Cap Sheet ↔ History integration
- [OFFSEASON_MASTER.md](./OFFSEASON_MASTER.md) — Offseason/Season Advance system
- [TEAM_HISTORY_MASTER.md](./TEAM_HISTORY_MASTER.md) — Team History event system
