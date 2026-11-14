# C1 coverage table: first-round rights in SIMULATION worlds

V1 item C1, part 1. One table of what the Trade Machine does with each kind of
first-round right, by action and by season step. It is built from the retained
June 5, 2026 inventory (all 278 identities, BZE-309) as compiled into the
private SIMULATION draft package. Counts only; no private data is copied here.

## The 278 rights by family

| Family                                                     | Admitted records | Held back | Unresolved evidence |   Total | Draft years |
| ---------------------------------------------------------- | ---------------: | --------: | ------------------: | ------: | ----------- |
| Outright first                                             |              133 |        26 |                   5 |     164 | 2026-2032   |
| Protected first (protection already settled)               |                3 |        15 |                   1 |      19 | 2026-2030   |
| Outright first, 2033                                       |                0 |        27 |                   3 |      30 | 2033        |
| Encumbered pick (owed on under another right)              |                0 |        19 |                   4 |      23 | 2026-2031   |
| Pick inside a pool                                         |                0 |         4 |                   0 |       4 | 2026-2030   |
| Pool right (receives the more or less favorable of 2 or 3) |                0 |         4 |                   7 |      11 | 2026-2030   |
| Swap right                                                 |                0 |        17 |                  10 |      27 | 2026-2031   |
| **All**                                                    |          **136** |   **112** |              **30** | **278** |             |

**June 5 availability:** 278 retained identities, 136 admitted records, but
**118 currently tradeable picks**. The 18 admitted 2026 picks are blocked by
the coming-draft/rookie-money gate (C2, post-V1). The 118 are 16 in 2027,
14 in 2028, 16 in 2029, 20 in 2030, 28 in 2031 and 24 in 2032. Recomputed
from the private package through `simulationPickStatuses`; eligibility still
depends on the proposed trade's consideration, Stepien and financial checks.
This is not a guarantee that any arbitrary pair can be exchanged.

"Held back" means visible but not tradeable under the named assumption
`unconditional-transfer-only`: the pick sits inside a swap or pool on either
side, carries protection terms, or (2033) lies outside the June 5 trading
window. The 29 unresolved mappings (30 rights) stay exactly as BZE-309 records
them; nothing here changes their status.

## Actions by family

Cells: **Done** (built and proven), **C1** (built in this item), **B5** (waits on
the owner's B5 decision), **Blocked** (named missing fact; stays visible and
not tradeable), **n/a**.

| Family                   | Trade on June 5                                              | Second Apron freeze | Stepien check                 | Season advance (carry) | Draft-year resolution                  | 2033 window opens                          |
| ------------------------ | ------------------------------------------------------------ | ------------------- | ----------------------------- | ---------------------- | -------------------------------------- | ------------------------------------------ |
| Outright first           | Done for later drafts; the coming draft's firsts wait for C2 | Done                | Done                          | C1                     | C1 (holder picks at the original slot) | n/a                                        |
| Protected first, settled | Later drafts only; coming draft waits for C2                 | Done                | Done                          | C1                     | C1                                     | n/a                                        |
| Outright first, 2033     | n/a on June 5                                                | C1                  | C1                            | C1                     | after V1 horizon                       | C1 (tradeable once the 2026 Draft is done) |
| Encumbered pick          | B5                                                           | n/a (not tradeable) | Done (never a retained first) | C1 (carried unchanged) | C1 (labeled outcome) or Blocked        | n/a                                        |
| Pick inside a pool       | B5                                                           | n/a (not tradeable) | Done                          | C1 (carried unchanged) | C1 (labeled outcome) or Blocked        | n/a                                        |
| Pool right               | B5                                                           | n/a (not tradeable) | Done                          | C1 (carried unchanged) | C1 (labeled outcome) or Blocked        | n/a                                        |
| Swap right               | B5                                                           | n/a (not tradeable) | Done                          | C1 (carried unchanged) | C1 (labeled outcome) or Blocked        | n/a                                        |

## Season steps C1 must cover

1. **June 5, 2026 to July 1, 2026 (2026-27 starts).** The 2026 Draft is
   resolved. Each 2026 first leaves the holdings: the holder made the
   selection at that slot. For held-back and unresolved 2026 rights the
   outcome is the real, public 2026 Draft result, shown as a labeled
   SIMULATION assumption, because the world date is after that draft.
   2033 firsts enter the trading window. Contracts age by the existing
   season-advance rules.
2. **July 1, 2027 onward (to the 2032-33 season).** Each later draft is the
   simulated world's own future, so its order follows the owner's
   draft-order decision (lottery by default with an override, recommended).
   Cap levels after 2027-28 and the season calendars are named assumptions
   in the same list as the others.
3. **Every step.** All 30 teams' books stay reconciled and every
   held-back right is carried unchanged with its reason, until its draft
   year resolves it by a labeled outcome or it stays Blocked with the named
   missing fact.

Rookie-scale money when a pick conveys is C2. Until then the trade path
refuses the coming draft's firsts (the 2026 firsts on June 5, the 2027 firsts
on July 1), because trading them can change an unsigned first-round pick's
salary obligation.

## Status of part 1 (this PR)

- The step itself is built and tested as a pure function
  (`simulationSeasonStep.ts`): it resolves the 2026 Draft, drops the 37
  rights for 2026 from the inventory, carries every later right with its
  current holder, opens the 2033 firsts and moves the trading window to
  2027-2033. On the private package it gives 241 retained rights, 145
  admitted (136 - 18 for 2026 + 27 for 2033) and 20 unresolved mappings
  (the 9 tied only to 2026 are settled by the public draft result).
- The 2026 order was checked against the June 5 package: all 18 admitted
  2026 firsts have the same holder in the public record.
- Part 2 publishes the step on the server with the season advance and lets
  the draft loader read the stepped world.
