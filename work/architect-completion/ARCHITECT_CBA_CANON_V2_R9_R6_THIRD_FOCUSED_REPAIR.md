# Architect CBA Canon v2 — R9/R6 third focused repair

## Status

This is the bounded third maker correction ordered for the three residual
source-chain findings at exact baseline
`4e07a86e917bded5f1bc686bf6e8f2b9a3ee7386`. It amends only
`CBA2-R02.1` / `EV2-0595`, `CBA2-R02.4` / `EV2-0598`, and
`CBA2-L03.15` / `EV2-0704`, plus their same-identity detail and AMEND
lineage. It is not an acceptance review and makes no acceptance claim.

R6 remains an unaccepted corrected candidate pending focused independent
re-review. R7 repair, R8 reconciliation, renewed R9 review, owner acceptance,
Phase 2, W1.1, application work, Linear, Graphify, and `main` remain blocked
and untouched.

## Baseline and primary sources

- Topic branch baseline, tracking ref, and live remote:
  `4e07a86e917bded5f1bc686bf6e8f2b9a3ee7386`.
- Direct parent:
  `1d33b699f56a961ca080ee7a03c55b194df26252`.
- Local, tracking, and live remote `main`:
  `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`.
- Signed 2023 NBA-NBPA CBA: 2,850,534 bytes; SHA-256
  `bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32`.
- June 2024 NBA Constitution and By-Laws: 422,247 bytes; SHA-256
  `be4d2781fe8fddfc5bc9028214298f742789a949dade4ead26368a4336d32ccf`.

Both inspected primary artifacts matched the required immutable byte sizes and
SHA-256 values before source inspection. CBA printed pages 6 and 420–424 and
By-Laws printed pages 62–63 were read directly from those binaries. The
supporting active-chain provisions in CBA Articles II and VII and UPC
paragraph 16 were also checked against the same signed artifact.

## CBA2-R02.1 / EV2-0595

Article XXVII §1 calculates set-off separately for each Salary Cap Year
covered by the original Contract. Section 5(a) then controls the Article II
§4(k) payment-stretch case: the original Contract-year unearned Base
Compensation remains the calculation basis, and that year's set-off is
allocated equally across the protected-Compensation payments for that year
over the applicable remaining payment stretch period. It also bars set-off
against compensation earned from a Subsequent Team after the original
Contract term.

Section 5(b) controls the separate Article VII §7(d)(6) Team Salary stretch
case: the set-off for each remaining original Contract Salary Cap Year whose
Salary was re-attributed is allocated equally to reduce the corresponding
re-attributed Salary amounts across the applicable Team Salary stretch period.
The corrected proposition, detail inputs, locator, source explanation,
mapping, and limitation now keep these results distinct:

- approved buyout reduction and Article VII §7(d)(5) allocation;
- Article II §4(k) protected-Compensation payment-schedule stretch;
- Article VII §7(d)(6) Team Salary election and re-attribution;
- Article XXVII §1 set-off calculation by original Contract Salary Cap Year;
- Article XXVII §5(a) payment-stretch allocation; and
- Article XXVII §5(b) Team Salary re-attribution allocation.

The chain no longer calls itself complete while omitting §5(a)–(b).

## CBA2-R02.4 / EV2-0598

The post-termination Team Salary result now includes Article XXVII §5(b),
printed page 423. For every remaining original Contract Salary Cap Year whose
Salary is re-attributed under Article VII §7(d)(6), §5(b) allocates that
year's set-off equally across the corresponding re-attributed Team Salary
amounts over the applicable stretch period.

Section 5(a) is included only to the extent §5(b) expressly incorporates its
equal-allocation method. It is not presented as another Team Salary stretch
rule. The active chain keeps the approved buyout reduction/allocation,
payment-schedule stretch, Team Salary stretch election/re-attribution,
set-off calculation, and set-off allocation across re-attributed Salary years
as separate results.

## CBA2-L03.15 / EV2-0704

By-Laws §4.01(a), printed pages 62–63, establishes the Assignment Transaction
windows and expressly bars Assignment Transactions during the Moratorium
Period as defined in the governing collective bargaining agreement. CBA
Article I §1(mm), printed page 6, supplies that definition: for a Salary Cap
Year, the period begins July 1 at 12:01 a.m. eastern time and ends the
following July 6 at 12:00 p.m. eastern time, whether or not July 6 is a
business day.

Because the complete result joins two express primary-source passages, the
same `EV2-0704` identity is reclassified from `BYL` to `INFERRED`, directly
references both `SRC2-001` and `SRC2-002`, and states the legal inference. No
new LEAF or evidence identity is needed.

The second focused-repair receipt remains unchanged as historical evidence,
but its statement that the hash-matched CBA places the defined Moratorium
provision in Article II §15 is retracted and superseded by this receipt.
Article I §1(mm) is the controlling definition. Article II §15 separately
governs employment agreements and exceptions during the Moratorium, and
Article VII §9 is not the definition or authority for this Assignment
Transaction rule.

## Decision records

| DR ID | Type | Subject(s) | Disposition | Test/tiebreak applied | Rationale | Resulting active LEAF(s) or — | Unit/commit |
|---|---|---|---|---|---|---|---|
| DR2-0271 | `AMEND` | CBA2-R02.1, CBA2-R02.4, CBA2-L03.15, EV2-0595, EV2-0598, and EV2-0704 | Complete the two Article XXVII §5 allocation chains and replace the incorrect Moratorium-definition source through same-identity forward lineage | Exact third-focused-correction findings, hash-matched primary text, valid source-chain grammar, stable identity, no reuse or renumbering | Preserves every accepted first- and second-correction result and the R7 boundary while making only the three rejected chains complete and truthful | — | R6 / this checkpoint |

## AMEND detail rows

| AMEND record ID | Population | Prior record ID | Prior version or — | Prior checkpoint commit | Action | Current record ID(s) or — | Current version(s) or — | Reason |
|---|---|---|---|---|---|---|---|---|
| DR2-0271 | LEAF | CBA2-R02.1 | — | 4e07a86e917bded5f1bc686bf6e8f2b9a3ee7386 | revise | CBA2-R02.1 | — | Add the original-Contract-year set-off basis and the distinct Article XXVII §5(a) payment-stretch and §5(b) Team Salary re-attribution allocation branches. |
| DR2-0271 | LEAF | CBA2-R02.4 | — | 4e07a86e917bded5f1bc686bf6e8f2b9a3ee7386 | revise | CBA2-R02.4 | — | Add §5(b)'s equal reduction of re-attributed Salary and use §5(a) only for the allocation method incorporated by §5(b). |
| DR2-0271 | LEAF | CBA2-L03.15 | — | 4e07a86e917bded5f1bc686bf6e8f2b9a3ee7386 | revise | CBA2-L03.15 | — | Add the CBA Article I §1(mm) Moratorium definition and reclassify the complete two-source Assignment Transaction window to INFERRED. |
| DR2-0271 | EV2 | EV2-0595 | — | 4e07a86e917bded5f1bc686bf6e8f2b9a3ee7386 | revise | EV2-0595 | — | Incorporate Article XXVII §5(a)–(b), printed pages 422–424, with the correct original-year calculation and both allocation treatments. |
| DR2-0271 | EV2 | EV2-0598 | — | 4e07a86e917bded5f1bc686bf6e8f2b9a3ee7386 | revise | EV2-0598 | — | Incorporate §5(b), printed page 423, and only its express incorporation of §5(a)'s allocation method. |
| DR2-0271 | EV2 | EV2-0704 | — | 4e07a86e917bded5f1bc686bf6e8f2b9a3ee7386 | revise | EV2-0704 | — | Replace the incomplete BYL-only chain with an INFERRED chain over By-Laws §4.01(a) and the controlling CBA Article I §1(mm) definition. |

## Reconciled populations

- Unchanged: 61 GROUPs, 815 active LEAFs, 823 EV2 records, and 815 matching
  detail owners.
- Unchanged R/L/S subset: 247 LEAFs — R 118, L 102, S 27 — with 245 current
  dependency edges, zero missing targets, and zero cycles.
- Lineage: one new generic decision above the prior high-water mark, producing
  271 generic decisions, plus six same-identity AMEND detail rows, producing
  790 AMEND details.
- Evidence authority classes after the required `EV2-0704` correction are 647
  `CBA`, 17 `BYL`, 4 `NBA`, 6 `DERIVED`, 137 `INFERRED`, and 12 `EXT`.
  Thus 664 components remain directly classified `CBA`/`BYL`; the prior
  665-row direct-source review population remains fully accounted for by
  those 664 components plus `EV2-0704`, now the single two-primary-artifact
  `INFERRED` chain required by the correction. All 665 rows have printed-page
  locators.
- No LEAF, EV2, XW2, SXW2, scenario, source, search, bundle, blocked-finding,
  or resolution identity was added, reused, renumbered, or retired.

## R7 boundary and deferred impacts

The R7 scenario/crosswalk boundary remains byte-identical to
`4e07a86e917bded5f1bc686bf6e8f2b9a3ee7386`: 698,101 bytes, SHA-256
`6f200b6ba78fae0bdb15776232e1ab5078d47d5c6b565d18e6f202c60a280aba`.
No R7 scenario, XW2/SXW2 mapping, crosswalk, or outcome was edited.

The following five downstream references are recorded for later separately
authorized R7 work and were not performed:

- `CBA2-SC-066(a)` for `CBA2-R02.1` / `EV2-0595`;
- `CBA2-SC-066(c)`, `CBA2-SC-066(h32)`, and `CBA2-SC-066(h78)` for
  `CBA2-R02.4` / `EV2-0598`; and
- `CBA2-SC-076(h)` for `CBA2-L03.15` / `EV2-0704`.

## Validation

- Proposition-level checks: PASS. `EV2-0595` includes Article XXVII
  §5(a)–(b), distinguishes both stretch mechanisms, uses original Contract
  Salary Cap Years for set-off, and identifies the post-term bar. `EV2-0598`
  includes §5(b) and uses §5(a) only through the method §5(b) incorporates.
  `EV2-0704` uses Article I §1(mm) for the definition and identifies Articles
  II §15 and VII §9 only as non-definition boundaries.
- Register, evidence, dependency, and lineage reconciliation: PASS at the
  populations stated above; zero missing dependency targets and zero cycles.
- Direct-source locator census: PASS; zero missing printed-page locators in
  the preserved 665-row source-review population.
- R7 byte preservation: PASS at 698,101 bytes and SHA-256
  `6f200b6ba78fae0bdb15776232e1ab5078d47d5c6b565d18e6f202c60a280aba`.
- Frozen validator: after the owner authorized one additional execution to
  verify the corrected governed heading, the completed candidate passed all
  238/238 cases with `baseline_clean=yes`, zero failures, a successful negative
  self-test, successful cache-isolation self-checks, and frozen route checksum
  `b0c97d74d1426a323101155d61ebb86d2c42d6f66023ba383173e797db0a8cc1`.
- `npm run test:diff -- --files docs/reference/cba/ARCHITECT_CBA_CANON.md
  work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md
  work/architect-completion/ARCHITECT_CBA_CANON_V2_R9_R6_THIRD_FOCUSED_REPAIR.md
  --reporter=dot`: PASS, FAST tier, 12 files and 57 tests.
- Targeted Markdown lint for the three authorized files with `MD029` disabled:
  PASS. `MD029` remains excluded because the byte-identical historical R7
  scenario list retains its pre-existing ordered-list findings.
- `npm run validate:project`: PASS.
- `git diff --check`: PASS.
- Full application suite: intentionally not run because `RUN FULL SUITE` was
  not authorized.

## Unchanged and blocked work

The first and second focused-repair receipts, R9 rejection report, all prior
review records, frozen validator and route contract, R7 scenarios and
crosswalks, application code and tests, data, configuration, schemas, README,
Linear, Graphify, and `main` were not modified.

R6 still awaits focused independent acceptance. R7 repair, R8, renewed R9,
owner acceptance, Phase 2, W1.1, application work, Linear, Graphify, and
`main` remain blocked and untouched.
