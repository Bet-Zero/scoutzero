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

## Post-global-R7 renewed R9 independent acceptance — checkpoint `9b263272`

### Verdict: REJECT

**REJECT** exact post-global-R7 R8 checkpoint
`9b263272cad2f7643ea394beaa7bdd96cf1a1b97` and Canon SHA-256
`4bf1c587e844990d5dda26eedf382c632ef90a663700f221d68c9c2ef66524f0`.

The global R7 maker replaced every one of the 614 literal predicate templates,
but the complete case-by-case review found material defects in 65 repaired
cases across 38 repaired families. Deterministic semantic confirmation of the
114 byte-preserved cases found one additional, pre-existing mapping defect.
The 66 affected cases span 39 families. Their scenario records are not all
internally possible, independently calculable, source-correct, atomic, or
consistent with their registered owners. The candidate therefore is not a
sufficient Phase 1 Canon.

### Baseline, independence, and preservation chain

- Before review, local `HEAD`, the tracking ref, and the live remote topic ref
  were exactly `9b263272cad2f7643ea394beaa7bdd96cf1a1b97`, 0 ahead and 0
  behind. Its direct parent was
  `b2ef24dc20e0646c3583b39053b3f0222f5b5838`.
- Local, tracking, and live remote `main` were exactly
  `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`. Ancestry was intact and the
  worktree was clean.
- The Canon was exactly 2,104,588 bytes with the reviewed hash above. The
  protected global-R7 boundary was exactly 724,784 bytes with SHA-256
  `f558f126743f2eb1a64baaeec404a6952030399749ba538d7b799110966b309a`.
- This checker authored or repaired none of the governed v2 rules, sources,
  evidence, dependencies, mappings, lineage, or scenarios. Maker receipts
  were treated as claims and independently checked. The sole repository write
  is this appended checker section.
- The pre-append report was byte-identical to its report-only checker commit
  `d618e65c5377999cd0543a5b17a3fa7cc29e6fe4`: 21,308 bytes, SHA-256
  `6d62d77118dee765a19669edfc3d6f50e2eedeb0a6d1570dbfb1d5d8d295e977`,
  Git blob `0efec83722a0cac8216d11ab42e5cd649fc3fbc8`. Every preceding report byte
  is preserved.

The preservation chain was independently reconstructed from rejected R8
checkpoint `3efe90d2755e49a169b699d8884681c074a0dc42`:

- `3efe90d2…` to `d618e65c…` changes only this historical R9 report.
- `d618e65c…` to global-R7 maker `b2ef24dc…` changes exactly the 614 named
  case input/result cells, bounded repair-plan status, and the new maker
  receipt. Case IDs, boundaries, authority cells, Exercises cells, and all 114
  other case rows are preserved.
- `b2ef24dc…` to current R8 `9b263272…` changes Canon and plan status/checksum
  prose plus the new R8 receipt. No governed case row changes.
- The frozen validator remains exactly 499,315 bytes, SHA-256
  `e65103466154162f2f86b0526ce67e4be9fa394b54bc2fd71a7c1cd01d46c461`,
  and Git blob `21f98550d2392c18fb3e6f5ec7d42220d050cc68`, unchanged since the accepted
  validator-route alignment.
- The accepted corrected-R6 governed source/evidence range remains exactly
  289,241 bytes with SHA-256
  `ca4288115e4753842668183250d4a7353dddcdbcd729836e4776dbbdcf41e23e`.
  The historical crosswalk range remains exactly 122,555 bytes with SHA-256
  `3fd7df67896f7cb27e48cd63f90eb2fefdbd8a0fc55bb145dd019325f7734a13`.

### Complete mechanical, source, and prior-finding review

Independent parsing of the actual candidate reproduced these populations:

| Governed population | Result |
|---|---:|
| GROUPs | 61 (`A 12 / C 25 / R 10 / L 10 / S 4`) |
| Active LEAF main/detail rows | 815 / 815 |
| EV2 components | 823 |
| XW2 edges / historical rule fragments | 494 / 491 |
| LEAF / EV2 dependency edges | 744 / 512 |
| Scenarios / named cases | 82 / 728 |
| Repaired / byte-preserved cases | 614 / 114 |
| Exercise edges / matching backlinks | 955 / 955 |
| Primary / secondary-only covered SCEN LEAFs | 581 / 80 (`661` total) |
| Historical scenario fragments / SXW2 edges | 89 / 89 |
| Generic DR2 / structured AMEND details | 272 / 822 |
| BND / SM2 / SS2 / terminal DISP records | 10 / 17 / 4 / 29 |

All identities are unique, every mechanical reference resolves, both
dependency graphs are acyclic, and no open blocker, unresolved record,
surviving deferral, or `no-successor` edge exists. G1–G9 and G11–G15
reconcile. G10's scenario-integrity obligation and whole-Canon scenario
sufficiency do not pass because of the material ledger below; a mechanically
complete graph cannot make a false or underdetermined oracle true.

The complete 823-component authority population remains `CBA 647 / BYL 17 /
NBA 4 / DERIVED 6 / INFERRED 137 / EXT 12`. The hash-matched signed CBA
(2,850,534 bytes, 676 pages, SHA-256 `bf178ca0…ab32`) and June 2024 By-Laws
(422,247 bytes, 88 pages, SHA-256 `be4d2781…2ccf`) were independently read
with the relevant primary passages. All immutable locators and propositions
carried forward by byte preservation remain valid. The 614 repaired cases
exercise 614 distinct LEAFs and directly cite 622 EV2 IDs; their transitive
closure contains 655 components (`CBA 559 / BYL 13 / NBA 3 / DERIVED 6 /
INFERRED 74`) rooted only in the five registered official artifacts and no
EXT source.

Every prior R9 finding received a fresh disposition:

| Prior finding | Post-global-R7 disposition |
|---|---|
| Missing or false direct CBA/By-Laws printed-page support | **Closed and preserved.** The complete current primary-source cohort and corrected `EV2-0591`–`EV2-0593` locators remain accurate. |
| Incomplete Partial Waiver ownership, Room, validity, selection, and lifecycle | **Closed and preserved.** The accepted `CBA2-R01.14`–`.51` chain and all nine probes remain intact. |
| Later corrected R/L source and lifecycle chains | **Closed and preserved.** Corrected-R6 bytes, owners, locators, and scenario roles remain intact. |
| Predicate-template scenario population | **Literal form closed; semantic acceptance fails.** All 614 rows were rewritten, but 65 repaired rows remain materially false, contradictory, underdetermined, or mis-mapped as enumerated below. |

### Complete 614-case and 114-case review

The repaired population was mechanically enumerated and partitioned without
gap or overlap:

| Partition | All cases | Repaired | Preserved |
|---|---:|---:|---:|
| `CBA2-SC-001`–`CBA2-SC-040` | 356 | 306 | 50 |
| `CBA2-SC-041`–`CBA2-SC-082` | 372 | 308 | 64 |
| **Total** | **728** | **614** | **114** |

The ordered repaired-ID SHA-256 is
`75b9f324145aeeefb62d11432c776968400ccc5b54f5bfd4dc69c7a9f2bb1084`;
partition digests are `d500ed66…8be7` and `36fdf787…5938`. The ordered
preserved-ID SHA-256 is
`5315344eeedd3163734bd34567b827a08178784aba868af09d2e1bbb0dd1a485`;
partition digests are `05bc0e2b…afaa` and `a7b6e8ae…e9ac`. Every repaired
row was compared with its governing LEAF input contract, direct-result role,
evidence, arithmetic/timing/state transition, paired adverse boundary,
Exercises edge, backlink, and SCEN coverage. Every preserved row was
byte-compared with `3efe90d2…` and then deterministically confirmed across
families. All 114 are byte-identical; 113 remain semantically valid, while
`CBA2-SC-001(h03)` exposes the preserved defect below.

Normalized duplicate analysis found no normalized full-row duplicate across
unrelated repaired families. The only normalized input cluster,
`CBA2-SC-040(k)`, `CBA2-SC-040(l)`, and `CBA2-SC-041(a)`, validly exercises
the 25%/30%/35% maximum tiers. All high-similarity cross-family pairs were
manually inspected; the analogous tax, annual-change, and Team Salary pairs
have distinct registered roles. No additional copy/paste population was
found.

The following is the complete material ledger. Unless expressly split below,
the owning stage is **global R7 scenario construction** at maker
`b2ef24dc…`. These defects are localized to the named rows, but their presence
inside the repaired population defeats global R7 completeness and therefore
whole-Canon acceptance.

#### Repaired cases `CBA2-SC-001`–`CBA2-SC-040`

- **Stale or impossible direct-result snapshots:** `CBA2-SC-005(l)`,
  `CBA2-SC-007(e)`, and `CBA2-SC-008(b)` retain `CBA2-A04.1:PASS@v1`
  while the adverse bonus exceeds the 15% ceiling; `CBA2-SC-009(i)` retains
  `CBA2-A02.6:PASS@v1` after moving the transition TPE to 2024-25;
  `CBA2-SC-010(b)` retains its TMLE-use result after deleting all TMLE-use
  history; `CBA2-SC-017(d)` marks the exercise-only `CBA2-A10.14` PASS while
  the Option is not exercised; `CBA2-SC-019(g)` retains the unfreeze owner
  after changing the above-apron count to two and removing the unfreeze
  event; `CBA2-SC-019(i)` marks the disclosure owner PASS while omitting the
  challenged term; and `CBA2-SC-020(a)` marks the removal-event owner PASS in
  the unsigned, unrenounced positive record. Consuming those snapshots can
  produce the opposite result from the concrete record.
- **Non-atomic or contradictory paired records:** `CBA2-SC-016(a)` changes
  both Option action and extended term, then makes an unexercised-Option owner
  decide the exercised-Option case; `CBA2-SC-018(a)` duplicates a player but
  still admits the same disjoint decomposition; `CBA2-SC-019(d)` pairs a
  2026-27 cap year with the prior season's final game; `CBA2-SC-024(b)` retains
  a `$3m` current minimum salary while adding a conflicting `$2.2m` current
  salary; `CBA2-SC-024(d)` retains two-Season prose after changing the term to
  one Season and incorrectly turns the independence rule into FAIL merely
  because the two results coincide; `CBA2-SC-033(c)` says no prescribed Option
  while retaining an Option salary entry and an unresolved `minimum`
  placeholder; and `CBA2-SC-039(e)` adds a scalar year-two value that conflicts
  with the retained schedule.
- **Missing governing owner or required facts:** `CBA2-SC-005(g)` performs
  `CBA2-A04.33` bonus reallocation while exercising only `A04.7`;
  `CBA2-SC-005(j)` invokes `A04.12` extended-term allocation while exercising
  only `A04.11`; `CBA2-SC-006(k)` and `CBA2-SC-006(l)` omit the trade date and
  substitute legal-conclusion prose for required extension/exhibit facts;
  `CBA2-SC-015(i)` hides required `A10.17` in the body although the detail,
  authority, and Exercises chain names only `A10.4`; `CBA2-SC-024(a)` uses
  the placeholder `ArticleIV6h predicates documented` and omits signing date
  and day count; and `CBA2-SC-028(a)` / `CBA2-SC-028(c)` never assign the
  contracted `$24,256,000` tax excess and perform `C09.7` tax arithmetic while
  exercising only the rate-table owners. Their exact results cannot be
  reproduced from their registered inputs and Exercises edges.
- **False arithmetic or source-law result:** `CBA2-SC-007(c)` miscalculates
  15.00005% of `$20m` as `$3,000,000.01` instead of `$3,000,010`;
  `CBA2-SC-016(j)` calls dates exactly one year or less before July 1 “more
  than one year” early; `CBA2-SC-020(d)` invents a three-YOS gate absent from
  CBA Article VII section 4(d)(4); `CBA2-SC-032(a)` rejects `$6m` even though
  the stated TMLE alone permits it; and `CBA2-SC-032(d)` uses an impossible
  `$10m` 2026-27 BAE although the same Canon's authenticated final value is
  `$5.477m`.
- **Underdetermined component tests:** `CBA2-SC-034(b)`,
  `CBA2-SC-034(e)`, `CBA2-SC-034(i)`, and `CBA2-SC-035(c)` provide only
  aggregate Salary-plus-Unlikely totals. Article VII section 5(a)(1) tests
  Salary excluding incentives, Regular Salary, and each bonus separately;
  equal totals can mask a component violation.

#### Repaired cases `CBA2-SC-041`–`CBA2-SC-082`

- **Internally impossible or stale fields:** `CBA2-SC-041(c)` has 65
  qualifying-minutes games in a 64-game season; `CBA2-SC-041(l)` changes both
  remaining Seasons and an unspecified Regular-Season date while retaining
  the concrete October 1 date/offseason state; `CBA2-SC-056(a)` adds scalar
  protection values that conflict with the retained arrays; `CBA2-SC-058(a)`
  changes an incentive component but retains the old total;
  `CBA2-SC-058(c)` changes the first-extended bonus but retains its old 20%
  percentage; `CBA2-SC-070(a)` changes the direct combined count to 14 while
  retaining 14 Standard plus one Two-Way player; `CBA2-SC-070(b)` says the
  Season total became 21 while retaining 20; `CBA2-SC-070(d)` and
  `CBA2-SC-070(h)` make P8 unavailable while retaining P8 in the available
  list; `CBA2-SC-077(e)` misses both starter thresholds but retains
  `starterCriteria=true`; `CBA2-SC-077(i)` makes withdrawal ineffective but
  retains UFA/non-renunciation consequences; `CBA2-SC-081(b)` leaves the
  adjacent-pair boolean true after removing both 2028 and 2029 rights; and
  `CBA2-SC-082(c)` declares the retained intermediate missing under a second
  field name while retaining its explicit value.
- **Aggregate inputs are incomplete or contradictory:** `CBA2-SC-042(k)`
  never supplies `proposedMaximum` in P+, introduces it only in P− although it
  is absent from `C16.35`'s registered input contract, and simultaneously
  marks every tier owner PASS while selecting only `C16.12`;
  `CBA2-SC-046(a)` is an ordinary-signing record that marks the trade-earned
  `C18.4` branch PASS and simultaneously marks `C18.3` both PASS in the fixed
  dependency list and not applicable in the record. Neither is a single,
  internally possible aggregate truth vector.
- **Wrong source basis, missing calculation inputs, or false exactness:**
  `CBA2-SC-044(e)` weights Over-38 allocation by protected salaries rather
  than prior-year Salaries; `CBA2-SC-045(a)`, `CBA2-SC-045(b)`,
  `CBA2-SC-045(g)`, `CBA2-SC-045(h)`, and `CBA2-SC-046(b)` use protected
  dollars without the Base Compensation/protected-percentage inputs required
  by Article VII section 3(b); `CBA2-SC-047(c)` labels a truncated repeating
  rational exact without a rounding rule; `CBA2-SC-063(b)` infers equal
  `$4m` allocation from only a `$12m` aggregate although the CBA requires each
  year's remaining unearned protected Compensation; `CBA2-SC-071(c)` prorates
  by games rather than Regular-Season days; `CBA2-SC-073(a)` changes the
  governing G League threshold without authenticated rule content or a new
  version; and `CBA2-SC-080(a)` reverses the draft-penalty order by putting the
  higher-winning-percentage penalized team earlier rather than later.
- **The adverse pair is not a single meaningful boundary:**
  `CBA2-SC-053(j)` changes both exception amount and previously unstated Room;
  `CBA2-SC-075(c)` changes only an asserted dependency result while the
  concrete Team Salary, Cap, and increase still leave `$4.961m` Room.
- **Wrong result state:** `CBA2-SC-078(a)` labels TEAM-B FAIL after the changed
  official draft record validly creates TEAM-B's right; `CBA2-SC-081(a)`
  labels missing required inputs FAIL instead of `UNAVAILABLE/NEEDS-INPUT`;
  and `CBA2-SC-082(a)` / `CBA2-SC-082(b)` label missing authenticated derived
  amounts FAIL rather than `NEEDS-INPUT` with no amount.

#### Byte-preserved and mixed-owner defects

- `CBA2-SC-001(h03)` is byte-preserved from `3efe90d2…`, but maps a valid
  one-outgoing/multiple-incoming Standard TPE to `CBA2-A05.10` Row H. The
  active rule itself says Row H is the Aggregated Standard TPE and does not bar
  multiple incoming players on one Standard TPE. Owning stage: **original R7
  scenario mapping/detail construction** at `e59d0dcc…`.
- `CBA2-SC-015(i)` has split ownership. Its repaired body is a global-R7
  scenario defect, while the preserved detail/authority row omits the leaf's
  actual `A10.17` dependency and names only `A10.4`. Owning stage for that
  preserved register/detail defect: **original R7 detail construction** at
  `e59d0dcc…`; the underlying `A10.9` LEAF correctly records `A10.17` and does
  not require repair.

Demonstrated downstream impact is direct: these records can accept an
ineligible state, reject an eligible state, compute the wrong amount/date/order,
return FAIL where the contract requires `NEEDS-INPUT`, or allow an aggregate
to pass from mutually inconsistent direct results. They therefore cannot be
used as Phase 2 comparison or implementation oracles. The source/rule Canon is
not globally invalidated; the acceptance failure is global because the R7
scenario library is a required whole-Canon gate and its repaired population is
not complete or truthful.

### SI-C1 and frozen-validator disposition

The first R8 validator result of 237/238 was independently reproduced as a
mutation-targeting defect, not a protected-route defect. At `b2ef24dc…`, the
full route hash occurred first in historical prose and later in the sole
machine-shaped declaration; `SI-C1`'s first-occurrence mutation changed the
historical prose and left the active declaration valid. Current R8 preserves
the historical value and meaning as the exact concatenation of two
32-character halves, while the active declaration remains the sole full hash
token. The frozen validator is byte-identical, its mutation now reaches the
active declaration, all nine route fields and their normalized checksum are
unchanged, and no rejecting control or protected Canon behavior was weakened.
The final `SI-C1` PASS is legitimate representation isolation, not validation
gaming.

After all static and semantic lanes were complete, the unchanged validator was
executed exactly once in one fresh sequential process under the 15-minute hard
ceiling. The ceiling did not fire. It reported:

- 20 accepting controls and 218 rejecting regressions;
- 238/238 PASS, `baseline_clean=yes`, and zero failures;
- successful knowingly wrong-expectation negative self-test;
- successful inventory cache-isolation self-check; and
- frozen route checksum
  `b0c97d74d1426a323101155d61ebb86d2c42d6f66023ba383173e797db0a8cc1`.

Actual `/usr/bin/time` runtime was 146.87 seconds real, 78.30 seconds user,
and 48.30 seconds system. The validator's mechanical PASS does not inspect the
case-level source arithmetic, internal possibility, or oracle sufficiency
listed above and therefore does not override this REJECT.

### Blocked scope and next eligible work

Only the owning repairs become eligible: global R7 scenario correction for
the 65 repaired cases, plus original-R7 correction of the `SC-001(h03)` mapping
and `SC-015(i)` detail/authority dependency. After those are repaired, a new
R8 reconciliation/checksum and renewed independent R9 are required. Explicit
owner acceptance, Phase 2, W1.1, Architect comparison, application changes,
Linear, Graphify, merge, and `main` remain blocked and unperformed.

This checker changed only this appended report. It did not change the Canon,
repair plan, R8 or maker/checker receipts, validator, application code, tests,
data, schemas, configuration, README, Linear, Graphify, or `main`. Temporary
review scripts and source artifacts remained outside the repository.

## Post-targeted-R7 renewed R9 independent acceptance — `6cf8aaf3`

### Verdict, checkpoint, and independence

**ACCEPT** exact pushed topic-branch checkpoint
`6cf8aaf358c158a88e630e8a7336f7e9c3febc17` with Canon SHA-256
`23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76`.
This acceptance is commit-specific. It does not retroactively accept either
rejected R9 candidate or erase any historical rejection finding.

The reviewer did not author or repair any governed v2 rule, evidence record,
mapping, scenario, case, detail row, route field, validator control, or maker
receipt in this candidate. Maker and R8 receipts were treated as claims to
recompute, not as acceptance evidence. Independent extraction, comparison,
and source-review helpers remained outside the repository.

At review start, local, tracking, and freshly fetched live-remote
`architect/cba-canon-v2` all resolved to the exact checkpoint. Its ancestry was
`eb43b3b730d9a7fd1857363070838a49487eadbf` →
`c4f3e20fec97aed27c6eb7948fbc3e7830ce0796` → `6cf8aaf3`. Local and fetched
live-remote `main` both remained
`69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`. The worktree was clean, and the
Canon, plan, R8 receipt, and frozen validator matched their pinned hashes.

### Independent semantic method and complete 66-case disposition

The corrected population was extracted by comparing the actual Canon at
`6cf8aaf3` to governed rejected checkpoint `9b263272`. For every changed case,
the reviewer read the current exact inputs, tested boundary, exact output,
authority/evidence chain, Exercises, active LEAF text, registered detail input
contract, and direct dependencies. Calculations, dates, state transitions,
result polarity, and `NEEDS-INPUT` behavior were recomputed from the current
record rather than inferred from maker prose. The official signed CBA and
June 2024 By-Laws were independently reacquired and matched the registered
SHA-256 values `bf178ca0…ab32` and `be4d2781…2ccf`.

All 66 exact identities pass. The complete disposition is:

| Identity | Independent disposition |
|---|---|
| `CBA2-SC-001(h03)` | PASS — Standard-TPE structure and limit now exercise only A02.1/A02.2; the false Aggregated-TPE Row-H owner and backlink are absent. |
| `CBA2-SC-005(g)` | PASS — no agreement uses the assignor default, while the express agreement activates the distinct A04.33 reallocation branch. |
| `CBA2-SC-005(j)` | PASS — exact original/extended dates separate A04.11 calculation from A04.12 extended-term inapplicability. |
| `CBA2-SC-005(l)` | PASS — the adverse 15.0001% form and `$3,000,020` amount make the 15% owner fail consistently. |
| `CBA2-SC-006(k)` | PASS — term, timing, replacement exhibit, compensation, and protection inputs make the A04.24 allocation branch complete. |
| `CBA2-SC-006(l)` | PASS — the A04.25 branch is expressed through concrete contract, exhibit, timing, term, and compensation facts rather than a legal conclusion. |
| `CBA2-SC-007(c)` | PASS — 15.00005% of `$20,000,000` is exactly `$3,000,010`, ten dollars above the ceiling. |
| `CBA2-SC-007(e)` | PASS — the prohibited `$0.01` increase now produces a consistent A04.1 failure. |
| `CBA2-SC-008(b)` | PASS — the dollar form exceeding its percentage cap by `$0.01` consistently fails A04.1. |
| `CBA2-SC-009(i)` | PASS — the Transition TPE passes only for 2023-24 and fails for the otherwise identical 2024-25 record. |
| `CBA2-SC-010(b)` | PASS — the adverse empty TMLE-use history no longer retains a stale Row-K/TMLE-use result. |
| `CBA2-SC-015(i)` | PASS — A10.17 is present in the body, authority, Exercises, A10.9 dependency detail, and A10.17 backlink; the 120% calculation is exact. |
| `CBA2-SC-016(a)` | PASS — only Option exercise state changes, and A10.14 no longer purports to decide the separate A10.29 branch. |
| `CBA2-SC-016(j)` | PASS — the proposed dates and first extended Season now create the stated more-than-one-year-early boundary. |
| `CBA2-SC-017(d)` | PASS — the non-exercise result is truthful while A10.29 independently distinguishes two non-Option Seasons from one. |
| `CBA2-SC-018(a)` | PASS — the underlying incoming Salary changes by `$0.01`, eliminating the formerly valid alternative decomposition. |
| `CBA2-SC-019(d)` | PASS — the last Regular Season game is in the stated Salary Cap Year and the 2034 result follows from the concrete timeline. |
| `CBA2-SC-019(g)` | PASS — the A12.5 state and unfreeze event agree across the one-above and two-above histories. |
| `CBA2-SC-019(i)` | PASS — omission of the challenged term fails A12.6; disclosure of that same term passes it. |
| `CBA2-SC-020(a)` | PASS — the removal owner is false before, and true after, the exact signing event. |
| `CBA2-SC-020(d)` | PASS — the invented YOS gate is gone and the exact minimum-of-two-minima amount is tested directly. |
| `CBA2-SC-024(a)` | PASS — signing date, 174-day season, covered days, YOS, term, and minimum amount are all concrete. |
| `CBA2-SC-024(b)` | PASS — each side retains one internally consistent YOS/minimum-salary record with no conflicting scalar. |
| `CBA2-SC-024(d)` | PASS — the two-Season facts remain fixed while separate versus improperly merged exception/reimbursement outputs are tested. |
| `CBA2-SC-028(a)` | PASS — Tax Team Salary, Tax Level, exact excess, all operands, C09.7, and the progressive sum reconcile. |
| `CBA2-SC-028(c)` | PASS — the repeater-tax vector likewise contains the complete C09.7 chain and exact progressive sum. |
| `CBA2-SC-032(a)` | PASS — only the submitted combined allocation is rejected; the valid single-TMLE alternative is preserved. |
| `CBA2-SC-032(d)` | PASS — the authenticated `$5.477m` BAE replaces the impossible `$10m` value while DPE non-proration remains distinct. |
| `CBA2-SC-033(c)` | PASS — exact guaranteed and Option Salaries replace placeholders, and no Option Salary survives when the Option is absent. |
| `CBA2-SC-034(b)` | PASS — Salary excluding incentives, Regular Salary, and the individual Unlikely Bonus are separate; only the bonus crosses 5%. |
| `CBA2-SC-034(e)` | PASS — the Room-MLE annual-change test uses the same complete, non-masking component vector. |
| `CBA2-SC-034(i)` | PASS — the BAE annual-change test uses the same complete, non-masking component vector. |
| `CBA2-SC-035(c)` | PASS — the NTMLE annual-change test uses the same complete, non-masking component vector. |
| `CBA2-SC-039(e)` | PASS — one retained schedule owns the changed year-two value; the conflicting scalar is gone. |
| `CBA2-SC-041(c)` | PASS — both sides retain a 65-game season and change only qualifying games from 65 to 64. |
| `CBA2-SC-041(l)` | PASS — one exact authenticated date remains fixed while remaining Seasons change from one to two. |
| `CBA2-SC-042(k)` | PASS — both records supply the proposed amount, C16.35 registers it, and only applicable tier/amount owners are selected. |
| `CBA2-SC-044(e)` | PASS — Over-38 allocation uses prior-year Salary weights and produces the exact signed 1:2 split. |
| `CBA2-SC-045(a)` | PASS — Base Compensation, protected dollars, and protected percentages are complete, and the signed percentages drive allocation. |
| `CBA2-SC-045(b)` | PASS — the complete protection basis and allocation array exclude the ETO Season as required. |
| `CBA2-SC-045(g)` | PASS — cap state, deadline, Base Compensation, protected dollars, and protected percentages fully specify the extended-only branch. |
| `CBA2-SC-045(h)` | PASS — the early below-cap branch carries the full original-plus-extended compensation and protection schedule. |
| `CBA2-SC-046(a)` | PASS — the ordinary-signing vector applies C18.1/C18.2 and truthfully marks zero-protection and trade-earned branches inapplicable. |
| `CBA2-SC-046(b)` | PASS — extended compensation and 50%/100% protection percentages produce the stated 1:2 allocation. |
| `CBA2-SC-047(c)` | PASS — the authenticated comparison minimum makes ten-day proration exactly `$120,000`, with no false truncated-rational exactness. |
| `CBA2-SC-053(j)` | PASS — P+ supplies zero Room and P− changes only the available Minimum Exception by `$0.01`. |
| `CBA2-SC-056(a)` | PASS — both protection percentages derive from one Base/protected array pair; duplicate conflicting scalars are absent. |
| `CBA2-SC-058(a)` | PASS — totals derive from components as `$4,000,000.00` and `$4,000,000.01`; no stale total survives. |
| `CBA2-SC-058(c)` | PASS — 20% and 20.00000004% derive from exact amounts; no stale percentage survives. |
| `CBA2-SC-063(b)` | PASS — per-year remaining unearned protected Compensation produces the exact 6:4:2 allocation. |
| `CBA2-SC-070(a)` | PASS — combined count and bounds derive from consistent Standard and Two-Way counts. |
| `CBA2-SC-070(b)` | PASS — the signed 14-consecutive/28-total limits distinguish 28 from 29 total days. |
| `CBA2-SC-070(d)` | PASS — one player availability map derives eight available players versus seven without overlap. |
| `CBA2-SC-070(h)` | PASS — the direct eight-player rule uses the same single, internally consistent availability map. |
| `CBA2-SC-071(c)` | PASS — proration uses 174 total and 88 remaining Regular-Season days; 25.287… rounds to 25. |
| `CBA2-SC-073(a)` | PASS — P+ consumes an authenticated controlling G League record; missing rule/version/threshold returns `NEEDS-INPUT` and borrows no Standard threshold. |
| `CBA2-SC-075(c)` | PASS — Room is exactly `$10m` and only the proposed increase changes to `$10,000,000.01`. |
| `CBA2-SC-077(e)` | PASS — starter status derives from 41/2,000 versus 40/1,999 rather than a stale asserted boolean. |
| `CBA2-SC-077(i)` | PASS — July 13 withdrawal is effective; July 14 without written consent is ineffective, with consequences derived rather than asserted. |
| `CBA2-SC-078(a)` | PASS — the changed official record creates TEAM-B's right; TEAM-B passes and TEAM-A is separately reported without the right. |
| `CBA2-SC-080(a)` | PASS — inverse winning-percentage order is `.400`, `.500`, `.600`, leaving the best-winning Team for the final selection. |
| `CBA2-SC-081(a)` | PASS — unresolved protection returns `UNAVAILABLE/NEEDS-INPUT` with no invented availability verdict. |
| `CBA2-SC-081(b)` | PASS — every adjacent future-Draft pair derives from one retained-rights schedule; the stale boolean is absent. |
| `CBA2-SC-082(a)` | PASS — a mismatched current-cap source year returns `NEEDS-INPUT` and no Tax Bracket amount. |
| `CBA2-SC-082(b)` | PASS — a mismatched Salary Cap source year returns `NEEDS-INPUT` and no cash-limit amount. |
| `CBA2-SC-082(c)` | PASS — P− removes the actual retained intermediate field, so the audit failure is internally possible. |

This is exactly 66 identities across 39 scenario families. Their ordered
identity digest is
`a48405a6139de50f25ad983ac41ee420493213d059899f20c6f339587148e481`.
No material semantic defect remains, so no repair-stage assignment is needed.

### Seven changed detail rows and special chains

The only non-case governed differences from `9b263272` are the following seven
LEAF detail rows, and each change is both necessary and bounded:

| Detail row | Independent disposition |
|---|---|
| `CBA2-A04.12` | PASS — adds the missing `SC-005(j)` Scenario-evidence backlink only. |
| `CBA2-A04.33` | PASS — adds the missing `SC-005(g)` backlink for agreed obligation reallocation. |
| `CBA2-A05.10` | PASS — removes only the false `SC-001(h03)` Row-H backlink. |
| `CBA2-A10.9` | PASS — replaces the irrelevant A10.4 dependency with A10.17 and registers the incentive/Likely-Bonus inputs actually consumed by `SC-015(i)`. |
| `CBA2-A10.17` | PASS — adds the missing `SC-015(i)` backlink. |
| `CBA2-C09.7` | PASS — adds the `SC-028(a)` and `SC-028(c)` progressive-tax backlinks. |
| `CBA2-C16.35` | PASS — adds the proposed maximum and applicable-tier/direct-result inputs consumed by `SC-042(k)`. |

The protected `SC-001(h03)` correction is therefore closed end-to-end: the
case, Exercises, authority, and A05.10 detail no longer misclassify a valid
one-outgoing/multiple-incoming Standard TPE as Aggregated Row H. The mixed
`SC-015(i)` correction is also closed end-to-end: its concrete 120% result,
A10.17 evidence route, Exercises, A10.9 dependency/input contract, and A10.17
backlink all agree.

### Preservation, complete populations, and G1–G15

The comparison proves exactly 66 changed case rows plus the seven detail rows
above. All other governed content is preserved:

- the other 662 named cases are byte-identical to `9b263272`, ordered digest
  `2fb552235818a90d0e0ea51a26ed99239fefd571d6bbd612fdcf7ba1d7d82fe0`;
- the 3,764 protected governed rows are byte-identical, ordered digest
  `d28d08b0156bbd2c74dda43467e1c82767dace884c6a888c1b6b697d0cbf87b6`;
- `c4f3e20f` and `6cf8aaf3` contain the same 3,837 governed rows; R8 changed
  status and derived-count prose only;
- the final active-scenario boundary is 734,090 bytes with SHA-256
  `56058b28df76416b9dac1c1bacbbf80e0b3b5e0d2d0c32e393f400ffb0b596bc`;
  and
- the historical scenario boundary is 21,909 bytes with SHA-256
  `08c5ed69be1075ad7a9909337b09be30b7d43dcf4114188bee142d64c468d787`.

The complete current population independently reconciles at 61 GROUPs
(A 12, C 25, R 10, L 10, S 4); 815 LEAF main/detail pairs (A 151, C 417,
R 118, L 102, S 27); 823 EV2 records (CBA 647, BYL 17, NBA 4, DERIVED 6,
INFERRED 137, EXT 12); 838 direct EV2-to-SRC2 references; 512 acyclic EV2
dependency edges; and 744 acyclic LEAF dependency edges. The mapping surface
contains 494 XW2 edges over 491 historical fragments, 89 SXW2 edges over 89
historical scenario fragments, ten bundles, 17 searches, and four search sets.
The decision surface contains 272 generic decisions and 822 structured AMEND
details. All 82 scenarios and 728 unique cases create 959 unique Exercises and
959 identical backlinks, covering exactly 581 primary plus 80 secondary-only
SCEN LEAFs, or 661 total.

| Gate | Independent result |
|---|---|
| G1 | PASS — all 368 published LEAFs, 491 fragments, 494 XW2 edges, ten bundles, and receipt/current endpoints reconcile without orphan or deferral. |
| G2 | PASS — every nonterminal mapping target resolves to one active LEAF; no current deferred target remains. |
| G3 | PASS — 22 terminal XW2 plus seven terminal SXW2 edges join uniquely to 29 DISP details; the four unsupported residuals retain truthful, searched, bounded scope. |
| G4 | PASS — the active population is exactly 61 GROUPs and 815 LEAFs, excluding support and historical rows. |
| G5 | PASS — Phase 1 scope remains bounded; this review does not begin Phase 2. |
| G6 | PASS — the gate remains Canon/document-tree only; no application or runtime inspection is introduced. |
| G7 | PASS — no product comparison, implementation, or data/configuration verdict is claimed. |
| G8 | PASS — all LEAF and EV2 dependency targets resolve, both graphs are acyclic, and the 26 cross-family edges preserve accepted construction order. |
| G9 | PASS — ATOM/OWN/DISP/METHOD/ORIGIN/AMEND/TG populations and duplicate-candidate generators reconcile with no unresolved candidate. |
| G10 | PASS — 82 scenarios, 728 cases, 959 bidirectional links, 661 covered SCEN LEAFs, 89 fragments, and 89 SXW2 dispositions satisfy the full scenario contract. |
| G11 | PASS — every one of the 66 corrected case oracles and seven changed details is truthful, sufficient, and source/owner consistent. |
| G12 | PASS — Canon and plan truthfully describe R7/R8 completion, preserve both historical rejections, and leave renewed R9 unaccepted until this report-only checkpoint. |
| G13 | PASS — actual populations, both protected boundaries, final Canon size of 2,114,569 bytes, and final Canon checksum are exact. |
| G14 | PASS — typed roots, authority classes, locators, evidence dependencies, source/search coverage, owners, and backlinks close with no diagnostic. |
| G15 | PASS — every live identity/version has one current endpoint or explicit retirement; no stale reference, broken chain, ID reuse, or renumbering remains. |

There are zero open BLK findings, RES records, unresolved successors,
`no-successor` edges, uncovered terminal dispositions, dependency cycles, or
current deferrals.

### Validator anchors, maker attempts, and checker execution

The frozen validator remains 499,315 bytes with SHA-256
`e65103466154162f2f86b0526ce67e4be9fa394b54bc2fd71a7c1cd01d46c461`.
Its current-route checksum independently recomputes to
`b0c97d74d1426a323101155d61ebb86d2c42d6f66023ba383173e797db0a8cc1`.
Static inspection confirms that the two restored plan phrases are the exact
literal inputs to the route-mode downgrade mutation, not decorative receipt
text. The wrong-hash route mutation reaches the sole machine-shaped active
declaration, the knowingly wrong-expectation self-test remains inverted, and
the warm-cache isolation check mutates one parse result before proving later
results are fresh.

The four R8 maker attempts are preserved accurately: 86.61 seconds stopped at
the missing `R7 execution status — complete in this checkpoint` anchor;
83.35 seconds stopped at the adjacent `The canon now contains the complete
active scenario` anchor; 147.52 seconds passed all 238 controls but required
the receipt update; and the final 186.93-second exact-byte run passed 238/238
with no repository edit afterward. The first two were meaningful pre-control
failures that exposed literal-anchor drift; the later two demonstrate that the
truthful restorations did not weaken the route contract.

After the complete static and semantic review, this checker executed the
unchanged frozen validator exactly once, fresh and sequentially, under the
15-minute hard ceiling. It reported 20 accepting controls plus 218 rejecting
regressions, 238/238 PASS, `baseline_clean=yes`, zero failures, the complete
population notes above, successful inventory cache isolation, and a successful
knowingly wrong-expectation negative self-test. Actual `/usr/bin/time` was
152.15 seconds real, 78.93 seconds user, and 50.93 seconds system. The ceiling
did not fire.

### Scope validation and next eligible gate

The report-only candidate passes targeted Markdown lint with inherited `MD029`
disabled, `npm run test:diff` for this exact report with the dot reporter,
`npm run docs:guardrails`, `npm run validate:project`, and `git diff --check`.
Exact diff and staged-scope checks show this appended report as the sole
repository change.

No material blocker or limitation remains within renewed R9 scope. This ACCEPT
makes only explicit owner acceptance eligible next. R9 ACCEPT alone does not
close Phase 1 and does not authorize Phase 2. Until the owner explicitly
accepts this checkpoint and separately scopes later work, Phase 2, W1.1,
Architect comparison, application changes, Linear, Graphify, merge, and
`main` remain blocked and untouched.

This checker changed only this appended report. It did not modify the Canon,
repair plan, R8 or any prior maker/checker receipt, validator, application,
tests, data, schemas, configuration, README, Linear, Graphify, or `main`.
