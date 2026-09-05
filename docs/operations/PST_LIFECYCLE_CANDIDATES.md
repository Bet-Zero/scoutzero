# Private PST lifecycle candidates

The offline lifecycle tooling in `scripts/source-releases/pst-lifecycle/` reads
only the accepted current PST source release. It produces a private evidence and
lifecycle candidate; no output is a runtime entitlement release or permission to
trade. The current first-round Needs input/no-write boundary remains in force.

## Inputs and recovery

Recover and verify the accepted archive using [PST_SOURCE_RELEASES.md](PST_SOURCE_RELEASES.md).
The parser requires release digest
`44a18a7c339906ab147cc026d0e598d6d7ee655a2427c767fdce1685cd30cb7a`.
The 39 required RAW RESPONSE HTML pages are canonical. Three repeats verify
stability; serialized DOM and screenshots remain secondary evidence.

The comparison pin is
`docs/reference/sources/releases/pst/pst-exposure-comparison-bze306-v1.json`.
It identifies the current retained exposure artifact and all 278 first-round
IDs: 240 ownership, 27 swap rights and 11 conveyance rights. The artifact and
by-team export agreed when pinned. This is a retained comparison universe, not a
new live Firestore snapshot. Its holders, truncated descriptions and synthetic
right splits are not source facts. The exact original artifact is retained as
`comparison-input.json` inside the private derived package for reproduction.

## Generate and verify

Use a new output directory beneath this checkout's ignored `tmp/`. Existing
candidate directories cannot be overwritten. Substitute recovered local paths:

```bash
npx tsx scripts/source-releases/pst-lifecycle/cli.ts build \
  --release docs/reference/sources/releases/pst/pst-current-bze-304-07daf7583c6c9ef5-v1.json \
  --evidence "$PST_EVIDENCE_DIR" \
  --archive "$PST_ARCHIVE_PATH" \
  --legacy "$PST_COMPARISON_PATH" \
  --out tmp/pst-lifecycle-new-candidate

npx tsx scripts/source-releases/pst-lifecycle/cli.ts verify \
  --release docs/reference/sources/releases/pst/pst-current-bze-304-07daf7583c6c9ef5-v1.json \
  --evidence "$PST_EVIDENCE_DIR" \
  --archive "$PST_ARCHIVE_PATH" \
  --legacy "$PST_COMPARISON_PATH" \
  --candidate tmp/pst-lifecycle-new-candidate \
  --reverse-enumeration true
```

Verification independently regenerates every artifact and compares exact bytes
and the complete file inventory. Changing local input paths, page enumeration
order or run time does not change content. The manifest binds the source release,
comparison artifact, parser/schema versions, implementation-file fingerprints,
lockfile and every output hash/size. Implementation changes during generation
fail closed. A later code change requires a new derived candidate and review pin.

## Evidence and model

- `observations.json`: the complete parsed document trees, text nodes,
  attributes, structure, table/row/cell identities, links and source locators.
  Character offsets are JavaScript UTF-16 offsets; byte offsets address the
  immutable UTF-8 raw response. Implicit HTML nodes have null byte locations.
  Original raw bytes remain authoritative for entity spelling and markup.
- `lifecycles.json`: full transaction observations and consideration sides,
  scoped term trees, assignment/right assertions, cross-page evidence,
  alternative-year/replacement/selection references and asset histories.
  The strict Zod contracts live in `src/schemas/pstLifecycle.ts`.
- `register.json`: one row per exposed ID, its mapping evidence, recovered
  fields, primary classification, reported outcomes and exact remaining facts.
- `non-complete.json`: every ID whose lifecycle reconstruction is still partial,
  conflicting or missing. The recovered class is complete source reconstruction
  with demonstrated model loss repaired; it is not positive-path authority.
- `external-facts.json`: per-asset/branch missing facts and evidence needed,
  plus uncaptured predecessor-year references found in the release. Contextual
  predecessor references are not silently inherited as governing obligations.
- `coverage.json`: sanitized coverage, reconciliation and provenance metadata.
- `manifest.json`: artifact inventory, hashes and derived-data digest.

Each source assertion has supporting cells. Source highlights define the target
where present; completed draft rows can bind the received consideration by the
reported draft position. A shared year or bare page-local row number never binds
a target. A first-cell pooled allocation identifies its members without making
its displayed recipient the original team of a new pick.

Protection years and thresholds remain paired. Nested pool guards remain scoped
to their named participant. Explicit fallback alternatives contain all their
replacement assets. Missing replacement identities remain null and produce
source gaps. Alternative-year links do not manufacture transfers or prove that
a branch has activated/extinguished. Future outcome placeholders remain unknown
outcomes, separate from missing governing terms.

Capture time, PST update date, transaction date and effective date are separate.
An absent effective date stays null. Histories use a partial order from explicit
transaction dates. Serialization order, column order, and equal dates do not
create additional chronology. Identical observations support one dated claim;
different narratives at the same asset/date/recipient retain their variants and
unresolved event identity. Such groups are not a count of proven transfers.

The evidence layer is lossless relative to the retained raw bytes and its
locators. The normalized layer is a source-assertion model, not an executable
CBA rules model. Full narratives retain contextual/predecessor considerations
separately from the selected asset's terms. Unresolved implementation bindings
block generation; they cannot be relabeled as missing source facts.

## Five-way accounting

Precedence is **missing → conflicting → source-partial/uncertain → recovered →
source-complete**. Counts come only from the single per-ID register and reconcile
by kind/year. No predecessor or replacement record changes the 278 denominator.

Missing means no defensible source mapping; conflicting means incompatible
assertions about the same branch. Different dated states and mutually exclusive
alternatives are not automatically conflicts. Source-partial means a mapped
asset still lacks required governing history/terms or explicit uncertainty is
unresolved. Snapshot-only rows do not prove complete history. Recovered means
source reconstruction is complete with demonstrated lost fields restored.
Source-complete means complete reconstruction without such a demonstrated loss.

Recovery annotations survive in every class. Official Second Apron lifecycle,
controlling transaction/amendment/election authority and official outcome/order
facts are reported separately from PST source-content completeness. No primary
category makes the product's first-round positive path ready.

## Validation and private retention

```bash
npm run test:node -- tests/architect/pstLifecycle.test.ts tests/architect/pstLifecycleCandidate.test.ts --reporter=dot

PST_LIFECYCLE_EVIDENCE="$PST_EVIDENCE_DIR" npm run test:node -- tests/architect/pstLifecycle.test.ts tests/architect/pstLifecycleCandidate.test.ts --reporter=dot
```

Public CI uses synthetic fixtures. The second command also runs independent
expectations selected from the accepted raw evidence: current LAC and Indiana
2026 history, Philadelphia's predecessor dependency, 2027 nested swap priority,
2029 rank-two selection, and Brooklyn's outbound/return and relinquishment
history. Expectations are not generated from parser snapshots.

Retain the complete source-bearing derived package privately on the active
Linear issue. Record archive name, bytes, SHA-256 and attachment identity; prove
independent download, safe extraction and deterministic regeneration. Pin the
derived digest to the frozen candidate in its PR before independent review.
Never commit or serve the detailed artifacts, bulk source prose, source HTML,
DOM, screenshots or archive bytes. No express PST reuse license was established;
this remains private internal evidence with no broader permission implied.
