# Architect Cockpit (Phase 1 — Shell / Layout Framework)

Persistent fixed-viewport shell for The Architect. Wraps the existing 9 GM
Dashboard sections (Roster, Cap Sheet, Full Cap Table, Trade Machine, Free
Agency, Offseason, Team History, Compare, Guide) in a single cohesive
cockpit so they stop feeling like a collection of stale tabs and start
feeling like rooms in one GM tool.

This folder is the **chrome layer only**. Section internals are
unchanged — the Workbench wraps them externally.

## Layout

```
┌───────────────────────────────────────────────────────────────────┐
│ TOP BAR  Team · World · Date/Season · Mode · Cap Posture · Roster │ 56px
├──────────┬──────────────────────────────────────────┬─────────────┤
│  NAV     │           WORKBENCH                      │  ACTIVITY   │
│  RAIL    │  (RoomFrame around active section)       │  RAIL       │
│ 64/220px │                                          │ 48/280px    │
└──────────┴──────────────────────────────────────────┴─────────────┘
```

- **No page-level scroll.** Root is `h-[100dvh] overflow-hidden`; overflow
  happens only inside `RoomFrame` body and `ActivityRail`.
- **Full-width.** SiteLayout swaps to an `overflow-hidden` outlet for
  `/gm` routes and suppresses the global site header so the cockpit
  TopBar owns the viewport.

## Files

| File | Purpose |
|------|---------|
| `CockpitShell.tsx` | Composes TopBar + NavRail + Workbench + ActivityRail. Single entry point. |
| `TopBar.tsx` | Identity (team/world/season), cap posture, roster count, mode pill, last receipt. Reuses existing WorldSelector / WorldTimeControls / season select via slots. |
| `NavRail.tsx` | Left nav, 9 items. Collapsed 64px / expanded 220px. Pin persisted to localStorage. |
| `ActivityRail.tsx` | Right rail — the **Team Plan Hub** (BZE-208 Decision 1 / BZE-211). Compact overview: plan header (team · plan · season · save dot), status strip (cap / roster / two-way / picks / exceptions), alerts (only when present), active work, recent moves (`ScenarioMoveRail` + receipt when fresh), asset counts, pinned. Detail lives in `AssetsPanel` / Team History, never stacked in the drawer. Collapse persisted to localStorage. |
| `AssetsPanel.tsx` | Expanded team-assets modal for the hub: draft-pick stash by year (own / via / protection / swap), exception availability, roster spots, pick-history link. Read-only. |
| `Workbench.tsx` | Center area. Wraps active room in `RoomFrame` and cross-fades on tab change. |
| `RoomFrame.tsx` | 48px section header + scrollable body. Composed by Workbench, not imported by sections. |
| `CapPostureMeter.tsx` | Compact Cap → Tax → Apron 1 → Apron 2 track with team-total marker. |
| `ModePill.tsx` | Mode badge (EMULATOR/PROD/WORLD/SANDBOX/LOADING) + save state dot. |
| `useTeamPalette.ts` | Resolves team identifier (slug / code / name) to accent colors and injects CSS variables on the cockpit root. |
| `cockpitTokens.ts` | Color tokens. Extended into `tailwind.config.js` as `theme.extend.colors.cockpit`. |

## Phase 2 (GM desk — in progress on `feature/architect-cockpit-intelligence`)

- URL routing: `?room=` and `?player=` (season already in URL).
- `SelectionDock` below TeamStatusStrip for cross-room player focus.
- Activity rail trade-draft label (non-committed); Compare/Guide links on receipt.
- Cap / FA / Full Cap visual refit to `cockpit-*` tokens (**TradeEditor interior frozen**).
- League handoff bar on `/gm` (viewing season + last team).

Still deferred:

- Command palette (⌘K).
- Per-room `primaryAction` lift for Trade apply.
- Trade Machine interior reskin (Phase E — user approval required).

## What was NOT in Phase 1
- Optional motion library (framer-motion).
- Deletion of `ArchitectTabBar`, `ArchitectWorkspaceHeader` (kept alive in
  Phase 1; the cockpit only supersedes them visually inside the dashboard).

## Mutation ownership

The cockpit chrome is read-only. All committed writes continue to flow
through `useArchitectActions` → `mutationPipeline.ts`. The cockpit may
display context, navigate rooms, and launch existing modals; it must not
become a new mutation authority.
