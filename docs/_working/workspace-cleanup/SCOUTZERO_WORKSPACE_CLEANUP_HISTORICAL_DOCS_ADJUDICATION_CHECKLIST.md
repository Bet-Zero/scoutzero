# ScoutZero Workspace Cleanup Historical Docs Adjudication Checklist

## Purpose

This checklist turns the historical-docs follow-up from an open-ended warning
into a bounded manual review workflow.

Use it with:

- `docs/return_packages/workspace-cleanup/WORKSPACE_CLEANUP_HISTORICAL_DOCS_FOLLOWUP_PREFLIGHT_RETURN_PACKAGE.md`
- `docs/_working/workspace-cleanup/SCOUTZERO_WORKSPACE_CLEANUP_MASTER.md`

## Guardrails

- Do not replace a missing return-package reference with a guessed path.
- Do not remove historical sequencing or completion claims just because the
  underlying artifact is missing.
- Prefer one documented doc-level note over many speculative per-link rewrites
  when a file is heavily historical.
- Only convert a dead markdown link to a new live link when the replacement
  file exists in the current workspace.
- Do not archive, delete, or rename any of the five carried-forward docs as
  part of this checklist.

## Outcome Codes

- `REPOINT`: a verified replacement file exists now; update the reference.
- `ANNOTATE_MISSING`: keep the historical statement but add a clear note that
  the referenced artifact is not present in the current workspace.
- `KEEP_LITERAL`: preserve the path as historical text or code formatting,
  rather than a live link, because no target survives.
- `ESCALATE`: stop and leave the doc unchanged because the doc is too dense,
  too ambiguous, or too archive-dependent for a safe local cleanup.

## Review Steps

1. Re-run a targeted filename search for one representative reference family in
   the doc.
2. Decide whether the doc is a low-volume cleanup candidate or a high-volume
   historical record.
3. Apply one outcome code per reference family, not one guessed action per
   individual link.
4. If edits are made, preserve chronology, statuses, and evidence claims.
5. Record the adjudication result in this checklist before moving to the next
   doc.

## Doc Queue

### 1. `archive/docs/architect/ARCHITECT_CAP_SHEET_REVIEW_TRACKER.md`

Profile:

- 16 references.
- Pattern: `return_packages/ARCHITECT_CAP_SHEET_*`.
- Current role: compact status tracker with link-heavy notes cells.

Recommended lane:

- Low-volume cleanup candidate.

Checklist:

- [ ] Confirm whether any `ARCHITECT_CAP_SHEET_*` package files exist anywhere
      in the current workspace.
- [ ] If none exist, decide whether the Notes column should use
      `ANNOTATE_MISSING` or `KEEP_LITERAL` instead of dead markdown links.
- [ ] Preserve all `DONE` statuses and step-completion statements.
- [ ] Record the final outcome code for this doc.

Adjudication result:

- Status: complete
- Outcome code: ESCALATE
- Notes: The doc is no longer part of the live docs surface; it now exists only under `archive/docs/architect/`. No active-doc cleanup was performed in this checklist pass.

### 2. `archive/docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

Profile:

- 51 references.
- Patterns: `docs/architect/return_packages/PHASE_*` and
  `return_packages/cap_sheet/*`.
- Current role: long-form historical architecture and chronology record.

Recommended lane:

- High-volume historical record.

Checklist:

- [ ] Separate the doc into reference families before changing anything:
      `PHASE_*` vs. `cap_sheet/*`.
- [ ] Confirm whether any current architect return packages actually match the
      later phase filenames.
- [ ] If most targets are still absent, prefer one doc-level
      `ANNOTATE_MISSING` decision over dozens of speculative inline rewrites.
- [ ] Preserve the chronology block and historical findings language.
- [ ] Record whether the safe outcome is `ANNOTATE_MISSING`, `KEEP_LITERAL`, or
      `ESCALATE`.

Adjudication result:

- Status: complete
- Outcome code: ESCALATE
- Notes: The doc is no longer part of the live docs surface; it now exists only under `archive/docs/architect/`. No active-doc cleanup was performed in this checklist pass.

### 3. `docs/architect/cap-sheet/EDIT_CONTRACT_MASTER.md`

Profile:

- 2 references.
- Pattern: `return_packages/architect/TM_EDIT_CONTRACT_*`.
- Current role: evergreen master doc with a short source-packages list.

Recommended lane:

- Low-volume cleanup candidate.

Checklist:

- [ ] Verify whether either `TM_EDIT_CONTRACT_*` package survives anywhere in
      the workspace.
- [ ] If neither survives, replace the live-link expectation with a short
      historical evidence note using `ANNOTATE_MISSING` or `KEEP_LITERAL`.
- [ ] Keep the wiring summary and findings sections intact.
- [ ] Record the final outcome code for this doc.

Adjudication result:

- Status: complete
- Outcome code: ANNOTATE_MISSING
- Notes: No `TM_EDIT_CONTRACT_*` return-package files survive in the current workspace. Added one doc-level historical note instead of guessing replacement links.

### 4. `docs/architect/TRADE_MACHINE_MASTER.md`

Profile:

- 160 references.
- Patterns: `return_packages/trade_machine/*` and
  `return_packages/ship_gates/*`.
- Current role: dense master record spanning many historical execution arcs.

Recommended lane:

- High-volume historical record.

Checklist:

- [ ] Confirm whether any canonical trade-machine return-package directory now
      exists in `docs/return_packages/`.
- [ ] If the directory family is still absent, default to `ESCALATE` rather
      than touching 160 references blindly.
- [ ] If manual cleanup is still desired later, split the doc by reference
      family before editing: validator arc, ship gates, and S&T follow-up.
- [ ] Preserve all phase history and gate outcomes.
- [ ] Record whether this doc remains blocked pending archive recovery.

Adjudication result:

- Status: pending
- Outcome code: pending
- Notes: pending

### 5. `docs/tradeMachine/TRADE_MACHINE_DRAFT_PICKS_MASTER.md`

Profile:

- 13 references.
- Pattern: `docs/return-packages/*`.
- Current role: master audit/history doc with legacy created-file tables.

Recommended lane:

- Medium-volume cleanup candidate.

Checklist:

- [ ] Verify whether any hyphenated `docs/return-packages/*` files survived in
      the current workspace.
- [ ] If none survived, decide whether those entries should stay as literal
      historical file paths or gain one doc-level missing-artifact note.
- [ ] Preserve the audit tables and created-file history language.
- [ ] Record the final outcome code for this doc.

Adjudication result:

- Status: pending
- Outcome code: pending
- Notes: pending

## Exit Condition

This checklist is complete when each of the five docs has a recorded outcome
code and either:

- a verified repair path,
- a documented `ANNOTATE_MISSING` or `KEEP_LITERAL` decision, or
- an explicit `ESCALATE` result that explains why no safe automated cleanup was
  performed.
