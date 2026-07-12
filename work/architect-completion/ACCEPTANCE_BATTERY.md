# Architect V1 — Real-Product Acceptance Battery (BZE-246)

Durable record of the acceptance battery for the Architect V1 completion contract
(BZE-243). Run against **merged `main` `3185b915`** with every confirmed gap-ledger
blocker closed (BZE-245, 247–252 all Done + merged). The battery is the architect
end-to-end suite under `tests/e2e/` (review mode: emulator + seeded world at
1280×720), anchored by the `D-MQ` manual-QA checklist in
`tests/e2e/architect-qa.spec.ts`.

Status: **In Progress — blocked on a healthy environment for the heavy scenarios.**
Session 2 (2026-07-12) reclaimed the environment, proved the harness healthy at low
load, and **fixed three stale test assertions** that were pinning owner-facing chrome
the product deliberately removed (see "Session 2 findings"). The heavier live
scenarios still cannot complete on this machine: the local review harness OOMs
(Vite dev service crashes / app never leaves "Loading GM Dashboard") whenever free
memory collapses under the harness + browser working set. See "Environment".

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
chrome asserted visible). This de-risks the eventual CI run.

## Contract workflows → battery coverage & result

| Contract workflow (BZE-246 scope) | Battery test(s) | Result |
| --- | --- | --- |
| Fresh-world create / reopen / sandbox | D-MQ-001, D-MQ-002, SBX-001 | ✅ D-MQ-001 green live (after stale-badge correction); D-MQ-002 + SBX-001 green live (prior) |
| Successful trade — persist + rehydrate on re-entry | D-MQ-003 | ✅ green live (prior) |
| In-progress draft survives leaving the room (W9) | D-MQ-003B | ✅ green live (prior) |
| Illegal/blocked trade — fail-closed before apply | D-MQ-004 | ✅ green live (prior) |
| Waiver dead cap persists | D-MQ-004B | ✅ green live (prior) |
| Waive & Stretch / Buyout dead cap persists | D-MQ-004C, D-MQ-004D | ⏳ env-blocked this session (app OOM on "Loading GM Dashboard") — not a product failure |
| FA signing — receipt + history + compare + reload | D-MQ-005 | ⏳ env-blocked this session (Vite dev service crash / OOM). One degraded run reached the cap-delta assertion (flow executed through receipt + roster-count + persisted doc), i.e. no product failure observed — but **no clean pass captured** |
| Own-FA re-sign — FCT/Roster/history/compare/reload | D-MQ-005A | ⏳ env-blocked this session |
| RFA offer sheet — pending / decline / match (48h) | D-MQ-005B, D-MQ-005D, D-MQ-005E | ⏳ env-blocked this session |
| Sign-and-trade from FCT own-FA — hard-cap + rehydrate | D-MQ-005C | ✅ green live (prior) |
| Sign-and-trade starts from Free Agency room — hard-cap | D-MQ-005F | ✅ green live (prior) |
| Offseason room excluded from V1 nav (+ deep-link fallback) | D-MQ-006 | ✅ green live (prior) |
| Season Advance opens (world-aware gating) | D-MQ-007 | ✅ green live (prior) |
| Season advance — apply 2026-27→2027-28 + reload, decline preserved | architect-season-advance | ✅ green live (prior) |
| Draft positions — save + reload from committed world state | architect-season-advance | ✅ green live (prior) |
| Team History rehydrates persisted world events | D-MQ-008 | ⏳ stale assertion corrected (source-verified); live env-blocked this session |
| Entitlement authoring saves + blocks conflicting claim (admin, flag on) | D-MQ-009 | ✅ green live (prior) |
| No entitlement/pick authoring in owner-facing view (flag off) | D-MQ-009B | ✅ green live (prior) |
| Base-write deny evidence paired with rules proof | D-MQ-010 | ✅ green live (after stale-badge correction) |
| Acceptance-grade world — battery team 15 / 15 · 3 / 3 | architect-full-rosters | ✅ green live (prior) |
| Cross-room agreement / FCT parity / roster counts | roster-fct-parity, roster-counts, full-cap-table-* | ⏳ env-blocked this session (60s attribute-wait timeout — panel never rendered under memory pressure) |

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

**Recommendation (unchanged, now de-risked):** run the full
`tests/e2e/architect-*.spec.ts` suite in CI or on a fresh machine to capture the
single green pass required to close BZE-246. The code under test is on `main`; the
three stale-test corrections on `feature/bze-246-acceptance-battery` remove the only
false-failure class the audit found, so the CI run should be clean. The two
scenarios the handoff flagged as unproven are resolved as far as this environment
allows: **D-MQ-001 is now genuinely green (it was a real stale test, not a flake);
D-MQ-005 shows no product failure but has no clean local pass.**
