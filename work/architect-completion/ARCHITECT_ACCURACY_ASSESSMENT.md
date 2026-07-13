# Architect — Accuracy & Reliability Assessment

> **UPDATE 2026-07-12 (post-assessment):** The two engine bugs found below
> (waive-and-stretch length #20, trade-matching tier boundaries #25) have since
> been **FIXED** in code, with the pinning tests corrected to CBA-true values.
> See the "FIXES APPLIED" section at the end. The body below is the original
> read-only diagnostic, preserved as the record of what was found.

**Original assessment was a read-only diagnostic. No data, emulator, scrape, push, or Firestore pipeline was run.**

- **Date:** 2026-07-12
- **Repo state:** branch `main`, commit `9b771ec8`
- **Scope:** Is Architect *accurate*, and how far can it be trusted today? Three layers — league constants (code), cap engine (code), and real base data (scraped).
- **Every real-world NBA number below is cited to a public source with a date. No figure is asserted from memory.**

---

## ONE-LINE VERDICT

**No — not yet reliable as "accurate" for real decisions.** The *machine* is in good shape (constants perfect, engine mostly correct), but the **single biggest risk is the stale base data**: the real rosters and contracts are last season's (2025‑26), scraped ~June 6–7 2026, so they predate the entire 2026 draft and free agency. A user will assume the base mirrors today's NBA; it does not, and nothing on screen warns them. Two engine bugs (below) compound it.

To keep the two questions separate, as the owner asked:

- **The machine (constants + engine): mostly-with-caveats.** All 14 hand-typed 2026‑27 league constants are exactly right. The engine's core math (team salary, cap space, tax/apron status, standard waive, buyout, minimum-salary cap hit) is correct. **Two specific rules are wrong:** waive‑and‑stretch length, and the trade salary‑matching tier boundaries. Both are code bugs, not data.
- **The data: no (stale).** Correct as of the 2025‑26 season, not the current 2026‑27 offseason. This is the deferred refresh the owner already knows about — but it is the dominant accuracy gap.

---

## What I verified vs. what I couldn't

- **Fully verified (no database needed):** Layer 1 (constants) and Layer 2 (engine). These live entirely in the repo and were checked line-by-line and by hand.
- **Deferred, honestly:** Layer 3 (spot-checking real rosters against 2026‑27 public sources). The only real data reachable in this environment is the **stale 2025‑26 local snapshot**; live production can't be read without running a Firestore script (out of scope, read-only). Comparing a 2025‑26 snapshot against 2026‑27 reality would only re-measure staleness, not correctness. See Layer 3 below for exactly what access would close it.

---

## LAYER 0 — Where the data comes from, and how fresh it is (plain language)

**The tool has two completely separate "brains," and only one of them is fresh.**

1. **The rulebook (cap numbers + math): current and hand-maintained in code.** The salary cap, luxury tax, both aprons, the exceptions, and the minimum-salary scale are typed into source files by hand and are correct for 2026‑27 (Layer 1). The math that uses them is also code (Layer 2). None of this needs a database.

2. **The league itself (who's on which team, and their contracts): scraped, and currently stale.**

**Where it comes from.** Two scrapers feed the "base league":
   - **SalarySwish** → each team's cap sheet: roster, salaries, cap holds, and trade/signing exceptions (`team-scrape/team-data/`).
   - **RealGM** → draft-pick ownership, separately (`team-scrape/draft-picks/`).
   These are merged and "staged" into Firestore-ready files under `team-scrape/shared/firestore_staging/_artifacts/output/baseTeams/` (all 30 teams present), validated against the app's schema, then **pushed to production Firestore** (`architect_baseTeams` / `architect_basePlayers`) by a manual admin script (`team:push` / `push_staged_teams.ts --confirmProject`).
   > The scrapers' own README calls this pipeline **"EXPERIMENTAL / WORK IN PROGRESS … Use at your own risk … Data accuracy has not been fully validated against official sources … Manual verification and cleanup of output is required."** That is the authors' own caveat, not mine.

**Production vs. emulator — do they stay in sync? No.** Production (what real users see) is updated only by the manual push above. The local **emulator is seeded separately** (`emu:reseed:baseTeams`, `emu:seed:base-players`) and currently holds a **fictional QA world** (players like "Grant Holloway," "Marcus Vance"). The two never auto-sync. **The emulator must not be used to judge accuracy** — it's fake by design, and I did not touch it.

**How to check what's actually live in production (without changing anything).** Read one `architect_baseTeams` document from live Firestore and look at its `season` and source timestamp — via the Firebase console, or a read-only script such as `scripts/firebase-utils/inspect-firestore.js` / `pull-firestore.js` (needs `serviceAccountKey.json`; requires the emulator env to be OFF). I did **not** run these — they touch production.

**How stale, from what's checkable in the repo.** The local scraped/staged files are the clearest signal:
   - Team cap files (`team-scrape/team-data/output/team_*.json`): last written **June 6, 2026**, tagged **`"season": "2025-26"`**.
   - Staged base-team payloads (`.../output/baseTeams/LAL.json`): written **June 7, 2026**, active roster season **`"2025-26"`** (with future contract years running out to 2028‑29, which is normal for multi-year deals).
   - Example: the staged Lakers roster still lists the 2025‑26 group (LeBron James, Luka Dončić, Deandre Ayton, Marcus Smart, Adou Thiero, etc.).

   **Meaning:** the base reflects the **end of the 2025‑26 season**, captured ~5 weeks before the world's "today" (2026‑07‑12) and **before the 2026 offseason** — so it is missing the entire 2026 draft class, all 2026 free-agency signings, and any 2026 offseason trades. Note the mismatch this creates: the app applies **2026‑27** cap rules (correct) on top of **2025‑26** rosters (stale). Whether production currently serves this exact June‑7 snapshot or something else can only be confirmed by the read step above.

---

## FULL CHECK TABLE

**Root cause key:** DATA = fix by refreshing scraped data; ENGINE = fix in code. Source values verified 2026‑07‑12.

### Layer 1 — League constants (`capProjections.ts` `'2026-27'`; `minimumSalaryScales.ts` `'2026-27'`)

| # | What was compared | Code value | Source value | Result | Sev. | Cause |
|---|---|---|---|---|---|---|
| 1 | Salary cap | 164,961,000 | 164,961,000 | **PASS** | — | — |
| 2 | Luxury tax line | 200,428,000 | 200,428,000 | **PASS** | — | — |
| 3 | First apron | 209,015,000 | 209,015,000 | **PASS** | — | — |
| 4 | Second apron | 221,686,000 | 221,686,000 | **PASS** | — | — |
| 5 | Minimum team salary (floor) | 148,465,000 | 148,465,000 | **PASS** | — | — |
| 6 | Non-taxpayer (full) MLE | 15,044,000 | 15,044,000 | **PASS** | — | — |
| 7 | Taxpayer MLE | 6,064,000 | 6,064,000 | **PASS** | — | — |
| 8 | Room MLE | 9,366,000 | 9,366,000 | **PASS** | — | — |
| 9 | Bi-annual exception (BAE) | 5,477,000 | 5,477,000 | **PASS** | — | — |
| 10 | Min scale — rookie (0 yr) | 1,357,763 | 1,357,763 | **PASS** | — | — |
| 11 | Min scale — 1 yr | 2,185,116 | 2,185,116 | **PASS** | — | — |
| 12 | Min scale — 2 yr | 2,449,421 | 2,449,421 | **PASS** | — | — |
| 13 | Min scale — 5 yr | 2,845,883 | 2,845,883 | **PASS** | — | — |
| 14 | Min scale — 10+ yr | 3,876,529 | 3,876,529 | **PASS** | — | — |

**Layer 1 result: 14/14 exact.** The hand-typed 2026‑27 rulebook is accurate. (Sources: cap/tax/apron/floor — NBA.com & Hoops Rumors, 2026‑06‑30/07‑01; exceptions — Hoops Rumors "Values Of 2026/27 Mid‑Level, Bi‑Annual Exceptions," Jul 2026; minimums — Hoops Rumors "NBA Minimum Salaries For 2026/27," Luke Adams, 2026‑07‑01. Links at bottom.)

> Note on the BAE: an automated search summary initially claimed the BAE was \$3.382M, which would have been a mismatch. Fetching the actual Hoops Rumors article confirmed **\$5,477,000** (3.32% of the cap) — the code is correct; the summary was wrong. Flagging so the check isn't misread as a near-miss.

### Layer 2 — Cap engine (worked by hand)

| # | Rule | What the code does | CBA-correct behavior | Result | Sev. | Cause |
|---|---|---|---|---|---|---|
| 15 | Team salary total | players + dead money + active unsigned cap holds + empty-roster charges (`computeTeamCapTotals`) | Same definition | **PASS** | — | ENGINE |
| 16 | Cap space | cap − team salary | Same | **PASS** | — | ENGINE |
| 17 | Over-tax / apron status | over tax if `> tax`; first apron if `≥ 1st apron`; second apron if `> 2nd apron` | Correct (boundary uses strict/│non-strict; a $1 edge nuance only) | **PASS** | low | ENGINE |
| 18 | Empty-roster charge | rookie minimum × slots below the 14-man minimum | Each empty slot below the minimum is charged one rookie minimum | **PASS** | — | ENGINE |
| 19 | Standard waive (no stretch) | remaining **guaranteed** salary booked as dead cap, by season | Same | **PASS** | — | ENGINE |
| 20 | **Waive-and-stretch length** | **fixed 3 years** in every live path | **2 × (years remaining) + 1** | **WRONG** | **HIGH** | ENGINE |
| 21 | Buyout | dead cap = remaining guaranteed − agreed givebacks | Correct structure | **PASS**\* | — | ENGINE |
| 22 | Minimum-salary cap hit (3+ YOS) | counts at the **2-year** minimum (`scale[2]`) | Correct — league reimburses the difference on 1-yr min deals | **PASS** | — | ENGINE |
| 23 | Trade matching — apron teams | 100% (dollar-for-dollar) | 100% from 2024‑25 on | **PASS** | — | ENGINE |
| 24 | Trade matching — multipliers/bonuses (below apron) | 200%+$250k / +$7.5M / 125%+$250k | Same | **PASS** | — | ENGINE |
| 25 | **Trade matching — tier boundaries (below apron)** | **$6.5M and $19.6M** | **$7.5M and $29M** | **WRONG** | **MED-HIGH** | ENGINE |

\* Buyout math is structurally correct, but if the user also stretches the buyout, it inherits bug #20 (spread over a fixed 3 years).

### Layer 3 — Real base data

| # | What would be compared | Reachable now? | Result | Cause |
|---|---|---|---|---|
| 26 | ~5–6 real teams' rosters, marquee contracts, and team salary/tax/apron totals vs. a 2026‑27 public source | No — only the **stale 2025‑26** local snapshot is reachable; live prod needs a read script (out of scope) | **CAN'T-VERIFY — deferred to owner's chosen refresh cutoff** | DATA |

---

## The two engine bugs, in plain language (with worked examples)

### Bug #20 — Waive-and-stretch always spreads over 3 years

**What it should do.** When a team waives a player and "stretches" the dead money, the CBA spreads it over **twice the years remaining, plus one**. (Real example: Milwaukee stretching Damian Lillard — 3 years / ~$21.8M left → paid over **7** years, ~$3.1M/yr. Source: Hoops Rumors Stretch Provision glossary + Forbes, Jul 2025.)

**What the tool does.** Every live path spreads it over **exactly 3 years**, regardless of contract length. The code that *does* implement the correct `2 × years + 1` formula (`contractUtils.stretchContract`) exists but **is never called — it's dead code.**

**Worked example (3 years, $21M left):**
- Tool: $21M ÷ **3** = **$7.0M/yr for 3 years**.
- CBA: 2×3+1 = **7** years → $21M ÷ 7 = **$3.0M/yr for 7 years**.
- The tool **more than doubles** the near-term dead-cap hit and ends it **4 years early** — the exact opposite of how a GM uses the stretch (to *minimize* near-term hit). It's correct **only** when a contract has exactly **1 year left** (2×1+1 = 3, by coincidence).

**Tests don't catch it — they lock in the bug.** `tradeManager.test.ts` and `architect-qa.spec.ts` assert `stretchYears: 3` and "Stretched over 3 years." The validation message helper is even written as `Math.ceil(remaining / (remaining / 3))`, which always equals 3. So the suite *enforces* the wrong behavior; green tests here do **not** mean accurate.

### Bug #25 — Trade salary-matching uses the wrong tier boundaries

**What it should do.** For a team below the first apron, the CBA below-apron tiers are: outgoing **≤ $7.5M** → 200%+$250k; **$7.5M–$29M** → outgoing+$7.5M; **> $29M** → 125%+$250k. (Source: Hoops Rumors "Salary-Matching Rules for Trades," fetched 2026‑07‑12.)

**What the tool does.** The multipliers and bonuses are right, but the **boundaries are wrong: $6.5M and $19.6M** (the *old* 2017‑CBA breakpoints) instead of **$7.5M and $29M**. It's a mismatched hybrid — new formula, old thresholds.

**Worked example (team below apron sends out $20.0M, wants back $27.0M):**
- CBA (Tier 2, $7.5M–$29M): allowed = 20.0 + 7.5 = **$27.5M** → **$27.0M is LEGAL**.
- Tool ($20M > its $19.6M cutoff → Band 3): allowed = 1.25×20 + 0.25 = **$25.25M** → **tool BLOCKS the legal trade.**
- **Direction of error:** mostly **too strict** for mid/large outgoing salaries (~$19.6M–$29M), wrongly rejecting legal trades by up to ~$2.3M of incoming salary; marginally **too lenient** (+$250k) in the $6.5M–$7.5M band. Trades are a core feature, so this misleads users building otherwise-legal deals.

**Tests don't catch it.** The "golden" trade tests assert behavior *at the code's own* `TIER_1_THRESHOLD` / `TIER_2_THRESHOLD` constants — they verify the formula fires at $6.5M/$19.6M, never that $6.5M/$19.6M are the correct CBA numbers. Same pattern: tests pin *some* value, not the *correct* value.

**Low-severity latent note (not an active bug):** the legacy `CBA_THRESHOLDS` table has no 2026‑27 row and a slightly-off 2024‑25 cap ($141.0M vs. the actual $140.588M). For the active season this is inert — cap/tax/apron come from `capProjections`, max salaries are computed as %-of-cap (25/30/35%), and the rookie minimum is taken from the official scale before this table is consulted. Worth tidying, but it does not affect 2026‑27 answers today.

---

## TO REACH THE OWNER'S BAR

*"A fully functional, usable tool that others can use with complete reliability that it is accurate."* Two independent things must be true. Keeping them separate, as asked:

### A) The machine (constants + engine) — close, two fixes away

1. **Fix waive-and-stretch to spread over `2 × years remaining + 1`** (Bug #20). Wire in the already-correct helper; retire the fixed-3 assumption; update the tests that currently assert "3 years" so they assert the CBA term. *Highest-leverage engine fix — it's flatly wrong for any multi-year contract and today's tests defend the wrong answer.*
2. **Fix the trade-matching tier boundaries to $7.5M / $29M** (Bug #25), and update the golden tests to check against the CBA figure rather than the code's own constant.
3. **Decide whether the below-apron matching thresholds and other fixed CBA dollar figures are meant to escalate**, and document it. (Public sources didn't state escalation either way; treat as an open question, not a defect.)
4. **Housekeeping (low):** give `CBA_THRESHOLDS` a 2026‑27 row or retire it, and correct the historical 2024‑25 cap, so no future season silently falls back to stale numbers.

### B) The data (real base league) — the dominant gap, and the deferred one

5. **Refresh the base to the current 2026‑27 league** at the owner's chosen cutoff. Today's base is the 2025‑26 season as of ~June 6–7 2026 — it predates the 2026 draft and free agency. *Even a perfect engine on last season's rosters produces confidently wrong answers, and nothing on screen tells the user the base is stale.* (Deferred by design — not to be run now.)
6. **Show data provenance in the product:** a visible "rosters current as of <date>" stamp. The base is meant to *be reality*; when it can't be, the tool should say so rather than imply currency.
7. **Validate the refreshed base against a public source** before trusting it — the scraper's own README warns its output "has not been fully validated against official sources" and "requires manual verification." A handful of real teams (an over-the-apron team, a cap-space team, a mid team) checked against Spotrac/RealGM would catch scraper drift. **This is the Layer 3 spot-check I deferred; to run it I'd need either the live `architect_baseTeams`/`architect_basePlayers` read (via console or a read-only script) or a refreshed non-fictional snapshot — treated as a fixed cutoff, never the emulator's QA world.**

**Bottom line for a non-technical reader:** the calculator is trustworthy and its rulebook is bang-on for 2026‑27, with two math rules to fix (how long a waived contract stretches, and how much salary a mid-to-large trade can take back). But it's currently doing that good math on **last season's league**, and nothing warns the user. Fix the two rules, refresh the roster data at your chosen moment, and stamp the data date on screen — then it can be relied on.

---

## Sources (accessed 2026‑07‑12)

- NBA.com — *NBA sets salary cap for 2026‑27 season at $164.961 million*: https://www.nba.com/news/nba-salary-cap-2026-27-season
- Hoops Rumors — *Salary Cap, Tax Line Set For 2026/27 NBA Season* (Jun 2026): https://www.hoopsrumors.com/2026/06/salary-cap-tax-line-set-for-2026-27-nba-season.html
- Bleacher Report — *2026‑27 NBA Salary Cap, 1st and 2nd Aprons, Luxury Tax Levels Revealed* (Jun 2026): https://bleacherreport.com/articles/25448479-2026-27-nba-salary-cap-1st-and-2nd-aprons-luxury-tax-levels-revealed-fa
- Hoops Rumors — *Values Of 2026/27 Mid‑Level, Bi‑Annual Exceptions* (Jul 2026): https://www.hoopsrumors.com/2026/07/values-of-2026-27-mid-level-bi-annual-exceptions.html
- Hoops Rumors — *NBA Minimum Salaries For 2026/27* (Luke Adams, 2026‑07‑01): https://www.hoopsrumors.com/2026/07/nba-minimum-salaries-for-2026-27.html
- Hoops Rumors — *Salary‑Matching Rules For Trades During 2023/24 Season* (Sep 2023): https://www.hoopsrumors.com/2023/09/salary-matching-rules-for-trades-during-2023-24-season.html
- Hoops Rumors — *Glossary: Stretch Provision* (Aug 2024): https://www.hoopsrumors.com/2024/08/hoops-rumors-glossary-stretch-provision-3.html
- Forbes — *Why the Milwaukee Bucks Used the Stretch Provision on Damian Lillard* (Shane Young, 2025‑07‑01): https://www.forbes.com/sites/shaneyoung/2025/07/01/why-the-milwaukee-bucks-used-the-stretch-provision-on-damian-lillard/

## FIXES APPLIED (2026-07-12)

Both engine bugs are fixed. The league constants (Layer 1) needed no change — they were already correct. The data-freshness gap (Layer 3 / section B) is untouched and still deferred to the owner's chosen refresh cutoff.

### Fix 1 — Waive-and-stretch now uses the real CBA term

**Plain language:** waiving-and-stretching a player used to always spread the dead money over 3 years. It now spreads it over the correct term — **twice the seasons remaining, plus one** — so a 2-year contract stretches over 5 years and a 3-year contract over 7, instead of being crammed into 3.

- New shared helpers in `waiverDeadCapAllocation.ts`: `countRemainingContractSeasons()` and `getStretchProvisionYears()` (`n × 2 + 1`). One formula, one place.
- Wired into **every** live path, each of which previously hardcoded 3: the world path (`computeWaiveResult`), the local UI path (`handleWaiveContract`), the persisted metadata, and the validation message (which literally always printed "~3 years" via `Math.ceil(x / (x/3))`).
- Legacy `tradeManager.waivePlayer` now computes the same term by default.
- The pre-existing correct helper (`contractUtils.stretchContract`) was dead code; the live paths now implement the same rule.

**Worked example (the e2e case):** Austin Reaves, $31M guaranteed across 2 remaining seasons. Was: $10.33M/yr for 3 years. Now: **$6.2M/yr for 5 years** (2×2+1).

### Fix 2 — Trade salary-matching now uses the real 2026-27 tiers

**Plain language:** the tool was using the *old* (pre-2023) tier boundaries with the *new* formula — a mismatched hybrid that wrongly blocked legal trades. It now uses the correct 2026-27 numbers.

The single cap-indexed input is the **Expanded Traded Player Exception (ETPE) = $9,096,000** for 2026-27; both tier boundaries derive from it so the piecewise function stays continuous:

| | Was (wrong) | Now (2026-27) |
| --- | --- | --- |
| Band 1 → 2 boundary | $6,500,000 | **$8,846,000** (ETPE − $250k) |
| Band 2 → 3 boundary | $19,600,000 | **$35,384,000** (4 × (ETPE − $250k)) |
| Band 2 cushion | $7,500,000 | **$9,096,000** (the ETPE) |

Sanity check against the public source's own example: **$10M outgoing → $19,096,000 allowable incoming.** ✅

> **Important maintenance note:** unlike the old hardcoded figures, these are **cap-indexed and must be updated each league year** — same annual-maintenance model as `capProjections`. Only `EXPANDED_TPE` needs changing; the boundaries derive from it. (For reference, the 2025-26 ETPE was $8,527,000.) This resolves the "do these escalate?" open question from the original report: **yes, they escalate.**

### Tests: re-pinned to CBA truth, not to the code's own values

The original report's sharpest finding was that the tests *defended the bugs* — they asserted the code's own constants rather than the real CBA figures, so green tests certified nothing. That is now corrected across 12 test files:

- Salary-matching band assertions re-derived from the real ETPE (e.g. $10M outgoing: $17.5M → **$19,096,000**).
- Band 3 cases that used $25M outgoing were genuinely **Band 2** under the correct rules — those tests were moved above the real $35.384M boundary so they still exercise Band 3.
- Boundary tests re-anchored to the true crossovers ($8.846M / $35.384M).
- Stretch tests now assert the CBA term (5 years for the 2-remaining-season case) instead of the hardcoded 3.

**Validation run:** `npm run typecheck` clean; trade/matching/waive scope **684/684 pass (76 files)**; `npm run test:architect` **3555 tests pass**. E2E waive-and-stretch expectations updated (not executed here — needs the review harness).

### Still open (unchanged by these fixes)

- **The data.** Base rosters are still the 2025-26 season, scraped ~June 6-7 2026, pre-2026-draft and pre-free-agency. This remains the single biggest risk to "others can rely on it," and is the owner's deferred refresh call.
- **Low-severity housekeeping.** The legacy `CBA_THRESHOLDS` table still has no 2026-27 row and a slightly-off 2024-25 cap; inert today (cap lines come from `capProjections`, max salaries are %-of-cap), but worth tidying.

---

## Files inspected (evidence trail)

- Constants: `src/features/architect/utils/capProjections.ts`; `src/features/architect/data/minimumSalaryScales.ts`; `.../data/rookieScale.ts`; `.../utils/tradeMachine/constants/cbaConstants.ts`
- Engine: `.../utils/capRulesProfile/capRulesProfile.ts`; `.../tradeMachine/utils/capSettingsProvider.ts`; `.../tradeMachine/utils/salaryMatchingRules.ts`; `.../utils/capTotals/computeTeamCapTotals.ts`; `.../utils/waiverDeadCapAllocation.ts`; `.../utils/mutationPipeline.compute.signings.playerOps.ts`; `.../GMDashboard/hooks/useArchitectActions.contractActions.ts`; `.../hooks/useCapValidation.ts`; `.../utils/contractUtils.ts`; `.../utils/playerRulesProfile/minimumSalaryRules.ts`; `.../utils/hardCapUtils.ts`
- Pipeline/freshness: `team-scrape/README.md`; `team-scrape/shared/firestore_staging/README.md`; `team-scrape/team-data/output/*.json`; `team-scrape/shared/firestore_staging/_artifacts/output/baseTeams/*.json`; `package.json` scripts
- Tests reviewed for pinning: `src/tests/trade/goldenTrades.test.ts`; `tests/architect/tradeManager.test.ts`; `tests/e2e/architect-qa.spec.ts`
