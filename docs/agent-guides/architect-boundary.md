---
name: architect-boundary.md
description: Standing Architect product, data-architecture and design rules for AI agents. Referenced from AGENTS.md; do not re-paste into Linear issues.
---

# Architect Boundary

Standing product and design rules for Architect work. What V1 must do is in the
[V1 completion contract](architect-v1-completion-contract.md); how to build,
test, review and merge a change is in [AGENTS.md](../../AGENTS.md). Linear issues
link here instead of restating it.

## Trusted surfaces

- **Full Cap Table** is the trusted money/books surface.
- **Roster** is the trusted player-state surface.
- Supported actions are supported from their proven entry points. Adding an
  entry point doesn't change what the action does. Unfinished surfaces stay
  honestly labeled Preview or hidden. Never let a label overclaim what works.

## Building Trade Machine and rules capabilities

Complete shared, rules-driven capabilities, not a new implementation for each
example trade (owner, November 5 and November 10). Reuse the accepted CBA
foundation, trade rules, atomic writer and season manager. Keep evaluating a
proposal, saving the whole deal and advancing its world distinct but
consistent; don't build parallel engines or a speculative general framework.
Ordinary transaction shapes must not get artificial player or routing limits
because of an example's size; actual source, eligibility and NBA-rule limits
still apply. Examples verify mechanisms; they don't define the complete
supported universe.

## Data architecture

- Architect data uses ScoutZero's existing Firebase/Firestore project;
  first-party Firebase Storage is allowed for immutable release files. Vercel
  hosts the app, not a separate data store. Linear is for coordination and
  private file retention only, never a runtime dependency (owner, BZE-321
  comments `3a7a53b0-f6a5-4e12-a538-7223492e126b` and
  `2c01c2f2-7a28-47c1-8ed4-3d9b5e38989b`).
- A missing credential doesn't authorize another provider. Choosing a new
  provider or a paid service is the owner's decision.
- Starting-data packages stay private, versioned and digest-checked at runtime,
  outside the Git build and browser bundles. Existing worlds keep their original
  baselines.

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
- The draft-night experience is parked by owner decision.

Owner screenshot reviews of Architect use **1280×720**. Which changes need the
owner's approval before merging is set in AGENTS.md ("Ask the owner first").
