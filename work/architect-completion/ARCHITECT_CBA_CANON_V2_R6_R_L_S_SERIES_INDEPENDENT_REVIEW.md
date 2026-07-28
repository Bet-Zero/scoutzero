# Architect CBA Canon v2.0 — R6 independent review

## Verdict

**FOCUSED REJECT / BLOCK-R7**

The exact corrected R6 checkpoint
`f480e0a8ec6a262bdc87d31bb5f231758f3c64c7` is mechanically joinable, but
it does not satisfy the binding source, atomicity, dependency, lifecycle,
historical-mapping, and accepted-record-preservation standards.

This is an affected-scope R6 rejection, not a restart of accepted R5 or a
reopening of unaffected A/C source content. Repair is limited to the R6
GROUP/LEAF/detail/evidence/crosswalk/decision surfaces identified below, the
misresolved accepted A-series fragment, and any additional dependency impact
demonstrated while making those corrections. The corrected material requires
focused independent re-review at its new exact checkpoint.

R7, Architect comparison, application work, Phase 2, Linear, Graphify, and
`main` remain blocked and unstarted.

Checker: independent role `/root`

Review date: `2026-07-28`

Corrected maker checkpoint:
`f480e0a8ec6a262bdc87d31bb5f231758f3c64c7`

R6 maker checkpoint:
`64eacaf532b08301560d25bd32c7076aaef3821e`

Accepted R5 prerequisite:
`5b29995b13664a15c1376a05074808c7eb552c4c`

Stable `main` observed:
`69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`

## Reviewed scope and source basis

The worktree was clean at review start. After a fresh remote fetch, local
`HEAD`, `origin/architect/cba-canon-v2`, and the required corrected checkpoint
were identical. The correction commit changes only five R5-provenance SHA
references in the canon, R6 maker certification, and repair plan; it changes
no R6 rule, evidence, mapping, decision, or source record.

The checker independently reviewed:

- all 24 R/L/S GROUPs;
- all 241 active R/L/S LEAF-main requirements and matching LEAF-detail rows:
  90 R, 124 L, and 27 S;
- all 241 corresponding evidence components, `EV2-0577` through
  `EV2-0817`;
- all 134 published historical R/L/S obligations: 133 new R6 edges,
  `XW2-0357` through `XW2-0489`, plus the accepted two-edge disposition of
  historical `CBA-L08.5` through `XW2-0160` and `XW2-0161`;
- all seven `DR2-0124` AMEND exits and their frozen historical fragments;
- `DR2-0125` through `DR2-0133`, the R6 fragment inventory, namespace
  continuity, dependency references, and evidence closure;
- preservation of accepted A/C identities and the exact R6 diff;
- official-versus-derived-versus-projected/unavailable classification; and
- the complete governing plan, R6 maker receipt, frozen register standard,
  and prior accepted R5 checker record.

The exact source artifacts used for source review were:

| Source | Bytes | SHA-256 |
|---|---:|---|
| Signed 2023 NBA–NBPA CBA | 2,850,534 | `bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32` |
| NBA Constitution and By-Laws, June 2024 | 422,247 | `be4d2781fe8fddfc5bc9028214298f742789a949dade4ead26368a4336d32ccf` |
| Official 2025-26 NBA regular-season schedule capture | 117,337 | `fb38ea144da8f2a8b26d8b605b3d1cde165a997c722e675913f9ce696ba2f01a` |

All three byte identities match `SRC2-001`, `SRC2-002`, and `SRC2-005`.
The signed CBA and By-Laws were independently text-extracted with the recorded
page geometry. The official schedule capture was read for the exact facts it
states.

The main-table authority population is structurally complete: 155 CBA,
12 BYL, 3 NBA, 7 DERIVED, 50 INFERRED, and 14 EXT active rules, with no OPS
rule. The semantic classification defects are identified below.

## Complete GROUP disposition

Every GROUP was reviewed. “Shared” means the GROUP is affected by the
crosswalk and detail-contract findings that span the R6 construction; the
additional finding numbers name demonstrated GROUP-specific defects.

| GROUP | LEAFs | Review result |
|---|---:|---|
| `CBA2-R01` | 18 | Shared findings 1, 4, and 7; source-chain finding 5 |
| `CBA2-R02` | 9 | Shared findings 1, 4, and 7 |
| `CBA2-R03` | 2 | Shared findings 1 and 4; source-chain finding 5 |
| `CBA2-R04` | 9 | Shared findings 1, 4, and 7 |
| `CBA2-R05` | 10 | Shared findings 1, 4, and 7 |
| `CBA2-R06` | 16 | Shared findings 1, 4, and 7 |
| `CBA2-R07` | 3 | Shared findings 1 and 4 |
| `CBA2-R08` | 8 | Shared findings 1, 4, and 7 |
| `CBA2-R09` | 3 | Shared findings 1 and 4 |
| `CBA2-R10` | 12 | Shared findings 1 and 4 |
| `CBA2-L01` | 9 | Shared findings 1 and 4; source-chain finding 5 |
| `CBA2-L02` | 14 | Shared findings 1, 4, and 7 |
| `CBA2-L03` | 23 | Shared findings 1, 4, and 7 |
| `CBA2-L04` | 24 | Shared findings 1, 4, and 7 |
| `CBA2-L05` | 18 | Shared findings 1, 4, and 7 |
| `CBA2-L06` | 8 | Shared findings 1 and 4 |
| `CBA2-L07` | 3 | Shared findings 1 and 4 |
| `CBA2-L08` | 9 | Shared findings 1, 4, and 7 |
| `CBA2-L09` | 6 | Findings 1–4 and 7 |
| `CBA2-L10` | 10 | Shared findings 1 and 4 |
| `CBA2-S01` | 9 | Shared findings 1, 4, and 7; schedule finding 6 |
| `CBA2-S02` | 6 | Shared findings 1 and 4 |
| `CBA2-S03` | 5 | Shared findings 1 and 4 |
| `CBA2-S04` | 7 | Shared findings 1, 4, and 7 |

No additional GROUP-specific source contradiction was located outside the
findings below. That does not accept any affected GROUP: each active row must
also pass the shared register contracts.

## Blocking repair findings

### 1. The 133 new historical mappings are non-specific partial overlaps

Affected edges:
`XW2-0357`–`XW2-0489`.

Affected historical fragments: the 47 R, 71 newly mapped L, and 15 S
whole-row `:F1` fragments declared by R6.

Affected decisions:
`DR2-0126`, `DR2-0129`, and `DR2-0132`.

All 133 new edges use `partial-overlap`, and all 133 use the same substantive
scope explanation:

> whole normalized historical obligation; R6 source-certified successor
> corrects authority, atomic decomposition, or lifecycle precision while
> preserving scope

That text does not state which part overlaps or how. The binding
`partial-overlap` definition requires the exact overlapping part and
relationship, and compound history requires multiple typed edge records.
Calling the fragment “whole” while saying the target may correct its
authority, atomic decomposition, or lifecycle is not a disposition of the
changed or separately owned parts.

The defect is substantive, not stylistic. For example:

- `CBA-R01.6:F1` combines a waiver-period duration and two different
  irrevocability duties, while its target `CBA2-R01.6` overlaps the separately
  minted `CBA2-R01.12` and `CBA2-R01.13`;
- `CBA-R06.3:F1` combines the shortage count, consecutive clock, and
  season-total clock, while its target overlaps `CBA2-R06.9` and
  `CBA2-R06.10`; and
- `CBA-S04.2:F1` combines four separately indexed values, while its target
  overlaps the separately minted `CBA2-S04.3`–`CBA2-S04.6`.

Required correction: inventory every independently changeable historical
obligation as an exact fragment; use `equivalent`, `split`, `merge`, `moved`,
or a genuinely exact `partial-overlap` as the frozen relationship requires;
and route every fragment exactly once to its atomic current owner or truthful
terminal disposition. Preserve the already accepted `CBA-L08.5` split unless
a demonstrated repair dependency requires changing it.

Dependent impact: the historical-successor Origin fields and evidence
components tied to these edges cannot be accepted until the mappings identify
the actual obligation each target owns. Re-review all repaired R6 fragments,
edges, targets, and their directly affected evidence.

### 2. `XW2-0149` misidentifies the accepted A17.1 frozen fragment

Affected frozen fragment:
`CBA-A17.1:F3`, normalized span `79-92`.

Affected records:
`XW2-0149`, `DR2-0124`, its AMEND detail row, and the R6 maker
certification’s deferral-closure claim.

The published normalized `CBA-A17.1` requirement is:

> Pick ownership, swaps, protections, deferrals, conveyance dependencies,
> frozen/slid status, and Stepien availability

Its accepted fragment partition makes:

- `F1`, span `0-72`: ownership, swaps, protections, deferrals, and conveyance
  dependencies;
- `F2`, span `72-79`: `frozen/`;
- `F3`, span `79-92`: “slid status, ”; and
- `F4`, span `92-116`: Stepien availability.

Current `XW2-0149` instead describes `F3` as “conditional
conveyance-dependency state in the dated pick ledger,” and the AMEND detail
repeats that false description. `CBA2-L09.4` can naturally own the direct
frozen-pick versus Draft Pick Penalty placement distinction, but it does not
turn the exact `slid status` fragment into conditional-conveyance processing.

Required correction: restore the exact `F3` meaning in the edge, decision,
AMEND detail, and receipt. Route the signed freeze/penalty placement result to
the exact direct owner without relabeling accepted history. Treat the
conditional-conveyance content in `F1` under finding 3 rather than moving it
into `F3`.

Dependent impact: six other `DR2-0124` exits reconcile to their stated
fragments and targets, but the seven-exit closure claim is false until this
record is repaired and independently re-reviewed. This finding does not
authorize edits to the accepted A-series fragment inventory itself.

### 3. L09 registers unsupported operational candidates and miscites Stepien

Affected active rules:
`CBA2-L09.1`, `CBA2-L09.2`, `CBA2-L09.3`, `CBA2-L09.5`, and
`CBA2-L09.6`.

Affected evidence:
`EV2-0775`–`EV2-0777`, `EV2-0779`, and `EV2-0780`.

Affected lineage:
`XW2-0148`, `XW2-0465`, `DR2-0124`, and `DR2-0130`.

Controlling primary provisions:

- CBA Article VII §2(f), printed pages 195–197, for the Second Apron
  frozen-pick and Draft Pick Penalty lifecycle; and
- NBA By-Laws §7.03, printed page 78, for the prohibition on leaving a
  Member without first-round picks in two consecutive future Drafts.

The frozen foundation explicitly classifies secondary-reported
pick-protection and deferral-processing mechanics as unsupported operational
candidates that cannot be registered or enforced without qualifying
first-party operational provenance or another valid authority classification.
R6 nevertheless registers:

- protections, conveyance order, deferral choices, and every asset dependency
  in `CBA2-L09.2`;
- unresolved protections as a legality input in `CBA2-L09.3`; and
- alternative-asset and deferral processing in `CBA2-L09.5`.

`CBA2-L09.1` also absorbs the full `CBA-A17.1:F1`, including those unsupported
mechanics. CBA Article VII §8(a) and Article X do not supply the operational
protection, ordering, or deferral-processing algorithm claimed by these rows.

Separately, `CBA2-L09.6` is an INFERRED Stepien-ledger integration rule, but
`EV2-0780` cites only CBA Article VII §8(a), carries only `SRC2-001`, and never
cites the controlling By-Laws §7.03 or `SRC2-002`. `EV2-0775` also invokes
Stepien without that authority root.

Required correction: preserve unsupported protection/deferral processing as
non-enforceable discovery candidates unless qualifying first-party authority
is located under the frozen search and blocked-obligation rules. Keep the
direct CBA freeze/penalty state separate. Root the Stepien rule and any honest
ledger inference in By-Laws §7.03 through `SRC2-002`, with exact dependencies
and limitations.

Dependent impact: re-review the affected L09 rules, evidence, `F1` routing,
and any revised decision/search disposition. `CBA2-L09.4`’s direct
freeze-versus-penalty distinction is not independently defective, but its
misdescribed `XW2-0149` origin is affected by finding 2.

### 4. Every R/L/S lifecycle-input cell is generic, and semantic dependencies are omitted

Affected detail rows: all 241 R/L/S LEAF-detail rows.

The frozen detail schema requires the actual
`asOfDate`/Salary Cap Year/window inputs needed by each rule. Instead:

- 145 rows say only “Use the explicit transaction date, Season, and
  controlling state required by the rule”; and
- 96 rows say only “Persist trigger, effective date, prior state, current
  state, and expiry/superseding event.”

Those two sentences are instructions to discover the inputs, not the required
inputs themselves. They omit material rule-specific data such as waiver
receipt and expiry timestamps, July 1/August 31/September 1 election windows,
January 10 protection state, consecutive shortage clocks, Offer Sheet receipt
times, Required Tender windows, frozen-pick observation years, and formula
input seasons.

The same table has 233 dependency cells equal to `—`. A dependency dash is
not automatically wrong for an independent direct rule, but it is wrong where
the requirement expressly consumes another active result. Demonstrated
examples include:

- `CBA2-L09.3`, `CBA2-L09.5`, and `CBA2-L09.6`, which consume ownership,
  protection/conveyance, frozen/penalty, and Stepien state while declaring no
  dependencies;
- `CBA2-R01.1`, `CBA2-R01.2`, and `CBA2-R01.7`, which infer combined event
  state from direct waiver/list/salary owners while declaring no dependencies;
- `CBA2-S04.1`, whose formula consumes season-keyed cap inputs but lists only
  `CBA2-A02.8`; and
- `CBA2-S04.2`, which claims four separately computed outputs but neither
  depends on nor stages through `CBA2-S04.3`–`CBA2-S04.6`.

Required correction: replace every generic lifecycle cell with the exact
inputs and windows that the atomic rule consumes. Add each demonstrated and
newly discovered active dependency; retain `—` only where the repaired atomic
rule is genuinely independent. Recompute the full dependency graph and
re-review affected aggregates and mappings.

Dependent impact: all 241 detail rows require focused re-review because their
input contract is uniformly non-specific. Dependency repair may be narrower,
but its final scope must be established from the repaired atomic owners rather
than the present 233 dashes.

### 5. Several evidence chains point to the wrong provision or omit their source root

#### R03 veteran-minimum reimbursement

Affected rules:
`CBA2-R03.1` and `CBA2-R03.2`.

Affected evidence:
`EV2-0604` and `EV2-0605`.

Both evidence rows cite CBA Article VII §6(l). That subsection is the Second
Round Pick Exception, not the veteran-minimum reimbursement rule. The
controlling provisions are Article VII §3(f), printed page 210, and Article
IV §6(h), printed page 101; Article VII §4(a), printed pages 211–212, supplies
the related Team Salary treatment.

Required correction: source the player Compensation, League-wide-fund
reimbursement, Salary, and Team Salary quantities to their exact provisions
and state which quantity controls each atomic result.

#### L01 Moratorium

Affected rule:
`CBA2-L01.3`.

Affected evidence:
`EV2-0669`.

The evidence cites Article II §14, which governs void Contracts. The
Moratorium is Article II §15, printed pages 65–66, including its specific
permitted negotiation, Offer Sheet, tender, Rookie Scale, Second Round Pick,
minimum/Two-Way, and conversion branches.

Required correction: cite §15 and keep the general signing prohibition
separate from its signed exceptions. Re-review the active rule for atomicity
because its current broad wording does not expose those branches.

#### R01 Team Salary after assignment

Affected rule:
`CBA2-R01.3`.

Affected evidence:
`EV2-0579`.

The active claim is that Team Salary includes Contracts assigned by trade or
waiver claim. Its evidence instead lists broad waiver/list/postseason
provisions, supplies only `SRC2-001` while also naming By-Laws provisions,
and paraphrases waiver priority and postseason eligibility rather than the
claimed Team Salary inclusion. It does not identify the exact Article VII
§4 computation route that would prove the claim.

Required correction: identify the exact CBA Team Salary provision and any
By-Laws assignment provision needed for the complete claim, list every source
record actually cited, and provide a claim-specific passage-to-obligation
mapping.

Dependent impact: these five evidence components do not source-certify their
active owners. Re-review the corrected evidence, rules, origins, and any
aggregate that consumes them.

### 6. The official schedule does not source the trade-deadline half of S01.6

Affected rule:
`CBA2-S01.6`.

Affected evidence:
`EV2-0796`.

Affected mapping:
`CBA-S01.6:F1` → `XW2-0480` → `CBA2-S01.6`.

`SRC2-005` and its detail row expressly certify only that the 2025-26 Regular
Season begins October 21, 2025 and ends April 12, 2026. `EV2-0796` repeats
only those dates. The active rule and mapped historical obligation also claim
that the trade deadline is versioned from official schedule records. No trade
deadline appears in the relied-upon passage or the source record’s certified
scope.

Required correction: split season opening/closing dates from transaction
deadline inputs. Add a qualifying official source record and exact evidence
for the trade deadline, or preserve that portion as unavailable/unsupported
under the frozen taxonomy until such provenance exists. Then correct the
historical fragment mapping so both parts receive truthful dispositions.

Dependent impact: re-review `CBA2-S01.6`, `EV2-0796`, `XW2-0480`, the
repaired fragment inventory, and any calendar/configuration aggregate that
depends on the trade deadline.

### 7. Broad historical-successor rows overlap their atomic children

At least 130 active mapped-successor rows carry the note that independently
changeable source components are owned by additional children in the same
GROUP. The binding active LEAF contract instead requires one atomically stated
obligation per active ID.

Demonstrated overlapping owners include:

- `CBA2-R01.6` versus `CBA2-R01.12` and `CBA2-R01.13`;
- `CBA2-R06.2` versus `CBA2-R06.8`;
- `CBA2-R06.3` versus `CBA2-R06.9` and `CBA2-R06.10`;
- `CBA2-R06.4` versus `CBA2-R06.7` and `CBA2-R06.11`;
- `CBA2-R06.5` versus `CBA2-R06.12`;
- `CBA2-R06.6` versus `CBA2-R06.7`, `CBA2-R06.8`, and
  `CBA2-R06.14`;
- `CBA2-S01.2` versus `CBA2-S01.7` and `CBA2-S01.8`; and
- `CBA2-S04.2` versus `CBA2-S04.3`–`CBA2-S04.6`.

These are independently verdict-bearing active rows, not informational GROUP
summaries. A checker cannot determine which ID owns a failure when both a
broad successor and its child own the same result.

Required correction: keep integration/audit questions at GROUP level; keep
only independently verdict-bearing obligations as LEAFs. If a staged
aggregate is genuinely needed, state its distinct output, dependencies, and
evidence rather than repeating the child requirements. Reconcile the repaired
owners with finding 1’s exact historical fragments.

Dependent impact: re-audit all 130 note-bearing successor rows for atomicity.
The eight demonstrated overlap sets must change; additional changes are
limited to rows where the same overlap is present. Re-review every changed
owner, child, dependency, evidence component, and mapping.

## Mechanical, preservation, and source results

The following checks passed independently:

- exact branch/checkpoint/worktree preflight and corrected-checkpoint
  ancestry;
- exact source byte sizes and SHA-256 identities for `SRC2-001`,
  `SRC2-002`, and `SRC2-005`;
- 24 GROUPs with continuous declared child ranges;
- 241 R/L/S LEAF-main rows and 241 matching LEAF-detail rows
  (90/124/27);
- 241 one-to-one R/L/S evidence joins;
- `XW2-0357`–`XW2-0489` numeric continuity and 133-row count;
- all dependency references resolve to active LEAFs;
- zero mechanical dependency cycles;
- source and authority namespaces remain numerically continuous;
- no silent deletion or renumbering of accepted A/C GROUP, LEAF, evidence,
  or crosswalk identities;
- six of seven `DR2-0124` AMEND exits reconcile semantically to their frozen
  fragments and named targets; and
- no R7 scenario, application, Phase 2, Linear, Graphify, or `main` work was
  introduced.

The checks above establish shape and preservation only. They do not cure the
semantic mapping, source, atomicity, input, or dependency defects in the
findings.

## Frozen full-document reconciliation

The frozen validator loaded and reconciled the complete canon and plan:

- 61 GROUPs, 809 LEAF-main rows, and 809 LEAF-detail rows;
- 484 XW2 edges, 817 EV2 components, and 133 DR2 decisions;
- all 14 accepting controls and 109 rejecting regressions behaved as
  expected; and
- the negative self-test failed as intended.

Process exit was `1` because `baseline_clean=NO`. The only reported baseline
problems were the seven inherited future-plan wording diagnostics already
present at the accepted R5 checkpoint:

1. R5 does not require independent R4 acceptance;
2. R6 does not require independent R5 acceptance;
3. R7 does not require independent checker acceptance of R3.1 and R4–R6;
4. R8 does not depend on an independently accepted R7;
5. R8 does not explicitly exclude README/code-map/runtime/Phase-2 expansion;
6. R9 input is not a pinned clean topic-branch checkpoint; and
7. R9 does not require both reviewer and owner acceptance to close Phase 1.

No R6-local parse, join, reference, preservation, AMEND, or cycle diagnostic
appeared. This checker did not repair the validator or plan because the Goal
authorizes only this review file.

## Final gate

R6 remains pending and R7 remains blocked.

Acceptance requires a new clean pushed R6 repair checkpoint that:

1. corrects the seven findings and their demonstrated dependencies;
2. changes no accepted R5 or unaffected A/C content without a demonstrated
   dependency impact;
3. reruns the scoped source and mechanical checks; and
4. receives a focused independent ACCEPT tied to the exact repaired commit.

This checker changed only this independent-review file. Canon, plan, maker
certification, sources, validator, application code, and accepted prior
records remain unchanged.
