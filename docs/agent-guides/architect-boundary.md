---
name: architect-boundary.md
description: Durable Architect boundary rules for AI agents. Referenced from AGENTS.md; do not re-paste into Linear issues or projects.
---

# Architect Boundary (Durable Rules)

Standing scope and design rules for all Architect work. Linear issues should
reference this doc plus one short issue-specific scope line — never restate it.

## Status

Architect is functionally 🟢 (all supported actions verified, 2026-07-04).
Current work is owner-driven UI/UX only. Do not reopen functional work unless a
verified gate regresses; if a UI task turns out to require functional/engine
changes, split it into a separately flagged issue — never absorb it silently.

## Trusted surfaces

- **Full Cap Table** is the trusted money/books surface.
- **Roster** is the trusted player-state surface.
- Supported actions are supported only from their proven entry points.
  Adjacent unfinished surfaces stay honestly labeled Preview or parked.
  Never let a label overclaim what has been proven.

## Scope protection (default no, unless the issue explicitly scopes it)

- No Trade Machine expansion or redesign inside other passes; TM work gets its
  own explicitly scoped lane.
- No CBA/rules/engine changes during UI/UX passes.
- No generic save/load/world cleanup, generic dead-money work, or broad
  action-loop QA as a side effect of another lane.
- No broadening of action-family semantics when adding entry points.

## Owner gates

- Nothing subjective (visual/layout/copy) ships without owner sign-off on
  screenshots. Branch-mode UI work stays off main until approval.
- Owner reviews at **1280×720**; screenshot every changed room at that size
  before handing off.
- Draft-night experience is parked by owner decision.

## Design laws (locked owner decisions)

- **One screen**: every player involved in a decision is visible on one
  screen — no separate sections or drawers for a decision's players.
- **Cap posture component is universal**: one shared component everywhere
  (drawer design is canonical); never duplicated or restyled per feature.
- **Full Cap Table fits with zero scroll** at review size, up to 18 rows.
- Trade Machine stays a separate full-screen workspace, visibly connected to
  the active Team Plan.
- Owner-facing copy uses GM language. Banned internal vocabulary on product
  surfaces: "posture", "truth", "guard", "canonical", "authority", raw world
  IDs, emulator/debug indicators, proof/scaffolding tags.

## Validation

- Scoped suites per AGENTS.md; note `test:architect` skips `.tsx`/`.jsx` —
  component-level checks need `test:ui`.
- Landing gates run the scoped engine + UI suites and report pre-existing
  failures explicitly by name.
