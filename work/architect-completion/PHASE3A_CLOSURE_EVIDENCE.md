---
name: PHASE3A_CLOSURE_EVIDENCE.md
description: BZE-265 source-derived W1-W15 closure evidence map and exact-head integration record.
---

# Phase 3A Closure Evidence (BZE-265)

**Status:** stopped on a source-derived nonzero trade-bonus presentation defect.
**Required base:** `0f33acfa3388971ac9015133aaf876f52dfd4be9`.
**Closure branch:** `feature/bze-265-phase3a-closure-integration-proof`.
**Draft PR:** #517.

The worktree was returned to clean synchronized `main` at the required base
before this branch resumed. Hosted base CI run `33200095176` passed at that
exact commit. Current main includes completed foundations BZE-294 / PR #518 and
BZE-295 / PRs #519 and #520. BZE-289, BZE-294, and BZE-295 remain Done. No
product, CBA, schema, persistence, Canon, governed-source, or completed-child
implementation is changed in this lane.

## Locked authority boundary

The V1 completion contract now records the owner's 2026-08-27 decision:

1. `CBA2-A12.3` resolves from the authenticated pinned accepted Canon. A
   draft-asset verdict for which complete governed ownership, protection,
   conveyance, freeze, unfreeze, penalty, or required-transition history is
   missing must fail closed. It unblocks only when retained certified governed
   history supplies the complete lifecycle required by the proposed branch.
2. An ordinary trade requiring a nonzero trade bonus must fail closed when the
   retained contract evidence lacks authenticated bonus basis, allocation,
   amendment/trade history, or payment timing. It unblocks only through a new
   immutable, hash-verified and certified contract-source release containing
   those fields.

The exclusions do not remove ordinary governed trades, supported second-round
picks or entitlements, cash, or previously established draft rules from V1.
No Phase 3B implementation issue was created.

## Expectation oracle

The expectation was recorded before executing the product discriminator.

- Accepted Canon candidate:
  `6cf8aaf358c158a88e630e8a7336f7e9c3febc17`.
- Accepted Canon SHA-256:
  `23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76`.
- Authenticated Stepien authority: `CBA2-A12.3` / `EV2-0086` and `EV2-0087`.
- Relevant fail-closed leaves: `CBA2-L09.2`, `CBA2-L09.3`, `CBA2-L09.6`, and
  `CBA2-A12.4`.
- Unsupported input: LAL sends its 2027 first-round ownership entitlement with
  no authenticated branch-complete ownership, protection, conveyance,
  freeze, unfreeze, or penalty history. Expected verdict: fail closed; no legal
  or success result.
- Supported control: LAL sends its clean 2027 second-round ownership
  entitlement. Expected rule result: supported; missing first-round lifecycle
  history must not weaken this path.

There is no amount or threshold arithmetic in this discriminator. The result is
a governed-history availability decision, not an application-derived
calculation.

## Source-derived expectations recorded before browser execution

The executable oracle is
`tests/e2e/fixtures/phase3aClosureExpectations.ts`. It was recorded before the
current browser diagnostic. These values were taken only from the pinned
accepted Canon or the named retained governed records:

| Boundary | Pre-execution expectation | Source identity |
| --- | --- | --- |
| 2026-27 system levels | Salary Cap `$164,961,000`; minimum Team Salary `$148,465,000`; Tax `$200,428,000`; First Apron `$209,015,000`; Second Apron `$221,686,000` | `GOV-LVL-0001`–`GOV-LVL-0005`; `CBA2-S01.3/.4/.9` |
| 2026-27 calendar | Regular Season opens `2026-10-20` and closes `2027-04-11` | `GOV-CAL-0002`; `CBA2-L01.2/.8/.9` |
| Acceptance roster | `15` Standard plus `3` Two-Way; C03.2 threshold `12`; zero-YOS Minimum `$1,357,763` | retained governed season/minimum records; `CBA2-C03.1/.2`, `CBA2-C07.11` |
| Waive and stretch | `$31,000,000` over two remaining Seasons becomes `2×2+1=5` charges of `$6,200,000` | `CBA2-R04.1/.2/.3` |
| Buyout | `$31,000,000 - $5,000,000 = $26,000,000` remaining guaranteed salary | retained contract fixture plus `CBA2-R04.1/.2/.3` |
| Other-team FA signing | `$4,800,000 - $1,357,763 = $3,442,237` cap-space decrease because one C03.2 slot is released | retained signing fixture plus governed zero-YOS Minimum |
| Offer Sheet | `48`-hour matching window | `CBA2-L04.3` |
| Sign-and-trade | at least `3` non-Option Seasons; receiving Team hard-capped at First Apron `$209,015,000` | `CBA2-A07.1/.2/.4` plus `GOV-LVL-0004` |
| Ordinary trade controls | room allowance `$250,000`; proof cash `$1.00`; First/Second Aprons as above | `CBA2-A02.9/.10/.12`; governed system levels |
| Stepien exclusion | authenticated `CBA2-A12.3`; missing governed ownership/protection/conveyance/freeze/unfreeze/penalty history means `NEEDS_INPUT`, unevaluated, false, no write | `EV2-0086`, `EV2-0087`, `CBA2-L09.2/.3/.6`, `CBA2-A12.4` |
| Supported pick control | clean second-round ownership path remains `PASS`, evaluated, true | accepted Canon boundary plus current-main discriminator |
| Trade-bonus exclusion | retained Austin Reaves `15%` kicker with `missing-bonus-allocation` means visible `Needs input`, Apply disabled, no write | `salaryswish-retained-2026-06-05@v1`, digest below |

The nonzero-bonus expectation remains independently anchored to retained
release `salaryswish-retained-2026-06-05@v1`, digest
`sha256:46db3137308ff1c05e0066edf09ef08d45b92353bea7a2bcec93fd408adf5950`.
Its Austin Reaves record retains a 15% kicker but identifies
`terms.bonuses` as `missing-bonus-allocation`; no bonus amount may be invented.

## Historical discriminator and completed repair

Configured exact-source probe:

```text
npm run review:probe -- \
  --candidate c560bd54bbe3b8020b73bd7283652a3e7e15e876 \
  --fixture scripts/review/probes/stepienAuthorityClosureProbe.ts
```

This exact pushed historical candidate contains the contract decision, the
original discriminator, and the first evidence matrix. Its product tree was
unchanged from its then-required base. The failure below is preserved only to
explain why BZE-294 was required; it is not the current blocker or result.

Observed unsupported result:

```json
{
  "passed": true,
  "violations": [],
  "warnings": [],
  "message": "Stepien Rule compliant",
  "baselineYearsCount": 1,
  "outgoingYearsCount": 1
}
```

Observed supported second-round control: `passed: true`, with no violations or
warnings. The control confirms that the required repair can preserve the
supported path; it does not excuse the unsupported first-round success result.

The probe failed its source-derived assertion exactly as intended:

```text
AssertionError: missing CBA2-A12.3 and branch-complete first-round history
must fail closed
true !== false
```

The configured probe ran from an immutable candidate snapshot, cleaned its
temporary workspace, and left the source worktree unchanged. This was a product
defect, not an application-output re-baseline: the product returned a legal
Stepien verdict where missing lifecycle history required a blocked verdict.

BZE-294 / PR #518 repaired the fail-open result. BZE-295 / PR #519 then made
composite accepted-Canon leaves resolve and corrected A12.3 provenance, and
PR #520 added strict persisted v1/v2 boundary reading with malformed and sparse
array rejection. On current main the fresh discriminator must require:

- first round: `status: NEEDS_INPUT`, `evaluated: false`, `passed: false`;
- missing inputs exactly `governedDraftHistory.ownership`, `.protection`,
  `.conveyance`, `.freeze`, `.unfreeze`, and `.penalty`;
- no `acceptedCanon.CBA2-A12.3` missing input and no affirmative legality copy;
- second-round control: `status: PASS`, `evaluated: true`, `passed: true`.

Fresh current-main probe:

```text
npm run review:probe -- \
  --candidate 0f33acfa3388971ac9015133aaf876f52dfd4be9 \
  --fixture scripts/review/probes/stepienAuthorityClosureProbe.ts
```

Result: **PASS**. The unsupported first-round result was `NEEDS_INPUT`,
`evaluated:false`, `passed:false`, carried exactly the six governed-history
inputs above, omitted `acceptedCanon.CBA2-A12.3`, and contained no affirmative
legality copy. The supported second-round result was `PASS`, `evaluated:true`,
`passed:true`, with no missing inputs.

## Current browser stop: nonzero trade-bonus visibility

The full-roster browser discriminator reached the retained nonzero-bonus
boundary after the repaired first-round exclusion passed visibly with Apply
disabled and no Team or event write. The bonus proposal used a governed
contract ledger with the retained `15%` kicker and no authenticated allocation.
Its source-derived expected UI result is visible `Needs input`, a trade-bonus
reason, disabled Apply, and no Team/event write.

Observed after **Validate Trade**:

```text
Ready to validate
Run validation before preview or apply.
Validation: Not validated
```

Apply remained disabled. The validator completed with an empty `teamResults`
array, and the browser presentation then discarded the top-level fail-closed
authority result because `hasCurrentValidation` requires at least one Team
result. The failing focused expectation is retained in
`tests/e2e/architect-trade-receipt-proof.spec.ts`; the trace binds the click to
`useTradeMachineValidation.ts` logging `[after validate] []` before the UI
returned to `Not validated`.

This is a real product presentation/honesty defect. It does not currently
authorize a mutation, but it hides the owner-approved exclusion reason and
therefore fails the explicit “visible and fail closed before mutation” closure
requirement. The smallest separate repair is to preserve and present a
top-level fail-closed preview authority even when validation legitimately has
no per-Team results; BZE-265 must not make that product change.

## Reuse-first W1-W15 map

“Reusable” below means the completed-child evidence still proves its local
requirement because the only later product landings, BZE-294 and BZE-295, are
confined to draft authority, accepted-Canon parsing/provenance, and persisted
entitlement boundary reading. It does not claim the final cross-workstream
proof passed. The resumed integration run stopped at the W9 bonus exclusion as
required.

| WF  | Required proof                                                 | Evidence decision at required base                                                                                                           | Closure state                                               |
| --- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| W1  | Saved-world create/switch/date/leave/return/reload             | Reuse BZE-246/BZE-250 local lifecycle receipts; later landings do not touch world selection or persistence                                  | Integrated current-head rerun not reached                   |
| W2  | Team, Apron, and Tax Salary books across rooms                 | Reuse BZE-285 and exact-head BZE-293 book/roster-charge receipts; current proof fixture records all three governed books                     | Full 15+3 books loaded; post-action cross-room run not reached |
| W3  | Waive, stretch, buyout                                         | Reuse BZE-284 retained browser evidence; exact `$31M`, five-year `$6.2M`, and `$26M` expectations re-recorded from source                    | Current integrated rerun not reached                        |
| W4  | Contract and option actions                                    | Reuse completed extension/option receipts; BZE-294/295 have no contract-action diff                                                         | Current integrated rerun not reached                        |
| W5  | Another-team free-agent signing                                | Reuse BZE-286 local workflow evidence; replace the old event-derived oracle with pre-recorded `$3,442,237` source math                       | Oracle corrected; browser rerun not reached                 |
| W6  | Own free-agent re-sign/absolve                                 | Reuse D-MQ-005A and rights receipts; later landings do not touch this path                                                                   | Current integrated rerun not reached                        |
| W7  | Offer Sheet create/match/decline                               | Reuse BZE-283 and D-MQ-005B/D/E receipts; `48h` window re-recorded from Canon                                                               | Current integrated rerun not reached                        |
| W8  | Sign-and-trade                                                 | Reuse BZE-290 retained evidence and D-MQ-005C/F; three-season and First-Apron expectations re-recorded                                      | Current integrated rerun not reached                        |
| W9  | Ordinary trades, supported entitlements, cash, draft lifecycle | Reuse BZE-279/287/288/291/292 local receipts; current proof adds full 15+3, both exclusions, second-round, cash, books, history, and reload | **Stopped: bonus exclusion reason is hidden after Validate** |
| W10 | Draft/Stepien/frozen-pick authority and supported-pick control | Current-main source probe plus current browser first-round discriminator; BZE-294/295 are completed foundations                            | First-round fail-closed proof green; second-round source control green; browser apply not reached |
| W11 | Season Advance and post-advance books/history                  | Reuse BZE-289 exact-head 30-Team evidence and BZE-293 post-advance book evidence; BZE-295 provenance correction recorded                    | Current integrated rerun not reached                        |
| W12 | Team History and cross-team agreement                          | Reuse only the completed action-specific history receipts; current trade proof includes a reload/history assertion                         | Current assertion not reached after mandatory stop          |
| W13 | Compare agreement                                              | Reuse completed action-specific Compare receipts; later draft-only landings do not touch Compare                                            | Current integrated rerun not reached                        |
| W14 | Guide                                                          | Reuse BZE-250 navigation evidence; final current-head glance remains required                                                               | Not reached after mandatory stop                            |
| W15 | Team Plan state                                                | Reuse completed option/signing/Season-Advance Team Plan receipts as supporting evidence                                                     | Fresh cross-workstream agreement not reached                |

Evidence standard #4 (full 15 standard plus 3 Two-Way players) remains required
for the eventual current-head browser scenarios. BZE-252's seeder is a reusable
harness input, not current-head closure evidence by itself.

## Diagnostic attempts

The historical paused D-MQ-003 development loop produced no product verdict
and remains excluded from the matrix:

1. sandboxed TSX launch denied a local IPC operation;
2. one cold review-harness boot exceeded Playwright's web-server startup;
3. one run reached the product but stopped on a stale five-second
   `Last checked` harness assertion before validation completed;
4. a retry hit a Firestore-emulator readiness race after the emulator itself
   reported ready.

No timeout relaxation or rendered value from these attempts was retained as an
expectation or proof.

The resumed trade-proof diagnostic used one long-lived, non-retained review
harness and produced these attempts:

1. the initial cold-start command crossed the four-minute project limit during
   browser execution and was stopped;
2. the first reused-harness run found that full embedded roster records needed
   an explicit `name` normalization;
3. a 210-second diagnostic timeout isolated a nonexistent second
   `Cancel Trade` harness assumption;
4. the normalized roster reached the bonus boundary and returned
   `Ready to validate` / `Not validated` instead of `Needs input`;
5. an explicit two-attempt validation-settling control reproduced the same
   product result twice.

Only items 2 and 3 were repaired, because they were test-harness defects. Item
4/5 is the current product stop. No browser result was used to rewrite the
source oracle.

## Current closure boundary

BZE-265 and BZE-267 stay In Progress at this product-defect boundary. Retained
exact-head certification, hosted candidate CI, final W1-W15 completion, and the
immutable independent-Claude prompt were not started. BZE-294 and BZE-295 are
completed foundations, not reopened scope. No owner-facing V1 review, undraft,
merge, issue closure, Claude invocation, Phase 3B implementation, or product
repair inside BZE-265 is authorized. Owner direction is required for the
smallest separate repair described above.

## Validation and elapsed-time record

Validation completed before the stop:

- exact clean synchronized `main` and hosted-main run `33200095176` verified;
- pinned-Canon lookups completed before product execution for every amount,
  threshold, date, percentage, eligibility rule, and verdict used by the
  resumed discriminator;
- the current-main Stepien authority probe passed against
  `0f33acfa3388971ac9015133aaf876f52dfd4be9`;
- the focused browser reproducer passed the first-round no-write exclusion,
  then reproduced the nonzero trade-bonus presentation defect while also
  confirming Apply stayed disabled and Team/event state did not change;
- `npm run typecheck -- --pretty false` passed;
- `npm run validate:project` passed;
- targeted Markdown lint passed for both changed documentation files; and
- `git diff --check` passed.

The repository-wide `npm run lint:md` reported pre-existing violations in
unrelated documentation, including `docs/CODEBASE_MAP.md`, Architect audit
documents, and pinned-Canon material. Neither changed documentation file was
reported, and the focused lint above passed. The one required Graphify refresh
completed AST extraction for all 1,814 files, then stopped after its
symbol-resolution augmentation made no further progress; it produced no
tracked graph change and was not repeated.

Build, broad suites, the remaining integrated W1-W15 browser flow, retained
browser certification, hosted candidate CI, and automated-review settlement
were intentionally not used as completion evidence after the mandatory product
stop. No unrestricted full-suite alias ran.

Approximate wall clock: 35 minutes for branch/source/receipt reconciliation,
40 minutes for expectation and proof-harness work, 35 minutes for browser and
emulator diagnosis, and 5 minutes for hosted-main and review-state checks.
About 20 minutes of the browser time was spent on the cold-start limit and the
two corrected harness assumptions described above; no retained certification
or hosted candidate wait occurred.
