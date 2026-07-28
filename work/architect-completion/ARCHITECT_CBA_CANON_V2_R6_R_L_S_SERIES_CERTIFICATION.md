# Architect CBA Canon v2 — R6 R/L/S series source certification

## Status

R6 maker construction is complete at this checkpoint and awaits an
independent commit-specific source review. This receipt makes no checker
claim, does not authorize R7, and changes only the canon, governing plan, and
this maker receipt.

Independent review pending; R6 is not accepted.

R5 prerequisite: exact repair checkpoint `5b29995b4442eb834eb2ff5dd58d9977158f4479` was independently
**ACCEPTED** at checker commit `b58a5bc54a829dd426c3345f7a60734d80a943b4`. R6 therefore began from the
accepted checker HEAD without reopening accepted A/C content.

## Primary-source verification

- Signed 2023 NBA-NBPA CBA: 2,850,534 bytes; SHA-256
  `bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32`.
- June 2024 NBA Constitution and By-Laws: 422,247 bytes; SHA-256
  `be4d2781fe8fddfc5bc9028214298f742789a949dade4ead26368a4336d32ccf`.
- Official NBA 2025-26 regular-season schedule release, published
  2025-08-14: 117,337 bytes; SHA-256
  `fb38ea144da8f2a8b26d8b605b3d1cde165a997c722e675913f9ce696ba2f01a`.
- `SRC2-006` records the authenticated external-determination input
  contract. It does not assert that medical, expert, grievance, approval, or
  conduct findings are derivable by the product.

## Coverage

The frozen v1.1 R/L/S inventory contains 24 GROUP families and 134 historical
LEAF obligations: 47 R, 72 L, and 15 S. R6 registers 90 R,
124 L, and 27 S active LEAFs (241
total). It adds 133 whole-fragment edges `XW2-0357`–`XW2-0489`; the
accepted `XW2-0160`/`XW2-0161` split already dispositions historical
`CBA-L08.5`. Evidence is one authority component per active LEAF,
`EV2-0577`–`EV2-0817`.

| GROUP | Active LEAFs | Historical successors | New source components | Active range |
|---|---:|---:|---:|---|
| CBA2-R01 | 18 | 10 | 8 | CBA2-R01.1–CBA2-R01.18 |
| CBA2-R02 | 9 | 7 | 2 | CBA2-R02.1–CBA2-R02.9 |
| CBA2-R03 | 2 | 1 | 1 | CBA2-R03.1–CBA2-R03.2 |
| CBA2-R04 | 9 | 6 | 3 | CBA2-R04.1–CBA2-R04.9 |
| CBA2-R05 | 10 | 5 | 5 | CBA2-R05.1–CBA2-R05.10 |
| CBA2-R06 | 16 | 6 | 10 | CBA2-R06.1–CBA2-R06.16 |
| CBA2-R07 | 3 | 1 | 2 | CBA2-R07.1–CBA2-R07.3 |
| CBA2-R08 | 8 | 5 | 3 | CBA2-R08.1–CBA2-R08.8 |
| CBA2-R09 | 3 | 2 | 1 | CBA2-R09.1–CBA2-R09.3 |
| CBA2-R10 | 12 | 4 | 8 | CBA2-R10.1–CBA2-R10.12 |
| CBA2-L01 | 9 | 5 | 4 | CBA2-L01.1–CBA2-L01.9 |
| CBA2-L02 | 14 | 8 | 6 | CBA2-L02.1–CBA2-L02.14 |
| CBA2-L03 | 23 | 15 | 8 | CBA2-L03.1–CBA2-L03.23 |
| CBA2-L04 | 24 | 17 | 7 | CBA2-L04.1–CBA2-L04.24 |
| CBA2-L05 | 18 | 7 | 11 | CBA2-L05.1–CBA2-L05.18 |
| CBA2-L06 | 8 | 3 | 5 | CBA2-L06.1–CBA2-L06.8 |
| CBA2-L07 | 3 | 1 | 2 | CBA2-L07.1–CBA2-L07.3 |
| CBA2-L08 | 9 | 5 | 4 | CBA2-L08.1–CBA2-L08.9 |
| CBA2-L09 | 6 | 1 | 5 | CBA2-L09.1–CBA2-L09.6 |
| CBA2-L10 | 10 | 9 | 1 | CBA2-L10.1–CBA2-L10.10 |
| CBA2-S01 | 9 | 6 | 3 | CBA2-S01.1–CBA2-S01.9 |
| CBA2-S02 | 6 | 4 | 2 | CBA2-S02.1–CBA2-S02.6 |
| CBA2-S03 | 5 | 3 | 2 | CBA2-S03.1–CBA2-S03.5 |
| CBA2-S04 | 7 | 2 | 5 | CBA2-S04.1–CBA2-S04.7 |

Coverage includes waiver request/claim/clearance and partial claims; dead
salary, payment and Team Salary stretch, buyout and set-off; ordinary and
temporary roster/list bounds, Two-Way increments, shortage clocks and league
adjustments; explicit date/season context; guarantee, option, Extension,
Renegotiation, RFA, draft-rights, trade-window, hard-cap, TPE/DPE, pick, and
external-determination lifecycle state; season-keyed official values,
complete tables, provenance, indexed formulas, and persistent state.

## Source-law corrections

- A waiver request removes the player from the Player Lists immediately but
  does not end financial responsibility; unprotected salary terminates only
  after unclaimed clearance.
- Payment stretching (Article II §4(k)) and Team Salary stretching (VII
  §7(d)(6)) remain separate elections.
- The league-wide roster-average adjustment is direct CBA XXIX §5, not OPS.
- A Draft Pick Penalty applies to the Team's final first-round pick under
  VII §2(f); it is not represented as a generic slide of whichever pick was
  first frozen.
- EIPPA is season-dependent under its signed table/indexing source and is not
  a permanent $0.900 million value.
- Official, derived, inferred, and unavailable inputs remain distinct.
  No qualifying `ops-provenance` record was located or invented.

## Deferred-fragment exits

All five R6-deferred areas exit through `DR2-0124` AMEND lineage:

| Deferred area | Existing edge(s) | R6 owner |
|---|---|---|
| A01.3 explicit date/season context | XW2-0150 | CBA2-L01.1 |
| A17.1 pick ledger and conveyance dependencies | XW2-0148, XW2-0149 | CBA2-L09.1, CBA2-L09.4 |
| C11.2 persisted DPE state | XW2-0235 | CBA2-L06.4 |
| C11.2/C11.9 DPE extinguishment | XW2-0153, XW2-0239 | CBA2-L06.5 |
| C12.2 pre-use return/trade extinguishment | XW2-0255 | CBA2-L06.5 |

Accepted A/C LEAF, detail, evidence, and owner rows remain unchanged. The new
L owners reference accepted A/C direct owners as dependencies where needed.

## Atomicity and duplicate ownership

The seven required duplicate-candidate generators were applied to the known
queue, normalized text, shared locators, correction/substantive anchors,
lifecycle summaries, cross-family pairs, and source-review findings. Every
historical fragment selects one natural R/L/S successor except the previously
accepted L08.5 split. Broad historical implementation statements route to
explicit staged aggregate rows whose direct components remain separately
auditable. No unresolved duplicate candidate or same-family deferral remains.

## Decision records

| DR ID | Type | Subject(s) | Disposition | Test/tiebreak applied | Rationale | Resulting active LEAF(s) or — | Unit/commit |
|---|---|---|---|---|---|---|---|
| DR2-0124 | `AMEND` | XW2-0148, XW2-0149, XW2-0150, XW2-0153, XW2-0235, XW2-0239, XW2-0255 | Exit every R6-designated deferral through forward lineage | Resolving-unit, natural-family, and exact-fragment reconciliation | R6 supplies explicit date context, pick-ledger state, DPE persisted state, and DPE return/trade extinguishment owners without changing accepted A/C rows | — | R6 / this checkpoint |
| DR2-0125 | `ATOM` | R6 R-series active construction | Split independently changeable waiver, compensation, roster, clock, usage, and externally determined roster results; keep only explicit staged state aggregates | GIVEN fixed facts, WHEN one legal input changes, THEN one direct result changes | Each R LEAF has one current result and evidence component; staged state rows depend on the direct source components | CBA2-R01.1, CBA2-R01.2, CBA2-R01.3, CBA2-R01.4, CBA2-R01.5, CBA2-R01.6, CBA2-R01.7, CBA2-R01.8, CBA2-R01.9, CBA2-R01.10, CBA2-R01.11, CBA2-R01.12, CBA2-R01.13, CBA2-R01.14, CBA2-R01.15, CBA2-R01.16, CBA2-R01.17, CBA2-R01.18, CBA2-R02.1, CBA2-R02.2, CBA2-R02.3, CBA2-R02.4, CBA2-R02.5, CBA2-R02.6, CBA2-R02.7, CBA2-R02.8, CBA2-R02.9, CBA2-R03.1, CBA2-R03.2, CBA2-R04.1, CBA2-R04.2, CBA2-R04.3, CBA2-R04.4, CBA2-R04.5, CBA2-R04.6, CBA2-R04.7, CBA2-R04.8, CBA2-R04.9, CBA2-R05.1, CBA2-R05.2, CBA2-R05.3, CBA2-R05.4, CBA2-R05.5, CBA2-R05.6, CBA2-R05.7, CBA2-R05.8, CBA2-R05.9, CBA2-R05.10, CBA2-R06.1, CBA2-R06.2, CBA2-R06.3, CBA2-R06.4, CBA2-R06.5, CBA2-R06.6, CBA2-R06.7, CBA2-R06.8, CBA2-R06.9, CBA2-R06.10, CBA2-R06.11, CBA2-R06.12, CBA2-R06.13, CBA2-R06.14, CBA2-R06.15, CBA2-R06.16, CBA2-R07.1, CBA2-R07.2, CBA2-R07.3, CBA2-R08.1, CBA2-R08.2, CBA2-R08.3, CBA2-R08.4, CBA2-R08.5, CBA2-R08.6, CBA2-R08.7, CBA2-R08.8, CBA2-R09.1, CBA2-R09.2, CBA2-R09.3, CBA2-R10.1, CBA2-R10.2, CBA2-R10.3, CBA2-R10.4, CBA2-R10.5, CBA2-R10.6, CBA2-R10.7, CBA2-R10.8, CBA2-R10.9, CBA2-R10.10, CBA2-R10.11, CBA2-R10.12 | R6 / this checkpoint |
| DR2-0126 | `OWN` | Published R-family historical fragments | Route every exhaustive historical R statement to its source-certified direct or staged R owner | Natural family, substantive anchor, completeness, then stable-ID tiebreak | XW2-0357 onward resolves all 47 historical R rows without reopening accepted A/C identities | CBA2-R01.1, CBA2-R01.2, CBA2-R01.3, CBA2-R01.4, CBA2-R01.5, CBA2-R01.6, CBA2-R01.7, CBA2-R01.8, CBA2-R01.9, CBA2-R01.10, CBA2-R02.1, CBA2-R02.2, CBA2-R02.3, CBA2-R02.4, CBA2-R02.5, CBA2-R02.6, CBA2-R02.7, CBA2-R03.1, CBA2-R04.1, CBA2-R04.2, CBA2-R04.3, CBA2-R04.4, CBA2-R04.5, CBA2-R04.6, CBA2-R05.1, CBA2-R05.2, CBA2-R05.3, CBA2-R05.4, CBA2-R05.5, CBA2-R06.1, CBA2-R06.2, CBA2-R06.3, CBA2-R06.4, CBA2-R06.5, CBA2-R06.6, CBA2-R07.1, CBA2-R08.1, CBA2-R08.2, CBA2-R08.3, CBA2-R08.4, CBA2-R08.5, CBA2-R09.1, CBA2-R09.2, CBA2-R10.1, CBA2-R10.2, CBA2-R10.3, CBA2-R10.4 | R6 / this checkpoint |
| DR2-0127 | `ORIGIN` | Source-located R-family obligations without a sole exact historical predecessor | Register direct signed-CBA/By-Law components and authenticated EXT boundaries | True-gap versus historical-fragment test | Each listed obligation exposes a separate trigger, exception, amount, clock, or external-input boundary omitted by the historical row set | CBA2-R01.11, CBA2-R01.12, CBA2-R01.13, CBA2-R01.14, CBA2-R01.15, CBA2-R01.16, CBA2-R01.17, CBA2-R01.18, CBA2-R02.8, CBA2-R02.9, CBA2-R03.2, CBA2-R04.7, CBA2-R04.8, CBA2-R04.9, CBA2-R05.6, CBA2-R05.7, CBA2-R05.8, CBA2-R05.9, CBA2-R05.10, CBA2-R06.7, CBA2-R06.8, CBA2-R06.9, CBA2-R06.10, CBA2-R06.11, CBA2-R06.12, CBA2-R06.13, CBA2-R06.14, CBA2-R06.15, CBA2-R06.16, CBA2-R07.2, CBA2-R07.3, CBA2-R08.6, CBA2-R08.7, CBA2-R08.8, CBA2-R09.3, CBA2-R10.5, CBA2-R10.6, CBA2-R10.7, CBA2-R10.8, CBA2-R10.9, CBA2-R10.10, CBA2-R10.11, CBA2-R10.12 | R6 / this checkpoint |
| DR2-0128 | `ATOM` | R6 L-series active construction | Split independently changeable date, rights, restriction, exception-state, pick-state, and external-determination results; keep only explicit staged ledgers | GIVEN fixed facts, WHEN one lifecycle input changes, THEN one direct state/result changes | Each L LEAF has one current result and evidence component; ledger aggregates depend on direct A/C/L owners | CBA2-L01.1, CBA2-L01.2, CBA2-L01.3, CBA2-L01.4, CBA2-L01.5, CBA2-L01.6, CBA2-L01.7, CBA2-L01.8, CBA2-L01.9, CBA2-L02.1, CBA2-L02.2, CBA2-L02.3, CBA2-L02.4, CBA2-L02.5, CBA2-L02.6, CBA2-L02.7, CBA2-L02.8, CBA2-L02.9, CBA2-L02.10, CBA2-L02.11, CBA2-L02.12, CBA2-L02.13, CBA2-L02.14, CBA2-L03.1, CBA2-L03.2, CBA2-L03.3, CBA2-L03.4, CBA2-L03.5, CBA2-L03.6, CBA2-L03.7, CBA2-L03.8, CBA2-L03.9, CBA2-L03.10, CBA2-L03.11, CBA2-L03.12, CBA2-L03.13, CBA2-L03.14, CBA2-L03.15, CBA2-L03.16, CBA2-L03.17, CBA2-L03.18, CBA2-L03.19, CBA2-L03.20, CBA2-L03.21, CBA2-L03.22, CBA2-L03.23, CBA2-L04.1, CBA2-L04.2, CBA2-L04.3, CBA2-L04.4, CBA2-L04.5, CBA2-L04.6, CBA2-L04.7, CBA2-L04.8, CBA2-L04.9, CBA2-L04.10, CBA2-L04.11, CBA2-L04.12, CBA2-L04.13, CBA2-L04.14, CBA2-L04.15, CBA2-L04.16, CBA2-L04.17, CBA2-L04.18, CBA2-L04.19, CBA2-L04.20, CBA2-L04.21, CBA2-L04.22, CBA2-L04.23, CBA2-L04.24, CBA2-L05.1, CBA2-L05.2, CBA2-L05.3, CBA2-L05.4, CBA2-L05.5, CBA2-L05.6, CBA2-L05.7, CBA2-L05.8, CBA2-L05.9, CBA2-L05.10, CBA2-L05.11, CBA2-L05.12, CBA2-L05.13, CBA2-L05.14, CBA2-L05.15, CBA2-L05.16, CBA2-L05.17, CBA2-L05.18, CBA2-L06.1, CBA2-L06.2, CBA2-L06.3, CBA2-L06.4, CBA2-L06.5, CBA2-L06.6, CBA2-L06.7, CBA2-L06.8, CBA2-L07.1, CBA2-L07.2, CBA2-L07.3, CBA2-L08.1, CBA2-L08.2, CBA2-L08.3, CBA2-L08.4, CBA2-L08.5, CBA2-L08.6, CBA2-L08.7, CBA2-L08.8, CBA2-L08.9, CBA2-L09.1, CBA2-L09.2, CBA2-L09.3, CBA2-L09.4, CBA2-L09.5, CBA2-L09.6, CBA2-L10.1, CBA2-L10.2, CBA2-L10.3, CBA2-L10.4, CBA2-L10.5, CBA2-L10.6, CBA2-L10.7, CBA2-L10.8, CBA2-L10.9, CBA2-L10.10 | R6 / this checkpoint |
| DR2-0129 | `OWN` | Published L-family historical fragments except accepted CBA-L08.5 fragments | Route each exhaustive historical statement to its source-certified direct or staged owner while reusing accepted XW2-0160 and XW2-0161 | Natural family, substantive anchor, completeness, then stable-ID tiebreak | The new edges resolve 71 historical L rows; accepted split edges already resolve CBA-L08.5 to A12 owners | CBA2-L01.1, CBA2-L01.2, CBA2-L01.3, CBA2-L01.4, CBA2-L01.5, CBA2-L02.1, CBA2-L02.2, CBA2-L02.3, CBA2-L02.4, CBA2-L02.5, CBA2-L02.6, CBA2-L02.7, CBA2-L02.8, CBA2-L03.1, CBA2-L03.2, CBA2-L03.3, CBA2-L03.4, CBA2-L03.5, CBA2-L03.6, CBA2-L03.7, CBA2-L03.8, CBA2-L03.9, CBA2-L03.10, CBA2-L03.11, CBA2-L03.12, CBA2-L03.13, CBA2-L03.14, CBA2-L03.15, CBA2-L04.1, CBA2-L04.2, CBA2-L04.3, CBA2-L04.4, CBA2-L04.5, CBA2-L04.6, CBA2-L04.7, CBA2-L04.8, CBA2-L04.9, CBA2-L04.10, CBA2-L04.11, CBA2-L04.12, CBA2-L04.13, CBA2-L04.14, CBA2-L04.15, CBA2-L04.16, CBA2-L04.17, CBA2-L05.1, CBA2-L05.2, CBA2-L05.3, CBA2-L05.4, CBA2-L05.5, CBA2-L05.6, CBA2-L05.7, CBA2-L06.1, CBA2-L06.2, CBA2-L06.3, CBA2-L07.1, CBA2-L08.1, CBA2-L08.2, CBA2-L08.3, CBA2-L08.4, CBA2-L08.5, CBA2-L09.1, CBA2-L10.1, CBA2-L10.2, CBA2-L10.3, CBA2-L10.4, CBA2-L10.5, CBA2-L10.6, CBA2-L10.7, CBA2-L10.8, CBA2-L10.9 | R6 / this checkpoint |
| DR2-0130 | `ORIGIN` | Source-located L-family obligations without a sole exact historical predecessor | Register direct lifecycle components and persisted-state requirements required by signed later-event rules | True-gap versus historical-fragment test | Each listed obligation exposes a separate date, event, restriction, ledger field, transition, or external-input boundary omitted by history | CBA2-L01.6, CBA2-L01.7, CBA2-L01.8, CBA2-L01.9, CBA2-L02.9, CBA2-L02.10, CBA2-L02.11, CBA2-L02.12, CBA2-L02.13, CBA2-L02.14, CBA2-L03.16, CBA2-L03.17, CBA2-L03.18, CBA2-L03.19, CBA2-L03.20, CBA2-L03.21, CBA2-L03.22, CBA2-L03.23, CBA2-L04.18, CBA2-L04.19, CBA2-L04.20, CBA2-L04.21, CBA2-L04.22, CBA2-L04.23, CBA2-L04.24, CBA2-L05.8, CBA2-L05.9, CBA2-L05.10, CBA2-L05.11, CBA2-L05.12, CBA2-L05.13, CBA2-L05.14, CBA2-L05.15, CBA2-L05.16, CBA2-L05.17, CBA2-L05.18, CBA2-L06.6, CBA2-L06.7, CBA2-L06.8, CBA2-L07.2, CBA2-L07.3, CBA2-L08.6, CBA2-L08.7, CBA2-L08.8, CBA2-L08.9, CBA2-L09.2, CBA2-L09.3, CBA2-L09.5, CBA2-L09.6, CBA2-L10.10 | R6 / this checkpoint |
| DR2-0131 | `ATOM` | R6 S-series active construction | Split official inputs, tables, provenance identity, CBA roster adjustments, and each independently derived amount | GIVEN fixed source records, WHEN one input or formula changes, THEN one governed value/result changes | Each S LEAF has one current provenance or derivation result and one evidence component | CBA2-S01.1, CBA2-S01.2, CBA2-S01.3, CBA2-S01.4, CBA2-S01.5, CBA2-S01.6, CBA2-S01.7, CBA2-S01.8, CBA2-S01.9, CBA2-S02.1, CBA2-S02.2, CBA2-S02.3, CBA2-S02.4, CBA2-S02.5, CBA2-S02.6, CBA2-S03.1, CBA2-S03.2, CBA2-S03.3, CBA2-S03.4, CBA2-S03.5, CBA2-S04.1, CBA2-S04.2, CBA2-S04.3, CBA2-S04.4, CBA2-S04.5, CBA2-S04.6, CBA2-S04.7 | R6 / this checkpoint |
| DR2-0132 | `OWN` | Published S-family historical fragments | Route every exhaustive historical S statement to a source-certified provenance or formula owner | Natural family, source authority, completeness, then stable-ID tiebreak | The new edges resolve all 15 historical S rows and correct the OPS roster-adjustment and fixed-EIPPA claims | CBA2-S01.1, CBA2-S01.2, CBA2-S01.3, CBA2-S01.4, CBA2-S01.5, CBA2-S01.6, CBA2-S02.1, CBA2-S02.2, CBA2-S02.3, CBA2-S02.4, CBA2-S03.1, CBA2-S03.2, CBA2-S03.3, CBA2-S04.1, CBA2-S04.2 | R6 / this checkpoint |
| DR2-0133 | `ORIGIN` | Source-located S-family obligations without a sole exact historical predecessor | Register complete table, version, formula, and election components omitted by history | True-gap versus historical-fragment test | Each listed obligation exposes a separately auditable source, table, formula, rounding, or provenance result | CBA2-S01.7, CBA2-S01.8, CBA2-S01.9, CBA2-S02.5, CBA2-S02.6, CBA2-S03.4, CBA2-S03.5, CBA2-S04.3, CBA2-S04.4, CBA2-S04.5, CBA2-S04.6, CBA2-S04.7 | R6 / this checkpoint |

## AMEND detail rows

| AMEND record ID | Population | Prior record ID | Prior version or — | Prior checkpoint commit | Action | Current record ID(s) or — | Current version(s) or — | Reason |
|---|---|---|---|---|---|---|---|---|
| DR2-0124 | XW2 | XW2-0148 | — | b58a5bc54a829dd426c3345f7a60734d80a943b4 | revise | XW2-0148 | — | Exit the A17.1 pick-ledger representation deferral through the R6 dated pick-ledger owner CBA2-L09.1. |
| DR2-0124 | XW2 | XW2-0149 | — | b58a5bc54a829dd426c3345f7a60734d80a943b4 | revise | XW2-0149 | — | Exit the A17.1 conveyance-dependency representation deferral through the R6 dated pick-ledger owner CBA2-L09.4. |
| DR2-0124 | XW2 | XW2-0150 | — | b58a5bc54a829dd426c3345f7a60734d80a943b4 | revise | XW2-0150 | — | Exit the A01.3 explicit-date lifecycle deferral through the R6 as-of-date owner CBA2-L01.1. |
| DR2-0124 | XW2 | XW2-0153 | — | b58a5bc54a829dd426c3345f7a60734d80a943b4 | revise | XW2-0153 | — | Exit the C11.9 DPE-extinction deferral through the R6 return/trade extinguishment owner CBA2-L06.5. |
| DR2-0124 | XW2 | XW2-0235 | — | b58a5bc54a829dd426c3345f7a60734d80a943b4 | revise | XW2-0235 | — | Exit the C11.2 persisted-DPE-state deferral through the R6 DPE-state owner CBA2-L06.4. |
| DR2-0124 | XW2 | XW2-0239 | — | b58a5bc54a829dd426c3345f7a60734d80a943b4 | revise | XW2-0239 | — | Exit the C11.2 DPE-extinguishment deferral through the R6 return/trade extinguishment owner CBA2-L06.5. |
| DR2-0124 | XW2 | XW2-0255 | — | b58a5bc54a829dd426c3345f7a60734d80a943b4 | revise | XW2-0255 | — | Exit the C12.2 pre-use return/trade deferral through the R6 return/trade extinguishment owner CBA2-L06.5. |

## Fragment inventory

These rows cover all 133 newly routed published R/L/S obligations. Historical
`CBA-L08.5` retains its accepted two-fragment inventory and split edges and
is not duplicated.

| Fragment ID | Historical parent LEAF | Fragment kind | Historical authority qualifier or — | Normalized fragment scope | Decomposition decision record | Disposition bundle ID or — | Disposition edge ID(s) | Fragment status | Fragment version | Limitations or — |
|---|---|---|---|---|---|---|---|---|---|---|
| CBA-R01.1:F1 | CBA-R01.1 | substantive-obligation | — | span:0-56 | DR2-0126 | — | XW2-0357 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R01.2:F1 | CBA-R01.2 | substantive-obligation | — | span:0-77 | DR2-0126 | — | XW2-0358 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R01.3:F1 | CBA-R01.3 | substantive-obligation | — | span:0-64 | DR2-0126 | — | XW2-0359 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R01.4:F1 | CBA-R01.4 | substantive-obligation | — | span:0-96 | DR2-0126 | — | XW2-0360 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R01.5:F1 | CBA-R01.5 | substantive-obligation | — | span:0-83 | DR2-0126 | — | XW2-0361 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R01.6:F1 | CBA-R01.6 | substantive-obligation | — | span:0-74 | DR2-0126 | — | XW2-0362 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R01.7:F1 | CBA-R01.7 | substantive-obligation | — | span:0-63 | DR2-0126 | — | XW2-0363 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R01.8:F1 | CBA-R01.8 | substantive-obligation | — | span:0-81 | DR2-0126 | — | XW2-0364 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R01.9:F1 | CBA-R01.9 | substantive-obligation | — | span:0-80 | DR2-0126 | — | XW2-0365 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R01.10:F1 | CBA-R01.10 | substantive-obligation | — | span:0-87 | DR2-0126 | — | XW2-0366 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R02.1:F1 | CBA-R02.1 | substantive-obligation | — | span:0-96 | DR2-0126 | — | XW2-0367 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R02.2:F1 | CBA-R02.2 | substantive-obligation | — | span:0-104 | DR2-0126 | — | XW2-0368 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R02.3:F1 | CBA-R02.3 | substantive-obligation | — | span:0-112 | DR2-0126 | — | XW2-0369 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R02.4:F1 | CBA-R02.4 | substantive-obligation | — | span:0-98 | DR2-0126 | — | XW2-0370 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R02.5:F1 | CBA-R02.5 | substantive-obligation | — | span:0-122 | DR2-0126 | — | XW2-0371 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R02.6:F1 | CBA-R02.6 | substantive-obligation | — | span:0-111 | DR2-0126 | — | XW2-0372 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R02.7:F1 | CBA-R02.7 | substantive-obligation | — | span:0-135 | DR2-0126 | — | XW2-0373 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R03:F1 | CBA-R03 | substantive-obligation | — | span:0-96 | DR2-0126 | — | XW2-0374 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R04.1:F1 | CBA-R04.1 | substantive-obligation | — | span:0-91 | DR2-0126 | — | XW2-0375 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R04.2:F1 | CBA-R04.2 | substantive-obligation | — | span:0-162 | DR2-0126 | — | XW2-0376 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R04.3:F1 | CBA-R04.3 | substantive-obligation | — | span:0-135 | DR2-0126 | — | XW2-0377 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R04.4:F1 | CBA-R04.4 | substantive-obligation | — | span:0-164 | DR2-0126 | — | XW2-0378 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R04.5:F1 | CBA-R04.5 | substantive-obligation | — | span:0-157 | DR2-0126 | — | XW2-0379 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R04.6:F1 | CBA-R04.6 | substantive-obligation | — | span:0-64 | DR2-0126 | — | XW2-0380 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R05.1:F1 | CBA-R05.1 | substantive-obligation | — | span:0-142 | DR2-0126 | — | XW2-0381 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R05.2:F1 | CBA-R05.2 | substantive-obligation | — | span:0-121 | DR2-0126 | — | XW2-0382 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R05.3:F1 | CBA-R05.3 | substantive-obligation | — | span:0-155 | DR2-0126 | — | XW2-0383 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R05.4:F1 | CBA-R05.4 | substantive-obligation | — | span:0-105 | DR2-0126 | — | XW2-0384 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R05.5:F1 | CBA-R05.5 | substantive-obligation | — | span:0-61 | DR2-0126 | — | XW2-0385 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R06.1:F1 | CBA-R06.1 | substantive-obligation | — | span:0-84 | DR2-0126 | — | XW2-0386 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R06.2:F1 | CBA-R06.2 | substantive-obligation | — | span:0-57 | DR2-0126 | — | XW2-0387 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R06.3:F1 | CBA-R06.3 | substantive-obligation | — | span:0-101 | DR2-0126 | — | XW2-0388 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R06.4:F1 | CBA-R06.4 | substantive-obligation | — | span:0-85 | DR2-0126 | — | XW2-0389 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R06.5:F1 | CBA-R06.5 | substantive-obligation | — | span:0-53 | DR2-0126 | — | XW2-0390 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R06.6:F1 | CBA-R06.6 | substantive-obligation | — | span:0-76 | DR2-0126 | — | XW2-0391 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R07:F1 | CBA-R07 | substantive-obligation | — | span:0-52 | DR2-0126 | — | XW2-0392 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R08.1:F1 | CBA-R08.1 | substantive-obligation | — | span:0-32 | DR2-0126 | — | XW2-0393 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R08.2:F1 | CBA-R08.2 | substantive-obligation | — | span:0-25 | DR2-0126 | — | XW2-0394 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R08.3:F1 | CBA-R08.3 | substantive-obligation | — | span:0-87 | DR2-0126 | — | XW2-0395 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R08.4:F1 | CBA-R08.4 | substantive-obligation | — | span:0-106 | DR2-0126 | — | XW2-0396 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R08.5:F1 | CBA-R08.5 | substantive-obligation | — | span:0-79 | DR2-0126 | — | XW2-0397 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R09.1:F1 | CBA-R09.1 | substantive-obligation | — | span:0-123 | DR2-0126 | — | XW2-0398 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R09.2:F1 | CBA-R09.2 | substantive-obligation | — | span:0-234 | DR2-0126 | — | XW2-0399 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R10.1:F1 | CBA-R10.1 | substantive-obligation | — | span:0-127 | DR2-0126 | — | XW2-0400 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R10.2:F1 | CBA-R10.2 | substantive-obligation | — | span:0-41 | DR2-0126 | — | XW2-0401 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R10.3:F1 | CBA-R10.3 | substantive-obligation | — | span:0-91 | DR2-0126 | — | XW2-0402 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-R10.4:F1 | CBA-R10.4 | substantive-obligation | — | span:0-86 | DR2-0126 | — | XW2-0403 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L01.1:F1 | CBA-L01.1 | substantive-obligation | — | span:0-70 | DR2-0129 | — | XW2-0404 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L01.2:F1 | CBA-L01.2 | substantive-obligation | — | span:0-62 | DR2-0129 | — | XW2-0405 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L01.3:F1 | CBA-L01.3 | substantive-obligation | — | span:0-77 | DR2-0129 | — | XW2-0406 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L01.4:F1 | CBA-L01.4 | substantive-obligation | — | span:0-97 | DR2-0129 | — | XW2-0407 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L01.5:F1 | CBA-L01.5 | substantive-obligation | — | span:0-303 | DR2-0129 | — | XW2-0408 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L02.1:F1 | CBA-L02.1 | substantive-obligation | — | span:0-88 | DR2-0129 | — | XW2-0409 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L02.2:F1 | CBA-L02.2 | substantive-obligation | — | span:0-46 | DR2-0129 | — | XW2-0410 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L02.3:F1 | CBA-L02.3 | substantive-obligation | — | span:0-92 | DR2-0129 | — | XW2-0411 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L02.4:F1 | CBA-L02.4 | substantive-obligation | — | span:0-117 | DR2-0129 | — | XW2-0412 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L02.5:F1 | CBA-L02.5 | substantive-obligation | — | span:0-122 | DR2-0129 | — | XW2-0413 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L02.6:F1 | CBA-L02.6 | substantive-obligation | — | span:0-52 | DR2-0129 | — | XW2-0414 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L02.7:F1 | CBA-L02.7 | substantive-obligation | — | span:0-111 | DR2-0129 | — | XW2-0415 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L02.8:F1 | CBA-L02.8 | substantive-obligation | — | span:0-97 | DR2-0129 | — | XW2-0416 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L03.1:F1 | CBA-L03.1 | substantive-obligation | — | span:0-44 | DR2-0129 | — | XW2-0417 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L03.2:F1 | CBA-L03.2 | substantive-obligation | — | span:0-105 | DR2-0129 | — | XW2-0418 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L03.3:F1 | CBA-L03.3 | substantive-obligation | — | span:0-41 | DR2-0129 | — | XW2-0419 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L03.4:F1 | CBA-L03.4 | substantive-obligation | — | span:0-102 | DR2-0129 | — | XW2-0420 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L03.5:F1 | CBA-L03.5 | substantive-obligation | — | span:0-135 | DR2-0129 | — | XW2-0421 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L03.6:F1 | CBA-L03.6 | substantive-obligation | — | span:0-80 | DR2-0129 | — | XW2-0422 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L03.7:F1 | CBA-L03.7 | substantive-obligation | — | span:0-53 | DR2-0129 | — | XW2-0423 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L03.8:F1 | CBA-L03.8 | substantive-obligation | — | span:0-89 | DR2-0129 | — | XW2-0424 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L03.9:F1 | CBA-L03.9 | substantive-obligation | — | span:0-94 | DR2-0129 | — | XW2-0425 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L03.10:F1 | CBA-L03.10 | substantive-obligation | — | span:0-116 | DR2-0129 | — | XW2-0426 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L03.11:F1 | CBA-L03.11 | substantive-obligation | — | span:0-69 | DR2-0129 | — | XW2-0427 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L03.12:F1 | CBA-L03.12 | substantive-obligation | — | span:0-73 | DR2-0129 | — | XW2-0428 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L03.13:F1 | CBA-L03.13 | substantive-obligation | — | span:0-57 | DR2-0129 | — | XW2-0429 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L03.14:F1 | CBA-L03.14 | substantive-obligation | — | span:0-43 | DR2-0129 | — | XW2-0430 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L03.15:F1 | CBA-L03.15 | substantive-obligation | — | span:0-100 | DR2-0129 | — | XW2-0431 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L04.1:F1 | CBA-L04.1 | substantive-obligation | — | span:0-50 | DR2-0129 | — | XW2-0432 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L04.2:F1 | CBA-L04.2 | substantive-obligation | — | span:0-68 | DR2-0129 | — | XW2-0433 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L04.3:F1 | CBA-L04.3 | substantive-obligation | — | span:0-45 | DR2-0129 | — | XW2-0434 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L04.4:F1 | CBA-L04.4 | substantive-obligation | — | span:0-84 | DR2-0129 | — | XW2-0435 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L04.5:F1 | CBA-L04.5 | substantive-obligation | — | span:0-73 | DR2-0129 | — | XW2-0436 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L04.6:F1 | CBA-L04.6 | substantive-obligation | — | span:0-132 | DR2-0129 | — | XW2-0437 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L04.7:F1 | CBA-L04.7 | substantive-obligation | — | span:0-76 | DR2-0129 | — | XW2-0438 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L04.8:F1 | CBA-L04.8 | substantive-obligation | — | span:0-122 | DR2-0129 | — | XW2-0439 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L04.9:F1 | CBA-L04.9 | substantive-obligation | — | span:0-171 | DR2-0129 | — | XW2-0440 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L04.10:F1 | CBA-L04.10 | substantive-obligation | — | span:0-85 | DR2-0129 | — | XW2-0441 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L04.11:F1 | CBA-L04.11 | substantive-obligation | — | span:0-101 | DR2-0129 | — | XW2-0442 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L04.12:F1 | CBA-L04.12 | substantive-obligation | — | span:0-113 | DR2-0129 | — | XW2-0443 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L04.13:F1 | CBA-L04.13 | substantive-obligation | — | span:0-35 | DR2-0129 | — | XW2-0444 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L04.14:F1 | CBA-L04.14 | substantive-obligation | — | span:0-79 | DR2-0129 | — | XW2-0445 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L04.15:F1 | CBA-L04.15 | substantive-obligation | — | span:0-159 | DR2-0129 | — | XW2-0446 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L04.16:F1 | CBA-L04.16 | substantive-obligation | — | span:0-192 | DR2-0129 | — | XW2-0447 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L04.17:F1 | CBA-L04.17 | substantive-obligation | — | span:0-43 | DR2-0129 | — | XW2-0448 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L05.1:F1 | CBA-L05.1 | substantive-obligation | — | span:0-78 | DR2-0129 | — | XW2-0449 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L05.2:F1 | CBA-L05.2 | substantive-obligation | — | span:0-64 | DR2-0129 | — | XW2-0450 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L05.3:F1 | CBA-L05.3 | substantive-obligation | — | span:0-45 | DR2-0129 | — | XW2-0451 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L05.4:F1 | CBA-L05.4 | substantive-obligation | — | span:0-85 | DR2-0129 | — | XW2-0452 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L05.5:F1 | CBA-L05.5 | substantive-obligation | — | span:0-76 | DR2-0129 | — | XW2-0453 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L05.6:F1 | CBA-L05.6 | substantive-obligation | — | span:0-48 | DR2-0129 | — | XW2-0454 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L05.7:F1 | CBA-L05.7 | substantive-obligation | — | span:0-118 | DR2-0129 | — | XW2-0455 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L06.1:F1 | CBA-L06.1 | substantive-obligation | — | span:0-73 | DR2-0129 | — | XW2-0456 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L06.2:F1 | CBA-L06.2 | substantive-obligation | — | span:0-151 | DR2-0129 | — | XW2-0457 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L06.3:F1 | CBA-L06.3 | substantive-obligation | — | span:0-74 | DR2-0129 | — | XW2-0458 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L07:F1 | CBA-L07 | substantive-obligation | — | span:0-47 | DR2-0129 | — | XW2-0459 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L08.1:F1 | CBA-L08.1 | substantive-obligation | — | span:0-119 | DR2-0129 | — | XW2-0460 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L08.2:F1 | CBA-L08.2 | substantive-obligation | — | span:0-50 | DR2-0129 | — | XW2-0461 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L08.3:F1 | CBA-L08.3 | substantive-obligation | — | span:0-149 | DR2-0129 | — | XW2-0462 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L08.4:F1 | CBA-L08.4 | substantive-obligation | — | span:0-120 | DR2-0129 | — | XW2-0463 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L08.6:F1 | CBA-L08.6 | substantive-obligation | — | span:0-109 | DR2-0129 | — | XW2-0464 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L09:F1 | CBA-L09 | substantive-obligation | — | span:0-104 | DR2-0129 | — | XW2-0465 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L10.1:F1 | CBA-L10.1 | substantive-obligation | — | span:0-91 | DR2-0129 | — | XW2-0466 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L10.2:F1 | CBA-L10.2 | substantive-obligation | — | span:0-109 | DR2-0129 | — | XW2-0467 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L10.3:F1 | CBA-L10.3 | substantive-obligation | — | span:0-129 | DR2-0129 | — | XW2-0468 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L10.4:F1 | CBA-L10.4 | substantive-obligation | — | span:0-89 | DR2-0129 | — | XW2-0469 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L10.5:F1 | CBA-L10.5 | substantive-obligation | — | span:0-118 | DR2-0129 | — | XW2-0470 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L10.6:F1 | CBA-L10.6 | substantive-obligation | — | span:0-123 | DR2-0129 | — | XW2-0471 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L10.7:F1 | CBA-L10.7 | substantive-obligation | — | span:0-126 | DR2-0129 | — | XW2-0472 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L10.8:F1 | CBA-L10.8 | substantive-obligation | — | span:0-126 | DR2-0129 | — | XW2-0473 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-L10.9:F1 | CBA-L10.9 | substantive-obligation | — | span:0-131 | DR2-0129 | — | XW2-0474 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-S01.1:F1 | CBA-S01.1 | substantive-obligation | — | span:0-115 | DR2-0132 | — | XW2-0475 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-S01.2:F1 | CBA-S01.2 | substantive-obligation | — | span:0-112 | DR2-0132 | — | XW2-0476 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-S01.3:F1 | CBA-S01.3 | substantive-obligation | — | span:0-102 | DR2-0132 | — | XW2-0477 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-S01.4:F1 | CBA-S01.4 | substantive-obligation | — | span:0-240 | DR2-0132 | — | XW2-0478 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-S01.5:F1 | CBA-S01.5 | substantive-obligation | — | span:0-110 | DR2-0132 | — | XW2-0479 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-S01.6:F1 | CBA-S01.6 | substantive-obligation | — | span:0-105 | DR2-0132 | — | XW2-0480 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-S02.1:F1 | CBA-S02.1 | substantive-obligation | — | span:0-110 | DR2-0132 | — | XW2-0481 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-S02.2:F1 | CBA-S02.2 | substantive-obligation | — | span:0-83 | DR2-0132 | — | XW2-0482 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-S02.3:F1 | CBA-S02.3 | substantive-obligation | — | span:0-74 | DR2-0132 | — | XW2-0483 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-S02.4:F1 | CBA-S02.4 | substantive-obligation | — | span:0-113 | DR2-0132 | — | XW2-0484 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-S03.1:F1 | CBA-S03.1 | substantive-obligation | — | span:0-98 | DR2-0132 | — | XW2-0485 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-S03.2:F1 | CBA-S03.2 | substantive-obligation | — | span:0-174 | DR2-0132 | — | XW2-0486 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-S03.3:F1 | CBA-S03.3 | substantive-obligation | — | span:0-113 | DR2-0132 | — | XW2-0487 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-S04.1:F1 | CBA-S04.1 | substantive-obligation | — | span:0-113 | DR2-0132 | — | XW2-0488 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |
| CBA-S04.2:F1 | CBA-S04.2 | substantive-obligation | — | span:0-132 | DR2-0132 | — | XW2-0489 | current | 1 | Whole-row historical scope; current successor may correct source authority, decompose direct components, or narrow an overbroad implementation claim. |

## Date components

| Record ID | Date component ID | Date basis | Date role/scope | Date value | Source statement locator | Limitations or — | Component status | Component version | Superseding/current relationship or — |
|---|---|---|---|---|---|---|---|---|---|
| SRC2-005 | SRC2-005#D1 | publication | primary | 2025-08-14 | official release dateline | Mutable webpage; component certifies the publication date recorded in the retrieved artifact | current | 1 | — |

## Boundary and validation

R6 changes only the canon, governing repair plan, and this maker receipt. It
adds no schema, taxonomy, ID grammar, validator, proof system, bundle,
search-manifest, scenario, app, data, Graphify, Linear, Phase 2, R7, or
independent-review work.

- Full-document load and R6 join audit — PASS: 24 GROUPs; 241 matching
  LEAF-main/LEAF-detail rows (90 R, 124 L, 27 S); 241 matching authority
  components; 133 contiguous new historical edges; all seven deferred
  fragments resolved; every GROUP child range/count, LEAF/evidence join,
  source root, locator, dependency, Origin/crosswalk backlink, and decision
  reference reconciles; the dependency graph is acyclic.
- Historical reconciliation and preservation — PASS: all 47 R, 72 L, and 15
  S published rows have a current target; accepted `CBA-L08.5` inventory and
  edges are reused; accepted A/C GROUP, LEAF-main, LEAF-detail, and
  `EV2-0001`–`EV2-0576` rows are byte-identical; exactly the seven authorized
  prior XW2 deferral rows changed below `XW2-0357`; existing
  `SRC2-001`–`SRC2-004` rows are byte-identical.
- `python3
  work/architect-completion/cba_canon_v2_foundation_validator.py` — all 14
  accepting controls and 109 rejecting regressions pass, and the negative
  self-test fails as intended. The command exits 1 solely because the same
  seven inherited post-R4 future-plan wording diagnostics keep its legacy
  `baseline_clean` summary false; it reports no R6-local diagnostic.
- Touched-file Markdown lint — the plan and this receipt pass. The canon has
  exactly the 74 inherited MD029 findings in unchanged numbered scenario
  blocks; the identical 74-rule/count baseline reproduces against the
  accepted checker HEAD, and R6 adds no Markdown finding.
- `npm run docs:guardrails` — PASS.
- `npm run validate:project` — PASS.
- `git diff --check` — PASS.
- Scope confirmation — exactly the canon, governing plan, and this maker
  receipt are changed; no independent-review file, scenario, source code,
  schema, fixture, app test, build, typecheck, Graphify output, data, Linear,
  `main`, R7, or Phase 2 work was created or run.

R6 remains maker-only and awaits independent source review at the exact pushed
checkpoint.
