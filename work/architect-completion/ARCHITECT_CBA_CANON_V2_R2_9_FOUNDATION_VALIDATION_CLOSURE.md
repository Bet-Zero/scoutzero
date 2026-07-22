# Architect CBA Canon v2.0 — R2.9 Foundation-Validation Closure

Bounded correction of every blocker identified by the independent Codex review
of R2.8. R2.9 is the maker step of the maker–checker process: this receipt does
**not** accept R2.9. R3.1 remains blocked until a fresh independent Codex review
returns ACCEPT.

## 1. Baseline and exact repository state

Verified before editing (read-only):

- HEAD, local topic, and tracking topic all at rejected R2.8
  `8f7aec7ae61c16f70e522e1897259da43777360f`.
- Direct parent (rejected R2.7) `3e9f913f285db578a9457ab2ce31744ca6e9c9ca`;
  rejected R2.6 `51e60bf606f5a4ea4547e7f4e163bdcac2863d26`; rejected R3
  `07f0667d8cc55a6b86bd4c3fabada5d9b6d7d956`; previously accepted pre-R3
  foundation `6d9c7576afa682a7d89519f02315321ed74e8509`.
- Branch `architect/cba-canon-v2`; upstream `origin/architect/cba-canon-v2`
  ahead 0, behind 0.
- Local, tracking, and live remote `main` all at stable
  `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`.
- Worktree, index, and untracked state clean; all earlier checkpoint identities
  matched; every protected active R3 record population and historical range
  present.

The Codex R2.8 rejection was independently reproduced before any edit: in a
throwaway sandbox the committed R2.8 validator exited `0` (accept) on a deleted
repair plan, on 25 removed XW2 rows (131 to 106, still above its `>= 100`
threshold), and on a duplicated `XW2-0007` ID — confirming the rejection is
correct and not taken on faith.

## 2. Full Codex R2.8 finding disposition

Every finding in the Codex R2.8 review is dispositioned. Nothing is deferred to
R3.1.

| Codex finding | Severity | Disposition in R2.9 |
|---|---|---|
| Validator accepts skipped/duplicate rows, nonexistent references, incomplete search, invalid acceptance, branched AMEND — 52/52 PASS untrustworthy | Critical | Validator replaced by one real parser + reconciliation engine; every listed false positive is a rejecting regression through the real document path (Section 5) |
| `RES` acceptance permits aliases and unrelated acceptance text; maker self-acceptance possible | Critical | Canonical-actor registry with alias normalization; acceptance split into typed fields bound to the exact current `RES` ID/version/content-digest/outcome/commit/receipt (§15.9.3/§15.9.6) |
| `BLK` lacks version/current fields; contradictory SXW2/search semantics; novel candidate not representable | Critical | `BLK` given `Finding version` + `Superseding/current`; typed subject/search fields; `candidate-obligation` subject class; SXW2 removed from BLK/SM2/SS2 (XW2-only search-machinery policy) |
| Mixed clause/sentence atom domains double-allocate text | Critical | Single-coordinate `span:<a>-<b>` text-span system; dual domain abolished; overlap/equality/coverage/contiguity mechanical (§15.9.3) |
| Conflicting all-fragment vs multi-target-only BND rules | High | One rule chosen — **multi-target-only** — plus an exact member-compatibility matrix, propagated to U7/G1/R9 (§15.9.3) |
| `DISP` schema lacks the values later required for exact equality | High | Explicit `Normalized scope` field added; "demonstrably identical" replaced by an exact terminal-base-equality rule (§15.9.4) |
| Source windows need not be ordered; composite fields remain | High | Effective-window endpoints required valid and strictly ordered; `Record status/version` and `Publication identity/date or season` split into typed fields (§15.9.6) |
| `SM2` fields and `SS2` coverage under-typed; maker-selected undercoverage | Critical | All `SM2` fields given exact grammars + current-record uniqueness key + `SM2` ⇔ current-`SRC2` binary reconciliation; `SS2` required classes made the deterministic set `CBA, BYL, NBA, ops-provenance` with a closed-grammar coverage assessment (§15.9.6) |
| U5–U9/G14/G15/G15R/SC2/R8/R9 do not close schema gaps | High | Every dependent gate conformed, including the SM2 ⇔ SRC2 gap in G14/U9 and the actor/coverage/BND propagation note (§15.9.9) |
| Backlog header and R4 sequence stale | Critical | Backlog header corrected to the truthful items 1–27; R4 dependency and construction sequence corrected; stale `accepted R2.7` removed (Section 8) |
| R2.8 receipt attributes `"Is there a newer CBA? No."` to NBPA | Medium | Superseded here by the bounded conclusion; the immutable R2.8 receipt is not edited (Section 9) |
| New R2.8 receipt reports 54 MD004 + 6 MD038 lint findings | Low | Those 60 findings live in the immutable R2.8 receipt (append-only policy — not edited); this R2.9 receipt is targeted-lint clean (Section 12) |

Mislabeled/masked cases Codex named are corrected in the new adversarial suite:

- **N5** (masked one accepted-invalid date behind a second rejection) becomes
  three single-condition cases: `R1` (two primaries), `R2` (invalid value for
  basis), `R3` (base pair not equal to its primary component) — each isolates
  one rejection cause.
- **N13** (did not test a nonexistent scenario) becomes `R10`, which rejects an
  invented `scenario-90` `SXW2-DISP` subject (outside `1..89`).
- **M4** (did not mutate scope or basis) becomes `R20`, which mutates the
  `No-owner reason` to one wrong for the edge type.
- **M9b** (treated an eight-character commit with no receipt as valid) becomes
  control `C1` (a full 40-hex commit **and** a receipt path) plus `R16`
  (abbreviated commit rejected).
- **M10** (did not enforce complete `G15R` membership) becomes `R19`, which
  rejects a dropped `SM2` population.

## 3. Exact schema repairs

All canon edits are confined to §15.9 plus the amendment log and live
status/sequencing surfaces; no active §15.10–§15.12 record row is touched.

- **Source dates (§15.9.6).** Base field `Record status/version` split into
  `Record status` + `Record version` (base table now fourteen fields);
  `official-mutable` detail `Publication identity/date or season` split into
  `Publication identity` + `Publication date or —` + `Season or —`;
  effective-window grammar requires both endpoints be real calendar dates with
  the end strictly later than the start; the date-component detail table given
  one all-explicit completeness rule (one row per relied-on semantic date
  including the base pair's own, one `primary` per basis, base pair equal to its
  basis's `primary`) replacing the competing "more than one date"/"every
  further date" standards.
- **Fragments and bundles (§15.9.3).** The dual `clause:`/`sent:` atom model
  replaced by one deterministic `span:<a>-<b>` text-span coordinate system over
  the LEAF's normalized Canonical requirement text, with a pinned normalization
  algorithm and mechanical overlap/equality/coverage/ordering/contiguity; the
  `BND-…` cardinality contradiction resolved to **multi-target-only** with an
  exact member-compatibility matrix (no `equivalent`/`moved` member, no
  duplicate mapping, no wrong-fragment/orphan member, no undispositioned
  residual); the per-LEAF exactly-once contract restated as three mutually
  exclusive shapes.
- **DISP and scenario fragments (§15.9.4/§15.9.8).** `DISP` detail schema given
  an explicit `Normalized scope` field so the equality tuple joins on real
  fields; "demonstrably identical" replaced by an exact terminal-base-equality
  rule; the scenario-fragment inventory tied to an exact partition of each
  governed scenario's normalized text (`span:<a>-<b>` over the pinned §16
  source), rejecting nonexistent scenarios, gaps, overlap, and orphan
  bundles/details; SC2 check 16 strengthened to enforce that partition
  mechanically (sixteen checks preserved).
- **SM2 and SS2 (§15.9.6).** Every `SM2-…` field given an exact grammar (closed
  `Search method` vocabulary, typed binary size/hash/pagination/signature,
  `provision:`/`locator:`/`query:` locator, URL-or-`provenance:` identity), a
  current-record uniqueness key, and an `SM2` ⇔ current-`SRC2` binary
  reconciliation; `SS2` required classes made the deterministic closed set
  `CBA, BYL, NBA, ops-provenance` (maker discretion abolished) with a
  closed-grammar `Coverage assessment` and a deterministic `Adequacy result`;
  SM2/SS2 made XW2-only.
- **BLK/RES and independent acceptance (§15.9.3/§15.9.6).** A canonical-actor
  registry normalizes aliases and case variants (`agent:claude` and
  `agent:claude-code` are one actor) and fails blank/unknown identities; the
  `RES-…` acceptance composite split into typed `Acceptance commit`/`Acceptance
  receipt`/`Accepted RES version`/`Accepted content digest`/`Accepted proposed
  outcome` bound to the exact current resolution; `BLK-…` given finding
  version/current fields, typed subject/search fields, and a
  `candidate-obligation` subject class; the SXW2-blocker contradiction resolved
  to an XW2-only policy.

## 4. Exact validator architecture and parsed populations

The rejected R2.8 validator (signature searches, `>= 100` thresholds, hard-coded
vocabulary filters, and disconnected dictionary fixtures) is replaced by one
real parsing and reconciliation path in
`work/architect-completion/cba_canon_v2_foundation_validator.py`.

- Reads **both** governing documents from the repository — the actual canon and
  the actual repair plan. A missing repair plan is a rejection, not a silent
  pass.
- Parses the canon's binding **schema definitions** (the pipe-delimited schema
  strings) and derives closed vocabularies from the canon's own vocabulary
  declarations, rather than recognizing expected sentences through a hidden
  allow-list.
- Parses the complete actual committed populations at **exact membership**:
  `groups=12`, `leaves_main=81`, `leaves_detail=81` (joinable on ID),
  `xw2=131` (contiguous `XW2-0001..0131`, unique), `src2_base=4`,
  `src2_imm=2`, `src2_mut=2` (base/detail reconciled), `ev2=89`; XW2 edge
  types, terminal/target discipline, source/target/decision references, and
  EV2 → SRC2/LEAF references all resolved.
- Recognizes the committed R3 population as **rejected/legacy** (the abolished
  `Publication/effective date` base field, the composite `Record status/version`
  field, and the committed `OWN`/`ATOM` terminal decisions `DR2-0037/0038/0039`)
  and refuses to certify a changed population as conforming without migration —
  without excusing malformed structure.
- Parses and enforces the repair plan's backlog completeness (items 1–27), R4
  dependency, construction sequence, and item-25 coverage rule.
- Validates a future migrated **R3.1 population** through the **same** parser
  and engine: the simulated migrated population is canon-format table text
  (clearly labelled, non-record) covering migrated `SRC2` base + date
  components, a fragment-inventory partition, `SM2`/`SS2`, a `DISP` detail row,
  `BLK`/`RES`, and an `AMEND` record — parsed by the identical helpers, never a
  dictionary fixture.
- Standard library only (`hashlib`, `os`, `re`, `sys`); no network, no new
  dependency; deterministic; exit status nonzero on any unexpected acceptance
  or rejection.

## 5. Every inherited and new adversarial result

The suite runs **45 cases** through the single `validate_foundation()` entry
point on real document text — 3 valid controls (must accept) and 42 rejecting
regressions (must reject). Baseline validation is clean; all 45 cases pass;
0 total failures. Each Codex-demonstrated false positive is an independent
rejecting regression:

- Removed/duplicate/malformed/skipped XW2 rows and nonexistent
  source/target/decision references — `X1`–`X5`.
- Duplicate `GROUP`/`SRC2`/`LEAF`/`EV2` IDs and nonexistent EV2 → SRC2
  reference — `D1`–`D5`.
- Removal of the repair plan; reverted backlog header; reverted R4
  dependency — `P0`–`P2`.
- Reverted schema splits, removed window ordering, restored dual scope domain,
  removed `DISP` `Normalized scope`, restored maker-selected SS2 classes —
  `S1`–`S5`.
- Committed population stripped of all legacy markers (falsely appears
  conforming) — `L1`.
- Invalid/conflicting source-date components and base-pair mismatch — `R1`–`R3`.
- Fragment-partition gap — `R4`.
- SM2 ⇔ SRC2 hash mismatch, out-of-vocabulary search method — `R5`, `R6`.
- SS2 missing a required class, inconclusive member, empty member set — `R7`,
  `R8`, `R21`.
- Unsupported-residual `DISP` without SM2/SS2 support; invented `scenario-90`
  subject; wrong no-owner reason — `R9`, `R10`, `R20`.
- Maker self-acceptance, alias masquerade, blank checker, stale accepted
  version, unrelated content digest, abbreviated acceptance commit — `R11`–`R16`.
- SXW2 blocker, two current AMEND endpoints, G15R population omission,
  duplicate/orphan `DISP` — `R17`, `R18`, `R19`, `R22`, `R23`.

A negative self-test confirms the harness is not rigged to pass: injecting a
wrong expectation on the baseline case produces a FAIL and exit status `1`.

## 6. Valid-control results

Three accepting controls prove the validator discriminates rather than rejecting
everything: `C0` (real canon + real plan, legacy recognized) accepts; `C1` (the
well-formed simulated migrated R3.1 population) accepts — reaching the conforming
validation path rather than failing solely because legacy markers were removed;
`C2` (a benign plan edit) accepts. Two accepting controls plus 42 rejecting
regressions demonstrate real discrimination.

## 7. Dependent-gate reconciliation

The corrected contracts are traced through and enforced at every gate:

- **U5–U9** carry the candidate-population, tiebreak, fragment, source-date,
  SM2/SS2, and evidence contracts as corrected; U9 adds the SM2 ⇔ current-SRC2
  reconciliation and the deterministic SS2 coverage.
- **G1** applies the multi-target-only BND rule and member matrix to global
  fragment reconciliation.
- **G3** verifies deterministic SS2 required-class coverage, the SM2 ⇔ SRC2
  reconciliation, and canonical-actor-bound acceptance behind every blocked
  finding.
- **G10** reruns the complete SC2 contract including check 16's scenario-
  fragment partition reconciliation.
- **G14** adds the SM2 ⇔ current-SRC2 reconciliation (the gap Codex named).
- **G15 / `G15R`** bind `BLK-…`/`RES-…` acceptance to the canonical-actor
  registry and the exact current resolution.
- **SC2** keeps exactly sixteen checks with check 16 strengthened.
- **R8 / R9** independently re-run all of the above; R9's acceptance-review
  language is conformed to distinct canonical actors and bound acceptance.

## 8. Live-status and backlog corrections

- The repair plan's backlog header "the complete Codex A-series findings — items
  1–15 — plus … items 16–21; nothing else" is corrected to state the truthful
  complete R3.1 backlog **items 1–27** (the earlier wording excluded the
  items 22–27 that immediately follow it).
- The R4 dependency's stale "independently accepted R2.7 foundation" (R2.7 was
  rejected) is corrected to the accepted R2.9 foundation; the construction
  sequence is corrected to `R3 → R2.6 → R2.7 → R2.8 → R2.9 → R3.1 → R4 → R5 →
  R6`.
- Repair-plan item 25 is corrected so inadequate or inconclusive coverage
  neither supports an `unsupported-residual` disposition nor, by itself, creates
  or clears a `blocked-unsupported-obligation` finding (a `BLK-…` finding itself
  requires a complete adequate not-located search; the A18.7 residual has a
  supported sibling and is never a whole-obligation `BLK-…`).
- Every status/sequencing surface in the canon (the "What v2.0 changes" intro,
  §15.9.2, the §15.10 intro, §19.3) and the plan (top status block, R2.7/R2.8
  sections, R3.1 blocker) is updated to the truthful sequence including rejected
  R2.8 and pending R2.9; incomplete namespace summaries are completed
  (`SXW2`/`SS2`/`BND`/`BLK`/`RES`/scenario-fragment/`<Record ID>#D<k>` added).

## 9. Source-attribution correction

Only the supported bounded conclusion is used going forward:

> No later governing agreement text was located in the searched first-party
> sources.

The R2.8 receipt's quoted result `"Is there a newer CBA? No."`, presented as
text from the NBPA page, is an overstatement (that phrasing is the maker's
inference, not text on the page). Under the canon's append-only historical-
receipt policy the immutable R2.8 receipt is **not edited**; this R2.9 receipt
explicitly **supersedes** that attribution with the bounded conclusion above,
and every live statement in the canon and plan already uses the bounded form.

The independently verified signed-CBA facts are preserved unchanged:

- 2,850,534 bytes; 676 PDF pages.
- SHA-256 `bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32`.
- Agreement entered into as of June 28, 2023 (Article I §1(d)).
- Effective July 1, 2023 through June 30, 2030, subject to the agreement's
  provisions (Article XXXIX §1).

## 10. Preservation hashes

Protected ranges, hashed on the post-R2.9 canon, reproduce the independent
Codex R2.8 values exactly (extraction: section-header byte slice for prose;
pipe-table lines joined with newlines plus a trailing newline for record
tables):

| Protected range | SHA-256 | Matches Codex R2.8 |
|---|---|---|
| §5.9 | `53c968ade8cdb2177517412ac09f2bae63ee7642cfa3b24299d2b208895fb373` | yes |
| Historical §15.1–§15.8 | `7b3f6aaba81129dceaa8e55f6356f8bbecd3af7e1ff59b127a443fc5d7b14d97` | yes |
| Scenarios 1–89 (§16) | `eb11bb122840f881204be4d3de9b8a47a680a19622677e4287227730615b311f` | yes |
| §15.10–§15.12 (424 table lines) | `dfcfe209c5629f8f86f1014a7ee42f42012655714c9b28fab048951bb61b1bbd` | yes |
| 12 GROUP rows | `8bf75f27d3765ba33c6704bb4bf2e156348a0035af46ddcce3907e8c28a456b2` | yes |
| 131 XW2 rows | `d1053f5e2103c18715a8dd5bf7add5973d1ce7488f87f99ecab01a6dc3e530b0` | yes |
| 89 EV2 rows | `822641f5482414370c149157eade368890be0bbe61e00037637a7c3963313555` | yes |

Additionally, an anchor-based extraction of all 402 concrete active record rows
in §15.10–§15.12 hashes identically before and after R2.9
(`cb59340bb0e21d8f11e2c6b781c8b127c15b8779fcbb0b59ae533b06af15509e`), and all
eighteen prior receipts (v1.1 through R2.8) are byte-identical to the R2.8
baseline. SC2 is exactly sixteen checks before and after; only check 16 changed.

## 11. Changed-file and boundary proof

Exactly the expected file set changed:

- Modified: `docs/reference/cba/ARCHITECT_CBA_CANON.md` (+564 / −220).
- Modified: `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md`
  (+127 / −31).
- Modified: `work/architect-completion/cba_canon_v2_foundation_validator.py`
  (+1153 / −1080).
- Created: `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_9_FOUNDATION_VALIDATION_CLOSURE.md`.

R2.9 did **not**: modify any active R3 `GROUP`/`LEAF`/`XW2`/`SXW2`/`SRC2`/`EV2`/
`DR2` record; perform the R3.1 migration; mint any concrete active fragment,
`DISP`, `BND`, `SM2`, `SS2`, `BLK`, or `RES` record; renumber, reuse, reassign,
or overwrite any identifier; modify §5.9, historical §15.1–§15.8, or scenarios
1–89; begin R4–R9, Phase 2, W1.1, or application work; modify application code,
tests, schemas, fixtures, configuration, runtime data, README, or code map;
read or write Linear; or touch `main`, merge, open a PR, amend, squash, or
force-push. Illustrative schema rows in the canon and the validator's simulated
population are explicitly labelled non-record examples. No live remote ref was
mutated during review beyond the eventual normal push of this topic branch.

## 12. Exact commands and deterministic output hashes

- `python3 work/architect-completion/cba_canon_v2_foundation_validator.py` —
  exit `0`; 3 valid controls + 42 rejecting regressions = 45 cases;
  `baseline_clean=yes`; 0 total failures.
- Two bytecode-disabled runs produced byte-identical output, SHA-256
  `08028c94b761229b78a1e83f44b98813812423b7170e017ce778bae210209d6d`.
- Validator file SHA-256
  `efd811c2cd77afe53fc7f271d2c3ba1e2e5cebd957ccf75a25d0c80947c07075`;
  `python3 -m py_compile` clean; imports limited to `hashlib`, `os`, `re`,
  `sys`.
- `git diff --check` — clean.
- `npm run lint:md` — 127 established findings, unchanged by R2.9 (74 in the
  byte-preserved §16 scenario block of the canon; 53 in unrelated unchanged
  files); `lint:md` globs `docs/**` and root only.
- Targeted `npx markdownlint` on each changed/created Markdown file: the repair
  plan and this R2.9 receipt report **0** findings; the immutable R2.8 receipt
  retains its 60 pre-existing findings (54 MD004 + 6 MD038), untouched under the
  append-only historical-receipt policy.
- `npm run docs:guardrails` — "Workspace guardrails passed."

## 13. Remaining limitations

- The validator's migrated-R3.1 population is a labelled simulation proving the
  parser and engine are reusable for R3.1; it mints no record. The actual R3.1
  migration (items 1–27) remains R3.1 work.
- Live remote `main` and the topic branch were compared read-only during review;
  no fetch or ref mutation occurred beyond the normal topic-branch push.
- Semantic properties (atomicity, ownership truth, exhaustiveness of a real
  fragment inventory) remain semantic review gates at R8/R9; the validator
  enforces the mechanical contracts, never a semantic claim.

## 14. R3.1 and R4 not started

R3.1 and R4 were **not** started. No A-series record is accepted. Phase 1
remains open; Phase 2, W1.1, application work, R3.1, and R4 remain blocked. This
receipt does not accept R2.9: R3.1 remains blocked until a fresh independent
Codex review of R2.9 returns ACCEPT.
