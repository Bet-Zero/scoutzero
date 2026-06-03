# Architect Implementation — Progress Ledger

**This is the resume point. Any agent starting or continuing this work reads this file FIRST.**
Find the first item that is not `DONE` and continue from there. Keep this file updated as you work.

Branch: `feature/architect-cockpit-intelligence`
Runbook: `ARCHITECT_IMPLEMENTATION_00_START_HERE.md`
Master spec: `ARCHITECT_IMPLEMENTATION_MASTER_SPEC.md`

Status legend: `NOT STARTED` · `IN PROGRESS` · `DONE` · `BLOCKED`

---

## Overall status: IN PROGRESS

Slice 1 DONE. Next: Slice 2 (Unified `PlayerActionMenu`).

---

## Slice 1 — Activity Rail audit + `authorityLabel.ts`  → **DONE**

Spec: `ARCHITECT_IMPLEMENTATION_SLICE_01_ACTIVITY_RAIL_PLAYER_ACTIONS.md`

- [x] Extract shared `cockpit/authorityLabel.ts`; export from `cockpit/index.ts`
- [x] Rail section order + Section Priority Rules (overflow) verified
- [x] All rail authority/mode strings routed through `authorityLabel.ts`
- [x] Empty states match contract copy (all sections)
- [x] Failure states (cap-posture unavailable, scenario reload failure) correct
- [x] Local (In Progress) visually distinct from committed (Receipt / Scenario Activity)
- [x] Collapsed indicators unambiguous; no auto-expand on commit
- [x] Receipt dismiss scope rule correct
- [x] `npm run typecheck` ✅
- [x] `npm run test:architect --reporter=dot` ✅ (289 files / 3418 tests passed)
- [x] `npm run validate:project` ✅
- [x] `npm run build` ✅ (built in ~48s; only pre-existing chunk-size / import warnings)
- [~] `npm run dev` acceptance walkthrough — not run in this non-interactive session;
      acceptance criteria covered by new render tests (see notes)
- [x] Committed (hash: see git log — `feat(architect): activity rail audit + shared authority label (interconnectivity slice 1)`)

Notes / results:

**What changed**

- New `src/features/architect/cockpit/authorityLabel.ts`: single source of truth for the
  authority/mode → user-facing label vocabulary (master spec §4.1) + `AUTHORITY_TONE_BADGE_CLASSES`.
  Exported from `cockpit/index.ts`. This is the shared artifact Slices 2/4/5 import.
- `ActivityRail.tsx` audit/polish:
  - Cap Posture: `cap.status === 'unavailable'` now renders the honest contract copy
    ("Cap posture unavailable. View Cap Sheet for details.") with a Cap Sheet link instead of a
    fake/zeroed posture. (`loading` still defers to `TeamStatusStrip`.)
  - In Progress: trade-draft card now carries a `Local draft` authority chip via `authorityLabel`.
  - Watchlist: each entry now has a real destination action (cap warnings → Cap Sheet,
    season mismatch → Offseason); season mismatch carries a `Season mismatch` authority chip;
    empty copy aligned to "No active watch items."
  - Collapsed indicators: separate dots for watchlist-danger / receipt / in-progress so a danger
    is never buried behind a lower-priority dot. No auto-expand on commit (unchanged).
  - Documented Section Priority Rules (rail scrolls, never drops; collapsed dots carry severity)
    and the "Next Steps folded" decision (open-question #5) inline.

**Decisions confirmed against current code**

- Receipt dismiss scope (open-question #17) already correct in `useArchitectPostActionReceipt`
  (session-only, scope-key reset clears, not persisted across reload) — no change needed.
- Scenario Activity (`ScenarioMoveRail`) already committed-world-only with unable-to-load (not fake
  empty) failure state — reused unchanged.
- No mutation authority added to the rail (navigation handlers only).

**Tests added**

- `src/tests/architect/cockpit/authorityLabel.test.ts` — every §4.1 row + tone-class coverage +
  "no internal mode words" guard.
- `src/tests/architect/cockpit/architectActivityRail.render.test.tsx` — cap-unavailable + link,
  empty receipt/watchlist copy, hidden Pinned/In-Progress, Local-draft chip, above-2nd-apron danger
  → Cap Sheet route, season-mismatch chip → Offseason route, collapsed danger dot not buried.

**Deferred**

- Manual `npm run dev` walkthrough not performed (no interactive session). Acceptance criteria are
  exercised by the render tests above; flag for a human pass if desired.

---

## Slice 2 — Unified `PlayerActionMenu`  → **IN PROGRESS (2a)**

Spec: `ARCHITECT_IMPLEMENTATION_SLICE_02_PLAYER_ACTION_MENU.md`
Depends on: Slice 1 (`authorityLabel.ts`)

- [ ] New `cockpit/PlayerActionMenu.tsx` + `cockpit/playerActionContext.ts`; exported
- [ ] Navigation-intent handlers wired in `GMDashboard.tsx` (no new mutation authority)
- [ ] Adopted on Roster, Cap Sheet, pinned-rail rows, receipt rows
- [ ] Full Cap inline kebab refactored to shared menu (test ids updated)
- [ ] No auto-pin on click; Open = inspect (`EditContractModal`)
- [ ] FA Pin adds a "Target"-badged pin (one board)
- [ ] Multi-player highlight correct; no fake rows for absent players
- [ ] `npm run typecheck` ✅/❌
- [ ] `npm run test:architect --reporter=dot` ✅/❌
- [ ] `npm run validate:project` ✅/❌
- [ ] `npm run build` ✅/❌
- [ ] `npm run dev` acceptance walkthrough done
- [ ] Committed (hash: ______)

Notes / results:

**Code map gathered during Slice 1 wrap-up (so the next pass does not re-derive it):**

- Existing inline kebab to replace lives in `capSheet/CapSheetFull/CapSheetFull.tsx`
  (~lines 878–967). Props: `onLaunchPlayerAction(player, 'waive'|'extend'|'stretch')` (Full-Cap-only
  contract launchers — KEEP), `onTogglePin(player)`, `pinnedPlayerIds`, `highlightPlayerId(s)`.
  Test ids to preserve/adjust: `cap-sheet-full-player-row-kebab`,
  `cap-sheet-full-player-row-action-menu`, `cap-sheet-full-player-row-action-{extend|waive|stretch}`,
  `cap-sheet-full-player-row-action-pin`, `cap-sheet-full-player-row-button` (name click = Open).
  `actionMenuIndex` state drives the open menu; row name button calls `openPlayerContractModal`.
- Current-season Cap Sheet component: `capSheet/CapSheet/CapSheet.tsx` (opens `EditContractModal`
  on row click; add menu, keep click = Open).
- Roster cards: `shared/RosterVisual/RosterVisual.tsx` (385 lines; card click → `onSelectPlayer`
  → `EditContractModal`; add menu, keep card click = Open).
- Pinned + receipt rows: `cockpit/ActivityRail.tsx` (pinned rows already have open/trade/unpin
  inline — swap to shared menu; receipt changed-player rows currently have NO per-player
  affordance — add menu with View-on-Roster/Cap + History/Compare/Guide, no auto-pin).
- Central wiring: `GMDashboard/GMDashboard.tsx` (1,114 lines) owns `pinnedPlayerIds` +
  `addPin`/`removePin`/`togglePin`, trade-open plumbing, and the `rooms` registry; define the
  navigation-intent handlers here and thread through `cockpit/CockpitShell.tsx` → room descriptors.
- Reuse `GMDashboard/postActionHandoff/playerFocus.ts` (`resolvePrimaryPlayerFocusId`,
  `playerMatchesFocus`) for identity — do NOT duplicate.
- New files to add: `cockpit/PlayerActionMenu.tsx`, `cockpit/playerActionContext.ts`
  (`PlayerActionContext` + `buildPlayerActionContext`); export both from `cockpit/index.ts`.
  Import `getAuthorityLabel` from the Slice-1 `cockpit/authorityLabel.ts` where labels are needed.
- FA-target (open-question #1): pin a free agent adds a pin with an `isTarget` flag (session/visual
  only); render a "Target" badge in the pinned rail. Keep `pinnedPlayerIds: string[]` and hold the
  target flag in a parallel set/map in `GMDashboard`.

**Execution plan — broken into safe, independently-verifiable sub-chunks** (each typechecks /
test:architect / build green and gets its own commit; the slice is DONE when 2a–2e all land):

- **2a — Foundation (additive, non-breaking):** new `cockpit/PlayerActionMenu.tsx` +
  `cockpit/playerActionContext.ts` (PlayerActionContext type, `PlayerAction` vocabulary,
  `buildPlayerActionContext`, overflow menu, `extraItems` slot for Full-Cap-only contract actions);
  export from `cockpit/index.ts`. Unit tests. Nothing consumes it yet → cannot break the app.
- **2b — Central wiring:** navigation-intent handlers in `GMDashboard.tsx` (reuse pin/trade
  plumbing, no new mutation authority); thread through `CockpitShell.tsx` → room descriptors; add
  session-only FA-target flag (parallel `Set` keyed by id).
- **2c — Adopt on Full Cap:** replace bespoke inline kebab with the shared menu; keep
  waive/extend/stretch as Full-Cap-only `extraItems` → `onLaunchPlayerAction`; update
  `CapSheetFull.rules.test.tsx` to the shared test-id scheme.
- **2d — Adopt on Roster + current-season Cap Sheet** (card/row click stays Open).
- **2e — Pinned rail rows + receipt changed-player rows + FA card** (FA pin → "Target" badge).

**Status:** 2a DONE (committed — `feat(architect): unified player action menu foundation`). 2b next.

**2a result:** new `cockpit/PlayerActionMenu.tsx` (intent-only menu: primary buttons + overflow +
`extraItems` slot + pin↔unpin toggle) and `cockpit/playerActionContext.ts` (`PlayerAction` vocab,
`PlayerActionContext`, `buildPlayerActionContext` reusing `playerFocus.ts` for id resolution);
exported from `cockpit/index.ts`. Tests: `playerActionContext.test.ts` (node) +
`playerActionMenu.test.tsx` (jsdom). Verified: typecheck, validate:project, build, scoped
node+ui cockpit suites.

**⚠️ Testing-infra note for all remaining `.tsx`-touching chunks (Slices 2–5):**

- `test:architect` runs `vitest.node.config.js`, whose `include` is **`.ts`/`.js` only** (node env);
  it **silently skips every `.tsx` test**. Component/render tests MUST be verified with the jsdom
  config: `npm run test:ui -- <path> --reporter=dot` (scoped to a path to avoid the broad UI suite,
  which has ~165 **pre-existing** failures, e.g. TierMaker `vi.mock` errors — unrelated to this work).
- Put pure logic in `.ts` tests (runs in the fast node gate); keep render tests in `.tsx` (jsdom).
- Do NOT pipe the authoritative gate through `| tail` — it masks the real exit code (tsc/vitest
  failures slip through). Read the task-notification exit code or run unpiped.
- This also fixed 2 latent failures in the Slice-1 `architectActivityRail.render.test.tsx` apron
  fixture (it relied on the cap engine reading a synthetic salary; now overrides `cap` directly).
  Those tests never ran under the node-only `test:architect` gate at Slice 1 time.

---

## Slice 3 — Trade overlay entry points + context  → **NOT STARTED**

Spec: `ARCHITECT_IMPLEMENTATION_SLICE_03_TRADE_OVERLAY_ENTRY.md`
Depends on: Slice 2

- [ ] New `cockpit/tradeOpenRequest.ts` (`TradeOpenRequest`); exported
- [ ] Entry points: Roster, Cap Sheet, warning, TPE/exception, History event, receipt, Guide
- [ ] In-overlay objective/context banner with authority label (`TradeEditor`)
- [ ] Meaningful-draft threshold gates the In Progress card
- [ ] "Trade all pinned" confirmation when > 2 pinned
- [ ] Apply success → receipt + highlights; failure → stays in overlay, no receipt
- [ ] No auto-clone / no alternate mutation path
- [ ] `npm run typecheck` ✅/❌
- [ ] `npm run test:trade --reporter=dot` ✅/❌
- [ ] `npm run test:architect --reporter=dot` ✅/❌
- [ ] `npm run build` ✅/❌
- [ ] `npm run dev` acceptance walkthrough done
- [ ] Committed (hash: ______)

Notes / results:

---

## Slice 4 — History outbound links  → **NOT STARTED**

Spec: `ARCHITECT_IMPLEMENTATION_SLICE_04_HISTORY_OUTBOUND_LINKS.md`
Depends on: Slice 2, Slice 3

- [ ] New `history/TeamHistoryTab/historyOutboundLinks.ts` resolver (unit-tested per event type)
- [ ] Event-type-aware outbound links in `HistoryDetailModal`
- [ ] Player names open `PlayerActionMenu` with `eventId` context
- [ ] Committed-event vs current-result labels via `authorityLabel.ts`
- [ ] Unavailable/deferred messaging (no fake links/rows/asset summaries)
- [ ] No auto-clone of trade events
- [ ] DEV/local entries never render as committed links
- [ ] `npm run typecheck` ✅/❌
- [ ] `npm run test:architect --reporter=dot` ✅/❌
- [ ] `npm run build` ✅/❌
- [ ] `npm run dev` acceptance walkthrough done
- [ ] Committed (hash: ______)

Notes / results:

---

## Slice 5 — Compare / Guide follow-through  → **NOT STARTED**

Spec: `ARCHITECT_IMPLEMENTATION_SLICE_05_COMPARE_GUIDE_FOLLOW_THROUGH.md`
Depends on: Slices 1–4 (context payloads)

- [ ] New `cockpit/followThroughContext.ts` (`FollowThroughContext`); exported
- [ ] Context held in `GMDashboard` and passed into Compare/Guide rooms
- [ ] Compare focused views (receipt/event/player/warning/season) + authority labels
- [ ] Guide objective-focused launches; routes only (no mutation), incl. `openTradeWithRequest`
- [ ] Empty/unavailable states match contract copy
- [ ] Multi-season labeled
- [ ] `npm run typecheck` ✅/❌
- [ ] `npm run test:architect --reporter=dot` ✅/❌
- [ ] `npm run build` ✅/❌
- [ ] `npm run dev` acceptance walkthrough done
- [ ] Committed (hash: ______)

Notes / results:

---

## Final whole-effort sign-off  → **NOT STARTED**

- [ ] `npm run typecheck` green
- [ ] `npm run test:architect --reporter=dot` green
- [ ] `npm run build` green
- [ ] Master spec §9 Definition of Done confirmed (no new mutation authority; consistent authority
      labels; local≠committed everywhere)
- [ ] Map Action Lifecycle Flows A–E walk end-to-end in `npm run dev`
- [ ] Completion note written below

Completion note:

---

## Blockers log

Record any hard stop here with: date, slice, file path(s), what you observed, and what decision is
needed. Then stop and let the product owner decide.

_(none yet)_
