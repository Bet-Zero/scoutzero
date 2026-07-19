# Architect CBA Canon v2.0 — R2.7 Receipt: Foundation Executability Closure

## 1. Provenance, baseline, and clean-state proof

| Field | Value |
|---|---|
| Repair unit | R2.7 — post-R3 foundation mechanical closure: the Codex R2.6 rejection findings (false source-date semantics; fragment-completeness and DISP-reconciliation gates not mechanically closed) corrected in the governing standard and non-active status/source-law surfaces only. No committed R3 record repaired; no concrete v2 record minted |
| Branch | `architect/cba-canon-v2` |
| Baseline commit | **`51e60bf606f5a4ea4547e7f4e163bdcac2863d26`** — the rejected R2.6 checkpoint, verified at session start as HEAD = `origin/architect/cba-canon-v2` (ahead/behind vs upstream 0/0); direct parent = `07f0667d8cc55a6b86bd4c3fabada5d9b6d7d956` (R3, the rejected R3 checkpoint); prior chain: R2.5 = `6d9c7576…` (accepted pre-R3 foundation); R2.4 = `e0344aac…`; R2.3 = `c2228607…`; R1.2 = `07d5aa58…`; R2.2 = `6aa616fd…`; R2.1 = `05c1b28e…`; R1.1 = `1532c928…`; R2 = `056b9d02…`; R1 = `af931e90…` |
| `main` | `main` = `origin/main` = `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288` — untouched by this unit |
| Clean-state verification | `git status --porcelain` empty at session start: worktree, index, and untracked state completely clean |
| Ordering review | The independent Codex review of the R2.6 checkpoint at `51e60bf6…` returned **REJECT/BLOCK-R3.1** (§3 below). R3 remains rejected (REJECT/BLOCK-R4 at `07f0667d…`); the R2.6 and R3 receipts remain immutable review history; their incorrect or incomplete claims are superseded by this receipt, never by editing them |
| Scope | Foundation contract (canon §15.9.1–§15.9.6, §15.9.8, §15.9.9), non-active status/source-law surfaces (§12.12, §15.10 intro prose, §19.3, header/amendment log), and repair-plan status/sequencing/backlog only. Every active §15.10–§15.12 record-table row is byte-identical to `51e60bf6…` (§21 below) |
| Edition status after R2.7 | Canon v2.0 **working draft** — not accepted, not active; **R2.7 is not independently accepted**; R3 remains rejected; no A-series record is accepted; R3.1 and R4 remain blocked (§17 below); v2.0 checksum deliberately **not** computed (R8) |

## 2. Files changed — exactly three

1. `docs/reference/cba/ARCHITECT_CBA_CANON.md` — the §15.9.6 `basis:value`
   source-date model (abolition of the slash-combined
   `Publication/effective date` field; closed basis vocabulary; per-basis
   value grammars; `—` pairing rules; basis-aware month-precision rule;
   date-component detail table; detail-parenthetical, season-grammar,
   per-type-matrix, and field-level-validation conforming edits); the
   §15.9.3 historical-fragment inventory contract (fragment-ID grammar,
   kinds, per-LEAF completeness contract, terminal-uniqueness rekey,
   nine-type vocabulary count, schema-row and decision-order conforming
   edits, crosswalk-validation rewrite) and the
   `blocked-unsupported-obligation` stop condition with the restated
   completeness duty; the §15.9.6 `SM2-…` search-manifest contract; the
   §15.9.4 `DISP` detail schema, edge-type ⇔ decision-type compatibility
   matrix, cross-field/reconciliation rules, direct-current-reference
   rule, and the pinned `DR2-0037`/`DR2-0038`/`DR2-0039` transition; the
   §15.9.5 A18.7 express-vs-INFERRED correction; the §15.9.8 scenario-53
   wording and SXW2 terminal-reference/uniqueness conforming edits; the
   §15.9.9 gate updates (U5/U7/U8/U9, G1/G3/G14/G15, SC2 check 11 only,
   the new `G15R` block, R9); the §15.9.1 support-population note and
   §15.9.2 population/namespace/sequencing updates; the §15.10
   non-record intro prose correction; the §12.12 and §19.3 corrections;
   and the header (amendment date, "What v2.0 changes" R2.7 sentences
   and R2.6-outcome truth-up, one new amendment-log row).
2. `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md` —
   status brought current (R2.6 executed at `51e60bf6…` and independently
   REJECTED; the strict R2.7 → review → R3.1 → review → R4 sequence); the
   R2.6 unit outcome; the new R2.7 unit section; the R3.1 section
   (blocked on R2.7 acceptance; `G15R`; backlog items 4, 5, 11, 12, 13
   updated and new items 16–21 added); the R4 dependency; and the R8/R9
   gate restatements conformed to the corrected canon gates.
3. `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_7_FOUNDATION_EXECUTABILITY_CLOSURE.md`
   — this receipt (new).

Nothing else. No earlier receipt was edited — including the rejected
R2.6 and R3 receipts. No application, README, code-map, test, schema,
fixture, configuration, or data file changed; Linear was not read or
written; no PDF was committed.

## 3. Full Codex R2.6 rejection findings (the ordering input)

Verdict, verbatim: **"REJECT/BLOCK R3.1 — source-date semantics remain
false, and fragment-completeness/DISP reconciliation gates are not
mechanically closed."**

The ordered corrections carried by the review (each independently
verified against the binding language and primary sources this session
before implementation):

1. **Truthful source-date model** — the slash-combined
   Publication/effective date field asserted false semantics (the
   committed `SRC2-001` value is the agreement-as-of date, not a
   publication or effective date; the R2.6 `YYYY-MM` rule still labeled
   the June 2024 By-Laws cover month as a publication/effective value);
   value and basis must be separate machine-parseable components with a
   closed basis vocabulary, and multiple distinct semantic dates must be
   representable without conflation.
2. **Parseable historical-fragment inventory** — the standard could not
   mechanically prove every fragment of a historical obligation was
   identified; a fragment-ID grammar, kinds, exhaustiveness,
   non-overlap, exactly-once disposition, and bidirectional
   reconciliation were ordered, with terminal uniqueness rekeyed to
   historical source LEAF + fragment identity and the literal
   eight-type vocabulary count corrected to nine.
3. **Wholly unsupported valid obligations** — `unsupported-residual`
   requires a supported sibling; the mandatory outcome for a whole
   unsupported valid in-scope obligation must be a blocking
   foundation/adjudication stop, never a terminal escape.
4. **Parseable search manifest** — prose-only "bounded search" proofs
   replaced by structured search records with a closed result
   vocabulary that can never encode "none exists"; the signed CBA and
   first-party sources re-read in this session rather than relying on
   R3's certification.
5. **Fixed DISP detail schema** — pinned parseable fields joined to the
   generic DR2 record, an edge-type ⇔ decision-type compatibility
   matrix, and a direct-current-reference rule (no live edge relying on
   an old decision reachable only through an `AMEND` chain), traced
   through every dependent gate.
6. **Terminal-edge and SC2 reconciliation** — SC2 check 11 strengthened
   inside the unchanged sixteen-check block; terminal XW2 uniqueness
   rekeyed so two terminal fragments of one source can coexist.
7. **R3.1-local AMEND/current-reference gate** — a named, scoped
   repair gate equivalent to the relevant portions of G15, run at the
   R3.1 checkpoint.
8. **A18.7 authority classification** — VII §8(a) expressly establishes
   only the general rule; the conditional-cash application requires a
   separately identified INFERRED chain; non-active surfaces corrected
   now, active rows by R3.1 `AMEND`.
9. **Transition and backlog completeness** — the `DR2-0037`/`DR2-0038`/
   `DR2-0039` transition reconciled from the committed R3 tables, the
   two `process-only` edges compared, and the complete R3.1 backlog
   preserved (including the Codex receipt-reference errors and `DISP`
   as a valid terminal outcome in duplicate-candidate reconciliation).
10. **Truthful status and sequencing** — every binding surface corrected
    to R3 rejected → R2.6 rejected → R2.7 → independent Codex R2.7
    review → R3.1 → independent Codex R3.1 review → R4.

## 4. Source-date model — before and after (Correction 1)

**Primary-source verification performed this session (never relying on
R3's certification).** The selected signed CBA binary — the artifact of
record behind committed `SRC2-001`:

| Identity component | Value |
|---|---|
| Canonical URL | <https://ak-static.cms.nba.com/wp-content/uploads/sites/4/2023/06/2023-NBA-Collective-Bargaining-Agreement.pdf> |
| Size | 2,850,534 bytes |
| SHA-256 | `bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32` — **exact match to the committed SRC2-001 hash**, so the artifact examined is the artifact of record |
| Pagination | 676 PDF pages; printed page = PDF page − 24; exhibits paginated A-1 onward (printed page A-n = PDF page 584 + n) |
| Signature/as-of information | Cover carries the edition identifier "COLLECTIVE BARGAINING AGREEMENT JULY 2023" (month precision; an edition identifier, not a publication statement). Article I §1(d), printed p. 1 (PDF 25): "'Agreement' means this Collective Bargaining Agreement entered into as of June 28, 2023." Article XXXIX §1, printed p. 542 (PDF 566): "This Agreement shall be effective from July 1, 2023 (except with respect to provisions that the parties have specifically agreed herein will commence earlier) and … shall continue in full force and effect through June 30, 2030" |
| Retrieval timestamp | 2026-07-19T06:07:47Z |

**First-party surface check (truthful statement).** The live
`official.nba.com` homepage was retrieved this session
(2026-07-19T06:07:47Z–06:11:02Z window). It links a **distinct CBA
binary**:
`https://ak-static.cms.nba.com/wp-content/uploads/sites/4/2024/06/2023-NBA-Collective-Bargaining-Agreement-Final.pdf`
— 2,903,978 bytes, SHA-256
`cf59d43fe46f63d7ba07364563046d766c487c26032fcc88432310d47effd9d9`,
686 PDF pages, retrieved 2026-07-19T06:11:02Z, cover "NBA / NBPA
COLLECTIVE BARGAINING AGREEMENT JULY 2023". Direct inspection confirmed
the same agreement text: the identical §1(d) as-of sentence (PDF 26),
the identical Article XXXIX §1 effective sentence (PDF 567), and the
identical VII §8(a) 5.15% rule (PDF 285). It is a later **production**
of the same JULY 2023 agreement, not a later agreement.
**No later governing agreement text was located in the searched
first-party sources.** (This is deliberately not a claim that "no later
CBA edition exists.") The homepage also links the committed June 2024
By-Laws URL and the committed 2024-25 CBA 101 URL — no newer By-Laws or
CBA 101 edition was located there. `official.nba.com/cba/` itself
returned 403/404 to this session's clients and could not be inspected.

**Why the old field was false.** One field labeled
"Publication/effective date" asserts two semantic claims at once and
lets neither be validated. Under it the committed `SRC2-001` records
`2023-06-28` — actually the **agreement-as-of** date of a source whose
stated **effective** date is 2023-07-01 and whose cover carries the
**edition** month JULY 2023 — and the committed `SRC2-002` records a
**metadata-derived** `2024-06-07` for a month-identified edition. Even
R2.6's month rule still labeled the By-Laws cover month a
"publication/effective" value; a cover month identifies an edition and
states neither publication nor effectiveness.

**Before → after:**

| Surface | Before (R2.6 edition at `51e60bf6…`) | After (R2.7) |
|---|---|---|
| Base field 4 | `Publication/effective date or —` — one bare date under a two-headed label | `Source date (basis:value) or —` — exactly one `<basis>:<value>` pair or exactly `—`; a lone value, lone basis, `basis:—`, or `—:value` is malformed |
| Date semantics | Implied by the label; unverifiable | Closed basis vocabulary: `publication` \| `effective` \| `edition` \| `agreement-as-of`; a value establishes only its own basis |
| Edition months | `2024-06` treated as a month-precision *publication/effective* date | An edition identifier is recordable **only** as `edition:…` — `2024-06` may represent the June 2024 By-Laws only with basis `edition`; `publication:2024-06`/`effective:2024-06` for a cover month **fail** |
| Metadata | Prohibited as a day source for the one field | Prohibited as a value source for **every** basis (PDF creation/modification metadata, URL paths, HTTP headers/timestamps, retrieval/authentication timestamps, inference) |
| Precision | `YYYY-MM-DD`; `YYYY-MM` under the four-condition rule | Unchanged grammars, basis-aware: exact days stay `YYYY-MM-DD`; `YYYY-MM` only where the source supplies exactly a month **for that basis**, with the mandatory limitation entry; exact precision never degraded; seasons only as `edition:YYYY-YY` (official-mutable); `effective` windows retained |
| Multiple semantic dates | Impossible without conflation | Fixed, joinable **date-component detail table**: `Record ID \| Date basis \| Date value \| Source statement locator \| Limitations or —`; at most one current row per (Record ID, basis); base pair must equal one row; every relied-on semantic date is a row — never aligned prose or delimiter lists. The signed CBA's three dates (`agreement-as-of:2023-06-28`, `effective:2023-07-01`, `edition:2023-07`) are the proving example — one pair cannot carry them |
| Propagation | — | Base schema, `official-immutable`/`official-mutable` detail parentheticals, season-grammar hook, per-type validity matrix, field-level validation, U8, U9, G14, R9, §15.9.2 population lists (date-component rows under `AMEND`), G15, and the repair plan's R3.1 duties |
| Committed records | `SRC2-001` (`2023-06-28`), `SRC2-002` (`2024-06-07`) unrepaired | Still unrepaired **by design** — R2.7 amends no committed record; migration is R3.1 backlog items 5 and 18 (`SRC2-002` → `edition:2024-06` + limitation; `SRC2-001` → the truthful base pair plus date-component rows for all three supported dates) |

Unchanged neighbors: retrieval/authentication timestamps and the three
split verification-metadata fields keep their accepted exact grammars
and never supply any source-date value.

## 5. Historical-fragment inventory schema and reconciliation contract (Correction 2)

As now binding in canon §15.9.3 (schema only — **no concrete fragment
record was minted in R2.7**; every ID below and in the canon examples is
illustrative):

- **Fragment-ID grammar:** `<historical LEAF ID>:F<n>` — per-LEAF,
  contiguous from `1` at declaration, append-only, never reused or
  renumbered; splits/merges allocate above the LEAF's fragment
  high-water mark. A whole-obligation LEAF is its single `:F1`.
- **Row schema (performing unit's receipt):**
  `Fragment ID | Historical parent LEAF | Fragment kind | Normalized fragment scope | Decomposition decision record | Disposition edge ID(s) | Current status/version | Limitations or —`
- **Closed kinds:** `substantive-obligation`, `authority-assertion`,
  `process-instruction`, `gap-assertion` — the load-bearing separation:
  a false `authority-assertion`/`gap-assertion` fragment may be
  `invalid`; a merely unsupported `substantive-obligation` fragment is
  **not thereby invalid**; `unsupported-residual` may disposition only
  a `substantive-obligation` fragment; `process-only` only a
  `process-instruction` fragment; checked mechanically wherever both
  sides are recorded.
- **Per-LEAF completeness contract:** declared exhaustive
  decomposition; pairwise non-overlapping scopes; no silently omitted
  residual; every fragment dispositioned exactly once (one terminal
  edge, or one complete nonterminal disposition bundle under
  split/merge/`partial-overlap` semantics — one fragment may map to
  multiple active targets through its bundle without contradictory
  dispositions; never two terminal edges; never terminal + active);
  bidirectional edge ⇔ fragment reconciliation (edges carry a pinned
  leading `[<fragment ID>]` token; zero orphan fragments; zero edges
  naming an unregistered fragment; every referenced edge points back to
  the same historical LEAF and fragment); and semantic exhaustiveness
  review alongside — never instead of — mechanical reconciliation.
- **Transition:** committed R3 edges predate the contract; R3.1
  declares the inventories and migrates the edges through `AMEND`
  lineage (backlog item 16).
- **Vocabulary count corrected:** the XW2 schema row now reads "One of
  the nine types below" (the R2.6 text still said eight while listing
  nine).
- **Gate propagation:** U7 (unit-local reconciliation), G1 (global
  reconciliation), G3 (terminal review), G15/`G15R` (fragment rows as
  an `AMEND`-governed population), R8/R9 duties, and the SXW2 analog in
  §15.9.8.

## 6. Blocking outcome — wholly unsupported valid obligations (Correction 3)

As now binding in canon §15.9.3: where a **whole** valid, in-scope
`substantive-obligation` (a whole historical LEAF, or a fragment with
**no supported sibling**) has no qualifying authority located after the
required `SM2-…` searches, the mandatory outcome is
**`blocked-unsupported-obligation`** — a blocking stop condition:

1. No edge may be recorded (not `no-successor`, not `invalid`, not
   `unsupported-residual`).
2. The construction unit cannot pass: the blocking finding is recorded
   (LEAF, fragment, `SM2-…` records, honest not-located basis), U7
   fails, and the unit stops for an explicit foundation or adjudication
   decision.
3. The discovery candidate is preserved at a named canon anchor.
4. No active authority, behavioral verdict, registration, or
   enforcement arises.
5. Never usable for incomplete research, inconvenience, or failed
   certification of an obligation whose qualifying authority exists.
6. Pinned resume action: a recorded foundation amendment or
   adjudication decision that supplies the honest disposition path,
   mints the owner from located authority, or determines out-of-scope
   status with a recorded basis (making `no-successor` honest) — then,
   and only then, construction resumes.

The §15.9.3 decision order expressly excludes this case from every
terminal test; the completeness duty names it; U7/G1/G3 gate it.

## 7. Search-manifest schema (Correction 4)

As now binding in canon §15.9.6 (`SM2-<NNNN>`; schema only — **no
concrete live search record was minted in R2.7**):

`Search record ID | Subject historical LEAF | Subject fragment ID | Authority/provenance class searched | Source identity | Source record ID or — | Canonical URL or authenticated provenance identifier or — | Binary/version identity or — | Size/hash/pagination/signature or — | Exact locator/query/provision | Search method | Search cutoff timestamp | Result | Result details | Limitations or — | Verifier identity | Verification session ID | Verification date | Current status/version`

Key rules: closed result vocabulary `qualifying-authority-located` /
`no-qualifying-authority-located-in-searched-sources` / `inconclusive`
— it **cannot encode "none exists"**; required class coverage before
`unsupported-residual` (signed CBA; controlling By-Laws where plausibly
applicable; official NBA explanatory and annual-value surfaces;
first-party operational-provenance availability; plus any further class
the unit's reasoning identifies), with every relied-on `SM2-…` ID
listed in the `DISP` detail row; cross-class reconciliation (any
located result forbids the disposition and routes to the normal
evidence process; `inconclusive` never counts and must be resolved);
adequacy rules (exact source identity, binary/version identity for
artifacts, exact locator/query, cutoff, closed result — vague surfaces
fail); `AMEND` supersession of obsolete searches with same-commit
reference updates; zero-orphan/current-reference rules; R8 (G3) and R9
individual review duties.

## 8. Fixed DISP detail schema (Correction 5)

As now binding in canon §15.9.4 — one pinned detail row per covered
terminal edge, joined to the generic `DR2-…` row:

`DR2 record ID | Historical source LEAF | Fragment ID | Terminal edge ID | Terminal edge type | Search-manifest IDs or — | Evidence/provenance references or — | No-owner reason | Preserved candidate anchor or — | Limitations | Reopening condition | Superseding/current relationship or — | Status | Version`

Grammars and `—` rules pinned per field (§15.9.4): closed no-owner
vocabulary `false-claim` / `process-material` /
`out-of-scope-or-obsolete` / `authority-not-located`; `SM2` references
never `—` for `unsupported-residual` and permitted `—` for the other
terminal types; candidate anchor never `—` for `unsupported-residual`;
status vocabulary `current` / `superseded`; integer versions; §15.9.6
delimiter/reference grammars; a required-but-unknown field fails the
record. One `DISP` may cover multiple edges (multiple detail rows) only
where their terminal bases are demonstrably identical.

## 9. Edge-type ⇔ decision-type compatibility matrix (Correction 5)

| Edge / reference | Required decision record | Required no-owner reason | Forbidden |
|---|---|---|---|
| Terminal `process-only` | Current `DISP` (direct reference) | `process-material` | `OWN`, `ATOM`, `MOVE`, `ORIGIN`, `TG`, `METHOD`, any superseded record |
| Terminal `invalid` | Current `DISP` (direct reference) | `false-claim` | Same |
| Terminal `no-successor` | Current `DISP` (direct reference) | `out-of-scope-or-obsolete` | Same |
| Terminal `unsupported-residual` | Current `DISP` (direct reference) with `SM2-…` IDs and a preserved-candidate anchor | `authority-not-located` | Same |
| Nonterminal edge / register decision reference | The correct current non-`DISP` type per its §15.9.4 role | — | Any `DISP` record; any superseded record |

## 10. Bidirectional reconciliation rules (Correction 5)

As now binding (§15.9.4 cross-field requirements; gated at U7/U9, G3,
G15/`G15R`, SC2 check 11, R9):

1. Every terminal `XW2-…`/`SXW2-…` edge references a **direct, current
   `DISP` record** — no live edge may rely on an old decision reachable
   only through an `AMEND` chain; `AMEND` reference updates land in the
   same commit; the chain exists for lineage only.
2. Every nonterminal decision reference resolves to the correct current
   non-`DISP` decision type.
3. Bidirectional subject agreement: the detail row's source LEAF,
   fragment, edge ID, scope, and terminal type agree with the edge —
   and the edge agrees back.
4. Every current `DISP` detail row has exactly one current generic
   `DR2-…` parent; every current terminal edge has its required current
   `DISP` detail row.
5. Zero orphan current `DISP`/decision records; zero stale live
   decision references.
6. No duplicate decisions: at most one current `DISP` detail row per
   terminal fragment (source LEAF + fragment ID) and basis.

Until R3.1 lands, the committed pre-R2.7 records are a known,
backlogged nonconformity — expressly not a permitted end state.

## 11. Terminal uniqueness correction (Correction 6)

Before: the duplicate-pair rule keyed every edge on (historical LEAF,
target) — with terminal targets all `—`, two different terminal
fragments of one source would collide. After: **terminal edges are
unique per historical source LEAF + fragment ID** (two terminal
fragments of one LEAF coexist); **nonterminal edges keep the (source,
target) pair key** with exactly one primary relationship type per pair.
Applied in §15.9.3 (fragment contract + crosswalk validation), §15.9.8
(SXW2 analog: historical scenario + dispositioned fragment/scope), U7,
G3, and the checker (§18–§19, cases 7–8).

## 12. Strengthened SC2 check 11 (Correction 6)

The sixteen-check SC2 block changed **only inside check 11** (before:
"Every decision-record reference resolves."). Check 11 now requires:
resolution to the **correct current** decision record; every terminal
SXW2 edge carrying a **direct** reference to a current `DISP` record of
the matching terminal type with bidirectional
scenario/fragment/edge/scope/type agreement; no terminal reference to
`OWN` or any incompatible record; zero references resolving only
through superseded pre-`AMEND` records; zero orphan current scenario
`DISP` records; and correct current non-`DISP` types for nonterminal
references. **No seventeenth check was added**; the count is proven
sixteen-before/sixteen-after with a full block diff in §21–§22.

## 13. R3.1-local AMEND/current-reference gate `G15R` (Correction 7)

As now binding in canon §15.9.9 and the repair plan: `G15R` runs at the
R3.1 checkpoint across every population R3.1 touches (active
GROUP/LEAF, `XW2`, `SRC2` base + date-component rows, `EV2`, `DR2` +
`DISP` detail rows, fragment-inventory rows, `SM2`) and verifies: live
references point **directly** to current records; every prior record
resolves forward through a valid `AMEND` chain; every chain terminates
in exactly one current disposition or explicit removal; no stale live
references; no duplicate current record; no orphan record; no broken
forward reference; same-commit reference updates; no ID reuse or
renumbering; and current decision-type/detail-schema compatibility. It
is expressly **repair-local** — not a claim that the full R8 global
gate G15 has run; G15 and R9 later rerun the global equivalents.

## 14. A18.7 express-versus-INFERRED source analysis (Correction 8)

**Passage read this session** against the hash-matched artifact
(`bf178ca0…`), VII §8(a), printed p. 260 (PDF 284): the express text
permits a Team "to pay or receive in connection with one (1) or more
trades occurring during a Salary Cap Year, directly or indirectly, up
to an aggregate amount equal to 5.15% of the Salary Cap for such
Salary Cap Year in cash across all such trades, including cash
received as reimbursement for Compensation obligations to players whom
the Team is acquiring", with the signing-bonus-as-reimbursement rule
((i)) and the no-netting rule ((ii)).

**Analysis.** The express general rule comprises exactly: the separate
annual paid and received limits, the direct-or-indirect trade
connection, the cap-year association ("trades occurring during a
Salary Cap Year"), and no netting. The text nowhere mentions
conditional cash, pick-conditioned payment, or payment dates in later
years. Concluding that conditional cash tied to a pick is charged to
the **trade's** Salary Cap Year despite a later payment date requires
reasoning: (a) the payment is "in connection with" the trade; (b) the
trade "occurr[ed] during" the earlier Salary Cap Year; (c) "directly
or indirectly" reaches deferred/conditional payment; therefore (d) the
charge attaches to the trade year. That is a legal inference from the
quoted connection-and-timing language — sound, but **not express
text** — and under §15.9.5 it must be a separately identified
**INFERRED** component with its locators and stated chain, never
presented as express source language.

**Corrected in R2.7 (non-active surfaces only):** §12.12 (the "an
express **CBA** rule" claim for the conditional application removed and
restated as INFERRED-required), §15.9.5 (the A18.7 closed-provisional
item), §15.9.8 (the scenario-53 note), §19.3 (the A-family status
paragraph now names the overstatement as an R3.1 repair). **Not
corrected in R2.7 (by order):** the committed active rows — CBA2-A08.4
states the conditional application inside a CBA-classed requirement
with `EV2-0071` — remain byte-identical; their reclassification is
R3.1 backlog item 19. A18.7/§12.12 remains a preserved
unsupported-candidate/discovery surface for the further re-trade
residual, whose bounded searches (R3, R2.6, and this unit's first-party
re-verification) located no qualifying authority in the searched
sources.

## 15. DR2-0037/DR2-0038/DR2-0039 transition analysis (Correction 9)

Verified this session from the committed R3 receipt's decision-record
table and the committed §15.11 crosswalk:

| Record | Committed type | Subjects | Terminal edges (committed §15.11) | R3.1 duty |
|---|---|---|---|---|
| DR2-0037 | `OWN` | CBA-A15.1–CBA-A15.5 | XW2-0086–XW2-0090, all `invalid` | Supersede with current `DISP` record(s) (reason `false-claim`) with pinned detail rows; multi-edge coverage only if the five bases are demonstrably identical under the detail schema; direct reference updates same commit |
| DR2-0038 | `OWN` | CBA-A17.3, CBA-A17.4, CBA-A17.7 | XW2-0095, XW2-0096, XW2-0100, all `invalid` | Same |
| DR2-0039 | `ATOM` | CBA-A02.3, CBA-A02.6 | XW2-0006 and XW2-0012, both `process-only` | **Compare the two edges**: XW2-0006 dispositions a correction/process note about remembered five-tier structure; XW2-0012 a UI tier-derivation instruction — different fragments, characters, and destinations. **Separate `DISP` records unless their terminal bases are demonstrably identical under the new schema.** `ATOM` content preserved only where it remains separately valid as an atomicity decision |

Receipt-reference errors (Codex finding; preserved in backlog item 13):
the immutable R3 receipt cites XW2-0085–0089 for the A15 edges and
XW2-0093/0094/0098 for the A17 edges, while the committed §15.11 table
records XW2-0086–0090 and XW2-0095/0096/0100. The R3 receipt is never
edited; R3.1's receipt supersedes the erroneous claims.

Canon §15.9.4's transition block now names this exact population and
the separate-`DISP` comparison duty; the plan's backlog item 12 carries
the same duties.

## 16. Complete R3.1 backlog (preserved and extended)

The repair plan's R3.1 section carries the complete backlog: the
fifteen previously recorded Codex A-series findings (items 1–15,
preserved; items 4, 5, 11, 12, and 13 updated for the R2.7 contracts —
`SM2` requirements and fragment identity on item 4; the `edition:2024-06`
migration on item 5; `DISP` as a valid terminal outcome in
duplicate-candidate reconciliation on item 11; the pinned
DR2-0037/0038/0039 transition with the two-edge comparison on item 12;
the Codex receipt-reference errors on item 13) plus six new
R2.7-derived duties: fragment-inventory declaration and edge migration
(16); `SM2-…` minting for search-reliant dispositions (17); the
`SRC2-001` source-date migration with its three date-component rows
(18); the A18.7 active-row/evidence `AMEND` (19); direct
current-`DISP` reference updates everywhere (20); and the `G15R` gate
run (21). Nothing was dropped; nothing was implemented in R2.7.

## 17. Truthful status and sequencing (Correction 10)

The truthful sequence, now stated on every binding surface (§15.9.2
sequencing, §15.10 intro prose, §19.3, header "What v2.0 changes",
amendment log, and the repair plan):

**R3 rejected → R2.6 rejected → R2.7 correction → independent Codex
R2.7 review → R3.1 repair → independent Codex R3.1 review → R4 only
after R3.1 ACCEPT.**

Unambiguous statements of record: **R2.7 completion does not equal
acceptance. R3 remains rejected. No A-series record is accepted. R3.1
remains blocked pending independent Codex acceptance of the R2.7
foundation. R4 remains blocked until a later independent Codex R3.1
acceptance. Phase 1 remains open. Phase 2, W1.1, and application work
remain blocked.** The obsolete strict-R3→R4 wording in §15.9.2 and the
§15.10 claim that every requirement was certified during R3 are
corrected (non-record prose only; the active record-table bytes are
preserved — §21).

## 18. Reproducible validation — complete deterministic checker (inline)

The R2.6 receipt's scratch-only checker claim is superseded: the
complete checker source is below. Save it as `r27_checks.py` (any
directory; no dependencies beyond Python 3.9+; it reads no repository
files) and run:

```bash
python3 r27_checks.py
```

Expected output: the 26 case lines each tagged `PASS`, then
`26 mandated cases run, 0 failures`, exit code 0. Input selection is
fully self-contained in `run_cases()`; expected outcomes are encoded
per case and the process exits nonzero on any deviation.

Repository commands another reviewer can rerun for the preservation
proofs (from the repo root, `jq`-free, macOS/Linux `python3`):

```bash
# Protected-range hashes (run against any commit or the worktree):
python3 - <<'EOF'
import hashlib
def extract(data, a, b):
    lines = data.split(b"\n"); s=e=None
    for i, ln in enumerate(lines):
        if s is None and ln.startswith(a): s = i
        elif s is not None and e is None and ln.startswith(b): e = i; break
    return b"\n".join(lines[s:e]) + b"\n"
data = open("docs/reference/cba/ARCHITECT_CBA_CANON.md","rb").read()
for name, a, b in [("sec5.9", b"### 5.9", b"## 6."),
                   ("hist15.1-15.8", b"### 15.1 ", b"### 15.9 "),
                   ("scenarios16", b"## 16.", b"## 17."),
                   ("SC2block", "**SC2 —".encode(), "**R8 —".encode()),
                   ("sec15.9", b"### 15.9 ", b"### 15.10 "),
                   ("sec15.10-15.12", b"### 15.10 ", b"## 16.")]:
    seg = extract(data, a, b)
    print(name, hashlib.sha256(seg).hexdigest(), len(seg))
seg = extract(data, b"### 15.10 ", b"## 16.")
tbl = b"\n".join(l for l in seg.split(b"\n") if l.startswith(b"|")) + b"\n"
print("recordtables", hashlib.sha256(tbl).hexdigest(), len(tbl))
EOF

# Baseline comparison (the rejected R2.6 checkpoint):
git show 51e60bf606f5a4ea4547e7f4e163bdcac2863d26:docs/reference/cba/ARCHITECT_CBA_CANON.md \
  > /tmp/canon_51e60bf6.md   # then rerun the block above on that file

# SC2: exactly sixteen enumerated checks, only check 11 changed:
#   extract the SC2block range from both files and `diff -u` them.

# Signed CBA binary identity:
curl -sL -o /tmp/cba2023.pdf \
  "https://ak-static.cms.nba.com/wp-content/uploads/sites/4/2023/06/2023-NBA-Collective-Bargaining-Agreement.pdf"
shasum -a 256 /tmp/cba2023.pdf   # expect bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32
```

Complete checker source (verbatim; SHA-256 of the file as run:
`a2b29d6b6800f2f83458002d49951e0fad30c241769a85097102fb62317b676e`):

```python
#!/usr/bin/env python3
"""R2.7 deterministic foundation-executability checker.

Implements the pinned R2.7 contracts of ARCHITECT_CBA_CANON.md §15.9.3,
§15.9.4, §15.9.6, and §15.9.9 (source-date model; historical-fragment
inventory; blocked-unsupported-obligation; SM2 search manifest; DISP
detail schema and compatibility matrix; direct-current-reference rule;
terminal uniqueness; SC2 check 11; AMEND/current-reference simulation)
and runs the 26 mandated adversarial cases. Every ID and value is
illustrative only — nothing here is a minted record.

Run: python3 r27_checks.py     Expected: "26 mandated cases ... 0 failures", exit 0.
"""
import re
import sys

# ---------- Source-date model (§15.9.6) ----------

BASES = {"publication", "effective", "edition", "agreement-as-of"}
DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
SEASON_RE = re.compile(r"^(\d{4})-(\d{2})$")
WINDOW_RE = re.compile(r"^\d{4}-\d{2}-\d{2}/(\d{4}-\d{2}-\d{2}|open)$")


def is_real_date(v):
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", v)
    if not m:
        return False
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if not (1 <= mo <= 12):
        return False
    dim = [31, 29 if (y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)) else 28,
           31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1]
    return 1 <= d <= dim


def is_season(v):
    m = SEASON_RE.match(v)
    if not m:
        return False
    yyyy, yy = int(m.group(1)), m.group(2)
    return yy == f"{(yyyy + 1) % 100:02d}"


def validate_source_date(field, prov_type, source_facts, limitations):
    """Validate one base-table Source date field value.

    field: the literal string, e.g. 'edition:2024-06' or '—'.
    prov_type: provenance type of the record.
    source_facts: dict describing what the identified source itself states:
       {basis: {"precision": "day"|"month"|"season"|"window", "value": str,
                "metadata_only": bool  # True if the day exists only in file metadata
               }}
    limitations: list of limitation strings on the record.
    Returns (ok: bool, why: str).
    """
    if field == "—":
        return True, "empty per matrix (caller must check matrix permits)"
    if ":" not in field:
        return False, "bare value with no basis"
    basis, _, value = field.partition(":")
    if basis not in BASES:
        return False, f"unknown basis {basis!r}"
    if value == "—" or basis == "—":
        return False, "half-empty pair"
    facts = source_facts.get(basis)
    if facts is None:
        return False, f"source supports no {basis!r} date"
    if facts.get("metadata_only"):
        return False, "metadata-derived value cannot establish any basis"
    # season values
    if is_season(value) and not DAY_RE.match(value) and not MONTH_RE.match(value):
        return False, "season shape outside edition/official-mutable"
    if MONTH_RE.match(value) and is_season(value):
        # 2026-27 style can never be a month (month>12 excluded by MONTH_RE)
        pass
    if SEASON_RE.match(value) and not MONTH_RE.match(value):
        # e.g. 2026-27: season-shaped
        if basis != "edition" or prov_type != "official-mutable" or not is_season(value):
            return False, "season value only as edition on official-mutable"
        if facts["precision"] != "season":
            return False, "source does not identify by season"
        return True, "season edition ok"
    if MONTH_RE.match(value):
        # month precision
        if facts["precision"] == "day":
            return False, "degraded precision: source states an exact day"
        if facts["precision"] != "month":
            return False, "source does not supply a month for this basis"
        if not any("month precision" in l for l in limitations):
            return False, "missing month-precision limitation entry"
        # honest basis: a cover/edition month never publication/effective
        if facts.get("edition_identifier_only") and basis in ("publication", "effective"):
            return False, "edition month recorded as publication/effective"
        return True, "month ok"
    if DAY_RE.match(value):
        if not is_real_date(value):
            return False, "not a real calendar date"
        if facts["precision"] != "day":
            return False, "source does not state an exact day for this basis"
        if facts["value"] != value:
            return False, "value differs from what the source states"
        return True, "exact day ok"
    if WINDOW_RE.match(value):
        if basis != "effective":
            return False, "window only for effective"
        return True, "window ok"
    return False, f"malformed value {value!r}"


def validate_date_components(base_field, rows):
    """rows: list of (basis, value). At most one row per basis; base pair must
    equal one of the rows when rows exist."""
    seen = set()
    for basis, value in rows:
        if basis not in BASES:
            return False, f"unknown basis {basis!r} in component row"
        if basis in seen:
            return False, f"duplicate current row for basis {basis!r}"
        seen.add(basis)
    if rows and base_field != "—":
        b, _, v = base_field.partition(":")
        if (b, v) not in rows:
            return False, "base pair not among component rows"
    return True, "components ok"


# ---------- Fragment inventory (§15.9.3) ----------

FRAG_RE = re.compile(r"^(CBA-[A-Z]\d{2}(?:\.\d+)?):F([1-9]\d*)$")
KINDS = {"substantive-obligation", "authority-assertion",
         "process-instruction", "gap-assertion"}
TERMINAL_TYPES = {"process-only", "invalid", "no-successor", "unsupported-residual"}
NONTERMINAL_TYPES = {"equivalent", "split", "merge", "partial-overlap", "moved"}
KIND_EDGE_OK = {
    "process-only": {"process-instruction"},
    "invalid": {"authority-assertion", "gap-assertion", "substantive-obligation"},
    "no-successor": {"substantive-obligation", "gap-assertion"},
    "unsupported-residual": {"substantive-obligation"},
}


def validate_inventory(leaf, fragments, edges, declared_exhaustive, semantic_confirmed):
    """fragments: {fid: {"kind": k, "scope": set(tokens)}}
    edges: list of {"id", "source", "frag", "type", "decision"}
    Returns (ok, why)."""
    for fid in fragments:
        m = FRAG_RE.match(fid)
        if not m or m.group(1) != leaf:
            return False, f"bad fragment id {fid}"
        if fragments[fid]["kind"] not in KINDS:
            return False, f"bad kind on {fid}"
    if not declared_exhaustive:
        return False, "no declared exhaustive decomposition (silent residual possible)"
    if not semantic_confirmed:
        return False, "no semantic exhaustiveness confirmation"
    fids = list(fragments)
    for i in range(len(fids)):
        for j in range(i + 1, len(fids)):
            if fragments[fids[i]]["scope"] & fragments[fids[j]]["scope"]:
                return False, f"overlapping fragments {fids[i]}/{fids[j]}"
    dispo = {fid: [] for fid in fragments}
    for e in edges:
        if e["source"] != leaf:
            continue
        if e["frag"] not in fragments:
            return False, f"edge {e['id']} names unregistered fragment {e['frag']}"
        dispo[e["frag"]].append(e)
    for fid, es in dispo.items():
        if not es:
            return False, f"orphan fragment {fid} (no disposition)"
        terms = [e for e in es if e["type"] in TERMINAL_TYPES]
        nonterms = [e for e in es if e["type"] in NONTERMINAL_TYPES]
        if len(terms) > 1:
            return False, f"two terminal dispositions for {fid}"
        if terms and nonterms:
            return False, f"{fid} simultaneously terminal and actively owned"
        for e in terms:
            if fragments[fid]["kind"] not in KIND_EDGE_OK[e["type"]]:
                return False, f"kind/edge-type mismatch on {fid}"
    # terminal uniqueness key: (source LEAF, fragment)
    seen = set()
    for e in edges:
        if e["type"] in TERMINAL_TYPES:
            key = (e["source"], e["frag"])
            if key in seen:
                return False, f"duplicate terminal edge for {key}"
            seen.add(key)
    return True, "inventory ok"


# ---------- DISP detail / decisions (§15.9.4) ----------

REASON_FOR_TYPE = {
    "process-only": "process-material",
    "invalid": "false-claim",
    "no-successor": "out-of-scope-or-obsolete",
    "unsupported-residual": "authority-not-located",
}


def validate_terminal_reference(edge, decisions, disp_details, sm2):
    """decisions: {drid: {"type": "OWN"|"ATOM"|"DISP"|..., "status": "current"|"superseded",
                          "superseded_by": drid|None}}
    disp_details: {drid: {"leaf","frag","edge","edge_type","reason","sm2": [ids],
                          "anchor": str|None, "status"}}
    sm2: {smid: {"status", "result", "source_identity", "locator", "cutoff"}}
    """
    dr = decisions.get(edge["decision"])
    if dr is None:
        return False, "decision reference does not resolve"
    if dr["type"] != "DISP":
        return False, f"terminal edge references {dr['type']}, not DISP"
    if dr["status"] != "current":
        return False, "stale reference: superseded decision reachable only through AMEND"
    det = disp_details.get(edge["decision"])
    if det is None:
        return False, "DISP without pinned detail row"
    if det["leaf"] != edge["source"] or det["frag"] != edge["frag"] \
            or det["edge"] != edge["id"] or det["edge_type"] != edge["type"]:
        return False, "DISP detail row disagrees with edge (source/fragment/edge/type)"
    if det["reason"] != REASON_FOR_TYPE[edge["type"]]:
        return False, "no-owner reason incompatible with edge type"
    if edge["type"] == "unsupported-residual":
        if not det["sm2"]:
            return False, "unsupported-residual without SM2 search records"
        for smid in det["sm2"]:
            rec = sm2.get(smid)
            if rec is None or rec["status"] != "current":
                return False, f"SM2 reference {smid} not current"
            ok, why = validate_sm2(rec)
            if not ok:
                return False, f"inadequate SM2 {smid}: {why}"
            if rec["result"] == "qualifying-authority-located":
                return False, "located authority forbids unsupported-residual"
        if not det.get("anchor"):
            return False, "unsupported-residual without preserved-candidate anchor"
    return True, "terminal reference ok"


def find_orphan_disps(edges, decisions, disp_details):
    referenced = {e["decision"] for e in edges}
    orphans = [d for d, det in disp_details.items()
               if decisions[d]["status"] == "current" and d not in referenced]
    return orphans


# ---------- SM2 search manifest (§15.9.6) ----------

RESULTS = {"qualifying-authority-located",
           "no-qualifying-authority-located-in-searched-sources",
           "inconclusive"}
VAGUE = {"official web surfaces", "the internet", "official sources", "various sources"}


def validate_sm2(rec):
    if rec["result"] not in RESULTS:
        return False, f"result {rec['result']!r} outside closed vocabulary"
    if "exists" in rec["result"]:
        return False, "result implies universal negative"
    if rec["source_identity"].strip().lower() in VAGUE:
        return False, "vague source identity"
    if not rec.get("locator") or rec["locator"] == "—":
        return False, "missing exact locator/query"
    if not rec.get("cutoff"):
        return False, "missing search cutoff"
    return True, "sm2 ok"


# ---------- Blocking outcome (§15.9.3) ----------

def disposition_available(fragment_kind, supported_sibling_exists, authority_located,
                          valid_in_scope, attempted_type):
    """Returns (allowed, why) for attempting attempted_type on a fragment."""
    if attempted_type == "unsupported-residual":
        if fragment_kind != "substantive-obligation":
            return False, "unsupported-residual only for substantive-obligation fragments"
        if authority_located:
            return False, "authority located: active owner required"
        if not supported_sibling_exists:
            return False, "BLOCKED-UNSUPPORTED-OBLIGATION: no supported sibling; unit must stop"
        return True, "ok"
    if attempted_type == "invalid":
        if fragment_kind == "substantive-obligation" and valid_in_scope and not authority_located:
            return False, "merely unsupported substantive mechanic is not thereby invalid"
        return True, "ok"
    return True, "ok"


# ---------- AMEND / current-reference simulation ----------

def amend_supersede(decisions, edges, old_id, new_id, new_type, update_refs_same_commit):
    decisions[old_id]["status"] = "superseded"
    decisions[old_id]["superseded_by"] = new_id
    decisions[new_id] = {"type": new_type, "status": "current", "superseded_by": None}
    if update_refs_same_commit:
        for e in edges:
            if e["decision"] == old_id:
                e["decision"] = new_id


# ---------- The 26 mandated adversarial cases ----------

def run_cases():
    results = []

    def case(n, desc, got_ok, expect_ok):
        results.append((n, desc, got_ok, expect_ok, got_ok == expect_ok))

    L = "CBA-X18.7"  # illustrative historical LEAF; X is not a mintable family
    # Common inventory pieces
    f_sup = {"kind": "substantive-obligation", "scope": {"charging"}}
    f_res = {"kind": "substantive-obligation", "scope": {"retrade"}}
    e_sup = {"id": "XW2-9001", "source": L, "frag": f"{L}:F1", "type": "partial-overlap",
             "decision": "DR2-9001"}
    e_res = {"id": "XW2-9002", "source": L, "frag": f"{L}:F2", "type": "unsupported-residual",
             "decision": "DR2-9002"}

    # 1. Supported fragment plus silently omitted residual — fail.
    ok, _ = validate_inventory(L, {f"{L}:F1": f_sup}, [e_sup],
                               declared_exhaustive=False, semantic_confirmed=True)
    case(1, "silently omitted residual", ok, False)

    # 2. Exhaustive supported-plus-unsupported decomposition — pass.
    ok, _ = validate_inventory(L, {f"{L}:F1": f_sup, f"{L}:F2": f_res}, [e_sup, e_res],
                               declared_exhaustive=True, semantic_confirmed=True)
    case(2, "exhaustive supported+unsupported decomposition", ok, True)

    # 3. Overlapping fragments — fail.
    ok, _ = validate_inventory(
        L, {f"{L}:F1": f_sup,
            f"{L}:F2": {"kind": "substantive-obligation", "scope": {"charging", "retrade"}}},
        [e_sup, e_res], True, True)
    case(3, "overlapping fragments", ok, False)

    # 4. Orphan fragment — fail.
    ok, _ = validate_inventory(L, {f"{L}:F1": f_sup, f"{L}:F2": f_res}, [e_sup], True, True)
    case(4, "orphan fragment", ok, False)

    # 5. Edge referencing unknown fragment — fail.
    bad = dict(e_res, frag=f"{L}:F9")
    ok, _ = validate_inventory(L, {f"{L}:F1": f_sup, f"{L}:F2": f_res}, [e_sup, bad], True, True)
    case(5, "edge references unknown fragment", ok, False)

    # 6. Fragment with both active and terminal dispositions — fail.
    both = dict(e_sup, id="XW2-9003", frag=f"{L}:F2")
    ok, _ = validate_inventory(L, {f"{L}:F1": f_sup, f"{L}:F2": f_res},
                               [e_sup, e_res, both], True, True)
    case(6, "fragment both terminal and actively owned", ok, False)

    # 7. Two terminal fragments from one source — pass with distinct fragment IDs.
    e_t1 = {"id": "XW2-9004", "source": L, "frag": f"{L}:F1", "type": "process-only",
            "decision": "DR2-9004"}
    e_t2 = {"id": "XW2-9005", "source": L, "frag": f"{L}:F2", "type": "unsupported-residual",
            "decision": "DR2-9005"}
    ok, _ = validate_inventory(
        L, {f"{L}:F1": {"kind": "process-instruction", "scope": {"proc"}},
            f"{L}:F2": f_res}, [e_t1, e_t2], True, True)
    case(7, "two terminal fragments, distinct IDs", ok, True)

    # 8. Two terminal decisions (edges) for the same fragment — fail.
    e_dup = dict(e_t2, id="XW2-9006", type="no-successor", decision="DR2-9006")
    ok, _ = validate_inventory(
        L, {f"{L}:F1": {"kind": "process-instruction", "scope": {"proc"}},
            f"{L}:F2": f_res}, [e_t1, e_t2, e_dup], True, True)
    case(8, "two terminal decisions for one fragment", ok, False)

    # Decisions/DISP fixtures for 9-12, 24-26
    sm_good = {"SM2-9001": {"status": "current",
                            "result": "no-qualifying-authority-located-in-searched-sources",
                            "source_identity": "2023 NBA-NBPA CBA (signed edition)",
                            "locator": "VII §8(a) p.260", "cutoff": "2026-07-19T00:00:00Z"}}
    decisions = {
        "DR2-9010": {"type": "OWN", "status": "current", "superseded_by": None},
        "DR2-9011": {"type": "DISP", "status": "current", "superseded_by": None},
        "DR2-9012": {"type": "DISP", "status": "superseded", "superseded_by": "DR2-9011"},
    }
    det_ok = {"leaf": L, "frag": f"{L}:F2", "edge": "XW2-9002",
              "edge_type": "unsupported-residual", "reason": "authority-not-located",
              "sm2": ["SM2-9001"], "anchor": "§12.12", "status": "current"}
    disp_details = {"DR2-9011": det_ok,
                    "DR2-9012": dict(det_ok, status="superseded")}

    # 9. Terminal edge pointing to OWN — fail.
    e9 = dict(e_res, decision="DR2-9010")
    ok, _ = validate_terminal_reference(e9, decisions, disp_details, sm_good)
    case(9, "terminal edge references OWN", ok, False)

    # 10. Terminal edge pointing to stale pre-AMEND DISP — fail.
    e10 = dict(e_res, decision="DR2-9012")
    ok, _ = validate_terminal_reference(e10, decisions, disp_details, sm_good)
    case(10, "terminal edge references superseded DISP", ok, False)

    # 11. DISP with mismatched source/scope/fragment/type — fail.
    det_bad = dict(det_ok, frag=f"{L}:F1")
    ok, _ = validate_terminal_reference(
        e_res, decisions, {"DR2-9011": det_bad}, sm_good)
    case(11, "DISP detail mismatch", ok, False)

    # 12. Orphan current DISP — fail (nonempty orphan list).
    orphans = find_orphan_disps([e_sup], decisions, disp_details)
    case(12, "orphan current DISP", len(orphans) == 0, False)

    # 13. Wholly unsupported valid obligation attempting unsupported-residual —
    #     fail and trigger the blocking outcome.
    allowed, why = disposition_available("substantive-obligation",
                                         supported_sibling_exists=False,
                                         authority_located=False, valid_in_scope=True,
                                         attempted_type="unsupported-residual")
    case(13, "wholly unsupported obligation blocked",
         allowed or "BLOCKED-UNSUPPORTED-OBLIGATION" not in why, False)

    # 14. False authority claim separated from unsupported substantive mechanics —
    #     correct separate dispositions.
    inv_on_auth, _ = disposition_available("authority-assertion", True, False, True, "invalid")
    ur_on_sub, _ = disposition_available("substantive-obligation", True, False, True,
                                         "unsupported-residual")
    inv_on_sub, _ = disposition_available("substantive-obligation", True, False, True, "invalid")
    case(14, "kind separation: invalid on authority claim, not on unsupported mechanic",
         inv_on_auth and ur_on_sub and not inv_on_sub, True)

    # Source-date fixtures
    bylaws_facts = {"edition": {"precision": "month", "value": "2024-06",
                                "edition_identifier_only": True}}
    bylaws_facts_pub = {"publication": {"precision": "month", "value": "2024-06",
                                        "edition_identifier_only": True},
                        "edition": {"precision": "month", "value": "2024-06",
                                    "edition_identifier_only": True}}
    cba_facts = {"agreement-as-of": {"precision": "day", "value": "2023-06-28"},
                 "effective": {"precision": "day", "value": "2023-07-01"},
                 "edition": {"precision": "month", "value": "2023-07",
                             "edition_identifier_only": True}}
    lim = ["edition identified by the source to month precision only"]

    # 15. Edition month with edition basis — pass.
    ok, _ = validate_source_date("edition:2024-06", "official-immutable", bylaws_facts, lim)
    case(15, "edition:2024-06 with limitation", ok, True)

    # 16. Edition month labeled publication/effective — fail.
    ok1, _ = validate_source_date("publication:2024-06", "official-immutable",
                                  bylaws_facts_pub, lim)
    ok2, _ = validate_source_date("effective:2024-06", "official-immutable",
                                  bylaws_facts_pub, lim)
    case(16, "edition month as publication/effective", ok1 or ok2, False)

    # 17. Exact effective date — pass.
    ok, _ = validate_source_date("effective:2023-07-01", "official-immutable", cba_facts, [])
    case(17, "effective:2023-07-01", ok, True)

    # 18. Exact date degraded to a month — fail.
    ok, _ = validate_source_date("effective:2023-07", "official-immutable", cba_facts, lim)
    case(18, "exact date degraded to month", ok, False)

    # 19. Metadata-derived semantic day — fail.
    meta_facts = {"publication": {"precision": "day", "value": "2024-06-07",
                                  "metadata_only": True}}
    ok, _ = validate_source_date("publication:2024-06-07", "official-immutable",
                                 meta_facts, [])
    case(19, "metadata-derived day", ok, False)

    # 20. Missing or incompatible date basis — fail.
    ok1, _ = validate_source_date("2024-06", "official-immutable", bylaws_facts, lim)
    ok2, _ = validate_source_date("cover:2024-06", "official-immutable", bylaws_facts, lim)
    ok3, _ = validate_source_date("publication:—", "official-immutable", bylaws_facts, lim)
    case(20, "missing/unknown basis or half-empty pair", ok1 or ok2 or ok3, False)

    # 21. Search manifest with exact sources/locators/cutoff/result — pass.
    ok, _ = validate_sm2(sm_good["SM2-9001"])
    case(21, "adequate SM2 record", ok, True)

    # 22. Vague "official web surfaces searched" entry — fail.
    ok, _ = validate_sm2({"status": "current",
                          "result": "no-qualifying-authority-located-in-searched-sources",
                          "source_identity": "official web surfaces",
                          "locator": "—", "cutoff": "2026-07-19T00:00:00Z"})
    case(22, "vague SM2 source identity", ok, False)

    # 23. "No authority exists" search result — fail.
    ok, _ = validate_sm2({"status": "current", "result": "no-authority-exists",
                          "source_identity": "2023 NBA-NBPA CBA (signed edition)",
                          "locator": "VII §8(a)", "cutoff": "2026-07-19T00:00:00Z"})
    case(23, "universal-negative result", ok, False)

    # 24. SC2 terminal edge with wrong decision type — fail.
    sxw = {"id": "SXW2-9001", "source": "scenario-53", "frag": "scenario-53:F1",
           "type": "invalid", "decision": "DR2-9010"}
    ok, _ = validate_terminal_reference(sxw, decisions,
                                        disp_details, sm_good)
    case(24, "SC2 check 11: terminal SXW2 edge to OWN", ok, False)

    # 25. Valid AMEND/current-reference reconciliation — pass.
    dec = {"DR2-9020": {"type": "ATOM", "status": "current", "superseded_by": None}}
    edges = [{"id": "XW2-9010", "source": L, "frag": f"{L}:F1", "type": "process-only",
              "decision": "DR2-9020"}]
    amend_supersede(dec, edges, "DR2-9020", "DR2-9021", "DISP",
                    update_refs_same_commit=True)
    det25 = {"DR2-9021": {"leaf": L, "frag": f"{L}:F1", "edge": "XW2-9010",
                          "edge_type": "process-only", "reason": "process-material",
                          "sm2": [], "anchor": None, "status": "current"}}
    ok, _ = validate_terminal_reference(edges[0], dec, det25, {})
    case(25, "valid AMEND supersession with same-commit reference update", ok, True)

    # 26. Stale current reference after AMEND — fail.
    dec2 = {"DR2-9030": {"type": "ATOM", "status": "current", "superseded_by": None}}
    edges2 = [{"id": "XW2-9011", "source": L, "frag": f"{L}:F1", "type": "process-only",
               "decision": "DR2-9030"}]
    amend_supersede(dec2, edges2, "DR2-9030", "DR2-9031", "DISP",
                    update_refs_same_commit=False)  # reference NOT updated
    det26 = {"DR2-9031": {"leaf": L, "frag": f"{L}:F1", "edge": "XW2-9011",
                          "edge_type": "process-only", "reason": "process-material",
                          "sm2": [], "anchor": None, "status": "current"}}
    ok, _ = validate_terminal_reference(edges2[0], dec2, det26, {})
    case(26, "stale reference after AMEND (no same-commit update)", ok, False)

    return results


def main():
    results = run_cases()
    failures = 0
    for n, desc, got, expect, passed in results:
        tag = "PASS" if passed else "FAIL"
        print(f"case {n:2d} [{tag}] {desc} (validator={'ok' if got else 'reject'}, "
              f"expected={'ok' if expect else 'reject'})")
        if not passed:
            failures += 1
    print(f"\n26 mandated cases run, {failures} failures")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
```

## 19. Adversarial results (all 26 mandated cases)

Run this session (`python3 r27_checks.py`, exit 0):

| # | Mandated case | Expected | Result |
|---|---|---|---|
| 1 | Supported fragment plus silently omitted residual | fail | PASS (rejected) |
| 2 | Exhaustive supported-plus-unsupported decomposition | pass | PASS (accepted) |
| 3 | Overlapping fragments | fail | PASS (rejected) |
| 4 | Orphan fragment | fail | PASS (rejected) |
| 5 | Edge referencing unknown fragment | fail | PASS (rejected) |
| 6 | Fragment with both active and terminal dispositions | fail | PASS (rejected) |
| 7 | Two terminal fragments from one historical source, distinct fragment IDs | pass | PASS (accepted) |
| 8 | Two terminal decisions for the same fragment | fail | PASS (rejected) |
| 9 | Terminal edge pointing to OWN | fail | PASS (rejected) |
| 10 | Terminal edge pointing to stale pre-AMEND DISP | fail | PASS (rejected) |
| 11 | DISP with mismatched source/scope/fragment/type | fail | PASS (rejected) |
| 12 | Orphan current DISP | fail | PASS (rejected) |
| 13 | Wholly unsupported valid obligation attempting unsupported-residual | fail + blocking outcome | PASS (rejected with `BLOCKED-UNSUPPORTED-OBLIGATION`) |
| 14 | False authority claim separated from unsupported substantive mechanics | correct separate dispositions | PASS (`invalid` valid on the authority-assertion fragment; `unsupported-residual` valid on the substantive fragment with a supported sibling; `invalid` rejected for the merely unsupported mechanic) |
| 15 | Edition month with edition basis (`edition:2024-06` + limitation) | pass | PASS (accepted) |
| 16 | Edition month labeled publication/effective | fail | PASS (rejected) |
| 17 | Exact effective date (`effective:2023-07-01`) | pass | PASS (accepted) |
| 18 | Exact date degraded to a month | fail | PASS (rejected) |
| 19 | Metadata-derived semantic day | fail | PASS (rejected) |
| 20 | Missing or incompatible date basis | fail | PASS (rejected) |
| 21 | Search manifest with exact sources/locators/cutoff/result | pass | PASS (accepted) |
| 22 | Vague "official web surfaces searched" entry | fail | PASS (rejected) |
| 23 | "No authority exists" search result | fail | PASS (rejected) |
| 24 | SC2 terminal edge with wrong decision type | fail | PASS (rejected) |
| 25 | Valid AMEND/current-reference reconciliation | pass | PASS (accepted) |
| 26 | Stale current reference after AMEND | fail | PASS (rejected) |

The AMEND/current-reference simulations (cases 25–26) exercise the
same-commit update rule directly: the identical supersession passes
with the reference updated in the same commit and fails without it.

## 20. Contradiction sweeps

Run on the full canon and repair plan at the final R2.7 working state;
earlier receipts are immutable history and retain their original
wording by design (HISTORY); frozen §15.1–§15.8 rows, scenarios 1–89,
and committed §15.10–§15.12 record-table rows are byte-preserved and
non-authorizing (FROZEN/COMMITTED):

| Sweep | Result |
|---|---|
| `tests the express cap-year charging rule` (the old scenario-53 claim) | **Zero** occurrences in canon and plan |
| `an express **CBA** rule` (the old §12.12 conditional-cash claim) | **Zero** occurrences |
| `One of the eight` (the false type count) | **Zero** occurrences; the schema row reads "One of the nine types below" |
| `through their \`AMEND\` chains` / `directly or through its \`AMEND\` chain` (live-reference laundering) | **Zero** binding occurrences in canon and plan — every gate now requires direct current `DISP` references; `AMEND`-chain resolution survives only as receipt-era lineage reading |
| `Publication/effective date` | Binding §15.9 occurrences: only the abolition sentence naming the abolished field. Remaining occurrences are the committed §15.12 record-table rows (byte-preserved; R3.1 migration) and HISTORY (the R2.6 amendment-log row and the §15.9 intro's description of what the R2.6 receipt records) |
| `acceptance of the R2.6 foundation` (stale gating claim) | **Zero** live-status occurrences; the phrase survives only inside historical narrative that now ends in the recorded R2.6 rejection |
| `R2.6 foundation returns ACCEPT` / `blocked until R2.6` | **Zero** occurrences |
| Old strict-sequence wording (`R4 depends on completed R3` without R3.1) | **Zero** — §15.9.2 and the plan state the rejected-unit-aware sequence |
| §15.10 intro certified-during-R3 claim | **Zero** — the intro now records the R3 assertion and its rejection |

## 21. Preservation — mechanically proven

All hashes computed by anchor-locked extraction (heading line starts) at
the baseline (`51e60bf6…`) and at the final R2.7 working state.

| Preserved area | Baseline SHA-256 | Final SHA-256 | Status |
|---|---|---|---|
| **Active §15.10–§15.12 record-table rows** (every line beginning `\|` in the range `### 15.10` → `## 16.`, including all `CBA2-…`/`XW2-…`/`SRC2-…`/`EV2-…` rows, table headers, and the §15.11 deferral table) | `dfcfe209c5629f8f86f1014a7ee42f42012655714c9b28fab048951bb61b1bbd` (118,104 bytes) | identical | **Byte-identical** — no record-table row changed |
| Active `CBA2-…`/`XW2-…`/`SRC2-…`/`EV2-…` record rows alone | `75b5b86b8699b5e6168b2239d27f4b75ffc7f6d5f98ef28cad4436b08a09816d` (115,521 bytes) | identical | **Byte-identical** |
| §15.10–§15.12 whole section | `fadbfe14216c6413871b05375f244dd5d162993064b46bdac4f3a43a4acec2ac` (120,065 bytes) | `23422179885e0bdd5077241961817ce71e86cd8bf3e291f45405f0de404c823a` (120,399 bytes) | **Changed by design** — a full-line diff of the range shows exactly one changed line: the §15.10 non-record intro-prose paragraph (Correction 10) |
| Canon §5.9 (`### 5.9` → `## 6.`) | `53c968ade8cdb2177517412ac09f2bae63ee7642cfa3b24299d2b208895fb373` (6,198 bytes) | identical | Byte-identical (matches R2.3–R2.6/R3 receipts) |
| Historical §15.1–§15.8 (`### 15.1` → `### 15.9`) | `7b3f6aaba81129dceaa8e55f6356f8bbecd3af7e1ff59b127a443fc5d7b14d97` (90,455 bytes) | identical | Byte-identical |
| Historical scenarios 1–89 (`## 16.` → `## 17.`) | `eb11bb122840f881204be4d3de9b8a47a680a19622677e4287227730615b311f` (24,119 bytes) | identical | Byte-identical |
| Sixteen-check SC2 block (`**SC2 —` → `**R8 —`) | `7a4f50c49f42dfe9ca399039ff2cabc1dd86dcbfc3490ce8ba2dd3b2d5f803cd` (1,492 bytes) | `ca26937dedde2abdc665c109cb30ad0a7d27c8a3f794062e1abb3f6596c656bd` (2,071 bytes) | **Changed by authorization** — the unified diff of the block shows the only change is inside check 11; enumerated checks counted **16 before and 16 after** |
| §15.9 foundation standard (`### 15.9` → `### 15.10`) | `7e2da9c1d8578b42ad36e31cb741d8352addb35793cdff46a2c868f1a9ca07bf` (101,360 bytes) | `ae97e1f536a62bf9d3526a5fb433b4644dc7140e4dd6b827f4de91164205876a` (136,836 bytes) | **Changed by design** — R2.7's authorized surface |
| All eleven prior receipts (R1, R1.1, R1.2, R2, R2.1–R2.6, R3) | R1 `aa45ca01…`; R1.1 `ef7cb16b…`; R1.2 `ee0f7196…`; R2 `1a688701…`; R2.1 `138a2087…`; R2.2 `9094b814…`; R2.3 `92faba91…`; R2.4 `c14a5f4f…`; R2.5 `c547ce84…`; R2.6 `2f4c61c2105b73a795878c0fececefbcf96ba8d90a5723432f420b63a8b15b0f`; R3 `a11cf80c7de5931b98a3fcc3be984cd1bebd299fbcba5c4b183e885fc8cfee08` | identical | Whole-file hashes identical before/after; `git diff` contains no receipt path |

## 22. Validation results and scope boundaries

Run at the final R2.7 working state on baseline `51e60bf6…`:

- **Exact changed-file check:** `git diff --name-only` =
  `docs/reference/cba/ARCHITECT_CBA_CANON.md`,
  `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md`;
  untracked additions = this receipt only. Exactly the three authorized
  files; no prior receipt in the diff.
- **Byte-level active-record-table preservation:** §21 — the
  record-table row hash (`dfcfe209…`, 118,104 bytes) and active-row
  hash (`75b5b86b…`, 115,521 bytes) identical on both sides; the
  full-line diff of §15.10–§15.12 shows exactly one changed non-table
  prose line.
- **SC2 proof:** enumerated checks 16 → 16; unified block diff shows
  only check 11 changed (§12, §21).
- **Parsers and adversarial cases:** the inline §18 checker implements
  the new grammars (source-date pairs, per-basis values, month rule,
  date components, fragment IDs/kinds/inventory, `SM2` fields/results,
  `DISP` detail/compatibility/direct-reference, terminal uniqueness,
  AMEND/current-reference simulation) — **26 mandated cases, 0
  failures, exit 0** (§19).
- **Contradiction sweeps:** §20 — all clean.
- **Current-record and AMEND-reference simulations:** checker cases
  25–26 (same-commit update passes; omitted update fails).
- **`git diff --check` (pre-commit):** clean — exit 0, zero findings.
  (The one changed header line — the amendment date — uses a
  CommonMark backslash hard break instead of the two-trailing-space
  break, so the changed range carries no trailing whitespace; the
  untouched header lines keep their existing two-space breaks, and the
  pre-existing R3-era hard-break finding in the `6d9c7576…..07f0667d…`
  range remains R3.1 backlog item 15.)
- **Post-commit range check:** `git diff --check 51e60bf6…..HEAD` run
  after the checkpoint commit and reported in the final unit report;
  the staged-diff check (`git diff --check --cached` over exactly the
  three files, byte-identical content to the post-commit range) ran
  clean before committing.
- **`npm run lint:md`:** exit 1 — **pre-existing findings only.** The
  canon carries exactly **74** findings before and after R2.7 (baseline
  recomputed this session by linting `git show 51e60bf6…` of the canon),
  all `MD029/ol-prefix` in the accepted §16 continuous-numbering class;
  zero new findings in R2.7's changed files. `markdownlint` on the
  repair plan: clean (exit 0). `markdownlint` on this receipt: clean
  (exit 0; re-run after final write). The remaining global findings
  (53) are pre-existing and confined to four unrelated files
  (`docs/CODEBASE_MAP.md` 32; the three `docs/architect/audits/`
  documents 9/8/4). The global exit code is a failure caused by
  pre-existing findings — reported truthfully, never claimed as a
  global pass.
- **`npm run docs:guardrails`:** pass ("Workspace guardrails passed.",
  exit 0).
- **Not run, per the R2.7 order and repair-plan rule 6:** application
  tests, builds, typecheck, ESLint, `test:diff`, and the full suite —
  R2.7 is documentation/standards work only.

Scope boundaries honored:

- No active §15.10–§15.12 record-table row changed (byte-identity
  proven); no concrete active record and no fragment or search record
  minted; no ID renumbered or reused; every identifier used in examples
  in this receipt and the canon (e.g., `CBA-X18.7:F2`, `SM2-9001`,
  `DR2-9011`, `XW2-9002`) is explicitly illustrative and constitutes no
  minted record.
- No prior receipt edited — including the rejected R2.6 and R3
  receipts; their incorrect or incomplete claims (the R2.6 receipt's
  publication/effective framing of the By-Laws month, its
  scratch-only-checker validation claim, and the R3 receipt's
  edge-reference errors) are superseded by this receipt's §4, §15, §18,
  and §20, never by editing history.
- Historical §15.1–§15.8 rows and scenarios 1–89 untouched
  (byte-proven); §12.7's active source-law backlog untouched beyond the
  authorized non-active A18.7 clarification; the sixteen-check SC2
  block changed only inside check 11.
- R3.1 was **not started**; R4–R9, Phase 2, and W1.1 were **not
  started**; no Phase 2 compliance verdict issued anywhere; Linear not
  read or written; `main` unchanged (`69f8f6b6…`); no application,
  README, code-map, test, schema, fixture, configuration, or data
  change.

**R2.7 is complete but not independently accepted — completing this
unit does not accept it. R3 remains rejected; no A-series record is
accepted; R3.1 and R4 remain blocked until an independent Codex review
returns ACCEPT on the R2.7 foundation and, later, on the R3.1
checkpoint.**
