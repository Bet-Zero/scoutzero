# Architect Governed Season Inputs (BZE-270, BZE-280)

**Scope:** the governed source of date, Salary Cap Year, calendar, team context,
and the five core annual system levels consumed by the BZE-268 dated
salary-ledger path.
**Frozen references:** accepted Canon candidate
`6cf8aaf358c158a88e630e8a7336f7e9c3febc17`, canon SHA-256
`23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76`, accepted
Phase 2 gap register `19dc84fc4050ce9cf749136dae1f9854adc72ef7`, accepted audit
summary `4b21456d491f9593edc2961afae47ef64ae28e32`, BZE-268 accepted head
`55ddde0dbf189c61b03f96833ad22c6847308b97`.

---

## 1. What this establishes

One explicit, versioned, fail-closed envelope. A caller asks for a date, a
Salary Cap Year, an authority class, and a team; it gets back either every
governed input it asked for, or a precise statement of what is missing. There is
no partial and no best-effort result.

The five governed core levels are the Salary Cap, Minimum Team Salary (floor),
Tax Level, First Apron, and Second Apron.

Every resolved value retains:

| Retained                        | Where                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| Official vs projected authority | `record.authority`, `manifest.requiredAuthority`                                       |
| Exact source artifact           | `record.sourceRecordId` + `sourceRecordVersion`, and `manifest.*.sourceArtifactSha256` |
| Exact source field identity     | `record.sourceField`, and `manifest.*.sourceField`                                     |
| Record version                  | `record.recordVersion`                                                                 |
| Effective period                | `record.effectiveFrom` / `effectiveUntil`                                              |
| Availability state              | `available` / `unavailable` / `unresolved-conflict`                                    |
| Canon traceability              | `record.canonLeafIds`                                                                  |
| Source authority boundary       | `manifest.*.sourceAuthorityClass`                                                      |
| Post-Canon retained evidence    | `manifest.postCanonSources`                                                            |

The manifest keeps the source field and artifact hash, not just the source
version, so a registry that reuses a source version while pointing at a different
artifact or quoting a different field cannot certify an earlier result as
current.

The accepted Canon remains the sole normative authority for CBA rule meaning.
The separately named `POSTCANON-SRC-*` lane can certify only retained,
first-party, time-varying factual inputs published after the Canon freeze. Its
records carry `canonLocator: null`; any `canonLeafIds` on a value sourced there
trace the rule that governs the value and do not claim the source was in or
certified by the Canon.

## 2. Rules the resolver enforces

1. A complete result requires an explicit zoned `asOfDate`, a requested Salary
   Cap Year, an explicit authority class, a team context, a matching calendar
   record and version, and all five core system-level records.
2. Date, Salary Cap Year, and calendar must reconcile. The Salary Cap Year runs
   July 1 through June 30 Eastern; the as-of date must fall inside it, and the
   calendar must be keyed to that season with its own dates inside that year.
3. Unsupported seasons, missing records, and unresolved conflicts stay
   unavailable.
4. No substitution of runtime today, current year, a prior season, a different
   ledger, or an unversioned copied constant.
5. Official and projected records never stand in for each other. The authority
   class is a required input precisely so it is never chosen silently.
6. A source revision appends a new versioned record; the earlier evaluated
   result keeps the values and record versions it was computed from. Verifying
   an old manifest against a revised registry reports drift instead of
   rewriting the result. Drift is reported per input as `record-absent`,
   `record-superseded`, or `content-changed`; the last means the record kept
   its version while its governed content moved, which is why it outranks a
   plain supersession in the overall verification state.
7. Registry construction clones and deeply freezes every record and nested
   object, so a caller that retains the input objects cannot alter a validated
   registry — including the `CANON_GOVERNED_SEASON_REGISTRY` singleton.
8. One `sourceRecordId@sourceRecordVersion` must identify exactly one artifact;
   a duplicate key is rejected at construction rather than silently collapsed.
9. A post-Canon source must be official, use the `POSTCANON-SRC-*` namespace,
   resolve to the certified first-party host, retain exact bytes and matching
   fingerprint metadata, and name the exact fields it can authorize. It cannot
   carry a Canon locator, use weaker provenance, or authorize an unlisted field.
10. A complete manifest retains the unchanged accepted Canon candidate and
    fingerprint plus every post-Canon source record, version, certification,
    official URL, and retained artifact fingerprint actually used.
11. Pre-BZE-280 manifest version 1 remains verifiable for Canon-only inputs. It
    cannot authorize a post-Canon source because it has no post-Canon lineage
    field; such a use is a content mismatch.

## 3. What the governed evidence actually covers

The frozen Canon-certified records remain unchanged:

| Source record | Salary Cap Year | Certifies                                                                          |
| ------------- | --------------- | ---------------------------------------------------------------------------------- |
| `SRC2-003`    | 2024 (2023-24)  | Salary Cap $136.021M **only**                                                      |
| `SRC2-004`    | 2027 (2026-27)  | Salary Cap, Minimum Team Salary, Tax Level, First Apron, Second Apron — all five   |
| `SRC2-005`    | 2026 (2025-26)  | Regular Season opening 2025-10-21 and closing 2026-04-12 — no transaction deadline |

One separately certified post-Canon factual source is appended:

- Record: `POSTCANON-SRC-0001@1` /
  `POSTCANON-CERT-0001@1`.
- Official artifact: NBA Communications, “2026-27 NBA regular-season
  schedule,” published 2026-08-13 at
  `https://pr.nba.com/2026-27-nba-regular-season-schedule/`.
- Retained capture: 122,319 bytes, SHA-256
  `2470130997194e83e2419cb272cb384473fe3444a8b2e4fd85b30608daf86c3f`,
  verified by two matching first-party retrieves on 2026-08-17.
- Certified fields: Regular Season opening `2026-10-20` and closing
  `2027-04-11`.
- Limitations: two games per team remain unassigned for the NBA Cup window from
  Dec. 4 through Dec. 10. Those games are inside the Regular Season and do not
  affect either endpoint. The source certifies no trade deadline or final NBA
  Cup game assignments.

The earlier authority-gate fingerprint
`0169bb5c78a5ddd0727254dcc991222fbe4e82407b3ba36f60dcc038f002fb18`
(122,306 bytes) is preserved only as gate history. Mutable-page drift
superseded it before implementation, its bytes were not retained, and it has no
runtime authority or usable source version.

Current shipped behavior:

- 2026-27 resolves complete: its unchanged five `SRC2-004` levels combine with
  the `POSTCANON-SRC-0001` calendar.
- 2025-26 resolves the calendar and has no level records.
- 2023-24 resolves the Salary Cap and has neither the other four levels nor a
  calendar.

The repo's `capProjections` constants carry values for missing seasons, but they are
unversioned copies with no source artifact, exact field, retrieval metadata, or
record version — the precise defect `CBA2-S01.3` and `CBA2-S02.5` describe.
Seeding them would launder an ungoverned constant into the governed path, so
they are excluded.

Never widen an existing record's effective period to cover a season its source
never stated. A later source revision appends both source and governed-record
versions; it never edits the earlier evaluation or silently changes the bytes
that evaluation cites.

## 4. Compatibility fence

BZE-270 establishes a governed path; it does not migrate the application onto
it. Both paths exist on purpose.

- **Governed side:** `src/features/architect/utils/governedSeason/**` and
  `capTotals/governedDatedSalaryLedgers.ts`.
- **Legacy side:** `capProjections`, `capRulesProfile`, `capSettingsProvider`,
  `minimumSalaryScales`, and `mutationPipeline.read.utils` — all unchanged,
  including the runtime-clock fallback in `resolveWorldAsOfDate`.

Fence rules, enforced by `tests/architect/governedSeason/compatibilityFence.test.ts`:

1. The governed path never imports a legacy season-input module.
2. The legacy path never imports the governed path.
3. Crossing the fence is a migration, done per consumer, with its own issue and
   tests. Nothing in BZE-270 authorizes it.

No legacy consumer is fixed by this work. Cap Sheet, Trade Machine, Free
Agency, contracts, persistence, and UI all still read the legacy values.

## 5. Audit position

Established on this path only (not product-wide):

- `CBA2-L01.1` — explicit as-of date and Salary Cap Year required, no runtime
  default, on the governed path.
- `CBA2-L01.9` — calendar records retain source record, publication date,
  season key, version, supersession, and the authority boundary used.
- `CBA2-S01.6` — the 2025-26 endpoints under `SRC2-005` and the separately
  certified 2026-27 endpoints under `POSTCANON-SRC-0001` are not reusable for
  another season.
- `CBA2-S01.9` — official and projected are separate populations with no
  substitution and no prior-season inheritance.
- `CBA2-S02.1`, `CBA2-S02.2`, `CBA2-S02.5`, `CBA2-S02.6` — versioned immutable
  records, conflict blocking, full source metadata, and result manifests
  retaining exact input versions.

Prepared but not closed:

- `CBA2-L01.2` — the calendar model derives no elapsed-Season-day convention
  yet.
- `CBA2-S01.3`, `CBA2-S01.4` — only the five core levels are governed; the
  wider parameter set is not.
- `CBA2-S02.3`, `CBA2-S02.4` — one canonical owner exists for the five core
  levels on the governed path, but the legacy copies remain behind the fence.

Explicitly still open: every leaf's product-wide state, all BZE-268
dependencies (`CBA2-A01.1`, `CBA2-C07.1–.11`, `CBA2-C08.1–.8`), and everything
listed as out of scope in BZE-270.
