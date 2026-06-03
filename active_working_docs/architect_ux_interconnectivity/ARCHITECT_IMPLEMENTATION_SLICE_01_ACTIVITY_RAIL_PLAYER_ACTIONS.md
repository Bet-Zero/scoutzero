# Slice 01 — Activity Rail Audit & Authority Vocabulary

**Status:** Implementation spec (slice 1 of 5)
**Branch:** `feature/architect-cockpit-intelligence`
**Date:** 2026-06-03
**Source contract:** `ARCHITECT_ACTIVITY_RAIL_CONTRACT.md` (+ Map §ActivityRail, Slices §Slice 1)
**Master:** `ARCHITECT_IMPLEMENTATION_MASTER_SPEC.md`
**Depends on:** none (this slice is the foundation; it ships the shared authority-label helper)
**Ships independently:** yes

---

## 1. Goal

Bring the existing Activity Rail into full compliance with the Activity Rail Contract, and extract
the **shared authority-label vocabulary** that Slices 2, 4, and 5 will reuse. This is mostly an
**audit-and-polish** slice — the rail already renders all sections — plus one new small shared
helper.

---

## 2. Current code state (do not rebuild)

`src/features/architect/cockpit/ActivityRail.tsx` already renders, in order:

1. **Cap Posture** → `TeamStatusStrip` (vertical orientation).
2. **Current Receipt** → `ArchitectPostActionHandoff` + Compare/Guide buttons, or "No recent committed actions".
3. **Pinned Players** (only when `pinnedPlayers.length > 0`) → open / trade / unpin per row, "Trade all" when > 1.
4. **In Progress** (only when `tradeDraftActive`) → trade-draft resume card.
5. **Watchlist** → derived entries (cap posture, exceptions, season mismatch), tone-coded info/watch/danger, or "No active warnings".
6. **World Events** → `ScenarioMoveRail`.
7. Collapsed state (48px) with a receipt indicator dot; collapse persisted to `architect.activityRail.collapsed`.

Supporting state already exists: `ArchitectPostActionReceipt` + `useArchitectPostActionReceipt`
(publish/dismiss/`generation`); `pinnedPlayers`/`onUnpinPlayer`/`onOpenPinnedPlayer`/
`onTradePinnedPlayer`/`onTradeAllPinned`; `tradeDraftActive`/`onResumeTradeDraft`; watchlist inputs
from `useArchitectWorkspaceContext` (`deriveSeasonContext`, `deriveCapSummary`);
`ArchitectModePresentationKind` from `useArchitectModePresentation.ts`.

---

## 3. Gap to close

1. **Section order & priority.** Confirm the rendered order matches the contract's canonical order
   (Cap Posture → Current Receipt → Pinned → In Progress → Watchlist → Scenario Activity → Next
   Steps) and implement the contract's **Section Priority Rules** for the space-constrained case
   (critical/saving/pending → Current Receipt → In Progress → Watchlist danger → Pinned → Cap
   Posture → Scenario Activity → Next Steps). If the rail can overflow, sections should drop/scroll
   in that priority, not arbitrarily.
2. **Authority labels.** Extract a single `authorityLabel.ts` helper mapping
   `ArchitectModePresentationKind` + receipt/event authority to the user-facing vocabulary in
   Master §4.1. Replace any ad-hoc label strings in the rail with calls to it. **This helper is the
   shared artifact Slices 2/4/5 import.**
3. **"Next Steps" decision (open-question #5).** Keep Next Steps **folded** into the Current Receipt
   (Compare/Guide buttons) and Watchlist (destination actions) for v1. Document this in code with a
   short comment; do not add a standalone Next Steps section now.
4. **Empty states.** Verify each section matches the contract's empty-state copy: Cap Posture
   unavailable → "Cap posture unavailable. View Cap Sheet for details."; Current Receipt empty →
   "No recent committed actions."; Pinned empty → hidden (or onboarding copy); In Progress empty →
   hidden; Watchlist empty → hidden or "No active watch items."; Scenario Activity empty → "No
   committed world events yet." / no-world → "Scenario activity requires an active world."; whole
   rail empty → the contract's combined empty message.
5. **Failure states.** Per contract §Failure / Error Behavior: cap-posture derivation failure →
   "unavailable" + Cap Sheet link (not a fake zeroed posture); scenario reload failure →
   unable-to-load state (not a fake empty); failed trade/sign → never a committed receipt.
6. **Local-vs-committed separation.** Audit that Scenario Activity (`ScenarioMoveRail`) shows
   **committed world events only** and that In Progress (local draft) is visually distinct from
   Current Receipt (committed) and Scenario Activity. No local/pending/failed/DEV entry may appear
   inside Scenario Activity.
7. **Collapsed indicators (open-question #16).** Keep current behavior (no auto-expand on commit;
   show indicator dot). Optionally extend the collapsed dot to distinguish receipt vs watchlist-
   danger vs in-progress per the contract's Collapsed Indicators table — keep ambiguity rules: do
   not hide a critical/danger state behind a lower-priority dot.
8. **Dismiss scope (open-question #17).** Receipt dismissal hides the current receipt until a new
   committed action or a team/world scope change; it must not delete committed History events. Not
   persisted across reload.

---

## 4. Target files

- `src/features/architect/cockpit/ActivityRail.tsx` — section order/priority, empty/failure states,
  label calls, collapsed indicators.
- `src/features/architect/cockpit/authorityLabel.ts` — **new**, the shared label helper; export from
  `cockpit/index.ts`.
- `src/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext.ts` — only if watchlist/
  cap-posture derivation needs an explicit "unavailable" signal it does not already emit.
- Tests: extend `tests/architect` (or `src/tests`) with rail authority/empty-state coverage.

No changes to mutation hooks, no new state authority.

---

## 5. Data / shape changes

- New `authorityLabel.ts` exporting something like
  `getAuthorityLabel(input: { kind?: ArchitectModePresentationKind; receiptAuthority?: 'committed-world'; seasonMismatch?: boolean }): { label: string; tone: 'committed' | 'local' | 'pending' | 'failed' | 'dev' | 'sandbox' | 'unavailable' | 'warn' }`.
  Exact signature at implementer's discretion; it must cover every row of the Master §4.1 table and
  be the only place those strings live.
- No changes to `ArchitectPostActionReceipt`, `pinnedPlayers`, or workspace-context shapes are
  required for this slice.

---

## 6. Resolved open questions (this slice)

| # | Decision |
| --- | --- |
| 3 | Pins session-level + active-team-scoped; clear on team/world change (no new persistence). |
| 5 | Next Steps stays folded (Receipt + Watchlist actions). |
| 15 | Section order per contract; Section Priority Rules govern overflow. |
| 16 | No auto-expand after commit; keep collapsed receipt indicator. |
| 17 | Dismissed receipt hidden until new action or scope change; not persisted across reload. |
| 18 | In Progress shows only when a meaningful draft exists (threshold owned by Slice 3; rail just consumes `tradeDraftActive`). |

---

## 7. Acceptance criteria

From the contract's Acceptance Checklist, made code-checkable:

- [ ] Rail renders sections in the canonical order; under height pressure they degrade by the
      Section Priority Rules, never hiding a danger/critical state behind a lower priority.
- [ ] Every authority/mode string in the rail comes from `authorityLabel.ts`; no inline duplicates.
- [ ] Internal words (`vacuum`, `baseLocalValidated`, `worldOptimisticPreview`) never render.
- [ ] Each section's empty state matches the contract copy; empty sections hide rather than show
      fake activity.
- [ ] Cap-posture derivation failure shows "unavailable" + Cap Sheet link, not a zeroed posture.
- [ ] Scenario Activity shows committed world events only; In Progress (local) is visually distinct
      from Current Receipt (committed) and Scenario Activity.
- [ ] A failed trade/sign never produces a Current Receipt or a Scenario Activity entry.
- [ ] Receipt can be dismissed without affecting History; dismissal respects the scope rule.
- [ ] Collapsed rail still indicates receipt / watchlist-danger / in-progress without ambiguity.
- [ ] The rail introduces no mutation behavior (grep: no `useArchitectActions`/`mutationPipeline`
      calls inside `ActivityRail.tsx`).

---

## 8. Verification

- `npm run typecheck`
- `npm run test:architect --reporter=dot` (extend with rail label/empty-state tests)
- `npm run validate:project` (new `authorityLabel.ts` export)
- `npm run build`
- `npm run dev` walkthrough:
  1. With no world → rail shows Sandbox/empty states correctly.
  2. Commit a trade → Current Receipt appears with `Committed` label + Compare/Guide buttons; World
     Events refreshes.
  3. Pin two players → Pinned section shows both + "Trade all".
  4. Open a trade draft → In Progress card appears, labeled `Local draft`.
  5. Force a season mismatch (viewing season ≠ world season) → Watchlist shows season-mismatch with
     an Offseason destination.
  6. Collapse the rail → indicator dot reflects the most severe state.

---

## 9. Non-goals / guardrails

- No standalone Next Steps section in v1.
- No new pinned-player persistence (no localStorage/Firestore beyond existing `?player=`).
- No mutation calls from the rail.
- Do not redesign `ScenarioMoveRail` or `ArchitectPostActionHandoff`; reuse them.
- Do not remove the `sr-only` `h1` in `TopBar` (smoke-test guardrail).
