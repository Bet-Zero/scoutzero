# Architect Audit Blueprint V2 Summary

## One-Page Overview

Blueprint V2 keeps the existing full-system A->G audit pipeline and 10-lens rubric, but adds enforceable control contracts that change agent behavior:

- Refusal is mandatory when required access, evidence format, artifact writes, or mandatory commands are unavailable.
- Confidence is scored 0-100 with a strict Verification Queue for all findings below 70.
- Low-confidence findings cannot be the sole reason for a Not Ready verdict.
- Reuse-first and no-reaudit sampling prevents redundant audits unless staleness triggers are met.
- Baseline gate policy defaults to targeted/diff tests and forbids full-suite runs without explicit `RUN FULL SUITE` authorization.
- Every stage A-G now has ENTRY/EXIT/STOP contracts.
- Stage D includes mandatory fallback behavior when UI runtime/emulator is not available.
- Evidence is valid only with anchors, command/output snippets, expected-vs-actual, severity, ship-blocking flag, and fix/defer rationale.

## Stage List (A-G) and Required Outputs

1. Stage A - Audit Design & Traceability Seed

- Outputs:
  - `A1_ARCHITECT_SURFACE_MAP.md`
  - `A2_REQUIREMENT_MATRIX.md`
  - `A3_EVIDENCE_INDEX.md`
  - `A4_PRIOR_ARTIFACT_REUSE_LOG.md`

2. Stage B - Static Correctness Audit

- Outputs:
  - `B1_<domain>_STATIC_AUDIT.md` (repeated per domain set)

3. Stage C - Dynamic Behavior Audit

- Outputs:
  - `C1_TEST_COVERAGE_TO_REQUIREMENTS.md`
  - `C2_RUNTIME_PROOF_LOG.md`
  - `C3_GAP_LIST_UNTESTED_RISKS.md`

4. Stage D - UX/UI Truthfulness Audit

- Outputs:
  - `D1_UX_TRUTH_TABLE.md`
  - `D2_WORKFLOW_WALKTHROUGHS.md`
  - `D3_SCREENSHOT_INDEX.md` (when runtime path available)
  - `D4_MANUAL_QA_CHECKLIST.md` (mandatory when fallback path used)

5. Stage E - Data, Security, Boundary Audit

- Outputs:
  - `E1_DATA_BOUNDARY_AUDIT.md`
  - `E2_SECURITY_POSTURE_AUDIT.md`
  - `E3_PERSISTENCE_CONTRACT_AUDIT.md`

6. Stage F - Consistency Reconciliation

- Outputs:
  - `F1_CONTRADICTION_LEDGER.md`

7. Stage G - Confidence Scoring & Verdict

- Outputs:
  - `G1_FINAL_SCORECARD.md`
  - `G2_BLOCKER_BACKLOG.md`
  - `G3_EXEC_SUMMARY_FOR_NON_TECHNICAL_STAKEHOLDERS.md`
  - `G4_AUDIT_SUMMARY.json`

## Refusal Contract (V2)

The audit agent MUST refuse to proceed when any are true:

1. Referenced repository files cannot be opened.
2. Required evidence format (`path:startLine-endLine`, command/output evidence when required) cannot be produced.
3. Required in-repo artifacts cannot be written to `return_packages/architect/audit/`.
4. A stage marks a validation command mandatory and execution is blocked.

Refusal output must include:

- What is missing
- Which stage is blocked
- What to provide next to unblock execution

## Evidence Format Template

```markdown
### Finding: [ID]

- Domain: [domain]
- Severity: [Critical|High|Medium|Low]
- Ship-Blocking: [Yes|No]
- Statement: [...]
- Why it matters: [...]
- Primary evidence:
  - `path/to/file.ext:start-end`
  - `path/to/other.ext:start-end`
- Command(s) run:
  - `<command>`
  - Output excerpt: `<key lines>`
- Expected vs Actual:
  - Expected: [...]
  - Actual: [...]
- Confidence (0-100): [value]
- Fix recommendation: [...]
  - or Defer with rationale: [...]
```

## Verification Queue Schema

Schema:
`FindingID | Missing evidence | What to run/check | Owner | Status`

Status values:
`OPEN | IN_PROGRESS | BLOCKED | RESOLVED | DEFERRED`

Example row:
`TM-042 | Missing post-trade cap recompute runtime proof | Run npm run test:trade -- --reporter=dot and capture failing/passing excerpt for cap recompute case | trade-machine-owner | OPEN`
