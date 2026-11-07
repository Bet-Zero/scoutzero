# BZE-345: exact pick-only private review

Status home: [BZE-345](https://linear.app/bzero/issue/BZE-345).
This adapter prepares the required independent review. It grants no source,
financial, world-write, migration or activation authority.

## Review inputs

The existing `june5-draft` mode accepts a new, exclusive v3 connection with
`candidate`, `assessment` and `operation` archive entries. V1 and V2 retain
their original behavior; V2's two-transfer supplement is not the new review.
Each entry uses the existing exact attachment ID, filename, bytes, SHA-256 and
temporary private Linear URL. The connection still requires `recipientPem`.

| Role | Attachment | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Starting candidate | `347f0b68-662b-47b5-ac8f-6a1203c07d62` | 6,654,967 | `4751d71f04b7834bf5d264bd49e3322b16afba4ae0663e1b4d9cbd235c9aea5a` |
| C6 assessment | `28ead6a9-dcec-49fc-b0e9-ec31a390ab3e` | 73,931 | `43a129a009af323d0bd369f4bd173cb9cd00fd5995326651159aaa7b09d12ee9` |
| New review handoff | `c7666be3-64d6-4d87-b4b3-bfb43a2837a5` | 304,111 | `587d485bd845689879ebc9eea684117859605fa8a891577eefb338e736a47c63` |

These are private-review transport identities, never runtime source pins.
The new handoff includes the unchanged prepared candidate archive
`72df412ee7f52f13ab269817a10576110cc5481ebab89f6a36dab5fb54f36d27`
and exact candidate JSON
`33c793f83d1d5a965665c2a7685e9d57a59bb634d328c55836b9232f262f4b90`.
It adds readable retained originals, accepted review references, pinned Canon
receipts, author checks, a proposed financial-preservation contract and an exact
draft source-designation proposal. All 29 archive members are inventoried.

The candidate's historical `acceptedStartingArchiveRetrievedThisPass: false`
is preserved. The new author verification records successful recovery in this
session. The underlying v12 attachment's `44961b7c...6fe8` label is its manifest
digest; its observed archive digest is separately recorded. All 78 inventoried
payloads and the accepted raw-source digests match.

## Narrow checker scope

Judge the ten CHI/TOR original-first bindings for 2027, 2028, 2029, 2031 and
2032, and the fourteen post-exchange adjacent-pair possession witnesses.
Only the two 2028 originals are proposed for exchange, at the unchanged
`2026-06-05T12:19:56.526Z` instant. No player, cash, exception election or new
protection/swap term is included. Preserve every one of the 278 identities and
the exact 29 unresolved mapping objects.

R1 is reported-holder acceptance; R1X-E cannot exclude an unpublished event
between May 26 and June 5. Neither the original R1 acceptance nor the completed
two-transfer review accepts these ten operation bindings. The checker judges
operation-specific limitation dispositions independently and retains the
original limitation text. Complete source cells are supplied for independently
chosen comparisons. No historical full-corpus re-audit is required absent a
concrete discrepancy.

The financial proposal is supplementary preservation evidence only. Derive
effects from normalized terms and compare authoritative before/after state.
Preserve missing inputs, unknown completeness and known violations. Unknown
initial hard-cap compliance remains blocking. An unchanged incomplete ledger
cannot certify compliance or become a zero. The existing salary-matching,
projected hard-cap and final post-state validators retain their required inputs
and vetoes. Both CHI and TOR currently remain `needs-input`; this adapter changes
no application validator or saved-world behavior.

The source-designation proposal is a draft for review. Even a private ACCEPT
would not itself designate sources, establish missing financial facts, authorize
adoption/publication/activation/migration, or complete the actual saved-world
transaction. C4/C5 and the full V1 universe remain unchanged.

## Validation and execution boundary

Risk: consequential review/authority transport. Author checks cover exact input
recovery, all 30 source-cell bindings, 278/exact29 preservation, fourteen witness
pairs and an execution of this transport with the real retained archives and
locally substituted HTTP reads. This local run is not a Claude review.

The tooling tests exercise the V3 success path, changed/lost identities and
mappings, altered candidates/original archives, wrong dates/scope, financial
ready substitution, archive/member/manifest corruption, incompatible connection
versions, mixed supplements and encrypted receipt binding. Existing V1/V2,
read-only tool restrictions, owner-environment checks, exact code-review gates,
failed/denied/REVISE results and privacy protections remain tested.

Run the complete comparison with `npm run test:diff -- --reporter=dot`.
Independent exact-head code ACCEPT and green CI are still required for adapter
delivery. Application typecheck/build and browser/emulator proof are not claims
of this tooling-only change; the real transaction still needs that later proof.

The existing private-review path requires the accepted preparation code merged
on current main, equal candidate/merge trees, exact candidate/main CI, and the
existing owner-protected `nba-maintenance-publication` environment. Its jobs
remain read-only, use no Google identity or publisher and retain only the
encrypted complete report. Do not execute the unmerged adapter with credentials.

The current integration receives HTTP 403 when reading protected secret
metadata. It cannot configure `NBA_MAINTENANCE_SOURCE_REVIEW_CONNECTION`.
Prepare fresh V3 URLs only when the owner's existing secret editor is ready;
the links expire quickly. Use a verified recoverable encryption recipient and
the existing owner-approved run gate. No new credential or permission expansion
is part of this change. Never place signed URLs or connection contents in Git,
public comments or logs. Do not reuse the stale V2 connection or dispatch the
unchanged old workflow as acceptance of the new bindings.

Recover and strictly verify the full encrypted verdict against all three exact
archive identities and the accepted executor before any source-designation
request. Preserve failed or revised receipts; repair in scope before retrying.
