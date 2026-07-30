# Architect CBA Canon v2 — R6 final bounded independent re-review

Date: 2026-07-30

Checker: `agent:codex`

Review type: final bounded independent checker; read-only audit followed by
this one authorized checker record

Reviewed maker checkpoint:
`8bd95b311075f17fa88b17c06b06fbbb07d1b4fb`

Checkpoint parent and binding corrected rejection baseline:
`67f6545dec5bf36020a968553701106fee2e9258`

Original final-checker record commit:
`cbb847dbef844dc0b43d7cb46b25659353fb42e0`

## Verdict

**ACCEPT**

Exact checkpoint `8bd95b311075f17fa88b17c06b06fbbb07d1b4fb`
is independently accepted for R6.

`DR2-0140` closes the sole remaining `CBA2-R07.1` / `EV2-0641`
dependency-and-evidence finding. All earlier R6 findings remain resolved.
R6 is complete, and rule-register construction is complete.

R7 is unblocked but remains unstarted. No R7, Phase 2, application, Linear,
Graphify, or `main` work was performed.

## Checkpoint and scope gate

The review began read-only after fetching current remote refs.

- Repository remote:
  `https://github.com/Bet-Zero/scoutzero.git`.
- Branch: `architect/cba-canon-v2`.
- `HEAD`, the local branch, and `origin/architect/cba-canon-v2` all resolved
  to `8bd95b311075f17fa88b17c06b06fbbb07d1b4fb`.
- The branch was clean and synchronized.
- The direct parent was exactly
  `67f6545dec5bf36020a968553701106fee2e9258`.
- The maker checkpoint was exactly one commit above that parent.
- Local and remote `main` both remained at
  `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`.

The maker commit changes exactly these three files:

1. `docs/reference/cba/ARCHITECT_CBA_CANON.md`
2. `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md`
3. `work/architect-completion/ARCHITECT_CBA_CANON_V2_R6_R_L_S_SERIES_CERTIFICATION.md`

The expected blobs are exact:

| Artifact | Blob SHA-1 |
|---|---|
| Canon | `6babf3eef3becc361c3ba75fdaba025f239299fd` |
| Repair plan | `a9f015abd204f4c11e16b62291ee197b96c6c9fd` |
| R6 maker receipt | `7c4ca64b7b8d8b2a749d4a24ea32620fac3ea8dd` |
| Final corrected checker record | `b6c5b57bef9462b409f6392a460b1b58ac10a6c6` |
| Prior focused checker record | `74c67dc2acf61966a91e849e2900bdd311b8b319` |
| Original checker record | `392bcc7af3357b26ea559380ea3ad9b419b469aa` |

## Binding review boundary

The final corrected checker record at `67f6545d` is the binding baseline.
It established that findings 1, 2, 3, 5, 6, and 7 passed or remained
preserved, the lifecycle-input portion of finding 4 passed, and the sole
remaining defect was the dependency/evidence chain for `CBA2-R07.1` /
`EV2-0641`.

This review independently checked that repair and its direct preservation
boundary. It did not repeat the already-closed full R6 semantic audit or
reopen a passed finding without a regression.

The exact bounded diff confirms:

- the `CBA2-R07.1` main requirement and stable identity are unchanged;
- only its detail dependency/input/decision-record row changed;
- only `EV2-0641` changed in the R/L/S evidence population;
- only the current R/L/S status summary changed elsewhere in the canon;
- the plan changes record the corrected rejection baseline, bounded repair,
  current totals, and truthful awaiting-review status; and
- the maker-receipt changes add the bounded repair explanation,
  `DR2-0140`, its two structured detail rows, corrected totals, validation,
  and truthful awaiting-review status.

No unrelated canon record, earlier decision or AMEND record, prior checker
record, or source record changed.

## Independent source review

The checker reacquired the official signed 2023 NBA-NBPA CBA from the
`SRC2-001` official URL.

| Property | Independently observed result |
|---|---|
| Bytes | `2,850,534` |
| PDF pages | `676` |
| SHA-256 | `bf178ca0f2d64f9dfe6fde095d3ae43d576b12e19ce7a679618d632584f7ab32` |
| `SRC2-001` match | Exact |

Printed pages 429–431 establish:

- Article XXIX §1: the temporary eleven-player Active List allowance, its
  two-consecutive-week and twenty-eight-total-day clocks, and the separate
  eight-player game-bench floor;
- §2(a) and §2(c): the ordinary fourteen-to-fifteen combined-list band and
  its per-Two-Way-player increment;
- §2(b): the temporary twelve-or-thirteen combined-list allowance, its two
  clocks, and the distinct end-of-day qualifying-day rule; and
- §5(a): after the signed two-Season trigger, the permanent
  Standard-contract minimum becomes fifteen and the temporary combined-list
  shortage band becomes thirteen or fourteen for the same clock periods.

The source separates the game-bench floor and ordinary Two-Way maximum from
the two shortage-clock ledgers. The corrected evidence treatment is
consistent with that separation.

## Dependency repair

`CBA2-R07.1` now has exactly these dependencies:

1. `CBA2-R06.8`
2. `CBA2-R06.9`
3. `CBA2-R06.10`
4. `CBA2-R06.11`
5. `CBA2-R06.15`

`CBA2-R06.12` and `CBA2-R06.14` are absent.

The five current joins each supply a result consumed by the ledger:

| Dependency | Consumed result | Independent conclusion |
|---|---|---|
| `CBA2-R06.8` | Ordinary combined-list band and Two-Way increment | Required to identify the ordinary combined-list shortage band; supported by XXIX §2(a), §2(c). |
| `CBA2-R06.9` | Dated end-of-day qualifying-day result | Required to persist which combined-list dates count; supported by §2(b)'s final sentence. |
| `CBA2-R06.10` | Combined-list consecutive and Season-total clock results | Required to persist both combined-list clocks; supported by §2(b)(i) over the direct qualifying-day owner. |
| `CBA2-R06.11` | Active-list allowance and its two clock results | Required to persist the separate Active-list shortage band; supported by §1. |
| `CBA2-R06.15` | Effective §5(a) adjustment state, result, and date | Required to select the adjusted shortage band when the permanent trigger is effective; supported by §5(a). |

No required direct dependency is omitted. No redundant or unrelated
dependency remains. The ledger consumes direct results and their versions;
it does not consume the game-level bench-floor verdict or ordinary
Two-Way-maximum verdict.

The lifecycle contract explicitly identifies:

- Team and Season;
- each relevant date;
- end-of-day Active-list and combined-list counts;
- each direct result ID and version;
- the §5(a) effective-adjustment state and effective date;
- the prior ledger version; and
- the requested as-of date.

This is sufficient for a versioned, dated persistence result without silently
recomputing a component verdict.

## Evidence repair

`EV2-0641` now has exactly these evidence dependencies:

1. `EV2-0632`
2. `EV2-0633`
3. `EV2-0634`
4. `EV2-0635`
5. `EV2-0639`

`EV2-0636` and `EV2-0638` are absent. The evidence dependency set matches the
LEAF dependency set one-to-one.

The locator now covers Article XXIX §1, §2(a)–(c), and §5(a), printed pages
429–431. Its controlling-passage summary correctly distinguishes the
Active-list allowance/clock, ordinary combined-list band, qualifying-day
predicate, combined-list clock, and possible permanent shortage-band
adjustment. Its mapping and inference explain that the ledger selects the
effective band and persists the versioned direct results. Its limitation
expressly excludes the game-bench-floor and ordinary Two-Way-maximum
verdicts.

The corrected chain therefore satisfies the frozen evidence rule for an
`INFERRED` component: every consumed component is identified, each path
terminates at the typed signed-CBA source, and no unlisted input is used.

## `DR2-0140` lineage

`DR2-0140` is a valid current `AMEND` record.

- It identifies
  `67f6545dec5bf36020a968553701106fee2e9258` as the prior checkpoint.
- Its generic row names the exact rejected `CBA2-R07.1` / `EV2-0641`
  finding, direct semantic consumption, matching LEAF/evidence dependencies,
  stable identity, and no unrelated change.
- Its structured LEAF row revises `CBA2-R07.1` directly to the same current
  identity.
- Its structured EV2 row revises `EV2-0641` directly to the same current
  identity.
- `CBA2-R07.1` cites `DR2-0140` in its current decision-record field.
- The prior checkpoint contains both prior identities, and both current
  endpoints resolve directly.
- All earlier generic decision rows and AMEND detail rows are unchanged.

No rule or evidence identity was minted, retired, renumbered, deleted, reused,
or reassigned by this bounded repair. The new governed identity is only the
required forward `DR2-0140` AMEND record.

## Graph and population reconciliation

The complete active R/L/S dependency graph reconciles:

| Check | Result |
|---|---:|
| Current R/L/S dependency edges | 153 |
| Previously passing edges preserved unchanged | 152 |
| Necessary new join | 1 |
| Consumers with dependencies | 42 |
| Missing or inactive targets | 0 |
| LEAF/evidence join mismatches | 0 |
| Dependency cycles | 0 |

The exact delta from the binding baseline is:

- add `CBA2-R07.1` → `CBA2-R06.15` and paired
  `EV2-0641` → `EV2-0639`;
- remove `CBA2-R07.1` → `CBA2-R06.12` and paired
  `EV2-0641` → `EV2-0636`; and
- remove `CBA2-R07.1` → `CBA2-R06.14` and paired
  `EV2-0641` → `EV2-0638`.

All 153 edges point from staged consumers to results they consume, have active
targets, reconcile to their evidence joins, and are acyclic. The five current
`CBA2-R07.1` joins pass the semantic review above; the other 152 edges are
byte-preserved from the binding baseline that passed them.

Current R/L/S populations:

| Population | R | L | S | Total |
|---|---:|---:|---:|---:|
| GROUPs | 10 | 10 | 4 | 24 |
| Active LEAF main rows | 85 | 102 | 27 | 214 |
| Active LEAF detail rows | 85 | 102 | 27 | 214 |
| Active evidence owners | 85 | 102 | 27 | 214 |

Additional reconciliation results:

- 27 prior LEAF identities and 27 paired evidence identities remain
  governed retirements: 25 merge lineages plus two split lineages in each
  population.
- The stable allocated R/L/S evidence namespace remains
  `EV2-0577`–`EV2-0817`, with 214 active owners and 27 retired gaps.
- 134 historical R/L/S obligations remain reconciled as 47 R, 72 L, and
  15 S.
- 145 current fragments/edges remain reconciled as 51 R, 73 L, and 21 S:
  the 143-edge R6 block plus accepted `XW2-0160` and `XW2-0161`.

## Preservation

Exact comparison to `67f6545d` confirms:

- all 568 accepted A/C main rows are unchanged;
- all 568 accepted A/C detail rows are unchanged;
- accepted evidence `EV2-0001`–`EV2-0576` is unchanged;
- every `SRC2` base and detail record is unchanged;
- every R/L/S main requirement is unchanged;
- the only changed R/L/S detail record is `CBA2-R07.1`;
- the only changed R/L/S evidence record is `EV2-0641`;
- every `XW2` edge and historical-fragment surface is unchanged;
- all earlier decision and AMEND records are unchanged;
- all three prior checker records retain their exact expected blobs;
- the active R7 scenario population remains intentionally empty; and
- `main` remains stable at `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`.

No direct regression exists on a previously passed R6 surface.

## Frozen validator

Command:

```text
python3 work/architect-completion/cba_canon_v2_foundation_validator.py
```

Result:

- all 123 frozen controls behaved as expected;
- 14 accepting controls accepted;
- 109 rejecting regression controls rejected;
- the negative self-test succeeded;
- no R6-local diagnostic appeared; and
- process exit was `1` only for the same seven inherited future-plan
  diagnostics:
  1. R5 does not require independent R4 acceptance;
  2. R6 does not require independent R5 acceptance;
  3. R7 does not require independent checker acceptance of R3.1 and R4–R6;
  4. R8 does not depend on independently accepted R7;
  5. R8 does not explicitly exclude README/code-map/runtime/Phase-2
     expansion;
  6. R9 input is not a pinned clean topic checkpoint; and
  7. R9 does not require both reviewer and owner acceptance to close
     Phase 1.

## Documentation and scope validation

The final pre-commit state passes:

- targeted `npx markdownlint` on this checker record;
- `npm run docs:guardrails`;
- `npm run validate:project`;
- `git diff --check`; and
- exact scope inspection showing only this one new checker record.

Application tests, build, typecheck, schema commands, ESLint, the full
application suite, unrelated validation, and Graphify regeneration were
intentionally not run because the objective excludes those surfaces.

## Acceptance boundary

- R6: **complete and independently accepted**
- Rule-register construction: **complete**
- R7: **unblocked but unstarted**
- Phase 2: untouched
- Application/runtime/data: untouched
- Linear: untouched
- Graphify: untouched
- `main`: untouched at
  `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`

This checker created no maker repair and changed no canon content.
