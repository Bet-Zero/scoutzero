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

The repair declares and forwards only `BZE324_MAINTENANCE_PASSPHRASE`, with no
broad secret inheritance. The declaration is optional so the non-mutating access
operation needs no package secret. The existing worker steps still expose the
value only to publish preparation/execution, with a fixed dedicated environment,
owner-only deployment approval, no admin bypass and main-only execution.

Immutable worker: `8803ac18bd8f12d13e299caa8d9412da6ff9ab35`.
It differs from the current main base only by the four-line callable declaration.
Publisher runtime and lockfile match the prior executor; other differences are
the already reviewed caller pin, operational notes and release registration
inherited from main. The caller pins the exact new commit. No source, proposal, ciphertext,
approval/expiry, role, permission, draft trust or basketball fact changes.

Actual focused checks: `npm run test:cloud-dev`, `npm run cloud:typecheck`,
`git diff --check`; the new parsed-YAML check tests the singleton secret mapping,
callable declaration, protected environment and publish-only consumption. These
checks do not substitute for actual GitHub secret delivery. Exact-head independent
review, hosted checks, normal landing and actual protected execution remain gates.
Prior factual, full-plan emulator/recovery and browser evidence is reused.

## Smallest owner-only trust update after reviewed landing

Open <https://console.cloud.google.com/iam-admin/workload-identity-pools?project=scoutzero-bf1ae>.
Choose pool `scoutzero-bze321`, provider `github`, **Edit provider**, then
**Attribute conditions**. Replace only the two ordinary publisher occurrences of
`372c52e453a057fe1713d0e9d3e181829a381688` with
`8803ac18bd8f12d13e299caa8d9412da6ff9ab35`, then save.
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
