# Slice 03 — Trade Overlay Entry Points & Context

**Status:** Implementation spec (slice 3 of 5)
**Branch:** `feature/architect-cockpit-intelligence`
**Date:** 2026-06-03
**Source contract:** `ARCHITECT_TRADE_OVERLAY_ENTRY_CONTRACT.md` (+ Map §Trade Machine, Slices §Slice 3)
**Master:** `ARCHITECT_IMPLEMENTATION_MASTER_SPEC.md`
**Depends on:** Slice 2 (`PlayerActionMenu` Trade action, `PlayerActionContext`)
**Reused by:** Slice 4 (History trade-event → trade context), Slice 5 (Guide → trade)
**Ships independently:** yes (but player-source entries need Slice 2)

---

## 1. Goal

Make the Trade Machine openable, with the right context, from every place the contract lists — while
keeping it overlay-first, preserving local draft state, and never becoming a hidden mutation
shortcut. Add an in-overlay objective/context banner and a single `TradeOpenRequest` payload.

---

## 2. Current code state (do not rebuild)

- `cockpit/TradeOverlay.tsx`: full-viewport overlay; hidden (not unmounted) when closed so the
  interior `TradeEditor` draft survives close/reopen. Slim close bar; Escape closes.
- `GMDashboard.tsx`: `isTradeOpen` / `hasOpenedTrade` (lazy first mount) / `requestedTradeStagePlayerIds`;
  `openTrade()` / `closeTrade()`. NavRail item `trade` (`forceActive` when open, `indicator` when
  draft active). `?room=trade` opens the overlay.
- `tradeMachine/TradeEditor.tsx`: consumes `requestedStagePlayerIds` (one-shot, cleared via
  `onStagePlayerHandled`); receives `worldId` / `worldAsOfDate` (vacuum vs world mode).
- Apply flow: `useArchitectActions` → `mutationPipeline.applyWorldMutation()` →
  `ArchitectMutationResult` → receipt via `useArchitectPostActionReceipt`.
- Existing entries already wired: **global Trade command** (NavRail / `?room=trade`), **pinned
  player → Trade** (`onTradePinnedPlayer`), **Trade all pinned** (`onTradeAllPinned`).

---

## 3. Gap to close

1. **Add the missing entry points**, each carrying context (not just player ids):
   - Roster player → Trade (via Slice 2 menu).
   - Cap Sheet player → Trade (via Slice 2 menu).
   - Cap/tax/apron warning → Trade — opens with an **objective** ("solve cap issue" / "reduce tax" /
     "clear first apron" / "clear second apron" / "avoid/resolve hard cap"); does **not** auto-stage
     a player.
   - Exception/TPE → Trade — opens with "use exception/TPE" context; must **not** imply usability
     before validation.
   - History trade event → Trade — opens with **related-event context only** (no auto-clone).
   - Receipt → Trade — when receipt is trade-related or implies a cap problem, offer "Open Trade
     Machine".
   - Guide recommendation → Trade — carries the guide objective (Slice 5 consumes).
2. **Introduce a `TradeOpenRequest` payload** so the overlay knows player ids **and** objective/
   context. Replace/augment the current `requestedTradeStagePlayerIds` with a richer request while
   keeping the existing staging behavior.
3. **In-overlay context banner** (open-question #7: both banner and rail objective). When opened
   with an objective/exception/event context, `TradeEditor` shows a dismissible banner stating the
   objective and its **authority label** (`Local draft` / `Planning context` / `Committed event
   reference`). The banner never implies validation/apply.
4. **Meaningful-draft threshold** (open-question #18). Define when a draft counts as "in progress"
   for the rail: at least one of — staged player, staged pick/asset, selected 2nd team, changed
   construction field, or explicit objective context. Bare overlay-open with no edits does **not**
   surface an In Progress card. Expose this as a derived `tradeDraftActive` value the rail already
   consumes.
5. **Trade all pinned confirmation** (open-question #6): confirm when > 2 players pinned.
6. **Post-apply / failed-apply** behavior per contract: success → receipt + refreshed scenario
   activity + inspection links + changed-player highlights; failure → stay in overlay, no receipt,
   no scenario entry, no auto-navigation. (Apply path already exists; ensure failure never produces
   a committed receipt.)

---

## 4. Target files

- `src/features/architect/GMDashboard/GMDashboard.tsx` — replace `requestedTradeStagePlayerIds`
  plumbing with `TradeOpenRequest`; add `openTradeWithRequest(request)`; wire warning/exception/
  receipt/Guide/History entry callbacks; trade-all confirmation gate.
- `src/features/architect/cockpit/tradeOpenRequest.ts` — **new** `TradeOpenRequest` type + builders;
  export from `cockpit/index.ts`.
- `src/features/architect/tradeMachine/TradeEditor.tsx` — accept `objective`/`contextBanner` props;
  render the dismissible banner with authority label; keep `requestedStagePlayerIds` staging
  (now sourced from the request).
- `src/features/architect/cockpit/ActivityRail.tsx` — warning rows and receipt rows can emit a
  trade-open request (objective); In Progress card consumes the meaningful-draft `tradeDraftActive`.
- `src/features/architect/cockpit/TradeOverlay.tsx` — only if the banner needs an overlay-level slot;
  otherwise unchanged.
- Reuse: `PlayerActionMenu` Trade action + `PlayerActionContext` (Slice 2) as the player-source
  entry; `mutationPipeline`/`useArchitectActions` for apply (unchanged).
- Tests: `tests/trade` (apply/failure boundaries) + `tests/architect` (entry plumbing, banner,
  threshold).

---

## 5. Data / shape changes

`TradeOpenRequest` (new) — names indicative:

```
TradeOpenRequest = {
  source: 'nav' | 'pinned' | 'pinned-all' | 'roster' | 'cap' | 'warning' | 'exception' | 'history' | 'receipt' | 'guide';
  playerIds?: string[];                 // to stage/request (existing behavior)
  objective?: TradeObjective;           // e.g. 'reduce-tax' | 'clear-first-apron' | 'clear-second-apron' | 'avoid-hard-cap' | 'use-exception' | 'solve-cap'
  exceptionRef?: { kind: 'mle'|'room'|'bae'|'dpe'|'tpe'|'tpmle'; id?: string };
  relatedEventId?: string | null;       // History trade event reference (no auto-clone)
  authority: 'local-draft' | 'planning-context' | 'committed-event-reference';
}
```

Derived `tradeDraftActive: boolean` — true only when the meaningful-draft threshold is met. Computed
from `useTradeMachine` draft state (`teams[]` staged sends/entitlements/2nd team) plus any active
objective context.

No change to `ArchitectMutationResult` or the receipt model.

---

## 6. Resolved open questions (this slice)

| # | Decision |
| --- | --- |
| 6 | "Trade all pinned" confirms when > 2 players pinned. |
| 7 | Warning/exception context shows **both** an in-overlay banner and the rail objective. |
| 10 | No "build similar trade"/auto-clone from History; related-event context only. |
| 18 | Meaningful-draft threshold gates the In Progress card; bare open does not. |

---

## 7. Acceptance criteria

- [ ] Trade opens (and resumes existing draft) from: global command, one pinned player, Trade all
      pinned, Roster player, Cap Sheet player, cap/tax/apron warning, TPE/exception, History trade
      event, receipt, Guide.
- [ ] Warning/exception entries open with an objective banner and stage **no** player automatically.
- [ ] History-event entry carries `relatedEventId` and never auto-clones the old trade into a draft.
- [ ] The banner shows the correct authority label and never implies validation/apply.
- [ ] Closing the overlay preserves the draft; reopening restores it exactly.
- [ ] In Progress card appears only when the meaningful-draft threshold is met.
- [ ] "Trade all pinned" with > 2 pinned prompts a confirmation.
- [ ] Successful apply → committed receipt + refreshed scenario activity + changed-player highlights
      + inspection links.
- [ ] Failed apply → stays in overlay, no committed receipt, no scenario entry, no auto-navigation.
- [ ] No alternate mutation path: apply still flows only through `useArchitectActions` →
      `mutationPipeline`.

---

## 8. Verification

- `npm run typecheck`
- `npm run test:trade --reporter=dot` (apply success/failure boundaries, no-clone)
- `npm run test:architect --reporter=dot` (entry plumbing, banner, threshold)
- `npm run build`
- `npm run dev` walkthrough:
  1. Open Trade from NavRail with no draft → empty editor, no In Progress card.
  2. Pinned player → Trade → player staged; close overlay → In Progress card appears; reopen →
     draft intact.
  3. Cap warning → Trade → objective banner shown, no player staged.
  4. TPE/exception → Trade → "use exception" banner; UI does not promise usability.
  5. History trade event → Trade → related-event banner; nothing auto-staged.
  6. Pin 3 players → Trade all → confirmation prompt.
  7. Apply a valid trade → receipt + highlights; force an invalid trade → stays in overlay, no
     receipt.

---

## 9. Non-goals / guardrails

- Trade Machine never becomes a Workbench room.
- No draft clearing on close.
- No apply from rail/roster/cap/history/receipt/compare/guide — those only open/route.
- No auto-clone of History trades.
- No promise of TPE/exception usage before validation.
- Never hide failed validation by navigating away.
