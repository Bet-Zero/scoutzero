# Architect CBA Canon v2.0 — R2.8 Receipt: Foundation Executability Repair

## 1. Provenance, baseline, and clean-state proof

| Field | Value |
|---|---|
| Repair unit | R2.8 — foundation-executability repair: the Codex R2.7 rejection findings (DISP/SC2 unrepresentable for SXW2 subjects; overrideable unsupported-obligation resolution; mechanically ambiguous source-date/fragment/SM2 contracts; a synthetic checker that accepted invalid states) corrected in the governing standard and non-active status surfaces only. No committed R3 record repaired; no concrete v2 record minted |
| Branch | `architect/cba-canon-v2` |
| Baseline commit | **`3e9f913f285db578a9457ab2ce31744ca6e9c9ca`** — the rejected R2.7 checkpoint, verified at session start as HEAD = `origin/architect/cba-canon-v2` (ahead/behind vs upstream 0/0); direct parent = `51e60bf606f5a4ea4547e7f4e163bdcac2863d26` (R2.6, rejected); prior chain: R3 = `07f0667d…` (rejected); R2.5 = `6d9c7576…` (accepted pre-R3 foundation) |
| `main` | `main` = `origin/main` = `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288` — untouched by this unit |
| Clean-state verification | `git status --porcelain` empty at session start: worktree, index, and untracked state completely clean |
| Ordering review | The independent Codex review of the R2.7 checkpoint at `3e9f913f…` returned **REJECT/BLOCK-R3.1** (§3 below). R3 remains rejected (REJECT/BLOCK-R4 at `07f0667d…`); the R2.6, R3, and R2.7 receipts remain immutable review history; their incorrect or incomplete claims are superseded by this receipt, never by editing them |
| Scope | Foundation contract (canon §15.9.1–§15.9.6, §15.9.8, §15.9.9), non-active status surfaces (§15.9.2 sequencing, §15.10 intro prose, §19.3, header/amendment log), and repair-plan status/sequencing/backlog only. Every active §15.10–§15.12 record-table row is byte-identical to `3e9f913f…` (§17 below) |
| Edition status after R2.8 | Canon v2.0 **working draft** — not accepted, not active; **R2.8 is not independently accepted**; R3 remains rejected; no A-series record is accepted; R3.1 and R4 remain blocked (§16 below); v2.0 checksum deliberately **not** computed (R8) |

## 2. Files changed — exactly two modified, two created

1. **Modified** `docs/reference/cba/ARCHITECT_CBA_CANON.md` — the §15.9.4
   polymorphic `XW2-DISP`/`SXW2-DISP` `DISP` detail schema, subject-family
   exclusivity/equality/grouping rules, and the DISP type-table row; the
   §15.9.8 canonical scenario-fragment grammar (`scenario-<n>:F<m>`) and
   SXW2 analog; the §15.9.6 stable-identity `<Record ID>#D<k>`
   date-component table with its `role/scope` discriminator (and the U8 /
   field-level-validation cardinality conform edits); the §15.9.3 split
   fragment status/version fields, normalized-scope algorithm,
   disposition-bundle (`BND-…`) schema, and the completeness-contract
   bundle edit; the §15.9.6 split `SM2-…` binary/status fields, subject
   class, `Result linkage`/`Search-set ID` fields, and the `SS2-…`
   search-set/coverage record (and the adequacy-rule conform edits); the
   §15.9.3 governed `BLK-…`/`RES-…` blocked-finding/resolution records and
   the independent-acceptance gate (and the item-2/item-6 blocking-outcome
   edits); the §15.9.2 draft-mutability and append-only population lists;
   the dependent gate updates (U7, G1, G3, G15, `G15R`, R9, and SC2 check
   11 strengthened inside the unchanged sixteen-check block); the §15.9
   title/intro, §15.9.2 sequencing, §15.10 intro prose, §19.3, header
   "What v2.0 changes" R2.8 sentences, amendment date, and one new
   amendment-log row.
2. **Modified**
   `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md` —
   the intro brought current (R2.7 executed at `3e9f913f…` and
   independently REJECTED; the strict R2.8 → review → R3.1 → review → R4
   sequence); the R2.7 unit outcome; the new R2.8 unit section; the R3.1
   section (blocked on R2.8 acceptance; backlog items 22–27 added; the
   no-reuse namespace list extended); and the sequencing surfaces.
3. **Created**
   `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_8_FOUNDATION_EXECUTABILITY_REPAIR.md`
   — this receipt.
4. **Created**
   `work/architect-completion/cba_canon_v2_foundation_validator.py`
   — the actual-schema validator (documentation-evidence tooling; not
   application code or an application test), superseding R2.7's synthetic
   checker.

Nothing else. No earlier receipt was edited — including the rejected
R2.6, R3, and R2.7 receipts. No application, README, code-map, test,
schema, fixture, configuration, or runtime-data file changed; Linear was
not read or written; no PDF was committed.

`git status --porcelain` at final working state:

```
 M docs/reference/cba/ARCHITECT_CBA_CANON.md
 M work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md
?? work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_8_FOUNDATION_EXECUTABILITY_REPAIR.md
?? work/architect-completion/cba_canon_v2_foundation_validator.py
```

## 3. Full Codex R2.7 rejection findings (the ordering input)

Verdict, verbatim: **"REJECT/BLOCK R3.1 — DISP/SC2 is unrepresentable,
unsupported-obligation resolution is overrideable, source-date/fragment/
SM2 contracts remain mechanically ambiguous, and the checker accepts
invalid states."**

The ordered corrections carried by the review (each independently
verified against the binding language and primary sources this session
before implementation):

1. **Representable DISP and SC2.** The single LEAF-only `DISP` detail
   schema forced every terminal edge through a `Historical source LEAF`
   + `<LEAF ID>:F<n>` fragment; an SXW2 subject is a scenario, not a
   LEAF, and no scenario-fragment grammar existed — so an `SXW2-DISP`
   disposition was literally unrepresentable, and SC2 check 11 could not
   be satisfied. Corrected: a polymorphic subject-class-tagged schema
   plus a canonical scenario-fragment grammar.
2. **Source-date cardinality and reconciliation.** "At most one current
   row per (Record ID, basis)" could not represent multiple distinct
   dates with the same basis (e.g., two effective dates). Corrected:
   stable component identity plus a role/scope discriminator.
3. **Executable fragment and bundle schemas.** `Current status/version`
   was a composite field; "Normalized fragment scope" had no algorithm;
   disposition bundles were prose-only. Corrected: split fields, a pinned
   normalized-scope algorithm, and a fixed bundle schema.
4. **Fully typed SM2 and reproducible search evidence.**
   `Size/hash/pagination/signature` and `Current status/version` were
   composites; no record could prove multi-source-class coverage.
   Corrected: split fields plus a search-set/coverage record; the signed
   CBA and first-party NBA/NBPA surfaces re-read this session.
5. **Governed blocked-finding and resolution records.** The blocked
   escape was an untyped "foundation amendment or adjudication decision"
   a maker could self-clear. Corrected: stable `BLK-…`/`RES-…` records
   under an independent-acceptance gate.
6. **Actual-schema validator.** R2.7's checker read no repository files,
   used hand-built fixtures with hard-coded expectations, and therefore
   could accept invalid states. Corrected: a validator that parses the
   real documents and the canon's binding schemas.
7. **Preserve valid R2.7 work and repair sequencing.** The R2.7 portions
   Codex found correct are preserved; every live status surface states
   the truthful R2.7-rejected → R2.8 sequence.

## 4. `DISP` XW2/SXW2 model — before and after (Correction 1)

**Before (R2.7 at `3e9f913f…`):** one flat detail schema —

`DR2 record ID | Historical source LEAF | Fragment ID | Terminal edge ID | Terminal edge type | Search-manifest IDs or — | Evidence/provenance references or — | No-owner reason | Preserved candidate anchor or — | Limitations | Reopening condition | Superseding/current relationship or — | Status | Version`

`Terminal edge ID` was "exactly one `XW2-…` or `SXW2-…` ID" and
`Fragment ID` used the §15.9.3 grammar `<historical LEAF ID>:F<n>` — but
an SXW2 subject is a **scenario number**, not a published LEAF, and no
scenario-fragment grammar was defined. An `SXW2-DISP` row was therefore
unrepresentable: it had no LEAF to name and no fragment grammar to use.
(The R2.7 synthetic checker papered over this by feeding the string
`scenario-53` into the LEAF-typed `edge["source"]` slot — an ad hoc
form the checker never validated.)

**After (R2.8):** one **explicitly tagged polymorphic** row with
mechanically exclusive subject variants —

`DR2 record ID | DISP subject class | Historical source LEAF or — | Historical fragment ID or — | Historical scenario or — | Scenario fragment ID or — | Terminal edge ID | Terminal edge type | Search-manifest IDs or — | Search-set ID or — | Evidence/provenance references or — | No-owner reason | Preserved candidate anchor or — | Limitations | Reopening condition | Superseding/current relationship or — | Status | Version`

| Dimension | `XW2-DISP` | `SXW2-DISP` |
|---|---|---|
| Subject class (closed) | `XW2-DISP` | `SXW2-DISP` |
| Historical LEAF | required (published v1.1 LEAF ID) | `—` (forbidden) |
| Historical fragment identity | required `<LEAF ID>:F<n>`, belongs to the LEAF | `—` (forbidden) |
| Scenario | `—` (forbidden) | required `scenario-<n>` |
| Scenario-fragment identity | `—` (forbidden) | required `scenario-<n>:F<m>`, belongs to the scenario |
| Terminal edge ID | exactly one `XW2-…` | exactly one `SXW2-…` |
| Terminal edge type | `process-only`/`invalid`/`no-successor`/`unsupported-residual` | `invalid`/`no-successor` only |
| Search-manifest IDs | required for `unsupported-residual`, else `—` | always `—` (no unsupported-residual) |
| Search-set ID | required for `unsupported-residual`, else `—` | always `—` |
| No-owner reason | the one the edge type requires | `false-claim`/`out-of-scope-or-obsolete` only |
| Preserved candidate anchor | never `—` for `unsupported-residual` | `—` (no unsupported-residual) |

An `XW2-…` edge resolves only to an `XW2-DISP` row and an `SXW2-…` edge
only to an `SXW2-DISP` row; **subject-family mismatch fails**. Every
dependent gate conformed (§14, §18).

## 5. Canonical scenario-fragment grammar (Correction 1)

Derived directly from the canon's own scenario identifiers — the §16
acceptance-test library numbers each published scenario, and the
standard already refers to them as "scenario 53", "scenarios 1–89". It
is **not** an ad hoc invention:

- **Historical scenario identifier:** `scenario-<n>`, where `<n>` is the
  published scenario's ordinal number (`1 ≤ n ≤ 89`, unpadded) in the
  §16 acceptance-test library of the pinned published v1.1 edition at
  commit `9814939c` (§15.9.8). Never the legacy-numbered §16 working
  copy on this branch; never an active `CBA2-SC-<NNN>` ID.
- **Scenario-fragment ID:** `scenario-<n>:F<m>` — the scenario
  identifier, one ASCII colon, one uppercase `F`, one unpadded positive
  integer `m` allocated contiguously from `1` at inventory declaration;
  per-scenario, append-only per §15.9.2; a scenario dispositioned whole
  is `scenario-<n>:F1`. Mechanically distinct from the §15.9.3 LEAF
  fragment grammar `<historical LEAF ID>:F<n>` (which begins `CBA-`), so
  a validator never confuses the two.
- The §15.9.3 fragment-inventory, bundle, normalized-scope, and
  reconciliation contracts apply analogously to scenario fragments; SXW2
  has only `invalid`/`no-successor` terminals and no
  `unsupported-residual`/`SM2`/search-set machinery. R7 declares the
  scenario-fragment inventories when it builds the `SXW2-…` crosswalk;
  R2.8 mints no concrete scenario-fragment record.

## 6. Scope, basis, compatibility, and uniqueness rules (Correction 1)

- **Mechanical equality / bidirectional reconciliation** over the tuple
  (subject class; historical LEAF or scenario; fragment; normalized
  scope; no-owner-reason basis; terminal edge; terminal edge type;
  generic `DR2-…` parent; `DISP` detail row; current status/version) —
  the edge and detail row agree on every element, both directions.
- **Uniqueness keys:** `XW2-DISP` unique per (historical source LEAF,
  historical fragment ID); `SXW2-DISP` unique per (historical scenario,
  scenario fragment ID); at most one current `DISP` detail row per
  terminal-subject key **and** basis.
- **Grouping:** one `DISP` record covers multiple detail rows only where
  they share one subject class and their terminal bases are demonstrably
  identical; an `XW2-DISP` record never carries an `SXW2-DISP` row
  (subject-family mismatch prohibited).
- **Direct-current-reference:** every current terminal edge references
  its current `DISP` directly; no reference resolves only through an
  `AMEND` chain. Prohibited: orphan parent, orphan detail, duplicate
  current decision, stale live reference, subject-family mismatch.

## 7. Source-date cardinality and reconciliation repair (Correction 2)

**Before:** date-component table
`Record ID | Date basis | Date value | Source statement locator | Limitations or —`
with "at most one current row per (Record ID, basis)" — two effective
dates could not both be represented.

**After (R2.8):**
`Record ID | Date component ID | Date basis | Date role/scope | Date value | Source statement locator | Limitations or —`

- **Stable identity:** `Date component ID` = `<Record ID>#D<k>`
  (append-only per §15.9.2), independent of basis and value.
- **Basis and value separate fields**, each under its own closed
  grammar.
- **Role/scope discriminator:** `primary` (exactly one per (Record ID,
  basis) the record supports) or `scoped:<slug>` (a further same-basis
  date the authority **expressly** supplies for a named provision-scope).
- **Uniqueness key (Record ID, Date basis, Date role/scope)** — multiple
  current same-basis rows valid **only** when their roles/scopes differ;
  a duplicate/conflicting component (same basis+role/scope, or a second
  `primary` for one basis) fails.
- **Authoritative representation:** the base `Source date` pair equals
  the `primary` row of its basis; every relied-on semantic date
  (including any `official-mutable` publication/date/season) reconciles
  to exactly one component row — no duplicated field contradicts or is
  untied to the authoritative component.
- Mechanically validated: real Gregorian dates; valid months; valid
  season/window formats; ordered window endpoints; exact-precision
  preservation (no day→month degradation); edition months only with
  `edition` basis; `—` pairing rules; metadata/URL/HTTP/retrieval/
  inference never manufacturing a semantic date; AMEND lineage and
  direct-current references.
- The signed CBA supports `agreement-as-of:2023-06-28` (`primary`),
  `effective:2023-07-01` (`primary`), and `edition:2023-07` (`primary`)
  as distinct rows; Article XXXIX §1's reserved earlier-commencement
  provisions are the model's example of a second same-basis `effective`
  (`scoped:<slug>`) date the pre-R2.8 rule could not represent.
- **Active `SRC2-001`/`SRC2-002` not modified** in R2.8; their migration
  to this model is R3.1 backlog items 5, 18, and 24 (§15).

## 8. Fragment normalized-scope and bundle schemas (Correction 3)

**Split status/version.** Fragment schema (R2.8):
`Fragment ID | Historical parent LEAF | Fragment kind | Normalized fragment scope | Decomposition decision record | Disposition bundle ID or — | Disposition edge ID(s) | Fragment status | Fragment version | Limitations or —`
— the composite `Current status/version` abolished; `Fragment status`
(`current`|`superseded`) and `Fragment version` (integer) separate.

**Normalized-scope representation and algorithm.** A `"; "`-separated,
ascending, non-overlapping list of **scope atoms** over the published
LEAF's Canonical requirement text (fixed at `9814939c`): a source-clause
coordinate `clause:<locator>` (the signed text's own enumeration) or a
sentence-span coordinate `sent:<a>`/`sent:<a>-<b>` (1-indexed ordinals).
Defines scope equality (atom-set equality), pairwise non-overlap
(disjoint atom sets), exhaustive coverage (union covers every ordinal
`1..S` and every enumerated clause), textual contiguity (contiguous
ordinal range where required), contiguous fragment numbering `F1..Fn`,
and stable identity across `AMEND` history.

**Disposition-bundle schema (fixed).**
`Bundle ID | Source historical LEAF | Source fragment ID | Member edge IDs | Member edge types | Member target IDs | Subject scope | Bundle class | Bundle status | Bundle version | Superseding/current relationship or —`
— `Bundle ID` = `BND-<NNNN>`; sorted/unique member edges; member types
drawn only from the nonterminal vocabulary; no duplicate source-target
mapping; subject scope equals the fragment's normalized scope; class
`active` (a bundle never terminal). Rejects: unknown edge types,
duplicate source-target mappings, duplicate edge members, active/terminal
mixtures, multiple/contradictory dispositions per fragment, bundles whose
edges do not point back to the fragment, undispositioned residuals,
noncontiguous fragment IDs, orphan fragments/bundles/edges/targets. One
fragment maps to multiple compatible active targets only through one
governed bundle; merge/split stays compatible with exactly-once
disposition.

## 9. Fully typed SM2 and search-set schemas (Correction 4)

**Split composite fields.** `SM2-…` schema (R2.8) separates the former
`Size/hash/pagination/signature` into `Binary size bytes` / `Binary
SHA-256` / `Binary pagination` / `Binary signature/as-of`, and the former
`Current status/version` into `Search status` / `Search version`; adds
`Subject class`, `Subject scenario`/`Subject scenario fragment ID`,
`Search-set ID`, and `Result linkage`. Field grammars, delimiters, list
rules, allowed `—`, and cross-field constraints pinned. The result
vocabulary stays `qualifying-authority-located` /
`no-qualifying-authority-located-in-searched-sources` / `inconclusive`
— it **cannot encode "none exists."**

**Search-set/coverage record (fixed).**
`Search set ID | Subject class | Subject LEAF or scenario | Subject fragment ID | Required source classes | Member SM2 IDs | Coverage assessment | Adequacy result | Set status | Set version`
— `Search set ID` = `SS2-<NNNN>`; the required source classes (at least
the signed CBA, controlling By-Laws, official NBA surfaces, and the
first-party operational-provenance availability check) joined to current
member `SM2-…` records; a deterministic `Adequacy result`
(`adequate-coverage` only when every required class has an adequate,
non-`inconclusive` member). Requires: exact subject/fragment linkage;
exact current source-record linkage; exact searched-source identity;
deterministic adequacy; zero orphan/stale; direct current references.
An `inconclusive` result or an `inadequate-coverage` set can **never**
support an `unsupported-residual` disposition or clear a blocked finding.
No result vocabulary can say or imply "none exists."

## 10. Structured, reproducible R2.8 source-search evidence (Correction 4)

Retrieval cutoff: **2026-07-21T09:56:51Z**. First-party sources
re-read this session:

| # | Surface | Method | Result |
|---|---|---|---|
| 1 | Signed CBA binary — `https://ak-static.cms.nba.com/wp-content/uploads/sites/4/2023/06/2023-NBA-Collective-Bargaining-Agreement.pdf` | `curl -sL` then `shasum -a 256`; page count via `pdfinfo`/`grep` | **2,850,534 bytes; SHA-256 `bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32`** (exact match to committed `SRC2-001` → artifact of record confirmed); **676 PDF pages** (printed page = PDF page − 24); HTTP 200, no redirect/auth |
| 2 | Current NBPA CBA page — `https://nbpa.com/cba` | fetch | Current agreement = **2023 NBA-NBPA Collective Bargaining Agreement** (effective July 1, 2023; through the 2029-30 season; opt-out after 2028-29). Previous: 2017 (through 6/30/2023), 2011 (through 6/30/2017). "Is there a newer CBA? No." Links a **distinct production of the same 2023 agreement** at `https://imgix.cosmicjs.com/…-Final-2023-NBA-Collective-Bargaining-Agreement-6-28-23.pdf` (filename encodes the 6-28-23 agreement-as-of date) — not a later agreement |
| 3 | NBA official CBA page — `https://official.nba.com/nba-collective-bargaining-agreement/` | fetch | **ETIMEDOUT (read)** to this session's client; could not be inspected |
| 4 | NBA official homepage — `https://official.nba.com/` | fetch | **Timeout (60 s exceeded)**; could not be inspected |

**Explicit current-NBPA-page search performed (row 2).** Redirects /
authentication: none required for rows 1–2; rows 3–4 timed out and are
recorded truthfully as not inspectable this session.

**Truthful bounded conclusion (never a universal-absence claim):**
**"No later governing agreement text was located in the searched
first-party sources."**

**Comparison caveat:** R2.8 re-verified only the ak-static binary's
SHA-256 and read the NBPA page's own identification of its linked file;
R2.8 did **not** perform a full-text comparison of the differently-
produced NBPA-linked (imgix) file against the ak-static binary. The R2.7
receipt separately recorded a **sampled**-passage comparison (§1(d)
as-of, Article XXXIX §1 effective, VII §8(a)) of the ak-static binary vs
the 2024/06 production and found those sampled passages identical — a
sampled comparison, never a claim of byte-for-byte or full-text
identity.

## 11. Blocked-finding/resolution schemas and independent-acceptance gate (Correction 5)

**Before:** the blocking outcome resumed on "an explicit, recorded
foundation amendment or adjudication decision" — untyped prose a maker
could write and clear unilaterally.

**After (R2.8):** two stable, parseable support-population records.

Blocked-finding record:
`Blocked finding ID | Subject class | Subject historical LEAF or — | Subject fragment or candidate | Finding type | Search-set/manifest references | Evidence references or — | Preserved candidate anchor | Finding status | Resolution ID or — | Limitations`
— `BLK-<NNNN>`; `Finding type` closed (`blocked-unsupported-obligation`);
`Finding status` closed (`open`|`resolved`); an `open` finding fails U7
and stops the unit.

Resolution record:
`Resolution ID | Blocked finding ID | Proposed outcome | Resolver authority | Maker/proposer identity | Independent checker identity | Independent acceptance commit/receipt | Resolution status | Resolution version | Reopening condition | Limitations | Superseding/current relationship or —`
— `RES-<NNNN>`; `Proposed outcome` closed
(`foundation-vocabulary-or-scope-decision` |
`authority-located-mint-owner` | `out-of-scope-determination`);
`Resolution status` closed (`proposed`|`accepted`|`superseded`).

**Independent-acceptance gate:** a resolution is `accepted` **only** when
`Independent checker identity` differs from `Maker/proposer identity`
and a pinned acceptance commit/receipt is recorded — **a maker can never
self-accept**. A finding is `resolved` only when it names a current
`accepted` resolution; construction resumes only after that plus every
required same-commit reference update. A whole valid, in-scope,
unsupported substantive obligation stays blocked until a governed
resolution route is independently accepted — it can never escape as
`unsupported-residual`, `no-successor`, `process-only`, `obsolete`,
`invalid` merely because authority was not located, or an unstructured
waiver. The false-authority-assertion (may be `invalid`) vs
unsupported-substantive-mechanic (blocked, not invalid) distinction is
preserved. Traced through U7, construction stop conditions, G1, G3, G15,
`G15R`, R9 (§14, §18).

## 12. Validator design and proof it parses the binding contracts (Correction 6)

`work/architect-completion/cba_canon_v2_foundation_validator.py` —
**SHA-256 `14f91c113b21e15b5a894be51445d141b6f3c18746556927f934e0de3dc8b3a0`**.

- **Exact invocation:**
  `python3 work/architect-completion/cba_canon_v2_foundation_validator.py`
- **Input files/sections:** the actual repository canon
  `docs/reference/cba/ARCHITECT_CBA_CANON.md` — §15.9.3/§15.9.4/§15.9.6/
  §15.9.8 schema signatures and closed vocabularies, and the §15.10–
  §15.12 populations. No network, no dependency beyond Python 3.9+ stdlib
  (`hashlib`, `os`, `re`, `sys`).
- **Vocabulary extraction from the governing canon:** the validator pulls
  the date-basis, fragment-kind, no-owner-reason, SM2-result,
  DISP-subject-class, and resolution-outcome vocabularies and the XW2
  edge-type table (with the Terminal? column) **from the canon text**,
  and asserts each set's canonical cardinality — a canon/validator
  vocabulary drift fails here rather than silently. It maintains no
  parallel hidden vocabulary.
- **Schema-signature check:** asserts the canon contains all 10 R2.8
  schema signatures (polymorphic DISP, date-component, split fragment +
  bundle, split SM2, search-set, blocked-finding, resolution, scenario-
  fragment grammar) — a reverted canon fails.
- **Actual-population parse + legacy recognition:** parses the 131 §15.11
  `XW2-…` edges and the §15.12 SRC2 base header; recognizes the committed
  R3 population as **rejected/legacy** — the SRC2 base still carries the
  pre-R2.7 `Publication/effective date` field, and the terminal edges
  reference the committed `DR2-0037`(OWN)/`DR2-0038`(OWN)/`DR2-0039`(ATOM)
  decisions the §15.9.4 transition block names (extracted from the canon,
  not hard-coded) — and **refuses to certify it as R3.1-conforming**
  (treating a silently-changed population as conforming is itself flagged
  as an error). Reusable against the migrated R3.1 population later via
  the same parser.
- **Same parser for fixtures and mutations:** every adversarial case runs
  through the same `validate_*` functions and reconciliation rules; a
  result is meaningful only because the parser produced it, never because
  a hard-coded expected value matched (the fixture defect that let R2.7's
  cases 11/M3/M4 reject for the wrong reason was corrected so those cases
  test their intended path).
- **Exit behavior:** exits nonzero on any unexpected acceptance/rejection,
  vocabulary drift, missing schema signature, or legacy-certification
  error. Demonstrated: a single fixture mismatch drove exit 1 during
  development; the corrected run exits 0.
- **Deterministic:** two consecutive runs are byte-identical.
- **No essential validation lives only in scratch:** the committed file is
  the complete validator; the scratchpad `hashcheck.py` is a preservation
  helper only, and its logic is reproduced in §17 for any reviewer.

**Expected output (final):** the canon path and SHA-256; "vocabularies
extracted from canon: date_bases=4, disp_subject_classes=2,
fragment_kinds=4, no_owner_reasons=4, resolution_outcomes=3,
sm2_results=3, sxw2_terminal_types=2, xw2_edge_types=9,
xw2_nonterminal_types=5, xw2_terminal_types=4"; "canon contains all 10
R2.8 schema signatures"; the population assessment ("parsed 131 XW2
crosswalk edges", the two LEGACY notes, and "VERDICT: committed R3
population correctly recognized as rejected/legacy; NOT certified as
R3.1-conforming"); the 52 case lines each `PASS`; and
"26 inherited + 15 new Codex probes + 11 further mutations = 52 cases
run, 0 total failures", exit code 0.

**Two identical successful runs** were captured this session (byte-for-
byte identical stdout; both exit 0).

## 13. All 26 inherited and 15 new adversarial results (Correction 6)

All run through the binding parser; every result matched its expectation
(exit 0). Inherited 26 (R2.7-mandated), re-run on the R2.8 schemas:

| # | Case | Expected | Result |
|---|---|---|---|
| 1 | silently omitted residual | reject | PASS |
| 2 | exhaustive supported+unsupported decomposition | accept | PASS |
| 3 | overlapping fragments | reject | PASS |
| 4 | orphan fragment | reject | PASS |
| 5 | edge references unknown fragment | reject | PASS |
| 6 | fragment both terminal and actively owned | reject | PASS |
| 7 | two terminal fragments, distinct IDs | accept | PASS |
| 8 | two terminal decisions for one fragment | reject | PASS |
| 9 | terminal edge references OWN | reject | PASS |
| 10 | terminal edge references superseded DISP | reject | PASS |
| 11 | DISP detail mismatch (fragment) | reject | PASS |
| 12 | orphan current DISP | reject | PASS |
| 13 | wholly unsupported obligation blocked | reject | PASS |
| 14 | kind separation (invalid on claim, not mechanic) | accept | PASS |
| 15 | `edition:2024-06` with limitation | accept | PASS |
| 16 | edition month as publication/effective | reject | PASS |
| 17 | `effective:2023-07-01` | accept | PASS |
| 18 | exact date degraded to month | reject | PASS |
| 19 | metadata-derived day | reject | PASS |
| 20 | missing/unknown basis or half-empty pair | reject | PASS |
| 21 | adequate SM2 record | accept | PASS |
| 22 | vague SM2 source identity | reject | PASS |
| 23 | universal-negative result | reject | PASS |
| 24 | SC2 check 11: terminal SXW2 edge to OWN | reject | PASS |
| 25 | valid AMEND supersession, same-commit update | accept | PASS |
| 26 | stale reference after AMEND (no same-commit update) | reject | PASS |

15 new Codex probes:

| # | Probe | Expected | Result |
|---|---|---|---|
| N1 | noncontiguous fragment IDs | reject | PASS |
| N2 | unknown edge type (in bundle) | reject | PASS |
| N3 | duplicate/incompatible disposition bundle | reject | PASS |
| N4 | conflicting edition/date representation | reject | PASS |
| N5 | missing required immutable-source semantic date | reject | PASS |
| N6 | reversed/impossible effective window | reject | PASS |
| N7 | malformed date component | reject | PASS |
| N8 | incomplete SM2 record | reject | PASS |
| N9 | inconclusive search supporting unsupported-residual | reject | PASS |
| N10 | inadequate source-class coverage supporting unsupported-residual | reject | PASS |
| N11 | whole unsupported obligation escaping as no-successor | reject | PASS |
| N12 | whole unsupported obligation escaping as process-only | reject | PASS |
| N13 | invented/invalid scenario-DISP subject | reject | PASS |
| N14 | orphan generic DISP parent | reject | PASS |
| N15 | AMEND ID overwrite/reuse | reject | PASS |

11 further mutations (to prove the specific R2.8 mechanics):

| # | Mutation | Expected | Result |
|---|---|---|---|
| M1 | valid `XW2-DISP` variant | accept | PASS |
| M2 | valid `SXW2-DISP` variant | accept | PASS |
| M3 | subject-family mismatch (XW2 edge → SXW2-DISP) | reject | PASS |
| M4 | wrong no-owner reason for edge type | reject | PASS |
| M5 | multiple same-basis effective dates, distinct roles | accept | PASS |
| M6 | conflicting duplicate date components | reject | PASS |
| M7 | bundle active/terminal mixing | reject | PASS |
| M8 | maker self-acceptance of a blocked resolution | reject | PASS |
| M9 | finding resolved without accepted resolution | reject | PASS |
| M9b | valid independent acceptance (distinct checker) | accept | PASS |
| M10 | G15R: live reference to a superseded record | reject | PASS |

## 14. G15R population and AMEND enforcement (Correction 6 / gates)

`G15R` (canon §15.9.9) and G15 (R8) now scope every population R2.8
adds — `<Record ID>#D<k>` date-component rows, `BND-…` bundles, `SM2-…`
and `SS2-…` records, `BLK-…`/`RES-…` records, polymorphic
`XW2-DISP`/`SXW2-DISP` `DISP` detail rows — into the AMEND/current-
reference integrity gate. `G15R` gained: check 9 now enumerates the new
ID namespaces (no reuse/renumber); check 10 now validates the polymorphic
DISP detail rows (subject-family agreement, no mismatch), the role/scope
date-component cardinality, the split fragment rows, and the `BND`/`SM2`/
`SS2`/`BLK`/`RES` rows; and a new check 11 requires every resolved
`BLK-…` to name a current `accepted` `RES-…` whose independent checker
differs from the maker. The §15.9.2 draft-mutability and append-only
lists, G15's global population list, U7, G1, G3, and R9 were conformed to
the same populations and rules. The validator enforces complete
population membership for `G15R` (mutation M10) and no ID
reuse/AMEND-overwrite (probe N15).

## 15. Complete preserved R3.1 backlog (Correction 7)

Every existing R3.1 backlog item **1–21 is preserved unchanged**. Only
the migration duties required by the corrected R2.8 schemas were added,
as items **22–27** (repair plan, R3.1 section):

- **22.** Mint terminal `DISP` records (items 12/20) as the polymorphic
  `XW2-DISP` subject variant; no `SXW2-DISP` at R3.1 (SXW2 is R7).
- **23.** Declare fragment inventories (item 16) under the corrected
  §15.9.3 schema — split status/version, normalized-scope atoms, and one
  `BND-…` bundle per multi-target fragment.
- **24.** Migrate `SRC2-001`/`SRC2-002` (items 5/18) to the corrected
  date-component table (`<Record ID>#D<k>`, role/scope) and mint the
  item-17 `SM2-…` records under the split binary/status fields.
- **25.** Bind the A18.7 residual's `SM2-…` under a current `SS2-…`
  reporting `adequate-coverage` before `unsupported-residual`; otherwise
  a governed `BLK-…` finding.
- **26.** Record any wholly-unsupported valid in-scope obligation as a
  governed `BLK-…` finding cleared only by an independently `accepted`
  `RES-…` (distinct checker).
- **27.** Run the committed actual-schema validator against the migrated
  R3.1 population at the checkpoint, extending `G15R` to the new
  populations and confirming zero legacy-schema rows remain.

Preserved R2.7 work Codex found correct (unchanged unless a dependency
required a precise adjustment): scope and active-record preservation; the
four source-date bases and the metadata prohibition; the initial
blocked-unsupported-obligation stop; the underlying first-party source
conclusion; `G15R`'s named repair-local purpose; the A18.7
express-versus-INFERRED analysis; the `DR2-0037/0038/0039` transition
inventory; the full R3.1 backlog; and the phase/gate boundaries.

## 16. Truthful status sequencing (Correction 7)

Every live status surface now states:

**R3 rejected → R2.6 rejected → R2.7 rejected → R2.8 correction →
independent Codex R2.8 review → R3.1 only after R2.8 ACCEPT →
independent Codex R3.1 review → R4 only after R3.1 ACCEPT.**

Surfaces updated: canon header "What v2.0 changes" and amendment date; a
new amendment-log R2.8 row (the R2.7 row preserved unchanged as history);
§15.9 title and intro; §15.9.2 sequencing; §15.10 intro prose; §19.3
A-family status; and the repair plan intro, the R2.7 unit outcome, the
new R2.8 unit section, and the R3.1 section. Unambiguously:

- **R2.8 completion does not equal acceptance.**
- **R3 remains rejected.**
- **No A-series record is accepted.**
- **R3.1 remains blocked pending independent R2.8 acceptance.**
- **R4 remains blocked pending later R3.1 acceptance.**
- **Phase 1 remains open.**
- **Phase 2, W1.1, and application work remain blocked.**

## 17. Preservation — mechanically proven

Anchor-locked extraction (heading line starts) at the baseline
(`3e9f913f…`) and at the final R2.8 working state.

| Preserved area | Baseline SHA-256 (bytes) | Final SHA-256 (bytes) | Status |
|---|---|---|---|
| **Active §15.10–§15.12 record-table rows** (every line beginning `\|` in `### 15.10` → `## 16.`) | `dfcfe209c5629f8f86f1014a7ee42f42012655714c9b28fab048951bb61b1bbd` (118,104) | identical | **Byte-identical** — no record-table row changed |
| Canon §5.9 (`### 5.9` → `## 6.`) | `53c968ade8cdb2177517412ac09f2bae63ee7642cfa3b24299d2b208895fb373` (6,198) | identical | Byte-identical |
| Historical §15.1–§15.8 (`### 15.1 ` → `### 15.9 `) | `7b3f6aaba81129dceaa8e55f6356f8bbecd3af7e1ff59b127a443fc5d7b14d97` (90,455) | identical | Byte-identical |
| Historical scenarios 1–89 (`## 16.` → `## 17.`) | `eb11bb122840f881204be4d3de9b8a47a680a19622677e4287227730615b311f` (24,119) | identical | Byte-identical |
| Sixteen-check SC2 block (`**SC2 —` → `**R8 —`) | `ca26937dedde2abdc665c109cb30ad0a7d27c8a3f794062e1abb3f6596c656bd` (2,071) | `6a5e6997280f5880e6da46945b47a1d3aef5226cfb0a8bf35549d403dfd302f7` (2,367) | **Changed by authorization** — only inside check 11; **16 checks before and after** (§18) |
| §15.9 foundation standard (`### 15.9 ` → `### 15.10 `) | `ae97e1f536a62bf9d3526a5fb433b4644dc7140e4dd6b827f4de91164205876a` (136,836) | `c73e8048188e02970745e24de124b4ef9760a460d58f5a72197cb961bd85e1a0` (162,740) | **Changed by design** — R2.8's authorized surface |
| §15.10–§15.12 whole section (`### 15.10 ` → `## 16.`) | `23422179885e0bdd5077241961817ce71e86cd8bf3e291f45405f0de404c823a` (120,399) | `9c3acaae4fd75a1bc127ad3f36b19725a8cdf226ad516ba2a61f64b63878172d` (120,417) | **Changed by design** — a full-line diff shows exactly one changed non-record prose line (the §15.10 intro sequencing) |
| All twelve prior receipts (R1, R1.1, R1.2, R2, R2.1–R2.7, R3) | — | identical | Whole-file hashes unchanged; `git diff` contains no receipt path (R2.7 receipt `f5cf5568…` preserved) |

Extraction helper (reproduces the table above against any commit or the
worktree):

```python
import hashlib
def extract(data, a, b):
    lines = data.split(b"\n"); s=e=None
    for i, ln in enumerate(lines):
        if s is None and ln.startswith(a): s = i
        elif s is not None and e is None and ln.startswith(b): e = i; break
    return b"\n".join(lines[s:e]) + b"\n"
data = open("docs/reference/cba/ARCHITECT_CBA_CANON.md","rb").read()
for name,a,b in [("sec5.9",b"### 5.9",b"## 6."),("hist",b"### 15.1 ",b"### 15.9 "),
                 ("scen",b"## 16.",b"## 17."),("SC2","**SC2 —".encode(),"**R8 —".encode()),
                 ("15.9",b"### 15.9 ",b"### 15.10 "),("15.10-12",b"### 15.10 ",b"## 16.")]:
    seg=extract(data,a,b); print(name,hashlib.sha256(seg).hexdigest(),len(seg))
seg=extract(data,b"### 15.10 ",b"## 16.")
tbl=b"\n".join(l for l in seg.split(b"\n") if l.startswith(b"|"))+b"\n"
print("recordtables",hashlib.sha256(tbl).hexdigest(),len(tbl))
```

Signed CBA binary identity (reviewer rerun):

```bash
curl -sL -o /tmp/cba2023.pdf \
  "https://ak-static.cms.nba.com/wp-content/uploads/sites/4/2023/06/2023-NBA-Collective-Bargaining-Agreement.pdf"
shasum -a 256 /tmp/cba2023.pdf   # expect bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32
```

## 18. SC2 sixteen-check proof

Extract the SC2 block (`**SC2 —` → `**R8 —`) from `git show 3e9f913f…`
and from the worktree; enumerate top-level `N. ` items in each and diff:

- **Baseline checks:** `1..16` (sixteen).
- **Worktree checks:** `1..16` (sixteen).
- **Checks whose body differs:** `['11']` only.
- **Checks added/removed:** none.

Check 11 now requires the terminal SXW2 edge to carry a direct reference
to a current `DISP` record whose detail row is the **`SXW2-DISP`**
subject variant of the matching terminal type, with the source scenario
(`scenario-<n>`), scenario fragment ID (`scenario-<n>:F<m>`), edge ID,
normalized scope, and type agreeing both directions; no terminal edge
references an `OWN`, an `XW2-DISP` row, or any subject-family-mismatched
record; zero stale pre-`AMEND` references; terminal SXW2 uniqueness on
the (historical scenario, scenario fragment ID) key; zero orphan current
scenario `DISP` records; and correct current non-`DISP` types for
nonterminal references. **No seventeenth check was added.**

## 19. Contradiction sweeps

Run on the full canon and repair plan at the final R2.8 working state;
earlier receipts are immutable history (HISTORY); frozen §15.1–§15.8
rows, scenarios 1–89, and committed §15.10–§15.12 record-table rows are
byte-preserved and non-authorizing (FROZEN/COMMITTED):

| Sweep | Result |
|---|---|
| Old sequence `R2.7 → independent Codex R2.7 review` as a **live-status** claim | **Zero.** The four remaining occurrences are HISTORY: the R2.7 amendment-log row, the R2.7 "What v2.0 changes" chronological clause, the R2.7 unit-record section's finding #9, and the R2.8 plan edit that frames it as "the intended … sequence [that] did not hold." Every live-status surface states the R2.8 sequence |
| `independent Codex R2.8 review` present on live-status surfaces | Present in the canon (4) and plan (2) |
| Old date-cardinality `at most one current row per (Record ID, basis)` as a bare binding rule | **Zero** — the sole occurrence is the R2.8 note quoting it as the superseded pre-R2.8 rule; the binding rule is now `(Record ID, basis, role/scope)` with `role/scope` present twice |
| Composite `Size/hash/pagination/signature` as a binding `SM2-…` field | **Zero binding** — survives only in the R2.6/R2.7 amendment-log HISTORY rows and the (immutable) R2.7 receipt; the binding SM2 schema carries the four split fields |
| Universal-absence claim about governing text (`no later CBA edition exists`, `none exists`) | **Zero** — the `none exists` hits are the pre-existing A11 "no legal decomposition exists" rule and field-existence rules (`— only where none exists`), plus the SM2/HISTORY rules that **forbid** "none exists"; no assertion that no later CBA exists |
| Polymorphic `DISP subject class` in binding §15.9.4 | Present (3) |
| Maker-cannot-self-accept independent-acceptance rule | Present (3) |
| Untyped "foundation amendment or adjudication decision" as the live escape | **Zero live** — survives only inside the R2.8 sentence that names it as the superseded pre-R2.8 escape |

## 20. Validation results and scope boundaries

Run at the final R2.8 working state on baseline `3e9f913f…`:

- **Exact changed-file check:** `git diff --name-only` =
  `docs/reference/cba/ARCHITECT_CBA_CANON.md`,
  `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md`;
  untracked additions = this receipt and the validator only. Exactly the
  four authorized files; no prior receipt in the diff.
- **Byte-level active-record-table preservation:** §17 — the record-table
  row hash (`dfcfe209…`, 118,104 bytes) identical on both sides; the
  full-line diff of §15.10–§15.12 shows exactly one changed non-table
  prose line.
- **SC2 proof:** enumerated checks 16 → 16; only check 11's body differs
  (§18).
- **Validator (actual-schema):** parses the real canon and populations;
  extracts vocabularies from the canon (correct cardinalities); confirms
  all 10 R2.8 schema signatures; recognizes the committed R3 population as
  rejected/legacy (not R3.1-conforming); **52 adversarial cases (26
  inherited + 15 new + 11 mutations), 0 failures, exit 0**; two runs
  byte-identical (§12–§13).
- **Contradiction sweeps:** §19 — all clean.
- **`git diff --check` (pre-commit):** clean — the one changed header
  line (amendment date) keeps the CommonMark backslash hard break the
  R2.7 unit introduced, so the changed range carries no trailing
  whitespace. (The pre-existing R3-era hard-break finding in the
  `6d9c7576…..07f0667d…` range remains R3.1 backlog item 15.)
- **`npm run lint:md`:** pre-existing findings only — the accepted §16
  `MD029/ol-prefix` continuous-numbering class (unchanged by R2.8; the
  §16 scenarios block is byte-preserved) plus the pre-existing findings
  in unrelated files. Zero new findings in R2.8's changed files. The
  global nonzero exit is caused by pre-existing findings — reported
  truthfully, never claimed as a global pass. (New vs established
  findings separated in the final unit report.)
- **`npm run docs:guardrails`:** pass.
- **Not run, per the R2.8 order and repair-plan rule 6:** application
  tests, builds, typecheck, ESLint, `test:diff`, and the full suite —
  R2.8 is documentation/standards work only.

Scope boundaries honored:

- No active §15.10–§15.12 record-table row changed (byte-identity
  proven); no concrete active record and no fragment, bundle, search,
  search-set, DISP, blocker, or resolution record minted; no ID
  renumbered or reused; every identifier used in examples in this receipt,
  the canon, and the validator (e.g., `CBA-A18.7:F2`, `scenario-53:F1`,
  `SM2-9001`, `SS2-9001`, `BND-…`, `BLK-…`, `RES-…`, `DR2-9011`) is
  explicitly illustrative and constitutes no minted record.
- No prior receipt edited — including the rejected R2.6, R3, and R2.7
  receipts; their incorrect or incomplete claims are superseded by this
  receipt, never by editing history.
- Historical §15.1–§15.8 rows, scenarios 1–89, and §5.9 untouched
  (byte-proven); the sixteen-check SC2 block changed only inside check 11.
- R3.1 was **not started**; R4–R9, Phase 2, and W1.1 were **not
  started**; no Phase 2 compliance verdict issued anywhere; Linear not
  read or written; `main` unchanged (`69f8f6b6…`); no application, README,
  code-map, test, schema, fixture, configuration, or data change.

**R2.8 is complete but not independently accepted — completing this unit
does not accept it. R3 remains rejected; no A-series record is accepted;
R3.1 and R4 remain blocked until an independent Codex review returns
ACCEPT on the R2.8 foundation and, later, on the R3.1 checkpoint.**
