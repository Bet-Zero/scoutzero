# Workspace Cleanup Historical Docs Follow-Up Preflight Return Package

## Baseline Validation

- `get_changed_files`: clean before follow-up edits.

## Scope

- `docs/architect/ARCHITECT_CAP_SHEET_REVIEW_TRACKER.md`
- `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`
- `docs/architect/EDIT_CONTRACT_MASTER.md`
- `docs/architect/TRADE_MACHINE_MASTER.md`
- `docs/tradeMachine/TRADE_MACHINE_DRAFT_PICKS_MASTER.md`

Goal: determine whether the carried-forward historical return-package references
from Phase 5 and Phase 6 can now be repaired directly or must remain a bounded
human-review follow-up.

## Decision

- Direct repair remains blocked.
- Representative filename probes for each reference cluster returned `No files
  found`.
- `docs/return_packages/` currently contains only `architect/`, `docs/`,
  `general/`, `team-scrape/`, `typescript/`, and `workspace-cleanup/`.
- No canonical `docs/return_packages/trade_machine/`,
  `docs/return_packages/tradeMachine/`, or `docs/return_packages/cap_sheet/`
  directories exist for most of the historical targets referenced by these
  docs.
- Because these are historical master/tracker surfaces, bulk rewriting or
  stripping the references without surviving evidence would reduce truthfulness.

## Findings

Counts below come from targeted reference scans of the five carried-forward
documents.

| Document | Ref count | Historical reference pattern | Sample missing targets | Disposition |
| --- | --- | --- | --- | --- |
| `docs/architect/ARCHITECT_CAP_SHEET_REVIEW_TRACKER.md` | 16 | `return_packages/ARCHITECT_CAP_SHEET_*` | `ARCHITECT_CAP_SHEET_1A_EXECUTION_RETURN_PACKAGE.md`, `ARCHITECT_CAP_SHEET_4D_EXECUTION_RETURN_PACKAGE.md` | Keep in place for human review; no surviving targets found. |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | 51 | `docs/architect/return_packages/PHASE_*` and `return_packages/cap_sheet/*` | `PHASE_52_ROSTER_SPOT_CHARGES_UI_WIRING_EXECUTION_RETURN_PACKAGE.md`, `CAP_SHEET_E2E_SSOT_PARITY_E1_EXECUTION_RETURN_PACKAGE.md` | Keep in place for human review; current canonical architect return-package area does not contain these artifacts. |
| `docs/architect/EDIT_CONTRACT_MASTER.md` | 2 | `return_packages/architect/TM_EDIT_CONTRACT_*` | `TM_EDIT_CONTRACT_P1_PREFLIGHT_RETURN_PACKAGE.md`, `TM_EDIT_CONTRACT_E1_EXECUTION_RETURN_PACKAGE.md` | Keep in place for human review; no surviving targets found. |
| `docs/architect/TRADE_MACHINE_MASTER.md` | 160 | `return_packages/trade_machine/*` and `return_packages/ship_gates/*` | `TM_VALIDATOR_DEEP_REVIEW_P1_RETURN_PACKAGE.md`, `SHIP_GATES_RC1_FULL_SUITE_P1_PREFLIGHT_RETURN_PACKAGE.md` | Keep in place for human review; the referenced return-package families are not present in the current canonical docs tree. |
| `docs/tradeMachine/TRADE_MACHINE_DRAFT_PICKS_MASTER.md` | 13 | `docs/return-packages/*` | `trade-machine-draft-picks__phase-2-preflight__2026-01-04.md`, `TRADE_MACHINE_STEPIEN_OBLIGATIONS_WIRING__EXECUTION__2026-01-08.md` | Keep in place for human review; hyphenated legacy targets do not exist in the workspace. |

## Sample Existence Checks

| Probe | Result |
| --- | --- |
| `ARCHITECT_CAP_SHEET_1A_EXECUTION_RETURN_PACKAGE.md` | `No files found` |
| `PHASE_52_ROSTER_SPOT_CHARGES_UI_WIRING_EXECUTION_RETURN_PACKAGE.md` | `No files found` |
| `TM_VALIDATOR_DEEP_REVIEW_P1_RETURN_PACKAGE.md` | `No files found` |
| `TRADE_MACHINE_STEPIEN_OBLIGATIONS_WIRING__EXECUTION__2026-01-08.md` | `No files found` |
| `trade-machine-draft-picks__phase-2-preflight__2026-01-04.md` | `No files found` |

## Canonical Directory Snapshot

- `docs/return_packages/architect/`
- `docs/return_packages/docs/`
- `docs/return_packages/general/`
- `docs/return_packages/team-scrape/`
- `docs/return_packages/typescript/`
- `docs/return_packages/workspace-cleanup/`

Not present:

- `docs/return_packages/trade_machine/`
- `docs/return_packages/tradeMachine/`
- `docs/return_packages/cap_sheet/`

## Action Taken

- Created this bounded preflight return package instead of editing the five
  historical docs directly.
- Updated the workspace cleanup master to point at this evidence and to keep
  the remaining work framed as human review rather than automated link repair.

## Files Created

- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_HISTORICAL_DOCS_FOLLOWUP_PREFLIGHT_RETURN_PACKAGE.md`

## Files Updated

- `docs/_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_MASTER.md`

## Commands Run

- `get_changed_files`
- `grep_search` on each carried-forward doc for `return_packages/`,
  `return-packages`, and related legacy reference patterns
- `file_search` for representative missing filenames from each reference
  cluster
- `list_dir docs/return_packages`
- `npm run lint:md`
- `npm run docs:guardrails`
- `npm run validate:project`

## Commands Skipped

- `npm run build`: skipped because this follow-up is documentation-only.
- `npm run typecheck`: skipped because no application code changed.
- `npm run test:*`: skipped because this follow-up changes docs only and does
  not affect runtime behavior.

## Outcome

- [x] The carried-forward historical docs were checked against the current
  workspace instead of being guessed at.
- [x] Direct repair was rejected based on missing artifact evidence rather than
  preference.
- [x] The workspace cleanup master now links to a concrete follow-up package.
- [x] No historical master/tracker doc was rewritten without a verified
  replacement target.
- [x] `npm run lint:md` passed after the follow-up edits.
- [x] `npm run docs:guardrails` passed after the follow-up edits.
- [x] `npm run validate:project` passed after the follow-up edits.
