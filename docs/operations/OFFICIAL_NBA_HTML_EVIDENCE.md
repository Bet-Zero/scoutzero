# Bounded official NBA HTML evidence

BZE-307 owner approval `0512fa3e-35d0-4a46-ba67-d4669b973455` permits only
offline reassessment of the retained v2 supplement. No acquisition, PST
requalification, CBA interpretation or runtime consumer belongs to this tool.
The accepted baseline and v1/v2 remain immutable. New private source bytes and
source-bearing reports belong in an owner-only directory under the operating
system temporary directory, outside the checkout, and the existing private
Linear evidence attachments. Vite can serve ignored checkout files: repository
`tmp/` is not a safe destination for new evidence. Preserve accepted originals
while independently verifying copies into external private storage.

The verifier recognizes two deliberately limited forms:

- Numeric `queueTime` and `applicationTime` values inside one exact New Relic
  `NREUM.info` configuration grammar, in a direct body script. Only the changed
  numeric spans may differ. Every other configuration/script byte is protected.
- Presence versus absence of one paired Akamai loader and hidden noscript
  pixel on the registered results URL. Exact element grammar, head/body
  placement, matching asset identifier and a canonical monitoring payload are
  required. Extra attributes, executable statements, payload fields, nested
  factual content, duplicates or arbitrary exclusions fail.

The implementation compares original byte slices, without evaluating scripts,
fetching links, serializing DOM, stripping scripts or normalizing text. HTML
parsing identifies actual elements and their source locations only. Reports
record each permitted difference and every equal intervening byte interval.
Both original hashes/sizes remain distinct; protected-byte equality is never
reported as whole-response equality.

Source identity, HTTP HTML metadata, capture times, original hashes/sizes and
the retained manifest must verify independently of the byte comparison. The
2022 lottery metadata limitation and AP attribution cannot pass by matching
bytes. Source qualification, partial facts and complete requirement satisfaction
are separate decisions. Orlando's incompatible records remain held; no value
is selected. Preserve all 556 IDs / 278 entitlements and every reviewer caveat.

## Offline reproduction

Recover v2 attachment `0a5749fd-d152-4336-a909-cc85c326704f` through authenticated
Linear access. Its archive is 1,298,210 bytes with SHA-256
`b8cc8c2c505a31dea10285f944215240d6ad8d51213bc6c48302bbd12fafbf83`;
manifest SHA-256 is
`15b1e9e94c7f27ed1c1ba388d5de6eca5bc6f5f795f4a4b0b5b81ec7fe3e10ba`.
Reject unsafe, duplicate, linked or nonregular archive members before extracting
the exact 108-file inventory into fresh private storage. The verifier checks the
archive and manifest pins and every retained file before interpreting HTML.

The private author assessment is a separate input, retained verbatim. Its claims
and limitations require semantic review; the verifier checks source eligibility,
exact protected byte citations, lineage and preservation of existing dispositions.
It neither derives a claim from matching text nor promotes source qualification
to complete requirement satisfaction. Substitute private local paths:

All three inputs must already exist below `scoutzero-official-nba-html` in the
operating system temporary directory. Both commands and the callable generation
and retained-input entry points validate locations and metadata before reading
any input contents. The private root, input ancestors and source directories
must belong to the current user with owner-only read/traverse permissions;
archive, assessment and every source member must be regular, owner-readable,
owner-only files. Symlinks and hard-linked files are rejected, including nested
members and intermediate path components. The configured OS temporary-path alias
is resolved; arbitrary aliases and paths outside the private root are rejected.
Use fresh copies with directories `0700` and files `0600`; do not change or move
accepted evidence in place. This is a pre-read storage boundary, not protection
against concurrent filesystem mutation by the same owner.

```bash
NBA_PRIVATE_ROOT="$(node --input-type=module -e \
  "import os from 'node:os'; import path from 'node:path'; console.log(path.join(os.tmpdir(), 'scoutzero-official-nba-html'))")"

node --import tsx scripts/source-releases/official-nba-html/cli.ts build \
  --v2 "$NBA_V2_DIRECTORY" --archive "$NBA_V2_ARCHIVE" \
  --assessment "$NBA_AUTHOR_ASSESSMENT" --out "$NBA_PRIVATE_ROOT/new-supplement"

node --import tsx scripts/source-releases/official-nba-html/cli.ts verify \
  --v2 "$NBA_V2_DIRECTORY" --archive "$NBA_V2_ARCHIVE" \
  --assessment "$NBA_AUTHOR_ASSESSMENT" --out "$NBA_PRIVATE_ROOT/new-supplement"

npm run test:node -- tests/architect/officialNbaHtmlEvidence.test.ts tests/architect/officialNbaHtmlPrivateInputs.test.ts --reporter=dot
```

Build refuses an existing or non-private output directory. Verify independently
regenerates every candidate file and requires exact inventory and byte equality.
The manifest binds verifier implementation hashes, lockfile, unchanged v2 and
the author-assessment input. Retain and independently recover the generated
package before using its qualification results. The exact-candidate PR receipt
records the private supplement identity and recovery proof.

This narrow exception has no effect on the
60 Second Apron determinations, future lottery-method gap, 927 other occurrences,
five uncaptured PST pages, Needs input/no-write or trade-bonus deferral.
