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

| Deliverable                               | Prerequisite                                            | Status              | Next action                                                                    |
| ----------------------------------------- | ------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------ |
| Structural correction acceptance          | Claude access; exact frozen correction                  | Queued              | Bounded post-reset retry                                                       |
| Release loading and successor comparison  | Accepted foundation                                     | BZE-311 author work | Complete scoped checks and private preservation probe; commit and queue review |
| Operation inputs and isolated known rules | Reusable logic and fresh pinned Canon                   | Inspection pending  | Identify missing concrete component                                            |
| Test/review integration slice             | Necessary components; explicit provisional dependencies | Conditional         | Reuse existing mutation/persistence seams                                      |

## Current author checkpoint

BZE-311 branch: `feature/bze-311-draft-release-updates`, based on verified main.
No pending structural finding is used as an accepted implementation premise.
Release loading and comparison are disconnected from live mutation and validation.
Scoped checks: 42 node tests passed (25 new release checks, 17 foundation and
mapper checks), plus eight unchanged Trade Machine date tests. Typecheck,
project/schema checks, docs guardrails and changed-document Markdown passed.
Graphify was updated and includes the new source modules.

Initial code checkpoint: `52e6e2b1573e27d1aaa242acec0c325aeb403224`.
Its exact private probe passed complete retained-object and reload equality:
278 IDs, 1,483 occurrences, 877 dependencies, five predecessors and all five
states; no world adoption or writes. The pre-push gate rejected one unknown
index-signature typing pattern. A typed identity-accessor repair is being
validated without adding a cast exception. Required hosted CI and independent
review remain pending; no merge or acceptance is claimed.
Fresh pinned Canon lookups: CBA2-L09.2 and CBA2-L09.3.

Next commands: finish scoped repair tests and typecheck, commit the repair,
push the branch, run the replacement-head private `npm run review:probe`,
then collect hosted CI and available automated review. Reuse unaffected
project/schema/UI/docs checks; the new graph hook follows source changes.
No local full suite for this data-only assignment; no browser/emulator proof
because rendered and saved-world behavior is unchanged.
