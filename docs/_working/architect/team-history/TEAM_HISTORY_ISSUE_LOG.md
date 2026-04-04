# TEAM HISTORY — ISSUE LOG

Problem-level issues surfaced during the Team History review. Each issue describes an underlying system problem, not an action task title.

---

## STEP 1 — Top-Level Ownership, Composition, and Source-Selection Truth

---

### TH-1-1 — The top-level Team History UI under-describes which history source is actually active

**Status:** RESOLVED  
**Substep:** TH-1A

**Problem:**

`TeamHistoryTab` can render from four materially different truth paths — world-event timeline, explicit local `historyTimeline`, section-derived synthesized timeline, and DEV fixture-injected history — but the UI only communicates a coarse "World mode" vs "Base mode" banner. The banner does not indicate whether the user is viewing authoritative world-event history, a local fallback timeline, or synthetic fixture data. This means the user-facing source signal is weaker than the actual source-selection logic, making the feature appear more authoritative than it may be.

**Resolution:**

`TeamHistoryTab` now resolves and surfaces one explicit active timeline source at the top-level banner: `Authoritative world events`, `DEV fixture override`, `Explicit local timeline`, or `Section-derived fallback`. The top-level Team History shell now tells the user which truth path is active instead of only reporting coarse world/base scope.

---

### TH-1-2 — World / base / fixture source-selection at the top level reads as incidental branching rather than an explicit contract

**Status:** RESOLVED  
**Substep:** TH-1B

**Problem:**

The top-level source-selection chain (`worldId + no fixtures → world events; else historyTimeline; else synthesize`) is functional but is not expressed as an intentional, structurally owned contract. The fixture injection path is particularly significant: it suppresses the world-event timeline entirely even when `worldId` is present, but this behavior is not surfaced as a first-class ownership decision. The four truth paths feel loosely stacked rather than explicitly ordered, which increases the risk of drift as the feature evolves.

**Resolution:**

`TeamHistoryTab` now routes source ownership through one explicit resolver contract with a named priority order:

1. DEV fixture override owns the timeline while active.
2. Otherwise, an active world owns the timeline through authoritative world events.
3. Outside world-event mode, explicit local `historyTimeline` rows take priority.
4. Section-derived synthesis is the final fallback.

The fixture override path also now fail-closes from the actual team data, so injected fixture markers still suppress the world-event path even if an upstream boolean is missing or stale.

---

### TH-1-3 — Top-level source-selection behavior has no focused guardrails and can drift silently

**Status:** RESOLVED  
**Substep:** TH-1C

**Problem:**

Nothing in the current test surface pins the intended Team History shell behavior — specifically, the priority ordering of world-event vs local-timeline vs synthesized vs fixture paths, and the rule that fixture injection suppresses the world path even when `worldId` exists. Without guardrails, future contributors can weaken source-selection clarity, change fallback ordering, or expand the fixture override scope without any test failing. The risk is compounded by the fact that Team History composes multiple sub-surfaces (`WaiveStretchTracker`, `ExceptionHistoryTracker`, `DraftPickTracker`), so top-level shell drift affects the integrity of all of those composed views.

**Resolution:**

This execution added a dedicated top-level source-selection guardrail matrix that now protects the intended shell contract directly:

1. fixture override wins when active
2. otherwise world-event mode wins when `worldId` exists
3. otherwise explicit local `historyTimeline` wins
4. otherwise synthesized fallback is used

The new guardrails also pin banner/path alignment and fixture-marker override safety, including the fail-closed rule that actual fixture markers in team data still suppress world-event mode even when an upstream boolean is false or stale.

---

## STEP 2 — World Event Loading, Query Compatibility, and Pagination Truth

---

### TH-2-1 — The world-event query seam is compatibility-driven rather than contract-driven

**Status:** RESOLVED  
**Substep:** TH-2A

**Problem:**

`useWorldTeamEvents.ts` owns world-event retrieval for Team History but does not operate on one explicit authoritative query contract. Instead, it tries four schema combinations at runtime — `teamCodes` vs `teamsAffected` crossed with `occurredAt` vs `timestamp` — until one returns results. This means the loading seam is performing schema repair at runtime rather than executing a known stable world-event contract. The "authoritative world events" label applied by the Team History shell is therefore stronger than the actual retrieval mechanics. Schema drift can propagate silently because the compatibility fallback loop absorbs it rather than surfacing it.

**Resolution:**

Team History world-event retrieval now owns one explicit two-step contract:

1. authoritative Team History query: `teamCodes` + `occurredAt`
2. bounded legacy compatibility query: `teamsAffected` + `timestamp`

The mixed-field runtime guess matrix was removed. Initial retrieval now tries the canonical contract first and only falls back to the one named legacy contract when canonical retrieval returns zero rows. Query errors no longer silently fan out across alternate shapes, so the seam behaves like a contract owner instead of a schema-repair loop.

---

### TH-2-2 — Retrieval truth around compatibility fallback, dedupe, empty-state, and pagination is softer than the feature's authoritative claim warrants

**Status:** RESOLVED  
**Substep:** TH-2B

**Problem:**

Several retrieval behaviors in the world-event loading seam combine to produce a contract that is workable but structurally softer than expected for an authoritative history mode. Empty-state results are ambiguous — compatibility exhaustion and true event absence produce identical output. Dedupe is id-only rather than semantically grounded. `hasMore` is heuristic (`docs.length >= limit`) rather than explicit. Load-more pagination correctly reuses the initially selected query config, but there is no structural enforcement preventing that config from drifting subtly as the hook evolves. Together these behaviors mean retrieval truth is a reasonable approximation rather than a durable contract.

**Resolution:**

The Team History retrieval seam now treats compatibility, dedupe, empty-state, and pagination as one explicit model:

1. pagination reuses the initially selected query contract only
2. page reads overfetch by one row, so `hasMore` is now exact for the active contract rather than `docs.length >= limit`
3. event pages merge through one helper that dedupes on stable event id and reorders newest-first intentionally
4. the world-event empty state now says the feed found no matches for the team under the supported world-event feed instead of implying a softer "yet" state
5. pagination errors no longer blank already-loaded rows; the inline error keeps the existing history visible while reporting the failure

This leaves the Team History world-event seam materially more durable without turning Step 2 into a broader event-model rewrite.

---

### TH-2-3 — The world-event compatibility matrix and pagination contract have no focused guardrails

**Status:** RESOLVED
**Substep:** TH-2C

**Problem:**

The internal complexity of `useWorldTeamEvents.ts` — query priority order, compatibility fallback chain, pagination reuse of the selected config, empty/error state semantics — is not pinned by focused tests targeting these behaviors directly. Higher-level integration tests exercise world-boundary behavior at the shell level but do not guard the compatibility matrix itself. This means the intended query priority order can change silently, a compatibility path can stop working without a targeted failure, and load-more can drift away from the initial winning contract without any test catching it.

**Resolution:**

TH-2C added focused guardrails at the seam where retrieval truth actually lives:

1. direct query-contract tests now protect canonical-first retrieval, legacy fallback ordering, and the rule that canonical errors do not silently fall through
2. new hook-level guardrails now protect load-more reuse of the winning contract, exact `hasMore` overfetch behavior, retained-row `lastDoc` ownership, and merged-page dedupe/newest-first ordering
3. Team History UI guardrails now protect the legacy compatibility note boundary and the retrieval-truth semantics that depend on hook resolution state

This leaves the Team History Step 2 compatibility matrix and pagination contract pinned directly enough to fail loudly if the intended retrieval model drifts.

---

## STEP 3 — World Event Normalization and Display-Contract Truth

---

### TH-3-1 — Normalization category / type / summary output is too interpretive rather than explicitly grounded

**Status:** RESOLVED
**Substep:** TH-3A

**Problem:**

The Team History normalization seam has one coherent display-contract owner (`normalizeWorldEventsForTeamHistory.ts`), but it operates through significant inference rather than explicit grounding. Category assignment is performed by `inferCategory(...)` using substring matching against raw mutation type text — any mutation type containing `trade` becomes a trade, any containing `waive` or `buyout` becomes a cap-transaction, and so on. Summary generation prefers the raw `mutationMetadata.summary` when present but falls back to `buildSummary(...)`, which manufactures confident human-facing phrasing from thin metadata. Several mutation families that are meaningfully distinct — signing, sign-and-trade, finalized offer sheet variants — share a common summary/detail shape that can flatten important differences. The result is a display contract that is coherent but still more interpretive than fully grounded: rows communicate confident event labels that are partly manufactured rather than directly reflecting raw world-event truth.

**Resolution:**

TH-3A replaced heuristic category inference with one explicit Team History display map keyed by canonical mutation type. The normalization seam now resolves category/type through owned source-level mappings instead of substring guessing, while still honoring an explicitly supplied raw category when present. Summary fallback logic was tightened so generic source summaries no longer block more grounded row summaries, and family-specific fallback summaries now anchor themselves only to concrete team/player/change metadata that is actually present. The sign, sign-and-trade, offer-sheet, waiver, contract, entitlement, and dead-cap families now produce distinct row-level summary/detail output instead of collapsing through one shared fallback story.

---

### TH-3-2 — Cap-delta and detail-section interpretation compresses or flattens meaningful event truth

**Status:** RESOLVED
**Substep:** TH-3B

**Problem:**

The normalization seam computes one primary-team-centric cap delta and routes most mutation families through a shared section vocabulary (`Players`, `Picks`, `Teams`, `Contract`, `Exceptions`, `Cap Delta`). The cap delta path uses `readCapDelta(...)`, which selects one team perspective and one aggregated field (`totalCapAllocations`), making it intentionally narrow. Several distinct mutation families are compressed into identical or near-identical section structures at display time. Generic fallback lines — `Exceptions updated`, `Dead cap updated` — are informative but lose the structural distinctions between different event types. For unknown or new mutation types, the default branch only emits player labels, a team line, and a cap delta line, making new events look acceptably rendered even when important event-specific information has been silently dropped. The effect is that Team History detail rows can look richer than the normalization seam actually is.

**Resolution:**

TH-3B tightened cap-delta and detail-section interpretation around one explicit team-history view model. Cap allocation deltas are now derived active-team-first and rendered as explicit `Cap Allocation` detail lines backed by the same `totalCapAllocations` before/after totals used for the modal’s numeric `capDelta`, so the one-team Team History perspective is intentional rather than implicit. Detail sections are now mutation-family-specific (`Signing Context`, `Trade Context`, `Offer Sheet`, `Waiver`, `Extension`, `Option`, `Rights`, `Exception Changes`, `Dead Cap Changes`) instead of routing most mutations through the same generic section bundle. Generic placeholder change lines are replaced with explicit “no detail was included” copy, and unknown/default mutations now surface an `Event Detail` note that says the event has no Team History-specific mapping instead of silently flattening into a plausible-looking generic row.

---

### TH-3-3 — No focused guardrails exist for Team History normalization / display-contract behavior

**Status:** RESOLVED
**Substep:** TH-3C

**Problem:**

The normalization seam is covered by integration tests that verify acceptable transaction-log rendering for known mutation families, but nothing pins the intended rules of the display contract itself. Category inference rules can change silently without failing any targeted test. Summary fallback behavior can become more aggressive without detection. Cap-delta logic can drift toward different fields or team-selection strategies while still producing plausible-looking rows. Mutation-family section output can flatten more meaningful distinctions over time without causing obvious UI breakage. Because the integration test surface validates output shape rather than display-contract rules, the normalization seam can regress in faithfulness without any failure, which undermines the durability of the Team History history view as later detail-modal and closeout work builds further on top of it.

**Resolution:**

TH-3C added a direct normalization guardrail suite at the owned seam instead of relying only on UI-level integration checks. The new guardrails now protect:

1. explicit mutation-display map ownership in `normalizeWorldEventsForTeamHistory.ts`, including key mapped mutation families and the absence of the old heuristic `inferCategory(...)` path
2. category/type/summary output for key mutation families through direct `toTeamHistoryEventDisplay(...)` assertions
3. the rule that generic source summaries do not suppress more grounded summaries when concrete player/team anchors are present, while materially specific source summaries are preserved
4. active-team-first `capDelta` interpretation and `Cap Allocation` detail-line ordering/content
5. family-specific section titles for trade, signing, sign-and-trade, offer-sheet, waiver, exception, and dead-cap paths
6. explicit fallback notes for generic “no detail included” cases, sparse fail-soft rows, and unknown/default mutation types

Existing display integration/fail-soft tests were then re-run to confirm the directly-guarded normalization contract still renders correctly through the Team History UI. This now leaves the Step 3 normalization/display-contract seam pinned directly enough to fail loudly if the intended model drifts.

---

---

## STEP 4 — Base-Mode Fallback and Synthesized Timeline Truth

---

### TH-4-1 — Base-mode source truth is too soft: the system does not clearly distinguish explicit local timeline rows from derived fallback history

**Status:** RESOLVED
**Substep:** TH-4A

**Problem:**

Team History base mode now has source labels — `Explicit local timeline` and `Section-derived fallback` — but the truth strength difference between these two paths is still not communicated strongly enough. `historyTimeline` is already a timeline-shaped source; `normalizeTimelineFromSections(...)` is a derived reconstruction from three separate subsystem arrays (`waivedContracts`, `exceptionHistory`, `pickLog`). These are materially different in truth quality, but the feature still does not clearly communicate that synthesized fallback is derived local convenience history rather than equivalent authoritative transaction history. The synthesized fallback can look more authoritative than it really is because it produces the same general timeline-row shape with the same visual treatment, and the source label alone is not strong enough to surface that difference.

**Resolution:**

`TeamHistoryTab.tsx` now reinforces the base-mode seam in two places instead of relying on the banner label alone:

1. the top banner now states that direct `historyTimeline` rows beat any section-derived local fallback, and that synthesized fallback is only being derived because no explicit local timeline exists
2. the timeline section itself now renders a compact truth note for base-mode rows:
   - `Direct local timeline rows` for explicit `historyTimeline`
   - `Derived local convenience history` for section-derived fallback

This keeps the existing source-order contract intact while making synthesized fallback feel like a lighter derived local history path rather than equivalent first-class transaction truth.

---

### TH-4-2 — Synthesized timeline projection flattens the meaning of source arrays and loses honest source information

**Status:** RESOLVED
**Substep:** TH-4B

**Problem:**

`normalizeTimelineFromSections(...)` projects three subsystem arrays with materially distinct semantics into one generic timeline-row shape. Waived contracts become generic `Waive` / `Waive & Stretch` rows. Exception history becomes generic entitlement activity rows keyed off `entry.type` / `entry.action` / `entry.summary`. Pick log becomes generic draft activity rows keyed off `entry.action` / `entry.notes`. The projection also depends on heterogeneous timestamp fields (`waivedOn`, `timestamp`, `date`) depending on which source array a row came from, so ordering is mechanically consistent but only as trustworthy as those mixed source fields. Synthesized rows also lack the richer fields world-mode rows carry — no `eventId`, `operationId`, raw payload, or before/after totals — which means base-mode fallback rows and world-event rows look structurally similar in the timeline but are built on very different levels of source truth.

**Resolution:**

The synthesized fallback projection in `TeamHistoryTab.tsx` now builds source-aware timeline rows instead of one generic flattening pass:

1. `waivedContracts[]` rows now render as explicit waiver-record entries with dead-cap breakdown text, a source-truth detail section, and `sectionDerived:waivedContracts` metadata
2. `exceptionHistory[]` rows now preserve exception-specific action meaning (`Trade Exception Created / Consumed / Expired` where recognized), amount deltas, expiry detail, source/counterparty context, and `sectionDerived:exceptionHistory` metadata
3. `pickLog[]` rows now render as pick-log-specific entries with action-aware type labels, pick/partner detail, and `sectionDerived:pickLog` metadata
4. each synthesized row now carries explicit raw derived-source metadata (`sourceCollection`, chosen timestamp field, original source entry) so the detail modal exposes that the row is section-derived rather than a world-event payload
5. timestamp resolution is now source-aware (`waivedOn`, then `timestamp` / `date` as appropriate), and sorting fail-softs invalid or missing timestamps to the bottom instead of implicitly pretending they are epoch-like records

This keeps the fallback lightweight, but the rows now read as intentional local records instead of generic first-class event rows.

---

### TH-4-3 — No focused guardrails exist around base-mode fallback ordering or synthesized timeline truth

**Status:** RESOLVED
**Substep:** TH-4C

**Problem:**

Existing tests in `teamHistory.baseMode.noEventsQuery.test.tsx` and `teamHistory.render.sections.test.tsx` cover some base-mode behavior, but they do not pin the specific concerns Step 4 surfaces. None of the following are guarded by focused tests: the rule that explicit local `historyTimeline` rows take precedence over synthesized fallback; the rule that base mode does not invoke the world-event query hook when there is no `worldId`; the ordering behavior of synthesized rows under heterogeneous timestamp fields; or the source-specific meaning that the synthesized projection preserves (or loses) for each of the three source arrays. This means explicit local timeline precedence can change silently, the no-world/no-query path can regress, timeline sorting can drift as timestamp fields evolve, and synthesized rows can become more misleading over time — all without any test failing loudly.

**Resolution:**

TH-4C added a dedicated Step 4 fallback-contract guardrail suite and then re-ran the existing focused base-mode/source-selection tests against the live TH-4A / TH-4B seam. The guardrails now directly protect:

1. fixture override and world-event ownership staying ahead of the base-mode fallback branch
2. explicit local `historyTimeline` rows staying authoritative over synthesized fallback in no-world base mode
3. no-world base mode continuing to avoid the world-event query hook
4. synthesized-row newest-first ordering under source-aware timestamp selection, including the rule that preferred source fields win over lower-priority date fields and missing timestamps sink to the bottom
5. source-specific synthesized meaning for `waivedContracts[]`, `exceptionHistory[]`, and `pickLog[]`, including `sectionDerived:*` mutation metadata, source-truth detail sections, and raw derived-source metadata

This now leaves the Step 4 base-mode fallback contract pinned directly enough to fail loudly if source ownership, synthesized ordering, or derived-row truth drifts.

---

## STEP 5 — Detail Modal Truth and Drill-Down Integrity

---

### TH-5-1 — The detail modal still mixes normalized display fields and raw fallback fields without clearly owning the boundary between them

**Status:** RESOLVED
**Substep:** TH-5A

**Problem:**

When a user opens a Team History entry, the detail modal renders drill-down content that draws from two materially different field sources: normalized display fields produced by the Step 3 normalization contract (category, type, capDelta, family-specific section lines) and raw fallback fields read directly from the raw world-event payload or synthesized row metadata. These two sources are not cleanly separated in the modal's truth contract. The modal can silently prefer a raw fallback field over a normalized field when the normalized version is missing, absent, or undefined — and it can do the reverse just as silently. This means the modal's rendering behavior is partially incidental: some fieldscome from the explicit normalization contract and some come from raw-payload convenience reads, but nothing in the modal enforces which source owns which field. The drill-down surface can therefore render a mix of authoritative normalized output and unprocessed raw data without the user or the code knowing where the boundary is.

**Resolution:**

The detail modal now treats the selected Team History entry as an explicit drill-down contract instead of a soft normalized/raw blend.

1. `TeamHistoryTab.tsx` now passes one selected-entry wrapper that includes the clicked row, the active team code, and an explicit truth posture: authoritative world-event row, explicit local timeline row, or section-derived fallback row.
2. `HistoryDetailModal.tsx` now renders the main display fields (`category`, `type`, `timestamp`, `teams`, `teamCodes`, `playerIds`, `capDelta`, `primaryDeltas`) from the normalized selected entry only instead of silently backfilling them from `entry.raw`.
3. Raw payload data remains visible, but it is now surfaced through an explicit raw-payload inspection block and raw JSON payload area instead of acting as an invisible fallback source for the main display fields.
4. The modal now tells the user which truth posture is active, including the stronger distinction between authoritative world-event rows, explicit local timeline rows, and section-derived fallback rows.

---

### TH-5-2 — ID, totals, and raw-payload alignment are too loosely tied for the drill-down surface to present honest, coherent event truth

**Status:** RESOLVED
**Substep:** TH-5B

**Problem:**

The detail modal uses a `selectedEntry` object that carries an event ID (or synthesized row ID), cap totals (before/after values), and raw payload metadata (world-event fields, `sectionDerived` metadata, original source entries). These three layers — identity, numeric totals, and raw payload — are not structurally enforced as a coherent unit. The modal can render a cap delta numeric from a different normalization pass than the detail-section lines it renders alongside it. A `selectedEntry` that comes from a synthesized fallback row (which has no `eventId`, `operationId`, or before/after totals) can render in the same modal shell as an authoritative world-event entry without the modal enforcing a meaningfully different truth posture for each. Partial data — a row with an `eventId` but no raw payload, or totals that were derived from a different source than the displayed sections — can pass through the modal undetected. The result is a drill-down surface where identity, totals, and payload are plausible together but not explicitly verified to be coherent.

**Resolution:**

The drill-down surface now renders identity, totals, and raw payload as intentionally separate but aligned truth layers.

1. The modal no longer coalesces `mutationId`, `eventId`, `operationId`, and row `id` into one fallback identifier. Each identifier is now displayed separately and only when the selected entry explicitly carries it.
2. The modal now computes and displays a `Cap Delta Alignment` block that ties the shown normalized `capDelta` to normalized before/after totals by team and calls out whether they reconcile.
3. Normalized before/after totals are rendered from the selected entry only, while raw payload identity and metadata are summarized separately in a raw-payload inspection block plus the raw JSON payload view.
4. Section-derived fallback rows now keep their lighter truth posture inside the same modal shell by explicitly stating that their raw payload is derived-source metadata, not a canonical world-event payload.

---

### TH-5-3 — No focused guardrails exist for detail modal rendering truth or selected-entry integrity

**Status:** OPEN
**Substep:** TH-5C

**Problem:**

The Team History detail modal has no focused test guardrails that protect its rendering contract directly. Existing tests exercise the timeline list and some source-selection behavior, but nothing pins: which fields the modal prefers when both normalized and raw values are available; which detail-section lines render for each mutation family; how the modal behaves when `selectedEntry` carries only partial data (no `eventId`, no raw payload, no before/after totals); or how the modal distinguishes synthesized fallback rows from authoritative world-event rows. This means the field-source boundary from TH-5-1 and the ID/totals/payload alignment problem from TH-5-2 can each drift further without any test failing. A future contributor can weaken the normalized-first rendering contract, change the section-line ordering, or collapse synthesized and world-event entry rendering without detection.

---
