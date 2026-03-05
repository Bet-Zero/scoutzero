# Blueprint v3 Hardening Return Package

## Verification Queue Block (Final)

Heading in blueprint: `#### Verification Queue schema`

```text
FindingID | Missing evidence | What to run/check | Owner | Status
```

- Owner must be one of: Agent | User | Both
- Status must be one of: QUEUED | IN_PROGRESS | RESOLVED | DEFERRED (with rationale)
- Rule: Any item with confidence < 70 MUST be entered into this queue.
- Rule: Verification Queue items cannot be the sole basis for "Not Ready" until upgraded with required evidence.

Example row:

```text
D-UI-003 | Cannot confirm displayed "Allowable Incoming" reflects hard-cap constraint; missing runtime proof + state-source mapping | Trace UI value source: src/features/architect/CapSheet.jsx:L120-L190 and cap calc util: src/features/architect/utils/capTotals/computeTeamCapTotals.js:L45-L140; then run/check: npm run test:diff -- --reporter=dot | Agent | QUEUED
```

## Invalid Finding Kill-Switch (Final)

Heading in blueprint: `## 7) Reusable Finding Template (Strict)`

Exact line:

`Any finding that lacks required evidence fields is INVALID and must be deleted or moved to the Verification Queue. Do not keep partial findings.`

## Refusal No-Partial-Proceeding Sentence (Final)

Heading in blueprint: `## 0) NON-NEGOTIABLES / REFUSE IF MISSING`

Exact sentence:

`If any Refuse Condition is met, STOP immediately, output the REFUSAL block, and do not provide a verdict/score/speculation for that stage.`

## Other Changes (Max 8 bullets)

- Added Table of Contents matching the current top-level blueprint headings.
- Standardized evidence anchors to `path:L123-L145`.
- Added explicit rule that line numbers must come from viewer/editor and must not be guessed.
- Added command-evidence rule: "passed" without output excerpt is invalid.
- Stage D fallback now requires artifact path `return_packages/architect/audit/D_MANUAL_QA_CHECKLIST.md`.
- Stage G verdict thresholds explicitly include: if any Critical finding exists, verdict cannot be `Ready`.
- Stage G EXIT now requires total Verification Queue count.
- Stage G EXIT now requires queued ship-blocking items count.

## Files Touched

- `return_packages/architect/audit/BLUEPRINT_V3_HARDENING_RETURN_PACKAGE.md`
- `return_packages/architect/audit/BLUEPRINT_PATCH_CHANGELOG.md`
