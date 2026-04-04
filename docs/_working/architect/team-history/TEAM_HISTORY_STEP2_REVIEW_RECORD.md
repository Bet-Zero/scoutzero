# TEAM HISTORY — STEP 2 REVIEW RECORD

## Scope

Team History — Step 2: World Event Loading, Query Compatibility, and Pagination Truth

**Date:** 2026-04-03  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review the Team History world-event loading system to determine whether world-scoped event retrieval is structurally clean, compatible, and trustworthy.

Main questions:

- whether Team History world-event loading has one clear authoritative query path
- whether query compatibility fallbacks are structurally safe and truthful
- whether dedupe / ordering / lastDoc / hasMore behavior are correct
- whether load-more pagination remains tied to the same query contract as the initial load
- whether empty/error/loading states match actual retrieval truth
- whether any stale, duplicate, or schema-drift-prone query paths still exist

---

## Executive Verdict

**RISK**

The Team History world-event loading seam is reasonable but not yet clean enough for PASS.

The strongest clean part:

- `useWorldTeamEvents.ts` is the one real retrieval owner for Team History world-event loading. It owns initial load, compatibility fallback selection, dedupe, pagination state, and error/loading handling.
- `TeamHistoryTab.tsx` consumes this seam through `WorldEventsTimeline` and does not add a second live query path.

The main risk:

- the feature still does not have one explicit authoritative query contract for world events
- instead, the hook relies on runtime compatibility fallback across multiple schema combinations:
  - `teamCodes` vs `teamsAffected`
  - `occurredAt` vs `timestamp`

That is practical and useful for compatibility, but it means the world-event path is still compatibility-driven rather than contract-driven.

The loading seam is therefore workable, but not yet clean enough to call structurally strong.

---

## World-Event Loading / Query Map

### 1. Top-level load entry

In world-event mode, `TeamHistoryTab.tsx` renders `WorldEventsTimeline`, which calls:

- `useWorldTeamEvents({ worldId, teamCode, limit: 50, enabled: Boolean(worldId && teamCode) })`

So the Team History shell is not mixing multiple live query owners.

### 2. Query owner

`useWorldTeamEvents.ts` is the actual retrieval seam.

It owns:

- initial load
- load-more pagination
- loading / error / empty state
- `lastDoc`
- `hasMore`
- selected query config
- dedupe by event id

### 3. Query compatibility chain

The hook defines four query configs:

1. `teamCodes` + `occurredAt`
2. `teamCodes` + `timestamp`
3. `teamsAffected` + `occurredAt`
4. `teamsAffected` + `timestamp`

`fetchWorldTeamEvents(...)` tries them in order unless a preferred config already exists.

### 4. Pagination contract

For `loadMore`, the hook reuses:

- the same `queryConfig`
- the same `worldId`
- the same `teamCode`
- the same `limit`
- `startAfter(lastDoc)`

That keeps pagination tied to the initial winning query contract.

### 5. Display handoff

The hook returns raw event records. `WorldEventsTimeline` normalizes them through `normalizeWorldEventsForTeamHistory(...)` and renders the resulting rows.

---

## Query Compatibility / Dedupe / Pagination Analysis

### One real retrieval owner exists

This is the strongest positive.

There is not a second duplicate live query path somewhere else in Team History. World-event loading truth lives in `useWorldTeamEvents.ts`.

### There is not yet one clean authoritative query contract

This is the main reason for the RISK verdict.

The Team History shell labels world history as authoritative, but the retrieval seam itself still works by trying multiple schema combinations until one succeeds.

The operational truth is therefore:

- try several plausible event schemas in priority order until one works

rather than:

- use one known stable world-event schema contract

That is compatible, but not structurally clean enough for PASS.

### Fallback behavior is practical but under-signaled

If the first query config returns zero rows, the hook silently tries the next config until one succeeds or all fail.

So an empty result can mean:

- no events exist
- the first schema shape had no rows but another might
- none of the known schema variants matched

The hook handles this practically, but the loading seam itself is doing schema repair at runtime.

### Dedupe is useful but still narrow

`dedupeById(...)` filters by event `id` only.

That is acceptable for one selected query contract and for pagination, but it is still a narrow uniqueness guarantee rather than proof of semantic uniqueness across all compatible shapes.

### Pagination stays tied to the selected contract

This part is good.

Once a query config wins, `loadMore` reuses that exact config rather than re-running the whole compatibility search on every page.

### `hasMore` is still heuristic

`hasMore` is derived from `docs.length >= queryLimit`.

That is a common acceptable pattern, but still heuristic rather than an explicit stronger paging contract.

### Loading / error / empty states mostly match retrieval truth

Inside `WorldEventsTimeline`:

- loading with no rows -> loading message
- hook error -> explicit error message
- zero normalized rows -> explicit empty message
- otherwise render rows and optional load-more button

That part is clear enough.

---

## Any Misleading, Duplicate, or Weakly Enforced Loading Paths

### 1. Compatibility fallback is doing schema repair at runtime

This is the biggest Step 2 issue.

The hook is compensating for schema drift at query time:

- two team fields
- two order fields

That means the loading seam is not operating on one stable event contract.

### 2. Empty-state truth depends on fallback exhaustion

Because the hook silently iterates through multiple configs, an empty state does not only represent “the world has no events.” It can also represent “none of the supported schema variants yielded rows.”

That is not necessarily user-facing deception, but it is a softer contract than ideal.

### 3. The feature surface does not reveal which query contract won

The Team History shell can truthfully say the active source is `Authoritative world events`, but it does not surface which compatibility path actually succeeded.

That is fine for UX, but from a review standpoint it means the authoritative label is broader than the real retrieval mechanics.

### 4. The reviewed evidence does not yet show strong direct guardrails for the compatibility matrix itself

There is integration evidence around Team History world-boundary behavior, but the reviewed Step 2 evidence does not yet show equally strong direct guardrail coverage for the internal query compatibility matrix itself.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- there is one real retrieval owner: `useWorldTeamEvents.ts`
- pagination reuses the same selected query contract instead of drifting per page
- loading / error / empty states are straightforward in the consuming UI
- higher-level Team History world-boundary integration behavior exists and is at least partly exercised

### Why this is not PASS

- the authoritative world-event path still depends on runtime schema-compatibility fallback
- query truth is still “first matching config wins,” not one explicit stable contract
- dedupe and empty-state behavior are acceptable but still sit on top of that softer compatibility layer
- the reviewed evidence does not yet show enough direct guardrail strength around the compatibility matrix itself

---

## Files Reviewed

- `src/features/architect/history/hooks/useWorldTeamEvents.ts`
- `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx`
- `src/tests/architect/teamHistory.worldBoundary.integration.test.tsx`

---

## Exact File + Function Anchors

### `src/features/architect/history/hooks/useWorldTeamEvents.ts`

- `useWorldTeamEvents(...)`
- `fetchWorldTeamEvents(...)`
- `runQueryAttempt(...)`
- `toQuery(...)`
- `dedupeById(...)`
- `QUERY_CONFIGS`
- `loadMore` callback

### `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx`

- `WorldEventsTimeline`
- `useWorldTeamEvents(...)` call
- loading / error / empty rendering
- load-more button wiring

### `src/tests/architect/teamHistory.worldBoundary.integration.test.tsx`

- world boundary integration checks
- fixture override suppressing world events
- world switch behavior across the Team History shell

---

## Final Conclusion

Team History world-event retrieval is good enough to keep moving, but Step 2 should land as **RISK**.

The main reason is simple:

**the loading seam is still compatibility-driven rather than contract-driven.**
