# Draft-pick sustained execution

Owner authorization: September 12, 2026 sustained-run instruction, recorded in
the existing [completion plan](https://linear.app/bzero/document/draft-picks-completion-plan-and-execution-gates-82f1eea7abb1).
One lead, one active High implementation lane. Live first-round Apply stays
blocked. No source publication, production writes, baseline adoption decision,
W10/V1 self-acceptance or automatic new research.

## Verified starting state

- Main: `5d9a4c277b7e8712d10ff6d6e5a58fc5d477cf50`, clean and synchronized;
  [exact-main CI passed](https://github.com/Bet-Zero/scoutzero/actions/runs/34688668075).
- [Foundation](https://github.com/Bet-Zero/scoutzero/pull/533) landed and accepted;
  BZE-310 and BZE-267 Done. BZE-309 In Progress / No priority.
- Structural correction `6968583757d93a2cd7387c762f6bb63716d7258fe40d26871b1d8ee1c33cc1cd`
  remains pending independent review. Original candidate `bfee546d…`, all original
  reviews and interrupted outputs are retained privately, unchanged. Exact
  [checkpoint](https://linear.app/bzero/issue/BZE-309#comment-6bcb031f-a1ac-4c57-a587-8e05641df26a).
- At 08:08 Detroit the retained Claude limit still precedes its 10:50 reset.
  No pre-reset retry or wait process. One retry after reset only while useful
  work continues; if unavailable, keep review queued and continue author work.

## Execution queue

| Deliverable                               | Prerequisite                                            | Status                      | Next action                                              |
| ----------------------------------------- | ------------------------------------------------------- | --------------------------- | -------------------------------------------------------- |
| Structural correction acceptance          | Claude access; exact frozen correction                  | Queued                      | Bounded post-reset retry                                 |
| Release loading and successor comparison  | Accepted foundation                                     | BZE-311 In Review           | Settle minor automated findings, freeze and queue Claude |
| Operation inputs and isolated known rules | Accepted foundation and pinned Canon                    | BZE-312 review queued       | Await Claude acceptance                                  |
| Test/review integration slice             | Necessary components; explicit provisional dependencies | BZE-313 author proof passed | Commit and queue review                                  |

## BZE-312 expected results before implementation

Independent branch from accepted main; no release-loader code dependency.
Pinned reads: CBA2-A12.1, CBA2-A12.3, CBA2-L09.6; accepted Apron code
remains reusable separately. The component consumes authenticated supplied
facts, never infers identity from a projection or generates an unknown branch.
Finite Stepien coverage needs a governed first future draft and an established
retained-first tail after its last enumerated draft; otherwise a passing finite
window cannot become a permitting component result.

| Synthetic discriminator                                                      | Independent expected result                              |
| ---------------------------------------------------------------------------- | -------------------------------------------------------- |
| One current full original-pick owner matches conveying team                  | Ownership component permits                              |
| Only an expected acquisition, or a different current owner                   | Ownership component prohibits                            |
| Duplicate current claims, unresolved projection, missing review/date/scope   | Needs input                                              |
| Every possible branch retains a first in every adjacent pair                 | Stepien component permits                                |
| One possible branch has two complete empty adjacent drafts                   | Stepien prohibits, even if other branches remain unknown |
| Another team's authenticated first fills the gap                             | Counts as a retained first                               |
| Missing row next to a known retained first                                   | That pair is established; no irrelevant demand           |
| Missing row next to an empty draft, unknown branch set or future tail        | Needs input for a permitting result                      |
| Stale state, different proposal/team/date or inconsistent original-pick year | Needs input                                              |

## Current author checkpoint

BZE-314 next author expectations (before implementation): a complete direct
exchange of authenticated original firsts solely for established positive cash
or cash equivalents is prohibited by CBA2-A12.2. Complete established noncash-only
consideration is outside that prohibition. Mixed consideration, unclassified
equivalence, incomplete/conditional exchange, unknown positive value, duplicate
items, mismatched context/identities or unqualified evidence need input. One
known positive cash amount suffices without requiring every other cash amount.
No valuation/equivalence inference or whole-trade permission is implemented.

BZE-311 [PR #534](https://github.com/Bet-Zero/scoutzero/pull/534):
`f8a92dc44f1dd718136080c4381e49730affd24c`. All six automated findings are
settled (four minor, two material impact-reporting corrections). The 28 release
checks and typecheck passed after the final repair; exact private preservation
and reload probe passed all 278/1,483/877/five. Final hosted CI passed. No merge.

BZE-312 [PR #535](https://github.com/Bet-Zero/scoutzero/pull/535): frozen at
`5ef2e071d1b74f98651c875c520c70906de55638`. Hosted CI including build passed;
GitHub Codex completed without findings. CodeRabbit was rate-limited and is
recorded unavailable. The immutable private Claude request was generated after
those gates, SHA-256 `5a8d3329d8ff5300d4fc07d83db30ffaa98aa8c3f5e62a73d3d96240709f97d5`.
Its 53 operation cases, 22 Apron cases and exact live-block discriminator passed.

BZE-313 is the one active High lane on `feature/bze-313-draft-review-path`, staged
on the provisional BZE-312 head above. Neither ancestor nor descendant may land
without independent acceptance. It composes existing ownership, Stepien and
Apron results for the same proposal/state/date/original pick and keeps Apply
blocked. Expected results were recorded before implementation: wrong context,
duplicate/missing Apron inputs block the relevant component; known separate
components remain visible; a composed result never grants overall authority.

Author validation: 88 scoped node cases passed (13 composition, 53 operation,
22 Apron), plus nine existing mutation-seam cases including the added passing-
components/blocked-Apply discriminator. Both rejected attempts opened no write
batch and retained identical serialized state/review; a stale state version
blocked revalidation. Final typecheck, project/schema checks, docs guardrails,
scoped Markdown, diff check and Graphify update passed. The initial UI runner
selected no `.ts` files; the correct node runner was used. An initial fixture
used the existing FNV state digest as a SHA-256 proposal digest; the input gate
rejected it. The fixture now computes an actual SHA-256 and the test passes.

Next: commit and queue BZE-313 hosted/automated review; retain final BZE-311
immutable checker request after clean-head verification. Independent Claude
acceptance remains queued under the retained pre-reset limit. No pre-reset
invocation, sleeping process, source reacquisition, runtime mutation change or
activation. Local full suite and browser/emulator certification are skipped:
no rendered or saved-world behavior changed, and no successful first-round
persistence path is being claimed. Exact PR receipts supersede earlier in-file
checkpoint commands. Private source reviews and interrupted outputs remain
unchanged at the original structural checkpoint.

BZE-314 author checkpoint: `feature/bze-314-draft-cash-sale`, based provisionally
on frozen BZE-312 `5ef2e071d1b74f98651c875c520c70906de55638` and independent of
BZE-311/313 code. The newly looked-up CBA2-A12.2 restriction is separate from
accepted annual cash limits. Thirty-six synthetic restriction cases and nine
unchanged governed-cash cases passed. Final typecheck, project/schema checks,
docs guardrails and Graphify update passed. Commit/push and hosted/automated
review are next; no new real facts or runtime activation.

BZE-313 PR #536 remains at `b979abc34e0624f6fd02ffb7ba1eb4896308c577`.
Its PR now targets main because the existing CI workflow only accepts that
base. The unreviewed BZE-312 ancestor remains explicit and blocks merging;
changing the PR target does not accept it. No candidate code changed.

## Resumed independent review, September 12

The corrected BZE-309 structural assessment received unconditional independent
ACCEPT; [the accepted disposition](https://linear.app/bzero/issue/BZE-309#comment-c3a19cdd-27eb-4bdc-903b-b95ae9795d9c)
preserves Stage B open and the source-search stop. No structural identity was
resolved by that correction. The completion plan carries the current queue;
the preceding author checkpoints are historical.

BZE-312 candidate `5ef2e071d1b74f98651c875c520c70906de55638` received REVISE
for one material selector finding: a malformed same-scope duplicate could
disappear before conflict detection and allow a component permit. The original
review and independently chosen probes remain separately retained. Its other
ownership, Stepien, Canon and non-activation conclusions are reused.

The focused repair selects by scope before payload validation. An ownership
record whose pick ID cannot be resolved blocks; a known different pick remains
unrelated. Stepien records in its scope remain selected regardless of an invalid
extra pick field. Seven malformed-envelope regression cases failed against the
original selector, then passed after repair, including both record orders and
single-invalid-record controls. A different identified pick and unrelated scope
still permit the valid control. All 61 operation tests and typecheck passed. This discriminates
the concrete conflict-hiding failure absent from the original 53 cases.

This is author repair evidence, awaiting exact replacement-head checks and
focused independent delta acceptance. There is no mutation wiring, whole-trade
permission, production activation, source acquisition or real-team readiness.

## Accepted base and cash-sale synchronization

BZE-312 repair candidate `d40c55376b7b86e87f600c53f0a2455dadcf15e6` received
unconditional independent ACCEPT and landed through PR535 at
`3957f7cfad73989513004ed78e468cc82672ff50`. The landed tree equals the accepted
candidate; main/local/origin synchronization and post-merge CI34723340457 passed.
BZE-312 is Done. Original REVISE and focused correction ACCEPT remain separately
retained; none of this grants overall trading or production Apply permission.

BZE-314 is brought forward by a normal merge of that accepted main. The only
merge conflict was this historical execution record; both the later queue
checkpoint and the accepted repair history are preserved. Cash-sale source and
schema are unchanged from the frozen candidate. The changed shared selector
requires one focused integration discriminator: a valid noncash permit beside
a malformed same-scope cash contradiction must need input in either order.
No ownership/Stepien reimplementation, new source facts or activation is involved.

All 39 cash-sale cases passed, including three malformed-envelope variants of
that discriminator. Scoped Markdown and diff checks passed. The accepted
predecessor's typecheck and unchanged cash-rule validation are reused; the
replacement exact-head hosted typecheck/build and independent delta verdict
remain required. No local full suite or browser/emulator rerun is warranted
for this disconnected rule and documentation/test integration.
