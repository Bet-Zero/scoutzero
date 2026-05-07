# ScoutZero Architect Docs Runtime Audit

## Purpose

Identify which existing Architect docs should become the official runtime
reference set, which should be treated as historical planning/design material,
and which remain mixed review surfaces that should not be promoted unchanged.

## Short Answer

Yes: the `docs/architect-teams-plan/` bundle is primarily a historical
planning/design package, not the current official runtime documentation set.

The implementation-critical Architect backend behavior is already documented in
other places, but it is fragmented across current runtime docs, schema docs,
and focused feature master docs rather than one canonical Architect reference
cluster.

## Audit Method

This audit compared:

- current runtime ownership docs in `src/features/architect/`
- canonical schema docs in `docs/schema/`
- focused Architect feature/master docs under `docs/architect/`
- the historical planning bundle in `docs/architect-teams-plan/`

Classification was based on whether a doc describes current code ownership,
current Firestore structure, current persistence boundaries, and current
shipping behavior rather than describing what still needed to be built.

## Bucket A - Official Runtime Set Candidates

These are the existing docs that should form the basis of the official active
Architect reference set.

| Path                                                  | Why it belongs in the runtime set                                                                                                  | Notes                                                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/features/architect/ARCHITECT_FEATURE_README.md`  | Best current ownership map for runtime authorities: world lifecycle, reads, mutation pipeline, season advance, dashboard adapters. | Should be promoted or mirrored into active docs because it currently lives under `src/`. |
| `docs/schema/CURRENT_FIRESTORE_SCHEMA.md`             | Current Firestore collection status and migration posture for `architect_base*` and `architect_worlds`.                            | Runtime-facing schema router, not planning prose.                                        |
| `docs/schema/architect.md`                            | Canonical generated schema summary pointing at `src/schemas/architect.ts`.                                                         | Keep as schema reference, not narrative architecture doc.                                |
| `docs/architect/contracts/PERSISTENCE_CONTRACTS.md`   | Documents the actual persistence boundary, allowlists, normalization, migrations, and write-path rules.                            | Core backend reference for persisted world state.                                        |
| `docs/architect/ARCHITECT_CONNECTIVITY_MASTER.md`     | Current cross-tab world-mode connectivity and write/read SSOT map.                                                                 | Good current systems-integration reference.                                              |
| `docs/architect/ENTITLEMENTS_MASTER.md`               | Current entitlement layer invariants, fallback, and DARE persistence behavior.                                                     | Current runtime/legality reference.                                                      |
| `docs/architect/OFFSEASON_MASTER.md`                  | Clearly distinguishes shipped world-wide season advance from DEV-only single-team preview.                                         | Current runtime behavior doc.                                                            |
| `docs/architect/TEAM_HISTORY_MASTER.md`               | Current canonical event-store and transaction-log behavior.                                                                        | Current runtime behavior doc.                                                            |
| `docs/architect/CAP_SHEET_MASTER.md`                  | Active SSOT doc for the Cap Sheet surface and its runtime guarantees.                                                              | Current feature-level reference.                                                         |
| `docs/architect/free_agency_MASTER.md`                | Current authoritative Free Agency world-mode wiring, validation, persistence, and sync contracts.                                  | Current feature-level reference.                                                         |
| `docs/architect/TM_CAP_INTEGRATION_MASTER.md`         | Current deterministic integration proof for Trade Machine -> Cap Sheet -> Team History.                                            | Current integration reference.                                                           |
| `docs/architect/FA_CAP_HISTORY_INTEGRATION_MASTER.md` | Current deterministic integration reference for Free Agency -> Cap Sheet -> Team History.                                          | Current integration reference.                                                           |

## Bucket B - Mixed Active Docs, Not Ready For Official Runtime Set

These docs contain useful information, but they should not be promoted as the
official Architect runtime set without cleanup or narrower extraction.

| Path                                     | Why it is mixed                                                                                                                                      | Recommendation                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `docs/architect/ARCHITECT_GAP_ANALYSIS.md` | Still contains useful current-world read/save notes, but it is a gap-analysis doc, not stable reference language.                                  | Keep active for now, but do not treat as official runtime doc. Mine it for source material only. |
| `docs/architect/TRADE_MACHINE_MASTER.md` | Top sections are current, but this file is also part of the older master-doc cluster that still contains stale historical return-package references. | Keep out of the official runtime set until it is split or cleaned.                               |

## Bucket C - Historical Planning / Design Bundle

These docs should be treated as historical design/planning material rather than
current runtime truth.

| Path                                                            | Classification                 | Why                                                                                                                |
| --------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `docs/architect-teams-plan/README.md`                           | Historical planning router     | Explicitly frames the bundle as planning documentation.                                                            |
| `archive/docs/architect-teams-plan/00-IMPLEMENTATION-STATUS.md` | Historical planning status     | Stale against current code; still says core runtime pieces were not implemented.                                   |
| `docs/architect-teams-plan/01-GOALS.md`                         | Historical planning/design     | Product goals and requirements, not runtime truth.                                                                 |
| `docs/architect-teams-plan/02-CURRENT-STATUS.md`                | Historical planning snapshot   | Captures a point-in-time pre-implementation or mid-implementation posture.                                         |
| `docs/architect-teams-plan/03-TARGET-SCHEMA.md`                 | Historical design reference    | Useful examples, but framed as target/design guidance rather than current schema authority.                        |
| `docs/architect-teams-plan/04-HOW-IT-WORKS.md`                  | Historical design explanation  | Useful conceptually, but describes proposed architecture rather than being the current official runtime explainer. |
| `docs/architect-teams-plan/05-SAVE-LOAD-LOGIC.md`               | Historical design explanation  | Valuable source material, but still written as implementation setup guidance and contains stale path details.      |
| `docs/architect-teams-plan/06-COMPREHENSIVE-SUMMARY.md`         | Historical planning summary    | Synthesizes planning conversation, not runtime truth.                                                              |
| `docs/architect-teams-plan/07-IMPLEMENTATION-PLAN.md`           | Historical implementation plan | Explicit planning/workflow doc.                                                                                    |
| `archive/docs/architect-teams-plan/summaries/*`                 | Historical planning summaries  | Agent-friendly summaries of the planning/design bundle, not current reference docs.                                |

## Bucket D - Historical / Review / Tracker Surfaces To Archive Later

These Architect docs are not good candidates for the official runtime set and
should generally be treated as historical review, roadmap, or issue-tracker
material when the next cleanup pass reaches them.

Patterns observed in `docs/architect/` that should default to historical unless
proven otherwise:

- `*_AUDIT*`
- `*_REVIEW*`
- `*_TRACKER*`
- `*_ISSUE_LOG*`
- `*_NEXT_STEPS*`
- `*_SHIP_*`
- `*_PLAN*`
- older migration execution reports under `docs/architect/migrations/`

Examples:

- `docs/architect/ARCHITECT_AUDIT_V3_MASTER.md`
- `docs/architect/TRADE_MACHINE_MASTER_AUDIT.md`
- `docs/architect/ARCHITECT_TM_REVIEW_TRACKER.md`
- `docs/architect/ARCHITECT_CAP_SHEET_ISSUE_LOG.md`
- `docs/architect/ARCHITECT_NEXT_STEPS.md`

## What This Means

The important Architect backend behavior is not undocumented, but it is not yet
presented as one clean official runtime reference set.

Today, the best current truth is split across:

- runtime ownership docs in `src/features/architect/`
- canonical schema docs in `docs/schema/`
- persistence contract docs in `docs/architect/contracts/`
- focused current feature master docs in `docs/architect/`

The planning bundle should be retained as historical design evidence, not used
as the official active documentation set.

## Recommended Next Step

Create a small official Architect runtime reference cluster from the Bucket A
docs and derive any missing narrative docs from current code, then relabel or
archive the Bucket C planning bundle as historical design material.
