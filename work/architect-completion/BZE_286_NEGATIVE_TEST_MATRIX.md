# BZE-286 Negative-Test Matrix

Candidate freeze requires every row below to have committed automated coverage
or an exact-head rendered/emulator proof. Success fixtures must use a realistic
saved world, an explicit world date, and deliberately distinct Team Salary,
Apron Team Salary, and Tax Salary results.

| Risk | Required negative proof | Expected result |
| --- | --- | --- |
| A required authority input is missing | Remove the saved world, world date, governed season/calendar/levels, salary book, signing route, compensation, YOS, rights record, or exception owner one at a time | The action reports Needs input and writes nothing |
| Input shape is malformed | Supply an impossible or offset-less date, `null`/`NaN`/string money, malformed salary row, invalid season, or invalid event authority | Validation fails before compute or persistence |
| Inputs conflict | Disagree player/team/rights identity, selected method and contract method, duplicate methods, or event and ledger authority | The conflict is named and the action writes nothing |
| Authority is stale | Replay an old world revision, contract/right/exception/waiver event, or salary snapshot after a competing commit | Exactly one mutation commits; the stale attempt fails explicitly |
| Date or Salary Cap Year is wrong | Cross Moratorium, January 10 proration, and BAE prior-year-use boundaries while holding all other facts fixed | Only the exact saved-world date/year controls; no wall-clock or synthetic fallback authorizes the action |
| A salary rule reads the wrong book | Put Team, Apron, and Tax Salary on opposite sides of their respective thresholds | Cap-space, hard-cap, and tax consequences follow only their named books |
| Exceptions are combined or overused | Split one signing across methods, use more than remaining balance, reuse a zero balance, switch MLE flavor after use, use BAE in consecutive years, or violate the Room post-use bar | The signing is blocked with no inventory change |
| Exception consumption uses total contract value | Sign a valid multi-year contract whose first-year amount fits but total value exceeds the annual exception | Only the governed first-year amount is consumed |
| Exception amount, term, or raise is illegal | Test one cent below/at/above amount and raise limits, and one year below/at/above term limits | Boundary values pass exactly; excess values fail with no write |
| Minimum route is not governed | Test pre-season versus Regular Season, exact proration, salary above/below minimum, term above two years, missing YOS, and unsupported bonus input | Only exact eligible salary-only Minimum contracts pass; missing inputs remain Needs input |
| Minimum reimbursement is conflated with compensation | Use a one-Season qualifying player above two YOS, then a two-YOS control | Contract Compensation stays actual; all three salary books use the two-YOS amount only in the qualifying case |
| Zero/one-YOS uplift is missing from Tax Salary | Exercise an exact 2026-27 zero-YOS one-Season Minimum Standard Contract, a one-YOS control, and veteran/non-Minimum controls while the seeded C08.7 line remains zero | C07.3 Apron and C08.7 Tax each receive one operation-specific exact uplift; C08.2 remains separate, Team Salary is unchanged by the uplift, and persistence/reload cannot omit or duplicate it |
| One-Season uplift eligibility leaks into a multi-Season contract | Hold method, Standard type, first-year compensation, YOS, saved-world date, and all three books fixed while changing only the Contract from one Season to two Seasons for both zero and one YOS | One Season receives both exact uplift lines; two Seasons receives neither; both books use the same decision and Team Salary remains unchanged by the uplift after persistence/reload |
| Tax Salary is not ready at the signing instant | Test a saved-world date immediately before an authenticated C08.1 baseline, exactly at the baseline, and after it while Apron inputs remain ready | Before the baseline the UI reports Tax Salary Needs input and no Team, player, contract, event, ledger, metadata, exception, set-off, Apron-only, or persistence write occurs; at/after the baseline the normal governed workflow continues |
| Bird route borrows another status | Put Full, Early, and Non-Bird ceilings/terms on different sides of the proposal | Only the independently governed player status can authorize the re-signing |
| Renounced rights are revived | Attempt a Bird re-sign after absolving/renouncing the player | Only Room, Minimum, or another already supported post-renunciation route can pass; the rights history is not rewritten |
| Signing event and mutable contract disagree | Change effective date, terms, player, team, or operation identity on either side | Strict event validation blocks persistence |
| Mutation surfaces disagree | Compare roster, cap hold/rights, exception inventory, hard cap, three books, waiver set-off, receipt, History, and Compare after one signing | Every surface carries one operation identity and the same committed facts |
| Reload loses state | Leave and return to the room, then fully reload after outside signing and own-FA re-signing | Contract, roster, books, exception use, event history, receipt basis, and set-off remain identical |
| Failure state looks successful | Force any Needs input, validation, persistence, or reload failure | Player remains in the pool/own-FA row, no success receipt appears, and the message states what is needed |
| NBA set-off is guessed | Remove YOS, minimum, original-term overlap, waiver allocation, or written modification authority | Prior obligation remains unchanged or Needs input; no synthetic reduction is written |
| NBA set-off formula or allocation is wrong | Test zero/negative/positive excess and one-cent formula differences, then standard and stretched allocation controls | Reduction is `50% × max(new Base Compensation − applicable minimum, 0)` and follows only the governed affected allocation |
| Set-off escapes the original term | Add new compensation outside the terminated Contract's original term | No set-off is produced for the non-overlapping season |
| Completed workflows regress | Run focused option, extension, Offer Sheet, waiver, salary-book, renunciation, and sign-and-trade boundary suites | BZE-282 through BZE-285 behavior remains green or a failure is proven unrelated |

## Explicit exclusion

`CBA2-C23.6` and every bonus-dependent conclusion remain open because the
salary-only Architect editor has no signing-bonus authoring field. This tranche
must not manufacture that input or claim those leaves established.
