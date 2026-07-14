# Claude Independent Adjudication — Codex Rejection of Canon v1.1 — UPHELD

## Provenance

| Field | Value |
|---|---|
| Reviewer | Claude |
| Review type | Independent read-only adjudication of the Codex rejection |
| Reviewed commit | `9814939c794595b988de21d8013934dc5342c8ee` |
| Result | **Codex rejection upheld** |
| Repository changes during adjudication | None |

The adjudication below is preserved as delivered. Primary sources were
independently obtained and read for this adjudication: the signed 2023
NBA–NBPA CBA (downloaded from the NBA's URL and text-extracted, 676 pages),
the June 2024 NBA Constitution and By-Laws, and the official NBA 2026–27
system-level release. Relative repository links are relative to the repo root
at the reviewed commit.

---

# Independent adjudication of the Codex Phase 1 acceptance review

**Overall verdict: Codex's REJECT/BLOCK is upheld.** I verified its findings independently against the signed 2023 CBA (downloaded from the NBA's own URL and text-extracted), the June 2024 Constitution/By-Laws, the official 2026–27 NBA release, and the repository at the pinned commit. Seven of Codex's nine substantive CBA claims are **CONFIRMED against the signed text**, two are **PARTIALLY CONFIRMED**, and the registry/scenario defects are real and **broader than Codex's examples**. A few Codex claims are overstated in wording (detailed below), but none of the overstatements changes the outcome. Phase 1 remains blocked; W1.1 remains blocked.

## Baseline verified

- `HEAD` = `main` = `origin/main` = `9814939c794595b988de21d8013934dc5342c8ee`; working tree clean before, during, and after this review.
- Canon v1.1 SHA-256 = `4a0760c8…` exactly as published; the v1.0 blob at `c859be78` hashes to `b8cf5d01…` exactly as recorded.
- `graphify-out/graph.json` `built_at_commit` matches the reviewed commit.
- All five required documents read in full.

## 1. Plain-English summary: what Codex got right and wrong

Codex got the big things right. The canon's header claims "primary-source-verified," but at least seven rules in it contradict the signed CBA in ways a per-rule read of the primary text would have caught — wrong defined term for the incentive caps, wrong signing-bonus allocation basis, a backwards ETO boundary, a Two-Way payment-schedule rule the CBA explicitly contradicts, an off-by-one conversion window, a minimum-team-salary mechanic the CBA computes from two different bases, and a missing express exception for Second Round Pick Exception options. Codex was also right that the 368-row register is not 368 unique atomic obligations, that several scenario mappings are syntactic links rather than proof, and that four code-map pointers send Phase 2 to the wrong code.

Codex got three things wrong or overstated: it wrote "**none** of the 368 LEAF rows contains a primary-source article/subsection" (five rows do embed article references, though there is genuinely no locator *standard*); it called the C01/C14 scheduling problem an "unresolved dependency **cycle**" (it is a one-way dependency scheduled backwards — a real contradiction in the plan, but not a cycle); and it mislabeled two IDs (its "C07.8" is actually **C07.6**, and its "A10.4" is actually **A11** — its line numbers were correct both times).

## 2. Disposition matrix

| # | Codex claim | Disposition | Controlling authority |
|---|---|---|---|
| C1 | Incentive caps use Regular Salary, not Base Compensation | **CONFIRMED** | CBA II §12(a)(i), p. 58; VII §5(b)(1), p. 229 |
| C2 | Signing bonus allocated by % of Base Compensation protected for lack of skill, not "guaranteed salary" | **CONFIRMED** | CBA VII §3(b)(2), pp. 200–201 |
| C3 | ETO effective no earlier than end of fourth Season; canon's "must shorten the fourth season" wrong | **CONFIRMED** | CBA XII §2(b), p. 337 |
| C4 | Two-Way Advance/alternate schedule permitted; conversion begins **on** July 1 | **CONFIRMED** (both halves) | CBA II §11(a)(v), p. 51; II §11(f), pp. 54–55 |
| C5 | MTS payment and Team Salary charge use different adjusted bases | **CONFIRMED** | CBA VII §2(c)(1)–(3),(5), pp. 176–178 |
| C6 | CBA enumerates **ten** apron adjustments; canon merges two and scenario 57 says "nine" | **CONFIRMED** (merged row is **C07.6**, not C07.8) | CBA VII §2(e)(1)(i)–(x), pp. 186–187 |
| C7 | C24.2 omits the SRPE Team Option carve-out | **CONFIRMED** | CBA XII §1(v), p. 336 |
| C8 | Component decomposition lacks express CBA authority | **PARTIALLY CONFIRMED** — per-player/per-exception structure of VII §6(j)(1) supports it; the decomposition procedure itself needs CBA-cite + DERIVED labeling, not bare "CBA" | CBA VII §6(j)(1)(i)–(v), pp. 240–241 |
| C9 | Conditional-cash accounting lacks express CBA authority | **PARTIALLY CONFIRMED** — charging to the trade's cap year is supportable from VII §8(a) ("directly or indirectly… in connection with… trades occurring during a Salary Cap Year"); the re-trade accounting mechanics are not in the text → DERIVED/OPS | CBA VII §8(a), p. 260 |
| A | Registry not unique/atomic (A18.2/A18.8, C23.1/C23.4, C24.1/C24.4; A19.3, C12.2, C20.4, S04.2; C19.6, C20.9, S02.1) | **CONFIRMED**, and broader — see §3 below | Canon's own §15.6 standard |
| B | Scenario mappings materially false (A18.3→53, C13.4→62, C21→73, L03.15→86, L10.5/.6→88) | **CONFIRMED**, all five; plus more — see §4 | Canon §§15.7/16 |
| D | Per-LEAF traceability absent ("none of 368…") | **PARTIALLY CONFIRMED** — substance right, "none" overstated (A09.5, A14.2, C07.3, C07.7, A17.5 embed article refs in condition text) | — |
| E1 | A04/A05/A07/C22 code pointers misleading | **CONFIRMED** — operative code at `matchingValues.ts:249-258` and `matchingValues.ts:145-147` / `298-301` is unmapped; C22.1–.3's mapped constants are raise limits unrelated to those three obligations | Repository inspection |
| E2 | C14→C01 "unresolved dependency cycle" | **PARTIALLY CONFIRMED** — the map's own table (line 610) makes C14 a base of C01, schedules C01 (W4.1) before C14 (W4.2), and claims "no unit depends on a later one" (line 660). Real contradiction; **not a cycle** — the dependency is one-way | Code map §§5–6 |
| E3 | Stale "uncommitted / nothing pushed" receipt language | **CONFIRMED** — migration receipt line 5 and §10, **and also code map line 684**, while the work is committed at `9814939c` | Git history |
| — | Provenance/arithmetic/official-values PASS results | **CONFIRMED** — v1.0 blob hash, v1.1 checksum, 2026-27 release values ($164.961M cap / $200.428M tax / $209.015M / $221.686M / $148.465M / $15.044M / $6.064M / $9.366M), derived A/crossovers/tax-width/BAE/cash reproduce to the digit; EIPPA $900K for 2026-27 confirmed at VII §3(e)(1) | pr.nba.com release; independent recomputation |

## 3. Complete confirmed registry defects (Adjudication A)

The duplication is **systematic**, driven by two patterns: (a) §3 correction-table rows minted as LEAFs alongside their §5–§12 substantive twins, and (b) §4.2–4.4 "state ledger" rows duplicating the lifecycle rules they track. Confirmed duplicate ownership (one obligation, ≥2 owners):

- **Codex's three:** A18.2↔A18.8; C23.1↔C23.4; C24.1↔C24.4.
- **Additional confirmed:** A02.1↔(A02.5+A02.6); A02.2↔A02.8; A03.1↔A03.3; A05.1↔A05.2 (trigger vs formula of one rule); A06.1↔A06.2; A07.2↔A07.4; A08.1↔A08.2; A12.10↔(A12.3+A13); A14.1↔A14.2; C05.1↔C05.2; C08.1↔C08.4; C11.1⊂C11.9 (and C11.9's extinguishment clause duplicates C12.2's); C14.8↔C14.9; C21.1↔C21.8; L06.1↔L06.3; L08.1↔(L08.3+L08.6); S02.2/S02.3⊂S02.4; cross-family: C07.8↔C13.12 (SRPE apron add-back), C20.1↔R06.6 (three Two-Way limit), R08.1/R08.2/R08.5↔R08.3/R08.4. L01.5 (the whole calendar in one row) cross-duplicates every individual date rule (C19.1, C24.3, L04.8, …).

**Non-atomic leaves** (multiple independently pass/fail-able requirements in one row) — confirmed in this review: Codex's A19.3, C12.2, C20.4, S04.2, plus A02.4, A08.1, A09.3, C01.4 (five hold multipliers), C02.1, C13.7, C13.8, C13.10, C16.6, C19.1, C21.6, C23.5, C24.2, C24.5, L01.5, L04.8, L04.12, L04.16, R06.3, R09.2. (A21 is defensible as one leaf: it is a single prohibition with a conjunctive trigger.) The register violates the canon's own §15.6 standard, so the true LEAF count is materially above 368 after splitting and below it after deduplication — both totals in §15.6/§15.8 are wrong.

**Phantom/process rows** — confirmed: C19.6 (describes a gap that C19.1 already closes; pure phantom), C20.9 (phantom text — and it *hides a real gap*: the March 4 deadline is a genuine CBA rule, II §11(e)(i) p. 54, that no non-phantom leaf owns), S02.1 (development-process instruction from §1.2; inconsistently, §15.8 dispositions other §1.2 process rules as non-LEAF). Process-shaped borderline rows: A02.3, A02.6, S02.2, S02.3, and the "test at 0/25/100%" clause inside A03.1.

**Mis-parented:** C13.14 and C13.15 (signing-path menus under exception inventory), C20.8 (undrafted rookies under Two-Way), C16.6/C16.7 (max-salary shape under rookie/veteran extensions).

## 4. Complete confirmed scenario defects (Adjudication B)

All five Codex-cited mappings CONFIRMED false: A18.3→#53 (no signing-bonus-as-cash case; #53 also fails to exercise A18.6), C13.4→#62 (no proration case), C21.5/.6/.7/.9/.11→#73 (no payment-condition, deemed-bonus, Team-Salary-exclusion, or retained-into-season cases), L03.15→#86 (none of the five windows), L10.5/L10.6→#88 (no circumvention/collusion/tampering case).

Scenario-content corrections adjudicated: **#50 CONFIRMED** (conflates "traded" with "aggregated" — a solo re-trade inside two months is legal under VII §6(j)(4)(i); only aggregation is barred); **#53, #57 ("nine"→ten), #60 (equal-charge error), #67 (allocation basis), #68 (denominator), #69 (ETO case is backwards — an ETO that does *not* shorten the fourth season is the legal one)** all CONFIRMED; **#72 PARTIALLY** (its cases are individually sound — March 4 is CBA II §11(e)(i), conversion after the final game correctly fails — but it inherits C20.4/C20.6's wrong premises); **#47 and #83 PARTIALLY** (they assign architecture properties, A01.3 and "no ambient today," to SCEN when those are STATIC-shaped); **#48 NOT CONFIRMED** as a specific defect (adequate for A11 beyond the global weakness that no scenario states inputs/boundaries/expected results).

Additional defective mappings Codex did not cite: C05.3→#75, C14.6/C14.7→#63 (no clock-transfer or waiver-reset case), C16.3→#65 (no October 31 boundary), C22.1→#70 (no protection-increase case), C23.6→#68 (no loan-interest/premium case), C24.7→#69, A17.3→#45 (the protection+deferral case lives in #55), L03.3→#86 (physicals live in #88), and partial-only coverage for C06→#22 and A14.3→#43.

## 5. Confirmed substantive CBA errors (Adjudication C)

Items C1–C7 in the matrix, with exact locators as listed. Two labeling corrections rather than rule errors: A11 (component decomposition) and A18.7 (conditional cash) per C8/C9. Important scoping fact: I spot-checked the *adjacent* trade-family rules and they are **correct against the signed text** — A02's Expanded TPE formula (VII §6(j)(1)(iv)), A03's four OTS windows (VII §6(j)(6)), A04's base-year adjustment including the reimbursed-minimum clause (VII §6(j)(5)), A10.2's December 16 carve-out and A21's stacking rule (VII §6(j)(4)), A18's cash rules (VII §8(a)), the June 29/prior-to-June-25 deadlines (XII §4), the signing-bonus 15%/10% ceilings (II §12(a)(ii)–(iii)), and the Two-Way term/option/YOS rules (II §11(d)–(e)). The errors concentrate in the contract-shape/team-salary prose (§§5–8) — not a wholesale mistranslation, but far too many for a document whose header claims each rule was verified.

## 6. Findings rejected or overstated

1. "**None** of the 368 LEAF rows contains a primary-source article/subsection/page/URL" — overstated; five rows embed article references. The substantive point (no locator standard, label-only Authority column, family-level source map) stands.
2. "Unresolved dependency **cycle**" — overstated; C14→C01 is one-way. The scheduling contradiction is real.
3. ID mislabels: "C07.8" → actually C07.6; "A10.4" → actually A11.
4. Scenario 48 as a specific defect — not confirmed.
5. Codex's use of the external-truth audit's "never read the primary agreement" admission as evidence against the canon is rhetorically loose — that admission concerns the cap-engine audit, not canon v1.0 — but the conclusion it insinuated (v1.0's verification was incomplete) is independently proven by the errors themselves.

## 7. Confirmed code-map/dependency defects (Adjudication E)

- A04/A05 rows point at constants (`BYC_PERCENT`) and normalization atoms; the operative BYC max() and poison-pill averaging live at `src/features/architect/utils/tradeMachine/utils/matchingValues.ts:249-258` — unmapped.
- A07 rows point at `schemaAdapter.ts`/`mutationPipeline.helpers.ts` field plumbing; operative kicker math at `matchingValues.ts:145-147` and `matchingValues.ts:298-301` — unmapped.
- C22.1–C22.3 mapped to `EXTENSION_MAX_RAISE_PERCENT`/`OFFER_SHEET_MAX_RAISE_PCT` in `src/features/architect/utils/capLegalityValidation.ts` — relevant only to C22.4; C22.1–.3 should be NO SITE.
- W4.1/W4.2 order contradicts the map's own C14→C01 dependency and its "no unit depends on a later one" claim. Fix: settle C14 (Bird status) before C01 (holds) — reorder, or move C14 into W4.1, or extract Bird-status determination as a shared prerequisite. No cycle exists.
- Stale authoring-state language in the migration receipt (line 5, §10) **and code map §8 (line 684)**.

## 8. Dataset/source gaps (Adjudication F)

| Dataset | Status | Authority |
|---|---|---|
| 2024-25→2026-27 system levels & MLEs | **Official** — canon table matches the NBA release fetched during adjudication | pr.nba.com releases |
| Derived A/crossovers/tax width/BAE/cash | **DERIVED, verified** — reproduce exactly | VII §6(j)(1)(iv), §6(d), §8(a) |
| EIPPA | **Official-in-CBA, verified** — fixed table, $900K in 2026-27 | VII §3(e)(1), pp. 208–209 |
| Minimum-salary table | **DERIVED, not yet certified** — Exhibit C baseline chained by cap growth (Art. I §1(jj)); repo's 2026-27 table must be validated against that chain | CBA Exhibit C + I §1(jj) |
| Rookie Scale table | **DERIVED, not yet certified** — Exhibit B baseline chained (Art. I §1(iii)); no Phase 1 artifact validates it | CBA Exhibit B + I §1(iii)/(hhh) |
| Two-Way salary / protection max | **DERIVED** — 50% of 0-YOS minimum (II §11(a)(ii)); $75K × cap ratio (II §11(c)(ii)) | CBA II §11 |
| Exhibit 10 bonus range | Cap-indexed baseline in CBA; exact locator to be recorded in repair | CBA Art. II |
| 2026-27 season calendar / trade deadline | **Not yet officially published** as of 2026-07-14 — must be versioned as projected/unavailable | NBA schedule release (future) |
| 2026-27 EAPS | **Genuinely unpublished** — carry as explicit projection (consistent with audit finding #114) | none exists |

## 9–11. Canon status, repair scope, edition

**(9) Yes — Canon v1.1 must be marked rejected and superseded as the audit oracle.** Its header claim ("primary-source-verified") is falsified in part, and its register violates its own §15.6 standard. Keep v1.0/v1.1 checksums as historical provenance; do not erase them.

**(10) Bounded repair is not sufficient.** With seven confirmed material errors across four separate CBA articles found by sampling roughly twenty rules, the residual error rate cannot be bounded by known findings — and the canon's own release gate (§17 steps 1 and 9) requires a primary-source and citation check before any canon governs. **Full per-LEAF locator assignment is required**, and assigning a real locator *is* the per-rule verification, so the two tasks are one. The good news: the adjacent-provision checks show the trade-mechanics family is sound, so the certification is re-verification, not re-authoring.

**(11) Recommended edition: v2.0.** The change is substantive (rules, not just index), which breaks v1.1's "v1.0 verification carries forward" premise — a minor version would misrepresent that.

## 12. Repair plan — bounded fresh-session work units

1. **R1 — Substantive corrections (small, high-value):** fix the seven confirmed rule errors in canon prose + the two relabels (A11, A18.7), each with exact article/§/page cites; correct scenarios 50, 53, 57, 60, 67, 68, 69; rewrite §8.1 as the ten enumerated adjustments.
2. **R2 — Register standard:** write the atomicity/deduplication/locator standard (one obligation = one owner; a conjunctive-trigger prohibition is one leaf; §3/§4.x rows merge into their substantive twins; locator = authority type + article + §/subsection + exhibit + printed page or URL, or DERIVED chain, or OPS/EXT provenance).
3. **R3–R6 — Re-register by family with locators (A-series; C-series in two sessions; R/L/S-series):** apply R2, split non-atomic rows, delete phantom/process rows (minting a real owner for the March 4 deadline), re-parent misplaced rows, assign per-LEAF locators — verifying each rule against the signed text as the locator is assigned. Recompute all counts mechanically.
4. **R7 — Scenario library rewrite:** every scenario states input, boundary, and expected result; every SCEN leaf maps to a scenario that actually exercises it; add missing coverage (proration, signing-bonus-as-cash, window restrictions, circumvention/tampering EXT states, Bird-clock transfer, October 31).
5. **R8 — Code map re-reconciliation:** remap to the new register; fix A04/A05/A07/C22 pointers to the operative sites; reorder W4.1/W4.2 (or move C14 forward); refresh receipts (remove stale uncommitted language); publish v2.0 checksum + amendment receipt.
6. **R9 — Re-run acceptance Reviews A–F** at a newly pinned clean `main` commit.

## 13–14. Gates

- **Phase 1 remains BLOCKED.** The deliverable (a trustworthy canon + register + map) fails on all three legs.
- **W1.1 remains BLOCKED.** Its own execution units are defective as defined (S04.2 non-atomic, S02.1 process row, S02.2/.3 duplicates), and starting it against a register about to be renumbered would orphan its evidence. The one W1.1-relevant comfort: the season parameter *values* themselves verified clean against the official release.

---

**Validation actually run:** read-only git status/rev-parse/cat-file/log checks; SHA-256 checks (canon v1.1 file, v1.0 blob); full reads of the canon and all four Phase 1 artifacts; download + text extraction of the signed 2023 CBA (676 pp) and June 2024 By-Laws into the session scratchpad; targeted primary-text verification of ~25 provisions; mechanical parse of all 368 LEAF rows (counts, methods, scenario map, similarity sweep); repository inspection of the disputed code pointers; fetch of the official 2026-27 NBA release; independent recomputation of all derived arithmetic. **Intentionally skipped:** all npm test/build/typecheck/lint (read-only documentation adjudication, no app changes, no `RUN FULL SUITE`), graphify update, and any fixes.

**Confirmation:** the repository was untouched during adjudication — working tree clean at `9814939c`, no commits, branches, or file changes; all downloads and scripts lived in the session scratchpad only. Linear was not read or written. No Phase 2 work, no W1.1 work, and no repairs were performed.
