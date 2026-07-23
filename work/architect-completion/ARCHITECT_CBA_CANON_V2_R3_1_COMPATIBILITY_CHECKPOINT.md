# Architect CBA Canon v2 — Pre-R3.1 Compatibility Checkpoint

**Date:** July 23, 2026

**Branch:** `architect/cba-canon-v2`

**Accepted foundation baseline:** `97ec7919a4b4b57be227e8ba07ac77f5df208d0b`

**Maker role:** delegated Codex maker (`/root/compatibility_maker`)

**Parent adjudicator:** root Codex agent

**Status:** maker correction complete; pending independent checker review and
not accepted

## Decision

The one-time compatibility audit classified one bounded theme as
**blocking**: the accepted standard required traceable stable-ID repair and
exhaustive historical-fragment disposition, while the committed validator and
two fragment representations could reject honest R3.1 work or accept
untraceable work.

This checkpoint corrects that theme in place. It is not an R2.x reopening,
does not repair an active A-series row, and does not begin R3.1.

## Blocking facets closed

1. Current GROUP children and the XW2/EV2 namespaces may contain a gap only
   when the pinned prior identity resolves through exact governed `AMEND`
   lineage; additions still allocate above historical high-water marks, and
   reuse or renumbering remains forbidden.
2. A changed same-ID governed record now requires exactly one matching
   `AMEND` revise. Versionless populations use `—` versions; explicitly
   versioned populations retain exact numeric version progression.
3. Every AMEND prior identity resolves in the exact named governed population
   at the pinned checkpoint. Free prose and a same-shaped ID in another
   population prove nothing.
4. Historical LEAF text and Authority values are derived only from the exact
   pinned published LEAF register table, so top-level LEAFs cannot resolve to
   hierarchy-summary marker text.
5. The fragment inventory carries an exact historical Authority qualifier for
   `authority-assertion` fragments. Its requirement-text span remains the sole
   coordinate domain; the qualifier narrows the enforceability claim without
   declaring the reported mechanic disproved.
6. A narrow nonterminal `deferred` XW2 shape represents a fragment whose
   owner belongs to a later R4–R6 family. It has target `—`, names both
   families and the exact resolving unit, references a current non-DISP
   ownership decision, and must exit through `AMEND` before R8.
7. Untyped live status prose is corrected directly and immutable receipt
   assertions are contradicted by later receipts. AMEND remains reserved for
   governed records; no fictitious status-claim population is created.

## Balanced maker/checker boundary

The validator owns deterministic structure: schema and header equality,
population-scoped identity, exact references, high-water allocation, AMEND
lineage, fragment coordinates and joins, direct-current references, and
negative controls.

The independent checker still owns source truth, semantic identity,
atomicity, ownership, fragment exhaustiveness, the honesty of a deferral, and
whether the recorded controls cover the real repair need. Passing software is
necessary evidence, never self-acceptance.

## Preservation and scope

- Active canon record tables in §§15.10–15.12 are unchanged.
- Historical §§15.1–15.8, §5.9, scenarios 1–89, and every prior receipt are
  unchanged.
- No governed record is minted, renumbered, reused, certified, or accepted.
- No C/R/L/S registration, scenario work, application/runtime/test-fixture
  work, README, code map, Linear, Firestore, Phase 2, W1.1, R4, or main-branch
  work occurs.

## Maker validation evidence

- Python compilation passed with bytecode redirected to `/private/tmp`.
- The complete default validator ran twice through the same top-level
  document-tree path with this receipt present. Both runs completed in about
  78 seconds: 12 accepting controls plus 81 rejecting regressions, 93 total
  cases, `baseline_clean=yes`, negative self-test `yes`, and zero failures.
  Their complete outputs were byte-identical with SHA-256
  `c49e2c726df7c85f73eaff2afad317db1ac2bc2e5a70a61f3c47caa61beecf12`.
- The focused real split control resolves LEAF, XW2, and EV2 priors at the
  protected R3 checkpoint `07f0667d…`; no later checkpoint substitutes for
  missing parser coverage.
- Targeted Markdown lint for the live plan and this receipt passed. Canon-only
  lint retained exactly the established 74 MD029 findings; global docs lint
  retained exactly the established 127 findings (74 canon MD029 plus 53
  unrelated MD022/MD032/MD034 findings), with no new rule class or count.
- Workspace documentation guardrails and `git diff --check` passed.
- The preserved SC2 block remained exactly 3,314 bytes with SHA-256
  `8bf229f5a34e020782e63ef78d3714308c6baf1a8eaba30af6e043a2a7c15eea`.
- No active `CBA2`/`XW2`/`SRC2`/`EV2` table row differs from the accepted
  foundation baseline.

## Checker handoff

The checker must review the committed checkpoint read-only, rerun the default
validator, inspect the binding canon/plan/validator diff, verify the protected
ranges and active tables, and return an explicit ACCEPT or REJECT with
line-specific findings. Until ACCEPT, R3.1 remains blocked and R4 remains
unstarted.
