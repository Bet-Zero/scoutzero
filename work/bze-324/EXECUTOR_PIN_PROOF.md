# BZE-324 immutable executor tree proof

Pinned executor: `df87a5598073f0f90a37d707bed4eac9fe6118fe`.

Every tracked mode/type/blob/path entry outside the four exact exclusions below
is compared, including all source/scripts, schemas, dependencies/lockfile,
configs, assets and the credentialed worker workflow. This is broader than
checking only maintenance modules. No executable file is excluded.

- `.github/workflows/nba-maintenance.yml`: reviewed caller's literal pin update.
- `work/bze-324/PUBLISHER_ACCESS.md`: owner trust pin and reviewed setup procedure.
- `work/bze-324/CLOSEOUT.md`: author receipts.
- `work/bze-324/EXECUTOR_df87a5598073f0f90a37d707bed4eac9fe6118fe_PROOF.md`: this static evidence.

The pin's filtered manifest has 2920 entries and SHA-256
`166a639e5f8df6180fe928e6593e948286d0c5b4791ecba1cde19ad48667ecfb`.
The manifest is the exact NUL-delimited `git ls-tree -rz` output, filtered by
those exact paths, retaining one trailing NUL. The candidate must produce the
same count/digest; this compares actual git objects rather than git status.

After the replacement candidate is committed, the immutable PR review request
retains its full SHA, `git diff --name-status <pin> <candidate>` result and both
manifest digests. Every difference must be one of the four reviewed exclusions.
Also run `verifyTrackedExecutor` on the actual committed candidate bytes.
A new source/lock/config/worker change invalidates this proof and needs a new
pin, owner trust update and review. Changes in the ordinary approval registry
are reviewed **data**; the worker reads them from exact live main, never as code.

The pin and candidate must both be ancestors of the normally landed main. The
worker checks its own attested SHA and tracked bytes at runtime. This static
comparison establishes that the code the reviewer reads is what the pinned job
will execute; it does not establish live WIF/IAM access or NBA factual acceptance.
