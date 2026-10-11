# BZE-321: bounded Firebase installation

Status: prepared for independent security review, not installed or merge-ready.
The owner authorized workflow implementation/review, not an automatic IAM upgrade.

## One execution path

1. Accept the frozen worker through existing CI and independent Claude review.
   `.github/workflows/draft-review-cloud.yml` calls the reusable worker by full
   commit SHA. Google also requires that exact `job_workflow_ref` and
   `job_workflow_sha`, repository/owner IDs, branch, push event and environment.
   Application commits can change without changing Google trust. Changing worker
   code requires a new security review and trust update; that restriction remains.
2. Configure the two protected GitHub environments and the scoped Google trust
   below. Do not expand the existing inspection account's permissions.
3. Run inspection without a per-run owner approval; the pinned read-only identity and branch restriction govern it. It performs two GET-only reads
   of database identity, live rules and the five document paths, checking stable
   rules identity/content and the existing bucket’s support for conditional access. Unknown rules are retained rather than discarded.
   Only an OpenSSL CMS encrypted snapshot is uploaded to the public repository's
   Actions artifacts (seven-day retention). The snapshot includes the actual
   production rules and repository comparison input. Its plaintext digest is in
   the run receipt. The evidence-decryption key is retained privately outside Git
   at `/workspace/bze321-private/inspection-key/key.pem`; it is not a Google
   credential and confers no service access. Preserve it until the snapshot is
   decrypted and retained in existing private evidence. If unavailable, stop;
   never publish the plaintext snapshot as a recovery shortcut.
4. Codex compares the exact live rules with the repository, reporting actual
   permission differences. Prepare a candidate by inserting only the fixed
   `REVIEW_RULE_ADDITION` from `draftReviewInstallation.ts` into the appropriate
   document scope. Every existing byte must remain unchanged. If an existing
   grant conflicts with release privacy, stop for the specific permission choice;
   do not delete that grant or add an ineffective deny override. Rules allow
   expressions are additive. A missing/ambiguous insertion point also stops.
5. Reuse the existing emulator proof with `SCOUTZERO_DRAFT_REVIEW_RULES` pointing
   to the privately retained candidate and `SCOUTZERO_DRAFT_REVIEW_RELEASE` to the
   accepted release. Validate existing permission differences with focused probes
   selected from the actual diff. Obtain focused independent acceptance of the
   reconciliation; no repeat review of unchanged application foundations.
6. Prepare one private JSON object with `baselineRuleset`, `baselineRules`,
   `proposedRules`, and the already-prepared five `documents`. Store it at the
   existing bucket object `bze321/approved-installation.json`, without overwriting
   an existing generation. Pin its Storage generation and exact byte SHA-256 in
   the publication environment variables below. No raw evidence is product data;
   this object is installation input, not another application source of truth.
7. Only after review, explicit permission authorization and publication approval:
   read/verify that object, verify current production baseline, run the Rules API
   permission tests, create the candidate ruleset, recheck the baseline, update
   only the existing `cloud.firestore` release, verify it, then atomically create
   the five absent documents using `currentDocument.exists: false`. Verify their
   full bytes and installed rules afterward. A retry recognizes the exact approved
   rules and complete matching data. It never changes conflicting records.
8. Prove real hosted GM authentication/read/review, denied unsigned/invalid
   sessions, integrity failures and preserved existing functionality. Keep Apply
   disabled. Complete normal landing gates only after live proof.

The Rules Releases API has **no conditional update / compare-and-swap field**.
The publication approval must reserve a short rules-deployment window with no
other Console/CLI publisher. GitHub concurrency serializes this worker only.
The worker checks before/after but cannot prevent another administrator racing
the update. It never blindly rolls rules back over another publisher's change.

## Consolidated owner setup, after worker acceptance

No Google action has been performed by this implementation. The exact generated
configuration will be retained in `.github/draft-review-connection.json`, using
the worker revision invoked by the caller. Review that receipt before applying.

### GitHub approvals

Open repository **Settings → Environments** and create `draft-review-inspection`
and `draft-review-publication`. For both, restrict deployment to the selected branch below. Publication additionally requires the owner reviewer:

- Publication required reviewer: **Bet-Zero** (user ID `205859440`). Inspection needs no per-run reviewer.
- Disallow administrators bypassing protection.
- Deployment branches/tags: selected **branch**
  `feature/bze-321-hosted-draft-review`, no wildcard/tag rule.
- Leave self-review prevention off: the sole owner may initiate a run and approve
  it. This is the production authorization gate; Claude remains the independent
  code reviewer. No claim of two-human approval is made.

The worker verifies the appropriate settings before Google authentication; missing or
unreadable protection fails closed. The existing Production environment is not
modified. Its inspected configuration had no protection rules/branch policy.
Attempting to create the dedicated environment through the current GitHub
connection returned HTTP 403 (`Resource not accessible by integration`), so this
specific browser action requires the owner, not a general credential expansion.

Leave publication variables unset until the exact rules/input have passed review:

- `BZE321_INSTALLATION_GENERATION`: immutable Storage object generation.
- `BZE321_APPROVED_INSTALLATION_SHA256`: exact private installation JSON digest.

The five-document upload also needs an authenticated uploader. No agent upload
permission currently exists. The bounded fallback is an owner Console upload of
the exact reviewed private object; do not grant Storage Admin or expose its URL.

### Google trust and permissions

In project `scoutzero-bf1ae`, edit the existing pool/provider
`scoutzero-bze321/github` using the generated mapping/condition. This replaces
the caller-commit restriction with an equally immutable called-worker restriction
plus protected environment identity. Never replace it with branch-only trust.
Keep the existing issuer `https://token.actions.githubusercontent.com`.

The existing account `scoutzero-draft-release@scoutzero-bf1ae.iam.gserviceaccount.com`
stays read-only. Replace its repository-wide pool impersonation binding with the
generated inspection-environment member. Preserve unrelated IAM bindings.

For publication, create the separate account
`scoutzero-draft-publish@scoutzero-bf1ae.iam.gserviceaccount.com` only after explicit
owner approval of these permissions. Bind `roles/iam.workloadIdentityUser` on that
account only to the generated publication-environment member. No service account
keys, IAM administration or project-wide Token Creator grants are required.

| Operation                                | Required permission               |
| ---------------------------------------- | --------------------------------- |
| Inspect existing database                | `datastore.databases.getMetadata` |
| Read the five documents                  | `datastore.entities.get`          |
| Read active rules release                | `firebaserules.releases.get`      |
| Read exact active rules source           | `firebaserules.rulesets.get`      |
| Atomically create absent documents       | `datastore.entities.create`       |
| Test proposed rules                      | `firebaserules.rulesets.test`     |
| Create immutable ruleset                 | `firebaserules.rulesets.create`   |
| Point existing release to tested ruleset | `firebaserules.releases.update`   |
| Fetch installation object                | `storage.objects.get`             |

The first four form the existing inspection role. Inspection additionally needs a bucket-only `storage.buckets.get` metadata binding to verify that the existing bucket supports conditional IAM. It does not read bucket objects. If uniform bucket-level access is disabled, stop; do not enable it and change existing ACL behavior as a workaround. The publisher needs all eight
Firestore/Rules permissions in a separate custom project role, plus a separate
bucket binding granting only `storage.objects.get`, conditioned on:

```text
resource.name == 'projects/_/buckets/scoutzero-bf1ae.firebasestorage.app/objects/bze321/approved-installation.json'
```

No entity update/delete/list, bucket write/list, database creation, API enabling,
rules release creation/deletion, source pipeline or saved-world mutation is used.
Firestore IAM cannot restrict entity permissions to five document paths. The
fixed, pinned worker additionally enforces those paths and create-only writes.
That limitation must be accepted explicitly; it must not be misrepresented as
collection-scoped IAM. Inspect/read rights likewise are database-wide in IAM.

### Hosted verification access

The connected Vercel account returned no teams; the exact ScoutZero project lookup
returned 403 for `brents-projects-686e97fc`. No Vercel CLI or configured credential
is available in this environment. The required owner action is to connect the
Vercel integration with an account that can access that team/project. Browser
dashboard access alone does not authorize the connector. Do not disable deployment
protection, transfer the project, or add another hosting/data provider.

## Evidence and limits

Author tests cover fixed identity, protection fail-closed behavior, retained drift,
additive source preservation, input hash/generation, fixed create-only paths,
permission failures, concurrent drift, conflicts and safe retries. Emulator proof
covers the actual new addition against the repository baseline using the private
release. This is **not** a comparison with the still-unretrieved production rules.
Current access cannot run the new worker until its one-time trust/protection setup.
No claimed hosted functionality or merge readiness follows from local/CI tests.

Underlying references:
[GitHub reusable-workflow OIDC](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-with-reusable-workflows),
[Firestore method permissions](https://firebase.google.com/docs/firestore/security/iam),
[Firebase Rules permissions](https://firebase.google.com/docs/projects/iam/permissions),
[Rules release update API](https://firebase.google.com/docs/reference/rules/rest/v1/projects.releases/patch).
