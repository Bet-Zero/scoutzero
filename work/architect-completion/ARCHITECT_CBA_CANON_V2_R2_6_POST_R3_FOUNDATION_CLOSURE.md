# Architect CBA Canon v2.0 — R2.6 Receipt: Post-R3 Foundation Closure

## 1. Provenance, baseline, and clean-state proof

| Field | Value |
|---|---|
| Repair unit | R2.6 — post-R3 foundation closure: the three foundation-level contradictions exposed by the independent Codex review of R3, closed in the governing standard only. No committed R3 record repaired; no concrete v2 record minted |
| Branch | `architect/cba-canon-v2` |
| Baseline commit | **`07f0667d8cc55a6b86bd4c3fabada5d9b6d7d956`** — the rejected R3 checkpoint, verified at session start as HEAD = `origin/architect/cba-canon-v2` (ahead/behind vs upstream 0/0); direct parent = `6d9c7576afa682a7d89519f02315321ed74e8509` (R2.5, the previously accepted foundation); R2.4 = `e0344aac…`; R2.3 = `c2228607…`; R1.2 = `07d5aa58…`; R2.2 = `6aa616fd…`; R2.1 = `05c1b28e…`; R1.1 = `1532c928…`; R2 = `056b9d02…`; R1 = `af931e90…` |
| `main` | `main` = `origin/main` = `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288` — untouched by this unit |
| Clean-state verification | `git status --porcelain` empty at session start: worktree, index, and untracked state completely clean |
| Ordering review | The independent Codex review of the R3 checkpoint at `07f0667d…` returned **REJECT/BLOCK-R4**: no R3 active record is accepted, the A series is **not certified**, and R4 remains blocked. The R3 receipt remains immutable review history even though R3 was rejected. The review's three foundation-level contradictions are closed by this unit; its A-series findings are preserved as the bounded R3.1 backlog (§15 below) and are **not implemented here** |
| Scope | Foundation contract (canon §15.9.3/§15.9.4/§15.9.6 and the gate texts), repair-plan status/sequencing/backlog, truthful current-status surfaces, and header/amendment history only. The active §15.10–§15.12 record population is byte-identical to `07f0667d…` (§14 below) |
| Edition status after R2.6 | Canon v2.0 **working draft** — not accepted, not active; **R2.6 is not independently accepted**; R3.1 and R4 remain blocked pending an independent Codex ACCEPT of this foundation; v2.0 checksum deliberately **not** computed (R8) |

## 2. Files changed — exactly three

1. `docs/reference/cba/ARCHITECT_CBA_CANON.md` — the §15.9.3
   `unsupported-residual` edge type, per-fragment decision order,
   narrow nine-condition rule, qualified completeness duty, and
   crosswalk-validation additions; the §15.9.4 `DISP` decision-record
   type, `OWN` row correction, candidate-disposition wording, OWN/DISP
   boundary, and pre-R2.6 transition rule; the §15.9.5 A18.7
   closed-provisional-item correction; the §15.9.6 month-precision
   `YYYY-MM` rule (grammar block, base-grammar subject-to clause,
   `official-immutable` detail parenthetical, per-type validity-matrix
   cell, field-level validation paragraph); the §15.9.8 reasoned
   SXW2-vocabulary decision; the U5/U7/U8/U9/G3/G14/R9 gate texts; the
   §15.9 heading and intro receipt reference; the §12.12 candidate
   annotation; the §19.3 A-family truthful-status paragraph; the header
   "What v2.0 changes" R2.6 sentences; and one new amendment-log row.
2. `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md` —
   status brought current (foundation ACCEPT for R3 construction at
   `6d9c7576…`; R3 executed at `07f0667d…`; independent Codex REJECT/
   BLOCK-R4 of R3; the strict R2.6 → review → R3.1 → review → R4
   sequence); global rule 1; the R2.5 outcome; the R3 outcome; the new
   R2.6 unit section; the new R3.1 unit section carrying the complete
   fifteen-item Codex backlog; the R4 dependency; and the R8 (G3/G14)
   and R9 gate restatements conformed to the corrected canon gates.
3. `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_6_POST_R3_FOUNDATION_CLOSURE.md`
   — this receipt (new).

Nothing else. No earlier receipt was edited — including the rejected R3
receipt, which is immutable review history. No application, README,
code-map, test, schema, fixture, configuration, or data file changed;
Linear was not read or written; no PDF was committed.

## 3. Primary/first-party research — A18.7 re-trade attribution (Correction 1 input)

Bounded search performed this session for qualifying authority
(§15.9.5–§15.9.6) for the re-trade attribution/accounting mechanics of
conditional cash (the historical `CBA-A18.7` residual fragment):

| Source searched | Method and result |
|---|---|
| Signed 2023 NBA–NBPA CBA, VII §8(a), p. 260 | Controlling passage certified in the R3 session against the hash-verified artifact (SHA-256 `bf178ca0…`); the express text charges cash "in connection with one (1) or more trades occurring during a Salary Cap Year, directly or indirectly" to that Salary Cap Year's limits and **does not state re-trade attribution/accounting mechanics**. R2.6 relies on that R3-session certification and did not re-read the artifact; no later CBA edition exists under the July 12, 2026 authority cutoff |
| Official 2024-25 CBA 101 (`https://official.nba.com/wp-content/uploads/sites/4/2024/11/2024-25-CBA-101.pdf`) | Re-downloaded this session (528,881 bytes, 34 pages, SHA-256 `9e643abebd0710904a9b221b71ee76ad0eab96d18fb629a187743880dda8e83f`, retrieved 2026-07-16). Its §(3) "Cash Transfers" states only the annual paid/received limit, the cap-rate growth rule, the no-netting rule, and one example. **Zero content on conditional cash or re-trade attribution**; the only "subsequent trade" language is the exhausted-limit example and the §6(j)(4) aggregation passages |
| June 2024 NBA Constitution and By-Laws | Re-downloaded this session and hash-verified against the committed SRC2-002 value (422,247 bytes, 88 pages, SHA-256 `be4d2781fe8fddfc5bc9028214298f742789a949dade4ead26368a4336d32ccf` — exact match). Full-text sweep: the **only** cash mention is BYL 7.03's first-round-pick cash-sale bar; BYL 4.01–4.05 (trading procedure) carry no cash-attribution mechanics |
| Official NBA web surfaces (`official.nba.com`, `pr.nba.com`) | Web searches for conditional-cash/re-trade attribution statements on official surfaces located none. A newer CBA 101 edition was searched for and not located; the 2024-25 edition remains the current official explanatory publication |
| Secondary reporting (discovery only) | CBAguide's General Trade Rules page describes a re-trade attribution mechanic (re-charging cash at each subsequent trade of the conditional asset). Under §15.9.6 this is **discovery-only** material: it establishes no authority class, cannot serve as OPS provenance, and is recorded here solely as the discovery trail |
| First-party operational provenance | No authenticated league/club operational artifact, communication, system record, or recorded attestation is available to this unit; none was located |

**Conclusion (honest form): no qualifying authority for the re-trade
attribution/accounting mechanics was located in the searched sources.**
This is not a claim that none exists or ever existed. The fragment
remains in scope and remains a preserved discovery candidate (§12.12).
Because qualifying authority was not located, Correction 1 proceeds as
the typed `unsupported-residual` disposition standard (§7 below); no
future active LEAF was minted and no R3 record was changed in R2.6.

## 4. Primary evidence — By-Laws publication/effective date (Correction 3 input)

| Evidence checked | Result |
|---|---|
| The June 2024 By-Laws artifact itself | Re-downloaded from the official URL this session; SHA-256 `be4d2781…` — **exact match to the committed SRC2-002 hash**, so the artifact examined is the artifact of record. Cover states exactly **"JUNE 2024"** — month precision. Full-text inspection located no exact publication, adoption, or effective day anywhere in the authority; Constitution Article 40 ("Effective Time") governs computation of time periods, not the document's own date |
| Embedded PDF metadata | `/CreationDate` = 2024-06-07T12:23:25-04:00; `/ModDate` = 2024-06-07T12:23:53-04:00; `/SourceModified` = 2024-06-07. These are file-production timestamps: they establish **no publication or effective date**, and under the R2.6 grammar they are a prohibited basis for a semantic day |
| Official first-party surfaces | Searched for an NBA announcement or page stating an exact publication/effective day for the June 2024 edition; none located. (Contrast located during search: the NBA's 2012 edition cover carried a full date, "May 29, 2012" — when the league intends day precision on this document class, it states it; the June 2024 edition states only a month) |

**Conclusion (honest form): no supported exact publication/effective
day was located in the searched sources; the authority itself supplies
month precision only ("JUNE 2024").** Correction 3 therefore amends the
grammar to preserve exactly that precision (`2024-06`) rather than
fabricating a day. SRC2-002 itself — whose committed base row carries
the metadata-derived 2024-06-07 — was **not** repaired in R2.6; that is
R3.1 backlog item 5. Under the corrected grammar the committed value is
non-compliant by design: that defect is exactly what the R3 rejection
found, and R3.1 repairs it through `AMEND` lineage.

## 5. Honest conclusions of record

1. **A18.7 re-trade attribution:** no qualifying authority was located
   in the searched sources. Never stated as "none exists."
2. **By-Laws date:** no exact day was located in the searched sources;
   the authority supplies month precision only. Never stated as "no
   exact day exists."

## 6. Before/after foundation-contract tables

| Contract surface | Before (R2.5 edition at `07f0667d…`) | After (R2.6) |
|---|---|---|
| XW2 edge types (§15.9.3) | Eight types; terminal = `process-only`/`invalid`/`no-successor` | Nine types; terminal = `process-only`/`invalid`/`no-successor`/`unsupported-residual` (narrow nine-condition rule) |
| Edge-typing decision order | "applied per historical LEAF, stopping at the first test that matches" — ambiguous for compound history | Applied per historical LEAF **and, for compound history expressed as multiple edges, per named fragment**; terminal step extended with the unsupported-residual test after `no-successor` |
| Completeness duty | Every valid in-scope obligation discovered during R3–R6 has an active v2 owner — impossible to satisfy honestly for an in-scope residual with no located authority | Owner required **where qualifying authority is located**; an in-scope residual whose authority is not located in the searched sources is typed `unsupported-residual` and preserved — never silently dropped, never registered without authority, never left as prose on another edge |
| Crosswalk validation | Reciprocity, duplicate-pair, valid-target, coverage, terminal-edge, no-successor checks | Same, plus unsupported-residual validation and terminal-edge `DISP` resolution (post-R2.6 directly; committed pre-R2.6 records through `AMEND` chains) |
| Decision-record types (§15.9.4) | `OWN`/`ATOM`/`TG`/`MOVE`/`ORIGIN`/`METHOD`/`AMEND`; no terminal-disposition type (R3 receipt §11 records this gap expressly) | Adds `DISP`; `OWN` restated as ownership-only; binding OWN/DISP boundary; duplicate-candidate dispositions may be `OWN`, `DISP` (terminal only), or named deferral |
| Terminal decision records | Carried on `OWN`/`ATOM` (untruthful typing) | Every terminal XW2/SXW2 edge resolves to a `DISP` record; committed R3 records corrected by R3.1 through `AMEND` lineage |
| A18.7 closed provisional item (§15.9.5) | "must become a separate active v2 LEAF during A-series registration" — a mandate impossible to satisfy without authority | LEAF **only if qualifying authority is located**; otherwise the typed `unsupported-residual`/`DISP` disposition with preserved candidacy and `AMEND` reopening |
| §12.12 annotation | "those mechanics become a separate active v2 LEAF during A-series registration…" | Conditional-on-authority wording; unsupported-candidate status; R3.1 disposition; reopening rule |
| SRC2 Publication/effective date (`official-immutable`) | Full `YYYY-MM-DD` required unconditionally — forcing a fabricated day for month-precision sources | `YYYY-MM-DD` where the source states an exact day; `YYYY-MM` only under the four-condition month-precision rule (month-only source; no metadata-derived day; mandatory limitation entry; `official-immutable` base field only) |
| Pinned date grammar | "dates are `YYYY-MM-DD` and must be real calendar dates" | Same, "subject only to the narrow month-precision publication/effective-date rule below" |
| Gate texts | U5 (OWN-or-deferral), U7 (coverage/targets), G3 (terminal + no-successor), U8/U9/G14/R9 (season + verification grammars) | U5 adds the DISP alternative; U7 adds terminal-edge discipline and the unsupported-residual conditions; G3 adds individual unsupported-residual review and DISP typing; U8/U9/G14/R9 add the `YYYY-MM` month-precision rule; R9 adds individual unsupported-residual review and terminal-DISP verification |
| SXW2 vocabulary (§15.9.8) | Seven types (unchanged) | Unchanged — plus the recorded reasoned decision **not** to add `unsupported-residual` (§8 below), and the terminal-SXW2-`DISP` resolution sentence. The sixteen-check SC2 block is byte-identical |

## 7. Final unsupported-residual schema and semantics (as now binding)

- **Token:** `unsupported-residual` — one locked, parseable, kebab-case
  edge-type token in the §15.9.3 closed vocabulary; terminal; target
  `—`.
- **Meaning:** unsupported/unverified in the searched sources — **not
  disproven, not obsolete, not out of scope**.
- **Scope:** only an exactly scoped residual fragment of a compound
  historical obligation, with at least one sibling fragment edge on the
  same historical LEAF and the exact residual fragment stated in
  Scope/relationship. Wholly false claims stay `invalid`; process text
  stays `process-only`; out-of-scope/obsolete wholes stay
  `no-successor`.
- **Preservation:** the fragment's exact historical content and its
  discovery-candidate status are preserved via the named canon anchor
  (for A18.7: §12.12).
- **Force:** no active authority class, no behavioral verdict, no
  application requirement, no enforcement, no configurability — nothing
  while the disposition stands.
- **Anti-abuse:** never usable for inconvenience, deferral, incomplete
  research (the bounded search must be performed and recorded), failed
  certification where authority exists, or avoiding an active owner
  where qualifying authority is located.
- **Decision basis:** a resolving `DISP` record states the searches and
  the honest "not located in the searched sources" basis.
- **Reopening/supersession:** on later qualifying authority — active
  owner minted above the GROUP's high-water mark, non-terminal edge
  recorded, the `unsupported-residual` edge removed via `AMEND` with a
  superseding disposition, every live reference updated in the same
  commit, no ID renumbered or reused.
- **Review:** individual semantic review at R8 (G3) and R9 — every
  disposition, never a sample.
- **Why this is not the rejected retirement/no-successor machinery:**
  it retires no ID, aliases nothing, appends nothing to the historical
  namespace, converts no role, and hides nothing (§15.9.10 untouched).
  Unlike `no-successor` — which discards valid history as outside the
  governed scope — `unsupported-residual` keeps the fragment inside the
  scope, visibly undispositioned-as-obligation, typed, individually
  reviewed, and reopenable. It is the honest middle state the rejected
  machinery never had: neither an owner nor an exit, but a preserved,
  gateable "no honestly mintable owner yet" with a defined path back in.

## 8. SXW2 decision (Correction 1 boundary)

`unsupported-residual` was **not** added to the SXW2 vocabulary — a
reasoned decision, not an omission: scenario dispositions concern
behavioral test coverage of the active library, not obligation
ownership. The published scenarios 1–89 were reviewed for the shape this
type dispositions: scenario 53's conditional-cash variant tests the
**express cap-year charging rule** (an active-owner mechanic), not the
unregistered re-trade residual; scenarios 46/54/55 test mechanics whose
historical rows asserted enforceable OPS authority — false authority
claims whose faithful SXW2 disposition is `invalid`, already in the
vocabulary. No published scenario's tested boundary is an unsupported
residual fragment. If R7 discovers a historical scenario that none of
the seven pinned SXW2 types can disposition honestly, that discovery
returns to a foundation amendment; the vocabulary is never extended
silently. The sixteen-check SC2 block is byte-identical (§14), and every
terminal SXW2 edge now resolves to a `DISP` record.

## 9. Final terminal-decision-record schema and OWN/DISP boundary (as now binding)

`DISP` schema (§15.9.4): decision-record ID; historical source row(s)
and exact fragment scope per edge; related crosswalk edge ID(s);
terminal edge type; evidence and reasoning (per-type: false claim /
process character and destination / scope-or-edition basis / recorded
bounded search with the not-located basis); why no active owner is
selected; whether a non-authoritative discovery candidate is preserved
and its canon anchor; limitations; reopening/supersession condition;
decision status/version. One `DISP` may cover multiple edges only on
one identical basis with every covered edge ID listed.

- **DISP required:** every terminal XW2/SXW2 edge (`process-only`,
  `invalid`, `no-successor`, `unsupported-residual`) from R2.6 forward.
- **OWN still required:** every duplicate candidate whose honest
  resolution selects an active owner (or a named cross-family
  deferral); `OWN` states the candidate set, owner, and discriminating
  tiebreak.
- **Why DISP cannot replace OWN:** a `DISP` record carries no ownership
  tiebreak and selects no owner; using it where candidate owners
  compete would leave the ownership question unadjudicated.
- **Type distinctions inside DISP:** `invalid` = the historical claim
  was false; `process-only` = process/instruction material;
  `no-successor` = valid history, demonstrably out of scope or obsolete
  for the governed edition; `unsupported-residual` = valid in-scope
  residual fragment, qualifying authority not located in the searched
  sources.
- **AMEND correction of mistyped R3 records:** defined in §15.9.4 and
  §11 below; applied by R3.1, never by R2.6.
- **Validation:** unit-local U5 (OWN/DISP/deferral per candidate) and
  U7 (terminal-edge discipline); global G3 (individual review + DISP
  typing) and G15 (AMEND-chain integrity, unchanged text, now also
  carrying the DISP supersessions); R9 (individual review of every
  `no-successor` and `unsupported-residual` disposition; terminal-DISP
  verification directly or through `AMEND` chains).

## 10. Final month/date grammar and provenance-specific rules (as now binding)

- Generic pinned grammar: dates are `YYYY-MM-DD`, real calendar dates,
  subject only to the narrow month-precision rule.
- `YYYY-MM` = four ASCII digits, one ASCII hyphen-minus, two ASCII
  digits `01`–`12`. Valid **only** when all four conditions hold:
  (1) `official-immutable` record, base Publication/effective date
  field only — no other provenance type or field; (2) the source itself
  supplies no exact day (precision never degraded; an approximate day
  can never be treated as exact); (3) no day manufactured from PDF
  creation/modification metadata, URL paths, HTTP headers/timestamps,
  retrieval timestamps, authentication timestamps, or inference —
  day-precision is valid only when the identified official source
  itself states that exact day; (4) a mandatory Record limitations
  entry expressly records the month-only supplied precision.
- Retrieval timestamp, authentication timestamp, and verification date
  requirements are unchanged (full precision under their own grammars)
  and never supply a day to the Publication/effective date field.
- Grammar selection is by provenance type and field, never string
  shape: `2000-01` is a month-precision date only on an
  `official-immutable` Publication/effective date and a season only
  where the `YYYY-YY` season grammar applies (`official-mutable`); no
  field accepts both grammars.
- Per-type matrix: the `official-immutable` Publication/effective date
  cell now states the exact-day-or-month-precision rule; the
  `official-mutable` (date-or-season), `ops-provenance`
  (date-or-window), and `ext-contract` (dated-basis-or-`—`) cells are
  unchanged — month precision exists **only** for `official-immutable`.
- Field-level validation (U8/U9, G14, R9): a metadata-derived day, a
  month value where the source states an exact day, a month value
  without the required limitation entry, or a month value on any other
  provenance type or field each **fail the record**, which then
  certifies nothing.

## 11. AMEND transition instructions for R3.1 (defined, not applied)

R2.6 changed no committed record. R3.1, after independent acceptance of
this foundation, must:

1. **A18.7 (backlog item 4):** unless qualifying authority located
   through the normal evidence process supports a real active owner —
   record the terminal `unsupported-residual` edge for the exact
   re-trade attribution residual fragment of `CBA-A18.7` (new `XW2-…`
   ID above the committed high-water mark; target `—`; scope naming the
   fragment and the §12.12 candidate anchor), resolved by a new `DISP`
   record; amend XW2-0111's prose-carried residual (backlog items 3/13
   govern its other defects) so the residual is dispositioned by the
   typed edge, with an `AMEND` record naming checkpoint `07f0667d…`;
   update every live reference in the same commit.
2. **Mistyped terminal records (backlog item 12):** for each committed
   R3 record carrying a terminal disposition on `OWN`/`ATOM`
   (DR2-0037, DR2-0038, DR2-0039): mint a properly typed `DISP` record
   at a new `DR2-…` ID above the committed high-water mark (0047),
   record one `AMEND` per superseded record naming the prior checkpoint
   and superseding disposition, and update every live crosswalk-edge
   Decision record reference in the same commit. The immutable R3
   receipt is never edited; no committed ID is renumbered or reused.
3. **SRC2-002 (backlog item 5):** amend the base row's
   Publication/effective date from the metadata-derived `2024-06-07`
   to `2024-06`, add the mandatory month-precision limitation entry,
   remove the metadata-as-date limitation framing, and rebuild every
   affected BYL evidence chain; `AMEND` record naming checkpoint
   `07f0667d…`.

## 12. Adversarial examples (every ID and value illustrative — nothing here is a minted record)

Deterministic checker: scratchpad `r26_checks.py` (Python 3),
implementing exactly the pinned rules — **40 checks, 0 failures
(exit 0)**. The mandated cases:

| # | Case | Deciding contract | Outcome |
|---|---|---|---|
| 1 | **Supported plus unsupported compound history** (the A18.7 shape): express fragment with an active owner via `partial-overlap`; residual fragment with sibling edge, recorded bounded search, no located authority, `DISP`, candidate anchor | §15.9.3 unsupported-residual rule (all nine conditions) | Residual edge **valid** (checker B1) |
| 2 | **Fully unsupported in-scope history** asserting enforceable OPS authority (the A15/A17 shape) | Rule condition 1 + §15.9.5 rule 4 | `unsupported-residual` **rejected**; faithful type is `invalid` — the false claim is the asserted authority (B2/B12) |
| 3 | **Disproven vs merely unsupported:** a historical claim the primary text contradicts | Decision order step 1 | `invalid`, never `unsupported-residual` (B6) |
| 4 | **Deferred research:** unit skips the bounded search or defers it | Rule conditions 3/6 | **Rejected** — incomplete research can never use the type (B3/B8) |
| 5 | **Process-only content** | Decision order step 1 | `process-only`, never `unsupported-residual` (B7) |
| 6 | **OWN vs terminal disposition:** terminal edge on `OWN`/`ATOM`; competing owners on `DISP`; grouped `DISP` across different bases | §15.9.4 OWN/DISP boundary | All **rejected**; `OWN`+tiebreak for competing owners and single-basis grouped `DISP` **valid** (C1–C10) |
| 7 | **Exact-day official source:** the source itself states a day | Month-precision condition 2 | `YYYY-MM-DD` **valid**; `YYYY-MM` **rejected** as degraded precision (A2/A4) |
| 8 | **Month-only official-immutable source** ("JUNE 2024") with the limitation entry | Month-precision conditions 1–4 | `2024-06` **valid**; without the limitation entry **rejected** (A1/A12) |
| 9 | **Prohibited metadata-derived day:** `2024-06-07` from PDF creation/modification metadata | Month-precision condition 3 | **Rejected** — fails the record (A3) |
| 10 | Malformed values: `2024-13`, `2024-6`, `2024/06`, `June 2024`; missing required value `—`; `YYYY-MM` on `official-mutable`/`ops-provenance` or in any other field | Grammar + per-type matrix | All **rejected** (A5–A13) |
| 11 | Grammar-by-context disambiguation: `2000-01` month vs season; `2026-27` never a month | §15.9.6 selection rule | **Correct on both sides** (A14–A17) |
| 12 | Located authority: qualifying provenance exists for a residual | Rule condition 6 | `unsupported-residual` **rejected** — an active owner must be minted (B4) |

## 13. Contradiction sweeps

Every sweep run on the full canon and repair plan; earlier receipts are
immutable history and retain their original wording by design (HISTORY);
frozen §15.1–§15.8 rows and scenarios 1–89 are non-authorizing per
§15.9.1 boundary rule 4 (FROZEN).

| Sweep | Result |
|---|---|
| `must become a` (the old unconditional A18.7 mandate) | **Zero** occurrences in the canon and plan (grep exit 1) |
| `during A-series registration` (old binding phrasing) | **Zero** occurrences in the canon and plan |
| `at A-series registration` | Exactly **one** occurrence — the frozen §15.7 `CBA-A18.7` working-copy row's R2.1-era annotation: **FROZEN**, non-authorizing, byte-preserved by the §15.1–§15.8 hash |
| The bare "receives an OWN disposition." sentence (no DISP alternative) | **Zero** — the §15.9.4 sentence now carries the DISP alternative |
| The old U5 wording "an OWN record or a named cross-family deferral" | **Zero** — U5 now reads OWN/DISP/deferral |
| Unqualified completeness duty ("discovered during R3–R6" … owner) | The only hit is the **new qualified duty itself** ("for which qualifying authority (§15.9.5–§15.9.6) is located") |
| The three-type terminal list ("process-only, invalid, and no-successor are terminal") in the XW2 rules | **Zero** — rule 3 now lists four; the SXW2 vocabulary's two terminal types (SC2 checks 3/8, §15.9.8) are the deliberate §8 boundary decision, not a residue |
| `no-successor` R9 duty without unsupported-residual | Canon R9 and plan R9 both carry the paired individual-review duty; §15.9.3's no-successor rule 5 retains its own accurate self-statement |
| Old A-family "source-certified" live status | §19.3 now states R3 executed / independently REJECTED / not certified; the R3-asserted claims survive only in the immutable R3 receipt and the historical amendment-log rows (HISTORY) |
| `R3–R9 have not started` (stale plan status) | **Zero** — the plan status block records R3 executed and rejected |

## 14. Preservation — mechanically proven

All hashes computed by anchor-locked extraction (heading line starts, the
R3 receipt's method) at the baseline (`07f0667d…`) and at the final R2.6
working state; every preserved pair is **byte-identical**.

| Preserved area | SHA-256 (both sides) | Notes |
|---|---|---|
| **Active §15.10–§15.12 record population** (from `### 15.10` to `## 16.`) | `fadbfe14216c6413871b05375f244dd5d162993064b46bdac4f3a43a4acec2ac` (120,065 bytes) | **Byte-identical to `07f0667d…`** — no active GROUP/LEAF/XW2/SRC2/EV2 record changed; no §15.10–§15.12 byte changed |
| Canon §5.9 (from `### 5.9` to `## 6.`) | `53c968ade8cdb2177517412ac09f2bae63ee7642cfa3b24299d2b208895fb373` (6,198 bytes) | Matches the R2.3/R2.4/R2.5/R3 receipts |
| Historical §15.1–§15.8 (from `### 15.1` to `### 15.9`) | `7b3f6aaba81129dceaa8e55f6356f8bbecd3af7e1ff59b127a443fc5d7b14d97` (90,455 bytes) | Matches the R2.3/R2.4/R2.5/R3 receipts; `CBA-A18.7` and every other row untouched |
| Historical scenarios 1–89 (from `## 16.` to `## 17.`) | `eb11bb122840f881204be4d3de9b8a47a680a19622677e4287227730615b311f` (24,119 bytes) | Matches the R2.3/R2.4/R2.5/R3 receipts |
| Sixteen-check SC2 block (from the `**SC2 —` opening to `**R8 —`) | `7a4f50c49f42dfe9ca399039ff2cabc1dd86dcbfc3490ce8ba2dd3b2d5f803cd` (1,492 bytes) | Byte-identical; 16 enumerated checks counted before and after |
| §15.9 foundation standard (from `### 15.9` to `### 15.10`) | Before `c8f10bae814eb8e85aff942de8aeef8e02dadf052111b5c7aa4a0aa3c65e26e5` (85,022 bytes) → after (recorded in §16) | **Changed by design** — R2.6's authorized surface |
| All ten prior receipts (R1, R1.1, R1.2, R2, R2.1–R2.5, R3) | R1 `aa45ca01…`; R1.1 `ef7cb16b…`; R1.2 `ee0f7196…`; R2 `1a688701…`; R2.1 `138a2087…`; R2.2 `9094b814…`; R2.3 `92faba91…`; R2.4 `c14a5f4f…`; R2.5 `c547ce84…`; R3 `a11cf80c7de5931b98a3fcc3be984cd1bebd299fbcba5c4b183e885fc8cfee08` | Whole-file hashes identical before/after; `git diff` contains no receipt path |

## 15. Complete deferred R3.1 backlog (preserved; not implemented in R2.6)

Recorded in the repair plan's R3.1 unit section as the bounded future
backlog, verbatim in substance:

1. Atomic A04 owner(s) above the `.8` high-water mark for Article II
   §7(f)'s general trade-bonus maximum-reduction rule and XXIV
   §2(a)(v)'s extension-specific calculation/inapplicability branches;
   Rookie Scale VIII §1(d) preserved as a separate additional rule.
2. Repair §12.7 and all associated evidence/status claims.
3. Repair XW2-0037 and XW2-0038, including A07.9's receiver-allocation
   fragment.
4. Apply the accepted unsupported-residual treatment to A18.7/XW2-0111,
   unless qualifying authority supports a real active owner.
5. Repair SRC2-002 and rebuild all affected BYL evidence chains.
6. Rebuild EV2-0084 from applicable By-Laws §§4.01–4.02 rather than
   §4.05(a).
7. Remove EV2-0012's unsupported positive rounding-authority claim or
   cite genuine controlling authority.
8. Rebuild per-candidate atomicity evidence and split or properly
   except: A02.8; A03.4, A03.6, A03.8; A04.1, A04.2, A04.3, A04.5,
   A04.7, A04.8; A07.9; A08.1, A08.2; A10.4, A10.5, A10.6; A12.1,
   A12.5; reassess A01.1, A05.14, A07.5; preserve A05.17's defensible
   exception but correct its DR reference.
9. Remove A02.6's process instruction from active formula obligation
   A02.8.
10. Repair historical and cross-family lineage: A02.13 ← C11.9;
    A02.14 ← C20.7; A05.14 ← C13.8 fragment; A12.5 ← L08.5; A17.1
    lifecycle-representation deferral; C25 routing to R5, not R4; only
    genuinely novel residuals retain `ORIGIN`.
11. Regenerate all seven duplicate-candidate populations: generator 5
    corrected to §4.2–§4.4 including §4.4; the omitted A19/A12,
    open-slots/A16, A18.7/A18.4, A11/A02, C11.9/A02.13, and
    R01.1/A09.1 candidates included; every candidate fully
    dispositioned or validly deferred.
12. Correct incorrectly typed terminal `OWN` decisions through the new
    `DISP` type.
13. Correct incomplete DR tiebreaks, result fields, result
    serialization, edge IDs, and candidate references, including
    DR2-0032, 0035, 0037, 0038, 0041, and 0042.
14. Supersede every premature U1–U14/source-certified/A-family-complete
    claim in the canon and status surfaces through proper `AMEND`
    lineage.
15. Normalize the changed header hard break so the complete repair
    range passes `git diff --check`.

## 16. Validation results and scope boundaries

Run at the final R2.6 working state on baseline `07f0667d…` (outputs
recorded verbatim in the session):

- **Exact changed-file check:** `git diff --name-only` =
  `docs/reference/cba/ARCHITECT_CBA_CANON.md`,
  `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md`;
  untracked additions = this receipt only. Exactly the three authorized
  files; no prior receipt in the diff.
- **§15.10–§15.12 byte comparison:** section bytes extracted by heading
  anchors (`### 15.10` line start to `## 16.` line start) at the
  baseline (`git show 07f0667d…`) and at the final working state —
  SHA-256 `fadbfe14216c6413871b05375f244dd5d162993064b46bdac4f3a43a4acec2ac`,
  120,065 bytes, **identical on both sides**: the active record
  population is byte-identical to `07f0667d…` (§14).
- **Preservation hashes:** §5.9, §15.1–§15.8, scenarios 1–89, SC2, and
  all ten prior receipts identical both sides (§14). §15.9 hash moved,
  by design, from `c8f10bae814eb8e85aff942de8aeef8e02dadf052111b5c7aa4a0aa3c65e26e5`
  (85,022 bytes) to
  `7e2da9c1d8578b42ad36e31cb741d8352addb35793cdff46a2c868f1a9ca07bf`
  (101,360 bytes) — the unit's authorized foundation surface.
- **Targeted parser/adversarial checks:** `r26_checks.py` — 40 checks,
  0 failures, exit 0 (§12).
- **Contradiction sweeps:** §13 — all clean.
- **`git diff --check` (pre-commit):** **clean — exit 0, zero
  findings.** (R3's header hard-break finding does not recur: R2.6 did
  not touch the two-trailing-space header lines, so its own diff is
  whitespace-clean; the R3-era finding lives in the `6d9c7576…..07f0667d…`
  range and is normalized by R3.1 backlog item 15.)
- **Post-commit `git diff --check 07f0667d…..HEAD`:** the staged-diff
  check (`git diff --check --cached` over exactly the three files,
  including this new receipt — byte-identical content to the
  post-commit range) ran **clean, exit 0, zero findings**; the range
  command itself is re-run after the checkpoint commit and reported in
  the final unit report.
- **`npm run lint:md`:** **exit 1 — pre-existing findings only.** The
  canon carries exactly **74** findings before and after R2.6 (baseline
  recomputed this session by linting `git show 07f0667d…` of the canon,
  not copied from earlier receipts), all `MD029/ol-prefix` in the
  accepted §16 continuous-numbering class; the normalized before/after
  comparison (rule + detail, line-number-independent) is **identical**
  (74 = 74, zero new findings in R2.6's changed files). `markdownlint`
  on the repair plan: clean (exit 0). `markdownlint` on this receipt:
  clean (exit 0; re-run and recorded after final write). The remaining
  global findings (53) are pre-existing and confined to four unrelated
  files (`docs/CODEBASE_MAP.md` 32; the three
  `docs/architect/audits/` documents 9/8/4). The global exit code is a
  failure caused by pre-existing findings — reported truthfully, never
  claimed as a global pass.
- **`npm run docs:guardrails`:** pass ("Workspace guardrails passed.",
  exit 0).
- **Not run, per the R2.6 order and repair-plan rule 6:** application
  tests, builds, typecheck, ESLint, `test:diff`, and the full suite —
  R2.6 is documentation/standards work only.

Scope boundaries honored:

- No active §15.10–§15.12 record changed (byte-identity proven); no
  concrete v2 record minted; no ID renumbered or reused; example
  IDs/values in this receipt and the canon are explicitly illustrative.
- No C/R/L/S active record created; no §12.7 repair; no active
  §15.10–§15.12 record added, and no historical §15.1–§15.8 row or
  scenario 1–89 edited.
- No R3 record repaired; R3.1 was **not started**; R4–R9, Phase 2, and
  W1.1 were **not started**; no Phase 2 compliance verdict issued
  anywhere.
- No earlier receipt edited (including the rejected, immutable R3
  receipt); Linear not read or written; `main` unchanged
  (`69f8f6b6…`); no application, README, code-map, test, schema,
  fixture, configuration, or data change.

**R2.6 is complete but not independently accepted — completing this
unit does not accept it. R3.1 and R4 remain blocked until an
independent Codex review returns ACCEPT on the R2.6 foundation.**
