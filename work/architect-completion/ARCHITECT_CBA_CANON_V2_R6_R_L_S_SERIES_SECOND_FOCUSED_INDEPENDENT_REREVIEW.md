# Architect CBA Canon v2 — R6 R/L/S second focused independent re-review

Date: 2026-07-30

Checker: `agent:codex`

Review type: final focused independent checker; read-only audit followed by this
one authorized checker record

Reviewed checkpoint:
`b4712114cbbadd3ed67b7cc82f8fb7bdc741e3f8`

Checkpoint parent:
`259d4d34fc512c49170b51beffc3f48eb4c68e77`

Substantive second focused repair:
`e65542247e05f67184783bc74fcfff081a986b27`

Prior focused rejection:
`7cc8350aceb447178a280c18635a6a5c16fd9005`

## Verdict

**FOCUSED REJECT / BLOCK-R7**

The 175-row lifecycle repair, the `CBA2-R01.3`/`EV2-0579` source repair,
the duplicate-owner repair, the historical-fragment reconciliation, and all
preservation boundaries pass. One focused dependency/evidence defect remains:
`CBA2-R07.1` consumes two unrelated direct results, omits the direct result
that can change the shortage band, and carries the same defective join and an
incomplete locator in `EV2-0641`.

R6 therefore remains unaccepted. R7 remains blocked and unstarted.

## Checkpoint and scope gate

The review began from a clean branch synchronized with its remote after
`git fetch origin --prune`.

- `HEAD` and the remote topic branch both resolved to
  `b4712114cbbadd3ed67b7cc82f8fb7bdc741e3f8`.
- The checkpoint's direct parent is the expected status/provenance-only
  `259d4d34fc512c49170b51beffc3f48eb4c68e77`.
- The substantive repair is
  `e65542247e05f67184783bc74fcfff081a986b27`.
- The first repair/status pair, original rejection, focused rejection,
  accepted R5 maker/checker, and stable-main ancestry all resolve in the
  required order.
- Local and remote `main` both remained at
  `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`.
- No R7, application, runtime, data, Phase 2, Linear, Graphify, or `main`
  work exists in the reviewed checkpoint range.

The protected blobs are exact:

| Protected artifact | SHA-1 |
|---|---|
| Canon | `e730b40e81bd503eaa0e7fbb4f6138fa3b149204` |
| Repair plan | `5b6da67eb2e9d7454817f31d220df24eb5919b20` |
| Final maker receipt | `60583f69c42f0cd65d304626252096bd5b60eb80` |
| Focused checker receipt | `74c67dc26a57a36badbe7b9d2f4b56f2717352af` |
| Original checker receipt | `392bcc7a545c645ff291856368f86fd03f6e2ed4` |

The correction at the reviewed checkpoint changes only the maker receipt's
mistyped first-repair SHA to the exact direct parent
`8800aa168add5b0356786b15478880b893ef5e36`. It changes no canon content.

## Independent method

This checker did not rely on the maker's totals as proof. The review:

1. parsed the complete current canon and the published v1.1 canon at
   `9814939c`;
2. reconstructed every current R/L/S GROUP, LEAF main row, detail row,
   evidence owner, dependency edge, historical fragment, and R/L/S crosswalk
   edge;
3. compared the rejected checkpoint directly with the repaired checkpoint for
   the exact 175 lifecycle population and every retired identity;
4. read every one of the 214 current R/L/S requirements, input/window
   contracts, authority classes, evidence roots, locators, mappings, and
   limitations;
5. semantically reviewed all 154 declared LEAF dependency edges and their
   paired `EV2` dependency edges;
6. repeated the population-wide duplicate-owner and staged-output audit;
7. re-acquired and read the controlling official CBA and By-Laws artifacts;
8. recomputed historical normalized spans, exact partitions, edge/fragment
   reciprocity, retargeted endpoints, and accepted-population preservation;
9. ran the frozen full-document validator and its 123 controls; and
10. inspected the exact diff and repository status before authoring this
    record.

## Findings disposition

| Prior finding | Result | Checker conclusion |
|---|---|---|
| 1 — R/L/S fragment inventory | Preserved PASS | 134 published obligations, 145 current fragments, and 145 current reciprocal edges reconcile exactly. |
| 2 — terminal dispositions and search sets | Preserved PASS | No reopened direct-impact defect. |
| 3 — atomicity and source corrections | Preserved PASS | No reopened direct-impact defect. |
| 4 — lifecycle input contracts | PASS | Exact 175-row accounting closes with field-level inputs/windows and no rejected template left active. |
| 4 — dependency semantics | **FAIL** | `CBA2-R07.1`/`EV2-0641` still contains two unrelated joins and omits the effective shortage-band adjustment owner. |
| 5 — `CBA2-R01.3`/`EV2-0579` source chain | PASS | The active Team Salary proposition now uses CBA VII §4(c), printed p. 217. |
| 6 — source artifacts and season dates | Preserved PASS | Immutable artifacts match; the mutable schedule values remain independently visible with the recorded mutable-capture limitation. |
| 7 — duplicate verdict ownership | PASS | All named sets and the population-wide staged/note-bearing audit resolve to one direct owner or a distinct dependent output. |

## Remaining blocking finding — `CBA2-R07.1` dependency semantics

### Current governed records

`CBA2-R07.1` currently states:

> For each shortage band, state persists both the consecutive-shortage
> interval and the independent total count of qualifying end-of-day shortage
> days in the Season.

Its current detail row declares:

`CBA2-R06.8, CBA2-R06.9, CBA2-R06.10, CBA2-R06.11,
CBA2-R06.12, CBA2-R06.14`

`EV2-0641` mirrors those six joins through:

`EV2-0632, EV2-0633, EV2-0634, EV2-0635, EV2-0636,
EV2-0638`

and cites `CBA XXIX §1(b)–(c) through the dependency components`.

### Why the join fails

The official signed CBA separates these results:

- Article XXIX §1, printed p. 429, owns the ordinary Active List bound, the
  eight-player game-bench floor, and the temporary eleven-player Active List
  allowance with its two clocks.
- Article XXIX §2(b), printed pp. 429–430, owns the temporary twelve- or
  thirteen-player combined-list allowance, its two clocks, and the
  end-of-day qualifying-day rule.
- Article XXIX §5(a), printed p. 431, changes the combined-list minimum and
  changes the temporary shortage band from twelve/thirteen to
  thirteen/fourteen after the signed two-Season trigger.
- Article II §11 and Article XXIX §5(b), printed pp. 57–58 and 431–432, own
  the separate maximum number of Two-Way Contracts.

Two declared dependencies are unrelated to the output:

1. `CBA2-R06.12`/`EV2-0636` supplies the eight-player game-bench floor. A
   game-bench result has no consecutive-shortage interval and no
   Season-total shortage-day clock.
2. `CBA2-R06.14`/`EV2-0638` supplies the ordinary maximum number of Two-Way
   Contracts. That maximum is not a shortage-clock result. The actual
   Two-Way count used to adjust the combined-list bound is already an input
   of `CBA2-R06.8`; the separate maximum-compliance verdict does not supply
   this ledger's clock state.

The dependency set also omits the direct result that can change the governed
band:

1. `CBA2-R06.15`/`EV2-0639` owns the Article XXIX §5(a) permanent
   Standard-minimum and temporary-shortage-band adjustment. Without that
   result, `CBA2-R07.1` cannot select the effective shortage band after the
   trigger even though its input contract requires the direct shortage-band
   result for each date.

The `EV2-0641` locator compounds the defect. Article XXIX §1 does not contain
the cited `§1(b)–(c)` range as a complete source for both shortage bands:
the Active List clock is in §1, the combined-list clock and qualifying-day
rule are in §2(b), and the possible band adjustment is in §5(a). The current
locator and dependency mapping therefore cannot certify the output it claims.

This is semantic, not merely mechanical. A bench-floor or ordinary
Two-Way-maximum verdict can change while both shortage clocks remain
unchanged; conversely, the §5(a) trigger can change the effective shortage
band while the current ledger consumes no result representing that change.
The current join violates the frozen definition of a dependency as a result
actually consumed by the staged output.

### Required bounded correction

The next maker repair must remain limited to this direct impact:

1. reconcile `CBA2-R07.1`'s detail dependencies to only the direct
   shortage-band and clock results it actually consumes;
2. remove the game-bench and ordinary Two-Way-maximum joins unless the output
   is changed to a distinct atomic result that honestly consumes them;
3. add the direct Article XXIX §5(a) shortage-band-adjustment result, or
   otherwise make the effective-band input and owner exact;
4. make `EV2-0641`'s dependency IDs, locator, passage, mapping, and
   limitations identical to that corrected semantic join;
5. preserve the current main requirement if it remains the same identity;
6. record forward current `AMEND` lineage without rewriting this rejection or
   any earlier receipt; and
7. re-run the complete dependency semantic audit, not only a reference and
   cycle check.

No accepted A/C owner, historical fragment, R/L/S crosswalk edge, source
artifact, or unrelated R/L/S owner requires change for this finding.

## Lifecycle repair result

The lifecycle correction passes independently.

- The rejected checkpoint contained exactly 175 R/L/S detail rows using one
  of the two rejected generic lifecycle templates.
- Exactly 152 of those identities survive, and all 152 now carry
  field-level rule inputs and windows.
- Exactly 23 of those identities were retired through governed lineage.
- Four additional already-specialized duplicate identities were retired by
  the ownership repair.
- Final retirement count: 27 LEAFs and the same 27 evidence identities.
- Zero current detail row retains either rejected generic phrase.
- Every current R/L/S LEAF has one main row, one detail row, one evidence
  owner, and an explicit input/window contract.

The final current populations are:

| Population | R | L | S | Total |
|---|---:|---:|---:|---:|
| GROUPs | 10 | 10 | 4 | 24 |
| Active LEAF main rows | 85 | 102 | 27 | 214 |
| Active LEAF detail rows | 85 | 102 | 27 | 214 |
| Active evidence owners | 85 | 102 | 27 | 214 |

## Dependency audit result

The current register has 154 declared R/L/S dependency edges across 42
consumer LEAFs:

| Consumer family | Declared edges |
|---|---:|
| R | 45 |
| L | 84 |
| S | 25 |
| Total | 154 |

Mechanical reconciliation passes:

- all 154 targets resolve;
- every LEAF dependency has a matching dependency evidence component;
- every dependency evidence component maps back to a declared LEAF
  dependency;
- zero dependency cycle exists; and
- every transitive evidence path terminates in a permitted typed `SRC2`
  root.

Semantic review passes 152 of the 154 declared edges. The two failing
declared edges and the one omitted necessary direct edge are all confined to
`CBA2-R07.1`/`EV2-0641`, as described above.

## Source and evidence result

The official immutable artifacts were independently re-acquired:

| Artifact | Bytes | Pages | SHA-256 | Result |
|---|---:|---:|---|---|
| 2023 NBA-NBPA CBA | 2,850,534 | 676 | `bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32` | Exact `SRC2-001` match |
| NBA Constitution and By-Laws, June 2024 | 422,247 | 88 | `be4d2781fe8fddfc5bc9028214298f742789a949dade4ead26368a4336d32ccf` | Exact `SRC2-002` match |

For finding 5, CBA Article VII §4(c), printed p. 217, states that upon
assignment the assignee Team includes the entire Salary for the current and
all future Salary Cap Years in Team Salary. `EV2-0579` now states that exact
proposition and keeps waiver-request, claim, priority, and acquisition
mechanics separate under the By-Laws evidence. This repair passes.

The current R/L/S evidence population also passes the structural and source
root audit:

- 214 active owners over stable allocated namespace `EV2-0577`–`EV2-0817`;
- 110 CBA, 75 INFERRED, 12 EXT, 11 BYL, 4 DERIVED, and 2 NBA components;
- zero owner, authority-class, source-resolution, cycle, or terminal-root
  defect; and
- all 27 retired evidence identities are absent from the active registry and
  from current references.

The live 2025–26 official schedule page still states an October 21, 2025
opening and April 12, 2026 close. Its live bytes have changed from the
recorded capture, as permitted by the `official-mutable` limitation:
117,332 bytes and SHA-256
`83aff2a1101256e85f42f8ae9fc77bcda81db6653448b43979f430abcc3138b8`
at this review, versus the pinned capture in `SRC2-005`. This mutable-page
drift does not reverse finding 6 and is not a rejection basis.

## Canonical-ownership result

The duplicate-owner correction passes.

- All duplicate sets enumerated by the focused rejection now have one direct
  owner, or a surviving staged/ledger owner with a distinct output and exact
  dependencies.
- The five R-family and twenty-two L-family retired identities are absent
  from all current main/detail/evidence/dependency/Origin/target surfaces.
- The population-wide note-bearing, staged-output, same-locator, and
  normalized-text candidate audit found no additional duplicate verdict
  owner.
- Similar surviving pairs are distinct by trigger or output: waiver request
  versus waiver claim irrevocability; pre-2024 versus 2024-and-later
  second-round tender branches; Active versus combined-list shortage
  allowances; League versus Team suspension routes; and staged status versus
  direct component results.
- Accepted preservation anchors `CBA2-A02.8`, `CBA2-A12.4`,
  `CBA2-A12.5`, and `CBA2-A12.7` remain the direct accepted owners.

## Historical fragments, lineage, and preservation

Independent reconstruction produced:

- 134 published R/L/S historical LEAFs: 47 R, 72 L, and 15 S;
- 145 current fragments: 51 R, 73 L, and 21 S;
- 145 current reciprocal R/L/S edges;
- 143 R6 edges in `XW2-0357`–`XW2-0499`, plus accepted
  `XW2-0160`/`XW2-0161`;
- all seven compound inventories partitioned exactly into seventeen current
  fragments with ten additional edges;
- zero normalized-span gap, overlap, quote mismatch on quoted current edges,
  orphan fragment, unregistered fragment token, source mismatch, target
  mismatch, or Origin reciprocity defect; and
- all fifteen retargeted R6 edges resolving to current sole owners with
  current reciprocal Origin entries.

Preservation is exact:

- all 568 accepted A/C main rows are byte-identical to accepted R5;
- all 568 accepted A/C detail rows are byte-identical to accepted R5;
- `EV2-0001`–`EV2-0576` are byte-identical to accepted R5;
- every physical `SRC2-001`–`SRC2-004` base/detail row is byte-identical;
- the accepted anchors named above are byte-identical on both main and detail
  surfaces; and
- no ID was renumbered or reused.

## Frozen validator

Command:

```text
python3 work/architect-completion/cba_canon_v2_foundation_validator.py
```

Result:

- all 123 controls behaved as expected;
- 14 accepting controls accepted;
- 109 rejecting regression controls rejected;
- the negative self-test succeeded; and
- process exit was `1` only because the committed baseline still reports the
  same seven inherited future-plan diagnostics:
  1. R5 does not require independent R4 acceptance;
  2. R6 does not require independent R5 acceptance;
  3. R7 does not require independent checker acceptance of R3.1 and R4–R6;
  4. R8 does not depend on independently accepted R7;
  5. R8 does not explicitly exclude README/code-map/runtime/Phase-2
     expansion;
  6. R9 input is not a pinned clean topic checkpoint; and
  7. R9 does not require both reviewer and owner acceptance to close Phase 1.

No new validator diagnostic appeared.

## Documentation and scope validation

The only authorized write is this checker record. Pre-commit validation of
the final file state produced:

- targeted `npx markdownlint` on this file: PASS;
- `npm run docs:guardrails`: PASS;
- `npm run validate:project`: PASS; and
- `git diff --check` plus pre-commit scope inspection: PASS, with exactly
  this one untracked checker path and no modified tracked file.

Post-commit validation must confirm the exact one-file commit tree, remote
branch synchronization, and final clean worktree.

Application tests, build, typecheck, schema commands, ESLint, the full test
suite, and Graphify are intentionally excluded because this is a docs-only
focused independent checker and the objective forbids those surfaces.

## Status boundary

This receipt records no maker repair and changes no canon rule.

- R6: **FOCUSED REJECT / BLOCK-R7**
- R7: blocked and unstarted
- Phase 2: untouched
- application/runtime/data: untouched
- Linear and Graphify: untouched
- `main`: untouched at
  `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`
