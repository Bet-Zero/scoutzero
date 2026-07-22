# Architect CBA canon v2.0 — R2.10 foundation-validation repair

**Status: maker result, pending independent Codex review. R2.10 is NOT
accepted.** Completing R2.10 accepts nothing: R3 remains rejected, no A-series
record is accepted, R3.1 remains blocked, R4 remains blocked, Phase 1 remains
open, and Phase 2, W1.1, and all application work remain blocked.

R2.10 was ordered by the independent Codex review of the R2.9 checkpoint
(`5f868f2a67bf7ea6b0c1ae4c294c4067ea521d10`), which returned
**REJECT/BLOCK-R3.1**. This receipt records the bounded correction of every
blocker in that review.

## 1. Baseline and exact repository state

| Check | Value |
|---|---|
| Repository | `Bet-Zero/scoutzero` |
| Branch | `architect/cba-canon-v2` |
| Baseline (rejected R2.9) | `5f868f2a67bf7ea6b0c1ae4c294c4067ea521d10` |
| Baseline upstream | same |
| Baseline live remote (`git ls-remote`) | same |
| Baseline topic divergence | `0/0` |
| `main` / `origin/main` at start | `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288` (both) |
| Initial worktree / index / untracked | clean |
| R2.9 → R2.10 commit count | exactly `1` |

Verified checkpoint lineage, oldest first:

`6d9c7576` (R2.5, accepted pre-R3 foundation) → `07f0667d` (R3, rejected) →
`51e60bf6` (R2.6, rejected) → `3e9f913f` (R2.7, rejected) → `8f7aec7a`
(R2.8, rejected) → `5f868f2a` (R2.9, rejected) → **R2.10 (this checkpoint)**.

Every protected population and historical range was confirmed present at the
baseline before any edit (§14 below records the recomputed hashes).

## 2. Complete Codex R2.9 finding disposition

| Codex R2.9 finding | Severity | R2.10 correction | Where |
|---|---|---|---|
| Actual DR2 population unparsed; a shaped nonexistent `DR2-9999` passes | Critical | The complete 47-row `DR2-…` population is parsed from its pinned source (the R3 receipt) through Inventory G, with exact identity, uniqueness, contiguity, governed type, resulting-LEAF resolution, and bidirectional resolution of every register decision reference. Cases `X6`, `R1`–`R6`, `G11`. | validator §14; canon Inventory E/G |
| Separate simulation-only R3.1 fixture path | Critical | `SIM_R31`, `r31_block`, and `validate_r31_population()` are **deleted**. There is one `Tree` loader and one `validate_tree()` entry point. The future-R3.1 control is a **complete migrated document tree** written as real canon/plan/receipt files into a temporary Git control repository. Case `C2`. | validator §§3, 22–24 |
| Hardcoded current counts (`EXPECT`) | Critical | `EXPECT` is **deleted**. Preservation resolves committed identities against the pinned R3 checkpoint **commit**; conformance carries no totals. Valid future additions pass (`C3`, `C5`); count-preserving substitutions, renames, shifts, and duplicates fail (`X3`, `X4`, `D5`, `D6`, `D7`, `R4`). | validator §20; canon §15.9.11 |
| Hidden vocabularies / actor rules / private source hash-size tables | Critical | Canon §15.9.11 adds the binding **governed inventory** (Inventories A–G). The validator parses it as the sole source of truth and reconciles it bidirectionally with each governing clause. It now contains **no** vocabulary allow-set, schema field list, actor family table, or source hash/size table of its own. `canonical_actor()` uses only the parsed alias table. Cases `V1`–`V6`, `A5`, `A7`, `A8`. | canon §15.9.11; validator §§4–5 |
| RES evidence is not real evidence | Critical | The governed **acceptance-receipt record** is added. Acceptance now requires: the commit to resolve, the receipt path to exist **at that commit**, the blob to parse, and a matching `## Independent acceptance record` `ACCEPT` row. Digest is recomputed from current content and compared against the receipt's immutable digest. Cases `A1`–`A3`, `A9`–`A11`. | canon §15.9.3; validator §18 |
| `G15R` incomplete (nine declared, four executed) | Critical | `G15R` becomes an **enumerated twelve-population gate**, reported individually by name. Individually removing any required population fails for that population: `G1`–`G11`. | canon §15.9.9; validator §21 |
| Candidate evidence unrepresentable | Critical | `SM2-…`/`SS2-…` gain the **`candidate-obligation` subject variant** with `Subject candidate anchor`. The R3.1 control's `BLK`/`RES` route uses it end to end (`C2`); `E7` rejects a mis-shaped variant. | canon §15.9.6 |
| SM2 ⇔ SRC2 byte-size equality impossible | Critical | `SRC2-base` gains **`Artifact byte size`**, governed together with `Artifact SHA-256`. The equality is enforced against that governed field. Cases `E1`, `E2`, `V3`. | canon §15.9.6 |
| DISP / BND contracts incomplete | Critical | Terminal-base equality now includes the subject fragment and the disposition's destination fields; the edge ⇔ detail agreement tuple cites only fields both structures carry. `BND-…` gains **`Member subject scopes`** with exact partition-of-fragment enforcement. Cases `S1`, `S5`, `S6`, `S9`, `B1`–`B7`. | canon §§15.9.3–15.9.4 |
| SS2 inadequacy route remains | Critical | SS2 gains current-uniqueness, bidirectional membership, computed coverage/adequacy, and use-site adequacy binding. Cases `E8`–`E13`, `A16`. | canon §15.9.6; validator §17 |
| Regression obligations disappeared | High | A complete 52-case semantic crosswalk is published in §3 below; every prior obligation maps to at least one R2.10 case. 141 cases total. | §3 |
| Live plan contradiction (item 23) | High | Item 23 now orders the sole `span:<a>-<b>` grammar and the BND member sub-scope duty; the abolished clause/sentence wording is gone and its return is a rejecting case (`P6`). Item 24 explicitly carries the SM2 ⇔ current-`SRC2` duty (`P7`). | repair plan |
| Receipt said "Two accepting controls" after listing three | Low | Corrected append-only in §13 below. | §13 |
| 402-row hash method misstated | Low | Both extraction methods and both matching hashes are published in §14 below. | §14 |
| Source attribution (closed) | — | Preserved unchanged. | §12 |

## 3. Full 52-case semantic crosswalk (R2.8 → R2.10)

Every R2.8 obligation and its enforcing R2.10 case or cases. No prior
obligation is dropped; where a prior case was split, every successor is listed.

| R2.8 case | Obligation | R2.10 disposition | R2.10 case(s) |
|---|---|---|---|
| 1 | silently omitted residual | split | `F1` (partition gap), `B2` (bundle residual) |
| 2 | exhaustive supported+unsupported decomposition (accept) | retained | `C2` |
| 3 | overlapping fragments | retained | `F8` |
| 4 | orphan fragment | retained | `F5` |
| 5 | edge references unknown fragment | split | `F6` (LEAF), `S10` (scenario) |
| 6 | fragment both terminal and actively owned | retained | `F9` |
| 7 | two terminal fragments, distinct IDs (accept) | retained | `C2` (10 terminal fragments on distinct keys accept); `F10` rejects two terminal edges on one fragment |
| 8 | two terminal decisions for one fragment | retained | `S3` |
| 9 | terminal edge references OWN | retained | `L2` (migration state), `C2` inverse |
| 10 | terminal edge references superseded DISP | retained | `N5` |
| 11 | DISP detail mismatch (fragment) | retained | `S1` |
| 12 | orphan current DISP | retained | `S11` |
| 13 | wholly unsupported obligation blocked | retained | `U1` |
| 14 | kind separation (accept) | split | `C2` (accept), `F7` (mismatch rejects) |
| 15 | `edition:2024-06` with limitation (accept) | retained | `C2` (`SRC2-002`) |
| 16 | edition month as publication/effective | retained | `T11` |
| 17 | `effective:2023-07-01` (accept) | retained | `C2` |
| 18 | exact date degraded to month | retained | `T9` |
| 19 | metadata-derived day | retained | `T10` |
| 20 | missing/unknown basis or half-empty pair | split | `T5` (unknown basis), `T13` (half-empty pair) |
| 21 | adequate SM2 record (accept) | retained | `C2` |
| 22 | vague SM2 source identity | retained | `E5` |
| 23 | universal-negative result | retained | `E14` |
| 24 | SC2 check 11: terminal SXW2 edge to OWN | split | `S6` (subject-family), `L2` (non-DISP terminal decision) |
| 25 | valid AMEND supersession (accept) | retained | `C2` |
| 26 | stale reference after AMEND | retained | `N5` |
| N1 | noncontiguous fragment IDs | retained | `F3` |
| N2 | unknown edge type (in bundle) | split | `X7` (register), `B7` (bundle member) |
| N3 | duplicate/incompatible disposition bundle | split | `B4`, `B5`, `B6` |
| N4 | conflicting edition/date representation | retained | `T8` |
| N5 | missing required immutable-source semantic date | **repaired** | `T1`, `G2` |
| N6 | reversed/impossible effective window | retained | `T7` |
| N7 | malformed date component | split | `T2` (id gap), `T4` (role), `T3` (orphan) |
| N8 | incomplete SM2 record | split | `E4` (method), `E5` (identity), `E14` (result), plus the pinned-arity row check |
| N9 | inconclusive search supporting unsupported-residual | retained | `E10` |
| N10 | inadequate source-class coverage | split | `E8` (required set), `E9` (coverage), `A16` (use site) |
| N11 | whole unsupported escaping as no-successor | **repaired** | `U1` (the blocking-outcome rule is now mechanical for `unsupported-residual` with no supported sibling); the `no-successor` narrow rule remains a recorded semantic duty (G3/R9) — see §16 limitations |
| N12 | whole unsupported escaping as process-only | **repaired** | `F7` (kind ⇔ edge-type pairing), `U1` |
| N13 | invented/invalid scenario-DISP subject | **repaired** | `S7` (scenario outside 1–89), `S8` (impossible coordinate), `S10` (unregistered fragment) |
| N14 | orphan generic DISP parent | retained | `S12` |
| N15 | AMEND ID overwrite/reuse | split | `N3` (broken forward reference), `N4` (non-AMEND record), `N2` (two current endpoints) |
| M1 | valid `XW2-DISP` variant (accept) | retained | `C2` |
| M2 | valid `SXW2-DISP` variant (accept) | retained | `C2` |
| M3 | subject-family mismatch | retained | `S6` |
| M4 | wrong no-owner reason for edge type | **repaired** | `S4`; normalized-scope mismatch now also rejects (`S5`) |
| M5 | multiple same-basis dates, distinct roles (accept) | retained | `C4` |
| M6 | conflicting duplicate date components | retained | `T6` |
| M7 | bundle active/terminal mixing | retained | `B7` |
| M8 | maker self-acceptance | retained | `A4` |
| M9 | finding resolved without accepted resolution | retained | `A13` |
| M9b | valid independent acceptance (accept) | **repaired** | `C2` — a genuinely resolvable commit in the temporary Git control repository plus a parsed `ACCEPT` receipt row; the fake SHA and nonexistent path are now `A1`/`A2` |
| M10 | `G15R` live reference to a superseded record | **repaired** | `N5` plus the individual population-omission suite `G1`–`G11` |

Every state Codex listed as **accepted-invalid** is a rejecting regression
above. Every state Codex listed as **false-rejected** (a genuine valid SXW2
population; valid future additions above the high-water marks) is an accepting
control (`C2`, `C3`, `C5`).

## 4. Exact governing schema repairs

| Repair | Location | Effect |
|---|---|---|
| **Governed inventory** — Inventory A (closed vocabularies), B (pinned schemas), C (cross-schema dependencies), D (immutable ranges), E (pinned commits), F (canon-side population sections), G (receipt-side population headings), plus the binding use rules and the exact reconciliation procedure | canon §15.9.11 (new) | A conforming validator parses it as the sole source of truth; hard-coding any of it is prohibited. Divergence in either direction is a canon defect. |
| **Preservation versus conformance** distinction | canon §15.9.11 | Identity preservation is checked against the pinned R3 checkpoint commit, never a total; conformance carries no fixed totals. |
| `SRC2-base` gains **`Artifact byte size`** (14 → 15 fields), governed together with `Artifact SHA-256`; per-type matrix row and hash/size rule added | canon §15.9.6 | Makes the SM2 ⇔ current-`SRC2` byte-size equality representable at all. |
| Date-component detail gains **`Component status` / `Component version` / superseding relationship** (7 → 10 fields) | canon §15.9.6 | Makes exactly-one-current endpoints, supersession chains, and stale-reference rules expressible. |
| `BND-…` gains **`Member subject scopes`** (11 → 12 fields) with inside/non-overlap/exact-union rules | canon §15.9.3 | Makes combined exhaustive member coverage mechanically provable. |
| `DISP` **terminal-base equality** corrected to a five-part rule including the complete subject (LEAF/scenario **and** fragment) and the destination fields (`Preserved candidate anchor`, `Limitations`, `Reopening condition`) | canon §15.9.4 | Differing fragments or destinations can never be equal bases; the rule and the §15.9.4 `DR2-0039` worked example now agree. |
| `DISP` **edge ⇔ detail agreement tuple** corrected to cite only fields both structures carry; `Status`/`Version` restated as detail-row fields under the direct-current-reference rule | canon §15.9.4 | Removes a join ordered against nonexistent edge columns. |
| `SM2-…` gains the **`candidate-obligation` subject variant** and `Subject candidate anchor` (25 → 27 fields); subject-polymorphic uniqueness key; orphan rule | canon §15.9.6 | Candidate-obligation evidence is representable without a historical LEAF the candidate expressly lacks. |
| `SS2-…` gains the same subject variant (10 → 11 fields), **current-record uniqueness**, and **bidirectional membership** | canon §15.9.6 | An inadequate or partially-membered set can no longer support a governed outcome. |
| **Governed acceptance-receipt record** (7 fields) under the pinned `## Independent acceptance record` heading; independent-acceptance gate rewritten to require resolution + parse + match | canon §15.9.3 | Fake, unrelated, stale, blank, and maker-substituted acceptance all fail. |
| `G15R` **enumerated twelve-population** table; each checked and reported by name | canon §15.9.9 | Declaring a population is no longer a substitute for executing it. |
| Pinned `XW2-…` crosswalk schema string added alongside the existing field table | canon §15.9.3 | The register is joinable exactly as every other governed population. |
| **R2.10 dependent-gate propagation** paragraph | canon §15.9.9 | Each repair is enforced identically at U7, U8/U9, G1/G3, G14, G15/`G15R`, and R9. |

## 5. Validator architecture and every parsed input/population

`work/architect-completion/cba_canon_v2_foundation_validator.py` — 4,563 lines,
standard library only, no network, no dependency.

**One loader.** `Tree(root, ref=None)` loads the canon, the repair plan, and
every `work/architect-completion/*.md` receipt — from a working directory or
from a pinned git commit of the same repository. **One entry point.**
`validate_tree(tree) -> (problems, notes)`. There is no fixture path, no
simulated block, and no second validation route; the committed baseline, all
135 adversarial mutations, all 6 positive controls, and the complete
future-R3.1 migrated document all call exactly this function on real files.

**Parsed inputs**

| Input | Source |
|---|---|
| Governed inventory (A–G) | canon §15.9.11 |
| Canonical-actor alias table | canon §15.9.6, reconciled with Inventory A |
| Governing repair-plan facts (backlog 1–27, R4 dependency, construction sequence, items 23/24/25, R3.1 migration status) | repair plan |
| Published v1.1 LEAF requirement texts and scenarios 1–89, with pinned normalized lengths | canon at pinned commit `9814939c` |
| R3 legacy identity baseline | the whole document tree at pinned commit `07f0667d` |
| Acceptance-receipt blobs | `git show <Acceptance commit>:<Acceptance receipt>` |

**Parsed populations** (canon-side via Inventory F, receipt-side via
Inventory G; every row taken at the rendered header's arity, with header ⇔
pinned-schema divergence reported separately as a migration-state
nonconformity)

`GROUP-index`, `LEAF-main`, `LEAF-detail`, `XW2-edge`, `SXW2-edge`,
`SRC2-base`, `SRC2-detail-official-immutable`, `SRC2-detail-official-mutable`,
`EV2-component`, `DR2-generic`, `DISP-detail`, `fragment-inventory`,
`scenario-fragment-inventory`, `BND-bundle`, `SM2-record`, `SS2-record`,
`BLK-record`, `RES-record`, `SRC2-date-component`,
`acceptance-receipt-record`.

**Committed baseline populations parsed at this checkpoint**

`GROUP-index=12`, `LEAF-main=81`, `LEAF-detail=81`, `XW2-edge=131`,
`SRC2-base=4`, `SRC2-detail-official-immutable=2`,
`SRC2-detail-official-mutable=2`, `EV2-component=89`, `DR2-generic=47`.
Every support population is empty pre-R3.1, which the governed migration
switch recognizes and requires.

**What was deleted.** `EXPECT`, `SIM_R31`, `_materialize_sim()`,
`validate_r31_population()`, `canon_vocab()`'s hard-coded `if t in {...}`
filters, the pinned `agent:claude`/`agent:codex` family branches inside
`canonical_actor()`, `_CBA_HASH`, `src2_hash`, and `src2_size`.

## 6. DR2 and G15R reconciliation

**DR2.** The complete population is parsed from its pinned source: 47 unique
rows `DR2-0001`–`DR2-0047`, contiguous from 1, no duplicates, exactly
**13 `ATOM` / 29 `OWN` / 5 `ORIGIN`**, SHA-256 of the 47 stripped rows joined by
`\n` without a trailing newline =
`ae1fb03287188b1ac3ea71629e3184718764a8edda7c198e39b0a50d20ea050c`. Every
`DR2` type is checked against the governed `dr2-type` vocabulary; every
resulting active LEAF must exist; every `XW2` decision reference and every
LEAF-detail decision reference must resolve to an existing record. Post-R3.1,
the edge-type ⇔ decision-type compatibility matrix is enforced in both
directions (terminal ⇒ current `DISP`; nonterminal ⇒ never `DISP`).

Removing (`R1`), duplicating (`R2`), mistyping (`R3`), substituting (`R4`),
naming a nonexistent record (`X6`, `R6`), or removing the whole population
(`P2`, `G11`) all fail. A valid future `DR2` addition above the committed
high-water mark passes (`C5`); a malformed one fails (`C6`).

**G15R.** Executed and reported individually by name:

`R1 SRC2-base; R2 SRC2-date-component; R3 fragment-inventory; R4 BND-bundle;
R5 SM2-record; R6 SS2-record; R7 DISP-detail; R8 BLK-record; R9 RES-record;
R10 DR2-AMEND; R11 DR2-generic; R12 dependent-references.`

Cases `G1`–`G11` remove each required population individually from the migrated
document; each fails for that population.

## 7. All adversarial and positive-control results

**141 cases: 6 accepting controls + 135 rejecting regressions. 0 failures.**
Baseline clean. Exit status `0`.

Accepting controls: `C0` (the committed baseline through the one loader),
`C1` (a benign plan edit — the validator does not reject everything),
`C2` (the **complete future-R3.1 migrated document tree**, including a genuine
SXW2 population, a genuine BND bundle, genuine candidate-obligation SM2/SS2
evidence, and a genuine independent acceptance), `C3` (valid append-only
additions above every current GROUP/LEAF/XW2/EV2 high-water mark), `C4` (two
valid same-basis `effective` dates with distinct roles/scopes), `C5` (a valid
future `DR2` addition above the committed high-water mark).

Rejecting regressions by family: document/plan `P0`–`P9` (10); governed
inventory `V1`–`V6` (6); committed canon populations `X1`–`X10`, `D1`–`D9`
(19); decision records `R1`–`R6`, `C6` (7); migration state `L1`–`L2` (2);
fragments `F1`–`F10` (10); bundles `B1`–`B7` (7); DISP `S1`–`S12` (12);
source dates `T1`–`T13` (13); SM2/SS2 `E1`–`E14` (14); BLK/RES acceptance
`A1`–`A18` (18); AMEND `N1`–`N5` (5); blocking outcome `U1` (1); G15R omissions
`G1`–`G11` (11).

**Negative self-test.** Injecting a knowingly wrong expectation on the
committed baseline produces `FAIL` — the harness is not rigged to pass. This is
asserted in `main()` and its failure is itself a nonzero exit.

## 8. Proof that every case used the same full-document path

`Harness.run()` is the only way a case is executed. It (1) restores the
pristine live documents into the control repository's working tree, (2) writes
the case's mutated documents as real files (or removes them), and (3) calls
`validate_tree(self.repo.tree())`. `Tree` is constructed from the control
repository directory. There is no code path in the module that validates
anything other than a `Tree`, and `validate_tree` has no fixture parameter.
Every rejecting case additionally asserts its **intended diagnostic substring**
appears among the reported problems, so an incidental failure cannot mask a
false positive; a diagnostic mismatch is reported as `MISMATCH` and fails the
run.

The control repository is a real Git repository built once per run with four
commits: the published v1.1 edition; the R3 checkpoint document tree; the live
document tree (with Inventory E repinned onto this repository's own commits);
and the checker's independent acceptance receipt at its own commit.

## 9. RES commit/receipt verification design and results

Design, in order, for every `accepted` `RES-…`:

1. Maker and checker must normalize to **distinct canonical actor identities**
   through the parsed alias table.
2. `Acceptance commit` must be 40 lowercase hex **and resolve to a real commit**
   in the governing repository (`git cat-file -e <sha>^{commit}`).
3. `Acceptance receipt` must **exist at that commit** (`git show <sha>:<path>`).
4. The blob must **parse** and carry an `## Independent acceptance record` row
   for this exact `Resolution ID`.
5. That row's verdict must be `ACCEPT`, and its accepted version, digest,
   proposed outcome, maker, and checker must be **string-identical** to the
   resolution's current values.
6. The digest is **recomputed** from the resolution's current binding content
   and compared against both the resolution row and the receipt row.
7. The `BLK` backlink, current status, and resolution status must reconcile.

Results: the positive control (`C2`) uses a genuinely resolvable commit and a
matching parsed receipt and **accepts**. Rejecting: fake repeated-digit SHA
(`A1`), nonexistent receipt path (`A2`), a real file carrying no acceptance
record (`A3`), maker self-acceptance (`A4`), alias masquerade (`A5`), blank
checker (`A6`), unregistered prefix-similar checker (`A7`), case-variant
checker (`A8`), maker content change plus a self-written matching digest
(`A9`), stale accepted version (`A10`), unrelated accepted outcome (`A11`),
invented outcome (`A12`), non-accepted resolution clearing a finding (`A13`),
open finding (`A14`), orphan resolution (`A15`), inadequate coverage clearing a
finding (`A16`), duplicate `BLK` (`A17`), duplicate `RES` (`A18`).

The R2.9 accepting control `C1` — `1111111111111111111111111111111111111111`
with `work/architect-completion/x.md` — is **replaced**; both of its components
are now dedicated rejecting cases (`A1`, `A2`).

## 10. AMEND, current-endpoint, and stale-reference results

Every population carrying a governed superseding field (`DISP-detail`,
`BND-bundle`, `BLK-record`, `RES-record`, and `SRC2-date-component`) is checked
for: grammar of the superseding relationship; existence of the prior record;
the prior record actually marked `superseded`; the named `AMEND` record
existing and typed `AMEND`; no self-supersession (ID reuse); **exactly one
current successor per superseded identity**; and no `superseded` record left
without a current successor. Live edges referencing a superseded decision
record fail as stale live references.

Results: `N1` (AMEND population removed), `N2` (two current endpoints),
`N3` (broken forward reference), `N4` (non-AMEND record named), `N5` (stale
live reference), `T12` (superseded date component still current), `G10`
(AMEND population omission) — all reject for their intended diagnostics. The
migrated control's genuine `AMEND` supersession of the committed
`DR2-0037/0038/0039` terminal dispositions accepts (`C2`).

## 11. Dependent-gate and contradiction closure

| Gate | R2.10 closure |
|---|---|
| U5–U6 | Candidate, fragment, and decision populations are completely parsed; the whole-obligation escape is closed by the blocking-outcome rule (`U1`). |
| U7 | BND member coverage, DISP typing/currency, BLK/RES acceptance, and candidate support are executable (`B1`–`B7`, `S1`–`S12`, `A1`–`A18`). |
| U8 | Source-date component lifecycle and exact population reconciliation execute (`T1`–`T13`). |
| U9 | Private SM2/SRC2 contracts are deleted; equality runs against the governed `Artifact byte size`/`Artifact SHA-256` fields; inadequate SS2 use is barred (`E1`–`E14`). |
| G1 | Multi-target BND and fragment reconciliation are executable (`F1`–`F10`, `B1`–`B7`). |
| G3 | Terminal DISP grouping and the whole-unsupported blocking route cannot be bypassed (`S9`, `U1`). |
| G10 / SC2 | SC2 remains exactly sixteen checks, byte-identical to R2.9. Check 16's scenario-fragment partition is now mechanically executed against lengths derived from the pinned published edition (`S7`, `S8`, `S10`, `C2`). |
| G14 | Source/evidence reconciliation runs on governed values only. |
| G15 | Actual DR2, AMEND, and current endpoints are parsed (`R1`–`R6`, `N1`–`N5`). |
| `G15R` | Twelve populations executed individually by name (`G1`–`G11`). |
| R8 | Every population the gate must reassess is parsed. |
| R9 | Inherits the closures above; the residual semantic duties are listed in §16. |

**Contradiction sweep.** The one direct live conflict Codex found — repair-plan
item 23's clause/sentence instruction versus the canon's sole span domain — is
resolved in favour of the span grammar, and its return is a rejecting case
(`P6`). A fresh sweep for `clause:`/`sent:` coordinate instructions, composite
`Record status/version` schema claims, "demonstrably identical" reviewer
judgment, and `SXW2-DISP` in the BLK/SM2/SS2 subject vocabularies finds only
historical quotations and explicit supersession explanations — no live
requirement.

## 12. Repair-plan and live-status corrections

- R2.9's section records its outcome: **independently rejected**, with the
  ordered successor unit R2.10.
- A new `## R2.10` section records status, findings, scope, preservation,
  immutability, exclusions, sequencing, and stop condition.
- R3.1's status and heading now block on **R2.10** acceptance.
- Item 23: the abolished clause/sentence coordinate model is replaced by the
  sole `span:<a>-<b>` grammar with an exhaustive `[0, L)` partition, and the
  BND `Member subject scopes` duty is added.
- Item 24: `Artifact byte size` migration for every committed `SRC2-…` base row
  plus the **explicit complete SM2 ⇔ current-`SRC2` reconciliation duty**.
- Item 27: the validator is run over the **migrated R3.1 document tree** through
  its single top-level entry point; `G15R` extends across all twelve enumerated
  populations; no fixed total may serve as a conformance criterion.
- R4's dependency is the **independently accepted R2.10 foundation**; the
  construction sequence is R3 → R2.6 → R2.7 → R2.8 → R2.9 → R2.10 → R3.1 → R4.
- Backlog numbering remains exactly 1–27.
- Canon live-status surfaces (§15.9 header and record paragraph, §15.9.2
  construction sequence, §15.10 intro, §19.3 A-family status, the amendment log,
  and the executive "What v2.0 changes" paragraph) all state: R2.9 rejected,
  R2.10 pending independent review, R3.1 not started, R4 blocked, no A-series
  record accepted, Phase 1 open, Phase 2/W1.1 blocked.

**Source attribution and signed-CBA facts are preserved unchanged.** The bounded
correction accepted by Codex — "No later governing agreement text was located in
the searched first-party sources" — remains the live statement, superseding the
immutable R2.8 receipt's NBPA overstatement without editing it. Signed-CBA
facts: 2,850,534 bytes, 676 pages, SHA-256
`bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32`,
agreement-as-of June 28, 2023, effective July 1, 2023. No new external-source
research was performed, because no changed binding source claim required it.

## 13. Append-only correction of the R2.9 receipt defects

The R2.9 receipt is immutable and was not edited. Its two defects are corrected
here:

1. **Control count.** R2.9 §6 enumerated three accepting controls (`C0`, `C1`,
   `C2`) and then stated "Two accepting controls plus 42 rejecting
   regressions". The truthful accounting for that checkpoint was **three
   accepting controls plus 42 rejecting regressions = 45 cases**. Separately,
   that `C1` control was itself invalid (it used a nonexistent acceptance commit
   and a nonexistent receipt path) and is replaced in R2.10 by a genuine
   acceptance control; see §9.
2. **402-row hash method.** R2.9 §10 published
   `cb59340bb0e21d8f11e2c6b781c8b127c15b8779fcbb0b59ae533b06af15509e` for "an
   anchor-based extraction of all 402 concrete active record rows" without
   stating its newline handling. The exact method and both matching hashes are
   published in §14 below; the R2.9 value is reproducible **only** without a
   trailing newline.

## 14. Preservation hashes and extraction methods

**Immutable ranges** — bytes from the first byte of the first line beginning
with the *from* prefix to the last byte before the first later line beginning
with the *to* prefix.

| Range | From | To | Bytes | SHA-256 | Identical to R2.9 |
|---|---|---|---:|---|---|
| §5.9 | `### 5.9` + space | `## 6.` + space | 6,198 | `53c968ade8cdb2177517412ac09f2bae63ee7642cfa3b24299d2b208895fb373` | yes |
| Historical §15.1–§15.8 | `### 15.1` + space | `### 15.9` + space | 90,455 | `7b3f6aaba81129dceaa8e55f6356f8bbecd3af7e1ff59b127a443fc5d7b14d97` | yes |
| Scenarios 1–89 (§16) | `## 16. Acceptance-test library` | `## 17. Recommended comparison sequence` | 24,119 | `eb11bb122840f881204be4d3de9b8a47a680a19622677e4287227730615b311f` | yes |

**§15.10–§15.12 table lines** — every line in the §15.10–§16 range whose
stripped form begins with `|`, stripped, joined by `\n`, **with** a trailing
newline: **424 lines**,
`dfcfe209c5629f8f86f1014a7ee42f42012655714c9b28fab048951bb61b1bbd` — identical
to R2.9.

**402 concrete record rows** — of those table lines, every row whose first cell
matches `CBA2-A\d{2}`, `CBA2-A\d{2}\.\d+`, `XW2-\d{4}`, `SRC2-\d{3}`, or
`EV2-\d{4}`, stripped, joined by `\n`. **Both methods stated explicitly:**

| Extraction | SHA-256 |
|---|---|
| joined by `\n`, **no** trailing newline (the R2.9 receipt's method) | `cb59340bb0e21d8f11e2c6b781c8b127c15b8779fcbb0b59ae533b06af15509e` |
| joined by `\n`, **with** a trailing newline | `75b5b86b8699b5e6168b2239d27f4b75ffc7f6d5f98ef28cad4436b08a09816d` |

Both are byte-identical to the same extraction at `5f868f2a`.

**Per-population row sets** — stripped rows joined by `\n`, no trailing newline:

| Population | Rows | SHA-256 | Identical to R2.9 |
|---|---:|---|---|
| GROUP | 12 | `b188666749627d1e…` | yes |
| LEAF (main + detail) | 162 | `2f8c7a0b4fa287b3…` | yes |
| XW2 | 131 | `ef15894ab37ece6c…` | yes |
| SRC2 (base + detail) | 8 | `ee479204b41a1248…` | yes |
| EV2 | 89 | `5d2f7a260bf5aefc…` | yes |
| DR2 (R3 receipt) | 47 | `ae1fb03287188b1ac3ea71629e3184718764a8edda7c198e39b0a50d20ea050c` | yes |

**Prior receipts.** All 23 prior `work/architect-completion/*.md` receipts are
byte-identical to `5f868f2a`. The only changed `.md` file in that directory is
the authorized repair plan.

**SC2.** Exactly sixteen checks; the SC2 block is **byte-identical** to
`5f868f2a` — R2.10 changed no SC2 check.

**Identity membership.** `GROUP CBA2-A01..A12`; `LEAF CBA2-A01.1..A12.5`
(81 identities, contiguous per GROUP); `XW2-0001..0131`; `SRC2-001..004`;
`EV2-0001..0089`; `DR2-0001..0047`. Every one still resolves against the pinned
R3 checkpoint commit.

## 15. Changed-file and boundary proof

Exactly the expected file set changed — three modified, one created:

| Status | Path | Diff |
|---|---|---:|
| Modified | `docs/reference/cba/ARCHITECT_CBA_CANON.md` | +609 / −69 |
| Modified | `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md` | +188 / −42 |
| Modified | `work/architect-completion/cba_canon_v2_foundation_validator.py` | +4,349 / −1,040 |
| Created | `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_10_FOUNDATION_VALIDATION_CLOSURE.md` | this file |

Boundaries observed. R2.10 did **not**: modify any protected active R3 GROUP,
LEAF, XW2, SXW2, SRC2, EV2, or DR2 record; perform the R3.1 migration; commit
any concrete fragment, DISP, BND, SM2, SS2, BLK, RES, or AMEND record;
renumber, reuse, reassign, repair, or overwrite any existing identifier; modify
§5.9, historical §15.1–§15.8, or scenarios 1–89; edit any earlier receipt;
begin R4–R9, Phase 2, W1.1, or application work; modify application code, tests,
schemas, fixtures, configuration, runtime data, README, or the code map; read
or write Linear; touch `main`, merge, open a PR, amend, squash, or force-push;
use network access or add a dependency.

Every identity that appears in the R3.1 migrated document tree
(`DR2-0048`–`DR2-0061`, `BND-0001`, `SM2-0001`–`SM2-0004`, `SS2-0001`,
`BLK-0001`, `RES-0001`, `SXW2-0001`–`SXW2-0002`, the fragment inventories, and
the date components) exists **only inside the temporary control repository**
created and deleted within a single validator run. No such record exists in this
repository.

## 16. Exact commands, output hashes, and remaining limitations

| Command | Result |
|---|---|
| `git rev-parse HEAD` / `@{u}` / `git ls-remote` (baseline) | all `5f868f2a…`, divergence `0/0` |
| `git rev-parse main` / `origin/main` | both `69f8f6b6…`, unchanged |
| `git diff --check` | clean (no whitespace errors) |
| `PYTHONDONTWRITEBYTECODE=1 python3 …validator.py` (run 1) | exit `0` |
| `PYTHONDONTWRITEBYTECODE=1 python3 …validator.py` (run 2) | exit `0` |
| Validator SHA-256 | `d0e916f13e49417dc74a75f1469ccbc441272c75369460d205163546b6df93e7` |
| Both outputs SHA-256 | `b648094b98490fd7db9e6ef5635c7557b45c31764244141f417be1c811fbefa6` (byte-identical) |
| Documents loaded | canon + repair plan + 25 receipts |
| Reported result | 6 accepting controls + 135 rejecting regressions = 141 cases; baseline clean; 0 failures; negative self-test `yes` |
| `npm run lint:md` | exit `1`; **127 findings, identical in count and class to the R2.9 baseline** — 74 MD029 in the canon (unchanged) and 53 findings in four unchanged files outside R2.10's scope (`docs/CODEBASE_MAP.md`, three `docs/architect/audits/*`) |
| Canon-only markdown lint | 74 MD029, current **and** parent — no increase, no new rule class |
| Repair-plan markdown lint | 0 findings |
| This R2.10 receipt markdown lint | 0 findings |
| `npm run docs:guardrails` | passed |
| Final `git status` / worktree / index / untracked | clean |

Intentionally skipped as directed: application tests, build, typecheck, ESLint,
`test:diff`, and the full suite.

**Remaining limitations (stated plainly).**

1. **Semantic duties remain semantic.** The narrow `no-successor` rule, the
   `process-only` character determination, and the semantic exhaustiveness
   review are reviewer judgments the canon assigns to G3/R9. The validator
   enforces their *mechanical* guards (kind ⇔ edge-type pairing, the blocking
   outcome for `unsupported-residual` without a supported sibling, terminal
   discipline), not the judgment itself. No gate output in this receipt claims
   a parser proved a semantic property.
2. **SC2 complete 1–89 coverage is an R7 duty.** The R3.1 control population
   carries two genuine scenario dispositions, not all 89; complete SXW2 coverage
   is gated at SC2/G10 when R7 builds the crosswalk.
3. **The transitive `EV2` closure matrix** (§15.9.6) is enforced by U9/G14/R9
   over a populated evidence graph; the committed population has no DERIVED/OPS/
   EXT laundering chain to exercise, so R2.10 adds no control for it.
4. **The R3.1 control is a control, not a migration.** It demonstrates that a
   conforming migrated document passes the same path; it does not perform, and
   must not be read as performing, any part of R3.1.
5. **Independent acceptance of R2.10 itself has not occurred.** This receipt is
   a maker result.

## 17. R3.1 and R4 were not started

**R3.1 was not started.** No committed R3 record was repaired, migrated,
superseded, renumbered, or reused. No fragment, bundle, DISP, SM2, SS2, BLK,
RES, AMEND, or date-component record was minted in this repository. The repair
plan continues to state that R3.1 has not started, and the validator's governed
migration switch reads that status from the plan.

**R4 was not started.** R4 remains blocked on completed R3.1 with an
independent Codex ACCEPT of the R3.1 checkpoint, which in turn remains blocked
on independent acceptance of this R2.10 foundation.

R3, R2.6, R2.7, R2.8, and R2.9 remain rejected. No A-series record is accepted.
Phase 1 remains open. Phase 2, W1.1, and all application work remain blocked.

**R2.10 is a maker result pending independent Codex review. It is not
accepted.**
