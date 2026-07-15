# The Architect — CBA & Transaction Rules Canon

**Edition:** Canon v2.0 — **WORKING DRAFT** (R1–R9 repair in progress; not accepted, not an active audit oracle)  
**Purpose:** The all-in-one Cap Manager + Trade Machine reference, implementation checklist, and acceptance-test canon for ScoutZero's Architect  
**Authority cutoff:** July 12, 2026  
**Current Salary Cap Year:** 2026–27  
**Discovery source:** [The CBA Guide](https://cbaguide.com/) — useful for finding issues, but never controlling  
**Primary authorities:** [2023 NBA–NBPA Collective Bargaining Agreement](https://ak-static.cms.nba.com/wp-content/uploads/sites/4/2023/06/2023-NBA-Collective-Bargaining-Agreement.pdf) and [June 2024 NBA Constitution and By-Laws](https://official.nba.com/wp-content/uploads/sites/4/2024/06/NBA-Consitution-By-Laws-June-2024.pdf)  
**Official explanatory source:** [NBA 2024–25 CBA 101](https://official.nba.com/wp-content/uploads/sites/4/2024/11/2024-25-CBA-101.pdf)  
**Annual-value sources:** NBA Communications releases for [2026–27](https://pr.nba.com/2026-27-salary-cap/), [2025–26](https://pr.nba.com/nba-salary-cap-2025-26-season/), [2024–25](https://pr.nba.com/2024-25-nba-season-salary-cap/), and [2023–24](https://pr.nba.com/nba-salary-cap-for-2023-24-season-set-at-136-021-million/)  
**Amendment date:** July 15, 2026  
**Provenance — v1.0 (historical):** SHA-256 `b8cf5d01356b3a83de4663f5bd6843e9aa58c8c06a84227385ae93bc02d969ef`. Its "primary-source-verified" claim was later falsified in part by the independent v1.1 acceptance review and adjudication; the checksum is preserved as historical evidence.  
**Provenance — v1.1 (historical, rejected):** SHA-256 `4a0760c81d7a5e95919a0373d5ff631b565d064d56b858fe3b8869ad2b6bb3f6`, published at commit `9814939c` and **rejected** as an active audit oracle by an independent acceptance review, upheld on adjudication (see `docs/reference/cba/README.md`).

**What v1.1 changed (historical):** the **index only**. v1.1 added audit IDs, sub-IDs, verification-method classifications, acceptance scenarios, and cross-references; it changed no CBA rule and renumbered no existing ID or scenario. The register is a two-level tree: **GROUP** nodes are navigation anchors, and **LEAF** nodes are the 368 independently auditable obligations that form the entire audit universe (§15.6). Because the checksum of a file cannot be stated inside that file, the v1.1 checksum of record was published in `work/architect-completion/ARCHITECT_CBA_CANON_CODE_MAP.md` and `work/architect-completion/ARCHITECT_CBA_CANON_V1_1_MIGRATION.md`.

**What v2.0 changes (this working draft):** substantive rule repair against the signed CBA under the approved R1–R9 plan (`work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md`). R1 corrects the seven adjudicated substantive rule errors and two authority labels, and rewrites scenarios 50, 53, 57, 60, 67, 68, and 69; no ID or scenario is renumbered. R2 adds the binding v2.0 register and source-certification standard (§15.9) and the register release gates that R3–R8 must satisfy; it changes no rule, register row, scenario, ID, or source value. R1.1 closes the adjudicated residual R1 defects — the VII §5(b)(1) Unlikely-Bonus provisos stated in full, the signing/trade-earned/extension bonus-allocation scope per VII §3(b)(1)(ii)–(b)(3), MTS shortfall-payment terminology with the 2023–24-only §2(c)(7) exception, and explicit provisional markers on the A11/A18.7 authority labels pending R2.1 — and repairs the four scenarios with confirmed logic errors (50, 60, 67, 69). R2.1 **replaces the rejected R2 foundation in full** with the clean v2 registry model (§15.9, R2.1 edition): the published v1.1 register and scenarios 1–89 are frozen as historical migration inputs; active v2 obligations are new `CBA2-…` GROUP/LEAF IDs linked to history by a typed `XW2-…` crosswalk; evidence lives in a structured source-artifact/evidence-component registry; the authority taxonomy adds **INFERRED** and closes the A11/A18.7 provisional items; every active LEAF carries one primary and any number of secondary verification methods; the scenario library will be rebuilt as `CBA2-SC-…` with an `SXW2-…` crosswalk; and the release gates are retimed across R3–R6/R7/R8/R9. R2.2 **hardens that foundation** after the independent review of R2.1: historical scenario identity is pinned to the published v1.1 §16 section at `9814939c` (with its exact byte hash recorded, and the R1/R1.1 scenario variants reclassified as R7 authoring inputs only); crosswalk edge typing gains a deterministic precedence with exactly one primary relationship type per source–target pair; `no-successor` becomes a narrow, gateable disposition that can never hide an in-scope obligation; the evidence schema supports zero/one/many source artifacts and multi-component dependency chains with typed `SRC2-…` provenance (including OPS provenance without a public URL and EXT runtime-determination contracts); duplicate-candidate generation becomes mandatory and seven-generator systematic; new gates SC6/SC7 and G14/G15 close the scenario-coverage, method-record, evidence-reconciliation, and amendment-traceability holes; R7's method-reclassification authority is bounded and `METHOD`-recorded; the R3→R4→R5→R6 construction sequence is strict; `AMEND` decision records preserve draft-correction traceability; and the remaining old-ID audit guidance (§1.2, §17) and legacy §19.3 family-status ambiguity are removed. R1.2 closes an omission the independent Codex foundation review found in R1.1's extension-bonus correction: §5.9 now states the below-cap branch of VII §3(b)(3)(ii) in which the bonus is paid **no sooner than** the first day of the extended term's first Salary Cap Year — allocated under §3(b)(3)(i)'s extended-term-only protected-percentage rules with the zero-protection fallback to the extended term's first Salary Cap Year, never under ordinary §3(b)(2) allocation — keeping the three §3(b)(3) branches distinct. R2.3 corrects the five foundation execution contracts the same independent Codex foundation review ordered: every `EV2-…` evidence path now terminates in at least one typed `SRC2-…` source/provenance record — no source-free terminal component; OPS components reference an `ops-provenance` record and EXT components an `ext-contract` record, each valid without a public URL (and without an artifact hash only where no durable artifact exists) — with class-specific certification duties replacing the universal read-the-passage rule; secondary sources become discovery/corroboration aids only — secondary reporting establishes no authority class, and OPS requires qualifying first-party operational provenance; SC2 expands from historical-scenario coverage alone to the complete sixteen-check SXW2 integrity contract, rerun in full by G10 and R9; draft mutability and `AMEND` lineage extend to every live v2 population (active GROUP/LEAF rows, `XW2-…`, `SRC2-…`, `EV2-…`, active `CBA2-SC-…` scenarios and named cases, `SXW2-…`, `DR2-…`) with append-only precisely defined and G15/R9 expanded accordingly; and the three register populations are stated distinctly — the published v1.1 register at `9814939c` (the sole XW2 historical source), this branch's legacy-numbered working copy (an R1/R1.1-corrected, R2.1-annotated authoring input, not byte-identical to the published edition), and the active v2 registry — correcting the earlier preserved-unchanged wording. R2.4 closes the four residual foundation blockers found by the independent Codex review of R1.2/R2.3: the `SRC2-…` registry becomes a mechanically parseable base-plus-type-specific-detail record contract with pinned field grammars, per-type `—` validity, per-type timestamp/hash rules, and field-level validation enforced at U8/U9, G14, and R9; a binding transitive evidence-root compatibility model (complete dependency closure, terminal `SRC2-…` root sets, a parseable class compatibility matrix, and rejection of locally valid but transitively incompatible chains) stops OPS/EXT provenance from laundering into DERIVED/INFERRED authority and forces OPS/EXT visibility and limitation propagation to every consuming LEAF; every binding secondary-source-to-OPS promotion is removed — the §1.1 conflict order now ends at official authority, and the multi-team touch/qualifying-asset thresholds (§12.2), the seven-future-draft horizon, and the secondary-reported pick-protection/deferral processing mechanics (§13.3) are recast as **unsupported operational candidates** that cannot be registered, classified OPS, or enforced without qualifying first-party provenance or a different valid authority classification; and the AMEND child-numbering contradiction is resolved — contiguity applies at initial GROUP construction only, an `AMEND` removal/split/merge leaves a gap that must resolve through the receipts and `AMEND` chain, renumbering-to-restore-contiguity is abolished, IDs are never reused, and new children allocate above the GROUP's historical high-water mark (§15.9.2, U13, G15, R9). R2.5 closes the two SRC2 grammar blockers found by the independent Codex review of R2.4: the official-mutable "date or season" alternative is pinned to exactly one machine season grammar — `YYYY-YY` (four ASCII digits, one ASCII hyphen-minus, two ASCII digits equal to the last two digits of the following year modulo 100; en dashes, slashes, prefixes, abbreviated or four-digit second years, and non-consecutive years all invalid; source-title typography may be preserved but every structured season field normalizes to `YYYY-YY`) — and the unparseable composite `Verifier/session/date` base field is split into three separately required, individually typed columns (`Verifier identity` as `human:<slug>`/`agent:<slug>`, `Verification session ID` as `session:<slug>`, `Verification date` as a real `YYYY-MM-DD` calendar date), growing the base table from eleven to thirteen pinned fields, each independently parsed and validated at U8/U9, G14, and R9 — none ever `—`, and no nonempty field compensating for a missing or malformed one. The authority cutoff remains **July 12, 2026**. **This draft is not accepted and must not govern Phase 2 verdicts, implementation decisions, or tests**; the v2.0 checksum will be recorded only at R8, and activation requires a new independent Reviews A–F acceptance gate (R9).

> **Use rule:** Architect may rely on a rule as deterministic only when the required inputs exist and the rule is marked **CBA**, **BYL**, **NBA**, **DERIVED**, or **INFERRED** under the authority system below. A **DERIVED** item is arithmetic reproduced from a source formula; an **INFERRED** item is non-arithmetic legal or algorithmic inference supported by controlling primary-source text and must carry its locators and reasoning chain, never presented as express source language. An **OPS** item is a league-operational rule with real first-party operational provenance (§15.9.6) for which no current public primary text was located; secondary reporting never establishes it, and it must remain configurable and must not be represented as language from the CBA. An **EXT** item requires a league, physician, expert, or legal determination.

| Edition | Date | Change |
|---|---|---|
| Discovery benchmark | July 12, 2026 | CBAguide category inventory and initial Architect checklist |
| **Verified canon v1.0** | **July 12, 2026** | Primary-source hierarchy; signed-CBA/By-Laws verification; 2026–27 parameters; corrected formulas, deadlines, apron, roster, DPE, waiver, and pick rules; OPS/EXT separation; release gate |
| Verified canon v1.0 (checksum of record) | July 12, 2026 | SHA-256 `b8cf5d01356b3a83de4663f5bd6843e9aa58c8c06a84227385ae93bc02d969ef` — preserved as the provenance anchor for the independent primary-source verification |
| **Index amendment v1.1** | **July 14, 2026** | **Index only.** 14 new top-level IDs (A19–A21, C19–C25, S01–S04) and 357 sub-IDs, forming a 427-node register of 59 GROUP anchors and **368 auditable LEAF obligations**; a verification method for every LEAF; and acceptance scenarios 47–89. No rule, formula, value, deadline, authority label, or source interpretation changed; no existing ID or scenario renumbered |
| Canon v1.1 rejection | July 14, 2026 | v1.1 rejected as the active audit oracle by an independent acceptance review (Codex), upheld by independent adjudication (Claude); preserved as a historical edition with checksum `4a0760c8…` — see `docs/reference/cba/README.md` |
| **Repair v2.0 — working draft, R1** | **July 14, 2026** | **R1 substantive corrections against the signed CBA:** incentive-cap denominator to Regular Salary (II §12(a)(i); VII §5(b)(1)); signing-bonus allocation to the lack-of-skill-protected percentage of Base Compensation (VII §3(b)(2)); ETO effectiveness no earlier than the end of the fourth season (XII §2(b)); Two-Way Advance permitted and conversion beginning on July 1 (II §11(a)(v), §11(f)); Minimum Team Salary payment and Team Salary charge on their separate bases (VII §2(c)(1)–(3),(5)); §8.1 rewritten as the ten enumerated Apron Salary adjustments (VII §2(e)(1)(i)–(x)); SRPE Team Option carve-out added (XII §1(v)); A11 and A18.7 authority labels corrected to cite + DERIVED/OPS; scenarios 50, 53, 57, 60, 67, 68, 69 rewritten. No ID or scenario renumbered. **Draft only — not accepted; checksum to be recorded at R8** |
| **Repair v2.0 — working draft, R2** | **July 14, 2026** | **R2 register and source-certification standard (§15.9):** three node roles (GROUP / LEAF / RETIRED-ALIAS), the atomicity test, canonical-ownership and deduplication rules, append-only stable-identifier migration, the per-LEAF source-locator standard for CBA/BYL/NBA/DERIVED/OPS/EXT chains, verification-method assignment and evidence minima, the register row schemas, and the mechanical + semantic register release gates that R3–R8 must satisfy. Standards only — no rule, register row, scenario, ID, source value, or code mapping changed. Receipt: `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_REGISTER_STANDARD.md`. **Historical — this identity model (in-place `CBA-…` migration, RETIRED/ALIAS, PHANTOM, LEAF→GROUP conversion) was rejected on independent review and is superseded in full by R2.1; the receipt is preserved unchanged as review history** |
| **Repair v2.0 — working draft, R1.1** | **July 14, 2026** | **R1.1 residual corrections against the signed CBA:** VII §5(b)(1)'s two Unlikely-Bonus provisos stated in full (extension carry-forward; renegotiation bar) in §3, §5.9, C23.1, and C23.4; trade-earned signing-bonus allocation limited to the then-current and remaining Salary Cap Years (VII §3(b)(1)(ii)–(b)(2)) with §5.9, §12.7, A07.2, A07.8, and C18 conformed to the protected-percentage basis; the distinct VII §3(b)(3) extension-bonus rules added to §5.9; "player payment" renamed the MTS shortfall payment (team → NBA; §2(c)(6) equal redistribution) with the 2023–24-only §2(c)(7) exception noted in §8.7, C10.3, and scenario 60; A11/A18.7 authority labels marked provisional pending R2.1; scenarios 50, 60, 67, and 69 rewritten with dated, numbered, discriminating variants (VII §6(j)(4)(i); VII §2(c)(1)–(7); VII §3(b)(2); VII §7(a)(2)(ii)). No ID or scenario renumbered. Receipt: `work/architect-completion/ARCHITECT_CBA_CANON_V2_R1_1_CORRECTIONS.md` |
| **Repair v2.0 — working draft, R2.1** | **July 15, 2026** | **R2.1 replacement register and source-certification standard (§15.9, R2.1 edition), superseding the rejected R2 identity model in full:** the published v1.1 registry (`CBA-…`, 368 LEAFs at checksum `4a0760c8…`) and scenarios 1–89 frozen as historical migration inputs; a clean active namespace (`CBA2-<F><NN>` GROUPs, `CBA2-<F><NN>.<n>` LEAFs — every active obligation a LEAF with a fixed GROUP parent, roles fixed at minting); a typed many-to-many historical crosswalk (`XW2-…`; equivalent/split/merge/partial-overlap/moved/process-only/invalid/no-successor) with true-gap companion records; a structured evidence registry (`SRC2-…` source artifacts, `EV2-…` per-LEAF authority-component rows); the seven-class authority taxonomy adding **INFERRED** (DERIVED restricted to arithmetic; DERIVED/OPS composites banned) and closing the A11/A18.7 provisional items; exactly one primary plus any number of secondary verification methods; the `CBA2-SC-…` scenario namespace with an `SXW2-…` scenario crosswalk (R7 rebuild); and release gates retimed to R3–R6 unit-local / R7 scenario / R8 global / R9 independent acceptance. Standards and taxonomy-closure annotations only — no register row added, removed, renumbered, split, merged, or re-parented; no ID or scenario migrated; historical scenarios 1–89 unchanged. Receipt: `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_1_REGISTER_STANDARD.md` |
| **Repair v2.0 — working draft, R2.2** | **July 15, 2026** | **R2.2 foundation hardening** (ordered after the independent Codex review of R2.1 rejected the foundation gate while accepting the clean v2 architecture in direction): historical scenario identity pinned to the published v1.1 §16 scenario section at `9814939c` (SHA-256 `5289f6b812c2d86238674461574c725e894f0bca0db4da188b276246d96706aa`, 14,390 bytes), with the R1/R1.1 corrected scenario variants reclassified as R7 authoring inputs that never redefine historical scenario numbers; deterministic XW2/SXW2 edge-typing precedence with worked examples and a duplicate-pair ban; the narrow gateable `no-successor` rule; the `EV2-…` multi-source/dependency reference grammar and the typed `SRC2-…` provenance vocabulary (`official-immutable` / `official-mutable` / `ops-provenance` / `ext-contract`); mandatory seven-generator duplicate-candidate population; new gates SC6 (SCEN coverage completeness), SC7 (R7 `METHOD` records), G14 (global evidence reconciliation), and G15 (amendment-chain integrity); `METHOD` and `AMEND` decision-record types; strict R3→R4→R5→R6 sequencing; §1.2/§17 Phase 2 verdict keying restricted to active `CBA2-…` LEAFs; §19.3 marked as legacy family-level status pending per-LEAF certification. Standards only — no register row, scenario, ID, or source value changed. Receipt: `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_2_FOUNDATION_HARDENING.md` |
| **Repair v2.0 — working draft, R1.2** | **July 15, 2026** | **R1.2 extension-bonus allocation branch** (ordered after the independent Codex foundation review of R1.1/R2.1/R2.2 at commit `6aa616fd` returned REJECT/BLOCK-R3, finding that canon §5.9 and the immutable R1.1 receipt omitted one branch of signed CBA VII §3(b)(3)(ii)): §5.9's extension-bonus rule now states the three §3(b)(3) branches distinctly — at/over-cap (§3(b)(3)(i)); below-cap with the bonus paid **no sooner than** the first day of the extended term's first Salary Cap Year, allocated under §3(b)(3)(i)'s extended-term-only protected-percentage rules with the zero-protection fallback to the extended term's first Salary Cap Year and never under ordinary §3(b)(2) allocation (§3(b)(3)(ii), second sentence); and below-cap early payment with the combined-term allocation, deemed Renegotiation, and two-installment rules (§3(b)(3)(ii)(A)–(C)). No ID, register row, scenario, source value, or §15.9 standard changed; the R1.1 receipt remains immutable. Receipt: `work/architect-completion/ARCHITECT_CBA_CANON_V2_R1_2_EXTENSION_BONUS_CORRECTION.md` |
| **Repair v2.0 — working draft, R2.3** | **July 15, 2026** | **R2.3 foundation-contract corrections** (ordered by the same independent Codex foundation review that ordered R1.2): typed evidence roots — every `EV2-…` evidence path terminates in at least one typed `SRC2-…` source/provenance record, no `EV2-…` row with both reference fields empty, OPS components referencing an `ops-provenance` record and EXT components an `ext-contract` record (each valid without a public URL, and without an artifact hash only where no durable artifact exists), class-specific certification replacing the universal read-the-passage rule, and U8/U9/G14/R9 enforcing typed termination, pairings, acyclicity, and exact Authority ⇔ EV reconciliation; the strict secondary-source policy — secondary reporting establishes no authority class, OPS requires qualifying first-party operational provenance (§15.9.6), with §1.1, §15.9, §19.1, and the repair plan swept; SC2 expanded to the complete sixteen-check SXW2 integrity contract (grammar, uniqueness, type vocabulary, pinned 1–89 sources, complete coverage, target/terminal discipline, decision-record resolution, duplicate-pair ban, deterministic precedence, narrow no-successor, parseable scope), rerun in full by G10 and R9; all-population draft mutability and `AMEND` lineage (active GROUP/LEAF, `XW2-…`, `SRC2-…`, `EV2-…`, active `CBA2-SC-…` scenarios/named cases, `SXW2-…`, `DR2-…`) with append-only precisely defined and G15/R9 expanded; and the three-register-population distinction (the published `9814939c` register as sole XW2 source; the branch's legacy-numbered working copy as authoring input only, not byte-identical to the published edition; the active v2 registry) correcting the earlier preserved-unchanged wording. Standards and status/annotation corrections only — no register row, scenario, ID, or source value changed; no concrete CBA2/XW2/SXW2/SRC2/EV2/DR2 record created. Receipt: `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_3_FOUNDATION_CONTRACT_CORRECTIONS.md` |
| **Repair v2.0 — working draft, R2.4** | **July 15, 2026** | **R2.4 remaining foundation-blocker closure** (ordered after the independent Codex review of R1.2/R2.3 at commit `c2228607` returned REJECT/BLOCK-R3 while expressly passing R1.2's source law, R2.3's SC2/SXW2 integrity gate, and the historical-register population distinction): the `SRC2-…` registry restated as a type-specific, mechanically parseable contract — a shared eleven-field base table plus one pinned detail table per provenance type, a pinned field grammar for every multi-value field, `—` validity defined per provenance type, binding timestamp/hash rules (durable bytes always hashed; retrieval timestamps whenever content was retrieved; authentication timestamps for every non-public verification; an artifactless OPS record never `—` for both provenance identity and authentication), and field-level validation at U8/U9/G14/R9; a binding transitive evidence-root compatibility model — complete dependency closures and terminal root sets computed for every `EV2-…` component, a parseable class compatibility matrix, DERIVED/INFERRED barred from OPS/EXT roots, OPS/EXT visibility and limitation propagation to consuming LEAFs, and locally-valid-but-transitively-incompatible chains rejected; all remaining binding secondary-source-to-OPS promotion removed (§1.1 conflict order ends at official authority; §12/§12.2/§13/§13.3, the §15 evidence-pointer table, §17 Pass 1, §19.1, and the §19.3 continuity note recast the multi-team touch/qualifying-asset, seven-future-draft, and secondary-reported protection/deferral mechanics as unsupported operational candidates — preserved for discovery, never registrable, never OPS, never enforceable without qualifying first-party provenance); the child-ID numbering contradiction resolved (initial-construction-only contiguity; explained gaps via `AMEND` chains; no renumbering; no ID reuse; allocation above the historical high-water mark; U13/G15/R9 conformed); and the residual §1.2/§17 `source artifacts` verdict-exclusion wording updated to `source/provenance records`. Standards, source-policy, and status corrections only — no register row, scenario, ID, or source value changed; no concrete CBA2/XW2/SXW2/SRC2/EV2/DR2 record created; §5.9 and the sixteen-check SC2 contract byte-preserved. Receipt: `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_4_FOUNDATION_CONTRACT_CLOSURE.md` |
| **Repair v2.0 — working draft, R2.5** | **July 15, 2026** | **R2.5 SRC2 field-grammar closure** (ordered after the independent Codex review of R2.4 at commit `e0344aac` returned REJECT/BLOCK-R3 while passing transitive evidence-authority compatibility, the secondary-source/OPS policy, AMEND numbering, source/provenance terminology, R1.2's source law, SC2/SXW2 integrity, the historical-register population separation, and scope/preservation): the official-mutable publication "date or season" alternative pinned to exactly one accepted machine season grammar, `YYYY-YY` (`2026-27` and `1999-00` valid; `2026–27`, `2026/27`, `FY26`, `26-27`, `2026-28`, and `2026-2027` invalid; source-title typography preservable but every structured season field normalized), applied identically in the base schema, the `official-mutable` detail schema, the per-type validity matrix, the NBA per-class minima, and U8/U9/G14/R9; and the unparseable composite `Verifier/session/date` base field abolished and split into three separately required, individually typed columns — `Verifier identity` (`human:<slug>`/`agent:<slug>`), `Verification session ID` (`session:<slug>`; a receipt-scoped deterministic identifier suffices, no confidential provider session identifier required), and `Verification date` (real `YYYY-MM-DD` calendar date) — growing the base table to thirteen pinned fields, each mandatory for every provenance type, never `—`, independently parsed and validated, with no nonempty field compensating for a missing or malformed one. Grammar and status corrections only — no register row, scenario, ID, or source value changed; no concrete CBA2/XW2/SXW2/SRC2/EV2/DR2 record created; §5.9, §15.1–§15.8, scenarios 1–89, and the sixteen-check SC2 contract byte-preserved. Receipt: `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_5_SRC2_GRAMMAR_CLOSURE.md` |

---

## Contents

1. [How to use this document](#1-how-to-use-this-document)
2. [Executive findings](#2-executive-findings)
3. [Source reliability and corrections](#3-source-reliability-and-corrections)
4. [Required system model](#4-required-system-model)
5. [Contract types and contract terms](#5-contract-types-and-contract-terms)
6. [Team Salary, cap holds, and room](#6-team-salary-cap-holds-and-room)
7. [Salary Cap exceptions and Bird rights](#7-salary-cap-exceptions-and-bird-rights)
8. [Aprons, hard caps, tax, and minimum team salary](#8-aprons-hard-caps-tax-and-minimum-team-salary)
9. [Roster rules](#9-roster-rules)
10. [Free agency, RFA, extensions, and renegotiations](#10-free-agency-rfa-extensions-and-renegotiations)
11. [Waivers, dead salary, buyouts, and set-off](#11-waivers-dead-salary-buyouts-and-set-off)
12. [Trade Machine rules](#12-trade-machine-rules)
13. [Draft picks, draft rights, and Stepien](#13-draft-picks-draft-rights-and-stepien)
14. [Calendar and lifecycle events](#14-calendar-and-lifecycle-events)
15. [Architect coverage-audit register](#15-architect-coverage-audit-register)
16. [Acceptance-test library](#16-acceptance-test-library)
17. [Recommended comparison sequence](#17-recommended-comparison-sequence)
18. [Rules requiring external determination](#18-relevant-rules-that-should-not-become-automatic-verdicts)
19. [Authority map and source index](#19-authority-map-and-source-index)

## 1. How to use this document

This is the comparison canon, not a claim about what Architect currently supports. Its job is to define the Cap/Roster/GM rule universe that matters to a serious NBA Cap Manager and Trade Machine and to make each rule traceable, testable, and implementable. A repository/product audit should compare Architect against this canon and classify every item as:

1. **Covered and proven** — represented, calculated, enforced, explained, and tested as appropriate.
2. **Partially covered** — some behavior exists, but a calculation, lifecycle, explanation, or edge case is absent.
3. **Not covered but in scope** — a real product gap.
4. **Intentionally excluded** — outside the current product contract or phase.
5. **Data-blocked** — supported in principle but current data does not carry the fields needed to evaluate it.
6. **Externally adjudicated** — cannot be determined automatically without a league, physician, expert, or legal ruling; Architect should represent the state or require an explicit assumption.

That distinction matters. A missing contract-authoring control is not the same as incorrect cap math. A lifecycle feature that has not been built is not necessarily a trade-validator bug. A rule that requires a league determination should not be presented as a deterministic failure.

### 1.1 Authority and confidence system

| Label | Meaning | Can drive an automatic verdict? |
|---|---|---|
| **CBA** | Express rule in the signed 2023 NBA–NBPA CBA, including its exhibits | Yes, when inputs are complete |
| **BYL** | Express rule in the June 2024 NBA Constitution and By-Laws | Yes, when inputs are complete |
| **NBA** | Official annual level, calendar, or explanatory publication | Yes for the published value/date; the signed agreement controls a wording conflict |
| **DERIVED** | Arithmetic reproduced directly from a CBA/BYL/NBA formula and published inputs — arithmetic only | Yes; retain formula, inputs, rounding policy, and derivation test |
| **INFERRED** | Non-arithmetic legal or algorithmic inference supported by controlling primary-source text | Yes, when the controlling locators and the stated inference chain are recorded; never presented as express source language |
| **OPS** | League-operational rule with real first-party operational provenance (§15.9.6), not located in a current public primary document; secondary reporting never establishes it | Only as a configurable operational rule; show provenance and permit league-rule updates |
| **EXT** | Requires medical, league, expert, arbitral, or legal determination | No; consume an explicit decision/assumption |

**Conflict order:** signed CBA → current Constitution/By-Laws for league-governance rules → official annual NBA release → official CBA 101 explanation. The controlling-authority hierarchy ends with legitimate official authority. CBA 101 is authoritative explanatory material, not a substitute for the signed text. Secondary and discovery sources (CBAguide, media reports, expert summaries) sit **outside** this hierarchy entirely: they never rank in it, never resolve a conflict, and never establish any authority class (§15.9.6). CBAguide is a discovery/indexing source only.

**Citation convention:** `CBA VII.6(j)(1)(iv), CBA pp. 241–42` means Article VII, Section 6(j)(1)(iv), using the page number printed in the agreement. `BYL 7.03, p. 78` means the NBA Constitution/By-Laws. Page references are supplied to make human verification repeatable; article/section identifiers should be stored as the durable key.

### 1.2 Rule-record contract for Architect audits

Every audit finding or implemented rule should preserve:

| Field | Required content |
|---|---|
| Stable ID | An active v2 LEAF ID (`CBA2-…`, §15.9.2). After R9 ACCEPT, every Phase 2 verdict is keyed **only** to an active `CBA2-…` LEAF; historical `CBA-…` IDs appear only in history/crosswalk references; GROUPs, scenarios, crosswalk edges, source/provenance records, evidence components, and decision records never receive compliance verdicts |
| Rule and scope | Plain-language rule, transaction types, teams/players affected |
| Authority | Label plus article/section/page or official release URL |
| Inputs | Data fields and explicit `asOfDate`/Salary Cap Year |
| Outputs | Each affected ledger, eligibility state, restriction, and expiration |
| Verdict behavior | Allow, block, warn, assumption required, or not applicable |
| Explanation | Numbers, responsible team, failed condition, and remedy |
| Tests | Boundary, lifecycle, cross-ledger, and regression scenarios |
| Version | Authority cutoff and season parameter set used |

If a source changes, update the source/parameter layer and rerun the tests; do not silently edit a hard-coded result.

### Coverage means more than knowing a rule

For each applicable item, the later audit should ask five separate questions:

| Layer | Coverage question |
|---|---|
| Representation | Does the data model preserve every input the rule needs? |
| Calculation | Does Architect compute the correct monetary or roster effect? |
| Enforcement | Does the relevant transaction fail when the rule prohibits it? |
| Explanation | Does the UI identify the responsible team, rule, numbers, and available remedy? |
| Lifecycle | Does the state update correctly after dates, options, guarantees, waivers, trades, or other events? |

## 2. Executive findings

The source review produces several high-level conclusions.

1. **Architect needs multiple independent ledgers.** “Salary” is not one reusable number. Team Salary, Apron Salary, Tax Salary, incoming trade salary, outgoing trade salary, player compensation, cash-in-trade, and dead salary can all differ for the same player.
2. **Time is a first-class rule input.** The legal result can change on July 1, the start of the regular season, January 5, January 8, January 10, January 15, March 1, March 4, March 10, the trade deadline, the end of the regular season, June 29, and other event-driven dates.
3. **Transactions create future constraints.** Hard caps, trade restrictions, TPE expiration, frozen picks, Bird-rights changes, roster-shortage clocks, and tax/repeater history persist beyond the transaction that created them.
4. **Apron legality is transaction-specific.** Being above an apron does not simply disable every action. Each transaction has its own applicable apron level, and executing certain actions creates a hard cap.
5. **Trade matching under the 2023 CBA is formula-driven.** The current official Expanded TPE formula is not the older five-tier system previously associated with Architect. The CBA Guide also displays stale derived boundaries for 2025–26, so neither remembered tiers nor the guide's displayed tier boundaries should be copied into code.
6. **Roster legality is more than “14–15 players.”** It includes active/inactive lists, temporary 12/13-player windows, an active-list minimum, bench minimum, offseason maximum, two-way limits, Under-Fifteen Games, hardship exceptions, and transaction-time open-slot requirements.
7. **Several nuanced rules are core accounting, not cosmetic edge cases.** Non-guaranteed outgoing trade salary, poison-pill incoming salary, minimum-contract subsidy, trade-bonus allocation, pick cap holds, open-roster charges, exception cap holds, tax repeater history, and dead-salary treatment can materially change whether a transaction works.
8. **The CBA Guide is a strong discovery resource but a secondary source.** It contains several internal errors and inconsistencies documented below. Architect should store formulas and season parameters separately and anchor disputed rules to the official CBA.

## 3. Source reliability and corrections

The Guide is unusually useful because it organizes the CBA around practical front-office workflows and provides examples. It is not the controlling authority. The official CBA should decide conflicts.

### Confirmed Guide issues and corrections

| Topic | Guide presentation | Verified/correct treatment | Architect implication |
|---|---|---|---|
| Expanded TPE boundaries | For 2025–26, the Guide shows breakpoints at $7.25M and $29M while also using an $8.527M scaled cushion. | Official CBA Article VII §6(j)(1)(iv) defines a formula, not fixed boundaries. With a $250K cushion and the Guide's $8.527M scaled amount, the derived 2025–26 boundaries are approximately $8.277M and $33.108M. The Guide appears to retain 2023–24 boundaries while scaling only the cushion. | Implement the official formula. Never hard-code the Guide's displayed boundaries. |
| $250K TPE allowance test | CBA 101 uses “post-trade Team Salary” as shorthand in a summary footnote. | Signed CBA VII.6(j)(3) uses **post-assignment Apron Team Salary**; if it would exceed the First Apron, the $250,000 allowance in VII.6(j)(1)(i)–(v) becomes $0. | Signed text controls. Compute Apron Team Salary before selecting `K`. |
| Architect's remembered trade tiers | Prior Architect context references 200% / 175% / 150% / 125% / 110% tiers. | Those are not the current Expanded TPE structure in the 2023 CBA. | Treat as a critical audit item before trusting trade verdicts. |
| Disabled Player Exception medical test | The Guide summary says the player is substantially more likely than not “to return” by June 15. | Official CBA Article VII §6(c)(2) says the condition must make it substantially more likely than not that the player is **unable to play through** the following June 15. | Reverse logic would incorrectly grant/deny the DPE. Use the official wording. |
| TMLE amount | The Guide page introduces $5.685M for 2025–26 but later says $5.585M. | The internally consistent scaled amount is approximately $5.685M. | Season values must have one canonical source and validation. |
| Luxury-tax bracket width | The Guide says $5.585M in one paragraph and $5.685M in its worked table. | The scaled 2025–26 bracket is approximately $5.685M. | Do not duplicate constants across calculators. |
| One-year minimum contract exclusion | One Team Salary summary appears to list one-year minimum contracts as excluded, while the detailed rules correctly apply a subsidized cap amount. | The league-reimbursed excess is excluded; the qualifying two-year-veteran minimum amount still counts. | Model the subsidy component, not the whole contract as zero. |
| Non-guaranteed in-season trade wording | One Guide sentence describes multiplying by the “remaining” percentage while its example and official CBA reduce unearned unprotected salary, leaving earned/protected salary. | During the regular season through January 7, outgoing value is salary less unearned/unprotected compensation — effectively earned compensation plus any additional protected amount. | Use the official formula and test at 0%, 25%, and 100% elapsed. |
| DPE/TPE interaction | The Guide-derived draft could be read to bar a DPE-acquired replacement from later creating a TPE. | CBA VII.6(j)(7) bars a TPE from trading the **disabled player** when the team used a DPE in respect of that player during that cap year. It is not a blanket restriction on the replacement player. | Store the DPE's injured-player identity and apply the restriction to that player. |
| RFA option deadline | “June 25” is often described as the exercise date. | CBA XII.4 requires the option to be exercised **prior to June 25**—effectively no later than June 24. | Encode the legal comparison, not a loose date label. |
| Incentive limits | The Guide-focused draft captured only a 15% unlikely-bonus limit. | Incentive Compensation for a Season may not exceed 20% of the **Regular Salary** called for by the contract for that Season (CBA II §12(a)(i), p. 58); Unlikely Bonuses in a Salary Cap Year may not exceed 15% of the player's **Regular Salary** for that Salary Cap Year at the time the contract is signed, with two provisos: an Extension signed in a year whose Unlikely Bonuses already exceed the 15% percentage may carry up to that same percentage into the first year of the extended term, and no Renegotiation may increase Unlikely Bonuses past 15% of Regular Salary for any covered year (CBA VII §5(b)(1), p. 229). | Validate both caps and use the defined Regular Salary denominator — not Base Compensation. |
| Post-season dual-year apron test | A broad summary can imply every apron-limited action is tested in both cap years. | The special next-year test applies to the post-regular-season transactions identified in CBA VII.2(e)(2), summarized in CBA 101 II.E(2), not every apron-triggering action. | Gate the dual-year test by transaction type. |
| Frozen-pick measurement | “Above the Second Apron at season end” is imprecise. | Measure Apron Team Salary as of the start of the team's final regular-season game. The seventh-future pick freezes; the two-of-four slide and three-of-four unfreeze tests then apply. | Store the precise measurement event and four-year history. |
| Exhibit 9 risk | Describing Exhibit 9 as carrying no compensation risk is too broad. | A qualifying Exhibit 9 training-camp contract can carry a $15,000 injury termination fee while otherwise receiving the special Team Salary treatment. | Preserve the injury fee and eligibility prerequisites. |

### 3.1 Current and regression parameter sets

All amounts below are in millions of dollars. Official releases control the six published system/MLE values. Derived fields are calculated from the CBA's 2023–24 base-year formulas without intermediate rounding.

| Season | Cap | Minimum | Tax | First apron | Second apron | NTMLE | TMLE | Room MLE |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2024–25 | 140.588 | 126.529 | 170.814 | 178.132 | 188.931 | 12.822 | 5.168 | 7.983 |
| 2025–26 | 154.647 | 139.182 | 187.895 | 195.945 | 207.824 | 14.104 | 5.685 | 8.781 |
| **2026–27** | **164.961** | **148.465** | **200.428** | **209.015** | **221.686** | **15.044** | **6.064** | **9.366** |

**Expanded TPE derivation** — CBA VII.6(j)(1)(iv):

`max(min(2O + K, O + A), 1.25O + K)`, where `A = $7.5M × current cap / $136.021M` and `K = $0.250M` when allowed. The first crossover is `A − K`; the second is `4(A − K)`.

| Season | Derived `A` | First crossover | Second crossover | Derived tax-bracket width |
|---|---:|---:|---:|---:|
| 2023–24 | 7.500000 | 7.250000 | 29.000000 | 5.000000 |
| 2024–25 | 7.751818 | 7.501818 | 30.007271 | 5.167878 |
| 2025–26 | 8.527011 | 8.277011 | 33.108042 | 5.684674 |
| **2026–27** | **9.095709** | **8.845709** | **35.382838** | **6.063806** |

The $250,000 component becomes zero when post-assignment **Apron Team Salary** would exceed the First Apron (CBA VII.6(j)(3)). Dollar rounding belongs at the rule-defined final step; never round `A` before computing a crossover or legal maximum.

Additional 2026–27 derived/configured amounts:

| Item | 2026–27 value | Basis |
|---|---:|---|
| Bi-annual Exception | $5.476705M before publication rounding | 3.32% of cap; CBA VII.6(d)(1) |
| Separate cash-sent and cash-received limits | $8.495491M before publication rounding | 5.15% of cap; CBA VII.8(a) |
| EIPPA exclusion | $0.900M | Fixed CBA schedule, not cap indexed |
| Tax bracket width | $6.063806M before rule-defined rounding | $5M × cap / $136.021M |

Minimum-salary and Rookie Scale tables are separate season datasets prescribed by the CBA. Architect must load the complete applicable tables rather than infer them from a player's current salary or a single percentage.

### Parameter policy

All monetary values that rise with the cap should live in a season configuration layer. The engine should not embed 2025–26 example dollars in rule logic. At minimum, configure by Salary Cap Year:

- Salary Cap, tax line, First Apron, Second Apron, and minimum team salary line.
- Minimum salaries by years of service and contract year.
- Rookie scale by draft slot and contract year.
- NTMLE, TMLE, Room MLE, BAE, EIPPA, two-way salary/protection, Exhibit 10 limit, and cash-in-trade limit.
- Tax-bracket width and rates.
- Regular-season day count and all calendar deadlines.
- Expanded TPE scaled amount and any other cap-indexed values.

## 4. Required system model

### 4.1 Independent financial ledgers

| Ledger | Purpose | Common adjustments |
|---|---|---|
| Player compensation | What the player earns or is owed | Base compensation, bonuses, deferred compensation, protection, buyout, set-off |
| Team Salary | Determines room above/below the Salary Cap | Active contracts, dead money, cap holds, pending contracts, offer sheets, exception holds |
| Apron Salary | Determines apron eligibility and hard-cap compliance | Team Salary plus/minus the exact CBA VII.2(e)(1) adjustments; never a blanket “minus cap holds” shortcut |
| Tax Salary | Determines taxpayer status and tax bill | Earned unlikely bonuses, unearned likely bonuses, certain suspension reductions, post-season adjustments |
| Outgoing trade salary (OTS) | Sending team's trade-matching value | Non-guarantees, base-year compensation/sign-and-trade adjustment, team-bonus reclassification |
| Incoming trade salary (ITS) | Receiving team's trade-matching value | Minimum exception zero treatment, poison pill, trade bonus, team-bonus reclassification |
| Cash-in-trade | Tracks owner cash sent and received | Separate annual sent/received limits, conditional cash |
| Exception inventory | Tracks ability to sign/acquire | Amount, used portion, method allowed, apron ceiling, expiration, hard-cap effect |
| Dead-salary schedule | Tracks waived obligations | Protection, buyout allocation, stretch election, set-off reductions |

These ledgers should not share a single mutable `salary` field. They should be derived from canonical contract/event data for a specified transaction date and team context.

### 4.2 Rights and restrictions ledger

Architect also needs state that is not monetary:

- Bird-rights type and clock.
- RFA/QO/offer-sheet/matching status.
- Draft rights, required tender, non-NBA contract, and cap-hold status.
- Player consent or no-trade status.
- Signing, extension, renegotiation, trade, waiver-claim, and re-sign restrictions with start/end dates.
- Team hard-cap level and trigger event.
- Pick ownership, swaps, protections, deferrals, conveyance dependencies, frozen/slid status, and Stepien availability.
- Standard TPE amount, source transaction, remaining amount, and expiration.
- DPE state, medical decision, amount, use, and extinguishment.
- Taxpayer/repeater history and second-apron history.

### 4.3 Roster and list ledger

Per player, preserve Standard/Two-Way/Exhibit contract type and current list: active, inactive, two-way, voluntarily retired, or suspended. Per team, preserve:

- Standard-contract count.
- Active-list count.
- Two-way count.
- Offseason count.
- Short-roster consecutive-day and season-total clocks.
- Under-Fifteen Games accumulation.
- Two-way active-game usage.
- Hardship and treatment-program exceptions.
- Open slots at the instant a trade or waiver claim occurs.

### 4.4 Time and events

The engine should evaluate an explicit `asOfDate` and Salary Cap Year. It should not infer “today” during historical or hypothetical planning. Important event records include:

- Contract signing, amendment, conversion, option, ETO, extension, and renegotiation dates.
- Guarantee trigger dates and protection changes.
- Waiver request, waiver clearance, claim, buyout, stretch election, and set-off dates.
- Trade date and physical contingency state.
- QO, offer sheet, ROFR notice, renunciation, and unrenunciation dates.
- Draft, required tender, non-NBA contract, and draft-rights dates.
- Exception creation, use, partial use, renunciation, and expiration.
- Regular-season start/end and the number of elapsed season days.

## 5. Contract types and contract terms

**Authority:** CBA Article II §§3–15; Article VII §§3, 5, and 7; Articles VIII, IX, and XII; Uniform Player Contract (Exhibit 2). CBAguide pages were used for discovery only.

### 5.1 Standard, Ten-Day, and Rest-of-Season contracts

- A contract is Standard unless it is a Two-Way contract.
- Ten-Day contracts are normally available starting January 5 and last the longer of ten days or three team games. A player may sign no more than two Ten-Days with one team.
- Concurrent Ten-Day capacity depends on Standard roster size: 12 permits 0; 13 permits 1; 14 permits 2; 15 permits 3. Hardship rules can expand this.
- Ten-Day contracts do not use the normal waiver process; written termination is immediate.
- Rest-of-Season contracts are Standard contracts signed after the regular season begins, with current-year salary prorated by remaining regular-season days. Future seasons may be included.
- Proration affects cap, apron, tax, exception usage, and threshold planning.

### 5.2 Two-Way contracts

- Up to three Two-Way contracts may be held; they do not consume Standard roster spots and normally do not count in Team Salary.
- Player eligibility generally requires no more than four YOS during the contract, with a narrow four-YOS exception.
- A team may not sign/convert/acquire a player to a Two-Way if he has been under a Two-Way with that team in more than three Salary Cap Years.
- A Two-Way may cover no more than two seasons and may not include any Option Year or ETO (CBA II §11(d), p. 54). It may not include or provide for bonuses or Incentive Compensation of any kind, deferred compensation, or loans (CBA II §11(a)(iii), pp. 50–51).
- Two-Way payment follows the standard Uniform Player Contract schedule, with one express exception: a Two-Way that, at signing, is partially protected for lack of skill and injury or illness may be amended to pay the player an Advance — up to 50% of the Base Compensation so protected at signing (the Two-Way Contract Advance Limit) — prior to November 1 of that season, deducted from the November 1 installment and, as necessary, subsequent installments (CBA II §11(a)(v), p. 51). Do not model a blanket prohibition on every advance or alternate payment schedule.
- A Two-Way can be converted to a Standard contract at the applicable minimum for the same remaining term, or replaced by a newly negotiated Standard contract if the team has the signing mechanism.
- The conversion option may be exercised at any point during the period beginning **on** July 1 and ending just prior to the start of the team's last regular-season game, in each Salary Cap Year covered by the Two-Way contract (CBA II §11(f), pp. 54–55). July 1 itself is a legal conversion date.
- The player may be active for no more than 50 games, prorated after a late signing.
- Teams also face a 90 Under-Fifteen-Games limit when Two-Way players are active while fewer than 15 Standard players are signed.
- Two-Way contracts count as $0 in trade salary and do not create a TPE.

### 5.3 Exhibit 10 and Exhibit 9

**Exhibit 10**

- One-season minimum Standard contract, generally non-guaranteed, with a conversion path to a Two-Way before the first regular-season day.
- A team may hold no more than six Exhibit 10 contracts at once.
- Conversion rescinds the Exhibit 10 bonus and triggers the conversion protection amount.
- The bonus/protection range is cap-indexed and the two amounts must match when both are present.
- The bonus does not count in Team Salary. Its payment depends on preseason waiver, timely G League affiliate assignment/reporting, and 60 consecutive days of service.
- Trading an Exhibit 10 can create a deemed bonus when specified conditions exist.

**Exhibit 9**

- One-season non-guaranteed training-camp contract at a minimum or Two-Way salary. If the player is injured while performing under the contract and is terminated because he is unfit, the special Exhibit 9 framework includes a $15,000 injury termination fee.
- Normally excluded from Team Salary until the regular season begins.
- Requires at least 14 other players under non-Exhibit-9 contracts and is limited to six Exhibit 9 contracts.
- If retained into the regular season, the team needs room or an applicable exception.

### 5.4 Rookie Scale contracts

- Required for first-round picks: four seasons, Years 1–2 guaranteed, Team Options in Years 3–4.
- Salary plus unlikely bonuses can generally range from 80% to 120% of the slot's Rookie Scale Amount; 120% is common.
- Option decisions are due by October 31 in the preceding season.
- Declining either option leads to UFA status and caps the prior team's new first-year offer at the declined option amount.
- A trade bonus cannot push salary plus unlikely bonuses above 120% of scale.
- First-round signees cannot be traded for 30 days after signing; draft rights can be traded immediately.

### 5.5 Options and ETOs

- A normal Standard contract may have one option year; Rookie Scale contracts have two prescribed Team Options.
- An option covers one season, cannot be conditional, cannot reduce salary/likely/unlikely bonuses from the prior season, and carries unchanged terms and protection (other than the Base Compensation payment schedule) — **except** that a contract signed pursuant to the Second Round Pick Exception is expressly exempt from the Team Option unchanged-terms requirement (CBA XII §1(v), p. 336).
- Standard option deadline is June 29 at 5:00 p.m. ET. An option in favor of a player who would become an RFA if it were not exercised must be exercised **prior to June 25** (effectively June 24); Rookie Scale options use their prescribed October 31 deadline.
- An ETO is a player right to terminate early, not extend. It is exercisable only once and may take effect **no earlier than the end of the fourth season** of the contract (CBA XII §2(b), p. 337) — the earliest season an ETO can eliminate is the fifth; it does not and cannot shorten the fourth season. For an ETO added with a Rookie Scale extension, the boundary is the end of the fourth season of the extended term (XII §2(b), p. 338). It cannot be conditional and its effective season is fixed at signing (XII §3, p. 338); it must be exercised by 5:00 p.m. ET on the June 29 immediately prior to its effective season (XII §4, p. 338).
- Exercising an ETO prevents a later extension; signing an applicable extension may require eliminating the ETO.

### 5.6 Compensation protection and non-guaranteed salary

- Base compensation can be protected for lack of skill and specified injury/illness categories.
- Protection may be partial, conditional, date-triggered, performance-triggered, or subject to a prior-injury exclusion.
- Protection generally cannot increase by percentage in a later season unless the increase is conditional on something that cannot occur until the earlier season is complete.
- Team and Player Option years have different pre-exercise protection behavior and require contract-specific language.
- January 10 is the universal current-season guarantee date; to clear waivers first, the practical cut request is generally January 7.
- Before that date, earned compensation can exceed stated protection and become the relevant dead-salary amount.

### 5.7 Minimum and maximum salary

- Minimum salary depends on YOS and the year the contract began. Multi-year minimum scales move by contract year, not merely the player's current YOS.
- Minimum contracts generally prohibit bonuses, with limited exceptions such as trade bonuses, Exhibit 10 bonuses, and allowed international payment treatment.
- Maximum salary is normally 25% of the cap for 0–6 YOS, 30% for 7–9 YOS, and 35% for 10+ YOS, subject to the CBA's 105%-of-prior-salary override and Higher Max criteria. The maximum includes Salary plus unlikely bonuses.
- Higher Max eligibility depends on specified MVP, DPOY, or All-NBA achievements and, indirectly, award game thresholds.
- A future percentage-based maximum contract must be adjusted on the applicable July 1. Excess is reduced in a required order: signing bonus, incentive compensation, then base compensation.
- Ordinary annual raise/decrease limits are 5% of first-year Salary plus unlikely bonuses; qualifying Bird/Early Bird contracts and ordinary extensions may use 8% where permitted. The fixed percentage is measured from Year 1 rather than compounded each year; sign-and-trade and extend-and-trade structures use the stricter applicable limits.

### 5.8 Over-38 rule

**Authority:** CBA Article VII §3(a)(2), pp. 198–200. [CBAguide calculator](https://cbaguide.com/resources/over-38-calculator/) is a secondary implementation aid.

- Applies to a contract, extension, or renegotiation covering at least four seasons when the player is age 38 on October 1 of at least one covered season, subject to Bird-rights exceptions.
- A narrow moratorium-birthday rule can use age as of the prior June 30.
- For a non-Full-Bird case, “Over-38 Years” begin at the later of the fourth contract year or the first October 1 on which the player is 38.
- Certain Full Bird players age 35 or 36 signing with the prior team receive special treatment: a four-year deal may avoid reallocation; a five-year deal may reallocate only Year 5. A sign-and-trade does not receive that relief.
- Salary from Over-38 Years is initially reallocated proportionally across non-Over-38 Years.
- Reattribution can recur on July 1 when the contract remains active and an Over-38 Year is within two years.

**Required inputs:** date of birth, signing date, contract/extension/renegotiation origin, term, Bird status, sign-and-trade status, annual salary, guarantee state, and historical active status.

### 5.9 Bonuses, incentives, and other compensation adjustments

- A signing bonus generally may not exceed 15% of total compensation excluding Incentive Compensation; in an offer sheet, the limit is 10%.
- A signing bonus is allocated over the Salary Cap Years covered by the contract — or, for a bonus earned upon trade under VII §3(b)(1)(ii), over the **then-current and any remaining** Salary Cap Years — **in proportion to the percentage of Base Compensation in each such Salary Cap Year that, at the time of allocation, is protected for lack of skill**, not in proportion to guaranteed salary dollars. If the contract provides for an ETO, allocation runs only over the Salary Cap Years preceding the ETO's effective season. If no Base Compensation (for a trade-earned bonus, no then-current or remaining Base Compensation) is protected for lack of skill at the time of allocation, the entire bonus is allocated to the first Salary Cap Year (for a trade-earned bonus, the Salary Cap Year of the trade) (CBA VII §3(b)(2), pp. 200–201).
- An extension signing bonus follows its own VII §3(b)(3) rules — ordinary signing bonuses, trade-earned bonuses, and extension bonuses are three distinct allocation regimes, never one universal rule. Within §3(b)(3), the treatment forks on the team's cap status when it enters into the Extension and on the bonus's payment timing; the three branches below are distinct and must never be collapsed into one rule. **(1) Team Salary at or over the cap (VII §3(b)(3)(i), p. 201):** the extension bonus is paid no sooner than the first day of the extended term's first Salary Cap Year and is allocated over the Salary Cap Years of the **extended term** in proportion to each year's lack-of-skill-protected percentage of Base Compensation; if none of the extended term's Base Compensation is so protected, the entire bonus goes to the extended term's first Salary Cap Year. **(2) Team Salary below the cap, bonus paid no sooner than the extended term begins (VII §3(b)(3)(ii), second sentence, p. 201):** a team below the cap may pay the bonus at any time during the original or extended term; when the Extension calls for the bonus to be paid **no sooner than the first day of the first Salary Cap Year covered by the extended term**, the bonus is allocated in accordance with §3(b)(3)(i)'s proration rules — over the Salary Cap Years of the **extended term only**, in proportion to each extended-term year's lack-of-skill-protected percentage of Base Compensation, with the same zero-protection fallback: if none of the extended term's Base Compensation is so protected, the entire bonus goes to the extended term's first Salary Cap Year. Ordinary §3(b)(2) signing-bonus allocation does **not** govern this branch. **(3) Team Salary below the cap, bonus paid before the extended term begins (VII §3(b)(3)(ii)(A)–(C), pp. 201–03):** the bonus is allocated over the then-current and remaining Salary Cap Years of the original term **plus** the extended term on the same protected-percentage basis (zero protection → the Salary Cap Year in which the extension is signed), the extension is deemed a Renegotiation, and the bonus must be paid in two installments — the first, before the extended term begins, equal to the portion allocated to original-term years; the second, on or after the extended term's first day, equal to the portion allocated to extended-term years.
- A trade bonus may be fixed or percentage-based but is capped at 15% of remaining base compensation. It is paid once, generally by the sending team. As an amount earned upon trade it is a VII §3(b)(1)(ii) signing bonus for allocation purposes: it is allocated to the receiving team's salary over the **then-current and any remaining Salary Cap Years** in proportion to each year's lack-of-skill-protected percentage of Base Compensation — not over remaining guaranteed seasons (VII §3(b)(1)(ii)–(b)(2), pp. 200–201).
- Deferred compensation counts in the season earned, not the season paid, and is generally limited to 25% of that season's compensation.
- Likely performance bonuses count in Salary; unlikely bonuses generally do not count in Team Salary but do count in Apron Salary and maximum/room tests where specified.
- Likelihood is based on the preceding season and can change when a player changes teams if the criterion is team-related. The sending and receiving teams can therefore use different trade-salary values.
- Incentive Compensation for a season may not exceed 20% of the **Regular Salary** called for by the contract for that season (CBA II §12(a)(i), p. 58). Unlikely Bonuses in a Salary Cap Year may not exceed 15% of the player's **Regular Salary** for that Salary Cap Year at the time the contract is signed, subject to two express provisos (CBA VII §5(b)(1), p. 229): **(i) extension carry-forward** — if the amount of Unlikely Bonuses in the Salary Cap Year in which an Extension is signed exceeds 15% of the player's Regular Salary for that Salary Cap Year, the Extension may provide for up to the **same percentage** of Unlikely Bonuses in the first year of the extended term; and **(ii) renegotiation bar** — no Renegotiation may provide for an increase in Unlikely Bonuses if, after the Renegotiation, the Unlikely Bonuses for any Salary Cap Year covered by the renegotiated contract would exceed 15% of the player's Regular Salary for that Salary Cap Year. Both caps use the defined Regular Salary denominator, not Base Compensation; the two defined amounts can differ.
- EIPPA is a fixed schedule, not a cap-indexed percentage: $875,000 in 2025–26 and $900,000 in 2026–27, increasing by $25,000 per year. It cannot be used for the same player more than once in three Salary Cap Years; an EIPPA arrangement also blocks a Two-Way/Exhibit 10 path for the specified one-year period. Any excess over the excluded amount is treated as a signing bonus and Salary.
- Below-market loan interest can be imputed as Salary. Premium reimbursements may be excluded when requirements are met.
- Suspension generally does not reduce Team Salary, but certain league suspensions reduce Tax Salary by 50% of forfeited compensation.

## 6. Team Salary, cap holds, and room

**Authority:** CBA Article VII §4, pp. 211–26, with defined terms in Article VII §1. CBAguide pages were used for discovery only.

### 6.1 Team Salary includes

- Salaries of players on the roster.
- Protected/dead salary of waived players, with any stretch/buyout/set-off treatment.
- Retired players under contract and circumvention-related imputed amounts.
- Pending contracts required to be reported.
- Outstanding offer sheets.
- Free-agent, first-round-pick, open-roster, and available-exception cap holds.
- Assigned contracts from trades or waiver claims.
- Minimum-team-salary adjustment.
- A portion of current/future grievance exposure, with later reconciliation.

### 6.2 Cap holds

**Free-agent cap holds**

- Preserve the prior team's Bird mechanism and prevent a team from using room before re-signing its own player over the cap.
- Based on prior Regular Salary, signing-bonus allocation, and actually earned incentive compensation, then bounded by the player's minimum and maximum.
- Common formulas surfaced by the Guide: Rookie Scale fourth-year free agents at 300% of prior salary below EAPS or 250% above EAPS; other Full Bird UFAs at 190% below EAPS or 150% above; Early Bird at 130%; Non-Bird at 120%; minimum-contract free agents at the new minimum, no higher than the two-YOS minimum.
- RFA hold is the greatest of the applicable UFA hold, qualifying offer, or matching amount.

**First-round-pick cap holds**

- 120% of Rookie Scale Amount.
- Added immediately when selected.
- Removed by signing, loss/assignment of draft rights, certain non-NBA contract events, or a formal temporary waiver of the right to sign; can return later.

**Open-roster cap holds**

- Count Standard players, free-agent holds, first-round-pick holds, and players with offer sheets.
- From July 1 through the day before the regular season begins, if the total is below 12, charge one 0-YOS minimum salary for each missing slot. Do not continue this hold as a generic in-season roster charge.

**Exception cap holds**

- Prevent a team from simultaneously acting as a room team and an over-cap exception team.
- If Team Salary is below the cap by less than its available exceptions, the relevant exception amount or unused balance is included until used, renounced, or lost.

### 6.3 Renunciation

- Renouncing a veteran free-agent hold removes it and ordinarily sacrifices the signing use of Bird rights, though re-signing can continue the underlying clock.
- A team can renounce from Early Bird down to Non-Bird to avoid the Early Bird minimum term.
- RFA rights require relinquishing matching rights, not a simple cap-hold renunciation.
- A narrow “unrenouncing” route exists when room was created to sign an offer sheet that the other team matched, subject to two-day and team-salary limits.

### 6.4 Minimum-contract subsidy

- For a qualifying one-year, Ten-Day, or Rest-of-Season minimum contract, cap/apron/tax treatment is generally reduced to the two-YOS minimum when the player has more than two YOS; the benefits fund reimburses the excess.
- A player below two YOS counts at his actual applicable minimum.
- The subsidy can disappear when calculating dead salary after a waiver; use the player's actual base compensation and protection.
- Minimum Exception eligibility and league subsidy eligibility are separate tests.

### 6.5 Long-term injury exclusion versus DPE

These must not be conflated.

- **DPE:** gives an additional limited exception to replace a player; the injured player's salary remains.
- **Long-term/career-ending injury exclusion:** may remove remaining salary from Team Salary only after the contract is terminated through waivers, the CBA's waiting period is met, and a jointly selected physician or Fitness-to-Play Panel makes the required finding. Only the team with the contract when the condition became known or reasonably should have become known may apply, and an approved team can never re-sign or reacquire the player.
- A DPE request—granted or denied—precludes a long-term exclusion request for that player in the same Salary Cap Year. If an excluded player later appears in 25 NBA regular-season, Play-In, and playoff games in a season, salary returns for that and later cap years, subject to the CBA's materially elevated-risk exception and timing rules.

## 7. Salary Cap exceptions and Bird rights

**Authority:** CBA Article VII §6, pp. 231–49; Article VII §4 for exception cap holds; Article XXIV for certain consent effects. CBAguide was used for discovery only.

### 7.1 General exception rules

- An over-cap exception is available only when Team Salary is at/above the cap or below it by less than the available exception amount.
- Different exceptions generally cannot be aggregated to sign or acquire one player.
- Most unused exceptions begin daily proration January 10. The Minimum Exception prorates from the season start; DPE and TPE do not prorate.
- Full exception value may remain relevant for a trade or offer sheet where the rule permits it.
- Exception usage must track allowed transaction method: signing, trade, waiver claim, or some subset.

### 7.2 Bird rights

| Type | Typical clock | First-year authority | Term | Raises |
|---|---:|---|---|---:|
| Non-Bird | 1 season | Greater of 120% of prior salary/bonuses or minimum | Up to 4 years | 5% |
| Early Bird | 2 seasons | Greater of 175% of prior salary/bonuses or 105% of average salary | 2–4 years, excluding option from minimum | 8% |
| Full Bird | 3+ seasons | Up to maximum salary | Up to 5 years | 8% |

- Trades and waiver claims generally transfer the clock.
- A waiver during the most recent contract can reset it; a waiver during an earlier completed contract does not necessarily erase accumulated seasons.
- Certain one-year contracts that would create Full/Early Bird rights lose those rights on trade and generate an automatic consent right unless waived.

### 7.3 Major exceptions

| Exception | Primary use | Contract/asset limits | Apron/lifecycle effect |
|---|---|---|---|
| NTMLE | Sign, trade, waiver claim, offer-sheet match; divisible | Up to 4 years; 5% changes | Must land at/below First Apron; usage creates First Apron hard cap unless terms fit TMLE treatment |
| TMLE | Signing only; divisible | Up to 2 years; 5% changes | Must land at/below Second Apron; usage creates Second Apron hard cap and disables specified First-Apron-team tools |
| Room MLE | Room team later operating above cap; sign/trade/claim | Up to 3 years; 5% changes | Mutually exclusive with NTMLE, TMLE, and BAE |
| BAE | Sign, trade, waiver claim; divisible | Up to 2 years; 5% changes; unavailable in consecutive years | First Apron transaction and hard cap |
| DPE | One replacement player by signing, trade, or claim | Lesser of 50% of disabled player's salary or NTMLE; one-season contract/remaining term | Application July 1–January 15; player must be substantially more likely than not unable to play through the following June 15; does not remove disabled salary; expires March 10; extinguishes before use if the disabled player returns or is traded |
| Second Round Pick Exception | Sign own second-round pick | Prescribed 2+option or 3+option structures and minimum-based salaries | Temporarily excluded from Team Salary through July 30 but added to Apron Salary |
| Rookie Scale Exception | Sign own first-round pick | Rookie Scale contract | Over-cap authority |
| Minimum Exception | Sign qualifying player | Up to 2 seasons, applicable minimum, no ordinary bonuses | Prorates from season start; qualifying acquisition may count as $0 ITS |
| TPEs | Acquire via trade | See trade section | Availability and hard-cap effects depend on TPE type and apron |

## 8. Aprons, hard caps, tax, and minimum team salary

**Authority:** CBA Article VII §2, pp. 169–97; Article VII §1 definitions; official NBA annual system-level releases. CBAguide was used for discovery only.

### 8.1 Apron Salary calculation

**Authority:** CBA VII §2(e)(1)(i)–(x), pp. 186–187.

Start with Team Salary and apply the **ten** separately enumerated adjustments in CBA VII.2(e)(1)(i)–(x). Each is its own enumerated adjustment in the signed text and must stay distinct — in particular (vi) and (vii) are two adjustments, not one. Do **not** implement “remove all cap holds” as a shortcut:

- **(i)** Add all Performance Bonuses excluded from a player's Salary under VII §3(d) — principally unlikely performance bonuses.
- **(ii)** Add the Salary attributable to a qualifying contract signed by a free agent with 0 or 1 Years of Service as provided in VII §2(d)(1)(i)(F) (the two-YOS-minimum uplift).
- **(iii)** Add any amount that could be added to the team's Team Salary for the Salary Cap Year pursuant to VII §4(a)(1)(iii) (potential grievance exposure).
- **(iv)** Subtract Free Agent Amounts as described in VII §4(a)(2).
- **(v)** For any RFA, add the greater of (A) the Salary plus Unlikely Bonuses called for in any outstanding QO (or Maximum QO, if applicable) tendered to the player, or (B) the Salary plus Unlikely Bonuses called for in any First Refusal Exercise Notice issued for the player.
- **(vi)** Subtract amounts with respect to unsigned first-round picks as described in VII §4(a)(4).
- **(vii)** Add the amount of any outstanding Required Tender to a first-round pick.
- **(viii)** Subtract the amount of any Salary Cap Exception deemed included in Team Salary pursuant to VII §§4(a)(7) and 6(n)(2).
- **(ix)** Add any amount excluded from Team Salary pursuant to VII §4(l) (Second Round Pick Exception temporary exclusion).
- **(x)** Subtract the amount of any incomplete-roster cap hold added pursuant to VII §4(f).

This calculation must run before and after a proposed transaction. A team can begin below an apron and fail because the transaction lands above it.

### 8.2 First Apron transaction limits

A transaction is prohibited if post-transaction Apron Salary exceeds the First Apron when the team:

- Uses the BAE.
- Uses the NTMLE outside TMLE-compatible treatment.
- Acquires a player by sign-and-trade.
- Signs a qualifying high-salary waived player during the regular season.
- Uses the Expanded TPE.
- Uses a Standard TPE beyond the special timing allowed to teams over the First Apron.

Executing such a transaction creates a First Apron hard cap for the applicable Salary Cap Year.

### 8.3 Second Apron transaction limits

A transaction is prohibited if post-transaction Apron Salary exceeds the Second Apron when the team:

- Uses the Aggregated TPE.
- Pays cash in a trade.
- Uses a TPE created from a sign-and-traded contract.
- Uses the TMLE.

“No aggregation” means the team cannot combine multiple outgoing contracts under the Aggregated TPE. It does not, by itself, prohibit receiving multiple players for one outgoing player under an otherwise valid Standard TPE.

### 8.4 Post-regular-season transactions

For a post-regular-season transaction using the mechanisms specified in CBA VII.2(e)(2)—Expanded TPE, an aged/pre-existing Standard TPE, Aggregated TPE, cash, or a TPE arising from a sign-and-traded contract—the team must satisfy the applicable apron in both the current and next Salary Cap Years. This is not a universal rule for every apron-triggering action. The next-year test assumes options are exercised, ETOs are not exercised, conditioned Higher Max salaries are achieved, current apron levels remain, and no further current-year transactions occur.

Such a transaction can hard-cap both the current and next Salary Cap Years.

### 8.5 Second Apron pick penalty

- If a team's Apron Team Salary exceeds the Second Apron **as of the start of its final regular-season game**, its first-round pick in the seventh draft following the last day of that Salary Cap Year is frozen and may not be traded.
- Over the next four seasons, exceeding the Second Apron in at least two causes the frozen pick to slide to the end of the first round.
- If Apron Team Salary is at or below the Second Apron in at least three of those four seasons, the pick unfreezes on the day after the third such regular season; it does not slide.
- This requires historical team-apron state and future-pick status, not just current-year validation.

### 8.6 Tax Salary and repeater tax

- Tax Salary is finalized near the last regular-season game, with specified later adjustments.
- Include normal salaries, earned unlikely bonuses, relevant trade-bonus and grievance adjustments, and the 0–1 YOS uplift.
- Remove likely bonuses not earned and 50% of compensation lost to a league suspension where applicable.
- Repeater status applies when a team is a taxpayer in the current year and was a taxpayer in at least three of the immediately preceding four Salary Cap Years (four of five including the current year).
- Tax is progressive by cap-indexed brackets. **Beginning in 2025–26**, non-repeater rates are 1.00, 1.25, 3.50, and 4.75 for the first four brackets; repeater rates are 3.00, 3.25, 5.50, and 6.75. Each additional bracket above four increases by 0.50. For 2023–24 and 2024–25, the first four non-repeater rates were 1.50, 1.75, 2.50, and 3.25, with a $1.00 repeater add-on.
- The calculator must sum full prior brackets plus the partial final bracket.

### 8.7 Minimum team salary

**Authority:** CBA VII §2(c)(1)–(3) and (5), pp. 176–178.

- Threshold is 90% of the Salary Cap. Compliance is computed from **two differently adjusted bases** defined in CBA VII §2(c)(1): **MTS Cap Hold Team Salary** (Team Salary calculated as the Accountants calculate it for the Audit Report) and **MTS Payment Team Salary** (season-start MTS Cap Hold Team Salary, plus Salary excluded from Team Salary under VII §4(h), minus Salary included under VII §3(e), plus Salary excluded under VII §4(b)).
- **MTS shortfall payment (team → NBA):** if a team's MTS Payment Team Salary is below the Minimum Team Salary, the team pays **the NBA** the difference between MTS Payment Team Salary and the Minimum Team Salary, and is barred from sharing in any tax distribution to non-taxpayers (VII §2(c)(2)). Nothing is paid to players: the NBA redistributes qualifying §2(c)(2)(i)/§2(c)(5) payments **equally to each team** within ten business days of receipt (VII §2(c)(6), pp. 178–179). Historical exception: for the **2023–24 Salary Cap Year only**, a shortfall team that owed no tax received a 50% share of the non-taxpayer tax distribution instead of no share (VII §2(c)(7), p. 179); this exception does not apply to any later season.
- **Team Salary charge:** separately, from the start of the first day of the regular season through the end of the Salary Cap Year, Team Salary includes the amount (if any) by which the Minimum Team Salary exceeds the **lesser** of the team's then-current MTS Cap Hold Team Salary and its season-start MTS Cap Hold Team Salary (VII §2(c)(3)). The payment and the Team Salary charge are computed from different adjusted bases and are **not** necessarily equal.
- Its opening salary becomes a continuing in-season floor; falling below it requires prompt correction.
- **Year-end reconciliation:** an additional payment is due if, at the end of the Salary Cap Year, the Minimum Team Salary still exceeds the portion of total MTS Cap Hold Team Salaries for which the team is financially responsible plus the season-start payment; for this test MTS Cap Hold Team Salaries include excluded-but-earned Incentive Compensation and exclude included-but-unearned Incentive Compensation (VII §2(c)(5)).

## 9. Roster rules

**Authority:** CBA Article XXIX §§1–5, pp. 429–38; BYL §§6.01–6.12, pp. 68–75. CBAguide was used for discovery only.

### 9.1 Regular season

- Active + inactive list: normally 14–15 Standard players.
- Temporary shortage: 12 or 13 for no more than two consecutive weeks and 28 total days in the season.
- Active list: normally 12–15, with a temporary 11-player window under similar limits.
- At least eight players must be available on the bench.
- Up to three Two-Way contracts, separate from Standard minimum/maximum counts.
- League suspension can open a spot after the fifth game; team suspension after the third.
- Hardship and specified treatment-program rules can permit more than the normal maximum.

### 9.2 Offseason

- After the period in which the 14–15 Standard-player requirement applies ends for a team, the aggregate maximum becomes 21 across Active, Inactive, and Two-Way Lists.
- On the day following the **last day of the league Season**, Inactive- and Two-Way-List players transfer to the Active List; from then until the day before the next regular season, the Active List maximum is 21 including Two-Way players. Do not equate a playoff team's elimination date with the league's last day of the Season for this list-transfer event.

### 9.3 Two-Way usage

- Maximum active games per player and team-wide Under-Fifteen Games must be tracked.
- A potential CBA adjustment can raise the minimum Standard roster to 15 or reduce Two-Way spots based on league-wide roster averages. This should be a configurable league rule, not a permanent constant.

### 9.4 Transaction-time slots

- A team receiving more players than it sends must have the open Standard roster spots before completing the trade, even if it plans an immediate waiver afterward.
- A waiver request frees a roster spot immediately; the team need not wait for the player to clear.
- A waiver claimant must have an open slot and sufficient room or exception authority.

## 10. Free agency, RFA, extensions, and renegotiations

**Authority:** CBA Articles XI and XII; Article VII §7; Articles VIII and IX. CBAguide was used for discovery only.

### 10.1 UFA

- A UFA can sign by cap room, an applicable exception, Bird rights with the prior team, or sign-and-trade.
- Negotiation/signing timing and the July Moratorium matter.
- Rights status must distinguish free agent, RFA, and retained draft rights.

### 10.2 RFA and qualifying offers

- Applies to specified first-round players after Year 4, qualifying Two-Way players, and other players with no more than three YOS.
- Prior team must issue a timely QO to preserve right of first refusal.
- A QO must be made by 5:00 p.m. ET on June 29. Unless extended, it remains open for acceptance through October 1 and in no event later than March 1. The team may withdraw it unilaterally through July 13; after that, player written consent is required, and any withdrawal on or after July 14 is also treated as a renunciation under the CBA.
- QO size can depend on draft slot, prior salary, and starter criteria (starts/minutes).
- A standard QO is one year, fully protected for specified reasons, and uses required payment/term language.
- A Maximum QO has maximum base compensation, 8% increases, five seasons, full protection, and no option/ETO.
- Two-Way RFAs have separate QO rules.
- Withdrawal dates affect UFA status and whether Bird rights are deemed renounced.

### 10.3 Offer sheets and Arenas provision

- Offering team must preserve sufficient room through the matching process.
- The ordinary last date to sign an offer sheet for that season is March 1. An offer sheet must cover more than one season excluding an option; if the prior team also tendered a Maximum QO, it must cover more than two seasons excluding an option.
- If received before noon ET, the prior team's First Refusal Exercise Notice is due by 11:59 p.m. ET the next day; if received at or after noon, it is due by 11:59 p.m. ET on the second following day. An offer sheet received during the Moratorium is treated under the CBA's special July 7 deadline.
- Matched contracts cannot be amended for one year; trade restrictions apply, including a one-year ban to the offering team.
- Matching cannot be used as a sign-and-trade.
- For an RFA with one or two YOS, Arenas rules limit Years 1–2 and can jump Years 3–4. The offering team uses average annual salary for room/Team Salary; the matching team may use the stated schedule or, in specified below-cap circumstances, elect averaging.

### 10.4 Extensions

**Rookie Scale**

- Requires exercised Rookie Scale options and must be signed in the prescribed window before the fourth regular season.
- Starting salary can reach the normal maximum, with conditional 25%–30% Higher Max language.
- Term and raises depend on salary level; up to 8% changes.
- Trading before the extension begins triggers poison-pill incoming trade salary.

**Veteran**

- Eligibility depends on existing term, signing/renegotiation date, remaining seasons, and projected Full Bird status.
- General first-year extended salary is the greater of 140% of final regular salary or 140% of EAPS, subject to maximum salary and bonus adjustments.
- Designated Veteran/Supermax rules add YOS, original-team/trade-history, honor, term, and one-year trade restrictions.
- A Designated Veteran Extension cannot include Incentive Compensation.
- Extend-and-trade reduces allowable salary to 120% measures, limits total length, and uses 5% changes.
- A six-month rule prevents doing a richer extension immediately before or after a trade.

### 10.5 Renegotiation

- Requires cap space, a contract originally covering at least four seasons, and generally the third anniversary.
- Unavailable March 1 through June 30.
- Can raise current salary and bonuses only within cap room; cannot simply lower existing salary.
- Renegotiate-and-extend may allow up to a 40% drop into the extended term under its specific rules.
- A renegotiated player cannot be traded for six months.

## 11. Waivers, dead salary, buyouts, and set-off

**Authority:** BYL §§5.01–5.07 and 6.11, pp. 66–75; CBA Article VII §7(d); Article XXVII; Uniform Player Contract ¶16. CBAguide was used for discovery only.

### 11.1 Waiver lifecycle

- Standard waiver period is 48 hours. The request cannot be withdrawn.
- Roster spot and non-guaranteed salary are freed at request time.
- Claimed team assumes the full contract and receives a 30-day trade restriction.
- Claim priority uses record with date-dependent season selection and tie breakers.
- A player requested after March 1 generally cannot join another team's postseason roster.

### 11.2 Dead salary

- If unclaimed, protected compensation remains; unearned unprotected compensation and ordinary bonuses do not.
- Before January 10, current-year dead salary is the greater of earned base compensation and protected amount.
- Use actual base compensation, not the subsidized cap amount, for a waived veteran minimum player.
- ETO years are treated as guaranteed for this purpose; Team Options not yet exercised are not; Player Options depend on contract language.

### 11.3 Stretch

- Team Salary stretch election spreads applicable dead salary over twice the remaining seasons plus one.
- A July 1–August 31 election includes the current season in remaining years; a September 1–June 30 election leaves current-year dead salary untouched and stretches future amounts.
- The contract must be terminated **before the September 1 preceding its final season**, and the team must elect the stretch before that same September 1.
- A stretch is unavailable if the future-year Team Salary attributable to all of the team's waived and other former players already exceeds—or would exceed—15% of the cap in effect when the election is made.
- A team that stretches the salary cannot re-sign or reacquire the player before the July 1 following the last season of the terminated contract, including an option year.
- Payment timing and Team Salary allocation are separate decisions.

### 11.4 Buyout and set-off

- A buyout reduces protected compensation in exchange for release and reallocates the reduced dead salary proportionally across affected seasons.
- Set-off can reduce a prior team's obligation when the waived player earns compensation elsewhere during the original term.
- Simplified set-off formula: new compensation minus the applicable 0-YOS or 1-YOS minimum, then 50% of the positive remainder, with detailed deferred/non-NBA treatment.
- Set-off allocation follows the relevant dead-salary schedule; the buyout may waive or reduce set-off rights.
- Re-signing restrictions apply after a trade/waive or buyout.

## 12. Trade Machine rules

**Authority:** CBA Article VII §§3, 6(j), 7, and 8; Article XXIV; BYL §§4.01–4.05. CBAguide was used for discovery only. The items below whose only support is CBAguide's reporting are **unsupported operational candidates** (§15.9.6) — discovery candidates, not OPS, and not enforceable under this canon.

### 12.1 Recommended validation order

1. Establish transaction date, Salary Cap Year, and participating teams.
2. Validate every asset is owned, transferable, and legal on that date.
3. Validate multi-team connectivity/touch requirements only if such a rule has been registered with qualifying provenance — the touch/qualifying-asset mechanics are unsupported operational candidates (§12.2, §15.9.6) and drive no verdict while unsupported.
4. Validate roster slots at the instant of trade.
5. Validate player consent and date/transaction restrictions.
6. Derive ITS and OTS separately for every player/team pairing.
7. Calculate post-trade Team Salary and Apron Salary.
8. Determine which TPE or room path each team can legally use; optimize per team.
9. Apply apron transaction limitations and resulting hard caps.
10. Validate cash, picks, Stepien, frozen-pick, and exception-specific restrictions.
11. Create resulting state: TPE balances, hard caps, roster/list assignments, rights, restrictions, picks, and cash balances.

### 12.2 Tradeable assets and multi-team touch rule

**Authority status: unsupported operational candidate (discovery only — not OPS).** The current public CBA and June 2024 By-Laws establish trade compliance and procedure but do not state the detailed asset thresholds or the two-other-team “touch” test below, and no qualifying first-party operational provenance (§15.9.6) for them is present in this canon. CBAguide reports these mechanics; secondary reporting establishes no authority class. They are therefore **discovery candidates only**: they cannot be registered as active v2 obligations, cannot be classified OPS, cannot drive an automatic or configurable product verdict, and cannot be enforced by Architect under this canon. Registration or enforcement requires qualifying first-party operational provenance or a different valid authority classification established through the normal §15.9.4–§15.9.6 evidence process. The reported mechanics are preserved below — as candidates, not rules — so that qualifying provenance can be sought.

- Reported: in a two-team trade, each team must send/receive an eligible player contract, qualifying pick, draft rights, swap, or minimum cash amount.
- Reported: in a trade of three or more teams, each team must touch at least two other teams by sending or receiving a qualifying asset.
- Reported: multi-team asset definitions are stricter — extinguishable conditional picks and nominal cash may not count.
- Reported: draft-rights assets need a qualifying NBA prospect, with recency and professional-rotation tests creating deemed status.
- If qualifying provenance is ever established, this is a graph validation problem — salary matching alone cannot validate a multi-team trade.

### 12.3 Trade Salary adjustments

**Both sides/team context**

- Team-related performance bonuses are re-tested for likelihood using each team's preceding performance. OTS and ITS can differ.

**OTS-only**

- Non-guaranteed salary by date:
  - July 1 to regular-season start: count protected amount.
  - Regular-season start through January 7: count salary less unearned/unprotected base compensation.
  - January 8 through regular-season end: deem current salary protected.
  - After regular season through June 30: lesser of current-year salary and protected next-year salary.
- Sign-and-trade base-year adjustment: when Full/Early Bird is used above Non-Bird capacity, sending-team OTS is the greater of prior salary or 50% of first-year new salary. Use actual prior minimum compensation, including reimbursed portion.

**ITS-only**

- A qualifying Minimum Exception contract can count as $0 ITS while retaining OTS for the sender.
- Poison pill: a Rookie Scale extension signed but not begun uses average annual salary over the current contract plus extension, including option treatment, for ITS.
- Trade bonus: current-year allocated portion increases ITS and receiving Team Salary.

### 12.4 TPE framework

Each team is evaluated separately and can split a multi-player transaction into CBA-permitted component trades. The per-player, per-exception structure of the TPE rules supports this (CBA VII §6(j)(1)(i)–(v), pp. 240–241: each exception replaces its own defined Traded Player(s) with its own Replacement Player(s)); the decomposition procedure itself is **INFERRED** — non-arithmetic structural inference supported by that controlling text, not express CBA language and not DERIVED arithmetic *(resolved by R2.1: an express CBA component plus a separately stated INFERRED component, carried as separate evidence rows at v2 registration — §15.9.5)*. Architect should either find a legal decomposition or explain why none exists.

| Path | Availability/shape | Incoming limit | Lifecycle |
|---|---|---|---|
| Room | Team below cap | Room + $250K | Cannot combine simultaneously with another TPE path |
| Standard TPE | One outgoing; one or more incoming | 100% OTS + $250K | Can be non-simultaneous; remainder normally expires in 12 months, but First-Apron timing restrictions shorten usability |
| Aggregated TPE | Multiple outgoing aggregation; one or more incoming | 100% aggregate OTS + $250K | Must land at/below Second Apron; simultaneous |
| Expanded TPE | One or more outgoing; one or more incoming | Official formula below | Must land at/below First Apron; simultaneous; creates First Apron hard cap |

**Official Expanded TPE formula**

Let:

- `O` = aggregate outgoing trade salary.
- `K` = $250,000 allowance when permitted.
- `A` = $7.5 million × (current Salary Cap ÷ 2023–24 Salary Cap).

Then maximum ITS is:

`max(min(2 × O + K, O + A), 1.25 × O + K)`

The CBA's formula should be canonical. If a UI wants to show tiers, derive the breakpoints from `A` and `K` for that season. Do not store fixed tier boundaries.

The 110% **Transition TPE** existed only for 2023–24. Preserve it only in historical simulations; it is not a current fifth matching tier.

### 12.5 Additional TPE restrictions

- The $250K allowance is reduced to zero if post-assignment Apron Team Salary would exceed the First Apron.
- A player acquired using an exception generally cannot be aggregated for two months. If acquired on or before December 16, the restriction does not apply to a later trade on the day before the trade deadline or on the deadline itself.
- If a team used a DPE **in respect of the disabled player**, trading that disabled player during the same Salary Cap Year cannot generate a TPE. This restriction does not automatically attach to the replacement player acquired with the DPE. If the disabled player returns or is traded before DPE use, the DPE extinguishes.
- Standard TPE remainder and expiration must persist and support partial use.
- A team above the First Apron can still use a Standard TPE before it becomes an “aged” TPE under CBA VII.2(e)(4) row F: generally, a TPE arising during a regular season becomes First-Apron-limited after that regular season ends; one arising after a regular season becomes First-Apron-limited after the next regular season ends. The underlying non-simultaneous one-year expiration still applies.

### 12.6 Stacking minimum contracts

A team cannot send more than one “Minimum Traded Player” when all of these are true:

- Trade occurs outside December 15 through the trade deadline.
- Team aggregates at least three outgoing contracts.
- Fewer players come in than go out.

The applicable minimum classification uses the current season, or the next Salary Cap Year after the regular season.

### 12.7 Trade bonus

- Maximum 15% of remaining base compensation; may be fixed, percentage-based, or the lesser of the two.
- Triggered only once. An initial sign-and-trade or extend-and-trade does not consume it; a later trade can.
- Player may reduce/waive it as part of a trade, causing a six-month renegotiation restriction.
- Percentage calculation uses guaranteed base compensation still owed: current-season remainder by days plus guaranteed future seasons, excluding unexercised options.
- Allocate the result as a VII §3(b)(1)(ii) signing bonus over the then-current and any remaining Salary Cap Years in proportion to each year's lack-of-skill-protected percentage of Base Compensation (VII §3(b)(2), pp. 200–201), then reduce if annual maximum salary would be exceeded.
- Sending team normally pays; receiving team carries the cap/trade allocation.

### 12.8 Sign-and-trade

- Player must be a free agent who finished the prior season on the sending team's roster.
- Must be completed before the regular season.
- New contract must cover at least three seasons excluding options and no more than four; Year 1 must be fully protected for lack of skill.
- Certain exceptions cannot be used to sign the player.
- Receiving team must have sufficient transaction authority for salary plus applicable unlikely bonuses.
- Receiving a player by sign-and-trade is a First Apron transaction and creates a First Apron hard cap.
- Player cannot be re-aggregated for the prescribed period; base-year OTS adjustment may apply to the sender.
- Signing bonus payment by the sending team is treated as cash-in-trade.

### 12.9 Extend-and-trade

- Requires ordinary extension eligibility and is unavailable in a specified end-of-contract offseason window.
- Starting extension salary is capped by the greater of 120% of prior regular salary or 120% of EAPS, adjusted for incentives.
- Total length and annual changes are more restrictive than an ordinary extension.
- Extension and trade must be linked and completed within the permitted process; richer pre/post-trade extensions are restricted for six months.

### 12.10 No-trade and consent rights

- Express no-trade clause requires at least eight YOS and four YOS with the signing team.
- Automatic consent rights can arise on a one-year contract when a trade would reduce Full/Early Bird rights; the player can waive that right.
- Matched RFA offer sheets and other transactions create separate consent/recipient restrictions.

### 12.11 Player and date restrictions

The validator needs a rule-generated `tradeEligibleOn` plus recipient/consent constraints rather than one generic date. Examples include:

- Later of three months or December 15 for ordinary free-agent signings.
- Later of three months or January 15 for specified Bird-rights re-signings.
- 30 days after a drafted rookie signs.
- 30 days after Two-Way signing or waiver claim in specified contexts.
- Six months after renegotiation or a rich extension.
- One year after Designated Veteran contract/extension.
- One year and consent restrictions after a matched offer sheet.
- End-of-season option/ETO restrictions.
- July Moratorium, trade deadline, playoffs, lottery, and draft-day asset windows.

### 12.12 Cash-in-trade

- Annual sent and received limits are separate, each set as a cap-indexed percentage.
- Do not net cash sent against cash received.
- Cash has no Team Salary effect.
- Cash paid or received directly or indirectly in connection with one or more trades occurring during a Salary Cap Year counts against that Salary Cap Year's limits (CBA VII §8(a), p. 260); conditional cash tied to a pick is therefore charged to the Salary Cap Year of the trade, not the later payment date — an express **CBA** rule. The detailed attribution/accounting mechanics when the conditional asset is later re-traded are not expressed in the public signed text *(resolved by R2.1 — §15.9.5: those mechanics become a separate active v2 LEAF during A-series registration, classified OPS only with real operational provenance or INFERRED only with a controlling source chain; the former DERIVED/OPS composite label is rejected and must not be relied on)*.
- Paying cash is a Second Apron-limited transaction.

## 13. Draft picks, draft rights, and Stepien

**Authority:** CBA Articles VIII and X; BYL §§7.01–7.05. The seven-future-draft limit and the secondary-reported pick-protection/deferral processing mechanics below are **unsupported operational candidates** (§15.9.6) — reported by CBAguide, not located in the public primary documents: discovery candidates only, not OPS, not registrable, and not enforceable under this canon without qualifying first-party operational provenance or a different valid authority classification.

### 13.1 Draft rights

- Drafting creates exclusive negotiating rights.
- Rights persist through timely Required Tenders and qualifying non-NBA contract events.
- Required Tender deadlines and terms differ for first- and second-round picks.
- Failure to tender can produce rookie free agency.
- First-round rights create a cap hold; second-round rights do not use the same hold but can interact with required tenders and Apron Salary.
- Draft-and-stash rights need non-NBA contract dates, availability notice, new-tender events, and subsequent-draft rules.

### 13.2 Second-round picks and undrafted rookies

- Second-round picks may use the Second Round Pick Exception, Minimum Exception, Two-Way contract, cap room, or another valid path.
- Undrafted rookies are free agents immediately after the draft and need an ordinary signing mechanism or Two-Way contract.

### 13.3 Pick trading

- Future picks must identify a year and already be owned; a team cannot promise an asset it merely expects to acquire.
- Picks can carry protections and fallback conveyances, and the pick ledger must represent them. **Unsupported operational candidates (§15.9.6):** the reported one-year deferral right, the reported bar on combining protection and deferral on the same conveyance, and the reported limits on conditional “two years after prior conveyance” language are secondary-reported processing mechanics — discovery candidates only, not OPS, not registrable, and never enforceable or verdict-driving under this canon without qualifying first-party operational provenance or a different valid authority classification.
- **Unsupported operational candidate (§15.9.6):** the reported rule that first- and second-round picks can be traded only through the seventh future draft is a discovery candidate only — not OPS, not registrable as an active v2 obligation, never an automatic or configurable product verdict, and not enforceable by Architect under this canon unless qualifying first-party operational provenance or a different valid authority classification is established through the normal evidence process.
- **BYL 7.03:** A team may not sell its first-round selection for cash or trade/exchange it if the result **may** leave the team without first-round picks in two consecutive future drafts. Another team's owned first can satisfy the possession requirement; Architect must test all possible protection branches.
- Protections must be evaluated across all possible conveyance branches, not only the most likely outcome.
- Second Apron frozen picks must be treated as unavailable until unfreezing; slid picks have fixed end-of-round placement.

## 14. Calendar and lifecycle events

**Authority:** Date rules in CBA Articles II, VII, XI, XII, and XXIX; trade windows in BYL §4.01; official annual NBA releases/schedules. [CBAguide's calendar](https://cbaguide.com/calendar/) is a useful secondary consolidation. Season-specific dates must be versioned because the trade deadline and game calendar are not permanent constants.

Architect should expose a transaction date and automatically apply the appropriate calendar version. Critical events include:

- July 1 Salary Cap Year rollover and moratorium start.
- Moratorium end and limited transactions permitted during it.
- Required Tender and QO/option deadlines.
- First regular-season day: roster, Exhibit, salary-proration, and guarantee effects.
- January 5 Ten-Day opening.
- January 8 trade treatment for non-guaranteed salary.
- January 10 full current-season guarantee and exception-proration start.
- January 15 DPE application and other signing/trade deadlines.
- March 1 renegotiation blackout, playoff-waiver, and offer/QO deadlines.
- March 4 Two-Way signing deadline.
- March 10 DPE use expiration.
- Trade deadline and playoff trade restrictions.
- End of regular season: offseason roster, tax finalization, post-season trade assumptions, and next-year apron test.
- June 29 option/ETO deadlines.
- June 30 final day of Salary Cap Year.

## 15. Architect coverage-audit register

These are **testable coverage questions**, not confirmed bugs. They should become the input to a repository/product audit.

> **v2.0 status note (R2.2; population wording corrected by R2.3):** §15.1–§15.8 below are the current branch's **legacy-numbered working copy** of the v1.1 register (§15.9.1, population 2): they carry the R1/R1.1 source-law corrections and the authorized R2.1 A11/A18.7 annotations and are therefore **not byte-identical** to the published v1.1 edition. The published historical meanings are fixed by the register at commit `9814939c` (file SHA-256 `4a0760c8…`), which is the sole historical source for `XW2-…` edges; this working copy is an authoring input for constructing active v2 obligations only and redefines no published historical ID. Neither population is the active audit universe: Phase 2 audit input and verdict keying use only the active v2 registry (`CBA2-…`, §15.9–§15.12) once built and accepted, and no historical `CBA-…` ID ever carries an active verdict.

| Audit IDs | Canon evidence to use |
|---|---|
| A01 | §4.1 |
| A02–A11 | §§12.3–12.7; CBA VII.3 and VII.6(j) |
| A12–A14 | §8; CBA VII.2(e) |
| A15 | §12.2 (unsupported operational candidate — §15.9.6; not OPS) |
| A16 | §9.4; BYL 4.05(e) |
| A17 | §13.3; BYL 7.03 plus the unsupported seven-draft-horizon candidate (§15.9.6; not OPS) |
| A18 | §12.12; CBA VII.8(a) and VII.2(e) |
| C01–C18 | §§5–8 and 10; authority map §19.1 |
| R01–R10 | §§9 and 11; BYL §§5–6; CBA VII.7(d), XXVII, XXIX |
| L01–L10 | §§4.2–4.4 and 10–14; authority map §19.1 |
| A19 | §12.8 |
| A20 | §12.9; §10.4 |
| A21 | §12.6 |
| C19 | §5.1; §14 |
| C20 | §5.2; §13.2; §14 |
| C21 | §5.3; §3 row 14 |
| C22 | §5.6; §5.7 |
| C23 | §5.9; §3 row 11 |
| C24 | §5.5; §5.6; §3 row 10 |
| C25 | §6.1 |
| S01 | §3.1; §5.7; §14 |
| S02 | §1.2; §3 rows 5–6; §3.1 |
| S03 | §1.1; §9.3; §17; §19.3 |
| S04 | §3.1 |

### 15.1 Critical correctness candidates

| ID | Audit question | Why it matters |
|---|---|---|
| CBA-A01 | Does Architect derive Team, Apron, Tax, ITS, and OTS separately? | A single salary field will produce false verdicts. |
| CBA-A02 | Does trade matching use the official 2023 Expanded TPE formula and season scaling? | The remembered five-tier formula is not current law, and the Guide's displayed 2025–26 crossovers are arithmetically stale. |
| CBA-A03 | Does it apply non-guaranteed OTS differently in the four date windows? | Can change outgoing value by millions. |
| CBA-A04 | Does it apply sign-and-trade base-year OTS adjustment? | Sender and receiver can use very different numbers. |
| CBA-A05 | Does it apply poison-pill ITS for unstarted Rookie Scale extensions? | Material incoming-value change. |
| CBA-A06 | Are team-related bonuses reclassified independently for sender and receiver? | OTS and ITS can differ based on prior team performance. |
| CBA-A07 | Does current-year trade-bonus allocation increase ITS and receiving Team Salary? | Direct trade-matching and apron effect. |
| CBA-A08 | Does a qualifying minimum contract count as $0 ITS but retain sender OTS? | Core current-CBA optimization. |
| CBA-A09 | Are Standard, Aggregated, Expanded, and Room TPEs treated as distinct paths? | Availability, matching, persistence, and hard caps differ. |
| CBA-A10 | Can one outgoing contract legally receive multiple contracts under Standard TPE while still blocking outgoing aggregation above Second Apron? | “No aggregation” is often implemented too broadly. |
| CBA-A11 | Does TPE selection optimize each team separately and support legal component-trade decomposition? | Multi-player trades can work through different paths for each side. |
| CBA-A12 | Are First/Second Apron transaction restrictions evaluated on post-transaction Apron Salary? | Threshold status alone is not enough. |
| CBA-A13 | Does each triggering action create and persist the correct hard cap? | Later moves depend on it. |
| CBA-A14 | Are the specified post-regular-season TPE/cash trades and claims—rather than every apron-triggering action—tested against both current and next Salary Cap Years? | A transaction may pass one year and fail the other; overbroad gating also creates false failures. |
| CBA-A15 | Does multi-team validation enforce the **OPS** two-other-team touch graph and versioned qualifying-asset thresholds? | Salary-valid three-team trades can still fail league processing; provenance must not be mislabeled as CBA text. |
| CBA-A16 | Does a receiving team need open roster slots before an intended immediate waiver? | Explicit transaction-time requirement. |
| CBA-A17 | Are pick protections evaluated through all possible BYL 7.03 Stepien branches and the versioned **OPS** seven-draft horizon? | A superficially valid pick can create prohibited consecutive gaps. |
| CBA-A18 | Are cash sent/received tracked separately and blocked for a team landing above Second Apron? | Not a net balance and not Team Salary. |

### 15.2 Cap Manager candidates

| ID | Audit question | Why it matters |
|---|---|---|
| CBA-C01 | Are free-agent cap holds derived from contract type, prior salary, EAPS, QO, and max/min bounds? | Determines real cap room. |
| CBA-C02 | Are first-round-pick holds added at 120% immediately upon selection and removed/reinstated by lifecycle events? | Draft-night and offseason cap accuracy. |
| CBA-C03 | Are open-roster charges based on fewer than 12 counted spots only from July 1 through the day before the regular season? | Common cap-room omission and common in-season overcharge. |
| CBA-C04 | Are available exception holds included and renounceable? | Prevents room/exception double dipping. |
| CBA-C05 | Does one-year veteran minimum subsidy affect cap/apron/tax but disappear appropriately on waiver? | Same contract has two relevant salary bases. |
| CBA-C06 | Are likely/unlikely bonuses reconciled across Team, Apron, Tax, max, and room tests? | Different ledgers use them differently. |
| CBA-C07 | Is Apron Salary derived from Team Salary minus holds plus all specified add-backs? | Apron verdict foundation. |
| CBA-C08 | Is Tax Salary finalized separately and are repeater seasons tracked 3-of-4? | Needed for credible tax estimates. |
| CBA-C09 | Is progressive tax calculated bracket by bracket with season-scaled widths? | Flat multiplication is wrong. |
| CBA-C10 | Is the 90% minimum-team-salary process modeled at season start, during season, and year end? | Creates charges and operating restrictions. |
| CBA-C11 | Are DPE and long-term injury exclusion separate workflows? | One adds authority; the other can remove salary. |
| CBA-C12 | Does DPE use the correct “unable through June 15” medical state and one-player/one-season limits? | Guide summary contains reversed wording. |
| CBA-C13 | Are exception balances divisible, partially usable, prorated, renounceable, and method-limited? | Needed for realistic planning. |
| CBA-C14 | Are Bird clocks preserved/reset correctly across signings, trades, waivers, claims, and renunciation? | Drives future signing authority and consent rights. |
| CBA-C15 | Are Arenas offer-sheet salaries treated differently for offering and matching teams? | Multi-year Team Salary can differ materially. |
| CBA-C16 | Are rookie option decisions, rookie extensions, Higher Max outcomes, and declined-option salary caps represented? | Core multi-year roster planning. |
| CBA-C17 | Are Over-38 allocations and July 1 reattributions supported? | Direct cap hit reallocation. |
| CBA-C18 | Are signing bonuses allocated by guaranteed proportions and adjusted after contract changes? | Annual Team Salary impact. |

### 15.3 Waiver and roster candidates

| ID | Audit question | Why it matters |
|---|---|---|
| CBA-R01 | Does a waiver request immediately free the slot and unprotected amount while preserving the 48-hour claim state? | Timing affects same-day moves. |
| CBA-R02 | Is pre-January-10 dead salary the greater of earned and protected compensation? | Partial guarantees are not a fixed cap hit. |
| CBA-R03 | Are actual veteran minimum dollars used for dead salary rather than subsidized Team Salary? | Common hidden error. |
| CBA-R04 | Do stretch elections differ before and after September 1 and respect the 15% cap? | Multi-year dead-money schedule. |
| CBA-R05 | Are buyout reductions allocated proportionally and set-off later reconciled? | Team Salary changes after release. |
| CBA-R06 | Are normal 14–15, temporary 12/13, active-list, and bench requirements separate? | A simple count cannot cover legal roster status. |
| CBA-R07 | Are short-roster consecutive and total-day clocks persisted? | Legality depends on history, not a snapshot. |
| CBA-R08 | Are Two-Way active-game and Under-Fifteen-Games totals tracked? | Separate player and team constraints. |
| CBA-R09 | Does offseason capacity switch to 21 and merge list categories? | Same roster is evaluated differently after season. |
| CBA-R10 | Are hardship, suspension-list, and treatment-program states explicit rather than automatic guesses? | They change legal capacity but may require external approval. |

### 15.4 Rights, dates, and GM lifecycle candidates

| ID | Audit question | Why it matters |
|---|---|---|
| CBA-L01 | Is every hypothetical evaluated on an explicit date and season calendar? | Many rules change by day. |
| CBA-L02 | Are guarantee triggers, options, ETOs, extensions, and renegotiations event-driven? | Future salary and eligibility depend on decisions. |
| CBA-L03 | Does each signing/extension/claim produce the correct trade-eligible date and consent rules? | Generic December 15 logic is insufficient. |
| CBA-L04 | Are QO, offer-sheet, matching, withdrawal, and renunciation states represented? | RFA room and trade rights change quickly. |
| CBA-L05 | Are draft rights, tenders, non-NBA contracts, and subsequent-draft events persisted? | Required for stash and unsigned-pick management. |
| CBA-L06 | Do TPEs persist source, balance, use history, and expiration? | A TPE is an ongoing transaction resource. |
| CBA-L07 | Are hard caps stored with level, trigger, start, and end? | Later planning must not recalculate them away. |
| CBA-L08 | Is taxpayer and Second Apron history retained across seasons? | Repeater and frozen-pick penalties require history. |
| CBA-L09 | Are frozen/slid/unfrozen picks represented in ownership and Stepien logic? | Availability changes years after the trigger. |
| CBA-L10 | Can externally adjudicated states be set explicitly with provenance? | Medical/expert/league decisions should not be guessed. |

### 15.5 Index amendment — new top-level IDs (v1.1)

These fourteen IDs were added in v1.1 because **no existing ID is a truthful parent** for the requirement. No existing ID was renumbered, deleted, repurposed, or changed in meaning. Each question below is derived strictly from canon rules already stated in v1.0; no rule, formula, threshold, dollar value, deadline, or source interpretation was created or altered.

`Node` is defined in §15.6: a **GROUP** is an organizational parent whose child obligations are the auditable units; a **LEAF** is an independently auditable obligation.

| ID | Node | Leaf obligations | Audit question | Why it matters |
|---|---|---:|---|---|
| CBA-A19 | GROUP | 5 | Does Architect enforce sign-and-trade player eligibility and contract shape, not only its apron consequences? | An illegal sign-and-trade can otherwise pass every registered check, because v1.0 registered the consequences (A04, A12, A13) and none of the preconditions. |
| CBA-A20 | GROUP | 5 | Does Architect enforce the extend-and-trade salary ceiling, length, and raise limits? | Only the six-month trade restriction was indexed; the 120% ceiling and restricted shape were not. |
| CBA-A21 | LEAF | 1 | Does Architect enforce the minimum-contract stacking limit and its three conjunctive conditions? | Acceptance scenario 10 already tests this rule; v1.0 minted no ID to own it. |
| CBA-C19 | GROUP | 6 | Are Ten-Day and Rest-of-Season contracts modelled, including the January 5 opening, concurrent capacity, and proration? | An entire contract type with cap, apron, tax, and exception effects had no registered owner. |
| CBA-C20 | GROUP | 9 | Are Two-Way eligibility, shape, conversion, and $0 trade treatment enforced separately from two-way game usage? | R08 indexes game usage only; a Two-Way can be legal on games and illegal on shape. |
| CBA-C21 | GROUP | 11 | Are Exhibit 10 and Exhibit 9 contracts modelled, including limits, conversion, and the injury termination fee? | A whole canon subsection carried zero audit representation. |
| CBA-C22 | GROUP | 4 | Are minimum scales, raise limits, and the July 1 maximum adjustment enforced with the correct reduction order? | Raises measured from Year 1 rather than compounded, and the maximum adjustment order, change real dollars. |
| CBA-C23 | GROUP | 6 | Are signing-bonus, incentive, deferred-compensation, and EIPPA limits enforced? | Both incentive caps and the signing-bonus ceiling had no registered owner. |
| CBA-C24 | GROUP | 7 | Are option and ETO shape and deadlines enforced, including the prior-to-June-25 RFA option? | L02 asks whether options are event-driven, not whether their shape and deadlines are legal. |
| CBA-C25 | GROUP | 3 | Does Team Salary include retired players under contract, reportable pending contracts, and grievance exposure? | These are Team Salary components; omitting them understates the base ledger. |
| CBA-S01 | GROUP | 6 | Is every cap-indexed value season-keyed in a configuration layer, with the enumerated set complete and tables loaded whole? | Every monetary verdict reads this layer; a correct rule reading a wrong constant returns a wrong answer. |
| CBA-S02 | GROUP | 4 | Does each constant have exactly one canonical sourced value, and does the enforcing code path read the audited constant? | A duplicated or unread constant makes a verified value meaningless. |
| CBA-S03 | GROUP | 3 | Are OPS and EXT rules configurable, truthfully labelled, and never promoted to CBA-verified? | Provenance is a canon requirement; mislabelling an operational rule as CBA text is a correctness claim the canon forbids. |
| CBA-S04 | GROUP | 2 | Are scaled amounts, crossovers, bracket widths, and percentage-derived limits recomputed from published inputs with rounding only at the rule-defined final step? | Hard-coded or prematurely rounded derived values silently change legal maxima. |

**The S series.** `A` is critical trade correctness, `C` is Cap Manager, `R` is waivers and rosters, and `L` is lifecycle. The season-parameter and provenance layer is none of these — it sits *beneath* all of them, and every monetary verdict reads it. It is given its own series so that the foundation of every verdict is not filed as one more Cap Manager checkbox.

### 15.6 Registry structure — GROUP and LEAF (v1.1)

A parent ID may summarize a rule family, but where a parent owns more than one **independently verifiable condition**, a single Covered/Partial/Missing verdict on the parent would hide mixed compliance. Every such condition therefore carries its own sub-ID, numbered contiguously from `.1` in canon order beneath its parent. There are no reserved or skipped numbers.

The register is a two-level tree, and the two node types are **not interchangeable**:

| Node | Definition | Role |
|---|---|---|
| **GROUP** | A top-level ID that owns child obligations | Navigation and traceability anchor only. Its status is a **derived rollup** of its children. |
| **LEAF** | An obligation that is independently auditable | The unit of audit: a sub-ID, or a top-level ID that owns exactly one obligation. |

**Rules that follow from this, and that Phase 2 must honour:**

1. Only LEAF identifiers are Phase 2 execution units.
2. Only LEAF identifiers carry an independent evidence status and a verification method.
3. Only LEAF identifiers count toward Phase 2 packet totals.
4. Only LEAF identifiers receive a Found / Partial / No obvious implementation site classification.
5. A GROUP is a stable anchor for navigation and traceability; it is never an execution unit.
6. A GROUP's status is a rollup of its children, never a separate compliance verdict.
7. Mixed children are **never** collapsed into one parent PASS/FAIL. Report the child-status distribution.
8. Every LEAF appears exactly once in the execution map and exactly once in a Phase 2 packet.
9. Every GROUP has at least one child and appears only as a hierarchy/rollup entry.
10. Every substantive obligation has exactly one owning LEAF.

**Counting a GROUP as an execution unit alongside its children double-counts the rule family** and permits a parent verdict that contradicts its own children. It is prohibited.

| Measure | Count |
|---|---:|
| Registry nodes (GROUP + LEAF) | **427** |
| **GROUP** nodes | **59** |
| **LEAF** nodes — *the auditable universe* | **368** |
| …top-level LEAF (owns exactly one obligation) | 11 |
| …sub-ID LEAF | 357 |
| Substantive obligations, each with exactly one owning LEAF | **368** |

#### Top-level hierarchy

| ID | Node | Leaf obligations | Sub-ID range | Packet |
|---|---|---:|---|---|
| CBA-A01 | GROUP | 4 | `CBA-A01.1` – `CBA-A01.4` | P1 |
| CBA-A02 | GROUP | 8 | `CBA-A02.1` – `CBA-A02.8` | P3 |
| CBA-A03 | GROUP | 5 | `CBA-A03.1` – `CBA-A03.5` | P2 |
| CBA-A04 | LEAF | 1 | *(top-level leaf)* | P2 |
| CBA-A05 | GROUP | 2 | `CBA-A05.1` – `CBA-A05.2` | P2 |
| CBA-A06 | GROUP | 2 | `CBA-A06.1` – `CBA-A06.2` | P2 |
| CBA-A07 | GROUP | 9 | `CBA-A07.1` – `CBA-A07.9` | P2 |
| CBA-A08 | GROUP | 2 | `CBA-A08.1` – `CBA-A08.2` | P2 |
| CBA-A09 | GROUP | 5 | `CBA-A09.1` – `CBA-A09.5` | P3 |
| CBA-A10 | GROUP | 3 | `CBA-A10.1` – `CBA-A10.3` | P3 |
| CBA-A11 | LEAF | 1 | *(top-level leaf)* | P3 |
| CBA-A12 | GROUP | 10 | `CBA-A12.1` – `CBA-A12.10` | P3 |
| CBA-A13 | LEAF | 1 | *(top-level leaf)* | P3 |
| CBA-A14 | GROUP | 4 | `CBA-A14.1` – `CBA-A14.4` | P3 |
| CBA-A15 | GROUP | 5 | `CBA-A15.1` – `CBA-A15.5` | P6 |
| CBA-A16 | LEAF | 1 | *(top-level leaf)* | P5 |
| CBA-A17 | GROUP | 7 | `CBA-A17.1` – `CBA-A17.7` | P6 |
| CBA-A18 | GROUP | 8 | `CBA-A18.1` – `CBA-A18.8` | P6 |
| CBA-A19 | GROUP | 5 | `CBA-A19.1` – `CBA-A19.5` | P3 |
| CBA-A20 | GROUP | 5 | `CBA-A20.1` – `CBA-A20.5` | P3 |
| CBA-A21 | LEAF | 1 | *(top-level leaf)* | P3 |
| CBA-C01 | GROUP | 6 | `CBA-C01.1` – `CBA-C01.6` | P4 |
| CBA-C02 | GROUP | 2 | `CBA-C02.1` – `CBA-C02.2` | P4 |
| CBA-C03 | GROUP | 2 | `CBA-C03.1` – `CBA-C03.2` | P4 |
| CBA-C04 | GROUP | 2 | `CBA-C04.1` – `CBA-C04.2` | P4 |
| CBA-C05 | GROUP | 5 | `CBA-C05.1` – `CBA-C05.5` | P1 |
| CBA-C06 | LEAF | 1 | *(top-level leaf)* | P1 |
| CBA-C07 | GROUP | 10 | `CBA-C07.1` – `CBA-C07.10` | P1 |
| CBA-C08 | GROUP | 5 | `CBA-C08.1` – `CBA-C08.5` | P1 |
| CBA-C09 | GROUP | 2 | `CBA-C09.1` – `CBA-C09.2` | P1 |
| CBA-C10 | GROUP | 5 | `CBA-C10.1` – `CBA-C10.5` | P1 |
| CBA-C11 | GROUP | 9 | `CBA-C11.1` – `CBA-C11.9` | P4 |
| CBA-C12 | GROUP | 2 | `CBA-C12.1` – `CBA-C12.2` | P4 |
| CBA-C13 | GROUP | 15 | `CBA-C13.1` – `CBA-C13.15` | P4 |
| CBA-C14 | GROUP | 9 | `CBA-C14.1` – `CBA-C14.9` | P4 |
| CBA-C15 | GROUP | 2 | `CBA-C15.1` – `CBA-C15.2` | P4 |
| CBA-C16 | GROUP | 14 | `CBA-C16.1` – `CBA-C16.14` | P4 |
| CBA-C17 | GROUP | 7 | `CBA-C17.1` – `CBA-C17.7` | P4 |
| CBA-C18 | LEAF | 1 | *(top-level leaf)* | P4 |
| CBA-C19 | GROUP | 6 | `CBA-C19.1` – `CBA-C19.6` | P4 |
| CBA-C20 | GROUP | 9 | `CBA-C20.1` – `CBA-C20.9` | P4 |
| CBA-C21 | GROUP | 11 | `CBA-C21.1` – `CBA-C21.11` | P4 |
| CBA-C22 | GROUP | 4 | `CBA-C22.1` – `CBA-C22.4` | P4 |
| CBA-C23 | GROUP | 6 | `CBA-C23.1` – `CBA-C23.6` | P4 |
| CBA-C24 | GROUP | 7 | `CBA-C24.1` – `CBA-C24.7` | P4 |
| CBA-C25 | GROUP | 3 | `CBA-C25.1` – `CBA-C25.3` | P1 |
| CBA-L01 | GROUP | 5 | `CBA-L01.1` – `CBA-L01.5` | P1 |
| CBA-L02 | GROUP | 8 | `CBA-L02.1` – `CBA-L02.8` | P4 |
| CBA-L03 | GROUP | 15 | `CBA-L03.1` – `CBA-L03.15` | P7 |
| CBA-L04 | GROUP | 17 | `CBA-L04.1` – `CBA-L04.17` | P4 |
| CBA-L05 | GROUP | 7 | `CBA-L05.1` – `CBA-L05.7` | P6 |
| CBA-L06 | GROUP | 3 | `CBA-L06.1` – `CBA-L06.3` | P3 |
| CBA-L07 | LEAF | 1 | *(top-level leaf)* | P3 |
| CBA-L08 | GROUP | 6 | `CBA-L08.1` – `CBA-L08.6` | P7 |
| CBA-L09 | LEAF | 1 | *(top-level leaf)* | P6 |
| CBA-L10 | GROUP | 9 | `CBA-L10.1` – `CBA-L10.9` | P7 |
| CBA-R01 | GROUP | 10 | `CBA-R01.1` – `CBA-R01.10` | P5 |
| CBA-R02 | GROUP | 7 | `CBA-R02.1` – `CBA-R02.7` | P5 |
| CBA-R03 | LEAF | 1 | *(top-level leaf)* | P5 |
| CBA-R04 | GROUP | 6 | `CBA-R04.1` – `CBA-R04.6` | P5 |
| CBA-R05 | GROUP | 5 | `CBA-R05.1` – `CBA-R05.5` | P5 |
| CBA-R06 | GROUP | 6 | `CBA-R06.1` – `CBA-R06.6` | P5 |
| CBA-R07 | LEAF | 1 | *(top-level leaf)* | P5 |
| CBA-R08 | GROUP | 5 | `CBA-R08.1` – `CBA-R08.5` | P5 |
| CBA-R09 | GROUP | 2 | `CBA-R09.1` – `CBA-R09.2` | P5 |
| CBA-R10 | GROUP | 4 | `CBA-R10.1` – `CBA-R10.4` | P5 |
| CBA-S01 | GROUP | 6 | `CBA-S01.1` – `CBA-S01.6` | P1 |
| CBA-S02 | GROUP | 4 | `CBA-S02.1` – `CBA-S02.4` | P1 |
| CBA-S03 | GROUP | 3 | `CBA-S03.1` – `CBA-S03.3` | P1 |
| CBA-S04 | GROUP | 2 | `CBA-S04.1` – `CBA-S04.2` | P1 |

### 15.7 Index amendment — LEAF register (v1.1)

**Every row below is a LEAF: an independently auditable obligation.** These 368 rows are the complete audit universe. The eleven top-level LEAF IDs (`CBA-A04`, `A11`, `A13`, `A16`, `A21`, `C06`, `C18`, `L07`, `L09`, `R03`, `R07`) own exactly one obligation each and so carry no sub-IDs; they appear here at the top level.

**Verification method** is the primary way the condition can be proven. Not every obligation is an executable test:

| Method | Meaning |
|---|---|
| **SCEN** | Executable scenario |
| **STATIC** | Static/configuration inspection |
| **LIFECYCLE** | Lifecycle/state review |
| **UI** | Manual UI review |
| **EXTS** | External-state handling |
| **OPSV** | Operational verification |

`Scenario` cites §16. `Authority` and the requirement text are carried unchanged from the canon sections cited in the locator.

#### A series — Critical correctness

| LEAF ID | Parent | Canon § | Condition | Authority | Method | Scenario |
|---|---|---|---|---|---|---|
| CBA-A01.1 | CBA-A01 | §4.1 | Team, Apron, Tax, OTS, and ITS derived as five independent ledgers | CBA | SCEN | #47 |
| CBA-A01.2 | CBA-A01 | §4.1 | Player-compensation ledger (base, bonuses, deferred comp, protection, buyout, set-off) modeled separately from Team Salary | CBA | SCEN | #47 |
| CBA-A01.3 | CBA-A01 | §4.1 | No shared mutable salary field; every ledger derived from canonical contract/event data for a given date and team context | CBA | SCEN | #47 |
| CBA-A01.4 | CBA-A01 | §6.1 | Team Salary includes salaries of players on the roster | CBA | SCEN | #47 |
| CBA-A02.1 | CBA-A02 | §3 | Implement the official Expanded TPE formula; never hard-code the Guide's displayed boundaries | CBA/DERIVED | SCEN | #1 |
| CBA-A02.2 | CBA-A02 | §3 | The $250K allowance test uses post-assignment Apron Team Salary, not post-trade Team Salary | CBA | SCEN | #56 |
| CBA-A02.3 | CBA-A02 | §3 | The remembered 200/175/150/125/110% tiers are not the current Expanded TPE structure | CBA | SCEN | #1 |
| CBA-A02.4 | CBA-A02 | §12.4 | Expanded TPE: one or more outgoing and incoming; official formula; must land at/below the First Apron; simultaneous; creates a First Apron hard cap | CBA | SCEN | #1, #2 |
| CBA-A02.5 | CBA-A02 | §12.4 | Maximum ITS = max(min(2 x O + K, O + A), 1.25 x O + K) | CBA/DERIVED | SCEN | #1 |
| CBA-A02.6 | CBA-A02 | §12.4 | If a UI shows tiers, derive the breakpoints from A and K for that season; never store fixed tier boundaries | DERIVED | SCEN | #1 |
| CBA-A02.7 | CBA-A02 | §12.4 | The 110% Transition TPE existed only for 2023-24; preserve it only in historical simulations, not as a current fifth tier | CBA | SCEN | #56 |
| CBA-A02.8 | CBA-A02 | §12.5 | The $250K allowance is reduced to zero if post-assignment Apron Team Salary would exceed the First Apron | CBA | SCEN | #56 |
| CBA-A03.1 | CBA-A03 | §3 | Non-guaranteed in-season OTS = salary less unearned/unprotected compensation; test at 0%, 25%, 100% elapsed | CBA | SCEN | #7 |
| CBA-A03.2 | CBA-A03 | §12.3 | OTS window 1 - July 1 to regular-season start: count the protected amount | CBA | SCEN | #7 |
| CBA-A03.3 | CBA-A03 | §12.3 | OTS window 2 - regular-season start through January 7: salary less unearned/unprotected base compensation | CBA | SCEN | #7 |
| CBA-A03.4 | CBA-A03 | §12.3 | OTS window 3 - January 8 through regular-season end: deem current salary protected | CBA | SCEN | #7 |
| CBA-A03.5 | CBA-A03 | §12.3 | OTS window 4 - after the regular season through June 30: lesser of current-year salary and protected next-year salary | CBA | SCEN | #7 |
| CBA-A04 | *(none — top-level leaf)* | §12.3 | Sign-and-trade base-year adjustment: sending-team OTS is the greater of prior salary or 50% of first-year new salary, using actual prior minimum compensation including the reimbursed portion | CBA | SCEN | #15 |
| CBA-A05.1 | CBA-A05 | §10.4 | Trading before the extension begins triggers poison-pill incoming trade salary | CBA | SCEN | #11 |
| CBA-A05.2 | CBA-A05 | §12.3 | Poison pill: a signed but unstarted Rookie Scale extension uses average annual salary over the current contract plus extension, including option treatment, for ITS | CBA | SCEN | #11 |
| CBA-A06.1 | CBA-A06 | §5.9 | Bonus likelihood is based on the preceding season and can change on a team change when the criterion is team-related, so sender and receiver can use different trade-salary values | CBA | SCEN | #12 |
| CBA-A06.2 | CBA-A06 | §12.3 | Team-related performance bonuses are re-tested for likelihood using each team's preceding performance, so OTS and ITS can differ | CBA | SCEN | #12 |
| CBA-A07.1 | CBA-A07 | §5.4 | A trade bonus cannot push salary plus unlikely bonuses above 120% of scale | CBA | SCEN | #13 |
| CBA-A07.2 | CBA-A07 | §5.9 | A trade bonus may be fixed or percentage-based, capped at 15% of remaining base compensation, paid once and generally by the sender, and allocated to the receiver's salary as a VII §3(b)(1)(ii) signing bonus over the then-current and any remaining Salary Cap Years on the lack-of-skill-protected-percentage basis | CBA | SCEN | #13 |
| CBA-A07.3 | CBA-A07 | §12.3 | The current-year allocated trade-bonus portion increases ITS and receiving Team Salary | CBA | SCEN | #13 |
| CBA-A07.4 | CBA-A07 | §12.7 | Trade bonus maximum is 15% of remaining base compensation; it may be fixed, percentage-based, or the lesser of the two | CBA | SCEN | #13 |
| CBA-A07.5 | CBA-A07 | §12.7 | A trade bonus is triggered only once; an initial sign-and-trade or extend-and-trade does not consume it, but a later trade can | CBA | SCEN | #49 |
| CBA-A07.6 | CBA-A07 | §12.7 | The player may reduce or waive the bonus as part of a trade, causing a six-month renegotiation restriction | CBA | SCEN | #14 |
| CBA-A07.7 | CBA-A07 | §12.7 | Percentage calculation uses guaranteed base compensation still owed: current-season remainder by days plus guaranteed future seasons, excluding unexercised options | CBA | SCEN | #13 |
| CBA-A07.8 | CBA-A07 | §12.7 | Allocate the trade bonus as a VII §3(b)(1)(ii) signing bonus over the then-current and any remaining Salary Cap Years on the protected-percentage basis, then reduce it if the annual maximum salary would be exceeded | CBA | SCEN | #49 |
| CBA-A07.9 | CBA-A07 | §12.7 | The sending team normally pays the bonus; the receiving team carries the cap/trade allocation | CBA | SCEN | #49 |
| CBA-A08.1 | CBA-A08 | §7.3 | Minimum Exception: up to 2 seasons at the applicable minimum with no ordinary bonuses; prorates from season start; a qualifying acquisition may count as $0 ITS | CBA | SCEN | #9 |
| CBA-A08.2 | CBA-A08 | §12.3 | A qualifying Minimum Exception contract can count as $0 ITS while the sender retains OTS | CBA | SCEN | #9 |
| CBA-A09.1 | CBA-A09 | §7.3 | TPEs are acquisition exceptions whose availability and hard-cap effects depend on TPE type and apron | CBA | SCEN | #3, #4, #5, #6 |
| CBA-A09.2 | CBA-A09 | §12.4 | Room path: team below the cap; incoming limit is room + $250K; cannot be combined simultaneously with another TPE path | CBA | SCEN | #89 |
| CBA-A09.3 | CBA-A09 | §12.4 | Standard TPE: one outgoing, one or more incoming; limit 100% OTS + $250K; can be non-simultaneous; remainder normally expires in 12 months; First-Apron timing shortens usability | CBA | SCEN | #3, #5, #6 |
| CBA-A09.4 | CBA-A09 | §12.4 | Aggregated TPE: multiple outgoing aggregated; limit 100% aggregate OTS + $250K; must land at/below the Second Apron; simultaneous | CBA | SCEN | #4 |
| CBA-A09.5 | CBA-A09 | §12.5 | A First-Apron team can still use a Standard TPE before it becomes an 'aged' TPE under CBA VII.2(e)(4) row F; the underlying one-year non-simultaneous expiration still applies | CBA | SCEN | #5 |
| CBA-A10.1 | CBA-A10 | §8.3 | 'No aggregation' bars combining multiple outgoing contracts; it does not bar receiving multiple players for one outgoing player under a valid Standard TPE | CBA | SCEN | #3, #4 |
| CBA-A10.2 | CBA-A10 | §12.5 | A player acquired using an exception generally cannot be aggregated for two months; if acquired on or before December 16, the restriction does not apply to a trade on the day before or the day of the deadline | CBA | SCEN | #50 |
| CBA-A10.3 | CBA-A10 | §12.8 | The player cannot be re-aggregated for the prescribed period; the base-year OTS adjustment may apply to the sender | CBA | SCEN | #15 |
| CBA-A11 | *(none — top-level leaf)* | §12.4 | Each team is evaluated separately and may split a multi-player transaction into CBA-permitted component trades (supported by the per-player/per-exception structure of CBA VII §6(j)(1)(i)–(v)); the decomposition procedure itself is INFERRED structural inference, not express CBA text; Architect must find a legal decomposition or explain why none exists | CBA VII §6(j)(1)(i)–(v) pp. 240–241 (express structural component) with a separately stated INFERRED component (the decomposition procedure) — *resolved by R2.1 (§15.9.5); the two components become separate evidence rows at v2 registration; not DERIVED arithmetic* | SCEN | #48 |
| CBA-A12.1 | CBA-A12 | §8.2 | Using the BAE is prohibited if post-transaction Apron Salary exceeds the First Apron | CBA | SCEN | #17 |
| CBA-A12.2 | CBA-A12 | §8.2 | Using the NTMLE outside TMLE-compatible treatment is prohibited above the First Apron | CBA | SCEN | #16 |
| CBA-A12.3 | CBA-A12 | §8.2 | Acquiring a player by sign-and-trade is prohibited above the First Apron | CBA | SCEN | #15 |
| CBA-A12.4 | CBA-A12 | §8.2 | Signing a qualifying high-salary waived player during the regular season is prohibited above the First Apron | CBA | SCEN | #58 |
| CBA-A12.5 | CBA-A12 | §8.2 | Using the Expanded TPE is prohibited above the First Apron | CBA | SCEN | #2 |
| CBA-A12.6 | CBA-A12 | §8.2 | Using a Standard TPE beyond the special timing allowed to First-Apron teams is prohibited above the First Apron | CBA | SCEN | #5 |
| CBA-A12.7 | CBA-A12 | §8.3 | Using the Aggregated TPE is prohibited if post-transaction Apron Salary exceeds the Second Apron | CBA | SCEN | #4 |
| CBA-A12.8 | CBA-A12 | §8.3 | Using a TPE created from a sign-and-traded contract is prohibited above the Second Apron | CBA | SCEN | #58 |
| CBA-A12.9 | CBA-A12 | §8.3 | Using the TMLE is prohibited above the Second Apron | CBA | SCEN | #18 |
| CBA-A12.10 | CBA-A12 | §12.8 | Receiving a player by sign-and-trade is a First Apron transaction and creates a First Apron hard cap | CBA | SCEN | #15 |
| CBA-A13 | *(none — top-level leaf)* | §8.2 | Executing any First-Apron-limited transaction creates a First Apron hard cap for the applicable Salary Cap Year | CBA | SCEN | #15, #16, #17 |
| CBA-A14.1 | CBA-A14 | §3 | Gate the dual-year apron test by transaction type, not every apron-triggering action | CBA | SCEN | #19 |
| CBA-A14.2 | CBA-A14 | §8.4 | Post-regular-season transactions using the CBA VII.2(e)(2) mechanisms must satisfy the applicable apron in both the current and next Salary Cap Years | CBA | SCEN | #19 |
| CBA-A14.3 | CBA-A14 | §8.4 | The next-year test assumes options exercised, ETOs not exercised, conditioned Higher Max salaries achieved, current apron levels retained, and no further current-year transactions | CBA | SCEN | #43 |
| CBA-A14.4 | CBA-A14 | §8.4 | Such a transaction can hard-cap both the current and next Salary Cap Years | CBA | SCEN | #59 |
| CBA-A15.1 | CBA-A15 | §12.2 | Two-team trade: each team must send/receive an eligible player contract, qualifying pick, draft rights, swap, or minimum cash amount | OPS | SCEN | #46 |
| CBA-A15.2 | CBA-A15 | §12.2 | Trade of three or more teams: each team must touch at least two other teams by sending or receiving a qualifying asset | OPS | SCEN | #46 |
| CBA-A15.3 | CBA-A15 | §12.2 | Multi-team asset definitions are stricter: extinguishable conditional picks and nominal cash may not count | OPS | SCEN | #46 |
| CBA-A15.4 | CBA-A15 | §12.2 | Draft-rights assets need a qualifying NBA prospect; recency and professional-rotation tests can create deemed status | OPS | SCEN | #54 |
| CBA-A15.5 | CBA-A15 | §12.2 | Multi-team validity is a graph problem; salary matching alone cannot validate it | OPS | SCEN | #46 |
| CBA-A16 | *(none — top-level leaf)* | §9.4 | A team receiving more players than it sends must have the open Standard roster spots before completing the trade, even with a planned immediate waiver | BYL | SCEN | #36 |
| CBA-A17.1 | CBA-A17 | §4.2 | Pick ownership, swaps, protections, deferrals, conveyance dependencies, frozen/slid status, and Stepien availability | CBA/BYL | LIFECYCLE | #45 |
| CBA-A17.2 | CBA-A17 | §13.3 | Future picks must identify a year and already be owned; a team cannot promise an asset it merely expects to acquire | BYL | SCEN | #45 |
| CBA-A17.3 | CBA-A17 | §13.3 | Picks can carry protections, fallback conveyances, and one-year deferral rights; protection and deferral cannot be combined on the same conveyance | OPS | SCEN | #45 |
| CBA-A17.4 | CBA-A17 | §13.3 | OPS: first- and second-round picks can be traded only through the seventh future draft; treat the horizon as a versioned league rule | OPS | SCEN | #45 |
| CBA-A17.5 | CBA-A17 | §13.3 | BYL 7.03: a team may not sell a first for cash or trade it if the result MAY leave the team without firsts in two consecutive future drafts; another team's owned first can satisfy possession; test all protection branches | BYL | SCEN | #45 |
| CBA-A17.6 | CBA-A17 | §13.3 | Protections must be evaluated across all possible conveyance branches, not only the most likely outcome | BYL | SCEN | #45 |
| CBA-A17.7 | CBA-A17 | §13.3 | Conditional 'two years after prior conveyance' language is limited and cannot defeat the seven-year rule | OPS | SCEN | #55 |
| CBA-A18.1 | CBA-A18 | §4.1 | Cash-in-trade ledger with separate sent and received balances | CBA | SCEN | #53 |
| CBA-A18.2 | CBA-A18 | §8.3 | Paying cash in a trade is prohibited above the Second Apron | CBA | SCEN | #53 |
| CBA-A18.3 | CBA-A18 | §12.8 | A signing bonus paid by the sending team is treated as cash-in-trade | CBA | SCEN | #53 |
| CBA-A18.4 | CBA-A18 | §12.12 | Annual cash sent and cash received limits are separate, each a cap-indexed percentage | CBA | SCEN | #53 |
| CBA-A18.5 | CBA-A18 | §12.12 | Do not net cash sent against cash received | CBA | SCEN | #53 |
| CBA-A18.6 | CBA-A18 | §12.12 | Cash has no Team Salary effect | CBA | SCEN | #53 |
| CBA-A18.7 | CBA-A18 | §12.12 | Cash paid or received directly or indirectly in connection with trades during a Salary Cap Year counts against that year's limits, so conditional cash tied to a pick is charged to the Salary Cap Year of the trade, not the later payment date; the re-trade attribution/accounting mechanics are not expressed in the public signed text and are reserved to their own v2 obligation | CBA VII §8(a) p. 260 (express cap-year charging rule) — *resolved by R2.1 (§15.9.5): the re-trade attribution/accounting mechanics become a separate active v2 LEAF at A-series registration, OPS only with real operational provenance or INFERRED only with a controlling source chain; the former DERIVED/OPS composite is rejected as a classification* | SCEN | #53 |
| CBA-A18.8 | CBA-A18 | §12.12 | Paying cash is a Second Apron-limited transaction | CBA | SCEN | #53 |
| CBA-A19.1 | CBA-A19 | §12.8 | The sign-and-trade player must be a free agent who finished the prior season on the sending team's roster | CBA | SCEN | #51 |
| CBA-A19.2 | CBA-A19 | §12.8 | The sign-and-trade must be completed before the regular season | CBA | SCEN | #51 |
| CBA-A19.3 | CBA-A19 | §12.8 | The new contract must cover at least three seasons excluding options and no more than four; Year 1 must be fully protected for lack of skill | CBA | SCEN | #51 |
| CBA-A19.4 | CBA-A19 | §12.8 | Certain exceptions cannot be used to sign the sign-and-trade player | CBA | SCEN | #51 |
| CBA-A19.5 | CBA-A19 | §12.8 | The receiving team must have sufficient transaction authority for salary plus applicable unlikely bonuses | CBA | SCEN | #51 |
| CBA-A20.1 | CBA-A20 | §10.4 | Extend-and-trade reduces allowable salary to 120% measures, limits total length, and uses 5% changes | CBA | SCEN | #52 |
| CBA-A20.2 | CBA-A20 | §12.9 | Extend-and-trade requires ordinary extension eligibility and is unavailable in a specified end-of-contract offseason window | CBA | SCEN | #52 |
| CBA-A20.3 | CBA-A20 | §12.9 | Starting extension salary is capped by the greater of 120% of prior regular salary or 120% of EAPS, adjusted for incentives | CBA | SCEN | #52 |
| CBA-A20.4 | CBA-A20 | §12.9 | Total length and annual changes are more restrictive than an ordinary extension | CBA | SCEN | #52 |
| CBA-A20.5 | CBA-A20 | §12.9 | The extension and trade must be linked and completed within the permitted process; richer pre/post-trade extensions are restricted for six months | CBA | SCEN | #41 |
| CBA-A21 | *(none — top-level leaf)* | §12.6 | A team cannot send more than one Minimum Traded Player when all three conditions hold (trade outside December 15 through the deadline, at least three aggregated outgoing contracts, fewer players in than out); classification uses the current season, or the next cap year after the regular season | CBA | SCEN | #10 |

#### C series — Cap Manager

| LEAF ID | Parent | Canon § | Condition | Authority | Method | Scenario |
|---|---|---|---|---|---|---|
| CBA-C01.1 | CBA-C01 | §6.1 | Team Salary includes free-agent, first-round-pick, open-roster, and available-exception cap holds | CBA | SCEN | #24, #26, #27, #28 |
| CBA-C01.2 | CBA-C01 | §6.2 | Free-agent holds preserve the prior team's Bird mechanism and block using room before re-signing over the cap | CBA | SCEN | #24 |
| CBA-C01.3 | CBA-C01 | §6.2 | The hold is based on prior Regular Salary, signing-bonus allocation, and actually earned incentives, then bounded by the player's minimum and maximum | CBA | SCEN | #24 |
| CBA-C01.4 | CBA-C01 | §6.2 | Hold multipliers: rookie-scale fourth-year FAs at 300%/250% of prior salary (below/above EAPS); Full Bird 190%/150%; Early Bird 130%; Non-Bird 120%; minimum-contract FAs at the new minimum, no higher than the two-YOS minimum | CBA | SCEN | #24 |
| CBA-C01.5 | CBA-C01 | §6.2 | The RFA hold is the greatest of the applicable UFA hold, the qualifying offer, or the matching amount | CBA | SCEN | #25 |
| CBA-C01.6 | CBA-C01 | §6.3 | A narrow unrenouncing route exists when room was created to sign an offer sheet the other team matched, subject to two-day and team-salary limits | CBA | SCEN | #63 |
| CBA-C02.1 | CBA-C02 | §6.2 | First-round-pick hold = 120% of the Rookie Scale Amount, added immediately on selection, removed by signing/loss of rights/non-NBA events/formal temporary waiver, and can return later | CBA | SCEN | #26 |
| CBA-C02.2 | CBA-C02 | §13.1 | First-round rights create a cap hold; second-round rights do not use the same hold but interact with required tenders and Apron Salary | CBA | SCEN | #26 |
| CBA-C03.1 | CBA-C03 | §6.2 | The open-roster count includes Standard players, free-agent holds, first-round-pick holds, and players with offer sheets | CBA | SCEN | #27 |
| CBA-C03.2 | CBA-C03 | §6.2 | From July 1 through the day before the regular season, if the count is below 12 charge one 0-YOS minimum per missing slot; do not continue it as an in-season roster charge | CBA | SCEN | #27 |
| CBA-C04.1 | CBA-C04 | §6.2 | Exception cap holds prevent acting as a room team and an over-cap exception team at once; the exception amount or unused balance is included until used, renounced, or lost | CBA | SCEN | #28 |
| CBA-C04.2 | CBA-C04 | §7.1 | An over-cap exception is available only when Team Salary is at/above the cap or below it by less than the available exception amount | CBA | SCEN | #28 |
| CBA-C05.1 | CBA-C05 | §3 | Model the minimum-contract subsidy as a component; do not treat the whole contract as zero | CBA | SCEN | #33 |
| CBA-C05.2 | CBA-C05 | §6.4 | For a qualifying one-year, Ten-Day, or Rest-of-Season minimum contract, cap/apron/tax treatment reduces to the two-YOS minimum for players above two YOS; the benefits fund reimburses the excess | CBA | SCEN | #33 |
| CBA-C05.3 | CBA-C05 | §6.4 | A player below two YOS counts at his actual applicable minimum | CBA | SCEN | #75 |
| CBA-C05.4 | CBA-C05 | §6.4 | The subsidy disappears when calculating dead salary after a waiver; use actual base compensation and protection | CBA | SCEN | #33 |
| CBA-C05.5 | CBA-C05 | §6.4 | Minimum Exception eligibility and league subsidy eligibility are separate tests | CBA | SCEN | #75 |
| CBA-C06 | *(none — top-level leaf)* | §5.9 | Likely bonuses count in Salary; unlikely bonuses are excluded from Team Salary but count in Apron Salary and maximum/room tests where specified | CBA | SCEN | #22 |
| CBA-C07.1 | CBA-C07 | §8.1 | Apron Salary: add Performance Bonuses excluded from Salary, principally unlikely performance bonuses | CBA | SCEN | #57 |
| CBA-C07.2 | CBA-C07 | §8.1 | Apron Salary: add the two-YOS-minimum uplift for qualifying 0-1 YOS free-agent Standard contracts | CBA | SCEN | #57 |
| CBA-C07.3 | CBA-C07 | §8.1 | Apron Salary: add potential grievance exposure specified by CBA VII.4(a)(1)(iii) | CBA/EXT | EXTS | #57 |
| CBA-C07.4 | CBA-C07 | §8.1 | Apron Salary: subtract Free Agent Amounts | CBA | SCEN | #57 |
| CBA-C07.5 | CBA-C07 | §8.1 | Apron Salary: for an RFA, add the greater of the outstanding QO/Maximum QO amount and the First Refusal Exercise Notice amount, including specified unlikely bonuses | CBA | SCEN | #57 |
| CBA-C07.6 | CBA-C07 | §8.1 | Apron Salary: two separately enumerated adjustments — (vi) subtract amounts for unsigned first-round picks per VII §4(a)(4), and (vii) add the amount of any outstanding Required Tender to a first-round pick | CBA VII §2(e)(1)(vi)–(vii) pp. 186–187 | SCEN | #57 |
| CBA-C07.7 | CBA-C07 | §8.1 | Apron Salary: subtract exception holds included in Team Salary under CBA VII.4(a)(7) and 6(n)(2) | CBA | SCEN | #57 |
| CBA-C07.8 | CBA-C07 | §8.1 | Apron Salary: add Second Round Pick Exception amounts temporarily excluded from Team Salary | CBA | SCEN | #57 |
| CBA-C07.9 | CBA-C07 | §8.1 | Apron Salary: subtract incomplete-roster holds | CBA | SCEN | #57 |
| CBA-C07.10 | CBA-C07 | §8.1 | Apron Salary must be computed both before and after a proposed transaction | CBA | SCEN | #2 |
| CBA-C08.1 | CBA-C08 | §5.9 | Suspension generally does not reduce Team Salary, but certain league suspensions reduce Tax Salary by 50% of forfeited compensation | CBA | SCEN | #22 |
| CBA-C08.2 | CBA-C08 | §8.6 | Tax Salary is finalized near the last regular-season game, with specified later adjustments | CBA | LIFECYCLE | — |
| CBA-C08.3 | CBA-C08 | §8.6 | Tax Salary includes normal salaries, earned unlikely bonuses, relevant trade-bonus and grievance adjustments, and the 0-1 YOS uplift | CBA | SCEN | #22 |
| CBA-C08.4 | CBA-C08 | §8.6 | Tax Salary removes likely bonuses not earned and 50% of compensation lost to a league suspension where applicable | CBA | SCEN | #22 |
| CBA-C08.5 | CBA-C08 | §8.6 | Repeater status applies when a team is a taxpayer now and was a taxpayer in at least three of the immediately preceding four Salary Cap Years | CBA | SCEN | #21 |
| CBA-C09.1 | CBA-C09 | §8.6 | Tax is progressive by cap-indexed brackets; from 2025-26 non-repeater rates are 1.00/1.25/3.50/4.75 and repeater 3.00/3.25/5.50/6.75, +0.50 per additional bracket; 2023-24 and 2024-25 use the legacy rates | CBA | SCEN | #23 |
| CBA-C09.2 | CBA-C09 | §8.6 | The calculator must sum full prior brackets plus the partial final bracket | DERIVED | SCEN | #23 |
| CBA-C10.1 | CBA-C10 | §6.1 | Team Salary includes the minimum-team-salary adjustment | CBA | SCEN | #60 |
| CBA-C10.2 | CBA-C10 | §8.7 | Minimum team salary is 90% of the Salary Cap, using its own adjusted salary base | CBA | SCEN | #60 |
| CBA-C10.3 | CBA-C10 | §8.7 | If MTS Payment Team Salary is below the Minimum Team Salary, the team pays the NBA the difference computed on that base (an MTS shortfall payment, redistributed equally to teams under §2(c)(6) — never a payment to players) and loses the non-taxpayer tax distribution (2023–24 only: reduced to a 50% share for a non-tax-owing team, §2(c)(7)); the in-season Team Salary charge is separately the shortfall of the lesser of then-current and season-start MTS Cap Hold Team Salary — different adjusted bases, not necessarily equal amounts | CBA VII §2(c)(1)–(3),(6)–(7) pp. 176–179 | SCEN | #60 |
| CBA-C10.4 | CBA-C10 | §8.7 | Its opening salary becomes a continuing in-season floor; falling below it requires prompt correction | CBA | SCEN | #60 |
| CBA-C10.5 | CBA-C10 | §8.7 | A minimum charge can persist and may be reconciled again at year end | CBA | SCEN | #60 |
| CBA-C11.1 | CBA-C11 | §3 | The DPE/TPE bar attaches to the disabled player, not to the DPE replacement player | CBA | SCEN | #76 |
| CBA-C11.2 | CBA-C11 | §4.2 | DPE state, medical decision, amount, use, and extinguishment | CBA/EXT | EXTS | #29 |
| CBA-C11.3 | CBA-C11 | §6.5 | DPE grants an additional limited exception to replace a player; the injured player's salary remains on the books | CBA | SCEN | #30 |
| CBA-C11.4 | CBA-C11 | §6.5 | The long-term injury exclusion removes salary only after termination through waivers, the CBA waiting period, and a jointly selected physician / Fitness-to-Play finding | CBA/EXT | EXTS | #30 |
| CBA-C11.5 | CBA-C11 | §6.5 | Only the team holding the contract when the condition became (or should have become) known may apply for the exclusion | CBA | SCEN | #76 |
| CBA-C11.6 | CBA-C11 | §6.5 | An approved team can never re-sign or reacquire the excluded player | CBA | SCEN | #76 |
| CBA-C11.7 | CBA-C11 | §6.5 | A DPE request, granted or denied, precludes a long-term exclusion request for that player in the same Salary Cap Year | CBA | SCEN | #76 |
| CBA-C11.8 | CBA-C11 | §6.5 | If an excluded player later appears in 25 NBA regular-season/Play-In/playoff games, salary returns for that and later cap years, subject to the elevated-risk exception and timing rules | CBA | SCEN | #76 |
| CBA-C11.9 | CBA-C11 | §12.5 | If a team used a DPE in respect of the disabled player, trading that player in the same cap year cannot generate a TPE; the restriction does not attach to the replacement; the DPE extinguishes if the disabled player returns or is traded before use | CBA | SCEN | #29 |
| CBA-C12.1 | CBA-C12 | §3 | DPE medical test is 'unable to play through the following June 15', not 'likely to return by' | CBA | SCEN | #29 |
| CBA-C12.2 | CBA-C12 | §7.3 | DPE: lesser of 50% of the disabled player's salary or the NTMLE; one-season or remaining-term contract; application July 1 - January 15; expires March 10; extinguishes before use if the disabled player returns or is traded | CBA/EXT | EXTS | #29 |
| CBA-C13.1 | CBA-C13 | §4.1 | Exception-inventory ledger: amount, used portion, allowed method, apron ceiling, expiration, hard-cap effect | CBA | SCEN | #62 |
| CBA-C13.2 | CBA-C13 | §4.4 | Exception creation, use, partial use, renunciation, and expiration | CBA | LIFECYCLE | #6, #28 |
| CBA-C13.3 | CBA-C13 | §7.1 | Different exceptions generally cannot be aggregated to sign or acquire one player | CBA | SCEN | #62 |
| CBA-C13.4 | CBA-C13 | §7.1 | Most unused exceptions begin daily proration on January 10; the Minimum Exception prorates from the season start; DPE and TPE do not prorate | CBA | SCEN | #62 |
| CBA-C13.5 | CBA-C13 | §7.1 | Full exception value may remain relevant for a trade or offer sheet where the rule permits | CBA | SCEN | #62 |
| CBA-C13.6 | CBA-C13 | §7.1 | Exception usage must track the allowed transaction method: signing, trade, waiver claim, or a subset | CBA | SCEN | #62 |
| CBA-C13.7 | CBA-C13 | §7.3 | NTMLE: sign/trade/claim/offer-sheet match, divisible, up to 4 years and 5% changes; must land at/below the First Apron; use creates a First Apron hard cap unless terms fit TMLE treatment | CBA | SCEN | #16 |
| CBA-C13.8 | CBA-C13 | §7.3 | TMLE: signing only, divisible, up to 2 years and 5% changes; must land at/below the Second Apron; use creates a Second Apron hard cap and disables specified First-Apron-team tools | CBA | SCEN | #18 |
| CBA-C13.9 | CBA-C13 | §7.3 | Room MLE: up to 3 years and 5% changes; mutually exclusive with NTMLE, TMLE, and BAE | CBA | SCEN | #28 |
| CBA-C13.10 | CBA-C13 | §7.3 | BAE: sign/trade/claim, divisible, up to 2 years and 5% changes, unavailable in consecutive years; First Apron transaction and hard cap | CBA | SCEN | #17 |
| CBA-C13.11 | CBA-C13 | §7.3 | Second Round Pick Exception: prescribed 2+option or 3+option structures at minimum-based salaries | CBA | SCEN | #62 |
| CBA-C13.12 | CBA-C13 | §7.3 | SRPE amounts are temporarily excluded from Team Salary through July 30 but added to Apron Salary | CBA | SCEN | #62 |
| CBA-C13.13 | CBA-C13 | §7.3 | Rookie Scale Exception: over-cap authority to sign the team's own first-round pick to a Rookie Scale contract | CBA | SCEN | #26 |
| CBA-C13.14 | CBA-C13 | §10.1 | A UFA can sign via cap room, an applicable exception, Bird rights with the prior team, or a sign-and-trade | CBA | SCEN | #62 |
| CBA-C13.15 | CBA-C13 | §13.2 | Second-round picks may sign via the Second Round Pick Exception, Minimum Exception, a Two-Way contract, cap room, or another valid path | CBA | SCEN | #62 |
| CBA-C14.1 | CBA-C14 | §4.2 | Bird-rights type and clock persisted | CBA | LIFECYCLE | #40 |
| CBA-C14.2 | CBA-C14 | §6.3 | Renouncing a veteran free-agent hold removes it and ordinarily sacrifices the signing use of Bird rights, though re-signing can continue the underlying clock | CBA | SCEN | #28 |
| CBA-C14.3 | CBA-C14 | §6.3 | A team can renounce from Early Bird down to Non-Bird to avoid the Early Bird minimum term | CBA | SCEN | #63 |
| CBA-C14.4 | CBA-C14 | §7.2 | Bird first-year signing authority by type: Non-Bird greater of 120% of prior salary or minimum; Early Bird greater of 175% of prior or 105% of average salary; Full Bird up to the maximum | CBA | SCEN | #24 |
| CBA-C14.5 | CBA-C14 | §7.2 | Bird term and raise limits: Non-Bird up to 4 years / 5%; Early Bird 2-4 years / 8%; Full Bird up to 5 years / 8% | CBA | SCEN | #63 |
| CBA-C14.6 | CBA-C14 | §7.2 | Trades and waiver claims generally transfer the Bird clock | CBA | SCEN | #63 |
| CBA-C14.7 | CBA-C14 | §7.2 | A waiver during the most recent contract can reset the clock; a waiver during an earlier completed contract does not necessarily erase accumulated seasons | CBA | SCEN | #63 |
| CBA-C14.8 | CBA-C14 | §7.2 | Certain one-year contracts that would create Full/Early Bird rights lose them on trade and generate an automatic consent right unless waived | CBA | SCEN | #40 |
| CBA-C14.9 | CBA-C14 | §12.10 | Automatic consent rights can arise on a one-year contract when a trade would reduce Full/Early Bird rights; the player can waive that right | CBA | SCEN | #40 |
| CBA-C15.1 | CBA-C15 | §10.3 | The offering team must preserve sufficient room throughout the matching process | CBA | SCEN | #64 |
| CBA-C15.2 | CBA-C15 | §10.3 | Arenas: Years 1-2 limited and Years 3-4 can jump; the offering team uses average annual salary for room/Team Salary; the matching team may use the stated schedule or, in specified below-cap circumstances, elect averaging | CBA | SCEN | #64 |
| CBA-C16.1 | CBA-C16 | §5.4 | Rookie Scale: four seasons, Years 1-2 guaranteed, Team Options in Years 3-4 | CBA | SCEN | #26 |
| CBA-C16.2 | CBA-C16 | §5.4 | Salary plus unlikely bonuses may range from 80% to 120% of the slot's Rookie Scale Amount | CBA | SCEN | #26 |
| CBA-C16.3 | CBA-C16 | §5.4 | Rookie option decisions are due by October 31 in the preceding season | CBA | SCEN | #65 |
| CBA-C16.4 | CBA-C16 | §5.4 | Declining either option leads to UFA status and caps the prior team's new first-year offer at the declined option amount | CBA | SCEN | #65 |
| CBA-C16.5 | CBA-C16 | §5.5 | A Standard contract may have one option year; Rookie Scale contracts have two prescribed Team Options | CBA | SCEN | #65 |
| CBA-C16.6 | CBA-C16 | §5.7 | Maximum salary is 25/30/35% of cap by YOS, subject to the 105%-of-prior-salary override and Higher Max criteria; it includes Salary plus unlikely bonuses | CBA | SCEN | #65 |
| CBA-C16.7 | CBA-C16 | §5.7 | Higher Max eligibility depends on specified MVP, DPOY, or All-NBA achievements and award game thresholds | CBA | SCEN | #65 |
| CBA-C16.8 | CBA-C16 | §10.4 | A Rookie Scale extension requires exercised options and signature in the prescribed window before the fourth regular season | CBA | SCEN | #65 |
| CBA-C16.9 | CBA-C16 | §10.4 | Starting salary can reach the normal maximum, with conditional 25%-30% Higher Max language | CBA | SCEN | #65 |
| CBA-C16.10 | CBA-C16 | §10.4 | Term and raises depend on salary level; up to 8% changes | CBA | SCEN | #65 |
| CBA-C16.11 | CBA-C16 | §10.4 | Veteran extension eligibility depends on existing term, signing/renegotiation date, remaining seasons, and projected Full Bird status | CBA | SCEN | #65 |
| CBA-C16.12 | CBA-C16 | §10.4 | General first-year extended salary is the greater of 140% of final regular salary or 140% of EAPS, subject to maximum salary and bonus adjustments | CBA | SCEN | #65 |
| CBA-C16.13 | CBA-C16 | §10.4 | Designated Veteran / Supermax rules add YOS, original-team/trade-history, honor, term, and one-year trade restrictions | CBA | SCEN | #41 |
| CBA-C16.14 | CBA-C16 | §10.4 | A Designated Veteran Extension cannot include Incentive Compensation | CBA | SCEN | #65 |
| CBA-C17.1 | CBA-C17 | §5.8 | Over-38 applies to a contract/extension/renegotiation covering at least four seasons when the player is 38 on October 1 of a covered season | CBA | SCEN | #44 |
| CBA-C17.2 | CBA-C17 | §5.8 | A narrow moratorium-birthday rule can use age as of the prior June 30 | CBA | SCEN | #66 |
| CBA-C17.3 | CBA-C17 | §5.8 | For a non-Full-Bird case, Over-38 Years begin at the later of the fourth contract year or the first October 1 on which the player is 38 | CBA | SCEN | #44 |
| CBA-C17.4 | CBA-C17 | §5.8 | Full Bird players aged 35-36 re-signing with the prior team get special treatment (four-year deal may avoid reallocation; five-year reallocates only Year 5); a sign-and-trade gets no relief | CBA | SCEN | #44 |
| CBA-C17.5 | CBA-C17 | §5.8 | Salary from Over-38 Years is initially reallocated proportionally across non-Over-38 Years | CBA | SCEN | #44 |
| CBA-C17.6 | CBA-C17 | §5.8 | Reattribution can recur on July 1 while the contract is active and an Over-38 Year is within two years | CBA | SCEN | #44 |
| CBA-C17.7 | CBA-C17 | §5.8 | Required inputs: DOB, signing date, origin, term, Bird status, sign-and-trade status, annual salary, guarantee state, historical active status | CBA | SCEN | #66 |
| CBA-C18 | *(none — top-level leaf)* | §5.9 | A signing bonus is allocated over the covered Salary Cap Years (for a trade-earned §3(b)(1)(ii) bonus, over the then-current and any remaining Salary Cap Years) in proportion to the percentage of Base Compensation in each year that is protected for lack of skill at allocation time; with an ETO, allocation runs only over years preceding the ETO's effective season; if no Base Compensation is protected for lack of skill, the whole bonus is allocated to the first Salary Cap Year (for a trade-earned bonus, the Salary Cap Year of the trade) | CBA VII §3(b)(2) pp. 200–201 | SCEN | #67 |
| CBA-C19.1 | CBA-C19 | §5.1 | Ten-Day contracts open January 5, last the longer of ten days or three team games; max two with one team | CBA | SCEN | #71 |
| CBA-C19.2 | CBA-C19 | §5.1 | Concurrent Ten-Day capacity by Standard roster size (12->0, 13->1, 14->2, 15->3); hardship can expand it | CBA | SCEN | #71 |
| CBA-C19.3 | CBA-C19 | §5.1 | Ten-Day contracts bypass the waiver process; written termination is immediate | CBA | SCEN | #71 |
| CBA-C19.4 | CBA-C19 | §5.1 | Rest-of-Season contracts are Standard contracts prorated by remaining regular-season days; future seasons may be included | CBA | SCEN | #71 |
| CBA-C19.5 | CBA-C19 | §5.1 | Proration flows into cap, apron, tax, exception usage, and threshold planning | CBA | SCEN | #71 |
| CBA-C19.6 | CBA-C19 | §14 | The January 5 Ten-Day opening has no owning contract rule in the register (see 5.1) | CBA | SCEN | #71 |
| CBA-C20.1 | CBA-C20 | §5.2 | Up to three Two-Ways; they do not consume Standard spots and normally do not count in Team Salary | CBA | SCEN | #38 |
| CBA-C20.2 | CBA-C20 | §5.2 | Two-Way eligibility generally requires no more than four YOS, with a narrow four-YOS exception | CBA | SCEN | #72 |
| CBA-C20.3 | CBA-C20 | §5.2 | No Two-Way if the player has been under a Two-Way with that team in more than three Salary Cap Years | CBA | SCEN | #72 |
| CBA-C20.4 | CBA-C20 | §5.2 | A Two-Way covers at most two seasons with no Option Year or ETO; no bonuses or Incentive Compensation of any kind, deferred compensation, or loans; standard payment schedule except the express Advance — a Two-Way partially protected for lack of skill and injury/illness at signing may be amended to pay up to 50% of the protected Base Compensation prior to November 1, deducted from subsequent installments | CBA II §11(a)(iii),(v) pp. 50–51; §11(d) p. 54 | SCEN | #72 |
| CBA-C20.5 | CBA-C20 | §5.2 | Conversion to Standard at the applicable minimum for the same remaining term, or replacement by a newly negotiated Standard contract if the team has the mechanism | CBA | SCEN | #72 |
| CBA-C20.6 | CBA-C20 | §5.2 | The conversion option may be exercised at any point during the period beginning on July 1 (July 1 itself is legal) and ending just prior to the start of the team's last regular-season game, in each Salary Cap Year covered | CBA II §11(f) pp. 54–55 | SCEN | #72 |
| CBA-C20.7 | CBA-C20 | §5.2 | Two-Way contracts count as $0 in trade salary and create no TPE | CBA | SCEN | #72 |
| CBA-C20.8 | CBA-C20 | §13.2 | Undrafted rookies are free agents immediately after the draft and need an ordinary signing mechanism or a Two-Way contract | CBA | SCEN | #72 |
| CBA-C20.9 | CBA-C20 | §14 | The March 4 Two-Way signing deadline has no owning contract rule in the register (see 5.2) | CBA | SCEN | #72 |
| CBA-C21.1 | CBA-C21 | §3 | A qualifying Exhibit 9 carries a $15,000 injury termination fee plus eligibility prerequisites | CBA | SCEN | #73 |
| CBA-C21.2 | CBA-C21 | §5.3 | Exhibit 10: one-season minimum Standard contract, generally non-guaranteed, convertible to a Two-Way before the first regular-season day | CBA | SCEN | #73 |
| CBA-C21.3 | CBA-C21 | §5.3 | A team may hold no more than six Exhibit 10 contracts at once | CBA | SCEN | #73 |
| CBA-C21.4 | CBA-C21 | §5.3 | Conversion rescinds the Exhibit 10 bonus and triggers the conversion protection amount | CBA | SCEN | #73 |
| CBA-C21.5 | CBA-C21 | §5.3 | The bonus/protection range is cap-indexed and the two amounts must match when both are present | CBA | SCEN | #73 |
| CBA-C21.6 | CBA-C21 | §5.3 | The Exhibit 10 bonus is excluded from Team Salary; payment depends on preseason waiver, timely G League assignment/reporting, and 60 consecutive days of service | CBA | SCEN | #73 |
| CBA-C21.7 | CBA-C21 | §5.3 | Trading an Exhibit 10 can create a deemed bonus when specified conditions exist | CBA | SCEN | #73 |
| CBA-C21.8 | CBA-C21 | §5.3 | Exhibit 9: one-season non-guaranteed camp contract at a minimum/two-way salary with a $15,000 injury termination fee | CBA | SCEN | #73 |
| CBA-C21.9 | CBA-C21 | §5.3 | Exhibit 9 salary is normally excluded from Team Salary until the regular season begins | CBA | SCEN | #73 |
| CBA-C21.10 | CBA-C21 | §5.3 | Exhibit 9 requires at least 14 other players on non-Exhibit-9 contracts and is limited to six Exhibit 9 contracts | CBA | SCEN | #73 |
| CBA-C21.11 | CBA-C21 | §5.3 | If an Exhibit 9 player is retained into the regular season, the team needs room or an applicable exception | CBA | SCEN | #73 |
| CBA-C22.1 | CBA-C22 | §5.6 | Protection generally cannot increase by percentage in a later season unless conditioned on something that cannot occur until the earlier season ends | CBA | SCEN | #70 |
| CBA-C22.2 | CBA-C22 | §5.7 | Minimum contracts generally prohibit bonuses, excepting trade bonuses, Exhibit 10 bonuses, and allowed international payment treatment | CBA | SCEN | #70 |
| CBA-C22.3 | CBA-C22 | §5.7 | A future percentage-based maximum must be adjusted on the applicable July 1; excess is reduced in order: signing bonus, then incentive compensation, then base compensation | CBA | SCEN | #70 |
| CBA-C22.4 | CBA-C22 | §5.7 | Raise/decrease limits are 5% (8% where permitted), measured from Year 1 rather than compounded; sign-and-trade and extend-and-trade use stricter limits | CBA | SCEN | #70 |
| CBA-C23.1 | CBA-C23 | §3 | Validate both incentive caps: Incentive Compensation for a season <=20% of the Regular Salary called for by the contract; Unlikely Bonuses in a Salary Cap Year <=15% of the player's Regular Salary at signing — the denominator is Regular Salary, not Base Compensation; §5(b)(1)'s two provisos apply: an Extension signed in a year whose Unlikely Bonuses already exceed the 15% percentage may carry up to that same percentage into the first year of the extended term, and no Renegotiation may increase Unlikely Bonuses past 15% of Regular Salary for any covered year | CBA II §12(a)(i) p. 58; VII §5(b)(1) p. 229 | SCEN | #68 |
| CBA-C23.2 | CBA-C23 | §5.9 | A signing bonus may not exceed 15% of total compensation excluding incentives; in an offer sheet the limit is 10% | CBA | SCEN | #68 |
| CBA-C23.3 | CBA-C23 | §5.9 | Deferred compensation counts in the season earned, not the season paid, and is generally limited to 25% of that season's compensation | CBA | SCEN | #68 |
| CBA-C23.4 | CBA-C23 | §5.9 | Incentive Compensation for a season <=20% of Regular Salary; Unlikely Bonuses in a Salary Cap Year <=15% of Regular Salary at signing, with two provisos: an Extension signed in a year whose Unlikely Bonuses already exceed the 15% percentage may carry up to that same percentage into the first year of the extended term, and no Renegotiation may increase Unlikely Bonuses past 15% of Regular Salary for any covered year | CBA II §12(a)(i) p. 58; VII §5(b)(1) p. 229 | SCEN | #68 |
| CBA-C23.5 | CBA-C23 | §5.9 | EIPPA is a fixed schedule (+$25K/yr), usable once per three Salary Cap Years, blocks a Two-Way/Exhibit 10 path for the specified period, and any excess is treated as a signing bonus and Salary | CBA | SCEN | #68 |
| CBA-C23.6 | CBA-C23 | §5.9 | Below-market loan interest can be imputed as Salary; premium reimbursements may be excluded when requirements are met | CBA | SCEN | #68 |
| CBA-C24.1 | CBA-C24 | §3 | An RFA-triggering option must be exercised prior to June 25; encode the legal comparison, not the label | CBA | SCEN | #69 |
| CBA-C24.2 | CBA-C24 | §5.5 | An option covers one season, cannot be conditional, cannot reduce salary/likely/unlikely bonuses, and otherwise carries unchanged terms and protection (other than the Base Compensation payment schedule) — except that a contract signed pursuant to the Second Round Pick Exception is exempt from the Team Option unchanged-terms requirement | CBA XII §1(v) p. 336 | SCEN | #69 |
| CBA-C24.3 | CBA-C24 | §5.5 | Standard option deadline is June 29 at 5:00 p.m. ET | CBA | SCEN | #43 |
| CBA-C24.4 | CBA-C24 | §5.5 | An option in favor of a player who would otherwise become an RFA must be exercised prior to June 25 | CBA | SCEN | #69 |
| CBA-C24.5 | CBA-C24 | §5.5 | An ETO is a player termination right, exercisable only once, that takes effect no earlier than the end of the fourth season of the contract (the earliest season it can eliminate is the fifth); it cannot be conditional, its effective season is fixed at signing, and it must be exercised by 5:00 p.m. ET on the June 29 immediately prior to its effective season | CBA XII §2(b) p. 337; §3–§4 p. 338 | SCEN | #69 |
| CBA-C24.6 | CBA-C24 | §5.5 | Exercising an ETO prevents a later extension; signing an applicable extension may require eliminating the ETO | CBA | SCEN | #69 |
| CBA-C24.7 | CBA-C24 | §5.6 | Team and Player Option years have different pre-exercise protection behavior | CBA | SCEN | #69 |
| CBA-C25.1 | CBA-C25 | §6.1 | Team Salary includes retired players under contract and circumvention-related imputed amounts | CBA | SCEN | #74 |
| CBA-C25.2 | CBA-C25 | §6.1 | Team Salary includes pending contracts required to be reported | CBA | SCEN | #74 |
| CBA-C25.3 | CBA-C25 | §6.1 | Team Salary includes a portion of current/future grievance exposure, with later reconciliation | CBA/EXT | EXTS | #74 |

#### R series — Waivers and rosters

| LEAF ID | Parent | Canon § | Condition | Authority | Method | Scenario |
|---|---|---|---|---|---|---|
| CBA-R01.1 | CBA-R01 | §4.3 | Open slots at the instant a trade or waiver claim occurs | CBA/BYL | LIFECYCLE | #36 |
| CBA-R01.2 | CBA-R01 | §4.4 | Waiver request, clearance, claim, buyout, stretch-election, and set-off dates | BYL/CBA | LIFECYCLE | #34, #35 |
| CBA-R01.3 | CBA-R01 | §6.1 | Team Salary includes contracts assigned by trade or waiver claim | CBA | SCEN | #77 |
| CBA-R01.4 | CBA-R01 | §9.4 | A waiver request frees a roster spot immediately; the team need not wait for the player to clear | BYL | SCEN | #77 |
| CBA-R01.5 | CBA-R01 | §9.4 | A waiver claimant must have an open slot and sufficient room or exception authority | BYL | SCEN | #77 |
| CBA-R01.6 | CBA-R01 | §11.1 | The standard waiver period is 48 hours and the request cannot be withdrawn | BYL | SCEN | #77 |
| CBA-R01.7 | CBA-R01 | §11.1 | Roster spot and non-guaranteed salary are freed at request time | BYL/CBA | SCEN | #77 |
| CBA-R01.8 | CBA-R01 | §11.1 | A claiming team assumes the full contract and receives a 30-day trade restriction | BYL | SCEN | #41 |
| CBA-R01.9 | CBA-R01 | §11.1 | Claim priority uses record with date-dependent season selection and tie breakers | BYL | SCEN | #77 |
| CBA-R01.10 | CBA-R01 | §11.1 | A player requested after March 1 generally cannot join another team's postseason roster | BYL | SCEN | #77 |
| CBA-R02.1 | CBA-R02 | §4.1 | Dead-salary schedule ledger: protection, buyout allocation, stretch election, set-off reductions | CBA | SCEN | #78 |
| CBA-R02.2 | CBA-R02 | §5.6 | January 10 is the universal current-season guarantee date; the practical cut request is around January 7 | CBA | SCEN | #31, #32 |
| CBA-R02.3 | CBA-R02 | §5.6 | Before that date, earned compensation can exceed stated protection and become the controlling dead-salary amount | CBA | SCEN | #31, #32 |
| CBA-R02.4 | CBA-R02 | §6.1 | Team Salary includes protected/dead salary of waived players with stretch/buyout/set-off treatment | CBA | SCEN | #31, #34, #35 |
| CBA-R02.5 | CBA-R02 | §11.2 | If unclaimed, protected compensation remains as dead salary; unearned unprotected compensation and ordinary bonuses do not | CBA | SCEN | #31, #32 |
| CBA-R02.6 | CBA-R02 | §11.2 | Before January 10, current-year dead salary is the greater of earned base compensation and the protected amount | CBA | SCEN | #31, #32 |
| CBA-R02.7 | CBA-R02 | §11.2 | ETO years are treated as guaranteed for dead salary; Team Options not yet exercised are not; Player Options depend on contract language | CBA | SCEN | #78 |
| CBA-R03 | *(none — top-level leaf)* | §11.2 | Use actual base compensation, not the subsidized cap amount, for a waived veteran-minimum player | CBA | SCEN | #33 |
| CBA-R04.1 | CBA-R04 | §11.3 | A stretch election spreads applicable dead salary over twice the remaining seasons plus one | CBA | SCEN | #34 |
| CBA-R04.2 | CBA-R04 | §11.3 | A July 1 - August 31 election includes the current season; a September 1 - June 30 election leaves current-year dead salary untouched and stretches future amounts | CBA | SCEN | #34 |
| CBA-R04.3 | CBA-R04 | §11.3 | The contract must be terminated before the September 1 preceding its final season, and the stretch elected before that same September 1 | CBA | SCEN | #34 |
| CBA-R04.4 | CBA-R04 | §11.3 | A stretch is unavailable if future-year Team Salary attributable to all waived/former players already exceeds, or would exceed, 15% of the cap in effect at election | CBA | SCEN | #34 |
| CBA-R04.5 | CBA-R04 | §11.3 | A team that stretches cannot re-sign or reacquire the player before the July 1 following the last season of the terminated contract, including an option year | CBA | SCEN | #80 |
| CBA-R04.6 | CBA-R04 | §11.3 | Payment timing and Team Salary allocation are separate decisions | CBA | SCEN | #80 |
| CBA-R05.1 | CBA-R05 | §11.4 | A buyout reduces protected compensation in exchange for release and reallocates the reduced dead salary proportionally across affected seasons | CBA | SCEN | #35 |
| CBA-R05.2 | CBA-R05 | §11.4 | Set-off can reduce a prior team's obligation when the waived player earns compensation elsewhere during the original term | CBA | SCEN | #35 |
| CBA-R05.3 | CBA-R05 | §11.4 | Set-off formula: new compensation minus the applicable 0-YOS or 1-YOS minimum, then 50% of the positive remainder, with detailed deferred/non-NBA treatment | CBA | SCEN | #35 |
| CBA-R05.4 | CBA-R05 | §11.4 | Set-off allocation follows the relevant dead-salary schedule; a buyout may waive or reduce set-off rights | CBA | SCEN | #81 |
| CBA-R05.5 | CBA-R05 | §11.4 | Re-signing restrictions apply after a trade/waive or a buyout | CBA | SCEN | #81 |
| CBA-R06.1 | CBA-R06 | §4.3 | Per team: Standard-contract count, active-list count, two-way count, offseason count | CBA/BYL | LIFECYCLE | #37, #39 |
| CBA-R06.2 | CBA-R06 | §9.1 | Active + inactive list is normally 14-15 Standard players | CBA/BYL | SCEN | #37 |
| CBA-R06.3 | CBA-R06 | §9.1 | Temporary shortage to 12 or 13 for no more than two consecutive weeks and 28 total days in the season | CBA/BYL | SCEN | #37 |
| CBA-R06.4 | CBA-R06 | §9.1 | Active list is normally 12-15, with a temporary 11-player window under similar limits | CBA/BYL | SCEN | #79 |
| CBA-R06.5 | CBA-R06 | §9.1 | At least eight players must be available on the bench | BYL | SCEN | #79 |
| CBA-R06.6 | CBA-R06 | §9.1 | Up to three Two-Way contracts, separate from Standard minimum/maximum counts | CBA | SCEN | #38 |
| CBA-R07 | *(none — top-level leaf)* | §4.3 | Short-roster consecutive-day and season-total clocks | CBA | LIFECYCLE | #37 |
| CBA-R08.1 | CBA-R08 | §4.3 | Under-Fifteen Games accumulation | CBA | LIFECYCLE | #38 |
| CBA-R08.2 | CBA-R08 | §4.3 | Two-way active-game usage | CBA | LIFECYCLE | #38 |
| CBA-R08.3 | CBA-R08 | §5.2 | A Two-Way player may be active for no more than 50 games, prorated after a late signing | CBA | SCEN | #38 |
| CBA-R08.4 | CBA-R08 | §5.2 | Teams face a 90 Under-Fifteen-Games limit when Two-Way players are active below 15 signed Standard players | CBA | SCEN | #38 |
| CBA-R08.5 | CBA-R08 | §9.3 | Track per-player two-way maximum active games and team-wide Under-Fifteen Games | CBA | SCEN | #38 |
| CBA-R09.1 | CBA-R09 | §9.2 | After the 14-15 Standard requirement ends, the aggregate offseason maximum is 21 across Active, Inactive, and Two-Way lists | CBA | SCEN | #39 |
| CBA-R09.2 | CBA-R09 | §9.2 | On the day after the league's last day of Season, Inactive/Two-Way players transfer to the Active List (max 21 including Two-Ways) until the day before the next regular season; a playoff team's elimination is not the league's last day | CBA | SCEN | #39 |
| CBA-R10.1 | CBA-R10 | §4.3 | Per player: Standard/Two-Way/Exhibit contract type and current list (active, inactive, two-way, voluntarily retired, suspended) | CBA/BYL | LIFECYCLE | #82 |
| CBA-R10.2 | CBA-R10 | §4.3 | Hardship and treatment-program exceptions | CBA/EXT | EXTS | #82 |
| CBA-R10.3 | CBA-R10 | §9.1 | A league suspension can open a spot after the fifth game; a team suspension after the third | CBA/BYL | SCEN | #82 |
| CBA-R10.4 | CBA-R10 | §9.1 | Hardship and specified treatment-program rules can permit more than the normal maximum | CBA/EXT | EXTS | #82 |

#### L series — Rights, dates, and GM lifecycle

| LEAF ID | Parent | Canon § | Condition | Authority | Method | Scenario |
|---|---|---|---|---|---|---|
| CBA-L01.1 | CBA-L01 | §4.4 | Evaluate an explicit asOfDate and Salary Cap Year; never infer 'today' | CBA | LIFECYCLE | #83 |
| CBA-L01.2 | CBA-L01 | §4.4 | Regular-season start/end and the number of elapsed season days | NBA | LIFECYCLE | #7 |
| CBA-L01.3 | CBA-L01 | §10.1 | Negotiation/signing timing and the July Moratorium govern free-agent signings | CBA | SCEN | #41 |
| CBA-L01.4 | CBA-L01 | §14 | Architect must expose a transaction date and automatically apply the appropriate calendar version | CBA/NBA | SCEN | #83 |
| CBA-L01.5 | CBA-L01 | §14 | The critical event set is represented on the calendar: July 1 rollover/moratorium, moratorium end, tender/QO/option deadlines, first regular-season day, January 5, January 8, January 10, January 15, March 1, March 4, March 10, trade deadline/playoff restrictions, end of regular season, June 29, June 30 | CBA/NBA | SCEN | #83 |
| CBA-L02.1 | CBA-L02 | §4.4 | Contract signing, amendment, conversion, option, ETO, extension, and renegotiation dates | CBA | LIFECYCLE | #43 |
| CBA-L02.2 | CBA-L02 | §4.4 | Guarantee trigger dates and protection changes | CBA | LIFECYCLE | #8 |
| CBA-L02.3 | CBA-L02 | §5.6 | Base compensation can be protected for lack of skill and specified injury/illness categories | CBA | SCEN | #31 |
| CBA-L02.4 | CBA-L02 | §5.6 | Protection may be partial, conditional, date-triggered, performance-triggered, or subject to a prior-injury exclusion | CBA | SCEN | #8 |
| CBA-L02.5 | CBA-L02 | §10.5 | Renegotiation requires cap space, an original contract covering at least four seasons, and generally the third anniversary | CBA | SCEN | #85 |
| CBA-L02.6 | CBA-L02 | §10.5 | Renegotiation is unavailable March 1 through June 30 | CBA | SCEN | #85 |
| CBA-L02.7 | CBA-L02 | §10.5 | Renegotiation can raise current salary and bonuses only within cap room and cannot simply lower existing salary | CBA | SCEN | #85 |
| CBA-L02.8 | CBA-L02 | §10.5 | Renegotiate-and-extend may allow up to a 40% drop into the extended term under its specific rules | CBA | SCEN | #85 |
| CBA-L03.1 | CBA-L03 | §4.2 | Player consent and no-trade status persisted | CBA | LIFECYCLE | #40 |
| CBA-L03.2 | CBA-L03 | §4.2 | Signing, extension, renegotiation, trade, waiver-claim, and re-sign restrictions with start and end dates | CBA | LIFECYCLE | #41 |
| CBA-L03.3 | CBA-L03 | §4.4 | Trade date and physical-contingency state | BYL/EXT | EXTS | #86 |
| CBA-L03.4 | CBA-L03 | §5.4 | First-round signees cannot be traded for 30 days after signing; draft rights can be traded immediately | CBA/BYL | SCEN | #41 |
| CBA-L03.5 | CBA-L03 | §10.3 | Matched contracts cannot be amended for one year, and trade restrictions apply including a one-year ban on trading to the offering team | CBA | SCEN | #42 |
| CBA-L03.6 | CBA-L03 | §10.4 | A six-month rule prevents a richer extension immediately before or after a trade | CBA | SCEN | #41 |
| CBA-L03.7 | CBA-L03 | §10.5 | A renegotiated player cannot be traded for six months | CBA | SCEN | #41 |
| CBA-L03.8 | CBA-L03 | §12.10 | An express no-trade clause requires at least eight YOS and four YOS with the signing team | CBA | SCEN | #86 |
| CBA-L03.9 | CBA-L03 | §12.10 | Matched RFA offer sheets and other transactions create separate consent/recipient restrictions | CBA | SCEN | #42 |
| CBA-L03.10 | CBA-L03 | §12.11 | The validator needs a rule-generated tradeEligibleOn plus recipient/consent constraints rather than one generic date | CBA | SCEN | #41 |
| CBA-L03.11 | CBA-L03 | §12.11 | Later of three months or December 15 for ordinary free-agent signings | CBA | SCEN | #41 |
| CBA-L03.12 | CBA-L03 | §12.11 | Later of three months or January 15 for specified Bird-rights re-signings | CBA | SCEN | #41 |
| CBA-L03.13 | CBA-L03 | §12.11 | 30 days after a Two-Way signing in the specified contexts | CBA | SCEN | #86 |
| CBA-L03.14 | CBA-L03 | §12.11 | End-of-season option/ETO trade restrictions | CBA | SCEN | #43 |
| CBA-L03.15 | CBA-L03 | §12.11 | Window restrictions: July Moratorium, trade deadline, playoffs, lottery, and draft-day asset windows | CBA/BYL | SCEN | #86 |
| CBA-L04.1 | CBA-L04 | §4.2 | RFA / QO / offer-sheet / matching status persisted | CBA | LIFECYCLE | #25 |
| CBA-L04.2 | CBA-L04 | §4.4 | QO, offer sheet, ROFR notice, renunciation, and unrenunciation dates | CBA | LIFECYCLE | #25 |
| CBA-L04.3 | CBA-L04 | §6.1 | Team Salary includes outstanding offer sheets | CBA | SCEN | #25 |
| CBA-L04.4 | CBA-L04 | §6.3 | RFA rights require relinquishing matching rights, not a simple cap-hold renunciation | CBA | SCEN | #84 |
| CBA-L04.5 | CBA-L04 | §10.1 | Rights status must distinguish free agent, RFA, and retained draft rights | CBA | SCEN | #84 |
| CBA-L04.6 | CBA-L04 | §10.2 | RFA applies to specified first-round players after Year 4, qualifying Two-Way players, and other players with no more than three YOS | CBA | SCEN | #84 |
| CBA-L04.7 | CBA-L04 | §10.2 | The prior team must issue a timely QO to preserve its right of first refusal | CBA | SCEN | #25 |
| CBA-L04.8 | CBA-L04 | §10.2 | A QO must be made by 5:00 p.m. ET on June 29; unless extended it stays open through October 1 and never later than March 1 | CBA | SCEN | #84 |
| CBA-L04.9 | CBA-L04 | §10.2 | The QO may be withdrawn unilaterally through July 13; after that player written consent is required, and a withdrawal on or after July 14 is also treated as a renunciation | CBA | SCEN | #84 |
| CBA-L04.10 | CBA-L04 | §10.2 | QO size can depend on draft slot, prior salary, and starter criteria (starts/minutes) | CBA | SCEN | #84 |
| CBA-L04.11 | CBA-L04 | §10.2 | A standard QO is one year, fully protected for specified reasons, with required payment/term language | CBA | SCEN | #84 |
| CBA-L04.12 | CBA-L04 | §10.2 | A Maximum QO carries maximum base compensation, 8% increases, five seasons, full protection, and no option or ETO | CBA | SCEN | #84 |
| CBA-L04.13 | CBA-L04 | §10.2 | Two-Way RFAs have separate QO rules | CBA | SCEN | #84 |
| CBA-L04.14 | CBA-L04 | §10.2 | Withdrawal dates affect UFA status and whether Bird rights are deemed renounced | CBA | SCEN | #84 |
| CBA-L04.15 | CBA-L04 | §10.3 | The ordinary last date to sign an offer sheet is March 1; it must cover more than one season excluding an option, or more than two if a Maximum QO was tendered | CBA | SCEN | #84 |
| CBA-L04.16 | CBA-L04 | §10.3 | First Refusal Exercise Notice timing: received before noon ET is due 11:59 p.m. the next day; at/after noon, the second following day; a Moratorium offer sheet uses the special July 7 deadline | CBA | SCEN | #84 |
| CBA-L04.17 | CBA-L04 | §10.3 | Matching cannot be used as a sign-and-trade | CBA | SCEN | #84 |
| CBA-L05.1 | CBA-L05 | §4.2 | Draft rights, required tender, non-NBA contract, and cap-hold status persisted | CBA | LIFECYCLE | #26 |
| CBA-L05.2 | CBA-L05 | §4.4 | Draft, required tender, non-NBA contract, and draft-rights dates | CBA | LIFECYCLE | #26 |
| CBA-L05.3 | CBA-L05 | §13.1 | Drafting creates exclusive negotiating rights | CBA | SCEN | #26 |
| CBA-L05.4 | CBA-L05 | §13.1 | Rights persist through timely Required Tenders and qualifying non-NBA contract events | CBA | SCEN | #87 |
| CBA-L05.5 | CBA-L05 | §13.1 | Required Tender deadlines and terms differ for first- and second-round picks | CBA | SCEN | #87 |
| CBA-L05.6 | CBA-L05 | §13.1 | Failure to tender can produce rookie free agency | CBA | SCEN | #87 |
| CBA-L05.7 | CBA-L05 | §13.1 | Draft-and-stash rights need non-NBA contract dates, availability notice, new-tender events, and subsequent-draft rules | CBA | SCEN | #26 |
| CBA-L06.1 | CBA-L06 | §4.2 | Standard TPE amount, source transaction, remaining amount, and expiration | CBA | LIFECYCLE | #6 |
| CBA-L06.2 | CBA-L06 | §12.1 | Step 11: the transaction must create resulting state - TPE balances, hard caps, roster/list assignments, rights, restrictions, picks, and cash balances | CBA | LIFECYCLE | #6 |
| CBA-L06.3 | CBA-L06 | §12.5 | Standard TPE remainder and expiration must persist and support partial use | CBA | LIFECYCLE | #6 |
| CBA-L07 | *(none — top-level leaf)* | §4.2 | Team hard-cap level and trigger event persisted | CBA | LIFECYCLE | #15 |
| CBA-L08.1 | CBA-L08 | §3 | Frozen-pick measurement is Apron Team Salary at the start of the final regular-season game; store the four-year history | CBA | LIFECYCLE | #20 |
| CBA-L08.2 | CBA-L08 | §4.2 | Taxpayer/repeater history and second-apron history | CBA | LIFECYCLE | #20, #21 |
| CBA-L08.3 | CBA-L08 | §8.5 | Apron Team Salary above the Second Apron as of the start of the final regular-season game freezes the first-round pick in the seventh following draft | CBA | LIFECYCLE | #20 |
| CBA-L08.4 | CBA-L08 | §8.5 | Exceeding the Second Apron in at least two of the next four seasons slides the frozen pick to the end of the first round | CBA | LIFECYCLE | #20 |
| CBA-L08.5 | CBA-L08 | §8.5 | At or below the Second Apron in at least three of those four seasons unfreezes the pick the day after the third such regular season, without sliding | CBA | LIFECYCLE | #20 |
| CBA-L08.6 | CBA-L08 | §8.5 | This requires persisted historical team-apron state and future-pick status, not current-year validation alone | CBA | LIFECYCLE | #20 |
| CBA-L09 | *(none — top-level leaf)* | §13.3 | Second Apron frozen picks are unavailable until unfreezing; slid picks have fixed end-of-round placement | CBA | LIFECYCLE | #20 |
| CBA-L10.1 | CBA-L10 | §1.1 | EXT rules must consume an explicit decision/assumption and never drive an automatic verdict | EXT | EXTS | #88 |
| CBA-L10.2 | CBA-L10 | §18 | Physical examinations: represent pending/passed/failed/waived/terms-adjusted; never determine medical fitness | EXT | EXTS | #88 |
| CBA-L10.3 | CBA-L10 | §18 | DPE and career-ending injury findings are inputs; verify consequences after a ruling and warn when the wrong standard is selected | EXT | EXTS | #29 |
| CBA-L10.4 | CBA-L10 | §18 | Bonus-likelihood appeals: preserve an expert override, its source, and its effective date | EXT | EXTS | #88 |
| CBA-L10.5 | CBA-L10 | §18 | Circumvention: warn about suspicious structures, never present them as approved, and issue no definitive legal finding | EXT | EXTS | #88 |
| CBA-L10.6 | CBA-L10 | §18 | Anti-collusion and tampering: negotiation dates are checkable, but communications and intent sit outside the product's data | EXT | EXTS | #88 |
| CBA-L10.7 | CBA-L10 | §18 | Grievances and settlements: known disputed amounts and awards can be entered and allocated; Architect cannot predict the award | EXT | EXTS | #88 |
| CBA-L10.8 | CBA-L10 | §18 | League approvals and hardship exceptions: use an explicit approval record; never infer approval from similar roster conditions | EXT | EXTS | #88 |
| CBA-L10.9 | CBA-L10 | §18 | These states must appear in the UI as 'requires external determination' or 'assumption required', never as unqualified PASS or FAIL | EXT | UI | #88 |

#### S series — Foundation — parameters and provenance

| LEAF ID | Parent | Canon § | Condition | Authority | Method | Scenario |
|---|---|---|---|---|---|---|
| CBA-S01.1 | CBA-S01 | §3.1 | Season parameter set (cap, minimum, tax, both aprons, NTMLE, TMLE, Room MLE) for the current and regression seasons | NBA | STATIC | — |
| CBA-S01.2 | CBA-S01 | §3.1 | Load the complete minimum-salary and Rookie Scale tables; never infer them from current salary or one percentage | CBA | STATIC | — |
| CBA-S01.3 | CBA-S01 | §3.1 | All cap-indexed values live in a season-configuration layer; no example dollars embedded in rule logic | DERIVED | STATIC | — |
| CBA-S01.4 | CBA-S01 | §3.1 | The enumerated per-season configured set (cap/tax/apron/floor, minimum scale, rookie scale, NTMLE/TMLE/Room MLE/BAE/EIPPA, two-way, Exhibit 10, cash limit, bracket width and rates, season day count and deadlines, Expanded TPE scaled amount) | DERIVED | STATIC | — |
| CBA-S01.5 | CBA-S01 | §5.7 | Minimum salary depends on YOS and the year the contract began; multi-year minimum scales move by contract year | CBA | STATIC | — |
| CBA-S01.6 | CBA-S01 | §14 | Season-specific dates (trade deadline, game calendar) must be versioned; they are not permanent constants | NBA | STATIC | — |
| CBA-S02.1 | CBA-S02 | §1.2 | On a source change, update the source/parameter layer and rerun tests; never silently edit a hard-coded result | DERIVED | STATIC | — |
| CBA-S02.2 | CBA-S02 | §3 | One canonical, validated source per season value (TMLE $5.685M vs $5.585M conflict) | DERIVED | STATIC | — |
| CBA-S02.3 | CBA-S02 | §3 | Do not duplicate constants across calculators (tax-bracket width conflict) | DERIVED | STATIC | — |
| CBA-S02.4 | CBA-S02 | §3.1 | Each constant has exactly one canonical sourced value, and the enforcing code path must read the audited constant | DERIVED | STATIC | — |
| CBA-S03.1 | CBA-S03 | §1.1 | OPS rules must stay configurable, carry visible provenance, and never be presented as CBA language | OPS | STATIC | — |
| CBA-S03.2 | CBA-S03 | §9.3 | A potential CBA adjustment (Standard minimum to 15, or fewer Two-Way spots, based on league-wide roster averages) must be a configurable league rule, not a permanent constant | OPS | STATIC | — |
| CBA-S03.3 | CBA-S03 | §17 | OPS and EXT rules stay visibly labeled and configurable and are never promoted to CBA-verified through repetition | OPS | STATIC | — |
| CBA-S04.1 | CBA-S04 | §3.1 | Expanded TPE derivation: A = $7.5M x cap / $136.021M; crossovers A-K and 4(A-K); never round A before a crossover | DERIVED | SCEN | #1 |
| CBA-S04.2 | CBA-S04 | §3.1 | Additional derived amounts: BAE 3.32% of cap, cash limits 5.15% of cap, EIPPA fixed $0.900M, tax-bracket width $5M x cap / $136.021M | DERIVED | SCEN | #61 |

### 15.8 Index amendment — coverage, methods, and non-code dispositions (v1.1)

**Every substantive obligation stated anywhere in this canon is owned by exactly one LEAF identifier.** Totals are computed mechanically from §15.5–§15.7, not counted by eye.

| Measure | Count |
|---|---:|
| Substantive implementation obligations | **368** |
| LEAF identifiers (the auditable universe) | **368** |
| GROUP identifiers (navigation/rollup only) | **59** |
| Registry nodes | **427** |
| Top-level IDs (56 preserved + 14 added) | **70** |
| Sub-IDs | **357** |
| Obligations left partially indexed or unowned | **0** |
| Acceptance scenarios | **89** |

**Verification methods are carried by LEAF identifiers only.** A GROUP has no verification method of its own.

| Verification method | LEAF obligations |
|---|---:|
| SCEN — Executable scenario | 306 |
| LIFECYCLE — Lifecycle/state review | 32 |
| EXTS — External-state handling | 16 |
| STATIC — Static/configuration inspection | 13 |
| UI — Manual UI review | 1 |
| **Total** | **368** |

**Non-code verification dispositions.** Seventeen rows of canon prose legislate the *audit and canon-maintenance process* rather than engine behavior. They mint no audit ID, are not LEAF obligations, and can never produce an Architect verdict. They are recorded here so the index is provably complete rather than silently short.

| Canon § | Obligation | Disposition |
|---|---|---|
| §1.1 | Conflict order: signed CBA > By-Laws > NBA release > CBA 101 > secondary | Reference — defines or restates; legislates no separate obligation |
| §1.1 | Store the article/section identifier as the durable citation key; retain printed page refs | Operational verification — discharged by the §17 release gate and the Phase 2 evidence procedure |
| §1.2 | Every implemented rule/finding preserves the 9-field rule record (ID, rule/scope, authority, inputs incl. asOfDate, outputs per ledger, verdict behavior, explanation, tests, version) | Operational verification — discharged by the §17 release gate and the Phase 2 evidence procedure |
| §1.3 | Each applicable rule is assessed across five layers: representation, calculation, enforcement, explanation, lifecycle | Reference — defines or restates; legislates no separate obligation |
| §2 | Executive findings restate obligations legislated elsewhere in the canon | Reference — defines or restates; legislates no separate obligation |
| §5.1 | A contract is Standard unless it is a Two-Way contract | Reference — defines or restates; legislates no separate obligation |
| §12.1 | Recommended validation order, steps 1-10 (date, asset legality, connectivity, slots, consent, ITS/OTS, post-trade ledgers, TPE path selection, apron limits, cash/pick/Stepien checks) | Reference — defines or restates; legislates no separate obligation |
| §15 | The register is a set of testable coverage questions, not confirmed bugs | Reference — defines or restates; legislates no separate obligation |
| §16 | The audit must use concrete scenarios, not only unit-level rule labels | Operational verification — discharged by the §17 release gate and the Phase 2 evidence procedure |
| §17 | Every audited ID produces the six-field compact record (coverage, product layer, severity, evidence, authority, remediation) | Operational verification — discharged by the §17 release gate and the Phase 2 evidence procedure |
| §17 | Three bounded passes: deterministic correctness, Cap Manager completeness, full GM depth | Reference — defines or restates; legislates no separate obligation |
| §17 | Findings stay attached to the product layer they affect (calculation, validation, explanation, lifecycle, data, authoring, intentional exclusion) | Reference — defines or restates; legislates no separate obligation |
| §17 | The ten-step canon release gate must be completed before an updated canon or season parameter set governs Architect | Operational verification — discharged by the §17 release gate and the Phase 2 evidence procedure |
| §17 | Boundary tests one unit below, exactly at, and one unit above every monetary, count, day, and percentage boundary | Operational verification — discharged by the §17 release gate and the Phase 2 evidence procedure |
| §18 | Expansion rules and BRI cap-setting: consume published team count and system levels rather than reproduce league audit/BRI calculations | Reference — defines or restates; legislates no separate obligation |
| §19.1 | The rule-family authority map must be preserved as citation metadata on every implemented rule | Operational verification — discharged by the §17 release gate and the Phase 2 evidence procedure |
| §19.3 | The verification-status classification is part of the canon; moving an OPS item into a primary-source category requires a cited canon revision | Operational verification — discharged by the §17 release gate and the Phase 2 evidence procedure |

### 15.9 Register and source-certification standard (v2.0 — binding, R2.1 edition as hardened by R2.2 and corrected by R2.3, R2.4, and R2.5)

This standard governs the v2.0 re-registration (repair units R3–R6), the
scenario rebuild (R7), the global reconciliation (R8), the independent
acceptance (R9), and every later register edition. It is complete in itself
and **replaces the R2 edition of this section in full**. The R2 identity
model — in-place migration inside the `CBA-…` namespace using RETIRED/ALIAS
rows, PHANTOM dispositions, append-in-place successor slots, LEAF→GROUP
conversion, and GROUP retirement — is **superseded** and must not be used;
§15.9.10 enumerates the superseded machinery. The R2 receipt
(`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_REGISTER_STANDARD.md`)
is preserved unchanged as review history only; no binding rule may be taken
from it. The binding restatement, design rationale, and validation record
for the R2.1 edition are in
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_1_REGISTER_STANDARD.md`;
the R2.2 hardening of this section (pinned scenario identity,
deterministic edge typing, the narrow no-successor rule, the multi-source
evidence grammar and typed provenance, mandatory candidate generation,
gates SC6/SC7/G14/G15, `METHOD`/`AMEND` decision records, and strict
construction sequencing) is recorded in
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_2_FOUNDATION_HARDENING.md`;
the R2.3 foundation-contract corrections of this section (typed evidence
roots with class-specific certification, the strict secondary-source/OPS
provenance policy, the complete SC2 SXW2 integrity contract,
all-population draft mutability and `AMEND` lineage, and the
three-register-population distinction) are recorded in
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_3_FOUNDATION_CONTRACT_CORRECTIONS.md`;
and the R2.4 foundation-blocker closure of this section (the
type-specific `SRC2-…` record contract with field-level validation, the
transitive evidence-root compatibility model, the removal of every
remaining binding secondary-source-to-OPS promotion, and the child-ID
numbering contract replacing renumbering-to-restore-contiguity) is
recorded in
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_4_FOUNDATION_CONTRACT_CLOSURE.md`;
and the R2.5 SRC2 field-grammar closure of this section (the pinned
`YYYY-YY` season grammar as the only accepted season syntax, and the
composite `Verifier/session/date` base field split into the three
individually typed verification-metadata fields) is recorded in
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_5_SRC2_GRAMMAR_CLOSURE.md`.
Where this section and any receipt's restatement differ, this section
governs.

#### 15.9.1 Registers and namespaces

The v2.0 canon separates six record populations. Each is parsed, counted,
and gated separately; only the active v2 registry carries obligations and
verdicts.

| Register | Contents | ID grammar | Status |
|---|---|---|---|
| Published historical v1.1 registry | Every `CBA-…` ID and register row **as published at commit `9814939c`** — distinguished from this file's §15.1–§15.8 working copy by the three-population rule below | `CBA-<F><NN>[.<n>]` | **Frozen historical.** The authoritative historical meaning of each v1.1 ID is the published v1.1 edition at commit `9814939c`, SHA-256 `4a0760c81d7a5e95919a0373d5ff631b565d064d56b858fe3b8869ad2b6bb3f6`. Never renumbered or extended; never counted in active totals; never verdict-bearing |
| Active v2 registry | The v2 GROUP and LEAF rows built new by R3–R6 (§15.10 once created) | `CBA2-<F><NN>` / `CBA2-<F><NN>.<n>` | The only obligation-bearing, verdict-bearing register |
| Historical crosswalk | Typed edges from published v1.1 LEAFs to active v2 LEAFs | `XW2-<NNNN>` | Support records (§15.9.3) |
| Evidence registry | Shared typed source/provenance records and per-LEAF authority-component evidence | `SRC2-<NNN>` / `EV2-<NNNN>` | Support records (§15.9.6) |
| Active v2 scenario library | The v2 acceptance scenarios built new by R7 | `CBA2-SC-<NNN>` | Behavioral evidence (§15.9.8) |
| Scenario crosswalk | Typed edges from historical scenarios 1–89 to active v2 scenarios | `SXW2-<NNNN>` | Support records (§15.9.8) |

Decision records (`DR2-<NNNN>`, §15.9.4) live in the performing unit's
receipt and are cited from the registers.

Binding boundary rules:

1. The R1/R1.1 source-law corrections and the authorized R2.1 A11/A18.7
   annotations are **inputs for constructing v2 obligations**. They are
   not retroactive redefinitions of the published v1.1 IDs: each v1.1
   ID's historical meaning is fixed by the published edition at
   `9814939c`, and the corrected rule text feeds the active v2 LEAF that
   the crosswalk points to.
2. A historical `CBA-…` ID is never reused as an active v2 ID, never counted
   in an active total, and never appears in a verdict column.
3. Historical IDs, crosswalk records, source/provenance records, evidence
   rows, decision records, and scenarios are all outside active GROUP/LEAF
   counts and verdicts.
4. Historical and legacy mentions of operational mechanics — historical
   register rows, historical scenarios, legacy status tables, and this
   file's working-copy sections — **never authorize active registration,
   any authority classification (including OPS), or enforcement**. An
   obligation enters the active v2 registry only through the
   §15.9.4–§15.9.6 evidence process with qualifying evidence; an
   unsupported operational candidate (§15.9.6) remains a discovery item
   until such evidence exists.

**Three register populations must never be conflated** (mirroring the
three scenario populations of §15.9.8):

1. **The published v1.1 historical register.** Exactly the register of
   the published v1.1 edition at commit `9814939c` (file SHA-256
   `4a0760c81d7a5e95919a0373d5ff631b565d064d56b858fe3b8869ad2b6bb3f6`).
   It is the **sole historical source of every `XW2-…` edge**; each
   v1.1 ID's meaning is permanently fixed by that edition; it is never
   active and never verdict-bearing.
2. **The current branch's legacy-numbered working copy** — §15.1–§15.8
   as they appear in this file. It contains the R1/R1.1 source-law
   corrections and the authorized R2.1 A11/A18.7 annotations and is
   therefore **not byte-identical to the published edition**. It is an
   authoring input for constructing active v2 obligations only: never
   the historical source of an `XW2-…` edge, never active, never
   verdict-bearing; it does not redefine any published historical ID's
   meaning.
3. **The active v2 registry** (`CBA2-…`, built new by R3–R6) — the only
   population that is active and verdict-bearing after R9 ACCEPT.

#### 15.9.2 Active v2 identity rules

Grammar and roles:

- **GROUP:** `CBA2-<F><NN>` where `F ∈ {A, C, R, L, S}` and `NN` is a
  two-digit zero-padded number (`CBA2-A01`, `CBA2-C01`, `CBA2-R01`,
  `CBA2-L01`, `CBA2-S01`).
- **LEAF:** `CBA2-<F><NN>.<n>` where `n` is an unpadded positive integer
  (`CBA2-A01.1`, `CBA2-C01.1`). Tools parse and sort `NN` and `n`
  numerically, never lexicographically.
- **Every active obligation is a LEAF with a fixed GROUP parent.** There are
  no top-level LEAFs in v2. One-child GROUPs are allowed.
- **A role is fixed when minted.** No ID ever converts between LEAF and
  GROUP, in either direction.
- A GROUP owns no obligation and receives no verdict, locatability status,
  method, locator, or evidence; it reports only the distribution of its
  children's statuses, and mixed child results are never collapsed into one
  parent verdict.
- Child numbering within a GROUP is contiguous from `.1` **at initial
  GROUP construction only**. After an `AMEND` event, numbering follows
  the child-ID numbering contract below: an explained gap is valid, IDs
  are never reused, and contiguity is never restored by renumbering.

Draft mutability (all live v2 populations): while the v2 draft is
unaccepted (through R8), a later unit may correct a defective live v2
record only with an `AMEND` decision record (§15.9.4). This rule covers
**every live v2 population equally**: active GROUP and LEAF records,
`XW2-…` crosswalk edges, `SRC2-…` source/provenance records, `EV2-…`
evidence components, active `CBA2-SC-…` scenarios and their named cases,
`SXW2-…` scenario-crosswalk edges, and `DR2-…` decision records. A
correction never renumbers surviving sibling records and never reuses a
removed or superseded ID (child-ID numbering contract below); in every
correction, the performing unit updates every live crosswalk edge,
evidence row, origin reference, method field, dependency reference,
scenario `Exercises:` reference, and any other live reference in the
same commit.

**Append-only, precisely defined.** Every v2 namespace (`CBA2-…`,
`XW2-…`, `SRC2-…`, `EV2-…`, `CBA2-SC-…`, `SXW2-…`, `DR2-…`) is
append-only in exactly this sense:

- New ID allocation is monotonically increasing within the namespace.
- An allocated ID is never reused for another identity.
- A superseded or removed ID is never reassigned.
- Append-only does **not** mean an erroneous draft record must remain
  live forever: a defective draft record is corrected or removed under
  the correction rules below.
- Earlier checkpoint receipts remain immutable and preserve the previous
  version of every corrected record.
- The current live tables contain only current records.

**Correction behavior (binding for every live v2 population):**

- A content correction that preserves the same record identity may keep
  the same ID only with an `AMEND` record identifying the prior
  checkpoint/version and the corrected current version.
- A semantic identity change, split, merge, replacement, or removal must
  mint the appropriate current ID(s) or record a removal disposition;
  superseded IDs are never reused.
- Every affected live reference is updated in the same commit — no
  duplicate or orphan record may be created by a correction.
- A defective `DR2-…` or `AMEND` record is itself corrected by a later
  `AMEND` record; an earlier receipt is never rewritten.
- No RETIRED/ALIAS role, tombstone row, or same-namespace migration
  model may reappear in the live registers (§15.9.10).

**Child-ID numbering contract (binding; resolves contiguity vs
no-reuse):**

1. Child IDs are contiguous `.1…n` only **when a GROUP is initially
   constructed**.
2. There is no renumbering duty and no renumbering permission: no
   removal, split, merge, or other `AMEND` event ever renumbers
   surviving children to restore contiguity.
3. After an `AMEND` event, a numeric gap in a GROUP's live children is
   valid **only** when every missing allocated ID resolves — through the
   immutable receipts and an `AMEND` chain — to an explicit removal or
   to one or more current successor records.
4. An unexplained gap, or an interior gap at an ID that was never
   allocated, remains invalid.
5. A removed or superseded ID is never reused for any identity.
6. A new child allocates monotonically above the **highest child ID ever
   allocated in that GROUP**; it never fills a historical gap.
7. Live tables carry only current records — no tombstone, RETIRED, or
   ALIAS row (§15.9.10); earlier receipts preserve prior versions, and
   the `AMEND` chain provides forward resolution for every missing ID.

Worked numbering examples (binding; every ID is illustrative — `X` is
not a mintable family letter and no such records exist):

- `CBA2-X01` is constructed with children `.1/.2/.3`; a later unit
  removes `.2` with an `AMEND` removal disposition → live children
  `.1/.3`. **Valid:** the `.2` gap resolves through the `AMEND` chain to
  an explicit removal.
- Instead, `CBA2-X01.2` is split into two new obligations: the unit
  mints `.4` and `.5`, removes `.2`, and the `AMEND` record names
  `.4/.5` as successors → live children `.1/.3/.4/.5`. **Valid:** `.2`
  resolves to its current successors.
- A later new child in that GROUP receives `.6` — above the high-water
  mark of `5` — never `.2`. **Valid.**
- Live children `.1/.3` with no `AMEND` chain explaining `.2`:
  **invalid** (unexplained gap).
- Renaming live `.3` to `.2` to restore contiguity: **invalid** —
  renumbering is prohibited and an allocated ID is never reused.

Binding traceability rules:

- Earlier receipts are **immutable and commit-scoped**: they remain true of
  the checkpoint they describe, and a later correction never edits an
  earlier receipt.
- The `AMEND` record is the resolution bridge: it identifies the record
  population/type, the prior checkpoint, the prior decision-record IDs
  where applicable, the old ID/version, the current ID/version or the
  removal disposition, the reason, the updated references, and the
  superseding disposition that replaces the prior live one. A reader
  resolving a draft ID or decision record cited in an earlier immutable
  receipt follows the `AMEND` chain forward to the current disposition;
  every receipt-era ID/version resolves forward, and every supersession
  chain terminates in exactly one current disposition or an explicit
  removal.
- Current registers, crosswalks, and evidence rows cite only **current,
  resolvable** IDs and decision records — never a superseded draft ID or a
  superseded decision record.
- R8 gate G15 requires amendment-chain integrity across every live v2
  population; R9 independently verifies the amendment chain.
- After R9 ACCEPT, every live v2 record is immutable; any change requires
  a new canon edition and a new acceptance gate.

This mechanism deliberately keeps lineage in the receipts, not in the
registers: there are no RETIRED/ALIAS roles, no tombstone rows, and no
same-namespace migration machinery (§15.9.10). The registers always show
only current records; history is reconstructed from the immutable receipts
plus their `AMEND` chains.

Active LEAF fields (all required; `—` where empty):

| Field | Content |
|---|---|
| Stable ID | §15.9.2 grammar; the parent GROUP is the ID prefix |
| Canonical requirement | The one obligation, atomically stated (§15.9.4) |
| Authority classes | Comma-separated class list (§15.9.5); every listed class is backed by at least one evidence-component row |
| Primary method | Exactly one behavioral method (§15.9.7) |
| Secondary methods | Zero or more distinct behavioral methods; `—` if none |
| Evidence components | The `EV2-…` rows certifying this LEAF |
| Scenario evidence | Named v2 scenario cases (populated at R7; `pending R7` before) |
| Origin | Incoming `XW2-…` edge IDs, or `new` plus the origin decision record for a newly-certified LEAF with no predecessor |
| Dependencies | Active LEAF IDs whose state/output this rule consumes |
| Lifecycle/date inputs | Required `asOfDate`/Salary Cap Year/window inputs |
| Decision records | `DR2-…` IDs that dispositioned this row |
| Notes/limitations | Bounded caveats and OPS/EXT limitations |

Physical layout (binding for R3–R6): per family, a main table
`ID | Requirement | Authority | Primary | Secondary | Evidence | Origin | Notes`
plus a detail table keyed by ID for
`Scenario evidence | Dependencies | Lifecycle/date inputs | Decision records`.
Both tables must be mechanically parseable and joinable on ID, with a
uniform layout across families. GROUP rows are carried per family as
`ID | Title/audit question | Active LEAF children | Notes`.

Placement: R3 creates §15.10 (active v2 register), §15.11 (historical
crosswalk), and §15.12 (evidence registry); R4–R6 extend them in place. R7
adds the active v2 scenario library and the scenario crosswalk as a clearly
labeled v2 subsection of §16, leaving historical scenarios 1–89 untouched.

Construction sequencing is **strict**: **R3 → R4 → R5 → R6**. R4 depends on
completed R3, R5 on completed R4, and R6 on completed R5 — every
construction unit extends the shared §15.10–§15.12 sections and allocates
from the shared `XW2-…`/`SRC2-…`/`EV2-…`/`DR2-…` namespaces, so
construction units never run in parallel and no parallel allocation ranges
or alternative namespace schemes exist.

#### 15.9.3 Historical crosswalk (XW2)

The crosswalk is a separate, mechanically parseable register of typed edges
from published v1.1 LEAF IDs to active v2 LEAF IDs. Schema:

| Field | Content |
|---|---|
| Edge ID | `XW2-<NNNN>`, unique, append-only per the §15.9.2 definition |
| Historical v1.1 LEAF | A published v1.1 LEAF ID in the pinned published register population (§15.9.1; meaning fixed at `9814939c`) — never the branch's legacy-numbered working copy |
| Active v2 LEAF or `—` | The target active LEAF; `—` only for terminal edge types |
| Edge type | One of the eight types below |
| Scope/relationship | Which part of the historical obligation the edge covers, and how |
| Decision record | The `DR2-…` record that dispositioned the edge |

Edge types:

| Type | Meaning | Terminal? |
|---|---|---|
| `equivalent` | One historical LEAF maps wholly to one active LEAF with the same obligation, the target absorbs it from no other historical owner, and there is no substantive re-homing | No |
| `split` | The historical LEAF's obligation is divided among multiple active targets; this edge covers the named fragment, wholly owned by its target | No |
| `merge` | The historical LEAF's whole obligation maps to one active target that also absorbs the same obligation from at least one other historical owner (a duplicate LEAF or a named bundle fragment) | No |
| `partial-overlap` | Neither the whole historical source nor the whole active target is semantically equivalent: genuinely overlapping fragments, or compound split/merge shapes not faithfully represented by `split` or `merge` alone; the scope column states exactly which part and how | No |
| `moved` | One historical LEAF maps wholly to one active LEAF (absorbed from no other historical owner), but its active family or parent changes | No |
| `process-only` | The historical row was process/instruction material; destination noted in scope | Yes |
| `invalid` | The historical row's claim was false (e.g., a false gap assertion); scope explains | Yes |
| `no-successor` | The historical statement is valid as history but carries no active v2 owner under the narrow no-successor rule below | Yes |

Binding rules:

1. The model is **historical → active and bipartite**: no edges between two
   historical IDs or two active IDs, no chains, and no role transitions —
   so no migration chain or cycle is possible, and none is allowed.
2. Every published v1.1 LEAF has **at least one outgoing edge** by the end
   of R8.
3. Every non-terminal edge targets an **existing active v2 LEAF**.
   `process-only`, `invalid`, and `no-successor` are terminal and use `—`
   as the target.
4. Compound history is expressed with **multiple typed edge records**,
   never a combined subtype.
5. An active v2 LEAF may have zero, one, or many historical predecessors. A
   LEAF with no predecessor carries explicit **newly-certified origin**
   provenance (`new` in its Origin field plus an origin decision record).
6. Crosswalk records **never transfer or inherit historical verdicts**;
   every active LEAF requires fresh evidence.
7. GROUP-level crosswalk notes are informational only and are excluded from
   the mandatory LEAF-coverage gate.
8. An edge is recorded by the unit that mints its target (or, for terminal
   edges, by the unit processing that historical segment). A unit that
   cannot yet record an edge because the target belongs to a later unit
   lists the deferral explicitly in its receipt; R8 requires zero remaining
   deferrals.

**Deterministic edge typing (binding).** One honest relationship produces
one predictable representation:

- **Exactly one primary relationship type per historical-source/
  active-target pair.** No source–target pair may appear under two edge
  types, and movement is never recorded as a second edge for a pair that
  is already typed: re-homing of a whole obligation is `moved`; re-homing
  of a `split`/`merge`/`partial-overlap` fragment is recorded in that
  edge's Scope/relationship column, never as an additional `moved` edge
  for the same pair.
- **Decision order** — applied per historical LEAF, stopping at the first
  test that matches:
  1. Terminal dispositions first: process material → `process-only`; a
     false claim → `invalid`; a valid historical statement meeting every
     condition of the no-successor rule below → `no-successor`.
  2. The whole obligation is owned by exactly one active LEAF, and the
     target absorbs it from no other historical owner: `equivalent` when
     the active family and parent do not substantively re-home it;
     `moved` when they do.
  3. The whole obligation is owned by exactly one active LEAF that also
     absorbs the same obligation from at least one other historical owner
     (a duplicate LEAF or a named bundle fragment): `merge`.
  4. The obligation divides among multiple active targets and each named
     fragment is wholly owned by its target: one `split` edge per pair.
  5. Anything else — genuinely overlapping fragments, or compound
     split/merge shapes not faithfully represented by `split` or `merge`
     alone: `partial-overlap`, with the scope column stating exactly
     which fragment overlaps and how.

**Worked examples (binding):**

1. *Equivalent vs moved.* Historical `CBA-A21` (the minimum-stacking
   prohibition — one prohibition with a conjunctive trigger) maps wholly
   to one active A-family LEAF owning the same obligation: one
   `equivalent` edge. If a whole obligation is instead re-homed — e.g.,
   historical `CBA-C20.8`'s undrafted-rookie rule registered under an
   active R-family parent — the single edge is `moved`: the same
   whole-to-whole mapping, a different active family or parent, and never
   both edge types for the pair.
2. *One source split across two targets.* Historical `CBA-A19.3` bundles
   minimum term, maximum term, and Year-1 protection: each fragment gets
   one `split` edge to its own active target. If a fragment lands in a
   different family, that re-homing is stated in that `split` edge's
   Scope/relationship — never a second `moved` edge for the same pair.
3. *Two duplicate sources merged to one target.* Historical `CBA-C23.1`
   and `CBA-C23.4` both own the incentive-cap obligation folded into one
   active LEAF: each historical LEAF receives one `merge` edge to that
   target.
4. *A historical bundle whose fragment merges with another historical
   owner.* Historical `CBA-L01.5` (the whole-calendar bundle) contains a
   date fragment whose obligation historical `CBA-C24.1` also owns, and
   one active LEAF absorbs both. `CBA-C24.1 → target` is `merge` (a whole
   obligation, absorbed alongside a co-owner). `CBA-L01.5 → target` is
   `partial-overlap` (a compound split-plus-merge shape: only a fragment
   of the bundle, folded with another owner), with the fragment and the
   co-owner named in Scope/relationship.
5. *A terminal edge plus a separately minted true-gap owner.* Historical
   `CBA-C20.9` (a phantom gap note hiding the real March 4 Two-Way
   signing deadline) receives one terminal `invalid` edge with target
   `—`. The real deadline obligation is separately minted as a new active
   LEAF with `new` origin, an `ORIGIN` record, and the companion true-gap
   (`TG`) record. The minted owner is never the target of the note's
   terminal edge.

**No-successor rule (narrow, gateable).** A `no-successor` edge may be
recorded only when **all** of the following hold:

1. The historical statement is valid as history (a false claim is
   `invalid`; process text is `process-only`).
2. It is **demonstrably outside the active v2 canon's approved obligation
   scope, or obsolete for the governed edition** (e.g., a provision fully
   spent in a prior Salary Cap Year that creates no continuing product
   obligation).
3. The decision record states the **exact scope or edition basis** for
   the exclusion.
4. The disposition is none of: unresolved, uncertified, inconvenient,
   deferred, or merely unsupported. An obligation that cannot yet be
   source-certified keeps its ownership requirement and returns to
   certification — `no-successor` can **never** substitute for failed or
   incomplete source certification.
5. The decision is explicitly reviewed during R8 global reconciliation
   (G3), and R9 independently reviews **every** `no-successor`
   disposition — not a sample.

Completeness duty: every valid in-scope obligation of any authority class
(CBA, BYL, NBA, DERIVED, INFERRED, OPS, or EXT) discovered during R3–R6
has an active v2 owner.

**True-gap rule.** Where a historical note asserted a gap, two distinct
records are required. First, the note's own edge is terminal (`invalid` for
a false claim, `process-only` for process text). Second, if the note
exposed a **real** obligation (e.g., the March 4 Two-Way signing deadline,
CBA II §11(e)(i) p. 54, hidden behind `CBA-C20.9`), a companion **true-gap
decision record** must prove that the real obligation received a
source-certified active v2 LEAF with newly-certified origin. The historical
note's terminal disposition and the new owner's provenance are separate
facts; neither substitutes for the other.

Crosswalk validation (run at the §15.9.9 gate points): reciprocity (every
non-terminal edge appears in its target's Origin field, and every Origin
entry resolves to an existing edge), duplicate-pair (no two edges share
the same historical LEAF and target — exactly one primary relationship
type per source–target pair, regardless of edge type), valid-target,
complete historical coverage, terminal-edge validation (terminal type ⇔
`—` target, with a decision record), and no-successor validation (every
`no-successor` edge satisfies the narrow rule above, with the scope/
edition basis recorded).

#### 15.9.4 Atomicity, canonical ownership, and decision records

**Atomicity — the mixed-verdict test (default rule).** Restate every
candidate obligation as **GIVEN** facts **WHEN** trigger **THEN** required
result. It is one LEAF iff it has exactly one THEN and no realistic
implementation could be correct on one part and wrong on another in a way
an honest auditor would report separately. Requirements that are
independently pass/fail-able split. Clarifications:

- A conjunctive trigger (several conditions that must all hold) leading to
  one prohibition or outcome may remain **one** LEAF.
- Separately enumerated calculations, adjustments, exceptions, deadlines,
  lifecycle stages, or outcomes that can independently succeed or fail are
  **separate** LEAFs; the signed text's own enumeration is the floor of
  granularity.
- A rule's eligibility test, calculation, lifecycle, expiration, and
  extinguishment are separate whenever Architect could implement them
  differently; numeric bounds on the same quantity are separate when each
  can fail independently.
- **Homogeneous-list exception:** a single clause listing same-kind
  elements under one trigger and one consequence may remain one LEAF only
  as an **explicitly recorded exception** — the decision record must show
  it is one prohibition/obligation, explain why separate verdicts would be
  artificial, and the LEAF's evidence must exercise **every** listed
  element. Otherwise split.
- A broad "supports X" statement is not atomic when X contains
  independently enforceable conditions.
- Testing instructions and recommended boundary percentages are process
  material, never part of a product obligation.

**Canonical ownership.** One independently auditable obligation = one
active v2 LEAF. Every other mention anywhere in the canon — correction
tables, explanatory summaries, lifecycle ledgers, implementation
instructions — is a cross-reference to the owner, never a second LEAF. No
correction-table summary, lifecycle ledger, or implementation instruction
may duplicate a substantive owner. No active v2 row may be process-shaped.

**Ownership tiebreak (deterministic, in order, stopping at the first test
that discriminates):** (1) the obligation's natural series family
(A = trade correctness, C = Cap Manager, R = waivers/rosters,
L = lifecycle/rights/dates, S = parameters/provenance); (2) the anchor
where the canon legislates the substance (§§5–14) over correction-table,
summary, or process anchors; (3) the statement of trigger and result that
is most complete with least extraneous text; (4) the lowest ID in
mechanical sort order. Every duplicate candidate receives a recorded
ownership decision, and the decision record states **which tiebreak
selected the owner and why**.

**Semantic, not mechanical.** Semantic uniqueness and atomicity are never
"mechanical" properties. Mechanical tooling generates candidate lists;
every disposition is a semantic review gate recorded in a decision record
and evidenced in the unit receipt. The mandatory search below plus
semantic adjudication is a systematic search — it is never claimed to
mechanically prove uniqueness.

**Mandatory duplicate-candidate generation.** Each R3–R6 unit must produce
and record a candidate population built from **all** of the following
generators — the union, never a selection:

1. The adjudication's known duplicate queue for the unit's families.
2. Normalized requirement-text similarity across the in-scope historical
   rows and the active rows registered so far.
3. Shared or overlapping primary locators (article/section/subsection/
   exhibit/page).
4. Correction-table vs substantive-anchor comparison (§3 rows against
   §§5–14 anchors).
5. Lifecycle/summary-ledger vs substantive-owner comparison (§4.2–§4.4
   ledger rows against substantive owners).
6. Explicit cross-family references and the known cross-family pairs
   (e.g., the historical C07↔C13 SRPE apron add-back, the C20↔R06
   Two-Way limit, and the L01.5 calendar cross-duplications).
7. Reviewer-identified semantic candidates not found mechanically.

The tool-generated list is candidate generation only; every disposition
remains semantic. Every candidate receives an `OWN` disposition. The unit
receipt records the candidate population per generator and demonstrates
**zero undispositioned in-scope candidates**. A cross-family candidate may
be deferred only with both families and the expected resolving unit named
in the receipt. G9 reruns a global cross-family candidate sweep and
requires zero unresolved candidates; R9 independently regenerates the
candidate population rather than trusting the unit lists.

**Decision-record schemas.** Decision records are parseable rows in the
performing unit's receipt:

`DR ID | Type | Subject(s) | Disposition | Test/tiebreak applied | Rationale | Resulting active LEAF(s) or — | Unit/commit`

| Type | Used for | Required content |
|---|---|---|
| `OWN` | Duplicate ownership | The full candidate set; the owner selected; which tiebreak discriminated and why; the crosswalk edges recorded for the non-owners |
| `ATOM` | Atomicity keep/split | The GIVEN/WHEN/THEN restatement; for a split, the fragment list; for the homogeneous-list exception, the explicit justification and the all-element evidence pointer |
| `TG` | True gaps | The historical gap note; the real obligation exposed; the minted LEAF; its certification evidence |
| `MOVE` | Re-parenting/movement | The historical home; the active family/parent chosen; the family-test rationale; the `moved` crosswalk edge |
| `ORIGIN` | Newly-certified origin | Why no historical predecessor exists; the primary-source basis for minting |
| `METHOD` | R7 bounded method-fit corrections (§15.9.8) | The LEAF; the old method set (primary and secondaries); the new method set; why the previous method assignment was dishonest; the resulting evidence requirement |
| `AMEND` | Draft correction of any earlier-registered live v2 record — active GROUP/LEAF rows, `XW2-…` edges, `SRC2-…` source/provenance records, `EV2-…` components, active `CBA2-SC-…` scenarios/named cases, `SXW2-…` edges, and `DR2-…`/`AMEND` records (§15.9.2) | The record population/type; the prior checkpoint commit and prior DR IDs where applicable; the old ID/version; the current ID/version or removal disposition; the reason; confirmation that every live crosswalk/evidence/origin/method/scenario/dependency reference was updated in the same commit; the superseding disposition that replaces the prior live one |

#### 15.9.5 Authority taxonomy

The only authority classes are:

| Class | Meaning | Automatic verdicts? |
|---|---|---|
| **CBA** | Express rule in the signed 2023 NBA–NBPA CBA, including exhibits | Yes, when inputs are complete |
| **BYL** | Express rule in the June 2024 NBA Constitution and By-Laws | Yes, when inputs are complete |
| **NBA** | Official annual level, calendar, or explanatory publication | Yes for the published value/date; the signed agreement controls a wording conflict |
| **DERIVED** | **Arithmetic only:** computation reproduced from a CBA/BYL/NBA formula and published inputs | Yes; formula, inputs, units, and rounding recorded |
| **INFERRED** | Non-arithmetic legal or algorithmic inference supported by controlling primary-source text | Yes, when the controlling locators and the stated inference chain are recorded; never presented as express source language |
| **OPS** | League-operational rule with **real first-party operational provenance** (the §15.9.6 qualifying-provenance rule; secondary reporting never establishes OPS); the absence of a public rule is never enough to invent an OPS rule | Only as a configurable operational rule with visible provenance |
| **EXT** | Requires an external league, medical, expert, arbitral, or legal determination | No; consume an explicit decision/assumption |

Binding rules:

1. Multiple authority components on one obligation are **separate evidence
   rows** (§15.9.6) — never a slash or "+" string in place of component
   evidence.
2. Unresolved composite labels (e.g., a single DERIVED/OPS label) are
   banned.
3. DERIVED is arithmetic-only; anything requiring legal or structural
   reasoning from text is INFERRED.
4. OPS without qualifying first-party operational provenance (§15.9.6)
   is not OPS; it is an unsupported claim and may not be registered.
   Secondary reporting — media, expert summaries, CBAguide, RealGM,
   Spotrac, prior audits, tests, or existing implementations — never
   establishes OPS or any other authority class.
5. EXT rows state which external decision is required and the explicit
   state the product consumes.

**Closed R1.1 provisional items (binding migration treatment):**

- **A11 — component decomposition:** an express **CBA** component (the
  per-player/per-exception structure of CBA VII §6(j)(1)(i)–(v),
  pp. 240–241) plus a separately stated **INFERRED** component (the
  decomposition procedure). It is not DERIVED arithmetic.
- **A18.7 — conditional cash:** the express cap-year charging rule (CBA VII
  §8(a), p. 260) is **CBA**. The re-trade attribution/accounting mechanics
  must become a **separate active v2 LEAF** during A-series registration,
  classified **OPS** only with real operational provenance or **INFERRED**
  only with a controlling source chain. The former DERIVED/OPS composite is
  rejected and is not an accepted classification.

#### 15.9.6 Source-evidence registry

A source label — or an agent's claim that it read a passage — is not
evidence. Two parseable registries carry the evidence. **Source
certification and behavioral verification are separate dimensions:**
certification (this section) never counts as a behavioral method
(§15.9.7), and no behavioral method substitutes for certification.

**Shared source/provenance-record registry** (`SRC2-<NNN>`, append-only
per the §15.9.2 definition, shared across units). `SRC2-…` is a
**source/provenance-record registry, not only a file-artifact registry**:
a record certifies a source or provenance record, which may but need not
be a retrievable file artifact — an `ops-provenance` or `ext-contract`
record is a real `SRC2-…` record even when no public URL or durable
artifact exists.

**Type-specific record contract (binding).** Every `SRC2-…` record is
carried as one row in the shared **base table** plus exactly one row in
the **detail table pinned to its provenance type**. Both rows are
mechanically parseable and joinable on Record ID, and both are
mandatory: a record without its type-specific detail row is invalid.
Every mandatory field lives **only** in these pinned columns — never
solely in a prose note, a `Mutable-source/archive note`, or any other
unstructured catch-all.

Base table (one row per record; all thirteen fields present; `—` only
where the per-type validity matrix below permits):

`Record ID | Provenance type | Source/provenance identity | Publication/effective date or — | Official URL or — | Artifact SHA-256 or — | Retrieval timestamp or — | Authentication timestamp or — | Verifier identity | Verification session ID | Verification date | Record limitations | Record status/version`

The former composite `Verifier/session/date` field is abolished: it was
not mechanically parseable. Its content is carried by the three split
verification-metadata fields above (`Verifier identity`,
`Verification session ID`, `Verification date`), each with its own
pinned grammar below. A base row that still uses the composite field —
or any single field mixing verifier, session, and date content — is
malformed and fails.

Provenance types (closed vocabulary; exactly one per record):

| Provenance type | Meaning |
|---|---|
| `official-immutable` | Immutable official document (e.g., the signed CBA PDF, the June 2024 By-Laws PDF) |
| `official-mutable` | Mutable official webpage or release |
| `ops-provenance` | Real first-party operational provenance (the qualifying-provenance rule below) that may have no official public URL |
| `ext-contract` | EXT/runtime determination contract — the shape of the external decision the product will consume; no case-specific ruling need exist during canon authoring or construction |

Type-specific detail tables (one pinned schema per provenance type;
every field required unless marked `or —`; base-table fields are not
repeated — the base row carries them):

- `official-immutable` detail:
  `Record ID | Source title and edition | Page geometry`
  (with the base row's Source/provenance identity naming the same
  document; Publication/effective date, Official URL, Retrieval
  timestamp, and Artifact SHA-256 all **required** in the base row;
  Authentication timestamp `—` unless separately applicable)
- `official-mutable` detail:
  `Record ID | Publication identity/date or season | Exact values or text relied upon | Archive/snapshot reference or —`
  (Official URL, Retrieval timestamp, and the retrieved-content
  SHA-256 all **required** in the base row; Authentication timestamp
  `—` unless separately applicable; a season value — here and in the
  base row's Publication/effective date field — must use the pinned
  `YYYY-YY` season grammar below, never any other season syntax)
- `ops-provenance` detail:
  `Record ID | Named first-party provenance identity | Authority/role of the source | Practice scope | Effective date or window | Authentication method | Configurability | Artifact identity or —`
  (Authentication timestamp **required** in the base row; Official URL
  `—` only when no URL exists; Artifact SHA-256 `—` only when no
  durable artifact exists; Record limitations always required)
- `ext-contract` detail:
  `Record ID | External determination class | Runtime input schema | Required decision provenance | Scope | Effective/expiration behavior | Controlling source/rule reference or — | Verification/authentication method`
  (the verification/authentication timestamp is carried in the base
  row's Authentication timestamp field and is **required**; Official
  URL and Artifact SHA-256 `—` only where none exists; `Controlling
  source/rule reference` may be `—` only where the contract itself
  defines the boundary; Record limitations always required)

**Pinned field grammar (every SRC2 table):** dates are `YYYY-MM-DD` and
must be real calendar dates; effective windows are
`YYYY-MM-DD/YYYY-MM-DD` or `YYYY-MM-DD/open`;
timestamps are ISO-8601 UTC (`YYYY-MM-DDTHH:MM:SSZ`); SHA-256 values are
64 lowercase hex characters; URLs are absolute. Within any multi-value
field (limitations, relied-on values, practice scope, runtime input
schema, artifact identity), elements are separated by `"; "` (a
semicolon then a space), no element contains `;` or `|`, and an empty
field is exactly
`—`. ID references inside any field follow the `EV2` reference grammar
below (`", "`-separated, ascending, no duplicates). A field that is
required and unknown is a **failed record**, never a blank or a prose
approximation.

**Pinned season grammar (binding; the only accepted season syntax).**
Wherever a structured field permits a season (the official-mutable
"date or season" alternative in the base Publication/effective date
field and the `official-mutable` detail row's Publication
identity/date or season field, and any other structured season value),
the season is exactly `YYYY-YY`:

1. `YYYY` is exactly four ASCII digits.
2. The separator is exactly one ASCII hyphen-minus `-` (`U+002D`).
3. `YY` is exactly two ASCII digits.
4. `YY` must equal the last two digits of `YYYY + 1`, modulo 100.
5. No spaces are permitted.
6. An en dash, em dash, slash, textual prefix, abbreviated first year,
   four-digit second year, or arbitrary season label is invalid.

Valid: `2026-27`; `1999-00`. Invalid: `2026–27` (en dash); `2026/27`;
`FY26`; `26-27`; `2026-28` (years not consecutive); `2026-2027`
(four-digit second year is invalid under this field grammar). Where a
source title reproduces typographic season text (for example `2026–27`
with an en dash), the title/identity text may preserve the source's
typography, but the structured season field must normalize it to the
`YYYY-YY` form (`2026-27`). No second season syntax exists.

**Verification-metadata grammars (binding; one per split field):**

- `Verifier identity` is exactly `human:<slug>` or `agent:<slug>`,
  where `<slug>` is 1–64 ASCII characters, begins with a lowercase
  ASCII letter or digit, contains only lowercase ASCII letters, digits,
  `.`, `_`, or `-`, and contains no spaces. Valid:
  `agent:claude-code`; `agent:codex`; `human:project-owner`. Invalid:
  `Claude` (no tag); `agent:` (empty slug); `agent:Claude Code`
  (uppercase and space); `agent:claude/code` (illegal delimiter).
- `Verification session ID` is exactly `session:<slug>`, where
  `<slug>` is 1–96 ASCII characters, begins with a lowercase ASCII
  letter or digit, contains only lowercase ASCII letters, digits, `.`,
  `_`, or `-`, contains no spaces, and identifies the
  authoring/verification session within the unit receipt. Valid:
  `session:r3-20260715-01`. Invalid: `r3-20260715-01` (missing tag);
  `session:` (empty slug); `session:R3 01` (uppercase and space).
  Disclosure of a provider's confidential internal session identifier
  is not required: a receipt-scoped deterministic session identifier
  meeting this grammar is sufficient.
- `Verification date` is `YYYY-MM-DD` and must satisfy the pinned
  calendar-date grammar above, including real calendar validity.

**Verification-metadata rules (binding):** all three fields are
mandatory for every `SRC2-…` base row of every provenance type; none
may be `—`; each field is independently parsed and validated under its
own grammar; a nonempty field can never compensate for another field
that is missing or malformed; and missing or malformed verification
metadata fails the record, which then certifies nothing.

**`—` validity is defined per provenance type, never generically:**

| Base field | `official-immutable` | `official-mutable` | `ops-provenance` | `ext-contract` |
|---|---|---|---|---|
| Source/provenance identity | Required | Required | Required — named first-party identity | Required — the determination-contract identity |
| Publication/effective date | Required | Required (a date, or a season under the pinned `YYYY-YY` season grammar) | Required (effective date or window, in the detail row; base may mirror or carry `—` only if the detail window governs) | `—` permitted only where the contract has no dated basis |
| Official URL | Required | Required | `—` only when no URL exists | `—` only when no URL exists |
| Artifact SHA-256 | Required | Required (retrieved content) | `—` only when no durable artifact exists | `—` only when no durable artifact exists |
| Retrieval timestamp | Required | Required | Required whenever content or an artifact was retrieved; otherwise `—` | Required whenever content or an artifact was retrieved; otherwise `—` |
| Authentication timestamp | `—` unless separately applicable | `—` unless separately applicable | **Required** | **Required** (verification/authentication) |
| Verifier identity | Required (never `—`) | Required (never `—`) | Required (never `—`) | Required (never `—`) |
| Verification session ID | Required (never `—`) | Required (never `—`) | Required (never `—`) | Required (never `—`) |
| Verification date | Required (never `—`) | Required (never `—`) | Required (never `—`) | Required (never `—`) |
| Record limitations | Required (state `none` expressly if none) | Required (state `none` expressly if none) | Required | Required |
| Record status/version | Required | Required | Required | Required |

**Timestamp and hash rules (binding):**

- If durable bytes exist, their SHA-256 is mandatory — an existing
  artifact is never recorded hashless.
- Official URL may be `—` only when no URL exists.
- A hash may be `—` only when no durable artifact exists.
- A retrieval timestamp is required whenever content or an artifact was
  retrieved.
- An authentication timestamp is required for direct communications,
  attestations, system access, and every other non-public verification.
- An artifactless `ops-provenance` record can never carry `—` for both
  its provenance-identity and its authentication fields: the named
  first-party identity, the authentication method, and the
  authentication timestamp are always required, artifact or no artifact.

**Field-level validation (binding; enforced at U8/U9, rechecked at G14,
independently re-run at R9).** A `SRC2-…` record **fails** if any
required type-specific field is absent, malformed under the pinned
grammar, or uses `—` where the per-type matrix prohibits it. This
includes the pinned `YYYY-YY` season grammar for every structured
season value and the three split verification-metadata fields
(`Verifier identity`, `Verification session ID`, `Verification date`),
each independently parsed and validated — one valid verification field
never conceals another that is missing or malformed. A failed
record certifies nothing, and no `EV2-…` component may reference it.

Copies of the CBA PDF are never committed to the repository; the
hash-plus-citation chain is the durable evidence.

**Strict secondary-source policy (binding).** Secondary sources are
discovery and corroboration aids **only**. Secondary reporting can never
establish CBA, BYL, NBA, DERIVED, INFERRED, OPS, or EXT authority, and
can never serve as the qualifying provenance of an `ops-provenance`
record. Secondary and discovery sources sit outside the §1.1
controlling-authority hierarchy and never resolve a conflict.

**Unsupported operational candidates (binding).** A mechanic whose only
support is secondary reporting is an **unsupported operational
candidate**: a discovery item preserved in the canon's discussion
sections so that qualifying provenance can be sought. A candidate is
not silently deleted, but it: cannot be registered as an active v2
obligation; cannot be classified OPS (or any other authority class);
cannot drive an automatic or configurable product verdict; and cannot
be enforced by Architect under this canon. Registration or enforcement
requires qualifying first-party operational provenance or a different
valid authority classification established through the normal
§15.9.4–§15.9.6 evidence process. Current candidates of record: the
multi-team touch test and detailed qualifying-asset thresholds (§12.2),
the seven-future-draft pick-trading horizon (§13.3), and the
secondary-reported pick-protection/deferral processing mechanics
(§13.3). Historical or legacy mentions of these mechanics (§15.9.1
boundary rule 4) never authorize registration or enforcement.

**Qualifying OPS provenance (narrow).** An `ops-provenance` record may be
grounded only in real first-party operational provenance, such as:

- an authenticated league or club operational artifact (an operations
  manual, memo, bulletin, or comparable document);
- a directly authenticated league or club communication;
- a league system record, transaction ruling, or comparable first-party
  operational record; or
- a direct attestation whose identity, authority, effective date,
  verification method, limitations, and configurability are recorded.

A media report, expert summary, CBAguide entry, RealGM page, Spotrac
page, prior audit, test, or existing implementation is **never**
sufficient provenance. An OPS obligation whose only support is secondary
reporting is an unsupported claim and may not be registered (§15.9.5).

**Per-LEAF authority-component evidence** (`EV2-<NNNN>`; one row per
authority component, so multi-component obligations never need composite
labels):

`Evidence component ID | Active v2 LEAF | Authority class | Source/provenance record IDs or — | Dependency evidence component IDs or — | Exact locator(s) | Controlling passage or tight paraphrase | Passage-to-obligation mapping | Formula/inference/provenance details | Limitations/uncertainty`

**Reference grammar (pinned).** `Source/provenance record IDs` is either
`—` or one or more `SRC2-<NNN>` IDs separated by `", "` (comma + space),
in ascending ID order with no duplicates. `Dependency evidence component
IDs` is either `—` or one or more `EV2-<NNNN>` IDs under the same
grammar. No ranges, no free text, and no other delimiter — both fields
are mechanically parseable.

**Evidence-root contract (binding):**

1. Every `EV2-…` evidence chain **terminates in at least one typed
   `SRC2-…` source/provenance record**: following any component's
   `Source/provenance record IDs` and `Dependency evidence component
   IDs` recursively always reaches one or more `SRC2-…` records.
2. **No `EV2-…` row may have both reference fields empty.** Every row
   lists at least one `SRC2-…` record, at least one dependency `EV2-…`
   component, or both; a source-free terminal component is invalid and
   may not be registered.
3. A **DERIVED** or **INFERRED** component may rely on dependency
   `EV2-…` components without directly listing a source, but every path
   through those dependencies must terminate in one or more `SRC2-…`
   records.

Source-reference rules per class:

- **CBA/BYL/NBA** components normally reference exactly **one** official
  `SRC2-…` record; more than one only where the obligation genuinely
  spans records, with the mapping column explaining the span. `—` is
  never valid for these classes.
- **DERIVED** components may reference multiple source/provenance records
  and/or earlier evidence components; **every formula input must resolve
  exactly** to a listed `SRC2-…` record or `EV2-…` component — no
  unlisted inputs.
- **INFERRED** components may reference multiple controlling passages and
  records and must identify **every** `SRC2-…`/`EV2-…` component used
  in the reasoning chain.
- **OPS** components must reference **at least one `SRC2-…` record of
  type `ops-provenance`** — `Source/provenance record IDs` is never `—`
  for an OPS component. The referenced record's Official URL may be `—`
  when no public URL exists, and its SHA-256 may be `—` only when no
  durable artifact exists, but the record must still carry named
  provenance, effective date, verification method, limitations, and
  configurability. The absence of a public artifact never eliminates the
  `SRC2-…` record itself.
- **EXT** components must reference **at least one `SRC2-…` record of
  type `ext-contract`** — `Source/provenance record IDs` is never `—`
  for an EXT component. The referenced record's Official URL and SHA-256
  may be `—`; the record defines the external determination class, the
  runtime input shape, the required provenance, the scope, and the
  effective/expiration behavior. No case-specific ruling need exist
  during canon construction; a reusable `ext-contract` record may be
  shared across LEAFs.

**Provenance-type ⇔ authority-class pairings (binding).** A directly
referenced `SRC2-…` record must carry a provenance type valid for the
referencing component's authority class:

| Authority class | Valid provenance types for directly referenced records |
|---|---|
| CBA, BYL | `official-immutable` |
| NBA | `official-immutable`, `official-mutable` |
| DERIVED, INFERRED | `official-immutable`, `official-mutable` (controlling passages and published inputs; dependency components may carry the rest of the chain) |
| OPS | At least one `ops-provenance`; `official-immutable`/`official-mutable` records may corroborate |
| EXT | At least one `ext-contract`; `official-immutable`/`official-mutable` records may bound the boundary |

**Transitive evidence-root compatibility (binding).** Local pairing,
termination, acyclicity, and Authority ⇔ EV checks are not sufficient on
their own: without a transitive rule, authority can launder through
dependencies — e.g., a DERIVED component depending only on an OPS-rooted
component would pass every local check while presenting operational
practice as derived law. For **every** `EV2-…` component, validators
must compute the **complete transitive dependency closure** (the
component plus every component reachable through `Dependency evidence
component IDs`) and its **terminal `SRC2-…` root set** (every
source/provenance record directly referenced by any component in that
closure), then enforce all of the following:

1. A **CBA** component's closure roots in the signed-CBA
   `official-immutable` record.
2. A **BYL** component's closure roots in the controlling By-Laws
   `official-immutable` record.
3. An **NBA** component's closure roots in an appropriate official
   `official-immutable` or `official-mutable` NBA record.
4. A **DERIVED** component remains arithmetic-only, and its controlling
   formula and published inputs must resolve through CBA/BYL/NBA/DERIVED
   components to suitable official roots. It may not be derived solely
   or ultimately from OPS or EXT provenance: no `ops-provenance` or
   `ext-contract` record may appear in its terminal root set, and an
   OPS/EXT-derived runtime value can never hide inside a DERIVED-only
   authority claim — arithmetic that consumes an operational or external
   input makes that input a separate, visible OPS/EXT component on the
   owning LEAF.
5. An **INFERRED** component's controlling legal/algorithmic reasoning
   must resolve through CBA/BYL/NBA and, where applicable, earlier
   compliant DERIVED/INFERRED components. No `ops-provenance` or
   `ext-contract` record may appear in its terminal root set: OPS
   reporting cannot become INFERRED merely through an `EV2-…`
   dependency, and an EXT determination cannot become express or
   inferred law.
6. An **OPS** component retains at least one `ops-provenance` record in
   its terminal root set.
7. An **EXT** component retains at least one `ext-contract` record in
   its terminal root set.
8. If a LEAF consumes an OPS or EXT component directly or transitively —
   through its `EV2-…` chains or through its LEAF `Dependencies` field —
   then: OPS or EXT remains visible in that LEAF's Authority field; a
   corresponding `EV2-…` component of that class exists; and every
   operational limitation, configurability requirement, external runtime
   input, and assumption-required state propagates to the LEAF's
   Notes/limitations and behavioral contract (an EXT-consuming verdict
   path surfaces "assumption required", never an unqualified PASS/FAIL).
9. No dependency edge may reduce, erase, or upgrade the authority or
   limitation status of the component it consumes.

Compatibility matrix (parseable; enforced per component over the full
transitive closure):

| Consuming EV class | Permitted direct dependency classes | Permitted terminal SRC2 provenance types | Required propagated classes/limitations | Forbidden dependency/root combinations |
|---|---|---|---|---|
| CBA | — (none; direct official reference only) | `official-immutable` (signed CBA) | — | Any dependency component; any `official-mutable`, `ops-provenance`, or `ext-contract` root |
| BYL | — (none; direct official reference only) | `official-immutable` (controlling By-Laws) | — | Any dependency component; any `official-mutable`, `ops-provenance`, or `ext-contract` root |
| NBA | — (none; direct official reference only) | `official-immutable`, `official-mutable` (official NBA records) | — | Any dependency component; any `ops-provenance` or `ext-contract` root |
| DERIVED | CBA, BYL, NBA, DERIVED | `official-immutable`, `official-mutable` | Formula-input and rounding limitations propagate to the LEAF | Any OPS or EXT dependency; any `ops-provenance` or `ext-contract` root |
| INFERRED | CBA, BYL, NBA, DERIVED, INFERRED | `official-immutable`, `official-mutable` | Inference-chain limitations propagate to the LEAF | Any OPS or EXT dependency; any `ops-provenance` or `ext-contract` root |
| OPS | — (none; direct references only) | ≥1 `ops-provenance`; `official-immutable`/`official-mutable` may corroborate | OPS class, operational limitations, and configurability propagate to the LEAF | A terminal root set without an `ops-provenance` record |
| EXT | — (none; direct references only) | ≥1 `ext-contract`; `official-immutable`/`official-mutable` may bound the boundary | EXT class, the runtime-input contract, and "assumption required" propagate to the LEAF | A terminal root set without an `ext-contract` record |

A chain that passes every local check but violates this matrix — e.g., a
DERIVED component whose only terminal root is an `ops-provenance`
record, or an INFERRED component rooted only in an `ext-contract`
record — **fails**: the validator rejects the component, the laundered
class claim, and any verdict that would rely on it. U9 enforces this
per unit, G14 recomputes it globally, and R9 independently recomputes
every closure and terminal root set.

Resolution and reconciliation (exact and bidirectional; checked at U8/U9,
rechecked globally at G14, and independently re-run at R9):

- Every referenced `SRC2-…` or `EV2-…` ID resolves to an existing row;
  `EV2-…` dependency chains are acyclic; every evidence path terminates
  in at least one typed `SRC2-…` source/provenance record; no `EV2-…`
  row has both reference fields empty; and every provenance-type ⇔
  authority-class pairing is valid.
- Every `SRC2-…` record passes the type-specific field-level validation
  above (no required field absent, malformed, or `—` where the per-type
  matrix prohibits it).
- Every `EV2-…` component's complete transitive dependency closure and
  terminal `SRC2-…` root set satisfy the compatibility matrix above —
  every dependency edge class-permitted, every terminal root
  type-permitted, no authority-laundering chain, and OPS/EXT visibility
  and limitation propagation verified at every consuming LEAF.
- Every `EV2-…` row belongs to an existing active LEAF and appears in
  that LEAF's Evidence components field.
- Every `EV2-…` row's authority class appears in its LEAF's Authority
  field, **and** every authority class listed on a LEAF has at least one
  `EV2-…` row of that class.
- No orphan references: by the end of R8 every `SRC2-…` row is referenced
  by at least one `EV2-…` row, and every `EV2-…` row is referenced by
  exactly the LEAF it certifies.

Per-class minima:

- **CBA/BYL:** exact article/section/subsection/exhibit and printed page; a
  short controlling quotation or tight paraphrase; an explicit explanation
  of how the passage creates or bounds the obligation.
- **NBA:** title, publication date or season (a season under the pinned
  `YYYY-YY` season grammar of §15.9.6), direct official URL, relevant
  heading/table, and the exact values relied upon.
- **DERIVED:** the formula, inputs, source dependencies, units, and
  rounding.
- **INFERRED:** the controlling locators, the stated inference, the
  reasoning chain, and what the text does and does not expressly say.
- **OPS:** provenance, effective date, limitation, and configurability.
- **EXT:** the boundary describing which external decision is required.

**Class-specific certification (binding; replaces the universal
read-the-passage rule).** An evidence-component row is valid only if the
certifying agent performed the row's class-specific certification duty
during the session that authored the row, attested per LEAF in the unit
receipt:

| Class | Certification duty |
|---|---|
| CBA, BYL | Read the controlling passage in the identified official artifact |
| NBA | Verify the official publication and the exact value/date relied upon |
| DERIVED | Verify the formula, every resolved input, the units, and the rounding |
| INFERRED | Read every controlling passage and verify the complete stated reasoning chain |
| OPS | Verify the qualifying operational provenance record and its required fields; never invent or imply a public passage |
| EXT | Verify the source/rule or contract defining the external boundary and the required runtime provenance; never invent a case ruling |

No class is certified by inventing a passage that does not exist:
arithmetic, inference, operational provenance, and external runtime
contracts are certified by verifying what actually grounds them.

**Adjacent provisions:** each R3–R6 receipt must record a family-level
adjacent-provision sweep (the neighboring sections read while certifying
the family); per-LEAF adjacent notes are required only where an adjacent
proviso materially limits that LEAF.

#### 15.9.7 Verification methods

The five behavioral methods:

| Method | Use when |
|---|---|
| **SCEN** | The rule is deterministic and an executable scenario can drive inputs to a verdict |
| **STATIC** | The obligation is a configuration, provenance, schema, or architecture property inspectable without execution |
| **LIFECYCLE** | The obligation is about ordered state/events/history (creation, persistence, expiry, rollover, reset) |
| **EXTS** | The obligation consumes an externally supplied determination |
| **UI** | The obligation is a user-visible representation requiring rendered/manual inspection |

Binding rules:

1. Every active v2 LEAF has **exactly one primary method** and **zero or
   more distinct secondary methods**, carried in parseable `Primary method`
   and `Secondary methods` fields. There is no exactly-one-method
   assumption: a rule may legitimately be exercised by a scenario and also
   inspected statically.
2. Source certification (§15.9.6) does not count as a behavioral method.
3. The v1.1 OPSV label is not a method and must not be assigned;
   OPS-authority configurability/provenance obligations use STATIC with the
   OPS evidence minima.
4. Architecture and representation properties are STATIC, never SCEN. If no
   honest scenario exists for a SCEN-primary LEAF, reclassify the primary
   method — never attach a cosmetic mapping. During R7, reclassification is
   bounded by the §15.9.8 method-correction authority and requires a
   `METHOD` decision record.

Minimum evidence per method: **SCEN** — a v2 scenario meeting the §15.9.8
contract whose named case exercises the LEAF. **STATIC** — the inspected
artifact identity, the property confirmed, how it was inspected, and the
commit/date (plus provenance/version/configurability proof for OPS rows).
**LIFECYCLE** — the ordered event sequence, the asserted state after each
step, and persistence across the sequence. **EXTS** — the enumerated
external states, the provenance record shape, the expected behavior per
state including "assumption required" surfacing, and confirmation that no
state is auto-derived. **UI** — the state to render, exactly what the user
must see, and the rendered-inspection record.

#### 15.9.8 Scenario library and scenario crosswalk

**Historical scenario identity is pinned to the published v1.1 edition.**
The historical scenarios are scenarios 1–89 **exactly as published at
commit `9814939c`** (canon v1.1, file SHA-256 `4a0760c8…`). The pinned
published scenario source is the exact §16 byte range of that edition: the
bytes of `docs/reference/cba/ARCHITECT_CBA_CANON.md` at `9814939c` from
the first byte of the line `## 16. Acceptance-test library` to the last
byte before the line `## 17. Recommended comparison sequence` —
**14,390 bytes, SHA-256
`5289f6b812c2d86238674461574c725e894f0bca0db4da188b276246d96706aa`**.

Three scenario populations must never be conflated:

1. **The published v1.1 scenarios 1–89 (historical).** Their meanings are
   fixed by the pinned source above. This pinned published set — never
   the legacy-numbered working copy on this branch — is the historical
   source of every `SXW2-…` edge.
2. **The R1/R1.1 corrected scenario variants** — the current branch's
   legacy-numbered §16 working copy, which rewrote scenarios 50, 53, 57,
   60, 67, 68, and 69 against the signed text. These are **repair-source
   inputs for authoring `CBA2-SC-…` scenarios at R7 only**. They do not
   retroactively redefine the published historical scenario numbers, and
   they are never `SXW2-…` sources.
3. **The active v2 library** (`CBA2-SC-…`, built new by R7). Neither of
   the other two populations is the active v2 library.

The legacy-numbered §16 section on this branch is frozen after R1.1 and is
not edited again. Scenarios 53, 57, and 68 remain historical and
incomplete; their replacement coverage belongs to R7.

**Active v2 scenario grammar:** `CBA2-SC-<NNN>` (`CBA2-SC-001`,
`CBA2-SC-002`, …). R7 builds the library from scratch. Every active v2
scenario states:

1. Scenario ID.
2. An explicit season/date or versioned-calendar input.
3. Inputs.
4. The boundary being tested.
5. The exact expected result, including arithmetic where relevant.
6. The controlling authority.
7. Named case/variant identifiers (e.g., `CBA2-SC-014(a)`).
8. An `Exercises:` list of active v2 LEAFs.

Every scenario→LEAF edge must correspond to a **named case that genuinely
exercises that LEAF**: the case's facts and expected results test the
obligation, not merely cite it. The register's Scenario-evidence column and
the scenario `Exercises:` lists must reconcile **bidirectionally**. R7 must
review every edge exhaustively; later sampling (R8/R9) is an additional
audit, never a substitute for the exhaustive R7 review. SCEN coverage
completeness is gated by SC6 (§15.9.9), which cannot be satisfied by
empty-set equality.

**R7 method-correction authority (bounded).** While building the scenario
library, R7 may correct only these fields of an active LEAF, and only as a
method-fit correction discovered through scenario construction:
`Primary method`, `Secondary methods`, `Scenario evidence`, and the
`Decision records` reference the correction adds. Every such change
requires a `METHOD` decision record (§15.9.4) in the R7 receipt stating
the LEAF, the old method set, the new method set, why the previous method
assignment was dishonest, and the resulting evidence requirement. R7 may
**not** change a LEAF's requirement, authority classes, source evidence,
origin, or dependencies; a discovery requiring any of those changes
returns to the owning R3–R6 unit for correction under the §15.9.2
draft-mutability rules. Gate SC7 verifies that every method change has a
`METHOD` record and that no R7 edit touched a field outside this
authority.

**Scenario crosswalk** (`SXW2-<NNNN>`): a separate parseable register of
typed edges from the pinned published historical scenarios 1–89 (at
`9814939c`, per the pinned source above) to active v2 scenarios, with the
schema
`Edge ID | Historical scenario | Active v2 scenario or — | Edge type | Scope/relationship | Decision record`
and edge types `equivalent`, `split`, `merge`, `partial-overlap`, `moved`,
`invalid`, and `no-successor` (the last two terminal, with `—` targets).
Every `SXW2-…` edge identifies its historical scenario by number in the
pinned published set — never the legacy-numbered working copy on this
branch. The crosswalk rules of §15.9.3 apply analogously: bipartite
historical → active, the deterministic edge-typing order with exactly one
primary relationship type per source–target pair, the narrow no-successor
rule, compound history as multiple edges, no verdict or coverage
inheritance — a crosswalk edge never makes a historical scenario part of
the active library. The complete SXW2 integrity contract — ID grammar,
edge-ID uniqueness, the allowed type vocabulary, pinned-population
sources, complete 1–89 coverage, target and terminal discipline,
decision-record resolution, the duplicate-pair ban, deterministic
precedence, the narrow no-successor rule, and parseable scope content —
is gated in full by SC2 (§15.9.9) and rerun in full by G10 and R9.

#### 15.9.9 Release gates and timing

Gates run at the point where their inputs exist — never earlier. Mechanical
gates are parser-checkable and their outputs are recorded verbatim in the
gating receipt; semantic gates require reviewer judgment evidenced in the
same receipt. No gate output may claim that a parser proved a semantic
property (uniqueness, atomicity, coverage truth, or dependency
completeness).

**R3–R6 — unit-local gates only.** Each family unit checks, for the
families it touched:

| # | Gate |
|---|---|
| U1 | Active v2 ID grammar and uniqueness |
| U2 | Fixed roles and valid GROUP parents |
| U3 | Family active counts, recomputed mechanically |
| U4 | Semantic atomicity dispositions — every registered LEAF has an `ATOM` record (or is covered by one) |
| U5 | Semantic duplicate/ownership dispositions — the mandatory §15.9.4 candidate population (all seven generators) is recorded in the receipt, and every candidate has an `OWN` record or a named cross-family deferral (both families and the expected resolving unit named); zero undispositioned in-scope candidates |
| U6 | Tiebreak decision records — every ownership decision states the discriminating tiebreak and why |
| U7 | Crosswalk coverage and valid targets for the historical LEAFs touched by the unit (deferrals listed explicitly) |
| U8 | Per-LEAF evidence completeness — every authority component has a complete `EV2` row meeting its class minima and its class-specific certification duty (§15.9.6); no `EV2` row has both reference fields empty (no source-free terminal component); every OPS component references an `ops-provenance` record and every EXT component an `ext-contract` record; every provenance-type ⇔ authority-class pairing is valid; every referenced `SRC2` record passes the §15.9.6 type-specific field-level validation (base row plus its pinned detail row present and joinable; no required field absent or malformed; no `—` where the per-type matrix prohibits it; the per-type timestamp and hash rules satisfied; every structured season value valid under the pinned `YYYY-YY` season grammar; the three split verification-metadata fields — `Verifier identity`, `Verification session ID`, `Verification date` — each present, never `—`, and independently valid under their §15.9.6 grammars); and for the unit's families the LEAF Authority fields and `EV2` classes reconcile exactly in both directions (every listed class has ≥1 `EV2` row; every `EV2` row's class is listed) |
| U9 | Source and dependency resolution — every `SRC2`/`EV2` reference in the unit's rows parses under the §15.9.6 grammar (the same pinned field grammars U8 validates, including the `YYYY-YY` season grammar and the three split verification-metadata grammars) and resolves; every evidence path terminates in at least one typed `SRC2` source/provenance record; DERIVED/INFERRED input and reasoning chains resolve exactly; `EV2` dependency chains are acyclic; no orphan or dangling references; and for every `EV2` component the complete transitive dependency closure and terminal `SRC2` root set are computed and validated against the §15.9.6 compatibility matrix — every dependency edge class-permitted, every terminal root type-permitted, no authority laundering (a DERIVED or INFERRED component with an `ops-provenance` or `ext-contract` root fails), OPS/EXT visibility and limitation propagation verified at every consuming LEAF, and every locally valid but transitively incompatible chain rejected |
| U10 | Primary/secondary method validity (exactly one primary; distinct secondaries; no OPSV) |
| U11 | No process-shaped active rows |
| U12 | Every true-gap note has a minted, fully certified owner (`TG` records complete) |
| U13 | Child-ID numbering integrity (§15.9.2) — at initial GROUP construction, children are contiguous `.1…n`; after any `AMEND` event, every missing allocated child ID resolves through the immutable receipts and an `AMEND` chain to an explicit removal or one or more current successors; no unexplained or never-allocated interior gap; no reused or reassigned ID; no renumbering of surviving children; new children allocated only above the highest child ID ever allocated in the GROUP |
| U14 | Family-level adjacent-provision sweep recorded in the receipt |

Code-map gates, Phase 2 packet gates, global dependency gates, and global
scenario-reconciliation gates are **not** run during R3–R6.

**R7 — scenario gates:**

| # | Gate |
|---|---|
| SC1 | v2 scenario ID grammar and schema checks (all eight required elements) |
| SC2 | Complete SXW2 integrity contract — **every** check in the enumerated SC2 contract below this table; historical-scenario coverage is one check among sixteen, never the whole gate |
| SC3 | Bidirectional scenario↔LEAF reconciliation (register Scenario-evidence ⇔ scenario `Exercises:` lists) |
| SC4 | Exhaustive named-case review for every `Exercises:` edge — the named case genuinely exercises the LEAF |
| SC5 | No cosmetic or unsupported scenario mappings |
| SC6 | SCEN coverage completeness (non-empty by construction) — every active LEAF with `SCEN` as its Primary method has at least one active `CBA2-SC-…` named case that genuinely exercises it; every active LEAF listing `SCEN` among its Secondary methods also has at least one such named case; every active scenario exercises at least one active LEAF; every `Exercises:` entry resolves to a named case and an existing active LEAF; every register Scenario-evidence entry resolves to the same named case; no `pending R7` markers remain; SC1–SC5 cannot pass through empty-set equality — SC3's bidirectional reconciliation is invalid if either side is empty while any SCEN-designated LEAF exists |
| SC7 | Method-change records — every R7 change to a Primary/Secondary method has a complete `METHOD` decision record, and no R7 edit touched a field outside the §15.9.8 method-correction authority |

**SC2 — complete SXW2 integrity contract (binding; every check below):**

1. `SXW2-<NNNN>` ID grammar.
2. Edge-ID uniqueness.
3. Edge types drawn only from the allowed vocabulary (`equivalent`,
   `split`, `merge`, `partial-overlap`, `moved`, `invalid`,
   `no-successor`).
4. Historical sources restricted to scenarios 1–89 in the pinned
   published v1.1 scenario population at commit `9814939c` (§15.9.8).
5. Complete coverage — every published historical scenario 1–89 has at
   least one `SXW2` edge.
6. No source outside the pinned 1–89 population.
7. Every non-terminal edge targets an existing active `CBA2-SC-…`
   scenario.
8. `invalid` and `no-successor` are the only terminal SXW2 types, each
   with target `—`.
9. No non-terminal edge has target `—`.
10. No terminal edge has a live target.
11. Every decision-record reference resolves.
12. Exactly one primary relationship type per historical-source/
    active-target pair.
13. No duplicate source–target pair under another type.
14. Every edge was typed by the deterministic relationship precedence of
    §15.9.3, applied analogously per §15.9.8.
15. Every `no-successor` edge satisfies the narrow §15.9.3 rule,
    including the exact scope/edition basis, and is never used for
    unresolved, uncertified, deferred, unsupported, or inconvenient
    coverage.
16. Scope/relationship content is parseable and exact enough to identify
    which part of the historical scenario the edge covers and how.

**R8 — global reconciliation gates:**

| # | Gate |
|---|---|
| G1 | Complete historical-LEAF crosswalk coverage — every published v1.1 LEAF has at least one outgoing edge; zero deferrals remain |
| G2 | All non-terminal crosswalk targets resolve to active v2 LEAFs |
| G3 | Terminal edges and companion true-gap records validate; every `no-successor` edge receives an exhaustive semantic review against the §15.9.3 no-successor rule — the exact scope/edition basis is verified, and none hides an unresolved, uncertified, deferred, or merely unsupported in-scope obligation |
| G4 | Global active GROUP/LEAF counts, with historical and support records excluded |
| G5 | The code map and Phase 2 packets contain active v2 LEAFs only |
| G6 | Every active v2 LEAF appears exactly once wherever the map/packet contract requires it |
| G7 | No historical ID, GROUP, crosswalk edge, or scenario ID appears in a verdict column |
| G8 | Dependency order contains no later-unit dependency and no cycles — mechanical cycle/order checks **plus a semantic dependency review** (a parser cannot prove a dependency was never omitted) |
| G9 | Global ownership/atomicity reconciliation across families, including a rerun global cross-family duplicate-candidate sweep (all §15.9.4 generators) with zero unresolved candidates |
| G10 | Scenario reconciliation rerun — SC1–SC7 across the whole library, including the **complete SC2 SXW2 integrity contract** (all sixteen checks), never coverage alone |
| G11 | Sampled semantic rechecks of merge/split decisions, scenario coverage, and source-derived obligations |
| G12 | README status update — recording R8 completion while keeping the canon unaccepted |
| G13 | Final v2 checksum and counts recorded in the receipt |
| G14 | Global evidence reconciliation — the §15.9.6 resolution and bidirectional class checks pass across the whole registry: typed `SRC2` termination for every evidence path; no source-free terminal `EV2` component; class-specific certification attested for every component; valid provenance-type ⇔ authority-class pairings; acyclic `EV2` dependency chains; exact Authority ⇔ `EV2` reconciliation in both directions; zero orphan or dangling `SRC2`/`EV2` rows or references; type-specific field-level validation of every `SRC2` record (base plus pinned detail row, per-type `—` validity, timestamp/hash rules, the pinned `YYYY-YY` season grammar, and the three split verification-metadata fields under their §15.9.6 grammars); and the complete transitive dependency closure and terminal root set of every `EV2` component recomputed globally against the §15.9.6 compatibility matrix — zero authority-laundering chains, with OPS/EXT visibility and limitation propagation verified at every consuming LEAF |
| G15 | Amendment-chain integrity across every live v2 population (active GROUP/LEAF, `XW2`, `SRC2`, `EV2`, active `CBA2-SC` scenarios/named cases, `SXW2`, `DR2`) — zero stale live references to superseded IDs, versions, or decision records; no duplicate or orphan record created by any correction; every receipt-era ID/version resolves forward through its `AMEND` chain; every supersession chain terminates in exactly one current disposition or an explicit removal; and child-ID numbering integrity under the §15.9.2 contract — every numeric gap in a GROUP's live children resolves through the receipts and `AMEND` chain to an explicit removal or current successors, no unexplained or never-allocated interior gap, no reused/reassigned ID, no renumbering, and every new child above its GROUP's historical high-water mark |

**R9 — independent acceptance.** The independent reviewer (who authored no
part of v2.0) must: re-run every mechanical gate from scratch;
independently sample primary-source passages; independently sample active
obligation atomicity and ownership; **independently regenerate the
duplicate-candidate population (all §15.9.4 generators) rather than
trusting the unit lists**; independently sample scenario truth; **review
every `no-successor` disposition individually — not a sample**;
**independently verify the `AMEND` amendment chain across every live v2
population (§15.9.2) — zero stale live references, no duplicate or
orphan record created by any correction, every receipt-era ID/version
resolvable forward, every supersession chain terminating in exactly one
current disposition or explicit removal, and child-ID numbering
integrity under the §15.9.2 contract (every live gap resolved through
the receipts and `AMEND` chain to an explicit removal or current
successors; no unexplained or never-allocated interior gap; no
reused/reassigned ID; no renumbering; every new child above its GROUP's
historical high-water mark) — and re-run the exact
bidirectional evidence reconciliation (G14), including typed `SRC2`
termination for every evidence path, the no-source-free-terminal-component
check, class-specific certification, provenance-type ⇔ authority-class
pairing validity, `EV2` acyclicity, the type-specific field-level
validation of every `SRC2` record (base plus pinned detail row, per-type
`—` validity, timestamp/hash rules, the pinned `YYYY-YY` season grammar,
and the three split verification-metadata fields under their §15.9.6
grammars), and an independent recomputation of
every `EV2` component's complete transitive dependency closure and
terminal `SRC2` root set against the §15.9.6 compatibility matrix —
zero authority-laundering chains, with OPS/EXT visibility and
limitation propagation verified at every consuming LEAF**; **re-run the
complete SC2 SXW2 integrity contract (§15.9.9) — never coverage alone**;
runtime-sample code-map pointers; and issue an explicit **ACCEPT or
REJECT** at a pinned clean commit. Only R9 ACCEPT closes Phase 1 or unblocks Phase 2/W1.1.

#### 15.9.10 Superseded R2 machinery

The following R2 concepts are superseded and must not appear in any binding
rule, register, crosswalk, receipt gate, or disposition from R2.1 onward.
They may be named only in clearly labeled historical or superseded
descriptions (the amendment log, the preserved R2 receipt, and review
history):

| Superseded R2 concept | v2 treatment |
|---|---|
| Same-namespace in-place retirement of `CBA-…` IDs | The historical registry is frozen; v2 obligations are new `CBA2-…` IDs linked by the XW2 crosswalk |
| RETIRED/ALIAS as an active node role | No such role; historical IDs are outside the active registry entirely |
| PHANTOM as a disposition | Terminal `invalid` crosswalk edges plus, where a real obligation was exposed, a companion true-gap record |
| Append-in-place successor slots in the historical namespace | Nothing is ever appended to the historical namespace |
| GROUP retirement | Active GROUPs are minted with the registry; historical GROUPs are frozen |
| Top-level-LEAF and LEAF→GROUP conversion | Roles are fixed at minting; no top-level LEAFs exist in v2 |
| Singular predecessor/successor fields | Typed many-to-many crosswalk edges; the Origin field lists any number of incoming edges |
| Exactly one verification method per LEAF | Exactly one primary method plus zero or more secondary methods |
| DERIVED for non-arithmetic inference | INFERRED |
| DERIVED/OPS composite labels | Separate evidence rows per component; unresolved composites banned |
| Per-unit code-map and global dependency gates | Unit-local gates in R3–R6; global gates at R8 |
| Scenarios 1–89 as the active library | Frozen historical; the active library is `CBA2-SC-…`, built by R7 |

## 16. Acceptance-test library

The later Architect audit should use concrete scenarios, not only unit-level rule labels.

### Trade matching and salary

1. Expanded TPE at each formula crossover using the current season's scaled amount.
2. Same trade one dollar below/above First and Second Apron.
3. One outgoing for two incoming under Standard TPE while above Second Apron.
4. Two outgoing aggregated for one cheaper incoming while above Second Apron — must fail.
5. Standard TPE generated in-season and attempted after regular season by a First-Apron team.
6. Partially used Standard TPE, remaining balance, and exact expiration.
7. Non-guaranteed player traded preseason, 25% into season, January 8, and after season.
8. Player guarantee amended immediately before trade.
9. Minimum Exception player with OTS for sender and $0 ITS for receiver.
10. Three minimum contracts stacked outside the allowed date window with fewer players returning.
11. Rookie Scale extension traded before it begins: normal OTS, poison-pill ITS.
12. Team-based likely bonus switches classification between sender and receiver.
13. Percentage trade kicker at preseason, midseason, and offseason dates.
14. Trade bonus reduced enough to make trade work and resulting renegotiation restriction.
15. Sign-and-trade with base-year adjustment and First Apron hard cap.

### Apron and tax

16. NTMLE use that fits TMLE terms versus use above TMLE terms.
17. BAE use just under and just over First Apron.
18. TMLE use just under and just over Second Apron.
19. Post-season trade that passes current year but fails next-year assumed Apron Salary.
20. Team above Second Apron at the start of its final regular-season game; future pick freezes, then slides after two of four years or unfreezes after three qualifying at/below seasons.
21. Taxpayer in exactly two, three, and four of prior four seasons.
22. Earned unlikely and unearned likely bonus tax reconciliation.
23. Partial final tax bracket for repeater and non-repeater teams.

### Cap holds and exceptions

24. Full Bird free agent below/above EAPS and max/min bounding.
25. RFA where QO exceeds ordinary hold; matched offer sheet changes the controlling amount.
26. First-round pick selected, traded as rights, signed at 120%, and stashed overseas.
27. Team with fewer than 12 counted spots and multiple open-roster charges.
28. Room team with exception holds, then renounces exceptions to create room.
29. DPE granted for a player unable through June 15, then unused before player returns.
30. Long-term injury exclusion after waiver versus DPE with salary still present.

### Waivers and rosters

31. Partially guaranteed veteran waived before January 10 where earned salary is below guarantee.
32. Same player waived later where earned salary exceeds guarantee.
33. Subsidized veteran minimum waived; dead salary uses actual compensation.
34. Stretch election August 31 versus September 1.
35. Buyout followed by new contract and set-off.
36. Trade receiving an extra player with no pre-existing slot but planned immediate waiver — must fail.
37. Team at 13 Standard players for the final permitted short-roster day, then one day beyond.
38. Two Two-Way players active with 13 Standard players and Under-Fifteen Games accumulation.
39. Offseason transition from regular-season lists to the 21-player count.

### Rights and calendar

40. One-year Bird-rights contract with automatic consent right waived and not waived.
41. Ordinary free-agent signing, Bird signing, drafted rookie signing, waiver claim, renegotiation, and rich extension — each with correct trade date.
42. Matched RFA offer sheet trade to offering team inside one year — must fail.
43. Option-year player attempted in post-season trade before exercising option.
44. Over-38 contract with and without Full Bird special treatment and a July 1 reattribution.
45. Protected firsts with multiple fallback years that create a possible Stepien violation.
46. **OPS regression:** three-team trade where one team only touches one other team — must fail under the configured league-operational rule despite valid salary math.

### Index amendment additions (v1.1)

Scenarios 1–46 are unchanged. These 43 scenarios were added because a deterministic rule family had **no scenario coverage at all**, or because a legal condition that can independently fail was exercised by nothing in the library. They are deliberately **not** one scenario per obligation: `CBA-S01`, `CBA-S02`, and `CBA-S03` are verified by static and configuration inspection rather than an executable case, and `CBA-A21` already had scenario 10.

47. Five ledgers diverge for one roster: Team, Apron, Tax, ITS, and OTS all differ for the same players on the same date, including the separate player-compensation ledger.
48. Multi-player trade legal only through a per-team component decomposition; a second trade with no legal decomposition is refused with an explanation of why none exists.
49. Trade bonus end to end: the 15% ceiling on remaining base compensation, a once-only trigger across an initial sign-and-trade then a later trade, the guaranteed-base denominator excluding unexercised options, the 120%-of-Rookie-Scale ceiling, sender pays while the receiver carries the allocation, and a player waiver creating the six-month renegotiation restriction.
50. Re-trade of an exception-acquired player: the VII §6(j)(4)(i) aggregation bar and its deadline carve-out, tested as four independent variants (each a separate hypothetical on its own facts — never a sequence, because a traded player cannot be traded again by the same team). **Test calendar:** 2026–27 Salary Cap Year; the NBA trade deadline is defined for this scenario as Thursday, February 11, 2027 (season deadlines are versioned calendar data, not permanent constants). **Variant (a) — solo re-trade:** a player acquired via an exception on November 20, 2026 is re-traded alone, not aggregated with any other Traded Player, on January 10, 2027. Expected: **not barred by §6(j)(4)(i)** — the bar reaches only players among two or more Traded Players being aggregated under §6(j)(1)(ii)–(iv). **Variant (b) — aggregation inside two months:** a player acquired via an exception on November 20, 2026 is included among two aggregated Traded Players on January 10, 2027, inside the two-month period that runs through January 20, 2027 (the section's own example uses November 20 → January 20). Expected: **barred by §6(j)(4)(i)**. **Variant (c1) — day-before-deadline carve-out:** a player acquired via an exception on December 15, 2026 (on or before December 16) is included among aggregated Traded Players on February 10, 2027 — the day before the trade deadline, inside the two-month window that would otherwise run through February 15, 2027. Expected: **not barred by §6(j)(4)(i)** — when the acquisition was on or before December 16, the bar does not apply to a trade on or after the day prior to the deadline; only the carve-out makes this legal. **Variant (c2) — two days before the deadline:** identical facts to (c1) except the aggregation occurs on February 9, 2027. Expected: **barred by §6(j)(4)(i)** — the carve-out does not reach trades earlier than the day before the deadline. Every expected result states only whether §6(j)(4)(i) bars the transaction; overall trade legality (salary matching, aprons, roster slots) is outside this scenario. Exercises (provisional pending R7): the CBA-A10.2 aggregation restriction and carve-out at their boundaries. Does not exercise: re-aggregation after a sign-and-trade (CBA-A10.3). **Authority:** CBA VII §6(j)(4)(i), p. 242.
51. Sign-and-trade eligibility and contract shape: a player who did not finish the prior season on the sending team's roster, completion after the regular season begins, a two-season term, an unprotected Year 1, and a barred signing exception — each must fail independently.
52. Extend-and-trade: starting salary above the greater of 120% of prior regular salary and 120% of EAPS, an over-long term, raises above 5%, and the barred end-of-contract offseason window.
53. Cash-in-trade including a sign-and-trade signing bonus. **Input:** a team pays cash to its annual sent limit in one trade and receives cash in a later trade; it then executes a sign-and-trade in which the new contract carries a signing bonus paid by the signing (sending) team; a further variant attaches conditional cash to a pick payable in a later year; a final variant has the paying team landing above the Second Apron. **Boundary:** sent and received are separate annual limits (each 5.15% of the cap) and are never netted; the sending team's payment of the signing bonus is treated as reimbursement of the assignee's compensation obligation and counts against the cash limits; cash connected directly or indirectly to a trade is charged to the Salary Cap Year of the trade, not the payment date; paying cash is Second Apron-limited. **Expected:** the sent limit exhausts independently of the received limit; the signing-bonus payment consumes sent-cash capacity and blocks the sign-and-trade when it exceeds what remains; the conditional cash charges to the trade's cap year; the above-Second-Apron team cannot pay cash. **Authority:** CBA VII §8(a), p. 260 (signing-bonus-as-cash and no-netting expressly); VII §2(e)(4) Transaction Restrictions Table row I, p. 191 (Second Apron cash limit).
54. **OPS regression:** multi-team trade whose only qualifying asset from one team is an extinguishable conditional pick, and one whose draft-rights asset fails the qualifying-prospect test — both refused under the configured league-operational rule.
55. Pick mechanics: a conveyance combining protection and deferral; a "two years after prior conveyance" condition that would reach past the seventh future draft; and pick swaps and deferral rights represented in the pick ledger.
56. The $250,000 allowance falls to zero when post-assignment Apron Team Salary would exceed the First Apron; and the 110% Transition TPE is available only in a 2023–24 historical simulation, never as a current fifth tier.
57. Apron Salary derived from the **ten** enumerated CBA VII §2(e)(1)(i)–(x) adjustments. **Input:** one roster whose facts activate every adjustment — excluded performance bonuses (i), a qualifying 0–1 YOS free-agent contract (ii), potential grievance exposure (iii), Free Agent Amounts (iv), an RFA with an outstanding QO and a First Refusal Exercise Notice (v), an unsigned first-round pick (vi), an outstanding Required Tender to a first-round pick (vii), an exception amount included in Team Salary (viii), an SRPE amount temporarily excluded from Team Salary (ix), and an incomplete-roster cap hold (x) — computed both before and after a proposed transaction. **Boundary:** each of the ten adjustments is separately enumerated; (vi) and (vii) are distinct adjustments and must be exercised as two independent cases, never one merged step. **Expected:** with each of the ten adjustments independently wrong in turn, the computed Apron Salary is wrong in exactly the predicted direction and amount, and the before/after computation catches a transaction that lands above an apron. **Authority:** CBA VII §2(e)(1)(i)–(x), pp. 186–187.
58. Signing a qualifying high-salary waived player during the regular season above the First Apron; and using a TPE created from a sign-and-traded contract above the Second Apron.
59. Post-regular-season transaction evaluated under the five next-year assumptions — options exercised, ETOs not exercised, conditioned Higher Max achieved, apron levels held, no further current-year transactions — producing a hard cap in both Salary Cap Years.
60. Minimum team salary: the MTS shortfall payment and the Team Salary charge are two different calculations on two differently adjusted bases, with pinned values that force them apart. **Input (test values in $M against a hypothetical parameter set; season semantics pinned to 2026–27):** Minimum Team Salary 100; season-start MTS Cap Hold Team Salary 90; MTS Payment Team Salary 85 (the season-start MTS Cap Hold value adjusted per §2(c)(1)(ii): plus §4(h) exclusions, minus §3(e) inclusions, plus §4(b) exclusions); during the regular season the team's then-current MTS Cap Hold Team Salary drops to 80. **Boundary:** the team-to-NBA MTS shortfall payment equals Minimum Team Salary − MTS Payment Team Salary (§2(c)(2)(i)); the in-season Team Salary charge equals Minimum Team Salary − the lesser of then-current and season-start MTS Cap Hold Team Salary (§2(c)(3)). **Expected:** shortfall payment = 100 − 85 = **15**, paid by the team to the NBA — never to players — and redistributed equally to each team under §2(c)(6); Team Salary charge = 100 − min(90, 80) = **20**; an implementation returning 15 for both, or 20 for both, is wrong. The team is also barred from the non-taxpayer tax distribution (§2(c)(2)(ii)), and the drop of then-current MTS Cap Hold Team Salary (80) below the MTS Threshold (lesser of 100 and 90 = 90) obligates the team to restore it to at least 90 by the end of the immediately following day (§2(c)(1)(iii), §2(c)(4)). **Year-end:** with the team's financially responsible portion of total MTS Cap Hold Team Salaries — recomputed with excluded-but-earned Incentive Compensation added and included-but-unearned Incentive Compensation removed — equal to 82, the §2(c)(5) reconciliation requires a further payment of 100 − (82 + 15) = **3**. **Historical isolation:** in the 2023–24 Salary Cap Year only, a shortfall team owing no tax received a 50% share of the non-taxpayer distribution (§2(c)(7)); in 2026–27 the bar is total. Exercises (provisional pending R7): the payment/charge base distinction, the tax-distribution bar, the §2(c)(4) restoration duty, and the §2(c)(5) year-end re-test. **Authority:** CBA VII §2(c)(1)–(7), pp. 176–179.
61. Derived-value recomputation: `A`, both Expanded TPE crossovers, the tax-bracket width, the BAE, and the cash limits recomputed from published inputs for a new Salary Cap Year, with no rounding before the rule-defined final step.
62. Exception rules: two exceptions aggregated to sign one player — must fail; a Second Round Pick Exception excluded from Team Salary through July 30 but added to Apron Salary; the Rookie Scale Exception used over the cap; full exception value retained for a trade or offer sheet.
63. Bird authority by type: Non-Bird, Early Bird, and Full Bird first-year amounts, terms, and raises; renunciation from Early Bird down to Non-Bird; and the narrow unrenouncing route after a matched offer sheet.
64. Arenas offer sheet: the offering team carries average annual salary for room and Team Salary while the matching team uses the stated schedule, then elects averaging in the specified below-cap circumstance.
65. Rookie and veteran extensions: the 80%–120% Rookie Scale range, conditional Higher Max language, the greater of 140% of final regular salary or 140% of EAPS, a Designated Veteran Extension carrying no Incentive Compensation, and a declined option capping the prior team's first-year offer.
66. Over-38 applicability: a four-season contract crossing age 38 on October 1; the moratorium-birthday rule using age as of the prior June 30; and Over-38 Years beginning at the later of the fourth contract year and the first October 1 at age 38.
67. Signing-bonus allocation on the protected-percentage basis, with unequal salaries so the correct and incorrect bases produce different dollars. **Variant (1) — discriminator (three Salary Cap Years, 2026–27 / 2027–28 / 2028–29):** annual Base Compensation 10 / 20 / 30 ($M), protected for lack of skill 100% / 50% / 0%, signing bonus 6. Correct §3(b)(2) allocation is in proportion to the **protected percentages** (100 : 50 : 0 → 2⁄3, 1⁄3, 0): **4 / 2 / 0**. The incorrect protected-**dollar** basis (10 : 10 : 0 → 1⁄2, 1⁄2, 0) would produce **3 / 3 / 0**; an implementation allocating 3 / 3 / 0 must be detected as wrong. **Variant (2) — ETO (five Salary Cap Years, 2026–27 through 2030–31):** Base Compensation 20 per year, protection 100% / 100% / 50% / 50% / 100%, ETO effective season 2030–31 (the earliest legal effective season, eliminating the fifth), bonus 6. Allocation runs only over the Salary Cap Years preceding the ETO's effective season (100 : 100 : 50 : 50 → 1⁄3, 1⁄3, 1⁄6, 1⁄6): **2 / 2 / 1 / 1 / 0** — the fifth season's protection is ignored. **Variant (3) — zero protection (2026–27 start):** no Base Compensation protected for lack of skill in any covered year → the entire bonus of 6 is allocated to the first Salary Cap Year, 2026–27. **Expected:** each variant's per-year dollars equal the stated amounts exactly. Exercises (provisional pending R7): all three §3(b)(2) branches for an ordinary signing bonus (CBA-C18). Does not exercise: the trade-earned §3(b)(1)(ii) then-current/remaining allocation or the §3(b)(3) extension-bonus rules — R7 coverage. **Authority:** CBA VII §3(b)(2), pp. 200–201.
68. Bonus and incentive limits on the Regular Salary basis. **Input:** contracts testing each ceiling independently — a signing bonus above 15% of Compensation excluding Incentive Compensation (10% in an offer sheet); Incentive Compensation for a season above 20% of the contract's **Regular Salary**; Unlikely Bonuses above 15% of the player's **Regular Salary** at signing; deferred compensation above 25% of the season's compensation; EIPPA used twice inside three Salary Cap Years; plus a contract whose incentives pass a Base Compensation test but fail the Regular Salary test. **Boundary:** both incentive caps use the defined Regular Salary denominator, and the 15% unlikely cap is tested at signing with the extension/renegotiation provisos. **Expected:** each case fails independently, and the Base-Compensation-passing/Regular-Salary-failing contract is rejected. **Authority:** CBA II §12(a)(i)–(iii), p. 58; VII §5(b)(1), p. 229.
69. Options and ETOs at the correct boundaries (Salary Cap Year 2026–27 unless stated). **Input:** (a) a standard option exercised at 5:00 p.m. ET on June 29, 2027; (b) an option in favor of a player who would become an RFA if it were not exercised, exercised on June 25, 2027; (c) a five-season contract (2026–27 through 2030–31) with an ETO taking effect at the end of the fourth season — effective season 2030–31, eliminating the fifth; (d) a contract with an ETO purporting to take effect **before** the end of the fourth season; (e) a player who exercises his ETO by the June 29, 2030 deadline (shortening the contract's term), whose team then attempts to extend that contract in July 2030. **Boundary:** an ETO may take effect no earlier than the end of the fourth season of the contract — the earliest season it can eliminate is the fifth; an RFA-triggering option must be exercised **prior to** June 25, so June 25 itself is late; and a team and player may not extend any contract whose term has been shortened by the player's exercise of an ETO. **Expected:** (a) legal; (b) fails; (c) passes (a legal ETO that leaves the first four seasons intact); (d) fails; (e) the post-ETO extension attempt fails under VII §7(a)(2)(ii). Exercises (provisional pending R7): the ETO effectiveness floor and exercise deadline, the RFA-option deadline, and the post-ETO extension bar. Does not exercise: the XII §1(v) SRPE Team Option unchanged-terms carve-out (CBA-C24.2's exception clause) or Team/Player Option pre-exercise protection behavior (CBA-C24.7); those register mappings remain provisional for the R7 scenario-library rebuild. **Authority:** CBA XII §2(b), p. 337; XII §4, p. 338; VII §7(a)(2)(ii), p. 250.
70. Contract-shape limits: raises measured from Year 1 rather than compounded; a bonus on a minimum contract; and a future percentage maximum adjusted on July 1 with excess reduced in the required order of signing bonus, incentive compensation, then base compensation.
71. Ten-Day and Rest-of-Season: a Ten-Day signed before January 5; a third Ten-Day with the same team; concurrent Ten-Day capacity at 12, 13, 14, and 15 Standard players; and a Rest-of-Season contract prorated by remaining regular-season days.
72. Two-Way: a player with more than four YOS; a fourth Salary Cap Year under a Two-Way with the same team; a Two-Way carrying an option; conversion after the final regular-season game; a signing after March 4; and $0 trade salary creating no TPE.
73. Exhibit 10 and Exhibit 9: a seventh Exhibit 10; conversion rescinding the bonus and triggering the conversion protection amount; an Exhibit 9 with fewer than 14 other non-Exhibit-9 players; and the $15,000 injury termination fee on a qualifying Exhibit 9.
74. Team Salary inclusion: a retired player still under contract, a pending contract required to be reported, and the reported portion of grievance exposure with later reconciliation.
75. Minimum Exception eligibility and league subsidy eligibility evaluated as separate tests for the same player.
76. DPE versus long-term injury exclusion: the exclusion's prerequisites (termination through waivers, the waiting period, the physician or Fitness-to-Play finding); the eligible-team test; the permanent bar on re-signing or reacquiring an excluded player; a DPE request precluding an exclusion request in the same Salary Cap Year; and a 25-game return restoring the salary.
77. Waiver lifecycle: the 48-hour claim window with an irrevocable request, the roster spot freed at request time, claim priority by record with tie breakers, a claimant lacking an open slot or exception authority, and a player waived after March 1 barred from another team's postseason roster.
78. Dead salary for a waived player whose contract carries an ETO year, an unexercised Team Option, and a Player Option — each treated differently.
79. Active list at 12–15 with the temporary 11-player window, and the eight-player bench minimum, evaluated separately from the 14–15 Standard requirement.
80. Stretch consequences: the team cannot re-sign or reacquire the player before the July 1 following the terminated contract's last season, and payment timing is elected separately from Team Salary allocation.
81. Buyout and set-off: the reduction allocated across the dead-salary schedule, a buyout that waives set-off rights, and the re-signing restriction after a trade-and-waive and after a buyout.
82. Roster capacity from suspension and hardship: a league suspension opening a spot after the fifth game, a team suspension after the third, and a hardship exception requiring an explicit approval record rather than an inference from roster conditions.
83. The same hypothetical evaluated on two explicit `asOfDate` values yields two different legal results, and no rule reads an ambient "today".
84. Qualifying offer and offer-sheet shape: standard QO terms, Maximum QO terms, Two-Way QO rules, unilateral withdrawal through July 13 versus consent plus deemed renunciation on July 14, the offer-sheet term requirement and March 1 deadline, and matching used as a sign-and-trade — must fail.
85. Renegotiation: a contract under four seasons or inside the third anniversary; an attempt between March 1 and June 30; an attempt to lower existing salary; and a renegotiate-and-extend using the 40% drop into the extended term.
86. Express no-trade clause requiring at least eight YOS and four YOS with the signing team, and the 30-day trade restriction after a Two-Way signing.
87. Draft-and-stash lifecycle: non-NBA contract dates, availability notice, a new Required Tender event, and the subsequent-draft rule.
88. External determination: a physical, a DPE medical finding, a bonus-likelihood override, a grievance award, and a hardship approval — each surfaces "assumption required" with provenance and never an unqualified PASS or FAIL.
89. Room path: a team below the cap acquires salary up to room plus $250,000, and the room path cannot be combined simultaneously with another TPE path in the same trade.

## 17. Recommended comparison sequence

When this benchmark is applied to Architect, use three bounded passes.

For every active v2 LEAF, the audit output should use the same compact record (verdicts are keyed only to active `CBA2-…` LEAFs per §1.2 and §15.9.1 — never to historical `CBA-…` IDs, GROUPs, scenarios, crosswalk edges, source/provenance records, evidence components, or decision records):

| Field | Allowed/required result |
|---|---|
| Coverage | Covered and proven / Partial / Missing in scope / Intentional exclusion / Data-blocked / Externally adjudicated |
| Product layer | Representation / Calculation / Enforcement / Explanation / Lifecycle |
| Severity | Critical false legality / High monetary or roster error / Medium planning gap / Low authoring or explanatory depth |
| Evidence | Repository path, calculation trace, UI behavior, and test result—not a conclusory “supported” |
| Authority | Canon section plus CBA/BYL/NBA/DERIVED/INFERRED/OPS/EXT citation |
| Remediation | Smallest concrete model, logic, data, UI, or test change needed |

### Pass 1 — Deterministic correctness

Audit the independent ledgers, current TPE formula, ITS/OTS adjustments, apron transaction table, hard caps, roster-slot trade check, and pick/Stepien branching. These can make an apparently legal trade illegal or vice versa. The multi-team touch/qualifying-asset mechanics remain unsupported operational candidates (§12.2, §15.9.6): they enter this pass only if first registered through the normal evidence process with qualifying provenance, and are never audited as configured rules while unsupported.

### Pass 2 — Cap Manager completeness

Audit cap holds, minimum subsidy, Apron Salary, Tax Salary/repeater history, dead salary, exception inventory, DPE, Bird/RFA state, roster clocks, and lifecycle persistence.

### Pass 3 — Full GM depth

Audit extension/renegotiation authoring, Over-38, bonus allocation, Exhibit contracts, draft-and-stash rights, detailed waiver/buyout/set-off flows, and calendar-driven future planning.

Each finding should remain attached to the product layer it affects:

- **Calculation defect** — existing supported action gives the wrong answer.
- **Validation defect** — existing supported action is not properly allowed/blocked.
- **Explanation defect** — answer may be correct but the user cannot understand why.
- **Lifecycle/persistence gap** — one action works but its future consequences are lost.
- **Data gap** — rule cannot be evaluated from stored inputs.
- **Authoring/workflow gap** — rule is not yet a user-operable GM action.
- **Intentional exclusion** — explicitly outside the current Architect contract.

### Canon release gate

Before an updated canon or season parameter set is allowed to govern Architect, complete all of the following:

1. **Primary-source check:** confirm the current signed CBA, Constitution/By-Laws, official annual release, and any announced amendments or memoranda.
2. **Diff check:** record every changed rule, amount, date, or interpretation and the source that changed it.
3. **Arithmetic check:** independently recompute all scaled values, crossovers, tax brackets, percentages, and rounding boundaries from source inputs.
4. **Cross-ledger check:** trace every changed rule through Team, Apron, Tax, ITS, OTS, compensation, exception, roster, and pick ledgers.
5. **Lifecycle check:** test creation, partial use, expiration, rollover, renunciation, reversal, and historical-state consequences.
6. **Boundary tests:** test one unit below, exactly at, and one unit above each monetary, count, day, and percentage boundary.
7. **Contradiction scan:** compare CBA 101, CBAguide, prior canon, and code. Resolve conflicts by the authority order in §1.1.
8. **Unknowns check:** ensure every OPS and EXT rule remains visibly labeled and configurable; never “promote” it to CBA-verified through repetition.
9. **Link/citation check:** verify every primary URL and article/section key and retain printed page references for human review.
10. **Regression run:** execute the acceptance library plus any bug-specific cases before changing the canon version used in production.

For canon v2.0 and later, the register itself must additionally pass the
release gates in §15.9.9 on their retimed schedule — unit-local gates in
each R3–R6 receipt, scenario gates at R7, global reconciliation gates at
R8, and the independent acceptance gate at R9 — before any register edition
may govern Phase 2 execution.

## 18. Relevant rules that should not become automatic verdicts

Some Guide categories matter to front-office work but should be modeled as explicit facts, approvals, or warnings rather than guessed by a deterministic validator.

- **Physical examinations:** ordinary trades, sign-and-trades, extend-and-trades, offers, and tenders can be contingent on a physical. Architect can represent `pending`, `passed`, `failed`, `waived`, or `terms adjusted`; it cannot determine medical fitness.
- **DPE and career-ending injury findings:** physician/league decisions are inputs. Architect can verify the consequences after a ruling and can warn when the wrong standard is selected.
- **Bonus-likelihood appeals:** normal preceding-season classification is calculable, but an expert can override it. Preserve an override, source, and effective date.
- **Circumvention:** unauthorized side agreements, sham retirement transactions, undisclosed compensation, and related-party benefits require factual/legal judgments. Architect should warn about suspicious structures and avoid presenting them as approved, but should not issue a definitive legal finding.
- **Anti-collusion and tampering:** negotiation dates can be checked, but communications and intent normally sit outside the product's data.
- **Grievances and settlements:** known disputed amounts and awards can be entered and allocated; Architect cannot predict the award.
- **League approvals and hardship exceptions:** use an explicit approval record. Do not infer approval merely because roster conditions look similar.
- **Expansion rules and BRI cap-setting:** relevant to a future expansion or league-finance simulator, but ordinary Architect planning can consume published team count and system levels rather than reproduce league audit/BRI calculations.

This category should appear in the UI as “requires external determination” or “assumption required,” not PASS or FAIL without qualification.

## 19. Authority map and source index

### 19.1 Rule-family authority map

| Canon area | Controlling public authority | Principal location |
|---|---|---|
| Contract amendments, protection, Ten-Day, Rest-of-Season, Two-Way, bonuses, moratorium | CBA | Article II §§3–15, pp. 15–66 |
| Salary, Over-38, signing/trade bonuses, incentives, minimum subsidy, insurance | CBA | Article VII §3, pp. 198–211 |
| Team Salary, FA/pick/incomplete-roster/exception holds, renunciation, summer treatment | CBA | Article VII §4, pp. 211–26 |
| Contract structure and raise/bonus limits | CBA | Article VII §5, pp. 226–31 |
| Bird, DPE, BAE/MLEs, rookie/minimum, TPEs, non-aggregation | CBA | Article VII §6, pp. 231–49 |
| Extensions, renegotiations, stretch, buyout allocations | CBA | Article VII §7, pp. 249–60 |
| Cash-in-trade and CBA trade provisions | CBA | Article VII §8, p. 260 onward |
| Cap, minimum salary line, tax/repeater, aprons, hard caps, frozen picks | CBA | Article VII §2, pp. 169–97 |
| Rookie Scale and contract length | CBA | Articles VIII–IX, pp. 290–96 |
| Draft eligibility, tenders, draft rights | CBA | Article X, pp. 296–309 |
| UFA/RFA, QOs, offer sheets, matching, Arenas | CBA | Article XI, pp. 310–35 |
| Options and ETOs | CBA | Article XII, pp. 336–38 |
| Circumvention | CBA | Article XIII, pp. 339–46 |
| Express and automatic trade consent | CBA | Article XXIV, pp. 414–17 |
| Deferred compensation and set-off | CBA | Articles XXV and XXVII, pp. 418–24 |
| Active/inactive lists, Two-Ways, Under-Fifteen, roster minimums | CBA + BYL | CBA Article XXIX, pp. 429–38; BYL §§6.01–6.12, pp. 68–75 |
| Trade dates, Trade Call, disclosure, roster room, reacquisition | BYL | §§4.01–4.05, pp. 62–66 |
| Waiver procedure, 48 hours, priority, claim trade restriction | BYL | §§5.01–5.07, pp. 66–68 |
| Stepien consecutive-first-round rule | BYL | §7.03, p. 78 |
| Detailed touch/assets and seven-draft horizon | Unsupported operational candidate — no qualifying authority located | Discovery candidates only (§12.2, §13.3, §15.9.6): secondary reporting establishes nothing; not registrable, not OPS, not enforceable, and never an automatic or configurable verdict unless qualifying first-party operational provenance or a different valid authority classification is established through the normal evidence process |
| Annual system and MLE levels | NBA | NBA Communications release for the applicable Salary Cap Year |
| Medical, hardship, bonus appeal, grievance, circumvention findings | EXT | Express ruling/approval must be supplied as data |

### 19.2 Primary and official explanatory sources

- [2023 NBA–NBPA Collective Bargaining Agreement](https://ak-static.cms.nba.com/wp-content/uploads/sites/4/2023/06/2023-NBA-Collective-Bargaining-Agreement.pdf) — signed controlling agreement.
- [June 2024 NBA Constitution and By-Laws](https://official.nba.com/wp-content/uploads/sites/4/2024/06/NBA-Consitution-By-Laws-June-2024.pdf) — current public league-governance text located for this edition.
- [NBA 2024–25 CBA 101](https://official.nba.com/wp-content/uploads/sites/4/2024/11/2024-25-CBA-101.pdf) — official NBA-prepared explanation; useful for summaries and examples, subordinate to signed text.
- [2026–27 official system levels](https://pr.nba.com/2026-27-salary-cap/), [2025–26](https://pr.nba.com/nba-salary-cap-2025-26-season/), [2024–25](https://pr.nba.com/2024-25-nba-season-salary-cap/), and [2023–24](https://pr.nba.com/nba-salary-cap-for-2023-24-season-set-at-136-021-million/).

### 19.3 Verification status by rule family

| Status | Rule families |
|---|---|
| **Primary-source verified** | Expanded/Standard/Aggregated TPE formulas; ITS/OTS adjustments; aprons/hard caps; tax/repeater; Team Salary/cap holds; exceptions; DPE; roster/list rules; UFA/RFA/options; extensions/renegotiations; waiver procedure; stretch/set-off; Stepien; trade windows/roster room |
| **Official-value verified + derived arithmetic** | 2024–25 through 2026–27 system levels, MLEs, Expanded TPE scaled amount/crossovers, and tax-bracket width |
| **OPS—configurable, not claimed as CBA text** | Multi-team touch rule and detailed qualifying-asset thresholds; seven-future-draft horizon; certain pick-protection/deferral processing mechanics |
| **EXT—explicit determination required** | DPE/career-ending medical findings, bonus-likelihood appeals, hardship approval, grievances, circumvention/anti-collusion/tampering findings |

This classification is part of the canon. A later source may move an OPS item into a primary-source category; that change requires a cited canon revision.

**v2.0 status continuity (binding, R2.2).** The family-level rows above — including every "Primary-source verified" claim — are **legacy v1.0/v1.1 status claims preserved for continuity**. They are **not** active v2 per-LEAF certification: the independent v1.1 acceptance review falsified parts of the "primary-source verified" claim, and full per-LEAF certification has not yet occurred. R3–R6 replace these family-level claims family by family with `SRC2-…`/`EV2-…`-backed per-LEAF certification, updating this table's rows for their families as they complete; R8 reconciles the final status table against the completed active registry. **No family may be described as fully v2-certified until every active LEAF in that family passes U8, U9, and U14.** In particular (R2.4), the legacy "OPS—configurable" family row above establishes nothing: under §15.9.5–§15.9.6 the multi-team touch rule and detailed qualifying-asset thresholds, the seven-future-draft horizon, and the secondary-reported pick-protection/deferral processing mechanics are **unsupported operational candidates** (§12.2, §13.3) — not OPS, not registrable, and not enforceable without qualifying first-party operational provenance or a different valid authority classification.

### 19.4 CBA Guide sections reviewed for discovery

- [Master Guide](https://cbaguide.com/)
- [Contract Types](https://cbaguide.com/contractanatomy/contracttypes/)
- [Compensation Protection](https://cbaguide.com/contractanatomy/terms/compensationprotection/)
- [Contract Limitations](https://cbaguide.com/contractanatomy/terms/contractlimitations/)
- [Options and ETOs](https://cbaguide.com/contractanatomy/terms/options/)
- [UFA](https://cbaguide.com/transactions/signings/ufa/)
- [RFA](https://cbaguide.com/transactions/signings/rfa/)
- [Draft Pick Signings](https://cbaguide.com/transactions/signings/draftpicks/)
- [Extensions](https://cbaguide.com/transactions/extensions/)
- [Renegotiations](https://cbaguide.com/transactions/renegotiations/)
- [Waivers](https://cbaguide.com/transactions/waivers/)
- [General Trade Rules](https://cbaguide.com/transactions/trades/traderules/)
- [Traded Player Exceptions](https://cbaguide.com/transactions/trades/tpe/)
- [Trade Salary](https://cbaguide.com/transactions/trades/tradesalary/)
- [Trade Bonus](https://cbaguide.com/transactions/trades/tradebonus/)
- [Sign-and-Trade / Extend-and-Trade](https://cbaguide.com/transactions/trades/signandtrade/)
- [Team Salary](https://cbaguide.com/thresholds/teamsalary/)
- [Salary Cap and Exceptions](https://cbaguide.com/thresholds/salarycap/)
- [Aprons](https://cbaguide.com/thresholds/apron/)
- [Luxury Tax](https://cbaguide.com/thresholds/luxurytax/)
- [Minimum Team Salary](https://cbaguide.com/thresholds/minimumsalary/)
- [Draft Rules](https://cbaguide.com/eligibility/draftrules/)
- [International Buyouts](https://cbaguide.com/eligibility/international/)
- [Team Rosters](https://cbaguide.com/eligibility/rosters/)
- [League Calendar](https://cbaguide.com/calendar/)

---

## Bottom line

The Architect should behave as a dated transaction simulator over independent ledgers, not as a single trade equation. The highest-risk holes are rules that silently change the numerical basis of a transaction: TPE formulas, ITS/OTS differences, apron add-backs, guarantee timing, bonus reclassification, minimum subsidy, cap holds, and historical penalties. This canon makes those rules traceable to public authority, keeps operational rules visibly separate, and supplies the audit IDs and regression cases needed to prove coverage rather than assume it.
