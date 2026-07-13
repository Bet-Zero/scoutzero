# Architect — External-Truth Audit of the Cap Engine (BZE-255)

**Read-only diagnostic. No code, data, or constants were changed. No emulator, scrape, push, or Firestore pipeline was run.**

- **Date:** 2026-07-12
- **Repo state:** branch `main`, commit `40d5e192`
- **Active season audited:** 2026-27 (world date ~July 2026)
- **Method:** every real-world NBA number and rule below was compared to an authoritative public source, cited with a link and a date. Each rule was **worked by hand with a small example**. **No passing test was accepted as evidence of correctness** — the tests were assumed to pin whatever the code does.

---

## ONE-LINE VERDICT

**Trust the trade machine and the league constants; do not trust anything involving free agents.** The 2026-27 rulebook numbers are exact and the trade math is now correct, but the free-agency machinery — **cap holds, the empty-roster charge, qualifying offers, hard-cap triggers, and the supermax** — is wrong in a way that *systematically overstates what a team already owes and understates how much room it has to spend*. Because Architect is fundamentally an offseason tool, this is the load-bearing part of the product.

**Single biggest risk: cap space is wrong for essentially every team in the offseason.** Two independent bugs push in the same direction — a star free agent's placeholder is roughly **$20M too big**, and the tool reserves money for **14 empty roster spots when the rules only reserve 12**. A user planning a summer sees materially less money than they actually have.

**Score: 24 checks PASS, 20 WRONG, 5 CAN'T-VERIFY.**

---

## What this audit is, and why the last one missed these

Every prior review asked *"does it work, is it consistent, do the tests pass?"* — a **closed loop**. The system checked itself against itself and passed honestly. That is exactly how BZE-253's two bugs survived for years: the code agreed with the tests agreed with the constants.

This audit asked a different question: **is the code right about the real world?** Every number below was checked against a public source outside the codebase. That is the only method that can catch this class of bug.

**It worked.** One of the findings below (the empty-roster charge, #1) was explicitly marked **PASS** by the BZE-253 audit six weeks ago. It is wrong. It passed then because the reviewer read the code, found it coherent, and agreed with it. Working the example by hand against a cited source produced the opposite answer.

---

## FULL CHECK TABLE

**Root cause key:** `DATA` = a hand-typed number/table is wrong → fix by re-sourcing the value. `ENGINE` = the rule/formula itself is wrong → fix in code.
**Severity:** `HIGH` = wrong answers on the main workflow today. `MED` = wrong answers in a common case. `LOW` = inert, cosmetic, or edge-case.

### A. Cap holds and roster charges — *the free-agency core*

| # | Rule | Code value | Source value | Result | Sev. | Cause |
|---|---|---|---|---|---|---|
| 1 | **Empty-roster ("incomplete roster") charge** | rookie min × slots below **14** | rookie min × slots below **12** | **WRONG** | **HIGH** | ENGINE |
| 2 | **Bird-rights cap hold** | **190% always** | 190% if prior salary **below** league average; **150% if at/above** | **WRONG** | **HIGH** | ENGINE |
| 3 | **Cap-hold ceiling** | none | "No cap hold can exceed the maximum salary for which a player can sign" | **WRONG (missing)** | **HIGH** | ENGINE |
| 4 | **Minimum-salary player's cap hold** | that player's min × **1.2** | the flat **two-year veteran minimum** (one-year min if he has 1 YOS) | **WRONG** | **MED** | ENGINE + DATA |
| 5 | **Unsigned 1st-round pick hold — multiplier** | 120% of rookie scale | 120% of rookie scale | **PASS** | — | — |
| 6 | **Unsigned 1st-round pick hold — the scale table** | unsourced round numbers (#1 = $12,720,000), one season only | real 2026-27 scale (#1 = $12,290,000 at 100%) | **WRONG** | **MED** | DATA |
| 7 | Early Bird cap hold | 130% of prior salary | 130% of prior salary | **PASS** | — | — |
| 8 | Non-Bird cap hold | 120% of prior salary | 120% of prior salary | **PASS** | — | — |

### B. Bird rights

| # | Rule | Code value | Source value | Result | Sev. | Cause |
|---|---|---|---|---|---|---|
| 9 | Seasons to qualify (Bird / Early / Non) | 3 / 2 / 1 | 3 / 2 / 1 | **PASS** | — | — |
| 10 | Full Bird: length, raises, ceiling | 5 years, 8% raises, up to max | 5 years, 8% raises, up to max | **PASS** | — | — |
| 11 | Early Bird: max first-year salary | greater of 175% prior or 105% of league average | greater of 175% prior or 105% of league average | **PASS** | — | — |
| 12 | Early Bird: length + raises | 4 years max, 8% | 4 years max, 8% | **PASS** | — | — |
| 13 | Early Bird: **minimum 2-season length** | not enforced | contracts "must run for at least two years" | **WRONG (missing)** | **LOW** | ENGINE |
| 14 | Non-Bird max | 120% of prior salary only | 120% of prior salary **or 120% of the minimum**, whichever is greater | **WRONG (partial)** | **LOW** | ENGINE |
| 15 | Non-Bird fallback when no prior salary | **50% of the league average** (invented) | no such rule exists | **WRONG** | **LOW** | ENGINE |

### C. Maximum salary and the supermax

| # | Rule | Code value | Source value | Result | Sev. | Cause |
|---|---|---|---|---|---|---|
| 16 | **Max salary tiers** | 25% / 30% / 35% of cap | 25% / 30% / 35% → **$41,240,250 / $49,488,300 / $57,736,350** for 2026-27 | **PASS (exact)** | — | — |
| 17 | 105%-of-prior-salary max path | present | present | **PASS** | — | — |
| 18 | Raises: own team vs new team | 8% / 5% | 8% / 5% | **PASS** | — | — |
| 19 | **Supermax criteria (legacy path)** | **any** MVP/DPOY/All-NBA in the last 3 seasons | All-NBA and/or DPOY **in the most recent season, or 2 of the last 3**; MVP in any of the last 3 | **WRONG (too lenient)** | **MED** | ENGINE |
| 20 | **Supermax criteria (RuleContext path)** | hardcoded `return false` + `TODO` — **nobody is ever eligible** | see above | **WRONG (stub)** | **MED** | ENGINE |
| 21 | Supermax service requirement | `>= 7` years, no upper bound | 7-8 years (extension); 8-9 years (as a free agent) | **WRONG (partial)** | **LOW** | ENGINE |
| 22 | **Supermax team-continuity requirement** | absent | ineligible if traded after his first 4 years, or ever changed teams via free agency | **WRONG (missing)** | **MED** | ENGINE |
| 23 | Legacy `CBA_THRESHOLDS` max rows | labeled **30% / 35% / 40%** of cap | 25% / 30% / 35% | **WRONG** | **LOW** (inert — never read; grep-confirmed) | DATA |

### D. Extensions

| # | Rule | Code value | Source value | Result | Sev. | Cause |
|---|---|---|---|---|---|---|
| 24 | **Veteran extension — the money** | greater of 140% of prior salary or 140% of league average | greater of 140% of prior salary or 140% of the estimated average salary | **PASS** | — | — |
| 25 | **Veteran extension — length** | flat **4 new years** | total contract ≤ **5 seasons including years remaining** | **WRONG (simplified, too lenient)** | **MED** | ENGINE |
| 26 | **Rookie-scale extension — length** | 4 years | up to **5 years** | **WRONG** | **MED** | ENGINE |
| 27 | Rookie extension — 25% / 30% "Higher Max" | 25%, 30% if award criteria met | correct structure, but inherits the too-lenient criteria of #19 | **WRONG (inherits #19)** | **MED** | ENGINE |
| 28 | Designated Veteran extension — 35%, 5 years | 35% of cap, 5 years | 35% of cap, 5 years | **PASS** | — | — |
| 29 | Renegotiation rules | present but unaudited | — | **CAN'T-VERIFY** | — | — |

### E. Restricted free agency

| # | Rule | Code value | Source value | Result | Sev. | Cause |
|---|---|---|---|---|---|---|
| 30 | **Veteran QO percentage** | 135% (contracts signed 2023+) / 125% (pre-2023) | 135% / 125% | **PASS** | — | — |
| 31 | **Veteran QO floor** | the minimum salary | **the minimum salary + $200,000** | **WRONG** | **LOW-MED** | ENGINE |
| 32 | **Rookie-scale QO — the gradient** | lottery **+30%**, picks 15-20 **+27%**, picks 21-30 **+25%** | **#1 pick 130%**, sliding **up** to **#30 pick 150%** (140%→160% from 2027) | **WRONG (inverted)** | **MED-HIGH** | ENGINE |
| 33 | **Starter criteria** (raises/lowers the QO) | **absent** | top-14 pick who misses it drops to 120% of the 15th-pick amount; picks 10-30 who meet it rise to 120% of the 9th-pick amount | **WRONG (missing)** | **MED** | ENGINE |
| 34 | **Gilbert Arenas provision** (offer sheets to 1-2 YOS players) | **absent** (zero references in the codebase) | year 1 capped at the non-taxpayer MLE; year 3 to the max; offering team needs room for the 4-year average | **WRONG (missing)** | **MED** | ENGINE |
| 35 | QO tender deadline / withdrawal / acceptance | June 29 / July 13 / Oct 1 | June 29 (5pm) / July 13 / Oct 1 | **PASS** | — | — |
| 36 | Offer-sheet match window | 48 hours | 1-2 days (11:59pm ET next day if received before noon; second day if after) | **PASS** (nuances unmodeled) | LOW | — |
| 37 | Two-way QO amounts | absent | 2026-27 partial guarantee ~$91,000 / $109,200 | **WRONG (missing)** | **LOW** | DATA |

### F. Hard cap and the aprons

| # | Rule | Code value | Source value | Result | Sev. | Cause |
|---|---|---|---|---|---|---|
| 38 | **First-apron trigger — non-taxpayer MLE** | yes | yes | **PASS** | — | — |
| 39 | **First-apron trigger — bi-annual exception** | yes | yes | **PASS** | — | — |
| 40 | **First-apron trigger — acquiring via sign-and-trade** | yes | yes | **PASS** | — | — |
| 41 | First-apron trigger — using the **expanded traded player exception** | **absent** | triggers a first-apron hard cap | **WRONG (missing)** | **MED** | ENGINE |
| 42 | First-apron trigger — using a **TPE from a prior offseason/season** | **absent** | triggers a first-apron hard cap | **WRONG (missing)** | **MED** | ENGINE |
| 43 | First-apron trigger — MLE used to **acquire via trade or waiver claim** | **absent** | triggers a first-apron hard cap | **WRONG (missing)** | **LOW-MED** | ENGINE |
| 44 | First-apron trigger — **signing a waived player** whose pre-waiver salary exceeded the NTMLE ($15,044,000) | **absent** | triggers a first-apron hard cap | **WRONG (missing)** | **LOW-MED** | ENGINE |
| 45 | **Second-apron hard cap — taxpayer MLE** | **NEVER FIRES.** `checkIfActionTriggersHardCap()` can only return `'FirstApron'` | using any portion of the MLE to **sign** a player hard-caps at the **second apron** ($221,686,000) | **WRONG** | **HIGH** | ENGINE |
| 46 | Second-apron hard cap — aggregating players in a trade | absent | triggers a second-apron hard cap | **WRONG (missing)** | **MED** | ENGINE |
| 47 | Second-apron hard cap — sending out cash | absent | triggers a second-apron hard cap | **WRONG (missing)** | **MED** | ENGINE |
| 48 | Second-apron hard cap — S&T-out salary used to match | absent | triggers a second-apron hard cap | **WRONG (missing)** | **LOW-MED** | ENGINE |

> **Coverage:** the code implements **3 of 7** first-apron triggers and **0 of 4** second-apron triggers. The `'SecondApron'` code branch exists in `wouldExceedHardCap()` and `getHardCapLimit()` — but nothing anywhere ever sets it. It is unreachable.

### G. Trades — timing, cash, picks, BYC

| # | Rule | Code value | Source value | Result | Sev. | Cause |
|---|---|---|---|---|---|---|
| 49 | **Cash limit in trades (2026-27)** | **no 2026-27 row** → silently falls back to **$7,000,000** | **$8,495,000** sent, **$8,495,000** received (separate limits) | **WRONG** | **MED** | DATA |
| 50 | Cash: send and receive as separate buckets | modeled as one limit | two separate limits | **WRONG (simplified)** | **LOW** | ENGINE |
| 51 | **Base Year Compensation** | `BYC_PERCENT = 0.5` exists but is **never used**; only carried as a boolean | outgoing salary counts at 50% in qualifying sign-and-trades | **WRONG (missing)** | **MED** | ENGINE |
| 52 | Stepien rule — no consecutive future unprotected 1sts | enforced | enforced | **PASS** | — | — |
| 53 | Stepien — 7-year limit on trading picks | enforced | enforced | **PASS** | — | — |
| 54 | Stepien — second-apron "frozen" 7-year-out pick | enforced (simplified) | real rule keys off being over the 2nd apron in a specific number of recent seasons | **PASS (simplified)** | LOW | ENGINE |
| 55 | Roster limits (15 standard / 3 two-way) | 15 / 3 | 15 / 3 | **PASS** | — | — |
| 56 | Two-way salary + 50-game rules | **no two-way salary constant exists** | **$678,882** for 2026-27 (half the rookie minimum) | **WRONG (missing)** | **MED** | DATA + ENGINE |
| 57 | Trade deadline / moratorium | hardcoded Feb 8 / July 1-6 | deadline is a specific date each year (~early Feb, 3pm ET); moratorium ends July 6, 12:01pm ET | **PASS (approximated)** | LOW | ENGINE |
| 58 | Reacquisition bar | 1 year after a trade; July 1 after a waiver | plausible, could not source precisely | **CAN'T-VERIFY** | — | — |
| 59 | Salary-matching tiers are season-blind | one flat 2026-27 value for all seasons | should be cap-indexed per season | **WRONG** — already tracked as **BZE-257** | MED | ENGINE |
| 60 | TPE creation amounts / expiry mechanics | present | — | **CAN'T-VERIFY** (not worked by hand — see coverage) | — | — |

### H. The hand-typed constant tables

| # | Rule | Code value | Source value | Result | Sev. | Cause |
|---|---|---|---|---|---|---|
| 61 | **2026-27 league constants (14/14)** | cap $164,961,000; tax $200,428,000; aprons $209,015,000 / $221,686,000; floor $148,465,000; MLEs $15,044,000 / $6,064,000 / $9,366,000; BAE $5,477,000; full minimum scale | identical | **PASS (exact)** — re-confirmed, not re-derived (BZE-253) | — | — |
| 62 | **`DEFAULT_AVERAGE_SALARY = $11,100,000`** — labeled "2024-25 value", **never updated, and always the live value** (no season supplies `averageSalary`) | $11,100,000 | could not source the exact 2026-27 CBA "Estimated Average Player Salary"; the cap has risen ~17% since 2024-25, so this is stale regardless | **WRONG (stale)** / value **CAN'T-VERIFY** | **MED-HIGH** | DATA |
| 63 | **`rookieScale.ts` — no 2026-27 data at all** | only 2024-25; `getRookieScaleAmount('2026-27', 1)` returns **`null`** | 2026-27 #1 pick = **$14,748,000** (120%) | **WRONG (missing season)** | **HIGH** | DATA |
| 64 | **`capProjections['2024-25']` flagged `confirmed: true`** | cap $141,000,000 / tax $171,000,000 / apron1 $179,000,000 / apron2 $190,000,000 | $140,588,000 / $170,814,000 / $178,132,000 / $188,931,000 | **WRONG (guesses labeled confirmed)** | **MED** | DATA |
| 65 | `capProjections['2024-25']` exceptions | BAE $4,700,000; room MLE $8,000,000; full MLE $12,900,000; taxpayer MLE $5,000,000 | $4,189,000 / $8,008,000 / $12,860,000 / $5,204,000 (the **correct** figures already exist in `CBA_THRESHOLDS` in the same repo — two tables disagree) | **WRONG** | **MED** | DATA |
| 66 | **`capProjections['2024-25'].rookieMin` flagged `rookieMinSource: 'real'`** | $1,119,563 | that is the **2023-24** figure; 2024-25 was **$1,157,153** | **WRONG (mislabeled 'real')** | **MED** | DATA |
| 67 | **`capProjections['2025-26'].rookieMin` flagged `'real'` + `confirmed: true`** | $1,164,345 | a ~4% projection; the real 2025-26 rookie minimum is ≈**$1,272,870** (~8.5% higher) | **WRONG (guess labeled real)** | **MED** | DATA |
| 68 | **`MINIMUM_SALARY_SCALES['2024-25']`** | 0 yr $1,119,563 · 2 yr $2,092,400 · 10+ yr **$3,800,000** | 0 yr **$1,157,153** · 2 yr **$2,087,519** · 10+ yr **$3,303,771** (code is **+15%** on the 10+ rung) | **WRONG** | **MED** | DATA |
| 69 | `MINIMUM_SALARY_SCALES['2025-26']` | labeled "~4% projection" | real scale exists | **WRONG (known)** | **MED** | DATA |
| 70 | `MINIMUM_SALARY_SCALES['2026-27']` (the **active** season) | full scale, rookie $1,357,763 … 10+ $3,876,529 | identical | **PASS (exact)** | — | — |
| 71 | **`capYearData.ts` REAL/PROJECTED labels** | REAL only through **2024-25** → so **2026-27 is labeled PROJECTED** and the guessed 2024-25 numbers are labeled **REAL** | 2026-27 is official (set 2026-06-30); 2024-25 in this repo is guesses | **WRONG (both backwards)** | **MED** | DATA |
| 72 | 2027-28 → 2031-32 projections (`confirmed: false`) | compounded ~5.5% growth | honestly labeled as projections | **PASS (honest)** | — | — |
| 73 | Future-season minimum scales | `getMinimumSalaryScale()` falls back to the latest scale → 2027-28+ silently reuse **2026-27** minimums flat | minimums escalate with the cap each year | **WRONG (simplified)** | **LOW** | ENGINE |

---

## The findings that matter, in plain language

### 1. The tool thinks teams have less money than they do — two bugs, same direction

**A star free agent's placeholder is ~$20M too big.** When a player's contract expires, the rules make his old team keep a **placeholder** ("cap hold") on the books until they either re-sign him or let him go. The size of that placeholder depends on his old salary. The tool always uses **190%** of it. The real rule is 190% only for players who earned *below* the league average — for anyone *at or above* average, it's **150%**.

> **Worked example.** A Bird free agent coming off **$50,000,000**.
> - Tool: 50,000,000 × 1.90 = **$95,000,000** placeholder.
> - CBA: 50,000,000 × 1.50 = **$75,000,000** placeholder.
> - **The tool holds $20,000,000 too much against the team.** It's also above the league maximum salary for 2026-27 ($57,736,350) — a hold the CBA explicitly forbids, since "no cap hold can exceed the maximum salary for which a player can sign." The tool has no such ceiling.

**Every empty roster spot is over-charged.** Teams with an unfilled roster get charged a placeholder for each missing player. The tool charges up to **14** players. **The rule is 12.**

> **Worked example.** A team with 10 players under contract, 2026-27 (rookie minimum $1,357,763).
> - Tool: (14 − 10) = 4 slots × $1,357,763 = **$5,431,052** charged.
> - CBA: (12 − 10) = 2 slots × $1,357,763 = **$2,715,526** charged.
> - **The tool overstates team salary by $2,715,526** — and therefore understates cap space by the same amount. On a completely empty roster the gap is **$2,715,526** ($19,008,682 vs. $16,293,156).

These stack. A rebuilding team with cap space and a good free agent is told it can spend millions less than it actually can — which is the single decision the tool exists to support.

> **This one is the proof that closed-loop review fails.** The BZE-253 audit marked the empty-roster charge **PASS** six weeks ago. It read the code, found it coherent, and agreed. It never checked the number against a source.

### 2. Minimum-salary free agents are charged nearly double

For a min-salary free agent, the tool takes his minimum and multiplies by 1.2. The real rule is simply the **two-year veteran minimum**, flat.

> **Worked example.** An 8-year veteran on a minimum deal, 2026-27.
> - Tool: its own (guessed) min table gives $3,400,000 → × 1.2 = **$4,080,000**.
> - CBA: the two-year veteran minimum = **$2,449,421**.
> - **Overstated by $1,630,579** — on a player who is, by definition, the cheapest kind. Teams carry several of these.
>
> Two errors compound here: the wrong multiplier *and* a stale, hand-guessed minimum-salary table.

### 3. Going over the second apron is impossible in the tool

The tool tracks the second apron ($221,686,000) and knows what it means — but **nothing in the code can ever put a team under a second-apron hard cap.** The function that decides this can only ever return "first apron." The branch that handles the second apron exists but is unreachable dead code.

Concretely: **using the taxpayer mid-level exception should hard-cap a team at the second apron.** In Architect, it hard-caps nobody. The same is true for aggregating players in a trade, sending cash, and sign-and-trade salary matching. The tool will happily let a team blow past a ceiling the real NBA would have locked.

The first apron is better but incomplete: 3 of the 7 real triggers are implemented.

### 4. Qualifying offers to late first-round picks are backwards

When a first-round pick's rookie contract ends, his team makes him a "qualifying offer" to keep matching rights. The real rule: the **#1 pick** gets **130%** of his last salary, sliding **up** to **150%** for the **#30 pick**. Later picks get the *bigger* bump — that's the whole point (their rookie salaries are small).

The tool has it **inverted**: lottery picks get the biggest bump (+30%), late first-rounders the smallest (+25%). So it lowballs exactly the players the rule was written to protect. It also completely omits the **"starter criteria"** adjustment, which can swing a qualifying offer by millions.

### 5. The supermax is broken in two opposite directions at once

The tool has two code paths for deciding if a player qualifies for a 35% "supermax":
- The **old path** grants it to *anyone* with any All-NBA/MVP/DPOY award in the last 3 seasons. The real rule is much stricter (award in the *most recent* season, or 2 of the last 3) and requires the player to have never been traded after year 4 or changed teams in free agency. **Too lenient — it hands out supermaxes that don't exist.**
- The **newer path** is an unfinished stub with a `TODO` that **always says "not eligible."** **No player can ever get a supermax through it.**

Neither is right, and which one you get depends on how the code is called.

### 6. Rookie contracts have no data for this season

`rookieScale.ts` contains **only 2024-25**. Ask it for a 2026 first-round pick's salary and it returns **nothing**. The 2026 #1 pick (AJ Dybantsa) should be at **$14,748,000**. Meanwhile, draft-pick *cap holds* are computed from a *different*, unsourced, round-number table (`capHolds.ROOKIE_SCALE`) that matches neither the real 2024-25 scale (which the repo already has, correctly, in the other file) nor the 2026-27 one:

| Pick | Tool's cap hold | Real 2026-27 hold | Error |
|---|---|---|---|
| 1 | $15,264,000 | $14,748,000 | **+$516,000** |
| 5 | $10,320,000 | $9,674,760 | **+$645,240** |
| 10 | $6,120,000 | $6,417,360 | −$297,360 |
| 15 | $4,680,000 | $4,965,480 | −$285,480 |
| 20 | $4,080,000 | $3,902,760 | +$177,240 |
| 25 | $3,480,000 | $3,182,280 | **+$297,720** |
| 30 | $2,880,000 | $2,926,800 | −$46,800 |

Errors run **−6% to +9%**, in both directions — the signature of a guessed table. Two tables in the same repo claim to be the rookie scale and disagree with each other.

### 7. "Confirmed: true" means nothing — several labels are false

The brief flagged one known case. There are **five**:

- `capProjections['2024-25']` — four round-number guesses flagged `confirmed: true` (cap $141M vs. the real $140.588M, etc.). **The correct 2024-25 numbers already exist elsewhere in this repo** (`CBA_THRESHOLDS`) — the two tables silently disagree.
- `capProjections['2024-25'].rookieMin` — flagged `rookieMinSource: 'real'`. It's the **2023-24** figure ($1,119,563), not 2024-25's ($1,157,153).
- `capProjections['2025-26'].rookieMin` — flagged `'real'` and `confirmed: true`. It is a ~4% projection ($1,164,345 vs. the real ≈$1,272,870).
- `MINIMUM_SALARY_SCALES['2024-25']` — the file header claims "their rookie rung happens to match the real value." **It does not.** The 10+ year rung is **15% too high** ($3,800,000 vs. $3,303,771).
- `capYearData.ts` — labels the **current, official 2026-27 season as PROJECTED**, and the guessed 2024-25 numbers as **REAL**. Exactly backwards.

### 8. The league average salary is a stale hardcoded number that is *always* used

`DEFAULT_AVERAGE_SALARY = $11,100,000`, commented "2024-25 value." No season's data ever supplies a real one, so **this fallback is the live value in every calculation**. It drives the Early Bird maximum (105% of average) and the veteran-extension floor (140% of average). The cap has risen ~17% since 2024-25, so it is stale — though I could not source the exact 2026-27 figure to quantify the error (see below).

### 9. Missing rules, quietly

Present in the CBA, absent from the code entirely:
- **Base Year Compensation** — the constant `BYC_PERCENT = 0.5` exists but is **never used anywhere**. Sign-and-trades that should count outgoing salary at half value count it in full.
- **The Gilbert Arenas provision** — zero references. Offer sheets to 1-2 year players have a special structure the tool doesn't know about.
- **Two-way contract rules** — no salary constant exists ($678,882 for 2026-27), no 50-game rules. Only the "max 3" roster limit is modeled.
- **The starter criteria** — zero references.

### 10. Cash in trades is capped $1.5M too low

The tool has no 2026-27 cash limit and silently falls back to **$7,000,000**. The real 2026-27 limit is **$8,495,000** (sent), with a separate $8,495,000 (received). Legal deals between $7.0M and $8.495M of cash are blocked.

---

## WHAT I DID NOT CHECK — explicitly

No hedging. These are real gaps in this audit.

1. **Base roster and contract data.** Out of scope by instruction (known stale — 2025-26 rosters). Not touched, not audited.
2. **Trade exception (TPE) creation amounts and mechanics.** I confirmed the expiry *structure* exists (`tpeLifecycle.ts`) but did **not** work TPE creation, aggregation, or usage rules by hand against the CBA. `tradeExceptionLifecycle.ts` (439 lines) and `validateTradeExceptions.ts` were not audited. **This is the largest unaudited surface** — and given that two of the missing hard-cap triggers are TPE-related (#41, #42), I'd expect findings here.
3. **Sign-and-trade contract shape.** `signAndTradeEligibility.ts` (749 lines) was not worked line-by-line. I verified the *hard-cap consequence* is correct, but not the contract rules (3-year minimum, 4-year maximum, raise limits).
4. **Second-apron trade *restrictions*** (as distinct from hard-cap *triggers*). Files exist (`validateAggregation.ts`, `secondApronMessages.ts`, `validateTradeExceptions.ts`) — I confirmed they exist but did **not** verify each restriction against the CBA.
5. **Renegotiation rules.** A reference exists in `extensionRules.eligibility.ts`; I did not work it.
6. **The exact 2026-27 "Estimated Average Player Salary."** I could not source an authoritative figure. The CBA defines it as 104.5% of the prior year's average, but no source I found published the computed number. So finding #62 is "demonstrably stale" but **not quantified** — I can't tell you how wrong $11.1M is, only that it can't be right.
7. **Exact per-pick 2026-27 qualifying-offer dollar amounts.** I verified the *formula* is inverted; I did not build the full 30-pick QO table.
8. **The reacquisition bar's precise terms** (#58). The code's behavior is plausible; I could not find a source that states the rule precisely enough to grade it.
9. **Waiver claims, 10-day contracts, hardship exceptions, the disabled player exception.** Not in the brief's scope list; not checked.
10. **Draft-pick protection / conveyance (the entitlements subsystem).** Large, but it encodes *team agreements*, not CBA facts — outside this audit's question.
11. **Whether the UI displays these numbers faithfully.** I audited the engine, not the screens. A correct engine can still be shown wrong.

---

## THE REAL GAPS, IN PRIORITY ORDER

Ordered by *how wrong the answer a user sees is*, not by how hard the fix is.

1. **Cap space is wrong for every team with free agents.** Fix the Bird cap hold (190%/150% split), add the max-salary ceiling on holds, fix the minimum-salary hold, and change the empty-roster charge from 14 to 12. *(#1, #2, #3, #4 — all ENGINE.)* These all push the same way: they make teams look poorer than they are.
2. **The second apron cannot be triggered.** Wire up the taxpayer-MLE trigger and the other three second-apron triggers; add the four missing first-apron triggers. *(#41-#48 — ENGINE.)*
3. **Rookie-scale data doesn't exist for this season.** Add the 2026-27 rookie scale; retire the duplicate guessed table in `capHolds.ts` and point both consumers at one sourced table. *(#6, #63 — DATA.)*
4. **Qualifying offers are inverted.** Fix the gradient (#1 pick 130% → #30 pick 150%), add the minimum + $200k floor, and add the starter criteria. *(#31, #32, #33 — ENGINE.)*
5. **The supermax is broken both ways.** Tighten the legacy criteria to the real rule; finish (or delete) the stub. Add the team-continuity requirement. *(#19-#22 — ENGINE.)*
6. **Extension lengths are wrong.** Veteran extensions cap the *total* at 5 seasons including years remaining, not a flat 4 new years; rookie-scale extensions can run 5, not 4. *(#25, #26 — ENGINE.)*
7. **Every `confirmed: true` / `'real'` label needs re-sourcing or removal.** Five are false today. Until they're trustworthy, the labels are worse than no labels. Fix `capYearData.ts` so the current season isn't called a projection. *(#64-#71 — DATA.)*
8. **The league average salary must become a real, per-season, sourced number.** It is currently one stale hardcoded constant used everywhere. *(#62 — DATA.)*
9. **Missing rules: BYC, Gilbert Arenas, two-way salary, cash limit for 2026-27.** *(#34, #49, #51, #56.)*
10. **Then audit what I couldn't**: trade exceptions, sign-and-trade contract shape, second-apron trade restrictions, renegotiation. *(See "What I did not check.")*

---

## A note on the tests

Consistent with BZE-253: **I did not run the test suite, and I would not have believed it.** Every wrong value above is presumably pinned green by a test asserting the code's own constant. The suite has never been asked whether the numbers are *right* — only whether they are *stable*.

The durable fix is not "more tests." It is that **any test asserting a real-world NBA figure must carry the source and date in a comment next to it**, so the next reviewer can check the world instead of the code. Every number in this report can be re-derived from the links below in an afternoon; none of them could be derived from the test suite in any amount of time.

---

## Sources (all accessed 2026-07-12)

- Hoops Rumors — *Glossary: Cap Holds* (2026-05): https://www.hoopsrumors.com/2026/05/hoops-rumors-glossary-cap-holds-10.html — **cap hold multipliers (190%/150%/130%/120%), the minimum-salary hold, the max-salary ceiling, the 12-player incomplete roster charge**
- Hoops Rumors — *NBA Teams With Hard Caps For 2026/27* (Jul 2026): https://www.hoopsrumors.com/2026/07/nba-teams-with-hard-caps-for-2026-27.html — **the verbatim list of first- and second-apron hard-cap triggers**
- Hoops Rumors — *Glossary: Qualifying Offer* (2026-05): https://www.hoopsrumors.com/2026/05/hoops-rumors-glossary-qualifying-offer-3.html — **QO percentages by draft slot, the minimum + $200K floor, starter criteria, deadlines**
- Hoops Rumors — *NBA Maximum Salaries For 2026/27* (Jun 2026): https://www.hoopsrumors.com/2026/06/nba-maximum-salaries-for-2026-27.html — **$41,240,250 / $49,488,300 / $57,736,350; 8% vs 5% raises; 5 vs 4 years**
- Hoops Rumors — *Rookie Scale Salaries For 2026 NBA First-Round Picks* (Jul 2026): https://www.hoopsrumors.com/2026/07/rookie-scale-salaries-for-2026-nba-first-round-picks.html — **the 2026-27 rookie scale, 100% and 120%**
- Hoops Rumors — *Glossary: Bird Rights* (2026-03): https://www.hoopsrumors.com/2026/03/hoops-rumors-glossary-bird-rights-8.html — **3 seasons; 5 years; 8% raises; up to the max**
- Hoops Rumors — *Glossary: Early Bird Rights* (2026-03): https://www.hoopsrumors.com/2026/03/hoops-rumors-glossary-early-bird-rights-9.html — **175% / 105% of average; 4-year max; 2-year minimum; 8% raises**
- Hoops Rumors — *Glossary: Designated Veteran Contract* (2024-08): https://www.hoopsrumors.com/2024/08/hoops-rumors-glossary-designated-veteran-contract-2.html — **supermax criteria (most recent season or 2 of 3), 7-8 / 8-9 YOS, team-continuity requirement**
- Hoops Rumors — *Glossary: Veteran Contract Extension* (2024-12): https://www.hoopsrumors.com/2024/12/hoops-rumors-glossary-veteran-contract-extension-4.html — **140% of prior salary or of the average; 5-season total**
- Hoops Rumors — *NBA Minimum Salaries For 2026/27* (Luke Adams, 2026-07-01): https://www.hoopsrumors.com/2026/07/nba-minimum-salaries-for-2026-27.html — **the 2026-27 minimum scale; two-way $678,882**
- Hoops Rumors — *Salary Cap, Tax Line Set For 2026/27 NBA Season* (Jun 2026): https://www.hoopsrumors.com/2026/06/salary-cap-tax-line-set-for-2026-27-nba-season.html
- Hoops Rumors — *Values Of 2026/27 Mid-Level, Bi-Annual Exceptions* (Jul 2026): https://www.hoopsrumors.com/2026/07/values-of-2026-27-mid-level-bi-annual-exceptions.html
- NBA.com — *NBA sets salary cap for 2026-27 season at $164.961 million*: https://www.nba.com/news/nba-salary-cap-2026-27-season
- The CBA Guide — *Restricted Free Agency*: https://cbaguide.com/transactions/signings/rfa/ — **offer-sheet match window, June 29 QO deadline, Gilbert Arenas provision**
- Sports Business Classroom — *NBA Available Cash in Trade 2026-27*: https://sportsbusinessclassroom.com/nba-available-cash-in-trade-2026-27/ — **$8,495,000 send/receive limits**
- Sports Business Classroom — *NBA 2026-27 Apron Tracker*: https://sportsbusinessclassroom.com/nba-2026-27-apron-tracker/
- RealGM — *CBA Minimum Annual Salary Scale*: https://basketball.realgm.com/nba/info/minimum_scale
- Sports Illustrated — *What's the Minimum NBA Salary for 2024-25?*: https://www.si.com/nba/what-minimum-nba-salary-2024-25 — **2024-25 minimums ($1,157,153 rookie, $3,303,771 at 10+)**
- Hoops Rumors — *Rookie Scale Salaries For 2024 NBA First-Round Picks* (Jul 2024): https://www.hoopsrumors.com/2024/07/rookie-scale-salaries-for-2024-nba-first-round-picks.html

## Files inspected (evidence trail)

- **Constants/data:** `src/features/architect/utils/capProjections.ts` · `.../utils/cbaConstants.ts` · `.../utils/tradeMachine/constants/cbaConstants.ts` · `.../data/minimumSalaryScales.ts` · `.../data/rookieScale.ts` · `.../data/capYearData.ts`
- **Cap holds / roster:** `.../utils/capHolds.ts` · `.../utils/capTotals/computeTeamCapTotals.ts` · `.../utils/freeAgentRights.ts` · `.../utils/offseason/resolveOffseasonTransition.ts` · `.../utils/capHoldTransitionHelpers.ts`
- **Player rules:** `.../utils/playerRulesProfile/birdRightsRules.ts` · `.../maxSalaryRules.ts` · `.../minimumSalaryRules.ts` · `.../extensionRules.ts` · `.../extensionRules.eligibility.ts` · `.../rfaRules.ts`
- **Hard cap / trades:** `.../utils/hardCapUtils.ts` · `.../utils/tradeMachine/utils/hardCapStatus.ts` · `.../utils/tradeMachine/rules/validateStepien.ts` · `.../utils/stepienUtils.ts` · `.../utils/tpeLifecycle.ts` · `.../utils/reacqUtils.ts` · `.../utils/tradeHelpers.ts` · `.../utils/capHelpers.ts`
- **Validation surface:** `.../utils/capLegalityValidation/signing.terms.ts`

---
---

# PART 2 — Trade exceptions, sign-and-trade, second-apron restrictions, renegotiation, reacquisition, league-average salary (BZE-259)

**Read-only diagnostic. No code, data, or constants were changed. No emulator, scrape, push, or Firestore pipeline was run.**

- **Date:** 2026-07-12
- **Repo state:** branch `main`, commit `40d5e192`
- **Method:** identical to Part 1. Every real-world number and rule below was compared to an authoritative public source, cited with a link and a date, and **worked by hand with a small example**. **No passing test was accepted as evidence.**
- **Scope:** the six surfaces Part 1 explicitly did not reach.

---

## ONE-LINE VERDICT (PART 2)

**The second apron is not just untriggerable — its single most famous restriction is not enforced.** Part 1 found that nothing can ever *put* a team under a second-apron hard cap. Part 2 finds that even when a team **is** over the second apron, **it can still aggregate two or more salaries in a trade** — the restriction the second apron is best known for. A prior refactor removed the correct check on purpose, and left a comment explaining that the CBA rule was "over-blocking."

**The league-average salary is now quantified.** Part 1 graded this CAN'T-VERIFY. It is sourceable after all: the 2025-26 **Estimated Average Player Salary is $13,870,000**. The code uses **$11,100,000** — **25% low** — and that number is the live input to every Early Bird and veteran-extension offer the tool computes.

**Score (Part 2): 17 PASS · 18 WRONG · 6 CAN'T-VERIFY / FLAG.**
**Running total (Parts 1+2): 41 PASS · 38 WRONG · 11 CAN'T-VERIFY.**

**Good news, and it matters:** the salary-matching bands BZE-253 rebuilt are **correct**, including the counter-intuitive one — **first-apron teams are limited to 100%, not 110%**. Two reputable sources say 110%. They are stale. **Do not "fix" this.** See #98.

---

## FULL CHECK TABLE (PART 2)

Numbering continues from Part 1. Same keys: `DATA` = re-source the value · `ENGINE` = the rule is wrong in code.

### I. Trade exceptions (TPEs) — *the largest unaudited surface in Part 1*

| # | Rule | Code value | Source value | Result | Sev. | Cause |
|---|---|---|---|---|---|---|
| 74 | TPE lifespan | trade date **+ 1 year** | "Trade exceptions expire after a year" | **PASS** | — | — |
| 75 | TPE expiry sweep at season rollover | expires TPEs whose expiry precedes July 1 of the new season; keeps mid-season expiries | consistent with a 1-year life | **PASS** | — | — |
| 76 | **TPE creation amount** | **ONE** TPE = *total* `salaryOut − salaryIn`, **aggregated across every outgoing player** | non-simultaneous trades deal **a single player**; the exception equals **that player's** salary. Exceptions "can't be combined with one another" | **WRONG** | **MED-HIGH** | ENGINE |
| 77 | TPE creation requires being over the cap | `teamTotalSalary > salaryCap` (pre-trade) | under-cap teams that go over via the trade can't create one | **PASS** | — | — |
| 78 | **TPE absorption padding** | usage **> TPE amount** is blocked; no padding | a TPE absorbs up to **TPE + $250,000** (teams under the first apron; apron teams get no padding) | **WRONG (too strict)** | **LOW-MED** | ENGINE |
| 79 | TPEs cannot be combined with each other | each player maps to one `tpeId`; no cross-TPE pooling for one player | correct | **PASS** | — | — |
| 80 | TPE combined with outgoing player salary | **any** outgoing salary in the trade blocks **all** TPE usage | rule bars combining a TPE with salary **to absorb one player**; a trade with a matched swap *and* a separate TPE absorption is routine in practice | **FLAG (likely over-restrictive)** | MED | ENGINE |
| 81 | **Prior-year TPE — who is barred** | only **second-apron** teams are blocked from using one | using a prior-year TPE **hard-caps any team at the first apron**; a team already above the first apron therefore cannot use one at all | **WRONG (under-enforced)** | **MED** | ENGINE |
| 82 | **Prior-year TPE — detection** | `createdSeason` = **calendar year** of the trade date, compared against the season's **start** year | a TPE created at the Feb deadline of 2026-27 gets `createdSeason = 2027`; the season key `2026-27` resolves to `2026`. **A prior-season deadline TPE reads as current-season and the ban never fires.** | **WRONG (off-by-one)** | **MED** | ENGINE |
| 83 | Expanded TPE value (2026-27) | **$9,096,000** | $9,096,000 | **PASS (exact)** | — | — |
| 84 | **Second-round pick exception** | **absent** (zero references) | a real 2026-27 exception with published values | **WRONG (missing)** | **LOW-MED** | DATA + ENGINE |

> **Worked example (#76).** A second-apron-irrelevant, over-the-cap team sends **Ayton ($20M)** and **Bridges ($15M)** and takes back nothing.
> - **Tool:** creates **one $35,000,000 TPE**, which it will later let the team use to absorb a single $35M player.
> - **CBA:** a non-simultaneous trade deals **one player**. This is two exceptions — **$20,000,000** and **$15,000,000** — and they **cannot be combined**. The largest player absorbable is **$20,000,000** (+$250K).
> - **The tool invents $15,000,000 of trade capacity that does not exist.**

### J. Sign-and-trade contract shape

| # | Rule | Code value | Source value | Result | Sev. | Cause |
|---|---|---|---|---|---|---|
| 85 | **S&T contract length** | **3-4 years** enforced | "must cover either three or four seasons" | **PASS** | — | — |
| 86 | S&T first year guaranteed | enforced | "only the first year of the deal needs to be fully guaranteed" | **PASS** | — | — |
| 87 | **S&T raise limit** | **not enforced** | **5%** annual raises | **WRONG (missing)** | **MED** | ENGINE |
| 88 | **S&T first-year salary ceiling** | **not enforced** in the S&T validator | up to the max for full-Bird players; **120% of prior salary** for Non-Bird; Early Bird limits apply | **WRONG (missing)** | **MED** | ENGINE |
| 89 | Acquiring team cannot finish above the first apron | enforced (`projectedSalary > firstApron` blocks) | "cannot be over the first tax apron upon the conclusion of the deal" | **PASS** | — | — |
| 90 | S&T hard-caps the acquiring team at the first apron | yes | yes | **PASS** | — | — |
| 91 | S&T is offseason-only | `offseason` required | "can't be signed-and-traded once the regular season is underway" | **PASS (approximated)** | LOW | — |
| 92 | S&T player must be traded alone (not aggregated) | enforced both directions | correct | **PASS** | — | — |
| 93 | **Base Year Compensation in S&T** | **absent.** `BYC_PERCENT = 0.5` is re-exported through two files and **never applied** | outgoing salary for matching = **greater of prior salary or 50% of the new salary** | **WRONG (missing)** | **MED** | ENGINE |
| 94 | January 15 trade restriction applied to S&T players | applied to outgoing S&T players | the Jan-15 bar governs **re-signed free agents**, not sign-and-trades; and the validator *already* requires offseason, so the check is inert/contradictory | **FLAG (misapplied, inert)** | LOW | ENGINE |

### K. Second-apron trade restrictions — *as distinct from hard-cap triggers*

| # | Rule | Code value | Source value | Result | Sev. | Cause |
|---|---|---|---|---|---|---|
| 95 | **Second-apron aggregation ban** | blocks only **"aggregating up"** — i.e. only if some *incoming* salary exceeds the *largest single outgoing* salary | **flat ban:** a second-apron team may not **"aggregate two or more players in a trade for salary-matching purposes."** No qualifier. | **WRONG** | **HIGH** | ENGINE |
| 96 | `SECOND_APRON_MULTI_PLAYER_AGGREGATION_BLOCKED` | **defined and never used** (grep-confirmed) | the message exists for the rule the code declines to enforce | **WRONG (dead)** | LOW | ENGINE |
| 97 | Second apron cannot take back more salary than sent | enforced (`salaryIn > salaryOut` blocks) | 100% matching, no padding | **PASS** | — | — |
| 98 | **First apron — salary-matching band** | **100%** | **100%** — *"Using one or more outgoing players in a trade for matching purposes to take back more than 100% of the outgoing salary"* (Hoops Rumors, Tax Aprons glossary) | **PASS — DO NOT CHANGE** | — | — |
| 99 | Over-cap bands (200%+$250K / +ETPE / 125%+$250K) | correct, ETPE-derived, sourced in-file | correct | **PASS** | — | — |
| 100 | Second apron cannot send cash | enforced | correct | **PASS** | — | — |
| 101 | "Cannot aggregate salaries from multiple clubs" | blocks incoming players from >1 team | could not source this as a distinct CBA rule | **CAN'T-VERIFY** | — | — |
| 102 | **Apron tier is chosen from PRE-trade salary** | first-apron branch tests **pre-trade** salary only; the second-apron branch tests **pre- and post-trade** | asymmetric; the codebase itself believes post-trade matters. Could not source whether a sub-apron team may use 125% matching to cross the apron. | **FLAG (asymmetry)** | MED | ENGINE |

> **Worked example (#95) — the hole.** A second-apron team sends **A ($20,000,000)** and **B ($10,000,000)** — $30,000,000 out. It takes back **C ($18,000,000)** and **D ($11,000,000)** — $29,000,000 in.
> - **CBA: ILLEGAL.** D ($11M) cannot be matched by B ($10M) alone at 100%. Absorbing D requires pooling B with A's leftover — **that is aggregating two players, which a second-apron team may not do.**
> - **Tool: LEGAL.** `validateAggregation` computes `maxOutgoing = $20M`; no incoming salary exceeds it, so "aggregating up" is false → passes. `validateSalaryMatching` then compares **totals** ($29M ≤ $30M) → passes. **The trade is approved.**
> - The totals comparison is itself the bug in miniature: **treating outgoing salary as one pool is exactly the aggregation the rule forbids.**
>
> **This is a closed-loop failure with a paper trail.** `basicRules.ts` carries this comment:
> *"Multi-player outgoing restriction: validateAggregation.ts is the sole canonical authority (fires only when combining multiple smaller salaries to acquire a higher-paid player; equal-value multi-player trades are allowed per CBA). The broad 2+ player block previously in this file was removed in TM-1C followup as it over-blocked relative to the CBA rule."*
> The broad 2+ player block **was the CBA rule.** A prior agent read the code, found the strict rule inconvenient, reasoned its way to a looser one, wrote "per CBA" next to it, and deleted the correct check. The unused message constant (#96) is the fingerprint it left behind.

### L. Renegotiation

| # | Rule | Code value | Source value | Result | Sev. | Cause |
|---|---|---|---|---|---|---|
| 103 | **Renegotiation as a transaction** | **does not exist.** The only reference in the entire codebase is a `lastRenegotiatedDate` field read as a 36-month blocker on *extension* eligibility | a real transaction type | **WRONG (missing)** | **LOW-MED** | ENGINE |
| 104 | Renegotiation eligibility (4+ season contracts; **not** rookie-scale deals; 3rd anniversary of signing/extension/prior renegotiation) | absent | per source | **WRONG (missing)** | LOW | ENGINE |
| 105 | Renegotiation requires cap room; raise limited to available room | absent | "Teams can't renegotiate any contracts if they're over the cap, and they can only increase the player's salary… by the amount of cap room they have" | **WRONG (missing)** | LOW | ENGINE |
| 106 | Renegotiate-and-extend ±40% swing | absent | salary may move up/down "by as much as 40%" | **WRONG (missing)** | LOW | ENGINE |
| 107 | 36-month wait after a renegotiation blocks an extension | present | plausible but not precisely sourceable in this form | **CAN'T-VERIFY** | — | — |

> Renegotiation is **not a partially-wrong rule — it is an absent feature** with a single vestigial field. Whether Architect V1 needs it is a **product** question for the owner, not an engine bug. Flagged, not scoped.

### M. Reacquisition bar — *Part 1 graded this CAN'T-VERIFY; now sourced*

| # | Rule | Code value | Source value | Result | Sev. | Cause |
|---|---|---|---|---|---|---|
| 108 | **Traded player — 1-year reacquisition bar** | 365 days from the trade | "if a player is traded, the team that traded him cannot re-acquire the player until at least one year has passed" | **PASS** — *upgrades Part 1 #58 from CAN'T-VERIFY* | — | — |
| 109 | Waived player — re-signing bar | July 1 following the contract's final season | the sourced rule (the "Ilgauskas rule") governs a player **traded and then waived**: barred until **one year after the trade, or the July 1 after that year expires**. The code anchors on **contract end**, not the **trade date** — a different anchor. | **WRONG (wrong anchor)** | LOW-MED | ENGINE |
| 110 | Two parallel reacquisition implementations | `reacqUtils.ts` **and** `rules/validateReacquisition.ts` encode the bar separately, with different date logic | one rule | **FLAG (duplication)** | LOW | ENGINE |

### N. The 2026-27 Estimated Average Player Salary — *Part 1's biggest open question, now answered*

| # | Rule | Code value | Source value | Result | Sev. | Cause |
|---|---|---|---|---|---|---|
| 111 | **Estimated Average Player Salary (2025-26)** | `DEFAULT_AVERAGE_SALARY = $11,100,000`, labeled "2024-25", used as the **live value in every season** | **$13,870,000.** Hoops Rumors publishes the derived figure: *"In 2025/26, 140% of the estimated average salary would work out to a **$19,418,000** salary in the first year of a contract extension."* → $19,418,000 ÷ 1.40 = **$13,870,000** | **WRONG (quantified: 25% low)** | **HIGH** | DATA |
| 112 | **Early Bird maximum** (105% of the average) | 105% × $11.1M = **$11,655,000** | 105% × $13.87M = **$14,563,500** | **WRONG — understated by $2,908,500** | **HIGH** | DATA |
| 113 | **Veteran-extension floor** (140% of the average) | 140% × $11.1M = **$15,540,000** | **$19,418,000** (published directly) | **WRONG — understated by $3,878,000** | **HIGH** | DATA |
| 114 | Estimated Average Player Salary (**2026-27**) | n/a — no season supplies one | **not publicly published as a computed figure.** The CBA defines it as **104.5% of the most recent audited average salary**. | **CAN'T-VERIFY (exact)** | — | DATA |
| 115 | The constant is season-blind | one hardcoded fallback, always live | must be per-season | **WRONG (structural)** | **MED** | DATA + ENGINE |

> **This resolves Part 1 #62.** It is no longer "demonstrably stale but unquantified." Against the **2025-26** figure — the most recent one that is actually published — the tool is **$2,770,000 low on the league average**, and therefore lowballs **every Early Bird offer by ~$2.9M** and **every below-average veteran extension by ~$3.9M**. Those are the two places this constant is used.
>
> **Scope call for BZE-256 / BZE-263 (the reason BZE-259 ran first):** the exact **2026-27** figure is **not publicly published**. Do **not** invent one and do **not** label it `confirmed: true`. Store the **sourced $13,870,000 (2025-26)** with its citation, and carry 2026-27 **honestly labeled as a projection** until the league publishes it. The correct fix here is *provenance*, not a guessed number — inventing one is precisely the failure mode this lane exists to end.

### O. Cash in trades — *four constants, all different, and the enforced one is the worst*

| # | Rule | Code value | Source value | Result | Sev. | Cause |
|---|---|---|---|---|---|---|
| 116 | **The cash limit actually enforced** | `validateCash.ts` → `SEASONAL_CASH_LIMIT = $5,800,000`, hardcoded, season-blind | **$8,495,000** (2026-27) | **WRONG** | **MED** | DATA |
| 117 | **The repo holds four disagreeing cash limits** | **$5,800,000** (enforced) · `CASH_LIMITS['2024-25'] = $6,750,000` · `CASH_LIMITS['2025-26'] = $7,000,000` · `CBA_BY_YEAR['2024-25'].cashLimit = $7,000,000` — the last two disagree **about the same season** | one sourced value per season | **WRONG** | **MED** | DATA |
| 118 | Cash **received** limit | absent (only `cashSent` is checked) | a **separate** $8,495,000 receive bucket | **WRONG (missing)** | LOW-MED | ENGINE |

> **Part 1 #49 understated this.** It reported the code "silently falls back to $7,000,000." In fact the validator that actually runs never reads those tables — it enforces a hardcoded **$5,800,000**. Legal cash deals between **$5.8M and $8.495M** are blocked today, a **$2,695,000** dead zone.

---

## WHAT I DID NOT CHECK — PART 2, explicitly

1. **Whether the UI surfaces any of this faithfully.** Engine only, same as Part 1.
2. **TPE *usage* across multiple trades over a season** (partial consumption, then reuse). Creation and single-trade consumption were worked; the multi-trade drawdown path was not.
3. **The `entitlements` / draft-pick protection subsystem.** Out of scope by the same reasoning as Part 1: it encodes team agreements, not CBA facts.
4. **Whether a second-apron team may take back *less* salary via multiple players** (#95's legal cousin). I established the illegal case; I did not enumerate every legal one. **A fix must not over-block equal-value multi-player trades** — that failure mode is what produced the current bug.
5. **The 2024-25 and 2025-26 cash limits** (#117). I sourced **2026-27 ($8,495,000)** only. The historical rows still need re-sourcing.
6. **Two-way contract mechanics** beyond Part 1's finding (#56).
7. **Waiver claims, 10-day contracts, hardship and disabled-player exceptions.** Still unchecked, as in Part 1.
8. **`normalizeTeamTpe.ts` persistence contracts** — read for the TPE list shape, not audited as a rule surface.

---

## THE REAL GAPS — PART 2, in priority order

1. **The second-apron aggregation ban is not enforced** (#95). A second-apron team can aggregate salaries in Architect today. This is the defining restriction of the second apron, and the correct check was **deliberately deleted**. → **BZE-261**, and it must land with the worked example above as its test.
2. **The league-average salary is 25% low** (#111-#113). Every Early Bird and veteran-extension number the tool produces is wrong by ~$3-4M. → **BZE-256** (store $13,870,000, sourced; 2026-27 honestly labeled a projection).
3. **TPE creation mints capacity that does not exist** (#76). Multiple outgoing players collapse into one oversized combined exception. → **BZE-264**.
4. **Prior-year TPE rules are both under-enforced and undetectable** (#81, #82). Wrong team scope, plus a calendar-year/season-year off-by-one that stops the ban firing at all. → **BZE-261**.
5. **Sign-and-trade contract terms are unconstrained** (#87, #88, #93). Length and guarantee are right; raises, the salary ceiling, and Base Year Compensation are absent. → **BZE-264** (BYC) and **BZE-263** (terms).
6. **The enforced cash limit is $5.8M against a real $8,495,000** (#116-#118), with four disagreeing constants behind it. → **BZE-256** / **BZE-264**.
7. **The TPE $250,000 absorption padding is missing** (#78) and the TPE-plus-outgoing-salary block is likely over-restrictive (#80). Both make the tool *refuse legal trades* — the opposite direction from most of Part 1, and worth fixing so the engine is not wrong in both directions at once.
8. **Renegotiation does not exist** (#103-#106). **Owner product call, not an engine bug.**

---

## FIX-SCOPE CHANGES THIS AUDIT FORCES

BZE-259's stated purpose was to change the scope of the fix issues *before* they start. It does:

- **BZE-261 (hard cap)** — **scope grew.** It was "the second apron can never be triggered." It is now *also* "the second apron does not restrict aggregation even when it applies," plus the prior-year-TPE scope and off-by-one bugs (#81, #82, #95, #96).
- **BZE-263 (max/supermax/extensions)** — **unblocked and re-aimed.** The league-average salary is sourced ($13,870,000). Add S&T raise/ceiling terms (#87, #88).
- **BZE-264 (missing rules)** — **scope grew.** Add TPE creation-per-player (#76), the $250K padding (#78), the second-round pick exception (#84), cash send/receive (#116-#118), on top of BYC and two-ways.
- **BZE-256 (constants)** — **scope grew and got a hard constraint.** Add the league-average salary and the cash limits. **The exact 2026-27 average is not publishable — carry it as an honest projection, never as `confirmed: true`.**
- **BZE-260 (cap holds)** — **unchanged.** Nothing in Part 2 touches it.
- **BZE-262 (RFA)** — **unchanged.** Nothing in Part 2 touches it.
- **BZE-257 (season-aware matching)** — **unchanged in direction, but see #98:** the apron bands are **correct at 100%**. Make them season-aware; **do not re-rate them to 110%.**

---

## THINGS THAT ARE ALREADY RIGHT — DO NOT "FIX" THEM

A careless fix wave will break these. Every one was verified against a source, not against the code.

- **First-apron and second-apron salary matching are both 100%** (#97, #98). Two reputable-looking sources say first apron is **110%**; both are stale (one also claims the second apron is 110%, which is flatly wrong — the tell). The Hoops Rumors *Tax Aprons* glossary states it verbatim. **BZE-253's work here was right.**
- The over-cap matching bands, including the Expanded TPE at **$9,096,000** (#83, #99).
- **Sign-and-trade contracts are 3-4 years with the first year guaranteed** (#85, #86) — correct as written.
- The S&T first-apron ceiling and hard cap (#89, #90); S&T anti-aggregation (#92).
- TPE 1-year lifespan and the rollover sweep (#74, #75); over-the-cap-only creation (#77); no cross-TPE pooling (#79).
- The second-apron cash ban (#100) and the 1-year reacquisition bar (#108).

---

## Sources — Part 2 (all accessed 2026-07-12)

- Hoops Rumors — *Glossary: Tax Aprons* (2025-01): https://www.hoopsrumors.com/2025/01/hoops-rumors-glossary-tax-aprons-2.html — **the verbatim 7-item first-apron restriction list, including the 100% salary-matching limit**
- Hoops Rumors — *NBA Teams With Hard Caps For 2026/27* (Jul 2026): https://www.hoopsrumors.com/2026/07/nba-teams-with-hard-caps-for-2026-27.html — **"aggregates two or more players in a trade for salary-matching purposes" as a second-apron item**
- Hoops Rumors — *Glossary: Traded Player Exception* (2024-06): https://www.hoopsrumors.com/2024/06/hoops-rumors-glossary-traded-player-exception-5.html — **1-year expiry; the $250K padding and who gets it; "can't be combined with one another, with other exceptions, or with a player's salary"; single-player non-simultaneous trades; under-cap teams can't create one**
- Hoops Rumors — *Glossary: Sign-And-Trade* (2024-08): https://www.hoopsrumors.com/2024/08/hoops-rumors-glossary-sign-and-trade.html — **3-or-4 seasons; first year guaranteed; 5% raises; acquiring team can't finish over the first apron; Base Year Compensation; no S&T once the regular season starts**
- Hoops Rumors — *Players Eligible For In-Season Veteran Extensions In 2025/26* (Nov 2025): https://www.hoopsrumors.com/2025/11/players-eligible-for-in-season-veteran-extensions-in-2025-26.html — **"In 2025/26, 140% of the estimated average salary would work out to a $19,418,000 salary in the first year of a contract extension" → Estimated Average Player Salary = $13,870,000**
- Hoops Rumors — *Glossary: Renegotiations* (2024-07): https://www.hoopsrumors.com/2024/07/hoops-rumors-glossary-renegotiations-4.html — **4+ season contracts only, not rookie scale; 3rd-anniversary rule; over-the-cap teams cannot renegotiate; increase limited to cap room; ±40% renegotiate-and-extend**
- Hoops Rumors — *Glossary: Early Bird Rights* (2026-03): https://www.hoopsrumors.com/2026/03/hoops-rumors-glossary-early-bird-rights-9.html — **"105% of the league-average salary in the previous season"**
- Hoops Rumors — *Values Of 2026/27 Mid-Level, Bi-Annual Exceptions* (Jul 2026): https://www.hoopsrumors.com/2026/07/values-of-2026-27-mid-level-bi-annual-exceptions.html
- Hoops Rumors — *Second-Round Pick Exception Details For 2026/27* (Jul 2026): https://www.hoopsrumors.com/2026/07/second-round-pick-exception-details-for-2026-27.html — **the exception the codebase has never heard of**
- Sports Business Classroom — *Understanding Trade Matching in the New CBA*: https://sportsbusinessclassroom.com/understanding-trade-matching-in-the-new-collective-bargaining-agreement/ — **Expanded TPE $9,096,000; the 125%+$250K and 200%+$250K bounds**
- Sports Business Classroom — *NBA Available Cash in Trade 2026-27*: https://sportsbusinessclassroom.com/nba-available-cash-in-trade-2026-27/ — **$8,495,000 sent / $8,495,000 received**
- Sportskeeda — *Understanding the re-signing rule for trades* (the Ilgauskas rule): https://www.sportskeeda.com/basketball/why-la-lakers-unable-sign-stanley-johnson-waivers-despite-free-agent-understanding-re-signing-rule-trades — **1-year reacquisition bar; traded-then-waived players barred until one year after the trade or the following July 1**
- **Deliberately discarded as stale:** NBC Sports Boston — *Explaining the second apron*: https://www.nbcsportsboston.com/nba/second-apron-nba-cba-explained/716143/ — claims 110% matching for **both** aprons. The second-apron half is definitively wrong, which discredits the first-apron half. Recorded here so the next reviewer does not "re-discover" it and break #98.

## Files inspected — Part 2 (evidence trail)

- **TPEs:** `.../utils/tpeLifecycle.ts` · `.../tradeMachine/utils/tradeExceptionLifecycle.ts` · `.../tradeMachine/utils/tpeValidation.ts` · `.../tradeMachine/rules/validateTradeExceptions.ts` · `.../persistenceContracts/normalizeTeamTpe.ts`
- **Sign-and-trade:** `.../tradeMachine/signAndTrade/signAndTradeEligibility.ts` · `.../tradeMachine/rules/validateSignAndTrade.ts`
- **Second apron / matching:** `.../tradeMachine/rules/validateAggregation.ts` · `.../tradeMachine/rules/basicRules.ts` · `.../tradeMachine/rules/validateSalaryMatching.ts` · `.../tradeMachine/utils/salaryMatchingRules.ts` · `.../tradeMachine/constants/secondApronMessages.ts`
- **Cash:** `.../tradeMachine/rules/validateCash.ts` · `.../tradeMachine/constants/cbaConstants.ts` · `.../utils/cbaConstants.ts`
- **Reacquisition / renegotiation:** `.../utils/reacqUtils.ts` · `.../tradeMachine/rules/validateReacquisition.ts` · `.../playerRulesProfile/extensionRules.eligibility.ts`
