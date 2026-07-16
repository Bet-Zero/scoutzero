# Architect CBA Canon v2.0 — R3 Receipt: A-Series Construction and Source Certification

## 1. Provenance and baseline

| Field | Value |
|---|---|
| Repair unit | R3 — construct and source-certify the active v2 A-series (first construction unit; creates canon §15.10–§15.12) |
| Branch | `architect/cba-canon-v2` |
| Baseline commit | **`6d9c7576afa682a7d89519f02315321ed74e8509`** — the full R2.5 checkpoint SHA, verified as HEAD = `origin/architect/cba-canon-v2` at session start; parent = `e0344aacc3b60598fc625018640f0d1c31fb6024` (R2.4); R2.3 = `c2228607…`; R1.2 = `07d5aa58…`; R2.2 = `6aa616fd…`; R2.1 = `05c1b28e…`; R1.1 = `1532c928…`; R2 = `056b9d02…`; R1 = `af931e90…` |
| `main` | `main` = `origin/main` = `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288` — untouched by this unit |
| Clean-state verification | Worktree, index, and untracked state completely clean at session start; ahead/behind vs upstream 0/0 |
| Authorizing review | The independent Codex foundation review of the completed foundation at `6d9c7576afa682a7d89519f02315321ed74e8509` returned: **"ACCEPT — R1.2 and the R2.1 foundation as hardened through R2.5 are accepted for R3 construction; R3 may begin."** This acceptance unblocked only R3. It did **not** accept Canon v2.0, close Phase 1, authorize R4–R9, unblock Phase 2 or W1.1, or authorize application changes |
| Binding standard | Canon §15.9 as hardened through R2.5. The rejected R2 identity/migration machinery is historical only |
| Scope | A-family construction and source certification only. R4–R9, Phase 2, and W1.1 not started; no C/R/L/S active record created |
| Edition status after R3 | Canon v2.0 **working draft** — not accepted, not active; **R3 is not independently accepted**; v2.0 checksum deliberately **not** computed (R8) |

## 2. Files changed — exactly two

1. `docs/reference/cba/ARCHITECT_CBA_CANON.md` — new §15.10 (active v2
   register, A family), §15.11 (historical crosswalk, A family), §15.12
   (source/provenance and evidence registries); two A-series source-law
   corrections in §12.7; the §19.3 A-family v2 certification block; the
   header amendment date, one "What v2.0 changes" R3 sentence, and one new
   amendment-log row. §15.9 itself is byte-unchanged (§13 below).
2. `work/architect-completion/ARCHITECT_CBA_CANON_V2_R3_A_SERIES_CERTIFICATION.md`
   — this receipt (new).

Nothing else. The repair plan, every earlier receipt, the README, the code
map, the historical review artifacts, application code, tests, schemas,
fixtures, configuration, and data are untouched; Linear was not read or
written. Per the standing R3 order, the repair plan was deliberately **not**
edited to record the Codex ACCEPT — this receipt records it (§1).

## 3. Published historical A-series population — recomputed mechanically

The published v1.1 canon was extracted from the pinned commit and re-hashed
this session: `git show 9814939c…:docs/reference/cba/ARCHITECT_CBA_CANON.md`
→ SHA-256 `4a0760c81d7a5e95919a0373d5ff631b565d064d56b858fe3b8869ad2b6bb3f6`
(exact match to the pinned historical edition). A mechanical parse of that
edition's §15.7 A-series LEAF rows and top-level LEAF rows returned
**89 unique historical A-series LEAFs**, distributed
A01=4, A02=8, A03=5, A04=1, A05=2, A06=2, A07=9, A08=2, A09=5, A10=3,
A11=1, A12=10, A13=1, A14=4, A15=5, A16=1, A17=7, A18=8, A19=5, A20=5,
A21=1 — reconciling exactly with the published §15.6 hierarchy table.
The prompt-supplied count of 89 was therefore verified, not trusted.

Exactly four published A rows differ from the branch's legacy-numbered
working copy (`CBA-A07.2`, `CBA-A07.8`, `CBA-A11`, `CBA-A18.7` — the
R1/R1.1 corrections and authorized R2.1 annotations), confirming the
three-population separation: every `XW2-…` edge below reads its source
from the published population, never the working copy.

## 4. Source artifacts verified and passages read (certification basis)

### 4.1 Artifacts (the §15.12 SRC2 records)

| Artifact | Verification |
|---|---|
| Signed 2023 NBA–NBPA CBA (SRC2-001) | Re-downloaded from the official URL at 2026-07-16T09:39:26Z; **2,850,534 bytes**, **676 PDF pages**, SHA-256 `bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32` — byte count, page count, and hash all independently recomputed this session and matching the expected artifact. Printed page = PDF page − 24; UPC exhibits printed page A-n = PDF page 584 + n. Not committed |
| June 2024 NBA Constitution and By-Laws (SRC2-002) | Downloaded from the official URL at 2026-07-16T09:40:09Z; 422,247 bytes, 88 PDF pages, SHA-256 `be4d2781fe8fddfc5bc9028214298f742789a949dade4ead26368a4336d32ccf`. Cover edition "JUNE 2024"; day-precision publication date 2024-06-07 taken from the artifact's embedded PDF creation/modification metadata (recorded as a limitation on the record). Printed page = PDF page − 7. Not committed |
| NBA release, 2023-24 Salary Cap (SRC2-003) | Retrieved 2026-07-16T09:59:50Z; SHA-256 of retrieved content `c162ae4a821c8ed38e1af37a75a5368d558ae941455210c0cd5b301d0e42329b`; official release dated June 30, 2023; exact value relied upon: 2023-24 Salary Cap **$136.021 million** |
| NBA release, 2026-27 Salary Cap (SRC2-004) | Retrieved 2026-07-16T09:59:51Z; SHA-256 of retrieved content `cdc91324694aea16627b8e938d1c86c4865667e18e76d0beeb789d48628f4766`; official release dated June 30, 2026; exact values relied upon: Salary Cap **$164.961M**, First Apron **$209.015M**, Second Apron **$221.686M**, Tax Level **$200.428M**, Minimum Team Salary **$148.465M** |

Verification metadata on every SRC2 base row: `agent:claude-code` /
`session:r3-20260716-01` / `2026-07-16` (the accepted R2.5 grammars).

### 4.2 Family-level adjacent-provision sweep (U14)

Every controlling passage below was read verbatim in this session from the
verified artifacts before its EV2 evidence was authored (printed pages):

- **CBA I §1(d)** p. 2 (Agreement date); **I §1(kkk)–(lll)** p. 9 (Room;
  Salary definitions).
- **CBA II §3(k), (m), (q)** pp. 19–20 (Exhibit 4/6/8 amendment
  permissions); **II §6(d), (f)–(g)** pp. 34–35 (minimum deemed amendment;
  minimum-contract bonus construction); **II §7(a)–(c)** pp. 36–40
  (Maximum Annual Salary at signing/renegotiation/extension; the §7(c)
  deemed-amendment reduction order); **II §12(a)(i)–(iii)** p. 58 (bonus
  caps).
- **CBA VII §2(d)(1)(i)** pp. 179–80 (Tax Team Salary); **VII §2(d)(2)**
  tax-rate tables pp. 183–84 (context); **VII §2(e)(1)–(5)** pp. 186–91
  (Apron Team Salary; transaction restrictions; dual-year rules;
  assumptions; Transaction Restrictions Table rows A–K; the 2023-24
  exemption) with the §2(e) worked examples pp. 192–95; **VII §2(f)**
  pp. 195–97 (Second Apron Team; Draft Pick Penalty; freeze/unfreeze).
- **CBA VII §3(b)(1)–(3)** pp. 200–05 (signing/trade-earned/extension
  bonus allocation, incl. §3(b)(3)(iii)–(v)); **VII §3(c)** pp. 205–06
  (loans — adjacent only); **VII §3(d)(1)–(6)** pp. 206–08 (Performance
  Bonus inclusion; Expert challenges); **VII §3(e)** pp. 208–09 (EIPPA —
  adjacent only).
- **CBA VII §4(a) opening and §4(a)(1)(i)–(iii)** pp. 211–13 (Team Salary
  computation enumeration).
- **CBA VII §5(a)(1)–(6)** pp. 226–28 (raise limits incl. §5(a)(4));
  **VII §5(b)(1)** p. 229 (unlikely-bonus cap — adjacent only).
- **CBA VII §6(i)** p. 240 (Minimum Player Salary Exception);
  **VII §6(j)(1)–(8)** pp. 240–46 in full (Standard/Aggregated/Transition/
  Expanded/room paths; below-cap election; $250K zeroing; aggregation
  restrictions; base-year rule; non-guarantee windows with the worked
  example; DPE bar; Two-Way exclusion); **VII §6(k)** pp. 246–47 (SRPE —
  adjacent only); **VII §6(m)–(n)** pp. 247–49 (non-aggregation; exception
  availability/cap holds; proration — adjacent).
- **CBA VII §7(a)(1)–(3)** pp. 249–53 (extension timing, bars, salary
  limits incl. §7(a)(3)(iii)(B) and §7(a)(3)(v)); **VII §7(c)(3)–(4)**
  p. 257 (trade-bonus-waiver renegotiation bar; option-exercise trade
  amendments).
- **CBA VII §8(a)–(k)** pp. 260–66 in full (cash; one-year-Bird consent;
  deadline restriction; trade-eligibility dates; sign-and-trade §8(e)(1);
  extension-and-trade §8(e)(2); Exhibit 6 bar §8(e)(3); six-month bars
  §8(f); poison pill §8(g); reacquisition §8(h); divestiture, summaries,
  trade definition §8(i)–(k)); **VII §9(a)–(b)** p. 266 (Season counting;
  Option Year rules).
- **CBA VIII §1(c)–(d)** pp. 292–93 (Rookie Scale 80–120%; trade-bonus
  deemed amendment); **VIII §2** p. 293 (later-signed picks — adjacent).
- **CBA XII §§1–4** pp. 336–38 (Options/ETOs — adjacent for the
  poison-pill option treatment and the dual-year assumptions).
- **CBA XXIV §1, §2(a)(i)–(vi), §2(b)** pp. 414–17 in full (trade bonus;
  no-trade).
- **CBA Exhibit A, UPC Exhibit 4 — Trade Payments** p. A-37 (PDF 621)
  (assignor payment, 30 days).
- **BYL 4.01–4.05** pp. 62–66 in full (trading dates; Trade Call;
  disclosure; per-diem apportionment and obligation assumption/
  modification; additional trade rules incl. 4.05(e) list room);
  **BYL 5.01–5.04** pp. 66–67 (waiver procedure — adjacent only);
  **BYL 7.03** p. 78 (Stepien).

Per-LEAF adjacent notes are carried in the register's Notes/limitations
column wherever an adjacent proviso materially limits a LEAF (e.g., the
VII §3(d)(2)–(5) Expert override on CBA2-A03.7; BYL 4.04(c) modifiability
on CBA2-A04.7; the pre-2024-25 variants on CBA2-A10.3/.4; VII §9(a) Season
counting on CBA2-A03.5/A10.3; §2(e)(5) on CBA2-A05.18).

### 4.3 Class-specific certification attestation (U8)

For **every** of the 89 `EV2-…` components of all 81 active A LEAFs, the
class-specific §15.9.6 certification duty was performed in this session:
every CBA and BYL component's controlling passage was read in the verified
artifact identified by its SRC2 record; both NBA components' publications
and exact values were verified on the retrieved official releases;
the DERIVED component's formula, all three resolved inputs, units
(millions of dollars), and rounding treatment were verified by independent
recomputation (7.5 × 164.961 ÷ 136.021 = 9.0957095; crossovers 8.8457095
and 35.3828379); and every INFERRED component's complete reasoning chain
is stated in its own row and was verified against the controlling passages
read this session. No passage was invented for any class; no component
claims express language for inferred content.

## 5. Active A-series constructed (canon §15.10)

| Measure | Count |
|---|---:|
| Active GROUPs (`CBA2-A01`–`CBA2-A12`) | **12** |
| Active LEAFs | **81** |
| LEAF distribution | A01=1, A02=14, A03=8, A04=8, A05=18, A06=3, A07=9, A08=5, A09=1, A10=8, A11=1, A12=5 |
| Primary methods | SCEN 75, LIFECYCLE 5, STATIC 1 |
| Authority classes (LEAF-level) | CBA on 75 LEAFs; BYL on 3; NBA on 1; DERIVED on 1; INFERRED on 7; **OPS 0; EXT 0; composite labels 0** |
| Newly certified LEAFs (`new` origin + `ORIGIN` record) | **10** — CBA2-A02.11, A02.13, A02.14, A03.6, A05.9, A05.14, A05.18, A07.7, A07.9, A12.5 |

Grouping and atomicity were determined semantically from the signed text
(the enumeration floor, the mixed-verdict test, the numeric-bounds rule,
and the exception-split rule), not by mirroring the historical structure:
the historical 21 top-level A entries became 12 semantic GROUPs, historical
bundles were split (e.g., `CBA-A19.3` → three LEAFs; `CBA-A02.4` → four
fragments), and duplicates were merged (e.g., row I's two historical
owners). One homogeneous-list ATOM exception was used (CBA2-A05.17,
DR2-0005) with evidence quoting every listed element.

## 6. SRC2 / EV2 registries (canon §15.12)

| Register | Contents |
|---|---|
| SRC2 | **4 records**: 2 `official-immutable` (signed CBA; June 2024 By-Laws), 2 `official-mutable` (2023-24 and 2026-27 official cap releases); 0 `ops-provenance`; 0 `ext-contract`. All thirteen base fields populated per the R2.5 grammars; each record carries exactly one matching type-specific detail row; zero orphans |
| EV2 | **89 components**: CBA 76, BYL 3, NBA 2, DERIVED 1, INFERRED 7. Every row lists ≥1 source or dependency reference (no source-free terminal component); every reference parses under the pinned grammar and resolves; dependency chains acyclic; every transitive closure terminates in typed official roots (`official-immutable`/`official-mutable` only — no OPS/EXT root exists, so no laundering path exists); Authority ⇔ EV reconciliation exact in both directions for all 81 LEAFs |

Multi-component LEAFs: CBA2-A02.8 (CBA + NBA×2 + DERIVED), CBA2-A03.7
(CBA + INFERRED), CBA2-A03.8 (CBA×2 + INFERRED), CBA2-A11.1
(CBA + INFERRED), CBA2-A12.3 (BYL + INFERRED). Single-class INFERRED
LEAFs: CBA2-A01.1, CBA2-A08.5, CBA2-A12.1.

## 7. Mandated treatments

### 7.1 A11 (per-team decomposition) — as ordered

The active successor **CBA2-A11.1** carries two separate evidence
components: **EV2-0082 (CBA)** — the express per-player/per-exception
structure of CBA VII §6(j)(1)(i)–(v), pp. 240–41, read this session — and
**EV2-0083 (INFERRED)** — the decomposition procedure, with its complete
official-rooted reasoning chain (per-exception structure + the §6(m)
exception-selection right → partition validation), depending on EV2-0082
and rooting only in SRC2-001. No DERIVED classification and no composite
slash label appears anywhere on the row (DR2-0011).

### 7.2 A18.7 (conditional cash / re-trade mechanics) — as ordered

The express cap-year charging obligation is registered as **CBA2-A08.4**
with authority **CBA** (VII §8(a), p. 260 — "in connection with one (1) or
more trades occurring during a Salary Cap Year, directly or indirectly").
The re-trade attribution/accounting mechanic was **not minted**: no
qualifying first-party operational provenance was located (so OPS is
unavailable), and no complete controlling official-source chain exists
(VII §8(a) does not resolve re-trade attribution, so honest INFERRED is
unavailable). It is not DERIVED/OPS and not any composite. The historical
fragment is dispositioned honestly: `CBA-A18.7` carries one
`partial-overlap` edge (XW2-0104) to CBA2-A08.4 covering only the express
fragment, with the unregistered residual named in the edge scope, in
CBA2-A08.4's Notes, in §12.12's preserved candidate annotation, in §19.3,
and here. No `no-successor` edge was used, nothing was concealed, and no
crosswalk edge type had to be invented — so the stop-and-report condition
was not triggered.

## 8. Unsupported operational candidates — dispositions

Under the accepted R2.4/R2.5 policy, the following remain **discovery
candidates only** — not registered, not OPS, not verdict-driving, not
enforceable:

| Candidate | Historical rows | Disposition |
|---|---|---|
| Multi-team touch test; qualifying-asset thresholds; deemed draft-rights status; multi-team graph validation | CBA-A15.1–.5 | Terminal `invalid` edges (XW2-0085–0089): the published rows asserted enforceable **OPS-authority** obligations whose only support was secondary reporting — a false authority/enforceability claim under §15.9.5 rule 4 and the §15.9.6 strict policy. The reported mechanics remain preserved in §12.2 as unsupported operational candidates (DR2-0037) |
| Seven-future-draft horizon; protection/deferral processing limits; "two years after prior conveyance" limit | CBA-A17.4, A17.3, A17.7 | Terminal `invalid` edges (XW2-0093/0094/0098) on the same basis; candidates preserved in §13.3 (DR2-0038) |
| Re-trade cash attribution/accounting mechanics | CBA-A18.7 (fragment) | Unregistered residual fragment of a `partial-overlap` edge (§7.2 above); candidate preserved in §12.12 |

`no-successor` was used **zero** times: every candidate above is "merely
unsupported," which the narrow rule expressly excludes, and the honest
terminal disposition for the A15/A17 rows is `invalid` (the false claim is
the asserted OPS authority/enforceability, not the existence of a report).
None of these dispositions conceals failed certification, deferred work,
or an unresolved in-scope obligation: an unsupported candidate is not a
registrable obligation under the accepted foundation, and each one remains
visibly preserved for future first-party provenance.

## 9. Source-law discoveries (corrected under the R1 mechanism)

Direct primary-source review found two incorrect A-series canon statements
in §12.7, both within R3's A-series scope and fully evidenced; both were
corrected in §12.7 with amendment-log disclosure:

1. **Trade-bonus percentage basis.** The canon said the calculation uses
   "guaranteed base compensation still owed … plus guaranteed future
   seasons." The signed rule is **Base Compensation remaining to be
   earned** at the time of the trade, excluding an unexercised Option
   Year, with **no guarantee/protection filter** (CBA XXIV §2(a)(ii) and
   §2(a)(iii)(A), pp. 414–15, read this session). Registered as
   CBA2-A04.1 (EV2-0030); historical `CBA-A07.7`'s edge scope records
   that the qualifier is not carried.
2. **Trade-bonus maximum reduction.** The canon said to "reduce [the
   allocated bonus] if annual maximum salary would be exceeded" as a
   general rule. The only such reduction expressed in the signed text is
   the **Rookie Scale** deemed amendment (VIII §1(d), p. 293 — Salary plus
   Unlikely Bonuses capped at 120% of the Rookie Scale Amount). Article II
   §7 (pp. 36–40, read this session) caps amounts at signing,
   renegotiation, and extension only and contains no veteran trade-bonus
   reduction. Registered as CBA2-A04.4 (EV2-0033); historical
   `CBA-A07.8`'s edge scope records the correction.

Neither correction conflicts with any settled R1/R1.1/R1.2 correction or
touches another family; neither required expanding the unit, so the
stop-and-report condition was not triggered. §5.9 was not touched.

## 10. Historical crosswalk (canon §15.11)

| Edge type | Count |
|---|---:|
| `equivalent` | 17 |
| `merge` | 25 |
| `split` | 23 |
| `partial-overlap` | 56 |
| `process-only` | 2 (CBA-A02.3, CBA-A02.6 — correction/UI-instruction rows) |
| `invalid` | 8 (CBA-A15.1–.5, A17.3, A17.4, A17.7 — false OPS-authority claims) |
| `moved` / `no-successor` | 0 / 0 |
| **Total edges** | **131** |

Coverage reconciliation: 88 of the 89 published historical A LEAFs carry
at least one R3 edge; `CBA-A01.4` (whole row) carries a named deferral —
88 + 1 = 89, matching the mechanically recomputed population. Exactly one
primary relationship type per source–target pair (verified mechanically);
every non-terminal target resolves to an active LEAF; every terminal edge
has target `—` and a resolving decision record; every edge was typed by
the §15.9.3 deterministic precedence; historical verdicts were not
transferred; every predecessor-free active LEAF carries `new` origin plus
an `ORIGIN` record; origin reciprocity (register Origin ⇔ edge targets) is
exact.

Named deferrals (four; R8 requires zero remaining):

| Source | Scope | Families | Resolving unit |
|---|---|---|---|
| CBA-A01.4 (whole) | Team Salary composition (roster salaries) | A ↔ C | R4 |
| CBA-A01.3 (fragment) | Explicit-date/season evaluation context (duplicates historical L01.1) | A ↔ L | R6 |
| CBA-A08.1 (fragment) | Minimum Exception contract shape and proration | A ↔ C | R4 |
| CBA-A17.1 (fragment) | Pick-ledger representation (ownership/swaps/protections/deferral state/dependencies/slide state) | A ↔ L | R6 |

True gaps: the A family contains **zero** historical gap-assertion notes
(the C20.9-style pattern does not occur in the published A rows), so no
`TG` record was required; U12 passes vacuously and is recorded as such.

## 11. Decision records (DR2-0001–DR2-0047)

13 `ATOM`, 29 `OWN`, 5 `ORIGIN`, 0 `TG`, 0 `MOVE`, 0 `METHOD` (R7-only),
0 `AMEND` (there are no prior committed active-v2 checkpoints, and no
in-session drafting correction fabricated one). The `invalid` and
`process-only` terminal dispositions are carried on `OWN`/`ATOM` records
(DR2-0037/0038/0039) because the closed §15.9.4 type vocabulary contains
no terminal-disposition type; each states the full candidate set, the
no-owner disposition, and the §15.9.5/§15.9.6 basis.

| DR ID | Type | Subject(s) | Disposition | Test/tiebreak applied | Rationale | Resulting active LEAF(s) or — | Unit/commit |
|---|---|---|---|---|---|---|---|
| DR2-0001 | `ATOM` | CBA2-A01 construction; historical CBA-A01.1/.2/.3 | Keep as one LEAF (CBA2-A01.1) | Mixed-verdict test | GIVEN the CBA's distinct defined quantities WHEN any ledger value is substituted for another THEN the register fails one obligation: non-substitution. The per-quantity calculation rules are separate owners; 'no shared mutable salary field' is implementation instruction (process material, not carried); the explicit-date fragment duplicates the historical L01.1 obligation and is deferred to R6 | CBA2-A01.1 | R3 / this checkpoint |
| DR2-0002 | `ATOM` | CBA2-A02 construction; historical CBA-A02.4, CBA-A09.2/.3/.4, CBA-A10.1 | Split per signed enumeration | Enumeration floor + mixed-verdict test | Each §6(j)(1) path splits into structure, money limit, and (Standard) window because an implementation can pass one and fail another independently; §6(j)(2), (3), (7), (8) are separately enumerated rules; historical bundles (A02.4, A09.3, A09.4) split into those fragments | CBA2-A02.1–.14 | R3 / this checkpoint |
| DR2-0003 | `ATOM` | CBA2-A03 construction; historical CBA-A03.1–.5, CBA-A04, CBA-A05.1/.2, CBA-A06.1/.2, CBA-A08.1/.2 | Split windows; keep conjunctive-trigger rules whole | Mixed-verdict test; conjunctive-trigger clarification | §6(j)(6)'s general rule and its (i)/(iii) carve-outs are independently violable; §6(j)(5) (base-year) and §8(g) (poison pill) each state one conjunctive trigger with one deemed result and stay single LEAFs; the §8(g)(i)-(ii) input assumptions are a separately violable computation contract (CBA2-A03.6); the 'test at 0%/25%/100%' clause in historical A03.1 is testing instruction (process material, not carried) | CBA2-A03.1–.8 | R3 / this checkpoint |
| DR2-0004 | `ATOM` | CBA2-A04 construction; historical CBA-A07.1–.9 | Split per XXIV §2(a)/VII §3(b)/VIII §1(d) enumeration | Enumeration floor + mixed-verdict test | Amount cap/form, single payability, allocation, rookie deemed amendment, reduction amendment, renegotiation bar, assignor payment, and receiving-side effect are independently pass/fail-able; historical A07.2's five-clause bundle splits accordingly | CBA2-A04.1–.8 | R3 / this checkpoint |
| DR2-0005 | `ATOM` | CBA2-A05 construction; historical CBA-A12.1–.10, CBA-A13, CBA-A14.1–.4, CBA-A18.2/.8 | Split into general test, general hard cap, per-row assignments, TMLE bar, dual-year rules | Enumeration floor (the table enumerates rows; (A)/(B) are two rules) | §2(e)(2)(i)(A) and (B) are distinct obligations (a validator can gate correctly yet drop the persistent cap); each table row is a separately enforceable level assignment; CBA2-A05.17 uses the homogeneous-list exception — one enumerated computation contract whose separate per-assumption verdicts would be artificial, with evidence (EV2-0054) quoting every listed element (A)-(D) plus the level-carrying rule | CBA2-A05.1–.18 | R3 / this checkpoint |
| DR2-0006 | `ATOM` | CBA2-A06 construction; historical CBA-A10.2/.3, CBA-A21 | Split bar from carve-out; keep stacking rule whole | Exception-split rule; conjunctive-trigger clarification | The December 16 carve-out is a separately violable exception to the two-month bar (scenario variants (c1)/(c2) differ only on it); the minimum-stacking rule is one prohibition with a three-condition conjunctive trigger whose classification definition is constitutive (kept whole) | CBA2-A06.1–.3 | R3 / this checkpoint |
| DR2-0007 | `ATOM` | CBA2-A07 construction; historical CBA-A19.1–.5 | Split per §8(e)(1) enumerated conditions; numeric bounds split | Enumeration floor; numeric-bounds rule | Conditions (i)-(vii) are independently violable; the term range in (ii) splits into minimum and maximum bounds because each can fail independently; §8(e)(3)'s Exhibit 6 bar is its own enumerated rule | CBA2-A07.1–.9 | R3 / this checkpoint |
| DR2-0008 | `ATOM` | CBA2-A08 construction; historical CBA-A18.1/.3–.7 | Split per direction and per §8(a) clause | Mixed-verdict test | The paid and received limits are separate quantities that fail independently (the §8(a) example exhausts each direction separately); the signing-bonus-as-cash rule, the Salary-Cap-Year charging rule, and the no-Team-Salary-effect rule are each independently violable | CBA2-A08.1–.5 | R3 / this checkpoint |
| DR2-0009 | `ATOM` | CBA2-A09 construction; historical CBA-A16 | Keep as one LEAF | Mixed-verdict test | One validity precondition with one outcome (the Trade Call is or is not conducted); the express text already accounts for the transaction's own player movement | CBA2-A09.1 | R3 / this checkpoint |
| DR2-0010 | `ATOM` | CBA2-A10 construction; historical CBA-A20.1–.5 | Split per §8(e)(2)/§7(a)(3)(iii)/§5(a)(4)/§8(f)(i) enumeration | Enumeration floor + mixed-verdict test | Mechanism, window, term, salary ceiling, raise limit, §7(a) eligibility, and the two six-month bars are independently pass/fail-able; the two §8(f)(i) sentences run in opposite directions and split | CBA2-A10.1–.8 | R3 / this checkpoint |
| DR2-0011 | `ATOM` | CBA2-A11 construction; historical CBA-A11 | Keep as one LEAF with two evidence components | Mixed-verdict test | One algorithmic obligation with one result (a legal per-team decomposition or a reasoned failure); the express structural component and the INFERRED procedure component are separate EV2 rows (EV2-0082/0083) per the binding A11 treatment — not DERIVED, no composite label | CBA2-A11.1 | R3 / this checkpoint |
| DR2-0012 | `ATOM` | CBA2-A12 construction; historical CBA-A17.1/.2/.5/.6 | Split per BYL 7.03 clauses and CBA §2(f) rules | Enumeration floor + mixed-verdict test | The cash-sale bar and the Stepien test are two prohibitions in one BYL sentence; conveyance validity, the frozen-pick bar, and the unfreeze re-permission are independently violable; pick-ledger representation fragments are deferred to the L-family (R6) | CBA2-A12.1–.5 | R3 / this checkpoint |
| DR2-0013 | `OWN` | CBA-A18.2, CBA-A18.8 (adjudication queue) | One owner: CBA2-A05.11 (row I) | Tiebreak 2 (substantive anchor) | Both historical rows state the row-I prohibition; the Transaction Restrictions Table anchor (§2(e)(4) row I) is the substantive owner; A18.2's post-transaction-test fragment is owned by CBA2-A05.1 | CBA2-A05.11 | R3 / this checkpoint |
| DR2-0014 | `OWN` | CBA-A02.1, CBA-A02.5, CBA-A02.4 (formula fragment), CBA-A02.3, CBA-A02.6 (adjudication queue A02.1↔A02.5+A02.6; A02.2↔A02.8) | One owner: CBA2-A02.8; A02.3 and A02.6 are process rows | Tiebreak 3 (most complete statement of trigger and result) | CBA2-A02.8 carries the formula, inputs, and no-hard-coding contract; historical A02.3 (a negative correction note about remembered tiers) and A02.6 (a UI-derivation instruction) are process/correction material and own no obligation | CBA2-A02.8 | R3 / this checkpoint |
| DR2-0015 | `OWN` | CBA-A02.2, CBA-A02.8 | One owner: CBA2-A02.12 | Tiebreak 2 (substantive anchor §6(j)(3)) | Both rows state the $250K-to-$0 rule; the §6(j)(3) anchor owns it once with the post-assignment Apron Team Salary basis | CBA2-A02.12 | R3 / this checkpoint |
| DR2-0016 | `OWN` | CBA-A03.1, CBA-A03.2, CBA-A03.3 (adjudication queue A03.1↔A03.3) | One owner: CBA2-A03.1 | Tiebreak 3 (most complete with least extraneous text) | Window 1 (protected remainder) and window 2 (salary less unearned unprotected) are the same §6(j)(6) general reduction applied before and during the season; one general LEAF plus the express (i)/(iii) carve-outs represents the signed structure | CBA2-A03.1 | R3 / this checkpoint |
| DR2-0017 | `OWN` | CBA-A05.1, CBA-A05.2 (adjudication queue) | One owner: CBA2-A03.5 | Tiebreak 3 | Trigger row and formula row state one rule (§8(g)); the single LEAF carries trigger plus deemed average; the §8(g)(i)-(ii) input assumptions were never stated historically and are newly certified as CBA2-A03.6 | CBA2-A03.5 | R3 / this checkpoint |
| DR2-0018 | `OWN` | CBA-A06.1, CBA-A06.2 (adjudication queue) | One owner: CBA2-A03.7 | Tiebreak 3 | Both rows state the preceding-season/team-change re-test; one LEAF owns it with the express test and the INFERRED per-side application as separate components | CBA2-A03.7 | R3 / this checkpoint |
| DR2-0019 | `OWN` | CBA-A07.2 (cap/form fragment), CBA-A07.4, CBA-A07.7 (adjudication queue A07.2↔A07.4) | One owner: CBA2-A04.1 | Tiebreak 2 (substantive anchor XXIV §2(a)(ii)-(iii)) | A07.4 and the A07.2 fragment restate the 15% cap and forms; A07.7's percentage-basis claim is owned here with its basis corrected to remaining-to-be-earned Base Compensation (source-law correction; see the amendment log) | CBA2-A04.1 | R3 / this checkpoint |
| DR2-0020 | `OWN` | CBA-A07.2 (paid-once fragment), CBA-A07.5 | One owner: CBA2-A04.2 | Tiebreak 3 | A07.5 states the single-trigger rule completely (initial sign-and-trade exception; later trade consumes) | CBA2-A04.2 | R3 / this checkpoint |
| DR2-0021 | `OWN` | CBA-A07.2 (allocation fragment), CBA-A07.8 (allocation fragment); cross-family candidate with historical CBA-C18 (general signing-bonus allocation) | One owner: CBA2-A04.3; cross-family boundary recorded | Tiebreak 1 (natural series family) | The trade-earned application is trade correctness (A family); the general §3(b)(2) signing-bonus regime remains Cap Manager substance whose historical owner C18 is crosswalked by R5 (families A and C; resolving unit R5) | CBA2-A04.3 | R3 / this checkpoint |
| DR2-0022 | `OWN` | CBA-A07.2 (payer fragment), CBA-A07.9 | One owner: CBA2-A04.7 | Tiebreak 3 | A07.9 states payer and cap-side completely; the UPC Exhibit 4 passage is the certified basis | CBA2-A04.7 | R3 / this checkpoint |
| DR2-0023 | `OWN` | CBA-A08.1, CBA-A08.2 (adjudication queue) | One owner: CBA2-A03.8 | Tiebreak 3 | A08.2 states the trade-value rule completely; A08.1's contract-shape and proration fragments are Cap Manager substance (families A and C; resolving unit R4) | CBA2-A03.8 | R3 / this checkpoint |
| DR2-0024 | `OWN` | CBA-A12.3, CBA-A12.10 (adjudication queue A12.10↔A12.3+A13) | One owner: CBA2-A05.5 (row C) | Tiebreak 2 (Transaction Restrictions Table anchor) | Both rows state the row-C assignment; A12.10's hard-cap fragment is owned by CBA2-A05.2 | CBA2-A05.5 | R3 / this checkpoint |
| DR2-0025 | `OWN` | CBA-A13, CBA-A12.10 (hard-cap fragment), CBA-A02.4 (hard-cap fragment), CBA-A09.1 (hard-cap fragment) | One owner: CBA2-A05.2 | Tiebreak 3 (§2(e)(2)(i)(B) states the general rule) | The hard cap is one general rule parameterized by the row's Applicable Apron Level — including Second-Apron rows, which historical A13 (First-Apron-only wording) under-stated | CBA2-A05.2 | R3 / this checkpoint |
| DR2-0026 | `OWN` | CBA-A14.1, CBA-A14.2 (adjudication queue) | One owner: CBA2-A05.15 | Tiebreak 3 | The type-gating claim (A14.1) and the dual-year test (A14.2) are one §2(e)(2)(ii)(A) rule expressly limited to rows E-J | CBA2-A05.15 | R3 / this checkpoint |
| DR2-0027 | `OWN` | CBA-A12.1–.9, CBA-A18.2, CBA-A02.4, CBA-A09.1 (post-transaction-test fragments) | One owner: CBA2-A05.1 | Tiebreak 3 (§2(e)(2)(i)(A) states the one test) | Each historical per-row prohibition embeds the same post-transaction test; the general-test LEAF owns it once; each row LEAF owns only its level assignment | CBA2-A05.1 | R3 / this checkpoint |
| DR2-0028 | `OWN` | CBA-A09.3 (structure fragment), CBA-A10.1 (multi-incoming fragment) | One owner: CBA2-A02.1 | Tiebreak 2 (§6(j)(1)(i) anchor) | The one-out/multi-in permission is the Standard path's express structure | CBA2-A02.1 | R3 / this checkpoint |
| DR2-0029 | `OWN` | CBA-A09.3 (window fragment), CBA-A09.5 (window reminder) | One owner: CBA2-A02.3 | Tiebreak 2 (§6(j)(1)(i) proviso anchor) | The one-year non-simultaneous window is stated once by the proviso | CBA2-A02.3 | R3 / this checkpoint |
| DR2-0030 | `OWN` | CBA-A12.6, CBA-A09.5 (row F fragments) | One owner: CBA2-A05.8 | Tiebreak 2 (Transaction Restrictions Table row F anchor) | A09.5's aged-TPE timing is row F's definition; its window reminder belongs to CBA2-A02.3 | CBA2-A05.8 | R3 / this checkpoint |
| DR2-0031 | `OWN` | CBA-A12.7, CBA-A09.4 (row H fragment), CBA-A10.1 (row H scope fragment) | One owner: CBA2-A05.10 | Tiebreak 2 (row H anchor) | Row H owns the Second-Apron assignment; the no-aggregation scope clarification lives in row H's notes and CBA2-A02.1 | CBA2-A05.10 | R3 / this checkpoint |
| DR2-0032 | `OWN` | CBA-A10.2, CBA-A10.3 (two-month-bar fragments) | One owner: CBA2-A06.1 (bar) and CBA2-A06.2 (carve-out) | Tiebreak 3 | A10.3's re-aggregation sentence duplicates the §6(j)(4)(i) bar; its base-year fragment belongs to CBA2-A03.4 | CBA2-A06.1 | R3 / this checkpoint |
| DR2-0033 | `OWN` | CBA-A04 (whole), CBA-A10.3 (base-year fragment) | One owner: CBA2-A03.4 | Tiebreak 3 | A04 states the base-year rule completely including the reimbursed-minimum clause | CBA2-A03.4 | R3 / this checkpoint |
| DR2-0034 | `OWN` | CBA-A17.5 (Stepien fragment), CBA-A17.6 | One owner: CBA2-A12.3 | Tiebreak 3 | A17.6's all-branch requirement is the INFERRED 'may' semantics of the one BYL 7.03 test; A17.5's cash-sale fragment is owned by CBA2-A12.2 | CBA2-A12.3 | R3 / this checkpoint |
| DR2-0035 | `OWN` | CBA-A18.1, CBA-A18.4, CBA-A18.5 (cash-limit fragments) | Owners: CBA2-A08.1 and CBA2-A08.2 | Tiebreak 3 (§8(a)'s one sentence states both limits) | Ledger representation, separate cap-indexed limits, and no-netting are the two directional limit obligations stated once each | CBA2-A08.1 | R3 / this checkpoint |
| DR2-0036 | `OWN` | CBA-A01.1, CBA-A01.2, CBA-A01.3 (ledger rows) | One owner: CBA2-A01.1 | Tiebreak 3 | One non-substitution obligation; the date-context fragment is deferred to the L-family (R6); the implementation instruction is process material | CBA2-A01.1 | R3 / this checkpoint |
| DR2-0037 | `OWN` | CBA-A15.1, CBA-A15.2, CBA-A15.3, CBA-A15.4, CBA-A15.5 | No active owner; terminal `invalid` edges | §15.9.5 rule 4; §15.9.6 strict secondary-source policy | The published rows asserted OPS-authority obligations (multi-team touch test, qualifying-asset thresholds, deemed draft-rights status, graph validation) whose only support was secondary reporting; the OPS-authority/enforceability claim is false under the accepted foundation — no qualifying first-party provenance exists or existed. The reported mechanics remain preserved as unsupported operational candidates in §12.2 (discovery items, never registrable or enforceable while unsupported); no owner may be minted, and `no-successor` is unavailable because the underlying candidates are merely unsupported | — | R3 / this checkpoint |
| DR2-0038 | `OWN` | CBA-A17.3, CBA-A17.4, CBA-A17.7 | No active owner; terminal `invalid` edges | §15.9.5 rule 4; §15.9.6 strict secondary-source policy | The published rows asserted OPS-authority obligations (protection/deferral processing limits, the seven-future-draft horizon, the two-years-after-conveyance limit) supported only by secondary reporting; the OPS-authority/enforceability claims are false under the accepted foundation. The reported mechanics remain preserved as unsupported operational candidates in §13.3; BYL 7.03's real content is owned by CBA2-A12.2/.3 | — | R3 / this checkpoint |
| DR2-0039 | `ATOM` | CBA-A02.3, CBA-A02.6 | Process dispositions; terminal `process-only` edges | §15.9.4 process-material rule | A02.3 is a correction note about remembered tiers (no obligation beyond CBA2-A02.8's formula contract); A02.6 is a UI-derivation implementation instruction; both are process-shaped and may not become active rows | — | R3 / this checkpoint |
| DR2-0040 | `OWN` | CBA2-A02.14 ↔ historical CBA-C20 Two-Way trade treatment (cross-family, generator 6) | A-family owner minted: CBA2-A02.14 | Tiebreak 1 (natural series family: §6(j)(8) is TPE law) | The Two-Way §6(j) exclusion is trade correctness; Two-Way shape/eligibility stays C-family. Families A and C; the historical C20 rows' edges are recorded by R5 | CBA2-A02.14 | R3 / this checkpoint |
| DR2-0041 | `OWN` | CBA2-A03.7 ↔ historical CBA-C06 (bonus reconciliation), CBA2-A03.8 ↔ historical CBA-C13 (minimum exception), CBA2-A05.* ↔ historical CBA-C07 (Apron Salary), CBA2-A05.13/.14 ↔ historical CBA-C13 (TMLE) (cross-family, generator 6) | A-family owners minted for the trade-side rules; calculation/inventory substance stays C-family | Tiebreak 1 (natural series family) | Trade-salary re-testing, minimum-exception acquisition, apron gating, and TMLE apron rows are trade correctness; bonus-ledger reconciliation, exception shape/proration/inventory, and the Apron Team Salary computation are Cap Manager substance. Families A and C; resolving unit R4 (C01-C13) | CBA2-A03.7 | R3 / this checkpoint |
| DR2-0042 | `OWN` | CBA2-A12.4/.5 ↔ historical CBA-L08/L09 (apron history; frozen/slid representation); CBA2-A05.2 ↔ historical CBA-L07 (hard-cap storage); CBA2-A02.3 ↔ historical CBA-L06 (TPE persistence); CBA2-A09.1 ↔ historical CBA-R06 (roster capacity) (cross-family, generator 6) | A-family owners minted for the trade-legality rules; state representation stays L/R-family | Tiebreak 1 (natural series family) | The freeze/unfreeze trading rules, hard-cap enforcement, TPE window, and Trade Call room test are trade correctness; multi-season history persistence, TPE/hard-cap state storage, and standing roster limits are lifecycle/roster substance. Families A and L/R; resolving unit R6 | CBA2-A12.4 | R3 / this checkpoint |
| DR2-0043 | `ORIGIN` | CBA2-A02.11, CBA2-A02.13, CBA2-A02.14 | Newly certified; no published v1.1 A-series predecessor | Primary-source discovery during §6(j) certification | §6(j)(2) (below-cap election of the (iii)/(iv) paths), §6(j)(7) (DPE bar), and §6(j)(8) (Two-Way exclusion) are express signed rules the published A-series never owned; certified from SRC2-001 (EV2-0015/0017/0018) | CBA2-A02.11, CBA2-A02.13, CBA2-A02.14 | R3 / this checkpoint |
| DR2-0044 | `ORIGIN` | CBA2-A03.6 | Newly certified; no predecessor | Primary-source discovery during §8(g) certification | The §8(g)(i)-(ii) input assumptions were never stated by the published register; certified from SRC2-001 (EV2-0024) | CBA2-A03.6 | R3 / this checkpoint |
| DR2-0045 | `ORIGIN` | CBA2-A05.9, CBA2-A05.14, CBA2-A05.18 | Newly certified; no predecessors | Primary-source discovery during §2(e) certification | Row G, the §2(e)(2)(iii) TMLE-usage bar, and the §2(e)(5) 2023-24 exemption are express enumerated rules with no published A-series owner; certified from SRC2-001 (EV2-0046/0051/0055) | CBA2-A05.9, CBA2-A05.14, CBA2-A05.18 | R3 / this checkpoint |
| DR2-0046 | `ORIGIN` | CBA2-A07.7, CBA2-A07.9 | Newly certified; no predecessors | Primary-source discovery during §8(e) certification | Condition (vi) (Higher Max 25% limit) and §8(e)(3) (Exhibit 6 bar) are express sign-and-trade rules with no published A-series owner; certified from SRC2-001 (EV2-0065/0067) | CBA2-A07.7, CBA2-A07.9 | R3 / this checkpoint |
| DR2-0047 | `ORIGIN` | CBA2-A12.5 | Newly certified; no predecessor | Primary-source discovery during §2(f) certification | The §2(f)(2)(ii)(B) unfreeze re-permission had no published A-series owner (historical A17.1 carried only the frozen/slid state fragment); certified from SRC2-001 (EV2-0089) | CBA2-A12.5 | R3 / this checkpoint |

## 12. Mandatory duplicate-candidate generation — all seven generators

The union below is preserved in full; every candidate carries an `OWN`
disposition or a named cross-family deferral (both families and the
resolving unit named). Zero in-scope candidates are undispositioned. No
generator produced zero candidates, and mechanical similarity only
generated candidates — every disposition above is a recorded semantic
decision with its discriminating tiebreak (U5/U6).

**Generator 1 — Adjudication known A-series duplicate queue** (10 candidates):

- CBA-A18.2↔CBA-A18.8 → DR2-0013
- CBA-A02.1↔(CBA-A02.5+CBA-A02.6) → DR2-0014
- CBA-A02.2↔CBA-A02.8 → DR2-0015
- CBA-A03.1↔CBA-A03.3 → DR2-0016
- CBA-A05.1↔CBA-A05.2 → DR2-0017
- CBA-A06.1↔CBA-A06.2 → DR2-0018
- CBA-A07.2↔CBA-A07.4 → DR2-0019
- CBA-A08.1↔CBA-A08.2 → DR2-0023
- CBA-A12.10↔(CBA-A12.3+CBA-A13) → DR2-0024/DR2-0025
- CBA-A14.1↔CBA-A14.2 → DR2-0026

**Generator 2 — Normalized requirement-text similarity (mechanical sweep over the 89 published rows and the 81 active rows)** (7 candidates):

- CBA-A03.1↔CBA-A03.2 (protected-amount phrasing) → DR2-0016
- CBA-A07.7↔CBA-A07.4 (15%/remaining-compensation phrasing) → DR2-0019
- CBA-A09.3↔CBA-A12.6 (Standard TPE timing phrasing) → DR2-0030
- CBA-A09.4↔CBA-A12.7 (aggregated/Second Apron phrasing) → DR2-0031
- CBA-A10.2↔CBA-A10.3 (two-month/aggregation phrasing) → DR2-0032
- CBA-A18.4↔CBA-A18.5 (netting/limit phrasing) → DR2-0035
- CBA-A17.5↔CBA-A17.6 (branch-testing phrasing) → DR2-0034

**Generator 3 — Shared or overlapping primary locators** (7 candidates):

- §6(j)(1)(iv): CBA-A02.1/.4/.5 → DR2-0014
- §6(j)(3): CBA-A02.2/.8 → DR2-0015
- §6(j)(4)(i): CBA-A10.2/.3 → DR2-0032
- §6(j)(5): CBA-A04/CBA-A10.3 → DR2-0033
- §2(e)(2): CBA-A12.1–.10/CBA-A13/CBA-A14.1–.4/CBA-A18.2/.8 → DR2-0013/0024/0025/0026/0027
- §8(e)(1): CBA-A19.1–.5 with CBA-A12.3/.10 (row C) → distinct obligations (conditions vs apron row); no merge — recorded in DR2-0007/DR2-0024
- BYL 7.03: CBA-A17.5/.6 → DR2-0034

**Generator 4 — Correction-table vs substantive-anchor comparison (§3 rows against §§5-14 anchors)** (4 candidates):

- §3 'Expanded TPE boundaries' row ↔ §12.4 formula → CBA-A02.1 disposition (DR2-0014)
- §3 '$250K TPE allowance test' row ↔ §12.5 → CBA-A02.2 disposition (DR2-0015)
- §3 'Architect's remembered trade tiers' row ↔ §12.4 → CBA-A02.3 process-only (DR2-0039)
- §3 'Post-season dual-year apron test' row ↔ §8.4 → CBA-A14.1 disposition (DR2-0026)

**Generator 5 — Lifecycle/summary-ledger vs substantive-owner comparison (§4.1-§4.3 ledger rows against substantive owners)** (4 candidates):

- §4.1 ledger rows ↔ CBA-A01.1/.2/.3 → DR2-0036
- §4.1 cash-in-trade ledger row ↔ CBA-A18.1 → DR2-0035
- §4.2 rights-ledger pick row ↔ CBA-A17.1 → DR2-0012 + R6 deferral
- §4.3 open-slots row ↔ CBA-A16 → DR2-0009 (single owner; no duplicate minted)

**Generator 6 — Explicit and known cross-family pairs** (13 candidates):

- CBA2-A02.14↔historical C20 (Two-Way trade treatment) → DR2-0040 (A↔C; R5)
- CBA2-A04.3↔historical C18 (signing-bonus allocation) → DR2-0021 (A↔C; R5)
- CBA2-A03.7↔historical C06 (bonus reconciliation) → DR2-0041 (A↔C; R4)
- CBA2-A03.8↔historical C13 (Minimum Exception shape) → DR2-0041 + deferral (A↔C; R4)
- CBA2-A05.*↔historical C07 (Apron Team Salary computation) → DR2-0041 (A↔C; R4)
- CBA2-A05.13/.14↔historical C13 (TMLE) → DR2-0041 (A↔C; R4)
- CBA2-A12.4/.5↔historical L08/L09 (apron history; frozen/slid state) → DR2-0042 (A↔L; R6)
- CBA2-A05.2↔historical L07 (hard-cap storage) → DR2-0042 (A↔L; R6)
- CBA2-A02.3↔historical L06 (TPE persistence) → DR2-0042 (A↔L; R6)
- CBA2-A09.1↔historical R06 (roster capacity) → DR2-0042 (A↔R; R6)
- CBA-A01.3↔historical L01.1 (explicit date) → deferral (A↔L; R6)
- CBA-A01.4↔historical C01/C25 (Team Salary composition) → deferral (A↔C; R4)
- CBA2-A06.3↔historical S01 (minimum-scale values) → DR2-0006 note (A↔S; R6)

**Generator 7 — Reviewer-identified semantic candidates** (6 candidates):

- CBA-A09.5↔CBA-A12.6 (aged-TPE timing) → DR2-0030
- CBA-A13↔CBA-A12.10 (hard-cap statements) → DR2-0025
- CBA-A02.4↔CBA-A12.5 (row E statements) → DR2-0027
- CBA-A18.7 express fragment↔CBA-A18.4 (both cite §8(a)) → distinct obligations (charging rule vs limits); DR2-0008
- CBA-A19.5↔CBA-A12.3/.10 (sign-and-trade authority vs row C) → distinct obligations; DR2-0007/DR2-0024
- CBA-A11↔CBA2-A02.1-.9 (decomposition vs path definitions) → distinct obligations (procedure vs paths); DR2-0011

## 13. Preservation checks — mechanically proven

All hashes below were recomputed this session from the baseline
(`HEAD` = `6d9c7576…`) and from the edited working tree; every pair is
**byte-identical**. Section bytes run from the first byte of the named
heading line to the byte before the next named heading line.

| Preserved area | SHA-256 (both sides) | Continuity |
|---|---|---|
| Historical §15.1–§15.8 (from `### 15.1` to `### 15.9`) | `7b3f6aaba81129dceaa8e55f6356f8bbecd3af7e1ff59b127a443fc5d7b14d97` | Matches the R2.3/R2.4/R2.5 receipts |
| Historical scenarios 1–89 (§16, from `## 16.` to `## 17.`) | `eb11bb122840f881204be4d3de9b8a47a680a19622677e4287227730615b311f` | Matches the R2.3/R2.4/R2.5 receipts |
| Canon §5.9 (R1.2 source law, from `### 5.9` to `## 6.`) | `53c968ade8cdb2177517412ac09f2bae63ee7642cfa3b24299d2b208895fb373` | Matches the R2.3/R2.4/R2.5 receipts |
| §15.9 foundation standard (from `### 15.9` to the next heading — `## 16.` at baseline; `### 15.10` after R3) | `c8f10bae814eb8e85aff942de8aeef8e02dadf052111b5c7aa4a0aa3c65e26e5` | **§15.9 is byte-unchanged by R3** — creating §§15.10–15.12 required no cross-reference edit inside it (§15.9.2 already names the sections R3 creates) |
| Sixteen-check SC2/SXW2 block | `7a4f50c49f42dfe9ca399039ff2cabc1dd86dcbfc3490ce8ba2dd3b2d5f803cd` | Matches the R2.5 receipt; 16 enumerated checks counted before and after |

Extraction note: one prior-receipt anchor ambiguity was found and
neutralized — a naive search for the bare string `## 16.` first matches the inline
backtick-quoted mention inside §15.9.8's pinned-source sentence, not the
§16 heading; all hashes above anchor on heading **line starts**, and the
§16 value then reproduces the earlier receipts' recorded hash exactly.

Also mechanically proven: historical/corrected legacy scenarios 1–89 and
legacy `CBA-…` rows untouched (the §15.1–§15.8 and §16 hashes above);
R1.2 §5.9 unchanged (no new source-law correction required it); zero
`CBA2-C`/`CBA2-R`/`CBA2-L`/`CBA2-S` records anywhere in the new sections;
exactly the two authorized files changed (`git status`/`git diff
--name-only`); no repair-plan or earlier-receipt change; no application or
code-map work.

## 14. Unit-local gates U1–U14 (A family) — results

| # | Gate | Result | Evidence |
|---|---|---|---|
| U1 | ID grammar and uniqueness | **PASS** | Mechanical parse of §15.10–§15.12: 12 GROUP IDs, 81 LEAF IDs, 131 `XW2-…`, 4 `SRC2-…`, 89 `EV2-…`, 47 `DR2-…` — all grammar-valid, all unique |
| U2 | Fixed roles, valid GROUP parents | **PASS** | Every LEAF's prefix resolves to one of the 12 GROUP rows; GROUP rows carry no obligation/method/locator/evidence/verdict; no role conversion exists |
| U3 | Family counts recomputed mechanically | **PASS** | 12 GROUPs / 81 LEAFs recomputed by parser from the committed tables; per-GROUP distribution in §5 |
| U4 | Semantic atomicity dispositions | **PASS** | Every LEAF covered by a GROUP-scoped `ATOM` record (DR2-0001–0012) stating the GIVEN/WHEN/THEN basis, splits, keeps, and the one homogeneous-list exception (CBA2-A05.17, with all-element evidence EV2-0054) |
| U5 | Duplicate candidates — all seven generators | **PASS** | §12: the union of all seven generator populations is recorded; every candidate has an `OWN` record or a named cross-family deferral; zero undispositioned |
| U6 | Ownership tiebreaks recorded | **PASS** | Every `OWN` record names the discriminating §15.9.4 tiebreak (1, 2, or 3) and why |
| U7 | Crosswalk coverage and valid targets | **PASS** | 88/89 sources edged + 1 named deferral; all non-terminal targets resolve; deferrals listed explicitly (§10) |
| U8 | Per-LEAF evidence completeness | **PASS** | 89 EV2 rows meet their class minima; class-specific certification attested (§4.3); no source-free terminal component; no OPS/EXT component exists so the ops/ext reference rules are vacuously satisfied; every provenance-type ⇔ authority-class pairing valid; all 4 SRC2 records pass type-specific field-level validation (13 base fields; joined detail rows; per-type `—` matrix; timestamp/hash rules; `YYYY-YY` season grammar; three split verification-metadata fields under the R2.5 grammars); Authority ⇔ EV reconciliation exact in both directions for all 81 LEAFs |
| U9 | Source/dependency resolution + transitive compatibility | **PASS** | Every reference parses (`", "` grammar, ascending, no duplicates) and resolves; every evidence path terminates in a typed SRC2 record; EV2 dependency chains acyclic; complete transitive closure and terminal root set computed for all 89 components against the §15.9.6 matrix — every root `official-immutable`/`official-mutable`, zero laundering chains (no `ops-provenance`/`ext-contract` record exists), DERIVED root set = {signed CBA, two official releases}, dependency classes all permitted; zero orphan/dangling records |
| U10 | Method validity | **PASS** | Exactly one primary per LEAF (SCEN 75 / LIFECYCLE 5 / STATIC 1); secondaries distinct and disjoint from primaries; zero OPSV anywhere |
| U11 | No process-shaped active rows | **PASS** | The historical process rows (CBA-A02.3, A02.6, the A03.1 test-instruction clause, the A01.3 implementation clause) were dispositioned `process-only`/not carried; no active requirement is testing/derivation instruction |
| U12 | True gaps | **PASS (vacuous)** | Zero historical gap-assertion notes exist in the published A rows; zero `TG` records required — recorded here |
| U13 | Child-ID numbering integrity | **PASS** | Initial construction: every GROUP's children contiguous from `.1` (parser-verified); no `AMEND` event occurred, so no gap/reuse/renumbering question arises |
| U14 | Family-level adjacent-provision sweep | **PASS** | §4.2 records the sweep; per-LEAF adjacent notes carried in Notes/limitations where a proviso materially limits the rule |

Gates **not** run or claimed, per the R3 order: R7 scenario gates
(SC1–SC7), R8 global gates (G1–G15), code-map gates, Phase 2 packet
gates, application compliance verdicts, R9 acceptance.

## 15. Validation commands actually run

| Command | Exit | Result |
|---|---|---|
| `git diff --check` | 2 | One finding: the header's `**Amendment date:**` line (line 11) ends with two trailing spaces — the pre-existing markdown hard-line-break convention used by every line of that header block (verified: lines 3–12 all carry exactly two trailing spaces at baseline). The convention was preserved, not introduced; MD009 permits it. No other whitespace finding |
| `npm run lint:md` | 1 | **Pre-existing findings only.** The canon carries exactly **74** findings before and after R3 — all `MD029/ol-prefix` in the accepted §16 continuous-numbering class; the normalized before/after comparison (rule + detail, line-number-independent) is **identical** (74 = 74, zero new findings in R3's two changed files). `markdownlint` on this receipt: clean (exit 0, recorded after final write). The remaining global findings (53) are pre-existing and confined to four unrelated files (`docs/CODEBASE_MAP.md` and three `docs/architect/audits/` documents). The global exit code is a failure caused by pre-existing findings — reported truthfully, not claimed as a pass |
| `npm run docs:guardrails` | 0 | Pass |
| Targeted mechanical checks (scratchpad `validate_canon.py`, parsing the committed canon) | 0 | Historical A count (89); active GROUP/LEAF grammar and counts (12/81); initial child contiguity; XW2 source coverage (88+1), target resolution, edge types, duplicate-pair ban, terminal discipline, deferrals; SRC2 thirteen-field base rows + exactly-one matching detail rows; R2.5 season and verification-metadata grammars; EV2 reference resolution and transitive root compatibility; Authority ⇔ EV reconciliation; method-set validity; no orphan/dangling records; preservation hashes (§13); origin reciprocity; scenario-evidence `pending R7` markers |

Not run, per the R3 order and repair-plan rule 6: application tests,
builds, typecheck, ESLint, `test:diff`, and the full suite — R3 is
documentation and source-certification work only. `DR2-…` references in
the canon resolve to this receipt's §11 table (checked after final write).

## 16. Boundaries and blocked status

- No R4 work was begun; no C-, R-, L-, or S-family active record,
  crosswalk edge, or evidence row was created.
- No historical §15.1–§15.8 row, scenario, legacy `CBA-…` ID, or §15.9
  standard text was edited (§13).
- No earlier receipt, repair-plan text, README, or code-map file was
  changed; Linear was not read or written; the CBA and By-Laws PDFs were
  not committed.
- No application, test, schema, fixture, configuration, or data work.
- `main` unchanged (`69f8f6b6…`); Phase 2 and W1.1 remain blocked.
- Scenario construction (R7), global reconciliation (R8), and acceptance
  (R9) remain unperformed; no Phase 2 compliance verdict was issued
  anywhere.

**R3 is complete but not independently accepted. R4 remains blocked
pending orchestration review and an independent Codex review of the R3
checkpoint.**
