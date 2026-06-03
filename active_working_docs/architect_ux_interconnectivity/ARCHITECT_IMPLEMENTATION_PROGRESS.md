# Architect Implementation — Progress Ledger

**This is the resume point. Any agent starting or continuing this work reads this file FIRST.**
Find the first item that is not `DONE` and continue from there. Keep this file updated as you work.

Branch: `feature/architect-cockpit-intelligence`
Runbook: `ARCHITECT_IMPLEMENTATION_00_START_HERE.md`
Master spec: `ARCHITECT_IMPLEMENTATION_MASTER_SPEC.md`

Status legend: `NOT STARTED` · `IN PROGRESS` · `DONE` · `BLOCKED`

---

## Overall status: NOT STARTED

No slices implemented yet. Begin with Slice 1.

---

## Slice 1 — Activity Rail audit + `authorityLabel.ts`  → **NOT STARTED**

Spec: `ARCHITECT_IMPLEMENTATION_SLICE_01_ACTIVITY_RAIL_PLAYER_ACTIONS.md`

- [ ] Extract shared `cockpit/authorityLabel.ts`; export from `cockpit/index.ts`
- [ ] Rail section order + Section Priority Rules (overflow) verified
- [ ] All rail authority/mode strings routed through `authorityLabel.ts`
- [ ] Empty states match contract copy (all sections)
- [ ] Failure states (cap-posture unavailable, scenario reload failure) correct
- [ ] Local (In Progress) visually distinct from committed (Receipt / Scenario Activity)
- [ ] Collapsed indicators unambiguous; no auto-expand on commit
- [ ] Receipt dismiss scope rule correct
- [ ] `npm run typecheck` ✅/❌
- [ ] `npm run test:architect --reporter=dot` ✅/❌
- [ ] `npm run validate:project` ✅/❌
- [ ] `npm run build` ✅/❌
- [ ] `npm run dev` acceptance walkthrough done
- [ ] Committed (hash: ______)

Notes / results:

---

## Slice 2 — Unified `PlayerActionMenu`  → **NOT STARTED**

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
