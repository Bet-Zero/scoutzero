# BZE-293 Negative-Test Matrix

Candidate freeze requires committed automated coverage or exact-head
browser/emulator proof for every applicable row below. Positive fixtures must
use an explicit saved-world date, the governed Regular Season opening, an
authenticated zero-YOS Minimum, and deliberately distinct Team Salary, Apron
Team Salary, and Tax Salary results.

## Authority and scope

- Accepted Canon: candidate
  `6cf8aaf358c158a88e630e8a7336f7e9c3febc17`, SHA-256
  `23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76`.
- Direct leaves: `CBA2-C03.1`, `CBA2-C03.2`, and dependent
  `CBA2-C07.11`; all three pass the pinned accepted-Canon lookup.
- Product workflow: approved W2 saved-world books and every already-supported
  mutation that changes the governed incomplete-roster count.
- Persistence boundary: affected team state, governed charge evidence/result,
  three salary books, receipt, Team History, Compare, reload, and branch.
- Unsupported unsigned First Round Pick state returns Needs input. BZE-293 does
  not decide ownership, Stepien, protection, conveyance, freeze/unfreeze,
  rookie signing, or draft-night behavior.

## Required proof

| Risk | Required negative proof | Expected result |
| --- | --- | --- |
| Required authority is missing | Remove world/date/year/calendar/opening date/zero-YOS Minimum, category owner, salary-book input, or team identity one at a time | Team Salary reports Needs input; mutations write nothing |
| Input shape is malformed | Supply an offset-less/impossible date, `NaN`, fractional-cent or negative money, malformed category, duplicate identity, or wrong season | Validation fails before calculation or persistence |
| A roster shortcut substitutes for C03.1 | Use the 14/15 standard-roster bounds, Two-Way rows, dead money, other cap holds, or pending non-Offer-Sheet records as opposite-side controls | None enters the incomplete-roster count |
| Under-contract count is wrong | Vary only players whose Contracts are included in Team Salary, including a Two-Way and unavailable-Team-Salary control | Each eligible player counts once; excluded/unavailable rows do not silently count |
| Veteran FA count is wrong | Vary governed Veteran Free Agent Amount rows against renounced, unsupported, duplicate, and wrong-season controls | Only included Veteran FA Amount owners count once |
| Offer Sheet count is wrong | Vary governed outstanding Offer Sheet recipients against duplicate, resolved, stale, and wrong-team controls | Only the governed outstanding recipient counts once |
| Unsigned-pick state is guessed | Test authenticated none and included positive state, then missing/unresolved/wrong-team/wrong-year/Stepien-dependent state | Authenticated state is counted exactly; every unavailable variant reports Needs input |
| One identity enters multiple categories | Represent one player in Contract, Veteran FA, and Offer Sheet categories, or duplicate one pick | The conflict is named and no number or write is produced |
| Date window is wrong | Test July 1 first instant, day before the Regular Season, opening day, in-season, postseason, and June 30 while holding all other facts fixed | Only July 1 through the day before the governed opening carries a charge |
| Threshold or amount is wrong | Test counts 0, 10, 11, 12, and above plus exact/one-cent and wrong-YOS Minimum controls | Charge is `(12 - count) × zero-YOS Minimum` only below twelve in the active window |
| Team Salary omits or duplicates the charge | Hold every other Team Salary component fixed while changing only the governed charge | Team Salary changes by exactly the charge once |
| Apron Team Salary keeps the charge | Put Team and Apron Salary on opposite sides of a threshold and vary only C07.11 | Apron Team Salary subtracts the exact Team Salary charge once |
| Tax Salary borrows the charge | Hold the authenticated Tax Salary ledger fixed while Team/Apron charge state changes | Tax Salary and its identity remain unchanged |
| Preview and Apply drift | Change date, roster/rights/Offer Sheet/pick state, minimum, source identity, team revision, or digest after Validate | Apply returns stale and writes nothing |
| A supported mutation misses reconciliation | Exercise signing, waiver, trade, sign-and-trade, Offer Sheet resolution, and Season Advance count changes | Each affected team recalculates once or the whole mutation fails closed |
| Concurrency or replay double-applies | Race two count-changing operations or repeat an accepted operation | One exact commit wins; the other is stale/replayed and changes nothing |
| Atomic persistence splits | Inject failure at team, charge evidence, salary books, receipt, history, or manifest persistence | Every document remains unchanged |
| Reload or branch loses the result | Leave/return, fully reload, then branch positive zero-charge and multi-charge worlds | Category detail, date/window, amount, books, receipt, History, Compare, and all rooms remain identical |
| A failure state looks successful | Force any Needs input, Not evaluated, validation, persistence, or reload failure | No borrowed number or success receipt appears; the UI names the missing input in GM language |
| Completed scope regresses | Run focused BZE-273/283/284/285/286/289/290/291 boundary checks | Completed behavior remains green; draft, trade-bonus, and unsupported list-state routes remain fail closed |

## Cross-workflow proof composition

These rows compose the BZE-293-specific roster/book assertions with the shared
saved-world transaction boundary already landed in the current repository. The
charge evidence, derived resolution, and all three books are fields of the same
Team document; they are not independently writable documents.

| Matrix rows | BZE-293-specific proof | Shared persistence proof |
| --- | --- | --- |
| Preview/Apply drift | `architect-trade-receipt-proof.spec.ts` validates and applies the exact governed two-Team result; `incompleteRosterCharge.test.ts` blocks every supported non-trade count mutation unless its post-state books reconcile | `mutationPipeline.tradePersistenceTruth.test.ts` rejects stale Team snapshots and replays without an overwrite |
| Supported mutation reconciliation | `incompleteRosterCharge.test.ts` covers signing, waiver, renunciation, Offer Sheet creation/resolution, missing Team updates, and unresolved post-state books; `architect-trade-receipt-proof.spec.ts` covers trade | `governedSignAndTrade.test.ts` reconciles authenticated governed roster evidence on both Teams; `seasonManager.governedAdvance.test.ts` recomputes and persists the governed target-year result |
| Concurrency or replay | The governed resolution and books are inside each snapshot digest checked by the shared transaction boundary | `governedSignAndTrade.test.ts` rejects stale Team/player/history snapshots and duplicate transaction ledgers; `seasonManager.governedAdvance.test.ts` rejects concurrent world/Team changes and duplicate transitions with the committed world unchanged |
| Atomic persistence splits | The browser proof reloads the charge, Team Salary, Apron reversal, Tax independence, receipt, and History from one accepted transaction | `governedSignAndTrade.test.ts` rejects partial two-Team commits before every write; `seasonManager.governedAdvance.test.ts` injects commit failure and verifies no Team, history, manifest, event, or metadata write survives |

## Explicit exclusions

- Accepted Canon, Phase 2 audit, and completed-child changes.
- Draft ownership, Stepien, protection/conveyance, pick freeze/unfreeze,
  draft-night, rookie signing, and entitlement authoring.
- Trade-bonus/incentive lifecycle, A06 aggregation timing, waiver
  claims/bidding, Active/Inactive list authoring, shortage clocks,
  hardship/medical determinations, and Two-Way contract authoring.
- New salary-book categories, unrelated exception/contract/trade rules,
  old-world migration, production-data mutation, and unrelated UI redesign.
- Non-blocking observations from completed children.
