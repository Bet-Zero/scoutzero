# Private PST source releases

This runbook governs immutable Pro Sports Transactions (PST) capture evidence.
It does not authorize parsing, product use, or public redistribution.

## Current release

- Release: `pst-current-bze-304-07daf7583c6c9ef5@v1`
- Release metadata:
  `docs/reference/sources/releases/pst/pst-current-bze-304-07daf7583c6c9ef5-v1.json`
- Canonical capture manifest SHA-256:
  `07daf7583c6c9ef5083a8c5547fc37c1767c296afdacf691ec4f256cdeff2a2f`
- Archive:
  `scoutzero-pst-current-bze304-07daf7583c6c9ef5-evidence.tar.gz`
- Archive size: `5,348,841` bytes
- Archive SHA-256:
  `ace3c381e3d2e39fd108804641be2654d2be0b3ebecf9d784ee186f11ea4b1ac`
- Private retention: Linear issue `BZE-305`, attachment
  `ce382197-6bd4-4f5b-93c5-36ded7ff6d87`
- Retrieval boundary: authenticated Linear access is required; an anonymous
  request returned HTTP 401 during the BZE-305 recovery proof.

The archive contains the exact BZE-304 `evidence/` directory: 42 raw HTML
files, 42 serialized DOM files, 42 screenshots, `manifest.json`, and
`manifest.sha256`. The 39 required raw response HTML files are canonical
source bytes. Three raw repeats are stability evidence. DOM and screenshots
are secondary evidence only.

## Recover and verify

1. Retrieve attachment `ce382197-6bd4-4f5b-93c5-36ded7ff6d87` from BZE-305
   through an authenticated Linear client. Save the returned bytes with the
   exact archive name above. Do not copy model-rendered base64 text.
2. Confirm the file is exactly `5,348,841` bytes and that `shasum -a 256`
   returns the archive digest above.
3. List the archive first and reject any absolute path or `..` path segment.
   Extract it into a new temporary recovery directory. Do not extract into
   `public/`, `src/`, or any served asset path.
4. Run the deterministic verifier against the checked-in release metadata,
   extracted `evidence/` directory, and downloaded archive:

   ```bash
   npx tsx scripts/source-releases/verify-pst-source-release.ts \
     --release docs/reference/sources/releases/pst/pst-current-bze-304-07daf7583c6c9ef5-v1.json \
     --evidence "$PST_RECOVERY_DIR/evidence" \
     --archive "$PST_RECOVERY_DIR/scoutzero-pst-current-bze304-07daf7583c6c9ef5-evidence.tar.gz"
   ```

The command fails closed on release-digest drift, malformed metadata or
capture manifest, unsafe or duplicate paths, missing/extra files, size/hash
drift, challenge-token URL values, an incomplete 39-page set, a malformed
repeat identity, or unstable canonical repeat content. A passing receipt must
report 39 canonical pages, 3 repeats, 126 captured files, 128 package files,
and both expected hashes.

## Source-use notices and limitations

The inspection on 2026-09-04 found the following without making a legal
conclusion:

- All 42 raw pages visibly contain: “Copyright © 2005-2026 Frank Marousek -
  All rights reserved.”
- Every raw-page footer links the label “Acknowledgements” to
  `https://www.prosportstransactions.com/acknowledgements.htm`.
- No terms, privacy, express license, reuse permission, redistribution
  permission, or robots meta text was found in the 42 raw pages.
- Ordinary requests to the acknowledgements page, `/terms.htm`,
  `/privacy.htm`, and `/robots.txt` each returned HTTP 403, so those responses
  established no additional terms or permission.
- No Cloudflare challenge/clearance token name appears in the manifest, raw
  HTML, or serialized DOM. Some secondary post-load DOM files do preserve
  dynamic third-party ad iframe URLs containing pseudonymous advertising
  identifiers and generic reCAPTCHA frame URLs. They are not canonical PST
  source bytes or PST access credentials, but this incidental capture data is
  another reason the exact package must remain private and unredistributed.

No express reuse license was established. Keep the retained raw pages private
as internal source evidence and do not publicly redistribute them. PST is a
third-party transaction source, not official NBA rules or team authority. The
release proves only the bytes observed during its fixed capture window; it
does not establish continuing freshness or product-ready fact coverage.

## Refresh and supersession

Never overwrite this archive, attachment, metadata file, release ID, version,
or digest. A refresh must use a new capture issue and temporary profile,
reperform the complete capture/integrity gate, retain a new private archive,
prove authenticated remote recovery, and create a new content-derived release
ID and metadata file. The new release must pin this release in `supersedes`;
both releases remain independently recoverable.

A later parser or product lane must name an accepted release explicitly and
prove its own coverage. Until that separate work is accepted, this release has
no runtime consumer, does not write Firestore, and does not change the current
first-round `Needs input` / no-write boundary.
