# Codex Phase 1 Acceptance Review — Canon v1.1 — REJECT/BLOCK

## Provenance

| Field | Value |
|---|---|
| Reviewer | Codex |
| Review type | Independent read-only Phase 1 acceptance review |
| Reviewed commit | `9814939c794595b988de21d8013934dc5342c8ee` |
| Result | **REJECT/BLOCK** |
| Repository changes during review | None |

The report below is preserved verbatim from the reviewer's delivered document.
The only normalization applied is character-encoding repair of transmission
artifacts (em/en dashes, section signs, curly quotes, arrows); no wording,
finding, number, or link was altered. Disposition of each finding is recorded
separately in `ARCHITECT_CBA_CANON_V1_1_CLAUDE_ADJUDICATION.md`.

---

# Acceptance verdict: REJECT/BLOCK

At the required clean `main` commit, the package passes provenance and mechanical reconciliation, but fails substantive acceptance. The registry is not reliably unique or atomic, multiple scenarios do not prove their assigned obligations, several canon rules conflict with the signed CBA, and the execution plan contains an unresolved dependency cycle.

Phase 1 is not safe to close. W1.1 is not safe to begin.

## Review scorecard

| Review | Result | Conclusion |
|---|---|---|
| A — Repository/provenance | PASS | Exact clean commit and checksums verified |
| B — v1.0→v1.1 amendment | PASS with Minor | Amendment boundary is intact; some receipt text is stale |
| C — Registry completeness | FAIL | Row totals pass, but uniqueness and atomicity claims fail |
| D — Acceptance coverage | FAIL | Syntactic links exist; substantive scenario coverage does not |
| E — Primary-source integrity | FAIL — Blocker | Per-leaf traceability is absent and multiple rules are materially wrong |
| F — Code map/execution plan | FAIL | Mechanical map reconciles, but pointers and dependency order are defective |

## Baseline and amendment integrity

- `HEAD`, `main`, and `origin/main` all equal the required `9814939c794595b988de21d8013934dc5342c8ee`.
- Final status remained exactly `## main...origin/main`, with no workspace changes.
- Canon v1.1 SHA-256 is exactly `4a0760c81d7a5e95919a0373d5ff631b565d064d56b858fe3b8869ad2b6bb3f6`.
- The v1.0 blob at `c859be7` hashes exactly to `b8cf5d01356b3a83de4663f5bd6843e9aa58c8c06a84227385ae93bc02d969ef`.
- Graphify's `built_at_commit` matches the live commit.
- No code, test, schema, configuration, fixture, or data files entered the package.
- Canon §§1–14 and §§17–19 are byte-identical between v1.0 and v1.1. Existing IDs and scenarios 1–46 are unchanged; additions are exactly A19–A21, C19–C25, S01–S04, and scenarios 47–89.
- Minor receipt issue: the final documents still describe the earlier authoring state as uncommitted at [migration receipt:5](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/work/architect-completion/ARCHITECT_CBA_CANON_V1_1_MIGRATION.md:5>) and "nothing committed or pushed" at [migration receipt:373](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/work/architect-completion/ARCHITECT_CBA_CANON_V1_1_MIGRATION.md:373>).

## Blocking findings

### Blocker C — 368 rows are not 368 unique atomic obligations

The mechanical totals reproduce:

- 70 top-level IDs: A21/C25/R10/L10/S4
- 59 GROUPs, 11 top-level LEAFs, 357 child LEAFs
- 368 LEAF rows, 427 total nodes
- Methods: 306 SCEN, 32 LIFECYCLE, 16 EXTS, 13 STATIC, 1 UI

But duplicate obligation ownership includes:

- Cash above the Second Apron at [A18.2](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1182>) and [A18.8](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1188>).
- Incentive caps at [C23.1](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1334>) and [C23.4](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1337>).
- The prior-to-June-25 option deadline at [C24.1](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1340>) and [C24.4](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1343>).

Non-atomic leaves include:

- [A19.3](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1191>): minimum term, maximum term, and Year-1 protection.
- [C12.2](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1255>): formula, contract shape, dates, expiry, and extinguishment.
- [C20.4](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1313>): term plus numerous independent contract prohibitions.
- [S04.2](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1498>): four independently testable derivations.

There are also phantom/process rows: [C19.6](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1309>) and [C20.9](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1318>) claim their rules have no owner after owners were added; [S02.1](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1490>) is a development-process instruction rather than a product obligation.

### Blocker D — scenario coverage is populated but materially false

All 89 scenarios are continuous, and every SCEN row has a syntactic `#N` reference. That does not establish coverage.

Examples:

- [A18.3](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1183>) assigns signing-bonus cash treatment to [scenario 53](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1623>), which contains no signing-bonus case.
- [C13.4](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1259>) assigns exception proration to [scenario 62](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1632>), which does not test proration.
- Multiple C21 leaves cite [scenario 73](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1643>) even though it omits G League payment conditions, deemed trade bonuses, Team Salary exclusion, and retained-player authority.
- [L03.15](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1434>) assigns five transaction windows to [scenario 86](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1656>), which tests only no-trade and Two-Way restrictions.
- [L10.5–L10.6](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1474>) cite [scenario 88](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1658>), which contains no circumvention, collusion, or tampering case.

### Blocker E — source integrity is insufficient

None of the 368 LEAF rows contains a primary-source article/subsection/page/URL. [Canon line 1105](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1105>) delegates to broad internal sections, while the source map at [line 1732](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1732>) is family-level only. That is not durable per-obligation traceability.

More importantly, comparison against the [signed 2023 NBA–NBPA CBA](https://ak-static.cms.nba.com/wp-content/uploads/sites/4/2023/06/2023-NBA-Collective-Bargaining-Agreement.pdf) found material errors:

- Incentive caps use `Base Compensation` at [canon:348](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:348>) and [C23.1](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1334>). CBA II §12(a)(i) and VII §5(b)(1) use `Regular Salary`; the defined amounts can differ.
- Signing bonuses are allocated by "guaranteed salary" at [canon:343](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:343>). CBA VII §3(b)(2) allocates by the percentage of Base Compensation protected for lack of skill.
- The ETO wording says it must shorten the fourth season at [C24.5](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1344>). CBA XII §2(b) permits effectiveness no earlier than the end of the fourth season.
- Two-Way rules bar alternate payment schedules and start conversion "after July 1" at [C20.4](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1313>) and [C20.6](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1315>). CBA II §11 permits a protected advance/alternate schedule and begins conversion on July 1.
- The minimum-team-salary payment and cap charge are called equal at [C10.3](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1242>). CBA VII §2(c)(1)–(3) calculates them from different adjusted bases.
- Scenario 57 treats two separately enumerated apron adjustments as one at [C07.8](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1228>); the CBA enumerates ten adjustments.
- [C24.2](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1341>) omits CBA XII §1(v)'s Second Round Pick Exception Team Option exception.
- Component decomposition and conditional-cash accounting are classified as CBA at [A10.4](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1152>) and [A18.7](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/docs/reference/cba/ARCHITECT_CBA_CANON.md:1187>), but no supporting public primary provision was located. They need official locators or explicit OPS/DERIVED treatment.

The earlier external-truth audit correctly admits that it relied mainly on secondary reporting and never read the primary agreement at [audit:382](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/work/architect-completion/CAP_ENGINE_EXTERNAL_TRUTH_AUDIT.md:382>).

## Source and arithmetic results that did pass

The 2024–25, 2025–26, and 2026–27 published levels match the official NBA releases: [2024–25](https://pr.nba.com/2024-25-nba-season-salary-cap/), [2025–26](https://pr.nba.com/nba-salary-cap-2025-26-season/), and [2026–27](https://pr.nba.com/2026-27-salary-cap/).

| Season | Derived A | First crossover | Second crossover | Tax width |
|---|---:|---:|---:|---:|
| 2024–25 | 7.751817734 | 7.501817734 | 30.007270936 | 5.167878489 |
| 2025–26 | 8.527010535 | 8.277010535 | 33.108042141 | 5.684673690 |
| 2026–27 | 9.095709486 | 8.845709486 | 35.382837944 | 6.063806324 |

For 2026–27, the BAE recomputes to `5.4767052`, cash limits to `8.4954915`, and EIPPA is `$0.900M`.

Primary checks also supported Expanded TPE arithmetic, sign-and-trade, extend-and-trade, non-guaranteed outgoing salary, DPE fundamentals, Over-38, repeater tax, core waiver/roster rules, and Stepien. Waiver, roster, and Stepien comparisons used the [June 2024 NBA Constitution and By-Laws](https://official.nba.com/wp-content/uploads/sites/4/2024/06/NBA-Consitution-By-Laws-June-2024.pdf).

## Code-map and execution-plan findings

The map mechanically reconciles all 368 rows:

- No missing, extra, duplicate, or GROUP execution rows.
- Locatability: 134 FOUND / 127 PARTIAL / 107 NO SITE.
- Packets: 55 / 21 / 47 / 139 / 48 / 28 / 30.
- Unit counts: 20 / 35 / 21 / 21 / 26 / 38 / 28 / 37 / 36 / 29 / 19 / 28 / 30.

Two mappings per unit were runtime-sampled:

| Unit | Samples | Locatability result |
|---|---|---|
| W1.1 | L01.1 / S01.1 | Resolved through [buildRuleContext.ts:80](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/src/features/architect/utils/buildRuleContext.ts:80>) and [capProjections.ts:21](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/src/features/architect/utils/capProjections.ts:21>) |
| W1.2 | A01.1 / C10.1 | Resolved through [computeTeamCapTotals.ts:242](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/src/features/architect/utils/capTotals/computeTeamCapTotals.ts:242>) and [seasonManager.helpers.ts:307](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/src/features/architect/utils/seasonManager.helpers.ts:307>) |
| W2.1 | A04 / A05.1 | FAIL: map points to constants/normalization; operative calculations are [matchingValues.ts:249](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/src/features/architect/utils/tradeMachine/utils/matchingValues.ts:249>) and line 258 |
| W3.1 | A02.1 / L06.1 | Resolved through [salaryMatchingRules.ts:223](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.ts:223>) and [tpeLifecycle.ts:48](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/src/features/architect/utils/tpeLifecycle.ts:48>) |
| W3.2 | A12.1 / A19.1 | Resolved through [hardCapStatus.ts:653](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/src/features/architect/utils/tradeMachine/utils/hardCapStatus.ts:653>) and [signAndTradeEligibility.ts:673](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/src/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility.ts:673>) |
| W4.1 | C01.1 / C13.1 | Resolved through [capHolds.ts:258](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/src/features/architect/utils/capHolds.ts:258>) and [exceptionLifecycle.ts:117](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/src/features/architect/utils/exceptions/exceptionLifecycle.ts:117>) |
| W4.2 | C14.1 / L04.1 | Resolved through [birdRightsRules.ts:169](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/src/features/architect/utils/playerRulesProfile/birdRightsRules.ts:169>) and [offerSheets.initial.ts:65](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/src/features/architect/utils/mutationPipeline.compute.offerSheets.initial.ts:65>) |
| W4.3 | C16.1 / C24.1 | Resolved through [extensionRules.ts:234](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/src/features/architect/utils/playerRulesProfile/extensionRules.ts:234>) and [resolveOffseasonTransition.ts:152](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/src/features/architect/utils/offseason/resolveOffseasonTransition.ts:152>) |
| W4.4 | C19.1 / C22.1 | Mixed: C19 resolves; C22.1–C22.3 point to unrelated raise constants |
| W5.1 | R01.1 / R02.1 | Resolved through [playerOps.ts:47](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/src/features/architect/utils/mutationPipeline.compute.signings.playerOps.ts:47>) and [waiverDeadCapAllocation.ts:48](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/src/features/architect/utils/waiverDeadCapAllocation.ts:48>) |
| W5.2 | A16 / R09.1 | Roster runtime resolves; R09 correctly remains partial |
| W6.1 | A17.1 / A18.1 | Resolved through [validateStepien.ts:249](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/src/features/architect/utils/tradeMachine/rules/validateStepien.ts:249>) and [validateCash.ts:30](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/src/features/architect/utils/tradeMachine/rules/validateCash.ts:30>) |
| W7.1 | L03.1 / L08.1 | Timing runtime resolves; repeater remains a supported NO SITE |

The plan's dependency claim is nevertheless false. It says C14 feeds C01 at [map:610](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/work/architect-completion/ARCHITECT_CBA_CANON_CODE_MAP.md:610>), then schedules C01 in W4.1 before C14 in W4.2 at [map:650](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/work/architect-completion/ARCHITECT_CBA_CANON_CODE_MAP.md:650>), while asserting no unit depends on a later unit at [map:660](</Volumes/Samsung PSSD T7/Personal/TEMP/ScoutZero/work/architect-completion/ARCHITECT_CBA_CANON_CODE_MAP.md:660>). Adjacency does not resolve that cycle.

## Required correction gate

Before Phase 1 can close or W1.1 can begin:

1. Publish a new canon revision correcting the source errors, with a new checksum and explicit amendment receipt.
2. Deduplicate obligations, split independently pass/fail-able conditions, remove process/phantom rows, re-parent misplaced rules, and recompute every count.
3. Give every LEAF a precise official locator or an explicit DERIVED/OPS/EXT dependency chain.
4. Rewrite scenario mappings so each states the actual input, boundary, and expected result it proves.
5. Correct scenarios 47, 48, 53, 57, 60, 67, 68, 69, 72, and 83; clarify aggregation in scenario 50.
6. Repair W4.1/W4.2 dependency topology and the misleading A04/A05/A07/C22 code pointers.
7. Validate complete minimum-salary and Rookie Scale tables, Two-Way/Exhibit 10 values, and season calendars against current official sources.
8. Retain explicit OPS treatment unless official provenance is obtained for component decomposition, multi-team touch/assets, the seven-draft horizon, detailed pick conditions, and conditional-cash accounting.
9. Re-run Reviews A–F at a newly pinned, clean `main` commit.

Files changed: none.

Validation actually run: read-only Git status/revision/history/diff checks; SHA-256 checks; full-document reads; graph freshness/query/path checks; independent registry, scenario, map, packet, unit, and arithmetic parsers; targeted runtime-path inspection; official CBA, By-Laws, and NBA-release comparison.

Intentionally skipped: all npm tests/build/typecheck/lint because this was a read-only documentation/source acceptance review with no application changes; the full suite was additionally prohibited because `RUN FULL SUITE` was not provided. Graphify update, Linear mutations, Git writes, Firestore access, Phase 2, W1.1, and fixes were also intentionally not performed.

Goal receipt: 568,719 tokens; 20 minutes 45 seconds.
