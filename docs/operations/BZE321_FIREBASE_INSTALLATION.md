# BZE-321: bounded Firebase installation

Status: revised no-Storage candidate; no production installation or merge readiness.
Owner authorization covers preparation/review, not new production IAM grants.

## Verified production state

The assumed `scoutzero-bf1ae.firebasestorage.app` bucket **does not exist**.
Google Storage returned HTTP 404 / `notFound`, including in the authenticated
inspection run. Do not enable billing, create a bucket, or grant Storage access.
Earlier Storage setup instructions and installation-generation variables are
superseded by this document.

[Inspection 38176121374](https://github.com/Bet-Zero/scoutzero/actions/runs/38176121374)
passed protected-environment verification and keyless Google authentication.
The already-trusted worker captured the live rules twice and reached the bucket
check only after completing the Firestore reads. The job then failed at that
unrelated bucket check, but retained encrypted rules evidence successfully.
The revised inspector removes that check entirely. Its CLI regression proof
forbids every Storage request and every non-GET request.

Retained snapshot digest:
`bc93ddc039576e84037826e6d9cc8eb51bff8bd17c3a30a22bfd8efcab8fe61d`.
Production rule digest:
`dbb7133b279d7b5634aef959c70372ed4e5da4a7ea7d26fbf6d9134ecbee31de`.
Ruleset: `projects/scoutzero-bf1ae/rulesets/18da078f-7dd8-40eb-b1c4-3d2957a5c5c5`.
The encrypted artifact was independently downloaded and decrypted; both digests
were checked. Plaintext evidence and its decryption key remain outside Git under
`/workspace/bze321-private/`. Public logs/artifacts contain no plaintext rules.

### Actual mismatch and preservation

Production allows public reads of base teams, base players, and all `players_v2`
descendants. It allows authenticated owners to create validated worlds, update
their metadata, and create/update world teams and players; deletion is denied.
Unmatched collections are denied. The repository would instead restrict source
reads to authenticated sessions, disable client world creation, change world
write conditions, and add many currently absent collection permissions.
Replacing production with the repository file would change existing behavior.

The installation therefore uses the **actual live source plus one fixed
`REVIEW_RULE_ADDITION`**, not `firestore.rules`. Removing that exact addition
reproduces every baseline byte. No existing permission is removed or broadened.
The addition permits authenticated exact-document reads of the derived release
and its four parts; client lists and writes remain denied. No broad live grant
conflicts with that restriction. Fifteen emulator checks of existing public,
world-owner, non-owner, update and denied-delete permissions returned identical
results for baseline and candidate. Five existing release permission/integrity
tests passed against this candidate with the real 278-record release and all
29 unresolved requirements. These are emulator results, not hosted GM proof.

## Transfer through existing GitHub, without Google Storage

Use GitHub's documented
[encrypted-file approach for large secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets#storing-large-secrets).
Only `.github/bze321-installation.json.gpg` is committed. It contains the already
prepared five documents, the exact live baseline and the tested additive rules.
This is an installation input, never an application data provider. Runtime still
reads the authenticated Firestore release through ScoutZero's existing endpoint.

The random 384-bit decryption passphrase is kept outside Git and outside chat.
Set it only as `BZE321_INSTALLATION_PASSPHRASE` in the protected
`draft-review-publication` environment. It is not a Google credential and grants
no cloud access. The worker passes it on stdin to GPG, never on the command line;
it decrypts into bounded memory, does not log input/provider bodies, validates
the approved plaintext digest, and removes its temporary GPG directory. No
plaintext input is uploaded as an artifact. Inspection receives no passphrase.
The encrypted input is part of the immutable reviewed worker checkout, so an
application/caller commit cannot substitute it.

Protected publication variable `BZE321_APPROVED_INSTALLATION_SHA256`:
`9fcc427f7fdf45b12b06ad2c6da2f798b2aa39dc8b4d70a8f3576d60515921f0`.
The former `BZE321_INSTALLATION_GENERATION` is unused and unnecessary.
Local GPG and actual reader proofs verified exact recovery of all five documents,
wrong-key rejection and wrong-digest rejection without any network requests.

The current GitHub integration cannot administer environment secrets (HTTP 403
on its environment public-key endpoint). One owner browser secret entry is the
remaining secure transfer connection. Never paste the passphrase into chat,
a PR, a repository variable, logs or a repository file. Retire the environment
secret after successful installation and verification; retain private recovery
evidence under the existing policy.

## One bounded execution path

### Protected secret handoff

The first approved publication attempt authenticated to Google but stopped before
any Firestore/Rules request because the passphrase was empty. The caller omitted
the reusable-workflow secret handoff. GitHub requires that handoff even when the
secret exists only in the called job's protected environment; see
[GitHub's reusable workflow secret contract](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows#using-inputs-and-secrets-in-a-reusable-workflow).

Publication now passes only `BZE321_INSTALLATION_PASSPHRASE` to a SHA-pinned,
step-free reusable handoff. That handoff declares the one required secret and
forwards its restricted secret context to the unchanged immutable worker. The
existing worker does not declare named caller secrets, so this intermediate
contract permits scoped forwarding without inheriting unrelated repository
secrets or changing Google's trusted executor. Inspection receives no secrets.
The worker still selects the protected environment, checks its approval settings,
and performs the same digest, permission, baseline and create-only checks. Neither
the secret nor a Google credential is exposed through outputs or artifacts.

The earlier tests and review checked environment protection and local decryption
but missed the caller-to-worker secret contract. The workflow regression now
checks both handoff edges, the sole allowed secret, inspection isolation, pinned
executor, and the absence of executable steps in the intermediate workflow.
These checks do not claim live delivery: the next owner-approved run must prove
decryption and installation on GitHub's runner.

1. Finish exact-candidate CI and focused independent Claude acceptance of the
   changed transport and actual-rules reconciliation. Reuse unchanged app and
   release evidence. The candidate is not authorized by its tests alone.
2. Keep the already-configured dedicated environments. Both restrict the exact
   feature branch and forbid administrator bypass; publication requires Bet-Zero
   (user ID `205859440`). Before cloud authentication the worker checks these
   protections. Exact branch identity is also required by immutable code and
   Google's attested claims. Existing Production environment is untouched.
3. After acceptance, apply the reviewed worker revision to the existing Google
   provider condition, preserving repository IDs, exact branch/event,
   environment/subject and immutable `job_workflow_ref` / `job_workflow_sha`.
   This is a change to deployment code, not another application-commit pin.
   The inspection run above used the already-saved trust without any Google edit.
   Do not activate a changed worker until its review passes.
4. With explicit owner permission, configure the separate publisher role below,
   the protected input secret/digest, and approve the publication run. Reserve a
   short window with no other administrator deploying Firestore rules.
5. The fixed worker decrypts/validates the input, verifies all eight project
   permissions through non-mutating `testIamPermissions`, checks the exact live
   baseline, and tests release permissions with the Rules API. Only then does it
   create the additive ruleset, recheck/repoint the existing release, and atomically
   create the five absent records with `currentDocument.exists: false`.
6. Verify the installed rules and exact record bytes. Prove hosted authentication,
   GM read/review, denied/failure states and preserved existing functionality.
   Complete normal landing gates only after live proof. Keep Apply disabled.

No rules API compare-and-swap exists. The worker checks before/after and GitHub
serializes this worker, but an exclusive administrator deployment window remains
necessary. It never blindly rolls back rules, overwrites conflicting documents,
alters source collections, or changes saved worlds.

## Exact permissions; no Storage role or billing requirement

The existing inspection identity stays read-only with the first four permissions.
The separate proposed publisher `scoutzero-draft-publish@scoutzero-bf1ae.iam.gserviceaccount.com`
needs all eight, using custom project role `scoutzeroDraftPublisher`:

| Operation                        | Permission                        |
| -------------------------------- | --------------------------------- |
| Inspect database                 | `datastore.databases.getMetadata` |
| Read fixed records               | `datastore.entities.get`          |
| Read active rules release        | `firebaserules.releases.get`      |
| Read exact rules source          | `firebaserules.rulesets.get`      |
| Create absent records atomically | `datastore.entities.create`       |
| Test candidate rules             | `firebaserules.rulesets.test`     |
| Create immutable ruleset         | `firebaserules.rulesets.create`   |
| Update existing rules release    | `firebaserules.releases.update`   |

Each service account's `roles/iam.workloadIdentityUser` binding uses only its
own environment-specific principal. Preserve the removal of the old broad
repository binding. The generated `.github/draft-review-connection.json` lists
the full condition, bindings and required APIs. No Storage API/role, IAM admin,
Token Creator, entity update/delete/list, new database or service-account key
is required. Firestore IAM read/create permissions are database-wide; the
immutable worker and protected approval restrict actual access to the five
release paths. That limitation still requires explicit acceptance, not an
unannounced permission expansion.

## Remaining hosted verification gate

The report-publication prerequisite was repaired separately in
[PR #548](https://github.com/Bet-Zero/scoutzero/pull/548), with green CI and a
published independent ACCEPT. Public synthetic controls reproduced native
withholding of invalid token-shaped examples. Review reports now cite fixtures
by file/line and pass an additional fail-closed safety check before the unchanged
GitHub filter. No historical withheld report was recovered. The first fresh
PR #547 review must verify the new check against the real pinned action; #548's
acceptance does not accept the hosted implementation or replace hosted proof.

The temporary public control workflow has been removed after its two retained
runs. It used no real credentials, private evidence, or production writes. The
hosted workflow now schedules each candidate push, so a docs/review-only change
cannot leave the pending browser proof bound to an older candidate. Protected
approval remains mandatory.

The localhost Chromium redirect probe runs separately with
`npm run test:hosted-review-browser` in both PR and main CI. An earlier concurrent
full-suite run timed out that browser test; its real redirect assertions remain
mandatory, with explicit launch/navigation deadlines and complete fixture cleanup.
The four pure request-policy checks remain in the ordinary Node/Vitest suite.

Installation run `38195972300`, attempt 2, verified the rules, release and all
five documents. Do not repeat publication. Vercel access works when the connector
calls omit `teamId` and `slug`; the earlier reconnection recommendation was wrong.
The Codex network policy blocks the preview, and the owner reports that the
environment editor is broken. An allowlist edit is not an actionable next step.

The prepared `bze321-hosted-review.yml` runs the browser on GitHub Actions. It
reuses the protected `draft-review-publication` approval environment but does not
receive its secrets, call Google deployment APIs, or run publication code. It
finds the Vercel Preview deployment for its exact commit and uses short-lived
GitHub OIDC in an origin-scoped header. No public share URL or static bypass key
is used. Vercel Authentication remains enabled.

Before running, a separately approved, additive Vercel Trusted Sources entry is
required. Target **preview only** and require all these exact claims:

| Claim                 | Required value                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| Issuer                | `https://token.actions.githubusercontent.com`                                                                  |
| `aud`                 | `https://github.com/Bet-Zero`                                                                                  |
| `repository_id`       | `997820257`                                                                                                    |
| `repository_owner_id` | `205859440`                                                                                                    |
| `repository`          | `Bet-Zero/scoutzero`                                                                                           |
| `ref`                 | `refs/heads/feature/bze-321-hosted-draft-review`                                                               |
| `sub`                 | `repo:Bet-Zero/scoutzero:environment:draft-review-publication`                                                 |
| `workflow_ref`        | `Bet-Zero/scoutzero/.github/workflows/bze321-hosted-review.yml@refs/heads/feature/bze-321-hosted-draft-review` |

Use Vercel Settings → Deployment Protection → Trusted Sources → External
Services → GitHub Actions, with **Edit raw claims** for the workflow constraint.
Preserve all existing entries. The connector's project summary does not expose
the existing trust list, so it cannot safely perform a replacement update.
This is a pending access authorization, not an already-installed rule.
See [Vercel Trusted Sources](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources).

The proof loads real picks without seeding a world, checks the immutable response
digest and 278/29 accounting, the rendered review, missing/invalid application
authentication, unavailable service, canceled selection and reload. Firestore
writes and application POSTs are blocked. A missing live pick fails the proof;
an emulator fixture cannot substitute for it. Only newly created anonymous Auth
accounts are removed after testing. No screenshots, traces, session material or
NBA response bodies are uploaded to public Actions artifacts or logs.

Preparation is not hosted proof. Merge and the documented installation-access
cleanup remain gated on the actual successful hosted run. Retire this temporary
preview trust entry after verification; preserve the installed release and rules.
