# Architect CBA Canon v2 — Same-Family Deferral Compatibility

**Date:** July 24, 2026

**Branch:** `architect/cba-canon-v2`

**Live baseline:** `51adb6d1acd614fafe5b0fadab54b3dd469408ad`

**First compatibility acceptance:** corrective checkpoint
`c3a00637249444190a02a844fe104137ac78da5e`

**Maker role:** delegated Codex maker (`/root/same_family_compat_maker`)

**Independent checker role:** separate read-only Codex checker
(`/root/validation_scout`)

**Parent adjudicator:** root Codex agent

**Status:** truthful-status maker correction complete; **pending independent
checker re-review and not accepted**. R3.1 remains blocked.

## Owner authorization

The owner explicitly authorized this additional checkpoint with:

> Authorize the additional narrow same-family deferral correction

That authorization is limited to the compatibility contract below. It does
not accept R3 or R3.1, begin R4, waive a separate checker, or reopen any other
foundation question.

## Independent checker review history

The independent checker rejected exact maker checkpoint
`726456e35f4f876242499b0ab654bc032d7fd635`. The rejection was limited to
truthful live status: the canon's top pre-R3.1 paragraph and edition-row
summary still called R3.1 unblocked, §19.3 omitted the pending same-family
checkpoint from its current sequence, and the live amendment date remained
July 23. The checker did not reject or reopen the same-family compatibility
contract, its mechanical joins, or any protected population.

Those live mirrors now identify the first compatibility checkpoint as
accepted, this owner-authorized same-family checkpoint as pending independent
checker acceptance, and R3.1 as blocked and not started. This corrected maker
state is pending a fresh independent checker re-review and accepts nothing.

## Blocking contradiction closed

R3.1 must map a fragment of historical `CBA-C13.8` to an existing A-family
owner. The binding fragment rule therefore requires R3.1 to inventory the
whole historical LEAF. Its remaining valid fragment has an honest future
C-family owner that R4 must mint, but the accepted `deferred` grammar formerly
required distinct source/target family tokens. No truthful terminal,
target-bearing, bundle, or distinct-family representation existed.

This checkpoint permits the one representable exception:

- The current earlier unit inventories the historical LEAF because a
  different sibling fragment has a current nonterminal, non-`deferred` edge
  to an existing active target in another family.
- The remaining fragment's natural owner is in the historical source family
  and will be minted by the exact later unit: `C01`–`C13` by R4,
  `C14`–`C25` by R5, and `R`/`L`/`S` by R6.
- No active target exists for the deferred fragment.
- The current `OWN` decision's `Test/tiebreak applied` field is exactly
  `same-family-sibling:<XW2-edge>-><active-v2-LEAF>;
  natural-family:<family>; resolving-unit:R<n>`.

The validator proves the named sibling edge, different fragment, existing
cross-family active target, source family, exact later-unit map, absent
deferred-fragment target, and exact decision-field join. It does not treat a
keyword as evidence that the natural-owner conclusion is true. The
independent checker must judge whether the sibling genuinely forced current
inventory and whether natural ownership is semantically honest.

## Safeguards retained

The exception changes no other deferral rule:

- Target is exactly `—`.
- One edge dispositions exactly one leading fragment and one normalized span.
- The fragment is unbundled; `deferred` is never a `BND-…` member.
- The edge directly references a current non-`DISP` `OWN` record whose result
  is `—`.
- The resolving unit must revise or replace the edge through governed
  `AMEND` lineage when it mints the owner.
- R8 still requires zero current deferrals.
- Ordinary same-family, same-unit, wrong-unit, source-family-mismatched,
  sibling-family-mismatched, and target-bearing deferrals remain invalid.

The intended later R3.1 use is
`CBA-C13.8:F1` with `families:C,C; resolving-unit:R4`, but this compatibility
checkpoint does not mint that edge, fragment, decision, active owner, or any
other concrete governed record.

## Validator controls

The existing distinct-family accepting control and all of its target,
fragment/span, bundle, decision-type, and R8-survival regressions remain.
The same top-level document-tree validator now also runs:

1. a positive migrated-tree C/C control with a different-fragment sibling
   joined to an existing A-family active target, the exact R4 map, no target
   for the deferred fragment, and the pinned `OWN` field;
2. a rejection with no qualifying sibling;
3. a rejection mapping C13 to R5 rather than R4;
4. a rejection whose declared source family mismatches the historical source
   and sibling join; and
5. a rejection where the deferred fragment already has an active target; and
6. a rejection where the named sibling fragment is no longer current.

Two additional live-status regressions reject a pending same-family checkpoint
paired with either a stale top-level “R3.1 unblocked” claim or a §19.3 current
sequence that omits the same-family maker/checker gate.

The bounded control population is 14 accepting controls plus 95 rejecting
regressions, 109 total. The negative self-test remains effective.

## Preservation and scope

- Canon §5.9, historical §§15.1–15.8, scenarios 1–89, the exact SC2 block,
  active §§15.10–15.12, every concrete governed record, and every prior
  receipt are unchanged.
- No identity is minted, renumbered, reused, certified, or accepted.
- Only the canon standard, live repair plan, validator, and this new receipt
  are in scope.
- No substantive R3.1 migration or source-law repair, R4 work, application
  code, runtime inspection, application tests, build, typecheck, data,
  Firestore, Linear, main, Phase 2, W1.1, or graph-output update occurs.

## Maker validation evidence

- Python compilation passes with bytecode redirected to `/private/tmp`.
- Direct validation of the live document tree reports zero problems.
- The complete bounded validator runs twice through the same top-level
  document-tree path with this receipt present. Both runs report 14 accepting
  controls plus 95 rejecting regressions, 109 total,
  `baseline_clean=yes`, an effective negative self-test, and zero failures.
  The 129-line, 16,956-byte outputs are byte-identical with SHA-256
  `9482b6f291a75a04e9f0ad010d483376a2ea24a8b127d703aed0301314f3cea6`.
- Targeted Markdown lint passes for the live repair plan and this receipt.
  Canon-only lint retains exactly the established 74 `MD029` findings in the
  byte-preserved §16 scenario list, with no new rule class or count.
- `npm run docs:guardrails`, `npm run validate:project`, and
  `git diff --check` pass.
- Exact HEAD-to-worktree preservation comparisons pass:
  - §5.9: 6,198 bytes,
    SHA-256 `53c968ade8cdb2177517412ac09f2bae63ee7642cfa3b24299d2b208895fb373`;
  - historical §§15.1–15.8: 90,455 bytes,
    SHA-256 `7b3f6aaba81129dceaa8e55f6356f8bbecd3af7e1ff59b127a443fc5d7b14d97`;
  - SC2: 3,314 bytes,
    SHA-256 `8bf229f5a34e020782e63ef78d3714308c6baf1a8eaba30af6e043a2a7c15eea`;
  - active §§15.10–15.12: 121,040 bytes,
    SHA-256 `ddba52dcd22d1b4d7b91737bc36f5b5dc9d3dbdd2a07d6eefdf349eda12bdce9`;
  - scenarios §16: 24,451 bytes,
    SHA-256 `033d6540eb8a68782782596b1d50eba983c92758bca7981a1a7a96ec92e727e9`.
- The only changed paths are the three authorized live files and this new
  receipt; every prior receipt is absent from the diff.
- Application tests, application build, typecheck, the full suite, and
  `graphify update` were intentionally skipped because this checkpoint changes
  only the canon/plan/validator contract, and its authorized scope expressly
  excludes application and graph-output work.

## Sequence

First compatibility checkpoint independently accepted → this same-family
compatibility maker checkpoint → independent same-family compatibility
checker ACCEPT → R3.1 maker checkpoint → independent R3.1 checker ACCEPT →
R4. Maker completion alone accepts nothing.
