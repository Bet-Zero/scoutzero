# Architect CBA Canon v2 — R9/R6 third focused repair independent review

## Verdict

**ACCEPT** the exact third focused maker correction at
`e464d76959455fca18b6900ee405e45aa46ccf76`, direct parent
`4e07a86e917bded5f1bc686bf6e8f2b9a3ee7386`, on
`architect/cba-canon-v2`.

The post-R9 corrected R6 material is accepted. The separately authorized
targeted R7 repair is now unblocked but remains unstarted. R8, renewed R9,
owner acceptance, Phase 2, W1.1, application work, Linear, Graphify, and
`main` remain blocked and untouched.

## Reviewed baseline and independence

- Local `HEAD`, the tracking ref, and the live remote topic branch all
  resolved to `e464d76959455fca18b6900ee405e45aa46ccf76` before review.
- Its direct parent was exactly
  `4e07a86e917bded5f1bc686bf6e8f2b9a3ee7386`.
- Local and remote `main` both remained
  `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`.
- The worktree was clean, ancestry was exact, and the reviewed branch was
  synchronized before source inspection.
- This was an independent session. This reviewer authored no part of
  `e464d76959455fca18b6900ee405e45aa46ccf76`.
- The project knowledge graph was built from parent `4e07a86e...`; it was
  used only for read-only orientation and supplied no proof for this review.

## Primary artifacts independently verified

| Artifact | NBA provenance | Bytes | PDF pages | SHA-256 | Result |
|---|---|---:|---:|---|---|
| Signed 2023 NBA-NBPA CBA | NBA-hosted signed-agreement release and `ak-static.cms.nba.com` PDF | 2,850,534 | 676 | `bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32` | Exact match |
| NBA Constitution and By-Laws, June 2024 | NBA-hosted `cms.nba.com` PDF; cover states `JUNE 2024` | 422,247 | 88 | `be4d2781fe8fddfc5bc9028214298f742789a949dade4ead26368a4336d32ccf` | Exact match |

The canonical `official.nba.com` By-Laws alias returned HTTP 403 during this
session. The accessible NBA CDN endpoint returned HTTP 200, content type
`application/pdf`, content length 422,247, and the exact required SHA-256.
No different binary or edition was substituted. All source findings below
come from these hash-matched bytes.

## Diff scope and preserved accepted work

The complete `4e07a86e...e464d769` diff changes exactly three files:

- `docs/reference/cba/ARCHITECT_CBA_CANON.md`;
- `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md`; and
- `work/architect-completion/ARCHITECT_CBA_CANON_V2_R9_R6_THIRD_FOCUSED_REPAIR.md`.

The Canon changes only the three named LEAF rows, their three EV2 rows, their
same-identity detail inputs/lineage references, and current status prose. The
plan changes only current status prose, and the third maker receipt is new.

Direct parent/current row comparisons found no change to the accepted
partial-waiver Room, validity, winner-selection, dependency, or semantic-probe
material, including `CBA2-R01.16`, `CBA2-R01.28`–`.29`,
`CBA2-R01.46`–`.51`, and `EV2-0827`–`EV2-0850`. The six already-passed
evidence chains `EV2-0581`, `EV2-0585`, `EV2-0586`, `EV2-0653`,
`EV2-0693`, and `EV2-0717` are also unchanged. The immutable second
focused-repair receipt has the same Git blob
`b33d0b5ab8c32bae8bd0a062415d6f4bccd890da` in parent and reviewed commit.

## CBA2-R02.1 / EV2-0595

**ACCEPT.** The complete active proposition and evidence chain agree with CBA
Article II section 3(p), Article II section 4(a) and (k), Article VII section
4(a)(1)(i), Article VII section 7(d)(5)-(6), Article XXVII sections 1-3 and
5(a)-(b), and UPC paragraph 16.

The chain now truthfully separates all of the controlling results:

- Article II section 3(p) permits an approved amendment that reduces or
  eliminates protected Compensation and/or modifies or eliminates set-off.
- Article VII section 7(d)(5) allocates an approved protected-Compensation
  reduction pro rata over the then-current and remaining Salary Cap Years
  using remaining unearned protected Base Compensation.
- Article II section 4(k) changes the protected-Compensation payment schedule;
  it does not itself re-attribute Team Salary.
- Article VII section 7(d)(6) separately governs the written Team Salary
  election and re-attribution.
- Article XXVII section 1 calculates set-off separately for each Salary Cap
  Year covered by the original Contract.
- Article XXVII section 5(a) keeps the original Contract-year unearned Base
  Compensation as the calculation basis, then reduces that year's stretched
  protected-Compensation payments equally over the applicable stretch period:
  the entire stretch period for the first stretched original year and the
  remaining stretch period for a later original year.
- Article XXVII section 5(b) separately allocates the set-off for each
  remaining original Contract Salary Cap Year whose Salary was re-attributed,
  equally reducing the corresponding re-attributed Salary amounts over the
  applicable Team Salary stretch period.
- No set-off is permitted for Subsequent-Team compensation earned during a
  Salary Cap Year after the original Contract term.

The wording about affected original Contract Salary Cap Years, applicable
payment periods, corresponding re-attributed Salary amounts, and equal
allocation matches the signed text. Calling this chain complete is justified.

## CBA2-R02.4 / EV2-0598

**ACCEPT.** Article XXVII section 5(b), printed page 423, is now present in the
post-termination Team Salary chain. Set-off remains calculated for each
applicable original Contract Salary Cap Year; section 5(b) then allocates that
original-year set-off equally across the corresponding Salary amounts
re-attributed under Article VII section 7(d)(6).

Section 5(a) is used only through section 5(b)'s express incorporation of its
allocation method. The chain does not treat payment-schedule stretching as a
Team Salary election and keeps approved buyout reduction/allocation, payment
timing, Team Salary re-attribution, set-off calculation, and set-off allocation
as separate legal results. Every active branch has a controlling citation, so
the chain's complete classification is justified.

## CBA2-L03.15 / EV2-0704

**ACCEPT.** By-Laws section 4.01(a), printed pages 62-63, supplies the
Assignment Transaction windows, the postseason-roster restriction, and the
Moratorium bar. CBA Article I section 1(mm), printed page 6, supplies the
controlling definition: the Moratorium Period begins at 12:01 a.m. eastern
time on July 1 of the Salary Cap Year and runs through 12:00 p.m. eastern time
on the following July 6, regardless of whether July 6 is a business day.

Joining those two express primary-source passages is truthfully classified
`INFERRED`. `EV2-0704` directly references both `SRC2-001` and `SRC2-002`.
Article II section 15 is described only as the separate rule governing player
and Team employment agreements and exceptions during the Moratorium. Article
VII section 9 is not presented as authority. Lottery and draft-day timing
remain excluded.

The second focused-repair receipt is byte-unchanged. The third receipt and the
repair plan expressly retract and supersede its false statement that Article
II section 15 supplies the definition.

## Population, lineage, locator, and dependency reconciliation

Independent parsing of the governed tables and receipt populations produced:

- 61 GROUPs;
- 815 active LEAFs and 815 matching detail owners;
- 823 EV2 records;
- 247 R/L/S LEAFs: 118 R, 102 L, and 27 S;
- 245 current dependency edges from R/L/S owners;
- zero missing dependency targets and zero dependency cycles;
- 271 generic decisions; and
- 790 AMEND detail rows.

Parent/current identity-set comparison found no added, removed, reused,
renumbered, or retired GROUP, LEAF, or EV2 identity. Exactly three existing
LEAF rows and three existing EV2 rows changed. `DR2-0271` is the only new
generic decision, and it has exactly six same-identity `revise` details: three
LEAF rows and three EV2 rows, all pointing from parent `4e07a86e...` to the
same current identity.

The current EV2 authority totals are exactly 647 `CBA`, 17 `BYL`, 4 `NBA`,
6 `DERIVED`, 137 `INFERRED`, and 12 `EXT`. Compared with the parent, only
`EV2-0704` moved, from `BYL` to `INFERRED`. The preserved primary-source
review cohort reconciles as 664 directly classified `CBA`/`BYL` rows plus
the reclassified two-primary-artifact `EV2-0704`, for 665 total. Independent
locator parsing found zero missing printed-page locators across that cohort.

## R7 preservation and deferred work

The active v2 scenario library and crosswalk, from the `16.v2` heading through
the section 17 heading, are byte-identical between parent and reviewed commit:
698,101 bytes, SHA-256
`6f200b6ba78fae0bdb15776232e1ab5078d47d5c6b565d18e6f202c60a280aba`.
No scenario, XW2/SXW2 mapping, crosswalk, or outcome changed.

The third receipt records exactly five downstream R7 impacts and performs none
of them:

- `CBA2-SC-066(a)`;
- `CBA2-SC-066(c)`;
- `CBA2-SC-066(h32)`;
- `CBA2-SC-066(h78)`; and
- `CBA2-SC-076(h)`.

The separately authorized targeted R7 repair is unblocked by this ACCEPT but
has not started in this session.

## Validation

- Primary-source proposition checks: PASS against the hash-matched PDF pages.
  A first literal-string probe was discarded because PDF layout extraction
  split words and hyphens; the normalized source-text probe passed every
  Article II, Article VII, Article XXVII, Article I, and By-Laws assertion.
- Governed-population, identity-delta, lineage, authority, locator, dependency,
  cycle, and preserved-chain checks: PASS at the totals above.
- Frozen validator, executed exactly once at reviewed `HEAD`: 238/238 PASS,
  `baseline_clean=yes`, zero failures, successful knowingly-wrong-expectation
  negative self-test, successful inventory cache-isolation self-check, and
  frozen route checksum
  `b0c97d74d1426a323101155d61ebb86d2c42d6f66023ba383173e797db0a8cc1`.
- Targeted Markdown lint on the three maker-changed files with `MD029`
  disabled: PASS.
- `npm run test:diff -- --files docs/reference/cba/ARCHITECT_CBA_CANON.md
  work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md
  work/architect-completion/ARCHITECT_CBA_CANON_V2_R9_R6_THIRD_FOCUSED_REPAIR.md
  --reporter=dot`: PASS, FAST tier, 12 files and 57 tests.
- `npm run validate:project`: PASS after the authorized review file was added.
- Candidate and final review `git diff --check`: PASS.
- Full application suite: intentionally not run because `RUN FULL SUITE` was
  not authorized.
- Build and typecheck: intentionally not run because this is a documentation-
  only review.

## Repository authority and prohibited areas

The only review-session repository changes are this independent review record
and the repair plan's non-contract focused-acceptance status prose. Their
review commit must be the direct child of reviewed maker commit
`e464d76959455fca18b6900ee405e45aa46ccf76`; its exact hash is reported in
the final handoff because a commit cannot contain its own hash.

The Canon, maker receipts, R9 rejection report, all previous reviews, frozen
validator, route contract, R7 scenarios and crosswalks, application code and
tests, data, configuration, schemas, README, Linear, Graphify, and `main`
remain unchanged.
