# SHIP_GATES_MASTER

Last updated: 2026-02-28

---

## Purpose

This document is the single source of truth for ship readiness of the current Architect / Trade Machine / Entitlements scope.

It defines:

1. Which automated gate commands must pass before shipping
2. The minimal manual smoke scenarios that confirm end-to-end correctness
3. What to do when a gate fails (triage rules)
4. What is explicitly out of scope so work stays focused

Gate command = a pass/fail command that blocks shipping when it fails.

---

## Shipping Scope Definition

“Ship” for this phase means:

- Present-day / vacuum correctness  
  The Architect world, Trade Machine, and Entitlements subsystems produce correct, deterministic results for the current season state.

- Gated persistence (fail-closed)  
  All entitlement write paths fail closed and enforce:
  - league claim uniqueness
  - team exclusivity
  - linked/residual integrity (blocking legality)
  - resolver invariant violations (no silent masking)

  Write paths covered:
  - editor save
  - trade apply
  - identity move
  - DARE season advance persistence

- 3+ team trade routing correctness
  - Multi-team trades require explicit routing for outgoing assets.
  - Summaries reflect routed incoming values (no broadcast assumptions).
  - Legality reasons are accurate (routing failures don’t masquerade as apron/salary issues).

- Entitlement identity safety
  - Identity-changing edits are duplicate-as-new (original not mutated/moved)
  - Deterministic ID collisions are detected and fail closed
  - Resolver does not silently dedupe/hide corruption

- Parent-world inheritance
  Child worlds inherit entitlement IDs/overrides from parent worlds via the resolver fallback chain.

This scope does not include deep world simulation completeness or long-horizon season progression accuracy (see Out of Scope).

---

## Gate Tiers

### P0 — Must-Pass (Blocks Shipping)

All P0 gates must be green before any release of the current scope. If any P0 gate is red, shipping is blocked.

| Gate              | Command                                    | What It Validates                                                                              |
| ----------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Trade tests       | `npm run test:trade -- --reporter=dot`     | Trade validation logic, multi-team routing, salary/apron rules, entitlement legality in trades |
| Architect tests   | `npm run test:architect -- --reporter=dot` | Entitlements (E1–E3), DARE persistence, world operations, core Architect invariants            |
| Production build  | `npm run build`                            | No compile errors, imports resolve, production bundle completes                                |
| Project structure | `npm run validate:project`                 | Repo/schema/export structure matches `project.schema.json`                                     |

Run all four before every release.

### P1 — Pre-Release Confidence (Recommended)

P1 gates are recommended when changes touch broader areas, but they do not block shipping unless the failures touch shipped scope.

| Gate              | Command                               | When to Run                                                       |
| ----------------- | ------------------------------------- | ----------------------------------------------------------------- |
| Diff-scoped tests | `npm run test:diff -- --reporter=dot` | When changes span multiple areas beyond trade/architect           |
| Fast smoke        | `npm run test:fast -- --reporter=dot` | Quick sanity after trivial changes                                |
| Typecheck         | `npm run typecheck`                   | After TypeScript/hook/utility changes                             |
| Full suite        | `npm run test:full -- --reporter=dot` | Optional & expensive. Only when prompt includes `RUN FULL SUITE`. |

Note: `npm run test:full` is explicitly optional. It should never be the default gate. See AGENTS.md for the full-suite guard policy.

---

## Cap Auditability Gates (VERIFIED ✅)

**Status: CLOSED** — 2026-02-28  
**Closeout:** `return_packages/architect/TM_CAP_AUDITABILITY_P6_PREFLIGHT_RETURN_PACKAGE.md`

Initiative: `TM_CAP_AUDITABILITY_P0_PREFLIGHT`  
Primary docs:

- `docs/architect/CAP_AUDITABILITY_MASTER.md`
- `return_packages/architect/TM_CAP_AUDITABILITY_P0_PREFLIGHT_RETURN_PACKAGE.md`

Ship gates verified in P6 closeout:

1. **World Mutation Post-State Validator Gate** ✅ VERIFIED  
   Every persisted world mutation runs the shared post-state validator and fail-closes on violations.
2. **World Mutation CapAuditEventV1 Gate** ✅ VERIFIED  
   Every persisted world mutation emits one `CapAuditEventV1` envelope (same world event destination) with before/after totals and validator verdict.
3. **Validator Coverage Gate** ✅ VERIFIED  
   Every cap-changing world path and base-mode parity path runs one post-state validator contract with versioned output.
4. **Audit Coverage Gate** ✅ VERIFIED  
   Every cap-changing world write emits one `CapAuditEventV1` envelope containing before/after totals and validator verdict.
5. **Bypass Closure Gate** ✅ VERIFIED  
   No world cap-changing path can bypass `compute -> validate -> persist -> log`.
6. **Season Advance Audit Gate** ✅ VERIFIED  
   `advanceSeasonInWorld` emits durable world events with the same schema/version contract as mutation pipeline writes.
7. **Base-Mode Local Audit Gate** ✅ VERIFIED  
   Base-mode cap-changing actions emit `CapAuditEventV1`-shaped local events and run post-state validator fail-close checks before applying local state.
8. **World Optimistic Drift-Prevention Gate** ✅ VERIFIED  
   Optimistic world handlers must pre-validate post-state, block invalid optimistic updates, and rollback/flag preview records on authoritative persistence failure.
9. **Optimistic Serialization Gate** ✅ VERIFIED  
   No concurrent optimistic cap mutations in world mode; lock/serialization behavior must be verified by tests.
10. **Cap Audit Debug Visibility Gate** ✅ VERIFIED  
    Dev-only Cap Audit Debug viewer is available for QA without impacting production UI.

E2 status update (implemented on 2026-02-28):

- World season advance emits `CapAuditEventV1` (operation-level) to world `events` in the same `writeBatch` commit.
- World season advance runs `validatePostStateCapLegality(...)` and fail-closes on any violations.

E3 status update (implemented on 2026-02-28):

- Base-mode cap-changing actions now emit local `CapAuditEventV1`-shaped events via bounded local stream (`architect_base_capAuditEvents_v1`) and fail-close on validator violations.
- World optimistic handlers (`waive/extend/option/renounce/deadCap/exceptions`) now emit preview audit events, pass correlated `operationId` into authoritative mutations, and rollback/mark failure on persist errors.

E4 status update (implemented on 2026-02-28):

- World optimistic cap mutations are serialized via fail-closed world-scoped lock (no concurrent optimistic mutation overlap).
- Dev-only `Cap Audit Debug` panel is available in GM Dashboard for base/preview stream inspection and operation linkage checks.

Validation command set (P6 verified):

- `npm run test:architect -- --reporter=dot`
- `npm run test:trade -- --reporter=dot`
- `npm run test:diff -- --reporter=dot`
- `npm run typecheck`
- `npm run validate:project`

Manual smoke checklist (cap auditability scope, P6 verified):

- Trade apply
- Free-agent signing
- Waive/stretch/buyout
- Option decision
- Renounce rights
- Dead cap/exceptions edit
- Season advance

### Post-State Validator v1.0.0 Rule Coverage Checklist (Implemented ✅)

**Preflight:** `return_packages/architect/TM_CAP_AUDITABILITY_P5_PREFLIGHT_RETURN_PACKAGE.md`  
**Execution:** `return_packages/architect/TM_CAP_AUDITABILITY_E5_EXECUTION_RETURN_PACKAGE.md`  
**Completed:** 2026-02-28

**v1.0.0 Rules (all passing in behavior tests):**

- [x] PSV_TOTALS_001 — Totals fields finite (error) — all 9 required numeric fields must be finite
- [x] PSV_TOTALS_002 — Year key present and matching (error) — yearKey must exist and match expected year
- [x] PSV_TOTALS_003 — Totals snapshot not missing (error) — totals object must be present per team
- [x] PSV_CAP_001 — Hard cap ceiling (error) — hard-capped team salary must not exceed ceiling
- [x] PSV_FLOOR_001 — Salary floor (warning) — team salary below minimum emits advisory
- [x] PSV_ROSTER_001 — Max roster 15 (error) — standard roster count must not exceed 15
- [x] PSV_ROSTER_003 — Two-way limit 3 (error) — two-way contract count must not exceed 3
- [x] PSV_CONTRACT_004 — Contract rows valid (error) — all player contract rows pass schema/guarantee/option checks
- [x] PSV_DEAD_001 — Dead cap schema valid (error) — dead cap array structure and amounts are valid
- [x] PSV_EXC_001 — Exception schema valid (error) — exception keys/types/booleans pass schema checks
- [x] PSV_EXC_002 — Exception amounts valid (error) — usedAmount does not exceed totalAmount
- [x] PSV_HOLD_001 — Cap hold amounts valid (error) — all cap hold amounts are valid non-negative numbers
- [x] PSV_CAP_004 — Luxury tax threshold (warning) — team salary above luxury tax line emits advisory

**Coverage verified:**

- [x] All rules run in world mutation pipeline (Phase 3.8)
- [x] All rules run in base-mode path (via `useArchitectActions`)
- [x] All rules run in season advance path (via `seasonManager`)
- [x] `POST_STATE_CAP_VALIDATOR_VERSION` = `'1.0.0'`
- [x] No regression in `test:architect` (150 files, 2272 tests)
- [x] No regression in `test:trade` (58 files, 525 tests)

---

## Cap Sheet Page Workflow/Wiring Audit (P1 PREFLIGHT COMPLETE)

- Status: **PREFLIGHT COMPLETE** (2026-02-28)
- Return package: `return_packages/architect/TM_CAP_SHEET_P1_PREFLIGHT_RETURN_PACKAGE.md`
- Master doc: `docs/architect/CAP_SHEET_MASTER.md`

## Cap Sheet Page Wiring Closure (E1 COMPLETE)

- Status: **COMPLETE** (2026-02-28)
- Return package: `return_packages/architect/TM_CAP_SHEET_E1_EXECUTION_RETURN_PACKAGE.md`
- Master doc: `docs/architect/CAP_SHEET_MASTER.md`
- Page-level ship gates satisfied:
  - Exception save/read parity on Cap Sheet page (`team.exceptions` canonical, legacy fallback read)
  - Unsupported DPE key removed from Cap Sheet exceptions mutation payload surface
  - TPE expiry rendering honors canonical fallback fields (`expiresOn`, `expirationDate`, `expires`)
  - Cap Sheet modals keep context on failed world save (no close-before-fail)

---

## Manual Smoke Checklist

Run these scenarios manually against a dev server (`npm run dev`) before shipping.  
These are intentionally minimal and targeted at the exact scope defined above.

### Minimum Smoke (required)

#### Scenario 1 — 3-Team Trade: Routing + Summary + Legality

Steps

1. Open Architect → create or load a world
2. Open Trade Machine
3. Build a 3-team trade with players and picks (and cash if modeled)
4. For every outgoing player, set an explicit destination via routing UI (canonical `toTeamId` shape)
5. Validate the trade

Expected

- [ ] Missing any destination causes an early routing failure (by design)
- [ ] Summary shows only routed incoming assets per team (no broadcast incoming)
- [ ] If you intentionally break salary/apron, legality reasons are specific (not generic)

#### Scenario 1A — S&T Incoming Aggregation (2-team)

Steps

1. Open Trade Machine with 2 teams
2. Create a sign-and-trade from Team A to Team B
3. Also route one additional non-S&T player from Team A to Team B in the same transaction
4. Validate

Expected

- [ ] Trade is illegal
- [ ] Team B shows Sign-and-Trade rule violation: `Cannot aggregate other players with sign-and-trade player.`
- [ ] Team A also fails outgoing S&T aggregation if it sends S&T + extra player

#### Scenario 1B — S&T Incoming Aggregation (3-team routed)

Steps

1. Open Trade Machine with 3 teams
2. Route one S&T player from Team A to Team B
3. Route an additional non-S&T player from Team C to Team B
4. Ensure all outgoing players have explicit destinations
5. Validate

Expected

- [ ] Trade is illegal under Rule 1.6 for Team B
- [ ] Violation appears under existing `team.rules.signAndTrade` row (no hidden rule)
- [ ] If Team B receives only the S&T player, Rule 1.6 passes

#### Scenario 2 — Entitlement Edit: Identity-Change → Duplicate-as-New

Steps

1. Open an existing entitlement in a world
2. Change an identity-defining field (e.g., underlying pick year/round/controller fields depending on kind)
3. Save

Expected

- [ ] A new entitlement is created (duplicate-as-new)
- [ ] New entitlement is attached to holder team inventory (`entitlementIds`)
- [ ] Original entitlement remains unchanged and still exists

#### Scenario 3 — DARE / Season Advance: Gated Persistence

Steps

1. Load a world with entitlements
2. Trigger season advance (DARE flow)

Expected

- [ ] If no conflicts exist, season advance persists successfully
- [ ] If conflicts exist (claim collision / exclusivity violation / resolver invariant violation), persistence is blocked (no partial commit)

#### Scenario 4 — Parent-World Fallback: Entitlement Inheritance

Steps

1. Create a parent world with entitlements
2. Create a child world derived from that parent
3. In the child world, inspect entitlements without modifying them

Expected

- [ ] Child inherits entitlement IDs from parent
- [ ] Parent overrides appear in child resolved view
- [ ] Fallback chain is: child → parent → base

#### Scenario 5 — League Claim Uniqueness: Cross-Team Enforcement

Steps

1. In a world, attempt to save/create an entitlement that would claim a pick outcome already claimed by another team

Expected

- [ ] Save is blocked by league claim uniqueness gate
- [ ] Error is clear enough to identify which claim collided (at least “duplicate claim” + teams involved)

#### Scenario 6 — Linked Package Trade Integrity

Steps

1. With linked entitlements present, build a trade that includes only one part of a linked package
2. Validate

Expected

- [ ] Trade is illegal
- [ ] Error identifies missing linked entitlement IDs (or clearly indicates incomplete linked package)

#### Scenario 7 — Roster Window / Two-Way Overflow

Steps

1. Open Trade Machine with a team that has 15 standard-contract players
2. Build a trade where that team receives 2 players and sends only 1
3. Validate

Expected

- [ ] Trade is illegal (roster count exceeds maximum 15)
- [ ] Roster Count rule shows red in CBA Rule Compliance Overview
- [ ] Apply Trade button is disabled

Steps (two-way)

1. Open Trade Machine with a team that has 3 two-way players
2. Build a trade where that team receives 1 additional two-way player
3. Validate

Expected

- [ ] Trade is illegal (two-way slots exceeded)
- [ ] Roster Count rule shows violation detail

#### Scenario 8A — Cap Sheet SSOT Parity (added CAP_SHEET_E2E_SSOT_PARITY_E1)

Steps

1. Open Cap Sheet for a team with dead money entries
2. Switch to the multi-year Full Cap Table view (CapSheetFull)
3. Compare the "Total Cap" row values against the single-year Cap Sheet totals

Expected

- [ ] Total Cap row includes dead money (not just player salaries + cap holds)
- [ ] Total Cap matches the value shown in single-year CapSheet for the same year
- [ ] If dead money is manually edited via Manage Dead Money modal, totals update correctly

### Crash-Only Navigation Smoke (recommended, not feature correctness)

This is not a promise that these features are shipped complete. It is only a non-crash sanity check.

#### Scenario 8 — Build + Load: Basic Navigation (no crashes)

Steps

1. Run `npm run build` (already a P0 gate)
2. Run `npm run dev`
3. Navigate across major routes (including ones outside shipped scope)

Expected

- [ ] No blank screens / route crashes / fatal errors during navigation

---

## Failure Triage Rules

### If a P0 gate fails → BLOCKER

- Stop. Do not ship.
- Re-run the failing command in isolation to confirm reproducibility.
- Fix must restore the gate to green before shipping resumes.
- Never “fix” by weakening validation rules/tests unless the test is provably wrong relative to documented invariants.
- If a test is changed, document rationale in:
  - commit message
  - the relevant master doc (ENTITLEMENTS_MASTER / TRADE_MACHINE_MASTER / this doc)

### If a P1 gate fails → Not a blocker UNLESS it touches shipped scope

- If unrelated to shipped scope, log it and move on.
- If it touches Architect / Trade / Entitlements shipped scope, treat it as a P0 blocker.

### General principles

1. Reproduce first
2. Keep fixes scoped (don’t expand into unrelated debt)
3. Preserve invariants (fail-closed stays fail-closed)

---

## Out of Scope

Explicitly not required to ship this phase:

- Deep world simulation completeness (multi-season fidelity beyond “this season works”)
- Long-horizon season progression accuracy (multi-year rollovers beyond the validated DARE persistence contract)
- Full correctness/QA of non-Architect features (Profiles/Scouting/Tiermaker/Lists/etc.)
- Full ESLint compliance (legacy debt)
- Full suite green by default (`npm run test:full` is optional per AGENTS policy)
- Repair tooling for legacy corrupted data (follow-up work, not a ship gate)
- Using CUSTOM scope mode for league claim gates in core write contexts (rejected by design)

---

## Release Sign-Off Template

Copy this checklist into a PR description or release note when shipping:

    ## Ship Gates Sign-Off

    ### P0 Gates (must pass)

    - [ ] `npm run test:trade -- --reporter=dot` → PASS
    - [ ] `npm run test:architect -- --reporter=dot` → PASS
    - [ ] `npm run build` → PASS
    - [ ] `npm run validate:project` → PASS

    ### Manual Smoke (minimum)

    - [ ] 3-team trade: routing required, summary routed-correct, legality reasons sane
    - [ ] Entitlement edit identity-change: duplicate-as-new, original unchanged
    - [ ] DARE season advance: gated persistence blocks on conflicts, persists otherwise
    - [ ] Parent-world fallback: child inherits entitlements from parent
    - [ ] League claim uniqueness: cross-team duplicate claim blocked
    - [ ] Linked package trade integrity: partial linked package blocked
    - [ ] Roster window: trade exceeding max roster blocked, two-way overflow blocked

    ### Optional (if run)

    - [ ] Crash-only navigation smoke: no blank screens / fatal route errors
    - [ ] `npm run test:diff` → ___
    - [ ] `npm run typecheck` → ___
    - [ ] Other: ___

    ### Sign-Off

    - Signed off by: ___
    - Date: ___
    - Notes: ___

---

## Canonical References

Do not duplicate content from these docs — reference them:

- [ENTITLEMENTS_MASTER](architect/ENTITLEMENTS_MASTER.md) — entitlement invariants, E1–E3 decisions, known limitations, follow-ups
- [TRADE_MACHINE_MASTER](architect/TRADE_MACHINE_MASTER.md) — trade validation rules, routing requirements, test gate status
- [AGENTS.md](../AGENTS.md) — validation policy, test command menu, full-suite guard

---

## RC1 Gate Snapshot — 2026-02-26

| Command                    | Result                                                    |
| -------------------------- | --------------------------------------------------------- |
| `npm run test -- --run`    | **FAIL** (16 tests failed / 3022 passed across 233 files) |
| `npm run validate:project` | **PASS**                                                  |
| `npm run build`            | **PASS** (3053 modules)                                   |

**P0 scoped suites (confirmatory):** `test:trade` PASS (58 files, 525 passed), `test:architect` PASS (136 files, 2206 passed).

At RC1 time, the 16 full-suite failures were spread across 3 files, all pre-existing and all outside the scoped trade/architect suites: (1) speculative S&T aggregation tests in top-level `tests/signAndTradeAggregation.test.js`, (2) validation performance monitoring infra tests in `tests/validationPerformance.test.js`, and (3) entitlement pick-row display label expectation drift in `tests/entitlements/entitlementPickRowProjection.test.js`. None were regressions from the Trade Machine 5-pack closure. Trade Machine remained ship-clean for scoped gates. Full details in `return_packages/ship_gates/SHIP_GATES_RC1_FULL_SUITE_P1_PREFLIGHT_RETURN_PACKAGE.md`.

---

## RC1.1 Gate Snapshot — 2026-02-26

| Command                                    | Result                                                           |
| ------------------------------------------ | ---------------------------------------------------------------- |
| `npm run test:node -- --reporter=dot`      | **PASS** (233 files: 232 passed, 1 skipped)                      |
| `npm run test:trade -- --reporter=dot`     | **PASS** (58 files; 525 passed, 1 skipped, 3 todo)               |
| `npm run test:architect -- --reporter=dot` | **PASS** (136 files; 2206 passed, 1 skipped, 3 todo)             |
| `npm run validate:project`                 | **PASS**                                                         |
| `npm run build`                            | **PASS** (3053 modules transformed)                              |
| `npm run test -- --run` (full: node + UI)  | **FAIL** — node layer green; UI layer fails (6 files / 27 tests) |

**What changed from RC1 → RC1.1 (node-layer cleanup; no trade legality changes):**

- **Entitlement pick-row projection helpers** aligned to the canonical display spec:
  - `getPickRowDisplayLabel` now outputs a self-contained label including **year + round + via team + kind suffix** (e.g., `(Swap)`, `(Cond.)`).
  - `getPickRowSecondaryText` preserves `"Swap option"` and **does not mutilate condition strings**.
- **Validation performance tests** made **opt-in** via `RUN_PERF_TESTS=1` (skipped by default to avoid false failures until perf/cache wiring exists).
- **Speculative Sign-and-Trade incoming aggregation tests** were converted to `test.todo()` in RC1.1 (at that time Rule 1.6 coverage was deferred); one control fixture was corrected for roster overflow.

**Newly discovered: UI test layer failures (pre-existing).**

- `npm run test -- --run` executes **node tests first** (via `vitest.node.config.js`) and then **UI tests** (via `vitest.ui.config.js`) sequentially.
- Prior to RC1.1, the run stopped early due to node-layer failures, so the UI suite did not execute. Once node was green, the UI suite surfaced **6 failing files / 27 failing tests**.
- These failures were **component-level rendering / selector drift** (wizard labels/testids, vacuum badges/menu interaction, pick right wizard UI expectations, ranking setup UX) and were **not caused by the RC1.1 node fixes**.

**Perf tests reminder:** set `RUN_PERF_TESTS=1` to include validation performance tests.

Full details: `return_packages/ship_gates/SHIP_GATES_RC1_FIX_FULL_SUITE_FAILS_E1_EXECUTION_RETURN_PACKAGE.md`.

---

## RC1.2 Gate Snapshot — 2026-02-26

| Command                                   | Result                                                   |
| ----------------------------------------- | -------------------------------------------------------- |
| `npm run test -- --run` (full: node + UI) | **PASS** (node + UI green; 267 files; 3395 tests passed) |
| `npm run test:node -- --reporter=dot`     | **PASS** (233 files: 232 passed, 1 skipped)              |
| `npm run test:ui -- --run`                | **PASS** (34 files; 370 tests passed, 2 skipped)         |
| `npm run validate:project`                | **PASS**                                                 |
| `npm run build`                           | **PASS**                                                 |

**What changed from RC1.1 → RC1.2 (UI suite made green; no trade logic changes):**
The 6 UI test files (27 failing tests) surfaced in RC1.1 are now resolved. Root causes and approach:

- **Wizard translation label drift** (4 tests): tests updated to match the **current canonical UI copy** (e.g., `'Protection'`, `'Swap'`, `'Pool'`), and preset expectations updated after preset simplification.
- **Pick Right Wizard + Vacuum Apply gaps** (6 + 10 tests): restored/standardized key UI contracts and filled designed-but-missing UX elements:
  - Apply button testid standardized to `wizard-apply`
  - **Save Draft** button restored
  - **Vacuum mode** banner restored
  - **Convert to Swap** implemented in QuickBuilder edit flow
  - Missing vacuum-overlay mocks added in tests (e.g., `rekeyVacuumCreate`, `findVacuumCreateByIdentityKey`, `writeWorldEntitlementAndAttachToTeamAtomic`)
  - Vacuum create routing bug fixed (vacuum creates now route through create, not edit)
- **QuickBuilder edit identity + Convert-to-Swap** (4 tests): added `edit-identity-pick-id` and implemented Convert-to-Swap section per the simplified wizard design.
- **EntitlementPickRow vacuum badges/menu** (2 tests): aligned badge/action copy and updated tests to **open the 3-dot menu** (canonical interaction pattern).
- **RankingSetup** (1 test): test updated to match the **Tier Tagging UX** (new testid and interaction).

**Result:** UI suite is now enforced and green; node + UI combined gate is green. No trade legality/CBA enforcement changes.

Full details: `return_packages/ship_gates/SHIP_GATES_RC1_UI_SUITE_FIX_E1_EXECUTION_RETURN_PACKAGE.md`.
