# ScoutZero cloud development and NBA data operations

Use the existing configured Codex cloud workspace. Ordinary development runs
Vite, Firestore, Auth, Functions and Chromium locally inside that workspace.
GitHub holds code, commands, configuration and handoffs. NBA inputs and evidence
stay private. Preserve genuinely irreplaceable new cloud-only evidence through
an authorized private recovery route; disposable emulator accounts, snapshots
and browser sessions do not require perpetual independent backup. Vercel and
production publishers are not prerequisites. No local Mac is required.

The controlling owner correction at the top of BZE-323 supersedes earlier
broader recovery proposals. The original project remains on the owner’s external
Samsung T7 SSD; its precise inventory is unverified. Do not imply it was lost,
reconstruct the entire SSD, or make roster cleanup, a new bucket or Enterprise
OIDC prerequisites for ordinary remote NBA data work.

## Setup and normal development

The supported Linux executor has Node 24, Java 21, Chromium, application
packages, compiled Functions and a protected October 3 export. Fetch live main
before an assignment; the image's local refs can be stale. On another trusted
Linux cloud executor, clone the exact assignment ref and run:

```bash
npm run cloud:setup
npm run cloud:setup -- --check
```

Setup installs locked app dependencies, builds existing Functions and pins
Firebase CLI 14.12.1 separately under `.scoutzero-dev/tools/firebase/`. The setup
entry point uses Node’s managed environment proxy for an uncached emulator
download; a direct native fetch is rejected in this executor.
CLI 15.32.1 ignored NO_PROXY and broke hub/export requests behind this proxy.
Setup also pins official Firestore emulator 1.22.0, verifying its published
size and SHA-256 before activation. The launcher's supported binary override
keeps the compatible CLI. Emulator 1.19.8 rejects the existing roughly 8 MB
atomic governed-world batch at its 4 MB inbound limit; 1.22.0 accepts it.
Do not split that atomic write or trim the governed contract baseline.
Startup also fingerprints the actual Functions sources, certified server bundle
inputs and compiled bytes, rebuilding stale caches. The recovered cache initially
omitted a current Function; file existence is not a valid build receipt. Stop
`cloud:dev` before editing/building Functions, then start it again: rebuilding
`lib/` in place while Firebase watches can leave a failed backend. UI editing
still uses Vite reload normally.
Use writable existing caches when home-directory writes are restricted:

```bash
export FIREBASE_EMULATORS_PATH=/workspace/.cache/firebase/emulators
export XDG_CONFIG_HOME=/workspace/.cache/config
```

For the historical full development copy:

```bash
npm run cloud:data:import -- /workspace/.data/scoutzero-source/current
npm run cloud:dev
npm run cloud:check
```

The launcher refuses occupied ports and owns only its own processes. It starts
Firestore, Auth, existing Functions and Vite on loopback 8082, 9099, 5001 and
5173; it waits for hub discovery and Functions definitions. Writes target only
`demo-architect-review`. SIGTERM/Ctrl-C stops Vite first and requires an observed
Firebase export. Never kill Java separately or another assignment's listeners.
The app uses the real copied dataset, not the tiny synthetic Architect seed.
Forced cleanup tracks only owned descendant PIDs and their start times, so a
stalled Function cannot leave a detached emulator running or kill another job.

## Actual live refresh and scope

A database capture is **not** independent qualification of current basketball
facts. All live pages and player descendants use one Firestore `readTime`, and
server update times are reported separately from collection time.

The existing public Firebase client configuration was recovered in the configured
workspace at `/workspace/.setup/firebase-public-config.json`. Bootstrap the
ordinary application reader once:

```bash
npm run cloud:data:refresh -- --firebase-config=/workspace/.setup/firebase-public-config.json
```

This uses a safe anonymous Firebase identity and stores its refresh session
privately. Later attempts reuse that identity and the retained public client
configuration. It does not read production Auth accounts or user content, grant
IAM permissions, create keys, change rules or acquire a writer role. Credentials
are never printed or supplied to Vite/Functions/browser test children.

**Observed October 18:** authenticated reads of both draft roots still return
PERMISSION_DENIED. A real full attempt retained detailed coverage privately and
left the October 3 snapshot byte-for-byte unchanged. There is no completed full
refresh claim. Explicitly capture the readable core separately:

```bash
npm run cloud:data:refresh -- --scope=core
npm run cloud:data:status -- --scope=core
npm run cloud:dev -- --scope=core
npm run cloud:check -- --scope=core
npm run cloud:check:architect -- --scope=core
```

Core never imports, overlays or relabels legacy entitlements. It has its own
baseline and test sessions under `.scoutzero-dev/core/`; it cannot replace the
full baseline. Its successful capture contained 4,070 documents: 677 player
roots, 676 base players, 30 teams, 1,292 contracts, 718 seasons and 677 views.
All 677 parents' three approved child collections were read. The selected core
capture's `readTime` is October 18, 2026 03:19 UTC; newest source server update
was June 7, 2026. Roster references still have 23 gaps and teams still have no entitlement
membership. These are source gaps, not accepted current NBA readiness.

An already-configured Google reader can instead use:

```bash
npm run cloud:data:refresh -- --google
# Or an already-authorized short-lived gcloud login:
npm run cloud:data:refresh -- --gcloud
```

The current managed executor reports no Google outbound identity, ADC binding
or active gcloud reader. The separate BZE-321 inspector has entity GET permission
for its pinned operation, not LIST, and is not a general export credential.
A genuinely authorized Google identity needs `datastore.entities.get` and
`datastore.entities.list` on the existing database. Prefer existing short-lived
identity configuration; no service-account key, writer grant, rule relaxation,
new project or billing change is needed. Follow the cloud runtime identity
manifest selectors when a connection becomes available. Do not reuse the
publisher or change its protected workflow/trust for development.

## Coverage and failure behavior

| Feature/dependency | Copied source | Readiness boundary |
| --- | --- | --- |
| Players, profile, Lists and ranking input | `players_v2`, `contracts`, `seasons`, `views` | Lists writes use emulator-only accounts; profile validation can still expose old source/schema gaps |
| Architect roster/cap/free-agency input | `architect_basePlayers`, `architect_baseTeams` | Relationships and money/source coverage remain independently checked; free-agent computation uses base players |
| Entitlements and pick rules | `architect_baseEntitlements`, `architect_basePickRules` | Live anonymous reader is denied; legacy 658 definitions are not the accepted 278 inventory |
| Governed new-world contracts | Existing Functions trusted release asset | Preserve its accepted pin; a database refresh does not migrate contract baselines or saved worlds |
| Pending draft hosted review | PR #547's separately versioned release manifest and parts | Not read by current main's core workflow; retain its installed five-document release and separate access/publication gates |
| Lists, tier lists, ranker sessions, worlds, roster projects, free-agent utility records, evaluations | Excluded production user content | Create safe emulator accounts/worlds; never mirror private user content |

Collection/document membership, counts, parent coverage and duplicate paths are
validated. Network/transient HTTP failures receive bounded retries; permission
failures are never retried into success. Denied, partial or empty required core
roots cannot promote a full baseline. Failure coverage and the failed capture
remain private under `attempts/`; previous source and runtime state remain intact.
A complete source-accurate capture preserves missing roster/entitlement references
exactly and reports them separately; those source defects do not veto the copy.
The copy does not qualify rights or authorize affected business operations or
unsafe mutations. Existing application and publishing safeguards remain in force.
Core coverage gaps are explicit diagnostics, not a silent full-sync fallback.
Unknown source collections are never crawled.

Protected historical import verifies the original project, bytes, SHA-256 and
counts, and excludes evaluations and legacy root teams. The historical allowed
copy has 4,051 records with 658 legacy entitlements, zero pick rules, 23 missing
base-player roster references and no captured views. Never substitute that
inventory for the separately governed 278 first-round entitlements and 29
unresolved evidence requirements.

## Baseline versions and saved-session recovery

Successful captures/imports retain immutable private `baselines/<sha256>/`
generations containing a matched source/coverage pair. A single atomic directory
pointer activates the pair. Private top-level aliases preserve the old paths.
Restore a retained baseline explicitly:

```bash
node --import tsx scripts/dev/cloudData.ts use <sha256> --scope=core
```

Stop services before changing baselines. Each fingerprint has a separate
`sessions/<sha256>/` directory with exported Firestore/Auth, browser state and
proofs. A new baseline gets clean isolated state; previous accounts, Lists and
worlds are retained rather than rewritten. Returning to an older baseline
restores its own test session and still reports its actual capture time. BZE-322
state is adopted only when its source fingerprint matches exactly.

After a clean stop/start, use:

```bash
npm run cloud:check -- --scope=core --resume
npm run cloud:check:architect -- --scope=core --resume
```

This restores the same exported emulator UID and saved List. Auth imports expire
old login tokens, so the check first verifies the saved account exists, then
uses only the SDK's emulator signer and DEV/demo/actual-loopback checks to
reauthenticate it. It never recreates a missing account or uses a real signing
key. Browser requests are limited to the declared local services. Screenshots
are 1280×720 and stay private in the active session directory.

Before handing off, commit/push authorized code; record exact ref, coverage,
checks and remaining gates in GitHub/Linear; stop cleanly and retain private
baseline/session/pipeline directories in the configured cloud workspace. For a
fresh checkout, copy that private retained storage through the existing trusted
cloud filesystem, check manifests and run setup/check/resume. Reused caches are
not a new VM proof. Public Git alone cannot recover untracked private data, and
these commands do not promise recovery after destruction of all private storage.

### Proportionate private-file recovery

Code, repeatable commands, public configuration and handoffs live in GitHub.
A fresh authorized Firestore read can reconstruct its source baseline; safe demo
accounts/worlds and browser proofs are disposable. Keep important new original
source captures and independent evidence private and recoverable. Do not publish
them in this public repository or public Actions artifacts.

Before selecting any off-workspace destination, identify the actual newly
generated files that cannot simply be re-fetched or rebuilt, and inspect existing
authorized private storage. The original local project remains on the external
SSD; its inventory is unverified. No exhaustive SSD reconstruction is required.
The current task requests no backup-destination approval.

Merged `cloud:recovery` code is an optional prepared mechanism, not required owner
setup or an authorized destination. Do not create its proposed bucket, attach
IAM/OIDC trust or execute the bundled `cloudOwnerAccess.ts --apply` procedure
based on the tools being present. Re-fetchable snapshots and every disposable
session do not justify a new service. If a concrete irreplaceable-file need later
requires a destination, select the simplest adequate route and verify actual
readback and independent recovery before claiming durability.

The existing local diagnostic backend exercised hash validation and restoration
of real source baselines, safe accounts, Lists and an Architect world into an
empty checkout. It reports `remoteCopyVerified: false`; same-VM restoration is
not proof of workspace-loss recovery. No Google payload upload occurred. The
previous unverified/unapproved proposed upload was rejected by automatic approval
review; it does not make a new bucket a BZE-323 prerequisite.

### Fresh roster-reference investigation

```bash
npm run cloud:data:audit
# With the approved renewable Google reader:
npm run cloud:data:audit -- --google
```

The audit uses the retained core inventory to select gaps, then retrieves current
team/player evidence at one fixed readTime. It retains evidence and reviewable
before/after proposals privately. October 18 UTC execution found 23 references:
`robert_williams` → `robert_williams_iii` (POR) and `royce_o_neale` → `royce_oneale`
(PHX) have matching names, birth dates, NBA IDs and team references in the two
player collections. Their proposals replace only roster IDs and matching cap-hold
IDs, preserving money and draft fields. The other 21 IDs remain absent in both
player collections. No player was invented and no repair was published. These
are identity-reference proposals, not independently accepted current NBA rosters.
The 23 mismatches and these proposals are separate NBA data work, not
prerequisites for a faithful cloud refresh or BZE-323 completion.
All proposals still require independent evidence review, change-specific approval
and matching live update-time preconditions before any production write.

## Source collection, staging and exact update preparation

The existing player/team/stat/PST scripts remain the processing tools. New cloud
entry points supply private explicit inputs, provenance and retained outputs;
they are not a replacement parser or publisher.

```bash
npm run cloud:source -- --player=austin_reaves --team=LAL --url=https://salaryswish.com/players/austin-reaves
npm run cloud:pipeline -- prepare --player=austin_reaves --inputs=<private-input-directory> --scope=core
npm run pipeline:sync:plan -- --cloud-run=<private-run-directory>
npm run cloud:pipeline -- verify --run=<private-run-directory>
npm run cloud:pipeline -- emulator-check --run=<private-run-directory>
```

`cloud:source` forces a fresh GET rather than the regression-fixture fallback,
retains both original retrieves privately, runs the existing contract parser and
schema, and manifests the exact input bytes. Unequal originals remain unequal;
no capture/parser success is independent qualification. The current managed
network rejects SalarySwish at the proxy CONNECT boundary, before the site can
be tested. Actual failure evidence is retained, and no fresh scrape is claimed.
Source-domain access must be configured through the normal reviewed environment
network workflow, not a proxy bypass. Site-session/challenge behavior remains
unproven until that access works.

The existing scripts require `salaryswish.com`, `www.salaryswish.com`,
`stats.nba.com`, `www.nba.com`, `cdn.nba.com`, `basketball.realgm.com` and
`www.prosportstransactions.com`. Header-only probes of all seven were rejected
by this workspace's enforced CONNECT policy. Its current configuration also
has no outbound Google identity, ADC binding or Google administration connector.
An owner-reviewed environment access change is required for these capabilities;
an agent cannot grant it with the available status-only environment tool.
Use a renewable read-only Google identity with document GET/LIST, never the
protected BZE-321 publisher, a service-account key or broader database rules.
After access is attached, agents must repeat full capture and actual upstream
collection and qualify proposed changes before claiming full operation. Report
source relationship gaps separately; roster repair is not a refresh prerequisite.
Access alone does not make the stored basketball facts current.

To recover missing ignored staging inputs from the current database copy:

```bash
npm run cloud:pipeline -- recover --player=austin_reaves --scope=core
```

This is explicitly `firestore-recovery`, not a scrape or independent NBA source.
Use its reported input directory with `prepare`. The cloud execution recovered
Austin Reaves, ran the existing stage/validator and retained a four-record plan.
Its before-images and update-time/absence preconditions come from the authenticated
live capture. No production write or source acceptance followed. A conditional emulator-only
rehearsal applied all four changes atomically, verified them and restored the
original fields; it is not a production publication result.

The legacy contract regression runner’s moved-file imports are repaired. Its
private retained HTML/expected JSON pairs are absent in this workspace/public
clone; public CI explicitly marks those cases unavailable, not passed, and runs
the public tooling checks. Keep original source regressions private and run them
in the trusted workspace when their inputs are recovered and qualified.

Every run retains verified input files, schema results, staged outputs, exact
before/after fields, changed field paths, hashes and a recovery manifest under
`.scoutzero-dev/pipeline/`. Run verification detects changed bytes. Plans require
an authenticated baseline less than 24 hours old and complete nested coverage;
they preserve unknown typed fields, add no proposed deletes and never write
production records. The emulator rehearsal has one literal loopback destination,
rejects draft/user/team paths, checks exact before-images, verifies an atomic
conditional commit and restores original fields with fresh preconditions.
Lost raw inputs are not invented from remembered facts. Native Node/tsx imports
avoid this executor's tsx CLI IPC EPERM; batch staging now exits nonzero on failure.

| Existing operation | Inputs/recovery requirement | Publication boundary |
| --- | --- | --- |
| Player contracts / `contracts:run` | SalarySwish pages, player index; optional original raw captures | Existing parser/stager/validators; qualified inputs and reviewed record-level plan required |
| NBA IDs/bios/stats builders and `stats:batch` | Existing NBA endpoint access and retained index/season outputs | Capture freshness and schema checks do not authorize a source write |
| Team fetch/parse/merge/stage | SalarySwish team data, player index and explicit retained team artifacts | Do not manufacture missing draft inputs or overwrite draft membership in an ordinary team update |
| RealGM and `pst:*` fetch/extract/build/validate | Authorized source pages/session and privately retained generated artifacts | Legacy seed/push commands are not an accepted first-round publisher; preserve 278/29 and BZE-321 gates |

No production publication is executed here. Independently qualified original
inputs, exact before/after review, change-specific production approval and fresh
matching record preconditions remain mandatory. The old plan's generic production/PST push instructions are disabled. Legacy
artifact inspection requires `--legacy-staging-report --verify-only` and is not
publication authorization. Ordinary player
plans exclude team/draft/user/world paths; BZE-321's protected publisher is untouched.
After a separately approved publication, run a new authorized refresh and select
that new baseline, keeping previous sessions available.

## Minimal source-domain setup

The agent can inspect the applied environment policy but cannot edit it with the
available status-only tool. Observed October 18: restricted/enforced policy still
excludes the seven NBA hosts. Use the existing environment; do not recreate it.

1. Open **Settings → Codex Cloud → Environments**. Find the existing ScoutZero
   environment and choose **… → Edit**.
2. Under **Internet access**, keep **Package managers** and the existing allowed
   hosts. Append these under **Additional allowed domains**:

   ```text
   salaryswish.com
   www.salaryswish.com
   stats.nba.com
   www.nba.com
   cdn.nba.com
   basketball.realgm.com
   www.prosportstransactions.com
   ```

3. **Save**, then **Republish** the same environment. Check the actual policy in
   the current task. If it retains the old policy, verify from a task using the
   newly published environment; existing task files remain separate.

This change enables source access for subsequent development assignments. It
adds no Google permission, backup destination or OIDC dependency. The agent then
runs `cloud:source` and the existing parser/stager/verifier with retained raw
originals. Merely reaching the host is not fresh collection, and parsed bytes
are not independently qualified facts. A site challenge remains an actual
failure to resolve after the policy permits access; never substitute fixtures.

## Renewable Firestore reads: a separate access decision

Reuse the existing renewable Firebase reader first. It already refreshes its
identity and reads the real core source hierarchy without Google IAM setup.
Its latest actual requests to `architect_baseEntitlements` and
`architect_basePickRules` returned HTTP 403. Current repository Rules permit
authenticated reads of those roots, but repository text is not proof of the
deployed policy; do not deploy or relax Rules to bypass the observed denial.

No Google outbound identity, ADC file, gcloud installation or authorized Firebase
CLI account is currently available in this executor. Installing Firebase MCP
alone does not provide an account, consent or IAM grants.

Standard Google browser OAuth and Application Default Credentials (ADC) support
renewable reads without Enterprise Codex OIDC. The smallest supported candidate
is an **existing Google principal whose effective access is already read-only**,
authorized once using the normal browser flow, with its refresh credential kept
private and revocable. The existing `--google` reader supports ADC; `--gcloud`
uses an already configured gcloud account. A read-only identity needs document
GET/LIST (`datastore.entities.get` and `datastore.entities.list`) on the existing
source database. A one-hour copied access token is not a renewable setup.

An owner account's broad ADC is not a read-only identity merely because this
script uses GET. Impersonation limits the resulting service-account token but
does not remove privileges from retained underlying user credentials. Verify
the actual principal, inherited grants and supported consent/credential route
before requesting owner setup. No existing suitably limited principal has yet
been verified, and no IAM inventory is available without Google authorization.
If no reusable principal is available, identify the smallest separate read grant
and credential route before asking for it; do not assume Enterprise OIDC or use
BZE-321's protected GET-only inspector, publisher or trust.

Firestore IAM is not a collection-level privacy filter. Regardless of the
identity, keep the export allowlist to the five source roots and approved player
descendants; never read private production accounts, worlds or evaluations.
The source-read grant does not need storage permissions, a bucket, billing
changes, a writer role or a service-account key. No such setup is authorized by
the older bundled bootstrap script.

After actual access is available, the agent owns a fresh full capture, honest
source-quality diagnostics, emulator reload, Players → Lists and Architect
save/reload checks, and source-qualified before/after preparation and emulator
rehearsal. Preserve 278/29 governance and independent production-write gates.
BZE-323 remains **In Progress** for genuinely unmet remote capabilities, not
optional backup expansion or the 23 roster discrepancies.

References: [Codex environment settings](https://learn.chatgpt.com/docs/environments/cloud-environments),
[Firestore authentication](https://docs.cloud.google.com/firestore/native/docs/authentication),
[standard remote browser sign-in](https://docs.cloud.google.com/sdk/gcloud/reference/auth/application-default/login),
[Firestore IAM permissions](https://docs.cloud.google.com/iam/docs/roles-permissions/firestore),
[Firebase MCP authentication](https://firebase.google.com/docs/ai-assistance/mcp-server).

## Focused validation

```bash
npm run test:cloud-dev
npm run cloud:typecheck
npm run typecheck
npm run validate:project
npm run docs:guardrails
```

Use feature-scoped tests from AGENTS.md for application changes. CI runs cloud
safety and tooling type checks as well as the existing gates. Use the supported
cloud execution permissions: the restricted shell can suppress Node children
while reporting file-level success. Setup/build use an execution sentinel, and
the safety command imports the actual cases directly and tests real descendants. Do not certify the
full pipeline from synthetic tests, script presence, a stale emulator or a green
partial capture. Live full sync and fresh external-source collection remain open
until those actual operations pass; separate NBA fact qualification from faithful
source capture and preserve all production-write gates.
