# Architect CBA Canon v2 — R2.12 Balanced-Foundation Closure

## Status

Maker-only correction complete and checkpoint prepared on branch
`architect/cba-canon-v2`, based on
`86e64f33a0f71ff56a678ce9d3a3adc7d978fc66`, pending independent review.

The independent review of R2.11 returned **REJECT/BLOCK-R3.1**. R2.11
is immutable rejected history. This R2.12 receipt is a maker claim only:
it does not accept the foundation, accept R3, certify any A-series
record, start R3.1, unblock R4, close Phase 1, or authorize Phase 2.
R3.1 remains blocked pending an independent R2.12 checker ACCEPT.

## Exact scope

R2.12 is limited to three modified files and this new receipt:

- `docs/reference/cba/ARCHITECT_CBA_CANON.md`
- `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md`
- `work/architect-completion/cba_canon_v2_foundation_validator.py`
- `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_12_BALANCED_FOUNDATION_CLOSURE.md`

No prior receipt is edited. No concrete governed record is minted,
renumbered, reused, or removed.

## Independent R2.11 finding closure

| R2.11 blocker | R2.12 binding correction | Acceptance owner |
|---|---|---|
| The accepted checkpoint predated the exact proposed RES row | `Proposal receipt path` is an explicit RES field. The maker checkpoint must contain exactly one matching proposed/unaccepted row at that path. The checker receipt must be committed later at a descendant commit, and every binding field must match. Missing, wrong-path, duplicate, already-accepted, or mismatched proposal evidence rejects. | Validator proves recorded blob/path/row/ancestry facts; checker judges actual authorship, real-world chronology, and independence. |
| Required SRC2/EV2 fields were not all enforced | Every SRC2 base and type-detail field, `—` rule, identity/URL/hash/size/retrieval/verifier/session/date grammar, and every EV2 locator/passage/mapping/reference field is mechanically checked. | Validator checks declared structure; checker judges whether the source and passage really support the proposition. |
| GROUP child counts and LEAF Origin/dependency references were not reconciled | Declared child range/count must equal the actual active children. Every typed Origin and dependency must parse, resolve, and reconcile with the corresponding active edge or LEAF. | Validator checks joins; checker judges substantive ownership and dependency completeness. |
| Version jumps could bypass AMEND | Every version above `1` in fragment, scenario-fragment, BND, SM2, and SS2 requires a same-identity `revise` AMEND detail from the immediately prior version; the exact governed population at the pinned prior checkpoint must contain that identity at the claimed prior version. Replacement/split/merge identities begin at version `1`. | Validator checks structured and checkpoint-backed lineage; checker judges whether content preservation and reasons are adequate. |
| BND required XW2 IDs for both variants and an impossible edge backlink | `XW2-BND` members are XW2 IDs; `SXW2-BND` members are SXW2 IDs. Reconciliation uses representable fragment→bundle, bundle→edge, and edge→fragment/positional-scope joins. The nonexistent per-edge bundle backlink is retired. | Validator checks position-aligned joins and span union; checker judges semantic fitness. |
| OPS/EXT and SXW2 lacked real governed locations | Empty OPS and EXT detail subsections now exist in §15.12.4–§15.12.5, EV2 is governed at §15.12.6, and the future SXW2 population is governed at §16.v2.2. Honest pre-trigger absence remains valid. | Validator checks exact membership and rejects rows outside those ranges. |
| R8/R9 crossed the Phase 1 boundary | R8 is canon/register reconciliation only. R9 is a read-only document/source review whose only authorized write is its named report artifact. Neither unit includes README, code-map, runtime, application, Phase 2 packet, or Phase 2 verdict work. R9 ACCEPT plus explicit owner acceptance is required to unblock Phase 2. | Process gate plus independent reviewer and owner. |

## Balanced certification boundary

Canon §15.9.12 controls any broader earlier claim.

- Software enforces deterministic document facts: IDs, schemas/headers,
  vocabularies, fields and grammars, typed joins, Git blob/path/ancestry
  evidence, rooted acyclic evidence structure, direct-current
  references, declared span partitions, structured AMEND lineage, and
  protected-range/identity preservation.
- The independent checker judges NBA/CBA truth, actual source support,
  semantic atomicity/ownership/coverage, evidence adequacy,
  substantive completeness, actual maker/checker separation, and any
  chronology not established by the recorded Git graph.
- Software does not prove real-world identity, intellectual
  independence, legal persuasiveness, semantic perfection, universal
  completeness, source truth from locator wording, or the nonexistence
  of authority outside recorded searches.

## Executable controls

The same top-level document loader validates both the repository
baseline and the complete future migrated-document fixture. The bounded
default suite includes positive controls and focused rejecting
mutations for:

- proposal absence, wrong path, duplicate row, already-accepted row,
  content mismatch, non-descendant receipt, and acceptance backlink;
- every newly closed SRC2/EV2 field and grammar class;
- GROUP declared child range/count and dangling/mismatched
  Origin/dependency references;
- fragment, scenario-fragment, BND, SM2, and SS2 version jumps without
  the required structured AMEND detail, a valid checkpoint-backed version
  `1` → `2` revise, and a fabricated version `8` → `9` revise whose pinned
  checkpoint really contains version `1`;
- XW2-BND/SXW2-BND member grammar and positional reconciliation;
- governed OPS/EXT/EV2/SXW2 population placement.

The default controls are the foundation gate and must complete in under
four minutes. An optional extended diagnostic suite is not an
acceptance prerequisite, and a fixed case count is not certification
evidence.

## Preservation

- §5.9 remains 6,198 bytes with SHA-256
  `53c968ade8cdb2177517412ac09f2bae63ee7642cfa3b24299d2b208895fb373`.
- Historical §15.1–§15.8 remains 90,455 bytes with SHA-256
  `7b3f6aaba81129dceaa8e55f6356f8bbecd3af7e1ff59b127a443fc5d7b14d97`.
- Historical scenarios 1–89 remain 24,119 bytes with SHA-256
  `eb11bb122840f881204be4d3de9b8a47a680a19622677e4287227730615b311f`.
- The exact sixteen-check SC2 list, every active §15.10–§15.12 table
  row, every committed record identity, and every prior receipt remain
  unchanged.
- The new OPS/EXT and §16.v2 headings are empty governed locations, not
  concrete records or scenario content.

## Explicit exclusions

No R3.1 repair or active-row edit; no C/R/L/S registration; no active
scenario construction; no README, code-map, application, runtime,
application test/schema/fixture/configuration, data, Linear, Phase 2,
or W1.1 work.

## Validation record

Maker validation on 2026-07-23:

| Check | Result |
|---|---|
| `PYTHONDONTWRITEBYTECODE=1 python3 work/architect-completion/cba_canon_v2_foundation_validator.py` run twice | **PASS twice** — 6 accepting controls plus 59 rejecting regressions, 65/65 cases, `baseline_clean=yes`, zero failures, and the negative self-test produced `FAIL` as required. Timed runs completed in 70.25 and 70.88 seconds, below the four-minute limit. |
| Byte comparison of the two complete validator outputs | **PASS** — both 10,054-byte outputs are identical, SHA-256 `839b5254294001bd8aa8031d29b88bf842546800543cfe0ee9366546b70393d1`. |
| `PYTHONDONTWRITEBYTECODE=1 python3 -m py_compile work/architect-completion/cba_canon_v2_foundation_validator.py` | **PASS**. |
| `git diff --check` | **PASS**. |
| Targeted `markdownlint` on the repair plan and this receipt | **PASS**. |
| Targeted `markdownlint` on the canon | The only findings are the same 74 pre-existing `MD029` findings in the protected numbered scenarios 16–89; the committed `HEAD` canon reproduces the same 74 findings. No protected scenario text was edited. |
| `npm run docs:guardrails` | **PASS** — workspace guardrails passed. |
| Immutable range extraction | **PASS** — §5.9 is 6,198 bytes at `53c968…fb373`; §15.1–§15.8 is 90,455 bytes at `7b3f6a…14d97`; scenarios 1–89 are 24,119 bytes at `eb11bb…b311f`. |
| Active-row and SC2 comparison to `HEAD` | **PASS** — the 118,104-byte §15.10–§15.12 table-row extraction is byte-identical at `dfcfe2…b1bbd`; the 3,314-byte sixteen-check SC2 extraction is byte-identical at `8bf229…5eea`. |
| Prior-receipt and scope check | **PASS** — no prior receipt is modified; the worktree scope is exactly the three modified files and this new receipt named above. |

These are maker-side mechanical results only. They do not constitute
independent R2.12 acceptance.

## Next required event

After the maker checkpoint is pinned, an independent checker who did not
author R2.12 must inspect that exact checkpoint, rerun the bounded
controls, review every checker-owned judgment, and issue ACCEPT or
REJECT. The only successful sequence is:

`R2.11 rejected → R2.12 maker checkpoint → independent R2.12 checker
ACCEPT → R3.1 maker checkpoint → independent R3.1 checker ACCEPT → R4`.
