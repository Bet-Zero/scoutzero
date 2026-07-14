# Architect CBA Canon — Phase 1 Code Map

**Phase:** 1 of 2 — **locatability and audit design only.**
**Active audit oracle:** Canon **v1.1** — `docs/reference/cba/ARCHITECT_CBA_CANON.md` (SHA-256 `4a0760c81d7a5e95919a0373d5ff631b565d064d56b858fe3b8869ad2b6bb3f6`)
**Historical provenance:** Canon v1.0 — SHA-256 `b8cf5d01356b3a83de4663f5bd6843e9aa58c8c06a84227385ae93bc02d969ef`, primary-source-verified and independently checked; that verification carries forward unchanged into v1.1, which amended the **index only**.
**Repo state:** branch `main`, commit `9bea1d5f`, working tree otherwise clean
**Date:** 2026-07-14 (supersedes the 2026-07-13 edition, which mapped the 56 v1.0 IDs)

---

## 0. What this document is — and is not

This maps Canon v1.1's **368 LEAF obligations** — the complete Phase 2 audit universe — to the place in the repository where each rule would live, so a Phase 2 reviewer can go straight to the code instead of re-deriving the surface.

**It assigns no verdicts.** No rule here is called compliant, incorrect, missing, or implementation-ready. The only judgment made is **locatability**:

| Locatability | Meaning |
|---|---|
| **FOUND** | A clear implementation site exists for this rule. |
| **PARTIAL** | Machinery exists, but a required component of the canon rule has no obvious site. |
| **NO SITE** | No obvious implementation site was located anywhere in the repository. |

> **NO SITE is a mapping result, not a finding.** It means a grep-and-read sweep did not locate an implementation site. It does **not** establish that the functionality is absent, that it is a defect, or that it is in V1 scope. Phase 2 confirms or overturns every one of these.

### 0.1 GROUP and LEAF — and why only LEAF is counted

The register (canon §15.6) is a two-level tree:

| Node | Definition | In this document |
|---|---|---|
| **GROUP** (59) | A top-level ID that owns child obligations | Appears **only** in the §3 hierarchy/rollup. It receives **no** locatability, **no** verification method, **no** packet count, and **no** verdict. Its status is a derived rollup of its children. |
| **LEAF** (368) | An independently auditable obligation — a sub-ID, or a top-level ID owning exactly one obligation | The execution unit. Appears exactly once in §2 and exactly once in one Phase 2 packet. |

**A GROUP is never an execution unit.** Scoring a grouping parent alongside its children double-counts the rule family and permits a parent verdict that contradicts its own children — for example a FOUND on `CBA-C13` while three of its fifteen children have no implementation site at all. Every total in this document is therefore computed across **LEAF identifiers only**.

**Sub-ID locatability rule.** A LEAF inherits its parent's mapped site unless a targeted sweep found different evidence. §2.3 lists **every** LEAF whose locatability differs from its parent, with the symbol searched. Inheritance is stated, not assumed silently.

All prior BZE-255 / BZE-259 findings referenced here remain **[PRELIM]** and carry no authority.

---

## 1. Two global facts that apply to every row

**1.1 — There is no backend CBA enforcement anywhere.** `functions/src/` contains exactly two files. A search of `functions/` for `validateTrade|capLegality|salaryMatch|apron` returns **zero** hits. **Every CBA rule in Architect is enforced client-side only.**

**1.2 — The cap engine derives one salary number, not independent ledgers.** `ComputedTeamCapTotals` exposes a single `totalCapAllocations`. A repo-wide search for `apronSalary|apronTeamSalary|computeApron` returns **zero** hits. This is the canon's §4.1 concern (`CBA-A01`) and it is **upstream of most other rows**.

This is why `CBA-C07` (Apron Salary) is a GROUP over **ten** LEAF obligations, one per enumerated CBA VII.2(e)(1) adjustment plus the before/after rule: with no apron derivation at all, a single C07 verdict would have hidden ten independent failures.

---

## 2. Primary execution map — all 368 LEAF obligations

Every LEAF appears **exactly once**. GROUP anchors are **not** listed here; they are in §3.2.

### 2.1 LEAF map

| LEAF | Parent | Canon § | Locatability | Implementation site / evidence | Method | Scenario | Packet | Unit |
|---|---|---|---|---|---|---|---|---|
| CBA-A01.1 | CBA-A01 | §4.1 | **PARTIAL** | `capTotals/computeTeamCapTotals.ts`; `salaryEngine/salaryEngine.ts`; `schemas/architect.ts` | SCEN | #47 | P1 | W1.2 |
| CBA-A01.2 | CBA-A01 | §4.1 | **PARTIAL** | `capTotals/computeTeamCapTotals.ts`; `salaryEngine/salaryEngine.ts`; `schemas/architect.ts` | SCEN | #47 | P1 | W1.2 |
| CBA-A01.3 | CBA-A01 | §4.1 | **PARTIAL** | `capTotals/computeTeamCapTotals.ts`; `salaryEngine/salaryEngine.ts`; `schemas/architect.ts` | SCEN | #47 | P1 | W1.2 |
| CBA-A01.4 | CBA-A01 | §6.1 | **PARTIAL** | `capTotals/computeTeamCapTotals.ts`; `salaryEngine/salaryEngine.ts`; `schemas/architect.ts` | SCEN | #47 | P1 | W1.2 |
| CBA-A02.1 | CBA-A02 | §3 | **FOUND** | `tradeMachine/utils/salaryMatchingRules.ts` | SCEN | #1 | P3 | W3.1 |
| CBA-A02.2 | CBA-A02 | §3 | **FOUND** | `tradeMachine/utils/salaryMatchingRules.ts` | SCEN | #56 | P3 | W3.1 |
| CBA-A02.3 | CBA-A02 | §3 | **FOUND** | `tradeMachine/utils/salaryMatchingRules.ts` | SCEN | #1 | P3 | W3.1 |
| CBA-A02.4 | CBA-A02 | §12.4 | **FOUND** | `tradeMachine/utils/salaryMatchingRules.ts` | SCEN | #1, #2 | P3 | W3.1 |
| CBA-A02.5 | CBA-A02 | §12.4 | **FOUND** | `tradeMachine/utils/salaryMatchingRules.ts` | SCEN | #1 | P3 | W3.1 |
| CBA-A02.6 | CBA-A02 | §12.4 | **FOUND** | `tradeMachine/utils/salaryMatchingRules.ts` | SCEN | #1 | P3 | W3.1 |
| CBA-A02.7 | CBA-A02 | §12.4 | **FOUND** | `tradeMachine/utils/salaryMatchingRules.ts` | SCEN | #56 | P3 | W3.1 |
| CBA-A02.8 | CBA-A02 | §12.5 | **FOUND** | `tradeMachine/utils/salaryMatchingRules.ts` | SCEN | #56 | P3 | W3.1 |
| CBA-A03.1 | CBA-A03 | §3 | **NO SITE** | candidate host: `tradeMachine/utils/matchingValues.ts` | SCEN | #7 | P2 | W2.1 |
| CBA-A03.2 | CBA-A03 | §12.3 | **NO SITE** | candidate host: `tradeMachine/utils/matchingValues.ts` | SCEN | #7 | P2 | W2.1 |
| CBA-A03.3 | CBA-A03 | §12.3 | **NO SITE** | candidate host: `tradeMachine/utils/matchingValues.ts` | SCEN | #7 | P2 | W2.1 |
| CBA-A03.4 | CBA-A03 | §12.3 | **NO SITE** | candidate host: `tradeMachine/utils/matchingValues.ts` | SCEN | #7 | P2 | W2.1 |
| CBA-A03.5 | CBA-A03 | §12.3 | **NO SITE** | candidate host: `tradeMachine/utils/matchingValues.ts` | SCEN | #7 | P2 | W2.1 |
| CBA-A04 | — | §12.3 | **PARTIAL** | `utils/cbaConstants.ts:151`; `tradeMachine/constants/cbaConstants.ts:106` (`BYC_PERCENT`) | SCEN | #15 | P2 | W2.1 |
| CBA-A05.1 | CBA-A05 | §10.4 | **FOUND** | `mutationPipeline.helpers.playerNorm.contract.atoms.ts`; `tradeHelpers.ts` | SCEN | #11 | P2 | W2.1 |
| CBA-A05.2 | CBA-A05 | §12.3 | **FOUND** | `mutationPipeline.helpers.playerNorm.contract.atoms.ts`; `tradeHelpers.ts` | SCEN | #11 | P2 | W2.1 |
| CBA-A06.1 | CBA-A06 | §5.9 | **NO SITE** | candidate host: `mutationPipeline.helpers.ts` (incentive fields) | SCEN | #12 | P2 | W2.1 |
| CBA-A06.2 | CBA-A06 | §12.3 | **NO SITE** | candidate host: `mutationPipeline.helpers.ts` (incentive fields) | SCEN | #12 | P2 | W2.1 |
| CBA-A07.1 | CBA-A07 | §5.4 | **PARTIAL** | `schemaAdapter.ts`; `mutationPipeline.helpers.ts` (`tradeKicker`) | SCEN | #13 | P2 | W2.1 |
| CBA-A07.2 | CBA-A07 | §5.9 | **PARTIAL** | `schemaAdapter.ts`; `mutationPipeline.helpers.ts` (`tradeKicker`) | SCEN | #13 | P2 | W2.1 |
| CBA-A07.3 | CBA-A07 | §12.3 | **PARTIAL** | `schemaAdapter.ts`; `mutationPipeline.helpers.ts` (`tradeKicker`) | SCEN | #13 | P2 | W2.1 |
| CBA-A07.4 | CBA-A07 | §12.7 | **PARTIAL** | `schemaAdapter.ts`; `mutationPipeline.helpers.ts` (`tradeKicker`) | SCEN | #13 | P2 | W2.1 |
| CBA-A07.5 | CBA-A07 | §12.7 | **PARTIAL** | `schemaAdapter.ts`; `mutationPipeline.helpers.ts` (`tradeKicker`) | SCEN | #49 | P2 | W2.1 |
| CBA-A07.6 | CBA-A07 | §12.7 | **PARTIAL** | `schemaAdapter.ts`; `mutationPipeline.helpers.ts` (`tradeKicker`) | SCEN | #14 | P2 | W2.1 |
| CBA-A07.7 | CBA-A07 | §12.7 | **PARTIAL** | `schemaAdapter.ts`; `mutationPipeline.helpers.ts` (`tradeKicker`) | SCEN | #13 | P2 | W2.1 |
| CBA-A07.8 | CBA-A07 | §12.7 | **PARTIAL** | `schemaAdapter.ts`; `mutationPipeline.helpers.ts` (`tradeKicker`) | SCEN | #49 | P2 | W2.1 |
| CBA-A07.9 | CBA-A07 | §12.7 | **PARTIAL** | `schemaAdapter.ts`; `mutationPipeline.helpers.ts` (`tradeKicker`) | SCEN | #49 | P2 | W2.1 |
| CBA-A08.1 | CBA-A08 | §7.3 | **NO SITE** | candidate host: `tradeMachine/utils/matchingValues.ts` | SCEN | #9 | P2 | W2.1 |
| CBA-A08.2 | CBA-A08 | §12.3 | **NO SITE** | candidate host: `tradeMachine/utils/matchingValues.ts` | SCEN | #9 | P2 | W2.1 |
| CBA-A09.1 | CBA-A09 | §7.3 | **FOUND** | `tradeMachine/rules/validateTradeExceptions.ts`; `utils/tpeValidation.ts` | SCEN | #3, #4, #5, #6 | P3 | W3.1 |
| CBA-A09.2 | CBA-A09 | §12.4 | **FOUND** | `tradeMachine/rules/validateTradeExceptions.ts`; `utils/tpeValidation.ts` | SCEN | #89 | P3 | W3.1 |
| CBA-A09.3 | CBA-A09 | §12.4 | **FOUND** | `tradeMachine/rules/validateTradeExceptions.ts`; `utils/tpeValidation.ts` | SCEN | #3, #5, #6 | P3 | W3.1 |
| CBA-A09.4 | CBA-A09 | §12.4 | **FOUND** | `tradeMachine/rules/validateTradeExceptions.ts`; `utils/tpeValidation.ts` | SCEN | #4 | P3 | W3.1 |
| CBA-A09.5 | CBA-A09 | §12.5 | **FOUND** | `tradeMachine/rules/validateTradeExceptions.ts`; `utils/tpeValidation.ts` | SCEN | #5 | P3 | W3.1 |
| CBA-A10.1 | CBA-A10 | §8.3 | **FOUND** | `tradeMachine/rules/validateAggregation.ts`; `constants/secondApronMessages.ts` | SCEN | #3, #4 | P3 | W3.1 |
| CBA-A10.2 | CBA-A10 | §12.5 | **PARTIAL** | *`TRADE_TIMING` exists; no two-month/December 16 carve-out located* | SCEN | #50 | P3 | W3.1 |
| CBA-A10.3 | CBA-A10 | §12.8 | **PARTIAL** | *S&T machinery exists; no re-aggregation restriction located* | SCEN | #15 | P3 | W3.1 |
| CBA-A11 | — | §12.4 | **PARTIAL** | `tradeMachine/engine/tradeValidator.teamValidation.ts` | SCEN | #48 | P3 | W3.1 |
| CBA-A12.1 | CBA-A12 | §8.2 | **FOUND** | `tradeMachine/utils/hardCapStatus.ts`; `hardCapUtils.ts` | SCEN | #17 | P3 | W3.2 |
| CBA-A12.2 | CBA-A12 | §8.2 | **FOUND** | `tradeMachine/utils/hardCapStatus.ts`; `hardCapUtils.ts` | SCEN | #16 | P3 | W3.2 |
| CBA-A12.3 | CBA-A12 | §8.2 | **FOUND** | `tradeMachine/utils/hardCapStatus.ts`; `hardCapUtils.ts` | SCEN | #15 | P3 | W3.2 |
| CBA-A12.4 | CBA-A12 | §8.2 | **FOUND** | `tradeMachine/utils/hardCapStatus.ts`; `hardCapUtils.ts` | SCEN | #58 | P3 | W3.2 |
| CBA-A12.5 | CBA-A12 | §8.2 | **FOUND** | `tradeMachine/utils/hardCapStatus.ts`; `hardCapUtils.ts` | SCEN | #2 | P3 | W3.2 |
| CBA-A12.6 | CBA-A12 | §8.2 | **FOUND** | `tradeMachine/utils/hardCapStatus.ts`; `hardCapUtils.ts` | SCEN | #5 | P3 | W3.2 |
| CBA-A12.7 | CBA-A12 | §8.3 | **FOUND** | `tradeMachine/utils/hardCapStatus.ts`; `hardCapUtils.ts` | SCEN | #4 | P3 | W3.2 |
| CBA-A12.8 | CBA-A12 | §8.3 | **FOUND** | `tradeMachine/utils/hardCapStatus.ts`; `hardCapUtils.ts` | SCEN | #58 | P3 | W3.2 |
| CBA-A12.9 | CBA-A12 | §8.3 | **FOUND** | `tradeMachine/utils/hardCapStatus.ts`; `hardCapUtils.ts` | SCEN | #18 | P3 | W3.2 |
| CBA-A12.10 | CBA-A12 | §12.8 | **FOUND** | `tradeMachine/utils/hardCapStatus.ts`; `hardCapUtils.ts` | SCEN | #15 | P3 | W3.2 |
| CBA-A13 | — | §8.2 | **FOUND** | `hardCapUtils.ts`; `hardCapStatus.ts` | SCEN | #15, #16, #17 | P3 | W3.2 |
| CBA-A14.1 | CBA-A14 | §3 | **NO SITE** | candidate host: `hardCapStatus.ts` | SCEN | #19 | P3 | W3.2 |
| CBA-A14.2 | CBA-A14 | §8.4 | **NO SITE** | candidate host: `hardCapStatus.ts` | SCEN | #19 | P3 | W3.2 |
| CBA-A14.3 | CBA-A14 | §8.4 | **NO SITE** | candidate host: `hardCapStatus.ts` | SCEN | #43 | P3 | W3.2 |
| CBA-A14.4 | CBA-A14 | §8.4 | **NO SITE** | candidate host: `hardCapStatus.ts` | SCEN | #59 | P3 | W3.2 |
| CBA-A15.1 | CBA-A15 | §12.2 | **NO SITE** | candidate host: `tradeMachine/engine/tradeValidator.ts` | SCEN | #46 | P6 | W6.1 |
| CBA-A15.2 | CBA-A15 | §12.2 | **NO SITE** | candidate host: `tradeMachine/engine/tradeValidator.ts` | SCEN | #46 | P6 | W6.1 |
| CBA-A15.3 | CBA-A15 | §12.2 | **NO SITE** | candidate host: `tradeMachine/engine/tradeValidator.ts` | SCEN | #46 | P6 | W6.1 |
| CBA-A15.4 | CBA-A15 | §12.2 | **NO SITE** | candidate host: `tradeMachine/engine/tradeValidator.ts` | SCEN | #54 | P6 | W6.1 |
| CBA-A15.5 | CBA-A15 | §12.2 | **NO SITE** | candidate host: `tradeMachine/engine/tradeValidator.ts` | SCEN | #46 | P6 | W6.1 |
| CBA-A16 | — | §9.4 | **FOUND** | `tradeMachine/rules/validateRoster.ts` | SCEN | #36 | P5 | W5.2 |
| CBA-A17.1 | CBA-A17 | §4.2 | **FOUND** | `utils/stepienUtils.ts`; `tradeMachine/rules/validateStepien.ts` | LIFECYCLE | #45 | P6 | W6.1 |
| CBA-A17.2 | CBA-A17 | §13.3 | **FOUND** | `utils/stepienUtils.ts`; `tradeMachine/rules/validateStepien.ts` | SCEN | #45 | P6 | W6.1 |
| CBA-A17.3 | CBA-A17 | §13.3 | **NO SITE** | *no pick protection/deferral exclusivity rule located* | SCEN | #45 | P6 | W6.1 |
| CBA-A17.4 | CBA-A17 | §13.3 | **FOUND** | `utils/stepienUtils.ts`; `tradeMachine/rules/validateStepien.ts` | SCEN | #45 | P6 | W6.1 |
| CBA-A17.5 | CBA-A17 | §13.3 | **FOUND** | `utils/stepienUtils.ts`; `tradeMachine/rules/validateStepien.ts` | SCEN | #45 | P6 | W6.1 |
| CBA-A17.6 | CBA-A17 | §13.3 | **FOUND** | `utils/stepienUtils.ts`; `tradeMachine/rules/validateStepien.ts` | SCEN | #45 | P6 | W6.1 |
| CBA-A17.7 | CBA-A17 | §13.3 | **NO SITE** | *no conveyance-horizon condition located* | SCEN | #55 | P6 | W6.1 |
| CBA-A18.1 | CBA-A18 | §4.1 | **FOUND** | `tradeMachine/rules/validateCash.ts`; `constants/cbaConstants.ts` | SCEN | #53 | P6 | W6.1 |
| CBA-A18.2 | CBA-A18 | §8.3 | **FOUND** | `tradeMachine/rules/validateCash.ts`; `constants/cbaConstants.ts` | SCEN | #53 | P6 | W6.1 |
| CBA-A18.3 | CBA-A18 | §12.8 | **FOUND** | `tradeMachine/rules/validateCash.ts`; `constants/cbaConstants.ts` | SCEN | #53 | P6 | W6.1 |
| CBA-A18.4 | CBA-A18 | §12.12 | **FOUND** | `tradeMachine/rules/validateCash.ts`; `constants/cbaConstants.ts` | SCEN | #53 | P6 | W6.1 |
| CBA-A18.5 | CBA-A18 | §12.12 | **FOUND** | `tradeMachine/rules/validateCash.ts`; `constants/cbaConstants.ts` | SCEN | #53 | P6 | W6.1 |
| CBA-A18.6 | CBA-A18 | §12.12 | **FOUND** | `tradeMachine/rules/validateCash.ts`; `constants/cbaConstants.ts` | SCEN | #53 | P6 | W6.1 |
| CBA-A18.7 | CBA-A18 | §12.12 | **NO SITE** | *zero `conditionalCash` symbols* | SCEN | #53 | P6 | W6.1 |
| CBA-A18.8 | CBA-A18 | §12.12 | **FOUND** | `tradeMachine/rules/validateCash.ts`; `constants/cbaConstants.ts` | SCEN | #53 | P6 | W6.1 |
| CBA-A19.1 | CBA-A19 | §12.8 | **FOUND** | `tradeMachine/signAndTrade/signAndTradeEligibility.ts`; `rules/validateSignAndTrade.ts` | SCEN | #51 | P3 | W3.2 |
| CBA-A19.2 | CBA-A19 | §12.8 | **FOUND** | `tradeMachine/signAndTrade/signAndTradeEligibility.ts`; `rules/validateSignAndTrade.ts` | SCEN | #51 | P3 | W3.2 |
| CBA-A19.3 | CBA-A19 | §12.8 | **FOUND** | `tradeMachine/signAndTrade/signAndTradeEligibility.ts`; `rules/validateSignAndTrade.ts` | SCEN | #51 | P3 | W3.2 |
| CBA-A19.4 | CBA-A19 | §12.8 | **FOUND** | `tradeMachine/signAndTrade/signAndTradeEligibility.ts`; `rules/validateSignAndTrade.ts` | SCEN | #51 | P3 | W3.2 |
| CBA-A19.5 | CBA-A19 | §12.8 | **FOUND** | `tradeMachine/signAndTrade/signAndTradeEligibility.ts`; `rules/validateSignAndTrade.ts` | SCEN | #51 | P3 | W3.2 |
| CBA-A20.1 | CBA-A20 | §10.4 | **PARTIAL** | `types/ruleContext.ts` / `buildRuleContext.helpers.ts` (`isExtendAndTrade` flag only) | SCEN | #52 | P3 | W3.2 |
| CBA-A20.2 | CBA-A20 | §12.9 | **PARTIAL** | `types/ruleContext.ts` / `buildRuleContext.helpers.ts` (`isExtendAndTrade` flag only) | SCEN | #52 | P3 | W3.2 |
| CBA-A20.3 | CBA-A20 | §12.9 | **PARTIAL** | `types/ruleContext.ts` / `buildRuleContext.helpers.ts` (`isExtendAndTrade` flag only) | SCEN | #52 | P3 | W3.2 |
| CBA-A20.4 | CBA-A20 | §12.9 | **PARTIAL** | `types/ruleContext.ts` / `buildRuleContext.helpers.ts` (`isExtendAndTrade` flag only) | SCEN | #52 | P3 | W3.2 |
| CBA-A20.5 | CBA-A20 | §12.9 | **PARTIAL** | `types/ruleContext.ts` / `buildRuleContext.helpers.ts` (`isExtendAndTrade` flag only) | SCEN | #41 | P3 | W3.2 |
| CBA-A21 | — | §12.6 | **NO SITE** | no obvious implementation site | SCEN | #10 | P3 | W3.2 |
| CBA-C01.1 | CBA-C01 | §6.1 | **FOUND** | `utils/capHolds.ts`; `freeAgentRights.ts` | SCEN | #24, #26, #27, #28 | P4 | W4.1 |
| CBA-C01.2 | CBA-C01 | §6.2 | **FOUND** | `utils/capHolds.ts`; `freeAgentRights.ts` | SCEN | #24 | P4 | W4.1 |
| CBA-C01.3 | CBA-C01 | §6.2 | **FOUND** | `utils/capHolds.ts`; `freeAgentRights.ts` | SCEN | #24 | P4 | W4.1 |
| CBA-C01.4 | CBA-C01 | §6.2 | **FOUND** | `utils/capHolds.ts`; `freeAgentRights.ts` | SCEN | #24 | P4 | W4.1 |
| CBA-C01.5 | CBA-C01 | §6.2 | **FOUND** | `utils/capHolds.ts`; `freeAgentRights.ts` | SCEN | #25 | P4 | W4.1 |
| CBA-C01.6 | CBA-C01 | §6.3 | **NO SITE** | *zero `unrenounce` symbols* | SCEN | #63 | P4 | W4.1 |
| CBA-C02.1 | CBA-C02 | §6.2 | **FOUND** | `utils/capHolds.ts`; `data/rookieScale.ts` | SCEN | #26 | P4 | W4.1 |
| CBA-C02.2 | CBA-C02 | §13.1 | **FOUND** | `utils/capHolds.ts`; `data/rookieScale.ts` | SCEN | #26 | P4 | W4.1 |
| CBA-C03.1 | CBA-C03 | §6.2 | **FOUND** | `capTotals/computeTeamCapTotals.ts` (`incompleteRosterCharge`) | SCEN | #27 | P4 | W4.1 |
| CBA-C03.2 | CBA-C03 | §6.2 | **FOUND** | `capTotals/computeTeamCapTotals.ts` (`incompleteRosterCharge`) | SCEN | #27 | P4 | W4.1 |
| CBA-C04.1 | CBA-C04 | §6.2 | **PARTIAL** | `exceptions/exceptionLifecycle.ts` | SCEN | #28 | P4 | W4.1 |
| CBA-C04.2 | CBA-C04 | §7.1 | **PARTIAL** | `exceptions/exceptionLifecycle.ts` | SCEN | #28 | P4 | W4.1 |
| CBA-C05.1 | CBA-C05 | §3 | **NO SITE** | no obvious implementation site | SCEN | #33 | P1 | W1.2 |
| CBA-C05.2 | CBA-C05 | §6.4 | **NO SITE** | no obvious implementation site | SCEN | #33 | P1 | W1.2 |
| CBA-C05.3 | CBA-C05 | §6.4 | **NO SITE** | no obvious implementation site | SCEN | #75 | P1 | W1.2 |
| CBA-C05.4 | CBA-C05 | §6.4 | **NO SITE** | no obvious implementation site | SCEN | #33 | P1 | W1.2 |
| CBA-C05.5 | CBA-C05 | §6.4 | **NO SITE** | no obvious implementation site | SCEN | #75 | P1 | W1.2 |
| CBA-C06 | — | §5.9 | **NO SITE** | candidate host: `mutationPipeline.helpers.ts` | SCEN | #22 | P1 | W1.2 |
| CBA-C07.1 | CBA-C07 | §8.1 | **NO SITE** | no `apronSalary` derivation exists | SCEN | #57 | P1 | W1.2 |
| CBA-C07.2 | CBA-C07 | §8.1 | **NO SITE** | no `apronSalary` derivation exists | SCEN | #57 | P1 | W1.2 |
| CBA-C07.3 | CBA-C07 | §8.1 | **NO SITE** | no `apronSalary` derivation exists | EXTS | #57 | P1 | W1.2 |
| CBA-C07.4 | CBA-C07 | §8.1 | **NO SITE** | no `apronSalary` derivation exists | SCEN | #57 | P1 | W1.2 |
| CBA-C07.5 | CBA-C07 | §8.1 | **NO SITE** | no `apronSalary` derivation exists | SCEN | #57 | P1 | W1.2 |
| CBA-C07.6 | CBA-C07 | §8.1 | **NO SITE** | no `apronSalary` derivation exists | SCEN | #57 | P1 | W1.2 |
| CBA-C07.7 | CBA-C07 | §8.1 | **NO SITE** | no `apronSalary` derivation exists | SCEN | #57 | P1 | W1.2 |
| CBA-C07.8 | CBA-C07 | §8.1 | **NO SITE** | no `apronSalary` derivation exists | SCEN | #57 | P1 | W1.2 |
| CBA-C07.9 | CBA-C07 | §8.1 | **NO SITE** | no `apronSalary` derivation exists | SCEN | #57 | P1 | W1.2 |
| CBA-C07.10 | CBA-C07 | §8.1 | **NO SITE** | no `apronSalary` derivation exists | SCEN | #2 | P1 | W1.2 |
| CBA-C08.1 | CBA-C08 | §5.9 | **PARTIAL** | schema `taxablePayroll` / `taxBill` / `taxRate` | SCEN | #22 | P1 | W1.2 |
| CBA-C08.2 | CBA-C08 | §8.6 | **PARTIAL** | schema `taxablePayroll` / `taxBill` / `taxRate` | LIFECYCLE | — | P1 | W1.2 |
| CBA-C08.3 | CBA-C08 | §8.6 | **PARTIAL** | schema `taxablePayroll` / `taxBill` / `taxRate` | SCEN | #22 | P1 | W1.2 |
| CBA-C08.4 | CBA-C08 | §8.6 | **PARTIAL** | schema `taxablePayroll` / `taxBill` / `taxRate` | SCEN | #22 | P1 | W1.2 |
| CBA-C08.5 | CBA-C08 | §8.6 | **PARTIAL** | schema `taxablePayroll` / `taxBill` / `taxRate` | SCEN | #21 | P1 | W1.2 |
| CBA-C09.1 | CBA-C09 | §8.6 | **NO SITE** | no `taxBracket` symbol | SCEN | #23 | P1 | W1.2 |
| CBA-C09.2 | CBA-C09 | §8.6 | **NO SITE** | no `taxBracket` symbol | SCEN | #23 | P1 | W1.2 |
| CBA-C10.1 | CBA-C10 | §6.1 | **PARTIAL** | `types/ruleContext.ts`; `seasonManager.helpers.ts` | SCEN | #60 | P1 | W1.2 |
| CBA-C10.2 | CBA-C10 | §8.7 | **PARTIAL** | `types/ruleContext.ts`; `seasonManager.helpers.ts` | SCEN | #60 | P1 | W1.2 |
| CBA-C10.3 | CBA-C10 | §8.7 | **PARTIAL** | `types/ruleContext.ts`; `seasonManager.helpers.ts` | SCEN | #60 | P1 | W1.2 |
| CBA-C10.4 | CBA-C10 | §8.7 | **PARTIAL** | `types/ruleContext.ts`; `seasonManager.helpers.ts` | SCEN | #60 | P1 | W1.2 |
| CBA-C10.5 | CBA-C10 | §8.7 | **PARTIAL** | `types/ruleContext.ts`; `seasonManager.helpers.ts` | SCEN | #60 | P1 | W1.2 |
| CBA-C11.1 | CBA-C11 | §3 | **PARTIAL** | `mutationPipeline.types.record.ts` (dpe slot key) | SCEN | #76 | P4 | W4.1 |
| CBA-C11.2 | CBA-C11 | §4.2 | **PARTIAL** | `mutationPipeline.types.record.ts` (dpe slot key) | EXTS | #29 | P4 | W4.1 |
| CBA-C11.3 | CBA-C11 | §6.5 | **PARTIAL** | `mutationPipeline.types.record.ts` (dpe slot key) | SCEN | #30 | P4 | W4.1 |
| CBA-C11.4 | CBA-C11 | §6.5 | **PARTIAL** | `mutationPipeline.types.record.ts` (dpe slot key) | EXTS | #30 | P4 | W4.1 |
| CBA-C11.5 | CBA-C11 | §6.5 | **PARTIAL** | `mutationPipeline.types.record.ts` (dpe slot key) | SCEN | #76 | P4 | W4.1 |
| CBA-C11.6 | CBA-C11 | §6.5 | **PARTIAL** | `mutationPipeline.types.record.ts` (dpe slot key) | SCEN | #76 | P4 | W4.1 |
| CBA-C11.7 | CBA-C11 | §6.5 | **PARTIAL** | `mutationPipeline.types.record.ts` (dpe slot key) | SCEN | #76 | P4 | W4.1 |
| CBA-C11.8 | CBA-C11 | §6.5 | **PARTIAL** | `mutationPipeline.types.record.ts` (dpe slot key) | SCEN | #76 | P4 | W4.1 |
| CBA-C11.9 | CBA-C11 | §12.5 | **PARTIAL** | `mutationPipeline.types.record.ts` (dpe slot key) | SCEN | #29 | P4 | W4.1 |
| CBA-C12.1 | CBA-C12 | §3 | **NO SITE** | no medical-state model located | SCEN | #29 | P4 | W4.1 |
| CBA-C12.2 | CBA-C12 | §7.3 | **NO SITE** | no medical-state model located | EXTS | #29 | P4 | W4.1 |
| CBA-C13.1 | CBA-C13 | §4.1 | **FOUND** | `exceptions/exceptionLifecycle.ts`; `faExceptionUtils.ts` | SCEN | #62 | P4 | W4.1 |
| CBA-C13.2 | CBA-C13 | §4.4 | **FOUND** | `exceptions/exceptionLifecycle.ts`; `faExceptionUtils.ts` | LIFECYCLE | #6, #28 | P4 | W4.1 |
| CBA-C13.3 | CBA-C13 | §7.1 | **FOUND** | `exceptions/exceptionLifecycle.ts`; `faExceptionUtils.ts` | SCEN | #62 | P4 | W4.1 |
| CBA-C13.4 | CBA-C13 | §7.1 | **FOUND** | `exceptions/exceptionLifecycle.ts`; `faExceptionUtils.ts` | SCEN | #62 | P4 | W4.1 |
| CBA-C13.5 | CBA-C13 | §7.1 | **FOUND** | `exceptions/exceptionLifecycle.ts`; `faExceptionUtils.ts` | SCEN | #62 | P4 | W4.1 |
| CBA-C13.6 | CBA-C13 | §7.1 | **FOUND** | `exceptions/exceptionLifecycle.ts`; `faExceptionUtils.ts` | SCEN | #62 | P4 | W4.1 |
| CBA-C13.7 | CBA-C13 | §7.3 | **FOUND** | `exceptions/exceptionLifecycle.ts`; `faExceptionUtils.ts` | SCEN | #16 | P4 | W4.1 |
| CBA-C13.8 | CBA-C13 | §7.3 | **FOUND** | `exceptions/exceptionLifecycle.ts`; `faExceptionUtils.ts` | SCEN | #18 | P4 | W4.1 |
| CBA-C13.9 | CBA-C13 | §7.3 | **FOUND** | `exceptions/exceptionLifecycle.ts`; `faExceptionUtils.ts` | SCEN | #28 | P4 | W4.1 |
| CBA-C13.10 | CBA-C13 | §7.3 | **FOUND** | `exceptions/exceptionLifecycle.ts`; `faExceptionUtils.ts` | SCEN | #17 | P4 | W4.1 |
| CBA-C13.11 | CBA-C13 | §7.3 | **NO SITE** | *zero `secondRoundPickException` / `SECOND_ROUND_PICK` symbols* | SCEN | #62 | P4 | W4.1 |
| CBA-C13.12 | CBA-C13 | §7.3 | **NO SITE** | *zero `secondRoundPickException` symbols; no Apron add-back exists* | SCEN | #62 | P4 | W4.1 |
| CBA-C13.13 | CBA-C13 | §7.3 | **FOUND** | `exceptions/exceptionLifecycle.ts`; `faExceptionUtils.ts` | SCEN | #26 | P4 | W4.1 |
| CBA-C13.14 | CBA-C13 | §10.1 | **FOUND** | `exceptions/exceptionLifecycle.ts`; `faExceptionUtils.ts` | SCEN | #62 | P4 | W4.1 |
| CBA-C13.15 | CBA-C13 | §13.2 | **PARTIAL** | *two-way and minimum paths exist; SRPE path has no site* | SCEN | #62 | P4 | W4.1 |
| CBA-C14.1 | CBA-C14 | §4.2 | **FOUND** | `freeAgentRights.ts`; `playerRulesProfile/birdRightsRules.ts` | LIFECYCLE | #40 | P4 | W4.2 |
| CBA-C14.2 | CBA-C14 | §6.3 | **FOUND** | `freeAgentRights.ts`; `playerRulesProfile/birdRightsRules.ts` | SCEN | #28 | P4 | W4.2 |
| CBA-C14.3 | CBA-C14 | §6.3 | **PARTIAL** | *renunciation machinery exists; no Early-Bird-to-Non-Bird downgrade* | SCEN | #63 | P4 | W4.2 |
| CBA-C14.4 | CBA-C14 | §7.2 | **FOUND** | `freeAgentRights.ts`; `playerRulesProfile/birdRightsRules.ts` | SCEN | #24 | P4 | W4.2 |
| CBA-C14.5 | CBA-C14 | §7.2 | **FOUND** | `freeAgentRights.ts`; `playerRulesProfile/birdRightsRules.ts` | SCEN | #63 | P4 | W4.2 |
| CBA-C14.6 | CBA-C14 | §7.2 | **FOUND** | `freeAgentRights.ts`; `playerRulesProfile/birdRightsRules.ts` | SCEN | #63 | P4 | W4.2 |
| CBA-C14.7 | CBA-C14 | §7.2 | **FOUND** | `freeAgentRights.ts`; `playerRulesProfile/birdRightsRules.ts` | SCEN | #63 | P4 | W4.2 |
| CBA-C14.8 | CBA-C14 | §7.2 | **FOUND** | `freeAgentRights.ts`; `playerRulesProfile/birdRightsRules.ts` | SCEN | #40 | P4 | W4.2 |
| CBA-C14.9 | CBA-C14 | §12.10 | **FOUND** | `freeAgentRights.ts`; `playerRulesProfile/birdRightsRules.ts` | SCEN | #40 | P4 | W4.2 |
| CBA-C15.1 | CBA-C15 | §10.3 | **NO SITE** | zero `arenas` references | SCEN | #64 | P4 | W4.2 |
| CBA-C15.2 | CBA-C15 | §10.3 | **NO SITE** | zero `arenas` references | SCEN | #64 | P4 | W4.2 |
| CBA-C16.1 | CBA-C16 | §5.4 | **FOUND** | `playerRulesProfile/maxSalaryRules.ts`; `extensionRules.ts` | SCEN | #26 | P4 | W4.3 |
| CBA-C16.2 | CBA-C16 | §5.4 | **FOUND** | `playerRulesProfile/maxSalaryRules.ts`; `extensionRules.ts` | SCEN | #26 | P4 | W4.3 |
| CBA-C16.3 | CBA-C16 | §5.4 | **FOUND** | `playerRulesProfile/maxSalaryRules.ts`; `extensionRules.ts` | SCEN | #65 | P4 | W4.3 |
| CBA-C16.4 | CBA-C16 | §5.4 | **FOUND** | `playerRulesProfile/maxSalaryRules.ts`; `extensionRules.ts` | SCEN | #65 | P4 | W4.3 |
| CBA-C16.5 | CBA-C16 | §5.5 | **FOUND** | `playerRulesProfile/maxSalaryRules.ts`; `extensionRules.ts` | SCEN | #65 | P4 | W4.3 |
| CBA-C16.6 | CBA-C16 | §5.7 | **FOUND** | `playerRulesProfile/maxSalaryRules.ts`; `extensionRules.ts` | SCEN | #65 | P4 | W4.3 |
| CBA-C16.7 | CBA-C16 | §5.7 | **FOUND** | `playerRulesProfile/maxSalaryRules.ts`; `extensionRules.ts` | SCEN | #65 | P4 | W4.3 |
| CBA-C16.8 | CBA-C16 | §10.4 | **FOUND** | `playerRulesProfile/maxSalaryRules.ts`; `extensionRules.ts` | SCEN | #65 | P4 | W4.3 |
| CBA-C16.9 | CBA-C16 | §10.4 | **FOUND** | `playerRulesProfile/maxSalaryRules.ts`; `extensionRules.ts` | SCEN | #65 | P4 | W4.3 |
| CBA-C16.10 | CBA-C16 | §10.4 | **FOUND** | `playerRulesProfile/maxSalaryRules.ts`; `extensionRules.ts` | SCEN | #65 | P4 | W4.3 |
| CBA-C16.11 | CBA-C16 | §10.4 | **FOUND** | `playerRulesProfile/maxSalaryRules.ts`; `extensionRules.ts` | SCEN | #65 | P4 | W4.3 |
| CBA-C16.12 | CBA-C16 | §10.4 | **FOUND** | `playerRulesProfile/maxSalaryRules.ts`; `extensionRules.ts` | SCEN | #65 | P4 | W4.3 |
| CBA-C16.13 | CBA-C16 | §10.4 | **FOUND** | `playerRulesProfile/maxSalaryRules.ts`; `extensionRules.ts` | SCEN | #41 | P4 | W4.3 |
| CBA-C16.14 | CBA-C16 | §10.4 | **FOUND** | `playerRulesProfile/maxSalaryRules.ts`; `extensionRules.ts` | SCEN | #65 | P4 | W4.3 |
| CBA-C17.1 | CBA-C17 | §5.8 | **NO SITE** | zero `over38` references | SCEN | #44 | P4 | W4.3 |
| CBA-C17.2 | CBA-C17 | §5.8 | **NO SITE** | zero `over38` references | SCEN | #66 | P4 | W4.3 |
| CBA-C17.3 | CBA-C17 | §5.8 | **NO SITE** | zero `over38` references | SCEN | #44 | P4 | W4.3 |
| CBA-C17.4 | CBA-C17 | §5.8 | **NO SITE** | zero `over38` references | SCEN | #44 | P4 | W4.3 |
| CBA-C17.5 | CBA-C17 | §5.8 | **NO SITE** | zero `over38` references | SCEN | #44 | P4 | W4.3 |
| CBA-C17.6 | CBA-C17 | §5.8 | **NO SITE** | zero `over38` references | SCEN | #44 | P4 | W4.3 |
| CBA-C17.7 | CBA-C17 | §5.8 | **NO SITE** | zero `over38` references | SCEN | #66 | P4 | W4.3 |
| CBA-C18 | — | §5.9 | **NO SITE** | zero `signingBonus` references | SCEN | #67 | P4 | W4.3 |
| CBA-C19.1 | CBA-C19 | §5.1 | **PARTIAL** | `mutationPipeline.compute.signings.signing.ts` (`TEN_DAY` type only) | SCEN | #71 | P4 | W4.4 |
| CBA-C19.2 | CBA-C19 | §5.1 | **PARTIAL** | `mutationPipeline.compute.signings.signing.ts` (`TEN_DAY` type only) | SCEN | #71 | P4 | W4.4 |
| CBA-C19.3 | CBA-C19 | §5.1 | **PARTIAL** | `mutationPipeline.compute.signings.signing.ts` (`TEN_DAY` type only) | SCEN | #71 | P4 | W4.4 |
| CBA-C19.4 | CBA-C19 | §5.1 | **PARTIAL** | `mutationPipeline.compute.signings.signing.ts` (`TEN_DAY` type only) | SCEN | #71 | P4 | W4.4 |
| CBA-C19.5 | CBA-C19 | §5.1 | **PARTIAL** | `mutationPipeline.compute.signings.signing.ts` (`TEN_DAY` type only) | SCEN | #71 | P4 | W4.4 |
| CBA-C19.6 | CBA-C19 | §14 | **PARTIAL** | `mutationPipeline.compute.signings.signing.ts` (`TEN_DAY` type only) | SCEN | #71 | P4 | W4.4 |
| CBA-C20.1 | CBA-C20 | §5.2 | **PARTIAL** | two-way modelled as a count; zero conversion symbols | SCEN | #38 | P4 | W4.4 |
| CBA-C20.2 | CBA-C20 | §5.2 | **PARTIAL** | two-way modelled as a count; zero conversion symbols | SCEN | #72 | P4 | W4.4 |
| CBA-C20.3 | CBA-C20 | §5.2 | **PARTIAL** | two-way modelled as a count; zero conversion symbols | SCEN | #72 | P4 | W4.4 |
| CBA-C20.4 | CBA-C20 | §5.2 | **PARTIAL** | two-way modelled as a count; zero conversion symbols | SCEN | #72 | P4 | W4.4 |
| CBA-C20.5 | CBA-C20 | §5.2 | **PARTIAL** | two-way modelled as a count; zero conversion symbols | SCEN | #72 | P4 | W4.4 |
| CBA-C20.6 | CBA-C20 | §5.2 | **PARTIAL** | two-way modelled as a count; zero conversion symbols | SCEN | #72 | P4 | W4.4 |
| CBA-C20.7 | CBA-C20 | §5.2 | **PARTIAL** | two-way modelled as a count; zero conversion symbols | SCEN | #72 | P4 | W4.4 |
| CBA-C20.8 | CBA-C20 | §13.2 | **PARTIAL** | two-way modelled as a count; zero conversion symbols | SCEN | #72 | P4 | W4.4 |
| CBA-C20.9 | CBA-C20 | §14 | **PARTIAL** | two-way modelled as a count; zero conversion symbols | SCEN | #72 | P4 | W4.4 |
| CBA-C21.1 | CBA-C21 | §3 | **NO SITE** | zero `exhibit10` / `exhibit9` references | SCEN | #73 | P4 | W4.4 |
| CBA-C21.2 | CBA-C21 | §5.3 | **NO SITE** | zero `exhibit10` / `exhibit9` references | SCEN | #73 | P4 | W4.4 |
| CBA-C21.3 | CBA-C21 | §5.3 | **NO SITE** | zero `exhibit10` / `exhibit9` references | SCEN | #73 | P4 | W4.4 |
| CBA-C21.4 | CBA-C21 | §5.3 | **NO SITE** | zero `exhibit10` / `exhibit9` references | SCEN | #73 | P4 | W4.4 |
| CBA-C21.5 | CBA-C21 | §5.3 | **NO SITE** | zero `exhibit10` / `exhibit9` references | SCEN | #73 | P4 | W4.4 |
| CBA-C21.6 | CBA-C21 | §5.3 | **NO SITE** | zero `exhibit10` / `exhibit9` references | SCEN | #73 | P4 | W4.4 |
| CBA-C21.7 | CBA-C21 | §5.3 | **NO SITE** | zero `exhibit10` / `exhibit9` references | SCEN | #73 | P4 | W4.4 |
| CBA-C21.8 | CBA-C21 | §5.3 | **NO SITE** | zero `exhibit10` / `exhibit9` references | SCEN | #73 | P4 | W4.4 |
| CBA-C21.9 | CBA-C21 | §5.3 | **NO SITE** | zero `exhibit10` / `exhibit9` references | SCEN | #73 | P4 | W4.4 |
| CBA-C21.10 | CBA-C21 | §5.3 | **NO SITE** | zero `exhibit10` / `exhibit9` references | SCEN | #73 | P4 | W4.4 |
| CBA-C21.11 | CBA-C21 | §5.3 | **NO SITE** | zero `exhibit10` / `exhibit9` references | SCEN | #73 | P4 | W4.4 |
| CBA-C22.1 | CBA-C22 | §5.6 | **PARTIAL** | `capLegalityValidation.ts` (`EXTENSION_MAX_RAISE_PERCENT`, `OFFER_SHEET_MAX_RAISE_PCT`) | SCEN | #70 | P4 | W4.4 |
| CBA-C22.2 | CBA-C22 | §5.7 | **PARTIAL** | `capLegalityValidation.ts` (`EXTENSION_MAX_RAISE_PERCENT`, `OFFER_SHEET_MAX_RAISE_PCT`) | SCEN | #70 | P4 | W4.4 |
| CBA-C22.3 | CBA-C22 | §5.7 | **PARTIAL** | `capLegalityValidation.ts` (`EXTENSION_MAX_RAISE_PERCENT`, `OFFER_SHEET_MAX_RAISE_PCT`) | SCEN | #70 | P4 | W4.4 |
| CBA-C22.4 | CBA-C22 | §5.7 | **PARTIAL** | `capLegalityValidation.ts` (`EXTENSION_MAX_RAISE_PERCENT`, `OFFER_SHEET_MAX_RAISE_PCT`) | SCEN | #70 | P4 | W4.4 |
| CBA-C23.1 | CBA-C23 | §3 | **NO SITE** | zero `eippa` / `signingBonus` / incentive-limit references | SCEN | #68 | P4 | W4.4 |
| CBA-C23.2 | CBA-C23 | §5.9 | **NO SITE** | zero `eippa` / `signingBonus` / incentive-limit references | SCEN | #68 | P4 | W4.4 |
| CBA-C23.3 | CBA-C23 | §5.9 | **NO SITE** | zero `eippa` / `signingBonus` / incentive-limit references | SCEN | #68 | P4 | W4.4 |
| CBA-C23.4 | CBA-C23 | §5.9 | **NO SITE** | zero `eippa` / `signingBonus` / incentive-limit references | SCEN | #68 | P4 | W4.4 |
| CBA-C23.5 | CBA-C23 | §5.9 | **NO SITE** | zero `eippa` / `signingBonus` / incentive-limit references | SCEN | #68 | P4 | W4.4 |
| CBA-C23.6 | CBA-C23 | §5.9 | **NO SITE** | zero `eippa` / `signingBonus` / incentive-limit references | SCEN | #68 | P4 | W4.4 |
| CBA-C24.1 | CBA-C24 | §3 | **PARTIAL** | `offseason/resolveOffseasonTransition.optionDecisions.ts` (decisions only) | SCEN | #69 | P4 | W4.3 |
| CBA-C24.2 | CBA-C24 | §5.5 | **PARTIAL** | `offseason/resolveOffseasonTransition.optionDecisions.ts` (decisions only) | SCEN | #69 | P4 | W4.3 |
| CBA-C24.3 | CBA-C24 | §5.5 | **NO SITE** | *zero option-deadline symbols (`JUNE_29` / `optionDeadline`)* | SCEN | #43 | P4 | W4.3 |
| CBA-C24.4 | CBA-C24 | §5.5 | **NO SITE** | *no prior-to-June-25 RFA option comparison located* | SCEN | #69 | P4 | W4.3 |
| CBA-C24.5 | CBA-C24 | §5.5 | **PARTIAL** | `offseason/resolveOffseasonTransition.optionDecisions.ts` (decisions only) | SCEN | #69 | P4 | W4.3 |
| CBA-C24.6 | CBA-C24 | §5.5 | **PARTIAL** | `offseason/resolveOffseasonTransition.optionDecisions.ts` (decisions only) | SCEN | #69 | P4 | W4.3 |
| CBA-C24.7 | CBA-C24 | §5.6 | **PARTIAL** | `offseason/resolveOffseasonTransition.optionDecisions.ts` (decisions only) | SCEN | #69 | P4 | W4.3 |
| CBA-C25.1 | CBA-C25 | §6.1 | **NO SITE** | zero `grievance` / `retiredUnderContract` / `pendingContract` references | SCEN | #74 | P1 | W1.2 |
| CBA-C25.2 | CBA-C25 | §6.1 | **NO SITE** | zero `grievance` / `retiredUnderContract` / `pendingContract` references | SCEN | #74 | P1 | W1.2 |
| CBA-C25.3 | CBA-C25 | §6.1 | **NO SITE** | zero `grievance` / `retiredUnderContract` / `pendingContract` references | EXTS | #74 | P1 | W1.2 |
| CBA-L01.1 | CBA-L01 | §4.4 | **FOUND** | `buildRuleContext.ts`; `seasonUtils.ts`; `timingUtils.ts` | LIFECYCLE | #83 | P1 | W1.1 |
| CBA-L01.2 | CBA-L01 | §4.4 | **FOUND** | `buildRuleContext.ts`; `seasonUtils.ts`; `timingUtils.ts` | LIFECYCLE | #7 | P1 | W1.1 |
| CBA-L01.3 | CBA-L01 | §10.1 | **FOUND** | `buildRuleContext.ts`; `seasonUtils.ts`; `timingUtils.ts` | SCEN | #41 | P1 | W1.1 |
| CBA-L01.4 | CBA-L01 | §14 | **FOUND** | `buildRuleContext.ts`; `seasonUtils.ts`; `timingUtils.ts` | SCEN | #83 | P1 | W1.1 |
| CBA-L01.5 | CBA-L01 | §14 | **FOUND** | `buildRuleContext.ts`; `seasonUtils.ts`; `timingUtils.ts` | SCEN | #83 | P1 | W1.1 |
| CBA-L02.1 | CBA-L02 | §4.4 | **PARTIAL** | `offseason/...optionDecisions.ts`; `extensionRules.eligibility.ts` | LIFECYCLE | #43 | P4 | W4.3 |
| CBA-L02.2 | CBA-L02 | §4.4 | **PARTIAL** | `offseason/...optionDecisions.ts`; `extensionRules.eligibility.ts` | LIFECYCLE | #8 | P4 | W4.3 |
| CBA-L02.3 | CBA-L02 | §5.6 | **PARTIAL** | `offseason/...optionDecisions.ts`; `extensionRules.eligibility.ts` | SCEN | #31 | P4 | W4.3 |
| CBA-L02.4 | CBA-L02 | §5.6 | **PARTIAL** | `offseason/...optionDecisions.ts`; `extensionRules.eligibility.ts` | SCEN | #8 | P4 | W4.3 |
| CBA-L02.5 | CBA-L02 | §10.5 | **PARTIAL** | `offseason/...optionDecisions.ts`; `extensionRules.eligibility.ts` | SCEN | #85 | P4 | W4.3 |
| CBA-L02.6 | CBA-L02 | §10.5 | **PARTIAL** | `offseason/...optionDecisions.ts`; `extensionRules.eligibility.ts` | SCEN | #85 | P4 | W4.3 |
| CBA-L02.7 | CBA-L02 | §10.5 | **PARTIAL** | `offseason/...optionDecisions.ts`; `extensionRules.eligibility.ts` | SCEN | #85 | P4 | W4.3 |
| CBA-L02.8 | CBA-L02 | §10.5 | **PARTIAL** | `offseason/...optionDecisions.ts`; `extensionRules.eligibility.ts` | SCEN | #85 | P4 | W4.3 |
| CBA-L03.1 | CBA-L03 | §4.2 | **FOUND** | `timingUtils.ts`; `tradeTimingWindows.ts`; `consentUtils.ts` | LIFECYCLE | #40 | P7 | W7.1 |
| CBA-L03.2 | CBA-L03 | §4.2 | **FOUND** | `timingUtils.ts`; `tradeTimingWindows.ts`; `consentUtils.ts` | LIFECYCLE | #41 | P7 | W7.1 |
| CBA-L03.3 | CBA-L03 | §4.4 | **FOUND** | `timingUtils.ts`; `tradeTimingWindows.ts`; `consentUtils.ts` | EXTS | #86 | P7 | W7.1 |
| CBA-L03.4 | CBA-L03 | §5.4 | **FOUND** | `timingUtils.ts`; `tradeTimingWindows.ts`; `consentUtils.ts` | SCEN | #41 | P7 | W7.1 |
| CBA-L03.5 | CBA-L03 | §10.3 | **FOUND** | `timingUtils.ts`; `tradeTimingWindows.ts`; `consentUtils.ts` | SCEN | #42 | P7 | W7.1 |
| CBA-L03.6 | CBA-L03 | §10.4 | **FOUND** | `timingUtils.ts`; `tradeTimingWindows.ts`; `consentUtils.ts` | SCEN | #41 | P7 | W7.1 |
| CBA-L03.7 | CBA-L03 | §10.5 | **FOUND** | `timingUtils.ts`; `tradeTimingWindows.ts`; `consentUtils.ts` | SCEN | #41 | P7 | W7.1 |
| CBA-L03.8 | CBA-L03 | §12.10 | **PARTIAL** | *`noTradeClause` field exists; no 8-YOS/4-YOS eligibility test* | SCEN | #86 | P7 | W7.1 |
| CBA-L03.9 | CBA-L03 | §12.10 | **FOUND** | `timingUtils.ts`; `tradeTimingWindows.ts`; `consentUtils.ts` | SCEN | #42 | P7 | W7.1 |
| CBA-L03.10 | CBA-L03 | §12.11 | **FOUND** | `timingUtils.ts`; `tradeTimingWindows.ts`; `consentUtils.ts` | SCEN | #41 | P7 | W7.1 |
| CBA-L03.11 | CBA-L03 | §12.11 | **FOUND** | `timingUtils.ts`; `tradeTimingWindows.ts`; `consentUtils.ts` | SCEN | #41 | P7 | W7.1 |
| CBA-L03.12 | CBA-L03 | §12.11 | **FOUND** | `timingUtils.ts`; `tradeTimingWindows.ts`; `consentUtils.ts` | SCEN | #41 | P7 | W7.1 |
| CBA-L03.13 | CBA-L03 | §12.11 | **FOUND** | `timingUtils.ts`; `tradeTimingWindows.ts`; `consentUtils.ts` | SCEN | #86 | P7 | W7.1 |
| CBA-L03.14 | CBA-L03 | §12.11 | **FOUND** | `timingUtils.ts`; `tradeTimingWindows.ts`; `consentUtils.ts` | SCEN | #43 | P7 | W7.1 |
| CBA-L03.15 | CBA-L03 | §12.11 | **FOUND** | `timingUtils.ts`; `tradeTimingWindows.ts`; `consentUtils.ts` | SCEN | #86 | P7 | W7.1 |
| CBA-L04.1 | CBA-L04 | §4.2 | **FOUND** | `playerRulesProfile/rfaRules.ts`; `mutationPipeline.compute.offerSheets.*` | LIFECYCLE | #25 | P4 | W4.2 |
| CBA-L04.2 | CBA-L04 | §4.4 | **FOUND** | `playerRulesProfile/rfaRules.ts`; `mutationPipeline.compute.offerSheets.*` | LIFECYCLE | #25 | P4 | W4.2 |
| CBA-L04.3 | CBA-L04 | §6.1 | **FOUND** | `playerRulesProfile/rfaRules.ts`; `mutationPipeline.compute.offerSheets.*` | SCEN | #25 | P4 | W4.2 |
| CBA-L04.4 | CBA-L04 | §6.3 | **FOUND** | `playerRulesProfile/rfaRules.ts`; `mutationPipeline.compute.offerSheets.*` | SCEN | #84 | P4 | W4.2 |
| CBA-L04.5 | CBA-L04 | §10.1 | **FOUND** | `playerRulesProfile/rfaRules.ts`; `mutationPipeline.compute.offerSheets.*` | SCEN | #84 | P4 | W4.2 |
| CBA-L04.6 | CBA-L04 | §10.2 | **FOUND** | `playerRulesProfile/rfaRules.ts`; `mutationPipeline.compute.offerSheets.*` | SCEN | #84 | P4 | W4.2 |
| CBA-L04.7 | CBA-L04 | §10.2 | **FOUND** | `playerRulesProfile/rfaRules.ts`; `mutationPipeline.compute.offerSheets.*` | SCEN | #25 | P4 | W4.2 |
| CBA-L04.8 | CBA-L04 | §10.2 | **FOUND** | `playerRulesProfile/rfaRules.ts`; `mutationPipeline.compute.offerSheets.*` | SCEN | #84 | P4 | W4.2 |
| CBA-L04.9 | CBA-L04 | §10.2 | **FOUND** | `playerRulesProfile/rfaRules.ts`; `mutationPipeline.compute.offerSheets.*` | SCEN | #84 | P4 | W4.2 |
| CBA-L04.10 | CBA-L04 | §10.2 | **FOUND** | `playerRulesProfile/rfaRules.ts`; `mutationPipeline.compute.offerSheets.*` | SCEN | #84 | P4 | W4.2 |
| CBA-L04.11 | CBA-L04 | §10.2 | **FOUND** | `playerRulesProfile/rfaRules.ts`; `mutationPipeline.compute.offerSheets.*` | SCEN | #84 | P4 | W4.2 |
| CBA-L04.12 | CBA-L04 | §10.2 | **FOUND** | `playerRulesProfile/rfaRules.ts`; `mutationPipeline.compute.offerSheets.*` | SCEN | #84 | P4 | W4.2 |
| CBA-L04.13 | CBA-L04 | §10.2 | **FOUND** | `playerRulesProfile/rfaRules.ts`; `mutationPipeline.compute.offerSheets.*` | SCEN | #84 | P4 | W4.2 |
| CBA-L04.14 | CBA-L04 | §10.2 | **FOUND** | `playerRulesProfile/rfaRules.ts`; `mutationPipeline.compute.offerSheets.*` | SCEN | #84 | P4 | W4.2 |
| CBA-L04.15 | CBA-L04 | §10.3 | **FOUND** | `playerRulesProfile/rfaRules.ts`; `mutationPipeline.compute.offerSheets.*` | SCEN | #84 | P4 | W4.2 |
| CBA-L04.16 | CBA-L04 | §10.3 | **FOUND** | `playerRulesProfile/rfaRules.ts`; `mutationPipeline.compute.offerSheets.*` | SCEN | #84 | P4 | W4.2 |
| CBA-L04.17 | CBA-L04 | §10.3 | **FOUND** | `playerRulesProfile/rfaRules.ts`; `mutationPipeline.compute.offerSheets.*` | SCEN | #84 | P4 | W4.2 |
| CBA-L05.1 | CBA-L05 | §4.2 | **PARTIAL** | `draftPickUtils.ts`; `entitlements/` | LIFECYCLE | #26 | P6 | W6.1 |
| CBA-L05.2 | CBA-L05 | §4.4 | **PARTIAL** | `draftPickUtils.ts`; `entitlements/` | LIFECYCLE | #26 | P6 | W6.1 |
| CBA-L05.3 | CBA-L05 | §13.1 | **PARTIAL** | `draftPickUtils.ts`; `entitlements/` | SCEN | #26 | P6 | W6.1 |
| CBA-L05.4 | CBA-L05 | §13.1 | **PARTIAL** | `draftPickUtils.ts`; `entitlements/` | SCEN | #87 | P6 | W6.1 |
| CBA-L05.5 | CBA-L05 | §13.1 | **PARTIAL** | `draftPickUtils.ts`; `entitlements/` | SCEN | #87 | P6 | W6.1 |
| CBA-L05.6 | CBA-L05 | §13.1 | **PARTIAL** | `draftPickUtils.ts`; `entitlements/` | SCEN | #87 | P6 | W6.1 |
| CBA-L05.7 | CBA-L05 | §13.1 | **PARTIAL** | `draftPickUtils.ts`; `entitlements/` | SCEN | #26 | P6 | W6.1 |
| CBA-L06.1 | CBA-L06 | §4.2 | **FOUND** | `tpeLifecycle.ts`; `persistenceContracts/normalizeTeamTpe.ts` | LIFECYCLE | #6 | P3 | W3.1 |
| CBA-L06.2 | CBA-L06 | §12.1 | **FOUND** | `tpeLifecycle.ts`; `persistenceContracts/normalizeTeamTpe.ts` | LIFECYCLE | #6 | P3 | W3.1 |
| CBA-L06.3 | CBA-L06 | §12.5 | **FOUND** | `tpeLifecycle.ts`; `persistenceContracts/normalizeTeamTpe.ts` | LIFECYCLE | #6 | P3 | W3.1 |
| CBA-L07 | — | §4.2 | **FOUND** | `hardCapUtils.ts`; `capTotals/hardCapSnapshotOverlay.ts` | LIFECYCLE | #15 | P3 | W3.1 |
| CBA-L08.1 | CBA-L08 | §3 | **NO SITE** | zero `repeater` symbols | LIFECYCLE | #20 | P7 | W7.1 |
| CBA-L08.2 | CBA-L08 | §4.2 | **NO SITE** | zero `repeater` symbols | LIFECYCLE | #20, #21 | P7 | W7.1 |
| CBA-L08.3 | CBA-L08 | §8.5 | **NO SITE** | zero `repeater` symbols | LIFECYCLE | #20 | P7 | W7.1 |
| CBA-L08.4 | CBA-L08 | §8.5 | **NO SITE** | zero `repeater` symbols | LIFECYCLE | #20 | P7 | W7.1 |
| CBA-L08.5 | CBA-L08 | §8.5 | **NO SITE** | zero `repeater` symbols | LIFECYCLE | #20 | P7 | W7.1 |
| CBA-L08.6 | CBA-L08 | §8.5 | **NO SITE** | zero `repeater` symbols | LIFECYCLE | #20 | P7 | W7.1 |
| CBA-L09 | — | §13.3 | **PARTIAL** | `draftPickUtils.ts`; `secondApronMessages.ts` | LIFECYCLE | #20 | P6 | W6.1 |
| CBA-L10.1 | CBA-L10 | §1.1 | **NO SITE** | no assumption/override/provenance model located | EXTS | #88 | P7 | W7.1 |
| CBA-L10.2 | CBA-L10 | §18 | **NO SITE** | no assumption/override/provenance model located | EXTS | #88 | P7 | W7.1 |
| CBA-L10.3 | CBA-L10 | §18 | **NO SITE** | no assumption/override/provenance model located | EXTS | #29 | P7 | W7.1 |
| CBA-L10.4 | CBA-L10 | §18 | **NO SITE** | no assumption/override/provenance model located | EXTS | #88 | P7 | W7.1 |
| CBA-L10.5 | CBA-L10 | §18 | **NO SITE** | no assumption/override/provenance model located | EXTS | #88 | P7 | W7.1 |
| CBA-L10.6 | CBA-L10 | §18 | **NO SITE** | no assumption/override/provenance model located | EXTS | #88 | P7 | W7.1 |
| CBA-L10.7 | CBA-L10 | §18 | **NO SITE** | no assumption/override/provenance model located | EXTS | #88 | P7 | W7.1 |
| CBA-L10.8 | CBA-L10 | §18 | **NO SITE** | no assumption/override/provenance model located | EXTS | #88 | P7 | W7.1 |
| CBA-L10.9 | CBA-L10 | §18 | **NO SITE** | no assumption/override/provenance model located | UI | #88 | P7 | W7.1 |
| CBA-R01.1 | CBA-R01 | §4.3 | **PARTIAL** | `mutationPipeline` waive ops; `offseason/WaiveStretchTracker/` | LIFECYCLE | #36 | P5 | W5.1 |
| CBA-R01.2 | CBA-R01 | §4.4 | **PARTIAL** | `mutationPipeline` waive ops; `offseason/WaiveStretchTracker/` | LIFECYCLE | #34, #35 | P5 | W5.1 |
| CBA-R01.3 | CBA-R01 | §6.1 | **PARTIAL** | `mutationPipeline` waive ops; `offseason/WaiveStretchTracker/` | SCEN | #77 | P5 | W5.1 |
| CBA-R01.4 | CBA-R01 | §9.4 | **PARTIAL** | `mutationPipeline` waive ops; `offseason/WaiveStretchTracker/` | SCEN | #77 | P5 | W5.1 |
| CBA-R01.5 | CBA-R01 | §9.4 | **PARTIAL** | `mutationPipeline` waive ops; `offseason/WaiveStretchTracker/` | SCEN | #77 | P5 | W5.1 |
| CBA-R01.6 | CBA-R01 | §11.1 | **PARTIAL** | `mutationPipeline` waive ops; `offseason/WaiveStretchTracker/` | SCEN | #77 | P5 | W5.1 |
| CBA-R01.7 | CBA-R01 | §11.1 | **PARTIAL** | `mutationPipeline` waive ops; `offseason/WaiveStretchTracker/` | SCEN | #77 | P5 | W5.1 |
| CBA-R01.8 | CBA-R01 | §11.1 | **PARTIAL** | `mutationPipeline` waive ops; `offseason/WaiveStretchTracker/` | SCEN | #41 | P5 | W5.1 |
| CBA-R01.9 | CBA-R01 | §11.1 | **NO SITE** | *zero `claimPriority` / `waiverPriority` symbols* | SCEN | #77 | P5 | W5.1 |
| CBA-R01.10 | CBA-R01 | §11.1 | **NO SITE** | *no postseason-eligibility bar located* | SCEN | #77 | P5 | W5.1 |
| CBA-R02.1 | CBA-R02 | §4.1 | **PARTIAL** | `waiverDeadCapAllocation.ts` | SCEN | #78 | P5 | W5.1 |
| CBA-R02.2 | CBA-R02 | §5.6 | **PARTIAL** | `waiverDeadCapAllocation.ts` | SCEN | #31, #32 | P5 | W5.1 |
| CBA-R02.3 | CBA-R02 | §5.6 | **PARTIAL** | `waiverDeadCapAllocation.ts` | SCEN | #31, #32 | P5 | W5.1 |
| CBA-R02.4 | CBA-R02 | §6.1 | **PARTIAL** | `waiverDeadCapAllocation.ts` | SCEN | #31, #34, #35 | P5 | W5.1 |
| CBA-R02.5 | CBA-R02 | §11.2 | **PARTIAL** | `waiverDeadCapAllocation.ts` | SCEN | #31, #32 | P5 | W5.1 |
| CBA-R02.6 | CBA-R02 | §11.2 | **PARTIAL** | `waiverDeadCapAllocation.ts` | SCEN | #31, #32 | P5 | W5.1 |
| CBA-R02.7 | CBA-R02 | §11.2 | **PARTIAL** | `waiverDeadCapAllocation.ts` | SCEN | #78 | P5 | W5.1 |
| CBA-R03 | — | §11.2 | **NO SITE** | depends on C05, which has no site | SCEN | #33 | P5 | W5.1 |
| CBA-R04.1 | CBA-R04 | §11.3 | **PARTIAL** | `waiverDeadCapAllocation.ts` (`getStretchProvisionYears`) | SCEN | #34 | P5 | W5.1 |
| CBA-R04.2 | CBA-R04 | §11.3 | **PARTIAL** | `waiverDeadCapAllocation.ts` (`getStretchProvisionYears`) | SCEN | #34 | P5 | W5.1 |
| CBA-R04.3 | CBA-R04 | §11.3 | **PARTIAL** | `waiverDeadCapAllocation.ts` (`getStretchProvisionYears`) | SCEN | #34 | P5 | W5.1 |
| CBA-R04.4 | CBA-R04 | §11.3 | **PARTIAL** | `waiverDeadCapAllocation.ts` (`getStretchProvisionYears`) | SCEN | #34 | P5 | W5.1 |
| CBA-R04.5 | CBA-R04 | §11.3 | **PARTIAL** | `waiverDeadCapAllocation.ts` (`getStretchProvisionYears`) | SCEN | #80 | P5 | W5.1 |
| CBA-R04.6 | CBA-R04 | §11.3 | **PARTIAL** | `waiverDeadCapAllocation.ts` (`getStretchProvisionYears`) | SCEN | #80 | P5 | W5.1 |
| CBA-R05.1 | CBA-R05 | §11.4 | **PARTIAL** | `mutationPipeline.normalize.ts` (buyout); set-off not located | SCEN | #35 | P5 | W5.1 |
| CBA-R05.2 | CBA-R05 | §11.4 | **PARTIAL** | `mutationPipeline.normalize.ts` (buyout); set-off not located | SCEN | #35 | P5 | W5.1 |
| CBA-R05.3 | CBA-R05 | §11.4 | **PARTIAL** | `mutationPipeline.normalize.ts` (buyout); set-off not located | SCEN | #35 | P5 | W5.1 |
| CBA-R05.4 | CBA-R05 | §11.4 | **PARTIAL** | `mutationPipeline.normalize.ts` (buyout); set-off not located | SCEN | #81 | P5 | W5.1 |
| CBA-R05.5 | CBA-R05 | §11.4 | **PARTIAL** | `mutationPipeline.normalize.ts` (buyout); set-off not located | SCEN | #81 | P5 | W5.1 |
| CBA-R06.1 | CBA-R06 | §4.3 | **PARTIAL** | `tradeMachine/rules/validateRoster.ts` (`ROSTER_LIMITS`) | LIFECYCLE | #37, #39 | P5 | W5.2 |
| CBA-R06.2 | CBA-R06 | §9.1 | **PARTIAL** | `tradeMachine/rules/validateRoster.ts` (`ROSTER_LIMITS`) | SCEN | #37 | P5 | W5.2 |
| CBA-R06.3 | CBA-R06 | §9.1 | **PARTIAL** | `tradeMachine/rules/validateRoster.ts` (`ROSTER_LIMITS`) | SCEN | #37 | P5 | W5.2 |
| CBA-R06.4 | CBA-R06 | §9.1 | **NO SITE** | *zero `activeList` symbols* | SCEN | #79 | P5 | W5.2 |
| CBA-R06.5 | CBA-R06 | §9.1 | **NO SITE** | *zero bench-minimum symbols* | SCEN | #79 | P5 | W5.2 |
| CBA-R06.6 | CBA-R06 | §9.1 | **PARTIAL** | `tradeMachine/rules/validateRoster.ts` (`ROSTER_LIMITS`) | SCEN | #38 | P5 | W5.2 |
| CBA-R07 | — | §4.3 | **NO SITE** | no clock state located | LIFECYCLE | #37 | P5 | W5.2 |
| CBA-R08.1 | CBA-R08 | §4.3 | **NO SITE** | two-way modelled as a count only | LIFECYCLE | #38 | P5 | W5.2 |
| CBA-R08.2 | CBA-R08 | §4.3 | **NO SITE** | two-way modelled as a count only | LIFECYCLE | #38 | P5 | W5.2 |
| CBA-R08.3 | CBA-R08 | §5.2 | **NO SITE** | two-way modelled as a count only | SCEN | #38 | P5 | W5.2 |
| CBA-R08.4 | CBA-R08 | §5.2 | **NO SITE** | two-way modelled as a count only | SCEN | #38 | P5 | W5.2 |
| CBA-R08.5 | CBA-R08 | §9.3 | **NO SITE** | two-way modelled as a count only | SCEN | #38 | P5 | W5.2 |
| CBA-R09.1 | CBA-R09 | §9.2 | **PARTIAL** | `offseason/resolveOffseasonTransition.ts` | SCEN | #39 | P5 | W5.2 |
| CBA-R09.2 | CBA-R09 | §9.2 | **PARTIAL** | `offseason/resolveOffseasonTransition.ts` | SCEN | #39 | P5 | W5.2 |
| CBA-R10.1 | CBA-R10 | §4.3 | **NO SITE** | zero `hardship` references | LIFECYCLE | #82 | P5 | W5.2 |
| CBA-R10.2 | CBA-R10 | §4.3 | **NO SITE** | zero `hardship` references | EXTS | #82 | P5 | W5.2 |
| CBA-R10.3 | CBA-R10 | §9.1 | **NO SITE** | zero `hardship` references | SCEN | #82 | P5 | W5.2 |
| CBA-R10.4 | CBA-R10 | §9.1 | **NO SITE** | zero `hardship` references | EXTS | #82 | P5 | W5.2 |
| CBA-S01.1 | CBA-S01 | §3.1 | **FOUND** | `utils/capProjections.ts`; `data/capYearData.ts`; `data/minimumSalaryScales.ts`; `data/rookieScale.ts` | STATIC | — | P1 | W1.1 |
| CBA-S01.2 | CBA-S01 | §3.1 | **FOUND** | `utils/capProjections.ts`; `data/capYearData.ts`; `data/minimumSalaryScales.ts`; `data/rookieScale.ts` | STATIC | — | P1 | W1.1 |
| CBA-S01.3 | CBA-S01 | §3.1 | **FOUND** | `utils/capProjections.ts`; `data/capYearData.ts`; `data/minimumSalaryScales.ts`; `data/rookieScale.ts` | STATIC | — | P1 | W1.1 |
| CBA-S01.4 | CBA-S01 | §3.1 | **FOUND** | `utils/capProjections.ts`; `data/capYearData.ts`; `data/minimumSalaryScales.ts`; `data/rookieScale.ts` | STATIC | — | P1 | W1.1 |
| CBA-S01.5 | CBA-S01 | §5.7 | **FOUND** | `utils/capProjections.ts`; `data/capYearData.ts`; `data/minimumSalaryScales.ts`; `data/rookieScale.ts` | STATIC | — | P1 | W1.1 |
| CBA-S01.6 | CBA-S01 | §14 | **FOUND** | `utils/capProjections.ts`; `data/capYearData.ts`; `data/minimumSalaryScales.ts`; `data/rookieScale.ts` | STATIC | — | P1 | W1.1 |
| CBA-S02.1 | CBA-S02 | §1.2 | **PARTIAL** | `utils/cbaConstants.ts` + `tradeMachine/constants/cbaConstants.ts` (two definitions) | STATIC | — | P1 | W1.1 |
| CBA-S02.2 | CBA-S02 | §3 | **PARTIAL** | `utils/cbaConstants.ts` + `tradeMachine/constants/cbaConstants.ts` (two definitions) | STATIC | — | P1 | W1.1 |
| CBA-S02.3 | CBA-S02 | §3 | **PARTIAL** | `utils/cbaConstants.ts` + `tradeMachine/constants/cbaConstants.ts` (two definitions) | STATIC | — | P1 | W1.1 |
| CBA-S02.4 | CBA-S02 | §3.1 | **PARTIAL** | `utils/cbaConstants.ts` + `tradeMachine/constants/cbaConstants.ts` (two definitions) | STATIC | — | P1 | W1.1 |
| CBA-S03.1 | CBA-S03 | §1.1 | **PARTIAL** | `config/validationFlags.ts`; `capRulesProfile.ts` (`provenance`) | STATIC | — | P1 | W1.1 |
| CBA-S03.2 | CBA-S03 | §9.3 | **PARTIAL** | `config/validationFlags.ts`; `capRulesProfile.ts` (`provenance`) | STATIC | — | P1 | W1.1 |
| CBA-S03.3 | CBA-S03 | §17 | **PARTIAL** | `config/validationFlags.ts`; `capRulesProfile.ts` (`provenance`) | STATIC | — | P1 | W1.1 |
| CBA-S04.1 | CBA-S04 | §3.1 | **PARTIAL** | `tradeMachine/utils/salaryMatchingRules.ts`; `utils/capProjections.ts` | SCEN | #1 | P1 | W1.1 |
| CBA-S04.2 | CBA-S04 | §3.1 | **PARTIAL** | `tradeMachine/utils/salaryMatchingRules.ts`; `utils/capProjections.ts` | SCEN | #61 | P1 | W1.1 |

### 2.2 The eleven top-level LEAF IDs

These own exactly one obligation each, so they have no children and are audited directly at the top level.

| LEAF | Canon § | Locatability | Packet |
|---|---|---|---|
| **CBA-A04** | §12.3 | **PARTIAL** | P2 |
| **CBA-A11** | §12.4 | **PARTIAL** | P3 |
| **CBA-A13** | §8.2 | **FOUND** | P3 |
| **CBA-A16** | §9.4 | **FOUND** | P5 |
| **CBA-A21** | §12.6 | **NO SITE** | P3 |
| **CBA-C06** | §5.9 | **NO SITE** | P1 |
| **CBA-C18** | §5.9 | **NO SITE** | P4 |
| **CBA-L07** | §4.2 | **FOUND** | P3 |
| **CBA-L09** | §13.3 | **PARTIAL** | P6 |
| **CBA-R03** | §11.2 | **NO SITE** | P5 |
| **CBA-R07** | §4.3 | **NO SITE** | P5 |

### 2.3 LEAF locatability that differs from the parent

Every LEAF not listed here inherits its parent's site, as stated in §0.1. **These are the rows where a FOUND parent conceals an unsited child.**

| LEAF | Parent | Parent locatability | LEAF locatability | Evidence from the targeted sweep |
|---|---|---|---|---|
| CBA-A10.2 | CBA-A10 | FOUND | **PARTIAL** | `TRADE_TIMING` exists; no two-month/December 16 carve-out located |
| CBA-A10.3 | CBA-A10 | FOUND | **PARTIAL** | S&T machinery exists; no re-aggregation restriction located |
| CBA-A17.3 | CBA-A17 | FOUND | **NO SITE** | no pick protection/deferral exclusivity rule located |
| CBA-A17.7 | CBA-A17 | FOUND | **NO SITE** | no conveyance-horizon condition located |
| CBA-A18.7 | CBA-A18 | FOUND | **NO SITE** | zero `conditionalCash` symbols |
| CBA-C01.6 | CBA-C01 | FOUND | **NO SITE** | zero `unrenounce` symbols |
| CBA-C13.11 | CBA-C13 | FOUND | **NO SITE** | zero `secondRoundPickException` / `SECOND_ROUND_PICK` symbols |
| CBA-C13.12 | CBA-C13 | FOUND | **NO SITE** | zero `secondRoundPickException` symbols; no Apron add-back exists |
| CBA-C13.15 | CBA-C13 | FOUND | **PARTIAL** | two-way and minimum paths exist; SRPE path has no site |
| CBA-C14.3 | CBA-C14 | FOUND | **PARTIAL** | renunciation machinery exists; no Early-Bird-to-Non-Bird downgrade |
| CBA-C24.3 | CBA-C24 | PARTIAL | **NO SITE** | zero option-deadline symbols (`JUNE_29` / `optionDeadline`) |
| CBA-C24.4 | CBA-C24 | PARTIAL | **NO SITE** | no prior-to-June-25 RFA option comparison located |
| CBA-L03.8 | CBA-L03 | FOUND | **PARTIAL** | `noTradeClause` field exists; no 8-YOS/4-YOS eligibility test |
| CBA-R01.9 | CBA-R01 | PARTIAL | **NO SITE** | zero `claimPriority` / `waiverPriority` symbols |
| CBA-R01.10 | CBA-R01 | PARTIAL | **NO SITE** | no postseason-eligibility bar located |
| CBA-R06.4 | CBA-R06 | PARTIAL | **NO SITE** | zero `activeList` symbols |
| CBA-R06.5 | CBA-R06 | PARTIAL | **NO SITE** | zero bench-minimum symbols |

---

## 3. Mechanically computed totals

### 3.1 Registry structure

| Measure | Count |
|---|---:|
| **Registry nodes** (GROUP + LEAF) | **427** |
| **GROUP** — navigation/rollup anchors, never execution units | **59** |
| **LEAF** — the Phase 2 audit universe | **368** |
| …top-level LEAF | 11 |
| …sub-ID LEAF | 357 |
| Top-level IDs (56 preserved + 14 added) | 70 |
| Substantive obligations, each with exactly one owning LEAF | **368** |
| LEAF identifiers appearing exactly once in §2 and one packet | **368** |

### 3.2 GROUP hierarchy and rollup

**A GROUP has no status of its own.** The distribution below is a rollup of its children, shown precisely so that mixed compliance can never be collapsed into one parent verdict.

| GROUP | Children | Child locatability distribution | Packet | Unit |
|---|---:|---|---|---|
| CBA-A01 | 4 | 4 PARTIAL | P1 | W1.2 |
| CBA-A02 | 8 | 8 FOUND | P3 | W3.1 |
| CBA-A03 | 5 | 5 NO SITE | P2 | W2.1 |
| CBA-A05 | 2 | 2 FOUND | P2 | W2.1 |
| CBA-A06 | 2 | 2 NO SITE | P2 | W2.1 |
| CBA-A07 | 9 | 9 PARTIAL | P2 | W2.1 |
| CBA-A08 | 2 | 2 NO SITE | P2 | W2.1 |
| CBA-A09 | 5 | 5 FOUND | P3 | W3.1 |
| CBA-A10 | 3 | 1 FOUND · 2 PARTIAL | P3 | W3.1 |
| CBA-A12 | 10 | 10 FOUND | P3 | W3.2 |
| CBA-A14 | 4 | 4 NO SITE | P3 | W3.2 |
| CBA-A15 | 5 | 5 NO SITE | P6 | W6.1 |
| CBA-A17 | 7 | 5 FOUND · 2 NO SITE | P6 | W6.1 |
| CBA-A18 | 8 | 7 FOUND · 1 NO SITE | P6 | W6.1 |
| CBA-A19 | 5 | 5 FOUND | P3 | W3.2 |
| CBA-A20 | 5 | 5 PARTIAL | P3 | W3.2 |
| CBA-C01 | 6 | 5 FOUND · 1 NO SITE | P4 | W4.1 |
| CBA-C02 | 2 | 2 FOUND | P4 | W4.1 |
| CBA-C03 | 2 | 2 FOUND | P4 | W4.1 |
| CBA-C04 | 2 | 2 PARTIAL | P4 | W4.1 |
| CBA-C05 | 5 | 5 NO SITE | P1 | W1.2 |
| CBA-C07 | 10 | 10 NO SITE | P1 | W1.2 |
| CBA-C08 | 5 | 5 PARTIAL | P1 | W1.2 |
| CBA-C09 | 2 | 2 NO SITE | P1 | W1.2 |
| CBA-C10 | 5 | 5 PARTIAL | P1 | W1.2 |
| CBA-C11 | 9 | 9 PARTIAL | P4 | W4.1 |
| CBA-C12 | 2 | 2 NO SITE | P4 | W4.1 |
| CBA-C13 | 15 | 12 FOUND · 1 PARTIAL · 2 NO SITE | P4 | W4.1 |
| CBA-C14 | 9 | 8 FOUND · 1 PARTIAL | P4 | W4.2 |
| CBA-C15 | 2 | 2 NO SITE | P4 | W4.2 |
| CBA-C16 | 14 | 14 FOUND | P4 | W4.3 |
| CBA-C17 | 7 | 7 NO SITE | P4 | W4.3 |
| CBA-C19 | 6 | 6 PARTIAL | P4 | W4.4 |
| CBA-C20 | 9 | 9 PARTIAL | P4 | W4.4 |
| CBA-C21 | 11 | 11 NO SITE | P4 | W4.4 |
| CBA-C22 | 4 | 4 PARTIAL | P4 | W4.4 |
| CBA-C23 | 6 | 6 NO SITE | P4 | W4.4 |
| CBA-C24 | 7 | 5 PARTIAL · 2 NO SITE | P4 | W4.3 |
| CBA-C25 | 3 | 3 NO SITE | P1 | W1.2 |
| CBA-L01 | 5 | 5 FOUND | P1 | W1.1 |
| CBA-L02 | 8 | 8 PARTIAL | P4 | W4.3 |
| CBA-L03 | 15 | 14 FOUND · 1 PARTIAL | P7 | W7.1 |
| CBA-L04 | 17 | 17 FOUND | P4 | W4.2 |
| CBA-L05 | 7 | 7 PARTIAL | P6 | W6.1 |
| CBA-L06 | 3 | 3 FOUND | P3 | W3.1 |
| CBA-L08 | 6 | 6 NO SITE | P7 | W7.1 |
| CBA-L10 | 9 | 9 NO SITE | P7 | W7.1 |
| CBA-R01 | 10 | 8 PARTIAL · 2 NO SITE | P5 | W5.1 |
| CBA-R02 | 7 | 7 PARTIAL | P5 | W5.1 |
| CBA-R04 | 6 | 6 PARTIAL | P5 | W5.1 |
| CBA-R05 | 5 | 5 PARTIAL | P5 | W5.1 |
| CBA-R06 | 6 | 4 PARTIAL · 2 NO SITE | P5 | W5.2 |
| CBA-R08 | 5 | 5 NO SITE | P5 | W5.2 |
| CBA-R09 | 2 | 2 PARTIAL | P5 | W5.2 |
| CBA-R10 | 4 | 4 NO SITE | P5 | W5.2 |
| CBA-S01 | 6 | 6 FOUND | P1 | W1.1 |
| CBA-S02 | 4 | 4 PARTIAL | P1 | W1.1 |
| CBA-S03 | 3 | 3 PARTIAL | P1 | W1.1 |
| CBA-S04 | 2 | 2 PARTIAL | P1 | W1.1 |
| **Total** | **357** | | | |

**10 of 59 GROUPs have children in more than one locatability state.** For every one of them, a single parent verdict would have been false for at least one child. The sharpest are `CBA-C13` (FOUND parent, three children with no site), `CBA-R01`, `CBA-R06`, `CBA-A18`, and `CBA-A17`.

### 3.3 Locatability — LEAF identifiers only

| Locatability | LEAF | Share |
|---|---:|---:|
| **FOUND** | 134 | 36.4% |
| **PARTIAL** | 127 | 34.5% |
| **NO SITE** | 107 | 29.1% |
| **Total** | **368** | 100% |

This supersedes the 153 / 149 / 125 figure of the first v1.1 draft, which scored all 427 registry nodes and so counted 59 grouping parents that own no obligation of their own.

### 3.4 Verification methods — LEAF identifiers only

| Method | Meaning | LEAF |
|---|---|---:|
| SCEN | Executable scenario | 306 |
| LIFECYCLE | Lifecycle/state review | 32 |
| EXTS | External-state handling | 16 |
| STATIC | Static/configuration inspection | 13 |
| UI | Manual UI review | 1 |
| **Total** | | **368** |

Not every obligation is an executable test: `CBA-S01`–`S03` are proven by static and configuration inspection, the state ledgers of canon §§4.2–4.4 by lifecycle review, and EXT determinations by explicit external-state handling.

---

## 4. Canon ID Coverage Gaps — RESOLVED by Canon v1.1

**Status: superseded. Retained for the historical record, not erased.**

The 2026-07-13 edition opened a section under this title recording canon **requirements stated in prose that no audit ID represented**, and named two: **§3.1** (season parameters, holding 14 homeless prior findings) and **§12.8** (sign-and-trade eligibility and contract shape, holding 4). It declined to mint IDs and called for a deliberate index-completeness pass.

That pass ran (`ARCHITECT_CBA_CANON_INDEX_COMPLETENESS_REVIEW.md`, 2026-07-14). **Both gaps were real, and both were incomplete** — 77 obligations had no audit ID and 83 were only partially indexed, across nine further canon sections the code map had not flagged.

| Historical gap | Now owned by |
|---|---|
| §3.1 — season-parameter and configuration policy (14 homeless findings) | `CBA-S01` (parameter layer), `CBA-S02` (single canonical constant + enforcing path), `CBA-S04` (derived recomputation and rounding) |
| §12.8 — sign-and-trade eligibility and contract shape (4 homeless findings) | `CBA-A19`, with the cash-in-trade condition owned by `CBA-A18.3` |

**No substantive obligation in the canon is now unowned or partially indexed.** The historical explanation is preserved because it records *how* the gap was found, which is why the index is trustworthy now.

---

## 5. Dependency map

| Base | Dependents | Why |
|---|---|---|
| **S01–S04** (parameters, constants, provenance, derivation) | *Every other LEAF* | Every monetary verdict reads a season constant. A wrong constant makes a correct rule produce a wrong answer. |
| **A01** (ledger separation) | C07, C08, A03–A08, A12, A13 | You cannot judge whether an apron test uses the right number until you know which ledger it reads. |
| **C07** (Apron Salary, 10 LEAF children) | A12, A13, A14, L07 | Every apron verdict is a comparison against Apron Salary. |
| **C08** (Tax Salary) | C09, L08 | Progressive tax and repeater history both consume Tax Salary. |
| **C05** (minimum subsidy) | R03, C01 | Dead salary must use actual, not subsidized, compensation. |
| **A02** (Expanded TPE formula) | A09, A10, A11 | The TPE paths all consume the matching formula. |
| **C14** (Bird clocks) | C01, C16, L04 | Cap holds, extensions, and RFA rights are functions of Bird status. |
| **L01** (dated evaluation) | A03, L03, R02, R04, C03, C19, C24 | Every date-windowed rule needs a trustworthy `asOfDate`. |
| **A17 / L09** | Each other | Frozen/slid picks change what Stepien may legally convey. |

**Circular-risk pairs**, reviewed as single units: **A17 ↔ L09** (Stepien ↔ frozen picks, both in W6.1) and **C01 ↔ C14** (cap holds ↔ Bird rights, in adjacent units W4.1 and W4.2).

---

## 6. Phase 2 packets and bounded work units

### 6.1 Packets — LEAF counts only

Seven packets, ordered so that no packet depends on a later one. **GROUP anchors are not counted.**

| # | Packet | GROUPs | LEAF obligations | Why here |
|---|---|---:|---:|---|
| **P1** | **Ledgers, season parameters & dated evaluation (foundation)** | 12 | **55** | Nothing downstream can be judged until we know which salary number each rule reads, whether the parameter layer is sound, and whether `asOfDate` semantics are trustworthy. **Blocks everything.** |
| **P2** | **Trade-salary basis (ITS/OTS)** | 5 | **21** | The per-player inputs to every trade verdict. Entirely unexamined by both prior audits. Depends on P1. |
| **P3** | **TPE paths, aprons, hard caps & trade mechanisms** | 8 | **47** | The trade engine proper. Consumes P1's ledgers and P2's salary basis; also owns sign-and-trade, extend-and-trade, and minimum-contract stacking. |
| **P4** | **Cap holds, exceptions, Bird/RFA/extensions & contract types** | 19 | **139** | The offseason free-agency core plus the contract-authoring surface v1.0 never indexed. |
| **P5** | **Rosters, waivers & dead money** | 8 | **48** | The least-mapped region. Depends on P1 (C05 subsidy → R03; L01 dates). |
| **P6** | **Picks, cash, multi-team & Stepien** | 4 | **28** | Largely self-contained; A17 ↔ L09 reviewed as one unit. Includes the OPS items that must stay configurable. |
| **P7** | **Transaction timing, history & external determination** | 3 | **30** | Cross-cutting closers. L03 consumes L01's calendar, settled in P1. |
| | **Total** | **59** | **368** | |

**Recommended order: P1 → P2 → P3 → P4 → P5 → P6 → P7.**

### 6.2 Bounded work units

The goal remains reviewing **every LEAF obligation across all seven packets**. P1 runs first because it is the foundation, but it is not the endpoint.

Packets are too coarse to execute as-is — P4 alone is 139 LEAF obligations. They are split below into **13 work units**, each sized for a separate fresh session and coherent by rule family and dependency. Target band is roughly 25–45 LEAF obligations; four units sit below it because the family is tightly coupled and splitting it would force provisional verdicts.

| Unit | Packet | Scope | GROUPs / top-level LEAFs | LEAF | Why this boundary |
|---|---|---|---|---:|---|
| **W1.1** | P1 | **Season parameters, constants, provenance, derivation & dated evaluation** | `S01`, `S02`, `S03`, `S04`, `L01` | **20** | The absolute root: *which constant, which date*. Every monetary verdict in every later unit reads these. Smaller than the target band on purpose — it is a tightly coupled family and must be settled before anything else runs. |
| **W1.2** | P1 | **Independent ledgers: Team, Apron, Tax, minimum subsidy & the 90% floor** | `A01`, `C25`, `C05`, `C06`, `C07`, `C08`, `C09`, `C10` | **35** | *Which ledger.* Contains C07's nine Apron Salary add-backs and the Tax/repeater basis. Depends on W1.1. |
| **W2.1** | P2 | **Trade-salary basis — ITS and OTS** | `A03`, `A04`, `A05`, `A06`, `A07`, `A08` | **21** | The per-player inputs to every trade verdict; one coherent family. Depends on W1.2 (which ledger each value reads). |
| **W3.1** | P3 | **TPE formula, paths, decomposition & persistence** | `A02`, `A09`, `A10`, `A11`, `L06`, `L07` | **21** | The Expanded TPE formula and the four TPE paths, plus TPE and hard-cap persistence. Depends on W2.1. |
| **W3.2** | P3 | **Apron transaction limits, hard caps & trade mechanisms** | `A12`, `A13`, `A14`, `A19`, `A20`, `A21` | **26** | The apron transaction table and the mechanisms it gates — sign-and-trade, extend-and-trade, minimum stacking. Grouped so the gate and the gated rules are judged together. |
| **W4.1** | P4 | **Cap holds, exceptions, DPE & the long-term injury exclusion** | `C01`, `C02`, `C03`, `C04`, `C13`, `C11`, `C12` | **38** | The exception inventory and the holds that feed room. DPE sits here because it is an exception, and its separation from the injury exclusion is an exception question. |
| **W4.2** | P4 | **Bird rights, RFA, qualifying offers, offer sheets & Arenas** | `C14`, `C15`, `L04` | **28** | C01 ↔ C14 is a circular-risk pair, so W4.1 runs immediately before this and the two are reviewed with each other in view. |
| **W4.3** | P4 | **Extensions, options and ETOs, Over-38 & renegotiation** | `C16`, `C17`, `C18`, `C24`, `L02` | **37** | Multi-year authoring: extension shape, option shape and deadlines, Over-38 reallocation, renegotiation lifecycle. |
| **W4.4** | P4 | **Contract types and terms: Ten-Day, Rest-of-Season, Two-Way, Exhibit, shape & bonuses** | `C19`, `C20`, `C21`, `C22`, `C23` | **36** | The entire contract-authoring surface v1.0 never indexed. Self-contained once the parameter layer is settled. |
| **W5.1** | P5 | **Waivers, dead salary, stretch, buyout & set-off** | `R01`, `R02`, `R03`, `R04`, `R05` | **29** | The dead-money chain. R03 depends on C05, settled in W1.2. |
| **W5.2** | P5 | **Roster legality, lists, two-way usage & hardship** | `A16`, `R06`, `R07`, `R08`, `R09`, `R10` | **19** | Roster counts, list categories, short-roster clocks, and the EXT-gated hardship/suspension states. Smaller than the band; a coherent family with no natural split. |
| **W6.1** | P6 | **Picks, cash-in-trade, multi-team touch & Stepien** | `A15`, `A17`, `A18`, `L05`, `L09` | **28** | A17 ↔ L09 is a circular-risk pair and must be one unit. Carries both OPS items, which must stay configurable and may never receive a deterministic verdict. |
| **W7.1** | P7 | **Transaction timing, taxpayer/apron history & external determination** | `L03`, `L08`, `L10` | **30** | Cross-cutting closers. L03's fifteen date-and-consent restrictions consume L01's calendar from W1.1. |
| | | **Total** | | **368** | |

**Execution order is unit order:** W1.1 → W1.2 → W2.1 → W3.1 → W3.2 → W4.1 → W4.2 → W4.3 → W4.4 → W5.1 → W5.2 → W6.1 → W7.1. No unit depends on a later one.

Each unit is a self-contained session: it inherits the settled outputs of the units before it, produces the canon §17 six-field record for each of its LEAF obligations, and hands forward nothing but evidence.

---

## 7. Phase 2 evidence procedure

1. **Work every rule by hand against the canon, with a worked numeric example**, before reading the implementation.
2. **Do not accept a passing test as evidence.** Assume the test pins the bug.
3. **Cite the canon section and the CBA/BYL article** for every verdict.
4. **OPS and EXT items may never receive a deterministic verdict** — now owned explicitly by `CBA-S03`.
5. **Honour the verification method.** A LEAF marked STATIC, LIFECYCLE, EXTS, or UI is not discharged by a passing unit test, and one marked SCEN is not discharged by reading the code.
6. **Never issue a GROUP verdict.** Report the child-status distribution. A parent that summarizes ten conditions cannot be Covered because eight of them are.

> **The #116 trap.** `validateCash.ts` enforces a hardcoded `SEASONAL_CASH_LIMIT` and **never reads** the `CASH_LIMITS` table that Part 1 audited. Auditing a constant proves nothing until you have proved the enforcing path reads it. This is now `CBA-S02`, a LEAF in its own right rather than a war story.

---

## 8. Phase 1 boundaries observed

- No application code, test, fixture, schema, constant, data, or configuration file was modified.
- The canon was amended **index-only** (v1.0 → v1.1). No rule, formula, threshold, dollar value, deadline, authority label, or source interpretation changed; scenarios 1–46 and all 56 original IDs are byte-identical.
- No BZE finding implemented. No CBA-rule verdicts made. No V1 scope decided. No Linear issue touched.
- Nothing committed or pushed. **Phase 2 not started.**
- **Known documentation-check deviation:** the canon fails `markdownlint` MD029 because §16 is numbered continuously across sub-headings. Accepted by the owner on 2026-07-13 and *intentional* — scenario numbers are stable identifiers the index cites, so they must not restart per heading.

## 9. Files

| File | Status |
|---|---|
| `docs/reference/cba/ARCHITECT_CBA_CANON.md` | Amended — v1.0 → v1.1, index only |
| `work/architect-completion/ARCHITECT_CBA_CANON_CODE_MAP.md` | Reconciled — this document |
| `work/architect-completion/ARCHITECT_CBA_CANON_V1_1_MIGRATION.md` | Created — migration receipt |
| `work/architect-completion/ARCHITECT_CBA_CANON_INDEX_COMPLETENESS_REVIEW.md` | Unchanged — historical input |
