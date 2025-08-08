# validateTrade() Call Flow

1. `computeMatchingValues` – apply BYC, poison pill, trade‑kicker conversions
2. Loop teams
   1. `enforceSecondApronHandcuffs`
   2. `validateSignAndTrade`
   3. `enforceConsent`
   4. `enforceEligibility` (re-acquisition)
   5. salary ceiling via `getIncomingCeilingForTeam`
   6. `validateCash`
   7. second‑apron aggregation tally
   8. draft rules (`buildFirstRoundCalendar`, `passesStepienRule`, `isFrozenPick`)
   9. roster window & two-way checks
   10. `wouldExceedHardCap`
   11. trade exception & FA‑exception validations
3. Summaries and cash ledger are returned
