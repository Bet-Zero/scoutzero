# Architect CBA Canon v2.0 — R5 independent review

## Verdict

**FOCUSED REJECT / BLOCK-R6**

The exact R5 maker checkpoint
`c11285aa9811b45a0e0f9b7f6493c3a73e12181f` is mechanically coherent but
does not satisfy the complete source, coverage, atomicity, evidence, dependency,
and mapping standard. The signed CBA contradicts material active rules in every
family from C14 through C25, several required exceptions have no direct owner,
and many evidence locators do not resolve to the provisions paraphrased.

This is an affected-scope rejection, not a wholesale R5 restart. Repair and
re-review are limited to the rules, evidence, mappings, aggregates, and missing
owners identified below, plus any additional dependency impact demonstrated
during repair. R6, R7, Phase 2, Architect comparison, and application
implementation remain blocked and unstarted.

Checker: independent role `/root`

Review date: `2026-07-26`

R5 process input:
`f77d167e2f849ac1c4f33de3494252d4999ba46c`

Stable `main` observed:
`69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`

## Reviewed scope and source basis

The worktree was clean at review start. After a fresh fetch, local `HEAD`,
`FETCH_HEAD`, and `origin/architect/cba-canon-v2` all resolved to the exact
maker checkpoint. No R5 independent-review file or R6 work existed.

The checker independently reviewed:

- all 12 C14–C25 GROUPs;
- all 250 active direct or explicitly staged rules;
- all 250 evidence components, including each locator and stated result;
- relevant signed-CBA coverage for each family;
- atomicity, dependencies, aggregate `INFERRED` owners, and cross-half joins;
- all 79 published historical C14–C25 dispositions, comprising 78 R5 edges
  plus accepted `XW2-0154`; and
- the maker diff, receipt, governing plan, fragment inventory, crosswalk, and
  seven R5 decisions.

The controlling source was the signed 2023 NBA–NBPA CBA, 676 PDF pages,
2,850,534 bytes, SHA-256
`bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32`
(`SRC2-001`). The full relevant provisions were read rather than sampled.

## Blocking repair findings

### 1. C14 misstates Bird definitions, renunciation, compensation, and raises

Affected active rules:
`CBA2-C14.1`–`CBA2-C14.5`, `CBA2-C14.11`–`CBA2-C14.18`,
`CBA2-C14.22`, and `CBA2-C14.23`.

Affected evidence:
`EV2-0280`–`EV2-0284`, `EV2-0290`–`EV2-0297`,
`EV2-0301`, and `EV2-0302`.

Controlling provisions: Article I §1(t), (rr), and (yy), printed pages 3, 6,
and 7; Article VII §§4(g)(1), 5(a)(1)–(2), and 6(b)(1)–(3), printed pages
221–232; Article IX §1, printed page 295.

The definition locators are false: §1(r) defines a Designated Veteran Player
Extension, §1(aaa) defines the Regular Season, and §1(ggg) defines a Rookie
Free Agent. Renunciation eliminates Qualifying, Early Qualifying, and
Non-Qualifying status and limits the Team to Room, the Minimum Player Salary
Exception, or a Two-Way Contract; the current row names only the first two
Bird exceptions. The signed rescission route and its two Team Salary tests
also have no direct owner.

The Early Bird ceiling in `CBA2-C14.13` omits 175% of prior Unlikely Bonuses
and substitutes 105% of Estimated Average Player Salary for 105% of the prior
year's Average Player Salary or its specified estimated computation. The
Non-Bird ceiling in `CBA2-C14.16` omits 120% of prior Unlikely Bonuses.
Their maker locators also swap §6(b)(2) and §6(b)(3). The maximum-term claims
in `CBA2-C14.11`, `CBA2-C14.14`, and `CBA2-C14.17` require Article IX; the
cited §6(b) passages do not supply those maxima.

Finally, the annual-change rules do not reduce every amount to a percentage
of first-year Regular Salary. Article VII §5(a) separately tests Salary
excluding Incentive Compensation, Regular Salary, and each first-year bonus.

Required correction: use the exact definition owners; split and complete the
renunciation consequences and rescission exception; restore the signed Early
Bird and Non-Bird components; source term maxima to Article IX; and express
each annual-change basis separately.

Dependent impact: `XW2-0279`, `XW2-0280`, and `XW2-0282`–`XW2-0285` are not
truthful at their present targets. `CBA2-C14.22` and `CBA2-C14.23` inherit the
defects. Re-review the exact affected rules/evidence, any new renunciation
owners, those six mappings, and the two aggregates after repair.

### 2. C15 evidence is displaced and its notice chain is not atomic

Affected active rules for evidence adequacy:
`CBA2-C15.1`–`CBA2-C15.12`.

Affected active rule for atomicity: `CBA2-C15.11`.

Affected evidence: `EV2-0304`–`EV2-0315`.

Controlling provision: Article XI §5(b)–(d), printed pages 322–324.

The offering-Team Room rule is §5(b), and the matching-Team authority rule is
§5(c). The special one- and two-YOS Offer Sheet terms are §5(d)(i)–(iii).
The evidence instead cites nonexistent or wrong subdivisions such as
§5(b)(2), §5(b)(3), and §5(d)(1)–(3), often on printed pages 325–327 where the
claimed text does not appear.

`CBA2-C15.11` also combines two independently testable duties by different
actors: the ROFR Team's same-day written election and the NBA's one-business-day
relay to the Players Association.

Required correction: replace every locator with the exact §5(b), §5(c), or
§5(d)(i)–(iii) source and separate the Team notice deadline from the NBA relay
deadline.

Dependent impact: `CBA2-C15.12`, `EV2-0315`, `XW2-0288`, and `XW2-0289`
depend on the affected evidence or notice chain. Re-review this bounded C15
set and its two mappings after repair.

### 3. C16 has wrong sources, incomplete formulas, and missing rules

Affected active rules:
`CBA2-C16.2`–`CBA2-C16.7`, `CBA2-C16.9`, `CBA2-C16.15`,
`CBA2-C16.18`, `CBA2-C16.19`, `CBA2-C16.22`,
`CBA2-C16.25`–`CBA2-C16.34`, `CBA2-C16.36`, and `CBA2-C16.37`.

Affected evidence:
`EV2-0317`–`EV2-0322`, `EV2-0324`, `EV2-0330`,
`EV2-0333`, `EV2-0334`, `EV2-0337`, `EV2-0340`–`EV2-0349`,
`EV2-0351`, and `EV2-0352`.

Controlling provisions: Article I §1(fff)–(ggg), printed page 8; Article II
§7, printed pages 36–43; Article VII §§5(a), 6(n)(3), 7(a)–(b), and
8(e)(2)(ii), printed pages 226–228, 249–254, and 264; Article VIII §1,
printed pages 290–293; Article IX §1, printed page 295; Article XI §1; and
Article XXIX §6, printed pages 432 onward.

The Rookie Scale evidence repeatedly points to the wrong subsection.
The 80%–120% range is §1(c)(i); the January 10 reduction is §1(b)(i);
option timing and player notice are §1(a); the UFA consequence is in Article
XI; the declined-option salary restriction is Article VII §6(n)(3); and the
bonus/loan bar is §1(c)(i). `CBA2-C16.5` also adds notice to the NBA that the
signed option provision does not require.

Rookie Scale Extensions are governed by Article VII §7(b), not §7(a)(1).
`CBA2-C16.22` combines term and annual-change results and does not state the
Article IX aggregate maximum. The Article XXIX §6 locator in `EV2-0330` is
roughly fifty printed pages late.

For ordinary Veteran Extensions, `CBA2-C16.25` omits the required subtraction
of first-year extended Incentive Compensation from the 140%-of-EAPS branch;
`CBA2-C16.26` replaces the exact separate Likely and Unlikely Bonus caps with
an unimplementable reference to "signed" adjustments; and
`CBA2-C16.27` combines term and annual changes while misstating the term as a
flat four added Seasons instead of applying the Article IX aggregate limit.

The Designated Veteran Extension locators in `EV2-0343`–`EV2-0347` do not
support the stated eligibility, term, salary, trade, or incentive results.
`CBA2-C16.30` also combines a vague "designated term" with a separate first-
year salary verdict. `CBA2-C16.33` joins the direct Rookie Free Agent
definition to an inferred valid-mechanism conclusion and cites Article X
§1(b)(ii), which is draft eligibility rather than undrafted free-agent status.

Completeness also fails because Article VII §7(a) has no direct owners for:

- the three-year extension wait after a greater-than-10% Renegotiation;
- the bar after exercise of an ETO;
- the distinct exercised-Option and non-exercised-Option routes, including the
  two-added-Season minimum for the latter;
- projected Qualifying Veteran Free Agent status; and
- the ten-YOS 107.5% extension route.

Required correction: repair the direct source locators and notice recipient;
separate term, compensation, bonus, and annual-change verdicts; restore the
complete 140% formulas; register the missing §7(a) results; and separate the
Rookie Free Agent definition from the signing-mechanism inference.

Dependent impact: `CBA2-C16.34`, `CBA2-C16.36`, and `CBA2-C16.37` are not
complete. `XW2-0290`–`XW2-0293`, `XW2-0296`–`XW2-0303`, and `XW2-0324`
must be reconciled. Re-review those exact rules, evidence, mappings,
aggregates, and the new §7(a) owners; unchanged C16 direct owners need only
preservation comparison.

### 4. C17 omits a moratorium deadline and the recurring allocation result

Affected active rules: `CBA2-C17.3`, `CBA2-C17.8`, and `CBA2-C17.9`.

Affected evidence: `EV2-0355`, `EV2-0360`, and `EV2-0361`.

Affected mappings: `XW2-0305`, `XW2-0307`, and `XW2-0309`.

Controlling provision: Article VII §3(a)(2)(iii) and (vii), printed pages
199–200.

The moratorium birthday rule applies only when the birthday falls during the
Moratorium Period **and** the Contract, Extension, or Renegotiation is signed
no later than the fifth day after the Moratorium concludes. `CBA2-C17.3`
omits the signing deadline.

The recurring rule aggregates the current and subsequent two or fewer Salary
Cap Years and attributes equal shares to each on the applicable July 1.
`CBA2-C17.8` says only that attribution is "recomputed," which does not own
the required equal-share result.

Required correction: state both moratorium predicates and the complete
three-or-fewer-year equal-share allocation. Re-review the three rules, three
evidence rows, and three mappings after repair.

### 5. C18 misstates extension-bonus timing, allocation, and installments

Affected active rules:
`CBA2-C18.5`, `CBA2-C18.8`, `CBA2-C18.10`, and `CBA2-C18.12`.

Affected evidence for content or printed-page accuracy:
`EV2-0362`–`EV2-0374`.

Controlling provision: Article VII §3(b)(1)–(3), printed pages 200–205.

`CBA2-C18.5` uses "bonus paid at or above the Cap" where the predicate is the
Team's Team Salary at or above the Cap when it enters the Extension, and it
combines payment timing with allocation. `CBA2-C18.8` wrongly says the
signing year receives zero; the signed below-cap early-payment branch includes
the then-current signing year in the protected-percentage allocation and
assigns the whole bonus to that year if no relevant Base Compensation is
protected.

`CBA2-C18.10` says the two installments are equal. They instead equal the
portions allocated to the original and extended terms and can be unequal.
`CBA2-C18.12` collapses distinct assumed-Base-Compensation, installment-
deadline, and maximum-adjustment results into one vague sentence. All C18
printed-page locators are displaced from the actual 200–205 span.

Required correction: use the Team Salary predicate, preserve the signing year,
state the allocation-derived installment amounts, split the retained-trade-
bonus results, and correct the locators.

Dependent impact: `EV2-0374` and the source support behind `XW2-0311` require
reconciliation. Re-review the four substantive rules, the C18 evidence set,
any split owners, and that mapping; the meaning of unaffected C18 rules may be
confirmed by preservation comparison.

### 6. C19 changes Ten-Day duration, termination, and proration rules

Affected active rules:
`CBA2-C19.2`, `CBA2-C19.10`, `CBA2-C19.11`, `CBA2-C19.16`,
`CBA2-C19.18`, and `CBA2-C19.19`.

Affected evidence:
`EV2-0376`–`EV2-0386` and `EV2-0390`–`EV2-0393`.

Controlling provisions: Article I §1(kk), printed page 5; Article II §§9–10,
printed pages 48–50; Article IX §1, printed page 295.

A Ten-Day Contract covers the longer of ten days or three games **played** by
the Team, not three scheduled games. On termination, Article II §9(f) requires
payment of the sums stated in Exhibit 1A; it does not substitute the maker's
"earned through termination and expressly accrued" formula. Section 9(g)
bars only the same Team and player from entering a new Contract before the
stated term expires; `CBA2-C19.11` incorrectly bars the player from every NBA
Contract.

The remaining-days fraction in the Minimum Player Salary definition supplies
the minimum floor for a Rest-of-Season Contract. `CBA2-C19.16` overstates it
as the formula for every negotiated Rest-of-Season Salary.

The maker also assigns salary, count, hardship, final-game, termination, and
successor-contract rules to the wrong §9 subsections: the relevant sequence is
§9(b) through §9(h), not the cited §9(a) through §9(e). `EV2-0390` cites
Article I §1(eee), which is not the Minimum Player Salary definition.

Required correction: restore "games played," the Exhibit 1A payment result,
the same-Team successor bar, and the minimum-floor scope; then correct every
§9 and Article I locator.

Dependent impact: `XW2-0312`–`XW2-0316` and both C19 aggregates depend on
the affected results. Re-review that exact set after repair.

### 7. C20 changes Two-Way eligibility and conversion timing

Affected active rules:
`CBA2-C20.2`, `CBA2-C20.14`, `CBA2-C20.15`, `CBA2-C20.18`,
`CBA2-C20.20`, `CBA2-C20.22`, and `CBA2-C20.25`–`CBA2-C20.28`.

Affected evidence:
`EV2-0395`, `EV2-0407`, `EV2-0408`, `EV2-0411`, `EV2-0413`,
`EV2-0415`, and `EV2-0418`–`EV2-0421`.

Controlling provisions: Article II §11(b)–(g), printed pages 52–56, and
Article VII §4(j), printed page 225.

The general eligibility bar applies when the player has **or may have** four
or more YOS at any point during the Contract. The signing-time test in
`CBA2-C20.14` would wrongly permit a three-YOS player to sign a two-year
Two-Way. `CBA2-C20.15` does not state the four-YOS exception's required
no-game service year and continuous full-Regular-Season roster status.

The Standard Conversion Option remains exercisable until just before the
start of the final Regular Season game. `CBA2-C20.18` shortens that period by
one day. `CBA2-C20.25` leaves the first Regular Season day unrouted: the 50%
branch applies only to a Contract signed **after** that day.

`CBA2-C20.20` hides the conversion-day compensation result behind "as the
signed rule requires"; `CBA2-C20.22` joins the no-Exhibit-10 result to the
separate immediate-void result; and `CBA2-C20.26` replaces the precise
affiliate-play and same-Team Two-Way bars with "signed restrictions."
`CBA2-C20.27` cites nonexistent Article II §11(i) instead of §11(g).
`EV2-0395` does not itself establish the claimed Standard-slot exclusion, so
that rule needs a qualifying direct locator or an honest inferred treatment.

Required correction: use the whole-contract YOS test and exact four-YOS
exception; restore the final-game and first-day boundaries; state and separate
the conversion, replacement, protection, and exclusive-rights results; and
repair the source classification and locators.

Dependent impact: `CBA2-C20.28`, `XW2-0318`, `XW2-0319`, and
`XW2-0321`–`XW2-0324` require reconciliation. Re-review the listed active
rules/evidence, aggregate, and mappings after repair.

### 8. C21 has a false Exhibit 9 amount and incomplete Exhibit 10/Summer rules

Affected active rules:
`CBA2-C21.1`, `CBA2-C21.4`, `CBA2-C21.10`, `CBA2-C21.12`,
`CBA2-C21.14`, `CBA2-C21.15`, `CBA2-C21.18`, `CBA2-C21.20`,
`CBA2-C21.22`–`CBA2-C21.24`, and `CBA2-C21.30`.

Affected evidence:
`EV2-0422`, `EV2-0425`, `EV2-0426`, `EV2-0431`, `EV2-0433`,
`EV2-0435`, `EV2-0436`, `EV2-0439`, `EV2-0440`, `EV2-0441`,
`EV2-0443`–`EV2-0445`, and `EV2-0511`.

Controlling provisions: Article II §3(r)–(s), printed pages 20–23; Article II
§11(h), printed pages 56–58; Article VII §4(i)–(k), printed page 225; and
Uniform Player Contract Exhibit 9, Exhibit A printed page A-43.

Exhibit 9 fixes the qualifying injury termination payment at $15,000.
`CBA2-C21.4` and `EV2-0425` falsely make it cap-indexed and omit the
controlling signed Exhibit 9. The current aggregate therefore fails to
preserve the correct historical $15,000 obligation.

The Exhibit 10 interruption and affiliate-injury rows are too vague to
implement. The injury exception requires injury directly resulting from
affiliate play; it does not add unspecified "medical and roster
requirements." Conversion must not violate Article X §4(d), not generalized
Article X eligibility. The deemed-bonus acquisition rule concerns an acquired
Contract with a Conversion Protection Amount but no bonus, not an "acquired
converted" Contract.

The returning-rights notice is owed by a Team other than the Returning Rights
Team before contracting, with a copy to the Players Association and a minimum
$25,000 fine. `CBA2-C21.20` assigns it to the "designating Team" and omits
those exact terms. The source requires the player to sign with the NBAGL, be
initially assigned **by the NBAGL**, and timely report; it does not require
the waiving NBA Team to designate the player as stated by `CBA2-C21.30`.

`CBA2-C21.22` also overstates Summer Contract retention as allowing any
applicable exception. Article VII §4(i) permits only Room or the Minimum
Player Salary Exception.

Completeness fails because no direct owner states:

- an Exhibit 10 bonus is permitted only if the Team has an NBAGL affiliate at
  execution;
- the alternative Designating Team payment conditions;
- conversion of a combined Exhibit 9/10 Contract voids Exhibit 9;
- Summer Contract pre-Regular-Season compensation and protection limits; or
- the one-Season/minimum restriction for a Veteran Free Agent who last played
  for the Team.

Required correction: restore the fixed Exhibit 9 amount and source; state the
exact Exhibit 10 actors, predicates, results, notice, and fine; narrow Summer
retention; and add atomic owners for the missing provisions.

Dependent impact: `CBA2-C21.23`, `CBA2-C21.24`, `XW2-0326`,
`XW2-0327`, `XW2-0331`–`XW2-0333`, `XW2-0335`, and `XW2-0336`
require reconciliation. Re-review those exact items and the new direct owners
after repair.

### 9. C22 changes protection progression and collapses annual-change bases

Affected active rules:
`CBA2-C22.1`, `CBA2-C22.2`, and `CBA2-C22.7`–`CBA2-C22.14`.

Affected evidence:
`EV2-0446`, `EV2-0447`, `EV2-0452`–`EV2-0456`, and
`EV2-0515`–`EV2-0517`.

Controlling provisions: Article II §4(i), printed pages 28–29; Article II
§7(c), printed pages 38–40; and Article VII §5(a), printed pages 226–228.

Future protection generally may not exceed the unearned protected percentage
of **any** prior Season. `CBA2-C22.1` and `CBA2-C22.2` narrow that comparison
to the immediately preceding Season.

In the future-maximum reduction sequence, the second tier is the pro rata
reduction of first-year extended Likely and Unlikely Incentive Compensation,
not generic "bonus compensation." Later signing-bonus allocations are reduced
proportionally, but later Likely Bonuses, Unlikely Bonuses, and Base
Compensation are modified only as needed to comply with annual-change limits.
`CBA2-C22.8` incorrectly makes all later annual amounts proportional.

The ordinary and eight-percent annual-change provisions separately test:

- Salary excluding Incentive Compensation against first-year Salary excluding
  Incentive Compensation;
- Regular Salary against first-year Regular Salary; and
- each bonus against that bonus's first-year amount.

`CBA2-C22.12`–`CBA2-C22.14` instead use first-year Regular Salary as the
single denominator. The direct evidence also places §4(i) on printed pages
31–32 instead of 28–29 and the ordinary §5(a)(1) rule on page 227 instead of
226.

Required correction: restore the any-prior-Season comparison, exact reduction
categories and later-year treatment, and all three annual-change bases.

Dependent impact: `CBA2-C22.9`, `CBA2-C22.11`, `XW2-0337`,
`XW2-0339`, and `XW2-0340` fail with these owners. The same basis error
demonstrably affects `CBA2-C14.12`, `CBA2-C14.15`, `CBA2-C14.18`,
`CBA2-C16.22`, and `CBA2-C16.27`. Re-review the exact C22 set and those five
cross-family rules after repair.

### 10. C23 has unsupported locators and changes life insurance to disability

Affected active rules for content or evidence adequacy:
`CBA2-C23.1`, `CBA2-C23.3`, `CBA2-C23.5`–`CBA2-C23.8`,
`CBA2-C23.15`–`CBA2-C23.17`.

Affected evidence:
`EV2-0457`, `EV2-0459`, `EV2-0461`–`EV2-0464`, and
`EV2-0471`–`EV2-0473`.

Controlling provisions: Article II §4(j)(ii), printed pages 29–30; Article II
§12(a)(i)–(iii), printed page 58; Article VII §§3(g) and 5(b)(1), printed
pages 210 and 228–229; and Article XXV §1, printed page 418.

`CBA2-C23.15` and `EV2-0471` say qualifying disability-insurance premiums
are excluded from Salary. The signed provision excludes qualifying **life**
insurance premium reimbursement under Article II §4(j)(ii).

`CBA2-C23.3` leaves the extension proviso as an undefined "exact" rule rather
than stating that the first extended year may carry the signing-year excess
percentage. The Offer Sheet signing-bonus cap is Article II §12(a)(iii), not
§12(a)(ii). The deferred-compensation locators place Article XXV §1 on
printed pages 431–432; it is printed page 418. The Article II §12 rules are
printed page 58, not 59.

Required correction: restore life-insurance treatment and its prerequisites;
state the extension proviso; and correct the signing-bonus, deferral, and
printed-page locators.

Dependent impact: `CBA2-C23.16`, `CBA2-C23.17`, and
`XW2-0341`–`XW2-0346` depend on affected evidence or content. Re-review
those exact rules/evidence, two aggregates, and six mappings after repair.

### 11. C24 misstates option protection, deadlines, notices, and ETO coverage

Affected active rules:
`CBA2-C24.3`, `CBA2-C24.5`, `CBA2-C24.7`, `CBA2-C24.8`,
`CBA2-C24.10`–`CBA2-C24.17`.

Affected evidence: `EV2-0474`–`EV2-0490`.

Controlling provision: Article XII §§1–5, printed pages 336–338.

`CBA2-C24.5` states the unchanged-terms rule absolutely instead of making the
Second Round Pick Exception Team Option carveout explicit. The Player Option
alternatives do not create a generic structure where protection "attaches
only after the last game." Under alternative B, there is no pre-exercise
protection and the Option cannot be exercisable before the day after the last
game.

Article XII §4 sets the June 29 5 p.m. deadline. The evidence does not support
`CBA2-C24.8`'s added "unless the Contract validly states an earlier date."
Article XII §5 requires the NBA to forward copies of notices it receives to
the Players Association within two business days; it does not by itself
supply the broad Team/player written-notice duty in `CBA2-C24.15`.

The ETO term, count, and amendment rules are in §2(b), while unconditionality
is §3. The maker assigns many of them to nonexistent §3(a), §4(a), or §4(b)
subsections and cites pages 339–340, which are Article XIII. Completeness
also fails because no direct owner states that a Contract signed without an
ETO may not be amended to add one during its original term.

Required correction: qualify unchanged terms with the exact carveout; state
the two Player Option protection alternatives; remove or independently source
the earlier-date clause; own only the notice duty actually established by
qualifying authority; correct all §2–§5 locators; and add the missing ETO
amendment bar.

Dependent impact: `CBA2-C24.16`, `CBA2-C24.17`, `XW2-0294`, and
`XW2-0347`–`XW2-0353` require reconciliation. Re-review that exact set and
the new ETO owner after repair.

### 12. C25 overgeneralizes retired-player treatment and changes grievance duties

Affected active rules for content or evidence adequacy:
`CBA2-C25.1`–`CBA2-C25.13`.

Affected active rules for substantive text:
`CBA2-C25.3`, `CBA2-C25.9`, `CBA2-C25.10`, and `CBA2-C25.11`.

Affected evidence:
`EV2-0491`–`EV2-0501`, `EV2-0527`, and `EV2-0528`.

Controlling provisions: Article VII §4(a)(1)(ii)–(iv), printed pages 212–216,
and Article XIII §5, printed pages 344–346.

The maker cites §4(a)(2)(ii) and §4(a)(6)–(9), which do not correspond to the
retirement, grievance, or pending-contract passages. It also locates Article
XIII §5 on printed pages 356–357 instead of 344–346.

`CBA2-C25.3` turns Article XIII §5's bounded retired-player transaction
conditions and adjudicated excess-value result into a generic rule for any
arrangement "found to circumvent" the CBA. `CBA2-C25.9` says only "pro rata"
and omits that a multi-Season resolution is allocated in proportion to the
Compensation disputed for each Season unless the arbitrator specifies the
allocation.

On a grievance settlement, the Team must immediately email the NBA and
provide the terms. The source does not require the Team to notify the Players
Association as claimed by `CBA2-C25.10`. A delay intended to create or
increase Room or reduce or defer tax **constitutes** an Article XIII
violation; it is not merely something that "may be recharacterized" as stated
by `CBA2-C25.11`.

Required correction: use the exact §4(a)(1) and Article XIII §5 locators;
narrow retired-player imputation to the signed predicates and valuation
result; state the grievance allocation basis, NBA-only settlement notice, and
mandatory circumvention consequence.

Dependent impact: `CBA2-C25.12`, `CBA2-C25.13`, and `XW2-0354`–`XW2-0356`
depend on the affected rules. Re-review all C25 evidence, the four substantive
rules, both aggregates, and those three mappings after repair; unchanged C25
direct text may otherwise be checked for preservation.

## Historical dispositions and positive conclusions

All 79 published C14–C25 rows are mechanically dispositioned. That population
is complete, but the mappings cited in the findings above are not
semantically truthful until their current owners are repaired.

The following scrutinized classifications and direct owners pass:

- `XW2-0310` correctly classifies historical `CBA-C17.7` as a process-only
  implementation-input statement.
- `XW2-0317` correctly classifies historical `CBA-C19.6` as process-only.
  The actual January 5 rule has direct owner `CBA2-C19.1` / `EV2-0375`.
- `XW2-0325` correctly classifies historical `CBA-C20.9` as process-only.
  The actual March 4 rule has direct owner `CBA2-C20.17` / `EV2-0410`.
- Accepted `XW2-0154` correctly preserves the Two-Way trade-salary and
  Traded Player Exception exclusion in `CBA2-A02.14`; R5 did not need to
  duplicate it.

These passing conclusions do not cure the affected C14–C25 owners or unblock
R6.

## Mechanical results

The complete-document validator exercised all 14 accepting and 109 rejecting
controls. Every control produced its expected result, and the negative
self-test failed as intended. It reported the maker populations:

- 37 GROUPs;
- 521 active LEAF-main and 521 LEAF-detail rows, including 250 R5 rules;
- 351 XW2 edges;
- 529 EV2 components;
- 123 DR2 records; and
- 341 historical fragments.

The command exits 1 solely because the same seven simplified-plan versus
stale-validator wording diagnostics already present at
`f77d167e2f849ac1c4f33de3494252d4999ba46c` make `baseline_clean=NO`.
No R5-local mechanical failure appeared. Those inherited diagnostics were not
repaired and are neither evidence for nor against source accuracy.

## Validation actually run

- Fresh `git fetch origin architect/cba-canon-v2` and exact local/fetched/
  tracking-ref comparison — PASS at the pinned maker commit before writing.
- Signed-CBA byte count and SHA-256 — PASS at 2,850,534 bytes and the expected
  `bf178ca0...f7ab32` digest.
- Independent full C14–C25 rule/evidence/crosswalk parse and count checks —
  PASS mechanically: 12 GROUPs, 250 active rules, 250 joined evidence
  components, and 79 historical dispositions.
- `python3
  work/architect-completion/cba_canon_v2_foundation_validator.py` — all 123
  controls PASS; process exit 1 only for the seven inherited plan diagnostics
  described above.
- Targeted Markdown lint on this review file — PASS.
- `npm run docs:guardrails` — PASS.
- `npm run validate:project` — PASS.
- `git diff --check` — PASS.
- Pre-commit scope check — exactly this independent-review file is new; no
  canon, plan, validator, graph, source, application, test, configuration, data,
  Linear, R6, or `main` change occurred.

Application builds, application test suites, typecheck, lint, schema commands,
and the full suite were intentionally skipped because this is a
documentation-only independent source review and the task explicitly
prohibits application builds and test suites. `graphify update .` was skipped
because graph output is outside the one-file authorization.

## Required next checkpoint

The maker must repair only the cited rules, evidence, mappings, aggregates,
and demonstrated missing owners in the authorized maker surfaces, preserve
governed identities and unaffected meaning, and commit and push a new clean
R5 maker checkpoint. A separate independent checker must re-review the exact
affected scope identified above and confirm preservation of unaffected R5
material.

This review does not modify canon content, does not accept R5, and does not
authorize or start R6.
