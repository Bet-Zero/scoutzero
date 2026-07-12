# Architect V1 — Real-Product Acceptance Battery (BZE-246)

Durable record of the acceptance battery for the Architect V1 completion contract
(BZE-243). Run against **merged `main` `3185b915`** with every confirmed gap-ledger
blocker closed (BZE-245, 247–252 all Done + merged). The battery is the architect
end-to-end suite under `tests/e2e/` (review mode: emulator + seeded world at
1280×720), anchored by the `D-MQ` manual-QA checklist in
`tests/e2e/architect-qa.spec.ts`.

Status: **In Progress — the battery does NOT pass on current `main` as authored, and
the dominant cause is stale-value test drift, not the environment.** Two sessions ran
this on 2026-07-12. Session 2 fixed three stale owner-facing-chrome assertions and
concluded the heavy scenarios were environment/OOM-blocked. Session 3 (below) found
the supposed "hard env blocker" was really **Vite's cold module compile exceeding the
default 60 s per-test timeout** — with `--timeout=180000` the heavy scenarios run fine
on this machine (D-MQ-001/004C/008/010 and roster-counts all executed to the app and
past init). What they then hit is a **larger, separate drift class**: hardcoded
seed-dependent expectations (dead-cap seasons, cap-dollar amounts, roster sub-counts)
authored against an older seeded world and now stale against current main's advanced
seed (world-season 2026-27; BZE-241 two-way separation; BZE-252 rosters). See
"Session 3 findings". Consequence: **a CI run will not be clean** — the suite needs
source-verified re-baselining before BZE-246/BZE-243 can close.

## Session 2 findings (2026-07-12) — stale-test corrections

The prior record listed D-MQ-001 and D-MQ-005 as "env-flake" (captured page state
"Signing in…" / "Loading…"). With a healthy harness this session, the app **fully
loaded** for D-MQ-001 — and the test still failed, on a **real, stale assertion**,
not a flake. Root cause: several D-MQ tests pinned engineer/internal chrome that
owner-facing review surfaces now deliberately hide. These are landed, owner-approved
product decisions; the tests were left stale (the review-mode e2e never completed in
intervening sessions, so the mismatch went unseen).

| Test | Stale assertion | Deliberate product change | Correction | Verified |
| --- | --- | --- | --- |
| D-MQ-001 | `firebase-target-mode-badge` visible | `ModePill` returns `null` on review surfaces (BZE-239; Visual Standard §10) — the EMULATOR/PROD badge is engineer chrome banned from owner-facing builds | Surface-aware: assert the badge on dev/prod, assert it is *suppressed* on the owner-facing review surface | ✅ **green live** |
| D-MQ-010 | `firebase-target-mode-badge` visible (as a "dashboard loaded" check) | same BZE-239 suppression | Re-anchored the sanity check on the `GM Dashboard` header heading | ✅ **green live** |
| D-MQ-008 | history banner `toContainText(worldId)` | banner shows GM copy, never a raw world id (BZE-209 boundary) | Assert the `data-history-world-id` attribute instead (source-verified: `TeamHistoryTab.tsx:193-195`) | ⏳ source-verified; live blocked by env |

A static audit of every outstanding test found **no further** stale owner-facing
assertions of this class (no raw-id leakage into visible text, no other dev-only
chrome asserted visible). This de-risks the eventual CI run **for this class only** —
Session 3 found a second, larger drift class the chrome audit did not cover.

## Session 3 findings (2026-07-12) — env is workable; the real blocker is seed-drift

**The environment is not a hard blocker.** The Session 2 "OOM / app never leaves
Loading GM Dashboard" failures were the **default 60 s per-test timeout being
consumed by Vite's cold on-demand module compile** (the whole Architect graph is
transformed on the first `/gm/*` navigation of each fresh harness boot). Re-run with
`--timeout=180000`, one small batch per boot, ports cleared first, and the heavy
scenarios execute to the app and through their workflows. Proof this session:

| Test | Result this session | Note |
| --- | --- | --- |
| D-MQ-001 | ✅ **green live** (`--timeout=180000`) | stale-chrome fix verified |
| D-MQ-008 | ✅ **green live** (`--timeout=180000`) | upgrades the Session 2 "⏳ env-blocked" row — the world-id→attribute fix is now verified live, not just source-verified |
| D-MQ-010 | ✅ **green live** (`--timeout=180000`) | stale-chrome fix verified |
| ARCH-ROSTER-COUNT-001 (roster-counts) | ✅ **green live** after a fix | see drift below |

**The real barrier to a clean battery pass is a second drift class: hardcoded
seed-dependent expectations, stale against the advanced seed.** The suite was
authored against an older review world (world-season 2025-26, pre-BZE-241 roster
sectioning). Current main's seed advanced. The workflows still execute and persist —
only the pinned numbers/seasons/counts drifted. Confirmed live this session:

- **roster-counts** — `data-roster-section-counts` expected `5 / 4 / 4` (two-way
  folded into bench, the pre-BZE-241 behavior). Current main cards two-way players in
  their own group, so standard-bench is `5 / 4 / 3` while the bench **cards** still
  total 4 (3 standard + 1 two-way, both source-verified in
  `RosterVisual.tsx:336-382`). Fixed the section-count string; **kept** bench-card
  count at 4. **Now green.** (A near-miss worth recording: naive "make the number
  match" would have wrongly changed the card count too — every drift value needs
  source verification, not inference.)
- **D-MQ-004C** (waive-and-stretch) — executes and persists (UI shows "Waive-and-
  stretch saved", roster 14→13, Reaves removed). It then fails the **persisted
  dead-cap** poll, which pins seasons `2025-26 / 2026-27 / 2027-28`. The freshly
  seeded world is now at **2026-27**, so the stretch lands on different seasons. No
  product failure observed; the hardcoded seasons are stale. (Not yet re-baselined —
  the correct seasons/amounts must be source-verified, not guessed.)
- **D-MQ-005** (FA signing) — executes and persists (receipt "Free agent signed",
  roster 3→4, persisted team doc contains the signee). It then fails a **hardcoded
  cap-delta magic number** (`-$3,635,655`); the receipt format is intact
  (`postActionHandoff/types.ts:635`), only the seed-dependent dollar amount drifted.
  (Not yet re-baselined.)

**Not re-verified this session** (blocked by the re-baseline effort, not the
environment): D-MQ-004D, D-MQ-005A, D-MQ-005B/005D/005E, roster-fct-parity,
full-cap-table-* . By the pattern above these are expected to be the same
stale-value drift, but each must be run and **source-verified** before it can be
called stale-vs-real — no confirmed product regression has been found, and none may
be assumed away.

**Corrected recommendation:** a plain CI run will surface, not resolve, this drift.
Closing BZE-246 requires **re-baselining the drifted hardcoded expectations against
the current seed, source-verified per assertion**, then a clean live pass. That is a
bounded but genuine follow-up lane, not a rubber-stamp. BZE-243 cannot close until it
is done.

> Concurrent-session note: Sessions 2 and 3 both worked BZE-246 on this shared
> worktree on 2026-07-12 and converged on the same three chrome fixes (Session 2's
> `git add -A` committed Session 3's identical edits in `c13f4486`). Owner should
> ensure only one session drives this to completion.

## Session 4 findings (2026-07-12) — source-verified re-baselining underway

Resumed on the pushed branch after an owner restart, running each outstanding
workflow individually with `--timeout=180000`, one paced batch per clean harness
boot (ports cleared first). Every re-baseline below is **source-verified** against
the seed contract, the applicable rule code, and the persisted world data — not
copied from the screen. **No product/rules/persistence defect found so far.**

- **D-MQ-004C** (waive-and-stretch) ✅ green. Reaves' guaranteed salary is
  2025-26 $14M / 2026-27 $15M / 2027-28 $16M (`review_seed/basePlayers/austin_reaves.json`).
  In a 2026-27 world `allocateStandardWaiverDeadCapBySeason` drops the past 2025-26
  row → remaining $31M; `computeWaiveResult` stretches $31M over 3 years from
  2026-27: 2026-27 $10,333,334 / 2027-28 $10,333,333 / 2028-29 $10,333,333
  (floored, remainder of $1 to year 0). Was `{2025-26,2026-27,2027-28} × $15M`
  (the 2025-26-world $45M/3).
- **D-MQ-004D** (buyout, no stretch) ✅ green. Remaining $31M − $5M buyout = $26M
  dead cap, single lump in 2026-27. Two stale values corrected: the dead-cap poll
  (`{2025-26: $40M}` → `{2026-27: $26M}`) and the event-metadata `deadCapAmount`
  (`$40M` → `$26M`) — same $45M→$31M base shift.
- **D-MQ-005** (league-pool FA signing) ✅ green. The default offer applies a 4-yr
  contract starting $4,800,000 (5% raises). Cap-space delta re-baselined
  `-$3,635,655` → `-$3,442,237`, source-verified against the `signFreeAgent`
  event's before/after BOS cap totals (capSpace $16,125,607 → $12,683,370): the
  delta = first-year salary $4,800,000 − one filled roster slot's incomplete-
  roster charge at the 2026-27 rookie min $1,357,763. The old value used the
  2025-26 rookie min $1,164,345 ($4,800,000 − $1,164,345 = $3,635,655). Cap
  accounting is correct; only the seed's rookie-minimum charge changed.
- **D-MQ-005A** (own-FA re-sign) ✅ green. Persisted data confirms the workflow:
  Grant Holloway converts from a $15M own-FA cap hold to a $12M signed Standard
  contract (Full Bird, 8% raises), the hold is removed, MIA goes 12→13 standard
  (+1 two-way `mia_tobias_lund`), one Holloway record, no ghost hold, reload holds.
  Two deliberate landed changes were re-baselined (no defect): (a) the status
  strip is now `{std} / 15 · {two-way} / 3` (BZE-241 two-way separation), so
  "13/15"→"12/15 · 1/3" before and "14/15"→"13/15 · 1/3" after/reload; (b) Compare
  Additions shows the re-signed player (BZE-218 "re-sign lands under Additions"),
  was "None detected".

## Contract workflows → battery coverage & result

| Contract workflow (BZE-246 scope) | Battery test(s) | Result |
| --- | --- | --- |
| Fresh-world create / reopen / sandbox | D-MQ-001, D-MQ-002, SBX-001 | ✅ D-MQ-001 green live (after stale-badge correction); D-MQ-002 + SBX-001 green live (prior) |
| Successful trade — persist + rehydrate on re-entry | D-MQ-003 | ✅ green live (prior) |
| In-progress draft survives leaving the room (W9) | D-MQ-003B | ✅ green live (prior) |
| Illegal/blocked trade — fail-closed before apply | D-MQ-004 | ✅ green live (prior) |
| Waiver dead cap persists | D-MQ-004B | ✅ green live (prior) |
| Waive & Stretch / Buyout dead cap persists | D-MQ-004C, D-MQ-004D | ✅ **green live** (Session 4, `--timeout=180000`) — both source-verified re-baselined to the 2026-27 world: 004C stretch $31M/3 → 2026-27 $10,333,334 / 2027-28 $10,333,333 / 2028-29 $10,333,333; 004D buyout $31M−$5M = $26M in 2026-27 (dead-cap poll + event `deadCapAmount`). Product correct; only stale hardcoded values changed |
| FA signing — receipt + history + compare + reload | D-MQ-005 | ✅ **green live** (Session 4) — cap-delta re-baselined `-$3,635,655` → `-$3,442,237`, source-verified from the event before/after cap totals (= $4.8M offer − 2026-27 rookie-min $1,357,763 incomplete-roster charge). Product correct |
| Own-FA re-sign — FCT/Roster/history/compare/reload | D-MQ-005A | ✅ **green live** (Session 4) — $15M own-FA hold → $12M signed Standard (Full Bird), hold removed, roster 12→13 standard, reload holds. Re-baselined the status strip to the BZE-241 two-way format ("13/15"→"12/15 · 1/3", "14/15"→"13/15 · 1/3") and Compare Additions to show the re-signed player (BZE-218). Product correct |
| RFA offer sheet — pending / decline / match (48h) | D-MQ-005B, D-MQ-005D, D-MQ-005E | ⏳ env-blocked this session |
| Sign-and-trade from FCT own-FA — hard-cap + rehydrate | D-MQ-005C | ✅ green live (prior) |
| Sign-and-trade starts from Free Agency room — hard-cap | D-MQ-005F | ✅ green live (prior) |
| Offseason room excluded from V1 nav (+ deep-link fallback) | D-MQ-006 | ✅ green live (prior) |
| Season Advance opens (world-aware gating) | D-MQ-007 | ✅ green live (prior) |
| Season advance — apply 2026-27→2027-28 + reload, decline preserved | architect-season-advance | ✅ green live (prior) |
| Draft positions — save + reload from committed world state | architect-season-advance | ✅ green live (prior) |
| Team History rehydrates persisted world events | D-MQ-008 | ✅ **green live** (Session 3, `--timeout=180000`) — world-id→`data-history-world-id` fix now verified live |
| Entitlement authoring saves + blocks conflicting claim (admin, flag on) | D-MQ-009 | ✅ green live (prior) |
| No entitlement/pick authoring in owner-facing view (flag off) | D-MQ-009B | ✅ green live (prior) |
| Base-write deny evidence paired with rules proof | D-MQ-010 | ✅ green live (after stale-badge correction) |
| Acceptance-grade world — battery team 15 / 15 · 3 / 3 | architect-full-rosters | ✅ green live (prior) |
| Cross-room agreement / FCT parity / roster counts | roster-fct-parity, roster-counts, full-cap-table-* | roster-counts ✅ **green live** (Session 3, after a source-verified `5/4/4→5/4/3` section-count fix per BZE-241); roster-fct-parity + full-cap-table-* not re-verified (same drift class suspected, not env-blocked) |

## Deliberate exclusions (owner-approved, in contract)

- Offseason room hidden from V1 navigation; season advance relocated to the World
  menu (BZE-250) — verified by D-MQ-006 + D-MQ-007 + architect-season-advance.
- Entitlement/pick authoring hidden from owner-facing GM builds (BZE-251) —
  verified by D-MQ-009B (off) with the admin path retained under an explicit flag
  (D-MQ-009).
- Draft-night workflow parked (post-V1).

## Non-e2e validation (merged `main` `3185b915`)

- `typecheck` clean · `test:architect` 3555 · `test:trade` 635 · `test:ui` 1179 ·
  architect cast gate at baseline. All green. (These prove the engine + UI logic for
  the env-blocked workflows above; they do not substitute for the required live
  browser proof.)

## Environment (blocker for the heavy live scenarios)

This machine cannot reliably run the memory-heavy e2e scenarios. It is actively used
for other work (VS Code ~1.2 GB, Firefox, multiple Claude sessions, Python) on a
~8 GB box; **free memory oscillates between ~15 MB and ~1 GB** and collapses to
~15–40 MB the moment the review harness (Firebase emulator + Vite dev + esbuild +
Chromium + the app) loads. Observed, reproducible failure modes this session, all
under memory exhaustion, none a product assertion:

- **`GM Dashboard should leave the loading state` — 30 s timeout.** The app never
  finishes initializing (the exact "Loading GM Dashboard…" symptom from the prior
  session). Signature of D-MQ-004C/D, roster-counts.
- **`[WebServer] The service is no longer running: write EPIPE`.** The Vite dev /
  esbuild service dies mid-run. Signature of the isolated D-MQ-005 re-run.
- **60 s attribute-wait timeouts** on read-only parity specs — the data panel never
  renders.

Levers tried and ruled out:

- **`purge`** (reclaim the ~2.2 GB "inactive" pages): denied — needs root.
- **Back-to-back small batches** (isolated Playwright invocations): back-fired —
  boots faster than macOS reclaims, spiraling free memory to ~15 MB and cascading
  env failures. A single-invocation full run OOMs the worker the same way.
- **Lightweight `vite preview` harness** (build once, drop the esbuild dev service):
  ruled out — a production build sets `import.meta.env.DEV=false`, and the D-MQ dev
  fixtures (`hz.dev.capSheetFixtures`, `hz.dev.teamHistoryFixtures`) are DEV-gated
  (`CapSheetSection.tsx:122`, `TeamHistoryTab.tsx:153`, `OffseasonSection.tsx:331`),
  so a preview build would silently drop fixtures and **false-fail** D-MQ-004C/D and
  D-MQ-008. Not a valid substitute for the canonical dev review harness.

No process leak on the harness side (it tears down cleanly when it exits normally;
only hard crashes orphan the emulator/Vite, which were reclaimed this session).

> **Superseded by Session 3.** The memory pressure above is real but was *not* the
> blocker it appeared to be — the failing signature ("app never leaves Loading GM
> Dashboard") was Vite's cold compile exceeding the default 60 s per-test timeout,
> which `--timeout=180000` resolves (see "Session 3 findings"). The heavy scenarios
> run here; they fail on stale seed-dependent expectations, which a CI run would
> surface rather than resolve.

**Recommendation (corrected, Session 3):** do **not** treat this as "just needs a CI
run." Closing BZE-246 requires **re-baselining the drifted hardcoded expectations
against the current seed, source-verified per assertion** (dead-cap seasons,
cap-dollar amounts, roster sub-counts across D-MQ-004C/004D/005/005A/005B/005D/005E,
roster-fct-parity, full-cap-table-*), then a clean live pass with the higher
per-test timeout. Verified green so far (current main + the committed corrections):
D-MQ-001, D-MQ-008, D-MQ-010, roster-counts. No confirmed product regression has been
found — the workflows execute and persist — but the battery does not yet pass, so
BZE-243 stays open.
