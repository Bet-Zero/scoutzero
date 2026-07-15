# Architect CBA Canon v2.0 — R2: Register and Source-Certification Standard

## Provenance

| Field | Value |
|---|---|
| Repair unit | R2 — Register standard (second unit of the approved R1–R9 plan) |
| Branch | `architect/cba-canon-v2` |
| Baseline commit | `af931e90a525ac69942ef8d4176ef54b036d6f42` (R1 checkpoint) |
| Evidence base | `ARCHITECT_CBA_CANON_V1_1_CODEX_ACCEPTANCE_REVIEW.md` and `ARCHITECT_CBA_CANON_V1_1_CLAUDE_ADJUDICATION.md` (adjudication dispositions govern) |
| Status | **Binding standard for R3–R8.** No register row, scenario, ID, or substantive rule was changed by R2. |
| Canonical location | The normative standard is also published in canon §15.9; this receipt records the design decisions, representative examples, validation procedure, and deferred migration queue |
| Filename note | The repair plan named this artifact `ARCHITECT_CBA_CANON_V2_REGISTER_STANDARD.md`; the executed R2 order names it `ARCHITECT_CBA_CANON_V2_R2_REGISTER_STANDARD.md`. This file is the file of record; no file exists under the older name |

Files changed in R2: `docs/reference/cba/ARCHITECT_CBA_CANON.md` (standard/release-gate portions only: header note, amendment-log row, new §15.9, one pointer paragraph in §17) and this receipt. Nothing else.

## Scope and purpose

This standard makes the following defect classes — all confirmed by the Codex
acceptance review and upheld (and broadened) by the adjudication —
**mechanically impossible or mechanically detectable** in the rebuilt v2.0
register:

1. Duplicate ownership of one obligation by two or more active rows.
2. Bundled, independently pass/fail-able requirements inside one row.
3. Phantom owners (rows that assert a rule is unowned when an owner exists).
4. Process instructions disguised as product obligations.
5. Mis-parented rules.
6. Active LEAFs without a precise source chain.
7. Family-level citations standing in for per-rule evidence.
8. Syntactic scenario links that do not prove the rule.
9. Compliance verdicts on GROUP nodes.
10. Reused, renumbered, or silently repurposed identifiers.

It is written as general rules, not patches for the known examples. §9 below
applies the rules to twelve representative defects to prove the rules produce
unambiguous actions; **those applications are methodological demonstrations,
not register edits** — the register is untouched in R2.

---

## 1. Node roles

The v2.0 register has exactly **three** node roles. R2 examined whether a
fourth role (RESERVED, PROCESS, or DEPRECATED-ACTIVE) was needed and decided
no: reserved numbers are prohibited outright (§4), process material leaves the
register entirely (§3.6), and an obligation is either active or retired —
there is no half state. Adding roles to accommodate bad legacy structure would
reproduce the v1.1 failure of counting things that are not obligations.

### 1.1 GROUP — organizational parent only

- Owns **no** substantive obligation.
- Receives **no** compliance verdict, ever. Not Covered, not Partial, not
  Missing, not PASS/FAIL.
- Receives **no** independent locatability status and appears in no execution
  map, packet, or work plan.
- Requires **no** verification method and no source locator (its children
  carry those).
- Its reported status is only the **distribution of its children's statuses**
  (e.g., "3 Covered / 1 Partial / 1 Missing"). Mixed child results are never
  collapsed into one parent verdict.
- Must have at least one active LEAF child. A GROUP whose last active child is
  retired must itself be retired in the same unit.

### 1.2 LEAF — exactly one independently auditable substantive obligation

- States one obligation that one auditor can prove or refute with one body of
  evidence (the atomicity test in §2).
- Has exactly one canonical owner ID; every other mention of the same
  obligation anywhere in the canon is a cross-reference, never a second owner.
- Can receive exactly one evidence-backed Phase 2 disposition.
- Carries a complete authority/source chain per §5.
- Carries an appropriate verification method per §6.
- Appears **exactly once** in the execution map and exactly once in a Phase 2
  packet.

### 1.3 RETIRED/ALIAS — historical identifier, no active obligation

Used whenever deduplication, splitting, re-parenting, phantom removal, or
process conversion removes an active LEAF. Retirement is the **only** way an
ID leaves the active register — IDs are never deleted, renumbered, or
silently repurposed.

- Does **not** count as an active audit unit and appears in no execution map,
  packet, or count of the auditable universe.
- Points to its successor owner or owners (or records that none exists — see
  subtypes below).
- Can **never** receive a new verdict. Successors never inherit a retired
  ID's historical verdict; each successor requires fresh Phase 2 evidence.
- Can **never** be reused for a different rule.
- Remains searchable forever, so old reports, scenarios, and Linear references
  resolve through it.

**Retirement subtypes** (recorded on every retired row):

| Subtype | Meaning | Successor field |
|---|---|---|
| MERGED | Duplicate folded into the canonical owner | The canonical LEAF |
| SPLIT | Obligation divided into several atomic LEAFs | All successor LEAFs |
| RE-PARENTED | Same obligation re-registered under the truthful parent | The new LEAF |
| CONVERTED-TO-PROCESS | Instruction moved to process/release-gate material | Document location (no LEAF) |
| PHANTOM | Row asserted a gap or claim that was false | The real owner if one exists; otherwise none |

### 1.4 Role transitions

- **LEAF → GROUP** is permitted only when a *top-level* LEAF splits: the
  top-level ID becomes a GROUP over its newly minted children (`.1`, `.2`, …).
  This is not repurposing — the ID continues to denote the same rule family —
  but it must be recorded in the migration ledger with the former role and the
  unit that performed it.
- **GROUP → LEAF** is prohibited. A GROUP left with exactly one active child
  remains a GROUP with one child; collapsing it would repurpose the parent ID
  and orphan the child ID.
- No other transitions exist.

---

## 2. Atomicity

### 2.1 The binding test

Restate the candidate row in the form:

> **GIVEN** <input facts> **WHEN** <trigger or boundary> **THEN** <required result>

A row is one LEAF **iff**:

1. It has exactly one THEN (one prohibition, one computed amount, one state
   change, one required representation); and
2. No realistic implementation could be correct on one part of the row and
   wrong on another part in a way an honest auditor would have to report
   separately (the **mixed-verdict test**).

If the row needs more than one THEN, or enumerates several GIVEN/WHEN sets
each with its own THEN, it must be split.

### 2.2 Guardrails (binding clarifications)

1. **Conjunctive triggers stay together.** Many GIVEN/WHEN conjuncts feeding
   one THEN are one LEAF. A prohibition that fires only when three conditions
   all hold is one rule, not three.
2. **Separately enumerated operations in the signed text are separate
   LEAFs**, even when adjacent — the signed enumeration is the floor of
   granularity for enumerated calculations and adjustments (e.g., CBA VII
   §2(e)(1)'s ten apron adjustments are ten LEAFs).
3. **One formula may remain one LEAF only when its components cannot
   truthfully receive mixed implementation verdicts.** The Expanded TPE
   expression `max(min(2O + K, O + A), 1.25O + K)` is one adjudicable
   computation. But a formula's separately derived inputs (the scaled amount
   `A`, the `K` zeroing rule) are their own LEAFs.
4. **Eligibility, calculation, lifecycle, expiration, and extinguishment are
   separate LEAFs whenever Architect could implement them differently.** A
   rule's amount formula can be right while its application window, expiry
   date, or extinguishment trigger is wrong.
5. **Numeric bounds on the same quantity are separate LEAFs when each bound
   can fail independently** (a minimum term and a maximum term are two rules).
6. **Homogeneous-enumeration exception.** A single clause of the signed text
   that lists same-kind elements under one trigger and one consequence (e.g.,
   "a Two-Way may not include bonuses, Incentive Compensation, deferred
   compensation, or loans", CBA II §11(a)(iii)) may remain one LEAF — but its
   covering evidence must exercise **every** listed element. This exception
   never applies across clause boundaries and never to elements with
   different consequences or signs.
7. **A broad "supports X" statement is not atomic when X contains
   independently enforceable conditions.** Representation obligations must
   name the specific property represented, not a catalog.
8. **Testing instructions and recommended boundary percentages are not part
   of the product obligation.** "Test at 0%, 25%, and 100% elapsed" belongs
   in the scenario/release-gate material; the LEAF states only the rule.

### 2.3 Worked positive and negative examples

(Dispositions are demonstrated fully in §9; this table shows the test itself.)

| Row | Test outcome | Why |
|---|---|---|
| A21 (minimum-contract stacking) | **Atomic — keep** | Three conjunctive trigger conditions, one prohibition (one THEN). The season-classification clause defines a trigger input, not a second result. Guardrail 1 |
| C07.6 (apron adjustments (vi)+(vii)) | **Not atomic — split** | Two separately enumerated adjustments with opposite signs (subtract vs add). Guardrail 2 |
| C20.4 (Two-Way contract shape) | **Not atomic — split into 4** | Term limit; option/ETO ban; prohibited-compensation list (one LEAF under guardrail 6); Advance permission with its 50%/November-1 limits. Four independently failable requirements from three clauses |
| A19.3 (sign-and-trade shape) | **Not atomic — split into 3** | Minimum term, maximum term, Year-1 full protection: each independently violable. Guardrail 5 |
| C12.2 (DPE bundle) | **Not atomic — split into 5** | Amount formula; contract shape; application window; use expiry; extinguishment. Guardrail 4 |
| L01.5 (calendar event set) | **Not atomic and not ownable** | "The critical event set is represented" bundles a dozen dates each owned (or owed an owner) by a substantive rule. Guardrail 7; resolved by cross-reference, not by splitting into duplicate date rules (§3.5) |

---

## 3. Canonical ownership and deduplication

### 3.1 The ownership rule

Every substantive obligation has **exactly one active LEAF owner**. The same
rule may be referenced from any number of other sections, correction tables,
explanatory summaries, or lifecycle ledgers — always as a cross-reference to
the canonical owner (`see CBA-X##.#`), never as a second LEAF. No LEAF may
claim that a rule is unowned after an owner exists. Process instructions
belong in process/release-gate material (canon §17, §15.8's non-code
dispositions), never in the substantive register.

### 3.2 Choosing the truthful owner (deterministic tiebreak)

When two or more active rows own one obligation, the canonical owner is
selected by applying these tests in order, stopping at the first that
discriminates:

1. **Family test.** The row whose series is the obligation's natural family
   (A = trade correctness, C = Cap Manager, R = waivers/rosters,
   L = lifecycle/rights/dates, S = parameters/provenance).
2. **Substantive-anchor test.** The row anchored where the canon legislates
   the rule's substance (§§5–14) beats rows anchored in the §3 corrections
   table, in the §4 system-model summaries (when a substantive twin exists),
   or in §§15–19 process material.
3. **Completeness test.** The row that states the trigger and the result most
   completely with the fewest extraneous elements.
4. **Stability test.** The lowest ID in mechanical sort order.

The losing rows are retired (MERGED) with the canonical owner as successor.

### 3.3 Splitting a non-atomic LEAF

- The old ID is retired (SPLIT). It is **never** kept as the owner of one of
  its own fragments — that silently changes the ID's meaning.
- Each fragment is minted as a **new appended child** of the truthful parent
  (§4), with its own full source chain, method, and evidence reference.
- The retired row lists every successor.
- A top-level LEAF that splits converts to a GROUP over its new children
  (§1.4) and the conversion is ledgered.

### 3.4 Re-parenting a misplaced LEAF

The ID syntax embeds the parent, so re-parenting always means: retire the old
ID (RE-PARENTED), mint a new appended child under the truthful parent with
identical obligation text (plus any atomicity split performed at the same
time), and point the retired row at it.

### 3.5 Cross-cutting requirements

Requirements that genuinely span many rules (calendars, ledgers, state
persistence) are owned once — by the LEAF whose family is representation or
parameters (§4.x-anchored ledger LEAFs, S-series configuration LEAFs) — and
referenced everywhere else. Lifecycle/state ledgers reference the substantive
rule they track rather than minting duplicates; a date rule is owned by its
substantive family (the Two-Way family owns the Two-Way deadline), while the
calendar layer owns only the representation obligation ("dates are read from
the versioned season calendar").

### 3.6 Phantom and process rows

- A row asserting a gap that does not exist is retired (PHANTOM) pointing at
  the real owner.
- A row asserting a gap that is **real** is retired (PHANTOM) **and the
  hidden obligation is minted a real owner** — a new appended LEAF with a
  full source chain. The retired row points at the new owner.
- A development/process instruction is retired (CONVERTED-TO-PROCESS) with
  its destination recorded (release gate step, non-code disposition table, or
  standards doc). It gets no successor LEAF and is never counted again.

### 3.7 One old ID with several successors

A retired ID may list several successors (a split, or a duplicate whose
canonical owner was itself split in the same unit). Historical references
resolve through the retired row to **all** successors; any historical verdict
attached to the retired ID applies to none of them.

---

## 4. Stable identifier rules

### 4.1 Grammar

- Top-level: `CBA-<F><NN>` where `F ∈ {A, C, R, L, S}` and `NN` is a
  two-digit zero-padded number.
- Child: `CBA-<F><NN>.<n>` where `n` is a positive integer with **no**
  padding (matching every existing ID). Tools must parse and sort `NN` and
  `n` **numerically**, never lexicographically (`.10` sorts after `.9`).

### 4.2 Append-only assignment

- A new child of a parent takes `n = 1 + max(n ever assigned under that
  parent)` — counting retired children. A retired `.6` keeps its slot
  forever; if `.1`–`.10` ever existed, the next child is `.11`.
- A new top-level ID takes `NN = 1 + max(NN ever assigned in that family)`.
- **No reserved or skipped numbers.** Numbers exist only when a node is
  registered. Gaps in the active register arise only from retirement.
- Because assignment is append-only, no later unit ever renumbers an
  unaffected ID, and units operating on different parents cannot collide.
  Units appending to the same parent must run in plan order (R4 before R5).

### 4.3 Splits, retirements, and transitions in the record

- Every retirement, mint, and role transition gets a **migration-ledger row**
  in the performing unit's receipt: old ID, subtype, successor(s), unit,
  commit.
- The register itself carries the same facts: retired rows sit in a
  per-family "Retired identifiers" table (§7.3) with successors; new LEAFs
  carry a Predecessor reference where one exists.
- GROUP↔LEAF transitions (only LEAF→GROUP is legal, §1.4) are recorded both
  in the ledger and on the node ("GROUP since v2.0-R<n>; formerly top-level
  LEAF").

### 4.4 Counting

Every count table must distinguish the three roles and satisfy the identity:

> registry nodes = GROUP nodes + active LEAF nodes + RETIRED/ALIAS nodes

The **auditable universe is active LEAF nodes only**. Per-family subtotals
must recompute mechanically from the tables (§10). The v1.1 totals
(59/368/427 with zero retired) remain correct for the current, not-yet-
re-registered draft and are superseded family-by-family as R3–R6 land.

---

## 5. Per-LEAF source-locator standard

Every **active LEAF** carries a durable source chain in its Locator field,
formatted by authority class as below. Family-level source maps (canon §19.1)
remain navigational aids; they can never substitute for a LEAF's exact
locator. A bare label ("CBA") with no chain fails the release gate.

### 5.1 CBA

`CBA 2023 Art. <article> §<section>(<subsections>)[, Ex. <exhibit>], p[p]. <printed page or range>`

Required: agreement edition/year (2023 until amended), article, section and
subsection, exhibit where applicable, and the **printed** PDF page or range.
Example: `CBA 2023 Art. VII §6(j)(1)(iv), p. 241`.

### 5.2 BYL

`BYL June 2024 §<section.subsection>, p. <printed page>`

Required: By-Laws edition/date, section/subsection, printed page.
Example: `BYL June 2024 §7.03, p. 78`.

### 5.3 NBA (official releases and publications)

`NBA "<release/document title>", <publication date or season>, <direct official URL>[, <heading/table>]`

Required: title, publication date or season, direct official URL, and the
relevant heading or table when the document is long.

### 5.4 DERIVED

Required, all of:

- Every controlling primary locator (in §5.1–5.3 format).
- The explicit derivation or formula.
- The inputs and where each comes from.
- The rounding rule (and where rounding is applied).
- The versioned parameters (which Salary Cap Year's inputs).
- A clear separation between what the source text states and what is
  inference.

### 5.5 OPS

Required, all of:

- The operational rule or assumption, stated as such.
- Provenance (who reports it, where).
- Effective version/date.
- The explicit limitation that no current public primary text supports it.
- Confirmation that it is configurable and can never be presented as signed
  CBA text.

### 5.6 EXT

Required, all of:

- The external decision-maker or authority (league, physician, panel,
  arbitrator).
- The required explicit state the product must consume (enumerated values).
- Provenance of the supplied state (how the decision enters the system).
- Confirmation that Architect must not guess the result.

### 5.7 Composite authorities and certification

- A composite authority (e.g., `CBA + DERIVED`) carries the full chain for
  **each** component.
- **Certification rule:** a locator is valid only if the assigning agent read
  the cited passage against the primary document in the session that assigned
  it. Each R3–R6 receipt must attest this per LEAF; a family-level
  attestation, a prior report, or a summary is insufficient. Assigning the
  locator *is* the per-rule verification.

---

## 6. Verification methods

### 6.1 Method definitions and when to use them

| Method | Use when | Never for |
|---|---|---|
| **SCEN** | The rule is deterministic and an executable scenario can drive inputs to a verdict | Architecture/representation properties; external determinations |
| **STATIC** | The obligation is a configuration, provenance, schema, or architecture property inspectable without execution | Rules whose truth depends on runtime behavior over inputs |
| **LIFECYCLE** | The obligation is about ordered state/events/history (creation, persistence, expiry, rollover, reset) | Single-shot calculations |
| **EXTS** | The obligation consumes an externally supplied determination | Anything Architect may compute itself |
| **UI** | The obligation is a user-visible representation requiring manual or rendered inspection | Anything provable by a lower-cost method |

- OPS-authority LEAFs whose obligation is "configurable, versioned, truthful
  provenance" use **STATIC** with the OPS evidence minima below. The v1.1
  method label **OPSV is deprecated** (it was defined but assigned to zero
  rows); it must not be assigned in v2.0. The §15.7 method legend keeps the
  historical definition until the affected preamble is rebuilt in R3–R6.
- If no honest scenario exists for a SCEN-labeled LEAF, the fix is to
  **reclassify the method** (STATIC/LIFECYCLE/EXTS), never to attach a
  cosmetic mapping.

### 6.2 Minimum evidence per method

- **SCEN:** a scenario containing all seven required elements of §6.3.
- **STATIC:** identity of the inspected artifact (path/config/schema/doc),
  the property confirmed, how it was inspected, and the commit/date. For
  OPS-authority rows, additionally: the provenance record, version field, and
  proof the value is configurable and not labeled as CBA text.
- **LIFECYCLE:** the ordered event sequence, the asserted state after each
  step, and the persistence/history assertion across the sequence (state must
  survive later events and be readable when the rule fires).
- **EXTS:** the enumerated external states, the provenance record shape, the
  expected behavior for each state including the "assumption required"
  surfacing, and confirmation that no state is auto-derived.
- **UI:** the state to render, exactly what the user must see, and the
  rendered-inspection record.

### 6.3 The scenario contract

Every acceptance scenario must state, explicitly:

1. Initial input facts.
2. Explicit date and/or Salary Cap Year.
3. The trigger or boundary being exercised.
4. The action taken.
5. The expected result.
6. The controlling locator (§5 format).
7. **The LEAFs genuinely exercised** (an explicit `Exercises:` list).

A scenario may cover several LEAFs **only** when its facts and expected
results explicitly exercise each one. The register's Evidence column and the
scenario's `Exercises:` list must agree **bidirectionally**; this converts
"semantically valid mapping" into a mechanically checkable property. A
syntactic `#N` link with no matching facts is not proof of coverage and fails
the gate. (The bidirectional contract binds from R7, when the scenario
library is rebuilt; R3–R6 carry inherited scenario references explicitly
marked provisional.)

---

## 7. Register row schemas

### 7.1 Active LEAF (full schema — 12 fields)

| Field | Content |
|---|---|
| Stable ID | §4 grammar |
| Node role/status | LEAF (denoted by membership in the active LEAF table) |
| Canonical requirement | The one obligation, atomically stated (§2) |
| Parent GROUP | Parent ID, or "top-level leaf" |
| Authority classification | CBA / BYL / NBA / DERIVED / OPS / EXT (composites allowed) |
| Exact locator / provenance chain | §5 format for every authority component |
| Verification method | §6 |
| Scenario/evidence reference | Scenario number(s) or evidence pointer; provisional until R7 for inherited references |
| Dependency | Other LEAF IDs whose state/output this rule consumes ("—" if none) |
| Lifecycle/date inputs | Required `asOfDate`/Salary Cap Year/window inputs ("—" if none) |
| Successor/predecessor reference | Predecessor ID where the LEAF was minted by split/re-parent/mint ("—" otherwise) |
| Notes or limitations | Bounded caveats, OPS/EXT limitations, absorbed implementation guidance |

**Physical layout (binding for R3–R6):** each family keeps a main table with
columns `ID | Parent | Requirement | Authority | Locator | Method | Evidence |
Notes`, plus a per-family **Certification detail** table keyed by ID carrying
`Dependencies | Lifecycle/date inputs | Predecessor` for rows where any is
non-empty. Both tables must be mechanically parseable and joinable on ID; the
layout must be uniform across all families.

### 7.2 GROUP (reduced schema)

`ID | Role (GROUP) | Title/audit question | Active children | Retired children | Packet | Notes` — carried in the top-level hierarchy table. No verdict, locator, method, or evidence fields exist for a GROUP.

### 7.3 RETIRED/ALIAS (reduced schema)

Per-family "Retired identifiers" table:

`ID | Former requirement (one line) | Retirement subtype (§1.3) | Successor(s) | Retired in (unit + commit) | Notes (historical references)`

### 7.4 Non-register material

Process/release-gate instructions live only in canon §17, the §15.8 non-code
disposition table, or standards docs — never as register rows of any role.

---

## 8. Register release gates

Before any rebuilt register (or any later edition of it) can govern Phase 2,
**all** of the following must pass. Mechanical gates are parser-checkable
(§10); semantic gates require reviewer judgment and must be evidenced in the
gating receipt.

### 8.1 Mechanical gates

| # | Gate |
|---|---|
| M1 | Every ID matches the §4 grammar; no ID appears twice across the GROUP, active LEAF, and RETIRED tables |
| M2 | Every ID appears in exactly one of the three role tables |
| M3 | Every child's parent exists as a GROUP; every GROUP has at least one active child |
| M4 | No two active LEAFs own the same obligation: the duplicate-candidate list (adjudication §3 plus a mechanical similarity sweep) is fully resolved — every pair merged or explicitly adjudicated distinct in the receipt |
| M5 | Every active LEAF carries an atomicity disposition (kept-atomic or split-performed); zero rows flagged non-atomic remain active |
| M6 | Every active LEAF's locator parses under its authority class's §5 grammar; no label-only authority; composite authorities have a chain per component |
| M7 | Every method ∈ {SCEN, STATIC, LIFECYCLE, EXTS, UI}; every SCEN evidence reference resolves to an existing scenario |
| M8 | (From R7) The scenario `Exercises:` lists and the register Evidence column reconcile exactly, bidirectionally |
| M9 | The code map and Phase 2 packets/work plan contain active LEAFs only — no GROUP, no RETIRED — and every active LEAF appears exactly once in each |
| M10 | Counts reconcile: nodes = GROUP + active LEAF + RETIRED, per family and in total, recomputed from the tables |
| M11 | Every LEAF ID active in v1.1 resolves to an active v2.0 LEAF or to a RETIRED row with valid successors (historical traceability) |
| M12 | No GROUP or RETIRED ID appears in any verdict/disposition column anywhere in the canon, code map, or receipts |
| M13 | The execution plan's dependency table has no unit depending on a later unit |

### 8.2 Semantic gates

| # | Gate |
|---|---|
| S1 | Sampled merges join genuinely identical obligations; sampled splits produce genuinely independent obligations (mechanical counts are meaningful, not merely consistent) |
| S2 | Sampled SCEN mappings genuinely exercise their LEAFs: the scenario's facts and expected results test the obligation, not just cite it |
| S3 | Primary-source certification was performed **directly**: receipts show the cited pages were read at assignment, not inherited from summaries, prior reports, or the family source map |
| S4 | Sampled active LEAFs re-derive as one real obligation each (spot re-count) |

Gate timing: M1–M7 and M9–M13 are checkable per-unit as R3–R6 land and must
pass in each unit's receipt for the families that unit touched; M8, S1–S4
must pass across the whole register at R8 and are re-verified independently
at R9.

---

## 9. Representative-example dispositions

**These demonstrate the standard. They are not register edits; no row, ID,
or scenario was modified in R2.** Successor IDs shown are illustrative of the
append rule (§4.2) — the performing unit assigns the actual numbers at
migration time from the then-current maximum.

| # | Rows | Defect | Standard applied | Expected action |
|---|---|---|---|---|
| 1 | A18.2 vs A18.8 | Duplicate owners of "paying cash prohibited above the Second Apron" | Tiebreak §3.2: both substantive anchors (§8.3, §12.12); completeness test prefers A18.2 (trigger + prohibition) over A18.8 (classification restatement) | **Keep A18.2** as canonical owner; **retire A18.8** (MERGED → A18.2) |
| 2 | C23.1 vs C23.4 | Duplicate owners of the two incentive caps; the surviving text is itself two independently violable caps | Tiebreak §3.2 rule 2: C23.4 (§5.9 substantive) beats C23.1 (§3 corrections table). Atomicity §2.2(5): the 20%-of-Regular-Salary seasonal cap and the 15%-at-signing Unlikely Bonus cap fail independently | **Retire both**: C23.1 (MERGED) and C23.4 (SPLIT); **mint two successors** under C23 (illustratively C23.7 = 20% seasonal cap, C23.8 = 15% unlikely-at-signing cap); both retired rows list both successors |
| 3 | C24.1 vs C24.4 | Duplicate owners of the prior-to-June-25 RFA option deadline | Tiebreak rule 2: C24.4 (§5.5) beats C24.1 (§3). C24.1's "encode the legal comparison, not the label" is implementation guidance — absorbed as a Note on the owner, not an obligation | **Keep C24.4**; **retire C24.1** (MERGED → C24.4) |
| 4 | C07.6 | Two separately enumerated Apron Salary adjustments — (vi) subtract unsigned first-round-pick amounts; (vii) add outstanding Required Tender amounts — in one LEAF | Atomicity §2.2(2): separately enumerated operations with opposite signs | **Retire C07.6** (SPLIT); **mint two successors** under C07 (illustratively C07.11 = adjustment (vi), C07.12 = adjustment (vii)), locators `CBA 2023 Art. VII §2(e)(1)(vi), pp. 186–187` and `…(vii), pp. 186–187` |
| 5 | C20.4 | Term limit + option/ETO ban + prohibited-compensation list + Advance payment rule in one LEAF | Atomicity §2.1/§2.2: four independently failable requirements across three clauses; the prohibited-compensation list stays one LEAF under guardrail 6 with all-element coverage required | **Retire C20.4** (SPLIT); **mint four successors** under C20: ≤2 seasons (II §11(d) p. 54); no Option Year/ETO (II §11(d) p. 54); no bonuses/incentive comp/deferred comp/loans (II §11(a)(iii) pp. 50–51); Advance permitted only with the 50%-of-protected/pre-November-1/installment-deduction limits (II §11(a)(v) p. 51) |
| 6 | A19.3 | Sign-and-trade minimum term + maximum term + Year-1 protection bundled | Atomicity §2.2(5): each bound and the protection requirement fail independently | **Retire A19.3** (SPLIT); **mint three successors** under A19: ≥3 seasons excluding options; ≤4 seasons; Year 1 fully protected for lack of skill |
| 7 | C12.2 | DPE formula, contract shape, application window, expiry, extinguishment in one LEAF | Atomicity §2.2(4): eligibility/calculation/lifecycle/expiry/extinguishment separate | **Retire C12.2** (SPLIT); **mint five successors** under C12: amount = lesser of 50% of disabled salary or NTMLE; one-season/remaining-term shape; application window July 1–January 15; use expiry March 10; extinguishment on return or trade of the disabled player before use. Methods assigned per successor (formula/window SCEN; expiry/extinguishment LIFECYCLE); the medical determination itself stays EXTS with C12.1/C11 |
| 8 | L01.5 | Whole calendar in one row, cross-duplicating every individual date rule | Ownership §3.5: cross-cutting requirement; each date is owned by its substantive family; the layer obligations (versioned calendar, explicit date) are already owned by S01.6/L01.4 | **Retire L01.5** (MERGED); successors = cross-reference list of the per-date substantive owners (C19.1, C24.3, L04.8, the new March 4 owner, …) — **no new mint**, no duplicate date LEAFs |
| 9 | C19.6 | Phantom: claims the January 5 Ten-Day opening has no owner while C19.1 owns it | §3.6: false-gap row | **Retire C19.6** (PHANTOM → C19.1). No mint — the obligation already has its owner |
| 10 | C20.9 + the real March 4 rule | Phantom text that hides a real, unowned CBA obligation (the March 4 Two-Way signing deadline, CBA II §11(e)(i) p. 54) | §3.6: real-gap row — retire the phantom **and mint the real owner** | **Retire C20.9** (PHANTOM → new owner); **mint a real owner** under C20 (next appended child after the C20.4 successors) with locator `CBA 2023 Art. II §11(e)(i), p. 54`, method SCEN (scenario 72's March-4 case already exercises it) |
| 11 | S02.1 | Development-process instruction ("on a source change, update the parameter layer and rerun tests") registered as a product obligation | §3.6: process material | **Retire S02.1** (CONVERTED-TO-PROCESS); destination = canon §17 release gate (steps 2/10 and the parameter policy). No successor LEAF |
| 12 | A21 | Suspected bundle (three conditions) | Atomicity §2.2(1): three **conjunctive** trigger conditions, one prohibition — a valid conjunctive-trigger LEAF | **Keep** unchanged. Note for R7: its scenario must exercise the boundary of each conjunct |

Expected-action coverage: keep (1, 3, 12), split (2, 4, 5, 6, 7), retire/
alias (1–11 losers), convert to process material (11), mint a real owner
(10), cross-reference instead of duplicate (8). **Re-parent** and **convert
to GROUP** do not arise among these twelve; their mechanisms are §3.4 and
§1.4, and the known re-parent candidates are queued in §11.

---

## 10. Mechanical validation procedure

Any unit or reviewer must be able to re-derive the gate results with a
deterministic parse. The binding procedure:

1. **Extract** the three role tables per family from the canon by section
   heading (active LEAF tables in §15.7-successor sections; the top-level
   hierarchy table; the per-family Retired identifiers tables).
2. **Parse IDs** with the §4 grammar (`CBA-[ACRLS]\d{2}(\.\d+)?`), sorting
   numerically.
3. **Join** the certification-detail tables to the main tables on ID; a
   detail row with no main row, or a duplicated ID, is a gate failure.
4. **Check M1–M7, M9–M13** directly from the parsed tables, the scenario
   library, the code map, and the work plan. For M4, produce the
   duplicate-candidate list as (a) the adjudication §3 enumeration plus
   (b) a normalized-text similarity sweep over active requirements, and
   require every candidate pair to be dispositioned in a receipt.
5. **Check M8** (from R7) by extracting every scenario's `Exercises:` list
   and diffing both directions against the register Evidence column.
6. **Emit counts** (M10) as the three-role identity per family and in total.
7. **Record** the parser outputs verbatim in the unit receipt. R9 re-runs
   the same procedure independently rather than trusting recorded outputs.

R3–R6 receipts must include the procedure's outputs for their families at
their checkpoint commits.

---

## 11. Deferred migration actions (owned by R3–R6; none performed in R2)

The adjudication's confirmed defect lists, assigned to units. Later units
must treat these as the **starting queue**, not the exhaustive population —
each unit re-runs the §10 sweep on its families.

**R3 (A-series):**

- Dedup: A18.2↔A18.8 (§9#1); A02.1↔(A02.5+A02.6); A02.2↔A02.8; A03.1↔A03.3;
  A05.1↔A05.2; A06.1↔A06.2; A07.2↔A07.4; A08.1↔A08.2; A12.10↔(A12.3+A13);
  A14.1↔A14.2.
- Split: A19.3 (§9#6); A02.4; A08.1; A09.3.
- Process-shaped text to strip per §2.2(8): the "test at 0/25/100%" clause
  inside A03.1; review A02.3/A02.6 as process-shaped borderline rows.
- Per-LEAF locators for every surviving A-series LEAF (§5), verified against
  the signed text at assignment.

**R4 (C01–C13):**

- Split: C07.6 (§9#4); C12.2 (§9#7); C10.3 (payment / tax-distribution bar /
  Team Salary charge); C01.4 (five hold multipliers); C02.1; C13.7; C13.8;
  C13.10.
- Dedup: C05.1↔C05.2; C08.1↔C08.4; C11.1⊂C11.9 (and C11.9's extinguishment
  clause vs C12.2's successor); cross-family C07.8↔C13.12 (SRPE apron
  add-back — owner per §3.2).
- Re-parent: C13.14, C13.15 (signing-path menus out of exception inventory).
- Note: R4 appends to C07/C12/C13 before R5 touches C14–C25 (plan order).

**R5 (C14–C25):**

- Dedup: C23.1↔C23.4 (§9#2); C24.1↔C24.4 (§9#3); C14.8↔C14.9; C21.1↔C21.8;
  cross-family C20.1↔R06.6 (three-Two-Way limit — canonical owner per §3.2
  family test; R6 must not re-own it).
- Split: C20.4 (§9#5); C16.6; C19.1; C21.6; C23.5; C24.2; C24.5.
- Phantoms: C19.6 (§9#9); C20.9 + March 4 mint (§9#10).
- Re-parent: C20.8 (undrafted rookies out of Two-Way); C16.6/C16.7
  (max-salary shape out of extensions).

**R6 (R/L/S series):**

- Dedup: L06.1↔L06.3; L08.1↔(L08.3+L08.6); R08.1/R08.2/R08.5↔R08.3/R08.4;
  S02.2/S02.3⊂S02.4; L01.5 (§9#8).
- Split: S04.2 (four derivations); L04.8; L04.12; L04.16; R06.3; R09.2.
- Process: S02.1 (§9#11); review S02.2/S02.3 against §3.6 after the S02.4
  dedup.
- Method reclassification: architecture-property rows currently SCEN (the
  #47/#83 pattern — A01.3-style and "no ambient today") reclassify to STATIC
  per §6.1 in whichever unit owns the row.
- S-series dataset provenance table per the repair plan.

**R7–R8:** scenario contract (§6.3) across the library; bidirectional M8;
code-map re-reconciliation and M9/M13.

---

## 12. Design decisions (with rationale)

1. **Three roles only.** RESERVED prohibited (phantom numbers were a v1.1
   defect vector); PROCESS is not a register role because process text leaves
   the register (§3.6); no DEPRECATED-ACTIVE half state.
2. **GROUP→LEAF prohibited; single-child GROUPs allowed.** Collapsing a
   GROUP would repurpose its ID and orphan the child; a one-child GROUP is
   harmless.
3. **Top-level LEAF splits convert the ID to GROUP** rather than retiring the
   top-level ID — the family identity is continuous and no numbering churn
   results; the transition is ledgered.
4. **A split always retires the parent row.** Keeping the old ID as one
   fragment silently changes its meaning, breaking every historical
   reference to the fuller obligation.
5. **Successor verdicts are never inherited.** Historical verdicts attached
   to retired IDs describe evidence about a differently-scoped row.
6. **The ownership tiebreak prefers substantive anchors over the §3
   corrections table and §4 summaries** because the adjudication showed those
   two locations are precisely where duplicate minting happened
   systematically.
7. **The homogeneous-enumeration exception (§2.2(6))** prevents atomicity
   from exploding single prohibition clauses into per-noun LEAFs, while the
   signed text's own enumeration (§2.2(2)) stops the opposite abuse (C07.6's
   merge). The floor is the mixed-verdict test; the ceiling is the clause.
8. **Semantic scenario coverage is made mechanical** by requiring an
   `Exercises:` list per scenario and bidirectional reconciliation (M8) —
   the v1.1 failure was unverifiable one-way `#N` links.
9. **OPSV deprecated into STATIC** — it was never used, and OPS obligations
   reduce to inspectable configuration/provenance properties.
10. **Physical schema = main table + certification detail table** — keeps
    the register readable and diffable while making the full 12-field schema
    machine-recoverable; a single 12-column table was rejected as unreadable
    and merge-hostile.
11. **Append-only numbering with plan-ordered units** removes all renumbering
    and collision risk without reserved ranges.

## 13. Unresolved design questions

**None that block R3–R8.** Watch items recorded for the performing units:

1. R4 and R5 both operate in the C family; the plan already orders R4 before
   R5 — any deviation reintroduces append-collision risk on shared parents
   (noted in §4.2).
2. The §15.6/§15.8 v1.1 count tables become stale family-by-family as R3–R6
   land; each unit must update the counts for its families (three-role
   format, §4.4) in the same checkpoint, or the M10 gate will fail at R8.
3. Scenario references on split successors are inherited-and-provisional
   until R7 (§6.3); R7 must clear every provisional mark.

## Validation performed (R2)

- Baseline verified before work: `main` = `origin/main` =
  `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288`; `architect/cba-canon-v2` =
  origin = `af931e90a525ac69942ef8d4176ef54b036d6f42`; working tree clean.
- Files changed: only `docs/reference/cba/ARCHITECT_CBA_CANON.md`
  (standard/release-gate portions) and this receipt.
- Diff-level checks recorded in the R2 report: no substantive rule prose,
  register row, scenario, source value, or code mapping changed; no ID
  added, removed, renumbered, re-parented, or retired; LEAF/GROUP tables
  byte-identical to R1.
- `npm run lint:md` run at checkpoint (pre-existing accepted MD029
  continuous-numbering class in §16 only).
- No app tests run (documentation-only change per repair-plan global rule 6).

## Confirmation

R2 defined standards only. The register, scenarios, source values, code map,
application code, tests, fixtures, schemas, configuration, data, Linear
items, and historical review artifacts are unchanged. R3–R9, Phase 2, and
W1.1 were not started.
