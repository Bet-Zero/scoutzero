# Architect CBA Canon — Phase 1 Index-Completeness & Traceability Review

**Phase:** 1 of 2 — bounded continuation. **Index completeness only.**  
**Canon:** `docs/reference/cba/ARCHITECT_CBA_CANON.md` (SHA-256 `b8cf5d01356b3a83de4663f5bd6843e9aa58c8c06a84227385ae93bc02d969ef`, verified byte-identical at HEAD)  
**Code map:** `work/architect-completion/ARCHITECT_CBA_CANON_CODE_MAP.md` (56 audit IDs)  
**Repo state:** branch `main`, commit `c859be7817430e04fb4c709e2111b1689abb31be`, working tree clean, 3 commits ahead of `origin/main`  
**Date:** 2026-07-14

---

## 0. What this document is — and is not

This asks one question: **is every substantive, checkable requirement already written into the canon represented by an audit ID or an explicit subcheck?** It reviews the whole canon, not only the §15 register.

It assigns **no Architect PASS/FAIL verdicts**. It does not say whether any rule is implemented, correct, or in V1 scope. It is an audit of the *index*, not of the product.

Boundaries observed:

- The canon was **not** edited. The code map was **not** edited. No application code, test, fixture, schema, constant, configuration, or data file was touched.
- **No IDs are minted.** Everything in §6 and §7 is a recommendation for owner approval.
- No Linear issue was created or changed. Nothing was committed or pushed. **Phase 2 was not started.**

---

## 1. Method

Every section of the canon (§§1–19) was read and decomposed into **atomic implementation obligations** — the smallest unit that could independently pass or fail. A rule stating four date windows is four obligations, not one, because an engine can get two right and two wrong.

Each obligation carries: canon section, textual locator (line number in the canon file), the requirement, its authority label (CBA / BYL / NBA / DERIVED / OPS / EXT), the existing audit ID(s) that cover it, a coverage classification, and any §16 acceptance scenario that exercises it.

### 1.1 Classifications

| Class | Meaning |
|---|---|
| **Fully indexed** | An existing audit ID asks this exact question. A Phase 2 reviewer working that ID would have to look at this requirement. |
| **Partially indexed** | An existing ID names the transaction or rule family, but this specific legal condition is not what the ID asks. A truthful verdict on the ID could be reached without ever testing this condition. |
| **No audit ID** | No ID in the register points at this requirement. A Phase 2 driven only by the 56 IDs would never look at it. |
| **Reference/informational** | Canon prose that legislates nothing new (definitions, executive summary, sequencing advice). |
| **Operational / externally adjudicated** | An obligation on the audit or canon-maintenance process, or on an external determination, rather than on deterministic engine behavior. |

*Acceptance coverage is tracked as a separate axis*, because "indexed but lacking an acceptance scenario" is orthogonal to whether an ID exists. Both counts are reported.

### 1.2 Counting rule

Every total in this document is computed by script over the §10 enumeration table, not counted by eye. See §9 to reproduce.

---

## 2. Headline result

The 56 IDs are **not exhaustive**. They were mapped successfully because they are real, not because they are complete.

- **365** substantive implementation obligations exist in the canon.
- **77** of them (21%) have **no audit ID at all**.
- **83** more (22%) are only partially indexed — an ID names the rule family but does not ask this condition.
- **11 of the 56 existing IDs** have no acceptance scenario anywhere in §16.
- **One acceptance scenario (§16 #10) tests a rule that has no audit ID.** The canon already knows the rule matters; the register just never named it.

The two gaps the code map already flagged (§3.1 season parameters, §12.8 sign-and-trade) were **correct but not the whole list**. Nine further canon sections — §5.1, §5.2, §5.3, §5.7, §5.9, §6.3, §6.5, §12.6, and §12.9 — carry implementation obligations with zero or near-zero audit representation.

---

## 3. Mechanical totals

### 3.1 Coverage classification

| Classification | Count | Share of all rows |
|---|---:|---:|
| Fully indexed | **205** | 53.7% |
| Partially indexed | **83** | 21.7% |
| No audit ID | **77** | 20.2% |
| Reference/informational | **9** | 2.4% |
| Operational / externally adjudicated | **8** | 2.1% |
| **Total rows enumerated** | **382** | 100% |

Of these, **365** are substantive implementation obligations (fully + partially indexed + no ID). The remaining **17** are reference prose or obligations on the audit/canon process itself.

### 3.2 Acceptance coverage (separate axis)

| Measure | Count |
|---|---:|
| Indexed obligations (fully or partially) | 288 |
| …of which carry **no** §16 acceptance scenario | **123** |
| Existing audit IDs with **zero** acceptance scenarios | **11** of 56 |
| Indexed obligations sitting under an ID with zero acceptance scenarios | 75 |
| §16 scenarios that point to no audit ID | **1** (#10) |

---

## 4. Reverse checks

### 4.1 Every existing ID points to controlling canon text

**Result: all 56 pass.** Every `CBA-A/C/R/L` ID anchors to at least one atomic obligation in the canon body. No ID is invented, orphaned, or pointing at prose that legislates nothing. Two carry an authority caveat rather than a defect:

- **A15** is **OPS** by the canon's own classification (§12.2, §19.3) — the two-other-team touch rule and asset thresholds are not in the public primary text. It may never produce a deterministic CBA verdict.
- **C12, R10, L10** depend on **EXT** determinations. They index the *representation* obligation, not a medical or league finding.

### 4.2 Existing IDs with no acceptance scenario

**11 of 56 IDs are indexed but untested by the §16 library.** These carry 75 atomic obligations between them.

| ID | Audit question | Indexed obligations | Why the absence matters |
|---|---|---:|---|
| **CBA-A01** | Team/Apron/Tax/ITS/OTS derived separately | 4 | The ledger-separation question the code map calls upstream of most other rows. No scenario forces Team/Apron/Tax/ITS/OTS to differ. |
| **CBA-A11** | Per-team TPE optimization + decomposition | 1 | No scenario exercises per-team TPE optimization or legal component decomposition. |
| **CBA-A18** | Cash sent/received tracked separately; Second Apron block | 10 | §16 contains **no cash-in-trade scenario at all** — not the separate sent/received limits, not the no-netting rule, not the Second Apron block. |
| **CBA-C10** | 90% minimum-team-salary process | 5 | The 90% floor process (season-start charge, in-season floor, year-end reconciliation) is untested end to end. |
| **CBA-C15** | Arenas offer sheets valued differently for offering vs matching team | 3 | Arenas valuation asymmetry (offering vs matching team) is untested. Scenario 25 tests the RFA hold, not the Arenas schedule. |
| **CBA-C16** | Rookie options, extensions, Higher Max, declined-option caps | 17 | The largest untested ID — 17 obligations spanning rookie options, extensions, Higher Max, and declined-option caps. |
| **CBA-C18** | Signing bonuses allocated by guaranteed proportions | 2 | Signing-bonus allocation by guaranteed proportion has no scenario. |
| **CBA-R01** | Waiver frees slot immediately; 48-hour claim state | 7 | The 48-hour claim window and immediate slot release have no scenario; scenario 36 tests trade slots, not waivers. |
| **CBA-R10** | Hardship / suspension-list / treatment-program states explicit | 5 | Hardship, suspension-list, and treatment-program states are untested (and EXT-gated). |
| **CBA-L01** | Every hypothetical evaluated on an explicit date | 9 | Dated evaluation is assumed by many scenarios but asserted by none. |
| **CBA-L10** | Externally adjudicated states settable with provenance | 12 | External-determination provenance has no scenario — the one place the canon insists on 'assumption required' instead of PASS/FAIL. |

### 4.3 Every acceptance scenario points to a requirement

**45 of 46 pass.** All 46 scenarios trace to at least one canon requirement. **Scenario #10 traces to a requirement that has no audit ID:**

> **§16 #10** — *"Three minimum contracts stacked outside the allowed date window with fewer players returning."*
> Controlling text: **§12.6** (minimum-contract stacking). **No `CBA-A/C/R/L` ID covers §12.6.**

This is the clearest single proof that the register is incomplete: the canon wrote the regression test but never minted the ID it tests. A Phase 2 driven by the 56 IDs would run scenario 10 under no owner, or not at all.

### 4.4 Existing IDs too broad to produce a single reliable verdict

**19 IDs carry 8 or more atomic obligations.** A single Covered/Partial/Missing verdict on these is not truthful — the components can and will disagree.

| ID | Atomic obligations | Canon sections spanned | Fully indexed | Partially indexed |
|---|---:|---:|---:|---:|
| **CBA-L03** | 20 | 15 | 16 | 4 |
| **CBA-L04** | 19 | 10 | 14 | 5 |
| **CBA-C16** | 17 | 6 | 9 | 8 |
| **CBA-A12** | 15 | 7 | 11 | 4 |
| **CBA-C13** | 13 | 6 | 11 | 2 |
| **CBA-C07** | 13 | 4 | 10 | 3 |
| **CBA-L10** | 12 | 5 | 7 | 5 |
| **CBA-L05** | 12 | 6 | 9 | 3 |
| **CBA-L02** | 11 | 5 | 3 | 8 |
| **CBA-C14** | 10 | 6 | 7 | 3 |
| **CBA-A18** | 10 | 6 | 7 | 3 |
| **CBA-L01** | 9 | 6 | 7 | 2 |
| **CBA-A02** | 9 | 4 | 5 | 4 |
| **CBA-R08** | 8 | 4 | 6 | 2 |
| **CBA-R06** | 8 | 3 | 4 | 4 |
| **CBA-R04** | 8 | 4 | 7 | 1 |
| **CBA-R02** | 8 | 4 | 6 | 2 |
| **CBA-L09** | 8 | 5 | 7 | 1 |
| **CBA-A17** | 8 | 2 | 5 | 3 |

The worst offenders and why:

- **L03** (20 obligations, 15 sections) is really *every date-and-consent restriction in the CBA*. It bundles the 30-day rookie rule, the six-month renegotiation rule, the one-year Designated Veteran rule, matched-offer-sheet bans, express no-trade eligibility, and the moratorium. Any of these can be present while the others are absent.
- **L04** (19 obligations) bundles RFA eligibility, QO timing, QO *shape*, Maximum QO shape, Two-Way QO rules, withdrawal semantics, offer-sheet timing, and matching. The QO can be issued on the right date and still be the wrong contract.
- **C16** (17 obligations) bundles four distinct rule families: rookie option decisions, rookie extensions, veteran extensions, and Higher Max. It is also **untested** (§4.2).
- **A12** (15 obligations) is the entire apron transaction table — ten separate prohibited transactions across two aprons.
- **C07** (13 obligations) is nine enumerated add-backs plus the before/after rule. Eight can be right and one wrong, and the apron verdict is still wrong.

### 4.5 Requirements whose components could produce mixed compliance

**40 of 56 IDs already show mixed coverage in this review** — at least one obligation fully indexed and at least one only partially indexed under the same ID. These are exactly the IDs where a single verdict will paper over a real gap:

`CBA-A01`, `CBA-A02`, `CBA-A04`, `CBA-A06`, `CBA-A07`, `CBA-A10`, `CBA-A12`, `CBA-A14`, `CBA-A15`, `CBA-A16`, `CBA-A17`, `CBA-A18`, `CBA-C01`, `CBA-C02`, `CBA-C05`, `CBA-C07`, `CBA-C08`, `CBA-C10`, `CBA-C11`, `CBA-C12`, `CBA-C13`, `CBA-C14`, `CBA-C16`, `CBA-C17`, `CBA-C18`, `CBA-L01`, `CBA-L02`, `CBA-L03`, `CBA-L04`, `CBA-L05`, `CBA-L07`, `CBA-L09`, `CBA-L10`, `CBA-R01`, `CBA-R02`, `CBA-R04`, `CBA-R05`, `CBA-R06`, `CBA-R08`, `CBA-R10`

The sharpest cases:

- **A07** (trade bonus): 1 obligation fully indexed, 5 only partially. The ID asks whether the allocation reaches ITS; it does not ask about the 15% ceiling, the once-only trigger, the guaranteed-base denominator, or who pays.
- **C11** (DPE vs long-term exclusion): 2 fully indexed, 4 partially. The ID asks whether they are *separate workflows*; it does not ask about the exclusion's prerequisites, eligible-team test, permanent re-acquisition ban, or 25-game return.
- **C17** (Over-38): 3 fully indexed, 4 partially. The reallocation math is indexed; the *applicability test* that decides whether reallocation happens at all is not.
- **L02** (event-driven lifecycle): 3 fully indexed, 8 partially. Renegotiation in particular is four unindexed conditions under an ID the code map already calls "one vestigial field".

---

## 5. Canon sections with implementation obligations but no audit representation

### 5.1 Zero representation

| Canon § | Obligations | Subject |
|---|---:|---|
| **§1.2** | 1 | Rule-record contract (audit-process obligation) |
| **§5.1** | 5 | Ten-Day and Rest-of-Season contracts |
| **§5.3** | 10 | Exhibit 10 and Exhibit 9 contracts |
| **§12.6** | 1 | Minimum-contract stacking limit (**has acceptance scenario #10**) |

### 5.2 Majority unindexed (≥50% of the section's obligations have no ID)

| Canon § | Unindexed / total | Subject |
|---|---:|---|
| **§3.1** | 6/7 | Season parameters and configuration policy *(already flagged by the code map)* |
| **§5.2** | 6/9 | Two-Way eligibility, shape, conversion, trade treatment |
| **§5.7** | 4/6 | Raise limits, maximum-salary July 1 adjustment, minimum-contract bonus ban |
| **§5.9** | 5/10 | Signing-bonus, incentive, deferred-comp, and EIPPA limits |
| **§6.3** | 2/4 | Renunciation and the unrenouncing route |
| **§6.5** | 3/6 | Long-term injury exclusion mechanics |
| **§12.8** | 5/8 | Sign-and-trade eligibility and contract shape *(already flagged by the code map)* |
| **§12.9** | 3/4 | Extend-and-trade |

**The code map's two known gaps were real but not the full list.** §5.1, §5.2, §5.3, §5.7, §5.9, §6.3, §6.5, §11.1, §12.6, and §12.9 all carry obligations the register never points at. The contract-authoring surface (§5) is the largest blind spot: the canon devotes an entire section to contract types and the register indexes almost none of it.

---

## 6. Proposed sub-IDs

**76 sub-IDs** are recommended beneath existing parents, where the requirement naturally belongs to an ID that already exists. **These are recommendations only — nothing is minted.** Existing IDs are neither renumbered nor repurposed.

| Proposed | Parent's existing question | Requirement the parent does not currently ask |
|---|---|---|
| **CBA-A01.2** | Ledger separation | Player-compensation ledger modeled separately from Team Salary (§4.1) |
| **CBA-A02.2** | Expanded TPE formula | The $250K allowance (K) goes to zero when post-assignment Apron Team Salary would exceed the First Apron (§3 row 2, §12.5) |
| **CBA-A02.3** | Expanded TPE formula | The 110% Transition TPE is 2023-24-only and confined to historical simulation (§12.4) |
| **CBA-A07.2** | Trade-bonus allocation to ITS | Trade-bonus ceiling: 15% of remaining base compensation; fixed, percentage, or lesser-of (§5.9, §12.7) |
| **CBA-A07.3** | Trade-bonus allocation to ITS | Trade bonus triggers once; an initial S&T/E&T does not consume it (§12.7) |
| **CBA-A07.4** | Trade-bonus allocation to ITS | Player reduction/waiver of a trade bonus creates a six-month renegotiation restriction (§12.7) |
| **CBA-A07.5** | Trade-bonus allocation to ITS | Trade-bonus percentage base = guaranteed base compensation still owed; cannot breach the 120% rookie-scale ceiling (§5.4, §12.7) |
| **CBA-A07.6** | Trade-bonus allocation to ITS | Trade-bonus allocation across guaranteed seasons, reduced if the annual maximum would be exceeded (§12.7) |
| **CBA-A07.7** | Trade-bonus allocation to ITS | Sender pays the trade bonus; receiver carries the cap/trade allocation (§12.7) |
| **CBA-A10.2** | Standard-TPE multi-in vs aggregation ban | Two-month non-aggregation of an exception-acquired player, with the December 16 deadline carve-out (§12.5, §12.8) |
| **CBA-A12.2** | Apron limits on post-transaction Apron Salary | Signing a qualifying high-salary waived player in-season is a First Apron transaction (§8.2) |
| **CBA-A12.3** | Apron limits on post-transaction Apron Salary | Using a TPE created from a sign-and-traded contract is a Second Apron transaction (§8.3) |
| **CBA-A14.2** | Post-season dual-year apron test | The next-year apron test's five assumptions (options exercised, ETOs not, Higher Max achieved, levels held, no further transactions) (§8.4) |
| **CBA-A14.3** | Post-season dual-year apron test | A post-season transaction can hard-cap both the current and next Salary Cap Years (§8.4) |
| **CBA-A15.2** | Multi-team touch graph (OPS) | Stricter multi-team asset definitions: extinguishable conditional picks and nominal cash may not count (OPS) (§12.2) |
| **CBA-A15.3** | Multi-team touch graph (OPS) | Draft-rights assets require a qualifying prospect; recency/rotation deemed status (OPS) (§12.2) |
| **CBA-A17.2** | Stepien branches + seven-draft horizon | Protection and deferral cannot be combined on the same conveyance (§13.3) |
| **CBA-A17.3** | Stepien branches + seven-draft horizon | Conditional 'two years after prior conveyance' language cannot defeat the seven-year rule (OPS) (§13.3) |
| **CBA-A17.4** | Stepien branches + seven-draft horizon | Pick swaps and deferral rights represented in the pick ledger (§4.2) |
| **CBA-A18.2** | Cash sent/received | Conditional cash is charged to the cap year of the trade; re-trading the conditional asset creates further accounting (§12.12) |
| **CBA-C01.5** | Free-agent cap holds | The narrow unrenouncing route after a matched offer sheet (two-day and team-salary limits) (§6.3) |
| **CBA-C05.4** | Minimum-contract subsidy | Minimum Exception eligibility and league subsidy eligibility are separate tests (§6.4) |
| **CBA-C07.2** | Apron Salary add-backs | Apron Salary add-back for potential grievance exposure under VII.4(a)(1)(iii) (§8.1) |
| **CBA-C10.2** | 90% minimum team salary | Season-start minimum-salary shortfall: pay the difference, take an equal Team Salary charge, lose sharing eligibility (§8.7) |
| **CBA-C10.3** | 90% minimum team salary | Opening salary becomes a continuing in-season floor requiring prompt correction (§8.7) |
| **CBA-C10.4** | 90% minimum team salary | Minimum charge persists and is reconciled again at year end (§8.7) |
| **CBA-C11.2** | DPE vs long-term exclusion | Long-term injury exclusion prerequisites: termination through waivers, waiting period, physician/Fitness-to-Play finding (§6.5) |
| **CBA-C11.3** | DPE vs long-term exclusion | Only the team holding the contract when the condition became known may apply for the exclusion (§6.5) |
| **CBA-C11.4** | DPE vs long-term exclusion | An approved team may never re-sign or reacquire the excluded player (§6.5) |
| **CBA-C11.5** | DPE vs long-term exclusion | A DPE request, granted or denied, precludes an exclusion request for that player in the same cap year (§6.5) |
| **CBA-C11.6** | DPE vs long-term exclusion | A 25-game return restores the excluded salary for that and later cap years (§6.5) |
| **CBA-C11.7** | DPE vs long-term exclusion | DPE-in-respect-of-the-disabled-player bars a TPE on that player; the replacement is unaffected; extinguishment on return/trade (§3 row 9, §12.5) |
| **CBA-C13.4** | Exception balances | Second Round Pick Exception: prescribed structures, Team Salary exclusion through July 30, Apron Salary inclusion (§7.3, §13.2) |
| **CBA-C13.5** | Exception balances | Exceptions generally cannot be aggregated to sign or acquire one player (§7.1) |
| **CBA-C13.6** | Exception balances | Full exception value may remain available for a trade or offer sheet where the rule permits (§7.1) |
| **CBA-C13.7** | Exception balances | Rookie Scale Exception as over-cap authority for a team's own first-round pick (§7.3) |
| **CBA-C14.5** | Bird clocks | Renunciation effects on Bird rights, including the Early-Bird-to-Non-Bird downgrade (§6.3) |
| **CBA-C14.6** | Bird clocks | Bird first-year signing authority, term limits, and raise limits by Bird type (§7.2) |
| **CBA-C16.5** | Rookie options/extensions/Higher Max | Rookie Scale salary range of 80%-120% of the slot amount (§5.4) |
| **CBA-C16.6** | Rookie options/extensions/Higher Max | Rookie extension term and raises vary by salary level; up to 8% (§10.4) |
| **CBA-C16.7** | Rookie options/extensions/Higher Max | Veteran extension eligibility (term, signing/renegotiation date, remaining seasons, projected Full Bird) (§10.4) |
| **CBA-C16.8** | Rookie options/extensions/Higher Max | Veteran extension first-year salary: greater of 140% of final salary or 140% of EAPS (§10.4) |
| **CBA-C16.9** | Rookie options/extensions/Higher Max | A Designated Veteran Extension cannot include Incentive Compensation (§10.4) |
| **CBA-C17.2** | Over-38 reallocation | Over-38 applicability test: >=4 seasons and age 38 on October 1 of a covered season (§5.8) |
| **CBA-C17.3** | Over-38 reallocation | The moratorium-birthday rule using age as of the prior June 30 (§5.8) |
| **CBA-C17.4** | Over-38 reallocation | Over-38 Years begin at the later of the fourth contract year or the first October 1 at age 38 (§5.8) |
| **CBA-C17.5** | Over-38 reallocation | Over-38 required inputs (DOB, origin, term, Bird status, S&T status, guarantee state, historical active status) (§5.8) |
| **CBA-L02.4** | Event-driven lifecycle | Compensation-protection modeling: categories, partial/conditional/date-triggered/performance-triggered forms, prior-injury exclusion (§5.6) |
| **CBA-L02.5** | Event-driven lifecycle | Renegotiation eligibility: cap space, >=4-season original contract, third anniversary (§10.5) |
| **CBA-L02.6** | Event-driven lifecycle | Renegotiation blackout, March 1 through June 30 (§10.5) |
| **CBA-L02.7** | Event-driven lifecycle | Renegotiation can only raise within room and cannot lower existing salary (§10.5) |
| **CBA-L02.8** | Event-driven lifecycle | Renegotiate-and-extend permits up to a 40% drop into the extended term (§10.5) |
| **CBA-L03.4** | tradeEligibleOn + consent | Express no-trade clause eligibility: >=8 YOS and >=4 YOS with the signing team (§12.10) |
| **CBA-L04.2** | QO/offer-sheet/matching states | QO withdrawal window: unilateral through July 13; consent after; a July 14+ withdrawal is also a renunciation (§10.2) |
| **CBA-L04.3** | QO/offer-sheet/matching states | Standard QO shape: one year, fully protected, required payment/term language (§10.2) |
| **CBA-L04.4** | QO/offer-sheet/matching states | Maximum QO shape: max base, 8% raises, five seasons, full protection, no option/ETO (§10.2) |
| **CBA-L04.5** | QO/offer-sheet/matching states | Two-Way RFA qualifying-offer rules (§10.2) |
| **CBA-L04.6** | QO/offer-sheet/matching states | RFA rights require relinquishing matching rights, not a cap-hold renunciation (§6.3) |
| **CBA-L04.7** | QO/offer-sheet/matching states | Offer-sheet term requirements and the March 1 signing deadline (>1 season, >2 if a Maximum QO was tendered) (§10.3) |
| **CBA-L04.8** | QO/offer-sheet/matching states | Matching cannot be used as a sign-and-trade (§10.3) |
| **CBA-L05.2** | Draft rights and tenders | Draft-and-stash lifecycle: non-NBA contract dates, availability notice, new-tender events, subsequent-draft rules (§13.1) |
| **CBA-L10.2** | External determination with provenance | Bonus-likelihood expert override with source and effective date (§18) |
| **CBA-L10.3** | External determination with provenance | Circumvention: warn on suspicious structures, never present as approved, no legal finding (§18) |
| **CBA-L10.4** | External determination with provenance | Grievance amounts and awards entered and allocated, never predicted (§18, §6.1, §8.1) |
| **CBA-R01.3** | Waiver lifecycle | A waiver claimant needs an open slot plus room or exception authority (§9.4) |
| **CBA-R01.4** | Waiver lifecycle | Waiver claim priority by record, with date-dependent season selection and tie breakers (§11.1) |
| **CBA-R01.5** | Waiver lifecycle | A player waived after March 1 generally cannot join another team's postseason roster (§11.1) |
| **CBA-R02.2** | Pre-Jan-10 dead salary | Dead-salary treatment of ETO years, unexercised Team Options, and Player Options (§11.2) |
| **CBA-R04.2** | Stretch elections | A stretching team cannot re-sign or reacquire the player before the July 1 after the terminated contract's last season (§11.3) |
| **CBA-R04.3** | Stretch elections | Stretch payment timing and Team Salary allocation are separate decisions (§11.3) |
| **CBA-R05.2** | Buyout and set-off | Set-off allocation follows the dead-salary schedule; a buyout may waive or reduce set-off (§11.4) |
| **CBA-R05.3** | Buyout and set-off | Re-signing restrictions after a trade/waive or buyout (§11.4) |
| **CBA-R06.2** | Roster limits | Active list 12-15 with the temporary 11-player window (§9.1) |
| **CBA-R06.3** | Roster limits | The eight-player bench minimum (§9.1) |
| **CBA-R10.2** | Hardship/suspension states | A league suspension opens a spot after the fifth game; a team suspension after the third (§9.1) |
| **CBA-R10.3** | Hardship/suspension states | Voluntarily-retired and suspended list states represented per player (§4.3) |

---

## 7. Proposed new top-level IDs

**14 new top-level IDs** are recommended where **no existing ID is a truthful parent**. Numbering continues the canon's existing series rather than disturbing it (`A19–A21`, `C19–C25`), plus one new **S** series for the cross-cutting parameter layer, which belongs to no thematic series and is the base of the entire dependency graph.

| Proposed | Title | Authority | Canon locators |
|---|---|---|---|
| **CBA-A19** | Sign-and-trade eligibility and contract shape | CBA | §12.8 |
| **CBA-A20** | Extend-and-trade | CBA | §12.9, §10.4 |
| **CBA-A21** | Minimum-contract stacking limit | CBA | §12.6 |
| **CBA-C19** | Ten-Day and Rest-of-Season contracts | CBA | §5.1, §14 |
| **CBA-C20** | Two-Way contract eligibility, shape, conversion, and trade treatment | CBA | §5.2, §13.2, §14 |
| **CBA-C21** | Exhibit 10 and Exhibit 9 contracts | CBA | §5.3, §3 row 14 |
| **CBA-C22** | Contract-shape limits: minimums, raises, and maximum adjustment | CBA | §5.6, §5.7 |
| **CBA-C23** | Bonus, incentive, deferred-compensation, and EIPPA limits | CBA | §5.9, §3 row 11 |
| **CBA-C24** | Option and ETO shape and deadlines | CBA | §5.5, §5.6, §3 row 10 |
| **CBA-C25** | Team Salary inclusion set | CBA | §6.1 |
| **CBA-S01** | Season parameter set and configuration layer | DERIVED/NBA | §3.1, §5.7, §14 |
| **CBA-S02** | Single canonical constant and enforcing-path verification | DERIVED | §1.2, §3 rows 5-6, §3.1 |
| **CBA-S03** | Provenance labelling and configurability of OPS/EXT and league-variable rules | OPS/EXT | §1.1, §9.3, §17, §19.3 |
| **CBA-S04** | Derived-value recomputation and rounding policy | DERIVED | §3.1 |

### 7.1 Scope of each proposal

**CBA-A19 — Sign-and-trade eligibility and contract shape** (CBA; §12.8)  
The player must be a free agent who finished the prior season on the sending team's roster; completion before the regular season; a 3-4 season term excluding options with Year 1 fully protected for lack of skill; barred signing exceptions; sufficient receiving-team authority for salary plus unlikely bonuses; a sending-team signing bonus treated as cash-in-trade.

**CBA-A20 — Extend-and-trade** (CBA; §12.9, §10.4)  
Ordinary extension eligibility plus the barred end-of-contract offseason window; starting salary capped at the greater of 120% of prior regular salary or 120% of EAPS; more restrictive length and 5% annual changes; the extension and trade must be linked, with six-month restrictions on richer pre/post-trade extensions.

**CBA-A21 — Minimum-contract stacking limit** (CBA; §12.6)  
A team cannot send more than one Minimum Traded Player when all three conditions hold: the trade falls outside December 15 through the deadline, at least three outgoing contracts are aggregated, and fewer players come in than go out. Classification uses the current season, or the next cap year after the regular season. Acceptance scenario 10 already exists and currently points at no audit ID.

**CBA-C19 — Ten-Day and Rest-of-Season contracts** (CBA; §5.1, §14)  
January 5 opening; term = longer of ten days or three games; two per team; concurrent capacity by roster size (12/13/14/15 -> 0/1/2/3); no waiver process; Rest-of-Season proration by remaining regular-season days and its flow into cap, apron, tax, and exception usage.

**CBA-C20 — Two-Way contract eligibility, shape, conversion, and trade treatment** (CBA; §5.2, §13.2, §14)  
<=4 YOS eligibility with the narrow exception; the three-cap-year limit with one team; <=2 seasons with no options/ETOs/bonuses/incentives/deferred comp; conversion at the applicable minimum between July 1 and the final regular-season game; the March 4 signing deadline; $0 trade salary and no TPE; Team Salary exclusion.

**CBA-C21 — Exhibit 10 and Exhibit 9 contracts** (CBA; §5.3, §3 row 14)  
Exhibit 10 conversion path and six-contract limit, bonus rescission and conversion protection, cap-indexed matching amounts, Team Salary exclusion, G League conditions, deemed bonus on trade; Exhibit 9 camp terms, the $15,000 injury termination fee, the 14-other-player prerequisite, the six-contract limit, and regular-season retention.

**CBA-C22 — Contract-shape limits: minimums, raises, and maximum adjustment** (CBA; §5.6, §5.7)  
Minimum scales move by contract year, not current YOS; minimum contracts bar ordinary bonuses; raises are 5% (8% where permitted) measured from Year 1 and never compounded; a future percentage max is adjusted on July 1 with excess reduced in order (signing bonus, incentives, base); protection cannot increase by percentage in a later season.

**CBA-C23 — Bonus, incentive, deferred-compensation, and EIPPA limits** (CBA; §5.9, §3 row 11)  
Signing bonus <=15% of total compensation (<=10% in an offer sheet); total incentives <=20% and unlikely <=15% of Base Compensation; deferred compensation <=25% of the season's compensation and counted when earned; EIPPA's fixed schedule, once-per-three-years limit and excess treatment; imputed below-market loan interest.

**CBA-C24 — Option and ETO shape and deadlines** (CBA; §5.5, §5.6, §3 row 10)  
An option covers one season, cannot be conditional, and cannot reduce salary or bonuses; the June 29 5:00 p.m. ET standard deadline; the prior-to-June-25 RFA-option deadline; ETO must shorten the fourth season and blocks a later extension; Team vs Player Option pre-exercise protection behavior.

**CBA-C25 — Team Salary inclusion set** (CBA; §6.1)  
Retired players under contract, circumvention-related imputed amounts, pending contracts required to be reported, and the reported portion of current/future grievance exposure with later reconciliation.

**CBA-S01 — Season parameter set and configuration layer** (DERIVED/NBA; §3.1, §5.7, §14)  
Every cap-indexed value is season-keyed in a configuration layer; the enumerated §3.1 set is complete for each Salary Cap Year; minimum-salary and Rookie Scale tables are loaded whole; no example dollars are embedded in rule logic; the season calendar and day count are versioned.

**CBA-S02 — Single canonical constant and enforcing-path verification** (DERIVED; §1.2, §3 rows 5-6, §3.1)  
Each constant has exactly one canonical, sourced value; no duplicate or inert definitions; the code path that produces the verdict reads the constant that was audited; a source change updates the parameter layer and reruns tests rather than editing a hard-coded result.

**CBA-S03 — Provenance labelling and configurability of OPS/EXT and league-variable rules** (OPS/EXT; §1.1, §9.3, §17, §19.3)  
OPS rules are enforced from versioned league-rules configuration, labelled as such, and never cited as CBA language; EXT rules consume explicit determinations; neither is promoted to CBA-verified by repetition; league-adjustable roster rules stay configurable.

**CBA-S04 — Derived-value recomputation and rounding policy** (DERIVED; §3.1)  
A, the two Expanded TPE crossovers, tax-bracket width, BAE (3.32%), and cash limits (5.15%) are recomputed from published inputs; rounding happens only at the rule-defined final step; A is never rounded before a crossover.

### 7.2 Why the S series rather than more C IDs

The canon's four series are thematic: **A** = critical trade correctness, **C** = Cap Manager, **R** = waivers and rosters, **L** = lifecycle. The season-parameter layer is none of these — it is **beneath all of them**. The code map's own dependency map (§7) puts it at the root, with the note that *every monetary rule reads it* and *a correct rule reading a wrong constant yields a wrong answer*. It also has to hold the 14 homeless prior findings the code map identified. Giving it its own series keeps that visible instead of burying it as a Cap Manager candidate.

If the owner prefers not to add a series, `C19–C22` would work numerically — but the semantic cost is that the foundation of every verdict would read as one more cap-manager checkbox.

---

## 8. Is a canon v1.1 necessary?

**Yes — an index-only v1.1 is necessary, and it is the narrowest possible change.**

The reasoning:

1. **The canon declares §15 the register of record.** Audit IDs that live anywhere else are not part of the canon, and Phase 2 is driven by the register. Maintaining 90 recommended IDs in a parallel work document would split the index — precisely the failure this review exists to prevent.
2. **The canon already tests a rule it never registered** (§16 #10 → §12.6). That is an internal inconsistency in v1.0, not a matter of opinion.
3. **11 of 56 IDs have no acceptance scenario.** §16 needs additions regardless of whether new IDs are minted.

**What v1.1 must and must not be:**

| Must | Must not |
|---|---|
| Add new IDs to the §15 register and new scenarios to §16 | Change any rule, formula, date, threshold, or dollar value |
| Add sub-IDs beneath existing IDs | Renumber or repurpose any existing ID |
| Record the v1.0 → v1.1 diff in the edition table | Alter any authority label or citation |

**Release-gate impact.** The canon's §17 gate (10 steps) governs *"an updated canon or season parameter set… allowed to govern Architect"*. An index-only v1.1 changes **no rule and no parameter**, so steps 1–6 and 10 (primary-source check, arithmetic, cross-ledger, lifecycle, boundary tests, regression run) have nothing to act on. Steps 7–9 (contradiction scan, unknowns check, link check) still apply and are satisfied by this review plus a citation pass on the new IDs.

**One hard consequence.** The canon is currently SHA-pinned (`b8cf5d01…`) and the code map cites that hash as proof of byte-identity. **Any v1.1 changes the SHA.** The v1.0 hash must be preserved in the edition table so the verified-provenance chain from the original independent verification is not lost. This is an owner decision, not an agent one.

**Recommendation:** approve an index-only canon v1.1 that mints the IDs in §6 and §7 and adds acceptance scenarios for the 11 untested IDs. Do it **before** Phase 2 begins, so Phase 2 runs against a complete register exactly once instead of being re-run against a corrected one.

---

## 9. Reproducing every total

No number in this document was counted by eye. Each is produced by a script over the §10 enumeration table:

```bash
# Coverage classification totals (§3.1)
awk -F'|' '/^\| REQ-/ {gsub(/ /,"",$7); print $7}' \
  work/architect-completion/ARCHITECT_CBA_CANON_INDEX_COMPLETENESS_REVIEW.md | sort | uniq -c

# Obligations with no audit ID (§3.1)
awk -F'|' '/^\| REQ-/ {gsub(/ /,"",$7); if ($7=="NoauditID") n++} END {print n}' \
  work/architect-completion/ARCHITECT_CBA_CANON_INDEX_COMPLETENESS_REVIEW.md

# Indexed obligations with no acceptance scenario (§3.2)
awk -F'|' '/^\| REQ-/ {gsub(/ /,"",$7); gsub(/ /,"",$8);
  if (($7=="Fullyindexed"||$7=="Partiallyindexed") && $8=="—") n++} END {print n}' \
  work/architect-completion/ARCHITECT_CBA_CANON_INDEX_COMPLETENESS_REVIEW.md
```

Integrity checks, computed the same way:

| Check | Expected | Actual |
|---|---:|---:|
| Rows in the enumeration table | 382 | **382** |
| Class totals sum to row count | 382 | **382** |
| Distinct existing IDs referenced | 56 | **56** |
| Existing IDs with no canon anchor | 0 | **0** |
| §16 scenarios traced to a requirement | 46 | **46** |
| Proposed sub-IDs | — | **76** |
| Proposed new top-level IDs | — | **14** |

---

## 10. Full enumeration — every atomic obligation in the canon

382 rows. Locators are line numbers in `docs/reference/cba/ARCHITECT_CBA_CANON.md` at the pinned SHA. "Acceptance" cites §16 scenario numbers.

| # | Canon § | Locator | Requirement | Authority | Existing ID(s) | Classification | Acceptance | Proposed |
|---|---|---|---|---|---|---|---|---|
| REQ-001 | §1.1 | L64 | OPS rules must stay configurable, carry visible provenance, and never be presented as CBA language | OPS | A15 | Partially indexed | — | S03 |
| REQ-002 | §1.1 | L65 | EXT rules must consume an explicit decision/assumption and never drive an automatic verdict | EXT | L10 | Fully indexed | — | — |
| REQ-003 | §1.1 | L67 | Conflict order: signed CBA > By-Laws > NBA release > CBA 101 > secondary | REF | — | Reference/informational | — | — |
| REQ-004 | §1.1 | L69 | Store the article/section identifier as the durable citation key; retain printed page refs | OPS | — | Operational / externally adjudicated | — | — |
| REQ-005 | §1.2 | L73-86 | Every implemented rule/finding preserves the 9-field rule record (ID, rule/scope, authority, inputs incl. asOfDate, outputs per ledger, verdict behavior, explanation, tests, version) | OPS | — | Operational / externally adjudicated | — | — |
| REQ-006 | §1.2 | L87 | On a source change, update the source/parameter layer and rerun tests; never silently edit a hard-coded result | DERIVED | — | No audit ID | — | S02 |
| REQ-007 | §1.3 | L91-99 | Each applicable rule is assessed across five layers: representation, calculation, enforcement, explanation, lifecycle | REF | — | Reference/informational | — | — |
| REQ-008 | §2 | L105-112 | Executive findings restate obligations legislated elsewhere in the canon | REF | — | Reference/informational | — | — |
| REQ-009 | §3 | L122 | Implement the official Expanded TPE formula; never hard-code the Guide's displayed boundaries | CBA/DERIVED | A02 | Fully indexed | #1 | — |
| REQ-010 | §3 | L123 | The $250K allowance test uses post-assignment Apron Team Salary, not post-trade Team Salary | CBA | A02, A12 | Partially indexed | — | A02.2 |
| REQ-011 | §3 | L124 | The remembered 200/175/150/125/110% tiers are not the current Expanded TPE structure | CBA | A02 | Fully indexed | #1 | — |
| REQ-012 | §3 | L125 | DPE medical test is 'unable to play through the following June 15', not 'likely to return by' | CBA | C12 | Fully indexed | #29 | — |
| REQ-013 | §3 | L126 | One canonical, validated source per season value (TMLE $5.685M vs $5.585M conflict) | DERIVED | — | No audit ID | — | S02 |
| REQ-014 | §3 | L127 | Do not duplicate constants across calculators (tax-bracket width conflict) | DERIVED | — | No audit ID | — | S02 |
| REQ-015 | §3 | L128 | Model the minimum-contract subsidy as a component; do not treat the whole contract as zero | CBA | C05 | Fully indexed | #33 | — |
| REQ-016 | §3 | L129 | Non-guaranteed in-season OTS = salary less unearned/unprotected compensation; test at 0%, 25%, 100% elapsed | CBA | A03 | Fully indexed | #7 | — |
| REQ-017 | §3 | L130 | The DPE/TPE bar attaches to the disabled player, not to the DPE replacement player | CBA | C11 | Partially indexed | — | C11.7 |
| REQ-018 | §3 | L131 | An RFA-triggering option must be exercised prior to June 25; encode the legal comparison, not the label | CBA | C16, L02 | Partially indexed | — | C24 |
| REQ-019 | §3 | L132 | Validate both incentive caps: total <=20% and unlikely <=15% of Base Compensation | CBA | — | No audit ID | — | C23 |
| REQ-020 | §3 | L133 | Gate the dual-year apron test by transaction type, not every apron-triggering action | CBA | A14 | Fully indexed | #19 | — |
| REQ-021 | §3 | L134 | Frozen-pick measurement is Apron Team Salary at the start of the final regular-season game; store the four-year history | CBA | L08, L09 | Fully indexed | #20 | — |
| REQ-022 | §3 | L135 | A qualifying Exhibit 9 carries a $15,000 injury termination fee plus eligibility prerequisites | CBA | — | No audit ID | — | C21 |
| REQ-023 | §3.1 | L141-145 | Season parameter set (cap, minimum, tax, both aprons, NTMLE, TMLE, Room MLE) for the current and regression seasons | NBA | — | No audit ID | — | S01 |
| REQ-024 | §3.1 | L147-158 | Expanded TPE derivation: A = $7.5M x cap / $136.021M; crossovers A-K and 4(A-K); never round A before a crossover | DERIVED | A02 | Partially indexed | #1 | S04 |
| REQ-025 | §3.1 | L160-167 | Additional derived amounts: BAE 3.32% of cap, cash limits 5.15% of cap, EIPPA fixed $0.900M, tax-bracket width $5M x cap / $136.021M | DERIVED | — | No audit ID | — | S04 |
| REQ-026 | §3.1 | L169 | Load the complete minimum-salary and Rookie Scale tables; never infer them from current salary or one percentage | CBA | — | No audit ID | — | S01 |
| REQ-027 | §3.1 | L173-174 | All cap-indexed values live in a season-configuration layer; no example dollars embedded in rule logic | DERIVED | — | No audit ID | — | S01 |
| REQ-028 | §3.1 | L175-181 | The enumerated per-season configured set (cap/tax/apron/floor, minimum scale, rookie scale, NTMLE/TMLE/Room MLE/BAE/EIPPA, two-way, Exhibit 10, cash limit, bracket width and rates, season day count and deadlines, Expanded TPE scaled amount) | DERIVED | — | No audit ID | — | S01 |
| REQ-029 | §3.1 | policy | Each constant has exactly one canonical sourced value, and the enforcing code path must read the audited constant | DERIVED | — | No audit ID | — | S02 |
| REQ-030 | §4.1 | L187-194 | Team, Apron, Tax, OTS, and ITS derived as five independent ledgers | CBA | A01 | Fully indexed | — | — |
| REQ-031 | §4.1 | L189 | Player-compensation ledger (base, bonuses, deferred comp, protection, buyout, set-off) modeled separately from Team Salary | CBA | A01 | Partially indexed | — | A01.2 |
| REQ-032 | §4.1 | L195 | Cash-in-trade ledger with separate sent and received balances | CBA | A18 | Fully indexed | — | — |
| REQ-033 | §4.1 | L196 | Exception-inventory ledger: amount, used portion, allowed method, apron ceiling, expiration, hard-cap effect | CBA | C13, L06, L07 | Fully indexed | — | — |
| REQ-034 | §4.1 | L197 | Dead-salary schedule ledger: protection, buyout allocation, stretch election, set-off reductions | CBA | R02, R04, R05 | Fully indexed | — | — |
| REQ-035 | §4.1 | L199 | No shared mutable salary field; every ledger derived from canonical contract/event data for a given date and team context | CBA | A01, L01 | Fully indexed | — | — |
| REQ-036 | §4.2 | L205 | Bird-rights type and clock persisted | CBA | C14 | Fully indexed | #40 | — |
| REQ-037 | §4.2 | L206 | RFA / QO / offer-sheet / matching status persisted | CBA | L04 | Fully indexed | #25 | — |
| REQ-038 | §4.2 | L207 | Draft rights, required tender, non-NBA contract, and cap-hold status persisted | CBA | L05, C02 | Fully indexed | #26 | — |
| REQ-039 | §4.2 | L208 | Player consent and no-trade status persisted | CBA | L03 | Fully indexed | #40 | — |
| REQ-040 | §4.2 | L209 | Signing, extension, renegotiation, trade, waiver-claim, and re-sign restrictions with start and end dates | CBA | L03 | Fully indexed | #41 | — |
| REQ-041 | §4.2 | L210 | Team hard-cap level and trigger event persisted | CBA | L07 | Fully indexed | #15 | — |
| REQ-042 | §4.2 | L211 | Pick ownership, swaps, protections, deferrals, conveyance dependencies, frozen/slid status, and Stepien availability | CBA/BYL | A17, L09 | Partially indexed | #45 | A17.4 |
| REQ-043 | §4.2 | L212 | Standard TPE amount, source transaction, remaining amount, and expiration | CBA | L06 | Fully indexed | #6 | — |
| REQ-044 | §4.2 | L213 | DPE state, medical decision, amount, use, and extinguishment | CBA/EXT | C11, C12 | Fully indexed | #29 | — |
| REQ-045 | §4.2 | L214 | Taxpayer/repeater history and second-apron history | CBA | L08 | Fully indexed | #20, #21 | — |
| REQ-046 | §4.3 | L218 | Per player: Standard/Two-Way/Exhibit contract type and current list (active, inactive, two-way, voluntarily retired, suspended) | CBA/BYL | R06, R10 | Partially indexed | — | R10.3 |
| REQ-047 | §4.3 | L219-223 | Per team: Standard-contract count, active-list count, two-way count, offseason count | CBA/BYL | R06, R09 | Fully indexed | #37, #39 | — |
| REQ-048 | §4.3 | L224 | Short-roster consecutive-day and season-total clocks | CBA | R07 | Fully indexed | #37 | — |
| REQ-049 | §4.3 | L225 | Under-Fifteen Games accumulation | CBA | R08 | Fully indexed | #38 | — |
| REQ-050 | §4.3 | L226 | Two-way active-game usage | CBA | R08 | Fully indexed | #38 | — |
| REQ-051 | §4.3 | L227 | Hardship and treatment-program exceptions | CBA/EXT | R10 | Fully indexed | — | — |
| REQ-052 | §4.3 | L228 | Open slots at the instant a trade or waiver claim occurs | CBA/BYL | A16 | Partially indexed | #36 | R01.3 |
| REQ-053 | §4.4 | L232 | Evaluate an explicit asOfDate and Salary Cap Year; never infer 'today' | CBA | L01 | Fully indexed | — | — |
| REQ-054 | §4.4 | L234 | Contract signing, amendment, conversion, option, ETO, extension, and renegotiation dates | CBA | L02 | Fully indexed | #43 | — |
| REQ-055 | §4.4 | L235 | Guarantee trigger dates and protection changes | CBA | L02 | Fully indexed | #8 | — |
| REQ-056 | §4.4 | L236 | Waiver request, clearance, claim, buyout, stretch-election, and set-off dates | BYL/CBA | R01, R04, R05 | Fully indexed | #34, #35 | — |
| REQ-057 | §4.4 | L237 | Trade date and physical-contingency state | BYL/EXT | L03, L10 | Fully indexed | — | — |
| REQ-058 | §4.4 | L238 | QO, offer sheet, ROFR notice, renunciation, and unrenunciation dates | CBA | L04 | Fully indexed | #25 | — |
| REQ-059 | §4.4 | L239 | Draft, required tender, non-NBA contract, and draft-rights dates | CBA | L05 | Fully indexed | #26 | — |
| REQ-060 | §4.4 | L240 | Exception creation, use, partial use, renunciation, and expiration | CBA | C13, L06 | Fully indexed | #6, #28 | — |
| REQ-061 | §4.4 | L241 | Regular-season start/end and the number of elapsed season days | NBA | L01 | Fully indexed | #7 | — |
| REQ-062 | §5.1 | L249 | A contract is Standard unless it is a Two-Way contract | REF | — | Reference/informational | — | — |
| REQ-063 | §5.1 | L250 | Ten-Day contracts open January 5, last the longer of ten days or three team games; max two with one team | CBA | — | No audit ID | — | C19 |
| REQ-064 | §5.1 | L251 | Concurrent Ten-Day capacity by Standard roster size (12->0, 13->1, 14->2, 15->3); hardship can expand it | CBA | — | No audit ID | — | C19 |
| REQ-065 | §5.1 | L252 | Ten-Day contracts bypass the waiver process; written termination is immediate | CBA | — | No audit ID | — | C19 |
| REQ-066 | §5.1 | L253 | Rest-of-Season contracts are Standard contracts prorated by remaining regular-season days; future seasons may be included | CBA | — | No audit ID | — | C19 |
| REQ-067 | §5.1 | L254 | Proration flows into cap, apron, tax, exception usage, and threshold planning | CBA | — | No audit ID | — | C19 |
| REQ-068 | §5.2 | L258 | Up to three Two-Ways; they do not consume Standard spots and normally do not count in Team Salary | CBA | R06, R08 | Partially indexed | #38 | C20 |
| REQ-069 | §5.2 | L259 | Two-Way eligibility generally requires no more than four YOS, with a narrow four-YOS exception | CBA | — | No audit ID | — | C20 |
| REQ-070 | §5.2 | L260 | No Two-Way if the player has been under a Two-Way with that team in more than three Salary Cap Years | CBA | — | No audit ID | — | C20 |
| REQ-071 | §5.2 | L261 | A Two-Way covers at most two seasons and cannot include options, ETOs, loans, bonuses, incentives, deferred comp, or alternate payment schedules | CBA | — | No audit ID | — | C20 |
| REQ-072 | §5.2 | L262 | Conversion to Standard at the applicable minimum for the same remaining term, or replacement by a newly negotiated Standard contract if the team has the mechanism | CBA | — | No audit ID | — | C20 |
| REQ-073 | §5.2 | L263 | Conversion is allowed after July 1 and before the team's final regular-season game | CBA | — | No audit ID | — | C20 |
| REQ-074 | §5.2 | L264 | A Two-Way player may be active for no more than 50 games, prorated after a late signing | CBA | R08 | Fully indexed | #38 | — |
| REQ-075 | §5.2 | L265 | Teams face a 90 Under-Fifteen-Games limit when Two-Way players are active below 15 signed Standard players | CBA | R08 | Fully indexed | #38 | — |
| REQ-076 | §5.2 | L266 | Two-Way contracts count as $0 in trade salary and create no TPE | CBA | — | No audit ID | — | C20 |
| REQ-077 | §5.3 | L272 | Exhibit 10: one-season minimum Standard contract, generally non-guaranteed, convertible to a Two-Way before the first regular-season day | CBA | — | No audit ID | — | C21 |
| REQ-078 | §5.3 | L273 | A team may hold no more than six Exhibit 10 contracts at once | CBA | — | No audit ID | — | C21 |
| REQ-079 | §5.3 | L274 | Conversion rescinds the Exhibit 10 bonus and triggers the conversion protection amount | CBA | — | No audit ID | — | C21 |
| REQ-080 | §5.3 | L275 | The bonus/protection range is cap-indexed and the two amounts must match when both are present | CBA | — | No audit ID | — | C21 |
| REQ-081 | §5.3 | L276 | The Exhibit 10 bonus is excluded from Team Salary; payment depends on preseason waiver, timely G League assignment/reporting, and 60 consecutive days of service | CBA | — | No audit ID | — | C21 |
| REQ-082 | §5.3 | L277 | Trading an Exhibit 10 can create a deemed bonus when specified conditions exist | CBA | — | No audit ID | — | C21 |
| REQ-083 | §5.3 | L281 | Exhibit 9: one-season non-guaranteed camp contract at a minimum/two-way salary with a $15,000 injury termination fee | CBA | — | No audit ID | — | C21 |
| REQ-084 | §5.3 | L282 | Exhibit 9 salary is normally excluded from Team Salary until the regular season begins | CBA | — | No audit ID | — | C21 |
| REQ-085 | §5.3 | L283 | Exhibit 9 requires at least 14 other players on non-Exhibit-9 contracts and is limited to six Exhibit 9 contracts | CBA | — | No audit ID | — | C21 |
| REQ-086 | §5.3 | L284 | If an Exhibit 9 player is retained into the regular season, the team needs room or an applicable exception | CBA | — | No audit ID | — | C21 |
| REQ-087 | §5.4 | L288 | Rookie Scale: four seasons, Years 1-2 guaranteed, Team Options in Years 3-4 | CBA | C16, C02 | Fully indexed | #26 | — |
| REQ-088 | §5.4 | L289 | Salary plus unlikely bonuses may range from 80% to 120% of the slot's Rookie Scale Amount | CBA | C16 | Partially indexed | #26 | C16.5 |
| REQ-089 | §5.4 | L290 | Rookie option decisions are due by October 31 in the preceding season | CBA | C16 | Fully indexed | — | — |
| REQ-090 | §5.4 | L291 | Declining either option leads to UFA status and caps the prior team's new first-year offer at the declined option amount | CBA | C16 | Fully indexed | — | — |
| REQ-091 | §5.4 | L292 | A trade bonus cannot push salary plus unlikely bonuses above 120% of scale | CBA | A07, C16 | Partially indexed | #13 | A07.5 |
| REQ-092 | §5.4 | L293 | First-round signees cannot be traded for 30 days after signing; draft rights can be traded immediately | CBA/BYL | L03 | Fully indexed | #41 | — |
| REQ-093 | §5.5 | L297 | A Standard contract may have one option year; Rookie Scale contracts have two prescribed Team Options | CBA | C16, L02 | Fully indexed | — | — |
| REQ-094 | §5.5 | L298 | An option covers one season, cannot be conditional, cannot reduce salary/likely/unlikely bonuses, and otherwise carries unchanged terms and protection | CBA | — | No audit ID | — | C24 |
| REQ-095 | §5.5 | L299 | Standard option deadline is June 29 at 5:00 p.m. ET | CBA | L02 | Partially indexed | #43 | C24 |
| REQ-096 | §5.5 | L299 | An option in favor of a player who would otherwise become an RFA must be exercised prior to June 25 | CBA | C16, L02 | Partially indexed | — | C24 |
| REQ-097 | §5.5 | L300 | An ETO is a player termination right that must shorten the fourth season, cannot be conditional, and is generally exercised by June 29 | CBA | — | No audit ID | — | C24 |
| REQ-098 | §5.5 | L301 | Exercising an ETO prevents a later extension; signing an applicable extension may require eliminating the ETO | CBA | C16 | Partially indexed | — | C24 |
| REQ-099 | §5.6 | L305 | Base compensation can be protected for lack of skill and specified injury/illness categories | CBA | R02, L02 | Partially indexed | #31 | L02.4 |
| REQ-100 | §5.6 | L306 | Protection may be partial, conditional, date-triggered, performance-triggered, or subject to a prior-injury exclusion | CBA | L02 | Partially indexed | #8 | L02.4 |
| REQ-101 | §5.6 | L307 | Protection generally cannot increase by percentage in a later season unless conditioned on something that cannot occur until the earlier season ends | CBA | — | No audit ID | — | C22 |
| REQ-102 | §5.6 | L308 | Team and Player Option years have different pre-exercise protection behavior | CBA | — | No audit ID | — | C24 |
| REQ-103 | §5.6 | L309 | January 10 is the universal current-season guarantee date; the practical cut request is around January 7 | CBA | R02 | Fully indexed | #31, #32 | — |
| REQ-104 | §5.6 | L310 | Before that date, earned compensation can exceed stated protection and become the controlling dead-salary amount | CBA | R02 | Fully indexed | #31, #32 | — |
| REQ-105 | §5.7 | L314 | Minimum salary depends on YOS and the year the contract began; multi-year minimum scales move by contract year | CBA | — | No audit ID | — | S01 |
| REQ-106 | §5.7 | L315 | Minimum contracts generally prohibit bonuses, excepting trade bonuses, Exhibit 10 bonuses, and allowed international payment treatment | CBA | — | No audit ID | — | C22 |
| REQ-107 | §5.7 | L316 | Maximum salary is 25/30/35% of cap by YOS, subject to the 105%-of-prior-salary override and Higher Max criteria; it includes Salary plus unlikely bonuses | CBA | C16, C06 | Fully indexed | — | — |
| REQ-108 | §5.7 | L317 | Higher Max eligibility depends on specified MVP, DPOY, or All-NBA achievements and award game thresholds | CBA | C16 | Fully indexed | — | — |
| REQ-109 | §5.7 | L318 | A future percentage-based maximum must be adjusted on the applicable July 1; excess is reduced in order: signing bonus, then incentive compensation, then base compensation | CBA | — | No audit ID | — | C22 |
| REQ-110 | §5.7 | L319 | Raise/decrease limits are 5% (8% where permitted), measured from Year 1 rather than compounded; sign-and-trade and extend-and-trade use stricter limits | CBA | — | No audit ID | — | C22 |
| REQ-111 | §5.8 | L325 | Over-38 applies to a contract/extension/renegotiation covering at least four seasons when the player is 38 on October 1 of a covered season | CBA | C17 | Partially indexed | #44 | C17.2 |
| REQ-112 | §5.8 | L326 | A narrow moratorium-birthday rule can use age as of the prior June 30 | CBA | C17 | Partially indexed | — | C17.3 |
| REQ-113 | §5.8 | L327 | For a non-Full-Bird case, Over-38 Years begin at the later of the fourth contract year or the first October 1 on which the player is 38 | CBA | C17 | Partially indexed | #44 | C17.4 |
| REQ-114 | §5.8 | L328 | Full Bird players aged 35-36 re-signing with the prior team get special treatment (four-year deal may avoid reallocation; five-year reallocates only Year 5); a sign-and-trade gets no relief | CBA | C17 | Fully indexed | #44 | — |
| REQ-115 | §5.8 | L329 | Salary from Over-38 Years is initially reallocated proportionally across non-Over-38 Years | CBA | C17 | Fully indexed | #44 | — |
| REQ-116 | §5.8 | L330 | Reattribution can recur on July 1 while the contract is active and an Over-38 Year is within two years | CBA | C17 | Fully indexed | #44 | — |
| REQ-117 | §5.8 | L332 | Required inputs: DOB, signing date, origin, term, Bird status, sign-and-trade status, annual salary, guarantee state, historical active status | CBA | C17 | Partially indexed | — | C17.5 |
| REQ-118 | §5.9 | L336 | A signing bonus may not exceed 15% of total compensation excluding incentives; in an offer sheet the limit is 10% | CBA | — | No audit ID | — | C23 |
| REQ-119 | §5.9 | L337 | Signing bonuses are allocated across guaranteed seasons in proportion to guaranteed salary; ETO years are excluded; allocation can collapse into the first year if all future years are unprotected | CBA | C18 | Fully indexed | — | — |
| REQ-120 | §5.9 | L338 | A trade bonus may be fixed or percentage-based, capped at 15% of remaining base compensation, paid once and generally by the sender, and allocated to the receiver's salary over remaining guaranteed seasons | CBA | A07 | Partially indexed | #13 | A07.2 |
| REQ-121 | §5.9 | L339 | Deferred compensation counts in the season earned, not the season paid, and is generally limited to 25% of that season's compensation | CBA | — | No audit ID | — | C23 |
| REQ-122 | §5.9 | L340 | Likely bonuses count in Salary; unlikely bonuses are excluded from Team Salary but count in Apron Salary and maximum/room tests where specified | CBA | C06 | Fully indexed | #22 | — |
| REQ-123 | §5.9 | L341 | Bonus likelihood is based on the preceding season and can change on a team change when the criterion is team-related, so sender and receiver can use different trade-salary values | CBA | A06 | Fully indexed | #12 | — |
| REQ-124 | §5.9 | L342 | Total Incentive Compensation <=20% of Base Compensation; unlikely Incentive Compensation <=15%, subject to extension/renegotiation carryover rules | CBA | — | No audit ID | — | C23 |
| REQ-125 | §5.9 | L343 | EIPPA is a fixed schedule (+$25K/yr), usable once per three Salary Cap Years, blocks a Two-Way/Exhibit 10 path for the specified period, and any excess is treated as a signing bonus and Salary | CBA | — | No audit ID | — | C23 |
| REQ-126 | §5.9 | L344 | Below-market loan interest can be imputed as Salary; premium reimbursements may be excluded when requirements are met | CBA | — | No audit ID | — | C23 |
| REQ-127 | §5.9 | L345 | Suspension generally does not reduce Team Salary, but certain league suspensions reduce Tax Salary by 50% of forfeited compensation | CBA | C08 | Fully indexed | #22 | — |
| REQ-128 | §6.1 | L353 | Team Salary includes salaries of players on the roster | CBA | A01 | Fully indexed | — | — |
| REQ-129 | §6.1 | L354 | Team Salary includes protected/dead salary of waived players with stretch/buyout/set-off treatment | CBA | R02, R04, R05 | Fully indexed | #31, #34, #35 | — |
| REQ-130 | §6.1 | L355 | Team Salary includes retired players under contract and circumvention-related imputed amounts | CBA | — | No audit ID | — | C25 |
| REQ-131 | §6.1 | L356 | Team Salary includes pending contracts required to be reported | CBA | — | No audit ID | — | C25 |
| REQ-132 | §6.1 | L357 | Team Salary includes outstanding offer sheets | CBA | L04, C15 | Fully indexed | #25 | — |
| REQ-133 | §6.1 | L358 | Team Salary includes free-agent, first-round-pick, open-roster, and available-exception cap holds | CBA | C01, C02, C03, C04 | Fully indexed | #24, #26, #27, #28 | — |
| REQ-134 | §6.1 | L359 | Team Salary includes contracts assigned by trade or waiver claim | CBA | R01 | Fully indexed | — | — |
| REQ-135 | §6.1 | L360 | Team Salary includes the minimum-team-salary adjustment | CBA | C10 | Fully indexed | — | — |
| REQ-136 | §6.1 | L361 | Team Salary includes a portion of current/future grievance exposure, with later reconciliation | CBA/EXT | L10 | Partially indexed | — | C25 |
| REQ-137 | §6.2 | L367 | Free-agent holds preserve the prior team's Bird mechanism and block using room before re-signing over the cap | CBA | C01 | Fully indexed | #24 | — |
| REQ-138 | §6.2 | L368 | The hold is based on prior Regular Salary, signing-bonus allocation, and actually earned incentives, then bounded by the player's minimum and maximum | CBA | C01 | Fully indexed | #24 | — |
| REQ-139 | §6.2 | L369 | Hold multipliers: rookie-scale fourth-year FAs at 300%/250% of prior salary (below/above EAPS); Full Bird 190%/150%; Early Bird 130%; Non-Bird 120%; minimum-contract FAs at the new minimum, no higher than the two-YOS minimum | CBA | C01 | Fully indexed | #24 | — |
| REQ-140 | §6.2 | L370 | The RFA hold is the greatest of the applicable UFA hold, the qualifying offer, or the matching amount | CBA | C01, L04 | Fully indexed | #25 | — |
| REQ-141 | §6.2 | L374-376 | First-round-pick hold = 120% of the Rookie Scale Amount, added immediately on selection, removed by signing/loss of rights/non-NBA events/formal temporary waiver, and can return later | CBA | C02 | Fully indexed | #26 | — |
| REQ-142 | §6.2 | L380 | The open-roster count includes Standard players, free-agent holds, first-round-pick holds, and players with offer sheets | CBA | C03 | Fully indexed | #27 | — |
| REQ-143 | §6.2 | L381 | From July 1 through the day before the regular season, if the count is below 12 charge one 0-YOS minimum per missing slot; do not continue it as an in-season roster charge | CBA | C03 | Fully indexed | #27 | — |
| REQ-144 | §6.2 | L385-386 | Exception cap holds prevent acting as a room team and an over-cap exception team at once; the exception amount or unused balance is included until used, renounced, or lost | CBA | C04 | Fully indexed | #28 | — |
| REQ-145 | §6.3 | L390 | Renouncing a veteran free-agent hold removes it and ordinarily sacrifices the signing use of Bird rights, though re-signing can continue the underlying clock | CBA | C14, C01 | Partially indexed | #28 | C14.5 |
| REQ-146 | §6.3 | L391 | A team can renounce from Early Bird down to Non-Bird to avoid the Early Bird minimum term | CBA | — | No audit ID | — | C14.5 |
| REQ-147 | §6.3 | L392 | RFA rights require relinquishing matching rights, not a simple cap-hold renunciation | CBA | L04 | Partially indexed | — | L04.6 |
| REQ-148 | §6.3 | L393 | A narrow unrenouncing route exists when room was created to sign an offer sheet the other team matched, subject to two-day and team-salary limits | CBA | — | No audit ID | — | C01.5 |
| REQ-149 | §6.4 | L397 | For a qualifying one-year, Ten-Day, or Rest-of-Season minimum contract, cap/apron/tax treatment reduces to the two-YOS minimum for players above two YOS; the benefits fund reimburses the excess | CBA | C05 | Fully indexed | #33 | — |
| REQ-150 | §6.4 | L398 | A player below two YOS counts at his actual applicable minimum | CBA | C05 | Fully indexed | — | — |
| REQ-151 | §6.4 | L399 | The subsidy disappears when calculating dead salary after a waiver; use actual base compensation and protection | CBA | C05, R03 | Fully indexed | #33 | — |
| REQ-152 | §6.4 | L400 | Minimum Exception eligibility and league subsidy eligibility are separate tests | CBA | C05 | Partially indexed | — | C05.4 |
| REQ-153 | §6.5 | L406 | DPE grants an additional limited exception to replace a player; the injured player's salary remains on the books | CBA | C11 | Fully indexed | #30 | — |
| REQ-154 | §6.5 | L407 | The long-term injury exclusion removes salary only after termination through waivers, the CBA waiting period, and a jointly selected physician / Fitness-to-Play finding | CBA/EXT | C11, C12 | Partially indexed | #30 | C11.2 |
| REQ-155 | §6.5 | L407 | Only the team holding the contract when the condition became (or should have become) known may apply for the exclusion | CBA | — | No audit ID | — | C11.3 |
| REQ-156 | §6.5 | L407 | An approved team can never re-sign or reacquire the excluded player | CBA | — | No audit ID | — | C11.4 |
| REQ-157 | §6.5 | L408 | A DPE request, granted or denied, precludes a long-term exclusion request for that player in the same Salary Cap Year | CBA | C11 | Partially indexed | — | C11.5 |
| REQ-158 | §6.5 | L408 | If an excluded player later appears in 25 NBA regular-season/Play-In/playoff games, salary returns for that and later cap years, subject to the elevated-risk exception and timing rules | CBA | — | No audit ID | — | C11.6 |
| REQ-159 | §7.1 | L416 | An over-cap exception is available only when Team Salary is at/above the cap or below it by less than the available exception amount | CBA | C04, C13 | Fully indexed | #28 | — |
| REQ-160 | §7.1 | L417 | Different exceptions generally cannot be aggregated to sign or acquire one player | CBA | — | No audit ID | — | C13.5 |
| REQ-161 | §7.1 | L418 | Most unused exceptions begin daily proration on January 10; the Minimum Exception prorates from the season start; DPE and TPE do not prorate | CBA | C13 | Fully indexed | — | — |
| REQ-162 | §7.1 | L419 | Full exception value may remain relevant for a trade or offer sheet where the rule permits | CBA | C13 | Partially indexed | — | C13.6 |
| REQ-163 | §7.1 | L420 | Exception usage must track the allowed transaction method: signing, trade, waiver claim, or a subset | CBA | C13 | Fully indexed | — | — |
| REQ-164 | §7.2 | L426-428 | Bird first-year signing authority by type: Non-Bird greater of 120% of prior salary or minimum; Early Bird greater of 175% of prior or 105% of average salary; Full Bird up to the maximum | CBA | C14, C01 | Partially indexed | #24 | C14.6 |
| REQ-165 | §7.2 | L426-428 | Bird term and raise limits: Non-Bird up to 4 years / 5%; Early Bird 2-4 years / 8%; Full Bird up to 5 years / 8% | CBA | C14 | Partially indexed | — | C14.6 |
| REQ-166 | §7.2 | L430 | Trades and waiver claims generally transfer the Bird clock | CBA | C14 | Fully indexed | — | — |
| REQ-167 | §7.2 | L431 | A waiver during the most recent contract can reset the clock; a waiver during an earlier completed contract does not necessarily erase accumulated seasons | CBA | C14 | Fully indexed | — | — |
| REQ-168 | §7.2 | L432 | Certain one-year contracts that would create Full/Early Bird rights lose them on trade and generate an automatic consent right unless waived | CBA | C14, L03 | Fully indexed | #40 | — |
| REQ-169 | §7.3 | L438 | NTMLE: sign/trade/claim/offer-sheet match, divisible, up to 4 years and 5% changes; must land at/below the First Apron; use creates a First Apron hard cap unless terms fit TMLE treatment | CBA | C13, A13 | Fully indexed | #16 | — |
| REQ-170 | §7.3 | L439 | TMLE: signing only, divisible, up to 2 years and 5% changes; must land at/below the Second Apron; use creates a Second Apron hard cap and disables specified First-Apron-team tools | CBA | C13, A13 | Fully indexed | #18 | — |
| REQ-171 | §7.3 | L440 | Room MLE: up to 3 years and 5% changes; mutually exclusive with NTMLE, TMLE, and BAE | CBA | C13 | Fully indexed | #28 | — |
| REQ-172 | §7.3 | L441 | BAE: sign/trade/claim, divisible, up to 2 years and 5% changes, unavailable in consecutive years; First Apron transaction and hard cap | CBA | C13, A13 | Fully indexed | #17 | — |
| REQ-173 | §7.3 | L442 | DPE: lesser of 50% of the disabled player's salary or the NTMLE; one-season or remaining-term contract; application July 1 - January 15; expires March 10; extinguishes before use if the disabled player returns or is traded | CBA/EXT | C12 | Fully indexed | #29 | — |
| REQ-174 | §7.3 | L443 | Second Round Pick Exception: prescribed 2+option or 3+option structures at minimum-based salaries | CBA | — | No audit ID | — | C13.4 |
| REQ-175 | §7.3 | L443 | SRPE amounts are temporarily excluded from Team Salary through July 30 but added to Apron Salary | CBA | C07 | Partially indexed | — | C13.4 |
| REQ-176 | §7.3 | L444 | Rookie Scale Exception: over-cap authority to sign the team's own first-round pick to a Rookie Scale contract | CBA | C02, C16 | Partially indexed | #26 | C13.7 |
| REQ-177 | §7.3 | L445 | Minimum Exception: up to 2 seasons at the applicable minimum with no ordinary bonuses; prorates from season start; a qualifying acquisition may count as $0 ITS | CBA | A08, C13 | Fully indexed | #9 | — |
| REQ-178 | §7.3 | L446 | TPEs are acquisition exceptions whose availability and hard-cap effects depend on TPE type and apron | CBA | A09 | Fully indexed | #3, #4, #5, #6 | — |
| REQ-179 | §8.1 | L456 | Apron Salary: add Performance Bonuses excluded from Salary, principally unlikely performance bonuses | CBA | C07, C06 | Fully indexed | — | — |
| REQ-180 | §8.1 | L457 | Apron Salary: add the two-YOS-minimum uplift for qualifying 0-1 YOS free-agent Standard contracts | CBA | C07 | Fully indexed | — | — |
| REQ-181 | §8.1 | L458 | Apron Salary: add potential grievance exposure specified by CBA VII.4(a)(1)(iii) | CBA/EXT | C07 | Partially indexed | — | C07.2 |
| REQ-182 | §8.1 | L459 | Apron Salary: subtract Free Agent Amounts | CBA | C07 | Fully indexed | — | — |
| REQ-183 | §8.1 | L460 | Apron Salary: for an RFA, add the greater of the outstanding QO/Maximum QO amount and the First Refusal Exercise Notice amount, including specified unlikely bonuses | CBA | C07, L04 | Fully indexed | — | — |
| REQ-184 | §8.1 | L461 | Apron Salary: subtract unsigned first-round-pick holds, then add outstanding Required Tenders to first-round picks | CBA | C07, L05 | Fully indexed | — | — |
| REQ-185 | §8.1 | L462 | Apron Salary: subtract exception holds included in Team Salary under CBA VII.4(a)(7) and 6(n)(2) | CBA | C07, C04 | Fully indexed | — | — |
| REQ-186 | §8.1 | L463 | Apron Salary: add Second Round Pick Exception amounts temporarily excluded from Team Salary | CBA | C07 | Fully indexed | — | — |
| REQ-187 | §8.1 | L464 | Apron Salary: subtract incomplete-roster holds | CBA | C07, C03 | Fully indexed | — | — |
| REQ-188 | §8.1 | L466 | Apron Salary must be computed both before and after a proposed transaction | CBA | C07, A12 | Fully indexed | #2 | — |
| REQ-189 | §8.2 | L472 | Using the BAE is prohibited if post-transaction Apron Salary exceeds the First Apron | CBA | A12 | Fully indexed | #17 | — |
| REQ-190 | §8.2 | L473 | Using the NTMLE outside TMLE-compatible treatment is prohibited above the First Apron | CBA | A12 | Fully indexed | #16 | — |
| REQ-191 | §8.2 | L474 | Acquiring a player by sign-and-trade is prohibited above the First Apron | CBA | A12 | Fully indexed | #15 | — |
| REQ-192 | §8.2 | L475 | Signing a qualifying high-salary waived player during the regular season is prohibited above the First Apron | CBA | A12 | Partially indexed | — | A12.2 |
| REQ-193 | §8.2 | L476 | Using the Expanded TPE is prohibited above the First Apron | CBA | A12 | Fully indexed | #2 | — |
| REQ-194 | §8.2 | L477 | Using a Standard TPE beyond the special timing allowed to First-Apron teams is prohibited above the First Apron | CBA | A12, A09 | Fully indexed | #5 | — |
| REQ-195 | §8.2 | L479 | Executing any First-Apron-limited transaction creates a First Apron hard cap for the applicable Salary Cap Year | CBA | A13 | Fully indexed | #15, #16, #17 | — |
| REQ-196 | §8.3 | L485 | Using the Aggregated TPE is prohibited if post-transaction Apron Salary exceeds the Second Apron | CBA | A12, A10 | Fully indexed | #4 | — |
| REQ-197 | §8.3 | L486 | Paying cash in a trade is prohibited above the Second Apron | CBA | A18, A12 | Fully indexed | — | — |
| REQ-198 | §8.3 | L487 | Using a TPE created from a sign-and-traded contract is prohibited above the Second Apron | CBA | A12 | Partially indexed | — | A12.3 |
| REQ-199 | §8.3 | L488 | Using the TMLE is prohibited above the Second Apron | CBA | A12 | Fully indexed | #18 | — |
| REQ-200 | §8.3 | L490 | 'No aggregation' bars combining multiple outgoing contracts; it does not bar receiving multiple players for one outgoing player under a valid Standard TPE | CBA | A10 | Fully indexed | #3, #4 | — |
| REQ-201 | §8.4 | L494 | Post-regular-season transactions using the CBA VII.2(e)(2) mechanisms must satisfy the applicable apron in both the current and next Salary Cap Years | CBA | A14 | Fully indexed | #19 | — |
| REQ-202 | §8.4 | L494 | The next-year test assumes options exercised, ETOs not exercised, conditioned Higher Max salaries achieved, current apron levels retained, and no further current-year transactions | CBA | A14 | Partially indexed | #43 | A14.2 |
| REQ-203 | §8.4 | L496 | Such a transaction can hard-cap both the current and next Salary Cap Years | CBA | A14, L07 | Partially indexed | — | A14.3 |
| REQ-204 | §8.5 | L500 | Apron Team Salary above the Second Apron as of the start of the final regular-season game freezes the first-round pick in the seventh following draft | CBA | L08, L09 | Fully indexed | #20 | — |
| REQ-205 | §8.5 | L501 | Exceeding the Second Apron in at least two of the next four seasons slides the frozen pick to the end of the first round | CBA | L08, L09 | Fully indexed | #20 | — |
| REQ-206 | §8.5 | L502 | At or below the Second Apron in at least three of those four seasons unfreezes the pick the day after the third such regular season, without sliding | CBA | L08, L09 | Fully indexed | #20 | — |
| REQ-207 | §8.5 | L503 | This requires persisted historical team-apron state and future-pick status, not current-year validation alone | CBA | L08, L09 | Fully indexed | #20 | — |
| REQ-208 | §8.6 | L507 | Tax Salary is finalized near the last regular-season game, with specified later adjustments | CBA | C08 | Fully indexed | — | — |
| REQ-209 | §8.6 | L508 | Tax Salary includes normal salaries, earned unlikely bonuses, relevant trade-bonus and grievance adjustments, and the 0-1 YOS uplift | CBA | C08 | Fully indexed | #22 | — |
| REQ-210 | §8.6 | L509 | Tax Salary removes likely bonuses not earned and 50% of compensation lost to a league suspension where applicable | CBA | C08 | Fully indexed | #22 | — |
| REQ-211 | §8.6 | L510 | Repeater status applies when a team is a taxpayer now and was a taxpayer in at least three of the immediately preceding four Salary Cap Years | CBA | C08 | Fully indexed | #21 | — |
| REQ-212 | §8.6 | L511 | Tax is progressive by cap-indexed brackets; from 2025-26 non-repeater rates are 1.00/1.25/3.50/4.75 and repeater 3.00/3.25/5.50/6.75, +0.50 per additional bracket; 2023-24 and 2024-25 use the legacy rates | CBA | C09 | Fully indexed | #23 | — |
| REQ-213 | §8.6 | L512 | The calculator must sum full prior brackets plus the partial final bracket | DERIVED | C09 | Fully indexed | #23 | — |
| REQ-214 | §8.7 | L516 | Minimum team salary is 90% of the Salary Cap, using its own adjusted salary base | CBA | C10 | Fully indexed | — | — |
| REQ-215 | §8.7 | L517 | A team below the line at the start of the regular season pays the difference, receives an equal Team Salary charge, and loses specified sharing eligibility | CBA | C10 | Partially indexed | — | C10.2 |
| REQ-216 | §8.7 | L518 | Its opening salary becomes a continuing in-season floor; falling below it requires prompt correction | CBA | C10 | Partially indexed | — | C10.3 |
| REQ-217 | §8.7 | L519 | A minimum charge can persist and may be reconciled again at year end | CBA | C10 | Partially indexed | — | C10.4 |
| REQ-218 | §9.1 | L527 | Active + inactive list is normally 14-15 Standard players | CBA/BYL | R06 | Fully indexed | #37 | — |
| REQ-219 | §9.1 | L528 | Temporary shortage to 12 or 13 for no more than two consecutive weeks and 28 total days in the season | CBA/BYL | R06, R07 | Fully indexed | #37 | — |
| REQ-220 | §9.1 | L529 | Active list is normally 12-15, with a temporary 11-player window under similar limits | CBA/BYL | R06 | Partially indexed | — | R06.2 |
| REQ-221 | §9.1 | L530 | At least eight players must be available on the bench | BYL | R06 | Partially indexed | — | R06.3 |
| REQ-222 | §9.1 | L531 | Up to three Two-Way contracts, separate from Standard minimum/maximum counts | CBA | R06, R08 | Fully indexed | #38 | — |
| REQ-223 | §9.1 | L532 | A league suspension can open a spot after the fifth game; a team suspension after the third | CBA/BYL | R10 | Partially indexed | — | R10.2 |
| REQ-224 | §9.1 | L533 | Hardship and specified treatment-program rules can permit more than the normal maximum | CBA/EXT | R10 | Fully indexed | — | — |
| REQ-225 | §9.2 | L537 | After the 14-15 Standard requirement ends, the aggregate offseason maximum is 21 across Active, Inactive, and Two-Way lists | CBA | R09 | Fully indexed | #39 | — |
| REQ-226 | §9.2 | L538 | On the day after the league's last day of Season, Inactive/Two-Way players transfer to the Active List (max 21 including Two-Ways) until the day before the next regular season; a playoff team's elimination is not the league's last day | CBA | R09 | Fully indexed | #39 | — |
| REQ-227 | §9.3 | L542 | Track per-player two-way maximum active games and team-wide Under-Fifteen Games | CBA | R08 | Fully indexed | #38 | — |
| REQ-228 | §9.3 | L543 | A potential CBA adjustment (Standard minimum to 15, or fewer Two-Way spots, based on league-wide roster averages) must be a configurable league rule, not a permanent constant | OPS | R08 | Partially indexed | — | S03 |
| REQ-229 | §9.4 | L547 | A team receiving more players than it sends must have the open Standard roster spots before completing the trade, even with a planned immediate waiver | BYL | A16 | Fully indexed | #36 | — |
| REQ-230 | §9.4 | L548 | A waiver request frees a roster spot immediately; the team need not wait for the player to clear | BYL | R01 | Fully indexed | — | — |
| REQ-231 | §9.4 | L549 | A waiver claimant must have an open slot and sufficient room or exception authority | BYL | R01 | Partially indexed | — | R01.3 |
| REQ-232 | §10.1 | L557 | A UFA can sign via cap room, an applicable exception, Bird rights with the prior team, or a sign-and-trade | CBA | C13, C14 | Fully indexed | — | — |
| REQ-233 | §10.1 | L558 | Negotiation/signing timing and the July Moratorium govern free-agent signings | CBA | L01, L03 | Fully indexed | #41 | — |
| REQ-234 | §10.1 | L559 | Rights status must distinguish free agent, RFA, and retained draft rights | CBA | L04, L05 | Fully indexed | — | — |
| REQ-235 | §10.2 | L563 | RFA applies to specified first-round players after Year 4, qualifying Two-Way players, and other players with no more than three YOS | CBA | L04 | Fully indexed | — | — |
| REQ-236 | §10.2 | L564 | The prior team must issue a timely QO to preserve its right of first refusal | CBA | L04 | Fully indexed | #25 | — |
| REQ-237 | §10.2 | L565 | A QO must be made by 5:00 p.m. ET on June 29; unless extended it stays open through October 1 and never later than March 1 | CBA | L04 | Fully indexed | — | — |
| REQ-238 | §10.2 | L565 | The QO may be withdrawn unilaterally through July 13; after that player written consent is required, and a withdrawal on or after July 14 is also treated as a renunciation | CBA | L04 | Partially indexed | — | L04.2 |
| REQ-239 | §10.2 | L566 | QO size can depend on draft slot, prior salary, and starter criteria (starts/minutes) | CBA | L04 | Fully indexed | — | — |
| REQ-240 | §10.2 | L567 | A standard QO is one year, fully protected for specified reasons, with required payment/term language | CBA | L04 | Partially indexed | — | L04.3 |
| REQ-241 | §10.2 | L568 | A Maximum QO carries maximum base compensation, 8% increases, five seasons, full protection, and no option or ETO | CBA | L04 | Partially indexed | — | L04.4 |
| REQ-242 | §10.2 | L569 | Two-Way RFAs have separate QO rules | CBA | L04 | Partially indexed | — | L04.5 |
| REQ-243 | §10.2 | L570 | Withdrawal dates affect UFA status and whether Bird rights are deemed renounced | CBA | L04, C14 | Fully indexed | — | — |
| REQ-244 | §10.3 | L574 | The offering team must preserve sufficient room throughout the matching process | CBA | C15, L04 | Fully indexed | — | — |
| REQ-245 | §10.3 | L575 | The ordinary last date to sign an offer sheet is March 1; it must cover more than one season excluding an option, or more than two if a Maximum QO was tendered | CBA | — | No audit ID | — | L04.7 |
| REQ-246 | §10.3 | L576 | First Refusal Exercise Notice timing: received before noon ET is due 11:59 p.m. the next day; at/after noon, the second following day; a Moratorium offer sheet uses the special July 7 deadline | CBA | L04 | Fully indexed | — | — |
| REQ-247 | §10.3 | L577 | Matched contracts cannot be amended for one year, and trade restrictions apply including a one-year ban on trading to the offering team | CBA | L03 | Fully indexed | #42 | — |
| REQ-248 | §10.3 | L578 | Matching cannot be used as a sign-and-trade | CBA | — | No audit ID | — | L04.8 |
| REQ-249 | §10.3 | L579 | Arenas: Years 1-2 limited and Years 3-4 can jump; the offering team uses average annual salary for room/Team Salary; the matching team may use the stated schedule or, in specified below-cap circumstances, elect averaging | CBA | C15 | Fully indexed | — | — |
| REQ-250 | §10.4 | L585 | A Rookie Scale extension requires exercised options and signature in the prescribed window before the fourth regular season | CBA | C16 | Fully indexed | — | — |
| REQ-251 | §10.4 | L586 | Starting salary can reach the normal maximum, with conditional 25%-30% Higher Max language | CBA | C16 | Fully indexed | — | — |
| REQ-252 | §10.4 | L587 | Term and raises depend on salary level; up to 8% changes | CBA | C16 | Partially indexed | — | C16.6 |
| REQ-253 | §10.4 | L588 | Trading before the extension begins triggers poison-pill incoming trade salary | CBA | A05 | Fully indexed | #11 | — |
| REQ-254 | §10.4 | L592 | Veteran extension eligibility depends on existing term, signing/renegotiation date, remaining seasons, and projected Full Bird status | CBA | C16 | Partially indexed | — | C16.7 |
| REQ-255 | §10.4 | L593 | General first-year extended salary is the greater of 140% of final regular salary or 140% of EAPS, subject to maximum salary and bonus adjustments | CBA | — | No audit ID | — | C16.8 |
| REQ-256 | §10.4 | L594 | Designated Veteran / Supermax rules add YOS, original-team/trade-history, honor, term, and one-year trade restrictions | CBA | C16, L03 | Fully indexed | #41 | — |
| REQ-257 | §10.4 | L595 | A Designated Veteran Extension cannot include Incentive Compensation | CBA | — | No audit ID | — | C16.9 |
| REQ-258 | §10.4 | L596 | Extend-and-trade reduces allowable salary to 120% measures, limits total length, and uses 5% changes | CBA | — | No audit ID | — | A20 |
| REQ-259 | §10.4 | L597 | A six-month rule prevents a richer extension immediately before or after a trade | CBA | L03 | Fully indexed | #41 | — |
| REQ-260 | §10.5 | L601 | Renegotiation requires cap space, an original contract covering at least four seasons, and generally the third anniversary | CBA | L02 | Partially indexed | — | L02.5 |
| REQ-261 | §10.5 | L602 | Renegotiation is unavailable March 1 through June 30 | CBA | L02, L01 | Partially indexed | — | L02.6 |
| REQ-262 | §10.5 | L603 | Renegotiation can raise current salary and bonuses only within cap room and cannot simply lower existing salary | CBA | L02 | Partially indexed | — | L02.7 |
| REQ-263 | §10.5 | L604 | Renegotiate-and-extend may allow up to a 40% drop into the extended term under its specific rules | CBA | — | No audit ID | — | L02.8 |
| REQ-264 | §10.5 | L605 | A renegotiated player cannot be traded for six months | CBA | L03 | Fully indexed | #41 | — |
| REQ-265 | §11.1 | L613 | The standard waiver period is 48 hours and the request cannot be withdrawn | BYL | R01 | Fully indexed | — | — |
| REQ-266 | §11.1 | L614 | Roster spot and non-guaranteed salary are freed at request time | BYL/CBA | R01 | Fully indexed | — | — |
| REQ-267 | §11.1 | L615 | A claiming team assumes the full contract and receives a 30-day trade restriction | BYL | R01, L03 | Fully indexed | #41 | — |
| REQ-268 | §11.1 | L616 | Claim priority uses record with date-dependent season selection and tie breakers | BYL | — | No audit ID | — | R01.4 |
| REQ-269 | §11.1 | L617 | A player requested after March 1 generally cannot join another team's postseason roster | BYL | — | No audit ID | — | R01.5 |
| REQ-270 | §11.2 | L621 | If unclaimed, protected compensation remains as dead salary; unearned unprotected compensation and ordinary bonuses do not | CBA | R02 | Fully indexed | #31, #32 | — |
| REQ-271 | §11.2 | L622 | Before January 10, current-year dead salary is the greater of earned base compensation and the protected amount | CBA | R02 | Fully indexed | #31, #32 | — |
| REQ-272 | §11.2 | L623 | Use actual base compensation, not the subsidized cap amount, for a waived veteran-minimum player | CBA | R03 | Fully indexed | #33 | — |
| REQ-273 | §11.2 | L624 | ETO years are treated as guaranteed for dead salary; Team Options not yet exercised are not; Player Options depend on contract language | CBA | R02 | Partially indexed | — | R02.2 |
| REQ-274 | §11.3 | L628 | A stretch election spreads applicable dead salary over twice the remaining seasons plus one | CBA | R04 | Fully indexed | #34 | — |
| REQ-275 | §11.3 | L629 | A July 1 - August 31 election includes the current season; a September 1 - June 30 election leaves current-year dead salary untouched and stretches future amounts | CBA | R04 | Fully indexed | #34 | — |
| REQ-276 | §11.3 | L630 | The contract must be terminated before the September 1 preceding its final season, and the stretch elected before that same September 1 | CBA | R04 | Fully indexed | #34 | — |
| REQ-277 | §11.3 | L631 | A stretch is unavailable if future-year Team Salary attributable to all waived/former players already exceeds, or would exceed, 15% of the cap in effect at election | CBA | R04 | Fully indexed | #34 | — |
| REQ-278 | §11.3 | L632 | A team that stretches cannot re-sign or reacquire the player before the July 1 following the last season of the terminated contract, including an option year | CBA | L03 | Partially indexed | — | R04.2 |
| REQ-279 | §11.3 | L633 | Payment timing and Team Salary allocation are separate decisions | CBA | R04 | Partially indexed | — | R04.3 |
| REQ-280 | §11.4 | L637 | A buyout reduces protected compensation in exchange for release and reallocates the reduced dead salary proportionally across affected seasons | CBA | R05 | Fully indexed | #35 | — |
| REQ-281 | §11.4 | L638 | Set-off can reduce a prior team's obligation when the waived player earns compensation elsewhere during the original term | CBA | R05 | Fully indexed | #35 | — |
| REQ-282 | §11.4 | L639 | Set-off formula: new compensation minus the applicable 0-YOS or 1-YOS minimum, then 50% of the positive remainder, with detailed deferred/non-NBA treatment | CBA | R05 | Fully indexed | #35 | — |
| REQ-283 | §11.4 | L640 | Set-off allocation follows the relevant dead-salary schedule; a buyout may waive or reduce set-off rights | CBA | R05 | Partially indexed | — | R05.2 |
| REQ-284 | §11.4 | L641 | Re-signing restrictions apply after a trade/waive or a buyout | CBA | L03 | Partially indexed | — | R05.3 |
| REQ-285 | §12.1 | L649-658 | Recommended validation order, steps 1-10 (date, asset legality, connectivity, slots, consent, ITS/OTS, post-trade ledgers, TPE path selection, apron limits, cash/pick/Stepien checks) | DERIVED | — | Reference/informational | — | — |
| REQ-286 | §12.1 | L659 | Step 11: the transaction must create resulting state - TPE balances, hard caps, roster/list assignments, rights, restrictions, picks, and cash balances | CBA | L06, L07, L09, A18 | Fully indexed | #6 | — |
| REQ-287 | §12.2 | L665 | Two-team trade: each team must send/receive an eligible player contract, qualifying pick, draft rights, swap, or minimum cash amount | OPS | A15 | Fully indexed | #46 | — |
| REQ-288 | §12.2 | L666 | Trade of three or more teams: each team must touch at least two other teams by sending or receiving a qualifying asset | OPS | A15 | Fully indexed | #46 | — |
| REQ-289 | §12.2 | L667 | Multi-team asset definitions are stricter: extinguishable conditional picks and nominal cash may not count | OPS | A15 | Partially indexed | #46 | A15.2 |
| REQ-290 | §12.2 | L668 | Draft-rights assets need a qualifying NBA prospect; recency and professional-rotation tests can create deemed status | OPS | A15 | Partially indexed | — | A15.3 |
| REQ-291 | §12.2 | L669 | Multi-team validity is a graph problem; salary matching alone cannot validate it | OPS | A15 | Fully indexed | #46 | — |
| REQ-292 | §12.3 | L675 | Team-related performance bonuses are re-tested for likelihood using each team's preceding performance, so OTS and ITS can differ | CBA | A06 | Fully indexed | #12 | — |
| REQ-293 | §12.3 | L680 | OTS window 1 - July 1 to regular-season start: count the protected amount | CBA | A03 | Fully indexed | #7 | — |
| REQ-294 | §12.3 | L681 | OTS window 2 - regular-season start through January 7: salary less unearned/unprotected base compensation | CBA | A03 | Fully indexed | #7 | — |
| REQ-295 | §12.3 | L682 | OTS window 3 - January 8 through regular-season end: deem current salary protected | CBA | A03 | Fully indexed | #7 | — |
| REQ-296 | §12.3 | L683 | OTS window 4 - after the regular season through June 30: lesser of current-year salary and protected next-year salary | CBA | A03 | Fully indexed | #7 | — |
| REQ-297 | §12.3 | L684 | Sign-and-trade base-year adjustment: sending-team OTS is the greater of prior salary or 50% of first-year new salary, using actual prior minimum compensation including the reimbursed portion | CBA | A04 | Fully indexed | #15 | — |
| REQ-298 | §12.3 | L688 | A qualifying Minimum Exception contract can count as $0 ITS while the sender retains OTS | CBA | A08 | Fully indexed | #9 | — |
| REQ-299 | §12.3 | L689 | Poison pill: a signed but unstarted Rookie Scale extension uses average annual salary over the current contract plus extension, including option treatment, for ITS | CBA | A05 | Fully indexed | #11 | — |
| REQ-300 | §12.3 | L690 | The current-year allocated trade-bonus portion increases ITS and receiving Team Salary | CBA | A07 | Fully indexed | #13 | — |
| REQ-301 | §12.4 | L694 | Each team is evaluated separately and may split a multi-player transaction into CBA-permitted component trades; Architect must find a legal decomposition or explain why none exists | CBA | A11 | Fully indexed | — | — |
| REQ-302 | §12.4 | L698 | Room path: team below the cap; incoming limit is room + $250K; cannot be combined simultaneously with another TPE path | CBA | A09 | Fully indexed | — | — |
| REQ-303 | §12.4 | L699 | Standard TPE: one outgoing, one or more incoming; limit 100% OTS + $250K; can be non-simultaneous; remainder normally expires in 12 months; First-Apron timing shortens usability | CBA | A09, L06 | Fully indexed | #3, #5, #6 | — |
| REQ-304 | §12.4 | L700 | Aggregated TPE: multiple outgoing aggregated; limit 100% aggregate OTS + $250K; must land at/below the Second Apron; simultaneous | CBA | A09, A10 | Fully indexed | #4 | — |
| REQ-305 | §12.4 | L701 | Expanded TPE: one or more outgoing and incoming; official formula; must land at/below the First Apron; simultaneous; creates a First Apron hard cap | CBA | A02, A09, A13 | Fully indexed | #1, #2 | — |
| REQ-306 | §12.4 | L713 | Maximum ITS = max(min(2 x O + K, O + A), 1.25 x O + K) | CBA/DERIVED | A02 | Fully indexed | #1 | — |
| REQ-307 | §12.4 | L715 | If a UI shows tiers, derive the breakpoints from A and K for that season; never store fixed tier boundaries | DERIVED | A02 | Fully indexed | #1 | — |
| REQ-308 | §12.4 | L717 | The 110% Transition TPE existed only for 2023-24; preserve it only in historical simulations, not as a current fifth tier | CBA | A02 | Partially indexed | — | A02.3 |
| REQ-309 | §12.5 | L721 | The $250K allowance is reduced to zero if post-assignment Apron Team Salary would exceed the First Apron | CBA | A02, A12 | Partially indexed | — | A02.2 |
| REQ-310 | §12.5 | L722 | A player acquired using an exception generally cannot be aggregated for two months; if acquired on or before December 16, the restriction does not apply to a trade on the day before or the day of the deadline | CBA | — | No audit ID | — | A10.2 |
| REQ-311 | §12.5 | L723 | If a team used a DPE in respect of the disabled player, trading that player in the same cap year cannot generate a TPE; the restriction does not attach to the replacement; the DPE extinguishes if the disabled player returns or is traded before use | CBA | C11, C12 | Partially indexed | #29 | C11.7 |
| REQ-312 | §12.5 | L724 | Standard TPE remainder and expiration must persist and support partial use | CBA | L06 | Fully indexed | #6 | — |
| REQ-313 | §12.5 | L725 | A First-Apron team can still use a Standard TPE before it becomes an 'aged' TPE under CBA VII.2(e)(4) row F; the underlying one-year non-simultaneous expiration still applies | CBA | A09, L06 | Fully indexed | #5 | — |
| REQ-314 | §12.6 | L729-735 | A team cannot send more than one Minimum Traded Player when all three conditions hold (trade outside December 15 through the deadline, at least three aggregated outgoing contracts, fewer players in than out); classification uses the current season, or the next cap year after the regular season | CBA | — | No audit ID | #10 | A21 |
| REQ-315 | §12.7 | L739 | Trade bonus maximum is 15% of remaining base compensation; it may be fixed, percentage-based, or the lesser of the two | CBA | A07 | Partially indexed | #13 | A07.2 |
| REQ-316 | §12.7 | L740 | A trade bonus is triggered only once; an initial sign-and-trade or extend-and-trade does not consume it, but a later trade can | CBA | — | No audit ID | — | A07.3 |
| REQ-317 | §12.7 | L741 | The player may reduce or waive the bonus as part of a trade, causing a six-month renegotiation restriction | CBA | L03 | Partially indexed | #14 | A07.4 |
| REQ-318 | §12.7 | L742 | Percentage calculation uses guaranteed base compensation still owed: current-season remainder by days plus guaranteed future seasons, excluding unexercised options | CBA | — | No audit ID | #13 | A07.5 |
| REQ-319 | §12.7 | L743 | Allocate the trade bonus across guaranteed remaining seasons like a signing bonus, then reduce it if the annual maximum salary would be exceeded | CBA | A07, C18 | Partially indexed | — | A07.6 |
| REQ-320 | §12.7 | L744 | The sending team normally pays the bonus; the receiving team carries the cap/trade allocation | CBA | A07, A18 | Partially indexed | — | A07.7 |
| REQ-321 | §12.8 | L748 | The sign-and-trade player must be a free agent who finished the prior season on the sending team's roster | CBA | — | No audit ID | — | A19 |
| REQ-322 | §12.8 | L749 | The sign-and-trade must be completed before the regular season | CBA | — | No audit ID | — | A19 |
| REQ-323 | §12.8 | L750 | The new contract must cover at least three seasons excluding options and no more than four; Year 1 must be fully protected for lack of skill | CBA | — | No audit ID | — | A19 |
| REQ-324 | §12.8 | L751 | Certain exceptions cannot be used to sign the sign-and-trade player | CBA | — | No audit ID | — | A19 |
| REQ-325 | §12.8 | L752 | The receiving team must have sufficient transaction authority for salary plus applicable unlikely bonuses | CBA | — | No audit ID | — | A19 |
| REQ-326 | §12.8 | L753 | Receiving a player by sign-and-trade is a First Apron transaction and creates a First Apron hard cap | CBA | A12, A13 | Fully indexed | #15 | — |
| REQ-327 | §12.8 | L754 | The player cannot be re-aggregated for the prescribed period; the base-year OTS adjustment may apply to the sender | CBA | A04, A10 | Partially indexed | #15 | A10.2 |
| REQ-328 | §12.8 | L755 | A signing bonus paid by the sending team is treated as cash-in-trade | CBA | A18 | Partially indexed | — | A19 |
| REQ-329 | §12.9 | L759 | Extend-and-trade requires ordinary extension eligibility and is unavailable in a specified end-of-contract offseason window | CBA | — | No audit ID | — | A20 |
| REQ-330 | §12.9 | L760 | Starting extension salary is capped by the greater of 120% of prior regular salary or 120% of EAPS, adjusted for incentives | CBA | — | No audit ID | — | A20 |
| REQ-331 | §12.9 | L761 | Total length and annual changes are more restrictive than an ordinary extension | CBA | — | No audit ID | — | A20 |
| REQ-332 | §12.9 | L762 | The extension and trade must be linked and completed within the permitted process; richer pre/post-trade extensions are restricted for six months | CBA | L03 | Partially indexed | #41 | A20 |
| REQ-333 | §12.10 | L766 | An express no-trade clause requires at least eight YOS and four YOS with the signing team | CBA | — | No audit ID | — | L03.4 |
| REQ-334 | §12.10 | L767 | Automatic consent rights can arise on a one-year contract when a trade would reduce Full/Early Bird rights; the player can waive that right | CBA | C14, L03 | Fully indexed | #40 | — |
| REQ-335 | §12.10 | L768 | Matched RFA offer sheets and other transactions create separate consent/recipient restrictions | CBA | L03, L04 | Fully indexed | #42 | — |
| REQ-336 | §12.11 | L772 | The validator needs a rule-generated tradeEligibleOn plus recipient/consent constraints rather than one generic date | CBA | L03 | Fully indexed | #41 | — |
| REQ-337 | §12.11 | L774-781 | The enumerated restriction set: later of three months or December 15 for ordinary FA signings; later of three months or January 15 for specified Bird re-signings; 30 days after a drafted rookie signs; 30 days after a Two-Way signing or waiver claim; six months after renegotiation or a rich extension; one year after a Designated Veteran contract/extension; one year plus consent after a matched offer sheet; end-of-season option/ETO restrictions | CBA | L03 | Fully indexed | #41, #42, #43 | — |
| REQ-338 | §12.11 | L782 | Window restrictions: July Moratorium, trade deadline, playoffs, lottery, and draft-day asset windows | CBA/BYL | L03, L01 | Fully indexed | — | — |
| REQ-339 | §12.12 | L786 | Annual cash sent and cash received limits are separate, each a cap-indexed percentage | CBA | A18 | Fully indexed | — | — |
| REQ-340 | §12.12 | L787 | Do not net cash sent against cash received | CBA | A18 | Fully indexed | — | — |
| REQ-341 | §12.12 | L788 | Cash has no Team Salary effect | CBA | A18 | Fully indexed | — | — |
| REQ-342 | §12.12 | L789 | Conditional cash tied to a pick is charged to the Salary Cap Year of the trade, not the later payment date; re-trading the conditional asset can create additional accounting | CBA | A18 | Partially indexed | — | A18.2 |
| REQ-343 | §12.12 | L790 | Paying cash is a Second Apron-limited transaction | CBA | A18, A12 | Fully indexed | — | — |
| REQ-344 | §13.1 | L798 | Drafting creates exclusive negotiating rights | CBA | L05 | Fully indexed | #26 | — |
| REQ-345 | §13.1 | L799 | Rights persist through timely Required Tenders and qualifying non-NBA contract events | CBA | L05 | Fully indexed | — | — |
| REQ-346 | §13.1 | L800 | Required Tender deadlines and terms differ for first- and second-round picks | CBA | L05 | Fully indexed | — | — |
| REQ-347 | §13.1 | L801 | Failure to tender can produce rookie free agency | CBA | L05 | Fully indexed | — | — |
| REQ-348 | §13.1 | L802 | First-round rights create a cap hold; second-round rights do not use the same hold but interact with required tenders and Apron Salary | CBA | C02, C07, L05 | Fully indexed | #26 | — |
| REQ-349 | §13.1 | L803 | Draft-and-stash rights need non-NBA contract dates, availability notice, new-tender events, and subsequent-draft rules | CBA | L05 | Partially indexed | #26 | L05.2 |
| REQ-350 | §13.2 | L807 | Second-round picks may sign via the Second Round Pick Exception, Minimum Exception, a Two-Way contract, cap room, or another valid path | CBA | L05, C13 | Partially indexed | — | C13.4 |
| REQ-351 | §13.2 | L808 | Undrafted rookies are free agents immediately after the draft and need an ordinary signing mechanism or a Two-Way contract | CBA | L05 | Partially indexed | — | C20 |
| REQ-352 | §13.3 | L812 | Future picks must identify a year and already be owned; a team cannot promise an asset it merely expects to acquire | BYL | A17 | Fully indexed | #45 | — |
| REQ-353 | §13.3 | L813 | Picks can carry protections, fallback conveyances, and one-year deferral rights; protection and deferral cannot be combined on the same conveyance | OPS | A17 | Partially indexed | #45 | A17.2 |
| REQ-354 | §13.3 | L814 | OPS: first- and second-round picks can be traded only through the seventh future draft; treat the horizon as a versioned league rule | OPS | A17 | Fully indexed | #45 | — |
| REQ-355 | §13.3 | L815 | BYL 7.03: a team may not sell a first for cash or trade it if the result MAY leave the team without firsts in two consecutive future drafts; another team's owned first can satisfy possession; test all protection branches | BYL | A17 | Fully indexed | #45 | — |
| REQ-356 | §13.3 | L816 | Protections must be evaluated across all possible conveyance branches, not only the most likely outcome | BYL | A17 | Fully indexed | #45 | — |
| REQ-357 | §13.3 | L817 | Conditional 'two years after prior conveyance' language is limited and cannot defeat the seven-year rule | OPS | A17 | Partially indexed | — | A17.3 |
| REQ-358 | §13.3 | L818 | Second Apron frozen picks are unavailable until unfreezing; slid picks have fixed end-of-round placement | CBA | L09, A17 | Fully indexed | #20 | — |
| REQ-359 | §14 | L822 | Season-specific dates (trade deadline, game calendar) must be versioned; they are not permanent constants | NBA | L01 | Partially indexed | — | S01 |
| REQ-360 | §14 | L824 | Architect must expose a transaction date and automatically apply the appropriate calendar version | CBA/NBA | L01 | Fully indexed | — | — |
| REQ-361 | §14 | L826-841 | The critical event set is represented on the calendar: July 1 rollover/moratorium, moratorium end, tender/QO/option deadlines, first regular-season day, January 5, January 8, January 10, January 15, March 1, March 4, March 10, trade deadline/playoff restrictions, end of regular season, June 29, June 30 | CBA/NBA | L01 | Fully indexed | — | — |
| REQ-362 | §14 | L831 | The January 5 Ten-Day opening has no owning contract rule in the register (see 5.1) | CBA | — | No audit ID | — | C19 |
| REQ-363 | §14 | L835 | The March 4 Two-Way signing deadline has no owning contract rule in the register (see 5.2) | CBA | — | No audit ID | — | C20 |
| REQ-364 | §15 | L844 | The register is a set of testable coverage questions, not confirmed bugs | REF | — | Reference/informational | — | — |
| REQ-365 | §16 | L937 | The audit must use concrete scenarios, not only unit-level rule labels | OPS | — | Operational / externally adjudicated | — | — |
| REQ-366 | §17 | L1004-1013 | Every audited ID produces the six-field compact record (coverage, product layer, severity, evidence, authority, remediation) | OPS | — | Operational / externally adjudicated | — | — |
| REQ-367 | §17 | L1015-1025 | Three bounded passes: deterministic correctness, Cap Manager completeness, full GM depth | REF | — | Reference/informational | — | — |
| REQ-368 | §17 | L1027-1035 | Findings stay attached to the product layer they affect (calculation, validation, explanation, lifecycle, data, authoring, intentional exclusion) | REF | — | Reference/informational | — | — |
| REQ-369 | §17 | L1039-1050 | The ten-step canon release gate must be completed before an updated canon or season parameter set governs Architect | OPS | — | Operational / externally adjudicated | — | — |
| REQ-370 | §17 | L1046 | Boundary tests one unit below, exactly at, and one unit above every monetary, count, day, and percentage boundary | OPS | — | Operational / externally adjudicated | — | — |
| REQ-371 | §17 | L1048 | OPS and EXT rules stay visibly labeled and configurable and are never promoted to CBA-verified through repetition | OPS | A15, L10 | Partially indexed | — | S03 |
| REQ-372 | §18 | L1056 | Physical examinations: represent pending/passed/failed/waived/terms-adjusted; never determine medical fitness | EXT | L10 | Fully indexed | — | — |
| REQ-373 | §18 | L1057 | DPE and career-ending injury findings are inputs; verify consequences after a ruling and warn when the wrong standard is selected | EXT | L10, C12 | Fully indexed | #29 | — |
| REQ-374 | §18 | L1058 | Bonus-likelihood appeals: preserve an expert override, its source, and its effective date | EXT | L10, A06 | Partially indexed | — | L10.2 |
| REQ-375 | §18 | L1059 | Circumvention: warn about suspicious structures, never present them as approved, and issue no definitive legal finding | EXT | L10 | Partially indexed | — | L10.3 |
| REQ-376 | §18 | L1060 | Anti-collusion and tampering: negotiation dates are checkable, but communications and intent sit outside the product's data | EXT | L10 | Fully indexed | — | — |
| REQ-377 | §18 | L1061 | Grievances and settlements: known disputed amounts and awards can be entered and allocated; Architect cannot predict the award | EXT | L10, C07, C08 | Partially indexed | — | L10.4 |
| REQ-378 | §18 | L1062 | League approvals and hardship exceptions: use an explicit approval record; never infer approval from similar roster conditions | EXT | L10, R10 | Fully indexed | — | — |
| REQ-379 | §18 | L1063 | Expansion rules and BRI cap-setting: consume published team count and system levels rather than reproduce league audit/BRI calculations | EXT | — | Reference/informational | — | — |
| REQ-380 | §18 | L1065 | These states must appear in the UI as 'requires external determination' or 'assumption required', never as unqualified PASS or FAIL | EXT | L10 | Fully indexed | — | — |
| REQ-381 | §19.1 | L1071-1094 | The rule-family authority map must be preserved as citation metadata on every implemented rule | OPS | — | Operational / externally adjudicated | — | — |
| REQ-382 | §19.3 | L1105-1112 | The verification-status classification is part of the canon; moving an OPS item into a primary-source category requires a cited canon revision | OPS | — | Operational / externally adjudicated | — | — |

---

## 11. What Phase 2 should do with this

1. **Get the register decided before Phase 2 starts.** Approve, amend, or reject the 14 new top-level IDs and 76 sub-IDs. Phase 2 against an incomplete register produces verdicts that have to be re-run.
2. **Decompose the 5 worst broad IDs first** (L03, L04, C16, A12, C07). Each will otherwise produce one verdict for up to 20 independent legal conditions.
3. **Treat the 11 untested IDs as evidence-poor, not clean.** The code map already warns that a passing test may pin a bug; an ID with *no* test has nothing pinned at all.
4. **The parameter layer (proposed S01–S04) is packet P1's real foundation.** The code map's dependency graph already puts it at the root and parks 14 homeless findings there.

---

## 12. Phase 1 boundaries observed

- Canon: **not modified** (SHA unchanged, verified before and after).
- Code map: **not modified**.
- Application code, tests, fixtures, schemas, constants, configuration, data: **not touched**.
- Linear issues, project state, git history: **not touched**. Nothing committed or pushed.
- No audit IDs minted. No Architect PASS/FAIL verdicts assigned. **Phase 2 not started.**
- Only file created: this document.
