# Architect CBA Canon v2.0 — R1 Receipt: Substantive Corrections

## Provenance

| Field | Value |
|---|---|
| Repair unit | R1 — Substantive rule corrections (first unit of the approved R1–R9 plan) |
| Branch | `architect/cba-canon-v2` |
| Baseline commit | `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288` (= `main` = `origin/main` at session start) |
| Correction ledger | `ARCHITECT_CBA_CANON_V1_1_CLAUDE_ADJUDICATION.md` (dispositions govern) |
| Primary source used | Signed 2023 NBA–NBPA CBA, downloaded from the NBA's URL during this session (676 pages), text-extracted; every corrected wording was read directly from the cited printed pages before editing |
| Edition status after R1 | Canon v2.0 **working draft** — not accepted, not active; v2.0 checksum deliberately **not** computed (R8) |

Files changed in R1: `docs/reference/cba/ARCHITECT_CBA_CANON.md` and this receipt. Nothing else.

## Corrections C1–C7 (substantive) and C8–C9 (authority labels)

### C1 — Incentive-cap denominator: Regular Salary, not Base Compensation

- **Prior incorrect statement:** "Total Incentive Compensation may not exceed 20% of Base Compensation; unlikely Incentive Compensation may not exceed 15% of Base Compensation" (§3 corrections table, §5.9, C23.1, C23.4; scenario 68).
- **Corrected statement:** Incentive Compensation for a Season may not exceed 20% of the **Regular Salary** called for by the contract for that Season; Unlikely Bonuses in a Salary Cap Year may not exceed 15% of the player's **Regular Salary** for that Salary Cap Year at the time the contract is signed, subject to the extension/renegotiation provisos.
- **Canon locations/IDs:** §3 "Incentive limits" row; §5.9 bullet; LEAF `CBA-C23.1`; LEAF `CBA-C23.4`; scenario 68.
- **Primary authority:** CBA II §12(a)(i), printed p. 58; CBA VII §5(b)(1), printed p. 229 (both read verbatim this session).
- **Scenarios affected:** 68.
- **Validation:** corrected text quotes the defined term ("Regular Salary called for by the Contract"); the 15% cap's at-signing timing and the two provisos (extension first-year carryover; renegotiation no-increase) reproduced from §5(b)(1).

### C2 — Signing-bonus allocation basis

- **Prior incorrect statement:** "Signing bonuses are allocated across guaranteed seasons in proportion to guaranteed salary; ETO years are excluded" (§5.9; C18; scenario 67).
- **Corrected statement:** a signing bonus is allocated over the covered Salary Cap Years **in proportion to the percentage of Base Compensation in each such Salary Cap Year that, at the time of allocation, is protected for lack of skill**; with an ETO, allocation runs only over Salary Cap Years preceding the ETO's effective season; if no Base Compensation is protected for lack of skill, the entire bonus is allocated to the first Salary Cap Year (for a trade-earned bonus, the cap year of the trade).
- **Canon locations/IDs:** §5.9 bullet; LEAF `CBA-C18`; scenario 67.
- **Primary authority:** CBA VII §3(b)(2), printed pp. 200–201.
- **Scenarios affected:** 67.
- **Validation:** wording tracks the signed text including the protected-**percentage** basis (not protected dollars), the ETO effective-season exclusion, and the zero-protection collapse rule.

### C3 — ETO boundary

- **Prior incorrect statement:** "An ETO … must shorten the fourth season" (§5.5; C24.5; scenario 69 tested the backwards case).
- **Corrected statement:** an ETO is exercisable only once and **takes effect no earlier than the end of the fourth season** of the contract — the earliest season an ETO can eliminate is the fifth; for an ETO added with a Rookie Scale extension, the boundary is the end of the fourth season of the extended term; effective season fixed at signing; exercise by 5:00 p.m. ET on the June 29 immediately prior to the effective season.
- **Canon locations/IDs:** §5.5 ETO bullet; LEAF `CBA-C24.5`; scenario 69.
- **Primary authority:** CBA XII §2(b), printed p. 337 (Rookie Scale extension tail and §§3–4 on printed p. 338).
- **Scenarios affected:** 69.
- **Validation:** scenario 69 now passes the legal case (ETO effective at the end of the fourth season, eliminating the fifth) and fails an ETO purporting to take effect before the end of the fourth season.

### C4 — Two-Way payment schedule and conversion window

- **Prior incorrect statements:** (a) a Two-Way "cannot include … alternate payment schedules" (blanket prohibition); (b) "Conversion is allowed **after** July 1" (§5.2; C20.4; C20.6).
- **Corrected statements:** (a) a Two-Way may not include an Option Year or ETO (II §11(d)); may not include bonuses or Incentive Compensation of any kind, deferred compensation, or loans (II §11(a)(iii)); payment follows the standard UPC schedule **except** the express Advance — a Two-Way partially protected for lack of skill and injury or illness at signing may be amended to pay up to 50% of the Base Compensation so protected (the Two-Way Contract Advance Limit) prior to November 1, deducted from the November 1 and subsequent installments (II §11(a)(v)). (b) the conversion option is exercisable at any point **beginning on July 1** and ending just prior to the start of the team's last regular-season game, in each Salary Cap Year covered (II §11(f)).
- **Canon locations/IDs:** §5.2 bullets (contract-shape bullet split into two bullets to state the Advance conditions precisely; no register row was split); LEAF `CBA-C20.4`; LEAF `CBA-C20.6`.
- **Primary authority:** CBA II §11(a)(iii) printed pp. 50–51; §11(a)(v) printed p. 51; §11(d) printed p. 54; §11(f) printed pp. 54–55.
- **Scenarios affected:** none of the seven (scenario 72's cases — conversion after the final game fails; March 4 signing deadline — were adjudicated individually sound and were left unchanged per R1 scope).
- **Validation:** the exact Advance limits (50% of protected-at-signing amount, prior to November 1, installment-deduction order) and the exact conversion window endpoints were preserved rather than substituting another broad statement.

### C5 — Minimum Team Salary: payment vs Team Salary charge

- **Prior incorrect statement:** a team below the line "pays the difference, receives an **equal** Team Salary charge" (§8.7; C10.3; scenario 60).
- **Corrected statement:** the player payment equals Minimum Team Salary − **MTS Payment Team Salary** (season-start MTS Cap Hold Team Salary +§4(h) exclusions −§3(e) inclusions +§4(b) exclusions), and bars the team from the non-taxpayer tax distribution; the in-season Team Salary charge equals Minimum Team Salary − the **lesser of then-current and season-start MTS Cap Hold Team Salary**; the bases differ and the amounts are not necessarily equal; year-end reconciliation under §2(c)(5) re-tests with excluded-but-earned incentives added and included-but-unearned incentives removed.
- **Canon locations/IDs:** §8.7 (rewritten with authority line); LEAF `CBA-C10.3`; scenario 60.
- **Primary authority:** CBA VII §2(c)(1)–(3) and (5), printed pp. 176–178.
- **Scenarios affected:** 60.
- **Validation:** both defined terms ("MTS Cap Hold Team Salary", "MTS Payment Team Salary") and their adjustment chains reproduced from §2(c)(1); the charge's "lesser of" base from §2(c)(3); §2(c)(4)'s floor rule (outside R1's controlling list) left as previously stated.

### C6 — Apron Salary: ten enumerated adjustments

- **Prior incorrect statement:** §8.1 listed nine bullets, merging enumerated adjustments (vi) (subtract unsigned first-round-pick amounts) and (vii) (add outstanding Required Tenders to first-round picks) into one; scenario 57 said "nine enumerated adjustments".
- **Corrected statement:** §8.1 rewritten as the **ten** separately enumerated adjustments (i)–(x) of CBA VII §2(e)(1), each with its clause tag and cross-referenced CBA section; scenario 57 exercises all ten with (vi) and (vii) as two independent cases.
- **Canon locations/IDs:** §8.1 (full rewrite with authority line); LEAF `CBA-C07.6` (reworded to state (vi) and (vii) as two distinct adjustments); scenario 57.
- **Primary authority:** CBA VII §2(e)(1)(i)–(x), printed pp. 186–187.
- **Scenarios affected:** 57.
- **Validation:** each of the ten items checked one-for-one against the signed enumeration, including (ii)'s §2(d)(1)(i)(F) basis, (viii)'s §§4(a)(7)/6(n)(2) cross-references, and (ix)'s §4(l) SRPE exclusion.

### C7 — Second Round Pick Exception Team Option carve-out

- **Prior incorrect statement:** "An option … generally carries unchanged terms and protection" with no exception (§5.5; C24.2).
- **Corrected statement:** the Team Option unchanged-terms requirement (other than the Base Compensation payment schedule) expressly **excepts a contract signed pursuant to the Second Round Pick Exception**.
- **Canon locations/IDs:** §5.5 option bullet; LEAF `CBA-C24.2`.
- **Primary authority:** CBA XII §1(v), printed p. 336.
- **Scenarios affected:** 69 (option/ETO scenario rewritten; the SRPE carve-out itself is stated in the rule text — a dedicated SRPE-option scenario is R7 coverage work).
- **Validation:** carve-out placement matches the signed text — it modifies clause (v) (unchanged terms), not clause (iv) (no-reduction floor), and applies to Team Options (XII §1), not Player Options (XII §2(a)).

### C8 — A11 component-decomposition authority label

- **Prior incorrect labeling:** LEAF `CBA-A11` and §12.4 presented per-team component-trade decomposition as bare "CBA".
- **Corrected labeling:** the per-player/per-exception structure is supported by CBA VII §6(j)(1)(i)–(v), printed pp. 240–241 (each exception replaces its own defined Traded Player(s) with its own Replacement Player(s)); the decomposition **procedure** is labeled **DERIVED** and is not presented as express CBA text. Authority field now reads `CBA VII §6(j)(1)(i)–(v) pp. 240–241 + DERIVED`.
- **Canon locations/IDs:** §12.4 lead paragraph; LEAF `CBA-A11`.
- **Primary authority:** CBA VII §6(j)(1)(i)–(v), printed pp. 240–241.
- **Scenarios affected:** none (scenario 48 was adjudicated NOT CONFIRMED as a defect and is unchanged).

### C9 — A18.7 conditional-cash authority label

- **Prior incorrect labeling:** LEAF `CBA-A18.7` and §12.12 presented conditional-cash cap-year charging plus re-trade accounting as bare "CBA".
- **Corrected labeling:** charging cash to the trade's Salary Cap Year is supported by CBA VII §8(a), printed p. 260 ("in connection with one (1) or more trades occurring during a Salary Cap Year, directly or indirectly"); the detailed re-trade attribution/accounting mechanics are labeled **DERIVED/OPS** and are not presented as express CBA text. Authority field now reads `CBA VII §8(a) p. 260 + DERIVED/OPS`.
- **Canon locations/IDs:** §12.12 bullet; LEAF `CBA-A18.7`.
- **Primary authority:** CBA VII §8(a), printed p. 260.
- **Scenarios affected:** 53 (rewritten — see below).

## Scenario corrections (only 50, 53, 57, 60, 67, 68, 69; none renumbered)

Every rewritten scenario now states **Input facts**, **Boundary/trigger**, **Expected result**, and **controlling primary locator**:

| # | Required outcome | How met |
|---|---|---|
| 50 | Distinguish prohibited aggregated re-trade from legal unaggregated solo re-trade | Case (a) solo re-trade inside two months = legal; case (b) aggregation inside two months = blocked; case (c) December 16 carve-out = legal. CBA VII §6(j)(4)(i), p. 242 |
| 53 | Genuinely exercise signing-bonus-as-cash in a sign-and-trade | Sign-and-trade signing bonus paid by the signing team consumes sent-cash capacity and can block the deal. CBA VII §8(a), p. 260; Second Apron limb cited to VII §2(e)(4) Table row I, p. 191 |
| 57 | Exercise all ten enumerated apron adjustments without merging two | All ten activated on one roster; (vi) and (vii) exercised as two independent cases. CBA VII §2(e)(1)(i)–(x), pp. 186–187 |
| 60 | Distinguish MTS player-payment calculation from Team Salary charge | Payment on MTS Payment Team Salary; charge on lesser-of MTS Cap Hold bases; facts force the two to differ. CBA VII §2(c)(1)–(3),(5), pp. 176–178 |
| 67 | Correct signing-bonus allocation basis | Protected-percentage proportions incl. ETO and zero-protection variants; dollar-proportional allocation detected as wrong. CBA VII §3(b)(2), pp. 200–201 |
| 68 | Regular Salary for the incentive limits | Both incentive caps on Regular Salary; adds a Base-Compensation-passes/Regular-Salary-fails case. CBA II §12(a)(i)–(iii), p. 58; VII §5(b)(1), p. 229 |
| 69 | Correct ETO boundary | Legal: ETO effective at end of fourth season (eliminates the fifth). Illegal: ETO effective before the end of the fourth season; June 25 RFA-option exercise. CBA XII §2(b), p. 337; §4, p. 338 |

## Edition status changes

- Header edition line now reads **Canon v2.0 — WORKING DRAFT (not accepted, not an active audit oracle)**.
- v1.0 checksum `b8cf5d01…` preserved as historical provenance; the "verification carries forward unchanged" claim (falsified by the acceptance review) replaced with the historical record.
- v1.1 checksum `4a0760c8…` and its **rejected** status now stated in the header and amendment log.
- Amendment log gains a "Canon v1.1 rejection" row and a "Repair v2.0 — working draft, R1" row.
- Authority cutoff **July 12, 2026** unchanged (all R1 corrections come from the signed 2023 CBA, within the cutoff).
- **No v2.0 checksum computed or published** — that belongs to R8.

## Validation performed

- Every corrected wording verified against the signed 2023 CBA text extracted this session (pages 50–51, 54–55, 58, 176–178, 186–187, 191, 200–201, 229, 240–246, 260, 336–338 printed).
- Mechanical checks (this session, recorded in the R1 report): only `docs/reference/cba/ARCHITECT_CBA_CANON.md` and this receipt changed; LEAF ID set and count unchanged (368 LEAF rows, no ID added/deleted/renumbered); scenario numbering 1–89 continuous and unchanged; only scenarios 50, 53, 57, 60, 67, 68, 69 differ from v1.1.
- `npm run lint:md` run at checkpoint; only the pre-existing, accepted MD029 continuous-numbering class in §16 remains.
- No app tests run (documentation-only change per the repair plan's global rule 6).

## Adjacent issues discovered and deferred (not fixed in R1)

| Deferred issue | Belongs to |
|---|---|
| `CBA-C07.6` still owns two separately enumerated adjustments ((vi) and (vii)) in one LEAF row; wording now keeps them distinct but the row must be split into two LEAFs | R4 (C-series re-registration; already anticipated by the plan) |
| `CBA-C20.4` remains non-atomic (term/option shape + compensation prohibitions + payment schedule in one row) | R5 |
| `CBA-C23.1`/`CBA-C23.4` remain duplicate owners of the incentive caps (both corrected identically so neither is wrong) | R5 (dedupe) |
| `CBA-C10.3` bundles payment, tax-distribution bar, and Team Salary charge (independently verifiable) | R4 (split) |
| Scenario 72 inherits C20.4/C20.6 premises; its individual cases were adjudicated sound and R1 leaves it untouched — re-point after the C20 rows are re-registered | R7 |
| §5.5/C24.2's option no-reduction clause (XII §1(iv)) could carry its own locator when the full per-LEAF locator system lands | R3–R5 |
| Scenario for the SRPE Team Option carve-out itself (changed-terms option year on an SRPE contract) has no dedicated coverage | R7 |

## Confirmation

No substantive rule other than the nine approved corrections was changed. No ID or scenario was renumbered, added, or deleted. No register restructuring (dedupe/split/delete/re-parent) was performed. No application code, tests, schemas, fixtures, configuration, data, code map, or historical review artifact was modified. Linear was not read or written. R2–R9, Phase 2, and W1.1 were not started.
