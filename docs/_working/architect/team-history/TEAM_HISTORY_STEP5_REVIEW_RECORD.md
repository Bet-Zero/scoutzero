# TEAM HISTORY — STEP 5 REVIEW RECORD

## Scope

Team History — Step 5: Detail Modal Truth and Drill-Down Integrity

**Date:** 2026-04-04  
**Source:** Direct live-code inspection

---

## Purpose of this Step

Review the Team History detail modal system to determine whether drill-down detail truth is faithful to the selected history entry and underlying event data.

Main questions:

- whether the modal tells one coherent detail story for the selected entry
- whether normalized display fields and raw payload fields stay aligned
- whether mutation/event/operation IDs are surfaced truthfully
- whether before/after totals and cap delta are represented consistently
- whether raw payload rendering can expose mismatches with the normalized row
- whether the click -> selected entry -> modal detail path is structurally trustworthy

---

## Executive Verdict

**RISK**

The Team History detail modal is useful and structurally understandable, but not yet clean enough for PASS.

The strongest clean part:

- the click path is simple and real
- `TeamHistoryTab.tsx` owns one `selectedEntry` state
- both world-event rows and base-mode rows set that same `selectedEntry`
- `HistoryDetailModal.tsx` receives exactly that selected entry and renders directly from it
- closing the modal clears that one owned state seam

The main risk:

- the modal is still a mixed truth surface
- some fields come from normalized entry fields
- some fields fall back to raw payload fields
- some identifiers are coalesced through multiple fallback chains
- before/after totals are exposed as raw JSON blobs rather than strongly reconciled detail output
- conceptually similar fields such as `Teams Involved` and `Team Codes` are shown from different source chains

The drill-down path is therefore structurally clean, but the modal still mixes normalized truth and raw fallback truth too softly.

---

## Detail Modal / Drill-Down Map

### 1. Click path

`TeamHistoryTab.tsx` owns:

- `selectedEntry` state

Both row families feed that state:

- world-event rows call `onSelectEntry(entry)` which sets `selectedEntry`
- base-mode rows call `setSelectedEntry(entry)` directly

The modal is rendered once at the bottom of the tab through:

- `<HistoryDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />`

This is a clean drill-down ownership seam with no duplicate modal owner and no modal-time re-fetch path.

### 2. Modal input contract

`HistoryDetailModal.tsx` takes one `entry` and renders directly from it.

It pulls:

- normalized fields from `entry`
- raw event data from `entry.raw`
- fallback identifiers / types / totals by checking both places

### 3. Modal content groups

The modal shows:

- summary
- category / type
- timestamp
- raw event type
- mutation type
- teams involved
- team codes
- player ids
- cap delta
- primary deltas
- mutation/event ID
- operation ID
- event ID
- detail sections
- before totals JSON
- after totals JSON
- raw event payload JSON

So the modal is clearly intended to be both:

- a readable drill-down surface
- and a raw-truth inspection surface

---

## Normalized-vs-Raw / Totals / ID Integrity Analysis

### The modal tells one mostly coherent detail story

This is the strongest positive.

The modal is always rendering one selected row. It keeps the raw payload visible alongside the interpreted fields, which is good for transparency and debugging.

### Normalized and raw fields are blended, not strongly separated

This is the main source of Step 5 risk.

Examples:

- `rawEventType` comes from `entry.mutationType || rawEntry?.mutationType`
- `rawType` comes from `rawEntry?.type || entry.type`
- `teamCodes` comes from `entry.teamCodes || entry.teamsInvolved || rawEntry?.teamCodes || rawEntry?.teamsAffected`
- `playerIds` comes from `entry.playerIds || rawEntry?.playerIds`
- `beforeTotalsByTeam` and `afterTotalsByTeam` come from either normalized entry fields or raw payload fields

This makes the modal resilient, but it also means the user is not always seeing one sharply defined truth source for each field.

### ID handling is functional, but soft

The modal derives:

- `mutationId` from `entry.mutationId`, then `entry.eventId`, then `entry.id`, then `entry.operationId`
- `operationId` from `entry.operationId || rawEntry?.operationId`
- `eventId` from `rawEntry?.eventId || entry.eventId || entry.id`

That is practical, but not especially strict. It means the modal can show plausible identifiers even when the selected row did not actually carry one strongly owned canonical identity field.

### Before/after totals and cap delta are exposed together, but not strongly reconciled

The modal shows:

- a human-formatted `Cap Delta`
- raw JSON blobs for `Before Totals By Team`
- raw JSON blobs for `After Totals By Team`

That is transparent, but it does not explicitly prove inside the modal that the displayed cap delta and the raw totals are reconciled to one another.

### Raw payload can expose mismatches, but the modal does not actively police them

This is a mixed result.

Good:

- if the normalized row is wrong, the raw payload is visible right there
- that makes debugging and review easier

Risk:

- the modal does not actively call out mismatches
- it simply exposes both surfaces and leaves comparison up to the reader

---

## Any Misleading, Duplicated, or Weakly Tied Drill-Down Paths

### 1. Modal fields use multiple fallback chains instead of one strict source contract

This is the biggest issue.

Many modal fields effectively say:

- use normalized field if present
- otherwise use raw field
- otherwise use another fallback

That is helpful for resilience, but weaker for truth clarity.

### 2. `Teams Involved` vs `Team Codes` are related but separately sourced

The modal shows both:

- `Teams Involved`
- `Team Codes`

But they do not come from exactly the same source chain:

- `Teams Involved` uses `entry.teamsInvolved`
- `Team Codes` uses a broader fallback chain including raw payload arrays

So the modal can show two nearby team fields that are conceptually similar but sourced differently.

### 3. IDs are surfaced truthfully enough, but with soft coalescing

There is no obvious lie here, but the modal is not strict about canonical identity ownership. It is more of a recovery surface than a sharply defined identity contract.

### 4. Totals are exposed raw, not interpreted

This is honest, but still weak as a user-facing detail contract. The modal trusts the user to reconcile:

- cap delta
- before totals
- after totals

That is better than hiding them, but not as strong as a fully tied drill-down contract.

### 5. The click path itself is trustworthy

This part is clean.

There is no duplicated modal state and no second drill-down owner. The selected row is the selected row, and the modal renders directly from it.

### 6. Existing integration coverage proves meaningful drill-down behavior

The Team History integration coverage already verifies that clicking rows exposes relevant modal content for multiple mutation families and includes raw payload presence.

That is real evidence that the drill-down path is not accidental.

---

## PASS / RISK / FAIL

### Result: RISK

### Why this is not FAIL

- one clean selected-entry seam exists
- the modal renders the clicked entry rather than re-querying or reconstructing elsewhere
- raw payload is exposed directly
- existing integration coverage proves the modal shows meaningful family-specific detail for several important cases

### Why this is not PASS

- the modal blends normalized and raw fields through soft fallback chains
- identity fields are coalesced rather than strictly owned
- cap delta and before/after totals are shown together but not strongly reconciled
- conceptually similar fields like `Team Codes` / `Teams Involved` can come from different sources
- the modal is transparent, but not yet fully strict as a detail-truth contract

---

## Files Reviewed

- `src/features/architect/history/TeamHistoryTab/HistoryDetailModal.tsx`
- `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx`
- `src/tests/architect/teamHistory.displayFromEnrichedEvents.integration.test.tsx`

---

## Exact File + Function Anchors

### `src/features/architect/history/TeamHistoryTab/HistoryDetailModal.tsx`

- `HistoryDetailModal`
- `formatNumberDelta`
- `formatTeams`
- `formatList`
- `getDisplayText`
- `stringifySafe`
- modal field fallback/coalescing logic for ids, types, teams, players, totals, and raw payload

### `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx`

- `selectedEntry` state
- row click -> `setSelectedEntry(entry)`
- modal handoff through `<HistoryDetailModal entry={selectedEntry} ... />`

### `src/tests/architect/teamHistory.displayFromEnrichedEvents.integration.test.tsx`

- modal drill-down assertions across multiple mutation families
- raw payload presence in modal
- row click -> detail content expectations

---

## Final Conclusion

Team History detail-modal truth is good enough to keep moving, but Step 5 should land as **RISK**.

The main reason is:

**the drill-down path is structurally clean, but the modal still mixes normalized truth and raw fallback truth too softly.**
