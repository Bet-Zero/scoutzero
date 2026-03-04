# Architect Full-System Audit Blueprint (Agent-Orchestrated)

**Purpose:** Define the exact process for performing an extremely detailed, confidence-grade readiness audit of the full Architect GM system (not executing the audit yet).

**Scope:** `src/features/architect/**` plus all dependent compute, persistence, rules, docs, and tests that influence Architect behavior.

**Primary outcome:** A deterministic, evidence-backed verdict for every Architect surface: **Done / Not Done / Done with Conditions**.

---

## 1) Audit Principles

1. **Evidence over assertions:** Every conclusion must cite code path(s), test(s), and runtime/UX proof.
2. **SSOT integrity:** Verify authoritative sources for rules, calculations, and persistence are consistently used.
3. **Fail-closed posture:** Invalid states or unsafe writes must block or degrade safely.
4. **Boundary safety:** Never mutate source/base collections; only intended world/user collections are writable.
5. **Cross-surface coherence:** UI, engine, persistence, and docs must agree on terms, constraints, and outcomes.
6. **Reproducibility:** Any reviewer should be able to rerun commands and reach the same conclusion.

---

## 2) What “Complete and Ready” Means

Architect is only “complete and ready” if all are true:

- **Functional completeness:** intended user journeys work end-to-end.
- **Rules correctness:** CBA/business rules behave correctly across happy path + edge cases.
- **Persistence correctness:** writes are scoped, atomic where required, reload-safe, and schema-consistent.
- **UX truthfulness:** UI states, labels, warnings, and summaries accurately represent system state.
- **Regression resilience:** relevant guardrails exist and pass.
- **Operational readiness:** smoke/gates pass; known risks are explicitly documented and accepted.

---

## 3) System Inventory to Audit

### Core feature domains (`src/features/architect`)

- `GMDashboard/` (orchestration + top-level interaction flows)
- `tradeMachine/` and `utils/tradeMachine/` (validation + apply pipeline)
- `capSheet/` and `utils/capTotals`, `utils/capLegality`, `utils/salaryEngine`
- `freeAgency/`
- `offseason/` + `utils/offseason`, `seasonManager`
- `history/`
- `admin/` (entitlements/pick rights workflows)
- `contract/` (edit/signing/terms behavior)
- `utils/persistenceContracts`, `mutationPipeline`, `worldManager`, `leagueInvariants`

### Adjacent dependency surfaces

- Firestore rules + paths (`firestore.rules`, Architect path helpers)
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

## 4) Agent-Orchestrated Multi-Step Strategy

Use multiple focused AI agents with strict artifacts between stages.

## Stage A — Audit Design & Traceability Seed (Meta Audit)

**Goal:** Build the map before judging implementation.

**Agent jobs:**

- Create a full **domain-to-file map**.
- Build **requirement matrix** (intended behavior by domain).
- Build **artifact index** (tests, docs, CI scripts, gates).

**Deliverables:**

- `A1_ARCHITECT_SURFACE_MAP.md`
- `A2_REQUIREMENT_MATRIX.md`
- `A3_EVIDENCE_INDEX.md`

**Exit gate:** 100% Architect domains mapped; no “unknown ownership” files.

## Stage B — Static Correctness Audit (Code + Contracts)

**Goal:** Verify intended logic and boundaries at source level.

**Agent jobs by domain:**

- Inspect invariants, guard clauses, state transitions, fail-closed behavior.
- Check persistence contracts (allowed fields, write destinations, leak prevention).
- Confirm source data read-only boundaries are preserved.

**Deliverables per domain:**

- `B_<domain>_STATIC_AUDIT.md` with:
  - Findings
  - Evidence pointers (paths + line ranges)
  - Severity (Critical/High/Medium/Low)
  - Confidence score (0–100)

**Exit gate:** Every finding has direct code evidence; no untriaged critical ambiguity.

## Stage C — Dynamic Behavior Audit (Test + Runtime Proof)

**Goal:** Prove observed behavior matches claims.

**Validation tiers (run smallest-first):**

1. `npm run test:fast -- --reporter=dot`
2. `npm run test:diff -- --reporter=dot`
3. `npm run test:architect -- --reporter=dot`
4. `npm run test:trade -- --reporter=dot` (for TM-intensive claims)
5. `npm run test:smoke:architect`
6. `npm run gates:architect` (final readiness evidence)

**Agent jobs:**

- Map each major requirement to at least one passing test or runtime proof.
- Identify untested risk pockets and propose missing guardrails.
- Validate that integration flows preserve state across reload/persistence.

**Deliverables:**

- `C1_TEST_COVERAGE_TO_REQUIREMENTS.md`
- `C2_RUNTIME_PROOF_LOG.md`
- `C3_GAP_LIST_UNTESTED_RISKS.md`

**Exit gate:** No critical requirement without proof.

## Stage D — UX/UI Truthfulness & Workflow Audit

**Goal:** Ensure UX reflects backend truth and intended product behavior.

**Agent jobs:**

- Review each major workflow UI (trade, cap, FA, offseason, history).
- Confirm warnings/errors/status badges are accurate and timely.
- Validate stale-state prevention (e.g., re-validate-before-apply guards).
- Capture screenshots for each key state (success, warning, failure, blocked).

**Deliverables:**

- `D1_UX_TRUTH_TABLE.md` (UI signal ↔ actual state)
- `D2_WORKFLOW_WALKTHROUGHS.md`
- `D3_SCREENSHOT_INDEX.md`

**Exit gate:** No high-severity UI truth mismatch.

## Stage E — Data, Security, and Boundary Audit

**Goal:** Certify safe data behavior.

**Agent jobs:**

- Verify no writes to restricted/base collections.
- Confirm ownership/auth assumptions align between app logic and Firestore rules.
- Validate fail-closed rules and boundary handling in mutation paths.

**Mandatory checks:**

- Firestore rule/path review
- Persistence allowlist/deep-rule checks
- Reload parity checks for world state

**Deliverables:**

- `E1_DATA_BOUNDARY_AUDIT.md`
- `E2_SECURITY_POSTURE_AUDIT.md`
- `E3_PERSISTENCE_CONTRACT_AUDIT.md`

**Exit gate:** Zero unresolved Critical security or boundary violations.

## Stage F — Consistency Reconciliation Audit

**Goal:** Resolve contradictions across code, tests, docs, and UI.

**Agent jobs:**

- Build contradiction ledger (where two artifacts disagree).
- Assign canonical truth source for each contradiction.
- Produce fix directives with owner + exact file targets.

**Deliverable:** `F1_CONTRADICTION_LEDGER.md`

**Exit gate:** No unresolved High+ contradictions.

## Stage G — Confidence Scoring & Ship Verdict

**Goal:** Produce final confidence-grade decision.

**Scoring model (weighted):**

- Functional flows: 20%
- Rules correctness: 25%
- Persistence/data integrity: 20%
- UX truthfulness: 15%
- Security/boundaries: 15%
- Operational readiness (smoke/gates): 5%

**Verdict rules:**

- **Ready:** no Critical, ≤2 High with accepted mitigations, score ≥90
- **Conditionally Ready:** no Critical, score 80–89, explicit blockers plan
- **Not Ready:** any Critical or score <80

**Deliverables:**

- `G1_FINAL_SCORECARD.md`
- `G2_BLOCKER_BACKLOG.md`
- `G3_EXEC_SUMMARY_FOR_NON_TECHNICAL_STAKEHOLDERS.md`

---

## 5) Domain-by-Domain Checklist (What each agent must verify)

For each domain, verify all 10 lenses:

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

Use the same template per domain to guarantee uniform audit quality.

---

## 6) Required Evidence Format (Strict)

Each finding entry must include:

- `Finding ID`
- `Domain`
- `Severity`
- `Statement`
- `Why it matters`
- `Primary evidence` (path + line refs)
- `Reproduction/validation steps`
- `Expected vs actual`
- `Recommended fix`
- `Blocking status` (ship-blocking yes/no)

No finding is valid without reproducible evidence.

---

## 7) Agent Prompting Pattern (Repeatable)

For every sub-audit agent:

- Give precise scope (single domain or single risk category).
- Require citations with file paths/line refs.
- Require explicit unknowns list.
- Disallow speculative conclusions.
- Force output in a fixed rubric template.

Then run a separate **reviewer agent** to challenge that output and detect weak evidence.

---

## 8) Recommended Execution Order (Most efficient)

1. Stage A (map everything first)
2. Stage B on highest-risk domains first:
   - tradeMachine
   - capSheet/capLegality/capTotals
   - mutationPipeline/persistence/worldManager
3. Stage C focused validation for discovered risk pockets
4. Stage D UX truth audit after logic is trusted
5. Stage E security/boundary pass
6. Stage F reconciliation
7. Stage G final verdict + prioritized fix plan

This order minimizes rework and prevents deep UX checks on unstable logic.

---

## 9) Definition of Done for This Blueprint

This blueprint is successful when it enables a future team to run an exhaustive Architect audit that is:

- deterministic,
- evidence-driven,
- deeply granular,
- reproducible,
- and capable of producing a high-confidence ship verdict with clear blockers.
