# Architect CBA Canon v2 — post-R9 targeted R7 scenario repair

## Status and boundary

This is the single bounded maker receipt for the accumulated post-R9 R7
scenario repair. It begins from clean synchronized topic checkpoint
`ab8451a4dac4a5d4d385bfdd420610d722bb5d19`, whose direct parent is the
corrected R6 maker checkpoint
`e464d76959455fca18b6900ee405e45aa46ccf76`. That corrected R6 material was
independently accepted by `ab8451a4`.

This unit changes scenario specifications, affected Scenario-evidence
backlinks, forward lineage, derived scenario counts, and current status only.
It is not an independent review and makes no acceptance claim. The original
R7 receipt, every R6/R8/R9 receipt and review, the frozen validator and route,
application surfaces, tests, data, schemas, configuration, README, Linear,
Graphify, and `main` remain unchanged.

## Baseline

- Topic branch, tracking ref, and live remote baseline:
  `ab8451a4dac4a5d4d385bfdd420610d722bb5d19`.
- Direct parent: `e464d76959455fca18b6900ee405e45aa46ccf76`.
- Local and live remote `main`:
  `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`.
- Baseline synchronization: clean worktree, topic 0 ahead / 0 behind, and
  unchanged `main`.
- Preserved populations: 61 GROUPs, 815 active LEAFs, 823 EV2 records, 247
  R/L/S LEAFs (118 R, 102 L, 27 S), 82 top-level scenarios, 89 historical
  scenario fragments, 89 `SXW2` dispositions, and generic decisions through
  `DR2-0271`.

## Existing named cases revised

The following same-identity active cases are revised through generic forward
AMEND decision `DR2-0272`:

- Ordinary and Partial Waiver: `CBA2-SC-065(c)`, `(g)`, `(h)`, `(h77)`,
  `(i)`, `(j)`, and `(k)`.
- Buyout, stretch, and set-off: `CBA2-SC-066(a)`, `(c)`, `(h32)`, and
  `(h78)`.
- League-wide offseason transition: `CBA2-SC-072(a)` and `(h39)`.
- Draft-rights assignment and Assignment Transaction windows:
  `CBA2-SC-076(a)`, `(h)`, and `(h41)`.
- UFA/RFA versus retained draft rights: `CBA2-SC-077(c)`.

`CBA2-SC-065`'s material-contribution metadata is also revised to the current
33 SCEN-owner, 22-direct-case, five-interaction-case scope. All other existing
active case rows are byte-identical to `ab8451a4`.

## New named cases

The prior `CBA2-SC-065` direct-case high-water mark was `(k)`. The following
new identities are allocated contiguously above it:

| New case | Material contribution |
|---|---|
| `CBA2-SC-065(l)` | Staged Fitness-to-Play Partial Waiver eligibility and each exact failed prerequisite |
| `CBA2-SC-065(m)` | Panel medical finding plus condition-linked Team disagreement/refusal |
| `CBA2-SC-065(n)` | Ordinary 60-day disposition deadline and the August 1 exception branch |
| `CBA2-SC-065(o)` | Last-year exclusion with the Option-Year carveout |
| `CBA2-SC-065(p)` | Player Option alternatives, Team Option, and ETO-year classification |
| `CBA2-SC-065(q)` | Strict full-Base-Compensation ceiling at `$59,999,999` versus `$60,000,000` |
| `CBA2-SC-065(r)` | Inclusive unprotected-Base-Compensation floor at `$6,000,000` |
| `CBA2-SC-065(s)` | Submission-time strictly-below-Cap boundary with `$0.01` discrimination |
| `CBA2-SC-065(t)` | Candidate bid allocation and first-year obligation before selection |
| `CBA2-SC-065(u)` | Actual Room, unilateral creatable Room, trade exclusion, and combined sufficiency |
| `CBA2-SC-065(v)` | All nine validity probes, selection, downstream invalid-claim firewall, award-time Room creation, and no-valid-claim termination |
| `CBA2-SC-065(w)` | Accepted-claim allocation using exact Base-Compensation proportions |
| `CBA2-SC-065(x)` | Valid-claim payment, Team Salary, later trade, reimbursement, and succession lifecycle |
| `CBA2-SC-065(y)` | Both unchanged-obligation Subsequent Waiver branches |
| `CBA2-SC-065(z)` | Claiming reduction, waiving reduction, and triggered-protection addition formulas |

No new top-level scenario or `SXW2` identity is required.

## Partial Waiver semantic probes

The concrete `CBA2-SC-065(v)` vectors produce these actual oracle results:

| Probe | Actual result |
|---|---|
| 1. Below minimum | V1: `R01.51:FAIL(failed=R01.15)` |
| 2. At full Base Compensation | V2: `R01.51:FAIL(failed=R01.26)` |
| 3. Below unprotected Base Compensation | V3: `R01.51:FAIL(failed=R01.27)` |
| 4. Insufficient actual plus qualifying creatable Room | V4: `R01.29:FAIL`, `R01.49:FAIL`, `R01.51:FAIL(failed=R01.49)` |
| 5. Trade-dependent Room excluded | V5: `R01.48:PASS(excluded=$5,000,000)`, then `R01.49:FAIL` and `R01.51:FAIL(failed=R01.49)` |
| 6. Waiving Team claim | V6: `R01.51:FAIL(failed=R01.42)` |
| 7. Procedurally ineligible claim | V7: `R01.51:FAIL(failed=R01.19)` |
| 8. Lower valid over higher invalid | V8: `R01.51:FAIL(failed=R01.49)`; V9: `R01.51:PASS`; `R01.16` selects lower V9 |
| 9. Award-time Room creation | V9: `R01.50:PASS` when `$2,500,000` is created immediately; V9−: `R01.50:FAIL` when creation is omitted |

The results keep exclusion and validity distinct: correctly excluding
trade-dependent Room passes `R01.48`, while the remaining shortfall fails
`R01.49` and therefore `R01.51`.

## Downstream closure

- Only selected valid V9 reaches `R01.17`, which allocates
  `$3,500,000 / $7,000,000 / $10,500,000`.
- Removing V9 leaves only invalid submissions; `R01.18` terminates
  `CONTRACT-1` at waiver expiry.
- V1–V8 create no `R01.17`, `R01.30`–`.40`, `R01.44`, or `R01.50` result and
  no payment, Team Salary, trade, reimbursement, Subsequent Waiver,
  succession, or award-creation ledger mutation.
- `CBA2-SC-065(x)` proves the affected consequences using a separately
  selected valid claim; `(y)` and `(z)` prove every distinct Subsequent Waiver
  formula branch.

## Other accumulated repairs

- `SC-066(a)/(c)/(h32)/(h78)` now use exact multi-year buyout, Article II
  §4(k) payment-stretch, Article VII §7(d)(6) Team Salary, original-year
  set-off, Article XXVII §5(a)/§5(b), and post-original-term exclusion
  ledgers. Payment timing and Team Salary attribution never substitute for
  one another.
- `SC-072(a)/(h39)` use only unnumbered Article XXIX §1 and distinguish the
  league-wide Season end from one Team's playoff elimination.
- `SC-076(a)/(h41)` limit `L03.4` to authenticated draft-rights assignment
  and same-but-no-greater continuity. They infer no immediate tradability.
- `SC-076(h)` uses the truthful `INFERRED` chain over CBA Article I §1(mm)
  and By-Laws §4.01(a), preserves the July 1 12:01 a.m. through July 6 noon
  Eastern Moratorium even when July 6 is Sunday, and removes unsupported
  lottery, draft-day, Article II §15, and Article VII §9 authority.
- `SC-077(c)` uses Article XI only for UFA/RFA and Article X only for retained
  draft rights.

## Decision records

| DR ID | Type | Subject(s) | Disposition | Test/tiebreak applied | Rationale | Resulting active LEAF(s) or — | Unit/commit |
|---|---|---|---|---|---|---|---|
| DR2-0272 | `AMEND` | CBA2-SC-065; CBA2-SC-065(c), (g), (h), (h77), (i), (j), (k); CBA2-SC-066(a), (c), (h32), (h78); CBA2-SC-072(a), (h39); CBA2-SC-076(a), (h), (h41); CBA2-SC-077(c); and the 32 affected LEAF detail records | Revise the accumulated targeted active scenario specifications and their exact bidirectional Scenario-evidence backlinks; allocate fresh `SC-065(l)`–`(z)` cases above `(k)` | Accepted corrected-R6 owners and evidence; exact positive/adverse facts; all nine semantic probes; downstream invalid-claim firewall; stable identities; no source/rule expansion | Closes every deferred R7 item without changing a source-certified rule, evidence component, dependency, input contract, top-level scenario identity, or historical mapping target | — | R7 / this checkpoint |

The frozen validator deliberately has no machine-readable `CBA2-SC` AMEND
population and rejects invented structured rows for it. Therefore
`DR2-0272` is the forward lineage record for the existing active scenario and
named-case revisions; the structured rows below cover only the 32
machine-readable LEAF detail revisions. Fresh cases `(l)`–`(z)` require no
prior-record AMEND row.

## AMEND detail rows

| AMEND record ID | Population | Prior record ID | Prior version or — | Prior checkpoint commit | Action | Current record ID(s) or — | Current version(s) or — | Reason |
|---|---|---|---|---|---|---|---|---|
| DR2-0272 | LEAF | CBA2-R01.15 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.15 | — | Add exact minimum-floor scenario evidence and the full validity-lifecycle interaction backlink; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.16 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.16 | — | Add validity-before-selection and lower-valid-over-higher-invalid scenario evidence; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.17 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.17 | — | Add selected-valid-only and accepted-allocation scenario evidence; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.18 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.18 | — | Add the submissions-exist-but-none-qualifies termination vector; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.19 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.19 | — | Add exact staged eligibility and procedure-ineligibility evidence; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.20 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.20 | — | Add exact Panel and condition-linked refusal evidence; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.21 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.21 | — | Add both exact Evaluation Period deadline branches; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.22 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.22 | — | Add the last-year and Option-Year branch evidence; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.25 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.25 | — | Add exact Player Option, Team Option, and ETO classification evidence; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.26 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.26 | — | Add the strict full-compensation ceiling and validity-lifecycle backlink; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.27 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.27 | — | Add the inclusive unprotected-compensation floor and validity-lifecycle backlink; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.28 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.28 | — | Add the exact submission-time below-Cap boundary; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.29 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.29 | — | Add actual-Room and complete validity-lifecycle evidence; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.30 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.30 | — | Add valid-claim consequence and invalid-claim firewall evidence; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.31 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.31 | — | Add valid-claim consequence and invalid-claim firewall evidence; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.32 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.32 | — | Add valid-claim Team Salary and invalid-claim firewall evidence; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.33 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.33 | — | Add valid later-trade and invalid-claim firewall evidence; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.34 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.34 | — | Add valid later-transaction Salary and invalid-claim firewall evidence; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.35 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.35 | — | Add exact payment administration and invalid-claim firewall evidence; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.36 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.36 | — | Add exact reimbursement and invalid-claim firewall evidence; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.37 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.37 | — | Add both unchanged-obligation Subsequent Waiver branches; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.38 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.38 | — | Add the exact Claiming Team partial-protection reduction; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.39 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.39 | — | Add the exact Waiving Team partial-protection reduction; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.40 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.40 | — | Add the exact triggered-protection addition after reduction; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.42 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.42 | — | Add the waiving-Team exclusion probe and invalid-claim firewall; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.44 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.44 | — | Add valid succession and invalid-claim firewall evidence; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.46 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.46 | — | Add candidate allocation and complete validity-lifecycle evidence; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.47 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.47 | — | Add unilateral creatable-Room and complete validity-lifecycle evidence; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.48 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.48 | — | Add exact trade-dependent Room exclusion and complete validity-lifecycle evidence; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.49 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.49 | — | Add combined submission-time Room and complete validity-lifecycle evidence; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.50 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.50 | — | Add selected-valid-only award-time Room creation and invalid-claim firewall evidence; preserve every protected LEAF field. |
| DR2-0272 | LEAF | CBA2-R01.51 | — | ab8451a4dac4a5d4d385bfdd420610d722bb5d19 | revise | CBA2-R01.51 | — | Add all nine explicit per-claim validity probes and failed-owner outputs; preserve every protected LEAF field. |

## Reconciled populations and preservation

- Active scenario library: 82 top-level scenarios, 728 unique named cases,
  and 955 unique bidirectional named-case-to-LEAF exercise edges.
- SCEN coverage: 581 primary plus 80 secondary-only, or 661 total, with zero
  uncovered SCEN LEAF, zero inactive exercise target, and zero one-sided
  backlink.
- Historical mapping: 89 exact scenario fragments and 89 `SXW2` dispositions;
  the entire `16.v2.2` crosswalk is byte-identical to `ab8451a4` at 21,909
  bytes and SHA-256
  `08c5ed69be1075ad7a9909337b09be30b7d43dcf4114188bee142d64c468d787`.
- Lineage: one generic decision above the prior high-water mark produces 272
  generic decisions; 32 LEAF detail rows produce 822 structured AMEND details.
- The active R7 boundary from `### 16.v2` through the byte before `## 17.` is
  713,909 bytes with SHA-256
  `6ed0154a7428b096fbbba2ea5626636e63b8f8daf23cc0dc31fa3a19b7d4261e`.
- All 815 active LEAF main rows and all 823 EV2 rows are byte-identical to
  `ab8451a4`. All 744 LEAF dependency edges and 512 EV2 dependency edges are
  unchanged; every target exists and the LEAF graph has zero cycles. Across
  the 815 LEAF detail rows, only 32 Scenario-evidence and matching decision
  cells change; dependency and input-contract changes are zero.
- Exactly the 17 authorized existing case rows change, exactly 15 new case
  rows are added, no case is removed, and every other active R7 case row is
  byte-identical to `ab8451a4`.

## Validation

- Complete scenario/case/Exercises/backlink reconciliation: PASS at
  `82 / 728 / 955`, with complete `581 + 80 = 661` SCEN coverage.
- All nine Partial Waiver probes and the downstream invalid-claim firewall:
  PASS at the exact results recorded above.
- Targeted case shape, active-only Exercises, unchanged-case comparison,
  unchanged `SXW2`, rule/evidence preservation, dependency targets, and cycle
  checks: PASS.
- Frozen validator: the original authorized execution failed before the 238
  control cases completed. It exposed a singular receipt heading that hid
  `DR2-0272`, the required historical July 24 amendment-date pin, and
  hard-coded current-route status anchors. Those representation defects were
  corrected. The user then authorized exactly one additional execution on the
  completed candidate. That execution reached the control harness with all
  live population notes reconciled, but it exceeded the four-minute validation
  budget and was interrupted during the SRC2 mutation controls. It exited 130
  before producing a case total, `baseline_clean` result, negative self-test,
  cache-isolation result, or final verdict. The owner then explicitly authorized
  exactly one final execution with a one-time 15-minute hard wall-clock ceiling,
  waiving only the ordinary four-minute ceiling for that execution. The frozen
  validator remained unchanged and ran fresh, sequentially, without profiling
  or concurrent work. It finished naturally in 165.14 seconds and passed 20
  accepting controls plus 218 rejecting regressions: 238/238 PASS,
  `baseline_clean=yes`, zero failures, a successful knowingly-wrong-expectation
  negative self-test, a successful silent inventory cache-isolation self-check,
  and frozen route checksum
  `b0c97d74d1426a323101155d61ebb86d2c42d6f66023ba383173e797db0a8cc1`.
  This exceptional execution does not establish or claim compliance with the
  ordinary under-four-minute performance requirement.
- Targeted Markdown lint for the three authorized files with inherited `MD029`
  disabled: PASS.
- Exact three-file `npm run test:diff` invocation: PASS.
- `npm run docs:guardrails`: PASS.
- `npm run validate:project`: PASS.
- `git diff --check`: PASS.
- Full application suite, build/typecheck, application E2E, Graphify, and
  unrelated validation: intentionally not run because they are outside the
  authorized boundary.

## Handoff boundary

R8, renewed R9, owner acceptance, Phase 2, W1.1, Architect comparison or
application work, Linear, Graphify, and `main` remain unstarted and untouched.
Under the frozen route, repaired-candidate R8 is the next bounded maker unit;
renewed R9 remains the next independent whole-canon review.
