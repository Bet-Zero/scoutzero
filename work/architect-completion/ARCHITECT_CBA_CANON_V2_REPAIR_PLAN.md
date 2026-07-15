# Architect CBA Canon v2.0 — Repair Plan (R1–R9)

**Status:** Approved plan; **in execution on `architect/cba-canon-v2`.**
Completed units: **R1** (commit `af931e90`); **R2** (commit `056b9d02` —
its identity/migration model was subsequently **rejected on independent
review** and is historical; see R2.1); **R1.1** (commit `1532c928` —
independently reviewed and **accepted**); **R2.1** (executed at commit
`05c1b28e` — the independent Codex review **accepted the clean v2
architecture in direction but rejected R2.1 as the final foundation gate**,
ordering bounded hardening; receipt:
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_1_REGISTER_STANDARD.md`).
**R2.2** executed at commit `6aa616fd` (the bounded foundation-hardening
unit; receipt:
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_2_FOUNDATION_HARDENING.md`).
The independent Codex foundation review of the combined R1.1/R2.1/R2.2
foundation at `6aa616fd` returned **REJECT/BLOCK-R3**, finding (1) an
omitted branch of signed CBA VII §3(b)(3)(ii) in canon §5.9 and the R1.1
receipt, and (2) five residual foundation-contract corrections, and
ordered two bounded repair units with separate checkpoints: **R1.2**
(executed at commit `07d5aa58a4ed355667293b999fb66eb48eb7c0b0` — the
§3(b)(3)(ii) extension-bonus branch; receipt:
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R1_2_EXTENSION_BONUS_CORRECTION.md`)
and **R2.3** (executed at commit
`c22286072578beed0020c7749e651a50ce566d43` on baseline `07d5aa58…` — the
five ordered foundation-contract corrections; receipt:
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_3_FOUNDATION_CONTRACT_CORRECTIONS.md`).
The independent Codex review of R1.2/R2.3 at `c2228607…` returned
**REJECT/BLOCK-R3**: it **expressly passed** R1.2's extension-bonus
source-law correction, R2.3's SC2/SXW2 integrity gate, R2.3's
historical-register population distinction, and the units' scope and
preservation — none of which may be reopened or redesigned — but found
**four remaining foundation blockers**: (1) the `SRC2-…` schema was not
type-specific and mechanically parseable (mandatory OPS/EXT details
lived only in prose); (2) transitive `EV2-…` dependencies could launder
OPS/EXT authority into DERIVED/INFERRED; (3) binding §§1.1, 12, and 13
still promoted secondary reporting into enforceable operational rules;
and (4) the AMEND child-contiguity, no-ID-reuse, renumbering, and
no-tombstone rules contradicted one another. It ordered **R2.4** — a
bounded standards/source-policy/status correction unit closing exactly
those four blockers (executed in its own fresh session on baseline
`c2228607…`; exactly three authorized files; no concrete
CBA2/XW2/SXW2/SRC2/EV2/DR2 record minted; earlier receipts immutable;
receipt:
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_4_FOUNDATION_CONTRACT_CLOSURE.md`).
The independent Codex review of R2.4 at
`e0344aacc3b60598fc625018640f0d1c31fb6024` returned **REJECT/BLOCK-R3**:
it **passed** — and no later unit may reopen or redesign — transitive
evidence-authority compatibility, the secondary-source/OPS policy,
AMEND numbering, the source/provenance terminology, R1.2's source law,
SC2/SXW2 integrity, the historical-register population separation, and
the unit's scope and preservation, and rejected the foundation **solely**
for two remaining SRC2 grammar defects: (1) the official-mutable
"date or season" field permitted a season with no exact season grammar,
and (2) the SRC2 base field `Verifier/session/date` was an unparseable
composite. It ordered **R2.5** — a bounded grammar-only correction unit
closing exactly those two blockers (executed in its own fresh session on
baseline `e0344aac…`; exactly three authorized files; no concrete
CBA2/XW2/SXW2/SRC2/EV2/DR2 record minted; earlier receipts immutable;
receipt:
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_5_SRC2_GRAMMAR_CLOSURE.md`).
**R2.5 is not independently accepted.** R3–R9 have not started; **R3
remains blocked until the corrected foundation (R1.2/R2.3/R2.4/R2.5)
receives another independent Codex foundation review returning
ACCEPT.** Phase 1 remains open; R3–R9, Phase 2, W1.1, application work,
code-map work, scenarios, and Linear remain out of scope for repair
units. All Phase 1/Phase 2/W1.1/`main`/checksum/independence boundaries
remain unchanged.
**Owner decisions encoded (2026-07-14):** Canon v1.1 is rejected as an active
audit oracle. v1.0 and v1.1 are preserved as historical editions with their
existing checksums; their Git history is never rewritten or removed. Canon
v2.0 is required because substantive rule corrections are necessary. Full
per-LEAF primary-source certification is required. Phase 1 remains open.
Phase 2 and W1.1 remain blocked until v2.0 passes a new independent
Reviews A–F acceptance gate.

**Working branch:** `architect/cba-canon-v2` (owner-authorized long-running
repair branch). Incomplete v2.0 work must not appear on `main`.

**Evidence base:** the Codex acceptance review
(`ARCHITECT_CBA_CANON_V1_1_CODEX_ACCEPTANCE_REVIEW.md`) and the Claude
adjudication (`ARCHITECT_CBA_CANON_V1_1_CLAUDE_ADJUDICATION.md`), both at
commit `9814939c`. Where they disagree, the adjudication's dispositions
govern (e.g., the merged apron row is C07.6, not C07.8; the C14→C01 problem
is a one-way dependency scheduled backwards, not a cycle).

## Global rules for every repair unit

1. **Separate fresh sessions.** Every repair unit — R1, R2, R1.1, R1.2,
   R2.1, R2.2, R2.3, R2.4, R2.5, and R3–R8 — runs in a fresh session with a
   checkpoint commit on `architect/cba-canon-v2` at the end of the unit.
   No unit may be combined with another in one session.
2. **R9 independence.** R9 must be performed by an independent reviewer that
   did not author any part of v2.0.
3. **No Phase 2 compliance verdicts anywhere in R1–R9.** No rule may be
   called Covered/Partial/Missing against the application. Locatability and
   source-certification only.
4. **Controlling authorities only:** the signed 2023 NBA–NBPA CBA, the June
   2024 NBA Constitution and By-Laws, and official NBA releases. CBA 101 is
   explanatory only. CBAguide, Hoops Rumors, RealGM, Spotrac, tests, existing
   code, and prior audit reports cannot prove a rule. If an official source
   cannot support a rule, classify it under the non-express classes of the
   R2.1 authority taxonomy (canon §15.9.5: DERIVED for arithmetic, INFERRED
   for non-arithmetic inference with a controlling source chain, OPS only
   with real operational provenance, or EXT) — never fill the gap with a
   secondary source, and never use an unresolved composite label.
   Secondary sources are discovery or corroboration aids only: they
   establish no authority class (including OPS), and OPS requires
   qualifying first-party operational provenance (canon §15.9.6).
5. **Checksum discipline.** v1.0 (`b8cf5d01…`) and v1.1 (`4a0760c8…`)
   checksums are historical evidence. The v2.0 checksum is recorded only in
   the receipts (a file cannot state its own hash).
6. **Docs validation** (`npm run lint:md`, and `npm run docs:guardrails`
   when routing/standards are touched) at every checkpoint. No app tests —
   these are documentation-only changes.

---

## R1 — Substantive rule corrections

- **Inputs:** Adjudication §5 (confirmed errors C1–C7) and §2 (relabels C8–C9).
- **Authorized files:** `docs/reference/cba/ARCHITECT_CBA_CANON.md` (as the
  v2.0 draft on the repair branch only).
- **Required primary authorities:** CBA II §12(a)(i) p. 58; VII §5(b)(1)
  p. 229; VII §3(b)(2) pp. 200–201; XII §2(b) p. 337; II §11(a)(v) p. 51;
  II §11(f) pp. 54–55; VII §2(c)(1)–(3),(5) pp. 176–178; VII §2(e)(1)(i)–(x)
  pp. 186–187; XII §1(v) p. 336; VII §6(j)(1) pp. 240–241; VII §8(a) p. 260.
- **Required output:** the seven confirmed rule errors corrected in canon
  prose with exact article/§/page cites; A11 and A18.7 authority labels
  corrected (as executed: CBA-cite + DERIVED, and DERIVED/OPS for re-trade
  conditional cash — both later marked provisional by R1.1 and finally
  resolved by R2.1: A11 = an express CBA component plus a separately stated
  INFERRED component; A18.7's re-trade mechanics deferred to their own
  active v2 LEAF); §8.1 rewritten as the ten enumerated adjustments;
  scenarios 50, 53, 57, 60, 67, 68, 69 corrected; edition header updated to
  v2.0-draft with an amendment log entry.
- **Validation gate:** each correction quotes or precisely cites the signed
  text; `npm run lint:md` passes (MD029 exception for §16 stands).
- **Explicit exclusions:** no register restructuring, no renumbering, no
  scenario additions beyond the listed corrections, no code, no Linear.
- **Dependency:** none (first unit).
- **Stop condition:** stop if any correction cannot be anchored to the signed
  text — record it as unresolved instead of guessing.

## R2 — Register standard (atomicity, deduplication, ownership, locators, verification)

> **Status: executed at commit `056b9d02`; its identity/migration model was
> REJECTED on independent review and is superseded in full by R2.1.** The
> executed receipt
> (`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_REGISTER_STANDARD.md`)
> is preserved unchanged as review history; no binding rule may be taken
> from it. The section below is the original order, kept as the historical
> record of what R2 was asked to do.

- **Inputs:** Adjudication §3 (defect patterns), canon §15.6, §1.1–1.2.
- **Authorized files:** new
  `work/architect-completion/ARCHITECT_CBA_CANON_V2_REGISTER_STANDARD.md`
  (as executed, the receipt was named
  `ARCHITECT_CBA_CANON_V2_R2_REGISTER_STANDARD.md`).
- **Required primary authorities:** none (standards document), but the
  locator format must match canon §1.1's citation convention.
- **Required output:** a written standard covering: one obligation = one
  owning LEAF; a single prohibition with a conjunctive trigger is one leaf;
  independently violable requirements are split; §3 correction-table rows
  and §4.2–4.4 ledger rows merge into their substantive twins; phantom and
  process rows are deleted (with any real obligation they hid — e.g. the
  March 4 deadline, CBA II §11(e)(i) — minted a real owner); the per-LEAF
  locator format (authority type + article + §/subsection + exhibit where
  applicable + printed page or official-release URL, or DERIVED formula
  chain, or OPS/EXT provenance and limitation); the verification-method
  assignment rules (architecture properties are STATIC, not SCEN).
- **Validation gate:** standard resolves every defect class in Adjudication
  §3–§4 by rule, not by example; lint:md passes.
- **Explicit exclusions:** no register edits yet.
- **Dependency:** R1 (corrected rule text is what gets registered).
- **Stop condition:** stop if a defect class cannot be resolved by a general
  rule — escalate to the owner rather than special-casing silently.

## R2.1 — Replacement register standard (clean v2 registry model)

- **Status:** replaces the rejected R2 foundation; R1.1 and R2.1 together
  are the foundation R3–R6 build on.
- **Inputs:** the accepted R1.1 corrections; the independent review that
  rejected the R2 foundation and its adjudication; the R2.1 order.
- **Authorized files:** canon §15.9 (full replacement) plus the minimal
  taxonomy-closure annotations (§1.1, the A11/A18.7 prose and register-row
  annotations, §17); this plan (reconciliation only); new receipt
  `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_1_REGISTER_STANDARD.md`.
- **Required output:** the clean v2 identity, evidence, authority,
  verification, scenario, and gate model — the published v1.1 registry and
  scenarios 1–89 frozen as historical migration inputs; the active
  `CBA2-…` GROUP/LEAF namespace (roles fixed at minting; every active
  obligation a LEAF with a fixed GROUP parent); the typed many-to-many
  `XW2-…` historical crosswalk with true-gap companion records; the
  structured `SRC2-…`/`EV2-…` evidence registry; the seven-class authority
  taxonomy with INFERRED, closing the A11/A18.7 provisional items; one
  primary plus any number of secondary verification methods; the
  `CBA2-SC-…` scenario namespace with the `SXW2-…` scenario crosswalk; and
  the retimed R3–R6/R7/R8/R9 gates.
- **Validation gate:** docs validation; mechanical checks that no ID or
  scenario was migrated, no register row was added/removed/renumbered/
  split/merged/re-parented, and no superseded R2 terminology remains
  binding.
- **Explicit exclusions:** no register construction, no crosswalk edges, no
  evidence rows, no scenario edits — R3–R7 own those.
- **Dependency:** R1, R1.1 (accepted).
- **Stop condition:** stop after the R2.1 checkpoint commit; Codex must
  independently review the combined R1.1/R2.1 foundation before R3 begins.
- **Outcome:** executed at commit `05c1b28e`. The independent Codex review
  **accepted the clean v2 architecture in direction but rejected R2.1 as
  the final foundation gate** and ordered the bounded R2.2 hardening unit
  below.

## R2.2 — Bounded foundation hardening

- **Status:** closes the identity, completeness, evidence-schema, gate,
  and execution-contract gaps listed by the independent review of R2.1.
  The clean v2 architecture is accepted in direction and is **not**
  redesigned.
- **Inputs:** the R2.1 standard (canon §15.9) and receipt; the independent
  Codex review of R2.1 and its ordered gap list.
- **Authorized files:** `docs/reference/cba/ARCHITECT_CBA_CANON.md`
  (standards/annotation surfaces only), this plan, and the new receipt
  `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_2_FOUNDATION_HARDENING.md`.
- **Required output:** historical scenario identity pinned to the
  published v1.1 §16 section at `9814939c` (exact byte hash recorded; the
  R1/R1.1 scenario variants reclassified as R7 authoring inputs only);
  deterministic XW2/SXW2 edge-typing precedence with worked examples and a
  duplicate-pair ban; the narrow gateable `no-successor` rule; the EV2
  multi-source/dependency reference grammar with typed SRC2 provenance
  (`official-immutable`/`official-mutable`/`ops-provenance`/`ext-contract`);
  mandatory seven-generator duplicate-candidate generation; gates SC6, SC7,
  G14, G15 plus the U5/U8/U9/G3/G9/R9 updates; `METHOD` and `AMEND`
  decision-record types; strict R3→R4→R5→R6 sequencing; §1.2/§17 verdict
  keying restricted to active `CBA2-…` LEAFs; §19.3 marked as legacy
  family-level status.
- **Explicit exclusions:** no historical register or scenario text edits;
  no CBA2/XW2/SXW2/SRC2/EV2/DR2 records; no code, code map, README, or
  Linear changes.
- **Dependency:** R2.1 (executed; architecture accepted in direction).
- **Stop condition:** stop after the R2.2 checkpoint commit; **Codex must
  independently review the corrected foundation (R2.2) before R3 may
  begin.**
- **Outcome:** executed at commit `6aa616fd`. The independent Codex
  foundation review of R1.1/R2.1/R2.2 at that commit returned
  **REJECT/BLOCK-R3** and ordered the bounded R1.2 and R2.3 units below.

## R1.2 — Extension-bonus allocation branch (ordered by the independent Codex foundation review)

- **Status:** executed at commit `07d5aa58a4ed355667293b999fb66eb48eb7c0b0`
  in its own fresh session.
- **Ordering finding (independent Codex source-law finding):** canon §5.9
  and the immutable R1.1 receipt omitted one branch of signed CBA VII
  §3(b)(3)(ii): when the extending team's Team Salary is below the Salary
  Cap and the Extension calls for the signing bonus to be paid **no sooner
  than** the first day of the first Salary Cap Year covered by the
  extended term, the bonus is allocated in accordance with §3(b)(3)(i)'s
  extended-term-only proration rules — in proportion to the lack-of-skill-
  protected percentages of Base Compensation in the Salary Cap Years
  covered by the extended term, with the zero-protection fallback
  allocating the entire bonus to the extended term's first Salary Cap
  Year. The missing branch must not fall back to ordinary signing-bonus
  allocation under §3(b)(2).
- **Authorized files (exactly three):**
  `docs/reference/cba/ARCHITECT_CBA_CANON.md` (the §5.9 correction plus
  the minimal amendment/status surfaces recording R1.2), this plan (the
  R1.2 unit and status reconciliation only), and the new receipt
  `work/architect-completion/ARCHITECT_CBA_CANON_V2_R1_2_EXTENSION_BONUS_CORRECTION.md`.
- **Required primary authority:** the signed 2023 CBA, VII §3(b)(3)
  (printed pp. 201–03), re-downloaded, hash-verified, and read directly in
  the R1.2 session with the adjacent provisions needed to distinguish
  every timing/cap-status branch (§3(b)(2); §3(b)(3)(i), (iii), (iv), (v)).
- **Required output:** canon §5.9 states the three §3(b)(3) branches
  distinctly — at/over-cap (§3(b)(3)(i)); below-cap with payment no sooner
  than the extended term's first day (the previously omitted branch,
  §3(b)(3)(ii) second sentence); below-cap early payment with the
  deemed-Renegotiation and two-installment rules (§3(b)(3)(ii)(A)–(C)) —
  each with its precise trigger, allocation basis, and zero-protection
  fallback, and with the express statement that ordinary §3(b)(2)
  allocation does not govern the corrected branch.
- **Immutability:** the R1.1 receipt is **not edited**. The R1.2 receipt
  corrects R1.1's completeness overclaim without rewriting historical
  review evidence.
- **Explicit exclusions:** no scenario text (scenario 69's missing
  before/after-5:00-p.m. ETO discriminator stays deferred to R7); no
  historical register row; no §15.9 foundation-standard text; no concrete
  CBA2/XW2/SXW2/SRC2/EV2/DR2 record; no application, Phase 2, W1.1,
  register-construction, code-map, README, test, data, or Linear work.
- **Sequencing:** **R2.3** — the ordered standards corrections — is the
  next separate repair unit with its own checkpoint; it is not part of
  R1.2. **R3 remains blocked until R1.2 and R2.3 both receive another
  independent Codex foundation review.**
- **Stop condition:** stop and report if the signed text does not support
  the ordered correction exactly or reveals another branch outside this
  narrow scope.

## R2.3 — Foundation-contract corrections (ordered by the independent Codex foundation review)

- **Status:** executed at commit `c22286072578beed0020c7749e651a50ce566d43`
  in its own fresh session on baseline
  `07d5aa58a4ed355667293b999fb66eb48eb7c0b0` (the R1.2 checkpoint). The
  post-R1.2/R2.3 independent Codex foundation review returned
  **REJECT/BLOCK-R3**: it expressly passed R1.2's source law, R2.3's
  SC2/SXW2 integrity gate, and the historical-register population
  distinction, but found four remaining foundation blockers and ordered
  the bounded **R2.4** unit below. R2.3 itself is **not independently
  accepted**.
- **Ordering findings — the five independent Codex foundation blockers
  and their correction contracts:**
  1. **Evidence roots and class-specific certification.** The standard
     permitted artifactless OPS/EXT evidence while requiring every
     evidence chain to end in an artifact, and its universal
     certification sentence required a passage read for every EV row.
     Corrected (canon §15.9.6, U8/U9/G14/R9): every `EV2-…` evidence
     path terminates in at least one typed `SRC2-…` source/provenance
     record; no `EV2-…` row has both reference fields empty;
     DERIVED/INFERRED may carry chains through dependencies that
     terminate in `SRC2-…` records; OPS references ≥1 `ops-provenance`
     record and EXT ≥1 `ext-contract` record (each valid without a
     public URL, and without an artifact hash only where no durable
     artifact exists — absence of a public artifact never eliminates the
     record); `SRC2-…` is a source/provenance-record registry, not only
     a file-artifact registry; class-specific certification replaces the
     universal read-the-passage rule; the gates enforce typed
     termination, no source-free terminal components, certification,
     valid provenance-type ⇔ authority-class pairings, acyclic
     dependencies, exact Authority ⇔ EV reconciliation, and zero
     dangling or orphan records.
  2. **Strict secondary-source policy.** Canon §15.9.6 permitted
     secondary operational reporting to establish OPS while this plan
     prohibited secondary sources as proof. Corrected to the stricter
     plan policy everywhere: secondary sources are discovery/
     corroboration aids only and establish no authority class; OPS
     requires qualifying first-party operational provenance (an
     authenticated league/club operational artifact; a directly
     authenticated league/club communication; a league system record,
     transaction ruling, or comparable first-party operational record;
     or a recorded direct attestation with identity, authority,
     effective date, verification method, limitations, and
     configurability). Media reports, expert summaries, CBAguide, RealGM,
     Spotrac, prior audits, tests, and existing implementations are never
     sufficient. Canon §1.1, §15.9, §19.1, and this plan swept.
  3. **Complete SXW2 integrity gate.** SC2 gated only historical-scenario
     coverage. Corrected: SC2 is the complete sixteen-check SXW2
     integrity contract (canon §15.9.9 — ID grammar; edge-ID uniqueness;
     allowed type vocabulary; sources restricted to the pinned
     `9814939c` 1–89 population; complete coverage; no out-of-population
     source; existing active `CBA2-SC-…` target for every non-terminal
     edge; `invalid`/`no-successor` as the only terminal types with `—`
     targets; no non-terminal `—`; no terminal live target; resolving
     decision records; exactly one primary relationship type per pair;
     no duplicate pair under another type; deterministic precedence; the
     narrow no-successor rule; parseable exact scope). G10 and R9 rerun
     the complete contract, never coverage alone. SC1–SC7 numbering
     kept.
  4. **All-population AMEND coverage.** AMEND covered only defective
     active rows while XW2/SRC2 were described as append-only with no
     unambiguous repair path. Corrected (canon §15.9.2/§15.9.4): draft
     mutability and `AMEND` lineage extend to active GROUP/LEAF records,
     `XW2-…` edges, `SRC2-…` records, `EV2-…` components, active
     `CBA2-SC-…` scenarios/named cases, `SXW2-…` edges, and `DR2-…`
     records; append-only precisely defined (monotonic allocation, no ID
     reuse, no reassignment of superseded/removed IDs, correctable
     drafts, immutable receipts preserving prior versions, live tables
     carrying only current records); same-ID content corrections vs
     minted-ID identity changes defined; every affected live reference
     updated in the same commit; a defective `DR2`/`AMEND` record is
     corrected by a later `AMEND` record; G15/R9 verify amendment-chain
     integrity across every population (zero stale live references, no
     correction-created duplicates or orphans, forward resolvability of
     every receipt-era ID/version, one terminal disposition per chain).
  5. **Historical register population clarity.** A binding note falsely
     said the branch's §15.1–§15.8 rows were preserved unchanged.
     Corrected (canon §15 status note, §15.9.1): three register
     populations, mirroring the scenario populations — the published
     v1.1 register at `9814939c` (file checksum `4a0760c8…`; sole
     historical source of every XW2 edge; meanings permanently fixed;
     never active or verdict-bearing); the branch's legacy-numbered
     working copy (R1/R1.1 source-law corrections plus the authorized
     R2.1 A11/A18.7 annotations; authoring input for active v2
     obligations only; never the XW2 source; never active or
     verdict-bearing; redefines no published historical ID); and the
     active v2 registry (`CBA2-…`, R3–R6; the only active,
     verdict-bearing population after R9 acceptance). No legacy-numbered
     row was edited — population/status wording only.
- **Authorized files (exactly three):**
  `docs/reference/cba/ARCHITECT_CBA_CANON.md` (standards and
  status/annotation surfaces only), this plan (reconciliation only), and
  the new receipt
  `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_3_FOUNDATION_CONTRACT_CORRECTIONS.md`.
- **Immutability:** no earlier receipt was edited; earlier receipts
  remain commit-scoped immutable review history.
- **Explicit exclusions:** no concrete CBA2/XW2/SXW2/SRC2/EV2/DR2 record
  minted; no historical register row or scenario edited; no application,
  code-map, README, test, schema, fixture, configuration, data, or
  Linear work; R3–R9, Phase 2, and W1.1 out of scope.
- **Sequencing:** the post-R1.2/R2.3 independent Codex foundation review
  returned REJECT/BLOCK-R3 and ordered R2.4; **R3 remains blocked** until
  the corrected foundation (R1.2/R2.3/R2.4) receives another independent
  Codex foundation review returning ACCEPT.
- **Stop condition:** stop and report if a correction cannot be made
  without redesigning the accepted clean-v2 architecture or editing an
  immutable receipt.

## R2.4 — Remaining foundation-blocker closure (ordered by the independent Codex review of R1.2/R2.3)

- **Status:** executed at commit
  `e0344aacc3b60598fc625018640f0d1c31fb6024` in its own fresh session on
  baseline `c22286072578beed0020c7749e651a50ce566d43` (the R2.3
  checkpoint). The independent Codex review of R2.4 at `e0344aac…`
  returned **REJECT/BLOCK-R3**: it **passed** R2.4's transitive
  evidence-authority compatibility model, the secondary-source/OPS
  policy, the AMEND numbering contract, the source/provenance
  terminology, and the unit's scope and preservation — none of which may
  be reopened or redesigned — and rejected the foundation solely for the
  two SRC2 grammar defects closed by R2.5 below. R2.4 itself is **not
  independently accepted**. R2.4 was standards, source-policy, and
  status reconciliation only.
- **Ordering findings — the four remaining foundation blockers and
  their correction contracts:**
  1. **Type-specific, parseable SRC2 records.** The `SRC2-…` schema was
     a single file-shaped row whose mandatory OPS/EXT details existed
     only in prose, so U8/U9/G14/R9 could not deterministically locate
     or validate them. Corrected (canon §15.9.6): a shared eleven-field
     base table plus one pinned type-specific detail table per
     provenance type (`official-immutable`/`official-mutable`/
     `ops-provenance`/`ext-contract`), joinable on Record ID; a pinned
     field grammar for every multi-value field; `—` validity defined
     per provenance type, never generically; binding timestamp/hash
     rules (durable bytes always hashed; URL `—` only when no URL
     exists; hash `—` only when no durable artifact exists; retrieval
     timestamps whenever content/artifacts were retrieved;
     authentication timestamps for direct communications, attestations,
     system access, and every other non-public verification; an
     artifactless OPS record never `—` for both provenance identity and
     authentication); and field-level validation at U8/U9, G14, and R9
     — a record with any required type-specific field absent,
     malformed, or `—` where prohibited fails and certifies nothing.
  2. **Transitive evidence-root compatibility.** A DERIVED component
     could depend only on an OPS-rooted component while passing every
     local check, laundering operational practice into derived law.
     Corrected (canon §15.9.6): validators compute every `EV2-…`
     component's complete transitive dependency closure and terminal
     `SRC2-…` root set and enforce a binding compatibility model —
     CBA/BYL/NBA root in their official records; DERIVED stays
     arithmetic-only with official roots and no `ops-provenance`/
     `ext-contract` root; INFERRED resolves through official text and
     compliant components with no OPS/EXT root (OPS reporting cannot
     become INFERRED; EXT determinations cannot become express or
     inferred law); OPS retains an `ops-provenance` root and EXT an
     `ext-contract` root; a LEAF consuming OPS/EXT directly or
     transitively keeps the class visible in its Authority field with a
     corresponding `EV2-…` component and full limitation/configurability/
     assumption propagation; no dependency edge reduces, erases, or
     upgrades its source's authority or limitations; a parseable
     class-compatibility matrix governs; U9/G14/R9 compute closures,
     validate every edge and terminal root, detect laundering, verify
     propagation, and reject locally valid but transitively
     incompatible chains.
  3. **No secondary-source-to-OPS promotion anywhere binding.** Binding
     §1.1 (conflict order ending in "secondary expert source"), the §12
     authority statement, §12.2, the §13 authority statement, and §13.3
     still promoted secondary reporting into enforceable operational
     rules. Corrected: the §1.1 hierarchy now ends with legitimate
     official authority and discovery sources sit outside it; the
     multi-team touch test and detailed qualifying-asset thresholds
     (§12.2), the seven-future-draft horizon (§13.3), and the
     secondary-reported pick-protection/deferral processing mechanics
     (§13.3) are recast as **unsupported operational candidates**
     (canon §15.9.6): discovery candidates only — never registrable,
     never OPS, never automatic or configurable verdicts, never
     enforceable without qualifying first-party operational provenance
     or a different valid authority classification; candidates are
     preserved, not silently deleted; §15 evidence pointers, §17
     Pass 1, §19.1, and the §19.3 continuity note conformed; §15.9.1
     boundary rule 4 makes historical/legacy mentions non-authorizing.
     Historical register rows and scenarios were not edited.
  4. **AMEND child-numbering contradiction.** Given children
     `.1/.2/.3`, removing `.2` had no legal outcome (keeping `.3` made
     a prohibited gap; renaming `.3` reused an ID; a placeholder was a
     prohibited tombstone). Corrected (canon §15.9.2, U13, G15, R9):
     contiguity applies at initial GROUP construction only; the
     renumbering-to-restore-contiguity rule is removed; a post-AMEND
     gap is valid only when every missing allocated ID resolves through
     the immutable receipts and `AMEND` chain to an explicit removal or
     current successor(s); unexplained or never-allocated interior gaps
     stay invalid; removed/superseded IDs are never reused; new
     children allocate monotonically above the GROUP's historical
     high-water mark; live tables carry only current records with no
     tombstone/RETIRED/ALIAS rows; binding worked examples added.
- **Terminology:** the residual §1.2/§17 verdict-exclusion phrase
  `source artifacts` corrected to `source/provenance records`.
- **Authorized files (exactly three):**
  `docs/reference/cba/ARCHITECT_CBA_CANON.md` (standards, source-policy,
  and status/annotation surfaces only), this plan (reconciliation only),
  and the new receipt
  `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_4_FOUNDATION_CONTRACT_CLOSURE.md`.
- **Immutability:** no earlier receipt edited; earlier receipts remain
  commit-scoped immutable review history.
- **Preservation:** canon §5.9 byte-identical to the R2.3 checkpoint;
  the complete sixteen-check SC2/SXW2 block intact and rerun in full by
  G10 and R9; the three historical-register populations unchanged; the
  published `9814939c` snapshot remains the sole XW2 historical source;
  §15.1–§15.8 rows and scenarios 1–89 unchanged.
- **Explicit exclusions:** no concrete CBA2/XW2/SXW2/SRC2/EV2/DR2 record
  minted; no §15.10–§15.12 section created; no historical register row
  or scenario edited; no application, code-map, README, test, schema,
  fixture, configuration, data, or Linear work; R3–R9, Phase 2, and
  W1.1 out of scope.
- **Sequencing:** the independent Codex review of R2.4 returned
  REJECT/BLOCK-R3 and ordered R2.5; **R3 remains blocked** until R1.2,
  R2.3, R2.4, and R2.5 together receive another independent Codex
  foundation review returning ACCEPT. Phase 1 remains open.
- **Stop condition:** stop and report if a correction would require
  redesigning the accepted clean-v2 architecture, changing a passing
  R1.2/SC2/historical-population result, or editing an immutable
  receipt.

## R2.5 — SRC2 field-grammar closure (ordered by the independent Codex review of R2.4)

- **Status:** the current unit, executed in its own fresh session on
  baseline `e0344aacc3b60598fc625018640f0d1c31fb6024` (the R2.4
  checkpoint). **Not independently accepted** — acceptance belongs to
  the next independent Codex foundation review. R2.5 is a bounded
  grammar-only correction: two SRC2 field grammars plus the minimal
  amendment/status surfaces recording them.
- **Ordering findings — the two remaining Codex foundation blockers
  and their correction contracts:**
  1. **No exact season grammar.** The official-mutable publication
     "date or season" field permitted a season but defined no exact
     season grammar, so a season value was not mechanically
     validatable. Corrected (canon §15.9.6): exactly one accepted
     machine season format, `YYYY-YY` — four ASCII digits, exactly one
     ASCII hyphen-minus `-` (`U+002D`), then two ASCII digits that
     must equal the last two digits of `YYYY + 1` modulo 100; no
     spaces; en dash, em dash, slash, textual prefix, abbreviated
     first year, four-digit second year, and arbitrary season labels
     all invalid (`2026-27`/`1999-00` valid; `2026–27`, `2026/27`,
     `FY26`, `26-27`, `2026-28`, `2026-2027` invalid). Source-title
     typography may be preserved in title/identity text, but every
     structured season field normalizes to `YYYY-YY`. The base schema,
     `official-mutable` detail schema, per-type validity matrix, NBA
     per-class minima, and U8/U9/G14/R9 all point to this one grammar;
     no second season syntax exists.
  2. **Unparseable composite verification field.** The SRC2 base field
     `Verifier/session/date` mixed three values in one column.
     Corrected (canon §15.9.6): the composite is abolished and split
     into three separately required columns — `Verifier identity`
     (`human:<slug>` or `agent:<slug>`; slug 1–64 ASCII characters,
     starting with a lowercase letter or digit, containing only
     lowercase letters, digits, `.`, `_`, `-`, no spaces),
     `Verification session ID` (`session:<slug>`; slug 1–96 characters
     under the same character rules; a receipt-scoped deterministic
     session identifier suffices — no confidential provider-internal
     session identifier is required), and `Verification date` (a real
     `YYYY-MM-DD` calendar date) — growing the base table from eleven
     to thirteen pinned fields. All three fields are mandatory for
     every provenance type, never `—`, independently parsed and
     validated; a nonempty field never compensates for a missing or
     malformed one; missing or malformed verification metadata fails
     the record, which certifies nothing. U8/U9, G14, and R9 validate
     the three fields under the same §15.9.6 grammars.
- **Receipt erratum (R2.4, low, nonblocking):** the immutable R2.4
  receipt's literal sweep claimed zero `secondary expert` occurrences;
  one valid occurrence remains in this plan's historical description
  of the R2.4 blockers. The R2.5 receipt records the erratum: the
  intended and correct claim is zero remaining **binding**
  occurrences; the remaining repair-plan occurrence is classified
  `HISTORY`, authorizes and promotes nothing, and is retained; the
  R2.4 receipt is not edited.
- **Authorized files (exactly three):**
  `docs/reference/cba/ARCHITECT_CBA_CANON.md` (the two grammar
  corrections plus the minimal amendment/status surfaces), this plan
  (reconciliation only), and the new receipt
  `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_5_SRC2_GRAMMAR_CLOSURE.md`.
- **Immutability:** no earlier receipt edited; earlier receipts remain
  commit-scoped immutable review history.
- **Preservation:** canon §5.9, §15.1–§15.8, scenarios 1–89, and the
  complete sixteen-check SC2 block byte-identical to the R2.4
  checkpoint (hashes recomputed, not copied); the transitive
  compatibility model, secondary-source policy, AMEND numbering, and
  historical-population distinction untouched.
- **Explicit exclusions:** no concrete CBA2/XW2/SXW2/SRC2/EV2/DR2
  record minted; no §15.10–§15.12 active section created; no
  historical register row or scenario edited; no application, README,
  code-map, test, schema, fixture, configuration, data, or Linear
  work; R3–R9, Phase 2, and W1.1 out of scope.
- **Sequencing:** **R3 remains blocked** until R1.2, R2.3, R2.4, and
  R2.5 together receive another independent Codex foundation review
  returning ACCEPT. Phase 1 remains open.
- **Stop condition:** stop and report if a correction would require
  redesigning a passed foundation area or editing an immutable
  receipt.

## R3 — Re-register and source-certify the A-series

- **Inputs:** R1/R1.1 canon text, the R2.1 standard (canon §15.9),
  adjudication duplicate/atomicity lists for A01–A21 as the starting queue.
- **Authorized files:** the new active v2 register/crosswalk/evidence
  sections the R2.1 standard defines (canon §15.10–§15.12, created by R3);
  a per-unit certification receipt in `work/architect-completion/`. The
  historical `CBA-…` A-series rows and scenarios 1–89 are **not edited**.
- **Required primary authorities:** CBA Articles VII §§2, 3, 6(j), 8; XII;
  XXIV; BYL §§4, 7.03; official releases for annual values.
- **Required output:** the A-series active v2 registry **built new** as
  `CBA2-A…` GROUP/LEAF rows (never by mutating `CBA-…` IDs), with recorded
  atomicity/ownership/movement decision records; `XW2-…` crosswalk edges
  for the historical A-series LEAFs (deferrals listed where a target
  belongs to a later unit); `SRC2-…`/`EV2-…` evidence rows for every
  authority component of every registered LEAF, each certified against the
  primary text at registration; primary/secondary methods assigned; family
  counts recomputed mechanically; the mandatory §15.9.4 duplicate-candidate
  population generated and fully dispositioned; canon §19.3's family-status
  rows updated for the unit's families from legacy claims to per-LEAF
  certified status (this duty applies to each of R3–R6 for its own
  families).
- **Validation gate:** the §15.9.9 unit-local gates U1–U14 for the A
  family. No code-map, Phase 2 packet, global-dependency, or global
  scenario-reconciliation gates run in-unit.
- **Explicit exclusions:** no C/R/L/S registration; no scenario rewrites
  (R7); no edits to historical rows.
- **Dependency:** R1, R1.1, R1.2, R2.1, R2.2, R2.3, R2.4, R2.5 (the
  foundation as independently accepted after the post-R2.5 independent
  Codex foundation review).
- **Stop condition:** any A-series rule that fails primary verification is
  corrected via the R1 mechanism (amendment log entry) or reclassified
  under the §15.9.5 taxonomy — never left silently.

## R4 — Re-register and source-certify the C-series, first half (C01–C13)

- Same **inputs/authorities/gate/exclusions/stop condition** pattern as R3,
  scoped to C01–C13.
- **Required primary authorities (principal):** CBA VII §§2(c), 2(d), 2(e),
  4, 6; Article II; official releases.
- **Dependency:** R1, R1.1, R2.1, R2.2, and **completed R3** — the
  construction sequence R3 → R4 → R5 → R6 is strict (canon §15.9.2): all
  units extend the shared §15.10–§15.12 sections and allocate from the
  shared XW2/SRC2/EV2/DR2 namespaces.
- Note: this half contains the MTS (C10) and Apron (C07) rewrites from
  R1/R1.1 and the historical C07.6 bundle, whose two enumerated adjustments
  (vi) and (vii) become separate active v2 LEAFs.

## R5 — Re-register and source-certify the C-series, second half (C14–C25)

- Same pattern, scoped to C14–C25.
- **Required primary authorities (principal):** CBA Articles II §§3–12,
  VII §§3, 5, 7; VIII–IX; XI; XII; Exhibits B and C.
- **Dependency:** R1, R1.1, R2.1, R2.2, and **completed R4** (strict
  sequence, canon §15.9.2).
- Note: this half contains the incentive-cap denominator (C23), option/ETO
  shape (C24), Two-Way (C20), and Exhibit 10/9 (C21) corrections from R1.

## R6 — Re-register and source-certify the R, L, and S series

- Same pattern, scoped to R01–R10, L01–L10, S01–S04.
- **Required primary authorities (principal):** CBA Articles VII §7(d), XXVII,
  XXIX; BYL §§5–6; XII §4; official releases and schedule publications;
  CBA Exhibits B/C chains (Art. I §1(jj), §1(iii)/(hhh)) for the S-series
  dataset obligations.
- **Required output additions:** S-series carries the dataset provenance
  table (official / derived / projected / unavailable) including the
  2026-27 calendar (not yet officially published) and EAPS (unpublished —
  projection only); the historical L01.5 calendar bundle dispositioned per
  the R2.1 ownership rules (cross-references, not duplicate date LEAFs).
- **Dependency:** R1, R1.1, R2.1, R2.2, and **completed R5** (strict
  sequence, canon §15.9.2).

## R7 — Rebuild semantic acceptance-scenario coverage

- **Inputs:** the completed active v2 register (R3–R6), Adjudication §4.
- **Authorized files:** the new active v2 scenario subsection of canon §16;
  the register's scenario-evidence column; and, **for bounded method-fit
  corrections only** (canon §15.9.8), an active LEAF's `Primary method`,
  `Secondary methods`, `Scenario evidence`, and `Decision records` fields —
  every such change carries a `METHOD` decision record in the R7 receipt
  (LEAF, old method set, new method set, why the previous method was
  dishonest, resulting evidence requirement). R7 may **not** change a
  LEAF's requirement, authority classes, source evidence, origin, or
  dependencies; such discoveries return to the owning R3–R6 unit.
  Historical scenarios 1–89 (pinned at `9814939c`) are frozen and are
  **not edited**.
- **Required primary authorities:** the evidence chains already certified
  in R3–R6.
- **Required output:** the active v2 scenario library **built from
  scratch** as `CBA2-SC-…` per the §15.9.8 contract (explicit season/date
  or versioned-calendar input, inputs, boundary, exact expected result
  including arithmetic, controlling authority, named case/variant
  identifiers, and an `Exercises:` list of active v2 LEAFs); an `SXW2-…`
  scenario crosswalk covering every published historical scenario 1–89
  (the pinned published set at `9814939c` per canon §15.9.8 — the R1/R1.1
  corrected variants are authoring inputs, never crosswalk sources;
  includes the incomplete historical scenarios 53, 57, and 68, whose
  replacement coverage is built here); missing coverage added (exception proration,
  signing-bonus-as-cash, five window restrictions, circumvention/tampering
  EXT states, Bird-clock transfer and waiver reset, October 31
  rookie-option boundary, protection-increase limits, loan-interest/premium
  cases); every scenario→LEAF edge reviewed **exhaustively** by named case
  — later sampling is an additional audit, never a substitute.
- **Validation gate:** the §15.9.9 scenario gates SC1–SC7 (ID/schema,
  the complete sixteen-check SC2 SXW2 integrity contract — never
  coverage alone, bidirectional scenario↔LEAF reconciliation, exhaustive
  named-case review, no cosmetic mappings, SCEN coverage completeness
  with no empty-set pass, and `METHOD` records for every method change).
- **Explicit exclusions:** no register content changes beyond the
  scenario-evidence column and the bounded `METHOD`-recorded method-fit
  fields above; no tests written (that is Phase 2).
- **Dependency:** R3–R6 complete.
- **Stop condition:** a leaf with no honest scenario gets its primary
  method reclassified (STATIC/LIFECYCLE/EXTS) via a `METHOD` decision
  record rather than a cosmetic mapping; a discovery requiring a change to
  requirement, authority, evidence, origin, or dependencies returns to the
  owning R3–R6 unit instead of being fixed in R7.

## R8 — Reconcile code map, dependencies, datasets, receipts, and final checksum

- **Inputs:** v2.0 register and scenarios (R3–R7), Adjudication §7–§8.
- **Authorized files:**
  `work/architect-completion/ARCHITECT_CBA_CANON_CODE_MAP.md` (superseding
  edition), migration/amendment receipt for v2.0,
  `docs/reference/cba/README.md` (status update only).
- **Required primary authorities:** none new; repository inspection.
- **Required output:** code map remapped to the active v2 register (active
  `CBA2-…` LEAFs only); the successors of historical A04/A05/A07 pointed to
  the operative sites (`tradeMachine/utils/matchingValues.ts`
  BYC/poison-pill/kicker code); the successors of historical C22.1–.3
  re-marked NO SITE or pointed to real sites; W4.1/W4.2 reordered (or the
  Bird-status prerequisite extracted) so the "no unit depends on a later
  one" claim is true; stale "uncommitted / nothing pushed" language removed
  from receipts; dataset provenance table finalized; the crosswalk closed
  (zero deferrals); canon §19.3's status table finally reconciled against
  the completed active registry (no family called fully v2-certified
  unless every active LEAF passes U8/U9/U14); README status updated while
  keeping the canon unaccepted; v2.0 SHA-256 recorded in the receipt and
  code map; all counts recomputed mechanically.
- **Validation gate:** the §15.9.9 global reconciliation gates G1–G15 —
  complete historical-LEAF crosswalk coverage; all non-terminal targets
  resolve; terminal and companion true-gap records validate; global active
  GROUP/LEAF counts with historical/support records excluded; code map and
  Phase 2 packets contain active v2 LEAFs only, each exactly once where the
  contract requires it; no historical ID, GROUP, crosswalk edge, or
  scenario ID in any verdict column; dependency order with no later-unit
  dependency and no cycles — mechanical cycle/order checks **plus a
  semantic dependency review** (no claim that a parser proved a dependency
  was never omitted); global ownership/atomicity reconciliation including
  the rerun cross-family duplicate-candidate sweep with zero unresolved
  candidates (G9); exhaustive semantic review of every `no-successor`
  disposition (G3); scenario reconciliation rerun including the complete
  SC2 SXW2 integrity contract (G10); global evidence reconciliation —
  typed `SRC2` termination for every evidence path, no source-free
  terminal `EV2` component, class-specific certification, valid
  provenance-type ⇔ authority-class pairings, acyclic dependency chains,
  exact Authority ⇔ EV reconciliation, zero orphan `SRC2`/`EV2`
  references, type-specific field-level `SRC2` validation (base plus
  pinned detail row, per-type `—` validity, timestamp/hash rules, the
  pinned `YYYY-YY` season grammar, and the three split
  verification-metadata fields under their §15.9.6 grammars), and
  recomputed transitive dependency closures and terminal root sets for
  every `EV2` component against the §15.9.6 compatibility matrix — zero
  authority-laundering chains, OPS/EXT limitation propagation verified
  (G14); amendment-chain integrity across every live v2
  population — zero stale live references, no correction-created
  duplicates or orphans, forward resolvability of every receipt-era
  ID/version, one terminal disposition per supersession chain, and
  §15.9.2 child-ID numbering integrity — explained gaps only, no ID
  reuse, no renumbering, high-water-mark allocation (G15);
  sampled semantic rechecks of
  merge/split decisions, scenario coverage, and source-derived
  obligations; final v2 checksum and counts; lint:md passes.
- **Explicit exclusions:** no application code changes; no Phase 2 verdicts;
  locatability only.
- **Dependency:** R3–R7 complete.
- **Stop condition:** any mapping that cannot be honestly classified stays
  NO SITE — never a plausible-looking pointer.

## R9 — Independent acceptance Reviews A–F

- **Inputs:** the completed v2.0 package merged to a pinned clean commit
  (merge to `main` only with owner approval).
- **Authorized files:** none (read-only review); reviewer writes its own
  report artifact.
- **Required primary authorities:** same controlling set; the reviewer must
  perform its own primary-source comparison, not reuse R3–R6 receipts as
  proof.
- **Required output:** Reviews A–F (repository/provenance; amendment
  lineage v1.1→v2.0; registry completeness/uniqueness/atomicity; scenario
  coverage; primary-source integrity including per-LEAF evidence sampling;
  code map/execution plan) with an explicit ACCEPT or REJECT at a pinned
  clean commit. The reviewer must re-run **every mechanical gate from
  scratch**, independently sample primary-source passages, independently
  sample active obligation atomicity and ownership, **independently
  regenerate the duplicate-candidate population (all §15.9.4 generators)
  rather than trusting the unit lists**, independently sample scenario
  truth, **review every `no-successor` disposition individually — not a
  sample**, **verify the `AMEND` amendment chain across every live v2
  population — including §15.9.2 child-ID numbering integrity (explained
  gaps only, no ID reuse, no renumbering, high-water-mark allocation) —
  and re-run the exact bidirectional evidence reconciliation
  (including typed `SRC2` termination, the no-source-free-terminal-
  component check, class-specific certification, provenance-type ⇔
  authority-class pairing validity, type-specific field-level `SRC2`
  validation — including the pinned `YYYY-YY` season grammar and the
  three split verification-metadata fields under their §15.9.6
  grammars — and an independent recomputation of every `EV2`
  component's transitive dependency closure and terminal root set
  against the §15.9.6 compatibility matrix — zero authority-laundering
  chains)**, **re-run the complete SC2 SXW2
  integrity contract**, and runtime-sample code-map pointers.
- **Validation gate:** ACCEPT at a pinned clean commit is the only event
  that closes Phase 1 and unblocks Phase 2/W1.1.
- **Explicit exclusions:** the reviewer must not have authored any v2.0
  content; no fixes during review.
- **Dependency:** R1–R8 complete and checkpoint-committed.
- **Stop condition:** on REJECT, findings return to the appropriate R-unit;
  Phase 2 and W1.1 remain blocked.

---

## Standing prohibitions during R0–R9

- No Phase 2 work, no W1.1 work, no application code/test/schema/fixture/
  configuration/data changes under this plan.
- No edits to the published v1.1 canon on `main` (its checksum is evidence);
  all v2.0 drafting happens on `architect/cba-canon-v2`.
- No Linear status/priority/assignment changes from repair sessions;
  comments only, with commit hashes and validation actually run.
