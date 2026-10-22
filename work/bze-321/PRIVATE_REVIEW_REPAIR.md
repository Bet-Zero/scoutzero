# Private reviewer tool repair — October 21

## Recovered original and failed gate

Owner-approved private run `39554620116` verified the actual delivered five
protected inputs and completed the independent session. The result step correctly
failed with `PRIVATE_REVIEW_TOOL_DENIED_REPORT_RETAINED`: six Bash attempts were
denied. Its internal ACCEPT is diagnostic only and cannot satisfy qualification.
No source publication ran. Do not replay that verdict as acceptance.

The owner-returned original ZIP was recovered through existing private BZE-321
attachment `9732f285-a547-4eb9-b719-688e30c27db4`, without a second upload.
All 15,926 bytes match artifact `12325961156`, ZIP SHA-256
`ec3824a9a5e43f1a1884450ae34c312ca67a7079502b0f121c43e9673f4a9d0c`.
The sole bounded regular-file member is `source-private-review.cms`.
Decryption with the retained separate inspection key matches the worker's complete
plaintext SHA-256
`45e7a3dabdbe59fc2493aed8b2f89786202d9bb2093d9b169ee3b964586986e2`.
Candidate, run, source and evidence bindings match the expected receipts.
The complete original result and findings were inspected privately. No plaintext
report, source, Rules or key is committed.

## Objective repair and review scope

The denied commands attempted HTML parsing and before/after diffs. `allowedTools`
preapproves permitted tools but did not remove Bash from the model's tool list.
Add `--tools "Read,Glob,Grep"` alongside the existing allowlist to expose only the
three permitted built-ins. The pinned action's `parse-sdk-options.ts` passes this
CLI option through `extraArgs`; its existing credential/action pin is unchanged.
No execution permission is added. All result, tool-denial, schema, exact-candidate,
owner-approval, encryption and public-review gates remain unchanged.

Generate a private `field-deltas.json` navigation view from the already verified
installation. It records exact changed values, absent/null distinctions and
unchanged top-level field names. Original JSON and HTML remain authoritative;
the checker independently selects original evidence to challenge the view.
Do not claim the checker computed hashes with reading tools. Runner transport
integrity and author deterministic comparisons remain author evidence.

The source ciphertext and every protected input byte/digest remain unchanged.
The reviewer must judge source conclusions afresh: the failed session has no
accepted factual conclusions. This is a tool/navigation repair, not historical
research or a new source disposition.

## Follow-ups from the diagnostic report

The following are bounded author checks, not independent acceptance:

- **Description consumers:** `formatEntitlementLabel` prefers `description`, so
  the new starting-position revision's tooltip becomes `Unprotected`.
  `EntitlementPickRow` separately renders the original-team logo and explicit
  year/round; it does not use that tooltip as the visible pick identity.
  `RealDraftReviewPanel` uses the retained review row's `label`. Existing roots
  retain the original description and saved-world reads select legacy fields
  through `readDraftSourceForWorld`. No label/identity source package change is
  justified by this follow-up; actual hosted verification must still check the
  pick identity, terms and review state together.
- **LAC membership:** the complete, stable October 21 inspector snapshot of
  `architect_baseTeams/LAC` has no root `entitlementIds` and no
  `draftSourceRevisions`. Its update time is `2026-10-20T08:40:51.500932Z`.
  Thus there is no existing LAC entitlement-index entry to remove. The resolver
  treats an absent base index as empty. The three-record package does not write
  LAC, ordinary legacy pick arrays, or any saved world. This does not claim that
  all legacy pick arrays are current qualified ownership data. The snapshot's
  verified complete plaintext digest is recorded in `INSPECTION_RENEWAL.md`;
  this LAC check is retained author evidence outside the review's protected
  packet, not an independently observed live fact.
- **Time/scope:** the retained original source and accepted June 5 starting
  position remain the authority for the bounded ownership component. Neither
  publication/capture date nor refreshed ordinary team fields establish October
  ownership, trade legality, Stepien closure or later-world continuity.

All 278 entries and 29 unresolved requirements remain required. First-round
Apply, broader rights adoption, world migration and V1 closure remain excluded.
After scoped author checks, freeze/push the repaired candidate, obtain current
CI and fresh public review, then dispatch the existing protected private reviewer.
Owner approval is still required before private input use. Only a new green,
complete recovered private judgment can precede separate source approval and
actual hosted GM verification.

## Author validation

`npm run test:private-source-review` passed all four focused tests, including
real encryption/wrong-key/input rejection, exact navigation values/presence,
protection/identity/acceptance gates and encrypted-original denied-tool rejection.
The actual private package produced the exact expected deltas and retained all
17 unchanged PHI fields. Its source/evidence digests remain unchanged; the stable
LAC snapshot check above passed. Targeted Markdown, `git diff --check` and
`npm run validate:project` passed. No app build, typecheck, emulator replay or full
suite was repeated: app/publisher/source behavior and protected input bytes are
unchanged. Required hosted checks and fresh public/private reviews remain gates.
