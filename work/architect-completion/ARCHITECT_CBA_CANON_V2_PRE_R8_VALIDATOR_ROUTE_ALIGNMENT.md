# Architect CBA Canon v2 Pre-R8 Validator-Route Alignment

**Status:** bounded maker alignment plus focused polarity, semantic-order,
deterministic-contract, and structural-integrity corrections complete; not
independently accepted.

## Boundary and starting checkpoint

This alignment began from the clean, synchronized
`architect/cba-canon-v2` checkpoint
`e59d0dcc0ef2bf794920805c9fc3d549342e376c`, whose direct parent is the
accepted R6 checkpoint
`802ae2cf795edd1e2dbc29f6ae4bd4b134ab3777`. Stable `main` remained
`69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`.

The verified starting blobs were:

- Canon: `5e8a57c3f90c3033cec80516d51a859d108f484d`
- Repair plan: `7df0cbec5779298bfee17e3df834771e9a9c93e4`
- R7 receipt: `a411aba2d56fbdf3fc55c2b5fc750c9705aca0d9`
- Frozen validator: `67c552bc3e3959cc3e5d3816d17f8bf6a1063a54`

The bounded validator reproduced 123 correctly behaving controls
(14 accepting and 109 rejecting), a successful negative self-test, and
exactly these seven baseline plan-route diagnostics:

1. R5 did not require independent R4 acceptance.
2. R6 did not require independent R5 acceptance.
3. R7 did not require independent acceptance of R3.1 and R4–R6.
4. R8 did not depend on an independently accepted R7.
5. R8 did not explicitly exclude README, code-map, runtime, and Phase 2
   expansion.
6. R9 input was not recognized as a pinned clean topic-branch checkpoint.
7. R9 did not require reviewer plus owner acceptance.

There were no other baseline diagnostics.

## Route correction

The fourth diagnostic encoded an obsolete process expectation. The approved
current route intentionally has no standalone independent R7 checker and no
overlapping independent R8 checker. R7 is a completed maker unit; R8 performs
final maker reconciliation and checksum; R9 is the single independent
whole-canon review and includes R7 scenario truth and sufficiency. Nothing in
this alignment states or implies that R7 received an independent checker
ACCEPT.

The repair plan now:

- states independent R4 acceptance before R5 and independent R5 acceptance
  before R6;
- preserves accepted R3.1/R4/R5/R6 as R7 prerequisites;
- requires completed R7 before R8 while expressly retaining the
  no-standalone-R7/no-overlapping-R8-checker route;
- names every R8 README, code-map, application/runtime-inspection, and Phase 2
  exclusion directly;
- pins R9 to the exact clean, pushed R8 topic-branch checkpoint and checksum;
  and
- requires both R9 ACCEPT and explicit owner acceptance to close Phase 1.

The validator replaces exact magic-phrase matching only in the R5–R9
plan-route checks. It parses the governed route fields and evaluates their
prerequisites, completion state, exclusions, candidate state, independent R9
scenario scope, and two-part owner gate semantically. The historical
accepted-status control-tree route remains validated under its historical
maker/checker model; its pointer and chronology are unchanged.

The preceding unaccepted maker checkpoint
`ce1533d5a73b3f2aa65270c43f0cacfbfc917382` added one positive current-route
control and 18 focused rejecting controls. They reject omission of each
accepted prerequisite; incomplete R7; standalone R7 review; missing
independent R9 scenario review; each R8 exclusion independently; unpinned,
dirty, unpushed, non-topic-branch, or checksum-free R9 candidates; and either
one-sided Phase 1 close gate. That checkpoint's population was 142 controls:
15 accepting and 127 rejecting. It remained a maker checkpoint and was not
independently accepted.

## Focused polarity correction

This follow-up began from the clean, synchronized
`ce1533d5a73b3f2aa65270c43f0cacfbfc917382` checkpoint with these verified
blobs:

- Canon: `5e8a57c3f90c3033cec80516d51a859d108f484d`
- R7 receipt: `a411aba2d56fbdf3fc55c2b5fc750c9705aca0d9`
- Repair plan: `32ddbe1b033741066f50076b202214cfc4916e43`
- Validator: `a16639409f61c54f3607b19cb872f48a2ace192d`
- This receipt: `8bfba5a4d110372e397e00731b869d77ddd6753d`

The real `check_plan` path had zero problems for the current plan but also
false-accepted each of these direct polarity inversions with zero problems:

1. R4 was not independently accepted before R5.
2. R7 was not complete, but R8 could begin.
3. No standalone-R7-checker ban applied and R7 received that checker.
4. Scenario truth and sufficiency were not reviewed.
5. Every governed R8 excluded surface was allowed.
6. The R9 candidate need not be clean or pushed.
7. R9 ACCEPT or explicit owner acceptance could close Phase 1.

The same path also false-accepted direct non-acceptance of R5 before R6,
direct non-acceptance of all R3.1/R4/R5/R6 prerequisites before R7, and
optional checksum, clean, pushed, or topic-branch state for the R9 candidate.
The narrower "begin without independent acceptance" R6/R7 forms and the
"either gate is sufficient" form already rejected before this repair and
remain protected.

After correction, every named inversion produces only its directly relevant
route diagnostic. The R5–R9 helpers now:

- reject negated, optional, omitted, or contradictory independent acceptance;
- require affirmative R7 completion before R8;
- recognize a real standalone-R7-checker prohibition and separately reject an
  affirmative standalone-checker clause;
- require affirmative independent assessment of scenario truth/accuracy and
  sufficiency/adequacy;
- require a clause-level prohibition for every R8 excluded surface and reject
  allowance inversions;
- require affirmative pinned/exact, clean, pushed/remote-synchronized,
  topic-branch, checkpoint/commit, and checksum/digest candidate state; and
- require a both-and conjunction for R9 ACCEPT plus explicit owner acceptance,
  rejecting `or`, `either`, optionality, and one-sided sufficiency.

Nine accepting paraphrase controls prove those checks are not tied to the
current plan's exact sentences. Eighteen rejecting polarity controls cover the
governed propositions and contradiction forms. All existing 142 controls
remain present and passing. The final population is 169 controls: 24
accepting and 145 rejecting. Every rejection matches its intended diagnostic,
and the deliberate wrong-expectation self-test still fails, proving the
harness is not acceptance-rigged.

## Focused semantic-order correction

This follow-up began from the clean, synchronized, unaccepted maker checkpoint
`d29fff1f6ee31579219def2e01c6614b0a7d31c8` with these verified blobs:

- Canon: `5e8a57c3f90c3033cec80516d51a859d108f484d`
- R7 receipt: `a411aba2d56fbdf3fc55c2b5fc750c9705aca0d9`
- Repair plan: `32ddbe1b033741066f50076b202214cfc4916e43`
- Validator: `097001f107a07ff44b49836b2f7d322d7974535b`
- This receipt: `a8497c751bcfd0e4fffe26979f9addc586df99a5`

The real `check_plan` path still returned zero problems for every one of these
controlled semantic-order inversions:

1. Independent R4 acceptance was not necessary before R5.
2. R7 completion was not mandatory before R8.
3. A standalone independent R7 checker was not prohibited.
4. Independent scenario truth and sufficiency review was not mandatory.
5. Every governed R8 surface was not prohibited.
6. All required R9 candidate attributes were not necessary.
7. Both Phase 1 close gates were not necessary.
8. R4 was independently accepted after R5 began.
9. R5 was independently accepted after R6 began.
10. R3.1 and R4–R6 were independently accepted after R7 began.
11. R7 completed after R8 began.
12. R5 could begin before independent R4 acceptance.
13. R8 could begin before R7 completion.
14. The maker reviewed scenario truth and sufficiency.
15. Scenario truth and sufficiency received a non-independent review.

These false accepts shared three bounded causes: obligation nouns could still
be weakened by necessity/advisory wording; prerequisite and downstream nouns
could appear in reverse chronological order; and scenario-review nouns could
transfer ownership away from the independent R9 reviewer.

The focused correction adds:

- one shared controlled-vocabulary weakener guard for non-mandatory,
  advisory, preferred, omitted, skipped, ignored, or disregarded duties;
- small prerequisite-order checks that reject acceptance or completion after
  downstream construction and downstream construction before the
  prerequisite; and
- consistency-scope ownership checks that require the independent R9 reviewer
  explicitly or through the section's governed reviewer role, while rejecting
  maker-only and expressly non-independent review.

The implementation remains proposition-aware rather than sentence-specific.
Nine new accepting controls exercise `follows`, `starts only after`,
`unauthorized`, independent-reviewer, forbidden/outside/prohibited, mandatory
candidate-state, and required/necessary gate wording. Twenty-four new
rejecting controls cover the 15 reproduced cases plus `not essential`, `not a
prerequisite`, recommended/advisory/preferred duties, and omit/skip/ignore/
disregard forms. All previous 169 controls remain present and passing.

The expanded population is 202 controls: 33 accepting and 169 rejecting.
Every negative control matches its directly relevant route diagnostic, the
current plan has zero baseline diagnostics, and the deliberate
wrong-expectation self-test still fails.

## Preservation

No Canon, rule, source, evidence, scenario, lineage, prior receipt, checker
record, parser, registry rule, scenario gate, amendment check, preservation
anchor, non-route control, or accepted-status control-tree pointer changed.
A zero-context validator diff confines all modifications to route-field
helpers, the R5–R9 plan-route block, directly related comments, and the new
route controls.

R7 remains complete at
`e59d0dcc0ef2bf794920805c9fc3d549342e376c`. R8 remains unstarted. Phase 2,
W1.1, application work, Linear, and `main` remain blocked and untouched.

## Validation

Validation is recorded against the final two-file worktree before commit:

- exact starting checkpoint, parent, `main`, synchronization, cleanliness,
  and required starting blobs: matched;
- baseline bounded validator: exactly seven route diagnostics, all 123
  controls correct, and negative self-test successful;
- preceding bounded validator maker run: 142 of 142 controls correct, zero
  baseline problems, negative self-test successful;
- focused before/after probes through `check_plan`: all stated false accepts
  reproduced before correction and rejected afterward on the relevant
  diagnostic;
- preceding polarity-corrected validator run: 169 of 169 controls correct,
  zero baseline problems, negative self-test successful;
- semantic-order before/after probes through `check_plan`: all 15 false
  accepts reproduced before correction and rejected afterward on the relevant
  diagnostic;
- corrected bounded validator development run: 202 of 202 controls correct,
  zero baseline problems, negative self-test successful;
- targeted validator diff review: non-route logic unchanged;
- two complete final bounded validator runs: identical output, 202 of 202
  controls correct, zero baseline problems, and negative self-test
  successful;
- targeted Markdown lint for this receipt: passed;
- `npm run docs:guardrails`: passed;
- `npm run validate:project`: passed;
- `git diff --check`: passed; and
- exact final scope: the validator and this receipt only.

## Final deterministic-contract correction

This final maker correction began from the clean, synchronized, unaccepted
checkpoint `06e8b219797dba4ccc257ad2341387d8899ed93d`, whose direct parent
is `d29fff1f6ee31579219def2e01c6614b0a7d31c8`. Stable `main` remained
`69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`.

The verified starting blobs were:

- Canon: `5e8a57c3f90c3033cec80516d51a859d108f484d`
- R7 receipt: `a411aba2d56fbdf3fc55c2b5fc750c9705aca0d9`
- Repair plan: `32ddbe1b033741066f50076b202214cfc4916e43`
- Validator: `535bfb4a838f33ea4925dcdf22ab3f8c8892ef43`
- This receipt: `332810445ab9e48dfa56eb6a4095bc0787a1ad58`

The current plan returned zero `check_plan` problems, but the same real path
also returned zero problems for all ten remaining design-defect mutations:

| Case | Frozen field | Before | After |
| --- | --- | --- | --- |
| 1 | R5 Dependency | zero problems | R5 independent-R4 diagnostic |
| 2 | R6 Dependency | zero problems | R6 independent-R5 diagnostic |
| 3 | R7 Dependency | zero problems | R7 prerequisite diagnostic |
| 4 | R8 Dependency | zero problems | R8 completed-R7 diagnostic |
| 5 | R9 Consistency scope | zero problems | R9 independent-scenario diagnostic |
| 6 | R9 Consistency scope | zero problems | R9 independent-scenario diagnostic |
| 7 | R9 Owner gate | zero problems | R9 reviewer-plus-owner diagnostic |
| 8 | R8 Exclusions | zero problems | R8 exclusions diagnostic |
| 9 | R9 Inputs | zero problems | R9 pinned-candidate diagnostic |
| 10 | R7 Review boundary | zero problems | R7 standalone-checker diagnostic |

Each after-result consists of exactly one directly relevant route diagnostic.
The permissive semantic matchers were therefore superseded for the
completed-R7 current route: recognizing vocabulary cannot make a controlled
contract deterministic. The historical accepted-status control-tree path
retains its existing semantic maker/checker validation model and pointer.

### Frozen current-route values

Normalization removes only Markdown decoration and collapses whitespace and
line wrapping. It does not normalize wording, punctuation, case, ordering,
added clauses, or omitted clauses. The approved normalized values are:

1. **R5 Dependency**

   > R4 was independently accepted at its exact checker checkpoint before R5
   > began. This process revision is committed and pushed from that accepted
   > R4 status baseline, and the branch is clean and synchronized.

2. **R6 Dependency**

   > R5 was independently accepted at an exact commit-specific checker
   > checkpoint before R6 began.

3. **R7 Dependency**

   > R3.1, R4, R5, and R6 each have an independent commit-specific ACCEPT for
   > their rule content.

4. **R7 Review boundary**

   > R7 has no duplicative standalone independent acceptance pass. The single
   > final R9 reviewer independently judges scenario truth and sufficiency as
   > part of whole-canon acceptance.

5. **R8 Dependency**

   > accepted R3.1/R4/R5/R6 rule checkpoints and a completed R7 scenario
   > checkpoint. R7 maker completion is required before R8; no standalone R7
   > checker or overlapping R8 checker is required or authorized.

6. **R8 Exclusions**

   > no README edit or expansion; no code-map edit or expansion; no
   > application or runtime inspection or change; no Phase 2 packet, work, or
   > verdict; and no Architect comparison, data/configuration change, Linear,
   > or main.

7. **R9 Inputs**

   > the pinned exact, clean, pushed R8 topic-branch checkpoint and checksum.
   > R9 does not require or authorize a merge to main.

8. **R9 Consistency scope**

   > confirm stable and atomic active rule IDs, dependency and evidence
   > closure, source quality, truthful unsupported items, complete
   > old-rule-to-current-rule mapping, material scenario truth and
   > sufficiency, and consistency across the independently accepted unit
   > checkpoints.

9. **R9 Owner gate**

   > R9 ACCEPT is necessary but not sufficient. Present one concise
   > owner-facing Phase 1 summary with the accepted checkpoint, coverage and
   > source status, material limitations or unsupported items, scenario scope,
   > and validation result. Only explicit owner acceptance closes Phase 1
   > after R9 ACCEPT and can authorize a separately scoped Phase 2. Both R9
   > ACCEPT and explicit owner acceptance are required. Until then, the
   > Architect comparison, application fixes, W1.1, Linear changes, and Phase
   > 2 remain blocked.

The validator hashes the ordered field name plus normalized value pairs. The
deterministic SHA-256 contract hash is
`b0c97d74d1426a323101155d61ebb86d2c42d6f66023ba383173e797db0a8cc1`.
The plan records the same hash and states that these fields remain frozen
through Phase 1 closure. Any intentional route change must update the plan
and validator together and receive independent review.

### Control migration and preservation

Of the preceding 202 controls, 184 remain unchanged: 15 accepting and 169
rejecting. The 18 current-route paraphrase acceptances were explicitly
superseded one-for-one, retaining their IDs as deterministic rejecting
controls:

- `RP-A1`–`RP-A4` cover reproduced cases 1–4;
- `RP-A5` covers reproduced case 10;
- `RP-A6`–`RP-A9` cover reproduced cases 5 and 7–9;
- `SO-A1` covers reproduced case 6; and
- `SO-A2`–`SO-A9` cover changed ordering, weakened duty, a contradictory
  second clause, unauthorized paraphrase, punctuation drift, case drift,
  truncation, and added route text.

Nine new `DC-O1`–`DC-O9` rejecting controls omit each frozen field
individually. Two new `DC-A1`–`DC-A2` accepting controls prove that
Markdown-decoration-only and whitespace/line-wrap-only differences remain
valid. The final population is 213 controls: 17 accepting and 196 rejecting.
All controls pass, every rejection matches its intended diagnostic, and the
deliberate wrong-expectation self-test still fails.

The plan change adds only the concise frozen-contract statement; none of the
nine approved field values changed. The validator change is confined to the
central current-route contract, normalization and hash, current-route
equality checks, and directly related controls. All parsers, registry rules,
Canon/source/evidence/scenario/lineage logic, preservation anchors,
non-route controls, and the historical accepted-status control-tree logic and
pointer remain unchanged.

No Canon, R7 receipt, prior receipt, checker record, rule, source, evidence,
scenario, or lineage content changed. R7 remains complete at
`e59d0dcc0ef2bf794920805c9fc3d549342e376c`; R8 remains unstarted. Phase 2,
W1.1, application work, Linear, Graphify, and `main` remain blocked and
untouched.

## Final deterministic-contract validation

Validation is recorded against the final three-file worktree before commit:

- exact starting repository, branch, checkpoint, parent, stable `main`,
  upstream synchronization, cleanliness, and all five starting blobs:
  matched;
- real-path before/after probes: all ten zero-problem false accepts reproduced
  before correction and each rejected afterward by exactly one directly
  relevant route diagnostic;
- current plan: zero baseline diagnostics;
- deterministic contract hash: matched the plan, validator, and receipt;
- bounded development run: 213 of 213 controls correct, zero baseline
  problems, and negative self-test successful;
- control accounting: 184 retained unchanged, 18 paraphrase acceptances
  superseded one-for-one, and 11 new controls;
- targeted validator diff review: non-route logic unchanged;
- two complete final bounded validator runs: byte-identical output, 213 of
  213 controls correct, zero baseline problems, and negative self-test
  successful;
- targeted Markdown lint for the plan and this receipt: passed;
- `npm run docs:guardrails`: passed;
- `npm run validate:project`: passed;
- `git diff --check`: passed; and
- exact final scope: the repair plan, validator, and this receipt only.

## Structural-integrity correction

This correction began from the clean, synchronized, unaccepted maker
checkpoint `070ac670d4842fa25676c4b4fb61463955a67cb4`, whose direct parent
is `06e8b219797dba4ccc257ad2341387d8899ed93d`. Stable `main` remained
`69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`.

The verified starting blobs and bounded result were:

- Canon: `5e8a57c3f90c3033cec80516d51a859d108f484d`
- R7 receipt: `a411aba2d56fbdf3fc55c2b5fc750c9705aca0d9`
- Repair plan: `f5debd1ab77b838999c81ff2dc153b062ef2c2e7`
- Validator: `725c02ef27e6352301752e70bdab400fbba6c33d`
- This receipt: `70839c28d1af9b65a32caa7d766e1e0057ee5152`
- Contract SHA-256:
  `b0c97d74d1426a323101155d61ebb86d2c42d6f66023ba383173e797db0a8cc1`
- Bounded validator: 213 controls, 17 accepting and 196 rejecting, zero
  baseline diagnostics, successful negative self-test, and output SHA-256
  `c5f5dba51d8e49ac8dcc4b44df5f70f11006684923e206f8de02707528def81a`

### Reproduced structural false accepts

The actual starting `check_plan` path returned zero problems for each
structural mutation:

| Mutation | Before | After |
| --- | --- | --- |
| Duplicate R5 Dependency | zero problems | exact-one R5 Dependency diagnostic |
| Duplicate R6 Dependency | zero problems | exact-one R6 Dependency diagnostic |
| Duplicate R7 Dependency | zero problems | exact-one R7 Dependency diagnostic |
| Duplicate R7 Review boundary | zero problems | exact-one R7 Review-boundary diagnostic |
| Duplicate R8 Dependency | zero problems | exact-one R8 Dependency diagnostic |
| Duplicate R8 Exclusions | zero problems | exact-one R8 Exclusions diagnostic |
| Duplicate R9 Inputs | zero problems | exact-one R9 Inputs diagnostic |
| Duplicate R9 Consistency scope | zero problems | exact-one R9 Consistency-scope diagnostic |
| Duplicate R9 Owner gate | zero problems | exact-one R9 Owner-gate diagnostic |
| Duplicate R5 section heading | zero problems | exact-one R5-section diagnostic |
| Duplicate R6 section heading | zero problems | exact-one R6-section diagnostic |
| Duplicate R7 section heading | zero problems | exact-one R7-section diagnostic |
| Duplicate R8 section heading | zero problems | exact-one R8-section diagnostic |
| Duplicate R9 section heading | zero problems | exact-one R9-section diagnostic |
| Renamed R7 status plus historical R8 wording | zero problems | frozen R8 Dependency diagnostic |
| Removed R7 status plus historical R8 wording | zero problems | frozen R8 Dependency diagnostic |
| Weakened R7 status plus historical R8 wording | zero problems | frozen R8 Dependency diagnostic |
| Wrong declaration hash | zero problems | declaration-hash diagnostic |
| Missing declaration | zero problems | exact-one declaration diagnostic |
| Renamed declaration | zero problems | exact-one declaration diagnostic |
| Conflicting duplicate declaration | zero problems | exact-one declaration diagnostic |
| Weakened declaration state | zero problems | declaration-state diagnostic |

Each after-result is one directly relevant structural or frozen-field
diagnostic. The three root causes were:

1. the route-field parser returned only the first matching label and did not
   expose duplicates;
2. current-versus-historical validation was selected through mutable English
   in the R7 status paragraph; and
3. the frozen-contract statement and hash were informative prose rather than
   a validated structural declaration.

### Structural contract

The plan now carries exactly one machine-shaped declaration:

- version: `CBA-CANON-V2-R5-R9/1`
- state: `frozen-through-phase-1-closure`
- SHA-256:
  `b0c97d74d1426a323101155d61ebb86d2c42d6f66023ba383173e797db0a8cc1`

The validator requires exactly one R5, R6, R7, R8, and R9 section heading;
exactly one occurrence of every controlled field in its authorized section;
and exactly one declaration with that version, state, and hash. Cardinality
is established before value comparison, so an exact first copy cannot hide a
contradictory second copy.

Current-versus-historical selection no longer reads plan prose. The live
validator derives current context from trusted Git chronology beginning at
the completed R7 checkpoint
`e59d0dcc0ef2bf794920805c9fc3d549342e376c`. The complete control harness
passes the same explicit current context outside the mutated document.
Genuine historical accepted-status trees retain their historical context and
unchanged semantic maker/checker checks.

The nine approved normalized field values and their ordered hash algorithm
are unchanged. Only the declaration around them changed. Markdown decoration,
whitespace, and line wrapping remain the sole permitted normalizations.
Ordinary non-contract R8 status and R9 receipt prose remains addable outside
the controlled fields.

### Expanded controls

All preceding 213 controls remain present with their intent preserved. Of
those, 204 are unchanged control definitions; the nine existing field-
omission controls retain their mutations and rejecting intent but now expect
the more precise exact-one-field diagnostic.

Twenty-five controls were added:

- nine duplicate-field rejections;
- five duplicate-section-heading rejections;
- five missing, renamed, duplicated, weakened-state, or wrong-hash
  declaration rejections;
- three current-mode downgrade rejections with historical-looking R8
  wording;
- two acceptances for ordinary non-contract R8/R9 status or receipt prose;
  and
- one acceptance proving a genuine historical accepted-status tree remains
  on its historical path.

The two prior Markdown/whitespace normalization acceptances remain present.
The final population is 238 controls: 20 accepting and 218 rejecting. Every
control passes, every rejection matches its intended diagnostic, the current
plan has zero baseline diagnostics, and the deliberate wrong-expectation
self-test still fails.

No Canon, R7 receipt, prior receipt, checker record, rule, scenario, source,
evidence, lineage, parser outside the bounded plan-route surface,
preservation anchor, or non-route control changed. R7 remains complete at
`e59d0dcc0ef2bf794920805c9fc3d549342e376c`. R8 remains unstarted. The
cumulative pre-R8 alignment remains maker work pending independent review.
Phase 2, W1.1, application work, Linear, Graphify, and `main` remain blocked
and untouched.

## Structural-integrity validation

Validation is recorded against the final three-file worktree before commit:

- exact repository, branch, starting checkpoint, parent, completed-R7
  checkpoint, stable `main`, upstream synchronization, cleanliness, five
  starting blobs, contract hash, and starting bounded output: matched;
- before/after structural probes: all stated false accepts reproduced and
  each rejected after correction through its directly relevant diagnostic;
- Python compilation: passed;
- independently recomputed nine-field contract hash: matched;
- current plan: zero baseline diagnostics;
- expanded development run: 238 of 238 controls correct, 20 accepting and
  218 rejecting, negative self-test successful;
- current/historical route-selection probes: passed;
- targeted historical and non-route preservation review: unchanged;
- two complete final bounded runs: byte-identical output, 238 of 238 controls
  correct, zero baseline diagnostics, and negative self-test successful;
- targeted Markdown lint for the plan and this receipt: passed;
- `npm run docs:guardrails`: passed;
- `npm run validate:project`: passed;
- `git diff --check`: passed; and
- exact final scope: the repair plan, validator, and this receipt only.
