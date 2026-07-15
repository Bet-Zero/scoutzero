# Architect CBA Canon v2.0 — R2.2: Bounded Foundation Hardening

## Provenance

| Field | Value |
|---|---|
| Repair unit | R2.2 — bounded foundation hardening, ordered after the independent Codex review of R2.1 returned REJECT/BLOCK-R3 for the foundation gate while accepting the clean v2 architecture in direction. The architecture was **not** redesigned |
| Branch | `architect/cba-canon-v2` |
| Baseline commit | `05c1b28eaef958ae96b9043dc5b8c85d49c6b6cf` (R2.1 checkpoint = origin at session start; R1.1 = `1532c928…`; R2 = `056b9d02…`; R1 = `af931e90…`; `main` = `origin/main` = `69f8f6b6…`) |
| Evidence base | The independent Codex review of R2.1 and its ordered gap list; the R2.1 receipt; the R1.1 receipt; the v1.1 acceptance review and adjudication (both at `9814939c`) |
| Status | **Binding hardening of the R2.1 standard**, published normatively in canon §15.9 (R2.2 edition of the same section — the R2.1 model is hardened, not replaced) |
| Edition status after R2.2 | Canon v2.0 **working draft** — not accepted, not active; v2.0 checksum deliberately **not** computed (R8) |

Files changed in R2.2 — exactly three:
`docs/reference/cba/ARCHITECT_CBA_CANON.md` (standards and annotation
surfaces only), `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md`
(status/sequencing/authority reconciliation), and this receipt. Nothing
else. The R1, R1.1, R2, and R2.1 receipts are untouched immutable review
history.

## 1. Pinned historical scenario identity

The published historical v1.1 scenario identities are **scenarios 1–89
exactly as published at commit `9814939c`** (canon v1.1 file SHA-256
`4a0760c81d7a5e95919a0373d5ff631b565d064d56b858fe3b8869ad2b6bb3f6`,
re-verified byte-exact this session).

**Pinned published scenario source (recorded in canon §15.9.8):** the
bytes of `docs/reference/cba/ARCHITECT_CBA_CANON.md` at `9814939c` from
the first byte of the line `## 16. Acceptance-test library` to the last
byte before the line `## 17. Recommended comparison sequence` —
**14,390 bytes**, SHA-256:

`5289f6b812c2d86238674461574c725e894f0bca0db4da188b276246d96706aa`

Computed this session directly from `git show
9814939c:docs/reference/cba/ARCHITECT_CBA_CANON.md` (both heading
markers occur exactly once in that edition; the extracted range therefore
contains the §16 heading, all subsection headings, and scenarios 1–89 as
published, ending with the blank line before the §17 heading).

Binding treatment now in canon §15.9.8:

- The scenario crosswalk's historical source is the pinned published v1.1
  scenario set at `9814939c` — every `SXW2-…` edge identifies its
  historical scenario by number in that pinned set, never the
  legacy-numbered working copy on this branch.
- The R1/R1.1 corrected scenario variants (the branch's rewrites of
  scenarios 50, 53, 57, 60, 67, 68, 69) are **repair-source inputs for
  authoring `CBA2-SC-…` scenarios at R7 only**; they do not retroactively
  redefine historical scenario numbers and are never crosswalk sources.
- Three populations are named and may never be conflated: published v1.1
  meanings (historical), R1/R1.1 corrections (v2 authoring inputs), and
  the active v2 library — neither of the first two is the active library.
- The R2.1 wording "as amended through R1/R1.1" is removed from the
  binding standard.

Scenarios 1–89 in the working §16 were **not edited** (byte-identical to
R2.1; verified below).

## 2. Deterministic crosswalk edge typing

The eight XW2 edge types remain locked. Canon §15.9.3 now binds:

- **Exactly one primary relationship type per historical-source/
  active-target pair**; no duplicate source–target pair under different
  edge types; movement of a split/merge/partial-overlap fragment is
  recorded in Scope/relationship, never as a second `moved` edge.
- Sharpened type definitions: `equivalent` (whole→whole, same obligation,
  no other owner absorbed, no substantive re-homing), `moved`
  (whole→whole, family/parent changes), `split` (one source's obligation
  divided among multiple targets; fragment wholly owned per target),
  `merge` (whole obligation into a target that also absorbs the same
  obligation from at least one other historical owner — duplicate LEAF or
  named bundle fragment), `partial-overlap` (neither whole side
  equivalent; overlapping fragments and compound split/merge shapes);
  `process-only`/`invalid`/`no-successor` remain terminal.
- A stated **decision order** (terminal tests → whole-to-one
  equivalent/moved → merge → split → partial-overlap), stopping at the
  first matching test.
- Five worked binding examples: equivalent vs moved (`CBA-A21`;
  re-homed `CBA-C20.8`), one source split across two targets
  (`CBA-A19.3`), duplicate sources merged (`CBA-C23.1`/`CBA-C23.4`), a
  bundle fragment merging with another historical owner
  (`CBA-L01.5`/`CBA-C24.1` → merge + partial-overlap), and a terminal
  edge plus separately minted true-gap owner (`CBA-C20.9`).
- Duplicate-edge validation upgraded to **duplicate-pair** validation: no
  two edges share the same historical LEAF and target regardless of type.

The same typing order applies analogously to `SXW2-…` (stated in
§15.9.8).

## 3. Narrow, gateable no-successor

The permissive definition is replaced in the §15.9.3 type table and by a
five-condition rule: valid-as-history; **demonstrably outside the active
v2 canon's approved obligation scope or obsolete for the governed
edition**; exact scope/edition basis recorded in the decision record;
never unresolved/uncertified/inconvenient/deferred/merely unsupported —
`no-successor` can never substitute for failed source certification; and
explicit review at R8 (G3) plus individual R9 review of **every**
disposition, not a sample. A completeness duty is added: every valid
in-scope CBA/BYL/NBA/DERIVED/INFERRED/OPS/EXT obligation discovered
during R3–R6 has an active v2 owner. G3 and the R9 contract were updated
accordingly (canon §15.9.9 and the plan's R8/R9 sections).

## 4. Evidence schema for multiple and non-public sources

Canon §15.9.6 changes:

- `EV2-…` schema now carries **`Source artifact IDs or —`** and
  **`Dependency evidence component IDs or —`** with a pinned grammar:
  `—` or a `", "`-separated ascending list of `SRC2-<NNN>` (respectively
  `EV2-<NNNN>`) IDs, no duplicates, no ranges, no free text.
- Per-class source-reference rules: CBA/BYL/NBA normally exactly one
  official artifact and never `—`; DERIVED may use multiple artifacts
  and/or earlier evidence components with **every formula input resolving
  exactly**; INFERRED identifies **every** component in its reasoning
  chain; OPS `—` only where the provenance record itself carries the
  evidence; EXT `—` when the LEAF defines the decision boundary, with the
  required runtime determination and provenance shape defined in the row.
- `SRC2-…` rows now carry a closed **provenance type** vocabulary:
  `official-immutable`, `official-mutable`, `ops-provenance` (Official
  URL may be `—`; requires named provenance, effective date, verification
  method, limitations, configurability, and an artifact hash where an
  artifact exists), and `ext-contract` (no case-specific ruling need
  exist during canon authoring).
- Secondary operational reporting may establish `ops-provenance` **only
  as OPS authority** — never CBA/BYL/NBA.
- Exact bidirectional reconciliation is bound at three points: U8/U9
  (unit), G14 (global — new gate), and R9 (independent re-run): all
  references resolve, dependency chains are acyclic and bottom out in
  artifacts, LEAF Authority fields ⇔ `EV2` classes reconcile both ways,
  and zero orphan `SRC2`/`EV2` rows or references remain.

## 5. Mandatory duplicate-candidate generation

Canon §15.9.4 now requires each R3–R6 unit to produce a recorded
candidate population from **all seven** generators: the adjudication's
duplicate queue; normalized requirement-text similarity; shared/
overlapping primary locators; correction-table vs substantive-anchor
comparison; lifecycle/summary-ledger vs substantive-owner comparison;
explicit cross-family references and known cross-family pairs; and
reviewer-identified semantic candidates. The tool output is candidate
generation only; every disposition remains a semantic `OWN` record. U5
requires the recorded population plus a disposition for every candidate
(cross-family deferrals only with both families and the resolving unit
named); unit receipts must show zero undispositioned in-scope candidates;
G9 reruns a global cross-family sweep requiring zero unresolved
candidates; R9 independently regenerates the population. The standard
states expressly that this is a systematic search plus semantic
adjudication, never a mechanical uniqueness proof.

## 6. SCEN coverage-completeness gate (SC6)

New gate SC6 (canon §15.9.9): every active LEAF with SCEN as Primary has
at least one active named case genuinely exercising it; every LEAF
listing SCEN as Secondary likewise; every active scenario exercises at
least one active LEAF; every `Exercises:` entry resolves to a named case
and an active LEAF; every register Scenario-evidence entry resolves to
the same named case; no `pending R7` markers remain; and SC1–SC5 cannot
pass through empty-set equality (SC3 reconciliation is invalid if either
side is empty while any SCEN-designated LEAF exists).

## 7. R7 method-reclassification authority (METHOD records)

The recommended rule was adopted and encoded in canon §15.9.8 and the
plan's R7 unit: R7 may make only bounded method-fit corrections to
`Primary method`, `Secondary methods`, `Scenario evidence`, and the
`Decision records` reference — each requiring a `METHOD` decision record
(LEAF, old method set, new method set, why the previous method was
dishonest, resulting evidence requirement). R7 may not change a LEAF's
requirement, authority, source evidence, origin, or dependencies; such
discoveries return to the owning R3–R6 unit. New gate SC7 verifies every
method change has a `METHOD` record and that no R7 edit exceeded this
authority. `METHOD` was added to the §15.9.4 decision-record vocabulary.

## 8. Strict construction sequencing

Canon §15.9.2 and the plan now bind **R3 → R4 → R5 → R6 strictly**: R4
depends on completed R3, R5 on completed R4, R6 on completed R5 — all
units extend the shared §15.10–§15.12 sections and allocate from the
shared XW2/SRC2/EV2/DR2 namespaces. "R3 not strictly required" is
removed. No parallel allocation ranges and no alternative namespace
scheme were added.

## 9. Draft-correction traceability (AMEND)

Canon §15.9.2's draft-mutability rule now requires an `AMEND` decision
record (added to §15.9.4) for any correction of earlier-registered active
records, carrying: the prior checkpoint and prior DR IDs; the old draft
ID(s); the current draft ID(s) or removal disposition; the reason;
confirmation that every live crosswalk/evidence/origin/method/scenario/
dependency reference was updated in the same commit; and the superseding
disposition. Binding rules: prior receipts stay immutable and
commit-scoped; a reader resolving an ID or DR cited in an earlier receipt
follows the `AMEND` chain forward; current registers/crosswalks cite only
current, resolvable decision records; a later correction never edits an
earlier receipt; R8 gate **G15** requires zero stale live references to
superseded draft IDs or DRs; R9 verifies the amendment chain; after R9
ACCEPT, active IDs are immutable.

Why this is not the rejected R2 machinery: lineage lives in decision
records inside immutable receipts, not in the registers — no
RETIRED/ALIAS roles, no tombstone rows, no same-namespace migration. The
registers always show only current records. This is the simplest rule
that keeps every earlier receipt resolvable, because the receipts are the
only immutable surfaces and each correction mints exactly one forward
pointer there.

## 10. Old-ID audit guidance removed

- Canon §1.2's Stable-ID row no longer reads "Existing `CBA-A/C/R/L` ID
  or a new durable ID"; it now binds: after R9 ACCEPT every Phase 2
  verdict is keyed only to an active `CBA2-…` LEAF; historical `CBA-…`
  IDs appear only in history/crosswalk references; GROUPs, scenarios,
  crosswalk edges, source artifacts, evidence components, and decision
  records never receive compliance verdicts.
- Canon §17's "For every ID" now reads "For every active v2 LEAF", with
  the same keying restriction restated.
- Consistency sweep result: the only other non-historical surface that
  could be read as inviting audits of historical IDs was the §15 intro
  above the frozen candidate tables; a clearly labeled **v2.0 status
  note** was added there stating that §15.1–§15.8 are frozen historical
  migration inputs and never verdict-bearing. All remaining `CBA-…`
  verdict-adjacent text sits inside the frozen historical registry
  (§15.1–§15.8, scenarios 1–89) or in superseded/historical labels, which
  R2.2 does not edit by design. G7 continues to ban historical IDs from
  verdict columns globally.

## 11. Verification-status continuity (§19.3)

Canon §19.3 now carries a binding continuity block: the family-level
"Primary-source verified" rows are **legacy v1.0/v1.1 status claims**,
not active v2 per-LEAF certification (parts of the legacy claim were
falsified by the independent v1.1 review); R3–R6 replace them family by
family with `SRC2-…`/`EV2-…`-backed certification (assigned in the plan's
R3–R6 required output); R8 reconciles the final status table against the
completed active registry (assigned in the plan's R8 unit); and no family
may be called fully v2-certified until every active LEAF in it passes
U8/U9/U14. No family certification was performed in R2.2.

## 12. Repair-plan status reconciliation

The plan now states: R2.1 executed at `05c1b28e` but independently
rejected as the final foundation gate (architecture accepted in
direction); R2.2 is the bounded hardening unit (new R2.2 section with
inputs/outputs/exclusions/stop condition); **R3 remains blocked pending
independent Codex acceptance of R2.2**; all Phase 1/Phase 2/W1.1/`main`/
checksum/independence boundaries unchanged. Global rule 1 now includes
R2.2 in the fresh-session unit list. R8's gate list is G1–G15; R9's
duties include the candidate regeneration, exhaustive no-successor
review, and amendment-chain verification.

## Validation performed (R2.2)

- **Baseline verified before work:** HEAD = `origin/architect/cba-canon-v2`
  = `05c1b28eaef958ae96b9043dc5b8c85d49c6b6cf`; R1.1 checkpoint
  `1532c9286e85bfaf2760006923a01eb0ecce9a78` present in history; `main` =
  `origin/main` = `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`; working
  tree clean.
- **Files changed:** exactly the canon, the repair plan, and this receipt.
- **Historical-integrity checks (recorded in the R2.2 report):** the v1.1
  canon at `9814939c` re-hashed to `4a0760c8…` exactly; the pinned
  scenario-section hash `5289f6b8…` computed from those bytes; scenarios
  1–89 and the historical register rows (§15.1–§15.8, §16 numbered
  entries) byte-unchanged versus the R2.1 checkpoint; no
  CBA2/XW2/SXW2/SRC2/EV2/DR2 record created (the namespaces remain
  defined-only).
- `npm run lint:md` run at checkpoint (pre-existing accepted MD029
  continuous-numbering class in §16 only, plus pre-existing errors
  confined to unrelated files).
- `npm run docs:guardrails` run at checkpoint: pass.
- No app tests run (documentation/standards change per repair-plan global
  rule 6).

## Confirmation

R2.2 hardened the foundation standard only. No active v2 register row,
crosswalk edge, evidence row, decision record, or scenario was created —
R3–R7 own construction. Historical register rows, scenarios 1–89, source
values, the code map, the README, the R1/R1.1/R2/R2.1 receipts, the
historical review artifacts, application code, tests, schemas, fixtures,
configuration, and data are unchanged. Linear was not read or written.
R3–R9, Phase 2, and W1.1 were not started. **R3 remains blocked pending
independent Codex review of R2.2.**
