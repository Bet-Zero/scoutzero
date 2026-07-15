# Architect CBA Canon v2.0 — R2.4 Receipt: Remaining Foundation-Blocker Closure

## 1. Provenance and baseline

| Field | Value |
|---|---|
| Repair unit | R2.4 — the four remaining foundation blockers found by the independent Codex review of R1.2/R2.3 (REJECT/BLOCK-R3 at `c2228607…`), executed as its own bounded unit |
| Branch | `architect/cba-canon-v2` |
| Baseline commit | **`c22286072578beed0020c7749e651a50ce566d43`** — the full R2.3 checkpoint SHA, verified as HEAD = `origin/architect/cba-canon-v2` at session start (short form `c2228607`); parent = `07d5aa58a4ed355667293b999fb66eb48eb7c0b0` (R1.2); R2.2 = `6aa616fd…`; R2.1 = `05c1b28e…`; R1.1 = `1532c928…`; R2 = `056b9d02…`; R1 = `af931e90…` |
| `main` | `main` = `origin/main` = `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288` — untouched by this unit |
| Clean-state verification | Worktree, index, and untracked state completely clean at session start; ahead/behind vs upstream 0/0 |
| Ordering review | The independent Codex review of R1.2/R2.3 at `c2228607` returned **REJECT/BLOCK-R3**. It **expressly passed** — and this unit did not reopen or redesign — R1.2's extension-bonus source-law correction, R2.3's SC2/SXW2 integrity gate, R2.3's historical-register population distinction, and the units' scope and preservation. It found **four remaining foundation blockers** (§3 below) and ordered R2.4 as a bounded standards/source-policy/status correction unit |
| Scope | Standards, source-policy, and status reconciliation only. No concrete v2 record; no register row, scenario, ID, or source value changed; R3–R9, Phase 2, and W1.1 not started |
| Edition status after R2.4 | Canon v2.0 **working draft** — not accepted, not active; **R2.4 is not independently accepted**; v2.0 checksum deliberately **not** computed (R8) |

## 2. Files changed — exactly three

1. `docs/reference/cba/ARCHITECT_CBA_CANON.md` — the §1.1 conflict
   order; the §1.2 and §17 verdict-exclusion terminology; the §12/§12.1/
   §12.2/§13/§13.3 candidate recasts; the §15 evidence-pointer rows for
   A15/A17; §15.9.1 boundary rule 4; the §15.9.2 child-ID numbering
   contract; the §15.9.6 type-specific `SRC2-…` record contract,
   unsupported-operational-candidate definition, and transitive
   evidence-root compatibility model; the §15.9.9 U8/U9/U13/G14/G15/R9
   updates; the §15.9 intro/heading receipt references; §17 Pass 1; the
   §19.1 OPS row; the §19.3 continuity-note extension; the header "What
   v2.0 changes" paragraph; and one new amendment-log row.
2. `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md` —
   status reconciliation (the R1.2/R2.3 Codex review result; R2.3
   executed at the full verified SHA; the new R2.4 unit section with the
   four blockers and correction contracts; global rule 1; the R3
   dependency; the R8/R9 gate-description updates matching the corrected
   canon gates).
3. `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_4_FOUNDATION_CONTRACT_CLOSURE.md`
   — this receipt (new).

Nothing else. The R1, R1.1, R1.2, R2, R2.1, R2.2, and R2.3 receipts are
untouched immutable review history. No application, README, code-map,
test, schema, fixture, configuration, or data file changed; Linear was
not read or written.

## 3. The four formal Codex findings repaired

| # | Finding | Correction contract |
|---|---|---|
| 1 | The `SRC2-…` schema remained a single file-shaped row; mandatory OPS and EXT details existed only in prose, so U8/U9/G14/R9 could not deterministically locate or validate them | A mechanically parseable type-specific contract: a shared eleven-field base table plus one pinned detail table per provenance type, joinable on Record ID; pinned field grammar; per-type `—` validity; binding timestamp/hash rules; field-level validation at U8/U9/G14/R9 (§4–§6 below) |
| 2 | Transitive `EV2-…` dependencies could launder OPS/EXT authority into DERIVED/INFERRED while passing every local pairing, termination, acyclicity, and Authority ⇔ EV check | A binding transitive dependency-class/root compatibility model: complete closures and terminal `SRC2-…` root sets computed for every component, nine binding rules, a parseable compatibility matrix, and rejection of locally valid but transitively incompatible chains (§7–§8 below) |
| 3 | Binding §1.1 (conflict order), the §12 authority statement, §12.2, the §13 authority statement, and §13.3 still promoted secondary reporting into enforceable operational rules | The hierarchy ends at legitimate official authority; the affected mechanics are recast as **unsupported operational candidates** — preserved for discovery, never registrable, never OPS, never automatic/configurable verdicts, never enforceable without qualifying first-party provenance or another valid classification; the whole binding canon and plan swept (§9 below) |
| 4 | The AMEND child-contiguity, no-ID-reuse, renumbering, and no-tombstone rules contradicted one another: removing `.2` from `.1/.2/.3` had no legal outcome | Contiguity applies at initial GROUP construction only; renumbering-to-restore-contiguity removed; post-AMEND gaps valid only when fully explained through the receipts and `AMEND` chain; no reuse; high-water-mark allocation; no tombstones; U13/G15/R9 conformed; binding worked examples (§10 below) |

## 4. Type-specific SRC2 record contract — before/after

| Aspect | Before (R2.3 edition) | After (R2.4) |
|---|---|---|
| Shape | One nine-column row (`Record ID \| Provenance type \| Source title/edition \| Official URL or — \| Retrieval timestamp \| SHA-256 or — \| Page geometry or relied-on values \| Verifier/session/date \| Mutable-source/archive note`) with per-type required fields described in the prose "Required fields" column | One **base row** (eleven pinned fields) **plus** one **type-specific detail row** per record, joinable on Record ID; a record missing its detail row is invalid; mandatory fields live only in pinned columns, never solely in a prose note |
| OPS fields | "Named provenance, effective date, verification method, limitations, and configurability" as a prose cell | Pinned detail columns: `Named first-party provenance identity \| Authority/role of the source \| Practice scope \| Effective date or window \| Authentication method \| Configurability \| Artifact identity or —`, plus the base row's required Authentication timestamp and Record limitations |
| EXT fields | "Determination class, runtime input shape, required provenance, scope, effective/expiration behavior" as a prose cell | Pinned detail columns: `External determination class \| Runtime input schema \| Required decision provenance \| Scope \| Effective/expiration behavior \| Controlling source/rule reference or — \| Verification/authentication method`, plus the base row's required Authentication timestamp and Record limitations |
| Multi-value fields | No pinned delimiter | `"; "` (a semicolon then a space) element separator; no element contains `;` or `\|`; empty = `—`; ID references use the `EV2` `", "` grammar |
| `—` validity | Generic ("or —") per column | Defined **per provenance type** in a base-field × type matrix (§5) |
| Timestamps | Retrieval timestamp only | Retrieval **and** Authentication timestamps, each with binding applicability rules (§5) |
| Validation | Presence implied; no field-level gate language | Field-level validation at U8/U9, G14, and R9: absent, malformed, or wrongly-`—` fields **fail the record**, which then certifies nothing (§6) |

The four pinned detail schemas now binding in canon §15.9.6:

- `official-immutable`:
  `Record ID | Source title and edition | Page geometry`
  (base row carries required Publication/effective date, Official URL,
  Retrieval timestamp, Artifact SHA-256).
- `official-mutable`:
  `Record ID | Publication identity/date or season | Exact values or text relied upon | Archive/snapshot reference or —`
  (base row carries required Official URL, Retrieval timestamp,
  retrieved-content SHA-256).
- `ops-provenance`:
  `Record ID | Named first-party provenance identity | Authority/role of the source | Practice scope | Effective date or window | Authentication method | Configurability | Artifact identity or —`
  (base row carries required Authentication timestamp and Record
  limitations; Official URL/Artifact SHA-256 `—` only where none
  exists).
- `ext-contract`:
  `Record ID | External determination class | Runtime input schema | Required decision provenance | Scope | Effective/expiration behavior | Controlling source/rule reference or — | Verification/authentication method`
  (base row carries the required verification/authentication timestamp
  in its Authentication timestamp field; `Controlling source/rule
  reference` may be `—` only where the contract itself defines the
  boundary).

No `SRC2-…` record was created; every example in this receipt is
explicitly illustrative.

## 5. Timestamp and `—` rules by provenance type (now binding)

Per-type `—` validity (canon §15.9.6):

| Base field | `official-immutable` | `official-mutable` | `ops-provenance` | `ext-contract` |
|---|---|---|---|---|
| Source/provenance identity | Required | Required | Required (named first-party identity) | Required (determination-contract identity) |
| Publication/effective date | Required | Required | Required (effective date or window) | `—` only where no dated basis exists |
| Official URL | Required | Required | `—` only when no URL exists | `—` only when no URL exists |
| Artifact SHA-256 | Required | Required | `—` only when no durable artifact exists | `—` only when no durable artifact exists |
| Retrieval timestamp | Required | Required | Required when content/artifact retrieved; else `—` | Required when content/artifact retrieved; else `—` |
| Authentication timestamp | `—` unless separately applicable | `—` unless separately applicable | **Required** | **Required** |
| Record limitations | Required (`none` expressly) | Required (`none` expressly) | Required | Required |
| Record status/version | Required | Required | Required | Required |

Binding timestamp/hash rules: durable bytes are always hashed; URL `—`
only when no URL exists; hash `—` only when no durable artifact exists;
a retrieval timestamp is required whenever content or an artifact was
retrieved; an authentication timestamp is required for direct
communications, attestations, system access, and every other non-public
verification; and an artifactless `ops-provenance` record can never
carry `—` for both its provenance-identity and authentication fields.

## 6. Field-level validation matrix

| Gate | New field-level duty (canon §15.9.6/§15.9.9) |
|---|---|
| U8 | Every referenced `SRC2` record passes type-specific field-level validation: base row plus its pinned detail row present and joinable; no required field absent or malformed; no `—` where the per-type matrix prohibits it; per-type timestamp and hash rules satisfied |
| U9 | Every `SRC2`/`EV2` reference parses and resolves; plus the transitive-closure duties of §7 below |
| G14 | Recomputes field-level validation across the whole registry, plus the global transitive recomputation of §7 |
| R9 | Independently re-runs field-level validation and independently recomputes every closure and terminal root set |

A failed `SRC2-…` record certifies nothing, and no `EV2-…` component
may reference it.

## 7. Transitive evidence-root compatibility (now binding)

For every `EV2-…` component, validators compute the complete transitive
dependency closure and its terminal `SRC2-…` root set, then enforce
nine binding rules (canon §15.9.6): CBA/BYL/NBA components root in
their official records; DERIVED stays arithmetic-only with official
roots and no `ops-provenance`/`ext-contract` root — an OPS/EXT-derived
runtime value can never hide inside a DERIVED-only claim; INFERRED
resolves through official text and earlier compliant DERIVED/INFERRED
components with no OPS/EXT root — OPS reporting cannot become INFERRED
through a dependency, and an EXT determination cannot become express or
inferred law; OPS retains an `ops-provenance` root and EXT an
`ext-contract` root; a LEAF consuming OPS/EXT directly or transitively
keeps the class visible in its Authority field, carries a corresponding
`EV2-…` component, and propagates every operational limitation,
configurability requirement, external runtime input, and
assumption-required state to its Notes/limitations and behavioral
contract; and no dependency edge reduces, erases, or upgrades its
source's authority or limitation status.

Compatibility matrix (as now pinned in canon §15.9.6):

| Consuming EV class | Permitted direct dependency classes | Permitted terminal SRC2 provenance types | Required propagated classes/limitations | Forbidden dependency/root combinations |
|---|---|---|---|---|
| CBA | — | `official-immutable` (signed CBA) | — | Any dependency component; any `official-mutable`/`ops-provenance`/`ext-contract` root |
| BYL | — | `official-immutable` (controlling By-Laws) | — | Any dependency component; any `official-mutable`/`ops-provenance`/`ext-contract` root |
| NBA | — | `official-immutable`, `official-mutable` | — | Any dependency component; any `ops-provenance`/`ext-contract` root |
| DERIVED | CBA, BYL, NBA, DERIVED | `official-immutable`, `official-mutable` | Formula-input and rounding limitations | Any OPS/EXT dependency; any `ops-provenance`/`ext-contract` root |
| INFERRED | CBA, BYL, NBA, DERIVED, INFERRED | `official-immutable`, `official-mutable` | Inference-chain limitations | Any OPS/EXT dependency; any `ops-provenance`/`ext-contract` root |
| OPS | — | ≥1 `ops-provenance`; official types may corroborate | OPS class, operational limitations, configurability → LEAF | Terminal root set without an `ops-provenance` record |
| EXT | — | ≥1 `ext-contract`; official types may bound | EXT class, runtime-input contract, "assumption required" → LEAF | Terminal root set without an `ext-contract` record |

U9 enforces this per unit; G14 recomputes it globally; R9 independently
recomputes every closure and terminal root set. A locally valid but
transitively incompatible chain **fails**.

## 8. Authority-laundering adversarial examples

All IDs below are illustrative placeholders in prose — no register
contains them and none was minted.

1. **DERIVED → OPS-only root — must fail.** `EV2-9001` (DERIVED,
   LEAF-level arithmetic) lists no direct source and one dependency
   `EV2-9002` (OPS) whose only reference is `SRC2-910`
   (`ops-provenance`). Locally: both rows non-empty, termination holds,
   acyclic, pairing valid on each row, Authority ⇔ EV reconciles.
   Transitively: `EV2-9001`'s terminal root set = {`SRC2-910`
   (`ops-provenance`)} — forbidden for DERIVED by the matrix and rule 4.
   **FAIL** (the exact Codex counterexample class).
2. **INFERRED → EXT-only root — must fail as inferred law.** `EV2-9003`
   (INFERRED) depends only on `EV2-9004` (EXT) rooted in `SRC2-920`
   (`ext-contract`). Terminal root set = {`ext-contract`} — forbidden
   for INFERRED by the matrix and rule 5: an external determination
   cannot become express or inferred law. **FAIL.**
3. **Official-rooted DERIVED chain — may pass.** `EV2-9005` (DERIVED)
   lists `SRC2-901` (`official-immutable`, the signed CBA formula
   passage) and dependency `EV2-9006` (NBA) rooted in `SRC2-902`
   (`official-mutable`, the official annual release value). Closure
   roots = {`official-immutable`, `official-mutable`}; dependency
   classes {NBA} permitted; arithmetic-only; inputs resolve exactly.
   **PASS.**
4. **LEAF consuming a separate OPS component — may pass.** An
   illustrative LEAF lists Authority `CBA, OPS`; its OPS component
   `EV2-9007` references `SRC2-930` (`ops-provenance`, all required
   fields); the LEAF's Notes/limitations carry the operational
   limitation and configurability. OPS is visible, the typed root is
   retained, propagation holds. **PASS** — laundering is the hidden
   consumption, not the visible one.
5. **LEAF consuming EXT runtime state — may pass.** An illustrative
   LEAF lists Authority `CBA, EXT`; `EV2-9008` references `SRC2-940`
   (`ext-contract` defining the determination class and runtime input
   schema); the LEAF's behavioral contract surfaces "assumption
   required" and never an unqualified PASS/FAIL. **PASS.**

## 9. Complete binding secondary-source sweep — every hit and disposition

Sweep universe: the entire canon and the repair plan, searched for
`secondary expert`, `secondary operational`, `CBAguide`,
`reported league`, `touch rule`, `qualifying asset`, `seven future`,
`seven-draft`/`seven-future`, `protection`, `deferral`, and `OPS`, with
every hit semantically inspected. No zero-conflict claim is made from
the literal patterns alone; the dispositions below are the semantic
review. Population key: **EDITED** (binding surface corrected this
unit); **CONSISTENT** (binding surface already conforming — retained);
**FROZEN** (the §15.1–§15.8 working-copy rows or §16 historical
scenarios — never edited; §15.9.1 boundary rule 4 makes them
non-authorizing); **HISTORY** (amendment-log/edition rows and receipt
descriptions of earlier units — accurate history, retained).

### 9.1 `secondary expert`

| Hit | Disposition |
|---|---|
| §1.1 conflict order "→ secondary expert source" | **EDITED** — removed; the hierarchy now ends with official CBA 101 explanation, and secondary/discovery sources are expressly outside it |

Zero remaining occurrences in the canon or plan.

### 9.2 `secondary operational`

| Hit | Disposition |
|---|---|
| Plan R2.3 unit, finding 2 ("canon §15.9.6 permitted secondary operational reporting…") | **HISTORY** — describes the corrected R2.3-era defect |

Zero binding occurrences.

### 9.3 `CBAguide`

| Hit | Disposition |
|---|---|
| Header "Discovery source … never controlling" | **CONSISTENT** |
| Edition-log "Discovery benchmark" row | **HISTORY** |
| §1.1 "CBAguide is a discovery/indexing source only" | **CONSISTENT** (now paired with the outside-the-hierarchy sentence) |
| §5, §6, §7, §8, §9, §10, §11 authority lines ("used for discovery only") | **CONSISTENT** |
| §5.8 "[CBAguide calculator] is a secondary implementation aid" | **CONSISTENT** — an aid label under a CBA-cited authority line; establishes nothing |
| §12 authority line ("…and for the **OPS** items explicitly labeled below") | **EDITED** — now "discovery only" plus the unsupported-candidate statement |
| §12.2 ("CBAguide reports them as league-operational rules. Architect should enforce them…") | **EDITED** — full candidate recast; the enforcement imperative removed |
| §13 authority line ("…are **OPS** rules reported by CBAguide") | **EDITED** — unsupported-candidate recast |
| §14 "[CBAguide's calendar] is a useful secondary consolidation" | **CONSISTENT** — discovery aid; dates are versioned from official sources |
| §15.9.5 rule 4 and §15.9.6 never-sufficient lists naming CBAguide | **CONSISTENT** — prohibition, not promotion |
| §17 release-gate item 7 (contradiction scan comparing CBAguide) | **CONSISTENT** — comparison for discovery; conflicts resolve by the §1.1 order, which now ends at official authority |
| §19.4 CBAguide URL list | **CONSISTENT** — "sections reviewed for discovery" |
| Plan global rule 4 and R2.3 finding text | **CONSISTENT**/**HISTORY** |

### 9.4 `reported league`

Zero occurrences anywhere.

### 9.5 `touch rule` / touch mentions

| Hit | Disposition |
|---|---|
| §12.1 validation-order step 3 ("Validate multi-team connectivity/touch requirements.") | **EDITED** — now conditioned on registration with qualifying provenance; drives no verdict while unsupported |
| §12.2 heading and body | **EDITED** — candidate recast (heading retained as the candidate's anchor) |
| §15 evidence-pointer row `A15` ("§12.2 (**OPS**)") | **EDITED** — "unsupported operational candidate — §15.9.6; not OPS" |
| §15.1 `CBA-A15` audit question; §15.7 `CBA-A15.1`–`.5` rows | **FROZEN** — historical working-copy rows; non-authorizing per §15.9.1 rule 4 |
| §16 scenario 46 ("OPS regression … must fail under the configured league-operational rule") | **FROZEN** — pinned historical scenario; non-authorizing |
| §15.9.6 candidate list naming the touch test | **EDITED** (new candidate-of-record entry) |
| §17 Pass 1 ("configured **OPS** multi-team touch rule") | **EDITED** — candidates enter the pass only if first registered through the evidence process |
| §19.3 "OPS—configurable" row naming the touch rule | **FROZEN-legacy row** retained; the §19.3 continuity note now expressly states the row establishes nothing (**EDITED** note) |

### 9.6 `qualifying asset`

| Hit | Disposition |
|---|---|
| §12.2 bullet | **EDITED** — "Reported:" candidate framing |
| §15.7 `CBA-A15.2` row | **FROZEN** |
| §16 scenario 54 | **FROZEN** |
| §19.1/§19.3 mentions | **EDITED** row / **FROZEN-legacy** row + edited continuity note |

### 9.7 `seven future` / `seven-draft` / `seven-future`

| Hit | Disposition |
|---|---|
| §13 authority line | **EDITED** |
| §13.3 horizon bullet ("**OPS:** … Treat the horizon as a versioned league rule.") | **EDITED** — unsupported-candidate recast; the versioned-league-rule instruction removed |
| §13.3 "two years after prior conveyance … cannot defeat the seven-year rule" | **EDITED** — folded into the candidates bullet (it presupposed the unsupported horizon) |
| §15 evidence-pointer row `A17` ("BYL 7.03 plus **OPS** horizon") | **EDITED** — "plus the unsupported seven-draft-horizon candidate" |
| §15.1 `CBA-A17` question; §15.7 `CBA-A17.3`/`.4`/`.7` rows | **FROZEN** |
| §16 scenario 55 | **FROZEN** |
| §19.1 row | **EDITED** — authority column no longer `OPS`; now "Unsupported operational candidate — no qualifying authority located" |
| §19.3 row | **FROZEN-legacy** + edited continuity note |

### 9.8 `protection`

The overwhelming majority of hits are the CBA's own **compensation
protection** concept (§§3, 5.5–5.7, 5.9, 6, 8.7-adjacent, 10–12, 14,
§15 rows, §16 scenarios, §19.1) — express signed-CBA subject matter,
**CONSISTENT**, retained. Pick-protection hits:

| Hit | Disposition |
|---|---|
| §4.2 rights-ledger list ("Pick ownership, swaps, protections, deferrals, …") | **CONSISTENT** — data-model representation of pick state, not enforcement of a secondary-reported mechanic |
| §13.3 protections/fallback-conveyances bullet | **EDITED** — representation retained; the secondary-reported deferral/combination mechanics split out as candidates |
| §13.3 "Protections must be evaluated across all possible conveyance branches" | **CONSISTENT** — required by BYL 7.03's "may leave" branch test |
| §15.1 `CBA-A17` question; §15.7 `CBA-A17.1`/`.3` rows | **FROZEN** |
| §16 scenarios 45/55 | **FROZEN** |
| §19.3 row ("certain pick-protection/deferral processing mechanics") | **FROZEN-legacy** + edited continuity note |
| Plan R1.2/R7 mentions (zero-protection fallback; protection-increase limits) | **CONSISTENT** — compensation-protection sense |

### 9.9 `deferral`

| Hit | Disposition |
|---|---|
| §4.2 rights-ledger list | **CONSISTENT** (representation) |
| §13.3 deferral mechanics | **EDITED** (candidates) |
| §15.7 `CBA-A17.1`/`.3` rows; §16 scenario 55 | **FROZEN** |
| §15.9.3 rule 8, U5/U7, G1 "deferrals" | **CONSISTENT** — crosswalk-deferral sense, unrelated to picks |
| §19.3 row | **FROZEN-legacy** + edited continuity note |
| Plan R3/R8 "deferrals" | **CONSISTENT** — crosswalk sense |

### 9.10 `OPS`

Binding-surface hits, each inspected:

| Hit | Disposition |
|---|---|
| Header use rule and §1.1 OPS row (first-party provenance required; secondary reporting never establishes it) | **CONSISTENT** |
| Header "What v2.0 changes" and amendment-log rows R1–R2.4 | **HISTORY** — descriptions of each unit as executed |
| §12 authority line; §12.1 step 3; §12.2 | **EDITED** |
| §12.4 A11 annotation (express CBA + INFERRED components) | **CONSISTENT** |
| §12.12 A18.7 annotation ("classified OPS only with real operational provenance or INFERRED only with a controlling source chain") | **CONSISTENT** — conditional on qualifying provenance, exactly the policy |
| §13 authority line; §13.3 horizon bullet | **EDITED** |
| §15 evidence-pointer rows A15/A17 | **EDITED** |
| §15.1/§15.5/§15.7/§15.8 rows mentioning OPS (`CBA-A15` + `.1`–`.5`, `CBA-A17` + `.3`/`.4`/`.7`, `CBA-A18.7`, `CBA-S03` + `.1`–`.3`, the §15.7 OPSV method legend, §15.8 mentions — 17 hits) | **FROZEN** — historical working-copy population; non-authorizing per §15.9.1 rule 4 |
| §15.9 intro; §15.9.2 Notes/limitations row; §15.9.3 completeness duty; §15.9.5 taxonomy and rules; §15.9.6 policy/pairings/matrix; §15.9.7 OPSV/STATIC rules; U8/U9/U10; §15.9.10 superseded table | **CONSISTENT** (several strengthened this unit) |
| §16 scenarios 46/54 ("OPS regression") | **FROZEN** — pinned historical scenarios |
| §17 audit-record Authority field (OPS as a citable class) | **CONSISTENT** — OPS remains a valid class when properly grounded |
| §17 Pass 1 | **EDITED** |
| §17 release-gate item 8 ("never 'promote' … to CBA-verified") | **CONSISTENT** |
| §19.1 OPS row | **EDITED** |
| §19.3 legacy OPS row + continuity note | **FROZEN-legacy** row; note **EDITED** to state it establishes nothing |
| Plan global rule 4, R2.1/R2.2/R2.3 unit descriptions, R2.4 unit | **CONSISTENT**/**HISTORY** |

### 9.11 Residual mechanical proof

After the sweep, these patterns return zero matches in the canon:
`secondary expert`; `Secondary operational reporting may establish`;
`Authority status: OPS`; `for the **OPS** items`;
`are **OPS** rules reported`. The only remaining `restore contiguity`
occurrences are the §15.9.2 prohibition itself and its invalid worked
example. Grep is corroboration only; the dispositions above are the
semantic review of record.

## 10. Corrected AMEND numbering contract and worked examples

**The contradiction (Codex counterexample, binding input):** with
active children `.1/.2/.3`, removing `.2` had no legal outcome — keeping
`.3` created a prohibited gap (old U13/§15.9.2 contiguity), renaming
`.3` to `.2` reused an allocated ID (prohibited), and a placeholder row
was a prohibited tombstone (§15.9.10).

**The correction (canon §15.9.2 child-ID numbering contract; U13, G15,
and the R9 duties conformed):**

1. Child IDs are contiguous `.1…n` only at initial GROUP construction.
2. The renumbering rule is removed: no `AMEND` event ever renumbers
   surviving children to restore contiguity (the former "renumbers only
   within the affected GROUP to restore contiguity" sentence is
   deleted).
3. A post-AMEND numeric gap is valid only when every missing allocated
   ID resolves through the immutable receipts and an `AMEND` chain to
   an explicit removal or one or more current successor records.
4. Unexplained or never-allocated interior gaps remain invalid.
5. Removed or superseded IDs are never reused.
6. New children allocate monotonically above the highest child ID ever
   allocated in the GROUP — never into a historical gap.
7. Live tables carry only current records; no tombstone, RETIRED, or
   ALIAS row (the rejected R2 retirement model is **not** recreated);
   earlier receipts preserve prior versions and the `AMEND` chain
   provides forward resolution.

**Binding worked examples (canon §15.9.2; IDs illustrative — `X` is not
a mintable family letter):**

- `.1/.2/.3`, remove `.2` via `AMEND` removal → live `.1/.3` — **valid**
  (the gap resolves to an explicit removal).
- `.1/.2/.3`, split `.2` into newly minted `.4/.5` → live `.1/.3/.4/.5`
  — **valid** (`.2` resolves to its current successors).
- A later new child receives `.6` (above high-water mark 5), never `.2`
  — **valid**.
- Live `.1/.3` with no `AMEND` chain for `.2` — **invalid** (unexplained
  gap).
- Renaming old `.3` to `.2` — **invalid** (renumbering prohibited; ID
  reuse prohibited).

## 11. Terminology corrections

- §1.2 Stable ID row: verdict-exclusion list now reads
  "source/provenance records" in place of "source artifacts".
- §17 audit-record preamble: the same list corrected identically.
- Semantic sweep of the remaining `source artifact(s)` occurrences on
  binding surfaces: the header "What v2.0 changes" sentence for R2.2
  ("zero/one/many source artifacts") and the R2.1 amendment-log row
  ("`SRC2-…` source artifacts") are **HISTORY** — accurate descriptions
  of those editions as executed, retained by design (historical receipts
  and log rows are never rewritten); the R2.4 log row quotes the
  outdated phrase only to record this correction. The binding
  present-tense contract language uses source/provenance records
  throughout (§15.9.1, §15.9.6, §1.2, §17).

## 12. Passing-area preservation results

| Preserved area | Method | Result |
|---|---|---|
| Canon §5.9 (R1.2's extension-bonus source law) | Section bytes from the `### 5.9` heading to the `## 6.` heading hashed before and after R2.4 | SHA-256 `53c968ade8cdb2177517412ac09f2bae63ee7642cfa3b24299d2b208895fb373` both sides — **byte-identical to the R2.3 checkpoint** (the same hash the R2.3 receipt recorded) |
| Historical register rows §15.1–§15.8 | Bytes from `### 15.1` to `### 15.9` hashed both sides | SHA-256 `7b3f6aaba81129dceaa8e55f6356f8bbecd3af7e1ff59b127a443fc5d7b14d97` both sides — unchanged (matches the R2.3 receipt) |
| Historical scenarios 1–89 (§16) | Bytes from `## 16.` to `## 17.` hashed both sides | SHA-256 `eb11bb122840f881204be4d3de9b8a47a680a19622677e4287227730615b311f` both sides — unchanged (matches the R2.3 receipt) |
| Sixteen-check SC2/SXW2 block | Enumerated checks counted mechanically in the SC2 contract block | **16** before and after; block text untouched |
| G10 reruns complete SC2 | G10 row inspected | Intact — "including the **complete SC2 SXW2 integrity contract** (all sixteen checks), never coverage alone" |
| R9 reruns complete SC2 | R9 paragraph inspected | Intact — "re-run the complete SC2 SXW2 integrity contract (§15.9.9) — never coverage alone" |
| Three register populations | §15.9.1 population block inspected | Unchanged; the published `9814939c` register (SHA-256 `4a0760c8…`) remains the **sole XW2 historical source**; boundary rule 4 was added after the population block without altering it |
| No active record or §15.10–§15.12 | Mechanical greps (§14) | Zero concrete records; no §15.10/§15.11/§15.12 section exists |

## 13. Targeted adversarial checks (standards-validation examples)

All IDs illustrative; no record minted. Each check names the canon
block that decides it.

| # | Check | Deciding contract | Outcome |
|---|---|---|---|
| 1 | Artifactless OPS record with named first-party identity, authority/role, practice scope, effective window, authentication method, **authentication timestamp**, limitations, configurability, `—` URL, `—` hash, `—` artifact identity | §15.9.6 base+`ops-provenance` detail schemas; per-type `—` matrix (URL/hash `—` permitted when none exists) | **Parses/valid** |
| 2 | The same record with Authentication timestamp `—` | Per-type matrix row "Authentication timestamp: **Required**" for `ops-provenance`; timestamp rules ("required for … every other non-public verification"); field-level validation | **Fails** |
| 3 | `ext-contract` record missing Runtime input schema | `ext-contract` detail schema (field required, no `or —`); field-level validation | **Fails** |
| 4 | DERIVED component whose closure roots only in `ops-provenance` | Compatibility matrix DERIVED row; transitive rule 4 | **Fails** (laundering) |
| 5 | INFERRED component whose closure roots only in `ext-contract` | Matrix INFERRED row; transitive rule 5 | **Fails** — an EXT determination cannot become inferred law |
| 6 | DERIVED chain rooted in the signed CBA (`official-immutable`) plus an official release (`official-mutable`) via an NBA dependency | Matrix DERIVED row (permitted deps CBA/BYL/NBA/DERIVED; official roots) | **May pass** |
| 7 | LEAF consuming a separate OPS component | Transitive rule 8: OPS visible in Authority, `EV2` component present, limitations/configurability propagated | **May pass** only in that visible form |
| 8 | Registering/enforcing a secondary-only operational candidate (e.g., the touch test) | §15.9.5 rule 4 (unsupported claim, may not be registered); §15.9.6 strict policy + candidate definition (never qualifying provenance, so no `ops-provenance` record can exist); §12.2/§13.3 binding candidate text (cannot drive or enforce a verdict); U8 (an OPS component without an `ops-provenance` record fails) | **Cannot be registered or enforced** |
| 9 | Initial construction `.1/.2/.3` | Numbering contract rule 1; U13 initial-construction clause | **Passes** |
| 10 | Post-AMEND live `.1/.3` with `.2`'s complete removal/successor `AMEND` chain | Numbering rules 3/7; U13 post-AMEND clause; G15 | **Passes** |
| 11 | The same `.1/.3` gap with no `AMEND` chain | Numbering rule 4; U13; G15 | **Fails** |
| 12 | A new child minted as `.2` (reusing the gap) instead of `.6` | Numbering rules 5–6 (never reuse; allocate above the high-water mark); U13 | **Fails** |

## 14. Mechanical validation outputs

Run at the R2.4 working state on baseline `c2228607…`:

- **Files changed:** `git diff --name-only` =
  `docs/reference/cba/ARCHITECT_CBA_CANON.md`,
  `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md`;
  untracked additions = this receipt only. Exactly the three authorized
  files.
- **`git diff --check`:** clean (exit 0; no whitespace errors).
- **Section preservation:** the three hashes in §12 above computed at
  the baseline and at the R2.4 working state — identical on both sides.
- **SC2 block:** exactly 16 enumerated checks counted mechanically
  before and after.
- **No concrete v2 record:** zero register-style rows matching
  `XW2-/SXW2-/SRC2-/EV2-/DR2-<digits>` or `CBA2-…` table rows exist in
  the canon or plan; no §15.10/§15.11/§15.12 section exists; the
  namespaces remain defined-only. The illustrative IDs in §8/§13 of
  this receipt and in the canon's §15.9.2 worked examples
  (`CBA2-X01…`, with `X` outside the `{A,C,R,L,S}` family alphabet) are
  placeholders in prose, not register records.
- **No prior receipt changed:** the diff contains no
  `ARCHITECT_CBA_CANON_V2_R1*`/`R2_REGISTER`/`R2_1`/`R2_2`/`R2_3`
  receipt.
- **Residual-promotion sweeps:** the §9.11 patterns each return zero
  matches on the canon (grep exit 1 per pattern).
- `npm run lint:md`: **exit 1** — pre-existing findings only. The canon
  carries exactly **74** findings before and after R2.4, all
  `MD029/ol-prefix` in the accepted §16 continuous-numbering class; the
  normalized before/after markdownlint comparison (rule + detail,
  line-number-independent) is **identical** (74 = 74, zero new findings
  in the canon). `markdownlint` on the repair plan: clean (exit 0).
  `markdownlint` on this receipt: clean (exit 0; recorded after final
  write). The global exit code is reported truthfully as a failure
  caused by pre-existing findings in other files and the accepted §16
  class — not claimed as a pass.
- `npm run docs:guardrails`: **pass** (exit 0).
- **`main` unchanged:** `69f8f6b6…` before and after; no commit touched
  it.
- No app tests run (documentation/standards change per repair-plan
  global rule 6).

## 15. Boundaries and blocked status

R2.4 closed the four ordered foundation blockers and the minimal
amendment/status surfaces recording them. It made **standards,
source-policy, and status corrections only**:

- No concrete CBA2/XW2/SXW2/SRC2/EV2/DR2 record was created; the
  registries were not populated; no §15.10–§15.12 section was created.
- No historical register row, scenario, ID, or source value was edited;
  canon §5.9 is byte-identical to the R2.3 checkpoint.
- No earlier receipt was edited.
- The passing areas (R1.2 source law; the sixteen-check SC2/SXW2 gate;
  the historical-register population distinction; scope/preservation)
  were not reopened or redesigned.
- No application, code-map, README, test, schema, fixture,
  configuration, data, Phase 2, W1.1, R3+, or Linear work was
  performed.
- `main` unchanged (`69f8f6b6…` before and after); the accepted clean-v2
  architecture was not redesigned.

**R2.4 is complete but not independently accepted. R3 remains blocked
pending another independent Codex foundation review.**
