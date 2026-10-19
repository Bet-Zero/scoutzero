# BZE-325: bounded publication and interruption recovery

The open P1 on PR #555 (`discussion_r4308895552`) is valid. The earlier emulator
apply/restore proof did not establish the production execution budget. Serial
per-document reads plus verification of every completed prefix could consume the
600-second token and ten-minute job without reaching new work.

## Bounded repair

The data proposal is unchanged:
`ac0016092079f5fc72f7fba83dbb9fbb2dfd9a753401e423d1e6f36058bfe0cf`.
The source archive, input digest, factual decisions and private ACCEPT are unchanged.

- Keep the existing ten-minute job and 600-second token. The fixed worker gives
  its execute phase a five-minute deadline, including repeated approval checks.
  Firestore requests use the smaller of 30 seconds and remaining execution time.
- Read known document paths with get-only `batchGet`, at most 100 per request.
  No list/delete/IAM/storage privilege or new infrastructure is added. Later
  pages pin the first page's final readTime; Firestore guarantees earlier rows
  unchanged through monotonically increasing batchGet read times.
- Authenticate all 777 completion receipts, then work on pending groups without
  re-reading completed player data. A completed prefix cannot consume the whole
  window through thousands of serial document reads before new work starts.
- Keep each group and its receipt atomic, exact before-image/version/absence
  preconditions and readback. Loss of a commit acknowledgement is recovered from
  that same authenticated receipt; no guessed cursor or rewritten plan is used.
- A partial result says `state: partial`, `complete: false`, and the worker exits
  nonzero. Its group count reports authenticated committed groups, not a fully
  verified refresh. Retain the exact plan and rerun the same still-approved
  publication through the owner-protected workflow; do not create a replacement
  proposal or reset expiry. A hard interruption may leave no result at all.
- Only a final coherent whole-plan snapshot of every receipt and after-image,
  including exact commit versions, can return complete. Drift or an incomplete
  read fails closed. Final-verification interruption is retried without writes.

The immutable executor pin must advance to the reviewed repaired code. Its
Google trust condition must replace only the old ordinary NBA worker SHA; draft
trust and all permission/owner restrictions remain intact. This is a required
owner-only trust-pin edit, not authority to broaden IAM. The updated access-only
probe checks the same three permissions, rejects the same excessive permissions,
and actually exercises fixed ordinary-document batchGet plus pinned readTime.
No production publication is armed by this repair.

## Actual focused proof

Private `publication-budget-proof-v2` used the actual retained 777-group /
3,098-record proposal, actual REST batchGet/commit against the existing core
emulator, and an emulator-only target/version rebase. All before/after fields,
group membership and NBA facts remain equivalent to the frozen production plan.
The original production digest remains unchanged.

Every actual REST request was charged one second on a virtual clock, with a hard
five-minute per-invocation cutoff. This is a stress model, not measured production
latency or a promise that publication needs only one deployment.

Observed committed groups: 97, 194, 291, 388; a deliberately lost acknowledgement
after actual commit 390; then 487, 584, 681, 777. The ninth invocation hit the hard
budget during whole-plan verification and made no completion claim. The tenth
verified all 777 already-committed groups, wrote nothing, and completed in 47
modeled seconds. Every invocation stayed within 300 modeled seconds. Exactly 777
atomic groups committed once. All 3,098 NBA records were then restored to their
original typed fields, and the existing saved-world root/team digest stayed
unchanged. Total actual local apply/recovery/restoration time: 54,332 ms.

The earlier v1 diagnostic allowed a whole bulk read to overrun its virtual
cutoff; it is retained privately and is not the governing hard-budget proof.

Native checks separately cover prefix drift, changed approvals/preconditions,
initial expiry, incomplete/duplicate/wrong-path/inconsistent bulk responses,
in-flight request timeout, and lost acknowledgement recovery. Existing unrelated
browser/source/factual proofs are reused within their unchanged scope; no new
scraping, factual qualification, app feature or full local suite is required.

## Landing and production status

Focused tests, tooling typecheck, Markdown/diff/project checks and graph update
are required before freezing. Fresh exact-candidate independent code review and
hosted CI must cover both the implementation and caller pin. The old private
factual ACCEPT does not attest this changed executable behavior.

After normal landing, replace the dedicated ordinary-worker trust pin, run the
protected access-only probe, and record its actual Google result. Only then
return to the owner for separate publication approval of the unchanged plan.
The registry stays empty and no production data changes are authorized.

Author checks actually passed: `npm run test:cloud-dev`,
`npm run cloud:typecheck`, `npm run validate:project`, targeted Markdown checking,
`git diff --check`, and `graphify update .`. The emulator was launched through
`npm run cloud:dev -- --scope=core --resume`, and stopped with verified export.
The focused private operator ran the actual v2 proof described above.
App/UI/browser/full-local-suite repeats were intentionally skipped because this
change affects publication mechanics only and the exact NBA proposal is unchanged.
Hosted exact-head gates and fresh independent review remain separate.
