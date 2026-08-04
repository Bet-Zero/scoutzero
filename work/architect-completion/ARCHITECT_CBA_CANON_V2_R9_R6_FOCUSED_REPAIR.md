# Architect CBA Canon v2 — R9/R6 first focused repair

## Status

This is the bounded maker repair ordered by the R9 independent rejection at
`5acedb1b024973adab43ab9957f7bed23a42390f`. It repairs only the first focused R6 source/evidence and
partial-waiver findings. The Canon remains an unaccepted working draft. This
checkpoint is maker-only and requires focused independent re-review of the
changed R6 material and its dependencies before R9 can continue.

R7 scenario construction is not repaired here. The exact downstream R7
dependency is recorded below; Phase 2, application work, W1.1, Linear,
Graphify, `main`, and owner acceptance remain blocked.

## Scope and baseline

- Topic branch: `architect/cba-canon-v2`.
- Clean pushed baseline and prior checkpoint:
  `5acedb1b024973adab43ab9957f7bed23a42390f`.
- Pinned parent:
  `16920362f75b97bb34a01a1b317f40244a5e91cc`.
- Pinned `main` and `origin/main`:
  `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`.
- Authorized writes: the Canon, the repair plan's truthful status/progress,
  and this receipt.
- Frozen validator route, R9 rejection record, prior receipts, R7 scenario
  library, application tree, tests, data, configuration, README, Linear,
  Graphify, and `main` were not edited.

## Primary-source verification

- Signed 2023 NBA-NBPA CBA: 2,850,534 bytes; SHA-256
  `bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32`.
- June 2024 NBA Constitution and By-Laws: 422,247 bytes; SHA-256
  `be4d2781fe8fddfc5bc9028214298f742789a949dade4ead26368a4336d32ccf`.
- CBA geometry was applied as registered in the Canon: printed page =
  PDF page − 24, with separately paginated exhibits. By-Laws printed page =
  PDF page − 7.
- Every repaired locator was checked against the pinned artifact itself.
  No unsupported item surfaced in the R9-listed 105-row locator population.

## Printed-page locator repair

The exact 105 R9-listed records receiving a missing printed-page locator are:

`EV2-0581`, `EV2-0584`, `EV2-0585`, `EV2-0586`, `EV2-0587`, `EV2-0588`, `EV2-0589`, `EV2-0590`, `EV2-0594`, `EV2-0595`, `EV2-0596`, `EV2-0598`, `EV2-0599`, `EV2-0600`, `EV2-0601`, `EV2-0602`, `EV2-0606`, `EV2-0607`, `EV2-0608`, `EV2-0609`, `EV2-0610`, `EV2-0612`, `EV2-0614`, `EV2-0615`, `EV2-0616`, `EV2-0618`, `EV2-0619`, `EV2-0620`, `EV2-0621`, `EV2-0622`, `EV2-0623`, `EV2-0624`, `EV2-0625`, `EV2-0639`, `EV2-0640`, `EV2-0644`, `EV2-0645`, `EV2-0646`, `EV2-0649`, `EV2-0650`, `EV2-0653`, `EV2-0659`, `EV2-0660`, `EV2-0661`, `EV2-0662`, `EV2-0665`, `EV2-0678`, `EV2-0679`, `EV2-0681`, `EV2-0684`, `EV2-0685`, `EV2-0687`, `EV2-0688`, `EV2-0689`, `EV2-0693`, `EV2-0695`, `EV2-0696`, `EV2-0697`, `EV2-0702`, `EV2-0703`, `EV2-0704`, `EV2-0705`, `EV2-0706`, `EV2-0707`, `EV2-0709`, `EV2-0715`, `EV2-0716`, `EV2-0717`, `EV2-0718`, `EV2-0722`, `EV2-0723`, `EV2-0724`, `EV2-0725`, `EV2-0726`, `EV2-0730`, `EV2-0731`, `EV2-0732`, `EV2-0733`, `EV2-0734`, `EV2-0735`, `EV2-0736`, `EV2-0739`, `EV2-0740`, `EV2-0744`, `EV2-0745`, `EV2-0746`, `EV2-0747`, `EV2-0748`, `EV2-0749`, `EV2-0750`, `EV2-0751`, `EV2-0752`, `EV2-0753`, `EV2-0759`, `EV2-0760`, `EV2-0764`, `EV2-0766`, `EV2-0767`, `EV2-0772`, `EV2-0773`, `EV2-0795`, `EV2-0797`, `EV2-0798`, `EV2-0809`, `EV2-0810`.

Separately, the false `pp. 416–20` locators on `EV2-0591`,
`EV2-0592`, and `EV2-0593` are corrected to the controlling Article XXII
§11(i) printed pages 392, 393, and 393–394 respectively. The complete
partial-waiver procedure is on printed pages 391–396; each atomic evidence
row uses its narrower controlling page span. Classifications remain truthful:
direct CBA/By-Laws propositions remain direct, the staged eligibility owner
is `INFERRED`, and the Fitness-to-Play Panel conclusion remains an
authenticated external determination rather than an auto-derived fact.

## Partial-waiver repair

The accepted identities `CBA2-R01.14`–`CBA2-R01.18` and
`EV2-0590`–`EV2-0594` are preserved. Their compound content is narrowed
to atomic owners, and the independently changeable successors are allocated
above the prior high-water marks as `CBA2-R01.19`–`CBA2-R01.45` and
`EV2-0818`–`EV2-0844`.

The repaired model now separately owns:

- Fitness-to-Play eligibility, the Evaluation Period and trade-deadline
  exception, the last-contract-year exclusion, and written designation.
- Remaining Protected/Unprotected Year definitions and option/ETO treatment.
- The Minimum Player Salary floor, strict full-Base-Compensation upper bound,
  unprotected-Base-Compensation floor, first-year Room plus Likely Bonuses,
  and permitted no-trade Room creation.
- Full-before-partial ordering, highest-partial selection, equal-total
  priority, accepted-amount allocation, unclaimed termination, and the
  ordinary waiver-period bridge.
- Waiving- and claiming-Team payment obligations, claiming-Team Salary,
  the July 1 trade bar, later trade/waiver deemed Salary, Claiming-Team
  succession, payroll taxes, and pay-period reimbursement.
- Subsequent Waiver unchanged-obligation, claiming-obligation reduction,
  waiving-obligation reduction, and triggered-protection branches.

## Decision records

| DR ID | Type | Subject(s) | Disposition | Test/tiebreak applied | Rationale | Resulting active LEAF(s) or — | Unit/commit |
|---|---|---|---|---|---|---|---|
| DR2-0265 | `AMEND` | R9-listed R6 GROUP, LEAF, detail, and EV2 records | Repair missing/false locators and split compound partial-waiver owners through forward lineage | Exact R9 finding, signed-artifact page verification, independently changeable result, stable identity, no reuse or renumbering | Preserves all accepted identities, supplies all 105 missing locators, corrects EV2-0591–EV2-0593, and allocates split successors above the accepted high-water marks | — | R6 / this checkpoint |
| DR2-0266 | `ATOM` | Article XXII §11(g)–(i) partial-waiver procedure | Give each independently changeable eligibility, amount, selection, payment, Team Salary, trade, and Subsequent Waiver result one owner | GIVEN all other inputs fixed, WHEN one source-law predicate or amount changes, THEN one direct result changes | The prior five rows combined multiple verdict-bearing requirements; the repaired graph uses direct atomic owners plus one explicit staged eligibility result | CBA2-R01.14, CBA2-R01.15, CBA2-R01.16, CBA2-R01.17, CBA2-R01.18, CBA2-R01.19, CBA2-R01.20, CBA2-R01.21, CBA2-R01.22, CBA2-R01.23, CBA2-R01.24, CBA2-R01.25, CBA2-R01.26, CBA2-R01.27, CBA2-R01.28, CBA2-R01.29, CBA2-R01.30, CBA2-R01.31, CBA2-R01.32, CBA2-R01.33, CBA2-R01.34, CBA2-R01.35, CBA2-R01.36, CBA2-R01.37, CBA2-R01.38, CBA2-R01.39, CBA2-R01.40, CBA2-R01.41, CBA2-R01.42, CBA2-R01.43, CBA2-R01.44, CBA2-R01.45 | R6 / this checkpoint |
| DR2-0267 | `ORIGIN` | Source-located partial-waiver obligations omitted from accepted R6 material | Register only true-gap direct rules and the distinct staged eligibility output | True-gap versus split-successor test after source-first Article XXII §11(g)–(i) review | Eligibility/procedure/definition owners were absent rather than fragments of the five accepted compound rows; amount and consequence successors remain under DR2-0265 split lineage | CBA2-R01.19, CBA2-R01.20, CBA2-R01.21, CBA2-R01.22, CBA2-R01.23, CBA2-R01.24, CBA2-R01.25, CBA2-R01.41, CBA2-R01.42, CBA2-R01.43, CBA2-R01.45 | R6 / this checkpoint |

## AMEND detail rows

| AMEND record ID | Population | Prior record ID | Prior version or — | Prior checkpoint commit | Action | Current record ID(s) or — | Current version(s) or — | Reason |
|---|---|---|---|---|---|---|---|---|
| DR2-0265 | GROUP | CBA2-R01 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | CBA2-R01 | — | Extend the exact active child declaration from R01.1–R01.18 to R01.1–R01.45 after the governed repair. |
| DR2-0265 | LEAF | CBA2-R01.14 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | CBA2-R01.14 | — | Narrow to full-before-partial ordering and competing Full Waiver Claim priority, and reconcile direct dependencies and inputs. |
| DR2-0265 | LEAF | CBA2-R01.15 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | CBA2-R01.15 | — | Retain the accepted identity for the Minimum Player Salary floor; DR2-0265 allocates the independently changeable strict upper bound, unprotected floor, Room/Likely-Bonuses test, and permitted Room creation as above-high-water successors. |
| DR2-0265 | LEAF | CBA2-R01.16 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | CBA2-R01.16 | — | Narrow to highest-total Partial Waiver Claim selection and equal-total priority, and reconcile direct dependencies and inputs. |
| DR2-0265 | LEAF | CBA2-R01.17 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | CBA2-R01.17 | — | Retain the accepted identity for accepted-amount allocation; DR2-0265 allocates payment, Team Salary, trade, later-transaction salary, Claiming-Team succession, tax, and reimbursement consequences as above-high-water successors. |
| DR2-0265 | LEAF | CBA2-R01.18 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | CBA2-R01.18 | — | Retain the accepted identity for unclaimed termination; DR2-0265 allocates the Subsequent Waiver branches and adjustments as above-high-water successors. |
| DR2-0265 | EV2 | EV2-0581 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0581 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0584 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0584 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0585 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0585 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0586 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0586 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0587 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0587 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0588 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0588 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0589 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0589 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0590 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0590 | — | Add the verified printed-page locator and reconcile the full-before-partial dependency chain. |
| DR2-0265 | EV2 | EV2-0591 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0591 | — | Correct the false pages 416–420 locator to printed page 392 and retain the accepted Minimum Player Salary-floor identity; DR2-0265 allocates EV2-0825–EV2-0828 as above-high-water successors. |
| DR2-0265 | EV2 | EV2-0592 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0592 | — | Correct the false pages 416–420 locator to printed page 393 and reconcile the highest-partial and tie dependency chain. |
| DR2-0265 | EV2 | EV2-0593 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0593 | — | Correct the false pages 416–420 locator to printed pages 393–394 and retain the accepted allocation identity; DR2-0265 allocates EV2-0829–EV2-0835 and EV2-0843 as above-high-water successors. |
| DR2-0265 | EV2 | EV2-0594 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0594 | — | Add the verified printed-page locator and retain the accepted unclaimed-termination identity; DR2-0265 allocates EV2-0836–EV2-0839 as above-high-water successors. |
| DR2-0265 | EV2 | EV2-0595 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0595 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0596 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0596 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0598 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0598 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0599 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0599 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0600 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0600 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0601 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0601 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0602 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0602 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0606 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0606 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0607 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0607 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0608 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0608 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0609 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0609 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0610 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0610 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0612 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0612 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0614 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0614 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0615 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0615 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0616 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0616 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0618 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0618 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0619 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0619 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0620 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0620 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0621 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0621 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0622 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0622 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0623 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0623 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0624 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0624 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0625 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0625 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0639 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0639 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0640 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0640 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0644 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0644 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0645 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0645 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0646 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0646 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0649 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0649 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0650 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0650 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0653 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0653 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0659 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0659 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0660 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0660 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0661 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0661 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0662 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0662 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0665 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0665 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0678 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0678 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0679 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0679 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0681 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0681 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0684 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0684 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0685 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0685 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0687 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0687 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0688 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0688 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0689 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0689 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0693 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0693 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0695 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0695 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0696 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0696 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0697 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0697 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0702 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0702 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0703 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0703 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0704 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0704 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0705 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0705 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0706 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0706 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0707 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0707 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0709 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0709 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0715 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0715 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0716 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0716 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0717 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0717 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0718 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0718 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0722 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0722 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0723 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0723 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0724 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0724 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0725 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0725 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0726 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0726 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0730 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0730 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0731 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0731 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0732 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0732 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0733 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0733 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0734 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0734 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0735 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0735 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0736 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0736 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0739 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0739 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0740 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0740 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0744 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0744 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0745 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0745 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0746 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0746 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0747 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0747 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0748 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0748 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0749 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0749 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0750 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0750 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0751 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0751 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0752 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0752 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0753 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0753 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0759 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0759 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0760 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0760 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0764 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0764 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0766 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0766 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0767 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0767 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0772 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0772 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0773 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0773 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0795 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0795 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0797 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0797 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0798 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0798 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0809 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0809 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |
| DR2-0265 | EV2 | EV2-0810 | — | 5acedb1b024973adab43ab9957f7bed23a42390f | revise | EV2-0810 | — | Add the verified signed-artifact printed-page locator without changing the evidence identity or substantive classification. |

## Exact downstream R7 dependency

This checkpoint does not alter the R7 scenario library. Before the Canon can
again be presented as an R9 candidate, a separately authorized R7 repair must:

1. Recheck `CBA2-SC-065(i)`–`CBA2-SC-065(k)` against the narrowed
   `CBA2-R01.14`–`CBA2-R01.16` owners; the old
   `CBA2-SC-065(j)` compound claim-validity case cannot serve as complete
   evidence for the repaired amount and Room owners.
2. Author exact positive/negative boundary cases for
   `CBA2-R01.15`, `CBA2-R01.17`, `CBA2-R01.19`–`CBA2-R01.22`,
   `CBA2-R01.25`–`CBA2-R01.28`, `CBA2-R01.30`–`CBA2-R01.32`,
   and `CBA2-R01.37`–`CBA2-R01.40`, each with complete evidence chains
   and exact expected results.
3. Add material interaction cases for eligibility plus amount/Room/award,
   payment plus Team Salary/later transaction, and every Subsequent Waiver
   formula branch; then update only the governed Scenario-evidence and
   scenario-lineage records needed by that R7 repair.
4. Preserve this source-certified rule/evidence content unless a new
   source-first defect is demonstrated, and return the R7 repair with this R6
   checkpoint to focused independent review under R9.

Until that repair exists, the scenario library is incomplete for the repaired
R01 population and R9 remains blocked.

## Validation

- `python3 work/architect-completion/cba_canon_v2_foundation_validator.py`
  passed the repaired document tree: all 20 accepting controls and all 218
  rejecting regressions behaved as expected (`238` controls total,
  `baseline_clean=yes`, zero failures). The validator reconciled 61 GROUPs,
  809 active LEAFs, 817 `EV2` records, 267 generic `DR2` records, and 747
  `AMEND` detail rows.
- A direct-authority locator census found 665 current CBA/By-Laws evidence
  records and zero missing locators. The 105 R9-listed omissions are populated,
  and `EV2-0591`–`EV2-0593` no longer contain the false pages 416–420
  locators.
- An R/L/S detail census reconciled 241 current detail rows and 222 dependency
  edges: 113 R-series, 84 L-series, and 25 S-series edges.
- `npm run test:diff -- --files docs/reference/cba/ARCHITECT_CBA_CANON.md
  work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md
  work/architect-completion/ARCHITECT_CBA_CANON_V2_R9_R6_FOCUSED_REPAIR.md
  --reporter=dot` selected the FAST tier and passed 12 files / 57 tests.
- `npm run lint:md` remains red on the repository's existing Markdown backlog.
  A task-scoped run showed no findings in either work artifact and only the 74
  pre-existing `MD029` findings in the Canon's historical scenarios 16–89.
  Running that Canon content from `HEAD` and from this checkpoint through the
  same linter produced the same 74 findings; this repair adds no Markdown
  finding and does not expand scope to rewrite the frozen scenario inventory.
