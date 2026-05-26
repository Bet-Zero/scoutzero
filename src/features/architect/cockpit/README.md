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
| `ActivityRail.tsx` | Right rail. Embeds existing `ArchitectPostActionHandoff` and `ScenarioMoveRail`. Adds a read-only watchlist derived from workspace context. Collapse persisted to localStorage. |
| `Workbench.tsx` | Center area. Wraps active room in `RoomFrame` and cross-fades on tab change. |
| `RoomFrame.tsx` | 48px section header + scrollable body. Composed by Workbench, not imported by sections. |
| `CapPostureMeter.tsx` | Compact Cap → Tax → Apron 1 → Apron 2 track with team-total marker. |
| `ModePill.tsx` | Mode badge (EMULATOR/PROD/WORLD/SANDBOX/LOADING) + save state dot. |
| `useTeamPalette.ts` | Resolves team identifier (slug / code / name) to accent colors and injects CSS variables on the cockpit root. |
| `cockpitTokens.ts` | Color tokens. Extended into `tailwind.config.js` as `theme.extend.colors.cockpit`. |

## What is NOT in Phase 1

Deferred to Phase 2 (separate branch / plan):

- Nested URL routing per section.
- Command palette (⌘K).
- Cross-room sticky player selection / SelectionDock.
- Trade draft persistence and draft badge.
- Cross-room actions (Send to Trade, View Cap, etc.).
- Per-room internal layout refits.
- Optional motion library (framer-motion).
- Deletion of `ArchitectTabBar`, `ArchitectWorkspaceHeader` (kept alive in
  Phase 1; the cockpit only supersedes them visually inside the dashboard).

## Mutation ownership

The cockpit chrome is read-only. All committed writes continue to flow
through `useArchitectActions` → `mutationPipeline.ts`. The cockpit may
display context, navigate rooms, and launch existing modals; it must not
become a new mutation authority.
