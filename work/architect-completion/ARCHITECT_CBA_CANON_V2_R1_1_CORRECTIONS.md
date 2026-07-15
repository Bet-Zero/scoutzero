# Architect CBA Canon v2.0 — R1.1 Receipt: Residual Corrections

## Provenance

| Field | Value |
|---|---|
| Repair unit | R1.1 — residual R1 rule-text and scenario-logic corrections, ordered by the independent Claude adjudication of the Codex R1/R2 foundation review (adjudication section H.3–H.4; its dispositions govern) |
| Branch | `architect/cba-canon-v2` |
| Baseline commit | `056b9d0241fc5571a540630f16434b4218086eb3` (R2 checkpoint = origin at session start; `main` = `origin/main` = `69f8f6b6…`) |
| Scope | Corrections 1–4 and scenarios 50, 60, 67, 69 only. Scenarios 53, 57, and 68 deliberately untouched (provisional for the R7 rebuild). R2.1, R3–R9, Phase 2, and W1.1 not started |
| Edition status after R1.1 | Canon v2.0 **working draft** — not accepted, not active; v2.0 checksum deliberately **not** computed (R8) |

Files changed in R1.1: `docs/reference/cba/ARCHITECT_CBA_CANON.md` and this receipt. Nothing else.

## Shared source artifact (read directly this session)

| Field | Value |
|---|---|
| Source title / edition | 2023 NBA–NBPA Collective Bargaining Agreement (signed agreement; 2023 edition) |
| Official URL | <https://ak-static.cms.nba.com/wp-content/uploads/sites/4/2023/06/2023-NBA-Collective-Bargaining-Agreement.pdf> |
| Retrieval timestamp | 2026-07-14T23:15:38-04:00 |
| Retrieved artifact SHA-256 | `bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32` (matches the hash recorded by the independent adjudication — same artifact) |
| Pages / geometry | 676 PDF pages; printed page = PDF page − 24 |
| Verifier / session / date | Claude (R1.1 repair session on `architect/cba-canon-v2`), July 14, 2026 |
| Committed? | **No.** The PDF was downloaded to the session scratchpad only and is not committed to the repository; the hash-plus-citation chain above is the durable evidence |

Passages read verbatim this session before editing: CBA II §12(a)(i)–(iii) (printed p. 58); VII §2(c)(1)–(8) (printed pp. 176–179); VII §3(b)(1)–(3) (printed pp. 199–203); VII §5(b)(1)–(2) (printed pp. 228–230); VII §6(j)(1)–(6) (printed pp. 241–243); VII §7(a)(1)–(3) (printed pp. 249–251).

## Correction 1 — VII §5(b)(1) provisos stated in full

- **Defect (adjudication A1):** the canon named "the extension/renegotiation provisos" without stating them; a reader could not apply the rule, and the R1 receipt's claim that the provisos were "reproduced" was false.
- **Canon locations/IDs:** §3 "Incentive limits" row; §5.9 incentive bullet; `CBA-C23.1`; `CBA-C23.4`.
- **Authority:** CBA VII §5(b)(1), printed p. 229. Controlling text (read this session): no contract may provide for Unlikely Bonuses in any Salary Cap Year exceeding 15% of the player's Regular Salary for such year at the time the contract is signed; "*provided, however, that: (i) with respect to Extensions, if the amount of Unlikely Bonuses in the Salary Cap Year in which the Extension is signed exceeds fifteen percent (15%) of the player's Regular Salary for such Salary Cap Year, the Extension may provide for up to the same percentage of Unlikely Bonuses in the first year of the extended term; and (ii) no Renegotiation may provide for an increase in Unlikely Bonuses if, after the Renegotiation, the amount of Unlikely Bonuses in respect of any Salary Cap Year covered by the renegotiated Contract exceeds fifteen percent (15%) of the player's Regular Salary for such Salary Cap Year.*"
- **Passage → obligation:** proviso (i) is a carry-forward permission (an over-15% *percentage* existing when an Extension is signed may be carried, at up to the same percentage, into the extended term's first year); proviso (ii) is a renegotiation prohibition (no increase that leaves any covered year above 15% of Regular Salary). Both now appear as operative conditions wherever the 15% cap is stated.
- **Adjacent provisions checked:** II §12(a)(i)–(iii) (the 20% Incentive Compensation cap and the 15%/10% signing-bonus caps — denominators re-verified unchanged); VII §5(b)(2) (Room-based Unlikely-Bonus limit at signing — a distinct rule, not folded into the cap statement); VII §5(a)(5)–(6) (bonus-criteria stability; Two-Way carve-out).
- **Before → after:** "subject to the CBA's extension/renegotiation provisos" → both provisos stated in full in §5.9 and in compact operative form in the §3 row, C23.1, and C23.4.
- **Remaining limitation:** scenario 68 still cites the provisos without exercising them; it remains provisional for R7 per the R1.1 order. C23.1/C23.4 remain duplicate owners (R5 dedupe queue).

## Correction 2 — Signing-bonus allocation scope (ordinary / trade-earned / extension)

- **Defect (adjudication A2):** the general allocation sentence omitted the §3(b)(1)(ii) then-current-and-remaining-years qualifier; §5.9's trade-bonus bullet, §12.7, A07.2, and A07.8 still allocated "over remaining guaranteed seasons" (pre-correction dollar-basis language); §3(b)(3)'s distinct extension-bonus rules were absent.
- **Canon locations/IDs:** §5.9 signing-bonus bullet; new §5.9 extension-bonus bullet; §5.9 trade-bonus bullet; §12.7 allocation bullet; `CBA-A07.2`; `CBA-A07.8`; `CBA-C18`.
- **Authority:** CBA VII §3(b)(1)(ii), §3(b)(2), printed pp. 200–201; §3(b)(3)(i)–(ii), printed pp. 201–203. Controlling text (read this session): §3(b)(2) allocates a signing bonus "*over the number of Salary Cap Years (or over the then-current and any remaining Salary Cap Years in the case of a signing bonus described in Section 3(b)(1)(ii) above) covered by such Contract in proportion to the percentage of Base Compensation in each such Salary Cap Year that, at the time of allocation, is protected for lack of skill*"; ETO → allocation "*only over Salary Cap Years that precede the Effective Season of such ETO*"; zero protection → entire bonus to the first Salary Cap Year "*(or, in the case of a signing bonus described in Section 3(b)(1)(ii) above, the Salary Cap Year during which the player's Contract is traded)*". §3(b)(3)(i) (at/over-cap Extension): bonus "*shall be paid no sooner than the first day of the first Salary Cap Year covered by the extended term and shall be allocated, in equal parts, over the number of Salary Cap Years covered by the extended term in proportion to the percentage of Base Compensation in each such Salary Cap Year that, at the time of allocation, is protected for lack of skill*"; zero extended-term protection → first Salary Cap Year of the extended term. §3(b)(3)(ii) (below-cap Extension): bonus may be paid "*at any time during the Contract's original or extended term*"; if paid before the extended term: (A) allocation over the remaining Salary Cap Years (including then-current) of the original term and the extended term on the protected-percentage basis (zero → the Salary Cap Year the Extension is signed); (B) the Extension "*shall be deemed a Renegotiation*"; (C) payment in two installments — before the extended term, the portion allocated to original-term years; on/after its first day, the portion allocated to extended-term years.
- **Passage → obligation:** a trade-earned bonus (§3(b)(1)(ii) — "*earned in the form of a bonus upon the trade of the Contract*", which is what a trade bonus is for allocation purposes) allocates over the **then-current and any remaining** Salary Cap Years on the protected-percentage basis — never "remaining guaranteed seasons"; extension bonuses are a third, distinct regime. The canon now states the three regimes separately and expressly forbids merging them.
- **Adjacent provisions checked:** §3(b)(1)(i)/(iii) (what counts as a signing bonus, including excess international payments); §3(b)(3)(iii)–(iv) (trade-bonus/Extension interactions where the trade-bonus provision does or does not extend to the extended term — noted as adjacent, not reproduced; see limitation below); II §12(a)(ii) (15% signing-bonus ceiling measured on the extended term for an Extension — unchanged).
- **Before → after:** "allocated to the receiving team's salary over remaining guaranteed seasons" (and the A07.2/A07.8/§12.7 equivalents) → allocation as a §3(b)(1)(ii) signing bonus over the then-current and any remaining Salary Cap Years on the lack-of-skill-protected-percentage basis; general sentence gains the trade-earned qualifier and the trade-earned zero-protection collapse; new §5.9 bullet states §3(b)(3)(i)–(ii) including the deemed-Renegotiation and two-installment rules. The ETO effective-season exclusion and zero-protection fallback are preserved verbatim.
- **Remaining limitation:** §3(b)(3)(iii)–(iv) (allocation when an Extension disclaims or retains the original trade-bonus provision) are cited as adjacent but not reproduced as canon rules — they belong to the C-series re-registration (R5) with their own rows. No scenario yet exercises trade-earned or extension-bonus allocation (R7).

## Correction 3 — MTS shortfall payment terminology and the §2(c)(7) exception

- **Defect (adjudication A3–A4):** the canon labeled the team-to-NBA shortfall payment a "player payment"; nothing in §2(c) pays players. The categorical tax-distribution bar also omitted the 2023–24-only §2(c)(7) exception.
- **Canon locations/IDs:** §8.7 payment bullet; `CBA-C10.3` (text and locator); scenario 60.
- **Authority:** CBA VII §2(c)(1)–(7), printed pp. 176–179. Controlling text (read this session): §2(c)(2)(i) — "*The NBA shall cause such Team to make a payment to the NBA equal to the difference between the Team's MTS Payment Team Salary and the Minimum Team Salary*"; §2(c)(6) — payments due within ten business days of the Governing Audit Report, and "*The NBA shall then distribute any such payments equally to each Team within ten (10) business days following its receipt of such payments*"; §2(c)(7) — "*for the 2023-24 Salary Cap Year only*", a team whose MTS Payment Team Salary is below the Minimum Team Salary and that "*does not owe a Tax*" receives "*a fifty percent (50%) share*" of the non-taxpayer tax distribution.
- **Passage → obligation:** the payment runs team → NBA and is redistributed equally to teams; no player receives it. The tax-distribution bar is total in every season except 2023–24, where a non-tax-owing shortfall team took a half share.
- **Adjacent provisions checked:** §2(c)(1)(iii) and §2(c)(4) (MTS Threshold and the next-day restoration duty — now exercised by scenario 60's facts); §2(c)(5) (year-end reconciliation with the two incentive adjustments — preserved); §2(c)(8) (a team may exceed the MTS up to the cap plus exceptions — no canon impact).
- **Before → after:** "**Player payment:**" → "**MTS shortfall payment (team → NBA):**" with the §2(c)(6) equal-redistribution mechanics and the §2(c)(7) historical note, in §8.7 and C10.3 (C10.3's locator extended to §2(c)(1)–(3),(6)–(7) pp. 176–179); scenario 60 rewritten (below). The MTS Payment Team Salary / MTS Cap Hold Team Salary / Team Salary charge / year-end reconciliation distinctions are preserved unchanged.
- **Remaining limitation:** §8.7's "opening salary becomes a continuing in-season floor" bullet paraphrases the §2(c)(4)/MTS Threshold rule loosely; it was not on the adjudicated defect list and is left for the C10 re-registration (R4).

## Correction 4 — A11 / A18.7 authority labels marked provisional

- **Defect (adjudication A5–A6, attributed to the plan/taxonomy, not R1):** A11's "DERIVED" chain is legal/structural inference, not arithmetic reproduced from a formula, and cannot satisfy the register standard's DERIVED evidence minima; A18.7's "DERIVED/OPS" is an unresolvable composite with no OPS provenance. Final relabeling awaits R2.1's INFERRED authority class.
- **Canon locations/IDs:** `CBA-A11` and `CBA-A18.7` authority cells; §12.4 lead paragraph; §12.12 conditional-cash bullet.
- **Action taken (no reclassification performed):** each of the four sites now carries an explicit provisional marker — classification blocked pending the R2.1 authority-taxonomy amendment; the DERIVED/OPS composite is flagged as unresolved and not to be relied on as authoritative. The underlying CBA citations (VII §6(j)(1)(i)–(v) pp. 240–241; VII §8(a) p. 260) are unchanged and remain correct.
- **Deferred:** the A11 component decomposition and the A18.7 re-trade attribution split (express cap-year charging vs OPS/INFERRED mechanics) belong to R2.1 + the family re-registration.

## Scenario corrections (50, 60, 67, 69 only; none renumbered)

### Scenario 50 — VII §6(j)(4)(i) aggregation bar and carve-out

- **Defect:** case (c) was non-discriminating (a November 20 acquisition's two-month bar expires ~January 20, before any realistic deadline) and described an impossible sequential double trade.
- **Inputs:** four independent variants on a pinned test calendar (2026–27; deadline defined as Thursday, February 11, 2027): (a) exception acquisition November 20, 2026, solo re-trade January 10, 2027; (b) same acquisition, aggregated January 10, 2027 (two-month period runs through January 20, 2027 — the section's own example); (c1) acquisition December 15, 2026, aggregated February 10, 2027 (day before the deadline; two-month window would run through February 15, 2027); (c2) same as (c1) but aggregated February 9, 2027.
- **Decision + expected:** (a) not barred (the bar reaches only aggregated Traded Players); (b) barred; (c1) not barred — only the carve-out makes it legal, because the trade date is inside the two-month window; (c2) barred — the carve-out does not reach trades earlier than the day before the deadline. Results are expressly limited to whether §6(j)(4)(i) bars the transaction.
- **Locator:** CBA VII §6(j)(4)(i), printed p. 242. Controlling text (read this session): no player acquired "*pursuant to an Exception in the two (2) month period preceding the trade*" may be among aggregated Traded Players; "*provided, however, that if a Team acquires a Player Contract pursuant to an Exception on or before December 16 of a Salary Cap Year, then the foregoing restriction shall not apply in the event the player is subsequently traded on or after the day prior to the NBA trade deadline of such Salary Cap Year.*" **Note:** the carve-out's acquisition condition is "on or before December 16" per the signed text (the R1.1 order's phrase "on or after December 16" does not match the signed text; the signed text and the adjudication's variant design control).
- **Why discriminating:** (c1) vs (c2) differ only in trade date, isolating the carve-out boundary; (c1)'s acquisition date puts the deadline inside the two-month window, so the carve-out — not window expiry — decides the outcome; (a) vs (b) isolate aggregation as the trigger.

### Scenario 60 — MTS payment vs Team Salary charge

- **Defect:** the stated facts did not entail divergence (counterexample: payment 20 = charge 20 satisfied every stated fact); "player payment" mislabel.
- **Inputs ($M, hypothetical parameter set; season semantics 2026–27):** MTS 100; season-start MTS Cap Hold Team Salary 90; MTS Payment Team Salary 85; then-current MTS Cap Hold Team Salary drops to 80; year-end financially-responsible MTS Cap Hold Team Salaries (incentive-adjusted) 82.
- **Calculation + expected:** shortfall payment = 100 − 85 = **15** (team → NBA; §2(c)(6) equal redistribution); Team Salary charge = 100 − min(90, 80) = **20**; the §2(c)(4) restoration duty triggers (80 < MTS Threshold 90 → restore to ≥ 90 by end of the following day); year-end §2(c)(5) additional payment = 100 − (82 + 15) = **3**; tax-distribution bar applies (2023–24-only §2(c)(7) half-share isolated as historical).
- **Locator:** CBA VII §2(c)(1)–(7), printed pp. 176–179.
- **Why discriminating:** payment (15) ≠ charge (20), so an implementation computing one base and reusing it — in either direction — fails; the previous facts allowed the two to coincide.

### Scenario 67 — Signing-bonus allocation basis

- **Defect:** with equal salaries, percentage-basis and dollar-basis allocations coincide (100/50/0 protection on equal salaries → the same 2:1:0 split), so the scenario could not detect the exact error it targeted.
- **Inputs:** Variant 1 (2026–27/2027–28/2028–29): Base Compensation 10/20/30, protection 100%/50%/0%, bonus 6. Variant 2 (2026–27→2030–31): Base Compensation 20×5, protection 100%/100%/50%/50%/100%, ETO effective season 2030–31, bonus 6. Variant 3: no lack-of-skill protection in any year.
- **Calculation + expected:** Variant 1 — protected-percentage basis (100:50:0) → **4 / 2 / 0**; protected-dollar basis (10:10:0) → **3 / 3 / 0**, which must be detected as wrong. Variant 2 — allocation only over the four years preceding the ETO's effective season (100:100:50:50) → **2 / 2 / 1 / 1 / 0**. Variant 3 — entire 6 to the first Salary Cap Year.
- **Locator:** CBA VII §3(b)(2), printed pp. 200–201.
- **Why discriminating:** unequal salaries force percentage-proportions (2⁄3, 1⁄3, 0) apart from dollar-proportions (1⁄2, 1⁄2, 0), producing different dollar outputs (4/2/0 vs 3/3/0) for the same facts.

### Scenario 69 — Option/ETO boundaries and the post-ETO extension bar

- **Defect:** the post-ETO extension refusal carried no controlling authority; the scenario's mappings over-claimed coverage.
- **Inputs (2026–27 unless stated):** (a) standard option exercised 5:00 p.m. ET June 29, 2027; (b) RFA-triggering option exercised June 25, 2027; (c) five-season contract 2026–27→2030–31, ETO effective season 2030–31 (eliminating the fifth); (d) ETO purporting to take effect before the end of the fourth season; (e) ETO exercised by June 29, 2030, then an extension attempted July 2030.
- **Expected:** (a) legal; (b) fails (must be prior to June 25); (c) passes; (d) fails; (e) fails under VII §7(a)(2)(ii).
- **Locator:** CBA XII §2(b) p. 337; XII §4 p. 338; VII §7(a)(2)(ii), printed p. 250. Controlling text (read this session): "*A Team and a player shall not be permitted to extend any Player Contract with a term that has been shortened as a result of the player's exercise of an Early Termination Option.*" Adjacent provisions checked: VII §7(a)(2)(i) (post-renegotiation extension timing) and §7(a)(2)(iii) (extension following option exercise/non-exercise — permitted paths, distinct from the ETO bar).
- **Why discriminating:** case (e) isolates the ETO-shortened-term bar from the option-exercise paths §7(a)(2)(iii) permits; the correct ETO boundary cases (c)/(d) are preserved unchanged in substance.
- **Truthful coverage:** the scenario now states expressly that it does **not** exercise the XII §1(v) SRPE Team Option carve-out (C24.2) or option protection behavior (C24.7); those register mappings remain provisional for R7.

## Deferred (unchanged by R1.1)

| Item | Belongs to |
|---|---|
| INFERRED authority class; final A11/A18.7 relabeling; DERIVED/OPS composite resolution | R2.1 |
| Scenarios 53, 57, 68 full numeric completeness under the §6.3 contract | R7 (provisional until then) |
| §3(b)(3)(iii)–(iv) trade-bonus/Extension allocation interactions as registered rules | R5 |
| C23.1/C23.4 dedupe; C10.3 split (payment / tax bar / charge); §8.7 §2(c)(4) floor paraphrase | R4/R5 |
| `Exercises:` lists as binding bidirectional register links (marked "provisional pending R7" in the four rewritten scenarios) | R7 |

## Validation performed

- Every corrected wording verified against the signed 2023 CBA (artifact above) read directly this session at printed pp. 58, 176–179, 199–203, 228–230, 241–243, 249–251.
- Scenario arithmetic recomputed by hand: 15 ≠ 20 (scenario 60); 4/2/0 ≠ 3/3/0 and 2/2/1/1/0 (scenario 67); the two-month/carve-out date windows (scenario 50: Nov 20 → Jan 20; Dec 15 → Feb 15 vs the Feb 10 day-before-deadline).
- Mechanical checks recorded in the R1.1 report: only the canon and this receipt changed; the 427-node ID set unchanged (no ID added, removed, renumbered, split, merged, retired, or re-parented); scenarios 1–89 continuous; only scenarios 50, 60, 67, 69 differ from R2 in §16.
- `npm run lint:md`: only the pre-existing accepted MD029 continuous-numbering class in §16 (plus pre-existing errors confined to unrelated files) remains. `npm run docs:guardrails`: pass.
- No app tests run (documentation-only change per repair-plan global rule 6).

## Confirmation

No rule other than the ordered R1.1 corrections was changed. No ID or scenario was renumbered, added, or deleted. No register restructuring was performed. A11 and A18.7 are visibly provisional, not finally classified. No application code, tests, schemas, fixtures, configuration, data, code map, README, R1/R2 receipts, repair plan, or historical review artifact was modified. Linear was not read or written. R2.1, R3–R9, Phase 2, and W1.1 were not started. The CBA PDF was not committed.
