# Architect CBA Canon v2.0 — R4 C-series first-half certification

## Status

The first R4 maker checkpoint
`2fc11880025c917dc765fd2f18e5e3697c5661f2` was independently
**REJECTED / BLOCK-R5** at checker commit
`3880ea3f2baf022b7fa0477b34d4238721afad33`. The second maker checkpoint
`3f4cbe4a05c660bac897b577880110bf8dd241c6` repaired four source groups but
was independently **REJECTED / BLOCK-R5** at checker commit
`69610fa15094cf8c9f8493d7ef64bc9bb8b1b7b4` for one residual Room MLE
atomicity defect and three decision/lineage labels. Those bounded residuals
are now repaired through forward lineage and are pending review of a new
exact clean maker checkpoint. The current result adds 13 C-family GROUPs and
120 active C01–C13 LEAFs to the shared register.
R5 remains blocked and unstarted. This receipt does not claim R9 acceptance,
final canon activation, or Phase 2 authority.

The exact R3.1 maker checkpoint
`9239c1d3dc595538beb048c77788cd2c453240a4` remains independently accepted.
R4 changes no prior receipt. It uses `DR2-0102` AMEND lineage to exit the
three R4-designated deferrals, `DR2-0111` forward lineage to repair the first
rejected maker checkpoint, and `DR2-0115` forward lineage to repair the
second.

## Source verification

Direct session capture cutoff: `2026-07-26T03:48:01Z`.

- Signed CBA: 2,850,534 bytes; SHA-256
  `bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32`;
  signed agreement and pagination directly verified.
- June 2024 By-Laws: the already-certified `SRC2-002` artifact identity
  remains 422,247 bytes with SHA-256
  `be4d2781fe8fddfc5bc9028214298f742789a949dade4ead26368a4336d32ccf`.
  A fresh unauthenticated CDN request returned an access-denied HTML response,
  so no replacement source record was minted and the accepted artifact
  identity was not altered.
- Official NBA Communications releases for 2024-25 and 2025-26 were directly
  checked for cap, apron, tax, minimum-team-salary, and Mid-Level Exception
  publication context. Existing `SRC2-003` and `SRC2-004` remain the governed
  official-release records used by the active registry.

The principal construction authorities were CBA VII §§2(c), 2(d), 2(e), 4,
and 6 and Article II. Every active R4 obligation has an `EV2` authority
component; no secondary explainer is used as authority.

## Historical coverage

All 66 published v1.1 C01–C13 LEAFs were normalized from pinned commit
`9814939c794595b988de21d8013934dc5342c8ee`. The fragment inventory in this
receipt covers every C01–C13 LEAF except C11.9 and C13.8, whose exhaustive
fragments were already committed by R3.1 and therefore are referenced rather
than duplicated. Together, the old and new inventories partition each
normalized requirement exactly over `[0,L)`.

| Audit focus | Result | Governing records |
|---|---|---|
| Team Salary / free-agent amounts | roster Salary, FA lifecycle, calculation inputs, multiplier table, bounds, RFA amount, and narrow unrenounce route are separate | CBA2-C01.1–C01.9; EV2-0160–EV2-0168 |
| First-round amounts | selection/amount, removal, reversible non-NBA lifecycle, and second-round distinction are separate | CBA2-C02.1–C02.4; XW2-0176–XW2-0181 |
| Minimum reimbursement | contract eligibility, ledger amount, benefits-fund payment, waived-contract Salary, and exception/reimbursement independence are separate | CBA2-C05.1–C05.5 |
| Apron Team Salary | baseline plus all ten enumerated adjustments; historical C07.6 becomes distinct (vi) and (vii) owners | CBA2-C07.1–C07.11; XW2-0202–XW2-0203 |
| Tax | finalization base, adjustments, repeater predicate, rate tables, transition years, and arithmetic are separate | CBA2-C08.1–C09.7 |
| Minimum Team Salary | annual amount, three adjusted concepts, charge, next-day restoration, initial/additional payments, sharing consequence, audit timing, and distribution are separate | CBA2-C10.1–C10.11 |
| Injury mechanisms | long-term exclusion and DPE are separate; durable DPE state/extinguishment representation remains expressly deferred to R6 | CBA2-C11.1–C12.9; XW2-0235, XW2-0239, XW2-0255 |
| Exceptions | combination/selection, proration, Minimum, NTMLE, TMLE, Room, BAE, SRPE, Rookie, and method/signing routing are separate; mixed exception rules resolve through staged aggregate verdicts over atomic source-law owners | CBA2-C13.1–C13.40 |

## Atomicity evidence

The maker applied one test to every C01–C13 candidate: GIVEN fixed facts,
WHEN one legal trigger/input changes, THEN one active result changes. Distinct
results were split. A closed list remains together only when every member
shares authority, method, lifecycle, and result.

| Candidate | GIVEN / WHEN / THEN evidence | Result |
|---|---|---|
| C01 multipliers | GIVEN one FA category and EAPS relation, WHEN the category/branch changes, THEN the same one Free Agent Amount multiplier changes | retain one closed calculation table at CBA2-C01.4 |
| C03 count | GIVEN the offseason date, WHEN one included category changes, THEN the same roster count changes | retain one closed count-input set at CBA2-C03.1 |
| C07.6 historical bundle | GIVEN fixed Team Salary, WHEN an unsigned-pick hold changes versus a Required Tender changes, THEN subtraction (vi) and addition (vii) change independently | split CBA2-C07.7 and CBA2-C07.8 |
| C08 adjustments | GIVEN the last-game baseline, WHEN one bonus/trade/grievance/minimum/suspension fact changes, THEN only its tax adjustment changes | split CBA2-C08.2–C08.8 |
| C09 rates | GIVEN one taxpayer status and bracket, WHEN repeater status changes, THEN the applicable table changes without changing bracket size | split CBA2-C09.1–C09.7 |
| C10 MTS | GIVEN fixed first-day and year-end inputs, WHEN current Cap Hold Team Salary changes, THEN only the charge/restoration results can change; WHEN the fixed payment base or year-end responsible total changes, only the applicable payment changes | split CBA2-C10.2–C10.11 |
| C11/C12 | GIVEN one injured player, WHEN exclusion versus DPE facts change, THEN distinct exception, Salary, timing, and medical-contract results change | separate C11 and C12 owners |
| C13 proration exceptions | GIVEN January 10, WHEN exception type or protected-use branch changes, THEN the same reduction/non-reduction result changes | retain homogeneous lists at CBA2-C13.4–C13.5 |
| C13 contract shapes | GIVEN one exception, WHEN method, amount, term, annual-change, assignment-transition, pre-use eligibility, post-use lifecycle, or frequency facts change, THEN one direct component changes and any aggregate compliance verdict recomputes | direct component owners CBA2-C13.21–C13.40 plus staged aggregate route owners; Room MLE pre-use and post-use results are separate; apron consequences remain A05 |

## Decision records

| DR ID | Type | Subject(s) | Disposition | Test/tiebreak applied | Rationale | Resulting active LEAF(s) or — | Unit/commit |
|---|---|---|---|---|---|---|---|
| DR2-0099 | `ATOM` | R4 C01–C13 active construction | Split independent legal results; retain only documented homogeneous-list exceptions | GIVEN/WHEN/THEN trigger-result-authority-method-lifecycle test | The 99 active obligations each have one independently evaluable result and one source chain | CBA2-C01.1, CBA2-C01.2, CBA2-C01.3, CBA2-C01.4, CBA2-C01.5, CBA2-C01.6, CBA2-C01.7, CBA2-C01.8, CBA2-C01.9, CBA2-C02.1, CBA2-C02.2, CBA2-C02.3, CBA2-C02.4, CBA2-C03.1, CBA2-C03.2, CBA2-C04.1, CBA2-C04.2, CBA2-C04.3, CBA2-C05.1, CBA2-C05.2, CBA2-C05.3, CBA2-C05.4, CBA2-C05.5, CBA2-C06.1, CBA2-C06.2, CBA2-C06.3, CBA2-C07.1, CBA2-C07.2, CBA2-C07.3, CBA2-C07.4, CBA2-C07.5, CBA2-C07.6, CBA2-C07.7, CBA2-C07.8, CBA2-C07.9, CBA2-C07.10, CBA2-C07.11, CBA2-C08.1, CBA2-C08.2, CBA2-C08.3, CBA2-C08.4, CBA2-C08.5, CBA2-C08.6, CBA2-C08.7, CBA2-C08.8, CBA2-C09.1, CBA2-C09.2, CBA2-C09.3, CBA2-C09.4, CBA2-C09.5, CBA2-C09.6, CBA2-C09.7, CBA2-C10.1, CBA2-C10.2, CBA2-C10.3, CBA2-C10.4, CBA2-C10.5, CBA2-C10.6, CBA2-C10.7, CBA2-C10.8, CBA2-C10.9, CBA2-C10.10, CBA2-C11.1, CBA2-C11.2, CBA2-C11.3, CBA2-C11.4, CBA2-C11.5, CBA2-C11.6, CBA2-C11.7, CBA2-C11.8, CBA2-C12.1, CBA2-C12.2, CBA2-C12.3, CBA2-C12.4, CBA2-C12.5, CBA2-C12.6, CBA2-C12.7, CBA2-C12.8, CBA2-C12.9, CBA2-C13.1, CBA2-C13.2, CBA2-C13.3, CBA2-C13.4, CBA2-C13.5, CBA2-C13.6, CBA2-C13.7, CBA2-C13.8, CBA2-C13.9, CBA2-C13.10, CBA2-C13.11, CBA2-C13.12, CBA2-C13.13, CBA2-C13.14, CBA2-C13.15, CBA2-C13.16, CBA2-C13.17, CBA2-C13.18, CBA2-C13.19, CBA2-C13.20 | R4 / this checkpoint |
| DR2-0100 | `OWN` | Published C01–C13 fragments and R4-closing A-family fragments | Assign each supported fragment to its natural current owner, terminal disposition, or governed deferral | Authority, atomic fit, family boundary, then stable-ID tiebreak | XW2-0167–XW2-0278 plus revised XW2-0147/0151/0155 carry direct fragment ownership | CBA2-C01.1, CBA2-C01.2, CBA2-C01.3, CBA2-C01.4, CBA2-C01.5, CBA2-C01.6, CBA2-C01.7, CBA2-C01.9, CBA2-C02.1, CBA2-C02.2, CBA2-C02.3, CBA2-C02.4, CBA2-C03.1, CBA2-C03.2, CBA2-C04.1, CBA2-C04.2, CBA2-C05.1, CBA2-C05.2, CBA2-C05.3, CBA2-C05.4, CBA2-C05.5, CBA2-C06.1, CBA2-C06.2, CBA2-C06.3, CBA2-C07.2, CBA2-C07.3, CBA2-C07.4, CBA2-C07.5, CBA2-C07.6, CBA2-C07.7, CBA2-C07.8, CBA2-C07.9, CBA2-C07.10, CBA2-C07.11, CBA2-C08.1, CBA2-C08.3, CBA2-C08.4, CBA2-C08.5, CBA2-C08.6, CBA2-C08.7, CBA2-C08.8, CBA2-C09.2, CBA2-C09.3, CBA2-C09.4, CBA2-C09.5, CBA2-C09.6, CBA2-C09.7, CBA2-C10.1, CBA2-C10.4, CBA2-C10.5, CBA2-C10.7, CBA2-C10.8, CBA2-C10.9, CBA2-C11.1, CBA2-C11.2, CBA2-C11.3, CBA2-C11.4, CBA2-C11.6, CBA2-C11.7, CBA2-C11.8, CBA2-C12.1, CBA2-C12.2, CBA2-C12.3, CBA2-C12.4, CBA2-C12.5, CBA2-C12.6, CBA2-C12.7, CBA2-C12.8, CBA2-C13.1, CBA2-C13.3, CBA2-C13.4, CBA2-C13.5, CBA2-C13.6, CBA2-C13.7, CBA2-C13.8, CBA2-C13.9, CBA2-C13.10, CBA2-C13.11, CBA2-C13.12, CBA2-C13.13, CBA2-C13.14, CBA2-C13.15, CBA2-C13.16, CBA2-C13.17, CBA2-C13.18, CBA2-C13.19, CBA2-C13.20 | R4 / this checkpoint |
| DR2-0101 | `ORIGIN` | Source-located C01–C13 obligations without an exact published predecessor | Register only direct current authority components | True-gap/new-source-component test | Each new obligation is directly supported by EV2-0160–EV2-0258 and is not used to hide an omitted historical fragment | CBA2-C01.1, CBA2-C01.2, CBA2-C01.3, CBA2-C01.4, CBA2-C01.5, CBA2-C01.6, CBA2-C01.7, CBA2-C01.8, CBA2-C01.9, CBA2-C02.1, CBA2-C02.2, CBA2-C02.3, CBA2-C02.4, CBA2-C03.1, CBA2-C03.2, CBA2-C04.1, CBA2-C04.2, CBA2-C04.3, CBA2-C05.1, CBA2-C05.2, CBA2-C05.3, CBA2-C05.4, CBA2-C05.5, CBA2-C06.1, CBA2-C06.2, CBA2-C06.3, CBA2-C07.1, CBA2-C07.2, CBA2-C07.3, CBA2-C07.4, CBA2-C07.5, CBA2-C07.6, CBA2-C07.7, CBA2-C07.8, CBA2-C07.9, CBA2-C07.10, CBA2-C07.11, CBA2-C08.1, CBA2-C08.2, CBA2-C08.3, CBA2-C08.4, CBA2-C08.5, CBA2-C08.6, CBA2-C08.7, CBA2-C08.8, CBA2-C09.1, CBA2-C09.2, CBA2-C09.3, CBA2-C09.4, CBA2-C09.5, CBA2-C09.6, CBA2-C09.7, CBA2-C10.1, CBA2-C10.2, CBA2-C10.3, CBA2-C10.4, CBA2-C10.5, CBA2-C10.6, CBA2-C10.7, CBA2-C10.8, CBA2-C10.9, CBA2-C10.10, CBA2-C11.1, CBA2-C11.2, CBA2-C11.3, CBA2-C11.4, CBA2-C11.5, CBA2-C11.6, CBA2-C11.7, CBA2-C11.8, CBA2-C12.1, CBA2-C12.2, CBA2-C12.3, CBA2-C12.4, CBA2-C12.5, CBA2-C12.6, CBA2-C12.7, CBA2-C12.8, CBA2-C12.9, CBA2-C13.1, CBA2-C13.2, CBA2-C13.3, CBA2-C13.4, CBA2-C13.5, CBA2-C13.6, CBA2-C13.7, CBA2-C13.8, CBA2-C13.9, CBA2-C13.10, CBA2-C13.11, CBA2-C13.12, CBA2-C13.13, CBA2-C13.14, CBA2-C13.15, CBA2-C13.16, CBA2-C13.17, CBA2-C13.18, CBA2-C13.19, CBA2-C13.20 | R4 / this checkpoint |
| DR2-0102 | `AMEND` | XW2-0147, XW2-0151, XW2-0155, DR2-0095 | Exit the three R4-designated deferrals through forward lineage | Resolving-unit and exact-fragment reconciliation | R4 now supplies Team Salary, Minimum Exception, and TMLE natural owners without changing prior receipts | — | R4 / this checkpoint |
| DR2-0103 | `TG` | CBA2-C13.20 | Register the source-located UFA signing-route inventory without pulling R5 Bird mechanics into R4 | True-gap versus deferred-historical-fragment test | The historical C13.14 route has a bounded R4 routing owner while detailed Bird rules remain R5 | CBA2-C13.20 | R4 / this checkpoint |
| DR2-0104 | `ATOM` | CBA2-C01.4, CBA2-C01.7, CBA2-C03.1, CBA2-C09.2, CBA2-C09.4, CBA2-C13.4, CBA2-C13.5, CBA2-C13.18 | Retain closed homogeneous-list/calculation exceptions | Common authority/method/lifecycle/result test | Each list member changes the same one calculation or verdict and hides no sibling outcome | CBA2-C01.4, CBA2-C01.7, CBA2-C03.1, CBA2-C09.2, CBA2-C09.4, CBA2-C13.4, CBA2-C13.5, CBA2-C13.18 | R4 / this checkpoint |
| DR2-0105 | `DISP` | CBA-C02.2:F3, XW2-0181 | Terminal invalid second-round Required-Tender/Apron claim | Exact VII §2(e)(1)(vii) round comparison | The signed adjustment applies to an outstanding Required Tender to a First Round Pick | — | R4 / this checkpoint |
| DR2-0106 | `DISP` | CBA-C05.4:F1, XW2-0191 | Unsupported residual after adequate bounded search | Exact-fragment no-owner test after CBA/BYL/NBA/ops-provenance coverage | No qualifying authority states that the reimbursement component disappears upon waiver | — | R4 / this checkpoint |
| DR2-0107 | `DISP` | CBA-C10.3:F2, XW2-0228 | Terminal false equality claim | Compare distinct §2(c)(2), (4), and (5) adjusted bases | The in-season charge is not necessarily equal to the year-end payment | — | R4 / this checkpoint |
| DR2-0108 | `OWN` | CBA-C10.4:F2, XW2-0231 | Restore the historical next-day restoration duty to its direct current owner | Exact VII §2(c)(4) source comparison | The signed text expressly requires increasing MTS Cap Hold Team Salary to at least the MTS Threshold by the end of the immediately following day | CBA2-C10.6 | R4 / this checkpoint |
| DR2-0109 | `DISP` | CBA-C13.1:F1, XW2-0256 | Process-only ledger-field prescription | Legal-obligation versus implementation-record test | Underlying amounts, methods, dates, and apron consequences have active legal owners; a specific application ledger schema is not source law | — | R4 / this checkpoint |
| DR2-0110 | `OWN` | CBA-C11.2:F1, CBA-C11.2:F5, CBA-C11.9:F2, CBA-C12.2:F6 | Preserve exact R6 DPE-state deferrals | Natural-family and durable-state tiebreak | Persisted DPE state/extinguishment belongs to R6; every R4 historical fragment otherwise has a current owner or terminal disposition | — | R4 / this checkpoint |
| DR2-0111 | `AMEND` | First rejected R4 maker checkpoint `2fc11880025c917dc765fd2f18e5e3697c5661f2` | Repair the checker-rejected source, atomicity, timing, ownership, and governed lineage records through forward amendment | Exact prior-checkpoint identity plus structured cross-population amendment | The first rejected checkpoint remains immutable while every changed current record has explicit, truthfully labeled lineage | — | R4 / this checkpoint |
| DR2-0112 | `ATOM` | Corrected MTS timing and C13 exception-shape routes | Register direct atomic components and retain only single-result or explicitly staged aggregate eligibility/use verdicts | GIVEN/WHEN/THEN result test plus dependency closure | Each direct component has one source result; aggregate routes depend on those direct owners without merging their independently enforceable results | CBA2-C10.11, CBA2-C13.6, CBA2-C13.8, CBA2-C13.9, CBA2-C13.11, CBA2-C13.12, CBA2-C13.13, CBA2-C13.14, CBA2-C13.21, CBA2-C13.22, CBA2-C13.23, CBA2-C13.24, CBA2-C13.25, CBA2-C13.26, CBA2-C13.27, CBA2-C13.28, CBA2-C13.29, CBA2-C13.30, CBA2-C13.31, CBA2-C13.32, CBA2-C13.33, CBA2-C13.34, CBA2-C13.35, CBA2-C13.36, CBA2-C13.37, CBA2-C13.38, CBA2-C13.39, CBA2-C13.40 | R4 / this checkpoint |
| DR2-0113 | `ATOM` | CBA2-C10.5, CBA2-C10.6 | Keep the in-season MTS charge and next-day restoration duty as separate current results | Change one underlying Team Salary base versus one qualifying decrease-and-deadline fact | VII §2(c)(3) determines the charge amount while §2(c)(4) independently imposes the restoration duty | CBA2-C10.5, CBA2-C10.6 | R4 / this checkpoint |
| DR2-0114 | `ORIGIN` | New source-located R4 repair components | Register only direct current authority components absent from the rejected maker checkpoint | True-gap/new-source-component test | EV2-0259–EV2-0278 directly support the new timing and exception-shape components without hiding historical fragments | CBA2-C10.11, CBA2-C13.21, CBA2-C13.22, CBA2-C13.23, CBA2-C13.24, CBA2-C13.25, CBA2-C13.26, CBA2-C13.27, CBA2-C13.28, CBA2-C13.29, CBA2-C13.30, CBA2-C13.31, CBA2-C13.32, CBA2-C13.33, CBA2-C13.34, CBA2-C13.35, CBA2-C13.36, CBA2-C13.37, CBA2-C13.38, CBA2-C13.39 | R4 / this checkpoint |
| DR2-0115 | `AMEND` | Second rejected R4 maker checkpoint `3f4cbe4a05c660bac897b577880110bf8dd241c6` | Split Room MLE pre-use/post-use results and correct the remaining decision/lineage labels | Exact prior-checkpoint identity plus structured cross-population amendment | The second rejected checkpoint remains immutable while its three bounded residual groups resolve to current truthful records | — | R4 / this checkpoint |
| DR2-0116 | `ORIGIN` | CBA2-C13.40, EV2-0279 | Register the direct Room MLE post-use lifecycle consequence absent from the second maker checkpoint | True-gap/new-source-component test | VII §6(g)(3) directly supplies a separately implementable post-use bar without changing the §6(g)(1) pre-use owner | CBA2-C13.40 | R4 / this checkpoint |

## AMEND detail rows

| AMEND record ID | Population | Prior record ID | Prior version or — | Prior checkpoint commit | Action | Current record ID(s) or — | Current version(s) or — | Reason |
|---|---|---|---|---|---|---|---|---|
| DR2-0102 | LEAF | CBA2-A05.3 | — | 07f0667d8cc55a6b86bd4c3fabada5d9b6d7d956 | revise | CBA2-A05.3 | — | Add the direct XW2-0271 historical-fragment backreference to the existing BAE First-Apron transaction owner |
| DR2-0102 | LEAF | CBA2-A05.4 | — | 07f0667d8cc55a6b86bd4c3fabada5d9b6d7d956 | revise | CBA2-A05.4 | — | Add the direct XW2-0266 historical-fragment backreference to the existing NTMLE First-Apron transaction owner |
| DR2-0102 | XW2 | XW2-0147 | — | 9239c1d3dc595538beb048c77788cd2c453240a4 | revise | XW2-0147 | — | Exit the R4 Minimum Exception deferral by resolving the already-inventoried homogeneous signing-contract fragment to CBA2-C13.6 |
| DR2-0102 | XW2 | XW2-0151 | — | 9239c1d3dc595538beb048c77788cd2c453240a4 | revise | XW2-0151 | — | Exit R4 Team Salary roster-inclusion deferral with the signed all-under-Contract owner |
| DR2-0102 | XW2 | XW2-0155 | — | 9239c1d3dc595538beb048c77788cd2c453240a4 | revise | XW2-0155 | — | Exit the R4 TMLE deferral by resolving the already-inventoried homogeneous signing-contract fragment to CBA2-C13.11 |
| DR2-0102 | DR2 | DR2-0095 | — | 9239c1d3dc595538beb048c77788cd2c453240a4 | replace | DR2-0102 | — | Supersede the R4-deferred same-family ownership decision with resolved forward lineage |
| DR2-0111 | GROUP | CBA2-C10 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | CBA2-C10 | — | Extend the MTS group for the separate NBA distribution deadline owner |
| DR2-0111 | GROUP | CBA2-C13 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | CBA2-C13 | — | Extend exception shapes with direct atomic source components |
| DR2-0111 | LEAF | CBA2-C09.1 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | CBA2-C09.1 | — | Correct the Tax Bracket Amount scaling formula to its signed 2023-24 base |
| DR2-0111 | LEAF | CBA2-C10.1 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | CBA2-C10.1 | — | Correct the annual MTS amount rule and locator |
| DR2-0111 | LEAF | CBA2-C10.2 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | CBA2-C10.2 | — | Correct the current MTS Cap Hold Team Salary base |
| DR2-0111 | LEAF | CBA2-C10.3 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | CBA2-C10.3 | — | Correct the fixed first-day MTS Payment Team Salary base |
| DR2-0111 | LEAF | CBA2-C10.5 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | CBA2-C10.5 | — | Correct the charge to the greater shortfall produced by the lesser comparison base |
| DR2-0111 | LEAF | CBA2-C10.6 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | CBA2-C10.6 | — | Restore the signed next-day duty to increase MTS Cap Hold Team Salary after a qualifying decrease below the threshold |
| DR2-0111 | LEAF | CBA2-C10.7 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | CBA2-C10.7 | — | Base the initial payment on fixed first-day MTS Payment Team Salary |
| DR2-0111 | LEAF | CBA2-C10.9 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | CBA2-C10.9 | — | Limit the additional payment to the signed year-end incentive-adjusted amount |
| DR2-0111 | LEAF | CBA2-C10.10 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | CBA2-C10.10 | — | Limit this owner to the Team payment deadline after the Governing Audit Report |
| DR2-0111 | LEAF | CBA2-C13.6 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | CBA2-C13.6 | — | Route one Minimum Exception eligibility verdict through three atomic dependencies |
| DR2-0111 | LEAF | CBA2-C13.7 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | CBA2-C13.7 | — | Remove unsupported waiver-claim authority from the Minimum Exception method |
| DR2-0111 | LEAF | CBA2-C13.8 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | CBA2-C13.8 | — | Route one NTMLE method verdict and exclude unsupported waiver claims |
| DR2-0111 | LEAF | CBA2-C13.9 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | CBA2-C13.9 | — | Route one NTMLE contract-shape verdict through atomic dependencies |
| DR2-0111 | LEAF | CBA2-C13.11 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | CBA2-C13.11 | — | Route one TMLE signed-contract verdict through atomic dependencies |
| DR2-0111 | LEAF | CBA2-C13.12 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | CBA2-C13.12 | — | Route one Room MLE use verdict through atomic dependencies |
| DR2-0111 | LEAF | CBA2-C13.13 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | CBA2-C13.13 | — | Correct BAE acquisition transition and remove unsupported waiver claims |
| DR2-0111 | LEAF | CBA2-C13.14 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | CBA2-C13.14 | — | Route one BAE contract/use verdict through atomic dependencies |
| DR2-0111 | XW2 | XW2-0147 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | XW2-0147 | — | Preserve its single aggregate Minimum eligibility owner over atomic dependencies |
| DR2-0111 | XW2 | XW2-0155 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | XW2-0155 | — | Preserve its single aggregate TMLE owner over atomic dependencies |
| DR2-0111 | XW2 | XW2-0227 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | XW2-0227 | — | Correct the fixed first-day initial-payment owner |
| DR2-0111 | XW2 | XW2-0231 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | XW2-0231 | — | Restore equivalent ownership by the signed next-day restoration rule |
| DR2-0111 | XW2 | XW2-0233 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | XW2-0233 | — | Correct the year-end additional-payment owner |
| DR2-0111 | XW2 | XW2-0264 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | XW2-0264 | — | Correct the NTMLE method route and exclude unsupported waiver claims |
| DR2-0111 | XW2 | XW2-0265 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | XW2-0265 | — | Preserve its single aggregate NTMLE shape owner over atomic dependencies |
| DR2-0111 | XW2 | XW2-0268 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | XW2-0268 | — | Preserve its single aggregate Room MLE owner over atomic dependencies |
| DR2-0111 | XW2 | XW2-0269 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | XW2-0269 | — | Correct the BAE method transition and exclude unsupported waiver claims |
| DR2-0111 | XW2 | XW2-0270 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | XW2-0270 | — | Preserve its single aggregate BAE contract/use owner over atomic dependencies |
| DR2-0111 | EV2 | EV2-0204 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | EV2-0204 | — | Remove the unrelated Article II locator and cite the direct suspension Tax Team Salary adjustment provision |
| DR2-0111 | EV2 | EV2-0205 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | EV2-0205 | — | Align the tax arithmetic evidence with the corrected bracket base |
| DR2-0111 | EV2 | EV2-0212 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | EV2-0212 | — | Correct the annual MTS locator |
| DR2-0111 | EV2 | EV2-0213 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | EV2-0213 | — | Correct the current MTS Cap Hold Team Salary evidence |
| DR2-0111 | EV2 | EV2-0214 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | EV2-0214 | — | Correct the fixed first-day MTS Payment Team Salary evidence |
| DR2-0111 | EV2 | EV2-0216 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | EV2-0216 | — | Correct the in-season charge formula evidence |
| DR2-0111 | EV2 | EV2-0217 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | EV2-0217 | — | Restore the next-day MTS Cap Hold Team Salary restoration duty and expressly exclude a general charge-removal rule |
| DR2-0111 | EV2 | EV2-0218 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | EV2-0218 | — | Correct the initial-payment base evidence |
| DR2-0111 | EV2 | EV2-0220 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | EV2-0220 | — | Correct the year-end additional-payment evidence |
| DR2-0111 | EV2 | EV2-0221 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | EV2-0221 | — | Separate the Team payment deadline from NBA distribution |
| DR2-0111 | EV2 | EV2-0244 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | EV2-0244 | — | Make Minimum eligibility an explicit inference over atomic components |
| DR2-0111 | EV2 | EV2-0245 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | EV2-0245 | — | Remove unsupported Minimum waiver-claim authority |
| DR2-0111 | EV2 | EV2-0246 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | EV2-0246 | — | Make NTMLE method eligibility an inference over direct routes |
| DR2-0111 | EV2 | EV2-0247 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | EV2-0247 | — | Make NTMLE contract shape an inference over atomic components |
| DR2-0111 | EV2 | EV2-0249 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | EV2-0249 | — | Make TMLE signed-contract eligibility an inference over atomic components |
| DR2-0111 | EV2 | EV2-0250 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | EV2-0250 | — | Make Room MLE use eligibility an inference over atomic components |
| DR2-0111 | EV2 | EV2-0251 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | EV2-0251 | — | Correct BAE method transition and remove unsupported waiver claims |
| DR2-0111 | EV2 | EV2-0252 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | EV2-0252 | — | Make BAE contract/use eligibility an inference over atomic components |
| DR2-0111 | EV2 | EV2-0257 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | EV2-0257 | — | Limit method separation to routes granted by each exception |
| DR2-0111 | DR2 | DR2-0104 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | DR2-0104 | — | Remove CBA2-C13.6 from the homogeneous-list exception decision |
| DR2-0111 | DR2 | DR2-0108 | — | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | revise | DR2-0108 | — | Revise the false terminal decision into the supported restoration owner |
| DR2-0111 | DISP | DR2-0108 | 1 | 2fc11880025c917dc765fd2f18e5e3697c5661f2 | remove | — | — | Signed VII §2(c)(4) proves the next-day restoration duty |
| DR2-0115 | GROUP | CBA2-C13 | — | 3f4cbe4a05c660bac897b577880110bf8dd241c6 | revise | CBA2-C13 | — | Extend the group for the separately implementable Room MLE post-use bar |
| DR2-0115 | LEAF | CBA2-C10.5 | — | 3f4cbe4a05c660bac897b577880110bf8dd241c6 | revise | CBA2-C10.5 | — | Cite the corrected ATOM decision that separates the §2(c)(3) charge from the §2(c)(4) restoration duty |
| DR2-0115 | LEAF | CBA2-C13.12 | — | 3f4cbe4a05c660bac897b577880110bf8dd241c6 | revise | CBA2-C13.12 | — | Make the aggregate complete-use verdict depend on distinct pre-use and post-use owners without merging them |
| DR2-0115 | LEAF | CBA2-C13.30 | — | 3f4cbe4a05c660bac897b577880110bf8dd241c6 | revise | CBA2-C13.30 | — | Narrow the existing owner to §6(g)(1) pre-use eligibility; the new CBA2-C13.40 separately owns the §6(g)(3) post-use consequence |
| DR2-0115 | XW2 | XW2-0268 | — | 3f4cbe4a05c660bac897b577880110bf8dd241c6 | revise | XW2-0268 | — | Reconcile the historical complete-use fragment to the staged aggregate over both direct lifecycle owners |
| DR2-0115 | EV2 | EV2-0250 | — | 3f4cbe4a05c660bac897b577880110bf8dd241c6 | revise | EV2-0250 | — | Add the separate post-use evidence dependency to the staged complete-use inference |
| DR2-0115 | EV2 | EV2-0269 | — | 3f4cbe4a05c660bac897b577880110bf8dd241c6 | revise | EV2-0269 | — | Narrow the existing evidence to §6(g)(1) pre-use eligibility; new EV2-0279 separately supplies §6(g)(3) post-use evidence |
| DR2-0115 | DR2 | DR2-0111 | — | 3f4cbe4a05c660bac897b577880110bf8dd241c6 | revise | DR2-0111 | — | Correct the governed EV2-0204 and EV2-0217 amendment reasons and identify the first rejected checkpoint precisely |
| DR2-0115 | DR2 | DR2-0112 | — | 3f4cbe4a05c660bac897b577880110bf8dd241c6 | revise | DR2-0112 | — | Add the distinct Room MLE post-use owner to the atomic dependency closure |
| DR2-0115 | DR2 | DR2-0113 | — | 3f4cbe4a05c660bac897b577880110bf8dd241c6 | revise | DR2-0113 | — | Replace the R7-only METHOD label with the truthful R4 ATOM decision separating charge and restoration |

## DISP detail rows

| DISP record ID | Subject class | Subject historical LEAF or — | Subject historical fragment ID or — | Subject candidate anchor or — | Subject active LEAF or — | Exact scope coordinate or — | Terminal edge ID | Disposition | Search record IDs or — | Search set ID or — | Source record IDs or — | Reason code | Preserved canon location or — | Claim boundary | Reopen condition or — | Resolution ID or — | Disposition status | Disposition version |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DR2-0105 | XW2-DISP | CBA-C02.2 | CBA-C02.2:F3 | — | — | span:82-134 | XW2-0181 | invalid | — | — | SRC2-001 | false-claim | §6.2 | First-round Required Tender adjustment remains owned by CBA2-C07.8; no second-round equivalent is asserted | Reopen on qualifying signed authority expressly supplying the second-round link | — | current | 1 |
| DR2-0106 | XW2-DISP | CBA-C05.4 | CBA-C05.4:F1 | — | — | span:0-67 | XW2-0191 | unsupported-residual | SM2-0006, SM2-0007, SM2-0008, SM2-0009 | SS2-0002 | SRC2-001, SRC2-002 | authority-not-located | §6.4 | No claim is made beyond the exact inventoried reimbursement-extinction fragment; waived-contract Salary is separately owned | Reopen on qualifying current authority or a later canon edition | — | current | 1 |
| DR2-0107 | XW2-DISP | CBA-C10.3 | CBA-C10.3:F2 | — | — | span:78-116 | XW2-0228 | invalid | — | — | SRC2-001 | false-claim | §8.7 | Charge/payment equality is rejected; distinct active bases and results remain | Reopen on a governing amendment that expressly makes the bases and amounts equal | — | current | 1 |
| DR2-0109 | XW2-DISP | CBA-C13.1 | CBA-C13.1:F1 | — | — | span:0-108 | XW2-0256 | process-only | — | — | SRC2-001 | process-material | §4.1 | No application-specific ledger schema becomes source law | Reopen only if the canon separately adopts implementation architecture outside the legal register | — | current | 1 |

## Fragment inventory

| Fragment ID | Historical parent LEAF | Fragment kind | Historical authority qualifier or — | Normalized fragment scope | Decomposition decision record | Disposition bundle ID or — | Disposition edge ID(s) | Fragment status | Fragment version | Limitations or — |
|---|---|---|---|---|---|---|---|---|---|---|
| CBA-C01.1:F1 | CBA-C01.1 | substantive-obligation | — | span:0-32 | DR2-0099 | — | XW2-0167 | current | 1 | — |
| CBA-C01.1:F2 | CBA-C01.1 | substantive-obligation | — | span:32-50 | DR2-0099 | — | XW2-0168 | current | 1 | — |
| CBA-C01.1:F3 | CBA-C01.1 | substantive-obligation | — | span:50-63 | DR2-0099 | — | XW2-0169 | current | 1 | — |
| CBA-C01.1:F4 | CBA-C01.1 | substantive-obligation | — | span:63-97 | DR2-0099 | — | XW2-0170 | current | 1 | — |
| CBA-C01.2:F1 | CBA-C01.2 | substantive-obligation | — | span:0-109 | DR2-0099 | — | XW2-0171 | current | 1 | — |
| CBA-C01.3:F1 | CBA-C01.3 | substantive-obligation | — | span:0-149 | DR2-0099 | — | XW2-0172 | current | 1 | — |
| CBA-C01.4:F1 | CBA-C01.4 | substantive-obligation | — | span:0-224 | DR2-0099 | — | XW2-0173 | current | 1 | — |
| CBA-C01.5:F1 | CBA-C01.5 | substantive-obligation | — | span:0-101 | DR2-0099 | — | XW2-0174 | current | 1 | — |
| CBA-C01.6:F1 | CBA-C01.6 | substantive-obligation | — | span:0-145 | DR2-0099 | — | XW2-0175 | current | 1 | — |
| CBA-C02.1:F1 | CBA-C02.1 | substantive-obligation | — | span:0-89 | DR2-0099 | — | XW2-0176 | current | 1 | — |
| CBA-C02.1:F2 | CBA-C02.1 | substantive-obligation | — | span:89-162 | DR2-0099 | — | XW2-0177 | current | 1 | — |
| CBA-C02.1:F3 | CBA-C02.1 | substantive-obligation | — | span:162-183 | DR2-0099 | — | XW2-0178 | current | 1 | — |
| CBA-C02.2:F1 | CBA-C02.2 | substantive-obligation | — | span:0-37 | DR2-0099 | — | XW2-0179 | current | 1 | — |
| CBA-C02.2:F2 | CBA-C02.2 | substantive-obligation | — | span:37-82 | DR2-0099 | — | XW2-0180 | current | 1 | — |
| CBA-C02.2:F3 | CBA-C02.2 | substantive-obligation | — | span:82-134 | DR2-0099 | — | XW2-0181 | current | 1 | — |
| CBA-C03.1:F1 | CBA-C03.1 | substantive-obligation | — | span:0-120 | DR2-0099 | — | XW2-0182 | current | 1 | — |
| CBA-C03.2:F1 | CBA-C03.2 | substantive-obligation | — | span:0-171 | DR2-0099 | — | XW2-0183 | current | 1 | — |
| CBA-C04.1:F1 | CBA-C04.1 | substantive-obligation | — | span:0-171 | DR2-0099 | — | XW2-0184 | current | 1 | — |
| CBA-C04.2:F1 | CBA-C04.2 | substantive-obligation | — | span:0-132 | DR2-0099 | — | XW2-0185 | current | 1 | — |
| CBA-C05.1:F1 | CBA-C05.1 | substantive-obligation | — | span:0-90 | DR2-0099 | — | XW2-0186 | current | 1 | — |
| CBA-C05.2:F1 | CBA-C05.2 | substantive-obligation | — | span:0-72 | DR2-0099 | — | XW2-0187 | current | 1 | — |
| CBA-C05.2:F2 | CBA-C05.2 | substantive-obligation | — | span:72-154 | DR2-0099 | — | XW2-0188 | current | 1 | — |
| CBA-C05.2:F3 | CBA-C05.2 | substantive-obligation | — | span:154-193 | DR2-0099 | — | XW2-0189 | current | 1 | — |
| CBA-C05.3:F1 | CBA-C05.3 | substantive-obligation | — | span:0-62 | DR2-0099 | — | XW2-0190 | current | 1 | — |
| CBA-C05.4:F1 | CBA-C05.4 | substantive-obligation | — | span:0-67 | DR2-0099 | — | XW2-0191 | current | 1 | — |
| CBA-C05.4:F2 | CBA-C05.4 | substantive-obligation | — | span:67-111 | DR2-0099 | — | XW2-0192 | current | 1 | — |
| CBA-C05.5:F1 | CBA-C05.5 | substantive-obligation | — | span:0-79 | DR2-0099 | — | XW2-0193 | current | 1 | — |
| CBA-C06:F1 | CBA-C06 | substantive-obligation | — | span:0-31 | DR2-0099 | — | XW2-0194 | current | 1 | — |
| CBA-C06:F2 | CBA-C06 | substantive-obligation | — | span:31-78 | DR2-0099 | — | XW2-0195 | current | 1 | — |
| CBA-C06:F3 | CBA-C06 | substantive-obligation | — | span:78-143 | DR2-0099 | — | XW2-0196 | current | 1 | — |
| CBA-C07.1:F1 | CBA-C07.1 | substantive-obligation | — | span:0-100 | DR2-0099 | — | XW2-0197 | current | 1 | — |
| CBA-C07.2:F1 | CBA-C07.2 | substantive-obligation | — | span:0-97 | DR2-0099 | — | XW2-0198 | current | 1 | — |
| CBA-C07.3:F1 | CBA-C07.3 | substantive-obligation | — | span:0-80 | DR2-0099 | — | XW2-0199 | current | 1 | — |
| CBA-C07.4:F1 | CBA-C07.4 | substantive-obligation | — | span:0-41 | DR2-0099 | — | XW2-0200 | current | 1 | — |
| CBA-C07.5:F1 | CBA-C07.5 | substantive-obligation | — | span:0-164 | DR2-0099 | — | XW2-0201 | current | 1 | — |
| CBA-C07.6:F1 | CBA-C07.6 | substantive-obligation | — | span:0-56 | DR2-0099 | — | XW2-0202 | current | 1 | — |
| CBA-C07.6:F2 | CBA-C07.6 | substantive-obligation | — | span:56-114 | DR2-0099 | — | XW2-0203 | current | 1 | — |
| CBA-C07.7:F1 | CBA-C07.7 | substantive-obligation | — | span:0-96 | DR2-0099 | — | XW2-0204 | current | 1 | — |
| CBA-C07.8:F1 | CBA-C07.8 | substantive-obligation | — | span:0-91 | DR2-0099 | — | XW2-0205 | current | 1 | — |
| CBA-C07.9:F1 | CBA-C07.9 | substantive-obligation | — | span:0-46 | DR2-0099 | — | XW2-0206 | current | 1 | — |
| CBA-C07.10:F1 | CBA-C07.10 | substantive-obligation | — | span:0-74 | DR2-0099 | — | XW2-0207 | current | 1 | — |
| CBA-C08.1:F1 | CBA-C08.1 | substantive-obligation | — | span:0-49 | DR2-0099 | — | XW2-0208 | current | 1 | — |
| CBA-C08.1:F2 | CBA-C08.1 | substantive-obligation | — | span:49-131 | DR2-0099 | — | XW2-0209 | current | 1 | — |
| CBA-C08.2:F1 | CBA-C08.2 | substantive-obligation | — | span:0-91 | DR2-0099 | — | XW2-0210 | current | 1 | — |
| CBA-C08.3:F1 | CBA-C08.3 | substantive-obligation | — | span:0-36 | DR2-0099 | — | XW2-0211 | current | 1 | — |
| CBA-C08.3:F2 | CBA-C08.3 | substantive-obligation | — | span:36-61 | DR2-0099 | — | XW2-0212 | current | 1 | — |
| CBA-C08.3:F3 | CBA-C08.3 | substantive-obligation | — | span:61-83 | DR2-0099 | — | XW2-0213 | current | 1 | — |
| CBA-C08.3:F4 | CBA-C08.3 | substantive-obligation | — | span:83-110 | DR2-0099 | — | XW2-0214 | current | 1 | — |
| CBA-C08.3:F5 | CBA-C08.3 | substantive-obligation | — | span:110-132 | DR2-0099 | — | XW2-0215 | current | 1 | — |
| CBA-C08.4:F1 | CBA-C08.4 | substantive-obligation | — | span:0-44 | DR2-0099 | — | XW2-0216 | current | 1 | — |
| CBA-C08.4:F2 | CBA-C08.4 | substantive-obligation | — | span:44-113 | DR2-0099 | — | XW2-0217 | current | 1 | — |
| CBA-C08.5:F1 | CBA-C08.5 | substantive-obligation | — | span:0-141 | DR2-0099 | — | XW2-0218 | current | 1 | — |
| CBA-C09.1:F1 | CBA-C09.1 | substantive-obligation | — | span:0-44 | DR2-0099 | — | XW2-0219 | current | 1 | — |
| CBA-C09.1:F2 | CBA-C09.1 | substantive-obligation | — | span:44-100 | DR2-0099 | — | XW2-0220 | current | 1 | — |
| CBA-C09.1:F3 | CBA-C09.1 | substantive-obligation | — | span:100-134 | DR2-0099 | — | XW2-0221 | current | 1 | — |
| CBA-C09.1:F4 | CBA-C09.1 | substantive-obligation | — | span:134-164 | DR2-0099 | — | XW2-0222 | current | 1 | — |
| CBA-C09.1:F5 | CBA-C09.1 | substantive-obligation | — | span:164-204 | DR2-0099 | — | XW2-0223 | current | 1 | — |
| CBA-C09.2:F1 | CBA-C09.2 | substantive-obligation | — | span:0-74 | DR2-0099 | — | XW2-0224 | current | 1 | — |
| CBA-C10.1:F1 | CBA-C10.1 | substantive-obligation | — | span:0-55 | DR2-0099 | — | XW2-0225 | current | 1 | — |
| CBA-C10.2:F1 | CBA-C10.2 | substantive-obligation | — | span:0-80 | DR2-0099 | — | XW2-0226 | current | 1 | — |
| CBA-C10.3:F1 | CBA-C10.3 | substantive-obligation | — | span:0-78 | DR2-0099 | — | XW2-0227 | current | 1 | — |
| CBA-C10.3:F2 | CBA-C10.3 | substantive-obligation | — | span:78-116 | DR2-0099 | — | XW2-0228 | current | 1 | — |
| CBA-C10.3:F3 | CBA-C10.3 | substantive-obligation | — | span:116-155 | DR2-0099 | — | XW2-0229 | current | 1 | — |
| CBA-C10.4:F1 | CBA-C10.4 | substantive-obligation | — | span:0-57 | DR2-0099 | — | XW2-0230 | current | 1 | — |
| CBA-C10.4:F2 | CBA-C10.4 | substantive-obligation | — | span:57-100 | DR2-0099 | — | XW2-0231 | current | 1 | — |
| CBA-C10.5:F1 | CBA-C10.5 | substantive-obligation | — | span:0-29 | DR2-0099 | — | XW2-0232 | current | 1 | — |
| CBA-C10.5:F2 | CBA-C10.5 | substantive-obligation | — | span:29-68 | DR2-0099 | — | XW2-0233 | current | 1 | — |
| CBA-C11.1:F1 | CBA-C11.1 | substantive-obligation | — | span:0-82 | DR2-0099 | — | XW2-0234 | current | 1 | — |
| CBA-C11.2:F1 | CBA-C11.2 | substantive-obligation | — | span:0-10 | DR2-0099 | — | XW2-0235 | current | 1 | — |
| CBA-C11.2:F2 | CBA-C11.2 | substantive-obligation | — | span:10-28 | DR2-0099 | — | XW2-0236 | current | 1 | — |
| CBA-C11.2:F3 | CBA-C11.2 | substantive-obligation | — | span:28-36 | DR2-0099 | — | XW2-0237 | current | 1 | — |
| CBA-C11.2:F4 | CBA-C11.2 | substantive-obligation | — | span:36-41 | DR2-0099 | — | XW2-0238 | current | 1 | — |
| CBA-C11.2:F5 | CBA-C11.2 | substantive-obligation | — | span:41-60 | DR2-0099 | — | XW2-0239 | current | 1 | — |
| CBA-C11.3:F1 | CBA-C11.3 | substantive-obligation | — | span:0-64 | DR2-0099 | — | XW2-0240 | current | 1 | — |
| CBA-C11.3:F2 | CBA-C11.3 | substantive-obligation | — | span:64-112 | DR2-0099 | — | XW2-0241 | current | 1 | — |
| CBA-C11.4:F1 | CBA-C11.4 | substantive-obligation | — | span:0-86 | DR2-0099 | — | XW2-0242 | current | 1 | — |
| CBA-C11.4:F2 | CBA-C11.4 | substantive-obligation | — | span:86-110 | DR2-0099 | — | XW2-0243 | current | 1 | — |
| CBA-C11.4:F3 | CBA-C11.4 | substantive-obligation | — | span:110-168 | DR2-0099 | — | XW2-0244 | current | 1 | — |
| CBA-C11.5:F1 | CBA-C11.5 | substantive-obligation | — | span:0-118 | DR2-0099 | — | XW2-0245 | current | 1 | — |
| CBA-C11.6:F1 | CBA-C11.6 | substantive-obligation | — | span:0-67 | DR2-0099 | — | XW2-0246 | current | 1 | — |
| CBA-C11.7:F1 | CBA-C11.7 | substantive-obligation | — | span:0-117 | DR2-0099 | — | XW2-0247 | current | 1 | — |
| CBA-C11.8:F1 | CBA-C11.8 | substantive-obligation | — | span:0-184 | DR2-0099 | — | XW2-0248 | current | 1 | — |
| CBA-C12.1:F1 | CBA-C12.1 | substantive-obligation | — | span:0-93 | DR2-0099 | — | XW2-0249 | current | 1 | — |
| CBA-C12.2:F1 | CBA-C12.2 | substantive-obligation | — | span:0-64 | DR2-0099 | — | XW2-0250 | current | 1 | — |
| CBA-C12.2:F2 | CBA-C12.2 | substantive-obligation | — | span:64-76 | DR2-0099 | — | XW2-0251 | current | 1 | — |
| CBA-C12.2:F3 | CBA-C12.2 | substantive-obligation | — | span:76-103 | DR2-0099 | — | XW2-0252 | current | 1 | — |
| CBA-C12.2:F4 | CBA-C12.2 | substantive-obligation | — | span:103-136 | DR2-0099 | — | XW2-0253 | current | 1 | — |
| CBA-C12.2:F5 | CBA-C12.2 | substantive-obligation | — | span:136-154 | DR2-0099 | — | XW2-0254 | current | 1 | — |
| CBA-C12.2:F6 | CBA-C12.2 | substantive-obligation | — | span:154-222 | DR2-0099 | — | XW2-0255 | current | 1 | — |
| CBA-C13.1:F1 | CBA-C13.1 | process-instruction | — | span:0-108 | DR2-0099 | — | XW2-0256 | current | 1 | process-only terminal |
| CBA-C13.2:F1 | CBA-C13.2 | substantive-obligation | — | span:0-66 | DR2-0099 | — | XW2-0257 | current | 1 | — |
| CBA-C13.3:F1 | CBA-C13.3 | substantive-obligation | — | span:0-81 | DR2-0099 | — | XW2-0258 | current | 1 | — |
| CBA-C13.4:F1 | CBA-C13.4 | substantive-obligation | — | span:0-60 | DR2-0099 | — | XW2-0259 | current | 1 | — |
| CBA-C13.4:F2 | CBA-C13.4 | substantive-obligation | — | span:60-114 | DR2-0099 | — | XW2-0260 | current | 1 | — |
| CBA-C13.4:F3 | CBA-C13.4 | substantive-obligation | — | span:114-140 | DR2-0099 | — | XW2-0261 | current | 1 | — |
| CBA-C13.5:F1 | CBA-C13.5 | substantive-obligation | — | span:0-90 | DR2-0099 | — | XW2-0262 | current | 1 | — |
| CBA-C13.6:F1 | CBA-C13.6 | substantive-obligation | — | span:0-100 | DR2-0099 | — | XW2-0263 | current | 1 | — |
| CBA-C13.7:F1 | CBA-C13.7 | substantive-obligation | — | span:0-43 | DR2-0099 | — | XW2-0264 | current | 1 | — |
| CBA-C13.7:F2 | CBA-C13.7 | substantive-obligation | — | span:43-84 | DR2-0099 | — | XW2-0265 | current | 1 | — |
| CBA-C13.7:F3 | CBA-C13.7 | substantive-obligation | — | span:84-120 | DR2-0099 | — | XW2-0266 | current | 1 | — |
| CBA-C13.7:F4 | CBA-C13.7 | substantive-obligation | — | span:120-186 | DR2-0099 | — | XW2-0267 | current | 1 | — |
| CBA-C13.9:F1 | CBA-C13.9 | substantive-obligation | — | span:0-84 | DR2-0099 | — | XW2-0268 | current | 1 | — |
| CBA-C13.10:F1 | CBA-C13.10 | substantive-obligation | — | span:0-23 | DR2-0099 | — | XW2-0269 | current | 1 | — |
| CBA-C13.10:F2 | CBA-C13.10 | substantive-obligation | — | span:23-98 | DR2-0099 | — | XW2-0270 | current | 1 | — |
| CBA-C13.10:F3 | CBA-C13.10 | substantive-obligation | — | span:98-122 | DR2-0099 | — | XW2-0271 | current | 1 | — |
| CBA-C13.10:F4 | CBA-C13.10 | substantive-obligation | — | span:122-134 | DR2-0099 | — | XW2-0272 | current | 1 | — |
| CBA-C13.11:F1 | CBA-C13.11 | substantive-obligation | — | span:0-97 | DR2-0099 | — | XW2-0273 | current | 1 | — |
| CBA-C13.12:F1 | CBA-C13.12 | substantive-obligation | — | span:0-71 | DR2-0099 | — | XW2-0274 | current | 1 | — |
| CBA-C13.12:F2 | CBA-C13.12 | substantive-obligation | — | span:71-96 | DR2-0099 | — | XW2-0275 | current | 1 | — |
| CBA-C13.13:F1 | CBA-C13.13 | substantive-obligation | — | span:0-109 | DR2-0099 | — | XW2-0276 | current | 1 | — |
| CBA-C13.14:F1 | CBA-C13.14 | substantive-obligation | — | span:0-106 | DR2-0099 | — | XW2-0277 | current | 1 | — |
| CBA-C13.15:F1 | CBA-C13.15 | substantive-obligation | — | span:0-135 | DR2-0099 | — | XW2-0278 | current | 1 | — |

The already-committed R3.1 inventory remains authoritative for
CBA-C11.9:F1–F2 and CBA-C13.8:F1–F4. R4 does not duplicate or renumber those
fragments.

## Disposition bundles

R4 adds no BND record. Revised XW2-0147 and XW2-0155 each resolve one
already-inventoried homogeneous fragment to one current owner. BND-0001–0010
remain current from R3.1.

## Search manifests

<!-- markdownlint-disable MD034 -->

| Search record ID | Subject class | Subject historical LEAF or — | Subject historical fragment ID or — | Subject candidate anchor or — | Authority/provenance class searched | Source identity | Source record ID or — | Canonical URL or authenticated provenance identifier or — | Binary/version identity or — | Binary size bytes or — | Binary SHA-256 or — | Binary pagination or — | Binary signature/as-of or — | Exact locator/query/provision | Search method | Search-set ID or — | Search cutoff timestamp | Result | Result linkage or — | Result details | Limitations or — | Verifier identity | Verification session ID | Verification date | Search status | Search version |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SM2-0006 | XW2-DISP | CBA-C05.4 | CBA-C05.4:F1 | — | CBA | 2023 signed NBA-NBPA Collective Bargaining Agreement | SRC2-001 | https://imgix.cosmicjs.com/25da5eb0-15eb-11ee-b5b3-fbd321202bdf-Final-2023-NBA-Collective-Bargaining-Agreement-6-28-23.pdf | 2023 NBA-NBPA Collective Bargaining Agreement (signed agreement, 2023 edition) | 2850534 | bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32 | pages=676 | signed | provision:Article II §3; Article IV §6(h); VII §§3(f),4(a), full waiver/reimbursement/benefits-fund sweep | full-text-sweep | SS2-0002 | 2026-07-26T03:48:01Z | no-qualifying-authority-located-in-searched-sources | SS2-0002 | No provision states that League reimbursement disappears when the Contract is waived | Bounded to the signed edition and cutoff | agent:codex | session:r4-20260725-maker | 2026-07-25 | current | 1 |
| SM2-0007 | XW2-DISP | CBA-C05.4 | CBA-C05.4:F1 | — | BYL | NBA Constitution and By-Laws, June 2024 edition | SRC2-002 | https://official.nba.com/wp-content/uploads/sites/4/2024/06/NBA-Consitution-By-Laws-June-2024.pdf | NBA Constitution and By-Laws, June 2024 edition | 422247 | be4d2781fe8fddfc5bc9028214298f742789a949dade4ead26368a4336d32ccf | pages=88 | unsigned | provision:full-text waiver/minimum/reimbursement sweep | provision-read | SS2-0002 | 2026-07-26T03:48:01Z | no-qualifying-authority-located-in-searched-sources | SS2-0002 | No qualifying waiver-reimbursement rule located; fresh CDN retrieval returned access-denied HTML and did not replace the accepted artifact identity | Search conclusion is bounded to the accepted certified artifact; CDN availability was not treated as source content | agent:codex | session:r4-20260725-maker | 2026-07-25 | current | 1 |
| SM2-0008 | XW2-DISP | CBA-C05.4 | CBA-C05.4:F1 | — | NBA | Official NBA/NBA Communications publications | — | https://pr.nba.com/ | — | — | — | — | — | query:waiver Minimum Player Salary reimbursement benefits fund subsidy | query | SS2-0002 | 2026-07-26T03:48:01Z | no-qualifying-authority-located-in-searched-sources | SS2-0002 | Current official cap releases publish cap/threshold/exception values but no qualifying post-waiver reimbursement rule | Bounded to official NBA publication channels and cutoff | agent:codex | session:r4-20260725-maker | 2026-07-25 | current | 1 |
| SM2-0009 | XW2-DISP | CBA-C05.4 | CBA-C05.4:F1 | — | ops-provenance | Authenticated first-party League operations provenance availability | — | provenance:league-ops | — | — | — | — | — | query:first-party post-waiver minimum-salary reimbursement provenance availability | attestation-availability-check | SS2-0002 | 2026-07-26T03:48:01Z | no-qualifying-authority-located-in-searched-sources | SS2-0002 | No authenticated qualifying first-party operations provenance was available | Bounded to accessible authenticated provenance at cutoff | agent:codex | session:r4-20260725-maker | 2026-07-25 | current | 1 |

<!-- markdownlint-enable MD034 -->

## Search sets

| Search set ID | Subject class | Subject LEAF or — | Subject fragment ID or — | Subject candidate anchor or — | Required source classes | Member SM2 IDs | Coverage assessment | Adequacy result | Set status | Set version |
|---|---|---|---|---|---|---|---|---|---|---|
| SS2-0002 | XW2-DISP | CBA-C05.4 | CBA-C05.4:F1 | — | CBA, BYL, NBA, ops-provenance | SM2-0006, SM2-0007, SM2-0008, SM2-0009 | CBA:covered, BYL:covered, NBA:covered, ops-provenance:covered | adequate-coverage | current | 1 |

## Date components

R4 adds no `SRC2` record and therefore no new date component. The current
`SRC2-001#D1`–`D3`, `SRC2-002#D1`, `SRC2-003#D1`, and `SRC2-004#D1`
components remain governed by the accepted R3.1 population.

## R4-local G15R and unit gates

The construction-time semantic review produced these U1–U14 judgments.
Mechanical results are recorded separately after the committed validator and
scoped documentation commands run.

| Gate | Maker judgment |
|---|---|
| U1 | Every pinned C01–C13 historical requirement is covered by the union of this receipt and the existing C11.9/C13.8 inventory; no whole unsupported valid in-scope obligation escapes. |
| U2 | Every active C obligation passed the independent trigger/result atomicity test, cites the closed homogeneous-list exception in DR2-0104, or is a single-result aggregate route over direct atomic dependencies under DR2-0112. |
| U3 | Every active LEAF names only a qualifying authority class and an `EV2` component whose source chain supports that exact result. |
| U4 | `EV2-0160`–`EV2-0279` cover every active C LEAF exactly once at the main authority-component level; dependencies are explicit. |
| U5 | New/revised XW2 edges and fragment rows reconcile bidirectionally; the two pre-existing homogeneous deferred fragments each resolve through one revised edge to one current owner, so R4 adds no BND record. |
| U6 | Source-located gaps use DR2-0101, DR2-0114, or DR2-0116 and do not replace or conceal an omitted historical fragment. |
| U7 | No wholly unsupported valid C01–C13 obligation was found; BLK/RES remain correctly absent. The supported sibling CBA2-C05.4 permits the exact unsupported C05.4 residual to terminate through DISP. |
| U8 | No source date was invented. R4 reuses the governed source/date components and records the search cutoff only as verification metadata. |
| U9 | Every current direct reference resolves to one current record; the three R4 deferrals exit through DR2-0102 AMEND lineage and the two rejected R4 maker checkpoints are repaired through DR2-0111 and DR2-0115. |
| U10 | New IDs allocate strictly above the shared high-water marks: XW2 through 0278, EV2 through 0279, DR2 through 0116, SM2 through 0009, and SS2 through 0002; R4 adds no BND above the existing BND-0010 high-water mark. |
| U11 | Historical rows and all prior receipts remain byte-untouched; only current canon structures, this receipt, and the repair-plan status are maker-authorized. |
| U12 | No secondary explainer, remembered practice, or unauthenticated CDN response is registered as authority. |
| U13 | Remaining deferrals identify exact fragments, natural families, and R5/R6 resolving units; no R4-designated deferral remains. |
| U14 | No C14+, R/L/S registration, scenario construction, application/code/test/config/data/README/map/graph/Linear/main work was performed. |

Actual-population G15R is triggered for GROUP, LEAF, XW2, EV2, DR2,
AMEND-detail, fragment inventory, DISP-detail, SM2, and SS2; the existing BND
population is also checked because revised edges must not create a bundle
join. Existing SRC2 base/detail/date components are referenced but not
revised. BLK, RES, SXW2, date-component creation, and scenario fragments are
untriggered.

## Mechanical validation

- `git diff --check` — PASS.
- `python3 work/architect-completion/cba_canon_v2_foundation_validator.py` —
  PASS: 25 GROUPs, 271 LEAF-main rows, 271 LEAF-detail rows, 273 XW2 edges,
  279 EV2 components, 116 DR2 records, 263 fragment rows, 298 AMEND-detail
  rows, 10 inherited BND rows, 17 DISP-detail rows, 9 SM2 rows, and 2 SS2
  rows; all 14 accepting controls and 109 rejecting regression controls
  passed, the baseline was clean, the negative self-test failed as intended,
  and total failures were zero.
- `npm run docs:guardrails` — PASS.
- `npm run validate:project` — PASS.
- `npm run test:diff -- --files docs/reference/cba/ARCHITECT_CBA_CANON.md
  work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md
  work/architect-completion/ARCHITECT_CBA_CANON_V2_R4_C_SERIES_FIRST_HALF_CERTIFICATION.md
  --reporter=dot` — PASS, FAST support-file tier: 12 test files and 57 tests
  passed.
- `npx markdownlint
  work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md
  work/architect-completion/ARCHITECT_CBA_CANON_V2_R4_C_SERIES_FIRST_HALF_CERTIFICATION.md`
  — PASS.
- The repository-wide `npm run lint:md` was run for the first maker
  checkpoint and reported only pre-existing findings in unrelated architect
  audit/code-map files and the canon's preserved numbered scenario blocks.
  Those canon MD029 findings reproduced against the pre-R4 canon. The current
  repair does not touch those scenario blocks; the scoped maker Markdown
  command above is clean.

## Independent review

The first maker checkpoint was independently **REJECTED / BLOCK-R5** at
checker commit `3880ea3f2baf022b7fa0477b34d4238721afad33`; the second was
independently **REJECTED / BLOCK-R5** at checker commit
`69610fa15094cf8c9f8493d7ef64bc9bb8b1b7b4`. Both histories remain in the
checker receipt. The same checker must now review the exact clean
forward-lineage checkpoint and append its new cycle only to
`ARCHITECT_CBA_CANON_V2_R4_C_SERIES_FIRST_HALF_INDEPENDENT_REVIEW.md`.
Only an explicit **ACCEPT** of that exact checkpoint unblocks R5.

## Boundary

No C14–C25, R/L/S family registration, scenario construction, R5+, Phase 2,
runtime application, test, configuration, data, Firestore, README, code-map,
graph-output, Linear, or main-branch work was performed. The retained recovery
stash was not read, applied, dropped, or altered. R5 remains blocked and
unstarted pending independent R4 ACCEPT.
