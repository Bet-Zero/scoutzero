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
complete success; coverage is private `coverage.json` and `run.json`. A successful
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

Before production registration, run the non-mutating access probe:

```bash
npm run maintenance:access
```

The existing environment must have an approved short-lived Google maintenance
identity and network access to `cloudresourcemanager.googleapis.com` in addition
to the already approved Firestore/authentication hosts. The command reports
missing configuration together, checks required `datastore.entities.get`,
`datastore.entities.create` and `datastore.entities.update`, rejects tested
unneeded deletion/listing/admin/storage privileges, and reads one fixed ordinary
base-player record. It never commits data or changes IAM/Rules. A passing probe
is permission/read evidence, not complete IAM-policy review or production approval.
Verify the actual identity, trust, role bindings and expiry separately; these
Firestore permissions are database-wide IAM, with document/field scope enforced
by the reviewed executor. Do not broaden a BZE-321 identity or use broad permanent
roles or service-account keys. Missing access configuration keeps Gate A open.
Production execution repeats the probe after exact registration and landed-code
checks. Landed-code checks inspect every tracked file's actual bytes, including
files hidden by git index flags.

The explicit production entry point is:

```bash
npm run maintenance:publish -- --production \
  --plan="$PRIVATE_RUN/publication-plan.json" --approval="$PRIVATE_APPROVAL" \
  --approved-plan-sha256="$EXACT_OWNER_APPROVED_DIGEST"
```

It uses an already authorized short-lived Google application-default credential,
fixed Firestore host/project/database, no redirects, exact preconditions, readback
and completion records. This is **prepared/rehearsed implementation**, not a live
publication receipt. This fresh environment has no configured Google writer;
no new grant, key, protected environment or broader Rules change was made.
The existing BZE-321 protected publisher must not be repurposed. A verified
appropriately bounded authorized execution identity remains an access gate;
do not disguise it as a completed deployment or use a broad owner credential.

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
