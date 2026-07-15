# Architect CBA Canon v2.0 — R2.1: Replacement Register and Source-Certification Standard

## Provenance

| Field | Value |
|---|---|
| Repair unit | R2.1 — replacement register standard (replaces the rejected R2 foundation with the clean v2 registry model) |
| Branch | `architect/cba-canon-v2` |
| Baseline commit | `1532c928` (R1.1 checkpoint = origin at session start; R2 = `056b9d02`; R1 = `af931e90`; `main` = `origin/main` = `69f8f6b6`) |
| Evidence base | The independent Codex review of the R1/R2 foundation and the Claude adjudication that ordered this replacement; the v1.1 acceptance review and adjudication (both at `9814939c`) |
| Status | **Binding standard for R3–R8**, published normatively in canon §15.9 (R2.1 edition). This receipt restates the complete foundation so it is internally usable without consulting R2 |
| Supersession | The R2 identity model is **superseded in full**. The R2 receipt (`ARCHITECT_CBA_CANON_V2_R2_REGISTER_STANDARD.md`) is preserved unchanged as review history; no binding rule may be taken from it |
| Edition status after R2.1 | Canon v2.0 **working draft** — not accepted, not active; v2.0 checksum deliberately **not** computed (R8) |

Files changed in R2.1: `docs/reference/cba/ARCHITECT_CBA_CANON.md` (§15.9
replaced in full; header/amendment log; §1.1 and §17 taxonomy closure; the
four A11/A18.7 annotation sites),
`work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md`
(reconciliation only), and this receipt. Nothing else.

## Why R2 was replaced

R2 modeled v2 as an **in-place migration of the v1.1 namespace**: `CBA-…`
IDs would be retired/aliased where defective, successors appended into the
same namespace, top-level LEAFs converted to GROUPs, and the register
gradually mutated family by family. Independent review rejected that
foundation: it destroys the historical registry's evidentiary value (the
published v1.1 IDs must keep their published meaning), it entangles
historical and active populations in one count and one grammar, it forces
contradictory machinery (RETIRED/ALIAS half-states, PHANTOM dispositions,
role conversions, append-in-place slots, singular predecessor/successor
fields), it imposed an impossible per-unit gate schedule, and it left the
authority taxonomy without a class for non-arithmetic inference. R2.1
replaces — not patches — that model. This receipt is a complete
restatement; no agent needs to mentally combine R2 and R2.1.

## 1. Registers and namespaces

The v2.0 canon separates six record populations. Each is parsed, counted,
and gated separately; only the active v2 registry carries obligations and
verdicts.

| Register | Contents | ID grammar | Status |
|---|---|---|---|
| Published historical v1.1 registry | Canon §15.5–§15.8 and every `CBA-…` ID and register row | `CBA-<F><NN>[.<n>]` | **Frozen historical.** The authoritative historical meaning of each v1.1 ID is the published v1.1 edition at commit `9814939c`, SHA-256 `4a0760c81d7a5e95919a0373d5ff631b565d064d56b858fe3b8869ad2b6bb3f6`. Never renumbered or extended; never counted in active totals; never verdict-bearing |
| Active v2 registry | The v2 GROUP and LEAF rows built new by R3–R6 (canon §15.10 once created) | `CBA2-<F><NN>` / `CBA2-<F><NN>.<n>` | The only obligation-bearing, verdict-bearing register |
| Historical crosswalk | Typed edges from published v1.1 LEAFs to active v2 LEAFs (canon §15.11) | `XW2-<NNNN>` | Support records (§3) |
| Evidence registry | Shared source artifacts and per-LEAF authority-component evidence (canon §15.12) | `SRC2-<NNN>` / `EV2-<NNNN>` | Support records (§5) |
| Active v2 scenario library | The v2 acceptance scenarios built new by R7 (a labeled v2 subsection of canon §16) | `CBA2-SC-<NNN>` | Behavioral evidence (§7) |
| Scenario crosswalk | Typed edges from historical scenarios 1–89 to active v2 scenarios | `SXW2-<NNNN>` | Support records (§7) |

Decision records (`DR2-<NNNN>`, §4) live in the performing unit's receipt
and are cited from the registers.

Binding boundary rules:

1. The R1/R1.1 source-law corrections are **inputs for constructing v2
   obligations**. They are not retroactive redefinitions of the published
   v1.1 IDs: each v1.1 ID's historical meaning is fixed by the published
   edition at `9814939c`, and the corrected rule text feeds the active v2
   LEAF that the crosswalk points to.
2. A historical `CBA-…` ID is never reused as an active v2 ID, never
   counted in an active total, and never appears in a verdict column.
3. Historical IDs, crosswalk records, source artifacts, evidence rows,
   decision records, and scenarios are all outside active GROUP/LEAF counts
   and verdicts.

## 2. Active v2 identity rules

- **GROUP:** `CBA2-<F><NN>` where `F ∈ {A, C, R, L, S}` and `NN` is a
  two-digit zero-padded number (`CBA2-A01`, `CBA2-C01`, `CBA2-R01`,
  `CBA2-L01`, `CBA2-S01`).
- **LEAF:** `CBA2-<F><NN>.<n>` where `n` is an unpadded positive integer
  (`CBA2-A01.1`, `CBA2-C01.1`). Tools parse and sort `NN` and `n`
  numerically, never lexicographically.
- **Every active obligation is a LEAF with a fixed GROUP parent.** There
  are no top-level LEAFs in v2. One-child GROUPs are allowed.
- **A role is fixed when minted.** No ID ever converts between LEAF and
  GROUP, in either direction.
- A GROUP owns no obligation and receives no verdict, locatability status,
  method, locator, or evidence; it reports only the distribution of its
  children's statuses, and mixed child results are never collapsed into one
  parent verdict.
- Child numbering within a GROUP is contiguous from `.1`: **no skipped
  numeric child IDs** within any active v2 GROUP.

**Draft mutability.** While the register is an unaccepted draft (through
R8), a later unit may correct a defective active row only with a decision
record; if the correction removes or renumbers a LEAF, the performing unit
renumbers only within the affected GROUP to restore contiguity and updates
every crosswalk edge, evidence row, origin reference, and scenario
`Exercises:` reference in the same commit. After R9 ACCEPT, active IDs are
immutable; any change requires a new canon edition and a new acceptance
gate.

**Active LEAF fields** (all required; `—` where empty):

| Field | Content |
|---|---|
| Stable ID | Grammar above; the parent GROUP is the ID prefix |
| Canonical requirement | The one obligation, atomically stated (§4) |
| Authority classes | Comma-separated class list (§6); every listed class is backed by at least one evidence-component row |
| Primary method | Exactly one behavioral method (§7 below; canon §15.9.7) |
| Secondary methods | Zero or more distinct behavioral methods; `—` if none |
| Evidence components | The `EV2-…` rows certifying this LEAF |
| Scenario evidence | Named v2 scenario cases (populated at R7; `pending R7` before) |
| Origin | Incoming `XW2-…` edge IDs, or `new` plus the origin decision record for a newly-certified LEAF with no predecessor |
| Dependencies | Active LEAF IDs whose state/output this rule consumes |
| Lifecycle/date inputs | Required `asOfDate`/Salary Cap Year/window inputs |
| Decision records | `DR2-…` IDs that dispositioned this row |
| Notes/limitations | Bounded caveats and OPS/EXT limitations |

**Physical layout (binding for R3–R6):** per family, a main table
`ID | Requirement | Authority | Primary | Secondary | Evidence | Origin | Notes`
plus a detail table keyed by ID for
`Scenario evidence | Dependencies | Lifecycle/date inputs | Decision records`.
Both tables must be mechanically parseable and joinable on ID, with a
uniform layout across families. GROUP rows are carried per family as
`ID | Title/audit question | Active LEAF children | Notes`.

**Placement.** R3 creates canon §15.10 (active v2 register), §15.11
(historical crosswalk), and §15.12 (evidence registry); R4–R6 extend them
in place. R7 adds the active v2 scenario library and the scenario crosswalk
as a clearly labeled v2 subsection of canon §16, leaving historical
scenarios 1–89 untouched.

## 3. Historical crosswalk (XW2)

A separate, mechanically parseable register of typed edges from published
v1.1 LEAF IDs to active v2 LEAF IDs. Schema:

`Edge ID | Historical v1.1 LEAF | Active v2 LEAF or — | Edge type | Scope/relationship | Decision record`

Edge IDs are `XW2-<NNNN>`, unique and append-only. Edge types:

| Type | Meaning | Terminal? |
|---|---|---|
| `equivalent` | The historical LEAF's whole obligation is owned by the target | No |
| `split` | The historical LEAF bundled several obligations; this edge covers the named fragment | No |
| `merge` | The historical LEAF was one of several duplicate owners folded into the target | No |
| `partial-overlap` | Part of the historical LEAF's scope is covered by the target; the scope column states which part | No |
| `moved` | The same obligation re-homed under a different v2 family/parent | No |
| `process-only` | The historical row was process/instruction material; destination noted in scope | Yes |
| `invalid` | The historical row's claim was false (e.g., a false gap assertion); scope explains | Yes |
| `no-successor` | A real historical obligation deliberately carries no v2 owner; the decision record justifies it | Yes |

Binding rules:

1. The model is **historical → active and bipartite**: no edges between two
   historical IDs or two active IDs, no chains, and no role transitions —
   so no migration chain or cycle is possible, and none is allowed.
2. Every published v1.1 LEAF has **at least one outgoing edge** by the end
   of R8.
3. Every non-terminal edge targets an **existing active v2 LEAF**.
   `process-only`, `invalid`, and `no-successor` are terminal and use `—`
   as the target.
4. Compound history is expressed with **multiple typed edge records**,
   never a combined subtype.
5. An active v2 LEAF may have zero, one, or many historical predecessors. A
   LEAF with no predecessor carries explicit **newly-certified origin**
   provenance (`new` in its Origin field plus an `ORIGIN` decision record).
6. Crosswalk records **never transfer or inherit historical verdicts**;
   every active LEAF requires fresh evidence.
7. GROUP-level crosswalk notes are informational only and are excluded from
   the mandatory LEAF-coverage gate.
8. An edge is recorded by the unit that mints its target (or, for terminal
   edges, by the unit processing that historical segment). A unit that
   cannot yet record an edge because the target belongs to a later unit
   lists the deferral explicitly in its receipt; R8 requires zero remaining
   deferrals.

**True-gap rule.** Where a historical note asserted a gap, two distinct
records are required. First, the note's own edge is terminal (`invalid` for
a false claim, `process-only` for process text). Second, if the note
exposed a **real** obligation (e.g., the March 4 Two-Way signing deadline,
CBA II §11(e)(i) p. 54, hidden behind `CBA-C20.9`), a companion **true-gap
decision record** (`TG`) must prove that the real obligation received a
source-certified active v2 LEAF with newly-certified origin. The historical
note's terminal disposition and the new owner's provenance are separate
facts; neither substitutes for the other.

**Crosswalk validation** (run at the §8 gate points): reciprocity (every
non-terminal edge appears in its target's Origin field, and every Origin
entry resolves to an existing edge), duplicate-edge (no two edges share the
same historical LEAF, target, and type), valid-target, complete historical
coverage, and terminal-edge validation (terminal type ⇔ `—` target, with a
decision record).

## 4. Atomicity, canonical ownership, and decision records

**Atomicity — the mixed-verdict test (default rule).** Restate every
candidate obligation as **GIVEN** facts **WHEN** trigger **THEN** required
result. It is one LEAF iff it has exactly one THEN and no realistic
implementation could be correct on one part and wrong on another in a way
an honest auditor would report separately. Independently pass/fail-able
requirements split. Clarifications:

- A conjunctive trigger (several conditions that must all hold) leading to
  one prohibition or outcome may remain **one** LEAF.
- Separately enumerated calculations, adjustments, exceptions, deadlines,
  lifecycle stages, or outcomes that can independently succeed or fail are
  **separate** LEAFs; the signed text's own enumeration is the floor of
  granularity.
- A rule's eligibility test, calculation, lifecycle, expiration, and
  extinguishment are separate whenever Architect could implement them
  differently; numeric bounds on the same quantity are separate when each
  can fail independently.
- **Homogeneous-list exception:** a single clause listing same-kind
  elements under one trigger and one consequence may remain one LEAF only
  as an **explicitly recorded exception** — the decision record must show
  it is one prohibition/obligation, explain why separate verdicts would be
  artificial, and the LEAF's evidence must exercise **every** listed
  element. Otherwise split.
- A broad "supports X" statement is not atomic when X contains
  independently enforceable conditions.
- Testing instructions and recommended boundary percentages are process
  material, never part of a product obligation.

**Canonical ownership.** One independently auditable obligation = one
active v2 LEAF. Every other mention anywhere in the canon — correction
tables, explanatory summaries, lifecycle ledgers, implementation
instructions — is a cross-reference to the owner, never a second LEAF. No
correction-table summary, lifecycle ledger, or implementation instruction
may duplicate a substantive owner. No active v2 row may be process-shaped.

**Ownership tiebreak (deterministic, in order, stopping at the first test
that discriminates):**

1. The obligation's natural series family (A = trade correctness,
   C = Cap Manager, R = waivers/rosters, L = lifecycle/rights/dates,
   S = parameters/provenance).
2. The anchor where the canon legislates the substance (§§5–14) over
   correction-table, summary, or process anchors.
3. The statement of trigger and result that is most complete with least
   extraneous text.
4. The lowest ID in mechanical sort order.

Every duplicate candidate receives a recorded ownership decision, and the
decision record states **which tiebreak selected the owner and why**.

**Semantic, not mechanical.** Semantic uniqueness and atomicity are never
"mechanical" properties. Mechanical tooling (similarity sweeps, parsers)
may generate candidate lists, but every disposition is a semantic review
gate recorded in a decision record and evidenced in the unit receipt.

**Decision-record schema.** Decision records are parseable rows in the
performing unit's receipt:

`DR ID | Type | Subject(s) | Disposition | Test/tiebreak applied | Rationale | Resulting active LEAF(s) or — | Unit/commit`

| Type | Used for | Required content |
|---|---|---|
| `OWN` | Duplicate ownership | The full candidate set; the owner selected; which tiebreak discriminated and why; the crosswalk edges recorded for the non-owners |
| `ATOM` | Atomicity keep/split | The GIVEN/WHEN/THEN restatement; for a split, the fragment list; for the homogeneous-list exception, the explicit justification and the all-element evidence pointer |
| `TG` | True gaps | The historical gap note; the real obligation exposed; the minted LEAF; its certification evidence |
| `MOVE` | Re-parenting/movement | The historical home; the active family/parent chosen; the family-test rationale; the `moved` crosswalk edge |
| `ORIGIN` | Newly-certified origin | Why no historical predecessor exists; the primary-source basis for minting |

## 5. Source-evidence registry

A source label — or an agent's claim that it read a passage — is not
evidence. Two parseable registries carry the evidence. **Source
certification and behavioral verification are separate dimensions:**
certification never counts as a behavioral method, and no behavioral method
substitutes for certification.

**Shared source-artifact registry** (`SRC2-<NNN>`, append-only, shared
across units):

`Artifact ID | Source title/edition | Official URL | Retrieval timestamp | SHA-256 | Page geometry or relied-on values | Verifier/session/date | Mutable-source/archive note`

For mutable NBA webpages the record must include the official URL, the
retrieval timestamp, the SHA-256 of the retrieved content, the exact values
relied upon, and optionally an archive URL. Copies of the CBA PDF are never
committed to the repository; the hash-plus-citation chain is the durable
evidence.

**Per-LEAF authority-component evidence** (`EV2-<NNNN>`; one row per
authority component, so multi-component obligations never need
slash-composite labels):

`Evidence component ID | Active v2 LEAF | Authority class | Source artifact ID | Exact locator | Controlling passage or tight paraphrase | Passage-to-obligation mapping | Formula/inference/provenance details | Limitations/uncertainty`

Per-class minima:

- **CBA/BYL:** exact article/section/subsection/exhibit and printed page; a
  short controlling quotation or tight paraphrase; an explicit explanation
  of how the passage creates or bounds the obligation.
- **NBA:** title, publication date or season, direct official URL, relevant
  heading/table, and the exact values relied upon.
- **DERIVED:** the formula, inputs, source dependencies, units, and
  rounding.
- **INFERRED:** the controlling locators, the stated inference, the
  reasoning chain, and what the text does and does not expressly say.
- **OPS:** provenance, effective date, limitation, and configurability.
- **EXT:** the boundary describing which external decision is required.

**Certification rule:** an evidence-component row is valid only if the
certifying agent read the cited passage in the identified artifact during
the session that authored the row, attested per LEAF in the unit receipt.

**Adjacent provisions:** each R3–R6 receipt must record a family-level
adjacent-provision sweep (the neighboring sections read while certifying
the family); per-LEAF adjacent notes are required only where an adjacent
proviso materially limits that LEAF.

## 6. Authority taxonomy

The only authority classes are **CBA**, **BYL**, **NBA**, **DERIVED**,
**INFERRED**, **OPS**, and **EXT**. Binding meanings:

| Class | Meaning |
|---|---|
| **CBA** | Express rule in the signed 2023 NBA–NBPA CBA, including exhibits |
| **BYL** | Express rule in the June 2024 NBA Constitution and By-Laws |
| **NBA** | Official annual level, calendar, or explanatory publication |
| **DERIVED** | **Arithmetic only:** computation reproduced from a CBA/BYL/NBA formula and published inputs |
| **INFERRED** | Non-arithmetic legal or algorithmic inference supported by controlling primary-source text; carries its locators and reasoning chain; never presented as express source language |
| **OPS** | League-operational rule with **real operational provenance**; the absence of a public rule is never enough to invent an OPS rule |
| **EXT** | Requires an external league, medical, expert, arbitral, or legal determination; the product consumes an explicit state |

Binding rules:

1. Multiple authority components on one obligation are **separate evidence
   rows** (§5) — never a slash or "+" string in place of component
   evidence.
2. Unresolved composite labels (e.g., a single DERIVED/OPS label) are
   banned.
3. DERIVED is arithmetic-only; anything requiring legal or structural
   reasoning from text is INFERRED.
4. OPS without provenance is not OPS; it is an unsupported claim and may
   not be registered.
5. EXT rows state which external decision is required and the explicit
   state the product consumes.

**Closed R1.1 provisional items (binding migration treatment):**

- **A11 — component decomposition:** an express **CBA** component (the
  per-player/per-exception structure of CBA VII §6(j)(1)(i)–(v),
  pp. 240–241) plus a separately stated **INFERRED** component (the
  decomposition procedure). It is not DERIVED arithmetic. The canon's four
  A11/A18.7 annotation sites (§12.4, §12.12, and the two register rows)
  now record these dispositions; the historical v1.1-style rows remain
  migration inputs, not active v2 obligations.
- **A18.7 — conditional cash:** the express cap-year charging rule (CBA VII
  §8(a), p. 260) is **CBA**. The re-trade attribution/accounting mechanics
  must become a **separate active v2 LEAF** during A-series registration,
  classified **OPS** only with real operational provenance or **INFERRED**
  only with a controlling source chain. The former DERIVED/OPS composite is
  rejected and is not an accepted classification.

## 7. Verification methods, scenarios, and the scenario crosswalk

The five behavioral methods are **SCEN** (executable rule scenario),
**STATIC** (configuration/provenance/schema/architecture inspection),
**LIFECYCLE** (ordered state/event/history verification), **EXTS**
(externally supplied determination and its provenance), and **UI**
(user-visible representation requiring rendered/manual inspection).

Binding rules:

1. Every active v2 LEAF has **exactly one primary method** and **zero or
   more distinct secondary methods**, carried in parseable
   `Primary method` and `Secondary methods` fields. There is no
   exactly-one-method assumption: a rule may legitimately be exercised by a
   scenario and also inspected statically.
2. Source certification does not count as a behavioral method.
3. The v1.1 OPSV label is not a method and must not be assigned;
   OPS-authority configurability/provenance obligations use STATIC with the
   OPS evidence minima.
4. Architecture and representation properties are STATIC, never SCEN. If no
   honest scenario exists for a SCEN-primary LEAF, reclassify the primary
   method — never attach a cosmetic mapping.

Minimum evidence per method: **SCEN** — a v2 scenario whose named case
exercises the LEAF. **STATIC** — the inspected artifact identity, the
property confirmed, how it was inspected, and the commit/date (plus
provenance/version/configurability proof for OPS rows). **LIFECYCLE** — the
ordered event sequence, the asserted state after each step, and persistence
across the sequence. **EXTS** — the enumerated external states, the
provenance record shape, the expected behavior per state including
"assumption required" surfacing, and confirmation that no state is
auto-derived. **UI** — the state to render, exactly what the user must see,
and the rendered-inspection record.

**Scenario library.** Historical scenarios 1–89 are **frozen** as
v1.1-lineage historical scenarios (as amended through R1/R1.1); they are
migration inputs, not the active v2 library, and are not edited after R1.1.
Scenarios 53, 57, and 68 remain historical and incomplete; their
replacement coverage belongs to R7. The active grammar is `CBA2-SC-<NNN>`
(`CBA2-SC-001`, `CBA2-SC-002`, …), built from scratch by R7. Every active
v2 scenario states:

1. Scenario ID.
2. An explicit season/date or versioned-calendar input.
3. Inputs.
4. The boundary being tested.
5. The exact expected result, including arithmetic where relevant.
6. The controlling authority.
7. Named case/variant identifiers (e.g., `CBA2-SC-014(a)`).
8. An `Exercises:` list of active v2 LEAFs.

Every scenario→LEAF edge must correspond to a **named case that genuinely
exercises that LEAF**: the case's facts and expected results test the
obligation, not merely cite it. The register's Scenario-evidence column and
the scenario `Exercises:` lists must reconcile **bidirectionally**. R7 must
review every edge exhaustively; later sampling (R8/R9) is an additional
audit, never a substitute.

**Scenario crosswalk** (`SXW2-<NNNN>`): a separate parseable register of
typed edges from historical scenarios 1–89 to active v2 scenarios, with the
schema
`Edge ID | Historical scenario | Active v2 scenario or — | Edge type | Scope/relationship | Decision record`
and edge types `equivalent`, `split`, `merge`, `partial-overlap`, `moved`,
`invalid`, and `no-successor` (the last two terminal, with `—` targets).
The §3 crosswalk rules apply analogously: bipartite historical → active,
compound history as multiple edges, no verdict or coverage inheritance — a
crosswalk edge never makes a historical scenario part of the active
library.

## 8. Release gates and timing

Gates run at the point where their inputs exist — never earlier. Mechanical
gates are parser-checkable and their outputs are recorded verbatim in the
gating receipt; semantic gates require reviewer judgment evidenced in the
same receipt. No gate output may claim that a parser proved a semantic
property (uniqueness, atomicity, coverage truth, or dependency
completeness).

### R3–R6: unit-local gates only

Each family unit checks, for the families it touched:

| # | Gate |
|---|---|
| U1 | Active v2 ID grammar and uniqueness |
| U2 | Fixed roles and valid GROUP parents |
| U3 | Family active counts, recomputed mechanically |
| U4 | Semantic atomicity dispositions — every registered LEAF has an `ATOM` record (or is covered by one) |
| U5 | Semantic duplicate/ownership dispositions — every duplicate candidate has an `OWN` record |
| U6 | Tiebreak decision records — every ownership decision states the discriminating tiebreak and why |
| U7 | Crosswalk coverage and valid targets for the historical LEAFs touched by the unit (deferrals listed explicitly) |
| U8 | Per-LEAF evidence completeness — every authority component has a complete `EV2` row |
| U9 | Shared source-artifact records — every `EV2` row resolves to a valid `SRC2` record |
| U10 | Primary/secondary method validity (exactly one primary; distinct secondaries; no OPSV) |
| U11 | No process-shaped active rows |
| U12 | Every true-gap note has a minted, fully certified owner (`TG` records complete) |
| U13 | No skipped numeric child IDs within each active v2 GROUP |
| U14 | Family-level adjacent-provision sweep recorded in the receipt |

Code-map gates, Phase 2 packet gates, global dependency gates, and global
scenario-reconciliation gates are **not** run during R3–R6.

### R7: scenario gates

| # | Gate |
|---|---|
| SC1 | v2 scenario ID grammar and schema checks (all eight required elements) |
| SC2 | Historical-scenario crosswalk coverage — every historical scenario 1–89 has at least one `SXW2` edge |
| SC3 | Bidirectional scenario↔LEAF reconciliation (register Scenario-evidence ⇔ scenario `Exercises:` lists) |
| SC4 | Exhaustive named-case review for every `Exercises:` edge — the named case genuinely exercises the LEAF |
| SC5 | No cosmetic or unsupported scenario mappings |

### R8: global reconciliation gates

| # | Gate |
|---|---|
| G1 | Complete historical-LEAF crosswalk coverage — every published v1.1 LEAF has at least one outgoing edge; zero deferrals remain |
| G2 | All non-terminal crosswalk targets resolve to active v2 LEAFs |
| G3 | Terminal edges and companion true-gap records validate |
| G4 | Global active GROUP/LEAF counts, with historical and support records excluded |
| G5 | The code map and Phase 2 packets contain active v2 LEAFs only |
| G6 | Every active v2 LEAF appears exactly once wherever the map/packet contract requires it |
| G7 | No historical ID, GROUP, crosswalk edge, or scenario ID appears in a verdict column |
| G8 | Dependency order contains no later-unit dependency and no cycles — mechanical cycle/order checks **plus a semantic dependency review** (a parser cannot prove a dependency was never omitted) |
| G9 | Global ownership/atomicity reconciliation across families |
| G10 | Scenario reconciliation rerun (SC1–SC5 across the whole library) |
| G11 | Sampled semantic rechecks of merge/split decisions, scenario coverage, and source-derived obligations |
| G12 | README status update — recording R8 completion while keeping the canon unaccepted |
| G13 | Final v2 checksum and counts recorded in the receipt |

### R9: independent acceptance

The independent reviewer (who authored no part of v2.0) must:

1. Re-run every mechanical gate from scratch.
2. Independently sample primary-source passages.
3. Independently sample active obligation atomicity and ownership.
4. Independently sample scenario truth.
5. Runtime-sample code-map pointers.
6. Issue an explicit **ACCEPT or REJECT** at a pinned clean commit.

Only R9 ACCEPT closes Phase 1 or unblocks Phase 2/W1.1.

## 9. Superseded R2 machinery

The following R2 concepts are superseded and must not appear in any binding
rule, register, crosswalk, receipt gate, or disposition from R2.1 onward.
They may be named only in clearly labeled historical or superseded
descriptions (the amendment log, the preserved R2 receipt, and review
history):

| Superseded R2 concept | v2 treatment |
|---|---|
| Same-namespace in-place retirement of `CBA-…` IDs | The historical registry is frozen; v2 obligations are new `CBA2-…` IDs linked by the XW2 crosswalk |
| RETIRED/ALIAS as an active node role | No such role; historical IDs are outside the active registry entirely |
| PHANTOM as a disposition | Terminal `invalid` crosswalk edges plus, where a real obligation was exposed, a companion true-gap record |
| Append-in-place successor slots in the historical namespace | Nothing is ever appended to the historical namespace |
| GROUP retirement | Active GROUPs are minted with the registry; historical GROUPs are frozen |
| Top-level-LEAF and LEAF→GROUP conversion | Roles are fixed at minting; no top-level LEAFs exist in v2 |
| Singular predecessor/successor fields | Typed many-to-many crosswalk edges; the Origin field lists any number of incoming edges |
| Exactly one verification method per LEAF | Exactly one primary method plus zero or more secondary methods |
| DERIVED for non-arithmetic inference | INFERRED |
| DERIVED/OPS composite labels | Separate evidence rows per component; unresolved composites banned |
| Per-unit code-map and global dependency gates | Unit-local gates in R3–R6; global gates at R8 |
| Scenarios 1–89 as the active library | Frozen historical; the active library is `CBA2-SC-…`, built by R7 |

Retained from R2 (restated above, not incorporated by reference): the
mixed-verdict atomicity test and its clarifications, the homogeneous-list
exception (now an explicitly recorded exception), the deterministic
ownership tiebreak, the process-material exclusion, the per-class evidence
minima, and the method-fit rules — all as restated in §§4–7.

## 10. Design decisions

1. **Two namespaces, not one.** Freezing `CBA-…` and minting `CBA2-…`
   preserves the published v1.1 registry as evidence, makes historical and
   active populations mechanically separable, and eliminates every
   retirement/alias/conversion half-state that the R2 model needed.
2. **All-LEAF-under-GROUP.** Removing top-level LEAFs removes the
   LEAF→GROUP conversion machinery and makes the grammar uniform; a
   one-child GROUP is harmless.
3. **Typed many-to-many crosswalk.** Split/merge/partial-overlap histories
   are facts about v1.1; expressing them as typed edges (rather than
   successor fields on mutated rows) keeps history complete without
   entangling the active register.
4. **Terminal edge types.** `process-only`, `invalid`, and `no-successor`
   make "this historical row deliberately has no v2 owner" an explicit,
   gateable disposition instead of a silent omission.
5. **True-gap companion records.** The v1.1 failure mode was a note that
   simultaneously asserted and hid a real obligation; separating the note's
   terminal disposition from the new owner's certified provenance makes
   both halves checkable.
6. **INFERRED.** The adjudication showed DERIVED being stretched over
   non-arithmetic legal inference (A11) and composites being invented where
   provenance was missing (A18.7). An explicit inference class with a
   required reasoning chain closes both holes without inflating CBA or
   inventing OPS rules.
7. **Primary + secondary methods.** The exactly-one-method model forced
   dishonest single labels on rules that are legitimately exercised
   multiple ways; one primary preserves accountability while secondaries
   record real additional evidence.
8. **Semantic gates named as semantic.** R2 described uniqueness/atomicity
   resolution as mechanically checkable; the truth is that parsers generate
   candidates and humans disposition them. The gate language now says so.
9. **Retimed gates.** R2 required per-unit gates (M9/M13 classes) whose
   inputs do not exist until R7/R8 — an impossible schedule. Gates now run
   where their inputs exist.
10. **Draft mutability with post-acceptance immutability.** Contiguous
    child numbering plus a construction-phase correction rule avoids
    recreating retirement machinery inside the active namespace while
    keeping accepted IDs stable forever.

## 11. Terminology sweep (R2.1)

Sweep target: every binding surface after this unit — the canon outside the
frozen historical sections, this receipt, and the repair plan. Forbidden
binding reliance checked:

| Forbidden concept | Result |
|---|---|
| Same-namespace in-place retirement | Absent from binding text; named only in historical/superseded labels |
| RETIRED/ALIAS as an active model | Absent; named only in the amendment log's superseded R2 row, the supersession lists, and the preserved R2 receipt |
| PHANTOM as a disposition | Absent; same treatment |
| LEAF→GROUP conversion | Absent; §15.9.2 fixes roles at minting |
| GROUP retirement | Absent |
| Append-only successor slots in the historical namespace | Absent; the historical namespace is frozen |
| Singular predecessor/successor fields | Absent; Origin lists any number of incoming XW2 edges |
| Exactly-one behavioral method | Absent; primary + secondary model throughout |
| DERIVED for non-arithmetic inference | Absent; DERIVED is arithmetic-only, INFERRED covers inference |
| DERIVED/OPS | No unresolved composite remains; the two legacy annotation sites state the composite is rejected and record the R2.1 disposition |
| Per-unit code-map/global dependency gates | Absent; unit-local gates only in R3–R6 |
| Scenarios 1–89 as the active v2 library | Absent; frozen historical, active library is `CBA2-SC-…` |

Historical sections (§15.5–§15.8, scenarios 1–89, the amendment log's R1/R2
rows, and the preserved R1/R1.1/R2 receipts) retain their original wording
by design; each such surface is labeled historical or superseded.

## Validation performed (R2.1)

- Baseline verified before work: HEAD = `origin/architect/cba-canon-v2` =
  `1532c9286e85bfaf2760006923a01eb0ecce9a78`; R2 parent = `056b9d02…`;
  R1 = `af931e90…`; `main` = `origin/main` = `69f8f6b6…`; working tree
  clean.
- Files changed: exactly the canon, the repair plan, and this receipt.
- Mechanical checks recorded in the R2.1 report: no ID or scenario
  migration performed; historical scenarios 1–89 byte-unchanged; no `CBA-…`
  register row added, removed, renumbered, split, merged, or re-parented
  (only the four ordered A11/A18.7 annotation sites reworded); the binding
  standard contains the exact active-ID, crosswalk, evidence, authority,
  method, scenario, and timing schemas; the §11 terminology sweep passed;
  `main` untouched; final worktree clean.
- `npm run lint:md` run at checkpoint (pre-existing accepted MD029
  continuous-numbering class in §16 only, plus pre-existing errors confined
  to unrelated files).
- `npm run docs:guardrails` run at checkpoint: pass.
- No app tests run (documentation/standards change per repair-plan global
  rule 6).

## Confirmation

R2.1 defined standards and closed the two ordered taxonomy items only. No
active v2 register, crosswalk edge, evidence row, decision record, or
scenario was created; those belong to R3–R7. The historical v1.1 register
rows (except the four ordered annotation sites), scenarios 1–89, source
values, code map, README, R1/R1.1/R2 receipts, historical review artifacts,
application code, tests, schemas, fixtures, configuration, and data are
unchanged. Linear was not read or written. R3–R9, Phase 2, and W1.1 were
not started. The combined R1.1/R2.1 foundation awaits independent Codex
review before R3 may begin.
