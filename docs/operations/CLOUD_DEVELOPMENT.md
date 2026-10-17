# ScoutZero cloud development

Use this workflow for ordinary implementation, browser inspection, focused tests,
and safe saves on any feature. It does not depend on draft-pick publication or
BZE-321. No production-write credential is needed.

## Supported executor

The managed ScoutZero cloud workspace has Node 24, Java 21, Chromium, application
dependencies, compiled Functions, and a protected NBA snapshot. The repository
and snapshot were recovered in a fresh cloud session on October 16, 2026
(Detroit). Check live GitHub state at every handoff. Local `origin/main` can be
stale in the environment image; fetch it before drawing ancestry conclusions.

The repository is public; NBA snapshots, browser profiles, emulator exports,
and detailed failure evidence must stay in private workspace storage. Never
commit or upload `.scoutzero-dev/` to public Actions artifacts. This directory
is ignored, including its tool installation and emulator-only authentication.

For another trusted Linux cloud executor, install Node 24 and Java 21, clone
the assignment's actual repository/ref, then run `npm run cloud:setup`. It
installs the locked application dependencies, builds existing Functions, pins
Firebase CLI 14.12.1 separately, and installs Chromium if needed. System package
installation may need the executor's normal administrative capability. Existing
Vercel deployment and Firebase production settings remain unchanged.

## Start, inspect, change, test

In the configured managed workspace:

```bash
cd /workspace/scoutzero
npm run cloud:data:import -- /workspace/.data/scoutzero-source/current
npm run cloud:dev
```

The default CLI lives under `.scoutzero-dev/tools/firebase/`. To reuse a known
compatible installed CLI, set `SCOUTZERO_FIREBASE_CLI` to its absolute binary
path. Use `npm run cloud:setup -- --check` to check installed prerequisites.
Set `XDG_CONFIG_HOME` and `FIREBASE_EMULATORS_PATH` to writable workspace/cache
directories if the managed executor restricts home-directory writes.

The launcher starts Firestore, Auth, existing Functions and Vite at loopback
ports 8082, 9099, 5001 and 5173. It waits for Functions definitions and the app,
refuses occupied ports, and never kills another assignment's listeners. The
application uses `demo-architect-review` and the real copied NBA data, without
the tiny synthetic review seed or a production account. The existing review
launcher remains useful for deterministic synthetic Architect diagnostics.

Use Playwright or the executor's browser on `http://127.0.0.1:5173`. Edit actual
application files normally; Vite reloads them. Choose scoped checks from
AGENTS.md. The reusable non-draft demonstration is:

```bash
npm run cloud:check
```

It follows authenticated navigation to Players, searches for LeBron James,
adds him to a new List, saves, reloads and screenshots the result at 1280×720.
It rejects a tiny fixture dataset and blocks every browser request outside
the declared loopback services. Evidence stays private in `.scoutzero-dev/`.
For exploratory inspection, use the same existing application routes and
emulator-only authentication; this check is one example, not a feature-specific
environment.

## Stop and resume

Send SIGTERM or Ctrl-C to the launcher, not its Java process group. Vite stops
first, then Firebase exports Firestore and emulator Auth into
`.scoutzero-dev/state/`. The pinned CLI honors NO_PROXY; CLI 15.32.1's API client
ignores it and fails localhost hub/export requests behind the managed proxy.

Restart `npm run cloud:dev`, then run:

```bash
npm run cloud:check -- --resume
```

This restores the private emulator-only browser state and saved list, verifies the
source fingerprint, and checks reload again. Saved state is tied to its source
snapshot; importing another source requires preserving the old state and an
explicit reset. Stop services first and move `state/`, `state-source.json`,
`proof.json` and `browser-state.json` into private recovery storage.
Restart to seed a clean copy. Never substitute production user content.

Auth emulator imports expire pre-import login tokens. Recovery verifies that
the saved UID still exists in the imported local accounts, then uses the Admin
SDK's emulator signer to reauthenticate that same UID before mounting the app.
It never creates a missing account or uses a real signing key. The browser
helper rejects production builds, non-demo projects and nonlocal Auth/Firestore
endpoints. Its transient emulator token is neither logged nor retained as an
account credential. The refreshed browser state stays private. This is emulator
session recovery, not a hosted Firebase authentication result.

Before ending an assignment, commit/push authorized code, record the exact ref,
validation and remaining issues in the assignment's GitHub/Linear record, stop
the launcher cleanly, and retain the private workspace state. A new agent reads
AGENTS.md and the assignment, fetches its ref, checks the snapshot coverage and
starts the same command. GitHub holds code; the protected cloud environment
holds source and isolated runtime state. A git clone alone does not recover
untracked local files or a private snapshot.

## Source coverage and refresh

`cloud:data:import` verifies the original export's project, SHA-256, document
count and collection counts. It preserves Firestore typed values and the
player/contract/season hierarchy. It excludes legacy root `teams`, source
evaluations, personal overlays, accounts, lists, rosters and saved worlds.
Coverage records source time, missing roster relationships, entitlement
membership, denied reads and unobserved child collections. No data is repaired
or invented during environment startup.

The retained October 3 export contains 677 player roots, 676 base players,
30 base teams, 658 entitlements, 1,292 contracts and 718 seasons. The reusable
copy has 4,051 documents. It has **zero base pick rules**, **zero teams with
entitlement membership**, 23 missing base-player roster references and no
captured `views` hierarchy. The browser renders 673 of the 677 raw player roots
through the existing loader. These are data gaps, not complete NBA or
draft-pick correctness claims. Freshness remains October 3 until a verified
refresh succeeds.

`npm run cloud:data:refresh` reads only the fixed source collections and
contracts/seasons/views descendants with GET requests. It does not acquire
authentication or grant permissions. Where those collections need IAM access,
run `npm run cloud:data:refresh -- --gcloud` in an already-authorized cloud
executor; it uses an existing short-lived Google login without saving its token
or creating keys. A complete protected refresh still requires an observed,
authorized reader. Do not interpret denied reads as empty collections or claim
that the current managed workspace has Google IAM credentials configured.
Denied root/child reads or empty required collections leave the existing
snapshot untouched and retain a private failed-refresh coverage report.

No source credential, writer role, Preview bypass, production rules deployment,
or production import is part of ordinary development. BZE-321's installed
application data must be retained. Its one-use credentials and publication
grants remain subject to its existing cleanup gates. Do not retire currently
used Preview trust until its separate hosted workflow has a verified scoped
replacement; the loopback workflow here does not need that trust.

## Known application limits

Cold-loading `/players` against the repository's authenticated source rules can
race Auth initialization; use the existing authenticated Lists → Players
navigation while working. The recovered LeBron profile also has pre-existing
contract-schema failures. Neither has been silently repaired or counted as a
passing workflow. Hosted Vercel behavior and production-data correctness remain
distinct from the emulator demonstration.

The shared anonymous sign-in request is now coalesced across mounted consumers.
Previously, concurrent consumers could create competing sessions and cause
owner-scoped list reads to fail during startup. Focused concurrency, failure
settlement and retry tests cover the repair; Firebase remains the auth provider.
