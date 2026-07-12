# Architect V1 — Real-Product Acceptance Battery (BZE-246)

Durable record of the acceptance battery for the Architect V1 completion contract
(BZE-243). Run against **merged `main` `3185b915`** with every confirmed gap-ledger
blocker closed (BZE-245, 247–252 all Done + merged). The battery is the architect
end-to-end suite under `tests/e2e/` (review mode: emulator + seeded world at
1280×720), anchored by the `D-MQ` manual-QA checklist in
`tests/e2e/architect-qa.spec.ts`.

Status: **In Progress.** The workflows below are proven green live this session;
a single clean full-suite pass is blocked by local environment exhaustion (see
"Environment" — the review harness OOMs mid-run on this machine). The remaining
workflows are pinned e2e that pass individually but were not re-run this session.

## Contract workflows → battery coverage & result

| Contract workflow (BZE-246 scope) | Battery test(s) | Result |
| --- | --- | --- |
| Fresh-world create / reopen / sandbox | D-MQ-001*, D-MQ-002, SBX-001 | ✅ D-MQ-002 + SBX-001 green live; D-MQ-001 env-flake* |
| Successful trade — persist + rehydrate on re-entry | D-MQ-003 | ✅ green live |
| In-progress draft survives leaving the room (W9) | D-MQ-003B | ✅ green live |
| Illegal/blocked trade — fail-closed before apply | D-MQ-004 | ✅ green live |
| Waiver dead cap persists | D-MQ-004B | ✅ green live |
| Waive & Stretch / Buyout dead cap persists | D-MQ-004C, D-MQ-004D | ⏳ pinned e2e, not re-run this session |
| FA signing — receipt + history + compare + reload | D-MQ-005 | ⏳ env-flake this session* |
| Own-FA re-sign — FCT/Roster/history/compare/reload | D-MQ-005A | ⏳ not re-run this session |
| RFA offer sheet — pending / decline / match (48h) | D-MQ-005B, D-MQ-005D, D-MQ-005E | ⏳ not re-run this session |
| Sign-and-trade from FCT own-FA — hard-cap + rehydrate | D-MQ-005C | ✅ green live |
| Sign-and-trade starts from Free Agency room — hard-cap | D-MQ-005F | ✅ green live |
| Offseason room excluded from V1 nav (+ deep-link fallback) | D-MQ-006 | ✅ green live |
| Season Advance opens (world-aware gating) | D-MQ-007 | ✅ green live |
| Season advance — apply 2026-27→2027-28 + reload, decline preserved | architect-season-advance | ✅ green live |
| Draft positions — save + reload from committed world state | architect-season-advance | ✅ green live |
| Team History rehydrates persisted world events | D-MQ-008 | ⏳ not re-run this session |
| Entitlement authoring saves + blocks conflicting claim (admin, flag on) | D-MQ-009 | ✅ green live |
| No entitlement/pick authoring in owner-facing view (flag off) | D-MQ-009B | ✅ green live |
| Base-write deny evidence paired with rules proof | D-MQ-010 | ⏳ not re-run this session |
| Acceptance-grade world — battery team 15 / 15 · 3 / 3 | architect-full-rosters | ✅ green live |
| Cross-room agreement / FCT parity / roster counts | roster-fct-parity, roster-counts, full-cap-table-* | ⏳ pinned e2e, not re-run this session |

`*` D-MQ-001 and D-MQ-005 failed **only** on the degraded environment — their
captured page state was "Signing in…" and "Loading GM Dashboard…" (60s timeout),
i.e. the app could not finish initializing under memory pressure, not a product
defect. No code regression: neither the header nor the FA-signing flow was
touched by 247–252.

## Deliberate exclusions (owner-approved, in contract)

- Offseason room hidden from V1 navigation; season advance relocated to the World
  menu (BZE-250) — verified by D-MQ-006 + D-MQ-007 + architect-season-advance.
- Entitlement/pick authoring hidden from owner-facing GM builds (BZE-251) —
  verified by D-MQ-009B (off) with the admin path retained under an explicit flag
  (D-MQ-009).
- Draft-night workflow parked (post-V1).

## Non-e2e validation (merged `main` `3185b915`)

- `typecheck` clean · `test:architect` 3555 · `test:trade` 635 · `test:ui` 1179 ·
  architect cast gate at baseline. All green.

## Environment (blocker for a single full-suite pass)

The local review harness could not sustain a full-battery run this session. The
worker OOM-crashed after ~6 tests (`did not run` for the remainder) and fresh
tests timed out on app initialization (`vm_stat`: ~38 MB free, ~2 GB wired at the
time of the runs). Individual/small batches pass reliably (that is how the ✅ rows
above were captured), but a clean 26-test single pass needs a healthier
environment.

**Recommendation:** run the full `tests/e2e/architect-*.spec.ts` suite in CI or a
fresh machine to capture the single green pass required to close BZE-246. The code
under test is on `main` and all confirmed blockers are closed.
