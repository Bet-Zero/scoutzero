# Architect Stage 4 — Guided Franchise Questions Spec and Authority Map

**Stage:** 4A (Spec Pass)
**Branch:** `feature/architect-operating-experience-stage-4-guided-franchise-questions`
**Base:** Stage 3 verified on `main` (commit `4000f70a`)
**Date:** 2026-05-21
**Author:** Claude Code (spec pass)

---

## Executive Summary

Stage 4 adds a guided franchise questions surface to the Architect operating
experience. Stage 1 made the workspace visually continuous, Stage 2 made action
lifecycles operationally continuous, and Stage 3 added a read-only committed
scenario comparison. Stage 4 now answers the next franchise question that the
user can already legitimately ask: **what can I safely ask Architect about this
team, world, and recent activity right now — and which questions must be
deferred because answering them would require new mutation authority, new
simulations, or AI-style guessing?**

Stage 4 is *not* a chatbot, not a freeform planner, and not a move generator.
It is a small, deterministic, read-only "Guide" surface that classifies a fixed
list of franchise questions into **available / partial / deferred /
unavailable**, surfaces the **authoritative input** that backs each answer, and
links the user to existing surfaces (Cap Sheet, Roster, History, Compare,
Trade, Free Agency) where they can inspect the data themselves.

This spec defines supported question families, the Stage 4B v1 implemented
question set, deferred question families, the authoritative input map, the
proposed guided answer view model, the recommended UI placement, the Stage 4B
implementation scope, the Stage 4C verification scope, explicit non-goals,
authority risks and mitigations, the test plan, and files inspected. No product
code is added in this pass.

---

## Stage 4 Objective

Give the operator a guided surface that answers — for the active team in the
active world, at the active viewing/world season — the following meta-questions
using only existing authoritative state:

- What is this team's current cap/tax/apron posture?
- What constraints currently block or warn against further moves?
- What changed in this world (and what cannot yet be compared)?
- Where in the dashboard should I inspect each consequence of the most recent
  committed action?
- Which questions are safe for me to ask right now, and which are deferred
  because Architect does not yet have the authority to answer them?

Stage 4 must not invent recommendations, must not generate moves, must not
bypass trade or signing validation, must not write to Firestore, must not blend
local preview with committed truth, and must not become a chatbot.

---

## Supported Question Families

Each family is graded by Stage 4 capability. Grading uses a fixed four-value
scale:

- **supported** — Stage 4 v1 can answer fully from existing authoritative
  state with no new engine, no new mutation, no new event source.
- **partial** — Stage 4 v1 can answer in part. Some sub-questions are
  available, others are deferred or unavailable.
- **deferred** — Out of scope for Stage 4 v1. Reserved for a later stage with
  appropriate authority.
- **unsafe-until-engine** — Cannot be answered without inventing data or
  bypassing existing validation authority. Must not be implemented as a guided
  answer in any current stage.

### A. Team Status Questions — supported

| Question | Stage 4 Grade | Authority Source |
|----------|---------------|------------------|
| What is this team's current cap/tax/apron posture? | supported | `useArchitectWorkspaceContext.cap` (Stage 1A) |
| Is this team above the cap? | supported | `cap.isOverCap` |
| Is this team above the tax? | supported | `cap.isOverTax` |
| Is this team above the first apron? | supported | `cap.isAtOrAboveFirstApron` |
| Is this team above the second apron? | supported | `cap.isAboveSecondApron` |
| Is this team hard-capped? | partial | `cap.*ApronSpace` and event-derived `taxApronPostureDelta.hardCapActivated`. The workspace cap summary does not yet expose `hardCapActive`; full hard-cap status is currently only on `teamCapSheet.salarySummary` and event snapshots. Stage 4 v1 surfaces what is exposed and labels the rest as "see Cap Sheet." |
| How many roster spots are used? | supported | `useArchitectWorkspaceContext.roster.count` |

### B. Constraint and Blocker Questions — partial

| Question | Stage 4 Grade | Authority Source |
|----------|---------------|------------------|
| What are the current constraints on this team? | partial | Composition of `cap` posture booleans, `roster.count`, and `exceptions` summary. No new "blocker engine" exists. Stage 4 v1 reports what is observable; it does not enumerate every CBA constraint. |
| What blocks this team from making moves right now? | partial | Same composition. Hard-cap, apron, roster-limit, and exception-availability signals are surfaced via existing state. Move-specific legality always requires the user to run the Trade Machine or Free Agency flow. |
| What should the user inspect first? | supported | Navigation guidance derived from observed warnings (e.g., over second apron → "see Cap Sheet"; roster count outside 14–17 in-season → "see Roster"). Deterministic mapping; no recommendation invention. |
| Which warnings matter right now? | partial | Aggregates `cap` posture flags, `roster.count` thresholds, and `exceptions.hasAnyActive` into a fixed warning list. Does not subsume `ValidationWarnings` for in-progress trades. |

### C. Scenario and World Questions — supported

| Question | Stage 4 Grade | Authority Source |
|----------|---------------|------------------|
| What changed in this world? | supported | Stage 3 `Stage3ComparisonViewModel` (`changedTeams`, `changedPlayers`, `committedEventCount`) |
| Which players changed? | supported | `Stage3ComparisonViewModel.changedPlayers.playerIds` |
| Which teams changed? | supported | `Stage3ComparisonViewModel.changedTeams.teamCodes` |
| What comparison data is available? | supported | The set of non-null fields on `Stage3ComparisonViewModel` |
| What comparison data is deferred? | supported | `Stage3ComparisonViewModel.unavailableSummary` + `exceptionDelta.status === 'deferred'` |

### D. Post-Action Questions — supported

| Question | Stage 4 Grade | Authority Source |
|----------|---------------|------------------|
| What just happened? | supported | `useArchitectPostActionReceipt` (Stage 2B receipt: `mutationType`, `changedTeamCodes`, `primaryPlayerIds`, `eventId`, `occurredAt`) |
| Where should the user inspect the consequences? | supported | Stage 2B post-action handoff navigation map (Cap Sheet for cap effects, Roster for player effects, History for event detail) |
| Which recent committed event should be reviewed? | supported | Most recent entry in `useWorldTeamEvents` (already surfaced in `ScenarioMoveRail`) |

### E. Navigation Guidance Questions — supported

| Question | Stage 4 Grade | Authority Source |
|----------|---------------|------------------|
| Where should I go to inspect cap impact? | supported | Deterministic mapping → Cap Sheet tab |
| Where should I go to inspect roster impact? | supported | Deterministic mapping → Roster tab |
| Where should I go to inspect history/event detail? | supported | Deterministic mapping → Team History tab + `useHistoryEventDetailRequest` deep link (Stage 2D) |
| Where should I go to inspect comparison? | supported | Deterministic mapping → Compare tab (Stage 3) |

### F. Move Feasibility Questions — deferred / unsafe

| Question | Stage 4 Grade | Reason |
|----------|---------------|--------|
| Can this team sign a specific player? | deferred | Requires running signing validation on a specific candidate (`useCapValidation`, signing validators). Stage 4 v1 does not surface a new validation entry point; the user runs this in Free Agency. Stage 4 may *link* to Free Agency with the question context preserved. |
| Can this team complete a specific trade? | deferred | Requires the Trade Machine with a fully composed trade. `useTradeMachineValidation` is the authority. Stage 4 v1 does not pre-stage a trade. Linking to Trade Machine is supported. |
| Can this team get under an apron? | unsafe-until-engine | Requires multi-step transaction planning across signings, waives, and trades. No deterministic engine answers this without search/simulation. Must remain deferred until an explicit planning engine exists. |
| Can this team create max cap room? | unsafe-until-engine | Requires renouncing cap holds, optioning out, waiving non-guaranteed contracts, and possibly trading. Multi-step optimization. Same constraint as the apron-duck question. |

---

## Stage 4 v1 Supported Questions (Stage 4B Implementation Set)

Stage 4B implements **exactly** the following question set. Every other
question family in this spec is deferred until a later sub-stage or stage.

| # | Question Id | Title | Family | Answer Source |
|---|-------------|-------|--------|---------------|
| 1 | `cap-posture` | What is our current cap posture? | A | `useArchitectWorkspaceContext.cap` |
| 2 | `roster-count` | How many roster spots are used? | A | `useArchitectWorkspaceContext.roster` |
| 3 | `exceptions-available` | Which exceptions are available? | A | `useArchitectWorkspaceContext.exceptions` |
| 4 | `current-constraints` | What are our current constraints? | B | Composition of `cap` flags, `roster.count`, `exceptions` |
| 5 | `inspect-first` | What should I inspect first? | B | Deterministic warning → navigation mapping |
| 6 | `world-changes-summary` | What changed in this world? | C | `Stage3ComparisonViewModel.changedTeams`, `changedPlayers`, `committedEventCount` |
| 7 | `comparison-available` | What comparison data is available? | C | Non-null fields on `Stage3ComparisonViewModel` |
| 8 | `comparison-deferred` | What comparison data is unavailable or deferred? | C | `Stage3ComparisonViewModel.unavailableSummary` + `exceptionDelta` |
| 9 | `last-action-summary` | What just happened? | D | `useArchitectPostActionReceipt` |
| 10 | `last-action-inspect` | Where should I inspect the consequences of the last action? | D | Stage 2B post-action receipt → deterministic navigation targets |
| 11 | `recent-committed-event` | Which recent committed event should I review? | D | Most recent `useWorldTeamEvents` entry |
| 12 | `navigation-cap` | Where do I inspect cap impact? | E | Static navigation answer |
| 13 | `navigation-roster` | Where do I inspect roster impact? | E | Static navigation answer |
| 14 | `navigation-history` | Where do I inspect history detail? | E | Static navigation answer (uses Stage 2D deep-link seam) |
| 15 | `navigation-comparison` | Where do I inspect scenario comparison? | E | Static navigation answer |

All 15 questions are **read-only**, derive from **existing** state, and carry
**explicit authority labels** in the view model. None of them call any
mutation. None of them call any validator with a synthetic input. None of them
generate a move.

### Sandbox-Mode Behavior for v1 Questions

| Question | Sandbox Behavior |
|----------|------------------|
| 1–5 (team status, constraints) | Answerable when a `teamCapSheet` is present, even with no `worldId`. The "world" axis is `null` in scope. |
| 6–8 (scenario comparison) | `status: 'unavailable'` with reason `'Comparison requires an active world.'` — mirrors the Stage 3 sandbox empty state. |
| 9–11 (post-action / recent committed) | `status: 'unavailable'` with reason `'No committed world events in sandbox mode.'` |
| 12–15 (navigation) | Always answerable; sandbox does not block navigation guidance. |

---

## Deferred Question Families

The following question families are explicitly out of scope for all of Stage 4
(4A, 4B, 4C). They are reserved for a later stage with appropriate authority.

| Family | Reason Deferred |
|--------|-----------------|
| Trade-package generation | No deterministic trade-package generator exists. The Trade Machine validates a user-composed package; it does not generate one. |
| Cap-room optimization | Multi-step optimization across renounces, options, waives, and trades. No engine exists. |
| Multi-step transaction planning | Requires search/simulation. Not supported by existing helpers. |
| Future-move simulation | Requires hypothetical mutations beyond committed truth. Out of scope. |
| Player-specific FA affordability without explicit signing validator input | Would require running signing validators with synthetic inputs. Stage 4 routes the user to Free Agency instead. |
| World A vs World B comparison | Cross-world state loading seam does not exist (Stage 3 deferred). |
| Draft asset deltas | Entitlements ledger is not the canonical comparison source (Stage 3 deferred). |
| Entitlement / pick optimization | Requires a draft-asset ledger comparison + optimization layer that does not exist. |
| Baseline scenario solving | Would require a planning engine. Out of scope. |
| Anything that would require LLM-style or AI-style guessing | Stage 4 must remain deterministic. |
| Parent-world team-state comparison | Requires loading parent world state (Stage 3 deferred). |
| Multi-season comparison | Requires per-year snapshots (Stage 3 deferred). |
| New cross-world FA bidding analysis | No multi-world signing analysis seam exists. |
| Recommending which player to waive or trade | Optimization/recommendation work. Out of scope. |
| Recommending an offseason path | Multi-step planning. Out of scope. |

---

## Authoritative Input Map

Every Stage 4 v1 answer maps back to an existing authoritative source. This
table is the contract Stage 4B implements against. No new source is introduced.

### Tier 1 — Committed Workspace State (Safe to Read)

| Input | Provides | Cannot Answer | Authority Label | Owner File/Hook |
|-------|----------|---------------|-----------------|-----------------|
| `useArchitectWorkspaceContext.team` | Active team identity (`id`, `label`) | Off-team scope | `committed-world` (when world active) or `sandbox` | `src/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext.ts` |
| `useArchitectWorkspaceContext.world` | Active world identity, sandbox vs world distinction | Cross-world questions | `committed-world` / `sandbox` | Same |
| `useArchitectWorkspaceContext.seasons` | Selected viewing season, authoritative world season, mismatch flag | Multi-season comparison | `derived from cap sheet + world metadata` | Same |
| `useArchitectWorkspaceContext.worldDate` | World as-of date | Future date projection | `committed-world` | Same |
| `useArchitectWorkspaceContext.mode` | Mode presentation (world / sandbox / DEV preview) | Mode legality | `derived` | Same + `useArchitectModePresentation` |
| `useArchitectWorkspaceContext.cap` | Cap posture: `totalCapAllocations`, `salaryCap`, `capSpace`, `luxuryTax`, `taxSpace`, `firstApron`, `firstApronSpace`, `secondApron`, `secondApronSpace`, `isOverCap`, `isOverTax`, `isAtOrAboveFirstApron`, `isAboveSecondApron` | Hard-cap status, exception math, future-year cap | `committed-world / current-season` | Same (computed via `computeTeamCapTotals`) |
| `useArchitectWorkspaceContext.roster` | Roster count and source (`players` or `roster`) | Per-player roster identity beyond count | `committed-world / current-season` | Same |
| `useArchitectWorkspaceContext.exceptions` | TPE count, MLE/BAE/Room availability flags, "any active" boolean, world-season basis flag | Per-exception amounts or applicability to a specific signing | `committed-world / current-season` | Same |
| `useArchitectWorkspaceContext.draftAssets` | Always `unavailable` with deferral hint | Draft pick inventory | `unavailable / deferred` | Same |
| `useArchitectWorkspaceContext.status` | Loading, saving, world metadata loading, error | Per-question failure | `derived` | Same |

### Tier 2 — Committed World Event State (Safe to Read)

| Input | Provides | Cannot Answer | Authority Label | Owner File/Hook |
|-------|----------|---------------|-----------------|-----------------|
| `useWorldTeamEvents` (via `useArchitectComparisonViewModel`) | Committed events for active team in active world | League-wide events, sandbox events | `committed-world` | `src/features/architect/history/hooks/useWorldTeamEvents.ts` |
| `Stage3ComparisonViewModel` (consumed via `useArchitectComparisonViewModel`) | Changed teams, changed players, committed event count/refs, cap/posture deltas, multi-season flag, unavailable summary | New deltas not derivable from event stream | `committed-world / event-derived` (per field) | `src/features/architect/comparison/deriveComparisonViewModel.ts` + `useArchitectComparisonViewModel.ts` |
| `Stage3ComparisonViewModel.unavailableSummary` | Authoritative list of deferred comparison fields | New deferral reasons | `unavailable / deferred` | Same |

### Tier 3 — Post-Action Receipt (Safe to Read; Session-Scoped)

| Input | Provides | Cannot Answer | Authority Label | Owner File/Hook |
|-------|----------|---------------|-----------------|-----------------|
| `useArchitectPostActionReceipt` | Most recent committed action: `mutationType`, `changedTeamCodes`, `primaryPlayerIds`, `eventId`, `occurredAt` | Pre-receipt history, multi-session history | `committed-world / session-scoped` | `src/features/architect/GMDashboard/hooks/useArchitectPostActionReceipt.ts` |
| `deriveSeasonAdvanceReceipt` | Season-advance specific receipt construction | Per-team season-advance delta | `committed-world / session-scoped` | `src/features/architect/GMDashboard/postActionHandoff/types.ts` |

### Tier 4 — History Event Stream (Safe to Read)

| Input | Provides | Cannot Answer | Authority Label | Owner File/Hook |
|-------|----------|---------------|-----------------|-----------------|
| `useWorldTeamEvents` (same source as comparison) | Ordered committed events for active team | Cross-team aggregation, cross-world aggregation | `committed-world` | `src/features/architect/history/hooks/useWorldTeamEvents.ts` |
| `normalizeWorldEventsForTeamHistory` | Normalized rows: `eventId`, `mutationType`, `occurredAt`, `playerIds`, `teamsInvolved`, `beforeTotalsByTeam`, `afterTotalsByTeam`, `capDelta` | Anything not derivable from the raw row | `committed-world` | `src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts` |
| `useHistoryEventDetailRequest` | Imperative deep-link request to History detail | Anything beyond opening History detail | `navigation-only` | `src/features/architect/GMDashboard/hooks/useHistoryEventDetailRequest.ts` |

### Tier 5 — Validators (Reference Only; Do Not Re-Run with Synthetic Input)

| Input | Provides | Stage 4 Use | Authority Label | Owner File/Hook |
|-------|----------|-------------|-----------------|-----------------|
| `useCapValidation` | Cap-side legality validation | Reference only — Stage 4 does **not** call this with synthetic inputs | `existing-validation-authority` | `src/features/architect/hooks/useCapValidation.ts` |
| `useTradeMachineValidation` | Trade legality validation | Reference only — Stage 4 does **not** call this with synthetic inputs | `existing-validation-authority` | `src/features/architect/hooks/useTradeMachineValidation.ts` |
| `capLegalityValidation.*` | Signing/cap validators | Reference only — Stage 4 v1 never composes a synthetic signing or trade. Move-feasibility answers route the user to the validator's existing entry point (Free Agency or Trade Machine). | `existing-validation-authority` | `src/features/architect/utils/capLegalityValidation/` |

### Tier 6 — Offseason/Season Mismatch State

| Input | Provides | Cannot Answer | Authority Label | Owner File/Hook |
|-------|----------|---------------|-----------------|-----------------|
| `useArchitectWorkspaceContext.seasons.viewingSeasonDiffersFromWorldSeason` | Whether the user is viewing a season different from the authoritative world season | Why the mismatch exists | `derived from cap sheet + world metadata` | `useArchitectWorkspaceContext.ts` |
| `useArchitectWorkspaceContext.seasons.authoritativeWorldSeason{Label,Status}` | The world's authoritative season | Future seasons | `committed-world` | Same |

### Tier 7 — Deferred / Unavailable for Stage 4 v1

| Input | Why Deferred |
|-------|-------------|
| `ScenarioMoveRail` model | Already presents recent activity; Stage 4 should link to it, not re-fetch the same data into the Guide. |
| `CapTableSection` row state | Per-player cap rows are not aggregated into a guided answer. Inspection happens in Cap Sheet. |
| Local/pending state (`TradeReceiptPanel`, draft trade composition, `CapAuditDebugPanel`, local audit events, DEV preview state) | Never input to a Stage 4 answer. Same boundary as Stage 3. |
| Base/source team collection (Firestore) | Never read by Stage 4. Same boundary as Stage 3. |
| Cross-world fetches | Not available; Stage 3 deferred. |
| Per-year future cap totals | Not canonical on `teamCapSheet` for Stage 4. |
| Entitlements sub-collection | Not a Stage 4 input. |

---

## Proposed Guided Answer View Model

Every guided question produces a single, deterministic `Stage4GuidedAnswer`
object. The view model is pure and depends only on the inputs listed in the
Authoritative Input Map.

```ts
export type Stage4AnswerStatus = 'available' | 'partial' | 'deferred' | 'unavailable';
export type Stage4Severity = 'info' | 'success' | 'warning' | 'danger';

export type Stage4AuthorityLabel =
  | 'committed-world'
  | 'committed-world / current-season'
  | 'committed-world / event-derived'
  | 'committed-world / session-scoped'
  | 'derived'
  | 'sandbox'
  | 'unavailable'
  | 'deferred'
  | 'navigation-only';

export type Stage4NavigationTargetId =
  | 'roster'
  | 'cap'
  | 'capfull'
  | 'trade'
  | 'fa'
  | 'offseason'
  | 'history'
  | 'compare'
  | 'guide';

export interface Stage4EvidenceChip {
  /** Short label, e.g. "Cap Space: $4.2M" or "Above 2nd Apron". */
  label: string;
  /** Authority source for this chip's value. */
  authority: Stage4AuthorityLabel;
  /** Optional severity hint for chip styling. */
  severity?: Stage4Severity;
}

export interface Stage4NavigationTarget {
  id: Stage4NavigationTargetId;
  label: string;
  /**
   * Navigation-only intent. Stage 4 never includes a mutation callback.
   */
  intent: 'navigate';
}

export interface Stage4BlockingConstraint {
  /** Short label, e.g. "Above second apron — hard-cap rules apply". */
  label: string;
  authority: Stage4AuthorityLabel;
  severity: Stage4Severity;
}

export interface Stage4DeferredReason {
  /** Why this question (or part of it) is deferred. */
  reason: string;
  /** Authority source explaining the deferral, if any. */
  authority: Stage4AuthorityLabel;
}

export interface Stage4GuidedAnswer {
  /** Stable id for this question. Matches the v1 supported-question table. */
  id: string;
  /** Question text shown to the user. */
  title: string;
  /** Family grouping (A–F). */
  family: 'team-status' | 'constraints' | 'scenario' | 'post-action' | 'navigation' | 'move-feasibility';
  status: Stage4AnswerStatus;
  /** One- or two-sentence textual answer. Never freeform; always derived from inputs. */
  shortAnswer: string;
  /** Evidence chips backing the short answer. */
  evidence: Stage4EvidenceChip[];
  /** Authority labels relevant to this answer (deduplicated). */
  authorityLabels: Stage4AuthorityLabel[];
  /** Recommended navigation targets. Navigation-only; no mutation callbacks. */
  navigationTargets: Stage4NavigationTarget[];
  /** Constraints that currently block or warn against further moves. */
  blockingConstraints: Stage4BlockingConstraint[];
  /** Reasons this question (or parts of it) cannot be answered. */
  deferredReasons: Stage4DeferredReason[];
  /** Related question ids that the user may want to consult next. */
  relatedQuestionIds: string[];
  /** Severity hint for the overall answer (drives the answer card chrome). */
  severity: Stage4Severity;
}

export interface Stage4GuidedAnswersViewModel {
  /** Scope this answer set is bound to. */
  scope: {
    teamCode: string | null;
    worldId: string | null;
    sandbox: boolean;
    season: number | null;
    authority: 'committed-world' | 'sandbox';
  };
  /** Status of the underlying inputs. */
  status: {
    workspaceLoading: boolean;
    workspaceError: string | null;
    comparisonStatus: 'sandbox' | 'loading' | 'error' | 'available';
  };
  /** The 15 v1 guided answers, in canonical question-id order. */
  answers: Stage4GuidedAnswer[];
}
```

### View Model Construction Rules

1. **Deterministic.** Same inputs → identical view model.
2. **No mutation callbacks.** `Stage4GuidedAnswer.navigationTargets[*].intent`
   is always `'navigate'`. No `onAction`-style field exists in the view model.
3. **Authority on every chip.** Every `Stage4EvidenceChip` carries an
   `authority` label. No chip can render without one.
4. **Deferred is explicit, not hidden.** `status: 'deferred'` answers always
   render with at least one `Stage4DeferredReason`.
5. **No invented values.** If an input is missing or unavailable, the answer's
   status drops to `'unavailable'` and a `deferredReasons` entry explains why.
6. **No validator calls.** The view model never calls `useCapValidation`,
   `useTradeMachineValidation`, or any signing validator. Move-feasibility
   answers (deferred in v1) would link to those flows, never invoke them with
   synthetic input.

---

## UI Placement Recommendation

### Recommended: New "Guide" Tab in GMDashboard (Stage 4B)

**Rationale.** The dashboard tab pattern (`roster`, `cap`, `capfull`, `trade`,
`fa`, `offseason`, `history`, `compare`) is the established navigation seam.
The Stage 3 Compare tab follows exactly this pattern. A new `'guide'` tab:

- Follows the established convention (one new tab per stage).
- Keeps guided answers out of the persistent cockpit (workspace header), so
  the orientation surface stays focused on identity/world/season/mode.
- Allows the Guide tab to gracefully degrade in sandbox mode without affecting
  any other tab.
- Co-locates *all* guided answers in one place, so the user has a single
  entry point and does not hunt across surfaces.

**Tab order recommendation.** After `compare`, before any future Stage 5+
tabs:

```
Roster | Cap Sheet | Full Cap Table | Trade Machine | Free Agency |
Offseason | Team History | Compare | Guide
```

**Tab behavior.**
- Always reachable.
- In world mode with a team: renders the full v1 answer set.
- In sandbox mode: renders the subset of answers that do not require world
  state (1–5 and 12–15); world-dependent answers (6–11) render as
  `'unavailable'` with the sandbox reason.
- Loading and error states mirror the Stage 3 Compare tab pattern.

### Rejected Alternatives

| Alternative | Why Rejected |
|-------------|--------------|
| Panel under the workspace header | Would push answer chrome into the orientation layer and compete with team/world/season/mode chips. Persistent header should stay quiet; the Guide is an opt-in deep dive. |
| Section inside the Compare tab | Compare is scoped to scenario deltas only. Adding team-status and constraint questions there would dilute Compare's authority boundary (committed event delta only) and create a multi-purpose tab. |
| Slot inside the post-action handoff strip | The handoff strip is a transient post-action prompt, not a persistent answers surface. Mixing them would make the strip noisier and would not provide a place for the user to revisit answers. |
| Inline panel inside the activity rail | The rail is compact, focused on recent activity. Guided answers would outgrow it immediately. |
| New top-level route outside the dashboard | Would break workspace continuity (Stage 1 thesis). Stage 4 must compose into the existing dashboard. |

**Selected Stage 4B placement: new `'guide'` tab in `GMDashboard`, placed after
the Compare tab.**

---

## Stage 4B Implementation Scope

**Goal.** Implement the v1 guided answers surface as pure helpers + a thin
hook + a read-only tab section. No new event source, no Firestore writes, no
mutation authority changes.

### Deliverables

1. **`src/features/architect/guidedQuestions/types.ts`**
   - `Stage4AnswerStatus`, `Stage4Severity`, `Stage4AuthorityLabel`,
     `Stage4NavigationTargetId`, `Stage4EvidenceChip`,
     `Stage4NavigationTarget`, `Stage4BlockingConstraint`,
     `Stage4DeferredReason`, `Stage4GuidedAnswer`,
     `Stage4GuidedAnswersViewModel`.

2. **`src/features/architect/guidedQuestions/questionCatalog.ts`**
   - The fixed table of 15 v1 question definitions: id, title, family,
     default severity, related question ids. No inputs; pure constant.

3. **`src/features/architect/guidedQuestions/answerCapPosture.ts`**
   - Pure helper. Given a `ArchitectWorkspaceContext`, returns the
     `Stage4GuidedAnswer` for `cap-posture` (and the related team-status
     questions). Reuses the cap summary already exposed by Stage 1A.

4. **`src/features/architect/guidedQuestions/answerConstraints.ts`**
   - Pure helper. Given the workspace context (cap + roster + exceptions),
     returns the answers for `current-constraints` and `inspect-first`.
     Deterministic mapping table from observed flags → blocker labels →
     navigation targets. No new constraint engine.

5. **`src/features/architect/guidedQuestions/answerScenario.ts`**
   - Pure helper. Given the `Stage3ComparisonViewModel` and the comparison
     status (`'sandbox' | 'loading' | 'error' | 'available'`), returns the
     answers for `world-changes-summary`, `comparison-available`,
     `comparison-deferred`. Reuses Stage 3 directly.

6. **`src/features/architect/guidedQuestions/answerPostAction.ts`**
   - Pure helper. Given the post-action receipt (`ArchitectPostActionReceipt`
     or `null`) and the most recent normalized world team event row,
     returns the answers for `last-action-summary`, `last-action-inspect`,
     and `recent-committed-event`. Reuses Stage 2B receipt and Stage 2D
     deep-link target identification.

7. **`src/features/architect/guidedQuestions/answerNavigation.ts`**
   - Pure helper. Returns the four static navigation answers (12–15).
     Always answerable.

8. **`src/features/architect/guidedQuestions/deriveGuidedAnswers.ts`**
   - Pure aggregator. Composes all 15 answers into a
     `Stage4GuidedAnswersViewModel`. Takes only the inputs listed in the
     Authoritative Input Map.

9. **`src/features/architect/guidedQuestions/index.ts`**
   - Public API: types, `deriveGuidedAnswers`.

10. **`src/features/architect/GMDashboard/hooks/useArchitectGuidedAnswers.ts`**
    - Thin React hook. Reads:
      - `useArchitectWorkspaceContext` (already in `GMDashboard`)
      - The Stage 3 `useArchitectComparisonViewModel` result already
        computed in `GMDashboard`
      - `useArchitectPostActionReceipt`
      - The latest normalized event row from the existing
        `useWorldTeamEvents` already feeding the Activity Rail / Compare
    - Calls `deriveGuidedAnswers` and returns the view model.
    - No new Firestore read seam. No new event source. No `useEffect`
      side-effects. No state writes.

11. **`src/features/architect/GMDashboard/sections/GuideSection.tsx`**
    - Read-only tab section component.
    - Props: `viewModel: Stage4GuidedAnswersViewModel`, plus navigation
      callbacks per `Stage4NavigationTargetId`:
      `onNavigate(targetId: Stage4NavigationTargetId): void`.
    - Renders one answer card per question, grouped by family.
    - Each card shows: title, short answer, severity chip, evidence chips
      with authority labels, blocking-constraint pills, deferred-reason
      list, and navigation buttons that invoke `onNavigate`.
    - Sandbox-mode answers render with `'unavailable'` chrome and the
      sandbox reason inline.
    - No mutation callbacks. No `onAction`. No write side-effects.

12. **`GMDashboard.tsx` wiring (minimal):**
    - Add `'guide'` to the `setActiveTab` union and tab bar (one new button,
      same styling pattern as `compare`).
    - Add `<GuideSection>` to the tab content switch.
    - Pass the `useArchitectGuidedAnswers` view model + a single `onNavigate`
      handler that maps target ids to existing `setActiveTab` / history
      open calls.

### Stage 4B Non-Goals

- No new Firestore read seam.
- No new event source.
- No new mutation pipeline path.
- No validator invocation with synthetic input.
- No move generation.
- No guided "build me a trade" workflow.
- No LLM/AI/freeform reasoning in code.
- No changes to `mutationPipeline`, `seasonManager`, `worldManager`.
- No changes to Stage 1, Stage 2, or Stage 3 surfaces.
- No changes to `ScenarioMoveRail`, `ArchitectPostActionHandoff`,
  `ArchitectWorkspaceHeader`, `ComparisonSection`, `HistorySection`,
  `CapSheetSection`, `CapTableSection`, `RosterSection`, `TradeSection`,
  `FreeAgencySection`, `OffseasonSection`.

### Stage 4B Acceptance Criteria

- All 11 deliverable files exist with the responsibilities above.
- `deriveGuidedAnswers` is a pure function (same inputs → same outputs;
  no Firestore, React, or state mutation).
- All 15 `Stage4GuidedAnswer` entries are produced for any non-error input.
- Every `Stage4EvidenceChip` carries an `authority` label.
- Every `'deferred'` or `'unavailable'` answer carries at least one
  `Stage4DeferredReason`.
- Sandbox mode produces `'unavailable'` answers (with reason) for
  world-dependent questions, and `'available'` answers for the navigation
  set.
- `GuideSection` never imports any validator hook, never imports any
  mutation helper, and never imports any Firestore write function.
- `npm run typecheck` passes.
- `npm run validate:project` passes.
- `npm run build` passes.
- Stage 4B test files (defined in the test plan) pass.
- Stage 1, Stage 2, and Stage 3 test suites continue to pass with no new
  failures.

---

## Stage 4C Verification Scope

**Goal.** Confirm Stage 4 is complete and safe before opening the PR for
the entire stage.

### Verification Checklist

1. All Stage 4B pure helpers pass their targeted tests.
2. All Stage 4B UI rendering tests pass.
3. `npm run typecheck` is clean.
4. `npm run validate:project` passes.
5. `npm run build` is clean (no new warnings or errors).
6. Stage 1, Stage 2, and Stage 3 test suites pass with no new failures.
7. Manual verification: Guide tab renders the 15 v1 answers for an active
   world with committed events.
8. Manual verification: Guide tab renders sandbox-appropriate answers when
   no world is active.
9. Manual verification: Every answer card shows at least one authority
   label.
10. Manual verification: Deferred answers show their deferred reasons.
11. Manual verification: Navigation buttons land on the correct existing
    tabs / history detail.
12. Manual verification: No mutation buttons exist in the Guide tab.
13. Guardrail confirmations:
    - No Firestore writes added.
    - No new event source added.
    - No mutation pipeline changes.
    - No seasonManager changes.
    - No worldManager changes.
    - No new validation entry point.
    - No synthetic validator inputs.
    - No move-generation logic.
    - No multi-step planning logic.
    - No cross-world fetches.
    - No baseline collection reads.
    - No LLM-style reasoning in code (no freeform string templating beyond
      deterministic answer composition).
    - No mutations to Stage 1, Stage 2, or Stage 3 surfaces.
    - The `'guide'` tab is the only new tab.

---

## Explicit Non-Goals

The following items are out of scope for all of Stage 4 (4A, 4B, 4C):

- **No chatbot or freeform Q&A.** The question catalog is fixed.
- **No move generation.** No trade-package generator, no signing planner,
  no waive/option recommender.
- **No multi-step transaction planning.** No search, no simulation.
- **No claim that a move is legal without running existing validation
  authority.** Move-feasibility questions remain deferred or route the
  user to the validator's existing entry point (Free Agency / Trade
  Machine).
- **No bypass of trade or signing validation.** Stage 4 never composes a
  synthetic trade or signing.
- **No Firestore writes.** Guide surface is read-only.
- **No new mutation paths.** No new commit, no new event creation, no new
  receipt creation.
- **No presentation of local/pending state as committed.** Local trade
  drafts, DEV preview, and audit panels are never inputs.
- **No overclaim of comparison data.** Stage 3's authority labels and
  deferred summary are preserved verbatim.
- **No becoming a chatbot inside the product.** No freeform natural-language
  generation. All `shortAnswer` strings derive deterministically from
  authoritative inputs (no LLM call in product code).
- **No LLM-style freeform reasoning in code.** All answer construction is
  deterministic mapping.
- **No branch/scenario mutations.** No `createWorld` invocation, no world
  branching UI.
- **No new Stage 5+ features.** No polish work beyond what Stage 4
  requires.
- **No changes to Stage 1/2/3 surfaces.** The only new surface is the
  Guide tab.

---

## Authority Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Guide answers drift into invented recommendations | All answers derive from a fixed mapping table over existing authoritative inputs. `shortAnswer` strings are constructed from fixed templates filled by authoritative values, never generated. |
| User reads "Can this team sign Player X?" as a green-light | Move-feasibility questions are deferred in v1. They are listed in this spec only as future scope. Stage 4B does not render an answer for them. |
| User reads "What should I inspect first?" as a recommendation | The `'inspect-first'` answer is deterministic: it maps observed warnings (cap posture, roster count, exception state) to existing tabs. Severity and label are fixed; no recommendation is invented. |
| Hard-cap status overclaimed | Workspace cap summary does not yet expose `hardCapActive`. Stage 4 v1 marks the hard-cap question as `'partial'` and routes the user to Cap Sheet for full status. |
| Local/pending state sneaks into Guide answers | Guide hook reads only from `useArchitectWorkspaceContext`, `useArchitectComparisonViewModel`, `useArchitectPostActionReceipt`, and (indirectly) `useWorldTeamEvents`. No read from local trade draft, audit panel, or DEV preview state. |
| Comparison-deferred set drifts from Stage 3 | The `'comparison-deferred'` answer reads `Stage3ComparisonViewModel.unavailableSummary` directly. It does not maintain a parallel deferral list. |
| Validators called with synthetic inputs | Stage 4B helpers must not import any validator. A grep guard in the helper directory enforces this. |
| Guide tab becomes a chatbot | No NLP, no LLM call, no freeform text. All `shortAnswer` and chip labels are constructed via deterministic templates over typed inputs. |
| Sandbox mode shows misleading "available" answers | World-dependent answers (6–11) explicitly drop to `'unavailable'` with a sandbox reason when `worldId` is null. |
| Stage 3 comparison status confusion | Guide hook surfaces the underlying `comparisonStatus` so a comparison `'loading'` or `'error'` state propagates clearly to the scenario answers (6–8). |
| Guide tab assumed available on every route | Guide tab requires a `teamCapSheet`. When no team is loaded, the tab renders an unavailable state with the workspace-status reason. |
| Stage 4 widens the dashboard's mutation footprint | `GMDashboard.tsx` wiring adds one tab button, one section render, and one `onNavigate` mapping. No new mutation callback, no new write helper, no new mutation flag. |
| Future stages confuse Guide with a planner | This spec's "Deferred Question Families" table is the contract. Any planner-style functionality is reserved for a later stage with explicit authority. |

---

## Test Plan

All tests are targeted to Stage 4 logic. Do not run the full test suite
unless authorized with `RUN FULL SUITE`.

### Stage 4B Tests — Pure Helpers

**File:** `src/tests/architect/stage4.guidedQuestionsFoundation.test.ts`

| Test | Description |
|------|-------------|
| `deriveGuidedAnswers` returns all 15 v1 answers in canonical order | Any non-error input produces exactly 15 `Stage4GuidedAnswer` entries with the expected ids |
| `cap-posture` answer derives from workspace cap summary | Cap summary present with `isOverCap: true` → answer shortAnswer contains cap posture string and `evidence` chips include cap, tax, and apron chips with `committed-world / current-season` authority |
| `cap-posture` answer is `'unavailable'` when cap summary is unavailable | `workspaceContext.cap.status === 'unavailable'` → answer status `'unavailable'`; deferredReasons has at least one entry |
| `roster-count` answer is `'unavailable'` when roster summary is unavailable | `workspaceContext.roster.status === 'unavailable'` → answer status `'unavailable'`; deferredReasons populated |
| `exceptions-available` answer reflects exception availability flags | `exceptions.status === 'available'` with `hasAvailableMle: true` → evidence chip "MLE available" |
| `current-constraints` answer composes posture + roster + exceptions | Above second apron + roster at 17 → blockingConstraints includes both labels with appropriate severities |
| `inspect-first` answer points to the highest-severity warning's tab | Above second apron + comfortable roster → navigation target `'cap'` with severity `'warning'`; no warnings → severity `'info'` and target `'guide'` |
| `world-changes-summary` answer derives from `Stage3ComparisonViewModel` | Comparison VM with 3 committed events → evidence chip "3 committed events" + chip for changed team count |
| `comparison-available` answer lists Stage 3 fields with non-null values | Cap delta present + roster additions empty → chip "Cap delta available" present; chip "Roster additions available" absent |
| `comparison-deferred` answer reads `unavailableSummary` verbatim | Comparison VM with two unavailable summary entries → answer deferredReasons has two entries matching the summary's field+reason text |
| `last-action-summary` answer derives from `useArchitectPostActionReceipt` | Receipt present with `mutationType: 'executeTrade'` → shortAnswer includes "trade" and references changed teams; receipt absent → answer status `'unavailable'` |
| `last-action-inspect` answer maps receipt to navigation targets | Receipt with `changedTeamCodes.length > 0` → navigation targets include `'cap'` and `'roster'` |
| `recent-committed-event` answer references latest event row | Latest normalized event row provided → evidence chip includes `mutationType` + `eventId` (truncated); no events → status `'unavailable'` |
| Navigation answers (12–15) are always `'available'` | Any input including sandbox → four navigation answers all have status `'available'` |
| Sandbox mode: world-dependent answers are `'unavailable'` | `worldId: null` → answers 6–11 have status `'unavailable'` with sandbox reason; answers 1–5 and 12–15 unaffected |
| Every evidence chip has an authority label | Iterate every chip across every answer; assert non-empty `authority` string |
| Every deferred/unavailable answer has at least one deferred reason | Iterate answers; assert deferredReasons.length >= 1 when status in `{'deferred','unavailable'}` |
| No validator is imported by the guided-questions module | Static guard test greps the helper directory for forbidden imports |
| No Firestore write helper is imported by the guided-questions module | Static guard test greps the helper directory for forbidden imports |
| `deriveGuidedAnswers` is pure (same inputs → identical output) | Two calls with structurally equal inputs produce deep-equal view models |

### Stage 4B Tests — UI Rendering

**File:** `src/tests/architect/stage4.guidedQuestionsUI.test.tsx`

| Test | Description |
|------|-------------|
| Renders 15 answer cards | View model with all 15 answers → 15 distinct cards with `data-testid="guide-answer-<id>"` |
| Renders sandbox state for world-dependent answers | World-dependent answers with status `'unavailable'` render an unavailable badge and the sandbox reason text |
| Authority labels visible on chips | Each evidence chip renders its authority label text |
| Deferred reasons rendered for deferred/unavailable answers | Deferred answer cards render their deferred reason list |
| Navigation buttons call `onNavigate` with the target id | Click `'cap'` navigation button on `cap-posture` → `onNavigate('cap')` called once |
| No mutation callbacks on `GuideSection` props | `GuideSectionProps` interface has no `onSign*`, `onTrade*`, `onCommit*`, `onWaive*`, `onExtend*`, or any other mutation field |
| Guide tab renders unavailable state when workspace has no team | View model `scope.teamCode: null` + workspace error → unavailable summary card rendered |
| Renders blocking-constraint pills | Answer with blockingConstraints populated → pills rendered with severity-styled chrome |
| Severity chrome applied per answer | Answer with severity `'warning'` → card carries warning class; `'danger'` → danger class |

### Stage 4C Tests — Integration

**File:** `src/tests/architect/stage4c.guidedQuestionsIntegration.test.tsx`

| Test | Description |
|------|-------------|
| Guide tab reachable from tab bar | Click `data-testid="tab-guide"` → Guide section rendered |
| Guide tab does not affect other tabs | After visiting Guide, switching back to Compare/History/Cap Sheet renders previous content unchanged |
| Navigation buttons drive `setActiveTab` for non-history targets | Click cap-impact navigation → cap tab is active |
| Navigation to history uses existing deep-link seam | Click history navigation → `openHistoryRoot` is invoked |

---

## Files Inspected

| File | Purpose |
|------|---------|
| `docs/architect/ARCHITECT_NEXT_ERA_MASTER_PLAN.md` | Stage 4 framing, master non-goals, implementation principles |
| `docs/architect/ARCHITECT_STAGE_2_FINAL_VERIFICATION.md` | Stage 2 baseline, deferred items, validation philosophy |
| `docs/architect/ARCHITECT_STAGE_3_SCENARIO_COMPARISON_SPEC.md` | Stage 3 supported/deferred comparison targets, authority labels |
| `docs/architect/ARCHITECT_STAGE_3_FINAL_VERIFICATION.md` | Stage 3 acceptance results, guardrail confirmations, deferred items list |
| `src/features/architect/GMDashboard/GMDashboard.tsx` | Composition shell, tab pattern, Stage 1/2/3 wiring seams, navigation handlers |
| `src/features/architect/GMDashboard/components/ArchitectWorkspaceHeader.tsx` | Stage 1 persistent cockpit |
| `src/features/architect/GMDashboard/components/ArchitectPostActionHandoff.tsx` | Stage 2B post-action receipt strip |
| `src/features/architect/GMDashboard/components/ScenarioMoveRail.tsx` | Stage 2B/2D activity rail |
| `src/features/architect/GMDashboard/sections/ComparisonSection.tsx` | Stage 3C comparison tab — pattern reference for Stage 4 Guide tab |
| `src/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext.ts` | Stage 1A workspace view model — primary Tier 1 input |
| `src/features/architect/GMDashboard/hooks/useArchitectComparisonViewModel.ts` | Stage 3C comparison hook — Tier 2 input for scenario answers |
| `src/features/architect/comparison/index.ts` | Public Stage 3 comparison API — types and helper exports |
| `src/features/architect/comparison/types.ts` | Stage 3 view model and authority-label types |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` (and `.types.ts`) | Mutation surface — confirmed not invoked by Stage 4 |
| `src/features/architect/GMDashboard/sections/TradeSection.tsx` | Trade tab — Stage 4 navigation target only |
| `src/features/architect/GMDashboard/sections/FreeAgencySection.tsx` | FA tab — Stage 4 navigation target only |
| `src/features/architect/GMDashboard/sections/CapSheetSection.tsx` | Cap Sheet tab — Stage 4 navigation target only |
| `src/features/architect/GMDashboard/sections/CapTableSection.tsx` | Full Cap Table tab — Stage 4 navigation target only |
| `src/features/architect/GMDashboard/sections/RosterSection.tsx` | Roster tab — Stage 4 navigation target only |
| `src/features/architect/GMDashboard/sections/HistorySection.tsx` | Team History tab — Stage 4 navigation target only |
| `src/features/architect/history/hooks/useWorldTeamEvents.ts` | Committed event source (Stage 2D/3) — Tier 4 input |
| `src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts` | Normalized event rows |
| `src/features/architect/utils/capTotals/computeTeamCapTotals.ts` | Cap totals computation — backing Stage 1A `cap` summary |
| `src/features/architect/hooks/useCapValidation.ts` | Existing cap validation authority — referenced as deferred entry point only |
| `src/features/architect/hooks/useTradeMachineValidation.ts` | Existing trade validation authority — referenced as deferred entry point only |
| `src/features/architect/utils/capLegalityValidation/` | Signing/cap validators — referenced as deferred entry point only |

---

## Summary

Stage 4A defines a small, deterministic, read-only "Guide" surface. It
classifies 15 v1 franchise questions into available / partial / deferred /
unavailable, surfaces the authoritative input behind each answer, and routes
the user to existing inspection surfaces. It does not introduce a new
validator, a new event source, a new mutation path, a new Firestore write, a
move generator, or a chatbot.

Stage 4B will implement the 15-answer view model, a thin hook, and a new
`'guide'` tab in `GMDashboard`. Stage 4C will verify the full stage and open
the PR.
