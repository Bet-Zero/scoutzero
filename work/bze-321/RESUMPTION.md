# BZE-321 continuation after the ordinary NBA refresh

## October 22 hosted destination selector repair

Owner-approved hosted run `39593277348`, job `119199277298`, failed on exact
candidate `fff91657a3c2d57b9350b31ae02c7dd837e32f26` at
`stage-pick-destination`. The exact preview resolved and the temporary Auth
account was deleted (one created, one deleted, cleanup complete). Source
installation `39590633749` remains successful; no replay or access repair.

Cause: the driver's anchored destination regex was case-sensitive. A read-only
GET of the live DEN base-team document returned HTTP 200; bounded diagnostics
confirmed its name equals the intended Denver full name ignoring case, is
uppercase, and does not match the title-case selector. No document body, roster,
credentials, identity claims or evidence was logged. `useTradeMachineTeamOps`
merges loaded team data over base metadata; `TradeEditor` passes that team through
`toEntitlementTeamOption`; `EntitlementPickRow` renders its `teamName` verbatim.
Thus the real menu uses uppercase while the test fixture formerly used title case.

Changing only the public browser fixture to uppercase reproduced the exact
staging timeout with the old driver. The repair adds only the case-insensitive
flag to the anchored, row-scoped **Denver Nuggets** selector. It does not choose
any destination, a different year, another row, or a synthetic hosted pick.
Browser regressions now stage and cancel title/upper/mixed-case names, and reject
a similar suffixed name and a different team. Empty inventory and wrong-year/
round rejection and cross-origin identity confinement remain covered. Both real
browser tests pass. These are driver regressions, not actual hosted GM proof.

No product, authentication, request-policy, workflow, source/Rules/IAM, release,
qualified source facts, worlds/history or NBA-data changes. Both BZE-321 encrypted
inputs remain retired and requests dormant. All 278/29, exact qualified PHI 2028
row, auth/cache/digest, failure/reset, no-Apply, zero-app-write and temporary Auth
cleanup assertions remain unchanged. Dependency-scoped qualification, encryption,
cleanup and installation evidence carry forward; no factual research is repeated.
Freeze the repair, require exact-head CI and independent delta ACCEPT plus ready
preview, then hand Work the corrected protected hosted run. Cancel superseded
runs; never self-approve. Actual hosted success, landing and post-hosted cleanup
remain pending. No unchanged rerun, new setup or Google repair is requested.

## October 21 installed — final hosted candidate preparation

Protected source run `39590633749`, job `119190520506`, succeeded on caller
`fdb1feaf0071b6dfecb76a5ce0cc5a64ff5b73da` with immutable worker
`85139f9f63afa8341b7bd599dc8d1b7bc7fac432`. GitHub job state and the original
log confirm the 11:29:02Z receipt: `documentWrites: 3`, `sourceVerified: true`,
`rulesVerified: true`, and `existingReviewReleaseVerified: true`.
The log and receipt are retained privately. No write replay occurred.

Finalization removes `.github/bze321-source-installation.json.gpg` and the retired
`.github/bze321-installation.json.gpg`, sets the operation request to `none`, and
disables the private qualification request. Ordinary NBA maintenance ciphertext
and the public inspection certificate are unrelated and preserved.
The phase regression requires dormant requests and absent ciphertext, retaining
immutable routing, secret-handoff and protection checks. Ciphertext remains in
public Git history; checkout deletion is not history erasure. Cleanup review
`39592848093` accepted the initial source-input removal. Its inspection identified
the older release input, now removed too before the replacement candidate freeze.

Unchanged dependency acceptance: private factual qualification `39558428239`,
encryption `39588462884`, fixture `39589250853`, activation `39590706950`, and
installed-caller CI `39590641550`. Retained plaintext/evidence digests still match.
Prior preservation/emulator receipts cover legacy roots, ordinary NBA fields,
saved-world projection/history sentinels, guarded atomic application, stale/replay
rejection, and allowed/denied queries. These are retained proofs, not new reads
of production worlds or repeated factual research. Runtime, source facts, Rules
and all 278/29/no-first-round-Apply boundaries are unchanged by cleanup.

Freeze this delta, obtain exact-head CI and focused dependency-scoped review,
then hand Work the protected hosted run for that exact candidate. The existing
driver must prove authenticated real GM review, the qualified 2028 ownership row,
the pinned 278-entry/29-unresolved release, unsigned/invalid-token denials,
unavailable/reset behavior, Apply unavailable, zero app-data writes and temporary
Auth-account cleanup. Cancel superseded/premature hosted runs; never self-approve.
Work coordinates browser prerequisites and the owner approval handoff.

Actual hosted success, normal landing, merged CI/deployment verification and
documented access/secret/Library/local-transfer cleanup remain required. Preserve
installed data/Rules and ordinary NBA maintenance trust. No IAM edit, new data
publication, hosted success, landing or V1 completion is claimed here. Retain
recovery evidence until its required post-hosted cleanup. Historical sections
below do not authorize another source run or secret save.

## October 21 passphrase compatibility repair — prepared for Work

First repair candidate `51f094f0` passed its 25 focused tests; its PR-merge CI
`39588300793` exposed a separate preflight fixture coupling after main advanced
to `0367a72e`. The three failing tests read the mutable merge checkout's root
`firestore.rules` while the preflight correctly accepts only its frozen Rules
hashes. Isolate the test input as an exact public fixture copied from
`85139f9f:firestore.rules`, SHA-256
`40069e84f342f06e50da3e7ed15755935d3c41627751b2226cb73c6cde5b19cd`.
Production Rules, preflight hash/logic and live-drift rejection stay unchanged;
the explicit unapproved-drift rejection test remains. This does not accept new
live Rules or alter any other agent's root Rules change.

Source run `39561644055` attempt 2, job `119168559688`, passed actual Google
authentication after the completed trust repair. It stopped with
`APPROVED_INSTALLATION_REQUIRED` before decryption or any source/Rules write.
The frozen worker's shared decryptor requires a 64-character URL-safe passphrase;
the prepared standard-Base64 value did not meet that alphabet. The source
dispatcher uses `APPROVED_SOURCE_SHA256` correctly. An empty legacy
`APPROVED_INSTALLATION_SHA256` is expected here and must not be recreated.

Generated a fresh 384-bit URL-safe key privately and re-encrypted the **exact same
201,167-byte approved source package**. New AES256 ciphertext: 21,422 bytes,
SHA-256 `6c3a7e131fb0cc27c351520f65153c60a5f652602d7c5c2ed959bfc970f71451`.
Complete plaintext SHA-256 remains
`385b24b93dde1cd6081a949da5e025d48e03e94ed0194c93115a7b7cc7333b96`;
complete evidence SHA-256 remains
`4a993fbf94c2c421d77f606d5c498077d8e22489388feafdfa00821e4c3bff68`.
The immutable source reader/decryptor files were compared byte-for-byte with
worker `85139f9f63afa8341b7bd599dc8d1b7bc7fac432`. Actual decryption and source
format validation passed with the generated key and again with the actual
private attachment readback. Wrong compatible key, wrong digest, standard-Base64
plus/slash, whitespace and wrong length were rejected. No guard was changed.

Fresh owner-only sharing check and exact key attachment readback passed. Work
replaces only existing **environment secret `BZE321_INSTALLATION_PASSPHRASE`**
from the current private handoff. Do not rotate either evidence part, source or
evidence digest variable, reviewer token, or any Google/IAM/provider setting.
No passphrase value is stored in repository text, public receipts or logs.

Private factual ACCEPT `39558428239` still binds the unchanged plaintext and
evidence; it does **not** cover this new ciphertext by itself. Fresh focused
independent delta review must judge the encryption-only change and carry-forward
dependencies. No repeated historical research or private factual review is
requested absent a concrete governing requirement. Existing publisher/inspector
pins, runtime code, source facts, ordinary NBA fields/history, saved worlds and
all 278/29/no-Apply boundaries are unchanged.

Validation: 50 focused connection/installation/preservation tests passed (one
existing skip), including real GPG URL-safe recovery, incompatible-alphabet and
unapproved-Rules drift rejection. Actual private complete
plaintext/evidence/readback checks passed; required exact-candidate CI and delta
review remain gates. No duplicate local full suite/app build/emulator replay or
environment rebuild. The operation request is unchanged; no installation has
been dispatched for the repaired head. Do not rerun the old-cipher caller after
replacing its key. Work coordinates the normal reviewed request activation and
protected source approval only after key-save verification and current gates,
then actual hosted GM proof/landing/cleanup. This is preparation, not installation
or hosted/V1 completion.

## October 21 qualified source publication request

Private run `39558428239` passed on candidate
`96a44763c3f44dc8f75668d1d066688571687491`. Its complete original encrypted report
was recovered through existing private attachment
`35f63c06-da5f-4f8b-87a6-bc4ffc7fa23e`; ZIP SHA-256
`6b2d8c288840fd8ac11b023d838ab02cab1573afe1d729a3cc7a39747fdec9bc` and complete
plaintext SHA-256
`36c5c5132c961bfd1ed9cda7f52479627a6533632b8411e3b2b102c1e95997df` match the worker.
The full result was inspected: exact run/candidate/source/evidence identities,
successful execution, no denials, ACCEPT without blocking findings.

The `publish-source` request carries that qualification forward only while source
`385b24b93dde1cd6081a949da5e025d48e03e94ed0194c93115a7b7cc7333b96`, evidence
`4a993fbf94c2c421d77f606d5c498077d8e22489388feafdfa00821e4c3bff68`, ciphertext
`8ea77bc610455f410ee7b360913c1627c964f111358dcc0fc835a7ee5c0c474f`, all reviewed
implementation and immutable worker pins remain unchanged. It is not a private
run of a later request-only head. Public review `39560811617` explicitly accepted
this dependency-scoped reuse, conditional on green current CI and owner approval.

CI `39560714307` correctly stopped on the former revalidation-only request lock:
one failed phase assertion, 515 passed files, 6,380 passed tests. Update that
assertion for the completed qualification phase, adding an exact qualified
ciphertext check for source requests. All dormant routing, immutable pins,
explicit-secret, protected-environment and approved-digest assertions remain.
No publisher/runtime implementation changes. Request indentation alone retriggers
the existing push-only worker for the replacement head; its semantic value stays
`publish-source`. The stale publication run was canceled before any execution.

Current exact-head CI and public review must pass before the source approval.
The unchanged worker then proves access, all nine permissions, current exact
before-images, Rules/release and permission probes before any write. Do not
request Google changes without a real observed failure. The approval reserves
the short exclusive Rules-update window. Actual hosted GM verification remains a
separate protected step after source success. The June 5-only ownership scope,
legacy roots/world preservation, all 278 entries/29 requirements and no-Apply
boundaries remain unchanged. No source/world writes or hosted success are claimed.

## October 21 private report recovery and tool repair

The owner saved all five protected values and approved private run `39554620116`.
Actual input reconstruction/decryption passed. The independent session completed,
but six prohibited Bash attempts caused the result step to fail closed. The
owner-returned encrypted original was recovered through private Linear; ZIP and
complete plaintext digests match the worker, as do candidate and input bindings.
The complete report was inspected. Its apparent ACCEPT is not usable acceptance.

The [bounded repair](PRIVATE_REVIEW_REPAIR.md) exposes only Read/Glob/Grep and
adds a private exact field-delta navigation view. Ciphertext, protected inputs,
source facts, publisher/inspector pins and all approval/result checks stay
unchanged. Author checks address the description consumer and absent LAC index;
the reviewer still judges the factual conclusions afresh. No source/world writes
or hosted GM acceptance occurred. Replacement exact-head CI/public review and
protected private acceptance precede the separate source-publication gate.

## October 21 recovered inspection and renewed review inputs

The owner-provided original ZIP was recovered and decrypted through the verified
private Linear handoff. [Inspection recovery](INSPECTION_RENEWAL.md#completed-inspection-and-recovery--october-21)
records exact original-byte and plaintext receipts. Actual protected inspection,
Google authentication and stable double-read succeeded; no Google/settings change
is requested. Capture: `2026-10-21T04:58:19.201Z`. The snapshot contains the exact
548 governed source paths (30 teams, all 278 entitlement definitions and 240
underlying pick-rule paths); 308 are present. This is inventory and precondition
evidence, not new qualification of all rights or resolution of the 29 facts.

The existing entitlement before-image/version and absent rule are identical to
the historical proposal. Live Rules and ruleset are also identical. Only PHI's
ordinary before-image and update-time precondition changed with the completed NBA
refresh. The renewed logical proposal retains all 17 current PHI root fields and
the same sole draft membership change. The actual atomic commit masks only
`draftSourceRevisions` for the two existing records and uses `exists:false` for
the one absent rule. Legacy roots, saved-world reads and unrelated LAC fields
remain unchanged. No production user/world data was read or copied.

Renewed exact source package:
`385b24b93dde1cd6081a949da5e025d48e03e94ed0194c93115a7b7cc7333b96`
(201,167 bytes). Renewed private evidence:
`4a993fbf94c2c421d77f606d5c498077d8e22489388feafdfa00821e4c3bff68`.
Every parsed evidence field except `installationSha256` equals the retained
prior evidence packet; original source HTML and its accepted June 5 ownership
scope are unchanged. No new source collection, historical research or factual
disposition was introduced. Current ordinary NBA fields do not make that retained
draft starting-position evidence a claim of current October ownership.

Baseline Rules SHA-256:
`502b9b657474a960dc8d32507cd4e410c7aae4e5610e86aa76b636ddc936976e`.
Proposed Rules SHA-256:
`9cd7f6b25425f6a340b87d9f280f10d10d2ce2beb8db6e3e21ea1580f25d0e0d`.
Both are byte-identical to the previously prepared private Rule inputs. The
source, release and inspection executor pins are unchanged.

Actual bounded emulator verification of this renewed package passed using the
already-installed emulator binary, without rebuilding the cloud environment:
atomic application; exact logical readback; stale-version rejection with no
partial create; replay rejection without mutation; unchanged ordinary fields;
legacy saved-world projections; four unchanged disposable source/world/history
sentinels; exact private Rules compilation; 12 allowed authenticated/anonymous
GET/equality/`in` reads and 12 denied unsigned/unapproved/mixed/unbounded/write
cases; exact before-field restoration. Emulator-specific update times were used
for local commits; production preconditions remain those in the exact package.
The owned emulator was stopped and both ports were confirmed closed.

A fresh 384-bit random package passphrase remains outside Git. Exact AES256 GPG
recovery and wrong-key rejection passed. Raw ciphertext is 21,420 bytes, SHA-256
`8ea77bc610455f410ee7b360913c1627c964f111358dcc0fc835a7ee5c0c474f`.
The existing owner-only completion Page passed fresh complete sharing checks,
harmless upload/readback, then exact readback of the password and two evidence
parts (24,000 and 23,992 ASCII bytes). A rehearsal using those actual returned
file contents reproduced the complete source/evidence/HTML bytes and all bindings.
No plaintext source, Rules, passphrase or evidence part is committed.

The integration receives HTTP 403 for both existing environment-secret public-key
and environment-variable administration. The concrete replacement inputs are
therefore retained on the existing private Page for the protected owner handoff.
This is required input delivery at the existing gate, not a Google/network setup
request. Preserve all protections and the existing reviewer credential. Do not
dispatch against stale protected values or interpret a review of historical
inputs as acceptance of this package.

The request selects `none`; neither publisher can enter from it. Exact-head CI
and fresh focused public independent acceptance precede native private-review
dispatch. The protected private factual review must accept these exact inputs
before any separately protected source approval or hosted GM verification.
All 278 entries, all 29 unresolved requirements and first-round Apply boundaries
remain intact. Landing and access/transfer cleanup remain later gates.

Completed author validation: exact checksum/decryption recovery; real current
before-image/rules/field-mask checks; bounded emulator proof; actual private
uploaded-input reconstruction; GPG recovery/wrong-key rejection; focused source
installation/preservation tests; targeted Markdown and diff checks. No local full
suite, app build/typecheck, source research or environment rebuild was repeated;
unchanged implementation evidence is reused and mandatory hosted checks remain.

## October 21 transport correction

The operator escalation supersedes the historical host-configuration request
below. The owner published the requested network setting and reports completing
the guarded Google renewal. The listed Azure host still returns HTTP 403; this
is not evidence of a Google failure. No more domain/settings changes are requested.

The existing BZE-325 private Linear attachment returned exact original encrypted
ZIP bytes, matching GitHub artifact metadata. Two separate harmless control
reads/decryptions through the same attachment mechanism passed with the renewed
inspection key; wrong-key rejection passed. The [verified return route](INSPECTION_RENEWAL.md#verified-private-return-route--october-21)
records exact hashes, repeatability, limits and the one-file owner-browser fallback.
No direct connector-file ingress is claimed. A signed File Service URL probe was
rejected by automatic approval review and was not retried or routed around.

This checkpoint changes the manual transport preflight and the revalidation
test's allowed request states (`none` or read-only `inspect`, never either
publication operation). The former assertion pinned `none` even after successful
preflight and would falsely fail CI for the required inspection request.
The test retains exact worker, environment, secret and dormant-dispatch checks.
Request remains
`none`; existing inspector/publishers, protections, source data, all 278 original
entitlements and all 29 requirements are unchanged. After required exact-head
CI and focused independent review, queue only protected read-only inspection to
verify actual Google trust and recover fresh PHI/LAC/Rules preconditions. Private
factual acceptance, exact-package protected source approval, hosted GM proof,
authorized landing and cleanup remain separate unsatisfied gates.

No historical research, environment rebuild, broad app suite or source write was
repeated. Author checks for this docs-only checkpoint: original-byte recovery,
two real CMS decryptions, wrong-key rejection, pinned Canon lookup, targeted
Markdown lint, focused source-installation tests and diff checks. Required hosted CI/review must be recorded before
the operational inspection request.

## October 20 preparation — historical receipt

Current main is `4e192a99b6219654bb3e1ea2aa69bffed9c2f6b2`; required hosted
CI `39389416462` passed. PR #547 resumes from
`6667f45218a09df78729d80f4e9a18df79716ae4` on its existing branch.
The only textual merge conflicts are the two CI step groups; retain both the
draft checks and the completed shared cloud checks.

Risk contract: authenticated, read-only draft review and bounded source
installation preparation. Prevent a stale three-record package from replacing
refreshed team fields, preserve legacy/saved-world reads and the original
278-entitlement/1,483-occurrence inventory, and retain all 29 unresolved
requirements. First-round Apply and broader source adoption remain blocked.

The accepted audit and real projection were recovered from their existing
private Linear attachments and match the recorded archive hashes. Reuse their
accepted evidence; do not repeat historical scraping or adjudication.
The pinned `CBA2-A12.1` lookup passed in this environment.

The old pending source request `38997025928` was canceled before any resumed
publication. The request now selects `none`, which invokes no credentialed worker.
No old source-write approval is extended to changed before-images or versions.
Recover its fresh private snapshot and compare the exact three paths before
preparing a replacement installation. The original five-record release and
source correction are separate operations.

The current Firebase reader checked the three exact paths at
`2026-10-20T09:40:03.169Z` (the retained private receipt controls the precise
capture time). PHI is readable and its live version is
`2026-10-20T08:40:53.682051Z`, replacing the package's
`2026-06-07T04:25:03.947709Z`. Its full before-image differs. The entitlement
and rule reads return 403, which establishes neither their contents nor absence.
The old package is therefore stale and cannot execute unchanged.

The previous inspection recipient's private key is absent from this fresh
workspace and the recovered handoff. A new local recipient has been prepared
for the same encrypted inspection/report mechanism. Its private key remains
outside Git; only its public certificate is changed. The exact new inspector
commit must receive independent review and the owner's narrowly scoped existing
WIF trust update before an inspection request is queued. The source publisher
and old installed release pins remain unchanged. Do not dispatch a known-to-fail
operation using missing trust or pretend an undecryptable artifact is recovered.

Artifact download is a second concrete setup dependency: GitHub's connector
returns a File Service reference unsupported by the executor's Sediment-only
download tool. The API's current artifact redirect is on
`productionresultssa11.blob.core.windows.net`; existing executor policy does not
allow GitHub's artifact hosts. A supported domain-policy change or explicit
encrypted-file handoff is required; do not bypass the proxy.

Validation will cover changed integration contracts, exact private record
preconditions and emulator compatibility, required exact-candidate CI, fresh
independent public and protected private checks, and the actual hosted GM flow.
Reuse the completed cloud tooling and unaffected accepted proof. Do not run
the full local suite or migrate saved worlds. Landing still requires every
applicable acceptance gate; a successful inspection is not publication or
hosted product verification.

The renewed immutable inspection executor is
`ee71a8bbfb334178c8bb147efec48f468b52ad38`. The request remains `none`.
Its public certificate has SHA-256 fingerprint
`DE:3F:99:61:03:1C:41:88:5F:6A:3D:63:52:1A:E6:49:1B:92:A1:78:FF:BE:BB:69:0D:46:73:9E:D7:4D:80:DE`;
a real CMS encryption/decryption roundtrip passed using the locally retained
private key. Private review report encryption reads this same immutable public
recipient. Neither publisher executor changes.
The key was also retained in the existing owner-private completion Page after
fresh complete sharing checks, a harmless transfer probe, and exact authenticated
readback. [Inspection renewal](INSPECTION_RENEWAL.md) describes only the remaining
protected setup change and artifact-access prerequisite.

Author proof recovered the original inventory member with SHA-256
`1630576795d6ae5c378f9d0c689c95b83f027ea2a8e42f0b468150a2665daf22`.
Every original member identity and retained field reconciles across 278
entitlements, 1,483 occurrences, 877 dependencies and five predecessors.
The exact 29 unresolved requirements and their membership remain unchanged.
The accepted audit/projection manifests also reconcile. These are recovery and
preservation checks, not new source adjudication or independent acceptance.

The existing Firestore emulator reproduced the five-document release and
exercised the bounded three-record commit with emulator-specific versions.
Successful atomic application, exact readback, stale-version rejection and
`exists:false` replay rejection passed. Failure left every source document
unchanged. Password and anonymous authenticated exact-ID GET, equality and
`in` queries passed; unapproved IDs, mixed/unbounded queries, unsigned reads and
client writes were denied. Original legacy roots, current PHI ordinary fields
and disposable saved-world/history sentinels were preserved. Production saved
worlds were neither read nor written. The owned emulator was stopped.

The replacement preparation is explicitly incomplete: the current PHI
before-image is known, but live draft before-images, current Rules and the
exclusive publication window are not. It is not an approval package.
Private author receipts and scripts remain outside Git.

Completed local validation: pinned Canon lookup; 52 architecture/cloud/deployment/
inventory tests (one existing skip); 59 source/preservation/server/policy/review
tests (one existing skip); five review-session UI tests; four private-review
transport tests; two browser boundary tests; current-main compatibility probe
(three tests); typecheck; cloud typecheck; project validation; production build;
and targeted Markdown checks. The production build retained its existing
bundle-size and browser-external warnings. No full local suite was run.

The first resumed CI run caught a stale inspection SHA in the static draft
connection plan. The plan now agrees with the immutable caller pin; its
draft-only condition is still not a live-provider replacement. The focused
architecture/cloud/deployment/inventory/source checks then passed together
(66 tests, one existing skip). This metadata repair does not change either
publisher or the application runtime.
