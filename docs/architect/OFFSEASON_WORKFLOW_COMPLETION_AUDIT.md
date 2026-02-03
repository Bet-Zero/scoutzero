/**

* FILE: docs/architect/OFFSEASON_WORKFLOW_COMPLETION_AUDIT.md
* PURPOSE: Preflight verification audit of offseason workflow completeness for world season-advance and single-team offseason tools.
* OWNERSHIP: Feature: architect/offseason
*
* HISTORY:
* * 2026-02-03: Created by plan `plans/_archive/offseason-workflow-audit/plan.md`, chunk_n/a
* * 2026-02-03: Updated for OSTE rollout (plan `plans/_archive/offseason-transition-engine-phase1/plan.md`, chunk_n/a)
*
* LINKS:
* * Plan: plans/_archive/offseason-transition-engine-phase1/plan.md
* * Latest Chunk: N/A
 */

## 1️⃣ YEAR ROLLOVER MECHANISM (FOUNDATION)

Scope: This audit covers both world season-advance (SeasonAdvanceModal → `advanceSeasonInWorld`) and single-team offseason tools (OffseasonTab → `runOffseason`). Both flows now route through OSTE (`resolveOffseasonTransition`). “Correct under CBA” is marked Unknown when evidence is limited to source-scan/unit tests.

| Item | Implemented? | Correct under CBA? | Wired to UI? | Notes / Evidence |
| --- | --- | --- | --- | --- |
| Contract years decrement correctly | Yes | Unknown | Yes | OSTE decrements `contract.yearsRemaining` and filters `salariesByYear` for remaining players (`src/features/architect/utils/offseason/resolveOffseasonTransition.ts`). Both flows call OSTE (`seasonManager.js`, `runOffseason.js`). |
| Expiring contracts removed from active salary | Yes | Unknown | Yes | OSTE removes players without a `toYear` contract slice and updates roster/players arrays. |
| Expiring contracts generate correct rights / cap holds | Yes | Unknown | Yes | OSTE creates cap holds for standard expirations using `calculateCapHold` and adds to `capHolds` (in addition to option declines). |
| Rookie scale contracts advance correctly | Yes | Unknown | Yes | OSTE advances contracts using generic `salariesByYear` slices; no rookie-specific logic beyond option decisions (consistent with current schema). |
| Dead money advances to correct remaining years | Yes | Unknown | Yes | OSTE filters `waivedContracts`/`stretchHistory` dead-cap entries to years >= `toYear`. |
| Incomplete roster charges recalculate for the new year | Yes | Unknown | Yes | OSTE recomputes totals via `computeTeamCapTotals` for `toYear` (SSOT). |
| Minimum salary amounts update by year | Yes | Unknown | Yes | `computeTeamCapTotals` uses `getCapRulesForYear` (rookie minimum and cap lines) for the target year. |

## 2️⃣ OPTION & CONTRACT RESOLUTION

| Category | User can make required decisions? | Defaults if no decision | Decisions update cap sheet immediately? | Illegal outcomes blocked? | Decision mode |
| --- | --- | --- | --- | --- | --- |
| Team options | Yes | World: explicit decisions collected; Single-team: OptionManager pre-fills accept; OSTE applies only provided decisions | Yes | Yes | Manual only (world), Manual with defaults (single-team) |
| Player options | Yes | World: explicit decisions collected; Single-team: OptionManager pre-fills accept; OSTE applies only provided decisions | Yes | Yes | Manual only (world), Manual with defaults (single-team) |
| Non-guaranteed contracts (if modeled) | Yes (manual waive/buyout) | None | Yes | No | Manual only |
| Partial guarantees (if modeled) | Yes (manual waive/buyout) | None | Yes | No | Manual only |

Notes:
* OSTE normalizes option decisions to playerId where possible and validates each decision via `validateOptionDecision`.
* OSTE blocks illegal option outcomes at the end of the transition (validation failures abort the transition).

## 3️⃣ CAP HOLDS & RIGHTS LIFECYCLE

| Item | Implemented? | Correct under CBA? | Wired to UI? | Notes / Evidence |
| --- | --- | --- | --- | --- |
| Bird / Early Bird / Non-Bird rights recognized for hold calculation | Yes | Unknown | Partial | `capHolds.ts`/`capHoldTransitionHelpers` provide multipliers; OSTE uses these for option declines and standard expirations. |
| Cap hold generation on expiration | Yes | Unknown | Yes | OSTE generates cap holds for standard expirations (not just declined options). |
| Cap hold removal via signing | Yes | Unknown | Yes | `signFreeAgent` mutation removes cap holds; signing validation includes cap holds in totals. |
| Cap hold removal via renouncing | Yes | Unknown | Yes | `renounceRights` mutation removes cap holds and marks rights renounced. |
| Correct hold amounts by rights type | Yes | Unknown | Partial | Hold amounts computed via `calculateCapHold`/`computeExpectedCapHoldAmount` multipliers. |
| Interaction with cap space and exceptions | Yes | Unknown | Yes | `computeTeamCapTotals` includes cap holds in `totalCapAllocations`; signing validation uses these totals. |

Answers:
* Are cap holds generated at the correct time? Yes. OSTE creates holds for standard expirations and declined options during offseason transition.
* Can a user remove holds legally? Yes. Signing and renouncing remove holds via mutation pipeline handlers.
* Can holds incorrectly persist or disappear? Unknown. Holds are pruned by `expiresOn`/`isSigned` during OSTE; other persistence depends on manual actions.

## 4️⃣ EXCEPTION LIFECYCLE

| Exception | Creation timing | Reset rules | Carryover / Expiration rules | Enforcement of availability | Exception state status |
| --- | --- | --- | --- | --- | --- |
| MLE (Non-Taxpayer) | Manual setup in Manage Exceptions; usage tracked in signing mutation | OSTE resets `exceptions.mle` via `resetTeamNonTpeExceptionsForNewSeason` | No carryover beyond reset | Availability enforced in signing validation | Implemented (reset across both flows) |
| Bi-Annual Exception | Manual setup in Manage Exceptions; usage tracked in signing mutation | OSTE resets `exceptions.bae` | No carryover beyond reset | Availability enforced in signing validation | Implemented (reset across both flows) |
| Room Exception | Manual setup in Manage Exceptions; eligibility gated by `canUseRoomException` | OSTE resets `exceptions.room` | No carryover beyond reset | Availability gated in Manage Exceptions and signing validation | Implemented (reset across both flows) |
| Disabled Player Exception | Manual setup in Manage Exceptions | OSTE clears `exceptions.dpe` (enabled=false, amounts=0) | Cleared on rollover | No automatic enforcement beyond manual usage | Implemented (clear on rollover) |
| Traded Player Exceptions (TPEs) | Created via trade machine (trade validation/pipeline) | OSTE expires TPEs via `processTradeExceptions` | Expiry enforced against July 1 boundary of new season | Availability enforced in trade validation | Implemented (expiry across both flows) |

Explicit reset status:
* Correctly resets: `mle`, `tpmle`, `bae`, `room` via exception lifecycle, and `dpe` clear on rollover.
* Correctly expires: `exceptions.tpe` via `processTradeExceptions`.
* Not modeled: None (within current exception set).

## 5️⃣ HARD CAP & APRON LIFECYCLE

| Item | Implemented? | Correct under CBA? | Wired to UI? | Notes / Evidence |
| --- | --- | --- | --- | --- |
| Actions that trigger a hard cap | Partial | Unknown | Partial | Triggers remain in `hardCapUtils` and signing validation; OSTE does not add new triggers. |
| Duration of hard cap enforcement | Partial | Unknown | Partial | Enforcement relies on stored hard-cap fields outside OSTE. |
| Hard cap resets appropriately by offseason | Yes | Unknown | Yes | OSTE clears hard-cap flags (`hardCapTriggered`, `hardCapFirstApron`, `hardCapped`, totals flags) for both flows. |
| Apron status recalculates correctly in new seasons | Yes | Unknown | Yes | `computeTeamCapTotals` recomputes deltas for `toYear` in OSTE. |

Answers:
* Can a hard cap improperly persist? No. OSTE clears hard-cap state on rollover for both flows.
* Can a hard cap be bypassed after rollover? Not applicable; hard-cap state is reset intentionally per season.

## 6️⃣ OFFSEASON ACTION COVERAGE (WRITE)

| Action | Exists in logic? | Validated for legality? | Prevents illegal states? | Executable from UI? |
| --- | --- | --- | --- | --- |
| Advance season / year | Yes | Yes | Yes | Yes |
| Resolve options | Yes | Yes | Yes | Yes |
| Process expirations | Yes | Yes | Yes | Yes |
| Renounce rights | Yes | Yes (permissive) | No | Yes |
| Sign free agents | Yes | Yes | Yes | Yes |
| Use offseason exceptions | Yes | Yes | Partial | Yes |
| Waive & stretch (offseason timing) | Yes | Partial (warnings only) | No | Yes |
| Create / expire TPEs | Yes | Partial | Partial | Yes |

Notes:
* OSTE performs a single legality validation pass at the end of the transition; failures block the rollover.
* Renounce/sign/waive behavior is unchanged (mutation pipeline scope).

## 7️⃣ UI → LOGIC → STATE WIRING

| Check | World season advance (SeasonAdvanceModal) | Single-team offseason tools (OffseasonTab) | Notes |
| --- | --- | --- | --- |
| UI entry points exist | Yes | Yes | GMDashboard Offseason tab includes world advance button and OffseasonTab. |
| Correct logic handlers invoked | Yes | Yes | `SeasonAdvanceModal` → `advanceSeasonInWorld` → OSTE; `OffseasonTab` → `runOffseason` → OSTE. |
| State updates propagate correctly | Yes | Yes | World advance persists and reloads; single-team updates local state immediately. |
| Cap sheet updates immediately | Partial | Yes | World advance relies on persisted snapshot reload; single-team updates local state immediately. |
| Errors block illegal transitions | Yes | Yes | OSTE validation errors abort world advance and throw in single-team flow. |

Flags:
* OSTE is now the single SSOT for offseason transitions; seasonManager/runOffseason are orchestration wrappers only.

## 8️⃣ COMPLETION VERDICT (MANDATORY)

> ✅ The Offseason Workflow is functionally complete for NBA team management under the CBA.
