---
name: GAP_LEDGER.md
description: BZE-245 reuse-first verified gap ledger — evidence decision for every required V1 workflow (W1–W15) against main 5c56d2ee, plus the bounded downstream issues for confirmed work.
---

# Architect V1 Verified Gap Ledger (BZE-245)

**Built:** 2026-07-11, against main `5c56d2ee` (contract commit).
**Contract:** `docs/agent-guides/architect-v1-completion-contract.md`
(owner-approved 2026-07-11).
**Method:** reuse newest trustworthy evidence; run only targeted checks to
resolve uncertainty; live-walk browser-visible claims; record only
actionable gaps. Full acceptance re-proof is downstream (BZE-246), which
runs only after the confirmed blockers below are closed.

## Verification actually run for this ledger

- `npm run test:diff -- --reporter=dot` on main scope: **pass** (17/17).
- Code checks on main: FA world-mode sign lane (`useArchitectActions.ts:591`
  publishes `signAndTradeInitiation: null`), Offseason nav wiring
  (`GMDashboard.tsx`, `ActivityRail.tsx`, Guide answer targets), Season
  Advance entry (`OffseasonSection.tsx` is the only mount), authoring flag
  (`.env.example` false; `runReviewMode.ts:442` + `.env.local` force true),
  battery inventory (`tests/e2e/architect-qa.spec.ts` D-MQ-001…010,
  SBX-001; plus extension/option/season-advance/own-FA specs).
- Live browser pass at 1280×720 in a freshly seeded review world
  (`architect:review:up`, world `world_review_1783763616207_bd3zoe3`, MIA):
  - Offseason appears as a normal room in the navigation rail and renders
    via `?room=offseason` — **confirmed**.
  - Free Agency room, world mode: own FA (Grant Holloway) absent from the
    pool; pool sign modal offers only "Sign Free Agent" — **no
    sign-and-trade start point in Free Agency**. The Full Cap Table own-FA
    row shows SIGN & TRADE / ABSOLVE — current proven entry intact.
  - Team Plan drawer: identity, save status, cap status, roster counts,
    alerts, and assets all consistent with the top bar and Full Cap Table
    for a fresh world — passes the glance check.
  - Seeded world realism: MIA came up 12/15 + 1/3 — below the 15+3
    evidence bar (harness gap, BZE-252).
- Reused without re-running (recent, uncontradicted): D-MQ battery proofs
  (last spec changes BZE-219, 2026-07-08), BZE-229/240/241/242 landing
  validation (2026-07-11: `test:architect` 3544/3544, `test:ui` 1164/1164,
  `gates:architect` PASS), BZE-190/191 closing records, and the 2026-07-11
  live Trade Machine inspection (artifact
  <https://claude.ai/code/artifact/0fbd4df7-79bd-405e-b138-da2c3afc3f54>).

## Evidence decisions by workflow

| WF | Workflow | Decision | Newest trustworthy evidence | Action |
| --- | --- | --- | --- | --- |
| W1 | Saved world lifecycle | Valid (partial) | `bze218-safe-fixes.spec.ts` world-create→act→rooms (07-06); SBX-001 inline create/select; D-MQ-002 date advance | No gap. Reopen/switch re-proven in battery (BZE-246) |
| W2 | Reading the books | Valid (fresh) | BZE-220+follow-up (official 2026-27 numbers, single source); BZE-240/241/242 merged 07-11; FCT/roster-count/parity e2e; BZE-229 landing suites | No action. Battery re-proves cross-room agreement |
| W3 | Waive / stretch / buyout | Valid, aging | D-MQ-004B/C/D live proofs from the FCT row overflow | No action. Re-run in battery |
| W4 | Contracts and options | Valid, aging | `architect-contract-extension`, `architect-option-decision`, `full-cap-table-own-fa` e2e; BZE-81 formula review | No action. Re-run in battery |
| W5 | Free agency — league pool | Valid, aging | D-MQ-005 (sign→receipt/history/compare/reload); BZE-222/234 room passes; BZE-186 action-label truth; live min-salary block observed (BZE-218 notes) | No action. Battery adds explicit illegal-signing scenario |
| W6 | Own free agents | Valid, aging | D-MQ-005A (re-sign, cross-room + reload); own-FA row live-confirmed today (re-sign/absolve/S&T present) | No action. Battery re-proves absolve |
| W7 | RFA offer sheets | Valid, aging | D-MQ-005B store, 005D decline, 005E match inside 48h window (world-clock fix `57bbb96b`); BZE-191 closing record | No action. Battery re-proves incl. blocked-window messaging |
| W8 | Sign-and-trade | **Gap confirmed** | Engine + FCT entry + TM finish proven (D-MQ-005C, BZE-190; FCT row live-confirmed today). FA start point missing on main: live check today + `useArchitectActions.ts:591` null lane + own FAs never in world pool | **BZE-249** |
| W9 | Trades and draft assets | **Gaps confirmed** | Engine strong (D-MQ-003/004, suites). 2026-07-11 live inspection: verdict buried below fold; green ready state unreachable in world mode; warnings never in top banner; Validate auto-opens export modal; staged draft silently discarded on leaving the room | **BZE-247** (verdict/ready/warnings/export), **BZE-248** (draft survives navigation). Cosmetic leftovers stay on BZE-227 |
| W10 | Draft-asset rules | Valid, aging | Unit suites; D-MQ-009 (authoring saves + blocks conflicting claims); BZE-218 TM picks fixtures | No action. D-MQ-009 keeps its flag-on env after BZE-251 |
| W11 | Season advance | Valid (partial) + structural risk | D-MQ-007 modal gating; `architect-season-advance.spec.ts` real advance + reload (MIA) | 30-team coherence is battery scope. Entry point lives only in the Offseason room → relocation is in **BZE-250** |
| W12 | Team History | Valid | D-MQ-008; BZE-218 reconciliation; BZE-229 (internal IDs behind dev toggle); BZE-237 visuals | No action |
| W13 | Compare | Valid (fresh) | Populated Compare verified at BZE-229 landing (`87a83451`); SBX-001 inline create/select; D-MQ compare checks | No action |
| W14 | Guide | Valid + linked gap | BZE-238 visual pass; guided-questions unit suites | Guide answers navigate to the Offseason room — becomes a dead end when hidden. Retarget inside **BZE-250** |
| W15 | Team Plan Hub | Evidence missing (no defect) | Built BZE-211; BZE-229 drawer worst-case visuals; today's live glance: accurate for a fresh world | No fix issue. Battery adds explicit accuracy-after-action + reload checks |
| — | Evidence std. #4 (realistic data) | **Gap confirmed (tooling)** | World seeder yields thin rosters (MIA 12/15+1/3 today; LAL/BOS ~3 on 07-11); DEN 18-man fixture is sandbox-only | **BZE-252** (blocks BZE-246) |
| — | Exclusion: Offseason room hidden | **Gap confirmed** | Live today: room in nav rail, deep link renders, Activity rail + Guide link to it | **BZE-250** |
| — | Exclusion: authoring hidden | **Gap confirmed** | `runReviewMode.ts:442` + `.env.local` force flag on → "+ New Entitlement" / pick "Modify" visible in owner builds (live 07-11) | **BZE-251** |

## Classification summary

- **Confirmed completion blockers:** BZE-249 (W8 FA start point),
  BZE-247 (W9 verdict first-class), BZE-248 (W9 draft never silently
  discarded), BZE-250 (Offseason room hidden + Season Advance relocated +
  Guide retargeted), BZE-251 (authoring hidden from owner-facing builds).
- **Required tooling (evidence enabler, not a product defect):** BZE-252
  (acceptance-grade 15+3 world rosters; blocks BZE-246).
- **Needs reproduction:** none.
- **Owner product decisions:** none open. Two presentation choices are
  flagged inside issues for owner review, not as blockers: where the
  Season Advance entry lands (BZE-250) and how the own-FA sign-and-trade
  start point is surfaced in the Free Agency room (BZE-249). Whether the
  Full Cap Table S&T entry also remains is defaulted to "keep" unless the
  owner objects at review.
- **Deliberate exclusions honored (no work, per contract):** draft-night
  experience, real-life franchise history, JSON/raw-data entry, the guided
  Offseason experience itself (only its hiding is work — BZE-250).
- **Already proven / no action:** W1–W7, W10–W13, W15 per the table;
  re-proof happens once, wholesale, in BZE-246.

## Execution sequence (finite)

1. **BZE-247** — trade verdict first-class (functional honesty; touches
   every trade decision including sign-and-trade). *The one active lane.*
2. **BZE-249** — sign-and-trade starts from Free Agency (lands on the
   TM front half after BZE-247 settles it).
3. **BZE-248** — trade in progress survives leaving the room (lifecycle).
4. **BZE-250** — hide Offseason room; relocate Season Advance; retarget
   Guide (scope enforcement + W11/W14 integrity).
5. **BZE-251** — hide authoring from owner-facing builds (small).
6. **BZE-252** — battery-grade world seeding (parallel-safe any time;
   must land before BZE-246 starts).

Then **BZE-246** (acceptance battery) → batched owner workflow review →
final gate on BZE-243.

## Contradictions surfaced (none hidden)

- BZE-191's closing note said the live Match proof was removed; the spec
  now contains D-MQ-005E with a world-clock fix (`57bbb96b`) — resolved in
  favor of "live proof exists", to be re-run in the battery.
- Earlier "Architect 🟢 complete" labels remain overridden by the owner's
  2026-07-11 decision, per the contract's precedence section.
