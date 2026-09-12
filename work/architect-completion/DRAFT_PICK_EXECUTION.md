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
