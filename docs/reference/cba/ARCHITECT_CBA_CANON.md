# The Architect — CBA & Transaction Rules Canon

**Edition:** Canon v2.0 — **WORKING DRAFT** (R1–R9 repair in progress; not accepted, not an active audit oracle)  
**Purpose:** The all-in-one Cap Manager + Trade Machine reference, implementation checklist, and acceptance-test canon for ScoutZero's Architect  
**Authority cutoff:** July 12, 2026  
**Current Salary Cap Year:** 2026–27  
**Discovery source:** [The CBA Guide](https://cbaguide.com/) — useful for finding issues, but never controlling  
**Primary authorities:** [2023 NBA–NBPA Collective Bargaining Agreement](https://ak-static.cms.nba.com/wp-content/uploads/sites/4/2023/06/2023-NBA-Collective-Bargaining-Agreement.pdf) and [June 2024 NBA Constitution and By-Laws](https://official.nba.com/wp-content/uploads/sites/4/2024/06/NBA-Consitution-By-Laws-June-2024.pdf)  
**Official explanatory source:** [NBA 2024–25 CBA 101](https://official.nba.com/wp-content/uploads/sites/4/2024/11/2024-25-CBA-101.pdf)  
**Annual-value sources:** NBA Communications releases for [2026–27](https://pr.nba.com/2026-27-salary-cap/), [2025–26](https://pr.nba.com/nba-salary-cap-2025-26-season/), [2024–25](https://pr.nba.com/2024-25-nba-season-salary-cap/), and [2023–24](https://pr.nba.com/nba-salary-cap-for-2023-24-season-set-at-136-021-million/)  
**Amendment date:** July 24, 2026\
**Provenance — v1.0 (historical):** SHA-256 `b8cf5d01356b3a83de4663f5bd6843e9aa58c8c06a84227385ae93bc02d969ef`. Its "primary-source-verified" claim was later falsified in part by the independent v1.1 acceptance review and adjudication; the checksum is preserved as historical evidence.  
**Provenance — v1.1 (historical, rejected):** SHA-256 `4a0760c81d7a5e95919a0373d5ff631b565d064d56b858fe3b8869ad2b6bb3f6`, published at commit `9814939c` and **rejected** as an active audit oracle by an independent acceptance review, upheld on adjudication (see `docs/reference/cba/README.md`).

**What v1.1 changed (historical):** the **index only**. v1.1 added audit IDs, sub-IDs, verification-method classifications, acceptance scenarios, and cross-references; it changed no CBA rule and renumbered no existing ID or scenario. The register is a two-level tree: **GROUP** nodes are navigation anchors, and **LEAF** nodes are the 368 independently auditable obligations that form the entire audit universe (§15.6). Because the checksum of a file cannot be stated inside that file, the v1.1 checksum of record was published in `work/architect-completion/ARCHITECT_CBA_CANON_CODE_MAP.md` and `work/architect-completion/ARCHITECT_CBA_CANON_V1_1_MIGRATION.md`.

**What v2.0 changes (this working draft):** substantive rule repair against the signed CBA under the approved R1–R9 plan (`work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md`). R1 corrects the seven adjudicated substantive rule errors and two authority labels, and rewrites scenarios 50, 53, 57, 60, 67, 68, and 69; no ID or scenario is renumbered. R2 adds the binding v2.0 register and source-certification standard (§15.9) and the register release gates that R3–R8 must satisfy; it changes no rule, register row, scenario, ID, or source value. R1.1 closes the adjudicated residual R1 defects — the VII §5(b)(1) Unlikely-Bonus provisos stated in full, the signing/trade-earned/extension bonus-allocation scope per VII §3(b)(1)(ii)–(b)(3), MTS shortfall-payment terminology with the 2023–24-only §2(c)(7) exception, and explicit provisional markers on the A11/A18.7 authority labels pending R2.1 — and repairs the four scenarios with confirmed logic errors (50, 60, 67, 69). R2.1 **replaces the rejected R2 foundation in full** with the clean v2 registry model (§15.9, R2.1 edition): the published v1.1 register and scenarios 1–89 are frozen as historical migration inputs; active v2 obligations are new `CBA2-…` GROUP/LEAF IDs linked to history by a typed `XW2-…` crosswalk; evidence lives in a structured source-artifact/evidence-component registry; the authority taxonomy adds **INFERRED** and closes the A11/A18.7 provisional items; every active LEAF carries one primary and any number of secondary verification methods; the scenario library will be rebuilt as `CBA2-SC-…` with an `SXW2-…` crosswalk; and the release gates are retimed across R3–R6/R7/R8/R9. R2.2 **hardens that foundation** after the independent review of R2.1: historical scenario identity is pinned to the published v1.1 §16 section at `9814939c` (with its exact byte hash recorded, and the R1/R1.1 scenario variants reclassified as R7 authoring inputs only); crosswalk edge typing gains a deterministic precedence with exactly one primary relationship type per source–target pair; `no-successor` becomes a narrow, gateable disposition that can never hide an in-scope obligation; the evidence schema supports zero/one/many source artifacts and multi-component dependency chains with typed `SRC2-…` provenance (including OPS provenance without a public URL and EXT runtime-determination contracts); duplicate-candidate generation becomes mandatory and seven-generator systematic; new gates SC6/SC7 and G14/G15 close the scenario-coverage, method-record, evidence-reconciliation, and amendment-traceability holes; R7's method-reclassification authority is bounded and `METHOD`-recorded; the R3→R4→R5→R6 construction sequence is strict; `AMEND` decision records preserve draft-correction traceability; and the remaining old-ID audit guidance (§1.2, §17) and legacy §19.3 family-status ambiguity are removed. R1.2 closes an omission the independent Codex foundation review found in R1.1's extension-bonus correction: §5.9 now states the below-cap branch of VII §3(b)(3)(ii) in which the bonus is paid **no sooner than** the first day of the extended term's first Salary Cap Year — allocated under §3(b)(3)(i)'s extended-term-only protected-percentage rules with the zero-protection fallback to the extended term's first Salary Cap Year, never under ordinary §3(b)(2) allocation — keeping the three §3(b)(3) branches distinct. R2.3 corrects the five foundation execution contracts the same independent Codex foundation review ordered: every `EV2-…` evidence path now terminates in at least one typed `SRC2-…` source/provenance record — no source-free terminal component; OPS components reference an `ops-provenance` record and EXT components an `ext-contract` record, each valid without a public URL (and without an artifact hash only where no durable artifact exists) — with class-specific certification duties replacing the universal read-the-passage rule; secondary sources become discovery/corroboration aids only — secondary reporting establishes no authority class, and OPS requires qualifying first-party operational provenance; SC2 expands from historical-scenario coverage alone to the complete sixteen-check SXW2 integrity contract, rerun in full by G10 and R9; draft mutability and `AMEND` lineage extend to every live v2 population (active GROUP/LEAF rows, `XW2-…`, `SRC2-…`, `EV2-…`, active `CBA2-SC-…` scenarios and named cases, `SXW2-…`, `DR2-…`) with append-only precisely defined and G15/R9 expanded accordingly; and the three register populations are stated distinctly — the published v1.1 register at `9814939c` (the sole XW2 historical source), this branch's legacy-numbered working copy (an R1/R1.1-corrected, R2.1-annotated authoring input, not byte-identical to the published edition), and the active v2 registry — correcting the earlier preserved-unchanged wording. R2.4 closes the four residual foundation blockers found by the independent Codex review of R1.2/R2.3: the `SRC2-…` registry becomes a mechanically parseable base-plus-type-specific-detail record contract with pinned field grammars, per-type `—` validity, per-type timestamp/hash rules, and field-level validation enforced at U8/U9, G14, and R9; a binding transitive evidence-root compatibility model (complete dependency closure, terminal `SRC2-…` root sets, a parseable class compatibility matrix, and rejection of locally valid but transitively incompatible chains) stops OPS/EXT provenance from laundering into DERIVED/INFERRED authority and forces OPS/EXT visibility and limitation propagation to every consuming LEAF; every binding secondary-source-to-OPS promotion is removed — the §1.1 conflict order now ends at official authority, and the multi-team touch/qualifying-asset thresholds (§12.2), the seven-future-draft horizon, and the secondary-reported pick-protection/deferral processing mechanics (§13.3) are recast as **unsupported operational candidates** that cannot be registered, classified OPS, or enforced without qualifying first-party provenance or a different valid authority classification; and the AMEND child-numbering contradiction is resolved — contiguity applies at initial GROUP construction only, an `AMEND` removal/split/merge leaves a gap that must resolve through the receipts and `AMEND` chain, renumbering-to-restore-contiguity is abolished, IDs are never reused, and new children allocate above the GROUP's historical high-water mark (§15.9.2, U13, G15, R9). R2.5 closes the two SRC2 grammar blockers found by the independent Codex review of R2.4: the official-mutable "date or season" alternative is pinned to exactly one machine season grammar — `YYYY-YY` (four ASCII digits, one ASCII hyphen-minus, two ASCII digits equal to the last two digits of the following year modulo 100; en dashes, slashes, prefixes, abbreviated or four-digit second years, and non-consecutive years all invalid; source-title typography may be preserved but every structured season field normalizes to `YYYY-YY`) — and the unparseable composite `Verifier/session/date` base field is split into three separately required, individually typed columns (`Verifier identity` as `human:<slug>`/`agent:<slug>`, `Verification session ID` as `session:<slug>`, `Verification date` as a real `YYYY-MM-DD` calendar date), growing the base table from eleven to thirteen pinned fields, each independently parsed and validated at U8/U9, G14, and R9 — none ever `—`, and no nonempty field compensating for a missing or malformed one. R3 — executed after the independent Codex foundation review of the corrected foundation (R1.2/R2.3/R2.4/R2.5) at commit `6d9c7576` returned **ACCEPT** for R3 construction — begins register construction: it creates §15.10 (active v2 register), §15.11 (historical crosswalk), and §15.12 (source/provenance and evidence registries) and re-registers the A family from first principles as 12 `CBA2-A…` GROUPs and 81 atomic LEAFs, each source-certified against the signed CBA, the June 2024 By-Laws, and official NBA releases through 4 typed `SRC2-…` records and 89 `EV2-…` components (no OPS or EXT component and no composite label; A11's successor carries an express CBA component plus a separate INFERRED decomposition component; A18.7's express cap-year charging rule is CBA while its re-trade attribution mechanics remain an unregistered unsupported operational candidate); records 131 typed `XW2-…` edges covering 88 of the 89 published historical A LEAFs plus one named whole-row deferral (`CBA-A01.4` → R4) and three named fragment deferrals; dispositions the historical A15/A17 OPS-labeled rows by terminal `invalid` edges (false authority claims — the reported mechanics remain preserved discovery candidates in §12.2/§13.3); corrects two A-series source-law statements in §12.7 (the trade-bonus basis is Base Compensation remaining to be earned, per CBA XXIV §2(a)(ii)–(iii); the only expressed maximum-salary reduction of a trade bonus is the Rookie Scale VIII §1(d) deemed amendment); and updates §19.3's A-family row to per-LEAF source-certified status (U8/U9/U14 passed; scenarios pending R7). No C/R/L/S active record was created; R3 is not independently accepted. The independent Codex review of the R3 checkpoint at commit `07f0667d` returned **REJECT/BLOCK-R4**: no R3 active record is accepted, the A series is **not certified**, and the R3 receipt is preserved as immutable review history. R2.6 — the ordered post-R3 foundation-closure unit — closes the three foundation-level contradictions that review exposed, **changing the governing standard only and repairing no committed R3 record**: (1) a terminal `unsupported-residual` crosswalk disposition (with a narrow nine-condition rule) for an exactly scoped, in-scope residual fragment of a compound historical obligation whose qualifying authority is not located in the searched sources — typed, preserved as a discovery candidate, individually reviewed at R8/R9, and reopenable through `AMEND` on later authority — needed because honest A18.7 treatment was otherwise impossible (the residual is in scope, so `no-successor` is barred; unregistrable without authority; prose on a `partial-overlap` edge dispositions nothing); (2) a `DISP` terminal decision-record type with a binding OWN/DISP boundary — `OWN` adjudicates competing active owners and never records a terminal no-owner disposition; every terminal edge resolves to a `DISP` record; R3's terminal dispositions carried on `OWN`/`ATOM` records are corrected by R3.1 through `AMEND` lineage, never by editing the immutable receipt; and (3) a narrow `YYYY-MM` month-precision rule for `official-immutable` publication/effective dates where the source itself states only a month (the June 2024 By-Laws cover states "JUNE 2024"; its embedded 2024-06-07 stamp is PDF creation/modification metadata and establishes no publication or effective date) — exact days stay `YYYY-MM-DD`, metadata-derived days are prohibited and fail the record, and a mandatory limitation entry records the supplied precision. The bounded R2.6 primary/first-party searches located no qualifying authority for the re-trade attribution residual and no exact-day authority for the By-Laws date in the searched sources. R2.6 kept the active §15.10–§15.12 record population byte-identical to `07f0667d`, left §12.7 unrepaired (R3.1), and started neither R3.1 nor R4. The independent Codex review of the R2.6 checkpoint at commit `51e60bf6` returned **REJECT/BLOCK-R3.1**: source-date semantics remained false, and the fragment-completeness and DISP-reconciliation gates were not mechanically closed. R2.7 — the ordered foundation-executability closure — corrects exactly that: the slash-combined publication/effective-date field is abolished in favor of a `basis:value` **source-date model** (closed basis vocabulary `publication`/`effective`/`edition`/`agreement-as-of`; an edition month such as the June 2024 By-Laws cover is recordable only as `edition:2024-06`, never as publication or effective; metadata can establish no basis's value; a fixed date-component detail table carries multiple distinct semantic dates — the signed CBA's `agreement-as-of:2023-06-28`, `effective:2023-07-01`, and `edition:2023-07` verified against the hash-matched artifact this unit — without conflation); every historical LEAF used in the crosswalk gains a declared, parseable **fragment inventory** (pinned fragment-ID grammar, closed fragment kinds separating substantive obligations from authority assertions and process instructions, exhaustive non-overlapping decomposition, exactly-once disposition, bidirectional edge ⇔ fragment reconciliation, and a fragment-scoped terminal-uniqueness key); a **`blocked-unsupported-obligation`** stop condition makes a wholly unsupported valid in-scope obligation a blocking foundation/adjudication decision rather than any terminal edge; bounded searches become parseable **`SM2-…` search-manifest records** with a closed result vocabulary that can never encode "none exists"; `DISP` gains a fixed, parseable detail schema with an edge-type ⇔ decision-type compatibility matrix and a direct-current-reference rule (no live edge may rely on a decision reachable only through an `AMEND` chain); SC2 check 11 is strengthened inside the unchanged sixteen-check block; a scoped **`G15R`** repair gate runs AMEND/current-reference integrity at the R3.1 checkpoint; the A18.7 conditional-cash application is corrected from express CBA to a separately identified INFERRED chain on every non-active surface (active rows are an R3.1 `AMEND` repair); and every status and sequencing surface now states the truthful sequence R3 rejected → R2.6 rejected → R2.7 → independent Codex R2.7 review → R3.1 → independent Codex R3.1 review → R4. The R2.7 first-party searches re-verified the signed CBA binary (exact hash match) and located **no later governing agreement text in the searched first-party sources**. The independent Codex review of the R2.7 checkpoint at commit `3e9f913f` returned **REJECT/BLOCK-R3.1**: the shared `DISP`/SC2 subject model could not represent an SXW2 scenario subject, the source-date/fragment/`SM2` contracts remained mechanically ambiguous or composite, and the unsupported-obligation resolution was overrideable. R2.8 — the ordered foundation-executability repair — closes exactly that, **changing the governing standard and non-active status surfaces only and repairing no committed R3 record**: the `DISP` detail schema becomes a **polymorphic subject-class-tagged** schema (`XW2-DISP`/`SXW2-DISP`) with a pinned canonical scenario-fragment grammar `scenario-<n>:F<m>` (§15.9.4/§15.9.8), so an SXW2 scenario disposition is representable; the source-date **date-component detail table** gains a stable `<Record ID>#D<k>` identity and a `role/scope` discriminator so multiple same-basis dates are representable (§15.9.6); the fragment schema splits `Current status/version` into separate fields, pins a normalized-scope algorithm, and adds a fixed **`BND-…` disposition-bundle** schema (§15.9.3); the `SM2-…` schema splits its composite `Size/hash/pagination/signature` and `Current status/version` fields and adds an **`SS2-…` search-set/coverage** record (§15.9.6); the untyped blocked-obligation escape becomes governed **`BLK-…`/`RES-…`** blocked-finding/resolution records under an **independent-acceptance gate** where a maker can never self-accept (§15.9.3); and a committed **actual-schema validator** that reads the real repository documents supersedes R2.7's synthetic checker. R2.9 — the ordered foundation-validation closure — closes the blockers the independent Codex review of the R2.8 checkpoint found (the committed validator accepted binding-invalid document mutations while reporting 52/52 PASS, and the schemas retained composite fields, a dual-domain scope model, a `BND-…` cardinality contradiction, maker-selected coverage, and self-acceptance paths): it splits the remaining composite base/detail fields, requires ordered effective windows and one all-explicit date-component completeness rule, replaces the dual `clause:`/`sent:` scope model with one deterministic `span:<a>-<b>` **text-span system**, resolves the `BND-…` cardinality contradiction to a **multi-target-only** rule with a member-compatibility matrix, ties scenario fragments to an **exact partition** of the governed scenario text, gives `DISP` an explicit `Normalized scope` field with an exact terminal-base-equality rule, fully types `SM2-…` with an SM2 ⇔ current-`SRC2` reconciliation and makes the `SS2-…` required classes the deterministic set `CBA, BYL, NBA, ops-provenance`, adds a **canonical-actor registry** and binds `RES-…` acceptance to the exact current resolution, types `BLK-…` with a `candidate-obligation` subject class and an XW2-only search-machinery policy, conforms every dependent gate, and replaces the rejected validator with **one real parser-and-reconciliation engine** over the actual canon and repair plan in which every Codex-demonstrated false positive is a rejecting regression; the repair plan's "items 1–21; nothing else" header, stale `accepted R2.7`/omitted-R2.8 R4 dependency, and item-25 coverage rule are corrected. The independent Codex review of the R2.9 checkpoint at commit `5f868f2a` returned **REJECT/BLOCK-R3.1**: the validator still never parsed the actual 47-row `DR2-…` population, validated a future R3.1 document only through a simulation-only fixture path rather than the committed-canon path, executed only four of `G15R`'s declared populations, accepted a fake acceptance commit and a nonexistent receipt as independent acceptance, and replaced the canon's governing vocabularies and actor aliases with hidden Python rules, while binding contradictions remained in `DISP` terminal-base equality, `BND-…` member coverage, source-date component lifecycle, the impossible SM2 ⇔ `SRC2` byte-size equality, and candidate-obligation evidence. R2.10 — the ordered foundation-validation repair — closes exactly those, **changing the governing standard, the repair plan, and the validator only, and repairing no committed R3 record**: §15.9.11 adds the binding **governed inventory** (machine-readable closed-vocabulary, pinned-schema, cross-schema-dependency, immutable-range, and pinned-population registries that every conforming validator must parse as the sole source of truth and reconcile bidirectionally with the governing clause, with hard-coded parallel contracts prohibited) together with the explicit **preservation-versus-conformance** distinction (identity preservation is checked against the pinned R3 checkpoint commit, never against a total; schema conformance carries no fixed totals, so valid append-only additions conform); a governed **acceptance-receipt record** makes `RES-…` independent acceptance a resolvable commit plus a parsed `ACCEPT` row rather than a maker-written cell; the `SRC2-…` base schema gains the **`Artifact byte size`** field without which the SM2 ⇔ current-`SRC2` byte-size equality had no governed counterpart; the date-component detail table gains **`Component status`/`Component version`/superseding** fields so exactly-one-current and stale-reference rules are representable; `BND-…` gains **`Member subject scopes`** so combined exhaustive member coverage is mechanically provable; the `DISP` **terminal-base-equality** rule is corrected to include the subject fragment and the disposition's destination fields (so differing fragments or destinations are never equal bases) and its **edge ⇔ detail agreement tuple** is corrected to cite only fields both structures actually carry; the `SM2-…`/`SS2-…` schemas gain the **`candidate-obligation`** subject variant that makes candidate-obligation evidence representable at all; and `G15R` becomes an **enumerated twelve-population gate** including the complete `DR2-…` population and every dependent reference and current endpoint. Every status/sequencing surface now states the truthful sequence R3 rejected → R2.6 rejected → R2.7 rejected → R2.8 rejected → R2.9 rejected → R2.10 → independent Codex R2.10 review → R3.1 → independent Codex R3.1 review → R4. **R2.10 is not independently accepted; completing R2.10 does not accept anything — R3 remains rejected, no A-series record is accepted, R3.1 remains blocked pending independent Codex acceptance of the R2.10 foundation, and R4 remains blocked until a later independent Codex R3.1 acceptance. Phase 1 remains open; Phase 2 and W1.1 remain blocked.** The authority cutoff remains **July 12, 2026**. **This draft is not accepted and must not govern Phase 2 verdicts, implementation decisions, or tests**; the v2.0 checksum will be recorded only at R8, and activation requires a new independent Reviews A–F acceptance gate (R9).

**Current R3.1 maker status (supersedes the R2.13 sequencing sentence above):**
R2.13 was executed at
`818a5d03accbebfec810521a49ef9554ca4f79fa`, but its independent review
returned **REJECT/BLOCK-R3.1** for two bounded defects: inconsistent
governed-ID normalization allowed valid multi-backtick Markdown IDs to evade
the whole-canon Inventory F location audit, and five live repair-plan mirrors
still called R2.12 ACCEPT the current route. R2.13 and its receipt are
immutable rejected historical evidence and unblock nothing. R2.14 closed
exactly those ID-normalization and truthful-status defects and is accepted as
settled by the current goal objective authority; its maker receipt remains
immutable historical evidence. The one-time pre-R3.1 compatibility checkpoint
corrects only blocking AMEND/fragment representability and validator defects
and was independently **ACCEPTED** at corrective checkpoint
`c3a00637249444190a02a844fe104137ac78da5e`. The owner-authorized same-family
deferral compatibility checkpoint was independently **ACCEPTED** at exact
corrective checkpoint `d6101f82b40f5c1e8c45c8be090e9b4743daefe5` by
`/root/validation_scout`. R3 remains rejected and no A-series record is
accepted. The R3.1 maker checkpoint has executed after both independently
accepted compatibility checkpoints and is pending an independent R3.1 checker
ACCEPT. R4 remains blocked until that ACCEPT.
Phase 1 remains open; Phase 2 and W1.1 remain blocked.

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
| **Repair v2.0 — working draft, R3** | **July 16, 2026** | **R3 A-series construction and source certification** (first construction unit, executed after the independent Codex foundation review of R1.2/R2.3/R2.4/R2.5 at commit `6d9c7576` returned **ACCEPT** for R3 construction): canon §15.10–§15.12 created; the A family built new as 12 `CBA2-A…` GROUPs and 81 atomic LEAFs with per-LEAF class-specific source certification (4 typed `SRC2-…` records — the signed CBA, the June 2024 By-Laws, and the official 2023-24 and 2026-27 NBA cap releases — and 89 `EV2-…` authority components; authority classes CBA/BYL/NBA/DERIVED/INFERRED only; zero OPS/EXT components and zero composite labels); 131 typed `XW2-…` crosswalk edges covering 88 of the 89 published historical A LEAFs (17 equivalent, 25 merge, 23 split, 56 partial-overlap, 2 process-only, 8 invalid; zero no-successor), one named whole-row deferral (`CBA-A01.4` → R4) and three named fragment deferrals (`CBA-A01.3` → R6, `CBA-A08.1` → R4, `CBA-A17.1` → R6); ten newly certified LEAFs with `ORIGIN` records; the historical A15/A17 OPS-labeled rows dispositioned by terminal `invalid` edges as false authority claims, with the reported mechanics preserved as unsupported operational candidates (§12.2/§13.3), and A18.7's re-trade attribution fragment likewise preserved unregistered (§12.12); two A-series source-law corrections in §12.7 (trade-bonus basis = Base Compensation remaining to be earned, CBA XXIV §2(a)(ii)–(iii)(A), pp. 414–15; the only expressed trade-bonus maximum reduction is Rookie Scale VIII §1(d), p. 293); §19.3 A-family status updated to per-LEAF source-certified (U1–U14 passed; scenario evidence pending R7). Historical §15.1–§15.8, scenarios 1–89, §5.9, and the §15.9 foundation standard unchanged. **Not independently accepted; R4 remains blocked pending orchestration review and an independent Codex review of the R3 checkpoint.** Receipt: `work/architect-completion/ARCHITECT_CBA_CANON_V2_R3_A_SERIES_CERTIFICATION.md` |
| **Repair v2.0 — working draft, R2.6** | **July 16, 2026** | **R2.6 post-R3 foundation closure** (ordered after the independent Codex review of the R3 checkpoint at commit `07f0667d` returned **REJECT/BLOCK-R4** — no R3 active record is accepted and the A series is not certified; R2.6 changes the governing standard only and repairs no committed R3 record): the terminal `unsupported-residual` crosswalk disposition added to §15.9.3 under a narrow nine-condition rule (exactly scoped residual fragment of a compound historical obligation; valid in-scope history; a recorded bounded primary/first-party search locating no qualifying authority in the searched sources — never a claim that none exists; unsupported ≠ disproven/obsolete/out-of-scope; no authority, verdict, or enforcement while it stands; preserved discovery-candidate anchor; resolving `DISP` record; `AMEND`-based reopening on later authority; individual — never sampled — R8/G3 and R9 review), with the decision order applied per named fragment for compound history and the completeness duty restated as owner-required only where qualifying authority is located; the `DISP` terminal decision-record type added to §15.9.4 (schema: record ID, historical row(s) and exact fragment scope, related edge ID(s), terminal edge type, evidence/reasoning, why no active owner, preserved-candidate status, limitations, reopening condition, status/version) with the binding OWN/DISP boundary — `OWN` adjudicates competing active owners, never terminal no-owner dispositions; `DISP` never replaces `OWN` where candidates compete; every terminal XW2/SXW2 edge resolves to a `DISP` record; the committed R3 terminal dispositions carried on `OWN`/`ATOM` records are corrected by R3.1 through `AMEND` lineage (new high-water-mark `DR2-…` IDs; the immutable R3 receipt never edited) — and U5/U7/G3/R9 conformed; `unsupported-residual` deliberately **not** added to the SXW2 vocabulary (reasoned decision recorded — no published historical scenario's faithful disposition requires it; any R7 counter-discovery returns to a foundation amendment); and the narrow `YYYY-MM` month-precision publication/effective-date rule added to §15.9.6 for `official-immutable` sources that state only a month (four conditions: `official-immutable` base Publication/effective date field only; source supplies no exact day — precision never degraded; no day manufactured from PDF creation/modification metadata, URL paths, HTTP or retrieval/authentication timestamps, or inference; mandatory month-precision limitation entry), with `YYYY-MM-DD` unchanged where a day is supported, disjoint-by-context selection versus the `YYYY-YY` season grammar, and U8/U9/G14/R9 conformed. Bounded searches this unit: no qualifying authority for the A18.7 re-trade attribution residual and no exact-day By-Laws publication/effective date located in the searched sources (signed CBA VII §8(a); official 2024-25 CBA 101 §(3) Cash Transfers — silent on conditional/re-trade attribution; the June 2024 By-Laws artifact re-downloaded and hash-verified `be4d2781…` — cover "JUNE 2024", no exact day stated in the authority; official web surfaces). Foundation, repair-plan, and truthful-status surfaces only: the active §15.10–§15.12 population byte-identical to `07f0667d`; §5.9, historical §15.1–§15.8, scenarios 1–89, and the sixteen-check SC2 block byte-preserved; §12.7 not repaired (R3.1); no concrete record minted, renumbered, or reused; R3.1/R4–R9, Phase 2, and W1.1 not started. **R2.6 is not independently accepted; R3.1 and R4 remain blocked pending an independent Codex ACCEPT of this foundation.** Receipt: `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_6_POST_R3_FOUNDATION_CLOSURE.md` |
| **Repair v2.0 — working draft, R2.7** | **July 19, 2026** | **R2.7 foundation-executability closure** (ordered after the independent Codex review of the R2.6 checkpoint at commit `51e60bf6` returned **REJECT/BLOCK-R3.1** — source-date semantics remained false and the fragment-completeness/DISP-reconciliation gates were not mechanically closed; R2.7 changes the governing standard and non-active status/source-law surfaces only and repairs no committed R3 record): the slash-combined `Publication/effective date` base field abolished and replaced by the `basis:value` **source-date model** (§15.9.6) with the closed basis vocabulary `publication`/`effective`/`edition`/`agreement-as-of`, per-basis value grammars, `—` pairing rules, a basis-aware month-precision rule (an edition month such as `2024-06` recordable only as `edition:2024-06` — never publication or effective; metadata establishes no basis's value; exact precision never degraded), and a fixed, joinable **date-component detail table** for records with multiple distinct semantic dates (the signed CBA supports `agreement-as-of:2023-06-28`, `effective:2023-07-01`, and `edition:2023-07`, each verified against the hash-matched artifact in the R2.7 session; the committed `SRC2-001`/`SRC2-002` base rows are an R3.1 `AMEND` migration); the **historical-fragment inventory contract** (§15.9.3) with the pinned `<historical LEAF ID>:F<n>` fragment-ID grammar, closed fragment kinds (`substantive-obligation`/`authority-assertion`/`process-instruction`/`gap-assertion`), declared exhaustive pairwise non-overlapping decomposition, exactly-once disposition with split/merge bundles, bidirectional edge ⇔ fragment reconciliation, semantic exhaustiveness review, the corrected terminal-edge uniqueness key (historical source LEAF + fragment ID), and the literal nine-type XW2 vocabulary count corrected; the **`blocked-unsupported-obligation`** stop condition (§15.9.3) for a wholly unsupported valid in-scope obligation — a blocking foundation/adjudication outcome that fails U7 and stops the unit, never a terminal edge, with the express fragment-kind distinction between a false authority/enforceability claim (`invalid`) and a merely unsupported substantive mechanic (not thereby invalid); the parseable **`SM2-…` search-manifest contract** (§15.9.6) with pinned fields (exact source identity, binary/version identity, size/hash/pagination/signature, exact locator/query, method, cutoff, closed result vocabulary `qualifying-authority-located`/`no-qualifying-authority-located-in-searched-sources`/`inconclusive` that can never encode "none exists", verification metadata, status/version), required-class coverage before `unsupported-residual`, cross-class reconciliation, adequacy rules, `AMEND` supersession, and zero-orphan/current-reference rules; the fixed **`DISP` detail schema** (§15.9.4) joined to the generic `DR2` record (historical source LEAF, fragment ID, terminal edge ID and type, `SM2` references, evidence references, closed no-owner reason vocabulary, preserved-candidate anchor, limitations, reopening condition, supersession relationship, status, version), the binding **edge-type ⇔ decision-type compatibility matrix**, bidirectional subject agreement, exactly-one-current-parent and zero-orphan/zero-stale rules, and the **direct-current-reference rule** — no live edge may rely on a decision reachable only through an `AMEND` chain; SC2 check 11 strengthened inside the unchanged sixteen-check block (direct current `DISP` references, type compatibility, bidirectional agreement, zero stale/orphan records); the scoped **`G15R`** R3.1-local AMEND/current-reference repair gate (§15.9.9); the A18.7 conditional-cash application corrected on every non-active surface from express CBA to a separately identified INFERRED chain (§15.9.5, §12.12, §19.3; active-row and evidence `AMEND` is R3.1 backlog); the `DR2-0037`/`DR2-0038`/`DR2-0039` transition pinned (verified types `OWN`/`OWN`/`ATOM`; separate `DISP` records for `XW2-0006`/`XW2-0012` unless bases demonstrably identical; `ATOM` content preserved only where separately valid); and every binding status/sequencing surface corrected to the truthful sequence **R3 rejected → R2.6 rejected → R2.7 → independent Codex R2.7 review → R3.1 → independent Codex R3.1 review → R4**. First-party research this unit: the signed CBA binary re-downloaded and hash-verified (exact match `bf178ca0…`; 2,850,534 bytes; 676 PDF pages), VII §8(a), Article I §1(d), and Article XXXIX §1 read directly; **no later governing agreement text was located in the searched first-party sources** (the live official homepage links a distinct production of the same JULY 2023 agreement — `cf59d43f…`, 2,903,978 bytes, 686 PDF pages — identified in the receipt). Active §15.10–§15.12 record-table rows byte-identical; §5.9, historical §15.1–§15.8, and scenarios 1–89 byte-preserved; no concrete record minted; no ID renumbered or reused. **R2.7 is not independently accepted; R3 remains rejected; no A-series record is accepted; R3.1 and R4 remain blocked.** Receipt: `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_7_FOUNDATION_EXECUTABILITY_CLOSURE.md` |
| **Repair v2.0 — working draft, R2.8** | **July 21, 2026** | **R2.8 foundation-executability repair** (ordered after the independent Codex review of the R2.7 checkpoint at commit `3e9f913f` returned **REJECT/BLOCK-R3.1** — the `DISP`/SC2 subject model could not represent an SXW2 scenario subject, the source-date/fragment/`SM2` contracts remained mechanically ambiguous or composite, and the unsupported-obligation resolution was overrideable; R2.8 changes the governing standard and non-active status surfaces only and repairs no committed R3 record): the `DISP` detail schema made a **polymorphic subject-class-tagged** schema (`XW2-DISP`/`SXW2-DISP`) with mechanically exclusive subject variants, per-subject-class uniqueness keys, subject-family-mismatch rejection, and a pinned **canonical scenario-fragment grammar** `scenario-<n>:F<m>` derived from the §16 published scenario numbers (§15.9.4/§15.9.8); the source-date **date-component detail table** given a stable `<Record ID>#D<k>` component identity and a required `role/scope` discriminator (`primary`/`scoped:<slug>`) so multiple current same-basis dates with distinct roles/scopes are representable, replacing the one-row-per-basis rule (§15.9.6); the fragment schema's composite `Current status/version` split into `Fragment status`/`Fragment version`, a pinned **normalized-scope** representation and algorithm (clause/sentence scope atoms with equality, non-overlap, exhaustive-coverage, and contiguity rules) added, and a fixed **`BND-…` disposition-bundle** schema (bundle identity, source LEAF/fragment, member edge IDs/types/targets, subject scope, active class, status/version) replacing prose-only bundle compatibility (§15.9.3); the `SM2-…` schema's composite `Size/hash/pagination/signature` split into `Binary size bytes`/`Binary SHA-256`/`Binary pagination`/`Binary signature/as-of` and its composite `Current status/version` into `Search status`/`Search version`, subject-class and `Result linkage`/`Search-set ID` fields added, and a fixed **`SS2-…` search-set/coverage** record (required source classes joined to current member `SM2-…` records with a deterministic `adequate-coverage`/`inadequate-coverage` assessment; `inconclusive` and inadequate coverage can never support `unsupported-residual`) added (§15.9.6); the untyped "foundation amendment or adjudication decision" escape replaced by governed **`BLK-…` blocked-finding** and **`RES-…` resolution** records under a binding **independent-acceptance gate** (a maker can never self-accept; construction resumes only after a current `accepted` resolution with a checker distinct from the maker; a whole valid in-scope unsupported obligation can never escape as `unsupported-residual`/`no-successor`/`process-only`/`obsolete`/`invalid`-for-not-located/waiver — §15.9.3); every dependent gate conformed (U7, G1, G3, G15, `G15R`, R9, SC2 check 11 strengthened inside the unchanged sixteen-check block); and a committed **actual-schema validator** (`work/architect-completion/cba_canon_v2_foundation_validator.py`) that parses the real repository canon and §15.10–§15.12 populations — recognizing the committed R3 population as rejected/legacy, never certifying it as R3.1-conforming — superseding R2.7's synthetic checker and running all 26 inherited plus 15 new adversarial cases through the binding parser. First-party research this unit: the signed CBA binary re-downloaded and hash-verified (exact match `bf178ca0…`; 2,850,534 bytes; 676 PDF pages) and the current NBPA CBA page searched — **no later governing agreement text was located in the searched first-party sources** (the 2023 NBA-NBPA CBA remains current; NBA official surfaces timed out to this session and are recorded so). Active §15.10–§15.12 record-table rows byte-identical; §5.9, historical §15.1–§15.8, scenarios 1–89, and the sixteen-check SC2 block byte-preserved (only check 11 changed); no concrete `CBA2`/`XW2`/`SXW2`/`SRC2`/`EV2`/`DR2`/`SM2`/`SS2`/`BND`/`BLK`/`RES`/fragment record minted; no ID renumbered or reused. **R2.8 is not independently accepted; R3 remains rejected; no A-series record is accepted; R3.1 and R4 remain blocked.** Receipt: `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_8_FOUNDATION_EXECUTABILITY_REPAIR.md` |
| **Repair v2.0 — working draft, R2.9** | **July 21, 2026** | **R2.9 foundation-validation closure** (ordered after the independent Codex review of the R2.8 checkpoint at commit `8f7aec7a` returned **REJECT/BLOCK-R3.1** — the committed validator accepted binding-invalid document mutations while reporting 52/52 PASS, and the governing schemas retained composite fields, a dual-domain scope model, a BND cardinality contradiction, maker-selected coverage, and self-acceptance paths; R2.9 changes the governing standard and repair plan and non-active status surfaces only and repairs no committed R3 record): the base `Record status/version` and `official-mutable` `Publication identity/date or season` composites split into typed fields, effective-window endpoints required valid and ordered, and the date-component detail table given one all-explicit completeness rule (§15.9.6); the fragment normalized-scope dual `clause:`/`sent:` model replaced by one deterministic single-coordinate `span:<a>-<b>` **text-span system** with mechanical overlap/equality/coverage/contiguity, the `BND-…` cardinality contradiction resolved to a **multi-target-only** rule with an exact **member-compatibility matrix**, and the scenario-fragment inventory tied to an **exact partition** of each governed scenario's text (§15.9.3/§15.9.8) with SC2 check 16 strengthened inside the unchanged sixteen-check block; the `DISP` detail schema given an explicit `Normalized scope` field and the "demonstrably identical" reviewer judgment replaced by an exact **terminal-base-equality** rule (§15.9.4); the `SM2-…` fields fully typed with a current-record uniqueness key and an **SM2 ⇔ current-`SRC2` binary reconciliation**, and the `SS2-…` required classes made the **deterministic** set `CBA, BYL, NBA, ops-provenance` with a closed-grammar coverage assessment (§15.9.6); a **canonical-actor registry** with alias normalization (`agent:claude`/`agent:claude-code` are one actor), the `RES-…` acceptance split into typed fields **bound to the exact current resolution** (accepted version, content digest, proposed outcome), the `BLK-…` record given finding version/current and typed subject/search fields plus a `candidate-obligation` subject class, and the SXW2-blocker contradiction resolved to an **XW2-only** search-machinery policy (§15.9.3); every dependent gate conformed (U5–U9, G1, G3, G10, G14, G15, `G15R`, SC2, R8, R9); and the rejected R2.8 validator replaced by **one real parser-and-reconciliation engine** (`work/architect-completion/cba_canon_v2_foundation_validator.py`) that reads the actual canon **and** repair plan, parses every governed population at exact membership, runs every valid fixture and adversarial mutation through the same full-document path, and turns every Codex-demonstrated false positive into a rejecting regression. Repair-plan corrections: the "items 1–21; nothing else" backlog header corrected to the truthful items 1–27, the stale `accepted R2.7`/omitted-R2.8 R4 dependency and sequence corrected, and item 25 corrected so inadequate coverage never creates or clears a blocked outcome. Source-attribution correction: the R2.8 receipt's `"Is there a newer CBA? No."` NBPA attribution superseded by the bounded conclusion **"No later governing agreement text was located in the searched first-party sources"** (the signed-CBA facts — 2,850,534 bytes, 676 pages, SHA-256 `bf178ca0…`, entered into as of June 28 2023, effective July 1 2023–June 30 2030 — preserved). Active §15.10–§15.12 record-table rows byte-identical; §5.9, historical §15.1–§15.8, scenarios 1–89, and every prior receipt byte-preserved; no concrete record minted; no ID renumbered or reused. **R2.9 is not independently accepted; R3 remains rejected; no A-series record is accepted; R3.1 and R4 remain blocked.** Receipt: `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_9_FOUNDATION_VALIDATION_CLOSURE.md` |
| **Repair v2.0 — working draft, R2.10** | **July 22, 2026** | **R2.10 foundation-validation repair** (ordered after the independent Codex review of the R2.9 checkpoint at commit `5f868f2a` returned **REJECT/BLOCK-R3.1** — the validator never parsed the actual 47-row `DR2-…` population, validated a future R3.1 document only through a simulation-only fixture path instead of the committed-canon path, executed only four of `G15R`'s declared populations, accepted a fake acceptance commit and a nonexistent receipt as independent acceptance, and replaced the canon's governing vocabularies and actor aliases with hidden Python rules, while binding contradictions remained in `DISP` terminal-base equality, `BND-…` member coverage, the source-date component lifecycle, the impossible SM2 ⇔ `SRC2` byte-size equality, and candidate-obligation evidence; R2.10 changes the governing standard, the repair plan, and the validator only and repairs no committed R3 record): §15.9.11 **governed inventory** (machine-readable closed-vocabulary, pinned-schema, cross-schema-dependency, immutable-range, and pinned-population registries parsed as the sole source of truth and reconciled bidirectionally with the governing clause; hard-coded parallel validator contracts prohibited) with the explicit **preservation-versus-conformance** distinction (identity preservation checked against the pinned R3 checkpoint commit, never against a total; conformance carrying no fixed totals); the governed **acceptance-receipt record** binding `RES-…` acceptance to a resolvable commit and a parsed `ACCEPT` row; the `SRC2-…` base **`Artifact byte size`** field completing the SM2 ⇔ current-`SRC2` equality; date-component **`Component status`/`Component version`/superseding** lifecycle fields; the `BND-…` **`Member subject scopes`** field proving combined exhaustive member coverage; the corrected `DISP` **terminal-base-equality** tuple (subject fragment and destination fields included) and edge ⇔ detail agreement tuple (only fields both structures carry); the `SM2-…`/`SS2-…` **`candidate-obligation`** subject variant; and the enumerated twelve-population **`G15R`** gate including the complete `DR2-…` population. Recorded in `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_10_FOUNDATION_VALIDATION_CLOSURE.md`. **Not independently accepted.** |

| **Repair v2.0 — working draft, R2.11** | **July 22, 2026** | **R2.11 balanced foundation certification** (ordered after R2.10 was independently rejected): freezes the division between deterministic validator duties and independent source/semantic review; repairs the acceptance checkpoint/receipt-commit join and duplicate-row rejection; requires exact DR2 headers/fields/references/result/unit grammar; adds structured cross-population AMEND details, a distinct scenario-fragment schema, XW2/SXW2 BND variants with positional scope joins, SXW2 DISP scope equality, rooted acyclic EV2 closure checks, exact rendered-header checks, and actual-trigger `G15R`; retires alias-based identity proof, keyword source-truth heuristics, fixed case/population totals, and Inventory-C-as-all-algorithms claims; and corrects the maker/checker sequence and R8/R9/owner boundaries. Active §15.10–§15.12 rows and every prior receipt remain unchanged; no R3 record is repaired. Receipt: `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_11_BALANCED_FOUNDATION_CERTIFICATION.md`. **Independently REJECTED/BLOCK-R3.1; immutable rejected history.** |
| **Repair v2.0 — working draft, R2.12** | **July 23, 2026** | **R2.12 balanced-foundation closure** (ordered after the independent R2.11 checker returned **REJECT/BLOCK-R3.1**): requires an exact proposed `RES-…` row to exist at the accepted maker checkpoint before a later checker receipt can accept it; completes deterministic required-field, reference, declared-count, and version-lineage controls; makes `BND-…` member IDs polymorphic by subject class and removes the impossible edge-to-bundle backlink; governs OPS/EXT detail and §16 scenario-crosswalk locations; and closes the Phase-1-only R8/R9 boundary. Active §15.10–§15.12 rows and every prior receipt remain unchanged; no R3 record is repaired. Receipt: `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_12_BALANCED_FOUNDATION_CLOSURE.md`. **Executed at `68db497240b22a997d472f67a62929358b81cc1e`; independently REJECTED/BLOCK-R3.1 because governed-ID pipe rows outside every matching Inventory F range were silently ignored. Immutable rejected history.** |
| **Repair v2.0 — working draft, R2.13** | **July 23, 2026** | **R2.13 governed-location closure** (ordered by the independent R2.12 rejection): adds one generic whole-canon audit derived dynamically from Inventory F. Every pipe row whose first cell matches any governed ID grammar must lie inside the union of all matching declared intervals; identical or overlapping grammars, including the SRC2 base/detail grammars, use union admission, while existing per-range schema/type/detail reconciliation remains binding. Positive baseline/migrated/OPS/EXT controls and displaced OPS, EXT, EV2, and SXW2 regressions run through the same top-level validator. Active §15.10–§15.12 rows and every prior receipt remain unchanged; no R3 record is repaired. Receipt: `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_13_GOVERNED_LOCATION_CLOSURE.md`. **Executed at `818a5d03accbebfec810521a49ef9554ca4f79fa`; independently REJECTED/BLOCK-R3.1 because inconsistent record-ID normalization let valid multi-backtick Markdown IDs evade location detection and five live plan mirrors still named R2.12 ACCEPT as current. Immutable rejected history.** |
| **Repair v2.0 — working draft, R2.14** | **July 23, 2026** | **R2.14 ID-normalization and truthful-status closure** (ordered by the independent R2.13 rejection): one shared deterministic record-ID cell normalizer is used by ordinary population membership and the whole-canon Inventory F audit, accepting plain IDs and equal nonempty balanced backtick fences while leaving malformed fencing invalid; plain and multi-backtick displaced OPS, EXT, EV2, and SXW2 controls, a synthetic Inventory-F-only control, and a stale-plan-route control execute through the same top-level validator; every live status surface records R2.13 rejected and R3.1 blocked pending R2.14 acceptance. Active §15.10–§15.12 rows and every prior receipt remain unchanged; no R3 record is repaired. Receipt: `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_14_ID_NORMALIZATION_STATUS_CLOSURE.md`. **Accepted as settled by the current goal objective authority; the maker receipt remains immutable historical evidence and no R3 record is thereby accepted.** |
| **Repair v2.0 — working draft, pre-R3.1 compatibility** | **July 23, 2026** | **One-time foundation-compatibility checkpoint** (goal-authorized; not an R2.x unit): closes the blocking mismatch between the accepted standard and R3.1 execution by enforcing exact population-scoped AMEND lineage, same-ID change traceability, canon-valid high-water/gap behavior, exact historical LEAF extraction, the narrow governed later-family `deferred` XW2 shape, and the pinned historical-authority qualifier for `authority-assertion` fragments. It changes no active §15.10–§15.12 row and begins no substantive R3.1 migration. Receipt: `work/architect-completion/ARCHITECT_CBA_CANON_V2_R3_1_COMPATIBILITY_CHECKPOINT.md`. **Independently ACCEPTED at corrective checkpoint `c3a00637249444190a02a844fe104137ac78da5e`; the later owner-authorized same-family compatibility checkpoint was independently ACCEPTED at exact corrective checkpoint `d6101f82b40f5c1e8c45c8be090e9b4743daefe5` by `/root/validation_scout`. R3.1 maker checkpoint has executed and is pending an independent R3.1 checker ACCEPT; no A-series record is accepted, and R4 remains blocked until that ACCEPT.** |
| **Repair v2.0 — working draft, same-family deferral compatibility** | **July 24, 2026** | **Narrow XW2 same-family deferral compatibility checkpoint** (owner-authorized; not an R2.x unit): permits identical source/target family tokens only when an earlier construction unit must inventory a historical LEAF because a different sibling fragment already maps to an active target in another family, while the remaining fragment's honest natural-family owner will be minted by the specifically named later R4–R6 unit and no target yet exists. All ordinary same-family/same-unit deferrals remain forbidden; the existing target-`—`, one-fragment, no-bundle, direct-current-`OWN`, mandatory-`AMEND`, and zero-at-R8 safeguards remain binding. No concrete edge or active record is minted. Receipt: `work/architect-completion/ARCHITECT_CBA_CANON_V2_R3_1_SAME_FAMILY_DEFERRAL_COMPATIBILITY.md`. **Independently ACCEPTED at exact corrective checkpoint `d6101f82b40f5c1e8c45c8be090e9b4743daefe5` by `/root/validation_scout`. R3.1 maker checkpoint has executed and is pending an independent R3.1 checker ACCEPT; no A-series record is accepted, and R4 remains blocked until that ACCEPT.** |
| **Repair v2.0 — working draft, R3.1** | **July 24, 2026** | **A-series repair through AMEND lineage:** expands the active A family from 81 to 151 atomic LEAFs; repairs trade bonus, trade salary, cash, extension, sign-and-trade, and pick obligations; migrates every historical edge to exact fragment scope; adds the required bundles, terminal DISP records, adequate A18.7 search set, source-date components, and current SRC2 capture facts. Maker executed after independent compatibility ACCEPT; pending independent R3.1 checker, so R4 and Phase 2 remain blocked. Receipt: `work/architect-completion/ARCHITECT_CBA_CANON_V2_R3_1_A_SERIES_REPAIR.md`. |

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

- A trade bonus is capped at 15% of Base Compensation remaining to be earned when the Contract is traded, excluding an unexercised Option Year. Exhibit 4 may express it as a specified percentage or a dollar amount capped by a specified percentage.
- It is payable only once. A bonus in a sign-and-trade Contract does not apply to the initial trade; extension-added bonuses follow the distinct XXIV §2(a)(iv)–(v) lifecycle branches.
- An existing unearned bonus may be reduced, including to zero, in connection with a trade. A Contract with no trade bonus may add one only in connection with an Extension; a qualifying Extension amendment requires the replacement Exhibit 4 and separate original-term/extended-term treatment in XXIV §2(a)(v).
- Allocate an earned trade bonus as a VII §3(b)(1)(ii) signing bonus over the eligible current and remaining Salary Cap Years in proportion to protected Base Compensation, with the zero-protection branch allocated entirely to the trade year.
- Two maximum reductions are independent: Rookie Scale VIII §1(d) reduces a bonus as needed to keep Salary plus Unlikely Bonuses at or below 120% of the Rookie Scale Amount; Article II §7(f) applies a piecewise maximum for the fewer-than-seven, seven-to-fewer-than-ten, and at-least-ten Years-of-Service bands and reduces the bonus as needed to reach that applicable maximum.
- The assignor pays the earned bonus within 30 days absent a permitted agreed reallocation. The trade-year allocation increases the assignee-side post-assignment Salary and is included separately in the assignee Team's Team Salary.

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

- The player must already be eligible for an Extension. A one- or two-Season
  Contract cannot be extended; a three- or four-Season Contract ordinarily
  cannot be extended before the second anniversary of signing; and a five- or
  six-Season Contract ordinarily cannot be extended before the third
  anniversary. The CBA states separate earlier windows for specified
  off-season Extensions, including a four-Season Contract's second off-season
  and a five-Season Contract's third off-season.
- For an Extension entered into before July 1, 2024, first-year Salary plus
  Unlikely Bonuses cannot exceed 105% of the prior Salary Cap Year's Regular
  Salary plus the applicable carry-forward amount for a bonus whose criteria
  would be Likely in the extension's first Salary Cap Year. For an Extension
  entered into on or after July 1, 2024, that percentage is 120%. A previously
  Likely bonus that would be Unlikely in the first extension year is excluded
  from the prior-year base for this calculation.
- Extension-year Salary, Regular Salary, and each individual bonus may increase
  or decrease by no more than 5% of the first extension year's corresponding
  amount. Bonus criteria may not be changed through the Extension.
- A Designated Veteran Contract or Extension follows its separate eligibility
  and timing rules. A Contract containing an Option follows the exercised or
  unexercised option branches stated in VII §7(a); an Extension may not add an
  Early Termination Option, and a Veteran Free Agent's Qualifying Offer cannot
  be extended.
- A renegotiated Contract whose Salary increased by more than 10% cannot be
  extended before the third anniversary of the renegotiation. A player whose
  Contract is amended by Extension or Renegotiation generally cannot be traded
  for six months, and a player acquired by trade generally cannot receive a
  richer-than-permitted Extension for six months.
- The Extension and trade must be completed as linked transactions within the
  governing process and timing rules; the date-deeming provisions determine
  when specified off-season Extensions are treated as entered into.

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
- Cash paid or received directly or indirectly in connection with one or more trades occurring during a Salary Cap Year counts against that Salary Cap Year's limits (CBA VII §8(a), p. 260) — the express **CBA** general rule (separate annual paid/received limits; direct or indirect trade connection; no netting). **Applying** that general rule to conditional cash tied to a pick — including charging the trade's Salary Cap Year despite a later payment date — is **not itself express text**: it is an **INFERRED** application requiring a separately identified reasoning chain from the quoted connection-and-timing language (§15.9.5, as corrected by R2.7; the committed R3 rows stating the conditional application as express CBA are an R3.1 `AMEND` repair). The detailed attribution/accounting mechanics when the conditional asset is later re-traded are a further residual not expressed in the public signed text *(disposition per §15.9.5 as corrected by R2.6/R2.7: those mechanics become a separate active v2 LEAF only if qualifying authority is located — OPS only with real first-party operational provenance, INFERRED only with a controlling source chain; the former DERIVED/OPS composite label is rejected and must not be relied on. The bounded searches recorded in the R3, R2.6, and R2.7 receipts located no qualifying authority in the searched sources, so the residual fragment is an **unsupported operational candidate** (§15.9.6) preserved here — not registrable, not OPS, not enforceable, never verdict-driving; dispositioned by R3.1 through a terminal `unsupported-residual` crosswalk edge with a current `DISP` record and its required `SM2-…` search records, and reopenable only through the §15.9.3 supersession rule if qualifying authority is later obtained)*.
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

### 15.9 Register and source-certification standard (v2.0 — binding, R2.1 edition as hardened by R2.2 and corrected through the pre-R3.1 compatibility checkpoint)

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
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_5_SRC2_GRAMMAR_CLOSURE.md`;
and the R2.6 post-R3 foundation closure of this section (the terminal
`unsupported-residual` crosswalk disposition for exactly scoped residual
fragments of compound historical obligations, the `DISP` terminal
decision-record type with the binding OWN/DISP boundary and the R3.1
`AMEND` transition for committed mistyped terminal records, and the
narrow `YYYY-MM` month-precision publication/effective-date rule for
`official-immutable` sources) is recorded in
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_6_POST_R3_FOUNDATION_CLOSURE.md`;
and the R2.7 foundation-executability closure of this section (the
`basis:value` source-date model with its closed date-basis vocabulary
and date-component detail table — replacing the false slash-combined
publication/effective-date semantics — the historical-fragment
inventory contract with fragment IDs, fragment kinds, and exhaustive
reconciliation, the blocking outcome for wholly unsupported valid
obligations, the parseable `SM2-…` search-manifest contract, the fixed
`DISP` detail schema with the edge-type ⇔ decision-type compatibility
matrix and the direct-current-reference rule, the fragment-scoped
terminal-edge uniqueness key, the strengthened SC2 check 11, and the
R3.1-local `G15R` repair gate) is recorded in
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_7_FOUNDATION_EXECUTABILITY_CLOSURE.md`;
and the R2.8 foundation-executability repair of this section (the
polymorphic subject-class-tagged `XW2-DISP`/`SXW2-DISP` `DISP` detail
schema and the canonical scenario-fragment grammar `scenario-<n>:F<m>`
making an SXW2 scenario disposition representable; the stable-identity
`<Record ID>#D<k>` date-component table with its `role/scope`
discriminator for multiple same-basis dates; the split fragment
status/version fields, the pinned normalized-scope algorithm, and the
fixed `BND-…` disposition-bundle schema; the split `SM2-…` binary and
status/version fields with the `SS2-…` search-set/coverage record; and
the governed `BLK-…`/`RES-…` blocked-finding/resolution records under
the maker-cannot-self-accept independent-acceptance gate — with U7, G1,
G3, G15, `G15R`, R9, and SC2 check 11 conformed and an actual-schema
validator superseding R2.7's synthetic checker) is recorded in
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_8_FOUNDATION_EXECUTABILITY_REPAIR.md`;
and the R2.9 foundation-validation closure of this section (ordered
after the independent Codex review of the R2.8 checkpoint returned
REJECT/BLOCK-R3.1: the base `Record status/version` and `official-mutable`
`Publication identity/date or season` composites split into typed
fields, effective-window endpoint ordering required, and the
date-component detail table given one all-explicit completeness rule;
the fragment normalized-scope model replaced by one deterministic
single-coordinate `span:<a>-<b>` text-span system, the `BND-…`
cardinality contradiction resolved to a **multi-target-only** rule with
an exact member-compatibility matrix, and the scenario-fragment
inventory tied to an exact partition of each governed scenario's text
with SC2 check 16 strengthened; the `DISP` detail schema given an
explicit `Normalized scope` field and "demonstrably identical" replaced
by an exact terminal-base-equality rule; the `SM2-…` fields fully typed
with a current-record uniqueness key and an SM2 ⇔ current-`SRC2` binary
reconciliation, and the `SS2-…` required classes made the deterministic
set `CBA, BYL, NBA, ops-provenance` with a closed-grammar coverage
assessment; a canonical-actor registry with alias normalization, the
`RES-…` acceptance split into typed fields bound to the exact current
resolution, the `BLK-…` record given finding version/current fields and
typed subject/search fields with a `candidate-obligation` subject class,
and the SXW2-blocker contradiction resolved to an XW2-only search-machinery
policy; every dependent gate (U5–U9, G1, G3, G10, G14, G15, `G15R`, SC2,
R8, R9) conformed; and the R2.8 validator replaced by one real
parser-and-reconciliation engine over the actual canon and repair plan)
is recorded in
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_9_FOUNDATION_VALIDATION_CLOSURE.md`;
and the R2.10 foundation-validation repair of this section (ordered
after the independent Codex review of the R2.9 checkpoint returned
REJECT/BLOCK-R3.1: the complete governed inventory of §15.9.11 — the
machine-readable closed-vocabulary, pinned-schema, schema-dependency,
immutable-range, and pinned-population registries that every validator
must parse as the sole source of truth and reconcile bidirectionally
with the governing clause, abolishing parallel hidden validator
contracts; the governed **acceptance-receipt record** grammar making
`RES-…` independent acceptance a resolvable commit plus a parsed
receipt rather than a maker-written cell; the base `SRC2-…`
`Artifact byte size` field that makes the SM2 ⇔ current-`SRC2` byte-size
equality representable at all; the date-component lifecycle fields
(`Component status`/`Component version`/superseding relationship)
without which exactly-one-current and stale-reference rules could not be
expressed; the `BND-…` `Member subject scopes` field making combined
exhaustive member coverage mechanically provable; the corrected
`DISP` terminal-base-equality tuple — which now includes the subject
fragment, preserved-candidate anchor, limitations, and reopening
condition, so differing fragments or destinations can never be equal
bases — together with the corrected edge ⇔ detail agreement tuple that
cites only fields both structures actually carry; the
`candidate-obligation` subject variant of the `SM2-…`/`SS2-…` schemas
making candidate-obligation evidence representable without a historical
LEAF the candidate expressly lacks; and the `G15R` population
enumeration made individually executable, including `DR2-…` and every
dependent reference and current endpoint) is recorded in
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_10_FOUNDATION_VALIDATION_CLOSURE.md`.
The R2.11 balanced-foundation correction ordered after the independent
review of R2.10 is recorded in
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_11_BALANCED_FOUNDATION_CERTIFICATION.md`.
It fixes the division of labor between deterministic validation and
independent review; repairs the acceptance-receipt, DR2, scenario-fragment,
bundle, evidence-root, and amendment-lineage contracts; and retires claims
that software can establish authorship, intellectual independence, source
truth, semantic perfection, universal completeness, or legal
persuasiveness. R2.11 changes no active §15.10–§15.12 record-table row and
does not accept R3 or start R3.1.
The independent review of that R2.11 maker checkpoint returned
**REJECT/BLOCK-R3.1**. The bounded R2.12 closure is recorded in
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_12_BALANCED_FOUNDATION_CLOSURE.md`.
It requires the exact proposed `RES-…` content to exist at the accepted
maker checkpoint before a later checker receipt can accept it, completes
the declared mechanical controls, makes BND joins representable, pins all
governed population locations, and enforces the Phase-1-only R8/R9 boundary.
R2.12 changes no active §15.10–§15.12 record-table row, does not accept R3,
and does not start R3.1. Its independent checker nevertheless returned
**REJECT/BLOCK-R3.1** because a governed-ID pipe row outside every matching
Inventory F range could be silently ignored. The bounded R2.13 closure is
recorded in
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_13_GOVERNED_LOCATION_CLOSURE.md`.
It adds the generic whole-canon governed-row location audit and changes no
active §15.10–§15.12 record-table row. R2.13 was executed at
`818a5d03accbebfec810521a49ef9554ca4f79fa`; its independent checker returned
**REJECT/BLOCK-R3.1** because multi-backtick governed IDs could evade the
location audit and live plan mirrors still named an obsolete R2.12-current
route. The bounded R2.14 closure is recorded in
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_14_ID_NORMALIZATION_STATUS_CLOSURE.md`.
It unifies record-ID cell normalization and corrects every then-live route
while changing no active §15.10–§15.12 record-table row. The current goal
objective authority settles R2.14 as accepted without editing its historical
maker receipt. The one-time pre-R3.1 compatibility checkpoint is recorded in
`work/architect-completion/ARCHITECT_CBA_CANON_V2_R3_1_COMPATIBILITY_CHECKPOINT.md`;
it changes no active record and does not start R3.1. The independent
compatibility checker returned ACCEPT at corrective checkpoint
`c3a00637249444190a02a844fe104137ac78da5e`, unblocking R3.1.
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

Decision records (`DR2-<NNNN>`, §15.9.4) — including their pinned
`DISP` detail rows — historical-fragment inventory rows (§15.9.3), and
search-manifest records (`SM2-<NNNN>`, §15.9.6) live in the performing
unit's receipt and are cited from the registers. All three are support
populations: never active, never verdict-bearing, and never counted in
active totals.

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
`XW2-…` crosswalk edges, `SRC2-…` source/provenance records (including
their `<Record ID>#D<k>` date-component detail rows), `EV2-…` evidence
components, active `CBA2-SC-…` scenarios and their named cases, `SXW2-…`
scenario-crosswalk edges, `DR2-…` decision records (including their
polymorphic `XW2-DISP`/`SXW2-DISP` `DISP` detail rows), historical- and
scenario-fragment inventory rows (§15.9.3/§15.9.8), `BND-…`
disposition-bundle records (§15.9.3), `SM2-…` search-manifest records
and `SS2-…` search-set/coverage records (§15.9.6), and `BLK-…`
blocked-finding and `RES-…` resolution records (§15.9.3). A
correction never renumbers surviving sibling records and never reuses a
removed or superseded ID (child-ID numbering contract below); in every
correction, the performing unit updates every live crosswalk edge,
evidence row, origin reference, method field, dependency reference,
scenario `Exercises:` reference, and any other live reference in the
same commit.

**Append-only, precisely defined.** Every v2 namespace (`CBA2-…`,
`XW2-…`, `SRC2-…`, `EV2-…`, `CBA2-SC-…`, `SXW2-…`, `DR2-…`, `SM2-…`,
`SS2-…`, `BND-…`, `BLK-…`, `RES-…`, the per-LEAF fragment-ID namespace
of §15.9.3, the per-scenario fragment-ID namespace of §15.9.8, and the
per-record `<Record ID>#D<k>` date-component namespace of §15.9.6) is
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

Construction sequencing is **strict**, and — because the independent
Codex review **rejected** the R3 checkpoint (no R3 active record is
accepted) — the truthful sequence now runs through the ordered repair
units: **R3 (executed; rejected) → R2.6 (executed; rejected) → R2.7
(executed; rejected) → R2.8 (executed; rejected) → R2.9 (executed;
rejected) → R2.10 (executed; rejected) → R2.11 (executed; rejected) →
R2.12 (executed; rejected) → R2.13 (executed; rejected) → R2.14
(accepted under current goal authority) → one-time pre-R3.1 compatibility
checkpoint → independent compatibility checker ACCEPT → R3.1 → independent
R3.1 checker ACCEPT → R4 →
independent R4 checker ACCEPT → R5 → independent R5 checker ACCEPT →
R6**. R4 depends on the accepted R2.14 foundation, an independently
**accepted** pre-R3.1 compatibility checkpoint, and an independently accepted
R3.1 checkpoint (never on the rejected R3 alone), R5 on an independently
accepted R4 checkpoint, and R6 on an independently accepted R5 checkpoint
— every construction unit extends the shared
§15.10–§15.12 sections and allocates from the shared
`XW2-…`/`SRC2-…`/`EV2-…`/`DR2-…`/`SM2-…` namespaces, so construction
units never run in parallel and no parallel allocation ranges or
alternative namespace schemes exist.

#### 15.9.3 Historical crosswalk (XW2)

The crosswalk is a separate, mechanically parseable register of typed edges
from published v1.1 LEAF IDs to active v2 LEAF IDs. Schema:

| Field | Content |
|---|---|
| Edge ID | `XW2-<NNNN>`, unique, append-only per the §15.9.2 definition |
| Historical v1.1 LEAF | A published v1.1 LEAF ID in the pinned published register population (§15.9.1; meaning fixed at `9814939c`) — never the branch's legacy-numbered working copy |
| Active v2 LEAF or `—` | The target active LEAF; `—` only for terminal edge types or the governed nonterminal `deferred` shape |
| Edge type | One of the ten types below |
| Scope/relationship | The exact inventoried fragment the edge dispositions, identified by the pinned leading fragment token `[<fragment ID>]` under the fragment-inventory contract below, followed by which part of the historical obligation the edge covers, and how |
| Decision record | The `DR2-…` record that dispositioned the edge; for a terminal edge, a **direct reference to the current `DISP` record** (§15.9.4) — never a reference that resolves only through an `AMEND` chain to a superseded record |

Pinned crosswalk-edge schema string (binding; identical in content and
order to the field table above, stated here so the register is
mechanically joinable exactly as every other governed population is):
`Edge ID | Historical v1.1 LEAF | Active v2 LEAF or — | Edge type | Scope/relationship | Decision record`

Edge types:

| Type | Meaning | Terminal? |
|---|---|---|
| `equivalent` | One historical LEAF maps wholly to one active LEAF with the same obligation, the target absorbs it from no other historical owner, and there is no substantive re-homing | No |
| `split` | The historical LEAF's obligation is divided among multiple active targets; this edge covers the named fragment, wholly owned by its target | No |
| `merge` | The historical LEAF's whole obligation maps to one active target that also absorbs the same obligation from at least one other historical owner (a duplicate LEAF or a named bundle fragment) | No |
| `partial-overlap` | Neither the whole historical source nor the whole active target is semantically equivalent: genuinely overlapping fragments, or compound split/merge shapes not faithfully represented by `split` or `merge` alone; the scope column states exactly which part and how | No |
| `moved` | One historical LEAF maps wholly to one active LEAF (absorbed from no other historical owner), but its active family or parent changes | No |
| `deferred` | Temporary nonterminal disposition for one inventoried fragment whose honest active owner will be minted by a named later R4–R6 construction unit: target `—` only until that unit mints the owner; Scope/relationship names the source and target families plus exact resolving R-unit under the grammar below (normally distinct families, with the sole governed same-family sibling exception below); the decision is a direct current nonterminal ownership decision, never `DISP` | No |
| `process-only` | The historical row was process/instruction material; destination noted in scope | Yes |
| `invalid` | The historical row's claim was false (e.g., a false gap assertion); scope explains | Yes |
| `no-successor` | The historical statement is valid as history but carries no active v2 owner under the narrow no-successor rule below | Yes |
| `unsupported-residual` | Terminal disposition for an exactly scoped **residual fragment of a compound historical obligation** (narrow unsupported-residual rule below): the fragment is valid, in-scope history preserved as a discovery candidate, but no qualifying authority (§15.9.5–§15.9.6) was located in the searched sources, so no active owner can honestly be minted | Yes |

Binding rules:

1. The model is **historical → active and bipartite**: no edges between two
   historical IDs or two active IDs, no chains, and no role transitions —
   so no migration chain or cycle is possible, and none is allowed.
2. Every published v1.1 LEAF has **at least one outgoing edge** by the end
   of R8.
3. Every non-terminal edge except `deferred` targets an **existing active
   v2 LEAF**. A `deferred` edge is nonterminal but carries target `—`
   under the narrow deferral rule below.
   `process-only`, `invalid`, `no-successor`, and `unsupported-residual`
   are terminal and use `—` as the target.
4. Compound history is expressed with **multiple typed edge records**,
   never a combined subtype.
5. An active v2 LEAF may have zero, one, or many historical predecessors. A
   LEAF with no predecessor carries explicit **newly-certified origin**
   provenance (`new` in its Origin field plus an origin decision record).
6. Crosswalk records **never transfer or inherit historical verdicts**;
   every active LEAF requires fresh evidence.
7. GROUP-level crosswalk notes are informational only and are excluded from
   the mandatory LEAF-coverage gate.
8. An edge is recorded by the unit that mints its target, by the unit
   processing a terminal historical segment, or — only under the narrow
   rule below — by the current unit as a governed `deferred` edge. A prose
   deferral without that edge does not disposition a fragment. R8 requires
   zero current `deferred` edges.

**Deferred-edge rule (narrow, nonterminal, and temporary).** A
`deferred` edge is valid only when all of the following hold:

1. The inventoried fragment is in scope and has an honest prospective owner
   that a specifically named **later** R4–R6 construction unit must mint, so
   the current unit cannot yet name an active target. This is not failed
   research, a terminal no-owner disposition, or permission to defer a
   same-unit obligation.
2. `Active v2 LEAF or —` is exactly `—` while deferred. The edge is
   nonterminal: it never carries a `DISP` record or `DISP` detail row.
3. After the leading fragment token and exact normalized span,
   `Scope/relationship` contains exactly
   `families:<source-family>,<target-family>; resolving-unit:R<n>`, where
   each family is one of `A`, `C`, `R`, `L`, `S`, the source family equals
   the published historical LEAF's family, and `R<n>` is the exact later
   resolving construction unit (`R4`, `R5`, or `R6`). The two family tokens
   are distinct except for this sole exception: they may be identical only
   when **all** of the following are true:
   - the current earlier construction unit must inventory this historical
     LEAF because a different current sibling fragment maps through a
     nonterminal, non-`deferred` edge to an existing active target whose
     family differs from the historical source family;
   - the deferred fragment's honest natural owner belongs to the historical
     source family and will be minted by the specifically named later unit
     (`C01`–`C13` by R4, `C14`–`C25` by R5, and `R`/`L`/`S` by R6);
   - no active target for the deferred fragment exists yet; if it exists and
     can be named, the ordinary target-bearing edge is required; and
   - the direct current ownership decision identifies the qualifying sibling,
     the cross-family active target, the natural-family ownership conclusion,
     and the named later unit.
   For a same-family edge, that decision's `Test/tiebreak applied` field is
   exactly one structural join token in this grammar:
   `same-family-sibling:<XW2-edge>-><active-v2-LEAF>;
   natural-family:<family>; resolving-unit:R<n>`. The named edge must be the
   qualifying different-fragment sibling, its named active target must equal
   the edge's target and differ in family from the historical source, the
   natural-family token must equal the source family, and the unit must equal
   both the edge's unit and the construction map above. This field proves only
   the mechanical join; whether the sibling forced current inventory and the
   deferred fragment truthfully has that natural owner remain
   independent-checker semantic judgments.
   Identical tokens without that qualifying sibling, with the wrong later
   unit, with a source-family or sibling-target-family mismatch, or for an
   obligation owned by the current unit are invalid. This exception does not
   permit ordinary same-family or same-unit deferral.
4. `Decision record` directly references one current nonterminal ownership
   decision (normally `OWN`) whose result is `—` while the target does not
   yet exist; it never references `DISP`.
5. One `deferred` edge dispositions exactly one fragment with
   `Disposition bundle ID` = `—`. It is the single-nonterminal shape, not a
   terminal edge and not a `BND-…` member.
6. When the named resolving unit mints the owner, that unit revises or
   replaces the deferred edge through governed `AMEND` lineage, supplies the
   direct active target, and updates every live reference in the same
   checkpoint. No `deferred` edge may remain current when R8 begins; G1
   requires zero.

**Historical-fragment inventory (binding; parseable).** Prose on an
edge cannot prove that every part of a historical obligation was
identified and dispositioned. Every historical LEAF used as an `XW2-…`
source therefore carries a declared, mechanically parseable **fragment
inventory** in the performing unit's receipt, and every edge
dispositions exactly one inventoried fragment.

- **Fragment-ID grammar (pinned).** A fragment ID is exactly
  `<historical LEAF ID>:F<n>` — the published v1.1 LEAF ID, one ASCII
  colon, one uppercase `F`, and an unpadded positive integer `n`
  allocated contiguously from `1` at inventory declaration (e.g.,
  `CBA-A18.7:F1`, `CBA-A18.7:F2` — illustrative). The fragment-ID
  namespace is per historical LEAF and append-only per §15.9.2: a
  fragment ID is never reused or renumbered, and a later `AMEND` split
  or merge of fragments allocates above the LEAF's fragment high-water
  mark. A historical LEAF whose obligation is dispositioned whole has
  exactly one fragment (`:F1`) covering the whole obligation.
- **Fragment-inventory schema (pinned; one row per fragment, in the
  performing unit's receipt; status and version split into separate
  parseable fields — R2.8):**
  `Fragment ID | Historical parent LEAF | Fragment kind | Historical authority qualifier or — | Normalized fragment scope | Decomposition decision record | Disposition bundle ID or — | Disposition edge ID(s) | Fragment status | Fragment version | Limitations or —`
  — with `Disposition edge ID(s)` one or more `XW2-…` IDs under the
  §15.9.6 reference grammar (`", "`-separated, ascending, no
  duplicates); `Decomposition decision record` the `DR2-…` record
  (normally `ATOM`) declaring the LEAF's complete decomposition;
  `Disposition bundle ID` a single `BND-<NNNN>` disposition-bundle
  record (below) **only** for a nonterminal fragment mapping to **two or
  more** active targets, or `—` for a fragment carried by exactly one
  terminal edge **or** exactly one single-target nonterminal edge
  (multi-target-only bundle rule, below); `Fragment status`
  a closed vocabulary `current` | `superseded`; and `Fragment version`
  an unpadded positive integer from `1`, incremented by the `AMEND`
  chain. The former composite `Current status/version` field is
  abolished — it was not independently parseable.
  `Historical authority qualifier or —` is exactly the normalized
  Authority cell from the pinned published v1.1 LEAF row for an
  `authority-assertion` fragment, and exactly `—` for every other fragment
  kind. Normalization is the same NFC/trim/whitespace-collapse algorithm
  used for requirement text. The qualifier is **not a second coordinate
  domain**: `Normalized fragment scope` remains solely a span over the
  requirement text. It narrows the proposition dispositioned by an
  `authority-assertion` edge. Thus a full-requirement span plus qualifier
  `OPS` and edge type `invalid` means only “this reported mechanic is a
  qualifying OPS obligation” is false; it does not say the preserved
  mechanic was disproved. A missing, mismatched, or non-authority qualifier
  fails.
- **Normalized fragment scope (pinned single-coordinate text-span
  system and normalization algorithm — corrected R2.9).** The pre-R2.9
  model used two atom domains — `clause:<locator>` and `sent:<a>` — over
  the *same* text, so a clause and the sentence containing it could
  overlap the same bytes while appearing set-disjoint, and clause
  locators and sentence boundaries had no exact grammar. That dual
  domain is **abolished**. Scope is now expressed in **one deterministic
  coordinate system**: half-open **character spans over the LEAF's
  normalized Canonical requirement text**, whose immutable bytes are
  fixed at `9814939c` (§15.9.1).
  - **Normalized requirement text (pinned derivation).** Take the
    published v1.1 LEAF's Canonical requirement text at `9814939c`;
    apply, in order: (1) Unicode NFC normalization; (2) strip one
    leading and one trailing run of whitespace; (3) replace every
    maximal run of Unicode whitespace with a single space `U+0020`. The
    result is the **normalized requirement text**, a fixed sequence of
    `L` characters indexed `0…L−1`. This derivation is deterministic and
    reproducible, so `L` and every character offset are pinned facts of
    the immutable source, not a reviewer's judgment.
  - **Scope-atom grammar (single domain).** An atom is exactly
    `span:<a>-<b>` where `<a>` and `<b>` are unpadded non-negative
    integers with `0 ≤ a < b ≤ L` — the half-open character range
    `[a, b)` of the normalized requirement text. `span:<a>-<a>` (empty)
    and any `b > L` or `a ≥ b` are malformed. A scope is a `"; "`-
    separated, ascending-by-`a` (ties broken by `b`), list of atoms with
    **no two atoms overlapping** (defined below). An optional
    human-readable clause label may be appended to any atom as
    `span:<a>-<b>@<label>` (e.g., `span:0-57@VII§6(j)(1)(i)`); the label
    is annotation only — it is **never** a coordinate and **never**
    participates in overlap, equality, coverage, ordering, or contiguity,
    all of which are computed **solely** on the `[a, b)` character
    ranges. This removes the dual-domain blind spot: a clause and its
    containing sentence share characters and therefore overlap.
  - **Mechanical relations (all on `[a, b)` ranges).** *Overlap:* atoms
    `[a, b)` and `[a′, b′)` overlap iff `a < b′ ∧ a′ < b`. *Equality:*
    two scopes are equal iff their atoms, each merged into canonical
    maximal non-adjacent form (adjacent or overlapping ranges coalesced),
    are identical. *Pairwise non-overlap* across a LEAF's fragments: no
    atom of one fragment overlaps any atom of another. *Exhaustive
    coverage* (declared under the decomposition decision record): the
    union of every fragment's ranges equals exactly `[0, L)` — no
    character uncovered and none covered twice. *Ordering:* ascending by
    `a` then `b`. *Contiguity:* a fragment's ranges coalesce to a single
    `[a, b)` — an **intrinsic mechanical property of the span set**, not
    a declared field (the pre-R2.9 "where a fragment declares itself
    contiguous" language, which referenced a nonexistent schema field,
    is abolished).
  - Fragment IDs are contiguous `F1…Fn` with no gaps at declaration; a
    fragment's normalized character spans are its **stable identity**
    across `AMEND` history — successor fragments re-cover a superseded
    fragment's character ranges and no character is silently dropped.
- **Disposition-bundle schema (pinned; fixed; parseable — corrected
  R2.9).** **Bundle cardinality — one rule, propagated everywhere:** a
  bundle exists **only** for a fragment that maps to **two or more**
  active targets. A nonterminal fragment with exactly **one** active
  target carries exactly **one** nonterminal edge and `Disposition
  bundle ID` = `—` (no bundle); a terminal fragment carries exactly one
  terminal edge and `Disposition bundle ID` = `—`. The pre-R2.9
  contradiction — one clause requiring "a bundle for every nonterminal
  fragment" while another (and repair-plan item 23) required a bundle
  only for **multi-target** fragments — is resolved in favor of the
  **multi-target-only** rule stated here and enforced identically in the
  per-LEAF completeness contract, U7, G1, and R9. Bundles are a support
  population (performing unit's receipt), append-only per §15.9.2:
  `Bundle ID | BND subject class | Source historical LEAF or — | Historical scenario or — | Source fragment ID | Member edge IDs | Member edge types | Member target IDs | Member subject scopes | Subject scope | Bundle class | Bundle status | Bundle version | Superseding/current relationship or —`
  Rules (all binding): `Bundle ID` is `BND-<NNNN>`, unique, monotonic.
  Bundle subject-class vocabulary: `BND subject class` is exactly
  `XW2-BND` or `SXW2-BND`. For
  `XW2-BND`, `Source historical LEAF` and its LEAF fragment ID are
  required and `Historical scenario` is `—`; for `SXW2-BND`,
  `Historical scenario` and its scenario-fragment ID are required and
  `Source historical LEAF` is `—`. The variants are mechanically
  exclusive, and every member edge comes from the corresponding
  register.
  `Member edge IDs` is `", "`-separated, ascending, **no duplicate
  members**, and contains **≥2 IDs from the subject class's corresponding
  register**: `XW2-…` for `XW2-BND`, `SXW2-…` for `SXW2-BND`. A
  one-member "bundle" is malformed — that fragment takes a bare
  single-target edge instead. `Member edge
  types`, `Member target IDs`, and `Member subject scopes` are aligned
  position-for-position with
  `Member edge IDs`; every member edge type is drawn only from the
  **target-bearing nonterminal** vocabulary (`equivalent`, `split`,
  `merge`, `partial-overlap`, `moved` — never `deferred`, never a terminal
  type, never an unknown type), and **no duplicate (source fragment,
  target) mapping** appears.
  `Subject scope` equals the fragment's Normalized fragment scope.
  **`Member subject scopes` (added R2.10; the field that makes combined
  exhaustive coverage mechanically provable)** is a `", "`-separated
  list carrying, for each member position, that member edge's own
  **member-specific sub-scope** — a §15.9.3 normalized scope in the
  single-coordinate `span:<a>-<b>` grammar naming exactly the character
  range of the fragment that member edge carries to its target. Its
  binding rules: every element parses under the scope-atom grammar;
  every element's ranges lie wholly **inside** the bundle's
  `Subject scope`; **no two members' ranges overlap**; and the
  **union of all member ranges equals the bundle's `Subject scope`
  exactly** (canonical merged span-set equality) — so a member set that
  leaves any residual character of the fragment uncovered, that
  double-covers a character, or that reaches outside the fragment
  **fails**. The pre-R2.10 schema stated the "together carry the whole
  fragment" duty in prose while carrying no per-member coordinate, so
  the duty was not mechanically demonstrable; it now is. Each element
  must also equal, position-for-position, the corresponding member
  edge's own parseable Scope/relationship fragment scope, in both
  directions. The join is mandatory for both `XW2-BND` and
  `SXW2-BND`; checking only the combined union is insufficient.
  The six-field XW2/SXW2 edge schemas intentionally carry **no**
  `Disposition bundle ID` field: representable reciprocity is
  fragment → bundle, bundle → member edges, and each edge →
  fragment/position-specific scope. A validator must never require an
  impossible edge → bundle backlink.
  `Bundle class` is `active` (a bundle is always the nonterminal,
  actively owned disposition; a terminal fragment carries a single
  terminal edge, never a bundle — **active/terminal mixing fails**).
  `Bundle status`/`Bundle version` are `current` | `superseded` /
  integer. `Superseding/current relationship` is `—` or `supersedes
  BND-<NNNN> per AMEND DR2-<NNNN>`.
  - **Member compatibility matrix (pinned; exact; rejects contradictory
    sole-owner combinations).** `equivalent` and `moved` are
    **whole-fragment sole-owner** member types: a bundle may contain
    **at most one** member total when that member is `equivalent` or
    `moved`, and since a bundle requires ≥2 members, **`equivalent` and
    `moved` may never appear as a bundle member at all** (a
    whole-fragment mapping is single-target by definition and takes a
    bare edge). A bundle's members are therefore drawn **only** from the
    **partial** types `split`, `merge`, `partial-overlap`, in any
    combination, one per distinct target, together carrying the whole
    fragment. Rejected by this matrix: two `equivalent` members; two
    `moved` members; any `equivalent`/`moved` member; two members with
    the same target (duplicate mapping); a member whose edge's source
    fragment ≠ the bundle's `Source fragment ID` (wrong-fragment edge);
    and a fragment left with residual character spans not covered by any
    member (undispositioned residual).
  A bundle whose member edges do not all point back to its
  `Source fragment ID`, that mixes a terminal member, that carries a
  duplicate edge or duplicate (source fragment, target) mapping, that
  violates the member compatibility matrix above, or that contradicts
  the fragment's single disposition, fails. The `SXW2-BND` variant
  (§15.9.8) uses the same schema and `SXW2-…` member edges over a
  scenario fragment. R2.8–R2.12 mint no concrete bundle record.
- **Fragment kinds (closed vocabulary; exactly one per fragment):**
  `substantive-obligation` (a substantive mechanic or requirement);
  `authority-assertion` (a claim that the exact
  `Historical authority qualifier` from the pinned Authority cell makes a
  mechanic enforceable — the claim, not the mechanic);
  `process-instruction` (process, testing, or implementation
  instruction material); `gap-assertion` (a claim that a gap exists).
  The kind separation is load-bearing: a **false**
  `authority-assertion` or `gap-assertion` fragment may be
  dispositioned `invalid`, but a `substantive-obligation` fragment
  that is merely unsupported is **not thereby invalid** — it is
  dispositioned `unsupported-residual` (with a supported sibling) or
  triggers the blocking outcome below (without one). An
  `unsupported-residual` edge may disposition only a
  `substantive-obligation` fragment; a `process-only` edge only a
  `process-instruction` fragment; these kind ⇔ edge-type pairings are
  checked mechanically wherever both sides are recorded.
- **Per-LEAF completeness contract (all mandatory):** (1) a declared
  **exhaustive decomposition** — the inventory states that the listed
  fragments exhaust the LEAF's published content, under the
  decomposition decision record; (2) **pairwise non-overlapping**
  normalized fragment scopes; (3) **no silently omitted residual** —
  any residual content is itself a declared fragment; (4) every
  fragment **dispositioned exactly once** in exactly one of three
  mutually exclusive shapes (multi-target-only bundle rule above):
  (a) exactly one **terminal edge** with `Disposition bundle ID` = `—`;
  (b) exactly one **single-target nonterminal edge** with `Disposition
  bundle ID` = `—` (including the narrow target-pending `deferred`
  shape, whose eventual target is supplied through `AMEND`); or
  (c) exactly one **governed disposition bundle**
  (`BND-<NNNN>`, above) of **≥2** member nonterminal edges together
  carrying the fragment under split/merge/`partial-overlap` semantics and
  equal (as a set) to the fragment's `Disposition edge ID(s)`. A
  multi-target fragment maps to its targets through its one bundle; it
  may never carry two terminal edges, never a terminal edge plus a
  nonterminal edge or bundle, never a single-target edge plus a bundle,
  and never two bundles (no fragment is simultaneously terminal and
  actively owned, and no fragment carries contradictory dispositions);
  (5)
  **bidirectional edge ⇔ fragment
  reconciliation** — every edge's leading fragment token resolves to
  an inventoried fragment of the same historical LEAF; every fragment
  row's edge IDs resolve to existing edges whose historical source is
  that LEAF and whose scope names that fragment; zero orphan fragments
  (a fragment with no disposition), zero edges naming an unregistered
  fragment; and (6) **semantic exhaustiveness review** — a reviewer
  confirms in the receipt that the declared fragments exhaust the
  historical obligation; mechanical reconciliation of the declared
  inventory never substitutes for this semantic confirmation, and the
  confirmation never substitutes for the mechanical reconciliation.
- **Terminal-edge uniqueness (corrected key):** terminal edges are
  unique per **historical source LEAF + fragment ID** — two different
  terminal fragments of one historical LEAF coexist without colliding
  merely because both targets are `—`. Nonterminal edges keep the
  existing uniqueness rule: exactly one primary relationship type per
  historical-source/active-target pair.
- **Transition:** the committed R3 edges predate this contract and
  carry prose scopes without fragment tokens; R3.1 declares the
  fragment inventories for every historical LEAF used by the committed
  edges and migrates the edges through `AMEND` lineage. R2.7 mints no
  concrete fragment record.

**Deterministic edge typing (binding).** One honest relationship produces
one predictable representation:

- **Exactly one primary relationship type per historical-source/
  active-target pair.** No source–target pair may appear under two edge
  types, and movement is never recorded as a second edge for a pair that
  is already typed: re-homing of a whole obligation is `moved`; re-homing
  of a `split`/`merge`/`partial-overlap` fragment is recorded in that
  edge's Scope/relationship column, never as an additional `moved` edge
  for the same pair.
- **Decision order** — applied per inventoried fragment of the
  historical LEAF (fragment-inventory contract above; a whole-obligation
  LEAF is its single `:F1` fragment), stopping at the first test that
  matches:
  1. Terminal dispositions first: process material (a
     `process-instruction` fragment) → `process-only`; a false claim
     (typically a false `authority-assertion` or `gap-assertion`
     fragment, or a substantive claim the primary text contradicts) →
     `invalid`; a valid historical statement meeting every condition of
     the no-successor rule below → `no-successor`; a valid, in-scope
     residual `substantive-obligation` fragment of a compound
     historical obligation meeting every condition of the
     unsupported-residual rule below → `unsupported-residual`. A valid,
     in-scope `substantive-obligation` fragment with **no supported
     sibling** whose qualifying authority is not located matches **no
     terminal test**: it triggers the blocking outcome below and stops
     the unit.
  2. A fragment whose honest prospective owner will be minted by a named
     later R4–R6 construction unit and satisfies every deferred-edge rule
     above is `deferred`; this includes the sole governed same-family sibling
     exception and no other same-family case. It remains nonterminal, carries
     target `—`, and must be revised/replaced when that resolving unit mints
     the owner.
  3. The whole obligation is owned by exactly one active LEAF, and the
     target absorbs it from no other historical owner: `equivalent` when
     the active family and parent do not substantively re-home it;
     `moved` when they do.
  4. The whole obligation is owned by exactly one active LEAF that also
     absorbs the same obligation from at least one other historical owner
     (a duplicate LEAF or a named bundle fragment): `merge`.
  5. The obligation divides among multiple active targets and each named
     fragment is wholly owned by its target: one `split` edge per pair.
  6. Anything else — genuinely overlapping fragments, or compound
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

**Unsupported-residual rule (narrow, gateable).** An
`unsupported-residual` edge may be recorded only when **all** of the
following hold:

1. The disposition covers an **exactly scoped residual fragment of a
   compound historical obligation**: at least one other fragment of the
   same historical LEAF carries its own typed edge, and this edge's
   Scope/relationship column states the exact residual fragment it
   dispositions. A wholly false authority or enforceability claim
   remains `invalid`; process text remains `process-only`; a whole
   obligation that is out of scope or obsolete remains `no-successor`.
2. The fragment is **valid as history and inside the active v2 canon's
   approved obligation scope** — which is exactly why it can be neither
   discarded as `no-successor` nor registered without authority.
3. A **bounded primary/first-party source search** for qualifying
   authority (§15.9.5–§15.9.6) was performed and recorded as the
   required set of parseable `SM2-…` search-manifest records
   (§15.9.6), each with result
   `no-qualifying-authority-located-in-searched-sources`, and **no
   qualifying authority was located in the searched sources**. A
   prose-only search narrative satisfies nothing. The disposition
   asserts only that outcome — never that no authority exists or ever
   existed.
4. The disposition means **unsupported/unverified — not disproven, not
   obsolete, not out of scope**. It carries no active authority class,
   no behavioral verdict, and no application requirement: while it
   stands, the fragment is never registrable, never OPS (or any other
   class), never an automatic or configurable product verdict, and
   never enforceable.
5. The fragment's **discovery-candidate status is preserved**: the
   Scope/relationship column names the canon discussion-section anchor
   (e.g., §12.12) where the unsupported operational candidate
   (§15.9.6) remains preserved for future qualifying provenance.
6. The disposition is none of: a convenience, a deferral of research
   the unit was required to perform, a substitute for incomplete or
   failed source certification of an obligation whose qualifying
   authority exists, or a device to avoid minting an active owner where
   qualifying authority was located. Where qualifying authority is
   located, the fragment receives an active owner — never this
   disposition.
7. The edge carries a **direct reference to a current `DISP` decision
   record** with its pinned detail row (§15.9.4) identifying the
   fragment, the `SM2-…` search records, the honest "not located in
   the searched sources" basis, why no active owner is selected, the
   preserved-candidate anchor, limitations, and the reopening
   condition below.
8. **Reopening/supersession:** if qualifying authority is later
   obtained, the disposition is superseded through `AMEND` lineage
   (§15.9.2): the performing unit mints the active owner (allocating
   above the owning GROUP's historical high-water mark), records the
   appropriate non-terminal edge for the fragment, removes the
   `unsupported-residual` edge via `AMEND` with a superseding
   disposition, and updates every live reference in the same commit.
   No ID is ever renumbered or reused.
9. The decision is explicitly reviewed during R8 global reconciliation
   (G3), and R9 independently reviews **every** `unsupported-residual`
   disposition individually — not a sample, and each at R8 and R9 as an
   individual semantic review, never a batch waiver.

`unsupported-residual` is not `invalid` (it asserts no false claim), not
`process-only` (the fragment is substantive), and not `no-successor`
(the fragment is in scope and not obsolete; the narrow no-successor rule
expressly excludes merely-unsupported content). It does not recreate the
rejected retirement/no-successor machinery (§15.9.10): it retires no ID,
aliases nothing, appends nothing to the historical namespace, and hides
nothing — it is a typed, individually reviewed, reopenable statement
that an in-scope residual fragment currently has no honestly mintable
owner because no qualifying authority was located in the searched
sources.

**Blocking outcome — wholly unsupported valid obligation (binding).**
`unsupported-residual` is available only to a residual fragment with at
least one supported sibling on the same historical LEAF. Where a
**whole** valid, in-scope `substantive-obligation` — a whole historical
LEAF, or a fragment with **no supported sibling** — has no qualifying
authority located after the required `SM2-…` searches, the mandatory
outcome is **`blocked-unsupported-obligation`**: a blocking stop
condition, never a terminal edge and never an easy exit. Its force:

1. **No edge may be recorded** for the obligation: it is not
   `no-successor` (it is in scope and not obsolete), not `invalid` (no
   false claim is asserted), and not `unsupported-residual` (no
   supported sibling exists).
2. **The construction unit cannot pass.** The unit records a governed
   **`blocked-unsupported-obligation` finding** (the `BLK-<NNNN>`
   blocked-finding record below — subject, fragment/candidate, the
   current `SS2-…` search-set and `SM2-…` records, and the honest
   not-located basis), U7 fails for the unit, and the unit **stops** for
   an independently accepted governed resolution (below). The unit may
   not proceed around the blocked obligation.
3. **The discovery candidate is preserved** at a named canon anchor,
   exactly as for `unsupported-residual`.
4. **No active authority class, behavioral verdict, registration, or
   enforcement** may arise from the blocked state.
5. The outcome is **never** usable to absorb incomplete research (the
   `SM2-…` searches must be complete and adequate first),
   inconvenience, or failed certification of an obligation whose
   qualifying authority exists.
6. **Action required before construction resumes:** a governed
   `RES-<NNNN>` **resolution record** (below), independently accepted
   (a checker distinct from the maker, at a pinned acceptance
   commit/receipt), whose `Proposed outcome` is one of the closed
   routes — (a) `foundation-vocabulary-or-scope-decision` supplying the
   honest disposition path, (b) `authority-located-mint-owner` locating
   qualifying authority and minting the active owner through the normal
   evidence process, or (c) `out-of-scope-determination` with a recorded
   scope/edition basis (making `no-successor` honest). Construction
   resumes only after that resolution is `accepted` **and** every
   required reference is updated in the same commit. A maker can never
   self-accept, and no unstructured waiver, adjudication statement, or
   convenience escape substitutes for an accepted governed resolution.

**Governed blocked-finding and resolution records (binding; parseable —
R2.8).** The pre-R2.8 escape — "an explicit, recorded foundation
amendment or adjudication decision" — was untyped prose a maker could
write and clear unilaterally. It is replaced by two stable, parseable
support-population records (performing unit's receipt, append-only per
§15.9.2), under an independent-acceptance gate.

Blocked-finding record (composite subject/search references split and
finding version/current fields added — R2.9):
`Blocked finding ID | Subject class | Subject historical LEAF or — | Subject fragment ID or — | Subject candidate anchor or — | Finding type | Search-set ID or — | Search-manifest IDs or — | Evidence references or — | Preserved candidate anchor | Finding status | Finding version | Resolution ID or — | Superseding/current relationship or — | Limitations`
— `Blocked finding ID` is `BLK-<NNNN>` (unique, monotonic). `Subject
class` is the closed vocabulary **`XW2-DISP` | `candidate-obligation`**
(never `SXW2-DISP` — SXW2 policy below). For **`XW2-DISP`**: `Subject
historical LEAF` is the published v1.1 LEAF and `Subject fragment ID`
its §15.9.3 fragment ID (both required, both resolving); `Subject
candidate anchor` = `—`. For **`candidate-obligation`** (a newly
discovered in-scope obligation that does not yet have a historical
LEAF): `Subject historical LEAF` = `—` and `Subject fragment ID` = `—`,
and `Subject candidate anchor` is required — the canon anchor naming the
discovered obligation. `Finding type` is the closed vocabulary
`blocked-unsupported-obligation`. `Search-set ID` names the current
`SS2-…` set and `Search-manifest IDs` its current `SM2-…` members
(`", "`-separated, ascending) proving the adequate, not-located search;
each `—` only where no search set applies. `Preserved candidate anchor`
is the canon anchor. `Finding status` is the closed vocabulary
`open` | `resolved` (an `open` finding fails U7 and stops the unit).
`Finding version` is an unpadded integer from `1`, incremented by the
`AMEND` chain. `Resolution ID` names the current `RES-…` resolution once
one exists, else `—`. `Superseding/current relationship` is `—` or
`supersedes BLK-<NNNN> per AMEND DR2-<NNNN>`.

Resolution record (composite acceptance field split and bound to the
exact current resolution — R2.9):
`Resolution ID | Blocked finding ID | Proposed outcome | Resolver authority | Maker/proposer identity | Independent checker identity | Proposal receipt path | Accepted checkpoint commit or — | Acceptance receipt commit or — | Acceptance receipt or — | Accepted RES version or — | Accepted content digest or — | Accepted proposed outcome or — | Resolution status | Resolution version | Reopening condition | Limitations | Superseding/current relationship or —`
— `Resolution ID` is `RES-<NNNN>` (unique, monotonic); `Blocked finding
ID` names its `BLK-…`; `Proposed outcome` is the closed vocabulary
`foundation-vocabulary-or-scope-decision` |
`authority-located-mint-owner` | `out-of-scope-determination`;
`Resolver authority` states the foundation/adjudication authority;
`Maker/proposer identity` and `Independent checker identity` use the
§15.9.6 verifier grammar (`agent:<slug>`/`human:<slug>`), are each
required, and must be recorded as different strings. This is a
structural separation assertion only: the independent checker judges
actual authorship, intellectual independence, and chronology. Software
must not claim to prove those human/agent facts. `Proposal receipt path`
is the required repository-relative performing-unit receipt path at
which the exact proposed `RES-…` row exists at the maker checkpoint; it
is fixed from proposal through acceptance for that resolution version.
The former
composite `Independent acceptance commit/receipt` field is **abolished**
and split into typed, individually validated fields. `Accepted checkpoint
commit` is the full 40-hex maker checkpoint whose RES content the checker
reviewed. `Acceptance receipt commit` is the later full 40-hex checker
commit containing the receipt; separating the two avoids the impossible
requirement that a Git blob contain the hash of its own commit.
`Acceptance receipt` is the receipt path at the receipt commit or `—`
while unaccepted; `Accepted RES version` is the integer version of this
resolution that the checker accepted, or `—`; `Accepted content digest`
is the 64-lowercase-hex SHA-256 of the resolution's **binding content**
— the `"|"`-joined serialization of (`Blocked finding ID`,
`Proposed outcome`, `Resolver authority`, `Maker/proposer identity`,
`Independent checker identity`, `Proposal receipt path`, `Reopening
condition`, `Limitations`) —
that the checker accepted, or `—`; `Accepted proposed outcome` is the
`Proposed outcome` value the checker accepted, or `—`. `Resolution
status` is the closed vocabulary `proposed` | `accepted` | `superseded`;
`Resolution version` is an integer from `1`; `Superseding/current
relationship` is `—` or `supersedes RES-<NNNN> per AMEND DR2-<NNNN>`.

**Governed acceptance-receipt record (binding; parseable; added
R2.10 — acceptance evidence must be *resolved and read*, never
asserted).** The pre-R2.10 gate treated the `Acceptance commit` and
`Acceptance receipt` cells as evidence merely by being *shaped* like a
commit SHA and a path. Nothing required the commit to exist, the path
to exist at it, or any receipt to say anything — so a repeated-digit
SHA and a nonexistent file cleared a block, and the digest the gate
compared against was itself a cell the maker wrote. Acceptance is
therefore now carried by a **separate record living in the checker's
receipt at the acceptance commit**, outside the maker's later control.

Under the pinned heading **`## Independent acceptance record`**, an
acceptance receipt carries one parseable row per accepted resolution:

`Resolution ID | Accepted RES version | Accepted content digest | Accepted proposed outcome | Maker/proposer identity | Independent checker identity | Accepted checkpoint commit | Acceptance verdict`

— `Acceptance verdict` is the closed vocabulary `ACCEPT` | `REJECT`.
Binding rules: the receipt row is **immutable evidence at its commit**
and carries that full 40-hex `Accepted checkpoint commit` explicitly. Exactly one
row for a resolution may appear in the resolved receipt; duplicate rows
fail even if identical. The row's accepted checkpoint must equal the
resolution's `Accepted checkpoint commit`; the blob itself is read at the
separate `Acceptance receipt commit`.
The digest recorded here is the digest the checker recorded as accepted,
fixed at that commit and outside the maker's later control.

**Independent-acceptance gate (binding; proposal precedes acceptance,
and acceptance is bound to the exact current resolution and resolvable,
parsed evidence — corrected R2.12).**

1. A resolution is `accepted` **only** when **all structural checks
   hold**: (a) its checker and maker fields are nonblank, conform to the
   verifier grammar, and are not string-identical; (b) both checkpoint
   and receipt commits are full 40-hex SHAs that resolve in the governing
   repository, the receipt commit descends from the maker checkpoint, and
   the maker checkpoint contains `Proposal receipt path` as a blob whose
   `## Resolutions` table has the exact governed header and exactly one row
   for this resolution; that checkpoint row is `proposed`, has this same
   resolution ID/version, blocked-finding backlink, outcome, authority,
   maker, checker, proposal path, reopening condition, limitations, and
   superseding relationship, and carries `—` in every later acceptance
   field. An absent, duplicate, wrong-path, already-accepted, or
   content-mismatched checkpoint proposal fails. `Acceptance receipt` is
   a path that exists at the receipt commit, and the blob at that path
   **parses** and carries an `## Independent acceptance record` row for
   this exact `Resolution ID` whose `Acceptance verdict` is `ACCEPT` and
   whose `Accepted RES version`, `Accepted content digest`, `Accepted
   proposed outcome`, `Maker/proposer identity`, `Independent checker
   identity`, and `Accepted checkpoint commit` are **each string-identical** to
   the resolution row's corresponding current values; and (c) the
   acceptance is bound to **this exact current resolution** —
   `Accepted RES version` equals the record's current
   `Resolution version`, `Accepted content digest` equals the
   **recomputed** SHA-256 of the record's current binding content, and
   `Accepted proposed outcome` equals the record's current
   `Proposed outcome`. **A maker can never self-accept or clear its own
   blocked finding**, and a **nonexistent, unresolvable, blank,
   unrelated, stale, rejected, or superseded** acceptance — an
   unresolvable commit, a receipt path absent at that commit, a receipt
   carrying no matching row, a `REJECT` verdict, or a mismatched
   accepted version, digest, outcome, maker, checker, or checkpoint
   proposal — never clears a
   block. More than one matching receipt row fails. Because (b) reads
   the digest **out of an immutable receipt at
   a pinned commit** and (c) **recomputes** the digest from the
   resolution's current content, a maker who later changes the proposed
   content and rewrites the matching digest into its own row breaks the
   comparison against the receipt and fails: digest substitution is
   mechanically rejected. These checks establish a structurally resolved
   and content-bound acceptance record and prevent a later tree from
   retroactively authorizing content absent from the maker checkpoint.
   The independent checker
   remains responsible for determining whether the recorded checker
   truly did not author the maker content and exercised independent
   judgment.
2. A `BLK-…` finding becomes `resolved` **only** when its `Resolution
   ID` names a **current** `accepted` resolution satisfying (1);
   otherwise it stays `open`, fails U7, and stops the unit.
3. Construction resumes only after the accepted resolution and every
   required same-commit reference update are in place.
4. A whole valid, in-scope, unsupported substantive obligation stays
   blocked until one governed resolution route is independently
   accepted. It can never escape as `unsupported-residual`,
   `no-successor`, `process-only`, `obsolete`, `invalid` merely because
   authority was not located, or an unstructured waiver/adjudication
   statement.
5. The distinction is preserved: a **false** historical
   authority/enforceability assertion may be `invalid` (§15.9.3
   kind-separation), but a **substantive mechanic that is unsupported
   but not thereby invalid** is blocked, never invalid.
6. **SXW2 policy (binding; resolves the pre-R2.9 contradiction).**
   A `blocked-unsupported-obligation` finding is **never** `SXW2`: the
   blocking outcome concerns obligation ownership — an `XW2-DISP`
   historical-LEAF fragment, or a `candidate-obligation` newly
   discovered in-scope obligation with no historical LEAF. A scenario
   disposition is only `invalid`/`no-successor` and **never** blocks (a
   scenario that none of the seven `SXW2-…` types can honestly
   disposition returns to a foundation amendment per §15.9.8 — never a
   `BLK-…`). SM2/SS2 search-set machinery is therefore **XW2-only**,
   consistent with §15.9.8's rule that scenario fragments use no
   SM2/search-set machinery; the BLK, SM2, and SS2 subject-class
   vocabularies carry **no `SXW2-DISP` value** (the `DISP` detail schema
   keeps `SXW2-DISP` — scenario terminal dispositions still take `DISP`
   records, with `—` search fields).
7. `BLK-…`/`RES-…` records are an `AMEND`-governed live population:
   open/current/resolved status, finding/resolution version, direct
   current references, and one current accepted resolution per chain are
   enforced by U7, `G15R`, G15, and R9 (§15.9.9).

Completeness duty: every valid in-scope obligation of any authority class
(CBA, BYL, NBA, DERIVED, INFERRED, OPS, or EXT) discovered during R3–R6
**for which qualifying authority (§15.9.5–§15.9.6) is located** has an
active v2 owner. A valid in-scope residual fragment (with a supported
sibling) whose qualifying authority is not located in the searched
sources after the required `SM2-…` searches is dispositioned by a
terminal `unsupported-residual` edge and preserved as a discovery
candidate — never silently dropped, never registered without authority,
and never left as undispositioned prose on another edge. A **wholly**
unsupported valid in-scope obligation triggers the
`blocked-unsupported-obligation` stop condition above — it is never
forced into `no-successor`, `invalid`, or `unsupported-residual`, and
never silently dropped.

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
entry resolves to an existing edge); nonterminal duplicate-pair (no two
edges share the same historical LEAF and target — exactly one primary
relationship type per source–target pair); **terminal uniqueness on the
corrected key** (no two terminal edges share the same historical source
LEAF and fragment ID; two different terminal fragments of one LEAF
coexist even though both targets are `—`); valid-target; complete
historical coverage; **fragment-inventory reconciliation** (the complete
per-LEAF contract above — exhaustive declared decomposition, pairwise
non-overlap, no silent residual, exactly-once disposition, bidirectional
edge ⇔ fragment resolution, zero orphan fragments, zero edges naming an
unregistered fragment, kind ⇔ edge-type compatibility, and the recorded
semantic exhaustiveness review); terminal-edge validation (terminal
type ⇔ `—` target, each edge carrying a **direct reference to a
current, correctly typed `DISP` record** with its pinned detail row —
never a reference that resolves only through an `AMEND` chain to a
superseded record; the committed pre-R2.7 records are a known,
backlogged nonconformity that R3.1 must cure, never a permitted end
state); no-successor validation (every `no-successor` edge satisfies
the narrow rule above, with the scope/edition basis recorded);
unsupported-residual validation (every `unsupported-residual` edge
satisfies the narrow rule above — exact residual-fragment scope with a
supported sibling fragment on the same historical LEAF, the required
`SM2-…` search records, the preserved-candidate anchor, and the direct
current `DISP` reference); and blocking-outcome validation (zero
terminal edges recorded for a wholly unsupported valid in-scope
obligation — any such obligation appears only as a
`blocked-unsupported-obligation` finding with its unit stopped).

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
decision: an ownership decision (`OWN`) stating **which tiebreak
selected the owner and why**, or — only where the candidate's honest
resolution selects no active owner — a terminal `DISP` decision under
the OWN/DISP boundary below.

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
remains semantic. Every candidate receives an `OWN` disposition — or a
`DISP` disposition where its honest resolution is terminal (OWN/DISP
boundary below). The unit
receipt records the candidate population per generator and demonstrates
**zero undispositioned in-scope candidates**. A candidate may be deferred
only with both families and the expected resolving unit named in the
receipt; identical family tokens additionally require the complete
same-family sibling exception in §15.9.3. G9 reruns a global cross-family candidate sweep and
requires zero unresolved candidates; R9 independently regenerates the
candidate population rather than trusting the unit lists.

**Decision-record schemas.** Decision records are parseable rows in the
performing unit's receipt:

`DR ID | Type | Subject(s) | Disposition | Test/tiebreak applied | Rationale | Resulting active LEAF(s) or — | Unit/commit`

`Type` is exactly one of `OWN`, `ATOM`, `TG`, `MOVE`, `ORIGIN`,
`METHOD`, `AMEND`, or `DISP`.

All eight fields are required. Only `Resulting active LEAF(s) or —` may
be exactly `—`; every other field is nonblank and non-dash. Every record
ID appearing in any field must resolve in the governed document tree,
and every resulting active LEAF reference must resolve to the active
register. `Unit/commit` is `<R-unit> / <commit reference>`, where the unit
is `R<n>` or `R<n>.<n>` and the right side is a full commit SHA, `this
checkpoint`, or an explicitly labeled temporary control. These are
mechanical minima only. Whether the stated rationale is persuasive,
whether the tiebreak is the right one, whether the atomicity judgment is
sound, and whether ownership is correct are independent-checker duties.

| Type | Used for | Required content |
|---|---|---|
| `OWN` | Duplicate ownership among candidate active owners — an active owner is always selected (or a named governed deferral recorded under §15.9.3, including only its sole same-family sibling exception); `OWN` never records a terminal no-owner disposition (that is `DISP`) | The full candidate set; the owner selected or prospective natural owner; which tiebreak discriminated and why; the crosswalk edges recorded for the non-owners; for the same-family exception, `Test/tiebreak applied` is exactly `same-family-sibling:<XW2-edge>-><active-v2-LEAF>; natural-family:<family>; resolving-unit:R<n>` and the checker separately judges the semantic inventory/natural-owner claims |
| `ATOM` | Atomicity keep/split | The GIVEN/WHEN/THEN restatement; for a split, the fragment list; for the homogeneous-list exception, the explicit justification and the all-element evidence pointer |
| `TG` | True gaps | The historical gap note; the real obligation exposed; the minted LEAF; its certification evidence |
| `MOVE` | Re-parenting/movement | The historical home; the active family/parent chosen; the family-test rationale; the `moved` crosswalk edge |
| `ORIGIN` | Newly-certified origin | Why no historical predecessor exists; the primary-source basis for minting |
| `METHOD` | R7 bounded method-fit corrections (§15.9.8) | The LEAF; the old method set (primary and secondaries); the new method set; why the previous method assignment was dishonest; the resulting evidence requirement |
| `AMEND` | Draft correction of any earlier-registered live v2 record — active GROUP/LEAF rows, `XW2-…` edges, `SRC2-…` source/provenance records, `EV2-…` components, active `CBA2-SC-…` scenarios/named cases, `SXW2-…` edges, and `DR2-…`/`AMEND` records (§15.9.2) | The record population/type; the prior checkpoint commit and prior DR IDs where applicable; the old ID/version; the current ID/version or removal disposition; the reason; confirmation that every live crosswalk/evidence/origin/method/scenario/dependency reference was updated in the same commit; the superseding disposition that replaces the prior live one |
| `DISP` | Terminal dispositions — the `process-only`, `invalid`, `no-successor`, and `unsupported-residual` crosswalk edges (§15.9.3; SXW2 analogously within its own pinned `invalid`/`no-successor` vocabulary), which intentionally select **no active owner** | The generic row above **plus one pinned `DISP` detail row per covered terminal edge** under the fixed **polymorphic** detail schema below (each row one tagged subject variant — `XW2-DISP` or `SXW2-DISP`); prose in the generic row never substitutes for a pinned detail field. One `DISP` record may cover multiple edges (multiple detail rows) only where their terminal bases are **exactly equal under the terminal-base-equality rule below** **and share one subject class**, with every covered edge ID listed |

**AMEND detail schema (binding; cross-population lineage, added
R2.11).** A generic `AMEND` row is accompanied under the pinned heading
`## AMEND detail rows` by one or more rows:

`AMEND record ID | Population | Prior record ID | Prior version or — | Prior checkpoint commit | Action | Current record ID(s) or — | Current version(s) or — | Reason`

AMEND population and action vocabularies: `Population` is one of
`GROUP`, `LEAF`, `XW2`, `SRC2`,
`SRC2-date-component`, `EV2`, `CBA2-SC`, `SXW2`, `DR2`, `DISP`,
`fragment`, `scenario-fragment`, `BND`, `SM2`, `SS2`, `BLK`, or
`RES`. Action is one of `revise`, `replace`, `split`, `merge`, or
`remove`.
The AMEND parent, prior checkpoint, prior identity/version, action, and
current identity/version fields are structurally validated; every named
identity resolves either in the pinned prior checkpoint or the current
tree; current IDs are direct references; duplicate prior-lineage rows,
cycles, branches outside an explicit split/merge, version regression,
and a superseded record with no current successor/removal fail. Content
preservation across a split/merge and the adequacy of the reason remain
independent-checker judgments. No validator may infer lineage merely
because an ID happens to occur in free prose.

**Mechanical version-lineage rule (binding; R2.12).** For exactly the five
support populations reviewed here — fragment, scenario-fragment, `BND-…`,
`SM2-…`, and `SS2-…` — a first-mint current record starts at version `1`.
A current version greater than `1` is valid only when a structured `AMEND`
detail row for that same population and stable identity records action
`revise`, the immediately prior positive-integer version, and the current
version exactly one greater. The row's `Prior checkpoint commit` must resolve,
the validator must parse that exact governed population at that checkpoint,
and the same identity must exist there at the recorded immediately prior
version. A replacement/split/merge successor with a new identity begins at
`1`. A bare version jump, a skipped version, a fictitious checkpoint version,
or a prose claim without the matching structured AMEND row fails. Pre-existing
lineage duties for other populations remain governed by their own contracts;
this R2.12 rule neither expands nor weakens them.

**`DISP` detail schema (binding; fixed, parseable, and polymorphic by
tagged subject class — R2.8).** Every current `DISP` record carries, in
the performing unit's receipt, exactly one pinned detail row per covered
terminal edge, joinable to the generic `DR2-…` row on the record ID.
The subject of a terminal disposition is either an **XW2 historical-LEAF
fragment** or an **SXW2 historical-scenario fragment**; because a
scenario is not a LEAF, one flat LEAF-only schema could not represent an
SXW2 subject at all (the R2.7 defect). The schema is therefore a single
**explicitly tagged polymorphic** row carrying one of two **mechanically
exclusive subject variants** — `XW2-DISP` or `SXW2-DISP` — with `—` in
every field of the non-selected variant:

`DR2 record ID | DISP subject class | Historical source LEAF or — | Historical fragment ID or — | Historical scenario or — | Scenario fragment ID or — | Normalized scope | Terminal edge ID | Terminal edge type | Search-manifest IDs or — | Search-set ID or — | Evidence/provenance references or — | No-owner reason | Preserved candidate anchor or — | Limitations | Reopening condition | Superseding/current relationship or — | Status | Version`

The `Normalized scope` field is added by R2.9: the pre-R2.9 schema
demanded bidirectional equality across the subject's normalized scope
and no-owner-reason basis while carrying **no field** for the scope, so
that equality was not mechanically joinable. It is now an explicit
pinned field (grammar below), and the `No-owner reason` field carries
the basis — so every element of the equality tuple is a real,
joinable column, not an invented rule.

Field grammars and `—` rules (all binding):

- `DR2 record ID` — `DR2-<NNNN>`; the row's one current generic parent.
- `DISP subject class` — closed vocabulary, exactly one: `XW2-DISP` |
  `SXW2-DISP`. It selects which subject fields are required and which
  are forbidden-to-`—`, and it must agree with the register of the
  terminal edge (an `XW2-…` edge ⇒ `XW2-DISP`; an `SXW2-…` edge ⇒
  `SXW2-DISP`).
- **`XW2-DISP` subject fields:** `Historical source LEAF` required (a
  published v1.1 LEAF ID, §15.9.1); `Historical fragment ID` required
  (the §15.9.3 fragment-ID grammar `<historical LEAF ID>:F<n>`, and it
  must belong to the named LEAF); `Historical scenario` and
  `Scenario fragment ID` **forbidden — each exactly `—`**.
- **`SXW2-DISP` subject fields:** `Historical scenario` required (the
  canonical historical-scenario identifier `scenario-<n>`, §15.9.8);
  `Scenario fragment ID` required (the §15.9.8 scenario-fragment grammar
  `scenario-<n>:F<m>`, and it must belong to the named scenario);
  `Historical source LEAF` and `Historical fragment ID` **forbidden —
  each exactly `—`**.
- `Normalized scope` — required, never `—`: the §15.9.3 normalized
  fragment scope of the subject fragment, in the single-coordinate
  `span:<a>-<b>` text-span grammar (§15.9.3, as corrected R2.9), and it
  must be **exactly equal** (canonical merged span-set equality) to the
  fragment scope named in the terminal edge's Scope/relationship column.
  This is the joinable field the equality tuple below requires.
- `Terminal edge ID` — exactly one edge ID of the register the subject
  class names: an `XW2-…` ID for `XW2-DISP`, an `SXW2-…` ID for
  `SXW2-DISP`.
- `Terminal edge type` — for `XW2-DISP`, one of `process-only`,
  `invalid`, `no-successor`, `unsupported-residual`; for `SXW2-DISP`,
  one of `invalid`, `no-successor` (SXW2's only terminal types,
  §15.9.8; `unsupported-residual` is deliberately not an SXW2 type and
  may never appear on an `SXW2-DISP` row).
- `Search-manifest IDs` — `SM2-…` IDs under the §15.9.6 reference
  grammar (`", "`-separated, ascending, no duplicates). **Never `—`
  for `unsupported-residual`** (the required §15.9.6 search set must
  be listed); `—` for `process-only`, `invalid`, and `no-successor`,
  whose bases do not rest on an authority search — so an `SXW2-DISP`
  row is always `—` here.
- `Search-set ID` — the `SS2-…` search-set/coverage record (§15.9.6)
  binding the required source classes behind an `unsupported-residual`
  disposition; **never `—` for `unsupported-residual`**, `—` otherwise.
- `Evidence/provenance references` — `SRC2-…`/`EV2-…` IDs under the
  same reference grammar, or `—` where the basis rests on no such
  record (e.g., a `process-only` character determination); never `—`
  for `invalid` where the falsity is shown against an identified
  source.
- `No-owner reason` — closed vocabulary, exactly one, and it must be the
  one the edge type requires: `false-claim` (`invalid`) |
  `process-material` (`process-only`) | `out-of-scope-or-obsolete`
  (`no-successor`) | `authority-not-located` (`unsupported-residual`,
  `XW2-DISP` only).
- `Preserved candidate anchor` — a canon anchor (e.g., `§12.12`);
  **never `—` for `unsupported-residual`**; for other types, `—` only
  where no discovery candidate is preserved.
- `Limitations` — required; state `none` expressly if none.
- `Reopening condition` — required; the exact condition under which
  the disposition is superseded (for `unsupported-residual`, the
  §15.9.3 reopening rule).
- `Superseding/current relationship` — `—` for a first-mint current
  record; otherwise `supersedes DR2-<NNNN> per AMEND DR2-<NNNN>`
  naming the superseded record and the `AMEND` record.
- `Status` — closed vocabulary: `current` | `superseded`. Live
  registers cite only `current` rows.
- `Version` — an unpadded positive integer, starting at `1`,
  incremented by the `AMEND` chain.
- Within any multi-value field, the §15.9.6 delimiter rules apply; an
  empty permitted field is exactly `—`; a required-but-unknown field
  fails the record.

**Subject-family exclusivity, equality, and grouping (binding — exact
joins, corrected R2.10).**

**(a) Edge ⇔ detail agreement tuple (only fields both structures
actually carry).** The pre-R2.10 wording demanded agreement across a
tuple that included `Status` and `Version` and called every element "a
real field of the detail row **and the edge's register**" — but the
§15.9.3 `XW2-…` and §15.9.8 `SXW2-…` edge schemas carry no status or
version column, so that clause ordered a join against fields that do not
exist. The agreement tuple is therefore exactly **(subject class —
implied by the edge's register, `XW2-…` ⇒ `XW2-DISP`, `SXW2-…` ⇒
`SXW2-DISP`; historical LEAF or historical scenario — the edge's source;
fragment ID — the edge's pinned leading fragment token; `Normalized
scope` — the fragment scope named in the edge's Scope/relationship
column; terminal edge ID; terminal edge type — the edge's Edge type;
generic `DR2-…` parent — the edge's Decision record)**. Every element of
that tuple **is** a real column of both the detail row and the edge row,
and the edge and the detail row must agree on every element, in both
directions (`Normalized scope` by canonical span-set equality, every
other element by exact string equality). `Status` and `Version` are
fields of the **detail row only**; the edge's obligation with respect to
them is the separate direct-current-reference rule — the edge's Decision
record must name a `DISP` record whose detail row is `current`, never a
`superseded` row and never a reference resolving only through an `AMEND`
chain.

**(b) Uniqueness/grouping keys.** An `XW2-DISP` terminal disposition
is unique per **(historical source LEAF, historical fragment ID)**; an
`SXW2-DISP` terminal disposition is unique per **(historical scenario,
scenario fragment ID)**; and at most one current `DISP` detail row
exists per terminal-subject key **and** basis (no-owner reason).

**(c) Terminal-base equality (exact; corrected R2.10; replaces the
abolished "demonstrably identical" reviewer judgment).** Two covered
detail rows have equal terminal bases **iff all** of the following hold:

1. They are **string-identical** on `DISP subject class`,
   `Terminal edge type`, and `No-owner reason`.
2. They are **string-identical on the complete subject** — for
   `XW2-DISP`, on both `Historical source LEAF` **and**
   `Historical fragment ID`; for `SXW2-DISP`, on both
   `Historical scenario` **and** `Scenario fragment ID`. Two rows whose
   **fragments differ are never terminal-base-equal**, whatever else
   they share.
3. They are **canonical-span-set-equal** on `Normalized scope`.
4. They carry **identical** `Search-manifest IDs`, `Search-set ID`, and
   `Evidence/provenance references` sets.
5. They are **string-identical** on `Preserved candidate anchor`,
   `Limitations`, and `Reopening condition` — the fields that state the
   disposition's destination and its exit condition. Two rows whose
   **destinations differ are never terminal-base-equal**.

The pre-R2.10 rule omitted elements 2 and 5, so it contradicted its own
worked transition example (§15.9.4 below, which holds that `XW2-0006`
and `XW2-0012` are **not** terminal-base-equal precisely because their
fragments and destinations differ). Elements 2 and 5 close that
contradiction; the rule and the example now agree mechanically. One
`DISP` record may cover multiple detail rows **only** where those rows
share **one** subject class **and** are terminal-base-equal by that
exact five-part rule, with every covered edge ID listed; an `XW2-DISP`
record never carries an `SXW2-DISP` row and vice versa
(**subject-family mismatch is prohibited**). Otherwise distinct
dispositions take distinct records.

**Edge-type ⇔ decision-type compatibility matrix (binding):**

| Edge / reference | Required decision record | Required no-owner reason | Forbidden |
|---|---|---|---|
| Terminal `process-only` | Current `DISP` (direct reference) | `process-material` | `OWN`, `ATOM`, `MOVE`, `ORIGIN`, `TG`, `METHOD`, any superseded record |
| Terminal `invalid` | Current `DISP` (direct reference) | `false-claim` | Same |
| Terminal `no-successor` | Current `DISP` (direct reference) | `out-of-scope-or-obsolete` | Same |
| Terminal `unsupported-residual` | Current `DISP` (direct reference) with `SM2-…` IDs and a preserved-candidate anchor | `authority-not-located` | Same |
| Nonterminal edge or register decision reference | The correct current non-`DISP` type (`OWN`/`ATOM`/`TG`/`MOVE`/`ORIGIN`/`METHOD` per its §15.9.4 role) | — | Any `DISP` record; any superseded record |

**Cross-field and reconciliation requirements (binding; checked at the
§15.9.9 gate points):**

1. Every terminal `XW2-…` or `SXW2-…` edge references a **direct,
   current `DISP` record**. No live edge may rely on an old decision
   reachable only through an `AMEND` chain: when `AMEND` supersedes a
   decision, every live reference is updated to the new current record
   **in the same commit**, and the chain exists for lineage only.
2. Every nonterminal decision reference resolves to the correct
   current decision type per the matrix above.
3. Subject agreement is **bidirectional and subject-class-tagged**: the
   detail row's `DISP subject class`, subject (historical LEAF +
   historical fragment ID for `XW2-DISP`, or historical scenario +
   scenario fragment ID for `SXW2-DISP`), edge ID, normalized scope, and
   terminal type agree with the edge's register (`XW2-…`/`SXW2-…`),
   source, leading fragment token, type, and decision reference — and
   the edge agrees back with the detail row. An `XW2-…` edge resolves
   only to an `XW2-DISP` row and an `SXW2-…` edge only to an `SXW2-DISP`
   row (**subject-family mismatch fails**).
4. Every current `DISP` detail row has **exactly one current generic
   `DR2-…` parent**, and every current terminal edge has its required
   current `DISP` detail row of the matching subject class.
5. Zero orphan current `DISP` or decision records (a current record no
   live edge or register row references), and zero stale live decision
   references (a live reference to a superseded record or version).
6. No duplicate decisions: at most one current `DISP` detail row per
   terminal-subject key **and** basis — the key being (historical source
   LEAF, historical fragment ID) for `XW2-DISP` and (historical
   scenario, scenario fragment ID) for `SXW2-DISP`.

**OWN/DISP boundary (binding).** `OWN` adjudicates which active LEAF
owns an obligation: its required content — the full candidate set, the
selected owner, and the discriminating tiebreak — is meaningful only
when an active owner (or a named governed deferral under §15.9.3) results. `DISP`
records the opposite outcome: a terminal disposition that intentionally
selects no active owner. From R2.6 forward, **every terminal crosswalk
edge carries a direct reference to a current `DISP` record with its
pinned detail row**, and `OWN`/`ATOM` records never
carry terminal no-owner dispositions. `DISP` can never replace `OWN`
for competing active owners: a `DISP` record contains no ownership
tiebreak and selects no owner, so using it where candidates compete
would leave the ownership question unadjudicated — every duplicate
candidate whose honest resolution selects an owner still requires
`OWN`. Within `DISP`, the four terminal types stay distinct: `invalid`
(the historical claim was false), `process-only` (process/instruction
material), `no-successor` (valid history, demonstrably out of scope or
obsolete for the governed edition), and `unsupported-residual` (valid
in-scope residual fragment; qualifying authority not located in the
searched sources — §15.9.3).

**Committed pre-R2.7 terminal records (transition — defined here,
applied by R3.1, never by R2.6/R2.7).** The R3 checkpoint carried its
terminal `invalid` and `process-only` dispositions on `OWN`/`ATOM`
records because the then-closed type vocabulary contained no
terminal-disposition type; those records are retroactively mistyped.
The committed population is exactly: `DR2-0037` (`OWN`; the
`CBA-A15.1`–`CBA-A15.5` terminal `invalid` edges), `DR2-0038` (`OWN`;
the `CBA-A17.3`/`CBA-A17.4`/`CBA-A17.7` terminal `invalid` edges), and
`DR2-0039` (`ATOM`; the `CBA-A02.3` and `CBA-A02.6` terminal
`process-only` edges `XW2-0006` and `XW2-0012`). The owning repair
unit (R3.1) supersedes each terminal disposition through `AMEND`
lineage (§15.9.2): it mints properly typed current `DISP` records —
with their pinned detail rows — at new `DR2-…` IDs allocated above the
namespace's committed high-water mark, records one `AMEND` per
superseded record naming the prior checkpoint and the superseding
disposition, and updates every live crosswalk-edge Decision record
reference **to the new current `DISP` record directly, in the same
commit**. For `DR2-0039`, R3.1 must compare the two `process-only`
edges (`XW2-0006` and `XW2-0012` — different fragments, characters,
and destinations) and use **separate `DISP` records unless their
terminal bases are exactly equal under the terminal-base-equality rule
above** (they are not — different fragments and destinations);
`DR2-0039`'s `ATOM` (atomicity) content is preserved only
where it remains separately valid as an atomicity decision. The
immutable R3 receipt is never edited; no committed `DR2-…` ID is
renumbered or reused. Until R3.1 lands, the committed records are a
known, backlogged nonconformity — never a permitted end state — and
after R3.1 every live terminal edge must satisfy the direct
current-`DISP` reference rule above with zero references resolving
only through `AMEND` chains. Unit-local validation (U5/U7), the
repair-local gate `G15R` (§15.9.9), the global gates (G3/G15), and R9
verify terminal-edge `DISP` typing and direct current references.

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
- **A18.7 — conditional cash (as corrected by R2.7):** signed CBA VII
  §8(a) (p. 260) **expressly** establishes only the general rule: the
  separate annual cash paid/received limits, the direct-or-indirect
  trade connection ("in connection with one (1) or more trades
  occurring during a Salary Cap Year, directly or indirectly"), and the
  no-netting rule — that general rule is **CBA**. **Applying** the
  general rule to conditional cash tied to a pick — including charging
  the trade's Salary Cap Year despite a later payment date — is **not
  itself express text**: it is a legal inference from the quoted
  connection-and-timing language and requires a **separately
  identified INFERRED reasoning chain** (controlling locators plus the
  stated inference, never presented as express source language). The
  committed R3 rows that state the conditional application as express
  CBA are repaired by R3.1 through `AMEND` lineage (active-row and
  evidence reclassification). The re-trade attribution/accounting
  mechanics remain a further, separate residual: they become an active
  v2 LEAF **only if qualifying authority is located** — OPS only with
  real first-party operational provenance, INFERRED only with a
  controlling source chain (no such chain completes from VII §8(a));
  the former DERIVED/OPS composite is rejected. The bounded
  primary/first-party searches recorded in the R3, R2.6, and R2.7
  receipts located **no qualifying authority in the searched sources**;
  the residual fragment is therefore dispositioned by a terminal
  `unsupported-residual` crosswalk edge with a current `DISP` record
  and its required `SM2-…` search records (§15.9.3–§15.9.4/§15.9.6)
  and remains a preserved discovery candidate (§12.12) — applied to
  the committed R3 records by R3.1 through `AMEND` lineage, and
  superseded per the §15.9.3 reopening rule if qualifying authority is
  later obtained.

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

Base table (one row per record; all fifteen fields present; `—` only
where the per-type validity matrix below permits):

`Record ID | Provenance type | Source/provenance identity | Source date (basis:value) or — | Official URL or — | Artifact SHA-256 or — | Artifact byte size or — | Retrieval timestamp or — | Authentication timestamp or — | Verifier identity | Verification session ID | Verification date | Record limitations | Record status | Record version`

**`Artifact byte size` (added R2.10; the field without which the
SM2 ⇔ current-`SRC2` reconciliation was impossible).** The
search-manifest contract below requires every current artifact-bearing
`SM2-…` record's `Binary size bytes` to equal "that record's recorded
byte size" — but no `SRC2-…` field carried a byte size, so the required
equality had no governed counterpart and could not be checked at all
(it could only be faked against a validator's private table). `Artifact
byte size` is that counterpart: the durable artifact's size in bytes as
an **unpadded positive integer**, `—` **only** where `Artifact SHA-256`
is also `—` (no durable artifact exists). The two artifact fields are
governed together: **if durable bytes exist, both the SHA-256 and the
byte size are mandatory**, and a record carrying one while omitting the
other is malformed and fails. Migration of the committed
`SRC2-001`/`SRC2-002`/`SRC2-003`/`SRC2-004` base rows to the
fifteen-field base schema is an **R3.1 `AMEND` duty** (repair-plan item
24) — R2.10 amends no committed record, so the committed four-record
population remains a known, backlogged legacy nonconformity exactly as
it is for the abolished composite fields below.

The former composite `Record status/version` base field is **abolished**:
a single field mixing lifecycle status and version could not be
independently parsed, and status and version are separately gated
(status selects live rows; version drives `AMEND` supersession). Its
content is carried by the two split fields above: `Record status` is
the closed vocabulary `current` | `superseded` (live registers cite
only `current` rows), and `Record version` is an unpadded positive
integer from `1`, incremented by the `AMEND` chain. A base row that
still uses the composite `Record status/version` field — or any single
field mixing status and version content — is malformed and fails.

The former composite `Verifier/session/date` field is abolished: it was
not mechanically parseable. Its content is carried by the three split
verification-metadata fields above (`Verifier identity`,
`Verification session ID`, `Verification date`), each with its own
pinned grammar below. A base row that still uses the composite field —
or any single field mixing verifier, session, and date content — is
malformed and fails.

The former slash-combined `Publication/effective date` field is
likewise **abolished**: a bare date under a "Publication/effective"
label asserts two different semantic claims at once and lets neither be
validated — the committed `SRC2-001` value (`2023-06-28`, actually the
agreement-as-of date of a source whose cover carries the edition month
JULY 2023 and whose stated effective date is 2023-07-01) and the
committed `SRC2-002` value (a metadata-derived `2024-06-07` for a
month-identified edition) are both false under it. Its position is
carried by the fourth base field, `Source date (basis:value)`, under
the **source-date model** below. A base row that records a bare date
with no basis, or a basis the source does not support, is malformed
and fails.

**Source-date model (binding; value and basis always separate,
machine-parseable components):**

- **Field grammar.** The base `Source date` field is exactly
  `<basis>:<value>` — one basis token, one ASCII colon, one value — or
  exactly `—`. A lone value, a lone basis, `<basis>:—`, or `—:<value>`
  is malformed. The pair states the record's **`primary` semantic date
  for its own basis**, and it must equal that basis's `primary`
  date-component row below. There is **one completeness rule, not two**:
  the date-component detail table below carries **exactly one row for
  every supported semantic date the record relies on — including this
  base pair's own date** — never a delimiter list or aligned prose. (The
  pre-R2.9 "further semantic date"/"more than one date" phrasing created
  a competing completeness standard and is abolished.)
- **Closed date-basis vocabulary (exactly one per pair):**
  `publication` (the source states its own publication date);
  `effective` (the source states the date or window on which it takes
  effect); `edition` (the source identifies an edition — e.g., a cover
  month or an annual season — without stating a publication or
  effective date); `agreement-as-of` (the source states the date as of
  which it was entered into or agreed). `—` is not a basis token; it
  is the whole-field empty value under the per-type matrix below.
- **What a basis may never claim.** A date value establishes only its
  own basis. An **edition identifier is never recorded as
  `publication` or `effective`** — a cover reading "JUNE 2024"
  supports exactly `edition:2024-06` and nothing more; `2024-06` may
  represent the June 2024 By-Laws **only** with basis `edition`. PDF
  creation/modification metadata, URL path segments, HTTP headers or
  timestamps, retrieval timestamps, authentication timestamps, and
  inference can establish **no** basis's value: a `publication` or
  `effective` value is valid only where the identified authority
  itself states that date.
- **Per-basis value grammars.** Exact dates are `YYYY-MM-DD` (real
  calendar dates). Month precision is `YYYY-MM` (four ASCII digits,
  one ASCII hyphen-minus, two ASCII digits `01`–`12`), valid for any
  basis **only** where the authoritative source itself supplies
  exactly a month for that basis, with the mandatory limitation entry
  under the month-precision rule below. A season under the pinned
  `YYYY-YY` season grammar is valid **only** with basis `edition` on
  an `official-mutable` record (a season-identified annual
  publication). `effective` additionally accepts the pinned window
  grammar (`YYYY-MM-DD/YYYY-MM-DD` or `YYYY-MM-DD/open`) where the
  source states a window. **Window endpoints must be valid and
  ordered:** in `YYYY-MM-DD/YYYY-MM-DD`, both endpoints are real
  calendar dates and the end date is **strictly later than** the start
  date; a reversed or equal-endpoint closed window (e.g.,
  `2023-07-01/2023-06-01` or `2023-07-01/2023-07-01`) is malformed and
  fails. In `YYYY-MM-DD/open`, the start is a real calendar date and
  `open` denotes an unbounded, always-ordered end. **Exact precision
  may never be degraded**: a
  stated exact day must be recorded `YYYY-MM-DD`; recording it as
  `YYYY-MM` fails the record.
- **Date-component detail table (fixed; joinable; stable-identity;
  required for every `SRC2-…` record — cardinality corrected R2.9):**
  **exactly one row per distinct supported semantic date the record
  relies on, including the date carried by the base `Source date` pair**
  (there is no "only when more than one date exists" trigger — the base
  pair's own date is always its `primary` component row of that basis).
  Rows live in the shared registries and carry a stable component
  identity so that multiple dates of the **same basis** with different
  roles/scopes are separately representable (the pre-R2.8
  "at most one current row per (Record ID, basis)" rule could not
  represent two effective dates):
  `Record ID | Date component ID | Date basis | Date role/scope | Date value | Source statement locator | Limitations or — | Component status | Component version | Superseding/current relationship or —`
  **Component lifecycle fields (added R2.10).** Date components are an
  `AMEND`-governed live population under §15.9.2 — the draft-mutability
  clause names `<Record ID>#D<k>` rows expressly, and `G15R`/G15/R9 all
  require exactly-one-current endpoints and zero stale references across
  them — yet the pre-R2.10 schema carried **no status, version, or
  superseding field**, so "the current component", "a superseded
  component", and "a stale reference to a superseded component" were
  not representable at all and could not be gated. The three fields
  close that gap and are governed exactly like their `SRC2-…` base
  counterparts: `Component status` is the closed vocabulary
  `current` | `superseded` (live registers, base `Source date` pairs,
  and every dependent reference cite **only** `current` rows);
  `Component version` is an unpadded positive integer from `1`,
  incremented by the `AMEND` chain; `Superseding/current relationship`
  is `—` for a first-mint current row, otherwise
  `supersedes <Record ID>#D<k> per AMEND DR2-<NNNN>` naming the
  superseded component and the `AMEND` record. Binding consequences:
  **exactly one current row per (Record ID, Date basis, Date role/scope)**
  and **exactly one current `primary` row per (Record ID, Date basis)**;
  every superseding relationship names an existing component of the same
  `Record ID` and an existing current `AMEND` `DR2-…` record; every
  supersession chain terminates in **exactly one** current component or
  an explicit removal; and a base `Source date` pair, `official-mutable`
  detail date/season, `SM2-…`, or any other live reference that resolves
  to a `superseded` component **fails** (stale reference). Migration of
  the committed records' date components to this schema is an R3.1
  `AMEND` duty (repair-plan item 24).
  Rules (all binding): `Date component ID` is `<Record ID>#D<k>` — the
  base Record ID, one ASCII `#`, one uppercase `D`, and an unpadded
  positive integer `k` allocated contiguously from `1`, append-only per
  §15.9.2 (never reused or renumbered); it is the row's **stable
  identity**, independent of basis and value. `Date basis` is from the
  closed vocabulary and `Date value` from that basis's grammar —
  **basis and value are always separate fields**. `Date role/scope` is a
  required, non-empty discriminator: exactly `primary` for the record's
  principal date under that basis (**exactly one `primary` row per
  (Record ID, basis)** the record supports), or `scoped:<slug>` for a
  further same-basis date the authority **expressly** supplies for a
  named provision-scope (`<slug>` is 1–64 ASCII characters, begins with
  a lowercase letter or digit, and contains only lowercase letters,
  digits, `.`, `_`, or `-`). The **uniqueness key is (Record ID, Date
  basis, Date role/scope)** — at most one current row per that triple,
  and no two current rows share a `Date component ID`; multiple current
  same-basis rows are valid **only** when their roles/scopes differ, so
  a duplicate or conflicting component (same basis and role/scope, or a
  second `primary` for one basis) fails the record. The base
  `Source date` pair must equal the record's **`primary`** row of that
  basis (the single authoritative representation); every supported
  semantic date the certifying agent relies on anywhere — including any
  `official-mutable` detail Publication/effective date or season — must
  reconcile to exactly one component row, never aligned prose, an
  ambiguous delimiter list, or a duplicated field that contradicts or is
  untied to the authoritative component. Illustrative only (no record is
  minted here): the signed CBA supports `agreement-as-of:2023-06-28`
  (`primary`; Article I §1(d)), `effective:2023-07-01` (`primary`;
  Article XXXIX §1), and `edition:2023-07` (`primary`; cover "JULY
  2023") — three distinct rows with distinct component IDs, which one
  value/basis pair cannot carry. Where an authority **expressly**
  supplies two dates of one basis — e.g., a general effective date plus
  a distinct earlier-commencement effective date for named provisions
  (Article XXXIX §1 reserves "provisions that the parties have
  specifically agreed herein will commence earlier") — they are two
  `effective` rows, one `primary` and one `scoped:<slug>`, which the
  pre-R2.8 one-row-per-basis rule could not represent.
- **Unchanged neighbors.** Retrieval timestamps, authentication
  timestamps, verifier identity, verification session IDs, and
  verification dates remain governed by their own accepted exact
  grammars below; none of them supplies, or substitutes for, any
  source-date value. Migration of the committed `SRC2-001`/`SRC2-002`
  base rows to this model is an R3.1 `AMEND` duty — R2.7 amends no
  committed record.

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
  document; Source date — a `<basis>:<value>` pair under the
  source-date model above, with every further supported semantic date
  carried in the date-component detail table — Official URL, Retrieval
  timestamp, and Artifact SHA-256 all **required** in the base row;
  Authentication timestamp `—` unless separately applicable)
- `official-mutable` detail (the former composite `Publication
  identity/date or season` field is **abolished** — it hid publication
  identity, a publication date, and an edition season in one slot,
  letting none be validated; it is split into the three separately typed
  fields below):
  `Record ID | Publication identity | Publication date or — | Season or — | Exact values or text relied upon | Archive/snapshot reference or —`
  (Official URL, Retrieval timestamp, and the retrieved-content
  SHA-256 all **required** in the base row; Authentication timestamp
  `—` unless separately applicable. `Publication identity` is the exact
  release/page identity, never `—`. **Exactly one** of `Publication
  date`/`Season` is populated and the other is exactly `—`:
  `Publication date` is a `YYYY-MM-DD` (or narrow-rule `YYYY-MM`)
  calendar date the publication itself states, and must equal the base
  row's `publication:<value>` primary component; `Season` is a
  `YYYY-YY` value under the pinned season grammar below and must equal
  the base row's `edition:YYYY-YY` primary component. Recording both, or
  neither, fails the record; a season here or in the base Source date
  field, valid only as `edition:YYYY-YY`, uses the pinned `YYYY-YY`
  grammar below and never any other season syntax)
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
must be real calendar dates (subject only to the narrow month-precision
source-date rule below, and — in the Source date field and
date-component detail table only — always paired with a basis token
under the source-date model above); effective windows are
`YYYY-MM-DD/YYYY-MM-DD` (both real calendar dates, end strictly later
than start) or `YYYY-MM-DD/open` (real start, unbounded end) — a
reversed or equal-endpoint closed window fails;
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

**Month-precision source dates (binding; narrow; basis-aware).** Where
the authoritative source itself supplies a given basis's date only to
**month precision** (e.g., a cover page reading "JUNE 2024" with no
exact day stated anywhere in the authority itself — which supports
exactly the basis `edition`), the value component of that basis's pair
carries exactly `YYYY-MM`: four ASCII digits, one ASCII hyphen-minus
`-` (`U+002D`), and two ASCII digits from `01` to `12`. A
month-precision value is valid **only** under all of the following
conditions:

1. The field is the base-table Source date field or the date-component
   detail table's Date value column, always inside a `<basis>:<value>`
   pair or basis-keyed row. No other field accepts `YYYY-MM`; a
   month-precision value anywhere else — or without a basis — is
   malformed.
2. The identified official source itself supplies exactly a month for
   that basis. Where the source states an exact day for the basis,
   `YYYY-MM-DD` is mandatory and `YYYY-MM` is malformed — recorded
   precision never degrades supplied precision, and the grammar never
   treats an approximate day as exact.
3. The basis is honest for what the source states: a cover or title
   month that merely identifies the edition supports **only**
   `edition:YYYY-MM` — never `publication:YYYY-MM` or
   `effective:YYYY-MM`. A `publication` or `effective` month is valid
   only where the source expressly states publication or effectiveness
   to month precision.
4. A day is never manufactured from PDF creation/modification metadata,
   URL path segments, HTTP headers or timestamps, retrieval timestamps,
   authentication timestamps, or inference. A day-precision value is
   valid only when the identified official source itself states that
   exact day for that basis; a metadata-derived day is a fabricated
   semantic claim and fails the record.
5. The record's Record limitations field expressly states that the
   source supplies month precision only for that basis (e.g., `edition
   identified by the source to month precision only`). A
   month-precision date without this limitation entry is malformed.

The retrieval-timestamp, authentication-timestamp, and
verification-date requirements are unchanged: they remain
full-precision values under their own grammars and never substitute
for, or supply a day to, any source-date value. The month grammar and
the `YYYY-YY` season grammar below are selected by basis, provenance
type, and field, never by string shape: a string like `2000-01` is a
month-precision date value only inside a source-date pair or
date-component row, and a season only as `edition:YYYY-YY` on an
`official-mutable` record; no position accepts both grammars. Valid:
`edition:2024-06` (an `official-immutable` artifact whose cover states
"JUNE 2024" and which states no exact day, with the limitation
recorded); `agreement-as-of:2023-06-28` and `effective:2023-07-01`
(dates the signed CBA itself states). Invalid: `publication:2024-06`
or `effective:2024-06` for a cover-month edition identifier (a false
basis); `2024-06` with no basis; `YYYY-MM` where the source states an
exact day for the basis; `publication:2024-06-07` taken from PDF
creation/modification metadata (fabricated day); `edition:2024-13`
(month out of range); `edition:2024-6` (two digits required);
`edition:2024/06` (wrong separator); `June 2024` in a structured field
(prose).

**Pinned season grammar (binding; the only accepted season syntax).**
Wherever a structured field permits a season (the `edition:YYYY-YY`
alternative in an `official-mutable` record's base Source date field
and date-component rows, the `official-mutable` detail row's split
`Season` field, and any other structured season value), the season is
exactly `YYYY-YY`:

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

**Canonical-actor registry and alias normalization (binding — R2.9;
independence-proof use retired by R2.11).** The table below remains a
recording convention for familiar actor labels. A validator may parse
the verifier grammar and may require the maker and checker fields to be
nonblank and string-distinct, but it must not use an alias table to claim
that two sessions or identities are genuinely independent. Actual
authorship, separation, chronology, and intellectual independence are
facts for the independent checker to establish from the work history.
The recording table may be extended only by a governed foundation
amendment:

| Canonical actor class | Aliases that normalize to it (post-NFC/lowercase) |
|---|---|
| `agent:claude` | `agent:claude`, `agent:claude-code`, `agent:claude.code`, `agent:claudecode`, `agent:claude-<any suffix>` |
| `agent:codex` | `agent:codex`, `agent:codex-cli`, `agent:codex.cli`, `agent:codex-<any suffix>` |
| `human:<slug>` | itself (identity) |

The table does not govern the acceptance result and does not certify
identity. A matching alias is a review signal, not a mechanical proof;
an unlisted but grammar-valid identity is structurally valid and still
requires checker scrutiny.

**`—` validity is defined per provenance type, never generically:**

| Base field | `official-immutable` | `official-mutable` | `ops-provenance` | `ext-contract` |
|---|---|---|---|---|
| Source/provenance identity | Required | Required | Required — named first-party identity | Required — the determination-contract identity |
| Source date (basis:value) | Required — a `<basis>:<value>` pair under the source-date model above (`YYYY-MM-DD` where the source states an exact day for the basis; `YYYY-MM` only under the month-precision rule; an edition identifier only as `edition:…`; never a metadata-derived value), with every further supported semantic date in the date-component detail table | Required — a `<basis>:<value>` pair (`publication:`/`effective:` dates the publication states, or `edition:YYYY-YY` under the pinned season grammar) | Required (`effective:` date or window, in the detail row; base may mirror or carry `—` only if the detail window governs) | `—` permitted only where the contract has no dated basis |
| Official URL | Required | Required | `—` only when no URL exists | `—` only when no URL exists |
| Artifact SHA-256 | Required | Required (retrieved content) | `—` only when no durable artifact exists | `—` only when no durable artifact exists |
| Artifact byte size | Required (unpadded positive integer) | Required (retrieved content) | `—` only when `Artifact SHA-256` is `—` | `—` only when `Artifact SHA-256` is `—` |
| Retrieval timestamp | Required | Required | Required whenever content or an artifact was retrieved; otherwise `—` | Required whenever content or an artifact was retrieved; otherwise `—` |
| Authentication timestamp | `—` unless separately applicable | `—` unless separately applicable | **Required** | **Required** (verification/authentication) |
| Verifier identity | Required (never `—`) | Required (never `—`) | Required (never `—`) | Required (never `—`) |
| Verification session ID | Required (never `—`) | Required (never `—`) | Required (never `—`) | Required (never `—`) |
| Verification date | Required (never `—`) | Required (never `—`) | Required (never `—`) | Required (never `—`) |
| Record limitations | Required (state `none` expressly if none) | Required (state `none` expressly if none) | Required | Required |
| Record status | Required (`current`/`superseded`) | Required (`current`/`superseded`) | Required (`current`/`superseded`) | Required (`current`/`superseded`) |
| Record version | Required (integer ≥ 1) | Required (integer ≥ 1) | Required (integer ≥ 1) | Required (integer ≥ 1) |

**Timestamp and hash rules (binding):**

- If durable bytes exist, their SHA-256 **and** their `Artifact byte
  size` are mandatory — an existing artifact is never recorded hashless
  or sizeless, and a record carrying one of the two artifact fields
  while omitting the other fails.
- Official URL may be `—` only when no URL exists.
- A hash may be `—` only when no durable artifact exists; the byte size
  may be `—` only in exactly the same case.
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
includes the complete source-date model (a parseable
`<basis>:<value>` pair from the closed basis vocabulary with a
per-basis-valid value; an edition identifier never recorded as
`publication` or `effective`; no metadata-derived value; no degraded
precision; the `—` pairing rules; and the date-component detail table
— a stable `<Record ID>#D<k>` component identity, at most one current
row per (Record ID, basis, role/scope), exactly one `primary` row per
supported basis, the base pair equal to that basis's `primary` row, no
duplicate or conflicting component, and every relied-on semantic date
carried as exactly one row), the pinned `YYYY-YY` season
grammar for every structured season value, the basis-aware
month-precision `YYYY-MM` rule (including its no-fabricated-day,
honest-basis, and mandatory-limitation conditions — a metadata-derived
day, a month value where the source states an exact day, a cover-month
edition identifier recorded as publication/effective, or a month value
without the required limitation entry each fail the record), and the
three split verification-metadata fields (`Verifier identity`,
`Verification session ID`, `Verification date`), each independently
parsed and validated — one valid verification field never conceals
another that is missing or malformed. A failed record certifies
nothing, and no `EV2-…` component may reference it.

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

**Search-manifest registry (`SM2-<NNNN>`; binding; parseable).** A
prose narrative that sources "were searched" proves nothing a gate can
check. Every bounded search on which a disposition relies is recorded
as one parseable **search-manifest record** per (fragment, searched
source) in the performing unit's receipt, append-only per §15.9.2 and
correctable only through `AMEND` lineage. Schema (one row per record;
every field present; `—` only where marked):

`Search record ID | Subject class | Subject historical LEAF or — | Subject historical fragment ID or — | Subject candidate anchor or — | Authority/provenance class searched | Source identity | Source record ID or — | Canonical URL or authenticated provenance identifier or — | Binary/version identity or — | Binary size bytes or — | Binary SHA-256 or — | Binary pagination or — | Binary signature/as-of or — | Exact locator/query/provision | Search method | Search-set ID or — | Search cutoff timestamp | Result | Result linkage or — | Result details | Limitations or — | Verifier identity | Verification session ID | Verification date | Search status | Search version`

Field rules (binding; every loosely-typed field given an exact grammar,
the SXW2 subject removed, the current-record uniqueness key and the
SM2 ⇔ current-SRC2 binary reconciliation added — corrected R2.9; the
`candidate-obligation` subject variant added — corrected R2.10):

- `Search record ID` — `SM2-<NNNN>`, unique, monotonically allocated.
- `Subject class` — closed vocabulary, exactly one:
  **`XW2-DISP` | `candidate-obligation`** (never `SXW2-DISP` — SXW2
  policy, §15.9.3: SM2/SS2 search machinery is XW2-only, and the
  pre-R2.9 `SXW2-DISP` value and vestigial scenario subject fields stay
  removed). **The `candidate-obligation` variant is added by R2.10 to
  close a contradiction that made the `blocked-unsupported-obligation`
  route unreachable:** §15.9.3 admits a `candidate-obligation` `BLK-…`
  finding for a newly discovered in-scope obligation that has **no
  historical LEAF**, while requiring that finding to prove an adequate
  not-located search through `SS2-…`/`SM2-…` records — but the pre-R2.10
  SM2/SS2 schemas required a resolving historical LEAF and fragment ID
  in every row, which such a candidate expressly lacks. No conforming
  evidence set could therefore be written for a candidate obligation,
  and the blocking outcome could never be satisfied. The subject fields
  are now **polymorphic and mechanically exclusive**, exactly as the
  §15.9.4 `DISP` detail schema is.
- **`XW2-DISP` subject fields:** `Subject historical LEAF` and
  `Subject historical fragment ID` are **both required, never `—`** —
  the §15.9.1 published LEAF ID and the §15.9.3 fragment ID the search
  concerns, both resolving; `Subject candidate anchor` is
  **forbidden — exactly `—`**.
- **`candidate-obligation` subject fields:** `Subject historical LEAF`
  and `Subject historical fragment ID` are **forbidden — each exactly
  `—`**; `Subject candidate anchor` is **required, never `—`** — the
  canon anchor (e.g., `§13.3`) naming the discovered obligation, and it
  must equal the `Subject candidate anchor` of the `BLK-…` finding and
  the `SS2-…` set the record supports.
- `Authority/provenance class searched` — exactly one token from the
  §15.9.5 authority classes or the §15.9.6 provenance types (`CBA`,
  `BYL`, `NBA`, `DERIVED`, `INFERRED`, `OPS`, `EXT`,
  `official-immutable`, `official-mutable`, `ops-provenance`,
  `ext-contract`).
- `Source identity` — the exact named source searched (never a vague
  class like "official web surfaces"); never `—`.
- `Source record ID` — the current `SRC2-…` record where one exists;
  `—` only where no `SRC2-…` record exists for the searched source.
- `Canonical URL or authenticated provenance identifier` — either an
  absolute `https?://…` URL, or `provenance:<slug>` (the §15.9.6
  verifier-grammar `<slug>` shape) for an authenticated non-public
  provenance; `—` only where neither exists (e.g., an
  attestation-availability check).
- `Binary/version identity` — a non-empty artifact edition/version
  label (e.g., `2023 CBA signed edition`); `—` **only** for a
  non-artifact source. **When `Source record ID` names a current
  artifact-bearing `SRC2-…` record, this must equal that record's
  Source/provenance identity or Source title/edition.**
- `Binary size bytes` — the searched artifact's size as an unpadded
  positive integer (bytes); `—` only for a non-artifact source. **When
  `Source record ID` names a current artifact-bearing `SRC2-…` record,
  this must equal that record's `Artifact byte size` field exactly**
  (the §15.9.6 base field added by R2.10 — before it existed this
  equality named no governed counterpart and was unsatisfiable).
- `Binary SHA-256` — the searched artifact's 64-lowercase-hex SHA-256;
  `—` only for a non-artifact source. **When `Source record ID` names a
  current artifact-bearing `SRC2-…` record, this must equal that
  record's `Artifact SHA-256` exactly** (a mismatch fails the record —
  the SM2 ⇔ current-SRC2 binary reconciliation).
- `Binary pagination` — a `"; "`-list whose first element is
  `pages=<n>` (`<n>` an unpadded positive integer) and whose optional
  second element is `printed-offset=<±k>` (a signed integer); `—` only
  for a non-artifact source.
- `Binary signature/as-of` — exactly one of `signed`, `unsigned`, or
  `as-of:<YYYY-MM-DD>` (a real calendar date); `—` where none applies.
- `Exact locator/query/provision` — never `—`; begins with exactly one
  of `provision:`, `locator:`, or `query:` followed by non-empty text
  (the exact provision inspected or the exact query run).
- `Search method` — closed vocabulary, exactly one: `full-text-sweep` |
  `provision-read` | `query` | `index-scan` |
  `attestation-availability-check`; never `—`.
- `Search-set ID` — the `SS2-<NNNN>` search-set/coverage record (below)
  this record is a member of; `—` only for a standalone search not part
  of a coverage set.
- `Search cutoff timestamp` — ISO-8601 UTC; the search speaks only as
  of this moment.
- `Result` — closed vocabulary, exactly one:
  `qualifying-authority-located` |
  `no-qualifying-authority-located-in-searched-sources` |
  `inconclusive`. The vocabulary **cannot encode "none exists"**, and
  no field may imply it.
- `Result linkage` — the current record the result supports (the
  `DR2-…` `DISP` record, the `BLK-<NNNN>` blocked finding, or the
  `SS2-<NNNN>` search set), or `—` if not yet linked; a superseded
  target fails.
- `Result details` — what was found or not found, exactly; for
  `qualifying-authority-located`, the locator of the located
  authority.
- `Verifier identity` / `Verification session ID` /
  `Verification date` — the split verification-metadata grammars
  above; never `—`.
- `Search status` — closed vocabulary `current` | `superseded`.
- `Search version` — an unpadded positive integer from `1`, incremented
  by the `AMEND` chain.

**SM2 current-record uniqueness key (binding; subject-polymorphic —
R2.10).** No two **current** `SM2-…` records share the tuple
**(Subject class, subject identity, Authority/provenance class searched,
Source identity, Search cutoff timestamp)**, where *subject identity* is
**(Subject historical LEAF, Subject historical fragment ID)** for an
`XW2-DISP` record and **(Subject candidate anchor)** for a
`candidate-obligation` record; a duplicate current search record fails
the unit's reconciliation. Superseded records are exempt (they carry
prior versions in the receipts). Every current `SM2-…` record must also
carry a `Search-set ID` naming a current `SS2-…` set that lists it as a
member, **or** be an expressly standalone search cited by no current
disposition; a current `SM2-…` record that is cited nowhere and belongs
to no set is an orphan and fails.

**Search-set/coverage record (`SS2-<NNNN>`; binding; parseable —
R2.8).** Individual `SM2-…` records cannot mechanically prove that the
required **multiple source classes** were all searched. A search-set
record joins the required classes and the current member `SM2-…`
records into one deterministic adequacy assessment. Support population
(performing unit's receipt), append-only per §15.9.2:

`Search set ID | Subject class | Subject LEAF or — | Subject fragment ID or — | Subject candidate anchor or — | Required source classes | Member SM2 IDs | Coverage assessment | Adequacy result | Set status | Set version`

Rules (all binding; required classes made deterministic and the
coverage assessment given a closed grammar — corrected R2.9; the
`candidate-obligation` subject variant, the current-uniqueness key, and
the bidirectional membership rule added — corrected R2.10):
`Search set ID` is `SS2-<NNNN>`, unique, monotonic. `Subject class` is
the closed vocabulary **`XW2-DISP` | `candidate-obligation`** (never
`SXW2-DISP` — SXW2 policy, §15.9.3: SS2 is XW2-only), and it selects the
subject fields exactly as the `SM2-…` contract above does: for
**`XW2-DISP`**, `Subject LEAF` and `Subject fragment ID` name the exact
fragment (a published LEAF ID + its `:F<n>`), both resolving, and
`Subject candidate anchor` = `—`; for **`candidate-obligation`**,
`Subject LEAF` and `Subject fragment ID` are each exactly `—` and
`Subject candidate anchor` is the required, resolving canon anchor.

**SS2 current-record uniqueness and membership (binding — R2.10).** No
two **current** `SS2-…` records share the tuple **(Subject class,
subject identity)** — *subject identity* being (Subject LEAF, Subject
fragment ID) for `XW2-DISP` and (Subject candidate anchor) for
`candidate-obligation` — so a fragment or candidate never has two
competing current coverage assessments. Membership is **bidirectional
and complete**: every ID in `Member SM2 IDs` resolves to a **current**
`SM2-…` record whose `Search-set ID` **back-references this exact set**
and whose `Subject class` and subject identity are **identical to this
set's**; and every current `SM2-…` record that back-references this set
appears in `Member SM2 IDs` (no member listed that does not
back-reference, and no back-referencing record omitted from the member
list). A member that is `superseded`, that names a different set, or
whose subject differs from the set's subject fails the set.
**`Required source classes` — deterministic, not maker-selected.** It is
**exactly** the fixed closed set **`CBA, BYL, NBA, ops-provenance`** (in
that order) for every `unsupported-residual` subject — the four
controlling first-party classes, each of which must be searched and
found not to supply the authority before the not-located outcome is
available. The maker-discretion language of the pre-R2.9 rule ("where
the mechanic is plausibly operational/governance material", "any further
class the unit's reasoning identifies as plausibly controlling") is
**abolished**: BYL is always required (searching it and finding nothing
is cheap and removes discretion), and no set that omits any of the four
is valid. A performing unit that judges a further class controlling
searches it too, but that never **reduces** the mandatory four.
`Member SM2 IDs` is `", "`-separated, ascending, no duplicates; every
member is a current `SM2-…` record whose `Search-set ID` back-references
this set (zero orphan/stale members).
**`Coverage assessment` — closed grammar, deterministic calculation.**
It is a `", "`-separated list with **exactly one token per required
class**, each `<class>:covered` or `<class>:uncovered`, in the fixed
class order. A class is `covered` **iff** the set has ≥1 current member
`SM2-…` record for that class whose `Result` is
`no-qualifying-authority-located-in-searched-sources` **and** which is
adequate (below); a class with no member, only an `inconclusive` member,
only an inadequate member, or any member reporting
`qualifying-authority-located` is `uncovered`. `Adequacy result` is the
closed vocabulary `adequate-coverage` | `inadequate-coverage`, computed
deterministically: `adequate-coverage` **iff every** required class is
`covered` **and no** member of the set reports
`qualifying-authority-located`; otherwise `inadequate-coverage`.
`Set status`/`Set version` are `current` | `superseded` / integer. An
`unsupported-residual` `DISP` detail row's `Search-set ID` must name a
current `SS2-…` record with `Adequacy result = adequate-coverage`;
**missing, inaccessible, `inconclusive`, or otherwise inadequate
coverage yields `inadequate-coverage` and can never support an
`unsupported-residual` disposition or clear a
`blocked-unsupported-obligation` finding** — the search is repeated,
narrowed, or superseded until adequate, never routed around.

Adequacy and use (binding):

1. **Required before `unsupported-residual`:** a disposition may rely
   on the not-located outcome only when a current `SS2-…` search-set
   record (above) reports `adequate-coverage` for the subject fragment
   — its members covering the **deterministic** required set **`CBA,
   BYL, NBA, ops-provenance`** in full (the signed CBA, the controlling
   By-Laws, the official NBA explanatory and annual-value surfaces, and
   the first-party operational-provenance availability check), with **no
   maker discretion to omit any of the four**. The `DISP` detail row
   lists every relied-on `SM2-…` ID and names the current `SS2-…` set.
2. **Reconciliation across classes:** if **any** current `SM2-…`
   record for the fragment reports `qualifying-authority-located`, the
   not-located outcome is unavailable — the located authority enters
   the normal §15.9.4–§15.9.6 evidence process and an active owner is
   minted. `inconclusive` never counts toward the required set: an
   inconclusive search is repeated, narrowed, or superseded until it
   resolves, or the disposition is not available.
3. **Adequate vs inadequate:** a search record is adequate only with
   an exact source identity, the binary/version identity plus the split
   `Binary size bytes`/`Binary SHA-256`/`Binary pagination` fields where
   an artifact was searched, an exact locator or query, a cutoff
   timestamp, and a closed-vocabulary result. A record naming a vague
   surface ("official web surfaces"), lacking a locator/query, or
   claiming a universal negative is inadequate and fails; and an
   `inconclusive` result, or a search-set whose `Adequacy result` is
   `inadequate-coverage`, can never support an `unsupported-residual`
   disposition or clear a `blocked-unsupported-obligation` finding.
4. **AMEND supersession:** a search is obsoleted (new edition, new
   surface, later cutoff needed) by minting a superseding `SM2-…`
   record and superseding the old one through `AMEND` lineage; every
   live reference updates in the same commit.
5. **Zero-orphan/current-reference rules:** every `SM2-…` ID cited by
   a current `DISP` detail row or receipt finding resolves to a
   current record; a superseded `SM2-…` record is never the support
   of a current disposition; orphan current `SM2-…` records (cited
   nowhere) fail the unit's reconciliation.
6. **Review duties:** R8 (G3) reviews the search set behind every
   `unsupported-residual` disposition for adequacy and coverage; R9
   independently reviews every such search set — never a sample — and
   re-runs the reconciliation.

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
`unsupported-residual` (§15.9.3) is deliberately **not** an SXW2 edge
type — a reasoned R2.6 decision, not an omission: a scenario disposition
concerns behavioral test coverage rather than obligation ownership, and
the R2.6 receipt records the review finding that no published historical
scenario's faithful disposition requires it (a scenario that tested an
unsupported mechanic asserted as an enforceable rule remains `invalid`;
out-of-scope or obsolete coverage remains `no-successor`; scenario 53's
conditional-cash variant tests the cap-year charging rule — the express
VII §8(a) general rule together with its separately identified INFERRED
conditional-cash application (§15.9.5, as corrected by R2.7) — not the
unregistered re-trade residual). If R7 discovers a historical
scenario that none of the seven pinned SXW2 types can disposition
honestly, that discovery returns to a foundation amendment — the
vocabulary is never extended silently. Every terminal SXW2 edge carries
a **direct reference to a current `DISP` decision record** with its
pinned detail row (§15.9.4) — never a reference resolving only through
an `AMEND` chain to a superseded record via the **`SXW2-DISP`** subject
class of the §15.9.4 polymorphic `DISP` detail schema, and terminal SXW2
edges are unique per **(historical scenario, scenario fragment ID)**,
applying the §15.9.3 terminal-uniqueness key analogously.
Every `SXW2-…` edge identifies its historical scenario by number in the
pinned published set — never the legacy-numbered working copy on this
branch.

**Canonical scenario-fragment grammar (binding; pinned — R2.8).** The
`SXW2-DISP` subject class of §15.9.4 requires a scenario-fragment
identity; this is the pinned grammar for it, derived directly from the
canon's own scenario identifiers (the §16 acceptance-test library
numbers each published scenario, and this standard refers to them as
"scenario 53", "scenarios 1–89"). It is **not** an ad hoc invention:

- **Historical scenario identifier:** `scenario-<n>`, where `<n>` is the
  published scenario's ordinal number (`1 ≤ n ≤ 89`, unpadded) in the
  §16 acceptance-test library of the pinned published v1.1 edition at
  commit `9814939c` (§15.9.8). It is the pinned-published scenario
  number — never the legacy-numbered §16 working copy on this branch,
  and never an active `CBA2-SC-<NNN>` ID.
- **Scenario-fragment ID:** `scenario-<n>:F<m>` — the scenario
  identifier, one ASCII colon, one uppercase `F`, and an unpadded
  positive integer `m` allocated contiguously from `1` at scenario-
  fragment-inventory declaration. The scenario-fragment namespace is
  per historical scenario and append-only per §15.9.2: a scenario
  fragment ID is never reused or renumbered, and a later `AMEND`
  split/merge allocates above the scenario's fragment high-water mark. A
  historical scenario dispositioned whole has exactly one fragment
  (`scenario-<n>:F1`). This grammar is mechanically distinct from the
  §15.9.3 LEAF fragment grammar `<historical LEAF ID>:F<n>` (which
  begins `CBA-`), so a validator never confuses a scenario fragment with
  a LEAF fragment.
- **Scenario-fragment inventory (exact partition tied to the governed
  scenario text — strengthened R2.9).** The §15.9.3 historical-fragment
  inventory, bundle, and reconciliation contracts apply to scenario
  fragments through the following distinct pinned schema (a scenario row
  is never parsed under the historical-LEAF schema):
  `Scenario fragment ID | Historical scenario | Fragment kind | Normalized fragment scope | Decomposition decision record | Disposition bundle ID or — | Disposition edge ID(s) | Fragment status | Fragment version | Limitations or —`
  `Disposition edge ID(s)` contains `SXW2-…` IDs and any non-dash bundle
  is an `SXW2-BND` row under §15.9.3. The inventory is an **exact
  partition of each governed scenario's own text**, not a loose analogy.
  The governed text of scenario `<n>`
  is the byte range of published scenario `<n>` inside the **pinned §16
  scenario source** (14,390 bytes, SHA-256 `5289f6b8…`, at commit
  `9814939c`, §15.9.8); its **normalized scenario text** is derived by
  the identical pinned algorithm of §15.9.3 (NFC; strip one leading and
  trailing whitespace run; collapse whitespace runs to a single space),
  giving a fixed length `Lₙ` and the single-coordinate `span:<a>-<b>`
  atom domain over `[0, Lₙ)`. A scenario-fragment inventory for
  `scenario-<n>` is therefore an **exact partition**: its `F1…Fm`
  fragments' character spans are pairwise non-overlapping and their
  union equals exactly `[0, Lₙ)`, with overlap/equality/coverage/
  contiguity computed mechanically on those ranges. The contract
  **rejects**: a nonexistent scenario (`<n>` outside `1 ≤ n ≤ 89`); an
  invalid or malformed `scenario-<n>:F<m>` ID; a gap (uncovered
  character range) or overlap in the partition; a bundle or `SXW2-…`
  edge/detail naming a nonexistent scenario or fragment parent
  (orphaned); and a stale/superseded current reference. The SXW2
  terminal vocabulary is only `invalid`/`no-successor`, and **no
  `unsupported-residual`/`SM2`/`SS2` search-set machinery applies**
  (SXW2 policy, §15.9.3): scenario fragments carry no search records and
  never a `blocked-unsupported-obligation` finding. Bundles apply under
  the same **multi-target-only** rule and member-compatibility matrix as
  §15.9.3, over `SXW2-…` member edges. R7 declares the scenario-fragment
  inventories when it builds the `SXW2-…` crosswalk; R2.8/R2.9 mint no
  concrete scenario-fragment record. The crosswalk rules of §15.9.3 apply analogously: bipartite
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
| U5 | Semantic duplicate/ownership dispositions — the mandatory §15.9.4 candidate population (all seven generators) is recorded in the receipt, and every candidate has an `OWN` record, a `DISP` record with its pinned detail row (only where the candidate's honest disposition is terminal — §15.9.4 OWN/DISP boundary and compatibility matrix), or a named governed deferral (both families and the expected resolving unit named); identical family tokens pass only under §15.9.3's sole same-family sibling exception, with the qualifying sibling edge/active target, honest natural-family owner, and exact later unit recorded; zero undispositioned in-scope candidates |
| U6 | Tiebreak decision records — every ownership decision states the discriminating tiebreak and why |
| U7 | Crosswalk coverage and valid targets for the historical LEAFs touched by the unit; any deferral is a governed nonterminal `deferred` edge naming both families and the exact later resolving R-unit, with target `—`, one direct current non-`DISP` ownership decision, one fragment, no bundle, and mandatory later `AMEND` exit (§15.9.3) — family tokens are ordinarily distinct; identical tokens require the sole same-family sibling exception, including a different current sibling fragment mapped to an existing active target in another family, the honest natural-family owner assigned to the exact later R4–R6 unit, no existing target for the deferred fragment, and no same-unit deferral; prose-only deferrals fail; fragment-inventory reconciliation for every historical LEAF the unit used as an `XW2-…` source (declared exhaustive decomposition over normalized scope atoms; pairwise non-overlap over the single-coordinate `span:<a>-<b>` text-span domain; exact pinned Authority-cell qualifier for `authority-assertion` fragments and `—` for every other kind; no silent residual; exactly-once disposition in exactly one of the three mutually exclusive shapes (one terminal edge; one single-target nonterminal edge, including `deferred`; or one **multi-target-only** governed `BND-…` bundle of **≥2** target-bearing member nonterminal edges satisfying the member-compatibility matrix and equal as a set to the fragment's edge IDs); bidirectional edge ⇔ fragment ⇔ bundle resolution; zero orphan fragments; zero edges naming an unregistered fragment; kind ⇔ edge-type compatibility; the recorded semantic exhaustiveness review); terminal-edge discipline — every terminal edge (`process-only`/`invalid`/`no-successor`/`unsupported-residual`) has target `—`, is unique per historical source LEAF + fragment ID, and carries a **direct reference to a current, correctly typed `DISP` record with its pinned `XW2-DISP` detail row** (§15.9.4 compatibility matrix; correct subject class; never a reference resolving only through an `AMEND` chain); every `unsupported-residual` edge satisfies the narrow §15.9.3 rule (exact residual-fragment scope with a supported sibling fragment on the same historical LEAF, the required current `SM2-…` search records bound by a current `SS2-…` search-set reporting `adequate-coverage`, and the preserved-candidate anchor); and zero terminal edges for wholly unsupported valid in-scope obligations — any such obligation is a governed `BLK-…` `blocked-unsupported-obligation` finding (subject class `XW2-DISP` or `candidate-obligation`, never `SXW2-DISP`) that **fails this gate and stops the unit** until an independently `accepted` `RES-…` resolution — a checker identity that is grammar-valid, nonblank, and string-distinct from the maker identity, with actual independence checker-judged (§15.9.12) — is bound to the exact current resolution (accepted version, content digest, proposed outcome, proposal-at-checkpoint, and later descendant acceptance receipt all matching) and recorded (§15.9.3) |
| U8 | Per-LEAF evidence completeness — every authority component has a complete `EV2` row meeting its class minima and its class-specific certification duty (§15.9.6); no `EV2` row has both reference fields empty (no source-free terminal component); every OPS component references an `ops-provenance` record and every EXT component an `ext-contract` record; every provenance-type ⇔ authority-class pairing is valid; every referenced `SRC2` record passes the §15.9.6 type-specific field-level validation (base row plus its pinned detail row present and joinable; no required field absent or malformed; no `—` where the per-type matrix prohibits it; the per-type timestamp and hash rules satisfied; every structured season value valid under the pinned `YYYY-YY` season grammar; every Source date valid under the §15.9.6 source-date model (a parseable `<basis>:<value>` pair from the closed basis vocabulary, per-basis value grammars, no edition identifier recorded as publication/effective, no metadata-derived value, no degraded precision, the basis-aware month-precision rule with its required limitation entry, and the date-component detail table reconciled — stable `<Record ID>#D<k>` component identity, at most one current row per (Record ID, basis, role/scope), exactly one `primary` per basis, base pair equal to that basis's `primary` row, no duplicate/conflicting component); the three split verification-metadata fields — `Verifier identity`, `Verification session ID`, `Verification date` — each present, never `—`, and independently valid under their §15.9.6 grammars); and for the unit's families the LEAF Authority fields and `EV2` classes reconcile exactly in both directions (every listed class has ≥1 `EV2` row; every `EV2` row's class is listed) |
| U9 | Source and dependency resolution — every `SRC2`/`EV2` reference in the unit's rows parses under the §15.9.6 grammar (the same pinned field grammars U8 validates, including the `YYYY-YY` season grammar, the `basis:value` source-date model with its basis-aware month-precision rule and date-component detail table, and the three split verification-metadata grammars) and resolves; every `SM2-…` reference in the unit's `DISP` detail rows and findings resolves to a current, adequate search record under the §15.9.6 search-manifest contract (the exact per-field SM2 grammars, the SM2 current-record uniqueness key, and the **SM2 ⇔ current-`SRC2` binary reconciliation** — every current searched-artifact `SM2-…` record's `Binary SHA-256`/`Binary size bytes`/`Binary/version identity` equal to the current `SRC2-…` record it names; and the `SS2-…` deterministic required-class set `CBA, BYL, NBA, ops-provenance` with its closed-grammar coverage assessment); every evidence path terminates in at least one typed `SRC2` source/provenance record; DERIVED/INFERRED input and reasoning chains resolve exactly; `EV2` dependency chains are acyclic; no orphan or dangling references; and for every `EV2` component the complete transitive dependency closure and terminal `SRC2` root set are computed and validated against the §15.9.6 compatibility matrix — every dependency edge class-permitted, every terminal root type-permitted, no authority laundering (a DERIVED or INFERRED component with an `ops-provenance` or `ext-contract` root fails), OPS/EXT visibility and limitation propagation verified at every consuming LEAF, and every locally valid but transitively incompatible chain rejected |
| U10 | Primary/secondary method validity (exactly one primary; distinct secondaries; no OPSV) |
| U11 | No process-shaped active rows |
| U12 | Every true-gap note has a minted, fully certified owner (`TG` records complete) |
| U13 | Child-ID numbering integrity (§15.9.2) — at initial GROUP construction, children are contiguous `.1…n`; after any `AMEND` event, every missing allocated child ID resolves through the immutable receipts and an `AMEND` chain to an explicit removal or one or more current successors; no unexplained or never-allocated interior gap; no reused or reassigned ID; no renumbering of surviving children; new children allocated only above the highest child ID ever allocated in the GROUP |
| U14 | Family-level adjacent-provision sweep recorded in the receipt |

Code-map gates, Phase 2 packet gates, global dependency gates, and global
scenario-reconciliation gates are **not** run during R3–R6.

**`G15R` — R3.1-local AMEND/current-reference repair gate (binding;
runs at the R3.1 checkpoint).** R3.1 changes committed R3 records
through `AMEND` lineage while otherwise rerunning only U1–U14, none of
which validates amendment chains across populations — that duty
otherwise first arises at G15 (R8). `G15R` closes that window: it is a
**repair-local** gate, scoped to every population R3.1 touches (active
GROUP/LEAF rows, `XW2-…`, `SRC2-…` base and `<Record ID>#D<k>`
date-component rows, `EV2-…`, `DR2-…` records and their polymorphic
`XW2-DISP`/`SXW2-DISP` `DISP` detail rows, fragment-inventory rows,
`BND-…` disposition bundles, `SM2-…` records, `SS2-…` search sets, and
`BLK-…`/`RES-…` blocked-finding/resolution records), and it is **not** a
claim that the full R8 global gate G15 has run. At the R3.1 checkpoint,
`G15R` verifies, for those populations:

1. Every live reference points **directly** to the current record —
   zero live references to superseded IDs, versions, or decision
   records.
2. Every prior (receipt-era) record resolves forward through a valid
   `AMEND` chain.
3. Every `AMEND` chain terminates in exactly one current disposition
   or an explicit removal.
4. No stale live references anywhere in the touched populations.
5. No duplicate current record for one identity (including no
   duplicate current `DISP` per terminal fragment and basis).
6. No orphan record (current records that nothing live references,
   in populations where references are required).
7. No broken forward reference (every referenced ID exists and
   parses).
8. The `AMEND` detail names the prior checkpoint and the current tree
   carries direct current references. Commit chronology and whether the
   updates genuinely landed atomically are checker-reviewed; a validator
   does not claim to prove chronology from text alone.
9. No ID reuse and no renumbering anywhere (§15.9.2 child-ID and
   append-only contracts, including fragment IDs, scenario-fragment
   IDs, `<Record ID>#D<k>` date-component IDs, `BND-…`, `SM2-…`,
   `SS2-…`, `BLK-…`, and `RES-…` IDs).
10. Every current decision reference satisfies the §15.9.4 edge-type
    ⇔ decision-type compatibility matrix and the pinned detail
    schemas — the polymorphic `XW2-DISP`/`SXW2-DISP` `DISP` detail rows
    (with subject-family agreement and no subject-family mismatch),
    `<Record ID>#D<k>` date-component rows (role/scope cardinality),
    split-status/version fragment rows, `BND-…` bundles, `SM2-…`/`SS2-…`
    rows, and `BLK-…`/`RES-…` rows all schema-valid.
11. Every current `BLK-…` blocked finding that is `resolved` names a
    current `accepted` `RES-…` resolution whose recorded checker and
    maker fields are grammar-valid, nonblank, and string-distinct, and
    whose acceptance is **bound to the exact current
    resolution** (`Accepted RES version` = current `Resolution version`,
    `Accepted content digest` = the recomputed current-content digest,
    `Accepted proposed outcome` = current `Proposed outcome`), with an
    `Accepted checkpoint commit` that resolves to the reviewed maker
    checkpoint and contains exactly one structurally identical,
    unaccepted/proposed RES row at its governed `Proposal receipt path`,
    plus a later descendant `Acceptance receipt commit` that resolves in
    the governing repository and carries an `Acceptance receipt` path that
    **exists at that receipt commit and parses** to
    a matching `## Independent acceptance record` `ACCEPT` row
    (§15.9.3); a nonexistent, unresolvable, stale, superseded,
    `REJECT`ed, or unrelated acceptance never clears, and no `open`
    finding is treated as cleared.

**`G15R` execution report (binding; simplified R2.12).** The R2.10
twelve-slot presence report is retired: it treated a synthetic
"dependent references" slot as a population, encouraged dummy records,
and confused optional absence with failure. `G15R` now reports the
actual touched populations and the controls applied to each. `DR2` and
`AMEND-detail` are required in R3.1; other populations are required only
when the migrated document contains or references them. Optional
`BLK`/`RES`, `BND`, scenario, and search populations may be honestly
absent. For every present or required population the report names:

| Control | Mechanical result reported |
|---|---|
| Schema/header | Exact pinned header, field count, ID grammar, status/version grammar |
| Lineage | AMEND parent/detail joins, prior/current resolution, acyclic forward graph, one current endpoint or explicit removal |
| Direct references | No live reference to a known superseded endpoint; every typed reference resolves directly |
| Population-specific joins | The applicable fragment/bundle, DISP/edge, SRC2/EV2, SM2/SS2, BLK/RES, and date-component checks |

Absence fails only when a trigger above requires the population. A
validator output that lists population presence without executing its
applicable controls is not a `G15R` result.

G15 (R8) and R9 later rerun the global equivalents across every live
v2 population; `G15R` neither replaces nor weakens them.

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
11. Every decision-record reference resolves to the correct current
    decision record: every terminal SXW2 edge carries a **direct**
    reference to a current `DISP` record whose detail row is the
    **`SXW2-DISP`** subject variant (§15.9.4) of the matching terminal
    type, with the source scenario (`scenario-<n>`), scenario fragment
    ID (`scenario-<n>:F<m>`, §15.9.8), edge ID, normalized scope, and
    type agreeing in both directions; no terminal edge references an
    `OWN`, an `XW2-DISP` row, or any other incompatible or
    subject-family-mismatched record; no reference resolves only
    through a superseded pre-`AMEND` record (zero stale references);
    terminal SXW2 uniqueness holds on the (historical scenario,
    scenario fragment ID) key; zero orphan current scenario `DISP`
    records; and every nonterminal edge's reference resolves to the
    correct current non-`DISP` decision type.
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
    which part of the historical scenario the edge covers and how — and,
    mechanically (strengthened R2.9), the complete **scenario-fragment
    partition reconciliation** (§15.9.8): every historical scenario used
    as an `SXW2-…` source has a declared exhaustive, pairwise
    non-overlapping scenario-fragment inventory whose `span:<a>-<b>`
    ranges partition exactly `[0, Lₙ)` of that scenario's normalized
    governed text (no gap, no overlap, no uncovered character); every
    fragment is dispositioned exactly once under the same three-shape
    exactly-once and **multi-target-only** bundle rule as §15.9.3; every
    `SXW2-…` edge's leading fragment token and every bundle member
    resolve bidirectionally to an inventoried fragment of the named
    scenario (zero orphan fragments, zero orphan bundle members, zero
    edges or bundles naming a nonexistent scenario or fragment); and no
    scenario `<n>` outside `1 ≤ n ≤ 89` and no malformed
    `scenario-<n>:F<m>` ID appears.

**R8 — global reconciliation gates:**

| # | Gate |
|---|---|
| G1 | Complete historical-LEAF crosswalk coverage — every published v1.1 LEAF has at least one outgoing edge; zero current `deferred` edges or prose-only deferrals remain; and complete global fragment-inventory reconciliation (§15.9.3) — every historical LEAF used as an `XW2-…` source has a declared exhaustive, pairwise non-overlapping, fully dispositioned fragment inventory with exact pinned Authority-cell qualifiers on every `authority-assertion`, bidirectional edge ⇔ fragment resolution, zero orphan fragments, zero edges naming an unregistered fragment, and zero `open` `BLK-…` `blocked-unsupported-obligation` findings (every one carries a current `accepted` `RES-…` resolution with a distinct independent checker) |
| G2 | All non-terminal target-bearing crosswalk edges resolve to active v2 LEAFs; `deferred` has no target and is prohibited by G1 |
| G3 | Terminal edges and companion true-gap records validate; every `no-successor` edge receives an exhaustive semantic review against the §15.9.3 no-successor rule — the exact scope/edition basis is verified, and none hides an unresolved, uncertified, deferred, or merely unsupported in-scope obligation; every `unsupported-residual` edge receives an individual semantic review against the §15.9.3 unsupported-residual rule — the exact residual-fragment scope with its supported sibling, the required current `SM2-…` search records bound by a current `SS2-…` search-set reporting `adequate-coverage` (reviewed for adequacy and class coverage under the §15.9.6 search-manifest contract), the honest not-located basis, and the preserved-candidate anchor are verified, and none conceals failed certification, deferred required research, or a fragment whose qualifying authority was located; every terminal edge carries a direct reference to a current, correctly typed `DISP` record with its pinned polymorphic detail row of the matching subject class (§15.9.4 compatibility matrix; zero references resolving only through `AMEND` chains; zero subject-family mismatches); terminal-edge uniqueness holds on the (historical source LEAF, fragment ID) key for `XW2-DISP` and the (historical scenario, scenario fragment ID) key for `SXW2-DISP`; and zero terminal edges exist for wholly unsupported valid in-scope obligations (every `BLK-…` `blocked-unsupported-obligation` finding carries a current independently `accepted` `RES-…` resolution — a checker distinct from the maker — never an unstructured waiver) |
| G4 | Global active GROUP/LEAF counts, with historical and support records excluded |
| G5 | Phase 1 boundary check — no code map or Phase 2 packet is read, created, or changed; downstream projection is deferred until R9 ACCEPT plus owner acceptance |
| G6 | Canon-only registry reconciliation — every active v2 LEAF appears exactly once in each governed canon-side LEAF table and all receipt-side joins resolve; no downstream packet is treated as an R8 input |
| G7 | Verdict-boundary check — Phase 1 contains no product verdict column or Phase 2 verdict; historical IDs, GROUPs, crosswalk edges, and scenario IDs remain provenance/support identities only |
| G8 | Dependency order contains no later-unit dependency and no cycles — mechanical cycle/order checks **plus a semantic dependency review** (a parser cannot prove a dependency was never omitted) |
| G9 | Global ownership/atomicity reconciliation across families, including a rerun global cross-family duplicate-candidate sweep (all §15.9.4 generators) with zero unresolved candidates |
| G10 | Scenario reconciliation rerun — SC1–SC7 across the whole library, including the **complete SC2 SXW2 integrity contract** (all sixteen checks), never coverage alone |
| G11 | Sampled semantic rechecks of merge/split decisions, scenario coverage, and source-derived obligations |
| G12 | Canon/repair-plan/R8-receipt status reconciliation — record R8 maker completion while keeping the canon unaccepted; README remains unchanged |
| G13 | Final v2 checksum and counts recorded in the receipt |
| G14 | Global evidence reconciliation — the §15.9.6 resolution and bidirectional class checks pass across the whole registry: typed `SRC2` termination for every evidence path; no source-free terminal `EV2` component; class-specific certification attested for every component; valid provenance-type ⇔ authority-class pairings; acyclic `EV2` dependency chains; exact Authority ⇔ `EV2` reconciliation in both directions; zero orphan or dangling `SRC2`/`EV2` rows or references; type-specific field-level validation of every `SRC2` record (base plus pinned detail row, per-type `—` validity, timestamp/hash rules, the pinned `YYYY-YY` season grammar, the `basis:value` source-date model with its basis-aware month-precision rule and reconciled date-component detail table, and the three split verification-metadata fields under their §15.9.6 grammars); the **SM2 ⇔ current-`SRC2` binary reconciliation** across every current searched-artifact `SM2-…` record (its `Binary SHA-256`/`Binary size bytes`/`Binary/version identity` equal to the current `SRC2-…` record it names) and the `SS2-…` deterministic required-class coverage (`CBA, BYL, NBA, ops-provenance`) behind every `unsupported-residual` disposition; and the complete transitive dependency closure and terminal root set of every `EV2` component recomputed globally against the §15.9.6 compatibility matrix — zero authority-laundering chains, with OPS/EXT visibility and limitation propagation verified at every consuming LEAF |
| G15 | Amendment-chain integrity across every live v2 population (active GROUP/LEAF, `XW2`, `SRC2` base and `<Record ID>#D<k>` date-component rows, `EV2`, active `CBA2-SC` scenarios/named cases, `SXW2`, `DR2` records and their polymorphic `XW2-DISP`/`SXW2-DISP` `DISP` detail rows, historical- and scenario-fragment inventory rows, `BND` disposition bundles, `SM2`, `SS2` search sets, and `BLK`/`RES` blocked-finding/resolution records) — zero stale live references to superseded IDs, versions, or decision records; no duplicate or orphan record created by any correction; every receipt-era ID/version resolves forward through its `AMEND` chain; every supersession chain terminates in exactly one current disposition or an explicit removal; every resolved `BLK` names a current `accepted` `RES` whose checker identity is grammar-valid, nonblank, and string-distinct from the maker identity, with actual independence checker-judged (§15.9.12), and whose acceptance is bound to the exact current resolution (accepted version, content digest, proposed outcome, exact proposed row at the maker checkpoint, and later descendant acceptance receipt all matching); and child-ID numbering integrity under the §15.9.2 contract — every numeric gap in a GROUP's live children resolves through the receipts and `AMEND` chain to an explicit removal or current successors, no unexplained or never-allocated interior gap, no reused/reassigned ID, no renumbering, and every new child above its GROUP's historical high-water mark |

**R2.9 dependent-gate propagation (binding; the corrected contracts flow
through every gate above).** The R2.9 schema corrections are enforced
identically wherever their contract is checked, so no later gate can
cure an invalid foundation state: **G1** applies the **multi-target-only
`BND-…`** rule and member-compatibility matrix to global
fragment-inventory reconciliation (a nonterminal single-target fragment
carries a bare edge and no bundle; a bundle has ≥2 compatible members);
**G3** verifies every `unsupported-residual` search set against the
**deterministic `SS2-…` required-class set `CBA, BYL, NBA,
ops-provenance`** with its closed-grammar coverage assessment and the
**SM2 ⇔ current-`SRC2` binary reconciliation**, and verifies every
`accepted` `RES-…` clearing a `BLK-…` binds to the exact current
resolution with grammar-valid, nonblank, string-distinct maker/checker
fields; actual independence remains an independent-review judgment
(§15.9.6); **G10** reruns the complete SC2 contract including check 16's
**scenario-fragment partition reconciliation** (§15.9.8); **G14** adds
the SM2 ⇔ current-`SRC2` reconciliation above; and **G15/`G15R`** bind
`BLK-…`/`RES-…` acceptance to the exact current resolution and its
resolved checkpoint/receipt commits. The unit-local gates carry the same
contracts:
**U5** records the §15.9.4 candidate population with `OWN`/`DISP`/named
deferral dispositions; **U6** the discriminating tiebreak; **U7/U8/U9**
the fragment, source-date, SM2/SS2, and evidence contracts as corrected;
and **G1/G3** the `candidate-obligation` `BLK-…` subject class for a
newly discovered in-scope obligation with no historical LEAF. **R9**
independently re-runs all of the above.

**R2.10–R2.14 dependent-gate propagation (binding; the repaired contracts flow
through every gate above).** Each R2.10 repair is enforced wherever its
contract is checked, so no gate can pass on a state another gate would
reject: **U7** rejects a `BND-…` bundle whose `Member subject scopes`
do not partition its fragment exactly, and rejects a
`candidate-obligation` `BLK-…` finding whose `SS2-…`/`SM2-…` evidence is
not expressed in the `candidate-obligation` subject variant; **U8/U9**
enforce the `SRC2-…` `Artifact byte size` field, the SM2 ⇔ current-`SRC2`
byte-size **and** hash equality against that governed field (never
against any value private to a validator), and the date-component
lifecycle — exactly one current row per (Record ID, basis, role/scope),
exactly one current `primary` per basis, and zero references to a
`superseded` component; **G1/G3** apply the corrected `DISP`
terminal-base-equality rule, so two detail rows differing in subject
fragment, preserved-candidate anchor, limitations, or reopening
condition can never be grouped under one `DISP` record, and apply the
corrected edge ⇔ detail agreement tuple, which never asserts a join
against a field the edge register does not carry; **G14** recomputes the
same byte-size/hash equality globally; **G15/`G15R`** treat an accepted
checkpoint commit or acceptance-receipt commit that does not resolve, an
`Proposal receipt path` that does not contain the exact proposed row at
the accepted checkpoint, an `Acceptance receipt` that does not exist at
its receipt commit, or a
receipt with no matching
`## Independent acceptance record` `ACCEPT` row as a **failed**
acceptance. `G15R` reports the actual touched/required populations and
executes each applicable control — including the complete `DR2-…`
population and structured `AMEND` details. Across every gate, the
§15.9.11 governed inventory is the **only** admissible source of
vocabularies, schema field lists, dependencies, and anchors; a gate
result produced against a validator's private copies is not a gate
result. The R2.13 whole-canon location audit additionally rejects every
governed-ID pipe row that falls outside the union of all matching Inventory
F intervals. R2.14 requires that audit and ordinary population membership to
use the same balanced-backtick record-ID cell normalizer, and rejects a live
plan route that still treats R2.12 or R2.13 as accepted. **R9** independently
re-runs all of the above.

**R9 — independent acceptance.** The independent reviewer (who authored no
part of v2.0) must: re-run every mechanical gate from scratch;
independently sample primary-source passages; independently sample active
obligation atomicity and ownership; **independently regenerate the
duplicate-candidate population (all §15.9.4 generators) rather than
trusting the unit lists**; independently sample scenario truth; **review
every `no-successor` disposition and every `unsupported-residual`
disposition individually — not a sample — re-run the §15.9.6
search-manifest reconciliation behind every `unsupported-residual`
disposition (adequacy, class coverage, and current status of every
relied-on `SM2-…` record), independently re-verify every historical
LEAF's fragment-inventory reconciliation (§15.9.3 — exhaustive
decomposition over normalized scope atoms, non-overlap, exactly-once
disposition via one terminal edge, one single-target nonterminal edge,
or one **multi-target-only** governed `BND-…` bundle (≥2 members,
member-compatibility matrix), bidirectional resolution, kind ⇔
edge-type compatibility, and zero `open` `BLK-…`
`blocked-unsupported-obligation` findings — every one carrying a current
independently `accepted` `RES-…` resolution whose checker identity is
grammar-valid, nonblank, and string-distinct from the maker identity,
with actual independence checker-judged (§15.9.12), and whose acceptance
is **bound to the exact current resolution**, exact proposed row at the
maker checkpoint, and later descendant acceptance receipt, with no
unstructured waiver), and verify
that every terminal crosswalk edge carries a direct reference to a
current, correctly typed `DISP` record with its pinned polymorphic
detail row of the matching subject class (`XW2-DISP`/`SXW2-DISP`) on its
uniqueness key — (historical source LEAF, fragment ID) for `XW2-DISP`,
(historical scenario, scenario fragment ID) for `SXW2-DISP` — zero
references resolving only through `AMEND` chains and zero subject-family
mismatches**;
**independently verify the `AMEND` amendment chain across every live v2
population (§15.9.2 — including `<Record ID>#D<k>` date-component rows,
`BND-…` bundles, `SS2-…` search sets, and `BLK-…`/`RES-…` records) —
zero stale live references, no duplicate or
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
the `basis:value` source-date model with its basis-aware month-precision
rule and reconciled date-component detail table, and the three split
verification-metadata fields under their §15.9.6
grammars), and an independent recomputation of
every `EV2` component's complete transitive dependency closure and
terminal `SRC2` root set against the §15.9.6 compatibility matrix —
zero authority-laundering chains, with OPS/EXT visibility and
limitation propagation verified at every consuming LEAF**; **re-run the
complete SC2 SXW2 integrity contract (§15.9.9) — never coverage alone**;
and issue an explicit **ACCEPT or REJECT** at a pinned clean commit.
R9 performs no application/runtime/code-map sampling. R9 ACCEPT is
necessary but not sufficient: only **R9 ACCEPT plus explicit owner
acceptance** closes Phase 1 and unblocks Phase 2/W1.1.

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
| Phase 1 code-map or Phase 2 packet gates | None; downstream maps and packets are outside R1–R9 and remain blocked until R9 ACCEPT plus owner acceptance |
| Scenarios 1–89 as the active library | Frozen historical; the active library is `CBA2-SC-…`, built by R7 |

#### 15.9.11 Governed inventory — closed vocabularies, pinned schemas, dependencies, and preservation anchors (binding; machine-readable; added R2.10)

**Why this subsection is binding.** Through R2.9 the governing contracts
of §15.9 lived only in prose clauses, and the validator that had to
enforce them carried its own parallel Python copies — hard-coded
vocabulary allow-sets that filtered whatever the canon declared, an
actor-family function that ignored the parsed alias table, and private
source hash/size dictionaries standing in for governed fields. A
parallel contract is not an implementation of a governing contract: it
silently survives edits to the canon, so a governing field could be
removed, a vocabulary entry changed, or a schema weakened with the
validator none the wiser. This subsection removes the need for any such
copy. It is the **machine-readable data dictionary** for every closed
vocabulary, pinned schema, listed cross-schema dependency, immutable
preservation anchor, and pinned population source that §15.9 governs.
It is deliberately not a claim to enumerate every validator algorithm,
semantic join, or review judgment.

**Binding use rules (all mandatory):**

1. A conforming validator **parses this inventory** and uses it as the
   authoritative source for vocabularies, schema field lists, the listed
   dependencies, population locations, and preservation anchors.
   Hard-coding parallel copies of those data declarations in validator code
   — as an allow-set, a filter over parsed values, a fallback, or a
   private lookup table — is **prohibited**, and a validator that does
   so is not a conforming validator of this standard.
2. The inventory and the governing clause **reconcile bidirectionally**,
   by this exact mechanical procedure. Each `Anchor` cell is a code span
   whose content contains **no backtick and no `|`**, so the anchor is
   read by removing exactly one leading and one trailing backtick; the
   anchor must occur **exactly once** in this file outside §15.9.11
   (an ambiguous or unresolvable anchor is itself a defect). Then:
   - **Vocabulary:** the *anchored window* is the 2,000 bytes beginning
     at the anchor. Every value listed here must appear inside that
     window as a backtick-delimited or `**`-delimited token — or, where
     the clause pins the vocabulary as a single ordered list (the
     deterministic `SS2-…` required set), as that whole `", "`-joined
     token. Conversely, no governed row anywhere may carry a value of
     this vocabulary that is absent from this inventory (closure at use
     sites, rule 3).
   - **Schema:** take the **first** backtick-delimited pipe-list at or
     after the anchor, split it on `|`, strip each field, and require
     **exact ordered equality** with the `Fields` list here (whose `;`
     delimiter substitutes for the schema string's `|`), and require the
     `Count` column to equal the number of fields.
   A divergence in either direction is a **canon defect** and
   fails validation — it is never resolved by preferring one side.
3. **Closure at use sites.** No governed row may carry a value of an
   inventoried vocabulary that this inventory does not list, and no
   governed table may carry a field list that its pinned schema does not
   declare. An unlisted value or an undeclared field fails the row.
4. This inventory is extended or changed **only by a governed foundation
   amendment recorded in a checkpoint receipt**, never silently.

**Inventory A — closed vocabularies (exact; ordered).** Values are the
complete membership; `Anchor` is a literal, once-occurring string of
this canon at or before the governing declaration.

| Vocabulary key | Anchor | Closed values (exact, ordered) |
|---|---|---|
| `date-basis` | `Closed date-basis vocabulary (exactly one per pair):` | `publication`, `effective`, `edition`, `agreement-as-of` |
| `fragment-kind` | `Fragment kinds (closed vocabulary; exactly one per fragment):` | `substantive-obligation`, `authority-assertion`, `process-instruction`, `gap-assertion` |
| `xw2-edge-type` | `Edge types:` | `equivalent`, `split`, `merge`, `partial-overlap`, `moved`, `deferred`, `process-only`, `invalid`, `no-successor`, `unsupported-residual` |
| `xw2-terminal-edge-type` | `3. Every non-terminal edge except` | `process-only`, `invalid`, `no-successor`, `unsupported-residual` |
| `sxw2-edge-type` | `**Scenario crosswalk** (` | `equivalent`, `split`, `merge`, `partial-overlap`, `moved`, `invalid`, `no-successor` |
| `sxw2-terminal-edge-type` | `7. Every non-terminal edge targets an existing active` | `invalid`, `no-successor` |
| `authority-class` | `The only authority classes are:` | `CBA`, `BYL`, `NBA`, `DERIVED`, `INFERRED`, `OPS`, `EXT` |
| `provenance-type` | `Provenance types (closed vocabulary; exactly one per record):` | `official-immutable`, `official-mutable`, `ops-provenance`, `ext-contract` |
| `dr2-type` | `**Decision-record schemas.** Decision records are parseable rows in the` | `OWN`, `ATOM`, `TG`, `MOVE`, `ORIGIN`, `METHOD`, `AMEND`, `DISP` |
| `disp-subject-class` | `the row's one current generic parent.` | `XW2-DISP`, `SXW2-DISP` |
| `no-owner-reason` | `one the edge type requires:` | `false-claim`, `process-material`, `out-of-scope-or-obsolete`, `authority-not-located` |
| `search-method` | `(the exact provision inspected or the exact query run).` | `full-text-sweep`, `provision-read`, `query`, `index-scan`, `attestation-availability-check` |
| `search-result` | `the search speaks only as` | `qualifying-authority-located`, `no-qualifying-authority-located-in-searched-sources`, `inconclusive` |
| `sm2-subject-class` | `unique, monotonically allocated.` | `XW2-DISP`, `candidate-obligation` |
| `ss2-subject-class` | `Search-set/coverage record (` | `XW2-DISP`, `candidate-obligation` |
| `ss2-required-source-class` | `— deterministic, not maker-selected.**` | `CBA`, `BYL`, `NBA`, `ops-provenance` |
| `coverage-state` | `-separated list with **exactly one token per required` | `covered`, `uncovered` |
| `adequacy-result` | `only an inadequate member, or any member reporting` | `adequate-coverage`, `inadequate-coverage` |
| `blk-subject-class` | `(unique, monotonic).` | `XW2-DISP`, `candidate-obligation` |
| `blk-finding-type` | `discovered obligation.` | `blocked-unsupported-obligation` |
| `blk-finding-status` | `is the canon anchor.` | `open`, `resolved` |
| `res-proposed-outcome` | `Resolution record (composite acceptance field split and bound to the` | `foundation-vocabulary-or-scope-decision`, `authority-located-mint-owner`, `out-of-scope-determination` |
| `res-resolution-status` | `value the checker accepted, or` | `proposed`, `accepted`, `superseded` |
| `acceptance-verdict` | `Under the pinned heading` | `ACCEPT`, `REJECT` |
| `record-status` | `status selects live rows; version drives` | `current`, `superseded` |
| `bundle-class` | `equals the fragment's Normalized fragment scope.` | `active` |
| `bundle-subject-class` | `Bundle subject-class vocabulary:` | `XW2-BND`, `SXW2-BND` |
| `amend-population` | `AMEND population and action vocabularies:` | `GROUP`, `LEAF`, `XW2`, `SRC2`, `SRC2-date-component`, `EV2`, `CBA2-SC`, `SXW2`, `DR2`, `DISP`, `fragment`, `scenario-fragment`, `BND`, `SM2`, `SS2`, `BLK`, `RES` |
| `amend-action` | `Action is` | `revise`, `replace`, `split`, `merge`, `remove` |
| `date-role-kind` | `required, non-empty discriminator: exactly` | `primary`, `scoped:<slug>` |
| `binary-signature-state` | `— exactly one of` | `signed`, `unsigned`, `as-of:<YYYY-MM-DD>` |
| `canonical-actor-class` | `Canonical-actor registry and alias normalization (binding — R2.9;` | `agent:claude`, `agent:codex`, `human:<slug>` |

**Inventory B — pinned schemas (exact; ordered).** `Fields` lists the
governing clause's pinned schema string with `"; "` substituted for the
schema string's own `"|"` delimiter (no field name contains `;`), so the
list survives this markdown table. A conforming validator resolves the
anchor, takes the first backticked pipe-list at or after it, splits it
on `|`, and requires **exact ordered equality** with the list here.

| Schema key | Anchor | Count | Fields |
|---|---|---:|---|
| `SRC2-base` | `Base table (one row per record; all fifteen fields present;` | 15 | `Record ID; Provenance type; Source/provenance identity; Source date (basis:value) or —; Official URL or —; Artifact SHA-256 or —; Artifact byte size or —; Retrieval timestamp or —; Authentication timestamp or —; Verifier identity; Verification session ID; Verification date; Record limitations; Record status; Record version` |
| `SRC2-date-component` | `Date-component detail table (fixed; joinable; stable-identity;` | 10 | `Record ID; Date component ID; Date basis; Date role/scope; Date value; Source statement locator; Limitations or —; Component status; Component version; Superseding/current relationship or —` |
| `SRC2-detail-official-immutable` | `Type-specific detail tables (one pinned schema per provenance type;` | 3 | `Record ID; Source title and edition; Page geometry` |
| `SRC2-detail-official-mutable` | `it hid publication` | 6 | `Record ID; Publication identity; Publication date or —; Season or —; Exact values or text relied upon; Archive/snapshot reference or —` |
| `SRC2-detail-ops-provenance` | `never any other season syntax)` | 8 | `Record ID; Named first-party provenance identity; Authority/role of the source; Practice scope; Effective date or window; Authentication method; Configurability; Artifact identity or —` |
| `SRC2-detail-ext-contract` | `durable artifact exists; Record limitations always required)` | 8 | `Record ID; External determination class; Runtime input schema; Required decision provenance; Scope; Effective/expiration behavior; Controlling source/rule reference or —; Verification/authentication method` |
| `EV2-component` | `Per-LEAF authority-component evidence` | 10 | `Evidence component ID; Active v2 LEAF; Authority class; Source/provenance record IDs or —; Dependency evidence component IDs or —; Exact locator(s); Controlling passage or tight paraphrase; Passage-to-obligation mapping; Formula/inference/provenance details; Limitations/uncertainty` |
| `SM2-record` | `Search-manifest registry (` | 27 | `Search record ID; Subject class; Subject historical LEAF or —; Subject historical fragment ID or —; Subject candidate anchor or —; Authority/provenance class searched; Source identity; Source record ID or —; Canonical URL or authenticated provenance identifier or —; Binary/version identity or —; Binary size bytes or —; Binary SHA-256 or —; Binary pagination or —; Binary signature/as-of or —; Exact locator/query/provision; Search method; Search-set ID or —; Search cutoff timestamp; Result; Result linkage or —; Result details; Limitations or —; Verifier identity; Verification session ID; Verification date; Search status; Search version` |
| `SS2-record` | `Search-set/coverage record (` | 11 | `Search set ID; Subject class; Subject LEAF or —; Subject fragment ID or —; Subject candidate anchor or —; Required source classes; Member SM2 IDs; Coverage assessment; Adequacy result; Set status; Set version` |
| `fragment-inventory` | `- **Fragment-inventory schema (pinned; one row per fragment, in the` | 11 | `Fragment ID; Historical parent LEAF; Fragment kind; Historical authority qualifier or —; Normalized fragment scope; Decomposition decision record; Disposition bundle ID or —; Disposition edge ID(s); Fragment status; Fragment version; Limitations or —` |
| `scenario-fragment-inventory` | `- **Scenario-fragment inventory (exact partition tied to the governed` | 10 | `Scenario fragment ID; Historical scenario; Fragment kind; Normalized fragment scope; Decomposition decision record; Disposition bundle ID or —; Disposition edge ID(s); Fragment status; Fragment version; Limitations or —` |
| `BND-bundle` | `- **Disposition-bundle schema (pinned; fixed; parseable — corrected` | 14 | `Bundle ID; BND subject class; Source historical LEAF or —; Historical scenario or —; Source fragment ID; Member edge IDs; Member edge types; Member target IDs; Member subject scopes; Subject scope; Bundle class; Bundle status; Bundle version; Superseding/current relationship or —` |
| `BLK-record` | `Blocked-finding record (composite subject/search references split and` | 15 | `Blocked finding ID; Subject class; Subject historical LEAF or —; Subject fragment ID or —; Subject candidate anchor or —; Finding type; Search-set ID or —; Search-manifest IDs or —; Evidence references or —; Preserved candidate anchor; Finding status; Finding version; Resolution ID or —; Superseding/current relationship or —; Limitations` |
| `RES-record` | `Resolution record (composite acceptance field split and bound to the` | 18 | `Resolution ID; Blocked finding ID; Proposed outcome; Resolver authority; Maker/proposer identity; Independent checker identity; Proposal receipt path; Accepted checkpoint commit or —; Acceptance receipt commit or —; Acceptance receipt or —; Accepted RES version or —; Accepted content digest or —; Accepted proposed outcome or —; Resolution status; Resolution version; Reopening condition; Limitations; Superseding/current relationship or —` |
| `acceptance-receipt-record` | `Under the pinned heading` | 8 | `Resolution ID; Accepted RES version; Accepted content digest; Accepted proposed outcome; Maker/proposer identity; Independent checker identity; Accepted checkpoint commit; Acceptance verdict` |
| `DR2-generic` | `**Decision-record schemas.** Decision records are parseable rows in the` | 8 | `DR ID; Type; Subject(s); Disposition; Test/tiebreak applied; Rationale; Resulting active LEAF(s) or —; Unit/commit` |
| `AMEND-detail` | `**AMEND detail schema (binding; cross-population lineage, added` | 9 | `AMEND record ID; Population; Prior record ID; Prior version or —; Prior checkpoint commit; Action; Current record ID(s) or —; Current version(s) or —; Reason` |
| `DISP-detail` | `detail schema (binding; fixed, parseable, and polymorphic by` | 19 | `DR2 record ID; DISP subject class; Historical source LEAF or —; Historical fragment ID or —; Historical scenario or —; Scenario fragment ID or —; Normalized scope; Terminal edge ID; Terminal edge type; Search-manifest IDs or —; Search-set ID or —; Evidence/provenance references or —; No-owner reason; Preserved candidate anchor or —; Limitations; Reopening condition; Superseding/current relationship or —; Status; Version` |
| `XW2-edge` | `Pinned crosswalk-edge schema string (binding; identical in content and` | 6 | `Edge ID; Historical v1.1 LEAF; Active v2 LEAF or —; Edge type; Scope/relationship; Decision record` |
| `SXW2-edge` | `**Scenario crosswalk** (` | 6 | `Edge ID; Historical scenario; Active v2 scenario or —; Edge type; Scope/relationship; Decision record` |
| `LEAF-main` | `Physical layout (binding for R3–R6): per family, a main table` | 8 | `ID; Requirement; Authority; Primary; Secondary; Evidence; Origin; Notes` |
| `LEAF-detail` | `plus a detail table keyed by ID for` | 4 | `Scenario evidence; Dependencies; Lifecycle/date inputs; Decision records` |
| `GROUP-index` | `uniform layout across families. GROUP rows are carried per family as` | 4 | `ID; Title/audit question; Active LEAF children; Notes` |

The `XW2-…` crosswalk is additionally declared as a two-column field
table in §15.9.3; its pinned schema string and that table's first column
carry the same fields in the same order. The
`LEAF-detail` physical table is that pinned four-field list **keyed by
`ID`**, so its rendered header is `ID` followed by the four fields.

**Inventory C — cross-schema dependencies (binding).** This inventory is
the authoritative data dictionary for schemas, vocabularies, population
locations, preservation anchors, and the listed field couplings. It is
not an exhaustive inventory of every algorithm or join implemented by a
validator. A listed field on the left is meaningless unless the field on
the right exists in its own pinned schema; removing either side without a
governed migration fails.

| Dependent schema.field | Required counterpart schema.field | Governing rule |
|---|---|---|
| `SM2-record.Binary size bytes or —` | `SRC2-base.Artifact byte size or —` | SM2 ⇔ current-`SRC2` byte-size equality (§15.9.6) |
| `SM2-record.Binary SHA-256 or —` | `SRC2-base.Artifact SHA-256 or —` | SM2 ⇔ current-`SRC2` hash equality (§15.9.6) |
| `SM2-record.Subject candidate anchor or —` | `BLK-record.Subject candidate anchor or —` | `candidate-obligation` subject variant (§15.9.6/§15.9.3) |
| `SS2-record.Subject candidate anchor or —` | `SM2-record.Subject candidate anchor or —` | Search-set/member subject identity (§15.9.6) |
| `SS2-record.Member SM2 IDs` | `SM2-record.Search-set ID or —` | Bidirectional set membership (§15.9.6) |
| `DISP-detail.Normalized scope` | `fragment-inventory.Normalized fragment scope` | Joinable span-set equality (§15.9.4/§15.9.3) |
| `DISP-detail.Search-set ID or —` | `SS2-record.Search set ID` | `unsupported-residual` coverage binding (§15.9.4) |
| `BND-bundle.Member subject scopes` | `fragment-inventory.Normalized fragment scope` | Exhaustive member coverage of the fragment (§15.9.3) |
| `BND-bundle.Member edge IDs` | `fragment-inventory.Disposition edge ID(s)` | Set-equality of bundle members and fragment edges (§15.9.3) |
| `BND-bundle.Member edge IDs` | `scenario-fragment-inventory.Disposition edge ID(s)` | Scenario-bundle member reconciliation (§15.9.8) |
| `RES-record.Accepted content digest or —` | `acceptance-receipt-record.Accepted content digest` | Acceptance bound to parsed receipt evidence (§15.9.3) |
| `RES-record.Accepted checkpoint commit or —` | `acceptance-receipt-record.Accepted checkpoint commit` | Receipt row bound to the maker checkpoint it accepts (§15.9.3) |
| `RES-record.Acceptance receipt commit or —` | `RES-record.Acceptance receipt or —` | The receipt commit locates the acceptance record (§15.9.3) |
| `RES-record.Proposal receipt path` | `RES-record.Accepted checkpoint commit or —` | The accepted maker checkpoint contains the exact proposed RES row at this path before later acceptance (§15.9.3) |
| `BLK-record.Resolution ID or —` | `RES-record.Resolution ID` | Resolved findings name a current resolution (§15.9.3) |
| `SRC2-base.Source date (basis:value) or —` | `SRC2-date-component.Date value` | Base pair equals its basis's current `primary` component (§15.9.6) |
| `SRC2-date-component.Component status` | `record-status` | Exactly one current component per (record, basis, role/scope) (§15.9.6) |

**Inventory D — immutable-range preservation anchors (binding).** These
ranges of this file are **never edited** by any repair unit. A range is
the bytes from the first byte of the first line **beginning with** the
`From line prefix` to the last byte before the first later line
**beginning with** the `To line prefix`; the hash is the SHA-256 of
exactly those bytes. A repair unit that changes any of them has violated
its preservation boundary.

| Range key | From line prefix | To line prefix | SHA-256 |
|---|---|---|---|
| `sec-5.9` | `### 5.9` | `## 6.` | `53c968ade8cdb2177517412ac09f2bae63ee7642cfa3b24299d2b208895fb373` |
| `sec-15.1-15.8` | `### 15.1` | `### 15.9` | `7b3f6aaba81129dceaa8e55f6356f8bbecd3af7e1ff59b127a443fc5d7b14d97` |
| `sec-16-scenarios` | `## 16. Acceptance-test library` | `### 16.v2 Active v2 scenario library and scenario crosswalk` | `eb11bb122840f881204be4d3de9b8a47a680a19622677e4287227730615b311f` |

**Inventory E — pinned commits (binding).** Every population is read
from a pinned source; a validator that invents a population, or reads
one from anywhere else, is not conforming.

| Pinned commit key | Commit | Role |
|---|---|---|
| `published-v1.1` | `9814939c794595b988de21d8013934dc5342c8ee` | The frozen published v1.1 edition — the sole historical source of every `XW2-…`/`SXW2-…` edge, of every published LEAF's normalized Canonical requirement text, and of scenarios 1–89 (file SHA-256 `4a0760c81d7a5e95919a0373d5ff631b565d064d56b858fe3b8869ad2b6bb3f6`; §16 range 14,390 bytes, SHA-256 `5289f6b812c2d86238674461574c725e894f0bca0db4da188b276246d96706aa`) |
| `r3-checkpoint` | `07f0667d8cc55a6b86bd4c3fabada5d9b6d7d956` | The committed R3 legacy population — the identity-preservation baseline |

**Inventory F — canon-side population sections (binding).** Each
population below is exactly the pipe-delimited rows of its pinned field
count, whose first cell matches its ID grammar, inside the section
running from the first line beginning with `From line prefix` to the
first later line beginning with `To line prefix`, in this file.

| Population | From line prefix | To line prefix | ID grammar (regex) |
|---|---|---|---|
| `GROUP-index` | `#### 15.10.1` | `#### 15.10.2` | `CBA2-[A-Z][0-9]{2}` |
| `LEAF-main` | `#### 15.10.2` | `#### 15.10.3` | `CBA2-[A-Z][0-9]{2}\.[0-9]+` |
| `LEAF-detail` | `#### 15.10.3` | `### 15.11` | `CBA2-[A-Z][0-9]{2}\.[0-9]+` |
| `XW2-edge` | `### 15.11` | `### 15.12` | `XW2-[0-9]{4}` |
| `SRC2-base` | `#### 15.12.1` | `#### 15.12.2` | `SRC2-[0-9]{3}` |
| `SRC2-detail-official-immutable` | `#### 15.12.2` | `#### 15.12.3` | `SRC2-[0-9]{3}` |
| `SRC2-detail-official-mutable` | `#### 15.12.3` | `#### 15.12.4` | `SRC2-[0-9]{3}` |
| `SRC2-detail-ops-provenance` | `#### 15.12.4` | `#### 15.12.5` | `SRC2-[0-9]{3}` |
| `SRC2-detail-ext-contract` | `#### 15.12.5` | `#### 15.12.6` | `SRC2-[0-9]{3}` |
| `EV2-component` | `#### 15.12.6` | `## 16.` | `EV2-[0-9]{4}` |
| `SXW2-edge` | `#### 16.v2.2 Scenario crosswalk` | `## 17.` | `SXW2-[0-9]{4}` |

The `LEAF-detail` and `GROUP-index` physical tables are keyed by `ID`,
so their rendered field counts are their pinned counts (the pinned
`LEAF-detail` list does not repeat the key). The OPS/EXT detail and v2
scenario-crosswalk sections may be absent and therefore empty before
their triggering construction units; when present, their rows can
exist only at the governed locations above.

**Whole-canon governed-row location audit (binding; R2.13).** Inventory F
is the sole source of canon-side population grammars and ranges. The
validator scans every pipe-delimited row in the entire canon. When the
first cell matches one or more Inventory F ID grammars, that physical row
must lie inside the union of every matching declared interval; a row
outside every matching interval fails and reports its ID plus all permitted
population/range declarations. Identical or overlapping grammars therefore
use union admission — in particular, the five `SRC2-[0-9]{3}` base/detail
declarations do not make a valid row fail merely because it is outside one
other SRC2 interval. Once admitted, the existing per-range parsers still
enforce exact field counts, schemas, and base-type/detail-location
reconciliation, including the separate OPS and EXT detail contracts.

**Governed record-ID cell normalization (binding; R2.14).** Before an ID
grammar is evaluated, ordinary population membership and the whole-canon
location audit use one identical normalization: trim outer cell whitespace;
accept a plain ID or remove exactly one balanced Markdown code-span fence
made from an equal, nonempty run of backticks; and leave malformed,
unbalanced, or internally backticked fencing intact so it cannot become a
valid ID. Equivalent receipt-population and direct acceptance/proposal
membership paths use the same routine. No parser may substitute arbitrary
backtick stripping or single-pair-only unwrapping, and no validator-side
population list may replace Inventory F.

**Inventory G — support populations in performing-unit receipts
(binding).** A support population is located by its **pinned heading
token**: its rows are exactly the pipe-delimited rows, of that
population's pinned field count, whose first cell matches its ID
grammar, under a markdown heading whose text contains the token, up to
the next heading of the same or higher level, in any file under
`work/architect-completion/`. A row of the right shape outside its
pinned heading block is not part of the population; a row inside the
block whose field count differs from the pinned schema **fails** the
population.

| Population | Pinned heading token | ID grammar (regex) |
|---|---|---|
| `DR2-generic` | `Decision records` | `DR2-[0-9]{4}` |
| `AMEND-detail` | `AMEND detail rows` | `DR2-[0-9]{4}` |
| `DISP-detail` | `DISP detail rows` | `DR2-[0-9]{4}` |
| `fragment-inventory` | `Fragment inventory` | `CBA-[A-Z][0-9]{2}(\.[0-9]+)?:F[0-9]+` |
| `BND-bundle` | `Disposition bundles` | `BND-[0-9]{4}` |
| `SM2-record` | `Search manifests` | `SM2-[0-9]{4}` |
| `SS2-record` | `Search sets` | `SS2-[0-9]{4}` |
| `BLK-record` | `Blocked findings` | `BLK-[0-9]{4}` |
| `RES-record` | `Resolutions` | `RES-[0-9]{4}` |
| `SRC2-date-component` | `Date components` | `SRC2-[0-9]{3}` |
| `scenario-fragment-inventory` | `Scenario fragment inventory` | `scenario-[0-9]+:F[0-9]+` |
| `acceptance-receipt-record` | `Independent acceptance record` | `RES-[0-9]{4}` |

**Preservation versus conformance (binding; the distinction R2.10
makes explicit).** Two different duties were previously conflated into
one set of fixed population totals, which both false-rejected
legitimate future additions and let count-preserving substitutions pass:

- **Identity preservation** is a duty over the **committed R3 legacy
  population**. Every ID allocated at the pinned R3 checkpoint must
  still **resolve** in the live document — present as a current record,
  or resolved forward through a valid `AMEND` chain to a current
  successor or an explicit removal (§15.9.2). Renaming, renumbering,
  reusing, substituting, dropping, or duplicating any committed ID
  fails preservation. Preservation is checked against the **pinned R3
  checkpoint commit**, never against a total.
- **Schema conformance** is a duty over **whatever population is
  present**, current and future alike: grammar, membership, references,
  and reconciliation. It carries **no fixed totals**, so an append-only
  addition above any namespace's current high-water mark conforms if and
  only if it is well-formed.

A fixed expected count is therefore **never** a conformance criterion,
and identity preservation is **never** satisfied by a matching count.

#### 15.9.12 Balanced certification authority (binding; R2.12)

This subsection controls whenever an earlier clause, gate, receipt, or
validator description assigns a broader burden to software. Phase 1 uses
a **balanced certification standard**:

- The mechanical validator enforces deterministic document facts: IDs,
  exact schemas and headers, closed vocabularies, typed references and
  joins, direct-current-reference rules, source identities and locators,
  rooted acyclic evidence structure, declared span partitions, structured
  amendment lineage, immutable-range and committed-identity preservation,
  and the absence of silent deletion within those declared structures.
- The independent checker decides NBA/CBA truth, whether a cited source
  actually supports the proposition, reasonableness of semantic
  atomicity/ownership/coverage decisions, evidence adequacy, substantive
  completeness, and actual maker/checker separation. The checker records
  the basis for those judgments; parser output never substitutes for it.
- Software does **not** prove real-world identity, intellectual
  independence, semantic perfection, universal completeness, legal
  persuasiveness, source truth from locator wording, or that no relevant
  authority exists outside the searched and recorded sources.

The R2.10–R2.13 review findings are classified exhaustively below.
R2.11–R2.13 are immutable rejected history; R2.14 is accepted as settled by
the current goal objective authority, the first pre-R3.1 compatibility
checkpoint was independently accepted at `c3a00637`, and the owner-authorized
same-family compatibility checkpoint was independently accepted at
`d6101f82` by `/root/validation_scout`. Neither compatibility acceptance nor
maker execution accepts an active A-series record. The R3.1 maker checkpoint
has executed and is pending an independent R3.1 checker ACCEPT; R4 remains
blocked until that ACCEPT. "Mechanical"
means a rejecting validator control; "checker" means a required
independent-review judgment; "retired" means the earlier formal-proof
claim is no longer part of acceptance.

| Foundation review finding | Balanced disposition |
|---|---|
| Acceptance evidence omitted the checkpoint commit it was required to compare, duplicate rows overwrote one another, and the gate compared only a subset | **Mechanical:** eight-field receipt schema including `Accepted checkpoint commit`; the RES row separately carries the resolvable `Acceptance receipt commit` and path; exactly one matching receipt row; exact RES ID/version/outcome/digest/maker/checker/checkpoint/backlinks. **Checker:** actual authorship, chronology, and independent judgment. **Retired:** canonical-alias software proof of identity or intellectual independence. |
| `G15R` was a twelve-slot presence report with a synthetic R12 and dummy-population pressure | **Mechanical:** report actual touched/required populations and execute their applicable schema, lineage, reference, and population-specific controls. Honest optional `BND`, `BLK`, `RES`, scenario, and search-population absence is valid. **Retired:** fixed twelve-population cross-product and omission case per label. |
| Inventory C and §15.9.11 claimed to enumerate every dependency/algorithm | **Mechanical:** inventory remains authoritative for declared schemas, vocabularies, locations, anchors, and listed field couplings. **Retired:** exhaustive-algorithm and hidden-logic prohibition beyond those declarations. |
| DR2 validation ignored required fields, references, headers, and result/unit grammar | **Mechanical:** exact header, eight required fields, typed IDs/references, result compatibility, and unit/commit grammar. **Checker:** rationale, tiebreak, atomicity, and ownership quality. |
| AMEND lifecycle covered only four populations and preservation trusted free prose | **Mechanical:** AMEND-detail parent/prior/current/action/version joins, acyclic forward lineage, direct current endpoints, and preservation only through structured lineage. **Checker:** content preservation and adequacy of amendment reasons. Universal same-commit proof is retired; chronology is reviewed. |
| Scenario fragments were parsed using the historical-LEAF schema and bundles excluded SXW2 | **Mechanical:** distinct scenario-fragment schema and joins; `SXW2-BND` support; exact scenario span partition. **Checker:** whether the fragments faithfully and completely express scenario meaning. |
| BND checked only combined coverage, not each member against its edge scope | **Mechanical:** position-aligned member ID/type/target/scope equality against each XW2 or SXW2 edge plus nonoverlapping union equality. |
| SXW2 DISP omitted normalized-scope equality | **Mechanical:** the same edge/detail span-set equality for XW2 and SXW2. |
| EV2 checked only direct references | **Mechanical:** exact reference grammar, acyclic complete dependency closure, permitted dependency classes, terminal provenance-root matrix, direct LEAF↔EV membership, and typed roots. **Checker:** whether the class/source choice and substantive mapping are supportable. |
| Source-date heuristics attempted to infer truth from words such as "cover" or "metadata" | **Mechanical:** date/value grammar, component identity/status/version/cardinality, declared locator presence, and joins. **Checker:** whether the cited source actually supports the date basis and precision. **Retired:** keyword-based source-truth proof. |
| R2.8 crosswalk findings mixed structural and substantive burdens | **Mechanical:** schema/ID/reference/scope/lineage items and exact joins. **Checker:** source support, semantic coverage, ownership, atomicity, and adequacy. **Retired:** an exact regression-count total as a certification artifact. |
| Plan dependencies allowed long maker runs before independent review and expanded R8/R9 beyond Phase 1 | **Mechanical/process:** each maker unit R3.1 and R4–R8 is followed by an independent checker before the next maker unit. R8 is document/register reconciliation only—no README, code-map, application, or runtime work. R9 runs read-only from a clean topic-branch checkpoint; its ACCEPT plus explicit owner acceptance is required before Phase 2. |
| R2.11 accepted a maker checkpoint committed before the exact proposed RES existed | **Mechanical:** `Proposal receipt path` resolves at the accepted maker checkpoint to exactly one unaccepted/proposed RES row with the exact binding content and version; the later checker-receipt commit descends from that checkpoint. Absent, duplicate, wrong-path, already-accepted, or mismatched proposal content rejects. **Checker:** actual authorship, chronology outside Git ancestry, and independent judgment. |
| R2.11 omitted mechanically required SRC2/EV2 fields, GROUP child counts, LEAF references, and version lineage | **Mechanical:** every required SRC2 base/detail field and grammar, EV2 locator/passage/mapping, GROUP declared child range/count, and Origin/dependency reference is checked. A version above `1` for fragment/scenario-fragment/BND/SM2/SS2 requires a matching structured AMEND detail whose pinned prior checkpoint contains that exact identity at the recorded immediately prior version. **Checker:** whether source statements, mappings, and semantic dependencies are substantively correct. |
| R2.11 BND prose required XW2 IDs for both variants and an impossible edge-to-bundle backlink | **Mechanical:** `XW2-BND` members are XW2 IDs and `SXW2-BND` members are SXW2 IDs; representable joins are fragment→bundle, bundle→edges, and edge→fragment/positional scope. The nonexistent per-edge bundle backlink is retired. |
| OPS/EXT details and SXW2 lacked governed real population locations | **Mechanical:** Inventory F locates OPS/EXT detail populations in §15.12.4/§15.12.5, EV2 in §15.12.6, and SXW2 in §16.v2.2; absent pre-trigger populations are empty, while present rows outside those ranges fail. |
| Live R8/R9 gates still required code-map/Phase2/README/runtime work or claimed R9 alone unblocked Phase 2 | **Mechanical/process:** G5–G7 are Phase 1 canon/boundary controls; G12 updates only canon/plan/receipt status; R9 performs document/source review with no runtime/code-map sampling. R9 ACCEPT plus explicit owner acceptance is required before Phase 2. |
| Governed-ID pipe rows outside every Inventory F range were silently ignored | **Mechanical:** scan every canon pipe row against every Inventory F ID grammar and require it inside the union of all matching intervals; report the displaced ID and all permitted ranges. Existing per-range schema/type/detail reconciliation remains binding after location admission. |
| R2.13 normalized governed-ID cells differently between ordinary population parsing and location detection, and live plan mirrors retained an obsolete R2.12-current route | **Mechanical:** one balanced-backtick record-ID cell normalizer serves every directly equivalent membership/location path; plain and multi-backtick displaced controls must reject, a synthetic Inventory-F-only grammar proves generic behavior, and distinct plan regressions reject stale live R2.12-current and R2.13-current language. The same route check rejects either obsolete checkpoint as the prerequisite in a live R3.1 blocking condition. **Process:** R2.13 is immutable rejected history; R2.14 is accepted as settled by current goal authority, and only independent acceptance of the one-time compatibility checkpoint may now unblock R3.1. |

The validator's default control set must be deterministic, bounded, and
complete in under four minutes on the project machine. An optional extended
diagnostic suite may exist but is not the foundation acceptance gate. A
fixed count of passing controls is never itself proof of completeness.

### 15.10 Active v2 register (created by R3; A family)

This section is the active v2 registry of §15.9.1. R3.1 repaired the A family through governed AMEND lineage after the one-time compatibility checkpoint was independently accepted. The current maker population is 12 GROUPs and 151 active LEAFs; it remains a working draft pending an independent R3.1 checker. Scenario evidence remains pending R7. Nothing here carries a Phase 2 verdict before R9 ACCEPT plus owner acceptance.

#### 15.10.1 A family — GROUP index

| ID | Title/audit question | Active LEAF children | Notes |
|---|---|---|---|
| CBA2-A01 | Independent transaction-salary bases — Are the CBA's distinct salary quantities derived independently for the same player, team, and date? | `CBA2-A01.1` (1) | GROUP anchor; no obligation, verdict, method, locator, or evidence |
| CBA2-A02 | Traded Player Exception paths — Are the Standard, Aggregated, Transition, Expanded, and room acquisition paths enforced with their exact structures, limits, and exclusions? | `CBA2-A02.1`–`CBA2-A02.14` (14) | GROUP anchor; no obligation, verdict, method, locator, or evidence |
| CBA2-A03 | Trade-salary value adjustments — Are outgoing and incoming trade-salary values adjusted exactly as the signed text requires (non-guarantees, base-year, poison pill, bonuses, minimum contracts)? | `CBA2-A03.1`–`CBA2-A03.18` (18) | GROUP anchor; no obligation, verdict, method, locator, or evidence |
| CBA2-A04 | Trade bonus — Are trade bonuses limited, triggered, allocated, amended, and charged exactly as the signed text requires? | `CBA2-A04.1`–`CBA2-A04.39` (39) | GROUP anchor; no obligation, verdict, method, locator, or evidence |
| CBA2-A05 | Apron transaction restrictions and hard caps — Are the Transaction Restrictions Table rows, the post-transaction apron test, the resulting hard caps, and the post-regular-season dual-year rules enforced? | `CBA2-A05.1`–`CBA2-A05.18` (18) | GROUP anchor; no obligation, verdict, method, locator, or evidence |
| CBA2-A06 | Aggregation restrictions on Traded Players — Are the two-month aggregation bar, its December 16 carve-out, and the Minimum Traded Player stacking limit enforced? | `CBA2-A06.1`–`CBA2-A06.3` (3) | GROUP anchor; no obligation, verdict, method, locator, or evidence |
| CBA2-A07 | Sign-and-trade conditions — Is every VII §8(e)(1) sign-and-trade condition independently enforced? | `CBA2-A07.1`–`CBA2-A07.10` (10) | GROUP anchor; no obligation, verdict, method, locator, or evidence |
| CBA2-A08 | Cash in trades — Are the separate annual cash limits, the signing-bonus-as-cash rule, the Salary-Cap-Year charging rule, and the no-Team-Salary-effect rule enforced? | `CBA2-A08.1`–`CBA2-A08.7` (7) | GROUP anchor; no obligation, verdict, method, locator, or evidence |
| CBA2-A09 | Roster room at trade — Is the BYL 4.05(e) list-room requirement enforced at the Trade Call? | `CBA2-A09.1` (1) | GROUP anchor; no obligation, verdict, method, locator, or evidence |
| CBA2-A10 | Extension-and-trade — Are the VII §8(e)(2) mechanism, window, term, salary, raise, ordinary-extension eligibility, and six-month restrictions enforced? | `CBA2-A10.1`–`CBA2-A10.30` (30) | GROUP anchor; no obligation, verdict, method, locator, or evidence |
| CBA2-A11 | Per-team component decomposition — Is each team's side of a multi-player transaction evaluated separately with legal component-trade decomposition? | `CBA2-A11.1` (1) | GROUP anchor; no obligation, verdict, method, locator, or evidence |
| CBA2-A12 | Pick-trading legality — Are pick-conveyance validity, the Stepien rule, the Second Apron frozen-pick rules, and Trade Call/Memorandum disclosure consequences enforced? | `CBA2-A12.1`–`CBA2-A12.9` (9) | GROUP anchor; no obligation, verdict, method, locator, or evidence |

#### 15.10.2 A family — active LEAF register (main table)

| ID | Requirement | Authority | Primary | Secondary | Evidence | Origin | Notes |
|---|---|---|---|---|---|---|---|
| CBA2-A01.1 | Team Salary, Apron Team Salary, Tax-related Team Salary, player Compensation, and per-team trade-salary values (pre-trade and post-assignment Salaries) are distinct defined quantities; no ledger's value may be substituted for another's — each must be derived from its own definitional rule for the given team, player, and date | INFERRED | STATIC | — | EV2-0001 | XW2-0001, XW2-0002, XW2-0003 | One indivisible non-substitution rule over the named ledgers; the ledger list is a homogeneous set of inputs to the same architecture constraint, not multiple behavioral outcomes. |
| CBA2-A02.1 | Standard TPE structure: the Standard Traded Player Exception replaces exactly one Traded Player with one or more Replacement Players, whose Contracts may be acquired simultaneously or non-simultaneously | CBA | SCEN | — | EV2-0002 | XW2-0045, XW2-0054 | One outgoing player per Standard TPE; receiving multiple players for the one Traded Player is expressly permitted. |
| CBA2-A02.2 | Standard TPE limit: the Replacement Players' post-assignment Salaries for the Salary Cap Year of acquisition may not, in aggregate, exceed 100% of the Traded Player's pre-trade Salary plus the $250,000 allowance as governed by CBA2-A02.12 | CBA | SCEN | — | EV2-0003 | XW2-0046 | Pre-trade Salary is computed under the CBA2-A03 adjustments (VII §6(j)(6)). |
| CBA2-A02.3 | Standard TPE non-simultaneous window: any Replacement Player Contract acquired non-simultaneously under the Standard TPE must be acquired within one year following the date the Traded Player was traded | CBA | SCEN | LIFECYCLE | EV2-0004 | XW2-0047, XW2-0053 | The remainder persists and supports partial use until expiry; apron timing limits are owned by CBA2-A05.8. |
| CBA2-A02.4 | Aggregated TPE structure: the Aggregated Standard Traded Player Exception replaces two or more Traded Players with one or more Replacement Players whose Contracts are acquired simultaneously only | CBA | SCEN | — | EV2-0005 | XW2-0049 | Subject to the CBA2-A06 aggregation restrictions. |
| CBA2-A02.5 | Aggregated TPE limit: the Replacement Players' post-trade Salaries for the then-current Salary Cap Year may not, in aggregate, exceed 100% of the aggregated pre-trade Salaries of the Traded Players plus the $250,000 allowance as governed by CBA2-A02.12 | CBA | SCEN | — | EV2-0006 | XW2-0050 | — |
| CBA2-A02.6 | Transition TPE boundary: the 110% Transition Traded Player Exception existed for the 2023-24 Salary Cap Year only and must not be available in any later Salary Cap Year (historical-simulation contexts only) | CBA | SCEN | STATIC | EV2-0007 | XW2-0013 | Historical-edition scope: usable only in a simulated 2023-24 Salary Cap Year. |
| CBA2-A02.7 | Expanded TPE structure: the Expanded Traded Player Exception replaces one or more Traded Players with one or more Replacement Players whose Contracts are acquired simultaneously | CBA | SCEN | — | EV2-0008 | XW2-0007 | — |
| CBA2-A02.8 | Expanded TPE limit: the Replacement Players' aggregate post-trade Salaries for the then-current Salary Cap Year may not exceed max(min(200% × O + K, 100% × O + A), 125% × O + K), where O is aggregated pre-trade Salary, K is the CBA2-A02.12 allowance, and A = $7,500,000 × (current Salary Cap ÷ 2023-24 Salary Cap) | CBA, NBA, DERIVED | SCEN | — | EV2-0009, EV2-0010, EV2-0011, EV2-0012 | XW2-0004, XW2-0008, XW2-0011 | Owns only the governing formula and its current-season inputs. Display rounding, UI tiering, and implementation strategy are not active obligations. |
| CBA2-A02.9 | Room path limit: a Team with a Team Salary below the Salary Cap may acquire one or more players by assignment whose aggregate post-assignment Salaries do not exceed the Team's room under the Salary Cap plus $250,000 (allowance governed by CBA2-A02.12) | CBA | SCEN | — | EV2-0013 | XW2-0043 | — |
| CBA2-A02.10 | Room-path exclusivity: a Team that acquires players under VII §6(j)(1)(v) or with room under the Salary Cap may not simultaneously acquire any player under VII §6(j)(1)(i)-(iv) | CBA | SCEN | — | EV2-0014 | XW2-0044 | — |
| CBA2-A02.11 | Below-cap election: in lieu of the room path, a Team with a Team Salary below the Salary Cap may conduct a trade in accordance with VII §6(j)(1)(iii)-(iv), notwithstanding VII §6(n) | CBA | SCEN | — | EV2-0015 | new (DR2-0043) | The (iii) alternative is 2023-24-only via CBA2-A02.6. |
| CBA2-A02.12 | $250,000 allowance zeroing: if a Team's post-assignment Apron Team Salary would exceed the First Apron Level, the $250,000 allowance referenced in each of VII §6(j)(1)(i)-(v) is reduced to $0 | CBA | SCEN | — | EV2-0016 | XW2-0005, XW2-0014 | Uses post-assignment Apron Team Salary (VII §2(e)(1)), never post-trade Team Salary; the Apron Team Salary computation itself is C-family (registered by R4). |
| CBA2-A02.13 | DPE-disabled-player exclusion: no Traded Player Exception arises from trading a player during a Salary Cap Year if the Team previously used (or simultaneously uses) a Disabled Player Exception in respect of that player during that Salary Cap Year | CBA | SCEN | LIFECYCLE | EV2-0017 | XW2-0152 | Attaches to the disabled player only, never automatically to the DPE replacement player. |
| CBA2-A02.14 | Two-Way exclusion: the VII §6(j) Traded Player Exception rules do not apply to Two-Way Players — no Traded Player Exception arises from trading a Two-Way Player, and Two-Way Contracts are excluded from Traded Player and Replacement Player calculations | CBA | SCEN | — | EV2-0018 | XW2-0154 | Two-Way contract shape/eligibility rules remain C-family (historical C20; R5). |
| CBA2-A03.1 | Non-guaranteed reduction (general): for TPE calculation, a Traded Player's Salary is deemed reduced by the player's unearned Base Compensation that, at the time of the trade, is not fully protected for lack of skill and injury or illness (or may become not fully protected due to Exhibit 2 conditions or limitations) | CBA | SCEN | — | EV2-0019 | XW2-0015, XW2-0016, XW2-0017 | Governs the pre-trade/outgoing side of every VII §6(j) calculation from July 1 through January 7, subject to CBA2-A03.2 and CBA2-A03.3. |
| CBA2-A03.2 | In-season deeming window: for assignments occurring from January 8 through the last day of the Regular Season, a Traded Player's Base Compensation for that Season is deemed fully protected for lack of skill and injury or illness | CBA | SCEN | — | EV2-0020 | XW2-0018 | — |
| CBA2-A03.3 | Post-season window: for assignments from the day after the last day of a Regular Season through June 30, a Traded Player's Salary equals the lesser of (x) his Salary for the current Salary Cap Year and (y) his Salary for the subsequent Salary Cap Year reduced by the subsequent year's unearned Base Compensation not fully protected for lack of skill and injury or illness | CBA | SCEN | — | EV2-0021 | XW2-0019 | — |
| CBA2-A03.4 | Sign-and-trade base-year deemed Salary: when CBA2-A03.13's complete VII §6(j)(5) trigger is satisfied, the assignor uses the greater of the Salary for the final Season of the preceding Contract and 50% of first-Season Salary under the new Contract | CBA | SCEN | — | EV2-0022 | XW2-0020, XW2-0059 | Owns only the greater-of calculation. Trigger eligibility is CBA2-A03.13; the prior-minimum reimbursement component is CBA2-A03.9. |
| CBA2-A03.5 | Poison-pill deemed average: when a Rookie Scale Contract extended under VII §7(b) is proposed to be traded before the first day of the Salary Cap Year following the Extension, then — only for determining whether the acquiring Team has Room for the Contract, where Room (Article I §1(kkk)) includes both room under the Salary Cap and entitlement to use a Traded Player Exception — the Salary for the last Salary Cap Year of the original term is deemed equal to the average of the aggregate Salaries of that year and each extended-term year | CBA | SCEN | — | EV2-0023 | XW2-0021, XW2-0022 | The assignor's outgoing value is unaffected (VII §8(g) applies 'only for purposes of determining whether the acquiring Team has Room'); Option Years count as Seasons (VII §9(a)(2)). |
| CBA2-A03.6 | Poison-pill Salary Cap assumption: for CBA2-A03.5, percentage-based extended-term Salary is determined using a first extended-term Salary Cap equal to 104.5% of the Salary Cap at the proposed trade | CBA | SCEN | — | EV2-0024 | new (DR2-0044) | One calculation input only. The Higher Max assumption is CBA2-A03.14; deemed-amendment treatment is CBA2-A03.10. |
| CBA2-A03.7 | Team-context bonus re-testing: a Performance Bonus is included in Salary only if it would be earned had the Team's or player's performance been identical to the immediately preceding Salary Cap Year; applied per team context, a team-criterion bonus is re-tested against each team's own preceding performance, so the pre-trade (assignor) and post-assignment (assignee) Salary values for the same player can differ | CBA, INFERRED | SCEN | — | EV2-0025, EV2-0026 | XW2-0023, XW2-0024 | The VII §3(d)(2)-(5) Expert-challenge override is an external determination owned by the L-family (R6); pending such a determination the default preceding-season test governs. |
| CBA2-A03.8 | Minimum Exception acquisition permission: an assignee may acquire by assignment a Contract that separately satisfies CBA2-A03.16–A03.18 through the Minimum Player Salary Exception | CBA | SCEN | — | EV2-0027 | XW2-0039 | Owns only the express acquisition permission. The two independent capacity consequences are CBA2-A03.11 and CBA2-A03.15; the assignor reimbursement exclusion is CBA2-A03.12. |
| CBA2-A03.9 | Base-year prior-minimum reimbursement: when the preceding Contract was a one-year Contract at the Minimum Player Salary, the Salary used in the CBA2-A03.4 preceding-Contract branch includes the League-reimbursed amount | CBA | SCEN | — | EV2-0090 | XW2-0132 | A separate calculation component of VII §6(j)(5). |
| CBA2-A03.10 | Poison-pill over-maximum deemed amendment: if extended-term Salary plus Unlikely Bonuses determined under CBA2-A03.6 would exceed the applicable Maximum Annual Salary, the extended-term amounts are deemed amended under Article II §7(c) for the CBA2-A03.5 average | CBA | SCEN | — | EV2-0091 | new (DR2-0094) | The deemed amendment is distinct from the §8(g)(i) input assumptions. |
| CBA2-A03.11 | Minimum Exception TPE-capacity consequence: when an assignee acquires a qualifying Contract through VII §6(i), that acquisition consumes no Traded Player Exception capacity | CBA, INFERRED | SCEN | — | EV2-0029, EV2-0092 | XW2-0140, XW2-0141 | One capacity consequence only; the separate no-room consequence is CBA2-A03.15. This is not a `$0` Salary rule. |
| CBA2-A03.12 | Assignor reimbursement exclusion: in the assignor's VII §6(j)(6) pre-trade Salary calculation for a one-year Minimum Contract, unearned Base Compensation excludes the portion reimbursed by the League | CBA | SCEN | — | EV2-0028, EV2-0093 | XW2-0142 | Assignor-side calculation only. |
| CBA2-A03.13 | Sign-and-trade base-year trigger: CBA2-A03.4 applies only when (x) a Qualifying Veteran Free Agent or Early Qualifying Veteran Free Agent enters a new Contract with his Prior Team under VII §6(b)(1) or (3) in connection with a VII §8(e)(1) sign-and-trade, (y) the Team's Team Salary immediately after signing is above the Salary Cap, and (z) first-Season Salary plus Unlikely Bonuses under that new Contract exceeds the amount the player could receive as a Non-Qualifying Veteran Free Agent under VII §6(b)(2) | CBA | SCEN | — | EV2-0113 | new (DR2-0094) | Owns the complete conjunctive eligibility predicate only; the deemed-Salary calculation and reimbursement component remain separate. |
| CBA2-A03.14 | Poison-pill Higher Max assumption: for CBA2-A03.5, assume the player does not satisfy Higher Max Criteria in his fourth Season when determining percentage-based extended-term Salary | CBA | SCEN | — | EV2-0114 | new (DR2-0094) | One independent poison-pill calculation input. |
| CBA2-A03.15 | Minimum Exception room consequence: when an assignee acquires a qualifying Contract through VII §6(i), that acquisition consumes no room under the Salary Cap | INFERRED | SCEN | — | EV2-0115 | new (DR2-0094) | Separate from the no-TPE-capacity consequence in CBA2-A03.11; not stated as a `$0` Salary rule. |
| CBA2-A03.16 | Minimum Exception term limit: a Contract signed or acquired through VII §6(i) may cover no more than two Seasons | CBA | SCEN | — | EV2-0116 | new (DR2-0094) | Contract-shape eligibility only. |
| CBA2-A03.17 | Minimum Exception first-Season compensation: the Contract's first Season must provide the Minimum Player Salary applicable to that player and no bonuses of any kind | CBA | SCEN | — | EV2-0117 | new (DR2-0094) | First-Season compensation condition only. |
| CBA2-A03.18 | Minimum Exception second-Season compensation: if the Contract covers two Seasons, its second Season must provide the Minimum Player Salary applicable to that player for that Season and no bonuses of any kind | CBA | SCEN | — | EV2-0118 | new (DR2-0094) | Conditional second-Season compensation requirement only. |
| CBA2-A04.1 | Trade-bonus percentage ceiling: the trade bonus payable on a trade may not exceed 15% of the Base Compensation basis independently defined by CBA2-A04.16 | CBA | SCEN | — | EV2-0030 | XW2-0026, XW2-0031 | Owns only the 15% ceiling. The calculation basis and Option-Year exclusion are CBA2-A04.16; permitted forms are CBA2-A04.13 and CBA2-A04.39. |
| CBA2-A04.2 | Existing-bonus ordinary-trade payability: except for the sign-and-trade branch in CBA2-A04.17, a trade bonus already contained in a Contract is payable only on the first trade of that Contract | CBA | LIFECYCLE | SCEN | EV2-0031 | XW2-0027, XW2-0032 | Existing ordinary-contract first-trade branch only. Sign-and-trade, added-bonus, and once-only extinguishment rules are separate owners. |
| CBA2-A04.3 | General trade-bonus allocation horizon: subject to CBA2-A04.21, a trade bonus classified under VII §3(b)(1)(ii) is allocated over the then-current and remaining Salary Cap Years covered by the Contract | CBA | SCEN | — | EV2-0032 | XW2-0028, XW2-0036 | Horizon only. The protected-percentage calculation and zero-protection fallback are CBA2-A04.22 and CBA2-A04.23; extension-specific branches are CBA2-A04.24–A04.27. |
| CBA2-A04.4 | Rookie Scale 120% deemed amendment: if a trade of a Rookie Scale Contract would, because of a trade bonus, cause Salary plus Unlikely Bonuses for the trade year to exceed 120% of the applicable Rookie Scale Amount, the trade bonus is deemed amended to the extent necessary to reduce Salary plus Unlikely Bonuses to that 120% limit | CBA | SCEN | — | EV2-0033 | XW2-0025 | Rookie Scale rule only. The separate general Article II §7(f) maximum formula is CBA2-A04.9. |
| CBA2-A04.5 | Non-extend-and-trade transaction reduction: in connection with a trade other than one pursuant to an agreement to trade an extended Contract under VII §8(e), a Contract may be amended to reduce, including to zero, a trade bonus not previously earned, subject to CBA2-A04.1, CBA2-A04.16, CBA2-A04.13, and CBA2-A04.39 | CBA | SCEN | — | EV2-0034 | XW2-0033 | Owns only XXIV §2(a)(iii)(B)(3). The four Extension amendment branches are CBA2-A04.28–A04.31. |
| CBA2-A04.6 | Post-waiver renegotiation bar: a Contract amended under XXIV §2(a)(iii)(B)(3) to waive all or part of a trade bonus in connection with a trade may not be renegotiated until the later of (i) six months after the trade date or (ii) the first date the Contract could otherwise be renegotiated under VII §7 | CBA | SCEN | LIFECYCLE | EV2-0035 | XW2-0034 | — |
| CBA2-A04.7 | Default assignor payer: under UPC Exhibit 4, the Team that assigns the Contract is the default obligor for an earned trade-bonus payment | CBA | SCEN | — | EV2-0036 | XW2-0029, XW2-0038 | Default payer only. CBA2-A04.32 owns the ordinary Exhibit 4 deadline, and CBA2-A04.33 owns the BYL 4.04(c) agreed-reallocation caveat. |
| CBA2-A04.8 | Receiving-side individual Salary effect: the trade-year allocated portion of a trade bonus increases the player's post-assignment Salary for the assignee's VII §6(j) calculation | CBA | SCEN | — | EV2-0037 | XW2-0030, XW2-0139 | Owns the assignee individual-trade-salary effect only; Team Salary is CBA2-A04.15. |
| CBA2-A04.9 | General maximum-salary reduction: if a trade bonus would make trade-year Salary plus Unlikely Bonuses exceed the applicable Article II §7(f) maximum, the bonus is deemed amended downward to that maximum, where the maximum is (i) for fewer than seven Years of Service, the greater of 25% of the Salary Cap or 105% of prior-Season Salary, with the contracted Salary-Cap percentage substituted for a qualifying 5th Year Eligible Player/Higher Max Contract or Rookie Scale Extension; (ii) for seven to fewer than ten Years of Service, the greater of 30% of the Salary Cap or 105% of prior-Season Salary, with the contracted Salary-Cap percentage substituted for a qualifying Designated Veteran Player Contract or Extension; and (iii) for at least ten Years of Service, the greater of 35% of the Salary Cap or 105% of prior-Season Salary | CBA | SCEN | — | EV2-0094 | XW2-0037 | Complete mutually exclusive piecewise formula: exactly one Years-of-Service band applies, every band uses the same exceedance trigger and same deemed-amendment result, and EV2-0094 enumerates every element. Separate from CBA2-A04.4. |
| CBA2-A04.10 | Extension trade-bonus replacement exhibit: if an unearned trade bonus is amended in connection with an Extension to be inapplicable to the extended term, the Extension must include a replacement Exhibit 4 with the original terms plus the prescribed extended-term inapplicability statement | CBA | LIFECYCLE | — | EV2-0095 | new (DR2-0094) | XXIV §2(a)(v). |
| CBA2-A04.11 | Extension trade-bonus original-term calculation: under the CBA2-A04.10 branch, if the first trade occurs during the remainder of the original term, the bonus is calculated solely from Base Compensation remaining under that original term and excludes extended-term Base Compensation | CBA | SCEN | — | EV2-0096 | new (DR2-0094) | Owns the original-term branch. |
| CBA2-A04.12 | Extension trade-bonus extended-term inapplicability: under the CBA2-A04.10 branch, if the first trade occurs during the extended term, the bonus does not apply to that trade or any later trade during the extended term | CBA | SCEN | — | EV2-0097 | new (DR2-0094) | Owns the extended-term branch separately from original-term calculation. |
| CBA2-A04.13 | Percentage trade-bonus form: Exhibit 4 may state the trade bonus as a specified percentage of the Base Compensation basis in CBA2-A04.16 | CBA | SCEN | — | EV2-0098 | XW2-0133, XW2-0136 | Percentage form only. The dollar form is CBA2-A04.39; the 15% ceiling is CBA2-A04.1. |
| CBA2-A04.14 | Trade-bonus addition restriction: a Contract containing no trade bonus may be amended to add one only in connection with an Extension | CBA | SCEN | — | EV2-0099 | new (DR2-0094) | XXIV §2(a)(iv); separate from reduction of an existing bonus. |
| CBA2-A04.15 | Trade-bonus Team Salary effect: allocated trade-bonus amounts are included in the player's Salary and therefore in the assignee Team's Team Salary for the applicable Salary Cap Year | CBA | SCEN | — | EV2-0100 | XW2-0134, XW2-0135, XW2-0138 | Team Salary effect only; individual post-assignment Salary is CBA2-A04.8. |
| CBA2-A04.16 | Trade-bonus calculation basis: the percentage and dollar-cap forms use Base Compensation remaining to be earned at the time of the trade and exclude Base Compensation in an Option Year that has not been exercised | CBA | SCEN | — | EV2-0119 | XW2-0163, XW2-0164 | Calculation basis and its express Option-Year exclusion only. There is no guaranteed-compensation or day-proration qualifier. |
| CBA2-A04.17 | Sign-and-trade existing-bonus lifecycle: a trade bonus in a Contract signed under VII §8(e)(1) does not apply to the initial sign-and-trade and is payable only on the second trade of that Contract | CBA | LIFECYCLE | SCEN | EV2-0120 | new (DR2-0094) | Existing sign-and-trade Contract branch only. |
| CBA2-A04.18 | Trade-bonus once-only extinguishment: in no event may a trade bonus in a Contract be payable more than once | CBA | LIFECYCLE | SCEN | EV2-0121 | new (DR2-0094) | Universal once-only ceiling, separately auditable from which trade first triggers payment. |
| CBA2-A04.19 | Ordinary-Extension added-bonus lifecycle: when a Contract without a trade bonus is extended other than under a VII §8(e) agreement to trade, a simultaneously added trade bonus is payable only on the first trade following the Extension and not on a later trade | CBA | LIFECYCLE | SCEN | EV2-0122 | new (DR2-0094) | XXIV §2(a)(iv)(A) only. |
| CBA2-A04.20 | Extend-and-trade added-bonus lifecycle: when a Contract without a trade bonus is extended under a VII §8(e) agreement to trade, a simultaneously added trade bonus does not apply to the initial trade and is payable only if the extended Contract is traded a second time, not on a later trade | CBA | LIFECYCLE | SCEN | EV2-0123 | new (DR2-0094) | XXIV §2(a)(iv)(B) only. |
| CBA2-A04.21 | ETO allocation cutoff: if a Contract contains an Early Termination Option, the general CBA2-A04.3 allocation horizon includes only Salary Cap Years preceding the Effective Season of that ETO | CBA | LIFECYCLE | SCEN | EV2-0124 | new (DR2-0094) | Express exception to the general allocation horizon. |
| CBA2-A04.22 | Protected-percentage allocation calculation: within the applicable allocation horizon, the trade bonus is allocated in proportion to the percentage of Base Compensation in each included Salary Cap Year that is protected for lack of skill at allocation | CBA | SCEN | — | EV2-0125 | new (DR2-0094) | Calculation method only; it applies to the general and specified Extension horizons. |
| CBA2-A04.23 | Zero-protection allocation fallback: if none of the Base Compensation in the applicable trade-bonus allocation horizon is protected for lack of skill, the entire bonus is allocated to the Salary Cap Year in which the Contract is traded | CBA | SCEN | — | EV2-0126 | new (DR2-0094) | Zero-protection exception/result only. |
| CBA2-A04.24 | Extended-term-inapplicable allocation horizon: if an Extension makes the original Contract's trade bonus inapplicable to the extended term, an earned bonus is allocated only over the then-current and remaining Salary Cap Years of the original term, excluding every extended-term Salary Cap Year | CBA | LIFECYCLE | SCEN | EV2-0127 | new (DR2-0094) | VII §3(b)(3)(iii) horizon only; CBA2-A04.22 and A04.23 supply the method and fallback. |
| CBA2-A04.25 | Original-and-extended-term applicable-bonus basis: if an Extension leaves a trade bonus applicable to both terms and the bonus is earned before the first Salary Cap Year of the extended term, calculation and allocation include extended-term Base Compensation as stated in the Contract, subject to CBA2-A04.26 and A04.27 | CBA | SCEN | LIFECYCLE | EV2-0128 | new (DR2-0094) | VII §3(b)(3)(iv)(A) governing branch only. |
| CBA2-A04.26 | Applicable-bonus percentage-Salary assumption: under CBA2-A04.25, percentage-of-Cap Base Compensation in the first extended year is determined by assuming the Salary Cap increases 4.5% in each Salary Cap Year from the following year through that first extended year | CBA | SCEN | — | EV2-0129 | new (DR2-0094) | One independently auditable calculation assumption. |
| CBA2-A04.27 | Applicable-bonus over-maximum deemed-amendment assumption: under CBA2-A04.25, if first-extended-year Salary plus Unlikely Bonuses exceeds the Maximum Annual Salary computed by crediting one Year of Service for each remaining original-term year and assuming 4.5% annual Salary Cap growth through the first extended year, extended-term Base Compensation is the amount resulting from the Article II §7(c) deemed amendment under those assumptions | CBA | SCEN | — | EV2-0130 | new (DR2-0094) | One assumed-maximum/deemed-amendment calculation branch. |
| CBA2-A04.28 | Ordinary-Extension bonus-amount amendment: in connection with an Extension other than one under a VII §8(e) agreement to trade, an unearned trade bonus may be modified upward or downward, subject to the form, basis, and 15% ceiling owners | CBA | SCEN | — | EV2-0131 | new (DR2-0094) | XXIV §2(a)(iii)(B)(1)(a) only. |
| CBA2-A04.29 | Ordinary-Extension extended-term inapplicability amendment: in connection with an Extension other than one under a VII §8(e) agreement to trade, an unearned trade bonus may be made inapplicable to the extended term | CBA | LIFECYCLE | SCEN | EV2-0132 | new (DR2-0094) | XXIV §2(a)(iii)(B)(1)(b) only. |
| CBA2-A04.30 | Extend-and-trade bonus reduction: in connection with an Extension under a VII §8(e) agreement to trade, an unearned trade bonus may be reduced, but not increased, subject to the form, basis, and 15% ceiling owners | CBA | SCEN | — | EV2-0133 | new (DR2-0094) | XXIV §2(a)(iii)(B)(2)(a) only. |
| CBA2-A04.31 | Extend-and-trade extended-term inapplicability amendment: in connection with an Extension under a VII §8(e) agreement to trade, an unearned trade bonus may be made inapplicable to the extended term | CBA | LIFECYCLE | SCEN | EV2-0134 | new (DR2-0094) | XXIV §2(a)(iii)(B)(2)(b) only. |
| CBA2-A04.32 | Ordinary Exhibit 4 payment deadline: unless an Extension installment rule applies, the earned trade bonus must be paid within 30 days after the trade | CBA | LIFECYCLE | SCEN | EV2-0135 | new (DR2-0094) | Deadline only; default payer is CBA2-A04.7. |
| CBA2-A04.33 | Agreed obligation reallocation: notwithstanding the UPC Exhibit 4 default, BYL 4.04(c) permits the parties to a trade to agree that an obligation under an assigned Contract will be allocated differently | BYL | SCEN | LIFECYCLE | EV2-0136 | new (DR2-0094) | Narrow agreed-reallocation caveat; absent an agreement, CBA2-A04.7 remains the default. |
| CBA2-A04.34 | Applicable-bonus first-installment deadline: under CBA2-A04.25, the first installment must be paid within 30 days after the trade to which the bonus applies | CBA | LIFECYCLE | SCEN | EV2-0137 | new (DR2-0094) | First-installment deadline only. |
| CBA2-A04.35 | Applicable-bonus first-installment amount: under CBA2-A04.25, the first installment equals the portion allocated to Salary Cap Years covered by the original term | CBA | SCEN | — | EV2-0138 | new (DR2-0094) | First-installment amount only. |
| CBA2-A04.36 | Applicable-bonus second-installment deadline: under CBA2-A04.25, the second installment must be paid within 30 days after the first day of the first Salary Cap Year covered by the extended term | CBA | LIFECYCLE | SCEN | EV2-0139 | new (DR2-0094) | Second-installment deadline only. |
| CBA2-A04.37 | Applicable-bonus second-installment amount: under CBA2-A04.25, the second installment equals the portion allocated to Salary Cap Years covered by the extended term | CBA | SCEN | — | EV2-0140 | new (DR2-0094) | Second-installment amount only. |
| CBA2-A04.38 | Deemed-amendment payment reduction: when an Article II §7(c) deemed amendment reduces the allocations relevant to a VII §3(b)(3)(iv) trade-bonus installment, the required payment is reduced to the sum of the resulting amended allocation amounts | CBA | SCEN | — | EV2-0141 | new (DR2-0094) | Payment-reduction result only; it does not alter the independently owned deadlines. |
| CBA2-A04.39 | Dollar trade-bonus form: Exhibit 4 may state a specified dollar trade bonus capped by a specified percentage of the Base Compensation basis in CBA2-A04.16 | CBA | SCEN | — | EV2-0142 | XW2-0162, XW2-0165 | Dollar form only; the 15% ceiling remains CBA2-A04.1. |
| CBA2-A05.1 | Apron restriction test: a Team may not engage in a Transaction Restrictions Table transaction if, immediately following the transaction, its Apron Team Salary for the Salary Cap Year would exceed the row's Applicable Apron Level | CBA | SCEN | — | EV2-0038 | XW2-0041, XW2-0062, XW2-0064, XW2-0066, XW2-0068, XW2-0070, XW2-0072, XW2-0074, XW2-0076, XW2-0078, XW2-0104, XW2-0157 | Uses post-transaction Apron Team Salary (VII §2(e)(1)); the Apron Team Salary computation is C-family (R4). Threshold status alone is never the test. |
| CBA2-A05.2 | Apron hard cap: a Team that engages in a Transaction Restrictions Table transaction may not, for the remainder of that Salary Cap Year, have an Apron Team Salary exceeding the row's Applicable Apron Level | CBA | LIFECYCLE | SCEN | EV2-0039 | XW2-0010, XW2-0042, XW2-0080, XW2-0081, XW2-0158 | The hard cap persists as team state and constrains later transactions. |
| CBA2-A05.3 | Row A: signing or acquiring a player using the Bi-annual Exception carries an Applicable Apron Level of the First Apron Level | CBA | SCEN | — | EV2-0040 | XW2-0061 | — |
| CBA2-A05.4 | Row B: signing or acquiring a player using the Non-Taxpayer Mid-Level Salary Exception carries an Applicable Apron Level of the First Apron Level | CBA | SCEN | — | EV2-0041 | XW2-0063 | — |
| CBA2-A05.5 | Row C: acquiring a player pursuant to a Contract entered into under VII §8(e)(1) (sign-and-trade) carries an Applicable Apron Level of the First Apron Level | CBA | SCEN | — | EV2-0042 | XW2-0065, XW2-0079 | Applies to the acquiring team; the sign-and-trade validity conditions are CBA2-A07. |
| CBA2-A05.6 | Row D: signing, during the Regular Season, a player whose prior Contract was terminated during that Regular Season and provided for a Salary greater than that year's Non-Taxpayer Mid-Level Salary Exception amount carries an Applicable Apron Level of the First Apron Level | CBA | SCEN | — | EV2-0043 | XW2-0067 | — |
| CBA2-A05.7 | Row E: acquiring a player using an Expanded Traded Player Exception carries an Applicable Apron Level of the First Apron Level | CBA | SCEN | — | EV2-0044 | XW2-0009, XW2-0069 | — |
| CBA2-A05.8 | Row F: acquiring a player using a Standard Traded Player Exception (i) after the end of the Regular Season in which the TPE arose, or (ii) for a TPE arising between Regular Seasons, after the last day of the following Regular Season, carries an Applicable Apron Level of the First Apron Level | CBA | SCEN | LIFECYCLE | EV2-0045 | XW2-0048, XW2-0052, XW2-0071 | Before aging under row F, a team above the First Apron may still use a Standard TPE; the CBA2-A02.3 one-year window applies independently. |
| CBA2-A05.9 | Row G: acquiring a player using a Transition Traded Player Exception carries an Applicable Apron Level of the First Apron Level | CBA | SCEN | — | EV2-0046 | new (DR2-0045) | Historical-edition scope: the Transition TPE exists only in the 2023-24 Salary Cap Year (CBA2-A02.6); see also CBA2-A05.18. |
| CBA2-A05.10 | Row H: acquiring a player using an Aggregated Standard Traded Player Exception carries an Applicable Apron Level of the Second Apron Level | CBA | SCEN | — | EV2-0047 | XW2-0051, XW2-0055, XW2-0073 | Row H restricts Aggregated TPE use; it does not bar receiving multiple players for one Traded Player under a valid Standard TPE (CBA2-A02.1). |
| CBA2-A05.11 | Row I: paying cash to another Team in connection with a trade under VII §8(a) carries an Applicable Apron Level of the Second Apron Level | CBA | SCEN | — | EV2-0048 | XW2-0103, XW2-0112 | — |
| CBA2-A05.12 | Row J: acquiring a player using a Traded Player Exception that is in respect of a Player Contract signed and traded pursuant to VII §8(e)(1) carries an Applicable Apron Level of the Second Apron Level | CBA | SCEN | — | EV2-0049 | XW2-0075 | Requires the TPE's source-transaction provenance to be persisted (TPE state is L-family; R6). |
| CBA2-A05.13 | Row K: signing a player using the Taxpayer Mid-Level Salary Exception carries an Applicable Apron Level of the Second Apron Level | CBA | SCEN | — | EV2-0050 | XW2-0077, XW2-0156 | — |
| CBA2-A05.14 | TMLE-usage bar: for each Salary Cap Year beginning with 2024-25, a Team that has signed a Player Contract using the Taxpayer Mid-Level Salary Exception during that Salary Cap Year may not engage in any transaction in rows A through F of the Transaction Restrictions Table (rows A through E for the 2023-24 Salary Cap Year) | CBA | SCEN | LIFECYCLE | EV2-0051 | XW2-0159 | Homogeneous-list exception: the row owns the six expressly listed Table rows whose common consequence is TMLE unavailability; each member uses the same authority class, method, lifecycle, and verdict. |
| CBA2-A05.15 | Post-regular-season dual-year test: from the day after the last day of a Regular Season through the end of that Salary Cap Year, a Team may not engage in a transaction in rows E through J if, immediately following it, its Apron Team Salary for the immediately following (Subsequent) Salary Cap Year — computed under CBA2-A05.17 — would exceed that row's Applicable Apron Level for the Subsequent Salary Cap Year; this dual-year test is gated by transaction type (rows E-J only), never applied to every apron-limited action | CBA | SCEN | — | EV2-0052 | XW2-0082, XW2-0083 | — |
| CBA2-A05.16 | Dual-year hard cap: a Team that engages in a rows E-J transaction during the post-regular-season window may not, from immediately after the transaction through the end of the Subsequent Salary Cap Year, have an Apron Team Salary for the Subsequent Salary Cap Year exceeding that row's Applicable Apron Level | CBA | LIFECYCLE | SCEN | EV2-0053 | XW2-0085 | Such a transaction can therefore hard-cap both the current and the Subsequent Salary Cap Year. |
| CBA2-A05.17 | Subsequent-year computation assumptions: the Subsequent Salary Cap Year's Apron Team Salary is computed assuming (A) all Team and Player Options for that year are exercised, (B) no outstanding ETOs for that year are exercised, (C) the Team engages in no additional transactions for the remainder of the current Salary Cap Year, and (D) any player whose Salary may increase by meeting Higher Max Criteria in the fourth Season of his Rookie Scale Contract achieves the highest Salary he is eligible to earn from unannounced Generally Recognized League Honors; the Subsequent year's Salary Cap, First Apron Level, and Second Apron Level are assumed equal to the current year's | CBA | SCEN | — | EV2-0054 | XW2-0084 | Homogeneous assumption-set exception: the row is one indivisible closed computation input set; partial application would misstate the same subsequent-year Apron Team Salary calculation. |
| CBA2-A05.18 | 2023-24 transition exemption: a Team engaging in rows F through J transactions during the 2023-24 Salary Cap Year is not, by virtue of those transactions, prohibited from having a 2023-24 Apron Team Salary exceeding the Applicable Apron Level (the current-year hard cap of CBA2-A05.2 does not attach in 2023-24 for those rows) | CBA | SCEN | — | EV2-0055 | new (DR2-0045) | Historical-edition scope: applies only in a simulated 2023-24 Salary Cap Year. |
| CBA2-A06.1 | Two-month aggregation bar: no player whose Contract was acquired pursuant to an Exception in the two-month period preceding the trade may be among the Traded Players whose Contracts are aggregated under VII §6(j)(1)(ii)-(iv) | CBA | SCEN | — | EV2-0056 | XW2-0056, XW2-0058 | Bars aggregation only; a solo (unaggregated) re-trade inside the two months is not barred by this rule. |
| CBA2-A06.2 | December 16 carve-out: if the Contract was acquired pursuant to an Exception on or before December 16 of a Salary Cap Year, the two-month bar does not apply to a trade on or after the day prior to that Salary Cap Year's NBA trade deadline | CBA | SCEN | — | EV2-0057 | XW2-0057 | — |
| CBA2-A06.3 | Minimum stacking limit: outside the period from December 15 through the NBA trade deadline, if a Team aggregates three or more Traded Players and acquires fewer Replacement Players than Traded Players, no more than one Traded Player may be a Minimum Traded Player — a player whose Contract provides his applicable Minimum Player Salary for the trade's Salary Cap Year (or, for a trade after the Regular Season through the end of the Salary Cap Year, for the immediately following Salary Cap Year) | CBA | SCEN | — | EV2-0058 | XW2-0131 | One prohibition with a conjunctive trigger (ATOM keep); the Minimum Traded Player definition is constitutive of the rule. Minimum-scale values are S-family parameters (R6). |
| CBA2-A07.1 | Sign-and-trade roster condition: the Veteran Free Agent must have finished the prior Season on his Prior Team's roster (VII §8(e)(1)(i)) | CBA | SCEN | — | EV2-0059 | XW2-0113 | — |
| CBA2-A07.2 | Sign-and-trade minimum term: the Contract must cover at least three Seasons, excluding any Option Year (VII §8(e)(1)(ii)) | CBA | SCEN | — | EV2-0060 | XW2-0115 | — |
| CBA2-A07.3 | Sign-and-trade maximum term: the Contract may cover no more than four Seasons (VII §8(e)(1)(ii)) | CBA | SCEN | — | EV2-0061 | XW2-0116 | — |
| CBA2-A07.4 | Sign-and-trade first-season protection: the first Season of the Contract must be fully protected for lack of skill (VII §8(e)(1)(iv)) | CBA | SCEN | — | EV2-0062 | XW2-0117 | — |
| CBA2-A07.5 | Sign-and-trade exception bar: the Contract may not be signed pursuant to the Non-Taxpayer Mid-Level Salary Exception or the Mid-Level Salary Exception for Room Teams (VII §8(e)(1)(iii)) | CBA | SCEN | — | EV2-0063 | XW2-0118 | Homogeneous-list exception: both named Mid-Level Exceptions share the same §8(e)(1)(iii) prohibition, authority, method, and result. |
| CBA2-A07.6 | Sign-and-trade timing: the Contract must be entered into prior to the first day of the Regular Season (VII §8(e)(1)(v)) | CBA | SCEN | — | EV2-0064 | XW2-0114 | — |
| CBA2-A07.7 | Sign-and-trade Higher Max limit: for a 5th Year Eligible Player who met a Higher Max Criterion, the Contract may not provide first-season Salary plus Unlikely Bonuses above 25% of the Salary Cap as calculated per Article II §7 (VII §8(e)(1)(vi)) | CBA | SCEN | — | EV2-0065 | new (DR2-0046) | A sign-and-trade forfeits the 30% Higher Max opportunity. |
| CBA2-A07.8 | Sign-and-trade acquisition authority: the acquiring Team must have Room — room under the Salary Cap or entitlement to use a qualifying Exception per Article I §1(kkk) — for the player's Salary plus any first-season Unlikely Bonuses (VII §8(e)(1)(vii)) | CBA | SCEN | — | EV2-0066 | XW2-0119 | Interacts with row C (CBA2-A05.5) and row J (CBA2-A05.12). |
| CBA2-A07.9 | Exhibit 6 bar: a Player Contract or Extension entered into under VII §8(e)(1) or (2) may not contain an Exhibit 6 | CBA | SCEN | — | EV2-0067 | new (DR2-0046) | Owns only the contract-exhibit prohibition; the prescribed physical-exam trade condition is CBA2-A07.10. |
| CBA2-A07.10 | Prescribed physical-exam condition: although an Exhibit 6 is barred, the Teams may agree that a sign-and-trade or extension-and-trade is conditional on the player's passage of a physical examination performed by a physician designated by the assignee Team in accordance with NBA procedures | CBA | LIFECYCLE | SCEN | EV2-0101 | new (DR2-0094) | Trade condition under VII §8(e)(3), not a Contract Exhibit 6. |
| CBA2-A08.1 | Cash-paid annual limit: a Team may pay, directly or indirectly, no more than 5.15% of the Salary Cap in connection with trades in one Salary Cap Year | CBA | SCEN | LIFECYCLE | EV2-0068 | XW2-0101, XW2-0106 | Owns only the paid direction; no-netting is CBA2-A08.6. |
| CBA2-A08.2 | Cash-received annual limit: a Team may receive, directly or indirectly, no more than 5.15% of the Salary Cap in connection with trades in one Salary Cap Year, including reimbursement of Compensation obligations for acquired players | CBA | SCEN | LIFECYCLE | EV2-0069 | XW2-0102, XW2-0107 | Owns only the received direction; no-netting is CBA2-A08.6. |
| CBA2-A08.3 | Signing bonus as cash: when a Contract signed and traded under VII §8(e)(1) contains a signing bonus, the signing Team's payment of any portion of that bonus is treated as reimbursement of the assignee's Compensation obligation and counts against the VII §8(a) cash limits | CBA | SCEN | — | EV2-0070 | XW2-0105 | — |
| CBA2-A08.4 | Cash-in-trade Salary-Cap-Year charging: each cash payment or receipt regulated by VII §8(a) is charged against the applicable limit for the Salary Cap Year in which the trade occurs | CBA | SCEN | LIFECYCLE | EV2-0071 | new (DR2-0094) | Owns only the express general charging rule; conditional cash application is CBA2-A08.7. |
| CBA2-A08.5 | No Team Salary effect: cash paid or received in connection with a trade is inter-team consideration outside the VII §4(a) Team Salary computation and never enters Team Salary | INFERRED | SCEN | STATIC | EV2-0072 | XW2-0110 | — |
| CBA2-A08.6 | No-netting: cash paid and cash received under VII §8(a) are tracked against separate annual limits and may not be netted against one another | CBA | SCEN | — | EV2-0102 | XW2-0143 | One rule governing the relationship between the two directional ledgers. |
| CBA2-A08.7 | Conditional cash trade-year application: cash payable only if a trade condition later occurs is attributed to the Salary Cap Year of the underlying trade for applying the separate §8(a) cash limits | INFERRED | SCEN | LIFECYCLE | EV2-0103 | XW2-0144 | Inference from the express trade-year charging rule plus the conditional-consideration relationship; later re-trade attribution is not included. |
| CBA2-A09.1 | Trade Call list room: the league will not conduct a Trade Call unless each party has room on its Active List, Inactive List, or Two-Way List (or will have room once the Trade Call is completed) for every player it receives in the transaction — a planned post-trade waiver does not satisfy the requirement | BYL | SCEN | — | EV2-0073 | XW2-0091 | The 'will have room' clause counts players leaving in the same transaction, not later moves. |
| CBA2-A10.1 | Extension-and-trade mechanism: a player and Team may amend a Contract by entering into an Extension (never a Renegotiation) pursuant to an agreement between that Team and another Team concerning the signing of the amendment and the subsequent trade of the amended Contract (VII §8(e)(2)) | CBA | SCEN | — | EV2-0074 | XW2-0128 | — |
| CBA2-A10.2 | Extension-and-trade window bar: no VII §8(e)(2) agreement may be made from the last day of the last Regular Season covered by the Contract (or of any Regular Season that could be its last based on Option/ETO exercise or non-exercise) through the following June 30 | CBA | SCEN | — | EV2-0075 | XW2-0124 | — |
| CBA2-A10.3 | Extension-and-trade term limit: an Extension entered into under VII §8(e)(2) on or after the first day of the 2024-25 Salary Cap Year may cover no more than four Seasons from the date it is signed (three Seasons for earlier signings) | CBA | SCEN | — | EV2-0076 | XW2-0121, XW2-0126 | Season counting follows VII §9(a) (a mid-season or post-season signing counts the current/just-completed Season). |
| CBA2-A10.4 | On/after-2024-25 first-year Salary ceiling: for a VII §8(e)(2) Extension signed on or after the first day of the 2024-25 Salary Cap Year, first extended-term Salary excluding Incentive Compensation may not exceed the greater of 120% of last-original-term Regular Salary and 120% of EAPS less first-year Incentive Compensation, if any | CBA | SCEN | — | EV2-0077 | XW2-0120, XW2-0125 | Salary-only branch. CBA2-A10.16 owns the historical 105% branch; CBA2-A10.17–A10.20 own the incentive branches. |
| CBA2-A10.5 | Extension annual Salary change limit: after the first extended-term year, Salary excluding Incentive Compensation may increase or decrease relative to the prior year's corresponding Salary by no more than 5% of the Salary excluding Incentive Compensation in the first extended-term year | CBA | SCEN | — | EV2-0078 | XW2-0122, XW2-0127 | Owns the Salary-excluding-incentives branch only; Regular Salary and per-bonus branches are CBA2-A10.10 and CBA2-A10.11. |
| CBA2-A10.6 | Three- or four-Season Contract anniversary: a non-Rookie Scale Contract covering three or four Seasons, including Option Years, may be extended no sooner than the second anniversary of its signing or most recent Extension, as determined under CBA2-A10.26 and A10.27 | CBA | SCEN | LIFECYCLE | EV2-0079 | XW2-0123 | This is only the three/four-Season branch. The one/two-Season bar, five/six-Season anniversary, off-season restrictions, and >10% Renegotiation branch are separate owners. |
| CBA2-A10.7 | Post-amendment trade bar: a player who enters into a VII §7(a) Extension covering five Seasons or exceeding the VII §8(e)(2) salary/raise limits (four or more Seasons for pre-2024-25 signings), or any VII §7(c) Renegotiation, may not be traded for six months after the signing | CBA | SCEN | LIFECYCLE | EV2-0080 | XW2-0129 | — |
| CBA2-A10.8 | Post-trade amendment bar: for six months after acquiring a player by trade, the acquiring Team may not enter into a VII §7(a) Extension covering five Seasons or exceeding the VII §8(e)(2)-permissible salary/raise amounts as of the trade date (four or more Seasons for pre-2024-25 trades), or any VII §7(c) Renegotiation, with that player | CBA | SCEN | LIFECYCLE | EV2-0081 | XW2-0130 | — |
| CBA2-A10.9 | On/after-2024-25 first-year Likely Bonus ceiling: when CBA2-A10.17 is satisfied for a VII §8(e)(2) Extension signed on or after the first day of the 2024-25 Salary Cap Year, first-extended-year Likely Bonuses may not exceed 120% of the Likely Bonuses in the last original-term Salary Cap Year | CBA | SCEN | — | EV2-0104 | new (DR2-0094) | Likely Bonus only. CBA2-A10.20 owns the parallel Unlikely Bonus ceiling. |
| CBA2-A10.10 | Extension annual Regular Salary change limit: after the first extended-term year, Regular Salary may increase or decrease relative to the prior year's Regular Salary by no more than 5% of Regular Salary in the first extended-term year | CBA | SCEN | — | EV2-0105 | new (DR2-0094) | Owns the independent Regular Salary branch. |
| CBA2-A10.11 | Per-bonus annual amount-change limit: after the first extended-term year, each individual Performance Bonus may increase or decrease by no more than 5% of that bonus's amount in the first extended-term year | CBA | SCEN | — | EV2-0106 | new (DR2-0094) | Applied separately to each bonus, not to an aggregate incentive pool. CBA2-A10.28 separately freezes its earning criteria. |
| CBA2-A10.12 | More-than-ten-percent renegotiation anniversary: when a Contract was renegotiated to increase Salary in any covered Salary Cap Year by more than 10% of pre-renegotiation Salary, it may not subsequently be extended until the third anniversary of that Renegotiation | CBA | LIFECYCLE | SCEN | EV2-0107 | new (DR2-0094) | Separate VII §7(a)(2)(i) anniversary branch. |
| CBA2-A10.13 | ETO-shortened-term bar: a Contract whose term was shortened through exercise of an Early Termination Option may not be extended under VII §7(a) | CBA | LIFECYCLE | — | EV2-0108 | new (DR2-0094) | Independent extension-eligibility prohibition. |
| CBA2-A10.14 | Exercised-Option extension permission: subject to the other VII §7(a) rules, a Contract may be extended after the player or Team exercises an Option | CBA | LIFECYCLE | SCEN | EV2-0109 | new (DR2-0094) | Exercise branch only. The non-exercise condition and simultaneous-action permission are CBA2-A10.29 and A10.30. |
| CBA2-A10.15 | QVFA-at-conclusion condition: a player who will not be a Qualifying Veteran Free Agent when his Contract concludes is not eligible to enter an Extension under VII §7(a) | CBA | SCEN | LIFECYCLE | EV2-0110 | new (DR2-0094) | Eligibility is tested at Contract conclusion. |
| CBA2-A10.16 | Pre-2024-25 first-year Salary ceiling: for a VII §8(e)(2) Extension signed before the first day of the 2024-25 Salary Cap Year, first extended-term Salary excluding Incentive Compensation may not exceed 105% of Regular Salary in the last original-term Salary Cap Year | CBA | SCEN | — | EV2-0143 | new (DR2-0094) | Historical-simulation salary branch only. |
| CBA2-A10.17 | First-year incentive eligibility: a VII §8(e)(2) Extension may carry first-extended-year Incentive Compensation under the §7(a)(3)(iii) carry-forward branches only when the last original-term Salary Cap Year provides Incentive Compensation | CBA | SCEN | — | EV2-0144 | new (DR2-0094) | Eligibility predicate only; each date/category ceiling is separately owned. |
| CBA2-A10.18 | Pre-2024-25 first-year Likely Bonus ceiling: when CBA2-A10.17 is satisfied for a VII §8(e)(2) Extension signed before the first day of the 2024-25 Salary Cap Year, first-extended-year Likely Bonuses may not exceed 105% of the Likely Bonuses in the last original-term Salary Cap Year | CBA | SCEN | — | EV2-0145 | new (DR2-0094) | Historical-simulation Likely Bonus branch only. |
| CBA2-A10.19 | Pre-2024-25 first-year Unlikely Bonus ceiling: when CBA2-A10.17 is satisfied for a VII §8(e)(2) Extension signed before the first day of the 2024-25 Salary Cap Year, first-extended-year Unlikely Bonuses may not exceed 105% of the Unlikely Bonuses in the last original-term Salary Cap Year | CBA | SCEN | — | EV2-0146 | new (DR2-0094) | Historical-simulation Unlikely Bonus branch only. |
| CBA2-A10.20 | On/after-2024-25 first-year Unlikely Bonus ceiling: when CBA2-A10.17 is satisfied for a VII §8(e)(2) Extension signed on or after the first day of the 2024-25 Salary Cap Year, first-extended-year Unlikely Bonuses may not exceed 120% of the Unlikely Bonuses in the last original-term Salary Cap Year | CBA | SCEN | — | EV2-0147 | new (DR2-0094) | Unlikely Bonus only; CBA2-A10.9 owns the parallel Likely Bonus ceiling. |
| CBA2-A10.21 | One- or two-Season Contract extension bar: a non-Rookie Scale Contract covering one or two Seasons, including Option Years, may not be extended under VII §7(a) | CBA | LIFECYCLE | SCEN | EV2-0148 | new (DR2-0094) | Independent term-length prohibition. |
| CBA2-A10.22 | Five- or six-Season Contract anniversary: a non-Rookie Scale Contract covering five or six Seasons, including Option Years, may be extended no sooner than the third anniversary of its signing or most recent Extension, as determined under CBA2-A10.26 and A10.27 | CBA | LIFECYCLE | SCEN | EV2-0149 | new (DR2-0094) | Five/six-Season anniversary branch only. |
| CBA2-A10.23 | More-than-one-year-early off-season restriction: other than a Designated Veteran Player Extension, a VII §7(a) Extension sought more than one year before the July 1 preceding the first extended-term Season may be negotiated and entered only from July 1 through the day before the first day of the Regular Season | CBA | LIFECYCLE | SCEN | EV2-0150 | new (DR2-0094) | Ordinary-Extension timing restriction only. |
| CBA2-A10.24 | Designated Veteran third-anniversary condition: a Designated Veteran Player Extension may be entered no sooner than the third anniversary of the Contract's signing | CBA | LIFECYCLE | SCEN | EV2-0151 | new (DR2-0094) | Designated Veteran anniversary only. |
| CBA2-A10.25 | Designated Veteran off-season restriction: a Designated Veteran Player Extension may be negotiated and entered only from July 1 through the day before the first day of the Regular Season | CBA | LIFECYCLE | SCEN | EV2-0152 | new (DR2-0094) | Designated Veteran timing only. |
| CBA2-A10.26 | October anniversary-date deeming: for a VII §7 anniversary, an Extension or Renegotiation entered from October 2 through the day before the first day of that Salary Cap Year's Regular Season is deemed signed on October 1 of that Salary Cap Year | CBA | LIFECYCLE | SCEN | EV2-0153 | new (DR2-0094) | Date-normalization rule only. |
| CBA2-A10.27 | Previously extended Contract term count: for VII §7(a)(1), the number of Seasons covered by a previously extended Contract is the number covered by its most recent Extension | CBA | SCEN | — | EV2-0154 | new (DR2-0094) | Contract-term input rule only. |
| CBA2-A10.28 | Extended-year bonus-criteria immutability: if the first extended-term Salary Cap Year provides Incentive Compensation, the earning criteria for each included bonus must remain unchanged in every subsequent Salary Cap Year | CBA | SCEN | LIFECYCLE | EV2-0155 | new (DR2-0094) | Earning-criteria duty only; CBA2-A10.11 independently controls annual amount changes. |
| CBA2-A10.29 | Non-exercised-Option extension condition: after a player or Team does not exercise an Option, the Contract may be extended only if the extended term covers at least two Seasons excluding any new Option Year | CBA | LIFECYCLE | SCEN | EV2-0156 | new (DR2-0094) | Non-exercise eligibility branch only. |
| CBA2-A10.30 | Simultaneous Option-action permission: a Team and player may amend a Contract simultaneously to exercise or not exercise an Option, as applicable, and enter the otherwise-permitted Extension | CBA | LIFECYCLE | SCEN | EV2-0157 | new (DR2-0094) | Procedure permission only; it does not waive the substantive exercise/non-exercise conditions. |
| CBA2-A11.1 | Per-team component decomposition: each Team's side of a multi-player transaction is evaluated separately, and a multi-player transaction may be decomposed into CBA-permitted component trades in which each Exception replaces its own defined Traded Player(s) with its own Replacement Player(s); the validator must find a legal decomposition or report that none exists | CBA, INFERRED | SCEN | — | EV2-0082, EV2-0083 | XW2-0060 | Two evidence components: the express per-player/per-exception structure of VII §6(j)(1)(i)-(v) (CBA) and the decomposition procedure (INFERRED) — never DERIVED and never a composite label. |
| CBA2-A12.1 | Pick ownership: a trade may convey only a draft choice or selection right the conveying Member then owns, including a conditionally owned right; an expected future acquisition is not an owned right | INFERRED | SCEN | LIFECYCLE | EV2-0084 | XW2-0094 | Ownership inference only; Trade Call/Memorandum disclosure and enforceability are CBA2-A12.6. |
| CBA2-A12.2 | No cash sale of a first: no Member may sell its rights to select a player in the first round of any NBA Draft for cash or its equivalent (BYL 7.03) | BYL | SCEN | — | EV2-0085 | XW2-0097 | — |
| CBA2-A12.3 | Stepien test: no Member may trade or exchange its right to select in the first round of any NBA Draft if the result MAY leave it without first-round picks in any two consecutive future NBA Drafts; because the test is 'may', every possible protection and conveyance branch must be evaluated, and another team's owned first-round pick can satisfy possession for a covered draft | BYL, INFERRED | SCEN | — | EV2-0086, EV2-0087 | XW2-0092, XW2-0098, XW2-0099 | Two evidence components: the express BYL 7.03 prohibition and the INFERRED all-branch evaluation semantics of 'may'. |
| CBA2-A12.4 | Frozen-pick trading bar: if a Team is a Second Apron Team for a Salary Cap Year (Apron Team Salary above the Second Apron Level as of the start of its last Regular Season game in that year), the Team is prohibited from trading, conditionally or unconditionally, its first-round pick in the first NBA Draft following the seventh Season after the Season in that Salary Cap Year | CBA | LIFECYCLE | SCEN | EV2-0088 | XW2-0093 | Applies beginning with the 2024-25 Salary Cap Year; the Draft Pick Penalty (end-of-round slide) and its representation are L-family (R6). |
| CBA2-A12.5 | Frozen-pick unfreeze timing: when a Team is a Second Apron Team in fewer than two of the four following Salary Cap Years, the frozen first-round pick becomes tradable on the day after the Regular Season ends in the third of those years in which it is not a Second Apron Team | CBA | LIFECYCLE | SCEN | EV2-0089 | XW2-0160 | Owns unfreeze timing only; the express no-penalty result is CBA2-A12.7. |
| CBA2-A12.6 | Trade Call draft-choice disclosure: during the Trade Call, the parties must state every term and condition concerning a draft choice conveyed in the trade | BYL | LIFECYCLE | SCEN | EV2-0111 | XW2-0146 | Trade Call duty only. Trade Memorandum recording and the consequence of non-disclosure are CBA2-A12.8 and A12.9; ownership is CBA2-A12.1. |
| CBA2-A12.7 | No Draft Pick Penalty after unfreeze: a frozen first-round pick released under VII §2(f)(2)(ii)(B) is not subject to a Draft Pick Penalty | CBA | LIFECYCLE | SCEN | EV2-0112 | XW2-0161 | Express no-penalty result; distinct from unfreeze timing. |
| CBA2-A12.8 | Trade Memorandum draft-choice record: every term and condition concerning a draft choice conveyed in a trade must be included in the Trade Memorandum | BYL | LIFECYCLE | SCEN | EV2-0158 | new (DR2-0094) | Trade Memorandum duty only. |
| CBA2-A12.9 | Undisclosed draft-choice term unenforceability: a draft-choice term or condition that the parties do not disclose to the Association Office during the Trade Call is unenforceable | BYL | LIFECYCLE | SCEN | EV2-0159 | new (DR2-0094) | BYL 4.02(a) consequence only; the separate Trade Memorandum recording and dispute-control duties are CBA2-A12.8. |

#### 15.10.3 A family — active LEAF register (detail table)

| ID | Scenario evidence | Dependencies | Lifecycle/date inputs | Decision records |
|---|---|---|---|---|
| CBA2-A01.1 | pending R7 | — | asOfDate; Salary Cap Year; team context | DR2-0001, DR2-0036, DR2-0082 |
| CBA2-A02.1 | pending R7 | — | Transaction date; Salary Cap Year | DR2-0002, DR2-0028 |
| CBA2-A02.2 | pending R7 | CBA2-A02.12, CBA2-A03.1 | Transaction date; Salary Cap Year | DR2-0002 |
| CBA2-A02.3 | pending R7 | — | Trade date; acquisition date | DR2-0002, DR2-0029 |
| CBA2-A02.4 | pending R7 | — | Transaction date; Salary Cap Year | DR2-0002 |
| CBA2-A02.5 | pending R7 | CBA2-A02.12, CBA2-A03.1 | Transaction date; Salary Cap Year | DR2-0002 |
| CBA2-A02.6 | pending R7 | — | Salary Cap Year | DR2-0002 |
| CBA2-A02.7 | pending R7 | — | Transaction date; Salary Cap Year | DR2-0002 |
| CBA2-A02.8 | pending R7 | CBA2-A02.12, CBA2-A03.1 | Salary Cap Year; current and 2023-24 Salary Cap values | DR2-0082 |
| CBA2-A02.9 | pending R7 | CBA2-A02.12 | Transaction date; Salary Cap Year | DR2-0002 |
| CBA2-A02.10 | pending R7 | — | Transaction date | DR2-0002 |
| CBA2-A02.11 | pending R7 | — | Transaction date; Salary Cap Year | DR2-0002, DR2-0043 |
| CBA2-A02.12 | pending R7 | — | Transaction date; Salary Cap Year; First Apron Level | DR2-0002, DR2-0015 |
| CBA2-A02.13 | pending R7 | — | Salary Cap Year; DPE-use history for the player | DR2-0002, DR2-0043 |
| CBA2-A02.14 | pending R7 | — | Transaction date | DR2-0002, DR2-0043 |
| CBA2-A03.1 | pending R7 | — | Trade date; elapsed Regular Season days; protection state | DR2-0082, DR2-0016 |
| CBA2-A03.2 | pending R7 | CBA2-A03.1 | Trade date; Regular Season calendar | DR2-0082 |
| CBA2-A03.3 | pending R7 | CBA2-A03.1 | Trade date; Regular Season calendar; next-year protection state | DR2-0082 |
| CBA2-A03.4 | pending R7 | — | Signing/trade date; Salary Cap Year; prior-contract salary | DR2-0082 |
| CBA2-A03.5 | pending R7 | CBA2-A03.6 | Trade date vs extension date; Salary Cap Year | DR2-0082, DR2-0017 |
| CBA2-A03.6 | pending R7 | — | Salary Cap at proposed trade date | DR2-0082 |
| CBA2-A03.7 | pending R7 | — | Preceding-season team/player performance data | DR2-0082, DR2-0018 |
| CBA2-A03.8 | pending R7 | — | Transaction date; Salary Cap Year; player YOS | DR2-0082 |
| CBA2-A03.9 | pending R7 | CBA2-A03.4 | Prior Contract; Salary Cap Year | DR2-0059 |
| CBA2-A03.10 | pending R7 | CBA2-A03.5, CBA2-A03.6 | Trade date; Salary Cap; Maximum Annual Salary | DR2-0060 |
| CBA2-A03.11 | pending R7 | CBA2-A03.8 | Transaction date; exception selection | DR2-0061 |
| CBA2-A03.12 | pending R7 | CBA2-A03.1 | Trade date; protection state; reimbursement amount | DR2-0062 |
| CBA2-A03.13 | pending R7 | CBA2-A03.4 | Signing/trade date; QVFA status; post-signing Team Salary; first-Season Salary and Unlikely Bonuses | DR2-0094 |
| CBA2-A03.14 | pending R7 | CBA2-A03.5, CBA2-A03.6 | Trade date; fourth-Season service/max assumptions | DR2-0094 |
| CBA2-A03.15 | pending R7 | CBA2-A03.8 | Transaction date; Salary Cap room; exception selection | DR2-0094 |
| CBA2-A03.16 | pending R7 | CBA2-A03.8 | Contract term; Option Years | DR2-0094 |
| CBA2-A03.17 | pending R7 | CBA2-A03.8 | First-Season Minimum Player Salary; bonus terms | DR2-0094 |
| CBA2-A03.18 | pending R7 | CBA2-A03.8 | Second-Season Minimum Player Salary; bonus terms | DR2-0094 |
| CBA2-A04.1 | pending R7 | — | Trade date; earned-to-date Base Compensation | DR2-0082 |
| CBA2-A04.2 | pending R7 | — | Trade history of the Contract | DR2-0082 |
| CBA2-A04.3 | pending R7 | — | Trade date; protection percentages; ETO Effective Season | DR2-0082 |
| CBA2-A04.4 | pending R7 | CBA2-A04.3 | Salary Cap Year; Rookie Scale Amount | DR2-0082 |
| CBA2-A04.5 | pending R7 | CBA2-A04.1 | Trade date; extension state | DR2-0082 |
| CBA2-A04.6 | pending R7 | CBA2-A04.5 | Trade date; renegotiation eligibility dates | DR2-0082 |
| CBA2-A04.7 | pending R7 | — | Trade date | DR2-0082 |
| CBA2-A04.8 | pending R7 | CBA2-A04.3 | Trade date; Salary Cap Year | DR2-0082 |
| CBA2-A04.9 | pending R7 | CBA2-A04.3 | Trade date; Years of Service; Maximum Annual Salary | DR2-0063 |
| CBA2-A04.10 | pending R7 | — | Extension execution date; Contract exhibits | DR2-0064 |
| CBA2-A04.11 | pending R7 | CBA2-A04.10 | Extension date; original-term Base Compensation | DR2-0065 |
| CBA2-A04.12 | pending R7 | CBA2-A04.10 | Trade date; original/extended-term boundary | DR2-0066 |
| CBA2-A04.13 | pending R7 | CBA2-A04.1 | Contract terms; trade date | DR2-0067 |
| CBA2-A04.14 | pending R7 | — | Extension state | DR2-0068 |
| CBA2-A04.15 | pending R7 | CBA2-A04.3 | Trade date; Salary Cap Year | DR2-0069 |
| CBA2-A04.16 | pending R7 | — | Trade date; remaining Base Compensation; Option exercise state | DR2-0096 |
| CBA2-A04.17 | pending R7 | CBA2-A04.2 | Contract signing type; complete trade history | DR2-0094 |
| CBA2-A04.18 | pending R7 | — | Complete trade-bonus payment history | DR2-0094 |
| CBA2-A04.19 | pending R7 | CBA2-A04.14 | Extension type; post-Extension trade history | DR2-0094 |
| CBA2-A04.20 | pending R7 | CBA2-A04.14 | Extend-and-trade state; post-Extension trade history | DR2-0094 |
| CBA2-A04.21 | pending R7 | CBA2-A04.3 | ETO Effective Season; allocation horizon | DR2-0094 |
| CBA2-A04.22 | pending R7 | — | Allocation horizon; protected Base Compensation percentages | DR2-0094 |
| CBA2-A04.23 | pending R7 | CBA2-A04.22 | Allocation horizon; zero-protection predicate; trade Salary Cap Year | DR2-0094 |
| CBA2-A04.24 | pending R7 | CBA2-A04.22, CBA2-A04.23 | Extension terms; original-term horizon; trade date | DR2-0094 |
| CBA2-A04.25 | pending R7 | CBA2-A04.22, CBA2-A04.23 | Extension terms; trade date; original/extended-term Base Compensation | DR2-0094 |
| CBA2-A04.26 | pending R7 | CBA2-A04.25 | Current Salary Cap Year; first extended year; percentage-of-Cap term | DR2-0094 |
| CBA2-A04.27 | pending R7 | CBA2-A04.25 | Years-of-Service assumptions; Salary Cap growth assumptions; Maximum Annual Salary | DR2-0094 |
| CBA2-A04.28 | pending R7 | CBA2-A04.1, CBA2-A04.13, CBA2-A04.16 | Extension type; unearned-bonus state; amendment terms | DR2-0094 |
| CBA2-A04.29 | pending R7 | — | Extension type; unearned-bonus state; replacement Exhibit 4 | DR2-0094 |
| CBA2-A04.30 | pending R7 | CBA2-A04.1, CBA2-A04.13, CBA2-A04.16 | Extend-and-trade state; unearned-bonus state; amendment terms | DR2-0094 |
| CBA2-A04.31 | pending R7 | — | Extend-and-trade state; unearned-bonus state; replacement Exhibit 4 | DR2-0094 |
| CBA2-A04.32 | pending R7 | — | Trade date; applicable Extension-installment branch | DR2-0094 |
| CBA2-A04.33 | pending R7 | CBA2-A04.7 | Trade agreement; assigned-Contract obligation allocation | DR2-0094 |
| CBA2-A04.34 | pending R7 | CBA2-A04.25 | Trade date; first-installment payment date | DR2-0094 |
| CBA2-A04.35 | pending R7 | CBA2-A04.25 | Original-term allocation amounts | DR2-0094 |
| CBA2-A04.36 | pending R7 | CBA2-A04.25 | First day of first extended Salary Cap Year; second-installment payment date | DR2-0094 |
| CBA2-A04.37 | pending R7 | CBA2-A04.25 | Extended-term allocation amounts | DR2-0094 |
| CBA2-A04.38 | pending R7 | CBA2-A04.25, CBA2-A04.27 | Article II §7(c) amended allocations; installment branch | DR2-0094 |
| CBA2-A04.39 | pending R7 | CBA2-A04.1, CBA2-A04.16 | Exhibit 4 dollar amount and percentage cap | DR2-0096 |
| CBA2-A05.1 | pending R7 | CBA2-A05.3, CBA2-A05.4, CBA2-A05.5, CBA2-A05.6, CBA2-A05.7, CBA2-A05.8, CBA2-A05.9, CBA2-A05.10, CBA2-A05.11, CBA2-A05.12, CBA2-A05.13 | Transaction date; Salary Cap Year; apron levels | DR2-0005, DR2-0027 |
| CBA2-A05.2 | pending R7 | CBA2-A05.1 | Transaction date through Salary Cap Year end | DR2-0005, DR2-0025 |
| CBA2-A05.3 | pending R7 | — | Salary Cap Year | DR2-0005 |
| CBA2-A05.4 | pending R7 | — | Salary Cap Year | DR2-0005 |
| CBA2-A05.5 | pending R7 | — | Salary Cap Year | DR2-0005, DR2-0024 |
| CBA2-A05.6 | pending R7 | — | Regular Season dates; NTMLE amount | DR2-0005 |
| CBA2-A05.7 | pending R7 | — | Salary Cap Year | DR2-0005, DR2-0027 |
| CBA2-A05.8 | pending R7 | CBA2-A02.3 | TPE creation date; Regular Season calendar | DR2-0005, DR2-0030 |
| CBA2-A05.9 | pending R7 | CBA2-A02.6 | Salary Cap Year (2023-24 only) | DR2-0005, DR2-0045 |
| CBA2-A05.10 | pending R7 | — | Salary Cap Year | DR2-0005, DR2-0031 |
| CBA2-A05.11 | pending R7 | — | Salary Cap Year | DR2-0005, DR2-0013 |
| CBA2-A05.12 | pending R7 | — | Salary Cap Year; TPE source transaction | DR2-0005 |
| CBA2-A05.13 | pending R7 | — | Salary Cap Year | DR2-0005 |
| CBA2-A05.14 | pending R7 | CBA2-A05.13 | Salary Cap Year; TMLE-use history | DR2-0086 |
| CBA2-A05.15 | pending R7 | CBA2-A05.17 | Regular Season end; Salary Cap Year boundary | DR2-0005, DR2-0026 |
| CBA2-A05.16 | pending R7 | CBA2-A05.15, CBA2-A05.17 | Transaction date through Subsequent Salary Cap Year end | DR2-0005 |
| CBA2-A05.17 | pending R7 | — | Option/ETO state; pending league honors | DR2-0087 |
| CBA2-A05.18 | pending R7 | CBA2-A05.2 | Salary Cap Year (2023-24 only) | DR2-0005, DR2-0045 |
| CBA2-A06.1 | pending R7 | — | Acquisition date; trade date | DR2-0006, DR2-0032 |
| CBA2-A06.2 | pending R7 | CBA2-A06.1 | Acquisition date; trade deadline date | DR2-0006, DR2-0032 |
| CBA2-A06.3 | pending R7 | — | Trade date; Regular Season/deadline calendar; minimum-scale classification | DR2-0006 |
| CBA2-A07.1 | pending R7 | — | Prior-season roster history | DR2-0082 |
| CBA2-A07.2 | pending R7 | — | Contract term | DR2-0082 |
| CBA2-A07.3 | pending R7 | — | Contract term | DR2-0082 |
| CBA2-A07.4 | pending R7 | — | Protection state | DR2-0082 |
| CBA2-A07.5 | pending R7 | — | Signing mechanism | DR2-0088 |
| CBA2-A07.6 | pending R7 | — | Signing date; Regular Season start | DR2-0082 |
| CBA2-A07.7 | pending R7 | — | Salary Cap at signing; Higher Max status | DR2-0082, DR2-0046 |
| CBA2-A07.8 | pending R7 | — | Acquiring team's room/exception state | DR2-0082 |
| CBA2-A07.9 | pending R7 | — | Contract exhibits | DR2-0082 |
| CBA2-A07.10 | pending R7 | CBA2-A07.9 | Trade conditions; physical-examination result | DR2-0070 |
| CBA2-A08.1 | pending R7 | CBA2-A08.4 | Salary Cap Year; cumulative cash-paid balance | DR2-0082 |
| CBA2-A08.2 | pending R7 | CBA2-A08.4 | Salary Cap Year; cumulative cash-received balance | DR2-0082 |
| CBA2-A08.3 | pending R7 | CBA2-A08.1, CBA2-A08.2 | Salary Cap Year of the trade | DR2-0082 |
| CBA2-A08.4 | pending R7 | — | Trade date; Salary Cap Year | DR2-0082 |
| CBA2-A08.5 | pending R7 | — | — | DR2-0082 |
| CBA2-A08.6 | pending R7 | CBA2-A08.1, CBA2-A08.2 | Salary Cap Year; paid and received balances | DR2-0071 |
| CBA2-A08.7 | pending R7 | CBA2-A08.4, CBA2-A08.6 | Underlying trade date; condition resolution date | DR2-0072 |
| CBA2-A09.1 | pending R7 | — | Roster/list state at the Trade Call | DR2-0009 |
| CBA2-A10.1 | pending R7 | — | Extension/trade linkage | DR2-0082 |
| CBA2-A10.2 | pending R7 | CBA2-A10.1 | Contract term; Option/ETO state; Regular Season calendar | DR2-0082 |
| CBA2-A10.3 | pending R7 | CBA2-A10.1 | Extension signing date | DR2-0082 |
| CBA2-A10.4 | pending R7 | CBA2-A10.1 | Signing date; EAPS; prior-year salary | DR2-0082 |
| CBA2-A10.5 | pending R7 | CBA2-A10.4 | Extended-term salary schedule | DR2-0082 |
| CBA2-A10.6 | pending R7 | CBA2-A10.1 | Contract anniversaries; renegotiation/ETO history | DR2-0082 |
| CBA2-A10.7 | pending R7 | — | Extension/renegotiation signing date | DR2-0082 |
| CBA2-A10.8 | pending R7 | — | Trade date | DR2-0082 |
| CBA2-A10.9 | pending R7 | CBA2-A10.4 | Extension signing date; prior bonus amounts; EAPS | DR2-0073 |
| CBA2-A10.10 | pending R7 | CBA2-A10.5 | First extended-term Regular Salary | DR2-0074 |
| CBA2-A10.11 | pending R7 | — | Extended-term bonus schedule | DR2-0075 |
| CBA2-A10.12 | pending R7 | CBA2-A10.6 | Renegotiation date and amount; extension date | DR2-0076 |
| CBA2-A10.13 | pending R7 | — | ETO exercise state | DR2-0077 |
| CBA2-A10.14 | pending R7 | — | Option type; exercise/non-exercise date | DR2-0078 |
| CBA2-A10.15 | pending R7 | — | Contract conclusion; projected free-agent status | DR2-0079 |
| CBA2-A10.16 | pending R7 | — | Extension signing date; last original-term Regular Salary | DR2-0094 |
| CBA2-A10.17 | pending R7 | — | Last original-term Incentive Compensation | DR2-0094 |
| CBA2-A10.18 | pending R7 | CBA2-A10.17 | Extension signing date; last original-term Likely Bonuses | DR2-0094 |
| CBA2-A10.19 | pending R7 | CBA2-A10.17 | Extension signing date; last original-term Unlikely Bonuses | DR2-0094 |
| CBA2-A10.20 | pending R7 | CBA2-A10.17 | Extension signing date; last original-term Unlikely Bonuses | DR2-0094 |
| CBA2-A10.21 | pending R7 | — | Contract term including Option Years | DR2-0094 |
| CBA2-A10.22 | pending R7 | CBA2-A10.26, CBA2-A10.27 | Contract term; signing/Extension anniversary | DR2-0094 |
| CBA2-A10.23 | pending R7 | — | Proposed Extension date; first extended-term Season; Designated Veteran status | DR2-0094 |
| CBA2-A10.24 | pending R7 | — | Contract signing date; Designated Veteran status | DR2-0094 |
| CBA2-A10.25 | pending R7 | — | Proposed Extension date; Designated Veteran status | DR2-0094 |
| CBA2-A10.26 | pending R7 | — | Extension/Renegotiation signing date; Regular Season start | DR2-0094 |
| CBA2-A10.27 | pending R7 | — | Most recent Extension term | DR2-0094 |
| CBA2-A10.28 | pending R7 | — | First extended-year bonus criteria; later-year bonus criteria | DR2-0094 |
| CBA2-A10.29 | pending R7 | CBA2-A10.14 | Option non-exercise state; extended-term length excluding new Option Years | DR2-0094 |
| CBA2-A10.30 | pending R7 | CBA2-A10.14, CBA2-A10.29 | Option action; simultaneous amendment and Extension | DR2-0094 |
| CBA2-A11.1 | pending R7 | CBA2-A02.1, CBA2-A02.4, CBA2-A02.7, CBA2-A02.9 | Transaction date; per-team exception inventory | DR2-0011 |
| CBA2-A12.1 | pending R7 | — | Pick-ownership state at the Trade Call | DR2-0082 |
| CBA2-A12.2 | pending R7 | — | — | DR2-0082, DR2-0034 |
| CBA2-A12.3 | pending R7 | CBA2-A12.1, CBA2-A12.4 | Future-draft pick ownership and protection branches | DR2-0082, DR2-0034 |
| CBA2-A12.4 | pending R7 | — | Season-end Apron Team Salary history; seven-Season projection | DR2-0082 |
| CBA2-A12.5 | pending R7 | CBA2-A12.4 | Four-year Second Apron history | DR2-0082 |
| CBA2-A12.6 | pending R7 | — | Trade Call; Trade Memorandum | DR2-0080 |
| CBA2-A12.7 | pending R7 | CBA2-A12.5 | Four-year Second Apron history; unfreeze event | DR2-0081 |
| CBA2-A12.8 | pending R7 | CBA2-A12.6 | Trade Call terms; Trade Memorandum contents | DR2-0094 |
| CBA2-A12.9 | pending R7 | CBA2-A12.6 | Trade Call disclosures; challenged transaction term | DR2-0094 |

### 15.11 Historical crosswalk (created by R3; A family)

Typed edges from published v1.1 LEAFs (meanings fixed at commit `9814939c`, file SHA-256 `4a0760c8…`) to active v2 LEAFs, per §15.9.3. R3.1 migrated every committed A-family edge to a declared historical fragment and repaired the named cross-family lineage. R4–R6 extend this section in place. Historical verdicts never transfer; current deferrals name their resolving unit and must exit through later AMEND lineage.

| Edge ID | Historical v1.1 LEAF | Active v2 LEAF or — | Edge type | Scope/relationship | Decision record |
|---|---|---|---|---|---|
| XW2-0001 | CBA-A01.1 | CBA2-A01.1 | `merge` | [CBA-A01.1:F1] span:0-66 — Whole obligation (independent derivation of the defined salary quantities); absorbed with CBA-A01.2 and the CBA-A01.3 fragment | DR2-0036 |
| XW2-0002 | CBA-A01.2 | CBA2-A01.1 | `merge` | [CBA-A01.2:F1] span:0-122 — Whole obligation (player-compensation ledger separate from Team Salary) — the same non-substitution rule stated for the Compensation/Salary pair | DR2-0036 |
| XW2-0003 | CBA-A01.3 | CBA2-A01.1 | `partial-overlap` | [CBA-A01.3:F1] span:0-88 — Context-dependent-derivation fragment only; the 'no shared mutable salary field' clause is implementation instruction (process material, not carried); the explicit-date fragment is deferred to R6 (see deferrals) | DR2-0036 |
| XW2-0004 | CBA-A02.1 | CBA2-A02.8 | `merge` | [CBA-A02.1:F1] span:0-93 — Whole obligation (implement the official Expanded TPE formula; never hard-code displayed boundaries); absorbed with CBA-A02.5 and the CBA-A02.4 formula fragment | DR2-0014 |
| XW2-0005 | CBA-A02.2 | CBA2-A02.12 | `merge` | [CBA-A02.2:F1] span:0-91 — Whole obligation (allowance test uses post-assignment Apron Team Salary); absorbed with CBA-A02.8 | DR2-0015 |
| XW2-0006 | CBA-A02.3 | — | `process-only` | [CBA-A02.3:F1] span:0-84 — Correction/process note about remembered five-tier structure; the operative no-hard-coding contract lives in CBA2-A02.8's requirement | DR2-0048 |
| XW2-0007 | CBA-A02.4 | CBA2-A02.7 | `split` | [CBA-A02.4:F1] span:0-35 — Expanded-path structure fragment (one or more outgoing/incoming; simultaneous), wholly owned by the target | DR2-0002 |
| XW2-0008 | CBA-A02.4 | CBA2-A02.8 | `partial-overlap` | [CBA-A02.4:F2] span:35-72 — Formula fragment, folded with owners CBA-A02.1/CBA-A02.5 | DR2-0014 |
| XW2-0009 | CBA-A02.4 | CBA2-A05.7 | `partial-overlap` | [CBA-A02.4:F3] span:72-103 — Row-E apron fragment (must land at/below First Apron), folded with CBA-A12.5's row fragment | DR2-0027 |
| XW2-0010 | CBA-A02.4 | CBA2-A05.2 | `partial-overlap` | [CBA-A02.4:F4] span:103-147 — Hard-cap fragment (creates First Apron hard cap), folded with CBA-A13 | DR2-0025 |
| XW2-0011 | CBA-A02.5 | CBA2-A02.8 | `merge` | [CBA-A02.5:F1] span:0-54 — Whole obligation (max ITS formula max(min(2O+K, O+A), 1.25O+K)) | DR2-0014 |
| XW2-0012 | CBA-A02.6 | — | `process-only` | [CBA-A02.6:F1] span:0-107 — UI tier-derivation instruction; the no-fixed-boundaries contract lives in CBA2-A02.8's requirement | DR2-0049 |
| XW2-0013 | CBA-A02.7 | CBA2-A02.6 | `equivalent` | [CBA-A02.7:F1] span:0-121 — Whole obligation (110% Transition TPE existed only for 2023-24; historical simulations only) | DR2-0002 |
| XW2-0014 | CBA-A02.8 | CBA2-A02.12 | `merge` | [CBA-A02.8:F1] span:0-104 — Whole obligation ($250K allowance reduced to zero above the First Apron on post-assignment Apron Team Salary) | DR2-0015 |
| XW2-0015 | CBA-A03.1 | CBA2-A03.1 | `merge` | [CBA-A03.1:F1] span:0-107 — Whole obligation (in-season non-guaranteed OTS = salary less unearned/unprotected); the 'test at 0%, 25%, 100% elapsed' clause is testing instruction (process material, not carried) | DR2-0016 |
| XW2-0016 | CBA-A03.2 | CBA2-A03.1 | `merge` | [CBA-A03.2:F1] span:0-73 — Whole obligation (window 1: count the protected amount) — the §6(j)(6) general reduction applied pre-season (example case (W)) | DR2-0016 |
| XW2-0017 | CBA-A03.3 | CBA2-A03.1 | `merge` | [CBA-A03.3:F1] span:0-105 — Whole obligation (window 2: salary less unearned/unprotected base compensation) — the general reduction applied in-season (example case (X)) | DR2-0016 |
| XW2-0018 | CBA-A03.4 | CBA2-A03.2 | `equivalent` | [CBA-A03.4:F1] span:0-82 — Whole obligation (window 3: January 8 through Regular Season end deemed fully protected) | DR2-0003 |
| XW2-0019 | CBA-A03.5 | CBA2-A03.3 | `equivalent` | [CBA-A03.5:F1] span:0-117 — Whole obligation (window 4: post-season lesser-of rule) | DR2-0003 |
| XW2-0020 | CBA-A04 | CBA2-A03.4 | `partial-overlap` | [CBA-A04:F1] span:0-118 — Historical sign-and-trade base-year summary overlaps the complete current trigger/calculation owners; this edge carries the deemed-Salary result while CBA2-A03.13 separately owns the source-located conjunctive trigger | DR2-0033 |
| XW2-0021 | CBA-A05.1 | CBA2-A03.5 | `merge` | [CBA-A05.1:F1] span:0-78 — Whole obligation (trade before extension begins triggers poison-pill treatment) — the trigger half of §8(g) | DR2-0017 |
| XW2-0022 | CBA-A05.2 | CBA2-A03.5 | `merge` | [CBA-A05.2:F1] span:0-163 — Whole obligation (deemed average annual salary for acquiring-side fit, including option treatment via VII §9(a)(2)) | DR2-0017 |
| XW2-0023 | CBA-A06.1 | CBA2-A03.7 | `merge` | [CBA-A06.1:F1] span:0-178 — Whole obligation (likelihood based on preceding season; team-related criteria re-test on team change) | DR2-0018 |
| XW2-0024 | CBA-A06.2 | CBA2-A03.7 | `merge` | [CBA-A06.2:F1] span:0-128 — Whole obligation (per-team re-test makes OTS and ITS diverge) | DR2-0018 |
| XW2-0025 | CBA-A07.1 | CBA2-A04.4 | `equivalent` | [CBA-A07.1:F1] span:0-74 — Whole obligation (trade bonus cannot push Salary plus Unlikely Bonuses above 120% of the Rookie Scale Amount) | DR2-0004 |
| XW2-0026 | CBA-A07.2 | CBA2-A04.1 | `split` | [CBA-A07.2:F2] span:48-61 — 15% ceiling component | DR2-0019 |
| XW2-0027 | CBA-A07.2 | CBA2-A04.2 | `partial-overlap` | [CBA-A07.2:F3] span:94-108 — Paid-once fragment, folded with owner CBA-A07.5 | DR2-0020 |
| XW2-0028 | CBA-A07.2 | CBA2-A04.3 | `partial-overlap` | [CBA-A07.2:F5] span:133-154 — Then-current-and-remaining protected-percentage allocation fragment, folded with the CBA-A07.8 fragment | DR2-0021 |
| XW2-0029 | CBA-A07.2 | CBA2-A04.7 | `partial-overlap` | [CBA-A07.2:F4] span:108-133 — Generally-paid-by-sender fragment, folded with owner CBA-A07.9 | DR2-0022 |
| XW2-0030 | CBA-A07.3 | CBA2-A04.8 | `split` | [CBA-A07.3:F1] span:0-64 — Whole obligation (current-year allocated portion increases ITS and receiving Team Salary) | DR2-0083 |
| XW2-0031 | CBA-A07.4 | CBA2-A04.1 | `split` | [CBA-A07.4:F1] span:0-26 — 15% ceiling component | DR2-0019 |
| XW2-0032 | CBA-A07.5 | CBA2-A04.2 | `merge` | [CBA-A07.5:F1] span:0-126 — Whole obligation (triggered once; initial sign-and-trade/extend-and-trade does not consume; later trade can) | DR2-0020 |
| XW2-0033 | CBA-A07.6 | CBA2-A04.5 | `split` | [CBA-A07.6:F1] span:0-52 — Reduction/waiver-permission fragment, wholly owned by the target | DR2-0004 |
| XW2-0034 | CBA-A07.6 | CBA2-A04.6 | `split` | [CBA-A07.6:F2] span:52-106 — Six-month renegotiation-restriction fragment, wholly owned by the target | DR2-0004 |
| XW2-0036 | CBA-A07.8 | CBA2-A04.3 | `partial-overlap` | [CBA-A07.8:F1] span:0-83 — Allocation fragment (VII §3(b)(1)(ii) basis), folded with the CBA-A07.2 fragment | DR2-0021 |
| XW2-0037 | CBA-A07.8 | CBA2-A04.9 | `partial-overlap` | [CBA-A07.8:F2] span:83-144 — General maximum-reduction fragment; the current owner states the complete Article II §7(f) service-band formula and deemed downward amendment rather than the historical summary's unspecified annual-maximum shorthand | DR2-0083 |
| XW2-0038 | CBA-A07.9 | CBA2-A04.7 | `split` | [CBA-A07.9:F1] span:0-42 — sender-payment-default component; the receiving-Team and individual-Salary components are separately split | DR2-0083 |
| XW2-0039 | CBA-A08.1 | CBA2-A03.8 | `partial-overlap` | [CBA-A08.1:F2] span:115-139 — Acquisition/$0-ITS fragment only; the contract-shape and proration fragments are deferred to R4 (see deferrals) | DR2-0023 |
| XW2-0041 | CBA-A09.1 | CBA2-A05.1 | `partial-overlap` | [CBA-A09.1:F1] span:0-51 — Type/apron-dependent-availability fragment, folded into the general post-transaction test | DR2-0027 |
| XW2-0042 | CBA-A09.1 | CBA2-A05.2 | `partial-overlap` | [CBA-A09.1:F2] span:51-100 — Hard-cap-effects fragment, folded with CBA-A13 | DR2-0025 |
| XW2-0043 | CBA-A09.2 | CBA2-A02.9 | `split` | [CBA-A09.2:F1] span:0-56 — Room-path limit fragment (room + $250K), wholly owned by the target | DR2-0002 |
| XW2-0044 | CBA-A09.2 | CBA2-A02.10 | `split` | [CBA-A09.2:F2] span:56-118 — Room-path exclusivity fragment (no simultaneous TPE combination), wholly owned by the target | DR2-0002 |
| XW2-0045 | CBA-A09.3 | CBA2-A02.1 | `partial-overlap` | [CBA-A09.3:F1] span:0-40 — Structure fragment (one outgoing, one or more incoming), folded with the CBA-A10.1 fragment | DR2-0028 |
| XW2-0046 | CBA-A09.3 | CBA2-A02.2 | `split` | [CBA-A09.3:F2] span:40-81 — Money-limit fragment (100% OTS + $250K), wholly owned by the target | DR2-0002 |
| XW2-0047 | CBA-A09.3 | CBA2-A02.3 | `partial-overlap` | [CBA-A09.3:F3] span:81-132 — Twelve-month-expiry fragment, folded with the CBA-A09.5 reminder | DR2-0029 |
| XW2-0048 | CBA-A09.3 | CBA2-A05.8 | `partial-overlap` | [CBA-A09.3:F4] span:132-177 — First-Apron-timing fragment, folded with CBA-A12.6/CBA-A09.5 | DR2-0030 |
| XW2-0049 | CBA-A09.4 | CBA2-A02.4 | `split` | [CBA-A09.4:F1] span:0-46 — Structure fragment (multiple outgoing aggregated; simultaneous), wholly owned by the target | DR2-0002 |
| XW2-0050 | CBA-A09.4 | CBA2-A02.5 | `split` | [CBA-A09.4:F2] span:46-85 — Money-limit fragment (100% aggregate OTS + $250K), wholly owned by the target | DR2-0002 |
| XW2-0051 | CBA-A09.4 | CBA2-A05.10 | `partial-overlap` | [CBA-A09.4:F3] span:85-129 — Row-H apron fragment (must land at/below Second Apron), folded with CBA-A12.7/CBA-A10.1 | DR2-0031 |
| XW2-0052 | CBA-A09.5 | CBA2-A05.8 | `partial-overlap` | [CBA-A09.5:F1] span:0-86 — Row-F aged-TPE timing fragment (whole point of the row), folded with CBA-A12.6 | DR2-0030 |
| XW2-0053 | CBA-A09.5 | CBA2-A02.3 | `partial-overlap` | [CBA-A09.5:F2] span:86-174 — One-year non-simultaneous-expiration reminder fragment, folded with the CBA-A09.3 fragment | DR2-0029 |
| XW2-0054 | CBA-A10.1 | CBA2-A02.1 | `partial-overlap` | [CBA-A10.1:F1] span:0-77 — Standard-path multi-incoming permission fragment, folded with the CBA-A09.3 fragment | DR2-0028 |
| XW2-0055 | CBA-A10.1 | CBA2-A05.10 | `partial-overlap` | [CBA-A10.1:F2] span:77-154 — Row-H scope fragment ('no aggregation' bars combining outgoing under the Aggregated path only), folded with CBA-A12.7/CBA-A09.4 | DR2-0031 |
| XW2-0056 | CBA-A10.2 | CBA2-A06.1 | `partial-overlap` | [CBA-A10.2:F1] span:0-102 — Two-month-bar fragment, folded with the CBA-A10.3 re-aggregation fragment | DR2-0089 |
| XW2-0057 | CBA-A10.2 | CBA2-A06.2 | `split` | [CBA-A10.2:F2] span:102-208 — December 16 carve-out fragment, wholly owned by the target | DR2-0089 |
| XW2-0058 | CBA-A10.3 | CBA2-A06.1 | `partial-overlap` | [CBA-A10.3:F1] span:0-54 — Re-aggregation-bar fragment (the same §6(j)(4)(i) rule), folded with CBA-A10.2 | DR2-0089 |
| XW2-0059 | CBA-A10.3 | CBA2-A03.4 | `partial-overlap` | [CBA-A10.3:F2] span:54-114 — Base-year-adjustment fragment, folded with owner CBA-A04 | DR2-0033 |
| XW2-0060 | CBA-A11 | CBA2-A11.1 | `equivalent` | [CBA-A11:F1] span:0-180 — Whole obligation (per-team evaluation and component-trade decomposition, express structure plus INFERRED procedure) | DR2-0011 |
| XW2-0061 | CBA-A12.1 | CBA2-A05.3 | `split` | [CBA-A12.1:F1] span:0-48 — Row-A assignment fragment (BAE → First Apron), wholly owned by the target | DR2-0005 |
| XW2-0062 | CBA-A12.1 | CBA2-A05.1 | `partial-overlap` | [CBA-A12.1:F2] span:48-84 — Post-transaction-test fragment, folded into the general test | DR2-0027 |
| XW2-0063 | CBA-A12.2 | CBA2-A05.4 | `split` | [CBA-A12.2:F1] span:0-40 — Row-B assignment fragment (NTMLE → First Apron), wholly owned by the target | DR2-0005 |
| XW2-0064 | CBA-A12.2 | CBA2-A05.1 | `partial-overlap` | [CBA-A12.2:F2] span:40-85 — Post-transaction-test fragment | DR2-0027 |
| XW2-0065 | CBA-A12.3 | CBA2-A05.5 | `partial-overlap` | [CBA-A12.3:F1] span:0-37 — Row-C assignment fragment, folded with CBA-A12.10 | DR2-0024 |
| XW2-0066 | CBA-A12.3 | CBA2-A05.1 | `partial-overlap` | [CBA-A12.3:F2] span:37-72 — Post-transaction-test fragment | DR2-0027 |
| XW2-0067 | CBA-A12.4 | CBA2-A05.6 | `split` | [CBA-A12.4:F1] span:0-54 — Row-D assignment fragment (qualifying waived-player signing → First Apron), wholly owned by the target | DR2-0005 |
| XW2-0068 | CBA-A12.4 | CBA2-A05.1 | `partial-overlap` | [CBA-A12.4:F2] span:54-108 — Post-transaction-test fragment | DR2-0027 |
| XW2-0069 | CBA-A12.5 | CBA2-A05.7 | `partial-overlap` | [CBA-A12.5:F1] span:0-26 — Row-E assignment fragment, folded with the CBA-A02.4 fragment | DR2-0027 |
| XW2-0070 | CBA-A12.5 | CBA2-A05.1 | `partial-overlap` | [CBA-A12.5:F2] span:26-58 — Post-transaction-test fragment | DR2-0027 |
| XW2-0071 | CBA-A12.6 | CBA2-A05.8 | `partial-overlap` | [CBA-A12.6:F1] span:0-55 — Row-F assignment fragment, folded with CBA-A09.5 | DR2-0030 |
| XW2-0072 | CBA-A12.6 | CBA2-A05.1 | `partial-overlap` | [CBA-A12.6:F2] span:55-111 — Post-transaction-test fragment | DR2-0027 |
| XW2-0073 | CBA-A12.7 | CBA2-A05.10 | `partial-overlap` | [CBA-A12.7:F1] span:0-42 — Row-H assignment fragment, folded with CBA-A09.4/CBA-A10.1 | DR2-0031 |
| XW2-0074 | CBA-A12.7 | CBA2-A05.1 | `partial-overlap` | [CBA-A12.7:F2] span:42-96 — Post-transaction-test fragment | DR2-0027 |
| XW2-0075 | CBA-A12.8 | CBA2-A05.12 | `split` | [CBA-A12.8:F1] span:0-43 — Row-J assignment fragment (sign-and-traded-contract TPE → Second Apron), wholly owned by the target | DR2-0005 |
| XW2-0076 | CBA-A12.8 | CBA2-A05.1 | `partial-overlap` | [CBA-A12.8:F2] span:43-88 — Post-transaction-test fragment | DR2-0027 |
| XW2-0077 | CBA-A12.9 | CBA2-A05.13 | `split` | [CBA-A12.9:F1] span:0-29 — Row-K assignment fragment (TMLE → Second Apron), wholly owned by the target | DR2-0005 |
| XW2-0078 | CBA-A12.9 | CBA2-A05.1 | `partial-overlap` | [CBA-A12.9:F2] span:29-51 — Post-transaction-test fragment | DR2-0027 |
| XW2-0079 | CBA-A12.10 | CBA2-A05.5 | `partial-overlap` | [CBA-A12.10:F1] span:0-48 — Row-C assignment fragment (receiving by sign-and-trade), folded with CBA-A12.3 | DR2-0024 |
| XW2-0080 | CBA-A12.10 | CBA2-A05.2 | `partial-overlap` | [CBA-A12.10:F2] span:48-100 — Hard-cap fragment (creates a First Apron hard cap), folded with CBA-A13 | DR2-0025 |
| XW2-0081 | CBA-A13 | CBA2-A05.2 | `merge` | [CBA-A13:F1] span:0-111 — Whole obligation (executing a restricted transaction creates the row-level hard cap; the published First-Apron-only wording under-stated the general rule); absorbed with the CBA-A12.10/CBA-A02.4/CBA-A09.1 fragments | DR2-0025 |
| XW2-0082 | CBA-A14.1 | CBA2-A05.15 | `merge` | [CBA-A14.1:F1] span:0-84 — Whole obligation (dual-year test gated by transaction type — rows E-J only) | DR2-0026 |
| XW2-0083 | CBA-A14.2 | CBA2-A05.15 | `merge` | [CBA-A14.2:F1] span:0-149 — Whole obligation (post-regular-season rows E-J transactions satisfy both years' applicable aprons) | DR2-0026 |
| XW2-0084 | CBA-A14.3 | CBA2-A05.17 | `equivalent` | [CBA-A14.3:F1] span:0-179 — Whole obligation (the next-year computation assumptions) | DR2-0005 |
| XW2-0085 | CBA-A14.4 | CBA2-A05.16 | `equivalent` | [CBA-A14.4:F1] span:0-74 — Whole obligation (such a transaction can hard-cap both years — the Subsequent-year hard cap) | DR2-0005 |
| XW2-0086 | CBA-A15.1 | — | `invalid` | [CBA-A15.1:F1] span:0-132 — The published row asserted an enforceable OPS-authority two-team asset-exchange requirement; secondary reporting was its only support, so the authority/enforceability claim is false under §15.9.5-§15.9.6. The reported mechanic is preserved as an unsupported operational candidate in §12.2 (never registrable or enforceable while unsupported) | DR2-0050 |
| XW2-0087 | CBA-A15.2 | — | `invalid` | [CBA-A15.2:F1] span:0-118 — False OPS-authority claim (two-other-team touch test); candidate preserved in §12.2 | DR2-0051 |
| XW2-0088 | CBA-A15.3 | — | `invalid` | [CBA-A15.3:F1] span:0-106 — False OPS-authority claim (stricter multi-team asset definitions); candidate preserved in §12.2 | DR2-0052 |
| XW2-0089 | CBA-A15.4 | — | `invalid` | [CBA-A15.4:F1] span:0-116 — False OPS-authority claim (deemed draft-rights status tests); candidate preserved in §12.2 | DR2-0053 |
| XW2-0090 | CBA-A15.5 | — | `invalid` | [CBA-A15.5:F1] span:0-80 — False OPS-authority claim (multi-team graph validation as an enforceable operational rule); candidate preserved in §12.2 | DR2-0054 |
| XW2-0091 | CBA-A16 | CBA2-A09.1 | `equivalent` | [CBA-A16:F1] span:0-150 — Whole obligation (open list room required at the trade, planned waiver notwithstanding); the active statement follows BYL 4.05(e)'s exact list scope (Active, Inactive, or Two-Way List) and same-transaction accounting | DR2-0009 |
| XW2-0092 | CBA-A17.1 | CBA2-A12.3 | `partial-overlap` | [CBA-A17.1:F4] span:92-116 — Stepien-availability fragment (pick state consumed by the Stepien test), folded with the CBA-A17.5/CBA-A17.6 owners; the general pick-ledger representation fragment is deferred to R6 (see deferrals) | DR2-0012 |
| XW2-0093 | CBA-A17.1 | CBA2-A12.4 | `partial-overlap` | [CBA-A17.1:F2] span:72-79 — Frozen/slid-status fragment (frozen-pick trading state); the slide/penalty representation is deferred to R6 (see deferrals) | DR2-0012 |
| XW2-0094 | CBA-A17.2 | CBA2-A12.1 | `partial-overlap` | [CBA-A17.2:F2] span:34-115 — owned-right/no-expected-asset component, re-grounded as an INFERRED chain from BYL 4.01(a)/4.02(a)-(b)/4.05(a) | DR2-0083 |
| XW2-0095 | CBA-A17.3 | — | `invalid` | [CBA-A17.3:F1] span:0-146 — False OPS-authority claim (protection/deferral combination bar and one-year deferral right as enforceable operational rules); the reported mechanics are preserved as unsupported operational candidates in §13.3; the real representation duty is deferred with the CBA-A17.1 fragment | DR2-0055 |
| XW2-0096 | CBA-A17.4 | — | `invalid` | [CBA-A17.4:F1] span:0-132 — False OPS-authority claim (seven-future-draft horizon); candidate preserved in §13.3 | DR2-0056 |
| XW2-0097 | CBA-A17.5 | CBA2-A12.2 | `split` | [CBA-A17.5:F1] span:0-110 — No-cash-sale fragment (BYL 7.03 first clause), wholly owned by the target | DR2-0034 |
| XW2-0098 | CBA-A17.5 | CBA2-A12.3 | `partial-overlap` | [CBA-A17.5:F2] span:110-220 — Stepien-test fragment (may-test, owned-first satisfaction, branch testing), folded with owner CBA-A17.6 | DR2-0034 |
| XW2-0099 | CBA-A17.6 | CBA2-A12.3 | `merge` | [CBA-A17.6:F1] span:0-103 — Whole obligation (protections evaluated across all possible conveyance branches — the 'may' semantics of the one BYL 7.03 test); absorbed with the CBA-A17.5 fragment | DR2-0034 |
| XW2-0100 | CBA-A17.7 | — | `invalid` | [CBA-A17.7:F1] span:0-104 — False OPS-authority claim (the 'two years after prior conveyance' limit presupposed the unsupported seven-draft horizon); candidate preserved in §13.3 | DR2-0057 |
| XW2-0101 | CBA-A18.1 | CBA2-A08.1 | `partial-overlap` | [CBA-A18.1:F1] span:0-44 — Sent-balance ledger fragment, folded with the CBA-A18.4/CBA-A18.5 fragments | DR2-0035 |
| XW2-0102 | CBA-A18.1 | CBA2-A08.2 | `partial-overlap` | [CBA-A18.1:F1] span:44-61 — Received-balance ledger fragment | DR2-0035 |
| XW2-0103 | CBA-A18.2 | CBA2-A05.11 | `partial-overlap` | [CBA-A18.2:F1] span:0-26 — Row-I assignment fragment (cash prohibited above the Second Apron), folded with owner CBA-A18.8 | DR2-0013 |
| XW2-0104 | CBA-A18.2 | CBA2-A05.1 | `partial-overlap` | [CBA-A18.2:F2] span:26-59 — Post-transaction-test fragment | DR2-0027 |
| XW2-0105 | CBA-A18.3 | CBA2-A08.3 | `equivalent` | [CBA-A18.3:F1] span:0-68 — Whole obligation (sending-team signing bonus treated as cash-in-trade) | DR2-0008 |
| XW2-0106 | CBA-A18.4 | CBA2-A08.1 | `partial-overlap` | [CBA-A18.4:F1] span:0-21 — Cap-indexed separate sent-limit fragment | DR2-0035 |
| XW2-0107 | CBA-A18.4 | CBA2-A08.2 | `partial-overlap` | [CBA-A18.4:F1] span:21-85 — Cap-indexed separate received-limit fragment | DR2-0035 |
| XW2-0110 | CBA-A18.6 | CBA2-A08.5 | `equivalent` | [CBA-A18.6:F1] span:0-30 — Whole obligation (cash has no Team Salary effect), re-grounded as an INFERRED chain from VII §4(a)/§8(a) | DR2-0008 |
| XW2-0112 | CBA-A18.8 | CBA2-A05.11 | `merge` | [CBA-A18.8:F1] span:0-49 — Whole obligation (paying cash is a Second Apron-limited transaction — row I); absorbed with the CBA-A18.2 fragment | DR2-0013 |
| XW2-0113 | CBA-A19.1 | CBA2-A07.1 | `equivalent` | [CBA-A19.1:F1] span:0-105 — Whole obligation (§8(e)(1)(i) roster condition) | DR2-0007 |
| XW2-0114 | CBA-A19.2 | CBA2-A07.6 | `equivalent` | [CBA-A19.2:F1] span:0-62 — Whole obligation (§8(e)(1)(v) pre-season completion) | DR2-0007 |
| XW2-0115 | CBA-A19.3 | CBA2-A07.2 | `split` | [CBA-A19.3:F1] span:0-43 — Minimum-term fragment (≥3 Seasons excluding options), wholly owned by the target | DR2-0007 |
| XW2-0116 | CBA-A19.3 | CBA2-A07.3 | `split` | [CBA-A19.3:F2] span:43-92 — Maximum-term fragment (≤4 Seasons), wholly owned by the target | DR2-0007 |
| XW2-0117 | CBA-A19.3 | CBA2-A07.4 | `split` | [CBA-A19.3:F3] span:92-140 — Year-1 full lack-of-skill protection fragment, wholly owned by the target | DR2-0007 |
| XW2-0118 | CBA-A19.4 | CBA2-A07.5 | `equivalent` | [CBA-A19.4:F1] span:0-67 — Whole obligation (§8(e)(1)(iii) exception bar — NTMLE and Room MLE) | DR2-0007 |
| XW2-0119 | CBA-A19.5 | CBA2-A07.8 | `equivalent` | [CBA-A19.5:F1] span:0-105 — Whole obligation (§8(e)(1)(vii) acquiring-team Room requirement) | DR2-0007 |
| XW2-0120 | CBA-A20.1 | CBA2-A10.4 | `partial-overlap` | [CBA-A20.1:F1] span:0-35 — 120%-measures fragment, folded with owner CBA-A20.3 | DR2-0010 |
| XW2-0121 | CBA-A20.1 | CBA2-A10.3 | `partial-overlap` | [CBA-A20.1:F2] span:35-67 — Length-limit fragment, folded with the CBA-A20.4 fragment | DR2-0010 |
| XW2-0122 | CBA-A20.1 | CBA2-A10.5 | `partial-overlap` | [CBA-A20.1:F3] span:67-100 — 5%-changes fragment, folded with the CBA-A20.4 fragment | DR2-0010 |
| XW2-0123 | CBA-A20.2 | CBA2-A10.6 | `split` | [CBA-A20.2:F1] span:0-61 — Ordinary-extension-eligibility fragment (§7(a) compliance), wholly owned by the target | DR2-0010 |
| XW2-0124 | CBA-A20.2 | CBA2-A10.2 | `split` | [CBA-A20.2:F2] span:61-123 — End-of-contract offseason-window fragment (§8(e)(2)(i)), wholly owned by the target | DR2-0010 |
| XW2-0125 | CBA-A20.3 | CBA2-A10.4 | `merge` | [CBA-A20.3:F1] span:0-123 — Whole obligation (starting salary capped at greater of 120% of prior regular salary or 120% of EAPS, adjusted for incentives); absorbed with the CBA-A20.1 fragment | DR2-0010 |
| XW2-0126 | CBA-A20.4 | CBA2-A10.3 | `partial-overlap` | [CBA-A20.4:F1] span:0-41 — Total-length fragment, folded with the CBA-A20.1 fragment | DR2-0010 |
| XW2-0127 | CBA-A20.4 | CBA2-A10.5 | `partial-overlap` | [CBA-A20.4:F2] span:41-79 — Annual-changes fragment, folded with the CBA-A20.1 fragment | DR2-0010 |
| XW2-0128 | CBA-A20.5 | CBA2-A10.1 | `split` | [CBA-A20.5:F1] span:0-43 — Linked-process fragment (extension and trade linked per §8(e)(2)), wholly owned by the target | DR2-0010 |
| XW2-0129 | CBA-A20.5 | CBA2-A10.7 | `split` | [CBA-A20.5:F2] span:43-90 — Six-month richer-pre-trade-extension fragment (outbound bar), wholly owned by the target | DR2-0010 |
| XW2-0130 | CBA-A20.5 | CBA2-A10.8 | `split` | [CBA-A20.5:F3] span:90-145 — Six-month richer-post-trade-extension fragment (inbound bar), wholly owned by the target | DR2-0010 |
| XW2-0131 | CBA-A21 | CBA2-A06.3 | `equivalent` | [CBA-A21:F1] span:0-294 — Whole obligation (minimum-stacking prohibition with its three conjunctive conditions and season-dependent classification) | DR2-0006 |
| XW2-0132 | CBA-A04 | CBA2-A03.9 | `split` | [CBA-A04:F2] span:118-190 — prior-minimum League-reimbursement component | DR2-0083 |
| XW2-0133 | CBA-A07.2 | CBA2-A04.13 | `split` | [CBA-A07.2:F1] span:29-48 — percentage-form component | DR2-0083 |
| XW2-0134 | CBA-A07.2 | CBA2-A04.15 | `split` | [CBA-A07.2:F6] span:154-205 — receiver Team Salary component | DR2-0083 |
| XW2-0135 | CBA-A07.3 | CBA2-A04.15 | `split` | [CBA-A07.3:F1] span:64-86 — receiving Team Salary component | DR2-0083 |
| XW2-0136 | CBA-A07.4 | CBA2-A04.13 | `split` | [CBA-A07.4:F2] span:75-93 — percentage-form component | DR2-0083 |
| XW2-0137 | CBA-A07.7 | — | `invalid` | [CBA-A07.7:F1] span:0-163 — false guaranteed-compensation/day-proration formula; the signed basis is remaining Base Compensation with an unexercised-Option exclusion and is separately owned by CBA2-A04.16 | DR2-0098 |
| XW2-0138 | CBA-A07.9 | CBA2-A04.15 | `split` | [CBA-A07.9:F2] span:42-77 — receiving Team Salary component | DR2-0083 |
| XW2-0139 | CBA-A07.9 | CBA2-A04.8 | `split` | [CBA-A07.9:F2] span:77-93 — receiving individual trade-Salary component | DR2-0083 |
| XW2-0140 | CBA-A08.1 | CBA2-A03.11 | `split` | [CBA-A08.1:F2] span:139-159 — no-TPE/no-room capacity consequence | DR2-0083 |
| XW2-0141 | CBA-A08.2 | CBA2-A03.11 | `split` | [CBA-A08.2:F1] span:0-60 — no-TPE/no-room capacity consequence | DR2-0083 |
| XW2-0142 | CBA-A08.2 | CBA2-A03.12 | `split` | [CBA-A08.2:F2] span:60-88 — assignor reimbursement-exclusion component | DR2-0083 |
| XW2-0143 | CBA-A18.5 | CBA2-A08.6 | `equivalent` | [CBA-A18.5:F1] span:0-42 — whole no-netting obligation | DR2-0083 |
| XW2-0144 | CBA-A18.7 | CBA2-A08.7 | `split` | [CBA-A18.7:F1] span:0-108 — conditional-cash trade-year component | DR2-0083 |
| XW2-0145 | CBA-A18.7 | — | `unsupported-residual` | [CBA-A18.7:F2] span:108-173 — later re-trade attribution/accounting residual preserved at §12.12 | DR2-0058 |
| XW2-0146 | CBA-A17.2 | CBA2-A12.6 | `partial-overlap` | [CBA-A17.2:F1] span:0-34 — future-pick identification component; current Trade Call disclosure owner is broader and separately source-certified | DR2-0083 |
| XW2-0147 | CBA-A08.1 | — | `deferred` | [CBA-A08.1:F1] span:0-115 — Minimum Contract shape and proration; families:A,C; resolving-unit:R4 | DR2-0092 |
| XW2-0148 | CBA-A17.1 | — | `deferred` | [CBA-A17.1:F1] span:0-72 — pick-ledger representation; families:A,L; resolving-unit:R6 | DR2-0092 |
| XW2-0149 | CBA-A17.1 | — | `deferred` | [CBA-A17.1:F3] span:79-92 — deferral and conveyance-dependency representation; families:A,L; resolving-unit:R6 | DR2-0092 |
| XW2-0150 | CBA-A01.3 | — | `deferred` | [CBA-A01.3:F2] span:88-121 — explicit-date lifecycle representation; families:A,L; resolving-unit:R6 | DR2-0092 |
| XW2-0151 | CBA-A01.4 | — | `deferred` | [CBA-A01.4:F1] span:0-54 — Team Salary roster-inclusion owner; families:A,C; resolving-unit:R4 | DR2-0092 |
| XW2-0152 | CBA-C11.9 | CBA2-A02.13 | `partial-overlap` | [CBA-C11.9:F1] span:0-166 — disabled-player no-TPE and replacement-player nonattachment components combined in the current owner | DR2-0092 |
| XW2-0153 | CBA-C11.9 | — | `deferred` | [CBA-C11.9:F2] span:166-247 — DPE-extinction lifecycle; families:C,L; resolving-unit:R6 | DR2-0092 |
| XW2-0154 | CBA-C20.7 | CBA2-A02.14 | `moved` | [CBA-C20.7:F1] span:0-63 — Two-Way trade-salary/TPE exclusion re-homed into critical correctness | DR2-0092 |
| XW2-0155 | CBA-C13.8 | — | `deferred` | [CBA-C13.8:F1] span:0-61 — TMLE contract shape and signing mechanics; families:C,C; resolving-unit:R4 | DR2-0095 |
| XW2-0156 | CBA-C13.8 | CBA2-A05.13 | `partial-overlap` | [CBA-C13.8:F2] span:84-98 — TMLE row-K/Second-Apron component | DR2-0092 |
| XW2-0157 | CBA-C13.8 | CBA2-A05.1 | `partial-overlap` | [CBA-C13.8:F2] span:61-84 — post-transaction apron-test component | DR2-0092 |
| XW2-0158 | CBA-C13.8 | CBA2-A05.2 | `split` | [CBA-C13.8:F3] span:98-134 — Second Apron hard-cap component | DR2-0092 |
| XW2-0159 | CBA-C13.8 | CBA2-A05.14 | `split` | [CBA-C13.8:F4] span:134-179 — TMLE-use disables specified tools component | DR2-0092 |
| XW2-0160 | CBA-L08.5 | CBA2-A12.5 | `split` | [CBA-L08.5:F1] span:0-133 — frozen-pick unfreeze timing component | DR2-0093 |
| XW2-0161 | CBA-L08.5 | CBA2-A12.7 | `split` | [CBA-L08.5:F2] span:133-148 — no-slide/no-Draft-Pick-Penalty component | DR2-0093 |
| XW2-0162 | CBA-A07.2 | CBA2-A04.39 | `split` | [CBA-A07.2:F1] span:0-29 — fixed/dollar-form component | DR2-0083 |
| XW2-0163 | CBA-A07.2 | CBA2-A04.16 | `split` | [CBA-A07.2:F2] span:61-94 — remaining-Base-Compensation basis component | DR2-0083 |
| XW2-0164 | CBA-A07.4 | CBA2-A04.16 | `split` | [CBA-A07.4:F1] span:26-58 — remaining-Base-Compensation basis component | DR2-0083 |
| XW2-0165 | CBA-A07.4 | CBA2-A04.39 | `split` | [CBA-A07.4:F2] span:58-75 — fixed/dollar-form component | DR2-0083 |
| XW2-0166 | CBA-A07.4 | — | `invalid` | [CBA-A07.4:F3] span:93-118 — false lesser-of-two-form assertion; XXIV §2(a)(iii)(A) permits percentage or dollar forms, not a third lesser-of form | DR2-0097 |

**R3 crosswalk deferrals (named per §15.9.3 rule 8; R8 requires zero remaining):**

| Historical source | Scope deferred | Families | Resolving unit | Basis |
|---|---|---|---|---|
| CBA-A01.4 (whole) | Team Salary composition (salaries of players on the roster) | A ↔ C | R4 | The obligation is Cap Manager substance (Team Salary composition, VII §4(a)(1)); its active owner and this row's crosswalk edge belong to the C-series construction |
| CBA-A01.3 (fragment) | explicit-date/season evaluation context | A ↔ L | R6 | Duplicates the historical CBA-L01.1 obligation (explicit asOfDate/calendar evaluation); the L-family owner and this fragment's edge belong to R6 |
| CBA-A08.1 (fragment) | Minimum Exception contract shape and proration (≤2 Seasons, minimum salary, no bonuses; proration from season start) | A ↔ C | R4 | Exception shape/proration is Cap Manager substance (historical C13 area); the C-family owner and this fragment's edge belong to R4 |
| CBA-A17.1 (fragment) | pick-ledger representation (ownership, swaps, protections, fallback conveyances, deferral state, conveyance dependencies, slide/penalty state) | A ↔ L | R6 | Persistent pick-state representation is lifecycle substance (historical L05/L09 area); the L-family owner and this fragment's edge belong to R6 |

### 15.12 Source/provenance and evidence registries (created by R3)

The shared `SRC2-…`/`EV2-…` registries of §15.9.6. R3 minted the records below; R4–R6 extend both registries in place from the shared namespaces. The CBA and By-Laws PDFs are never committed; the hash-plus-citation chains below are the durable evidence.

#### 15.12.1 SRC2 source/provenance records — base table

| Record ID | Provenance type | Source/provenance identity | Source date (basis:value) or — | Official URL or — | Artifact SHA-256 or — | Artifact byte size or — | Retrieval timestamp or — | Authentication timestamp or — | Verifier identity | Verification session ID | Verification date | Record limitations | Record status | Record version |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SRC2-001 | `official-immutable` | 2023 NBA-NBPA Collective Bargaining Agreement (signed agreement, 2023 edition) | agreement-as-of:2023-06-28 | <https://ak-static.cms.nba.com/wp-content/uploads/sites/4/2023/06/2023-NBA-Collective-Bargaining-Agreement.pdf> | `bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32` | 2850534 | 2026-07-23T11:23:46Z | — | `agent:codex` | `session:r31-20260723-maker` | 2026-07-23 | none | current | 1 |
| SRC2-002 | `official-immutable` | NBA Constitution and By-Laws, June 2024 edition | edition:2024-06 | <https://official.nba.com/wp-content/uploads/sites/4/2024/06/NBA-Consitution-By-Laws-June-2024.pdf> | `be4d2781fe8fddfc5bc9028214298f742789a949dade4ead26368a4336d32ccf` | 422247 | 2026-07-23T11:23:46Z | — | `agent:codex` | `session:r31-20260723-maker` | 2026-07-23 | edition identified by the source to month precision only | current | 1 |
| SRC2-003 | `official-mutable` | NBA Communications official release: NBA Salary Cap for 2023-24 season set at $136.021 million | publication:2023-06-30 | <https://pr.nba.com/nba-salary-cap-for-2023-24-season-set-at-136-021-million/> | `a6ddaa845d23429bbeb9699c39c00891a36c78e73636888e2cfb1f13ea85b804` | 101545 | 2026-07-23T11:23:46Z | — | `agent:codex` | `session:r31-20260723-maker` | 2026-07-23 | Mutable webpage; hash is of the content retrieved at the recorded timestamp | current | 1 |
| SRC2-004 | `official-mutable` | NBA Communications official release: NBA sets Salary Cap for 2026-27 season at $164.961 million | publication:2026-06-30 | <https://pr.nba.com/2026-27-salary-cap/> | `799f5c402e2aa44aef1b80732a0f007c546797f77c7747702030524baf744c72` | 100746 | 2026-07-23T11:23:46Z | — | `agent:codex` | `session:r31-20260723-maker` | 2026-07-23 | Mutable webpage; hash is of the content retrieved at the recorded timestamp | current | 1 |

#### 15.12.2 SRC2 detail table — `official-immutable`

| Record ID | Source title and edition | Page geometry |
|---|---|---|
| SRC2-001 | 2023 NBA-NBPA Collective Bargaining Agreement, signed edition, entered into as of June 28, 2023 (Article I §1(d)) | 676 PDF pages; printed page = PDF page − 24; exhibits paginated A-1 onward (printed page A-n = PDF page 584 + n) |
| SRC2-002 | National Basketball Association Constitution and By-Laws, June 2024 edition | 88 PDF pages; printed page = PDF page − 7 |

#### 15.12.3 SRC2 detail table — `official-mutable`

| Record ID | Publication identity | Publication date or — | Season or — | Exact values or text relied upon | Archive/snapshot reference or — |
|---|---|---|---|---|---|
| SRC2-003 | Official Release, June 30, 2023 | 2023-06-30 | — | 2023-24 Salary Cap $136.021 million | captured artifact SHA-256 a6ddaa845d23429bbeb9699c39c00891a36c78e73636888e2cfb1f13ea85b804 |
| SRC2-004 | Official Release, June 30, 2026 | 2026-06-30 | — | 2026-27 Salary Cap $164.961 million; First Apron Level $209.015 million; Second Apron Level $221.686 million; Tax Level $200.428 million; Minimum Team Salary $148.465 million | captured artifact SHA-256 799f5c402e2aa44aef1b80732a0f007c546797f77c7747702030524baf744c72 |

#### 15.12.4 SRC2 detail table — `ops-provenance`

No `ops-provenance` record has been constructed. This governed location
remains empty until a construction unit has qualifying first-party
operational provenance.

#### 15.12.5 SRC2 detail table — `ext-contract`

No `ext-contract` record has been constructed. This governed location
remains empty until a construction unit records an external-determination
input contract.

#### 15.12.6 EV2 authority-component evidence

| Evidence component ID | Active v2 LEAF | Authority class | Source/provenance record IDs or — | Dependency evidence component IDs or — | Exact locator(s) | Controlling passage or tight paraphrase | Passage-to-obligation mapping | Formula/inference/provenance details | Limitations/uncertainty |
|---|---|---|---|---|---|---|---|---|---|
| EV2-0001 | CBA2-A01.1 | INFERRED | SRC2-001 | — | CBA I §1(kkk)-(lll) p. 9; VII §4(a) p. 211; VII §2(e)(1) pp. 186-87; VII §2(d)(1)(i) pp. 179-80; VII §6(j)(1) pp. 240-41; VII §6(j)(6) pp. 243-44 | 'Salary' (I §1(lll)) excludes Unlikely Bonuses and amounts attributed to other Salary Cap Years; Team Salary is a defined computation (§4(a)); 'Apron Team Salary' applies ten adjustments to Team Salary (§2(e)(1)); 'Tax Team Salary' applies its own six adjustments as of the last Regular Season game (§2(d)(1)(i)); §6(j) uses pre-trade and post-assignment Salaries with their own deemed reductions (§6(j)(6)) | Each quantity is defined by its own rule and provably diverges for the same player/team/date; a single reusable salary figure therefore cannot implement the signed text | Inference: because the defined quantities apply different adjustments to the same underlying data, correctness requires independent derivation per quantity; the text nowhere authorizes substituting one quantity for another | The individual calculation rules are owned by their own LEAFs/families; this component grounds only the non-substitution requirement |
| EV2-0002 | CBA2-A02.1 | CBA | SRC2-001 | — | CBA VII §6(j)(1)(i), p. 240 | A Team may use the 'Standard Traded Player Exception' to replace one (1) Traded Player with one (1) or more Replacement Players whose Player Contracts are acquired simultaneously or non-simultaneously | Fixes the Standard path's structure: exactly one Traded Player; one or more Replacement Players; simultaneous or non-simultaneous acquisition | — | — |
| EV2-0003 | CBA2-A02.2 | CBA | SRC2-001 | — | CBA VII §6(j)(1)(i), p. 240 | …whose post-assignment Salaries for the Salary Cap Year in which the Replacement Player(s) are acquired, in the aggregate, are no more than an amount equal to one hundred percent (100%) of the pre-trade Salary of the Traded Player, plus $250,000 | States the Standard path's money limit (100% of pre-trade Salary + $250,000 allowance) | — | — |
| EV2-0004 | CBA2-A02.3 | CBA | SRC2-001 | — | CBA VII §6(j)(1)(i) proviso, p. 240 | …provided that any Player Contract acquired non-simultaneously pursuant to this Exception must be acquired within one (1) year following the date on which the Traded Player was traded | Creates the one-year non-simultaneous acquisition window | — | — |
| EV2-0005 | CBA2-A02.4 | CBA | SRC2-001 | — | CBA VII §6(j)(1)(ii), p. 240 | A Team may use the 'Aggregated Standard Traded Player Exception' to replace two (2) or more Traded Players with one (1) or more Replacement Players whose Player Contracts are acquired simultaneously | Fixes the Aggregated path's structure: two or more Traded Players; simultaneous acquisition only | — | — |
| EV2-0006 | CBA2-A02.5 | CBA | SRC2-001 | — | CBA VII §6(j)(1)(ii), p. 240 | …whose post-trade Salaries for the then-current Salary Cap Year, in the aggregate, are no more than an amount equal to one hundred percent (100%) of the aggregated pre-trade Salaries of the Traded Players, plus $250,000 | States the Aggregated path's money limit | — | — |
| EV2-0007 | CBA2-A02.6 | CBA | SRC2-001 | — | CBA VII §6(j)(1)(iii), p. 241 | During the 2023-24 Salary Cap Year only… a Team may use the 'Transition Traded Player Exception'… no more than an amount equal to one hundred ten percent (110%) of the pre-trade Salaries of the Traded Player(s), plus $250,000 | The express '2023-24 Salary Cap Year only' scope makes the 110% path unavailable in any later Salary Cap Year | — | — |
| EV2-0008 | CBA2-A02.7 | CBA | SRC2-001 | — | CBA VII §6(j)(1)(iv), p. 241 | A Team may use the 'Expanded Traded Player Exception' to replace one (1) or more Traded Players with one (1) or more Replacement Players whose Player Contracts are acquired simultaneously | Fixes the Expanded path's structure | — | — |
| EV2-0009 | CBA2-A02.8 | CBA | SRC2-001 | — | CBA VII §6(j)(1)(iv), p. 241 | …no more than an amount equal to the greater of: (y) the lesser of: (A) two hundred percent (200%)… plus $250,000; or (B) one hundred percent (100%)… plus an amount equal to $7.5 million multiplied by a fraction, the numerator of which is the Salary Cap for the then-current Salary Cap Year and the denominator of which is the Salary Cap for the 2023-24 Salary Cap Year; or (z) one hundred twenty-five percent (125%)… plus $250,000 | States the Expanded limit formula max(min(2O+K, O+A), 1.25O+K) with A defined by the cap ratio — a formula, never fixed boundaries | — | — |
| EV2-0010 | CBA2-A02.8 | NBA | SRC2-003 | — | NBA Communications official release, 2023-06-30 (season 2023-24) | NBA Salary Cap for 2023-24 season set at $136.021 million | Supplies the formula's fixed denominator: the 2023-24 Salary Cap of $136.021 million | Exact value relied upon: $136.021 million | — |
| EV2-0011 | CBA2-A02.8 | NBA | SRC2-004 | — | NBA Communications official release, 2026-06-30 (season 2026-27) | NBA sets Salary Cap for 2026-27 season at $164.961 million | Supplies the current-season numerator: the 2026-27 Salary Cap of $164.961 million | Exact value relied upon: $164.961 million | — |
| EV2-0012 | CBA2-A02.8 | DERIVED | SRC2-001, SRC2-003, SRC2-004 | EV2-0009, EV2-0010, EV2-0011 | CBA VII §6(j)(1)(iv), pp. 240-41; official Salary Cap releases dated 2023-06-30 and 2026-06-30 | Substitute the official Salary Cap values into A = $7,500,000 × (current Salary Cap ÷ 2023-24 Salary Cap) | Produces the current-season A input without changing the signed formula | For 2026-27, A = $7.5M × ($164.961M ÷ $136.021M) = $9.0957095…M | No controlling source requires a particular display rounding convention |
| EV2-0013 | CBA2-A02.9 | CBA | SRC2-001 | — | CBA VII §6(j)(1)(v), p. 241 | …a Team with a Team Salary below the Salary Cap may acquire one (1) or more players by assignment whose post-assignment Salaries, in the aggregate, are no more than an amount equal to the Team's room under the Salary Cap plus $250,000 | States the room path and its limit | — | — |
| EV2-0014 | CBA2-A02.10 | CBA | SRC2-001 | — | CBA VII §6(j)(1)(v), p. 241 | For clarity, a Team that acquires one (1) or more players in accordance with this Section 6(j)(1)(v) (or with room under the Salary Cap…) may not simultaneously acquire any players in accordance with Sections 6(j)(1)(i)-(iv) above | States the room-path/TPE-path mutual exclusivity | — | — |
| EV2-0015 | CBA2-A02.11 | CBA | SRC2-001 | — | CBA VII §6(j)(2), p. 242 | In lieu of conducting a trade in accordance with Section 6(j)(1)(v) above, and notwithstanding Section 6(n) below…, a Team with a Team Salary below the Salary Cap may conduct a trade in accordance with Sections 6(j)(1)(iii)-(iv) above | Grants below-cap teams the election of the (iii)/(iv) paths in lieu of the room path | — | — |
| EV2-0016 | CBA2-A02.12 | CBA | SRC2-001 | — | CBA VII §6(j)(3), p. 242 | …if a Team's post-assignment Apron Team Salary would exceed the First Apron Level, then the $250,000 allowance referenced in each of Sections 6(j)(1)(i)-(v) above shall be reduced to $0 | Zeroes the allowance on the post-assignment Apron Team Salary test — not post-trade Team Salary | — | — |
| EV2-0017 | CBA2-A02.13 | CBA | SRC2-001 | — | CBA VII §6(j)(7), p. 245 | …no Traded Player Exception shall arise from trading a player during a Salary Cap Year if the Team has previously used (or simultaneously uses) a Disabled Player Exception in respect of such player during such Salary Cap Year | Bars TPE creation from trading the disabled player in the same Salary Cap Year as DPE use for that player | — | — |
| EV2-0018 | CBA2-A02.14 | CBA | SRC2-001 | — | CBA VII §6(j)(8), p. 246 | The foregoing rules in this Section 6(j) shall not apply to Two-Way Players. Accordingly, for example, a Traded Player Exception will not arise from trading a Two-Way Player | Excludes Two-Way Players from every §6(j) calculation and from TPE creation | — | — |
| EV2-0019 | CBA2-A03.1 | CBA | SRC2-001 | — | CBA VII §6(j)(6) and worked example, pp. 243-45 | …a Traded Player's Salary shall be deemed reduced by the amount of the player's unearned Base Compensation that, at the time of the trade, is not fully protected for lack of skill and injury or illness (or may become not fully protected… due to additional conditions or limitations set forth in the Exhibit 2…) | States the general deemed-reduction rule; the (W)/(X) example cases confirm the pre-season and mid-season arithmetic (protected remainder; unearned unprotected reduction) | — | — |
| EV2-0020 | CBA2-A03.2 | CBA | SRC2-001 | — | CBA VII §6(j)(6)(i) and example case (Y), pp. 244-45 | With respect to the assignment of Player Contracts occurring during the period from January 8 through the last day of the Regular Season, a Traded Player's Base Compensation for such Season shall be deemed fully protected for lack of skill and injury or illness | Creates the January 8 deeming window | — | — |
| EV2-0021 | CBA2-A03.3 | CBA | SRC2-001 | — | CBA VII §6(j)(6)(iii) and example case (Z), pp. 244-45 | With respect to the assignment of Player Contracts occurring during the period from the day following the last day of a Regular Season through June 30…, a Traded Player's Salary will equal the lesser of: (x) the player's Salary for the current Salary Cap Year; and (y) the player's Salary for the subsequent Salary Cap Year reduced by… | Creates the post-season lesser-of window | — | — |
| EV2-0022 | CBA2-A03.4 | CBA | SRC2-001 | — | CBA VII §6(j)(5), p. 243 | If the base-year trigger is satisfied, the assignor's deemed Salary is the greater of the preceding Contract's final-Season Salary and 50% of first-season Salary under the new Contract | Supports only the base-year trigger and greater-of result | — | — |
| EV2-0023 | CBA2-A03.5 | CBA | SRC2-001 | — | CBA VII §8(g), pp. 264-65; Room defined at I §1(kkk), p. 9; VII §9(a)(2), p. 266 | …only for purposes of determining whether the acquiring Team has Room for the Contract, the Salary for the last Salary Cap Year of the original term of the Contract shall be deemed to equal the average of the aggregate Salaries for such Salary Cap Year and each Salary Cap Year of the extended term. 'Room' means the extent to which (i) a Team's then-current Team Salary is less than the Salary Cap; or (ii) a Team is entitled to use one of the Salary Cap Exceptions… (including the) Traded Player Exception | The deemed average governs the acquiring team's ability to fit the Contract in cap room or a TPE (via the Room definition); it does not restate the assignor's outgoing value; Option Years count as Seasons (§9(a)(2)) | — | — |
| EV2-0024 | CBA2-A03.6 | CBA | SRC2-001 | — | CBA VII §8(g)(i)-(ii), p. 265 | Percentage-based extended Salary uses the stated 104.5% Salary Cap assumption and assumes no Higher Max Criteria in the fourth Season | Supplies only the poison-pill input assumptions | — | — |
| EV2-0025 | CBA2-A03.7 | CBA | SRC2-001 | — | CBA VII §3(d)(1), pp. 206-07 | …any Performance Bonus… shall be included in Salary only if such Performance Bonus would be earned if the Team's or player's performance were identical to the performance in the immediately preceding Salary Cap Year | States the preceding-season-identical-performance inclusion test for Performance Bonuses | — | — |
| EV2-0026 | CBA2-A03.7 | INFERRED | SRC2-001 | EV2-0025 | CBA VII §6(j)(1)(i)-(ii) (pre-trade and post-assignment/post-trade Salaries), p. 240; VII §6(j)(6), pp. 243-44 | §6(j) computes the outgoing side from the Traded Player's pre-trade Salary and the incoming side from the Replacement Player's post-assignment Salary | Applying the §3(d)(1) test in each team's context, a bonus keyed to Team performance is measured against the assignor's preceding performance pre-trade and the assignee's preceding performance post-assignment, so the two sides can lawfully carry different Salary values for the same player | Inference chain: §3(d)(1) inclusion test (EV2-0025) + §6(j)'s per-side Salary framing → per-team re-testing; the text does not expressly narrate the two-sided consequence | Expert-challenge overrides (VII §3(d)(2)-(5)) are external determinations owned by the L-family |
| EV2-0027 | CBA2-A03.8 | CBA | SRC2-001 | — | CBA VII §6(i), p. 240 | A Team may acquire by assignment a Contract satisfying the Minimum Player Salary Exception | Expressly supports acquisition through VII §6(i) | — | — |
| EV2-0028 | CBA2-A03.12 | CBA | SRC2-001 | — | CBA VII §6(j)(6)(ii), p. 244 | The assignment is of a one-year Contract providing the Minimum Player Salary with no bonuses of any kind | Supplies the qualifying-Contract component for the reimbursement exclusion | — | — |
| EV2-0029 | CBA2-A03.11 | INFERRED | SRC2-001 | EV2-0027, EV2-0092 | CBA VII §6(m), p. 247; I §1(kkk), p. 9 | VII §6(i) supplies a standalone acquisition Exception and §6(m) permits a Team to choose among available Exceptions | The selected Minimum Exception route does not draw on a TPE or cap-room acquisition path | Inference chain: express §6(i) route + §6(m) exception selection → no TPE/no-room capacity consumption | — |
| EV2-0030 | CBA2-A04.1 | CBA | SRC2-001 | — | CBA XXIV §2(a)(ii) and §2(a)(iii)(A), pp. 414-15 | A trade bonus may not exceed 15% of remaining Base Compensation, excluding an unexercised Option Year | Supports only the amount cap and calculation basis | — | The basis is remaining-to-be-earned Base Compensation, with no 'guaranteed' qualifier — the prior canon wording was corrected by R3 |
| EV2-0031 | CBA2-A04.2 | CBA | SRC2-001 | — | CBA XXIV §2(a)(i) p. 414 and §2(a)(vi) p. 416 | A trade bonus shall be payable only the first time that the Contract is traded; provided, however, that if a Contract is signed in connection with an agreement to trade the Contract in accordance with Article VII, Section 8(e)…, the bonus… shall instead be payable only the second time the Contract is traded… In no event shall a trade bonus in a Contract be payable more than once | Fixes single payability, the sign-and-trade second-trade rule, and the never-more-than-once ceiling | — | — |
| EV2-0032 | CBA2-A04.3 | CBA | SRC2-001 | — | CBA VII §3(b)(1)(ii), p. 200; VII §3(b)(2), pp. 200-01 | …at the time of a trade of a Player Contract, any amount that, under the terms of the Contract, is earned in the form of a bonus upon the trade of the Contract [is a signing bonus]; Any signing bonus… shall be allocated… over the then-current and any remaining Salary Cap Years in the case of a signing bonus described in Section 3(b)(1)(ii)… in proportion to the percentage of Base Compensation in each such Salary Cap Year that, at the time of allocation, is protected for lack of skill… [zero protection →] the Salary Cap Year during which the player's Contract is traded | Classifies the trade bonus as a §3(b)(1)(ii) signing bonus and fixes its allocation span, basis, ETO limitation, and zero-protection fallback | — | — |
| EV2-0033 | CBA2-A04.4 | CBA | SRC2-001 | — | CBA VIII §1(d), p. 293 | …if a trade of a Rookie Scale Contract would, by reason of a trade bonus contained in such Contract, cause the player's Salary plus Unlikely Bonuses for the Salary Cap Year in which such trade occurs to exceed one hundred twenty percent (120%) of the player's applicable Rookie Scale Amount…, such player's trade bonus shall be deemed amended to the extent necessary to reduce the player's Salary plus Unlikely Bonuses… to one hundred twenty percent (120%)… | States the Rookie Scale deemed amendment exactly | — | Rookie Scale Contracts only; Article II §7 (read this session, pp. 36-40) caps amounts at signing/renegotiation/extension and provides no general veteran trade-bonus reduction |
| EV2-0034 | CBA2-A04.5 | CBA | SRC2-001 | — | CBA XXIV §2(a)(iii)(B)(3), p. 415; §2(a)(iv), pp. 415-16 | In connection with a trade, a Contract may be amended to reduce, including to zero, an unearned trade bonus | Supports reduction of an existing bonus only | — | — |
| EV2-0035 | CBA2-A04.6 | CBA | SRC2-001 | — | CBA VII §7(c)(3), p. 257 | A Contract that is amended pursuant to Article XXIV, Section 2(a)(iii)(B)(3) to waive all or any portion of a trade bonus in connection with the trade of a Player Contract may not be subsequently renegotiated until the later of (i) six (6) months from the date of the trade, or (ii) the first date on which the Contract could otherwise be renegotiated pursuant to this Section 7 | States the post-waiver renegotiation bar and its later-of boundary | — | — |
| EV2-0036 | CBA2-A04.7 | CBA | SRC2-001 | — | CBA Exhibit A (Uniform Player Contract), Exhibit 4 — Trade Payments, printed p. A-37 (PDF p. 621) | In the event this Contract is traded by the Team executing the Contract to another NBA Team, the Player shall be entitled to receive from the assignor Team, within thirty (30) days of the date of such trade, the following payment… | Places the payment obligation on the assignor Team with a 30-day deadline | — | BYL 4.04(c) (p. 65) permits the parties to reallocate contract obligations by agreement |
| EV2-0037 | CBA2-A04.8 | CBA | SRC2-001 | — | CBA VII §3(b)(1)(ii)-(b)(2), pp. 200-01; VII §6(j)(1), p. 240; VII §4(a)(1), p. 211 | The trade-year allocated amount is included in Salary for the assignee's post-assignment Salary calculation | Supports only the individual incoming-trade Salary effect | — | — |
| EV2-0038 | CBA2-A05.1 | CBA | SRC2-001 | — | CBA VII §2(e)(2)(i)(A), p. 187 | A Team may not engage in a transaction set forth in the Transaction Restrictions Table if, immediately following such transaction, the Team's Apron Team Salary for such Salary Cap Year would exceed the 'Applicable Apron Level' that corresponds with such transaction in the table | States the single post-transaction test applied to every table row | — | — |
| EV2-0039 | CBA2-A05.2 | CBA | SRC2-001 | — | CBA VII §2(e)(2)(i)(B), p. 187 | A Team that engages in a transaction set forth in the Transaction Restrictions Table may not, for the remainder of such Salary Cap Year, have an Apron Team Salary that exceeds the Applicable Apron Level that corresponds with such transaction in the table | Creates the remainder-of-year hard cap at the row's level | — | — |
| EV2-0040 | CBA2-A05.3 | CBA | SRC2-001 | — | CBA VII §2(e)(4), Transaction Restrictions Table row A, p. 190 | Team signs or acquires a player using the Bi-annual Exception (as described in Section 6(d)) → Applicable Apron Level: First Apron Level | Enumerates row A's transaction and assigns its Applicable Apron Level (First Apron Level) | — | — |
| EV2-0041 | CBA2-A05.4 | CBA | SRC2-001 | — | CBA VII §2(e)(4), Transaction Restrictions Table row B, p. 190 | Team signs or acquires a player using the Non-Taxpayer Mid-Level Salary Exception (as described in Section 6(e)) → Applicable Apron Level: First Apron Level | Enumerates row B's transaction and assigns its Applicable Apron Level (First Apron Level) | — | — |
| EV2-0042 | CBA2-A05.5 | CBA | SRC2-001 | — | CBA VII §2(e)(4), Transaction Restrictions Table row C, p. 190 | Team acquires a player pursuant to a Contract entered into in accordance with Section 8(e)(1) → Applicable Apron Level: First Apron Level | Enumerates row C's transaction and assigns its Applicable Apron Level (First Apron Level) | — | — |
| EV2-0043 | CBA2-A05.6 | CBA | SRC2-001 | — | CBA VII §2(e)(4), Transaction Restrictions Table row D, p. 190 | Team signs a Contract during the Regular Season with a player who was previously under a Contract that: (i) was terminated during such Regular Season; and (ii) prior to such termination, provided for a Salary… greater than the amount of the Non-Taxpayer Mid-Level Salary Exception… → Applicable Apron Level: First Apron Level | Enumerates row D's transaction and assigns its Applicable Apron Level (First Apron Level) | — | — |
| EV2-0044 | CBA2-A05.7 | CBA | SRC2-001 | — | CBA VII §2(e)(4), Transaction Restrictions Table row E, p. 190 | Team acquires a player using an Expanded Traded Player Exception (as described in Section 6(j)(1)(iv)) → Applicable Apron Level: First Apron Level | Enumerates row E's transaction and assigns its Applicable Apron Level (First Apron Level) | — | — |
| EV2-0045 | CBA2-A05.8 | CBA | SRC2-001 | — | CBA VII §2(e)(4), Transaction Restrictions Table row F, p. 190 | Team acquires a player using a Standard Traded Player Exception… (i) after the end of the Regular Season in which such Traded Player Exception arose, or (ii) if such Traded Player Exception arose during the period from the day following the last day of a Regular Season through the day before the first day of the immediately following Regular Season, after the last day of such following Regular Season → Applicable Apron Level: First Apron Level | Enumerates row F's transaction and assigns its Applicable Apron Level (First Apron Level) | — | — |
| EV2-0046 | CBA2-A05.9 | CBA | SRC2-001 | — | CBA VII §2(e)(4), Transaction Restrictions Table row G, p. 191 | Team acquires a player using a Transition Traded Player Exception (as described in Section 6(j)(1)(iii)) → Applicable Apron Level: First Apron Level | Enumerates row G's transaction and assigns its Applicable Apron Level (First Apron Level) | — | — |
| EV2-0047 | CBA2-A05.10 | CBA | SRC2-001 | — | CBA VII §2(e)(4), Transaction Restrictions Table row H, p. 191 | Team acquires a player using an Aggregated Standard Traded Player Exception (as described in Section 6(j)(1)(ii)) → Applicable Apron Level: Second Apron Level | Enumerates row H's transaction and assigns its Applicable Apron Level (Second Apron Level) | — | — |
| EV2-0048 | CBA2-A05.11 | CBA | SRC2-001 | — | CBA VII §2(e)(4), Transaction Restrictions Table row I, p. 191 | Team pays cash to another Team in connection with a trade in accordance with Section 8(a) → Applicable Apron Level: Second Apron Level | Enumerates row I's transaction and assigns its Applicable Apron Level (Second Apron Level) | — | — |
| EV2-0049 | CBA2-A05.12 | CBA | SRC2-001 | — | CBA VII §2(e)(4), Transaction Restrictions Table row J, p. 191 | Team acquires a player using a Traded Player Exception…, which Traded Player Exception is in respect of a Player Contract signed and traded pursuant to Section 8(e)(1) → Applicable Apron Level: Second Apron Level | Enumerates row J's transaction and assigns its Applicable Apron Level (Second Apron Level) | — | — |
| EV2-0050 | CBA2-A05.13 | CBA | SRC2-001 | — | CBA VII §2(e)(4), Transaction Restrictions Table row K, p. 191 | Team signs a player using the Taxpayer Mid-Level Salary Exception (as described in Section 6(f)) → Applicable Apron Level: Second Apron Level | Enumerates row K's transaction and assigns its Applicable Apron Level (Second Apron Level) | — | — |
| EV2-0051 | CBA2-A05.14 | CBA | SRC2-001 | — | CBA VII §2(e)(2)(iii)(A)-(B), pp. 188-89 | During the 2023-24 Salary Cap Year, a Team may not engage in any transaction set forth in rows A through E… if it has previously signed a Player Contract pursuant to the Taxpayer Mid-Level Salary Exception during such Salary Cap Year. For each Salary Cap Year beginning with the 2024-25 Salary Cap Year, [the same bar covers] rows A through F… | States the TMLE-usage bar and its 2023-24/2024-25 row scopes | — | — |
| EV2-0052 | CBA2-A05.15 | CBA | SRC2-001 | — | CBA VII §2(e)(2)(ii)(A), p. 188 | During the period beginning on the day after the last day of a Regular Season through the last day of the Salary Cap Year…: A Team may not engage in any transaction set forth in rows E through J… if, immediately following such transaction, the Team's Apron Team Salary for the immediately following Salary Cap Year… would exceed the Applicable Apron Level (for such Subsequent Salary Cap Year)… | Adds the Subsequent-year test, expressly limited to rows E-J and to the post-regular-season window | — | — |
| EV2-0053 | CBA2-A05.16 | CBA | SRC2-001 | — | CBA VII §2(e)(2)(ii)(B), p. 188 | A Team that engages in any transaction set forth in rows E through J… may not, at any time from immediately following such transaction through the end of the Subsequent Salary Cap Year, have an Apron Team Salary for such Subsequent Salary Cap Year that exceeds the Applicable Apron Level (for such Subsequent Salary Cap Year)… | Creates the Subsequent-year hard cap | — | — |
| EV2-0054 | CBA2-A05.17 | CBA | SRC2-001 | — | CBA VII §2(e)(3)(i)-(ii), p. 189 | …assuming that: (A) all Team or Player Options… are exercised; (B) no outstanding ETOs… are exercised; (C) the Team engages in no additional transactions…; (D) any player… whose Salary… may increase by virtue of meeting the Higher Max Criteria… achieves the highest Salary that he is eligible to earn…; and (ii) the amount of the Salary Cap, First Apron Level, and Second Apron Level for the Subsequent Salary Cap Year is equal to [the current year's] | Enumerates the complete assumption set for computing the Subsequent-year Apron Team Salary | — | — |
| EV2-0055 | CBA2-A05.18 | CBA | SRC2-001 | — | CBA VII §2(e)(5), p. 191 | …a Team that engages in one or more of the transactions set forth in rows F through J… during the 2023-24 Salary Cap Year will not by virtue of engaging in any such transaction(s) be prohibited from having an Apron Team Salary in the 2023-24 Salary Cap Year that exceeds the Applicable Apron Level for such Salary Cap Year | Suspends the current-year hard cap for rows F-J during 2023-24 only | — | — |
| EV2-0056 | CBA2-A06.1 | CBA | SRC2-001 | — | CBA VII §6(j)(4)(i), p. 242 | No player whose Player Contract was acquired pursuant to an Exception in the two (2) month period preceding the trade may be among the Traded Players whose Contracts are being aggregated pursuant to Sections 6(j)(ii), 6(j)(iii), or 6(j)(iv) above (for example, if a player were traded to a Team pursuant to an Exception on November 20, 2023, then the player's Contract could not be aggregated… until January 20, 2024) | States the two-month aggregation bar; the example fixes the window arithmetic | — | — |
| EV2-0057 | CBA2-A06.2 | CBA | SRC2-001 | — | CBA VII §6(j)(4)(i) proviso, p. 242 | provided, however, that if a Team acquires a Player Contract pursuant to an Exception on or before December 16 of a Salary Cap Year, then the foregoing restriction shall not apply in the event the player is subsequently traded on or after the day prior to the NBA trade deadline of such Salary Cap Year | States the carve-out's acquisition condition (on or before December 16) and its trade window (day before the deadline onward) | — | — |
| EV2-0058 | CBA2-A06.3 | CBA | SRC2-001 | — | CBA VII §6(j)(4)(ii), pp. 242-43 | Other than during the period beginning on December 15… through the NBA trade deadline…, if a Team is aggregating the Contracts of three (3) or more Traded Players in a trade and the number of Replacement Players… is less than the number of such Traded Players, then no more than one (1) of such Traded Players may be a Minimum Traded Player…: a player whose Contract provides for his applicable Minimum Player Salary for the Salary Cap Year in which the trade… occurs or, if the trade occurs [post-Regular-Season], …in the immediately following Salary Cap Year | States the conjunctive trigger, the one-Minimum-Traded-Player limit, and the season-dependent classification | — | — |
| EV2-0059 | CBA2-A07.1 | CBA | SRC2-001 | — | CBA VII §8(e)(1)(i), p. 262 | the Veteran Free Agent finished the prior Season on his Prior Team's roster | Condition (i) is an independently enforceable validity requirement for a sign-and-trade | — | — |
| EV2-0060 | CBA2-A07.2 | CBA | SRC2-001 | — | CBA VII §8(e)(1)(ii), p. 262 | the Contract is for at least three (3) Seasons (excluding any Option Year) | Condition (ii) is an independently enforceable validity requirement for a sign-and-trade | — | — |
| EV2-0061 | CBA2-A07.3 | CBA | SRC2-001 | — | CBA VII §8(e)(1)(ii), p. 262 | …but no more than four (4) Seasons in length | Condition (ii) is an independently enforceable validity requirement for a sign-and-trade | — | — |
| EV2-0062 | CBA2-A07.4 | CBA | SRC2-001 | — | CBA VII §8(e)(1)(iv), p. 262 | the first Season of the Contract is fully protected for lack of skill | Condition (iv) is an independently enforceable validity requirement for a sign-and-trade | — | — |
| EV2-0063 | CBA2-A07.5 | CBA | SRC2-001 | — | CBA VII §8(e)(1)(iii), p. 262 | the Contract is not signed pursuant to the Non-Taxpayer Mid-Level Salary Exception or the Mid-Level Salary Exception for Room Teams | Condition (iii) is an independently enforceable validity requirement for a sign-and-trade | — | — |
| EV2-0064 | CBA2-A07.6 | CBA | SRC2-001 | — | CBA VII §8(e)(1)(v), p. 262 | the Contract is entered into prior to the first day of the Regular Season | Condition (v) is an independently enforceable validity requirement for a sign-and-trade | — | — |
| EV2-0065 | CBA2-A07.7 | CBA | SRC2-001 | — | CBA VII §8(e)(1)(vi), p. 262 | with respect to any 5th Year Eligible Player… who met one of the Higher Max Criteria…, the Contract may not provide the player with Salary (plus Unlikely Bonuses) in excess of twenty-five percent (25%) of the Salary Cap (as calculated pursuant to Article II, Section 7) in effect at the time the Contract is signed | Condition (vi) is an independently enforceable validity requirement for a sign-and-trade | — | — |
| EV2-0066 | CBA2-A07.8 | CBA | SRC2-001 | — | CBA VII §8(e)(1)(vii), p. 262; Room defined at I §1(kkk), p. 9 | the acquiring Team has Room for the player's Salary plus any Unlikely Bonuses provided for in the first Season of the Contract | Condition (vii) is an independently enforceable validity requirement for a sign-and-trade | — | — |
| EV2-0067 | CBA2-A07.9 | CBA | SRC2-001 | — | CBA VII §8(e)(3), p. 263 | A §8(e)(1) or (2) Contract or Extension may not contain an Exhibit 6 | Supports only the Exhibit 6 prohibition | — | — |
| EV2-0068 | CBA2-A08.1 | CBA | SRC2-001 | — | CBA VII §8(a), p. 260 | …a Team shall be permitted to pay or receive in connection with one (1) or more trades occurring during a Salary Cap Year, directly or indirectly, up to an aggregate amount equal to 5.15% of the Salary Cap for such Salary Cap Year in cash across all such trades… | Supports only the annual paid-cash limit | — | — |
| EV2-0069 | CBA2-A08.2 | CBA | SRC2-001 | — | CBA VII §8(a), p. 260 | …pay or receive… up to an aggregate amount equal to 5.15% of the Salary Cap… including cash received as reimbursement for Compensation obligations to players whom the Team is acquiring… | Supports only the annual received-cash limit, including reimbursements | — | — |
| EV2-0070 | CBA2-A08.3 | CBA | SRC2-001 | — | CBA VII §8(a)(i), p. 260 | …if a Contract is signed and then traded pursuant to Section 8(e)(1) below, and the Contract contains a signing bonus, the payment of all or any portion of such bonus by the Team that signed the Contract shall be treated as a reimbursement of a Compensation obligation of the assignee Team and shall be subject to this Section 8(a) | Charges the signing team's bonus payment against the §8(a) cash limits | — | — |
| EV2-0071 | CBA2-A08.4 | CBA | SRC2-001 | — | CBA VII §8(a), p. 260 | Cash paid or received in connection with trades occurring during a Salary Cap Year is measured against that Salary Cap Year's limit | Supports the express general trade-year charging rule only | — | The re-trade attribution/accounting mechanics for a later re-trade of a conditional asset are not expressed in the signed text and remain an unsupported operational candidate (§15.9.6) |
| EV2-0072 | CBA2-A08.5 | INFERRED | SRC2-001 | — | CBA VII §4(a), p. 211; VII §8(a), p. 260 | For purposes of computing Team Salary under this Agreement, all of the following amounts shall be included: […an enumeration of player-salary-derived amounts…] | §4(a)'s inclusion enumeration is the complete Team Salary computation and contains no inter-team cash item; §8(a) regulates trade cash as its own capped consideration channel — cash in trades therefore never enters Team Salary | Inference chain: closed §4(a) enumeration + §8(a)'s separate cash regime → no Team Salary effect; the text does not state the exclusion expressly | — |
| EV2-0073 | CBA2-A09.1 | BYL | SRC2-002 | — | BYL 4.05(e), p. 66 | The Association Office will not conduct a Trade Call unless and until each party thereto has room on its Active List, Inactive List, or Two-Way List (or will have room after the Trade Call is completed) for the Player(s) whose contract(s) it is receiving in the transaction | Makes list room at the Trade Call a validity precondition; 'will have room after the Trade Call is completed' reaches only the transaction's own player movement, not a planned later waiver | — | — |
| EV2-0074 | CBA2-A10.1 | CBA | SRC2-001 | — | CBA VII §8(e)(2), p. 263 | A player and his Team may amend a Player Contract (including by entering into an Extension but not by entering into a Renegotiation) pursuant to an agreement between such Team and another Team concerning the signing of the amendment and subsequent trade of the amended Contract… | Defines the extension-and-trade mechanism and excludes Renegotiations from it | — | — |
| EV2-0075 | CBA2-A10.2 | CBA | SRC2-001 | — | CBA VII §8(e)(2)(i), p. 263 | no such agreement may be made during the period from the last day of the last Regular Season covered by the Contract (or the last day of any Regular Season that could be the last Regular Season covered by the Contract based upon the exercise or non-exercise of an Option or ETO) through the following June 30 | States the end-of-contract window bar including the Option/ETO contingency | — | — |
| EV2-0076 | CBA2-A10.3 | CBA | SRC2-001 | — | CBA VII §8(e)(2)(ii)-(iii), p. 263; VII §9(a), p. 266 | no such Extension entered into… prior to the first day of the 2024-25 Salary Cap Year may cover more than three (3) Seasons from the date the Extension is signed; and… on or after the first day of the 2024-25 Salary Cap Year may cover more than four (4) Seasons from the date the Extension is signed | Fixes the from-signing term limits; §9(a) supplies the Season-counting rules | — | — |
| EV2-0077 | CBA2-A10.4 | CBA | SRC2-001 | — | CBA VII §7(a)(3)(iii)(B), pp. 252-53 | First extended-term Salary excluding Incentive Compensation may be up to the greater of 120% of last-original-term Regular Salary and the stated 120%-of-EAPS measure | Supports only the first-year Salary ceiling | — | Pre-2024-25 signings used the 105% rule of §7(a)(3)(iii)(A) (read this session) |
| EV2-0078 | CBA2-A10.5 | CBA | SRC2-001 | — | CBA VII §5(a)(4)(i)(A), pp. 228-29 | Salary excluding Incentive Compensation after the first extended-term year may change relative to the prior year by no more than 5% of first extended-term Salary excluding Incentive Compensation | Supports only the Salary-excluding-incentives annual-change rule | — | — |
| EV2-0079 | CBA2-A10.6 | CBA | SRC2-001 | — | CBA VII §7(a) opening and §7(a)(1), pp. 249-50; §7(a)(2)(i)-(iii), pp. 250-51; §7(a)(3)(v), p. 253 | A non-Rookie Scale Contract may be extended only on or after the anniversary prescribed in §7(a) | Supports only the ordinary anniversary-eligibility branch | — | — |
| EV2-0080 | CBA2-A10.7 | CBA | SRC2-001 | — | CBA VII §8(f)(i), pp. 263-64 (first sentence) | In the event a player enters into (A) an Extension pursuant to Section 7(a)… that covers five (5) Seasons (or, for Extensions entered into prior to… 2024-25, four (4) or more Seasons) and/or provides for Salary and Unlikely Bonuses or annual increases or decreases… in excess of the amounts that… were permissible in Extensions entered into in connection with an agreement to trade… or (B) a Renegotiation pursuant to Section 7(c)…, then the player may not be traded before six (6) months following the date on which such Extension or Renegotiation was signed | States the outbound six-month trade bar after a rich extension or any renegotiation | — | — |
| EV2-0081 | CBA2-A10.8 | CBA | SRC2-001 | — | CBA VII §8(f)(i), p. 264 (second sentence) | If a team acquires a player in a trade, then, for a period of six (6) months following the date of the trade, the team may not enter into (X) an Extension… that covers five (5) Seasons… and/or provides for [amounts] in excess of the amounts that, at the time such trade occurred, were permissible in Extensions entered into in connection with an agreement to trade…, or (Y) a Renegotiation pursuant to Section 7(c) | States the inbound six-month rich-extension/renegotiation bar after a trade | — | — |
| EV2-0082 | CBA2-A11.1 | CBA | SRC2-001 | — | CBA VII §6(j)(1)(i)-(v), pp. 240-41 | Each Traded Player Exception path replaces its own defined Traded Player(s) with its own defined Replacement Player(s) ('to replace one (1) Traded Player with one (1) or more Replacement Players…', etc.), path by path and team by team | The express per-player/per-exception structure is the structural basis for evaluating each team separately and pairing players to exceptions | — | — |
| EV2-0083 | CBA2-A11.1 | INFERRED | SRC2-001 | EV2-0082 | CBA VII §6(j)(1)-(2), pp. 240-42; VII §6(m), p. 247 | The paths are defined per exception and per team, and §6(m) lets a team choose among its available Exceptions | It follows that a multi-player transaction is legal if its players can be partitioned into per-team component trades each satisfying one chosen exception path — the decomposition procedure itself is structural inference, not express text | Inference chain: per-exception structure (EV2-0082) + §6(m) exception choice → partition/decomposition validation; the validator must exhibit a legal decomposition or report none exists | Never presented as express source language; never DERIVED arithmetic |
| EV2-0084 | CBA2-A12.1 | INFERRED | SRC2-002 | — | BYL 4.01(a), pp. 62-63; BYL 4.02(a)-(b), pp. 63-64 | Members may assign draft choices in accordance with the By-Laws, and the parties must identify all draft-choice terms and details in the Trade Call and Trade Memorandum | Supports the ownership inference without treating disclosure/enforceability as part of this LEAF's result | Inference chain: assignment of an identified draft choice under 4.01(a) + complete identification under 4.02(a)-(b) → the conveying Member must hold the identified choice it assigns | The ownership condition is inferred; disclosure/enforceability is separately owned by CBA2-A12.6 |
| EV2-0085 | CBA2-A12.2 | BYL | SRC2-002 | — | BYL 7.03, p. 78 | No Member may sell its rights to select a player in the first round of any NBA Draft for cash or its equivalent… | States the cash-sale prohibition for first-round selection rights | — | — |
| EV2-0086 | CBA2-A12.3 | BYL | SRC2-002 | — | BYL 7.03, p. 78 | …or trade or exchange its right to select a player in the first round of any NBA Draft if the result of such trade or exchange may be to leave the Member without first-round picks in any two (2) consecutive future NBA Drafts | States the Stepien prohibition keyed to the word 'may' | — | — |
| EV2-0087 | CBA2-A12.3 | INFERRED | SRC2-002 | EV2-0086 | BYL 7.03, p. 78 | the result of such trade or exchange MAY be to leave the Member without first-round picks… | 'May' is a possibility test: legality must hold on every possible protection/conveyance branch, and a first-round pick owned from another team satisfies possession for a covered draft (the rule tests being 'without first-round picks', not 'without its own pick') | Inference chain: the modal 'may' (EV2-0086) → all-branch evaluation; 'first-round picks' unqualified → another team's owned first counts | — |
| EV2-0088 | CBA2-A12.4 | CBA | SRC2-001 | — | CBA VII §2(f)(1)(i), p. 195; §2(f)(2)(i), p. 196 | 'Second Apron Team' means… a Team that, as of the start of the Team's last Regular Season game occurring within such Salary Cap Year, has an Apron Team Salary… that exceeds the Second Apron Level…; Beginning with the 2024-25 Salary Cap Year, if a Team is a Second Apron Team for a Salary Cap Year, then the Team shall be prohibited from trading (either conditionally or unconditionally) its first round draft pick in the first NBA Draft that occurs following the seventh Season that follows the Season occurring within such Salary Cap Year | Defines the measurement event and states the frozen-pick trading prohibition | — | — |
| EV2-0089 | CBA2-A12.5 | CBA | SRC2-001 | — | CBA VII §2(f)(2)(ii)(B), pp. 196-97 | After the specified third non-Second-Apron Regular Season in the four-year window, the Team is permitted to trade the frozen pick | Supports unfreeze timing only | — | — |
| EV2-0090 | CBA2-A03.9 | CBA | SRC2-001 | — | CBA VII §6(j)(5), p. 243 | For a one-year Contract at the Minimum Player Salary with no bonuses, preceding-Contract Salary includes the amount reimbursed by the League-wide benefits fund | Adds the reimbursed portion only to the prior-Salary branch of the base-year calculation | — | — |
| EV2-0091 | CBA2-A03.10 | CBA | SRC2-001 | — | CBA VII §8(g)(ii), p. 265; Article II §7(c), pp. 39-40 | Extended-term Salary plus Unlikely Bonuses above the assumed applicable Maximum Annual Salary is deemed amended under Article II §7(c) | Owns the over-maximum deemed-amendment result | — | — |
| EV2-0092 | CBA2-A03.11 | CBA | SRC2-001 | — | CBA VII §6(m), p. 247 | Where more than one Exception is available, the Team may elect the Exception under which the Contract is acquired | Supplies the express exception-selection premise for EV2-0029 | — | — |
| EV2-0093 | CBA2-A03.12 | CBA | SRC2-001 | — | CBA VII §6(j)(6)(ii), p. 244 | Unearned Base Compensation excludes the portion of Minimum Player Salary reimbursed by the League-wide benefits fund | Supplies the express reimbursement-exclusion result for the assignor calculation | — | — |
| EV2-0094 | CBA2-A04.9 | CBA | SRC2-001 | — | CBA Article II §7(f)(i)-(iii), pp. 42-43 | For the fewer-than-seven, seven-to-fewer-than-ten, and at-least-ten Years-of-Service bands, a trade bonus is deemed amended downward when Salary plus Unlikely Bonuses would exceed the applicable stated maximum | Maps the one piecewise general maximum-reduction formula independently from Rookie Scale VIII §1(d) | — | — |
| EV2-0095 | CBA2-A04.10 | CBA | SRC2-001 | — | CBA XXIV §2(a)(v), p. 416 | When an unearned bonus is amended with an Extension to be inapplicable to the extended term, the Extension must include a replacement Exhibit 4 with the original terms and the prescribed inapplicability statement | Requires the replacement exhibit in the exact §2(a)(v) branch | — | — |
| EV2-0096 | CBA2-A04.11 | CBA | SRC2-001 | — | CBA XXIV §2(a)(v)(A), p. 416 | If the first trade occurs during the original term's remainder, the bonus is calculated solely from Base Compensation remaining under the original term and excludes extended-term Base Compensation | Supports the original-term calculation branch | — | — |
| EV2-0097 | CBA2-A04.12 | CBA | SRC2-001 | — | CBA XXIV §2(a)(v)(B), p. 416 | If the first trade occurs during the extended term, the bonus does not apply to that trade or any later trade during the extended term | Supports the extended-term inapplicability branch | — | — |
| EV2-0098 | CBA2-A04.13 | CBA | SRC2-001 | — | CBA XXIV §2(a)(iii)(A), pp. 414-15; UPC Exhibit 4 | A trade bonus may be a stated percentage or a dollar amount subject to a stated percentage cap | Owns permitted form independently from the amount cap | — | — |
| EV2-0099 | CBA2-A04.14 | CBA | SRC2-001 | — | CBA XXIV §2(a)(iv), p. 415 | A Contract with no trade bonus may not be amended to add one except in connection with an Extension | States the add-only-with-Extension rule | — | — |
| EV2-0100 | CBA2-A04.15 | CBA | SRC2-001 | — | CBA VII §3(b)(1)(ii), pp. 202-03; VII §4(a), pp. 211-15 | Allocated trade-bonus amounts are included in Salary and Salary is included in Team Salary | Maps the allocation into assignee Team Salary | — | — |
| EV2-0101 | CBA2-A07.10 | CBA | SRC2-001 | — | CBA VII §8(e)(3), p. 263 | The Exhibit 6 bar does not prohibit the Teams from conditioning the trade on passage of a physical examination performed by a physician designated by the assignee Team in accordance with NBA procedures | Supports the separate prescribed physical-exam trade condition | — | — |
| EV2-0102 | CBA2-A08.6 | CBA | SRC2-001 | — | CBA VII §8(a), p. 260 | Amounts paid and received by a Team shall not be netted against each other | Creates a separate relationship rule between the paid and received ledgers | — | — |
| EV2-0103 | CBA2-A08.7 | INFERRED | SRC2-001 | EV2-0071, EV2-0102 | CBA VII §8(a), p. 260 | Cash is regulated by the Salary Cap Year of the trade, including cash whose payment depends on a condition of that trade | Supports conditional cash application to the underlying trade year | Inference chain: express trade-year charging + conditional consideration remains connected to its underlying trade → underlying trade-year attribution | Does not support attribution after a later re-trade |
| EV2-0104 | CBA2-A10.9 | CBA | SRC2-001 | — | CBA VII §7(a)(3)(iii)(B), pp. 252-53 | Likely Bonuses and Unlikely Bonuses are each subject to the stated 120% first-year extension ceilings | Owns the paired incentive ceilings separately from Regular Salary | — | — |
| EV2-0105 | CBA2-A10.10 | CBA | SRC2-001 | — | CBA VII §5(a)(4)(i)(B), pp. 228-29 | Regular Salary after the first extended-term year may change relative to the prior year's Regular Salary by no more than 5% of first extended-term Regular Salary | Supports the independent Regular Salary annual-change rule | — | — |
| EV2-0106 | CBA2-A10.11 | CBA | SRC2-001 | — | CBA VII §5(a)(4), pp. 228-29 | Each Performance Bonus may increase or decrease by up to five percent of that bonus's first extended-term amount | Applies the limit per individual bonus | — | — |
| EV2-0107 | CBA2-A10.12 | CBA | SRC2-001 | — | CBA VII §7(a)(2)(i), p. 250 | A Contract renegotiated to increase Salary in any covered Salary Cap Year by more than 10% of pre-renegotiation Salary may not be extended until the third anniversary of the Renegotiation | Owns the >10% renegotiation anniversary branch | — | — |
| EV2-0108 | CBA2-A10.13 | CBA | SRC2-001 | — | CBA VII §7(a)(2), pp. 250-51 | A Contract shortened through exercise of an ETO may not be extended | Owns the ETO bar | — | — |
| EV2-0109 | CBA2-A10.14 | CBA | SRC2-001 | — | CBA VII §7(a)(2)(iii), p. 251 | Extension may follow Option exercise; after non-exercise the extended term must cover at least two Seasons excluding a new Option Year, and the option action may be simultaneous with the Extension | Owns the option-state conditions | — | — |
| EV2-0110 | CBA2-A10.15 | CBA | SRC2-001 | — | CBA VII §7(a)(3)(v), p. 253 | A player who will not be a Qualifying Veteran Free Agent at Contract conclusion is ineligible for a §7(a) Extension | Owns the QVFA-at-conclusion condition | — | — |
| EV2-0111 | CBA2-A12.6 | BYL | SRC2-002 | — | BYL 4.02(a)-(b), pp. 63-64 | The parties state all draft-choice terms and conditions during the Trade Call and in the Trade Memorandum; an undisclosed term or condition is unenforceable | Supports disclosure and enforceability independently from ownership | — | — |
| EV2-0112 | CBA2-A12.7 | CBA | SRC2-001 | — | CBA VII §2(f)(2)(ii)(B), pp. 196-97 | For clarity, the released first-round pick shall not be subject to a Draft Pick Penalty | Supports only the no-penalty consequence | — | — |
| EV2-0113 | CBA2-A03.13 | CBA | SRC2-001 | — | CBA VII §6(j)(5), p. 243 | The base-year rule applies only when the prior-team QVFA signing, sign-and-trade connection, above-Cap post-signing Team Salary, and above-non-QVFA first-Season Salary-plus-Unlikely-Bonuses predicates all hold | Supplies the complete conjunctive trigger separately from the deemed-Salary calculation | — | — |
| EV2-0114 | CBA2-A03.14 | CBA | SRC2-001 | — | CBA VII §8(g)(i), p. 265 | The poison-pill calculation assumes that the player will not satisfy Higher Max Criteria in his fourth Season | Supplies one calculation assumption only | — | — |
| EV2-0115 | CBA2-A03.15 | INFERRED | SRC2-001 | EV2-0027 | CBA VII §6(i), p. 240; Article I §1(kkk), p. 9 | A qualifying Minimum Exception acquisition is authorized by that Exception, so it needs no separate Salary Cap room | Derives the room-capacity consequence from the express exception permission and Room definition | — | Does not characterize the player's Salary as zero |
| EV2-0116 | CBA2-A03.16 | CBA | SRC2-001 | — | CBA VII §6(i), p. 240 | A Contract signed or acquired through the Minimum Player Salary Exception may not exceed two Seasons | Supplies the term ceiling only | — | — |
| EV2-0117 | CBA2-A03.17 | CBA | SRC2-001 | — | CBA VII §6(i), p. 240 | The first Season must provide the applicable Minimum Player Salary with no bonuses of any kind | Supplies the first-Season compensation condition only | — | — |
| EV2-0118 | CBA2-A03.18 | CBA | SRC2-001 | — | CBA VII §6(i), p. 240 | A two-Season Minimum Exception Contract must provide the applicable second-Season Minimum Player Salary with no bonuses of any kind | Supplies the conditional second-Season compensation condition only | — | — |
| EV2-0119 | CBA2-A04.16 | CBA | SRC2-001 | — | CBA XXIV §2(a)(ii)–(iii)(A), pp. 414-15 | Trade-bonus percentage and dollar forms use Base Compensation remaining to be earned at trade and exclude an unexercised Option Year | Supplies the calculation basis and express exclusion | — | — |
| EV2-0120 | CBA2-A04.17 | CBA | SRC2-001 | — | CBA XXIV §2(a)(i), p. 414 | A bonus in a Contract signed in connection with a VII §8(e) trade does not apply to that initial trade and is payable only on the second trade | Supplies the sign-and-trade lifecycle branch | — | — |
| EV2-0121 | CBA2-A04.18 | CBA | SRC2-001 | — | CBA XXIV §2(a)(vi), p. 416 | In no event shall a trade bonus in a Contract be payable more than once | Supplies the universal once-only ceiling | — | — |
| EV2-0122 | CBA2-A04.19 | CBA | SRC2-001 | — | CBA XXIV §2(a)(iv)(A), pp. 415-16 | A bonus added with an ordinary Extension applies only to the first later trade and not a subsequent trade | Supplies the ordinary-Extension added-bonus lifecycle | — | — |
| EV2-0123 | CBA2-A04.20 | CBA | SRC2-001 | — | CBA XXIV §2(a)(iv)(B), pp. 415-16 | A bonus added with an extend-and-trade does not apply to the initial trade, applies only to a second trade, and not to a later trade | Supplies the extend-and-trade added-bonus lifecycle | — | — |
| EV2-0124 | CBA2-A04.21 | CBA | SRC2-001 | — | CBA VII §3(b)(2), pp. 200-01 | The allocation horizon for a Contract containing an ETO includes only Salary Cap Years preceding the ETO Effective Season | Supplies the ETO cutoff only | — | — |
| EV2-0125 | CBA2-A04.22 | CBA | SRC2-001 | — | CBA VII §3(b)(2)–(3), pp. 200-05 | An earned trade bonus is allocated across its applicable horizon in proportion to Base Compensation protected for lack of skill | Supplies the protected-percentage method | — | — |
| EV2-0126 | CBA2-A04.23 | CBA | SRC2-001 | — | CBA VII §3(b)(2)–(3), pp. 200-05 | If no Base Compensation in the applicable horizon is protected for lack of skill, the entire earned bonus is allocated to the trade Salary Cap Year | Supplies the zero-protection fallback | — | — |
| EV2-0127 | CBA2-A04.24 | CBA | SRC2-001 | — | CBA VII §3(b)(3)(iii), p. 203 | If an Extension makes the original bonus inapplicable to the extended term, allocation excludes every extended-term Salary Cap Year | Supplies the original-term-only horizon | — | — |
| EV2-0128 | CBA2-A04.25 | CBA | SRC2-001 | — | CBA VII §3(b)(3)(iv)(A), pp. 203-04 | When a bonus remains applicable to both terms and is earned before the extended term begins, calculation and allocation include the Contract's extended-term Base Compensation subject to the stated assumptions | Supplies the governing applicable-bonus branch | — | — |
| EV2-0129 | CBA2-A04.26 | CBA | SRC2-001 | — | CBA VII §3(b)(3)(iv)(A)(1), pp. 203-04 | Percentage-of-Cap extended-term Base Compensation is determined using 4.5% annual Salary Cap growth through the first extended year | Supplies one calculation assumption | — | — |
| EV2-0130 | CBA2-A04.27 | CBA | SRC2-001 | — | CBA VII §3(b)(3)(iv)(A)(2), p. 204 | Over-maximum first-extended-year amounts use the stated service-credit and 4.5% Cap-growth assumptions and the Article II §7(c) deemed amendment | Supplies the over-maximum calculation branch | — | — |
| EV2-0131 | CBA2-A04.28 | CBA | SRC2-001 | — | CBA XXIV §2(a)(iii)(B)(1)(a), p. 415 | An ordinary Extension may modify an unearned trade bonus upward or downward subject to §2(a)(ii) and (iii)(A) | Supplies the ordinary-Extension amount-amendment permission | — | — |
| EV2-0132 | CBA2-A04.29 | CBA | SRC2-001 | — | CBA XXIV §2(a)(iii)(B)(1)(b), p. 415 | An ordinary Extension may make an unearned trade bonus inapplicable to the extended term | Supplies the ordinary-Extension inapplicability permission | — | — |
| EV2-0133 | CBA2-A04.30 | CBA | SRC2-001 | — | CBA XXIV §2(a)(iii)(B)(2)(a), p. 415 | An extend-and-trade may reduce, but not increase, an unearned trade bonus subject to §2(a)(ii) and (iii)(A) | Supplies the extend-and-trade reduction branch | — | — |
| EV2-0134 | CBA2-A04.31 | CBA | SRC2-001 | — | CBA XXIV §2(a)(iii)(B)(2)(b), p. 415 | An extend-and-trade may make an unearned trade bonus inapplicable to the extended term | Supplies the extend-and-trade inapplicability permission | — | — |
| EV2-0135 | CBA2-A04.32 | CBA | SRC2-001 | — | CBA Exhibit A (Uniform Player Contract), Exhibit 4 — Trade Payments, printed p. A-37 (PDF p. 621) | Unless a governing Extension installment rule applies, the earned trade bonus is payable within thirty days after the trade | Supplies the ordinary Exhibit 4 payment deadline | — | — |
| EV2-0136 | CBA2-A04.33 | BYL | SRC2-002 | — | NBA By-Laws §4.04(c), p. 65 | The parties may agree that obligations under an assigned Contract will be allocated differently | Supplies the narrow agreed-reallocation exception to the default payer | — | — |
| EV2-0137 | CBA2-A04.34 | CBA | SRC2-001 | — | CBA VII §3(b)(3)(iv)(B)(1), p. 204 | The first applicable-bonus installment is due within thirty days of the trade | Supplies the first deadline only | — | — |
| EV2-0138 | CBA2-A04.35 | CBA | SRC2-001 | — | CBA VII §3(b)(3)(iv)(B)(1), pp. 204-05 | The first installment equals the portion allocated to Salary Cap Years in the original term | Supplies the first amount only | — | — |
| EV2-0139 | CBA2-A04.36 | CBA | SRC2-001 | — | CBA VII §3(b)(3)(iv)(B)(2), p. 205 | The second installment is due within thirty days after the first day of the first extended-term Salary Cap Year | Supplies the second deadline only | — | — |
| EV2-0140 | CBA2-A04.37 | CBA | SRC2-001 | — | CBA VII §3(b)(3)(iv)(B)(2), p. 205 | The second installment equals the portion allocated to Salary Cap Years in the extended term | Supplies the second amount only | — | — |
| EV2-0141 | CBA2-A04.38 | CBA | SRC2-001 | — | CBA VII §3(b)(3)(v), p. 205 | If Article II §7(c) deemed amendments reduce covered allocations, the required payment is reduced to the sum of the resulting amended allocations | Supplies the payment-reduction result | — | — |
| EV2-0142 | CBA2-A04.39 | CBA | SRC2-001 | — | CBA XXIV §2(a)(iii)(A)(2), pp. 414-15 | Exhibit 4 may express a trade bonus as a specified dollar amount not exceeding a specified percentage of remaining Base Compensation | Supplies the dollar form | — | — |
| EV2-0143 | CBA2-A10.16 | CBA | SRC2-001 | — | CBA VII §7(a)(3)(iii)(A), p. 252 | Before 2024-25, the first extended-year Salary excluding incentives is capped at 105% of last-original-year Regular Salary | Supplies the historical salary branch | — | Historical simulation only |
| EV2-0144 | CBA2-A10.17 | CBA | SRC2-001 | — | CBA VII §7(a)(3)(iii)(A)–(B), pp. 252-53 | First-extended-year bonuses under these branches are available when the last original-term year provides Incentive Compensation | Supplies the shared incentive predicate | — | — |
| EV2-0145 | CBA2-A10.18 | CBA | SRC2-001 | — | CBA VII §7(a)(3)(iii)(A), p. 252 | Before 2024-25, first-extended-year Likely Bonuses are capped at 105% of last-original-year Likely Bonuses | Supplies the historical Likely Bonus ceiling | — | Historical simulation only |
| EV2-0146 | CBA2-A10.19 | CBA | SRC2-001 | — | CBA VII §7(a)(3)(iii)(A), p. 252 | Before 2024-25, first-extended-year Unlikely Bonuses are capped at 105% of last-original-year Unlikely Bonuses | Supplies the historical Unlikely Bonus ceiling | — | Historical simulation only |
| EV2-0147 | CBA2-A10.20 | CBA | SRC2-001 | — | CBA VII §7(a)(3)(iii)(B), p. 253 | On or after 2024-25, first-extended-year Unlikely Bonuses are capped at 120% of last-original-year Unlikely Bonuses | Supplies the current Unlikely Bonus ceiling | — | — |
| EV2-0148 | CBA2-A10.21 | CBA | SRC2-001 | — | CBA VII §7(a)(1), p. 250 | A one- or two-Season Contract, including Option Years, may not be extended | Supplies the term-length bar | — | — |
| EV2-0149 | CBA2-A10.22 | CBA | SRC2-001 | — | CBA VII §7(a)(1), p. 250 | A five- or six-Season Contract may be extended no sooner than the third anniversary of signing or the applicable Extension | Supplies the five/six-Season anniversary branch | — | — |
| EV2-0150 | CBA2-A10.23 | CBA | SRC2-001 | — | CBA VII §7(a)(1), p. 250 | An ordinary Extension sought more than one year early may be negotiated and entered only in the off-season | Supplies the ordinary off-season restriction | — | — |
| EV2-0151 | CBA2-A10.24 | CBA | SRC2-001 | — | CBA VII §7(a)(1), p. 250 | A Designated Veteran Player Extension may be entered no sooner than the third anniversary of Contract signing | Supplies the Designated Veteran anniversary | — | — |
| EV2-0152 | CBA2-A10.25 | CBA | SRC2-001 | — | CBA VII §7(a)(1), p. 250 | Designated Veteran Player Extensions may be negotiated and entered only during the off-season | Supplies the Designated Veteran timing restriction | — | — |
| EV2-0153 | CBA2-A10.26 | CBA | SRC2-001 | — | CBA VII §7(a)(1)(A), p. 250 | An Extension or Renegotiation entered October 2 through the day before the Regular Season is deemed signed October 1 | Supplies the anniversary date-normalization rule | — | — |
| EV2-0154 | CBA2-A10.27 | CBA | SRC2-001 | — | CBA VII §7(a)(1)(B), p. 250 | A previously extended Contract's Season count is the number covered by its most recent Extension | Supplies the term-count input | — | — |
| EV2-0155 | CBA2-A10.28 | CBA | SRC2-001 | — | CBA VII §5(a)(5), p. 228 | Bonus earning criteria in the first extended year must remain unchanged in every subsequent Salary Cap Year | Supplies the criteria-immutability duty | — | — |
| EV2-0156 | CBA2-A10.29 | CBA | SRC2-001 | — | CBA VII §7(a)(2)(iii)(b), p. 251 | After non-exercise of an Option, an Extension is permitted only if the extended term covers at least two Seasons excluding a new Option Year | Supplies the non-exercise condition | — | — |
| EV2-0157 | CBA2-A10.30 | CBA | SRC2-001 | — | CBA VII §7(a)(2)(iii), p. 251 | The Team and player may amend simultaneously for the Option action and the otherwise-permitted Extension | Supplies the simultaneous-action permission | — | — |
| EV2-0158 | CBA2-A12.8 | BYL | SRC2-002 | — | NBA By-Laws §4.02(b), pp. 63-64 | All Assignment Transaction terms and conditions must be stated in detail in the Trade Memorandum, which governs a later dispute | Supplies the Trade Memorandum recording and control duties | — | — |
| EV2-0159 | CBA2-A12.9 | BYL | SRC2-002 | — | NBA By-Laws §4.02(a), p. 63 | Any Assignment Transaction term or condition not disclosed to the Association Office on the Trade Call is unenforceable | Supplies the nondisclosure consequence | — | — |

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

### 16.v2 Active v2 scenario library and scenario crosswalk

Governed R7 population location. It is intentionally empty before R7.
Scenarios 1–89 above remain byte-preserved.

#### 16.v2.1 Active scenarios

No active `CBA2-SC-…` scenario exists before R7.

#### 16.v2.2 Scenario crosswalk

No `SXW2-…` edge exists before R7.

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

**A-family v2 status (R3.1 maker executed; independent checker pending — not accepted).** The rejected R3 checkpoint remains immutable history. R3.1 repaired its governed A-series records through AMEND lineage after the first compatibility checkpoint was independently accepted at `c3a00637` and the owner-authorized same-family compatibility checkpoint was independently accepted at `d6101f82`. The current draft contains 12 GROUPs, **151 active A LEAFs**, XW2 through `XW2-0166`, EV2 through `EV2-0159`, and the required fragment, bundle, DISP, SM2, SS2, SRC2 date-component, DR2, and AMEND support populations. Maker validation and source review do not equal independent acceptance: no A-family record is an accepted audit oracle, R4 remains blocked pending an independent R3.1 checker ACCEPT, behavioral scenarios remain pending R7, and no Phase 2 verdict exists before R9 ACCEPT plus owner acceptance. The express VII §8(a) cash-year rule and the INFERRED conditional-cash application are separate; the later re-trade residual is preserved at §12.12 under the current `unsupported-residual` DISP and adequate bounded search. Unsupported multi-team/pick-processing candidates remain unregistered and unenforceable. The C-, R-, L-, and S-family rows remain legacy status claims pending R4–R6.

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
