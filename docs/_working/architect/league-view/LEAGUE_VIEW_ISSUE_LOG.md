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

**Status:** OPEN
**Substep:** LV-1C

**Problem:**
League View is currently compact — the whole feature contract lives in one file — which means top-level drift can affect the full feature quickly without any loud failure. The shell-as-thin-consumer behavior improved by LV-1A, the season/source boundary truth improved by LV-1B, and the loaded-vs-fallback distinction are all seams that depend on continued discipline inside `LeagueView.tsx` rather than on structural enforcement. There are no focused tests or source guardrails that pin: the feature shell staying thin rather than accumulating further inline responsibilities; season sourcing remaining grounded rather than drifting through compatibility re-export paths; load failures being marked explicitly rather than flattening into zero-value rows; or fallback/degraded rows being distinguishable from loaded league truth. Without guardrails, a future shell widening, season-source drift, or fallback-handling regression can occur while canonical totals consumption remains intact — leaving a feature that appears functionally correct but tells a softer top-level truth story.

**Resolution:**
Not resolved.

LEAGUE_VIEW_1A_1B added one focused behavior/source-boundary test to validate the changed LV-1A/LV-1B seam, but this was not the full LV-1C guardrail pass. LV-1C remains open for a dedicated guardrail review that pins broader top-level ownership drift, season-boundary signaling, source/read-only expectations, and loaded-vs-fallback truth beyond the execution slice changed here.

**Files implicated:**

- `src/features/architect/shared/LeagueView/LeagueView.tsx` — primary surface to be protected by guardrails
- `src/features/architect/utils/seasonUtils.ts` — season-boundary import path to be pinned
- `src/features/architect/utils/firebaseTeamPlanHelpers.ts` — read-only source seam to be confirmed structurally
- `src/tests/architect/leagueView.loadingBoundary.behavior.test.tsx` — partial LV-1A/LV-1B seam behavior coverage added during execution; not a full LV-1C closeout
