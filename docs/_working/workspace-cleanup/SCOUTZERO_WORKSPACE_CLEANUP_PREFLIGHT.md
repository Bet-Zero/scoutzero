# ScoutZero Workspace Cleanup Preflight

Preflight only. No archive, delete, move, rename, refactor, or cleanup actions were executed.

## 1. Executive Summary

ScoutZero has a documentation-shape problem more than a raw file-count problem. The repo currently mixes permanent docs, generated docs, working docs, historical evidence, and return packages across the same visible surfaces.

The largest cleanup issue is return-package sprawl. The current docs point readers toward several `docs/.../return_packages` locations that do not exist, while the actual evidence archive that is still tracked lives at the repo root in `return_packages/`, and additional return-package files are mixed directly into `docs/team-scrape/` and `docs/architect/`.

`docs/_working/` is still active, but most architect subclusters now look completed-looking rather than actively in flight because their newest files are `REVIEW_RECORD` or `CLOSEOUT_REVIEW_RECORD` documents. That makes `_working` look like a long-term evidence store instead of a bounded staging area.

There is also tooling drift. `.gitignore` would ignore new files in all known return-package destinations, while `.claudeignore` hides surfaces that the schema still describes as active or mixed, including `plans/` and `docs/team-scrape/`.

The repo does not need immediate deletion. It needs a standard first, then a bounded consolidation pass.

## 2. Current Workspace Map

| Area                                                                                                 | Current Purpose                                             | Status             | Notes                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root policy docs (`AGENTS.md`, `README.md`, `CLAUDE.md`)                                             | Entry points for repo rules and project overview            | Active             | `README.md` is still a key entry point, but some linked doc paths are stale or missing.                                                              |
| Root config files (`package.json`, `tsconfig*`, Vite/Firebase/Vitest configs, `project.schema.json`) | Build, test, deploy, schema, and tooling configuration      | Active             | Normal root config surface; not a cleanup target beyond visibility.                                                                                  |
| `docs/`                                                                                              | Main documentation tree                                     | Mixed              | 334 files across permanent docs, working docs, generated docs, audits, and historical evidence.                                                      |
| `docs/_working/`                                                                                     | In-progress or staging documentation                        | Mixed but active   | 89 markdown files under `docs/_working/architect/`; many newest files are review or closeout records.                                                |
| `return_packages/`                                                                                   | Actual tracked return-package archive in practice           | Hybrid             | 23 visible files; 20 tracked; new files here would be ignored by current `.gitignore`.                                                               |
| `plans/`                                                                                             | Plan execution tracking and plan archive                    | Mixed              | `PROJECT_SCHEMA.md` describes this as active; `.claudeignore` labels `plans/` as old/completed.                                                      |
| `archive/`                                                                                           | Root archive for stale code/docs                            | Ignored local-only | Present and gitignored; not tracked in current inventory.                                                                                            |
| `_exports/`, `dist/`, `firestore_staging/`                                                           | Generated exports, build output, and staging/tooling output | Mixed              | `_exports/` still exists as a tracked artifact surface; `dist/` is ignored; `firestore_staging/` is a real tool/docs surface rather than pure trash. |
| `dev-local/`, `.claude/`, `.cursor/`, `cursor_work/`, `.venv/`                                       | Local agent/dev-only helpers                                | Mixed local-only   | `dev-local/` and `.venv/` are ignored; `cursor_work/` is partially tracked because templates/examples are kept.                                      |
| `data/`, `cba/`, `player-scrape/`, `team-scrape/`, `functions/`                                      | Data, references, pipelines, backend, and app subsystems    | Mixed              | Cleanup should focus on visibility and routing, not content mutation in these areas.                                                                 |

## 3. Documentation Inventory

| Path                                  | Type                                        | Current Status                                    | Recommended Bucket   | Reason                                                                                                    |
| ------------------------------------- | ------------------------------------------- | ------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                           | Root policy doc                             | Active and authoritative                          | Active Source        | Primary repo operating contract for agents and workflow.                                                  |
| `README.md`                           | Root overview/setup doc                     | Active but partially stale                        | Active Source        | Still the main project entry point, but it links to at least one missing architecture doc.                |
| `docs/INDEX.md`                       | Documentation index                         | Active but stale-linked                           | Active Source        | Still the intended doc router, but it references several missing return-package and audit paths.          |
| `docs/architecture/PROJECT_SCHEMA.md` | Structural schema doc                       | Active and authoritative                          | Active Source        | Current repo map and validation reference.                                                                |
| `docs/workspace-rules/`               | Repo documentation rules                    | Active and authoritative                          | Active Source        | Small, focused, and clearly current.                                                                      |
| `docs/guides/`                        | Developer/user guides                       | Stable                                            | Permanent Docs       | Small evergreen guide set.                                                                                |
| `docs/runbooks/`                      | Operational runbooks                        | Stable                                            | Permanent Docs       | Focused operations content that should stay visible.                                                      |
| `docs/typescript/`                    | TypeScript maintenance docs                 | Stable and well-scoped                            | Permanent Docs       | Clear README separates active maintenance docs from history.                                              |
| `return_packages/typescript/`         | TypeScript evidence archive                 | Historical but still referenced                   | Historical Evidence  | Explicitly referenced by `docs/typescript/README.md` as execution evidence.                               |
| `return_packages/docs/`               | Docs stabilization evidence archive         | Historical and bounded                            | Historical Evidence  | Contains a single post-stabilization record.                                                              |
| `docs/components/`                    | Generated component hierarchy docs          | Generated but visible                             | Permanent Docs       | Useful generated reference set; should remain visible and clearly marked generated.                       |
| `docs/schema/`                        | Generated schema docs plus schema artifacts | Generated but visible                             | Permanent Docs       | Canonical schema docs live here, even though the folder also contains generated artifacts.                |
| `docs/features/`                      | Feature master docs and schema notes        | Mixed naming, mostly evergreen                    | Permanent Docs       | Should remain visible, but naming is inconsistent (`MASTER`, `DRAFT`, schema notes).                      |
| `docs/tradeMachine/`                  | Small trade-machine doc cluster             | Focused and evergreen-looking                     | Permanent Docs       | Only four docs and no obvious evidence clutter.                                                           |
| `docs/scouting/`                      | Scouting audits and master docs             | Mostly evergreen                                  | Permanent Docs       | Appears to function as a durable feature-doc area.                                                        |
| `docs/compliance/`                    | Audit/compliance docs                       | Stable                                            | Permanent Docs       | Small, clearly bounded compliance surface.                                                                |
| `docs/templates/`                     | Shared doc template                         | Active utility doc                                | Permanent Docs       | One active template used by ongoing work.                                                                 |
| `docs/team-scrape/`                   | Team-scrape docs plus many return packages  | Mixed and overloaded                              | Needs Human Decision | 51 markdown files, including about 44 return-package-style files mixed with active guides.                |
| `docs/architect/`                     | Architect docs plus audits/plans/evidence   | Mixed and overloaded                              | Needs Human Decision | 69 markdown files plus subfolders; active masters, audits, migrations, and return packages live together. |
| `docs/_working/`                      | Working-doc staging area                    | Active but carrying completed-looking material    | Working Docs         | Right place for active drafts, but not for long-term review record accumulation.                          |
| `docs/_working/architect/`            | Large architect working cluster             | Mixed active/completed                            | Working Docs         | 89 markdown files plus V1/V2/V3 continuation guides suggest drift from bounded working space.             |
| `docs/_working/workspace-cleanup/`    | Cleanup working area                        | Active                                            | Working Docs         | Correct location for this preflight and follow-on cleanup working docs.                                   |
| `docs/architect-teams-plan/`          | Bounded plan package with README            | Completed-looking                                 | Historical Evidence  | Reads like a preserved plan snapshot, not active routing.                                                 |
| `docs/migrations/`                    | Migration docs                              | Mostly historical                                 | Historical Evidence  | Useful reference, but most items read as completed migration history.                                     |
| `docs/maintenance/`                   | Post-stabilization maintenance note         | Historical and bounded                            | Historical Evidence  | Small evidence-like surface.                                                                              |
| `docs/reviews/`                       | Review ledger                               | Historical and bounded                            | Historical Evidence  | Looks like retained evidence, not an active routing surface.                                              |
| `plans/`                              | Plan directory                              | Conflicting status across docs/ignore rules       | Needs Human Decision | Schema says active plans live here; `.claudeignore` treats the whole surface as completed/old.            |
| `archive/`                            | Root archive folder                         | Hidden historical surface                         | Historical Evidence  | Already functioning as archive/local holding area.                                                        |
| `return_packages/`                    | Root return-package location                | Actual archive in practice, but policy-conflicted | Historical Evidence  | Real evidence store today, but not a clean future standard while ignore rules still block new files.      |
| `docs/return_packages/`               | Documented return-package folder            | Missing                                           | Needs Human Decision | Referenced in docs, absent in repo, and ignored by `.gitignore` for new files.                            |

## 4. Return Package Inventory

| Path                                 | Naming Style                                    |       Approx File Count | Status                                                                                                          | Recommendation                                                                                                                      |
| ------------------------------------ | ----------------------------------------------- | ----------------------: | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `return_packages/`                   | Underscore                                      |                      23 | Active canonical candidate in practice; ignored by policy for new files; 20 tracked files; missing README/index | Freeze as the current live evidence source for now; choose one canonical location and unignore it before any more package creation. |
| `return_packages/docs/`              | Underscore                                      |                       1 | Historical evidence sub-archive                                                                                 | Keep as evidence under whichever canonical archive root is chosen later.                                                            |
| `return_packages/typescript/`        | Underscore                                      |                      22 | Historical evidence archive; partially tracked under an ignored parent                                          | Keep as archive; continue linking to it from `docs/typescript/README.md`.                                                           |
| `docs/return_packages/`              | Underscore                                      |                       0 | Stale location; documented but missing                                                                          | Either create it later as the single canonical docs-facing archive or remove references to it.                                      |
| `docs/return-packages/`              | Hyphen                                          |                       0 | Duplicate naming style; stale location                                                                          | Do not revive the hyphen form.                                                                                                      |
| `docs/architect/return_packages/`    | Underscore                                      |                       0 | Stale location                                                                                                  | Do not create subsystem-specific return-package roots until the global standard is chosen.                                          |
| `docs/tradeMachine/return_packages/` | Underscore                                      |                       0 | Stale location                                                                                                  | Same as above.                                                                                                                      |
| `docs/tradeMachine/return-packages/` | Hyphen                                          |                       0 | Duplicate naming style; stale location                                                                          | Do not revive the hyphen form.                                                                                                      |
| `docs/team-scrape/return_packages/`  | Underscore                                      |                       0 | Stale location                                                                                                  | Same as above.                                                                                                                      |
| `docs/team-scrape/return-packages/`  | Hyphen                                          |                       0 | Duplicate naming style; stale location                                                                          | Do not revive the hyphen form.                                                                                                      |
| `docs/architect/`                    | Mixed (`MASTER`, `AUDIT`, `RETURN_PACKAGE`)     |  3 return-package files | Historical evidence mixed into active feature docs                                                              | Split retained execution evidence away from evergreen architect docs during cleanup execution.                                      |
| `docs/team-scrape/`                  | Mixed (`PST_*`, `RETURN_PACKAGE*`, master docs) | 44 return-package files | Historical evidence mixed into active feature docs                                                              | Split or archive retained package evidence during cleanup execution.                                                                |

Most likely canonical future return-package location: `docs/return_packages/` is the documented/intended future docs-facing location, but `return_packages/` is the current canonical-in-practice archive. Resolving that mismatch is a required execution-phase decision.

## 5. \_working Inventory

| Path                                                                     | Looks Active? | Evidence                                                                                      | Recommendation                                                                           |
| ------------------------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `docs/_working/`                                                         | Yes           | Contains active `workspace-cleanup/` plus a large `architect/` cluster with 89 markdown files | Keep as the only working-doc ingress, but remove completed-looking material over time.   |
| `docs/_working/architect/`                                               | Mixed         | Contains V1/V2/V3 continuation guides plus eight feature subclusters and a review roadmap     | Split into current initiatives vs retained review evidence before future work adds more. |
| `docs/_working/architect/ARCHITECT_CHAT_WORKFLOW_CONTINUATION_GUIDE*.md` | No            | Three versioned continuation guides sit side-by-side (`GUIDE`, `V2`, `V3`)                    | Consolidate to one keeper later or archive superseded variants.                          |
| `docs/_working/architect/free-agency/`                                   | Yes           | Newest file is `ARCHITECT_FREE_AGENCY_REVIEW_TRACKER.md`                                      | Keep as active-looking until the feature is formally closed.                             |
| `docs/_working/architect/league-view/`                                   | Probably No   | Newest file is `LEAGUE_VIEW_WHOLE_FEATURE_CLOSEOUT_REVIEW_RECORD.md`                          | Review for graduation to permanent docs or archive.                                      |
| `docs/_working/architect/multi-year-cap-table/`                          | Probably No   | Newest file is `MULTI_YEAR_CAP_TABLE_WHOLE_FEATURE_CLOSEOUT_REVIEW_RECORD.md`                 | Review for graduation to permanent docs or archive.                                      |
| `docs/_working/architect/offseason/`                                     | Probably No   | Newest file is `ARCHITECT_OFFSEASON_STEP5_REVIEW_RECORD.md`                                   | Review for archive or a single permanent summary doc.                                    |
| `docs/_working/architect/roster/`                                        | Maybe         | Newest file is `ARCHITECT_ROSTER_STEP1_REVIEW_RECORD.md`                                      | Keep visible short term, but verify whether it is still active before cleanup execution. |
| `docs/_working/architect/system-integration/`                            | Probably No   | Newest file is `ARCHITECT_SYSTEM_INTEGRATION_STEP4_REVIEW_RECORD.md`                          | Review for archive or a permanent summary/doc handoff.                                   |
| `docs/_working/architect/team-history/`                                  | Probably No   | Newest file is `TEAM_HISTORY_STEP6_REVIEW_RECORD.md`                                          | Review for archive or a permanent summary/doc handoff.                                   |
| `docs/_working/architect/world-time/`                                    | Probably No   | Newest file is `ARCHITECT_WORLD_TIME_STEP5_REVIEW_RECORD.md`                                  | Review for archive or a permanent summary/doc handoff.                                   |
| `docs/_working/workspace-cleanup/`                                       | Yes           | Empty bounded folder existed before this preflight and now holds the cleanup docs             | Keep active only for this cleanup initiative.                                            |

## 6. Broken/Stale Reference Risks

- `docs/INDEX.md` routes readers to `docs/return_packages/README.md`, `docs/return_packages/architect/`, `docs/return_packages/scouting/`, `docs/return_packages/tradeMachine/`, and `docs/team-scrape/return_packages/`; none of those paths currently exist.
- `docs/INDEX.md` links trade-machine audit docs through `docs/audits/TRADE_MACHINE_AUDIT.md` and `docs/audits/TRADE_MACHINE_FIX_PLAN.md`, but `docs/audits/` does not exist. `docs/TRADE_MACHINE_AUDIT.md` exists at the docs root, and `TRADE_MACHINE_FIX_PLAN.md` was not found anywhere in the repo.
- `README.md` links `docs/architecture/DATA_SOURCE_MAP.md`, but no `DATA_SOURCE_MAP.md` file was found in the workspace.
- `.gitignore` ignores all named return-package destinations, including `return_packages/`, yet the repo already tracks files under root `return_packages/`. That means the documented archive exists, but future additions silently fall into ignored/untracked behavior unless forced.
- `.claudeignore` hides `plans/` as if all plans are old/completed, while `docs/architecture/PROJECT_SCHEMA.md` still describes `plans/` as the active plan surface.
- `.claudeignore` hides all of `docs/team-scrape/`, but that folder currently contains both active docs and historical evidence. That is an AI-routing risk, not just a cleanup issue.
- `docs/RETURN_PACKAGES_CONSOLIDATION.md` describes a consolidation outcome that is not reflected in the current workspace layout.
- `docs/INDEX.md` reports a fresh update date (`May 2, 2026`) even though several routed paths are missing. The date cannot be used as a freshness signal by itself.

## 7. Cleanup Categories

### Keep Visible

- `AGENTS.md`, `README.md`, `docs/INDEX.md`, and `docs/architecture/PROJECT_SCHEMA.md`
- `docs/workspace-rules/`, `docs/guides/`, `docs/runbooks/`, `docs/typescript/`, `docs/compliance/`, `docs/templates/`
- Generated reference surfaces that still help navigation: `docs/components/` and `docs/schema/`
- Focused feature-doc areas that do not currently show major evidence sprawl: `docs/tradeMachine/`, `docs/scouting/`, `docs/features/`

### Move to Archive

- Completed-looking `_working` architect clusters whose newest files are closeout or review records: `docs/_working/architect/league-view/`, `docs/_working/architect/multi-year-cap-table/`, `docs/_working/architect/system-integration/`, `docs/_working/architect/team-history/`, and likely `docs/_working/architect/world-time/`
- Bounded historical plan/migration packages that are useful for reference but not active routing: `docs/architect-teams-plan/`, much of `docs/migrations/`, and `docs/maintenance/`

### Consolidate

- All return-package destinations and references into one canonical underscore path
- `docs/architect/`, which currently mixes evergreen docs, audit docs, plan docs, and return-package evidence
- `docs/team-scrape/`, which currently mixes active pipeline docs with a large package-evidence set
- `docs/_working/architect/`, especially the side-by-side continuation guide versions
- Repo rules around `plans/`, because schema routing and ignore rules currently disagree

### Delete Candidates

- None confirmed safely from inventory alone
- Even the most duplicate-looking items, such as the versioned continuation guides in `docs/_working/architect/`, still need a keeper/merge decision before deletion is safe

### Needs User Decision

- Whether the canonical long-term return-package archive should be root `return_packages/` or `docs/return_packages/`
- Whether completed working docs should remain visible as historical evidence or move behind an archive namespace
- Whether cleanup execution may rename/normalize legacy doc filenames, or whether existing filenames must be preserved as historical evidence
- How `plans/` should be treated going forward: active execution surface, historical evidence, or a split model

## 8. Proposed Documentation Standard

- Permanent docs: keep all evergreen guidance in `docs/` topic folders plus the root routing docs (`README.md`, `docs/INDEX.md`, `AGENTS.md`).
- Working docs: keep all in-flight material only under `docs/_working/<initiative>/`; when a workstream closes, graduate one summary to permanent docs or move the set to archive.
- Return packages: use one canonical underscore path only. Proposed standard: `docs/return_packages/<area>/`, with no return-package files mixed into feature root folders.
- Archive docs: keep completed evidence in one archive namespace separate from active docs, and keep doc archives separate from code archives.
- Generated docs: keep generated outputs only in `docs/components/` and `docs/schema/`, clearly marked generated and not manually edited.
- Feature docs: keep evergreen masters and reference docs in feature/topic folders, but move audit/closeout evidence out of the feature root.
- Runbooks: keep only operator procedures in `docs/runbooks/`.
- Agent prompts: keep permanent prompts/rules in root policy files and `docs/cursor-prompts/`; keep local personal agent context outside permanent docs.

## 9. Recommended Next Execution Phases

1. Decide and document the canonical return-package location, then unignore only that location.
2. Write the cleanup master doc and classification rules for permanent docs, working docs, archives, and generated docs.
3. Separate mixed evidence from evergreen docs in `docs/architect/` and `docs/team-scrape/`.
4. Audit `docs/_working/` and graduate or archive completed-looking clusters.
5. Repair stale references in `README.md`, `docs/INDEX.md`, ignore rules, and any folder README/index files.
6. Add guardrails so future return packages and working docs cannot sprawl into ad hoc locations again.

## 10. Open Questions

- Should the future canonical return-package archive live at root `return_packages/` or under `docs/return_packages/`?
- When a working-doc cluster is completed, should the default outcome be archive, permanent-summary doc, or both?
- During execution, may historical doc filenames be normalized for consistency, or must legacy names remain untouched?
- Should `plans/` remain a first-class visible execution surface, or should only current plans stay visible while old plans move behind archive routing?
