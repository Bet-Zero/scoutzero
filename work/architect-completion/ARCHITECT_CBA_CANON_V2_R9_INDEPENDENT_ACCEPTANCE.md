# Architect CBA Canon v2 — R9 independent acceptance

## Verdict

**REJECT** the exact pushed R8 checkpoint
`16920362f75b97bb34a01a1b317f40244a5e91cc` and Canon SHA-256
`a332748938c6564c936c7792a6827c06310832367e2680a693c4f01ea0c7982f`.

The frozen package is mechanically reconciled, but the whole-Canon source
review found material defects in the active evidence registry, partial-waiver
rules, and scenario library. The Canon remains unaccepted. Owner acceptance,
Phase 2, W1.1, the Architect comparison, application/runtime work, Linear, and
`main` remain blocked.

## Reviewed checkpoint and independence

- Topic branch: `architect/cba-canon-v2`.
- Reviewed R8 checkpoint: `16920362f75b97bb34a01a1b317f40244a5e91cc`.
- Direct parent: `762f58e09f816f40c710c3a0a8906a5ff6387282`.
- Local, tracking, and live remote topic refs matched before review; the
  worktree was clean.
- Local, tracking, and live remote `main` remained
  `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`.
- Frozen route contract SHA-256:
  `b0c97d74d1426a323101155d61ebb86d2c42d6f66023ba383173e797db0a8cc1`.
- This reviewer authored none of the Canon v2 rule or scenario content.

## Material findings

### 1. The direct CBA/By-Laws evidence registry fails its own citation minimum

Canon section 15.9.5 requires each `CBA`/`BYL` component to carry an exact
article, section, subsection or exhibit and a printed page. A complete parse of
all 790 active `EV2` rows found 105 of the 639 direct `CBA`/`BYL` components
without any printed-page locator. This is not a sample finding; it affects the
active R, L, and S families and includes `EV2-0581`, `EV2-0584` through
`EV2-0590`, `EV2-0594` through `EV2-0602`, and many later components through
`EV2-0810`.

Three populated page locators are also false under the Canon's recorded page
geometry. `EV2-0591`, `EV2-0592`, and `EV2-0593` cite Article XXII section
11(i) at printed pages 416–420. In the hash-matched signed CBA, section 11(i)
is on printed pages 391–396; printed pages 416–420 contain unrelated material.

Impact: the affected evidence chains do not meet the repeatable source-review
contract. A reviewer following the recorded pages cannot verify the claimed
obligation, including the chains used by `CBA2-SC-065(j)` and
`CBA2-SC-065(k)`.

Owning repair area: R6 evidence/source certification, followed by focused
independent R6 re-review.

### 2. The active partial-waiver rules omit controlling eligibility and money rules

The signed CBA Article XXII section 11(g)–(i), printed pages 391–396, makes the
Partial Waiver Procedure a narrow consequence of a Fitness-to-Play Panel
determination and a Team's contrary refusal to let the player play or
practice. It also supplies an Evaluation Period, a last-Contract-year
exclusion, and written-notice/designation duties. No active `CBA2` LEAF,
evidence component, dependency, or named scenario owns those prerequisites.

The populated owners are also materially incomplete:

- `CBA2-R01.15` / `EV2-0591` / `CBA2-SC-065(j)` omit the separate total
  applicable Minimum Player Salary floor, the strict upper bound below total
  full Base Compensation, the signed Remaining Protected/Unprotected Year
  definitions and option treatment, the first-protected-year Likely Bonus
  component of required room, and the restriction that immediately creatable
  room may use renouncements or waivers but not trades.
- `CBA2-R01.17` / `EV2-0593` omit the claiming Team's responsibility for all
  other Compensation, full Base Compensation in Remaining Unprotected Years,
  the Likely Bonus components of Team Salary, later trade/waiver deemed-Salary
  treatment, and Subsequent Waiver adjustments.

Impact: the Canon can accept an ineligible ordinary partial waiver, a bid below
the signed Minimum Player Salary floor, or a bid equal to full Base
Compensation; understate required room, payment responsibility, and Team
Salary; and miss later transaction and Subsequent Waiver consequences.
`CBA2-SC-065(j)` reproduces the incomplete rule and cannot expose these errors.
`CBA2-R01.14`–`CBA2-R01.18` are new R6 material through `DR2-0127`, so no
historical `XW2` edge cures the omitted source branches.

Owning repair area: R6 `R01` source-certified material, then the dependent R7
scenario material and focused independent re-review required by the plan.

### 3. Most R7 base cases are predicate templates, not exact scenarios

The R7 contract requires exact inputs, a boundary, an expected result, a
controlling evidence chain, and active rule IDs. Of 713 active named cases,
626 use the literal template that `P+` "asserts every atomic condition" and
`P−` is identical except that the boundary predicate is false. These rows name
input fields but provide no concrete field values and derive no expected
calculation; their PASS/FAIL result follows from the asserted predicate.

This affects every one-LEAF base-case family. Representative examples include
the Expanded-TPE formula case `CBA2-SC-001(h)`, partial-waiver case
`CBA2-SC-065(j)`, and indexed-value cases `CBA2-SC-082(a)` and
`CBA2-SC-082(b)`. The 87 retained/corrected historical interaction cases do
not supply the missing exact fixtures for those 626 base cases.

Impact: these cases cannot independently exercise arithmetic, strict versus
inclusive thresholds, date boundaries, state transitions, exception
collisions, or adverse variants. An implementation that merely echoes the
assumed predicate could satisfy the written expected result without applying
the rule.

Owning repair area: R7 scenario construction. Because this finding is global,
scenario sufficiency must be re-reviewed across the active library after
repair, followed by R8 reconciliation/checksum and a new R9 review.

## Whole-Canon review evidence

- Parsed and reconciled every governed active population: 61 GROUPs, 782
  LEAFs, 790 evidence components, 652 LEAF dependencies, 494 `XW2` edges over
  491 historical fragments, 29 terminal dispositions, 82 active scenarios,
  713 named cases, 902 named-case exercise edges, and 264 `DR2` records.
- Reviewed all 169 non-CBA evidence components by authority, source roots,
  dependencies, locator, passage, mapping, formula/provenance detail, and
  limitation. Screened every direct CBA/By-Laws evidence row for the governed
  printed-page requirement and every parseable PDF page locator against the
  hash-matched source text.
- Re-downloaded both immutable primary artifacts. The signed CBA matched
  SHA-256 `bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32`
  and 2,850,534 bytes. The June 2024 By-Laws matched SHA-256
  `be4d2781fe8fddfc5bc9028214298f742789a949dade4ead26368a4336d32ccf`
  and 422,247 bytes.
- Re-read the controlling partial-waiver source at Article XXII section
  11(g)–(i), printed pages 391–396, rather than relying on the receipt or
  validator.
- Re-read all three registered mutable NBA publications. Their current pages
  still carry the registered dates and exact values: 2023-24 Salary Cap
  `$136.021 million`; 2026-27 Salary Cap `$164.961 million`, Tax Level
  `$200.428 million`, Minimum Team Salary `$148.465 million`, First Apron
  `$209.015 million`, and Second Apron `$221.686 million`; and the 2025-26
  Regular Season dates October 21, 2025 through April 12, 2026.
- The frozen validator passed its bounded full-document route: 20 accepting
  controls plus 218 rejecting regressions, 238/238 PASS, baseline clean, zero
  failures. Its negative self-test rejected a deliberately wrong expectation,
  and the inventory cache-isolation self-check returned `True`.
- The Canon checksum and frozen route checksum both matched their pinned R8
  values.

## Limitations and unchanged scope

The live mutable NBA pages no longer reproduce the recorded snapshot bytes;
their current hashes and sizes differ, as the registered mutable-source
limitation anticipates. Their relied-on publication identity, dates, and
values were verified directly. The immutable primary artifacts reproduced
exactly.

The source-text locator screen was used only to direct complete evidence-row
review; it was not treated as semantic proof. The project knowledge graph was
older than the reviewed R8 checkpoint and was used only for read-only
orientation. It was not updated because R9 authorizes no Graphify write.

No Canon, repair plan, validator, prior receipt, application code, test,
schema, fixture, configuration, data, README, Linear record, Graphify output,
or `main` content was changed. No historical replay, application inspection,
Phase 2 work, merge, or owner-facing ACCEPT summary was performed.

## Renewed R9 independent whole-Canon review — checkpoint `3efe90d2`

### Verdict: REJECT

**REJECT** exact repaired-candidate R8 checkpoint
`3efe90d2755e49a169b699d8884681c074a0dc42` and Canon SHA-256
`85d84d6bb281b8c7355815798b8d4c5db13023a1eefa204cb79b3a79b9a810a0`.

The prior direct-evidence/locator, Partial Waiver, and later corrected-source
findings are repaired. The original global scenario-sufficiency finding is
not repaired or validly superseded: 614 current named cases still provide a
rule predicate as their positive input and its negation as their adverse
input, then expect PASS/FAIL without an independently checkable factual or
calculated result. That is a material whole-library R7 defect, so the renewed
R9 result cannot be ACCEPT.

### Baseline and independence

- Before review, local `HEAD`, the tracking ref, and the live remote topic ref
  were exactly `3efe90d2755e49a169b699d8884681c074a0dc42`, with 0 ahead and
  0 behind. Its direct parent was exactly
  `95373507b165892beaf12acf21fc5aa09152af82`.
- Local and live remote `main` were exactly
  `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`. The worktree was clean and
  the required ancestry was intact.
- The Canon was exactly 2,092,520 bytes with the required SHA-256 above. The
  independently recomputed nine-field frozen-route checksum was exactly
  `b0c97d74d1426a323101155d61ebb86d2c42d6f66023ba383173e797db0a8cc1`.
- This was a fresh checker task. The reviewer authored none of the v2 rule,
  evidence, or scenario content and made no maker repair. Receipts and prior
  validator results were used only to locate protected history and were not
  substituted for source or scenario review.

### Complete whole-Canon reconciliation

Independent parsing of the actual Canon and maker records reproduced every
required anchor:

| Governed population | Renewed R9 result |
|---|---:|
| GROUPs | 61 |
| Active LEAF main/detail rows | 815 / 815 |
| EV2 components | 823 |
| XW2 edges | 494 |
| LEAF / EV2 dependency edges | 744 / 512 |
| Active scenarios / named cases | 82 / 728 |
| Exercise edges / covered SCEN LEAFs | 955 / 661 |
| Historical scenario fragments / SXW2 edges | 89 / 89 |
| Generic DR2 decisions / structured AMEND details | 272 / 822 |
| Terminal dispositions | 29 |

All identities were unique. Every LEAF/detail, evidence dependency, scenario
exercise/backlink, XW2 target, terminal edge, current lineage endpoint, and
accepted-unit reference resolved. Both dependency graphs were acyclic. The
current register contains no mechanically open blocker, unresolved record,
surviving deferral, or `no-successor` edge.

The R7 boundary independently reproduced at 713,909 bytes and SHA-256
`6ed0154a7428b096fbbba2ea5626636e63b8f8daf23cc0dc31fa3a19b7d4261e`.
The historical scenario crosswalk independently reproduced at 21,909 bytes
and SHA-256
`08c5ed69be1075ad7a9909337b09be30b7d43dcf4114188bee142d64c468d787`.

The 491 recorded historical rule fragments reconcile as 484 current fragments
plus seven forward-superseded fragments. All 494 XW2 edges, ten multi-target
bundles, 89 scenario fragments/SXW2 edges, 29 terminal dispositions, four
search sets, and 17 search records join bidirectionally without a missing
target or scope. Every terminal disposition was reviewed individually. There
are no `no-successor` edges. The four `unsupported-residual` edges are
`XW2-0145`, `XW2-0148`, `XW2-0191`, and `XW2-0495`; each remains narrowly
bounded, current, reopenable, and supported by its complete registered search
set. The other 25 terminal dispositions truthfully preserve invalid scenario
or rule claims and process-only material.

Accepted R3.1, R4, R5, original R6, and corrected R6 maker/checker checkpoints
are all ancestors of the candidate. Protected identities, forward AMEND
lineage, retired gaps, and high-water allocations reconcile without reuse or
renumbering. The independently accepted corrected-R6 checkpoint protects the
cumulative source repair; the later delta changes only the authorized R7
scenario/backlink surfaces and maker R8 status/checksum surfaces.

### Complete source and evidence review

Freshly acquired immutable primary artifacts reproduced exactly:

| Artifact | Bytes | Pages | SHA-256 |
|---|---:|---:|---|
| Signed 2023 NBA-NBPA CBA | 2,850,534 | 676 | `bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32` |
| June 2024 NBA Constitution and By-Laws | 422,247 | 88 | `be4d2781fe8fddfc5bc9028214298f742789a949dade4ead26368a4336d32ccf` |

All 823 EV2 components were reconciled by owner, authority, source roots,
dependencies, locator, passage, mapping, limitation, and backlink. The current
authority totals are 647 CBA, 17 BYL, 4 NBA, 6 DERIVED, 137 INFERRED, and 12
EXT. The complete primary-source locator cohort is 665 rows: 664 directly
classified CBA/BYL components plus the two-artifact `EV2-0704` inference.
Every one has an artifact-appropriate printed-page locator, and each locator
and controlling proposition was replayed against the hash-matched extracted
page corpus. Receipts supplied no source conclusion.

The formerly missing-page population is closed. `EV2-0591`–`EV2-0593` now
point to the correct Article XXII section 11(g)–(i) passages on printed pages
391–394, with the section's opening on printed page 390 correctly included
where needed. The complete section through printed page 396 and every affected
R/L/S evidence component through the current high-water mark were re-read.
No false locator from the first R9 remains.

The three mutable official pages were reacquired. Their live bytes differ
from the registered snapshots exactly as the recorded mutable-source
limitation anticipates, but their relied-on facts remain present: 2023-24 Cap
`$136.021 million`; 2026-27 Cap `$164.961 million`, Tax `$200.428 million`,
Minimum Team Salary `$148.465 million`, First Apron `$209.015 million`, and
Second Apron `$221.686 million`; and the 2025-26 Regular Season dates October
21, 2025 through April 12, 2026. No mutable page supplied an unregistered
fact.

Relevant-rule, exception, atomicity, owner, lifecycle, dependency-direction,
and input-contract review found no additional source or rule defect across
the A/C/R/L/S families. Direct owners remain separate from staged aggregates,
unsupported results remain limited, and external determinations remain
qualified inputs rather than inferred facts.

### Mandatory prior-finding regression results

| Prior R9 finding | Renewed disposition |
|---|---|
| Missing or false direct CBA/BYL printed-page support | **Fully repaired.** All 665 current primary-source rows reconcile; `EV2-0591`–`EV2-0593` and all affected R/L/S locators are accurate. |
| Incomplete Partial Waiver ownership, Room, validity, selection, and downstream lifecycle | **Fully repaired.** `CBA2-R01.14`–`.51` is complete, correctly directed, and source-supported. |
| Tautological one-LEAF scenario population | **Still materially unresolved.** The literal population fell from 626 to 614, but its governing defect is unchanged. |

The complete Partial Waiver chain was replayed from source through scenario
results: eligibility and notice; minimum and strict maximum claim bounds;
unprotected-compensation floor; actual and qualifying creatable Room;
trade-dependent Room exclusion; combined submission sufficiency; per-claim
validity; full-before-partial selection; award-time creation; allocation;
payment, Team Salary, later transaction, reimbursement, succession; and every
Subsequent Waiver branch. All nine `SC-065(v)` probes produce their recorded
failed-owner or PASS results. Only valid lower bid V9 reaches selection and
the `$3.5m / $7m / $10.5m` allocation; V1–V8 produce no downstream mutation,
and removing V9 terminates the Contract at waiver expiry. This prior finding
is closed.

The later corrected chains also pass independent source replay:

- `CBA2-R02.1` / `EV2-0595` keeps Article II payment stretching, Article VII
  Team Salary re-attribution, original-year set-off, sections 5(a)/5(b)
  allocation, and the post-original-term bar distinct.
- `CBA2-R02.4` / `EV2-0598` applies section 5(b) to corresponding
  re-attributed Salary and uses section 5(a) only for its incorporated equal-
  allocation method.
- `CBA2-L03.4` / `EV2-0693` proves authenticated assignment and
  same-but-no-greater draft rights, not immediate tradability.
- `CBA2-L03.15` / `EV2-0704` truthfully joins By-Laws section 4.01(a) to CBA
  Article I section 1(mm)'s July 1 12:01 a.m. through July 6 noon Eastern
  definition. Article II section 15 and Article VII section 9 are not used as
  the definition or Assignment Transaction authority.
- The repaired `SC-066`, `SC-072`, `SC-076`, and `SC-077` cases use concrete
  dates, states, amounts, adverse variants, and exact results consistent with
  those sources.

### Material global scenario finding

The exact literal census is 614 of 728 named cases across 81 of 82 scenario
families: `CBA2-SC-001` through `CBA2-SC-071` and `CBA2-SC-073` through
`CBA2-SC-082`. Only `CBA2-SC-072` has none. Every affected row still says:

> P+ asserts every atomic condition in the quoted boundary; P− is identical
> except that boundary predicate is false

This census is not the reason for rejection by itself. Each affected case was
judged under the frozen R7 acceptance rule. The shared `R7-FIX-2026` heading
supplies only a date/version context; its `leaf input contract=` text names
fields but assigns no case values. The positive vector assumes the complete
legal conclusion to be proved, the adverse vector merely negates that same
conclusion, and the expected result restates PASS/FAIL. It therefore does not
independently specify the arithmetic operands and output, threshold-side
values, dated comparison, state transition, exception collision, or lifecycle
mutation named by the boundary. An implementation that echoes the supplied
predicate can satisfy the case without implementing the rule.

Concrete examples include `CBA2-SC-001(a)`'s TPE formula, the remaining
ordinary `SC-065` cases, and `CBA2-SC-082` derived-value cases: the input cell
does not assign the values needed to calculate the exact expected result.
Their valid source chains and accurate Exercises do not make the scenario
oracle non-tautological.

The other 114 cases were also reviewed: the 12 repaired former base cases and
15 new Partial Waiver cases provide concrete independent vectors, while the
87 retained/corrected interaction cases preserve their separate historical
roles. None supplies the missing facts or expected outputs for a different
one-LEAF case. The common fixture language was already present at the first
R9-rejected checkpoint, and no independently accepted governing-contract
change superseded the exact-input and independently checkable-result duty.

Affected population: the 614 cases identified by the exact criterion and
family range above. Demonstrated impact: scenario truth and comparison
readiness cannot be established for those cases, so whole-Canon scenario
sufficiency and global completeness fail. Owning repair stage: **R7 scenario
construction**. Because the defect spans 81 families, it is global rather
than localized. After R7 repair, the full active scenario library requires
renewed sufficiency review, followed by a new R8 reconciliation/checksum and
renewed R9 whole-Canon review.

### Frozen validator and scope

The unchanged frozen validator was executed exactly once before this report,
in one fresh sequential process against the clean pinned checkpoint. It
completed within the authorized 15-minute ceiling:

- 20 accepting controls plus 218 rejecting regressions;
- 238/238 PASS, `baseline_clean=yes`, and zero failures;
- knowingly wrong-expectation negative self-test: successful;
- inventory cache-isolation self-check: successful;
- frozen route checksum:
  `b0c97d74d1426a323101155d61ebb86d2c42d6f66023ba383173e797db0a8cc1`;
- actual `/usr/bin/time` runtime: 134.44 seconds real, 73.80 seconds user,
  45.15 seconds system.

The mechanical PASS does not inspect whether concrete scenario facts and
oracles are semantically sufficient, so it does not override the R7 finding.

This renewed checker changed only this appended report. It did not change the
Canon, repair plan, validator, R8 or maker/checker receipts, application code,
tests, data, schemas, configuration, README, Linear, Graphify, or `main`.
Temporary review scripts and downloaded artifacts remained outside the
repository. No owner acceptance, Phase 2, W1.1, Architect comparison,
application work, merge, or main-branch action was performed. R7 repair, R8,
renewed R9, owner acceptance, and every downstream phase remain blocked.
