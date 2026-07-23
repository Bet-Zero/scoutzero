# Architect CBA Canon v2.0 — R2.14 ID-Normalization and Status Closure

## Status

R2.14 is a maker-only bounded correction prepared on the independently
rejected R2.13 checkpoint
`818a5d03accbebfec810521a49ef9554ca4f79fa`. The formal R2.13 checker
verdict was **REJECT R2.13 / BLOCK R3.1**.

R2.13 and its maker receipt are immutable rejected history. This receipt is
maker evidence, not independent acceptance. R2.14 accepts no active record
and does not authorize R3.1. The next required event is an independent
checker review of a pinned clean R2.14 checkpoint.

## Exact Scope

The authorized change set is exactly:

- `docs/reference/cba/ARCHITECT_CBA_CANON.md`
- `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md`
- `work/architect-completion/cba_canon_v2_foundation_validator.py`
- `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_14_ID_NORMALIZATION_STATUS_CLOSURE.md`

No prior receipt is edited.

## Checker Blockers

R2.14 closes exactly the two bounded R2.13 findings:

1. Ordinary canon population parsing removed arbitrary leading and trailing
   backticks, while the whole-canon Inventory F audit removed only one
   pair. A valid multi-backtick Markdown ID such as ``SRC2-901`` could
   therefore enter ordinary population membership yet evade displaced-row
   location detection.
2. Five live repair-plan mirrors still called the obsolete R2.12 ACCEPT path
   the current or controlling route. The truthful route must record R2.13
   rejected and keep R3.1 blocked until independent R2.14 acceptance.

## Shared Record-ID Normalization

One deterministic helper now governs directly equivalent ID-cell membership
paths:

1. Trim whitespace outside the table cell.
2. Accept an otherwise plain record ID unchanged.
3. When the entire cell is wrapped by equal, nonempty leading and trailing
   backtick runs, remove that single balanced Markdown fence.
4. Leave malformed, unbalanced, or internally backticked fencing intact so
   no malformed cell becomes a valid governed ID.

Normal canon population parsing, the whole-canon Inventory F location audit,
receipt-population membership, and direct acceptance/proposal membership use
that helper. Inventory F remains the only canon-side source of populations,
ranges, and ID grammars. No validator-side population list or fixed range was
added.

## Validator Evidence

The bounded default suite retains:

- the committed baseline and complete future-R3.1 migrated-document positive
  controls;
- the valid equal-width overlapping OPS/EXT detail positive;
- the four plain exact-width displaced OPS, EXT, EV2, and SXW2 controls.

It adds:

- four exact-width displaced multi-backtick counterparts for OPS, EXT, EV2,
  and SXW2;
- a displaced multi-backtick ID governed only by a synthetic Inventory F
  declaration, proving dynamic grammar/range behavior;
- distinct rejecting repair-plan mutations that reintroduce stale live
  R2.12-current and R2.13-current language; the same route check also rejects
  either obsolete checkpoint as the prerequisite in a live R3.1 blocking
  condition.

Every control uses the same top-level document-tree loader, population
parsers, Inventory F audit, plan checker, and reconciliation engine. The
corrected default was executed twice with `PYTHONDONTWRITEBYTECODE=1` to
freeze this evidence record:

- Run 1: 76/76 controls passed (6 accepting controls and 70 rejecting
  regressions), `baseline_clean=yes`, zero failures; 119.14 seconds.
- Run 2: the same 76/76 result, `baseline_clean=yes`, zero failures; 90.02
  seconds.
- Each complete report is 96 lines and 11,762 bytes with SHA-256
  `4557510c00001d21fa62edd7811f4e5e801b3fa4d50265ee3529a61e80c4d086`.
  A byte-for-byte `cmp` returned zero.

Both runs remained below the four-minute gate. N1–N7 each rejected on its
intended diagnostic; C0, C1, and C4 each accepted.

## Truthful Status

Every live canon and repair-plan status, sequence, and dependency surface now
records:

**R3 rejected → R2.6–R2.13 rejected → R2.14 maker checkpoint → independent
R2.14 checker ACCEPT → R3.1 maker checkpoint → independent R3.1 checker
ACCEPT → R4.**

Historical facts and rule-origin labels remain intact. No obsolete route is
described as current or controlling, and no live R3.1 block waits on
independent R2.12 or R2.13 acceptance.

## Preservation

The correction changes no active §15.10–§15.12 table row. It preserves
§5.9, historical §15.1–§15.8, scenarios 1–89, the exact sixteen-check SC2
contract, every committed governed identity, and every prior receipt.
R2.14 mints no concrete CBA2, XW2, SXW2, SRC2, EV2, DR2, SM2, SS2, BND,
BLK, RES, fragment, scenario-fragment, or date-component record.

## Explicit Exclusions

No R3.1 repair or active-row edit; no C/R/L/S registration; no scenario
construction; no README, code-map, application, runtime, application test,
schema, fixture, configuration, data, Firestore, Linear, Phase 2, W1.1,
main-branch, release, or production work.

## Gate

The maker checkpoint must pass two byte-for-byte deterministic executions of
the committed default validator with bytecode disabled in under four minutes
each, plus bounded syntax, documentation, scope, and preservation checks.
Maker completion alone accepts nothing.

## Bounded Validation Record

Maker validation on July 23, 2026 also established:

- Python compilation passed with bytecode redirected outside the workspace.
- `git diff --check`, targeted Markdown lint on the repair plan and this
  receipt, and `npm run docs:guardrails` passed.
- Canon Markdown lint reported only the same 74 pre-existing `MD029` findings
  in protected scenarios as the `818a5d03…` canon.
- §5.9 is byte-identical to HEAD at 6,198 bytes and SHA-256
  `53c968ade8cdb2177517412ac09f2bae63ee7642cfa3b24299d2b208895fb373`.
- Historical §15.1–§15.8 is byte-identical to HEAD at 90,455 bytes and
  SHA-256
  `7b3f6aaba81129dceaa8e55f6356f8bbecd3af7e1ff59b127a443fc5d7b14d97`.
- Historical scenarios 1–89 are byte-identical to HEAD at 24,119 bytes and
  SHA-256
  `eb11bb122840f881204be4d3de9b8a47a680a19622677e4287227730615b311f`.
- Active §15.10–§15.12 table rows are byte-identical to HEAD at 118,104 bytes
  and SHA-256
  `dfcfe209c5629f8f86f1014a7ee42f42012655714c9b28fab048951bb61b1bbd`.
- The exact sixteen-check SC2 block is byte-identical to HEAD at 3,314 bytes
  and SHA-256
  `8bf229f5a34e020782e63ef78d3714308c6baf1a8eaba30af6e043a2a7c15eea`.
- The R2.13 receipt has no diff, and the worktree contains exactly the three
  authorized modified files plus this new receipt.

Application tests, builds, typecheck, ESLint, the full suite, graph updates,
and every excluded R3.1/application/Phase 2 operation were intentionally not
run because they are outside this bounded four-file documentation-validator
repair.
