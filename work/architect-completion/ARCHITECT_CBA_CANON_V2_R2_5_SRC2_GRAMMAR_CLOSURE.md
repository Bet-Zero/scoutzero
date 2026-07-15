# Architect CBA Canon v2.0 — R2.5 Receipt: SRC2 Field-Grammar Closure

## 1. Provenance and baseline

| Field | Value |
|---|---|
| Repair unit | R2.5 — the two remaining SRC2 grammar blockers found by the independent Codex review of R2.4 (REJECT/BLOCK-R3 at `e0344aac…`), executed as its own bounded grammar-only unit |
| Branch | `architect/cba-canon-v2` |
| Baseline commit | **`e0344aacc3b60598fc625018640f0d1c31fb6024`** — the full R2.4 checkpoint SHA, verified as HEAD = `origin/architect/cba-canon-v2` at session start (short form `e0344aac`); parent = `c22286072578beed0020c7749e651a50ce566d43` (R2.3); R1.2 = `07d5aa58…`; R2.2 = `6aa616fd…`; R2.1 = `05c1b28e…`; R1.1 = `1532c928…`; R2 = `056b9d02…`; R1 = `af931e90…` |
| `main` | `main` = `origin/main` = `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288` — untouched by this unit |
| Clean-state verification | Worktree, index, and untracked state completely clean at session start; ahead/behind vs upstream 0/0 |
| Ordering review | The independent Codex review of R2.4 at `e0344aac` returned **REJECT/BLOCK-R3**. It **passed** — and this unit did not reopen or redesign — transitive evidence-authority compatibility, the secondary-source/OPS policy, AMEND numbering, the source/provenance terminology, R1.2's source law, SC2/SXW2 integrity, the historical-register population separation, and scope/preservation. It found **two remaining foundation blockers** (§3 below) and one low, nonblocking receipt erratum (§10 below), and ordered R2.5 as a bounded grammar-only correction unit |
| Scope | Two SRC2 field grammars plus the minimal amendment/status surfaces recording them. No concrete v2 record; no register row, scenario, ID, or source value changed; R3–R9, Phase 2, and W1.1 not started |
| Edition status after R2.5 | Canon v2.0 **working draft** — not accepted, not active; **R2.5 is not independently accepted**; v2.0 checksum deliberately **not** computed (R8) |

## 2. Files changed — exactly three

1. `docs/reference/cba/ARCHITECT_CBA_CANON.md` — the §15.9.6 base-table
   schema (composite field split; thirteen pinned fields); the
   composite-abolition rule; the `official-mutable` detail-schema
   season note; the pinned season grammar (`YYYY-YY`) and the three
   verification-metadata grammars with the binding
   verification-metadata rules; the calendar-date grammar's express
   real-calendar-validity wording; the per-type `—` validity matrix
   (season cell; three new verification rows); the field-level
   validation paragraph; the NBA per-class minima season reference;
   the U8/U9/G14/R9 gate references to the same grammars; the §15.9
   heading and intro receipt reference; the header "What v2.0 changes"
   paragraph; and one new amendment-log row.
2. `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md` —
   status reconciliation (the independent Codex R2.4 review result
   with its passed areas and two blockers; R2.4 executed at the full
   verified SHA; the new R2.5 unit section; global rule 1; the R3
   dependency; the R8/R9 gate descriptions matching the corrected
   canon gates).
3. `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_5_SRC2_GRAMMAR_CLOSURE.md`
   — this receipt (new).

Nothing else. The R1, R1.1, R1.2, R2, R2.1, R2.2, R2.3, and R2.4
receipts are untouched immutable review history. No application,
README, code-map, test, schema, fixture, configuration, or data file
changed; Linear was not read or written.

## 3. The two formal Codex blockers repaired

| # | Blocker | Correction contract |
|---|---|---|
| 1 | The official-mutable publication "date or season" field permitted a season but defined no exact season grammar, so a season value could not be mechanically validated | Exactly one accepted machine season grammar, `YYYY-YY` (§4 below), pinned in §15.9.6 and referenced identically by the base schema, the `official-mutable` detail schema, the per-type validity matrix, the NBA per-class minima, and U8/U9/G14/R9; no second season syntax exists |
| 2 | The SRC2 base field `Verifier/session/date` was an unparseable composite mixing three values in one column | The composite abolished and split into three separately required, individually typed columns — `Verifier identity`, `Verification session ID`, `Verification date` — growing the base table from eleven to thirteen pinned fields, each independently parsed and validated (§5–§8 below) |

## 4. Pinned season grammar — exact rule and cases

The only accepted machine season format is `YYYY-YY` (canon §15.9.6):

1. `YYYY` is exactly four ASCII digits.
2. The separator is exactly one ASCII hyphen-minus `-` (`U+002D`).
3. `YY` is exactly two ASCII digits.
4. `YY` must equal the last two digits of `YYYY + 1`, modulo 100.
5. No spaces are permitted.
6. An en dash, em dash, slash, textual prefix, abbreviated first year,
   four-digit second year, or arbitrary season label is invalid.

| Value | Outcome | Reason |
|---|---|---|
| `2026-27` | **Valid** | Consecutive years; hyphen-minus |
| `1999-00` | **Valid** | 1999 + 1 = 2000 → `00` (modulo 100) |
| `2026–27` | **Invalid** | En dash, not hyphen-minus |
| `2026/27` | **Invalid** | Slash |
| `FY26` | **Invalid** | Textual prefix |
| `26-27` | **Invalid** | Abbreviated first year |
| `2026-28` | **Invalid** | Years not consecutive |
| `2026-2027` | **Invalid** | Four-digit second year is invalid under this field grammar |

Where a source title reproduces typographic season text (for example
`2026–27` with an en dash), the title/identity text may preserve the
source's typography, but the structured season field must normalize it
to `2026-27`. The season alternative is retained because official NBA
values are commonly season-specific; only the machine format is pinned.

## 5. Split verification metadata — the three new columns

The composite base field `Verifier/session/date` is replaced by three
separate required columns, and the stated base-column count grows from
**eleven** to **thirteen**:

New base schema (canon §15.9.6):

`Record ID | Provenance type | Source/provenance identity | Publication/effective date or — | Official URL or — | Artifact SHA-256 or — | Retrieval timestamp or — | Authentication timestamp or — | Verifier identity | Verification session ID | Verification date | Record limitations | Record status/version`

A base row that still uses the composite field — or any single field
mixing verifier, session, and date content — is malformed and fails.

## 6. Exact grammar for each verification column

| Column | Grammar |
|---|---|
| `Verifier identity` | `human:<slug>` or `agent:<slug>`; `<slug>` is 1–64 ASCII characters, begins with a lowercase ASCII letter or digit, contains only lowercase ASCII letters, digits, `.`, `_`, or `-`, and contains no spaces. Valid: `agent:claude-code`; `agent:codex`; `human:project-owner`. Invalid: `Claude`; `agent:`; `agent:Claude Code`; `agent:claude/code` |
| `Verification session ID` | `session:<slug>`; `<slug>` is 1–96 ASCII characters under the same character rules, no spaces, identifying the authoring/verification session within the unit receipt. Valid: `session:r3-20260715-01`. Invalid: `r3-20260715-01`; `session:`; `session:R3 01`. Disclosure of a provider's confidential internal session identifier is **not** required — a receipt-scoped deterministic session identifier meeting this grammar is sufficient |
| `Verification date` | `YYYY-MM-DD`, satisfying the pinned calendar-date grammar including real calendar validity |

Binding rules (canon §15.9.6): all three fields are mandatory for
every `SRC2-…` base row of every provenance type; none may be `—`;
each field is independently parsed and validated under its own
grammar; a nonempty field can never compensate for another field that
is missing or malformed; and missing or malformed verification
metadata fails the record, which then certifies nothing.

## 7. Field-level validation changes

- The per-type `—` validity matrix gains three rows — `Verifier
  identity`, `Verification session ID`, `Verification date` — each
  **Required (never `—`)** for all four provenance types.
- The matrix's official-mutable Publication/effective date cell now
  reads "a date, or a season under the pinned `YYYY-YY` season
  grammar".
- The field-level validation paragraph expressly includes the season
  grammar and the three split verification fields, each independently
  parsed and validated, with one valid verification field never
  concealing another that is missing or malformed.
- The pinned calendar-date grammar now states real calendar validity
  expressly ("dates are `YYYY-MM-DD` and must be real calendar
  dates"), which the Verification date column inherits.
- The `official-mutable` detail schema's parenthetical points its
  season alternative (and the base row's) to the pinned `YYYY-YY`
  grammar; the NBA per-class minima's "publication date or season"
  points to the same grammar.

## 8. U8/U9, G14, and R9 reconciliation

| Gate | Update |
|---|---|
| U8 | The `SRC2` field-level validation parenthetical now includes "every structured season value valid under the pinned `YYYY-YY` season grammar; the three split verification-metadata fields — `Verifier identity`, `Verification session ID`, `Verification date` — each present, never `—`, and independently valid under their §15.9.6 grammars" |
| U9 | Reference parsing is expressly under "the same pinned field grammars U8 validates, including the `YYYY-YY` season grammar and the three split verification-metadata grammars" |
| G14 | The global type-specific field-level validation parenthetical now includes "the pinned `YYYY-YY` season grammar, and the three split verification-metadata fields under their §15.9.6 grammars" |
| R9 | The independent re-run parenthetical updated identically to G14 |

All four gates point to the single §15.9.6 grammar definitions — no
gate defines a divergent variant. The repair plan's R8 (G14) and R9
descriptions were conformed to the same wording.

## 9. Repair-plan reconciliation

The plan now records: the independent Codex R2.4 review result
(REJECT/BLOCK-R3 at `e0344aac…`) with the passed areas that may not be
reopened (transitive authority compatibility, secondary-source/OPS
policy, AMEND numbering, terminology, R1.2 source law, SC2/SXW2,
historical-population separation, scope/preservation) and the sole
grounds of rejection (the two SRC2 grammar defects); the R2.5 unit
section (bounded grammar-only correction; exactly three authorized
files; earlier receipts immutable; no concrete records; the receipt
erratum); global rule 1 extended to R2.5; the R3 dependency updated to
the post-R2.5 review; and R3 blocked pending another independent Codex
foundation review with Phase 1 open and R3–R9, Phase 2, W1.1,
application work, scenarios, code-map work, and Linear out of scope.
**R2.5 is not marked independently accepted.**

## 10. R2.4 receipt erratum — HISTORY disposition

The immutable R2.4 receipt (§9.1) stated that its literal sweep found
**zero** `secondary expert` occurrences in the canon **or plan**.
Codex found one valid occurrence remaining in the repair plan — the
historical description of R2.4's blocker 3 ("conflict order ending in
'secondary expert source'"), which describes the corrected defect.

Erratum of record (low, nonblocking):

- The intended and correct claim is **zero remaining binding
  occurrences**; the canon-side claim was and remains accurate.
- The remaining repair-plan occurrence is classified **HISTORY** — an
  accurate description of the pre-R2.4 defect as reviewed, exactly the
  population class the R2.4 sweep keyed as retained-by-design.
- It does not authorize or promote a secondary source; §15.9.1
  boundary rule 4 and the binding §15.9.6 policy govern.
- The immutable R2.4 receipt is **not edited**; this erratum is the
  durable correction of record.
- The legitimate historical wording is **not removed** to force a
  literal zero count — history is preserved, not laundered.

## 11. Passing-area preservation results

All hashes recomputed at the baseline and at the R2.5 working state —
never copied from earlier receipts.

| Preserved area | Method | Result |
|---|---|---|
| Canon §5.9 (R1.2's extension-bonus source law) | Bytes from the `### 5.9` heading to the `## 6.` heading hashed both sides | SHA-256 `53c968ade8cdb2177517412ac09f2bae63ee7642cfa3b24299d2b208895fb373` both sides — byte-identical (matches the R2.4 receipt) |
| Historical register rows §15.1–§15.8 | Bytes from `### 15.1` to `### 15.9` hashed both sides | SHA-256 `7b3f6aaba81129dceaa8e55f6356f8bbecd3af7e1ff59b127a443fc5d7b14d97` both sides — unchanged (matches the R2.4 receipt) |
| Historical scenarios 1–89 (§16) | Bytes from `## 16.` to `## 17.` hashed both sides | SHA-256 `eb11bb122840f881204be4d3de9b8a47a680a19622677e4287227730615b311f` both sides — unchanged (matches the R2.4 receipt) |
| Complete SC2/SXW2 block | Bytes from the `**SC2 — complete SXW2 integrity contract` block opening to the `**R8` heading hashed both sides; enumerated checks counted | SHA-256 `7a4f50c49f42dfe9ca399039ff2cabc1dd86dcbfc3490ce8ba2dd3b2d5f803cd` both sides; exactly **16** enumerated checks before and after |
| Transitive compatibility matrix and rules | §15.9.6 transitive block and matrix inspected | Untouched — the nine rules and seven-row matrix are byte-identical apart from nothing (no edit landed in that block) |
| Secondary-source policy and unsupported-candidate rules | §15.9.6 policy blocks inspected | Untouched |
| AMEND numbering contract | §15.9.2 contract and worked examples inspected | Untouched |
| Historical-population distinction | §15.9.1 population block inspected | Untouched; the published `9814939c` register remains the sole XW2 historical source |
| No active record or §15.10–§15.12 | Mechanical greps (§13) | Zero concrete records; no §15.10/§15.11/§15.12 section exists |

## 12. Targeted parser checks — deterministic results

Executed by a deterministic checker
(scratchpad `r25_checks.py`, Python 3) implementing exactly the pinned
grammars; **38 checks, 0 failures (exit 0)**. All rows illustrative;
no record minted.

Season grammar:

| Case | Expected | Result |
|---|---|---|
| `2026-27` | pass | **PASS** |
| `1999-00` | pass | **PASS** |
| `2026–27` (en dash) | fail | **PASS** (correctly fails) |
| `2026/27` | fail | **PASS** (correctly fails) |
| `FY26` | fail | **PASS** (correctly fails) |
| `26-27` | fail | **PASS** (correctly fails) |
| `2026-28` | fail | **PASS** (correctly fails) |
| `2026-2027` | fail | **PASS** (correctly fails) |
| `2026 -27` (space) | fail | **PASS** (correctly fails) |

Verification metadata:

| Case | Expected | Result |
|---|---|---|
| Complete valid tuple (`agent:claude-code`, `session:r2-5-20260715-01`, `2026-07-15`) | pass | **PASS** |
| Missing Verifier identity | fail | **PASS** (correctly fails) |
| Missing Verification session ID | fail | **PASS** (correctly fails) |
| Missing Verification date | fail | **PASS** (correctly fails) |
| `—` in any of the three fields (each tried) | fail | **PASS** (all three correctly fail) |
| `Claude` (missing tag), `agent:` (empty slug), `agent:Claude Code` (uppercase/space), `agent:claude/code` (illegal delimiter), slug over 64 chars | fail | **PASS** (all correctly fail) |
| `r3-20260715-01` (missing tag), `session:` (empty slug), `session:R3 01` (uppercase/space), slug over 96 chars | fail | **PASS** (all correctly fail) |
| `2026-02-30`, `2026-13-01` (invalid calendar dates), `2026/07/15` (wrong format) | fail | **PASS** (all correctly fail) |
| Nonempty Verifier identity concealing a missing session ID or date | fail | **PASS** (correctly fails — fields validated independently) |

Schema integrity:

| Case | Expected | Result |
|---|---|---|
| Canon base-table schema line has exactly 13 pinned fields | 13 | **PASS** (13) |
| Illustrative new-schema base row parses with 13 fields, valid tuple, valid season | pass | **PASS** |
| Illustrative old-composite 11-field base row | fail | **PASS** (fails the 13-field count; composite value fails the Verifier-identity grammar) |
| Per-type matrix carries the three verification rows as Required (never `—`) for all four provenance types | present | **PASS** (three matrix rows verified) |
| U8/U9, G14, and R9 refer to the same §15.9.6 grammars | present | **PASS** (grammar references verified in all four gate texts) |
| No binding `Verifier/session/date` composite remains | zero binding | **PASS** — the four remaining occurrences are the header/amendment-log/§15.9-intro descriptions of this correction and the §15.9.6 abolition rule itself (a prohibition, not a schema field) |

## 13. Mechanical validation outputs

Run at the R2.5 working state on baseline `e0344aac…`:

- **Files changed:** `git diff --name-only` =
  `docs/reference/cba/ARCHITECT_CBA_CANON.md`,
  `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md`;
  untracked additions = this receipt only. Exactly the three
  authorized files.
- **`git diff --check`:** clean (exit 0; no whitespace errors).
- **Section preservation:** the four hashes in §11 recomputed at the
  baseline and at the R2.5 working state — identical on both sides.
- **SC2 block:** exactly 16 enumerated checks counted mechanically
  before and after.
- **No concrete v2 record:** zero register-style rows matching
  `SRC2-/EV2-/XW2-/SXW2-/DR2-<digits>` or `CBA2-…` table rows exist in
  the canon or plan; no §15.10/§15.11/§15.12 section exists; the
  namespaces remain defined-only. The illustrative values in this
  receipt (`SRC2-XXX`, the sample tuples) are placeholders in prose,
  not register records.
- **No prior receipt changed:** the diff contains no
  `ARCHITECT_CBA_CANON_V2_R1*`/`R2_REGISTER`/`R2_1`/`R2_2`/`R2_3`/
  `R2_4` receipt.
- **Targeted parser checks:** 38/38 pass (exit 0; §12).
- `npm run lint:md`: **exit 1** — pre-existing findings only. The
  canon carries exactly **74** findings before and after R2.5, all
  `MD029/ol-prefix` in the accepted §16 continuous-numbering class;
  the normalized before/after markdownlint comparison (rule + detail,
  line-number-independent) is **identical** (74 = 74, zero new
  findings in the canon). `markdownlint` on the repair plan: clean
  (exit 0, before and after). `markdownlint` on this receipt: clean
  (exit 0; recorded after final write). The global exit code is
  reported truthfully as a failure caused by pre-existing findings in
  other files and the accepted §16 class — not claimed as a pass.
- `npm run docs:guardrails`: **pass** (exit 0).
- **`main` unchanged:** `69f8f6b6…` before and after; no commit
  touched it.
- No app tests run (documentation/standards change per repair-plan
  global rule 6).

## 14. Boundaries and blocked status

R2.5 closed the two ordered grammar blockers and the minimal
amendment/status surfaces recording them. It made **grammar and status
corrections only**:

- No concrete CBA2/XW2/SXW2/SRC2/EV2/DR2 record was created; the
  registries were not populated; no §15.10–§15.12 section was created.
- No historical register row, scenario, ID, or source value was
  edited; canon §5.9, §15.1–§15.8, scenarios 1–89, and the
  sixteen-check SC2 block are byte-identical to the R2.4 checkpoint.
- No earlier receipt was edited.
- The passing areas (transitive authority compatibility; the
  secondary-source/OPS policy; AMEND numbering; source/provenance
  terminology; R1.2 source law; SC2/SXW2 integrity; the
  historical-population separation; scope/preservation) were not
  reopened or redesigned.
- No application, README, code-map, test, schema, fixture,
  configuration, data, Phase 2, W1.1, R3+, or Linear work was
  performed.
- `main` unchanged (`69f8f6b6…` before and after); the accepted
  clean-v2 architecture was not redesigned.

**R2.5 is complete but not independently accepted. R3 remains blocked
pending another independent Codex foundation review.**
