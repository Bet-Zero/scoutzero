# Architect Next Era Master Plan

This master plan defines the next product era for Architect. It is based on
the discovery findings in
[ARCHITECT_NEXT_ERA_DISCOVERY_REPORT.md](ARCHITECT_NEXT_ERA_DISCOVERY_REPORT.md).

The plan is intentionally product- and architecture-level. It does not mark any
implementation work complete, and it does not authorize new mutation authority.

## Product Thesis

Architect should feel like one continuous franchise operating workspace.

The system already has persistent worlds, committed mutations, season
advancement, cap sheet surfaces, trade validation, free agency workflows, roster
views, offseason workflows, and history. The next product phase should connect
those strengths through visible operating continuity:

- the user always knows which franchise, world, date, and season they are
  operating in.
- the user can move between cap, roster, trade, free agency, offseason, and
  history without losing orientation.
- the user can distinguish committed world truth from sandbox, local preview,
  vacuum, and DEV-only states.
- the user can see recent and pending scenario activity without hunting through
  individual tools.

Worlds provide persistence. The World Operating Experience provides continuity.

## Current Problem

Architect is technically interconnected, but user-facing continuity is
fragmented.

The current dashboard shell already composes the major sections and keeps world
state alive behind the scenes. However, many operating signals are only visible
inside individual sections:

- cap, tax, and apron status are primarily visible in cap surfaces.
- trade legality and validation status are visible in the Trade Machine.
- world season and viewing-season mismatch are visible in Offseason.
- committed events are visible in History.
- free agency world-only constraints are visible in free agency controls.
- roster identity and grouping are visible in Roster.

This means the backend may know the world, but the user still experiences a set
of connected tools rather than a single operating room.

## Why Worlds Are Necessary but Not Sufficient

Worlds are necessary because they provide durable scenario state. They allow
committed changes to survive navigation, reloads, and future operations. They
also define the correct persistence boundary for world-backed mutations.

Worlds are not sufficient because persistence alone does not explain state to
the user. A saved world can still feel disconnected if the interface does not
continuously answer:

- Which team am I running?
- Which world or scenario am I inside?
- What date and season does this world believe it is?
- What season am I currently viewing?
- Is this committed world truth, sandbox exploration, or local preview?
- What is the franchise's current cap, roster, asset, and validation posture?
- What just happened, what is pending, and what changed from baseline?

The next era must add that explanatory layer without weakening the existing
world and mutation boundaries.

## Staged Roadmap

### Stage 0: North Star and Planning Docs

Create the planning artifacts that define the product direction, Stage 1 scope,
truth boundaries, and acceptance criteria.

Artifacts:

- this master plan
- `ARCHITECT_WORLD_OPERATING_EXPERIENCE_SPEC.md`
- source discovery report

Stage 0 is documentation only.

### Stage 1: World Operating Experience / Cockpit Layer

Add a read-only operating layer to the dashboard shell.

Stage 1 should make active world context visible at all times without creating
new writes, new mutation paths, or new schema requirements. The first version
should focus on identity, status, mode truth, and recent activity.

Primary surfaces:

- persistent workspace header or status strip
- active-world cockpit
- scenario or move rail
- read-only mode presentation
- narrow delta and status summaries

Detailed scope lives in
[ARCHITECT_WORLD_OPERATING_EXPERIENCE_SPEC.md](ARCHITECT_WORLD_OPERATING_EXPERIENCE_SPEC.md).

### Stage 2: Cross-Surface Action Continuity

After the read-only operating layer exists, connect action lifecycles across
surfaces.

Likely focus areas:

- show trade drafts, submitted offers, committed signings, and season-advance
  aftermath in one activity model.
- preserve useful context when moving between trade, free agency, cap, roster,
  and history.
- clarify pending, local-only, failed, committed, and superseded states.
- avoid changing mutation authority while improving user orientation.

Stage 2 should build on Stage 1 presentation seams instead of adding
surface-specific banners.

### Stage 3: Scenario Comparison and Branching

Once operating continuity is clear, improve comparison between scenarios.

Likely focus areas:

- compare active world to base, parent world, or another world.
- show roster, cap, asset, and event deltas with explicit authority.
- make world branching understandable as product behavior, not only storage
  behavior.
- define which deltas are snapshot-derived and which are event-derived.

Stage 3 should not begin until Stage 1 has established stable truth language.

### Stage 4: Guided Franchise Questions

Add guided workflows that help the user answer franchise-planning questions
across existing surfaces.

Examples:

- Can this team duck the tax?
- What moves create enough room for a target signing?
- Which trade packages remain legal after a specific signing?
- What does this roster look like after advancing the season?

Guided workflows should orchestrate existing data and validation engines. They
should not bypass mutation or validation authority.

### Stage 5: Product Polish and Professionalization

Refine the product so Architect feels like a professional operating tool rather
than a collection of expert panels.

Likely focus areas:

- visual hierarchy and density
- consistent labels for truth, mode, and state
- command placement
- empty states
- loading and error treatment
- section transitions
- responsive behavior

This stage should polish the operating model already established by earlier
stages.

### Stage 6: Full Architect Ship-Ready Audit

Run a broad ship-readiness audit after the operating experience, action
continuity, scenario comparison, guided questions, and polish passes have
landed.

Audit areas:

- state authority
- mutation boundaries
- world/base/sandbox/preview truth presentation
- validation and legality behavior
- route and navigation continuity
- Firestore read/write boundaries
- performance
- accessibility
- docs and test coverage

The full audit is intentionally last. Running it before the product operating
model is stable would create churn around surfaces that are still changing.

## Explicit Non-Goals

- Do not redesign Architect blindly.
- Do not add random features disconnected from the continuity thesis.
- Do not create a new mutation pipeline.
- Do not create a new Firestore write path.
- Do not change Firestore schema as part of Stage 1.
- Do not write to read-only source collections.
- Do not treat local preview, vacuum overlay, local audit, or DEV preview state
  as committed world truth.
- Do not make selected viewing season imply authoritative world season.
- Do not make league view world-aware before the dashboard operating model is
  defined.
- Do not run broad test suites for docs-only planning work.

## Implementation Principles

1. Preserve existing authorities.

   Committed world mutations continue through `mutationPipeline`. Season
   advancement continues through `seasonManager`. Base data remains read-only.

2. Add presentation before behavior.

   Stage 1 should explain existing state before adding new workflows.

3. Make truth visible.

   Every global summary should say whether it represents committed world truth,
   sandbox/base state, local-only preview, optimistic pending state, or DEV-only
   preview state.

4. Compose from existing state seams.

   Prefer `useArchitectState`, `useArchitectActions` contracts, world events,
   local audit events, and existing cap/roster/asset helpers over duplicate
   readers or new global stores.

5. Keep Stage 1 read-only.

   The cockpit and status layer may link to existing surfaces, but it must not
   mutate world data or create command shortcuts that bypass existing actions.

6. Start narrow on deltas.

   Use committed world events and clearly scoped current-team summaries first.
   Do not claim full base-to-world or parent-to-world diff coverage until the
   authority model is explicit.

7. Prefer one operator language.

   Internal terms such as sandbox, base, vacuum, local validated, optimistic
   preview, and DEV preview should map to a small, consistent user-facing
   vocabulary.

## Verification Philosophy

Validation should match the risk of each stage.

For Stage 0 docs:

- run Markdown and docs guardrail checks.
- do not run product test suites.

For Stage 1 read-only UI:

- run typecheck after TS/TSX changes.
- run build after meaningful UI changes.
- run the narrowest relevant test scope, usually `npm run test:diff -- --reporter=dot`.
- add targeted tests for selector/helpers that derive operating status, mode
  labels, or deltas.
- use manual UI verification for layout, persistence of context across tabs,
  and truth-label clarity.

For later stages:

- broaden validation only when mutation behavior, cross-surface action state, or
  world authority changes.
- do not run the full suite unless explicitly authorized with `RUN FULL SUITE`.

## Source Artifact

This plan is derived from
[ARCHITECT_NEXT_ERA_DISCOVERY_REPORT.md](ARCHITECT_NEXT_ERA_DISCOVERY_REPORT.md).

That report remains the source artifact for:

- current shell and section composition
- active world and mode representation
- UI visibility gaps
- backend and state authority constraints
- Stage 1 seam recommendations
- open questions
