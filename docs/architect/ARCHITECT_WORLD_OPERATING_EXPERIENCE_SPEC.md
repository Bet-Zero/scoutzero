# Architect World Operating Experience Spec

This spec defines Stage 1 of the Architect next-era plan. It is based on
[ARCHITECT_NEXT_ERA_DISCOVERY_REPORT.md](ARCHITECT_NEXT_ERA_DISCOVERY_REPORT.md)
and should be read alongside
[ARCHITECT_NEXT_ERA_MASTER_PLAN.md](ARCHITECT_NEXT_ERA_MASTER_PLAN.md).

Stage 1 is a read-only operating layer. It must make active world context and
franchise state visible without creating new mutation authority.

## Stage 1 Goal

Make Architect feel like one continuous franchise operating workspace while the
user moves between roster, cap sheet, cap table, trade, free agency, offseason,
and history.

Stage 1 should answer these questions at a glance:

- Which team am I operating?
- Which world or scenario is active?
- What world date and world season are authoritative?
- Which season am I currently viewing?
- Is this committed world truth, sandbox/base state, or local preview?
- What is the current roster, cap, exception, asset, and recent-move posture?
- Are there local, pending, failed, or committed entries I should understand?

## Scope

Stage 1 is in scope:

- read-only workspace header or status strip
- read-only active-world cockpit
- read-only mode/truth presentation
- read-only franchise status summaries
- read-only scenario or move rail
- narrow read-only delta helpers where authority is clear
- links or anchors into existing sections, if they do not mutate state

Stage 1 is out of scope:

- new Firestore writes
- new mutation authority
- Firestore schema changes
- new action workflows
- direct mutation commands from the cockpit
- redesigning existing sections
- treating local previews as committed world state

## Expected User-Facing Behavior

### Active Team Identity

The operating layer should always show the active team for the dashboard route.

Expected display:

- team name or code
- optional logo or visual marker if already available through existing helpers
- clear fallback when team data is loading or unavailable

Rules:

- derive from route/team cap sheet state already owned by the dashboard.
- do not introduce a new team loader just for the header.

### Active World or Scenario Identity

The operating layer should show whether the user is inside an active world or
working without one.

Expected display:

- active world name when reliable metadata is already available
- active world id only as secondary/detail text
- sandbox/no-world state when no active world is selected
- archived or unavailable world state if the existing active-world owner reports
  it

Rules:

- avoid creating a competing world metadata owner.
- if world name/description are not available from the current state seam, Stage
  1 may show a conservative world id label until a read-only metadata seam is
  added.

### World Date

The operating layer should show active world date when a world is selected.

Expected display:

- world date from `worldAsOfDate`
- loading or unset state when metadata is still resolving
- no-world explanation when in sandbox/no-world mode

Rules:

- changing world date remains owned by existing `WorldTimeControls`.
- the cockpit can colocate or summarize the existing control, but must not add a
  separate write path.

### Authoritative World Season

The operating layer should show the authoritative season stored in world
metadata when a world is active.

Expected display:

- world season from `worldCurrentSeason`
- loading state while metadata is resolving
- unavailable state when no world is active

Rules:

- authoritative world season must not be inferred from the selected viewing
  season.
- season advancement remains owned by `seasonManager` through existing
  offseason workflows.

### Selected Viewing Season

The operating layer should show the currently selected dashboard viewing season.

Expected display:

- selected season from `currentYear`
- visible mismatch when selected viewing season differs from authoritative
  world season

Rules:

- changing selected viewing season remains a view/query concern.
- selected viewing season must not imply world mutation or season advancement.

### Truth and Mode Presentation

The operating layer should translate internal mode distinctions into clear
operator language.

Expected display:

- committed world mode when `worldId` is active and loaded
- sandbox/no-world mode when no world is selected
- local-only or preview labels when local audit or preview entries are shown
- pending persistence label for optimistic world preview entries
- DEV-only labels for DEV preview entries when they are visible

Rules:

- do not expose conflicting mode names across the shell.
- do not call vacuum overlay, local audit, or DEV preview state committed.
- if a summary mixes committed and local entries, each entry needs its own
  authority label.

### Roster Count

The operating layer should show a simple active-team roster count.

Expected display:

- number of rostered players for the active team
- optional split if existing data clearly distinguishes standard, two-way, or
  other roster categories
- loading or unavailable fallback

Rules:

- derive from the active `teamCapSheet` or existing roster helpers.
- do not create a separate roster query.

### Cap, Tax, and Apron Summary

The operating layer should show a compact cap posture summary for the selected
viewing season.

Expected display:

- total cap allocation or cap-space posture
- tax-space posture
- first-apron and second-apron posture
- hard-cap marker when current-season authority supports it

Rules:

- use existing cap total helpers and canonical cap sheet data.
- label the selected season used for the summary.
- avoid implying future-year hard-cap authority where the current cap sheet
  already limits that authority.

### Exceptions and TPE Summary

The operating layer should show a compact exceptions/TPE summary when reliable.

Expected display:

- available exception count or key exception availability
- active TPE count
- current-season-only note when applicable

Rules:

- use existing exception/TPE data from the active cap sheet state.
- do not summarize future-year exception authority unless the existing data
  model explicitly supports it.

### Draft Asset Summary

The operating layer should show a conservative draft asset summary.

Expected display:

- simple pick or asset count when an authoritative source is available
- clear unavailable state when the active surface has no reliable summary
- optional link to Trade Machine or History for details

Rules:

- do not invent a global draft ledger in Stage 1.
- do not merge vacuum overlay picks into committed world asset summaries.
- local overlay entries must be labeled local-only.

### Save, Loading, and Error State

The operating layer should keep save, loading, and error state visible.

Expected display:

- active world metadata loading
- team/world reload loading where available
- saving or pending persistence state
- current dashboard error
- stale or unavailable world state when detected

Rules:

- reuse state already exposed by `useArchitectState` and existing controls.
- do not add another async owner unless Stage 1 explicitly needs a read-only
  metadata seam.

### Committed Move and Event Summary

The operating layer should show recent committed scenario activity.

Expected display:

- recent world events for the active team
- event type, date, affected players/teams when normalized data supports it
- link or affordance into History for full detail

Rules:

- committed event summaries should come from world events.
- history normalization is the preferred first source.
- do not reconstruct committed event truth from local draft state.

### Local, Preview, and Pending Entries

The operating layer may show local and preview entries if they are clearly
labeled.

Expected display:

- draft or local-only entries marked local
- optimistic world preview entries marked pending persistence
- failed optimistic entries marked failed or rolled back
- DEV preview entries marked DEV-only

Rules:

- local and preview entries must not be visually merged with committed events.
- entry-level labels are required if the rail mixes authorities.
- no local preview entry should imply it changed Firestore unless a committed
  world event exists.

## Recommended UI Seams

### ArchitectWorkspaceHeader or ArchitectStatusStrip

Purpose:

- persistent top-level operating context.
- compact active team, world, date, season, mode, and status summary.

Placement:

- inside `GMDashboard`, near the existing world and season controls.

Boundary:

- read-only except for existing controls that already own writes, such as
  world selection or world date.

### ArchitectWorldCockpit

Purpose:

- a richer summary of active team, active world, world date, world season,
  selected viewing season, save state, and truth mode.

Data inputs:

- `teamCapSheet`
- `currentYear`
- `worldId`
- `worldAsOfDate`
- `worldCurrentSeason`
- `worldMetadataLoading`
- `isLoading`
- `isSaving`
- `error`
- active-world owner state if needed

Boundary:

- no direct mutations.
- may host existing controls if ownership remains unchanged.

### useArchitectWorkspaceContext

Purpose:

- compose dashboard state into a stable read-only view model for the operating
  layer.

Potential outputs:

- active team label
- active world label
- selected viewing season
- authoritative world season
- mode presentation
- roster count
- cap posture
- exception/TPE summary
- loading/error state

Boundary:

- selector/composition only.
- no Firestore reads unless a later design proves a read-only metadata seam is
  necessary.
- no writes.

### useArchitectModePresentation

Purpose:

- translate internal authority states into consistent user-facing language.

Inputs:

- `worldModeBoundary`
- `worldId`
- local audit event authority
- preview entry authority
- DEV preview flags when visible

Outputs:

- primary mode label
- secondary explanation
- entry-level authority labels

Boundary:

- presentation only.
- does not decide whether an action is allowed.

### ScenarioMoveRail

Purpose:

- show recent committed events and clearly labeled local/pending activity.

Initial sources:

- world events through existing history event hooks/normalizers
- local cap audit events when clearly labeled
- optional surface-provided draft entries in later stages

Boundary:

- read-only.
- committed entries and local/preview entries must remain visually distinct.
- no action execution in Stage 1.

### Narrow Delta Helpers

Purpose:

- provide small, trustworthy deltas without claiming complete scenario diff
  coverage.

Acceptable Stage 1 deltas:

- roster count difference when both sides are clearly defined.
- current-team cap posture difference when baseline authority is clear.
- recent committed event count.

Deferred deltas:

- full league-wide scenario diff.
- parent-world comparison.
- complete base-to-world asset diff.
- synthetic deltas derived from mixed local and committed state.

## Truth-Boundary Rules

- Stage 1 must not create a new Firestore write path.
- Stage 1 must not create new mutation authority.
- Stage 1 must not require Firestore schema changes.
- Base/source collections remain read-only.
- Committed point-in-time mutations continue through `mutationPipeline`.
- Season advancement continues through `seasonManager`.
- DEV preview state cannot be presented as committed truth.
- Local audit state cannot be presented as committed truth unless it is linked
  to a committed world transition.
- Vacuum overlays cannot be presented as committed world truth.
- Optimistic world preview state must be labeled pending until committed reload
  or world event evidence exists.
- Selected viewing season must not be assumed equal to authoritative world
  season.
- Mixed-authority summaries must label authority at the entry level.

## Stage 1 Acceptance Checklist

- Active team identity is visible from every Architect dashboard tab.
- Active world or sandbox/no-world identity is visible from every dashboard tab.
- World date is visible when a world is active.
- Authoritative world season is visible when a world is active.
- Selected viewing season is visible and distinct from world season.
- A mismatch between selected viewing season and world season is visible.
- The user can tell whether they are seeing committed world truth, no-world
  sandbox/base state, local preview, pending optimistic state, or DEV preview.
- Roster count is visible when active team data is loaded.
- Cap/tax/apron summary is visible for the selected viewing season.
- Exception/TPE summary is visible only where authority is reliable.
- Draft asset summary is conservative and never merges vacuum overlay state into
  committed world truth.
- Save, loading, and error states remain visible in the operating layer.
- Recent committed world events are visible or linked from the operating layer.
- Local, preview, pending, failed, and DEV-only entries are clearly labeled if
  shown.
- No new Firestore write path was added.
- No new mutation authority was added.
- No schema change was required.
- Existing world selection, world date, mutation, and season advancement owners
  remain the owners of their behavior.
- Stage 1 UI can be validated without running the full test suite unless
  explicitly authorized.

## Open Questions

1. What should the user-facing vocabulary be for no-world operation?

   Current code uses sandbox, base, and vacuum in different places. Stage 1
   needs one product term and a small number of secondary labels.

2. Should the cockpit show world name, branch/source world, and description?

   `useArchitectState` currently exposes world id, date, and season.
   `WorldSelector` owns world list metadata. A future cockpit should avoid
   duplicating metadata fetches or creating a competing world metadata owner.

3. What is the minimum reliable draft asset summary for the persistent strip?

   Picks are visible in trade, offseason draft positions, and history, but the
   first version should only summarize data that is already canonical for the
   active world/team.

4. How should pending local actions be represented?

   Trade drafts, offer sheets, optimistic world previews, and local validated
   base/vacuum actions have different lifecycles. A move rail needs explicit
   labels for draft, local-only, pending persistence, committed, and failed.

5. What counts as a baseline delta?

   World events are the safest first source. Snapshot diffing against original
   base, parent world, or latest loaded baseline needs a precise authority
   decision before it appears in a persistent cockpit.

6. Should league view participate in the active-world operating workspace?

   Today it is base/read-only. If the product direction is one continuous
   franchise workspace, league-level world awareness may become a later stage.
