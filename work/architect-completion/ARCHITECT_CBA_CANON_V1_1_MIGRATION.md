# Architect CBA Canon — v1.0 → v1.1 Migration Receipt

**Date:** 2026-07-14  
**Phase:** 1 of 2 — index amendment. **Phase 2 not started.**  
**Repo state:** branch `main`, HEAD `9bea1d5f`, uncommitted working-tree edits only

---

## 1. Lineage and checksums

| Edition | Date | SHA-256 | Status |
|---|---|---|---|
| Canon **v1.0** | July 12, 2026 | `b8cf5d01356b3a83de4663f5bd6843e9aa58c8c06a84227385ae93bc02d969ef` | Historical. Primary-source-verified and independently checked. |
| Canon **v1.1** | July 14, 2026 | `4a0760c81d7a5e95919a0373d5ff631b565d064d56b858fe3b8869ad2b6bb3f6` | **Active audit oracle.** |

The v1.0 checksum is preserved in the canon's own edition table so the provenance chain from the original independent primary-source verification is not lost. The v1.1 checksum is **not** written inside the canon — a file cannot state its own hash — so it is recorded here and in the code map.

**The v1.0 verification carries forward intact.** v1.1 changed the index and nothing else, so every primary-source finding, formula, value, deadline, and authority label verified for v1.0 remains verified.

**Authority cutoff remains July 12, 2026.** This amendment performed no new source review.

**Release-gate impact.** The canon's §17 gate governs *an updated canon or season parameter set allowed to govern Architect*. An index-only v1.1 changes no rule and no parameter, so steps 1–6 and 10 have nothing to act on. Steps 7–9 (contradiction scan, unknowns check, link check) apply and are satisfied: the OPS/EXT split is preserved and now has an explicit owner (`CBA-S03`), and no citation or URL was altered.

---

## 2. Registry structure — GROUP versus LEAF

The register is a two-level tree, and the two node types are **not interchangeable**.

| Node | Definition | Role |
|---|---|---|
| **GROUP** | A top-level ID that owns child obligations | Navigation and traceability anchor. Status is a **derived rollup** of its children. Never an execution unit. |
| **LEAF** | An independently auditable obligation — a sub-ID, or a top-level ID owning exactly one obligation | The unit of audit. |

| Measure | Count |
|---|---:|
| **Registry nodes** | **427** |
| **GROUP** nodes | **59** |
| **LEAF** nodes — *the Phase 2 audit universe* | **368** |
| …top-level LEAF | 11 |
| …sub-ID LEAF | 357 |
| Top-level IDs (56 preserved + 14 added) | 70 |
| …of which GROUP | 59 |
| …of which LEAF | 11 — `CBA-A04`, `CBA-A11`, `CBA-A13`, `CBA-A16`, `CBA-A21`, `CBA-C06`, `CBA-C18`, `CBA-L07`, `CBA-L09`, `CBA-R03`, `CBA-R07` |
| Substantive obligations, each with exactly one owning LEAF | **368** |

**Correction applied 2026-07-14.** The first v1.1 draft counted all **427 registry nodes** as execution units, giving each of the 59 grouping parents its own locatability status and packet count. That double-counts every rule family that has children, and permits a parent verdict that contradicts its own children — a FOUND on `CBA-C13` while three of its fifteen children have no implementation site at all. All execution accounting is now **LEAF-only**:

1. Only LEAF identifiers are Phase 2 execution units.
2. Only LEAF identifiers carry an independent evidence status and verification method.
3. Only LEAF identifiers count toward packet totals.
4. Only LEAF identifiers receive Found / Partial / No obvious implementation site.
5. GROUP identifiers remain stable navigation and traceability anchors.
6. GROUP status is a derived rollup, never a separate compliance verdict.
7. Mixed children are never collapsed into one parent PASS/FAIL — the child-status distribution is reported instead.
8. Every LEAF appears exactly once in the execution map and exactly once in one packet.
9. Every GROUP has at least one child and appears only as a hierarchy/rollup entry.
10. Every substantive obligation retains exactly one owning LEAF.

**10 of the 59 GROUPs have children in more than one locatability state.** For each of them a single parent verdict would have been false for at least one child. That is the whole reason the distinction exists.

No identifier was renamed, renumbered, or re-parented by this correction. It changes what is *counted*, not what exists.

---

## 3. What changed, mechanically

| Measure | v1.0 | v1.1 | Δ |
|---|---:|---:|---:|
| Top-level audit IDs | 56 | 70 | +14 |
| Sub-IDs | 0 | 357 | +357 |
| Registry nodes | 56 | 427 | +371 |
| **LEAF obligations (execution units)** | **56** | **368** | **+312** |
| Acceptance scenarios | 46 | 89 | +43 |
| Substantive obligations owned | 205 of 368 | **368 of 368** | +163 |
| Obligations partially indexed | 83 | **0** | −83 |
| Obligations with no audit ID | 77 | **0** | −77 |
| Substantive CBA rules changed | — | **0** | — |

**Nothing was renumbered, deleted, or repurposed.** All 56 v1.0 top-level IDs are present with byte-identical audit questions and rationale. Acceptance scenarios 1–46 are byte-identical. Sections §1–§14 and §17–§19 — every rule, formula, threshold, dollar value, deadline, authority label, and source interpretation — are byte-identical.

---

## 4. Added top-level IDs (14)

Added only where **no existing ID is a truthful parent**.

| ID | Node | LEAF | Title | Authority | Canon locator | Packet |
|---|---|---:|---|---|---|---|
| **CBA-A19** | GROUP | 5 | Sign-and-trade eligibility and contract shape | CBA | §12.8 | P3 |
| **CBA-A20** | GROUP | 5 | Extend-and-trade limits | CBA | §10.4; §12.9 | P3 |
| **CBA-A21** | LEAF | 1 | Minimum-contract stacking limit | CBA | §12.6 | P3 |
| **CBA-C19** | GROUP | 6 | Ten-Day and Rest-of-Season contracts | CBA | §14; §5.1 | P4 |
| **CBA-C20** | GROUP | 9 | Two-Way eligibility, shape, conversion, trade treatment | CBA | §14; §5.2; §13.2 | P4 |
| **CBA-C21** | GROUP | 11 | Exhibit 10 and Exhibit 9 contracts | CBA | §3; §5.3 | P4 |
| **CBA-C22** | GROUP | 4 | Contract-shape limits: minimums, raises, maximum adjustment | CBA | §5.6; §5.7 | P4 |
| **CBA-C23** | GROUP | 6 | Bonus, incentive, deferred-compensation, and EIPPA limits | CBA | §3; §5.9 | P4 |
| **CBA-C24** | GROUP | 7 | Option and ETO shape and deadlines | CBA | §3; §5.5; §5.6 | P4 |
| **CBA-C25** | GROUP | 3 | Team Salary inclusion set | CBA | §6.1 | P1 |
| **CBA-S01** | GROUP | 6 | Season parameter set and configuration layer | DERIVED/NBA | §14; §3.1; §5.7 | P1 |
| **CBA-S02** | GROUP | 4 | Single canonical constant and enforcing-path verification | DERIVED | §3; §1.2; §3.1 | P1 |
| **CBA-S03** | GROUP | 3 | Provenance labelling and configurability of OPS/EXT | OPS/EXT | §17; §1.1; §9.3 | P1 |
| **CBA-S04** | GROUP | 2 | Derived-value recomputation and rounding policy | DERIVED | §3.1 | P1 |

`CBA-A21` is the only new ID that is a LEAF: it owns exactly one obligation (§12.6, minimum-contract stacking) and needs no children.

---

## 5. Added sub-IDs (357) — all LEAF

Sub-IDs run contiguously from `.1` beneath their parent, in canon order. Every sub-ID is a LEAF. Eleven top-level IDs own exactly one obligation and are themselves LEAFs with no children: `CBA-A04`, `CBA-A11`, `CBA-A13`, `CBA-A16`, `CBA-A21`, `CBA-C06`, `CBA-C18`, `CBA-L07`, `CBA-L09`, `CBA-R03`, `CBA-R07`.

| GROUP | LEAF children | Range | Packet |
|---|---:|---|---|
| CBA-A01 | 4 | `CBA-A01.1` – `CBA-A01.4` | P1 |
| CBA-A02 | 8 | `CBA-A02.1` – `CBA-A02.8` | P3 |
| CBA-A03 | 5 | `CBA-A03.1` – `CBA-A03.5` | P2 |
| CBA-A05 | 2 | `CBA-A05.1` – `CBA-A05.2` | P2 |
| CBA-A06 | 2 | `CBA-A06.1` – `CBA-A06.2` | P2 |
| CBA-A07 | 9 | `CBA-A07.1` – `CBA-A07.9` | P2 |
| CBA-A08 | 2 | `CBA-A08.1` – `CBA-A08.2` | P2 |
| CBA-A09 | 5 | `CBA-A09.1` – `CBA-A09.5` | P3 |
| CBA-A10 | 3 | `CBA-A10.1` – `CBA-A10.3` | P3 |
| CBA-A12 | 10 | `CBA-A12.1` – `CBA-A12.10` | P3 |
| CBA-A14 | 4 | `CBA-A14.1` – `CBA-A14.4` | P3 |
| CBA-A15 | 5 | `CBA-A15.1` – `CBA-A15.5` | P6 |
| CBA-A17 | 7 | `CBA-A17.1` – `CBA-A17.7` | P6 |
| CBA-A18 | 8 | `CBA-A18.1` – `CBA-A18.8` | P6 |
| CBA-A19 | 5 | `CBA-A19.1` – `CBA-A19.5` | P3 |
| CBA-A20 | 5 | `CBA-A20.1` – `CBA-A20.5` | P3 |
| CBA-C01 | 6 | `CBA-C01.1` – `CBA-C01.6` | P4 |
| CBA-C02 | 2 | `CBA-C02.1` – `CBA-C02.2` | P4 |
| CBA-C03 | 2 | `CBA-C03.1` – `CBA-C03.2` | P4 |
| CBA-C04 | 2 | `CBA-C04.1` – `CBA-C04.2` | P4 |
| CBA-C05 | 5 | `CBA-C05.1` – `CBA-C05.5` | P1 |
| CBA-C07 | 10 | `CBA-C07.1` – `CBA-C07.10` | P1 |
| CBA-C08 | 5 | `CBA-C08.1` – `CBA-C08.5` | P1 |
| CBA-C09 | 2 | `CBA-C09.1` – `CBA-C09.2` | P1 |
| CBA-C10 | 5 | `CBA-C10.1` – `CBA-C10.5` | P1 |
| CBA-C11 | 9 | `CBA-C11.1` – `CBA-C11.9` | P4 |
| CBA-C12 | 2 | `CBA-C12.1` – `CBA-C12.2` | P4 |
| CBA-C13 | 15 | `CBA-C13.1` – `CBA-C13.15` | P4 |
| CBA-C14 | 9 | `CBA-C14.1` – `CBA-C14.9` | P4 |
| CBA-C15 | 2 | `CBA-C15.1` – `CBA-C15.2` | P4 |
| CBA-C16 | 14 | `CBA-C16.1` – `CBA-C16.14` | P4 |
| CBA-C17 | 7 | `CBA-C17.1` – `CBA-C17.7` | P4 |
| CBA-C19 | 6 | `CBA-C19.1` – `CBA-C19.6` | P4 |
| CBA-C20 | 9 | `CBA-C20.1` – `CBA-C20.9` | P4 |
| CBA-C21 | 11 | `CBA-C21.1` – `CBA-C21.11` | P4 |
| CBA-C22 | 4 | `CBA-C22.1` – `CBA-C22.4` | P4 |
| CBA-C23 | 6 | `CBA-C23.1` – `CBA-C23.6` | P4 |
| CBA-C24 | 7 | `CBA-C24.1` – `CBA-C24.7` | P4 |
| CBA-C25 | 3 | `CBA-C25.1` – `CBA-C25.3` | P1 |
| CBA-L01 | 5 | `CBA-L01.1` – `CBA-L01.5` | P1 |
| CBA-L02 | 8 | `CBA-L02.1` – `CBA-L02.8` | P4 |
| CBA-L03 | 15 | `CBA-L03.1` – `CBA-L03.15` | P7 |
| CBA-L04 | 17 | `CBA-L04.1` – `CBA-L04.17` | P4 |
| CBA-L05 | 7 | `CBA-L05.1` – `CBA-L05.7` | P6 |
| CBA-L06 | 3 | `CBA-L06.1` – `CBA-L06.3` | P3 |
| CBA-L08 | 6 | `CBA-L08.1` – `CBA-L08.6` | P7 |
| CBA-L10 | 9 | `CBA-L10.1` – `CBA-L10.9` | P7 |
| CBA-R01 | 10 | `CBA-R01.1` – `CBA-R01.10` | P5 |
| CBA-R02 | 7 | `CBA-R02.1` – `CBA-R02.7` | P5 |
| CBA-R04 | 6 | `CBA-R04.1` – `CBA-R04.6` | P5 |
| CBA-R05 | 5 | `CBA-R05.1` – `CBA-R05.5` | P5 |
| CBA-R06 | 6 | `CBA-R06.1` – `CBA-R06.6` | P5 |
| CBA-R08 | 5 | `CBA-R08.1` – `CBA-R08.5` | P5 |
| CBA-R09 | 2 | `CBA-R09.1` – `CBA-R09.2` | P5 |
| CBA-R10 | 4 | `CBA-R10.1` – `CBA-R10.4` | P5 |
| CBA-S01 | 6 | `CBA-S01.1` – `CBA-S01.6` | P1 |
| CBA-S02 | 4 | `CBA-S02.1` – `CBA-S02.4` | P1 |
| CBA-S03 | 3 | `CBA-S03.1` – `CBA-S03.3` | P1 |
| CBA-S04 | 2 | `CBA-S04.1` – `CBA-S04.2` | P1 |
| **Total** | **357** | | |

The full LEAF register — each condition, authority, verification method, and scenario — is canon §15.7.

---

## 6. Added acceptance scenarios (43)

Scenarios **1–46 are unchanged and unrenumbered**. Additions run **47–89**. The GROUP/LEAF correction required **no** scenario change: scenarios map to LEAF obligations, which is what they already did.

Scenarios were added where a deterministic rule family had **no coverage at all**, or where a legal condition that can independently fail was exercised by nothing in the library. They are deliberately **not** one per obligation:

- `CBA-S01`, `CBA-S02`, and `CBA-S03` received **no** scenario — they are verified by static and configuration inspection, the truthful method for a parameter layer and a provenance label.
- `CBA-A21` received no new scenario — scenario **10** already tested it. In v1.0 that scenario pointed at no audit ID at all; minting A21 gave it an owner.

| Scenario | Owning GROUP / LEAF |
|---|---|
| 47 | CBA-A01 |
| 48 | CBA-A11 |
| 49 | CBA-A07 |
| 50 | CBA-A10 |
| 51 | CBA-A19 |
| 52 | CBA-A20 |
| 53 | CBA-A18 |
| 54 | CBA-A15 |
| 55 | CBA-A17 |
| 56 | CBA-A02 |
| 57 | CBA-C07 |
| 58 | CBA-A12 |
| 59 | CBA-A14 |
| 60 | CBA-C10 |
| 61 | CBA-S04 |
| 62 | CBA-C13 |
| 63 | CBA-C01, CBA-C14 |
| 64 | CBA-C15 |
| 65 | CBA-C16 |
| 66 | CBA-C17 |
| 67 | CBA-C18 |
| 68 | CBA-C23 |
| 69 | CBA-C24 |
| 70 | CBA-C22 |
| 71 | CBA-C19 |
| 72 | CBA-C20 |
| 73 | CBA-C21 |
| 74 | CBA-C25 |
| 75 | CBA-C05 |
| 76 | CBA-C11 |
| 77 | CBA-R01 |
| 78 | CBA-R02 |
| 79 | CBA-R06 |
| 80 | CBA-R04 |
| 81 | CBA-R05 |
| 82 | CBA-R10 |
| 83 | CBA-L01 |
| 84 | CBA-L04 |
| 85 | CBA-L02 |
| 86 | CBA-L03 |
| 87 | CBA-L05 |
| 88 | CBA-L10 |
| 89 | CBA-A09 |

---

## 7. Completeness-review proposals that were changed or rejected

The review's enumeration was **re-derived mechanically and reproduced exactly**: 382 rows; 205 fully indexed, 83 partial, 77 unowned, 9 reference, 8 operational; 365 substantive obligations; 56 existing IDs all anchored; all 46 scenarios traced; 76 proposed sub-IDs and 14 proposed top-level IDs. Its 14 top-level proposals were **accepted in full**. Four things were changed.

### 7.1 Sub-ID scheme rejected and replaced (76 → 357)

**The review's 76 sub-IDs are structurally insufficient, and its own §4.4 says why.** It proposed sub-IDs only for obligations that were *partially indexed* or *unowned*, leaving all **205 fully indexed** obligations with no individual identifier. But a parent owning several independently-failing conditions hides mixed compliance under one verdict — exactly what §4.4 complains about when it lists 19 IDs as "too broad to produce a single reliable verdict".

The clearest case is **`CBA-C07`** (Apron Salary). It owns the **nine enumerated CBA VII.2(e)(1) adjustments** plus the before/after rule, every one marked *fully indexed*, every one able to fail on its own. Under the review's scheme C07 would gain one sub-ID and Phase 2 would return a single verdict for ten independent conditions. Eight can be right and one wrong, and the apron verdict is still wrong.

**Replacement rule:** every substantive obligation is owned by exactly one LEAF. A parent owning more than one obligation becomes a GROUP with a LEAF child per obligation; a parent owning exactly one *is* the LEAF. This yields **357 sub-ID LEAFs + 11 top-level LEAFs = 368**, and makes "nothing is partially indexed" mechanically provable rather than asserted.

### 7.2 Sub-ID numbering corrected (phantom identifiers removed)

The review's numbering was **not consistent or mechanically sortable**. Most parents started at `.2`, but `C01`/`C14`/`C16` at `.5`, `C05`/`C13`/`L02`/`L03` at `.4`, `R01` at `.3`. It was silently reserving `.1`…`.k` for the clauses of each parent's original question **without ever minting them** — so `CBA-C16.1` through `C16.4` would have been cited by implication and defined nowhere.

**Corrected:** sub-IDs run contiguously from `.1`, in canon order, with no reserved or skipped numbers.

### 7.3 A counting error corrected (365 → 368 obligations)

The review's method states: *"A rule stating four date windows is four obligations, not one, because an engine can get two right and two wrong."* Its row **REQ-337** violates this: it collapses the **eight** distinct trade restrictions of canon §12.11 into a single row marked *fully indexed* under `CBA-L03` — the very bundling its §4.4 criticises L03 for.

Six of the eight are separately enumerated elsewhere in its own table. **Four were left with no row of their own** and are now split out:

| LEAF | Restriction | Scenario |
|---|---|---|
| `CBA-L03.11` | Later of three months or December 15 for ordinary free-agent signings | #41 |
| `CBA-L03.12` | Later of three months or January 15 for specified Bird-rights re-signings | #41 |
| `CBA-L03.13` | 30 days after a Two-Way signing in the specified contexts | #86 |
| `CBA-L03.14` | End-of-season option/ETO trade restrictions | #43 |

Substantive obligations therefore total **368**, not 365. No canon text changed — the rule was always there; only the index row was too coarse.

Other multi-line rows were checked and **left alone**: they are inventory obligations (the §14 calendar event set, the §4.3 per-team counts, the §3.1 parameter set) or conjunctive tests (§12.6's three stacking conditions), where the requirement is that the *set* is represented, not that each member is a separate rule.

### 7.4 One sub-ID re-parented

The review scoped *"a signing bonus paid by the sending team is treated as cash-in-trade"* (canon §12.8) into new top-level **A19** while simultaneously classifying it as *partially indexed under A18* — double-homing it. Its operative effect is on the **cash-in-trade ledger** and `CBA-A18` is a truthful parent, so it is now **`CBA-A18.3`**, cross-referenced from A19 rather than owned by it.

---

## 8. Coverage and verification totals — LEAF only

### 8.1 Atomic-obligation coverage

| Measure | Count |
|---|---:|
| Substantive implementation obligations | **368** |
| …owned by exactly one LEAF | **368** (100%) |
| …partially indexed | **0** |
| …unowned | **0** |
| Process/reference rows with a documented non-code disposition | **17** |
| **Total canon rows accounted for** | **385** |

### 8.2 Locatability — LEAF only

| Locatability | LEAF | Share |
|---|---:|---:|
| **FOUND** | 134 | 36.4% |
| **PARTIAL** | 127 | 34.5% |
| **NO SITE** | 107 | 29.1% |
| **Total** | **368** | 100% |

This supersedes the first draft's 153 / 149 / 125 across 427 nodes, which scored 59 grouping parents that own no obligation of their own.

### 8.3 Verification methods — LEAF only

| Method | Meaning | LEAF |
|---|---|---:|
| SCEN | Executable scenario | 306 |
| LIFECYCLE | Lifecycle/state review | 32 |
| EXTS | External-state handling | 16 |
| STATIC | Static/configuration inspection | 13 |
| UI | Manual UI review | 1 |
| **Total** | | **368** |

Plus the 17 non-substantive rows: **9** reference, **8** operational verification. These are not LEAFs and can never produce an Architect verdict.

**A GROUP carries no verification method.** Not everything is a test, either: the parameter layer is proven by static and configuration inspection; the state ledgers of canon §§4.2–4.4 by lifecycle review; EXT determinations by explicit external-state handling; and the canon's one UI obligation — that externally adjudicated states must read as "assumption required" and never as an unqualified PASS or FAIL — by manual UI review.

---

## 9. Phase 2 packets and bounded work units

### 9.1 Packets — LEAF counts

| # | Packet | GROUPs | **LEAF** |
|---|---|---:|---:|
| **P1** | Ledgers, season parameters & dated evaluation (foundation) | 12 | **55** |
| **P2** | Trade-salary basis (ITS/OTS) | 5 | **21** |
| **P3** | TPE paths, aprons, hard caps & trade mechanisms | 8 | **47** |
| **P4** | Cap holds, exceptions, Bird/RFA/extensions & contract types | 19 | **139** |
| **P5** | Rosters, waivers & dead money | 8 | **48** |
| **P6** | Picks, cash, multi-team & Stepien | 4 | **28** |
| **P7** | Transaction timing, history & external determination | 3 | **30** |
| | **Total** | **59** | **368** |

**Dependency order: P1 → P2 → P3 → P4 → P5 → P6 → P7.** No packet depends on a later one.

### 9.2 Bounded work units (13)

The goal remains reviewing **every LEAF obligation across all seven packets**. P1 runs first because it is the foundation, not because it is the endpoint.

Packets are too coarse to execute — P4 alone is 139 LEAF obligations. They split into 13 units, each sized for a separate fresh session and coherent by rule family and dependency. Target band ~25–45 LEAF; four units sit below it because the family is tightly coupled and splitting it would force provisional verdicts.

| Unit | Packet | Scope | IDs | **LEAF** |
|---|---|---|---|---:|
| **W1.1** | P1 | Season parameters, constants, provenance, derivation & dated evaluation | `S01`, `S02`, `S03`, `S04`, `L01` | **20** |
| **W1.2** | P1 | Independent ledgers: Team, Apron, Tax, minimum subsidy & the 90% floor | `A01`, `C25`, `C05`, `C06`, `C07`, `C08`, `C09`, `C10` | **35** |
| **W2.1** | P2 | Trade-salary basis — ITS and OTS | `A03`, `A04`, `A05`, `A06`, `A07`, `A08` | **21** |
| **W3.1** | P3 | TPE formula, paths, decomposition & persistence | `A02`, `A09`, `A10`, `A11`, `L06`, `L07` | **21** |
| **W3.2** | P3 | Apron transaction limits, hard caps & trade mechanisms | `A12`, `A13`, `A14`, `A19`, `A20`, `A21` | **26** |
| **W4.1** | P4 | Cap holds, exceptions, DPE & the long-term injury exclusion | `C01`, `C02`, `C03`, `C04`, `C13`, `C11`, `C12` | **38** |
| **W4.2** | P4 | Bird rights, RFA, qualifying offers, offer sheets & Arenas | `C14`, `C15`, `L04` | **28** |
| **W4.3** | P4 | Extensions, options and ETOs, Over-38 & renegotiation | `C16`, `C17`, `C18`, `C24`, `L02` | **37** |
| **W4.4** | P4 | Contract types and terms: Ten-Day, Rest-of-Season, Two-Way, Exhibit, shape & bonuses | `C19`, `C20`, `C21`, `C22`, `C23` | **36** |
| **W5.1** | P5 | Waivers, dead salary, stretch, buyout & set-off | `R01`, `R02`, `R03`, `R04`, `R05` | **29** |
| **W5.2** | P5 | Roster legality, lists, two-way usage & hardship | `A16`, `R06`, `R07`, `R08`, `R09`, `R10` | **19** |
| **W6.1** | P6 | Picks, cash-in-trade, multi-team touch & Stepien | `A15`, `A17`, `A18`, `L05`, `L09` | **28** |
| **W7.1** | P7 | Transaction timing, taxpayer/apron history & external determination | `L03`, `L08`, `L10` | **30** |
| | | **Total** | | **368** |

**Execution order:** W1.1 → W1.2 → W2.1 → W3.1 → W3.2 → W4.1 → W4.2 → W4.3 → W4.4 → W5.1 → W5.2 → W6.1 → W7.1. No unit depends on a later one. `A17 ↔ L09` (Stepien ↔ frozen picks) sit together in W6.1 because they are a circular-risk pair; `C01 ↔ C14` (cap holds ↔ Bird rights) sit in adjacent units W4.1 and W4.2 for the same reason.

Each unit is a self-contained session: it inherits the settled outputs of the units before it, produces the canon §17 six-field record for each of its LEAF obligations, and hands forward nothing but evidence. **This is a plan; no Phase 2 work has begun.**

---

## 10. Confirmations

- **No substantive CBA rule changed.** Canon §§1–14 and §§17–19 are byte-identical to v1.0. The only deletions in the entire canon diff are two header lines (the edition label and the annual-value sources line, both re-emitted with amendment metadata appended).
- **No existing identifier changed.** All 56 v1.0 top-level IDs are present, unrenumbered, with byte-identical questions.
- **No scenario changed.** Scenarios 1–46 are byte-identical; additions run 47–89, unaffected by the GROUP/LEAF correction.
- **The GROUP/LEAF correction renamed, renumbered, and re-parented nothing.** It changes what is counted as an execution unit, not what exists.
- **No application behavior changed.** No code, test, fixture, schema, constant, configuration, or data file was touched.
- **No verdicts assigned.** Locatability only. No Architect PASS/FAIL.
- **Nothing committed or pushed.** Working-tree edits only.
- **Phase 2 not started.**

## 11. Files changed

| File | Change |
|---|---|
| `docs/reference/cba/ARCHITECT_CBA_CANON.md` | Amended v1.0 → v1.1 (index only) |
| `work/architect-completion/ARCHITECT_CBA_CANON_CODE_MAP.md` | Reconciled to v1.1, LEAF-only execution accounting |
| `work/architect-completion/ARCHITECT_CBA_CANON_V1_1_MIGRATION.md` | Created — this receipt |
| `work/architect-completion/ARCHITECT_CBA_CANON_INDEX_COMPLETENESS_REVIEW.md` | **Unchanged** — preserved as the historical input |
