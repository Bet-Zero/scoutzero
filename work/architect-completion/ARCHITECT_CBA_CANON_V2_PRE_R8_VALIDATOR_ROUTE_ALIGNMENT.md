# Architect CBA Canon v2 Pre-R8 Validator-Route Alignment

**Status:** bounded maker alignment complete; not independently accepted.

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

One positive current-route control and 18 focused rejecting controls were
added. They reject omission of each accepted prerequisite; incomplete R7;
standalone R7 review; missing independent R9 scenario review; each R8
exclusion independently; unpinned, dirty, unpushed, non-topic-branch, or
checksum-free R9 candidates; and either one-sided Phase 1 close gate. The
corrected population is 142 controls: 15 accepting and 127 rejecting. Every
control passes on its expected result and every rejecting route control
matches its intended diagnostic. The deliberate wrong-expectation self-test
still fails, proving the harness is not acceptance-rigged.

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

Validation is recorded against the final three-file worktree before commit:

- exact starting checkpoint, parent, `main`, synchronization, cleanliness,
  and four starting blobs: matched;
- baseline bounded validator: exactly seven route diagnostics, all 123
  controls correct, and negative self-test successful;
- corrected bounded validator development run: 142 of 142 controls correct,
  zero baseline problems, negative self-test successful;
- targeted validator diff review: non-route logic unchanged;
- two complete final bounded validator runs: identical output, 142 of 142
  controls correct, zero baseline problems, and negative self-test
  successful;
- targeted Markdown lint for this receipt and the repair plan: passed;
- `npm run docs:guardrails`: passed;
- `npm run validate:project`: passed;
- `git diff --check`: passed; and
- exact final scope: the repair plan, validator, and this receipt only.
