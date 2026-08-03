# Architect CBA Canon v2 Pre-R8 Validator-Route Alignment Independent Review

**Review type:** complete cumulative independent checker review after two
prior read-only rejections

**Reviewed maker checkpoint:**
`4e49d799b9e0d3a482ce824c1c5298dea0dc6750`

**Direct parent:** `a1e70bb3978dc098bedb63aa15552eb7659b515c`

**Completed-R7 baseline:**
`e59d0dcc0ef2bf794920805c9fc3d549342e376c`

**Stable main:** `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`

**Verdict:** **ACCEPT**

## Scope and pinned state

The checker fetched the topic branch and stable `main`, then began read-only.
The local branch, remote tip, requested HEAD, direct parent, completed-R7
baseline, and stable local and remote `main` all matched. The worktree was
clean and synchronized. The cumulative maker chain above the R7 baseline was,
in order:

1. `ce1533d5a73b3f2aa65270c43f0cacfbfc917382`
2. `d29fff1f6ee31579219def2e01c6614b0a7d31c8`
3. `06e8b219797dba4ccc257ad2341387d8899ed93d`
4. `070ac670d4842fa25676c4b4fb61463955a67cb4`
5. `8cf19568e03fde17b9041abcedf04053c6b4e436`
6. `a1e70bb3978dc098bedb63aa15552eb7659b515c`
7. `4e49d799b9e0d3a482ce824c1c5298dea0dc6750`

The latest commit modified exactly the validator and the maker alignment
receipt. Its parent and all requested blobs matched:

- repair plan: `1561b2166438c59b8c4a0a71d00c333c977d9a56`;
- validator: `21f985cefcbf8c98eb6c414bdbb11d5bcd30cc68`;
- alignment maker receipt: `8d66adf4e298de4ada839eb78076c530b9f14ebf`;
- Canon: `5e8a57c3f90c3033cec80516d51a859d108f484d`; and
- R7 receipt: `a411aba2d56fbdf3fc55c2b5fc750c9705aca0d9`.

The cumulative diff from completed R7 changed only the repair plan,
validator, and alignment maker receipt. Canon and the R7 receipt remained
byte-identical to the R7 baseline. No prior receipt, rule, source, evidence,
scenario, lineage, application, data, configuration, Linear, Graphify, or
`main` content changed.

## Complete cumulative alignment review

The checker reviewed the complete change from `e59d0dcc...` through
`4e49d799...`, not only the latest patch. The original route correction,
polarity hardening, semantic-order hardening, deterministic nine-field
contract, and structural-integrity correction all remain present.

The current route is selected from trusted Git chronology beginning at the
completed-R7 checkpoint, not from mutable plan status prose. Historical
accepted-status trees retain their separate historical route. Current and
historical checks remained stable in both call orders, invalid explicit route
contexts failed closed, and same-named refs in different repositories did not
cross-contaminate caches.

A fresh checker-authored structural probe outside the maker controls passed 31
mutations: omission and duplication of every one of the nine controlled
fields, duplication of each R5-R9 section, five declaration bypasses, and
three attempts to downgrade current validation through renamed, removed, or
weakened R7 status prose. Every mutation reached the real `check_plan()` path
and produced its directly relevant diagnostic.

The checker independently parsed and normalized the nine plan fields and
recomputed frozen contract SHA-256:

`b0c97d74d1426a323101155d61ebb86d2c42d6f66023ba383173e797db0a8cc1`

The value matches the plan declaration, validator constant, and maker
receipt. The declaration occurs exactly once with version
`CBA-CANON-V2-R5-R9/1` and state
`frozen-through-phase-1-closure`. None of the nine frozen values changed in
this checker acceptance commit.

## Both prior rejections and performance corrections

The first independent review rejected maker checkpoint `8cf19568...` because
an uncontended bounded default execution exceeded the mandatory four-minute
ceiling under both Python 3.13.2 and system Python 3.9.6. The checker made no
repository change and did not start R8.

Checkpoint `a1e70bb...` added bounded exact-content parser caches and restored
the validator to the runtime budget, but the next independent review rejected
it after reproducing a mutable `parse_inventory()` cache leak. Clearing the
first returned schema and appending an independent poison diagnostic corrupted
the next public result. That checker again made no repository change and did
not start R8.

Checkpoint `4e49d799...` moves the inventory cache behind a private immutable
snapshot and reconstructs public mutable values on every call. The checker did
not accept the maker receipt as proof and independently audited every cache and
the full production path.

## Fresh cache-isolation and cache-integrity probes

The exact prior poisoning reproduction now reports:

```text
same_inventory_object=False
same_problems_object=False
schema_before=23
schema_after=23
poison_visible=False
```

The private inventory cache contained only nested tuples, strings, and other
immutable scalar values and was keyed by exact Canon content. Cache hit/miss
behavior distinguished equal-length A and B Canon content and returned the
original pristine A state after `A -> B -> A`.

Every public `parse_inventory()` call reconstructed a different `Inventory`,
a different diagnostics list, all nine mutable field containers, all 32
nested vocabulary lists, and all 23 nested schema lists. The checker mutated
each field independently, including nested lists, and independently appended,
cleared, and replaced diagnostics. Every later parse and full
`validate_tree()` call remained pristine.

Warm-cache mutation, same-size content mutation, `A -> B -> A`, current then
historical and historical then current call orders, different repository/ref
contexts, and invalid-context failure all passed under Python 3.13.2 and
Python 3.9.6. The automatic isolation self-check executed exactly once through
`validate_tree()` and changed neither returned validation results nor the
printed control accounting.

The checker separately audited the other performance caches. `line_range()`
and `heading_block()` retain immutable strings; `_pipe_rows()`,
`_parse_canon_population()`, and `_parse_receipt_document()` retain only
tuple-based private results; their public boundaries rebuild fresh lists and
nested row lists. Git/blob/ref caches retain immutable values and separate
repository and ref keys; `Tree` rebuilds its public receipt dictionary. Fresh
mutation probes exposed no other cache leak.

## Control, route, and preservation integrity

AST-level call-sequence review confirmed that `validate_tree()` retains the
completed-R7 baseline validation-stage order, with only the automatic cache
isolation self-check added. The preservation call sequence is unchanged apart
from removal of one unused context construction. All baseline static control
sites remain in their original order, and `run_cases()` is byte-identical from
the structural checkpoint through both performance corrections. No stage,
control, diagnostic, route, preservation check, or production entry point was
removed, weakened, reordered, sampled, or made optional.

The current document tree returned zero validation problems. Preservation
re-resolved these exact nonempty historical populations:

- GROUP index: 12 committed / 61 live;
- LEAF main: 81 committed / 782 live;
- LEAF detail: 81 committed / 782 live;
- XW2 edge: 131 committed / 494 live;
- SRC2 base: 4 committed / 6 live;
- SRC2 official immutable detail: 2 committed / 2 live;
- SRC2 official mutable detail: 2 committed / 3 live; and
- DR2 generic: 47 committed / 264 live.

## Sequential cold validator executions

Each required run used a fresh child process and its own 240-second ceiling.
Runs were sequential, never concurrent.

| Interpreter | Run | Runtime | Result |
| --- | ---: | ---: | --- |
| Python 3.13.2 | 1 | 120.427 s | PASS |
| Python 3.13.2 | 2 | 130.562 s | PASS |
| Python 3.9.6 | 1 | 160.575 s | PASS |
| Python 3.9.6 | 2 | 152.486 s | PASS |

All four outputs were byte-identical at 34,640 bytes with SHA-256
`1a386c0d54ff38ab4caafe91f4994924fd3273c4cfabafe283eadcdb0ce378f0`.
Each contained exactly 238 passing controls in the same order: 20 accepting
and 218 rejecting, zero baseline diagnostics, zero failures, a successful
negative self-test, and a successful silent cache-isolation self-check.

After adding only this receipt and the plan status update, the final acceptance
worktree was required to reproduce two byte-identical complete validator runs
with the same 238 controls, 20/218 classification, zero baseline diagnostics,
successful negative self-test, and successful isolation self-check. Its new
post-acceptance output SHA-256 is
`ef9e58a83098f32f07f7c6bbfda7fe80771ebbe941909e5644a22aa73642cb2c`.

## Additional validation

- Python 3.13.2 compilation: passed.
- System Python 3.9.6 compilation: passed.
- Targeted Markdown lint for the repair plan, maker receipt, and this receipt:
  passed.
- `npm run docs:guardrails`: passed.
- `npm run validate:project`: passed.
- Cumulative and latest `git diff --check`: passed.
- Final checker scope before commit: exactly the repair plan status prose and
  this independent receipt.

## Verdict

**ACCEPT.** The complete cumulative pre-R8 validator-route alignment through
`4e49d799b9e0d3a482ce824c1c5298dea0dc6750`, including both bounded
performance corrections and the final cache-isolation correction, satisfies
the frozen contract and the independent checker requirements.

R7 remains complete. This ACCEPT unblocks R8, but R8 remains unstarted in this
review. Phase 2, W1.1, Architect comparison, application work, data or
configuration changes, Linear, Graphify, and `main` remain blocked and
unstarted.
