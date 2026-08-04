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
