# Architect CBA Canon v2 — R5 C-Series Second-Half Certification

## Status

**Original R5 maker rejected; first focused repair re-rejected; bounded second
maker repair complete; independent re-review pending.** Exact maker checkpoint
`c11285aa9811b45a0e0f9b7f6493c3a73e12181f` was independently rejected
at review checkpoint `a1be249ce9c0ee9e1bcf54e0d511e2648ce3496f`.
The first focused repair at
`f92f4de887a72af9e0d8803e79917983eec4475b` was independently
re-rejected at `789097549ec67921a0f762d98048ca9b186366de`. This receipt now
also records the bounded second maker repair of exactly the ten residual
C14–C16 and C19–C25 findings on `architect/cba-canon-v2`. It does not accept
R5, perform or start the re-review, or unblock/start R6. Phase 2, Architect
comparison, application work, Linear, `main`, and prior accepted records
remain untouched.

Maker commit: **pending this checkpoint commit**.

## Primary-source verification

The maker directly verified the signed 2023 NBA–NBPA Collective Bargaining
Agreement already governed as `SRC2-001`: 2,850,534 bytes, 676 PDF pages,
SHA-256
`bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32`.
The verified source identity and pagination were unchanged, so no new SRC2
record was minted. The controlling provisions are CBA Articles I, II, VII,
VIII, X, XI, XII, XIII, XXV, and XXIX and Uniform Player Contract
Exhibit 10 within the same signed artifact. No secondary source certifies any
substantive rule, and no other primary artifact was needed for this scope.

## Coverage

The repaired R5 population contains 12 GROUPs, 297 active LEAFs, 297 evidence
components (`EV2-0280`–`EV2-0576`), 78 historical edges
(`XW2-0279`–`XW2-0356`), and seven decision records
(`DR2-0117`–`DR2-0123`). Together with accepted `XW2-0154`, every one
of the 79 published C14–C25 rows has an exhaustive current disposition.

| Family | Certified scope | Active LEAFs |
|---|---|---:|
| C14 | Bird clocks/status, renunciation, first-year authority, term/raises, one-year consent and rights consequences | 29 |
| C15 | Arenas Offer Sheet shape, Room preservation, and offering/matching Team Salary treatment | 13 |
| C16 | Rookie Scale, maximum/Higher Max, award thresholds, Rookie Scale and Veteran/Designated Veteran Extensions, undrafted rookie status | 50 |
| C17 | Over-38 triggers, age dates, zero Seasons, QVFA exception, allocation, recurring reattribution | 9 |
| C18 | ordinary, trade-earned, and every Extension-bonus timing/allocation branch | 16 |
| C19 | Ten-Day opening, duration, capacity, hardship, termination, successor and Rest-of-Season term/proration | 20 |
| C20 | Two-Way roster, compensation, eligibility, March 4, conversion, games, advances, protection, affiliate and rights rules | 35 |
| C21 | Exhibit 9/10 shape, limits, waiver/designation/reporting, payment exceptions and deadline, conversion, Team Salary, notice, and Summer Contract timing | 43 |
| C22 | protection progression, Minimum bonus exceptions, July 1 maximum adjustment order, annual changes | 19 |
| C23 | incentive caps/provisos, signing bonuses, deferral, international-player payments, loans, insurance premiums | 27 |
| C24 | Team/Player Options and ETO shape, protection, deadlines, notices, extension interactions | 22 |
| C25 | retired, pending, circumvention, and grievance Team Salary treatment and reconciliation | 14 |

## First focused repair history

The maker independently re-read every signed-2023-CBA provision cited by the
original review and attempted to repair all twelve C14–C25 rejection groups.
That first repair added 46 atomic or explicitly staged owners with matching
evidence components, corrected affected existing owners, locators, and
dependencies, and retargeted `XW2-0280` to `CBA2-C14.29` and `XW2-0324`
to `CBA2-C16.50`. The independent re-review accepted C17 and C18 but found
the ten residual findings closed below; therefore the first focused repair is
preserved as rejected history and does not certify the affected ten groups.

## Second maker repair closure

| Residual | Affected IDs | Controlling provision | Exact correction | Detail/dependency correction | Evidence/mapping correction and final verification |
|---|---|---|---|---|---|
| C14 | `CBA2-C14.27`–`.29`; `EV2-0287`, `EV2-0532`–`EV2-0534`; `XW2-0280` | I §1(t), (rr), (yy), pp. 3, 6–7; VII §4(g)(1), pp. 221–22 | Restored mutually exclusive at-or-below-Cap and above-Cap rescission branches with exact pre/post Team Salary comparisons; corrected Bird locators | Added renunciation-time Team Salary, post-rescission Team Salary, and Salary Cap inputs; aggregate routes through the applicable branch | Evidence now states each executable comparison and correct definition; mapping remains on the corrected aggregate; source→owner→detail→evidence→mapping PASS |
| C15 | `CBA2-C15.4`, `.12`, `.13`; `EV2-0307`, `EV2-0315`, `EV2-0535`; `XW2-0289` | XI §5(d)(i), (iii), pp. 323–24; VII §5(a)(1), pp. 226–27 | Relay now uses the ROFR Team’s written averaging-election statement; second-year rule states three separate five-percent bases | Inputs separately carry Salary excluding Incentive Compensation, Regular Salary, and each bonus; aggregate includes the exact election relay | Evidence supplies the triggering statement and all three bases; mapping remains on the corrected aggregate; source→record PASS |
| C16 | `CBA2-C16.25`, `.37`, `.46`, `.47`; `EV2-0340`, `EV2-0352`, `EV2-0544`, `EV2-0545` | VII §7(a)(3)(i), §7(a)(4), pp. 251–54 | Preserved the complete 140%-of-EAPS subtraction and replaced ten YOS with ten Seasons played for the current Team | Added first-year extended Incentive Compensation to `.25`; `.46`/`.47` now depend on `.44` and input current-Team Seasons; aggregate carries that predicate | Direct and aggregate evidence now states the current-Team-Seasons route; source→record PASS |
| C19 | `CBA2-C19.10`, `.18`; `EV2-0384`, `EV2-0392`; `XW2-0312` | II §9(f), p. 49 | Removed the unsupported accrued-through-termination qualifier; result is only sums set forth in Exhibit 1A | Detail requires the Ten-Day termination event and Exhibit 1A sums; aggregate dependency remains exact | Existing direct evidence already stated the exact result; mapping remains on the corrected aggregate; source→record PASS |
| C20 | `CBA2-C20.25`, `.26`, `.28`, `.34`; `EV2-0396`, `EV2-0418`, `EV2-0419`, `EV2-0421`, `EV2-0554` | II §11(c)(i)–(iii), pp. 53–54; VII §4(j), p. 225 | Uses Contract signing as the protection trigger and limits both excess-protection restrictions to that Salary Cap Year | Replaced agreement-date inputs with Contract signing date and added the assignment/termination Salary Cap Year to both restrictions and aggregate | Evidence matches the trigger/year and corrects §4(j) to p. 225; aggregate remains reconciled; source→record PASS |
| C21 | `CBA2-C21.10`, `.12`, `.13`, `.18`, `.20`, `.24`, `.34`, `.37`–`.39`, new `.43`; `EV2-0431`, `EV2-0433`, `EV2-0434`, `EV2-0439`, `EV2-0441`, `EV2-0445`, `EV2-0556`, `EV2-0559`–`EV2-0561`, new `EV2-0576` | II §3(s), pp. 21–23; VII §4(i), p. 225; UPC Exhibit 10, A-44–A-45 | Removed the invented 48-hour limit; distinguished NBA-Team Contracts; restored assignment, notice-to-player, Designating Team, Summer consideration, and thirty-day payment results | Added exact actor, affiliate, designation, service, notice-content, payment-date, and Summer-category inputs; `.24` now depends on new `.43` | Corrected every locator, including combined Exhibit 9/10 at II §3(s); added `EV2-0576`; existing historical mappings remain truthful; source→record PASS |
| C22 | `CBA2-C22.1`, `.2`, `.11`; `EV2-0446`, `EV2-0447`, `EV2-0456`; `XW2-0337` | II §4(i), pp. 28–29 | Restored the percentage of unearned protected Base Compensation and the conditional exception without a performance-standard restriction | Inputs now carry unearned amounts, percentages, condition, earliest satisfaction, and prior-Season completion; aggregate carries both branches | Evidence states the exact comparison and conditional exception; mapping remains on corrected aggregate; source→record PASS |
| C23 | `CBA2-C23.15`, `.17`; `EV2-0471`, `EV2-0473`; `XW2-0342`, `XW2-0343`, `XW2-0345`, `XW2-0346` | II §4(j)(ii), pp. 29–30; VII §3(g), p. 210 | States Minimum-contract exclusions, term-life election, coverage formula, Option-Year exclusion, $85 million branch, preferred-rate cap, and Salary exclusion | Detail now carries every eligibility, coverage, protection, Option, and premium-cap input; aggregate exposes the complete insurance result | Direct evidence cites both provisions and maps each prerequisite to Salary exclusion; historical mappings remain on corrected aggregate; source→record PASS |
| C24 | `CBA2-C24.8`, `.16`, `.20`; `EV2-0481`, `EV2-0489`, `EV2-0572`; `XW2-0349`, `XW2-0353` | XII §2(a), §4, pp. 337–38 | Removed the unsupported earlier-deadline prohibition and restored “last game of the Season” | Deadline detail now tests the signed June 29 limit only; alternative-B detail retains Team last-game and exercise-date inputs | Existing evidence already disclaimed an earlier-deadline inference and used “last game”; mappings remain truthful; source→record PASS |
| C25 | `CBA2-C25.10`–`.14`; `EV2-0500`, `EV2-0501`, `EV2-0527`, `EV2-0528`, `EV2-0575`; `XW2-0354`, `XW2-0356` | VII §4(a)(1)(iii)(D), p. 215; XIII §5(b)(ii), pp. 345–46 | Restored NBA-only Team notice, removed the invented year-crossing predicate, and compares the required Team Salary amount with the Team’s Room | Inputs now carry oral/written agreement, Team email and terms, delay/attempt and prohibited purpose, required amount, and Team Room | Evidence and both aggregates align with the direct duties; mappings remain on corrected aggregates; source→record PASS |

The second repair adds only `CBA2-C21.43` and `EV2-0576`; no crosswalk or
decision-record ID is added. Three published rows remain exact
`process-only` dispositions: C17.7 is an input checklist, and C19.6/C20.9 are
missing-owner notes. The actual January 5 and March 4 rules retain direct
owners. No `unsupported-residual`, OPS, or unavailable-source claim is
created.

## Atomicity

The maker applied the frozen GIVEN/WHEN/THEN test to all candidates. Direct
results split when a single input could change one result without changing
another. Closed enumerations remain together only where the same clause,
method, lifecycle, and one result govern every member. Historical composite
statements route to staged INFERRED compliance LEAFs whose dependencies expose
every direct result for later Architect verdicts.

## Decision records

| DR ID | Type | Subject(s) | Disposition | Test/tiebreak applied | Rationale | Resulting active LEAF(s) or — | Unit/commit |
|---|---|---|---|---|---|---|---|
| DR2-0117 | `ATOM` | R5 C14–C25 active construction | Split every independently changeable legal result; retain only closed same-result lists and explicit staged aggregate verdicts | GIVEN fixed facts, WHEN one legal input changes, THEN one direct result changes | Each active LEAF has one current result and evidence component; aggregate LEAFs depend on their direct owners | CBA2-C14.1, CBA2-C14.2, CBA2-C14.3, CBA2-C14.4, CBA2-C14.5, CBA2-C14.6, CBA2-C14.7, CBA2-C14.8, CBA2-C14.9, CBA2-C14.10, CBA2-C14.11, CBA2-C14.12, CBA2-C14.13, CBA2-C14.14, CBA2-C14.15, CBA2-C14.16, CBA2-C14.17, CBA2-C14.18, CBA2-C14.19, CBA2-C14.20, CBA2-C14.21, CBA2-C14.22, CBA2-C14.23, CBA2-C14.24, CBA2-C15.1, CBA2-C15.2, CBA2-C15.3, CBA2-C15.4, CBA2-C15.5, CBA2-C15.6, CBA2-C15.7, CBA2-C15.8, CBA2-C15.9, CBA2-C15.10, CBA2-C15.11, CBA2-C15.12, CBA2-C16.1, CBA2-C16.2, CBA2-C16.3, CBA2-C16.4, CBA2-C16.5, CBA2-C16.6, CBA2-C16.7, CBA2-C16.8, CBA2-C16.9, CBA2-C16.10, CBA2-C16.11, CBA2-C16.12, CBA2-C16.13, CBA2-C16.14, CBA2-C16.15, CBA2-C16.16, CBA2-C16.17, CBA2-C16.18, CBA2-C16.19, CBA2-C16.20, CBA2-C16.21, CBA2-C16.22, CBA2-C16.23, CBA2-C16.24, CBA2-C16.25, CBA2-C16.26, CBA2-C16.27, CBA2-C16.28, CBA2-C16.29, CBA2-C16.30, CBA2-C16.31, CBA2-C16.32, CBA2-C16.33, CBA2-C16.34, CBA2-C16.35, CBA2-C16.36, CBA2-C16.37, CBA2-C17.1, CBA2-C17.2, CBA2-C17.3, CBA2-C17.4, CBA2-C17.5, CBA2-C17.6, CBA2-C17.7, CBA2-C17.8, CBA2-C17.9, CBA2-C18.1, CBA2-C18.2, CBA2-C18.3, CBA2-C18.4, CBA2-C18.5, CBA2-C18.6, CBA2-C18.7, CBA2-C18.8, CBA2-C18.9, CBA2-C18.10, CBA2-C18.11, CBA2-C18.12, CBA2-C18.13, CBA2-C19.1, CBA2-C19.2, CBA2-C19.3, CBA2-C19.4, CBA2-C19.5, CBA2-C19.6, CBA2-C19.7, CBA2-C19.8, CBA2-C19.9, CBA2-C19.10, CBA2-C19.11, CBA2-C19.12, CBA2-C19.13, CBA2-C19.14, CBA2-C19.15, CBA2-C19.16, CBA2-C19.17, CBA2-C19.18, CBA2-C19.19, CBA2-C20.1, CBA2-C20.2, CBA2-C20.3, CBA2-C20.4, CBA2-C20.5, CBA2-C20.6, CBA2-C20.7, CBA2-C20.8, CBA2-C20.9, CBA2-C20.10, CBA2-C20.11, CBA2-C20.12, CBA2-C20.13, CBA2-C20.14, CBA2-C20.15, CBA2-C20.16, CBA2-C20.17, CBA2-C20.18, CBA2-C20.19, CBA2-C20.20, CBA2-C20.21, CBA2-C20.22, CBA2-C20.23, CBA2-C20.24, CBA2-C20.25, CBA2-C20.26, CBA2-C20.27, CBA2-C20.28, CBA2-C21.1, CBA2-C21.2, CBA2-C21.3, CBA2-C21.4, CBA2-C21.5, CBA2-C21.6, CBA2-C21.7, CBA2-C21.8, CBA2-C21.9, CBA2-C21.10, CBA2-C21.11, CBA2-C21.12, CBA2-C21.13, CBA2-C21.14, CBA2-C21.15, CBA2-C21.16, CBA2-C21.17, CBA2-C21.18, CBA2-C21.19, CBA2-C21.20, CBA2-C21.21, CBA2-C21.22, CBA2-C21.23, CBA2-C21.24, CBA2-C22.1, CBA2-C22.2, CBA2-C22.3, CBA2-C22.4, CBA2-C22.5, CBA2-C22.6, CBA2-C22.7, CBA2-C22.8, CBA2-C22.9, CBA2-C22.10, CBA2-C22.11, CBA2-C23.1, CBA2-C23.2, CBA2-C23.3, CBA2-C23.4, CBA2-C23.5, CBA2-C23.6, CBA2-C23.7, CBA2-C23.8, CBA2-C23.9, CBA2-C23.10, CBA2-C23.11, CBA2-C23.12, CBA2-C23.13, CBA2-C23.14, CBA2-C23.15, CBA2-C23.16, CBA2-C23.17, CBA2-C24.1, CBA2-C24.2, CBA2-C24.3, CBA2-C24.4, CBA2-C24.5, CBA2-C24.6, CBA2-C24.7, CBA2-C24.8, CBA2-C24.9, CBA2-C24.10, CBA2-C24.11, CBA2-C24.12, CBA2-C24.13, CBA2-C24.14, CBA2-C24.15, CBA2-C24.16, CBA2-C24.17, CBA2-C25.1, CBA2-C25.2, CBA2-C25.3, CBA2-C25.4, CBA2-C25.5, CBA2-C25.6, CBA2-C25.7, CBA2-C25.8, CBA2-C25.9, CBA2-C25.10, CBA2-C25.11, CBA2-C19.20, CBA2-C20.29, CBA2-C20.30, CBA2-C20.31, CBA2-C21.25, CBA2-C21.26, CBA2-C21.27, CBA2-C21.28, CBA2-C21.29, CBA2-C21.30, CBA2-C21.31, CBA2-C21.32, CBA2-C21.33, CBA2-C22.12, CBA2-C22.13, CBA2-C22.14, CBA2-C23.18, CBA2-C23.19, CBA2-C23.20, CBA2-C23.21, CBA2-C23.22, CBA2-C23.23, CBA2-C23.24, CBA2-C23.25, CBA2-C23.26, CBA2-C25.12, CBA2-C25.13, CBA2-C23.27, CBA2-C14.25, CBA2-C14.26, CBA2-C14.27, CBA2-C14.28, CBA2-C14.29, CBA2-C15.13, CBA2-C16.38, CBA2-C16.39, CBA2-C16.40, CBA2-C16.41, CBA2-C16.42, CBA2-C16.43, CBA2-C16.44, CBA2-C16.45, CBA2-C16.46, CBA2-C16.47, CBA2-C16.48, CBA2-C16.49, CBA2-C16.50, CBA2-C18.14, CBA2-C18.15, CBA2-C18.16, CBA2-C20.32, CBA2-C20.33, CBA2-C20.34, CBA2-C20.35, CBA2-C21.34, CBA2-C21.35, CBA2-C21.36, CBA2-C21.37, CBA2-C21.38, CBA2-C21.39, CBA2-C21.40, CBA2-C21.41, CBA2-C21.42, CBA2-C21.43, CBA2-C22.15, CBA2-C22.16, CBA2-C22.17, CBA2-C22.18, CBA2-C22.19, CBA2-C24.18, CBA2-C24.19, CBA2-C24.20, CBA2-C24.21, CBA2-C24.22, CBA2-C25.14 | R5 / this checkpoint |
| DR2-0118 | `OWN` | Published C14–C25 fragments, excluding already-governed CBA-C20.7:F1 | Route each exhaustive historical statement to its current direct or staged owner, or to an exact process-only disposition | Authority, atomic fit, natural family, then stable-ID tiebreak | XW2-0279–XW2-0356 plus accepted XW2-0154 disposition all 79 published rows without reopening prior identities | CBA2-C14.1, CBA2-C14.29, CBA2-C14.9, CBA2-C14.22, CBA2-C14.23, CBA2-C14.24, CBA2-C15.1, CBA2-C15.12, CBA2-C16.34, CBA2-C16.2, CBA2-C16.4, CBA2-C24.16, CBA2-C16.35, CBA2-C16.36, CBA2-C16.37, CBA2-C16.32, CBA2-C17.1, CBA2-C17.3, CBA2-C17.4, CBA2-C17.9, CBA2-C17.5, CBA2-C17.8, CBA2-C18.13, CBA2-C19.18, CBA2-C19.5, CBA2-C19.9, CBA2-C19.19, CBA2-C19.17, CBA2-C20.28, CBA2-C20.14, CBA2-C20.16, CBA2-C20.18, CBA2-C16.50, CBA2-C21.23, CBA2-C21.24, CBA2-C21.8, CBA2-C21.16, CBA2-C21.17, CBA2-C21.18, CBA2-C21.21, CBA2-C21.22, CBA2-C22.11, CBA2-C22.4, CBA2-C23.16, CBA2-C23.17, CBA2-C24.9, CBA2-C24.8, CBA2-C24.17, CBA2-C24.13, CBA2-C25.12, CBA2-C25.4, CBA2-C25.13 | R5 / this checkpoint |
| DR2-0119 | `ORIGIN` | Source-located C14–C25 obligations without a sole exact historical predecessor | Register direct primary-source components only | True-gap versus historical-fragment test | Each listed current obligation is directly supported by EV2-0280–EV2-0576 and does not conceal historical residue | CBA2-C14.2, CBA2-C14.3, CBA2-C14.4, CBA2-C14.6, CBA2-C14.7, CBA2-C14.8, CBA2-C14.10, CBA2-C14.11, CBA2-C14.12, CBA2-C14.13, CBA2-C14.14, CBA2-C14.15, CBA2-C14.16, CBA2-C14.17, CBA2-C14.18, CBA2-C14.19, CBA2-C14.20, CBA2-C14.21, CBA2-C15.2, CBA2-C15.3, CBA2-C15.4, CBA2-C15.5, CBA2-C15.6, CBA2-C15.7, CBA2-C15.8, CBA2-C15.9, CBA2-C15.10, CBA2-C15.11, CBA2-C16.1, CBA2-C16.3, CBA2-C16.5, CBA2-C16.6, CBA2-C16.7, CBA2-C16.8, CBA2-C16.9, CBA2-C16.10, CBA2-C16.11, CBA2-C16.12, CBA2-C16.13, CBA2-C16.14, CBA2-C16.15, CBA2-C16.16, CBA2-C16.17, CBA2-C16.18, CBA2-C16.19, CBA2-C16.20, CBA2-C16.21, CBA2-C16.22, CBA2-C16.23, CBA2-C16.24, CBA2-C16.25, CBA2-C16.26, CBA2-C16.27, CBA2-C16.28, CBA2-C16.29, CBA2-C16.30, CBA2-C16.31, CBA2-C16.33, CBA2-C17.2, CBA2-C17.6, CBA2-C17.7, CBA2-C18.1, CBA2-C18.2, CBA2-C18.3, CBA2-C18.4, CBA2-C18.5, CBA2-C18.6, CBA2-C18.7, CBA2-C18.8, CBA2-C18.9, CBA2-C18.10, CBA2-C18.11, CBA2-C18.12, CBA2-C19.1, CBA2-C19.2, CBA2-C19.3, CBA2-C19.4, CBA2-C19.6, CBA2-C19.7, CBA2-C19.8, CBA2-C19.10, CBA2-C19.11, CBA2-C19.12, CBA2-C19.13, CBA2-C19.14, CBA2-C19.15, CBA2-C19.16, CBA2-C20.1, CBA2-C20.2, CBA2-C20.3, CBA2-C20.4, CBA2-C20.5, CBA2-C20.6, CBA2-C20.7, CBA2-C20.8, CBA2-C20.9, CBA2-C20.10, CBA2-C20.11, CBA2-C20.12, CBA2-C20.13, CBA2-C20.15, CBA2-C20.17, CBA2-C20.19, CBA2-C20.20, CBA2-C20.21, CBA2-C20.22, CBA2-C20.23, CBA2-C20.24, CBA2-C20.25, CBA2-C20.26, CBA2-C20.27, CBA2-C21.1, CBA2-C21.2, CBA2-C21.3, CBA2-C21.4, CBA2-C21.5, CBA2-C21.6, CBA2-C21.7, CBA2-C21.9, CBA2-C21.10, CBA2-C21.11, CBA2-C21.12, CBA2-C21.13, CBA2-C21.14, CBA2-C21.15, CBA2-C21.19, CBA2-C21.20, CBA2-C22.1, CBA2-C22.2, CBA2-C22.3, CBA2-C22.5, CBA2-C22.6, CBA2-C22.7, CBA2-C22.8, CBA2-C22.9, CBA2-C22.10, CBA2-C23.1, CBA2-C23.2, CBA2-C23.3, CBA2-C23.4, CBA2-C23.5, CBA2-C23.6, CBA2-C23.7, CBA2-C23.8, CBA2-C23.9, CBA2-C23.10, CBA2-C23.11, CBA2-C23.12, CBA2-C23.13, CBA2-C23.14, CBA2-C23.15, CBA2-C24.1, CBA2-C24.2, CBA2-C24.3, CBA2-C24.4, CBA2-C24.5, CBA2-C24.6, CBA2-C24.7, CBA2-C24.10, CBA2-C24.11, CBA2-C24.12, CBA2-C24.14, CBA2-C24.15, CBA2-C25.1, CBA2-C25.2, CBA2-C25.3, CBA2-C25.5, CBA2-C25.6, CBA2-C25.7, CBA2-C25.8, CBA2-C25.9, CBA2-C25.10, CBA2-C25.11, CBA2-C19.20, CBA2-C20.29, CBA2-C20.30, CBA2-C20.31, CBA2-C21.25, CBA2-C21.26, CBA2-C21.27, CBA2-C21.28, CBA2-C21.29, CBA2-C21.30, CBA2-C21.31, CBA2-C21.32, CBA2-C21.33, CBA2-C22.12, CBA2-C22.13, CBA2-C22.14, CBA2-C23.18, CBA2-C23.19, CBA2-C23.20, CBA2-C23.21, CBA2-C23.22, CBA2-C23.23, CBA2-C23.24, CBA2-C23.25, CBA2-C23.26, CBA2-C23.27, CBA2-C14.5, CBA2-C14.25, CBA2-C14.26, CBA2-C14.27, CBA2-C14.28, CBA2-C15.13, CBA2-C16.38, CBA2-C16.39, CBA2-C16.40, CBA2-C16.41, CBA2-C16.42, CBA2-C16.43, CBA2-C16.44, CBA2-C16.45, CBA2-C16.46, CBA2-C16.47, CBA2-C16.48, CBA2-C16.49, CBA2-C18.14, CBA2-C18.15, CBA2-C18.16, CBA2-C20.32, CBA2-C20.33, CBA2-C20.34, CBA2-C20.35, CBA2-C21.34, CBA2-C21.35, CBA2-C21.36, CBA2-C21.37, CBA2-C21.38, CBA2-C21.39, CBA2-C21.40, CBA2-C21.41, CBA2-C21.42, CBA2-C21.43, CBA2-C22.15, CBA2-C22.16, CBA2-C22.17, CBA2-C22.18, CBA2-C22.19, CBA2-C24.18, CBA2-C24.19, CBA2-C24.20, CBA2-C24.21, CBA2-C24.22, CBA2-C25.14 | R5 / this checkpoint |
| DR2-0120 | `DISP` | CBA-C17.7:F1 | Terminal process-only disposition for the historical required-input checklist | Substantive legal obligation versus process instruction | The row prescribes implementation inputs rather than an independently enforceable NBA rule; the underlying Over-38 rules have direct current owners | — | R5 / this checkpoint |
| DR2-0121 | `TG` | CBA2-C20.17 | Register the signed March 4 Two-Way deadline separately from the historical missing-owner statement | True-gap/new-source-component test | CBA II §11(e)(i) directly states the deadline; historical C20.9 is process-only and cannot own it | CBA2-C20.17 | R5 / this checkpoint |
| DR2-0122 | `DISP` | CBA-C19.6:F1 | Terminal process-only disposition for the historical January 5 missing-owner note | Substantive legal obligation versus process instruction | The row announces an indexing gap rather than a separate rule; CBA2-C19.1 directly owns the January 5 rule | — | R5 / this checkpoint |
| DR2-0123 | `DISP` | CBA-C20.9:F1 | Terminal process-only disposition for the historical March 4 missing-owner note | Substantive legal obligation versus process instruction | The row announces an indexing gap rather than a separate rule; CBA2-C20.17 directly owns the March 4 rule | — | R5 / this checkpoint |

## DISP detail rows

| DR2 record ID | DISP subject class | Historical source LEAF or — | Historical fragment ID or — | Historical scenario or — | Scenario fragment ID or — | Normalized scope | Terminal edge ID | Terminal edge type | Search-manifest IDs or — | Search-set ID or — | Evidence/provenance references or — | No-owner reason | Preserved candidate anchor or — | Limitations | Reopening condition | Superseding/current relationship or — | Status | Version |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DR2-0120 | XW2-DISP | CBA-C17.7 | CBA-C17.7:F1 | — | — | span:0-142 | XW2-0310 | process-only | — | — | — | process-material | — | The historical statement records required implementation inputs rather than a substantive NBA rule | Reopen only if a later canon edition supplies a distinct substantive obligation for this exact fragment | — | current | 1 |
| DR2-0122 | XW2-DISP | CBA-C19.6 | CBA-C19.6:F1 | — | — | span:0-83 | XW2-0317 | process-only | — | — | — | process-material | — | The historical statement records a missing owner rather than a substantive NBA rule | Reopen only if a later canon edition supplies a distinct substantive obligation for this exact fragment | — | current | 1 |
| DR2-0123 | XW2-DISP | CBA-C20.9 | CBA-C20.9:F1 | — | — | span:0-90 | XW2-0325 | process-only | — | — | — | process-material | — | The historical statement records a missing owner rather than a substantive NBA rule | Reopen only if a later canon edition supplies a distinct substantive obligation for this exact fragment | — | current | 1 |

## Fragment inventory

The rows below cover all published C14–C25 rows except CBA-C20.7, whose
whole-row `CBA-C20.7:F1` fragment and `XW2-0154` moved owner were already
accepted in R3.1 and are not duplicated.

| Fragment ID | Historical parent LEAF | Fragment kind | Historical authority qualifier or — | Normalized fragment scope | Decomposition decision record | Disposition bundle ID or — | Disposition edge ID(s) | Fragment status | Fragment version | Limitations or — |
|---|---|---|---|---|---|---|---|---|---|---|
| CBA-C14.1:F1 | CBA-C14.1 | substantive-obligation | — | span:0-36 | DR2-0118 | — | XW2-0279 | current | 1 | — |
| CBA-C14.2:F1 | CBA-C14.2 | substantive-obligation | — | span:0-157 | DR2-0118 | — | XW2-0280 | current | 1 | — |
| CBA-C14.3:F1 | CBA-C14.3 | substantive-obligation | — | span:0-89 | DR2-0118 | — | XW2-0281 | current | 1 | — |
| CBA-C14.4:F1 | CBA-C14.4 | substantive-obligation | — | span:0-186 | DR2-0118 | — | XW2-0282 | current | 1 | — |
| CBA-C14.5:F1 | CBA-C14.5 | substantive-obligation | — | span:0-112 | DR2-0118 | — | XW2-0283 | current | 1 | — |
| CBA-C14.6:F1 | CBA-C14.6 | substantive-obligation | — | span:0-58 | DR2-0118 | — | XW2-0284 | current | 1 | — |
| CBA-C14.7:F1 | CBA-C14.7 | substantive-obligation | — | span:0-154 | DR2-0118 | — | XW2-0285 | current | 1 | — |
| CBA-C14.8:F1 | CBA-C14.8 | substantive-obligation | — | span:0-140 | DR2-0118 | — | XW2-0286 | current | 1 | — |
| CBA-C14.9:F1 | CBA-C14.9 | substantive-obligation | — | span:0-139 | DR2-0118 | — | XW2-0287 | current | 1 | — |
| CBA-C15.1:F1 | CBA-C15.1 | substantive-obligation | — | span:0-79 | DR2-0118 | — | XW2-0288 | current | 1 | — |
| CBA-C15.2:F1 | CBA-C15.2 | substantive-obligation | — | span:0-220 | DR2-0118 | — | XW2-0289 | current | 1 | — |
| CBA-C16.1:F1 | CBA-C16.1 | substantive-obligation | — | span:0-75 | DR2-0118 | — | XW2-0290 | current | 1 | — |
| CBA-C16.2:F1 | CBA-C16.2 | substantive-obligation | — | span:0-89 | DR2-0118 | — | XW2-0291 | current | 1 | — |
| CBA-C16.3:F1 | CBA-C16.3 | substantive-obligation | — | span:0-69 | DR2-0118 | — | XW2-0292 | current | 1 | — |
| CBA-C16.4:F1 | CBA-C16.4 | substantive-obligation | — | span:0-120 | DR2-0118 | — | XW2-0293 | current | 1 | — |
| CBA-C16.5:F1 | CBA-C16.5 | substantive-obligation | — | span:0-101 | DR2-0118 | — | XW2-0294 | current | 1 | — |
| CBA-C16.6:F1 | CBA-C16.6 | substantive-obligation | — | span:0-153 | DR2-0118 | — | XW2-0295 | current | 1 | — |
| CBA-C16.7:F1 | CBA-C16.7 | substantive-obligation | — | span:0-104 | DR2-0118 | — | XW2-0296 | current | 1 | — |
| CBA-C16.8:F1 | CBA-C16.8 | substantive-obligation | — | span:0-123 | DR2-0118 | — | XW2-0297 | current | 1 | — |
| CBA-C16.9:F1 | CBA-C16.9 | substantive-obligation | — | span:0-90 | DR2-0118 | — | XW2-0298 | current | 1 | — |
| CBA-C16.10:F1 | CBA-C16.10 | substantive-obligation | — | span:0-56 | DR2-0118 | — | XW2-0299 | current | 1 | — |
| CBA-C16.11:F1 | CBA-C16.11 | substantive-obligation | — | span:0-133 | DR2-0118 | — | XW2-0300 | current | 1 | — |
| CBA-C16.12:F1 | CBA-C16.12 | substantive-obligation | — | span:0-146 | DR2-0118 | — | XW2-0301 | current | 1 | — |
| CBA-C16.13:F1 | CBA-C16.13 | substantive-obligation | — | span:0-118 | DR2-0118 | — | XW2-0302 | current | 1 | — |
| CBA-C16.14:F1 | CBA-C16.14 | substantive-obligation | — | span:0-68 | DR2-0118 | — | XW2-0303 | current | 1 | — |
| CBA-C17.1:F1 | CBA-C17.1 | substantive-obligation | — | span:0-139 | DR2-0118 | — | XW2-0304 | current | 1 | — |
| CBA-C17.2:F1 | CBA-C17.2 | substantive-obligation | — | span:0-69 | DR2-0118 | — | XW2-0305 | current | 1 | — |
| CBA-C17.3:F1 | CBA-C17.3 | substantive-obligation | — | span:0-135 | DR2-0118 | — | XW2-0306 | current | 1 | — |
| CBA-C17.4:F1 | CBA-C17.4 | substantive-obligation | — | span:0-189 | DR2-0118 | — | XW2-0307 | current | 1 | — |
| CBA-C17.5:F1 | CBA-C17.5 | substantive-obligation | — | span:0-90 | DR2-0118 | — | XW2-0308 | current | 1 | — |
| CBA-C17.6:F1 | CBA-C17.6 | substantive-obligation | — | span:0-102 | DR2-0118 | — | XW2-0309 | current | 1 | — |
| CBA-C17.7:F1 | CBA-C17.7 | process-instruction | — | span:0-142 | DR2-0120 | — | XW2-0310 | current | 1 | — |
| CBA-C18:F1 | CBA-C18 | substantive-obligation | — | span:0-195 | DR2-0118 | — | XW2-0311 | current | 1 | — |
| CBA-C19.1:F1 | CBA-C19.1 | substantive-obligation | — | span:0-104 | DR2-0118 | — | XW2-0312 | current | 1 | — |
| CBA-C19.2:F1 | CBA-C19.2 | substantive-obligation | — | span:0-104 | DR2-0118 | — | XW2-0313 | current | 1 | — |
| CBA-C19.3:F1 | CBA-C19.3 | substantive-obligation | — | span:0-77 | DR2-0118 | — | XW2-0314 | current | 1 | — |
| CBA-C19.4:F1 | CBA-C19.4 | substantive-obligation | — | span:0-121 | DR2-0118 | — | XW2-0315 | current | 1 | — |
| CBA-C19.5:F1 | CBA-C19.5 | substantive-obligation | — | span:0-77 | DR2-0118 | — | XW2-0316 | current | 1 | — |
| CBA-C19.6:F1 | CBA-C19.6 | process-instruction | — | span:0-83 | DR2-0122 | — | XW2-0317 | current | 1 | — |
| CBA-C20.1:F1 | CBA-C20.1 | substantive-obligation | — | span:0-97 | DR2-0118 | — | XW2-0318 | current | 1 | — |
| CBA-C20.2:F1 | CBA-C20.2 | substantive-obligation | — | span:0-94 | DR2-0118 | — | XW2-0319 | current | 1 | — |
| CBA-C20.3:F1 | CBA-C20.3 | substantive-obligation | — | span:0-100 | DR2-0118 | — | XW2-0320 | current | 1 | — |
| CBA-C20.4:F1 | CBA-C20.4 | substantive-obligation | — | span:0-144 | DR2-0118 | — | XW2-0321 | current | 1 | — |
| CBA-C20.5:F1 | CBA-C20.5 | substantive-obligation | — | span:0-162 | DR2-0118 | — | XW2-0322 | current | 1 | — |
| CBA-C20.6:F1 | CBA-C20.6 | substantive-obligation | — | span:0-82 | DR2-0118 | — | XW2-0323 | current | 1 | — |
| CBA-C20.8:F1 | CBA-C20.8 | substantive-obligation | — | span:0-122 | DR2-0118 | — | XW2-0324 | current | 1 | — |
| CBA-C20.9:F1 | CBA-C20.9 | process-instruction | — | span:0-90 | DR2-0123 | — | XW2-0325 | current | 1 | — |
| CBA-C21.1:F1 | CBA-C21.1 | substantive-obligation | — | span:0-94 | DR2-0118 | — | XW2-0326 | current | 1 | — |
| CBA-C21.2:F1 | CBA-C21.2 | substantive-obligation | — | span:0-136 | DR2-0118 | — | XW2-0327 | current | 1 | — |
| CBA-C21.3:F1 | CBA-C21.3 | substantive-obligation | — | span:0-61 | DR2-0118 | — | XW2-0328 | current | 1 | — |
| CBA-C21.4:F1 | CBA-C21.4 | substantive-obligation | — | span:0-86 | DR2-0118 | — | XW2-0329 | current | 1 | — |
| CBA-C21.5:F1 | CBA-C21.5 | substantive-obligation | — | span:0-94 | DR2-0118 | — | XW2-0330 | current | 1 | — |
| CBA-C21.6:F1 | CBA-C21.6 | substantive-obligation | — | span:0-160 | DR2-0118 | — | XW2-0331 | current | 1 | — |
| CBA-C21.7:F1 | CBA-C21.7 | substantive-obligation | — | span:0-79 | DR2-0118 | — | XW2-0332 | current | 1 | — |
| CBA-C21.8:F1 | CBA-C21.8 | substantive-obligation | — | span:0-116 | DR2-0118 | — | XW2-0333 | current | 1 | — |
| CBA-C21.9:F1 | CBA-C21.9 | substantive-obligation | — | span:0-86 | DR2-0118 | — | XW2-0334 | current | 1 | — |
| CBA-C21.10:F1 | CBA-C21.10 | substantive-obligation | — | span:0-113 | DR2-0118 | — | XW2-0335 | current | 1 | — |
| CBA-C21.11:F1 | CBA-C21.11 | substantive-obligation | — | span:0-106 | DR2-0118 | — | XW2-0336 | current | 1 | — |
| CBA-C22.1:F1 | CBA-C22.1 | substantive-obligation | — | span:0-148 | DR2-0118 | — | XW2-0337 | current | 1 | — |
| CBA-C22.2:F1 | CBA-C22.2 | substantive-obligation | — | span:0-134 | DR2-0118 | — | XW2-0338 | current | 1 | — |
| CBA-C22.3:F1 | CBA-C22.3 | substantive-obligation | — | span:0-171 | DR2-0118 | — | XW2-0339 | current | 1 | — |
| CBA-C22.4:F1 | CBA-C22.4 | substantive-obligation | — | span:0-151 | DR2-0118 | — | XW2-0340 | current | 1 | — |
| CBA-C23.1:F1 | CBA-C23.1 | substantive-obligation | — | span:0-81 | DR2-0118 | — | XW2-0341 | current | 1 | — |
| CBA-C23.2:F1 | CBA-C23.2 | substantive-obligation | — | span:0-113 | DR2-0118 | — | XW2-0342 | current | 1 | — |
| CBA-C23.3:F1 | CBA-C23.3 | substantive-obligation | — | span:0-133 | DR2-0118 | — | XW2-0343 | current | 1 | — |
| CBA-C23.4:F1 | CBA-C23.4 | substantive-obligation | — | span:0-146 | DR2-0118 | — | XW2-0344 | current | 1 | — |
| CBA-C23.5:F1 | CBA-C23.5 | substantive-obligation | — | span:0-192 | DR2-0118 | — | XW2-0345 | current | 1 | — |
| CBA-C23.6:F1 | CBA-C23.6 | substantive-obligation | — | span:0-117 | DR2-0118 | — | XW2-0346 | current | 1 | — |
| CBA-C24.1:F1 | CBA-C24.1 | substantive-obligation | — | span:0-103 | DR2-0118 | — | XW2-0347 | current | 1 | — |
| CBA-C24.2:F1 | CBA-C24.2 | substantive-obligation | — | span:0-150 | DR2-0118 | — | XW2-0348 | current | 1 | — |
| CBA-C24.3:F1 | CBA-C24.3 | substantive-obligation | — | span:0-51 | DR2-0118 | — | XW2-0349 | current | 1 | — |
| CBA-C24.4:F1 | CBA-C24.4 | substantive-obligation | — | span:0-99 | DR2-0118 | — | XW2-0350 | current | 1 | — |
| CBA-C24.5:F1 | CBA-C24.5 | substantive-obligation | — | span:0-134 | DR2-0118 | — | XW2-0351 | current | 1 | — |
| CBA-C24.6:F1 | CBA-C24.6 | substantive-obligation | — | span:0-109 | DR2-0118 | — | XW2-0352 | current | 1 | — |
| CBA-C24.7:F1 | CBA-C24.7 | substantive-obligation | — | span:0-76 | DR2-0118 | — | XW2-0353 | current | 1 | — |
| CBA-C25.1:F1 | CBA-C25.1 | substantive-obligation | — | span:0-93 | DR2-0118 | — | XW2-0354 | current | 1 | — |
| CBA-C25.2:F1 | CBA-C25.2 | substantive-obligation | — | span:0-62 | DR2-0118 | — | XW2-0355 | current | 1 | — |
| CBA-C25.3:F1 | CBA-C25.3 | substantive-obligation | — | span:0-94 | DR2-0118 | — | XW2-0356 | current | 1 | — |

## Boundary and validation

The second R5 maker repair changes only the canon, governing plan, and this
concise receipt. It introduces no schema, taxonomy, ID grammar, validator,
registry model, proof/lineage system, bundle, search-manifest, or
infrastructure change.

- Signed-source reacquisition and identity — PASS: the official governed PDF is
  2,850,534 bytes, 676 pages, with SHA-256
  `bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32`.
- Targeted read-only population, dependency, origin, mapping, and preservation
  controls — PASS: 37 GROUPs; 568 LEAF-main rows plus 568 matching LEAF-detail
  rows (297 from R5); 351 XW2 edges; 576 EV2 components; 123 DR2 records; and
  341 fragments. The only second-repair additions are `CBA2-C21.43` and
  `EV2-0576`; all 257 unaffected R5 owners and details are byte-identical to the
  re-rejection checkpoint; C17/C18 owners, details, evidence, and mappings are
  byte-identical; the affected mappings resolve to their final targets; and the
  independent review remains byte-identical at SHA-256
  `0435942f832eeedf0bb40a39288c36e82066aa86eb94b4e51c7f2b9c6b84e67a`.
- `python3
  work/architect-completion/cba_canon_v2_foundation_validator.py` — the frozen
  full-document integration check ran all 14 accepting and 109 rejecting
  controls; every control passed and the negative self-test failed as intended.
  The command exits 1 only because the same seven inherited post-R4
  plan-wording diagnostics make its legacy `baseline_clean` summary false; it
  reports no repair-local diagnostic.
- The optional frozen `--extended` historical diagnostic mode was intentionally
  not run. Its known hard-coded `R2.10 foundation` wording anchor is stale, and
  changing that out-of-scope validator or plan wording is not part of this
  bounded repair.
- Touched-file Markdown lint — the plan and this receipt pass. The canon reports
  only its 74 preserved MD029 findings in unchanged numbered scenario blocks;
  the identical 74 findings reproduce against the re-rejection checkpoint
  `789097549ec67921a0f762d98048ca9b186366de`.
- `npm run docs:guardrails` — PASS.
- `npm run validate:project` — PASS.
- `git diff --check` — PASS.
- Scope confirmation — exactly the canon, governing plan, and this receipt are
  changed; no source, validator, schema, application, test, configuration,
  data, graph-output, Linear, `main`, independent re-review, or R6 work
  occurred.

R5 awaits independent re-review. R6 remains blocked and unstarted.

## C14 historical-routing closure addendum

The bounded second maker repair at
`ed87937010b607a3572fb301e8d238d8ef632b32` was independently
focused-rejected at checker commit
`522170cdc3fc6c2bbf185070bd7212fefdb1b86c` solely because
`XW2-0280`'s whole-fragment route through `CBA2-C14.29` omitted the
already-correct later Bird-history result in `CBA2-C14.8` / `EV2-0287`.
This closure repair adds those existing owner and evidence components to the
`CBA2-C14.29` / `EV2-0534` dependency chains and exposes the later-signing,
service-history, and team-history inputs. The mapping, all IDs, and all
population counts remain unchanged.

Closure-repair commit: **pending this checkpoint commit**. R5 awaits a final
single-finding independent re-review. R6 remains blocked and unstarted.
