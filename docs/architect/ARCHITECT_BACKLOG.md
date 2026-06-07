# Architect Backlog — single living list of what's left

**This is the one place to track unfinished Architect work.** It replaces the
scattered stage reports and the empty `audits/TM_GAPS_BACKLOG_V1.md` template.
If you notice something rough, add a row — even just "this felt wrong in X."

## How to use

- One row per item. Both "missing feature" and "bug" are valid.
- Don't know repro steps? Just describe what felt off. Naming it is enough.
- Keep `Status` current. When something ships, mark it DONE (don't delete — it's the record).

**Type:** `Bug` · `Missing` · `UX/Polish` · `Data` · `Tech-debt`
**Severity:** `HIGH` (wrong/blocks use) · `MED` (rough but usable) · `LOW` (nice-to-have)
**Status:** `OPEN` · `IN PROGRESS` · `DONE` · `WON'T DO`

---

## Verified baseline (what's already solid)

So the backlog stays honest about what's *done*, not just what's left:

- **Trade Machine** — full audit complete (`audits/TM_GAPS_TRIAGE_V1.md`, Feb 2026): 19 gaps, all fixed or scoped out of v1. Salary matching, hard caps/aprons, picks/entitlements, BYC/poison pill all verified.
- **Operating experience (Stages 1–6)** — shipped May 2026 (activity rail, action continuity, scenario comparison, Front Office Guide, polish). Conditionally ship-ready; see archived `stage_discovery_may2026/`.
- **Architect engine code** — clean: only 2 forward-looking TODOs in source (below).
- **Team cap data pipeline** — dead cap now scraped/staged/served league-wide; current-roster player IDs resolve (June 2026, this branch).

---

## Open items (seeded — desk findings)

| ID | Area | Type | Sev | Item | Status |
|----|------|------|-----|------|--------|
| ENG-001 | Cap rules | Tech-debt | LOW | `maxSalaryRules.ts:314` — max-salary tier can't check award eligibility (2nd/3rd Apron supermax) until awards are added to `RuleContext`. | OPEN |
| ENG-002 | Cap rules | Tech-debt | LOW | `birdRightsRules.ts:175` — should require `salaryCap` and error if missing (currently lenient). | OPEN |
| DATA-001 | Cap data | Data | LOW | Departed/historical players in cap holds & dead cap resolve to `tmp_` IDs (no DB link). Expected for gone players; revisit only if their names need to link. | OPEN |
| DATA-002 | Cap data | Tech-debt | LOW | `deadCapTotal` summary scalar isn't persisted to staged totals (Architect recomputes `deadMoneyTotal` from line items, so cosmetic only). | OPEN |
| DATA-003 | Cap data | Data | MED | League cap/apron/tax are hand-typed constants (`capProjections.ts`); 2026-27 still projected — NBA sets official ~July 1. Update when released. | OPEN |
| ENG-003 | Schema | Tech-debt | LOW | `BaseTeamDocZ` doesn't yet include ledger-derived fields (`draftPicksInventory/Obligations/Contested`, `draftAssets`); stripped before validation (`stage_team.ts:1174`). | OPEN |
| TEST-001 | Testing | Tech-debt | MED | Broad-Architect test debt predating Next Era (closure gates, migration-phase guardrails, one mock-gap test) — flagged in Stage 6 ship audit as "track separately." Audit + close. | OPEN |
| TEST-002 | Testing | Tech-debt | HIGH | The `architect-qa` e2e was **rotted against the cockpit refactor** (waited for old `#world-selector`; world controls moved to `cockpit/WorldMenu.tsx` popover; nav is `role="tab"` not `button`). 🔧 Fixed the selector rot: `openDashboardTab` → `role=tab`; added resilient `openWorldMenu`/`openWorldMenuFor`/`closeWorldMenu`; rewired the world helpers. **Now green: D-MQ-004 (trade validation fail-closed), D-MQ-006 (offseason preview), smoke (dashboard, full cap table)**; worlds create/select correctly. **Still failing: D-MQ-002/003/007 (+008)** — root-caused (below), not a selector issue. | OPEN |
| TEST-003 | Testing | Tech-debt | MED | **e2e flakiness on the automated create-world marathon** (D-MQ-002/003/007/008). Manually verified the world-menu popover is **stable for a real user** and world-time controls are reachable (so *not* a product bug). The instability is specific to the tests: `seedReviewData` seeds **no world**, so each world test must create one mid-flow via the popover; the worlds list loads slowly ("Loading worlds…") and creating a world re-renders the TopBar, transiently closing the popover the test is mid-asserting. Fix options: seed a ready world in review mode (fastest, most robust), or make the world helpers settle on "worlds loaded" + re-open after creation. | OPEN |

---

## Open items (live-app walkthrough)

> Pass 1 (June 2026): drove review mode (`architect:review:up`) through every nav
> area for team LAL. **Caveat:** review mode seeds minimal synthetic data (3
> players, no committed world), so most empty states are seed-thinness, not
> product gaps — and the real *mutation* workflows (sign, execute trade,
> advance season, draft) are world-gated and were **not** exercised. Those need
> a Pass 2 against a committed world with full data.

**What's solid (rendered clean, no errors, feels complete):** Dashboard cap
table (multi-year + cap-posture rail), Cap Sheet (current-season alignment
banner, OFFICIAL badge), Dead Money modal (manual ledger override), Trade
Machine (cap posture, TPEs, allowable-incoming, players/picks/exceptions tabs,
validate/apply), Roster cards, Team History (structured sections w/ graceful
fallback), Front Office Guide (Q&A cards).

| ID | Area | Type | Sev | Item | Status |
|----|------|------|-----|------|--------|
| UI-001 | Roster/FA/Lists/Ranker | Bug | MED | Fallback headshot `/assets/headshots/default.png` was **missing** (404). The `onError` handlers reset `src` to it, which 404'd and re-fired `onError` → infinite loop: ~1000 requests in seconds on the Free Agency screen. ✅ Fixed: added a silhouette `default.png` + `onerror = null` guard at all 16 handler sites. Verified: 404s on FA dropped ~1140 → 1. | DONE |
| TM-001 | Trade Machine | UX/Polish | LOW | "Development Tools · testing & debug" panel still renders in the Trade Machine. Recent commits stripped dev-mode labels; confirm this panel should be hidden in the user-facing build. | OPEN |
| SBX-001 | Offseason / Compare | UX | MED | In Sandbox (no world), Offseason (Advance Season, draft positions) and Compare are fully gated to "select a world" with no in-screen way to create/pick one — feels like a dead end. Add a path to create/select a world from these screens. | OPEN |
| UX-001 | Dashboard | UX/Polish | LOW | Large empty canvas below the cap table with a small roster. Verify with a full 15-man roster; if still sparse, consider filling the space. | OPEN |

### Pass 2 attempt (June 2026) — blocked by harness rot

Ran the `architect-qa` e2e suite (the existing functional sweep for these
flows). Result: **2 passed, 3 failed, 8 did not run.** The failures are
harness rot, not product bugs — the suite targets the pre-cockpit UI (see
TEST-002). The app itself drives healthy (dashboard + cap sheet render, no
console errors). **Net: the core mutation flows are still unverified** — the
suite meant to verify them skipped them. Restoring that suite (TEST-002) is
the prerequisite to a real Pass 2, and doubles as the regression net for the
UI overhaul. Flows still needing verification:

- Sign Free Agent flow end-to-end (offer sheets are world-gated)
- Trade Machine validate/apply with a second team + multi-team coherence
- Season advancement (process all 30 teams, expiring contracts, options)
- Draft positions / draft flow
- Activity Rail populated with real committed world events; History deep-links
- Scenario Compare with actual committed scenarios
- Dead cap / cap holds rendering with the real scraped data we just shipped

---

## Next-session kickoff — TEST-003 (seed a world in review mode)

**Goal:** make the `architect-qa` e2e world tests pass by seeding a ready-to-use
world in review mode, so the tests **select** an existing world instead of
**creating** one each run.

**Why (current state):** The cockpit selector rot is already fixed (commits up
to `3170cd76`). Green now: D-MQ-001, **D-MQ-004** (trade validation fail-closed),
**D-MQ-006** (offseason preview), both smoke tests. World create/select works,
and the world-menu popover + world-time controls are verified healthy *by hand*
(not a product bug). The remaining failures — **D-MQ-002 / 003 / 007 / 008** —
are purely because `scripts/emu/seedReviewData.ts` seeds teams/players/
entitlements but **no world**. So each world test runs the slow, flaky
create-world flow ("Loading worlds… → + New → Create → wait for persistence")
which dominates / blows the test budget.

**First thing to resolve (the real unknown):** how review-mode auth scopes
worlds. Worlds live in the top-level `architect_worlds/{worldId}` collection
(see how the e2e reads them: `getReviewAdminDb().collection('architect_worlds')`,
and how `ensureWorldSelected` creates them in `tests/e2e/architect-qa.spec.ts`).
Review mode signs in **anonymously**, so the userId is dynamic per session — find
out whether the world list (`#world-selector`, the WorldSelector component) is
filtered by owner/userId. If it is, a statically seeded world must be made
visible to that anon user (or the filter relaxed in review mode). **Resolve this
before writing seed code** — it determines whether seeding is even viable as-is.

**Files:**
- `scripts/emu/seedReviewData.ts` (+ `scripts/emu/review_seed/`) — add the world
- `scripts/emu/runReviewMode.ts` — launcher (`npm run architect:review:up`)
- `tests/e2e/architect-qa.spec.ts` — `ensureWorldSelected` (mimic its create
  payload to shape the seed), `readActiveWorldId`; if a world is pre-seeded the
  helper can select-first instead of create
- world doc schema: search `architect_worlds` writes in `src/features/architect`

**Validate:** `PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true npx playwright test
tests/e2e/architect-qa.spec.ts --reporter=line` → target all 13 green.

**Watch-outs:**
- D-MQ block is `mode: 'serial'` — one early failure cascades into "did not run".
- Review-mode boot is ~3–4 min per run; iterate with `--grep` on one test.
- zsh does **not** word-split unquoted `$vars` (see [[team-publish-workflow]]).
