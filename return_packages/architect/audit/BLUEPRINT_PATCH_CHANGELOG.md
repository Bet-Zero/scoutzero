# Blueprint Patch Changelog

## Scope

This changelog documents hardening changes applied to `docs/architect/audits/ARCHITECT_FULL_SYSTEM_AUDIT_BLUEPRINT.md` while preserving the A->G pipeline and 10-lens rubric.

## Sections Added or Changed

1. Added `0) NON-NEGOTIABLES / REFUSE IF MISSING` near top of blueprint.
2. Added `4) Global Governance Policies (Mandatory)` with enforceable rules:

- Confidence governance and Verification Queue.
- Reuse-first / no-reaudit policy.
- Baseline gates policy and full-suite authorization guard.
- Artifact location and naming contract.
- Strict evidence format contract.

3. Reworked `5) Agent-Orchestrated A->G Pipeline` to include `ENTRY`, `EXIT`, and `STOP` contracts for every stage A through G.
4. Added Stage D fallback contract for no-runtime conditions:

- UI truthfulness code-trace audit.
- Mandatory human-run manual QA checklist artifact.

5. Tightened finding/evidence requirements and added reusable strict finding template.
6. Added enforcement language in Definition of Done so blueprint completeness is behavior-based, not descriptive.

## Ultimate Blueprint Sections Incorporated (by heading name)

The following headings from `docs/architect/ARCHITECT_ULTIMATE_AUDIT_BLUEPRINT.md` were incorporated into hardened rules:

1. `Audit Philosophy & AI Agent Considerations`
2. `Phase Execution Contracts (Entry, Exit, Stop Conditions)`
3. `Evidence Sufficiency Standard`
4. `Low-confidence handling`
5. `Verification Queue template`
6. `Reuse-First Protocol (Mandatory)`
7. `No-Reaudit Sampling Rules`
8. `Phase 3: UX/UI Completeness Audit`
9. `Audit Output Artifacts`
10. `Quality Control`

## Ambiguous Language Removed or Rewritten

At least five ambiguous patterns were replaced with enforceable language:

1. Before: "Every conclusion must cite code path(s), test(s), and runtime/UX proof."
   After: "A claim without required evidence fields is invalid and must be removed or moved to Verification Queue."

2. Before: "Verify authoritative sources for rules, calculations, and persistence are consistently used."
   After: "Rule/calculation/persistence claims must cite authoritative source and consuming call site."

3. Before: "No critical requirement without proof."
   After: "Each critical requirement has test or runtime proof entry; unproven critical requirements must be marked and routed to queue/backlog."

4. Before: "No high-severity UI truth mismatch."
   After: "Every audited UI claim maps to state source and condition proof; unresolved High mismatch fails Stage D EXIT."

5. Before: "Every finding has direct code evidence; no untriaged critical ambiguity."
   After: "Every finding includes strict fields (anchors, command output, expected-vs-actual, confidence, ship-blocking flag), or it is invalid."

6. Before: "Any reviewer should be able to rerun commands and reach the same conclusion."
   After: "Every command claim must include command text, runtime, and output excerpt; 'passed' without output is invalid evidence."

7. Before: "Use multiple focused AI agents with strict artifacts between stages."
   After: "A stage cannot start unless ENTRY is satisfied and must halt on STOP conditions."

## Notes

- No code changes were made.
- Artifact root used in the blueprint is `return_packages/architect/audit/`.
- Stage artifact naming rule was normalized to `A1_...` through `G4_...` prefixes.

## Blueprint v3 hardening

1. Verification Queue replaced with strict schema block:
   `FindingID | Missing evidence | What to run/check | Owner | Status`.
2. Queue enforcement added:

- Owner allowed values: `Agent | User | Both`.
- Status allowed values: `QUEUED | IN_PROGRESS | RESOLVED | DEFERRED (with rationale)`.
- Confidence `< 70` must be queued.
- Queued items cannot be sole basis for `Not Ready` until evidence upgrade.

3. Added one concrete Verification Queue example row with file path anchors and explicit command.
4. Added exact kill-switch line in `7) Reusable Finding Template (Strict)`:
   `Any finding that lacks required evidence fields is INVALID and must be deleted or moved to the Verification Queue. Do not keep partial findings.`
5. Added evidence enforcement rule:

- For command-based evidence, `"passed"` without output excerpt is invalid evidence.

6. Added refusal hard-stop sentence in `0) NON-NEGOTIABLES / REFUSE IF MISSING` preventing partial proceeding.
7. Stage G hardened:

- Final verdict must report total Verification Queue count.
- Final verdict must report queued ship-blocking items count.
- Explicit statement added: if any Critical finding exists, verdict cannot be `Ready`.

8. Optional hardening performed:

- Standardized anchor format to `path:L123-L145` and added rule that line numbers must come from file viewer/editor and must not be guessed.
- Stage D fallback manual QA artifact path made explicit: `return_packages/architect/audit/D_MANUAL_QA_CHECKLIST.md`.
- Added a Table of Contents to keep heading structure explicit and consistent.

## Blueprint v3 hardening

- Added return package artifact: `return_packages/architect/audit/BLUEPRINT_V3_HARDENING_RETURN_PACKAGE.md`.
- Captured final Verification Queue block (schema + strict allowed values + one filled example row) exactly as in blueprint.
- Captured final invalid-finding kill-switch line and refusal no-partial-proceeding sentence with their blueprint headings.
- Recorded final v3 hardening deltas (anchor format, evidence strictness, Stage D fallback artifact path, and Stage G queue-count reporting).
