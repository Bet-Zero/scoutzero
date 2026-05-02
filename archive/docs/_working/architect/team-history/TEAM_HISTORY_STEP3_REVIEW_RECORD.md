# TEAM HISTORY — STEP 3 REVIEW RECORD

## Scope

Team History — Step 3: World Event Normalization and Display-Contract Truth

**Date:** 2026-04-03  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review the Team History world-event normalization layer to determine whether raw world events are translated into faithful Team History display rows.

Main questions:

- whether normalization has one coherent display-contract story
- whether mutation-type mapping and category inference are truthful
- whether summary generation reflects raw event truth rather than over-interpreting it
- whether cap delta and before/after totals interpretation are structurally correct
- whether detail sections faithfully represent event truth
- whether any normalization fallback can silently mislabel or flatten important event differences

---

## Executive Verdict

**RISK**

The Team History normalization layer is substantial and useful, but not yet clean enough for PASS.

The strongest clean part:

- `normalizeWorldEventsForTeamHistory.ts` is one real display-contract owner. It consistently produces one `TeamHistoryWorldEventRow` shape containing category, type, timestamps, team/player ids, cap delta, summary, detail sections, ids, before/after totals, and raw payload.
- the normalization seam is not scattered between the Team History shell, detail modal, and query hook; raw events come in and one normalized row contract comes out.

The main risk:

- this layer is doing significant interpretation rather than merely formatting
- category assignment is partly heuristic (`inferCategory(...)` uses substring matching)
- summary generation can manufacture confident display phrasing when raw metadata is thin
- cap delta interpretation is structurally narrow and primary-team-centric
- default / unknown mutation handling can flatten important event differences into generic player/team/cap sections

The display contract is therefore coherent, but still more interpretive than fully grounded.

---

## World-Event Normalization / Display-Contract Map

### 1. One owned display shape

`normalizeWorldEventsForTeamHistory.ts` defines a clear output contract in `TeamHistoryWorldEventRow`, including:

- `id`
- `category`
- `type`
- `timestamp`
- `occurredAt`
- `teamCodes`
- `teamsInvolved`
- `playerIds`
- `primaryDeltas`
- `capDelta`
- `summary`
- `detailSections`
- `eventId`
- `operationId`
- `mutationType`
- `beforeTotalsByTeam`
- `afterTotalsByTeam`
- `raw`

This is a real normalization seam, not scattered presentation logic.

### 2. Main entry points

The core conversion path is:

- `toTeamHistoryEventDisplay(...)` for one raw event
- `normalizeWorldEventsForTeamHistory(...)` for an array, plus newest-first sorting

### 3. Main interpretation helpers

The seam relies on several helper layers:

- `inferCategory(...)`
- `formatMutationLabel(...)`
- `normalizeMutationType(...)`
- `buildSummary(...)`
- `readCapDelta(...)`
- `pushSection(...)`
- `toIsoString(...)`
- `formatTeamLabel(...)`
- `formatPlayerLabel(...)`

So the feature is not merely presenting raw event truth. It is building a Team History-specific narrative contract.

---

## Summary / Label / Cap-Delta / Detail-Section Analysis

### The display-contract story is coherent

This is the strongest positive.

Even though the seam is interpretive, it is at least one unified interpretation layer. It is not split across the tab, modal, and hook.

### Mutation-type mapping is mostly grounded, but partly heuristic

`formatMutationLabel(...)` contains an explicit label map for many known mutation families, including:

- `executeTrade`
- `signFreeAgent`
- `signAndTrade`
- `waivePlayer`
- `extendPlayer`
- `renounceRights`
- `optionDecision`
- offer-sheet variants
- exception / TPE variants

That part is strong.

However, `inferCategory(...)` is heuristic. It classifies categories based on substring checks such as:

- any `trade` substring -> `trade`
- `waive` or `buyout` -> `cap-transaction`
- `exception` / `mle` / `tpe` -> `entitlements`
- `pick` / `draft` -> `draft`
- `sign` / `offer` / `renounce` -> `free-agency`

That is workable, but softer than a true explicit category contract.

### Summary generation is helpful, but definitely interpretive

The seam prefers:

1. `mutationMetadata.summary`
2. `metadata.summary`
3. generated fallback summaries from `buildSummary(...)`

That ordering is reasonable.

The risk is that generated summaries can sound more definitive than the underlying raw metadata warrants, for example:

- `Trade Executed vs ...`
- `Signed FA: ...`
- `Waived: ...`
- `Buyout: ...`

That is useful for readability, but still interpretive rather than direct raw-event truth.

### Cap delta logic is structurally narrow

`readCapDelta(...)` chooses:

- the active team if present in the event team list
- otherwise the first team in the event team list
- then computes delta from `beforeTotalsByTeam[team].totalCapAllocations` to `afterTotalsByTeam[team].totalCapAllocations`

That is consistent, but narrow:

- it assumes one chosen team perspective
- it assumes `totalCapAllocations` is the right display delta field
- it does not represent multi-team cap perspectives beyond that one selected team

### Detail sections are rich, but some branches compress too much

The seam builds sections such as:

- `Players`
- `Picks`
- `Teams`
- `Contract`
- `Exceptions`
- `Cap Delta`

That is strong in usefulness.

The risk is that different mutation families are compressed into a shared section vocabulary, and some fallbacks are generic:

- `Exceptions updated`
- `Dead cap updated`
- default generic player/team/cap sections for unknown cases

So the detail view can still be informative while not fully preserving all raw distinctions.

### Existing integration coverage proves intended behavior, but not perfect grounding

`teamHistory.displayFromEnrichedEvents.integration.test.tsx` verifies transaction-log quality rows and detail rendering for:

- trade
- free agent signing
- waive
- extension
- `setExceptions`

It also verifies drill-down outputs like:

- players
- picks
- contract years / salary
- exception usage
- stretch/dead-cap details
- raw payload presence

That is strong evidence that the seam is intentional and useful. It does not remove the underlying interpretive risk.

---

## Any Misleading, Over-Interpreted, or Weakly Grounded Normalization Paths

### 1. Category inference is still heuristic rather than explicit

This is the biggest structural issue.

`inferCategory(...)` relies on substring matching of mutation type text instead of one explicit category mapping contract.

### 2. Summary generation can flatten missing metadata into confident phrasing

When metadata summaries are absent, `buildSummary(...)` manufactures human-facing summaries that sound definitive even when the raw payload is relatively thin.

### 3. The sign / offer-sheet family is partially collapsed

The seam groups together:

- `signFreeAgent`
- `signAndTrade`
- `finalizeMatchedOfferSheet`
- `finalizeDeclinedOfferSheet`

This is not automatically wrong, but several distinct flows share one common summary/detail shape, which can flatten meaningful differences unless the raw payload is inspected.

### 4. Cap delta is one-team-centric

`readCapDelta(...)` deliberately chooses one primary team and one number. That is useful for Team History as a team-centric feature, but it is still a partial interpretation rather than complete event truth.

### 5. Unknown/default mutation handling is generic

The default branch only pushes:

- player labels
- team line
- cap delta line

So new or uncommon mutation types can still render acceptably while losing important event-specific detail.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- there is one real normalization owner
- the output contract is explicit and consistent
- enriched integration coverage shows the seam is grounded enough to produce useful and fairly rich Team History rows/details for several important mutation families

### Why this is not PASS

- category inference is heuristic
- summaries are partly synthetic and can sound more authoritative than the underlying metadata warrants
- cap delta interpretation is narrower than full event truth
- default / unknown mutation handling can flatten important differences
- the seam is coherent, but still somewhat over-interpreted

---

## Files Reviewed

- `src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts`
- `src/tests/architect/teamHistory.displayFromEnrichedEvents.integration.test.tsx`

---

## Exact File + Function Anchors

### `src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts`

- `TeamHistoryWorldEventRow`
- `toTeamHistoryEventDisplay(...)`
- `normalizeWorldEventsForTeamHistory(...)`
- `inferCategory(...)`
- `formatMutationLabel(...)`
- `normalizeMutationType(...)`
- `buildSummary(...)`
- `readCapDelta(...)`
- `pushSection(...)`
- `toIsoString(...)`

### `src/tests/architect/teamHistory.displayFromEnrichedEvents.integration.test.tsx`

- enriched event rendering expectations
- transaction-log quality row/detail expectations
- modal drill-down assertions across multiple mutation families

---

## Final Conclusion

Team History normalization is good enough to keep moving, but Step 3 should land as **RISK**.

The main reason is:

**the display contract is coherent, but still more interpretive than fully grounded.**
