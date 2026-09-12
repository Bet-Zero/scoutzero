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
| Operation inputs and isolated known rules | Accepted foundation and pinned Canon                    | BZE-312 author tests passed | Finish checks and queue review                           |
| Test/review integration slice             | Necessary components; explicit provisional dependencies | Conditional                 | Reuse existing mutation/persistence seams                |

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
`70ef50567508deeee8a26c0067055efd39e6d3e8` after four minor automated repairs; predecessor hosted CI passed.
Exact private probe passed 278 IDs, 1,483 occurrences, 877 dependencies, five
predecessors/states and reload equality. Automated review returned four minor
code/docs findings, now repaired with 25 release tests/typecheck/Markdown passing. Replacement-head receipts are being collected. Claude
acceptance remains required and pending. This is not merged or accepted.

BZE-312 branch: `feature/bze-312-draft-known-rules`, based directly on accepted
main. Ownership and supplied-branch Stepien author code passed 53 synthetic
operation cases plus all 22 unchanged Apron tests. Final typecheck, project/schema
checks, docs guardrails, scoped Markdown and Graphify update passed. A shared
unresolved dependency blocks all branches; only separately scoped unknowns can
be irrelevant to a proved violation. No foundation,
legacy lineage, runtime gate, world or source data changed.

Next actions: commit/open BZE-312 draft PR and collect hosted/automated review. Settle BZE-311 automated findings and replacement-head
receipts in its isolated repair checkout. Inspect the existing mutation/reload
harness for the next useful integration slice; keep unreviewed dependencies
explicit. Claude access is not retried before the recorded 10:50 Detroit reset.
No full suite or browser/emulator proof for disconnected data/rule changes.
