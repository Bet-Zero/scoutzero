# NBA maintenance: operating card and shared commands

Use this entry point for NBA data maintenance. Code and commands are shared by
supported local and cloud environments. Firebase remains the data store.
Collection, parsing, factual acceptance, publication and demonstrated app behavior
are separate statuses. A recently copied database is not current NBA evidence.

## Owner operating card

- Request a refresh with the season, date and intended datasets. The next full
  operating run is **2026-27**, with an explicit current capture/effective scope.
- Codex collects or imports, retains original inputs, reconciles missing records,
  prepares exact changes, obtains independent review and handles normal checks.
- Approve only the exact reviewed production plan. No production update has been
  authorized or performed by the Gate A rehearsal. An approval of one draft
  correction does not approve ordinary NBA maintenance.
- Ordinary cloud development needs no laptop. Supported Mac processing uses
  Node 24 (official binaries require macOS 13.5+); the physical old laptop and
  SSD have not been tested. Do not assume that machine can run the full stack.
- When a source blocks cloud capture, make one focused diagnosis and one
  evidence-supported repair attempt. A simpler permitted browser/laptop capture
  may then feed the same private processing workflow. Preserve original files;
  never bypass a site challenge or run a legacy bulk uploader.
- Stats refresh on demand; daily in-season scheduling is a separate decision.
  Reconcile rosters, contracts and payroll together after material transactions.
  Check league inputs at season changes. Update draft evidence after relevant
  trades, elections, conveyances and draft/season milestones.

## Selected paths and consumption

| Dataset | Selected collection/processing path | Actual destination and consumers | Gate |
| --- | --- | --- | --- |
| NBA IDs, bios and index | Existing `build:ids`, `build:bios`, `build:index`; explicit END_YEAR and private output directory | Input index for contract/stat collection and team identity resolution | Missing/ambiguous identities remain missing; guessed slugs require URL verification |
| Contracts/options/extensions | `maintenance:collect --operation=contracts`, existing parser/schema, `maintenance:inputs`, `cloud:pipeline prepare` | `players_v2/{id}`, contract descendants, contracts view and `architect_basePlayers/{id}`; Players/profile and live catalog | Exact qualified source, reviewed plan, owner approval, live preconditions |
| Rosters/payroll/cap holds | `maintenance:collect --operation=teams`, existing team parser and `buildMaintenanceTeam`, `maintenance:plan` | `architect_baseTeams/{team}`; roster/cap consumers | Unknown IDs withhold the team; draft relationships remain untouched |
| Statistics | `maintenance:collect --operation=stats`, existing NBA fetch/parser/output builder | Season descendants and current-season table values; profile reads season metadata | No-games, missing ID, failure and prior/career fallback remain distinct |
| Legacy draft display | Existing RealGM/PST diagnostic commands | Historical artifacts only; direct bulk writers retired | Never authority for accepted rights or installation |
| Accepted draft evidence/releases | [Draft update procedure](DRAFT_UPDATE_PROCESS.md), existing source/lifecycle/foundation tools | BZE-321 protected release consumer; separately approved installation | Private factual review, exact release approval and actual consumer proof |
| League inputs and starting-world contracts | Existing governed releases/Functions assets, [Architect boundary](../agent-guides/architect-boundary.md) | New-world initializer's pinned baseline | Separate release/adoption decision; no June 5 or saved-world migration |

`contracts:*`, `stats:batch`, `team:full` and `team:salaryswish` redirect operators
to the explicit shared collector. Direct old player/team/PST bulk writers stop
before credentials or writes. Historical code remains recoverable in git.
The newer BZE-321 protected executors are unchanged.

## Fresh cloud task and private recovery

Follow [CLOUD_DEVELOPMENT.md](CLOUD_DEVELOPMENT.md) for setup, read-only refresh,
emulator selection, save/restart and private session paths. A fresh task must
fetch current code and run setup; image caches are not proof of current builds.
See the [implementation verification record](../../work/bze-324/VERIFICATION.md)
for observed counts, timestamps and limitations.

Use `npm run cloud:dev -- --scope=core`, then `cloud:check` and
`cloud:check:architect` with the same scope. Stop the launcher cleanly; restart
and append `--resume` to both checks. Each source generation has separate test
state. Do not run the process-ownership/recovery safety tests while these
services are running: recovery deliberately refuses occupied service ports.

Irreplaceable draft originals and judgments are independently recoverable from
the private Linear attachments listed in [DRAFT_UPDATE_PROCESS.md](DRAFT_UPDATE_PROCESS.md).
Disposable emulator state does not require a new backup service. Existing
private cloud copies are caches; public Git cannot recover private originals.

## Explicit collection and input generation

Run from the checkout root. Use a new ignored private directory per refresh.
The inventory is a JSON map keyed by exact player ID (team code for team runs).
Player entries carry `fullName`, `displayName`, `teamCode`, verified `nbaId` and
the exact verified `https://www.salaryswish.com/players/...` URL for contracts.
Team entries carry `teamCode` and the exact `.../teams/...` URL. Free agents use
`FREE`; missing inputs are reported, not synthesized.

```bash
# END_YEAR convention belongs only to these existing foundation builders:
OUTPUTS_DIR="$PRIVATE_RUN/foundation" REPORTS_DIR="$PRIVATE_RUN/reports" \
  npm run build:ids -- --season=2027
OUTPUTS_DIR="$PRIVATE_RUN/foundation" REPORTS_DIR="$PRIVATE_RUN/reports" \
  MAINTENANCE_AS_OF="$AS_OF" npm run build:bios -- --season=2027
OUTPUTS_DIR="$PRIVATE_RUN/foundation" REPORTS_DIR="$PRIVATE_RUN/reports" \
  npm run build:index -- --season=2027

npm run maintenance:collect -- --operation=contracts --season=2026-27 \
  --as-of="$AS_OF" --inventory="$PLAYER_INVENTORY" --run="$PRIVATE_RUN/contracts"
PROXY_URL="$HTTPS_PROXY" npm run maintenance:collect -- --operation=stats \
  --season=2026-27 --as-of="$AS_OF" --inventory="$PLAYER_INVENTORY" \
  --run="$PRIVATE_RUN/stats"
npm run maintenance:collect -- --operation=teams --season=2026-27 \
  --as-of="$AS_OF" --inventory="$TEAM_INVENTORY" --run="$PRIVATE_RUN/teams"
npm run maintenance:inputs -- --runs="$PRIVATE_RUN/contracts,$PRIVATE_RUN/stats" \
  --out="$PRIVATE_RUN/inputs"
npm run cloud:pipeline -- prepare --scope=core --player="$PLAYER_ID" \
  --season=2026-27 --as-of="$AS_OF" --inputs="$PRIVATE_RUN/inputs"
```

`AS_OF` must be a real UTC timestamp, for example `2026-10-18T19:00:00Z`.
It is the declared evaluation/effective context; actual source capture timestamps
remain separate in retained originals/parser provenance. Source qualification
must establish whether the source supports that context. Do not backdate a
later transaction into the June 5 scenario. Native collectors retain managed
proxy/CA settings; the NBA Playwright request collector uses `PROXY_URL`.
On ordinary local systems without a managed proxy, omit that environment setting.

Fresh collection fails if its run already exists. `--resume` accepts only the
same operation, season, as-of and exact inventory, checking each completed
output's hash and size. Missing, failed or withheld required members prevent
complete success; coverage is private `coverage.json` and `run.json`. HTML
collection paces both original requests and stops on the first HTTP 429. Retain
the run, respect the source cooldown, then use exact-run `--resume`; do not loop
through the remaining inventory while the source is throttled. A successful
fallback is labeled with its actual season, never copied into current-season
table statistics. Multi-team seasons prefer an explicit aggregate and withhold
ambiguous stints. Collection is not factual acceptance.

The foundation aggregate now supports the same explicit generation:

```bash
npm run build:foundation -- --season=2027 --as-of="$AS_OF" \
  --outputs-dir="$PRIVATE_RUN/foundation" --reports-dir="$PRIVATE_RUN/reports"
```

It runs the existing IDs → bios → index builders in order, supplies their
END_YEAR and dated environment consistently, requires separate new private
output/report directories, and records completed steps in `foundation-run.json`.
The foundation builders retain original responses under the private output
`raw/` directory with URL, actual capture time, byte size and SHA-256 receipts.
Foundation response bytes are retained before decoding. HTML collection retains
UTF-8 decoded HTML; NBA statistics retain parsed JSON. Capture metadata names the
representation, and offline reprocessing must retain the original acquisition
time rather than report processing time as a new source capture.
In the managed cloud set `NODE_USE_ENV_PROXY=1` for native requests and
`PROXY_URL="$HTTPS_PROXY"` for the bios Playwright request context.
A failed builder stops the aggregate and leaves `complete: false`. Do not run
this full source-collection command until the refresh is authorized. For a
failed generation, retain the evidence and start a new generation; the direct
bios command's exact-run resume is a separate operation.

For bulk staging of already acquired private player inputs:

```bash
npm run pipeline:stage:players -- --season=2026-27 --as-of="$AS_OF" \
  --index="$PRIVATE_RUN/inputs/player_index.json" \
  --contracts-dir="$PRIVATE_RUN/inputs/contracts" \
  --stats-dir="$PRIVATE_RUN/inputs/stats" --outDir="$PRIVATE_RUN/staged" \
  --batchSize=10 --validate
```

Single-player staging accepts the same context/path options plus `--player`.
Bulk staging uses the same library and explicit options for every member;
failed members yield nonzero status. Staging alone does not verify an input
bundle, qualify facts, prepare baseline preconditions or authorize publication.
Use the verified input/planning route above for those gates.

For a contract-only update omit the stats run. Do not substitute old stats as
new evidence. For statistics-only planning use `maintenance:plan --stats-run=<verified-run>`
instead of a player run. It stages only season records and current statistics,
preserving contracts and base-player records; no contract input is required.
An incomplete required dataset cannot be omitted to call a full refresh complete.

## Review, rehearsal and publication

`cloud:pipeline prepare` retains schema results, originals, exact typed
before/after values and live update-time/absence preconditions. New signings get
new contract keys; unchanged historical deals retain their original keys and
creation metadata. Unknown typed fields and all user/world paths are preserved.
Team planning fails on unresolved roster IDs instead of manufacturing records.
A new roster member can be supplied by an earlier verified player group in the
same publication; an index entry alone never satisfies that requirement.
Current roster collection includes disabled-list and training-camp/Exhibit 10
contracts, with their source status retained for factual qualification.

```bash
npm run maintenance:plan -- --season=2026-27 --as-of="$AS_OF" \
  --source-dir=.scoutzero-dev/core --player-runs="$PLAYER_RUNS" \
  --team-run="$PRIVATE_RUN/teams" --index="$PLAYER_INVENTORY" \
  --out="$PRIVATE_RUN/publication-plan.json"
npm run maintenance:rehearse -- --run="$ONE_VERIFIED_PLAYER_RUN" --browser
```

Groups are bounded to 450 changed records and 7 MB before the completion write.
Each coherent group and its completion record commit atomically in the same
database. The exact plan digest identifies the operation. An interrupted run
reads completion records, verifies stored after-images and their commit versions,
and resumes pending groups. A subsequent edit prevents a repeated success claim.
Failure after some groups means **partial**, never whole-run success.
Completion records live at
`maintenance_publications/{planSha256}/groups/{groupId}`.

Independent factual qualification must cover the exact `inputSha256` and intended
scope. Independent plan review and owner approval must each cover the exact
canonical plan digest. Retain authenticated external receipts, reviewer/owner
identities and expiry in a private `PublicationApproval` record (the TypeScript
contract is in `scripts/dev/maintenancePublish.ts`). An approval JSON is a
transcription of those decisions, not a source of factual authority or permission
for an agent to approve itself. Never create production approvals from the
synthetic emulator approval fixture.

Before production execution, retain exact qualification/review/owner receipts
and register only that approved plan digest, input digest and expiry in
`scripts/dev/maintenanceApprovals.ts` through normal independently reviewed
landing. The registry is initially empty. Caller-authored approval JSON or an
explicit command flag cannot register an operation. Production requires clean
exact live-main code; it rejects an author branch before credential use.

Ordinary publication reuses BZE-321's protected, immutable GitHub Actions and
Workload Identity Federation pattern, with a **separate** account:
`scoutzero-nba-maintenance@scoutzero-bf1ae.iam.gserviceaccount.com`.
It does not use the draft publisher, local ADC, personal Google identities or
service-account keys. Both local and cloud operators dispatch the same worker.

Before production registration, request the non-mutating access probe:

```bash
npm run maintenance:access
```

This dispatches `nba-maintenance.yml` on main; the dedicated
`nba-maintenance-publication` environment requires owner approval. The pinned
worker verifies live-main caller identity, all checked-out executor bytes, owner
review protection, no admin bypass and a main-only branch policy **before**
Google authentication. It checks `datastore.entities.get/create/update`, rejects
tested unnecessary deletion/listing/admin/storage privileges, and reads one fixed
ordinary base-player document. Access mode never fetches a private package or
calls commit. The Google token lasts ten minutes and is confined to that job;
no credential file, private artifact or token is exported.

A passing probe proves permission/read behavior, not complete IAM-policy review
or production approval. The three Firestore permissions are database-wide IAM;
the immutable reviewed executor enforces the document/field boundary and keeps
worlds, draft associations and unrelated records unchanged. No broad permanent
role, draft privilege, Rules privilege or service-account key is allowed.
Configuration and the actual read-only run must be verified before Gate A closes.
See the [bounded setup and owner action](../../work/bze-324/PUBLISHER_ACCESS.md).

For a qualified, independently reviewed and owner-approved production proposal:

```bash
npm run maintenance:package -- --plan="$PRIVATE_RUN/publication-plan.json" \
  --approval="$PRIVATE_APPROVAL" --out="$PRIVATE_RUN/publication.json.gpg" \
  --passphrase="$PRIVATE_MAINTENANCE_PASSPHRASE_FILE"
```

GnuPG is required for packaging and the Linux worker. Packaging generates a
separate 384-bit random passphrase when the private file does not exist, verifies
actual decryption, refuses output overwrite and prints only digest metadata.
It does not establish factual acceptance. Retain the passphrase through an
explicitly authorized private handoff; install it **once** as the dedicated
environment secret `BZE324_MAINTENANCE_PASSPHRASE`. Never reuse a BZE-321 key.
Never put plaintext or that secret in Git, workflow inputs, logs or artifacts.
The 73-file rehearsal archive is **not** a publication input and must never enter CI.

Public ciphertext retention needs explicit owner authorization for the exact
new package, as in the BZE-321 handoff; an earlier exception does not extend.
After that authorization, place only the ciphertext at
`.github/nba-maintenance-publication.json.gpg` and add its exact metadata under
the plan digest in `.github/nba-maintenance-approvals.json` through normal review
and landing. Each record contains only `ciphertextSha256`, `inputSha256`,
`qualificationReceipt`, `reviewReceipt`, `ownerReceipt` and `expiresAt`.
The initial registry is empty and Gate A registers no production operation.

Codex then dispatches:

```bash
gh workflow run nba-maintenance.yml --repo Bet-Zero/scoutzero --ref main \
  -f operation=publish -f plan_sha256="$EXACT_OWNER_APPROVED_DIGEST"
```

The immutable worker fetches only fixed registry/ciphertext **data** from the
exact live-main caller; it never executes caller code. Before Google access it
checks the registered ciphertext, decrypted plan, qualified input digest,
independent and owner receipts, expiry, scope and coverage. It repeats those
checks and the access probe immediately before the shared conditional publisher.
Plans and plaintext never become job artifacts. Packages are bounded to 35 MiB;
prepare separately reviewed plans if necessary. Expired tokens or interrupted
runs stop without a complete claim; rerun the same still-approved plan to verify
atomic completion-ledger recovery. A local `maintenance:publish --production`
invocation always refuses ADC/key use; its emulator entry point remains available.

Emulator restoration uses only exact successful commit versions and refuses a
concurrent edit. Production reversal is a new independently reviewed, approved
conditional forward plan using retained before-images; automatic rollback never
overwrites subsequent legitimate changes. After approved publication, verify
actual consumers, then obtain a fresh read-only emulator copy.

## Readiness and first refresh

Use the [verification record](../../work/bze-324/VERIFICATION.md) and PR checks
for actual results. Gate A requires implementation, independent review and
verified appropriately bounded execution access. Documentation does not close it.

The first Gate B action is to declare the full `2026-27` inventory and as-of date,
run the read-only core refresh, and execute the three explicit collection
commands above in a new private generation. Reconcile retained roster-reference and historical-contract
findings from evidence before reviewing the exact publication proposal.

## Private factual checker on existing protected Actions

`nba-maintenance-source-review.yml` reuses the existing protected GitHub Actions
reviewer and pinned Claude action for ordinary NBA evidence. It runs only from
main after the preparation PR has merged, exact candidate/main CI is green and
the exact candidate has a published independent public code ACCEPT. The merged
and accepted candidate trees must match. It uses the existing
`nba-maintenance-publication` deployment gate, with read-only GitHub permissions,
no `id-token`, no Google authentication and no publisher invocation.

The owner supplies one private data connection through protected environment
secret `NBA_MAINTENANCE_SOURCE_REVIEW_CONNECTION`. Its versioned JSON binds the
private Linear archive URL, compressed size/hash, exact plan/input hashes and
Codex's public result-encryption certificate. It contains no service-account key
or publishing approval. Linear download signatures expire quickly: prepare a
fresh connection for the coordinated owner session and approve the review run
promptly. Never put the connection or signed URL in public Git, comments or logs.
The GitHub integration cannot configure this protected secret in the existing
cloud executor; the observed API result is HTTP 403.

The checker verifies and privately extracts a bounded, fully inventoried data
archive, rejects path traversal, links and duplicates, and independently binds
the canonical production-plan bytes and input digest. Trusted transport generates
navigation views directly from the authenticated originals; the checker inspects
those views alongside original inputs. Only fixed status/integrity metadata is public.
The complete judgment is encrypted to the retained private inspection key and
kept as a seven-day Actions artifact. Codex must recover it and verify original
execution outcome and exact candidate/archive/plan/input identities. Failure,
missing output, stale identity, REVISE or blocking findings cannot qualify data.
The checked-in publication registry stays empty until separate exact production
approval. The earlier 73-file rehearsal archive is never an input to this checker.
