# NBA Trade Machine — Final Deep Audit (ANALYZE ONLY)

## 1. SUMMARY
- **Good / Pass** – 123/123 tests at commit 5181779 on 2025-08-08T04:13Z
- Moratorium and roster windows enforced as soft warnings via `validationFlags`
- Second‑apron handcuffs: cash, aggregation, TPE/FA exceptions and salary take‑back
- Soft paths remain for roster, timing and seasonal cash when flags set to `warn`

## 2. COMPLIANCE MATRIX
| Rule # | Rule Name | Implemented? | Files & Functions | Notes | Severity |
| --- | --- | --- | --- | --- | --- |
| 0 | Calendar & eligibility | Partial | `timingUtils.isWithinMoratorium`, `consentUtils.collectConsentViolations`, `reacqUtils.getReacqBlock` | Moratorium & roster gates configurable | Medium |
| 1 | Team modes & hard-cap state | Yes | `tradeHelpers.getIncomingCeiling`, `hardCapTriggers.markHardCapTriggered` | Guards pre/post trade cap status | High |
| 2 | Second-apron handcuffs | Yes | `tradeValidator.enforceSecondApronHandcuffs`, `tpeUtils.SECOND_APRON_TPE_BLOCK`, `faExceptionUtils.canUseFaException` | Blocks cash, aggregation, TPE/FA usage, >100% take-back | High |
| 3 | Salary matching | Yes | `cbaConstants.MATCHING_BANDS_2023`, `tradeHelpers.calculateAllowableIncoming` | Implements 200%+250k / +7.5M / 125%+250k bands and apron 100% | High |
| 4 | Conversions before matching | Yes | `tradeValidator.computeMatchingValues` | BYC, poison pill, trade kicker applied before matching | Medium |
| 5 | Sign-and-trade | Yes | `tradeValidator.validateSignAndTrade` | Enforces origin team, offseason, 3–4 yrs, Y1 guarantee, hard-cap | High |
| 6 | Draft assets | Yes | `stepienUtils.passesStepienRule`, `draftPickUtils.isFrozenPick` | Stepien, seven-year limit, frozen pick check | Medium |
| 7 | Cash in trades | Yes | `tradeValidator.validateCash`, `cashUtils.getSeasonalCashCaps` | Seasonal ledger & second-apron cash ban | Medium |
| 8 | Roster count & two-way slots | Partial | `rosterUtils.passesRosterWindow` | Enforcement downgraded to warnings by default | Low |
| 9 | Final apron/hard-cap guardrails | Yes | `tradeValidator.validateSecondApronRules`, `tradeHelpers.wouldExceedHardCap` | Protects first/second apron ceilings | High |
|10| Admin wrap-up | Partial | `tpeUtils.createTPE`, `tpeUtils.isExpiredTPE` | No explicit physicals/bonus waiver hooks | Low |

## 3. ORDER-OF-OPERATIONS AUDIT
1. `computeMatchingValues` applies BYC, poison pill and kicker conversions
2. For each team: `enforceSecondApronHandcuffs`
3. `validateSignAndTrade`
4. `enforceConsent` → `enforceEligibility` (re-acquisition)
5. Salary ceiling via `getIncomingCeilingForTeam`
6. `validateCash` (seasonal ledger & cash bans)
7. Second-apron aggregation check
8. Draft pick rules (`buildFirstRoundCalendar`, `passesStepienRule`, frozen pick)
9. Roster window & two-way counts (`passesRosterWindow`)
10. Hard-cap guardrail (`wouldExceedHardCap`)
11. TPE and FA-exception validations
12. Cash ledger / summary packaging

## 4. FORMULA & THRESHOLD CHECKS
- **Matching bands:** `2.0 * out + 250_000`, `out + 7_500_000`, `1.25 * out + 250_000`【F:src/utils/architect/cbaConstants.js†L39-L46】
- **1st/2nd apron 100% take-back:** salary ceiling clamps to `salaryOut` when above aprons【F:src/utils/architect/tradeHelpers.js†L63-L70】
- **Second-apron prohibitions:** `Second apron: prior-year TPEs cannot be used`, cash/aggregation/≥100% checks【F:src/utils/architect/tradeMachine/tradeValidator.js†L226-L270】
- **Poison pill averaging & kicker proration:** computed in `computeMatchingValues`【F:src/utils/architect/tradeMachine/tradeValidator.js†L875-L925】
- **BYC = max(prior,50%)** via `outgoingValueBYC` (indirect in `computeMatchingValues`)【F:src/utils/architect/tradeMachine/tradeValidator.js†L892-L897】
- **FA exceptions as trade buckets:** eligibility in `canUseFaException` blocks apron teams【F:src/utils/architect/faExceptionUtils.js†L15-L24】
- **TPE lifecycle & second-apron ban:** `createTPE` + prior-year block【F:src/utils/architect/tradeMachine/tpeUtils.js†L21-L33】【F:src/utils/architect/tradeMachine/tpeUtils.js†L1-L4】

## 5. EDGE-CASE & SWITCH CHECKLIST
- Team modes: cap/tax/apron via `getApronStatus`【F:src/utils/architect/tradeHelpers.js†L131-L133】
- S&T constraints: offseason only, origin team, 3–4 yrs, Y1 guaranteed【F:src/utils/architect/tradeMachine/tradeValidator.js†L1240-L1287】
- Timing gates: moratorium, 30-day, 2-month aggregation in `enforceTiming`【F:src/utils/architect/tradeMachine/tradeValidator.js†L357-L379】
- Consent: full/limited/1‑yr Bird via `collectConsentViolations`【F:src/utils/architect/consentUtils.js†L1-L48】
- Re-acquisition bar: `getReacqBlock` checks trade-back & waived-player rules【F:src/utils/architect/reacqUtils.js†L1-L37】
- Roster counts & two-way separation via `passesRosterWindow`【F:src/utils/architect/rosterUtils.js†L13-L31】
- Cash ledger tracking via `computeSeasonCashLedger`【F:src/utils/architect/cashUtils.js†L11-L23】
- TPE/FA exception handcuffs interact with `enforceSecondApronHandcuffs` and `canUseFaException`【F:src/utils/architect/tradeMachine/tradeValidator.js†L226-L270】【F:src/utils/architect/faExceptionUtils.js†L15-L24】
- UI surfaces `tradeValidator` state via summary panel components (read-only)

## 6. TEST COVERAGE MAP
- Matching bands & apron: `tests/trade/matchingBands_2023.test.js`, `tests/trade/firstApron_100pct.test.js`
- Second-apron handcuffs: `tests/trade/secondApron_handcuffs.test.js`, `tests/trade/secondApron_tpeBan.test.js`
- FA exceptions & TPE: `tests/trade/faExceptions_as_trade_buckets.test.js`, `tests/trade/tpe_creation_expiry_usage.test.js`
- Cash ledger: `tests/trade/cashLedger_season_tracking.test.js`
- Consent & re-acquisition: `tests/trade/consent_and_birdVeto.test.js`, `tests/trade/reacquisition_bar.test.js`
- Timing & roster windows: `tests/trade/timingGates_softEnforcement.test.js`, `tests/trade/rosterWindow_softEnforcement.test.js`
- Order-of-operations conversions: `tests/trade/orderOfOps_conversionsBeforeMatching.test.js`

## 7. GAPS & RISK NOTES
- Roster, timing, seasonal cash and two-way limits default to warnings; relying on callers to escalate
- Input parsing assumes well-formed pick protection text; malformed strings may slip

## 8. APPENDIX: VIOLATION MESSAGES & INVARIANTS
- "Second apron team cannot include cash in trades"【F:src/utils/architect/tradeMachine/tradeValidator.js†L264-L266】
- "S&T contract must be 3-4 years"【F:src/utils/architect/tradeMachine/tradeValidator.js†L1275-L1286】
- "Re-acquisition bar: {Team} cannot reacquire {Player} until {date}"【F:src/utils/architect/tradeMachine/tradeValidator.js†L346-L349】
- "Salary mismatch: Incoming exceeds allowable" invariant enforces CBA matching bands
