Fixes the late #554 staging and foundation defects: bulk staging now forwards season/as-of/private paths into the shared single-player implementation, and `build:foundation` supplies one dated generation to the existing IDs/bios/index builders, stopping at the first failure.

Replaces local production ADC with a separate protected immutable GitHub Actions/WIF worker using the existing BZE-321 pattern. The ordinary account has only entity get/create/update; required-owner/main-only/no-bypass protection and exact registered qualified/reviewed/approved plans are checked before Google access. The registry stays empty. The dedicated encrypted-input handoff has real GPG recovery proof. Existing draft accounts, pinned executors, approvals, source qualification and first-round Apply boundaries are unchanged.

Validation: recovered real Luka inputs produce identical single/bulk stage outputs; scoped cloud suite, root/cloud typechecks, project/docs checks and actual GPG recovery passed. Prior actual emulator/browser/restart and real-input publication/recovery proofs from #554 remain unchanged in scope. No full-league scrape or production data write; the 73-file archive was uploaded/recovered only through private Linear, never GitHub/CI.

Gate A remains open until live bounded access is configured and verified. GitHub environment creation returned integration 403; `work/bze-324/PUBLISHER_ACCESS.md` gives exact owner GitHub/Console setup, without attaching an admin identity to Codex. Independent review and exact-head CI are recorded below before normal landing.

Refs BZE-324
