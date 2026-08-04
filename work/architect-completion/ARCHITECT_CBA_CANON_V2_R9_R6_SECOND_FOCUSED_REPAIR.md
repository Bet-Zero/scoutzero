# Architect CBA Canon v2 — R9/R6 second focused repair

## Status

This is the bounded second maker correction ordered after focused independent
review of `1d33b699f56a961ca080ee7a03c55b194df26252`. It corrects only the
nine named evidence chains, partial-waiver Room timing, explicit per-claim
validity ownership, and demonstrated downstream dependencies. It is not an
acceptance review and makes no acceptance claim.

R6 remains an unaccepted corrected candidate pending focused independent
re-review. The R7 scenario repair, R8 reconciliation, renewed R9 review, owner
acceptance, Phase 2, application work, W1.1, Linear, Graphify, and `main`
remain blocked and untouched.

## Baseline and primary sources

- Topic branch baseline, tracking ref, and live remote:
  `1d33b699f56a961ca080ee7a03c55b194df26252`.
- Direct parent:
  `5acedb1b024973adab43ab9957f7bed23a42390f`.
- Local and live remote `main`:
  `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`.
- Signed 2023 NBA-NBPA CBA: 2,850,534 bytes; SHA-256
  `bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32`.
- June 2024 NBA Constitution and By-Laws: 422,247 bytes; SHA-256
  `be4d2781fe8fddfc5bc9028214298f742789a949dade4ead26368a4336d32ccf`.

Both current official downloads matched the required immutable hashes before
source review. No different currently served binary was substituted.

## Nine affected evidence records

| Evidence | Disposition |
|---|---|
| `EV2-0581` | Narrowed and reclassified to `INFERRED`: it now aggregates only the signed claim-window, irrevocability, and priority owners. Player List room, Salary Cap room, and exception authority are removed; By-Laws §4.05(e) is expressly limited to Trade Calls. |
| `EV2-0585` | Narrowed to By-Laws §5.05, printed pp. 67–68, for waiver priority only. |
| `EV2-0586` | Narrowed to CBA XXIX §4, printed p. 431, for the postseason-waiver deadline and eight-player exception only. |
| `EV2-0595` | Completed with CBA II §3(p), II §4(a)/(k), VII §4(a)(1)(i), VII §7(d)(5)–(6), XXVII §§1–3, and UPC ¶16 so buyout, Team Salary stretch, and set-off branches each have controlling authority. |
| `EV2-0598` | Completed with the same controlling chain for the post-termination Team Salary result; payment stretch and Team Salary stretch remain distinct. |
| `EV2-0653` | Corrected from nonexistent `XXIX §1(e)` to the unnumbered paragraph of XXIX §1, printed p. 429. |
| `EV2-0693` | Narrowed to CBA X §7, printed pp. 304–305: assignment and continuity of unsigned draft rights are direct CBA; immediate timing under NBA procedures is not. |
| `EV2-0704` | Narrowed and reclassified to `BYL` under §4.01(a), printed pp. 62–63, for trade-deadline, postseason-roster, and Moratorium assignment windows. Lottery and draft-day timing are not retained as direct-CBA conclusions. |
| `EV2-0717` | Completed with CBA X §§4–7, printed pp. 298–305, for retained draft rights while preserving Article XI §§1–5 only for UFA/RFA status. |

## Room timing and valid-claim graph

`CBA2-R01.28` now owns only submission-time Team Salary below the Salary
Cap. `CBA2-R01.29` owns only actual Room available at submission against the
claim-specific first-year requirement. Six successors above the accepted
high-water mark complete the graph:

- `CBA2-R01.46` / `EV2-0845`: candidate-bid allocation needed to calculate
  the first-year submission requirement without presupposing an award.
- `CBA2-R01.47` / `EV2-0846`: Room immediately creatable through identified
  unilateral renouncements or waivers.
- `CBA2-R01.48` / `EV2-0847`: exclusion of Room dependent on a trade.
- `CBA2-R01.49` / `EV2-0848`: combined actual plus qualifying immediately
  creatable Room result at submission, after excluding trade-dependent Room.
- `CBA2-R01.50` / `EV2-0849`: actual creation of relied-upon latent Room
  immediately upon award.
- `CBA2-R01.51` / `EV2-0850`: one PASS/FAIL validity result for each submitted
  Partial Waiver Claim.

The validity owner consumes `CBA2-R01.6`, `.15`, `.19`, `.23`, `.26`,
`.27`, `.28`, `.41`, `.42`, `.43`, and `.49`. Thus its dependency closure
includes procedure eligibility, written designation, waiver period and claim
window, claimant eligibility, claim form, every amount bound, submission-time
below-Cap status, and combined actual plus qualifying immediately creatable
Room after the trade exclusion.

`CBA2-R01.16` is reclassified to `INFERRED` and consumes `CBA2-R01.51`
before comparing bid totals. `CBA2-R01.17`, `.18`, `.30`–`.40`, `.44`, and
`.50` consume the valid selection directly or through an explicit selected
PASS claim dependency. Candidate allocation (`.46`) and accepted allocation
(`.17`) independently apply the signed formula on opposite sides of selection
and do not depend on each other. No payment, Team Salary, trade, Subsequent
Waiver, or succession result is reachable from an invalid bid. The direction
is acyclic: submission inputs and validity lead to selection, selection leads
to award and later consequences, and award-time Room creation never feeds back
into submission validity.

## Decision records

| DR ID | Type | Subject(s) | Disposition | Test/tiebreak applied | Rationale | Resulting active LEAF(s) or — | Unit/commit |
|---|---|---|---|---|---|---|---|
| DR2-0268 | `AMEND` | Focused R9/R6 rule, detail, GROUP, and EV2 records named in the AMEND rows below | Revise the nine proposition chains and repair Room-timing, validity-selection, and demonstrated consequence dependencies through forward lineage | Exact focused-review finding, hash-matched source text, stable identity, no reuse or renumbering | Preserves every unaffected identity and the R7 section while making each changed proposition and dependency truthful | — | R6 / this checkpoint |
| DR2-0269 | `ATOM` | CBA Article XXII §11(i)(iii) submission, Room, validity, selection, and award lifecycle | Separate each independently changeable submission fact, Room branch, trade exclusion, combined validity result, and award-time creation obligation | GIVEN all other inputs fixed, WHEN one submission status, Room source, excluded action, validity predicate, or lifecycle event changes, THEN only its direct result changes | Prevents award-time state from determining submission validity and prevents validity from depending on a selected winner | CBA2-R01.28, CBA2-R01.29, CBA2-R01.46, CBA2-R01.47, CBA2-R01.48, CBA2-R01.49, CBA2-R01.50, CBA2-R01.51 | R6 / this checkpoint |
| DR2-0270 | `ORIGIN` | Explicit per-claim Partial Waiver Claim validity result omitted from the first focused repair | Register the true-gap validity owner above the accepted R01 and EV2 high-water marks | True-gap test: no existing LEAF produced a per-claim legal-validity ID consumed by winner selection | The source requirements existed separately, but their conjunctive per-claim result had no owner; CBA2-R01.51 closes only that gap | CBA2-R01.51 | R6 / this checkpoint |

## AMEND detail rows

| AMEND record ID | Population | Prior record ID | Prior version or — | Prior checkpoint commit | Action | Current record ID(s) or — | Current version(s) or — | Reason |
|---|---|---|---|---|---|---|---|---|
| DR2-0268 | GROUP | CBA2-R01 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-R01 | — | Extend the active child declaration from R01.1–R01.45 to R01.1–R01.51. |
| DR2-0268 | LEAF | CBA2-R01.5 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-R01.5 | — | Remove unsupported list-room and cap/exception claim-validity propositions; narrow and reclassify to the directly supported procedural aggregate. |
| DR2-0268 | LEAF | CBA2-R01.15 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-R01.15 | — | Make the Minimum Player Salary floor an independent per-claim result consumed by the new validity owner. |
| DR2-0268 | LEAF | CBA2-R01.16 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-R01.16 | — | Consume explicit per-claim validity before highest-bid selection and reclassify the staged selection result to INFERRED. |
| DR2-0268 | LEAF | CBA2-R01.17 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-R01.17 | — | Consume the selected PASS claim and independently calculate the accepted allocation without feeding an award result back into candidate submission testing. |
| DR2-0268 | LEAF | CBA2-R01.18 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-R01.18 | — | Ensure invalid submissions do not prevent unclaimed termination and reclassify the staged result to INFERRED. |
| DR2-0268 | LEAF | CBA2-R01.26 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-R01.26 | — | Make the strict full-Base-Compensation ceiling an independent per-claim result consumed by validity. |
| DR2-0268 | LEAF | CBA2-R01.27 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-R01.27 | — | Make the unprotected-Base-Compensation floor an independent per-claim result consumed by validity. |
| DR2-0268 | LEAF | CBA2-R01.28 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-R01.28 | — | Correct Team Salary/Salary Cap evaluation from award time to submission time and separate it from Room. |
| DR2-0268 | LEAF | CBA2-R01.29 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-R01.29 | — | Own actual Room at submission only; split creatable Room, trade exclusion, combined Room result, and award-time creation above the high-water mark. |
| DR2-0268 | LEAF | CBA2-R01.32 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-R01.32 | — | Add the selected PASS claim as an explicit Team Salary prerequisite. |
| DR2-0268 | LEAF | CBA2-R01.34 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-R01.34 | — | Add the selected PASS claim as an explicit later-transaction prerequisite. |
| DR2-0268 | LEAF | CBA2-R01.36 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-R01.36 | — | Add the selected PASS claim as an explicit reimbursement prerequisite. |
| DR2-0268 | LEAF | CBA2-R01.37 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-R01.37 | — | Add the selected PASS claim as an explicit Subsequent Waiver prerequisite. |
| DR2-0268 | LEAF | CBA2-R01.38 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-R01.38 | — | Add the selected PASS claim as an explicit claiming-obligation-adjustment prerequisite. |
| DR2-0268 | LEAF | CBA2-R01.39 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-R01.39 | — | Add the selected PASS claim as an explicit waiving-obligation-adjustment prerequisite. |
| DR2-0268 | LEAF | CBA2-R01.40 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-R01.40 | — | Add the selected PASS claim as an explicit triggered-protection prerequisite. |
| DR2-0268 | LEAF | CBA2-R01.44 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-R01.44 | — | Add the selected PASS claim as an explicit Claiming-Team succession prerequisite. |
| DR2-0268 | LEAF | CBA2-R02.1 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-R02.1 | — | Reconcile the complete dead-salary, approved buyout, Team Salary stretch, and set-off proposition. |
| DR2-0268 | LEAF | CBA2-R02.4 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-R02.4 | — | Reconcile the complete post-termination Team Salary result across buyout, stretch, and set-off. |
| DR2-0268 | LEAF | CBA2-R09.2 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-R09.2 | — | Correct the source note to unnumbered Article XXIX §1. |
| DR2-0268 | LEAF | CBA2-L03.4 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-L03.4 | — | Remove unsupported immediate timing and retain only CBA-proved draft-rights assignment and continuity. |
| DR2-0268 | LEAF | CBA2-L03.15 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-L03.15 | — | Narrow and reclassify to the By-Laws trade-deadline, postseason, and Moratorium Assignment Transaction windows. |
| DR2-0268 | LEAF | CBA2-L04.5 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | CBA2-L04.5 | — | Add Article X retained-draft-rights authority while retaining Article XI only for UFA/RFA. |
| DR2-0268 | EV2 | EV2-0581 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | EV2-0581 | — | Narrow and reclassify the evidence; remove list-room, cap/exception, and Trade Call authority from the waiver claim. |
| DR2-0268 | EV2 | EV2-0585 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | EV2-0585 | — | Retain only By-Laws §5.05 waiver-priority authority. |
| DR2-0268 | EV2 | EV2-0586 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | EV2-0586 | — | Retain only CBA XXIX §4 postseason-waiver authority. |
| DR2-0268 | EV2 | EV2-0592 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | EV2-0592 | — | Add the explicit per-claim validity dependency before highest-total selection and reclassify to INFERRED. |
| DR2-0268 | EV2 | EV2-0594 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | EV2-0594 | — | Add validity and selection dependencies so an invalid submission does not block termination. |
| DR2-0268 | EV2 | EV2-0595 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | EV2-0595 | — | Add the controlling buyout, Team Salary stretch, and Article XXVII set-off provisions. |
| DR2-0268 | EV2 | EV2-0598 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | EV2-0598 | — | Add the controlling buyout, Team Salary stretch, and Article XXVII set-off provisions. |
| DR2-0268 | EV2 | EV2-0653 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | EV2-0653 | — | Replace nonexistent XXIX §1(e) with unnumbered §1, printed p. 429. |
| DR2-0268 | EV2 | EV2-0693 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | EV2-0693 | — | Replace unrelated citations with Article X §7 and remove immediate timing. |
| DR2-0268 | EV2 | EV2-0704 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | EV2-0704 | — | Replace unrelated CBA citations with By-Laws §4.01 and remove unsupported lottery/draft-day branches. |
| DR2-0268 | EV2 | EV2-0717 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | EV2-0717 | — | Add Article X §§4–7 retained-rights authority alongside Article XI UFA/RFA authority. |
| DR2-0268 | EV2 | EV2-0827 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | EV2-0827 | — | Narrow to submission-time Team Salary below the Salary Cap. |
| DR2-0268 | EV2 | EV2-0828 | — | 1d33b699f56a961ca080ee7a03c55b194df26252 | revise | EV2-0828 | — | Narrow to actual Room available at submission against the required first-year amount. |

## Targeted semantic probes

The completed candidate is required to demonstrate all nine focused probes:
the three amount-bound failures, insufficient actual and creatable Room,
trade-dependent Room exclusion, waiving-Team claimant exclusion,
procedural ineligibility, lower-valid-over-higher-invalid selection, and the
creatable-Room submission/award lifecycle. Exact executed results are recorded
in the final validation section below.

## Exact downstream R7 work recorded but not performed

The active R7 scenario section is unchanged. A later separately authorized R7
repair must:

1. Rework `CBA2-SC-065(c)`, `(g)`, `(h)`, `(h77)`, and the
   `CBA2-SC-065(i)`–`(k)` partial-waiver selection cases so ordinary waiver
   processing, explicit per-claim validity, actual versus creatable Room,
   trade exclusion, winner selection, and award-time creation are exact.
2. Recheck `CBA2-SC-066(a)`, `(c)`, `(h32)`, and `(h78)` against the
   completed buyout/stretch/set-off source chains.
3. Recheck `CBA2-SC-072(a)` and `(h39)` against unnumbered CBA XXIX §1.
4. Rework `CBA2-SC-076(a)`, `(h)`, and `(h41)` so draft-rights assignment
   does not assert immediate CBA timing and the Assignment Transaction window
   does not assert unsupported lottery or draft-day authority.
5. Recheck `CBA2-SC-077(c)` using Article X for retained draft rights and
   Article XI only for UFA/RFA status.
6. Add exact positive/adverse cases for `CBA2-R01.46`–`.51`, including all
   nine semantic probes and every directly affected consequence edge, without
   changing this R6 source-certified material absent a new source defect.

R7 remains blocked pending focused independent acceptance of this corrected R6
material.

## Unsupported or removed source conclusions

No unsupported conclusion remains active within the corrected scope. The
following broader conclusions were removed instead of being forced through an
unqualified source class:

- By-Laws §§5.03–5.05 do not establish general Player List room, Salary Cap
  room, or exception authority, and §4.05(e) applies only to Trade Calls.
- CBA Article X §7 does not establish that unsigned draft rights are
  immediately assignable; only assignment in accordance with NBA procedures
  and post-assignment continuity remain direct-CBA results.
- The inspected hash-matched CBA places the defined Moratorium provision in
  Article II §15, not Article VII §9. By-Laws §4.01(a) directly controls the
  Assignment Transaction Moratorium bar used by the narrowed rule. Lottery and
  draft-day timing are not retained without qualifying authority.

## Validation

- Hash verification: both official primary-source artifacts matched the exact
  required byte sizes and SHA-256 values before inspection.
- Register reconciliation: 61 GROUPs, 815 active LEAFs
  (151 A, 417 C, 118 R, 102 L, 27 S), 815 detail rows, and 823 EV2 records.
  The graph contains 744 current dependency edges globally and 245 in the
  247-LEAF R/L/S subset, with zero missing dependencies and zero cycles.
- Direct-source census: 665 current direct `CBA`/`BYL` evidence records and
  zero syntactically missing printed-page locators.
- Focused proposition checks: all nine named evidence records passed their
  corrected proposition and locator assertions.
- Validity/dependency checks: `CBA2-R01.51` owns the complete per-claim result;
  `CBA2-R01.16` consumes it; every named selected/successful downstream result
  reaches that selection owner; the Room lifecycle remains acyclic.
- Targeted semantic probes: 9/9 PASS, including all three amount bounds,
  insufficient Room, trade exclusion, claimant and procedure ineligibility,
  lower-valid-over-higher-invalid selection, and creatable-Room award timing.
- R7 preservation: byte-identical to `1d33b699f56a961ca080ee7a03c55b194df26252`
  for the active v2 scenario section through the §17 heading; 698,101 bytes,
  SHA-256 `6f200b6ba78fae0bdb15776232e1ab5078d47d5c6b565d18e6f202c60a280aba`.
- `npm run test:diff -- --files docs/reference/cba/ARCHITECT_CBA_CANON.md work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md work/architect-completion/ARCHITECT_CBA_CANON_V2_R9_R6_SECOND_FOCUSED_REPAIR.md --reporter=dot`:
  PASS, FAST tier, 12 files and 57 tests.
- Targeted Markdown lint for the three authorized files with `MD029` disabled:
  PASS. `MD029` is excluded because the byte-identical historical scenario
  list retains the same 74 pre-existing ordered-list findings. The repo-wide
  `npm run lint:md` remains nonzero on that baseline plus unrelated Markdown
  backlog; no unrelated document was changed.
- `npm run validate:project`: PASS.
- `git diff --check`: PASS before the frozen-validator execution and will be
  repeated after its result is recorded.
- Frozen validator: its single permitted execution passed all 238/238 cases
  (20 accepting controls and 218 rejecting regressions), with
  `baseline_clean=yes`, zero failures, a successful knowingly-wrong-expectation
  negative self-test, and successful cache-isolation self-checks.
- Full application suite: intentionally not run because `RUN FULL SUITE` was
  not authorized.
