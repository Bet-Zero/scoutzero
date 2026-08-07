# Architect CBA Canon v2 — Phase 2 implementation audit

## Status

**Phase 2 audit active. No fixes are underway.**

- Linear lane: BZE-266 (High / In Progress), under BZE-254 in Architect Completion.
- Audit branch: `architect/bze-266-cba-canon-v2-phase2-audit`.
- Application baseline: `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`.
- Accepted Canon candidate: `6cf8aaf358c158a88e630e8a7336f7e9c3febc17`.
- Accepted R9 / Phase 1 tip: `5aeaaf1d0e4a197cbf1aa22ecda5c0c62a333012`.
- Canon SHA-256: `23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76`.

This audit is read-only with respect to application code, application tests,
schemas, data, and configuration. The accepted Canon and R9 report are frozen.

## Preflight

Completed 2026-08-07:

- fetched live `main` and `architect/cba-canon-v2`; both matched the pinned refs;
- proved baseline → accepted Canon → R9 ancestry;
- independently matched the accepted Canon checksum;
- proved the exact main-to-R9 diff contains only Canon, documentation, audit
  history, and the Phase 1 validator — no application delta;
- confirmed the starting worktree was clean and no conflicting Phase 2/CBA
  audit branch existed locally or on the live remote;
- ran `npm run test:diff -- --reporter=dot`: FAST tier, 12 files / 57 tests,
  all passed;
- created BZE-266 as the sole High / In Progress execution lane, cleared stale
  High priorities from BZE-243, BZE-254, and BZE-256, and updated the Architect
  Completion project summary.

Graphify was used read-only for orientation. Its graph was built at accepted
Canon commit `6cf8aaf3`; the automatic branch-switch rebuild was stopped before
it changed the worktree. Graphify output will not be regenerated or committed.

## Audit method

The audit universe is the Canon's active v2 LEAF main/detail join only: exactly
815 identities (A 151, C 417, R 118, L 102, S 27). GROUPs, historical IDs,
scenarios, evidence/support rows, crosswalks, process rows, and terminal
unsupported-residual dispositions receive no implementation verdict.

Each LEAF is inspected against current code and tests in one of three passes:

1. deterministic correctness;
2. Cap Manager completeness;
3. full GM depth.

The register keeps Canon coverage, implementation state, five product layers,
runtime-input state, evidence strength, severity, exact code/test evidence,
smallest remediation, and shared root cause separate. Symbols and green tests
are treated as leads until the expected behavior is independently reconciled
to the accepted Canon.

## Results

### Pass 1 — deterministic correctness

Completed 2026-08-07. The checkpoint covers all 151 A-family leaves plus the
22 directly supporting hard-cap, Second Apron pick-history, and Expanded-TPE
provenance leaves in L07-L09 and S04: 173 records total.

| Measure | Pass 1 count |
|---|---:|
| Correct | 4 |
| Incorrect | 39 |
| Partial | 56 |
| Absent | 74 |
| Covered and proven | 4 |
| Partial Canon coverage | 95 |
| Missing in scope | 64 |
| Data-blocked | 10 |
| High severity | 119 |
| Medium severity | 50 |
| Low severity | 1 |
| No defect severity | 3 |

The transaction engine has meaningful scaffolding, but its dominant model is
too coarse for the accepted Canon:

- one cap-allocation total is reused as Team Salary, taxable payroll, and apron
  salary instead of maintaining independent ledgers;
- trade matching does not model Standard, Aggregated, Expanded, historical
  Transition, and Room paths as distinct authorities, and the current Expanded
  TPE input is rounded and season-blind;
- BYC, poison-pill, and trade-bonus scalar calculations omit their complete
  triggers, dated assumptions, and lifecycle allocation rules;
- the hard-cap trigger helper implements only a small subset of rows A-K and no
  post-Regular-Season dual-year hard cap;
- the two-month aggregation rule is explicitly retired because acquisition-date
  inputs are missing;
- S&T, roster, cash, extension, decomposition, and draft/Stepien validators each
  cover useful fragments but do not implement the complete Canon transaction;
- Second Apron frozen-pick history and formula-provenance records do not exist.

The four correct leaf behaviors are the one-year Standard TPE window, the S&T
four-season maximum, cash staying outside Team Salary, and the general one- or
two-season non-rookie extension bar. The last has insufficient aligned test
evidence and therefore remains a Medium evidence gap even though code behavior
matches the rule.

Green tests were not promoted to proof when their expected behavior conflicts
with the Canon. Examples include the rounded Expanded TPE value, treating every
rookie-scale player as poison-pill eligible, suppressing a trade bonus when
guaranteed money is zero, keeping the two-month aggregation rule retired, and
making Standard-roster Trade Call room advisory.

### Pass 2 — Cap Manager completeness

Completed 2026-08-07. The checkpoint covers C01-C15, R02-R04, R06-R10, L06,
and S01-S03: 246 records. Together with Pass 1, the register now contains
419/815 Canon leaves.

| Measure | Pass 2 count |
|---|---:|
| Correct | 4 |
| Incorrect | 52 |
| Partial | 49 |
| Absent | 141 |
| Covered and proven | 4 |
| Partial Canon coverage | 101 |
| Missing in scope | 132 |
| Data-blocked | 2 |
| Externally adjudicated | 7 |
| High severity | 191 |
| Medium severity | 51 |
| No defect severity | 4 |

The Cap Manager has useful contract, free-agency, waiver, roster-count,
exception, and season-transition surfaces, but it does not yet have the ledger
and lifecycle model required for Canon-complete cap management:

- Team Salary, Apron Salary, and Tax Salary are not independent ledgers. One
  allocation total feeds several labels, likely bonuses enter only the trade
  helper, and the ten Apron adjustments and last-game Tax Salary adjustments
  have no owners.
- cap holds use broad hardcoded percentages and a 2024-25 rookie table rather
  than the full qualifying-veteran, minimum/maximum, bonus, RFA, and unsigned
  pick rules; incomplete-roster charges also use the wrong population,
  threshold, and date window.
- minimum salary compensation and league reimbursement are conflated, the
  contract-start-year matrix is missing, and no progressive luxury-tax or
  repeater engine exists.
- the Minimum Team Salary threshold is available and computed correctly at 90%
  of the Salary Cap, but the MTS Cap Hold, Payment, Threshold, restoration,
  payment, and distribution ledgers/workflows are absent.
- long-term medical exclusion is absent. DPE has placeholder state and season
  clearing, but no grant, medical determination, amount, use, or expiry engine.
- non-TPE exception balances and resets exist, yet inventory remains manually
  enabled and the full method, proration, term, raise, eligibility, and Salary
  treatment matrix is incomplete.
- Bird-rights inference is not backed by exact service/team-change history;
  offer-sheet persistence covers pending/matched/declined states but not
  reserved Room/exception accounting or the Arenas election chain.
- waiver/dead-cap code produces protected schedules and the correct `2n+1`
  stretch span, but omits January 10 earning, set-off, payment-vs-Salary
  elections, timing, 15% handling, and reacquisition rules.
- roster storage and count checks do not model governed Active, Inactive,
  Suspended, Voluntarily Retired, hardship, treatment, or shortage-clock state.
  The ordinary three-Two-Way maximum is correct; game-usage ledgers are absent.
- Standard TPE amount/balance, partial-use persistence, one-year expiration,
  history, and idempotency exist. Source-transaction/version provenance and an
  all-state commit manifest do not.
- source metadata is coarse and permits silent fallbacks; immutable source
  version, artifact, field/input IDs, conflicts, re-verification state, and an
  operational-rule provenance/election registry are absent.

The four correct Pass 2 leaves are the 90% Minimum Team Salary threshold, the
`2n+1` Salary stretch span, the ordinary maximum of three Two-Way Contracts,
and Standard TPE partial-use balance persistence through its one-year window.

Pass 3 and final reconciliation remain pending. The register is intentionally
incomplete at this checkpoint (419/815); exact full-universe integrity is
required only after the final pass.

## Validation log

| Check | Result |
|---|---|
| `npm run test:diff -- --reporter=dot` | PASS — FAST tier, 57/57 tests |
| `npm run test:trade -- --reporter=dot` | PASS — 72 files, 635/635 tests |
| `npm run test:architect -- --reporter=dot` | PASS — 305 files, 3,555/3,555 tests; 257.00 seconds, exceeding the four-minute budget by 17 seconds; not repeated |
| `npm run test:diff -- --files <Phase 2 artifacts> --reporter=dot` | PASS — FAST tier, 57/57 tests |

Final reconciliation will add register counts, root-cause clusters, risk,
likely Phase 3 size, all validations/retries/skips, and the independent checker
verdict.
