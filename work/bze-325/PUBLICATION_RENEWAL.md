# BZE-325: owner-authorized expiry renewal

The owner explicitly approved renewing the existing publication and replacing
its exact prepared encrypted package. This supplements the original plan approval;
it is not automatic expiry renewal or a new NBA proposal. The full consent and
private package verification are retained on BZE-325.

- Unchanged plan:
  `ac0016092079f5fc72f7fba83dbb9fbb2dfd9a753401e423d1e6f36058bfe0cf`.
- Unchanged qualified input:
  `b05248c7ae8e9ee6246ff6b7a38ade7b11f982aadea3d2bc4f7fa67f4af474ef`.
- Previous expiry: `2026-10-20T04:58:23Z`.
- Explicitly approved replacement expiry: `2026-10-23T06:30:00Z`.
- Exact prepared replacement ciphertext: 1,796,150 bytes.
- Raw file SHA-256:
  `fc6ce43709b7aacbef3a3ae08df939f3a29b32434274d75721485d5ec1712ad4`.
- Existing worker protocol `SHA256(JSON.stringify(Buffer))`:
  `70db8424485519aca960b81e478295028f101a379f46c4e0ff15ffeb3a323f1f`.

The sole decrypted approval-envelope change is `expiresAt`. Plan bytes, qualified
input, independent factual/exact-plan acceptance and original plan-owner receipt
remain unchanged. The separate renewal consent explicitly authorizes this new
window and this ciphertext's public retention. The original approval/expiry and
failed attempts remain historical evidence. Existing dedicated secret is reused;
there is no new key, secret installation or private file transfer.

The original publication attempt stopped before Google access on missing secret
forwarding. The independently reviewed repair landed in PR 560. Main CI
`39317693982` passed. The actual preparation-only run `39317707254` received a
masked nonempty secret but stopped at expired registration before decryption.
Google authentication and execute were skipped. This proves delivery presence,
not successful package decryption. No production writes occurred.

A read-only check of only the exact approved targets at one coherent read time,
`2026-10-20T06:07:55.381Z`, matched all 3,098 before-images and preconditions:
2,446 existing records unchanged, 652 creates still absent, zero changed/failed.
No scraping, factual preparation, user data or saved-world reads were repeated.
This receipt is dated evidence, not a waiver of conditional publication checks.

This registration changes no runtime, workflow, worker pin, IAM permission,
environment protection, source scope or draft safeguard. The unchanged worker
is `655780bce4b6fb0ae20d5a723461ff6807887668`. Existing emulator, interruption/
recovery, browser and private factual evidence remain applicable. Current author
checks verify actual decryption, exact plan/approval equality and registry binding,
both ciphertext fingerprints, and absence of the dedicated secret from changed
public files. Targeted Markdown, project validation and diff checks apply; no
unrelated app/full-suite, collection or qualification reruns are needed.

After fresh exact-head independent review, normal checks and landing, dispatch
the exact registered plan with `operation=publish`, `prepare_only=true` first.
Actual green package decryption/approval validation with Google auth and execute
skipped remains required. Only then perform the bounded owner-only trust-pin
replacement from [PUBLICATION_SECRET_WIRING.md](PUBLICATION_SECRET_WIRING.md),
followed by the separately protected publication retry. Entire 777-group coherent
production readback and actual consumer checks remain completion requirements.
