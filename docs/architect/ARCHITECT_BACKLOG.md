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
| TEST-002 | Testing | Tech-debt | HIGH | The `architect-qa` e2e was **rotted against the cockpit refactor** (waited for old `#world-selector`; world controls moved to `cockpit/WorldMenu.tsx` popover; nav is `role="tab"` not `button`). 🔧 Fixed the selector rot: `openDashboardTab` → `role=tab`; added resilient `openWorldMenu`/`openWorldMenuFor`/`closeWorldMenu`; rewired the world helpers. **Now green: D-MQ-004 (trade validation fail-closed), D-MQ-006 (offseason preview), smoke (dashboard, full cap table)**; worlds create/select correctly. **Still failing: D-MQ-002/003/007 (+008)** — root-caused (below), not a selector issue. ✅ **DONE** — fully resolved by TEST-003: the whole `architect-qa` suite is **13/13 green**. The remaining post-cockpit rot (trade-card "Plyr (N)" label + dual layouts + dialog scoping + auto-included current team, renamed re-entry link + Trade Machine overlay close, smoke "Full Cap Table" region) was repaired alongside the world-seeding work. | DONE |
| TEST-003 | Testing | Tech-debt | MED | **e2e flakiness on the automated create-world marathon** (D-MQ-002/003/007/008). ✅ **DONE** — full `architect-qa` suite is now **13/13 green** in review mode. Root unknown resolved: worlds are owner-scoped (`listUserWorlds` filters `createdBy == uid`) and review mode signs in anonymously with a *dynamic uid*, and `architect_worlds` **can't be listed** at all under the security rules (`isWorldOwner` gates on the `{worldId}` path wildcard, which Firestore only binds for single-doc `get`, not `list`). So a static boot-seed is invisible. **Fix (Option C, test-only):** `ensureWorldSelected` reads the live anon uid from Firebase auth IndexedDB, admin-seeds a world owned by it (with `asOfDate`), and activates it via the app's own localStorage rehydration path (single-doc `get`, which rules allow) — no app/auth/rules changes. Fixing 003/008/005/009 also required repairing **post-cockpit selector rot** newly exposed once worlds worked (see TEST-002): trade-card "Plyr (N)" label + dual wide/compact layouts + dialog scoping + auto-included current team; renamed cockpit re-entry link; smoke "Full Cap Table" region; and an offer-sheet RFA home-team world snapshot. **Also fixed a real product bug** → see ENG-004. | DONE |
| ENG-004 | Cap mutation | Bug | HIGH | **Offer sheets could never be stored.** `computeNormalizedWorldMutation`'s `storeOfferSheet` case called `computeStoreOfferSheetResult` *without threading the top-level `worldId` into the payload* (unlike the sibling `signAndTrade` case), and `computeStoreOfferSheetResult` requires `payload.worldId` for its dedup identity — so both the offer-sheet **preflight** (button stuck "Authoritative Preflight Pending"→"Preflight Blocked") and the **commit** ("Save state: Error — worldId is required for offer sheet identity") failed closed. Surfaced by D-MQ-005 once world-seeding worked. ✅ Fixed in `mutationPipeline.normalize.ts` (thread `args.payload?.worldId ?? worldId`). | DONE |

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
| TM-001 | Trade Machine | UX/Polish | LOW | "Development Tools · testing & debug" panel still renders in the Trade Machine. Recent commits stripped dev-mode labels; confirm this panel should be hidden in the user-facing build. ✅ **DONE — not a bug.** Verified: the whole panel is gated by `debugEnabled = import.meta.env.DEV \|\| hasRuntimeDebugFlag()` (`ValidationDetailsPanel.tsx:225`). `import.meta.env.DEV` is **false in a production build**, so users never see it. It appeared in the Pass-1 walkthrough only because **review mode runs the Vite dev server** (= DEV), which is expected. No code change needed. | DONE |
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

## TEST-003 — RESOLVED (architect-qa now 13/13 green in review mode)

See the TEST-003 + ENG-004 rows above for the full write-up. Summary of how it
landed, for the next reader:

**The real unknown, resolved:** worlds are owner-scoped and `architect_worlds`
cannot be *listed* under the security rules at all (the `isWorldOwner` read rule
calls `get(.../{worldId})`, and the `{worldId}` path wildcard is only bound for
single-doc `get`, never for `list`). Review mode signs in anonymously with a
dynamic per-session uid, so neither a static boot-seed nor the dropdown list is
viable. The app itself never relies on the list — it rehydrates the active world
from `localStorage` via a single-doc `get` (which the rules allow).

**Fix shape (Option C, test-only):** `ensureWorldSelected` now reads the live
anon uid from Firebase auth IndexedDB, admin-seeds a world owned by it (with an
`asOfDate` so the world is genuinely ready), writes the active-world localStorage
key the way the app does, and reloads so `useArchitectState` restores it. No
app/auth/rules/seed-script changes were needed for the world plumbing.

**Collateral fixes** (post-cockpit selector rot newly exposed once worlds
worked, all in `tests/e2e/architect-qa.spec.ts`): trade-card "Plyr (N)" label,
dual wide/compact player-row layouts, dialog scoping, the auto-included current
team, the renamed cockpit re-entry link + Trade Machine overlay close, the smoke
"Full Cap Table" region rename, and an offer-sheet RFA home-team world snapshot.

**One real product bug** found and fixed in app source — see **ENG-004**
(offer-sheet `worldId` never threaded into the store-offer-sheet compute).

**Validate:** `PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true npx playwright test
tests/e2e/architect-qa.spec.ts --reporter=line` → 13 passed.

**Watch-outs (still true):** the D-MQ block is `mode: 'serial'` (one early
failure cascades into "did not run"); review-mode boot is ~3–4 min per run, so
iterate with `--grep`; zsh does **not** word-split unquoted `$vars`.
