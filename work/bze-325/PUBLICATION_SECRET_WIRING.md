# BZE-325: dedicated publication-secret forwarding repair

Owner-approved production attempt `39203681857` stopped in `prepare` on
October 19 with the dedicated secret empty. Google authentication and execute
were skipped; no production data changed. This establishes the actual failure,
not that the owner's saved secret is absent. Secret metadata APIs return 403.

The caller omitted secret forwarding and the worker omitted its callable secret
declaration. GitHub's current [reusable-workflow documentation](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows#using-inputs-and-secrets-in-a-reusable-workflow)
explicitly states that an unpassed environment secret resolves empty. The
official source is `github/docs`,
`content/actions/how-tos/reuse-automations/reuse-workflows.md`, lines 75–82.

## Discriminating evidence for the first review

Initial review `39315415159` returned REVISE because its read-only checker could
not fetch the documentation and recalled the older, contrary secret behavior.
The following is the actual passage at immutable official docs commit
[`82606008906b649d65bdec014c1b6b0050e38fb8`](https://github.com/github/docs/blob/82606008906b649d65bdec014c1b6b0050e38fb8/content/actions/how-tos/reuse-automations/reuse-workflows.md#L75-L82),
retrieved by the author through GitHub's contents API at that exact ref:

> The caller workflow must still pass the secret. Use `secrets: inherit` or pass
> the secret by name, for example `MY_SECRET: ${{ secrets.MY_SECRET }}`. You can
> pass a secret by name even if it only exists in the environment.
>
> If an environment secret has the same name as a repository or organization
> secret, the environment secret takes precedence. This applies when the caller
> uses either `secrets: inherit` or `${{ secrets.MY_SECRET }}`. The job that sets
> `environment` receives the environment secret's value.
>
> If the caller workflow doesn't pass an environment secret, the secret resolves
> to an empty string in the reusable workflow.

Intended storage is **environment-only**, in `nba-maintenance-publication`.
The owner reported saving it after the environment-secret form instructions.
The author cannot independently list that store (403), does not assert verified
storage, and does not request a repository-secret copy. The quoted documented
behavior explicitly covers environment-only storage and resolves the reviewer's
concern about the caller lacking its own environment.

Actual retained ancestry/diff checks: `git merge-base --is-ancestor
b4a5b98bd3fee009309d495b96980b557173cc26
8803ac18bd8f12d13e299caa8d9412da6ff9ab35` exits zero; `git diff --stat` between
those commits shows exactly `.github/workflows/nba-maintenance-worker.yml`,
four insertions. Its full diff consists solely of the callable secret declaration
shown above. All runtime and lockfile bytes are identical to that accepted base.

There is no successful delivery receipt yet. The existing **prepare** step is
the non-mutating delivery canary: successful output is `protected: true`,
`operation: publish`, `productionWriteAuthorized: false`, only after actual
decryption and exact-plan/receipt validation. It runs before Google authentication
and cannot write Firestore. The repaired workflow adds `prepare_only: true` for
this discriminating check: both Google authentication and execute have explicit
false conditions, regardless of the provider's trust state. The default remains
false for the existing normal access/publication path. After reviewed landing,
first dispatch the exact plan with `operation=publish` and `prepare_only=true`.
The owner approves the existing environment gate, and the run must finish green
with actual package validation and both authenticated steps skipped. Only after
that actual delivery proof may the owner replace the Google trust pin and approve
a normal publication retry. This explicitly separates review of the
documented wiring repair from actual delivery/readiness acceptance. No secret
value, length or source content is logged. A canary failure stays a blocker.

The repair declares and forwards only `BZE324_MAINTENANCE_PASSPHRASE`, with no
broad secret inheritance. The declaration is optional so the non-mutating access
operation needs no package secret. The existing worker steps still expose the
value only to publish preparation/execution, with a fixed dedicated environment,
owner-only deployment approval, no admin bypass and main-only execution.

Final immutable worker: `655780bce4b6fb0ae20d5a723461ff6807887668`.
Its worker-file diff against accepted main is the four-line callable declaration
plus six lines for the optional preparation-only input and two authentication/
execute conditions. Runtime and lockfile are identical to accepted main; other
differences are the bounded caller/test/doc repairs and previously accepted main
registration. The caller pins the exact new commit. No source, proposal, ciphertext,
approval/expiry, role, permission, draft trust or basketball fact changes.

Actual focused checks: `npm run test:cloud-dev`, `npm run cloud:typecheck`,
`git diff --check`; the new parsed-YAML check tests the singleton secret mapping,
callable declaration, protected environment and publish-only consumption. These
checks also require preparation to run unconditionally and both authenticated
steps to be skipped for the preparation-only canary. These
checks do not substitute for actual GitHub secret delivery. Exact-head independent
review, hosted checks, normal landing and actual protected execution remain gates.
Prior factual, full-plan emulator/recovery and browser evidence is reused.

## Smallest owner-only trust update after reviewed landing

Open <https://console.cloud.google.com/iam-admin/workload-identity-pools?project=scoutzero-bf1ae>.
Choose pool `scoutzero-bze321`, provider `github`, **Edit provider**, then
**Attribute conditions**. Replace only the two ordinary publisher occurrences of
`372c52e453a057fe1713d0e9d3e181829a381688` with
`655780bce4b6fb0ae20d5a723461ff6807887668`, then save.
They are `assertion.job_workflow_ref` and `assertion.job_workflow_sha` in the
ordinary NBA clause. Preserve every other character, including draft trust,
repository/main/caller/environment restrictions. If the old value is not present
exactly twice, stop for inspection rather than adding a permissive clause.

This replaces the exact reviewed worker allowed to impersonate the existing
minimal NBA publisher. It adds no role or permission and leaves the 600-second
token and 10-minute job limit intact. No personal admin identity enters Codex.
Keep the already saved dedicated secret; it needs no new transfer or rotation.
Codex queues only the unchanged approved plan; the owner approves the protected
deployment after saving this trust update. Its prepare step must show successful
exact-package validation before Google authentication; execute repeats validation
and the actual access probe before conditional writes. Full coherent readback
of all 777 groups and subsequent consumer checks remain required for completion.
