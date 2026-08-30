---
name: PHASE3A_CLOSURE_EVIDENCE.md
description: BZE-265 source-derived W1-W15 closure evidence map and exact-head integration record.
---

# Phase 3A Closure Evidence (BZE-265)

**Status:** complete source-derived discriminator and browser diagnostic pass;
final exact-head review/certification boundary in progress.
**Required base:** `89a8c01bd37d54f0ed639a14a76bc00a51484041`.
**Closure branch:** `feature/bze-265-phase3a-closure-integration-proof`.
**Draft PR:** #517.

The worktree was returned to clean synchronized `main` at the required base
before this branch resumed. Hosted base CI run `33290842948` passed at that
exact commit, including the hosted full suite and production build. Current
main includes completed foundations BZE-294 / PR #518, BZE-295 / PRs #519 and
PR #520, and BZE-296 / PR #521. The paused head `8149b667…` was synchronized by
normal two-parent merge `d8921cae…`; no rebase, squash, amendment, branch
replacement, or force-push occurred. BZE-289, BZE-294, BZE-295, and BZE-296
remain Done. Completed-child observations remain evidence, not new closure
scope. Relative to current main this lane changes no product, CBA, schema,
persistence, Canon, governed-source, or completed-child implementation.

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
No Phase 3B implementation issue was created. The 2026-08-27 decision governs
the two fail-closed variants during this proof; it does not let BZE-265 silently
make the final owner decision that the completed remaining-exclusions matrix is
acceptable for V1 closure. That final acceptance remains explicitly pending.

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

Fresh resumed-branch probe:

```text
npm run review:probe -- \
  --candidate 3f4c1ad7ec7d4ae353384de60f82f622e1d654e9 \
  --fixture scripts/review/probes/stepienAuthorityClosureProbe.ts
```

Result: **PASS**. The unsupported first-round result was `NEEDS_INPUT`,
`evaluated:false`, `passed:false`, carried exactly the six governed-history
inputs above, omitted `acceptedCanon.CBA2-A12.3`, and contained no affirmative
legality copy. The supported second-round result was `PASS`, `evaluated:true`,
`passed:true`, with no missing inputs. The exact-snapshot helper cleaned its
temporary workspace and left the source worktree unchanged. Later checkpoint
commits changed only the proof harness and this evidence; no Stepien or product
source changed.

## Historical browser stop and BZE-296 repair

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

This was a real product presentation/honesty defect. It did not authorize a
mutation, but it hid the exclusion reason and therefore failed the explicit
“visible and fail closed before mutation” closure requirement.

BZE-296 / PR #521 landed the separate repair on current main. It preserves a
completed exact-draft top-level preview authority with an explicit legal
verdict even when `teamResults` is empty, while rejecting missing, malformed,
failed-construction, cleared, or stale authority. A current `legal: false`
result remains unable to preview, export a Trade Summary, Apply, or write. The
complete BZE-265 diagnostic verified the retained 15% source record is
presented as visible `Needs input` with the trade-bonus reason, disabled Apply,
disabled Trade Summary, and zero Team/event writes before supported controls
continue. The top-level fail-closed result remained visible with empty
`teamResults`; it did not revert to `Not validated`.

## Reuse-first W1-W15 map

“Reusable” below means the completed-child evidence still proves its local
requirement. BZE-294, BZE-295, and BZE-296 are confined to first-round draft
authority, accepted-Canon parsing/provenance, persisted entitlement boundary
reading, and exact-draft Trade Machine validation presentation/currentness.
They do not reopen unrelated completed workflows or make completed-child
observations new scope. The fresh run is used only where #518–#521 made prior
evidence stale or where cross-workstream agreement was still missing.

| WF  | Required proof                                                 | Evidence decision at required base                                                                                                           | Closure state                                               |
| --- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| W1  | Saved-world create/switch/date/leave/return/reload             | Reuse BZE-246/BZE-250 lifecycle receipts; later landings do not touch world selection or date; fresh trade proof re-enters and reloads its saved world | **PASS — reused plus fresh reload**                         |
| W2  | Team, Apron, and Tax Salary books across rooms                 | Reuse BZE-285/BZE-293; fresh proof seeds 15 Standard + 3 Two-Way on MIA and DEN, reconciles all three persisted books, and reloads Cap Sheet at `15 / 15 · 3 / 3` | **PASS — reused plus fresh full-roster books**              |
| W3  | Waive, stretch, buyout                                         | Reuse BZE-284 retained browser evidence; exact `$31M`, five-year `$6.2M`, and `$26M` expectations are re-recorded from source                | **PASS — unaffected evidence reused**                       |
| W4  | Contract and option actions                                    | Reuse completed extension/option receipts; PRs #518–#521 have no contract-action diff                                                       | **PASS — unaffected evidence reused**                       |
| W5  | Another-team free-agent signing                                | Reuse BZE-286 workflow evidence; the existing actual `$3,442,237` cap-space decrease is now anchored before execution to `$4.8M - $1,357,763` instead of an event-derived oracle | **PASS — actual reused; oracle corrected**                  |
| W6  | Own free-agent re-sign/absolve                                 | Reuse D-MQ-005A and rights receipts; later landings do not touch this path                                                                   | **PASS — unaffected evidence reused**                       |
| W7  | Offer Sheet create/match/decline                               | Reuse BZE-283 and D-MQ-005B/D/E; the `48h` window is re-recorded from `CBA2-L04.3`                                                           | **PASS — unaffected evidence reused**                       |
| W8  | Sign-and-trade                                                 | Reuse BZE-290 retained evidence and D-MQ-005C/F; three-season and First-Apron expectations are re-recorded                                  | **PASS — unaffected evidence reused**                       |
| W9  | Ordinary trades, supported entitlements, cash, draft lifecycle | Fresh full-roster proof: first-round and nonzero-bonus paths visibly fail closed/no-write; supported second-round + `$1.00` cash trade validates, applies, persists both Teams, reloads, and appears in History/Compare | **PASS — fresh integrated diagnostic**                      |
| W10 | Draft/Stepien/frozen-pick authority and supported-pick control | Fresh exact-snapshot probe plus browser first-round no-write discriminator; BZE-294/295 remain completed foundations; supported second-round entitlement transfers to DEN | **PASS for supported path and fail-closed exclusion; owner acceptance pending** |
| W11 | Season Advance and post-advance books/history                  | Reuse BZE-289 exact-head 30-Team evidence and BZE-293 post-advance book evidence; PRs #518–#521 do not change Season Advance                 | **PASS — unaffected evidence reused**                       |
| W12 | Team History and cross-team agreement                          | Fresh trade proof deep-compares both Team snapshots, persists one shared event/receipt, reloads, and opens its cash receipt in Team History | **PASS — fresh integrated diagnostic**                      |
| W13 | Compare agreement                                              | Fresh reloaded Compare shows one committed event, two changed Teams, four touched players, Aaron Pike added, Owen Frost removed, and a cap delta | **PASS — fresh integrated diagnostic**                      |
| W14 | Guide                                                          | Reuse BZE-250 navigation/guidance evidence; PRs #518–#521 do not touch Guide or its inputs                                                   | **PASS — unaffected evidence reused**                       |
| W15 | Team Plan state                                                | Reuse completed option/signing/Season-Advance Team Plan receipts; fresh reload selects `Trade Receipt Proof` and shows the reconciled full-roster status | **PASS — reused plus fresh identity/status**                |

Evidence standard #4 was met freshly for both Teams in the trade scenario. The
BZE-252 seeder remains a harness input rather than proof by itself.

## Remaining-exclusions decision matrix

The objective behavior below passed. The matrix is not owner acceptance and
does not make either exclusion a silent closure assumption.

| Proposed remaining V1 exclusion | Authority still unavailable | Current exact behavior | Supported control | Unblocking event | Owner state |
| --- | --- | --- | --- | --- | --- |
| Branch-complete first-round ownership, Stepien, protection, conveyance, and frozen-pick lifecycle variants | Complete governed ownership, protection, conveyance, freeze, unfreeze, penalty, and required-transition history | `NEEDS_INPUT`; unevaluated; false; exact six missing histories; visible reason; Apply disabled; zero Team/event writes | Clean second-round entitlement is `PASS`, transfers MIA → DEN, persists, reloads, and appears in the shared event | Retained certified governed source supplies the complete lifecycle required by the proposed branch | **Pending final owner acceptance** |
| Ordinary trades requiring a nonzero trade-bonus calculation | Authenticated bonus basis, allocation/protection schedule, amendment state, prior-trade/payability history, payer/reallocation state, and payment timing | Retained Austin Reaves 15% kicker presents top-level `Needs input` with empty `teamResults`; reason visible; Trade Summary/Apply disabled; zero Team/event writes | Ordinary governed player/entitlement/cash trade reaches `Ready to apply`, commits atomically, persists/reloads, and appears in History/Compare | New immutable, recoverable, hash-verified, certified contract-source release supplies all required fields for the affected Contract | **Pending final owner acceptance** |

No completed-child observation was promoted into a third exclusion or new
scope item. Existing owner-decided V1 exclusions outside this Phase 3A matrix
remain unchanged.

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

Only items 2 and 3 were repaired in BZE-265 because they were test-harness
defects. Items 4/5 were the product stop later repaired separately by BZE-296.
No browser result was used to rewrite the source oracle.

The resumed post-BZE-296 diagnostic then produced three non-retained attempts:

1. `e1680903…` cleared both blocked paths and reached supported persistence,
   then a harness object comparison expected JavaScript `-0` where the
   persisted zero-value book line correctly normalized to `0`;
2. `db8c7047…` reached reloaded Compare, then the new harness assertion counted
   six staged players even though the legal control intentionally removed two
   before Apply; Compare correctly reported four; and
3. `2fcfdf2e30991fb6d7f0fd14ffa563d3882d65c0` passed the complete diagnostic
   in 2.2 minutes.

The first two are proof-harness expectation defects, not product defects. Both
were corrected without changing source authority or product behavior. All
diagnostic directories were temporary and removed; none is retained or cited
as exact-head certification.

## Current closure boundary

BZE-265 and BZE-267 stay In Progress. The objective discriminator and complete
diagnostic are green; the remaining workflow is final evidence review,
automated-review settlement, exact candidate freeze/push, hosted exact-head CI,
retained exact-head certification, and immutable prompt publication. BZE-289,
BZE-294, BZE-295, and BZE-296 are completed foundations, not reopened scope.
The final owner acceptance of the remaining V1/Phase 3B exclusions remains
pending even if every objective proof gate passes. No owner-facing V1 decision,
undraft, merge, issue closure, Claude invocation, Phase 3B implementation, or
product repair inside BZE-265 is authorized.

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

CodeRabbit completed its review of predecessor head `e9738560…` and identified
one in-scope evidence-quality issue: the proof receipt reported a fixed world
count even though the harness had verified only that the dedicated proof world
existed. The receipt now stores, asserts, and reports the actual
`proofWorldExistsAfterApply` result. No product behavior or product expectation
changed. A temporary test-inclusive TypeScript configuration then exposed two
harness-only object-boundary typing gaps in the same browser spec; both were
narrowed explicitly, and the scoped test-file TypeScript check passed.

Resumed validation after BZE-296 landed:

- repository identity, clean synchronized `main` at `89a8c01b…`, PR #517 at
  paused head `8149b667…`, BZE-265/BZE-267 In Progress, BZE-296 Done, and
  hosted-main CI `33290842948` were verified live;
- normal merge `d8921cae…` synchronized the existing branch with exact main;
- pinned lookups for `CBA2-A12.3`, `CBA2-L09.2`, `CBA2-L09.3`, `CBA2-L09.6`,
  and `CBA2-A12.4` verified candidate/fingerprint/provenance and the direct
  missing-history boundary;
- the retained release records Austin Reaves' 15% kicker, exact release digest,
  and `terms.bonuses|...|missing-bonus-allocation` evidence limitation;
- exact-snapshot Stepien discriminator at `3f4c1ad7…`: **PASS**;
- `npm run typecheck -- --pretty false`: **PASS**;
- `npm run validate:project`: first sandboxed invocation was denied its TSX IPC
  socket; approved rerun outside the sandbox **PASS**;
- targeted Markdown lint for both changed evidence/contract docs: **PASS**;
- focused Playwright collection for the proof spec: **PASS**, one test;
- complete non-retained browser diagnostic at `2fcfdf2e…`: **PASS**, one test
  in 2.2 minutes, after the two harness-only expectation corrections recorded
  above; and
- `git diff --check`: **PASS** at every source-change checkpoint.

The branch/commit Graphify hook refreshed the graph through `3f4c1ad7…`.
Subsequent changes were proof assertions and evidence only; the hook reported
no new code-graph topology. Per the Phase 3A execution profile, no redundant
explicit Graphify update was run.

No local production build or broad/full suite was repeated: hosted exact-main
CI already covered the landed product source, later local changes were
proof/evidence only, and exact-candidate hosted CI remains the freeze gate. No
unrestricted full-suite alias ran. Retained browser certification and the
immutable prompt remain intentionally unstarted until the final candidate is
clean, frozen, pushed, and hosted-green.

Approximate wall clock: 35 minutes for branch/source/receipt reconciliation,
40 minutes for expectation and proof-harness work, 35 minutes for browser and
emulator diagnosis, and 5 minutes for hosted-main and review-state checks.
About 20 minutes of the browser time was spent on the cold-start limit and the
two corrected harness assumptions described above; no retained certification
or hosted candidate wait occurred.

Resumed-tranche estimate before freeze: about 15 minutes for live-state/branch
reconstruction and synchronization, 15 minutes for source/evidence
reconciliation and author checks, and 10 minutes for the three browser/emulator
diagnostic attempts. Hosted-CI, retained-certification, automated-review wait,
and prompt-publication time are recorded separately after those gates finish.
