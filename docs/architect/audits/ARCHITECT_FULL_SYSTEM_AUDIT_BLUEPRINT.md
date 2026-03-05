# Architect Full-System Audit Blueprint (Agent-Orchestrated, Hardened)

**Purpose:** Define the exact execution contract for a confidence-graded, evidence-backed readiness audit of the full Architect GM system (blueprint only; this document defines how to audit, not audit results).

**Scope:** `src/features/architect/**` plus dependent compute, persistence, rules, docs, tests, and Firestore boundary logic that can change Architect behavior.

**Primary outcome:** A deterministic verdict for each Architect surface: **Ready / Conditionally Ready / Not Ready** with reproducible proof.

**Execution mode:** Documentation-first audit orchestration with mandatory evidence artifacts.

## Table of Contents

1. `0) NON-NEGOTIABLES / REFUSE IF MISSING`
2. `1) Audit Principles (Enforced)`
3. `2) What "Complete and Ready" Means`
4. `3) System Inventory to Audit`
5. `4) Global Governance Policies (Mandatory)`
6. `5) Agent-Orchestrated A->G Pipeline`
7. `6) Domain-by-Domain 10-Lens Rubric (Mandatory)`
8. `7) Reusable Finding Template (Strict)`
9. `8) Reviewer-Agent Challenge Protocol`
10. `9) Execution Order (Efficiency and Risk)`
11. `10) Definition of Done for This Blueprint`

---

## 0) NON-NEGOTIABLES / REFUSE IF MISSING

The audit agent MUST refuse to proceed when any requirement below is not met.

If any Refuse Condition is met, STOP immediately, output the REFUSAL block, and do not provide a verdict/score/speculation for that stage.

### Refuse Conditions

1. **Repository access missing**

- Refuse when any referenced path cannot be opened (required source file, test file, master doc, or prior return package).
- Refusal output MUST include:
  - Missing path(s)
  - Stage blocked
  - Exact next input needed

1. **Required evidence format cannot be produced**

- Refuse when findings cannot be anchored as `path:L123-L145` plus command/output evidence when commands are required.
- Refusal output MUST include:
  - Which evidence field is impossible to provide
  - Why it is impossible in current environment
  - What data or access is required to continue

1. **Required in-repo outputs cannot be written**

- Refuse when stage artifacts cannot be created at the required artifact root and naming convention.
- Refusal output MUST include:
  - Target path that failed
  - Write failure type (permissions/path policy/tooling)
  - Exact path or permission change required

1. **Stage-required validation commands cannot run**

- Refuse only when a stage explicitly marks a command as mandatory and execution is blocked.
- Refusal output MUST include:
  - Mandatory command not run
  - Blocking reason (missing tooling/env/authorization)
  - Exact remediation input required

### Refusal Response Template

```markdown
## REFUSAL

- Stage: [A|B|C|D|E|F|G]
- Missing Requirement: [repo access | evidence format | artifact write | mandatory command]
- Blocked Item(s): [...]
- Why Execution Cannot Continue: [...]
- Provide This Next: [...]
```

---

## 1) Audit Principles (Enforced)

1. **Evidence over assertions:** A claim without required evidence fields is invalid and must be removed or moved to Verification Queue.
2. **SSOT integrity:** Rule/calculation/persistence claims must cite authoritative source and consuming call site.
3. **Fail-closed posture:** Invalid states and unsafe writes must show blocking behavior in code or tests.
4. **Boundary safety:** Source/base collection write claims must include destination evidence.
5. **Cross-surface coherence:** UI, engine, persistence, and docs must not contradict the canonical truth hierarchy.
6. **Reproducibility:** Every command claim must include command text, output excerpt, and expected-vs-actual.

---

## 2) What "Complete and Ready" Means

Architect is **Ready** only when all conditions are evidenced:

- Functional completeness across intended user journeys.
- Rules correctness for CBA/business logic including edge cases.
- Persistence correctness (scope, atomicity where required, reload parity).
- UX truthfulness (displayed state, warnings, summaries match computed truth).
- Regression resilience (relevant guardrails/tests exist and pass).
- Operational readiness (required gates pass or are explicitly out-of-scope with rationale).

---

## 3) System Inventory to Audit

### Core feature domains (`src/features/architect`)

- `GMDashboard/`
- `tradeMachine/` and `utils/tradeMachine/`
- `capSheet/` and cap utilities (`capTotals`, `capLegality`, `salaryEngine`)
- `freeAgency/`
- `offseason/` and offseason utilities
- `history/`
- `admin/` (entitlements/pick-rights workflows)
- `contract/`
- persistence and invariants (`persistenceContracts`, `mutationPipeline`, `worldManager`, `leagueInvariants`)

### Adjacent dependency surfaces

- Firestore rules and path helpers (`firestore.rules`, `src/data/firestorePaths.js`)
- Shared hooks/utilities used by Architect flows
- Feature flags and environment behavior

### Canonical evidence docs to cross-check

- `docs/architect/ARCHITECT_SHIP_GATES_MASTER.md`
- `docs/architect/ARCHITECT_SMOKE_MASTER.md`
- `docs/architect/TRADE_MACHINE_MASTER.md`
- `docs/architect/CAP_SHEET_MASTER.md`
- `docs/architect/OFFSEASON_MASTER.md`
- `docs/architect/ENTITLEMENTS_MASTER.md`
- `docs/architect/return_packages/**`

---

## 4) Global Governance Policies (Mandatory)

### 4.1 Confidence Governance + Verification Queue

#### Confidence score rules (0-100)

- `90-100`: Direct code evidence plus validating test/runtime proof and no contradiction.
- `70-89`: Strong code evidence with partial runtime/test corroboration.
- `0-69`: Missing corroboration, conflicting signals, or indirect inference.

#### Enforcement

- Any finding with confidence `<70` MUST be entered in the Verification Queue.
- A `<70` finding CANNOT be the sole reason for a final **Not Ready** verdict.
- To become verdict-blocking, the finding must be upgraded to `>=70` with additional evidence.

#### Verification Queue schema

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

### 4.2 Reuse-First / No-Reaudit Policy

#### Reuse-first rule

- Prior return packages and audits MUST be reused as evidence when still valid.
- Each reused artifact must be labeled: `VALID`, `STALE`, or `SUPERSEDED` with rationale.

#### Sampling rule

- Closed domains MUST start with sampling, not full re-audit.
- Sampling minimum: 2 key files plus 2 key tests plus latest related return package.
- Expand to full re-audit only if a staleness trigger is true or sampling finds contradiction.

#### Staleness triggers

Any one trigger marks a domain `STALE` and forces expanded review:

- Files in domain changed within last 30 days.
- Schema or persistence contract changes touching the domain.
- New bug report mapped to domain behavior.
- Relevant tests currently failing in diff/scoped runs.
- Dependency/version change affecting runtime logic.

#### No-reaudit rules

Accept as already proven when all are true:

- Last audit artifact is `VALID`.
- No staleness trigger fired.
- Sampling found no contradiction.

Must be re-proven when any are true:

- Critical/High historical finding in domain is unresolved.
- Canonical truth sources disagree (code vs tests vs docs).
- Domain impacts boundary writes or cap/rules SSOT and has recent change.

### 4.3 Baseline Gates Policy

- Default validation command is targeted: `npm run test:diff -- --reporter=dot` or closest scoped suite with `--reporter=dot`.
- Full suite commands are forbidden unless user prompt explicitly contains `RUN FULL SUITE`.
- If full suite is run, Return Package MUST log:
  - Rationale for full suite
  - Exact command(s)
  - Runtime duration
  - Result summary with failing/passing counts

### 4.4 Artifact Location + Naming Conventions

#### Artifact root (required)

- `return_packages/architect/audit/`

#### Stage naming rule

- Stage artifacts MUST use prefix format: `A1_`, `A2_`, ..., `G4_`.
- Example: `A1_ARCHITECT_SURFACE_MAP.md`, `D2_WORKFLOW_WALKTHROUGHS.md`, `G4_AUDIT_SUMMARY.json`.

#### Required index artifact

- `A3_EVIDENCE_INDEX.md` is mandatory.
- It MUST map each requirement to one or more proofs:
  - Requirement ID
  - Claim summary
  - Proof anchor(s)
  - Command evidence (if applicable)
  - Current confidence

### 4.5 Required Evidence Format (Strict)

Every finding entry MUST include all fields below or it is invalid:

- `Finding ID`
- `Domain`
- `Severity` (`Critical|High|Medium|Low`)
- `Ship-Blocking` (`Yes|No`)
- `Statement`
- `Why it matters`
- `Primary evidence` with anchor format `path:L123-L145`
- `Command(s) run` with output excerpt (not "passed" only)
- `Expected vs Actual`
- `Confidence (0-100)`
- `Fix recommendation` or `Defer with rationale`

If a command is not applicable, write `N/A - reason`.

Line numbers must come from the file viewer/editor and must not be guessed.

- Rule: For command-based evidence, "passed" without an output excerpt is invalid evidence.

---

## 5) Agent-Orchestrated A->G Pipeline

Use focused agents and stage artifacts. A stage cannot start until its ENTRY conditions are true.

### Stage A - Audit Design and Traceability Seed

**Goal:** Build coverage map and requirement-to-proof scaffolding.

**Deliverables:**

- `A1_ARCHITECT_SURFACE_MAP.md`
- `A2_REQUIREMENT_MATRIX.md`
- `A3_EVIDENCE_INDEX.md`
- `A4_PRIOR_ARTIFACT_REUSE_LOG.md`

#### ENTRY

- Repo read access available for all Architect source/test/doc paths.
- Artifact root writable: `return_packages/architect/audit/`.
- Canonical doc list for cross-check loaded.

#### EXIT

- 100% known Architect domains mapped to owners/files.
- Requirement matrix includes requirement IDs for all audited domains.
- Evidence index skeleton created with requirement IDs and planned proof slots.
- Reuse log classifies prior artifacts (`VALID|STALE|SUPERSEDED`).

#### STOP

- Unknown ownership remains for any domain-critical file.
- Required path cannot be opened or indexed.
- Artifact write fails.

### Stage B - Static Correctness Audit (Code and Contracts)

**Goal:** Validate source-level logic, contracts, and boundary correctness by domain.

**Deliverables per domain:**

- `B1_<domain>_STATIC_AUDIT.md` (repeat numeric suffixes per domain set)

#### ENTRY

- Stage A EXIT artifacts exist.
- Domain selection includes risk ordering and staleness status.

#### EXIT

- Every finding includes required evidence fields.
- Every `<70` confidence finding is in Verification Queue.
- Source/base collection write audit completed per domain.

#### STOP

- Contradictory code evidence cannot be resolved by canonical hierarchy.
- Required source file for a claim cannot be read.
- Claim depends on missing evidence format fields.

### Stage C - Dynamic Behavior Audit (Tests and Runtime Proof)

**Goal:** Validate observed behavior against requirement claims.

**Validation command ladder (smallest-first):**

1. `npm run test:fast -- --reporter=dot`
2. `npm run test:diff -- --reporter=dot`
3. `npm run test:architect -- --reporter=dot`
4. `npm run test:trade -- --reporter=dot` (when trade claims are in scope)
5. `npm run test:smoke:architect` (if available in repo)
6. `npm run gates:architect` (if available and explicitly required for final readiness)

**Deliverables:**

- `C1_TEST_COVERAGE_TO_REQUIREMENTS.md`
- `C2_RUNTIME_PROOF_LOG.md`
- `C3_GAP_LIST_UNTESTED_RISKS.md`

#### ENTRY

- Stage B findings and requirement IDs available.
- Gate scope declared (targeted/scoped/full).
- Full suite authorization present only if prompt contains `RUN FULL SUITE`.

#### EXIT

- Each critical requirement has test or runtime proof entry.
- Command logs include command text, runtime, and output snippets.
- Unproven critical requirements are explicitly marked and routed to queue/backlog.

#### STOP

- Mandatory stage command fails to execute and cannot be remediated.
- Requested full suite lacks explicit authorization phrase.
- Runtime/test output cannot be captured in evidence format.

### Stage D - UX/UI Truthfulness and Workflow Audit

**Goal:** Prove UI outputs and workflows match backend/state truth.

**Primary path prerequisites:**

- Dev server and emulator/runtime path available when required by scenario.

**Fallback path (required when runtime cannot be executed):**

If emulator/dev-server/manual UI execution is not possible, perform both:

1. **UI truthfulness code-trace audit**

- Trace entrypoint component -> state source -> condition -> displayed value/message.
- For every claim, record `path:L123-L145` anchors for:
  - entrypoint render path
  - state derivation
  - condition gates
  - displayed numbers/messages
  - error/warning message branches

1. **Manual QA checklist artifact for human execution**

- Create `return_packages/architect/audit/D_MANUAL_QA_CHECKLIST.md` with exact steps and expected results per workflow.
- Each checklist item must include:
  - Precondition
  - Action
  - Expected UI result
  - Expected persisted/system result

**Deliverables:**

- `D1_UX_TRUTH_TABLE.md`
- `D2_WORKFLOW_WALKTHROUGHS.md`
- `D3_SCREENSHOT_INDEX.md` (if runtime path available)
- `D_MANUAL_QA_CHECKLIST.md` in `return_packages/architect/audit/` (mandatory when fallback path used)

#### ENTRY

- Stage C requirement/test map exists.
- Workflow list and UI surfaces in scope are declared.

#### EXIT

- Every audited UI claim maps to state source and condition proof.
- Fallback path artifacts exist when runtime unavailable.
- No unresolved High-severity UI truth mismatch.

#### STOP

- UI claim cannot be traced to source/state/condition.
- Required workflow cannot be represented in checklist format.
- Evidence anchors for displayed values/messages are missing.

### Stage E - Data, Security, and Boundary Audit

**Goal:** Prove persistence safety, rule alignment, and boundary protection.

**Deliverables:**

- `E1_DATA_BOUNDARY_AUDIT.md`
- `E2_SECURITY_POSTURE_AUDIT.md`
- `E3_PERSISTENCE_CONTRACT_AUDIT.md`

#### ENTRY

- Stages B-D artifacts available.
- Firestore rules and path helper references loaded.

#### EXIT

- No unresolved Critical security or boundary violation.
- Write-path allowlist evidence documented with anchors.
- Reload parity claims include proof source (test/runtime/code-trace).

#### STOP

- Write destination for critical mutation path is unknown.
- Firestore rule/path behavior evidence is contradictory and unresolved.
- Required contract proof cannot be anchored.

### Stage F - Consistency Reconciliation Audit

**Goal:** Remove contradictions across code, tests, docs, and prior return packages.

**Canonical truth hierarchy:**

1. Running code behavior
2. Passing tests
3. Master docs (`docs/architect/*_MASTER.md`)
4. Return packages
5. Inline comments

**Deliverable:**

- `F1_CONTRADICTION_LEDGER.md`

#### ENTRY

- Stages A-E artifacts complete.
- Contradiction candidates collected.

#### EXIT

- Every contradiction has a recorded winner source and rationale.
- Required lower-authority updates are listed with file targets.
- No unresolved High+ contradiction remains open.

#### STOP

- Contradiction cannot be adjudicated due to missing source access.
- Two top-ranked sources conflict without executable tie-break evidence.
- Ownership for required follow-up is unknown.

### Stage G - Confidence Scoring and Ship Verdict

**Goal:** Produce machine-readable and human-readable final readiness decision.

**Scoring model (weighted):**

- Functional flows: 20%
- Rules correctness: 25%
- Persistence/data integrity: 20%
- UX truthfulness: 15%
- Security/boundaries: 15%
- Operational readiness: 5%

**Verdict thresholds:**

- If any Critical finding exists, verdict cannot be `Ready`.
- `Ready`: no Critical, <=2 High with accepted mitigations, score >=90
- `Conditionally Ready`: no Critical, score 80-89, explicit blocker plan
- `Not Ready`: any Critical or score <80

**Deliverables:**

- `G1_FINAL_SCORECARD.md`
- `G2_BLOCKER_BACKLOG.md`
- `G3_EXEC_SUMMARY_FOR_NON_TECHNICAL_STAKEHOLDERS.md`
- `G4_AUDIT_SUMMARY.json`

#### ENTRY

- Stages A-F artifacts complete and indexed.
- Verification Queue status reviewed.

#### EXIT

- Final verdict includes score, blocker list, and confidence rationale.
- Final verdict includes total Verification Queue count and queued ship-blocking items count.
- Any queue item used as blocker is upgraded to `>=70` with evidence.
- JSON summary validates required fields.

#### STOP

- Final verdict depends only on `<70` confidence findings.
- Required synthesis artifact cannot be written.
- Scoring inputs are missing for any weighted category.

---

## 6) Domain-by-Domain 10-Lens Rubric (Mandatory)

Each domain audit MUST answer all 10 lenses:

1. Purpose and user intent
2. Input contracts (shape, validation, defaults)
3. Core algorithms/rules correctness
4. State transitions and idempotency
5. Persistence/write boundaries
6. Error handling and fail-closed behavior
7. UX state truthfulness and messaging
8. Tests/guardrails and edge-case coverage
9. Performance/reactivity hotspots
10. Docs parity with implementation

If any lens has insufficient evidence, log the gap as a finding or Verification Queue item.

---

## 7) Reusable Finding Template (Strict)

Any finding that lacks required evidence fields is INVALID and must be deleted or moved to the Verification Queue. Do not keep partial findings.

```markdown
### Finding: [ID]

- Domain: [domain]
- Severity: [Critical|High|Medium|Low]
- Ship-Blocking: [Yes|No]
- Statement: [...]
- Why it matters: [...]
- Primary evidence:
  - `path/to/file.ext:L123-L145`
  - `path/to/other.ext:L200-L248`
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

---

## 8) Reviewer-Agent Challenge Protocol

For each stage artifact, run reviewer pass criteria:

- Evidence anchors exist and support claim.
- Severity and ship-blocking flag match impact.
- Commands and output excerpts are sufficient to reproduce.
- `<70` items are queued and not used as sole blocker.

Dispute handling:

1. `WEAK`: strengthen evidence or reduce severity.
2. `REJECTED`: remove finding or replace with evidence-backed statement.
3. `MISSING`: add finding/queue item or declare explicit accepted risk.

---

## 9) Execution Order (Efficiency and Risk)

1. Stage A
2. Stage B (highest-risk domains first: trade, cap SSOT, persistence)
3. Stage C (targeted dynamic proof for discovered risks)
4. Stage D (UI truth/fallback audit)
5. Stage E (data/security boundaries)
6. Stage F (reconciliation)
7. Stage G (verdict)

---

## 10) Definition of Done for This Blueprint

This blueprint is complete only when it enforces behavior through explicit refusal, stop, entry, and exit contracts and produces reproducible artifacts in the required path/naming convention.

Required completion checks:

- All A-G stages defined with `ENTRY`, `EXIT`, `STOP`.
- Global refusal contract present and actionable.
- Verification Queue governance present and enforceable.
- Reuse-first/no-reaudit and staleness triggers defined.
- Baseline/full-suite gate policy defined with authorization phrase.
- UI fallback path defined with mandatory manual QA checklist.
- Artifact root and stage naming conventions explicitly required.
- Evidence format requires anchors, command output, expected-vs-actual, severity, ship-blocking, and recommendation/defer rationale.
