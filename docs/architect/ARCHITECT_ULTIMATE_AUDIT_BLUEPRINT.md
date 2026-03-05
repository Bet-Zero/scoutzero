# ARCHITECT ULTIMATE AUDIT BLUEPRINT

**Created:** 2026-03-04  
**Purpose:** Comprehensive multi-step AI-agent audit framework for validating complete ship-readiness of the Architect GM Toolkit  
**Status:** Planning Document (Blueprint Only — Not Execution)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Scope Overview](#scope-overview)
3. [Audit Philosophy & AI Agent Considerations](#audit-philosophy--ai-agent-considerations)
4. [Multi-Phase Audit Architecture](#multi-phase-audit-architecture)
5. [Phase 0: Discovery & Baseline Mapping](#phase-0-discovery--baseline-mapping)
6. [Phase 1: Subsystem Deep Audits](#phase-1-subsystem-deep-audits)
7. [Phase 2: Cross-Subsystem Integration Audits](#phase-2-cross-subsystem-integration-audits)
8. [Phase 3: UX/UI Completeness Audit](#phase-3-uxui-completeness-audit)
9. [Phase 4: Data Integrity & Persistence Audit](#phase-4-data-integrity--persistence-audit)
10. [Phase 5: CBA Rules Correctness Audit](#phase-5-cba-rules-correctness-audit)
11. [Phase 6: Test Coverage Gap Analysis](#phase-6-test-coverage-gap-analysis)
12. [Phase 7: Documentation Completeness Audit](#phase-7-documentation-completeness-audit)
13. [Phase 8: Synthesis & Ship-Readiness Determination](#phase-8-synthesis--ship-readiness-determination)
14. [Audit Output Artifacts](#audit-output-artifacts)
15. [AI Agent Execution Guidelines](#ai-agent-execution-guidelines)
16. [Appendix A: Full File Inventory](#appendix-a-full-file-inventory)
17. [Appendix B: Existing Audit Work Reference](#appendix-b-existing-audit-work-reference)

---

## Executive Summary

The Architect is HoopZero's flagship GM Toolkit feature — a comprehensive NBA front office simulator encompassing trade construction, salary cap management, free agency, offseason transitions, draft asset tracking, and multi-year scenario planning. With **320+ source files**, **200+ test files**, and **12+ distinct subsystems**, a complete ship-readiness audit requires a systematic, multi-phase approach designed for AI agent execution.

This blueprint defines an **8-phase audit architecture** that:

- Moves from broad discovery to deep subsystem analysis to cross-cutting integration verification
- Accounts for AI agent context window limitations via scoped, parallelizable audit units
- Produces deterministic, verifiable findings with clear evidence chains
- Results in a definitive ship-readiness determination with explicit blocking issues and acceptance criteria

### Audit Scope Metrics

| Dimension | Count | Notes |
|-----------|-------|-------|
| Source Files | 320+ | `.js`, `.jsx`, `.ts`, `.tsx` in `src/features/architect/` |
| Test Files | 200+ | Across `src/tests/architect/`, `tests/trade/`, `src/tests/trade/`, `src/tests/tradeMachine/` |
| Subsystems | 12 | Trade Machine, Cap Sheet, Entitlements, Free Agency, Offseason, History, Contracts, etc. |
| Master Docs | 20+ | In `docs/architect/` |
| Return Packages | 50+ | In `return_packages/architect/`, `return_packages/entitlements/`, etc. |
| Existing Audit Artifacts | 15+ | Audit workbooks, section audits, gap analyses |

---

## Scope Overview

### Core Subsystems (In Scope)

1. **Trade Machine** — Multi-team trade construction, salary matching validation, CBA rule enforcement
2. **Cap Sheet** — Team salary cap display, exception tracking, dead money management
3. **Entitlements System** — Draft pick rights, swap rights, conveyance conditions, protection ladders
4. **Free Agency** — Offer sheets, signing workflows, restricted free agency matching
5. **Offseason Engine** — Season advance, option decisions, contract expirations, DARE resolution
6. **Team History** — Transaction logging, event emission, timeline reconstruction
7. **Contract Editor** — Contract modification, extensions, buyouts, waive/stretch
8. **GM Dashboard** — Tab orchestration, world management, team selection
9. **Entitlement Editor** — Advanced pick authoring, protection ladder templates, swap configuration
10. **Validation System** — Rule validators, legality checkers, post-state validators
11. **Persistence Layer** — Firestore mutations, world state management, optimistic updates
12. **Utility Layer** — Salary calculations, cap computations, CBA constants, season helpers

### Supporting Infrastructure (In Scope)

- Test helpers and fixtures (`tests/helpers/`, `tests/fixtures/`)
- Mock data and Firebase mocks (`tests/__mocks__/`)
- Vitest configuration files
- Type definitions (`src/features/architect/types/`)
- Schema definitions (`src/schemas/architect.ts`)

### Out of Scope

- Other HoopZero features (Scouting, Rankings, Tier Maker, Roster Builder)
- Firebase Functions backend (unless directly invoked by Architect)
- Infrastructure/deployment configuration
- Non-Architect pages and routes

---

## Audit Philosophy & AI Agent Considerations

### Core Principles

1. **Evidence-Based Findings Only** — Every finding must cite specific file paths, line numbers, or test names. No speculative conclusions.

2. **Deterministic Reproducibility** — Audit steps must be repeatable by any AI agent or human reviewer with the same results.

3. **Scoped Parallelization** — Audit units are designed to fit within AI agent context windows (typically 100-200KB of source code per unit).

4. **Progressive Depth** — Each phase builds on previous phase outputs, moving from broad discovery to surgical analysis.

5. **Fail-Closed Determination** — Ship-readiness defaults to "NOT READY" unless all blocking criteria are explicitly satisfied with evidence.

### AI Agent Limitations & Mitigations

| Limitation | Mitigation Strategy |
|------------|---------------------|
| Context window size (~200KB) | Split subsystems into independent audit units; use discovery phase to map dependencies |
| No persistent memory across sessions | Output structured artifacts (markdown files) as phase-transition handoffs |
| Can't execute UI in browser | Rely on test coverage + code review; manual QA test plan for human verification |
| May hallucinate findings | Require evidence citations for every finding; mark speculative items explicitly |
| Can't access Firebase production data | Audit schema contracts and mock data coverage; defer live data audit to manual step |
| Time cost per session | Parallelize independent subsystem audits; prioritize by ship-criticality |

### Phase Execution Contracts (Entry, Exit, Stop Conditions)

Each phase must define and follow three controls before work begins:

1. **Entry Contract** — Required input artifacts from prior phases and exact scope boundaries.
2. **Exit Contract** — Minimum required outputs and evidence before phase completion.
3. **Stop Conditions** — Conditions that force a handoff to the next phase to prevent scope creep.

**Global stop conditions:**

- If all phase audit questions are answered with cited evidence, stop and publish artifact.
- If remaining work is exploratory-only and not tied to ship-blocking criteria, defer to backlog.
- If a phase exceeds planned session range by >50%, escalate with explicit de-scope recommendation.

### Evidence Sufficiency Standard

A finding is considered complete only when it has:

- At least 2 evidence references (code line + test or doc cross-reference), and
- A confidence score from **0.00-1.00** with rationale.

Confidence guide:

- **0.90-1.00:** Direct code+test proof
- **0.70-0.89:** Strong code proof with partial test/doc confirmation
- **0.00-0.69:** Needs follow-up verification before blocking ship decision

Low-confidence handling:

- Track findings with confidence `<0.70` in a dedicated **Verification Queue** section in each phase artifact.
- Low-confidence findings cannot independently block ship; they must either be upgraded to `>=0.70` with additional evidence or explicitly deferred with owner + due date.

Verification Queue template (append after Findings Summary in each phase artifact):

```markdown
### Verification Queue (Confidence < 0.70)
| Finding ID | Current Confidence | Missing Evidence | Owner | Target Date | Status |
|------------|--------------------|------------------|-------|-------------|--------|
| ... | 0.62 | Missing: integration test and runtime repro | ... | YYYY-MM-DD | OPEN |
```

### Audit Unit Sizing Guidelines

For optimal AI agent execution:

- **Small Unit** (1 agent session): Single file or closely related file pair (< 50KB)
- **Medium Unit** (1-2 agent sessions): Single subsystem module (50-150KB)
- **Large Unit** (2-3 agent sessions): Full subsystem with tests (150-300KB)
- **XL Unit** (3+ sessions or decomposition required): Cross-subsystem integration

---

## Multi-Phase Audit Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PHASE 0: DISCOVERY & BASELINE                          │
│   Goal: Map complete file inventory, dependency graph, and existing audit work   │
│   Output: DISCOVERY_INVENTORY.md, DEPENDENCY_MAP.md                              │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        PHASE 1: SUBSYSTEM DEEP AUDITS                            │
│   Goal: Audit each of 12 subsystems independently for completeness/correctness   │
│   Output: One SUBSYSTEM_AUDIT_REPORT.md per subsystem (12 reports)               │
│                                                                                  │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│   │ Trade       │ │ Cap Sheet   │ │ Entitlements│ │ Free Agency │               │
│   │ Machine     │ │             │ │             │ │             │               │
│   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘               │
│                                                                                  │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│   │ Offseason   │ │ Team        │ │ Contract    │ │ GM          │               │
│   │ Engine      │ │ History     │ │ Editor      │ │ Dashboard   │               │
│   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘               │
│                                                                                  │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│   │ Entitlement │ │ Validation  │ │ Persistence │ │ Utilities   │               │
│   │ Editor      │ │ System      │ │ Layer       │ │             │               │
│   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘               │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   PHASE 2: CROSS-SUBSYSTEM INTEGRATION AUDITS                    │
│   Goal: Verify subsystem handoff points, data contracts, state synchronization   │
│   Output: INTEGRATION_AUDIT_MATRIX.md with pass/fail per integration point       │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      PHASE 3: UX/UI COMPLETENESS AUDIT                           │
│   Goal: Verify every user-facing surface has complete interactions and feedback  │
│   Output: UX_COMPLETENESS_AUDIT.md with component-by-component checklist         │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   PHASE 4: DATA INTEGRITY & PERSISTENCE AUDIT                    │
│   Goal: Verify Firestore read/write contracts, schema compliance, reload parity  │
│   Output: DATA_INTEGRITY_AUDIT.md with persistence contract verification         │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      PHASE 5: CBA RULES CORRECTNESS AUDIT                        │
│   Goal: Verify every CBA rule implemented matches 2023 CBA specification         │
│   Output: CBA_CORRECTNESS_AUDIT.md with rule-by-rule verification matrix         │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      PHASE 6: TEST COVERAGE GAP ANALYSIS                         │
│   Goal: Identify untested code paths, missing edge cases, test quality issues    │
│   Output: TEST_COVERAGE_GAP_ANALYSIS.md with prioritized test recommendations    │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   PHASE 7: DOCUMENTATION COMPLETENESS AUDIT                      │
│   Goal: Verify docs match implementation; identify stale or missing docs         │
│   Output: DOCUMENTATION_AUDIT.md with doc-to-code parity checklist               │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                PHASE 8: SYNTHESIS & SHIP-READINESS DETERMINATION                 │
│   Goal: Aggregate all findings; produce definitive ship-readiness verdict        │
│   Output: SHIP_READINESS_DETERMINATION.md with blocking issues and verdict       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Discovery & Baseline Mapping

### Objective

Establish complete inventory of Architect codebase, map dependencies, and catalog existing audit work to avoid redundant effort.

### Duration Estimate

1-2 AI agent sessions

### Inputs

- Full `src/features/architect/` directory
- All test directories (`src/tests/architect/`, `tests/trade/`, etc.)
- All documentation (`docs/architect/`, `return_packages/`)

### Audit Steps

#### 0.1 File Inventory Generation

Generate a complete file listing with categorization:

```
For each file in src/features/architect/**/*:
  - Record: path, file type (component/hook/util/test/type/constant)
  - Record: approximate size (lines of code)
  - Record: primary export(s)
  - Record: key dependencies (imports from other architect files)
```

**Output:** `DISCOVERY_FILE_INVENTORY.md`

#### 0.2 Dependency Graph Construction

Build a subsystem-level dependency map:

```
For each subsystem (TradeMachine, CapSheet, etc.):
  - Identify: which other subsystems it imports from
  - Identify: which subsystems import from it
  - Identify: shared utility dependencies
  - Identify: circular dependency risks
```

**Output:** `DISCOVERY_DEPENDENCY_MAP.md`

#### 0.3 Existing Audit Work Catalog

Index all prior audit artifacts to avoid redundant work:

```
For each file in docs/architect/audits/ and return_packages/*:
  - Record: audit scope (which subsystem/feature)
  - Record: audit date
  - Record: key findings (pass/fail items)
  - Record: open follow-up items
  - Record: relevance to current audit (still valid / superseded / incomplete)
```

**Output:** `DISCOVERY_PRIOR_AUDIT_INDEX.md`

#### 0.4 Baseline Gate Verification

Run and record baseline health checks:

```bash
npm run typecheck  # Must pass
npm run build      # Must pass
npm run test:diff -- --reporter=dot  # Default baseline validation for changed files in the active audit branch
# or run the most relevant scoped suite with --reporter=dot:
# npm run test:architect -- --reporter=dot
# npm run test:trade -- --reporter=dot
# Full suite only with explicit "RUN FULL SUITE" authorization.
```

**Output:** `DISCOVERY_BASELINE_GATES.md` with pass/fail status and any pre-existing failures noted

### Phase 0 Exit Criteria

- [ ] Complete file inventory with 320+ files cataloged
- [ ] Dependency map identifying all inter-subsystem relationships
- [ ] Prior audit catalog identifying what work can be reused vs. needs update
- [ ] Baseline gates all pass (or pre-existing failures documented as out-of-scope)

### Phase 0 Artifacts

| Artifact | Purpose |
|----------|---------|
| `DISCOVERY_FILE_INVENTORY.md` | Complete file listing with categorization |
| `DISCOVERY_DEPENDENCY_MAP.md` | Subsystem dependency graph |
| `DISCOVERY_PRIOR_AUDIT_INDEX.md` | Catalog of existing audit work |
| `DISCOVERY_BASELINE_GATES.md` | Baseline test/build/typecheck results |

---

## Phase 1: Subsystem Deep Audits

### Objective

Conduct independent deep audits of each of the 12 core subsystems, evaluating completeness, correctness, and ship-readiness within that subsystem's boundaries.

### Duration Estimate

1-3 AI agent sessions per subsystem (12-36 sessions total)  
**Recommendation:** Run subsystem audits in parallel across multiple agent instances

### Pilot Wave (Before Full Parallel Rollout)

Run a calibration wave on three subsystems from the Phase 1 list first (selected for high complexity, high user impact, and heavy cross-subsystem coupling):

1. Trade Machine
2. Offseason Engine
3. Persistence Layer

Use pilot outputs to calibrate severity thresholds, confidence scoring consistency, and artifact quality before scaling to all 12 subsystems.

### Reuse-First Protocol (Mandatory)

Before new subsystem analysis starts, classify existing artifacts:

- **VALID** — still accurate and can be adopted directly
- **STALE** — mostly accurate but needs targeted refresh
- **SUPERSEDED** — replaced by newer source-of-truth

Only re-audit areas marked STALE/SUPERSEDED, or VALID areas with detected implementation drift.

### No-Reaudit Sampling Rules

To prevent redundant effort:

- Do not fully re-audit closed gate suites unless implementation drift is detected.
- For stable modules with prior closure evidence, run sampling checks (key files + key tests) first.
- Expand to full re-audit only if sampling finds contradictions.

### Subsystem Audit Template

Each subsystem audit follows the same structure:

#### Standard Subsystem Audit Checklist

```markdown
## [SUBSYSTEM NAME] Audit Report

### Audit Metadata
- Audit Date: YYYY-MM-DD
- Files in Scope: [list]
- Test Files in Scope: [list]
- Related Master Docs: [list]

### 1. Purpose & Scope Verification
- [ ] Subsystem purpose is clearly defined in code/docs
- [ ] Boundaries with other subsystems are explicit
- [ ] All advertised features have implementing code

### 2. Code Completeness
- [ ] No TODO/FIXME markers blocking ship
- [ ] No disabled/commented-out feature code
- [ ] No placeholder implementations returning hardcoded values
- [ ] All error paths have user-facing feedback

### 3. Code Correctness
- [ ] Logic matches documented/intended behavior
- [ ] Edge cases are handled (nulls, empty arrays, bounds)
- [ ] No obvious race conditions or state drift
- [ ] Type safety (no unsafe casts, any types, ts-ignore)

### 4. Test Coverage
- [ ] Happy path covered
- [ ] Error paths covered
- [ ] Edge cases covered
- [ ] Integration with adjacent subsystems covered

### 5. UI/UX Surface (if applicable)
- [ ] All interactive elements are functional
- [ ] Loading/error states are rendered
- [ ] User feedback (toasts, modals) fires correctly
- [ ] Accessibility basics (aria labels, keyboard nav)

### 6. Documentation
- [ ] Code comments match implementation
- [ ] Master doc reflects current behavior
- [ ] Example usage is accurate

### 7. Findings Summary
| Finding ID | Severity | Confidence | Evidence Count | Description | Status |
|------------|----------|------------|----------------|-------------|--------|
| [SUBSYS]-001 | HIGH/MED/LOW | 0.95 | 3 | ... | OPEN/FIXED |

### 8. Ship-Readiness Determination
- [ ] READY: No HIGH findings, all MED findings acknowledged
- [ ] NOT READY: Blocking findings exist (list)
```

---

### Subsystem 1.1: Trade Machine

**Scope:** `src/features/architect/tradeMachine/`, `src/features/architect/utils/tradeMachine/`

**File Count:** ~50 source files, ~60 test files

**Key Files:**

- `TradeEditor.jsx` — Main trade construction UI
- `useTradeMachine.js` — Core trade state hook
- `tradeValidator.js` — CBA validation engine
- `validateSalaryMatching.js` — Salary matching rules
- `validateStepien.js` — Stepien rule enforcement
- `validateSignAndTrade.js` — Sign-and-trade rules

**Audit Focus Areas:**

1. Multi-team trade state management (up to 5 teams)
2. Salary matching band calculations
3. Apron/hard cap enforcement
4. Draft pick routing and Stepien rule
5. Sign-and-trade flow
6. TPE creation and usage
7. Trade preview and export
8. Validation staleness guards
9. Trade apply persistence

**Existing Audit Work to Review:**

- `docs/architect/audits/TM_AUDIT_WORKBOOK.md`
- `docs/architect/audits/TM_SEC_A1_SALARY_MATCHING.md`
- `docs/architect/audits/TM_SEC_A2_HARD_CAPS_APRONS.md`
- `docs/architect/audits/TM_SEC_A3_PICKS_ENTITLEMENTS.md`
- `docs/architect/audits/TM_SEC_A4_UI_TRUTH_SUMMARY_EXPORT.md`
- `docs/architect/audits/TM_SEC_A5_STATE_COHERENCE_MULTI_TEAM.md`
- `docs/architect/audits/TM_SEC_A6_SAVE_LOAD_IMMUTABILITY.md`
- `docs/architect/TRADE_MACHINE_MASTER_AUDIT.md`

**Output:** `SUBSYSTEM_AUDIT_TRADE_MACHINE.md`

---

### Subsystem 1.2: Cap Sheet

**Scope:** `src/features/architect/capSheet/`, `src/features/architect/CapSheet*.jsx`

**File Count:** ~15 source files, ~20 test files

**Key Files:**

- `CapSheet.jsx` — Main cap sheet display component
- `CapSheetFull.jsx` — Full-page cap sheet view
- `CapSummaryTiles.jsx` — Cap metric tiles
- `ExceptionTracker.jsx` — Exception display component
- `computeTeamCapTotals.js` — SSOT for cap calculations

**Audit Focus Areas:**

1. Cap totals calculation (SSOT in `computeTeamCapTotals`)
2. Exception display (MLE, BAE, Room, TPEs)
3. Dead money tracking
4. Cap hold computations
5. Year-switching behavior
6. Modal save workflows (manage exceptions, manage dead money)
7. Apron threshold displays

**Existing Audit Work to Review:**

- `docs/architect/CAP_SHEET_MASTER.md`
- `return_packages/architect/TM_CAP_SHEET_*.md` (E1, E2, E3, P1, P4)

**Output:** `SUBSYSTEM_AUDIT_CAP_SHEET.md`

---

### Subsystem 1.3: Entitlements System

**Scope:** `src/features/architect/utils/entitlements/`, entitlement-related validators

**File Count:** ~20 source files, ~40 test files

**Key Files:**

- `entitlementResolver.ts` — Entitlement lookup and resolution
- `entitlementIdentity.ts` — Entitlement identity key generation
- `entitlementWriter.ts` — Persistence layer for entitlements
- `entitlementExclusivityValidator.ts` — Team exclusivity enforcement
- `leagueClaimUniquenessGate.ts` — League-wide claim uniqueness
- `computeEntitlementClaims.ts` — Claim computation engine

**Audit Focus Areas:**

1. Entitlement identity generation (deterministic IDs)
2. Team exclusivity enforcement
3. League-wide claim uniqueness
4. Resolver fallback chain (world → parent → base)
5. Trade transfer mechanics
6. Protection ladder evaluation
7. Swap right resolution
8. Conveyance condition evaluation

**Existing Audit Work to Review:**

- `docs/architect/ENTITLEMENTS_MASTER.md`
- `return_packages/entitlements/*.md`

**Output:** `SUBSYSTEM_AUDIT_ENTITLEMENTS.md`

---

### Subsystem 1.4: Free Agency

**Scope:** `src/features/architect/freeAgency/`, `FreeAgentPool.jsx`, offer sheet files

**File Count:** ~10 source files, ~15 test files

**Key Files:**

- `FreeAgentPool/*.jsx` — Free agent pool UI
- `OfferSheetList.jsx` — Offer sheet management
- `freeAgentLogic.js` — FA signing logic
- `faExceptionUtils.js` — FA exception handling

**Audit Focus Areas:**

1. Signing workflows (standard, veteran minimum, exceptions)
2. Offer sheet initiation and matching
3. Sign-and-trade integration
4. FA exception usage tracking
5. Bird rights preservation
6. Cap hold creation on signing

**Existing Audit Work to Review:**

- `docs/architect/free_agency_MASTER.md`
- `return_packages/architect/TM_FREE_AGENCY_*.md`
- `return_packages/architect/TM_OFFER_SHEETS_*.md`

**Output:** `SUBSYSTEM_AUDIT_FREE_AGENCY.md`

---

### Subsystem 1.5: Offseason Engine

**Scope:** `src/features/architect/offseason/`, `src/features/architect/utils/offseason/`

**File Count:** ~15 source files, ~10 test files

**Key Files:**

- `OffseasonTab.jsx` — Offseason preview UI (DEV-only)
- `resolveOffseasonTransition.ts` — OSTE engine (core computation)
- `runOffseason.js` — Single-team offseason runner
- `seasonManager.js` — World-wide season advance

**Audit Focus Areas:**

1. Option decision processing (player/team options)
2. Contract expiration and cap hold generation
3. Exception lifecycle reset
4. Hard cap clearing
5. Dead money advancement
6. DARE entitlement resolution
7. Draft position input handling
8. Season advance persistence

**Existing Audit Work to Review:**

- `docs/architect/OFFSEASON_MASTER.md`
- `docs/architect/OFFSEASON_WORKFLOW_COMPLETION_AUDIT.md`

**Output:** `SUBSYSTEM_AUDIT_OFFSEASON.md`

---

### Subsystem 1.6: Team History

**Scope:** `src/features/architect/history/`, `TeamHistoryTab.jsx`

**File Count:** ~10 source files, ~25 test files

**Key Files:**

- `TeamHistoryTab/*.jsx` — History display UI
- `devTeamHistoryFixtures.ts` — Fixture data
- `hooks/*.ts` — History data hooks

**Audit Focus Areas:**

1. Event emission on mutations (trades, signings, etc.)
2. Event payload enrichment
3. Timeline reconstruction from events
4. Display summary rendering
5. World event querying

**Existing Audit Work to Review:**

- `docs/architect/TEAM_HISTORY_MASTER.md`

**Output:** `SUBSYSTEM_AUDIT_TEAM_HISTORY.md`

---

### Subsystem 1.7: Contract Editor

**Scope:** `src/features/architect/contract/`, contract-related modals

**File Count:** ~10 source files, ~10 test files

**Key Files:**

- `ContractEditor/*.tsx` — Contract editing form
- `ContractEditorModal/*.tsx` — Modal wrapper

**Audit Focus Areas:**

1. Contract modification workflows
2. Extension handling
3. Buyout calculations
4. Waive/stretch workflows
5. Voiding indicator display
6. Salary-by-year editing

**Existing Audit Work to Review:**

- `docs/architect/EDIT_CONTRACT_MASTER.md`
- `return_packages/architect/TM_EDIT_CONTRACT_*.md`

**Output:** `SUBSYSTEM_AUDIT_CONTRACT_EDITOR.md`

---

### Subsystem 1.8: GM Dashboard

**Scope:** `src/features/architect/GMDashboard/`

**File Count:** ~20 source files, ~5 test files

**Key Files:**

- `GMDashboard.jsx` — Main dashboard orchestrator
- `sections/*.jsx` — Tab section components
- `components/*.jsx` — Shared dashboard components
- `hooks/*.js` — Dashboard state hooks

**Audit Focus Areas:**

1. Tab navigation and routing
2. World selector behavior
3. Team selector behavior
4. Season/year switching
5. Modal orchestration
6. Action routing to handlers

**Output:** `SUBSYSTEM_AUDIT_GM_DASHBOARD.md`

---

### Subsystem 1.9: Entitlement Editor

**Scope:** `src/features/architect/admin/`

**File Count:** ~25 source files, ~15 test files

**Key Files:**

- `EntitlementEditorModal.tsx` — Main editor modal
- `PickRightWizardModal.tsx` — Guided wizard flow
- `PickSelector.tsx` — Pick selection UI
- `PickTermsPreview.tsx` — Terms preview display
- Various tab components

**Audit Focus Areas:**

1. Basic entitlement creation
2. Protection ladder authoring
3. Swap right configuration
4. Conveyance condition definition
5. Wizard translation to entitlement
6. Save and validation flows

**Existing Audit Work to Review:**

- `docs/architect/TM7_PICK_EDITOR_UX_COMPLETION_REPORT.md`

**Output:** `SUBSYSTEM_AUDIT_ENTITLEMENT_EDITOR.md`

---

### Subsystem 1.10: Validation System

**Scope:** `src/features/architect/utils/tradeMachine/rules/`, `src/features/architect/utils/tradeMachine/engine/`

**File Count:** ~30 source files, ~40 test files

**Key Files:**

- `tradeValidator.js` — Orchestrator
- `validate*.js` — Individual rule validators
- `validatorFactory.js` — Validator construction
- `postStateCapValidator.ts` — Post-mutation validation

**Audit Focus Areas:**

1. Validator orchestration and sequencing
2. Each individual rule implementation
3. Failure message generation
4. Rule enable/disable conditions
5. Post-state validation integration

**Output:** `SUBSYSTEM_AUDIT_VALIDATION_SYSTEM.md`

---

### Subsystem 1.11: Persistence Layer

**Scope:** `src/features/architect/utils/persistenceContracts/`, mutation-related files

**File Count:** ~10 source files, ~20 test files

**Key Files:**

- `persistenceContracts/contracts.js` — Persistence contracts
- `mutationPipeline.js` — Mutation execution
- `worldManager.js` — World state management

**Audit Focus Areas:**

1. Write path contracts
2. Normalization before persist
3. Optimistic update patterns
4. Reload parity verification
5. Transaction atomicity

**Output:** `SUBSYSTEM_AUDIT_PERSISTENCE.md`

---

### Subsystem 1.12: Utility Layer

**Scope:** `src/features/architect/utils/` (non-subsystem utilities)

**File Count:** ~40 source files, ~20 test files

**Key Files:**

- `salaryUtils.js`, `capUtils.js`, `contractUtils.js`
- `cbaConstants.js` — CBA magic numbers
- `seasonHelpers.ts`, `seasonUtils.js`
- `computeTeamCapTotals.js` — Cap SSOT

**Audit Focus Areas:**

1. Salary calculation correctness
2. CBA constant accuracy
3. Season/year utilities
4. Cap computation SSOT integrity

**Output:** `SUBSYSTEM_AUDIT_UTILITIES.md`

---

### Phase 1 Exit Criteria

- [ ] All 12 subsystem audit reports completed
- [ ] Each report follows standard template
- [ ] All HIGH findings documented
- [ ] Subsystem-level ship-readiness determination made

### Phase 1 Artifacts

12 subsystem audit reports, each named `SUBSYSTEM_AUDIT_[NAME].md`

---

## Phase 2: Cross-Subsystem Integration Audits

### Objective

Verify that subsystems correctly integrate with each other — data contracts are honored, state synchronization works, and handoff points don't create data loss or drift.

### Duration Estimate

3-5 AI agent sessions

### Integration Matrix

| From \ To | Trade | Cap | Entitle | FA | Offseason | History | Contract | Dashboard |
|-----------|-------|-----|---------|-------|-----------|---------|----------|-----------|
| **Trade** | — | ✓ | ✓ | ✓ | — | ✓ | — | ✓ |
| **Cap** | ✓ | — | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| **Entitle** | ✓ | — | — | — | ✓ | ✓ | — | ✓ |
| **FA** | ✓ | ✓ | — | — | ✓ | ✓ | ✓ | ✓ |
| **Offseason** | — | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| **History** | ✓ | — | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| **Contract** | — | ✓ | — | — | ✓ | ✓ | — | ✓ |
| **Dashboard** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |

### Critical Integration Points

#### 2.1 Trade → Cap Sheet

**Audit Questions:**

- Does trade apply update cap totals correctly?
- Does cap impact preview match post-trade cap sheet?
- Do apron triggers from trade correctly update hard cap status?

**Verification Method:**

- Code review of data flow from `executeTrade` to `computeTeamCapTotals`
- Test coverage analysis for trade-cap integration
- Compare UI displays before/after trade apply

---

#### 2.2 Trade → Entitlements

**Audit Questions:**

- Do entitlement transfers preserve identity?
- Is team exclusivity maintained post-trade?
- Is league claim uniqueness enforced?
- Does Stepien evaluation use correct baseline?

**Verification Method:**

- Code review of entitlement transfer in trade apply
- Test coverage for entitlement routing validators
- Review exclusivity gate tests

---

#### 2.3 Trade → History

**Audit Questions:**

- Does trade apply emit correct `CapAuditEventV1` payload?
- Is event payload enriched with all trade details?
- Can history reconstruct trade timeline?

**Verification Method:**

- Code review of event emission in trade apply
- Test coverage for event payload structure
- Review history display tests

---

#### 2.4 Free Agency → Cap Sheet

**Audit Questions:**

- Does signing update cap totals correctly?
- Are exceptions used tracked properly?
- Do cap holds generate correctly?

**Verification Method:**

- Code review of signing mutation
- Test coverage for FA-cap integration

---

#### 2.5 Free Agency → Trade (Sign-and-Trade)

**Audit Questions:**

- Does S&T flow correctly sign then trade?
- Is hard cap trigger applied correctly?
- Does validation enforce S&T rules?

**Verification Method:**

- Code review of S&T mutation pipeline
- Test coverage for S&T validator
- Review existing S&T audit findings

---

#### 2.6 Offseason → All Subsystems

**Audit Questions:**

- Does season advance correctly update all subsystems?
- Are cap holds, exceptions, dead money all processed?
- Are entitlement DARE resolutions applied?
- Is history emitted for all changes?

**Verification Method:**

- Code review of `advanceSeasonInWorld`
- Test coverage for OSTE engine
- Review post-state validation tests

---

### Phase 2 Exit Criteria

- [ ] All integration matrix cells audited
- [ ] Data contract compatibility verified at each handoff
- [ ] State synchronization issues identified
- [ ] Integration test coverage gaps noted

### Phase 2 Artifacts

- `INTEGRATION_AUDIT_MATRIX.md` — Full matrix with pass/fail per cell
- `INTEGRATION_CRITICAL_ISSUES.md` — Any blocking integration issues found

---

## Phase 3: UX/UI Completeness Audit

### Objective

Verify every user-facing surface is complete — all interactions work, all feedback is provided, all states are handled.

### Duration Estimate

3-5 AI agent sessions (code review) + manual QA session

### Audit Approach

This phase combines:

1. **Code Review** — AI agent reviews component code for completeness
2. **Manual QA Test Plan** — Human executes test scenarios from `docs/architect/audits/trade-machine-audit-plan.md` and similar

### Component Checklist Template

For each major UI component:

```markdown
### [Component Name]

**File:** `path/to/Component.jsx`

#### Interaction Completeness
- [ ] All buttons have click handlers
- [ ] All inputs have change handlers
- [ ] All selectors have options populated
- [ ] All modals have open/close/submit paths

#### State Handling
- [ ] Loading state rendered
- [ ] Error state rendered
- [ ] Empty state rendered
- [ ] Success state rendered

#### User Feedback
- [ ] Validation errors surface to user
- [ ] Save success provides confirmation
- [ ] Save failure provides explanation
- [ ] Blocking conditions explained

#### Accessibility
- [ ] Form inputs have labels
- [ ] Buttons have accessible names
- [ ] Modal focus management
- [ ] Keyboard navigation works
```

### Key UI Surfaces to Audit

1. **Trade Editor** — Team cards, player selection, pick selection, validation flow
2. **Trade Preview Modal** — Trade summary, export, download
3. **Cap Sheet Page** — Tiles, exception tracker, modals
4. **GM Dashboard** — Tab navigation, world selector, team selector
5. **Free Agent Pool** — Signing flow, offer sheet initiation
6. **Offseason Tab** — Season advance modal, option decisions
7. **Entitlement Editor** — Wizard flow, advanced editor, save flow

### Phase 3 Exit Criteria

- [ ] All major UI components audited for completeness
- [ ] Manual QA test plan executed (by human)
- [ ] Missing interactions documented
- [ ] UX polish issues cataloged

### Phase 3 Artifacts

- `UX_COMPLETENESS_AUDIT.md` — Component-by-component checklist
- `UX_MANUAL_QA_RESULTS.md` — Human QA execution results

---

## Phase 4: Data Integrity & Persistence Audit

### Objective

Verify Firestore read/write contracts are honored, schema compliance is enforced, and in-session state matches persisted state after reload.

### Duration Estimate

2-3 AI agent sessions

### Audit Focus Areas

#### 4.1 Schema Compliance

**Audit Questions:**

- Do all Firestore writes conform to `src/schemas/architect.ts`?
- Are there any untyped writes that could introduce schema violations?
- Are schema validations run before persist?

**Verification Method:**

- Review all `writeBatch` and `setDoc` calls in architect code
- Verify `validatePersistableShape` is called on write paths
- Review schema-related test coverage

---

#### 4.2 Write Path Contracts

**Audit Questions:**

- Are all required fields populated on writes?
- Are deprecated fields properly migrated?
- Is normalization applied consistently?

**Verification Method:**

- Review `persistenceContracts/contracts.js`
- Review `normalizeTeamTpe.js` and similar normalizers
- Check guardrail tests for persistence contracts

---

#### 4.3 Reload Parity

**Audit Questions:**

- Does in-session state match reloaded state?
- Are there any fields written that aren't read back?
- Are there any computed values cached that should be re-derived?

**Verification Method:**

- Review reload parity tests (phase E2E tests)
- Check for any optimistic state that doesn't persist
- Verify cap totals recompute on load

---

#### 4.4 Transaction Atomicity

**Audit Questions:**

- Are multi-write operations atomic?
- Can partial failure leave state inconsistent?
- Are compensating actions implemented for failures?

**Verification Method:**

- Review `writeBatch` usage patterns
- Check for try/catch with rollback logic
- Review fail-closed guardrail tests

---

### Phase 4 Exit Criteria

- [ ] All write paths audited for schema compliance
- [ ] Reload parity verified for all major operations
- [ ] Transaction atomicity verified for multi-step operations
- [ ] Data integrity issues documented

### Phase 4 Artifacts

- `DATA_INTEGRITY_AUDIT.md` — Write path and schema compliance analysis
- `RELOAD_PARITY_VERIFICATION.md` — Reload test results

---

## Phase 5: CBA Rules Correctness Audit

### Objective

Verify every NBA CBA rule implemented in Architect matches the 2023 CBA specification accurately.

### Duration Estimate

3-5 AI agent sessions (requires CBA knowledge)

### CBA Rule Categories

#### 5.1 Salary Matching Rules

- Band 1: Teams below apron ($0-$6.533M → 175% + $100K)
- Band 2: Teams below apron ($6.533M-$19.6M → 100% + $5M)
- Band 3: Teams below apron (≥$19.6M → 100% + 125%)
- First Apron: 110% + $100K
- Second Apron: 100% + $0 (dollar-for-dollar)

**Verification Method:**

- Review `salaryMatchingRules.js` band constants
- Compare to CBA Article VII Section 6(f)
- Run test cases for boundary conditions

---

#### 5.2 Apron Rules

- First Apron triggers: MLE (full), BAE, sign-and-trade (hard cap)
- Second Apron triggers: First apron + cash in trades, prior-year TPE ban, aggregation ban

**Verification Method:**

- Review `hardCapUtils.js` trigger definitions
- Review `validateSecondApronRules.js`
- Compare to CBA Article VII Section 6

---

#### 5.3 Stepien Rule

- Cannot trade first-round picks in consecutive years
- Must account for picks already traded in base state

**Verification Method:**

- Review `validateStepien.js` implementation
- Verify baseline + outgoing delta evaluation
- Test consecutive year detection

---

#### 5.4 Sign-and-Trade Rules

- Maximum 4-year contract
- Hard cap trigger at first apron
- Only one S&T per team per trade
- Player must be signing new contract (not under contract)

**Verification Method:**

- Review `validateSignAndTrade.js`
- Verify hard cap application in trade apply
- Test S&T constraint enforcement

---

#### 5.5 Roster Rules

- Minimum 14 players (regular season)
- Maximum 15 standard players
- Maximum 2 two-way players
- Minimum 13 standard players for offseason transactions

**Verification Method:**

- Review `validateRoster.js` and `rosterValidation.js`
- Verify grace period handling during offseason
- Test boundary conditions

---

#### 5.6 Consent Rules

- Recently acquired players (within 3 months)
- No-trade clauses
- Bird rights veto

**Verification Method:**

- Review `enforceConsent.js` and `validateConsent.js`
- Verify consent conditions are checked
- Review consent-related tests

---

#### 5.7 Exception Rules

- MLE usage restrictions
- BAE usage restrictions
- Room exception eligibility
- TPE creation and expiration

**Verification Method:**

- Review exception validators
- Review TPE lifecycle management
- Compare to CBA exception rules

---

### Phase 5 Exit Criteria

- [ ] All implemented CBA rules compared to specification
- [ ] Rule implementation accuracy verified
- [ ] Missing rules or incorrect implementations documented
- [ ] Test coverage for CBA rule boundaries verified

### Phase 5 Artifacts

- `CBA_CORRECTNESS_AUDIT.md` — Rule-by-rule verification matrix
- `CBA_DISCREPANCIES.md` — Any rules found to be incorrectly implemented

---

## Phase 6: Test Coverage Gap Analysis

### Objective

Identify untested code paths, missing edge cases, and test quality issues across the Architect test suite.

### Duration Estimate

2-3 AI agent sessions

### Audit Approach

#### 6.1 Coverage Metrics Collection

```bash
# Preferred: run diff-based and scoped suites first (repo policy)
npm run test:diff -- --reporter=dot
# Then one or more scoped suites relevant to discovered gaps:
# npm run test:architect -- --reporter=dot
# npm run test:trade -- --reporter=dot
# npm run test:roster -- --reporter=dot
# Full-suite coverage run is optional and requires explicit "RUN FULL SUITE" authorization.
```

---

#### 6.2 Test Quality Assessment

For each test file:

- **Assertion Quality:** Are assertions meaningful or just "smoke tests"?
- **Edge Case Coverage:** Are boundary conditions tested?
- **Integration Depth:** Do tests verify real integration or mock everything?
- **Guardrail Effectiveness:** Do gate tests actually prevent regression?

---

#### 6.3 Missing Test Categories

Identify gaps in:

1. **Happy Path Tests** — Basic functionality verification
2. **Error Path Tests** — Failure handling verification
3. **Edge Case Tests** — Boundary and corner cases
4. **Integration Tests** — Cross-subsystem behavior
5. **Regression Tests** — Previously-fixed bugs
6. **Guardrail Tests** — Source-level regression prevention

---

### Test Inventory by Category

| Category | Current Files | Est. Coverage | Gaps |
|----------|---------------|---------------|------|
| Trade Machine | ~60 | HIGH | TBD |
| Cap Sheet | ~20 | MEDIUM | TBD |
| Entitlements | ~40 | HIGH | TBD |
| Free Agency | ~15 | MEDIUM | TBD |
| Offseason | ~10 | LOW | TBD |
| Team History | ~25 | MEDIUM | TBD |
| Contract Editor | ~10 | LOW | TBD |
| Validation | ~40 | HIGH | TBD |

---

### Phase 6 Exit Criteria

- [ ] Coverage metrics collected (or estimated)
- [ ] Test quality assessment completed
- [ ] Priority gaps identified and documented
- [ ] Recommendations for additional tests provided

### Phase 6 Artifacts

- `TEST_COVERAGE_GAP_ANALYSIS.md` — Coverage analysis and gaps
- `TEST_RECOMMENDATIONS.md` — Prioritized list of tests to add

---

## Phase 7: Documentation Completeness Audit

### Objective

Verify documentation matches implementation, identify stale docs, and ensure operational documentation is complete.

### Duration Estimate

1-2 AI agent sessions

### Documentation Inventory

| Doc Category | Location | Count |
|--------------|----------|-------|
| Master Docs | `docs/architect/` | 20+ |
| Audit Artifacts | `docs/architect/audits/` | 15+ |
| Return Packages | `return_packages/architect/` | 30+ |
| README files | `src/features/architect/*/README.md` | ~5 |
| Code Comments | Inline | N/A |

### Audit Checklist

#### 7.1 Master Doc Accuracy

For each master doc:

- [ ] Does the doc describe current implementation (not aspirational)?
- [ ] Are code references (file paths, line numbers) still valid?
- [ ] Are feature flags and conditions correctly documented?
- [ ] Are known limitations and follow-ups accurate?

---

#### 7.2 Return Package Currency

For each return package:

- [ ] Is the work described still merged and active?
- [ ] Are the findings still relevant or superseded?
- [ ] Are the follow-up items tracked elsewhere?

---

#### 7.3 Operational Documentation

- [ ] Setup instructions are accurate
- [ ] Environment variables documented
- [ ] Testing commands documented
- [ ] Common workflows documented

---

### Phase 7 Exit Criteria

- [ ] All master docs reviewed for accuracy
- [ ] Stale documentation identified
- [ ] Missing documentation gaps identified
- [ ] Documentation update recommendations provided

### Phase 7 Artifacts

- `DOCUMENTATION_AUDIT.md` — Doc-by-doc accuracy assessment
- `STALE_DOCS_LIST.md` — Docs needing update or removal

---

## Phase 8: Synthesis & Ship-Readiness Determination

### Objective

Aggregate all findings from Phases 0-7 and produce a definitive ship-readiness verdict with explicit blocking issues and acceptance criteria.

### Duration Estimate

1-2 AI agent sessions

### Synthesis Process

#### 8.1 Finding Aggregation

Collect all findings from phase artifacts:

```markdown
| Phase | Finding ID | Severity | Confidence | Evidence Count | Subsystem | Description | Status |
|-------|------------|----------|------------|----------------|-----------|-------------|--------|
| 1 | TM-001 | HIGH | 0.95 | 3 | Trade Machine | ... | OPEN |
| 1 | TM-002 | MED | 0.81 | 2 | Trade Machine | ... | OPEN |
| 2 | INT-001 | HIGH | 0.92 | 4 | Integration | ... | OPEN |
| ... | ... | ... | ... | ... | ... | ... | ... |
```

---

#### 8.2 Blocking Issue Identification

**BLOCKING (must fix before ship):**

- Any HIGH severity finding
- Any data integrity issue that could corrupt state
- Any CBA rule implementation that is materially incorrect
- Any integration failure that causes data loss

**NON-BLOCKING (can ship with acknowledgment):**

- MED severity findings with workarounds
- LOW severity findings
- Documentation gaps
- Test coverage gaps (unless for critical paths)

---

#### 8.3 Ship-Readiness Verdict

```markdown
## SHIP-READINESS VERDICT

### Verdict: [READY / NOT READY]

### Blocking Issues (must resolve)
| ID | Description | Subsystem | Owner Module | Fix Class | Est. Effort | Verification Command | Remediation |
|----|-------------|-----------|--------------|-----------|-------------|----------------------|-------------|
| ... | ... | ... | ... | code or test or doc | S/M/L | `npm run test:architect -- --reporter=dot` | ... |

Fix Class legend:
- `code` — implementation or logic change required
- `test` — missing or incorrect test coverage required
- `doc` — documentation or runbook correction required

If a remediation spans multiple classes, list all applicable classes in one cell using + as the delimiter (for example: code+test or code+test+doc), with one verification command that proves the full fix.

### Non-Blocking Issues (acknowledged, defer to post-ship)
| ID | Description | Subsystem | Priority |
|----|-------------|-----------|----------|
| ... | ... | ... | ... |

### Acceptance Criteria Satisfied
- [ ] All subsystems pass individual audits
- [ ] All critical integration points verified
- [ ] All CBA rules correctly implemented
- [ ] Data integrity verified (reload parity)
- [ ] Manual QA test plan passed
- [ ] No HIGH severity findings remain open

### Acceptance Criteria Not Satisfied
- [ ] ... (list any unsatisfied criteria)
```

---

### Phase 8 Exit Criteria

- [ ] All findings aggregated from all phases
- [ ] Blocking vs. non-blocking classification complete
- [ ] Ship-readiness verdict issued with evidence
- [ ] Every blocking item has owner module, fix class, effort estimate, and verification command
- [ ] Remediation plan for any blocking issues provided

### Phase 8 Artifacts

- `SHIP_READINESS_DETERMINATION.md` — Final verdict document
- `BLOCKING_ISSUES_REMEDIATION_PLAN.md` — If NOT READY, plan to reach readiness

---

## Audit Output Artifacts

### Directory Structure

```
docs/architect/audits/ultimate/
├── PHASE_0_DISCOVERY/
│   ├── DISCOVERY_FILE_INVENTORY.md
│   ├── DISCOVERY_DEPENDENCY_MAP.md
│   ├── DISCOVERY_PRIOR_AUDIT_INDEX.md
│   └── DISCOVERY_BASELINE_GATES.md
├── PHASE_1_SUBSYSTEM/
│   ├── SUBSYSTEM_AUDIT_TRADE_MACHINE.md
│   ├── SUBSYSTEM_AUDIT_CAP_SHEET.md
│   ├── SUBSYSTEM_AUDIT_ENTITLEMENTS.md
│   ├── SUBSYSTEM_AUDIT_FREE_AGENCY.md
│   ├── SUBSYSTEM_AUDIT_OFFSEASON.md
│   ├── SUBSYSTEM_AUDIT_TEAM_HISTORY.md
│   ├── SUBSYSTEM_AUDIT_CONTRACT_EDITOR.md
│   ├── SUBSYSTEM_AUDIT_GM_DASHBOARD.md
│   ├── SUBSYSTEM_AUDIT_ENTITLEMENT_EDITOR.md
│   ├── SUBSYSTEM_AUDIT_VALIDATION_SYSTEM.md
│   ├── SUBSYSTEM_AUDIT_PERSISTENCE.md
│   └── SUBSYSTEM_AUDIT_UTILITIES.md
├── PHASE_2_INTEGRATION/
│   ├── INTEGRATION_AUDIT_MATRIX.md
│   └── INTEGRATION_CRITICAL_ISSUES.md
├── PHASE_3_UX/
│   ├── UX_COMPLETENESS_AUDIT.md
│   └── UX_MANUAL_QA_RESULTS.md
├── PHASE_4_DATA/
│   ├── DATA_INTEGRITY_AUDIT.md
│   └── RELOAD_PARITY_VERIFICATION.md
├── PHASE_5_CBA/
│   ├── CBA_CORRECTNESS_AUDIT.md
│   └── CBA_DISCREPANCIES.md
├── PHASE_6_TESTS/
│   ├── TEST_COVERAGE_GAP_ANALYSIS.md
│   └── TEST_RECOMMENDATIONS.md
├── PHASE_7_DOCS/
│   ├── DOCUMENTATION_AUDIT.md
│   └── STALE_DOCS_LIST.md
├── PHASE_8_SYNTHESIS/
│   ├── SHIP_READINESS_DETERMINATION.md
│   └── BLOCKING_ISSUES_REMEDIATION_PLAN.md
└── AUDIT_EXECUTION_LOG.md
```

---

## AI Agent Execution Guidelines

### Session Planning

Each audit phase should be executed as one or more AI agent sessions:

| Phase | Sessions | Parallelizable | Dependencies |
|-------|----------|----------------|--------------|
| 0 | 1-2 | No | None |
| 1 | 12-36 | **YES** (subsystems independent) | Phase 0 |
| 2 | 3-5 | Partially | Phase 1 |
| 3 | 3-5 | Partially | Phase 1 |
| 4 | 2-3 | No | Phase 1 |
| 5 | 3-5 | No | Phase 1 |
| 6 | 2-3 | No | Phase 1 |
| 7 | 1-2 | No | Phase 1 |
| 8 | 1-2 | No | All previous |

**Total Estimated Sessions:** 30-65 (heavily dependent on parallelization)

---

### Session Prompting Template

When starting an audit session, use this prompt template:

```markdown
You are conducting Phase [X], Step [Y] of the Architect Ultimate Audit.

## Context
- Blueprint: docs/architect/ARCHITECT_ULTIMATE_AUDIT_BLUEPRINT.md
- Prior Phase Output: [link to prior phase artifact if applicable]

## Scope for This Session
[List specific files/directories to analyze]

## Audit Questions
[List specific questions from blueprint for this step]

## Expected Output
[Describe expected artifact format]

## Constraints
- Cite specific file paths and line numbers for all findings
- Mark speculative findings explicitly
- Follow standard finding template:
  [SEVERITY: HIGH/MED/LOW] — Title
  Location: file:line
  Problem: ...
  Fix: ...
  Impact: ...
```

---

### Session Handoff Protocol

At the end of each session:

1. **Save Output** — Write audit findings to markdown file in appropriate directory
2. **Update Log** — Append session summary to `AUDIT_EXECUTION_LOG.md`
3. **Note Blockers** — If session cannot complete, document what's needed
4. **Identify Follow-ups** — List any questions for subsequent sessions

---

### Quality Control

Every audit finding must include:

- **Evidence:** File path and line number (or test name)
- **Severity:** HIGH / MED / LOW with clear criteria
- **Reproducibility:** Steps to verify the finding
- **Impact:** Why this matters for ship-readiness

Speculative findings must be labeled:

```markdown
[SPECULATIVE — requires X to confirm]
```

---

## Appendix A: Full File Inventory

> Note: This section will be populated by Phase 0 Discovery

### Source Files (320+)

```
src/features/architect/
├── ARCHITECT_FEATURE_README.md
├── CapSheet.jsx
├── CapSheetFull.jsx
├── CapSummaryTiles.jsx
├── DraftPickTracker.jsx
├── ExceptionHistoryTracker.jsx
├── ExceptionTracker.jsx
├── FreeAgentPool.jsx
├── GMDashboard/
│   ├── GMDashboard.jsx
│   ├── components/
│   │   ├── CapAuditDebugPanel.tsx
│   │   ├── DeleteWorldModal.jsx
│   │   ├── DraftPositionsInput.jsx
│   │   ├── OfferSheetList.jsx
│   │   ├── SeasonAdvanceModal.jsx
│   │   ├── WorldSelector.jsx
│   │   └── WorldTimeControls.jsx
│   ├── hooks/
│   └── sections/
│       ├── CapSheetSection.jsx
│       ├── CapTableSection.jsx
│       ├── FreeAgencySection.jsx
│       ├── HistorySection.jsx
│       ├── OffseasonSection.jsx
│       ├── RosterSection.jsx
│       └── TradeSection.jsx
├── LeagueView.jsx
├── OffseasonTab.jsx
├── RosterVisual.jsx
├── TeamHistoryTab.jsx
├── ValidationWarnings.jsx
├── WaiveStretchTracker.jsx
├── admin/
│   ├── EntitlementEditorAdvancedTab.tsx
│   ├── EntitlementEditorBasicsTab.tsx
│   ├── EntitlementEditorConveyanceTab.tsx
│   ├── EntitlementEditorCreateButton.tsx
│   ├── EntitlementEditorFormTabs.tsx
│   ├── EntitlementEditorModal.tsx
│   ├── EntitlementEditorProtectionTab.tsx
│   ├── EntitlementEditorSwapTab.tsx
│   ├── EntitlementEditorTeamInventorySection.tsx
│   ├── EntitlementHealthPanel.tsx
│   ├── PickRightWizardModal.tsx
│   ├── PickRightWizardSteps/
│   ├── PickSelector.tsx
│   ├── PickTermsPreview.tsx
│   ├── PlainEnglishPreview.tsx
│   └── ...
├── capSheet/
│   ├── CapSheet/
│   ├── CapSheetFull/
│   ├── ExceptionHistoryTracker/
│   ├── ExceptionTracker/
│   └── modals/
├── contract/
│   ├── ContractEditor/
│   └── ContractEditorModal/
├── freeAgency/
│   └── FreeAgentPool/
├── history/
│   ├── TeamHistoryTab/
│   ├── hooks/
│   └── utils/
├── hooks/
│   ├── useArchitectPlayerData.js
│   ├── useCapSheetState.js
│   ├── useCapValidation.js
│   ├── usePlayerRulesProfiles.js
│   ├── useTeamEntitlements.ts
│   ├── useTradeMachine.js
│   └── useTradeMachineSnapshot.js
├── offseason/
│   ├── DraftPickTracker/
│   ├── OffseasonTab/
│   └── WaiveStretchTracker/
├── shared/
│   ├── LeagueView/
│   ├── RosterVisual/
│   └── ValidationWarnings/
├── tradeMachine/
│   ├── CapImpactTiles.jsx
│   ├── DataWarningsSection.jsx
│   ├── EntitlementPickRow.jsx
│   ├── EntitlementPicksList.jsx
│   ├── FaExceptionTracker.jsx
│   ├── OutgoingPlayersList.jsx
│   ├── SelectTeamCard.jsx
│   ├── TradeEditor.jsx
│   ├── TradeExceptionDashboard.jsx
│   ├── TradeExceptionManager.jsx
│   ├── TradeExportCapture.jsx
│   ├── TradeLegalChecker.jsx
│   ├── TradePlayerRow.jsx
│   ├── TradePreviewModal.jsx
│   ├── TradeReceiptPanel.jsx
│   ├── TradeSalaryCalculator.jsx
│   ├── TradeSummaryPanel.jsx
│   ├── TradeTeamCard.jsx
│   ├── ValidationDetailsPanel.jsx
│   ├── ValidationStateHeader.jsx
│   └── utils/
├── types/
│   ├── index.ts
│   └── ruleContext.ts
└── utils/
    ├── architectCore.js
    ├── architectFirestorePaths.ts
    ├── basicArchitectUtils.js
    ├── buildRuleContext.ts
    ├── capHelpers.ts
    ├── capHoldTransitionHelpers.js
    ├── capHolds.ts
    ├── capLegality/
    ├── capLegalityValidation.js
    ├── capProjections.js
    ├── capRulesProfile/
    ├── capTotals/
    ├── capUtils.js
    ├── cashUtils.js
    ├── cbaConstants.js
    ├── consentUtils.js
    ├── contractNormalization.js
    ├── contractSalaryUtils.js
    ├── contractUtils.js
    ├── draftPickUtils.js
    ├── entitlements/
    ├── exceptionHistory/
    ├── exceptions/
    ├── faExceptionUtils.js
    ├── firebaseTeamPlanHelpers.js
    ├── freeAgentLogic.js
    ├── hardCapUtils.js
    ├── leagueInvariants.ts
    ├── loadArchitectBasePlayer.ts
    ├── mutationPipeline.js
    ├── offseason/
    ├── persistenceContracts/
    ├── playerRulesProfile/
    ├── reacqUtils.js
    ├── rosterUtils.js
    ├── runOffseason.js
    ├── salaryEngine/
    ├── salaryUtils.js
    ├── schemaAdapter.js
    ├── seasonFormat.js
    ├── seasonHelpers.ts
    ├── seasonManager.js
    ├── seasonUtils.js
    ├── stepienUtils.js
    ├── subscribeArchitectPlayerData.ts
    ├── teamLoader.js
    ├── timingUtils.js
    ├── tpeLifecycle.js
    ├── tradeContext/
    ├── tradeHelpers.js
    ├── tradeMachine/
    │   ├── cache/
    │   ├── constants/
    │   ├── engine/
    │   │   ├── tradeValidator.js
    │   │   ├── validatorFactory.js
    │   │   └── ...
    │   ├── rules/
    │   │   ├── validateSalaryMatching.js
    │   │   ├── validateStepien.js
    │   │   ├── validateSignAndTrade.js
    │   │   ├── validateHardCap.ts
    │   │   ├── validateRoster.js
    │   │   └── ...
    │   ├── signAndTrade/
    │   ├── utils/
    │   └── validators/
    ├── tradeManager.js
    └── worldManager.js
```

### Test Files (200+)

```
src/tests/architect/   — 181 test files
tests/trade/           — 30 test files  
src/tests/trade/       — 13 test files
src/tests/tradeMachine/— 12 test files
tests/validators/      — 6 test files
```

---

## Appendix B: Existing Audit Work Reference

### Master Documentation

| Document | Last Updated | Relevance |
|----------|--------------|-----------|
| `TRADE_MACHINE_MASTER.md` | Active | Core Trade Machine SSOT |
| `TRADE_MACHINE_MASTER_AUDIT.md` | 2026-02-05 | Prior audit findings |
| `CAP_SHEET_MASTER.md` | 2026-03-01 | Cap Sheet SSOT |
| `ENTITLEMENTS_MASTER.md` | 2026-02-25 | Entitlements SSOT |
| `OFFSEASON_MASTER.md` | Active | Offseason SSOT |
| `TEAM_HISTORY_MASTER.md` | Active | Team History SSOT |
| `ARCHITECT_SHIP_READINESS_MASTER.md` | 2026-02-13 | Ship readiness tracking |

### Prior Audit Artifacts

| Artifact | Scope | Date | Status |
|----------|-------|------|--------|
| `TM_AUDIT_WORKBOOK.md` | Trade Machine | 2026-02-14 | PREFLIGHT |
| `TM_SEC_A1_SALARY_MATCHING.md` | Salary Matching | 2026-02-14 | COMPLETE |
| `TM_SEC_A2_HARD_CAPS_APRONS.md` | Hard Caps | 2026-02-14 | COMPLETE |
| `TM_SEC_A3_PICKS_ENTITLEMENTS.md` | Picks/Entitlements | 2026-02-14 | COMPLETE |
| `TM_SEC_A4_UI_TRUTH_SUMMARY_EXPORT.md` | UI/Export | 2026-02-14 | COMPLETE |
| `TM_SEC_A5_STATE_COHERENCE_MULTI_TEAM.md` | State Coherence | 2026-02-14 | COMPLETE |
| `TM_SEC_A6_SAVE_LOAD_IMMUTABILITY.md` | Save/Load | 2026-02-14 | COMPLETE |
| `TM_SHIP_READINESS_V1.md` | Trade Machine | Active | TRACKING |
| `trade-machine-audit-plan.md` | Manual QA | Active | TEST PLAN |

### Return Packages

| Category | Count | Location |
|----------|-------|----------|
| Architect Core | 30+ | `return_packages/architect/` |
| Entitlements | 6+ | `return_packages/entitlements/` |
| Trade Machine | 10+ | `return_packages/trade_machine/` |
| Cap Sheet | 5+ | `return_packages/cap_sheet/` |

---

## Execution Tracking

This section will be updated as the audit progresses.

### Phase Status

| Phase | Status | Started | Completed | Blocking Issues |
|-------|--------|---------|-----------|-----------------|
| 0 - Discovery | NOT STARTED | — | — | — |
| 1 - Subsystems | NOT STARTED | — | — | — |
| 2 - Integration | NOT STARTED | — | — | — |
| 3 - UX/UI | NOT STARTED | — | — | — |
| 4 - Data | NOT STARTED | — | — | — |
| 5 - CBA | NOT STARTED | — | — | — |
| 6 - Tests | NOT STARTED | — | — | — |
| 7 - Docs | NOT STARTED | — | — | — |
| 8 - Synthesis | NOT STARTED | — | — | — |

### Session Log

| Session | Date | Phase | Scope | Outcome |
|---------|------|-------|-------|---------|
| — | — | — | — | — |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-04 | AI Agent | Initial blueprint creation |

---

*End of Blueprint Document*
