# Architect CBA Canon — Phase 1 Code Map

**Phase:** 1 of 2 — **locatability and audit design only.**
**Canon:** `docs/reference/cba/ARCHITECT_CBA_CANON.md` (SHA-256 `b8cf5d01356b3a83de4663f5bd6843e9aa58c8c06a84227385ae93bc02d969ef`, verified byte-identical)
**Repo state:** branch `main`, commit `bab5e193`, working tree otherwise clean
**Date:** 2026-07-13

---

## 0. What this document is — and is not

This maps each of the canon's **56 audit IDs** to the place in the repository where the rule would live, so a Phase 2 reviewer can go straight to the code instead of re-deriving the surface.

**It assigns no verdicts.** No rule here is called compliant, incorrect, missing, or implementation-ready. The only judgment made is **locatability**:

| Locatability | Meaning |
|---|---|
| **FOUND** | A clear implementation site exists for this rule. |
| **PARTIAL** | Machinery exists, but a required component of the canon rule has no obvious site. |
| **NO SITE** | No obvious implementation site was located anywhere in the repository. |

> **NO SITE is a mapping result, not a finding.** It means a grep-and-read sweep did not locate an implementation site. It does **not** yet establish that the functionality is absent, that it is a defect, or that it is in V1 scope. Phase 2 confirms or overturns every one of these.

All prior BZE-255 / BZE-259 findings referenced below are labelled **[PRELIM]** and carry no authority. They predate the verified canon; the same warning is now posted on BZE-255 through BZE-265.

---

## 1. Two global facts that apply to every row

Established mechanically during reconnaissance; they change how several columns below should be read.

**1.1 — There is no backend CBA enforcement anywhere.**
`functions/src/` contains exactly two files: `index.ts` and `architect/purgeWorld.ts`. A search of `functions/` for `validateTrade|capLegality|salaryMatch|apron` returns **zero** hits. `firestore.rules` gates collection access, not cap legality. **Every CBA rule in Architect is enforced client-side only.** The "Backend enforcement" field for all 56 IDs is therefore **none**, and is not repeated per row.

**1.2 — The cap engine derives one salary number, not independent ledgers.**
`ComputedTeamCapTotals` ([computeTeamCapTotals.ts:63-81](src/features/architect/utils/capTotals/computeTeamCapTotals.ts#L63-L81)) exposes a single `totalCapAllocations` plus a `deltas` block comparing that one figure against `salaryCap`, `luxuryTax`, `firstApron`, and `secondApron`. A repo-wide search for `apronSalary|apronTeamSalary|computeApron` returns **zero** hits. `taxablePayroll`, `taxBill`, and `taxRate` exist as optional fields on the `TeamTotals` Zod schema ([architect.ts:256-259](src/schemas/architect.ts#L256-L259)) but no separate tax-salary derivation was located.

This is the canon's §4.1 concern (A01) and it is **upstream of most other rows** — several IDs below cannot be judged until Phase 2 establishes which ledger each rule is actually reading.

---

## 2. Primary map — all 56 canon audit IDs

One row per ID, each ID appearing exactly once. Counts in §3 are computed mechanically from this table.

**Authority** is carried from the canon (§1.1 / §19.1). **Prior findings** are numbered items from `CAP_ENGINE_EXTERNAL_TRUTH_AUDIT.md` — all **[PRELIM]**.

| ID | Canon § — requirement | Authority | Locatability | Primary implementation site | Prior findings [PRELIM] |
|---|---|---|---|---|---|
| CBA-A01 | §4.1 — Team/Apron/Tax/ITS/OTS derived as independent ledgers | CBA | **PARTIAL** | `capTotals/computeTeamCapTotals.ts`; `salaryEngine/salaryEngine.ts`; `schemas/architect.ts` | — (none) |
| CBA-A02 | §12.4 — Expanded TPE official formula + season scaling | CBA/DERIVED | **FOUND** | `tradeMachine/utils/salaryMatchingRules.ts` (`SALARY_MATCHING_TIERS`, `getSalaryMatchingResult`) | #59 #78 #83 #97 #98 #99 |
| CBA-A03 | §12.3 — Non-guaranteed OTS across the four date windows | CBA | **NO SITE** | candidate host: `tradeMachine/utils/matchingValues.ts` / `salaryUtils.ts` | — (none) |
| CBA-A04 | §12.3/§12.8 — Sign-and-trade base-year OTS adjustment | CBA | **PARTIAL** | `utils/cbaConstants.ts:151` + `tradeMachine/constants/cbaConstants.ts:106` (`BYC_PERCENT`) | #51 #93 |
| CBA-A05 | §12.3 — Poison-pill ITS for unstarted rookie extensions | CBA | **FOUND** | `mutationPipeline.helpers.playerNorm.contract.atoms.ts`; `tradeHelpers.ts`; `mutationPipeline.types.record.ts` | — (none) |
| CBA-A06 | §12.3 — Team-related bonus likelihood re-tested per team | CBA | **NO SITE** | candidate host: `mutationPipeline.helpers.ts` (incentive fields) | — (none) |
| CBA-A07 | §12.7 — Trade-bonus allocation increases ITS | CBA | **PARTIAL** | `schemaAdapter.ts`; `mutationPipeline.helpers.ts`; `mutationPipeline.types.record.ts` | — (none) |
| CBA-A08 | §12.3 — Minimum-exception contract as $0 ITS, OTS retained | CBA | **NO SITE** | candidate host: `tradeMachine/utils/matchingValues.ts` | — (none) |
| CBA-A09 | §12.4 — Standard / Aggregated / Expanded / Room TPEs as distinct paths | CBA | **FOUND** | `tradeMachine/rules/validateTradeExceptions.ts`; `utils/tpeValidation.ts`; `utils/tradeExceptionLifecycle.ts` | #60 #74–#84 |
| CBA-A10 | §12.4/§8.3 — One-out/multi-in under Standard TPE vs. outgoing-aggregation ban | CBA | **FOUND** | `tradeMachine/rules/validateAggregation.ts`; `constants/secondApronMessages.ts` | #92 #95 #96 #101 |
| CBA-A11 | §12.4 — Per-team TPE optimization + legal component decomposition | CBA | **PARTIAL** | `tradeMachine/engine/tradeValidator.teamValidation.ts` (`validateSingleTeam`) | #76 #80 |
| CBA-A12 | §8.1-§8.3 — Apron limits tested on **post-transaction** Apron Salary | CBA | **FOUND** | `tradeMachine/utils/hardCapStatus.ts` (`resolveHardCapCeiling`, `getHardCapStatus`); `hardCapUtils.ts` (`wouldExceedHardCap`) | #89 #102 |
| CBA-A13 | §8.2/§8.3 — Each triggering action creates and persists the correct hard cap | CBA | **FOUND** | `hardCapUtils.ts` (`checkIfActionTriggersHardCap`, `applyHardCapTrigger`); `hardCapStatus.ts` (`HARD_CAP_TYPES`, `getSigningHardCapTriggerMetadata`) | #38–#48 #81 #90 |
| CBA-A14 | §8.4 — Post-regular-season dual-year apron test, gated by transaction type | CBA | **NO SITE** | candidate host: `hardCapStatus.ts` | — (none) |
| CBA-A15 | §12.2 — Multi-team two-other-team touch graph + asset thresholds | **OPS** | **NO SITE** | candidate host: `tradeMachine/engine/tradeValidator.ts` | #101 |
| CBA-A16 | §9.4 — Open roster slots required at the instant of trade | CBA/BYL | **FOUND** | `tradeMachine/rules/validateRoster.ts` (`ROSTER_LIMITS`, `checkRosterCounts`) via `engine/tradeValidator.helpers.ts:133` | #55 |
| CBA-A17 | §13.3 — Stepien branches + seven-draft horizon | BYL + **OPS** | **FOUND** | `utils/stepienUtils.ts` (`passesStepienRule`, `hasStepienViolation`); `tradeMachine/rules/validateStepien.ts` | #52 #53 #54 |
| CBA-A18 | §12.12 — Cash sent/received tracked separately; second-apron block | CBA | **FOUND** | `tradeMachine/rules/validateCash.ts` (`SEASONAL_CASH_LIMIT`); `constants/cbaConstants.ts` (`CASH_LIMITS`) | #47 #49 #50 #100 #116 #117 #118 |
| CBA-C01 | §6.2 — FA cap holds from type/prior salary/EAPS/QO, max-min bounded | CBA | **FOUND** | `utils/capHolds.ts` (`CAP_HOLD_MULTIPLIERS`, `calculateCapHold`); `freeAgentRights.ts` | #2 #3 #4 #7 #8 |
| CBA-C02 | §6.2 — First-round-pick holds at 120%, lifecycle add/remove | CBA | **FOUND** | `utils/capHolds.ts` (`ROOKIE_SCALE`, `DEFAULT_ROOKIE_FALLBACK`); `data/rookieScale.ts` | #5 #6 #63 |
| CBA-C03 | §6.2 — Open-roster charge below **12**, July 1 → day before season | CBA | **FOUND** | `capTotals/computeTeamCapTotals.ts` (`incompleteRosterCharge`); schema `emptyRosterCharges` | #1 |
| CBA-C04 | §6.2 — Exception cap holds included and renounceable | CBA | **PARTIAL** | `exceptions/exceptionLifecycle.ts` (`NON_TPE_EXCEPTION_TYPES`); `computeTeamCapTotals.canUseRoomException` | — (none) |
| CBA-C05 | §6.4 — Minimum-contract subsidy across cap/apron/tax; drops on waiver | CBA | **NO SITE** | only `capSheet/devCapSheetFixtures.ts` mentions subsidy | #4 |
| CBA-C06 | §5.9 — Likely/unlikely bonuses reconciled across ledgers | CBA | **NO SITE** | candidate host: `mutationPipeline.helpers.ts` | — (none) |
| CBA-C07 | §8.1 — Apron Salary via enumerated VII.2(e)(1) add-backs | CBA | **NO SITE** | no `apronSalary` derivation exists; see §1.2 | — (none) |
| CBA-C08 | §8.6 — Tax Salary finalized separately; repeater 3-of-4 history | CBA | **PARTIAL** | schema `taxablePayroll` / `taxBill` / `taxRate`; no `repeater` symbol | — (none) |
| CBA-C09 | §8.6 — Progressive tax, bracket by bracket, season-scaled widths | DERIVED | **NO SITE** | no `taxBracket` symbol; `taxRate` is a single scalar | — (none) |
| CBA-C10 | §8.7 — 90% minimum team salary at start / in-season / year end | CBA | **PARTIAL** | `types/ruleContext.ts`; `seasonManager.helpers.ts`; `capHelpers.ts` | #61 |
| CBA-C11 | §6.5 — DPE and long-term injury exclusion as separate workflows | CBA | **PARTIAL** | `dpe` exists only as an exception-slot key (`mutationPipeline.types.record.ts:313`; `dashboardNormalizers.deadcap.ts:216-221`) | — (none) |
| CBA-C12 | §7.3 — DPE "unable to play through June 15" standard + limits | CBA/**EXT** | **NO SITE** | no medical-state model located | — (none) |
| CBA-C13 | §7.1/§7.3 — Exception balances divisible, prorated, renounceable, method-limited | CBA | **FOUND** | `exceptions/exceptionLifecycle.ts`; `exceptionOwnership.ts`; `faExceptionUtils.ts`; `FA_EXCEPTION_TRADE_USAGE` | #65 #84 |
| CBA-C14 | §7.2 — Bird clocks across signing/trade/waiver/claim/renunciation | CBA | **FOUND** | `freeAgentRights.ts` (`deriveBirdType`); `playerRulesProfile/birdRightsRules.ts` (`BIRD_RIGHTS_TYPES`, `computeBirdRights`) | #9–#15 #62 #111 #112 #114 |
| CBA-C15 | §10.3 — Arenas offer sheets valued differently for offering vs matching team | CBA | **NO SITE** | zero `arenas` references; offer-sheet machinery at `mutationPipeline.compute.offerSheets.*` | #34 |
| CBA-C16 | §5.4/§10.4 — Rookie options, extensions, Higher Max, declined-option cap | CBA | **FOUND** | `playerRulesProfile/maxSalaryRules.ts` (`MAX_SALARY_TIERS`, `checkSupermaxEligibility`); `extensionRules.ts`; `offseason/resolveOffseasonTransition.optionDecisions.ts` | #16–#28 #63 #113 #114 |
| CBA-C17 | §5.8 — Over-38 reallocation + July 1 reattribution | CBA | **NO SITE** | zero `over38` references | — (none) |
| CBA-C18 | §5.9 — Signing-bonus allocation by guaranteed proportions | CBA | **NO SITE** | zero `signingBonus` references | — (none) |
| CBA-R01 | §11.1 — Waiver frees slot immediately; 48-hour claim state preserved | BYL | **PARTIAL** | `mutationPipeline` waive ops; `offseason/WaiveStretchTracker/` | — (none) |
| CBA-R02 | §11.2 — Pre-Jan-10 dead salary = greater of earned and protected | CBA | **PARTIAL** | `waiverDeadCapAllocation.ts`; `capLegalityValidation.deadcap.ts` | — (none) |
| CBA-R03 | §11.2 — Actual veteran-minimum dollars for dead salary, not subsidized figure | CBA | **NO SITE** | depends on C05, which has no site | — (none) |
| CBA-R04 | §11.3 — Stretch differs before/after Sept 1; 15%-of-cap ceiling | CBA | **PARTIAL** | `waiverDeadCapAllocation.ts` (`getStretchProvisionYears`, `countRemainingContractSeasons`) | — (none) |
| CBA-R05 | §11.4 — Buyout reduction allocated proportionally; set-off reconciled | CBA | **PARTIAL** | `mutationPipeline.normalize.ts` / `.types.record.ts` (buyout); set-off not located as a rule | — (none) |
| CBA-R06 | §9.1 — 14-15 normal, temp 12/13, active list, 8-player bench as separate limits | CBA/BYL | **PARTIAL** | `tradeMachine/rules/validateRoster.ts` (`ROSTER_LIMITS` = 15 standard / 3 two-way only); zero `activeList` symbols | #55 |
| CBA-R07 | §9.1 — Short-roster consecutive-day and season-total clocks | CBA | **NO SITE** | no clock state located | — (none) |
| CBA-R08 | §9.3 — Two-way active-game cap and Under-Fifteen-Games totals | CBA | **NO SITE** | two-way modelled as a count only | #37 #56 |
| CBA-R09 | §9.2 — Offseason capacity switches to 21, lists merge | CBA | **PARTIAL** | `offseason/resolveOffseasonTransition.ts` | — (none) |
| CBA-R10 | §9.1 — Hardship / suspension-list / treatment-program states explicit | CBA/**EXT** | **NO SITE** | zero `hardship` references | — (none) |
| CBA-L01 | §4.4/§14 — Every hypothetical evaluated on an explicit date + season calendar | CBA | **FOUND** | `buildRuleContext.ts`; `seasonUtils.ts`; `timingUtils.ts`; `TRADE_TIMING` | #57 #82 |
| CBA-L02 | §10.4/§10.5 — Guarantees, options, ETOs, extensions, renegotiations event-driven | CBA | **PARTIAL** | `offseason/resolveOffseasonTransition.optionDecisions.ts`; `extensionRules.eligibility.ts` (renegotiation is one vestigial field) | #29 #103–#107 |
| CBA-L03 | §12.11 — Rule-generated `tradeEligibleOn` + consent constraints | CBA | **FOUND** | `timingUtils.ts` (`isWithinMoratorium`, `violates30Day`); `tradeTimingWindows.ts`; `rules/timingValidation.ts`; `consentUtils.ts`; `reacqUtils.ts` | #57 #58 #91 #94 #108 #109 #110 |
| CBA-L04 | §10.2/§10.3 — QO, offer sheet, matching, withdrawal, renunciation states | CBA | **FOUND** | `playerRulesProfile/rfaRules.ts` (`RFA_STATUS`, `computeQualifyingOffer`); `mutationPipeline.compute.offerSheets.*` | #30–#37 |
| CBA-L05 | §13.1 — Draft rights, required tenders, non-NBA contracts, subsequent drafts | CBA | **PARTIAL** | `draftPickUtils.ts`; `entitlements/`; `seasonManager.draftResolution.ts` | — (none) |
| CBA-L06 | §12.5 — TPEs persist source, balance, use history, expiration | CBA | **FOUND** | `tpeLifecycle.ts` (`getTpeExpiryISO`, `processTradeExceptions`); `persistenceContracts/normalizeTeamTpe.ts` | #74 #75 #76 #82 |
| CBA-L07 | §8.2/§8.3 — Hard caps stored with level, trigger, start, end | CBA | **FOUND** | `hardCapUtils.ts` (`applyHardCapTrigger`); `capTotals/hardCapSnapshotOverlay.ts`; schema `hardCapLevel` / `hardCapReason` | #45 |
| CBA-L08 | §8.5/§8.6 — Taxpayer and second-apron history retained across seasons | CBA | **NO SITE** | zero `repeater` symbols; no multi-season apron history located | — (none) |
| CBA-L09 | §8.5/§13.3 — Frozen / slid / unfrozen picks in ownership and Stepien logic | CBA | **PARTIAL** | `draftPickUtils.ts`; `secondApronMessages.ts` (`frozen` appears in 4 files) | #54 |
| CBA-L10 | §18 — Externally adjudicated states settable with provenance | **EXT** | **NO SITE** | no assumption/override/provenance model located | — (none) |

---

## 3. Mechanically computed totals

Every number in this section is produced by a script over the §2 table, not counted by eye. Reproduce with:

```bash
# Extract the primary map rows and count
awk -F'|' '/^\| CBA-[ACRL][0-9]/ {gsub(/^ +| +$/,"",$2); gsub(/\*/,"",$5); gsub(/^ +| +$/,"",$5); print $2"\t"$5}' \
  work/architect-completion/ARCHITECT_CBA_CANON_CODE_MAP.md
```

### 3.1 Row-count integrity

| Check | Expected | Actual |
|---|---:|---:|
| Rows in primary map | 56 | **56** |
| Distinct IDs | 56 | **56** |
| Any ID appearing more than once | 0 | **0** |
| CBA-A01…A18 present | 18 | **18** |
| CBA-C01…C18 present | 18 | **18** |
| CBA-R01…R10 present | 10 | **10** |
| CBA-L01…L10 present | 10 | **10** |

### 3.2 Locatability totals

| Locatability | A (18) | C (18) | R (10) | L (10) | **Total (56)** | Share |
|---|---:|---:|---:|---:|---:|---:|
| **FOUND** | 9 | 6 | 0 | 5 | **20** | 35.7% |
| **PARTIAL** | 4 | 4 | 6 | 3 | **17** | 30.4% |
| **NO SITE** | 5 | 8 | 4 | 2 | **19** | 33.9% |

The R-series (waivers and rosters) has **zero FOUND** rows — every roster and waiver rule is either partially sited or unsited. That is the least-mapped region of the canon.

### 3.3 Prior-audit coverage of the canon

Counted mechanically: an ID is "addressed" if its Prior-findings column carries at least one finding.

| Measure | Count | Share of 56 |
|---|---:|---:|
| Canon IDs with ≥1 mapped prior finding | **29** | 51.8% |
| Canon IDs **neither prior audit addressed** | **27** | 48.2% |

**Just under half the canon was never examined by BZE-255 or BZE-259.**

One caveat on "addressed": it means *touched*, not *covered*. **C10** counts as addressed solely because finding #61 verified the minimum-team-salary **constant** ($148,465,000) — the 90% floor **process** (§8.7: start-of-season charge, in-season floor, year-end reconciliation) was never audited. Several other "addressed" IDs are similarly thin. Phase 2 should not read "addressed" as "covered".

---

## 4. Canon IDs neither prior audit addressed (27)

These have **zero** prior findings mapped. They are not "clean" — they are **unexamined**.

| Series | Unaddressed IDs | Count | Theme |
|---|---|---:|---|
| **A** | A01, A03, A05, A06, A07, A08, A14 | 7 | The entire ITS/OTS trade-salary basis, the ledger separation, and the post-season dual-year apron test |
| **C** | C04, C06, C07, C08, C09, C11, C12, C17, C18 | 9 | Apron Salary derivation, Tax Salary + repeater, progressive tax, DPE, Over-38, signing bonuses, exception holds |
| **R** | R01, R02, R03, R04, R05, R07, R09, R10 | 8 | Nearly the whole waiver / dead-salary / roster-legality surface |
| **L** | L05, L08, L10 | 3 | Draft rights & tenders, taxpayer/apron history, external-determination provenance |
| | **Total** | **27** | |

**The most consequential cluster is C07 + C08 + C09 + A01.** Apron Salary and Tax Salary are the bases on which apron and tax verdicts rest, and no prior audit looked at how — or whether — they are derived. Both prior audits verified *values against thresholds*; neither asked whether the *salary figure being compared* is the one the CBA specifies.

---

## 5. Reverse index — every prior finding → canon ID

All entries **[PRELIM]**. Findings are from `CAP_ENGINE_EXTERNAL_TRUTH_AUDIT.md`: Part 1 (BZE-255) = #1–#73; Part 2 (BZE-259) = #74–#118. **118 numbered findings total.**

### 5.1 Findings that map to a canon audit ID

| Finding(s) | Canon ID(s) |
|---|---|
| #1 | C03 |
| #2, #3, #7, #8 | C01 |
| #4 | C01, C05 |
| #5, #6 | C02 |
| #9–#15 | C14 |
| #16–#22, #23, #24–#28 | C16 |
| #29 | L02 |
| #30–#33, #35, #36 | L04 |
| #34 | C15 |
| #37 | L04, R08 |
| #38–#46, #48 | A13 |
| #47 | A13, A18 |
| #49, #50 | A18 |
| #51 | A04 |
| #52, #53 | A17 |
| #54 | A17, L09 |
| #55 | A16, R06 |
| #56 | R08 |
| #57 | L01, L03 |
| #58 | L03 |
| #59 | A02 |
| #60 | A09, L06 |
| #62 | C14, C16 |
| #63 | C02, C16 |
| #65 | C13 |
| #74, #75 | L06 |
| #76 | A09, A11, L06 |
| #77, #79 | A09 |
| #78 | A02, A09 |
| #80 | A09, A11 |
| #81 | A09, A13 |
| #82 | A09, L01, L06 |
| #83 | A02 |
| #84 | C13 |
| #89 | A12, A13 |
| #90 | A13 |
| #91 | L03 |
| #92 | A10 |
| #93 | A04 |
| #94 | L03 |
| #95 | A10 |
| #97, #98, #99 | A02 |
| #100 | A18 |
| #101 | A10, A15 |
| #102 | A12 |
| #103–#107 | L02 |
| #108, #109 | L03 |
| #110 | L03 (rule); duplication itself → no canon requirement |
| #111, #112 | C14 |
| #113 | C16 |
| #114 | C14, C16 |
| #116, #117, #118 | A18 |

### 5.2 Prior findings that map to a canon **requirement** but to **no audit ID**

The canon states these obligations in prose without minting an audit ID. **These are consolidated and characterized in §6, "Canon ID Coverage Gaps."** No IDs are minted here or there.

| Finding(s) | Canon requirement (no ID) |
|---|---|
| #61, #64, #66–#73, #115 | **§3.1 Parameter policy** — one canonical, sourced, season-keyed value per constant; provenance labels must be truthful |
| #117 (partly) | §3.1 — "do not duplicate constants across calculators" |
| #23 | §3.1 — same (inert duplicate max-salary rows) |
| #85, #86, #87, #88 | **§12.8 Sign-and-trade contract shape** — term, guarantee, raises, first-year ceiling |

### 5.3 Prior findings that map to **no canon requirement at all** (2)

| Finding | Nature | Note |
|---|---|---|
| **#96** | Dead constant — `SECOND_APRON_MULTI_PLAYER_AGGREGATION_BLOCKED` defined, never used | Code hygiene. The canon requires the *rule* (A10); it does not legislate dead code. |
| **#110** (duplication half) | Two parallel reacquisition implementations | Code hygiene. The canon requires one correct rule (L03), not one implementation. |

Both are real engineering concerns and neither is a CBA question. They should not be dressed up as canon compliance items.

---

## 6. Canon ID Coverage Gaps

**Status: input to a future canon-index completeness review. Not authorized work, not a verdict, not a proposal to mint IDs.**

The canon's audit register (§15) is the index used to drive Phase 2. Building §2 and §5 surfaced canon **requirements stated in prose that no audit ID fully represents**. This section records them so a fresh session can decide, deliberately, whether the register is complete.

Two things this section explicitly does **not** do:

- It does **not** mint, propose, number, or reserve any new audit ID.
- It does **not** judge whether the underlying rules are implemented, correct, or in V1 scope.

The risk it exists to prevent is narrow and specific: **a Phase 2 driven only by the 56 registered IDs would never look at these requirements at all** — not because they were reviewed and cleared, but because nothing in the register points at them. That is a gap in the index, not necessarily a gap in the product.

### 6.1 Canon §3.1 — season parameters and configuration policy

**What the canon requires (§3.1, "Parameter policy"):** every cap-indexed monetary value lives in a season-configuration layer keyed by Salary Cap Year; the engine embeds no example dollars in rule logic; each constant has one canonical, sourced value; provenance labels are truthful; and the enumerated set (cap/tax/apron/floor, minimum scale, rookie scale, NTMLE/TMLE/Room MLE/BAE/EIPPA, two-way, Exhibit 10, cash limit, tax-bracket width and rates, regular-season day count and calendar, Expanded TPE scaled amount) is configured per season.

**Representation in the register:** none directly. No CBA-A/C/R/L ID owns the parameter layer. Individual IDs *consume* it (A02 reads the Expanded TPE scaled amount, C09 reads bracket widths, C01 reads EAPS and the minimum scale), but no ID asks whether the layer itself is sound, single-sourced, season-keyed, or honestly labelled.

**Why this matters for Phase 2 sequencing:** the parameter layer is the base of the dependency graph in §7 — every monetary verdict reads it. A correct rule reading a wrong constant yields a wrong answer, and a Phase 2 that verifies only rules would attribute that to the rule.

**Prior findings landing here with no ID to hold them:** #61, #64, #66, #67, #68, #69, #70, #71, #72, #73, #115, and the duplicate-constant half of #23 and #117 — **14 findings**, the single largest cluster in §5.2. They are currently homeless in the register.

**Repository surface (locatability only):** `utils/capProjections.ts`, `data/capYearData.ts`, `data/minimumSalaryScales.ts`, `data/rookieScale.ts`, `utils/cbaConstants.ts`, `tradeMachine/constants/cbaConstants.ts`.

### 6.2 Canon §12.8 — sign-and-trade

**What the canon requires (§12.8):** the player must be a free agent who finished the prior season on the sending team's roster; the transaction must complete before the regular season; the new contract must cover at least three and no more than four seasons excluding options, with Year 1 fully protected for lack of skill; certain exceptions may not be used to sign the player; the receiving team must hold sufficient transaction authority for salary plus applicable unlikely bonuses; receiving by sign-and-trade is a First Apron transaction that creates a First Apron hard cap; the player cannot be re-aggregated for the prescribed period; the base-year OTS adjustment may apply to the sender; and a signing bonus paid by the sending team is treated as cash-in-trade.

**Representation in the register:** **partial and indirect only.** The consequences are registered but the eligibility and contract shape are not:

| §12.8 requirement | Registered ID? |
|---|---|
| Base-year OTS adjustment on the sender | **A04** — yes |
| First Apron transaction limit + resulting hard cap | **A12 / A13** — yes |
| Anti-re-aggregation period | **A10 / L03** — partially |
| Signing bonus paid by sender treated as cash-in-trade | **A18** — arguably |
| **Player eligibility** (free agent, finished prior season on sending roster) | **none** |
| **Contract length** (3–4 seasons excluding options) | **none** |
| **Year-1 full protection for lack of skill** | **none** |
| **Signing-authority / exception restrictions on the signing team** | **none** |
| **First-year salary ceiling and raise limits** | **none** |

**Prior findings landing here with no ID to hold them:** #85, #86, #87, #88 — sign-and-trade contract length, first-year guarantee, raise limit, and first-year salary ceiling. Two of these ([PRELIM]) report the raise limit and salary ceiling as unenforced.

**Repository surface (locatability only):** `tradeMachine/signAndTrade/signAndTradeEligibility.ts` (749 lines), `tradeMachine/rules/validateSignAndTrade.ts`.

### 6.3 Consolidated gap register

| Canon area | Requirement family not fully represented by an audit ID | Homeless prior findings | Repo surface located? |
|---|---|---:|---|
| **§3.1** | Season-parameter and configuration policy — single canonical source, season-keying, truthful provenance, enumerated per-season value set | 14 | Yes |
| **§12.8** | Sign-and-trade eligibility, contract length, Year-1 guarantee, signing authority, contract shape | 4 | Yes |

**Both entries are "at least" claims.** §2 and §5 were built to map the 56 registered IDs, not to audit the register for completeness. Other canon prose may carry the same property. A deliberate index-completeness pass over the full canon — not a by-product of this mapping exercise — is the only way to know. That pass is **not** authorized here and has **not** been started.

---

## 7. Dependency map — rules that cannot be reviewed independently

Phase 2 must respect these. Reviewing a dependent rule before its base produces a verdict that has to be redone.

```
                    ┌────────────────────────────────┐
                    │  §3.1 SEASON PARAMETER LAYER   │  ← cap, tax, aprons, minimums,
                    │  capProjections · capYearData  │    rookie scale, EAPS, cash limits
                    │  minimumSalaryScales · rookie  │
                    └───────────────┬────────────────┘
                                    │ every monetary rule reads this
                    ┌───────────────▼────────────────┐
                    │  A01  LEDGER SEPARATION        │
                    │  Team / Apron / Tax / ITS / OTS│
                    └───┬──────────┬─────────┬───────┘
            ┌───────────▼──┐  ┌────▼──────┐  ▼
            │ C07 Apron    │  │ C08 Tax   │  ITS/OTS basis
            │ Salary       │  │ Salary    │  A03 A04 A05 A06 A07 A08
            └───┬──────────┘  └────┬──────┘         │
                │                  │                │
        ┌───────▼────────┐    ┌────▼────┐    ┌──────▼──────────┐
        │ A12 apron tests│    │ C09 tax │    │ A02 TPE formula │
        │ A13 hard caps  │    │ L08 hist│    │ A09/A10/A11 TPE │
        │ A14 dual-year  │    │ (repeat)│    │      paths      │
        └───────┬────────┘    └─────────┘    └──────┬──────────┘
                │                                    │
                └──────────► L07 hard-cap ◄──────────┘
                             persistence
```

**Hard dependency chains (base → dependent):**

| Base | Dependents | Why |
|---|---|---|
| **§3.1 parameters** | *All 56* | Every monetary verdict reads a season constant. A wrong constant makes a correct rule produce a wrong answer. |
| **A01** (ledger separation) | C07, C08, A03–A08, A12, A13 | You cannot judge whether an apron test uses the right number until you know which ledger it reads. |
| **C07** (Apron Salary) | A12, A13, A14, L07 | Every apron verdict is a comparison against Apron Salary. |
| **C08** (Tax Salary) | C09, L08 | Progressive tax and repeater history both consume Tax Salary. |
| **C05** (minimum subsidy) | R03, C01(#4) | Dead salary must use actual, not subsidized, compensation — so the subsidy must exist first. |
| **A02** (Expanded TPE formula) | A09, A10, A11 | The TPE paths all consume the matching formula. |
| **A09** (TPE paths) | L06, A13(#81/#82) | TPE persistence and the prior-year-TPE hard cap both key off TPE identity. |
| **C14** (Bird clocks) | C01, C16, L04 | Cap holds, extensions, and RFA rights are all functions of Bird status. |
| **C02 / rookie scale** | C16, L05 | Rookie holds, options, and extensions all read the rookie scale. |
| **L01** (dated evaluation) | A03, L03, R02, R04, C03 | Every date-windowed rule needs a trustworthy `asOfDate`. |
| **A17 / L09** | Each other | Frozen/slid picks change what Stepien may legally convey. |

**The two circular-risk pairs**, which Phase 2 should review as single units rather than sequentially:

- **A17 ↔ L09** (Stepien ↔ frozen picks)
- **C01 ↔ C14** (cap holds ↔ Bird rights)

---

## 8. Proposed Phase 2 review packets

Seven packets, ordered so that no packet depends on a later one. All 56 IDs appear exactly once.

| # | Packet | Canon IDs | Count | Why here |
|---|---|---|---|---|
| **P1** | **Ledgers, season parameters & dated evaluation (foundation)** | A01, C05, C06, C07, C08, C09, C10, L01 | 8 | Nothing downstream can be judged until we know which salary number each rule reads, whether the parameter layer is sound, and whether `asOfDate` semantics are trustworthy. **Blocks everything.** |
| **P2** | **Trade-salary basis (ITS/OTS)** | A03, A04, A05, A06, A07, A08 | 6 | The per-player inputs to every trade verdict. Entirely unexamined by both prior audits. Depends on P1. |
| **P3** | **TPE paths, aprons & hard caps** | A02, A09, A10, A11, A12, A13, A14, L06, L07 | 9 | The trade engine proper. Consumes P1's ledgers and P2's salary basis. Carries the heaviest [PRELIM] finding load. |
| **P4** | **Cap holds, exceptions, Bird / RFA / extensions** | C01, C02, C03, C04, C11, C12, C13, C14, C15, C16, C17, C18, L02, L04 | 14 | The offseason free-agency core — the product's load-bearing surface. Depends on P1 (ledgers) and the parameter layer. |
| **P5** | **Rosters, waivers & dead money** | A16, R01, R02, R03, R04, R05, R06, R07, R08, R09, R10 | 11 | The least-mapped region (zero FOUND rows). Depends on P1 (C05 subsidy → R03; L01 dates). |
| **P6** | **Picks, cash, multi-team & Stepien** | A15, A17, A18, L05, L09 | 5 | Largely self-contained; A17↔L09 reviewed as one unit. Includes the two **OPS** items that must stay configurable. |
| **P7** | **Transaction timing, history & external determination** | L03, L08, L10 | 3 | Cross-cutting closers. L03 (trade-eligible dates and consent) consumes L01's calendar, now settled in P1. |

**Total: 8 + 6 + 9 + 14 + 11 + 5 + 3 = 56 ✓**

**Recommended order: P1 → P2 → P3 → P4 → P5 → P6 → P7.**

**L01 placement (owner decision, 2026-07-13).** L01 (explicit dated evaluation and season calendar) was originally drafted into P7. It has been **moved into P1** because it is a hard dependency of the date-windowed rules in P2 (A03 especially), P4, and P5. Leaving it in P7 would have forced provisional verdicts across three packets. P1 is now the single foundation packet: *which ledger, which parameter, which date* — the three questions every downstream verdict rests on.

---

## 9. Phase 2 evidence procedure

### 9.1 Required per-ID output record

The canon (§17) fixes this. Every Phase 2 ID must produce:

| Field | Required content |
|---|---|
| Coverage | Covered and proven / Partial / Missing in scope / Intentional exclusion / Data-blocked / Externally adjudicated |
| Product layer | Representation / Calculation / Enforcement / Explanation / Lifecycle |
| Severity | Critical false legality / High monetary or roster error / Medium planning gap / Low authoring depth |
| Evidence | Repo path + calculation trace + UI behavior + test result — **never a conclusory "supported"** |
| Authority | Canon § + CBA/BYL/NBA/DERIVED/OPS/EXT citation |
| Remediation | Smallest concrete model/logic/data/UI/test change |

### 9.2 The method that is not negotiable

Both prior audits established — the hard way — that **reading the code and agreeing with it produces false PASSes**. BZE-253 marked the empty-roster charge PASS; it was wrong. So:

1. **Work every rule by hand against the canon, with a worked numeric example**, before reading the implementation.
2. **Do not accept a passing test as evidence.** Assume the test pins the bug. (590 test files exist; they are overwhelmingly `*.guardrail.test.ts` / `*.behavior.test.ts` architecture tests, not CBA-truth tests.)
3. **Cite the canon section and the CBA/BYL article** for every verdict — the canon is now the oracle, replacing the secondary-source reliance both prior audits flagged as their own key weakness.
4. **OPS and EXT items may never receive a deterministic verdict.** A15 (multi-team touch) and the seven-draft horizon are OPS; C12, R10, L10 are EXT. Confirm they are configurable and labelled, do not "promote" them.

### 9.3 Commands

Read-only inspection:

```bash
graphify query "<question>"                 # scoped subgraph; prefer over raw grep
graphify explain "<concept>"
graphify path "<A>" "<B>"                   # dependency between two symbols
```

Scoped validation (per AGENTS.md — **never** run the full suite without the literal phrase `RUN FULL SUITE`):

```bash
npm run test:architect -- --reporter=dot    # Architect feature scope
npm run test:trade     -- --reporter=dot    # Trade Machine scope
npm run test:node      -- --reporter=dot    # logic-heavy / non-UI
npm run test:diff      -- --reporter=dot    # default when unsure; selects from git diff
npm run typecheck
```

Evidence capture per ID:

```bash
# 1. Locate
grep -rn "<symbol>" src/features/architect --include='*.ts' | grep -v '\.test\.'
# 2. Trace the execution path to the validator that actually runs
#    (many constants in this repo are defined and never read — see #51, #96)
# 3. Confirm the constant the enforcing code path reads is the one you audited
```

> **The #116 trap.** Part 2 found that `validateCash.ts` enforces a hardcoded `SEASONAL_CASH_LIMIT` and **never reads** the `CASH_LIMITS` table that Part 1 audited. Auditing a constant proves nothing until you have proved the enforcing path reads it. **Every Phase 2 ID must trace constant → execution path → verdict.**

### 9.4 Canon release gate

Before any canon or parameter change governs Architect, complete the canon's §17 ten-step release gate (primary-source check, diff, arithmetic, cross-ledger, lifecycle, boundary tests, contradiction scan, unknowns check, link check, regression run).

---

## 10. Open questions Phase 2 must resolve

Carried per-ID, consolidated here.

| # | Question | Blocks |
|---|---|---|
| 1 | Does any code path derive an **Apron Salary** distinct from `totalCapAllocations`? If not, what do the apron comparisons actually compare? | A01, C07, A12, A13 |
| 2 | Is `taxablePayroll` derived independently, or aliased to team salary? | C08, C09 |
| 3 | Is the `poisonPill` field (A05) the CBA poison-pill rule or an unrelated flag? | A05 |
| 4 | Do `tradeBonus` fields feed ITS, or are they display-only? | A07 |
| 5 | Which of the four OTS date windows, if any, does the trade engine implement? | A03 |
| 6 | Is `BYC_PERCENT` genuinely unreferenced in both definitions? (Both prior audits say yes.) | A04 |
| 7 | Does `validateRoster` run at trade time with **pre-waiver** slot counts? | A16 |
| 8 | Is the seven-draft horizon a hard-coded constant or configurable? (**OPS** — must be configurable.) | A17 |
| 9 | Where would an assumption/override with provenance be stored? No model located. | L10, C12, R10 |
| 10 | Is renegotiation intentionally excluded from V1, or an unbuilt gap? **Owner product call, not an engine verdict.** | L02 |
| 11 | Do the 13 Playwright e2e specs (`tests/e2e/`) assert any CBA number, or only UI presence? | All (evidence quality) |
| 12 | Is `SALARY_MATCHING_TIERS` season-keyed yet? (BZE-257 [PRELIM] says no.) | A02 |

---

## 11. Phase 1 boundaries observed

- No application code, test, fixture, schema, constant, data, or configuration file was modified **except** the one authorized `.gitignore` fix (below).
- No BZE finding implemented. No existing behavior changed. No new Linear issues created. No existing Linear issue rewritten.
- No CBA-rule verdicts made. No V1 scope decided.
- Nothing committed or pushed.
- **Authorized deviation:** `.gitignore:152` was changed from `cba/` to `/cba/`. The unanchored pattern silently ignored `docs/reference/cba/`, making the canon untrackable by git. The owner authorized this fix on 2026-07-13. The top-level `cba/` reference folder remains ignored; verified in both directions.
- **Known documentation-check deviation:** the byte-identical canon fails `markdownlint` MD029 (31 errors — the §16 acceptance-test list is numbered 1–46 continuously across sub-headings). The canon was **not** modified. `npm run lint:md` was already failing on `main` for 4 pre-existing docs (53 errors), so this does not break a green gate. `npm run docs:guardrails` **passes**. Owner accepted this on 2026-07-13.

---

## 12. Files

| File | Status |
|---|---|
| `docs/reference/cba/ARCHITECT_CBA_CANON.md` | Created — byte-identical, SHA-256 verified |
| `work/architect-completion/ARCHITECT_CBA_CANON_CODE_MAP.md` | Created — this document |
| `.gitignore` | Modified — authorized one-line anchor fix |
