---
name: PHASE3A_CLOSURE_EVIDENCE.md
description: BZE-265 source-derived W1-W15 closure evidence map and exact-head blocker record.
---

# Phase 3A Closure Evidence (BZE-265)

**Status:** blocked; BZE-267 is not eligible to close.
**Required base:** `5c64a45a8c6243652a15374f226e0651cf5dbbfd`.
**Closure branch:** `feature/bze-265-phase3a-closure-integration-proof`.
**Draft PR:** #517.

The worktree was returned to clean synchronized `main` at the required base
before this branch was created. Hosted base CI run `33061834450` passed at that
exact commit. No product, CBA, schema, persistence, Canon, governed-source, or
completed-child implementation was changed in this lane.

## Locked authority boundary

The V1 completion contract now records the owner's 2026-08-27 decision:

1. A draft-asset verdict that depends on unavailable `CBA2-A12.3` or missing
   authenticated, branch-complete ownership/protection/conveyance and
   freeze/unfreeze/penalty history must fail closed. It unblocks only when the
   pinned accepted-Canon lookup authenticates A12.3 and retained governed
   history supplies the complete branch set.
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
- Relevant accepted leaves: `CBA2-L09.2`, `CBA2-L09.3`, `CBA2-L09.6`, and
  `CBA2-A12.4`.
- Required but unavailable authority: the pinned lookup
  `npm run architect:canon:lookup -- CBA2-A12.3` returns
  `Unknown Canon leaf ID: CBA2-A12.3`.
- Unsupported input: LAL sends its 2027 first-round ownership entitlement with
  no authenticated branch-complete ownership, protection, conveyance,
  freeze, unfreeze, or penalty history. Expected verdict: fail closed; no legal
  or success result.
- Supported control: LAL sends its clean 2027 second-round ownership
  entitlement. Expected rule result: supported; the unavailable first-round
  authority must not weaken this path.

There is no amount or threshold arithmetic in this discriminator. The result is
an authority-availability decision, not an application-derived calculation.

The nonzero-bonus expectation remains independently anchored to retained
release `salaryswish-retained-2026-06-05@v1`, digest
`sha256:46db3137308ff1c05e0066edf09ef08d45b92353bea7a2bcec93fd408adf5950`.
Its Austin Reaves record retains a 15% kicker but identifies
`terms.bonuses` as `missing-bonus-allocation`; no bonus amount may be invented.
That browser scenario was not run after the earlier draft-authority defect
triggered the mandatory stop.

## Discriminating result

Configured exact-source probe:

```text
npm run review:probe -- \
  --candidate c560bd54bbe3b8020b73bd7283652a3e7e15e876 \
  --fixture scripts/review/probes/stepienAuthorityClosureProbe.ts
```

This exact pushed candidate contains the contract decision, the discriminator,
and this evidence matrix. Its product tree is unchanged from the required base.

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
temporary workspace, and left the source worktree unchanged. This is a product
defect, not an application-output re-baseline: the product returned a legal
Stepien verdict where authority unavailability required a blocked verdict.

## Reuse-first W1-W15 map

“Reusable” below means supporting evidence can be carried forward if a later
diff audit still shows no relevant product change. It does not claim the final
cross-workstream proof passed. Work stopped at W10 as required.

| WF  | Required proof                                                 | Evidence decision at required base                                                                                                           | Closure state                                               |
| --- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| W1  | Saved-world create/switch/date/leave/return/reload             | BZE-246/BZE-250 evidence is supporting-only; current integrated rerun still required                                                         | Not run after stop                                          |
| W2  | Team, Apron, and Tax Salary books across rooms                 | BZE-283/BZE-293 receipts are reusable inputs; BZE-293 changed roster-charge reconciliation, so current cross-room proof is required          | Not run after stop                                          |
| W3  | Waive, stretch, buyout                                         | D-MQ-004B/C/D remains the reuse target; BZE-293 changed supported mutation reconciliation                                                    | Not run after stop                                          |
| W4  | Contract and option actions                                    | Completed action receipts remain supporting evidence; current shared-book persistence proof is required                                      | Not run after stop                                          |
| W5  | Another-team free-agent signing                                | D-MQ-005 is the canonical scenario; prior event-derived cap-delta baseline is rejected as an expectation oracle                              | Source re-baseline still required                           |
| W6  | Own free-agent re-sign/absolve                                 | D-MQ-005A is the canonical scenario; current Team/Apron/Tax agreement remains required                                                       | Not run after stop                                          |
| W7  | Offer Sheet create/match/decline                               | D-MQ-005B/D/E is the reuse target; current mutation reconciliation remains required                                                          | Not run after stop                                          |
| W8  | Sign-and-trade                                                 | BZE-290 and D-MQ-005C/F are supporting evidence; current cross-team/books/history proof remains required                                     | Not run after stop                                          |
| W9  | Ordinary trades, supported entitlements, cash, draft lifecycle | BZE-279/287/288/291/292 receipts are reusable inputs. The initial D-MQ-003 diagnostic did not reach a product verdict, so it is not evidence | Incomplete                                                  |
| W10 | Draft/Stepien/frozen-pick authority and supported-pick control | Fresh exact-source discriminator above                                                                                                       | **Blocked: unsupported first-round path returns compliant** |
| W11 | Season Advance and post-advance books/history                  | BZE-289 is supporting evidence; BZE-293 changed the reconciled roster-charge surface, so fresh proof is required                             | Not run after stop                                          |
| W12 | Team History and cross-team agreement                          | Existing D-MQ history checks are reusable only with the action they describe                                                                 | Not run after stop                                          |
| W13 | Compare agreement                                              | Existing Compare checks are reusable only with the action they describe                                                                      | Not run after stop                                          |
| W14 | Guide                                                          | BZE-250 navigation evidence appears reusable; final current-head glance check remains                                                        | Not run after stop                                          |
| W15 | Team Plan state                                                | Prior glance evidence is insufficient after integrated actions/advance                                                                       | Fresh proof still required                                  |

Evidence standard #4 (full 15 standard plus 3 Two-Way players) remains required
for the eventual current-head browser scenarios. BZE-252's seeder is a reusable
harness input, not current-head closure evidence by itself.

## Diagnostic attempts that are not evidence

The D-MQ-003 development loop produced no product verdict and is excluded from
the matrix:

1. sandboxed TSX launch denied a local IPC operation;
2. one cold review-harness boot exceeded Playwright's web-server startup;
3. one run reached the product but stopped on a stale five-second
   `Last checked` harness assertion before validation completed;
4. a retry hit a Firestore-emulator readiness race after the emulator itself
   reported ready.

No timeout relaxation or rendered value from these attempts was retained as an
expectation or proof.

## Stop condition and separate repair boundary

BZE-265 stays High / In Progress and continues to block BZE-243. BZE-267 stays
In Progress. No retained certification, hosted candidate CI, independent-Claude
prompt, owner-facing V1 review, undraft, merge, or issue closure is authorized.

Smallest separate repair scope: add an authenticated draft-authority envelope
at the Trade Machine validation boundary so first-round Stepien/frozen-pick
verdicts require the accepted A12.3 leaf plus branch-complete governed history;
return a visible blocked/needs-input result with no Apply path when either is
missing; retain the clean second-round control unchanged. The repair belongs in
a separate issue and product branch after owner direction. It is not absorbed
into BZE-265.
