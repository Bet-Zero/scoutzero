# Architect CBA Canon v2 — Phase 2 implementation audit

## Status

**Corrected Phase 2 audit candidate; awaiting narrow cross-model
re-verification. No application fixes are underway.**

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

Implementation-state terms use the owner-accepted definitions from the
cross-model reconciliation decision:

> **`incorrect`** — the application produces a result that conflicts with the Canon
> obligation. This includes an implementation that is present but incomplete where the
> incompleteness yields a Canon-wrong answer, not only a wrong constant, threshold, or
> inverted condition.
>
> **`partial`** — an implementation route exists and its outputs are consistent with the
> Canon as far as they go, but the obligation is not fully discharged.
>
> **`absent`** — no implementation route exists, established by negative search across
> the plausible vocabulary and surfaces, not by a single failed symbol lookup.

Severity is product risk. High means a gap could materially produce a wrong,
misleading, illegal, or unusable result in a currently approved Architect
workflow, or is a foundational model defect affecting many such workflows.
Medium identifies a meaningful current-workflow limit that does not meet High
or has a reliable mitigating guardrail. Low preserves a real Canon gap with
little current-product impact or no approved-workflow dependency. None means no
implementation defect. Claude's blind severity results were used only as a
directional cross-check; the official evidence and approved V1 workflow
boundary determine this register's score.

## Results

### Pass 1 — deterministic correctness

Completed 2026-08-07. The checkpoint covers all 151 A-family leaves plus the
22 directly supporting hard-cap, Second Apron pick-history, and Expanded-TPE
provenance leaves in L07-L09 and S04: 173 records total.

| Measure | Pass 1 count |
|---|---:|
| Correct | 7 |
| Incorrect | 36 |
| Partial | 56 |
| Absent | 74 |
| Covered and proven | 6 |
| Partial Canon coverage | 93 |
| Missing in scope | 64 |
| Data-blocked | 10 |
| High severity | 79 |
| Medium severity | 78 |
| Low severity | 9 |
| No defect severity | 7 |

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

The seven correct leaf behaviors are the one-year Standard TPE window, the S&T
four-season maximum, cash staying outside Team Salary, the general one- or
two-season non-rookie extension bar, and Transaction Restrictions Table rows A,
B, and C assigning BAE, Non-Taxpayer MLE, and sign-and-trade acquisition to the
First Apron Level. The extension bar has insufficient aligned test evidence and
remains partial Canon coverage; the other six are covered and proven. All seven
have None product-risk severity because no implementation defect remains on
their own atomic obligations.

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
| Covered and proven | 2 |
| Partial Canon coverage | 103 |
| Missing in scope | 132 |
| Data-blocked | 2 |
| Externally adjudicated | 7 |
| High severity | 132 |
| Medium severity | 37 |
| Low severity | 73 |
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
The first two lack aligned proof tests and therefore remain partial Canon
coverage with insufficient evidence; the other two are covered and proven.
All four have None product-risk severity because evidence strength does not
convert a correct implementation into a product defect.

### Pass 3 — full GM depth

Completed 2026-08-07. The checkpoint covers C16-C25, R01, R05, L01-L05, and
L10: the remaining 396 records and therefore the full 815-leaf universe.

| Measure | Pass 3 count |
|---|---:|
| Correct | 2 |
| Incorrect | 172 |
| Partial | 40 |
| Absent | 182 |
| Covered and proven | 2 |
| Partial Canon coverage | 212 |
| Missing in scope | 165 |
| Data-blocked | 2 |
| Externally adjudicated | 15 |
| High severity | 153 |
| Medium severity | 128 |
| Low severity | 113 |
| No defect severity | 2 |

The deepest GM workflows expose the same architectural limit as the first two
passes: useful scalar fields and actions exist, but dated governed transactions
and their component ledgers do not.

- Rookie Scale, maximum-salary, extension, option, guarantee, incentive, and
  buyout surfaces cover fragments. They do not form one exact contract-route
  model with scale classes, notices, award/team history, compensation
  components, effective dates, amendments, and supersession.
- Over-38 allocation, signing-bonus allocation, Ten-Day and Rest-of-Season
  Contracts, Exhibit 9/10, Summer Contracts, drafted-player rights, retirement,
  pending agreements, and grievance ledgers are absent.
- Two-Way players are correctly limited to three and their Salary is correctly
  excluded from Team Salary. The rest of the Two-Way contract, proration,
  eligibility, protection, conversion, usage, advance, affiliate, and rights
  engine is absent; an existing test expressly permits a three-year Two-Way
  Contract because term validation skips the type.
- yearly rows preserve guarantee amounts, option markers, and likely/unlikely
  incentive totals, but do not enforce protection progression, future-maximum
  adjustment order, component-specific annual changes, incentive/bonus caps,
  deferral, international payments, loans, or insurance reimbursement.
- option decisions persist exercise/decline effects, yet use an
  upcoming-season proxy instead of exact deadlines and do not model notice,
  protection alternatives, ETO shape, or downstream RFA/Extension effects.
- a buyout scalar reduces remaining guaranteed money and writes dead cap, but
  there is no written agreement, pro-rata original-term reduction, set-off
  route, payment allocation, or complete reacquisition bar.
- direct waiver currently means immediate release. It has no separate request,
  claim, priority, pending financial responsibility, unclaimed expiry, or
  ordinary/Partial Waiver lifecycle.
- worlds can store an `asOfDate`, while multiple authoritative helpers still
  fall back to today/current year. Contract, consent/trade-bar, RFA/Offer Sheet,
  and drafted-player-rights state therefore lacks one immutable dated event
  history.
- medical, physical, expert, grievance, hardship, legal, and League decisions
  have no authenticated external-determination record with authority, scope,
  effective period, visible unresolved state, and supersession history.

The only fully correct and proven Pass 3 leaves are the ordinary maximum of
three Two-Way players and exclusion of Two-Way Salary from Team Salary.

All three audit passes remain complete. The owner-authorized reconciliation is
now applied, and the corrected candidate awaits narrow cross-model
re-verification.

## Final reconciliation

The corrected register contains all and only the 815 active v2 LEAF identities,
exactly once. Its overall result is 13 correct, 145 partial, 260 incorrect, and
397 absent. No leaf was classified `not applicable`, and no intentional
exclusion was invented.

### Counts

| Implementation state | Count |
|---|---:|
| Correct | 13 |
| Partial | 145 |
| Incorrect | 260 |
| Absent | 397 |
| Not applicable | 0 |

| Canon coverage | Count |
|---|---:|
| Covered and proven | 10 |
| Partial | 408 |
| Missing in scope | 361 |
| Data-blocked | 14 |
| Externally adjudicated | 22 |
| Intentional exclusion | 0 |

| Pass | Correct | Partial | Incorrect | Absent | Total |
|---|---:|---:|---:|---:|---:|
| Deterministic correctness | 7 | 56 | 36 | 74 | 173 |
| Cap Manager completeness | 4 | 49 | 52 | 141 | 246 |
| Full GM depth | 2 | 40 | 172 | 182 | 396 |
| **Total** | **13** | **145** | **260** | **397** | **815** |

| Product layer | Covered | Partial | Absent | Not applicable |
|---|---:|---:|---:|---:|
| Representation / data model | 4 | 411 | 400 | 0 |
| Calculation | 4 | 383 | 421 | 7 |
| Enforcement | 4 | 383 | 428 | 0 |
| Explanation / UI presentation | 5 | 411 | 399 | 0 |
| Lifecycle / persistence | 3 | 340 | 472 | 0 |

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 364 |
| Medium | 243 |
| Low | 195 |
| None | 13 |

Runtime inputs are available for 61 leaves, partially available for 523,
missing for 195, externally determined for 35, and not required for one. The
split preserves the prior available, external-determination, and not-required
classifications; only former `missing` rows with recorded evidence of some
required inputs moved to `partial`. Evidence is proven for 446 leaves and
insufficient for 369. All 368 rows whose evidence explicitly declares a
missing, weak, adjacent-only, or otherwise non-aligned relevant test are
insufficient; `CBA2-R04.1` is additionally insufficient because its cited tests
do not assert the `2n+1` formula. The three otherwise-correct but unproven leaves
are `CBA2-A10.21`, `CBA2-C10.1`, and `CBA2-R04.1`; they retain correct
implementation judgments, partial Canon coverage, insufficient evidence, and
None product-risk severity.

### Shared roots and Phase 3 size

The 802 non-correct leaves collapse into 57 shared root-cause clusters. The
largest are waiver claims (51), advanced contract routes (50), Exhibit/Summer
Contracts (43), exception methods (40), trade-bonus lifecycle (39), Two-Way
Contracts (35), extensions (30), Bird history (29), special compensation (27),
options (22), roster/list clocks (21), and short contracts (20). The register
retains every cluster and exact leaf mapping.

This makes Phase 3 a large foundational implementation program, not 805
independent fixes. A coherent first decomposition is eight workstreams:

1. governed season inputs, immutable world time, source versions, and external
   determinations;
2. independent Team/Apron/Tax Salary and payment ledgers plus componentized
   compensation;
3. immutable contract, transaction, notice, decision, and supersession events;
4. trade paths/decomposition, hard-cap rows, cash, and pick-history state;
5. Standard/Rookie/Two-Way/Exhibit/short-contract authoring and validation;
6. exceptions, Bird/RFA/Offer Sheet, DPE, and medical lifecycles;
7. Player Lists, roster clocks, game usage, waivers, buyouts, set-off, and
   retirement/grievance state;
8. explanation/UI authoring depth and Canon-aligned proof tests.

The first seven require foundational model, persistence, or governed-data
changes. Starting with isolated leaf validators would preserve the current
conflated state and create more contradictory behavior.

### Material risks

- Green tests currently pin several Canon-wrong behaviors, including rounded
  Expanded TPE values, universal poison-pill treatment for rookie-scale
  players, retired aggregation timing, a zero-guarantee trade-bonus result,
  advisory Trade Call roster room, and a three-year Two-Way Contract.
- Today/current-year and latest/prior-season fallbacks can make historical or
  future results appear authoritative without the required inputs.
- Existing mutation actions persist coherent application state, but that state
  is often too coarse to distinguish request, approval, effective, expiry,
  amendment, allocation, and supersession events.
- Independent Team/Apron/Tax Salary, payment, roster/list, rights, and external
  decision ledgers cannot be supplied reliably by presentation-only changes.

If independent re-review accepts this repaired audit boundary, the exact next
recommendation is to authorize a Phase 3 planning pass that turns the eight
workstreams into sequenced issues, starting with governed inputs/events and
independent ledgers. No Phase 3 issue has been created during this audit.

## Validation log

| Check | Result |
|---|---|
| `npm run test:diff -- --reporter=dot` | PASS — FAST tier, 57/57 tests |
| `npm run validate:project` | PASS — setup checkpoint; initial sandbox write was denied, then the same command passed with the required workspace permission |
| `npm run test:trade -- --reporter=dot` | PASS — 72 files, 635/635 tests |
| `npm run test:architect -- --reporter=dot` | PASS — 305 files, 3,555/3,555 tests; 257.00 seconds, exceeding the four-minute budget by 17 seconds; not repeated |
| `npm run test:diff -- --files <Phase 2 artifacts> --reporter=dot` | PASS — FAST tier, 57/57 tests at each audit checkpoint |
| `python3 work/architect-completion/cba_canon_v2_phase2_integrity.py` | PASS — 815 unique Canon/register identities; A 151, C 417, R 118, L 102, S 27 |
| `python3 -m json.tool <implementation-gap register>` | PASS — valid JSON; schema version 2.0 |
| Owner-reconciliation before/after invariant comparison | PASS — only A05.3/.4/.5 implementation states changed; all 815 identities/order, Canon fields, evidence strengths, product layers, and 57 clusters preserved |
| Evidence-schema preservation proof | PASS — all prior evidence strings preserved; 729 path-array prose occurrences moved byte-for-byte, and three displaced A05 family-note strings retained on their actual owning leaves |
| Runtime-input split proof | PASS — exactly 523 `missing` rows moved to `partial`; all 61 available, 195 genuinely missing, 35 external-determination, and one not-required classifications reconcile |
| Evidence-strength consistency proof | PASS — all 368 explicit missing/weak/non-aligned-evidence rows are insufficient; no covered/proven contradiction; the three correct/unproven leaves are partial/None; exact totals are 446 proven / 369 insufficient |
| Evidence-path existence check | PASS — 129 path-array files plus 12 byte-preserved negative-search references; all 141 unique cited source/test paths resolve |
| `git diff --check` | PASS |
| `npm run lint:md` | FAIL — pre-existing/out-of-scope violations in three `docs/architect/audits/` files, `docs/CODEBASE_MAP.md`, and the frozen accepted Canon; the configured command does not include `work/` |

No application test failed and no test command was retried. The full suite was not run
because the prompt did not contain `RUN FULL SUITE`. Build, typecheck, lint,
`test:node`, `test:ui`, and `test:cap-sheet-boundary` were intentionally skipped
because application code/tests/configuration did not change; the already-run
Architect suite also crossed the four-minute budget and was not repeated.
Graphify update was intentionally skipped because this audit is read-only and
the objective forbids regenerating or committing Graphify output.

### Maker remediation after independent REJECT

The initial independent REJECT below is preserved as the durable review
history. In response, the maker register was repaired without changing any
application file or any implementation-state, product-layer, runtime-input, or
root-cause-cluster judgment:

- all 335 rows whose test evidence explicitly declares a missing or weak
  relevant test were reclassified from `proven` to `insufficient`;
- `CBA2-R04.1` was also reclassified as insufficient because its cited tests do
  not assert the `2n+1` formula;
- `CBA2-A10.21`, `CBA2-C10.1`, and `CBA2-R04.1` were reconciled to partial Canon
  coverage with Medium evidence-gap severity;
- the repaired totals are 479 proven / 336 insufficient, 7 covered and proven
  / 411 partial coverage, and 613 High / 194 Medium / 1 Low / 7 None severity.

Only the evidence classifications, their dependent coverage/severity fields,
and explanatory notes for the affected correct leaves changed. This repaired
maker checkpoint now requires re-review by the same fresh independent checker;
the maker cannot replace the REJECT with acceptance.

## Independent review

**REJECT — maker checkpoint `6a91edc4` is mechanically complete, but its
evidence classifications are not trustworthy.**

The fresh review reconciled all 815 Canon leaves, inspected all 57 unique
implementation/evidence clusters, fully reviewed the 806 records in the
required risk cohorts, and checked all nine remaining correct/proven records.
The Canon checksum, identity/order/family counts, summary totals, cited-path
existence, frozen ancestry, maker boundary, and no-application-change proof all
pass.

Blocking evidence defects:

- The objective says missing or weak tests must be `insufficient`. The register
  itself declares that no relevant test was located for 333 records, but marks
  332 of them `proven`. This includes `CBA2-C10.1`, which is classified
  `correct` / `covered and proven` while its sole test citation says no aligned
  Minimum Team Salary test was located.
- `CBA2-A10.21` is internally contradictory: it is `covered and proven` while
  its evidence strength is `insufficient`, its notes say no aligned Canon
  boundary test exists, and the summary acknowledges the evidence gap.
- `CBA2-R04.1` is `correct` / `covered and proven` even though neither cited
  test calls `getStretchProvisionYears` or asserts the Canon `2n+1` boundary.
  The source formula is inspectable, but the supplied tests are not aligned
  proof under the objective.

These defects overstate the `covered and proven` and `proven` totals and make
the final evidence reconciliation unsafe to accept. Reclassify every missing
or weak-test row, repair the affected counts and prose, and submit one new
frozen maker checkpoint for independent review. No maker artifact was repaired
by this checker.

### Independent re-review

**REJECT — repaired maker checkpoint `043a0ea0` fixes the initial cohort, but
its weak-test reconciliation remains incomplete.**

The re-review proved that `6a91edc4..043a0ea0` changes only the register and
summary. In the register, 336 rows changed: 335 evidence-strength fields, three
dependent coverage fields, two dependent severities, and explanatory
evidence/remediation text for two leaves. Canon identity/order, implementation
state, product layers, runtime inputs, clusters, and application files are
unchanged. The checksum, 815-leaf join and family counts, 57 clusters, 141
resolving evidence paths, pass tables, headline counts, ancestry, and
no-application-delta boundary all pass.

Independent semantic grouping reproduced the maker's repaired cohort: 333 rows
say no relevant test was located and `CBA2-R09.2`/`.3` say the cited tests
contain no relevant assertion; all 335 are now `insufficient`.
`CBA2-R04.1` is also correctly the next insufficient row because its cited
tests do not assert `2n+1`. Source inspection continues to support the three
correct-but-unproven code judgments for `CBA2-A10.21`, `CBA2-C10.1`, and
`CBA2-R04.1`, and each is consistently partial / Medium / insufficient.

One blocker remains: 30 additional records are still `proven` even though
their own test-evidence text expressly says the tests cover adjacent behavior,
not the relevant Canon obligation:

- `CBA2-C07.1`–`.11` (11): threshold tests, not the ten Apron Salary
  adjustments;
- `CBA2-C12.1`–`.9` (9): DPE placeholder clearing, not Canon eligibility,
  amount, method, use, or expiry;
- `CBA2-R07.1`–`.3` (3): current advisory counts, not shortage-clock
  persistence; and
- `CBA2-S04.1`–`.7` (7): rounded formula outputs, not provenance/input record
  IDs.

Those are explicitly weak tests under the objective and must be
`insufficient`. Therefore the claimed 479 / 336 evidence totals and the
evidence-consistency validation line are not trustworthy; reclassifying just
these known rows would produce 449 proven / 366 insufficient. No maker artifact
was repaired by this checker.

### Maker remediation after independent re-review REJECT

The second independent REJECT above is also preserved. The maker reclassified
exactly the 30 named C07, C12, R07, and S04 leaves as `insufficient`, producing
the independently projected totals of 449 proven / 366 insufficient. No Canon
identity, implementation state, coverage, severity, product-layer,
runtime-input, remediation, cluster, or application field changed in this
second repair.

The evidence consistency proof now covers the union of the initial 335-row
missing/weak-test cohort and these 30 adjacent-only/non-aligned test rows, plus
the separately inspected `CBA2-R04.1`. This second repaired maker checkpoint
requires a final verdict from the same independent checker; the maker cannot
self-accept it.

### Final independent review

**REJECT — frozen maker checkpoint `581ab9ce` applies the named 30-row repair
exactly, but the full evidence reconciliation is still incomplete.**

The final review proved that `043a0ea0..581ab9ce` changes only the register and
summary. The register changes exactly `CBA2-C07.1`–`.11`, `CBA2-C12.1`–`.9`,
`CBA2-R07.1`–`.3`, and `CBA2-S04.1`–`.7`: 30 `evidence_strength` values move
from `proven` to `insufficient`, with no other register field changed. Both
prior REJECT reports are preserved. The Canon checksum, 815 identities and
order, A151/C417/R118/L102/S27 family counts, 57 clusters, 141 resolving paths,
pass/final tables, ancestry, exact three-file package, and no-application-delta
boundary all pass.

Semantic inspection of all 61 distinct test-evidence descriptions confirms
the 365 test-field rows that explicitly describe missing, weak, adjacent-only,
or non-asserting evidence are now insufficient. `CBA2-R04.1` is also correctly
the separately inspected insufficient row. No covered-and-proven row is
insufficient, and source behavior continues to support the correct-but-
unproven judgments for `CBA2-A10.21`, `CBA2-C10.1`, and `CBA2-R04.1`, each of
which remains partial / Medium / insufficient.

The blocking exception is in the inspection evidence outside that 365-row
test-field cohort: `CBA2-C05.1`, `CBA2-C05.3`, and `CBA2-C05.5` each explicitly
says there is no independent reimbursement-eligibility test for one-Season,
Ten-Day, or Rest-of-Season Contracts. Their cited minimum-scale and dead-cap
tests contain no such reimbursement-eligibility coverage, yet all three remain
`proven`. The objective requires missing or weak tests to be `insufficient`.
Therefore 449 proven / 366 insufficient and the evidence-consistency validation
claim are not trustworthy; correcting these known rows would produce 446
proven / 369 insufficient. No maker artifact was repaired by this checker.

### Maker remediation after final independent review REJECT

The third independent REJECT above is preserved. The maker reclassified exactly
`CBA2-C05.1`, `CBA2-C05.3`, and `CBA2-C05.5` as `insufficient`, producing the
independently projected totals of 446 proven / 369 insufficient. No other
register field and no application file changed.

The evidence consistency proof now includes all 365 semantically non-aligned
test-field rows, the three additional C05 inspection-note gaps, and the
separately inspected `CBA2-R04.1`. The same independent checker must issue the
acceptance verdict; the maker cannot self-accept this repair.

### Independent acceptance re-review

**ACCEPT — frozen maker checkpoint `b9166f14` satisfies the authorized Phase 2
audit objective.**

The acceptance review proved that `581ab9ce..b9166f14` changes exactly
`CBA2-C05.1`, `CBA2-C05.3`, and `CBA2-C05.5` from `proven` to `insufficient`;
no other register field or application file changed. All three prior REJECT
reports remain intact, and the summary accurately records each remediation.

The full semantic pass inspected all 61 distinct test-evidence descriptions
and 137 normalized inspection-note descriptions. All 365 explicit test-field
gaps and all three explicit C05 inspection-note gaps are insufficient, with
`CBA2-R04.1` separately inspected as the 369th insufficient row. No remaining
proven record says its aligned proof is missing, weak, adjacent-only, or
non-asserting. The cash records whose notes say tests pin an incomplete
sent-only model are valid proven evidence of incorrect behavior, not
missing-test admissions.

The exact result is 446 proven / 369 insufficient, with no
covered-and-proven/insufficient contradiction. `CBA2-A10.21`, `CBA2-C10.1`,
and `CBA2-R04.1` are the only correct-but-unproven leaves; source inspection
supports each implementation judgment, and each remains partial / Medium /
insufficient. The Canon checksum, 815 identities and exact order,
A151/C417/R118/L102/S27 family counts, 57 clusters, 141 resolving evidence
paths, pass/final tables and prose, ancestry, exact three-file package, and
no-application-delta boundary all pass.

Acceptance certifies the completeness and trustworthiness of the Phase 2
read-only audit, not CBA completeness of the application. The register still
reports 805 non-correct leaves and 369 insufficient-evidence leaves, so the
documented foundational Phase 3 program and aligned proof work remain the
appropriate next step. No maker artifact was repaired by this checker beyond
recording this independent verdict and accepted status.

## Current corrected candidate

The historical review record above remains unchanged in substance, but its
acceptance predates the owner reconciliation decision at `4487bc6a`. The
official corrected candidate now:

- re-scores severity as product risk against the approved V1 workflow boundary;
- corrects only `CBA2-A05.3`, `CBA2-A05.4`, and `CBA2-A05.5` to correct / None,
  while retaining every displaced hard-cap finding on its actual owning leaves;
- publishes the owner-accepted implementation-state definitions;
- uses evidence schema 2.0 with path arrays separated from byte-preserved
  negative-search prose; and
- splits runtime inputs into available, partial, missing, external
  determination, and not required.

This corrected candidate is not self-accepted and does not close Phase 2. It
awaits the bounded cross-model re-verification required by the owner decision.
No application, Linear, or Phase 3 state changed during this reconciliation.
