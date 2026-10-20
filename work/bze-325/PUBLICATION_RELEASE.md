# BZE-325: exact approved production release

Historical first-registration receipt. Current package/expiry are in
[PUBLICATION_RENEWAL.md](PUBLICATION_RENEWAL.md); the current immutable worker and
protected delivery/trust gates are in
[PUBLICATION_SECRET_WIRING.md](PUBLICATION_SECRET_WIRING.md).

The owner approved production publication of the unchanged plan and explicitly
approved both transfers: this exact prepared ciphertext's public GitHub retention
and its dedicated passphrase's private BZE-325 handoff. These receipts transcribe
the owner's decisions; they are not agent self-approval.

- Plan: `ac0016092079f5fc72f7fba83dbb9fbb2dfd9a753401e423d1e6f36058bfe0cf`.
- Input: `b05248c7ae8e9ee6246ff6b7a38ade7b11f982aadea3d2bc4f7fa67f4af474ef`.
- Production approval: private BZE-325 comment
  `2c10e94b-467f-41a8-90f7-a128c6e09e5e`.
- Exact ciphertext/private passphrase transfer consent: private BZE-325 comment
  `036f8edb-f1c9-4d8e-b12a-15010bd15975`.
- Source qualification and exact-plan ACCEPT: private BZE-325 comment
  `a729fd48-83e0-4501-ae16-c3fcd53db8fc`, protected run `39189795818`.
- Repaired executor: `372c52e453a057fe1713d0e9d3e181829a381688`, unchanged.
  Code ACCEPT `39193882675`; actual keyless access/readTime proof `39194457638`.
- Release expiry: `2026-10-20T04:58:23Z`. No automatic expiry renewal.

## Exact ciphertext and the existing digest contract

Only `.github/nba-maintenance-publication.json.gpg` and public approval metadata
enter Git. Plaintext, the dedicated passphrase, source archive, old rehearsal
archive, credentials and user/world data do not.

The exact previously prepared and approved ciphertext is 1,796,145 bytes. It was
not regenerated. Its actual **raw file SHA-256** is:
`76ae660876622da2eab1958176153075c762212f962d29a40742f7ba5cb2907a`.

The immutable package/worker's existing `ciphertextSha256` field uses
`cloudData.digest(Buffer)`, which hashes `JSON.stringify(Buffer)`, including every
byte, rather than hashing raw file bytes. The matching existing protocol value is:
`ab8d5750e496f85b4322a6430a5934c16e053a85eed151b836407df5d5dcfea8`.
That is the fingerprint given in the exact transfer-consent request. The raw and
protocol values both bind the same unchanged prepared file. They are deliberately
not interchanged. No global digest function, immutable worker, plan identity,
Google trust pin or factual decision is changed to register this release.

The first upload preflight compared the raw file digest to the protocol value and
stopped before transfer. An empty attachment link created after that failed PUT
preflight was removed. The checksum formats were then verified independently;
the exact passphrase upload succeeded and its 97 bytes were recovered and compared
privately without printing the secret. This does not alter the approved package.

## Author checks and remaining gates

The established package command generated a new separate 384-bit passphrase,
encrypted the plan plus qualification/review/owner receipts, actually decrypted
it and checked exact canonical equality. The prepared registry passes the existing
worker's schema, expiry, input/receipt binding and publication validation. Counts
remain 777 groups / 3,098 NBA records (652 creates, 2,446 updates), plus the same
777 atomic completion receipts. Saved worlds, historical starting data, draft
scope and every prior limitation are unchanged.

The production plan/inputs are not re-collected, re-qualified or re-prepared.
Existing full-plan emulator/browser/recovery and independent factual proofs are
reused. This registration changes no executable code. It requires fresh exact-head
independent registration review, normal hosted checks and normal landing.

GitHub returns HTTP 403 for environment-secret administration to this integration.
The owner must install the privately delivered value as the dedicated existing
`nba-maintenance-publication` environment secret
`BZE324_MAINTENANCE_PASSPHRASE`. Never place its value in a comment, Git, a workflow
input, a log or an Actions artifact. A fresh direct private download is issued
only for the coordinated owner handoff. The secret is a package-decryption value,
not a Google credential.

After reviewed landing and secret installation, dispatch only the exact registered
plan through the existing `nba-maintenance.yml`, requiring owner deployment
approval. Partial/failed invocations never count as whole completion; retain the
same plan and expiry and resume under its completion ledger. Actual full readback
and consumer verification must pass before BZE-325 is reported complete.

Actually run for this release: `npm run maintenance:package`, private exact
package/registry verification through existing worker validators,
`npm run test:cloud-dev`, `npm run validate:project`, targeted Markdown checks,
`git diff --check`, public-file secret exclusion and exact ciphertext byte/hash
checks, and `graphify update .`. App/browser/source/factual/type/build/full local
suite reruns are intentionally skipped for this ciphertext/metadata-only change;
normal hosted exact-head gates and independent review remain required.
