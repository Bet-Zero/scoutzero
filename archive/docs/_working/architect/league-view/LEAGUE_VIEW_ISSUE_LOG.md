# LEAGUE VIEW — ISSUE LOG

## Purpose

Problem-level issue history for the League View Truth Pass.
Issues describe underlying system problems, not action task titles.
Status and resolution history are tracked per issue.

---

## STEP 1 — Top-Level Ownership, Data Loading, and Season / Source Boundary Truth

### LV-1-1 — League View top-level ownership is too mixed and inline rather than reading cleanly as a thin league consumer shell

**Status:** RESOLVED
**Substep:** LV-1A

**Problem:**
`LeagueView.tsx` is the real live feature entry point, but it owns too many different responsibilities inline at once: season resolution, league-wide team loading, per-team summary shaping, conference grouping, alphabetical sorting, inline table rendering, and navigation handoff into `/gm/:teamSlug`. There is no dedicated loading hook, summary adapter, row/table component, season/source truth component, or failure-state abstraction. The feature is coherent in the sense that one surface owns the whole league-level read/render flow, but it is not acting like a thin shell over clearer sub-seams — it is acting like the full feature contract in one inline file. That makes the top-level contract easy to locate but broader and softer than ideal, and easier to widen incorrectly as the feature grows.

**Resolution:**
Resolved in LEAGUE_VIEW_1A_1B execution.

`LeagueView.tsx` now reads as a thin feature shell that owns routing handoff and composition. The league-wide season/read/totals shaping work moved into `leagueViewModel.ts`, the async state and conference grouping moved into `useLeagueTeamSummaries.ts`, and presentation moved into `LeagueViewTruthPanel.tsx` and `LeagueConferenceTable.tsx`. The feature remains a simple league-wide consumer of `loadTeamCapSheet(...)` and `computeTeamCapTotals(...)`; no totals-engine or contract-year work was widened into this substep.

**Files implicated:**

- `src/features/architect/shared/LeagueView/LeagueView.tsx` — primary surface with monolithic top-level ownership
- `src/features/architect/shared/LeagueView/leagueViewModel.ts` — season/read/totals summary model extracted from the shell
- `src/features/architect/shared/LeagueView/useLeagueTeamSummaries.ts` — async League View summary hook and conference grouping owner
- `src/features/architect/shared/LeagueView/LeagueViewTruthPanel.tsx` — season/source/totals truth presentation
- `src/features/architect/shared/LeagueView/LeagueConferenceTable.tsx` — conference table and row presentation

---

### LV-1-2 — Season / source boundary and failed-load behavior are too implicit, allowing degraded or fallback UI state to present as authoritative loaded league truth

**Status:** RESOLVED
**Substep:** LV-1B

**Problem:**
League View resolves its season boundary once at load time via `getDefaultSeasonEndYear()` from `seasonUtils.ts`, but that choice is never surfaced clearly in the UI — users cannot see what season the surface is displaying, why that season was chosen, or whether it is fixed or changeable. The import also routes through a deprecated compatibility module that simply re-exports the canonical helper from `seasonFormat`, adding a small but real softness to the import boundary. More critically, when a team fails to load, the feature returns a summary row with the team identity preserved but `totalSalary: 0`. Because loaded team rows and fallback rows share the same summary shape, a failed load and a real zero-value team are visually indistinguishable in the rendered league table. The surface does not mark failed rows as failed, unavailable, or fallback — it quietly flattens degraded data state into valid-looking league-summary rows, and there is no status field or UI distinction that separates loaded league truth from fallback/default UI truth created after load failure.

**Resolution:**
Resolved in LEAGUE_VIEW_1A_1B execution.

League View season resolution now imports directly from the canonical `seasonFormat` helper boundary. The UI now surfaces the resolved season code, the default current-season source, the read-only base snapshot source boundary, and the canonical totals boundary. Failed or missing team loads now produce `sourceState: 'unavailable'` summaries with `totalSalary: null`; the table renders those rows as unavailable / not loaded instead of formatting them as `$0`. Loaded rows continue to render `computeTeamCapTotals(...).totalCapAllocations` as the authoritative league summary number.

**Files implicated:**

- `src/features/architect/shared/LeagueView/LeagueView.tsx` — fallback `totalSalary: 0` behavior; `getDefaultSeasonEndYear()` usage without UI exposure
- `src/features/architect/shared/LeagueView/leagueViewModel.ts` — canonical `seasonFormat` import boundary and loaded-vs-unavailable summary shaping
- `src/features/architect/shared/LeagueView/LeagueViewTruthPanel.tsx` — visible season/source/totals boundary
- `src/features/architect/shared/LeagueView/LeagueConferenceTable.tsx` — visible unavailable row state
- `src/features/architect/utils/seasonUtils.ts` — deprecated compatibility re-export previously used by League View; no longer used by this seam
- `src/features/architect/utils/firebaseTeamPlanHelpers.ts` — `loadTeamCapSheet` read seam (source boundary is clean; load-failure silencing is upstream)
- `src/features/architect/utils/capTotals/computeTeamCapTotals.ts` — canonical totals consumer (not the problem source; context for the zero-value fallback shape)

---

### LV-1-3 — No focused guardrails exist to protect top-level ownership, season-boundary signaling, or loaded-vs-fallback truth

**Status:** RESOLVED
**Substep:** LV-1C

**Problem:**
League View is currently compact — the whole feature contract lives in one file — which means top-level drift can affect the full feature quickly without any loud failure. The shell-as-thin-consumer behavior improved by LV-1A, the season/source boundary truth improved by LV-1B, and the loaded-vs-fallback distinction are all seams that depend on continued discipline inside `LeagueView.tsx` rather than on structural enforcement. There are no focused tests or source guardrails that pin: the feature shell staying thin rather than accumulating further inline responsibilities; season sourcing remaining grounded rather than drifting through compatibility re-export paths; load failures being marked explicitly rather than flattening into zero-value rows; or fallback/degraded rows being distinguishable from loaded league truth. Without guardrails, a future shell widening, season-source drift, or fallback-handling regression can occur while canonical totals consumption remains intact — leaving a feature that appears functionally correct but tells a softer top-level truth story.

**Resolution:**
Resolved in LEAGUE_VIEW_1C execution.

The focused League View loading-boundary behavior test now includes a closeout guardrail sweep for the Step 1 contract. Source-level assertions pin `LeagueView.tsx` as a composition/navigation shell, keep async state ownership in `useLeagueTeamSummaries.ts`, keep season/read/totals summary shaping in `leagueViewModel.ts`, and keep truth-panel/table presentation outside the shell. Behavior assertions now pin canonical `seasonFormat` resolution, visible season/source/totals labels, top-level load-error visibility, loaded summaries from `computeTeamCapTotals(...).totalCapAllocations`, missing/failed reads as `sourceState: 'unavailable'` with `totalSalary: null`, unavailable rows rendering as not loaded rather than `$0`, and conference grouping preserving loaded/unavailable state truth.

No production code changed for LV-1C because the LV-1A/LV-1B production seam already matched the intended Step 1 feature contract; this pass only added guardrails and updated working docs.

**Files implicated:**

- `src/features/architect/shared/LeagueView/LeagueView.tsx` — primary surface to be protected by guardrails
- `src/features/architect/utils/seasonUtils.ts` — season-boundary import path to be pinned
- `src/features/architect/utils/firebaseTeamPlanHelpers.ts` — read-only source seam to be confirmed structurally
- `src/tests/architect/leagueView.loadingBoundary.behavior.test.tsx` — focused LV-1C closeout guardrails for ownership, season/source truth, load-error visibility, and loaded-vs-fallback behavior

---

## STEP 2 — Canonical Totals Consumption, Display Contract, Sorting, and Navigation Truth

### LV-2-1 — League View labels canonical `totalCapAllocations` as "Total Salary" in the visible conference table, misrepresenting what value is actually being shown

**Status:** RESOLVED
**Substep:** LV-2A

**Problem:**
`leagueViewModel.ts` consumes `computeTeamCapTotals(capSheet, season.endYear)` and reads `capTotals.totalCapAllocations` as the displayed per-team league summary number. `LeagueViewTruthPanel.tsx` correctly names that boundary as `computeTeamCapTotals totalCapAllocations`. But `LeagueConferenceTable.tsx` still labels the same value as `Total Salary` in the visible column header. `totalCapAllocations` is not raw salary — it is a canonical aggregate that includes player totals, dead money, cap holds, and incomplete roster charges. The feature is therefore precise about what it shows in one place (the truth panel) and softer in another (the table header visible to users). That split-brain display contract means a user or future developer reading the table alone cannot tell whether the column reflects raw salary figures or broader cap-allocation truth.

**Resolution:**
League View now names the displayed value as `Total Cap Allocations` in both the truth panel and the conference table. The shaped row field was renamed from `totalSalary` to `totalCapAllocations`, and loaded summaries still read directly from `computeTeamCapTotals(...).totalCapAllocations`. No totals-engine, contract-year, or cap-sheet calculation behavior changed.

**Files implicated:**

- `src/features/architect/shared/LeagueView/LeagueConferenceTable.tsx` — column header now reads `Total Cap Allocations`
- `src/features/architect/shared/LeagueView/LeagueViewTruthPanel.tsx` — truth panel now presents `Total Cap Allocations` with the `computeTeamCapTotals totalCapAllocations` boundary
- `src/features/architect/shared/LeagueView/leagueViewModel.ts` — sources `capTotals.totalCapAllocations` into the `totalCapAllocations` summary field

---

### LV-2-2 — Conference grouping, sorting, and team-navigation handoff are structurally valid but still too implicit as honest consumer behavior

**Status:** RESOLVED
**Substep:** LV-2B

**Problem:**
`groupLeagueTeamSummaries(...)` splits rows by conference and alphabetizes within each conference. The transforms are simple and do not recompute or normalize totals. The `Manage Team` route push sends the user to `/gm/${teamSlug}` and `GMDashboard.tsx` takes ownership of team-level season state once the user arrives. These seams are structurally valid. But the consumer behavior is still softer than ideal: the grouping/sorting contract is not explicitly declared as consumer-only, so it is not immediately obvious from the source that it is forbidden from recomputing or reshaping totals; and the `Manage Team` navigation handoff does not explicitly state what season truth is or is not carried forward — the session may align in practice, but the contract at the navigation seam itself is implicit rather than enforced. Future contributors cannot easily tell from reading the handoff that season continuity is re-owned by the destination surface rather than passed through as a route param.

**Resolution:**
Conference grouping and sorting now read explicitly as presentation-only transforms: shaped summaries are split by conference and alphabetized without recomputing or normalizing totals. The truth panel states that grouping and alphabetical order do not recompute totals. The `Manage Team` handoff remains a route-only team identity handoff to `/gm/:teamId`; the League View button exposes the boundary in its title/accessible label, `LeagueView.tsx` documents the route seam, and `GMDashboard.tsx` documents that it owns selected season state after entry. No dashboard routing or wider season-state model was redesigned.

**Files implicated:**

- `src/features/architect/shared/LeagueView/leagueViewModel.ts` — presentation-only conference grouping/sorting helper
- `src/features/architect/shared/LeagueView/useLeagueTeamSummaries.ts` — async seam consuming grouped summaries
- `src/features/architect/shared/LeagueView/LeagueViewTruthPanel.tsx` — visible grouping/sorting and handoff boundary text
- `src/features/architect/shared/LeagueView/LeagueConferenceTable.tsx` — `Manage Team` accessible/title handoff boundary
- `src/features/architect/shared/LeagueView/LeagueView.tsx` — route-only team handoff
- `src/features/architect/GMDashboard/GMDashboard.tsx` — destination route-entry note that selected season state is dashboard-owned

---

### LV-2-3 — No focused guardrails exist to protect display-contract label honesty, consumer-only presentation boundaries, or team-handoff season transparency

**Status:** RESOLVED
**Substep:** LV-2C

**Problem:**
Step 2 tightens the visible totals label and the grouping/sorting/navigation contract, but none of those improvements are pinned by structural guardrails. Visible totals labels could silently re-soften while canonical totals consumption stays correct; grouping and sorting transforms could widen into more opinionated or less transparent presentation behavior without any loud failure; and the team-navigation handoff could become less honest about season continuity without any direct test catching the drift. League View is a compact surface, which means soft consumer-display choices accumulate quickly and can shape the whole user-facing truth story before a broader pass catches them. Without focused guardrails around display-contract label honesty, transparent consumer-boundary behavior, and team-handoff honesty, the Step 2 improvements made by LV-2A and LV-2B remain discipline-dependent rather than structurally enforced.

**Resolution:**
The focused League View loading-boundary behavior test now includes a dedicated Step 2 closeout guardrail sweep. Display-contract guardrails pin the `Total Cap Allocations` label, the `computeTeamCapTotals totalCapAllocations` truth-panel boundary, loaded row display from `computeTeamCapTotals(...).totalCapAllocations`, and unavailable rows staying `null` / `Not loaded` rather than `$0`. Consumer-boundary guardrails pin `groupLeagueTeamSummaries(...)` as a presentation-only split/order transform that filters by conference, alphabetizes by `teamName`, does not recompute or reshape totals, and preserves loaded/unavailable object truth. Team-handoff guardrails pin `Manage Team` as `/gm/:teamId` route identity only, with no route-season or navigation-state payload, while `GMDashboard.tsx` continues to own selected season state after route entry.

**Files implicated:**

- `src/features/architect/shared/LeagueView/LeagueConferenceTable.tsx` — display-contract label and `Manage Team` handoff label now guarded
- `src/features/architect/shared/LeagueView/useLeagueTeamSummaries.ts` — consumer-only grouping/sorting boundary now guarded
- `src/features/architect/shared/LeagueView/LeagueView.tsx` — route-only team handoff now guarded
- `src/features/architect/GMDashboard/GMDashboard.tsx` — dashboard-owned selected-season entry contract now guarded
- `src/tests/architect/leagueView.loadingBoundary.behavior.test.tsx` — dedicated LV-2C closeout guardrail sweep
