# ScoutZero cloud development and NBA data operations

Use the existing configured Codex cloud workspace. Ordinary development runs
Vite, Firestore, Auth, Functions and Chromium locally inside that workspace.
GitHub holds code and handoffs. NBA inputs, baselines, isolated test state and
evidence stay private; off-workspace storage must be configured and verified as
described below. Vercel and production publishers
are not prerequisites. No local Mac is required.

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
Firebase CLI 14.12.1 separately under `.scoutzero-dev/tools/firebase/`.
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

**Observed October 17:** authenticated reads of both draft roots still return
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
All 677 parents' three approved child collections were read. The capture's
`readTime` is October 17, 2026 06:32 UTC; newest source server update was June 7,
2026. Roster references still have 23 gaps and teams still have no entitlement
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
failures are never retried into success. Denied, partial, empty required roots
and missing source relationships cannot promote a full baseline. Failure
coverage and the failed capture remain private under `attempts/`; previous source
and runtime state remain intact. Core coverage gaps are explicit diagnostics,
not a silent full-sync fallback. Unknown source collections are never crawled.

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

### Private recovery independent of the workspace

`cloud:recovery` stores immutable, hash-named blobs and a manifest in a verified
private Google Cloud Storage bucket in the existing project. It requires bucket
metadata access, object GET/CREATE, enforced public-access prevention, uniform
IAM access, and a verified **non-Firebase** bucket. Firebase app storage has a
separate Rules access path; its existing bucket is deliberately excluded. No
private payload belongs in this public repository or public Actions artifacts.

Stop services cleanly, then use the owner-approved private bucket:

```bash
npm run cloud:recovery -- backup --bucket=scoutzero-bf1ae-cloud-recovery-105500121903
```

The command includes retained full/core baseline generations, source-bound demo
sessions, browser proofs, pipeline inputs/outputs, known untracked legacy scrape
artifacts and public Firebase client configuration. It excludes reader refresh
credentials, tools, code, personal/provider-linked Auth accounts and arbitrary
files. Untracked legacy artifacts remain unqualified. Preserve original inputs
in `pipeline/`; browser profiles and production users/worlds must not be added.

A successful remote receipt requires private-bucket checks, immutable conditional
uploads and actual remote readback. Record its manifest hash, bucket, repository
commit and selected baseline hashes in GitHub/Linear, **without file contents**.
No object listing or overwrite/delete privilege is needed. Keep older manifests;
new captures never erase prior data. Run a new backup after cleanly saving work
or acquiring important source artifacts; there is no automatic continuous backup.

In a new cloud task with the renewable Google connection, clone the reviewed ref,
run `cloud:setup`, and restore to the **absent** `.scoutzero-dev` directory. Setup
creates a tools directory, so preserve it separately before restore:

```bash
mv .scoutzero-dev .scoutzero-dev-tools
npm run cloud:recovery -- restore --bucket=scoutzero-bf1ae-cloud-recovery-105500121903 --manifest=<recorded-sha256> --into=.scoutzero-dev
mv .scoutzero-dev-tools/tools .scoutzero-dev/tools
npm run cloud:data:status -- --scope=core
npm run cloud:dev -- --scope=core
# In another terminal after Ready:
npm run cloud:check -- --scope=core --resume
npm run cloud:check:architect -- --scope=core --resume
```

Restoration validates hashes, collection coverage, baseline/session bindings and
safe accounts in a temporary private directory, then activates only a complete
recovery into an absent destination. It never replaces existing data. Reinstall
code/tools from their trusted sources; do not restore credentials from a backup.
A local-only `--local-diagnostic=<private-directory>` backend exercises the same
integrity path but reports `remoteCopyVerified: false` and is **not** proof of
survival after workspace loss. Test actual Google upload/readback and recovery
in a new empty cloud session before claiming durability. Keep the original task
and data until that proof passes.

Observed local diagnostic (October 18 UTC): 75 retained files were backed up to
an independent local store, then restored into an empty GitHub checkout of
`c8977f0a12fb0145c04304b2eef3c8955a865281`. Both baseline hashes matched. Locked
app/Functions dependencies were installed; the explicitly reused official emulator
and CLI cache passed setup checks. Playwright resumed the same safe UID/List and
existing governed Architect world, rendered roster/cap, and saved/reloaded state;
1280×720 screenshots were visually inspected. Cap source gaps still show
**Needs input**. This proves the restore path with real retained data, **not**
remote durability or accepted current basketball facts. The diagnostic manifest is
`c401d8dd29fd478b868bfc44031e4d5728fde1b5a737ba75c1fbf2c12253b177`.
Google upload was not executed; its unverified/unapproved destination was rejected
by automatic approval review. Owner approval and bucket verification remain gates.

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
collection, resolve source relationship gaps and qualify changes before claiming
full operation. Access alone does not make the stored basketball facts current.

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

## One owner access setup for the remaining blockers

The agent can read the environment status but cannot edit its network policy,
attach an outbound identity or grant Google permissions. Current observations
show restricted/enforced networking, none of the seven NBA hosts, and no Google
identity, ADC binding or administration connector. Installing Firebase MCP alone
does not supply this access: it uses the same Firebase CLI/ADC authentication.

This is one coordinated account action, using the existing Codex environment and
Google project `scoutzero-bf1ae` (105500121903). It does not publish basketball
changes, grant a database writer, change application Rules, create keys, touch
BZE-321's trust/publisher, create a new project or change billing configuration.
It establishes renewable source reads plus an independent private recovery store.
The new bucket is necessary only because the public repository cannot hold this
private payload and the Firebase app bucket is not a verified recovery destination.

1. Open **Settings → Codex Cloud → Environments → the existing ScoutZero
   environment → Edit**. In Internet access, retain existing hosts and the package
   manager preset; append these exact hosts (including auth/privacy dependencies):

   ```text
   salaryswish.com
   www.salaryswish.com
   stats.nba.com
   www.nba.com
   cdn.nba.com
   basketball.realgm.com
   www.prosportstransactions.com
   sts.googleapis.com
   iamcredentials.googleapis.com
   oauth2.googleapis.com
   iam.googleapis.com
   cloudresourcemanager.googleapis.com
   firebasestorage.googleapis.com
   ```

   Permit the required Google authentication and private-storage POST requests;
   the source reader itself remains GET-only. This enables actual collectors,
   renewable tokens and private backup API calls; a host allowance is not login.
2. In that environment's **Advanced → OIDC → Add**, create/attach a **Google**
   connection. OIDC is documented as Enterprise/by-request: check availability
   before provisioning anything. If the control is unavailable, request that
   capability from the workspace/account administrator; do not create a key as a
   workaround. Use alias `scoutzero-cloud-data`. Keep the displayed non-secret
   **Issuer, Audience and Subject** for the next step. They must identify this
   environment; do not invent values or substitute GitHub Actions claims.
3. Open [Google Cloud Shell](https://shell.cloud.google.com/?project=scoutzero-bf1ae)
   as the existing project's owner. Run this reviewed, pinned setup; it prompts
   for only those three non-secret connection values. It uses the same project,
   an isolated `scoutzero-cloud-data` account and `scoutzero-cloud-dev` pool, and
   the private bucket `scoutzero-bf1ae-cloud-recovery-105500121903`. It previews
   exact scope by default; the final command is the explicit owner approval for
   source reads and that private backup destination. No private payload uploads
   during setup. Existing conflicting roles, trust or bucket privacy fail closed.

   ```bash
   scoutzero_setup=$(mktemp -d)
   git clone --filter=blob:none --no-checkout https://github.com/Bet-Zero/scoutzero.git "$scoutzero_setup"
   cd "$scoutzero_setup"
   git checkout --detach 650fe0f9dcd147337ff55fa8d953182395a5c5d4
   read -r -p 'Connection Issuer: ' scoutzero_issuer
   read -r -p 'Connection Audience: ' scoutzero_audience
   read -r -p 'Connection Subject: ' scoutzero_subject
   npx --yes --package=tsx@4.20.6 tsx scripts/dev/cloudOwnerAccess.ts
   npx --yes --package=tsx@4.20.6 tsx scripts/dev/cloudOwnerAccess.ts --apply --approve-source-read-and-private-recovery --issuer="$scoutzero_issuer" --audience="$scoutzero_audience" --subject="$scoutzero_subject"
   ```

   Project role permissions are `datastore.entities.get/list`,
   `resourcemanager.projects.get` and `firebasestorage.buckets.get`. IAM source
   reads are project scoped; the client restricts exports to the five approved
   roots and three player descendants. Bucket-only permissions are
   `storage.buckets.get`, `storage.objects.get/create`. The setup preserves other
   principals and refuses unexpected existing grants on its dedicated account.
4. Complete the Google connection using service account
   `scoutzero-cloud-data@scoutzero-bf1ae.iam.gserviceaccount.com` and provider
   `projects/105500121903/locations/global/workloadIdentityPools/scoutzero-cloud-dev/providers/codex`.
   Use the connection's renewable ADC file binding (`GOOGLE_APPLICATION_CREDENTIALS`),
   not a static access token or service-account key. Save/test the environment
   and **Republish** it. Start a new task from the published version while keeping
   the current task/data available until its first real remote backup is verified.

The exact issuer/claims, connection availability, Google owner consent and reviewed
network change cannot be completed by this status-only agent. These steps are a
prepared owner procedure, **not a claim that the connection or bucket exists**.
The setup script has scoped failure tests; actual Google configuration remains
unexecuted until the owner performs it. Account setup can still reveal a genuine
upstream site challenge; collectors must report that rather than claim freshness.

After access is available the agent owns verification: inspect current enforced
policy/identity; prove actual fresh source retrieval and processing; full GET/LIST
capture including draft roots; resolve relationship gaps only with evidence;
rehearse exact verified changes in emulators; upload/read back private artifacts;
recover from remote objects in an empty task; run both saved-state browser checks.
Use IAM permission inspection to prove no database writer, never a test production
write. BZE-323 remains **In Progress** until these live proofs pass. Independent
review and change-specific publication approval remain separate from account setup.

References: [Codex environment settings and OIDC](https://learn.chatgpt.com/docs/environments/cloud-environments),
[Google federation](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-other-providers),
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
until their actual access and data-quality gates pass.
