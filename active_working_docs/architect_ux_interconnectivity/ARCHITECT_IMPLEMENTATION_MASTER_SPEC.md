# Architect UX Interconnectivity — Implementation Master Spec

**Status:** Implementation spec (master)
**Branch:** `feature/architect-cockpit-intelligence`
**Date:** 2026-06-03
**Source contracts:** the `ARCHITECT_*_CONTRACT.md` files (+ `ARCHITECT_UX_INTERCONNECTIVITY_MAP.md` / `…_SLICES.md`) in this folder
**Location:** all docs in this spec set are siblings in `active_working_docs/architect_ux_interconnectivity/`; cross-references use bare filenames
**Scope:** Convert the 7 Architect UX contracts into an executable, gap-closing implementation plan against existing code.
**Non-scope:** Re-deriving the product/UX rationale (already settled in the contracts). This spec assumes the contracts are accepted as the product truth.

---

## 0. How to read this spec

This is the master index. It contains the review, the contract↔code gap map, the resolved
open-question decisions, the cross-cutting engineering rules, the build order, and the global
verification strategy.

Each of the five build slices has its own spec document:

1. `ARCHITECT_IMPLEMENTATION_SLICE_01_ACTIVITY_RAIL_PLAYER_ACTIONS.md`
2. `ARCHITECT_IMPLEMENTATION_SLICE_02_PLAYER_ACTION_MENU.md`
3. `ARCHITECT_IMPLEMENTATION_SLICE_03_TRADE_OVERLAY_ENTRY.md`
4. `ARCHITECT_IMPLEMENTATION_SLICE_04_HISTORY_OUTBOUND_LINKS.md`
5. `ARCHITECT_IMPLEMENTATION_SLICE_05_COMPARE_GUIDE_FOLLOW_THROUGH.md`

Each slice spec is self-contained and uses a fixed template (Goal → Current code state → Gap →
Target files → Data/shape changes → Resolved open questions → Acceptance criteria → Verification →
Non-goals). An implementation agent should be able to execute a single slice without reading the
others, except for the explicit dependencies in §6.

---

## 1. Why this work exists

The user authored a complete UX/product contract set for "The Architect" (the GM cockpit). Each
contract deliberately stops at the UX boundary ("code implementation details" is listed as
non-scope in every doc) and ends with an Open Questions list. This spec set bridges that final
gap: it turns settled product intent into concrete, buildable engineering slices.

The intended outcome: an implementation agent can build the full Architect interconnectivity
vision **without re-litigating product decisions and without churning the existing cockpit**.

---

## 2. Critical finding — this is gap-closing, not greenfield

The cockpit on `feature/architect-cockpit-intelligence` is already substantially built. The
contracts describe a target end-state; much of that end-state already ships. The single biggest
risk to this work is an implementation agent **rebuilding things that already exist** — which is
exactly the "random UI churn" the contracts were written to prevent.

### Already built — do NOT rebuild

| Area | Location |
| --- | --- |
| Cockpit shell: `CockpitShell`, `TopBar`, `WorldMenu`, `ModePill`, `TeamStatusStrip`, `NavRail` (9 rooms), `Workbench`, `RoomFrame`, `TradeOverlay` | `src/features/architect/cockpit/` |
| Activity Rail with sections: Cap Posture, Current Receipt (+ Compare/Guide buttons), Pinned Players (open/trade/unpin/trade-all), In Progress (trade draft), Watchlist, World Events (`ScenarioMoveRail`), collapsed-state receipt indicator | `src/features/architect/cockpit/ActivityRail.tsx` |
| Pinned-players state: `pinnedPlayerIds`, `addPin`/`removePin`/`togglePin`, multi-player trade staging, `?player=` deep-link, `focusedPlayerIds = pins ∪ receipt.primaryPlayerIds` | `src/features/architect/GMDashboard/GMDashboard.tsx` (commit `11251747`) |
| Receipt model `ArchitectPostActionReceipt` + `useArchitectPostActionReceipt` (publish/dismiss/generation) | `GMDashboard/postActionHandoff/types.ts`, `GMDashboard/hooks/useArchitectPostActionReceipt.ts` |
| Trade-draft preservation across overlay close/reopen (`hasOpenedTrade` lazy mount + hidden overlay) and `requestedStagePlayerIds` staging | `GMDashboard.tsx`, `tradeMachine/TradeEditor.tsx` |
| World-season vs viewing-season distinction + mismatch (`deriveSeasonContext`, `viewingSeasonDiffersFromWorldSeason`) | `GMDashboard/hooks/useArchitectWorkspaceContext.ts` |
| Cap posture (cap/tax/1st & 2nd apron/exceptions/TPE) via `computeTeamCapTotals` + `deriveCapSummary` | `utils/capTotals/computeTeamCapTotals.ts`, `useArchitectWorkspaceContext.ts` |
| Truth/mode enum `ArchitectModePresentationKind` (committed-world / sandbox / local-only-preview / pending-world-preview / failed-world-preview / dev-only-preview / loading / unavailable / error) | `GMDashboard/hooks/useArchitectModePresentation.ts` |
| All 8 rooms; **Compare and Guide are fully implemented** (read-only, navigation-only) | `GMDashboard/sections/*` |
| Contract mutation owner `EditContractModal` (sign/resign/extend/waive/option/renounce/sign-and-trade/offer-sheet) | `src/shared/components/EditContractModal.tsx` |
| Central commit authority `mutationPipeline.ts` (`applyWorldMutation`, `ArchitectMutationResult`) + `useArchitectActions` | `utils/mutationPipeline.ts`, `GMDashboard/hooks/useArchitectActions.ts` |
| History event shape (`type`/`teamsInvolved`/`playerIds`/`mutationType`/`operationId`/before&after totals) + `HistoryDetailModal` | `history/TeamHistoryTab/` |

### Net gaps to close (the actual work)

| Slice | One-line gap |
| --- | --- |
| 1 — Activity Rail | Audit/polish: lock section order, authority labels, empty/failure states against the contract. |
| 2 — Player Action Menu | **Largest gap.** No reusable player-action menu exists (only an inline kebab on Full Cap). Build one and wire it everywhere. |
| 3 — Trade Overlay Entry | Add context-carrying entry points (Roster/Cap/warning/TPE/History/receipt/Guide) + in-overlay objective banner. |
| 4 — History Outbound Links | `HistoryDetailModal` is a read-only dead end. Add event-type-aware outbound links + authority labels. |
| 5 — Compare/Guide Follow-Through | Rooms exist but don't receive context. Make them context receivers with authority labels. |

---

## 3. Architecture orientation (for any implementing agent)

State and data flow (read this before touching anything):

- **`GMDashboard.tsx`** is the composition orchestrator. It owns `pinnedPlayerIds`, trade-open
  state (`isTradeOpen`/`hasOpenedTrade`/`requestedTradeStagePlayerIds`), and the `rooms` registry
  (`Record<ActiveTab, RoomDescriptor>`). It wires hooks to `CockpitShell`.
- **`useArchitectState.ts`** is the dashboard-state adapter (NOT a world-read or committed-write
  authority): `worldId`, `currentYear` (viewing season), `worldCurrentSeason`, `activeTab`,
  `teamCapSheet`, `selectedPlayer`, etc.
- **`useArchitectWorkspaceContext.ts`** derives read-only presentation context: `team`, `world`,
  season context, `cap` summary, exceptions. This is where Watchlist/Cap-Posture data is shaped.
- **`useArchitectActions.ts`** is the only mutation surface; everything routes through
  `mutationPipeline.ts` → `applyWorldMutation()` → `ArchitectMutationResult`.
- **`useArchitectPostActionReceipt.ts`** turns a successful mutation result into a session-scoped
  `ArchitectPostActionReceipt`.
- **`useArchitectDeskNavigation.ts`** syncs `?room=` and `?player=` query params.
- **`ActiveTab`** = `'roster' | 'cap' | 'capfull' | 'trade' | 'fa' | 'offseason' | 'history' | 'compare' | 'guide'` (`hooks/useArchitectState.types.ts`). `trade` renders as an overlay, not a Workbench room.

Hard architectural constraints (apply to every slice):

1. **No new mutation authority.** Navigation/UI state only. All world writes stay in
   `useArchitectActions` → `mutationPipeline`. The rail, the player menu, History, Compare, and
   Guide may *route* to action owners but must never call a mutation directly.
2. **Pins and player focus are visual/session state**, never committed world data.
3. **The cockpit shell owns no business state** — it is composition. New behavior is wired through
   `GMDashboard.tsx` and the hooks, then passed down as props.

---

## 4. Cross-cutting rules (every slice must honor)

These come from the contracts' "Cross-Slice Rules" and are binding.

1. **No new mutation authority from UX wiring.** Route to existing owners.
2. **Local and committed states stay visually distinct.** Never let a local draft, pending write,
   failed write, DEV preview, or sandbox state render the same as committed world truth.
3. **Pinning is explicit.** Clicking a player inspects; pinning is a deliberate action.
4. **Receipts are post-commit bridges**, never synthesized from local state, never shown for failed
   actions.
5. **History is committed truth.** It routes outward; it never synthesizes drafts or invents asset
   state.
6. **Trade Machine is overlay-first.** Full viewport, draft preserved on close, apply only through
   the existing flow.
7. **Compare is authority-labeled.** Show `Unavailable`/`Deferred` rather than guessing a delta.
8. **Guide suggests and routes.** It never silently mutates.
9. **World season vs viewing season stays visible.** Viewing season must not imply world authority.
10. **League view is deferred.** Stabilize the team cockpit first.

### 4.1 Authority label vocabulary (single source of truth)

All slices must use one shared mapping from the existing `ArchitectModePresentationKind` enum
(and receipt/event authority) to the user-facing label. Slice 1 establishes this mapping as a small
exported helper (e.g. `authorityLabel.ts` in `cockpit/`); Slices 2–5 reuse it. Do **not** invent
per-slice label strings.

| Internal kind / state | User-facing label |
| --- | --- |
| `committed-world`, world event, `receipt.authority === 'committed-world'` | `Committed` / `World event` |
| `sandbox` | `Sandbox` |
| `local-only-preview`, trade draft, FA target | `Local draft` |
| `pending-world-preview` | `Pending` |
| `failed-world-preview` | `Failed` |
| `dev-only-preview` | `DEV preview` |
| `unavailable` / cannot derive safely | `Unavailable` |
| not modeled yet | `Deferred` |
| crosses season-advance boundary | `Multi-season` |
| viewing season ≠ world season | `Season mismatch` |

Never surface internal words (`vacuum`, `baseLocalValidated`, `worldOptimisticPreview`) as primary
labels.

---

## 5. Resolved open-question decisions (consolidated)

The 7 contracts contain ~50 open questions. Collapsed to the decisions that actually change the
build, with a locked default for each. **Every default is overridable** — each slice spec restates
the ones relevant to it so a reviewer can flip a decision without hunting.

| # | Question | Locked default | Owning slice |
| --- | --- | --- | --- |
| 1 | FA targets: pinned board vs separate Targets section | **Pinned-player subtype** (one board; "Target" badge) | 2 |
| 2 | What does **Open** route to? | Existing **`EditContractModal`** (Player Profile split deferred) | 2 |
| 3 | Pin scope / persistence | **Session-level + active-team-scoped**; `?player=` deep-link preserved; pins clear on team/world change | 1, 2 |
| 4 | Auto-pin on click? | **No** — click inspects; pin explicit (already true in code) | 2 |
| 5 | "Next Steps" rail section | **Keep folded** into Current Receipt + Watchlist actions; standalone section deferred | 1 |
| 6 | "Trade all pinned" confirmation | Confirm when **> 2** players pinned | 1, 3 |
| 7 | Warning→Trade context presentation | **Both** in-overlay banner and rail objective | 3 |
| 8 | History event detail surface | **Modal** (`HistoryDetailModal`); side-panel deferred | 4 |
| 9 | History player-name click | Opens the **`PlayerActionMenu`** | 4 |
| 10 | "Build similar trade" from History | **Deferred** — related-event context only, never auto-clone | 3, 4 |
| 11 | Guide objective persistence | **Session-only** for v1 | 5 |
| 12 | Compare local-draft previews | **Committed-only** for v1; local preview labeled+deferred | 5 |
| 13 | Compare player-level deltas | **Deferred**; v1 is event/team-level + authority labels | 5 |
| 14 | Compare default post-commit landing | **No** — optional receipt link only | 5 |
| 15 | Watchlist position relative to Pinned/Receipt | Order per contract §Rail Sections: Cap Posture → Receipt → Pinned → In Progress → Watchlist → Scenario Activity → Next Steps; **Section Priority Rules** govern space-constrained ordering | 1 |
| 16 | Rail auto-expand after commit? | **No auto-expand**; show collapsed receipt indicator (already implemented) | 1 |
| 17 | Dismissed-receipt persistence across room/world/reload | Dismiss persists until a new committed action or scope (team/world) change; not persisted across reload | 1 |
| 18 | Trade draft appears in In Progress when? | Only when a **meaningful draft** exists (threshold in Slice 3), not on bare overlay open | 1, 3 |

---

## 6. Build order and dependencies

Ship slices in this order. Each slice is independently shippable, but the dependencies below are
hard (a downstream slice reuses an upstream artifact).

```
Slice 1 (Activity Rail audit)
   └─ establishes authorityLabel.ts vocabulary + locks rail contract
Slice 2 (Player Action Menu)   ← foundational
   └─ produces reusable PlayerActionMenu + player context payload
Slice 3 (Trade Overlay Entry)  ← depends on Slice 2 (player→trade entry points)
Slice 4 (History Outbound Links) ← depends on Slice 2 (player names → menu) + Slice 3 (trade-context entry)
Slice 5 (Compare/Guide)        ← depends on receipt/warning/player context payloads from 1–4
```

Rationale: the player-continuity model (Slice 2) is the backbone of cross-room behavior, so it must
land before History links and most trade entry points. Compare/Guide come last because they consume
the context payloads finalized by the earlier slices.

---

## 7. Shared artifacts introduced across slices

To prevent divergence, these shared pieces are introduced once and reused:

| Artifact | Introduced in | Reused by | Purpose |
| --- | --- | --- | --- |
| `authorityLabel.ts` (mode/receipt/event → label) | Slice 1 | 2, 4, 5 | Single authority-label vocabulary |
| `PlayerActionMenu` component + `PlayerActionContext` payload type | Slice 2 | 4 (History player names), rail/receipt rows | Universal player actions |
| `PlayerNavigationIntent` handlers (view-on-roster/cap/full-cap, find-in-history, compare-impact, guide-next) wired in `GMDashboard.tsx` | Slice 2 | 3, 4, 5 | Cross-room navigation with highlight |
| Trade entry `TradeOpenRequest` payload (player ids + objective/context) | Slice 3 | 4 (History trade context), 5 (Guide→Trade) | Context-carrying overlay open |
| `FollowThroughContext` payload (receipt/event/player/warning/season) | Slice 5 (defined), seeded by 1–4 | 5 | Compare/Guide context receiver |

When an upstream slice defines one of these, it must export it from a stable module path the
downstream slice can import; each slice spec names that path.

---

## 8. Global verification strategy

Per `AGENTS.md`, use the narrowest correct scope and always append `--reporter=dot` to test runs.

| When | Command |
| --- | --- |
| After any TS/TSX change | `npm run typecheck` |
| Architect feature changes (primary) | `npm run test:architect --reporter=dot` |
| Trade Machine changes (Slice 3) | `npm run test:trade --reporter=dot` |
| Unsure of scope | `npm run test:diff --reporter=dot` |
| After meaningful component/route changes | `npm run build` |
| After structural changes (new files/exports, e.g. `PlayerActionMenu`) | `npm run validate:project` |
| Manual acceptance walkthrough | `npm run dev` → `http://localhost:5173` |

Each slice spec lists its own acceptance walkthrough and which test directories
(`tests/architect`, `tests/trade`, `src/tests`) to extend. A slice is "done" only when its
acceptance criteria pass under both automated tests and a manual `npm run dev` walkthrough.

Smoke-test guardrail: `TopBar` preserves the `sr-only` `h1` "HoopZero Architect – GM Dashboard";
do not remove it.

---

## 9. Definition of done (whole effort)

- All five slice specs implemented and individually verified.
- No new mutation authority introduced anywhere (audit: every world write still flows through
  `useArchitectActions` → `mutationPipeline`).
- Authority labels consistent across rail, player menu, History, Compare, Guide (all import
  `authorityLabel.ts`).
- Local/draft/pending/failed/DEV/sandbox never visually merge with committed world truth.
- `npm run typecheck`, `npm run test:architect`, and `npm run build` all green.
- The interconnectivity acceptance flows (Map §Action Lifecycle Flows A–E) are walkable end-to-end
  in `npm run dev`.
