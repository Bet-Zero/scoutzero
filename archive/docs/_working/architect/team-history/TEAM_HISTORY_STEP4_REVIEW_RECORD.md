# TEAM HISTORY — STEP 4 REVIEW RECORD

## Scope

Team History — Step 4: Base-Mode Fallback and Synthesized Timeline Truth

**Date:** 2026-04-03  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review the Team History base-mode / no-world fallback path to determine whether non-world timeline truth is structurally clean and honest.

Main questions:

- whether base-mode Team History has one clear fallback truth story
- whether explicit `historyTimeline` and synthesized section-derived timeline interact cleanly
- whether section-derived timeline rows faithfully represent their source arrays
- whether sorting/order behavior is truthful and consistent
- whether base-mode history can diverge misleadingly from world-mode history
- whether the feature clearly distinguishes authoritative world history from local/base convenience history

---

## Executive Verdict

**RISK**

The Team History base-mode / no-world fallback path is understandable and reasonably bounded, but not yet clean enough for PASS.

The strongest clean part:

- base-mode Team History has one clear top-level fallback order inside `TeamHistoryTab.tsx`:
  1. explicit local `historyTimeline`
  2. otherwise synthesized timeline from `waivedContracts`, `exceptionHistory`, and `pickLog`
- the feature shell clearly avoids invoking world-event retrieval in base mode
- explicit local timeline rows cleanly win over synthesized fallback rows
- sorting behavior is consistent across both base-mode paths

The main risk:

- the synthesized fallback path is still convenience history rather than first-class event truth
- it invents timeline rows from multiple subsystem arrays and compresses those records into one generic timeline-row contract
- base-mode history can diverge materially from world-event history in both structure and meaning while still looking like the same kind of timeline
- the UI now distinguishes the active source better than before, but base-mode history is still softer than authoritative world-event history and that difference is not yet as strong as it could be

The fallback story is therefore clear, but the synthesized timeline is still a derived local convenience history rather than a fully grounded history contract.

---

## Base-Mode / Fallback Timeline Map

### 1. Base-mode entry

When Team History is not using world events, `TeamHistoryTab.tsx` resolves the timeline through its top-level source resolver:

- world events only if `worldId` exists and fixtures are not active
- otherwise fallback mode:
  - explicit local timeline if present
  - synthesized fallback if not

### 2. Explicit local timeline path

If `teamCapSheet.historyTimeline` has rows, Team History:

- labels the active source as `Explicit local timeline`
- sorts those rows newest-first
- renders them directly as timeline rows

### 3. Synthesized fallback path

If no explicit `historyTimeline` exists, `normalizeTimelineFromSections(...)` synthesizes rows from:

- `waivedContracts`
- `exceptionHistory`
- `pickLog`

Each source array is projected into a generic timeline row containing:

- `id`
- `category`
- `type`
- `timestamp`
- `teamsInvolved`
- `primaryDeltas`
- `capDelta`
- `summary`

### 4. Shared sorting behavior

Both explicit local timeline rows and synthesized fallback rows are sorted through `sortTimelineNewestFirst(...)`, which uses:

- `timestamp`
- fallback to `occurredAt`
- descending time order

---

## Explicit Timeline vs Synthesized Timeline Analysis

### The fallback order is clear

This is the strongest positive.

The base-mode branch is not ambiguous:

- explicit local timeline wins
- synthesized timeline is the final fallback

The base-mode test coverage directly verifies both:

- base mode does not invoke the world-event query hook
- explicit local timeline rows take priority over synthesized fallback rows

### Explicit timeline and synthesized timeline are not equivalent truth paths

This is the biggest Step 4 issue.

`historyTimeline` is already a timeline-shaped source.

`normalizeTimelineFromSections(...)` is not timeline truth in the same way. It is a derived reconstruction from three separate subsystem collections:

- waived-contract records
- exception-history records
- draft-pick log records

So the feature is honest enough about the active source label, but the two paths are materially different in truth quality.

### Section-derived rows are useful, but simplified

The synthesized rows are clearly convenience summaries.

Examples:

- waived contracts become generic `Waive` / `Waive & Stretch` timeline rows
- exception history becomes generic entitlement activity rows using `entry.type` / `entry.action` / `entry.summary`
- pick log becomes generic draft activity rows using `entry.action` / `entry.notes`

This is useful for readability, but it is still a synthetic projection rather than a true event-history model.

### Base-mode can diverge materially from world-mode

Yes, and this is expected, but still important.

World-mode history now comes from:

- world-event retrieval contract
- normalization contract
- event-family-specific detail/summary logic

Base-mode synthesized history comes from:

- three local arrays
- generic row projection logic
- no equivalent event ids / operation ids / raw payload / before-after totals / normalization-rich detail contract

So the two modes can tell similar-looking but structurally different history stories.

### The UI distinguishes the source, but not yet the truth strength strongly enough

The improved source label helps:

- `Explicit local timeline`
- `Section-derived fallback`

That is good.

But the feature still does not strongly communicate that synthesized fallback is derived local convenience history rather than equivalent authoritative transaction history.

---

## Any Misleading, Duplicate, or Weakly Grounded Fallback Paths

### 1. Synthesized fallback is structurally weaker than it looks

This is the biggest issue.

`normalizeTimelineFromSections(...)` creates plausible timeline rows from subsystem data, but those rows are not first-class event records. They are derived summaries.

That means the base-mode timeline can look more authoritative than it really is.

### 2. Different subsystem arrays are flattened into one generic row contract

Waived contracts, exception history, and pick logs each have distinct domain semantics, but the synthesized path compresses them into the same generic timeline-row shape.

That is useful for timeline readability, but it definitely flattens differences.

### 3. Synthesized rows do not have world-event richness

The synthesized path lacks the richer fields world-mode rows can carry, such as:

- `eventId`
- `operationId`
- raw payload
- before/after totals
- normalization-grounded detail sections

So a user can still see “history rows,” but not all history rows are built on comparable truth.

### 4. Sorting is consistent, but timestamp quality depends on heterogeneous source arrays

The sort helper itself is fine, but synthesized ordering depends on whichever date field happens to exist:

- `waivedOn`
- `timestamp`
- `date`

So ordering is consistent mechanically, but still only as trustworthy as the heterogeneous source-array timestamps.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- base-mode has one clear fallback order
- explicit local timeline cleanly wins over synthesized fallback
- base mode correctly avoids calling world-event retrieval
- sorting behavior is consistent and is partly covered by tests

### Why this is not PASS

- synthesized fallback is convenience history, not first-class event truth
- multiple subsystem arrays are flattened into one generic row contract
- base-mode can diverge materially from world-mode in structure and meaning
- the source label is better than before, but the feature still does not strongly distinguish authoritative history from derived local convenience history

---

## Files Reviewed

- `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx`
- `src/tests/architect/teamHistory.baseMode.noEventsQuery.test.tsx`
- `src/tests/architect/teamHistory.render.sections.test.tsx`

---

## Exact File + Function Anchors

### `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx`

- `normalizeTimelineFromSections(...)`
- `sortTimelineNewestFirst(...)`
- `resolveTeamHistoryTimeline(...)`
- explicit local timeline vs synthesized fallback resolution
- base-mode timeline rendering path

### `src/tests/architect/teamHistory.baseMode.noEventsQuery.test.tsx`

- base-mode no-world behavior
- explicit local timeline precedence
- no world-event query in base mode

### `src/tests/architect/teamHistory.render.sections.test.tsx`

- deterministic section rendering
- newest-first timeline ordering check in fallback-style timeline rendering

---

## Final Conclusion

Team History base-mode fallback is good enough to keep moving, but Step 4 should land as **RISK**.

The main reason is:

**the fallback story is clear, but the synthesized timeline is still a derived convenience history rather than a fully grounded history contract.**
