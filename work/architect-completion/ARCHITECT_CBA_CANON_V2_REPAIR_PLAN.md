# Architect CBA Canon v2.0 — Repair Plan (R1–R9)

**Status:** Approved plan; **no repair work started.**
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

1. **Separate fresh sessions.** R1–R8 each run in a fresh session with a
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
   cannot support a rule, classify it OPS/DERIVED/EXT — never fill the gap
   with a secondary source.
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
  corrected (CBA-cite + DERIVED, and DERIVED/OPS for re-trade conditional
  cash); §8.1 rewritten as the ten enumerated adjustments; scenarios 50, 53,
  57, 60, 67, 68, 69 corrected; edition header updated to v2.0-draft with an
  amendment log entry.
- **Validation gate:** each correction quotes or precisely cites the signed
  text; `npm run lint:md` passes (MD029 exception for §16 stands).
- **Explicit exclusions:** no register restructuring, no renumbering, no
  scenario additions beyond the listed corrections, no code, no Linear.
- **Dependency:** none (first unit).
- **Stop condition:** stop if any correction cannot be anchored to the signed
  text — record it as unresolved instead of guessing.

## R2 — Register standard (atomicity, deduplication, ownership, locators, verification)

- **Inputs:** Adjudication §3 (defect patterns), canon §15.6, §1.1–1.2.
- **Authorized files:** new
  `work/architect-completion/ARCHITECT_CBA_CANON_V2_REGISTER_STANDARD.md`.
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

## R3 — Re-register and source-certify the A-series

- **Inputs:** R1 canon text, R2 standard, adjudication duplicate/atomicity
  lists for A01–A21.
- **Authorized files:** canon §15 A-series register and §16 scenario column
  references; a per-unit certification receipt in
  `work/architect-completion/`.
- **Required primary authorities:** CBA Articles VII §§2, 3, 6(j), 8; XII;
  XXIV; BYL §§4, 7.03; official releases for annual values.
- **Required output:** A-series re-registered per R2 (dedupe, split,
  re-parent) with a precise locator on **every** A-series LEAF; each locator
  verified against the primary text at assignment (this is the per-LEAF
  certification); counts recomputed mechanically.
- **Validation gate:** mechanical parser shows zero duplicate owners, zero
  multi-obligation leaves, every LEAF carries a locator; every locator
  spot-checkable against the cited page.
- **Explicit exclusions:** no C/R/L/S edits; no scenario rewrites (R7).
- **Dependency:** R1, R2.
- **Stop condition:** any A-series rule that fails primary verification is
  corrected via the R1 mechanism (amendment log entry) or reclassified
  OPS/DERIVED/EXT — never left silently.

## R4 — Re-register and source-certify the C-series, first half (C01–C13)

- Same **inputs/authorities/gate/exclusions/stop condition** pattern as R3,
  scoped to C01–C13.
- **Required primary authorities (principal):** CBA VII §§2(c), 2(d), 2(e),
  4, 6; Article II; official releases.
- **Dependency:** R1, R2 (R3 not strictly required but recommended order).
- Note: this half contains the MTS (C10) and Apron (C07) rewrites from R1
  and the C07.6 split into enumerated adjustments (vi) and (vii).

## R5 — Re-register and source-certify the C-series, second half (C14–C25)

- Same pattern, scoped to C14–C25.
- **Required primary authorities (principal):** CBA Articles II §§3–12,
  VII §§3, 5, 7; VIII–IX; XI; XII; Exhibits B and C.
- **Dependency:** R1, R2, R4 (C-series numbering must be settled in order).
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
  projection only); L01.5's calendar bundle decomposed per R2.
- **Dependency:** R1, R2 (numbering after R5).

## R7 — Rebuild semantic acceptance-scenario coverage

- **Inputs:** the completed v2.0 register (R3–R6), Adjudication §4.
- **Authorized files:** canon §16 and the register's Scenario column.
- **Required primary authorities:** the locators already certified in R3–R6.
- **Required output:** every scenario states input, boundary, and expected
  result; every SCEN leaf maps to a scenario that actually exercises it;
  missing coverage added (exception proration, signing-bonus-as-cash,
  five window restrictions, circumvention/tampering EXT states, Bird-clock
  transfer and waiver reset, October 31 rookie-option boundary,
  protection-increase limits, loan-interest/premium cases); defective
  mappings from Adjudication §4 removed or re-pointed; stable scenario
  numbering preserved for unchanged scenarios 1–46 where their content
  survives R1 corrections.
- **Validation gate:** mechanical map shows every SCEN leaf ↔ at least one
  scenario that names its condition; no scenario cited by a leaf it does not
  exercise.
- **Explicit exclusions:** no register content changes beyond the Scenario
  column; no tests written (that is Phase 2).
- **Dependency:** R3–R6 complete.
- **Stop condition:** a leaf with no honest scenario gets its method
  reclassified (STATIC/LIFECYCLE/EXTS) rather than a cosmetic mapping.

## R8 — Reconcile code map, dependencies, datasets, receipts, and final checksum

- **Inputs:** v2.0 register and scenarios (R3–R7), Adjudication §7–§8.
- **Authorized files:**
  `work/architect-completion/ARCHITECT_CBA_CANON_CODE_MAP.md` (superseding
  edition), migration/amendment receipt for v2.0,
  `docs/reference/cba/README.md` (status update only).
- **Required primary authorities:** none new; repository inspection.
- **Required output:** code map remapped to the v2.0 register; A04/A05/A07
  pointers corrected to the operative sites (`tradeMachine/utils/
  matchingValues.ts` BYC/poison-pill/kicker code); C22.1–.3 re-marked NO
  SITE or pointed to real sites; W4.1/W4.2 reordered (or C14 moved forward /
  Bird-status prerequisite extracted) so the "no unit depends on a later
  one" claim is true; stale "uncommitted / nothing pushed" language removed
  from receipts; dataset provenance table finalized; v2.0 SHA-256 recorded
  in the receipt and code map; all counts recomputed mechanically.
- **Validation gate:** mechanical reconciliation (every LEAF exactly once in
  map and packets); dependency table has no unit depending on a later unit;
  lint:md passes.
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
  coverage; primary-source integrity including per-LEAF locator sampling;
  code map/execution plan) with an explicit ACCEPT or REJECT.
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
