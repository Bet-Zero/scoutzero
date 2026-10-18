# Draft evidence refresh and separately approved installation

Start at [NBA maintenance](NBA_MAINTENANCE.md). This is an operating handoff,
not acceptance of new NBA facts, a publisher or activation of first-round Apply.
Keep all 278 historical IDs, 1,483 occurrence links and five predecessor
references. The current independently accepted evidence tally is
331 supported / 389 future-pending / 128 non-applicable / 29 unresolved /
0 conflicting, across 877 dependencies. The 29 questions affect specific
operations; they do not blanket-disable 30 whole entitlements.

## Recovery inventory and authority

Authenticate to Linear and retrieve actual attachment bytes. Check archive size
and digest against its controlling receipt before extracting. Reject absolute,
parent-traversal, duplicate or linked archive members. Keep all files private,
outside served asset paths. A pasted hash without retained bytes is not recovery.

| Package | Private Linear attachment | Controlling identity / purpose |
| --- | --- | --- |
| Accepted PST original capture | BZE-305 `ce382197-6bd4-4f5b-93c5-36ded7ff6d87` | `ace3c381e3d2e39fd108804641be2654d2be0b3ebecf9d784ee186f11ea4b1ac`; 5,348,841 bytes; 39 canonical pages, 3 repeats |
| Original lifecycle candidate and comparison input | BZE-306 `bebc8343-98fb-4f08-9b1a-19937a6ba308` | Original `candidate/comparison-input.json`; authenticate against checked-in comparison pin, not file counts |
| Accepted consolidated factual audit | BZE-309 `50901231-4f9b-4529-830d-88e5ba80a57b` | `d6a4cec0fb3f107c2437b7c41de617ba1e53fc64c61bb79e27b5f6c0d666c2d7`; 148,781 bytes; original reviews, objective repairs and final ACCEPT |
| Accepted whole46 source/judgment family | BZE-309 `8ab5e25b-887b-4952-8049-d03ac1a08069` | `9d3699092922510c6a75a1b5a01ee70c6ae42bd0d63a93a715daca34dba73bda`; 3,008,786 bytes; 28 original source pairs |
| Retained real review projection and replay builder | BZE-321 `524e6b98-ff1c-4d94-ae9e-53bd2c2106b4` | `f705541b452a6bf11cf0e1f742c8220122ccffec77c5a5949a433ed33452fb42`; `foundationText`, `foundationPin`, all-278 records, 29-fact crosswalk and `build_projection.py` |

The factual authority is BZE-309 comment
`435c70c8-4da5-4876-a9f1-7454ca2ce6e8`, including its complete original and
replacement review chain. Projection packaging is not broader factual acceptance.
Older v12/v14/v15 accounting is lineage for its own scope, not today's status.
Additional recovery pointers in the accepted receipts remain authoritative.

The recovered private projection builder has seven named JSON dependencies:
audit delta, generated-2029 archival map, Sixers/Harden retained source, whole46
partition, replacement records, checkpoint blockers and followup delta. Recover
those exact packages through the receipts before rebuilding it. Do not replace
missing inputs with empty objects or reconstruct judgments from counts. The
published projection already retains the foundation text and its pin, so loading
and comparison do not require rerunning historical adjudication.

## Repeatable handoffs

1. **Declare scope and capture.** Select the current team/year pages and
   historical/transaction evidence required by affected dependencies. The old
   accepted package's 39 pages plus repeats are its historical inventory, not a
   permanent future coverage rule. Retain untouched originals, exact URLs,
   capture dates, effective dates, inventory and hashes; prove private readback.
   Use the bounded cloud/local fallback in the maintenance operating card.
   The only proven manual PST import fallback previously covered one Lakers
   page (23 raw rows, 21 within the configured window); full-batch convenience
   is unproved. Never present it as a working automatic 30-page capture.
2. **Verify and extract losslessly.** Use [PST_SOURCE_RELEASES.md](PST_SOURCE_RELEASES.md)
   and [PST_LIFECYCLE_CANDIDATES.md](PST_LIFECYCLE_CANDIDATES.md). Preserve
   protections, swaps, replacement years, priority, elections, participants,
   source locations and missing terms. Lossless observations are not executable
   rights. Historical aliases cannot mint economic assets.
3. **Reconcile evidence/dependencies.** Compare changed raw clauses with the
   accepted predecessor. Carry forward unchanged judgments only with unchanged
   supporting inputs. Reassess affected connected pools and branches. Keep
   supported, future-pending, non-applicable, unresolved and conflicting states
   distinct, with exact source, ID, operation and next missing fact. Future
   outcomes differ from unknown governing terms. Preserve all 29 existing
   dependencies unless qualified independent review changes them.
4. **Review new factual judgments privately.** Supply a compact claim/delta map,
   exact candidate hashes, direct private source locators, affected IDs and
   previous review limitations. The fresh independent reviewer chooses its
   probes. Public code ACCEPT is not private factual acceptance. Preserve the
   original review, repairs and focused re-review; never edit a rejection into
   acceptance. Source qualification and factual sufficiency remain separate.
5. **Package a new immutable proposal.** Use the existing foundation mapper,
   serializer, authenticated loader and comparator described in
   [DRAFT_PICK_FOUNDATION.md](../reference/architect/DRAFT_PICK_FOUNDATION.md).
   The separately retained pin must identify the exact payload, release ID,
   date and review record. Preserve membership and lineage, not just counts.
   Review added future-year records and changed/retired states explicitly.
   An empty mapped-operation list is not proof of no impact.
6. **Approve installation separately.** Only an independently accepted, exactly
   approved release may enter BZE-321's protected installation route. Verify
   preconditions, installed release identity, team associations, records the
   real consumer reads, and error states. Retain the predecessor for recovery.
   Existing worlds and the June 5 baseline do not migrate. Apply stays blocked.
7. **Record and replay.** Retain originals and decisions privately in the
   established Linear records. The PR records implementation/tests and sanitized
   results; do not upload raw source prose or public CI artifacts containing it.
   Record captured, extracted, accepted, installed and demonstrated separately.

## Exact historical replay and successor comparison

After private recovery, these commands exercise the existing accepted envelope:

```bash
mkdir -p tmp
npx tsx scripts/source-releases/verify-pst-source-release.ts \
  --release docs/reference/sources/releases/pst/pst-current-bze-304-07daf7583c6c9ef5-v1.json \
  --evidence "$PST_EVIDENCE_DIR" --archive "$PST_ARCHIVE_PATH"
npx tsx scripts/source-releases/pst-lifecycle/cli.ts build \
  --release docs/reference/sources/releases/pst/pst-current-bze-304-07daf7583c6c9ef5-v1.json \
  --evidence "$PST_EVIDENCE_DIR" --archive "$PST_ARCHIVE_PATH" \
  --legacy "$ORIGINAL_COMPARISON_INPUT" --out tmp/new-private-candidate
npx tsx scripts/source-releases/pst-lifecycle/cli.ts verify \
  --release docs/reference/sources/releases/pst/pst-current-bze-304-07daf7583c6c9ef5-v1.json \
  --evidence "$PST_EVIDENCE_DIR" --archive "$PST_ARCHIVE_PATH" \
  --legacy "$ORIGINAL_COMPARISON_INPUT" --candidate tmp/new-private-candidate \
  --reverse-enumeration true
npm run draft:maintenance:compare -- \
  --baseline="$ACCEPTED_FOUNDATION_TEXT" --baseline-pin="$RETAINED_REVIEW_PIN" \
  --proposal="$SUCCESSOR_FOUNDATION_TEXT" --proposal-pin="$PROPOSAL_REVIEW_PIN" \
  --out="$PRIVATE_IMPACT_REPORT"
```

Do not generate a pin from unknown bytes and call it acceptance. The compare
command authenticates against a supplied independent pin, not the pin's source.
An unreviewed proposal may be compared but cannot become the accepted baseline.
The pure comparator preserves the original cohort, occurrences and predecessors;
it does not install data or authorize trading.

**Versioned successor support:** historical source schema v1 and its 39/3/42
contract remain unchanged. Schema v2 carries an explicit required-page inventory,
repeat inventory, counts, private retention and immutable predecessor pin. The
same verifier checks exact membership, metadata/manifest agreement, all original
bytes and repeats without imposing the old page count. It does not accept facts.
After private source qualification and independent acceptance, add only the exact
accepted metadata digest, predecessor digest and controlling receipt to
`scripts/source-releases/pst-lifecycle/acceptedSources.ts` through the normal
reviewed code change. Never populate that registry from a CLI argument or a
self-computed unknown hash. Lifecycle generation rejects unregistered inputs;
for a registered successor it retains that successor's actual source identity
and the original all-278 comparison cohort. No factual successor is registered
by BZE-324. A genuinely new basketball mechanism still needs bounded model work
rather than flattened clauses. Foundation comparison accepts independently
pinned proposals without changing original lineage or factual-review gates.

October 18 actual replay recovered and hash-verified the original capture,
original comparison input, accepted audit and retained real projection. Lossless
build and reverse-order verification passed for all 278 IDs; the existing
foundation loader/comparator accepted the real retained 278/1,483 payload.
Historical source-partial classifications are not the current 877-dependency
audit accounting, and replay supplied no new factual acceptance.

## BZE-321 live handoff correction

Observed October 18: PR #547 remains draft at
`6667f45218a09df78729d80f4e9a18df79716ae4`. Its five-document review release is
recorded installed, while the separate three-record source correction remains
uninstalled. Private review run `38995013500` **failed**, including the
read-only private-source judgment step; it is not a current owner-approval link.
The browser run `38997025799` is cancelled and the protected source job remains
waiting. No private factual ACCEPT, final hosted GM proof or landing is inferred.

Resume that lane by reconciling its branch with current main, inspecting the
failed exact run, repairing objective defects through its existing protected
boundary, completing required private/public reviews and necessary exact
installation approvals, then proving actual hosted behavior and cleanup.
Do not change pinned executors mid-operation in this maintenance assignment.
Retire consumed transfer materials and unnecessary write privileges only after
installation/hosted success, while preserving reusable cloud test access.
BZE-309 and BZE-321 remain open; completing maintenance cannot close either.
