# Architect CBA Canon v2.0 — R2.3 Receipt: Foundation Contract Corrections

## 1. Provenance and baseline

| Field | Value |
|---|---|
| Repair unit | R2.3 — the five foundation-contract corrections ordered by the independent Codex foundation review of R1.1/R2.1/R2.2 (REJECT/BLOCK-R3 at `6aa616fd`), executed as its own bounded unit after R1.2 |
| Branch | `architect/cba-canon-v2` |
| Baseline commit | **`07d5aa58a4ed355667293b999fb66eb48eb7c0b0`** — the full R1.2 checkpoint SHA, verified as HEAD = `origin/architect/cba-canon-v2` at session start (short form `07d5aa58`); parent = `6aa616fd646c620183c8458919a69bc30044cff5` (R2.2); R2.1 = `05c1b28e…`; R1.1 = `1532c928…`; R2 = `056b9d02…`; R1 = `af931e90…` |
| `main` | `main` = `origin/main` = `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288` — untouched by this unit |
| Clean-state verification | Worktree, index, and untracked state completely clean at session start; ahead/behind vs upstream 0/0 |
| Ordering review | The independent Codex foundation review at `6aa616fd` returned **REJECT/BLOCK-R3** and ordered R1.2 (executed at `07d5aa58…`) and R2.3 (this unit) as separate bounded checkpoints, followed by another independent Codex foundation review before R3 |
| Scope | Standards and status/annotation corrections only. No concrete v2 record; no register row, scenario, ID, or source value changed; R3–R9, Phase 2, and W1.1 not started |
| Edition status after R2.3 | Canon v2.0 **working draft** — not accepted, not active; **R2.3 is not independently accepted**; v2.0 checksum deliberately **not** computed (R8) |

## 2. Files changed — exactly three

1. `docs/reference/cba/ARCHITECT_CBA_CANON.md` — the §15 status note,
   §15.9.1–§15.9.6 and §15.9.8–§15.9.9 standards surfaces, the §1.1 and
   header OPS wording, the §19.1 OPS row, the header "What v2.0 changes"
   paragraph, and one new amendment-log row.
2. `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md` —
   status reconciliation (R1.2 executed at the full verified SHA; the new
   R2.3 unit section with the five blockers and correction contracts),
   the global-rule-4 secondary-source clarification, and the R7/R8/R9
   gate-description updates matching the corrected canon gates.
3. `work/architect-completion/ARCHITECT_CBA_CANON_V2_R2_3_FOUNDATION_CONTRACT_CORRECTIONS.md`
   — this receipt (new).

Nothing else. The R1, R1.1, R1.2, R2, R2.1, and R2.2 receipts are
untouched immutable review history. No application, README, code-map,
test, schema, fixture, configuration, or data file changed; Linear was
not read or written.

## 3. The five formal Codex findings repaired

| # | Finding | Correction contract |
|---|---|---|
| 1 | The standard permitted artifactless OPS/EXT evidence while also requiring every evidence chain to end in an artifact, and its universal certification sentence required a passage read during authoring for every EV row — dishonest for arithmetic, inference, OPS provenance, and EXT runtime contracts | One internally consistent evidence-root contract: typed `SRC2-…` termination for every path, no source-free terminal component, OPS ⇒ `ops-provenance` and EXT ⇒ `ext-contract` records, `SRC2-…` redefined as a source/provenance-record registry, class-specific certification, U8/U9/G14/R9 enforcement (§4–§5 below) |
| 2 | The repair plan prohibited secondary sources as proof while canon §15.9.6 permitted secondary operational reporting to establish OPS | The stricter plan policy applied everywhere: secondary sources are discovery/corroboration aids only; qualifying OPS provenance defined narrowly and concretely (§6 below) |
| 3 | SC2 checked only historical-scenario coverage, so malformed scenario-crosswalk records could pass | SC2 expanded to the complete sixteen-check SXW2 integrity contract, rerun in full by G10 and R9 (§7 below) |
| 4 | AMEND covered only defective active rows; XW2 and SRC2 were described as append-only with no unambiguous repair path for defective support/scenario records | Draft mutability and `AMEND` lineage extended to every live v2 population, with append-only precisely defined and G15/R9 expanded (§8 below) |
| 5 | A binding note falsely stated the branch's legacy-numbered register rows were preserved unchanged | Three register populations stated distinctly, mirroring the scenario-population model; only surrounding population/status wording corrected (§9 below) |

## 4. Evidence-root contract — before/after

| Aspect | Before (R2.2 edition) | After (R2.3) |
|---|---|---|
| Chain roots | "dependency chains contain no cycles and bottom out in source artifacts" — while OPS/EXT rows were simultaneously permitted to carry `—` in the source field, an internal contradiction | Every `EV2-…` evidence chain terminates in **at least one typed `SRC2-…` source/provenance record**; following any component's references recursively always reaches one or more `SRC2-…` records |
| Terminal rows | An OPS/EXT `EV2-…` row could be terminal with `—` in the source field (evidence carried in a prose column) | **No `EV2-…` row may have both reference fields empty**; a source-free terminal component is invalid and may not be registered |
| DERIVED/INFERRED | Dependencies allowed; root requirement contradictory | May rely on dependency `EV2-…` components without directly listing a source, but **every path through those dependencies must terminate in one or more `SRC2-…` records** |
| OPS references | "reference an `ops-provenance` artifact where one exists; `Source artifact IDs` may be `—` only when the provenance record itself … carries the evidence" | Must reference **≥1 `SRC2-…` record of type `ops-provenance`**; the record's Official URL may be `—` when no public URL exists; SHA-256 may be `—` **only** when no durable artifact exists; named provenance, effective date, verification method, limitations, and configurability always required; absence of a public artifact never eliminates the record |
| EXT references | "may use `—` when the LEAF defines the decision boundary" | Must reference **≥1 `SRC2-…` record of type `ext-contract`**; Official URL and SHA-256 may be `—`; the record defines the external determination class, runtime input shape, required provenance, scope, and effective/expiration behavior; no case-specific ruling need exist during canon construction |
| SRC2 terminology | "Shared source-artifact registry"; schema field `Artifact ID` | "Shared source/provenance-record registry"; schema field `Record ID`; §15.9.1 row updated — `SRC2-…` is unambiguously a source/provenance-record registry, not only a file-artifact registry |
| EV2 schema field | `Source artifact IDs or —` | `Source/provenance record IDs or —` (same pinned grammar) |
| Pairings | None | Binding provenance-type ⇔ authority-class pairing table (CBA/BYL ⇒ `official-immutable`; NBA ⇒ official types; DERIVED/INFERRED ⇒ official types directly, chains via dependencies; OPS ⇒ ≥1 `ops-provenance`; EXT ⇒ ≥1 `ext-contract`) |
| Certification | Universal: "the certifying agent read the cited passage in the identified artifact" for every row | Class-specific certification (§5 below) |
| Gates | U8/U9 partial; G14 resolution + bidirectional classes; R9 evidence rerun | U8/U9/G14 and the R9 duties explicitly enforce: typed `SRC2` termination for every evidence path; no source-free terminal EV component; class-specific certification; valid provenance-type ⇔ authority-class pairings; acyclic EV dependencies; exact Authority ⇔ EV reconciliation in both directions; zero dangling or orphan records |

## 5. Class-specific certification table (now binding in canon §15.9.6)

| Class | Certification duty |
|---|---|
| CBA, BYL | Read the controlling passage in the identified official artifact |
| NBA | Verify the official publication and the exact value/date relied upon |
| DERIVED | Verify the formula, every resolved input, the units, and the rounding |
| INFERRED | Read every controlling passage and verify the complete stated reasoning chain |
| OPS | Verify the qualifying operational provenance record and its required fields; never invent or imply a public passage |
| EXT | Verify the source/rule or contract defining the external boundary and the required runtime provenance; never invent a case ruling |

The canon adds expressly: no class is certified by inventing a passage
that does not exist — arithmetic, inference, operational provenance, and
external runtime contracts are certified by verifying what actually
grounds them.

## 6. Strict secondary-source / OPS provenance rule

Now binding in canon §15.9.6 (with §1.1, the header use rule, §15.9.5,
and §19.1 conformed, and the repair plan's global rule 4 extended):

- **Secondary sources are discovery and corroboration aids only.**
  Secondary reporting can never establish CBA, BYL, NBA, DERIVED,
  INFERRED, OPS, or EXT authority, and can never serve as the qualifying
  provenance of an `ops-provenance` record.
- **Qualifying OPS provenance (narrow, concrete):** an authenticated
  league or club operational artifact; a directly authenticated league
  or club communication; a league system record, transaction ruling, or
  comparable first-party operational record; or a direct attestation
  whose identity, authority, effective date, verification method,
  limitations, and configurability are recorded.
- **Never sufficient:** a media report, expert summary, CBAguide entry,
  RealGM page, Spotrac page, prior audit, test, or existing
  implementation.
- An OPS obligation whose only support is secondary reporting is an
  unsupported claim and may not be registered.

The former §15.9.6 sentence "Secondary operational reporting may
establish `ops-provenance` only for OPS authority" is removed. The §19.1
OPS row no longer names "secondary operational reporting" as the
principal location of OPS authority; it now requires qualifying
first-party operational provenance with secondary reporting as
discovery/corroboration only. No concrete rule was relabeled — no active
records exist yet.

## 7. Complete SC2 / SXW2 validation contract

SC2 (canon §15.9.9) is now the complete SXW2 integrity contract —
sixteen explicit checks; historical-scenario coverage is one check among
sixteen, never the whole gate. SC1–SC7 numbering is unchanged.

1. `SXW2-<NNNN>` ID grammar.
2. Edge-ID uniqueness.
3. Edge types drawn only from the allowed vocabulary (`equivalent`,
   `split`, `merge`, `partial-overlap`, `moved`, `invalid`,
   `no-successor`).
4. Historical sources restricted to scenarios 1–89 in the pinned
   published v1.1 scenario population at commit `9814939c`.
5. Complete coverage — every published historical scenario 1–89 has at
   least one `SXW2` edge.
6. No source outside the pinned 1–89 population.
7. Every non-terminal edge targets an existing active `CBA2-SC-…`
   scenario.
8. `invalid` and `no-successor` are the only terminal SXW2 types, each
   with target `—`.
9. No non-terminal edge has target `—`.
10. No terminal edge has a live target.
11. Every decision-record reference resolves.
12. Exactly one primary relationship type per historical-source/
    active-target pair.
13. No duplicate source–target pair under another type.
14. Every edge typed by the deterministic relationship precedence of
    §15.9.3, applied analogously per §15.9.8.
15. Every `no-successor` edge satisfies the narrow §15.9.3 rule,
    including the exact scope/edition basis, and is never used for
    unresolved, uncertified, deferred, unsupported, or inconvenient
    coverage.
16. Scope/relationship content parseable and exact enough to identify
    which part of the historical scenario the edge covers and how.

G10 now reruns SC1–SC7 **including the complete SC2 contract, never
coverage alone**; the R9 duties (canon §15.9.9 and the plan's R9 unit)
explicitly include re-running the complete SC2 SXW2 integrity contract.
§15.9.8 cross-references the contract. No SXW2 edge or active scenario
was created.

## 8. All-population AMEND coverage

### 8.1 Population matrix (now binding in canon §15.9.2/§15.9.4)

| Live v2 population | Draft-mutable via `AMEND`? | Same-ID content correction | Identity change / split / merge / replacement / removal |
|---|---|---|---|
| Active GROUP and LEAF records (`CBA2-…`) | Yes | Same ID + `AMEND` (prior checkpoint/version → corrected version) | Mint current ID(s) or record removal; renumber only within the affected GROUP for contiguity |
| Historical crosswalk edges (`XW2-…`) | Yes | Same ID + `AMEND` | Mint new edge ID; superseded edge leaves the live table; duplicate-pair ban re-verified |
| Source/provenance records (`SRC2-…`) | Yes | Same ID + `AMEND` | Mint new record ID; update every referencing `EV2-…` row in the same commit |
| Evidence components (`EV2-…`) | Yes | Same ID + `AMEND` | Mint new component ID(s); update the owning LEAF's Evidence components field |
| Active scenarios and named cases (`CBA2-SC-…`) | Yes | Same ID + `AMEND` | Mint new scenario/case ID(s) or record removal; re-reconcile `Exercises:` ⇔ Scenario-evidence and re-run SC6 |
| Scenario-crosswalk edges (`SXW2-…`) | Yes | Same ID + `AMEND` | Mint new edge ID; duplicate-pair ban re-verified |
| Decision records (`DR2-…`, including `AMEND` records) | Yes — a defective `DR2`/`AMEND` record is corrected by a **later** `AMEND` record | n/a (a decision record is superseded, not edited — earlier receipts are immutable) | Later `AMEND` supersedes; the chain terminates in exactly one current disposition |

**Append-only, precisely defined (all seven namespaces):** new ID
allocation is monotonically increasing; an allocated ID is never reused
for another identity; a superseded or removed ID is never reassigned;
append-only does **not** mean an erroneous draft record must remain live
forever; earlier checkpoint receipts remain immutable and preserve the
previous version; the current live tables contain only current records.

**Every correction:** updates every affected live reference in the same
commit; creates no duplicate and no orphan; carries an `AMEND` record
identifying the record population/type, prior checkpoint, prior DR IDs
where applicable, old ID/version, current ID/version or removal
disposition, reason, updated references, and the superseding
disposition. No RETIRED/ALIAS role, tombstone row, or same-namespace
migration model may reappear in live registers. G15 and the R9 duties
now verify amendment-chain integrity across **every** population: zero
stale live references; no correction-created duplicates or orphans;
every receipt-era ID/version resolvable forward; every supersession
chain terminating in exactly one current disposition or explicit
removal.

### 8.2 Worked correction examples (standard-defining; all IDs illustrative — no register contains them, and none was minted)

**(a) Correcting an XW2 edge without leaving a duplicate pair.**
Suppose an R3 receipt registered `XW2-0107`: `CBA-A19.3 → CBA2-A05.2`,
type `split`, and R5 later determines the fragment is wholly owned by
`CBA2-C09.4`. The source–target pair changes, so this is an identity
change: R5 mints `XW2-0233` (`CBA-A19.3 → CBA2-C09.4`, `split`, with the
fragment named in Scope/relationship), removes `XW2-0107` from the live
crosswalk table (no tombstone), deletes `XW2-0107` from `CBA2-A05.2`'s
Origin field and adds `XW2-0233` to `CBA2-C09.4`'s Origin field — all in
the same commit — and records an `AMEND` (population XW2; prior
checkpoint = the R3 commit; prior DRs = the R3 `OWN`/`ATOM` records; old
ID `XW2-0107`; current ID `XW2-0233`; reason; updated references;
superseding disposition). After the correction exactly one primary
relationship type exists for the pair `CBA-A19.3`/`CBA2-C09.4`, no live
edge references `CBA2-A05.2` for this fragment, and `XW2-0107` is never
reassigned.

**(b) Replacing a defective SRC2 provenance record.** Suppose
`SRC2-014` (`ops-provenance`) was registered without its required
effective date. The provenance identity (the same operational record) is
unchanged, so the correcting unit keeps `SRC2-014` and records an
`AMEND` naming the prior checkpoint/version and the corrected current
version now carrying the effective date. If instead the row had cited
the wrong provenance entirely (a different communication), that is an
identity change: mint `SRC2-041` with the correct qualifying first-party
provenance, update every `EV2-…` row that referenced `SRC2-014` in the
same commit, remove `SRC2-014` from the live table, and never reassign
its ID.

**(c) Correcting an EV2 dependency chain.** Suppose `EV2-0412`
(DERIVED) lists dependency `EV2-0398`, but one formula input actually
resolves to `EV2-0371`. The component's identity (same LEAF, same
authority class, same obligation component) is preserved, so the unit
keeps `EV2-0412`, corrects the dependency list, records the `AMEND`
(population EV2; old version; corrected version), and re-runs the
U9/G14 checks: the corrected chain is acyclic and terminates in typed
`SRC2-…` records. Had the correction changed the component's class or
split it into two components, new `EV2-…` IDs would be minted and the
owning LEAF's Evidence components field updated in the same commit.

**(d) Correcting or replacing an active scenario/SXW2 mapping.**
Suppose active scenario `CBA2-SC-021`, named case `(b)`, claims to
exercise `CBA2-C03.2` but its facts do not (an SC4/SC5 defect found
after R7's checkpoint). If case (b) is repairable, the unit rewrites its
facts under the same identity with an `AMEND` (population CBA2-SC; prior
checkpoint/version → corrected version) and re-runs SC3/SC4/SC6. If not,
it removes case (b) with a removal disposition, updating the register's
Scenario-evidence entries and the scenario's `Exercises:` list in the
same commit. If historical scenario 42's edge `SXW2-0042`
(`42 → CBA2-SC-021`, `equivalent`) should have been `partial-overlap` to
`CBA2-SC-030`, the pair changes: mint `SXW2-0055`
(`42 → CBA2-SC-030`, `partial-overlap`, scope stated), remove
`SXW2-0042` from the live table via `AMEND`, and re-verify the
duplicate-pair ban and coverage for scenario 42.

**(e) Superseding an erroneous DR2/AMEND record.** Suppose `DR2-0288`
(itself an `AMEND`) recorded the wrong prior-checkpoint commit. The
earlier receipt containing `DR2-0288` is immutable and is not rewritten.
The correcting unit records `DR2-0301` (`AMEND`; subject `DR2-0288`;
population DR2; the correct prior checkpoint; the superseding
disposition) in its own receipt and updates any live register cell that
cited `DR2-0288` to cite `DR2-0301` in the same commit. A reader
resolving `DR2-0288` from the earlier receipt follows the chain forward
to `DR2-0301`; the chain terminates in exactly one current disposition.

## 9. Three-population historical-register distinction

Now binding in canon §15.9.1 (mirroring the §15.9.8 scenario
populations), with the §15 status note corrected:

1. **Published v1.1 historical meanings** — exactly the register at
   commit `9814939c`, file SHA-256
   `4a0760c81d7a5e95919a0373d5ff631b565d064d56b858fe3b8869ad2b6bb3f6`;
   the sole historical source of every `XW2-…` edge; meanings
   permanently fixed; never active or verdict-bearing.
2. **The current branch's legacy-numbered working copy** (§15.1–§15.8 of
   the canon file) — contains the R1/R1.1 source-law corrections and the
   authorized R2.1 A11/A18.7 annotations and is therefore **not
   byte-identical** to the published edition; an authoring input for
   constructing active v2 obligations only; never the historical XW2
   source; never active or verdict-bearing; redefines no published
   historical ID.
3. **The active v2 registry** (`CBA2-…`, built new during R3–R6) — the
   only active, verdict-bearing population after R9 acceptance.

The R2.2 status note above §15.1 — which falsely said the rows were
"preserved unchanged" — now states the population-2 status accurately.
The §15.9.1 register-table row and boundary rule 1 name the R2.1
A11/A18.7 annotations explicitly, and the §15.9.3 crosswalk schema pins
the historical-LEAF column to the published population, never the
working copy. **No legacy-numbered row was edited**: A11, A18.7, and
every other §15.1–§15.8 row are byte-identical to the R1.2 checkpoint
(§11 below).

## 10. Binding-surface terminology sweep results

Sweep target: the canon's binding surfaces (outside the frozen
historical sections) and the repair plan. Earlier receipts are immutable
history and retain their original wording by design.

| Sweep | Result |
|---|---|
| Statements permitting a source-free terminal OPS/EXT EV row (`—` "only when the provenance record itself … carries the evidence"; EXT "may use `—` when the LEAF defines the decision boundary") | **Zero** — replaced by the typed-record requirements |
| Statements requiring an OPS/EXT record to invent a public passage (the universal "read the cited passage in the identified artifact" rule) | **Zero** — replaced by class-specific certification |
| Statements allowing secondary reporting to establish OPS ("Secondary operational reporting may establish…"; §19.1 "Secondary operational reporting" as principal OPS location) | **Zero** — strict policy everywhere; §1.1, header use rule, §15.9.5, §15.9.6, §19.1, and plan global rule 4 conformed |
| Statements restricting AMEND to active LEAF rows ("correct a defective active row"; "Draft correction of earlier-registered active records") | **Zero** — all-population wording |
| Statements treating append-only as "an erroneous draft record can never be corrected" (bare "unique, append-only" without the §15.9.2 definition) | **Zero** — every append-only mention now carries or references the precise definition |
| Statements describing the current corrected legacy-numbered rows as byte-identical to published v1.1 ("preserved unchanged as migration inputs") | **Zero** — three-population wording |
| SC2 contains every required SXW2 integrity check | **Confirmed** — 16 enumerated checks counted mechanically in the SC2 contract block |

Remaining "secondary" mentions in the canon were reviewed individually:
all are the conflict-order ranking, discovery/corroboration-aid
descriptions, `Secondary methods` field names, or frozen historical
§15.8 rows — none permits secondary reporting to establish any
authority class.

## 11. Mechanical validation outputs

Run at the R2.3 working state on baseline `07d5aa58…`:

- **Files changed:** `git diff --name-only` =
  `docs/reference/cba/ARCHITECT_CBA_CANON.md`,
  `work/architect-completion/ARCHITECT_CBA_CANON_V2_REPAIR_PLAN.md`;
  untracked additions = this receipt only. Exactly the three authorized
  files.
- **R1.2's §5.9 correction unchanged:** the §5.9 section (from the
  `### 5.9` heading to the `## 6.` heading) hashes identically at the
  R1.2 checkpoint and after R2.3 — SHA-256
  `53c968ade8cdb2177517412ac09f2bae63ee7642cfa3b24299d2b208895fb373`
  both sides.
- **Historical register rows unchanged:** §15.1–§15.8 (from the
  `### 15.1` heading to the `### 15.9` heading) hash identically at the
  R1.2 checkpoint and after R2.3 — SHA-256
  `7b3f6aaba81129dceaa8e55f6356f8bbecd3af7e1ff59b127a443fc5d7b14d97`
  both sides. A11 and A18.7 were not edited.
- **Scenarios 1–89 unchanged:** §16 (from the `## 16.` heading to the
  `## 17.` heading) hashes identically at the R1.2 checkpoint and after
  R2.3 — SHA-256
  `eb11bb122840f881204be4d3de9b8a47a680a19622677e4287227730615b311f`
  both sides.
- **No concrete v2 record:** zero register-style rows matching
  `XW2-/SXW2-/SRC2-/EV2-/DR2-<digits>` or `CBA2-…` table rows exist in
  the canon or plan; no §15.10/§15.11/§15.12 section exists; the
  namespaces remain defined-only. The illustrative IDs in §8.2 of this
  receipt are placeholders in prose, not register records.
- **No prior receipt changed:** the diff contains no
  `ARCHITECT_CBA_CANON_V2_R1*`/`R2_REGISTER`/`R2_1`/`R2_2` receipt.
- **Contradiction sweeps:** the seven sweeps in §10 each returned zero
  matches on the canon and plan (grep exit 1), and the SC2 block counts
  exactly 16 enumerated checks.
- `git diff --check`: clean (exit 0; no whitespace errors).
- `npm run lint:md`: **exit 1** — pre-existing findings only. The canon
  carries exactly 74 findings before and after R2.3, all
  `MD029/ol-prefix` in the accepted §16 continuous-numbering class; a
  normalized before/after markdownlint comparison (rule + detail,
  line-number-independent) is **identical** (74 = 74, zero new
  findings). `markdownlint` on the repair plan: clean (exit 0).
  `markdownlint` on this receipt: clean (exit 0; recorded after final
  write). The global exit code is reported truthfully as a failure
  caused by pre-existing findings in other files and the accepted §16
  class — not claimed as a pass.
- `npm run docs:guardrails`: **pass** ("Workspace guardrails passed.",
  exit 0).
- No app tests run (documentation/standards change per repair-plan
  global rule 6).

## 12. Boundaries and blocked status

R2.3 corrected the five ordered foundation contracts and the minimal
amendment/status surfaces recording them. It made **standards and
status/annotation corrections only**:

- No concrete CBA2/XW2/SXW2/SRC2/EV2/DR2 record was created; the
  registries were not populated.
- No historical register row, scenario, ID, or source value was edited;
  no concrete rule was relabeled (no active records exist yet).
- No earlier receipt was edited.
- No application, code-map, README, test, schema, fixture,
  configuration, data, or Linear work was performed.
- R3–R9, Phase 2, and W1.1 were not started; no R3 record was inspected
  or constructed.
- `main` unchanged (`69f8f6b6…` before and after); the accepted clean-v2
  architecture was not redesigned.

**R2.3 is not independently accepted. R3 remains blocked pending a fresh
independent Codex foundation review of R1.2 and R2.3.**
